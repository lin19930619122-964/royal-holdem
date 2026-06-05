/* BotProfile —— 画像取用与校验助手。纯逻辑，无 UI。 */
(function (root, factory) {
  const req = (typeof require !== 'undefined');
  const Profiles = req ? require('./BotProfiles.js') : window.RHCore.BotProfiles;
  const m = factory(Profiles);
  if (typeof module !== 'undefined' && module.exports) module.exports = m;
  if (typeof window !== 'undefined') (window.RHCore = window.RHCore || {}).BotProfile = m;
})(this, function (Profiles) {
  const REQUIRED = ['vpipTarget', 'pfrTarget', 'aggression', 'bluffFrequency', 'callDownLightness', 'foldToCbet', 'threeBetFrequency', 'tiltFactor'];
  function get(archetype) { return Profiles.DEFAULT_BOT_PROFILES[archetype] || Profiles.DEFAULT_BOT_PROFILES.balanced_reg; }
  function isValid(p) { return !!p && typeof p === 'object' && REQUIRED.every((k) => typeof p[k] === 'number') && Array.isArray(p.reactionTimeMs); }
  function reactionRange(p) { return (p && Array.isArray(p.reactionTimeMs)) ? p.reactionTimeMs : [400, 1000]; }
  return { get, isValid, reactionRange, ARCHETYPES: Profiles.ARCHETYPES, DEFAULT_BOT_PROFILES: Profiles.DEFAULT_BOT_PROFILES };
});
