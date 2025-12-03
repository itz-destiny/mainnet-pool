/* lib/merkle.js - compute merkle root */
const crypto = require('crypto');
function dblsha(buffer) { return crypto.createHash('sha256').update(crypto.createHash('sha256').update(buffer).digest()).digest(); }
function computeMerkleRoot(coinbaseHex, txHexList) {
  const nodes = [dblsha(Buffer.from(coinbaseHex, 'hex'))];
  for (const txh of txHexList) nodes.push(dblsha(Buffer.from(txh, 'hex')));
  let layer = nodes;
  while (layer.length > 1) {
    const next = [];
    for (let i=0;i<layer.length;i+=2) {
      const a = layer[i];
      const b = (i+1 < layer.length) ? layer[i+1] : layer[i];
      next.push(dblsha(Buffer.concat([a,b])));
    }
    layer = next;
  }
  return Buffer.from(layer[0]).reverse().toString('hex');
}
module.exports = { computeMerkleRoot };
