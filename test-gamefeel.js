/* V4 Phase 4 回归：EventBus / AudioManager / GameFeelDirector。无 UI。 */
const EventBus = require('./src/services/EventBus.js');
const AudioManager = require('./src/services/AudioManager.js');
const GameFeel = require('./src/services/GameFeelDirector.js');

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  ✗ ' + m); } };

// EventBus
(() => {
  const bus = EventBus.create(); let got = null, star = 0;
  bus.on('X', (p) => { got = p; }); bus.on('*', () => { star++; });
  bus.emit('X', { a: 1 });
  ok(got && got.a === 1, 'EventBus on/emit'); ok(star === 1, 'EventBus 通配符 *');
})();

// AudioManager：分类门控 + 防抖 + 语音默认关 + 快捷语冷却
(() => {
  const calls = []; let t = 0;
  const sfx = {}; ['deal', 'bet', 'chip', 'fold', 'check', 'allin', 'win', 'lose', 'button', 'reward'].forEach((k) => { sfx[k] = () => calls.push(k); });
  sfx.gift = (ty) => calls.push('gift:' + ty);
  const voiceCalls = []; const voice = { play: (k) => voiceCalls.push(k) };
  const am = AudioManager.create({ sfx, voice, now: () => t });
  t = 100; ok(am.play('DEAL_FLOP') && calls.includes('deal'), 'play(DEAL_FLOP)→deal');
  t = 200; am.play('PLAYER_ALL_IN'); ok(calls.includes('allin'), 'play(PLAYER_ALL_IN)→allin');
  // 分类关闭
  am.setCategory('sfx_table', false); const n = calls.length; t = 400; am.play('PLAYER_BET');
  ok(calls.length === n, 'sfx_table 关闭后不播');
  am.setCategory('sfx_table', true);
  // 语音默认关：quickWord 返回 true 但不播 voice
  t = 10000; ok(am.quickWord('p1', 'bluff') === true && voiceCalls.length === 0, '语音默认关:不播 voice');
  // 冷却:同人 5s 内丢弃
  t = 12000; ok(am.quickWord('p1', 'x') === false, '快捷语 5s 内冷却丢弃');
  t = 16000; ok(am.quickWord('p1', 'x') === true, '5s 后可再发');
  // 开语音后播放
  am.setCategory('voice', true); t = 30000; am.quickWord('p2', 'nice'); ok(voiceCalls.includes('nice'), '开语音后播放 audioKey');
})();

// GameFeelDirector：juice 分级 + emit 路由(音频 + 视觉订阅)
(() => {
  const played = []; const am = { play: (e) => { played.push(e); return true; }, quickWord: () => true };
  const gf = GameFeel.create({ audio: am });
  ok(gf.juiceOf('PLAYER_ALL_IN') === 'strong', 'all-in=strong');
  ok(gf.juiceOf('ACHIEVEMENT_UNLOCKED') === 'epic', 'achievement=epic');
  ok(gf.juiceOf('PLAYER_CHECK') === 'subtle', 'check=subtle');
  ok(gf.juiceOf('PLAYER_BET') === 'normal', 'bet=normal');
  let vis = null; gf.onVisual((e, p, lvl) => { vis = { e, lvl: p.level }; });
  const lvl = gf.emit('HERO_WIN_BIG', { amount: 5000 });
  ok(lvl === 'strong' && played.includes('HERO_WIN_BIG'), 'emit 路由到音频');
  ok(vis && vis.e === 'HERO_WIN_BIG' && vis.lvl === 'strong', 'emit 路由到视觉执行器(带 level)');
  ok(GameFeel.EVENTS.length >= 23, 'GameFeelEvent 覆盖 ≥23 类');
})();

console.log(`\nV4 GameFeel 回归: ${pass} 通过, ${fail} 失败`);
process.exit(fail ? 1 : 0);
