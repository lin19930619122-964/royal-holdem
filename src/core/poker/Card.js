/* Card —— 单张牌的构造与展示。纯逻辑，无 UI。 */
(function (root, factory) {
  const m = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = m;
  if (typeof window !== 'undefined') (window.RHCore = window.RHCore || {}).Card = m;
})(this, function () {
  const SUIT_SYMBOL = { s: '♠', h: '♥', d: '♦', c: '♣' };
  const SUIT_RED = { h: true, d: true };
  const RANK_LABEL = { 14: 'A', 13: 'K', 12: 'Q', 11: 'J', 10: '10', 9: '9', 8: '8', 7: '7', 6: '6', 5: '5', 4: '4', 3: '3', 2: '2' };
  const RANK_FROM = { A: 14, K: 13, Q: 12, J: 11, T: 10 };

  function make(rank, suit) { return { rank, suit }; }
  function key(c) { return c.rank + c.suit; }
  function isRed(c) { return !!SUIT_RED[c.suit]; }
  function rankLabel(r) { return RANK_LABEL[r]; }
  function suitSymbol(s) { return SUIT_SYMBOL[s]; }
  function label(c) { return RANK_LABEL[c.rank] + SUIT_SYMBOL[c.suit]; }
  // 'As' / 'Td' / '9h' → {rank,suit}
  function parse(str) {
    const r = str.slice(0, -1), s = str.slice(-1);
    const rank = RANK_FROM[r] != null ? RANK_FROM[r] : +r;
    return { rank, suit: s };
  }
  return { make, key, isRed, label, rankLabel, suitSymbol, parse, SUIT_SYMBOL, RANK_LABEL };
});
