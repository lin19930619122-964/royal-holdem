/* GameReducer —— 唯一的状态推进入口。所有筹码/底池/牌堆变化只能经此 reducer。
   纯函数：reducer(state, action) → newState（输入不被修改）。无 UI、无随机副作用(用 state.rng 种子化)。
   动作：START_NEXT_HAND / DEAL_HOLE_CARDS / DEAL_FLOP / DEAL_TURN / DEAL_RIVER / PLAYER_ACTION / SHOWDOWN
   支持：2-9 人、盲注/前注、最小加注、有效筹码、全下自动跑牌、边池、多人摊牌、平分、完整日志。 */
(function (root, factory) {
  const req = (typeof require !== 'undefined');
  const TableState = req ? require('./TableState.js') : window.RHCore.TableState;
  const Deck = req ? require('./Deck.js') : window.RHCore.Deck;
  const Legal = req ? require('./LegalActions.js') : window.RHCore.LegalActions;
  const HandEval = req ? require('./HandEvaluator.js') : window.RHCore.HandEvaluator;
  const SidePot = req ? require('./SidePot.js') : window.RHCore.SidePot;
  const Hist = req ? require('./HandHistory.js') : window.RHCore.HandHistory;
  const m = factory(TableState, Deck, Legal, HandEval, SidePot, Hist);
  if (typeof module !== 'undefined' && module.exports) module.exports = m;
  if (typeof window !== 'undefined') (window.RHCore = window.RHCore || {}).GameReducer = m;
})(this, function (TableState, Deck, Legal, HandEval, SidePot, Hist) {
  const { clone, orderFrom, potTotal } = TableState;

  function liveSeats(s) { return s.players.filter((p) => !p.folded && !p.sittingOut); }
  function actableSeats(s) { return s.players.filter((p) => !p.folded && !p.allIn && !p.sittingOut && p.stack > 0); }
  // 把玩家筹码投入彩池(本街 bet + 本手 totalBet)，返回实际投入
  function commit(p, amount) {
    const put = Math.min(amount, p.stack);
    p.stack -= put; p.bet += put; p.totalBet += put;
    if (p.stack === 0) p.allIn = true;
    return put;
  }
  // 找下一个需要行动的座位（未弃、未全下、有筹码、且尚未行动或下注不足）
  function nextToAct(s, fromSeat) {
    const order = orderFrom(s, fromSeat, (p) => !p.folded && !p.allIn && !p.sittingOut && p.stack > 0);
    for (const seat of order) { const p = s.players[seat]; if (!p.hasActed || p.bet < s.currentBet) return seat; }
    return -1;
  }
  // 本街下注是否结束
  function roundClosed(s) {
    const act = actableSeats(s);
    if (act.length === 0) return true;
    return act.every((p) => p.hasActed && p.bet === s.currentBet);
  }
  function openBetting(s, firstSeat) {
    s.players.forEach((p) => { if (!p.folded && !p.allIn) { p.hasActed = false; p.cappedToCall = false; } });
    s.current = nextToAct(s, firstSeat);
  }
  // 计算下一步待发(供控制器自动跑牌)
  function computeAwaiting(s) {
    if (s.handOver) { s.awaitingDeal = null; return; }
    if (liveSeats(s).length <= 1) { s.awaitingDeal = 'SHOWDOWN'; s.current = -1; return; }
    if (s.current >= 0) { s.awaitingDeal = null; return; } // 等待玩家行动
    // 本街已结束：决定下一步
    s.awaitingDeal = s.street === 'preflop' ? 'DEAL_FLOP' : s.street === 'flop' ? 'DEAL_TURN' : s.street === 'turn' ? 'DEAL_RIVER' : 'SHOWDOWN';
  }
  // 退还未被跟到的超额下注（唯一最高投入者多出的部分）
  function refundUncalled(s) {
    const totals = s.players.map((p) => p.totalBet);
    const max = Math.max(...totals);
    if (max <= 0) return;
    const atMax = s.players.filter((p) => p.totalBet === max);
    if (atMax.length !== 1) return;
    const second = Math.max(0, ...s.players.filter((p) => p.totalBet < max).map((p) => p.totalBet));
    const refund = max - second;
    if (refund > 0) { const p = atMax[0]; p.stack += refund; p.totalBet -= refund; p.bet = Math.max(0, p.bet - refund); Hist.award(s, p.seat, refund, 'uncalled'); }
  }

  // ---------- 单手结算 ----------
  function resolve(s, isShowdown) {
    refundUncalled(s);
    const live = liveSeats(s);
    const pots = SidePot.compute(s.players);
    const order = orderFrom(s, s.button, () => true); // 庄位左手顺序(用于零头)
    s.players.forEach((p) => { p.winThisHand = 0; });
    let result;
    if (live.length <= 1) {
      // 全弃：唯一存活者拿走全部
      const w = live[0] || s.players.find((p) => !p.folded);
      const total = pots.reduce((a, b) => a + b.amount, 0);
      if (w) { w.stack += total; w.winThisHand = total; Hist.award(s, w.seat, total, 'fold-win'); }
      result = { showdown: false, reveal: w ? [w.seat] : [], pots: [{ amount: total, winners: w ? [w.seat] : [] }], winnings: w ? { [w.seat]: total } : {}, handScores: {}, handNames: {}, board: s.board.slice(), summary: w ? `${w.id} 赢得底池（其余弃牌）` : '' };
    } else {
      const scoreOf = {};
      const reveal = [];
      live.forEach((p) => { const r = HandEval.evaluateBest(p.hole.concat(s.board)); scoreOf[p.seat] = r.score; reveal.push(p.seat); });
      const dist = SidePot.distribute(pots, (seat) => scoreOf[seat], order);
      for (const seat in dist.winnings) { const p = s.players[+seat]; p.stack += dist.winnings[seat]; p.winThisHand = dist.winnings[seat]; }
      const handNames = {}; const handScores = {};
      live.forEach((p) => { handNames[p.seat] = HandEval.name(scoreOf[p.seat]); handScores[p.seat] = scoreOf[p.seat]; });
      const topWinnerSeat = Object.keys(dist.winnings).sort((a, b) => dist.winnings[b] - dist.winnings[a])[0];
      result = { showdown: true, reveal, pots: dist.potResults, winnings: dist.winnings, handScores, handNames, board: s.board.slice(), summary: topWinnerSeat != null ? `${s.players[+topWinnerSeat].id} 以 ${handNames[+topWinnerSeat]} 获胜` : '' };
      Hist.showdown(s, result);
    }
    s.result = result; s.street = 'handover'; s.current = -1; s.handOver = true; s.awaitingDeal = null;
    return s;
  }

  // ---------- 各 action ----------
  function startNextHand(s) {
    const cfg = s.config;
    s.players.forEach((p) => {
      p.bet = 0; p.totalBet = 0; p.folded = false; p.allIn = false; p.hasActed = false; p.lastAction = ''; p.hole = []; p.winThisHand = 0;
      p.sittingOut = p.stack <= 0; // 没筹码者坐出（现金桌补码由外部控制器决定）
    });
    const seated = s.players.filter((p) => !p.sittingOut);
    if (seated.length < 2) { s.street = 'idle'; s.current = -1; s.awaitingDeal = null; s.handOver = true; return s; }
    // 轮转庄位
    s.button = TableState.nextActive(s, s.button < 0 ? s.players.length - 1 : s.button);
    s.deck = Deck.shuffled(s.rng);
    s.board = []; s.result = null; s.handOver = false; s.handNo += 1;
    s.currentBet = 0; s.lastRaiseSize = cfg.bigBlind; s.minRaise = cfg.bigBlind;
    // 盲注座位
    const after = orderFrom(s, s.button, (p) => !p.sittingOut);
    let sbSeat, bbSeat;
    if (seated.length === 2) { sbSeat = s.button; bbSeat = after[0]; } else { sbSeat = after[0]; bbSeat = after[1]; }
    s.sbIndex = sbSeat; s.bbIndex = bbSeat;
    s.street = 'preflop';
    Hist.handStart(s);
    // 前注
    if (cfg.ante > 0) s.players.forEach((p) => { if (!p.sittingOut) commit(p, cfg.ante); });
    // 盲注（前注已在 bet 里，盲注叠加；blinds 应是本街下注，不计前注。简化：前注进 totalBet 不进 bet）
    // 修正：前注是死钱，不计入本街 bet。重置各人 bet=0，仅 totalBet 含前注
    s.players.forEach((p) => { p.bet = 0; });
    commit(s.players[sbSeat], cfg.smallBlind);
    s.players[sbSeat].lastAction = '小盲';
    commit(s.players[bbSeat], cfg.bigBlind);
    s.players[bbSeat].lastAction = '大盲';
    s.currentBet = cfg.bigBlind;
    s.current = -1; // 等 DEAL_HOLE_CARDS 开始下注
    s.awaitingDeal = 'DEAL_HOLE_CARDS';
    return s;
  }

  function dealHole(s) {
    if (s.street !== 'preflop') return s;
    const seated = s.players.filter((p) => !p.sittingOut);
    for (let r = 0; r < 2; r++) for (const p of seated) p.hole.push(s.deck.pop());
    Hist.deal(s, 'hole');
    // 翻前从大盲下家开始
    openBetting(s, s.bbIndex);
    computeAwaiting(s);
    return s;
  }
  function dealStreet(s, count, name) {
    // 进入新街：重置本街下注
    s.players.forEach((p) => { p.bet = 0; if (!p.folded && !p.allIn) p.hasActed = false; });
    s.currentBet = 0; s.lastRaiseSize = s.config.bigBlind; s.minRaise = s.config.bigBlind;
    for (let i = 0; i < count; i++) s.board.push(s.deck.pop());
    s.street = name;
    Hist.deal(s, name);
    openBetting(s, s.button); // 翻后从庄位下家开始
    computeAwaiting(s);
    return s;
  }

  function playerAction(s, action) {
    const seat = s.current;
    if (seat < 0) return s;
    const p = s.players[seat];
    if (!p || p.id !== action.playerId) return s;           // 不是该玩家的回合
    if (!Legal.isLegal(s, action.action, action.amount)) return s; // 非法动作：无操作
    const act = action.action;
    if (act === 'fold') { p.folded = true; p.lastAction = '弃牌'; }
    else if (act === 'check') { p.lastAction = '过牌'; }
    else if (act === 'call') { commit(p, s.currentBet - p.bet); p.lastAction = p.allIn ? '全下' : '跟注'; }
    else if (act === 'bet' || act === 'raise') {
      const before = s.currentBet;
      commit(p, (action.amount | 0) - p.bet);
      if (p.bet > before) raiseTo(s, seat, p.bet - before); // 受 isLegal 约束，恒为合法整额加注
      p.lastAction = p.allIn ? '全下' : (act === 'bet' ? '下注' : '加注');
    } else if (act === 'allin') {
      const before = s.currentBet;
      commit(p, p.stack); // 全下
      if (p.bet > before) raiseTo(s, seat, p.bet - before);
      p.lastAction = '全下';
    }
    p.hasActed = true;
    Hist.action(s, seat, act, p.bet);
    // 推进
    if (liveSeats(s).length <= 1) return resolve(s, false);
    if (roundClosed(s)) { s.current = -1; computeAwaiting(s); }
    else { s.current = nextToAct(s, seat); computeAwaiting(s); }
    return s;
  }
  // 处理一次提高 currentBet 的下注：inc=本次提高的增量
  // 整额加注(inc>=lastRaiseSize)：重新打开行动，所有人可再加注；
  // 短码全下(inc<lastRaiseSize)：仅未行动者可再加注，已行动者只能跟/弃(cappedToCall)。
  function raiseTo(s, raiserSeat, inc) {
    const fullRaise = inc >= s.lastRaiseSize;
    if (fullRaise) s.lastRaiseSize = inc;
    s.currentBet = s.players[raiserSeat].bet;
    s.players.forEach((p, i) => {
      if (i === raiserSeat || p.folded || p.allIn) return;
      if (fullRaise) { p.hasActed = false; p.cappedToCall = false; }
      else { if (p.hasActed) p.cappedToCall = true; else p.hasActed = false; } // 已行动者被限定为只能跟注
    });
  }

  function showdown(s) {
    // 全下自动跑牌：补满公共牌再评定
    if (liveSeats(s).length > 1) {
      while (s.board.length < 5) s.board.push(s.deck.pop());
    } else if (s.board.length < 5 && liveSeats(s).length === 1) { /* 全弃无需补牌 */ }
    return resolve(s, true);
  }

  // ---------- 入口 ----------
  function reducer(state, action) {
    const s = clone(state);
    switch (action.type) {
      case 'START_NEXT_HAND': return startNextHand(s);
      case 'DEAL_HOLE_CARDS': return dealHole(s);
      case 'DEAL_FLOP': return s.board.length === 0 ? dealStreet(s, 3, 'flop') : s;
      case 'DEAL_TURN': return s.board.length === 3 ? dealStreet(s, 1, 'turn') : s;
      case 'DEAL_RIVER': return s.board.length === 4 ? dealStreet(s, 1, 'river') : s;
      case 'PLAYER_ACTION': return playerAction(s, action);
      case 'SHOWDOWN': return showdown(s);
      default: return state;
    }
  }

  // 应用一次待发牌步骤（由 awaitingDeal 指示）。仅在无玩家需行动(current<0)时推进，绝不替玩家行动。
  function step(state) {
    if (!state.awaitingDeal || state.handOver) return state;
    if (state.current >= 0) return state; // 仍需玩家行动，不推进
    return reducer(state, { type: state.awaitingDeal });
  }
  // 全下/无人可行动时把后续街面与摊牌一次跑完（纯核心，不依赖 UI 定时器）。
  // 返回 handOver 的终局状态；遇到需玩家行动则停下原样返回。
  function runOut(state) {
    let s = state, guard = 0;
    while (s.awaitingDeal && s.current < 0 && !s.handOver && guard++ < 32) {
      const next = step(s);
      if (next === s) break; // 无推进，避免死循环
      s = next;
    }
    return s;
  }
  return { reducer, step, runOut };
});
