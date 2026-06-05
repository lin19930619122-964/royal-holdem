/* selectors —— 把 reducer state 投影成 UI 需要的只读视图。纯函数、不修改 state。
   UI 只读这些投影来渲染；任何写操作必须经 GameReducer。无 UI/DOM。 */
(function (root, factory) {
  const req = (typeof require !== 'undefined');
  const Legal = req ? require('./LegalActions.js') : window.RHCore.LegalActions;
  const HandEval = req ? require('./HandEvaluator.js') : window.RHCore.HandEvaluator;
  const TableState = req ? require('./TableState.js') : window.RHCore.TableState;
  const m = factory(Legal, HandEval, TableState);
  if (typeof module !== 'undefined' && module.exports) module.exports = m;
  if (typeof window !== 'undefined') (window.RHCore = window.RHCore || {}).selectors = m;
})(this, function (Legal, HandEval, TableState) {
  const pot = (s) => TableState.potTotal(s);
  const board = (s) => s.board.slice();

  // 单座位视图（含庄/盲/行动/摊牌可见性等 UI 状态标记）
  function seatView(s, seat) {
    const p = s.players[seat]; if (!p) return null;
    const reveal = (s.result && s.result.reveal) || [];
    const showHole = (p.isHuman || reveal.includes(seat)) && p.hole && p.hole.length > 0;
    return {
      seat, id: p.id, name: p.id, isHero: !!p.isHuman,
      stack: p.stack, bet: p.bet, totalBet: p.totalBet,
      folded: p.folded, allIn: p.allIn, sittingOut: p.sittingOut, lastAction: p.lastAction,
      winThisHand: p.winThisHand || 0,
      isButton: seat === s.button, isSB: seat === s.sbIndex, isBB: seat === s.bbIndex,
      isActing: seat === s.current && !s.handOver,
      cappedToCall: !!p.cappedToCall,
      holeCount: p.hole ? p.hole.length : 0,
      hole: showHole ? p.hole.slice() : null,
    };
  }
  function seatViews(s) { return s.players.map((_, i) => seatView(s, i)); }

  // 当前行动者的合法动作（按钮门控用）
  function legalForCurrent(s) { return Legal.forCurrent(s); }
  // 给指定玩家的合法动作（仅当轮到他）
  function legalFor(s, playerId) { const p = s.players[s.current]; return (p && p.id === playerId) ? Legal.forCurrent(s) : null; }

  // 英雄(本人)手牌区训练视图
  function heroView(s) {
    const hero = s.players.find((p) => p.isHuman); if (!hero) return null;
    const made = (s.board.length >= 3 && hero.hole.length === 2) ? HandEval.evaluateBest(hero.hole.concat(s.board)) : null;
    return {
      seat: hero.seat, hole: hero.hole.slice(),
      handName: made ? HandEval.name(made.score) : '',
      best5: made ? made.cards.slice() : null,
      isTurn: s.current === hero.seat && !s.handOver,
    };
  }

  function tableView(s) {
    return {
      handNo: s.handNo, street: s.street, board: board(s), pot: pot(s),
      currentBet: s.currentBet, button: s.button, sbIndex: s.sbIndex, bbIndex: s.bbIndex,
      current: s.current, handOver: s.handOver, awaitingDeal: s.awaitingDeal,
      blinds: [s.config.smallBlind, s.config.bigBlind], ante: s.config.ante,
      seats: seatViews(s), result: s.result,
    };
  }
  return { pot, board, seatView, seatViews, legalForCurrent, legalFor, heroView, tableView };
});
