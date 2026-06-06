/* DealController —— 发牌阶段的 GameFeelEvent 唯一 emit 源。ui.js 只调本控制器，不直接 emit。
   负责：HAND_START / POST_BLINDS / DEAL_HOLE_CARD / DEAL_FLOP / DEAL_TURN / DEAL_RIVER (+ 英雄强起手提示)。 */
(function (root, factory) {
  const m = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = m;
  if (typeof window !== 'undefined') (window.RHCore = window.RHCore || {}).DealController = m;
})(this, function () {
  function create(gf) {
    const E = (gf && gf.EVENTS) || {};
    const fire = (ev, pl) => { if (gf && gf.emit) gf.emit(ev, pl || {}); };
    return {
      handStart() { fire('HAND_START', {}); },
      postBlinds(sb, bb) { fire('POST_BLINDS', { sb, bb }); },
      dealHole(seatIndices) { fire('DEAL_HOLE_CARD', { seatIndices: seatIndices || [] }); },
      premiumHand(seat, code) { fire('HERO_PREMIUM_HAND', { seat, code }); },
      dealStreet(name) { fire(name === 'flop' ? 'DEAL_FLOP' : name === 'turn' ? 'DEAL_TURN' : 'DEAL_RIVER', {}); },
      dealFlop() { fire('DEAL_FLOP', {}); },
      dealTurn() { fire('DEAL_TURN', {}); },
      dealRiver() { fire('DEAL_RIVER', {}); },
    };
  }
  return { create };
});
