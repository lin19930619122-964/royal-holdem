# 参考 IPA 资源清单（事实层 / 只读拆解）

> 本文档仅记录从参考包**只读**采集的事实：文件清单、类型/数量统计、目录层级、资源命名、图片尺寸、音频数量。
> **不含**任何被复制的图片/音频/字体/动画/prefab/代码，也不导入任何参考素材。
> 采集方式：`unzip -l`（仅列清单）+ 抽取 `config.json` 资源清单与少量样本图做尺寸统计；样本文件落在 `/tmp` 临时目录，**未进入本项目**。

采集日期：2026-06-04 ｜ 采集者：清洁室审计

---

## 0. 包身份

| 项 | 值 |
|---|---|
| 文件名 | 传奇德州扑克-2.1.8.ipa |
| 体积 | 320 MB |
| 包内文件数 | 13,818 |
| App 包 | `Payload/allin-mobile.app` |
| 引擎 | Cocos2d-html5（`project.json`: `project_type: javascript`, `frameRate: 60`, `renderMode: 0`, `engineDir: frameworks/cocos2d-html5`） |
| 脚本形态 | `.jsc`（9 个，加密/编译字节码，**不反编译、不复用逻辑**） + `jsb-adapter`（JSB 桥） |
| 启动 | `LaunchScreen.storyboardc`（原生 LaunchScreen）+ `launch2.jpg` |
| 方向 | iOS 竖屏 App |

### 合规标记（说明为何不可当干净原包）
- `SC_Info/`、`.sinf`、`.supp/.supf/.supx`：App Store FairPlay DRM 痕迹。
- `.Dump_GBLW.txt`：dump 标记（说明该包是被 dump 出来的，非干净分发包）。
- `_CodeSignature/`：签名目录（按任务约束：不破解、不绕过签名、不修改再分发）。
- 资源 `config.json` 标记 `encrypted` 字段。

> 结论：参考包是加密 + DRM + dump 痕迹的二进制包。我们**只读取其公开文件结构与命名**用于功能抽象，不做反编译、不复用资源与逻辑。

---

## 1. 原生 SDK / 商业能力痕迹（来自 Frameworks / bundles 命名）

| 痕迹 | 推断能力 | 我们项目的态度 |
|---|---|---|
| `Frameworks/PLPlayerKit.framework` | 七牛播放器（媒体/直播） | 不需要 |
| `GCloudVoice.bundle` | 实时语音（腾讯 GCloud） | 训练版不接麦克风 |
| `NTESResource.bundle` / `NTESVerifyCodeResources.bundle` | 网易盾验证码 / 一键登录 / 风控 | 本地版无需账号风控 |
| `SensorsAnalyticsSDK.bundle` | 神策数据分析 | 本地版不采集上报 |
| `Assets.car` | 原生 App 图标/启动图编排 | 我们用 PWA/Capacitor 壳 |

这些都是**商业联网/变现/风控**配套，本地训练 App 全部不需要。

---

## 2. 文件类型直方图（全包 13,818 文件）

| 扩展名 | 数量 | 说明 |
|---|---|---|
| `.json` | 8,809 | Cocos 资源元数据（import 层，UUID 命名） |
| `.pkm` | 2,559 | ETC 压缩纹理（GPU 纹理块） |
| `.png` | 1,187 | 位图纹理 |
| `.mp3` | 187 | 全部音频 |
| `.atlas` | 140 | 图集/骨骼动画图集 |
| `.jpg` | 108 | 位图（多为大图/背景） |
| `.plist` | 9 | 配置 |
| `.jsc` | 9 | 加密脚本字节码 |
| `.ttf` | 4 | 字体（msyh / msyhbd / FZZCHJW / FZZhengHeiTFan，均为第三方商业字体，不复制） |
| `.js` | 5 | 引擎引导脚本 |
| 其余 | — | nib / strings / DRM 文件等 |

---

## 3. assets 目录层级

```
assets/
├── internal/   (9)        引擎内置
├── main/       (523)      启动包：config.json(7.2K) + import(336) + native(184) + index.jsc
└── resources/  (13,184)   主资源包
    ├── config.json (365K)  ← 资源清单：3,133 条逻辑资源路径
    ├── index.jsc
    ├── import/  (8,855)    UUID 命名的 .json 元数据
    └── native/  (4,326)    UUID 命名的 .png/.pkm/.mp3/.ttf 实体
```

实体资源（图/音/字体）都以 **UUID 命名**散落在 `native/`，人类可读的功能命名只存在于 `config.json` 的 `paths` 映射里。

---

## 4. 资源清单类别统计（来自 resources/config.json，3,133 条路径）

> 与既有基线完全吻合（已逐项复核）。

| 顶级类别 | 数量 |
|---|---|
| textures | 1,794 |
| animations | 559 |
| prefabs | 431 |
| sound | 187 |
| res | 160 |
| config | 2 |
| **合计** | **3,133** |

### 4.1 textures（1,794）
| 子类 | 数量 | 说明 |
|---|---|---|
| cards | 814 | 牌面/牌背皮肤，约 **20 套**（cards1…cards20） |
| common | 480 | 通用 UI、头像、头像框、奖励图标、徽章 |
| hall | 354 | 大厅活动/赛季/商城/等级 |
| table | 146 | 牌桌背景/主题/语音条/支付 |

牌皮细分：`cards1`(142) 为最全套，`cards2…cards6`(各 112) 为完整 5 套，`cards7…cards20`(各 8) 为轻量套 → **约 20 套牌皮体系**。

牌桌主题（`textures/table/bg`）：`bg / bg1…bg17 / bgX1…bgX17 / bgsmall1…16 / deskBgNewSmall1 / pokerSkin1 / tableSkin_hai_X` → **16+ 套牌桌主题**，每套含大图 / 小图 / X(宽屏)变体。

### 4.2 prefabs（431）—— 功能页面密度
| 子类 | 数量 |
|---|---|
| hall | 330 |
| table | 55 |
| common | 35 |
| login | 11 |

详见 `reference-product-map.md` 的模块拆解。

### 4.3 animations（559）
| 子类 | 数量 | 说明 |
|---|---|---|
| desk | 258 | 牌桌特效：magicEmoji(110)、fire(40)、seasonActivity(28)、win(16)、watch(16)、topPlayerNotification(16)、addMaster(12)、chipToMe(8)、luckyCoin/jackpotLight/actionLight |
| hall | 181 | 大厅特效：legendLife(72)、achivementWall(52)、index(24)、flyCoin(12)、guide/enterTable(8) |
| common | 64 | 通用 |
| freeEmoji | 48 | 免费表情 A–L 各 4 帧（12 组） |
| login | 4 / giftbox 4 | — |

### 4.4 sound（187）
| 子类 | 数量 | 内容 |
|---|---|---|
| table | 53 | 行动音（fold/check/call/raise/bet/allin）、发牌 dealCard/flop、筹码 raise_chip、连胜火焰 fire/1…9、win、升级、解锁、各类提示 |
| magic | 40 | 礼物/互动音效（啤酒/番茄/玫瑰/炸弹/龙/鲨鱼/香槟…） |
| quickWords | 28 | 快捷语音 = 14 句 × 男(nan)/女(nv) 两套 |
| other | 19 | 成就翻牌、宝箱、bgm、home_0…4、奖励飞币 |
| LegendarySeason | 18 | 赛季 bgm + 转盘 run1…6/stop1…6 + 金宝箱 |
| joinShow | 15 | **载具入场**音：自行车/汽车/摩托/火车/游艇/直升机/飞毯/冲浪/雪橇… |
| hall | 14 | 大厅：大牌 bigCard、金币、金猪、新手礼盒、转盘、赛季宝箱 |

### 4.5 res（160）：common(136) + hall(24) —— 配置/数据表类。

---

## 5. 图片尺寸抽样（60 张 native PNG，`sips` 读取）

分布跨度：小图标 `32×28 / 51×55 / 68×44` … 中件 `320×320 / 440×440 / 460×460` … 大件 `796×796 / 894×894 / 992×992` … 全屏竖图 `919×1412`、宽件 `703×333 / 778×253`。

结论：**Retina 级**资源，最大边可达 ~1400px，存在整屏竖版立绘/背景。这是 320MB 体积的主要来源（位图 + ETC 纹理双份 + 多套皮肤/主题）。

---

## 6. 字体

4 个 `.ttf`：`msyh.ttf`（微软雅黑）、`msyhbd.ttf`（雅黑粗）、`FZZCHJW.ttf`、`FZZhengHeiTFan.ttf`（方正系）。
均为**第三方商业字体**，本项目不复制；改用系统字体或自带可商用字体。

---

## 7. 一句话总结

参考包用 **3,133 条逻辑资源 / 13,818 文件 / 320MB** 堆出成熟度，其重量来自：①约 20 套牌皮 + 16+ 套牌桌主题；②大厅 330 个 prefab 的功能密度（赛季独占 ~101）；③559 条动画 + 187 条音频的多层反馈。
这些是**成熟度参考**，不是搬运目标——下一份文档把它抽象成功能地图，再下一份转为可原创实现的独立规格。
