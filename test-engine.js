/* 无界面引擎自检：牌型判定 + 跑多手随机对局，检测崩溃/筹码守恒 */
global.window = {};
require('./src/poker.js');
require('./src/ai.js');
require('./src/game.js');
const P = window.Poker;
const Game = window.Game;
const AI = window.PokerAI;
AI.setSims(15); // 压力测试只验证引擎正确性，降低模拟次数加速

function card(s) { // 'As' -> {rank,suit}
  const map = { A: 14, K: 13, Q: 12, J: 11, T: 10 };
  const r = s.slice(0, -1), su = s.slice(-1);
  return { rank: map[r] || +r, suit: su };
}
function name(cards) { return P.handName(P.evaluateBest(cards.map(card)).score); }

let pass = 0, fail = 0;
function check(label, got, want) {
  if (got === want) { pass++; }
  else { fail++; console.log(`  ✗ ${label}: got ${got}, want ${want}`); }
}

console.log('— 牌型判定 —');
check('皇家同花顺', name(['As', 'Ks', 'Qs', 'Js', 'Ts']), '皇家同花顺');
check('同花顺', name(['9h', '8h', '7h', '6h', '5h']), '同花顺');
check('轮子同花顺', name(['Ah', '2h', '3h', '4h', '5h']), '同花顺');
check('四条', name(['As', 'Ah', 'Ad', 'Ac', 'Kd']), '四条');
check('葫芦', name(['As', 'Ah', 'Ad', 'Kc', 'Kd']), '葫芦');
check('同花', name(['As', 'Js', '9s', '7s', '3s']), '同花');
check('顺子', name(['9c', '8h', '7s', '6d', '5h']), '顺子');
check('轮子顺子', name(['Ac', '2h', '3s', '4d', '5h']), '顺子');
check('三条', name(['As', 'Ah', 'Ad', 'Qc', 'Kd']), '三条');
check('两对', name(['As', 'Ah', 'Kd', 'Kc', '3d']), '两对');
check('一对', name(['As', 'Ah', 'Kd', 'Qc', '3d']), '一对');
check('高牌', name(['As', 'Jh', '9d', '7c', '3d']), '高牌');

// 7 张取最优
check('7张选葫芦', name(['As', 'Ah', 'Ad', 'Kc', 'Kd', '2s', '3h']), '葫芦');
check('7张选同花', name(['2s', '5s', '9s', 'Ks', 'Qs', '3h', '4d']), '同花');

// 比较
const a = P.evaluateBest(['As', 'Ah', 'Kd', 'Kc', 'Qd'].map(card)).score;
const b = P.evaluateBest(['As', 'Ah', 'Kd', 'Kc', 'Jd'].map(card)).score;
check('踢脚比较 AAKK Q>J', P.compareScores(a, b) > 0, true);

console.log(`牌型判定: ${pass} 通过, ${fail} 失败\n`);

// — 跑多手随机对局 —
console.log('— 随机对局压力测试 —');
let crashes = 0, handsPlayed = 0, gamesFinished = 0, stuck = 0, consErr = 0;
const TOTAL_CHIPS = 6 * 10000;
for (let trial = 0; trial < 80; trial++) {
  const g = new Game({ smallBlind: 50, bigBlind: 100, startChips: 10000, bots: 5 });
  let guard = 0;
  try {
    while (g.phase !== 'gameover' && guard < 200000) {
      guard++;
      if (g.phase === 'idle' || g.phase === 'ended') {
        // 每手结束后奖池已派发，玩家筹码总量必须守恒
        const total = g.players.reduce((s, p) => s + p.chips, 0);
        if (total !== TOTAL_CHIPS) { consErr++; if (consErr <= 3) console.log(`  ✗ trial ${trial} 手 ${handsPlayed}: 筹码 ${total} != ${TOTAL_CHIPS}`); }
        g.startHand();
        handsPlayed++;
        continue;
      }
      if (!g.bettingOpen) { g.proceed(); continue; }
      const p = g.players[g.current];
      const d = AI.decide(p, g.aiContext());
      g.act(d.action, d.amount);
    }
    if (guard >= 200000) { stuck++; if (stuck <= 3) console.log(`  ✗ trial ${trial}: 步数超限(可能死循环)`); }
    else gamesFinished++;
    const total = g.players.reduce((s, p) => s + p.chips, 0);
    if (g.phase === 'gameover' && total !== TOTAL_CHIPS) { consErr++; console.log(`  ✗ trial ${trial}: 终局筹码 ${total} != ${TOTAL_CHIPS}`); }
  } catch (e) {
    crashes++;
    if (crashes <= 3) console.log(`  ✗ trial ${trial} 崩溃: ${e.message}\n${e.stack.split('\n').slice(1,4).join('\n')}`);
  }
}
console.log(`对局: 80 局, 完成分出胜负 ${gamesFinished} 局, 共 ${handsPlayed} 手`);
console.log(`异常: 崩溃 ${crashes}, 步数超限 ${stuck}, 筹码不守恒 ${consErr}`);
crashes += stuck + consErr;
console.log(fail === 0 && crashes === 0 ? '\n✅ 全部通过' : '\n⚠️ 存在问题');
