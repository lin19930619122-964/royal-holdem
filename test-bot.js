/* V4 Phase 2 回归：PokerBrain Bot 行为（算法规格 §8 / V4 §12.4）。无 UI。 */
const Card = require('./src/core/poker/Card.js');
const Brain = require('./src/core/ai/PokerBrain.js');
const P = Brain.DEFAULT_BOT_PROFILES;
const C = (s) => Card.parse(s);

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  ✗ ' + m); } };

const LEGAL_FACING = [{ type: 'fold' }, { type: 'call' }, { type: 'raise', minAmount: 200, maxAmount: 10000 }, { type: 'all-in' }];
const LEGAL_OPEN = [{ type: 'fold' }, { type: 'call' }, { type: 'check' }, { type: 'bet', minAmount: 100, maxAmount: 10000 }, { type: 'raise', minAmount: 200, maxAmount: 10000 }, { type: 'all-in' }];

function base(over) {
  return Object.assign({
    street: 'preflop', botId: 'b', holeCards: [C('Ah'), C('Ad')], board: [],
    pot: 150, amountToCall: 100, currentBet: 100, minRaiseTo: 200, stack: 10000, effectiveStack: 10000,
    bigBlind: 100, position: 'UTG', playersInHand: 6, activeOpponents: 5, previousActions: [],
    legalActions: LEGAL_FACING, tableStats: { handsPlayed: 0, tableAggression: 0.3, averagePotBb: 5 },
    botProfile: P.balanced_reg,
  }, over);
}
function sample(ov, profile, n) {
  const c = { fold: 0, check: 0, call: 0, bet: 0, raise: 0, 'all-in': 0 };
  for (let i = 1; i <= n; i++) { const d = Brain.decideBotAction(base(Object.assign({ botProfile: profile, seed: i * 7 + 1 }, ov))); c[d.action.type]++; }
  return c;
}

// 1) AA UTG 翻前不 limp：大概率加注/全下，绝不弃
(() => {
  const c = sample({ holeCards: [C('Ah'), C('Ad')], position: 'UTG' }, P.balanced_reg, 120);
  ok(c.fold === 0, 'AA 翻前从不弃牌');
  ok(c.raise + c['all-in'] >= 84, 'AA 翻前大概率加注/全下(≥70%)');
  ok(c.raise + c['all-in'] > c.call, 'AA 加注多于跟注(不 limp)');
})();

// 2) 72o UTG 大概率弃牌
(() => {
  const c = sample({ holeCards: [C('7h'), C('2d')], position: 'UTG' }, P.balanced_reg, 120);
  ok(c.fold >= 96, '72o UTG 大概率弃牌(≥80%)');
})();

// 3) BTN 范围宽于 UTG（开牌权重）
(() => {
  const btn = Brain.classifyPreflop([C('Kh'), C('Js')], { position: 'BTN', amountToCall: 0, bigBlind: 100, previousActions: [] });
  const utg = Brain.classifyPreflop([C('Kh'), C('Js')], { position: 'UTG', amountToCall: 0, bigBlind: 100, previousActions: [] });
  ok(btn.openRaiseWeight > utg.openRaiseWeight, 'KJs 在 BTN 开牌权重 > UTG');
  ok(btn.baseScore > utg.baseScore, 'BTN 评分高于 UTG');
})();

// 4) 跟注站比岩石更爱跟注（翻后第二对面对半池）
(() => {
  const ov = { street: 'flop', holeCards: [C('Kh'), C('9s')], board: [C('Ad'), C('9h'), C('2c')], pot: 300, amountToCall: 150, currentBet: 150, activeOpponents: 1, legalActions: LEGAL_FACING };
  const station = sample(ov, P.calling_station, 80);
  const nit = sample(ov, P.nit, 80);
  ok(station.call > nit.call, `跟注站跟注(${station.call}) > 岩石跟注(${nit.call})`);
  ok(nit.fold > station.fold, `岩石弃牌(${nit.fold}) > 跟注站弃牌(${station.fold})`);
})();

// 5) 疯狗比紧凶更激进（翻后可下注的空气位）
(() => {
  const ov = { street: 'flop', holeCards: [C('Jh'), C('4d')], board: [C('Ks'), C('8h'), C('3c')], pot: 200, amountToCall: 0, currentBet: 0, activeOpponents: 1, legalActions: LEGAL_OPEN };
  const maniac = sample(ov, P.maniac, 80);
  const tag = sample(ov, P.tight_aggressive, 80);
  ok((maniac.bet + maniac.raise) > (tag.bet + tag.raise), `疯狗下注/加注(${maniac.bet + maniac.raise}) > 紧凶(${tag.bet + tag.raise})`);
})();

// 6) 空气牌面对满池下注：弃牌为主
(() => {
  const ov = { street: 'flop', holeCards: [C('Jh'), C('4d')], board: [C('As'), C('Kd'), C('9c')], pot: 300, amountToCall: 300, currentBet: 300, activeOpponents: 2, legalActions: LEGAL_FACING };
  const c = sample(ov, P.balanced_reg, 80);
  ok(c.fold >= c.call + c.raise + c['all-in'], `空气牌面对满池注以弃牌为主(fold=${c.fold})`);
})();

// 7) 坚果同花听牌面对小注：不应以弃牌为主
(() => {
  const ov = { street: 'flop', holeCards: [C('Ah'), C('Kh')], board: [C('Qh'), C('7h'), C('2c')], pot: 300, amountToCall: 90, currentBet: 90, activeOpponents: 1, legalActions: LEGAL_FACING };
  const c = sample(ov, P.balanced_reg, 80);
  ok(c.fold < c.call + c.raise + c['all-in'], `坚果同花听牌小注下不弃为主(fold=${c.fold}, 继续=${c.call + c.raise + c['all-in']})`);
})();

// 8) 七种画像参数齐全且互异
(() => {
  const keys = Object.keys(P);
  ok(keys.length === 7, '7 种 archetype');
  const vpips = keys.map((k) => P[k].vpipTarget);
  ok(new Set(vpips).size >= 6, 'VPIP 参数基本互异');
  ok(P.maniac.bluffFrequency > P.nit.bluffFrequency && P.calling_station.callDownLightness > P.tight_aggressive.callDownLightness, '疯狗诈唬>岩石、跟注站跟注松度>紧凶');
})();

// 9) 决策带结构化理由与特征
(() => {
  const d = Brain.decideBotAction(base({ street: 'flop', holeCards: [C('Ah'), C('Kh')], board: [C('Qh'), C('7h'), C('2c')], amountToCall: 100, currentBet: 100, activeOpponents: 1, botProfile: P.tight_aggressive, seed: 5 }));
  ok(typeof d.reason === 'string' && d.reason.length > 0, '决策含 reason');
  ok(d.features && typeof d.features.equity === 'number' && typeof d.features.boardWetness === 'number', '决策含 features(equity/wetness)');
  ok(typeof d.reactionTimeMs === 'number' && d.reactionTimeMs > 0, '决策含思考时长');
})();

console.log(`\nV4 Bot 行为回归: ${pass} 通过, ${fail} 失败`);
process.exit(fail ? 1 : 0);
