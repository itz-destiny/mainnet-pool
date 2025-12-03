# Instructions for Miners - Copy & Share This

## 🌐 Deployment Information

**Railway Deployment:**
- **Stratum Mining Port (TCP):** Port `3333` - Use `stratum+tcp://` protocol
- **HTTP/HTTPS Interface:** Port `3000` (or Railway's auto-assigned port) - Use `https://` protocol

**⚠️ Important:** 
- Port `3333` is for **Stratum TCP connections** (miners connect here)
- Port `3000` is for **HTTP/HTTPS** (health checks and metrics)
- **DO NOT** use `https://` with port `3333` - Stratum uses `stratum+tcp://` protocol

**Correct URLs:**
- ✅ Mining: `stratum+tcp://mainnet-pool-production.up.railway.app:3333`
- ✅ Health: `https://mainnet-pool-production.up.railway.app/health`
- ❌ Wrong: `https://mainnet-pool-production.up.railway.app:3333` (Stratum is TCP, not HTTPS)

---

## 🎯 How to Connect to Our Mining Pool

### Connection Details

**🚀 Railway Deployment:**
```
Pool URL: stratum+tcp://mainnet-pool-production.up.railway.app:3333
Username: YOUR_WALLET_ADDRESS.worker-name
Password: x
```

**Or for custom server:**
```
Pool URL: stratum+tcp://YOUR-SERVER-IP:3333
Username: YOUR_WALLET_ADDRESS.worker-name
Password: x
```

**Replace:**
- `YOUR_WALLET_ADDRESS` with the Bitcoin address where you want rewards
- `worker-name` with any name to identify your miner (e.g., "worker1", "gpu1")

---

## 📝 Step-by-Step Instructions

### For ASIC Miners (Antminer, Whatsminer, etc.)

1. **Access Miner Web Interface**
   - Open browser, go to: `http://miner-ip-address`
   - Default login: `root` / `root` (check your manual)

2. **Go to Pool Configuration**
   - Find "Mining Pool" or "Pool Settings"
   - Click "Add Pool" or "Edit Pool"

3. **Enter Pool Details:**
   ```
   URL: stratum+tcp://mainnet-pool-production.up.railway.app:3333
   Worker: YOUR_WALLET_ADDRESS.worker1
   Password: x
   ```

4. **Save and Apply**
   - Click "Save" or "Apply"
   - Miner will automatically connect
   - Status should show "Connected" or "Active"

### For GPU Miners (CGMiner, BFGMiner, etc.)

**Command Line:**
```bash
cgminer -o stratum+tcp://mainnet-pool-production.up.railway.app:3333 -u YOUR_WALLET_ADDRESS.worker1 -p x
```

**Or create config file `cgminer.conf`:**
```json
{
  "pools" : [
    {
      "url" : "stratum+tcp://mainnet-pool-production.up.railway.app:3333",
      "user" : "YOUR_WALLET_ADDRESS.worker1",
      "pass" : "x"
    }
  ]
}
```

### For NiceHash Miner

1. Open NiceHash Miner
2. Go to "Settings" → "Mining Pools"
3. Click "Add Custom Pool"
4. Enter:
   - **Pool URL:** `stratum+tcp://mainnet-pool-production.up.railway.app:3333`
   - **Username:** `YOUR_WALLET_ADDRESS.worker1`
   - **Password:** `x`
5. Click "Add" and select this pool

---

## ⚠️ IMPORTANT: Understanding Solo Mining

### What is Solo Mining?

**This is SOLO mining, NOT a traditional pool.**

**Traditional Pool:**
- You get small, regular payouts
- Shared rewards based on your hashrate
- Predictable income (small but steady)

**Solo Mining (This Server):**
- You get **NOTHING** unless you find a block
- If you find a block, you get **EVERYTHING** (~3.125 BTC + fees)
- Very unpredictable - could be months/years between blocks

### Realistic Expectations

**With 1 ASIC Miner:**
- Expected time to find 1 block: **~1-2 YEARS** (if lucky)
- Most miners find **ZERO blocks**
- You may mine for years without finding anything

**With 10 ASIC Miners:**
- Expected time to find 1 block: **~1-2 MONTHS** (if lucky)
- Still very unpredictable

**With 100 ASIC Miners:**
- Expected time to find 1 block: **~3-7 DAYS** (if lucky)
- Still requires significant investment

### ⚠️ WARNING

- **Most solo miners find ZERO blocks**
- **This is NOT a get-rich-quick scheme**
- **You may mine for months/years without any reward**
- **Only mine if you understand the risks**

---

## 📊 How to Check Your Status

### Check Pool Status:

**Railway Deployment:**
- **Main Page:** `https://mainnet-pool-production.up.railway.app/` (shows pool info and stats)
- **Health Check:** `https://mainnet-pool-production.up.railway.app/health`
- **Metrics:** `https://mainnet-pool-production.up.railway.app/metrics`

**Custom Server:**
- **Main Page:** `http://YOUR-SERVER-IP:3000/` (shows pool info and stats)
- **Health Check:** `http://YOUR-SERVER-IP:3000/health`
- **Metrics:** `http://YOUR-SERVER-IP:3000/metrics`

### What You'll See:
- **Active Connections:** Number of miners connected
- **Total Shares:** All shares submitted
- **Valid Shares:** Shares that met difficulty
- **Blocks Found:** Blocks found by pool (if any)

---

## 🔧 Troubleshooting

### Miner Won't Connect

**Check:**
1. Server IP is correct
2. Port 3333 is open
3. Firewall allows connection
4. Server is running

**Test Connection:**
```bash
# Railway deployment:
telnet mainnet-pool-production.up.railway.app 3333

# Custom server:
telnet YOUR-SERVER-IP 3333

# Should connect (press Ctrl+] then type 'quit' to exit)
```

### Connection Drops

**Possible Causes:**
- Network issues
- Server restart
- Firewall blocking

**Solution:**
- Check miner logs
- Verify server is running
- Check firewall rules

### No Shares Accepted

**Check:**
- Miner is actually mining (check hashrate)
- Connection is stable
- Server logs for errors

---

## 📞 Support

**If you need help:**
- Email: [YOUR-EMAIL]
- Discord: [YOUR-DISCORD]
- Telegram: [YOUR-TELEGRAM]

**Status Page:**
- Railway: https://mainnet-pool-production.up.railway.app/health
- Custom Server: http://YOUR-SERVER-IP:3000/health

---

## ✅ Quick Checklist

Before connecting:
- [ ] You understand this is SOLO mining (unpredictable)
- [ ] You have your Bitcoin wallet address ready
- [ ] You have server IP address
- [ ] You understand you may find zero blocks
- [ ] You're okay with potentially mining for months/years

Connection details:
- [ ] Pool URL: `stratum+tcp://mainnet-pool-production.up.railway.app:3333`
- [ ] Username: `YOUR_WALLET_ADDRESS.worker-name`
- [ ] Password: `x`

---

## 📋 Example Configuration

**Example Worker Name:**
```
bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh.worker1
```

**Breakdown:**
- `bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh` = Your Bitcoin address (where rewards go)
- `.` = Separator
- `worker1` = Worker name (can be anything: gpu1, asic1, etc.)

**Full Configuration (Railway):**
```
URL: stratum+tcp://mainnet-pool-production.up.railway.app:3333
Worker: bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh.worker1
Password: x
```

**Full Configuration (Custom Server):**
```
URL: stratum+tcp://192.168.1.100:3333
Worker: bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh.worker1
Password: x
```

---

## 🎯 Summary

**What You Need:**
1. Pool URL: `stratum+tcp://mainnet-pool-production.up.railway.app:3333`
2. Worker name: `YOUR_WALLET_ADDRESS.worker-name`
3. Password: `x`

**What to Expect:**
- Connection should be immediate
- Shares will be submitted regularly
- Blocks are EXTREMELY rare
- Most miners find zero blocks

**Remember:**
- This is solo mining - very unpredictable
- You may mine for months/years without finding a block
- Only mine if you understand the risks
