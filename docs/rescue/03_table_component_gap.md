# 03 · 牌桌组件差距（逐项对比）

> 当前牌桌结构实读自 `src/ui.js`（`buildSeats` 的 `seat.innerHTML` 模板 + `render`）与 `src/index.html`（`#screen-table` 内 DOM）。

## A. TableScene 层级对比

成熟 TableScene 应有 14 层。当前 = `index.html#screen-table` 内的扁平 DOM，无真正分层节点树。

| 成熟层 | 当前是否存在 | 当前承载位置 | 判定 |
|---|---|---|---|
| TableBackgroundLayer | 🟡 | `body`/`#screen-table` 背景色 + `bg.png` | 弱 |
| TableFeltLayer | ✅ | `#table-felt`（桌布皮肤） | 有 |
| SeatLayer | ✅ | `#seats`（9 座位） | 有 |
| DealerButtonLayer | 🟡 | `#dealerBtn`（单个 D，绝对定位） | 有但简陋 |
| CommunityCardLayer | ✅ | `#board`（公共牌） | 有 |
| PotLayer | ✅ | `#pot-display`+`rollPot` | 有(滚动) |
| BetChipLayer | 🟡 | 座位内 `bet-tag`+`chipStackHTML` | 散在座位，无独立层 |
| PlayerHandLayer | 🟡 | 座位内 `.player-cards` | 散在座位 |
| ActionPanelLayer | ✅ | `#controls`/`raise-controls` | 有 |
| TrainingAssistantLayer | ✅ | `#hand-hint`(胜率/赔率/听牌) | 有(我方强项) |
| ChatEmojiLayer | 🟡 | `tableChat` 面板 + `speechBubble` | 弹层式，非常驻层 |
| GiftAnimationLayer | 🟡 | `fx-layer` + `flyGift` | 共用特效层 |
| HistoryLayer | ✅ | `tableHistory`/`hand-strip` | 有 |
| ModalLayer | ✅ | `#modal-overlay`/`modal-panel` | 有 |

**层级结论**：14 层中"真正成层"的不足一半，多为扁平 DOM 内联；BetChip/PlayerHand/ChatEmoji/Gift 没有独立层节点，难以做层级动画编排。

## B. SeatView 子节点对比（**P0 严重缺陷**）

当前 `seat.innerHTML` 实际子节点 = **7 个**：
`winner-badge`、`hand-name`、`last-action`、`player-cards`、`avatar(含 turn-ring / av-img / av-emoji / blind-badge)`、`pinfo(含 ptitle / pname / pchips)`。

| 成熟 SeatView 子节点 | 当前是否有 | 当前节点 |
|---|---|---|
| avatar | ✅ | `.av-img`/`.av-emoji` |
| avatarFrame | ❌ | 无头像框节点（皮肤数据有 frames，但座位未挂） |
| nicknameLabel | ✅ | `.pname` |
| stackLabel | ✅ | `.pchips` |
| betAmountLabel | 🟡 | `bet-tag` 文本（非座位固定子节点） |
| betChipStackNode | 🟡 | `chipStackHTML`（在 bet-tag 内） |
| stateLabel | ✅ | `.last-action` |
| timerRing | ✅ | `.turn-ring` |
| dealerButton | 🟡 | 全局单个 `#dealerBtn`，非座位内 |
| blindBadge | ✅ | `.blind-badge` |
| holeCardBack0 / holeCardBack1 | 🟡 | `.player-cards`（一个容器，非两个独立卡位） |
| foldMask | 🟡 | `.folded` class 改透明度，无独立遮罩节点 |
| winnerGlow | 🟡 | `.winner-badge`（是徽标非光晕） |
| bestHandGlow | ❌ | 无（摊牌最佳 5 张高亮在公共牌侧，不在座位） |
| winStreakBadge | ❌ | 座位无连胜徽标（连胜用 streakFlame 全局） |
| trusteeIcon（托管） | ❌ | 无 |
| quickWordBubble | 🟡 | `speechBubble` 临时插入，非座位常驻挂点 |
| emojiMount | ❌ | 无座位表情挂点 |
| giftMount | ❌ | 无座位礼物挂点 |
| chipToPotAnchor | 🟡 | `flyChip` 用座位元素当锚，无专用锚点 |
| chipToWinnerAnchor | 🟡 | `POT_TO_WINNER` 未真正落地动画 |

**判定（P0）**：当前 SeatView 基本只有「头像 + 昵称 + 筹码 + 倒计时圈 + 盲注标 + 动作文字 + 一坨牌」。22 个成熟子节点里，**缺失或仅占位的有 14 个**（avatarFrame / bestHandGlow / winStreakBadge / trusteeIcon / emojiMount / giftMount 等完全没有）。座位是"信息卡片"而非"可被导演驱动的组件"，**标记为 P0 严重缺陷**。

## C. 直接结论

- TableScene 需要从「扁平 DOM」升级为「分层节点 + 锚点系统」，让 GameFeelDirector 能对层/对座位下发动画（见 06）。
- SeatView 需要重建为含 22 子节点（或合理子集）、带固定挂点（emoji/gift/quickWord/chipToPot/chipToWinner）的真正组件，否则牌桌"爽感"无处附着。
