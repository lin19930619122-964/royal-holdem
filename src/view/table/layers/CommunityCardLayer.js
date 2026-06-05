/* CommunityCardLayer —— 牌桌分层组件(独立模块)。接口：mount/render/update/destroy + el()。 */
(function (root, factory) {
  const req = (typeof require !== 'undefined');
  const Base = req ? require('./_base.js') : window.RHCore.LayerBase;
  const m = factory(Base);
  if (typeof module !== 'undefined' && module.exports) module.exports = m;
  if (typeof window !== 'undefined') (window.RHCore = window.RHCore || {}).CommunityCardLayer = m;
})(this, function (Base) {
  function create() {
    return Base.make('CommunityCardLayer', { id: 'board', onRender: (el, vm) => {
      if (!vm || !vm.board || !vm.ctx || !vm.ctx.renderCard) return;
      if (el._count === vm.board.length) return;                    // 只在张数变化时重渲染
      const grew = el._count != null && vm.board.length > el._count;
      el.innerHTML = vm.board.map((c) => vm.ctx.renderCard(c, false)).join('');
      el._count = vm.board.length;
      if (grew) { const n = vm.board.length; if (vm.ctx.emit) vm.ctx.emit(n === 3 ? 'DEAL_FLOP' : n === 4 ? 'DEAL_TURN' : 'DEAL_RIVER'); else if (vm.ctx.sfxDeal) vm.ctx.sfxDeal(); }
    } });
  }
  return { create };
});
