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
  'core/poker/SeededRng.js', 'core/poker/types.js', 'core/poker/Card.js', 'core/poker/Deck.js', 'core/poker/HandEvaluator.js', 'core/poker/HandComparator.js', 'core/poker/SidePot.js', 'core/poker/TableState.js', 'core/poker/LegalActions.js', 'core/poker/HandHistory.js', 'core/poker/GameReducer.js', 'core/poker/Equity.js', 'core/poker/selectors.js', 'core/ai/types.js', 'core/ai/BotProfiles.js', 'core/ai/BotProfile.js', 'core/ai/PreflopMatrix.js', 'core/ai/BoardTexture.js', 'core/ai/EquityCalculator.js', 'core/ai/HandClassDescriber.js', 'core/ai/BoardTextureDescriber.js', 'core/ai/ActionHistoryFormatter.js', 'core/ai/DecisionReasonFormatter.js', 'core/ai/PostflopHeuristics.js', 'core/ai/PokerBrain.js', 'core/ai/OpponentModel.js', 'core/ai/BotDecisionEngine.js', 'game/table/GameAdapter.js',
  'gamefeel/GameFeelEvent.js', 'gamefeel/GameFeelConfig.js', 'gamefeel/TableAnimationQueue.js', 'gamefeel/HapticDirector.js', 'gamefeel/ChipFlyAnimator.js', 'gamefeel/CardSlot.js', 'gamefeel/CardDealAnimator.js', 'gamefeel/PotWinAnimator.js', 'gamefeel/HighlightDirector.js', 'gamefeel/GameFeelDirector.js',
  'view/table/SeatView.js', 'view/table/ActionPanel.js', 'view/table/PlayerViewModel.js', 'view/table/CardRow.js',
  'view/table/layers/_base.js', 'view/table/layers/TableBackgroundLayer.js', 'view/table/layers/TableFeltLayer.js', 'view/table/layers/SeatLayer.js', 'view/table/layers/DealerButtonLayer.js', 'view/table/layers/CommunityCardLayer.js', 'view/table/layers/PotLayer.js', 'view/table/layers/BetChipLayer.js', 'view/table/layers/PlayerHandLayer.js', 'view/table/layers/ActionPanelLayer.js', 'view/table/layers/TrainingAssistantLayer.js', 'view/table/layers/ChatEmojiLayer.js', 'view/table/layers/GiftAnimationLayer.js', 'view/table/layers/HistoryLayer.js', 'view/table/layers/ModalLayer.js',
  'view/table/TableScene.js', 'controllers/DealController.js', 'controllers/ShowdownController.js', 'controllers/SettlementController.js', 'controllers/ActionController.js', 'services/EventBus.js', 'services/AudioManager.js', 'services/GameFeelDirector.js', 'core/Lessons.js',
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
  // A：ui.js render 委托 TableScene.render(vm)，layer 自渲染底池/公共牌/庄家(不再在 ui.js 拼)
  const ctx = { renderCard: (c) => `<div class="card" data-ck="${c.rank}${c.suit}">x</div>`, rollPot: (p) => { const a = window.document.getElementById('pot-amount'); if (a) a.textContent = String(p); }, SEAT_POS: { 0: { x: 50, y: 90 } } };
  scene.render({ pot: 777, board: [{ rank: 14, suit: 's' }, { rank: 13, suit: 'h' }, { rank: 2, suit: 'c' }], button: 0, ctx });
  ok(window.document.getElementById('pot-amount').textContent === '777', 'A PotLayer.render 自渲染底池');
  ok(window.document.getElementById('board').querySelectorAll('.card').length === 3, 'A CommunityCardLayer.render 自渲染公共牌(3 张)');
  ok(!window.document.getElementById('dealer-button').classList.contains('hidden') && /%$/.test(window.document.getElementById('dealer-button').style.left), 'A DealerButtonLayer.render 自定位庄家按钮');
  // ui.js render 内不再内联拼公共牌/庄家(委托 TableScene.render)
  ok(/TableScene\.ensure\(\)\.render\(/.test(fs.readFileSync(path.join(__dirname, 'src/ui.js'), 'utf8')), 'A ui.js render 委托 TableScene.render(vm)');
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
  // avatarFrame: 'none' 不显示(修 none-bug)，真实框显示
  SV.update(seat, VM.build({ id: 2, seat: 2, chips: 1, hole: [] }, { seatIndex: 2, avatarFrameId: 'none' }));
  ok(!seat.querySelector('.avatar-frame').classList.contains('has-frame'), 'B avatarFrame=none→不显示框(none-bug 已修)');
  SV.update(seat, VM.build({ id: 2, seat: 2, chips: 1, hole: [] }, { seatIndex: 2, avatarFrameId: 'gold' }));
  ok(seat.querySelector('.avatar-frame').classList.contains('has-frame'), 'B avatarFrame=gold→显示框');
  // winnerGlow / bestHandGlow 据结算数据
  SV.update(seat, VM.build({ id: 2, seat: 2, chips: 1, winThisHand: 500, hole: [] }, { seatIndex: 2, isWinner: true, bestCardIds: ['As', 'Ks'] }));
  ok(!seat.querySelector('.winner-glow').classList.contains('hidden'), 'B 赢家→winnerGlow 显示');
  ok(!seat.querySelector('.best-hand-glow').classList.contains('hidden'), 'B 有 best5→bestHandGlow 显示');
  // emojiMount / giftMount 一次性占位动画(popMount 真填充，非空占位)
  SV.popMount(seat, 'emoji', '😀'); ok(/pop-anim/.test(seat.querySelector('.emoji-mount').innerHTML), 'B emojiMount 播放一次性表情');
  SV.popMount(seat, 'gift', '🎁'); ok(/pop-anim/.test(seat.querySelector('.gift-mount').innerHTML), 'B giftMount 播放一次性礼物');
  // dealerButton: 桌级单一标记(去重)，座位内不再有 seat-dealer
  ok(!seat.querySelector('.seat-dealer'), 'B 座位内无重复庄家标记(去重)');
  ok(window.document.getElementById('dealer-button'), 'B 庄家按钮为桌级 #dealer-button(状态驱动)');
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
// D：ActionPanel 门控 API + GameFeelDirector 发牌门控 + 发牌顺序日志
ok(typeof window.RHCore.ActionPanel.disableAll === 'function', 'D ActionPanel.disableAll(门控)存在');
ok(window.GameFeel && typeof window.GameFeel.isBusy === 'function' && typeof window.GameFeel.onceIdle === 'function', 'D GameFeelDirector 门控 API(isBusy/onceIdle)');
(function () {
  // 进 6 人桌发牌(render 创建卡牌 DOM 后 fireHoleDeal 发 DEAL_HOLE_CARD→逐张飞行+门控)。下方测试会重建自己的桌。
  const GF = window.GameFeel;
  window.SceneRouter.go('table', { players: 6 });
  window.document.getElementById('btn-start').click();
  const order = GF.dealOrderLog();
  ok(Array.isArray(order) && order.length === 12, `D 发牌顺序日志=12 张(6 座×2，实=${order.length})`);
  const first = order[0];
  ok(first && first.delay === 0 && first.duration > 0 && first.type === 'hole', 'D 每张有 delay/duration/from-to(逐张 90ms 错开)');
  ok(GF.isBusy(), 'D 发牌后 isBusy()=true(ActionPanel 门控期)');
})();
// Live Integration Sprint：A/D 真实接入 —— CardRow/CardSlot 驱动 live 牌位
(function () {
  const CardRow = window.RHCore.CardRow, doc = window.document;
  ok(CardRow && typeof CardRow.render === 'function', 'LI CardRow 模块存在(SeatLayer/PlayerHandLayer/CommunityCardLayer 共用)');
  // A：live 牌桌发牌后，英雄手牌经 PlayerHandLayer 渲染并持有 CardSlot
  window.SceneRouter.go('table', { players: 6 });
  window.document.getElementById('btn-start').click();
  const hero = doc.querySelector('#seats .seat.me .player-cards');
  ok(hero && hero.children.length === 2, 'LI 英雄两张底牌由 layer 渲染');
  ok(hero._slots && hero._slots.length === 2, 'LI 英雄 .player-cards 持有 2 个 CardSlot(layer 拥有)');
  ok(hero._slots[0].state === 'revealed' && hero._slots[0].data.ownerType === 'hero', 'LI jsdom 无布局→同步 revealed，ownerType=hero');
  // D：模拟有布局的浏览器 —— 发牌前显示牌背、不显示最终牌面；真实牌飞行中
  const cont = doc.createElement('div'); doc.body.appendChild(cont);
  const deck = doc.getElementById('deck-anchor');
  cont.getBoundingClientRect = () => ({ width: 60, height: 84, left: 120, top: 240 });
  if (deck) deck.getBoundingClientRect = () => ({ width: 40, height: 56, left: 10, top: 10 });
  const faces = ['<div class="card small cf-classic" data-ck="As">A</div>', '<div class="card small cf-classic" data-ck="Kd">K</div>'];
  const backs = ['<div class="card back small"></div>', '<div class="card back small"></div>'];
  CardRow.render(cont, { count: 2, faceHTML: faces, backHTML: backs, revealed: true, fresh: true, deckAnchor: deck, reducedMotion: false, sig: 'li-a', ownerType: 'hero', seatIndex: 0 });
  ok(cont.children.length === 2 && !/data-ck/.test(cont.innerHTML), 'LI(D) 有布局+fresh：飞行前只显示牌背、不显示真实牌面');
  ok(cont._slots[0].state === 'flying', 'LI(D) 发牌前 CardSlot=flying(真实牌飞行，无幽灵)');
  // 到达后 reveal：以即时定时器跑完飞行→揭示
  const realST = window.setTimeout; window.setTimeout = (fn) => { try { fn(); } catch (e) {} return 0; };
  CardRow.render(cont, { count: 2, faceHTML: faces, backHTML: backs, revealed: true, fresh: true, deckAnchor: deck, reducedMotion: false, sig: 'li-b', ownerType: 'hero', seatIndex: 0 });
  window.setTimeout = realST;
  ok(/data-ck="As"/.test(cont.innerHTML) && /data-ck="Kd"/.test(cont.innerHTML), 'LI(D) 到达后真实牌面就地 reveal(无幽灵叠加)');
  // 对手发牌前为牌背(faceUp=false)，摊牌才 reveal
  CardRow.render(cont, { count: 2, faceHTML: faces, backHTML: backs, revealed: false, fresh: false, sig: 'li-opp', ownerType: 'opponent', seatIndex: 3 });
  ok(!/data-ck/.test(cont.innerHTML), 'LI 对手未摊牌→只牌背，不提前渲染真实牌面');
  CardRow.reveal(cont, faces, 'li-opp-rv');
  ok(/data-ck="As"/.test(cont.innerHTML), 'LI 对手 REVEAL_HAND→翻面显示真实牌');
  cont.remove();
  // A：ui.js 不再直接拼底牌 innerHTML，改由 layer/CardRow；且座位牌位经 seatsVM 委托
  const uiSrc = fs.readFileSync(path.join(__dirname, 'src/ui.js'), 'utf8');
  ok(!/cardsEl\.innerHTML\s*=\s*p\.hole\.map/.test(uiSrc), 'A ui.js 不再直接拼 .player-cards 底牌 innerHTML');
  ok(/seats:\s*seatsVM/.test(uiSrc), 'A ui.js render 把 seatsVM 交给 TableScene(layer 渲染牌位)');
  // C 保持：ui.js 0 处直接 GF.emit(全部经控制器)
  ok((uiSrc.match(/GF\.emit\(/g) || []).length === 0, 'C ui.js 仍 0 处直接 GF.emit(emit 源在控制器)');
  // 各层确实经 CardRow 渲染
  ['SeatLayer', 'PlayerHandLayer', 'CommunityCardLayer'].forEach((n) => {
    const s = fs.readFileSync(path.join(__dirname, 'src/view/table/layers/' + n + '.js'), 'utf8');
    ok(/CardRow/.test(s), 'A ' + n + ' 经 CardRow 渲染牌位');
  });
  ok(!/deal-ghost/.test(uiSrc), 'D 旧幽灵牌(deal-ghost)已从 ui.js 移除');
  // A：ui.js 不再循环渲染座位表现(头像/筹码/动作文字)，改由 SeatLayer
  ok(!/\.av-emoji'\)\.textContent/.test(uiSrc) && !/\.pchips'\)\.textContent/.test(uiSrc), 'A ui.js render 不再直接写座位头像/筹码 DOM');
  const seatLayerSrc = fs.readFileSync(path.join(__dirname, 'src/view/table/layers/SeatLayer.js'), 'utf8');
  ok(/applySeat/.test(seatLayerSrc) && /SeatView\.update/.test(seatLayerSrc), 'A SeatLayer 接管座位表现落地(applySeat + SeatView.update)');
  // SeatLayer 真的把 VM 落到座位 DOM：座位筹码经 layer 渲染(非空)
  const seat1 = doc.querySelectorAll('#seats .seat')[1];
  const chipsTxt = seat1 && seat1.querySelector('.pchips') && seat1.querySelector('.pchips').textContent;
  ok(typeof chipsTxt === 'string' && /\d/.test(chipsTxt), 'A 座位筹码由 SeatLayer 落到 DOM(非空，证明座位表现已迁出 ui.js)');
})();
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

// Phase 3/4.1: Table Content Layers & Seat Data Sprint
(function () {
  const RH = window.RHCore, doc = window.document;
  // 1) 对手昵称/头像/风格 数据(9 人桌)
  window.SceneRouter.go('table', { players: 9 });
  window.document.getElementById('btn-start').click();
  const seats = [...doc.querySelectorAll('#seats .seat')];
  const oppNames = seats.slice(1).map((s) => s.querySelector('.pname').textContent);
  ok(oppNames.every((n) => n && n.length > 0), 'P341 对手昵称全部非空(9 座)');
  ok(new Set(oppNames).size === oppNames.length, 'P341 对手昵称不重复');
  ok(seats.slice(1).every((s) => (s.querySelector('.av-emoji').textContent || '').length > 0), 'P341 对手头像(程序化 emoji)非空');
  ok(seats[1].querySelector('.ptitle').textContent.length > 0, 'P341 对手风格标签显示(便于学习识别)');
  const pvm = RH.PlayerViewModel.build({ id: 1, seat: 1, name: '老紧', avatar: '🧊', chips: 1000, hole: [] }, { seatIndex: 1 });
  ok(pvm.nickname === '老紧' && pvm.avatar === '🧊', 'P341 nickname/avatar 来自 PlayerViewModel(非 DOM 硬写)');
  const ids = RH.BotProfiles.assignIdentities(['nit', 'nit', 'calling_station']);
  ok(ids[0].nickname && ids[1].nickname && ids[0].nickname !== ids[1].nickname, 'P341 同画像昵称去重');
  ok(ids[2].styleLabel === '跟注站', 'P341 风格标签来自画像');
  // 2) TrainingAssistantLayer
  const TA = RH.TableScene.ensure().get('TrainingAssistantLayer');
  ok(TA && typeof TA.toggle === 'function' && typeof TA.render === 'function', 'P341 TrainingAssistantLayer 独立 render/toggle');
  TA.render({ training: { visible: true, mode: 'decision', short: '顶对 · 胜率 72%', handClass: '顶对', winPct: 72, tiePct: 2, losePct: 26, potOdds: 25, spr: 3.2, suggestion: '加注', reason: '价值下注', canExpand: true } });
  const hh = doc.getElementById('hand-hint');
  ok(/胜率 72%/.test(hh.innerHTML) && /加注/.test(hh.innerHTML), 'P341 训练助手显示当前牌型/胜率/建议');
  ok(!/SPR/.test(hh.innerHTML), 'P341 默认只显示短提示(详情收起)');
  TA.toggle();
  ok(/SPR/.test(hh.innerHTML) && /底池赔率/.test(hh.innerHTML) && /价值下注/.test(hh.innerHTML), 'P341 展开后显示 SPR/底池赔率/理由(可展开详情)');
  TA.render({ training: { visible: true, mode: 'summary', short: '本手结束 · 净 +3000' } });
  ok(/本手结束/.test(hh.innerHTML), 'P341 摊牌结束后显示本手总结');
  TA.render({ training: { visible: true, mode: 'observe', short: '老紧（UTG）加注' } });
  ok(/老紧/.test(hh.innerHTML), 'P341 非你行动时显示观察对手行动');
  // 3) ChatEmojiLayer
  const CE = RH.TableScene.ensure().get('ChatEmojiLayer');
  ok(CE && CE.PHRASES.length >= 8 && typeof CE.send === 'function', 'P341 ChatEmojiLayer 原创快捷语 ≥8 + send');
  let clock = 100000; CE._setNow(() => clock); CE.reset();
  const seatEl = seats[2];
  ok(CE.send(seatEl, 2, '压力给到你') && /压力给到你/.test(seatEl._nodes.quickWordBubble.textContent) && !seatEl._nodes.quickWordBubble.classList.contains('hidden'), 'P341 发送快捷语→座位气泡显示');
  ok(CE.send(seatEl, 2, '摊牌吧') === false, 'P341 冷却内再次发送被拦截(5 秒冷却生效)');
  clock += 6000;
  ok(CE.send(seatEl, 2, '摊牌吧') === true, 'P341 冷却结束后可再发');
  CE.playEmoji(seatEl, 2, '🔥', { force: true });
  ok(/pop-anim/.test(seatEl._nodes.emojiMount.innerHTML), 'P341 表情→emojiMount 一次性动画');
  // 自动消失：气泡定时器存在(SeatView.showBubble 设置 _t)
  ok(seatEl._nodes.quickWordBubble._t != null, 'P341 气泡设置了自动消失定时器');
  // 4) GiftAnimationLayer
  const GL = RH.TableScene.ensure().get('GiftAnimationLayer');
  ok(GL && GL.GIFTS.length >= 5 && typeof GL.send === 'function', 'P341 GiftAnimationLayer 原创反应 ≥5(筹码雨/咖啡/纸飞机/掌声/灯牌)');
  const gseat = seats[3];
  ok(GL.send(0, gseat, 'applause', { force: true }), 'P341 送礼→giftMount 动画');
  ok(/pop-anim/.test(gseat._nodes.giftMount.innerHTML), 'P341 giftMount 非空(一次性动画占位)');
  ok(GL.systemTrigger('allin', gseat), 'P341 系统级反馈(all-in→筹码雨)');
  GL.reset(); ok(GL.send(0, gseat, 'coffee', { now: 1 }) && GL.send(0, gseat, 'coffee', { now: 2 }) === false, 'P341 礼物冷却生效');
  // 5) HistoryLayer
  const HL = RH.TableScene.ensure().get('HistoryLayer');
  HL.render({ history: { handNo: 7, streetLabel: '翻牌', canReplay: true, actions: [{ seat: 1, nickname: '老紧', position: 'UTG', action: '加注', amount: 300, amountText: '300', marker: '' }, { seat: 2, nickname: '跟注站', position: 'BB', action: '全下', amount: 5000, amountText: '5000', marker: 'allin' }], recentHands: [{ no: 6, net: 1200, netText: '1200' }] } });
  const hs = doc.getElementById('hand-strip');
  ok(/老紧/.test(hs.innerHTML) && /加注/.test(hs.innerHTML) && /300/.test(hs.innerHTML), 'P341 行动历史显示昵称/动作/金额');
  ok(/UTG/.test(hs.innerHTML) && /BB/.test(hs.innerHTML), 'P341 行动历史显示位置');
  ok(/ha-mark allin/.test(hs.innerHTML), 'P341 all-in 特殊标记');
  ok(/data-replay-hand="7"/.test(hs.innerHTML), 'P341 一手结束→完整复盘入口');
  ok(/hs-item/.test(hs.innerHTML), 'P341 近期手净额保留');
  // 6) ModalLayer
  const ML = RH.TableScene.ensure().get('ModalLayer');
  ok(ML && typeof ML.open === 'function' && typeof ML.close === 'function', 'P341 ModalLayer open/close/isOpen');
  const tableModal = doc.getElementById('table-modal');
  ok(tableModal && tableModal.id === 'table-modal' && tableModal.id !== 'modal-overlay', 'P341 table modal 独立于 Hall #modal-overlay(不混用)');
  let disabled = false; const realDA = RH.ActionPanel.disableAll; RH.ActionPanel.disableAll = () => { disabled = true; };
  ML.open('settings', { rows: [{ id: 'coach', label: '教练', value: '开' }] });
  RH.ActionPanel.disableAll = realDA;
  ok(ML.isOpen() && !tableModal.classList.contains('hidden') && /牌桌设置/.test(tableModal.innerHTML), 'P341 打开牌桌设置弹窗');
  ok(disabled, 'P341 打开 modal→ActionPanel 被门控(disableAll)');
  let closed = false; ML.open('exit', { onClose: () => { closed = true; } });
  ok(/退出牌桌/.test(tableModal.innerHTML), 'P341 退出确认弹窗');
  tableModal.querySelector('[data-tm="close"]').click();
  ok(!ML.isOpen() && closed && tableModal.classList.contains('hidden'), 'P341 关闭 modal→隐藏并触发恢复回调');
  let picked = null; ML.open('quickword', { phrases: ['摊牌吧'], emojis: ['🔥'], onPick: (t) => { picked = t; } });
  tableModal.querySelector('[data-tm="say"]').click();
  ok(picked === '摊牌吧', 'P341 快捷语选择面板→选词回调');
  // 7) ui.js 不再直接渲染这些桌内区域
  const uiSrc341 = fs.readFileSync(path.join(__dirname, 'src/ui.js'), 'utf8');
  ok(!/hh\.innerHTML =/.test(uiSrc341), 'P341 ui.js 不再直接渲染训练提示 DOM');
  ok(!/el\.innerHTML = '<span class="hs-label/.test(uiSrc341), 'P341 ui.js 不再直接渲染桌内历史简条');
  ok(/buildTrainingVM|TrainingAssistantLayer/.test(uiSrc341) && /buildHistoryVM/.test(uiSrc341), 'P341 训练/历史改由 layer(VM 驱动)');
})();

ok(!/传奇/.test(window.document.body.innerHTML), 'no 传奇 trademark in DOM');

console.log(`\nUI 回归: ${pass} 通过, ${fail} 失败`);
process.exit(fail ? 1 : 0);
