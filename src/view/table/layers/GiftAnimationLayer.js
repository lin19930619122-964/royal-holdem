/* GiftAnimationLayer —— 桌内趣味反馈(个人学习版，非真钱、非商城)。原创轻量反应：筹码雨/咖啡/纸飞机/掌声/灯牌。
   giftMount 一次性动画占位 → 自动清理；有冷却；不打断主节奏。all-in / big pot / hero big win 触发系统级反馈。
   提供命令式 API：send/systemTrigger/canSend + GIFTS 列表。座位动画经 SeatView.giftMount 落地。 */
(function (root, factory) {
  const req = (typeof require !== 'undefined');
  const Base = req ? require('./_base.js') : window.RHCore.LayerBase;
  const m = factory(Base);
  if (typeof module !== 'undefined' && module.exports) module.exports = m;
  if (typeof window !== 'undefined') (window.RHCore = window.RHCore || {}).GiftAnimationLayer = m;
})(this, function (Base) {
  const GIFTS = [
    { id: 'chips_rain', name: '筹码雨', icon: '🪙', cost: 0 },
    { id: 'coffee', name: '咖啡', icon: '☕', cost: 0 },
    { id: 'paper_plane', name: '纸飞机', icon: '✈️', cost: 0 },
    { id: 'applause', name: '掌声', icon: '👏', cost: 0 },
    { id: 'light_board', name: '灯牌', icon: '🪧', cost: 0 },
  ];
  const BY = {}; GIFTS.forEach((g) => (BY[g.id] = g));
  const COOLDOWN = 4000;
  const cd = {};
  let nowFn = () => (typeof Date !== 'undefined' && Date.now ? Date.now() : 0);
  function SV() { return (typeof window !== 'undefined' && window.RHCore && window.RHCore.SeatView) || null; }
  let layerEl = null;
  function canSend(fromSeat, t) { t = t != null ? t : nowFn(); return !cd[fromSeat] || t >= cd[fromSeat]; }
  // 在 targetSeatEl 的 giftMount 播一次性动画并自动清理(SeatView.popMount 自带定时移除)
  function play(targetSeatEl, giftId, opts) {
    opts = opts || {}; const g = BY[giftId]; if (!g || !targetSeatEl) return false;
    const sv = SV(); if (sv) sv.popMount(targetSeatEl, 'gift', g.icon, opts.ms || 1800);
    if (layerEl) { const fx = (typeof document !== 'undefined') && document.createElement('div'); if (fx) { fx.className = 'gift-burst ' + g.id; fx.textContent = g.icon; layerEl.appendChild(fx); if (typeof setTimeout === 'function') setTimeout(() => { try { fx.remove(); } catch (e) {} }, opts.ms || 1500); } }
    return true;
  }
  function create() {
    const layer = Base.make('GiftAnimationLayer', { resolve: (d) => { let e = d.getElementById('gift-anim-layer'); if (!e) { e = d.createElement('div'); e.id = 'gift-anim-layer'; e.className = 'tlayer gift-anim-layer'; const p = d.getElementById('table'); if (p) p.appendChild(e); } return e; }, onMount: (el) => { layerEl = el; } });
    layer.GIFTS = GIFTS; layer.canSend = canSend;
    // 玩家送礼(带冷却)：fromSeat 冷却，动画落在 targetSeatEl
    layer.send = (fromSeat, targetSeatEl, giftId, opts) => { opts = opts || {}; const t = opts.now != null ? opts.now : nowFn(); if (!opts.force && !canSend(fromSeat, t)) return false; cd[fromSeat] = t + COOLDOWN; return play(targetSeatEl, giftId, opts); };
    // 系统级反馈(不受玩家冷却)：all-in→筹码雨；big pot→灯牌；hero big win→掌声
    layer.systemTrigger = (kind, targetSeatEl, opts) => { const map = { allin: 'chips_rain', bigpot: 'light_board', herowin: 'applause' }; const gid = map[kind]; return gid ? play(targetSeatEl, gid, opts) : false; };
    layer.reset = () => { for (const k in cd) delete cd[k]; };
    layer._setNow = (fn) => { nowFn = fn; };
    return layer;
  }
  return { create };
});
