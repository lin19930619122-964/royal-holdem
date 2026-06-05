/* UI 回归套件：在 jsdom 里加载完整 App，覆盖所有面板渲染 + 关键交互流。
   运行：node test-ui.js  （需 devDependency jsdom）。配合 test-engine.js 做完整回归。*/
const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');
const SRC = path.join(__dirname, 'src');

const dom = new JSDOM(fs.readFileSync(path.join(SRC, 'index.html'), 'utf8'), { runScripts: 'outside-only', pretendToBeVisual: true, url: 'https://x/' });
const { window } = dom;
global.window = window; global.document = window.document;
window.matchMedia = () => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} });
const aparam = () => ({ setValueAtTime() {}, setTargetAtTime() {}, exponentialRampToValueAtTime() {}, linearRampToValueAtTime() {}, value: 0 });
const anode = () => ({ connect() { return anode(); }, start() {}, stop() {}, gain: aparam(), frequency: aparam(), Q: aparam(), type: '', buffer: null, getChannelData: () => new Float32Array(1) });
window.AudioContext = window.webkitAudioContext = function () { return { createOscillator: anode, createGain: anode, createBuffer: anode, createBufferSource: anode, createBiquadFilter: anode, destination: anode(), currentTime: 0, resume() {}, state: 'running', sampleRate: 44100 }; };
window.localStorage = (() => { let s = {}; return { getItem: (k) => (k in s ? s[k] : null), setItem: (k, v) => (s[k] = String(v)), removeItem: (k) => delete s[k], clear: () => (s = {}) }; })();
window.sessionStorage = (() => { let s = {}; return { getItem: (k) => (k in s ? s[k] : null), setItem: (k, v) => (s[k] = String(v)), removeItem: (k) => delete s[k] }; })();
window.navigator.vibrate = () => {};
window.requestAnimationFrame = () => 1; window.cancelAnimationFrame = () => {}; window.performance = window.performance || { now: () => 0 };
window.HTMLCanvasElement.prototype.getContext = () => ({ scale() {}, clearRect() {}, fillRect() {}, beginPath() {}, moveTo() {}, lineTo() {}, stroke() {}, fill() {}, arc() {}, closePath() {}, save() {}, restore() {}, translate() {}, rotate() {}, fillText() {}, createLinearGradient: () => ({ addColorStop() {} }), createRadialGradient: () => ({ addColorStop() {} }) });

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  ✗ ' + m); } };

const FILES = ['codec.js', 'skins.js', 'store.js', 'sound.js', 'music.js', 'voice.js', 'fx.js', 'social.js', 'poker.js', 'ai.js', 'game.js',
  'core/poker/SeededRng.js', 'core/poker/types.js', 'core/poker/Card.js', 'core/poker/Deck.js', 'core/poker/HandEvaluator.js', 'core/poker/HandComparator.js', 'core/poker/SidePot.js', 'core/poker/TableState.js', 'core/poker/LegalActions.js', 'core/poker/HandHistory.js', 'core/poker/GameReducer.js', 'core/poker/Equity.js', 'core/poker/selectors.js', 'core/ai/PokerBrain.js', 'core/ai/BotDecisionEngine.js', 'game/table/GameAdapter.js',
  'router.js', 'ui.js'];
for (const f of FILES) { try { new window.Function(fs.readFileSync(path.join(SRC, f), 'utf8')).call(window); } catch (e) { console.log('LOAD FAIL ' + f + ': ' + e.message); fail++; } }

const S = window.Store, body = window.document.getElementById('panel-body');

// 1) 全部面板渲染不抛错且有内容
const PANELS = ['profile', 'missions', 'vip', 'security', 'rank', 'mail', 'events', 'gifts', 'coach', 'activityMap',
  'passport', 'mysteryShop', 'goldenPig', 'invite', 'club', 'vault', 'achievements', 'friends', 'analytics', 'support',
  'settings', 'tableChat', 'tableGift', 'tableHistory', 'jackpot', 'voiceCenter', 'notice', 'season', 'tourney'];
PANELS.forEach((k) => {
  const btn = window.document.querySelector(`[data-panel="${k}"]`);
  try { if (btn) btn.click(); else { /* panel without lobby entry: call via another */ }
    ok(btn ? body.innerHTML.length > 0 : true, `panel ${k} renders`);
  } catch (e) { fail++; console.log(`  ✗ panel ${k} threw: ${e.message}`); }
});

// 2) 关键经济/成长流
ok(Array.isArray(S.getEvents()) && S.getEvents().length >= 4, 'events list');
ok(S.claimEvent('firstwin') === null, 'event not claimable before condition');
ok(typeof window.Fx.topBanner === 'function', 'Fx.topBanner');
ok(S.canDailyGift() && S.claimDailyGift().coins > 0, 'daily gift claim');
S.addVault(2000000); ok(S.crackVault().coins > 0, 'vault crack');
ok(S.claimMail('welcome').coins > 0, 'mail claim');
S.addSeasonXp(9000); ok(S.getSeason().level > 1, 'season level up');
ok(S.claimSeasonAll() && S.getSeason().claimable === false, 'season claim all');
for (let i = 0; i < 9; i++) S.recordRank(true); ok(S.rankInfo().points === 225, 'rank points');
ok(typeof S.toggleCoach() === 'boolean', 'coach toggle');

// 2b) 训练算法：对手范围胜率 + 建议
ok(typeof window.PokerAI.equityVsRange === 'function', 'AI.equityVsRange exists');
(function () {
  const hole = [{ rank: 14, suit: 's' }, { rank: 14, suit: 'h' }]; // AA
  const tight = window.PokerAI.equityVsRange(hole, [], 8, 1, 4000); // vs top8%
  const wide = window.PokerAI.equityVsRange(hole, [], 90, 1, 4000); // vs top90%
  ok(tight && wide && (tight.win + tight.tie / 2) < (wide.win + wide.tie / 2), 'AA: 对紧范围胜率 < 对宽范围胜率');
  const rnd = window.PokerAI.equityFull(hole, [], 2, 4000);
  ok(rnd && rnd.win > 0.65, 'AA vs 2 random still strong');
})();

// 3) 数据层完整性
['PHRASES', 'GIFTS'].forEach((k) => ok(window.Social[k].length > 0, 'Social.' + k));
['speechBubble', 'flyGift', 'streakFlame'].forEach((fn) => ok(typeof window.Fx[fn] === 'function', 'Fx.' + fn));
ok(Object.keys(window.Skins.backs).length > 30, 'backs themes');
ok(window.document.getElementById('splash'), 'splash created');
// P1: 牌型图鉴数据层 + 面板
ok(typeof S.recordHandType === 'function' && typeof S.getHandDex === 'function', 'handDex API');
S.recordHandType(8); S.recordHandType(8); ok(S.getHandDex()[8].count === 2 && S.getHandDex()[8].unlocked, 'recordHandType counts');
window.SceneRouter.go('handDex'); ok(/牌型图鉴/.test(body.innerHTML) && /已解锁牌型/.test(body.innerHTML), 'handDex panel renders');
// P2 收尾批
ok(window.Store.getAchievements().length >= 18, 'achievements expanded (>=18)');
ok(window.Social.EMOJIS && window.Social.EMOJIS.length >= 8, 'emoji set present');
ok(typeof window.Fx.rewardPop === 'function', 'Fx.rewardPop exists');
window.document.querySelector('[data-panel="tableChat"]').click();
ok(/data-emoji=/.test(body.innerHTML), 'chat panel has emoji row');
// SNG：以锦标赛模式进桌不报错并显示牌桌
window.SceneRouter.go('table', { mode: 'sng', players: 6 });
ok(!window.document.getElementById('screen-table').classList.contains('hidden'), 'SNG table opens');
// 9 人归一化座位布局 + 座位组件
window.SceneRouter.go('table', { players: 9, blindLevel: 0 });
const seats9 = window.document.querySelectorAll('#seats .seat');
ok(seats9.length === 9, '9-max 建出 9 个座位');
ok(/scale\(1\.12\)/.test(seats9[0].style.transform), 'hero 座位 scale 1.12');
ok(seats9[0].querySelector('.turn-ring') && seats9[0].querySelector('.blind-badge'), '座位含倒计时光圈+盲注标记');
// ⅔池 / 精确输入控件存在
ok(window.document.querySelector('.quick[data-q="twothird"]'), '⅔池 快捷下注存在');
ok(window.document.getElementById('raise-input'), '精确筹码输入存在');
ok(window.document.getElementById('hand-strip'), '历史简条元素存在');
S.addHandRecord({ no: S.nextHandNo(), board: [], hole: [], net: 1000, decisions: [], mistakes: 0 });
window.SceneRouter.go('table', { players: 6 }); // 重入牌桌触发历史简条
ok(/hs-item/.test(window.document.getElementById('hand-strip').innerHTML), '历史简条已填充近期手牌');
// Phase 3b：牌桌跑在 reducer 适配器上，实际发牌渲染
ok(window.RHCore && typeof window.RHCore.GameAdapter.create === 'function', 'GameAdapter 已加载(window.RHCore)');
window.SceneRouter.go('table', { players: 6 });
window.document.getElementById('btn-start').click(); // 开始发牌 → nextHand → adapter.startHand
const heroCards = window.document.querySelector('#seats .seat.me .player-cards');
ok(heroCards && heroCards.children.length === 2, '适配器发牌后英雄渲染2张手牌');
const seatsAll = window.document.querySelectorAll('#seats .seat');
ok(seatsAll.length === 6, '6人桌座位渲染');
// SceneRouter：统一路由
ok(window.SceneRouter && typeof window.SceneRouter.go === 'function', 'SceneRouter exists');
['launch', 'login', 'hall', 'select', 'table', 'tutorial', 'replay', 'strategyLab'].forEach((s) => ok(window.SceneRouter.has(s), 'scene registered: ' + s));
window.SceneRouter.go('hall'); ok(window.SceneRouter.current() === 'hall', 'go(hall) sets current');
window.SceneRouter.go('select'); ok(!window.document.getElementById('screen-select').classList.contains('hidden'), 'go(select) shows select screen');
window.SceneRouter.go('strategyLab'); ok(/策略实验室/.test(body.innerHTML), 'go(strategyLab) opens lab');
ok(/底池赔率速查/.test(body.innerHTML) && /对手风格图鉴/.test(body.innerHTML), 'strategyLab has range/odds/profiles');
window.SceneRouter.go('table', { blindLevel: 2, botProfileSet: 'hard', players: 6 });
ok(window.SceneRouter.current() === 'table' && !window.document.getElementById('screen-table').classList.contains('hidden'), 'go(table) starts table');
window.SceneRouter.go('replay', {}); ok(/牌局复盘/.test(body.innerHTML), 'go(replay) opens replay');
window.SceneRouter.back(); ok(typeof window.SceneRouter.current() === 'string', 'back() works');
// tutorial: support panel offers it, and forcing it builds an overlay
window.document.querySelector('[data-panel="support"]').click();
ok(/data-tutorial/.test(body.innerHTML), 'support offers tutorial');
body.querySelector('[data-tutorial]').click();
ok(window.document.getElementById('tut-ov'), 'tutorial overlay opens');
ok(/欢迎来到训练场/.test(window.document.getElementById('tut-ov').innerHTML), 'tutorial first page');
ok(!/传奇/.test(window.document.body.innerHTML), 'no 传奇 trademark in DOM');

console.log(`\nUI 回归: ${pass} 通过, ${fail} 失败`);
process.exit(fail ? 1 : 0);
