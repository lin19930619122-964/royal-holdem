#!/bin/bash
# 在【装了 Xcode 的 Mac】上把皇室德州编译成「未签名 .ipa」。
# 之后用你自己的工具(爱思助手/Sideloadly/AltStore/自签证书)签名安装。
#
# 前置：1) 完整 Xcode (App Store 安装)  2) CocoaPods (sudo gem install cocoapods 或 brew install cocoapods)
# 用法：bash build-ipa.sh [联机服务器主机]   默认 m5.tail5255b4.ts.net
set -e
cd "$(dirname "$0")"
export PATH="$HOME/.local/bin:/opt/homebrew/bin:$PATH"
SERVER="${1:-m5.tail5255b4.ts.net}"

command -v xcodebuild >/dev/null || { echo "❌ 未找到 Xcode。请先从 App Store 安装 Xcode 并运行: sudo xcode-select -s /Applications/Xcode.app"; exit 1; }
command -v pod >/dev/null || { echo "❌ 未找到 CocoaPods。安装: sudo gem install cocoapods  (或 brew install cocoapods)"; exit 1; }

echo "[1/5] 安装依赖"; npm install
echo "[2/5] 生成 www（联机服务器=$SERVER）"; node make-www.js "$SERVER"
echo "[3/5] 添加/同步 iOS 平台"
[ -d ios ] || npx cap add ios
npx cap sync ios
echo "[4/5] 编译未签名 archive"
cd ios/App
xcodebuild -workspace App.xcworkspace -scheme App -configuration Release \
  -sdk iphoneos -archivePath "$PWD/build/App.xcarchive" \
  CODE_SIGN_IDENTITY="" CODE_SIGNING_REQUIRED=NO CODE_SIGNING_ALLOWED=NO archive
echo "[5/5] 打包 .ipa"
APP="$PWD/build/App.xcarchive/Products/Applications/App.app"
[ -d "$APP" ] || { echo "❌ 未找到编译产物 $APP"; exit 1; }
rm -rf Payload "$OLDPWD/royal-holdem-unsigned.ipa"
mkdir Payload && cp -R "$APP" Payload/
( cd "$PWD" && zip -qr "$OLDPWD/royal-holdem-unsigned.ipa" Payload )
rm -rf Payload
echo ""
echo "✅ 完成：$OLDPWD/royal-holdem-unsigned.ipa"
echo "   这是【未签名】包。用爱思助手/Sideloadly/AltStore 等以你的 Apple ID 签名后安装即可。"
