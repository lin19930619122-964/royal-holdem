# v52 Bug Bash —— 缺陷登记

> 说明：你真机发现「很多 bug」但未给清单/快照。本轮先建可复现的 Debug 能力(`window.__debugHoldem`)，再用自动化探针(jsdom 驱动真实 UI 连打 60 手、含 18 摊牌 / 2 全下) + 代码审查系统排查。
> 自动化探针**对一整类 P0/P1 给出了实测结论**（见下「已验证干净」），并定位修复了 3 个 P1。**视觉/动画时序类**需要你的真机快照来精确定位（工具已就位）。

## 缺陷表
| ID | 优先级 | 模块 | 现象 | 复现步骤 | 期望 | 实际 | 怀疑文件 | 状态 |
|---|---|---|---|---|---|---|---|---|
| BUG#1 | **P1** | ModalLayer/回合(I·B) | 轮到你时打开桌内弹窗(⚙/退出/快捷语)，弹窗只禁用了按钮，**回合 25s 倒计时仍在跑**，到点在弹窗里被自动过牌/弃牌 | 轮到你→点 ⚙ 打开设置→等 25s | 弹窗期间回合应暂停 | `enableHumanControls`→`startTurnTimer` 的 `_turnTimer` 未被清除，超时触发 `humanAct(check/fold)` | ui.js(openTableModal/tick) | **已修** |
| BUG#2 | **P1** | HistoryLayer/Replay(G) | 桌内历史简条「复盘#N」入口打开**错误或不存在的手** | 打完一手→点行动历史里的「复盘#N」 | 打开该手复盘 | 按钮用 `game.handNo`(每桌从 1)，而 `openReplay` 按 Store 记录 `no`(全局递增 `nextHandNo`)查找 → 不匹配 | ui.js(buildHistoryVM) / HistoryLayer.js | **已修** |
| BUG#3 | **P1** | TrainingAssistant(F) | 训练助手详情里 **SPR 显示成 1247.9** 这种荒数 | 翻前轮到你→展开训练详情看 SPR | SPR 是翻后概念，翻前不应显示 | `buildTrainingVM` 翻前也算 `chips/pot`，底池极小 → 巨数 | ui.js(buildTrainingVM) | **已修** |
| BUG#P2-1 | P2 | TrainingAssistant | 展开详情后 `expanded` 状态跨手保持(下手仍展开) | 展开→下一手 | 可接受/按需重置 | 模块级 `expanded` 不随手重置 | TrainingAssistantLayer.js | 记录(本轮不修) |
| BUG#P2-2 | P2 | 数值显示 | 大额筹码用「万/亿」单位，复制/解析时易误读 | — | — | fmtChips 单位显示(设计如此) | ui.js | 记录(本轮不修) |

## 已验证干净（自动化探针 60 手 + test-engine 21k 手实测，非目测）
| 类别 | 检查项 | 结论 |
|---|---|---|
| A 发牌/CardSlot | 引擎牌不重复(每手所有手牌+公共牌唯一) | ✅ 0 例 |
| A 发牌/CardSlot | DOM 可见牌不重复 | ✅ 0 例 |
| A 发牌/CardSlot | 对手摊牌前不泄露正面牌(无 `.seat-revealed` 时无 `data-ck`) | ✅ 0 例 |
| A/E 残留 | 新手翻前不残留 best5 / hl5 / seat-revealed / showdown-dim / 全员 foldMask | ✅ 0 例 |
| D 规则核心 | 21k 手 0 崩溃 / 0 步数超限 / 0 筹码不守恒 | ✅ test-engine |
| D 规则核心 | 牌型/边池/A2345/最小加注/全下跑牌 | ✅ test:rules 85 |
| 流程 | 连打 60 手无卡死、每手能结束、hero 合法行动被接受 | ✅ 探针 |

## 优先级定义
- P0：卡死/崩溃/无法继续/筹码错误/规则错误/行动非法/牌局无法结束 —— **本轮自动化未发现 P0**。
- P1：明显影响体验（动画错位/按钮状态错/摊牌错/历史错/提示错/弹窗挡操作）—— 找到并修复 3 个。
- P2：视觉瑕疵/文案/轻微不自然 —— 记录 2 个，不在本轮修。
- P3：优化建议 —— 无。

## 仍需你的真机快照来定位（工具已就位）
自动化在 jsdom 跑，**无法复现纯视觉/真实时序 bug**（rAF 飞行曲线、CSS 布局、真机触摸时序）。你真机再遇到 bug 时：
1. 在 Safari 控制台执行 `window.__debugHoldem.dumpState()` 导出当前手快照（含 handId/seed/街道/筹码/底池/边池/公共牌/手牌/合法行动/卡槽状态/弹窗态/ActionPanel 态）。
2. 或 `dumpGameFeelEvents()` / `dumpCardSlots()` 看事件序列与卡槽流转。
3. 把快照 + 你看到的现象发我，可用 `startSeed(seed)` 精确复现该手再修。
