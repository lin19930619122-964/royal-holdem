# Phase 1 · 规则核心返工 — 结果报告

> 目标：规则逻辑与 UI 彻底解耦、全部状态走 reducer、所有行动经 LegalActions 校验、补齐 20 项必需测试。
> 结论：**20 项必需用例全部通过，full `npm test` 全绿（EXIT=0）。可进入 Phase 2。**

## 工程决策（须知）

- 目录建议用 `.ts`，但本项目是 **no-build 纯 JS PWA**（`index.html` 直接加载 `.js`，静态服务并打进 IPA，无编译步骤）。引入 `.ts` 需新建构建管线（超出"规则核心"范围且有破坏部署的风险），且现有 `src/core/poker/*.js` 已是 UI 无关且可测。
- 故**沿用 `.js`**（保留你要求的目录结构与文件职责，仅扩展名为 `.js`）。这是有意的、已说明的取舍，不是偷工。

## 需求逐条达成

| 要求 | 状态 | 证据 |
|---|---|---|
| 1 规则逻辑从 UI 剥离 | ✅ | `grep` 确认 `src/core/poker/*.js` 无 `document/querySelector/innerHTML/Sfx/Fx/GameFeel`；`window` 仅出现在模块导出 shim |
| 2 独立 poker-core 模块 | ✅ | `src/core/poker/` 13 模块 + 新 `__tests__/` |
| 3 状态变化只走 reducer/状态机 | ✅ | 所有筹码/底池/牌堆变更仅在 `GameReducer.js`；新增纯核心 `step()/runOut()` 推进发牌 |
| 4 UI 不直接改筹码/底池/手牌/公共牌 | ✅(核心层) | 核心不暴露可变入口；reducer 输入不被修改(clone)。注：旧 `ui.js` 经 `GameAdapter` 走 reducer；彻底切断散落写法属 Phase 3 拆 UI |
| 5 行动经 LegalActions 校验 | ✅ | `GameReducer.playerAction` 第157行 `if (!Legal.isLegal(...)) return s`；测试覆盖 |
| 6 添加测试(无框架则建最小脚本) | ✅ | 新建 `__tests__/_harness.js` 极简骨架 + 3 个测试文件，接入 `npm test` |

## 新增文件

- `src/core/poker/__tests__/_harness.js` — 极简测试骨架（ok/eq/done，失败退出码非 0）。
- `src/core/poker/__tests__/hand-evaluator.test.js` — 用例 1–12（35 断言）。
- `src/core/poker/__tests__/side-pot.test.js` — 用例 13–17 + 平分（22 断言）。
- `src/core/poker/__tests__/legal-actions.test.js` — 用例 18–20（28 断言）。
- `docs/rescue/phase1_rule_core_result.md` — 本报告。

## 修改文件

- `src/core/poker/GameReducer.js` — 新增并导出 `step(state)`（应用一次 `awaitingDeal` 待发牌步骤，仅当无玩家需行动时）与 `runOut(state)`（全下/无人可行动时把后续街面+摊牌一次跑完，纯核心、不依赖 UI 定时器；带 32 步死循环护栏）。其余规则逻辑未改。
- `package.json` — 新增 `test:rules` 脚本；`test` 前置三套规则测试。

## 删除文件

- 无。（Phase 0 列出的 `game.js`/`ai.js`/`TableController.js` 删除属于 Phase 3 拆 UI 阶段，本阶段不动以免影响回归。）

## 测试命令

```bash
npm run test:rules     # 仅 20 项规则用例
npm test               # 全量 11 套件回归
```

## 测试结果

```
规则·牌型评估:                       35 通过, 0 失败   (用例 1–12)
规则·边池与分配:                     22 通过, 0 失败   (用例 13–17 + 平分)
规则·合法行动/最小加注/全下跑牌:     28 通过, 0 失败   (用例 18–20)
牌型判定(旧 test-engine):            15 通过, 0 失败
随机压力 80 局/21341 手:             崩溃0 / 步数超限0 / 筹码不守恒0
规则核心回归(test-core):             63 通过, 0 失败
V4 Bot 行为:                         17 通过, 0 失败
V4 GameFeel:                         16 通过, 0 失败
Phase2 控制器:                       37 通过, 0 失败
Phase3a 适配器:                      78 通过, 0 失败
UI 回归:                            115 通过, 0 失败
联机服务端:                          35 通过, 0 失败
npm test EXIT=0
```

### 20 项必需用例 → 测试映射

| # | 用例 | 文件·断言 |
|---|---|---|
| 1 | 高牌比较 | hand-evaluator「高牌」 |
| 2 | 一对比较 | 「一对：KK>QQ / 踢脚」 |
| 3 | 两对比较 | 「两对：AA55>KK99」 |
| 4 | 三条比较 | 「三条：KKK>QQQ」 |
| 5 | 顺子比较 | 「顺子：T高>9高」 |
| 6 | A2345 轮子 | 「轮子类别4 / 高牌=5 / 6高>轮子 / 轮子>高牌」 |
| 7 | 同花比较 | 「同花：A高>K高 / 同花>顺子」 |
| 8 | 葫芦比较 | 「葫芦：KKK22>QQQAA」 |
| 9 | 四条比较 | 「四条：KKKK>QQQQ」 |
| 10 | 同花顺比较 | 「同花顺：T高>9高 / >四条」 |
| 11 | 皇家同花顺显示 | 「name=皇家同花顺 / 非皇家显示同花顺」 |
| 12 | 7 选 5 最佳 | 「7张含皇家 / 同花 / 葫芦 / 两对取最高」 |
| 13 | 多人摊牌 | side-pot「3人等额最强通吃」 |
| 14 | 平分底池 | 「平分守恒 / 奇数零头给庄位左手」 |
| 15 | all-in 主池 | 「等额全下→单一主池」 |
| 16 | all-in 边池 | 「短码只赢主池 / 边池给次强」 |
| 17 | 多个边池 | 「三档全下→三层池+池额+可领集合」 |
| 18 | 最小加注规则 | legal-actions「面对BB→200 / 开池→BB / 再加注→700」 |
| 19 | 行动合法性 | 「过牌/跟注/弃牌/全下/capped/短码/弃牌全下坐出无动作」 |
| 20 | all-in 后自动跑牌 | 「runOut→handOver+5张公共牌+筹码守恒2000+有赢家」 |

## 未完成项（诚实列出）

1. **`runOut` 尚未接入实盘 UI**：当前实盘牌桌仍由 `ui.js` 的 `tick→proceed()` 定时器驱动跑牌；本阶段只把"自动跑牌"做成**纯核心可测能力**。把 UI 切到 `runOut`/`step` 属 **Phase 3（拆 UI / TableScene 重建）**。
2. **`HandHistory` 结构化深度仍浅**：完整逐动作 history 的结构断言未补（04 已标"未验证"，本阶段聚焦 20 项硬用例，history 留 Phase 6 复盘强化）。
3. **洗牌均匀性统计检验未做**：仅验证发牌正确性与可复现；卡方/分布均匀性专项未加（低风险，可选补）。
4. **死代码未删**：`game.js`/`ai.js`/`TableController.js` 仍在 `index.html`/`sw.js` 加载，留 Phase 3 删，避免本阶段牵动 UI 回归。

## 下一阶段风险

- **Phase 3 拆 UI 时切 `runOut`**：实盘从定时器跑牌改为核心 `runOut`，需保证动画节奏（逐街揭示）不被"一次跑完"破坏——应在 Adapter 层做"核心算终局、UI 按街补播动画"的分离，否则全下会瞬间结算、伤爽感（与 Phase 4 GameFeel 冲突）。
- **`.js` 无类型**：无 TS 静态检查，靠测试兜底；返工放大代码量时需持续加断言，否则回归盲区扩大。
- **Adapter 双轨**：`GameAdapter`(在用) 与 `game.js`(死) 并存期间，任何"以为改了其实改错文件"的风险——Phase 3 删 `game.js` 前需再确认零引用。
- **Ante/短码重开边界**：已加 isLegal 校验与 cappedToCall 测试，但极端多人多重短码全下的连锁重开仅靠随机压力间接覆盖，建议 Phase 2/3 增定向用例。

---
**Phase 1 完成，等确认后进入 Phase 2（PokerBrain AI 增强）。**
