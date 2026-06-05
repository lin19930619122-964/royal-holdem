/* BotProfiles —— 7 种 Bot 画像参数表（原创，零参考资源）。纯数据，无 UI。
   参数语义：
   - vpipTarget   入池率目标（越高越松）
   - pfrTarget    翻前主动加注率（越高越主动）
   - aggression   翻后攻击性 0~1
   - bluffFrequency 诈唬频率
   - callDownLightness 跟到底的轻度（越高越像跟注站）
   - trapFrequency 慢打/陷阱频率
   - foldToCbet    面对持续下注的弃牌倾向
   - threeBetFrequency 翻前 3bet 频率
   - tiltFactor    波动/上头系数（放大攻击性方差）
   - reactionTimeMs 思考时长区间 [min,max] */
(function (root, factory) {
  const m = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = m;
  if (typeof window !== 'undefined') (window.RHCore = window.RHCore || {}).BotProfiles = m;
})(this, function () {
  const DEFAULT_BOT_PROFILES = {
    nit: { id: 'nit', displayName: '岩石型', archetype: 'nit', vpipTarget: 0.14, pfrTarget: 0.10, aggression: 0.35, bluffFrequency: 0.03, callDownLightness: 0.20, trapFrequency: 0.08, foldToCbet: 0.68, threeBetFrequency: 0.05, tiltFactor: 0.05, reactionTimeMs: [700, 1400] },
    tight_aggressive: { id: 'tag', displayName: '紧凶型', archetype: 'tight_aggressive', vpipTarget: 0.22, pfrTarget: 0.18, aggression: 0.65, bluffFrequency: 0.10, callDownLightness: 0.38, trapFrequency: 0.10, foldToCbet: 0.52, threeBetFrequency: 0.09, tiltFactor: 0.08, reactionTimeMs: [550, 1150] },
    balanced_reg: { id: 'reg', displayName: '常规玩家', archetype: 'balanced_reg', vpipTarget: 0.26, pfrTarget: 0.20, aggression: 0.58, bluffFrequency: 0.12, callDownLightness: 0.42, trapFrequency: 0.11, foldToCbet: 0.47, threeBetFrequency: 0.10, tiltFactor: 0.10, reactionTimeMs: [500, 1100] },
    loose_passive: { id: 'lp', displayName: '松被动', archetype: 'loose_passive', vpipTarget: 0.42, pfrTarget: 0.08, aggression: 0.22, bluffFrequency: 0.04, callDownLightness: 0.68, trapFrequency: 0.06, foldToCbet: 0.35, threeBetFrequency: 0.03, tiltFactor: 0.12, reactionTimeMs: [450, 1000] },
    calling_station: { id: 'station', displayName: '跟注站', archetype: 'calling_station', vpipTarget: 0.50, pfrTarget: 0.06, aggression: 0.15, bluffFrequency: 0.02, callDownLightness: 0.82, trapFrequency: 0.03, foldToCbet: 0.20, threeBetFrequency: 0.02, tiltFactor: 0.15, reactionTimeMs: [350, 950] },
    loose_aggressive: { id: 'lag', displayName: '松凶型', archetype: 'loose_aggressive', vpipTarget: 0.38, pfrTarget: 0.29, aggression: 0.78, bluffFrequency: 0.20, callDownLightness: 0.50, trapFrequency: 0.08, foldToCbet: 0.42, threeBetFrequency: 0.16, tiltFactor: 0.22, reactionTimeMs: [400, 1000] },
    maniac: { id: 'maniac', displayName: '疯狗型', archetype: 'maniac', vpipTarget: 0.60, pfrTarget: 0.45, aggression: 0.95, bluffFrequency: 0.32, callDownLightness: 0.58, trapFrequency: 0.02, foldToCbet: 0.28, threeBetFrequency: 0.26, tiltFactor: 0.45, reactionTimeMs: [250, 800] },
  };
  const ARCHETYPES = Object.keys(DEFAULT_BOT_PROFILES);
  return { DEFAULT_BOT_PROFILES, ARCHETYPES };
});
