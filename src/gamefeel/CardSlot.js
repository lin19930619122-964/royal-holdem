/* CardSlot —— 牌位状态机：empty → reserved → flying → landed → revealed(→ dimmed/highlighted)。
   关键：reserved/flying/landed 时不显示最终牌面；只有 reveal() 才注入真实牌面(hydrate)。纯逻辑 + DOM 类标记。 */
(function (root, factory) {
  const m = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = m;
  if (typeof window !== 'undefined') (window.RHCore = window.RHCore || {}).CardSlot = m;
})(this, function () {
  const STATES = ['empty', 'reserved', 'flying', 'landed', 'revealed', 'dimmed', 'highlighted'];
  function create(el) {
    let state = 'empty';
    function set(s) {
      state = s;
      if (el) { el.dataset.slot = s; STATES.forEach((x) => el.classList && el.classList.remove('slot-' + x)); if (el.classList) el.classList.add('slot-' + s); }
      return api;
    }
    function reserve() { if (el) el.innerHTML = '<span class="slot-ph"></span>'; return set('reserved'); }   // 占位，不显示牌面
    function fly() { return set('flying'); }
    function land() { return set('landed'); }
    function reveal(faceHTML) { if (el && faceHTML != null) el.innerHTML = faceHTML; return set('revealed'); }   // 到达后才注入真实牌面
    function dim() { return set('dimmed'); }
    function highlight() { return set('highlighted'); }
    function reset() { if (el) el.innerHTML = ''; return set('empty'); }
    const api = { reserve, fly, land, reveal, dim, highlight, reset, set, get state() { return state; }, el: () => el };
    return api;
  }
  return { create, STATES };
});
