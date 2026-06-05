# 00 失败成品审计（V4 返工 · Phase 0）

> 只审计，不改功能代码。诚实评估：不把已做对的说成失败，也不把未达 V4 规格的说成完成。
> 审计日期 2026-06-05｜技术栈：**纯前端 PWA（无构建，浏览器直接加载 JS）+ Node 服务端**，非 Cocos/TS。
> V4 规格以 Cocos/TS 描述；本项目按等价分层落地，文件后缀为 `.js`（同结构、可平移 `.ts`）。

## 1. 入口与运行
- App 入口：`src/index.html`（顺序加载 ~30 个 `<script>`）→ `src/ui.js` 末尾 IIFE 启动。
- 本地服务：`server.js`（静态 + WebSocket 多人）；构建：GitHub Actions → 未签名 IPA → TrollStore。
- 当前**可运行**：`npm test` 六套件全绿（引擎15 / 规则核心57 / 控制器37 / 适配器69 / UI87 / 联机35 = 300 断言）。

## 2. 各职责落在哪些文件（事实）
| 职责 | 文件 | 现状诚实评级 |
|---|---|---|
| 牌桌 UI | `src/ui.js`(1968 行单体：buildSeats/render/tick/decorateResult/enableHumanControls/startTable/SNG) + `src/styles.css` | 🟡 功能全但**单体**，非分层组件 |
| 规则核心 | `src/core/poker/`(11 模块 reducer)；`src/game/table/GameAdapter.js`(桥) | ✅ **已对**，权威、可复现、57 测试 |
| 规则(旧) | `src/game.js`(425 行可变式) | ⬜ app 内死代码（仅 test-engine 仍测），待删 |
| 牌型评估(旧) | `src/poker.js` | 🟡 仍被 `ai.js` 依赖；核心已有等价 `HandEvaluator` |
| AI Bot | `src/ai.js`(249 行：MC 胜率+赔率+位置+性格+对手建模) | 🟡 **不是随机**，但不符 V4(无169矩阵/无VPIP-PFR体系/无结构化输出) |
| AI(V4 蓝本) | 外部 `holdem_ai_brain_v4.ts`(未集成) | ⬜ 待移植为 JS 接入 |
| 动画 | `src/fx.js`(flyChip/coinBurst/handCelebration/streakFlame/speechBubble/flyGift/topBanner/rewardPop) + CSS keyframes | 🟡 动画**存在**但散落、由 `ui.js` 内联触发，无中央调度 |
| 音频 | `src/sound.js`(WebAudio合成) / `src/music.js`(bgm) / `src/voice.js`(180 条方言 mp3) | 🟡 **非事件总线**，内联调用；语音包应默认关 |
| 大厅/成长 | `src/ui.js`(openPanel 32 面板) + `src/store.js`(499 行持久化) + `src/skins.js` | 🟡 内容丰富但塞在单体 ui.js |
| 历史/复盘 | `src/store.js`(handLog) + `ui.js`(renderHandLogList/renderHandDetail) | ✅ 有复盘+错误分析+建议对比 |
| 社交/联机 | `src/social.js` / `src/online.js` / `mp.js` / `mpstore.js` | ✅ 多房间/旁观/聊天/好友俱乐部 |
| 路由 | `src/router.js`(SceneRouter 7 场景) | ✅ 统一路由已存在 |
| 节奏/爽感总控 | —— | ⬜ **无 GameFeelDirector**（V4 一票否决项之一的源头） |
| 事件总线 | —— | ⬜ **无 EventBus/AudioManager 事件驱动** |
| 分层座位组件 | —— | ⬜ **无 SeatView/CardView/PotView 独立组件**（座位在 ui.js 内 buildSeats 直接拼 DOM） |

## 3. 必须保留 / 必须重写 / 完全缺失（摘要，详见 04/05）
- **保留**：`src/core/poker/*`（规则核心，V4 §5 已满足）、`GameAdapter`、`store.js`、`router.js`、`social/online/mp*`、测试套件、复盘逻辑。
- **重写/重构**：`src/ai.js`→按 `holdem_ai_brain_v4.ts` 重做（169 矩阵 + 7 archetype + 结构化决策）；`src/ui.js` 牌桌部分→拆为分层 `SeatView/CardView/PotView/ActionPanel/...`；音频→事件驱动 `AudioManager`；动画触发→`GameFeelDirector` 统一调度。
- **完全缺失（标 P0/P1）**：`GameFeelDirector`、`EventBus`、`AudioManager`(事件版)、`BotProfile/PreflopMatrix/BoardTexture/BotDecisionEngine` 结构化模块、分层 TableScene 组件树。
- **删除**：`src/game.js`（迁移完成后）。

## 4. 与 V4「一票否决项」逐条对照（诚实）
| 否决项 | 当前是否触发 | 说明 |
|---|---|---|
| Bot 随机行动 | ❌ 未触发 | ai.js 是 MC 胜率+位置+赔率，非随机；但结构不达 V4 |
| 没有边池 | ❌ 未触发 | `SidePot.js` 已实现并测试 |
| 没有合法行动校验 | ❌ 未触发 | `LegalActions.js` + reducer 校验 |
| 没有 9 人座位组件 | ⚠️ 部分 | 有 9 人布局，但**非独立 SeatView 组件** |
| 没有筹码飞行动画 | ❌ 未触发 | `Fx.flyChip` 有 |
| 没有赢池反馈 | ❌ 未触发 | 飞币/数字/高亮有 |
| 没有复盘 | ❌ 未触发 | 有 |
| 没有训练建议 | ❌ 未触发 | 实时胜率/赔率/范围/建议有 |
| 大厅只有按钮列表 | ❌ 未触发 | 卡片式大厅 |
| 语音随机乱叫 | ⚠️ 注意 | 语音非随机，但默认开+依赖 mp3 包，应改默认关 |
| 牌桌像网页表格 | ❌ 未触发 | 木纹金边椭圆桌、归一化座位 |

## 5. 诚实结论
当前**不是「随机 Demo 失败品」**：规则核心、边池、合法校验、复盘、联机均已达标，AI 是真实 equity-AI。
但相对 **V4 架构与爽感规格**，存在三块**真实结构性缺口**，需返工：
1. **AI 结构化不足**：无 169 手矩阵 / 无 VPIP-PFR 七画像 / 无结构化决策理由 → 按 `holdem_ai_brain_v4.ts` 重写（V4 Phase 2）。
2. **无 GameFeelDirector / 事件总线**：动画与音频散落内联触发，缺「事件→反馈→奖励」统一闭环 → 新建（V4 Phase 4）。
3. **`ui.js` 单体、牌桌非分层组件**：违反「不堆单文件」「分层」 → 拆分（V4 Phase 3）。

V4 Phase 1（规则核心+测试）**实质已满足**；返工重心是 **Phase 2(AI) → Phase 3(分层牌桌) → Phase 4(GameFeel)**。
