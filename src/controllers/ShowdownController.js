/* ShowdownController —— 摊牌阶段唯一 emit 源：SHOWDOWN_START / REVEAL_HAND(逐家) / BEST_HAND_HIGHLIGHT。 */
(function (root, factory) {
  const m = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = m;
  if (typeof window !== 'undefined') (window.RHCore = window.RHCore || {}).ShowdownController = m;
})(this, function () {
  function create(gf) {
    const fire = (ev, pl) => { if (gf && gf.emit) gf.emit(ev, pl || {}); };
    return {
      start() { fire('SHOWDOWN_START', {}); },
      reveal(seat, hand, hole) { fire('REVEAL_HAND', { seat, hand, hole }); },
      bestHand(highlight) { fire('BEST_HAND_HIGHLIGHT', { highlight: highlight || [] }); },
    };
  }
  return { create };
});
