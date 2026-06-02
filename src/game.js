/* 皇室德州 — 对局流程引擎：盲注、下注轮、边池、摊牌 */
(function () {
  const P = window.Poker;
  const AI = window.PokerAI;

  class Game {
    constructor(opts = {}) {
      this.smallBlind = opts.smallBlind || 50;
      this.bigBlind = opts.bigBlind || 100;
      const startChips = opts.startChips || 10000;
      const botNames = ['老李', '阿强', '小敏', '财神', '黑桃J'];
      const avatars = ['🧑', '🤠', '👩', '🧓', '🕵️'];

      this.players = [];
      this.players.push({
        id: 0, name: '你', isHuman: true, avatar: '😎', seat: 0,
        chips: startChips, ai: null,
      });
      const nBots = opts.bots != null ? opts.bots : 5;
      for (let i = 0; i < nBots; i++) {
        this.players.push({
          id: i + 1, name: botNames[i % botNames.length], isHuman: false,
          avatar: avatars[i % avatars.length], seat: i + 1,
          chips: startChips, ai: AI.makePersona(),
        });
      }
      for (const p of this.players) {
        p.hole = []; p.bet = 0; p.totalContribution = 0;
        p.folded = false; p.allIn = false; p.hasActed = false;
        p.out = false; p.lastAction = ''; p.winThisHand = 0;
      }

      this.button = -1;
      this.handNo = 0;
      this.board = [];
      this.deck = [];
      this.phase = 'idle';
      this.bettingOpen = false;
      this.current = null;
      this.currentBet = 0;
      this.minRaise = this.bigBlind;
      this.result = null;
    }

    get N() { return this.players.length; }

    get pot() {
      return this.players.reduce((s, p) => s + p.totalContribution, 0);
    }

    inGameCount() {
      return this.players.filter((p) => p.chips > 0 || p.allIn).length;
    }

    nextNotOut(i) {
      const N = this.N;
      for (let k = 1; k <= N; k++) {
        const idx = (i + k) % N;
        if (!this.players[idx].out) return idx;
      }
      return i;
    }

    *seatOrder(start) {
      const N = this.N;
      for (let k = 0; k < N; k++) {
        const idx = (start + k) % N;
        if (!this.players[idx].out) yield idx;
      }
    }

    needsToAct(p) {
      return !p.folded && !p.allIn && !p.out &&
        (!p.hasActed || p.bet < this.currentBet);
    }

    aliveCount() {
      return this.players.filter((p) => !p.folded && !p.out).length;
    }

    canActCount() {
      return this.players.filter((p) => !p.folded && !p.allIn && !p.out && p.chips > 0).length;
    }

    /* ---------- 开始新一手 ---------- */
    startHand() {
      // 淘汰没筹码的玩家
      for (const p of this.players) {
        if (p.chips <= 0) p.out = true;
      }
      const stillIn = this.players.filter((p) => !p.out);
      if (stillIn.length < 2) {
        this.phase = 'gameover';
        this.result = { gameOver: true, winner: stillIn[0] || null };
        return;
      }

      this.handNo++;
      this.deck = P.shuffle(P.createDeck());
      this.board = [];
      this.result = null;
      this.currentBet = 0;
      this.minRaise = this.bigBlind;

      for (const p of this.players) {
        p.hole = []; p.bet = 0; p.totalContribution = 0; p.hasActed = false;
        p.lastAction = ''; p.winThisHand = 0;
        p.folded = p.out;
        p.allIn = false;
      }

      this.button = this.nextNotOut(this.button);

      const heads = stillIn.length === 2;
      let sbIdx, bbIdx, firstPre;
      if (heads) {
        sbIdx = this.button;
        bbIdx = this.nextNotOut(this.button);
        firstPre = this.button;
      } else {
        sbIdx = this.nextNotOut(this.button);
        bbIdx = this.nextNotOut(sbIdx);
        firstPre = this.nextNotOut(bbIdx);
      }
      this.sbIdx = sbIdx;
      this.bbIdx = bbIdx;

      this.commit(this.players[sbIdx], this.smallBlind);
      this.players[sbIdx].lastAction = '小盲';
      this.commit(this.players[bbIdx], this.bigBlind);
      this.players[bbIdx].lastAction = '大盲';
      this.currentBet = this.bigBlind;

      // 发底牌
      for (let r = 0; r < 2; r++) {
        for (const idx of this.seatOrder(this.nextNotOut(this.button))) {
          this.players[idx].hole.push(this.deck.pop());
        }
      }

      this.phase = 'preflop';
      this.bettingOpen = true;
      this.current = this.firstToAct(firstPre);
      if (this.current === null) {
        // 都无需行动（极端：全员盲注即全下）
        this.bettingOpen = false;
      }
    }

    commit(player, chips) {
      const pay = Math.min(chips, player.chips);
      player.chips -= pay;
      player.bet += pay;
      player.totalContribution += pay;
      if (player.chips === 0) player.allIn = true;
      return pay;
    }

    firstToAct(start) {
      for (const idx of this.seatOrder(start)) {
        if (this.needsToAct(this.players[idx])) return idx;
      }
      return null;
    }

    nextActor(cur) {
      for (const idx of this.seatOrder((cur + 1) % this.N)) {
        if (idx === cur) continue;
        if (this.needsToAct(this.players[idx])) return idx;
      }
      // 检查当前玩家是否仍需行动（被重新加注后回到自己之前不会发生，这里兜底）
      return null;
    }

    /* ---------- 行动选项（给人类 UI） ---------- */
    actionOptions() {
      const p = this.players[this.current];
      const toCall = Math.max(0, this.currentBet - p.bet);
      const canCheck = toCall === 0;
      const callAmount = Math.min(toCall, p.chips);
      const minRaiseTo = Math.min(this.currentBet + this.minRaise, p.bet + p.chips);
      const maxRaiseTo = p.bet + p.chips;
      const canRaise = p.chips > toCall; // 还有余筹才能加注/下注
      return {
        canCheck, toCall, callAmount, canRaise,
        minRaiseTo, maxRaiseTo, chips: p.chips,
        isBet: this.currentBet === 0,
        currentBet: this.currentBet,
        bigBlind: this.bigBlind, pot: this.pot,
      };
    }

    /* ---------- 应用一个行动 ---------- */
    act(action, amountTo) {
      if (!this.bettingOpen || this.current === null) return;
      const p = this.players[this.current];
      const toCall = Math.max(0, this.currentBet - p.bet);

      if (action === 'fold') {
        p.folded = true;
        p.lastAction = '弃牌';
        p.hasActed = true;
      } else if (action === 'check') {
        if (toCall > 0) { // 非法，按跟注处理
          return this.act('call');
        }
        p.lastAction = '过牌';
        p.hasActed = true;
      } else if (action === 'call') {
        const pay = this.commit(p, toCall);
        p.lastAction = p.allIn ? '全下' : '跟注';
        p.hasActed = true;
      } else if (action === 'raise') {
        let target = amountTo;
        const maxTo = p.bet + p.chips;
        const minTo = Math.min(this.currentBet + this.minRaise, maxTo);
        if (target < minTo) target = minTo;
        if (target > maxTo) target = maxTo;
        const need = target - p.bet;
        this.commit(p, need);
        const newBet = p.bet;
        if (newBet > this.currentBet) {
          const inc = newBet - this.currentBet;
          if (inc >= this.minRaise) this.minRaise = inc;
          this.currentBet = newBet;
          // 重新开放其他人的行动
          for (const q of this.players) {
            if (q !== p && !q.folded && !q.allIn && !q.out) q.hasActed = false;
          }
        }
        p.lastAction = p.allIn ? '全下' : (this.currentBet === newBet ? (toCall === 0 ? '下注' : '加注') : '跟注');
        p.hasActed = true;
      }

      this.afterAction();
    }

    afterAction() {
      // 只剩一人 → 直接结束
      if (this.aliveCount() === 1) {
        this.endHandNoShowdown();
        return;
      }
      const nxt = this.nextActor(this.current);
      if (nxt === null) {
        // 本轮下注结束
        this.bettingOpen = false;
        this.current = null;
      } else {
        this.current = nxt;
      }
    }

    /* ---------- 推进到下一街 / 摊牌（控制器在下注结束后调用） ---------- */
    proceed() {
      if (this.bettingOpen || this.phase === 'ended' || this.phase === 'gameover') return;

      if (this.phase === 'river') {
        this.goShowdown();
        return;
      }

      // 进入下一街
      const order = { preflop: 'flop', flop: 'turn', turn: 'river' };
      const next = order[this.phase];
      // 重置本轮
      this.currentBet = 0;
      this.minRaise = this.bigBlind;
      for (const p of this.players) {
        p.bet = 0;
        if (!p.folded && !p.out) p.hasActed = false;
        if (p.lastAction !== '弃牌') p.lastAction = '';
      }

      if (next === 'flop') {
        this.deck.pop(); // 烧牌
        this.board.push(this.deck.pop(), this.deck.pop(), this.deck.pop());
      } else {
        this.deck.pop();
        this.board.push(this.deck.pop());
      }
      this.phase = next;

      if (this.canActCount() >= 2) {
        this.current = this.firstToAct(this.nextNotOut(this.button));
        this.bettingOpen = this.current !== null;
        if (!this.bettingOpen) this.current = null;
      } else {
        // 无需下注，自动 run-out（控制器会继续调用 proceed）
        this.bettingOpen = false;
        this.current = null;
      }
    }

    endHandNoShowdown() {
      const winner = this.players.find((p) => !p.folded && !p.out);
      const total = this.pot;
      winner.chips += total;
      winner.winThisHand = total;
      this.phase = 'ended';
      this.bettingOpen = false;
      this.current = null;
      this.result = {
        showdown: false,
        reveal: [],
        pots: [{ amount: total, winners: [winner.id], handName: '' }],
        summary: `${winner.name} 赢得底池 ${total}（其余玩家弃牌）`,
      };
    }

    buildPots() {
      const contribs = this.players
        .filter((p) => p.totalContribution > 0)
        .map((p) => ({ id: p.id, amt: p.totalContribution, inHand: !p.folded && !p.out }));
      const pots = [];
      while (true) {
        const live = contribs.filter((c) => c.amt > 0);
        if (live.length === 0) break;
        const min = Math.min(...live.map((c) => c.amt));
        let amount = 0;
        const eligible = [];
        for (const c of contribs) {
          if (c.amt > 0) {
            amount += min;
            c.amt -= min;
            if (c.inHand) eligible.push(c.id);
          }
        }
        pots.push({ amount, eligible });
      }
      // 合并相邻、参与者集合相同的池
      const merged = [];
      for (const pot of pots) {
        const last = merged[merged.length - 1];
        if (last && JSON.stringify(last.eligible) === JSON.stringify(pot.eligible)) {
          last.amount += pot.amount;
        } else {
          merged.push(pot);
        }
      }
      return merged;
    }

    goShowdown() {
      // 评估每位未弃牌玩家
      const scores = {};
      const names = {};
      for (const p of this.players) {
        if (!p.folded && !p.out) {
          const r = P.evaluateBest(p.hole.concat(this.board));
          scores[p.id] = r.score;
          names[p.id] = P.handName(r.score);
        }
      }
      const pots = this.buildPots();
      const resultPots = [];
      for (const pot of pots) {
        const contenders = pot.eligible.filter((id) => scores[id]);
        if (contenders.length === 0) continue;
        let best = null;
        for (const id of contenders) {
          if (best === null || P.compareScores(scores[id], scores[best]) > 0) best = id;
        }
        const winners = contenders.filter((id) => P.compareScores(scores[id], scores[best]) === 0);
        const share = Math.floor(pot.amount / winners.length);
        let remainder = pot.amount - share * winners.length;
        for (const id of winners) {
          const pl = this.players.find((p) => p.id === id);
          let amt = share;
          if (remainder > 0) { amt += 1; remainder--; }
          pl.chips += amt;
          pl.winThisHand += amt;
        }
        resultPots.push({
          amount: pot.amount,
          winners,
          handName: names[winners[0]] || '',
        });
      }

      const reveal = this.players.filter((p) => !p.folded && !p.out).map((p) => p.id);
      const topWinner = this.players
        .filter((p) => p.winThisHand > 0)
        .sort((a, b) => b.winThisHand - a.winThisHand)[0];
      this.phase = 'ended';
      this.bettingOpen = false;
      this.current = null;
      this.result = {
        showdown: true,
        reveal,
        pots: resultPots,
        handScores: scores,
        handNames: names,
        summary: topWinner
          ? `${topWinner.name} 凭【${names[topWinner.id] || ''}】赢得 ${topWinner.winThisHand}`
          : '本手结束',
      };
    }

    aiContext() {
      return {
        board: this.board,
        pot: this.pot,
        currentBet: this.currentBet,
        minRaise: this.minRaise,
        bigBlind: this.bigBlind,
        players: this.players,
        button: this.button,
        street: this.phase, // preflop/flop/turn/river
      };
    }
  }

  window.Game = Game;
})();
