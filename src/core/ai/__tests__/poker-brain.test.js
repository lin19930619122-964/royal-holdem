/* PokerBrain 返工回归 —— 富输出/复盘理由/确定性/7 画像差异/位置与翻后概念。
   运行：node src/core/ai/__tests__/poker-brain.test.js */
const Card = require('../../poker/Card.js');
const Brain = require('../PokerBrain.js');
const { harness } = require('../../poker/__tests__/_harness.js');
const { ok, eq, done } = harness('AI·PokerBrain 返工');
const P = Brain.DEFAULT_BOT_PROFILES;
const C = (s) => s.split(' ').map(Card.parse);

const LEGAL_FACING = [{ type: 'fold' }, { type: 'call' }, { type: 'raise', minAmount: 200, maxAmount: 10000 }, { type: 'all-in' }];
const LEGAL_OPEN = [{ type: 'fold' }, { type: 'check' }, { type: 'bet', minAmount: 100, maxAmount: 10000 }, { type: 'all-in' }];
function base(over) {
  return Object.assign({
    street: 'preflop', botId: 'b', holeCards: C('Ah Ad'), board: [],
    pot: 150, amountToCall: 100, currentBet: 100, minRaiseTo: 200, lastRaiseSize: 100, stack: 10000, effectiveStack: 10000,
    bigBlind: 100, position: 'UTG', playersInHand: 6, activeOpponents: 5, previousActions: [], actionsThisStreet: [],
    legalActions: LEGAL_FACING, botProfile: P.balanced_reg,
  }, over);
}
function sample(ov, profile, n) {
  const c = { fold: 0, check: 0, call: 0, bet: 0, raise: 0, 'all-in': 0 };
  for (let i = 1; i <= n; i++) { const d = Brain.decideBotAction(base(Object.assign({ botProfile: profile, seed: i * 7 + 1 }, ov))); c[d.action.type]++; }
  return c;
}

// A) 不存在随机 Bot：同 seed → 同决策（可复现）
(() => {
  const ctx = base({ seed: 123, holeCards: C('Kh Qh'), position: 'CO' });
  const a = Brain.decideBotAction(ctx), b = Brain.decideBotAction(ctx);
  ok(JSON.stringify(a.action) === JSON.stringify(b.action), 'A 同种子→同决策(确定性，非随机Bot)');
})();

// B) 富输出：9 个必需字段齐全
(() => {
  const d = Brain.decideBotAction(base({ street: 'flop', holeCards: C('Ah Kd'), board: C('As 9h 4c'), legalActions: LEGAL_FACING, seed: 5 }));
  ['action', 'amount', 'confidence', 'reason', 'handClass', 'equity', 'potOdds', 'boardTexture', 'riskLevel'].forEach((k) => ok(k in d, `B 输出含字段 ${k}`));
  ok(typeof d.reason === 'string' && d.reason.length > 10, 'B reason 为非空讲解');
  ok(d.equity >= 0 && d.equity <= 1, 'B equity 在 [0,1]');
  ok(['low', 'medium', 'high'].includes(d.riskLevel), 'B riskLevel 合法');
})();

// C) 7 种画像均可决策且行为有别（用 AKo UTG 面对加注的弃牌率区分紧/松）
(() => {
  Object.keys(P).forEach((k) => { const d = Brain.decideBotAction(base({ botProfile: P[k], seed: 9 })); ok(d && d.action && d.action.type, `C ${k} 能产出决策`); });
  // 开池位(无人加注)用边缘牌区分：nit 弃得多、maniac 开池多
  const marginalOpen = { holeCards: C('Q8s'.length ? 'Qh 8h' : 'Qh 8h'), position: 'CO', amountToCall: 0, currentBet: 0, legalActions: LEGAL_OPEN };
  const nitFold = sample(marginalOpen, P.nit, 80).fold;
  const maniacFold = sample(marginalOpen, P.maniac, 80).fold;
  ok(nitFold > maniacFold, `C nit 比 maniac 更常弃边缘开池(${nitFold} vs ${maniacFold})`);
  // 中等牌面对加注：跟注站比 nit 更常跟注
  const callSpot = { holeCards: C('Ah Jc'), position: 'BB', legalActions: LEGAL_FACING };
  const stationCall = sample(callSpot, P.calling_station, 80).call;
  const nitCall = sample(callSpot, P.nit, 80).call;
  ok(stationCall > nitCall, `C 跟注站比 nit 更常跟注 AJo(${stationCall} vs ${nitCall})`);
  const maniacAggr = (() => { const c = sample({ holeCards: C('Jh Td'), position: 'CO', amountToCall: 0, currentBet: 0, legalActions: LEGAL_OPEN }, P.maniac, 80); return c.bet + c.raise; })();
  const nitAggr = (() => { const c = sample({ holeCards: C('Jh Td'), position: 'CO', amountToCall: 0, currentBet: 0, legalActions: LEGAL_OPEN }, P.nit, 80); return c.bet + c.raise; })();
  ok(maniacAggr > nitAggr, `C maniac 比 nit 更常主动下注(${maniacAggr} vs ${nitAggr})`);
})();

// D) 位置意识：AA UTG 翻前绝不弃；7-2o UTG 极少加注
(() => {
  const aa = sample({ holeCards: C('Ah Ad'), position: 'UTG', legalActions: LEGAL_FACING }, P.balanced_reg, 100);
  ok(aa.fold === 0, `D AA UTG 从不弃牌(fold=${aa.fold})`);
  ok(aa.raise + aa['all-in'] > 60, 'D AA UTG 多数加注/全下');
  const trash = sample({ holeCards: C('7h 2d'), position: 'UTG', amountToCall: 0, currentBet: 0, legalActions: LEGAL_OPEN }, P.balanced_reg, 100);
  ok((trash.raise + trash.bet) <= 12, `D 7-2o UTG 极少主动加注(${trash.raise + trash.bet})`);
})();

// E) 翻后细粒度 handClass + 富 boardTexture（G 解释层）
(() => {
  const setCtx = base({ street: 'flop', holeCards: C('9h 9d'), board: C('9s 8h 7h'), amountToCall: 0, currentBet: 0, legalActions: LEGAL_OPEN, botProfile: P.tight_aggressive, seed: 3, activeOpponents: 1 });
  const d1 = Brain.decideBotAction(setCtx);
  ok(['set', 'full_house', 'trips', 'straight'].includes(d1.handClass), `E set→handClass=${d1.handClass}`);
})();

// E2) 必达：AsQs / Qh7d2c → top_pair_good_kicker + rainbow dry q-high disconnected + reason 含 SPR/actionHistory
(() => {
  const ctx = base({ street: 'flop', holeCards: C('As Qs'), board: C('Qh 7d 2c'), amountToCall: 0, currentBet: 0, pot: 418, stack: 2440, effectiveStack: 2440, legalActions: LEGAL_OPEN, position: 'CO', activeOpponents: 2, botProfile: P.tight_aggressive, seed: 23,
    previousActions: [{ street: 'preflop', pos: 'BTN', seat: 3, action: { type: 'call' } }, { street: 'preflop', pos: 'BB', seat: 2, action: { type: 'call' } }] });
  const d = Brain.decideBotAction(ctx);
  ok(d.handClass === 'top_pair_good_kicker', `E2 handClass=top_pair_good_kicker (实=${d.handClass})`);
  ok(d.boardTexture === 'rainbow dry q-high disconnected', `E2 boardTexture (实=${d.boardTexture})`);
  ok(/SPR 5\.8/.test(d.reason), 'E2 reason 含 SPR 5.8');
  ok(/BTN 翻前跟注/.test(d.reason) && /BB 翻前跟注/.test(d.reason), 'E2 reason 含 actionHistory');
  ok(/价值|半池/.test(d.reason) && !/概率合适|权益较高$/.test(d.reason), 'E2 reason 非废话(含尺度/价值)');
  ok(!/1 张高张/.test(d.reason), 'E2 不把 A 踢脚误描述成"1 张高张"');
})();

done();
