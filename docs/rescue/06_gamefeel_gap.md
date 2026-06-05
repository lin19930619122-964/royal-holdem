# 06 · 爽感（GameFeelDirector）差距

> 依据：`src/services/GameFeelDirector.js`(51) 定义事件 + `AudioManager.js`(73) 的 MAP + `ui.js` 全量 `GF.emit` 调用点（实测 8 处调用）+ `grep onVisual src/ui.js`（**0 命中**）。

## 有没有爽感导演？

**有骨架，但未成"导演"。** 现状：
- `GameFeelDirector.create({audio})` 提供 `emit(event,payload)` → 调 `audio.play` + 遍历 `visuals[]` 视觉执行器 + `bus.emit`。
- ⚠️ **`onVisual` 注册数 = 0**：ui.js 从未注册任何视觉执行器。→ 所有视觉反馈（`flashAllIn`/`rollPot`/`deal-in`/`rewardPop`）仍**散在 ui.js 内联**，没有走导演。导演实际只起到**音频路由 + 事件总线**作用。

## 24 个必需事件覆盖矩阵

| 事件 | 已定义? | 实际 emit? | 有音频? | 有视觉(经导演)? |
|---|---|---|---|---|
| HAND_START | ✅ | ❌ | 占位(null) | ❌ |
| POST_BLINDS | ✅ | ❌ | ✅chip | ❌ |
| DEAL_HOLE_CARD | ✅ | ✅ | ✅deal | 内联(deal-in) |
| HERO_PREMIUM_HAND | ✅ | ❌ | ❌ | ❌ |
| PLAYER_THINKING | ✅ | ❌ | ❌ | ❌ |
| PLAYER_FOLD | ✅ | ✅ | ✅fold | 内联(.folded) |
| PLAYER_CHECK | ✅ | ✅ | ✅check | 内联 |
| PLAYER_CALL | ✅ | ✅ | ✅chip | 内联 |
| PLAYER_BET | ✅ | ✅ | ✅bet | 内联 |
| PLAYER_RAISE | ✅ | ✅ | ✅bet | 内联 |
| PLAYER_ALL_IN | ✅ | ✅ | ✅allin | 内联(flashAllIn 压暗) |
| DEAL_FLOP | ✅ | ✅ | ✅deal | 内联(board grow) |
| DEAL_TURN | ✅ | ✅ | ✅deal | 内联 |
| DEAL_RIVER | ✅ | ✅ | ✅deal | 内联 |
| SHOWDOWN_START | ✅ | ❌ | ❌ | ❌ |
| REVEAL_HAND | ✅ | ❌ | ❌ | 内联(flip-in，但不经导演) |
| BEST_HAND_HIGHLIGHT | ✅ | ❌ | ❌ | ❌ |
| POT_TO_WINNER | ✅ | ❌ | ✅chip | ❌(无筹码飞向赢家落地) |
| HERO_WIN_SMALL | ✅ | ✅ | ✅win | 内联(rewardPop) |
| HERO_WIN_BIG | ✅ | ✅ | ✅win | 内联 |
| HERO_BAD_BEAT | ✅ | ❌ | ✅lose | ❌ |
| HERO_GOOD_FOLD | ✅ | ❌ | ❌ | ❌ |
| ACHIEVEMENT_UNLOCKED | ✅ | ❌ | ✅reward | ❌ |
| SESSION_SUMMARY | ✅ | ❌(用 Fx.rewardPop 直绕过导演) | ❌ | 内联 |

**统计：24 必需事件中，真正 emit 的仅 13 个；11 个已定义但从不触发（HAND_START/POST_BLINDS/HERO_PREMIUM_HAND/PLAYER_THINKING/SHOWDOWN_START/REVEAL_HAND/BEST_HAND_HIGHLIGHT/POT_TO_WINNER/HERO_BAD_BEAT/HERO_GOOD_FOLD/ACHIEVEMENT_UNLOCKED）= 死事件。**经导演驱动的视觉 = 0。

## 是不是"数字变化 + 牌瞬间出现"？

**部分仍是。** 已修掉一部分（`rollPot` 底池滚动、`deal-in` 逐张滑入、`flashAllIn` 压暗），但：
- 牌不是从牌堆原点飞向座位，是原地滑入近似。
- 筹码"赢家归集"`POT_TO_WINNER` 未落地（无 chipToWinner 动画）。
- 摊牌缺 `SHOWDOWN_START`/`REVEAL_HAND`/`BEST_HAND_HIGHLIGHT` 编排（最佳 5 张高亮、逐家翻牌节奏）。
- 关键时刻（HERO_PREMIUM_HAND 起手 AA、HERO_BAD_BEAT、HERO_GOOD_FOLD）**无任何反馈**。

**判定：P0（部分缺陷）。** 导演存在但未接管视觉、半数事件空转。返工重点：①ui.js 注册 onVisual 执行器，把内联视觉迁进导演；②补齐 11 个死事件的 emit 点；③POT_TO_WINNER / 摊牌编排 / 关键时刻反馈落地。
