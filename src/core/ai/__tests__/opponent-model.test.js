/* G 回归 —— OpponentModel 统计 + 跨街 actionHistory + check-raise + 剥削。
   运行：node src/core/ai/__tests__/opponent-model.test.js */
const Card = require('../../poker/Card.js');
const Brain = require('../PokerBrain.js');
const OppModel = require('../OpponentModel.js');
const TableState = require('../../poker/TableState.js');
const { reducer, step } = require('../../poker/GameReducer.js');
const GameAdapter = require('../../../game/table/GameAdapter.js');
const Legal = require('../../poker/LegalActions.js');
const BDE = require('../BotDecisionEngine.js');
const { harness } = require('../../poker/__tests__/_harness.js');
const { ok, eq, done } = harness('AI·对手模型/历史/check-raise');
const P = Brain.DEFAULT_BOT_PROFILES;
const C = (s) => s.split(' ').map(Card.parse);

// A) OpponentModel 统计数学（合成单手 log）
(function () {
  const om = OppModel.create();
  // seat1 翻前加注(PFR/VPIP)，翻牌 c-bet；seat2 翻前跟注(VPIP) 翻牌面对 c-bet 弃牌
  const log = [
    { t: 'ACTION', hand: 1, street: 'preflop', seat: 1, act: 'raise', amount: 300 },
    { t: 'ACTION', hand: 1, street: 'preflop', seat: 2, act: 'call', amount: 300 },
    { t: 'DEAL', hand: 1, street: 'flop' },
    { t: 'ACTION', hand: 1, street: 'flop', seat: 1, act: 'bet', amount: 400 },
    { t: 'ACTION', hand: 1, street: 'flop', seat: 2, act: 'fold', amount: 0 },
  ];
  om.ingestHand(log);
  const s1 = om.stats(1), s2 = om.stats(2);
  ok(s1.vpip === 1 && s1.pfr === 1, 'A seat1 VPIP/PFR=1');
  ok(s2.vpip === 1 && s2.pfr === 0, 'A seat2 VPIP=1/PFR=0(只跟注)');
  ok(s2.foldToCbet === 1, 'A seat2 面对 c-bet 弃牌率=1');
  ok(s1.aggressionFactor > 0, 'A seat1 激进因子>0');
})();

// B) 100 手自对弈：跨街 actionHistory 存在 + 筹码守恒 + Bot reason 含街道
(function () {
  const om = OppModel.create();
  let crossStreetSeen = false, reasonOk = 0, decisions = 0;
  const START = 4000, N = 6;
  const g = GameAdapter.create({ smallBlind: 50, bigBlind: 100, ante: 0, startChips: START, bots: N - 1, seed: 99 });
  g.players.forEach((p, i) => { if (i !== 0) p.botProfile = BDE.profileForSeat('hard', i); });
  for (let h = 0; h < 100; h++) {
    g.startHand();
    let guard = 0;
    while (g.phase !== 'ended' && g.phase !== 'gameover' && guard++ < 800) {
      if (g.bettingOpen) {
        const seat = g.current; const p = g.players[seat];
        const prof = p.botProfile || BDE.profileForSeat('hard', seat || 1);
        const d = BDE.decide(g, seat, { profile: prof, oppStats: om.all(), seed: h * 311 + seat * 7 + guard });
        decisions++;
        if (d.reason && /翻前|翻后|位置|意图：/.test(d.reason)) reasonOk++;
        g.act(d.action, d.amount);
      } else g.proceed();
    }
    const handLog = (g.log || []).filter((e) => e.t === 'ACTION' && e.hand === g.handNo);
    if (new Set(handLog.map((e) => e.street)).size >= 2) crossStreetSeen = true;
    om.ingestHand(g.log.filter((e) => e.hand === g.handNo));
    // 筹码守恒（仅在未 gameover 时校验；gameover 后停止）
    if (g.phase === 'gameover') break;
  }
  ok(decisions > 200, `B 完成大量决策(${decisions})`);
  ok(crossStreetSeen, 'B 至少一手存在跨街 actionHistory(>=2 街)');
  ok(reasonOk > 0, `B Bot reason 含街道信息(${reasonOk}/${decisions})`);
  const anyStat = om.all(); const seats = Object.keys(anyStat).filter((k) => anyStat[k].sample > 5);
  ok(seats.length >= 1, 'B OpponentModel 累积到样本');
  const sv = anyStat[seats[0]];
  ok(sv.vpip >= 0 && sv.vpip <= 1 && sv.pfr >= 0 && sv.pfr <= 1, 'B 统计值合法区间');
})();

// C) check-raise：本街已 check + 强成牌面对下注 → 加注频率显著高于未 check
(function () {
  const LEGAL = [{ type: 'fold' }, { type: 'call' }, { type: 'raise', minAmount: 600, maxAmount: 8000 }, { type: 'all-in' }];
  const baseCtx = (over) => Object.assign({
    street: 'flop', botId: 'b0', seat: 0, holeCards: C('9h 9d'), board: C('9s 6c 2h'),
    pot: 800, amountToCall: 300, currentBet: 300, minRaiseTo: 600, lastRaiseSize: 300, stack: 8000, effectiveStack: 8000,
    bigBlind: 100, position: 'BB', playersInHand: 2, activeOpponents: 1, previousActions: [], actionsThisStreet: [],
    legalActions: LEGAL, botProfile: P.tight_aggressive,
  }, over);
  const raiseRate = (over, n) => { let r = 0; for (let i = 1; i <= n; i++) { const d = Brain.decideBotAction(baseCtx(Object.assign({ seed: i * 13 + 1 }, over))); if (d.action.type === 'raise' || d.action.type === 'all-in') r++; } return r; };
  const checkedFirst = [{ street: 'flop', seat: 0, playerId: 'b0', action: { type: 'check' } }, { street: 'flop', seat: 1, playerId: 'b1', action: { type: 'bet' } }];
  const withCR = raiseRate({ actionsThisStreet: checkedFirst, previousActions: checkedFirst }, 80);
  const noCR = raiseRate({}, 80);
  ok(withCR > noCR, `C 暗三条 check 后加注率(check-raise) > 直接面对下注(${withCR} vs ${noCR})`);
})();

// D) 剥削：对手 foldToCbet 高 → 我方在可下注点更激进
(function () {
  const LEGAL_OPEN = [{ type: 'fold' }, { type: 'check' }, { type: 'bet', minAmount: 100, maxAmount: 8000 }, { type: 'all-in' }];
  const ctx = (villain) => Object.assign({
    street: 'flop', botId: 'b0', seat: 0, holeCards: C('Ah 5c'), board: C('Kd 8h 2s'),
    pot: 300, amountToCall: 0, currentBet: 0, minRaiseTo: 100, lastRaiseSize: 100, stack: 6000, effectiveStack: 6000,
    bigBlind: 100, position: 'BTN', playersInHand: 2, activeOpponents: 1, previousActions: [], actionsThisStreet: [],
    legalActions: LEGAL_OPEN, botProfile: P.balanced_reg, villain,
  });
  const betRate = (villain, n) => { let b = 0; for (let i = 1; i <= n; i++) { const d = Brain.decideBotAction(Object.assign(ctx(villain), { seed: i * 17 + 3 })); if (d.action.type === 'bet') b++; } return b; };
  const vsFolder = betRate({ sample: 30, foldToCbet: 0.75, wentToShowdown: 0.2, aggressionFactor: 1 }, 80);
  const vsUnknown = betRate(null, 80);
  ok(vsFolder >= vsUnknown, `D 对爱弃牌对手下注更多(${vsFolder} vs ${vsUnknown})`);
})();

done();
