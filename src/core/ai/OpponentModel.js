/* OpponentModel —— 逐对手统计模型，从牌局历史(reducer log 的 ACTION/SHOWDOWN 事件)累积：
   VPIP / PFR / 3bet / foldToCbet / aggressionFactor / wentToShowdown / showdownHands。
   纯逻辑，无 UI。PokerBrain 据此做剥削调整；UI 牌风画像也可读。 */
(function (root, factory) {
  const m = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = m;
  if (typeof window !== 'undefined') (window.RHCore = window.RHCore || {}).OpponentModel = m;
})(this, function () {
  function blank() {
    return {
      hands: 0, vpipHands: 0, pfrHands: 0, threeBetHands: 0, preflopOpportunities: 0,
      cbetFaced: 0, cbetFolds: 0, aggrActions: 0, passiveActions: 0,
      wtsdHands: 0, sawFlopHands: 0, showdownHands: [],
    };
  }
  function create() {
    const bySeat = {};
    const get = (seat) => (bySeat[seat] = bySeat[seat] || blank());

    // 输入一手的事件序列(单手 log：[{t,street,seat,act,...}])，更新所有出现席位的统计
    function ingestHand(events) {
      if (!events || !events.length) return;
      const seats = new Set();
      const preflopActed = {};   // seat → 翻前是否自愿入池/加注/3bet
      let preflopRaises = 0;
      let flopAggressorSeat = null, flopCbetMade = false;
      const sawFlop = new Set(), facedCbet = new Set(), foldedToCbet = new Set();
      const aggr = {}, passive = {};
      for (const e of events) {
        if (e.t !== 'ACTION') continue;
        seats.add(e.seat);
        const isAggr = e.act === 'bet' || e.act === 'raise' || e.act === 'allin';
        const isPassive = e.act === 'call' || e.act === 'check';
        if (isAggr) aggr[e.seat] = (aggr[e.seat] || 0) + 1;
        if (e.act === 'call' || e.act === 'bet' || e.act === 'raise') passive[e.seat] = passive[e.seat] || 0; // placeholder
        if (isPassive) passive[e.seat] = (passive[e.seat] || 0) + 1;
        if (e.street === 'preflop') {
          if (e.act === 'call' || e.act === 'bet' || e.act === 'raise' || e.act === 'allin') preflopActed[e.seat] = preflopActed[e.seat] || { vpip: false, pfr: false, threeBet: false };
          if (e.act === 'call' || e.act === 'raise' || e.act === 'bet' || e.act === 'allin') preflopActed[e.seat].vpip = true;
          if (e.act === 'raise' || e.act === 'bet' || e.act === 'allin') { preflopActed[e.seat].pfr = true; preflopRaises++; if (preflopRaises >= 2) preflopActed[e.seat].threeBet = true; }
        } else {
          sawFlop.add(e.seat);
          if (e.street === 'flop') {
            if (flopAggressorSeat === null && isAggr) { flopAggressorSeat = e.seat; flopCbetMade = true; }
            else if (flopCbetMade && e.seat !== flopAggressorSeat) {
              facedCbet.add(e.seat);
              if (e.act === 'fold') foldedToCbet.add(e.seat);
            }
          }
        }
      }
      // 摊牌
      const sd = events.find((e) => e.t === 'SHOWDOWN');
      const wtsd = new Set();
      if (sd) { Object.keys(sd.hands || {}).forEach((seat) => wtsd.add(+seat)); }
      // 落库
      seats.forEach((seat) => {
        const s = get(seat);
        s.hands++; s.preflopOpportunities++;
        const pa = preflopActed[seat];
        if (pa) { if (pa.vpip) s.vpipHands++; if (pa.pfr) s.pfrHands++; if (pa.threeBet) s.threeBetHands++; }
        s.aggrActions += aggr[seat] || 0; s.passiveActions += passive[seat] || 0;
        if (sawFlop.has(seat)) s.sawFlopHands++;
        if (facedCbet.has(seat)) { s.cbetFaced++; if (foldedToCbet.has(seat)) s.cbetFolds++; }
        if (wtsd.has(seat)) { s.wtsdHands++; if (sd && sd.hands && sd.hands[seat]) s.showdownHands.push(sd.hands[seat]); }
      });
    }

    function stats(seat) {
      const s = get(seat), n = s.hands || 0, pct = (a, b) => (b ? a / b : 0);
      return {
        hands: n,
        vpip: pct(s.vpipHands, s.preflopOpportunities),
        pfr: pct(s.pfrHands, s.preflopOpportunities),
        threeBet: pct(s.threeBetHands, s.preflopOpportunities),
        foldToCbet: pct(s.cbetFolds, s.cbetFaced),
        aggressionFactor: s.passiveActions ? s.aggrActions / s.passiveActions : (s.aggrActions ? 9 : 0),
        wentToShowdown: pct(s.wtsdHands, s.sawFlopHands),
        showdownHands: s.showdownHands.slice(-8),
        sample: n,
      };
    }
    function all() { const o = {}; Object.keys(bySeat).forEach((seat) => { o[seat] = stats(+seat); }); return o; }
    function reset() { Object.keys(bySeat).forEach((k) => delete bySeat[k]); }
    return { ingestHand, stats, all, reset, _raw: bySeat };
  }
  return { create, blank };
});
