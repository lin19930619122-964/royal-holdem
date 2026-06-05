/* BotDecisionEngine —— 把牌桌(GameAdapter 接口)的当前状态构建成 DecisionContext，
   交给 PokerBrain.decideBotAction 决策，再翻译回旧式 {action, amount} 供 game.act 调用。
   这样活体游戏的 bot 用上 V4 结构化 AI（位置/范围/牌面/赔率/SPR/画像），不再是简单阈值。无 UI。 */
(function (root, factory) {
  const req = (typeof require !== 'undefined');
  const Brain = req ? require('./PokerBrain.js') : window.RHCore.PokerBrain;
  const m = factory(Brain);
  if (typeof module !== 'undefined' && module.exports) module.exports = m;
  if (typeof window !== 'undefined') (window.RHCore = window.RHCore || {}).BotDecisionEngine = m;
})(this, function (Brain) {
  const PROFILES = Brain.DEFAULT_BOT_PROFILES;

  function positionOf(game, seat) {
    const N = game.N, btn = game.button;
    if (seat === game.sbIdx) return 'SB';
    if (seat === game.bbIdx) return 'BB';
    if (seat === btn) return 'BTN';
    const rel = (((seat - btn) % N) + N) % N; // 1=SB,2=BB,...,N-1=CO/BTN-1
    const afterBB = rel - 3, span = N - 3;     // BB 与 BTN 之间的席位数
    if (span <= 1) return 'CO';
    if (afterBB >= span - 1) return 'CO';
    if (afterBB <= 0) return 'UTG';
    return 'MP';
  }
  function effectiveStack(game, seat) {
    const me = game.players[seat], myTotal = me.chips + me.bet;
    let maxOther = 0;
    for (let i = 0; i < game.N; i++) { const p = game.players[i]; if (i === seat || p.folded || p.out) continue; maxOther = Math.max(maxOther, p.chips + p.bet); }
    return Math.max(game.bigBlind, Math.min(myTotal, maxOther || myTotal));
  }
  function activeOpponents(game, seat) {
    let n = 0;
    for (let i = 0; i < game.N; i++) { const p = game.players[i]; if (i === seat || p.folded || p.out) continue; n++; }
    return Math.max(1, n);
  }

  // game：GameAdapter 实例；seat：行动者座位（应等于 game.current）。opts.profile/seed 可选。
  function decide(game, seat, opts) {
    opts = opts || {};
    const p = game.players[seat];
    const o = game.actionOptions();
    const legal = [{ type: 'fold' }];
    if (o.canCheck) legal.push({ type: 'check' });
    if (o.toCall > 0 && o.callAmount > 0) legal.push({ type: 'call' });
    if (o.canRaise) legal.push({ type: o.isBet ? 'bet' : 'raise', minAmount: o.minRaiseTo, maxAmount: o.maxRaiseTo });
    legal.push({ type: 'all-in' });

    // 跨街手牌历史：从 reducer 权威日志(game.log)抽取本手 ACTION 序列
    const street = game.street || game.phase;
    const rawLog = (game.log || []).filter((e) => e.t === 'ACTION' && e.hand === game.handNo);
    const history = rawLog.map((e) => ({ street: e.street, seat: e.seat, pos: positionOf(game, e.seat), playerId: String((game.players[e.seat] && game.players[e.seat].id) != null ? game.players[e.seat].id : e.seat), action: { type: e.act === 'allin' ? 'all-in' : e.act }, amount: e.amount }));
    const actionsThisStreet = history.filter((e) => e.street === street);
    // 剥削：取本街最近的进攻者(下注/加注)的对手统计作为 villain
    const oppStats = opts.oppStats || {};
    let villainSeat = null;
    for (let k = actionsThisStreet.length - 1; k >= 0; k--) { const a = actionsThisStreet[k]; if (a.seat !== seat && (a.action.type === 'bet' || a.action.type === 'raise' || a.action.type === 'all-in')) { villainSeat = a.seat; break; } }
    const villain = villainSeat != null ? oppStats[villainSeat] : null;

    const ctx = {
      street, botId: String(p.id), holeCards: p.hole, board: game.board,
      pot: game.pot, amountToCall: o.toCall, currentBet: game.currentBet, minRaiseTo: o.minRaiseTo,
      stack: p.chips, effectiveStack: effectiveStack(game, seat), bigBlind: game.bigBlind,
      position: positionOf(game, seat), playersInHand: game.N, activeOpponents: activeOpponents(game, seat),
      previousActions: history, actionsThisStreet, seat, legalActions: legal,
      opponentStats: oppStats, villain,
      tableStats: { handsPlayed: game.handNo || 0, tableAggression: 0.35, averagePotBb: game.pot / (game.bigBlind || 1) },
      botProfile: opts.profile || PROFILES.balanced_reg,
      seed: opts.seed,
    };
    const d = Brain.decideBotAction(ctx);
    return Object.assign({ reactionTimeMs: d.reactionTimeMs, reason: d.reason, features: d.features }, toLegacy(d.action, o));
  }

  // 翻译为旧引擎/适配器接受的 {action, amount}
  function toLegacy(a, o) {
    switch (a.type) {
      case 'fold': return { action: 'fold' };
      case 'check': return { action: 'check' };
      case 'call': return { action: 'call' };
      case 'bet': return { action: 'raise', amount: a.amount };   // 开池：适配器把 raise@currentBet0 视为 bet
      case 'raise': return { action: 'raise', amount: a.amount };
      case 'all-in':
        // 能整额加注则 raise 到全下额；否则按 call(短码自动全下)
        if (o.canRaise && o.maxRaiseTo >= o.minRaiseTo) return { action: 'raise', amount: o.maxRaiseTo };
        return o.toCall > 0 ? { action: 'call' } : { action: 'check' };
      default: return o.canCheck ? { action: 'check' } : (o.toCall > 0 ? { action: 'call' } : { action: 'fold' });
    }
  }

  // 难度→画像池（让一桌有不同性格）
  const POOLS = {
    casual: ['balanced_reg', 'loose_passive', 'calling_station', 'tight_aggressive', 'loose_aggressive', 'nit', 'maniac'],
    hard: ['tight_aggressive', 'balanced_reg', 'loose_aggressive', 'tight_aggressive', 'balanced_reg', 'nit', 'loose_aggressive'],
    master: ['tight_aggressive', 'balanced_reg', 'tight_aggressive', 'loose_aggressive', 'balanced_reg', 'tight_aggressive', 'nit'],
  };
  function profileForSeat(level, seat) {
    const pool = POOLS[level] || POOLS.casual;
    return PROFILES[pool[(seat - 1 + pool.length) % pool.length]] || PROFILES.balanced_reg;
  }

  return { decide, profileForSeat, positionOf, PROFILES };
});
