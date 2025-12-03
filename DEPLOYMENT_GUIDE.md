# Complete Deployment Guide

## Quick Start (Regtest - Testing)

### Step 1: Start Bitcoin Core in Regtest Mode

```powershell
# Start Docker Desktop first (if not running)

# Start bitcoind in regtest
docker compose -f docker-compose-regtest.yml up -d

# Wait a few seconds for it to start, then verify
docker ps
```

### Step 2: Generate Initial Blocks (Regtest Only)

```powershell
# Generate 101 blocks to mature coinbase (regtest only)
docker exec -it bitcoind-regtest bitcoin-cli -regtest -rpcuser=rpcuser -rpcpassword=rpcpass generatetoaddress 101 $(docker exec -it bitcoind-regtest bitcoin-cli -regtest -rpcuser=rpcuser -rpcpassword=rpcpass getnewaddress)
```

### Step 3: Set Environment Variables

**Option A: Use PowerShell Script (Easiest)**
```powershell
.\start-server.ps1
```

**Option B: Set Manually**
```powershell
$env:BITCOIND_RPC_URL = "http://rpcuser:rpcpass@127.0.0.1:18443"
$env:COINBASE_PAYOUT_ADDRESS = "bc1q96n65zzfhtgehuyu0307jtz44lk6usu77rkewm"
node server_stratum_v1_production.js
```

### Step 4: Verify It's Working

Open a new PowerShell window and test:

```powershell
# Check health
curl http://localhost:3000/health

# Check metrics
curl http://localhost:3000/metrics
```

You should see `"status":"healthy"` if bitcoind is connected.

### Step 5: Test with Miner Simulator

```powershell
# In another terminal
node tools/miner_simulator.js 127.0.0.1 3333 sim.worker
```

---

## Mainnet Deployment

### Prerequisites

1. **Bitcoin Core Node** (fully synced)
   - Can be on same server or remote
   - RPC must be accessible
   - Must be fully synced (can take days)

2. **Server/VPS** with:
   - Node.js 14+ installed
   - Public IP address
   - Ports 3333 (Stratum) and 3000 (HTTP) open

3. **Bitcoin Address** for block rewards

### Step 1: Set Up Bitcoin Core

**If running bitcoind yourself:**

Create `bitcoin.conf`:
```
server=1
rpcuser=your_secure_username
rpcpassword=your_secure_password
rpcallowip=127.0.0.1
rpcbind=127.0.0.1
rpcport=8332
```

**Or use a managed RPC provider:**
- Get RPC endpoint URL
- Use their credentials

### Step 2: Deploy Stratum Server

#### Option A: Direct on VPS

1. **Copy files to server:**
   ```bash
   scp -r * user@your-server:/path/to/app
   ```

2. **SSH into server:**
   ```bash
   ssh user@your-server
   cd /path/to/app
   ```

3. **Set environment variables:**
   ```bash
   export BITCOIND_RPC_URL=http://rpcuser:rpcpassword@127.0.0.1:8332
   export COINBASE_PAYOUT_ADDRESS=your_bitcoin_address
   ```

4. **Start server:**
   ```bash
   node server_stratum_v1_production.js
   ```

#### Option B: Using PM2 (Recommended for Production)

1. **Install PM2:**
   ```bash
   npm install -g pm2
   ```

2. **Create ecosystem file** `ecosystem.config.js`:
   ```javascript
   module.exports = {
     apps: [{
       name: 'stratum-pool',
       script: 'server_stratum_v1_production.js',
       env: {
         BITCOIND_RPC_URL: 'http://rpcuser:rpcpassword@127.0.0.1:8332',
         COINBASE_PAYOUT_ADDRESS: 'your_bitcoin_address',
         STRATUM_PORT: 3333,
         PORT: 3000
       },
       instances: 1,
       exec_mode: 'fork',
       watch: false,
       max_memory_restart: '500M',
       error_file: './logs/err.log',
       out_file: './logs/out.log',
       log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
     }]
   };
   ```

3. **Start with PM2:**
   ```bash
   pm2 start ecosystem.config.js
   pm2 save
   pm2 startup  # Enable auto-start on reboot
   ```

#### Option C: Using Docker

1. **Create Dockerfile:**
   ```dockerfile
   FROM node:18-alpine
   WORKDIR /app
   COPY . .
   CMD ["node", "server_stratum_v1_production.js"]
   ```

2. **Create .env file:**
   ```
   BITCOIND_RPC_URL=http://rpcuser:rpcpassword@host.docker.internal:8332
   COINBASE_PAYOUT_ADDRESS=your_bitcoin_address
   STRATUM_PORT=3333
   PORT=3000
   ```

3. **Build and run:**
   ```bash
   docker build -t stratum-pool .
   docker run -d --env-file .env -p 3333:3333 -p 3000:3000 --name stratum-pool stratum-pool
   ```

#### Option D: Railway/Heroku/Cloud Platform

1. **Connect your repository** to the platform
2. **Set environment variables** in platform dashboard:
   - `BITCOIND_RPC_URL`
   - `COINBASE_PAYOUT_ADDRESS`
   - `STRATUM_PORT=3333`
   - `PORT=3000`
3. **Deploy** (usually automatic on git push)

---

## Configuration

### Required Environment Variables

```powershell
# Bitcoin Core RPC
BITCOIND_RPC_URL=http://rpcuser:rpcpassword@127.0.0.1:8332

# Your Bitcoin address for block rewards
COINBASE_PAYOUT_ADDRESS=bc1q96n65zzfhtgehuyu0307jtz44lk6usu77rkewm
```

### Optional Environment Variables

```powershell
# Server ports
STRATUM_PORT=3333      # Port for Stratum protocol
PORT=3000             # Port for HTTP health/metrics

# Limits
MAX_CONNECTIONS=1000
RATE_LIMIT_WINDOW=60000
RATE_LIMIT_MAX_REQUESTS=100
```

---

## Connecting Miners

### For Solo Mining (Your Own Hardware)

1. **Point your ASIC miner** to your server:
   - Pool URL: `stratum+tcp://your-server-ip:3333`
   - Worker: `your-worker-name`
   - Password: `x` (not used, but required)

2. **Example miner configuration:**
   ```
   pool1=stratum+tcp://your-server-ip:3333
   worker1=your-worker-name
   ```

### For Pool Mining (Others Connect)

1. **Share your pool URL:**
   ```
   stratum+tcp://your-server-ip:3333
   ```

2. **Miners connect with:**
   - Username: `worker-name`
   - Password: `x`

3. **You'll need to implement:**
   - Worker authentication (currently just checks authorized flag)
   - Payout system (to pay miners)
   - Share tracking database
   - Pool fee collection

---

## Monitoring

### Health Check
```powershell
curl http://localhost:3000/health
```

Expected response:
```json
{
  "status": "healthy",
  "healthy": true,
  "blocks": 850000,
  "chain": "main",
  "synced": true,
  "uptime": 3600
}
```

### Metrics
```powershell
curl http://localhost:3000/metrics
```

Returns:
- Connection counts
- Shares submitted
- Blocks found
- Blocks submitted
- Error rates

### Logs

**If using PM2:**
```bash
pm2 logs stratum-pool
```

**If running directly:**
Logs are JSON-formatted to stdout/stderr. Redirect to file:
```bash
node server_stratum_v1_production.js > logs/server.log 2>&1
```

---

## Troubleshooting

### Server Won't Start

**Error: "BITCOIND_RPC_URL environment variable is required"**
- Set the environment variable before starting

**Error: "ECONNREFUSED"**
- bitcoind not running
- Wrong port in BITCOIND_RPC_URL
- Firewall blocking connection

**Solution:**
```powershell
# Check if bitcoind is running
docker ps  # For regtest
# Or check bitcoind process

# Test RPC connection
curl http://rpcuser:rpcpass@127.0.0.1:18443
```

### Health Check Shows Unhealthy

**Check:**
1. bitcoind is running and synced
2. RPC credentials are correct
3. Port is correct (18443 for regtest, 8332 for mainnet)
4. Firewall allows connection

**Test RPC manually:**
```powershell
# Regtest
docker exec bitcoind-regtest bitcoin-cli -regtest -rpcuser=rpcuser -rpcpassword=rpcpass getblockchaininfo

# Mainnet (if local)
bitcoin-cli getblockchaininfo
```

### Miners Can't Connect

**Check:**
1. Port 3333 is open in firewall
2. Server is accessible from internet
3. Server is running (check logs)
4. No rate limiting blocking legitimate connections

**Test connection:**
```powershell
# From miner's location
telnet your-server-ip 3333
# Should connect
```

### No Blocks Being Submitted

**Check logs for:**
- "Valid block found!" messages
- Block submission errors
- bitcoind RPC errors

**Verify block submission works:**
```powershell
# Test submitblock manually (with a test block hex)
bitcoin-cli submitblock <blockhex>
```

---

## Security Checklist

- [ ] `BITCOIND_RPC_URL` not in code (use env vars)
- [ ] RPC endpoint protected (firewall/IP whitelist)
- [ ] Strong RPC credentials
- [ ] `.env` file in `.gitignore`
- [ ] Firewall configured (only allow necessary ports)
- [ ] Regular security updates
- [ ] Monitor logs for suspicious activity
- [ ] Rate limiting enabled (default: yes)

---

## Next Steps After Deployment

1. **Monitor health endpoint** regularly
2. **Check logs** for errors
3. **Monitor metrics** for connection counts
4. **Set up alerts** for:
   - Health check failures
   - High error rates
   - Block submissions (if any)
5. **Backup configuration** (env vars, addresses)

---

## Important Notes

⚠️ **For Mainnet:**
- Always test on regtest first
- Verify `COINBASE_PAYOUT_ADDRESS` is correct
- Keep RPC credentials secure
- Monitor bitcoind sync status
- Blocks are extremely rare - don't expect to find any

⚠️ **For Pool Operation:**
- You'll need to add payout system
- Track shares per worker
- Implement pool fee collection
- Handle payouts to miners
- This code is just the Stratum server, not a complete pool

---

## Quick Reference

**Regtest:**
```powershell
docker compose -f docker-compose-regtest.yml up -d
$env:BITCOIND_RPC_URL = "http://rpcuser:rpcpass@127.0.0.1:18443"
$env:COINBASE_PAYOUT_ADDRESS = "bc1q..."
node server_stratum_v1_production.js
```

**Mainnet:**
```powershell
$env:BITCOIND_RPC_URL = "http://rpcuser:rpcpass@127.0.0.1:8332"
$env:COINBASE_PAYOUT_ADDRESS = "your_mainnet_address"
node server_stratum_v1_production.js
```

**Health Check:**
```powershell
curl http://localhost:3000/health
```


