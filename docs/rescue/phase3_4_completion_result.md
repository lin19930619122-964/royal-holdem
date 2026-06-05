# Phase 3/4 Completion Sprint — 结果报告（如实更正：验收未通过）

> 此前版本把 A/B/C/D/E 标成「实现」是**系统性夸大**。经逐项源码核验 + 实跑，真实状态如下。**Phase 3/4 验收未通过**，进入 Repair Sprint（见 `phase3_4_repair_plan.md`）。

## 真实状态（核验后）

| 项 | 之前误标 | 真实状态 | 核验证据 |
|---|---|---|---|
| A TableScene 组件树 | 实现 | **未实现** | `TableScene.js` 是装配器(不拼 HTML)，但 14 个 layer 是 215 行薄壳，只 `Base.make(name,{id})` 挂载+`_base` 打 `data-layer`；seat/card/chip/panel 的 HTML 拼接**全在 ui.js**（`render`/`buildSeats`/`boardEl.innerHTML`/`cardsEl.innerHTML`/`renderPanelHTML` 31 面板）；ui.js 本 sprint **2176→2319 反增**。10/14 layer 无 render/update 逻辑 |
| B SeatView 节点驱动 | 实现 | **部分实现** | **2 个空占位**：`emojiMount`/`giftMount`（`popMount` 定义但 ui.js 0 调用，从不填充）。**4 个缺陷**：`avatarFrame`（`!!'none'`=truthy，英雄永远显框）、`winStreakBadge`（仅 i===0，bot 恒 0）、`quickWordBubble`（仅 bot 经 maybeChatter，英雄走另一条 Fx.speechBubble）、`dealerButton`（座位内 `.seat-dealer` 与全局 `#dealer-button` 重复）。其余 5 个真驱动 |
| C GameFeelDirector | 实现 | **部分实现** | emit 24/24，但 `dispatchVisual` 只 **13 个 case**=handler 13/24；`SHOWDOWN_START`/`REVEAL_HAND`/`ACHIEVEMENT_UNLOCKED`/`SESSION_SUMMARY` 等无视觉 handler；无 DealController/ShowdownController/SettlementController/AchievementService（emit 全寄生 ui.js）；摊牌/派彩仍靠 render 直接刷新 |
| D 发牌动画 | 实现 | **部分/装饰** | 有 `#deck-anchor`、有 from/to 坐标、有幽灵飞行；但**无 seat.cardAnchor / communityCardAnchor**；队列不逐张排程；**真牌是 render 瞬间渲染到位**，`flyDealCard` 只是叠加一张装饰幽灵；**ActionPanel 完全不等动画**（`tick→enableHumanControls` 立即激活） |
| E 摊牌高亮 | 实现 | **部分实现** | `BEST_HAND_HIGHLIGHT`/`POT_TO_WINNER` 真接 handler，best5 描金板+座位都做了；但**逐家揭示是假的**：3×`REVEAL_HAND` 同步 forEach 0 延时 emit、`REVEAL_HAND` 无 dispatchVisual case、真实亮牌是 render 的 flip-in 一次性全亮 |
| F 座位筹码滚动 | 实现 | 实现 | `rollSeatStack` rAF easeOut，终值=GameState |
| G AI | 实现 | **决策基本实现，解释 log 不达标** | 跨街 history 真非空(实测 60 手 39 次翻后非空)；OppModel 喂回**仅翻后**(decidePreflop 0 引用)、仅 `villain.sample≥8`、单 villain。**解释 log 粒度不足**：实跑 AsQs/Qh7d2c → `handClass='顶对'`(无 kicker 质量)、`boardTexture='彩虹面'`(无 dry/high-card)、SPR 算了(5.8)但不进 reason、ActionHistory 不渲染、把 A 踢脚误描述成"1 张高张" |
| H 音频 | 实现 | 大体实现 | sound.js 真有 raise/flip/potwin/badbeat/winbig 不同合成；映射已改 |
| I 换肤 | 实现 | 大体实现，带 bug | cardFace classic/neon 即时生效(test 验证)；但 avatarFrame none-bug(同 B) |

## 结论
**A 未实现、B/C/D/E 部分、G 解释层不达标 → Phase 3/4 验收未通过。** 即刻进入 Repair Sprint，逐项补到名副其实。本文件不再有任何"实现"是夸大的。
