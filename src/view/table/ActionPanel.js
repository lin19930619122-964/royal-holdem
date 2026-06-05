/* ActionPanel —— 行动面板，由 LegalActions 驱动。不造假按钮：把说明书的 13 个概念控件映射到本项目真实控件：
   foldButton=#btn-fold, checkButton=#btn-check, callButton=#btn-call,
   betButton/raiseButton=#btn-raise(进入加注尺度流)+#btn-confirm-raise, allInButton=.quick[data-q=allin],
   minRaiseButton=.quick[data-q=min], halfPotButton=[data-q=half], twoThirdPotButton=[data-q=twothird], potButton=[data-q=pot],
   raiseSlider=#raise-slider, amountInput=#raise-input, legalActionHint=#legal-hint(本模块补建)。
   renderLegal(options) 据合法集合 启用/禁用/隐藏 + 填提示，UI 不可能发出非法行动。执行逻辑仍由 ui.js 既有处理器负责（避免重复绑定）。 */
(function (root, factory) {
  const m = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = m;
  if (typeof window !== 'undefined') (window.RHCore = window.RHCore || {}).ActionPanel = m;
})(this, function () {
  const $ = (id) => document.getElementById(id);
  // 概念控件 → 真实 DOM 选择器
  const CONTROLS = {
    foldButton: '#btn-fold', checkButton: '#btn-check', callButton: '#btn-call',
    betButton: '#btn-raise', raiseButton: '#btn-raise', allInButton: '.quick[data-q="allin"]',
    halfPotButton: '.quick[data-q="half"]', twoThirdPotButton: '.quick[data-q="twothird"]',
    potButton: '.quick[data-q="pot"]', minRaiseButton: '.quick[data-q="min"]',
    raiseSlider: '#raise-slider', amountInput: '#raise-input', legalActionHint: '#legal-hint',
  };
  function mount() {
    const area = $('action-area');
    if (area && !$('legal-hint')) { const h = document.createElement('div'); h.id = 'legal-hint'; h.className = 'legal-hint hidden'; area.appendChild(h); }
    return CONTROLS;
  }
  // options 同 LegalActions.forCurrent / game.actionOptions：{canCheck,toCall,callAmount,canRaise,isBet,minRaiseTo,maxRaiseTo}
  function renderLegal(options) {
    const o = options || {};
    const can = {
      fold: true, check: !!o.canCheck, call: o.toCall > 0 && (o.callAmount || 0) > 0,
      raise: !!o.canRaise, allin: (o.chips || o.maxRaiseTo || 0) > 0,
    };
    const set = (id, on) => { const b = $(id); if (b) { b.disabled = !on; b.classList.toggle('hidden', !on); } };
    set('btn-fold', can.fold); set('btn-check', can.check); set('btn-call', can.call); set('btn-raise', can.raise);
    // 跟注按钮文案由 ui.js 负责(含"全下 X"标签)，此处只管合法性
    document.querySelectorAll('.quick-bets .quick').forEach((q) => { const on = q.dataset.q === 'allin' ? can.allin : can.raise; q.disabled = !on; q.classList.toggle('hidden', !on); });
    const hint = $('legal-hint');
    if (hint) {
      const p = [];
      if (can.check) p.push('可过牌'); if (can.call) p.push(`跟注 ${o.callAmount || 0}`);
      if (can.raise) p.push(`${o.isBet ? '下注' : '加注'} ${o.minRaiseTo || 0}~${o.maxRaiseTo || 0}`);
      if (can.allin) p.push('可全下');
      hint.textContent = p.join(' · '); hint.classList.toggle('hidden', !p.length);
    }
    return can;
  }
  function legalSet(o) { const c = renderLegal.__last; return c; }
  return { mount, renderLegal, CONTROLS };
});
