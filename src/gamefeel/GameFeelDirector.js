/* GameFeelDirector —— 爽感中枢。所有牌局事件经此分发到 音频 + 触觉 + 视觉动画(队列串行)。
   create({ audio, stage, haptics, immediate })：
     audio   —— AudioManager 实例（play(eventKey)）
     stage   —— DOM 访问器集合（注入自 ui.js），供各 Animator 使用
     haptics —— HapticDirector 实例（可缺省，自动创建）
   emit(event, payload)：音频/触觉同步触发（可测）；视觉步骤入队串行执行。
   纯逻辑装配，DOM 操作下沉到 Animator + stage，jsdom 安全。 */
(function (root, factory) {
  const req = (typeof require !== 'undefined');
  const GFE = req ? require('./GameFeelEvent.js') : window.RHCore.GameFeelEvent;
  const CFG = req ? require('./GameFeelConfig.js') : window.RHCore.GameFeelConfig;
  const Queue = req ? require('./TableAnimationQueue.js') : window.RHCore.TableAnimationQueue;
  const ChipFly = req ? require('./ChipFlyAnimator.js') : window.RHCore.ChipFlyAnimator;
  const CardDeal = req ? require('./CardDealAnimator.js') : window.RHCore.CardDealAnimator;
  const PotWin = req ? require('./PotWinAnimator.js') : window.RHCore.PotWinAnimator;
  const Highlight = req ? require('./HighlightDirector.js') : window.RHCore.HighlightDirector;
  const Haptic = req ? require('./HapticDirector.js') : window.RHCore.HapticDirector;
  const m = factory(GFE, CFG, Queue, ChipFly, CardDeal, PotWin, Highlight, Haptic);
  if (typeof module !== 'undefined' && module.exports) module.exports = m;
  if (typeof window !== 'undefined') (window.RHCore = window.RHCore || {}).GameFeelDirectorV2 = m;
})(this, function (GFE, CFG, Queue, ChipFly, CardDeal, PotWin, Highlight, Haptic) {
  const E = GFE.EVENTS;
  function create(deps) {
    deps = deps || {};
    const audio = deps.audio || { play() { return false; }, setCategory() {} };
    const stage = deps.stage || {};
    const haptics = deps.haptics || Haptic.create({ enabled: deps.haptics !== false });
    const queue = Queue.create({ immediate: !!deps.immediate });
    const chipFly = ChipFly.create(stage);
    const cardDeal = CardDeal.create(stage);
    const potWin = PotWin.create(stage, chipFly);
    const highlight = Highlight.create(stage);
    const visuals = [];        // onVisual 订阅者：(event, payload, juice) => void
    const busMap = {};

    function juiceOf(event) { return CFG.of(event).juice; }
    function onVisual(fn) { if (typeof fn === 'function') visuals.push(fn); return () => { const i = visuals.indexOf(fn); if (i >= 0) visuals.splice(i, 1); }; }
    function on(event, fn) { (busMap[event] = busMap[event] || []).push(fn); }

    // 视觉分发：把事件映射到对应 Animator（DOM 操作，入队串行）
    function dispatchVisual(event, pl, cfg) {
      switch (event) {
        case E.DEAL_HOLE_CARD: queue.enqueue(() => cardDeal.dealHole(pl.seatIndices || []), 0); break;
        case E.DEAL_FLOP: queue.enqueue(() => cardDeal.revealBoard('flop'), 0); break;
        case E.DEAL_TURN: queue.enqueue(() => cardDeal.revealBoard('turn'), 0); break;
        case E.DEAL_RIVER: queue.enqueue(() => cardDeal.revealBoard('river'), 0); break;
        case E.PLAYER_THINKING: queue.enqueue(() => { highlight.activeSeat(pl.seat); highlight.thinking(pl.seat, true); }, 0); break;
        case E.PLAYER_FOLD: queue.enqueue(() => highlight.foldMask(pl.seat), 0); break;
        case E.PLAYER_CALL: case E.PLAYER_BET: case E.PLAYER_RAISE:
          queue.enqueue(() => chipFly.betToPot(pl.seat), 0); break;
        case E.PLAYER_ALL_IN:
          queue.enqueue(() => { chipFly.betToPot(pl.seat, { count: 4 }); highlight.allInFocus(); }, 0); break;
        case E.HERO_PREMIUM_HAND: queue.enqueue(() => highlight.premiumHand(pl.seat != null ? pl.seat : 0), 0); break;
        case E.BEST_HAND_HIGHLIGHT: queue.enqueue(() => highlight.bestHand(pl.highlight || []), 0); break;
        case E.POT_TO_WINNER: case E.HERO_WIN_SMALL: case E.HERO_WIN_BIG:
          queue.enqueue(() => potWin.award(pl.winners || [], pl.potBb || 0), 0); break;
        default: break;
      }
    }

    function emit(event, payload) {
      const cfg = CFG.of(event);
      const pl = Object.assign({ juice: cfg.juice }, payload || {});
      // 1) 音频（同步，便于测试与即时反馈）
      if (cfg.sfx && audio.play) { try { audio.play(cfg.sfx, pl); } catch (e) { /* ignore */ } }
      // 2) 触觉
      if (cfg.haptic) haptics.fire(cfg.haptic);
      // 3) 视觉（入队串行）
      dispatchVisual(event, pl, cfg);
      // 4) onVisual 订阅者 + bus
      for (const fn of visuals) { try { fn(event, pl, cfg.juice); } catch (e) { /* ignore */ } }
      if (busMap[event]) for (const fn of busMap[event]) { try { fn(pl); } catch (e) { /* ignore */ } }
      return pl;
    }

    return {
      emit, onVisual, on, juiceOf,
      setCategory: (c, v) => audio.setCategory && audio.setCategory(c, v),
      setHaptics: (v) => haptics.setEnabled(v),
      clearQueue: () => queue.clear(),
      EVENTS: E,
      _animators: { chipFly, cardDeal, potWin, highlight }, _queue: queue, _haptics: haptics,
    };
  }
  return { create, EVENTS: E };
});
