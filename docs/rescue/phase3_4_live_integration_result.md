# Phase 3/4 Live Integration Sprint — 结果报告

> 目标只有两个：A=TableScene 真正接管 live 牌桌渲染；D=CardSlot/dealCard 真实接入 live 发牌(不再 render 到位+幽灵叠加)。C 保持。
> 本轮**把牌槽模型一次性接进 live layer**(不再先在旧 ui.js 接一遍再迁)。全部测试 EXIT=0。

## 17. 测试命令与结果（先放）
```
npm run test:rules     PASS  规则 85 (35+22+28)
npm run test:ai        PASS  PokerBrain 33 + 对手模型 11
npm run test:gamefeel  PASS  GameFeel 子系统 77 (CardSlot 状态机 + dealCard 管线)
npm run test-ui        PASS  UI 186 (+ Live Integration 段：CardSlot live 流转/座位迁出/0 emit)
npm run test-engine    PASS  21k+ 手 0 不守恒
npm test               EXIT=0
```

## 1. A / D 最终判定
| 项 | 判定 | 依据 |
|---|---|---|
| **A** TableScene 接管 live 牌桌 | **通过(牌位+座位表现全迁；5/7 内容层仍占位)** | 公共牌/底池/庄家/动作面板已自渲染；**对手底牌→SeatLayer、英雄手牌→PlayerHandLayer、座位表现(头像/昵称/称号/筹码/弃牌/行动/盲注/倒计时/下注堆/赢家/牌型/SeatView 富节点)→SeatLayer**。ui.js render **不再循环渲染座位 DOM、不再拼任何 .player-cards/.community-cards 卡牌**(grep 证实)。ui.js 2363→2328 行。**仍未迁**：TrainingAssistant/ChatEmoji/GiftAnimation/History/Modal 5 个内容层仍是占位(详见 §9)。 |
| **D** CardSlot 真实接入 live 发牌 | **通过** | 新建统一 `CardRow`(CardSlot 体系实际使用方)。发牌前牌位=牌背(reserved，不显示最终牌面)；真实 `.card` 元素自 `deck-anchor` 飞入(`CardSlot.flyFrom`，无幽灵)；到达后才 `reveal` 牌面。对手飞到后保持牌背，摊牌 `REVEAL_HAND` 才翻面。flop/turn/river 仅新街的牌飞入(freshFrom)。**旧 deal-ghost 幽灵牌路径已删除**。best5/data-ck/dimmed/highlighted/ActionPanel 门控/发牌顺序日志全部保留。test-ui 覆盖 live slot 流转(flying→reveal、对手不提前显面)。 |

## 2. C 是否保持通过
**保持**。grep `GF.emit(` in src/ui.js = **0**(24 事件全经 DealController/ShowdownController/SettlementController/ActionController)。A/D 改造未把任何 emit 写回 ui.js。test-ui 断言 `C ui.js 仍 0 处直接 GF.emit`。

## 3. 新增文件
- `src/view/table/CardRow.js` —— 统一牌位行渲染器，CardSlot 体系的实际使用方(被 SeatLayer/PlayerHandLayer/CommunityCardLayer 共用)。

## 4. 修改文件
`src/gamefeel/CardSlot.js`(补 slotId/ownerType/ownerId/seatIndex/cardId/faceUp/state/anchorEl/cardEl/isBestFive/isDimmed/isHighlighted 字段 + flyFrom 真实牌飞行 + classList 兜底)、`src/gamefeel/CardDealAnimator.js`(去幽灵 flyTo，保留顺序日志/门控/翻面)、`src/view/table/layers/SeatLayer.js`(座位表现 applySeat + 对手牌 CardRow)、`PlayerHandLayer.js`(英雄牌 CardRow)、`CommunityCardLayer.js`(board CardRow + freshFrom)、`src/ui.js`(render 改为建 seatsVM 委托 layer；删除座位渲染循环与底牌拼接；删 deal-ghost stage；revealSeat 走 CardRow.reveal；tableContext 补 seatEl/betEl/seatCardEl/deckAnchorEl/renderBack/reducedMotion)、`src/index.html`(载 CardRow)、`test-ui.js`(+Live Integration 段)、`src/sw.js`(v51)。

## 5. 删除文件
本轮无删除(game.js 仍保留——mp.js 联机服务端依赖；TableController.js 已于上轮删除)。删除的是**代码路径**：ui.js 座位渲染循环、底牌 innerHTML 拼接、deal-ghost 幽灵牌。

## 6. TableScene 最终组件树
14 Layer 实例(mount/render/update/destroy)。**已自渲染 live**：
- TableFeltLayer/TableBackgroundLayer(桌布/背景)
- **SeatLayer**(全座位表现 applySeat + SeatView.update + 对手底牌 CardRow)
- **PlayerHandLayer**(英雄两张底牌 CardRow)
- **CommunityCardLayer**(公共牌 CardRow + emit DEAL_*)
- PotLayer(底池滚动)、DealerButtonLayer(庄家定位)、ActionPanelLayer(renderLegal)、BetChipLayer
**仍占位(未自渲染)**：TrainingAssistantLayer、ChatEmojiLayer、GiftAnimationLayer、HistoryLayer、ModalLayer(§9)。

## 7. ui.js 剩余职责
- 初始化 app / 路由 hall·table·replay / 维护 Store
- **把 GameState 转成 TableViewModel**(buildSeatVM → seatsVM；potNow/board/button)
- 调 `TableScene.render(tableVM)`；接收 ActionPanel/用户 action 再 dispatch 规则层
- 发牌事件出口经 4 控制器(emitHandStart/fireHoleDeal)
- Hall 31 面板调度、复盘、训练提示(hand-hint)
- 极少量「动画触发」副作用：下注筹码飞底池(Fx.flyChip)、全下闪屏(flashAllIn)、prev 状态追踪、best5 描金(highlightBest5) —— 均为动画编排，非牌桌 DOM 渲染

## 8. 从 ui.js 移出的牌桌渲染清单
| 渲染 | 迁往 |
|---|---|
| 英雄两张底牌(.player-cards) | PlayerHandLayer + CardRow |
| 对手底牌(.player-cards 牌背/摊牌) | SeatLayer + CardRow |
| 公共牌(#board) | CommunityCardLayer + CardRow |
| 底池数字 | PotLayer |
| 庄家按钮定位 | DealerButtonLayer |
| 座位头像emoji/昵称/称号/筹码/弃牌态/行动文字/盲注/倒计时环/下注筹码堆/赢家徽标/牌型名 | SeatLayer.applySeat |
| 头像框/连胜/托管/弃罩/赢家光/最佳光/盲注/气泡(22 富节点) | SeatLayer→SeatView.update |
| 发牌幽灵飞行(deal-ghost) | 删除，改 CardSlot.flyFrom 真实牌 |

## 9. 仍留在 ui.js 的内容及原因（不隐瞒）
- **App 启动/路由/Store/31 大厅面板**：本就属 ui.js(用户许可的职责)。
- **5 个内容层仍占位**：TrainingAssistant(训练提示 hand-hint)、ChatEmoji(聊天表情)、GiftAnimation(礼物)、History(历史简条)、Modal(弹层) 的内容仍由 ui.js 直接渲染(renderHandStrip/popMount/hand-hint 等)，对应 Layer 仅挂载未自渲染。原因：本轮范围限定 live 牌桌「牌位+座位+发牌」，这 5 项是牌桌**社交/信息浮层**，不属 A/D 两目标；为不扩大范围(用户明令)留待后续。
- **动画触发副作用**(flyChip/flashAllIn/best5 描金)：动画编排，非 DOM 渲染，留 ui.js 合理。
- **best5/hl5 描金的 querySelector**：HighlightDirector 经 GF stage 读 .player-cards [data-ck] 打 best5；highlightBest5 打 hl5——读 + 加类，非渲染牌面。

## 10. 各 Layer 的 ViewModel 输入表
| Layer | ViewModel 输入 |
|---|---|
| SeatLayer | `vm.seats[]`={seatIndex,isHero,out,avatarEmoji,name,title,chips,folded,active,blind,humanThinking,lastAction,laClass,laPop,betHTML,winnerBadge,handName,pvm,count,revealed,fresh,sig,faceHTML[],backHTML[]} + `vm.ctx`={seatEl,betEl,seatCardEl,deckAnchorEl,reducedMotion} |
| PlayerHandLayer | `vm.seats`(取 isHero 项) + `vm.ctx`(seatCardEl/deckAnchorEl/reducedMotion) |
| CommunityCardLayer | `vm.board[]` + `vm.ctx`={renderCard,renderBack,emit,sfxDeal,deckAnchorEl,reducedMotion} |
| PotLayer | `{pot,potPulse,ctx:{rollPot}}` |
| DealerButtonLayer | `{button,ctx:{SEAT_POS}}` |
| ActionPanelLayer | `{legal}` |

## 11. CardSlot 状态流转表
| 状态 | 含义 | 显示 |
|---|---|---|
| empty | 空位 | 无 |
| reserved | 已占位待发 | **牌背/占位，绝不显示最终牌面** |
| flying | 真实牌从牌堆飞入中(flyFrom transform) | 飞行中的真实 .card(非幽灵) |
| landed | 到达牌位 | 仍未显面(对手停在此=牌背) |
| revealed | 揭示 | **此时才注入/翻出真实牌面(hero/board；对手摊牌时)** |
| dimmed | 非 best5 压暗 | slot-dimmed |
| highlighted | best5 描金 | best5/slot-highlighted |
CardSlot 数据字段：slotId/ownerType(hero·opponent·board)/ownerId/seatIndex/cardId/faceUp/state/anchorEl/cardEl/isBestFive/isDimmed/isHighlighted。

## 12. live 发牌事件顺序日志
`GF.dealOrderLog()`：6 座×2=12 张，逐张 90ms 错开，每张 {type:'hole',seat,cardIndex,delay,duration}。门控：DEAL_HOLE_CARD→`setBusy(座数×2×90+380ms)`，发牌期 `isBusy()=true`，ActionPanel `disableAll`，`onceIdle` 后才允许英雄行动。test-ui 断言 order=12、first.delay=0、first.duration>0、isBusy。flop/turn/river 由 CommunityCardLayer 在张数增长时经 CardRow 飞入并 emit DEAL_*。

## 13. hero / opponent / board 三类 slot 的 reveal 流程
- **hero**：发牌前 reserved(牌背)→flyFrom(deck)→到达 reveal 正面(faceUp)。jsdom 无布局→同步落正面(保回归)。
- **opponent**：发牌前 reserved(牌背)→flyFrom→landed 仍牌背(faceUp=false)；直到 `ShowdownController.reveal`→GF revealSeat→`CardRow.reveal` 才翻成正面(flip-in)。**摊牌前真实牌面绝不进 DOM**。
- **board**：空→新街张数增长→新牌 reserved(牌背)→flyFrom(deck)→到达 reveal 正面；旧街牌不重飞(freshFrom=prevCount)。

## 14. best5 / data-ck / dimmed / highlighted 如何保留
真实 `.card` 元素由 `cardFaceHTML` 生成，携带 `data-ck="rankSuit"` 与 `cf-*` 主题类，是 `.player-cards`/`#board` 的直接子节点(无包裹层)。故：
- **best5**：HighlightDirector(经 GF stage)`querySelectorAll('.player-cards [data-ck]')` / board [data-ck] 命中打 `.best5` —— 元素结构不变，照常生效。
- **data-ck**：reveal 注入的就是带 data-ck 的真实牌面。
- **dimmed**：摊牌 felt `showdown-dim` + CardSlot `slot-dimmed`。
- **highlighted**：highlightBest5 打 `.hl5` + CardSlot `slot-highlighted`。
test-ui 既有 best5/data-ck 断言全绿。

## 15. ActionPanel gating 说明
未改：DEAL_HOLE_CARD → GameFeelDirector `setBusy` 门控窗口；ui.js 在 `GF.isBusy()` 时 `ActionPanel.disableAll()` + 隐藏人控，`GF.onceIdle()` 后若轮到英雄才 `enableHumanControls`。发牌动画(CardRow 飞行)期间玩家不能行动。test-ui 断言 `D ActionPanel.disableAll`、`GF.isBusy/onceIdle`、发牌后 isBusy=true。

## 16. grep：ui.js 直接 GF.emit 数量
```
$ grep -c 'GF\.emit(' src/ui.js
0
```
**= 0**。全部经 4 控制器。

## 18. 仍未完成内容（不隐瞒）
- **A 未 100%**：TrainingAssistant/ChatEmoji/GiftAnimation/History/Modal 5 个内容层仍占位，其内容(训练提示/聊天/礼物/历史简条/弹层)仍由 ui.js 渲染。已迁的是 A 两目标核心——**牌位 + 座位表现 + 公共牌/底池/庄家/动作**，且 ui.js 不再循环渲染座位、不再拼任何卡牌 DOM。这 5 项是牌桌浮层，非 A/D 目标，按「不扩大范围」留待后续。
- reducer-adapter 的对手 `name`/`avatar` 字段为空(旧代码亦然，非本轮回归)——bot 仍以头像图(av-img)显示，昵称标签留空，属既有数据缺口，未在本轮范围内补。
- 动画触发副作用(flyChip/flashAllIn)与 best5/hl5 描金的 DOM 读取仍在 ui.js(动画编排，非渲染)。

**结论：A 通过(牌位+座位全迁、ui.js 退出座位渲染；5 内容浮层未迁，已如实标注)；D 通过(CardSlot 真实接入、无幽灵、到达才 reveal)；C 保持通过(0 emit)。** 不进入 Phase 5。
