/* HapticDirector —— 触觉反馈（navigator.vibrate 模式）。无 UI 渲染。可全局开关。 */
(function (root, factory) {
  const m = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = m;
  if (typeof window !== 'undefined') (window.RHCore = window.RHCore || {}).HapticDirector = m;
})(this, function () {
  const PATTERNS = { tick: 8, light: 15, medium: [0, 25], heavy: [0, 40, 30, 40], double: [0, 18, 60, 18] };
  function create(opts) {
    opts = opts || {};
    let enabled = opts.enabled !== false;
    const nav = (typeof navigator !== 'undefined') ? navigator : null;
    function fire(pattern) {
      if (!enabled || !pattern || !nav || typeof nav.vibrate !== 'function') return false;
      try { nav.vibrate(PATTERNS[pattern] || pattern); return true; } catch (e) { return false; }
    }
    return { fire, setEnabled: (v) => { enabled = !!v; }, isOn: () => enabled, PATTERNS };
  }
  return { create };
});
