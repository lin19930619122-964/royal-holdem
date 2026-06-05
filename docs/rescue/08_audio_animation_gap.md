# 08 · 音频与动画差距

> 依据：参考 01 的 187 AudioClip / 559 animation（139 Spine）vs `src/sound.js`(83) / `fx.js`(211) / `styles.css`(914 keyframes)。
> **铁律约束**：不复制参考任何音频/动画资源；不加语音包；语音默认关。差距只能靠**程序化合成/CSS/Canvas/SVG/WebAudio** 自研补齐。

## 音频

| 维度 | 参考 | 我方 | 差距 |
|---|---|---|---|
| 音频来源 | 187 个**录制 clip** | ~10 个 **WebAudio 合成振荡器音**（deal/chip/bet/check/fold/allin/win/lose/reward/button） | 数量/质感差距大 |
| 牌桌逐动作音 | `sound/table` 53：dealCard/flop_cards/actionFold/actionCheck/actionCall/actionBet/actionRaise/actionAllIn/win/Jackpot/secutiveWinner/unlock_watch… **逐动作独立音轨** | fold/check/chip/bet/allin/win/lose 合成音复用 | 颗粒度粗：raise 与 bet 同音、call 用 chip 音、无连胜/解锁/奖池专属音 |
| 快捷语音 | `sound/quickWords` 28 条人声 | 🚫**铁律不做语音包**（文本快捷语保留） | 主动不对标 |
| 礼物/互动音 | `sound/magic` 40 | `gift` 合成音 1 种 | 🟡 |
| 分类与门控 | — | `AudioManager` 5 类(music/sfx_table/sfx_ui/sfx_result/voice) + 默认关语音 + 40ms 防抖 | ✅ 框架好，缺音色 |

**音频结论**：不追 187 录制 clip，但应**扩充合成音色库**——为每个 GameFeelEvent 设计可区分的合成音（raise≠bet、call、连胜、解锁、奖池、bad-beat、premium-hand），并真正接入导演（见 06）。当前"合成音 + 复用"听感单薄是真实差距，但路径是自研合成，不是抄。

## 动画

| 维度 | 参考 | 我方 | 差距 |
|---|---|---|---|
| 技术 | Spine 骨骼 **139** + 帧动画 + 粒子 | CSS keyframes(`styles.css` ~10 个) + `fx.js` 程序化 DOM | 表现层级差距大 |
| 牌桌动画 | `animations/desk` 258：magicEmoji110/fire40/win16/chipToMe8/jackpotLight/actionLight | `flyChip`/`flashAllIn`/`deal-in`/`rollPot`/`streakFlame` | 🟡 关键动作有近似，缺骨骼级表情/火焰/光效 |
| 大厅动画 | `animations/hall` 181：legendLife72/achivementWall52/flyCoin12 | `rewardPop`/`topBanner`/升级弹窗 | 🟡 |
| 表情 | magicEmoji 110 + freeEmoji 48（骨骼动画表情） | `Social.EMOJIS` ≥8 **文本表情** | ❌ 无动画表情系统 |
| 发牌 | 逐张从牌堆飞向座位 + 翻牌动画 | `deal-in` 原地错开滑入(近似) | 🟡 非真飞行轨迹 |
| 筹码 | 下注飞向池 / 池飞向赢家 / 筹码堆叠 | `flyChip`(下注→池) + `chipStackHTML`(叠放) | 🟡 缺"池→赢家"落地 |
| 摊牌 | 逐家翻牌 + 最佳 5 张高亮 + 牌型展示 | flip-in(未经导演) + 公共牌侧高亮 | 🟡 无统一摊牌编排 |

**动画结论**：差距客观存在，但补齐方向是**自研 CSS/Canvas/SVG/程序化**——可做：真发牌飞行轨迹、池→赢家筹码归集、摊牌逐家翻牌+最佳5张描金、起手强牌/坏拍/好弃的关键时刻特效、轻量"伪骨骼"表情（精灵帧或 SVG 变形）。不引入参考 Spine 资源。

## 给 Phase 7 的硬指标（避免"差不多"验收）

- 每个 GameFeelEvent 有**可区分**的合成音（A/B 盲听能分辨 raise/bet/call/allin/win/badbeat）。
- 发牌：牌从固定牌堆锚点按座序飞出，落位有缓动。
- 摊牌：SHOWDOWN_START→逐家 REVEAL_HAND→BEST_HAND_HIGHLIGHT 描金，三段可见。
- 收池：POT_TO_WINNER 筹码从池飞向赢家座位锚点。
- 全部经 GameFeelDirector.onVisual 派发，ui.js 不再内联散写。
