/* TableController —— 单机训练桌的「大脑」：把 core/poker reducer 包成可被 UI 驱动的控制器。
   无 DOM、无渲染。UI 订阅 onChange 拿新 state 渲染，并通过 act() 提交人类行动。
   推进(发牌/摊牌/bot 行动)由 step()/pump() 完成；UI 可按定时器逐步 step() 以获得节奏。
   规则铁律：本控制器只通过 GameReducer 改状态，绝不直接动筹码/底池/牌堆。无 UI。 */
(function (root, factory) {
  const req = (typeof require !== 'undefined');
  const TableState = req ? require('../../core/poker/TableState.js') : window.RHCore.TableState;
  const Reducer = req ? require('../../core/poker/GameReducer.js') : window.RHCore.GameReducer;
  const Legal = req ? require('../../core/poker/LegalActions.js') : window.RHCore.LegalActions;
  const m = factory(TableState, Reducer, Legal);
  if (typeof module !== 'undefined' && module.exports) module.exports = m;
  if (typeof window !== 'undefined') (window.RHCore = window.RHCore || {}).TableController = m;
})(this, function (TableState, Reducer, Legal) {
  const reducer = Reducer.reducer;

  // 兜底 bot（注入 aiDecide 时优先用之）：按合法动作做保守决策，仅供无 AI 时跑通
  function fallbackBot(o) {
    if (o.canCheck) return { action: 'check' };
    if (o.toCall <= 0) return { action: 'check' };
    // 便宜就跟，贵就弃（极简，仅占位；真实 AI 由 ui 注入）
    if (o.toCall <= o.pot * 0.5 || o.toCall <= o.chips * 0.15) return { action: 'call' };
    return { action: 'fold' };
  }

  // opts: { config, heroSeat=0, aiDecide(state)→{action,amount} }
  function create(opts) {
    opts = opts || {};
    const heroSeat = opts.heroSeat != null ? opts.heroSeat : 0;
    const aiDecide = opts.aiDecide || null;
    let state = TableState.create(opts.config || {});
    if (state.players[heroSeat]) state.players[heroSeat].isHuman = true;
    const listeners = [];
    function emit() { for (const fn of listeners) { try { fn(state); } catch (e) {} } }

    function startHand() {
      state = reducer(state, { type: 'START_NEXT_HAND' });
      if (state.street === 'preflop') state = reducer(state, { type: 'DEAL_HOLE_CARDS' });
      emit();
      return state;
    }
    // 提交人类行动（非当前/非法由 reducer 自行忽略，状态不变）
    function act(action, amount) {
      const p = state.players[state.current];
      if (!p) return state;
      state = reducer(state, { type: 'PLAYER_ACTION', playerId: p.id, action, amount });
      emit();
      return state;
    }
    // 推进一步：bot 行动 或 发牌/摊牌。返回 true 表示还可继续自动推进
    function step() {
      if (state.handOver) return false;
      if (state.current >= 0) {
        const p = state.players[state.current];
        if (p.isHuman) return false; // 等待人类
        const o = Legal.forCurrent(state);
        const d = (aiDecide && aiDecide(state)) || fallbackBot(o);
        state = reducer(state, { type: 'PLAYER_ACTION', playerId: p.id, action: d.action, amount: d.amount });
        emit(); return true;
      }
      if (state.awaitingDeal) { state = reducer(state, { type: state.awaitingDeal }); emit(); return true; }
      return false;
    }
    // 连续自动推进直到轮到人类或手结束
    function pump() { let g = 0; while (step() && g++ < 400) { /* loop */ } return state; }

    return {
      getState: () => state,
      startHand, act, step, pump,
      onChange: (fn) => { listeners.push(fn); return () => { const i = listeners.indexOf(fn); if (i >= 0) listeners.splice(i, 1); }; },
      isHumanTurn: () => state.current >= 0 && state.players[state.current] && state.players[state.current].isHuman && !state.handOver,
      legal: () => Legal.forCurrent(state),
      heroSeat,
    };
  }
  return { create, fallbackBot };
});
