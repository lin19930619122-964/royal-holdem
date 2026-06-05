/* DecisionReasonFormatter —— 把决策上下文装配成可学习级别的复盘理由。
   含 street/position/handClass(含踢脚)/boardTexture/equity/potOdds/SPR/actionHistory/intent/尺度解释。纯逻辑，无 UI。 */
(function (root, factory) {
  const m = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = m;
  if (typeof window !== 'undefined') (window.RHCore = window.RHCore || {}).DecisionReasonFormatter = m;
})(this, function () {
  const STREET_CN = { preflop: '翻前', flop: '翻牌', turn: '转牌', river: '河牌' };
  function sizeWord(action, pot) {
    if (!action || (action.type !== 'bet' && action.type !== 'raise')) return '';
    if (action.type === 'raise') return '加注';
    const f = pot > 0 ? (action.amount || 0) / pot : 0;
    if (f < 0.4) return '约⅓池小注';
    if (f < 0.62) return '约半池下注';
    if (f < 0.9) return '约⅔池下注';
    return '大额/超池下注';
  }
  function sizingSentence(intent, action, pot) {
    const sw = sizeWord(action, pot);
    switch (intent) {
      case 'value': return action.type === 'raise' ? '用强成牌加注，向更差的牌要价值并保护权益' : `当前无人下注，适合用${sw}从更差成牌、口袋对子获取价值，同时保护权益`;
      case 'thin_value': return `用中等成牌做${sw}薄价值，控制尺度避免被反加`;
      case 'semi_bluff': return `靠听牌${sw}施压，未成牌也有补牌权益`;
      case 'bluff': return `在对手范围偏弱时${sw}诈唬施压`;
      case 'check_raise': return '在被下注后加注(check-raise)，强牌价值/强听牌半诈唬';
      case 'bluff_catch': return '用边缘成牌抓诈唬，仅跟一手不扩大底池';
      case 'check_call': return '用边缘成牌/听牌跟注控池，避免昂贵失误';
      case 'pot_control': return '过牌控池，避免在边缘牌力上把底池做大';
      case 'give_up': return action.type === 'fold' ? '牌力/赔率不足，弃牌止损' : '放弃主动，过牌看牌';
      default: return sw ? `${sw}` : '按牌力与赔率行动';
    }
  }
  // ctx: { street, position, handClassCn, boardTextureCn, equity, potOdds, spr, intent, action, pot, historyCn, rangeHint }
  function format(c) {
    const seg = [];
    const head = `${c.position || ''} ${STREET_CN[c.street] || ''}在${c.boardTextureCn || ''}击中${c.handClassCn || ''}`;
    seg.push(head.trim());
    seg.push(`SPR ${c.spr != null ? (Math.round(c.spr * 10) / 10) : '—'}`);
    seg.push(`权益约 ${Math.round((c.equity || 0) * 100)}%`);
    if (c.potOdds > 0) seg.push(`底池赔率 ${Math.round(c.potOdds * 100)}%`);
    let s = seg.join('，') + '。';
    s += sizingSentence(c.intent, c.action || {}, c.pot || 0) + '。';
    if (c.historyCn) s += `此前${c.historyCn}` + (c.rangeHint ? `，${c.rangeHint}` : '') + '。';
    return s;
  }
  return { format, sizeWord };
});
