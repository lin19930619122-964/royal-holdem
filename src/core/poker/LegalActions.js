/* LegalActions —— 由当前状态推出当前行动者的合法动作与下注边界(最小加注/有效筹码/全下)。
   UI 必须据此置灰非法按钮；reducer 也用它做最终校验。纯逻辑，无 UI。 */
(function (root, factory) {
  const TableState = (typeof require !== 'undefined') ? require('./TableState.js') : window.RHCore.TableState;
  const m = factory(TableState);
  if (typeof module !== 'undefined' && module.exports) module.exports = m;
  if (typeof window !== 'undefined') (window.RHCore = window.RHCore || {}).LegalActions = m;
})(this, function (TableState) {
  // 返回 { actions:[...], canCheck, canCall, callAmount, canRaise, isBet, minRaiseTo, maxRaiseTo, toCall, pot, currentBet, chips }
  function forCurrent(state) {
    const i = state.current, p = state.players[i];
    const none = { actions: [], canCheck: false, canCall: false, callAmount: 0, canRaise: false, isBet: false, minRaiseTo: 0, maxRaiseTo: 0, toCall: 0, pot: TableState.potTotal(state), currentBet: state.currentBet, chips: 0 };
    if (i < 0 || !p || p.folded || p.allIn || p.sittingOut || p.stack <= 0) return none;
    const toCall = Math.max(0, state.currentBet - p.bet);
    const canCheck = toCall === 0;
    const canCall = toCall > 0 && p.stack > 0;
    const callAmount = Math.min(toCall, p.stack + p.bet); // 跟到的总额(=currentBet 或全下)
    const isBet = state.currentBet === 0;
    const maxRaiseTo = p.bet + p.stack; // 全下到的总额
    const minRaiseTo = isBet ? Math.max(state.config.bigBlind, state.minRaise) : state.currentBet + Math.max(state.lastRaiseSize, state.config.bigBlind);
    const canRaise = (p.stack > toCall) && (maxRaiseTo >= Math.min(minRaiseTo, maxRaiseTo)) && (maxRaiseTo > state.currentBet);
    const actions = ['fold'];
    if (canCheck) actions.push('check'); else if (canCall) actions.push('call');
    if (canRaise) actions.push(isBet ? 'bet' : 'raise');
    if (p.stack > 0) actions.push('allin');
    return {
      actions, canCheck, canCall, callAmount, canRaise, isBet,
      minRaiseTo: Math.min(minRaiseTo, maxRaiseTo), maxRaiseTo, toCall,
      pot: TableState.potTotal(state), currentBet: state.currentBet, chips: p.stack + p.bet,
    };
  }
  function isLegal(state, action, amount) {
    const o = forCurrent(state);
    if (!o.actions.includes(action)) return false;
    if (action === 'raise' || action === 'bet') { const t = amount | 0; return t >= o.minRaiseTo && t <= o.maxRaiseTo; }
    return true;
  }
  return { forCurrent, isLegal };
});
