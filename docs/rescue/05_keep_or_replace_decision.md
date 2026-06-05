# 05 保留 / 替换 决策表 + V4 Bot 接入方案

## 1. 逐模块决策
| 模块 | 决策 | 依据 |
|---|---|---|
| 规则核心 `core/poker/*` | **保留** | 已对、测试足、V4 §5 满足 |
| `GameAdapter` / `TableController` | **保留** | 迁移桥 + headless 驱动 |
| `src/ai.js` | **替换** | 非随机但不达 V4 结构；换 `core/ai/*`(v4 brain 移植) |
| `src/poker.js`(旧评估) | **逐步替换** | ai.js 改用 core 后，poker.js 仅 fx/旧引用；最终随 game.js 一并清理 |
| `src/game.js`(旧引擎) | **删除(迁移后)** | app 已不用 |
| `src/ui.js` 牌桌部分 | **重构拆分** | 单体违反分层；拆为 table 组件 |
| `src/ui.js` 大厅部分(openPanel) | **保留+渐进抽离** | 内容达标，结构后续抽 HallScene 面板 |
| `fx.js` | **保留为底层库** | 被 GameFeelDirector 调用 |
| `sound/music/voice.js` | **重构为 AudioManager** | 改事件驱动；语音默认关 |
| 联机 `social/online/mp*` | **保留** | 独立线，不阻塞返工 |

## 2. `holdem_ai_brain_v4.ts` 接入方案（清洁室原创，无参考资源）
v4 brain 依赖 `./poker-core` 的 3 个符号，本项目核心需提供等价适配（**移植为 `.js`，无 TS 构建**）：

| v4 依赖 | 本项目等价 | 适配做法 |
|---|---|---|
| `Card` `{rank,suit}` | `core/poker/Card.js` 同形 | 直接通用 |
| `evaluateBestHand(cards)` → `{category,label}` | `core/poker/HandEvaluator.evaluateBest(cards)` → `{score:[cat,...],cards}` | 写薄封装：category=score[0]，label=`HandEvaluator.name(score)`，并提供 `HandCategory` 枚举(=types.CATEGORY) |
| `estimateHoldemEquity({hero,board,opponents,samples,rng})` → `{win,tie,lose}` | `core/poker/` 新增 `Equity.js`(从 `ai.js equityFull` 提纯为纯函数，注入 rng) | 用 SeededRng 注入，支持 samples |
| `seedRng(seed)` | `core/poker/SeededRng.create(seed).next` | 直接包一层返回 `()=>next()` |

落地步骤（Phase 2，先列文件再动手、每步 `npm test`）：
1. 新增 `core/poker/Equity.js`（纯函数 MC，注入 rng；从 ai.js 提纯，旧 ai.js 暂不动）。+ 测试。
2. 移植 `holdem_ai_brain_v4.ts` → `src/core/ai/PokerBrain.js`（`window.RHCore.PokerBrain` + Node 导出），import 改为本项目适配封装。
3. 新增 `src/core/ai/BotProfiles.js`(7 archetype，来自 v4 `DEFAULT_BOT_PROFILES`)。
4. 新增 `test-bot.js`：AA 不 limp、72o UTG 弃、BTN 宽于 UTG、station 比 nit 爱跟、maniac 比 TAG 爱诈、空气牌面对池注弃、强听牌合适赔率不弃（算法规格 §8 / V4 §12.4）。
5. **不切 UI**：先让 `PokerBrain` 与现行 ai.js 并存通过测试；Phase 3 牌桌重构时由 TableScene/控制器改用 `BotDecisionEngine`，旧 ai.js 退役。

## 3. 清洁室声明
- 仅使用 V4 提供的**原创** `holdem_ai_brain_v4.ts` 与本项目自有代码；**不复制参考 IPA** 的任何图片/音频/字体/prefab/代码/商标/文案。
- 语音：默认关闭，改文字气泡为主；不硬塞、不随机播放 mp3。
- 所有筹码为本地训练筹码；无真钱/充值/提现/广告。

## 4. 返工阶段与验收门（与 V4 §13/§14 对齐）
- Phase 0 ✅(本批文档)。
- Phase 1 规则核心：**实质已满足**，补 2 条边界测试即收。
- Phase 2 Bot+策略：`test-bot.js`/`test-equity.js` 全绿 + 7 archetype 参数可辨。
- Phase 3 牌桌分层：分层组件 + 边池可视化 + 座位筹码堆，UI 跑在 reducer。
- Phase 4 GameFeel：EventBus+GameFeelDirector+AudioManager，10 手牌体感达标。
- Phase 5-7：大厅抽离/教程脚本/复盘重放/打磨。
- 一票否决项任一触发即返工；任一评分 <80 不宣称完成。
