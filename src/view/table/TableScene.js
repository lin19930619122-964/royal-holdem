/* TableScene —— 牌桌分层注册。把成熟牌桌的 14 层显式化：
   既有 DOM 映射到对应层(打 data-layer 标记)，缺失的覆盖层(下注筹码/聊天表情/礼物动画)按需创建。
   不破坏现有布局/CSS（不强制重排），返回 {layerName: element} 供组件挂载与 GameFeel 定位。 */
(function (root, factory) {
  const m = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = m;
  if (typeof window !== 'undefined') (window.RHCore = window.RHCore || {}).TableScene = m;
})(this, function () {
  const LAYERS = ['TableBackgroundLayer', 'TableFeltLayer', 'SeatLayer', 'DealerButtonLayer', 'CommunityCardLayer',
    'PotLayer', 'BetChipLayer', 'PlayerHandLayer', 'ActionPanelLayer', 'TrainingAssistantLayer',
    'ChatEmojiLayer', 'GiftAnimationLayer', 'HistoryLayer', 'ModalLayer'];
  const $ = (id) => document.getElementById(id);
  function overlay(id, parent, cls) {
    let e = $(id); if (e) return e;
    e = document.createElement('div'); e.id = id; e.className = cls || 'tlayer-overlay';
    if (parent) parent.appendChild(e); return e;
  }
  function ensure() {
    const tableRoot = $('table'), felt = $('table-felt');
    const map = {
      TableBackgroundLayer: tableRoot,
      TableFeltLayer: felt,
      SeatLayer: $('seats'),
      DealerButtonLayer: $('dealer-button'),
      CommunityCardLayer: $('board'),
      PotLayer: $('pot-display'),
      BetChipLayer: felt ? overlay('bet-chip-layer', felt, 'tlayer bet-chip-layer') : null,
      PlayerHandLayer: $('seats'),                 // 手牌随座位（座位内 .player-cards）
      ActionPanelLayer: $('action-area') || $('controls'),
      TrainingAssistantLayer: $('hand-hint'),
      ChatEmojiLayer: tableRoot ? overlay('chat-emoji-layer', tableRoot, 'tlayer chat-emoji-layer') : null,
      GiftAnimationLayer: tableRoot ? overlay('gift-anim-layer', tableRoot, 'tlayer gift-anim-layer') : null,
      HistoryLayer: $('hand-strip'),
      ModalLayer: $('modal-overlay'),
    };
    // 给映射到的元素打 data-layer 标记，便于核查“层级显式化”
    LAYERS.forEach((name) => { const e = map[name]; if (e && e.setAttribute && !e.dataset.layer) e.setAttribute('data-layer', name); });
    return map;
  }
  return { LAYERS, ensure };
});
