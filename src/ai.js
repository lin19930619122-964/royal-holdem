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

  // 翻前起手强度评分（启发式，用于"对手范围"建模）
  function comboScore(a, b) {
    const hi = Math.max(a.rank, b.rank), lo = Math.min(a.rank, b.rank);
    const pair = a.rank === b.rank, suited = a.suit === b.suit, gap = hi - lo;
    let s = hi * 2 + lo;
    if (pair) s += 42 + hi * 3;
    if (suited) s += 8;
    if (!pair) { if (gap === 1) s += 6; else if (gap === 2) s += 3; else if (gap >= 5) s -= 4; }
    if (hi === 14) s += 4;
    return s;
  }
  // 全 1326 组合分数分布（一次性），用于把"前 r%"换算成分数阈值
  let ALL_SCORES = null;
  function buildAllScores() {
    const deck = P.createDeck(), arr = [];
    for (let i = 0; i < deck.length; i++) for (let j = i + 1; j < deck.length; j++) arr.push(comboScore(deck[i], deck[j]));
    arr.sort((x, y) => y - x);
    ALL_SCORES = arr;
  }
  function scoreCutoffForTop(rPct) {
    if (!ALL_SCORES) buildAllScores();
    const idx = clamp(Math.floor(rPct / 100 * ALL_SCORES.length), 0, ALL_SCORES.length - 1);
    return ALL_SCORES[idx];
  }

  // 你 vs "对手范围(前 rPct% 起手)" 的胜率：进攻者手牌只从范围内抽样，其余对手随机
  function equityVsRange(hole, board, rangePct, numOther, sims) {
    sims = sims || 1400; numOther = Math.max(0, numOther | 0);
    const cutoff = scoreCutoffForTop(rangePct);
    const used = new Set(hole.concat(board).map(ckey));
    const deck = P.createDeck().filter((c) => !used.has(ckey(c)));
    // 范围内的进攻者组合
    const combos = [];
    for (let i = 0; i < deck.length; i++) for (let j = i + 1; j < deck.length; j++) {
      if (comboScore(deck[i], deck[j]) >= cutoff) combos.push([deck[i], deck[j]]);
    }
    if (!combos.length) return equityFull(hole, board, numOther + 1, sims);
    const need = 5 - board.length;
    let win = 0, tie = 0, lose = 0;
    for (let s = 0; s < sims; s++) {
      const ag = combos[(Math.random() * combos.length) | 0];
      const agk = new Set([ckey(ag[0]), ckey(ag[1])]);
      const rem = deck.filter((c) => !agk.has(ckey(c)));
      const draw = numOther * 2 + need;
      if (draw > rem.length) { lose += 0; continue; }
      for (let i = 0; i < draw; i++) { const j = i + Math.floor(Math.random() * (rem.length - i)); const t = rem[i]; rem[i] = rem[j]; rem[j] = t; }
      const full = need ? board.concat(rem.slice(0, need)) : board;
      const my = P.evaluateBest(hole.concat(full)).score;
      let idx = need, best = true, tied = false;
      // 进攻者
      const ags = P.evaluateBest(ag.concat(full)).score;
      let cmp = P.compareScores(my, ags);
      if (cmp < 0) best = false; else if (cmp === 0) tied = true;
      // 其余随机对手
      for (let o = 0; best && o < numOther; o++) {
        const os = P.evaluateBest([rem[idx++], rem[idx++]].concat(full)).score;
        const c2 = P.compareScores(my, os);
        if (c2 < 0) { best = false; break; } if (c2 === 0) tied = true;
      }
      if (!best) lose++; else if (tied) tie++; else win++;
    }
    const tot = win + tie + lose || 1;
    return { win: win / tot, tie: tie / tot, lose: lose / tot };
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

  // [Phase 2 已删除] 旧的 Math.random 阈值决策 decide() 是随机/概率 Bot，已移除。
  // 所有 Bot 决策统一由 core/ai/PokerBrain.decideBotAction 接管（结构化、可种子复现、带 reason）。
  // 本文件仅保留 equity/equityFull/equityVsRange/boardWetness 等给「人类训练胜率提示」与策略实验室使用。

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

  window.PokerAI = { makePersona, equity, equityFull, equityVsRange, setSims };
})();
