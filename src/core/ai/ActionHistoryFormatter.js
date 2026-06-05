/* ActionHistoryFormatter —— 把跨街 actionHistory 渲染成可读摘要。
   英文摘要: "BTN call preflop, BB call preflop"；中文: "BTN 翻前跟注、BB 翻前跟注"。纯逻辑，无 UI。 */
(function (root, factory) {
  const m = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = m;
  if (typeof window !== 'undefined') (window.RHCore = window.RHCore || {}).ActionHistoryFormatter = m;
})(this, function () {
  const ACT_EN = { fold: 'fold', check: 'check', call: 'call', bet: 'bet', raise: 'raise', 'all-in': 'shove' };
  const ACT_CN = { fold: '弃牌', check: '过牌', call: '跟注', bet: '下注', raise: '加注', 'all-in': '全下' };
  const STREET_EN = { preflop: 'preflop', flop: 'flop', turn: 'turn', river: 'river' };
  const STREET_CN = { preflop: '翻前', flop: '翻牌', turn: '转牌', river: '河牌' };
  function entryPos(e) { return e.pos || (e.position) || ('seat' + (e.seat != null ? e.seat : '?')); }
  function format(history, opts) {
    opts = opts || {};
    const items = (history || []).filter((e) => e.action && e.action.type && e.action.type !== 'check' ? true : !!opts.includeChecks ? true : (e.action && e.action.type !== 'check'));
    const list = (history || []).filter((e) => e.action && e.action.type && (opts.includeChecks || e.action.type !== 'check'));
    const en = list.map((e) => `${entryPos(e)} ${ACT_EN[e.action.type] || e.action.type} ${STREET_EN[e.street] || e.street}`).join(', ');
    const cn = list.map((e) => `${entryPos(e)} ${STREET_CN[e.street] || e.street}${ACT_CN[e.action.type] || e.action.type}`).join('、');
    // 范围画像摘要（按翻前跟注者推断范围）
    const preCallers = (history || []).filter((e) => e.street === 'preflop' && e.action && e.action.type === 'call');
    const rangeHint = preCallers.length ? '翻前有玩家平跟，范围中有较多弱顶对牌、口袋对子和连接牌' : '';
    return { en, cn, count: list.length, rangeHint };
  }
  return { format };
});
