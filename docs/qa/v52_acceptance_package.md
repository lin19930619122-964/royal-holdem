# v52 真机验收包（Acceptance Package）

> 仅验收包，无新功能开发。所有数据可验证。截图：本环境为 headless（jsdom 无渲染、无真机），**无法截图**，下方给出真机应看的画面点。

## 1. 构建与版本信息
| 项 | 值 |
|---|---|
| 版本 | IPA v52（SW cache `royal-holdem-v52`） |
| commit | `e016b047ffd2ce7e6f8c8bfdba5626aa4af85043`（`e016b04`） |
| CI 构建 | GitHub Actions「构建未签名 iOS IPA」run **27056539412**，headSha=e016b04，结论 success（1m6s） |
| 构建产物 | artifact `royal-holdem-unsigned-ipa` → `ios/App/royal-holdem-unsigned.ipa`（未签名）。下载：`gh run download 27056539412 -n royal-holdem-unsigned-ipa` |
| 安装方式 | 未签名 IPA → TrollStore 安装（自签/无证书） |
| 本地运行 | `node server.js`（默认端口 8099）→ 浏览器开 `http://localhost:8099` 或局域网 IP；手机加到主屏作 PWA |
| SW / cache | 已刷新：`src/sw.js` 缓存名 v51→**v52**，安装新版后旧缓存失效 |

核心变更摘要（vs 上一版 IPA v51 / Live Integration）：
- 对手昵称/头像/风格标签接入（reducer-adapter 之前为空）。
- 5 个桌内内容层从占位 → 实装：TrainingAssistant / ChatEmoji / Gift / History / Modal。
- ui.js 删除内联 hand-hint / hand-strip 渲染，改 VM 驱动层。
- C 保持（ui.js 直接 GF.emit=0）、D/A 保持。

## 2. 测试命令与结果
```
npm run test:rules     PASS  规则 85
npm run test:ai        PASS  PokerBrain 33 + 对手模型 11
npm run test:gamefeel  PASS  GameFeel 77
npm run test-ui        PASS  UI 225
npm run test-engine    PASS  21k+ 手 0 崩溃 / 0 步数超限 / 0 筹码不守恒
npm test               EXIT=0
```
另：本包额外跑了 **live 自测探针**（jsdom 驱动真实开桌+连打），结果见第 3 节表与下方 §3 流程。

## 3. 本轮新增 / 修改 / 删除文件
**新增**：无源文件（5 层用既有占位文件改写）；新增本验收文档 `docs/qa/v52_acceptance_package.md`。
**修改**：`src/core/ai/BotProfiles.js`、`src/view/table/layers/{TrainingAssistantLayer,ChatEmojiLayer,GiftAnimationLayer,HistoryLayer,ModalLayer}.js`、`src/ui.js`、`src/index.html`、`src/styles.css`、`src/sw.js`、`test-ui.js`。
**删除**：无（删的是 ui.js 内联渲染代码路径）。

## 4. 牌桌核心功能验收表
| 功能 | 自动化验证 | 状态 |
|---|---|---|
| reducer 引擎守恒 | test-engine 21k 手 0 不守恒 | ✅ |
| CardSlot live 发牌（无 ghost，到达 reveal） | test-ui LI 段 | ✅ 逻辑；视觉需真机 |
| 发牌门控 ActionPanel | 探针 busyAfterDeal=true；test-ui D 段 | ✅ |
| 发牌顺序日志 | 探针 dealOrder=18（9×2） | ✅ |
| best5 高亮 / data-ck | test-ui | ✅ 逻辑；视觉需真机 |
| 摊牌逐家 reveal | test-ui E 段 | ✅ 逻辑；视觉需真机 |
| 派彩筹码飞行/守恒 | test-engine + Fx.flyChip | ✅ 逻辑；视觉需真机 |
| ui.js 直接 GF.emit=0（C） | `grep -c`=0 | ✅ |

## 5. 桌内 5 内容层验收表
| 层 | 关键点 | 自动化验证 | 状态 |
|---|---|---|---|
| TrainingAssistant | decision/observe/summary；牌型/胜率/底池赔率/SPR/建议/理由；可展开 | test-ui P341 + 探针 winPct=32/spr/potOdds=40/summary=true | ✅ |
| ChatEmoji | 8 原创快捷语；气泡+自动消失；5s 冷却；emoji | test-ui P341（发送/拦截/再发/emojiMount/定时器） | ✅ |
| Gift | 5 原创反应；giftMount 动画+清理；冷却；系统触发 | test-ui P341（giftMount/冷却/systemTrigger） | ✅ |
| History | 手号·街道+最近5行动(昵称/位置/动作/金额)+all-in标记+复盘入口 | test-ui P341 + 探针 historyHasContent | ✅ |
| Modal | 独立 #table-modal；7 类弹窗；open 门控 ActionPanel/close 恢复 | test-ui P341 + 探针 modalOpenLive/exitModal/modalClosedLive | ✅ |
| 对手昵称/头像/风格 | 9 座非空且不重复 | test-ui P341 + 探针 allNick/allAvatar=true | ✅ |

## 6. 真机试玩 20 手检查表（含 live 探针自测结果）
> 探针 = 在 jsdom 驱动真实 UI 连打 20–25 手；视觉项探针只能验逻辑/DOM，**飞行/翻牌/描金动画须真机眼看**。

| 编号 | 场景 | 结果 | 问题 | 涉及文件 | 阻塞 |
|---|---|---|---|---|---|
| 1 | 正常开桌 | ✅ 探针开桌成功 | — | ui.js | 否 |
| 2 | 9 人桌座位昵称非空 | ✅ allNick=true | — | BotProfiles/SeatLayer | 否 |
| 3 | 9 人桌座位头像非空 | ✅ allAvatar=true | — | BotProfiles/SeatLayer | 否 |
| 4 | 底牌从牌堆飞到位 | 🔎 逻辑✅(CardRow.flyFrom)，视觉需真机 | 无布局环境不渲染动画 | CardRow/CardSlot | 否 |
| 5 | hero 牌到达后才显示牌面 | ✅ test-ui LI（飞前无 data-ck，到达 reveal） | — | CardRow | 否 |
| 6 | 对手牌到达只显牌背 | ✅ test-ui LI | — | CardRow/SeatLayer | 否 |
| 7 | flop 三张依次飞入翻开 | 🔎 逻辑✅(freshFrom=prev)，视觉需真机 | — | CommunityCardLayer | 否 |
| 8 | turn/river 单张飞入翻开 | 🔎 逻辑✅，视觉需真机 | — | CommunityCardLayer | 否 |
| 9 | hero 行动时 ActionPanel 激活 | ✅ 探针 hero 可点击行动连打 | — | ui.js | 否 |
| 10 | 发牌期间 ActionPanel 禁用 | ✅ 探针 busyAfterDeal=true | — | GameFeelDirector | 否 |
| 11 | hero 行动时训练助手显示建议 | ✅ 探针 trainingDecisionSeen=true | — | TrainingAssistantLayer | 否 |
| 12 | equity/pot odds/SPR 有值 | ✅ 探针 winPct=32/potOdds=40/spr=1247.9 | SPR 深筹码/小池时数值很大(数学正确，可考虑封顶显示) | TrainingAssistantLayer/ui.js | 否 |
| 13 | 行动后 History 增加记录 | ✅ 探针 historyHasContent=true | — | HistoryLayer/ui.js | 否 |
| 14 | 快捷语气泡+自动消失 | ✅ test-ui P341（气泡显示+_t 定时器） | — | ChatEmojiLayer/SeatView | 否 |
| 15 | 快捷语冷却 | ✅ test-ui P341（5s 内拦截，过后可发） | — | ChatEmojiLayer | 否 |
| 16 | emojiMount 触发表情 | ✅ test-ui P341（pop-anim） | — | ChatEmojiLayer | 否 |
| 17 | giftMount 触发礼物 | ✅ test-ui P341（pop-anim+清理） | — | GiftAnimationLayer | 否 |
| 18 | all-in 强反馈 | 🔎 逻辑✅(flashAllIn+systemTrigger+ha-mark allin，P341)；25 手被动自测未自然触发 all-in | 需真机主动 all-in 验证视觉 | ui.js/GiftAnimationLayer | 否 |
| 19 | 摊牌逐家 reveal | ✅ test-ui E；视觉需真机 | — | HighlightDirector/CardRow | 否 |
| 20 | 赢家 best5 高亮 | ✅ test-ui；视觉需真机 | — | ui.js highlightBest5 | 否 |
| 21 | 底池飞向赢家 | 🔎 逻辑✅(PotWin/flyChip)，视觉需真机 | — | gamefeel/Fx | 否 |
| 22 | 赢家筹码数字变化正确 | ✅ test-engine 守恒 + rollNumber 滚动 | — | ui.js/GameFeelDirector | 否 |
| 23 | 本手结束有总结 | ✅ 探针 summarySeen=true | — | TrainingAssistantLayer | 否 |
| 24 | Modal 打开禁用 ActionPanel | ✅ 探针 modalOpenLive + P341 disableAll | — | ModalLayer | 否 |
| 25 | Modal 关闭恢复 ActionPanel | ✅ 探针 modalClosedLive + onClose 恢复 | — | ModalLayer/ui.js | 否 |
| 26 | 退出确认可用 | ✅ 探针 exitModal=true（设置→退出） | — | ModalLayer/ui.js | 否 |
| 27 | 补充训练筹码可用 | ✅ 逻辑(openTableModal rebuy→加本地筹码)；建议真机点一次确认 | 未单独探针点击 | ModalLayer/ui.js | 否 |
| 28 | 复盘入口可点击 | ✅ 逻辑(data-replay-hand→openReplay 接线) | — | HistoryLayer/ui.js | 否 |
| 29 | 连打 20 手无卡死 | ✅ 探针 handsPlayed=20–25, crash=false | — | 全链 | 否 |
| 30 | 连打无筹码不守恒 | ✅ test-engine 21k 手 0 不守恒 | — | core/poker | 否 |

无阻塞项。

## 7. 视觉证据
**本环境无法截图**（headless jsdom 不产生像素；无连接的真机/模拟器）。不伪造截图。真机验收时应看的画面点：
1. 桌前初始：9 座有头像 emoji + 昵称 + 风格标签（如「老紧/岩石型」），底池 0。
2. 发底牌中：牌从中央牌堆位飞向各座（你应看到牌**先是背面/空，飞到后才翻面**，不是凭空出现）。
3. flop 后：三张公共牌**依次**飞入翻开（非一次性蹦出）。
4. hero 行动：底部 `#hand-hint` 一行短提示（牌型·胜率%·建议），点「详」展开胜率/底池赔率/SPR/理由。
5. History：`#hand-strip` 顶部出现「#手号 街道」+ 最近行动（位置标签+昵称+动作+金额），尾部近期手净额。
6. 快捷语气泡：座位上方冒出气泡，约 2.6s 自动消失；5s 内连发会被拦。
7. 礼物/表情：目标座位 giftMount/emojiMount 一次性弹跳动画。
8. 摊牌：未弃对手手牌**逐家**翻面（非同时全亮）。
9. best5：构成最优 5 张的牌描金边。
10. 赢池后：筹码从底池飞向赢家座位，座位筹码数字滚动增加。
11. Modal：点右上 ⚙ 弹出「牌桌设置」浮层（教练/音效/快捷语/补充筹码/退出），此时行动按钮被禁用；关闭后恢复。

## 8. 已知缺陷
- 无阻塞缺陷。轻微：
  - SPR 在「深筹码 vs 极小底池」（如翻前）时数值很大（数学正确）。可后续封顶/格式化显示，本轮未做（属显示打磨，不在 3/4.1 范围）。
  - 18 号 all-in 强反馈：逻辑已测，但 25 手被动自测未自然出现 all-in，视觉强反馈待真机主动制造 all-in 验证。
  - reducer-adapter 对手只有昵称/emoji 头像，无真实头像图（程序化 emoji 兜底，符合「无资源则默认头像」）。

## 9. 仍未达参考 IPA / 已知小尾巴（如实）
1. **ui.js 行数未净减**（2363→2391，+28）：渲染 DOM 已全移入层，增量来自 ViewModel 构建器（buildSeat/Training/HistoryVM）与桌内交互编排（openTableModal/层接线）——属许可的「GameState→TableViewModel + 调 render + 接 action」职责，但行数确实没降。
2. **31 个大厅面板未迁移**，留 Phase 5。
3. **ModalLayer 的 handDetail/strategy/summary**：是**通用 html 通道 + open API**，目前 ui.js 主动接线的入口只有 settings/exit/rebuy/quickword；handDetail/strategy/summary 暂无独立桌内入口（可经 open 调用）。
4. **本手总结**：现由 **TrainingAssistantLayer 的 summary 模式**承载于 #hand-hint，**不弹 Modal**（避免打断节奏）；ModalLayer 的 'summary' 通道保留但未自动弹出。
5. **达不到参考 IPA 级别之处**：发牌/翻牌/派彩的动画曲线、音画同步、座位光效层次、3D/粒子级爽感、皮肤切换的视觉密度仍弱于商业品；本轮只做「桌内信息密度 + 内容层闭环」，未做高级视觉打磨。
6. **占位层**：14 层中 TableBackgroundLayer/TableFeltLayer/BetChipLayer 仍是薄包装（桌布/背景/下注筹码堆为既有 DOM，未做独立富渲染）；5 内容层已实装。
7. **空节点**：SeatView 22 节点均由数据驱动显隐（无数据则 hidden，非空占位）；giftMount/emojiMount 仅在触发时填充（设计如此，非「空占位 bug」）。
8. **只验结构不验体验的测试**：CardSlot 飞行、flop 依次翻、派彩飞行、best5 描金等**视觉**项，test-ui 验的是 DOM/逻辑（reveal 时机、freshFrom、data-ck、class），**不验像素动画**——这些标了「视觉需真机」。

## 10. 不进入 Phase 5 的原因
按指令：本阶段为代码验收 → 真机体验验收，不开新功能。Phase 5（大厅成长/31 面板迁移）会扩大范围、引入新风险，须待你真机玩 20 手确认桌内体验达标后再决定。当前桌内骨架+发牌管线+内容层+对手数据已闭环并测试通过，但**视觉爽感与参考 IPA 仍有差距**，应先以真机体验定优先级，而非堆功能。

## 下一阶段建议
1. 先真机玩 20 手，按 §6/§7 画面点逐条核对视觉（尤其 4/7/8/18/19/21 这些「需真机」项）。
2. 若视觉达标 → 可议 Phase 5（大厅）或「视觉打磨 Sprint」（动画曲线/音画同步/座位光效/SPR 显示封顶）。
3. 若发现视觉缺陷 → 开「桌内视觉打磨」专项，不进 Phase 5。
4. all-in 强反馈、补充筹码、复盘入口建议真机各点一次确认交互闭环。
