/* GiftAnimationLayer —— 牌桌分层组件(独立模块)。接口：mount/render/update/destroy + el()。 */
(function (root, factory) {
  const req = (typeof require !== 'undefined');
  const Base = req ? require('./_base.js') : window.RHCore.LayerBase;
  const m = factory(Base);
  if (typeof module !== 'undefined' && module.exports) module.exports = m;
  if (typeof window !== 'undefined') (window.RHCore = window.RHCore || {}).GiftAnimationLayer = m;
})(this, function (Base) {
  function create() { return Base.make('GiftAnimationLayer', { resolve: (d) => { let e = d.getElementById('gift-anim-layer'); if (!e) { e = d.createElement('div'); e.id = 'gift-anim-layer'; e.className = 'tlayer gift-anim-layer'; const p = d.getElementById('table'); if (p) p.appendChild(e); } return e; } }); }
  return { create };
});
