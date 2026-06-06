/* ActionController —— 玩家行动唯一 emit 源：PLAYER_THINKING / FOLD / CHECK / CALL / BET / RAISE / ALL_IN。 */
(function (root, factory) {
  const m = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = m;
  if (typeof window !== 'undefined') (window.RHCore = window.RHCore || {}).ActionController = m;
})(this, function () {
  const CN2EVENT = { '弃牌': 'PLAYER_FOLD', '过牌': 'PLAYER_CHECK', '跟注': 'PLAYER_CALL', '加注': 'PLAYER_RAISE', '下注': 'PLAYER_BET', '全下': 'PLAYER_ALL_IN' };
  function create(gf) {
    const fire = (ev, pl) => { if (gf && gf.emit) gf.emit(ev, pl || {}); };
    return {
      thinking(seat) { fire('PLAYER_THINKING', { seat }); },
      // 据玩家 lastAction(中文) 派发对应行动事件；返回是否已派发
      acted(seat, lastActionCn) { const ev = CN2EVENT[lastActionCn]; if (ev) { fire(ev, { seat }); return true; } return false; },
      fold(seat) { fire('PLAYER_FOLD', { seat }); },
      check(seat) { fire('PLAYER_CHECK', { seat }); },
      call(seat) { fire('PLAYER_CALL', { seat }); },
      bet(seat) { fire('PLAYER_BET', { seat }); },
      raise(seat) { fire('PLAYER_RAISE', { seat }); },
      allIn(seat) { fire('PLAYER_ALL_IN', { seat }); },
    };
  }
  return { create };
});
