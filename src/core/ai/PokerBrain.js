/* PokerBrain —— V4 AI 决策大脑（移植自原创 holdem_ai_brain_v4.ts，零参考资源）。
   依赖改接本项目核心：evaluateBestHand←HandEvaluator、estimateHoldemEquity←Equity、seedRng←SeededRng。
   提供：decideBotAction(ctx) + classifyPreflop/analyzeBoardTexture/analyzeDraws + DEFAULT_BOT_PROFILES。
   纯逻辑，无 UI。BotDecisionEngine/TrainingAdvisor 复用本模块。 */
(function (root, factory) {
  const req = (typeof require !== 'undefined');
  const HandEvaluator = req ? require('../poker/HandEvaluator.js') : window.RHCore.HandEvaluator;
  const Equity = req ? require('../poker/Equity.js') : window.RHCore.Equity;
  const SeededRng = req ? require('../poker/SeededRng.js') : window.RHCore.SeededRng;
  const m = factory(HandEvaluator, Equity, SeededRng);
  if (typeof module !== 'undefined' && module.exports) module.exports = m;
  if (typeof window !== 'undefined') (window.RHCore = window.RHCore || {}).PokerBrain = m;
})(this, function (HandEvaluator, Equity, SeededRng) {
  // ---- 核心适配（对齐 v4 brain 期望的 poker-core 接口）----
  const HandCategory = { HighCard: 0, Pair: 1, TwoPair: 2, Trips: 3, Straight: 4, Flush: 5, FullHouse: 6, Quads: 7, StraightFlush: 8 };
  function evaluateBestHand(cards) { const r = HandEvaluator.evaluateBest(cards); return { category: r.score[0], label: HandEvaluator.name(r.score), cards: r.cards }; }
  function estimateHoldemEquity(o) { return Equity.estimate(o); }
  function seedRng(seed) { const r = SeededRng.create(seed); return function () { return r.next(); }; }

  const DEFAULT_BOT_PROFILES = {
    nit: { id: 'nit', displayName: '岩石型', archetype: 'nit', vpipTarget: 0.14, pfrTarget: 0.10, aggression: 0.35, bluffFrequency: 0.03, callDownLightness: 0.20, trapFrequency: 0.08, foldToCbet: 0.68, threeBetFrequency: 0.05, tiltFactor: 0.05, reactionTimeMs: [700, 1400] },
    tight_aggressive: { id: 'tag', displayName: '紧凶型', archetype: 'tight_aggressive', vpipTarget: 0.22, pfrTarget: 0.18, aggression: 0.65, bluffFrequency: 0.10, callDownLightness: 0.38, trapFrequency: 0.10, foldToCbet: 0.52, threeBetFrequency: 0.09, tiltFactor: 0.08, reactionTimeMs: [550, 1150] },
    balanced_reg: { id: 'reg', displayName: '常规玩家', archetype: 'balanced_reg', vpipTarget: 0.26, pfrTarget: 0.20, aggression: 0.58, bluffFrequency: 0.12, callDownLightness: 0.42, trapFrequency: 0.11, foldToCbet: 0.47, threeBetFrequency: 0.10, tiltFactor: 0.10, reactionTimeMs: [500, 1100] },
    loose_passive: { id: 'lp', displayName: '松被动', archetype: 'loose_passive', vpipTarget: 0.42, pfrTarget: 0.08, aggression: 0.22, bluffFrequency: 0.04, callDownLightness: 0.68, trapFrequency: 0.06, foldToCbet: 0.35, threeBetFrequency: 0.03, tiltFactor: 0.12, reactionTimeMs: [450, 1000] },
    calling_station: { id: 'station', displayName: '跟注站', archetype: 'calling_station', vpipTarget: 0.50, pfrTarget: 0.06, aggression: 0.15, bluffFrequency: 0.02, callDownLightness: 0.82, trapFrequency: 0.03, foldToCbet: 0.20, threeBetFrequency: 0.02, tiltFactor: 0.15, reactionTimeMs: [350, 950] },
    loose_aggressive: { id: 'lag', displayName: '松凶型', archetype: 'loose_aggressive', vpipTarget: 0.38, pfrTarget: 0.29, aggression: 0.78, bluffFrequency: 0.20, callDownLightness: 0.50, trapFrequency: 0.08, foldToCbet: 0.42, threeBetFrequency: 0.16, tiltFactor: 0.22, reactionTimeMs: [400, 1000] },
    maniac: { id: 'maniac', displayName: '疯狗型', archetype: 'maniac', vpipTarget: 0.60, pfrTarget: 0.45, aggression: 0.95, bluffFrequency: 0.32, callDownLightness: 0.58, trapFrequency: 0.02, foldToCbet: 0.28, threeBetFrequency: 0.26, tiltFactor: 0.45, reactionTimeMs: [250, 800] },
  };

  const PREMIUM = new Set(['AA', 'KK', 'QQ', 'JJ', 'AKs', 'AKo']);
  const STRONG = new Set(['TT', '99', 'AQs', 'AQo', 'AJs', 'KQs']);
  const PLAYABLE = new Set(['88', '77', '66', 'ATs', 'KJs', 'KTs', 'QJs', 'QTs', 'JTs', 'T9s', '98s', 'AJo', 'KQo']);
  const SPECULATIVE = new Set(['55', '44', '33', '22', 'A2s', 'A3s', 'A4s', 'A5s', 'A6s', 'A7s', 'A8s', 'A9s', 'K9s', 'Q9s', 'J9s', 'T8s', '97s', '87s', '76s', '65s', '54s']);
  const RANK_CHAR = { 14: 'A', 13: 'K', 12: 'Q', 11: 'J', 10: 'T', 9: '9', 8: '8', 7: '7', 6: '6', 5: '5', 4: '4', 3: '3', 2: '2' };
  const RANK_VALUE = { A: 14, K: 13, Q: 12, J: 11, T: 10, '9': 9, '8': 8, '7': 7, '6': 6, '5': 5, '4': 4, '3': 3, '2': 2 };

  function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }
  function hasLegal(ctx, type) { return ctx.legalActions.some((a) => a.type === type); }
  function legalOf(ctx, type) { return ctx.legalActions.find((a) => a.type === type); }
  function randRange(rng, min, max) { return min + (max - min) * rng(); }
  function chooseWeighted(weights, rng) {
    const entries = Object.entries(weights).filter(([, w]) => Number.isFinite(w) && w > 0);
    const total = entries.reduce((s, [, w]) => s + w, 0);
    if (total <= 0) return (entries[0] && entries[0][0]) || Object.keys(weights)[0];
    let pick = rng() * total;
    for (const [key, weight] of entries) { pick -= weight; if (pick <= 0) return key; }
    return entries[entries.length - 1][0];
  }

  function handCode(a, b) {
    const hi = a.rank >= b.rank ? a : b, lo = a.rank >= b.rank ? b : a;
    const r1 = RANK_CHAR[hi.rank], r2 = RANK_CHAR[lo.rank];
    if (hi.rank === lo.rank) return `${r1}${r2}`;
    return `${r1}${r2}${hi.suit === lo.suit ? 's' : 'o'}`;
  }
  function preflopClass(code) {
    if (PREMIUM.has(code)) return 'premium';
    if (STRONG.has(code)) return 'strong';
    if (PLAYABLE.has(code)) return 'playable';
    if (SPECULATIVE.has(code)) return 'speculative';
    return 'trash';
  }
  function basePreflopScore(code) {
    const cls = preflopClass(code);
    const pair = code.length === 2 && code[0] === code[1];
    if (cls === 'premium') return 92;
    if (cls === 'strong') return 78;
    if (cls === 'playable') return 61;
    if (cls === 'speculative') return pair ? 48 : 42;
    const r1 = RANK_VALUE[code[0]], r2 = RANK_VALUE[code[1]];
    const suited = code.endsWith('s'), gap = Math.abs(r1 - r2) - 1;
    let score = (r1 + r2) * 1.7 + (suited ? 6 : 0) - Math.max(0, gap) * 3;
    if (r1 === 14) score += 4;
    if (r2 <= 5 && r1 < 12) score -= 6;
    return clamp(score, 5, 55);
  }
  function positionBonus(pos) {
    switch (pos) { case 'UTG': return -10; case 'MP': return -4; case 'CO': return 4; case 'BTN': return 10; case 'SB': return -3; case 'BB': return 2; default: return 0; }
  }
  function facingRaise(ctx) {
    return ctx.amountToCall > ctx.bigBlind * 0.75 || ctx.previousActions.some((a) => a.street === 'preflop' && (a.action.type === 'raise' || a.action.type === 'bet'));
  }
  function classifyPreflop(holeCards, ctx) {
    const code = handCode(holeCards[0], holeCards[1]);
    const cls = preflopClass(code);
    let score = basePreflopScore(code);
    if (ctx) {
      score += positionBonus(ctx.position);
      if (ctx.amountToCall > 0) score -= 8;
      if (ctx.previousActions && ctx.previousActions.some((a) => a.action.type === 'raise')) score -= 10;
    }
    score = clamp(score, 0, 100);
    const openRaiseWeight = clamp((score - 42) / 42, 0, 1);
    const callWeight = clamp((score - 30) / 50, 0, 1);
    const threeBetWeight = clamp((score - 70) / 25, 0, 1);
    const fourBetWeight = clamp((score - 84) / 16, 0, 1);
    const jamWeight = clamp((score - 88) / 14, 0, 1);
    const foldWeight = clamp((55 - score) / 55, 0, 1);
    return { code, handClass: cls, baseScore: score, openRaiseWeight, callWeight, threeBetWeight, fourBetWeight, jamWeight, foldWeight, explanation: `${code} 属于${cls}，位置和前序行动修正后评分 ${Math.round(score)}/100。` };
  }
  function analyzeBoardTexture(board) {
    if (board.length < 3) return { wetness: 0, paired: false, monotone: false, twoTone: false, rainbow: true, straightConnected: false, highCardHeavy: false, aceHigh: false, dangerTurns: 0, description: '翻前无公共牌。' };
    const ranks = board.map((c) => c.rank).sort((a, b) => b - a);
    const suits = new Map(), rankCounts = new Map();
    for (const c of board) { suits.set(c.suit, (suits.get(c.suit) || 0) + 1); rankCounts.set(c.rank, (rankCounts.get(c.rank) || 0) + 1); }
    const maxSuit = Math.max(...suits.values());
    const paired = [...rankCounts.values()].some((v) => v >= 2);
    const monotone = (maxSuit >= 3 && board.length === 3) || maxSuit >= board.length;
    const twoTone = maxSuit >= 2 && !monotone;
    const rainbow = maxSuit === 1;
    const highCardHeavy = ranks.filter((r) => r >= 11).length >= 2;
    const aceHigh = ranks.includes(14);
    const uniq = [...new Set(ranks.concat(ranks.includes(14) ? [1] : []))].sort((a, b) => a - b);
    let connectedness = 0;
    for (let i = 0; i < uniq.length; i++) for (let j = i + 1; j < uniq.length; j++) { if (uniq[j] - uniq[i] <= 4) connectedness += 1; }
    const straightConnected = connectedness >= 3;
    let wetness = 10;
    if (twoTone) wetness += 20; if (monotone) wetness += 35; if (straightConnected) wetness += 25; if (paired) wetness += 10; if (highCardHeavy) wetness += 7;
    wetness = clamp(wetness, 0, 100);
    const tags = [];
    if (rainbow) tags.push('彩虹面'); if (twoTone) tags.push('两同花面'); if (monotone) tags.push('单色面'); if (paired) tags.push('对子面'); if (straightConnected) tags.push('顺子连接面'); if (highCardHeavy) tags.push('高张密集');
    return { wetness, paired, monotone, twoTone, rainbow, straightConnected, highCardHeavy, aceHigh, dangerTurns: Math.round(wetness / 12), description: tags.length ? tags.join('、') : '干燥牌面' };
  }
  function straightPotentialRanks(cards) {
    const ranks = [...new Set(cards.map((c) => c.rank).concat(cards.some((c) => c.rank === 14) ? [1] : []))].sort((a, b) => a - b);
    let openEnded = false, gutshots = 0;
    for (let low = 1; low <= 10; low++) {
      const windowR = [low, low + 1, low + 2, low + 3, low + 4];
      const have = windowR.filter((r) => ranks.includes(r)).length;
      if (have === 4) { const missing = windowR.find((r) => !ranks.includes(r)); if (missing === low || missing === low + 4) openEnded = true; else gutshots += 1; }
    }
    return { openEnded, gutshot: gutshots >= 1, doubleGutshot: gutshots >= 2 };
  }
  function analyzeDraws(hole, board) {
    const all = [...hole, ...board];
    const suitCounts = new Map();
    for (const c of all) suitCounts.set(c.suit, (suitCounts.get(c.suit) || 0) + 1);
    const maxSuit = Math.max(...suitCounts.values());
    const flushSuit = [...suitCounts.entries()].sort((a, b) => b[1] - a[1])[0] && [...suitCounts.entries()].sort((a, b) => b[1] - a[1])[0][0];
    const flushDraw = board.length >= 3 && maxSuit === 4;
    const backdoorFlushDraw = board.length === 3 && maxSuit === 3;
    const nutFlushDraw = flushDraw && flushSuit !== undefined && hole.some((c) => c.suit === flushSuit && c.rank === 14);
    const straight = straightPotentialRanks(all);
    const topBoardRank = Math.max(...board.map((c) => c.rank), 0);
    const overcards = board.length > 0 ? hole.filter((c) => c.rank > topBoardRank).length : 0;
    const comboDraw = flushDraw && (straight.openEnded || straight.gutshot || overcards >= 1);
    const tags = [];
    if (nutFlushDraw) tags.push('坚果同花听牌'); else if (flushDraw) tags.push('同花听牌');
    if (backdoorFlushDraw) tags.push('后门同花');
    if (straight.openEnded) tags.push('开放顺听');
    if (straight.doubleGutshot) tags.push('双卡顺听'); else if (straight.gutshot) tags.push('卡顺听');
    if (overcards > 0) tags.push(`${overcards} 张高牌`);
    if (comboDraw) tags.push('组合听牌');
    return { flushDraw, nutFlushDraw, backdoorFlushDraw, openEndedStraightDraw: straight.openEnded, gutshot: straight.gutshot, doubleGutshot: straight.doubleGutshot, overcards, comboDraw, summary: tags.length ? tags.join('、') : '无明显听牌' };
  }
  function potOdds(ctx) { if (ctx.amountToCall <= 0) return 0; return ctx.amountToCall / Math.max(1, ctx.pot + ctx.amountToCall); }
  function spr(ctx) { return ctx.effectiveStack / Math.max(ctx.pot, ctx.bigBlind); }
  function clampAmountToLegal(ctx, desired, type) {
    const legal = legalOf(ctx, type);
    if (!legal) return Math.min(ctx.stack, Math.max(ctx.bigBlind, desired));
    const min = legal.minAmount != null ? legal.minAmount : ctx.bigBlind;
    const max = legal.maxAmount != null ? legal.maxAmount : ctx.stack;
    return Math.round(clamp(desired, min, max));
  }
  function chooseBetSize(ctx, strength, wetness, rng) {
    const profile = ctx.botProfile;
    const basePot = Math.max(ctx.pot, ctx.bigBlind * 2);
    let fraction = 0.33;
    if (strength > 0.82) fraction = wetness > 55 ? 0.78 : 0.62;
    else if (strength > 0.62) fraction = wetness > 55 ? 0.66 : 0.50;
    else if (strength > 0.45) fraction = 0.33;
    else fraction = profile.aggression > 0.70 ? 0.45 : 0.30;
    fraction *= randRange(rng, 0.88, 1.14);
    if (ctx.amountToCall > 0 && hasLegal(ctx, 'raise')) { return clampAmountToLegal(ctx, ctx.currentBet + basePot * fraction, 'raise'); }
    return clampAmountToLegal(ctx, basePot * fraction, 'bet');
  }
  function premiumHandCue(advice) { return advice.handClass === 'premium' || (advice.handClass === 'strong' && advice.baseScore >= 82); }
  function fallbackAction(ctx) {
    if (hasLegal(ctx, 'check')) return { type: 'check' };
    if (hasLegal(ctx, 'call')) return { type: 'call' };
    if (hasLegal(ctx, 'fold')) return { type: 'fold' };
    return { type: 'all-in' };
  }
  function reactionTime(ctx, rng) {
    const min = ctx.botProfile.reactionTimeMs[0], max = ctx.botProfile.reactionTimeMs[1];
    const streetBonus = ctx.street === 'river' ? 250 : ctx.street === 'turn' ? 150 : 0;
    const pressureBonus = ctx.amountToCall > ctx.pot * 0.5 ? 250 : 0;
    return Math.round(randRange(rng, min, max) + streetBonus + pressureBonus);
  }

  function decideBotAction(ctx) {
    const rng = ctx.seed === undefined ? Math.random : seedRng(ctx.seed);
    const profile = ctx.botProfile;
    const reactionTimeMs = reactionTime(ctx, rng);
    if (ctx.stack <= 0) return { action: { type: 'check' }, confidence: 1, reason: '无可用筹码，跳过。', reactionTimeMs, features: {} };
    if (ctx.street === 'preflop') return decidePreflop(ctx, rng, reactionTimeMs);

    const value = evaluateBestHand([...ctx.holeCards, ...ctx.board]);
    const texture = analyzeBoardTexture(ctx.board);
    const draws = analyzeDraws(ctx.holeCards, ctx.board);
    const odds = potOdds(ctx);
    const stackPotRatio = spr(ctx);
    const equityResult = estimateHoldemEquity({ hero: ctx.holeCards, board: ctx.board, opponents: Math.max(1, ctx.activeOpponents), samples: 500, rng });
    const equity = equityResult.win + equityResult.tie * 0.5;
    let madeStrength = value.category / HandCategory.StraightFlush;
    if (value.category >= HandCategory.TwoPair) madeStrength += 0.12;
    if (value.category >= HandCategory.Flush) madeStrength += 0.12;
    madeStrength = clamp(madeStrength, 0, 1);
    let drawBoost = 0;
    if (draws.comboDraw) drawBoost += 0.18;
    else { if (draws.flushDraw) drawBoost += draws.nutFlushDraw ? 0.13 : 0.09; if (draws.openEndedStraightDraw) drawBoost += 0.10; if (draws.gutshot) drawBoost += 0.04; if (draws.overcards >= 2) drawBoost += 0.05; }
    const rawStrength = clamp(Math.max(equity, madeStrength + drawBoost), 0, 1);
    const aggression = clamp(profile.aggression + profile.tiltFactor * 0.15, 0, 1);
    const bluffRoll = rng() < profile.bluffFrequency * (hasLegal(ctx, 'bet') || hasLegal(ctx, 'raise') ? 1 : 0.2);
    const canCheck = hasLegal(ctx, 'check'), canBet = hasLegal(ctx, 'bet'), canCall = hasLegal(ctx, 'call'), canRaise = hasLegal(ctx, 'raise'), canFold = hasLegal(ctx, 'fold');
    let weights = { fold: 0, check: 0, call: 0, bet: 0, raise: 0, 'all-in': 0 };
    if (ctx.amountToCall <= 0 || canCheck) {
      weights.check = canCheck ? clamp(0.55 - rawStrength * 0.35 - aggression * 0.10, 0.05, 0.85) : 0;
      weights.bet = canBet ? clamp((rawStrength - 0.42) * 1.8 + aggression * 0.28 + (bluffRoll ? 0.35 : 0), 0, 1.2) : 0;
      weights['all-in'] = hasLegal(ctx, 'all-in') && stackPotRatio < 1.2 && rawStrength > 0.78 ? 0.30 : 0;
    } else {
      const callComfort = equity - odds;
      weights.fold = canFold ? clamp(0.45 - callComfort * 1.6 - profile.callDownLightness * 0.28, 0.02, 1.0) : 0;
      weights.call = canCall ? clamp(0.25 + callComfort * 1.8 + profile.callDownLightness * 0.45 + drawBoost, 0, 1.3) : 0;
      weights.raise = canRaise ? clamp((rawStrength - 0.62) * 1.6 + aggression * 0.25 + (bluffRoll ? 0.32 : 0), 0, 1.0) : 0;
      weights['all-in'] = hasLegal(ctx, 'all-in') && (stackPotRatio < 1.0 || rawStrength > 0.88) ? clamp((rawStrength - 0.75) * 1.5, 0, 0.8) : 0;
    }
    if (profile.archetype === 'calling_station') { weights.call *= 1.55; weights.fold *= 0.55; weights.raise *= 0.55; }
    else if (profile.archetype === 'nit') { weights.fold *= 1.35; weights.call *= 0.85; weights.raise *= rawStrength > 0.72 ? 1.05 : 0.55; }
    else if (profile.archetype === 'maniac') { weights.bet *= 1.45; weights.raise *= 1.55; weights.fold *= 0.80; }
    const picked = chooseWeighted(weights, rng);
    let action = fallbackAction(ctx);
    if (picked === 'fold' && canFold) action = { type: 'fold' };
    if (picked === 'check' && canCheck) action = { type: 'check' };
    if (picked === 'call' && canCall) action = { type: 'call' };
    if (picked === 'bet' && canBet) action = { type: 'bet', amount: chooseBetSize(ctx, rawStrength, texture.wetness, rng) };
    if (picked === 'raise' && canRaise) action = { type: 'raise', amount: chooseBetSize(ctx, rawStrength, texture.wetness, rng) };
    if (picked === 'all-in' && hasLegal(ctx, 'all-in')) action = { type: 'all-in' };
    const reason = buildPostflopReason(ctx, action, value.label, equity, odds, texture, draws, rawStrength);
    return { action, confidence: clamp(Math.abs(equity - odds) + rawStrength * 0.4, 0.25, 0.95), reason, reactionTimeMs, features: { equity, potOdds: odds, boardWetness: texture.wetness, spr: stackPotRatio, madeHand: value.label, drawSummary: draws.summary, profileBias: profile.displayName } };
  }

  function decidePreflop(ctx, rng, reactionTimeMs) {
    const advice = classifyPreflop(ctx.holeCards, ctx);
    const profile = ctx.botProfile;
    const score = advice.baseScore;
    const shortStack = ctx.effectiveStack <= ctx.bigBlind * 18;
    const pressure = facingRaise(ctx);
    let weights = { fold: 0, check: 0, call: 0, bet: 0, raise: 0, 'all-in': 0 };
    const canCheck = hasLegal(ctx, 'check'), canCall = hasLegal(ctx, 'call'), canBet = hasLegal(ctx, 'bet'), canRaise = hasLegal(ctx, 'raise'), canFold = hasLegal(ctx, 'fold');
    if (!pressure && ctx.amountToCall <= ctx.bigBlind) {
      weights.check = canCheck ? (ctx.position === 'BB' && score < 45 ? 0.6 : 0.1) : 0;
      weights.call = canCall ? clamp((score - 34) / 45 + (profile.callDownLightness * 0.25), 0, 0.85) : 0;
      weights.bet = canBet ? clamp((score - 42) / 42 + profile.aggression * 0.22, 0, 1.2) : 0;
      weights.raise = canRaise ? clamp((score - 45) / 40 + profile.aggression * 0.25, 0, 1.3) : 0;
      weights.fold = canFold ? clamp((46 - score) / 46, 0, 1.0) : 0;
    } else {
      weights.fold = canFold ? clamp((68 - score) / 50, 0.02, 1.2) : 0;
      weights.call = canCall ? clamp((score - 48) / 42 + profile.callDownLightness * 0.20, 0, 1.0) : 0;
      weights.raise = canRaise ? clamp((score - 72) / 26 + profile.threeBetFrequency * 0.8, 0, 1.1) : 0;
    }
    if (shortStack && (advice.handClass === 'premium' || (advice.handClass === 'strong' && ctx.effectiveStack <= ctx.bigBlind * 14))) { weights['all-in'] = hasLegal(ctx, 'all-in') ? 0.9 : 0; }
    if (profile.archetype === 'nit') { weights.fold *= 1.30; weights.call *= 0.80; weights.raise *= 0.85; }
    else if (profile.archetype === 'calling_station') { weights.call *= 1.55; weights.fold *= 0.70; weights.raise *= 0.55; }
    else if (profile.archetype === 'maniac') { weights.raise *= 1.65; weights.bet *= 1.45; weights.fold *= 0.70; }
    else if (profile.archetype === 'loose_aggressive') { weights.raise *= 1.25; weights.call *= 1.10; }
    if (advice.handClass === 'trash' && ctx.position === 'UTG') { weights.raise *= 0.15; weights.call *= 0.45; weights.fold += 0.8; }
    if (premiumHandCue(advice)) { weights.fold = 0; weights.call *= 0.55; weights.raise += 0.8; }
    const picked = chooseWeighted(weights, rng);
    let action = fallbackAction(ctx);
    if (picked === 'fold' && canFold) action = { type: 'fold' };
    if (picked === 'check' && canCheck) action = { type: 'check' };
    if (picked === 'call' && canCall) action = { type: 'call' };
    if (picked === 'bet' && canBet) action = { type: 'bet', amount: preflopOpenAmount(ctx, rng) };
    if (picked === 'raise' && canRaise) action = { type: 'raise', amount: preflopRaiseAmount(ctx, rng) };
    if (picked === 'all-in' && hasLegal(ctx, 'all-in')) action = { type: 'all-in' };
    return { action, confidence: clamp(score / 100, 0.20, 0.95), reason: `${ctx.position} ${advice.explanation}${pressure ? ' 面对前序加注，范围收紧。' : ' 无强压力，按位置范围行动。'} Bot 风格：${profile.displayName}。`, reactionTimeMs, features: { handCode: advice.code, handClass: advice.handClass, profileBias: profile.displayName } };
  }
  function preflopOpenAmount(ctx, rng) { return clampAmountToLegal(ctx, ctx.bigBlind * randRange(rng, 2.2, 3.0), 'bet'); }
  function preflopRaiseAmount(ctx, rng) {
    const priorRaise = Math.max(ctx.currentBet, ctx.bigBlind * 2.5);
    const inPosition = ctx.position === 'CO' || ctx.position === 'BTN';
    const factor = inPosition ? randRange(rng, 2.6, 3.2) : randRange(rng, 3.0, 3.8);
    return clampAmountToLegal(ctx, priorRaise * factor, 'raise');
  }
  function buildPostflopReason(ctx, action, madeHand, equity, odds, texture, draws, strength) {
    const actionText = action.type === 'bet' || action.type === 'raise' ? `${action.type === 'bet' ? '下注' : '加注'}到 ${action.amount}` : action.type;
    return `当前${madeHand}，${draws.summary}，牌面为${texture.description}，估算权益 ${Math.round(equity * 100)}%，底池赔率 ${Math.round(odds * 100)}%，综合强度 ${Math.round(strength * 100)}/100，选择 ${actionText}。`;
  }

  return { HandCategory, DEFAULT_BOT_PROFILES, handCode, classifyPreflop, analyzeBoardTexture, analyzeDraws, decideBotAction };
});
