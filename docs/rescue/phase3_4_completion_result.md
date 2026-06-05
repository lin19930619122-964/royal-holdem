# Phase 3/4 Completion Sprint — 结果报告（诚实版）

> 本 Sprint 共 9 项（A–I）。**本轮真正完成并测试通过的是 G、C、F；并修正了皮肤数据的事实记录。** 其余 A、B、D、E（完整）、H、I **未完成**，原因见末尾，不隐瞒。
> 工程沿用 `.js`（no-build PWA）。`npm test` 全绿（EXIT=0），下列 5 条命令均通过。

## 0. 测试命令与结果（用户指定 5 条 + 全量）
```
npm run test:rules    PASS  规则 35+22+28
npm run test:ai       PASS  PokerBrain 28 + 对手模型/历史/check-raise 11
npm run test:gamefeel PASS  GameFeel 子系统 45
npm run test-ui       PASS  UI 133
npm run test-engine   PASS  21k 手 0 不守恒
npm test              EXIT=0（14 套件全绿）
```

## 1. 修改文件
- `src/game/table/GameAdapter.js`：暴露 `log`/`street`（跨街历史给 Bot）。
- `src/core/ai/BotDecisionEngine.js`：从 `game.log` 构建跨街 `previousActions`/`actionsThisStreet`，注入 `opponentStats`/`villain`。
- `src/core/ai/PostflopHeuristics.js`：剥削调整（读 villain 的 foldToCbet/WTSD/AF）+ 真实 check-raise 启发式。
- `src/ui.js`：建 `oppModel` 每手 `ingestHand`；AI 决策传 `oppStats` 并存 `lastBotReason`；新增 `rollNumberEl` 实现 `rollSeatStack`；补 emit `REVEAL_HAND`(逐家)/`HERO_GOOD_FOLD`/`ACHIEVEMENT_UNLOCKED`。
- `src/gamefeel/GameFeelDirector.js`：事件序列日志 `getEventLog/printEventLog`。
- `index.html`/`sw.js`(v47)/`test-ui.js`：加载 `OpponentModel.js`。
- `package.json`：`test:ai` 加对手模型测试；新增 `test-ui`/`test-engine` 脚本。
- `styles.css`：`.pchips.stack-rolling`。
- `docs/rescue/00/02/07`：**修正皮肤数量**（实测 backs 57 / felts 29，非旧文档误写的 13/9）。

## 2. 新增文件
- `src/core/ai/OpponentModel.js`（逐对手统计）。
- `src/core/ai/__tests__/opponent-model.test.js`（11 断言 + 100 手自对弈 sim）。

## 3. 删除文件
- 无（死代码 `game.js` 等仍留待后续阶段统一删，避免牵动回归）。

## 4. 各模块实现状态

| # | 模块 | 状态 | 说明 |
|---|---|---|---|
| 2 | Bot AI 接入 | **实现** | 跨街 history + OpponentModel(VPIP/PFR/3bet/foldToCbet/AF/WTSD/showdownHands) + PokerBrain 剥削消费 + 真实 check-raise(价值/半诈唬/干面低频诈唬，受 villain/多人池/画像调制) |
| 6 | GameFeelDirector 事件闭环 | **实现** | 24/24 事件可 emit；新增逐家 REVEAL_HAND、HERO_GOOD_FOLD、ACHIEVEMENT_UNLOCKED；事件序列日志可打印 |
| 10/F | 赢池-座位筹码滚动 | **实现** | `rollSeatStack` 真数字滚动(rAF easeOut)，终值=GameState，test-engine 仍 0 不守恒 |
| 15 | 皮肤数据事实 | **更正** | 实测 57 backs/29 felts，`Skins.backs>30` 测试有效（非造假）；但**换肤接入仍未做**(见下) |
| 3 | TableScene 14 层组件树 | **未完成** | 仍是 `data-layer` 标注，未拆成 14 个独立 layer 模块 |
| 4 | SeatView 节点状态驱动 | **未完成** | PlayerViewModel 未建；avatarFrame/winStreakBadge/trusteeIcon/emoji/gift/quickWord 仍空占位 |
| 5/E | 摊牌完整 best5 + 逐家揭示 | **部分** | REVEAL_HAND 事件已逐家 emit(C 闭环)；但**座位手牌 best5 描金 + 逐家停顿动画 + 牌型文字逐家显示**未做 |
| 7/D | 发牌牌堆锚点飞行 | **未完成** | 仍 deal-in 原地滑入，无 deckAnchor/from-to 轨迹 |
| 14/H | 音频事件扩展 | **未完成** | 仍 ~10 合成音，bet/raise/allin 等未做到逐事件可区分音色 |
| 9/I | 皮肤换肤接入 | **未完成** | cardFace 仍不可换肤(无 classic/neon)；avatarFrame 未接座位；felt/back 实时切换未验证 |

## 5. GameFeelEvent emit 点 / handler（24/24）
| 事件 | emit 文件:点 | handler |
|---|---|---|
| HAND_START/POST_BLINDS/DEAL_HOLE_CARD/HERO_PREMIUM_HAND | ui.js `emitHandStart()` | CardDeal/audio |
| PLAYER_THINKING | ui.js tick(轮到行动者) | Highlight.activeSeat |
| PLAYER_FOLD/CHECK/CALL/BET/RAISE/ALL_IN | ui.js `actSound()` | ChipFly/foldMask/allInFocus/audio |
| DEAL_FLOP/TURN/RIVER | ui.js render(公共牌增长) | CardDeal.revealBoard |
| SHOWDOWN_START | ui.js decorateResult | — |
| REVEAL_HAND | ui.js decorateResult(逐 reveal 座位) | (序列动画待 E) |
| BEST_HAND_HIGHLIGHT | ui.js decorateResult | Highlight.bestHand(公共牌) |
| POT_TO_WINNER/HERO_WIN_SMALL/BIG | ui.js decorateResult | PotWin.award(飞行+发光+rollSeatStack) |
| HERO_BAD_BEAT | ui.js decorateResult(两对+落败) | audio |
| HERO_GOOD_FOLD | ui.js humanAct(面对下注弃且判定正确) | audio/haptic |
| ACHIEVEMENT_UNLOCKED | ui.js 成就领取处 | audio |
| SESSION_SUMMARY | ui.js showSessionSummary(每10手) | — |

## 8. AI actionHistory / OpponentModel 接入说明
- `GameAdapter.log` = reducer 权威事件日志；`BotDecisionEngine` 抽取本手 ACTION→`previousActions`(跨街)+`actionsThisStreet`。
- `OpponentModel.ingestHand(本手 log)` 累积逐座统计；`ui.js` 每手结算调用，AI 决策时传 `oppStats=oppModel.all()`。
- `PokerBrain`/`PostflopHeuristics` 取本街最近进攻者作为 `villain`，据其 foldToCbet/WTSD/AF 调整诈唬/价值/抓诈。
- check-raise：本街已 check + 面对下注 + 可加注时，按 强成牌→价值、强听牌→半诈唬、干面弱牌→低频诈唬，乘 villain/多人池/画像系数。
- **验收**：`opponent-model.test.js` 100 手自对弈 510 决策、跨街 history 存在、stats 合法、reason 含街道/意图；7 画像样例日志见 `npm run sim:ai`。

## 9. 发牌动画事件序列（现状）
emitHandStart → HAND_START → POST_BLINDS → DEAL_HOLE_CARD(seatIndices)；render 阶段 DEAL_FLOP/TURN/RIVER。**仍为原地 deal-in/flip-in，牌堆锚点飞行(D)未做。**

## 10. 摊牌事件序列（现状）
SHOWDOWN_START → REVEAL_HAND×(reveal 座位) → BEST_HAND_HIGHLIGHT → POT_TO_WINNER → (每10手)SESSION_SUMMARY。事件链已闭环且可 `printEventLog` 验证；**逐家停顿动画 + 座位手牌 best5 描金 + 逐家牌型文字(E)未做**。

## 11. 音频事件映射表（现状）
AudioManager 现映射约 21 个事件键到 ~10 个合成音（deal/chip/bet/check/fold/allin/win/lose/reward/button）。**未达"逐事件可区分音色"(H 未完成)**：raise 与 bet 复用 bet 音、card.flip 无独立音、small/big win 同 win 音。

## 12. 皮肤接入表（现状）
| 项 | 数据 | 接入 |
|---|---|---|
| cardBack | 57 套(skins.js) | 牌背渲染已用 activeBack |
| felt 桌布 | 29 套 | 已用 activeFelt |
| avatarFrame | 数据有 | **未接 SeatView** |
| cardFace 主题 | 无 | **未实现 classic/neon** |
程序化皮肤：牌背/桌布为 CSS/程序化；资源皮肤：无（铁律不抄参考）。

## 13. 测试结果
见 §0。新增：对手模型 11、GameFeel 45（+4 事件日志/闭环）、UI 133。

## 14. 仍未完成内容（不隐瞒）
- **A** 14 层未拆成独立组件树。
- **B** PlayerViewModel 未建、约 6 个 SeatView 节点仍空占位。
- **D** 发牌牌堆锚点真实飞行轨迹未做。
- **E** 摊牌逐家停顿揭示 + 座位手牌 best5 描金 + 逐家牌型文字未做（仅事件链闭环）。
- **H** 音频未做到逐事件可区分音色。
- **I** cardFace 换肤(classic/neon)、avatarFrame 接座位、换肤实时生效未做。

**本轮诚实结论：完成 G（AI 实战闭环，根因修复）+ C（24/24 事件闭环+日志）+ F（座位筹码滚动）+ 皮肤数据更正。A/B/D/E/H/I 仍未完成。** 这是一个大 Sprint 的第一批，未全部完成，不谎称完成。请指示是否继续完成 A/B/D/E/H/I（仍不进入 Phase 5）。
