# Production-Ready Bitcoin Stratum Mining Pool Server

This is a production-ready Bitcoin Stratum mining pool server with:
- ✅ Block submission (submits valid blocks to bitcoind)
- ✅ Job tracking and stale job detection
- ✅ Input validation and rate limiting
- ✅ Structured logging
- ✅ Health checks and metrics
- ✅ Graceful shutdown
- ✅ Support for bc1 (P2WPKH) and base58 legacy addresses (1...,3...)
- ✅ Security improvements (no default credentials, authentication)

## Quick Start

### Prerequisites
- Node.js 14+ installed
- Docker Desktop (for regtest testing)
- bitcoind running (regtest or mainnet)
- RPC credentials configured

### Fastest Way to Start (Regtest)

**Windows PowerShell:**
```powershell
# 1. Start bitcoind
docker compose -f docker-compose-regtest.yml up -d

# 2. Start server (sets env vars automatically)
.\start-server.ps1
```

**Linux/Mac:**
```bash
# 1. Start bitcoind
docker compose -f docker-compose-regtest.yml up -d

# 2. Set environment variables
export BITCOIND_RPC_URL=http://rpcuser:rpcpass@127.0.0.1:18443
export COINBASE_PAYOUT_ADDRESS=bc1q96n65zzfhtgehuyu0307jtz44lk6usu77rkewm

# 3. Start server
node server_stratum_v1_production.js
```

### Verify It's Working

```powershell
# Check health (should show "healthy")
curl http://localhost:3000/health

# Check metrics
curl http://localhost:3000/metrics

# Test with miner simulator
node tools/miner_simulator.js 127.0.0.1 3333 sim.worker
```

### For Mainnet

```powershell
# Set environment variables
$env:BITCOIND_RPC_URL = "http://rpcuser:rpcpassword@your-bitcoind-ip:8332"
$env:COINBASE_PAYOUT_ADDRESS = "your_bitcoin_address"

# Start server
node server_stratum_v1_production.js
```

**See `QUICK_START.md` for more details.**

## Production Deployment

### Environment Variables (Required)
- `BITCOIND_RPC_URL` - bitcoind RPC endpoint (no default, must be set)
- `COINBASE_PAYOUT_ADDRESS` - Bitcoin address for block rewards

### Environment Variables (Optional)
- `STRATUM_PORT` - Stratum server port (default: 3333)
- `PORT` - HTTP server port for health/metrics (default: 3000)
- `MAX_CONNECTIONS` - Maximum concurrent connections (default: 1000)
- `RATE_LIMIT_WINDOW` - Rate limit window in ms (default: 60000)
- `RATE_LIMIT_MAX_REQUESTS` - Max requests per window (default: 100)

### Deploy bitcoind on VPS (mainnet)
1. Use docker-compose-bitcoind.yml (create if needed). Edit rpcuser/rpcpassword
2. Start with: `docker compose up -d`
3. Protect RPC with firewall rules; allow only your app/worker IPs
4. Wait for sync; for mainnet this may take days
5. Consider managed RPC providers if you can't host a full node

### Deploy Stratum Server

#### Option 1: Railway/Heroku/Cloud Platform
1. Set environment variables in platform dashboard:
   - `BITCOIND_RPC_URL=http://rpcuser:rpcpassword@<VPS_IP>:8332/`
   - `COINBASE_PAYOUT_ADDRESS=your_bc1_or_legacy_address`
   - `STRATUM_PORT=3333`
   - `PORT=3000`
2. Deploy code (push to connected repository)

#### Option 2: VPS with PM2
1. Install PM2: `npm install -g pm2`
2. Create ecosystem file or use: `pm2 start server_stratum_v1_production.js --name stratum-pool`
3. Set environment variables in PM2 or `.env` file
4. Enable auto-restart: `pm2 startup && pm2 save`

#### Option 3: Docker
Create `Dockerfile`:
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY . .
CMD ["node", "server_stratum_v1_production.js"]
```

Build and run:
```bash
docker build -t stratum-pool .
docker run -d --env-file .env -p 3333:3333 -p 3000:3000 stratum-pool
```

## Regtest commands (bitcoin-cli inside container)
- Generate 101 blocks to mature coinbase in regtest:
  docker exec -it bitcoind-regtest bitcoin-cli -regtest -rpcuser=rpcuser -rpcpassword=rpcpass generatetoaddress 101 $(docker exec -it bitcoind-regtest bitcoin-cli -regtest -rpcuser=rpcuser -rpcpassword=rpcpass getnewaddress)
- Use getblocktemplate on regtest to see templates:
  docker exec -it bitcoind-regtest bitcoin-cli -regtest -rpcuser=rpcuser -rpcpassword=rpcpass getblocktemplate "{}"
- Use bitcoin-cli to submitrawtransaction if you want to test block submission flow.

## Features

### Production-Ready Features
- ✅ **Block Submission**: Automatically submits valid blocks to bitcoind
- ✅ **Job Tracking**: Properly tracks jobs by ID, detects stale jobs
- ✅ **Input Validation**: Validates all inputs, prevents buffer overflows
- ✅ **Rate Limiting**: Per-IP rate limiting to prevent abuse
- ✅ **Structured Logging**: JSON-formatted logs for easy parsing
- ✅ **Health Checks**: `/health` endpoint for monitoring
- ✅ **Metrics**: `/metrics` endpoint with connection stats, shares, blocks
- ✅ **Graceful Shutdown**: Handles SIGTERM/SIGINT properly
- ✅ **Security**: No default credentials, requires env vars

### Monitoring
- Health endpoint: `GET /health` - Returns bitcoind connection status
- Metrics endpoint: `GET /metrics` - Returns connection stats, shares, blocks found

### Logging
All logs are JSON-formatted with timestamps:
```json
{"timestamp":"2024-01-01T00:00:00.000Z","level":"info","message":"New connection","remoteId":"127.0.0.1:12345"}
```

## Notes and Warnings

⚠️ **CRITICAL**: 
- Always test on regtest before mainnet
- Verify `COINBASE_PAYOUT_ADDRESS` is correct - this is where block rewards go
- Keep RPC credentials secure - never commit them to git
- Do not store private keys in env vars
- Monitor the `/health` endpoint to ensure bitcoind connectivity
- Review logs regularly for errors

⚠️ **Mining Reality**:
- Finding blocks requires massive hardware investment (ASICs)
- Even with perfect code, profitability depends on electricity costs and luck
- Most individual miners lose money
- This code is production-ready but mining Bitcoin solo is rarely profitable

## Troubleshooting

### Server won't start
- Check `BITCOIND_RPC_URL` is set and correct
- Verify bitcoind is running and RPC is accessible
- Check port availability (3333 for Stratum, 3000 for HTTP)

### No blocks being submitted
- Check logs for "Valid block found!" messages
- Verify `submitblock` RPC call is working: `bitcoin-cli submitblock <hex>`
- Ensure bitcoind is fully synced

### Connection issues
- Check firewall rules allow port 3333
- Verify rate limiting isn't blocking legitimate connections
- Check `/metrics` endpoint for connection stats

