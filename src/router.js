/* 统一场景路由 SceneRouter —— 取代写死的页面跳转。
   场景树：launch / login / hall / select / table / tutorial / replay / strategyLab
   用法：
     SceneRouter.go('hall')
     SceneRouter.go('table', { mode:'cash-training', blindLevel, botProfileSet })
     SceneRouter.go('tutorial', { lessonId })
     SceneRouter.go('replay', { handId })
   处理函数由 UI 层注册（router 本身不碰 DOM，保持分层）。*/
(function () {
  const scenes = {};
  let cur = null;
  const stack = [];
  const listeners = [];

  function register(name, handler) { scenes[name] = handler; return api; }
  function has(name) { return !!scenes[name]; }
  function current() { return cur; }

  // _isBack=true 时不再压栈（避免 back→forward 死循环）
  function go(name, params, _isBack) {
    params = params || {};
    if (!scenes[name]) { console.warn('[SceneRouter] 未知场景:', name); return false; }
    if (!_isBack && cur && cur !== name) stack.push(cur);
    const prev = cur; cur = name;
    try { scenes[name](params, prev); } catch (e) { console.error('[SceneRouter] 场景出错:', name, e); }
    listeners.forEach((fn) => { try { fn(name, prev, params); } catch (_) {} });
    return true;
  }
  function back() { const prev = stack.pop(); return go(prev || 'hall', {}, true); }
  function onGo(fn) { listeners.push(fn); }
  function reset() { cur = null; stack.length = 0; }

  const api = { register, has, current, go, back, onGo, reset, _stack: stack };
  window.SceneRouter = api;
})();
