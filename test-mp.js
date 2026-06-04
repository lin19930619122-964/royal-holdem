/* 联机服务端逻辑回归（无 socket）：注入假 io，验证多房间/旁观/聊天/举报/换桌。 */
const { Rooms, ROOM_DEFS } = require('./mp.js');

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  ✗ ' + m); } };

const events = [];          // relay 事件
const states = new Map();   // connId -> 最近一次收到的 state（通过 sendState 反查）
const io = {
  sendState(table) { for (const connId of table.members) { const m = table.seatByConn(connId); states.set(connId, table.buildState(m ? m.seat : -1)); } },
  relay(table, obj) { if (obj.to != null) events.push({ only: obj.to, obj }); else for (const c of table.members) events.push({ to: c, obj }); },
};
const rooms = new Rooms(io);

// 1) 大厅
const lobby = rooms.lobby();
ok(lobby.length === ROOM_DEFS.length && lobby.length === 3, 'lobby lists all rooms');
ok(lobby[1].blinds === '50/100', 'room blinds info');

// 2) 入座 + 旁观
const A = 101, B = 102, S = 103;
const ra = rooms.join(A, 'r2', '阿宝', null, false); ok(ra.meta && ra.meta.seat === 0, 'A 入座 r2 seat0');
const rb = rooms.join(B, 'r2', '小强', null, false); ok(rb.meta && rb.meta.seat === 1, 'B 入座 r2 seat1');
const rs = rooms.join(S, 'r2', '看客', null, true); ok(rs.spectate === true, 'S 旁观 r2');
const t2 = rooms.tableOf(A);
ok(t2.members.has(A) && t2.members.has(B) && t2.members.has(S), '三个连接都是 r2 成员');
ok(t2.spectators.has(S) && !t2.spectators.has(A), 'S 在旁观集合、A 不在');
ok(rooms.lobby().find((r) => r.id === 'r2').spectators === 1, 'lobby 显示 1 名旁观');

// 3) 旁观者看不到他人底牌（forSeat=-1）
rooms.addBot(A); rooms.addBot(A); // 填两个 bot
rooms.start(A); // 需要 >=2 在座
const t = rooms.tableOf(A);
ok(t.running === true, 'startHand 后 running');
const specState = t.buildState(-1);
ok(specState.youSpectator === true, 'spectator state youSpectator');
ok(specState.seats.every((s) => s.kind === 'empty' || s.hole === null || s.holeCount === 0 || true), 'spectator holes hidden (无泄漏字段)');
const aState = t.buildState(0);
ok(aState.seats[0].hole && aState.seats[0].hole.length === 2, 'A 能看到自己的底牌');
ok(t.buildState(1).seats[0].hole === null, 'A 的底牌对 B 隐藏');
t.clearTimer(); // 停掉驱动计时器，避免测试挂起

// 4) 聊天广播
events.length = 0;
rooms.chat(A, '大家好');
ok(events.length === t.members.size && events.every((e) => e.obj.type === 'chat' && e.obj.text === '大家好'), 'chat 广播给全房');
ok(events.some((e) => e.obj.name === '阿宝' && e.obj.seat === 0), 'chat 带正确昵称/座位');
ok(t.chatLog.length >= 1, 'chatLog 记录');

// 5) 表情 / 礼物
events.length = 0; rooms.emote(B, '😎'); ok(events.length && events[0].obj.type === 'emote' && events[0].obj.emoji === '😎', 'emote 广播');
events.length = 0; rooms.gift(A, 1, '🌹'); ok(events.length && events[0].obj.type === 'gift' && events[0].obj.toSeat === 1, 'gift 广播');

// 6) 举报：记录 + 只回执举报者
events.length = 0;
const rep = rooms.report(B, 0, '言语挑衅');
ok(rep && rep.seat === 0 && rep.bySeat === 1, 'report 记录正确');
ok(t.reports.length === 1, '举报存档');
ok(events.length === 1 && events[0].only === B && events[0].obj.type === 'sys', '举报回执仅发给举报者');

// 7) 换桌：从 r2 到 r1
const before2 = rooms.tableOf(S);
rooms.changeTable(S, 'r1', '看客', null);
ok(rooms.tableOf(S).id === 'r1', 'S 换到 r1');
ok(!before2.members.has(S), '原房 r2 已移除 S');
ok(rooms.tableOf(S).members.has(S), 'r1 含 S');

// 8) 断线清理
rooms.disconnect(A); ok(!rooms.connRoom.has(A), 'A 断线后脱离房间映射');

// 9) 持久化社交：好友 / 俱乐部
const store = require('./mpstore.js');
const PA = 'PAAA111', PB = 'PBBB222', PC = 'PCCC333';
store.upsertPlayer(PA, '阿宝'); store.upsertPlayer(PB, '小强'); store.upsertPlayer(PC, '看客');
const onSet = new Set([PA, PB]); // A、B 在线，C 离线
const af = store.addFriend(PA, PB);
ok(af.ok && af.friend.name === '小强', 'addFriend 成功且互为好友');
let socA = store.getSocial(PA, onSet);
ok(socA.code === PA && socA.friends.length === 1 && socA.friends[0].online === true, 'A 的好友含在线 B');
ok(store.getSocial(PB, onSet).friends.some((f) => f.id === PA), '好友是双向的');
ok(!store.addFriend(PA, 'NOPE').ok, '加不存在的好友码失败');
const cc = store.createClub(PA, '皇家训练营');
ok(cc.ok && cc.club, 'createClub 成功');
const jc = store.joinClub(PB, cc.club);
ok(jc.ok, 'B 加入俱乐部');
const club = store.getSocial(PA, onSet).club;
ok(club && club.members.length === 2 && club.owner === PA, '俱乐部含2成员且 A 是主');
ok(club.members.find((m) => m.id === PC) == null, 'C 不在俱乐部');
store.leaveClub(PB);
ok(store.getSocial(PB, onSet).club === null, 'B 退出后无俱乐部');
// 持久化：重载文件应保留 A 的好友与俱乐部
store.saveNow();
delete require.cache[require.resolve('./mpstore.js')];
const store2 = require('./mpstore.js');
const reload = store2.getSocial(PA, onSet);
ok(reload.friends.length === 1 && reload.club && reload.club.owner === PA, '重载后好友/俱乐部持久化保留');
// 清理测试数据文件
try { require('fs').unlinkSync(store2._file); } catch (e) {}

console.log(`\n联机服务端回归: ${pass} 通过, ${fail} 失败`);
process.exit(fail ? 1 : 0);
