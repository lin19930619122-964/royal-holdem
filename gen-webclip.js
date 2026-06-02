/* 生成 iOS 描述文件(.mobileconfig)：一个全屏 WebClip，主屏出现「皇室德州」图标，
   点开全屏加载指定地址。通过 iPhone「设置 → 通用 → VPN 与设备管理」安装。
   用法: node gen-webclip.js [https地址]
   默认使用 Tailscale 地址。 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const url = process.argv[2] || 'https://m5.tail5255b4.ts.net/';
const iconPath = path.join(__dirname, 'src', 'icons', 'icon-192.png');
const iconB64 = fs.readFileSync(iconPath).toString('base64');
const u1 = crypto.randomUUID().toUpperCase();
const u2 = crypto.randomUUID().toUpperCase();

const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>PayloadContent</key>
  <array>
    <dict>
      <key>PayloadType</key><string>com.apple.webClip.managed</string>
      <key>PayloadIdentifier</key><string>com.royalholdem.webclip</string>
      <key>PayloadUUID</key><string>${u1}</string>
      <key>PayloadVersion</key><integer>1</integer>
      <key>PayloadDisplayName</key><string>皇室德州</string>
      <key>Label</key><string>皇室德州</string>
      <key>URL</key><string>${url}</string>
      <key>FullScreen</key><true/>
      <key>IgnoreManifestScope</key><true/>
      <key>IsRemovable</key><true/>
      <key>Icon</key>
      <data>${iconB64}</data>
    </dict>
  </array>
  <key>PayloadType</key><string>Configuration</string>
  <key>PayloadIdentifier</key><string>com.royalholdem.profile</string>
  <key>PayloadUUID</key><string>${u2}</string>
  <key>PayloadVersion</key><integer>1</integer>
  <key>PayloadDisplayName</key><string>皇室德州 · 主屏图标</string>
  <key>PayloadDescription</key><string>在主屏添加「皇室德州」全屏图标</string>
  <key>PayloadRemovalDisallowed</key><false/>
</dict>
</plist>
`;

const out = path.join(__dirname, 'royal-holdem.mobileconfig');
fs.writeFileSync(out, plist);
console.log('已生成: ' + out);
console.log('指向地址: ' + url);
console.log('图标大小: ' + Math.round(iconB64.length / 1024) + ' KB(base64)');
