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
const ACCESS_CODE = process.env.ACCESS_CODE || '847392'; // 6-digit access code for connection details

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
      background: linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%);
      color: #e0e0e0;
      min-height: 100vh;
      padding: 20px;
      line-height: 1.6;
      position: relative;
      overflow-x: hidden;
    }
    body::before {
      content: '';
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: radial-gradient(circle at 20% 50%, rgba(247, 147, 26, 0.1) 0%, transparent 50%),
                  radial-gradient(circle at 80% 80%, rgba(247, 147, 26, 0.1) 0%, transparent 50%);
      pointer-events: none;
      z-index: 0;
    }
    .container {
      max-width: 1200px;
      margin: 0 auto;
      position: relative;
      z-index: 1;
    }
    header {
      background: rgba(255, 255, 255, 0.03);
      backdrop-filter: blur(20px);
      border-radius: 16px;
      padding: 40px;
      margin-bottom: 30px;
      border: 1px solid rgba(255, 255, 255, 0.08);
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
    }
    h1 {
      font-size: 2.8em;
      font-weight: 800;
      background: linear-gradient(135deg, #f7931a 0%, #ffab3d 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      margin-bottom: 10px;
      letter-spacing: -1px;
    }
    .subtitle {
      color: #b0b0b0;
      font-size: 1.15em;
      font-weight: 300;
      letter-spacing: 0.3px;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
      gap: 24px;
      margin-bottom: 30px;
    }
    .card {
      background: rgba(255, 255, 255, 0.04);
      backdrop-filter: blur(20px);
      border-radius: 16px;
      padding: 30px;
      border: 1px solid rgba(255, 255, 255, 0.08);
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
    }
    .card:hover {
      transform: translateY(-4px);
      box-shadow: 0 12px 32px rgba(0, 0, 0, 0.4);
      border-color: rgba(247, 147, 26, 0.3);
    }
    .card h2 {
      font-size: 1.4em;
      color: #f7931a;
      margin-bottom: 24px;
      font-weight: 700;
      display: flex;
      align-items: center;
      gap: 12px;
      letter-spacing: -0.3px;
    }
    .stat-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 0;
      border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    }
    .stat-item:last-child {
      border-bottom: none;
    }
    .stat-label {
      color: #b0b0b0;
      font-weight: 500;
      font-size: 0.95em;
    }
    .stat-value {
      color: #fff;
      font-weight: 700;
      font-size: 1.2em;
      letter-spacing: -0.3px;
    }
    .stat-value.highlight {
      color: #f7931a;
      text-shadow: 0 0 10px rgba(247, 147, 26, 0.3);
    }
    .connection-box {
      background: rgba(0, 0, 0, 0.4);
      border-radius: 12px;
      padding: 24px;
      margin-top: 20px;
      border: 1px solid rgba(255, 255, 255, 0.1);
    }
    .connection-item {
      margin-bottom: 20px;
    }
    .connection-item:last-child {
      margin-bottom: 0;
    }
    .connection-label {
      color: #b0b0b0;
      font-size: 0.9em;
      margin-bottom: 8px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    code {
      background: rgba(0, 0, 0, 0.5);
      padding: 12px 16px;
      border-radius: 8px;
      font-family: 'SF Mono', 'Monaco', 'Courier New', monospace;
      color: #f7931a;
      display: block;
      word-break: break-all;
      border: 1px solid rgba(247, 147, 26, 0.3);
      font-size: 0.9em;
      line-height: 1.6;
    }
    .endpoint-link {
      display: inline-flex;
      align-items: center;
      color: #f7931a;
      text-decoration: none;
      padding: 12px 20px;
      background: rgba(247, 147, 26, 0.1);
      border-radius: 8px;
      border: 1px solid rgba(247, 147, 26, 0.3);
      transition: all 0.3s;
      font-weight: 600;
      width: 100%;
      justify-content: space-between;
    }
    .endpoint-link:hover {
      background: rgba(247, 147, 26, 0.2);
      transform: translateX(4px);
      border-color: rgba(247, 147, 26, 0.5);
    }
    .status-badge {
      display: inline-block;
      padding: 8px 16px;
      border-radius: 24px;
      font-size: 0.9em;
      font-weight: 700;
      background: rgba(40, 167, 69, 0.2);
      color: #4ade80;
      border: 1px solid rgba(40, 167, 69, 0.4);
      box-shadow: 0 0 20px rgba(40, 167, 69, 0.2);
    }
    .unlock-btn {
      width: 100%;
      padding: 16px;
      background: linear-gradient(135deg, rgba(247, 147, 26, 0.2) 0%, rgba(247, 147, 26, 0.1) 100%);
      border: 2px solid rgba(247, 147, 26, 0.4);
      border-radius: 12px;
      color: #f7931a;
      font-size: 1em;
      font-weight: 700;
      cursor: pointer;
      transition: all 0.3s;
      margin-top: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
    }
    .unlock-btn:hover {
      background: linear-gradient(135deg, rgba(247, 147, 26, 0.3) 0%, rgba(247, 147, 26, 0.2) 100%);
      border-color: rgba(247, 147, 26, 0.6);
      transform: translateY(-2px);
      box-shadow: 0 8px 24px rgba(247, 147, 26, 0.3);
    }
    .locked-placeholder {
      text-align: center;
      padding: 40px 20px;
      color: #888;
      font-size: 0.95em;
    }
    .locked-icon {
      font-size: 3em;
      margin-bottom: 16px;
      opacity: 0.5;
    }
    .modal-overlay {
      display: none;
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.85);
      backdrop-filter: blur(10px);
      z-index: 1000;
      align-items: center;
      justify-content: center;
      animation: fadeIn 0.3s;
    }
    .modal-overlay.active {
      display: flex;
    }
    .modal {
      background: linear-gradient(135deg, rgba(30, 30, 50, 0.95) 0%, rgba(20, 20, 40, 0.95) 100%);
      border-radius: 20px;
      padding: 40px;
      max-width: 480px;
      width: 90%;
      border: 1px solid rgba(255, 255, 255, 0.1);
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
      animation: slideUp 0.3s;
    }
    .modal-header {
      text-align: center;
      margin-bottom: 30px;
    }
    .modal-title {
      font-size: 1.8em;
      font-weight: 700;
      color: #f7931a;
      margin-bottom: 8px;
    }
    .modal-subtitle {
      color: #b0b0b0;
      font-size: 0.95em;
    }
    .otp-container {
      display: flex;
      gap: 12px;
      justify-content: center;
      margin-bottom: 30px;
    }
    .otp-input {
      width: 60px;
      height: 70px;
      text-align: center;
      font-size: 2em;
      font-weight: 700;
      background: rgba(0, 0, 0, 0.4);
      border: 2px solid rgba(255, 255, 255, 0.2);
      border-radius: 12px;
      color: #fff;
      transition: all 0.3s;
      font-family: 'SF Mono', monospace;
    }
    .otp-input:focus {
      outline: none;
      border-color: #f7931a;
      background: rgba(247, 147, 26, 0.1);
      box-shadow: 0 0 20px rgba(247, 147, 26, 0.3);
    }
    .otp-input.filled {
      border-color: rgba(247, 147, 26, 0.5);
    }
    .error-message {
      color: #ff4444;
      text-align: center;
      margin-bottom: 20px;
      font-size: 0.9em;
      min-height: 20px;
      animation: shake 0.5s;
    }
    .modal-btn {
      width: 100%;
      padding: 16px;
      background: linear-gradient(135deg, #f7931a 0%, #ffab3d 100%);
      border: none;
      border-radius: 12px;
      color: #fff;
      font-size: 1.1em;
      font-weight: 700;
      cursor: pointer;
      transition: all 0.3s;
      box-shadow: 0 4px 16px rgba(247, 147, 26, 0.4);
    }
    .modal-btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 24px rgba(247, 147, 26, 0.5);
    }
    .modal-btn:active {
      transform: translateY(0);
    }
    .close-btn {
      position: absolute;
      top: 20px;
      right: 20px;
      background: rgba(255, 255, 255, 0.1);
      border: none;
      color: #fff;
      width: 36px;
      height: 36px;
      border-radius: 50%;
      cursor: pointer;
      font-size: 1.2em;
      transition: all 0.3s;
    }
    .close-btn:hover {
      background: rgba(255, 255, 255, 0.2);
      transform: rotate(90deg);
    }
    footer {
      text-align: center;
      padding: 40px;
      color: #888;
      font-size: 0.9em;
    }
    footer a {
      color: #f7931a;
      text-decoration: none;
      transition: all 0.3s;
    }
    footer a:hover {
      text-decoration: underline;
      color: #ffab3d;
    }
    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    @keyframes slideUp {
      from { transform: translateY(30px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }
    @keyframes shake {
      0%, 100% { transform: translateX(0); }
      25% { transform: translateX(-10px); }
      75% { transform: translateX(10px); }
    }
    @media (max-width: 768px) {
      h1 { font-size: 2.2em; }
      .grid { grid-template-columns: 1fr; }
      .modal { padding: 30px 20px; }
      .otp-input { width: 50px; height: 60px; font-size: 1.6em; }
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>Bitcoin Solo Mining Pool</h1>
      <div class="subtitle">Production Mining Pool Status Dashboard</div>
      <div style="margin-top: 20px;">
        <span class="status-badge">● OPERATIONAL</span>
      </div>
    </header>

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
        <div id="connectionContent" style="display: none;">
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
        <div id="connectionLocked">
          <div class="locked-placeholder">
            <div class="locked-icon">🔒</div>
            <p>Connection details are protected</p>
            <button class="unlock-btn" onclick="openModal()">
              <span>🔓</span>
              <span>Unlock Connection Details</span>
            </button>
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

  <div class="modal-overlay" id="modalOverlay" onclick="closeModalOnOverlay(event)">
    <div class="modal" onclick="event.stopPropagation()">
      <button class="close-btn" onclick="closeModal()">×</button>
      <div class="modal-header">
        <div class="modal-title">Access Required</div>
        <div class="modal-subtitle">Enter 6-digit access code</div>
      </div>
      <div class="error-message" id="errorMessage"></div>
      <div class="otp-container">
        <input type="text" class="otp-input" maxlength="1" inputmode="numeric" pattern="[0-9]" id="otp1" autocomplete="off">
        <input type="text" class="otp-input" maxlength="1" inputmode="numeric" pattern="[0-9]" id="otp2" autocomplete="off">
        <input type="text" class="otp-input" maxlength="1" inputmode="numeric" pattern="[0-9]" id="otp3" autocomplete="off">
        <input type="text" class="otp-input" maxlength="1" inputmode="numeric" pattern="[0-9]" id="otp4" autocomplete="off">
        <input type="text" class="otp-input" maxlength="1" inputmode="numeric" pattern="[0-9]" id="otp5" autocomplete="off">
        <input type="text" class="otp-input" maxlength="1" inputmode="numeric" pattern="[0-9]" id="otp6" autocomplete="off">
      </div>
      <button class="modal-btn" onclick="verifyCode()">Verify Access Code</button>
    </div>
  </div>

  <script>
    const ACCESS_CODE = '${ACCESS_CODE}';
    
    // Check if already unlocked
    if (sessionStorage.getItem('connectionUnlocked') === 'true') {
      document.getElementById('connectionContent').style.display = 'block';
      document.getElementById('connectionLocked').style.display = 'none';
    }
    
    function openModal() {
      document.getElementById('modalOverlay').classList.add('active');
      document.getElementById('otp1').focus();
      clearInputs();
      document.getElementById('errorMessage').textContent = '';
    }
    
    function closeModal() {
      document.getElementById('modalOverlay').classList.remove('active');
      clearInputs();
      document.getElementById('errorMessage').textContent = '';
    }
    
    function closeModalOnOverlay(event) {
      if (event.target.id === 'modalOverlay') {
        closeModal();
      }
    }
    
    function clearInputs() {
      for (let i = 1; i <= 6; i++) {
        document.getElementById('otp' + i).value = '';
        document.getElementById('otp' + i).classList.remove('filled');
      }
    }
    
    // Auto-focus next input
    for (let i = 1; i <= 6; i++) {
      const input = document.getElementById('otp' + i);
      input.addEventListener('input', function(e) {
        if (this.value.match(/[0-9]/)) {
          this.classList.add('filled');
          if (i < 6) {
            document.getElementById('otp' + (i + 1)).focus();
          }
        } else {
          this.value = '';
          this.classList.remove('filled');
        }
      });
      
      input.addEventListener('keydown', function(e) {
        if (e.key === 'Backspace' && this.value === '' && i > 1) {
          document.getElementById('otp' + (i - 1)).focus();
        }
      });
    }
    
    function verifyCode() {
      let code = '';
      for (let i = 1; i <= 6; i++) {
        code += document.getElementById('otp' + i).value;
      }
      
      if (code.length !== 6) {
        document.getElementById('errorMessage').textContent = 'Please enter all 6 digits';
        return;
      }
      
      if (code === ACCESS_CODE) {
        sessionStorage.setItem('connectionUnlocked', 'true');
        document.getElementById('connectionContent').style.display = 'block';
        document.getElementById('connectionLocked').style.display = 'none';
        closeModal();
      } else {
        document.getElementById('errorMessage').textContent = 'Invalid access code. Please try again.';
        clearInputs();
        document.getElementById('otp1').focus();
        // Shake animation
        document.querySelector('.modal').style.animation = 'shake 0.5s';
        setTimeout(() => {
          document.querySelector('.modal').style.animation = '';
        }, 500);
      }
    }
    
    // Allow Enter key to submit
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' && document.getElementById('modalOverlay').classList.contains('active')) {
        verifyCode();
      }
      if (e.key === 'Escape') {
        closeModal();
      }
    });
  </script>
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
