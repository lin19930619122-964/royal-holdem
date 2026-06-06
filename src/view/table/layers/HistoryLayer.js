/* HistoryLayer —— 桌内行动历史简条(非完整复盘页)。显示：当前手号·街道 + 最近 5 条行动(昵称/位置/动作/金额)，
   all-in/big pot/showdown 特殊标记；一手结束后提供进入完整 replay 的入口。无当前行动时回落显示近期手净额。
   数据来自 vm.history(ui.js 据 GameState/行动日志构建)。ui.js 不再直接渲染桌内历史简条。 */
(function (root, factory) {
  const req = (typeof require !== 'undefined');
  const Base = req ? require('./_base.js') : window.RHCore.LayerBase;
  const m = factory(Base);
  if (typeof module !== 'undefined' && module.exports) module.exports = m;
  if (typeof window !== 'undefined') (window.RHCore = window.RHCore || {}).HistoryLayer = m;
})(this, function (Base) {
  const ACT_CLS = { '弃牌': 'fold', '过牌': 'check', '跟注': 'call', '下注': 'bet', '加注': 'raise', '全下': 'allin' };
  function actionRow(a) {
    const cls = ACT_CLS[a.action] || '';
    const amt = (a.amount > 0 && a.action !== '弃牌' && a.action !== '过牌') ? ` <b>${a.amountText}</b>` : '';
    const mark = a.marker ? `<i class="ha-mark ${a.marker}">${a.marker === 'allin' ? '🔥' : a.marker === 'showdown' ? '🃏' : '💰'}</i>` : '';
    return `<span class="ha-row ${cls}"><i class="ha-pos">${a.position || ''}</i><i class="ha-nick">${a.nickname || ''}</i><i class="ha-act">${a.action}</i>${amt}${mark}</span>`;
  }
  function create() {
    return Base.make('HistoryLayer', { id: 'hand-strip', onRender: (el, vm) => {
      const h = vm && vm.history; if (!el) return;
      if (!h) { el.classList.add('hidden'); return; }
      const acts = (h.actions || []).slice(-5);
      const recent = h.recentHands || [];
      if (!acts.length && !recent.length) { el.classList.add('hidden'); return; }
      el.classList.remove('hidden');
      let html = '';
      if (acts.length) {
        const replay = (h.canReplay && h.replayNo != null) ? `<button class="ha-replay" data-replay-hand="${h.replayNo}">复盘#${h.replayNo}</button>` : '';
        html += `<span class="ha-head">#${h.handNo} <i>${h.streetLabel || ''}</i>${replay}</span>` + acts.map(actionRow).join('');
      }
      if (recent.length) {
        html += recent.map((r) => { const c = r.net > 0 ? 'up' : r.net < 0 ? 'down' : 'flat'; const s = r.net > 0 ? '+' : ''; return `<span class="hs-item ${c}">#${r.no} ${s}${r.netText}</span>`; }).join('');
      }
      el.innerHTML = html;
    } });
  }
  return { create };
});
