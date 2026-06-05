# Phase 3/4 Repair Sprint — 结果报告

> 只修 A/B/C/D/E/G。`npm test` 全绿（EXIT=0）。5 条指定命令均 PASS。不隐瞒未完成项（见 §12）。

## 11. 测试命令与结果（先放，便于核验）
```
npm run test:rules     PASS  规则 35+22+28
npm run test:ai        PASS  PokerBrain 33 + 对手模型/历史/check-raise 11
npm run test:gamefeel  PASS  GameFeel 子系统 51
npm run test-ui        PASS  UI 167
npm run test-engine    PASS  21k 手 0 不守恒
npm test               EXIT=0
```

## 1. 修改文件
`src/ui.js`、`src/core/ai/PostflopHeuristics.js`、`src/core/ai/PokerBrain.js`、`src/core/ai/BotDecisionEngine.js`、`src/core/ai/__tests__/{poker-brain,sim}.js`、
`src/gamefeel/GameFeelDirector.js`、`src/gamefeel/CardDealAnimator.js`、`src/gamefeel/HighlightDirector.js`、`src/gamefeel/GameFeelConfig.js`、`src/gamefeel/__tests__/gamefeel.test.js`、
`src/services/AudioManager.js`、`src/sound.js`、`src/store.js`、`src/skins.js`、
`src/view/table/SeatView.js`、`src/view/table/ActionPanel.js`、`src/view/table/TableScene.js`、`src/view/table/layers/{PotLayer,CommunityCardLayer,DealerButtonLayer}.js`、
`src/index.html`、`src/sw.js`、`styles.css`、`test-ui.js`、`package.json`、`docs/rescue/phase3_4_completion_result.md`(改回真实状态)。

## 2. 新增文件
`src/core/ai/HandClassDescriber.js`、`BoardTextureDescriber.js`、`ActionHistoryFormatter.js`、`DecisionReasonFormatter.js`、`docs/rescue/phase3_4_repair_plan.md`、本报告。

## 3. 删除文件
无。

## 4. A/B/C/D/E/G 前后状态对比

| 项 | 修前 | 修后 | 关键改动 |
|---|---|---|---|
| A TableScene | 未实现(薄壳贴标签) | **部分实现** | 底池/公共牌/庄家 渲染**迁入** PotLayer/CommunityCardLayer/DealerButtonLayer 的 `render(vm)`；ui.js render **委托 `TableScene.ensure().render(vm)`**（注入 ctx 渲染器）。**仍未迁**：座位循环(经 SeatView)与 31 个面板仍在 ui.js；ui.js 行数未净减(2319→2354) |
| B SeatView | 部分(2 空占位+4 缺陷) | **实现** | emoji/giftMount 接 `popMount`(sayPhrase/sendGift)；avatarFrame 修 `'none'` truthy bug；winStreak 改逐座 `seatWinStreak`；quickWord 英雄接 SeatView 气泡；dealerButton 去重(桌级单一) |
| C GameFeelDirector | 部分(handler 13/24) | **实现** | `dispatchVisual` 补 SHOWDOWN_START/REVEAL_HAND/ACHIEVEMENT 等 → **24/24 有 handler 或显式 silent**；事件队列；摊牌/派彩**不再 render 瞬刷**(见 E)。注：emit 点仍在 ui.js，未抽独立 Controller 类(达成验收标准，但非理想控制器架构) |
| D 发牌动画 | 部分/装饰 | **实现** | `#deck-anchor` + `seatCardAnchor`/`communityCardAnchor` 命名锚点；`dealHoleCards/dealFlop/dealTurn/dealRiver` + from/to/delay/duration/onComplete + 顺序日志；**ActionPanel 被 GameFeelDirector 门控**(`isBusy/onceIdle`，发牌期 `disableAll`，完成后激活) |
| E 摊牌高亮 | 部分(逐家假) | **实现** | 对手手牌仅 `REVEAL_HAND` 事件**逐家翻开**(`revealedSeats`，render 不再全亮)；队列延时**真 stagger**；best5 **板+座位**描金，多赢家各自；`HandClassDescriber` 输出 best5 的 hole/board 拆分+牌型名+踢脚 |
| G AI 解释 | 决策实现/解释不足 | **实现** | 新增 4 describer；handClass 细粒度(`top_pair_good_kicker` 等)；boardTexture(`rainbow dry q-high disconnected`)；reason 含 street/position/handClass/kicker/texture/equity/potOdds/SPR/actionHistory/intent/尺度；check-raise 启发式 |

## 5. TableScene 新组件树
`TableScene.assemble()` → 14 个独立 Layer 实例(各 mount/render/update/destroy)。`render(vm)`/`update(vm)` 遍历转发。**底池/公共牌/庄家/动作合法** 已由各自 Layer 的 `onRender(el, vm)` 真渲染（PotLayer.rollPot、CommunityCardLayer 渲染 board 并 emit DEAL_*、DealerButtonLayer 定位、ActionPanelLayer 调 renderLegal）；ui.js render 注入 `ctx={renderCard,rollPot,SEAT_POS,emit,sfxDeal}`。座位经 SeatLayer→SeatView。

## 6. SeatView 22 节点数据来源表（修后，全部有来源/显隐）
avatar←p.avatar；avatarFrame←`Store.activeFrame`(none→隐)；nicknameLabel←p.name；stackLabel←p.chips；betAmountLabel/betChipStackNode←p.bet；stateLabel←p.lastAction；timerRing←isThinking+timerPercent；blindBadge←sbIdx/bbIdx；holeCardBack0/1←p.hole；foldMask←p.folded；winnerGlow←winThisHand>0；bestHandGlow←bestKeysBySeat；winStreakBadge←`seatWinStreak[i]`(逐座)；trusteeIcon←p.out；quickWordBubble←sayPhrase/maybeChatter(自动消失)；emojiMount←sayPhrase→popMount(一次性)；giftMount←sendGift→popMount(一次性)；chipToPot/WinnerAnchor←定位锚。dealerButton 改为桌级 `#dealer-button`(DealerButtonLayer，去重)。**无数据→隐藏**(test 双向验证)。

## 7. 24 个 GameFeelEvent emit/handler 表
emit 点(ui.js)：HAND_START/POST_BLINDS←emitHandStart；DEAL_HOLE_CARD/HERO_PREMIUM←fireHoleDeal(render 后)；PLAYER_THINKING←tick；PLAYER_*←actSound；DEAL_FLOP/TURN/RIVER←CommunityCardLayer；SHOWDOWN_START/REVEAL_HAND(逐座)/BEST_HAND_HIGHLIGHT/POT_TO_WINNER/HERO_WIN_*/HERO_BAD_BEAT←decorateResult；HERO_GOOD_FOLD←humanAct；ACHIEVEMENT_UNLOCKED←成就领取；SESSION_SUMMARY←showSessionSummary。
handler(GameFeelDirector.dispatchVisual)：发牌/翻牌→CardDeal；动作→ChipFly/Highlight；SHOWDOWN_START→压暗；REVEAL_HAND→逐家翻牌(队列 stagger)；BEST_HAND_HIGHLIGHT→描金；POT_TO_WINNER→PotWin；ACHIEVEMENT→横幅；HERO_GOOD_FOLD/SESSION_SUMMARY/HAND_START 等→**显式 silent**(仅音频/触觉/面板)。**24/24 覆盖**。

## 8. 发牌锚点与门控
锚点：`#deck-anchor`(起点)、`seatCardAnchor(i)`=座位 `.player-cards`、`communityCardAnchor()`=`#board`。每张 from=deck/to=anchor/delay=idx×90ms/duration=320ms/onComplete。门控：`DEAL_HOLE_CARD` → `GameFeelDirector.setBusy(张数×90+380)`；ui.js tick 中人类回合若 `GF.isBusy()` → `ActionPanel.disableAll()` + `GF.onceIdle(enableHumanControls)`，动画完成才激活。`GF.dealOrderLog()` 输出发牌顺序(test 验证 6 座=12 张)。

## 9. 摊牌事件序列
SHOWDOWN_START(压暗) → REVEAL_HAND(seat0,延时) → REVEAL_HAND(seat1) → REVEAL_HAND(seat2)… (队列 280ms stagger，逐家翻开+牌型文字) → BEST_HAND_HIGHLIGHT(板+各赢家手牌 best5 描金，其余压暗) → POT_TO_WINNER(飞行+发光+rollSeatStack) → (每10手)SESSION_SUMMARY。对手手牌在 REVEAL_HAND 前为背面（render 据 `revealedSeats`，不再瞬间全亮）。

## 10. AI reason 样例日志（含 AsQs/Qh7d2c）
```
HandClass: top_pair_good_kicker   BoardTexture: rainbow dry q-high disconnected   Decision: bet 208 (value)
Reason: CO 翻牌在彩虹 干燥 Q 高 不连接击中顶对好踢脚，SPR 5.8，权益约 79%。当前无人下注，
适合用约半池下注从更差成牌、口袋对子获取价值，同时保护权益。此前 BTN 翻前跟注、BB 翻前跟注，
翻前有玩家平跟，范围中有较多弱顶对牌、口袋对子和连接牌。
```
7 种 Bot × 20 手完整样例：`npm run sim:ai`（每条含 position/handClass/boardTexture/SPR/equity/potOdds/intent/risk，第 5 手打印完整 reason）。

## 12. 仍未完成 / 限制（不隐瞒）
- **A 仅部分**：只迁了底池/公共牌/庄家(+动作合法)到 layer；**座位循环(SeatView 更新)与 31 个大厅面板仍在 ui.js**；ui.js 行数未净减(2319→2354，因 B/C/D/E 新逻辑)。完整迁移(座位/面板进 layer、ui.js 大幅缩减)未做。
- **C 无独立 Controller 类**：24/24 handler + 队列达成，但 emit 仍源于 ui.js 函数，未抽 DealController/ShowdownController 等(你理想表中的架构)。
- **D 真牌 vs 幽灵**：牌仍由 render 渲染到位 + 幽灵牌飞行叠加；未做"真牌从牌堆飞入、落位前隐藏"。门控/锚点/顺序已实现。
- jsdom 无布局：飞行/描金/stagger 的像素时序仍只能真机目测，自动化断言锚点/类/handler 调用/节点显隐/事件顺序。
- 死代码 `game.js`/`TableController.js` 仍在。

**结论：B/C/D/E/G 已补到「实现」并测试覆盖；A 为「部分实现」(核心牌桌元素已迁 layer，座位/面板未迁)。请验收。未进入 Phase 5。**
