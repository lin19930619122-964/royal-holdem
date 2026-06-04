# 参考 App 功能地图（抽象层 / 从公开结构推断）

> 本文档**从文件名与目录结构推断功能**，不复制任何素材/代码。证据列只引用观察到的模块命名作为依据。
> 目的：把参考包还原成一张「成熟德州扑克产品的功能地图」，作为后续清洁室原创规格的输入。

证据来源：`resources/config.json` 的 3,133 条资源路径（详见 `reference-ipa-inventory.md`）。

---

## 0. 成熟度的四层结构

参考包的"成熟感"不是单一华丽界面，而是四层叠加：

| 层 | 内容 | 证据强度 |
|---|---|---|
| **产品层** | 大厅、资料、赛季、成就、俱乐部、排行、邮件、活动、商城、邀请、回流、签到、转盘 | prefabs/hall 330 |
| **牌桌层** | 聊天、礼物、表情、语音、奖池、牌谱、换桌、旁观、桌内排行、行动提示、赢家展示、举报 | prefabs/table 55 + animations/desk 258 |
| **资源层** | 20 套牌皮、16+ 桌布主题、载具入场、连胜火焰、礼物动画、赛季美术 | textures 1794 + animations 559 + sound 187 |
| **技术层** | Cocos/JSB、加密资源、语音、风控、统计、播放器、WebSocket、钥匙串、越狱检测 | Frameworks/bundles |

---

## 1. 启动 / 引导 / 新手

| 观察模块 | 推断功能 |
|---|---|
| `prefabs/login`(11)、`backSignUp` | 登录 / 重新登录 / 账号体系 |
| `guide`、`TeachingLayer`、`prefabs/table/vPrefabTableNovice`、`noviceTask` | 新手引导、教学层、新手任务 |
| `animations/hall/guide`、`enterTable` | 引导动画、进桌动画 |

## 2. 大厅外壳与导航
`textures/hall/index`(34) + `animations/hall/index`(24) → 大厅主框架、入口网格、横幅、跑马灯、bgm（`sound/other/home_0…4`）。

## 3. 个人 / 身份 / 成长
| 观察模块 | 推断功能 |
|---|---|
| `myInfo` / `myInfoNew`(16) / `userInfo` | 玩家资料：头像、数据、外观、身份多合一 |
| `masterLevel`(4) + `textures/hall/MasterLevel`(68) + `textures/common/master`(98) | 大师等级体系（重模块） |
| `achievementWall`(13) + `AchievementLayer` + `textures/common/acheivement`(190) + `animations/hall/achivementWall`(52) | 成就墙（资源极重，长期目标 + 展示） |
| `textures/common/headFrame`(36) / `head`(64) / `avatarRank` | 头像、头像框、头像挂件、头像等级 |

## 4. 赛季体系（参考包最重模块）
`legendarySeason`(101 prefab) + `textures/hall/legendarySeason`(186) + `animations/hall/legendLife`(72) + `sound/LegendarySeason`(18) + `seasonActivity`(9) + `gloryRoad` / `legendLife`。
→ 赛季是大厅第一重模块：赛季等级、荣耀之路、赛季活动、赛季宝箱、赛季 bgm、专属美术。

## 5. 社交 / 竞技
| 观察模块 | 推断功能 |
|---|---|
| `gameTeam`(16) + `textures/common/gtBadge` | 战队 / 俱乐部（社交长期入口） |
| `rank`(8) / `scoreRankFee` / `animations/desk/fameRankBoard` | 排行榜 / 名人堂 |
| `onlineRecord`(9) | 在线 / 战绩记录 |
| `email`(7) | 邮件中心 |
| `invite`(6) / `recommend` / `vLayerInviteRewardPop` | 邀请 / 推荐 / 邀请奖励 |
| `match`(4) + `prefabs/table/MttRealtimeInfoLayer` / `MatchRankLayer` | 锦标赛 / MTT 实时信息 / 赛事排名 |

## 6. 运营 / 活动 / 变现（本地训练版将重解释或裁掉）
| 观察模块 | 推断功能 | 本地版处理 |
|---|---|---|
| `Exchange`(14) | 兑换 / 礼包 | 保留为**训练筹码兑换码** |
| `shop`(4) + `textures/hall/shop`(48) | 商城 / 皮肤 | 保留为**训练筹码商店**（已有） |
| `passport`(6) | 通行证 | 保留为**免费训练通行证** |
| `loopSign` / `dailySignUp`(4) | 循环签到 / 每日签到 | 已有（免费） |
| `turntable`(3) + `luckyChoice` | 转盘 / 幸运抽选 | 已有（免费） |
| `mysteryShop`(3) / `weeklySpecial` / `dailySpecial` | 限时特惠货架 | 重解释为**轮换训练礼包** |
| `goldenPig`(2) / `goldenShark` / `bigCard` | 金猪钱罐 / 金鲨 / 大牌奖励 | 重解释为**里程碑奖励** |
| `packet` / `RedPacketLayer` | 红包 | 重解释为**训练奖励发放** |
| `firstPay` / `enterPay` / `pokerPay` / `vLayerPayRestrictionPop` / `dailyLimit` | 首充 / 入口付费 / 牌桌支付 / 付费限制 | **删除**（不接真钱） |
| `sureWinGift` / `legendaryGift` / `giftCard` / `pendantGift` / `legendaryGift` | 各类礼包 | 重解释为**免费成长礼** |
| `noonNightWelfare` / `midnightCrazy` / `mondayReward` / `holidayThree` / `holidayFour` | 时段/节日福利 | 可选**训练活跃奖励** |
| `onceForLife` / `firstPay` | 限购/一次性 | **删除** |
| `hotActivity`(8) / `activeTask`(5) / `noticeAnnounce` / `gameAnnounce` | 限时活动 / 活跃任务 / 公告 | 保留为**训练任务 + 公告** |
| `propPop` / `propPopInvite` | 道具弹窗 | 重解释为**外观道具** |

## 7. 牌桌核心
| 观察模块 | 推断功能 | 重要性 |
|---|---|---|
| `vPrefabTable` / `poker` / `chip` / `vPrefabAppendChip` / `vPrefabCardType` | 牌桌主体 / 牌 / 筹码 / 补码 / 牌型展示 | 核心 |
| `history`(7) | **牌谱 / 历史记录 / 复盘** | 高 |
| `jackPot`(6) / `JackpotLayer` / `animations/desk/jackpotLight` | 桌内奖池 | 中 |
| `chat`(4) | 牌桌文字聊天 | 高 |
| `gitLayer`(3) + `magicEmoji`(110 动画) + `freeEmoji`(48) + `sound/magic`(40) | 礼物层 + 魔法表情 + 免费表情 | 高（社交感来源） |
| `tip`(2) / `actionLight` | 桌内提示 / 行动光效 | 中 |
| `WatchLayer`(2) | 旁观 | 中 |
| `ChangeTable`(2) | 换桌 | 中 |
| `changePoker`(2) | 换牌 / 特殊玩法 | 低 |
| `pendant`(2) / `pendantGift` | 桌内挂件 | 低 |
| `winningStreak` / `secutiveWinner` + `sound/table/fire/1…9` + `animations/desk/fire`(40) | **连胜火焰**（越连越炸） | 高（情绪价值） |
| `topPlayerNotification`(16 动画) + `vTopPlayerNotification` | 顶级玩家全场通告 | 中 |
| `vReport` | **举报入口** | 安全 |
| `bankrupt` / `bankruptCharge` | 破产 / 破产补充 | 已有（破产救济） |
| `LevelUpLayer` / `addMaster` / `iconUpgrade` | 升级层 / 大师晋升 | 中 |
| `joinShow`(15 音 + `animations/hall/sail`) | **载具入场秀**（汽车/游艇/飞机/摩托…） | 高（炫耀感） |
| `season` / `vLayerSeasonAchievePop` / `vLayerWatchAchievePop` | 桌内赛季 / 成就弹窗 | 中 |
| `pokerPay` | 牌桌支付 | **删除** |

## 8. 音频系统分层（情绪反馈密度）
1. **行动音**：fold/check/call/raise/bet/allin（每动作独立）。
2. **筹码/发牌**：dealCard、flop_cards、raise_chip、appendChip。
3. **结果/连胜**：win、fire/1…9（连胜阶梯）、secutiveWinner。
4. **快捷语音**：14 句 × 男女（挑衅/赞美/认怂/惊讶/催促…）。
5. **礼物互动**：40 条 magic 音效。
6. **载具入场**：15 条 joinShow。
7. **大厅/活动**：home bgm、转盘、签到、宝箱、金猪、赛季 bgm。

## 9. 视觉/动效系统（华丽感密度）
- **牌皮**：~20 套。
- **桌布主题**：16+ 套（大/小/宽屏三态）。
- **连胜火焰**：40 帧动画 + 9 级音效。
- **礼物/表情**：110 magicEmoji + 48 freeEmoji 动画。
- **赛季美术**：186 纹理 + 72 legendLife 动画。
- **成就**：190 纹理 + 52 动画。
- **启动**：深色舞台 + 聚光 + 发光牌桌 + 筹码/牌漂浮 + 星尘 + 纵深走台（氛围参考，非素材）。

---

## 10. 抽象结论（交给清洁室规格）

参考产品 = **一个牌桌核心 + 一个高密度大厅 + 一套多层情绪反馈 + 一套重资源外观体系 + 一套联网/变现/风控技术栈**。

本地训练版的取舍方向：
- **保留并加强**：牌桌核心、牌谱/复盘、连胜情绪反馈、外观体系（程序化/原创轻量）、成长（赛季/成就/任务/等级）、AI 对手与训练分析。
- **重解释为免费训练**：商店、兑换、通行证、签到、转盘、活动、礼包。
- **删除**：一切真钱付费（firstPay/pokerPay/付费限制）、账号风控、统计上报、实时语音麦克风、联网对战服务依赖（保留本地/可选自建）。
- **超越点**：把"history/复盘"从记录升级为**带胜率/赔率对错判定的训练复盘**，并加 **AI 对手画像 + 实时策略提示**（参考包未做透）。
