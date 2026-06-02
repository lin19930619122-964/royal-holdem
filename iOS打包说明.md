# 把皇室德州装进 iPhone

## ★ 推荐（有巨魔 TrollStore）：云端编译 + 巨魔永久安装

巨魔能直接装**未签名 .ipa**，永久有效、无需 Apple ID、无 7 天到期。
所以只剩"编译出 .ipa"，用 GitHub 云端 Mac 做，你本地零安装：

1. 本项目推到一个 GitHub 仓库：
   ```bash
   cd "royal-holdem-mobile"
   git init && git add -A && git commit -m "royal holdem"
   git branch -M main
   git remote add origin https://github.com/<你的用户名>/<仓库名>.git
   git push -u origin main
   ```
2. 仓库网页 → **Actions** → 选「构建未签名 iOS IPA」→ **Run workflow**
   （联机服务器地址可留默认 Tailscale 地址）。
3. 跑完(约 5-10 分钟) → 该次运行底部 **Artifacts** 下载 `royal-holdem-unsigned-ipa` → 解压得到 `.ipa`。
4. 把 `.ipa` 传到手机（AirDrop / 微信文件），用**巨魔 TrollStore** 打开 → Install → 永久装好。

> 巨魔会自动 ad-hoc 签名，未签名 .ipa 正合适。bundle id `com.royalholdem.app`，名字「皇室德州」。
> 单机完全离线内置；联机连打包时写入的 Tailscale 服务器（需电脑服务在跑 + 手机同 Tailnet）。

---

## 其它方式

> 重要：.ipa 是编译产物，**编译 iOS 程序必须有带 Xcode/iOS SDK 的 Mac 环境**。
> 你这台 Mac 目前只有命令行工具、没有 Xcode，所以本机出不了 .ipa。下面给出可行的三条路。

---

## 方式一：描述文件（最快，无需 Xcode，对应你说的「VPN 与设备管理」）

文件已生成：`royal-holdem.mobileconfig`

1. 电脑保持游戏服务在跑：双击 `启动服务.command`，并 `tailscale serve --bg 8099`。
2. 把 `royal-holdem.mobileconfig` 发到手机（AirDrop / 微信文件传输 / 邮件均可）。
3. iPhone 打开它 → 提示「已下载描述文件」。
4. 设置 → 通用 → **VPN 与设备管理** → 点「皇室德州·主屏图标」→ **安装**。
5. 主屏出现「皇室德州」图标，点开全屏运行。

> 说明：这是「全屏网页图标(WebClip)」，通过你描述的设备管理流程安装。它加载的是
> 你 Mac 上的服务（Tailscale 地址），所以需要服务在跑。重新生成指向别的地址：
> `node gen-webclip.js https://你的地址/`

---

## 方式二：真·.ipa（本地 Xcode）—— 你要的「打包成 ipa，自己签名」

需要先装：
- **Xcode**（Mac App Store，免费，约 15GB）。装完执行：`sudo xcode-select -s /Applications/Xcode.app`
- **CocoaPods**：`sudo gem install cocoapods`（或 `brew install cocoapods`）

然后一条命令产出**未签名 .ipa**：
```bash
cd "royal-holdem-mobile"
bash build-ipa.sh                       # 或 bash build-ipa.sh 你的联机服务器主机
```
产物：`royal-holdem-unsigned.ipa`

**签名安装（你自己来，三选一）**：
- **爱思助手**：连接 iPhone → 工具箱 → IPA 签名（用你的 Apple ID）→ 安装。
- **Sideloadly / AltStore**：拖入 .ipa → 输入你的 Apple ID → 安装。
- 安装后：iPhone 设置 → 通用 → **VPN 与设备管理** → 点你的开发者账号 → **信任**。

> 免费 Apple ID 签名 7 天到期，过期重签即可；付费开发者账号($99/年)有效期 1 年。

---

## 方式三：云端编译（不在你 Mac 装 Xcode）

用 GitHub Actions 的 macOS 机器替你编译，产出未签名 .ipa：

1. 把本项目推到一个 GitHub 仓库（已含 `.github/workflows/ios-ipa.yml`）。
2. 仓库 → Actions → 选「构建未签名 iOS IPA」→ Run workflow（可填联机服务器地址）。
3. 跑完在该次运行的 **Artifacts** 下载 `royal-holdem-unsigned-ipa`。
4. 解压得到 .ipa，按方式二的「签名安装」用你的工具签名安装。

---

## 单机 vs 联机说明

- **单机**：完全内置在 App 里，离线可玩（金币/签到/商店/兑换码/皮肤/动画全在）。
- **联机（真人对战）**：App 连的是你 Mac 上的服务器（打包时写入的 Tailscale 地址）。
  联机时需电脑服务在跑 + 手机在同一 Tailnet。改地址重新打包即可。
