/* HighlightDirector —— 高亮编排：轮到玩家(光圈/操作区亮起)、摊牌最佳五张高亮+其他压暗、弃牌灰化、全下桌面聚焦。
   通过 stage 注入 DOM 操作；全部可缺省安全跳过。 */
(function (root, factory) {
  const m = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = m;
  if (typeof window !== 'undefined') (window.RHCore = window.RHCore || {}).HighlightDirector = m;
})(this, function () {
  function create(stage) {
    stage = stage || {};
    function safe(fn) { try { fn(); } catch (e) { /* ignore */ } }
    return {
      activeSeat(i) { if (stage.setActiveSeat) safe(() => stage.setActiveSeat(i)); },
      thinking(i, on) { if (stage.setThinking) safe(() => stage.setThinking(i, on)); },
      foldMask(i) { if (stage.setFoldMask) safe(() => stage.setFoldMask(i)); },
      allInFocus() { if (stage.allInFocus) safe(() => stage.allInFocus()); },
      // 摊牌最佳五张：highlightCards = [{seat, cardKeys:[...]}], 其余压暗
      bestHand(highlightCards) { if (stage.highlightBest) safe(() => stage.highlightBest(highlightCards)); },
      clearBest() { if (stage.clearHighlightBest) safe(() => stage.clearHighlightBest()); },
      premiumHand(i) { if (stage.premiumHandCue) safe(() => stage.premiumHandCue(i)); },
      // 摊牌：进入/退出压暗模式
      showdownDim(on) { if (stage.setShowdownDim) safe(() => stage.setShowdownDim(on)); },
      // 逐家亮牌(翻开该座位手牌并轻闪)
      revealHand(i, payload) { if (stage.revealSeat) safe(() => stage.revealSeat(i, payload)); },
      // 成就解锁横幅
      achievement(payload) { if (stage.achievementBanner) safe(() => stage.achievementBanner(payload)); },
    };
  }
  return { create };
});
