# 01 · 参考 IPA 清洁室清单（只读分析，不复制任何资源）

> 来源：`reference/target.ipa`（=微信收到的 `传奇德州扑克-2.1.8(1).ipa`，320MB，md5 `edb95f1c…`）。
> 方法：解包到 `/tmp/refipa` 只读分析，解析 `assets/resources/config.json` 资源清单。**只统计与抽象，未复制任何图片/音频/字体/prefab/代码/文案。**

## IPA 文件结构

```
target.ipa (Zip, store 压缩, 320MB)
└─ Payload/
   └─ allin-mobile.app/
      ├─ allin-mobile            (Mach-O arm64, 24.5MB 主程序)
      ├─ main.js / project.json  (Cocos 启动)
      ├─ assets/                 (internal / main / resources 三个 bundle)
      ├─ src/                    (cocos2d-jsb.jsc 等编译字节码)
      ├─ jsb-adapter/            (JSB 适配层)
      ├─ Frameworks/             (PLPlayerKit.framework = 七牛播放)
      ├─ GCloudVoice.bundle      (腾讯实时语音)
      ├─ NTESResource/NTESVerifyCodeResources.bundle (网易盾验证码/防作弊)
      ├─ SensorsAnalyticsSDK.bundle (神策统计)
      └─ launch2.jpg / AppIcon*  (开屏/图标)
```

## 是否是 Cocos / JSB 结构

**是。** 证据：`main.js` + `project.json`(`project_type: javascript`, `modules:["cocos2d"]`, `engineDir: frameworks/cocos2d-html5`) + `src/cocos2d-jsb.jsc` + `jsb-adapter/` + `assets/*/index.jsc`。即 **Cocos Creator 2.x 原生 JSB 包**，脚本以 `.jsc` 字节码形式存在（不可直读，也不分析其代码——仅看资源结构）。

## Payload 内 app 目录结构

见上。三 bundle：`internal`(引擎内置)、`main`(场景/逻辑资源)、`resources`(动态加载资源主体)。

## assets/resources/config.json 是否存在

**存在**（365KB）。`main/config.json`(7.2KB)、`internal/config.json`(1.3KB) 亦在。
`resources` 清单字段：`paths`=**3133**，`uuids`=**8603**，`encrypted=true`，`isZip=false`。

## 资源 path 数量

**resources bundle：3133 条 path / 8603 uuid。**（main/internal bundle 另含场景与引擎资源，未逐条展开。）

## 按类型统计（resources bundle，`types` 字段）

| 数量 | 类型 |
|---:|---|
| 1117 | cc.SpriteFrame |
| 1117 | cc.Texture2D |
| **431** | **cc.Prefab** |
| **187** | **cc.AudioClip** |
| 140 | cc.Asset |
| **139** | **sp.SkeletonData（Spine 骨骼动画）** |
| 2 | cc.JsonAsset（`config/gameConfig`、`config/gameTeachConfig`） |

## 按顶层目录统计

| 数量 | 目录 |
|---:|---|
| 1794 | textures |
| 559 | animations |
| 431 | prefabs |
| 187 | sound |
| 160 | res |

## prefab 数量

**431**。二级：`prefabs/hall` **330**、`prefabs/table` **55**、`prefabs/login` 11、`prefabs/common` 35。

## textures 数量

**1794**。二级：`textures/cards` **814**、`textures/common` 480、`textures/hall` 354、`textures/table` 146。

## animations 数量

**559**（含 139 个 Spine SkeletonData）。二级：`animations/desk` **258**、`animations/hall` 181、`animations/common` 64、`animations/freeEmoji` 48、`animations/giftbox`/`login` 各 4。

## sound 数量

**187**。二级：`sound/table` **53**、`sound/magic` 40、`sound/quickWords` **28**、`sound/other` 19、`sound/LegendarySeason` 18、`sound/joinShow` 15、`sound/hall` 14。

## table 相关资源数量

- `textures/table` 146 ＋ `prefabs/table` 55 ＋ `animations/desk` 258 ＋ `sound/table` 53 ＝ **约 512 项专供牌桌**。
- `prefabs/table` 模块：history 7、jackPot 6、chat 4、gitLayer 3、ChangeTable/WatchLayer/changePoker/tip/pendant 各 2，外加 chip/poker/winningStreak/LevelUpLayer/bankrupt/season/vPrefabCardType/MttRealtimeInfoLayer/pokerPay/vReport 等单体 prefab。

## hall 相关资源数量

- `textures/hall` 354 ＋ `prefabs/hall` 330 ＋ `animations/hall` 181 ＝ **约 865 项专供大厅**。
- `prefabs/hall` 重模块：legendarySeason **101**、myInfoNew 16、gameTeam 16、Exchange 14、achievementWall 13、seasonActivity/onlineRecord 9、hotActivity/rank 8、email/loopSign/invite/passport 6-7，外加 shop/turntable/mysteryShop/dailySignUp/goldenPig/luckyChoice/packet 等约 40 模块。

## card 相关资源数量

`textures/cards` **814**，分 **20 套牌面皮肤**：cards1=142、cards2~6 各 112（主力 6 套），cards7~20 各 8（小图/缩略）。即牌面/牌背是参考包最大单一视觉体系。

## audio 相关资源数量

**187** AudioClip。牌桌音效粒度极细（`sound/table` 53 个，含 `dealCard/flop_cards/actionFold/actionCheck/actionCall/actionBet/actionRaise/actionAllIn/win/Jackpot1/secutiveWinner/unlock_watch` 等**逐动作独立音轨**）＋ 28 条快捷语音 ＋ 40 条礼物互动音。

## animation 相关资源数量

**559**（其中 Spine 139）。牌桌动画 `animations/desk` 258：magicEmoji 110、fire 40、seasonActivity 28、win 16、watch 16、topPlayerNotification 16、chipToMe 8、jackpotLight/actionLight/luckyCoin 各 4。大厅 `animations/hall` 181：legendLife 72、achivementWall 52、index 24、flyCoin 12。

## 技术层指纹（仅记录成熟度，**均不在本地训练版范围**）

Cocos/JSB · 腾讯 GCloudVoice 实时语音 · 网易盾验证码/防作弊 · 神策统计 · 七牛 PLPlayerKit · 微信 SDK(`wx9aa3611ec429110a`) · openinstall · 相机/相册/麦克风权限。→ 证明参考是**完整在线真钱社交产品**；我方铁律为纯本地、不联网必需、不真钱、不语音包、不统计，故技术层**主动不对标**，只对标功能层级与组件复杂度。
