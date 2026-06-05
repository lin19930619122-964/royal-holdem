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
    const eventLog = [];       // 最近事件序列(调试/验收：可打印摊牌等序列)
    let logSeq = 0;
    let busyUntil = 0;         // 发牌动画门控：此刻前 isBusy()=true，ActionPanel 应禁用
    const idleCbs = [];
    const nowMs = () => (typeof Date !== 'undefined' && Date.now ? Date.now() : 0);
    function setBusy(ms) {
      if (deps.immediate) { return; }   // 测试/降级：不门控
      busyUntil = Math.max(busyUntil, nowMs() + (ms || 0));
      if (typeof setTimeout === 'function') setTimeout(flushIdle, (ms || 0) + 10);
    }
    function isBusy() { return nowMs() < busyUntil; }
    function flushIdle() { if (!isBusy()) { const cbs = idleCbs.splice(0); cbs.forEach((cb) => { try { cb(); } catch (e) { /* ignore */ } }); } }
    function onceIdle(cb) { if (!isBusy()) { try { cb(); } catch (e) {} } else idleCbs.push(cb); }

    function juiceOf(event) { return CFG.of(event).juice; }
    function onVisual(fn) { if (typeof fn === 'function') visuals.push(fn); return () => { const i = visuals.indexOf(fn); if (i >= 0) visuals.splice(i, 1); }; }
    function on(event, fn) { (busMap[event] = busMap[event] || []).push(fn); }

    // 视觉分发：把事件映射到对应 Animator（DOM 操作，入队串行）
    function dispatchVisual(event, pl, cfg) {
      switch (event) {
        case E.DEAL_HOLE_CARD: {
          const seats = pl.seatIndices || [];
          setBusy(seats.length * 2 * 90 + 380);   // 门控 ActionPanel 直到逐张发牌完成
          cardDeal.dealHoleCards(seats);           // 一次性发牌(内部按 delay 错开飞行)，同步填充顺序日志
          break;
        }
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
        // 摊牌：进入摊牌模式(压暗) → 逐家亮牌(入队带延时实现 stagger) → 最佳五张描金
        case E.SHOWDOWN_START: queue.enqueue(() => highlight.showdownDim(true), 0); break;
        case E.REVEAL_HAND: queue.enqueue(() => highlight.revealHand(pl.seat, pl), cfg.ms || 280); break;
        case E.BEST_HAND_HIGHLIGHT: queue.enqueue(() => highlight.bestHand(pl.highlight || []), 120); break;
        case E.POT_TO_WINNER: case E.HERO_WIN_SMALL: case E.HERO_WIN_BIG:
          queue.enqueue(() => potWin.award(pl.winners || [], pl.potBb || 0), 200); break;
        case E.ACHIEVEMENT_UNLOCKED: queue.enqueue(() => highlight.achievement && highlight.achievement(pl), 0); break;
        // 显式 silent(无视觉，仅音频/触觉/面板)：HERO_GOOD_FOLD / SESSION_SUMMARY / HAND_START / POST_BLINDS / HERO_LOSE / HERO_BAD_BEAT
        case E.HERO_GOOD_FOLD: case E.SESSION_SUMMARY: case E.HAND_START: case E.POST_BLINDS: case E.PLAYER_CHECK: case E.HERO_LOSE: case E.HERO_BAD_BEAT: case E.UI_CLICK: case E.MASTER_LEVEL_PROGRESS: case E.GIFT: case E.ENTER_HALL: case E.ENTER_TABLE: case E.APP_LAUNCH:
          break; // 明确 silent handler
        default: break;
      }
    }

    function emit(event, payload) {
      const cfg = CFG.of(event);
      const pl = Object.assign({ juice: cfg.juice }, payload || {});
      eventLog.push({ seq: logSeq++, event, juice: cfg.juice, sfx: cfg.sfx || null, haptic: cfg.haptic || null, payload: payload || {} });
      if (eventLog.length > 200) eventLog.shift();
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
      getEventLog: () => eventLog.slice(),
      printEventLog: () => eventLog.map((e) => `#${e.seq} ${e.event}[${e.juice}]${e.sfx ? ' sfx:' + e.sfx : ''}`).join('\n'),
      isBusy, onceIdle, setBusy,
      dealOrderLog: () => (cardDeal.lastOrder ? cardDeal.lastOrder() : []),
      EVENTS: E,
      _animators: { chipFly, cardDeal, potWin, highlight }, _queue: queue, _haptics: haptics,
    };
  }
  return { create, EVENTS: E };
});
