/* 真人对战服务端 —— 多房间 Hub + 权威牌桌 + 旁观 / 聊天 / 表情 / 礼物 / 举报。
   复用 src/game.js 引擎。每个房间一张 6 座现金桌，持续局、自动补码（训练筹码）。
   纯逻辑，不依赖 ws；由 server.js 负责实际收发（通过注入的 io）。 */
global.window = global.window || global;
require('./src/poker.js');
require('./src/ai.js');
require('./src/game.js');
const P = window.Poker, AI = window.PokerAI, Game = window.Game;

const TURN_MS = 20000, NEXT_HAND_MS = 4500, STREET_MS = 900;
const BOT_MIN = 600, BOT_MAX = 1500;
const BOT_NAMES = ['老李', '阿强', '小敏', '财神', '黑桃J'];
const AVATARS = ['🧑', '🤠', '👩', '🧓', '🕵️', '😎', '👨', '🧔'];
const CHAT_KEEP = 12, REPORT_KEEP = 200;

const ROOM_DEFS = [
  { id: 'r1', name: '训练房·微注', sb: 25, bb: 50, stack: 5000 },
  { id: 'r2', name: '训练房·标准', sb: 50, bb: 100, stack: 10000 },
  { id: 'r3', name: '训练房·高额', sb: 200, bb: 400, stack: 40000 },
];

class Table {
  constructor(def, io) {
    this.id = def.id; this.name = def.name;
    this.SB = def.sb; this.BB = def.bb; this.STACK = def.stack;
    this.io = io; // { sendState(table), relay(table, obj) }
    this.game = new Game({ smallBlind: this.SB, bigBlind: this.BB, startChips: this.STACK, bots: 5 });
    this.seatMeta = this.game.players.map((p, i) => ({
      seat: i, kind: 'empty', name: '', avatar: AVATARS[i], connId: null, token: null, connected: false,
    }));
    for (const p of this.game.players) { p.out = true; p.chips = 0; }
    this.spectators = new Set();  // connId
    this.members = new Set();     // connId（座上真人 + 旁观），用于广播范围
    this.chatLog = [];
    this.reports = [];
    this.timer = null; this.deadline = null; this.running = false;
  }

  // ---- 成员 / 座位 ----
  firstEmpty() { return this.seatMeta.findIndex((s) => s.kind === 'empty'); }
  activeSeats() { return this.seatMeta.filter((s) => s.kind !== 'empty'); }
  seatByConn(connId) { return this.seatMeta.find((s) => s.connId === connId); }
  seatByToken(token) { return this.seatMeta.find((s) => s.token === token && s.kind === 'human'); }
  hostSeat() {
    const h = this.seatMeta.filter((s) => s.kind === 'human' && s.connected).sort((a, b) => a.seat - b.seat)[0];
    return h ? h.seat : -1;
  }
  readyCount() { return this.activeSeats().length; }
  humanCount() { return this.seatMeta.filter((s) => s.kind === 'human').length; }

  sit(connId, name, token) {
    this.members.add(connId);
    if (token) { const ex = this.seatByToken(token); if (ex) { ex.connId = connId; ex.connected = true; this.spectators.delete(connId); this.emit(); return ex; } }
    const idx = this.firstEmpty();
    if (idx < 0) { this.spectators.add(connId); this.emit(); return null; } // 满 → 转旁观
    const meta = this.seatMeta[idx];
    meta.kind = 'human'; meta.name = (name || '玩家').slice(0, 8); meta.connId = connId; meta.connected = true;
    meta.token = 'T' + (Date.now() % 1e9) + '_' + idx;
    const p = this.game.players[idx];
    p.name = meta.name; p.avatar = meta.avatar; p.isHuman = true; p.ai = null;
    if (!this.running) { p.out = true; p.chips = 0; }
    this.spectators.delete(connId);
    this.emit();
    return meta;
  }
  spectate(connId) { this.members.add(connId); this.spectators.add(connId); this.emit(); }

  addBot() {
    const idx = this.firstEmpty(); if (idx < 0) return false;
    const meta = this.seatMeta[idx];
    meta.kind = 'bot'; meta.name = BOT_NAMES[idx % BOT_NAMES.length]; meta.connected = true;
    const p = this.game.players[idx];
    p.name = meta.name; p.avatar = meta.avatar; p.isHuman = false; p.ai = AI.makePersona();
    if (!this.running) { p.out = true; p.chips = 0; }
    this.emit(); return true;
  }

  removeSeat(seat) {
    const meta = this.seatMeta[seat];
    meta.kind = 'empty'; meta.connId = null; meta.token = null; meta.connected = false; meta.name = '';
    const p = this.game.players[seat];
    p.out = true; p.chips = 0; p.isHuman = false; p.folded = true;
    this.emit();
  }
  removeMember(connId) {
    this.members.delete(connId); this.spectators.delete(connId);
    const m = this.seatByConn(connId);
    if (m) { if (!this.running) this.removeSeat(m.seat); else { m.connected = false; this.emit(); this.drive(); } }
    else this.emit();
  }
  disconnect(connId) {
    const m = this.seatByConn(connId);
    this.members.delete(connId); this.spectators.delete(connId);
    if (!m) { this.emit(); return; }
    m.connected = false;
    if (!this.running) this.removeSeat(m.seat);
    else { this.emit(); this.drive(); }
  }

  // ---- 社交 ----
  nameOf(connId) { const m = this.seatByConn(connId); return m ? (this.game.players[m.seat].name || m.name) : '旁观者'; }
  seatOf(connId) { const m = this.seatByConn(connId); return m ? m.seat : -1; }
  chat(connId, text) {
    text = String(text || '').slice(0, 80).trim(); if (!text) return;
    const ev = { type: 'chat', seat: this.seatOf(connId), name: this.nameOf(connId), text, ts: Date.now() };
    this.chatLog.push(ev); if (this.chatLog.length > CHAT_KEEP) this.chatLog.shift();
    this.relay(ev);
  }
  emote(connId, emoji) {
    emoji = String(emoji || '').slice(0, 4);
    this.relay({ type: 'emote', seat: this.seatOf(connId), emoji });
  }
  gift(connId, toSeat, gift) {
    this.relay({ type: 'gift', fromSeat: this.seatOf(connId), toSeat: toSeat | 0, gift: String(gift || '🌹').slice(0, 4) });
  }
  report(connId, seat, reason) {
    const rec = { bySeat: this.seatOf(connId), seat: seat | 0, reason: String(reason || '').slice(0, 60), ts: Date.now() };
    this.reports.push(rec); if (this.reports.length > REPORT_KEEP) this.reports.shift();
    this.relay({ type: 'sys', text: `已收到对座位 ${(seat | 0) + 1} 的举报，感谢反馈（训练房仅记录）。`, to: connId });
    return rec;
  }

  // ---- 开局 / 循环 ----
  startHand() {
    if (this.running || this.readyCount() < 2) return;
    for (const meta of this.seatMeta) {
      const p = this.game.players[meta.seat];
      if (meta.kind === 'empty') { p.out = true; p.chips = 0; continue; }
      if (p.chips < this.BB * 5) p.chips = this.STACK; // 免费补码（训练筹码）
      p.out = false;
    }
    this.running = true; this.game.startHand(); this.emit(); this.drive();
  }
  clearTimer() { if (this.timer) { clearTimeout(this.timer); this.timer = null; } this.deadline = null; }
  drive() {
    this.clearTimer();
    const g = this.game;
    if (g.phase === 'ended' || g.phase === 'gameover') {
      this.running = false; this.emit();
      for (const m of this.seatMeta) if (m.kind === 'human' && !m.connected) this.removeSeat(m.seat);
      this.timer = setTimeout(() => { if (this.readyCount() >= 2) this.startHand(); else this.emit(); }, NEXT_HAND_MS);
      return;
    }
    if (!g.bettingOpen) { this.emit(); this.timer = setTimeout(() => { g.proceed(); this.drive(); }, STREET_MS); return; }
    const seat = g.current, meta = this.seatMeta[seat], p = g.players[seat];
    this.emit();
    if (meta.kind === 'bot') {
      this.timer = setTimeout(() => { const d = AI.decide(p, g.aiContext()); g.act(d.action, d.amount); this.drive(); }, BOT_MIN + Math.random() * (BOT_MAX - BOT_MIN));
    } else if (meta.kind === 'human' && !meta.connected) {
      this.timer = setTimeout(() => this.autoAct(seat), 800);
    } else { this.deadline = Date.now() + TURN_MS; this.emit(); this.timer = setTimeout(() => this.autoAct(seat), TURN_MS); }
  }
  autoAct(seat) { const g = this.game; if (g.current !== seat || !g.bettingOpen) return; const o = g.actionOptions(); if (o.canCheck) g.act('check'); else g.act('fold'); this.drive(); }
  playerAction(connId, action, amount) {
    const meta = this.seatByConn(connId); if (!meta) return;
    const g = this.game; if (!g.bettingOpen || g.current !== meta.seat) return;
    this.clearTimer(); g.act(action, amount); this.drive();
  }

  // ---- 状态 ----
  info() {
    return { id: this.id, name: this.name, blinds: `${this.SB}/${this.BB}`, seated: this.humanCount(), bots: this.seatMeta.filter((s) => s.kind === 'bot').length, spectators: this.spectators.size, running: this.running, full: this.firstEmpty() < 0 };
  }
  buildState(forSeat) {
    const g = this.game, result = g.result, reveal = (result && result.reveal) || [];
    const seats = this.seatMeta.map((m) => {
      const p = g.players[m.seat];
      const showHole = (m.seat === forSeat) || reveal.includes(m.seat);
      return { seat: m.seat, kind: m.kind, name: m.kind === 'empty' ? '' : (p.name || m.name), avatar: m.avatar, connected: m.connected,
        chips: p.chips, bet: p.bet, folded: p.folded, allIn: p.allIn, out: p.out, lastAction: p.lastAction, winThisHand: p.winThisHand || 0,
        holeCount: p.hole ? p.hole.length : 0, hole: showHole && p.hole && p.hole.length ? p.hole : null };
    });
    let options = null, yourTurn = false;
    if (g.bettingOpen && g.current === forSeat && this.seatMeta[forSeat] && this.seatMeta[forSeat].kind === 'human') { options = g.actionOptions(); yourTurn = true; }
    return { type: 'state', room: this.id, roomName: this.name, seats, board: g.board, pot: g.pot, phase: g.phase,
      bettingOpen: g.bettingOpen, current: g.current, button: g.button, handNo: g.handNo, smallBlind: g.smallBlind, bigBlind: g.bigBlind,
      result: result ? { showdown: result.showdown, reveal, summary: result.summary } : null,
      youSeat: forSeat, youSpectator: forSeat < 0, yourTurn, options,
      deadline: (yourTurn || (this.seatMeta[g.current] && !this.seatMeta[g.current].connected)) ? this.deadline : null,
      hostSeat: this.hostSeat(), seatedCount: this.readyCount(), spectators: this.spectators.size, running: this.running, chat: this.chatLog.slice(-CHAT_KEEP) };
  }
  emit() { if (this.io && this.io.sendState) this.io.sendState(this); }
  relay(obj) { if (this.io && this.io.relay) this.io.relay(this, obj); }
}

// ---- 多房间 Hub ----
class Rooms {
  constructor(io) {
    this.io = io;
    this.tables = new Map();
    this.connRoom = new Map(); // connId -> roomId
    ROOM_DEFS.forEach((def) => this.tables.set(def.id, new Table(def, io)));
  }
  lobby() { return [...this.tables.values()].map((t) => t.info()); }
  tableOf(connId) { const rid = this.connRoom.get(connId); return rid ? this.tables.get(rid) : null; }
  _leaveCurrent(connId) { const t = this.tableOf(connId); if (t) { t.removeMember(connId); this.connRoom.delete(connId); } }
  join(connId, roomId, name, token, spectate) {
    const t = this.tables.get(roomId) || this.tables.get('r2');
    if (this.tableOf(connId) && this.tableOf(connId) !== t) this._leaveCurrent(connId);
    this.connRoom.set(connId, t.id);
    if (spectate) { t.spectate(connId); return { table: t, meta: null, spectate: true }; }
    const meta = t.sit(connId, name, token);
    return { table: t, meta, spectate: !meta };
  }
  changeTable(connId, roomId, name, token) { return this.join(connId, roomId, name, token, false); }
  leave(connId) { this._leaveCurrent(connId); }
  disconnect(connId) { const t = this.tableOf(connId); if (t) t.disconnect(connId); this.connRoom.delete(connId); }
  action(connId, action, amount) { const t = this.tableOf(connId); if (t) t.playerAction(connId, action, amount); }
  start(connId) { const t = this.tableOf(connId); if (t) t.startHand(); }
  addBot(connId) { const t = this.tableOf(connId); if (t) t.addBot(); }
  chat(connId, text) { const t = this.tableOf(connId); if (t) t.chat(connId, text); }
  emote(connId, emoji) { const t = this.tableOf(connId); if (t) t.emote(connId, emoji); }
  gift(connId, toSeat, gift) { const t = this.tableOf(connId); if (t) t.gift(connId, toSeat, gift); }
  report(connId, seat, reason) { const t = this.tableOf(connId); return t ? t.report(connId, seat, reason) : null; }
}

module.exports = { Rooms, Table, ROOM_DEFS };
