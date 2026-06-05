# 02 · 参考 App 成熟产品地图（抽象，不复制文案/资源）

> 依据：01 的资源结构（4 个 `.fire` 场景 + `prefabs/hall` 330 + `prefabs/table` 55 + `config/gameTeachConfig`）反推功能层级。仅抽象「有哪些系统、信息密度多高」，不抄具体文案/图。
> 标注：✅ 我方已有（即便薄）｜🟡 我方部分/占位｜❌ 我方缺｜🚫 我方铁律不做。

## 场景骨架（参考 = 4 个真实场景）

| 参考场景 | 依赖数 | 我方对应 | 状态 |
|---|---:|---|---|
| `gameLogin.fire` | 143 | `launch`+`login`（开屏后直进，无账号） | ✅(简化) |
| `gameHall.fire` | 170 | `hall`+`select` | 🟡 |
| `gameTable.fire` | 142 | `table` | 🟡 |
| `gameTableNovice.fire` | 164 | 无独立新手桌（教程是图文 overlay） | ❌ |

## 产品地图逐项

| 模块 | 参考证据（prefab/资源） | 我方现状 | 状态 |
|---|---|---|---|
| **Launch / Login** | `gameLogin.fire`, `launch2.jpg`, 微信/一键登录 SDK | 程序化开屏 Canvas + 直进大厅 | ✅(无账号体系) |
| **Hall** | `gameHall.fire`, `prefabs/hall` 330 | `ui.js` 渲染 ~30 面板 | 🟡 信息密度远低 |
| **Table** | `gameTable.fire`, `prefabs/table` 55, `animations/desk` 258 | DOM 牌桌 | 🟡 层级薄(见 03) |
| **NoviceTable** | `gameTableNovice.fire`(164 依赖)独立新手桌 | 无；仅 `tutorial` 图文 overlay | ❌ |
| **Tutorial** | `config/gameTeachConfig`(JsonAsset)=脚本化教学 | `core/Lessons.js` 6 课 + 5 页图文 | 🟡 有但非桌内引导 |
| **Profile** | `prefabs/hall/myInfoNew` 16 + `myInfo` 5 + `userInfo` 4 | `profile` 面板 | 🟡 |
| **Achievement** | `achievementWall` 13 + `animations/hall/achivementWall` 52 | `achievements` 面板(≥18) | 🟡 无动画墙 |
| **Level / Rank** | `masterLevel` 4 + `rank` 8 + `scoreRankFee` 2 | `rank` 面板 + 等级 | 🟡 |
| **History** | `prefabs/table/history` 7 | `tableHistory`+handLog | ✅ |
| **Replay** | （history 内含逐手回看） | `replay` 逐步回放 | ✅ |
| **Skin** | 头像框/桌布/挂件 `pendant` 2 + `res/common` 136 | `skins.js` 29 桌布 | 🟡 |
| **Card Skin** | `textures/cards` 814 = **20 套** | 57 牌背(无牌面皮肤，牌面是 CSS) | 🟡 |
| **Quick Words** | `sound/quickWords` 28 | `social.js` 文本快捷语 | ✅(无语音) 🚫语音 |
| **Emoji** | `animations/desk/magicEmoji` 110 + `freeEmoji` 48 | `Social.EMOJIS` ≥8 文本表情 | 🟡 无骨骼动画 |
| **Gift** | `prefabs/table/gitLayer` 3 + `sound/magic` 40 + `animations/giftbox` | `flyGift` 程序化 | 🟡 |
| **Settings** | `prefabs/hall/setting` 2 | `settings` 面板 | ✅ |
| **Local Data** | （在线，服务器存档） | `store.js` localStorage | ✅(本地优先，反而是我方契合点) |
| **Training System** | `gameTeachConfig` + NoviceTable | Lessons + strategyLab + 复盘 + 统计 | 🟡 训练维度其实可超越参考 |
| 赛季/通行证 | `legendarySeason` **101** + `passport` 6 + `animations/hall/legendLife` 72 | `season`/`passport` 文字面板 | 🟡 视觉体量差距巨大 |
| 战队/俱乐部 | `gameTeam` 16 | `club` 面板占位 | 🟡 |
| 兑换/邮件/签到/转盘/邀请/限时商店 | Exchange14/email7/loopSign6/turntable3/invite6/mysteryShop3 | 均有对应面板 | ✅ 数量齐、深度浅 |
| 桌内奖池 Jackpot | `prefabs/table/jackPot` 6 + `animations/desk/jackpotLight` | 无单机奖池 | ❌ |
| 旁观/换桌 | `WatchLayer`/`ChangeTable` 各 2 | 联机端有，单机牌桌无 | 🟡 |
| 破产救济 | `bankrupt`/`bankruptCharge` | store 有救济金 | ✅ |
| 连胜展示 | `winningStreak` + `animations/desk/win` 16 | `streakFlame` | 🟡 |

## 抽象结论（不是抄，是认结构）

参考的"成熟"由四层叠加：**产品层(大厅 ~40 模块) × 牌桌层(社交/奖池/旁观/逐动作反馈) × 资源层(3133 项、139 Spine) × 技术层(在线/真钱/语音/统计)**。
我方应**只继承前两层的"功能层级与信息密度"**，技术层(真钱/在线/语音/统计)按铁律不做，且把**训练系统**做成我方差异化超越点（参考的训练仅 NoviceTable+图文，我方有 equity/范围/复盘/统计/课程）。
