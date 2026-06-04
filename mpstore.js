/* 联机社交持久化存储 —— 玩家身份 / 好友 / 俱乐部，跨会话保存到磁盘 JSON。
   纯逻辑 + fs；在线状态由调用方(server)传入的 onlineSet 提供。 */
const fs = require('fs');
const path = require('path');
const FILE = path.join(__dirname, 'mp-data.json');

let data = { players: {}, clubs: {} };
try { data = JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch (e) { /* 首次运行无文件 */ }
if (!data.players) data.players = {};
if (!data.clubs) data.clubs = {};

let saveTimer = null;
function save() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => { saveTimer = null; try { fs.writeFileSync(FILE, JSON.stringify(data)); } catch (e) {} }, 300);
}
function saveNow() { try { fs.writeFileSync(FILE, JSON.stringify(data)); } catch (e) {} }

const online = (set, id) => !!(set && set.has(id));

function upsertPlayer(pid, name) {
  if (!pid) return null;
  const p = data.players[pid] || (data.players[pid] = { id: pid, friends: [], clubId: null, created: Date.now() });
  if (name) p.name = String(name).slice(0, 8);
  save();
  return p;
}
function playerName(pid) { const p = data.players[pid]; return (p && p.name) || '玩家'; }

function addFriend(pid, code) {
  code = String(code || '').trim().toUpperCase();
  if (!pid || !code || code === pid) return { ok: false, msg: '无效好友码' };
  const other = data.players[code];
  if (!other) return { ok: false, msg: '好友码不存在' };
  const me = upsertPlayer(pid);
  if (!me.friends.includes(code)) me.friends.push(code);
  if (!other.friends.includes(pid)) other.friends.push(pid);
  save();
  return { ok: true, friend: { id: code, name: other.name || '玩家' } };
}
function removeFriend(pid, code) {
  const me = data.players[pid], other = data.players[code];
  if (me) me.friends = (me.friends || []).filter((x) => x !== code);
  if (other) other.friends = (other.friends || []).filter((x) => x !== pid);
  save();
  return { ok: true };
}

function clubInfo(clubId, onlineSet) {
  const c = data.clubs[clubId]; if (!c) return null;
  return {
    id: c.id, name: c.name, code: c.code, owner: c.owner,
    members: c.members.map((mid) => ({ id: mid, name: playerName(mid), online: online(onlineSet, mid), owner: mid === c.owner })),
  };
}
function createClub(pid, name) {
  if (!pid) return { ok: false, msg: '需先登录' };
  const me = upsertPlayer(pid);
  if (me.clubId && data.clubs[me.clubId]) return { ok: false, msg: '已在俱乐部中' };
  // 生成 5 位俱乐部码
  let code; do { code = 'C' + Math.floor(Math.random() * 1e6).toString(36).toUpperCase().slice(0, 4).padStart(4, '0'); } while (data.clubs[code]);
  data.clubs[code] = { id: code, code, name: String(name || '皇家俱乐部').slice(0, 12), owner: pid, members: [pid], created: Date.now() };
  me.clubId = code; save();
  return { ok: true, club: code };
}
function joinClub(pid, code) {
  code = String(code || '').trim().toUpperCase();
  const c = data.clubs[code]; if (!c) return { ok: false, msg: '俱乐部码不存在' };
  const me = upsertPlayer(pid);
  if (me.clubId && me.clubId !== code) return { ok: false, msg: '请先退出当前俱乐部' };
  if (!c.members.includes(pid)) c.members.push(pid);
  me.clubId = code; save();
  return { ok: true, club: code };
}
function leaveClub(pid) {
  const me = data.players[pid]; if (!me || !me.clubId) return { ok: false };
  const c = data.clubs[me.clubId];
  if (c) {
    c.members = c.members.filter((x) => x !== pid);
    if (c.owner === pid) { if (c.members.length) c.owner = c.members[0]; else delete data.clubs[c.id]; }
  }
  me.clubId = null; save();
  return { ok: true };
}

function getSocial(pid, onlineSet) {
  const me = upsertPlayer(pid);
  return {
    code: pid,
    name: me.name || '玩家',
    friends: (me.friends || []).map((fid) => ({ id: fid, name: playerName(fid), online: online(onlineSet, fid) })),
    club: me.clubId ? clubInfo(me.clubId, onlineSet) : null,
  };
}

module.exports = { upsertPlayer, playerName, addFriend, removeFriend, createClub, joinClub, leaveClub, clubInfo, getSocial, saveNow, _data: () => data, _file: FILE };
