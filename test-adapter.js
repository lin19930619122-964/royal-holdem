/* Phase 3a 回归：GameAdapter（reducer 驱动、对外仿 game.js 接口）。
   用 ui.js 同款调用法(startHand/actionOptions/act/proceed/aiContext + 真实 AI)跑完整手，
   验证接口完整、筹码守恒、阶段流转、结果结构。无 UI。 */
global.window = global.window || global;
require('./src/poker.js');     // window.Poker
require('./src/ai.js');        // window.PokerAI
const AI = window.PokerAI;
const GameAdapter = require('./src/game/table/GameAdapter.js');

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  ✗ ' + m); } };

function newTable(seed, bots) {
  const g = GameAdapter.create({ smallBlind: 50, bigBlind: 100, ante: 10, startChips: 10000, bots, seed });
  // 与 ui.startTable 一致：设昵称/头像/AI 人格
  g.players.forEach((p, i) => { p.name = i === 0 ? '你' : '机器人' + i; p.avatar = '🤖'; if (i !== 0) p.ai = AI.makePersona('hard'); });
  return g;
}
function playHand(g) {
  let guard = 0;
  while (g.phase !== 'ended' && g.phase !== 'gameover' && guard++ < 600) {
    if (g.bettingOpen) {
      const p = g.players[g.current], o = g.actionOptions();
      let d = p.ai ? AI.decide(p, g.aiContext()) : (o.canCheck ? { action: 'check' } : { action: 'call' });
      const curBefore = g.current, betSig = JSON.stringify(g.players.map((x) => x.bet));
      g.act(d.action, d.amount);
      // 无进展兜底（防御非法动作被 reducer 忽略导致死循环）
      if (g.bettingOpen && g.current === curBefore && JSON.stringify(g.players.map((x) => x.bet)) === betSig) {
        g.act(o.canCheck ? 'check' : 'call');
        if (g.current === curBefore) g.act('fold');
      }
    } else g.proceed();
  }
}

// 1) 接口完整性
(() => {
  const g = newTable(7, 5);
  ['players', 'N', 'pot', 'board', 'button', 'handNo', 'currentBet', 'minRaise', 'sbIdx', 'bbIdx', 'smallBlind', 'bigBlind', 'ante', 'phase', 'bettingOpen', 'current', 'result'].forEach((k) => ok(k in g || g[k] !== undefined, '属性存在: ' + k));
  ['startHand', 'act', 'proceed', 'actionOptions', 'aiContext'].forEach((k) => ok(typeof g[k] === 'function', '方法存在: ' + k));
  ok(g.N === 6 && g.phase === 'idle', '6 人桌、初始 idle');
})();

// 2) 代理双向读写（昵称 + 改前补码）
(() => {
  const g = newTable(1, 5);
  g.players[0].name = '英雄'; ok(g.players[0].name === '英雄', '代理写昵称生效');
  g.players[0].chips = 5000; ok(g.players[0].chips === 5000 && g._raw().players[0].stack === 5000, '代理写 chips→stack 生效');
})();

// 3) startHand 后的牌桌态
(() => {
  const g = newTable(3, 5);
  g.startHand();
  ok(g.phase === 'preflop' && g.bettingOpen, 'startHand→preflop 且开放下注');
  ok(g.current != null && typeof g.current === 'number', 'current 为有效座位');
  ok(g.board.length === 0, '翻前公共牌为空');
  ok(g.players.every((p) => p.hole.length === 2), '每人两张底牌');
  ok(g.sbIdx >= 0 && g.bbIdx >= 0 && g.button >= 0, '庄/盲位已定');
  const o = g.actionOptions();
  ok(typeof o.canCheck === 'boolean' && 'callAmount' in o && 'minRaiseTo' in o && 'maxRaiseTo' in o && 'chips' in o, 'actionOptions 结构仿 game.js');
})();

// 4) 完整手：筹码守恒 + 结果结构（真实 AI 驱动 bots）
(() => {
  for (const seed of [2, 11, 88, 404]) for (const bots of [1, 5, 8]) {
    const g = newTable(seed, bots);
    const init = g.players.reduce((a, p) => a + p.chips, 0);
    g.startHand();
    playHand(g);
    const end = g.players.reduce((a, p) => a + p.chips, 0);
    ok(g.phase === 'ended' && init === end, `adapter 跑一手筹码守恒 seed=${seed} bots=${bots} (${init}->${end})`);
    const r = g.result;
    ok(r && typeof r.showdown === 'boolean' && typeof r.summary === 'string' && r.summary.length > 0, `结果含 showdown/summary seed=${seed} bots=${bots}`);
    if (r.showdown) ok(Array.isArray(r.reveal) && r.reveal.length >= 1 && r.handScores, '摊牌含 reveal+handScores');
  }
})();

// 5) 连打多手（下一手循环）不崩、守恒
(() => {
  const g = newTable(55, 5);
  const init = g.players.reduce((a, p) => a + p.chips, 0);
  for (let h = 0; h < 8 && g.phase !== 'gameover'; h++) { g.startHand(); if (g.phase === 'gameover') break; playHand(g); }
  const end = g.players.reduce((a, p) => a + p.chips, 0);
  ok(init === end, `连打多手总筹码守恒 (${init}->${end})`);
})();

// 6) gameover：仅一人有筹码
(() => {
  const g = newTable(9, 5);
  g.players.forEach((p, i) => { if (i !== 0) p.chips = 0; });
  g.startHand();
  ok(g.phase === 'gameover', '仅一人有筹码→gameover');
})();

console.log(`\nPhase3a 适配器回归: ${pass} 通过, ${fail} 失败`);
process.exit(fail ? 1 : 0);
