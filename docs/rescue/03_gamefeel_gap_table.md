# 03 爽感差距表（V4 §8 + 爽感清单 V4）

> 负责动画：`src/fx.js` + CSS keyframes。负责音频：`src/sound.js`/`music.js`/`voice.js`。触发：均**内联散落在 `ui.js`**，无中央调度。

## A. 核心缺口：无 GameFeelDirector（V4 一票否决源）
| V4 要求 | 现状 | 严重度 | 改造动作 |
|---|---|---|---|
| `GameFeelDirector` 统一接收牌局事件→调度 动画/音效/节奏/数字滚动/光效/提示 | **不存在**；`ui.js` 在 tick/decorateResult 里直接调 `Fx.*`/`Sfx.*` | **P0** | 新建 `src/services/GameFeelDirector.js` + `EventBus.js`，reducer 产出 GameEvent→映射 GameFeelEvent |
| 23 类 GameFeelEvent(HAND_START…SESSION_SUMMARY) | 隐式、无枚举 | **P0** | 定义事件枚举 + 订阅 |
| JuiceLevel 分级(subtle/normal/strong/epic) | 部分隐含(连胜烈焰按级)，无统一分级 | **P1** | GameFeelDirector 统一分级 |
| 节奏参数表(发牌 stagger / Bot 思考 / all-in 定格 / 摊牌 / 赢池) | 散落常量(aiThinkDelay、setTimeout 4200 等) | **P1** | 集中到 GameFeel 节奏表 |

## B. 即时反馈逐项（爽感清单 §2）——多数已有，缺中央编排
| 事件 | 视觉 | 音频 | 现状 | 严重度 |
|---|---|---|---|---|
| 进桌 | 桌面入场 | gamein | ✅ `table-felt.enter` + Sfx | P2 |
| 发底牌 | 飞牌 stagger | deal | 🟡 有 dealIn + Sfx.deal，**非逐张飞向座位** | P1 |
| 当前行动 | 头像光圈+倒计时环 | tick | ✅ active 光圈 + turn-ring | — |
| 弃牌 | 变灰 | fold | ✅ `.folded` + Sfx.fold | — |
| 跟注/加注 | 筹码飞入 | call/raise+chip | 🟡 `flyChip` 有，但**飞向 potEl 非筹码堆聚合** | P1 |
| All-in | 桌面压暗+强光+标识 | allin | 🟡 有 flashAllIn + Sfx.allin，**无桌面压暗/定格仪式** | P1 |
| 翻牌/转/河 | 连翻+脉冲 | flop/flip | ✅ 有 | P2 |
| 摊牌 | 逐人翻牌 | reveal | 🟡 一次性显示，非逐人 | P2 |
| 最佳五张 | 高亮连框 | rank good | ✅ `hl5` 脉冲 | — |
| 赢池 | 筹码飞回+数字滚动 | win+chip | 🟡 `flyChip`+`coinBurst` 有，**无数字滚动**、筹码飞向方向是赢家但非"从底池回收" | P1 |
| 好决策 | 训练徽章+XP+解释 | soft reward | ✅ 复盘+rewardPop+经验 | — |
| 成就 | 卡片弹+光效 | achievement | ✅ rewardPop | — |

## C. 直接判定枯燥项（爽感清单 §5）逐条
| 枯燥项 | 是否触发 | 说明 |
|---|---|---|
| Bot 动作瞬间完成 | ❌ | 有 `aiThinkDelay` 0.38-1.6s |
| 发牌没动画 | ❌ | 有(但非逐张飞向座位) |
| 下注没筹码飞行 | ❌ | 有 flyChip |
| 赢池没筹码回收 | ⚠️ | 有飞币但非"底池→赢家"方向 + 无数字滚动 |
| All-in 没特殊反馈 | ⚠️ | 有闪光，无压暗定格 |
| 大牌型和普通无区别 | ❌ | handCelebration 分级 |
| 每手只有"你赢/输" | ❌ | 有复盘卡 |
| 训练建议像死文本 | ❌ | 有展开解释 |
| 音频与事件对不上 | ⚠️ | 事件对应但**非总线驱动**，散落 ui.js |
| 大厅无成长目标 | ❌ | 有等级/赛季/任务 |

## 结论
爽感**素材层已具备**（飞筹码/高亮/庆祝/连胜/通告/升级弹层/合成音），但**缺中央「事件→反馈→奖励」编排（GameFeelDirector + EventBus）**=P0；并缺三处具体体感：①逐张发牌飞向座位 ②赢池数字滚动 ③All-in 桌面压暗定格。返工在 V4 Phase 4 集中补，把现有 `Fx.*`/`Sfx.*` 收编为 GameFeelDirector 的执行器（不重造特效，改为统一调度）。
