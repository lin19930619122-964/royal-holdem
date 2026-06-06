# v52 Bug Bash & Stabilization —— 修复结果

> Phase 3/4.2。保持 TableScene/CardSlot/GameFeel/内容层架构，不重构、不加功能。每个修复有复现/根因/修改/测试/回归。

## 9. 测试命令与结果（先放）
```
npm run test:rules     PASS  规则 85
npm run test:ai        PASS  PokerBrain 33 + 对手模型 11
npm run test:gamefeel  PASS  GameFeel 77
npm run test-ui        PASS  UI 225
npm run test:bugbash   PASS  Bug Bash 回归 30（新增）
npm run test-engine    PASS  21k+ 手 0 崩溃/0 不守恒
npm test               EXIT=0
```

## 1. bug 总数
- 自动化排查 + 代码审查共定位 **5** 个：P1 ×3、P2 ×2。
- 真机视觉/时序类未在自动化复现（需你的快照，工具已就位）。

## 2. P0
- 数量 0 / 修复 0 / 未修复 0。（自动化 60 手 + test-engine 21k 手未发现 P0：无崩溃/卡死/筹码错/规则错/非法行动/无法结束。）

## 3. P1
- 数量 3 / 修复 **3** / 未修复 0。

## 4. P2/P3
- P2 记录 2，未处理（按规程不在本轮修）。P3：0。

## 5–7. 每个 bug：根因 / 修改文件 / 回归测试
### BUG#1（P1）桌内弹窗不暂停回合 → 弹窗里被自动弃牌
- **复现**：轮到你→点 ⚙(或退出/快捷语)打开桌内弹窗→不操作等 25s。
- **根因**：`enableHumanControls()` 调 `startTurnTimer()` 设了 25s 的 `_turnTimer = setTimeout(humanAct(check/fold))`；`openTableModal`→`ModalLayer.open` 只调了 `ActionPanel.disableAll()`（禁按钮），**没清 `_turnTimer`**，倒计时继续 → 超时自动行动。
- **修复**：①`openTableModal` 打开即 `hideHumanControls()`（清 `_turnTimer` + 隐藏操作区，弹窗期间回合暂停）；②`tick()` hero 分支加 `currentModalOpen()` 门控（弹窗开着不重新激活/重启计时），关闭由 `resumeAfterModal` 恢复。
- **修改**：`src/ui.js`（openTableModal、tick）。
- **回归**：`test:bugbash` —— 驱动到 hero 回合→`btn-table-menu` 打开→断言 action-area 隐藏 + 回合计时清除 + 弹窗已开。

### BUG#2（P1）复盘入口打开错误手
- **复现**：打完一手→点行动历史「复盘#N」。
- **根因**：HistoryLayer 按钮用 `game.handNo`（每桌从 1 计），而 `openReplay` 在 Store 手牌日志里按 `no`（`Store.nextHandNo()` 全局递增）查找 → ID 体系不一致，定位到错误或不存在的手。
- **修复**：`buildHistoryVM` 增 `replayNo = 当前手的 Store 记录 no`（= 最新一条 `recentHands[0].no`，该手刚在 `tick` 结算时写入）；HistoryLayer 按钮用 `replayNo`；无 `replayNo` 时不出按钮（不指向错误手）。
- **修改**：`src/ui.js`（buildHistoryVM）、`src/view/table/layers/HistoryLayer.js`、`test-ui.js`(P341 契约更新)。
- **回归**：`test:bugbash` —— `replayNo=87/handNo=1` → 按钮 `data-replay-hand="87"` 且不含 `"1"`；无 replayNo → 不出按钮。

### BUG#3（P1）翻前 SPR 显示 1247.9 荒数
- **复现**：翻前轮到你→展开训练详情看 SPR。
- **根因**：`buildTrainingVM` 任何街都算 `chips/pot`；翻前底池极小(只有盲注) → SPR 巨大。SPR 本是**翻后**对底池承诺比的概念，翻前无意义。
- **修复**：仅在 `board.length>=3`(翻后) 计算 SPR，并 `Math.min(99, …)` 封顶；翻前 `spr=null`(不显示)。
- **修改**：`src/ui.js`（buildTrainingVM）。
- **回归**：`test:bugbash` —— 翻前 `trainingVM().spr===null`；翻后(若捕捉到) `spr<=99 && >0`。

### BUG#P2-1 / P2-2（记录未修）
- 训练详情 `expanded` 跨手保持；大额「万/亿」单位显示。按规程仅记录。

## 8. 新增测试 / Debug 能力
- **Debug/Repro 能力**（满足本轮第 1 节要求）：`window.__debugHoldem`
  - `dumpState()` 快照：handId、seed、street、phase、buttonSeat、sbIdx/bbIdx、blinds、stacks、pot、sidePots、board、heroCards、visibleCards、legalActions、currentPlayer、actionHistory、reducerLog、gameFeelEvents、cardSlotStates、modalState、actionPanelState(含 enabled/disabled 原因)。
  - `dumpHandHistory()` / `dumpGameFeelEvents()` / `dumpCardSlots()` / `trainingVM()` / `historyVM()`。
  - `startSeed(seed,cfg)` 固定 seed 复现；`replayHand(handId)` 进复盘；每手 `handId = seed#handNo`。
- **`test-bugbash.js`（新增 `npm run test:bugbash`，30 断言）**：覆盖 BUG#1/#2/#3 回归 + 不变量回归（发牌无重复、对手不泄牌、无残留）+ debug 快照字段齐全 + seed 可复现。已并入 `npm test` 链。

## 10. 仍未修复 / 未覆盖（不隐瞒）
- 你真机发现的具体 bug **未逐一复现**：自动化在 jsdom 跑，无法重现纯视觉/真实时序问题（rAF 飞行动画、CSS 布局、真机触摸节奏）。我修的是**自动化能复现/代码可定位**的 3 个 P1。
- 仍需你的真机快照来定位剩余 bug —— `window.__debugHoldem.dumpState()` 导出后发我，我用 `startSeed` 精确复现再修。
- P2 ×2 记录未修。
- thinking ring / quickWord / gift 残留：自动化未观察到（render 每回合用 SeatView.update 纠正 + popMount 自带定时清理），但未做专门视觉断言 → 归为「需真机确认」。

## 真机回归清单
| 编号 | 场景 | 是否通过 | 备注 |
|---|---|---|---|
| 1 | 连续玩 20 手无卡死 | ✅ | 探针 60 手 crash=false |
| 2 | 连续玩 20 手筹码守恒 | ✅ | test-engine 21k 手 0 不守恒 |
| 3 | 发牌不提前露面 | ✅(逻辑) | CardRow reveal-on-arrival；视觉需真机 |
| 4 | 对手摊牌前不露牌 | ✅ | 探针 0 例泄露 |
| 5 | ActionPanel 不提前激活 | ✅ | 探针 busy 门控；含弹窗门控(BUG#1 修后) |
| 6 | all-in 后自动跑牌 | ✅ | 探针 2 例全下正常摊牌；test-engine |
| 7 | 摊牌逐家 reveal | ✅(逻辑) | test-ui E；视觉需真机 |
| 8 | best5 高亮正确 | ✅(逻辑) | test-ui；视觉需真机 |
| 9 | 派彩后 stack 正确 | ✅ | test-engine 守恒 |
| 10 | 新一手旧状态不残留 | ✅ | 探针 0 例 best5/reveal/dim/foldMask 残留 |
| 11 | modal 不会卡住操作 | ✅ | BUG#1 修复 + test:bugbash 回归 |
| 12 | 快捷语/礼物不残留 | ✅(逻辑) | popMount 定时清理 + 新桌 reset；视觉需真机 |

## 11. 是否建议进入 Phase 5
**不建议**。理由：①你真机发现的多数 bug 属视觉/时序类，未拿到快照前不应判定已稳定；②本轮只修了自动化可定位的 3 个 P1，应等你用 `__debugHoldem` 复测 + 提供剩余 bug 快照，做完第二轮 Bug Bash 后再议 Phase 5；③Phase 5(大厅)会扩大范围、引入新风险，与稳定化目标冲突。
