/* ModalLayer —— 牌桌内弹窗(独立 #table-modal，绝不与 Hall 的 #modal-overlay 混用)。
   支持：牌桌设置 / 手牌详情 / 策略解释详情 / 退出确认 / 补充训练筹码 / 本手总结 / 快捷语选择面板。
   open(kind,data) / close() / isOpen()。打开时禁用 ActionPanel(门控)，关闭后由 data.onClose 恢复。ui.js 不直接拼 table modal DOM。 */
(function (root, factory) {
  const req = (typeof require !== 'undefined');
  const Base = req ? require('./_base.js') : window.RHCore.LayerBase;
  const m = factory(Base);
  if (typeof module !== 'undefined' && module.exports) module.exports = m;
  if (typeof window !== 'undefined') (window.RHCore = window.RHCore || {}).ModalLayer = m;
})(this, function (Base) {
  const TITLES = { settings: '牌桌设置', handDetail: '手牌详情', strategy: '策略解释', exit: '退出牌桌', rebuy: '补充训练筹码', summary: '本手总结', quickword: '快捷语 / 表情' };
  let el = null, openKind = null, curData = null;
  function ap() { return (typeof window !== 'undefined' && window.RHCore && window.RHCore.ActionPanel) || null; }
  function body(kind, data) {
    data = data || {};
    if (kind === 'exit') return `<p class="tm-msg">${data.message || '确定退出当前牌桌？本局训练进度将结束。'}</p><div class="tm-btns"><button class="tm-btn cancel" data-tm="close">取消</button><button class="tm-btn danger" data-tm="confirm">退出</button></div>`;
    if (kind === 'rebuy') return `<p class="tm-msg">${data.message || '补充训练筹码（本地训练用，不涉真钱）'}</p><div class="tm-amt">+${data.amountText || data.amount || 0}</div><div class="tm-btns"><button class="tm-btn cancel" data-tm="close">取消</button><button class="tm-btn primary" data-tm="confirm">补充</button></div>`;
    if (kind === 'settings') return `<div class="tm-rows">${(data.rows || []).map((r) => `<button class="tm-row" data-tm="opt" data-v="${r.id}">${r.label}<i>${r.value || ''}</i></button>`).join('')}</div><div class="tm-btns"><button class="tm-btn" data-tm="close">完成</button></div>`;
    if (kind === 'quickword') {
      const ph = (data.phrases || []).map((p) => `<button class="tm-chip" data-tm="say" data-v="${p}">${p}</button>`).join('');
      const em = (data.emojis || []).map((e) => `<button class="tm-emoji" data-tm="emoji" data-v="${e}">${e}</button>`).join('');
      return `<div class="tm-phrases">${ph}</div><div class="tm-emojis">${em}</div><div class="tm-btns"><button class="tm-btn" data-tm="close">关闭</button></div>`;
    }
    // handDetail / strategy / summary：内容 HTML 由 ui.js 提供
    return `<div class="tm-content">${data.html || ''}</div><div class="tm-btns"><button class="tm-btn" data-tm="close">关闭</button></div>`;
  }
  function paint() {
    if (!el) return;
    if (!openKind) { el.classList.add('hidden'); el.innerHTML = ''; return; }
    el.classList.remove('hidden');
    el.innerHTML = `<div class="tm-mask" data-tm="close"></div><div class="tm-box"><div class="tm-head"><span>${TITLES[openKind] || ''}</span><button class="tm-x" data-tm="close">✕</button></div><div class="tm-body">${body(openKind, curData)}</div></div>`;
  }
  function close() {
    const data = curData || {}; openKind = null; curData = null; paint();
    try { if (data.onClose) data.onClose(); } catch (e) {}
  }
  function onClick(ev) {
    const t = ev.target && ev.target.closest && ev.target.closest('[data-tm]'); if (!t) return;
    const act = t.getAttribute('data-tm'), v = t.getAttribute('data-v'), data = curData || {};
    if (act === 'close') return close();
    if (act === 'confirm') { try { if (data.onConfirm) data.onConfirm(); } catch (e) {} return close(); }
    if (act === 'opt') { try { if (data.onOpt) data.onOpt(v); } catch (e) {} return; }
    if (act === 'say') { try { if (data.onPick) data.onPick(v, false); } catch (e) {} return close(); }
    if (act === 'emoji') { try { if (data.onPick) data.onPick(v, true); } catch (e) {} return close(); }
  }
  function create() {
    const layer = Base.make('ModalLayer', { resolve: (d) => { let e = d.getElementById('table-modal'); if (!e) { e = d.createElement('div'); e.id = 'table-modal'; e.className = 'table-modal hidden'; const p = d.getElementById('screen-table') || d.body; if (p) p.appendChild(e); } return e; }, onMount: (e) => { el = e; if (e && e.addEventListener) e.addEventListener('click', onClick); } });
    layer.open = (kind, data) => { openKind = kind; curData = data || {}; paint(); const a = ap(); if (a && a.disableAll) try { a.disableAll(); } catch (e) {} return layer; };  // 打开即门控 ActionPanel
    layer.close = close;
    layer.isOpen = () => !!openKind;
    layer.kind = () => openKind;
    return layer;
  }
  return { create };
});
