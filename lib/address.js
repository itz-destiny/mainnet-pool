/* lib/address.js
 * Bech32 decoder for bc1 P2WPKH and base58check decoder for legacy 1... and 3... addresses.
 * Exports: scriptPubKeyForAddress(address) -> { type, scriptPubKeyHex }
 */

const BECH32_CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';

function bech32Polymod(values) {
  const GENERATORS = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];
  let chk = 1;
  for (let p = 0; p < values.length; ++p) {
    const top = chk >>> 25;
    chk = ((chk & 0x1ffffff) << 5) ^ values[p];
    for (let i = 0; i < 5; ++i) {
      if ((top >>> i) & 1) chk ^= GENERATORS[i];
    }
  }
  return chk;
}

function bech32HrpExpand(hrp) {
  const ret = [];
  for (let i = 0; i < hrp.length; ++i) ret.push(hrp.charCodeAt(i) >> 5);
  ret.push(0);
  for (let i = 0; i < hrp.length; ++i) ret.push(hrp.charCodeAt(i) & 31);
  return ret;
}

function bech32VerifyChecksum(hrp, data) {
  return bech32Polymod(bech32HrpExpand(hrp).concat(data)) === 1;
}

function bech32Decode(addr) {
  addr = addr.toLowerCase();
  const pos = addr.lastIndexOf('1');
  if (pos < 1 || pos + 7 > addr.length) throw new Error('Invalid bech32 address');
  const hrp = addr.slice(0, pos);
  const data = [];
  for (let i = pos + 1; i < addr.length; ++i) {
    const c = addr.charAt(i);
    const idx = BECH32_CHARSET.indexOf(c);
    if (idx === -1) throw new Error('Invalid bech32 char');
    data.push(idx);
  }
  if (!bech32VerifyChecksum(hrp, data)) throw new Error('Invalid bech32 checksum');
  return { hrp, data: data.slice(0, data.length - 6) };
}

function convertBits(data, fromBits, toBits, pad) {
  let acc = 0;
  let bits = 0;
  const ret = [];
  const maxv = (1 << toBits) - 1;
  for (let p = 0; p < data.length; ++p) {
    const value = data[p];
    if (value < 0 || (value >> fromBits) !== 0) return null;
    acc = (acc << fromBits) | value;
    bits += fromBits;
    while (bits >= toBits) {
      bits -= toBits;
      ret.push((acc >> bits) & maxv);
    }
  }
  if (pad) {
    if (bits > 0) ret.push((acc << (toBits - bits)) & maxv);
  } else if (bits >= fromBits) {
    return null;
  } else if ((acc << (toBits - bits)) & maxv) {
    return null;
  }
  return ret;
}

function decodeBech32Address(addr) {
  const { hrp, data } = bech32Decode(addr);
  const witnessVer = data[0];
  const program = convertBits(data.slice(1), 5, 8, false);
  if (!program) throw new Error('Invalid bech32 program');
  return { hrp, witnessVer, program: Buffer.from(program) };
}

// Base58check decode
const B58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
function base58Decode(s) {
  const bytes = [0];
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    const p = B58_ALPHABET.indexOf(ch);
    if (p === -1) throw new Error('Invalid base58 character');
    let carry = p;
    for (let j = 0; j < bytes.length; ++j) {
      carry += bytes[j] * 58;
      bytes[j] = carry & 0xff;
      carry >>= 8;
    }
    while (carry > 0) {
      bytes.push(carry & 0xff);
      carry >>= 8;
    }
  }
  // convert little-endian byte array to buffer and add leading zeros
  const buf = Buffer.from(bytes.reverse());
  // count leading '1' as zero bytes
  let nPad = 0;
  for (let i = 0; i < s.length && s[i] === '1'; i++) nPad++;
  if (nPad) return Buffer.concat([Buffer.alloc(nPad), buf]);
  return buf;
}

function base58CheckDecode(addr) {
  const buf = base58Decode(addr);
  if (buf.length < 4) throw new Error('invalid address');
  const payload = buf.slice(0, buf.length - 4);
  const checksum = buf.slice(buf.length - 4);
  const crypto = require('crypto');
  const hash = crypto.createHash('sha256').update(crypto.createHash('sha256').update(payload).digest()).digest();
  if (!hash.slice(0,4).equals(checksum)) throw new Error('invalid checksum');
  return payload;
}

function scriptPubKeyForBase58(addr) {
  // payload: version(1) + hash(20)
  const payload = base58CheckDecode(addr);
  const version = payload[0];
  const hash = payload.slice(1);
  if (version === 0x00) {
    // P2PKH -> scriptPubKey: OP_DUP OP_HASH160 <20> OP_EQUALVERIFY OP_CHECKSIG
    return { type: 'p2pkh', scriptPubKeyHex: '76a914' + hash.toString('hex') + '88ac' };
  } else if (version === 0x05) {
    // P2SH -> scriptPubKey: OP_HASH160 <20> OP_EQUAL
    return { type: 'p2sh', scriptPubKeyHex: 'a914' + hash.toString('hex') + '87' };
  }
  throw new Error('Unsupported base58 version byte: ' + version);
}

function scriptPubKeyForAddress(address) {
  address = address.trim();
  if (address.toLowerCase().startsWith('bc1')) {
    const decoded = decodeBech32Address(address);
    if (decoded.witnessVer !== 0) throw new Error('unsupported witness version');
    if (decoded.program.length === 20) {
      return { type: 'p2wpkh', scriptPubKeyHex: '0014' + decoded.program.toString('hex') };
    } else if (decoded.program.length === 32) {
      // p2wsh
      return { type: 'p2wsh', scriptPubKeyHex: '0020' + decoded.program.toString('hex') };
    } else throw new Error('unsupported program length');
  } else {
    // try base58
    return scriptPubKeyForBase58(address);
  }
}

module.exports = { scriptPubKeyForAddress };
