# 09 · 返工取舍清单（保留 / 重写 / 删除 / 新建 / 不做）

> 决策依据：00–08。原则——规则与 AI 已可信则保留；UI 单体是病灶则拆；死代码删；铁律项不做。

## 保留（Keep · 不动或仅扩展）

| 模块 | 动作 |
|---|---|
| `core/poker/*`（13 文件） | 保留为权威规则核心；仅**补测试**(04 未验证项) + 下沉 all-in 自动跑牌 |
| `core/ai/PokerBrain.js` + `BotDecisionEngine.js` | 保留；Phase 2 增强(跨街建模/剥削/下注尺度) |
| `core/Lessons.js` | 保留 |
| `store.js` | 保留；成长字段扩展(本地) |
| `fx.js` / `sound.js` / `music.js` | 保留；扩充合成音色与程序化动画 |
| `services/EventBus / AudioManager / GameFeelDirector` | 保留骨架；真正接线(onVisual + 补 emit) |
| 8 个 `test-*.js` | 保留为验收闸门，持续加断言 |
| `skins.js` / `social.js` / `codec.js` | 保留为数据层 |

## 重写 / 拆分（Rewrite）

| 模块 | 动作 | 理由 |
|---|---|---|
| `ui.js`（2176 行） | 拆成 HallView / TableScene(分层) / SeatView(组件) / PanelRegistry / 动画桥 | 单体病灶(00/03) |
| `styles.css`（914 行） | 按场景/组件拆分 | 同上 |
| SeatView | 重建为 22 子节点+挂点组件 | P0(03) |
| TableScene | 扁平 DOM → 14 分层 + 锚点 | 03 |
| GameFeel 视觉接入 | ui.js 内联视觉 → 注册 onVisual 执行器 | P0(06) |

## 删除（Delete）

| 模块 | 理由 |
|---|---|
| `game.js`（425 行） | 已被 GameAdapter 取代仍在 index.html/sw.js 加载 = 死代码 |
| `ai.js`（249 行）大部分 | 决策已交 PokerBrain；风格文案并入画像数据后删除 |
| `TableController.js` | 实盘未走，确认后删 |

## 新建（New）

| 模块 | 用途 |
|---|---|
| TableScene 分层节点系统 + 锚点(chipToPot/chipToWinner/emojiMount/giftMount) | 03/06/08 |
| GameFeel 视觉执行器集合(发牌飞行/收池/摊牌编排/关键时刻) | 06/08 |
| 合成音色库扩展(逐事件可区分) | 08 |
| reducer 层 all-in 自动跑牌 | 04 |
| 跨街对手建模 + 剥削英雄模块 | 05 |
| NoviceTable(桌内引导) | 02 |
| 赛季/成就视觉厚化(本地) | 07 |

## 不做（铁律明确排除）

- 🚫 真钱/充值/提现/广告变现/联网对战必需。
- 🚫 语音包 / 录制人声快捷语。
- 🚫 复制参考 IPA 任何图片/音频/字体/prefab/代码/商标/独有文案。
- 🚫 背景图堆砌(说明书禁)、傻语音。
- 🚫 在线 SDK(GCloudVoice/网易盾/神策/七牛/微信/openinstall)。
- 🚫 参考 Spine 资源(自研程序化替代)。
