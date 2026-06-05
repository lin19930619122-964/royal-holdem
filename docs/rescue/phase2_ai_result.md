# Phase 2 · PokerBrain AI 返工 — 结果报告

> 目标：删除随机/固定概率 Bot；模块化 AI；富输出(含 reason 供复盘)；7 画像；位置/翻前线/手牌分组/牌面/听牌/赔率/SPR/价值-诈唬等概念。
> 结论：**`npm test` 全绿（EXIT=0），无随机 Bot，富输出齐全。** 工程上沿用 `.js`（no-build PWA，理由同 Phase 1）。

## 1. 当前是否仍存在随机 Bot？

**否。** 处置：
- 删除了 `src/ai.js` 中基于 `Math.random()` 阈值选择 fold/call/raise 的 `decide()`（旧概率 Bot），并从 `window.PokerAI` 导出移除。
- 移除 `ui.js` 中 `pl.ai = AI.makePersona(...)` 的赋值（该随机人格只喂给已删除的 decide）。
- 全代码搜索 `\.decide(`：唯一命中是新模块 `PostflopHeuristics.decide`（结构化）。生产决策只剩 `BotDecisionEngine → PokerBrain.decideBotAction`。
- **残留随机仅为「受控且可种子复现」**：诈唬频率 `rng()<bluffFrequency`、下注尺度 ±13% 抖动、思考时长。`seed` 给定时 `decideBotAction` 完全确定（测试 A 已断言「同种子→同决策」）。
- 测试驱动器里的随机（test-engine 的合法行动驱动器、test-adapter 经 BDE）是**测试用例驱动**，非生产 Bot；test-engine 改为确定性种子化合法驱动器，test-adapter 改为经真实 `BotDecisionEngine`。

## 2. 模块结构（拆分，符合「不堆单文件」）

| 文件 | 职责 |
|---|---|
| `core/ai/types.js` | 枚举：6 位置 / 5 手牌分组 / 成牌命名 / 意图 / 风险等级 |
| `core/ai/BotProfiles.js` | 7 画像参数表 |
| `core/ai/BotProfile.js` | 画像取用与校验 |
| `core/ai/PreflopMatrix.js` | 169 手分组 + 位置修正评分 + classifyPreflop |
| `core/ai/BoardTexture.js` | 湿润度/同花/对子/连接性 |
| `core/ai/EquityCalculator.js` | 蒙特卡洛权益 + 听牌分析 + **成牌命名分类** |
| `core/ai/PostflopHeuristics.js` | 翻后决策 + 意图(价值/薄价值/诈唬/半诈唬/抓诈唬/check-raise) + 尺度 + 风险 + 理由 |
| `core/ai/PokerBrain.js` | 总装：输入 DecisionContext → 翻前/翻后 → 富输出 |

加载顺序已接入 `index.html` / `sw.js` / `test-ui.js`。

### 输入 / 输出
- 输入字段：holeCards, board, street, position, stack, effectiveStack, pot, amountToCall(callAmount), currentBet, minRaiseTo(minRaise), lastRaiseSize(lastRaise), playersInHand, activeOpponents, actionsThisStreet, previousActions(actionHistory), legalActions, botProfile, seed。
- 输出字段（实测齐全）：`action{type,amount}`, `amount`, `confidence`, `reason`, `handClass`, `equity`, `potOdds`, `boardTexture`, `riskLevel`, `intent`, `reactionTimeMs`, `features`。

## 3. 每种 Bot 的参数

| 画像 | VPIP | PFR | 攻击性 | 诈唬 | 跟到底 | foldToCbet | 3bet | tilt | 反应(ms) |
|---|--|--|--|--|--|--|--|--|--|
| nit 岩石型 | .14 | .10 | .35 | .03 | .20 | .68 | .05 | .05 | 700–1400 |
| tight_aggressive 紧凶型 | .22 | .18 | .65 | .10 | .38 | .52 | .09 | .08 | 550–1150 |
| balanced_reg 常规 | .26 | .20 | .58 | .12 | .42 | .47 | .10 | .10 | 500–1100 |
| loose_passive 松被动 | .42 | .08 | .22 | .04 | .68 | .35 | .03 | .12 | 450–1000 |
| calling_station 跟注站 | .50 | .06 | .15 | .02 | .82 | .20 | .02 | .15 | 350–950 |
| loose_aggressive 松凶型 | .38 | .29 | .78 | .20 | .50 | .42 | .16 | .22 | 400–1000 |
| maniac 疯狗型 | .60 | .45 | .95 | .32 | .58 | .28 | .26 | .45 | 250–800 |

## 4. 每种 Bot 的典型行动样例（`npm run sim:ai` 实测）

CO 无人入池开 KJs（强牌人人开池，符合扑克逻辑）：岩石/紧凶/常规/跟注站/松凶 ≈ bet 89%、check 11%；疯狗 bet 91%；松被动 bet 83%。
面对加注持 99：跟注站 fold 8% / call 93%（最黏），岩石型 fold 18%（最紧），其余居中。
**画像差异在边缘牌更明显**（`test:ai` 断言）：开池边缘牌 nit 弃牌 > maniac；中等牌面对加注 跟注站 call > nit；主动下注 maniac > nit。

样例复盘理由（生产输出）：
- 翻前 BTN AQs：「BTN 位置，AQs 属于 strong 起手（评分88/100）。前面无人加注，按位置开池范围，意图：翻前开池加注，风险：低。选择加注到 243。」
- 翻牌同花听牌：「手牌=未成牌，同花听牌、组合听牌，权益≈69%，意图：半诈唬，风险：高，选择下注。靠听牌施压，没成牌也有补牌权益。」
- 河牌边缘成牌面对下注：「手牌=顶对(弱踢脚)…意图：过牌跟注/抓诈唬…」（湿面顶对弱踢脚不大额跟注）。

## 5. 已添加的测试 / 模拟脚本

- `src/core/ai/__tests__/poker-brain.test.js`（**28 断言**，接入 `npm run test:ai` 与 `npm test`）：
  A 确定性(同种子同决策=非随机) / B 富输出 9 字段齐全 + reason 非空 / C 7 画像可决策且边缘牌行为有别 / D 位置意识(AA UTG 不弃、72o UTG 极少加注) / E 翻后概念 + handClass 命名 + reason 含意图/风险。
- `src/core/ai/__tests__/sim.js`（`npm run sim:ai`）：各画像行动分布 + 样例理由，人工核查用。
- 既有 `test-bot.js`（17）继续通过；`test-engine.js`、`test-adapter.js` 的驱动器从已删除的随机 `AI.decide` 迁移为「确定性合法驱动器 / 真实 BotDecisionEngine」。
- 全量：规则 85 + AI 28 + 引擎 15(+21k 手 0 不守恒) + 核心 63 + bot 17 + gamefeel 16 + 控制器 37 + 适配器 70 + UI 115 + 联机 35 = **全绿 EXIT=0**。

## 6. 哪些地方仍是启发式，不是 GTO（诚实声明）

- **权重公式是启发式**：fold/call/bet/raise 的权重由 equity/potOdds/SPR/aggression 线性组合 + 画像乘子，不是解出的纳什均衡，也无对手范围反推的最优混合频率。
- **诈唬/价值不平衡**：诈唬靠 `bluffFrequency` 触发，未按「价值:诈唬」理论比例（如河牌 2:1）配平；下注尺度仅按强度/湿润分档 + 抖动，非 GTO 多档混合。
- **对手建模未消费**：`OppModel`(UI 侧记录玩家弃牌率/激进度)尚未喂回 PokerBrain，Bot 暂不针对玩家漏洞做剥削调整（列为 Phase 2 后续/Phase 3）。
- **actionHistory 跨街未用**：`previousActions` 目前在生产桥(BDE)里传空数组，Bot 不读跨街对手线，无法据此收窄范围。
- **check-raise 检测是近似**：靠「本街本人已 check」启发判断，非完整下注树推演。
- **equity 为有限样本蒙特卡洛**（500/翻后，预映射近似），非精确枚举；多人底池权益偏噪声。
- **位置为 6 段语义折叠**：9 人桌 MP/HJ 统一近似，未细分 UTG+1/UTG+2 等。

→ 即：本阶段交付的是**结构化、可解释、可复现、画像化**的强启发式 AI（远胜随机/固定概率），但**明确不是 GTO 求解器**。GTO 化（范围 vs 范围、最优混合频率、剥削引擎）属后续增强。

---
**Phase 2 完成，等确认后进入 Phase 3（TableScene 组件重建）。**
