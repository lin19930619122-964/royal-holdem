/* ChipFlyAnimator —— 筹码飞行：座位→下注区/底池、底池→赢家。通过 stage 注入的 fly 助手执行。
   stage 接口（均可缺省，缺省则安全跳过）：seatEl(i), potEl(), winnerAnchorEl(i), fly(fromEl,toEl,opts) */
(function (root, factory) {
  const m = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = m;
  if (typeof window !== 'undefined') (window.RHCore = window.RHCore || {}).ChipFlyAnimator = m;
})(this, function () {
  function create(stage) {
    stage = stage || {};
    function safe(fn) { try { return fn(); } catch (e) { return null; } }
    function betToPot(seatIndex, opts) {
      if (!stage.fly || !stage.seatEl || !stage.potEl) return;
      safe(() => { const from = stage.seatEl(seatIndex), to = stage.potEl(); if (from && to) stage.fly(from, to, opts || { count: 1 }); });
    }
    function potToWinner(seatIndex, opts) {
      if (!stage.fly || !stage.potEl) return;
      safe(() => { const from = stage.potEl(); const to = (stage.winnerAnchorEl ? stage.winnerAnchorEl(seatIndex) : (stage.seatEl && stage.seatEl(seatIndex))); if (from && to) stage.fly(from, to, opts || { count: 5, reverse: true }); });
    }
    return { betToPot, potToWinner };
  }
  return { create };
});
