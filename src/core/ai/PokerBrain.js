/* PokerBrain —— AI 决策总装（原创，零参考资源）。
   组合模块：PreflopMatrix(起手分组) + BoardTexture + EquityCalculator(权益/读牌) + PostflopHeuristics(翻后策略) + BotProfiles。
   输入 DecisionContext（见 types.js）；输出富决策：
     { action:{type,amount}, amount, confidence, reason, handClass, equity, potOdds, boardTexture, riskLevel, intent, reactionTimeMs, features }
   随机仅用于受控的诈唬频率/尺度抖动，且 seed 可复现——不存在随机/固定概率 Bot。纯逻辑，无 UI。 */
(function (root, factory) {
  const req = (typeof require !== 'undefined');
  const SeededRng = req ? require('../poker/SeededRng.js') : window.RHCore.SeededRng;
  const Profiles = req ? require('./BotProfiles.js') : window.RHCore.BotProfiles;
  const Preflop = req ? require('./PreflopMatrix.js') : window.RHCore.PreflopMatrix;
  const Board = req ? require('./BoardTexture.js') : window.RHCore.BoardTexture;
  const EQ = req ? require('./EquityCalculator.js') : window.RHCore.EquityCalculator;
  const Post = req ? require('./PostflopHeuristics.js') : window.RHCore.PostflopHeuristics;
  const T = req ? require('./types.js') : window.RHCore.AiTypes;
  const m = factory(SeededRng, Profiles, Preflop, Board, EQ, Post, T);
  if (typeof module !== 'undefined' && module.exports) module.exports = m;
  if (typeof window !== 'undefined') (window.RHCore = window.RHCore || {}).PokerBrain = m;
})(this, function (SeededRng, Profiles, Preflop, Board, EQ, Post, T) {
  const HandCategory = { HighCard: 0, Pair: 1, TwoPair: 2, Trips: 3, Straight: 4, Flush: 5, FullHouse: 6, Quads: 7, StraightFlush: 8 };
  const INTENT = T.INTENT, INTENT_CN = T.INTENT_CN, RISK = T.RISK, RISK_CN = T.RISK_CN;
  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
  const hasLegal = (ctx, type) => ctx.legalActions.some((a) => a.type === type);
  const legalOf = (ctx, type) => ctx.legalActions.find((a) => a.type === type);
  const randRange = (rng, min, max) => min + (max - min) * rng();
  function seedRng(seed) { const r = SeededRng.create(seed); return function () { return r.next(); }; }
  function chooseWeighted(weights, rng) {
    const entries = Object.entries(weights).filter(([, w]) => Number.isFinite(w) && w > 0);
    const total = entries.reduce((s, [, w]) => s + w, 0);
    if (total <= 0) return (entries[0] && entries[0][0]) || Object.keys(weights)[0];
    let pick = rng() * total;
    for (const [key, weight] of entries) { pick -= weight; if (pick <= 0) return key; }
    return entries[entries.length - 1][0];
  }
  function clampAmountToLegal(ctx, desired, type) {
    const legal = legalOf(ctx, type);
    if (!legal) return Math.min(ctx.stack, Math.max(ctx.bigBlind, desired));
    const min = legal.minAmount != null ? legal.minAmount : ctx.bigBlind;
    const max = legal.maxAmount != null ? legal.maxAmount : ctx.stack;
    return Math.round(clamp(desired, min, max));
  }
  function fallbackAction(ctx) {
    if (hasLegal(ctx, 'check')) return { type: 'check' };
    if (hasLegal(ctx, 'call')) return { type: 'call' };
    if (hasLegal(ctx, 'fold')) return { type: 'fold' };
    return { type: 'all-in' };
  }
  function reactionTime(ctx, rng) {
    const range = (ctx.botProfile && ctx.botProfile.reactionTimeMs) || [400, 1000];
    const streetBonus = ctx.street === 'river' ? 250 : ctx.street === 'turn' ? 150 : 0;
    const pressureBonus = ctx.amountToCall > ctx.pot * 0.5 ? 250 : 0;
    return Math.round(randRange(rng, range[0], range[1]) + streetBonus + pressureBonus);
  }
  function facingRaise(ctx) {
    return ctx.amountToCall > ctx.bigBlind * 0.75 || (ctx.previousActions || []).some((a) => a.street === 'preflop' && a.action && (a.action.type === 'raise' || a.action.type === 'bet'));
  }
  function premiumHandCue(advice) { return advice.handClass === 'premium' || (advice.handClass === 'strong' && advice.baseScore >= 82); }

  // ---------- 顶层输出装配 ----------
  function pack(action, fields) {
    return Object.assign({
      action,
      amount: action && action.amount != null ? action.amount : 0,
      confidence: fields.confidence,
      reason: fields.reason,
      handClass: fields.handClass,
      equity: fields.equity,
      potOdds: fields.potOdds,
      boardTexture: fields.boardTexture,
      riskLevel: fields.riskLevel,
      intent: fields.intent,
      reactionTimeMs: fields.reactionTimeMs,
      features: fields.features || {},
    });
  }

  function decideBotAction(ctx) {
    const rng = ctx.seed === undefined ? Math.random : seedRng(ctx.seed);
    const profile = ctx.botProfile;
    const reactionTimeMs = reactionTime(ctx, rng);
    const odds = ctx.amountToCall > 0 ? ctx.amountToCall / Math.max(1, ctx.pot + ctx.amountToCall) : 0;
    if (ctx.stack <= 0) {
      return pack({ type: 'check' }, { confidence: 1, reason: '无可用筹码，跳过。', handClass: 'n/a', equity: 0, potOdds: odds, boardTexture: 'n/a', riskLevel: RISK.LOW, intent: INTENT.GIVE_UP, reactionTimeMs, features: {} });
    }
    if (ctx.street === 'preflop') return decidePreflop(ctx, rng, reactionTimeMs, odds);
    // 翻后：委托 PostflopHeuristics
    const d = Post.decide(ctx, rng);
    return pack(d.action, {
      confidence: d.confidence, reason: d.reason, handClass: d.handClassId,
      equity: d.equity, potOdds: d.odds, boardTexture: d.boardText, riskLevel: d.riskLevel, intent: d.intent,
      reactionTimeMs,
      features: { equity: d.equity, potOdds: d.odds, boardWetness: d.texture.wetness, spr: d.spr, madeHand: d.handClassId, handClassCn: d.handClassCn, fromHole: d.fromHole, fromBoard: d.fromBoard, drawSummary: d.draws.summary, profileBias: profile.displayName, strength: d.rawStrength, actionHistory: d.historySummary },
    });
  }

  function decidePreflop(ctx, rng, reactionTimeMs, odds) {
    const advice = Preflop.classifyPreflop(ctx.holeCards, ctx);
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
    if (shortStack && (advice.handClass === 'premium' || (advice.handClass === 'strong' && ctx.effectiveStack <= ctx.bigBlind * 14))) weights['all-in'] = hasLegal(ctx, 'all-in') ? 0.9 : 0;
    if (profile.archetype === 'nit') { weights.fold *= 1.30; weights.call *= 0.80; weights.raise *= 0.85; }
    else if (profile.archetype === 'calling_station') { weights.call *= 1.55; weights.fold *= 0.70; weights.raise *= 0.55; }
    else if (profile.archetype === 'maniac') { weights.raise *= 1.65; weights.bet *= 1.45; weights.fold *= 0.70; }
    else if (profile.archetype === 'loose_aggressive') { weights.raise *= 1.25; weights.call *= 1.10; }
    else if (profile.archetype === 'loose_passive') { weights.call *= 1.35; weights.raise *= 0.55; weights.bet *= 0.6; }
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

    const intent = action.type === 'fold' ? INTENT.PREFLOP_FOLD
      : action.type === 'all-in' ? INTENT.PREFLOP_SHOVE
      : action.type === 'call' || action.type === 'check' ? INTENT.PREFLOP_CALL
      : pressure ? INTENT.PREFLOP_3BET : INTENT.PREFLOP_OPEN;
    const riskLevel = action.type === 'all-in' ? (advice.handClass === 'premium' ? RISK.MEDIUM : RISK.HIGH)
      : (action.type === 'fold' || action.type === 'check') ? RISK.LOW
      : (action.type === 'raise' || action.type === 'bet') ? (advice.handClass === 'premium' || advice.handClass === 'strong' ? RISK.LOW : RISK.MEDIUM)
      : RISK.MEDIUM;
    const actTxt = { fold: '弃牌', check: '过牌', call: '跟注', bet: `加注到 ${action.amount}`, raise: `再加注到 ${action.amount}`, 'all-in': '全下' }[action.type] || action.type;
    const reason = `${ctx.position} 位置，${advice.code} 属于${advice.handClass}起手（评分${Math.round(score)}/100）。${pressure ? '面对前序加注，范围收紧' : '前面无人加注，按位置开池范围'}，意图：${INTENT_CN[intent]}，风险：${RISK_CN[riskLevel]}。选择${actTxt}。`;
    return pack(action, {
      confidence: clamp(score / 100, 0.20, 0.95), reason,
      handClass: advice.handClass, equity: clamp(score / 100, 0, 1), potOdds: odds, boardTexture: '翻前无公共牌', riskLevel, intent, reactionTimeMs,
      features: { handCode: advice.code, handClass: advice.handClass, baseScore: score, profileBias: profile.displayName },
    });
  }
  function preflopOpenAmount(ctx, rng) { return clampAmountToLegal(ctx, ctx.bigBlind * randRange(rng, 2.2, 3.0), 'bet'); }
  function preflopRaiseAmount(ctx, rng) {
    const priorRaise = Math.max(ctx.currentBet, ctx.bigBlind * 2.5);
    const inPosition = ctx.position === 'CO' || ctx.position === 'BTN';
    const factor = inPosition ? randRange(rng, 2.6, 3.2) : randRange(rng, 3.0, 3.8);
    return clampAmountToLegal(ctx, priorRaise * factor, 'raise');
  }

  // ---- 向后兼容导出（旧调用方：BotDecisionEngine / test-bot / 训练 UI）----
  return {
    HandCategory,
    DEFAULT_BOT_PROFILES: Profiles.DEFAULT_BOT_PROFILES,
    handCode: Preflop.handCode,
    classifyPreflop: Preflop.classifyPreflop,
    analyzeBoardTexture: Board.analyze,
    analyzeDraws: EQ.analyzeDraws,
    classifyMadeHand: EQ.classifyMadeHand,
    decideBotAction,
  };
});
