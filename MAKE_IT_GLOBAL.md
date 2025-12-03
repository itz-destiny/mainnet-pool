# Making Your Mining Pool Global - Complete Guide

## 🌐 Step 1: Deploy to Public Server

### Option A: VPS (Recommended)

**1. Get a VPS Server:**
- DigitalOcean, AWS, Linode, Vultr, etc.
- Minimum: 2GB RAM, 1 CPU core
- Ubuntu/Debian Linux
- Public IP address

**2. Deploy Your Server:**
```bash
# SSH into your VPS
ssh user@your-server-ip

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Copy your code to server
scp -r * user@your-server-ip:/home/user/mining-pool/

# SSH in and start
ssh user@your-server-ip
cd /home/user/mining-pool

# Set environment variables
export BITCOIND_RPC_URL=http://rpcuser:rpcpassword@your-bitcoind-ip:8332
export COINBASE_PAYOUT_ADDRESS=your_bitcoin_address

# Start with PM2 (recommended)
npm install -g pm2
pm2 start server_stratum_v1_production.js --name mining-pool
pm2 save
pm2 startup
```

**3. Open Firewall Ports:**
```bash
# Allow Stratum port (3333)
sudo ufw allow 3333/tcp

# Allow HTTP port (3000) - optional, for monitoring
sudo ufw allow 3000/tcp

# Enable firewall
sudo ufw enable
```

### Option B: Home Network (Not Recommended)

**1. Port Forwarding:**
- Log into your router
- Forward port 3333 to your server's local IP
- Get your public IP: `curl ifconfig.me`

**2. Dynamic DNS (if IP changes):**
- Use No-IP, DuckDNS, or similar
- Get a domain like: `yourpool.ddns.net`

**⚠️ Warning:** Home internet usually has:
- Dynamic IP (changes)
- Slow upload speeds
- Not suitable for production

---

## 🔒 Step 2: Security Setup

### 1. Secure Your Server

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install fail2ban (prevents brute force)
sudo apt install fail2ban -y

# Configure firewall
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 3333/tcp
sudo ufw enable
```

### 2. Protect bitcoind RPC

**If bitcoind is on same server:**
- Only allow localhost: `rpcbind=127.0.0.1`
- Use strong RPC password

**If bitcoind is remote:**
- Use VPN or private network
- Or whitelist only your pool server IP

### 3. Use HTTPS/SSL (Optional but Recommended)

For monitoring endpoints, consider:
- Nginx reverse proxy with SSL
- Let's Encrypt certificates

---

## 📢 Step 3: Information to Share with Miners

### Pool Connection Details

**Share this with miners:**

```
Pool Name: [Your Pool Name]
Stratum URL: stratum+tcp://your-server-ip:3333
Backup URL: stratum+tcp://backup-server-ip:3333 (if you have one)

Pool Fee: [X]% (if running a pool)
Payout Method: [PPLNS/PPS/SOLO] (if running a pool)
Minimum Payout: [X] BTC (if running a pool)
Payout Address: [Your address for pool fees]

Support: [Your contact/email]
Website: [Your website if you have one]
```

### Example Message to Miners

```
Welcome to [Your Pool Name]!

CONNECTION DETAILS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Pool URL: stratum+tcp://your-server-ip:3333
Username: YOUR_WORKER_NAME
Password: x (or leave blank)

WORKER NAME FORMAT:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Format: your-wallet-address.worker-name
Example: bc1q...abc123.worker1

IMPORTANT NOTES:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• This is a SOLO mining pool - you keep 100% of block rewards
• Pool fee: 0% (or your fee)
• Blocks are extremely rare - you may mine for months without finding one
• Minimum payout: [if applicable]
• Payouts: [when/how]

SUPPORT:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Email: your-email@example.com
Discord: [your discord]
Telegram: [your telegram]

STATUS PAGE:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
http://your-server-ip:3000/health
http://your-server-ip:3000/metrics
```

---

## ⚙️ Step 4: Miner Configuration Instructions

### For ASIC Miners (Antminer, Whatsminer, etc.)

**1. Access Miner Web Interface:**
- Usually: `http://miner-ip` (check manual)
- Default login: `root` / `root`

**2. Go to Miner Configuration:**
- Find "Pool Configuration" or "Mining Pool"
- Add new pool

**3. Enter Pool Details:**
```
URL: stratum+tcp://your-server-ip:3333
Worker: your-wallet-address.worker1
Password: x
```

**4. Save and Apply:**
- Miner will connect automatically
- Check status shows "Connected"

### For GPU Miners (CGMiner, BFGMiner, etc.)

**Command Line:**
```bash
cgminer -o stratum+tcp://your-server-ip:3333 -u your-wallet-address.worker1 -p x
```

**Or in config file:**
```
"pools" : [
  {
    "url" : "stratum+tcp://your-server-ip:3333",
    "user" : "your-wallet-address.worker1",
    "pass" : "x"
  }
]
```

### For NiceHash/Other Mining Software

**1. Add Custom Pool:**
- Go to pool settings
- Add new pool

**2. Enter:**
- Pool URL: `stratum+tcp://your-server-ip:3333`
- Username: `your-wallet-address.worker1`
- Password: `x`

---

## 📋 Step 5: What Miners Need to Know

### Important Disclaimers

**1. Solo Mining Reality:**
```
⚠️ IMPORTANT: This is SOLO mining, not a traditional pool.

• You keep 100% of block rewards IF you find a block
• Blocks are EXTREMELY rare (1 every 10 minutes globally)
• You may mine for months/years without finding a block
• This is NOT a get-rich-quick scheme
• Most solo miners find ZERO blocks
```

**2. How It Works:**
```
HOW SOLO MINING WORKS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. Your miner connects to our server
2. Server sends you mining jobs (block templates)
3. Your miner tries to solve them
4. If you find a VALID block, you get 100% of reward (~3.125 BTC)
5. If you don't find a block, you get nothing

EXPECTED RESULTS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• With 1 ASIC miner: ~0-1 blocks per YEAR (if lucky)
• With 10 ASIC miners: ~0-1 blocks per MONTH (if lucky)
• Most miners find ZERO blocks
```

**3. Pool vs Solo:**
```
TRADITIONAL POOL:
• You get small payouts regularly
• Shared rewards based on your hashrate
• Predictable income (small but steady)

SOLO MINING (This Server):
• You get NOTHING unless you find a block
• If you find a block, you get EVERYTHING (~3.125 BTC)
• Very unpredictable (could be months/years)
```

---

## 🎯 Step 6: If Running a Traditional Pool

**⚠️ Current Code Limitation:**

This code is **SOLO mining** - miners keep 100% of rewards. To run a traditional pool, you'd need to add:

### Required Additions:

**1. Share Tracking Database:**
- Track shares per worker
- Calculate payouts based on hashrate
- Store worker statistics

**2. Payout System:**
- Calculate each worker's share of rewards
- Send Bitcoin payouts to workers
- Handle minimum payout thresholds

**3. Pool Fee Collection:**
- Take 1-3% of rewards as pool fee
- Distribute rest to miners

**4. Worker Authentication:**
- Currently just checks "authorized" flag
- Need proper worker name validation
- Link worker names to payout addresses

**5. Web Dashboard (Optional but Recommended):**
- Show worker statistics
- Show pool hashrate
- Show recent shares/blocks
- Show payouts

### Example Pool Configuration:

```
POOL SETTINGS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Pool Fee: 2%
Payout Method: PPLNS (Pay Per Last N Shares)
Minimum Payout: 0.001 BTC
Payout Frequency: Daily at 00:00 UTC

WORKER FORMAT:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Format: payout-address.worker-name
Example: bc1q...abc123.worker1

• payout-address: Where you want to receive payouts
• worker-name: Name to identify this miner (can be anything)

PAYOUTS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• Calculated based on your hashrate contribution
• Paid daily if above minimum threshold
• Sent to the address in your worker name
```

---

## 📊 Step 7: Monitoring & Status Page

### Create Simple Status Page (Optional)

You can create a basic HTML page that shows pool stats:

**Create `public/index.html`:**
```html
<!DOCTYPE html>
<html>
<head>
    <title>Mining Pool Status</title>
    <style>
        body { font-family: Arial; margin: 20px; }
        .stat { margin: 10px 0; padding: 10px; background: #f0f0f0; }
    </style>
</head>
<body>
    <h1>Mining Pool Status</h1>
    <div id="stats">Loading...</div>
    
    <script>
        fetch('/metrics')
            .then(r => r.json())
            .then(data => {
                document.getElementById('stats').innerHTML = `
                    <div class="stat">Active Connections: ${data.connections}</div>
                    <div class="stat">Total Shares: ${data.totalShares}</div>
                    <div class="stat">Valid Shares: ${data.validShares}</div>
                    <div class="stat">Blocks Found: ${data.blocksFound}</div>
                    <div class="stat">Uptime: ${Math.floor(data.uptime/3600)} hours</div>
                `;
            });
    </script>
</body>
</html>
```

**Add to server:**
```javascript
// In server_stratum_v1_production.js, add:
else if (req.url === '/') {
  // Serve status page
  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end(/* HTML content */);
}
```

---

## ✅ Step 8: Checklist Before Going Live

- [ ] Server deployed with public IP
- [ ] Port 3333 open in firewall
- [ ] bitcoind connected and synced
- [ ] Environment variables set correctly
- [ ] Server running with PM2 or similar
- [ ] Tested connection from external network
- [ ] Status page accessible (if created)
- [ ] Documentation ready for miners
- [ ] Support contact method set up
- [ ] Monitoring/alerts configured

---

## 🚨 Important Warnings

### For Solo Mining:
- ⚠️ Miners may mine for months without finding blocks
- ⚠️ Set clear expectations
- ⚠️ Most miners will find zero blocks
- ⚠️ This is NOT profitable for most people

### For Pool Operation:
- ⚠️ You need to add payout system
- ⚠️ You need to track shares per worker
- ⚠️ You need to handle payouts fairly
- ⚠️ Legal/compliance considerations
- ⚠️ You're responsible for miners' funds

---

## 📝 Quick Reference

**Your Pool URL:**
```
stratum+tcp://your-server-ip:3333
```

**Status Page:**
```
http://your-server-ip:3000/health
http://your-server-ip:3000/metrics
```

**Miner Configuration:**
```
URL: stratum+tcp://your-server-ip:3333
Worker: wallet-address.worker-name
Password: x
```

