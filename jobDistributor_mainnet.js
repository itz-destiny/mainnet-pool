/* jobDistributor_mainnet.js - getblocktemplate wrapper */
const http = require('http');

// Validate BITCOIND_RPC_URL is set
const BITCOIND_RPC_URL = process.env.BITCOIND_RPC_URL;
if (!BITCOIND_RPC_URL) {
  console.error('ERROR: BITCOIND_RPC_URL environment variable is required');
  process.exit(1);
}
async function rpcCall(method, params=[]) {
  return new Promise((resolve, reject) => {
    try {
      const u = new URL(BITCOIND_RPC_URL);
      const postData = JSON.stringify({ jsonrpc:'1.0', id:'job', method, params });
      const opts = { hostname: u.hostname, port: u.port||8332, path: u.pathname||'/', method:'POST', auth:`${u.username}:${u.password}`, headers:{'Content-Type':'application/json','Content-Length':Buffer.byteLength(postData)}, timeout:10000 };
      const req = http.request(opts, (res) => { let data=''; res.on('data', d=>data+=d); res.on('end', ()=>{ try{ const parsed = JSON.parse(data); if (parsed.error) return reject(parsed.error); resolve(parsed.result); } catch(e){ reject(e); } }); });
      req.on('error', e=>reject(e)); req.write(postData); req.end();
    } catch (e) { reject(e); }
  });
}
class JobDistributorMainnet {
  constructor({ redisClient=null } = {}) { 
    this.redis = redisClient; 
    this.template = null; 
    this.templateTs = 0; 
    this.jobCounter = 0;
    this.jobs = new Map(); // Track jobs by jobId
    this.currentTemplate = null;
  }
  
  async refreshTemplate() { 
    try { 
      const tpl = await rpcCall('getblocktemplate', [{ capabilities: ['coinbase/append','workid'] }]); 
      this.template = tpl; 
      this.currentTemplate = tpl;
      this.templateTs = Date.now(); 
      // Invalidate old jobs when new template arrives
      this.jobs.clear();
      return tpl; 
    } catch(e){ 
      console.error('getblocktemplate error:', e.message || e); 
      return null; 
    } 
  }
  
  async getTemplate() { 
    if (!this.template || (Date.now() - this.templateTs) > 3000) {
      await this.refreshTemplate(); 
    }
    return this.template; 
  }
  
  async assignJob() { 
    const tpl = await this.getTemplate(); 
    if (!tpl) return null; 
    const txs = (tpl.transactions || []).map(t=>t.data); 
    const jobId = 'job' + (this.jobCounter++).toString(16);
    const job = { 
      jobId, 
      prevhash: tpl.previousblockhash, 
      version: tpl.version, 
      nbits: tpl.bits, 
      curtime: tpl.curtime, 
      txs, 
      coinbase_value: tpl.coinbasevalue || 0, 
      coinbase_script_prefix_hex:'', 
      coinbase_script_suffix_hex:'', 
      height: tpl.height || null, 
      target: tpl.target || null,
      templateTs: this.templateTs
    };
    this.jobs.set(jobId, job);
    return job;
  }
  
  getJob(jobId) {
    const job = this.jobs.get(jobId);
    // Check if job is stale (template has been refreshed)
    if (job && job.templateTs !== this.templateTs) {
      this.jobs.delete(jobId);
      return null;
    }
    return job;
  }
  
  async submitBlock(blockHex) {
    try {
      const result = await rpcCall('submitblock', [blockHex]);
      // null = accepted, "duplicate" = already submitted, string = error message
      return result;
    } catch (e) {
      console.error('submitblock RPC error:', e.message || e);
      throw e;
    }
  }
  
  async healthCheck() {
    try {
      const info = await rpcCall('getblockchaininfo', []);
      return { 
        healthy: true, 
        blocks: info.blocks || 0, 
        chain: info.chain || 'unknown',
        synced: !info.initialblockdownload 
      };
    } catch (e) {
      return { healthy: false, error: e.message || String(e) };
    }
  }
  
  getWorkerDifficulty(worker){ return 1; }
}
module.exports = JobDistributorMainnet;
