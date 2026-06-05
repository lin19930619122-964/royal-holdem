/* SeededRng —— 可复现随机数（mulberry32）。同种子 → 同序列。纯逻辑，无 UI。 */
(function (root, factory) {
  const m = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = m;
  if (typeof window !== 'undefined') (window.RHCore = window.RHCore || {}).SeededRng = m;
})(this, function () {
  function create(seed) {
    let a = (seed >>> 0) || 1;
    function next() {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
    return {
      next,
      intBelow(n) { return Math.floor(next() * n); },
      // Fisher-Yates 原地洗牌
      shuffle(arr) {
        for (let i = arr.length - 1; i > 0; i--) {
          const j = Math.floor(next() * (i + 1));
          const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
        }
        return arr;
      },
      getState() { return a >>> 0; },
      setState(s) { a = (s >>> 0) || 1; },
    };
  }
  // 从字符串或时间派生种子（外部传入，避免在纯核心里用 Date.now）
  function seedFrom(value) {
    let h = 2166136261 >>> 0;
    const str = String(value);
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  return { create, seedFrom };
});
