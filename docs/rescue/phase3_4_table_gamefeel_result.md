# Phase 3 + 4 · TableScene 重建 + GameFeelDirector 爽感系统 — 结果报告

> 结论：**`npm test` 全绿（EXIT=0，14 套件）**。GameFeel 子系统 9 模块全部建成并接入（41 断言）；TableScene 14 层显式化、SeatView 22 子节点、ActionPanel 由 LegalActions 驱动均已落地并被 UI 真实使用（test-ui 133 断言，+18 专项）。
> 工程：沿用 `.js`（no-build PWA；`.ts` 需构建管线，超范围、破坏部署）。模块均独立成文件，未堆进单文件。

## 一、TableScene 组件结构（14 层）→ 对应文件 / DOM

显式化由 `src/view/table/TableScene.js`（`ensure()` 给元素打 `data-layer`，缺失的覆盖层按需创建）。

| 层 | 实现/承载 | data-layer |
|---|---|---|
| TableBackgroundLayer | `#table` | ✅ |
| TableFeltLayer | `#table-felt` | ✅ |
| SeatLayer | `#seats`（内含 SeatView 实例） | ✅ |
| DealerButtonLayer | `#dealer-button` | ✅ |
| CommunityCardLayer | `#board` | ✅ |
| PotLayer | `#pot-display` | ✅ |
| BetChipLayer | `#bet-chip-layer`（新建覆盖层） | ✅ |
| PlayerHandLayer | 座位内 `.player-cards` | ✅ |
| ActionPanelLayer | `#action-area` | ✅ |
| TrainingAssistantLayer | `#hand-hint` | ✅ |
| ChatEmojiLayer | `#chat-emoji-layer`（新建覆盖层） | ✅ |
| GiftAnimationLayer | `#gift-anim-layer`（新建覆盖层） | ✅ |
| HistoryLayer | `#hand-strip` | ✅ |
| ModalLayer | `#modal-overlay` | ✅ |

**SeatView**（`src/view/table/SeatView.js`，每个文件一个组件）：含全部 22 子节点 —
avatar / avatarFrame / nicknameLabel / stackLabel / betAmountLabel / betChipStackNode / stateLabel / timerRing / dealerButton / blindBadge / holeCardBack0 / holeCardBack1 / foldMask / winnerGlow / bestHandGlow / winStreakBadge / trusteeIcon / quickWordBubble / emojiMount / giftMount / chipToPotAnchor / chipToWinnerAnchor。已替换旧 `buildSeats` 内联模板；保留旧渲染依赖类名以零回归。test-ui 已逐项断言关键节点存在。

**ActionPanel**（`src/view/table/ActionPanel.js`）：13 概念控件映射到真实控件（fold/check/call/raise+confirm、quick=allin/min/half/twothird/pot、slider、amountInput、新建 legalActionHint），**`renderLegal(options)` 由 LegalActions 驱动**：非法按钮 `disabled`+`hidden`，合法集合写入并在点击时二次校验 —— UI 不可能发出非法行动。不造假按钮（bet/raise 合并进加注尺度流，已在文件头注明映射）。

## 二、GameFeel 子系统 → 文件

`src/gamefeel/`（说明书要求的 9 模块，均独立）：
GameFeelEvent.js（24 事件+Juice）｜GameFeelConfig.js（每事件 juice/sfx/haptic/时长 + 50BB 大底池阈值）｜TableAnimationQueue.js（串行队列，immediate 同步降级）｜ChipFlyAnimator.js｜CardDealAnimator.js｜PotWinAnimator.js｜HighlightDirector.js｜HapticDirector.js（navigator.vibrate）｜GameFeelDirector.js（中枢：emit→音频(同步)+触觉+视觉(入队)+onVisual+bus）。
接入：`ui.js` 用 `GameFeelDirectorV2.create({audio, stage})` 替换旧瘦director；`buildGameFeelStage()` 注入 DOM 访问器，使各 Animator 真正驱动现有座位/公共牌/底池。

## 三、24 个 GameFeelEvent 处理状态

| 事件 | emit 触发点 | 处理 |
|---|---|---|
| HAND_START | nextHand→emitHandStart | ✅ 音频/节奏 |
| POST_BLINDS | emitHandStart | ✅ |
| DEAL_HOLE_CARD | emitHandStart（带 seatIndices） | ✅ 逐张发牌(CardDeal) |
| HERO_PREMIUM_HAND | 发牌后英雄 AA/KK/QQ/JJ/AK | ✅ 高亮提示 |
| PLAYER_THINKING | 每次轮到行动者 | ✅ 座位光圈/激活 |
| PLAYER_FOLD | actSound | ✅ 弃牌灰罩(foldMask) |
| PLAYER_CHECK | actSound | ✅ 音频/触觉 |
| PLAYER_CALL | actSound | ✅ 筹码飞向底池 |
| PLAYER_BET | actSound | ✅ 筹码飞 |
| PLAYER_RAISE | actSound | ✅ 筹码飞+重音/触觉 |
| PLAYER_ALL_IN | actSound | ✅ 桌面聚焦(flashAllIn)+重触觉 |
| DEAL_FLOP | render 公共牌增长 | ✅ flop 三张依次翻 |
| DEAL_TURN | render | ✅ 单张翻 |
| DEAL_RIVER | render | ✅ 单张翻 |
| SHOWDOWN_START | decorateResult(摊牌) | ✅ |
| REVEAL_HAND | （随 render flip-in 揭示） | 🟡 由 render 翻牌承担，未逐家单独 emit |
| BEST_HAND_HIGHLIGHT | decorateResult(头号赢家最佳五张) | ✅ 公共牌部分高亮+其余压暗(showdown-dim) |
| POT_TO_WINNER | decorateResult | ✅ 底池→赢家飞行+赢家发光+数字 |
| HERO_WIN_SMALL | decorateResult(meWin<40BB) | ✅ |
| HERO_WIN_BIG | decorateResult(meWin≥40BB) | ✅ epic |
| HERO_BAD_BEAT | 英雄持两对+摊牌落败 | ✅ |
| HERO_GOOD_FOLD | — | 🟡 未接（需"弃后判定本可成牌"，留后续） |
| ACHIEVEMENT_UNLOCKED | — | 🟡 事件/音频就绪，未在成就解锁处 emit |
| SESSION_SUMMARY | 每 10 手 showSessionSummary | ✅ |

**22/24 已 emit 并处理**；REVEAL_HAND 由 render 翻牌承担、未独立逐家序列；HERO_GOOD_FOLD / ACHIEVEMENT_UNLOCKED 暂未接 emit 点。

## 四、15 项爽感反馈状态

1 发底牌逐张飞入 ✅(CardDeal+deal-in)｜2 公共牌 flop 三张依次/turn/river 单张 ✅(flip-in 错开)｜3 轮到玩家光圈+操作区亮起 ✅(PLAYER_THINKING→gf-active/turn-ring)｜4 下注筹码飞向下注区 ✅｜5 跟注筹码飞入 ✅(数字弹跳=底池滚动)｜6 加注重音/触觉 ✅（"按钮冲击"为轻量，见缺口）｜7 全下特殊光效+桌面聚焦 ✅(allin-freeze+flashAllIn)｜8 弃牌灰化 ✅(fold-mask；"飞入弃牌区"未做)｜9 摊牌依次亮出 🟡(flip-in 揭示，未严格逐家序列停顿)｜10 最佳五张高亮+其他压暗 ✅(best5+showdown-dim，公共牌部分)｜11 赢池筹码飞向赢家+头像发光+数字滚动 ✅｜12 大底池>50BB 反馈 ✅(bigPotBanner)｜13 英雄大胜额外提示 ✅(HERO_WIN_BIG)｜14 bad beat 复盘提示 ✅(HERO_BAD_BEAT)｜15 每手结束盈亏/牌型/关键行动/策略评价 🟡(已有复盘记录+result-banner+session 小结，未做单手"策略评价卡")。

## 五、仍缺失的动效（诚实）

- **逐家摊牌序列**：当前靠 render flip-in 揭示，未做"一家一家亮、之间停顿"的严格编排（REVEAL_HAND 未逐座 emit）。
- **最佳五张完整高亮**：仅高亮落在公共牌上的部分；座位内英雄/对手手牌的 best5 描金未接（需把 best5 cardKeys 同步到座位卡 DOM）。
- **弃牌飞入弃牌区**：仅灰罩，无"手牌飞走"轨迹。
- **加注"按钮冲击"**：仅重音/触觉，无按钮形变冲击帧。
- **单手结算卡**（行为 15）：盈亏/牌型/关键行动/策略评价的整合面板未做（数据已在复盘/统计里，缺聚合卡片）。
- **HERO_GOOD_FOLD / ACHIEVEMENT_UNLOCKED**：未接 emit 点。
- 发牌"飞行"为原地错开滑入(deal-in)近似，非从牌堆原点真实轨迹（无牌堆锚点）。

## 六、当前无法完成的原因

- **`.ts` 目录**：本项目 no-build，引入 TS 需新建编译/打包管线，属 Phase 8 工程范畴且会动部署链，故沿用 `.js`（结构/职责一致）。
- **真实 Spine/帧动画级表现**：参考用 139 Spine 骨骼；本地训练版按铁律不抄其资源，只能 CSS/程序化近似，精细度天花板低于参考。
- **逐家摊牌/best5 座位描金**：需把摊牌揭示从 render 内联迁移为 GameFeel 编排 + 座位卡 data-ck 同步，属下一步集成（已留接口 onVisual/highlightBest）。
- jsdom 无真实动画时序：动画为 fire-and-forget，测试只能断言"事件路由/DOM 类就位/Animator 被调用"，不能断言像素级时序。

## 七、下一步需要的美术资源清单（自研，不抄参考）

- 牌背/牌面皮肤 SVG（程序化或自绘，6 套起）。
- 筹码精灵图（不同面额配色，自绘 CSS/Canvas）。
- 头像框（普通/稀有/史诗，SVG 描边）。
- 赢家光环 / best5 描金 / 全下聚焦的光效贴图或 CSS 渐变规范。
- 合成音色清单（逐事件可区分：deal/check/call/bet/raise/allin/win/badbeat/premium/收池/连胜，WebAudio 参数，不录人声）。
- 弃牌区/牌堆锚点的版面坐标（用于真实发牌/弃牌飞行轨迹）。
- 表情精灵帧序列（自绘，替代 Spine；非语音）。

---
**Phase 3+4 主体完成，测试通过。等确认后进入 Phase 5（大厅与成长系统）。**
