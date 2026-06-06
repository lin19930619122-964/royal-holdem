/* TrainingAssistantLayer —— 桌内训练助手(#hand-hint)。默认一句短提示；点开看详细解释。
   decision 模式：当前牌型/胜率/底池赔率/SPR/建议行动/一句理由；observe 模式：观察对手行动；summary 模式：本手关键决策评价。
   数据来自 vm.training(ui.js 据 PokerBrain reason / LegalActions / GameState / handAnalysis 构建)。ui.js 不再直接渲染训练提示 DOM。 */
(function (root, factory) {
  const req = (typeof require !== 'undefined');
  const Base = req ? require('./_base.js') : window.RHCore.LayerBase;
  const m = factory(Base);
  if (typeof module !== 'undefined' && module.exports) module.exports = m;
  if (typeof window !== 'undefined') (window.RHCore = window.RHCore || {}).TrainingAssistantLayer = m;
})(this, function (Base) {
  let expanded = false, lastVm = null, layerEl = null;
  function detailHTML(t) {
    const rows = [];
    if (t.handClass) rows.push(`牌型：<b>${t.handClass}</b>`);
    if (t.winPct != null) rows.push(`胜率：<b>${t.winPct}%</b>（赢${t.winPct} 平${t.tiePct} 输${t.losePct}）`);
    if (t.potOdds != null) rows.push(`底池赔率：<b>${t.potOdds}%</b>`);
    if (t.spr != null) rows.push(`SPR：<b>${t.spr}</b>`);
    if (t.outs) rows.push(`听牌：<b>${t.outs}</b> outs`);
    if (t.rangeEq != null) rows.push(`对${t.aggrName || '对手'}范围(前${t.rangePct}%)胜率：<b>${t.rangeEq}%</b>`);
    if (t.reason) rows.push(`理由：${t.reason}`);
    if (t.posLabel) rows.push(`位置：${t.posLabel}`);
    return `<div class="ta-detail">${rows.map((r) => `<div class="ta-d">${r}</div>`).join('')}</div>`;
  }
  function paint() {
    const el = layerEl, t = lastVm; if (!el) return;
    if (!t || !t.visible) { el.classList.add('hidden'); el.innerHTML = ''; return; }
    el.classList.remove('hidden');
    if (t.mode === 'observe') { el.innerHTML = `<div class="ta-line observe">👀 ${t.short}</div>`; return; }
    if (t.mode === 'summary') {
      el.innerHTML = `<div class="ta-line summary">📋 ${t.short}` + (t.canExpand ? `<button class="ta-toggle" data-ta-toggle="1">${expanded ? '收起' : '详'}</button>` : '') + `</div>` + (expanded && t.summaryDetail ? `<div class="ta-detail">${t.summaryDetail}</div>` : '');
      return;
    }
    const sugg = t.suggestion ? `<em class="ta-sugg">${t.suggestion}</em>` : '';
    const note = t.note ? `<i class="ta-note">${t.note}</i>` : '';
    el.innerHTML = `<div class="ta-line">${t.posTag ? '<span class="pos-tag">' + t.posTag + '</span> ' : ''}${t.short} ${sugg}${note}<button class="ta-toggle" data-ta-toggle="1">${expanded ? '收起' : '详'}</button></div>` + (expanded ? detailHTML(t) : '');
  }
  function create() {
    const layer = Base.make('TrainingAssistantLayer', { id: 'hand-hint', onMount: (el) => { layerEl = el; }, onRender: (el, vm) => { layerEl = el; lastVm = vm && vm.training; paint(); } });
    layer.toggle = () => { expanded = !expanded; paint(); };
    layer.isExpanded = () => expanded;
    return layer;
  }
  return { create };
});
