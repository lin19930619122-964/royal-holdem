/* GameFeelEvent —— 牌局爽感事件枚举（24 类）+ Juice 级别。纯常量，无 UI。 */
(function (root, factory) {
  const m = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = m;
  if (typeof window !== 'undefined') (window.RHCore = window.RHCore || {}).GameFeelEvent = m;
})(this, function () {
  const EVENTS = {
    HAND_START: 'HAND_START',
    POST_BLINDS: 'POST_BLINDS',
    DEAL_HOLE_CARD: 'DEAL_HOLE_CARD',
    HERO_PREMIUM_HAND: 'HERO_PREMIUM_HAND',
    PLAYER_THINKING: 'PLAYER_THINKING',
    PLAYER_FOLD: 'PLAYER_FOLD',
    PLAYER_CHECK: 'PLAYER_CHECK',
    PLAYER_CALL: 'PLAYER_CALL',
    PLAYER_BET: 'PLAYER_BET',
    PLAYER_RAISE: 'PLAYER_RAISE',
    PLAYER_ALL_IN: 'PLAYER_ALL_IN',
    DEAL_FLOP: 'DEAL_FLOP',
    DEAL_TURN: 'DEAL_TURN',
    DEAL_RIVER: 'DEAL_RIVER',
    SHOWDOWN_START: 'SHOWDOWN_START',
    REVEAL_HAND: 'REVEAL_HAND',
    BEST_HAND_HIGHLIGHT: 'BEST_HAND_HIGHLIGHT',
    POT_TO_WINNER: 'POT_TO_WINNER',
    HERO_WIN_SMALL: 'HERO_WIN_SMALL',
    HERO_WIN_BIG: 'HERO_WIN_BIG',
    HERO_BAD_BEAT: 'HERO_BAD_BEAT',
    HERO_GOOD_FOLD: 'HERO_GOOD_FOLD',
    ACHIEVEMENT_UNLOCKED: 'ACHIEVEMENT_UNLOCKED',
    SESSION_SUMMARY: 'SESSION_SUMMARY',
  };
  const ALL = Object.keys(EVENTS);
  const JUICE = { SUBTLE: 'subtle', NORMAL: 'normal', STRONG: 'strong', EPIC: 'epic' };
  return { EVENTS, ALL, JUICE };
});
