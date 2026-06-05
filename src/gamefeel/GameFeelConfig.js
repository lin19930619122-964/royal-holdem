/* GameFeelConfig —— 每个事件的爽感配置：juice 级别、时长、音效键、震动模式、开关。纯数据，无 UI。
   集中可调，避免散落魔法数字。 */
(function (root, factory) {
  const req = (typeof require !== 'undefined');
  const GFE = req ? require('./GameFeelEvent.js') : window.RHCore.GameFeelEvent;
  const m = factory(GFE);
  if (typeof module !== 'undefined' && module.exports) module.exports = m;
  if (typeof window !== 'undefined') (window.RHCore = window.RHCore || {}).GameFeelConfig = m;
})(this, function (GFE) {
  const E = GFE.EVENTS, J = GFE.JUICE;
  // sfx：AudioManager 事件名(沿用)；haptic：HapticDirector 模式名；ms：主体动画时长
  const CONFIG = {
    [E.HAND_START]: { juice: J.SUBTLE, sfx: 'HAND_START', haptic: null, ms: 200 },
    [E.POST_BLINDS]: { juice: J.SUBTLE, sfx: 'POST_BLINDS', haptic: 'tick', ms: 260 },
    [E.DEAL_HOLE_CARD]: { juice: J.NORMAL, sfx: 'DEAL_HOLE_CARD', haptic: 'tick', ms: 120 },
    [E.HERO_PREMIUM_HAND]: { juice: J.STRONG, sfx: 'ACHIEVEMENT_UNLOCKED', haptic: 'double', ms: 600 },
    [E.PLAYER_THINKING]: { juice: J.SUBTLE, sfx: null, haptic: null, ms: 0 },
    [E.PLAYER_FOLD]: { juice: J.SUBTLE, sfx: 'PLAYER_FOLD', haptic: null, ms: 240 },
    [E.PLAYER_CHECK]: { juice: J.SUBTLE, sfx: 'PLAYER_CHECK', haptic: 'tick', ms: 160 },
    [E.PLAYER_CALL]: { juice: J.NORMAL, sfx: 'PLAYER_CALL', haptic: 'tick', ms: 320 },
    [E.PLAYER_BET]: { juice: J.NORMAL, sfx: 'PLAYER_BET', haptic: 'light', ms: 360 },
    [E.PLAYER_RAISE]: { juice: J.STRONG, sfx: 'PLAYER_RAISE', haptic: 'medium', ms: 420 },
    [E.PLAYER_ALL_IN]: { juice: J.EPIC, sfx: 'PLAYER_ALL_IN', haptic: 'heavy', ms: 900 },
    [E.DEAL_FLOP]: { juice: J.NORMAL, sfx: 'DEAL_FLOP', haptic: 'light', ms: 540 },
    [E.DEAL_TURN]: { juice: J.NORMAL, sfx: 'DEAL_TURN', haptic: 'tick', ms: 300 },
    [E.DEAL_RIVER]: { juice: J.NORMAL, sfx: 'DEAL_RIVER', haptic: 'tick', ms: 300 },
    [E.SHOWDOWN_START]: { juice: J.STRONG, sfx: null, haptic: 'light', ms: 300 },
    [E.REVEAL_HAND]: { juice: J.NORMAL, sfx: null, haptic: 'tick', ms: 260 },
    [E.BEST_HAND_HIGHLIGHT]: { juice: J.STRONG, sfx: null, haptic: 'light', ms: 500 },
    [E.POT_TO_WINNER]: { juice: J.STRONG, sfx: 'POT_TO_WINNER', haptic: 'medium', ms: 700 },
    [E.HERO_WIN_SMALL]: { juice: J.NORMAL, sfx: 'HERO_WIN_SMALL', haptic: 'light', ms: 600 },
    [E.HERO_WIN_BIG]: { juice: J.EPIC, sfx: 'HERO_WIN_BIG', haptic: 'heavy', ms: 1200 },
    [E.HERO_BAD_BEAT]: { juice: J.STRONG, sfx: 'HERO_BAD_BEAT', haptic: 'double', ms: 900 },
    [E.HERO_GOOD_FOLD]: { juice: J.SUBTLE, sfx: null, haptic: 'tick', ms: 300 },
    [E.ACHIEVEMENT_UNLOCKED]: { juice: J.STRONG, sfx: 'ACHIEVEMENT_UNLOCKED', haptic: 'double', ms: 800 },
    [E.SESSION_SUMMARY]: { juice: J.NORMAL, sfx: null, haptic: null, ms: 400 },
  };
  // 大底池阈值(BB 倍数)：超过则升级反馈
  const BIG_POT_BB = 50;
  function of(event) { return CONFIG[event] || { juice: J.SUBTLE, sfx: null, haptic: null, ms: 0 }; }
  return { CONFIG, of, BIG_POT_BB };
});
