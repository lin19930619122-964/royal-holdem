/* TableFeltLayer —— 牌桌分层组件(独立模块)。接口：mount/render/update/destroy + el()。 */
(function (root, factory) {
  const req = (typeof require !== 'undefined');
  const Base = req ? require('./_base.js') : window.RHCore.LayerBase;
  const m = factory(Base);
  if (typeof module !== 'undefined' && module.exports) module.exports = m;
  if (typeof window !== 'undefined') (window.RHCore = window.RHCore || {}).TableFeltLayer = m;
})(this, function (Base) {
  function create() { return Base.make('TableFeltLayer', { id: 'table-felt', onRender: (el, vm) => { if (vm && vm.feltSkin != null) el.dataset.felt = String(vm.feltSkin); } }); }
  return { create };
});
