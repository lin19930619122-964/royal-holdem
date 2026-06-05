/* 合法行动 + 最小加注 + 全下自动跑牌 —— 覆盖必需用例 18~20。
   运行：node src/core/poker/__tests__/legal-actions.test.js */
const Legal = require('../LegalActions.js');
const TableState = require('../TableState.js');
const { reducer, runOut } = require('../GameReducer.js');
const { harness } = require('./_harness.js');
const { ok, eq, done } = harness('规则·合法行动/最小加注/全下跑牌');

// 合成最小状态（只含 LegalActions.forCurrent 读取的字段）
const pl = (o) => Object.assign({ id: 'p', seat: 0, bet: 0, totalBet: 0, stack: 10000, folded: false, allIn: false, sittingOut: false, cappedToCall: false }, o);
const st = (o) => Object.assign({ current: 0, currentBet: 0, minRaise: 100, lastRaiseSize: 100, config: { bigBlind: 100 } }, o);

// ---------- 18) 最小加注规则 ----------
(function () {
  // 翻前面对大盲 100：最小加注到 200
  let s = st({ currentBet: 100, players: [pl({ bet: 0, stack: 10000 })] });
  let o = Legal.forCurrent(s);
  eq(o.minRaiseTo, 200, '18 面对BB100→最小加注到200');
  eq(o.maxRaiseTo, 10000, '18 最大加注到=有效筹码');
  ok(Legal.isLegal(s, 'raise', 200), '18 加注到200合法');
  ok(!Legal.isLegal(s, 'raise', 199), '18 加注到199非法(<最小)');
  ok(!Legal.isLegal(s, 'raise', 150), '18 加注到150非法');
  ok(Legal.isLegal(s, 'raise', 10000), '18 加注到满筹合法');
  ok(!Legal.isLegal(s, 'raise', 10001), '18 超过有效筹码非法');

  // 开池下注：currentBet=0 → 最小下注=BB
  s = st({ currentBet: 0, players: [pl({ bet: 0 })] });
  o = Legal.forCurrent(s);
  ok(o.isBet && o.actions.includes('bet'), '18 无人下注时可 bet');
  eq(o.minRaiseTo, 100, '18 开池最小下注=BB');
  ok(Legal.isLegal(s, 'bet', 100) && !Legal.isLegal(s, 'bet', 50), '18 下注100合法/50非法');

  // 再加注：上一个加注增量=300(从100加到400) → 最小再加注到700
  s = st({ currentBet: 400, lastRaiseSize: 300, players: [pl({ bet: 0, stack: 10000 })] });
  o = Legal.forCurrent(s);
  eq(o.minRaiseTo, 700, '18 再加注需≥上次加注幅度(400+300=700)');
  ok(Legal.isLegal(s, 'raise', 700) && !Legal.isLegal(s, 'raise', 600), '18 再加注700合法/600非法');
})();

// ---------- 19) check/call/raise/fold/all-in 合法性 ----------
(function () {
  // 无人下注：可 check、可 fold、可 all-in，不可 call
  let o = Legal.forCurrent(st({ currentBet: 0, players: [pl({ bet: 0 })] }));
  ok(o.actions.includes('check') && !o.actions.includes('call'), '19 无注可过牌/不可跟注');
  ok(o.actions.includes('fold') && o.actions.includes('allin'), '19 始终可弃牌/有筹码可全下');

  // 面对下注：不可 check、可 call、可 fold
  o = Legal.forCurrent(st({ currentBet: 100, players: [pl({ bet: 0 })] }));
  ok(!o.actions.includes('check') && o.actions.includes('call'), '19 面对下注不可过牌/可跟注');

  // 被限定只能跟注(cappedToCall)：不可 raise
  o = Legal.forCurrent(st({ currentBet: 200, players: [pl({ bet: 0, cappedToCall: true })] }));
  ok(!o.actions.includes('raise'), '19 cappedToCall→不可再加注');
  ok(o.actions.includes('call') && o.actions.includes('fold'), '19 cappedToCall→仍可跟/弃');

  // 短码(stack<toCall)：可 call(部分=全下)/可 all-in，不可 raise
  o = Legal.forCurrent(st({ currentBet: 100, players: [pl({ bet: 0, stack: 80 })] }));
  ok(!o.actions.includes('raise'), '19 短码不可加注');
  ok(o.actions.includes('allin'), '19 短码可全下');

  // 已弃牌/已全下/坐出 → 无合法动作
  ok(Legal.forCurrent(st({ players: [pl({ folded: true })] })).actions.length === 0, '19 已弃牌无动作');
  ok(Legal.forCurrent(st({ players: [pl({ allIn: true })] })).actions.length === 0, '19 已全下无动作');
  ok(Legal.forCurrent(st({ players: [pl({ sittingOut: true })] })).actions.length === 0, '19 坐出无动作');
})();

// ---------- 20) all-in 后自动跑牌（纯核心 runOut） ----------
(function () {
  const START = 1000, N = 2;
  let s = TableState.create({ numPlayers: N, smallBlind: 50, bigBlind: 100, startingStack: START, seed: 42 });
  s = reducer(s, { type: 'START_NEXT_HAND' });
  s = reducer(s, { type: 'DEAL_HOLE_CARDS' });
  // 双方依次全下
  let guard = 0;
  while (s.current >= 0 && !s.handOver && guard++ < 12) {
    const o = Legal.forCurrent(s);
    const act = o.actions.includes('allin') ? 'allin' : (o.actions.includes('call') ? 'call' : 'check');
    s = reducer(s, { type: 'PLAYER_ACTION', playerId: s.players[s.current].id, action: act });
  }
  // 此时应等待发牌而非玩家行动
  ok(s.current < 0, '20 双方全下后无需玩家行动');
  s = runOut(s);
  ok(s.handOver, '20 runOut 后本手结束');
  eq(s.board.length, 5, '20 自动补满 5 张公共牌');
  ok(!!s.result && s.result.showdown, '20 进入摊牌结算');
  const sumStacks = s.players.reduce((a, p) => a + p.stack, 0);
  eq(sumStacks, N * START, '20 筹码守恒：结算后总筹码=2000');
  const winners = s.players.filter((p) => p.winThisHand > 0);
  ok(winners.length >= 1, '20 至少一名赢家获得底池');
})();

done();
