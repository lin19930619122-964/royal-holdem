# 04 重建取舍清单（保留 / 重写 / 删除 / 新增）

> 原则：保留可运行路径，分阶段迁移；不一次性大改；每步过 `npm test`。

## 保留（已达标，勿动核心行为）
| 文件 | 理由 |
|---|---|
| `src/core/poker/*`(11 模块) | 规则核心权威，57 测试，V4 §5 已满足 |
| `src/game/table/GameAdapter.js` | UI↔reducer 桥，69 测试 |
| `src/game/table/TableController.js` | reducer 驱动控制器(headless)，37 测试 |
| `src/router.js` | SceneRouter 已统一 |
| `src/store.js` | 本地持久化(成长/历史/成就/赛季) |
| `src/social.js`/`online.js`/`mp.js`/`mpstore.js`/`server.js` | 联机社交，独立线 |
| `src/skins.js` | 程序化皮肤(V4 §20 桌布/牌背) |
| `test-*.js`(6 套) | 回归基线，迁移护航 |
| 复盘逻辑(store.handLog + ui renderHandDetail) | V4 §11.2 已具雏形 |

## 重写 / 重构（不达 V4 规格）
| 目标 | 现状 | 动作 | 阶段 |
|---|---|---|---|
| AI Bot | `src/ai.js`(MC+性格，非随机但非结构化) | **移植 `holdem_ai_brain_v4.ts`→ `src/core/ai/*`**：BotProfile/PreflopMatrix/BoardTexture/EquityCalculator(复用核心)/PokerBrain/BotDecisionEngine；7 archetype；结构化决策+reason | Phase 2 |
| TrainingAdvisor | 散在 `ui.js`(enableHumanControls 内) | 抽 `src/core/ai/TrainingAdvisor.js`，复用与 Bot 同一评估 | Phase 2 |
| 牌桌 UI | `src/ui.js`(1968 行单体) | 拆 `src/game/table/`：TableScene/SeatView/CardView/ChipView/PotView/SidePotView/ActionPanel/RaiseSlider/TrainingAssistantView/HandResultView；TableScene 只读 selectors + dispatch | Phase 3 |
| 动画触发 | 内联调 `Fx.*` | 收编进 `GameFeelDirector` 执行器（`fx.js` 保留为底层特效库） | Phase 4 |
| 音频 | 内联调 `Sfx.*`/`Voice.*` | 新建事件版 `src/services/AudioManager.js`，订阅 GameFeelEvent；语音默认关 | Phase 4 |

## 删除（迁移完成后）
| 文件 | 时机 |
|---|---|
| `src/game.js`(旧可变式引擎) | UI 全量在 GameAdapter 上验证后；先保留 test-engine，迁移测试到 core 后删 |
| 180 条 `assets/voice/*.mp3` 默认加载 | 改为默认关 + 懒加载；不删文件但不默认播(V4 §9/§16) |

## 完全缺失（新增）
| 新文件 | 职责 | 阶段 |
|---|---|---|
| `src/services/EventBus.js` | 发布订阅总线 | Phase 4 |
| `src/services/GameFeelDirector.js` | 牌局事件→动画/音效/节奏/数字滚动统一调度 + JuiceLevel 分级 | Phase 4 |
| `src/services/AudioManager.js` | 事件驱动音频，分类/冷却/默认关语音 | Phase 4 |
| `src/core/ai/BotProfile.js`/`PreflopMatrix.js`/`BoardTexture.js`/`BotDecisionEngine.js`/`PokerBrain.js`/`TrainingAdvisor.js` | V4 §6 算法结构 | Phase 2 |
| `src/game/table/SeatView.js` 等分层组件 | V4 §7 | Phase 3 |
| `PotView/SidePotView/ChipView`(边池可视化+筹码堆+数字滚动) | 视觉缺口 | Phase 3/4 |
| `test-bot.js`/`test-equity.js`(算法规格 §8 + V4 §12.4) | Bot 行为测试 | Phase 2 |

## 不做（V4 §0 边界）
真钱/充值/提现/广告/联网必需对战/商业活动；语音随机播放；逐像素复刻参考；导入参考资源。
