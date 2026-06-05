/* Deck —— 52 张标准牌的构造与（种子化）洗牌。纯逻辑，无 UI。 */
(function (root, factory) {
  const SeededRng = (typeof require !== 'undefined') ? require('./SeededRng.js') : window.RHCore.SeededRng;
  const m = factory(SeededRng);
  if (typeof module !== 'undefined' && module.exports) module.exports = m;
  if (typeof window !== 'undefined') (window.RHCore = window.RHCore || {}).Deck = m;
})(this, function (SeededRng) {
  const SUITS = ['s', 'h', 'd', 'c'];
  function create() {
    const deck = [];
    for (const s of SUITS) for (let r = 2; r <= 14; r++) deck.push({ rank: r, suit: s });
    return deck;
  }
  // 用给定 rng（SeededRng 实例）做 Fisher-Yates 洗牌，返回新牌堆
  function shuffled(rng) { return rng.shuffle(create()); }
  return { create, shuffled };
});
