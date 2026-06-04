# 场景架构 & 统一路由 SceneRouter

> 取代写死的页面跳转。所有导航走 `SceneRouter.go(name, params)`，由 `router.js`（通用注册/历史/回退，**不碰 DOM**）+ `ui.js`（注册各场景处理函数）协作。

## 场景树

```
AppBoot
├─ launch        LaunchScene      —— runSplash() 原创 Canvas 开屏
├─ login         LoginScene       —— 本地训练无账号，直接 go('hall')
├─ hall          HallScene        —— screen-home（可带 {panel} 直接打开面板）
│   ├─ profile / coach(训练营) / strategyLab(策略实验室) / season(皇家赛季)
│   ├─ achievements / vip(段位/贵宾) / missions+events(每日训练)
│   ├─ tableHistory(牌谱) / analytics(数据/复盘) / settings / 其余面板
├─ select                          —— 选桌（房间/难度/自定义，进 table 前）
├─ table         TableScene       —— startTable(resolveTableConfig(params))
│   ├─ CashTrainingTable   mode:'cash-training'（默认）
│   ├─ TutorialTable       mode:'tutorial'（进桌强制弹教程）
│   ├─ ReplayTable / HandReviewOverlay（复盘详情 = renderHandDetail）
├─ tutorial      TutorialScene    —— runTutorial(force, lessonId)
├─ replay        ReplayScene      —— openReplay(handId) 定位牌谱详情
└─ strategyLab   StrategyLabScene —— 起手范围/底池赔率/对手风格图鉴/复盘/考试开关
```

> 物理承载面：3 个屏幕（`screen-home/select/table`）+ 模态面板系统（`openPanel`）+ 覆盖层（splash/tutorial）。逻辑场景通过 SceneRouter 映射到这些承载面，UI 看起来是「场景」，底层复用现有原语。

## API

```js
SceneRouter.go('hall')
SceneRouter.go('hall', { panel: 'season' })                 // 进大厅并打开某面板
SceneRouter.go('select')                                    // 选桌
SceneRouter.go('table', { mode:'cash-training', blindLevel, botProfileSet, players, ante })
SceneRouter.go('table', { room: 5 })                        // 直接用预设房间(高手场)
SceneRouter.go('table', { custom: { bb, players, ante } })  // 自定义桌
SceneRouter.go('tutorial', { lessonId })                    // 教程，lessonId=起始页
SceneRouter.go('replay', { handId })                        // 复盘指定手(牌局编号)
SceneRouter.go('strategyLab')
SceneRouter.back()                                          // 回退到历史上一场景
SceneRouter.current()                                       // 当前场景名
SceneRouter.onGo(fn)                                        // 监听场景切换
```

### 参数解析（resolveTableConfig）
- `room`：直接取 `ROOMS[room]`（新手/进阶/高额/单挑/九人/高手/大师场）。
- `custom`：`{bb, players, ante}` → sb=bb/2、buyin=max(2万, bb×100)。
- `blindLevel`：索引到 `BLIND_LEVELS`（5 档）；`botProfileSet`：`'casual'|'hard'|'master'` → AI 难度；`players`/`ante` 可选。
- `mode`：`'cash-training'`(默认) / `'tutorial'`(强制教程) / 复盘走 `replay` 场景。

## HTML 声明式导航

任意元素加 `data-scene="x"`（可选 `data-scene-params='{"...":...}'`）即走统一路由，无需单独写监听：
```html
<button data-scene="strategyLab">策略实验室</button>
<button data-scene="table" data-scene-params='{"room":6}'>进大师场</button>
```

## 设计原则
- `router.js` 纯逻辑（注册表 + 历史栈 + 回退 + 监听），不引用任何 DOM/业务，便于单测与复用。
- 场景处理函数集中在 `ui.js#registerScenes()`，是 DOM/状态的唯一编排点。
- 旧原语（`showScreen/openPanel/startTable/runTutorial`）保留为底层，只被场景处理函数调用，不再被业务代码直接当跳转用。
- 回归：`test-ui.js` 覆盖 8 个场景注册 + go(hall/select/strategyLab/table/replay)/back，`npm test` 全绿。
