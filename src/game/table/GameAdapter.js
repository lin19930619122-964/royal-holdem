/* GameAdapter —— 绞杀者适配器：对外暴露与旧 src/game.js 完全一致的接口，
   内部由 core/poker reducer 驱动（唯一事实源）。用于把 UI 从旧引擎平滑切到 reducer，
   切换点仅一行(startTable 里 new Game → GameAdapter.create)，UI 其余代码无需改。
   规则铁律：状态只经 GameReducer 改；本适配器只做"接口翻译 + 只读投影"。无 DOM。 */
(function (root, factory) {
  const req = (typeof require !== 'undefined');
  const TableState = req ? require('../../core/poker/TableState.js') : window.RHCore.TableState;
  const Reducer = req ? require('../../core/poker/GameReducer.js') : window.RHCore.GameReducer;
  const m = factory(TableState, Reducer);
  if (typeof module !== 'undefined' && module.exports) module.exports = m;
  if (typeof window !== 'undefined') (window.RHCore = window.RHCore || {}).GameAdapter = m;
})(this, function (TableState, Reducer) {
  const reducer = Reducer.reducer;
  const PHASE = { idle: 'idle', preflop: 'preflop', flop: 'flop', turn: 'turn', river: 'river', showdown: 'ended', handover: 'ended' };

  // opts 同旧 Game：{ smallBlind, bigBlind, ante, startChips, bots, seed? }
  function create(opts) {
    opts = opts || {};
    const numPlayers = (opts.bots != null ? opts.bots + 1 : (opts.numPlayers || 6));
    const seed = opts.seed != null ? opts.seed : ((Math.floor((Date.now ? Date.now() : 0) % 2147483647)) || 1);
    const self = {
      _state: TableState.create({ numPlayers, smallBlind: opts.smallBlind, bigBlind: opts.bigBlind, ante: opts.ante || 0, startingStack: opts.startChips, seed }),
      _gameover: false,
    };
    // 人类固定 seat 0（与旧 Game 一致）
    self._state.players[0].isHuman = true;

    // ---- 玩家代理：字段名翻译 + 读写直达当前 _state ----
    const FIELD = { chips: 'stack', out: 'sittingOut', totalContribution: 'totalBet' };
    const PASS = ['bet', 'folded', 'allIn', 'hole', 'hasActed', 'lastAction', 'winThisHand', 'isHuman', 'name', 'avatar', 'ai'];
    function makeProxy(i) {
      const px = {};
      Object.defineProperty(px, 'id', { get() { return i; }, enumerable: true });      // 数字 id=座位（匹配旧 Game）
      Object.defineProperty(px, 'seat', { get() { return i; }, enumerable: true });
      for (const k in FIELD) { const v = FIELD[k]; Object.defineProperty(px, k, { get() { return self._state.players[i][v]; }, set(val) { self._state.players[i][v] = val; }, enumerable: true }); }
      for (const k of PASS) { (function (key) { Object.defineProperty(px, key, { get() { return self._state.players[i][key]; }, set(val) { self._state.players[i][key] = val; }, enumerable: true }); })(k); }
      return px;
    }
    const proxies = self._state.players.map((_, i) => makeProxy(i));

    function potTotal() { return TableState.potTotal(self._state); }
    function niceSummary(r) {
      if (!r) return '';
      if (!r.showdown) { const w = r.reveal[0]; return w != null ? `${proxies[w].name || ('玩家' + (w + 1))} 赢得底池（其余弃牌）` : ''; }
      let topSeat = null, topAmt = -1;
      for (const seat in (r.winnings || {})) if (r.winnings[seat] > topAmt) { topAmt = r.winnings[seat]; topSeat = +seat; }
      return topSeat != null ? `${proxies[topSeat].name || ('玩家' + (topSeat + 1))} 凭【${r.handNames[topSeat] || ''}】赢得 ${topAmt}` : '本手结束';
    }

    const api = {
      get players() { return proxies; },
      get N() { return self._state.players.length; },
      get pot() { return potTotal(); },
      get board() { return self._state.board; },
      get button() { return self._state.button; },
      get handNo() { return self._state.handNo; },
      get currentBet() { return self._state.currentBet; },
      get minRaise() { return self._state.lastRaiseSize; },
      get sbIdx() { return self._state.sbIndex; },
      get bbIdx() { return self._state.bbIndex; },
      get smallBlind() { return self._state.config.smallBlind; },
      get bigBlind() { return self._state.config.bigBlind; },
      get ante() { return self._state.config.ante; },
      get phase() { return self._gameover ? 'gameover' : (PHASE[self._state.street] || 'idle'); },
      get bettingOpen() { return self._state.current >= 0 && !self._state.handOver; },
      get current() { return self._state.current >= 0 ? self._state.current : null; },
      get result() {
        if (self._gameover) return { gameOver: true, winner: proxies.find((p) => p.chips > 0) || null };
        const r = self._state.result; if (!r) return null;
        return { showdown: r.showdown, reveal: r.reveal.slice(), pots: r.pots, handScores: r.handScores, handNames: r.handNames, summary: niceSummary(r) };
      },

      startHand() {
        self._gameover = false;
        self._state = reducer(self._state, { type: 'START_NEXT_HAND' });
        const seated = self._state.players.filter((p) => !p.sittingOut).length;
        if (seated < 2) { self._gameover = true; return; }
        if (self._state.street === 'preflop') self._state = reducer(self._state, { type: 'DEAL_HOLE_CARDS' });
      },
      act(action, amountTo) {
        if (!(self._state.current >= 0) || self._state.handOver) return;
        let a = action;
        if (a === 'raise' && self._state.currentBet === 0) a = 'bet';          // 开下注用 bet
        const p = self._state.players[self._state.current];
        self._state = reducer(self._state, { type: 'PLAYER_ACTION', playerId: p.id, action: a, amount: amountTo });
      },
      proceed() {
        if (self._state.handOver || self._state.current >= 0) return;
        if (self._state.awaitingDeal) self._state = reducer(self._state, { type: self._state.awaitingDeal });
      },
      actionOptions() {
        const s = self._state, p = s.players[s.current];
        if (!p) return { canCheck: true, toCall: 0, callAmount: 0, canRaise: false, minRaiseTo: 0, maxRaiseTo: 0, chips: 0, isBet: true, currentBet: 0, bigBlind: s.config.bigBlind, pot: potTotal() };
        const toCall = Math.max(0, s.currentBet - p.bet);
        const maxRaiseTo = p.bet + p.stack;
        const minRaiseTo = Math.min(s.currentBet + Math.max(s.lastRaiseSize, s.config.bigBlind), maxRaiseTo);
        return {
          canCheck: toCall === 0, toCall, callAmount: Math.min(toCall, p.stack),
          canRaise: p.stack > toCall && !p.cappedToCall, minRaiseTo, maxRaiseTo, chips: p.stack,
          isBet: s.currentBet === 0, currentBet: s.currentBet, bigBlind: s.config.bigBlind, pot: potTotal(),
        };
      },
      aiContext() {
        const s = self._state;
        return { board: s.board, pot: potTotal(), currentBet: s.currentBet, minRaise: s.lastRaiseSize, bigBlind: s.config.bigBlind, players: proxies, button: s.button, street: s.street };
      },
      // 调试/迁移期：取底层 reducer state
      _raw() { return self._state; },
    };
    return api;
  }
  return { create };
});
