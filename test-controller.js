/* Phase 2 回归：TableController + selectors（reducer 驱动的牌桌大脑）。无 UI。 */
const TableController = require('./src/game/table/TableController.js');
const selectors = require('./src/core/poker/selectors.js');
const Legal = require('./src/core/poker/LegalActions.js');

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  ✗ ' + m); } };

// 1) 控制器创建 + 英雄座位标记
(() => {
  const c = TableController.create({ config: { numPlayers: 6, smallBlind: 50, bigBlind: 100, startingStack: 10000, seed: 7 }, heroSeat: 0 });
  const s = c.getState();
  ok(s.players[0].isHuman === true, '英雄座位被标记 isHuman');
  ok(s.players.length === 6, '6 人桌创建');
})();

// 2) onChange 订阅触发
(() => {
  const c = TableController.create({ config: { numPlayers: 3, seed: 1 } });
  let fired = 0; c.onChange(() => fired++);
  c.startHand();
  ok(fired > 0, 'onChange 在 startHand 后触发');
})();

// 3) selectors 投影正确（座位/庄盲/英雄手牌/合法动作）
(() => {
  const c = TableController.create({ config: { numPlayers: 6, smallBlind: 50, bigBlind: 100, startingStack: 10000, seed: 3 }, heroSeat: 0 });
  c.startHand();
  const s = c.getState();
  const tv = selectors.tableView(s);
  ok(tv.seats.length === 6 && tv.seats[0].isHero, 'seatViews 含英雄');
  ok(tv.seats.some((x) => x.isButton) && tv.seats.some((x) => x.isSB) && tv.seats.some((x) => x.isBB), '庄/小盲/大盲标记齐');
  // 英雄能看到自己两张底牌，看不到别人的
  ok(tv.seats[0].hole && tv.seats[0].hole.length === 2, '英雄可见自己底牌');
  ok(tv.seats.filter((x) => !x.isHero).every((x) => x.hole === null), '他人底牌不可见(脱敏)');
  const hv = selectors.heroView(s);
  ok(hv && hv.hole.length === 2, 'heroView 含手牌');
})();

// 4) 人类回合：act 推进；非法动作被忽略
(() => {
  const c = TableController.create({ config: { numPlayers: 3, smallBlind: 50, bigBlind: 100, startingStack: 10000, seed: 9 }, heroSeat: 0 });
  c.startHand();
  c.pump(); // 自动推进到人类回合或手结束
  if (c.isHumanTurn()) {
    const before = JSON.stringify(c.getState().players.map((p) => p.stack));
    c.act('check'); // 面对大盲 check 非法 → 应被忽略，筹码不变
    const o = c.legal();
    if (!o.canCheck) ok(JSON.stringify(c.getState().players.map((p) => p.stack)) === before, '非法 check 被忽略');
    else ok(true, '可过牌(check 合法)');
  } else ok(true, '本局人类未轮到(已自动结束)');
})();

// 5) 全程自动跑一手：筹码守恒 + 手结束 + 历史日志（注入"全跟到底"AI）
(() => {
  function callBot(state) { const o = Legal.forCurrent(state); return o.canCheck ? { action: 'check' } : { action: 'call' }; }
  for (const seed of [1, 21, 333]) for (const n of [2, 6, 9]) {
    const c = TableController.create({ config: { numPlayers: n, smallBlind: 50, bigBlind: 100, ante: 10, startingStack: 10000, seed }, heroSeat: 0, aiDecide: callBot });
    const init = c.getState().players.reduce((a, p) => a + p.stack, 0);
    c.startHand();
    // 英雄也用 callBot 策略走完
    let guard = 0;
    while (!c.getState().handOver && guard++ < 400) {
      if (c.isHumanTurn()) c.act(c.legal().canCheck ? 'check' : 'call');
      else if (!c.step()) break;
    }
    const s = c.getState();
    const end = s.players.reduce((a, p) => a + p.stack, 0);
    ok(s.handOver && init === end, `controller 跑一手筹码守恒 seed=${seed} n=${n} (${init}->${end})`);
    ok(s.board.length === 5, `controller 摊牌补满5张 seed=${seed} n=${n}`);
    ok(s.log.length > 0, `controller 产生手牌日志 seed=${seed} n=${n}`);
  }
})();

// 6) 可复现：同 seed + 同策略 → 同结果
(() => {
  function callBot(state) { const o = Legal.forCurrent(state); return o.canCheck ? { action: 'check' } : { action: 'call' }; }
  function run() {
    const c = TableController.create({ config: { numPlayers: 6, seed: 2024 }, aiDecide: callBot });
    c.startHand(); let g = 0;
    while (!c.getState().handOver && g++ < 400) { if (c.isHumanTurn()) c.act(c.legal().canCheck ? 'check' : 'call'); else if (!c.step()) break; }
    return c.getState();
  }
  const a = run(), b = run();
  ok(JSON.stringify(a.board) === JSON.stringify(b.board) && JSON.stringify(a.result.winnings) === JSON.stringify(b.result.winnings), 'controller 同 seed 可复现');
})();

console.log(`\nPhase2 牌桌控制器回归: ${pass} 通过, ${fail} 失败`);
process.exit(fail ? 1 : 0);
