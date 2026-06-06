/* qa-capture —— 真机 bug 采集入口（仅 QA 用，不影响正式玩法）。
   触发：牌桌右上角「版本号」连续点击 5 次 → 打开 QA 面板。默认隐藏。
   面板提供：复制 dumpState / handHistory / GameFeelEvents / CardSlots / TrainingVM / HistoryVM / 完整 bug snapshot。
   不支持 clipboard 时回落到可长按复制的 textarea。完整 snapshot 自动含 appVersion/commit/handId/seed/.../lastError。
   零玩法依赖：只读 window.__debugHoldem + DOM；不改规则/AI/大厅。 */
(function () {
  if (typeof document === 'undefined' || typeof window === 'undefined') return;

  // ---- 捕获 lastError（供快照定位崩溃）----
  var lastError = null;
  window.addEventListener('error', function (e) { lastError = { type: 'error', message: e && e.message, src: e && e.filename, line: e && e.lineno, col: e && e.colno, stack: e && e.error && e.error.stack }; });
  window.addEventListener('unhandledrejection', function (e) { lastError = { type: 'unhandledrejection', message: String((e && e.reason && e.reason.message) || (e && e.reason) || 'unknown') }; });
  window.__qaLastError = function () { return lastError; };

  function dbg() { return window.__debugHoldem || {}; }
  function safe(fn) { try { return fn(); } catch (e) { return { error: String((e && e.message) || e) }; } }
  function call(name) { return safe(function () { var d = dbg(); return (typeof d[name] === 'function') ? d[name]() : null; }); }

  function fullSnapshot() {
    var s = call('dumpState') || {};
    return {
      appVersion: window.__APP_VERSION || 'dev',
      commit: window.__BUILD_COMMIT || 'dev',
      handId: s.handId, seed: s.seed, street: s.street, currentPlayer: s.currentPlayer,
      heroSeat: 0, buttonSeat: s.buttonSeat, stacks: s.stacks, pot: s.pot, sidePots: s.sidePots,
      board: s.board, heroCards: s.heroCards, visibleCards: s.visibleCards, legalActions: s.legalActions,
      actionHistory: s.actionHistory, gameFeelEvents: s.gameFeelEvents, cardSlotStates: s.cardSlotStates,
      modalState: s.modalState, actionPanelState: s.actionPanelState,
      trainingVM: call('trainingVM'), historyVM: call('historyVM'),
      lastError: lastError,
      capturedAt: (typeof Date !== 'undefined' && Date.now) ? Date.now() : 0,
    };
  }

  var ITEMS = [
    { id: 'state', label: '复制 dumpState', get: function () { return call('dumpState'); } },
    { id: 'hh', label: '复制 handHistory', get: function () { return call('dumpHandHistory'); } },
    { id: 'gfe', label: '复制 GameFeelEvents', get: function () { return call('dumpGameFeelEvents'); } },
    { id: 'slots', label: '复制 CardSlots', get: function () { return call('dumpCardSlots'); } },
    { id: 'tvm', label: '复制 TrainingVM', get: function () { return call('trainingVM'); } },
    { id: 'hvm', label: '复制 HistoryVM', get: function () { return call('historyVM'); } },
    { id: 'full', label: '复制完整 bug snapshot', get: fullSnapshot, primary: true },
  ];

  function jsonOf(o) { try { return JSON.stringify(o, null, 2); } catch (e) { return String(o); } }

  var panel = null, ta = null, status = null;
  function build() {
    if (panel) return panel;
    panel = document.createElement('div');
    panel.id = 'qa-panel'; panel.className = 'qa-panel hidden';
    var h = '<div class="qa-mask" data-qa="close"></div><div class="qa-box">'
      + '<div class="qa-head"><span>🐞 QA 采集 <i class="qa-ver"></i></span><button class="qa-x" data-qa="close">✕</button></div>'
      + '<div class="qa-btns">' + ITEMS.map(function (it) { return '<button class="qa-btn' + (it.primary ? ' primary' : '') + '" data-qa-copy="' + it.id + '">' + it.label + '</button>'; }).join('') + '</div>'
      + '<div class="qa-status"></div>'
      + '<textarea class="qa-ta hidden" readonly placeholder="长按全选复制"></textarea>'
      + '</div>';
    panel.innerHTML = h;
    (document.getElementById('screen-table') || document.body).appendChild(panel);
    ta = panel.querySelector('.qa-ta'); status = panel.querySelector('.qa-status');
    panel.querySelector('.qa-ver').textContent = (window.__APP_VERSION || 'dev') + ' · ' + (window.__BUILD_COMMIT || 'dev');
    panel.addEventListener('click', onClick);
    return panel;
  }
  function setStatus(t) { if (status) status.textContent = t || ''; }
  function showTextarea(text) { if (!ta) return; ta.classList.remove('hidden'); ta.value = text; try { ta.focus(); ta.select(); } catch (e) {} setStatus('不支持自动复制 → 已填入下方文本框，长按全选复制'); }
  function copyText(text) {
    if (ta) ta.classList.add('hidden');
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { setStatus('✅ 已复制到剪贴板（' + text.length + ' 字）'); }).catch(function () { showTextarea(text); });
    } else { showTextarea(text); }
  }
  function onClick(ev) {
    var t = ev.target && ev.target.closest && ev.target.closest('[data-qa],[data-qa-copy]'); if (!t) return;
    if (t.getAttribute('data-qa') === 'close') return close();
    var id = t.getAttribute('data-qa-copy'); if (!id) return;
    var it = ITEMS.filter(function (x) { return x.id === id; })[0]; if (!it) return;
    var text = jsonOf(it.get());
    copyText(text);
  }
  function open() { build(); panel.classList.remove('hidden'); setStatus('点按钮复制对应快照'); }
  function close() { if (panel) { panel.classList.add('hidden'); if (ta) ta.classList.add('hidden'); } }
  function isOpen() { return !!(panel && !panel.classList.contains('hidden')); }

  // ---- 5 连点版本号触发 ----
  var taps = 0, tapTimer = null;
  function onVersionTap() {
    taps++;
    if (tapTimer) clearTimeout(tapTimer);
    tapTimer = setTimeout(function () { taps = 0; }, 1200);
    if (taps >= 5) { taps = 0; open(); }
  }
  function wireVersion() {
    var v = document.getElementById('app-version'); if (!v) return;
    v.textContent = window.__APP_VERSION || 'dev';
    if (v._qaWired) return; v._qaWired = true;
    v.addEventListener('click', onVersionTap);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wireVersion); else wireVersion();
  // 牌桌 DOM 可能晚于本脚本就绪：暴露 wire 供 ui 初始化后再调一次
  window.__qaCapture = { snapshot: fullSnapshot, items: ITEMS, open: open, close: close, isOpen: isOpen, wireVersion: wireVersion, _tap: onVersionTap };
})();
