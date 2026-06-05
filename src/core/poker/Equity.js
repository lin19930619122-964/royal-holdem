/* Equity —— 纯函数蒙特卡洛胜率（注入 rng，可复现）。win/tie/lose 占比。
   供 BotDecisionEngine 与 TrainingAdvisor 复用同一评估。无 UI。 */
(function (root, factory) {
  const req = (typeof require !== 'undefined');
  const Deck = req ? require('./Deck.js') : window.RHCore.Deck;
  const HandEvaluator = req ? require('./HandEvaluator.js') : window.RHCore.HandEvaluator;
  const m = factory(Deck, HandEvaluator);
  if (typeof module !== 'undefined' && module.exports) module.exports = m;
  if (typeof window !== 'undefined') (window.RHCore = window.RHCore || {}).Equity = m;
})(this, function (Deck, HandEvaluator) {
  const ck = (c) => c.rank + c.suit;
  // opts: { hero:[Card,Card], board:Card[], opponents, samples, rng:()=>[0,1), dead?:Card[] }
  function estimate(opts) {
    const hero = opts.hero, board = opts.board || [];
    const opponents = Math.max(1, opts.opponents | 0);
    const samples = opts.samples || 500;
    const rng = opts.rng || Math.random;
    const used = new Set(hero.concat(board, opts.dead || []).map(ck));
    const full = Deck.create().filter((c) => !used.has(ck(c)));
    const need = 5 - board.length, draw = opponents * 2 + need;
    if (draw > full.length) return { win: 0.5, tie: 0, lose: 0.5 };
    let win = 0, tie = 0, lose = 0;
    for (let s = 0; s < samples; s++) {
      const d = full.slice();
      for (let i = 0; i < draw; i++) { const j = i + Math.floor(rng() * (d.length - i)); const t = d[i]; d[i] = d[j]; d[j] = t; }
      const comm = need ? board.concat(d.slice(0, need)) : board;
      const my = HandEvaluator.evaluateBest(hero.concat(comm)).score;
      let best = true, tied = false, idx = need;
      for (let o = 0; o < opponents; o++) {
        const os = HandEvaluator.evaluateBest([d[idx++], d[idx++]].concat(comm)).score;
        const c = HandEvaluator.compare(my, os);
        if (c < 0) { best = false; break; } if (c === 0) tied = true;
      }
      if (!best) lose++; else if (tied) tie++; else win++;
    }
    return { win: win / samples, tie: tie / samples, lose: lose / samples };
  }
  return { estimate };
});
