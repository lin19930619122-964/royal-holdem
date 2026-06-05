# 当前项目审计（皇室德州 / royal-holdem-mobile）

> 事实审计：工程分层、代码量、模块、屏幕/面板、规则核心、联机、测试、构建。诚实标注 已实装 / 半实装 / 占位。
> 审计对象：`/Users/linlin/cc 工作站/royal-holdem-mobile/`（源码，非 IPA）。
> 审计日期：2026-06-05（项目已历经 40 次提交、SW v39，较初版大幅演进）。

---

## 1. 工程分层

### 1a. 运行中的牌桌引擎（现行，单机 UI 使用）
| 层 | 文件 | LOC | 职责 |
|---|---|---|---|
| 规则 | `src/poker.js` | 120 | 牌/洗牌/7选5/比牌/牌型名 |
| 状态机 | `src/game.js` | 425 | 发牌/盲注/前注/下注轮/边池/摊牌/结算（可变式） |
| AI | `src/ai.js` | 249 | 蒙特卡洛胜率、equityVsRange、位置范围、对手剥削、难度分层 |
| 持久化 | `src/store.js` | 499 | localStorage 档案：经济/成长/赛季/段位/任务/活动/牌谱/图鉴/教程 |
| 皮肤 | `src/skins.js` | 162 | 牌背/桌布(程序化)/头像框/称号/座驾/手表/场景 |
| 音频 | `src/sound.js`(83)/`music.js`(65)/`voice.js`(18) | 166 | WebAudio 合成 + lounge bgm + 方言语音 |
| 动效 | `src/fx.js` | 211 | 飞筹码/庆祝/连胜烈焰/气泡/礼物/顶部通告/升级弹层 |
| 社交数据 | `src/social.js` | 41 | 原创快捷语/礼物/表情/AI 闲聊 |
| 路由 | `src/router.js` | 35 | 统一 SceneRouter（注册表+历史+回退） |
| UI 控制 | `src/ui.js` | **1968** | 渲染/循环/操作/面板系统/复盘/SNG/社交/教程 ← **偏厚，最大重构候选** |
| 联机客户端 | `src/online.js` | 371 | 多房间/旁观/聊天/表情/礼物/举报/好友俱乐部面板 |

### 1b. UI 无关规则核心（新，权威实现，reducer 驱动，**尚未接入 UI**）
`src/core/poker/`（582 LOC，11 模块）：`SeededRng / Card / Deck / types / HandEvaluator / HandComparator / SidePot / TableState / LegalActions / GameReducer / HandHistory` + README。
纯函数、零 UI/DOM/网络；所有状态变化只经 `GameReducer`；同 seed 完全可复现。详见 `src/core/poker/README.md`。

### 1c. 服务端
`server.js`（静态 + WS 多房间路由）/ `mp.js`（Rooms Hub + 权威牌桌，复用 game.js）/ `mpstore.js`（好友/俱乐部磁盘持久化）。

**分层评价**：规则/状态机/AI/持久化/音频/动效/路由/社交已分离；`ui.js` 1968 行偏厚；存在**两套规则实现**（现行 game.js + 新核心 core/poker），尚未统一——这是当前最大的架构债。

---

## 2. 屏幕与面板
- **统一路由 SceneRouter（7 场景）**：launch / login / hall / select / table / tutorial / replay / strategyLab / handDex（注册 ≥7）。
- **屏幕（3）**：home / select / table。
- **面板（openPanel ~32 种）**：profile/missions/vip/security/rank/mail/events/gifts/coach/activityMap/passport/mysteryShop/goldenPig/invite/club/vault/achievements/friends/analytics/settings/support/notice/season/tourney/tableChat/tableGift/tableHistory/jackpot/voiceCenter/strategyLab/handDex 等。
- **商店（9 类）**：coins/avatars/frames/titles/scenes/vehicles/watches/backs/felts。

---

## 3. 功能成熟度（诚实分级）
| 状态 | 功能 |
|---|---|
| ✅ 已实装 | 单机牌桌(2/6/9人，归一化座位)、实时胜率/赔率/起手范围/位置/对手范围/建议、**牌局复盘+错误分析+最优建议对比**、训练/考试模式、AI 对手画像、盈利曲线、**SNG 锦标赛**(递增盲注/淘汰/名次)、经济(金币钻石救济)、签到/转盘/兑换码、商店9类、皇家赛季 battle pass、段位、成就墙(19)、每日任务/活动、每日礼包、金库钱罐、邮件、本地财富榜、牌型图鉴、新手教程、连胜烈焰/顶级通告/座驾入场/最佳5张高亮/倒计时光圈/SB-BB标记、历史简条、原创开屏、方言语音、**联机多房间+旁观+聊天/表情/礼物+举报+换桌**、**持久化好友/俱乐部**、未签名 IPA→TrollStore |
| 🟡 半实装/展示 | 部分运营面板(秘宝/活动中心展示态尚可领的已实装)、语音中心(合规入口) |
| ⬜ 缺失/未接 | **新 reducer 核心未接入 UI**（仍用 game.js）；竖屏 6 段硬比例栅格未做；联机桌仍 6 座简版(未上归一化9座) |
| 🚫 不做 | 真钱/充值/提现/广告/风控/上报/麦克风 |

---

## 4. 测试与构建
- `npm test` 四套件全绿：**引擎 15 / 规则核心 57 / UI 回归 84 / 联机服务端 35**。
- `test-engine.js`(引擎压测，35万级手压测历史) / `test-core.js`(reducer 纯逻辑) / `test-ui.js`(jsdom 全面板+流程) / `test-mp.js`(房间/旁观/聊天/举报/好友/俱乐部持久化)。
- 构建：GitHub Actions(macos-14, `CODE_SIGNING_ALLOWED=NO`) → 未签名 IPA(56M) → TrollStore；本地 Tailscale 服务 8099 上线 `/ws`。

---

## 5. 清洁室合规自查
- `src/` 无参考素材/UUID 资源/反编译代码；无「传奇」残留（已全改「皇家」）。
- 资源 56M（参考 320M），程序化优先。
- 字体用系统/可商用，不打包参考字体。

---

## 6. 结论与最大债务
项目已是「**完整训练 App + 真人社交联机 + 权威规则核心**」，远超 demo。
**首要技术债**：① 两套规则实现未统一（应把 UI 迁到 `core/poker` reducer，淘汰 game.js 的可变式状态机）；② `ui.js` 1968 行待按场景/层拆分。
这正是接下来 Phase 1→3 的核心目标。
