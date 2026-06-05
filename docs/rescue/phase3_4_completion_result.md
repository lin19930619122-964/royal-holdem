# Phase 3/4 Completion Sprint — 结果报告（A–I 全部完成）

> 9 项（A–I）**全部从「部分实现」补到「实现」并测试通过**。`npm test` 全绿（EXIT=0，16 套件）。下列 5 条指定命令均 PASS。
> 工程沿用 `.js`（no-build PWA）。

## 0. 测试命令与结果
```
npm run test:rules     PASS  规则 35+22+28
npm run test:ai        PASS  PokerBrain 28 + 对手模型/历史/check-raise 11
npm run test:gamefeel  PASS  GameFeel 子系统 45
npm run test-ui        PASS  UI 150
npm run test-engine    PASS  21k 手 0 不守恒
npm test               EXIT=0
```

## 1. 修改文件
`src/ui.js`（SeatView.update 接入 render、PlayerViewModel 驱动空节点、deckAnchor 飞行 stage、best5 板+座位高亮、cardFace 主题、turnTimerPct、cf-class 顺序修复）、
`src/view/table/TableScene.js`（改为装配 14 层）、`src/view/table/SeatView.js`（+update/showBubble/popMount）、`src/view/table/ActionPanel.js`、
`src/gamefeel/CardDealAnimator.js`（牌堆飞行）、`src/gamefeel/GameFeelConfig.js`（REVEAL_HAND/HERO_GOOD_FOLD 音效键）、`src/services/AudioManager.js`（逐事件区分音色映射）、`src/sound.js`（raise/flip/potwin/badbeat/winbig）、
`src/store.js`（activeCardFace + setCardFace）、`src/skins.js`（cardFaces classic/neon）、
`src/index.html`/`src/sw.js`(v48)/`test-ui.js`（加载 + 断言）、`styles.css`（牌面/头像框/发牌飞行/气泡 CSS）。

## 2. 新增文件
`src/view/table/PlayerViewModel.js`、`src/view/table/layers/_base.js` + 14 个 Layer 模块
（TableBackground/TableFelt/Seat/DealerButton/CommunityCard/Pot/BetChip/PlayerHand/ActionPanel/TrainingAssistant/ChatEmoji/GiftAnimation/History/ModalLayer）。

## 3. 删除文件
无（死代码 `game.js` 等仍留待后续阶段统一删，避免牵动回归）。

## 4. 各模块实现状态（A–I）

| # | 模块 | 状态 | 证据 |
|---|---|---|---|
| A | TableScene 组件树 | **实现** | `TableScene.assemble()` 实例化 14 个 Layer，每个有 mount/render/update/destroy；`PotLayer.update({pot})` 实改底池(test 验证)；TableScene.js 不再拼 seat/card HTML |
| B | SeatView 节点状态驱动 | **实现** | `PlayerViewModel.build` + `SeatView.update` 驱动 foldMask/winnerGlow/bestHandGlow/winStreakBadge/trusteeIcon/timerRing/blindBadge/dealerButton/betChipStack/quickWordBubble/avatarFrame；有数据显示、无数据隐藏(test 双向验证) |
| C | GameFeel 事件闭环 | **实现** | 24/24 emit + 逐家 REVEAL_HAND + 事件序列日志(批1) |
| D | 发牌牌堆飞行 | **实现** | `#deck-anchor` + `stage.flyDealCard(toEl,delay)` 真 from/to 轨迹幽灵牌；CardDealAnimator.dealHole/revealBoard 调用，60-120ms 间隔(order×90)；动画结束后才轮到行动(发牌在 emit→render，ActionPanel 在 tick 后) |
| E | 摊牌完整 best5 + 逐家揭示 | **实现** | HandEvaluator.evaluateBest 给每赢家 best5 cardId；`highlightBest` 同时描金公共牌+座位手牌(多赢家各自)，其余 showdown-dim；REVEAL_HAND 按 reveal 顺序逐座 emit |
| F | 赢池座位筹码滚动 | **实现** | `rollSeatStack` rAF easeOut，终值=GameState(批1) |
| G | Bot AI 接入 | **实现** | 跨街 history + OpponentModel + 剥削 + check-raise(批1) |
| H | 音频逐事件区分 | **实现** | sound.js 新增 raise≠bet/flip/potwin/badbeat/winbig；AudioManager 映射 PLAYER_RAISE→raise、REVEAL_HAND→flip、POT_TO_WINNER→potwin、HERO_BAD_BEAT→badbeat、HERO_WIN_BIG→winbig；PLAYER_THINKING 静音(不烦)；音效/语音/震动开关分离 |
| I | 皮肤换肤接入 | **实现** | cardFace classic/neon(程序化) + `Store.setCardFace` 持久化 + 设置面板选择器 + `cardFaceHTML` 即时套用(test 验证实发牌带 cf-类)；avatarFrame 由 SeatView 接 `Store.activeFrame`；back/felt 既有 activeBack/activeFelt 应用 |

## 5. GameFeelEvent emit/handler（24/24）
HAND_START/POST_BLINDS/DEAL_HOLE_CARD/HERO_PREMIUM_HAND ← `emitHandStart`；PLAYER_THINKING ← tick；PLAYER_*(动作) ← `actSound`；DEAL_FLOP/TURN/RIVER ← render；SHOWDOWN_START/REVEAL_HAND(逐座)/BEST_HAND_HIGHLIGHT/POT_TO_WINNER/HERO_WIN_*/HERO_BAD_BEAT ← `decorateResult`；HERO_GOOD_FOLD ← `humanAct`；ACHIEVEMENT_UNLOCKED ← 成就领取；SESSION_SUMMARY ← `showSessionSummary`。handler：CardDeal/ChipFly/PotWin/Highlight/Haptic/AudioManager。

## 6. SeatView 22 节点数据来源（关键）
avatar←p.avatar/头像图；avatarFrame←Store.activeFrame；nicknameLabel←p.name；stackLabel←p.chips；betAmountLabel/betChipStackNode←p.bet；stateLabel←p.lastAction；timerRing←isThinking+timerPercent；dealerButton←i===button；blindBadge←sbIdx/bbIdx；holeCardBack0/1←p.hole；foldMask←p.folded；winnerGlow←winThisHand>0；bestHandGlow←bestKeysBySeat；winStreakBadge←Store.winStreak；trusteeIcon←p.out；quickWordBubble←maybeChatter；emojiMount/giftMount←sayPhrase/sendGift(popMount)；chipToPot/Winner Anchor←定位锚。**无数据节点隐藏。**

## 7. TableScene 组件树
TableScene.assemble() → { layers:{14×LayerInstance}, get/el/render/update/destroy }。每 Layer = `_base.make(name,{id|resolve,onRender,onUpdate})`，独立 mount/render/update/destroy。

## 8. AI actionHistory / OpponentModel
GameAdapter.log（reducer 日志）→ BotDecisionEngine 构建跨街 previousActions/actionsThisStreet + villain；OpponentModel 每手 ingest 统计 VPIP/PFR/3bet/foldToCbet/AF/WTSD/showdownHands；PokerBrain 据 villain 剥削 + check-raise（批1，opponent-model.test 11 + 100 手 sim）。

## 9. 发牌动画事件序列
emitHandStart → HAND_START → POST_BLINDS → DEAL_HOLE_CARD(seatIndices) →(CardDeal) 逐张 `flyDealCard(deckAnchor→座位卡位, order×90ms)`；render 阶段 DEAL_FLOP(3 张依次)/TURN/RIVER 同样 deckAnchor→公共牌位再 flip。

## 10. 摊牌事件序列
SHOWDOWN_START → REVEAL_HAND×reveal座位(逐座, flip 音) → BEST_HAND_HIGHLIGHT(公共牌+各赢家手牌描金, 其余 showdown-dim) → POT_TO_WINNER(飞行+发光+rollSeatStack) →(每10手)SESSION_SUMMARY。

## 11. 音频事件映射表（节选，逐事件可区分）
DEAL_HOLE_CARD→deal｜REVEAL_HAND→flip｜PLAYER_BET→bet｜PLAYER_RAISE→raise｜PLAYER_ALL_IN→allin｜POT_TO_WINNER→potwin｜HERO_WIN_SMALL→win｜HERO_WIN_BIG→winbig｜HERO_BAD_BEAT→badbeat｜PLAYER_THINKING→静音｜ACHIEVEMENT_UNLOCKED→reward。开关：music/sfx_table/sfx_ui/sfx_result/voice 分类 + 语音默认关 + 震动 HapticDirector 独立。

## 12. 皮肤接入表
| 项 | 数据 | 接入 |
|---|---|---|
| cardBack | 57 套 | activeBack 应用 |
| felt 桌布 | 29 套 | activeFelt 应用 |
| avatarFrame | frames | SeatView.update←Store.activeFrame |
| cardFace 主题 | classic/neon(程序化) | cardFaceHTML 即时套用 + 设置面板切换 + 持久化 |
全部程序化/CSS，无参考资源。

## 13. 测试结果
见 §0。UI 150（+17 本轮：14 层接口/PotLayer.update/SeatView 节点双向/cardFace 实发/deck-anchor）。

## 14. 仍未完成 / 限制（不隐瞒）
- jsdom 无布局/像素：发牌飞行、best5 描金、气泡动画的**视觉时序只能真机目测**，自动化只断言「锚点存在/类就位/Animator 被调用/节点据数据显隐」。
- 表现层精细度受铁律限制：不抄参考 139 Spine，全程程序化/CSS，天花板低于参考。
- 死代码 `game.js`/`TableController.js` 仍在(留后续统一删)。
- 单手「结算评价卡」(行为15)聚合面板仍未做（数据在复盘/统计里，缺聚合卡）。

**结论：Phase 3/4 Completion Sprint A–I 全部补到「实现」，测试通过。请验收。未进入 Phase 5。**
