/* lib/stratum_v1.js - validate shares */
const crypto = require('crypto');
const { buildCoinbase } = require('./coinbase');
const { computeMerkleRoot } = require('./merkle');
function targetFromBits(bitsHex) { const be = Buffer.from(bitsHex,'hex'); const exponent = BigInt(be[0]); const mant = BigInt('0x' + be.slice(1).toString('hex')); const shift = 8n * (exponent - 3n); return mant << shift; }
function headerDoubleSHA(hex) { const buf = Buffer.from(hex,'hex'); const h = crypto.createHash('sha256').update(buf).digest(); const hh = crypto.createHash('sha256').update(h).digest(); return Buffer.from(hh).reverse().toString('hex'); }
function validateShare({ job, extranonce1, extranonce2, ntime, nonceHex }) {
  const coinbaseHex = buildCoinbase({ extranonce1, extranonce2, coinbase_script_prefix: job.coinbase_script_prefix_hex || '', coinbase_script_suffix: job.coinbase_script_suffix_hex || '', coinbase_value: job.coinbase_value || 0, height: job.height || 0, payoutAddress: process.env.COINBASE_PAYOUT_ADDRESS || null });
  const merkleLe = computeMerkleRoot(coinbaseHex, job.txs || []);
  const versionBuf = Buffer.alloc(4); versionBuf.writeUInt32LE(job.version||1,0);
  const prevHashLE = Buffer.from(job.prevhash,'hex').reverse();
  const merkleBuf = Buffer.from(merkleLe,'hex').reverse();
  const timeBuf = Buffer.alloc(4); timeBuf.writeUInt32LE(Number(ntime || job.curtime || Math.floor(Date.now()/1000)),0);
  const bitsBuf = Buffer.from(job.nbits,'hex').reverse();
  const nonceBuf = Buffer.alloc(4);
  const nonce = Buffer.from(nonceHex || '', 'hex');
  if (nonce.length === 4) nonceBuf.writeUInt32LE(nonce.readUInt32BE(0),0); else for (let i=0;i<Math.min(4,nonce.length);i++) nonceBuf[i]=nonce[i];
  const header = Buffer.concat([versionBuf, prevHashLE, merkleBuf, timeBuf, bitsBuf, nonceBuf]).toString('hex');
  const headerHash = headerDoubleSHA(header);
  const headerHashBig = BigInt('0x' + headerHash);
  const target = targetFromBits(job.nbits);
  const pass = headerHashBig <= target;
  return { pass, headerHash, header, coinbaseHex };
}

function buildFullBlock(headerHex, coinbaseHex, txHexList) {
  // varint encoding for transaction count
  function varint(n) {
    if (n < 0xfd) return Buffer.from([n]);
    if (n <= 0xffff) {
      const b = Buffer.alloc(3);
      b[0] = 0xfd;
      b.writeUInt16LE(n, 1);
      return b;
    }
    const b = Buffer.alloc(5);
    b[0] = 0xfe;
    b.writeUInt32LE(n, 1);
    return b;
  }
  
  // All transactions: coinbase first, then others
  const allTxs = [coinbaseHex, ...(txHexList || [])];
  const txCount = varint(allTxs.length);
  
  // Concatenate: header + tx count + all transactions
  const headerBuf = Buffer.from(headerHex, 'hex');
  const txBufs = allTxs.map(tx => Buffer.from(tx, 'hex'));
  const fullBlock = Buffer.concat([headerBuf, txCount, ...txBufs]);
  
  return fullBlock.toString('hex');
}

module.exports = { validateShare, targetFromBits, buildFullBlock };
