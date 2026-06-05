/* EventBus —— 极简发布订阅。GameFeelDirector / AudioManager / UI 解耦用。无 UI/DOM。 */
(function (root, factory) {
  const m = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = m;
  if (typeof window !== 'undefined') (window.RHCore = window.RHCore || {}).EventBus = m;
})(this, function () {
  function create() {
    const map = new Map();
    function on(type, fn) { if (!map.has(type)) map.set(type, new Set()); map.get(type).add(fn); return () => { const s = map.get(type); if (s) s.delete(fn); }; }
    function emit(type, payload) {
      const fire = (set) => { if (set) for (const fn of [...set]) { try { fn(payload, type); } catch (e) {} } };
      fire(map.get(type)); fire(map.get('*'));
    }
    return { on, emit, _map: map };
  }
  return { create };
});
