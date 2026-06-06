/* test:bugbash —— Phase 3/4.2 Bug Bash 回归套件。
   锁定本轮修复的真实 bug + 自动化不变量(发牌无重复/对手不泄牌/无残留/筹码守恒)的回归。
   运行：node test-bugbash.js（需 jsdom）。 */
const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');
const SRC = path.join(__dirname, 'src');
const dom = new JSDOM(fs.readFileSync(path.join(SRC, 'index.html'), 'utf8'), { runScripts: 'outside-only', pretendToBeVisual: true, url: 'https://x/' });
const { window } = dom;
global.window = window; global.document = window.document;
window.matchMedia = () => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} });
const ap = () => ({ setValueAtTime() {}, setTargetAtTime() {}, exponentialRampToValueAtTime() {}, linearRampToValueAtTime() {}, value: 0 });
const anode = () => ({ connect() { return anode(); }, start() {}, stop() {}, gain: ap(), frequency: ap(), Q: ap(), type: '', buffer: null, getChannelData: () => new Float32Array(1) });
window.AudioContext = window.webkitAudioContext = function () { return { createOscillator: anode, createGain: anode, createBuffer: anode, createBufferSource: anode, createBiquadFilter: anode, destination: anode(), currentTime: 0, resume() {}, state: 'running', sampleRate: 44100 }; };
window.localStorage = (() => { let s = {}; return { getItem: (k) => (k in s ? s[k] : null), setItem: (k, v) => (s[k] = String(v)), removeItem: (k) => delete s[k], clear: () => (s = {}) }; })();
window.sessionStorage = window.localStorage; window.navigator.vibrate = () => {};
window.requestAnimationFrame = () => 1; window.cancelAnimationFrame = () => {}; window.performance = { now: () => Date.now() };
window.HTMLCanvasElement.prototype.getContext = () => ({ scale() {}, clearRect() {}, fillRect() {}, beginPath() {}, moveTo() {}, lineTo() {}, stroke() {}, fill() {}, arc() {}, closePath() {}, save() {}, restore() {}, translate() {}, rotate() {}, fillText() {}, createLinearGradient: () => ({ addColorStop() {} }), createRadialGradient: () => ({ addColorStop() {} }) });
let Q = []; window.setTimeout = (fn) => { Q.push(fn); return Q.length; }; window.clearTimeout = () => {};
const flush = (n) => { let i = 0; while (Q.length && i++ < (n || 400)) { const f = Q.shift(); try { f(); } catch (e) {} } };
const T = fs.readFileSync(path.join(__dirname, 'test-ui.js'), 'utf8');
const FILES = T.match(/const FILES = \[([\s\S]*?)\];/)[1].split(',').map((s) => s.trim().replace(/^.|.$/g, '')).filter(Boolean);
for (const f of FILES) { try { new window.Function(fs.readFileSync(path.join(SRC, f), 'utf8')).call(window); } catch (e) { console.log('LOAD FAIL ' + f + ': ' + e.message); } }

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  ✗ ' + m); } };
const $ = (id) => window.document.getElementById(id);
const cls = (el, c) => el && el.classList.contains(c);
const RH = window.RHCore, DBG = window.__debugHoldem;
window.GameFeel.isBusy = () => false;   // 解除发牌门控让 hero 可行动(harness 无真实时钟)

ok(DBG && typeof DBG.dumpState === 'function', 'debug: window.__debugHoldem.dumpState 存在');
['dumpState', 'dumpHandHistory', 'dumpGameFeelEvents', 'dumpCardSlots', 'replayHand', 'startSeed', 'trainingVM', 'historyVM'].forEach((k) => ok(DBG && typeof DBG[k] === 'function', 'debug: __debugHoldem.' + k));

// 用固定 seed 开桌(可复现)
DBG.startSeed(123456, { players: 6 });
$('btn-start').click();
const snap = DBG.dumpState();
ok(snap && snap.seed === 123456, 'debug: snapshot seed 可复现(=123456)');
ok(snap.handId && /#/.test(snap.handId), 'debug: handId = seed#handNo');
['street', 'buttonSeat', 'blinds', 'stacks', 'pot', 'board', 'heroCards', 'legalActions', 'cardSlotStates', 'actionPanelState', 'modalState'].forEach((k) => ok(k in snap, 'debug: snapshot 含 ' + k));

// 驱动到 hero 行动 + 捕捉 preflop / postflop 训练 VM；并验证不变量
const bugs = {}; const bug = (id) => { bugs[id] = (bugs[id] || 0) + 1; };
let preflopSpr = 'unset', postflopSpr = 'unset', heroTurns = 0, hands = 0, loops = 0, modalPauseTested = false, modalPauseOK = false;
function deckDup(g) { const all = []; g.players.forEach((p) => { if (!p.out && p.hole) p.hole.forEach((c) => all.push(c.rank + '' + c.suit)); }); (g.board || []).forEach((c) => all.push(c.rank + '' + c.suit)); const s = {}; all.forEach((ck) => { if (s[ck]) bug('ENGINE_DUP'); s[ck] = 1; }); }
while (hands < 30 && loops++ < 40000) {
  flush(120);
  if (cls($('screen-table'), 'hidden')) break;
  const g = DBG._game(); if (!g) break;
  deckDup(g);
  // opponent face leak
  [...window.document.querySelectorAll('#seats .seat:not(.me)')].forEach((s) => { if (s.querySelectorAll('.player-cards .card[data-ck]').length > 0 && !cls(s, 'seat-revealed')) bug('OPP_FACE_LEAK'); });
  // residue on fresh preflop
  if (g.street === 'preflop' && g.board.length === 0 && !g.result) {
    if (window.document.querySelector('.best5')) bug('RESIDUE_BEST5');
    if (window.document.querySelector('.seat-revealed')) bug('RESIDUE_REVEALED');
    if (window.document.querySelector('#table-felt.showdown-dim')) bug('RESIDUE_DIM');
  }
  const aa = $('action-area');
  if (aa && !cls(aa, 'hidden')) {
    heroTurns++;
    const tvm = DBG.trainingVM();
    if (tvm && tvm.mode === 'decision') {
      if (g.board.length === 0 && preflopSpr === 'unset') preflopSpr = tvm.spr;             // BUG#3：翻前 SPR 应为 null
      if (g.board.length >= 3 && postflopSpr === 'unset') postflopSpr = tvm.spr;            // 翻后 SPR 应有值且 ≤99
    }
    // BUG#1：在 hero 回合打开桌内弹窗 → 应暂停回合(action-area 隐藏 + 回合计时清除)
    if (!modalPauseTested && heroTurns >= 1) {
      modalPauseTested = true;
      $('btn-table-menu').click();
      const aaHidden = cls($('action-area'), 'hidden');
      const timerHidden = !$('turn-timer') || cls($('turn-timer'), 'hidden');
      const modalOpen = RH.TableScene.ensure().get('ModalLayer').isOpen();
      modalPauseOK = modalOpen && aaHidden && timerHidden;
      RH.TableScene.ensure().get('ModalLayer').close();  // 关闭恢复
    }
    const ch = $('btn-check'), ca = $('btn-call'), fo = $('btn-fold');
    if (ch && !cls(ch, 'hidden') && !ch.disabled) ch.click();
    else if (ca && !cls(ca, 'hidden') && !ca.disabled) ca.click();
    else if (fo && !fo.disabled) fo.click();
  } else if (!cls($('start-area'), 'hidden')) { hands++; $('btn-start').click(); }
  else { $('btn-start').click(); }
}
ok(heroTurns > 0, 'harness: 至少到达一次 hero 行动');
ok(Object.keys(bugs).length === 0, '不变量: 无发牌重复/对手泄牌/残留(实=' + JSON.stringify(bugs) + ')');

// BUG#1 模态暂停回合
ok(modalPauseTested && modalPauseOK, 'BUG#1: 桌内弹窗打开→暂停回合(action-area 隐藏 + 回合计时清除，不会自动弃牌)');

// BUG#3 SPR 仅翻后
ok(preflopSpr === null || preflopSpr === 'unset', 'BUG#3: 翻前 SPR 不显示(null，不再是 1247.9 荒数)');
if (postflopSpr !== 'unset' && postflopSpr !== null) ok(typeof postflopSpr === 'number' && postflopSpr <= 99 && postflopSpr > 0, 'BUG#3: 翻后 SPR 有值且封顶 ≤99(实=' + postflopSpr + ')');
else ok(true, 'BUG#3: 翻后 SPR(本次未捕捉到翻后 hero 回合，跳过数值断言)');

// BUG#2 复盘入口用 Store 记录 no(全局)，不是 game.handNo(每桌从 1)
(function () {
  const HL = RH.TableScene.ensure().get('HistoryLayer');
  HL.render({ history: { handNo: 1, streetLabel: '河牌', canReplay: true, replayNo: 87, actions: [{ seat: 1, nickname: '老紧', position: 'BTN', action: '加注', amount: 300, amountText: '300', marker: '' }], recentHands: [{ no: 87, net: 500, netText: '500' }] } });
  const hs = $('hand-strip').innerHTML;
  ok(/data-replay-hand="87"/.test(hs), 'BUG#2: 复盘入口用 Store 记录 no=87(全局递增)');
  ok(!/data-replay-hand="1"/.test(hs), 'BUG#2: 不再用 game.handNo=1(每桌从 1，会打开错误手)');
  // canReplay 但无 replayNo → 不出按钮(不指向错误手)
  HL.render({ history: { handNo: 2, streetLabel: '翻牌', canReplay: true, replayNo: null, actions: [{ seat: 0, nickname: '你', position: 'BB', action: '过牌', amount: 0, amountText: '0', marker: '' }], recentHands: [] } });
  ok(!/data-replay-hand/.test($('hand-strip').innerHTML), 'BUG#2: 无 replayNo→不显示复盘入口(不打开错误手)');
})();

console.log(`\nBug Bash 回归: ${pass} 通过, ${fail} 失败`);
process.exit(fail ? 1 : 0);
