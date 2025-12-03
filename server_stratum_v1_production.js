/* server_stratum_v1_production.js - Production-ready Stratum mining pool server */
const net = require('net');
const http = require('http');
const JobDistributor = require('./jobDistributor_mainnet');
const { validateShare, buildFullBlock } = require('./lib/stratum_v1');
const { buildCoinbase } = require('./lib/coinbase');

// Configuration with validation
const STRATUM_PORT = process.env.STRATUM_PORT ? parseInt(process.env.STRATUM_PORT) : 3333;
const HTTP_PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;
const MAX_CONNECTIONS = parseInt(process.env.MAX_CONNECTIONS || '1000');
const RATE_LIMIT_WINDOW = parseInt(process.env.RATE_LIMIT_WINDOW || '60000'); // 1 minute
const RATE_LIMIT_MAX_REQUESTS = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100');
const COINBASE_PAYOUT_ADDRESS = process.env.COINBASE_PAYOUT_ADDRESS;

if (!COINBASE_PAYOUT_ADDRESS) {
  console.warn('WARNING: COINBASE_PAYOUT_ADDRESS not set. Blocks will use OP_TRUE output.');
}

// Simple metrics
const metrics = {
  connections: 0,
  totalShares: 0,
  validShares: 0,
  blocksFound: 0,
  blocksSubmitted: 0,
  malformedMessages: 0,
  unauthorizedAttempts: 0,
  rateLimitHits: 0,
  startTime: Date.now()
};

// Rate limiting per IP
const rateLimitMap = new Map();

function checkRateLimit(ip) {
  const now = Date.now();
  const record = rateLimitMap.get(ip) || { count: 0, resetTime: now + RATE_LIMIT_WINDOW };
  
  if (now > record.resetTime) {
    record.count = 0;
    record.resetTime = now + RATE_LIMIT_WINDOW;
  }
  
  record.count++;
  rateLimitMap.set(ip, record);
  
  if (record.count > RATE_LIMIT_MAX_REQUESTS) {
    metrics.rateLimitHits++;
    return false;
  }
  return true;
}

// Input validation
function validateMessage(msg) {
  if (!msg || typeof msg !== 'object') return false;
  if (msg.method && typeof msg.method !== 'string') return false;
  if (msg.params && !Array.isArray(msg.params)) return false;
  if (msg.id !== undefined && typeof msg.id !== 'number' && typeof msg.id !== 'string' && msg.id !== null) return false;
  return true;
}

function validateHex(str, maxLength = 1000) {
  if (typeof str !== 'string') return false;
  if (str.length > maxLength) return false;
  return /^[0-9a-fA-F]*$/.test(str);
}

// Logging
function log(level, message, data = {}) {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    level,
    message,
    ...data
  };
  console.log(JSON.stringify(logEntry));
}

function randHex(n) { 
  return require('crypto').randomBytes(n).toString('hex'); 
}

const jobs = new JobDistributor();

// HTTP server for health checks and metrics
const httpServer = http.createServer((req, res) => {
  if (req.url === '/health') {
    jobs.healthCheck().then(health => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: health.healthy ? 'healthy' : 'unhealthy',
        ...health,
        uptime: Math.floor((Date.now() - metrics.startTime) / 1000)
      }));
    }).catch(() => {
      res.writeHead(503, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'unhealthy' }));
    });
  } else if (req.url === '/metrics') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      ...metrics,
      uptime: Math.floor((Date.now() - metrics.startTime) / 1000),
      activeConnections: metrics.connections
    }));
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  }
});

const server = net.createServer((socket) => {
  // Check connection limit
  if (metrics.connections >= MAX_CONNECTIONS) {
    log('warn', 'Connection limit reached', { current: metrics.connections, max: MAX_CONNECTIONS });
    socket.destroy();
    return;
  }
  
  // Connection setup
  socket.setNoDelay(true);
  socket.setKeepAlive(true, 60000);
  socket.buffer = '';
  socket.extranonce1 = randHex(4);
  socket.extranonce2_size = 4;
  socket.authorized = false;
  socket.worker = null;
  socket.remoteId = `${socket.remoteAddress}:${socket.remotePort}`;
  socket.jobs = new Map(); // Track jobs sent to this connection
  
  metrics.connections++;
  
  // Rate limiting
  if (!checkRateLimit(socket.remoteAddress)) {
    log('warn', 'Rate limit exceeded', { ip: socket.remoteAddress });
    socket.destroy();
    return;
  }
  
  log('info', 'New connection', { remoteId: socket.remoteId });
  
  socket.on('data', async (chunk) => {
    // Buffer management
    socket.buffer += chunk.toString('utf8');
    
    // Prevent buffer overflow
    if (socket.buffer.length > 10000) {
      log('warn', 'Buffer overflow', { remoteId: socket.remoteId });
      socket.destroy();
      return;
    }
    
    let idx;
    while ((idx = socket.buffer.indexOf('\n')) !== -1) {
      const line = socket.buffer.slice(0, idx).trim();
      socket.buffer = socket.buffer.slice(idx + 1);
      
      if (!line) continue;
      
      // Rate limiting per message
      if (!checkRateLimit(socket.remoteAddress)) {
        socket.write(JSON.stringify({ id: null, error: [20, 'rate limit exceeded', null] }) + '\n');
        continue;
      }
      
      let msg;
      try {
        msg = JSON.parse(line);
      } catch (e) {
        metrics.malformedMessages++;
        log('warn', 'Malformed JSON', { remoteId: socket.remoteId, error: e.message });
        continue;
      }
      
      // Input validation
      if (!validateMessage(msg)) {
        metrics.malformedMessages++;
        log('warn', 'Invalid message format', { remoteId: socket.remoteId });
        continue;
      }
      
      const id = msg.id !== undefined ? msg.id : null;
      
      try {
        if (msg.method === 'mining.subscribe') {
          const sub = 'sub' + randHex(4);
          socket.subId = sub;
          socket.write(JSON.stringify({
            id,
            result: [
              [['mining.notify', sub]],
              socket.extranonce1,
              socket.extranonce2_size
            ]
          }) + '\n');
          
          const job = await jobs.assignJob();
          if (job) {
            socket.jobs.set(job.jobId, job);
            socket.write(JSON.stringify({
              id: null,
              method: 'mining.notify',
              params: [job.jobId, job.prevhash, job.version, job.nbits, job.curtime]
            }) + '\n');
          }
          
        } else if (msg.method === 'mining.authorize') {
          const params = msg.params || [];
          const workerName = params[0] || 'unknown';
          const password = params[1] || '';
          
          // Basic validation
          if (typeof workerName !== 'string' || workerName.length > 100) {
            socket.write(JSON.stringify({ id, error: [20, 'invalid worker name', null] }) + '\n');
            continue;
          }
          
          socket.authorized = true;
          socket.worker = workerName;
          log('info', 'Worker authorized', { remoteId: socket.remoteId, worker: workerName });
          socket.write(JSON.stringify({ id, result: true }) + '\n');
          
        } else if (msg.method === 'mining.submit') {
          if (!socket.authorized) {
            metrics.unauthorizedAttempts++;
            socket.write(JSON.stringify({ id, error: [24, 'unauthorized', null] }) + '\n');
            continue;
          }
          
          const params = msg.params || [];
          const workerName = params[0] || socket.worker || 'unknown';
          const jobId = params[1] || '';
          const extranonce2 = params[2] || '';
          const ntime = params[3] || '';
          const nonce = params[4] || '';
          
          // Input validation
          if (!validateHex(extranonce2, 16) || !validateHex(ntime, 16) || !validateHex(nonce, 16)) {
            socket.write(JSON.stringify({ id, error: [20, 'invalid parameters', null] }) + '\n');
            continue;
          }
          
          // Get the correct job
          let job = jobs.getJob(jobId);
          if (!job) {
            // Try to get from socket's job cache
            job = socket.jobs.get(jobId);
          }
          
          if (!job) {
            log('warn', 'Stale or invalid job', { remoteId: socket.remoteId, jobId, worker: workerName });
            socket.write(JSON.stringify({ id, error: [21, 'stale job', null] }) + '\n');
            continue;
          }
          
          // Validate share
          const res = validateShare({
            job,
            extranonce1: socket.extranonce1,
            extranonce2,
            ntime,
            nonceHex: nonce
          });
          
          metrics.totalShares++;
          
          if (res.pass) {
            metrics.validShares++;
            metrics.blocksFound++;
            
            log('info', 'Valid block found!', {
              remoteId: socket.remoteId,
              worker: workerName,
              jobId,
              headerHash: res.headerHash
            });
            
            // Submit block to network
            try {
              const coinbaseHex = buildCoinbase({
                extranonce1: socket.extranonce1,
                extranonce2,
                coinbase_script_prefix: job.coinbase_script_prefix_hex || '',
                coinbase_script_suffix: job.coinbase_script_suffix_hex || '',
                coinbase_value: job.coinbase_value || 0,
                height: job.height || 0,
                payoutAddress: COINBASE_PAYOUT_ADDRESS
              });
              
              const fullBlockHex = buildFullBlock(res.header, coinbaseHex, job.txs || []);
              const submitResult = await jobs.submitBlock(fullBlockHex);
              
              if (submitResult === null) {
                // Block accepted!
                metrics.blocksSubmitted++;
                const rewardBTC = (job.coinbase_value / 100000000).toFixed(8);
                log('info', '🎉 BLOCK ACCEPTED BY NETWORK! 🎉', {
                  remoteId: socket.remoteId,
                  worker: workerName,
                  headerHash: res.headerHash,
                  rewardBTC,
                  height: job.height
                });
              } else if (submitResult === 'duplicate') {
                log('warn', 'Block already submitted (duplicate)', {
                  remoteId: socket.remoteId,
                  worker: workerName,
                  headerHash: res.headerHash
                });
              } else {
                log('error', 'Block rejected by network', {
                  remoteId: socket.remoteId,
                  worker: workerName,
                  headerHash: res.headerHash,
                  error: submitResult
                });
              }
            } catch (e) {
              log('error', 'Error submitting block', {
                remoteId: socket.remoteId,
                worker: workerName,
                error: e.message
              });
            }
            
            socket.write(JSON.stringify({ id, result: true }) + '\n');
          } else {
            // Invalid or low difficulty share
            socket.write(JSON.stringify({ id, error: [21, 'invalid or low diff', null] }) + '\n');
          }
          
        } else {
          socket.write(JSON.stringify({ id, error: [20, 'unsupported method', null] }) + '\n');
        }
      } catch (e) {
        log('error', 'Error processing message', {
          remoteId: socket.remoteId,
          method: msg.method,
          error: e.message
        });
        socket.write(JSON.stringify({ id, error: [20, 'internal error', null] }) + '\n');
      }
    }
  });
  
  socket.on('close', () => {
    metrics.connections--;
    log('info', 'Connection closed', { remoteId: socket.remoteId, worker: socket.worker });
  });
  
  socket.on('error', (e) => {
    metrics.connections--;
    log('error', 'Socket error', { remoteId: socket.remoteId, error: e.message });
  });
  
  // Send initial null response (some miners expect this)
  socket.write(JSON.stringify({ result: null, id: null }) + '\n');
});

// Graceful shutdown
let shuttingDown = false;
function gracefulShutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  
  log('info', `Received ${signal}, shutting down gracefully...`);
  
  server.close(() => {
    log('info', 'Stratum server closed');
    httpServer.close(() => {
      log('info', 'HTTP server closed');
      process.exit(0);
    });
  });
  
  // Force close after 10 seconds
  setTimeout(() => {
    log('warn', 'Forcing shutdown after timeout');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Start servers
server.listen(STRATUM_PORT, '0.0.0.0', () => {
  log('info', 'Stratum server started', { port: STRATUM_PORT });
});

server.on('error', (e) => {
  log('error', 'Stratum server error', { error: e.message });
  process.exit(1);
});

httpServer.listen(HTTP_PORT, () => {
  log('info', 'HTTP server started', { port: HTTP_PORT });
  log('info', 'Health check available at', { url: `http://localhost:${HTTP_PORT}/health` });
  log('info', 'Metrics available at', { url: `http://localhost:${HTTP_PORT}/metrics` });
});
