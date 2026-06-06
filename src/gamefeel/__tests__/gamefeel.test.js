/* GameFeel 子系统回归 —— 24 事件齐全 + 音频/触觉路由 + 各 Animator 经 stage 触发 + onVisual。
   运行：node src/gamefeel/__tests__/gamefeel.test.js */
const GFE = require('../GameFeelEvent.js');
const GFD = require('../GameFeelDirector.js');
const { harness } = require('../../core/poker/__tests__/_harness.js');
const { ok, eq, done } = harness('GameFeel 子系统');
const E = GFE.EVENTS;

// mock stage：记录各 Animator 调用
const calls = { fly: 0, seatCardEls: 0, boardCardEls: 0, winnerGlow: 0, foldMask: 0, active: 0, allInFocus: 0, best: 0, bigPot: 0, premium: 0, dim: 0, reveal: 0, achieve: 0 };
const fakeEl = () => ({ classList: { add() {}, remove() {} }, style: {}, offsetWidth: 1 });
const stage = {
  seatEl: () => fakeEl(), potEl: () => fakeEl(), winnerAnchorEl: () => fakeEl(),
  fly: () => { calls.fly++; },
  seatCardEls: () => { calls.seatCardEls++; return [fakeEl(), fakeEl()]; },
  boardCardEls: () => { calls.boardCardEls++; return [fakeEl(), fakeEl(), fakeEl(), fakeEl(), fakeEl()]; },
  winnerGlow: () => { calls.winnerGlow++; }, clearWinnerGlow: () => {},
  setFoldMask: () => { calls.foldMask++; }, setActiveSeat: () => { calls.active++; }, setThinking: () => {},
  allInFocus: () => { calls.allInFocus++; }, highlightBest: () => { calls.best++; }, clearHighlightBest: () => {},
  bigPotBanner: () => { calls.bigPot++; }, rollSeatStack: () => {}, premiumHandCue: () => { calls.premium++; },
  setShowdownDim: () => { calls.dim++; }, revealSeat: () => { calls.reveal++; }, achievementBanner: () => { calls.achieve++; },
};
const audioPlays = [];
const audio = { play: (k) => { audioPlays.push(k); return true; }, setCategory() {} };
const haptics = { fire: () => true, setEnabled() {}, isOn: () => true };

const GF = GFD.create({ audio, stage, haptics, immediate: true });

// 1) 24 事件常量齐全
eq(GFE.ALL.length, 24, '定义 24 个 GameFeelEvent');
['HAND_START', 'POST_BLINDS', 'DEAL_HOLE_CARD', 'HERO_PREMIUM_HAND', 'PLAYER_THINKING', 'PLAYER_FOLD', 'PLAYER_CHECK', 'PLAYER_CALL', 'PLAYER_BET', 'PLAYER_RAISE', 'PLAYER_ALL_IN', 'DEAL_FLOP', 'DEAL_TURN', 'DEAL_RIVER', 'SHOWDOWN_START', 'REVEAL_HAND', 'BEST_HAND_HIGHLIGHT', 'POT_TO_WINNER', 'HERO_WIN_SMALL', 'HERO_WIN_BIG', 'HERO_BAD_BEAT', 'HERO_GOOD_FOLD', 'ACHIEVEMENT_UNLOCKED', 'SESSION_SUMMARY'].forEach((k) => ok(E[k] === k, '事件存在: ' + k));

// 2) 每个事件 emit 都不抛错
let threw = 0;
GFE.ALL.forEach((k) => { try { GF.emit(E[k], { seat: 1, seatIndices: [0, 1, 2], winners: [{ seat: 0, amount: 2000, toStack: 5000 }], potBb: 60, highlight: [{ seat: 0, cardKeys: ['As'] }] }); } catch (e) { threw++; console.log('  ✗ emit 抛错 ' + k + ': ' + e.message); } });
ok(threw === 0, '2 全部 24 事件 emit 不抛错');

// 3) 视觉分发到正确 Animator（immediate 队列→同步）
ok(calls.seatCardEls > 0, '3 DEAL_HOLE_CARD→CardDealAnimator(座位卡)');
ok(calls.boardCardEls > 0, '3 DEAL_FLOP/TURN/RIVER→翻牌');
ok(calls.fly > 0, '3 下注/跟注/加注/赢池→ChipFly');
ok(calls.foldMask > 0, '3 PLAYER_FOLD→foldMask');
ok(calls.active > 0, '3 PLAYER_THINKING→激活座位高亮');
ok(calls.allInFocus > 0, '3 PLAYER_ALL_IN→桌面聚焦');
ok(calls.best > 0, '3 BEST_HAND_HIGHLIGHT→最佳五张高亮');
ok(calls.winnerGlow > 0, '3 POT_TO_WINNER→赢家发光');
ok(calls.bigPot > 0, '3 大底池(>=50BB)→big pot 反馈');
ok(calls.premium > 0, '3 HERO_PREMIUM_HAND→强起手提示');
ok(calls.dim > 0, '3 SHOWDOWN_START→桌面压暗 handler');
ok(calls.reveal > 0, '3 REVEAL_HAND→逐家翻牌 handler');
ok(calls.achieve > 0, '3 ACHIEVEMENT_UNLOCKED→成就横幅 handler');

// 3b) 24/24 事件都有 handler 或显式 silent(emit 全部不抛错已在 2 验证；此处验证摊牌链逐家 stagger)
(function () {
  const c2 = { dim: 0, reveal: 0, best: 0, award: 0 };
  const st2 = Object.assign({}, stage, { setShowdownDim: () => { c2.dim++; }, revealSeat: () => { c2.reveal++; }, highlightBest: () => { c2.best++; }, winnerGlow: () => { c2.award++; } });
  const G2 = GFD.create({ audio, stage: st2, haptics, immediate: true });
  G2.emit(E.SHOWDOWN_START, {});
  ['p0', 'p1', 'p2'].forEach((id, i) => G2.emit(E.REVEAL_HAND, { seat: i, hand: '两对' }));
  G2.emit(E.BEST_HAND_HIGHLIGHT, { highlight: [{ seat: 0, cardKeys: ['As'] }] });
  G2.emit(E.POT_TO_WINNER, { winners: [{ seat: 0, amount: 100 }], potBb: 5 });
  ok(c2.dim === 1, '3b 摊牌进入压暗 1 次');
  ok(c2.reveal === 3, '3b 逐家 REVEAL_HAND 各触发(3 家)');
  ok(c2.best === 1 && c2.award === 1, '3b 描金+派彩 handler 各触发');
})();

// 4) 音频路由：有 sfx 配置的事件应触发 audio.play
ok(audioPlays.includes('PLAYER_RAISE') && audioPlays.includes('HERO_WIN_BIG'), '4 配置了 sfx 的事件触发音频');
ok(!audioPlays.includes('PLAYER_THINKING'), '4 无 sfx 的事件不触发音频');

// 5) onVisual 订阅者收到 (event,payload,juice)
let got = null;
GF.onVisual((ev, pl, juice) => { if (ev === E.HERO_WIN_BIG) got = { ev, juice, amt: pl.winners && pl.winners[0].amount }; });
GF.emit(E.HERO_WIN_BIG, { winners: [{ seat: 0, amount: 9999 }], potBb: 80 });
ok(got && got.ev === E.HERO_WIN_BIG && got.juice === 'epic', '5 onVisual 收到事件+epic 级别');

// 5b) C：4 控制器是事件唯一 emit 源(经 director)
(function () {
  const Deal = require('../../controllers/DealController.js');
  const Show = require('../../controllers/ShowdownController.js');
  const Settle = require('../../controllers/SettlementController.js');
  const Act = require('../../controllers/ActionController.js');
  const G = GFD.create({ audio, stage, haptics, immediate: true });
  const deal = Deal.create(G), show = Show.create(G), settle = Settle.create(G), act = Act.create(G);
  deal.handStart(); deal.postBlinds(0, 1); deal.dealHole([0, 1]); deal.dealFlop(); deal.dealTurn(); deal.dealRiver();
  show.start(); show.reveal(0, '两对'); show.bestHand([{ seat: 0, cardKeys: ['As'] }]);
  settle.potToWinner([{ seat: 0, amount: 100 }], 5); settle.heroWin(100, true); settle.heroBadBeat(); settle.heroGoodFold(0); settle.sessionSummary(10, {}); settle.achievement('x', 1);
  act.thinking(0); act.acted(1, '加注'); act.fold(2); act.allIn(0);
  const evs = G.getEventLog().map((e) => e.event);
  const must = ['HAND_START', 'POST_BLINDS', 'DEAL_HOLE_CARD', 'DEAL_FLOP', 'DEAL_TURN', 'DEAL_RIVER', 'SHOWDOWN_START', 'REVEAL_HAND', 'BEST_HAND_HIGHLIGHT', 'POT_TO_WINNER', 'HERO_WIN_BIG', 'HERO_BAD_BEAT', 'HERO_GOOD_FOLD', 'SESSION_SUMMARY', 'ACHIEVEMENT_UNLOCKED', 'PLAYER_THINKING', 'PLAYER_RAISE', 'PLAYER_FOLD', 'PLAYER_ALL_IN'];
  must.forEach((m) => ok(evs.includes(m), '5b 控制器 emit ' + m));
})();

// 6) juiceOf
eq(GF.juiceOf(E.PLAYER_ALL_IN), 'epic', '6 全下=epic');
eq(GF.juiceOf(E.PLAYER_CHECK), 'subtle', '6 过牌=subtle');

// 7) 事件序列日志(摊牌序列可打印) + 新闭环事件
(function () {
  const G2 = GFD.create({ audio, stage, haptics, immediate: true });
  ['SHOWDOWN_START', 'REVEAL_HAND', 'REVEAL_HAND', 'BEST_HAND_HIGHLIGHT', 'POT_TO_WINNER', 'SESSION_SUMMARY'].forEach((k, i) => G2.emit(E[k], { seat: i, winners: [{ seat: 0, amount: 100 }] }));
  const log = G2.getEventLog();
  ok(log.length === 6, '7 事件日志记录摊牌序列(6 步)');
  ok(log[0].event === 'SHOWDOWN_START' && log[3].event === 'BEST_HAND_HIGHLIGHT', '7 序列顺序正确');
  ok(/SHOWDOWN_START/.test(G2.printEventLog()) && /REVEAL_HAND/.test(G2.printEventLog()), '7 printEventLog 可读');
  // 24/24 闭环：之前缺的 3 个事件能进入并被记录
  const G3 = GFD.create({ audio, stage, haptics, immediate: true });
  ['REVEAL_HAND', 'HERO_GOOD_FOLD', 'ACHIEVEMENT_UNLOCKED'].forEach((k) => G3.emit(E[k], {}));
  const evs = G3.getEventLog().map((e) => e.event);
  ok(evs.includes('REVEAL_HAND') && evs.includes('HERO_GOOD_FOLD') && evs.includes('ACHIEVEMENT_UNLOCKED'), '7 补齐的 3 事件均可 emit 并记录');
})();

done();
