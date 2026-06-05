/* HandHistory —— 每手牌完整事件日志(结构化)。reducer 调用追加，可序列化/复盘。无 UI。 */
(function (root, factory) {
  const m = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = m;
  if (typeof window !== 'undefined') (window.RHCore = window.RHCore || {}).HandHistory = m;
})(this, function () {
  // 直接往 state.log 追加事件对象（reducer 在 clone 后调用，保持纯净）
  function push(state, type, data) { state.log.push(Object.assign({ t: type, hand: state.handNo, street: state.street }, data || {})); }
  function handStart(state) { push(state, 'HAND_START', { button: state.button, sb: state.sbIndex, bb: state.bbIndex, blinds: [state.config.smallBlind, state.config.bigBlind], ante: state.config.ante, stacks: state.players.map((p) => p.stack) }); }
  function deal(state, what, cards) { push(state, 'DEAL', { what, cards: cards ? cards.slice() : undefined, board: state.board.slice() }); }
  function action(state, seat, act, amount) { push(state, 'ACTION', { seat, act, amount: amount || 0, currentBet: state.currentBet, pot: state.players.reduce((s, p) => s + p.totalBet, 0) }); }
  function showdown(state, result) { push(state, 'SHOWDOWN', { board: state.board.slice(), pots: result.pots, winnings: result.winnings, hands: result.handNames }); }
  function award(state, seat, amount, reason) { push(state, 'AWARD', { seat, amount, reason }); }
  // 取某手的事件子序列
  function forHand(state, handNo) { return state.log.filter((e) => e.hand === handNo); }
  return { push, handStart, deal, action, showdown, award, forHand };
});
