# 当前项目审计（皇室德州 / royal-holdem-mobile）

> 对本项目源码做事实审计：工程分层、代码量、模块、屏幕/面板、资源、构建链路；并诚实标注**已实装 / 半实装 / 占位**。
> 审计对象：`/Users/linlin/cc 工作站/royal-holdem-mobile/src`（源码项目，**非** IPA 二进制）。
> 审计日期：2026-06-04。

---

## 1. 工程分层（已具备清晰分层）

| 层 | 文件 | LOC | 职责 |
|---|---|---|---|
| 规则 | `poker.js` | 120 | 牌、洗牌、7 选 5 评定、比牌、牌型名 |
| 状态机 | `game.js` | 425 | 发牌/盲注/前注/下注轮/边池/摊牌/结算 |
| AI | `ai.js` | 184 | 蒙特卡洛胜率、位置范围、3bet/set-mine、下注尺度、对手剥削、难度分层 |
| 持久化 | `store.js` | 312 | localStorage 档案：金币/钻石/等级/任务/成就/外观/**牌谱复盘** |
| 皮肤 | `skins.js` | 158 | 牌背/桌布/头像框/称号/座驾/手表/场景（程序化 + 少量原创图） |
| 音频 | `sound.js`(65)/`music.js`(65)/`voice.js`(18) | 148 | WebAudio 合成音效 + 暖色 lounge bgm + 方言语音播放 |
| 动效 | `fx.js` | 105 | 赢牌闪光/筹码飞行/连胜庆祝/震屏/震动 |
| UI 控制 | `ui.js` | 1,332 | 渲染、循环、人类操作、面板系统、商店、复盘 |
| 多人 | `mp.js` / `online.js`(267) | — | 权威 WebSocket 同桌（复用 game.js） |
| 壳/构建 | `make-www.js` / Capacitor / `.github/workflows/ios-ipa.yml` | — | PWA → 未签名 IPA → TrollStore |

代码合计 ~3,143 行 JS + 731 CSS + 284 HTML（+103 online.html）。
**分层评价**：规则/状态机/AI/持久化/音频/动效已分离；UI 层偏厚（1,332 行），是后续重构候选。

---

## 2. 屏幕与面板

- **屏幕（3）**：`screen-home`（大厅）/ `screen-select`（选桌）/ `screen-table`（牌桌）。
- **面板入口（28，`data-panel` → `openPanel`）**：
  profile, missions, vip, security, rank, mail, events, gifts, coach, activityMap, passport, mysteryShop, goldenPig, invite, club, vault, achievements, friends, analytics, support, settings, tableChat, tableGift, tableHistory, jackpot, voiceCenter, notice, season, tourney。
- **商店标签（9）**：coins, avatars, frames, titles, scenes, vehicles, watches, backs, felts。
- **独立模态**：签到、商店、兑换码、自定义牌桌、幸运转盘、通用面板、toast。

### 面板成熟度分级（诚实）
| 状态 | 面板 |
|---|---|
| ✅ 已实装（真实数据/可交互） | profile、missions（任务领取）、achievements（成就领取）、analytics（真实统计 + 复盘入口）、**tableHistory（牌局复盘列表+详情）**、vip（实时计算）、settings（开关）、shop（9 类可购买）、签到/转盘/兑换码/破产救济 |
| 🟡 半实装（真实数据但只展示） | rank、security、season、season 进度、notice |
| ⬜ 占位（panelRow 文案，待发奖/待接入） | mail、events、gifts、coach、activityMap、passport、mysteryShop、goldenPig、invite、club、vault、friends、support、tourney、tableChat、tableGift、jackpot、voiceCenter |

---

## 3. 资源（56MB，远低于参考 320MB）

| 类别 | 数量 | 形态 |
|---|---|---|
| 头像 | 24 | 原创/AI 生成 PNG |
| 场景 | 5 | vip/palace/yacht/vegas/macau |
| 牌背 | 4 图 + 32 程序化 | imgGold/Royal/Dragon/Phoenix + PAL×PAT |
| 桌布 | 4 图 + 18 程序化 | green/blue/crimson/purple + FPAL |
| 方言语音 | 180 mp3 | edge-tts 东北话，12 动作 × 多变体（原创） |
| 牌皮 | 程序化 | CSS 渲染（cmini/角标+中心 pip） |
| 头像框/称号/座驾/手表 | 程序化 | CSS box-shadow / emoji / 文案 |

**体积评价**：满足"体系完整 + 轻量"双目标；56M 主要来自 180 条语音 + 少量原创位图。

---

## 4. 已验证的工程质量
- 引擎：35 万手压测 0 崩溃、筹码守恒。
- AI：鲨鱼击败 TAG 基线（TAG -0.10 bb/手）、碾压跟注站。
- 复盘系统：13 项 jsdom 渲染测试 + 6 项数据层测试全绿。
- 构建：GitHub Actions（macos-14，`CODE_SIGNING_ALLOWED=NO`）产未签名 IPA → TrollStore 安装；当前包 56M、服务端本地实测 200。
- 兼容：iPhone 11 安全区适配（刘海/灵动岛 padding）、9 人桌座位重排、筹码紧凑显示（万/亿）。

---

## 5. 相对参考包的结构性差距（概览，详见 gap-matrix）
1. **赛季体系**：参考最重（101 prefab），我方仅进度条占位。
2. **桌面社交**：聊天/表情/礼物有入口无动效。
3. **成长奖励表**：赛季/通行证/段位的"奖励表 + 领取 + 晋升动画"缺。
4. **外观体系广度**：参考 ~20 牌皮 / 16+ 桌布主题；我方程序化覆盖但主题数偏少。
5. **牌桌反馈层**：连胜火焰/顶级通告/入场座驾我方有雏形，精致度待提升。
6. **超越项已起步**：复盘+错误分析已实装（参考仅 history 记录），实时策略提示 + AI 画像待建。

---

## 5b. 清洁室合规自查（发现项）

扫描 `src/` 确认**无参考素材/代码泄漏**（无 UUID 资源、无参考贴图/音频、无反编译代码）。
但发现**命名风险**——以下文案用了"传奇"，与参考 App 专有名（其赛季模块 `legendarySeason`、产品名）过近，建议在实现阶段改名（参 `reference-cleanroom-abstraction.md` 的映射 → "皇家赛季 / Royal Season"）：

| 文件 | 位置 | 现文案 | 建议 |
|---|---|---|---|
| `src/skins.js:116` | 称号 | `传奇` | 改原创称号（如"皇家传说/Royal Legend"） |
| `src/index.html:68` | 大厅横幅 | `传奇赛季开启` | 改"皇家赛季开启" |
| `src/ui.js:739` | 赛季公告 | `传奇赛季开放…` | 改"皇家赛季…" |
| `src/ui.js:934` | 赛季面板标题 | `传奇赛季` | 改"皇家赛季" |

> 风险级别：低（"传奇"是通用形容词），但为干净起见列入阶段 3（赛季实装）一并改名。本轮审计**不改代码**。

## 6. 审计结论
本项目已是"**有完整引擎 + 分层工程 + 可玩经济成长 + 复盘训练核心**"的真实 App，不是 demo。
与参考的差距集中在**大厅功能密度（尤其赛季/社交/奖励表）**与**牌桌情绪反馈精致度**，而非地基。
下一步应：①把占位面板按优先级填实（发奖/动效），②做强三个超越点（复盘已成→实时提示→AI 画像），③保持体积红线与清洁室边界。
