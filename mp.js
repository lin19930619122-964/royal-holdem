/* 真人对战 —— 权威服务器端的牌桌。复用 src/game.js 引擎。
   单桌 6 座，座位可为：真人(connected)/机器人/空。持续现金局，每手自动补码。 */
global.window = global.window || global;
require('./src/poker.js');
require('./src/ai.js');
require('./src/game.js');
const P = window.Poker, AI = window.PokerAI, Game = window.Game;

const SB = 50, BB = 100, STACK = 10000;
const TURN_MS = 20000;       // 人类回合限时
const NEXT_HAND_MS = 4500;   // 摊牌后到下一手
const STREET_MS = 900;       // 发下一街间隔
const BOT_MIN = 600, BOT_MAX = 1500;
const BOT_NAMES = ['老李', '阿强', '小敏', '财神', '黑桃J'];
const AVATARS = ['🧑', '🤠', '👩', '🧓', '🕵️', '😎', '👨', '🧔'];

class Table {
  constructor(broadcast) {
    this.broadcast = broadcast;
    this.game = new Game({ smallBlind: SB, bigBlind: BB, startChips: STACK, bots: 5 });
    // 初始所有座位置空
    this.seatMeta = this.game.players.map((p, i) => ({
      seat: i, kind: 'empty', name: '', avatar: AVATARS[i], connId: null,
      token: null, connected: false, sittingOut: false,
    }));
    for (const p of this.game.players) { p.out = true; p.chips = 0; }
    this.timer = null;
    this.deadline = null;
    this.running = false; // 是否在一手进行中
  }

  // ---- 座位管理 ----
  firstEmpty() { return this.seatMeta.findIndex((s) => s.kind === 'empty'); }
  activeSeats() { return this.seatMeta.filter((s) => s.kind !== 'empty'); }
  humanSeats() { return this.seatMeta.filter((s) => s.kind === 'human'); }
  hostSeat() {
    const h = this.seatMeta.filter((s) => s.kind === 'human' && s.connected).sort((a, b) => a.seat - b.seat)[0];
    return h ? h.seat : -1;
  }
  seatByConn(connId) { return this.seatMeta.find((s) => s.connId === connId); }
  seatByToken(token) { return this.seatMeta.find((s) => s.token === token && s.kind === 'human'); }

  sit(connId, name, token) {
    // 重连
    if (token) {
      const ex = this.seatByToken(token);
      if (ex) { ex.connId = connId; ex.connected = true; ex.sittingOut = false; this.emit(); return ex; }
    }
    const idx = this.firstEmpty();
    if (idx < 0) return null; // 满
    const meta = this.seatMeta[idx];
    meta.kind = 'human'; meta.name = (name || '玩家').slice(0, 8);
    meta.connId = connId; meta.connected = true; meta.sittingOut = false;
    meta.token = 'T' + Math.floor((Date.now() % 1e9)) + idx + Math.floor(performance.now ? performance.now() % 1000 : idx);
    const p = this.game.players[idx];
    p.name = meta.name; p.avatar = meta.avatar; p.isHuman = true; p.ai = null;
    if (!this.running) { p.out = true; p.chips = 0; } // 等下一手补码上桌
    this.emit();
    return meta;
  }

  addBot() {
    const idx = this.firstEmpty();
    if (idx < 0) return false;
    const meta = this.seatMeta[idx];
    meta.kind = 'bot'; meta.name = BOT_NAMES[idx % BOT_NAMES.length]; meta.connected = true;
    const p = this.game.players[idx];
    p.name = meta.name; p.avatar = meta.avatar; p.isHuman = false; p.ai = AI.makePersona();
    if (!this.running) { p.out = true; p.chips = 0; }
    this.emit();
    return true;
  }

  removeSeat(seat) {
    const meta = this.seatMeta[seat];
    meta.kind = 'empty'; meta.connId = null; meta.token = null; meta.connected = false; meta.name = '';
    const p = this.game.players[seat];
    p.out = true; p.chips = 0; p.isHuman = false; p.folded = true;
    this.emit();
  }

  disconnect(connId) {
    const meta = this.seatByConn(connId);
    if (!meta) return;
    meta.connected = false;
    if (!this.running) { this.removeSeat(meta.seat); }
    else { this.emit(); this.drive(); } // 进行中：保留座位，轮到则自动行动
  }

  // ---- 开局/循环 ----
  readyCount() { return this.activeSeats().length; }

  startHand(bySeat) {
    if (this.running) return;
    if (this.readyCount() < 2) return;
    // 补码上桌
    for (const meta of this.seatMeta) {
      const p = this.game.players[meta.seat];
      if (meta.kind === 'empty') { p.out = true; p.chips = 0; continue; }
      if (p.chips < BB * 5) p.chips = STACK; // 免费补码
      p.out = false;
    }
    this.running = true;
    this.game.startHand();
    this.emit();
    this.drive();
  }

  clearTimer() { if (this.timer) { clearTimeout(this.timer); this.timer = null; } this.deadline = null; }

  drive() {
    this.clearTimer();
    const g = this.game;

    if (g.phase === 'ended' || g.phase === 'gameover') {
      this.running = false;
      this.emit();
      // 断线的真人座位清理
      for (const m of this.seatMeta) if (m.kind === 'human' && !m.connected) this.removeSeat(m.seat);
      this.timer = setTimeout(() => {
        if (this.readyCount() >= 2) this.startHand();
        else { this.emit(); }
      }, NEXT_HAND_MS);
      return;
    }
    if (!g.bettingOpen) {
      this.emit();
      this.timer = setTimeout(() => { g.proceed(); this.drive(); }, STREET_MS);
      return;
    }
    // 下注进行中
    const seat = g.current;
    const meta = this.seatMeta[seat];
    const p = g.players[seat];
    this.emit();
    if (meta.kind === 'bot') {
      this.timer = setTimeout(() => {
        const d = AI.decide(p, g.aiContext());
        g.act(d.action, d.amount);
        this.drive();
      }, BOT_MIN + Math.random() * (BOT_MAX - BOT_MIN));
    } else if (meta.kind === 'human' && !meta.connected) {
      // 断线托管：能过牌就过，否则弃牌
      this.timer = setTimeout(() => { this.autoAct(seat); }, 800);
    } else {
      // 等待真人；超时自动
      this.deadline = Date.now() + TURN_MS;
      this.emit();
      this.timer = setTimeout(() => { this.autoAct(seat); }, TURN_MS);
    }
  }

  autoAct(seat) {
    const g = this.game;
    if (g.current !== seat || !g.bettingOpen) return;
    const o = g.actionOptions();
    if (o.canCheck) g.act('check'); else g.act('fold');
    this.drive();
  }

  playerAction(connId, action, amount) {
    const meta = this.seatByConn(connId);
    if (!meta) return;
    const g = this.game;
    if (!g.bettingOpen || g.current !== meta.seat) return; // 不是你的回合
    this.clearTimer();
    g.act(action, amount);
    this.drive();
  }

  // ---- 状态序列化（按座位脱敏手牌）----
  buildState(forSeat) {
    const g = this.game;
    const result = g.result;
    const reveal = (result && result.reveal) || [];
    const seats = this.seatMeta.map((m) => {
      const p = g.players[m.seat];
      const showHole = (m.seat === forSeat) || reveal.includes(m.seat);
      return {
        seat: m.seat, kind: m.kind, name: m.kind === 'empty' ? '' : (p.name || m.name),
        avatar: m.avatar, connected: m.connected,
        chips: p.chips, bet: p.bet, folded: p.folded, allIn: p.allIn, out: p.out,
        lastAction: p.lastAction, winThisHand: p.winThisHand || 0,
        holeCount: p.hole ? p.hole.length : 0,
        hole: showHole && p.hole && p.hole.length ? p.hole : null,
      };
    });
    let options = null, yourTurn = false;
    if (g.bettingOpen && g.current === forSeat && this.seatMeta[forSeat] && this.seatMeta[forSeat].kind === 'human') {
      options = g.actionOptions();
      yourTurn = true;
    }
    return {
      type: 'state',
      seats, board: g.board, pot: g.pot, phase: g.phase,
      bettingOpen: g.bettingOpen, current: g.current, button: g.button,
      handNo: g.handNo, smallBlind: g.smallBlind, bigBlind: g.bigBlind,
      result: result ? { showdown: result.showdown, reveal, summary: result.summary } : null,
      youSeat: forSeat, yourTurn, options,
      deadline: (yourTurn || (this.seatMeta[g.current] && !this.seatMeta[g.current].connected)) ? this.deadline : null,
      hostSeat: this.hostSeat(),
      seatedCount: this.readyCount(),
      running: this.running,
    };
  }

  emit() { this.broadcast(); }
}

module.exports = { Table, STACK, SB, BB };
