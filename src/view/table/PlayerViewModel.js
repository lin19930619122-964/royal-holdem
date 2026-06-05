/* PlayerViewModel —— 把(玩家状态 + 牌桌上下文)映射为座位渲染所需的纯视图模型。
   SeatView.update 只读 VM，不碰 GameState。无 UI 副作用。 */
(function (root, factory) {
  const m = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = m;
  if (typeof window !== 'undefined') (window.RHCore = window.RHCore || {}).PlayerViewModel = m;
})(this, function () {
  // p：玩家(GameAdapter 代理)；o：上下文 { seatIndex,isDealer,isSmallBlind,isBigBlind,isThinking,timerPercent,
  //   holeCardsVisible,holeCardsBackVisible,bestCardIds,isWinner,winStreak,isTrustee,quickWord,emojiId,giftId,avatarFrameId }
  function build(p, o) {
    o = o || {};
    return {
      playerId: p.id, seatIndex: o.seatIndex != null ? o.seatIndex : p.seat,
      nickname: p.name || ('P' + p.seat), avatar: p.avatar || '', avatarFrameId: o.avatarFrameId || null,
      stack: p.chips || 0, betAmount: p.totalBet || 0, streetBetAmount: p.bet || 0,
      status: p.lastAction || '', isDealer: !!o.isDealer, isSmallBlind: !!o.isSmallBlind, isBigBlind: !!o.isBigBlind,
      isFolded: !!p.folded, isAllIn: !!p.allIn, isThinking: !!o.isThinking, timerPercent: o.timerPercent != null ? o.timerPercent : 0,
      holeCardsVisible: !!o.holeCardsVisible, holeCardsBackVisible: !!o.holeCardsBackVisible, holeCards: (p.hole || []).slice(),
      bestCardIds: (o.bestCardIds || []).slice(), isWinner: !!o.isWinner, winAmount: p.winThisHand || 0,
      winStreak: o.winStreak || 0, isTrustee: !!o.isTrustee || !!p.out,
      quickWord: o.quickWord || null, quickWordExpiresAt: o.quickWordExpiresAt || 0,
      emojiId: o.emojiId || null, giftId: o.giftId || null,
      chipAnchor: o.chipAnchor || null, potAnchor: o.potAnchor || null,
    };
  }
  return { build };
});
