/* SeatLayer —— 牌桌座位层。负责：全座位的表现落地(头像/昵称/称号/筹码/弃牌/行动/盲注/倒计时/下注堆/赢家/牌型/SeatView 富节点)
   + 对手座位(seatIndex>0)的底牌位(牌背/摊牌揭示，经 CardRow 持有 CardSlot)。ui.js 不再循环渲染座位。
   接口：mount/render/update/destroy + el()。 */
(function (root, factory) {
  const req = (typeof require !== 'undefined');
  const Base = req ? require('./_base.js') : window.RHCore.LayerBase;
  const CardRow = req ? require('../CardRow.js') : (window.RHCore && window.RHCore.CardRow);
  const m = factory(Base, CardRow);
  if (typeof module !== 'undefined' && module.exports) module.exports = m;
  if (typeof window !== 'undefined') (window.RHCore = window.RHCore || {}).SeatLayer = m;
})(this, function (Base, CardRow) {
  function applySeat(el, s) {
    if (!el) return;
    const q = (sel) => el.querySelector(sel);
    const ae = q('.av-emoji'); if (ae) ae.textContent = s.avatarEmoji;
    const pname = q('.pname'); if (pname) { pname.classList.toggle('is-human', s.isHuman); pname.textContent = s.name; }
    const ptl = q('.ptitle'); if (ptl) { if (s.title) { ptl.textContent = s.title.text; ptl.style.color = s.title.color; ptl.classList.remove('hidden'); } else ptl.classList.add('hidden'); }
    const pch = q('.pchips'); if (pch) pch.textContent = s.chips;
    el.classList.toggle('folded', s.folded);
    el.classList.toggle('active', s.active);
    const bb = q('.blind-badge'); if (bb) { bb.textContent = s.blind; bb.classList.toggle('hidden', !s.blind); }
    const ring = q('.turn-ring'); if (ring) { if (s.humanThinking) ring.classList.remove('hidden'); else { ring.classList.add('hidden'); ring.style.animation = 'none'; } }
    const la = q('.last-action'); if (la) { la.textContent = s.lastAction; la.className = 'last-action'; if (s.laClass) la.classList.add(s.laClass); if (s.laPop) la.classList.add('pop'); }
    const wbadge = q('.winner-badge'); if (wbadge) { if (s.winnerBadge) { wbadge.classList.remove('hidden'); wbadge.textContent = s.winnerBadge; } else wbadge.classList.add('hidden'); }
    const hn = q('.hand-name'); if (hn) { if (s.handName) { hn.textContent = s.handName; hn.classList.remove('hidden'); } else hn.classList.add('hidden'); }
    if (window.RHCore && window.RHCore.SeatView && s.pvm) { try { window.RHCore.SeatView.update(el, s.pvm); } catch (e) {} }
  }
  function create() {
    return Base.make('SeatLayer', { id: 'seats', onRender: (el, vm) => {
      if (!vm || !vm.seats || !vm.ctx) return;
      vm.seats.forEach((s) => {
        if (!s) return;
        const seatEl = vm.ctx.seatEl && vm.ctx.seatEl(s.seatIndex);
        applySeat(seatEl, s);
        // 座位前下注筹码堆
        const betEl = vm.ctx.betEl && vm.ctx.betEl(s.seatIndex);
        if (betEl) { if (s.betHTML) { betEl.classList.remove('hidden'); betEl.innerHTML = s.betHTML; } else betEl.classList.add('hidden'); }
        // 对手底牌位(英雄交 PlayerHandLayer)
        if (!s.isHero && CardRow) {
          const c = vm.ctx.seatCardEl && vm.ctx.seatCardEl(s.seatIndex);
          if (c) CardRow.render(c, { count: s.count, faceHTML: s.faceHTML, backHTML: s.backHTML, revealed: s.revealed, fresh: s.fresh, sig: s.sig, ownerType: 'opponent', seatIndex: s.seatIndex, deckAnchor: vm.ctx.deckAnchorEl && vm.ctx.deckAnchorEl(), reducedMotion: vm.ctx.reducedMotion });
        }
      });
    } });
  }
  return { create };
});
