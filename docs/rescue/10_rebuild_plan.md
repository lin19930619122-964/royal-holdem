# 10 · 分阶段返工计划

> 每阶段都有：改哪些文件 → 验收闸门(测试/可检查产物) → 完成定义。沿用铁律：不堆单文件、不假按钮、不抄资源、无测试不声明完成。
> 当前已具备的存量（00/04/05/06）作为基座，本计划是**结构性返工**而非小修。

## Phase 1 · 规则核心与测试（基座加固）
- 文件：`core/poker/*`、`test-core.js`、`test-engine.js`、新增 `test-rules-edge.js`。
- 工作：把 04 标"未验证"项补成专项测试（洗牌均匀性、Ante、cappedToCall 重开边界、奇数零头方向、A2345、皇家同花顺、完整 hand history）；把 all-in 自动跑牌从 UI 下沉为 reducer 能力。
- 验收：新测试全绿；随机压力≥50k 手 0 不守恒；all-in runout 有 reducer 层断言。

## Phase 2 · PokerBrain AI（增强）
- 文件：`core/ai/PokerBrain.js`、`BotDecisionEngine.js`、`test-bot.js`。
- 工作：跨街 actionHistory 累计；消费 `OppModel` 做剥削调整；下注尺度体系(⅓/½/¾/超池/街差异 + 诈唬-价值平衡)；tilt/trap 真正生效。
- 验收：test-bot 增断言（SPR/potOdds 阈值、剥削方向、尺度分布）；7 画像可统计区分 VPIP/PFR。

## Phase 3 · TableScene 组件重建（P0）
- 文件：拆分 `ui.js`→`view/TableScene.js`/`view/SeatView.js`/`view/layers/*`；`styles.css` 拆分；`index.html`。
- 工作：14 分层节点 + 锚点系统；SeatView 重建为 22 子节点(或合理子集)含挂点；保留 reducer/Adapter 驱动不变。
- 验收：`test-ui` 断言层级与 SeatView 子节点齐全；牌桌功能回归全绿；ui.js 行数显著下降且无单文件回潮。

## Phase 4 · GameFeelDirector 爽感系统（P0）
- 文件：`services/GameFeelDirector.js`、`AudioManager.js`、`view/*`、`test-gamefeel.js`。
- 工作：ui.js 注册 onVisual 执行器，内联视觉迁入导演；补齐 11 个死事件 emit；发牌飞行/收池(POT_TO_WINNER)/摊牌编排(SHOWDOWN_START→REVEAL_HAND→BEST_HAND_HIGHLIGHT)/关键时刻(premium/badbeat/goodfold)。
- 验收：24 事件 emit 覆盖率达标（test 断言每事件可触发）；onVisual 注册数>0；盲测能分辨关键时刻反馈。

## Phase 5 · 大厅与成长系统（厚化，本地）
- 文件：`view/HallView.js`、`store.js`、`skins.js`、`test-ui.js`。
- 工作：赛季/成就/段位做"厚"（分类、稀有度、长期目标、进度仪式），全部本地存档；个人资料三段式(身份/外观/数据)。
- 验收：成长面板信息密度可检查；store 字段与领取流测试覆盖；无联网依赖。

## Phase 6 · 教程 / 策略训练 / 复盘（差异化超越）
- 文件：`core/Lessons.js`、`view/NoviceTable.js`、`view/Replay.js`、`test-ui.js`。
- 工作：桌内 NoviceTable 脚本化引导；策略训练(范围/赔率/equity)强化；复盘逐街回放已具备→接 BEST_HAND_HIGHLIGHT。
- 验收：教程脚本可跑通断言；复盘/统计回归绿；训练维度文档化对比参考为"超越项"。

## Phase 7 · 音频 / 快捷语 / 表情 / 皮肤（自研，不抄）
- 文件：`sound.js`、`fx.js`、`social.js`、`skins.js`、`styles.css`。
- 工作：逐事件可区分合成音库；程序化表情(精灵帧/SVG，非语音)；牌背/桌布皮肤扩展(自绘)。
- 验收：08 硬指标逐条达标；语音默认关、无语音包；无参考资源混入。

## Phase 8 · 性能 / 适配 / 验收
- 文件：全局、`sw.js`、`test-*`、`docs/`。
- 工作：1080×2339 竖屏适配；DOM/动画性能；缓存版本；端到端回归 + 真机验收清单。
- 验收：八套件全绿 + 新增套件；真机 TrollStore 安装走查 00–08 每项；输出验收报告文档。

## 阶段依赖与节奏
1→2 可并行于 3 前；**3、4 是 P0 必须先于 5–8**；每阶段单独提交 + CI 出 IPA + 真机抽验；任一阶段未过测试不进下一阶段。

---
**Phase 0 到此结束，等确认后再进入 Phase 1。**（本阶段未改任何功能代码，仅产出 docs/rescue/00–10 + 只读分析。）
