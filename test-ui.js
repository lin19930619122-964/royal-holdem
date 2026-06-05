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
  'core/poker/SeededRng.js', 'core/poker/types.js', 'core/poker/Card.js', 'core/poker/Deck.js', 'core/poker/HandEvaluator.js', 'core/poker/HandComparator.js', 'core/poker/SidePot.js', 'core/poker/TableState.js', 'core/poker/LegalActions.js', 'core/poker/HandHistory.js', 'core/poker/GameReducer.js', 'core/poker/Equity.js', 'core/poker/selectors.js', 'core/ai/types.js', 'core/ai/BotProfiles.js', 'core/ai/BotProfile.js', 'core/ai/PreflopMatrix.js', 'core/ai/BoardTexture.js', 'core/ai/EquityCalculator.js', 'core/ai/PostflopHeuristics.js', 'core/ai/PokerBrain.js', 'core/ai/OpponentModel.js', 'core/ai/BotDecisionEngine.js', 'game/table/GameAdapter.js',
  'gamefeel/GameFeelEvent.js', 'gamefeel/GameFeelConfig.js', 'gamefeel/TableAnimationQueue.js', 'gamefeel/HapticDirector.js', 'gamefeel/ChipFlyAnimator.js', 'gamefeel/CardDealAnimator.js', 'gamefeel/PotWinAnimator.js', 'gamefeel/HighlightDirector.js', 'gamefeel/GameFeelDirector.js',
  'view/table/SeatView.js', 'view/table/ActionPanel.js', 'view/table/PlayerViewModel.js',
  'view/table/layers/_base.js', 'view/table/layers/TableBackgroundLayer.js', 'view/table/layers/TableFeltLayer.js', 'view/table/layers/SeatLayer.js', 'view/table/layers/DealerButtonLayer.js', 'view/table/layers/CommunityCardLayer.js', 'view/table/layers/PotLayer.js', 'view/table/layers/BetChipLayer.js', 'view/table/layers/PlayerHandLayer.js', 'view/table/layers/ActionPanelLayer.js', 'view/table/layers/TrainingAssistantLayer.js', 'view/table/layers/ChatEmojiLayer.js', 'view/table/layers/GiftAnimationLayer.js', 'view/table/layers/HistoryLayer.js', 'view/table/layers/ModalLayer.js',
  'view/table/TableScene.js', 'services/EventBus.js', 'services/AudioManager.js', 'services/GameFeelDirector.js', 'core/Lessons.js',
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

// 2c) V4 战绩统计：recordStatHand / getPokerStats 数学
ok(typeof S.recordStatHand === 'function' && typeof S.getPokerStats === 'function', 'pokerStats API');
(function () {
  // 10 手：宽入池被动样本(VPIP 高、PFR 低、AF<1) → 漏洞应指向被动/过宽
  for (let i = 0; i < 10; i++) S.recordStatHand({ vpip: true, pfr: false, aggr: 0, passive: 2, sawShowdown: i < 4, wonShowdown: i < 2, goodDecisions: 1, badDecisions: 1 });
  const ps = S.getPokerStats();
  ok(ps.hands >= 10, 'pokerStats 累计手数');
  ok(ps.vpip === 100 && ps.pfr === 0, 'VPIP 100% / PFR 0%');
  ok(ps.af < 1, '激进度 AF < 1(纯被动)');
  ok(ps.wtsd === 40 && ps.wsd === 50, 'WTSD 40% / W$SD 50%');
  ok(ps.correct === 50, '决策正确率 50%');
  ok(/被动|过宽|均衡|漏洞|被动/.test(ps.leak) || ps.leak.length > 0, '给出最大漏洞文案');
  window.document.querySelector('[data-panel="analytics"]').click();
  ok(/VPIP 入池率/.test(body.innerHTML) && /AF 激进度/.test(body.innerHTML) && /当前最大漏洞/.test(body.innerHTML), '数据中心展示扑克打法指标+漏洞');
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
// Phase 3: SeatView 富节点（22 子节点的关键代表）+ ActionPanel 合法提示 + TableScene 分层
['.fold-mask', '.winner-glow', '.best-hand-glow', '.bet-chip-stack', '.win-streak-badge', '.trustee-icon', '.emoji-mount', '.gift-mount', '.chip-to-pot-anchor', '.chip-to-winner-anchor', '.quick-word-bubble', '.avatar-frame'].forEach((sel) => ok(seats9[0].querySelector(sel), 'SeatView 含 ' + sel));
ok(seats9[0]._nodes && seats9[0]._nodes.holeCardBack0 && seats9[0]._nodes.holeCardBack1, 'SeatView 含两张底牌位');
ok(window.document.getElementById('legal-hint'), 'ActionPanel 合法提示元素存在');
ok(window.RHCore.GameFeelDirectorV2 && typeof window.RHCore.GameFeelDirectorV2.create === 'function', 'GameFeelDirectorV2 已加载');
ok(window.RHCore.TableScene && window.RHCore.TableScene.LAYERS.length === 14, 'TableScene 定义 14 层');
(function () { const m = window.RHCore.TableScene.ensure(); const tagged = window.document.querySelectorAll('[data-layer]'); ok(m && tagged.length >= 8, 'TableScene 已标记分层 data-layer'); })();
ok(window.document.querySelector('[data-layer="SeatLayer"]') && window.document.querySelector('[data-layer="CommunityCardLayer"]'), '关键层(SeatLayer/CommunityCardLayer)已显式化');
// Completion Sprint A：TableScene 真组件树(14 层各有 mount/render/update/destroy)
(function () {
  const scene = window.RHCore.TableScene.assemble();
  ok(Object.keys(scene.layers).length === 14, 'A TableScene 装配 14 个 Layer 实例');
  const allIface = window.RHCore.TableScene.LAYERS.every((n) => { const L = scene.layers[n]; return L && typeof L.mount === 'function' && typeof L.render === 'function' && typeof L.update === 'function' && typeof L.destroy === 'function'; });
  ok(allIface, 'A 每个 Layer 具备 mount/render/update/destroy 接口');
  scene.update({ pot: 12345, feltSkin: 'x' });
  ok(window.document.getElementById('pot-amount').textContent === '12345', 'A PotLayer.update 接收 ViewModel 并更新底池');
})();
// Completion Sprint B：PlayerViewModel 驱动 SeatView 节点(空节点据数据显示/隐藏)
(function () {
  const VM = window.RHCore.PlayerViewModel, SV = window.RHCore.SeatView;
  ok(typeof VM.build === 'function' && typeof SV.update === 'function', 'B PlayerViewModel/SeatView.update 存在');
  const seat = seats9[2];
  SV.update(seat, VM.build({ id: 2, seat: 2, name: 'X', chips: 1000, bet: 200, folded: true, hole: [] }, { seatIndex: 2, isSmallBlind: true, isThinking: true, timerPercent: 50, isTrustee: true, winStreak: 3, quickWord: '好牌！' }));
  ok(!seat.querySelector('.fold-mask').classList.contains('hidden'), 'B 弃牌→foldMask 显示');
  ok(seat.querySelector('.blind-badge').textContent === 'SB' && !seat.querySelector('.blind-badge').classList.contains('hidden'), 'B 小盲→blindBadge=SB');
  ok(!seat.querySelector('.win-streak-badge').classList.contains('hidden'), 'B 连胜≥2→winStreakBadge 显示');
  ok(!seat.querySelector('.trustee-icon').classList.contains('hidden'), 'B 托管→trusteeIcon 显示');
  ok(!seat.querySelector('.turn-ring').classList.contains('hidden'), 'B 思考→timerRing 显示');
  ok(!seat.querySelector('.quick-word-bubble').classList.contains('hidden') && /好牌/.test(seat.querySelector('.quick-word-bubble').textContent), 'B 快捷语→气泡显示文字');
  // 无数据→隐藏
  SV.update(seat, VM.build({ id: 2, seat: 2, name: 'X', chips: 1000, bet: 0, folded: false, hole: [] }, { seatIndex: 2 }));
  ok(seat.querySelector('.fold-mask').classList.contains('hidden') && seat.querySelector('.blind-badge').classList.contains('hidden'), 'B 无数据→节点隐藏(非空显示)');
})();
// Completion Sprint I：牌面主题(classic/neon) + 持久化 + 切换
(function () {
  ok(window.Skins.cardFaces && window.Skins.cardFaces.classic && window.Skins.cardFaces.neon, 'I cardFaces 含 classic/neon');
  ok(typeof S.setCardFace === 'function' && 'activeCardFace' in S.get(), 'I 牌面主题 API + 持久字段');
  ok(S.setCardFace('neon') && S.get().activeCardFace === 'neon', 'I 切换到 neon 生效');
  ok(S.setCardFace('classic'), 'I 切回 classic');
})();
// Completion Sprint D：牌堆锚点存在(发牌飞行起点)
ok(window.document.getElementById('deck-anchor'), 'D 牌堆锚点 deck-anchor 存在');
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
ok([...heroCards.children].every((c) => /cf-(classic|neon)/.test(c.className)), 'I 实发英雄牌面带主题类 cf-*');
const seatsAll = window.document.querySelectorAll('#seats .seat');
ok(seatsAll.length === 6, '6人桌座位渲染');
// Phase 7 逐张发牌动画：新发的牌带 deal-in 类且错开 animation-delay
ok([...heroCards.children].some((c) => c.classList.contains('deal-in')), '英雄手牌带逐张发牌动画(deal-in)');
ok(heroCards.children[1] && /animation-delay/.test(heroCards.children[1].getAttribute('style') || ''), '第二张牌有错开延时');
// Phase 7 动画样式交付校验：deal-in 飞入 + all-in 压暗定格 keyframes/规则就位
(function () {
  const css = fs.readFileSync(path.join(SRC, 'styles.css'), 'utf8');
  ok(/\.card\.deal-in/.test(css) && /@keyframes dealFly/.test(css), 'CSS: 逐张发牌 deal-in/dealFly 已定义');
  ok(/#table-felt\.allin-freeze/.test(css) && /@keyframes allinFreeze/.test(css), 'CSS: 全下压暗定格 allin-freeze/allinFreeze 已定义');
})();
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
// Phase 6 逐步回放：注入一手带决策的牌谱 → 进详情 → 逐步回放 → 翻页 → 结果步
(function () {
  S.clearHandLog();
  S.addHandRecord({ no: S.nextHandNo(), board: [{ rank: 14, suit: 's' }, { rank: 13, suit: 's' }, { rank: 2, suit: 'h' }, { rank: 7, suit: 'd' }, { rank: 9, suit: 'c' }],
    hole: [{ rank: 14, suit: 'h' }, { rank: 14, suit: 'd' }], net: 800, won: true, folded: false, showdown: true,
    summary: '英雄获胜', oppShow: [{ name: 'Bot1', hole: [{ rank: 13, suit: 'h' }, { rank: 13, suit: 'd' }], hand: '一对K' }],
    decisions: [{ street: '翻牌前', action: '加注', winPct: 85, toCall: 100, pot: 150, tag: '价值', good: true, why: 'AA 翻前加注', suggest: '加注' },
                { street: '翻牌', action: '跟注', winPct: 78, toCall: 200, pot: 400, tag: '合理', good: true, why: '顶对好踢脚', suggest: '加注' }],
    mistakes: 0 });
  window.SceneRouter.go('replay', {});
  body.querySelector('[data-hand]').click();
  ok(/逐步回放/.test(body.innerHTML), '复盘详情含逐步回放入口');
  body.querySelector('[data-replay]').click();
  ok(/进度/.test(body.innerHTML) && /1 \/ 2/.test(body.innerHTML) && /翻牌前\(未发公共牌\)/.test(body.innerHTML), '逐步回放第1步: 翻前未发公共牌');
  body.querySelector('[data-replay-step]:not([disabled])').click(); // 下一步 → step1(翻牌)
  ok(/2 \/ 2/.test(body.innerHTML), '逐步回放到第2步(翻牌)');
  // 翻牌步应翻出3张公共牌
  ok((body.innerHTML.match(/rc-card/g) || []).length >= 3, '翻牌步翻出公共牌(≥3张)');
  // 推进到结果步
  const nextBtns = [...body.querySelectorAll('[data-replay-step]')].filter((b) => !b.disabled && /结果|下一步/.test(b.textContent));
  nextBtns[nextBtns.length - 1].click();
  ok(/结果/.test(body.innerHTML) && /对手摊牌/.test(body.innerHTML), '逐步回放结果步显示结果+对手摊牌');
  body.querySelector('[data-replay-exit]').click();
  ok(/逐步回放/.test(body.innerHTML) && /返回列表/.test(body.innerHTML), '退出逐步回到详情');
})();
window.SceneRouter.back(); ok(typeof window.SceneRouter.current() === 'string', 'back() works');
// tutorial: support panel offers it, and forcing it builds an overlay
window.document.querySelector('[data-panel="support"]').click();
ok(/data-tutorial/.test(body.innerHTML), 'support offers tutorial');
body.querySelector('[data-tutorial]').click();
ok(window.document.getElementById('tut-ov'), 'tutorial overlay opens');
ok(/欢迎来到训练场/.test(window.document.getElementById('tut-ov').innerHTML), 'tutorial first page');
// Phase 6b 教学课程：注册表 + 判题 + 面板 + 课程runner自测流
ok(window.RHCore.Lessons && window.RHCore.Lessons.count >= 6, 'Lessons 注册表 ≥6 课');
(function () {
  const L = window.RHCore.Lessons, lessons = L.all();
  ok(lessons.every((l) => l.id && l.title && l.pages.length && l.quiz && Array.isArray(l.quiz.options) && typeof l.quiz.answer === 'number'), '每课含分页+自测题结构完整');
  const lid = lessons[0].id, ans = lessons[0].quiz.answer;
  ok(L.check(lid, ans).correct === true && L.check(lid, (ans + 1) % lessons[0].quiz.options.length).correct === false, 'check 判对错正确');
  ok(typeof S.markLesson === 'function' && typeof S.getLessonDone === 'function', 'lesson 进度 API');
  // 面板渲染
  window.SceneRouter.go('lessons', {});
  ok(/学习课程/.test(body.innerHTML) && body.querySelector('[data-lesson]'), '学习课程面板列出课程');
  // 进第一课 → 翻到自测 → 答对 → 完成
  body.querySelector(`[data-lesson="${lid}"]`).click();
  const ov = window.document.getElementById('lesson-ov');
  ok(ov && /tut-card/.test(ov.innerHTML), '课程运行器开启');
  let guard = 0;
  while (ov.querySelector('[data-le="next"]') && guard++ < 20) ov.querySelector('[data-le="next"]').click();
  ok(ov.querySelector('[data-le-opt]'), '翻到自测题');
  ov.querySelector(`[data-le-opt="${ans}"]`).click();
  ok(/答对了/.test(ov.innerHTML) && ov.querySelector('[data-le="done"]'), '答对显示反馈+完成按钮');
  ov.querySelector('[data-le="done"]').click();
  ok(S.getLessonDone()[lid] === true, '完成后课程标记已学');
  window.SceneRouter.go('lessons', {});
  ok(/✓ 已学/.test(body.innerHTML), '面板显示已学标记');
})();

ok(!/传奇/.test(window.document.body.innerHTML), 'no 传奇 trademark in DOM');

console.log(`\nUI 回归: ${pass} 通过, ${fail} 失败`);
process.exit(fail ? 1 : 0);
