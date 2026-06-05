/* DealerButtonLayer —— 牌桌分层组件(独立模块)。接口：mount/render/update/destroy + el()。 */
(function (root, factory) {
  const req = (typeof require !== 'undefined');
  const Base = req ? require('./_base.js') : window.RHCore.LayerBase;
  const m = factory(Base);
  if (typeof module !== 'undefined' && module.exports) module.exports = m;
  if (typeof window !== 'undefined') (window.RHCore = window.RHCore || {}).DealerButtonLayer = m;
})(this, function (Base) {
  function create() {
    return Base.make('DealerButtonLayer', { id: 'dealer-button', onRender: (el, vm) => {
      if (!vm || !vm.ctx || !vm.ctx.SEAT_POS || vm.button == null || vm.button < 0) { el.classList.add('hidden'); return; }
      const pos = vm.ctx.SEAT_POS[vm.button]; if (!pos) { el.classList.add('hidden'); return; }
      el.classList.remove('hidden');
      el.style.left = (pos.x + (50 - pos.x) * 0.26) + '%';
      el.style.top = (pos.y + (50 - pos.y) * 0.24) + '%';
    } });
  }
  return { create };
});
