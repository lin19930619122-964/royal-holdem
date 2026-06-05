# 07 · 大厅与成长系统差距

> 依据：参考 `prefabs/hall` 330（02 已列模块）vs `src/store.js` DEFAULT 持久化字段 + `ui.js` 面板。
> 我方面板"数量"其实齐全，差距在**成长深度、视觉体量、长期目标牵引**。

## 成长系统逐项

| 成长系统 | 参考体量 | 我方实现(store/ui) | 差距判定 |
|---|---|---|---|
| 玩家等级 XP | masterLevel 4 prefab + `animations/desk/addMaster` 12 | `xp/level` + `levelInfo` + 升级弹窗 | 🟡 数值有，无大师段位视觉/进度动画 |
| 赛季 / 通行证 | **legendarySeason 101** + passport 6 + `legendLife` 72 动画 | `seasonId/seasonXp/seasonLevel/seasonClaimed` + 文字赛季轨 | ❌ 视觉体量差 1~2 个数量级；无赛季活动/赛季成就/赛季皮肤线 |
| 成就 | achievementWall 13 + `achivementWall` 52 动画 | `achvClaimed` + ≥18 成就面板 | 🟡 有数据，无成就墙动画/分类/稀有度展示 |
| 排行榜 | rank 8 + scoreRankFee 2 | `rankInfo/recordRank` 积分段位 | 🟡 本地段位有，无多榜(财富/胜率/连胜/赛季) |
| 每日任务 / 新手任务 / 活跃任务 | activeTask5/noviceTask3 | `getTasks/claimTask` + 每日 | 🟡 齐但浅 |
| 签到(日/循环) | dailySignUp4 + loopSign6 | `lastCheckin/checkinStreak` + 签到 | ✅ |
| 商店 / 限时特惠 / 秘宝 | shop4 + dailySpecial2 + mysteryShop3 | `shop/mysteryShop` 面板 | 🟡 |
| 转盘 / 金猪 / 红包 | turntable3 + goldenPig2 + packet3 | `doSpin/WHEEL` + `goldenPig` + vault | ✅ |
| 兑换 | Exchange 14 | `codec.js` 兑换码 | 🟡 仅码兑换，无礼包货架 |
| 邮件 | email 7 | `claimMail` | ✅ |
| 邀请 / 回流 | invite6 + backSignUp5 | `invite` 面板 | 🟡 占位 |
| 战队 / 俱乐部 | gameTeam 16 | `club` 面板 | 🟡 占位为主 |
| 个人资料 | myInfoNew16 + userInfo4 | `profile` 面板 | 🟡 无身份/外观/数据三段式 |
| 外观(头像框/称号/座驾/手表/场景) | res/common 136 + pendant | `ownedFrames/Titles/Vehicles/Watches/Scenes` | ✅ 数据齐，视觉素材少 |
| 破产救济 | bankrupt/bankruptCharge | store 救济金 | ✅ |
| 训练系统(我方差异点) | 仅 NoviceTable + gameTeachConfig | Lessons6 + strategyLab + 复盘 + VPIP/PFR/AF 统计 | ✅ **我方更强**，应继续放大 |

## 核心差距结论

1. **不是缺模块，是缺深度与视觉牵引**：面板项目数与参考接近，但每个模块停留在"文字列表 + 领取按钮"，缺少参考那种「赛季 101 prefab、成就墙 52 动画、大师段位」级别的长期目标感与仪式感。
2. **赛季是最大单点差距**：参考用赛季(101)做大厅最重留存核心，我方仅文字轨。
3. **本地化是我方天然优势**：参考成长全靠在线服务器存档，我方 `store.js` 本地存档反而契合"纯本地训练"铁律——应把成长做"厚"在本地，不引入联网依赖。
4. **训练系统应反向超越**：参考训练薄(NoviceTable+图文)，我方已有 equity/范围/复盘/统计/课程——这是说明书要求"在训练上超越参考"的着力点。
