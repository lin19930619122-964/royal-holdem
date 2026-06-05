/* EquityCalculator —— 权益估算(蒙特卡洛) + 听牌分析 + 成牌命名分类。纯逻辑，无 UI。
   读牌：顶对/超对/中对/两对/暗三/三条/顺子/同花/葫芦/四条 + 同花听/两头顺/卡顺/组合听。 */
(function (root, factory) {
  const req = (typeof require !== 'undefined');
  const HandEvaluator = req ? require('../poker/HandEvaluator.js') : window.RHCore.HandEvaluator;
  const Equity = req ? require('../poker/Equity.js') : window.RHCore.Equity;
  const T = req ? require('./types.js') : window.RHCore.AiTypes;
  const m = factory(HandEvaluator, Equity, T);
  if (typeof module !== 'undefined' && module.exports) module.exports = m;
  if (typeof window !== 'undefined') (window.RHCore = window.RHCore || {}).EquityCalculator = m;
})(this, function (HandEvaluator, Equity, T) {
  const MADE = T.MADE, MADE_CN = T.MADE_CN;

  function estimate(o) { return Equity.estimate(o); }

  function straightPotentialRanks(cards) {
    const ranks = [...new Set(cards.map((c) => c.rank).concat(cards.some((c) => c.rank === 14) ? [1] : []))].sort((a, b) => a - b);
    let openEnded = false, gutshots = 0;
    for (let low = 1; low <= 10; low++) {
      const windowR = [low, low + 1, low + 2, low + 3, low + 4];
      const have = windowR.filter((r) => ranks.includes(r)).length;
      if (have === 4) { const missing = windowR.find((r) => !ranks.includes(r)); if (missing === low || missing === low + 4) openEnded = true; else gutshots += 1; }
    }
    return { openEnded, gutshot: gutshots >= 1, doubleGutshot: gutshots >= 2 };
  }
  function analyzeDraws(hole, board) {
    const all = [...hole, ...board];
    const suitCounts = new Map();
    for (const c of all) suitCounts.set(c.suit, (suitCounts.get(c.suit) || 0) + 1);
    const maxSuit = Math.max(...suitCounts.values());
    const sorted = [...suitCounts.entries()].sort((a, b) => b[1] - a[1]);
    const flushSuit = sorted[0] && sorted[0][0];
    const flushDraw = board.length >= 3 && maxSuit === 4;
    const backdoorFlushDraw = board.length === 3 && maxSuit === 3;
    const nutFlushDraw = flushDraw && flushSuit !== undefined && hole.some((c) => c.suit === flushSuit && c.rank === 14);
    const straight = straightPotentialRanks(all);
    const topBoardRank = Math.max(...board.map((c) => c.rank), 0);
    const overcards = board.length > 0 ? hole.filter((c) => c.rank > topBoardRank).length : 0;
    const comboDraw = flushDraw && (straight.openEnded || straight.gutshot || overcards >= 1);
    const tags = [];
    if (nutFlushDraw) tags.push('坚果同花听牌'); else if (flushDraw) tags.push('同花听牌');
    if (backdoorFlushDraw) tags.push('后门同花');
    if (straight.openEnded) tags.push('两头顺听'); if (straight.doubleGutshot) tags.push('双卡顺听'); else if (straight.gutshot) tags.push('卡顺听');
    if (overcards > 0) tags.push(`${overcards} 张高张`);
    if (comboDraw) tags.push('组合听牌');
    return { flushDraw, nutFlushDraw, backdoorFlushDraw, openEndedStraightDraw: straight.openEnded, gutshot: straight.gutshot, doubleGutshot: straight.doubleGutshot, overcards, comboDraw, summary: tags.length ? tags.join('、') : '无明显听牌' };
  }

  // 成牌命名分类：返回 { made, label, category, kickerStrength }
  function classifyMadeHand(hole, board) {
    const cards = [...hole, ...board];
    const r = HandEvaluator.evaluateBest(cards);
    const cat = r.score[0];
    if (board.length === 0) return { made: MADE.NONE, label: '翻前', category: cat, kickerStrength: 0 };
    const boardRanks = board.map((c) => c.rank).sort((a, b) => b - a);
    const topBoard = boardRanks[0];
    const holePair = hole.length === 2 && hole[0].rank === hole[1].rank;
    let made = MADE.NONE;
    if (cat >= 8) made = MADE.STRAIGHT_FLUSH;
    else if (cat === 7) made = MADE.QUADS;
    else if (cat === 6) made = MADE.FULL_HOUSE;
    else if (cat === 5) made = MADE.FLUSH;
    else if (cat === 4) made = MADE.STRAIGHT;
    else if (cat === 3) made = (holePair && board.some((c) => c.rank === hole[0].rank)) ? MADE.SET : MADE.TRIPS;
    else if (cat === 2) made = MADE.TWO_PAIR;
    else if (cat === 1) {
      // 区分超对/顶对/中对/弱对
      if (holePair && hole[0].rank > topBoard) made = MADE.OVERPAIR;
      else if (hole.some((c) => c.rank === topBoard)) made = MADE.TOP_PAIR;
      else if (hole.some((c) => boardRanks.includes(c.rank) && c.rank < topBoard)) made = MADE.SECOND_PAIR;
      else made = MADE.PAIR_WEAK;
    } else made = MADE.NONE;
    // 踢脚强度（仅顶对/超对有意义）：另一张手牌的大小
    let kickerStrength = 0;
    if (made === MADE.TOP_PAIR || made === MADE.OVERPAIR) {
      const kicker = hole.find((c) => c.rank !== topBoard) || hole[0];
      kickerStrength = kicker.rank >= 13 ? 2 : kicker.rank >= 11 ? 1 : 0; // 强(AK)/中(QJ)/弱
    }
    return { made, label: MADE_CN[made], category: cat, kickerStrength };
  }
  return { estimate, analyzeDraws, straightPotentialRanks, classifyMadeHand };
});
