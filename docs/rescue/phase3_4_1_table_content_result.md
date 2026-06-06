# Phase 3/4.1 — Table Content Layer & Seat Data Sprint 结果报告

> 范围：只补桌内 5 个内容层(Training/Chat/Gift/History/Modal)+ 对手昵称/头像数据。不进 Phase 5、不改大厅、不改 AI、不碰 game.js、不加商业化。全部测试 EXIT=0。

## 12. 测试命令与结果（先放）
```
npm run test:rules     PASS  规则 85
npm run test:ai        PASS  PokerBrain 33 + 对手模型 11
npm run test:gamefeel  PASS  GameFeel 77
npm run test-ui        PASS  UI 225（新增 Phase 3/4.1 段 39 条）
npm run test-engine    PASS  21k+ 手 0 不守恒
npm test               EXIT=0
```

## 1. 新增文件
- `src/view/table/CardRow.js`（上轮）— 本轮无新增源文件；5 个内容层用既有占位文件改写为实装。

## 2. 修改文件
- `src/core/ai/BotProfiles.js`（+IDENTITY 昵称池/头像 emoji + assignIdentities/styleLabelOf/avatarOf）
- `src/view/table/layers/TrainingAssistantLayer.js` / `ChatEmojiLayer.js` / `GiftAnimationLayer.js` / `HistoryLayer.js` / `ModalLayer.js`（占位 → 实装）
- `src/ui.js`（接入对手身份；buildTrainingVM/buildHistoryVM/tableActionLog/posLabelOf/streetLabelOf；render 委托 training/history；删除内联 hand-hint/hand-strip 渲染；sayPhrase/sendGift/maybeChatter 经层；openTableModal；系统礼物触发；按钮接线）
- `src/index.html`（+#btn-table-menu）、`src/styles.css`（+桌内内容层样式）、`src/sw.js`（v52）、`test-ui.js`（+39 断言）

## 3. 删除文件
无。删除的是 ui.js 内联渲染代码路径（hand-hint 拼接、hand-strip 拼接）。

## 4. opponent nickname / avatar 修复说明
- **根因**：reducer-adapter 的 player 代理仅透传 name/avatar，而开桌时从未写入 → SeatLayer 昵称留空、头像走 av-img。
- **数据来源**：`BotProfiles.IDENTITY` 为 7 种画像各配**原创昵称池**（老紧/枪口冷面/按钮位猎手/跟注站/松凶玩家/疯狗玩家/均衡常规…）+ **程序化头像 emoji**（🧊🥶🤓😌🍺😈🤪）。`assignIdentities(archetypes)` 去重分配（同画像多座位不撞名，池用尽加序号兜底）。
- **写入**：`startTable` 把 `nickname→pl.name`、`avatar→pl.avatar`、`styleLabel→pl.styleLabel` 写进 player 数据。
- **消费**：`PlayerViewModel.build` 输出 nickname/avatar/avatarFrameId；`buildSeatVM` 据此给 SeatLayer，**不在 DOM 硬写**；对手 styleLabel 显示在座位 .ptitle（便于学习识别打法）。
- **replay**：`oppShow` 已存 `name: pl.name`（现为昵称）→ 复盘保留昵称。
- 验收：9 人桌每座昵称非空且不重复、头像 emoji 非空、风格标签显示（test-ui 覆盖）。

## 5. TrainingAssistantLayer 输入表 & 展示内容
| 模式 | 触发 | 短提示 | 展开详情 |
|---|---|---|---|
| decision | 轮到你 + coach on | `牌型 · 胜率%` + 建议 + (EV 警示) | 牌型/胜率(赢平输)/底池赔率/SPR/听牌 outs/对手范围胜率/理由/位置 |
| observe | 非你行动 | `昵称（位置）动作 金额` | — |
| summary | 本手结束 | `本手结束 · 净 ±X` | 本手关键评价(summaryDetail) |
输入 `vm.training`（ui.js `buildTrainingVM`，源：handAnalysis(胜率/底池赔率/听牌/范围)、LegalActions/建议、GameState(SPR=stack/pot)、行动日志）。`toggle()` 控制展开；默认只显示一句短提示，不盖牌桌。ui.js 不再渲染训练提示 DOM。

## 6. ChatEmojiLayer 输入表 & 冷却机制
- API：`send(seatEl,seat,text)` / `playEmoji(...)` / `botSay(seatEl,seat,kind)` / `canSend(seat)` / `reset()` / `_setNow`（测试时钟）。
- 原创快捷语 8 句（这手有点意思/跟你看一张/压力给到你/我先过牌/这池子不小/这牌面有点湿/好弃牌/摊牌吧）+ 表情 8 + bot 原创短句池。
- **冷却**：每座位 5000ms（`cd[seat]`）；冷却内 `send` 返回 false（hero 提示“稍等片刻再发”）。
- 气泡经 `SeatView.quickWordBubble`（自带 2.6s 自动消失定时器）；表情经 `emojiMount` 一次性 pop 动画。语音默认关闭、仅文字气泡、不随机鬼叫。新桌 `reset` 清冷却。

## 7. GiftAnimationLayer 输入表 & 动画清理机制
- API：`send(fromSeat,targetSeatEl,giftId)` / `systemTrigger(kind,targetSeatEl)` / `canSend` / `reset` / `_setNow`。
- 原创免费反应 5 种：筹码雨🪙 / 咖啡☕ / 纸飞机✈️ / 掌声👏 / 灯牌🪧（cost=0，仅本地训练，不接充值）。
- **清理**：座位 `giftMount` 经 `SeatView.popMount`（setTimeout 自动移除）；层内 `gift-burst` 元素也 setTimeout 自删。**冷却** 4000ms（送礼方）。
- 系统级反馈（不受玩家冷却）：all-in→筹码雨；big pot(≥40BB)→灯牌；hero big win→掌声。不打断主节奏。

## 8. HistoryLayer 输入表 & 行动格式
- 输入 `vm.history`（ui.js `buildHistoryVM`）：`{handNo, streetLabel, actions[], recentHands[], canReplay}`。
- `actions`：当前手逐条 `{seat,nickname,position(BTN/SB/BB/UTG/MP/CO/HJ),action,amount,amountText,marker}`，取最近 5 条；`tableActionLog` 在 render 的副作用段按 lastAction 变化新增，`emitHandStart` 清空。
- 行格式：`位置标签 昵称 动作 金额`，弃牌/过牌不显金额；all-in→🔥、big pot→💰 标记。
- 一手结束 `canReplay`→`复盘#N` 入口（`data-replay-hand`→`openReplay`）。无当前行动时回落显示近期手净额（hs-item，兼容既有）。ui.js 不再直接渲染桌内历史简条。

## 9. ModalLayer 支持的弹窗列表
独立容器 `#table-modal`（**绝不复用 Hall 的 #modal-overlay**）。`open(kind,data)`/`close()`/`isOpen()`/`kind()`：
1. settings 牌桌设置（教练/音效/快捷语/补充筹码/退出 行）
2. handDetail 手牌详情（html）
3. strategy 策略解释（html）
4. exit 退出确认（onConfirm→回大厅）
5. rebuy 补充训练筹码（onConfirm→加本地训练筹码）
6. summary 本手总结（html）
7. quickword 快捷语 / 表情选择面板（onPick→ChatEmojiLayer.send）
**门控**：`open` 即调 `ActionPanel.disableAll`；`close` 触发 `data.onClose`（ui.js `resumeAfterModal`：轮到你且非发牌期才恢复人控）。入口：⚙ `#btn-table-menu`→settings；`#btn-table-back`→exit 确认。ui.js 不直接拼 table modal DOM。

## 10. ui.js 移出的桌内渲染清单
| 区域 | 迁往 |
|---|---|
| 训练提示(#hand-hint 拼接) | TrainingAssistantLayer(vm.training) |
| 桌内历史简条(#hand-strip 拼接) | HistoryLayer(vm.history) |
| 快捷语气泡 / emojiMount | ChatEmojiLayer（send/playEmoji/botSay + 冷却） |
| giftMount / 礼物动画 | GiftAnimationLayer（send/systemTrigger + 清理） |
| 桌内弹窗 | ModalLayer（独立 #table-modal + 门控） |

## 11. ui.js 剩余职责
- 初始化/路由(hall·table·replay)/Store
- **把 GameState 转成 TableViewModel**：buildSeatVM / buildTrainingVM / buildHistoryVM；维护 tableActionLog（行动日志数据）
- 调 `TableScene.render(vm)`；接收 ActionPanel/用户 action→dispatch 规则层；发牌经 4 控制器
- 桌内交互编排：openTableModal、sayPhrase/sendGift（调层 API）、系统礼物触发、动画副作用(flyChip/flashAllIn)
- Hall 31 面板调度（留待 Phase 5，不在本轮）
> 注：ui.js 行数 2363→2391（+28）。**渲染 DOM 的逻辑全部移入层**，ui.js 增量来自 ViewModel 构建器(buildTraining/HistoryVM)与交互编排(openTableModal/层接线)——属用户许可的「GameState→TableViewModel + 调 render + 接 action」职责。

## 13. 仍未完成内容（不隐瞒）
- ui.js 行数未净减（VM 构建器/交互编排较长）；渲染已全部移出层，但 ui.js 仍承担桌内交互编排（调层 API）。
- ModalLayer 的 handDetail/strategy/summary 提供了通用 html 通道与 open API，但 ui.js 暂只主动接线了 settings/exit/rebuy/quickword 入口；hand 总结目前由 TrainingAssistantLayer summary 模式承载，未强制弹 modal（避免打断）。
- C 保持：`grep -c 'GF.emit(' src/ui.js` = 0（未回退）。
- A（上轮）的牌位/座位迁移保持；本轮新增 5 内容层均有独立 render/update + 命令式 API + 测试覆盖。
- 31 个大厅面板按要求**未迁**（留 Phase 5）。

**结论：5 个桌内内容层(Training/Chat/Gift/History/Modal)实装并接线、对手昵称/头像/风格数据修复，均有 test-ui 覆盖；C 保持。不进入 Phase 5。**
