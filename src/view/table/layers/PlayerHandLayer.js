/* PlayerHandLayer —— 英雄手牌层。负责英雄座位(seatIndex===0)两张底牌位渲染，经 CardRow 持有 CardSlot。
   发牌时：reserved(牌背) → 自牌堆飞入 → 到达 reveal 牌面。ui.js 不再直接拼 hero 手牌 DOM。 */
(function (root, factory) {
  const req = (typeof require !== 'undefined');
  const Base = req ? require('./_base.js') : window.RHCore.LayerBase;
  const CardRow = req ? require('../CardRow.js') : (window.RHCore && window.RHCore.CardRow);
  const m = factory(Base, CardRow);
  if (typeof module !== 'undefined' && module.exports) module.exports = m;
  if (typeof window !== 'undefined') (window.RHCore = window.RHCore || {}).PlayerHandLayer = m;
})(this, function (Base, CardRow) {
  function create() {
    return Base.make('PlayerHandLayer', { id: 'seats', onRender: (el, vm) => {
      if (!vm || !vm.seats || !vm.ctx || !CardRow) return;
      const s = vm.seats.find((x) => x && x.isHero); if (!s) return;
      const c = vm.ctx.seatCardEl && vm.ctx.seatCardEl(s.seatIndex); if (!c) return;
      CardRow.render(c, {
        count: s.count, faceHTML: s.faceHTML, backHTML: s.backHTML, revealed: s.revealed, fresh: s.fresh,
        sig: s.sig, ownerType: 'hero', seatIndex: s.seatIndex,
        deckAnchor: vm.ctx.deckAnchorEl && vm.ctx.deckAnchorEl(), reducedMotion: vm.ctx.reducedMotion,
      });
    } });
  }
  return { create };
});
