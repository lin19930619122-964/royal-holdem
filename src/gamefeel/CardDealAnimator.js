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
    // 底牌逐张飞入（每个座位 2 张，跨座位再错开）
    function dealHole(seatIndices) {
      if (!stage.seatCardEls) return;
      (seatIndices || []).forEach((si, k) => { const els = stage.seatCardEls(si) || []; els.forEach((el, j) => { if (el && el.classList) { el.style.animationDelay = (k * 60 + j * 110) + 'ms'; el.classList.add('deal-in'); } }); });
    }
    // 公共牌翻开：flop 三张依次、turn/river 单张
    function revealBoard(street) {
      if (!stage.boardCardEls) return;
      const els = stage.boardCardEls() || [];
      if (street === 'flop') stagger(els.slice(0, 3), 'flip-in', 140);
      else if (street === 'turn') stagger(els.slice(3, 4), 'flip-in', 0);
      else if (street === 'river') stagger(els.slice(4, 5), 'flip-in', 0);
    }
    return { dealHole, revealBoard, stagger };
  }
  return { create };
});
