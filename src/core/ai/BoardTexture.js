/* BoardTexture —— 公共牌湿润度/连接性/同花/对子分析。纯逻辑，无 UI。 */
(function (root, factory) {
  const m = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = m;
  if (typeof window !== 'undefined') (window.RHCore = window.RHCore || {}).BoardTexture = m;
})(this, function () {
  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
  function analyze(board) {
    if (board.length < 3) return { wetness: 0, paired: false, monotone: false, twoTone: false, rainbow: true, straightConnected: false, highCardHeavy: false, aceHigh: false, dangerTurns: 0, description: '翻前无公共牌。' };
    const ranks = board.map((c) => c.rank).sort((a, b) => b - a);
    const suits = new Map(), rankCounts = new Map();
    for (const c of board) { suits.set(c.suit, (suits.get(c.suit) || 0) + 1); rankCounts.set(c.rank, (rankCounts.get(c.rank) || 0) + 1); }
    const maxSuit = Math.max(...suits.values());
    const paired = [...rankCounts.values()].some((v) => v >= 2);
    const monotone = (maxSuit >= 3 && board.length === 3) || maxSuit >= board.length;
    const twoTone = maxSuit >= 2 && !monotone;
    const rainbow = maxSuit === 1;
    const highCardHeavy = ranks.filter((r) => r >= 11).length >= 2;
    const aceHigh = ranks.includes(14);
    const uniq = [...new Set(ranks.concat(ranks.includes(14) ? [1] : []))].sort((a, b) => a - b);
    let connectedness = 0;
    for (let i = 0; i < uniq.length; i++) for (let j = i + 1; j < uniq.length; j++) { if (uniq[j] - uniq[i] <= 4) connectedness += 1; }
    const straightConnected = connectedness >= 3;
    let wetness = 10;
    if (twoTone) wetness += 20; if (monotone) wetness += 35; if (straightConnected) wetness += 25; if (paired) wetness += 10; if (highCardHeavy) wetness += 7;
    wetness = clamp(wetness, 0, 100);
    const tags = [];
    if (rainbow) tags.push('彩虹面'); if (twoTone) tags.push('两同花面'); if (monotone) tags.push('单色面'); if (paired) tags.push('对子面'); if (straightConnected) tags.push('顺子连接面'); if (highCardHeavy) tags.push('高张密集');
    return { wetness, paired, monotone, twoTone, rainbow, straightConnected, highCardHeavy, aceHigh, dangerTurns: Math.round(wetness / 12), description: tags.length ? tags.join('、') : '干燥牌面' };
  }
  return { analyze };
});
