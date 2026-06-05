/* SeatView —— 单座位组件，含成熟牌桌所需的全部子节点（22 项）。
   返回一个 DOM 元素 + 一组命名子节点引用，供 render/GameFeel 更新与定位。
   保留旧渲染循环依赖的类名(.player-cards/.turn-ring/.blind-badge/.winner-badge/.hand-name/.last-action/.pname/.pchips/.av-img/.av-emoji)以兼容回归。
   无业务逻辑：只建结构 + 提供 update/标记方法。 */
(function (root, factory) {
  const m = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = m;
  if (typeof window !== 'undefined') (window.RHCore = window.RHCore || {}).SeatView = m;
})(this, function () {
  function el(tag, cls, html) { const d = document.createElement(tag); if (cls) d.className = cls; if (html != null) d.innerHTML = html; return d; }
  // 子节点清单（22）：与说明书一一对应
  const NODES = ['avatar', 'avatarFrame', 'nicknameLabel', 'stackLabel', 'betAmountLabel', 'betChipStackNode',
    'stateLabel', 'timerRing', 'dealerButton', 'blindBadge', 'holeCardBack0', 'holeCardBack1', 'foldMask',
    'winnerGlow', 'bestHandGlow', 'winStreakBadge', 'trusteeIcon', 'quickWordBubble', 'emojiMount', 'giftMount',
    'chipToPotAnchor', 'chipToWinnerAnchor'];

  function build(seatIndex, opts) {
    opts = opts || {};
    const seat = el('div', 'seat seat-view');
    seat.dataset.seat = String(seatIndex);
    const n = {};

    // 顶部覆盖：连胜徽标 + 赢家徽标 + 牌型名 + 状态(动作)文字
    n.winStreakBadge = el('div', 'win-streak-badge hidden');
    const winnerBadge = el('div', 'winner-badge hidden');           // 旧循环用：派彩数额
    n.handNameLabel = el('div', 'hand-name hidden');                // 牌型名
    n.stateLabel = el('div', 'last-action');                        // 状态/动作文字（旧 .last-action）

    // 手牌容器 + 两张牌位（holeCardBack0/1）
    const cards = el('div', 'player-cards');
    n.holeCardBack0 = el('div', 'hole-slot hole-slot-0');
    n.holeCardBack1 = el('div', 'hole-slot hole-slot-1');
    // 旧渲染循环直接写 cards.innerHTML；slot 作为可选定位锚（不强制使用）

    // 玩家盒：头像(框/倒计时环/盲注/庄D) + 资料(称号/昵称/筹码)
    const box = el('div', 'player-box');
    const avatar = el('div', 'avatar');
    n.timerRing = el('span', 'turn-ring hidden');
    n.avatarFrame = el('span', 'avatar-frame');
    n.avatar = el('img', 'av-img'); n.avatar.setAttribute('onerror', "this.style.display='none'");
    if (opts.avatarSrc) n.avatar.src = opts.avatarSrc;
    n.avatarEmoji = el('span', 'av-emoji');
    n.blindBadge = el('span', 'blind-badge hidden');
    n.dealerButton = el('span', 'seat-dealer hidden', 'D');
    avatar.append(n.timerRing, n.avatarFrame, n.avatar, n.avatarEmoji, n.blindBadge, n.dealerButton);
    const info = el('div', 'pinfo');
    n.titleLabel = el('span', 'ptitle hidden');
    n.nicknameLabel = el('span', 'pname');
    n.stackLabel = el('span', 'pchips');
    info.append(n.titleLabel, n.nicknameLabel, n.stackLabel);
    box.append(avatar, info);
    n.trusteeIcon = el('span', 'trustee-icon hidden', '💤');        // 托管图标
    box.append(n.trusteeIcon);

    // 下注显示：筹码堆节点 + 金额
    n.betChipStackNode = el('div', 'bet-chip-stack hidden');
    n.betAmountLabel = el('div', 'bet-tag hidden');

    // 覆盖效果层：弃牌灰罩 / 赢家光晕 / 最佳五张光晕
    n.foldMask = el('div', 'fold-mask hidden');
    n.winnerGlow = el('div', 'winner-glow hidden');
    n.bestHandGlow = el('div', 'best-hand-glow hidden');

    // 社交挂点：快捷语气泡 / 表情 / 礼物
    n.quickWordBubble = el('div', 'quick-word-bubble hidden');
    n.emojiMount = el('div', 'emoji-mount');
    n.giftMount = el('div', 'gift-mount');

    // 筹码飞行锚点
    n.chipToPotAnchor = el('span', 'chip-to-pot-anchor');
    n.chipToWinnerAnchor = el('span', 'chip-to-winner-anchor');

    seat.append(
      n.foldMask, n.winnerGlow, n.bestHandGlow,
      n.winStreakBadge, winnerBadge, n.handNameLabel, n.stateLabel,
      cards, box, n.betChipStackNode, n.betAmountLabel,
      n.quickWordBubble, n.emojiMount, n.giftMount, n.chipToPotAnchor, n.chipToWinnerAnchor
    );
    n.cards = cards; n.winnerBadge = winnerBadge; n.root = seat;
    seat._nodes = n;
    return { root: seat, nodes: n };
  }
  function nodesOf(seatEl) { return seatEl && seatEl._nodes; }
  return { build, nodesOf, NODES };
});
