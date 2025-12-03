# Deploying to Railway - Complete Guide

## ✅ Yes, You Can Use Railway!

Railway is perfect for deploying your Stratum mining pool server. Here's how:

---

## 🚀 Quick Start on Railway

### Step 1: Prepare Your Code

Make sure you have:
- ✅ `package.json` (already created)
- ✅ `server_stratum_v1_production.js` (main server file)
- ✅ All `lib/` files
- ✅ `.gitignore` (to exclude sensitive files)

### Step 2: Create Railway Account

1. Go to [railway.app](https://railway.app)
2. Sign up with GitHub (recommended)
3. Create a new project

### Step 3: Connect Repository

**Option A: Deploy from GitHub**
1. Click "New Project"
2. Select "Deploy from GitHub repo"
3. Choose your repository
4. Railway will auto-detect Node.js

**Option B: Deploy from Local**
1. Install Railway CLI:
   ```bash
   npm install -g @railway/cli
   ```
2. Login:
   ```bash
   railway login
   ```
3. Initialize:
   ```bash
   railway init
   ```
4. Deploy:
   ```bash
   railway up
   ```

---

## ⚙️ Step 4: Configure Environment Variables

In Railway dashboard, go to **Variables** tab and add:

### Required Variables:

```
BITCOIND_RPC_URL=http://rpcuser:rpcpassword@your-bitcoind-ip:8332
COINBASE_PAYOUT_ADDRESS=bc1q96n65zzfhtgehuyu0307jtz44lk6usu77rkewm
```

### Optional Variables:

```
STRATUM_PORT=3333
PORT=3000
MAX_CONNECTIONS=1000
RATE_LIMIT_WINDOW=60000
RATE_LIMIT_MAX_REQUESTS=100
```

**⚠️ Important:** 
- Never commit `.env` files to git
- Railway automatically injects these as environment variables
- They're secure and encrypted

---

## 🔌 Step 5: Configure Ports

Railway automatically assigns ports, but you need to:

1. **Go to Settings → Networking**
2. **Add Public Port:**
   - Port: `3333` (for Stratum)
   - Protocol: TCP
   - Make it public

3. **Add HTTP Port (optional):**
   - Port: `3000` (for health/metrics)
   - Protocol: HTTP
   - Make it public

**Or use Railway's auto-assigned port:**

Railway gives you a public URL. You can:
- Use the auto-assigned port for Stratum
- Or configure custom domain with port forwarding

---

## 📝 Step 6: Create railway.json (Optional)

Create `railway.json` in your project root:

```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "startCommand": "node server_stratum_v1_production.js",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

---

## 🔧 Step 7: Update Code for Railway Ports

Railway assigns ports dynamically. Update your server to use Railway's port:

**Current code uses:**
```javascript
const STRATUM_PORT = process.env.STRATUM_PORT || 3333;
const HTTP_PORT = process.env.PORT || 3000;
```

**This works!** Railway sets `PORT` automatically. For Stratum, you can:

**Option A: Use Railway's PORT for HTTP, custom for Stratum**
```javascript
const STRATUM_PORT = process.env.STRATUM_PORT || process.env.PORT || 3333;
const HTTP_PORT = process.env.PORT || 3000;
```

**Option B: Use separate ports (recommended)**
- Set `PORT=3000` in Railway (for HTTP)
- Set `STRATUM_PORT=3333` in Railway (for Stratum)
- Railway will expose both

---

## 🌐 Step 8: Get Your Public URL

After deployment:

1. **Go to Settings → Networking**
2. **Copy your public domain:**
   - Example: `your-app.up.railway.app`
   - Or use custom domain if configured

3. **Your Stratum URL will be:**
   ```
   stratum+tcp://your-app.up.railway.app:3333
   ```
   
   **OR if Railway assigns port automatically:**
   ```
   stratum+tcp://your-app.up.railway.app:PORT_NUMBER
   ```

---

## 📊 Step 9: Verify Deployment

### Check Health:
```
https://your-app.up.railway.app/health
```

### Check Metrics:
```
https://your-app.up.railway.app/metrics
```

### Test Connection:
```bash
telnet your-app.up.railway.app 3333
```

---

## ⚠️ Important Considerations for Railway

### 1. **Port Configuration**

Railway has some limitations:
- **Free tier:** May have port restrictions
- **Pro tier:** Full port control
- **Solution:** Use Railway's assigned port or upgrade

### 2. **TCP vs HTTP**

Railway handles HTTP well, but TCP (Stratum) needs:
- **Public TCP port** configured
- Or use Railway's port forwarding

### 3. **Bitcoind Connection**

Your `BITCOIND_RPC_URL` must be:
- **Publicly accessible** (if bitcoind is remote)
- **Or use Railway's private networking** (if bitcoind is also on Railway)

**If bitcoind is on Railway too:**
```
BITCOIND_RPC_URL=http://rpcuser:rpcpass@bitcoind-service.railway.internal:8332
```

### 4. **Persistent Storage**

- Railway doesn't persist files by default
- Your code doesn't need storage (stateless)
- ✅ This is fine for your use case

### 5. **Scaling**

Railway can auto-scale, but:
- Stratum connections are stateful (socket connections)
- Each instance handles its own connections
- Consider: One instance for now, scale later if needed

---

## 💰 Railway Pricing

### Free Tier:
- ✅ $5 free credit/month
- ✅ Good for testing
- ⚠️ May have port limitations

### Pro Tier ($20/month):
- ✅ Full port control
- ✅ Better for production
- ✅ Custom domains
- ✅ More resources

**For production mining pool, Pro tier recommended.**

---

## 🔒 Security Best Practices

### 1. **Environment Variables**
- ✅ Never commit secrets to git
- ✅ Use Railway's Variables tab
- ✅ Mark sensitive vars as "Secret" in Railway

### 2. **RPC Credentials**
- ✅ Use strong passwords
- ✅ Rotate regularly
- ✅ Limit RPC access (IP whitelist if possible)

### 3. **Firewall**
- Railway handles firewall automatically
- Only exposed ports are accessible
- ✅ Secure by default

---

## 🐛 Troubleshooting

### Issue: Port Not Accessible

**Problem:** Miners can't connect to port 3333

**Solutions:**
1. Check Railway Networking settings
2. Verify port is public
3. Check firewall rules
4. Use Railway's assigned port instead

### Issue: Bitcoind Connection Fails

**Problem:** Health check shows "unhealthy"

**Solutions:**
1. Verify `BITCOIND_RPC_URL` is correct
2. Check bitcoind is accessible from Railway
3. Test RPC connection manually
4. Check firewall allows Railway IPs

### Issue: Server Crashes

**Problem:** Railway shows deployment failed

**Solutions:**
1. Check Railway logs
2. Verify environment variables are set
3. Check `BITCOIND_RPC_URL` is valid
4. Verify Node.js version compatibility

---

## 📋 Railway Deployment Checklist

- [ ] Railway account created
- [ ] Repository connected (GitHub or CLI)
- [ ] Environment variables set:
  - [ ] `BITCOIND_RPC_URL`
  - [ ] `COINBASE_PAYOUT_ADDRESS`
  - [ ] `STRATUM_PORT` (optional)
  - [ ] `PORT` (optional)
- [ ] Ports configured in Networking
- [ ] Deployment successful
- [ ] Health check passes: `/health`
- [ ] Can connect via Stratum port
- [ ] Miners can connect

---

## 🎯 Quick Railway Commands

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Link to project
railway link

# Deploy
railway up

# View logs
railway logs

# Open dashboard
railway open

# Set environment variable
railway variables set BITCOIND_RPC_URL=http://...

# View variables
railway variables
```

---

## 📝 Example railway.toml (Alternative)

Create `railway.toml`:

```toml
[build]
builder = "nixpacks"

[deploy]
startCommand = "node server_stratum_v1_production.js"
healthcheckPath = "/health"
healthcheckTimeout = 100
restartPolicyType = "on_failure"
restartPolicyMaxRetries = 10

[[services]]
name = "stratum-pool"

[services.variables]
STRATUM_PORT = "3333"
PORT = "3000"
```

---

## ✅ Summary

**Railway is perfect for this because:**
- ✅ Easy deployment
- ✅ Automatic HTTPS (for health/metrics)
- ✅ Environment variable management
- ✅ Auto-scaling (if needed)
- ✅ Good free tier for testing
- ✅ Simple CLI

**What you need:**
1. Railway account
2. Connect repository
3. Set environment variables
4. Configure ports
5. Deploy!

**Your miners will connect to:**
```
stratum+tcp://your-app.up.railway.app:3333
```

---

## 🚨 Important Notes

1. **TCP Ports:** Railway free tier may limit TCP ports. Check Railway docs for current limits.

2. **Bitcoind Location:** If bitcoind is on Railway too, use internal networking. If external, ensure it's publicly accessible.

3. **Costs:** Monitor usage. Mining pools can have many connections, which may increase costs.

4. **Uptime:** Railway free tier may sleep inactive services. Pro tier keeps them running.

5. **Custom Domain:** Pro tier allows custom domains, which looks more professional for miners.

---

## 🎉 You're Ready!

Railway is one of the easiest ways to deploy your mining pool. Follow the steps above and you'll be live in minutes!

**Next Steps:**
1. Deploy to Railway
2. Test connection
3. Share pool URL with miners
4. Monitor via `/health` and `/metrics`

