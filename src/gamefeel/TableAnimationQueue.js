/* TableAnimationQueue —— 顺序动画队列：按延时串行执行步骤，避免动画互相打架。
   jsdom/无 setTimeout 环境下退化为同步执行（保证逻辑可测）。无渲染假设，步骤函数自带 DOM 操作。 */
(function (root, factory) {
  const m = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = m;
  if (typeof window !== 'undefined') (window.RHCore = window.RHCore || {}).TableAnimationQueue = m;
})(this, function () {
  function create(opts) {
    opts = opts || {};
    const hasTimer = typeof setTimeout === 'function';
    let chain = Promise.resolve();
    let cleared = false;
    let depth = 0;
    function wait(ms) {
      if (!hasTimer || ms <= 0 || opts.immediate) return Promise.resolve();
      return new Promise((res) => setTimeout(res, ms));
    }
    // 入队一个步骤：先等 delay，再执行 fn（fn 可返回额外的 hold 时长）
    function enqueue(fn, delay) {
      if (opts.immediate) { try { fn && fn(); } catch (e) { /* ignore */ } return api; } // 测试/降级：同步执行
      depth++;
      chain = chain.then(async () => {
        if (cleared) return;
        await wait(delay || 0);
        if (cleared) return;
        try { const hold = fn && fn(); if (typeof hold === 'number') await wait(hold); } catch (e) { /* 动画失败不影响牌局逻辑 */ }
      }).then(() => { depth--; });
      return api;
    }
    function clear() { cleared = true; chain = Promise.resolve(); depth = 0; }
    function reset() { cleared = false; }
    const api = { enqueue, clear, reset, get pending() { return depth; } };
    return api;
  }
  return { create };
});
