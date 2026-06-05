/* CardDealAnimator —— 发牌动效：底牌逐张飞入座位、公共牌逐张翻开。
   通过 stage 注入：seatCardEls(i)→[card els], boardCardEls()→[card els]。给卡牌加 deal-in/flip-reveal 类，
   按序错开 animation-delay。实际 keyframes 在 styles.css。无 DOM 时安全跳过。 */
(function (root, factory) {
  const m = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = m;
  if (typeof window !== 'undefined') (window.RHCore = window.RHCore || {}).CardDealAnimator = m;
})(this, function () {
  function create(stage) {
    stage = stage || {};
    const STEP = 90, DUR = 320;     // 每张间隔 90ms（60-120ms 区间）、飞行 320ms
    let _order = [];
    function stagger(els, cls, step) {
      if (!els || !els.length) return;
      els.forEach((el, i) => { if (!el || !el.classList) return; el.classList.remove(cls); void (el.offsetWidth || 0); el.style.animationDelay = (i * (step || 90)) + 'ms'; el.classList.add(cls); });
    }
    // 底牌逐张：deckAnchor → 每个座位 holeCardBack0/1（seatCardAnchor）。带 from/to/delay/duration/onComplete。
    function dealHoleCards(seatIndices) {
      _order = [];
      if (!stage.seatCardEls) return;
      let idx = 0; const seats = seatIndices || [];
      seats.forEach((si) => {
        const els = stage.seatCardEls(si) || [];
        els.forEach((el, j) => {
          if (!el || !el.classList) return;
          const delay = idx * STEP; idx++;
          _order.push({ type: 'hole', seat: si, cardIndex: j, delay, duration: DUR });
          el.style.animationDelay = delay + 'ms'; el.classList.add('deal-in');
          flyTo(el, delay, DUR);
        });
      });
    }
    function flyTo(toEl, delay, duration, onComplete) {
      if (stage.flyDealCard) stage.flyDealCard(toEl, delay, duration, onComplete);
      else if (onComplete && typeof setTimeout === 'function') setTimeout(onComplete, (delay || 0) + (duration || 0));
      else if (onComplete) onComplete();
    }
    function boardReveal(street) {
      if (!stage.boardCardEls) return [];
      const els = stage.boardCardEls() || [];
      const range = street === 'flop' ? els.slice(0, 3) : street === 'turn' ? els.slice(3, 4) : els.slice(4, 5);
      stagger(range, 'flip-in', street === 'flop' ? 140 : 0);
      _order = range.map((el, i) => ({ type: street, cardIndex: i, delay: i * 140, duration: DUR }));
      range.forEach((el, i) => flyTo(el, i * 140, DUR));
      return range;
    }
    function dealFlop() { return boardReveal('flop'); }
    function dealTurn() { return boardReveal('turn'); }
    function dealRiver() { return boardReveal('river'); }
    function lastOrder() { return _order.slice(); }
    return { dealHoleCards, dealHole: dealHoleCards, dealFlop, dealTurn, dealRiver, revealBoard: boardReveal, stagger, lastOrder };
  }
  return { create };
});
