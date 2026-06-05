# 05 · AI / Bot 差距

> 依据：`src/core/ai/PokerBrain.js`(292) + `BotDecisionEngine.js`(90) 实读；实盘接入实读自 `ui.js` 1801 行 AI 循环 `BotDecisionEngine.decide(game, current, {profile})`。

## 是不是随机 / 固定概率 / 永远跟 / 永远加？

**不是。** 判定依据（逐条命中代码）：
- 决策入口 `decideBotAction(ctx)` 综合 equity（蒙特卡洛 500 样本 `estimateHoldemEquity`）+ 牌面 `analyzeBoardTexture` + 听牌 `analyzeDraws` + 底池赔率 `potOdds(ctx)` + `spr(ctx)` + 画像参数。
- 不是 `Math.random()<0.5` 之类。随机仅用于"按种子可复现"与"诈唬频率/tilt 抖动"（`rng() < profile.bluffFrequency`），是**受控随机**而非随机 Bot。
- **故不构成 P0 随机 Bot 缺陷**。这是当前项目少数达标项之一。

## DecisionContext 因子覆盖（要求 17 项）

| 要求因子 | 代码 | 状态 |
|---|---|---|
| holeCards | `ctx.holeCards` | ✅ |
| board | `ctx.board` | ✅ |
| street | `ctx.street` | ✅ |
| position | `ctx.position`（BotDecisionEngine.positionOf） | ✅ |
| effectiveStack | `ctx.effectiveStack` | ✅ |
| pot | `ctx.pot` | ✅ |
| callAmount | `ctx.amountToCall` | ✅ |
| minRaise | 经 `ctx.legalActions.minRaiseTo` 传入 | ✅ |
| SPR | `spr(ctx)=effectiveStack/max(pot,BB)` 第157行 | ✅ |
| playersInHand | `ctx.activeOpponents` | ✅ |
| actionHistory | `ctx.previousActions` | ✅(本街) |
| legalActions | `ctx.legalActions` | ✅ |
| handStrength | `rawStrength=max(equity, madeStrength+drawBoost)` | ✅ |
| equity | `estimateHoldemEquity`(MC 500) | ✅ |
| potOdds | `potOdds(ctx)` 第156行 | ✅ |
| boardTexture | `analyzeBoardTexture` 第101行 | ✅ |
| botProfile | `ctx.botProfile` | ✅ |

**17/17 因子全部接入。**

## 7 种画像

全部存在于 `DEFAULT_BOT_PROFILES`（每个含 vpipTarget/pfrTarget/aggression/bluffFrequency/callDownLightness/trapFrequency/foldToCbet/threeBetFrequency/tiltFactor/reactionTimeMs）：
`nit 岩石 / tight_aggressive 紧凶 / balanced_reg 常规 / loose_passive 松被动 / calling_station 跟注站 / loose_aggressive 松凶 / maniac 疯狗`。✅ 7/7。

## 仍存在的真实弱点（非 P0，但需在 Phase 2 加强）

1. **actionHistory 仅本街**：未跨街累计对手行动序列，无法形成长期对手建模（参考有完整桌内统计）。
2. **无针对英雄的剥削调整**：`OppModel` 在 UI 侧记录英雄弃牌率/激进度，但 PokerBrain 决策**未消费**它 → Bot 不会针对玩家漏洞调整（仅按自身画像打）。
3. **下注尺度档位少**：`fraction` 仅 0.30/0.45 两档（第172行），缺 ⅓/½/¾/超池/不同街差异化与诈唬-价值平衡。
4. **测试**：`test-bot` 17 项覆盖"行为符合画像方向"，但**缺**针对 SPR/potOdds 阈值、诈唬频率收敛、剥削调整的专项断言 → 部分**未验证**。
5. **tilt/trap 参数已定义但作用浅**：`tiltFactor` 仅微调 aggression，`trapFrequency` 在决策树里利用不足。

## 结论

AI 结构是当前项目的**强项而非缺陷**，可保留为 Phase 2 基座；返工重点是「跨街对手建模 + 剥削英雄 + 下注尺度体系 + 专项测试」，而不是推倒重来。
