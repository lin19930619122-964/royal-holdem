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
    function stagger(els, cls, step) {
      if (!els || !els.length) return;
      els.forEach((el, i) => { if (!el || !el.classList) return; el.classList.remove(cls); void (el.offsetWidth || 0); el.style.animationDelay = (i * (step || 90)) + 'ms'; el.classList.add(cls); });
    }
    // 底牌逐张：从牌堆锚点飞向每个座位的卡位(60-120ms 间隔)，落位后 deal-in 接手
    function dealHole(seatIndices) {
      if (!stage.seatCardEls) return;
      let order = 0;
      (seatIndices || []).forEach((si) => {
        const els = stage.seatCardEls(si) || [];
        els.forEach((el) => {
          if (!el || !el.classList) return;
          const delay = order * 90; order++;
          el.style.animationDelay = delay + 'ms'; el.classList.add('deal-in');
          if (stage.flyDealCard) stage.flyDealCard(el, delay);   // 真实牌堆→卡位飞行
        });
      });
    }
    // 公共牌：从牌堆锚点飞到公共牌位再翻开；flop 三张依次、turn/river 单张
    function revealBoard(street) {
      if (!stage.boardCardEls) return;
      const els = stage.boardCardEls() || [];
      const range = street === 'flop' ? els.slice(0, 3) : street === 'turn' ? els.slice(3, 4) : els.slice(4, 5);
      stagger(range, 'flip-in', street === 'flop' ? 140 : 0);
      if (stage.flyDealCard) range.forEach((el, i) => stage.flyDealCard(el, i * 140));
    }
    return { dealHole, revealBoard, stagger };
  }
  return { create };
});
