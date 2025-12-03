/* lib/coinbase.js - builds coinbase tx with payoutAddress support */
const varint = (n) => {
  if (n < 0xfd) return Buffer.from([n]);
  if (n <= 0xffff) { const b = Buffer.alloc(3); b[0]=0xfd; b.writeUInt16LE(n,1); return b; }
  const b = Buffer.alloc(5); b[0]=0xfe; b.writeUInt32LE(n,1); return b;
};
function hexToBuff(h=''){ return Buffer.from(h||'','hex'); }
function encodeHeight(height){ if (height<0x100) return Buffer.concat([Buffer.from([1]), Buffer.from([height])]); else if (height<0x10000){ const b=Buffer.alloc(2); b.writeUInt16LE(height,0); return Buffer.concat([Buffer.from([2]), b]); } else { const b=Buffer.alloc(4); b.writeUInt32LE(height,0); return Buffer.concat([Buffer.from([4]), b]); } }
const { scriptPubKeyForAddress } = require('./address');
function buildCoinbase({extranonce1='', extranonce2='', coinbase_script_prefix='', coinbase_script_suffix='', coinbase_value=0, height=0, payoutAddress=null}){
  const heightPush = encodeHeight(height);
  const scriptPieces = Buffer.concat([heightPush, hexToBuff(coinbase_script_prefix), hexToBuff(extranonce1), hexToBuff(extranonce2), hexToBuff(coinbase_script_suffix)]);
  const scriptLen = varint(scriptPieces.length);
  const prevout = Buffer.alloc(32,0); const prevIndex = Buffer.from([0xff,0xff,0xff,0xff]); const sequence = Buffer.from([0xff,0xff,0xff,0xff]);
  const vin = Buffer.concat([prevout, prevIndex, scriptLen, scriptPieces, sequence]);
  const valueBuf = Buffer.alloc(8); const val = BigInt(Math.floor(Number(coinbase_value||0))); valueBuf.writeBigUInt64LE(val,0);
  let scriptPubKey;
  try { if (payoutAddress) { const s = scriptPubKeyForAddress(payoutAddress); scriptPubKey = Buffer.from(s.scriptPubKeyHex,'hex'); } } catch(e) { console.warn('payout handling failed, falling back to OP_TRUE:', e.message); }
  if (!scriptPubKey) scriptPubKey = Buffer.from([0x51]);
  const vout = Buffer.concat([valueBuf, varint(scriptPubKey.length), scriptPubKey]);
  const version = Buffer.alloc(4); version.writeUInt32LE(1,0);
  const vinCount = varint(1); const voutCount = varint(1); const locktime = Buffer.alloc(4,0);
  const tx = Buffer.concat([version, vinCount, vin, voutCount, vout, locktime]);
  return tx.toString('hex');
}
module.exports = { buildCoinbase };
