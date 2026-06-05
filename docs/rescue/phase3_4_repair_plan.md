# Phase 3/4 Repair Plan

> 只修 A/B/C/D/E/G。不做大厅、不做新功能、不换背景、不加语音包。

| 项 | 当前问题 | 要改的文件 | 验收标准 |
|---|---|---|---|
| **A** TableScene | 14 layer 是薄壳贴 data-layer；HTML 全在 ui.js；ui.js 反增到 2319 行 | `view/table/layers/*.js`(14)、`view/table/TableScene.js`、`view/table/SeatView.js`、`ui.js` | TableScene.js 不再大段拼 seat/card/chip/action HTML；每 layer 有 render/update/destroy + 明确输入数据；ui.js render 委托给 TableScene.render(vm)；test-ui 测 layer 实例+关键 DOM 结构 |
| **B** SeatView | emoji/giftMount 空占位；avatarFrame none-bug；winStreak 仅英雄；quickWord 仅 bot；dealerButton 重复 | `view/table/SeatView.js`、`view/table/PlayerViewModel.js`、`ui.js` | 22 节点全有数据来源；无数据隐藏；emoji/gift 一次性占位动画；avatarFrame 接皮肤(none→不显)；winStreak 接逐座连胜；quickWord 双向+自动消失；dealerButton 去重；test-ui 覆盖 quickWord/avatarFrame/timerRing/winnerGlow/bestHandGlow/blindBadge/dealerButton |
| **C** GameFeelDirector | handler 13/24；无控制器；摊牌/派彩靠 render | `gamefeel/GameFeelDirector.js`、`gamefeel/*Animator.js`、`ui.js` | 24/24 emit+handler(或显式 silent)；事件队列；摊牌不靠 render 全亮；派彩不直接刷新；test:gamefeel 覆盖 24 事件 |
| **D** 发牌动画 | 无锚点；不门控 ActionPanel；真牌瞬现+幽灵叠加 | `gamefeel/CardDealAnimator.js`、`view/table/SeatView.js`、`index.html`、`ui.js` | deckAnchor + seat.cardAnchor + communityCardAnchor；每张牌 from/to/delay/duration/onComplete；ActionPanel 被 GameFeelDirector 门控(动画期间禁用，完成后激活)；debug log 输出发牌顺序+门控 |
| **E** 摊牌高亮 | 逐家揭示假；同步 emit 无延迟 | `core/poker/HandEvaluator.js`、`gamefeel/HighlightDirector.js`、`gamefeel/GameFeelDirector.js`、`ui.js` | Result 输出每家 bestFiveCards(分 hole/board)+handRankLabel+kickerInfo；逐家 reveal 真实延迟；赢家 hole+board best5 描金；多赢家各自高亮；test 覆盖 REVEAL_HAND 顺序 |
| **G** AI 解释 | handClass 无 kicker；texture 只"彩虹面"；SPR/history 不进 reason；A 误描述"1 张高张" | 新增 `core/ai/HandClassDescriber.js`/`BoardTextureDescriber.js`/`DecisionReasonFormatter.js`/`ActionHistoryFormatter.js`、`core/ai/PostflopHeuristics.js`、`PokerBrain.js` | 细粒度 handClass(top_pair_good_kicker 等)；texture(rainbow dry q-high disconnected)；reason 含 street/position/handClass/kicker/texture/equity/potOdds/SPR/actionHistory/intent/sizing；AsQs/Qh7d2c→top_pair_good_kicker + rainbow dry q-high disconnected；7 bot×20 手 log |

执行顺序：G(纯逻辑可测) → B(节点修复) → E+C(摊牌/事件) → D(发牌门控) → A(render 迁移)。每步跑测试。
