/* 本地服务器：静态文件 + 真人对战 WebSocket(/ws)。绑 0.0.0.0，配合 Tailscale HTTPS。
   用法: node server.js [端口]   默认 8099 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = parseInt(process.argv[2], 10) || 8099;
const ROOT = path.join(__dirname, 'src');

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml',
  '.mobileconfig': 'application/x-apple-aspen-config; charset=utf-8',
};

const server = http.createServer((req, res) => {
  let urlPath = decodeURIComponent(req.url.split('?')[0]);
  if (urlPath === '/') urlPath = '/index.html';
  const filePath = path.join(ROOT, path.normalize(urlPath));
  if (!filePath.startsWith(ROOT)) { res.writeHead(403); res.end('forbidden'); return; }
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); res.end('not found'); return; }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Service-Worker-Allowed': '/' });
    res.end(data);
  });
});

// ---- 真人对战 WebSocket ----
let mpOn = false;
try {
  const WebSocket = require('ws');
  const { Table } = require('./mp.js');
  const wss = new WebSocket.Server({ server, path: '/ws' });
  const clients = new Map(); // ws -> connId
  let nextId = 1;

  const table = new Table(broadcast);

  function broadcast() {
    for (const [ws, connId] of clients) {
      if (ws.readyState !== WebSocket.OPEN) continue;
      const meta = table.seatByConn(connId);
      const forSeat = meta ? meta.seat : -1;
      try { ws.send(JSON.stringify(table.buildState(forSeat))); } catch (e) {}
    }
  }

  wss.on('connection', (ws) => {
    const connId = nextId++;
    clients.set(ws, connId);
    ws.on('message', (raw) => {
      let msg; try { msg = JSON.parse(raw); } catch (e) { return; }
      switch (msg.type) {
        case 'join': {
          const meta = table.sit(connId, msg.name, msg.token);
          ws.send(JSON.stringify(meta
            ? { type: 'joined', seat: meta.seat, token: meta.token }
            : { type: 'full' }));
          broadcast();
          break;
        }
        case 'start': table.startHand(); break;
        case 'addBot': table.addBot(); break;
        case 'action': table.playerAction(connId, msg.action, msg.amount); break;
        case 'leave': { const m = table.seatByConn(connId); if (m) table.removeSeat(m.seat); break; }
      }
    });
    ws.on('close', () => { table.disconnect(connId); clients.delete(ws); });
    ws.on('error', () => {});
  });
  mpOn = true;
} catch (e) {
  console.log('  (联机模块未启用: ' + e.message + ')');
}

server.listen(PORT, '0.0.0.0', () => {
  const os = require('os');
  const ips = [];
  const ifaces = os.networkInterfaces();
  for (const name of Object.keys(ifaces))
    for (const ni of ifaces[name]) if (ni.family === 'IPv4' && !ni.internal) ips.push(ni.address);
  console.log(`\n  皇室德州 已启动 ✅  联机:${mpOn ? '开' : '关'}`);
  console.log(`  本机:    http://localhost:${PORT}`);
  ips.forEach((ip) => console.log(`  局域网:  http://${ip}:${PORT}`));
  console.log(`\n  手机安装(完整 PWA + 联机 需 HTTPS)：`);
  console.log(`    tailscale serve --bg ${PORT}`);
  console.log(`  手机打开 Tailscale 的 https 地址 → 单机点开始；联机点「真人对战」\n`);
});
