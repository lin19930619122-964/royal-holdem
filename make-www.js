/* 生成 Capacitor 用的 www 目录：复制 src/，并把联机服务器地址注入 online.html。
   用法: node make-www.js [服务器主机]   默认 m5.tail5255b4.ts.net
   原生 App 是从本地包加载页面的，联机必须知道去连哪台服务器（你 Mac 上的 Tailscale 地址）。 */
const fs = require('fs');
const path = require('path');

const SERVER = process.argv[2] || process.env.RH_SERVER || 'm5.tail5255b4.ts.net';
const SRC = path.join(__dirname, 'src');
const WWW = path.join(__dirname, 'www');

function rmrf(p) { if (fs.existsSync(p)) fs.rmSync(p, { recursive: true, force: true }); }
function copyDir(s, d) {
  fs.mkdirSync(d, { recursive: true });
  for (const e of fs.readdirSync(s, { withFileTypes: true })) {
    const sp = path.join(s, e.name), dp = path.join(d, e.name);
    if (e.isDirectory()) copyDir(sp, dp);
    else fs.copyFileSync(sp, dp);
  }
}

rmrf(WWW);
copyDir(SRC, WWW);

// 注入联机服务器地址
const onlinePath = path.join(WWW, 'online.html');
let html = fs.readFileSync(onlinePath, 'utf8');
const inject = `  <script>window.RH_SERVER='${SERVER}';</script>\n  <script src="online.js"></script>`;
html = html.replace('  <script src="online.js"></script>', inject);
fs.writeFileSync(onlinePath, html);

console.log(`www 生成完成。联机服务器 = ${SERVER}`);
console.log('（单机完全离线内置；联机连上面这台服务器，需它在跑 + Tailscale）');
