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
    // 庄家按钮为桌级单一可移动标记(DealerButtonLayer/#dealer-button)，不在座位内重复
    n.dealerButton = null;
    avatar.append(n.timerRing, n.avatarFrame, n.avatar, n.avatarEmoji, n.blindBadge);
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

  // 由 PlayerViewModel 驱动「此前空占位」的节点：有数据则显示，无数据则隐藏。
  function update(seatEl, vm) {
    const n = seatEl && seatEl._nodes; if (!n || !vm) return;
    const toggle = (el, on) => { if (el) el.classList.toggle('hidden', !on); };
    // 头像框：有真实 frameId(非 'none') → 显示并套用主题类
    if (n.avatarFrame) { const on = !!vm.avatarFrameId && vm.avatarFrameId !== 'none'; n.avatarFrame.classList.toggle('has-frame', on); if (on) n.avatarFrame.dataset.frame = String(vm.avatarFrameId); }
    // 连胜徽标
    if (n.winStreakBadge) { const on = (vm.winStreak || 0) >= 2; toggle(n.winStreakBadge, on); if (on) n.winStreakBadge.textContent = '🔥' + vm.winStreak; }
    // 托管图标
    toggle(n.trusteeIcon, !!vm.isTrustee);
    // 弃牌灰罩 / 赢家光晕 / 最佳五张光晕
    toggle(n.foldMask, !!vm.isFolded);
    toggle(n.winnerGlow, !!vm.isWinner);
    toggle(n.bestHandGlow, (vm.bestCardIds || []).length > 0);
    // 倒计时环：思考时显示并按 timerPercent 设宽度变量
    if (n.timerRing) { toggle(n.timerRing, !!vm.isThinking); if (vm.isThinking) n.timerRing.style.setProperty('--timer', Math.max(0, Math.min(100, vm.timerPercent || 0)) + '%'); }
    // 盲注/庄家
    if (n.blindBadge) { const lab = vm.isSmallBlind ? 'SB' : vm.isBigBlind ? 'BB' : ''; toggle(n.blindBadge, !!lab); if (lab) n.blindBadge.textContent = lab; }
    // dealerButton 由桌级 DealerButtonLayer(#dealer-button) 驱动，座位内不重复
    // 座位下注筹码堆(数据=本街下注)
    if (n.betChipStackNode) { const on = (vm.streetBetAmount || 0) > 0; toggle(n.betChipStackNode, on); if (on) n.betChipStackNode.dataset.amt = String(vm.streetBetAmount); }
    // 快捷语气泡：有文字则显示并定时清除
    if (n.quickWordBubble && vm.quickWord) { showBubble(n.quickWordBubble, vm.quickWord); }
  }
  function showBubble(el, text) {
    el.textContent = text; el.classList.remove('hidden');
    if (el._t && typeof clearTimeout === 'function') clearTimeout(el._t);
    if (typeof setTimeout === 'function') el._t = setTimeout(() => el.classList.add('hidden'), 2600);
  }
  // 一次性表情/礼物：插入挂点并自动移除
  function popMount(seatEl, which, html, ms) {
    const n = seatEl && seatEl._nodes; if (!n) return;
    const mount = which === 'gift' ? n.giftMount : n.emojiMount; if (!mount) return;
    mount.innerHTML = `<span class="pop-anim">${html}</span>`;
    if (typeof setTimeout === 'function') setTimeout(() => { mount.innerHTML = ''; }, ms || 1800);
  }
  return { build, nodesOf, update, showBubble, popMount, NODES };
});
