/* 皇室德州 — AI 决策 v2（更聪明、更像真人）
   原理（公开扑克策略，原创实现，不含第三方代码）：
   - 蒙特卡洛胜率(equity)
   - 翻牌前：位置感知开牌范围 + 3bet/跟/弃 + 投机手(小对/同花连张)set-mine
   - 翻牌后：底池赔率 + 牌面干湿 + 下注尺度 + 价值/半诈唬/控池/弃牌
   - 短码 push/fold
   - 5 种性格对手(石头/紧凶/松凶/跟注站/疯子)，行为各异更拟真 */
(function () {
  const P = window.Poker;
  let SIMS = 160;

  function ckey(c) { return c.rank + c.suit; }
  function equity(hole, board, numOpp, sims) {
    numOpp = Math.max(1, numOpp); sims = sims || SIMS;
    const used = new Set(hole.concat(board).map(ckey));
    const rem = P.createDeck().filter((c) => !used.has(ckey(c)));
    const need = 5 - board.length, draw = numOpp * 2 + need;
    if (draw > rem.length) return 0.5;
    let win = 0, tie = 0;
    for (let s = 0; s < sims; s++) {
      const d = rem.slice();
      for (let i = 0; i < draw; i++) { const j = i + Math.floor(Math.random() * (d.length - i)); const t = d[i]; d[i] = d[j]; d[j] = t; }
      const full = need ? board.concat(d.slice(0, need)) : board;
      const my = P.evaluateBest(hole.concat(full)).score;
      let best = true, tied = false, idx = need;
      for (let o = 0; o < numOpp; o++) {
        const os = P.evaluateBest([d[idx++], d[idx++]].concat(full)).score;
        const cmp = P.compareScores(my, os);
        if (cmp < 0) { best = false; break; } if (cmp === 0) tied = true;
      }
      if (best) { if (tied) tie++; else win++; }
    }
    return (win + tie * 0.5) / sims;
  }

  function boardWetness(board) {
    const suits = {}; board.forEach((c) => suits[c.suit] = (suits[c.suit] || 0) + 1);
    const maxSuit = Math.max(0, ...Object.values(suits));
    const flushy = maxSuit >= 4 ? 1 : maxSuit === 3 ? 0.6 : maxSuit === 2 ? 0.3 : 0;
    const rs = [...new Set(board.map((c) => c.rank))].sort((a, b) => a - b);
    let straighty = 0;
    for (let i = 0; i < rs.length - 1; i++) if (rs[i + 1] - rs[i] <= 2) straighty += 0.35;
    return Math.min(1, flushy + straighty);
  }

  function decide(player, ctx) {
    const me = player, board = ctx.board, bb = ctx.bigBlind;
    const N = ctx.players.length;
    const numOpp = ctx.players.filter((p) => !p.folded && !p.out && p !== me).length || 1;
    const toCall = Math.max(0, ctx.currentBet - me.bet);
    const canCheck = toCall === 0;
    const pot = ctx.pot;
    const minRaiseTo = ctx.currentBet + ctx.minRaise;
    const maxTo = me.bet + me.chips;
    const canRaise = me.chips > toCall;
    const potOdds = toCall > 0 ? toCall / (pot + toCall) : 0;
    const persona = me.ai || { aggression: 0.55, bluff: 0.12, tight: 0.04 };
    const aggro = persona.aggression, bluff = persona.bluff, tight = persona.tight || 0;
    const rng = Math.random();

    const mkRaiseTo = (t) => ({ action: 'raise', amount: Math.max(minRaiseTo, Math.min(Math.round(t / bb) * bb, maxTo)) });
    const betFrac = (f) => mkRaiseTo(ctx.currentBet + Math.max(ctx.minRaise, Math.round((pot + toCall) * f)));
    const shove = () => ({ action: 'raise', amount: maxTo });

    if (board.length === 0) {
      // ===== 翻牌前 =====
      const sHU = equity(me.hole, [], 1);
      const [a, b] = me.hole;
      const pair = a.rank === b.rank, suited = a.suit === b.suit;
      const hi = Math.max(a.rank, b.rank), lo = Math.min(a.rank, b.rank);
      const connector = !pair && (hi - lo) <= 2 && lo >= 5;
      const dist = (((ctx.button - me.id) % N) + N) % N; // 0=button(最好)
      const isSB = dist === N - 1, isBB = dist === N - 2;
      const late = dist <= 1, middle = dist === 2 || dist === 3;
      const raised = ctx.currentBet > bb * 1.5;
      const bigRaise = ctx.currentBet > bb * 3.5;
      const shortBB = me.chips / bb;
      const speculative = (pair && lo <= 8) || (suited && connector) || (suited && hi === 14);

      // 短码 push/fold
      if (shortBB < 12) {
        if (!raised) {
          if (sHU > 0.58 || (pair && lo >= 6) || (late && sHU > 0.53)) return shove();
          if (canCheck) return { action: 'check' };
          return { action: 'fold' };
        }
        if (sHU > 0.62) return shove();
        return canCheck ? { action: 'check' } : { action: 'fold' };
      }

      let openT = late ? 0.50 : middle ? 0.55 : 0.61;
      if (isSB) openT = 0.52; if (isBB) openT = 0.50;
      openT += tight * 0.04 - (aggro - 0.5) * 0.04;

      if (!raised) {
        if (sHU > 0.66) return betFrac(0.9);                       // 顶级牌：加注
        if (sHU > openT || (speculative && late)) return betFrac(0.7); // 开池 ~2.5-3bb
        if (canCheck) return { action: 'check' };                  // 大盲免费看牌
        if (speculative && toCall <= bb && rng < 0.45) return { action: 'call' };
        return { action: 'fold' };
      } else {
        if (sHU > 0.70) return betFrac(0.95);                      // 3bet 价值(QQ+/AK)
        if (sHU > 0.63 && !bigRaise) return { action: 'call' };    // 强牌跟
        if ((pair || (suited && (connector || hi === 14))) && (late || isBB) && toCall <= me.chips * 0.06)
          return { action: 'call' };                               // set-mine/投机便宜跟
        if (canRaise && late && !bigRaise && rng < bluff * 0.5 && (suited || sHU > 0.55)) return betFrac(0.95);
        if (isBB && toCall <= bb * 2 && sHU > 0.5 && rng < 0.55) return { action: 'call' };
        return { action: 'fold' };
      }
    }

    // ===== 翻牌后 =====
    const eq = equity(me.hole, board, Math.min(numOpp, 6));
    const wet = boardWetness(board);
    const callT = potOdds + 0.05 + tight * 0.03 - (numOpp === 1 ? 0.02 : 0);

    if (canCheck) {
      if (eq > 0.82 && rng < 0.3) return { action: 'check' };       // 陷阱慢打
      if (eq > 0.6 && canRaise) return betFrac(wet > 0.5 ? 0.75 : 0.6);
      if (eq > 0.5 && canRaise && rng < aggro * 0.55) return betFrac(0.5);
      if (eq < 0.45 && canRaise && numOpp <= 2 && rng < bluff + (1 - wet) * 0.15 * aggro) return betFrac(0.55);
      return { action: 'check' };
    }
    // 面对下注
    if (eq > 0.74 && canRaise && me.chips > toCall + ctx.minRaise && rng < 0.5 + aggro * 0.4) return betFrac(wet > 0.5 ? 0.9 : 0.7);
    if (eq > callT) return { action: 'call' };
    if (eq > 0.35 && wet > 0.4 && canRaise && numOpp <= 2 && rng < bluff + aggro * 0.12) return betFrac(0.8); // 听牌半诈唬
    if (eq < 0.3 && wet < 0.3 && canRaise && numOpp === 1 && rng < bluff * 0.5) return betFrac(0.7);          // 干燥面诈唬
    if (toCall <= bb && eq > 0.3 && rng < 0.5) return { action: 'call' };
    return { action: 'fold' };
  }

  // 5 种性格：石头/紧凶/松凶/跟注站/疯子
  const PERSONAS = [
    { style: 'nit', aggression: 0.35, bluff: 0.05, tight: 0.10 },
    { style: 'tag', aggression: 0.62, bluff: 0.12, tight: 0.04 },
    { style: 'lag', aggression: 0.80, bluff: 0.22, tight: -0.06 },
    { style: 'station', aggression: 0.32, bluff: 0.04, tight: -0.08 },
    { style: 'maniac', aggression: 0.92, bluff: 0.30, tight: -0.10 },
  ];
  function makePersona() { return { ...PERSONAS[Math.floor(Math.random() * PERSONAS.length)] }; }
  function setSims(n) { SIMS = Math.max(10, n | 0); }

  window.PokerAI = { decide, makePersona, equity, setSims };
})();
