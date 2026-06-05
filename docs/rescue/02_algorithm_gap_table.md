# 02 算法差距表（V4 §5/§6 + 算法规格 V4）

> 负责规则的文件：`src/core/poker/*`（权威）。负责 Bot 的文件：`src/ai.js`（现行）。蓝本：`holdem_ai_brain_v4.ts`。

## A. 规则引擎（V4 §5 / 算法规格 §1）——基本已达标
| 能力 | 状态(文件) | 严重度 |
|---|---|---|
| 52 牌 / Fisher-Yates / 可复现种子 | ✅ `Deck.js`+`SeededRng.js` | — |
| 2-9 人 / Button / SB / BB / ante | ✅ `TableState.js`+`GameReducer.js` | — |
| preflop→…→showdown 状态机 | ✅ `GameReducer.js`(street + awaitingDeal) | — |
| fold/check/call/bet/raise/all-in 合法校验 | ✅ `LegalActions.js` | — |
| 最小加注 / 短码全下不重开 | ✅ `GameReducer.raiseTo`(cappedToCall) | — |
| 有效筹码 / all-in 自动跑牌 | ✅ reducer | — |
| 主池+边池 / 多人摊牌 / 平分 / 奇数零头 | ✅ `SidePot.js`(distribute 零头给庄左) | — |
| 7 选 5 / A2345 / 皇家最高 | ✅ `HandEvaluator.js`(57 测试) | — |
| 每手完整 HandHistory | ✅ `HandHistory.js`(结构化事件) | — |
| 每个 Action 可回放 | 🟡 log 有，**回放重演 UI 未做** | P2(Phase7) |
| dispatch 动作集合与 V4 §11 一致 | 🟡 有 START_NEXT_HAND/DEAL_*/PLAYER_ACTION/SHOWDOWN；**无独立 POST_BLINDS/AWARD_POTS**(合并在 START/SHOWDOWN) | P2 可选拆分 |

> 规则核心**不需要重写**，仅按 V4 §12 再补两条边界测试（弃牌不享无资格边池 / 三人不同额 all-in 主+边池），并可选拆 POST_BLINDS/AWARD_POTS 动作。

## B. AI Bot（V4 §6 / 算法规格 §2-§7）——结构性不达标，重写
现行 `ai.js`：MC 胜率(`equityFull`/`equityVsRange`) + 底池赔率 + 位置开牌门槛 + 性格(aggression/bluff/tight/skill) + 对手建模剥削。**不是随机**，但：

| V4 要求 | 现状(ai.js) | 严重度 | 改造动作 |
|---|---|---|---|
| 169 手牌矩阵分类(premium/strong/playable/speculative/trash) | 仅 `preflopClass()` 粗分(在 ui.js)，Bot 内按牌力阈值 | **P1** | 移植 `PreflopMatrix`(v4 brain 已含 PREMIUM/STRONG/... 集合 + handCode) |
| 7 种命名 archetype(nit/TAG/balanced_reg/loose_passive/calling_station/LAG/maniac) | 6 种(nit/tag/lag/station/maniac/shark) 风格混合，且非命名画像池 | **P1** | 采用 v4 `DEFAULT_BOT_PROFILES`(7 种) |
| BotProfile 参数体系(vpip/pfr/aggression/bluffFrequency/callDownLightness/foldToCbet/threeBetFrequency/trapFrequency/tilt/reactionTimeMs) | 仅 aggression/bluff/tight/skill | **P1** | 采用 v4 BotProfile 字段 |
| BoardTexture(wetness/paired/monotone/twoTone/straightConnected/...) | 仅 `boardWetness()` 标量 | **P1** | 移植 `analyzeBoardTexture` |
| 听牌识别(flushDraw/nutFD/backdoor/OESD/gutshot/double/combo/overcards) | `computeOuts()` 在 ui.js 粗算 outs | **P1** | 移植 `analyzeDraws` |
| 结构化决策输出 + reason + features | `decide()` 仅返回 {action,amount} | **P1** | 用 v4 `BotDecision`(reason/confidence/features) |
| 决策延迟 reactionTimeMs(性格相关) | ui.js 固定 `aiThinkDelay()`(按动作) | P2 | 用 profile.reactionTimeMs |
| 训练建议与 Bot 用同一评估、表述不同 | TrainingAdvisor 与 Bot 各算各的(ui.js vs ai.js) | **P1** | 统一走 v4 `classifyPreflop/analyzeBoardTexture/analyzeDraws` + equity |
| 可复现 RNG 注入 | Bot 用全局 Math.random | P1 | 用 ctx.seed → seedRng |

## C. 胜率估算（算法规格 §4.4）
现行 `equity/equityFull/equityVsRange`(MC，默认 1400-2500，有缓存于 ui.js)。**已满足** win/tie/lose + N 对手 + 死牌 + 指定 board。V4 要求「不阻塞 UI、可中断、可缓存」：当前同步执行（移动端单次 ~十几 ms 可接受），**P2** 可移 Web Worker。

## 结论
- 规则核心 ✅ 保留 + 2 条边界测试。
- **Bot 必须按 `holdem_ai_brain_v4.ts` 重写**（V4 Phase 2，本返工最高优先实质工作）：移植到 JS、用核心的 `evaluateBest/equity` 适配 `evaluateBestHand/estimateHoldemEquity/seedRng`，落地 7 archetype + 169 矩阵 + BoardTexture + draws + 结构化决策，并让 TrainingAdvisor 复用同一套。
