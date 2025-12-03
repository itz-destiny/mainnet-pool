/* tools/miner_simulator.js
 * Simple miner simulator for testing with the simplified Stratum server.
 * Connects, subscribes, authorizes, listens for mining.notify and then submits a dummy share.
 *
 * This is for functional/regtest testing only — it does not actually compute PoW.
 */
const net = require('net');
const argv = process.argv.slice(2);
const host = argv[0] || '127.0.0.1';
const port = parseInt(argv[1] || '3333');
const worker = argv[2] || 'sim.worker';
const client = new net.Socket();
client.setEncoding('utf8');
client.connect(port, host, () => {
  console.log('connected to', host+':'+port);
  client.write(JSON.stringify({ id:1, method:'mining.subscribe', params: [worker] }) + '\n');
  client.write(JSON.stringify({ id:2, method:'mining.authorize', params: [worker, 'x'] }) + '\n');
});
let extranonce1 = null;
let extranonce2_size = null;
client.on('data', (data) => {
  data.split('\n').forEach(line => {
    if (!line) return;
    try {
      const msg = JSON.parse(line);
      if (msg.result && Array.isArray(msg.result) && msg.result.length >= 2) {
        extranonce1 = msg.result[1];
        extranonce2_size = msg.result[2];
        console.log('got subscription extranonce1=',extranonce1,'size=',extranonce2_size);
      }
      if (msg.method === 'mining.notify') {
        console.log('got notify', msg.params);
        // submit a dummy share: worker, jobid, extranonce2, ntime, nonce
        const jobId = msg.params[0] || 'job0';
        const extranonce2 = '00000000'.slice(0, extranonce2_size*2 || 8);
        const ntime = Math.floor(Date.now()/1000).toString(16);
        const nonce = '00000000';
        setTimeout(()=>{
          client.write(JSON.stringify({ id:3, method:'mining.submit', params: [worker, jobId, extranonce2, ntime, nonce] }) + '\n');
          console.log('submitted dummy share');
        }, 1000);
      }
    } catch(e){ }
  });
});
client.on('close', ()=> console.log('connection closed'));
client.on('error', (e)=> console.error('error', e.message));
