# Quick Start Guide

## 🚀 Fastest Way to Get Started (Regtest Testing)

### Step 1: Start Bitcoin Core
```powershell
docker compose -f docker-compose-regtest.yml up -d
```

### Step 2: Start the Server
```powershell
.\start-server.ps1
```

That's it! The server is now running.

---

## 📋 What You'll See

When the server starts, you'll see:
```
{"timestamp":"...","level":"info","message":"HTTP server started","port":3000}
{"timestamp":"...","level":"info","message":"Stratum server started","port":3333}
```

### Check Health
Open a new terminal:
```powershell
curl http://localhost:3000/health
```

Should show: `"status":"healthy"`

### Test with Miner Simulator
```powershell
node tools/miner_simulator.js 127.0.0.1 3333 sim.worker
```

---

## 🌐 For Mainnet Deployment

### 1. Set Environment Variables
```powershell
$env:BITCOIND_RPC_URL = "http://rpcuser:rpcpassword@your-bitcoind-ip:8332"
$env:COINBASE_PAYOUT_ADDRESS = "your_bitcoin_address"
```

### 2. Start Server
```powershell
node server_stratum_v1_production.js
```

### 3. Connect Miners
Point your ASIC miners to:
```
stratum+tcp://your-server-ip:3333
```

---

## 🔍 Verify It's Working

### Health Check
```powershell
curl http://localhost:3000/health
```

**Good response:**
```json
{"status":"healthy","healthy":true,"blocks":850000,"chain":"main"}
```

**Bad response (bitcoind not connected):**
```json
{"status":"unhealthy","healthy":false,"error":"connect ECONNREFUSED..."}
```

### Metrics
```powershell
curl http://localhost:3000/metrics
```

Shows connection counts, shares, blocks found, etc.

---

## ⚙️ Configuration

### Required
- `BITCOIND_RPC_URL` - Your bitcoind RPC endpoint
- `COINBASE_PAYOUT_ADDRESS` - Bitcoin address for rewards

### Optional
- `STRATUM_PORT` - Default: 3333
- `PORT` - Default: 3000 (for health/metrics)
- `MAX_CONNECTIONS` - Default: 1000
- `RATE_LIMIT_WINDOW` - Default: 60000ms
- `RATE_LIMIT_MAX_REQUESTS` - Default: 100

---

## 🐛 Troubleshooting

### "ECONNREFUSED" Error
- bitcoind not running
- Wrong port (use 18443 for regtest, 8332 for mainnet)
- Check: `docker ps` (for regtest)

### Server Won't Start
- Check: `BITCOIND_RPC_URL` is set
- Check: Node.js is installed (`node --version`)

### Health Check Unhealthy
- Verify bitcoind is running
- Check RPC credentials
- Test RPC manually:
  ```powershell
  # Regtest
  docker exec bitcoind-regtest bitcoin-cli -regtest -rpcuser=rpcuser -rpcpassword=rpcpass getblockchaininfo
  ```

---

## 📚 More Information

- **Full Deployment Guide**: See `DEPLOYMENT_GUIDE.md`
- **Production Checklist**: See `DEPLOYMENT_CHECKLIST.md`
- **Port Configuration**: See `PORT_CONFIGURATION.md`

---

## ⚠️ Important Notes

1. **Regtest**: Use port `18443` for RPC
2. **Mainnet**: Use port `8332` for RPC
3. **Always test on regtest first**
4. **Verify your payout address is correct**
5. **Keep RPC credentials secure**


