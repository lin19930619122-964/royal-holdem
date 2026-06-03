/* 皇室德州 — AI 决策 v3（强、像真人、会针对你剥削）
   原创实现，基于公开扑克策略：
   - 蒙特卡洛胜率 equity
   - 位置范围 / 3bet-4bet / set-mine / 短码 push-fold
   - 牌面干湿 + 下注尺度 + 薄价值 + 平衡诈唬
   - 难度(skill) + 对手建模(读你的弃牌率/激进度来剥削你) */
(function () {
  const P = window.Poker;
  let SIMS = 180;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

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

  // 详细胜率：返回 {win, tie, lose} 占比(用于教学分析)
  function equityFull(hole, board, numOpp, sims) {
    numOpp = Math.max(1, numOpp); sims = sims || 1500;
    const used = new Set(hole.concat(board).map(ckey));
    const rem = P.createDeck().filter((c) => !used.has(ckey(c)));
    const need = 5 - board.length, draw = numOpp * 2 + need;
    if (draw > rem.length) return { win: 0.5, tie: 0, lose: 0.5 };
    let win = 0, tie = 0, lose = 0;
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
      if (!best) lose++; else if (tied) tie++; else win++;
    }
    return { win: win / sims, tie: tie / sims, lose: lose / sims };
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

  // 读取对手(你)的剥削倾向
  function exploit() {
    const m = (typeof window !== 'undefined') ? window.OppModel : null;
    if (!m || !m.exploit) return { fold: 0.45, aggr: 0.18, samples: 0 };
    return m.exploit();
  }

  function decide(player, ctx) {
    const me = player, board = ctx.board, bb = ctx.bigBlind;
    const N = ctx.players.length;
    const numOpp = ctx.players.filter((p) => !p.folded && !p.out && p !== me).length || 1;
    const toCall = Math.max(0, ctx.currentBet - me.bet);
    const canCheck = toCall === 0;
    const pot = ctx.pot, minRaiseTo = ctx.currentBet + ctx.minRaise, maxTo = me.bet + me.chips;
    const canRaise = me.chips > toCall;
    const potOdds = toCall > 0 ? toCall / (pot + toCall) : 0;
    const persona = me.ai || { aggression: 0.6, bluff: 0.14, tight: 0.05, skill: 0.5 };
    const aggro = persona.aggression, tight = persona.tight || 0, skill = persona.skill || 0.5;
    const rng = Math.random();

    // —— 针对人类的剥削调整 ——
    const ex = exploit();
    let bluffAdj = 0, callAdj = 0;
    if (ex.samples > 6) {
      bluffAdj += clamp((ex.fold - 0.45) * 0.6, -0.05, 0.22) * skill;   // 你越爱弃，越诈唬你
      if (ex.aggr < 0.12) { callAdj += 0.05 * skill; bluffAdj += 0.05 * skill; } // 你太被动→尊重你的注、偷你
      else if (ex.aggr > 0.30) { callAdj -= 0.06 * skill; }            // 你太凶(多诈唬)→更轻松抓诈
    }
    const bluff = clamp((persona.bluff || 0.12) + bluffAdj, 0.02, 0.45);

    const mkRaiseTo = (t) => ({ action: 'raise', amount: clamp(Math.round(t / bb) * bb, minRaiseTo, maxTo) });
    const betFrac = (f) => mkRaiseTo(ctx.currentBet + Math.max(ctx.minRaise, Math.round((pot + toCall) * f)));
    const shoveAll = () => ({ action: 'raise', amount: maxTo });

    if (board.length === 0) {
      // ===== 翻牌前 =====
      const sHU = equity(me.hole, [], 1);
      const [a, b] = me.hole;
      const pair = a.rank === b.rank, suited = a.suit === b.suit;
      const hi = Math.max(a.rank, b.rank), lo = Math.min(a.rank, b.rank);
      const connector = !pair && (hi - lo) <= 2 && lo >= 5;
      const dist = (((ctx.button - me.id) % N) + N) % N;
      const isSB = dist === N - 1, isBB = dist === N - 2;
      const late = dist <= 1, middle = dist === 2 || dist === 3;
      const raised = ctx.currentBet > bb * 1.5, bigRaise = ctx.currentBet > bb * 3.5;
      const shortBB = me.chips / bb;
      const speculative = (pair && lo <= 8) || (suited && connector) || (suited && hi === 14);

      if (shortBB < 12) {
        if (!raised) { if (sHU > 0.57 || (pair && lo >= 6) || (late && sHU > 0.52)) return shoveAll(); return canCheck ? { action: 'check' } : { action: 'fold' }; }
        if (sHU > 0.61) return shoveAll();
        return canCheck ? { action: 'check' } : { action: 'fold' };
      }

      // 高手更紧的开牌门槛
      let openT = (late ? 0.50 : middle ? 0.55 : 0.61) + tight * 0.04 + skill * 0.05 - (aggro - 0.5) * 0.04;
      if (isSB) openT = 0.52 + tight * 0.04 + skill * 0.04; if (isBB) openT = 0.50 + skill * 0.03;

      if (!raised) {
        if (sHU > 0.66) return betFrac(0.9);
        if (sHU > openT || (speculative && late)) return betFrac(0.7);
        if (canCheck) return { action: 'check' };
        if (speculative && toCall <= bb && rng < 0.4) return { action: 'call' };
        return { action: 'fold' };
      } else {
        if (sHU > 0.70) return betFrac(0.95);                                  // 价值 3bet
        if (sHU > 0.63 && !bigRaise) return { action: 'call' };
        if ((pair || (suited && (connector || hi === 14))) && (late || isBB) && toCall <= me.chips * 0.06) return { action: 'call' };
        // 平衡诈唬 3bet（高手+剥削）
        if (canRaise && late && !bigRaise && rng < (bluff * 0.6 + skill * 0.05) && (suited || sHU > 0.54)) return betFrac(0.95);
        if (isBB && toCall <= bb * 2 && sHU > 0.5 && rng < 0.5) return { action: 'call' };
        return { action: 'fold' };
      }
    }

    // ===== 翻牌后 =====
    const eq = equity(me.hole, board, Math.min(numOpp, 6));
    const wet = boardWetness(board);
    // 高手更有纪律：门槛随 skill 提高（少付钱给对手价值），并按剥削微调
    const callT = potOdds + 0.04 + tight * 0.03 + skill * 0.045 + callAdj - (numOpp === 1 ? 0.02 : 0);
    const disc = 1 - skill * 0.45; // 技巧越高，诈唬越少(更难被抓)

    if (canCheck) {
      if (eq > 0.85 && rng < 0.35) return { action: 'check' };                 // 陷阱
      if (eq > 0.60 && canRaise) return betFrac(wet > 0.5 ? 0.78 : 0.62);      // 价值
      if (eq > 0.50 && canRaise && skill < 0.6 && rng < aggro * 0.5) return betFrac(0.5); // 薄价值仅低手
      if (eq < 0.42 && canRaise && numOpp <= 2 && rng < (bluff + (1 - wet) * 0.12 * aggro) * disc) return betFrac(0.58); // c-bet 诈唬
      return { action: 'check' };
    }
    // 面对下注
    if (eq > 0.72 && canRaise && me.chips > toCall + ctx.minRaise && rng < 0.5 + aggro * 0.4) return betFrac(wet > 0.5 ? 0.9 : 0.72);
    if (eq > callT) return { action: 'call' };
    if (eq > 0.40 && wet > 0.45 && canRaise && numOpp <= 2 && rng < (bluff + aggro * 0.12) * disc) return betFrac(0.85); // 听牌半诈唬
    if (eq < 0.3 && wet < 0.3 && canRaise && numOpp === 1 && rng < bluff * 0.5 * disc) return betFrac(0.7);             // 干燥面诈唬
    if (skill < 0.5 && toCall <= bb && eq > 0.3 && rng < 0.45) return { action: 'call' };
    return { action: 'fold' };
  }

  // 难度分级：普通=混合性格；高手/大师=鲨鱼(紧凶+高技巧+强剥削)
  const CASUAL = [
    { style: 'nit', aggression: 0.35, bluff: 0.05, tight: 0.10, skill: 0.4 },
    { style: 'tag', aggression: 0.62, bluff: 0.12, tight: 0.04, skill: 0.5 },
    { style: 'lag', aggression: 0.80, bluff: 0.22, tight: -0.04, skill: 0.5 },
    { style: 'station', aggression: 0.32, bluff: 0.04, tight: -0.08, skill: 0.25 },
    { style: 'maniac', aggression: 0.92, bluff: 0.30, tight: -0.10, skill: 0.3 },
  ];
  function makePersona(level) {
    if (level === 'master') return { style: 'shark', aggression: 0.72 + Math.random() * 0.1, bluff: 0.11, tight: 0.10, skill: 1.0 };
    if (level === 'hard') return { style: 'shark', aggression: 0.66 + Math.random() * 0.1, bluff: 0.10, tight: 0.08, skill: 0.85 };
    return { ...CASUAL[Math.floor(Math.random() * CASUAL.length)] };
  }
  function setSims(n) { SIMS = Math.max(10, n | 0); }

  window.PokerAI = { decide, makePersona, equity, equityFull, setSims };
})();
