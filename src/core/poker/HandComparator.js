/* HandComparator —— 多人摊牌排名。给每个未弃牌玩家算最佳手牌并按强弱分组。纯逻辑，无 UI。 */
(function (root, factory) {
  const HandEvaluator = (typeof require !== 'undefined') ? require('./HandEvaluator.js') : window.RHCore.HandEvaluator;
  const m = factory(HandEvaluator);
  if (typeof module !== 'undefined' && module.exports) module.exports = m;
  if (typeof window !== 'undefined') (window.RHCore = window.RHCore || {}).HandComparator = m;
})(this, function (HandEvaluator) {
  const cmp = HandEvaluator.compare;
  // contenders: [{ id/seat, cards:[7 张] }] → 每人 { ...原字段, score, best5, name }，并附 rankGroups
  function evaluateAll(contenders) {
    const evald = contenders.map((c) => {
      const r = HandEvaluator.evaluateBest(c.cards);
      return Object.assign({}, c, { score: r.score, best5: r.cards, name: HandEvaluator.name(r.score) });
    });
    // 从强到弱排序，平手成组
    const sorted = evald.slice().sort((a, b) => cmp(b.score, a.score));
    const groups = [];
    for (const e of sorted) {
      const g = groups[groups.length - 1];
      if (g && cmp(g[0].score, e.score) === 0) g.push(e); else groups.push([e]);
    }
    return { evald, groups };
  }
  return { evaluateAll, compare: cmp };
});
