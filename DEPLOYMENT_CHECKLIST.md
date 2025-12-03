# Production Deployment Checklist

## Pre-Deployment

### ✅ Code Review
- [x] Block submission implemented
- [x] Job tracking fixed
- [x] Input validation added
- [x] Rate limiting implemented
- [x] Security fixes applied
- [x] Logging structured
- [x] Health checks added
- [x] Graceful shutdown implemented

### ⚠️ Required Configuration
- [ ] `BITCOIND_RPC_URL` environment variable set
- [ ] `COINBASE_PAYOUT_ADDRESS` environment variable set
- [ ] bitcoind fully synced (for mainnet)
- [ ] RPC credentials secure and not in code
- [ ] Firewall rules configured
- [ ] Ports 3333 (Stratum) and 3000 (HTTP) accessible

### 🔒 Security Checklist
- [ ] No default credentials in code
- [ ] RPC endpoint protected (firewall/IP whitelist)
- [ ] Environment variables not committed to git
- [ ] `.env` file in `.gitignore`
- [ ] Rate limiting enabled
- [ ] Input validation active
- [ ] Connection limits set

### 📊 Monitoring Setup
- [ ] Health check endpoint monitored (`/health`)
- [ ] Metrics endpoint accessible (`/metrics`)
- [ ] Log aggregation configured (optional)
- [ ] Alerts set up for:
  - [ ] bitcoind connection failures
  - [ ] High error rates
  - [ ] Block submissions
  - [ ] Connection count spikes

## Testing

### Regtest Testing
- [ ] Start regtest node
- [ ] Generate 101 blocks to mature coinbase
- [ ] Start Stratum server
- [ ] Connect miner simulator
- [ ] Verify shares are accepted
- [ ] Verify block submission works (if valid block found)
- [ ] Test health endpoint
- [ ] Test metrics endpoint
- [ ] Test graceful shutdown (SIGTERM)

### Mainnet Testing (if applicable)
- [ ] Test with small number of connections first
- [ ] Monitor logs for errors
- [ ] Verify block submission (if block found)
- [ ] Check coinbase payout address is correct
- [ ] Monitor bitcoind RPC connection

## Deployment Steps

1. **Prepare Environment**
   ```bash
   cp env.example .env
   # Edit .env with your values
   ```

2. **Test Locally**
   ```bash
   node server_stratum_v1_production.js
   ```

3. **Deploy to Production**
   - Set environment variables on platform
   - Deploy code
   - Monitor logs

4. **Verify Deployment**
   - Check health endpoint: `curl http://your-server:3000/health`
   - Check metrics: `curl http://your-server:3000/metrics`
   - Monitor logs for startup messages

## Post-Deployment

### Immediate Checks
- [ ] Server starts without errors
- [ ] Health endpoint returns healthy
- [ ] Can connect miners
- [ ] Shares are being accepted
- [ ] Logs are being generated

### Ongoing Monitoring
- [ ] Monitor connection count
- [ ] Monitor share submission rate
- [ ] Monitor error rates
- [ ] Monitor bitcoind connectivity
- [ ] Review logs daily
- [ ] Check for block submissions (if any)

## Rollback Plan

If issues occur:
1. Stop the server
2. Review logs to identify issue
3. Fix issue in development
4. Test on regtest
5. Redeploy

## Emergency Contacts

- bitcoind RPC endpoint: [your endpoint]
- Server host: [your host]
- Monitoring dashboard: [your dashboard URL]

## Notes

- Always test on regtest before mainnet
- Keep backups of configuration
- Document any custom changes
- Review logs regularly for anomalies


