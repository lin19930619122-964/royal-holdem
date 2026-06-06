/* CardRow —— live 牌位行渲染器（CardSlot 体系的实际使用方）。
   被 SeatLayer / PlayerHandLayer / CommunityCardLayer 调用，把一行牌渲染进容器，并持有每张牌的 CardSlot。
   关键(D)：有布局(真实浏览器)且 fresh 发牌时，先渲染牌背(reserved，不显示最终牌面)，真实牌元素自牌堆锚点飞入(flyFrom)，
   到达后才 reveal 牌面；无布局(jsdom)或 reducedMotion 时直接渲染最终态(同步)，保证回归测试与无障碍。
   不再创建与真实牌无关的幽灵假牌。data-ck / best5 / dimmed / highlighted 仍由真实 .card 元素承载。 */
(function (root, factory) {
  const req = (typeof require !== 'undefined');
  const CardSlot = req ? require('../../gamefeel/CardSlot.js') : (window.RHCore && window.RHCore.CardSlot);
  const m = factory(CardSlot);
  if (typeof module !== 'undefined' && module.exports) module.exports = m;
  if (typeof window !== 'undefined') (window.RHCore = window.RHCore || {}).CardRow = m;
})(this, function (CardSlot) {
  function hasLayout(el) { try { return !!(el.getBoundingClientRect && el.getBoundingClientRect().width > 0); } catch (e) { return false; } }
  function mkSlots(container, ownerType, seatIndex, revealedArr) {
    const slots = []; const kids = Array.from(container.children);
    kids.forEach((el, i) => {
      const s = CardSlot ? CardSlot.create(el, { ownerType, seatIndex, cardIndex: i }) : null;
      if (s) { revealedArr[i] ? s.set('revealed') : s.set('reserved'); }
      slots.push(s);
    });
    container._slots = slots; return slots;
  }
  // opts: { count, faceHTML:[str], backHTML:[str], revealed:bool|[bool], fresh, deckAnchor, reducedMotion, sig,
  //         ownerType:'hero'|'opponent'|'board', seatIndex, stepMs, durMs }
  function render(container, opts) {
    if (!container) return null;
    opts = opts || {};
    if (opts.sig != null && container._rowSig === opts.sig) return container._slots || null;
    container._rowSig = opts.sig;
    const n = opts.count || 0;
    const faces = opts.faceHTML || [], backs = opts.backHTML || [];
    const revealedArr = Array.isArray(opts.revealed) ? opts.revealed.slice() : new Array(n).fill(!!opts.revealed);
    if (n === 0) { container.innerHTML = ''; container._slots = []; return []; }
    const freshFrom = opts.freshFrom != null ? opts.freshFrom : (opts.fresh ? 0 : n);  // [freshFrom,n) 的牌才飞入
    const animate = freshFrom < n && hasLayout(container) && !opts.reducedMotion && opts.deckAnchor && typeof requestAnimationFrame === 'function';
    if (!animate) {
      // 同步落地（jsdom / reducedMotion / 非发牌）：直接渲染最终态
      let html = '';
      for (let i = 0; i < n; i++) html += (revealedArr[i] ? (faces[i] || '') : (backs[i] || ''));
      container.innerHTML = html;
      return mkSlots(container, opts.ownerType, opts.seatIndex, revealedArr);
    }
    // 已落地的旧牌渲染最终态；[freshFrom,n) 新牌先牌背(reserved,不显示牌面)，真实牌自牌堆飞入，到达后 reveal
    let html = '';
    for (let i = 0; i < n; i++) html += (i < freshFrom ? (revealedArr[i] ? (faces[i] || '') : (backs[i] || '')) : (backs[i] || ''));
    container.innerHTML = html;
    const initRevealed = revealedArr.map((r, i) => (i < freshFrom ? r : false));
    const slots = mkSlots(container, opts.ownerType, opts.seatIndex, initRevealed);
    const step = opts.stepMs || 90, dur = opts.durMs || 320;
    Array.from(container.children).forEach((el, i) => {
      if (i < freshFrom) return;                              // 旧牌不重飞
      if (el.classList && el.classList.remove) el.classList.remove('deal-in');  // 飞行由 flyFrom 主导，避免与 deal-in 关键帧抢 transform
      const slot = slots[i];
      if (slot) slot.flyFrom(opts.deckAnchor, dur);           // 真实牌元素从牌堆飞到自身牌位
      const t = (i - freshFrom) * step + dur + 20;
      setTimeout(() => {
        if (revealedArr[i] && faces[i]) el.outerHTML = faces[i];  // 到达后真实牌就地变牌面(无幽灵)
        else if (slot) slot.land();                           // 对手：保持牌背(landed)
      }, t);
    });
    return slots;
  }
  // 摊牌逐家翻面：把某容器的牌从背翻成正面(flip-in 由 faceHTML 携带)，不走牌堆飞行
  function reveal(container, faceHTML, sig) {
    if (!container) return; if (sig != null && container._revSig === sig) return; container._revSig = sig;
    container.innerHTML = (faceHTML || []).join('');
    mkSlots(container, 'opponent', null, new Array((faceHTML || []).length).fill(true));
  }
  function slotsOf(container) { return (container && container._slots) || []; }
  return { render, reveal, slotsOf };
});
