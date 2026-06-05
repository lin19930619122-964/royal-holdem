# 04 · 规则算法差距（逐项 + 测试覆盖判定）

> 依据：`src/core/poker/*` 实读 + `npm test` 实跑（test-engine 随机压力 80 局/21341 手：崩溃 0 / 步数超限 0 / **筹码不守恒 0**；test-core 63、test-bot 17、test-adapter 78）。
> 判定：✅ 实现且有测试 ｜ ✅* 实现但无专项测试=**未验证** ｜ 🟡 实现但 UI 驱动/偏弱 ｜ ❌ 缺。

| 规则项 | 代码位置 | 实现 | 测试覆盖 |
|---|---|---|---|
| 52 张牌 | `Deck.js` 4花×rank2–14 | ✅ | ✅(core/engine) |
| Fisher-Yates 洗牌 | `Deck.shuffled→rng.shuffle` | ✅ | ✅*（洗牌均匀性无专项统计测试=**未验证**，但发牌正确性被覆盖） |
| 可复现随机种子 | `SeededRng`(mulberry32) | ✅ | ✅(bot 用种子复现) |
| 2–9 人 | `TableState.numPlayers` + 单挑特例 | ✅ | ✅(6/9 桌 UI + core) |
| Button / SB / BB / Ante | `GameReducer` 104–116 | ✅ | ✅(core)；Ante 路径 **未验证**(测试少触发) |
| 翻前/翻牌/转牌/河牌/摊牌 | `DEAL_FLOP/TURN/RIVER`+`SHOWDOWN` | ✅ | ✅(engine 全流程) |
| fold/check/call/bet/raise/all-in | `GameReducer` 161–167 | ✅ | ✅(core/adapter) |
| 合法行动校验 | `LegalActions.isLegal` | ✅ | ✅(adapter 78) |
| 最小加注规则 | `minRaiseTo = currentBet + max(lastRaiseSize,BB)` | ✅ | ✅(core) |
| 短码全下不重开下注(cappedToCall) | `LegalActions` 22 + reducer | ✅ | ✅*（有逻辑，专项 reopen 边界测试**部分未验证**） |
| 有效筹码 | `maxRaiseTo` 受 stack 限 + BotDecisionEngine.effectiveStack | ✅ | ✅(adapter) |
| all-in 后自动跑牌 | 🟡 由 UI `tick→proceed()` 定时推进，非纯 reducer | 🟡 | ✅*（功能可跑，**架构上是 UI 驱动**，无 reducer 层 runout 测试=未验证） |
| 主池 | `SidePot.compute` layer0 | ✅ | ✅(core) |
| 边池 | `SidePot.compute` 分层 | ✅ | ✅(core) |
| 多边池 | 分层 + 合并同 eligible | ✅ | ✅(core 多人 all-in 用例) |
| 多赢家平分 | `SidePot.distribute` 零头给庄位左手 | ✅ | ✅*（平分覆盖；**奇数零头分配方向专项测试未验证**） |
| 7 张取最佳 5 张 | `HandEvaluator.evaluateBest` | ✅ | ✅(core) |
| A2345 轮子顺 | `HandEvaluator`(注释明示支持) | ✅ | ✅*（**专项 wheel 测试未确认**=未验证） |
| 皇家同花顺显示 | `HandEvaluator` score[1]===14 同花顺最高 | ✅ | ✅*（**专项 royal 测试未确认**=未验证） |
| 完整 hand history | `HandHistory.js`(17 行结构日志) + store.handLog | 🟡 | ✅*（handLog 被复盘 UI 用；**逐动作完整 history 的结构化测试薄**=未验证） |

## 结论

- 规则**主干扎实**：随机压力 21341 手 0 不守恒，是当前项目最可信的部分（与 00 的"保留 core/poker"一致）。
- **标记为未验证（必须补测试）**：洗牌均匀性、Ante 路径、cappedToCall 重开边界、奇数零头分配方向、A2345、皇家同花顺、完整 hand history 结构。
- **架构待修**：all-in 自动跑牌目前靠 UI 定时器 `proceed()`，应下沉为 reducer 能力（纯逻辑可测），否则"规则独立于 UI"未彻底。
