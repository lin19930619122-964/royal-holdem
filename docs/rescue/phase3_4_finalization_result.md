# Phase 3/4 Finalization Sprint — 结果报告（诚实：A/D 未通过，C 通过）

> 本轮做 A + D + C-emit抽离 + 死代码。**只有 C 达到验收；A、D 仍未通过**，照实写，不谎称完成。`npm test` 全绿（EXIT=0）。

## 13. 测试命令与结果（先放）
```
npm run test:rules     PASS  规则 85
npm run test:ai        PASS  PokerBrain 33 + 对手模型 11
npm run test:gamefeel  PASS  GameFeel 子系统 77（+控制器 emit 覆盖 +CardSlot 管线）
npm run test-ui        PASS  UI 167
npm run test-engine    PASS  21k 手 0 不守恒
npm test               EXIT=0
```

## 1. A / C / D 前后状态对比

| 项 | 修前 | 修后 | 判定 |
|---|---|---|---|
| **C** emit 抽离 | 暂用(emit 源在 ui.js) | **通过** | 新增 4 控制器；ui.js **0 处直接 `GF.emit` GameFeelEvent**(grep 证实)，全部经 `Ctl.deal/showdown/settle/action`(16 调用点)；test:gamefeel 验证 4 控制器 emit 全部 19 类事件 |
| **D** 发牌 | render 到位+幽灵叠加 | **未通过(仅机制)** | 已建 `CardSlot` 状态机(empty/reserved/flying/landed/revealed/dimmed/highlighted) + `CardDealAnimator.dealCard`(reserve→fly→reveal，**飞行前不显示牌面、到达后才注入**)，并 isolation 测试通过。**但未集成进 live**：hole/board/hero 实卡仍是 render 渲染到位 + 幽灵飞行(集成会破坏 deal-in/best5/data-ck 的 DOM 结构，需配套改造，未做) |
| **A** TableScene | 部分(底池/公共牌/庄家) | **未通过(仍部分)** | 仍只有 PotLayer/CommunityCardLayer/DealerButtonLayer/ActionPanelLayer 自渲染；**座位循环、英雄手牌、训练提示、聊天/表情/礼物、历史、Modal 仍在 ui.js**；ui.js 未瘦身(2354→~2360) |

## 2. 新增文件
`src/controllers/{DealController,ShowdownController,SettlementController,ActionController}.js`、`src/gamefeel/CardSlot.js`、`docs/rescue/phase3_4_finalization_result.md`。

## 3. 修改文件
`src/ui.js`(emit→控制器)、`src/gamefeel/CardDealAnimator.js`(+dealCard 管线)、`src/gamefeel/__tests__/gamefeel.test.js`、`src/index.html`、`src/sw.js`、`test-ui.js`、`package.json`(删 test-controller)、`docs/rescue/phase3_4_repair_result.md` 等。

## 4. 删除文件
`src/game/table/TableController.js`、`test-controller.js`（死代码，仅其自身测试引用，已被 GameAdapter 取代）。

## 5. TableScene 最终组件树（现状）
14 Layer 实例(mount/render/update/destroy)。**已自渲染**：PotLayer(底池滚动)、CommunityCardLayer(公共牌+emit DEAL_*)、DealerButtonLayer(定位)、ActionPanelLayer(renderLegal)。**未迁(仍 ui.js)**：SeatLayer/PlayerHandLayer(座位循环+手牌)、TrainingAssistantLayer、ChatEmojiLayer、GiftAnimationLayer、HistoryLayer、ModalLayer 仅挂载占位、无自渲染。

## 6. ui.js 剩余职责（现状）
App 启动/路由/Hall 面板调度(31 面板)、**牌桌座位循环渲染**(render 内 seat loop + SeatView.update)、英雄手牌/胜率/训练提示、聊天/礼物、复盘、控制器调用、stage 注入。**未从牌桌渲染完全退出**。

## 7. 哪些牌桌渲染已从 ui.js 移除
底池(rollPot)、公共牌(board innerHTML + DEAL_* emit)、庄家按钮定位 —— 这三项已移入对应 Layer，ui.js render 经 `TableScene.render(vm)` 委托。**座位/手牌/动作面板装配/训练/社交/历史/Modal 未移除。**

## 8. 各 Layer ViewModel 输入表（已自渲染的）
| Layer | 输入 vm |
|---|---|
| PotLayer | `{pot, potPulse, ctx:{rollPot}}` |
| CommunityCardLayer | `{board, ctx:{renderCard, emit, sfxDeal}}` |
| DealerButtonLayer | `{button, ctx:{SEAT_POS}}` |
| ActionPanelLayer | `{legal}` |
（其余 layer 暂无 vm 输入——未迁。）

## 9. 发牌 CardSlot 状态流转表（机制已实现）
| 状态 | 含义 | 显示 |
|---|---|---|
| empty | 空位 | 无 |
| reserved | 已占位待发 | 占位符(slot-ph)，**不显示牌面** |
| flying | 飞行中 | 飞行牌(幽灵) |
| landed | 到达 | 仍无牌面 |
| revealed | 揭示 | **此时才注入真实牌面** |
| dimmed | 压暗 | 非 best5 |
| highlighted | 高亮 | best5 描金 |
`CardDealAnimator.dealCard({targetSlot,faceHTML,toAnchor,delay,duration,reducedMotion,onArrive,onReveal,onComplete})`：reserve→(fly→到达)→land→reveal(faceHTML)。**机制+测试已实现；未接入 live render。**

## 10. 发牌事件顺序日志
`GF.dealOrderLog()` 输出每张 `{type,cardId,delay,duration,faceUp}`(test 验证 6 座=12 张，逐张 90ms 错开)。门控：`isBusy/onceIdle`，发牌期 ActionPanel `disableAll`。

## 11. 24 个 GameFeelEvent 的 controller / emit / handler 表
| 事件 | controller | handler |
|---|---|---|
| HAND_START/POST_BLINDS/DEAL_HOLE_CARD/DEAL_FLOP/TURN/RIVER(+HERO_PREMIUM) | **DealController** | CardDeal/audio |
| SHOWDOWN_START/REVEAL_HAND/BEST_HAND_HIGHLIGHT | **ShowdownController** | Highlight(压暗/逐家翻/描金) |
| POT_TO_WINNER/HERO_WIN_*/HERO_BAD_BEAT/HERO_GOOD_FOLD/SESSION_SUMMARY/ACHIEVEMENT_UNLOCKED | **SettlementController** | PotWin/audio/横幅 |
| PLAYER_THINKING/FOLD/CHECK/CALL/BET/RAISE/ALL_IN | **ActionController** | ChipFly/Highlight/audio |
ui.js 仅调控制器；test:gamefeel 验证 4 控制器 emit 这些事件经 director。

## 12. 死代码处理结果
- **game.js：保留**。更正此前误判——它**不是死代码**：`mp.js`(联机服务端 WebSocket)`require('./src/game.js')` 复用其引擎跑在线房间。live 牌桌虽用 GameAdapter，但 game.js 仍被联机服务端使用。
- **TableController.js + test-controller.js：已删除**(仅彼此引用，被 GameAdapter 取代)。

## 14. 仍未完成（不隐瞒）
- **A 未通过**：座位循环/手牌/训练/聊天/礼物/历史/Modal 未迁入 layer；ui.js 未从牌桌渲染退出。完整迁移会牵动 render seat loop + 大量测试，本轮未做。
- **D 未通过**：CardSlot 揭示管线机制已实现+测试，但 **live 未集成**——实卡仍 render 到位 + 幽灵飞行。集成需改 .player-cards DOM 结构(slot 包裹)，会破坏 deal-in/best5/data-ck，需配套改造。
- C 通过；死代码 TableController 已删、game.js 保留(联机用)。

**诚实结论：C 通过；A、D 仍未通过(A 部分迁移、D 仅机制未集成)。Phase 3/4 Finalization 未全部通过。** 不进入 Phase 5。
