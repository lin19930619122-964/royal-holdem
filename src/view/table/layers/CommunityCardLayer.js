/* CommunityCardLayer —— 公共牌层。经 CardRow 持有 board 的 CardSlot；翻牌/转牌/河牌逐张自牌堆飞入、到达 reveal。
   只在张数变化时重渲染，并 emit DEAL_FLOP/TURN/RIVER（经 ctx.emit→DealController）。接口：mount/render/update/destroy。 */
(function (root, factory) {
  const req = (typeof require !== 'undefined');
  const Base = req ? require('./_base.js') : window.RHCore.LayerBase;
  const CardRow = req ? require('../CardRow.js') : (window.RHCore && window.RHCore.CardRow);
  const m = factory(Base, CardRow);
  if (typeof module !== 'undefined' && module.exports) module.exports = m;
  if (typeof window !== 'undefined') (window.RHCore = window.RHCore || {}).CommunityCardLayer = m;
})(this, function (Base, CardRow) {
  function create() {
    return Base.make('CommunityCardLayer', { id: 'board', onRender: (el, vm) => {
      if (!vm || !vm.board || !vm.ctx || !vm.ctx.renderCard) return;
      const n = vm.board.length, prev = el._count == null ? -1 : el._count;
      if (prev === n) return;                                        // 只在张数变化时重渲染
      const grew = prev >= 0 && n > prev;
      const faces = vm.board.map((c) => vm.ctx.renderCard(c, false));
      const backs = vm.board.map(() => (vm.ctx.renderBack ? vm.ctx.renderBack(false) : '<div class="card back"></div>'));
      if (CardRow) {
        CardRow.render(el, {
          count: n, faceHTML: faces, backHTML: backs, revealed: true,
          freshFrom: grew ? prev : (prev < 0 ? n : 0), sig: 'b' + n,
          ownerType: 'board', deckAnchor: vm.ctx.deckAnchorEl && vm.ctx.deckAnchorEl(), reducedMotion: vm.ctx.reducedMotion,
          stepMs: 140,
        });
      } else { el.innerHTML = faces.join(''); }
      el._count = n;
      if (grew) { if (vm.ctx.emit) vm.ctx.emit(n === 3 ? 'DEAL_FLOP' : n === 4 ? 'DEAL_TURN' : 'DEAL_RIVER'); else if (vm.ctx.sfxDeal) vm.ctx.sfxDeal(); }
    } });
  }
  return { create };
});
