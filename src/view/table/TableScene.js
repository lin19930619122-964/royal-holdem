/* TableScene —— 牌桌场景装配器。只负责：装配 14 个独立 Layer 组件、转发 GameState/ViewModel、销毁。
   不再拼接 seat/card/chip/action 的 HTML 细节（那些在各 Layer / SeatView / ActionPanel 内）。 */
(function (root, factory) {
  const req = (typeof require !== 'undefined');
  const L = (n) => (req ? require('./layers/' + n + '.js') : window.RHCore[n]);
  const NAMES = ['TableBackgroundLayer', 'TableFeltLayer', 'SeatLayer', 'DealerButtonLayer', 'CommunityCardLayer',
    'PotLayer', 'BetChipLayer', 'PlayerHandLayer', 'ActionPanelLayer', 'TrainingAssistantLayer',
    'ChatEmojiLayer', 'GiftAnimationLayer', 'HistoryLayer', 'ModalLayer'];
  const mods = {}; NAMES.forEach((n) => { mods[n] = L(n); });
  const m = factory(mods, NAMES);
  if (typeof module !== 'undefined' && module.exports) module.exports = m;
  if (typeof window !== 'undefined') (window.RHCore = window.RHCore || {}).TableScene = m;
})(this, function (mods, NAMES) {
  let assembled = null;

  // 装配：实例化并挂载 14 层，返回 { layers, get, el, render, update, destroy }
  function assemble() {
    const layers = {};
    NAMES.forEach((n) => { const inst = mods[n].create(); inst.mount(); layers[n] = inst; });
    assembled = {
      layers,
      get: (n) => layers[n],
      el: (n) => layers[n] && layers[n].el(),
      render: (vm) => { NAMES.forEach((n) => layers[n].render(vm || {})); return assembled; },
      update: (vm) => { NAMES.forEach((n) => layers[n].update(vm || {})); return assembled; },
      destroy: () => { NAMES.forEach((n) => layers[n].destroy()); assembled = null; },
    };
    return assembled;
  }
  // 向后兼容：ensure() 返回已装配场景（首次装配，幂等）
  function ensure() { return assembled || assemble(); }
  return { LAYERS: NAMES, assemble, ensure, current: () => assembled };
});
