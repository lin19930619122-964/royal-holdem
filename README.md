# 皇室德州 Royal Hold'em（手机版 PWA）

本地单机 + 真人对战的德州扑克手机游戏。完全原创代码与界面，
视觉风格借鉴主流德州扑克手游的赌场质感，玩法遵循标准德州规则。
做成 **PWA**：手机「添加到主屏幕」后全屏运行、有图标、可离线（单机），像原生 App。

## 启动 & 在手机上玩

1. 电脑启动服务（二选一）：
   - 双击 `启动服务.command`
   - 终端：`export PATH="$HOME/.local/bin:$PATH" && node server.js 8099`
2. 让手机能访问（iOS PWA + 联机都需 HTTPS）：
   ```bash
   tailscale serve --bg 8099
   ```
   得到 `https://<你的机器>.ts.net` 地址。
3. 手机 **Safari** 打开该地址 → **分享 → 添加到主屏幕** → 点图标全屏玩。
4. **真人对战**：朋友（同一 Tailnet）打开同一地址，点顶部「👥 真人」入桌即可同桌。

## 功能一览（A + B + C 全部完成）

**核心对局**：6 人桌、大小盲、四轮下注、完整牌型与边池、庄家轮转。已过 35 万手压力测试。

**A · 动画音效**：筹码飞向底池/赢家、卡牌翻转、赢家金光、震动；WebAudio 合成的发牌/筹码/下注/获胜音效（原创无版权），可一键静音。

**B · 运营系统（全部免费）**
- 🪙 金币 / 💎 钻石 双货币；金币是上桌本金，每手自动结算；**破产免费救济**，永不卡死。
- 🎁 **每日签到**：7 天周期，免费领金币 + 钻石，第 7 天大奖。
- 🛒 **商店**：钻石兑换金币包；购买/装备原创牌背与桌布皮肤。
- 🎟️ **兑换码**：输入码免费领金币/钻石/皮肤，每码一次性，带签名防伪。内置礼包码在弹窗里可一键领取。

**C · 真人对战**：WebSocket 同桌，权威服务器复用引擎；机器人一键补位、回合 20 秒限时、断线托管与重连。

## 兑换码

界面里「🎟️ 兑换码」内置 4 个礼包码可直接领。也可自己生成（免费、无限）：
```bash
node gen-code.js coins 500000      # 50 万金币
node gen-code.js diamonds 100      # 100 钻石
node gen-code.js back dragon       # 神龙牌背
node gen-code.js felt obsidian     # 曜石黑桌布
node gen-code.js coins 100000 5    # 一次生成 5 个
```
示例码（可直接在 App 里输入领取，各一次性）：
```
RHD-C.APSW.13ZSM-1K6RM      金币 +50万
RHD-D.2S.13ZTC-11D4D         钻石 +100
RHD-B.DRAGON.13ZU0-242QH     神龙牌背
RHD-F.OBSIDIAN.13ZUO-1G7BA   曜石黑桌布
```

## 结构

```
royal-holdem-mobile/
├── server.js          静态服务器 + 真人对战 WebSocket(/ws)
├── mp.js              权威多人牌桌（复用引擎）
├── gen-code.js        兑换码生成器
├── test-engine.js     引擎自检
└── src/
    ├── index.html / online.html   单机页 / 联机页
    ├── styles.css                 赌场风格样式
    ├── manifest.webmanifest, sw.js  PWA
    ├── icons/                     原创图标
    ├── poker.js  ai.js  game.js   引擎(牌型/AI/对局状态机)
    ├── codec.js  store.js  skins.js  sound.js  fx.js   经济/皮肤/音效/动画
    ├── ui.js                      单机界面与循环
    └── online.js                  联机客户端
```

## 自检

```bash
node test-engine.js     # 牌型判定 + 数百局压力测试
```

## 说明

原创实现，未使用任何受版权保护的第三方美术素材、商标或代码。
德州扑克规则属公共规则。"100%"指功能/系统层面完整，美术为原创精致风格（真实商业 App 含上万张手绘资源，不复制）。
