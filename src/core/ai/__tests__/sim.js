/* AI 模拟脚本 —— 跑各画像在代表性场景下的行动分布 + 样例理由（人工核查用，非断言）。
   运行：node src/core/ai/__tests__/sim.js */
const Card = require('../../poker/Card.js');
const Brain = require('../PokerBrain.js');
const P = Brain.DEFAULT_BOT_PROFILES;
const C = (s) => s.split(' ').map(Card.parse);
const LEGAL_OPEN = [{ type: 'fold' }, { type: 'check' }, { type: 'bet', minAmount: 100, maxAmount: 10000 }, { type: 'all-in' }];
const LEGAL_FACING = [{ type: 'fold' }, { type: 'call' }, { type: 'raise', minAmount: 200, maxAmount: 10000 }, { type: 'all-in' }];

function ctx(over) {
  return Object.assign({ street: 'preflop', botId: 'b', holeCards: C('Ah Ad'), board: [], pot: 150, amountToCall: 0, currentBet: 0, minRaiseTo: 200, lastRaiseSize: 100, stack: 10000, effectiveStack: 10000, bigBlind: 100, position: 'CO', playersInHand: 6, activeOpponents: 5, previousActions: [], actionsThisStreet: [], legalActions: LEGAL_OPEN, botProfile: P.balanced_reg }, over);
}
function mix(profile, over, n) {
  const c = { fold: 0, check: 0, call: 0, bet: 0, raise: 0, 'all-in': 0 };
  for (let i = 1; i <= n; i++) c[Brain.decideBotAction(ctx(Object.assign({ botProfile: profile, seed: i * 13 + 1 }, over))).action.type]++;
  return c;
}
const pct = (c, n) => Object.entries(c).filter(([, v]) => v).map(([k, v]) => `${k} ${Math.round(v / n * 100)}%`).join('  ');

console.log('=== 各画像 · CO 位无人入池开池(代表牌 KJs) 行动分布(80样本) ===');
for (const k of Object.keys(P)) console.log(`  ${P[k].displayName.padEnd(5)} : ${pct(mix(P[k], { holeCards: C('Kh Jh') }, 80), 80)}`);

console.log('\n=== 各画像 · 面对加注(代表牌 99) 行动分布(80样本) ===');
for (const k of Object.keys(P)) console.log(`  ${P[k].displayName.padEnd(5)} : ${pct(mix(P[k], { holeCards: C('9h 9d'), amountToCall: 300, currentBet: 300, legalActions: LEGAL_FACING, previousActions: [{ street: 'preflop', action: { type: 'raise' } }] }, 80), 80)}`);

console.log('\n=== 样例复盘理由 ===');
const samples = [
  ['翻前 BTN AQs 无人入池', { holeCards: C('Ah Qh'), position: 'BTN', seed: 2 }],
  ['翻牌 顶对弱踢脚 湿面面对下注', { street: 'flop', holeCards: C('Ah 5c'), board: C('Ad 9h 8h'), amountToCall: 200, currentBet: 200, pot: 400, legalActions: LEGAL_FACING, seed: 3, activeOpponents: 1 }],
  ['翻牌 同花听牌 干面可下注', { street: 'flop', holeCards: C('Kh Qh'), board: C('Jh 7h 2c'), amountToCall: 0, currentBet: 0, legalActions: LEGAL_OPEN, botProfile: P.loose_aggressive, seed: 6, activeOpponents: 1 }],
  ['河牌 边缘成牌面对下注', { street: 'river', holeCards: C('Ah Tc'), board: C('As 9d 4h 2c 7s'), amountToCall: 500, currentBet: 500, pot: 1000, legalActions: [{ type: 'fold' }, { type: 'call' }], seed: 8, activeOpponents: 1 }],
];
for (const [label, ov] of samples) { const d = Brain.decideBotAction(ctx(ov)); console.log(`  [${label}]\n    → ${d.reason}`); }
