/* CardSlot —— live 牌位模型 + 状态机：empty → reserved → flying → landed → revealed (→ dimmed/highlighted)。
   关键：reserved/flying/landed 时不显示最终牌面；reveal() 才注入真实牌面(hydrate)。
   真实牌元素(cardEl)自身从牌堆锚点飞到牌位(CSS transform)，不再用与真实牌无关的幽灵假牌。 */
(function (root, factory) {
  const m = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = m;
  if (typeof window !== 'undefined') (window.RHCore = window.RHCore || {}).CardSlot = m;
})(this, function () {
  const STATES = ['empty', 'reserved', 'flying', 'landed', 'revealed', 'dimmed', 'highlighted'];
  let _seq = 0;
  // meta: { ownerType:'hero'|'opponent'|'board', ownerId, seatIndex, cardId, faceUp, anchorEl, backHTML, faceHTML }
  function create(el, meta) {
    meta = meta || {};
    const data = {
      slotId: meta.slotId || ('slot' + (++_seq)), ownerType: meta.ownerType || 'board', ownerId: meta.ownerId,
      seatIndex: meta.seatIndex, cardId: meta.cardId || null, faceUp: !!meta.faceUp, state: 'empty',
      anchorEl: meta.anchorEl || null, cardEl: el || null, isBestFive: false, isDimmed: false, isHighlighted: false,
    };
    function tgl(cl, name, on) { if (cl.toggle) cl.toggle(name, !!on); else if (on) { cl.add && cl.add(name); } else { cl.remove && cl.remove(name); } }
    function applyClass() {
      if (!el || !el.classList) return;
      const cl = el.classList;
      STATES.forEach((x) => cl.remove && cl.remove('slot-' + x));
      cl.add && cl.add('slot-' + data.state);
      tgl(cl, 'best5', data.isBestFive);
      tgl(cl, 'slot-dimmed', data.isDimmed);
      if (el.dataset) el.dataset.slot = data.state;
    }
    function set(s) { data.state = s; applyClass(); return api; }
    function reserve(backHTML) { if (el) el.innerHTML = backHTML != null ? backHTML : '<span class="slot-ph"></span>'; data.cardId = null; return set('reserved'); }
    function land() { return set('landed'); }
    function reveal(faceHTML, cardId) { if (el && faceHTML != null) el.innerHTML = faceHTML; if (cardId != null) data.cardId = cardId; data.faceUp = true; return set('revealed'); }
    function showBack(backHTML) { if (el && backHTML != null) el.innerHTML = backHTML; data.faceUp = false; return set('revealed'); }
    // 真实牌从 anchor(牌堆) 飞到自身牌位：先把 cardEl transform 到 anchor 位置，再过渡回原位
    function flyFrom(anchorEl, durMs) {
      set('flying');
      try {
        if (!el || !anchorEl || typeof el.getBoundingClientRect !== 'function') return api;
        const a = anchorEl.getBoundingClientRect(), b = el.getBoundingClientRect();
        if ((!b.width && !b.height) || typeof requestAnimationFrame !== 'function') return api;  // 无布局(jsdom)：跳过视觉
        const dx = a.left - b.left, dy = a.top - b.top, dur = durMs || 320;
        el.style.transition = 'none'; el.style.transform = `translate(${dx}px,${dy}px) scale(.6)`; el.style.opacity = '0.85';
        void el.offsetWidth;
        requestAnimationFrame(() => { el.style.transition = `transform ${dur}ms cubic-bezier(.2,.8,.3,1.05), opacity ${dur}ms`; el.style.transform = 'none'; el.style.opacity = '1'; });
      } catch (e) { /* ignore */ }
      return api;
    }
    function bestFive(on) { data.isBestFive = !!on; applyClass(); return api; }
    function dim(on) { data.isDimmed = !!on; applyClass(); return api; }
    function highlight(on) { data.isHighlighted = !!on; if (el && el.classList) tgl(el.classList, 'slot-highlighted', on); return api; }
    function reset() { if (el) el.innerHTML = ''; data.cardId = null; data.isBestFive = data.isDimmed = data.isHighlighted = false; return set('empty'); }
    const api = {
      reserve, fly: () => set('flying'), flyFrom, land, reveal, showBack, dim, bestFive, highlight, reset, set,
      get state() { return data.state; }, get data() { return data; }, el: () => el,
    };
    return api;
  }
  return { create, STATES };
});
