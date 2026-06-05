/* PostflopHeuristics —— 翻后决策：价值/薄价值/诈唬/半诈唬/过牌跟注/过牌加注/抓诈唬 + 下注尺度 + 风险等级 + 复盘理由。
   决策权重沿用经回归验证的公式（不引入随机 Bot：随机仅用于受控的诈唬频率/尺度抖动，且可种子复现）。纯逻辑，无 UI。 */
(function (root, factory) {
  const req = (typeof require !== 'undefined');
  const Board = req ? require('./BoardTexture.js') : window.RHCore.BoardTexture;
  const EQ = req ? require('./EquityCalculator.js') : window.RHCore.EquityCalculator;
  const T = req ? require('./types.js') : window.RHCore.AiTypes;
  const HCD = req ? require('./HandClassDescriber.js') : window.RHCore.HandClassDescriber;
  const BTD = req ? require('./BoardTextureDescriber.js') : window.RHCore.BoardTextureDescriber;
  const AHF = req ? require('./ActionHistoryFormatter.js') : window.RHCore.ActionHistoryFormatter;
  const DRF = req ? require('./DecisionReasonFormatter.js') : window.RHCore.DecisionReasonFormatter;
  const m = factory(Board, EQ, T, HCD, BTD, AHF, DRF);
  if (typeof module !== 'undefined' && module.exports) module.exports = m;
  if (typeof window !== 'undefined') (window.RHCore = window.RHCore || {}).PostflopHeuristics = m;
})(this, function (Board, EQ, T, HCD, BTD, AHF, DRF) {
  const INTENT = T.INTENT, INTENT_CN = T.INTENT_CN, RISK = T.RISK, RISK_CN = T.RISK_CN, MADE = T.MADE;
  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
  const hasLegal = (ctx, type) => ctx.legalActions.some((a) => a.type === type);
  const legalOf = (ctx, type) => ctx.legalActions.find((a) => a.type === type);
  const randRange = (rng, min, max) => min + (max - min) * rng();
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
  function chooseBetSize(ctx, strength, wetness, rng) {
    const profile = ctx.botProfile;
    const basePot = Math.max(ctx.pot, ctx.bigBlind * 2);
    let fraction = 0.33;
    if (strength > 0.82) fraction = wetness > 55 ? 0.78 : 0.62;
    else if (strength > 0.62) fraction = wetness > 55 ? 0.66 : 0.50;
    else if (strength > 0.45) fraction = 0.33;
    else fraction = profile.aggression > 0.70 ? 0.45 : 0.30;
    fraction *= randRange(rng, 0.88, 1.14);
    if (ctx.amountToCall > 0 && hasLegal(ctx, 'raise')) return clampAmountToLegal(ctx, ctx.currentBet + basePot * fraction, 'raise');
    return clampAmountToLegal(ctx, basePot * fraction, 'bet');
  }
  const potOdds = (ctx) => (ctx.amountToCall <= 0 ? 0 : ctx.amountToCall / Math.max(1, ctx.pot + ctx.amountToCall));
  const spr = (ctx) => ctx.effectiveStack / Math.max(ctx.pot, ctx.bigBlind);
  function fallbackAction(ctx) {
    if (hasLegal(ctx, 'check')) return { type: 'check' };
    if (hasLegal(ctx, 'call')) return { type: 'call' };
    if (hasLegal(ctx, 'fold')) return { type: 'fold' };
    return { type: 'all-in' };
  }
  function iCheckedThisStreet(ctx) {
    const acts = ctx.actionsThisStreet || (ctx.previousActions || []).filter((a) => a.street === ctx.street);
    return acts.some((a) => (a.playerId === ctx.botId || a.seat === ctx.seat) && a.action && a.action.type === 'check');
  }

  function decide(ctx, rng) {
    const profile = ctx.botProfile;
    const value = EQ.classifyMadeHand(ctx.holeCards, ctx.board);
    const texture = Board.analyze(ctx.board);
    const draws = EQ.analyzeDraws(ctx.holeCards, ctx.board);
    const odds = potOdds(ctx);
    const stackPotRatio = spr(ctx);
    const equityResult = EQ.estimate({ hero: ctx.holeCards, board: ctx.board, opponents: Math.max(1, ctx.activeOpponents), samples: 500, rng });
    const equity = equityResult.win + equityResult.tie * 0.5;
    let madeStrength = value.category / 8;
    if (value.category >= 2) madeStrength += 0.12;
    if (value.category >= 5) madeStrength += 0.12;
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
    else if (profile.archetype === 'loose_passive') { weights.call *= 1.25; weights.raise *= 0.6; weights.bet *= 0.7; }
    else if (profile.archetype === 'loose_aggressive') { weights.bet *= 1.25; weights.raise *= 1.3; }

    // —— 剥削调整：读取本街进攻者(villain)的对手统计 ——
    const v = ctx.villain;
    if (v && v.sample >= 8) {
      if (v.foldToCbet > 0.55) { weights.bet *= 1.25; weights.raise *= 1.20; }           // 对手爱弃 → 多打
      if (v.wentToShowdown > 0.42 && v.aggressionFactor < 1.2) { weights.bet *= 0.7; weights.raise *= 0.6; if (rawStrength > 0.55) { weights.bet *= 1.6; weights.raise *= 1.5; } } // 跟注站 → 少诈唬、强牌多薄价值
      if (v.aggressionFactor > 2.2 && rawStrength > 0.45 && canCall) weights.call *= 1.4;  // 对手太凶 → 多抓诈唬
    }

    // —— check-raise 启发式(真实，非仅检测)：本街已 check 且面对下注、可加注 ——
    const iChecked = iCheckedThisStreet(ctx);
    const hasDraw0 = draws.comboDraw || draws.flushDraw || draws.openEndedStraightDraw || draws.gutshot;
    const multiway = ctx.activeOpponents > 1;
    if (iChecked && ctx.amountToCall > 0 && canRaise) {
      if (rawStrength > 0.75) weights.raise *= 1.8;                                        // 强成牌：check-raise 价值
      else if (hasDraw0 && rawStrength >= 0.45 && rawStrength < 0.72) {                     // 强听牌：check-raise 半诈唬
        let f = 1.4 + profile.bluffFrequency; if (texture.wetness > 55) f += 0.2; if (multiway) f *= 0.6;
        if (v && v.wentToShowdown > 0.42) f *= 0.55;                                        // 跟注站不弃，少半诈唬
        weights.raise *= f;
      } else if (rawStrength < 0.4 && texture.wetness < 40 && !multiway) {                  // 干面低频 check-raise 诈唬
        let f = profile.bluffFrequency * (profile.archetype === 'maniac' ? 2.2 : profile.archetype === 'calling_station' ? 0.2 : 1);
        if (v && v.foldToCbet > 0.55) f *= 1.6;
        weights.raise += clamp(f, 0, 0.5);
      }
    }
    const picked = chooseWeighted(weights, rng);
    let action = fallbackAction(ctx);
    if (picked === 'fold' && canFold) action = { type: 'fold' };
    if (picked === 'check' && canCheck) action = { type: 'check' };
    if (picked === 'call' && canCall) action = { type: 'call' };
    if (picked === 'bet' && canBet) action = { type: 'bet', amount: chooseBetSize(ctx, rawStrength, texture.wetness, rng) };
    if (picked === 'raise' && canRaise) action = { type: 'raise', amount: chooseBetSize(ctx, rawStrength, texture.wetness, rng) };
    if (picked === 'all-in' && hasLegal(ctx, 'all-in')) action = { type: 'all-in' };

    const hasDraw = draws.comboDraw || draws.flushDraw || draws.openEndedStraightDraw || draws.gutshot;
    const intent = classifyIntent(action, { rawStrength, equity, odds, hasDraw, made: value.made, iChecked: iCheckedThisStreet(ctx), street: ctx.street });
    const riskLevel = classifyRisk(action, rawStrength, intent);
    const confidence = clamp(Math.abs(equity - odds) + rawStrength * 0.4, 0.25, 0.95);
    // 细粒度描述 + 富理由(G 解释层)
    const hc = HCD.describe(ctx.holeCards, ctx.board);
    const bt = BTD.describe(ctx.board);
    const hist = AHF.format(ctx.previousActions || []);
    const reason = DRF.format({
      street: ctx.street, position: ctx.position, handClassCn: hc.cn, boardTextureCn: bt.cn,
      equity, potOdds: odds, spr: stackPotRatio, intent, action, pot: ctx.pot,
      historyCn: hist.cn, rangeHint: hist.rangeHint,
    });
    return { action, rawStrength, equity, odds, texture, draws, value, handClassId: hc.class, handClassCn: hc.cn, boardText: bt.text, fromHole: hc.fromHole, fromBoard: hc.fromBoard, intent, riskLevel, confidence, reason, spr: stackPotRatio, historySummary: hist.en };
  }

  function classifyIntent(action, f) {
    const t = action.type;
    if (t === 'fold') return INTENT.GIVE_UP;
    if (t === 'check') return f.rawStrength >= 0.5 ? INTENT.POT_CONTROL : INTENT.GIVE_UP;
    if (t === 'call') {
      if (f.street === 'river' && f.made !== MADE.NONE && f.rawStrength < 0.62) return INTENT.BLUFF_CATCH;
      if (f.hasDraw && f.rawStrength < 0.6) return INTENT.CHECK_CALL; // 听牌跟注（含赔率）
      return INTENT.CHECK_CALL;
    }
    // bet / raise / all-in
    if (f.iChecked && (t === 'raise' || t === 'all-in')) return INTENT.CHECK_RAISE;
    if (f.rawStrength >= 0.78) return INTENT.VALUE;
    if (f.hasDraw && f.rawStrength < 0.72) return INTENT.SEMI_BLUFF;
    if (f.rawStrength >= 0.5) return INTENT.THIN_VALUE;
    return INTENT.BLUFF;
  }
  function classifyRisk(action, rawStrength, intent) {
    const t = action.type;
    if (t === 'fold' || t === 'check') return RISK.LOW;
    if (t === 'all-in') return rawStrength >= 0.72 ? RISK.MEDIUM : RISK.HIGH;
    if (intent === INTENT.BLUFF || intent === INTENT.SEMI_BLUFF || intent === INTENT.CHECK_RAISE) return RISK.HIGH;
    if (intent === INTENT.VALUE) return RISK.LOW;
    if (intent === INTENT.BLUFF_CATCH || intent === INTENT.THIN_VALUE) return RISK.MEDIUM;
    return RISK.MEDIUM;
  }
  function actionText(action) {
    if (action.type === 'bet') return `下注 ${action.amount}`;
    if (action.type === 'raise') return `加注到 ${action.amount}`;
    if (action.type === 'all-in') return '全下';
    return { fold: '弃牌', check: '过牌', call: '跟注' }[action.type] || action.type;
  }
  function buildReason(ctx, action, value, equity, odds, texture, draws, strength, intent, risk) {
    const eqp = Math.round(equity * 100), op = Math.round(odds * 100);
    const seg = [];
    seg.push(`${ctx.position} 翻后`);
    seg.push(`手牌=${value.label}${value.kickerStrength === 0 && (value.made === T.MADE.TOP_PAIR) ? '(弱踢脚)' : ''}`);
    if (draws.summary !== '无明显听牌') seg.push(draws.summary);
    seg.push(`牌面${texture.description}`);
    seg.push(`权益≈${eqp}%`);
    if (ctx.amountToCall > 0) seg.push(`底池赔率≈${op}%`);
    seg.push(`意图：${INTENT_CN[intent]}`);
    seg.push(`风险：${RISK_CN[risk]}`);
    // 针对性提示句（贴近训练讲解）
    let note = '';
    if (intent === INTENT.BLUFF_CATCH) note = '用边缘成牌抓诈唬，仅跟一手。';
    else if (intent === INTENT.SEMI_BLUFF) note = '靠听牌施压，没成牌也有补牌权益。';
    else if (intent === INTENT.VALUE) note = '强成牌做价值下注，让更差的牌付钱。';
    else if (intent === INTENT.THIN_VALUE) note = '中等成牌薄价值，控制尺度避免被反加。';
    else if (intent === INTENT.CHECK_RAISE) note = '在被下注后加注施压。';
    else if (intent === INTENT.GIVE_UP && action.type === 'fold' && ctx.amountToCall > 0 && eqp < op) note = `权益${eqp}%低于所需${op}%，弃牌更合理。`;
    else if (texture.wetness > 55 && (value.made === T.MADE.TOP_PAIR) && value.kickerStrength === 0) note = '牌面湿润，顶对弱踢脚不宜大额跟注。';
    return `${seg.join('，')}，选择${actionText(action)}。${note}`;
  }
  return { decide, chooseBetSize, potOdds, spr };
});
