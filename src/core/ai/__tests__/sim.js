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

// 7 种 Bot × 20 手样例日志（含 street/position/handClass/boardTexture/SPR/equity/potOdds/actionHistory/decision/reason）
const HIST = [{ street: 'preflop', pos: 'BTN', seat: 3, action: { type: 'call' } }, { street: 'preflop', pos: 'BB', seat: 2, action: { type: 'call' } }];
const SPOTS = [
  ['翻前UTG AA', { street: 'preflop', holeCards: C('Ah Ad'), board: [], position: 'UTG', amountToCall: 100, currentBet: 100, minRaiseTo: 200, legalActions: LEGAL_FACING, activeOpponents: 5 }],
  ['翻前BTN 72o 开池', { street: 'preflop', holeCards: C('7h 2d'), board: [], position: 'BTN', amountToCall: 0, currentBet: 0, legalActions: LEGAL_OPEN, activeOpponents: 2 }],
  ['翻前CO KJs 开池', { street: 'preflop', holeCards: C('Kh Jh'), board: [], position: 'CO', amountToCall: 0, currentBet: 0, legalActions: LEGAL_OPEN, activeOpponents: 3 }],
  ['翻前BB 99 面加注', { street: 'preflop', holeCards: C('9h 9d'), board: [], position: 'BB', amountToCall: 300, currentBet: 300, minRaiseTo: 600, legalActions: LEGAL_FACING, activeOpponents: 2, previousActions: [{ street: 'preflop', pos: 'CO', action: { type: 'raise' } }] }],
  ['翻牌 AsQs/Qh7d2c 无人下注', { street: 'flop', holeCards: C('As Qs'), board: C('Qh 7d 2c'), position: 'CO', amountToCall: 0, currentBet: 0, pot: 418, stack: 2440, effectiveStack: 2440, legalActions: LEGAL_OPEN, activeOpponents: 2, previousActions: HIST }],
  ['翻牌 顶set 湿面', { street: 'flop', holeCards: C('9h 9d'), board: C('9s 8h 7h'), position: 'BTN', amountToCall: 0, currentBet: 0, pot: 600, legalActions: LEGAL_OPEN, activeOpponents: 1 }],
  ['翻牌 超对 干面', { street: 'flop', holeCards: C('Ah Ad'), board: C('Kd 7c 2s'), position: 'CO', amountToCall: 0, currentBet: 0, pot: 500, legalActions: LEGAL_OPEN, activeOpponents: 1 }],
  ['翻牌 同花听牌 干面', { street: 'flop', holeCards: C('Kh Qh'), board: C('Jh 7h 2c'), position: 'BTN', amountToCall: 0, currentBet: 0, pot: 400, legalActions: LEGAL_OPEN, activeOpponents: 1 }],
  ['翻牌 两头顺听 面对下注', { street: 'flop', holeCards: C('Th 9d'), board: C('8s 7c 2h'), position: 'BB', amountToCall: 300, currentBet: 300, pot: 600, legalActions: LEGAL_FACING, activeOpponents: 1 }],
  ['翻牌 顶对弱踢 面对下注', { street: 'flop', holeCards: C('Ah 5c'), board: C('Ad 9h 8h'), position: 'CO', amountToCall: 300, currentBet: 300, pot: 600, legalActions: LEGAL_FACING, activeOpponents: 1 }],
  ['翻牌 空气 干面', { street: 'flop', holeCards: C('Qh Jc'), board: C('Ad 7s 2c'), position: 'BTN', amountToCall: 0, currentBet: 0, pot: 300, legalActions: LEGAL_OPEN, activeOpponents: 1 }],
  ['转牌 成顺 面对下注', { street: 'turn', holeCards: C('Th 9d'), board: C('8s 7c 6h 2d'), position: 'BB', amountToCall: 500, currentBet: 500, pot: 1200, legalActions: LEGAL_FACING, activeOpponents: 1 }],
  ['转牌 中对 面对下注', { street: 'turn', holeCards: C('9h 9d'), board: C('Kd 8h 4c 2s'), position: 'CO', amountToCall: 400, currentBet: 400, pot: 900, legalActions: LEGAL_FACING, activeOpponents: 1 }],
  ['河牌 坚果同花 无人下注', { street: 'river', holeCards: C('Ah Kh'), board: C('Qh 7h 2h 9d 3c'), position: 'BTN', amountToCall: 0, currentBet: 0, pot: 1000, legalActions: LEGAL_OPEN, activeOpponents: 1 }],
  ['河牌 边缘成牌 面对大注', { street: 'river', holeCards: C('Ah Tc'), board: C('As 9d 4h 2c 7s'), position: 'CO', amountToCall: 600, currentBet: 600, pot: 1200, legalActions: LEGAL_FACING, activeOpponents: 1 }],
  ['河牌 空气 面对下注', { street: 'river', holeCards: C('Jh Tc'), board: C('Ad Kc 5s 5h 2d'), position: 'BB', amountToCall: 400, currentBet: 400, pot: 900, legalActions: LEGAL_FACING, activeOpponents: 1 }],
  ['翻牌 两对 湿面', { street: 'flop', holeCards: C('Ah 9c'), board: C('As 9h 6h'), position: 'CO', amountToCall: 0, currentBet: 0, pot: 500, legalActions: LEGAL_OPEN, activeOpponents: 2 }],
  ['翻牌 暗三 面对下注', { street: 'flop', holeCards: C('7h 7d'), board: C('Kd 7c 2s'), position: 'BB', amountToCall: 250, currentBet: 250, pot: 500, legalActions: LEGAL_FACING, activeOpponents: 1 }],
  ['翻牌 中对+卡顺 面对下注', { street: 'flop', holeCards: C('Th 9d'), board: C('Jc 9h 4s'), position: 'BTN', amountToCall: 200, currentBet: 200, pot: 450, legalActions: LEGAL_FACING, activeOpponents: 1 }],
  ['翻前HJ ATs 面加注', { street: 'preflop', holeCards: C('Ah Th'), board: [], position: 'HJ', amountToCall: 300, currentBet: 300, legalActions: LEGAL_FACING, activeOpponents: 3, previousActions: [{ street: 'preflop', pos: 'UTG', action: { type: 'raise' } }] }],
];
for (const k of Object.keys(P)) {
  console.log(`\n===== ${P[k].displayName} (${k}) · 20 手样例 =====`);
  SPOTS.forEach(([label, sp], i) => {
    const d = Brain.decideBotAction(ctx(Object.assign({}, sp, { botProfile: P[k], seed: (i + 1) * 31 + 7 })));
    const a = d.action.type + (d.action.amount ? '@' + d.action.amount : '');
    const spr = d.features.spr != null ? d.features.spr.toFixed(1) : '-';
    console.log(`  ${String(i + 1).padStart(2)} ${label.padEnd(22)} → ${a.padEnd(11)}| ${(sp.position || '-')}/${d.handClass}/${d.boardTexture} | SPR${spr} eq${Math.round(d.equity * 100)}% po${Math.round(d.potOdds * 100)}% | ${d.intent}/${d.riskLevel}`);
    if (i === 4) console.log(`       reason: ${d.reason}`);   // AsQs/Qh7d2c 那手打印完整 reason
  });
}
