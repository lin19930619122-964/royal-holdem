/* BetChipLayer —— 牌桌分层组件(独立模块)。接口：mount/render/update/destroy + el()。 */
(function (root, factory) {
  const req = (typeof require !== 'undefined');
  const Base = req ? require('./_base.js') : window.RHCore.LayerBase;
  const m = factory(Base);
  if (typeof module !== 'undefined' && module.exports) module.exports = m;
  if (typeof window !== 'undefined') (window.RHCore = window.RHCore || {}).BetChipLayer = m;
})(this, function (Base) {
  function create() { return Base.make('BetChipLayer', { resolve: (d) => { let e = d.getElementById('bet-chip-layer'); if (!e) { e = d.createElement('div'); e.id = 'bet-chip-layer'; e.className = 'tlayer bet-chip-layer'; const p = d.getElementById('table-felt'); if (p) p.appendChild(e); } return e; } }); }
  return { create };
});
