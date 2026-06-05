/* HandEvaluator —— 5 张评估 + 7 选 5 最佳。返回可比较分值 [类别, 主牌..., 踢脚...]。
   支持 A2345 轮子顺子；皇家同花顺作为同花顺最高(score[1]===14)显示。纯逻辑，无 UI。 */
(function (root, factory) {
  const m = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = m;
  if (typeof window !== 'undefined') (window.RHCore = window.RHCore || {}).HandEvaluator = m;
})(this, function () {
  const CATEGORY_NAME = ['高牌', '一对', '两对', '三条', '顺子', '同花', '葫芦', '四条', '同花顺'];

  function evaluate5(cards) {
    const ranks = cards.map((c) => c.rank).sort((a, b) => b - a);
    const suits = cards.map((c) => c.suit);
    const isFlush = suits.every((s) => s === suits[0]);
    const uniq = [...new Set(ranks)].sort((a, b) => b - a);
    let straightHigh = 0;
    if (uniq.length === 5) {
      if (uniq[0] - uniq[4] === 4) straightHigh = uniq[0];
      else if (uniq[0] === 14 && uniq[1] === 5 && uniq[4] === 2) straightHigh = 5; // 轮子 A-2-3-4-5
    }
    const cnt = {};
    for (const r of ranks) cnt[r] = (cnt[r] || 0) + 1;
    const groups = Object.entries(cnt).map(([r, c]) => ({ rank: +r, count: c }))
      .sort((a, b) => b.count - a.count || b.rank - a.rank);
    const counts = groups.map((g) => g.count);
    const isStraight = straightHigh > 0;
    if (isStraight && isFlush) return [8, straightHigh];
    if (counts[0] === 4) return [7, groups[0].rank, groups[1].rank];
    if (counts[0] === 3 && counts[1] === 2) return [6, groups[0].rank, groups[1].rank];
    if (isFlush) return [5, ...ranks];
    if (isStraight) return [4, straightHigh];
    if (counts[0] === 3) return [3, groups[0].rank, groups[1].rank, groups[2].rank];
    if (counts[0] === 2 && counts[1] === 2) return [2, groups[0].rank, groups[1].rank, groups[2].rank];
    if (counts[0] === 2) return [1, groups[0].rank, groups[1].rank, groups[2].rank, groups[3].rank];
    return [0, ...ranks];
  }

  // 最多 7 张取最优 5 张 → { score, cards }
  function evaluateBest(cards) {
    if (cards.length <= 5) return { score: evaluate5(cards), cards: cards.slice() };
    const n = cards.length; let best = null, bestCards = null;
    for (let a = 0; a < n - 4; a++) for (let b = a + 1; b < n - 3; b++) for (let c = b + 1; c < n - 2; c++)
      for (let d = c + 1; d < n - 1; d++) for (let e = d + 1; e < n; e++) {
        const combo = [cards[a], cards[b], cards[c], cards[d], cards[e]];
        const sc = evaluate5(combo);
        if (best === null || compare(sc, best) > 0) { best = sc; bestCards = combo; }
      }
    return { score: best, cards: bestCards };
  }

  function compare(a, b) {
    const len = Math.max(a.length, b.length);
    for (let i = 0; i < len; i++) { const x = a[i] || 0, y = b[i] || 0; if (x !== y) return x - y; }
    return 0;
  }
  function name(score) {
    if (!score) return '';
    if (score[0] === 8 && score[1] === 14) return '皇家同花顺';
    return CATEGORY_NAME[score[0]] || '';
  }
  return { evaluate5, evaluateBest, compare, name, CATEGORY_NAME };
});
