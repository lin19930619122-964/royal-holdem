/* 皇室德州 — AI 决策（原创强算法）
   核心：蒙特卡洛胜率估算(equity) + 底池赔率 + 下注尺度 + 激进度/诈唬个性。
   完全自研，不含任何第三方代码。 */
(function () {
  const P = window.Poker;
  let SIMS = 160; // 每次决策的模拟次数

  function key(c) { return c.rank + c.suit; }

  // 蒙特卡洛：估算 hole 对 numOpp 个随机对手的胜率(含平分一半)
  function equity(hole, board, numOpp, sims) {
    numOpp = Math.max(1, numOpp);
    sims = sims || SIMS;
    const used = new Set(hole.concat(board).map(key));
    const rem = P.createDeck().filter((c) => !used.has(key(c)));
    const need = 5 - board.length;
    const draw = numOpp * 2 + need;
    if (draw > rem.length) return 0.5;
    let win = 0, tie = 0;
    for (let s = 0; s < sims; s++) {
      const d = rem.slice();
      for (let i = 0; i < draw; i++) {
        const j = i + Math.floor(Math.random() * (d.length - i));
        const t = d[i]; d[i] = d[j]; d[j] = t;
      }
      let idx = 0;
      const fullBoard = need ? board.concat(d.slice(0, need)) : board;
      idx = need;
      const myScore = P.evaluateBest(hole.concat(fullBoard)).score;
      let best = true, tied = false;
      for (let o = 0; o < numOpp; o++) {
        const oppHole = [d[idx++], d[idx++]];
        const os = P.evaluateBest(oppHole.concat(fullBoard)).score;
        const cmp = P.compareScores(myScore, os);
        if (cmp < 0) { best = false; break; }
        if (cmp === 0) tied = true;
      }
      if (best) { if (tied) tie++; else win++; }
    }
    return (win + tie * 0.5) / sims;
  }

  function decide(player, ctx) {
    const me = player;
    const board = ctx.board;
    const numOpp = ctx.players.filter((p) => !p.folded && !p.out && p !== me).length || 1;
    const toCall = Math.max(0, ctx.currentBet - me.bet);
    const canCheck = toCall === 0;
    const pot = ctx.pot;
    const bb = ctx.bigBlind;
    const minRaiseTo = ctx.currentBet + ctx.minRaise;
    const maxTo = me.bet + me.chips;
    const canRaise = me.chips > toCall;

    const aggro = me.ai ? me.ai.aggression : 0.5;
    const bluff = me.ai ? me.ai.bluff : 0.1;
    const eq = equity(me.hole, board, Math.min(numOpp, 6));
    const potOdds = toCall > 0 ? toCall / (pot + toCall) : 0;
    const rng = Math.random();

    function mkRaise(fracPot) {
      let target = ctx.currentBet + Math.max(ctx.minRaise, Math.round((pot + toCall) * fracPot));
      target = Math.round(target / bb) * bb;
      target = Math.max(minRaiseTo, Math.min(target, maxTo));
      return { action: 'raise', amount: target };
    }
    const valueFrac = 0.5 + eq * 0.45;
    const bluffFrac = 0.55 + aggro * 0.2;

    if (canCheck) {
      if (eq > 0.8 && rng < 0.25) return { action: 'check' };               // 强牌偶尔慢打
      if ((eq > 0.6 || (eq > 0.48 && rng < aggro)) && canRaise) return mkRaise(valueFrac);
      if (eq < 0.42 && rng < bluff && canRaise && numOpp <= 2) return mkRaise(bluffFrac);
      return { action: 'check' };
    }

    if (eq > potOdds + 0.10) {
      if (eq > 0.72 && canRaise && me.chips > toCall + ctx.minRaise && rng < 0.45 + aggro * 0.4)
        return mkRaise(valueFrac);
      return { action: 'call' };
    }
    if (eq > potOdds) {
      if (toCall <= pot * 0.5 || toCall <= bb * 3 || rng < 0.45) return { action: 'call' };
    }
    if (canRaise && me.chips > toCall + ctx.minRaise && numOpp <= 2 && rng < bluff * 0.6 && eq > 0.2)
      return mkRaise(bluffFrac);
    if (toCall <= bb && eq > 0.3 && rng < 0.5) return { action: 'call' };
    return { action: 'fold' };
  }

  function makePersona() {
    return {
      aggression: 0.3 + Math.random() * 0.55,
      bluff: 0.04 + Math.random() * 0.16,
    };
  }

  function setSims(n) { SIMS = Math.max(10, n | 0); }

  window.PokerAI = { decide, makePersona, equity, setSims };
})();
