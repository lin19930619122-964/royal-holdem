/* TableState —— 初始状态构造 + 座位/顺序纯函数助手。不含规则推进(在 GameReducer)。无 UI。 */
(function (root, factory) {
  const SeededRng = (typeof require !== 'undefined') ? require('./SeededRng.js') : window.RHCore.SeededRng;
  const m = factory(SeededRng);
  if (typeof module !== 'undefined' && module.exports) module.exports = m;
  if (typeof window !== 'undefined') (window.RHCore = window.RHCore || {}).TableState = m;
})(this, function (SeededRng) {
  function makePlayer(seat, stack) {
    return { id: 'p' + seat, seat, stack, bet: 0, totalBet: 0, folded: false, allIn: false, sittingOut: false, hole: [], hasActed: false, lastAction: '', winThisHand: 0, isHuman: false };
  }
  function create(config) {
    const cfg = Object.assign({ numPlayers: 6, smallBlind: 50, bigBlind: 100, ante: 0, startingStack: 10000, seed: 1 }, config || {});
    cfg.numPlayers = Math.max(2, Math.min(9, cfg.numPlayers));
    const players = [];
    for (let i = 0; i < cfg.numPlayers; i++) players.push(makePlayer(i, cfg.startingStack));
    return {
      config: cfg, players, button: -1, sbIndex: -1, bbIndex: -1,
      deck: [], board: [], street: 'idle', current: -1,
      currentBet: 0, minRaise: cfg.bigBlind, lastRaiseSize: cfg.bigBlind,
      handNo: 0, seed: cfg.seed, rng: SeededRng.create(cfg.seed),
      awaitingDeal: null, handOver: false, result: null, log: [],
    };
  }
  // 是否可坐入(有筹码、未坐出)
  function inHand(p) { return !p.sittingOut && p.stack >= 0 && !p.out; }
  // 从 fromSeat(不含)开始顺时针返回满足 pred 的座位顺序
  function orderFrom(state, fromSeat, pred) {
    const n = state.players.length, out = [];
    for (let k = 1; k <= n; k++) { const i = (fromSeat + k) % n; if (!pred || pred(state.players[i], i)) out.push(i); }
    return out;
  }
  function nextActive(state, fromSeat) {
    const o = orderFrom(state, fromSeat, (p) => !p.sittingOut && p.stack > 0);
    return o.length ? o[0] : -1;
  }
  function clone(state) {
    return {
      config: state.config,
      players: state.players.map((p) => Object.assign({}, p, { hole: p.hole.slice() })),
      button: state.button, sbIndex: state.sbIndex, bbIndex: state.bbIndex,
      deck: state.deck.slice(), board: state.board.slice(), street: state.street, current: state.current,
      currentBet: state.currentBet, minRaise: state.minRaise, lastRaiseSize: state.lastRaiseSize,
      handNo: state.handNo, seed: state.seed, rng: state.rng,
      awaitingDeal: state.awaitingDeal, handOver: state.handOver, result: state.result, log: state.log.slice(),
    };
  }
  function potTotal(state) { return state.players.reduce((s, p) => s + (p.totalBet || 0), 0); }
  return { makePlayer, create, inHand, orderFrom, nextActive, clone, potTotal };
});
