/* _layerBase —— 层组件统一接口工厂。每个 Layer = { name, mount(root), el(), render(vm), update(vm), destroy() }。
   wrap：包住既有 DOM 元素并打 data-layer；onRender/onUpdate：该层特有的状态驱动逻辑(可选)。无业务耦合。 */
(function (root, factory) {
  const m = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = m;
  if (typeof window !== 'undefined') (window.RHCore = window.RHCore || {}).LayerBase = m;
})(this, function () {
  function make(name, opts) {
    opts = opts || {};
    let el = null;
    return {
      name,
      mount(rootDoc) {
        const d = (typeof document !== 'undefined') ? document : (rootDoc || null);
        el = opts.resolve ? opts.resolve(d) : (d && d.getElementById ? d.getElementById(opts.id) : null);
        // 多个层可复用同一元素(SeatLayer/PlayerHandLayer 共用 #seats)；首个层标记，不覆盖
        if (el && el.setAttribute && !(el.getAttribute && el.getAttribute('data-layer'))) el.setAttribute('data-layer', name);
        if (opts.onMount) try { opts.onMount(el); } catch (e) {}
        return el;
      },
      el() { return el; },
      render(vm) { if (opts.onRender && el) try { opts.onRender(el, vm); } catch (e) {} return this; },
      update(vm) { if (opts.onUpdate && el) try { opts.onUpdate(el, vm); } catch (e) {} else if (opts.onRender && el) try { opts.onRender(el, vm); } catch (e) {} return this; },
      destroy() { if (opts.onDestroy && el) try { opts.onDestroy(el); } catch (e) {} el = null; },
    };
  }
  return { make };
});
