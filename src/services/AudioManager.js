/* AudioManager —— 事件驱动音频。包裹底层合成音(Sfx)/bgm(Music)/语音(Voice)。
   规则(V4 §16)：默认开短音效、关语音；分类可单独开关；快捷语冷却 5s/人 + 全局单条；
   同类音效短防抖；不随机鬼叫——只由 GameFeelEvent 触发。无 UI/DOM。 */
(function (root, factory) {
  const m = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = m;
  if (typeof window !== 'undefined') (window.RHCore = window.RHCore || {}).AudioManager = m;
})(this, function () {
  // GameFeelEvent → { sfx:方法名, cat:分类 }
  const MAP = {
    UI_CLICK: { sfx: 'button', cat: 'sfx_ui' },
    HAND_START: { sfx: null, cat: 'sfx_table' },
    POST_BLINDS: { sfx: 'chip', cat: 'sfx_table' },
    DEAL_HOLE_CARD: { sfx: 'deal', cat: 'sfx_table' },
    DEAL_FLOP: { sfx: 'deal', cat: 'sfx_table' },
    DEAL_TURN: { sfx: 'deal', cat: 'sfx_table' },
    DEAL_RIVER: { sfx: 'deal', cat: 'sfx_table' },
    PLAYER_FOLD: { sfx: 'fold', cat: 'sfx_table' },
    PLAYER_CHECK: { sfx: 'check', cat: 'sfx_table' },
    PLAYER_CALL: { sfx: 'chip', cat: 'sfx_table' },
    PLAYER_BET: { sfx: 'bet', cat: 'sfx_table' },
    PLAYER_RAISE: { sfx: 'raise', cat: 'sfx_table' },        // 与 bet 区分
    PLAYER_ALL_IN: { sfx: 'allin', cat: 'sfx_table' },
    PLAYER_THINKING: { sfx: null, cat: 'sfx_table' },         // 静音(避免烦)
    REVEAL_HAND: { sfx: 'flip', cat: 'sfx_table' },           // 亮牌翻面声
    SHOWDOWN_START: { sfx: null, cat: 'sfx_table' },
    POT_TO_WINNER: { sfx: 'potwin', cat: 'sfx_table' },       // 收池
    HERO_WIN_SMALL: { sfx: 'win', cat: 'sfx_result' },
    HERO_WIN_BIG: { sfx: 'winbig', cat: 'sfx_result' },       // 大胜更亮
    HERO_LOSE: { sfx: 'lose', cat: 'sfx_result' },
    HERO_BAD_BEAT: { sfx: 'badbeat', cat: 'sfx_result' },     // bad beat 专属
    HERO_GOOD_FOLD: { sfx: 'check', cat: 'sfx_result' },
    ACHIEVEMENT_UNLOCKED: { sfx: 'reward', cat: 'sfx_result' },
    MASTER_LEVEL_PROGRESS: { sfx: 'reward', cat: 'sfx_result' },
    GIFT: { sfx: 'gift', cat: 'sfx_table' },
  };

  function create(deps) {
    deps = deps || {};
    const sfx = deps.sfx || {}, voice = deps.voice || null, music = deps.music || null;
    const enabled = { music: true, sfx_table: true, sfx_ui: true, sfx_result: true, voice: false };
    const lastAt = {};       // 同类防抖
    const wordAt = {};       // 快捷语冷却/人
    let globalWordAt = 0;
    const now = () => (deps.now ? deps.now() : (typeof performance !== 'undefined' && performance.now ? performance.now() : 0));

    function setCategory(cat, on) { if (cat in enabled) enabled[cat] = !!on; }
    function isOn(cat) { return !!enabled[cat]; }

    function play(event, opts) {
      const e = MAP[event]; if (!e) return false;
      if (!enabled[e.cat]) return false;
      if (!e.sfx) return false;
      const t = now();
      if (lastAt[e.sfx] && t - lastAt[e.sfx] < 40) return false; // 同音效 40ms 防抖
      lastAt[e.sfx] = t;
      try {
        if (e.sfx === 'gift') { sfx.gift && sfx.gift((opts && opts.giftType) || 'soft'); }
        else if (sfx[e.sfx]) sfx[e.sfx]();
      } catch (err) { return false; }
      return true;
    }

    // 快捷语：语音默认关；文字气泡由 UI 负责。返回是否允许(冷却内丢弃)
    function quickWord(playerId, audioKey) {
      const t = now();
      if (wordAt[playerId] && t - wordAt[playerId] < 5000) return false; // 每人 5s 冷却
      if (t - globalWordAt < 600) return false;                          // 全局至多 ~1.6/s
      wordAt[playerId] = t; globalWordAt = t;
      if (enabled.voice && voice && audioKey) { try { voice.play(audioKey); } catch (e) {} }
      return true;
    }

    return { play, quickWord, setCategory, isOn, _enabled: enabled, MAP };
  }
  return { create };
});
