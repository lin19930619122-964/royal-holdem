/* 兑换码编解码 —— 浏览器与 Node 共用，保证生成/校验一致。
   码格式：RHD-<TYPE>.<VALUE36>.<NONCE36>-<SIG5>（全大写）
   TYPE: C金币 D钻石 B牌背皮肤 F桌布皮肤
   带签名(基于共享密钥的 FNV 哈希)，乱填无效；含 nonce 保证一次性。 */
(function (root, factory) {
  const mod = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = mod;
  else root.Codec = mod;
})(typeof self !== 'undefined' ? self : this, function () {
  const SECRET = 'royal-holdem-2026-free';

  function hash32(str) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return h >>> 0;
  }

  function sigOf(core) {
    return (hash32(core + SECRET) >>> 0).toString(36).toUpperCase().slice(0, 5).padStart(5, '0');
  }

  // reward: { type:'C'|'D'|'B'|'F', value:number|string }
  function encode(reward, nonce) {
    const t = reward.type.toUpperCase();
    let v;
    if (t === 'C' || t === 'D') v = Math.max(0, Math.floor(reward.value)).toString(36);
    else v = String(reward.value).toLowerCase();
    const n = (nonce >>> 0).toString(36);
    const core = `${t}.${v}.${n}`.toUpperCase();
    return `RHD-${core}-${sigOf(core)}`;
  }

  function decode(code) {
    if (!code) return { valid: false };
    const c = String(code).trim().toUpperCase().replace(/\s+/g, '');
    const m = c.match(/^RHD-([A-Z0-9]+\.[A-Z0-9]+\.[A-Z0-9]+)-([A-Z0-9]{5})$/);
    if (!m) return { valid: false };
    const core = m[1];
    if (sigOf(core) !== m[2]) return { valid: false };
    const parts = core.split('.');
    const type = parts[0];
    let value;
    if (type === 'C' || type === 'D') value = parseInt(parts[1], 36);
    else value = parts[1].toLowerCase();
    return { valid: true, type, value, nonce: parts[2], code: c };
  }

  return { encode, decode, hash32 };
});
