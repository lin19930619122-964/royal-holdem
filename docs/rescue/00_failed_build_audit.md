# 00 · 失败成品审计（当前项目源码事实）

> 方法：全部基于 `src/` 源码实读 + `npm test` 实跑，不靠猜。统计时间点：v45 / SW `royal-holdem-v45`。
> 总规模：`src/` 下 JS+HTML+CSS 共 **7456 行**（`find … | wc -l`）。
> （本文件替换了旧版 V4 Phase 0 审计，按新规更具体到文件级。）

## 1. 当前项目入口在哪里？

- 静态入口：`src/index.html`（309 行）。按固定顺序 `<script>` 加载全部模块，最后加载 `src/ui.js`。
- 运行入口：`src/ui.js` 的 IIFE，`init()` → `registerScenes()` → `SceneRouter.go('launch')`。
- 服务端：`server.js`（本地 8099 静态服务，仅托管 PWA + IPA 下载），非游戏逻辑。
- 打包：GitHub Actions `ios-ipa.yml` 把 `src/` 包成无签名 IPA。

## 2. 当前有几个场景？

`SceneRouter.register(...)` 共 **10 个**逻辑场景（实读 `ui.js`）：
`launch, login, hall, select, table, tutorial, replay, strategyLab, handDex, lessons`

⚠️ 关键事实：这 10 个"场景"**不是独立场景树**，而是同一个 `index.html` 内的 DOM `screen-*` 区块 + `modal-panel` 弹层切换。除 `launch/hall/select/table` 外多为「面板」而非场景。参考 IPA 是 4 个真正的 `.fire` 场景（gameLogin/gameHall/gameTable/gameTableNovice），层级差异见 02/03。

## 3. 当前大厅代码在哪些文件？

- `src/ui.js`：大厅与所有面板（`renderPanelHTML`、`openPanel`、`PANEL_TITLES` ~30 个面板 key）全部塞在这 2176 行文件里。
- `src/store.js`（541）：大厅背后的本地经济/成长/任务/赛季/成就数据。
- `src/skins.js`（162）：皮肤数据（57 牌背 / 29 桌布 + 头像框/称号/座驾/手表/场景）。
- `src/social.js`（41）：快捷语/表情/礼物数据。
- **结论**：大厅无独立模块文件，全部寄生在 `ui.js`。

## 4. 当前牌桌代码在哪些文件？

- `src/ui.js`：牌桌渲染（`buildSeats`、`render`、`tick`、`humanAct`、座位/底池/筹码/动作面板）全部在此。
- `src/game/table/GameAdapter.js`（115）：reducer 包装成旧接口，**实盘牌桌实际驱动者**（`startTable` 调它，第 1775 行）。
- `src/game/table/TableController.js`（76）：早期控制器，实盘未走它。
- `src/game.js`（425）：旧可变引擎，**已被 Adapter 取代，但仍在 `index.html`(279) 与 `sw.js`(6) 里加载 = 死代码**。
- `src/poker.js`（120）：牌型/花色工具，UI 仍用。

## 5. 当前规则逻辑在哪些文件？

`src/core/poker/`（reducer 权威核心，纯函数）：
`GameReducer.js`(218)、`TableState.js`(49)、`LegalActions.js`(42)、`HandEvaluator.js`(61)、`HandComparator.js`(25)、`SidePot.js`(57)、`Deck.js`(17)、`Card.js`(25)、`SeededRng.js`(38)、`HandHistory.js`(17)、`types.js`(33)、`selectors.js`(61)、`Equity.js`(39)。
旧规则散落 `src/game.js` + `src/poker.js`（死/半死）。

## 6. 当前 Bot/AI 逻辑在哪些文件？

- `src/core/ai/PokerBrain.js`（292）：V4 脑，169 手矩阵 + 7 画像 + 牌面/听牌/赔率/MC 胜率 + 结构化决策。
- `src/core/ai/BotDecisionEngine.js`（90）：Adapter 状态 → DecisionContext → PokerBrain → 旧 `{action,amount}`。
- `src/ai.js`（249）：旧 persona/读牌（仅留风格文案 `pl.ai = AI.makePersona`，决策已由 PokerBrain 接管）。

## 7. 当前动画逻辑在哪些文件？

- `src/fx.js`（211）：`flyChip/rewardPop/speechBubble/flyGift/streakFlame/topBanner/vibrate` 等程序化特效。
- `src/ui.js`：`rollPot`(底池滚动)、`flashAllIn`(全下闪/压暗)、`deal-in`(逐张发牌)、`renderSidePots` 等内联动画。
- `src/styles.css`（914）：所有 keyframes（`flipIn/dealFly/allinFreeze/feltFlash` 等）。
- `src/services/GameFeelDirector.js`（51）：事件总线 + 音频路由。⚠️ **`onVisual` 视觉执行器：ui.js 注册 0 个**（实测无命中）→ 视觉仍散在 ui.js，未中央化。

## 8. 当前音频逻辑在哪些文件？

- `src/sound.js`（83）：**纯 WebAudio 合成**（`deal/chip/bet/check/fold/allin/win/lose/reward/button` 约 10 个振荡器音），**无任何录制音频文件**。
- `src/services/AudioManager.js`（73）：21 个事件→sfx 映射 + 分类门控 + 语音默认关。
- `src/music.js`（65）：背景音乐（合成）。
- `src/voice.js`（18）：语音壳（默认关，无语音包——用户铁律）。

## 9. 当前本地数据保存在哪些文件？

- `src/store.js`：唯一持久化层，`localStorage` 存一个 profile 对象（金币/钻石/等级/赛季/成就/任务/手牌日志 handLog/统计 st_*/皮肤拥有等，DEFAULT 约 50+ key）。
- `src/codec.js`（52）：兑换码编解码。
- 无服务器存档（`online.js`/`mp.js` 仅对战，不存成长）。

## 10. 哪些文件可以保留？

| 文件 | 判定 | 理由 |
|---|---|---|
| `core/poker/*`（13 文件） | **保留** | reducer 纯函数 + 测试覆盖，规则可信（见 04） |
| `core/ai/PokerBrain.js` + `BotDecisionEngine.js` | **保留** | 结构化决策 + 7 画像（见 05） |
| `core/Lessons.js` | 保留 | 教学数据，已解耦 |
| `store.js` | 保留（需扩展） | 本地数据层可用 |
| `fx.js` / `sound.js` / `music.js` | 保留（需扩展） | 程序化，无版权风险 |
| `services/EventBus/AudioManager/GameFeelDirector` | 保留（需接线） | 骨架对，缺真正接入（见 06） |
| 8 个 `test-*.js` | 保留 | 验收闸门 |

## 11. 哪些文件必须重写？

| 文件 | 判定 | 理由 |
|---|---|---|
| `ui.js`（2176 行） | **必须拆分重构** | 大厅+牌桌+面板+动画+事件全塞一文件，结构性病灶 |
| `game.js`（425 行） | **删除** | 已被 Adapter 取代仍在加载 = 死代码 |
| `ai.js`（249 行） | 收缩/合并 | 决策已交 PokerBrain，仅留风格文案，应并入画像数据 |
| `TableController.js` | 评估删除 | 实盘未走 |
| `styles.css`（914 行） | 拆分 | 与 ui.js 同样过载 |

## 12. 哪些模块完全缺失？

对照成熟产品（02/03/06/07/08），**当前完全没有或仅占位**：
- ❌ 真正的分层 TableScene（14 层）与富 SeatView（22 子节点）——当前 SeatView 仅 7 子节点（见 03，**P0**）。
- ❌ GameFeelDirector 视觉执行器接线（0 个 onVisual）+ 约 14 个已定义事件从未 emit（见 06，**P0**）。
- ❌ 录制级音频体系（参考 187 clip，我方 ~10 合成音）——但语音包/版权音频按铁律**不做**，只扩展合成音（见 08）。
- ❌ 牌桌内社交完整体（旁观/换桌/桌内奖池/礼物动画层）——部分在联机端，单机牌桌缺。
- ❌ 成长系统视觉厚度（参考赛季 101 prefab vs 我方文字面板）——见 07。
- ⚠️ 发牌"飞向座位"是 CSS 滑入近似，非真正从牌堆原点逐张飞行。
