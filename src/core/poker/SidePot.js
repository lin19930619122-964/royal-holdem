/* SidePot —— 由各玩家本手总投入(totalBet)+弃牌状态分层计算主池/边池，并按摊牌名次分配(含平分)。
   注意：未叫注的超额下注应在 reducer 里先退还，再调用本模块。纯逻辑，无 UI。 */
(function (root, factory) {
  const HandEvaluator = (typeof require !== 'undefined') ? require('./HandEvaluator.js') : window.RHCore.HandEvaluator;
  const m = factory(HandEvaluator);
  if (typeof module !== 'undefined' && module.exports) module.exports = m;
  if (typeof window !== 'undefined') (window.RHCore = window.RHCore || {}).SidePot = m;
})(this, function (HandEvaluator) {
  function sameSet(a, b) { if (a.length !== b.length) return false; const s = new Set(a); return b.every((x) => s.has(x)); }

  // players: [{seat, totalBet, folded}] → [{amount, eligible:[seat]}]（从主池到边池）
  function compute(players) {
    const contribs = players.map((p) => ({ seat: p.seat, amt: p.totalBet || 0, folded: !!p.folded })).filter((c) => c.amt > 0);
    const levels = [...new Set(contribs.map((c) => c.amt))].sort((a, b) => a - b);
    const pots = []; let prev = 0;
    for (const lv of levels) {
      const layer = lv - prev;
      const atLeast = contribs.filter((c) => c.amt >= lv);
      const amount = layer * atLeast.length;
      const eligible = atLeast.filter((c) => !c.folded).map((c) => c.seat);
      if (amount > 0) pots.push({ amount, eligible });
      prev = lv;
    }
    // 合并相邻、可领取者相同的层
    const merged = [];
    for (const pot of pots) {
      const last = merged[merged.length - 1];
      if (last && sameSet(last.eligible, pot.eligible)) last.amount += pot.amount;
      else merged.push({ amount: pot.amount, eligible: pot.eligible.slice() });
    }
    return merged;
  }

  // 分配：pots + scoreOf(seat)→评分；buttonSeat/numSeats 用于零头分配(从庄位左手第一个有效座开始)
  // 返回 { winnings:{seat:amount}, potResults:[{amount, winners:[seat]}] }
  function distribute(pots, scoreOf, seatOrderFromButton) {
    const winnings = {}; const potResults = [];
    for (const pot of pots) {
      if (!pot.eligible.length) continue;
      // 找最强分值
      let best = null;
      for (const seat of pot.eligible) { const sc = scoreOf(seat); if (best === null || HandEvaluator.compare(sc, best) > 0) best = sc; }
      const winners = pot.eligible.filter((seat) => HandEvaluator.compare(scoreOf(seat), best) === 0);
      const share = Math.floor(pot.amount / winners.length);
      let remainder = pot.amount - share * winners.length;
      for (const seat of winners) winnings[seat] = (winnings[seat] || 0) + share;
      // 零头按庄位左手顺序分给最靠前的赢家
      if (remainder > 0) {
        const order = seatOrderFromButton.filter((s) => winners.includes(s));
        for (let i = 0; i < remainder; i++) { const seat = order[i % order.length]; winnings[seat] = (winnings[seat] || 0) + 1; }
      }
      potResults.push({ amount: pot.amount, winners: winners.slice() });
    }
    return { winnings, potResults };
  }
  return { compute, distribute };
});
