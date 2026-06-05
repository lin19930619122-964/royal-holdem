/* 边池/分配测试 —— 覆盖必需用例 13~17 + 平分(14)。运行：node src/core/poker/__tests__/side-pot.test.js */
const SidePot = require('../SidePot.js');
const { harness } = require('./_harness.js');
const { ok, eq, done } = harness('规则·边池与分配');

// 评分用简化分值数组（[类别,主牌...]），compare 与 HandEvaluator 同序。
const SCORES = { weak: [0, 7], mid: [1, 9], strong: [3, 12], top: [7, 14] };
const scoreOf = (map) => (seat) => map[seat];

// 13) 多人摊牌：3 人等额，最强者通吃单池
(function () {
  const players = [
    { seat: 0, totalBet: 100, folded: false },
    { seat: 1, totalBet: 100, folded: false },
    { seat: 2, totalBet: 100, folded: false },
  ];
  const pots = SidePot.compute(players);
  eq(pots.length, 1, '13 等额→单一主池');
  eq(pots[0].amount, 300, '13 主池=300');
  const d = SidePot.distribute(pots, scoreOf({ 0: SCORES.mid, 1: SCORES.top, 2: SCORES.weak }), [0, 1, 2]);
  eq(d.winnings, { 1: 300 }, '13 最强(seat1)通吃 300');
})();

// 14) 平分底池 + 奇数零头给庄位左手第一个赢家
(function () {
  // 三家投入：seat2 弃牌只投 1，seat0/1 各 100 → 池=201，0/1 平手
  const players = [
    { seat: 0, totalBet: 100, folded: false },
    { seat: 1, totalBet: 100, folded: false },
    { seat: 2, totalBet: 1, folded: true },
  ];
  const pots = SidePot.compute(players);
  const total = pots.reduce((a, b) => a + b.amount, 0);
  eq(total, 201, '14 总池=201(含弃牌死钱1)');
  // 庄位左手顺序 [1,0] → 零头应给 seat1
  const d = SidePot.distribute(pots, scoreOf({ 0: SCORES.top, 1: SCORES.top, 2: SCORES.weak }), [1, 0]);
  eq(d.winnings[1] + d.winnings[0], 201, '14 平分后总额守恒=201');
  eq(d.winnings[1], 101, '14 奇数零头给庄位左手第一个赢家(seat1)');
  eq(d.winnings[0], 100, '14 另一赢家得100');
})();

// 15) all-in 主池：全员等额全下 → 单一主池
(function () {
  const players = [
    { seat: 0, totalBet: 100, folded: false },
    { seat: 1, totalBet: 100, folded: false },
    { seat: 2, totalBet: 100, folded: false },
  ];
  const pots = SidePot.compute(players);
  eq(pots.length, 1, '15 等额全下→单一主池');
  eq(pots[0].eligible.sort(), [0, 1, 2], '15 三人均可领主池');
})();

// 16) all-in 边池：短码只能赢主池
(function () {
  const players = [
    { seat: 0, totalBet: 50, folded: false },   // 短码全下 50
    { seat: 1, totalBet: 200, folded: false },
    { seat: 2, totalBet: 200, folded: false },
  ];
  const pots = SidePot.compute(players);
  eq(pots.length, 2, '16 两层：主池+边池');
  eq(pots[0].amount, 150, '16 主池=50×3');
  eq(pots[0].eligible.sort(), [0, 1, 2], '16 主池三人可领');
  eq(pots[1].amount, 300, '16 边池=150×2');
  eq(pots[1].eligible.sort(), [1, 2], '16 边池仅 seat1/2 可领');
  // 短码最强：只拿主池，边池给次强(seat1>seat2)
  const d = SidePot.distribute(pots, scoreOf({ 0: SCORES.top, 1: SCORES.strong, 2: SCORES.mid }), [0, 1, 2]);
  eq(d.winnings[0], 150, '16 短码 seat0 只赢主池150');
  eq(d.winnings[1], 300, '16 边池给次强 seat1');
  ok(!d.winnings[2], '16 seat2 无所得');
})();

// 17) 多个边池：三档不同全下 → 三层池
(function () {
  const players = [
    { seat: 0, totalBet: 50, folded: false },
    { seat: 1, totalBet: 100, folded: false },
    { seat: 2, totalBet: 150, folded: false },
  ];
  const pots = SidePot.compute(players);
  eq(pots.length, 3, '17 三档全下→三层池');
  eq(pots.map((p) => p.amount), [150, 100, 50], '17 池额=[50×3,50×2,50×1]');
  eq(pots[0].eligible.sort(), [0, 1, 2], '17 主池三人');
  eq(pots[1].eligible.sort(), [1, 2], '17 第二池二人');
  eq(pots[2].eligible.sort(), [2], '17 第三池仅 seat2');
})();

done();
