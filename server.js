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

// ---- 真人对战 WebSocket（多房间 Hub）----
let mpOn = false;
try {
  const WebSocket = require('ws');
  const { Rooms } = require('./mp.js');
  const wss = new WebSocket.Server({ server, path: '/ws' });
  const wsById = new Map();   // connId -> ws
  let nextId = 1;

  const send = (connId, obj) => { const ws = wsById.get(connId); if (ws && ws.readyState === WebSocket.OPEN) { try { ws.send(JSON.stringify(obj)); } catch (e) {} } };

  // io：mp.js 通过它把状态/事件发给房间成员
  const io = {
    sendState(table) { for (const connId of table.members) { const m = table.seatByConn(connId); send(connId, table.buildState(m ? m.seat : -1)); } },
    relay(table, obj) { if (obj && obj.to != null) { send(obj.to, obj); return; } for (const connId of table.members) send(connId, obj); },
  };
  const rooms = new Rooms(io);

  // 持久化社交：玩家身份 / 好友 / 俱乐部
  const store = require('./mpstore.js');
  const pidByConn = new Map();          // connId -> playerId
  const onlineCount = new Map();        // playerId -> 连接数
  const onlineSet = new Set();          // 在线 playerId 集合
  function setOnline(pid, delta) { const n = (onlineCount.get(pid) || 0) + delta; if (n <= 0) { onlineCount.delete(pid); onlineSet.delete(pid); } else { onlineCount.set(pid, n); onlineSet.add(pid); } }
  function sendSocial(connId) { const pid = pidByConn.get(connId); if (pid) send(connId, Object.assign({ type: 'social' }, store.getSocial(pid, onlineSet))); }

  const sendLobby = (connId) => send(connId, { type: 'lobby', rooms: rooms.lobby() });
  const broadcastLobby = () => { for (const connId of wsById.keys()) if (!rooms.tableOf(connId)) sendLobby(connId); };

  wss.on('connection', (ws) => {
    const connId = nextId++;
    wsById.set(ws.connId = connId, ws);
    sendLobby(connId);
    ws.on('message', (raw) => {
      let msg; try { msg = JSON.parse(raw); } catch (e) { return; }
      switch (msg.type) {
        case 'lobby': sendLobby(connId); break;
        case 'join': {
          const r = rooms.join(connId, msg.room, msg.name, msg.token, !!msg.spectate);
          send(connId, r.meta ? { type: 'joined', room: r.table.id, seat: r.meta.seat, token: r.meta.token }
            : { type: 'spectating', room: r.table.id });
          r.table.emit(); broadcastLobby();
          break;
        }
        case 'changeTable': { const r = rooms.changeTable(connId, msg.room, msg.name, msg.token); send(connId, r.meta ? { type: 'joined', room: r.table.id, seat: r.meta.seat, token: r.meta.token } : { type: 'spectating', room: r.table.id }); r.table.emit(); broadcastLobby(); break; }
        case 'leave': rooms.leave(connId); sendLobby(connId); broadcastLobby(); break;
        case 'start': rooms.start(connId); break;
        case 'addBot': rooms.addBot(connId); break;
        case 'action': rooms.action(connId, msg.action, msg.amount); break;
        case 'chat': rooms.chat(connId, msg.text); break;
        case 'emote': rooms.emote(connId, msg.emoji); break;
        case 'gift': rooms.gift(connId, msg.toSeat, msg.gift); break;
        case 'report': rooms.report(connId, msg.seat, msg.reason); break;
        case 'hello': { if (msg.pid) { pidByConn.set(connId, msg.pid); setOnline(msg.pid, 1); store.upsertPlayer(msg.pid, msg.name); } break; }
        case 'social': sendSocial(connId); break;
        case 'addFriend': { const pid = pidByConn.get(connId); if (pid) { const r = store.addFriend(pid, msg.code); send(connId, { type: 'socialMsg', ok: r.ok, msg: r.msg || ('已添加 ' + (r.friend ? r.friend.name : '')) }); sendSocial(connId); } break; }
        case 'removeFriend': { const pid = pidByConn.get(connId); if (pid) { store.removeFriend(pid, msg.code); sendSocial(connId); } break; }
        case 'createClub': { const pid = pidByConn.get(connId); if (pid) { const r = store.createClub(pid, msg.name); send(connId, { type: 'socialMsg', ok: r.ok, msg: r.ok ? '俱乐部已创建' : r.msg }); sendSocial(connId); } break; }
        case 'joinClub': { const pid = pidByConn.get(connId); if (pid) { const r = store.joinClub(pid, msg.code); send(connId, { type: 'socialMsg', ok: r.ok, msg: r.ok ? '已加入俱乐部' : r.msg }); sendSocial(connId); } break; }
        case 'leaveClub': { const pid = pidByConn.get(connId); if (pid) { store.leaveClub(pid); sendSocial(connId); } break; }
      }
    });
    ws.on('close', () => { const pid = pidByConn.get(connId); if (pid) { setOnline(pid, -1); pidByConn.delete(connId); } rooms.disconnect(connId); wsById.delete(connId); broadcastLobby(); });
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
