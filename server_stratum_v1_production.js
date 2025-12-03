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
  if (req.url === '/') {
    // Root page with pool information
    const uptimeSeconds = Math.floor((Date.now() - metrics.startTime) / 1000);
    const uptimeDays = Math.floor(uptimeSeconds / 86400);
    const uptimeHours = Math.floor((uptimeSeconds % 86400) / 3600);
    const uptimeMinutes = Math.floor((uptimeSeconds % 3600) / 60);
    const uptimeDisplay = uptimeDays > 0 
      ? `${uptimeDays}d ${uptimeHours}h ${uptimeMinutes}m`
      : uptimeHours > 0 
        ? `${uptimeHours}h ${uptimeMinutes}m`
        : `${uptimeMinutes}m`;
    
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Bitcoin Solo Mining Pool - Status Dashboard</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      color: #e0e0e0;
      min-height: 100vh;
      padding: 20px;
      line-height: 1.6;
    }
    .container {
      max-width: 1200px;
      margin: 0 auto;
    }
    header {
      background: rgba(255, 255, 255, 0.05);
      backdrop-filter: blur(10px);
      border-radius: 12px;
      padding: 30px;
      margin-bottom: 30px;
      border: 1px solid rgba(255, 255, 255, 0.1);
    }
    h1 {
      font-size: 2.5em;
      font-weight: 700;
      color: #f7931a;
      margin-bottom: 10px;
      letter-spacing: -0.5px;
    }
    .subtitle {
      color: #b0b0b0;
      font-size: 1.1em;
      font-weight: 300;
    }
    .warning-banner {
      background: linear-gradient(135deg, rgba(247, 147, 26, 0.15) 0%, rgba(247, 147, 26, 0.05) 100%);
      border-left: 4px solid #f7931a;
      padding: 20px;
      border-radius: 8px;
      margin-bottom: 30px;
      border: 1px solid rgba(247, 147, 26, 0.2);
    }
    .warning-banner strong {
      color: #f7931a;
      font-size: 1.1em;
      display: block;
      margin-bottom: 8px;
    }
    .warning-banner p {
      color: #d0d0d0;
      margin: 0;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 20px;
      margin-bottom: 30px;
    }
    .card {
      background: rgba(255, 255, 255, 0.05);
      backdrop-filter: blur(10px);
      border-radius: 12px;
      padding: 25px;
      border: 1px solid rgba(255, 255, 255, 0.1);
      transition: transform 0.2s, box-shadow 0.2s;
    }
    .card:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
    }
    .card h2 {
      font-size: 1.3em;
      color: #f7931a;
      margin-bottom: 20px;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .stat-item {
      display: flex;
      justify-content: space-between;
      padding: 12px 0;
      border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    }
    .stat-item:last-child {
      border-bottom: none;
    }
    .stat-label {
      color: #b0b0b0;
      font-weight: 500;
    }
    .stat-value {
      color: #fff;
      font-weight: 600;
      font-size: 1.1em;
    }
    .stat-value.highlight {
      color: #f7931a;
    }
    .connection-box {
      background: rgba(0, 0, 0, 0.3);
      border-radius: 8px;
      padding: 20px;
      margin-top: 15px;
      border: 1px solid rgba(255, 255, 255, 0.1);
    }
    .connection-item {
      margin-bottom: 15px;
    }
    .connection-item:last-child {
      margin-bottom: 0;
    }
    .connection-label {
      color: #b0b0b0;
      font-size: 0.9em;
      margin-bottom: 5px;
      font-weight: 500;
    }
    code {
      background: rgba(0, 0, 0, 0.4);
      padding: 8px 12px;
      border-radius: 6px;
      font-family: 'Courier New', monospace;
      color: #f7931a;
      display: block;
      word-break: break-all;
      border: 1px solid rgba(247, 147, 26, 0.2);
      font-size: 0.95em;
    }
    .endpoint-link {
      display: inline-flex;
      align-items: center;
      color: #f7931a;
      text-decoration: none;
      padding: 8px 16px;
      background: rgba(247, 147, 26, 0.1);
      border-radius: 6px;
      border: 1px solid rgba(247, 147, 26, 0.2);
      transition: all 0.2s;
      font-weight: 500;
    }
    .endpoint-link:hover {
      background: rgba(247, 147, 26, 0.2);
      transform: translateX(3px);
    }
    .status-badge {
      display: inline-block;
      padding: 6px 12px;
      border-radius: 20px;
      font-size: 0.85em;
      font-weight: 600;
      background: rgba(40, 167, 69, 0.2);
      color: #28a745;
      border: 1px solid rgba(40, 167, 69, 0.3);
    }
    footer {
      text-align: center;
      padding: 30px;
      color: #888;
      font-size: 0.9em;
    }
    footer a {
      color: #f7931a;
      text-decoration: none;
    }
    footer a:hover {
      text-decoration: underline;
    }
    @media (max-width: 768px) {
      h1 { font-size: 2em; }
      .grid { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>Bitcoin Solo Mining Pool</h1>
      <div class="subtitle">Production Mining Pool Status Dashboard</div>
      <div style="margin-top: 15px;">
        <span class="status-badge">● OPERATIONAL</span>
      </div>
    </header>

    <div class="warning-banner">
      <strong>Important Notice</strong>
      <p>This is a SOLO mining pool. Rewards are only distributed when a block is found. Most miners find zero blocks. This is NOT a traditional pool with regular payouts.</p>
    </div>

    <div class="grid">
      <div class="card">
        <h2>Pool Statistics</h2>
        <div class="stat-item">
          <span class="stat-label">Active Connections</span>
          <span class="stat-value highlight">${metrics.connections}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">Total Shares</span>
          <span class="stat-value">${metrics.totalShares.toLocaleString()}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">Valid Shares</span>
          <span class="stat-value">${metrics.validShares.toLocaleString()}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">Blocks Found</span>
          <span class="stat-value highlight">${metrics.blocksFound}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">Server Uptime</span>
          <span class="stat-value">${uptimeDisplay}</span>
        </div>
      </div>

      <div class="card">
        <h2>Connection Details</h2>
        <div class="connection-box">
          <div class="connection-item">
            <div class="connection-label">Stratum URL</div>
            <code>stratum+tcp://mainnet-pool-production.up.railway.app:3333</code>
          </div>
          <div class="connection-item">
            <div class="connection-label">Username Format</div>
            <code>YOUR_WALLET_ADDRESS.worker-name</code>
          </div>
          <div class="connection-item">
            <div class="connection-label">Password</div>
            <code>x</code>
          </div>
        </div>
      </div>

      <div class="card">
        <h2>API Endpoints</h2>
        <div style="display: flex; flex-direction: column; gap: 12px;">
          <a href="/health" class="endpoint-link">Health Check →</a>
          <a href="/metrics" class="endpoint-link">Metrics API →</a>
        </div>
      </div>
    </div>

    <footer>
      <p>Bitcoin Solo Mining Pool | Production Server</p>
      <p style="margin-top: 10px;">
        For detailed miner instructions, see <a href="#">MINER_INSTRUCTIONS.md</a>
      </p>
    </footer>
  </div>
</body>
</html>`);
  } else if (req.url === '/health') {
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
