/* SettlementController —— 结算/派彩唯一 emit 源：POT_TO_WINNER / HERO_WIN_* / HERO_BAD_BEAT / HERO_GOOD_FOLD / SESSION_SUMMARY / ACHIEVEMENT_UNLOCKED。 */
(function (root, factory) {
  const m = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = m;
  if (typeof window !== 'undefined') (window.RHCore = window.RHCore || {}).SettlementController = m;
})(this, function () {
  function create(gf) {
    const fire = (ev, pl) => { if (gf && gf.emit) gf.emit(ev, pl || {}); };
    return {
      potToWinner(winners, potBb) { fire('POT_TO_WINNER', { winners: winners || [], potBb: potBb || 0 }); },
      heroWin(amount, big) { fire(big ? 'HERO_WIN_BIG' : 'HERO_WIN_SMALL', { amount }); },
      heroLose(handScore) { fire('HERO_LOSE', { handScore }); },
      heroBadBeat(handScore) { fire('HERO_BAD_BEAT', { handScore }); },
      heroGoodFold(seat) { fire('HERO_GOOD_FOLD', { seat }); },
      sessionSummary(hands, stats) { fire('SESSION_SUMMARY', { hands, stats }); },
      achievement(id, coins) { fire('ACHIEVEMENT_UNLOCKED', { id, coins }); },
    };
  }
  return { create };
});
