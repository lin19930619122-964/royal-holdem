/* GameFeelDirector —— 牌局事件的统一编排：所有事件经 emit() 进来，由它驱动 音频 + 视觉 + 节奏，
   并按 JuiceLevel 分级(subtle/normal/strong/epic)。视觉执行器由 UI 注册(onVisual)，
   音频走 AudioManager。这样「事件→反馈→奖励」是一个闭环，而非散落在各处。无 DOM 依赖。 */
(function (root, factory) {
  const req = (typeof require !== 'undefined');
  const EventBus = req ? require('./EventBus.js') : window.RHCore.EventBus;
  const m = factory(EventBus);
  if (typeof module !== 'undefined' && module.exports) module.exports = m;
  if (typeof window !== 'undefined') (window.RHCore = window.RHCore || {}).GameFeelDirector = m;
})(this, function (EventBus) {
  const EVENTS = [
    'APP_LAUNCH', 'ENTER_HALL', 'ENTER_TABLE', 'HAND_START', 'POST_BLINDS', 'DEAL_HOLE_CARD',
    'HERO_PREMIUM_HAND', 'PLAYER_THINKING', 'PLAYER_FOLD', 'PLAYER_CHECK', 'PLAYER_CALL',
    'PLAYER_BET', 'PLAYER_RAISE', 'PLAYER_ALL_IN', 'DEAL_FLOP', 'DEAL_TURN', 'DEAL_RIVER',
    'SHOWDOWN_START', 'REVEAL_HAND', 'BEST_HAND_HIGHLIGHT', 'POT_TO_WINNER',
    'HERO_WIN_SMALL', 'HERO_WIN_BIG', 'HERO_BAD_BEAT', 'HERO_GOOD_FOLD',
    'ACHIEVEMENT_UNLOCKED', 'MASTER_LEVEL_PROGRESS', 'SESSION_SUMMARY', 'HERO_LOSE', 'GIFT', 'UI_CLICK',
  ];
  const JUICE = {
    UI_CLICK: 'subtle', PLAYER_CHECK: 'subtle', PLAYER_FOLD: 'subtle', HAND_START: 'subtle', POST_BLINDS: 'subtle', PLAYER_THINKING: 'subtle',
    DEAL_HOLE_CARD: 'normal', DEAL_FLOP: 'normal', DEAL_TURN: 'normal', DEAL_RIVER: 'normal', PLAYER_CALL: 'normal', PLAYER_BET: 'normal', PLAYER_RAISE: 'normal', HERO_WIN_SMALL: 'normal', HERO_GOOD_FOLD: 'normal', REVEAL_HAND: 'normal', POT_TO_WINNER: 'normal',
    PLAYER_ALL_IN: 'strong', HERO_WIN_BIG: 'strong', BEST_HAND_HIGHLIGHT: 'strong', SHOWDOWN_START: 'strong', HERO_PREMIUM_HAND: 'strong',
    HERO_BAD_BEAT: 'epic', ACHIEVEMENT_UNLOCKED: 'epic', MASTER_LEVEL_PROGRESS: 'epic',
  };

  // deps: { audio: AudioManager 实例 }
  function create(deps) {
    deps = deps || {};
    const bus = EventBus.create();
    const audio = deps.audio || null;
    const visuals = [];

    function juiceOf(event) { return JUICE[event] || 'normal'; }
    // UI 注册视觉执行器：fn(event, payload, level)
    function onVisual(fn) { visuals.push(fn); return () => { const i = visuals.indexOf(fn); if (i >= 0) visuals.splice(i, 1); }; }

    function emit(event, payload) {
      payload = payload || {};
      const level = juiceOf(event);
      const pl = Object.assign({ level: level }, payload);
      if (audio) { try { audio.play(event, pl); } catch (e) {} }             // 1) 音频
      for (const fn of [...visuals]) { try { fn(event, pl, level); } catch (e) {} } // 2) 视觉/节奏
      bus.emit(event, pl);                                                   // 3) 总线(其他订阅者)
      return level;
    }
    function quickWord(playerId, audioKey) { return audio ? audio.quickWord(playerId, audioKey) : true; }

    return { EVENTS, emit, onVisual, juiceOf, quickWord, bus, audio };
  }
  return { create, EVENTS, JUICE };
});
