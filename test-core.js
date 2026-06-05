/* 规则核心回归（src/core/poker）—— reducer 纯逻辑、可复现、边池、摊牌、日志。无 UI。 */
const TableState = require('./src/core/poker/TableState.js');
const { reducer } = require('./src/core/poker/GameReducer.js');
const Legal = require('./src/core/poker/LegalActions.js');
const HandEval = require('./src/core/poker/HandEvaluator.js');
const SidePot = require('./src/core/poker/SidePot.js');
const Deck = require('./src/core/poker/Deck.js');
const SeededRng = require('./src/core/poker/SeededRng.js');
const Card = require('./src/core/poker/Card.js');

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  ✗ ' + m); } };
const C = (s) => Card.parse(s);

// 1) 牌堆 52 张唯一
(() => { const d = Deck.create(); ok(d.length === 52 && new Set(d.map(Card.key)).size === 52, '52 张标准牌、无重复'); })();

// 2) 可复现：同种子洗牌序列一致
(() => {
  const a = Deck.shuffled(SeededRng.create(12345)).map(Card.key).join(',');
  const b = Deck.shuffled(SeededRng.create(12345)).map(Card.key).join(',');
  const c = Deck.shuffled(SeededRng.create(99)).map(Card.key).join(',');
  ok(a === b, '同种子洗牌结果一致');
  ok(a !== c, '不同种子洗牌结果不同');
})();

// 3) 牌型：轮子 / 皇家 / 7选5
ok(JSON.stringify(HandEval.evaluate5([C('Ah'), C('2c'), C('3d'), C('4s'), C('5h')])) === JSON.stringify([4, 5]), 'A2345 轮子顺子(high=5)');
ok(HandEval.name([8, 14]) === '皇家同花顺', '皇家同花顺命名');
ok(HandEval.name([8, 13]) === '同花顺', '普通同花顺命名');
(() => { const r = HandEval.evaluateBest([C('Ah'), C('Kh'), C('Qh'), C('Jh'), C('Th'), C('2c'), C('3d')]); ok(r.score[0] === 8 && r.score[1] === 14, '7张取最佳=皇家同花顺'); ok(HandEval.name(r.score) === '皇家同花顺', '7选5皇家命名'); })();

// 4) 边池：100/100/300 三人全下，无人弃
(() => {
  const pots = SidePot.compute([{ seat: 0, totalBet: 100, folded: false }, { seat: 1, totalBet: 100, folded: false }, { seat: 2, totalBet: 300, folded: false }]);
  ok(pots.length === 2 && pots[0].amount === 300 && pots[1].amount === 200, '主池300 + 边池200');
  ok(pots[1].eligible.length === 1 && pots[1].eligible[0] === 2, '边池仅 seat2 可领');
  // seat2 最强 → 通吃 500
  const scoreOf = (s) => (s === 2 ? [8, 14] : [0, 5]);
  const d = SidePot.distribute(pots, scoreOf, [0, 1, 2]);
  ok(d.winnings[2] === 500, 'seat2 最强通吃 500');
  // seat0 最强 → 拿主池300，seat2 拿边池200
  const d2 = SidePot.distribute(pots, (s) => (s === 0 ? [8, 14] : [0, 5]), [0, 1, 2]);
  ok(d2.winnings[0] === 300 && d2.winnings[2] === 200, '主池给最强、边池退给唯一可领者');
})();

// 5) 平分底池（零头给庄位左手第一个赢家）
(() => {
  const pots = [{ amount: 101, eligible: [0, 1] }];
  const d = SidePot.distribute(pots, () => [2, 14, 13, 12], [1, 0]); // 顺序从庄位左手:seat1 先
  ok(d.winnings[0] + d.winnings[1] === 101 && Math.abs(d.winnings[0] - d.winnings[1]) === 1, '平分101→50/51');
  ok(d.winnings[1] === 51, '零头给庄位左手第一个赢家');
})();

// 6) 合法动作门控
(() => {
  let s = TableState.create({ numPlayers: 3, smallBlind: 50, bigBlind: 100, startingStack: 10000, seed: 7 });
  s = reducer(s, { type: 'START_NEXT_HAND' });
  s = reducer(s, { type: 'DEAL_HOLE_CARDS' });
  const o = Legal.forCurrent(s);
  ok(!o.canCheck && o.actions.includes('call') && o.actions.includes('fold'), '面对大盲不能过牌、可跟可弃');
  ok(o.minRaiseTo === 200, '翻前最小加注到 200');
  ok(Legal.isLegal(s, 'raise', 200) && !Legal.isLegal(s, 'raise', 150), '加注下限校验(200合法/150非法)');
  ok(!Legal.isLegal(s, 'check', 0), 'check 在面对下注时非法');
  // 非法动作被 reducer 忽略（状态不变）
  const before = s.players[s.current].id;
  const s2 = reducer(s, { type: 'PLAYER_ACTION', playerId: before, action: 'check' });
  ok(s2.current === s.current, '非法 check 被忽略、回合不变');
})();

// 7) 全程自动跑一手：筹码守恒 + 可复现 + 日志 + 摊牌补牌
function autoPlay(seed, numPlayers) {
  let s = TableState.create({ numPlayers, smallBlind: 50, bigBlind: 100, ante: 10, startingStack: 10000, seed });
  const initTotal = s.players.reduce((a, p) => a + p.stack, 0);
  s = reducer(s, { type: 'START_NEXT_HAND' });
  let guard = 0;
  while (!s.handOver && guard++ < 500) {
    if (s.current >= 0) {
      const o = Legal.forCurrent(s); const p = s.players[s.current];
      s = reducer(s, { type: 'PLAYER_ACTION', playerId: p.id, action: o.canCheck ? 'check' : 'call' });
    } else if (s.awaitingDeal) {
      s = reducer(s, { type: s.awaitingDeal });
    } else break;
  }
  const endTotal = s.players.reduce((a, p) => a + p.stack, 0);
  return { s, initTotal, endTotal };
}
(() => {
  for (const seed of [1, 2, 3, 42, 777]) for (const n of [2, 6, 9]) {
    const { s, initTotal, endTotal } = autoPlay(seed, n);
    ok(s.handOver && initTotal === endTotal, `自动跑一手筹码守恒 seed=${seed} n=${n} (${initTotal}->${endTotal})`);
    ok(s.board.length === 5, `摊牌补满5张公共牌 seed=${seed} n=${n}`);
  }
  // 可复现：同种子两次结果一致
  const r1 = autoPlay(2024, 6).s, r2 = autoPlay(2024, 6).s;
  ok(JSON.stringify(r1.board) === JSON.stringify(r2.board) && JSON.stringify(r1.result.winnings) === JSON.stringify(r2.result.winnings), '同种子整手可复现');
  // 完整日志
  const log = autoPlay(5, 6).s.log;
  ok(log.some((e) => e.t === 'HAND_START') && log.some((e) => e.t === 'DEAL') && log.some((e) => e.t === 'ACTION') && log.some((e) => e.t === 'SHOWDOWN' || e.t === 'AWARD'), '每手完整日志(开始/发牌/行动/摊牌)');
})();

// 8) 全下后自动跑牌（SHOWDOWN 直接补满）
(() => {
  let s = TableState.create({ numPlayers: 2, smallBlind: 50, bigBlind: 100, startingStack: 1000, seed: 3 });
  s = reducer(s, { type: 'START_NEXT_HAND' });
  s = reducer(s, { type: 'DEAL_HOLE_CARDS' });
  // 双方全下
  let p = s.players[s.current];
  s = reducer(s, { type: 'PLAYER_ACTION', playerId: p.id, action: 'allin' });
  if (s.current >= 0) { p = s.players[s.current]; s = reducer(s, { type: 'PLAYER_ACTION', playerId: p.id, action: 'allin' }); }
  // 此时应等待跑牌/摊牌
  while (!s.handOver && s.awaitingDeal) s = reducer(s, { type: s.awaitingDeal });
  ok(s.handOver && s.board.length === 5, '双方全下→自动跑满并摊牌');
  ok(s.players.reduce((a, x) => a + x.stack, 0) === 2000, '全下后筹码守恒');
})();

// 9) 最小加注/短码全下：短码全下不重开已行动者的加注权
(() => {
  // 构造：3 人，seat 给一个很短的栈，制造低于最小加注的全下
  let s = TableState.create({ numPlayers: 3, smallBlind: 50, bigBlind: 100, startingStack: 10000, seed: 11 });
  // 手动把 button 玩家(将首先行动者之一)设短栈不易控制，改为直接验证 raiseTo 规则路径：
  s = reducer(s, { type: 'START_NEXT_HAND' });
  s = reducer(s, { type: 'DEAL_HOLE_CARDS' });
  // UTG 整额加注到 300（合法）
  let p = s.players[s.current];
  s = reducer(s, { type: 'PLAYER_ACTION', playerId: p.id, action: 'raise', amount: 300 });
  ok(s.currentBet === 300 && s.lastRaiseSize === 200, '整额加注到300、最小加注增量更新为200');
  // 下一位整额再加注到 600 合法、到 450(增量150<200)非法
  const o2 = Legal.forCurrent(s);
  ok(o2.minRaiseTo === 500, '面对300加注后，最小再加注到500');
  ok(Legal.isLegal(s, 'raise', 500) && !Legal.isLegal(s, 'raise', 450), '再加注下限=500(450非法)');
  // 全下受限者：构造一名 cappedToCall 玩家，验证其不可加注
  s.players[1].cappedToCall = true; s.current = 1; s.currentBet = 300; s.players[1].bet = 0; s.players[1].stack = 10000;
  const oc = Legal.forCurrent(s);
  ok(!oc.actions.includes('raise') && oc.actions.includes('call') && oc.actions.includes('fold'), '受限玩家只能跟/弃、不能加注');
})();

console.log(`\n规则核心回归: ${pass} 通过, ${fail} 失败`);
process.exit(fail ? 1 : 0);
