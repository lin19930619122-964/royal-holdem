/* ChatEmojiLayer —— 桌内快捷语 / 表情。收束零散逻辑：原创快捷短语、气泡显示、每玩家 5 秒冷却、
   hero 发送→自己座位冒泡、bot 低频原创短语、emojiMount 一次性表情占位动画。语音默认关闭，仅文字气泡，不随机鬼叫。
   提供命令式 API：send/playEmoji/botSay/canSend；座位气泡经 SeatView 节点落地(不在 ui.js 散写)。 */
(function (root, factory) {
  const req = (typeof require !== 'undefined');
  const Base = req ? require('./_base.js') : window.RHCore.LayerBase;
  const m = factory(Base);
  if (typeof module !== 'undefined' && module.exports) module.exports = m;
  if (typeof window !== 'undefined') (window.RHCore = window.RHCore || {}).ChatEmojiLayer = m;
})(this, function (Base) {
  const PHRASES = ['这手有点意思', '跟你看一张', '压力给到你', '我先过牌', '这池子不小', '这牌面有点湿', '好弃牌', '摊牌吧'];
  const EMOJIS = ['👍', '😅', '😏', '🤔', '😤', '🎯', '🍀', '🔥'];
  const BOT_LINES = { raise: ['压力给到你', '这手有点意思', '加一手'], fold: ['我先撤', '不跟了', '好弃牌'], allin: ['梭了！', '全压上'], win: ['谢谢老板', '运气而已'] };
  const COOLDOWN = 5000;
  const cd = {};                                   // seat -> 下次可发时间戳
  let nowFn = () => (typeof Date !== 'undefined' && Date.now ? Date.now() : 0);
  function SV() { return (typeof window !== 'undefined' && window.RHCore && window.RHCore.SeatView) || null; }
  function canSend(seat, t) { t = t != null ? t : nowFn(); return !cd[seat] || t >= cd[seat]; }
  function stamp(seat, t) { cd[seat] = (t != null ? t : nowFn()) + COOLDOWN; }
  // 在指定座位显示气泡；isEmoji 时额外播 emojiMount 一次性动画。受冷却限制。
  function say(seatEl, seat, text, opts) {
    opts = opts || {}; const t = opts.now != null ? opts.now : nowFn();
    if (!seatEl || !text) return false;
    if (!opts.force && !canSend(seat, t)) return false;
    stamp(seat, t);
    const sv = SV(); const n = seatEl._nodes;
    if (sv && n && n.quickWordBubble) sv.showBubble(n.quickWordBubble, text);
    if (opts.isEmoji && sv) sv.popMount(seatEl, 'emoji', text);
    return true;
  }
  function create() {
    const layer = Base.make('ChatEmojiLayer', { resolve: (d) => { let e = d.getElementById('chat-emoji-layer'); if (!e) { e = d.createElement('div'); e.id = 'chat-emoji-layer'; e.className = 'tlayer chat-emoji-layer'; const p = d.getElementById('table'); if (p) p.appendChild(e); } return e; } });
    layer.PHRASES = PHRASES; layer.EMOJIS = EMOJIS;
    layer.canSend = canSend;
    layer.send = (seatEl, seat, text, opts) => say(seatEl, seat, text, opts);                 // hero/通用发送(带冷却)
    layer.playEmoji = (seatEl, seat, emoji, opts) => say(seatEl, seat, emoji, Object.assign({ isEmoji: true }, opts || {}));
    layer.botSay = (seatEl, seat, kind, opts) => { const pool = BOT_LINES[kind]; if (!pool || !pool.length) return false; const idx = (seat + (opts && opts.salt || 0)) % pool.length; return say(seatEl, seat, pool[idx], opts); };
    layer.reset = () => { for (const k in cd) delete cd[k]; };
    layer._setNow = (fn) => { nowFn = fn; };                                                    // 测试注入时钟
    return layer;
  }
  return { create };
});
