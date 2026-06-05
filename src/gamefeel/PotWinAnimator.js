/* PotWinAnimator —— 赢池动效：底池筹码飞向赢家 + 赢家头像发光 + 赢家筹码数字滚动增加 + 大底池升级反馈。
   组合 ChipFlyAnimator + stage 注入：winnerGlow(i,on), rollSeatStack(i,target), bigPotBanner(amount)。无 DOM 安全跳过。 */
(function (root, factory) {
  const m = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = m;
  if (typeof window !== 'undefined') (window.RHCore = window.RHCore || {}).PotWinAnimator = m;
})(this, function () {
  function create(stage, chipFly) {
    stage = stage || {};
    function award(winners, potBb) {
      (winners || []).forEach((w) => {
        if (chipFly && chipFly.potToWinner) chipFly.potToWinner(w.seat, { count: Math.min(6, 2 + Math.floor((w.amount || 0) / 1000)) });
        if (stage.winnerGlow) stage.winnerGlow(w.seat, true);
        if (stage.rollSeatStack && w.toStack != null) stage.rollSeatStack(w.seat, w.toStack);
      });
      if (stage.bigPotBanner && potBb >= 50) stage.bigPotBanner(potBb);
    }
    function clear() { if (stage.clearWinnerGlow) stage.clearWinnerGlow(); }
    return { award, clear };
  }
  return { create };
});
