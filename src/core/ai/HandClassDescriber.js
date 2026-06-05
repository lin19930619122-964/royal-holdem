/* HandClassDescriber —— 细粒度成牌分类(含踢脚质量) + best5 来源拆分(hole/board) + 牌型名 + 踢脚信息。
   输出 class ∈ {top_pair_top_kicker, top_pair_good_kicker, top_pair_weak_kicker, middle_pair, bottom_pair,
   overpair, two_pair, set, trips, straight, flush, full_house, quads, straight_flush, draw_combo, air}。纯逻辑，无 UI。 */
(function (root, factory) {
  const req = (typeof require !== 'undefined');
  const HandEvaluator = req ? require('../poker/HandEvaluator.js') : window.RHCore.HandEvaluator;
  const EQ = req ? require('./EquityCalculator.js') : window.RHCore.EquityCalculator;
  const m = factory(HandEvaluator, EQ);
  if (typeof module !== 'undefined' && module.exports) module.exports = m;
  if (typeof window !== 'undefined') (window.RHCore = window.RHCore || {}).HandClassDescriber = m;
})(this, function (HandEvaluator, EQ) {
  const CN = {
    top_pair_top_kicker: '顶对顶踢脚', top_pair_good_kicker: '顶对好踢脚', top_pair_weak_kicker: '顶对弱踢脚',
    middle_pair: '中对', bottom_pair: '底对', overpair: '超对', two_pair: '两对', set: '暗三条', trips: '三条',
    straight: '顺子', flush: '同花', full_house: '葫芦', quads: '四条', straight_flush: '同花顺',
    draw_combo: '强听牌', air: '空气',
  };
  function key(c) { return c.rank + c.suit; }
  function describe(hole, board) {
    if (!board || board.length === 0) return { class: 'preflop', label: '翻前', cn: '翻前', category: -1, fromHole: [], fromBoard: [], kicker: null };
    const cards = hole.concat(board);
    const r = HandEvaluator.evaluateBest(cards);
    const cat = r.score[0];
    const best5 = (r.cards || []).map(key);
    const holeKeys = new Set(hole.map(key)), boardKeys = new Set(board.map(key));
    const fromHole = best5.filter((k) => holeKeys.has(k));
    const fromBoard = best5.filter((k) => boardKeys.has(k));
    const boardRanks = board.map((c) => c.rank).sort((a, b) => b - a);
    const topBoard = boardRanks[0], midBoard = boardRanks[Math.floor(boardRanks.length / 2)], lowBoard = boardRanks[boardRanks.length - 1];
    const holePair = hole.length === 2 && hole[0].rank === hole[1].rank;
    let cls, kicker = null;
    if (cat >= 8) cls = 'straight_flush';
    else if (cat === 7) cls = 'quads';
    else if (cat === 6) cls = 'full_house';
    else if (cat === 5) cls = 'flush';
    else if (cat === 4) cls = 'straight';
    else if (cat === 3) cls = (holePair && board.some((c) => c.rank === hole[0].rank)) ? 'set' : 'trips';
    else if (cat === 2) cls = 'two_pair';
    else if (cat === 1) {
      if (holePair && hole[0].rank > topBoard) cls = 'overpair';
      else if (hole.some((c) => c.rank === topBoard)) {
        const k = (hole.find((c) => c.rank !== topBoard) || hole[0]);
        kicker = { rank: k.rank };
        // 顶踢脚：顶对且对子本身≥K + 踢脚 A(如 AK 命中 K)；好踢脚：踢脚≥Q；否则弱
        if (topBoard >= 13 && k.rank === 14) cls = 'top_pair_top_kicker';
        else if (k.rank >= 12) cls = 'top_pair_good_kicker';
        else cls = 'top_pair_weak_kicker';
      } else if (hole.some((c) => c.rank === midBoard)) cls = 'middle_pair';
      else if (hole.some((c) => c.rank === lowBoard)) cls = 'bottom_pair';
      else cls = 'middle_pair';
    } else {
      // 高牌：有强听牌则 draw_combo
      const d = EQ.analyzeDraws(hole, board);
      cls = (d.comboDraw || d.flushDraw || d.openEndedStraightDraw) ? 'draw_combo' : 'air';
    }
    return { class: cls, label: HandEvaluator.name(r.score), cn: CN[cls] || cls, category: cat, fromHole, fromBoard, best5, kicker };
  }
  return { describe, CN };
});
