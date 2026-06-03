/* 皇室德州 — 界面渲染、游戏循环、经济/皮肤/音效/动画/弹窗整合 */
(function () {
  const P = window.Poker;
  const AI = window.PokerAI;
  const Store = window.Store;
  const Sfx = window.Sfx;
  const Fx = window.Fx;
  const Skins = window.Skins;
  const Codec = window.Codec;

  let game = null;            // 进入牌桌时按配置创建
  let SEAT_POS = [];          // 当前桌的座位坐标(按人数)
  let tableConfig = null;     // 当前牌桌规则
  let seatAvatars = [];       // 每个座位用的头像编号(1..12)
  let seatVoice = [];         // 每个座位的方言: 'db'(东北)/'cd'(成都)
  const AVATAR_COUNT = 24;
  const ACT2VOICE = { 弃牌: 'fold', 过牌: 'check', 跟注: 'call', 加注: 'raise', 下注: 'raise', 全下: 'allin' };
  function maybeVoice(p) {
    if (!p || p.isHuman || !window.Voice) return;
    let key = ACT2VOICE[p.lastAction];
    if (!key) return;
    if ((key === 'raise' || key === 'allin') && Math.random() < 0.4) key = 'taunt'; // 加注/全下时偶尔挑衅
    if (Math.random() < 0.66) Voice.play(seatVoice[p.id] || 0, key);
  }

  // 不同人数的座位布局(人类固定底部正中)
  const SEAT_LAYOUTS = {
    2: [{ x: 50, y: 88 }, { x: 50, y: 12 }],
    6: [{ x: 50, y: 90 }, { x: 11, y: 60 }, { x: 18, y: 22 }, { x: 50, y: 10 }, { x: 82, y: 22 }, { x: 89, y: 60 }],
    9: [{ x: 50, y: 91 }, { x: 16, y: 79 }, { x: 12, y: 51 }, { x: 18, y: 25 }, { x: 38, y: 12 },
        { x: 62, y: 12 }, { x: 82, y: 25 }, { x: 88, y: 51 }, { x: 84, y: 79 }],
  };
  const PHASE_LABEL = { flop: '翻 牌', turn: '转 牌', river: '河 牌', ended: '摊 牌' };

  // 对手建模：统计你的弃牌率/激进度，AI 据此剥削你
  window.OppModel = {
    acts: 0, aggr: 0, betsFaced: 0, folds: 0,
    record(action, facingBet) {
      this.acts++;
      if (action === 'raise') this.aggr++;
      if (facingBet) { this.betsFaced++; if (action === 'fold') this.folds++; }
    },
    exploit() {
      return {
        fold: this.betsFaced > 4 ? this.folds / this.betsFaced : 0.45,
        aggr: this.acts > 6 ? this.aggr / this.acts : 0.18,
        samples: this.acts,
      };
    },
  };

  const $ = (id) => document.getElementById(id);
  const seatsEl = $('seats'), boardEl = $('board'), dealerBtn = $('dealer-button');
  const fxLayer = $('fx-layer'), potEl = $('pot-display');

  let scheduled = null, raiseMode = false;
  const seatEls = [], betEls = [], seatSig = [], prevBet = [];
  let boardCount = -1, lastDecoratedHand = -1, lastSyncedHand = -1, prevPot = -1;
  let humanWinPct = null;
  let handAnalysis = null;
  const prevLA = [];

  // 听牌/改善张数(outs)：枚举剩余牌，能提升牌型类别的张数
  function computeOuts(hole, board) {
    if (board.length < 3 || board.length >= 5) return null;
    const cur = P.evaluateBest(hole.concat(board)).score;
    const used = new Set(hole.concat(board).map((c) => c.rank + c.suit));
    let outs = 0;
    for (const c of P.createDeck()) {
      if (used.has(c.rank + c.suit)) continue;
      const ns = P.evaluateBest(hole.concat(board.concat([c]))).score;
      if (ns[0] > cur[0]) outs++;
    }
    return outs;
  }

  /* ---------- 钱包 ---------- */
  function syncWallet(bump) {
    const p = Store.get();
    document.querySelectorAll('.coin-val').forEach((e) => { e.textContent = p.coins.toLocaleString(); });
    document.querySelectorAll('.diamond-val').forEach((e) => { e.textContent = p.diamonds.toLocaleString(); });
    const dot = $('checkin-dot'); if (dot) dot.classList.toggle('hidden', !Store.canCheckin());
    const wd = $('wheel-dot'); if (wd) wd.classList.toggle('hidden', !Store.canSpin());
    if (bump) document.querySelectorAll('.cur.coins').forEach((e) => { e.classList.remove('bump'); void e.offsetWidth; e.classList.add('bump'); });
  }

  // 紧凑金额：1.5万 / 1.2亿，避免大额撑出座位框
  function fmtChips(n) {
    n = Math.round(n || 0);
    if (n >= 1e8) return (n / 1e8).toFixed(2).replace(/\.?0+$/, '') + '亿';
    if (n >= 1e4) return (n / 1e4).toFixed(1).replace(/\.0$/, '') + '万';
    return n.toLocaleString();
  }

  /* ---------- 座位 ---------- */
  function buildSeats() {
    seatsEl.innerHTML = '';
    seatsEl.className = game.N >= 8 ? 'many' : '';
    seatEls.length = 0; betEls.length = 0; seatSig.length = 0; prevBet.length = 0; prevLA.length = 0;
    boardCount = -1; prevPot = -1;
    for (let i = 0; i < game.N; i++) {
      const pos = SEAT_POS[i] || { x: 50, y: 50 };
      const seat = document.createElement('div');
      seat.className = 'seat' + (i === 0 ? ' me' : '');
      seat.style.left = pos.x + '%';
      seat.style.top = pos.y + '%';
      seat.innerHTML = `
        <div class="winner-badge hidden"></div>
        <div class="hand-name hidden"></div>
        <div class="last-action"></div>
        <div class="player-cards"></div>
        <div class="player-box">
          <div class="avatar"><img class="av-img" src="assets/av/${seatAvatars[i] || (i + 1)}.png" onerror="this.style.display='none'"/><span class="av-emoji"></span></div>
          <div class="pinfo"><span class="ptitle hidden"></span><span class="pname"></span><span class="pchips"></span></div>
        </div>`;
      seatsEl.appendChild(seat);
      seatEls.push(seat); seatSig.push(''); prevBet.push(0);

      const bx = pos.x + (50 - pos.x) * 0.34, by = pos.y + (50 - pos.y) * 0.34;
      const bet = document.createElement('div');
      bet.className = 'bet-tag hidden';
      bet.style.cssText = `position:absolute;left:${bx}%;top:${by}%;transform:translate(-50%,-50%)`;
      seatsEl.appendChild(bet);
      betEls.push(bet);
    }
  }

  function cardFaceHTML(card, small, flip) {
    const red = P.isRed(card) ? ' red' : '';
    const fl = flip ? ' flip-in' : '';
    const r = P.RANK_LABEL[card.rank], s = P.SUIT_SYMBOL[card.suit];
    if (small) return `<div class="card small${red}${fl}"><span class="cmini"><b>${r}</b><i>${s}</i></span></div>`;
    return `<div class="card${red}${fl}"><span class="ci tl">${r}<i>${s}</i></span><span class="pip">${s}</span><span class="ci br">${r}<i>${s}</i></span></div>`;
  }
  const cardBackHTML = (small) => `<div class="card back${small ? ' small' : ''}"></div>`;

  function render() {
    $('blindInfo').textContent = `${game.smallBlind}/${game.bigBlind}`;
    $('handInfo').textContent = `第${game.handNo}手`;
    const potNow = game.pot;
    $('pot-amount').textContent = fmtChips(potNow);
    if (potNow > prevPot && prevPot >= 0) { potEl.classList.remove('pulse'); void potEl.offsetWidth; potEl.classList.add('pulse'); }
    prevPot = potNow;

    if (game.board.length !== boardCount) {
      const grew = game.board.length > boardCount && boardCount >= 0;
      boardEl.innerHTML = game.board.map((c) => cardFaceHTML(c, false)).join('');
      boardCount = game.board.length;
      if (grew) Sfx.deal();
    }

    const banner = $('phase-banner');
    if (PHASE_LABEL[game.phase] && game.board.length) {
      banner.textContent = PHASE_LABEL[game.phase]; banner.style.opacity = '0.9';
    } else banner.style.opacity = '0';

    const result = game.result;
    for (let i = 0; i < game.N; i++) {
      const p = game.players[i], el = seatEls[i];
      el.querySelector('.av-emoji').textContent = p.out ? '💀' : p.avatar;
      const pname = el.querySelector('.pname');
      pname.classList.toggle('is-human', p.isHuman);
      const ptl = el.querySelector('.ptitle');
      if (p.isHuman) {
        const sp = Store.get(), wq = Skins.watches[sp.activeWatch], tt = Skins.titles[sp.activeTitle];
        pname.textContent = (wq && wq.icon ? wq.icon + ' ' : '') + p.name;
        if (tt && tt.text) { ptl.textContent = tt.text; ptl.style.color = tt.color; ptl.classList.remove('hidden'); } else ptl.classList.add('hidden');
      } else { pname.textContent = p.name; ptl.classList.add('hidden'); }
      el.querySelector('.pchips').textContent = p.out ? '—' : fmtChips(p.chips);
      el.classList.toggle('folded', p.folded && !p.out);
      el.classList.toggle('active', game.current === i && game.bettingOpen);

      const la = el.querySelector('.last-action');
      la.textContent = p.lastAction || '';
      la.className = 'last-action';
      if (p.lastAction === '弃牌') la.classList.add('fold');
      else if (['加注', '下注', '全下'].includes(p.lastAction)) la.classList.add('raise');
      if (p.lastAction && p.lastAction !== prevLA[i]) la.classList.add('pop');
      if (p.lastAction === '全下' && prevLA[i] !== '全下' && prevLA[i] !== undefined) flashAllIn();
      prevLA[i] = p.lastAction;

      // 下注筹码飞向底池
      if (p.bet > prevBet[i]) {
        Fx.flyChip(el, potEl, fxLayer, { count: 1 });
      }
      prevBet[i] = p.bet;

      const betEl = betEls[i];
      if (p.bet > 0 && !p.out) {
        betEl.classList.remove('hidden');
        betEl.innerHTML = `<span class="chip-dot"></span>${fmtChips(p.bet)}`;
      } else betEl.classList.add('hidden');

      const revealed = p.isHuman || (result && result.reveal && result.reveal.includes(p.id));
      const sig = (revealed ? 'F' + p.hole.map((c) => c.rank + c.suit).join('') : 'B' + p.hole.length) + (p.out ? 'o' : '');
      if (sig !== seatSig[i]) {
        const cardsEl = el.querySelector('.player-cards');
        const wasHidden = seatSig[i].startsWith(`${p.hole.length}|0`);
        if (p.hole.length === 0 || p.out) cardsEl.innerHTML = '';
        else if (revealed) cardsEl.innerHTML = p.hole.map((c) => cardFaceHTML(c, true, wasHidden && !p.isHuman)).join('');
        else cardsEl.innerHTML = p.hole.map(() => cardBackHTML(true)).join('');
        seatSig[i] = sig;
      }

      const badge = el.querySelector('.winner-badge');
      if (result && p.winThisHand > 0) {
        badge.classList.remove('hidden'); badge.textContent = `+${fmtChips(p.winThisHand)}`;
      } else badge.classList.add('hidden');

      // 摊牌：座位上方显示牌型
      const hn = el.querySelector('.hand-name');
      if (result && result.showdown && result.handNames && revealed && !p.folded && result.handNames[p.id]) {
        hn.textContent = result.handNames[p.id]; hn.classList.remove('hidden');
      } else hn.classList.add('hidden');
    }

    if (game.button >= 0 && game.phase !== 'idle' && !game.players[game.button].out) {
      const pos = SEAT_POS[game.button];
      dealerBtn.classList.remove('hidden');
      dealerBtn.style.left = (pos.x + (50 - pos.x) * 0.26) + '%';
      dealerBtn.style.top = (pos.y + (50 - pos.y) * 0.24) + '%';
    } else dealerBtn.classList.add('hidden');

    // 实时"你的牌型"(翻牌后，帮助练牌)
    const hh = $('hand-hint'), me = game.players[0];
    if (me && me.hole.length === 2 && !me.folded && !me.out && handAnalysis && game.phase !== 'idle' && game.phase !== 'gameover') {
      const a = handAnalysis;
      const draw = (a.outs && a.outs > 0) ? `听牌 ${a.outs} outs · ` : '';
      const odds = a.po != null ? `底池赔率 ${a.po}% · ` : '';
      hh.innerHTML =
        `<div class="hh1">你的牌型 · ${a.name} · 胜率 <b>${a.winPct}%</b></div>` +
        `<div class="hh2">赢${a.winPct} 平${a.tiePct} 输${a.losePct}% · ${draw}${odds}${a.opp}人 · <em>${a.rec}</em></div>`;
      hh.classList.remove('hidden');
    } else hh.classList.add('hidden');

    updateMessage();
  }

  function flashAllIn() {
    const f = $('allin-flash');
    f.classList.remove('hidden'); f.style.animation = 'none'; void f.offsetWidth; f.style.animation = '';
    if (window.Sfx) Sfx.bet();
    setTimeout(() => f.classList.add('hidden'), 1000);
  }
  // 载具进场特效：你的座驾从画面驶过
  function playVehicleEntrance() {
    const id = Store.get().activeVehicle, v = Skins.vehicles[id];
    if (!v || !v.icon || id === 'none') return;
    const el = document.createElement('div'); el.className = 'vehicle-fx'; el.textContent = v.icon;
    fxLayer.appendChild(el); setTimeout(() => el.remove(), 1800);
  }

  function updateMessage() {
    const msg = $('message-bar');
    if (game.phase === 'idle') { msg.textContent = '点击「开始」发牌'; return; }
    if (game.phase === 'ended') { msg.textContent = game.result ? game.result.summary : ''; return; }
    if (game.phase === 'gameover') { msg.textContent = '游戏结束'; return; }
    if (!game.bettingOpen) { msg.textContent = '发牌中…'; return; }
    const p = game.players[game.current];
    msg.textContent = p.isHuman ? '轮到你行动' : `等待 ${p.name} 行动…`;
  }

  function actSound(p) {
    if (!p) return;
    switch (p.lastAction) {
      case '弃牌': Sfx.fold(); break;
      case '过牌': Sfx.check(); break;
      case '跟注': Sfx.chip(); break;
      case '加注': case '下注': Sfx.bet(); break;
      case '全下': Sfx.allin(); break;
    }
  }

  function decorateResult() {
    const result = game.result;
    if (!result) return;
    let humanWon = false;
    const felt = $('table-felt');
    felt.classList.remove('win-flash'); void felt.offsetWidth; felt.classList.add('win-flash');
    const rb = $('result-banner');
    if (result.summary) { rb.textContent = '🏆 ' + result.summary; rb.classList.remove('hidden'); rb.style.animation = 'none'; void rb.offsetWidth; rb.style.animation = ''; }
    for (let i = 0; i < game.N; i++) {
      const p = game.players[i];
      if (p.winThisHand > 0) {
        Fx.flyChip(potEl, seatEls[i], fxLayer, { count: 4 });
        Fx.floatText(seatEls[i], `+${fmtChips(p.winThisHand)}`, fxLayer);
        Fx.pulseWin(seatEls[i]);
        Fx.coinBurst(seatEls[i], fxLayer, 12);
        if (p.isHuman) humanWon = true;
        else if (window.Voice && Math.random() < 0.7) Voice.play(seatVoice[p.id] || 0, 'win');
      }
    }
    if (humanWon) { Sfx.win(); Fx.vibrate(60); }
    else { Sfx.lose(); }

    // 牌型特效：摊牌时按牌型等级炸场(对子小、同花顺最炸)。优先展示你的牌型
    if (result.showdown && result.handScores) {
      const me = game.players[0];
      let id = (!me.folded && !me.out && result.handScores[0]) ? 0 : null;
      if (id === null) {
        const top = game.players.filter((p) => p.winThisHand > 0).sort((a, b) => b.winThisHand - a.winThisHand)[0];
        id = top ? top.id : null;
      }
      if (id !== null && result.handScores[id]) {
        const tier = result.handScores[id][0] + 1; // 1..9
        Fx.handCelebration(fxLayer, tier, (result.handNames[id] || '') + '!');
        if (tier >= 6) { Fx.shake($('table-wrap'), tier >= 8 ? 11 : 7); Fx.vibrate(tier >= 8 ? [70, 40, 90] : 45); }
      }
    }
  }

  /* ---------- 游戏循环 ---------- */
  function tick() {
    if (scheduled) { clearTimeout(scheduled); scheduled = null; }
    render();

    if (game.phase === 'ended') {
      if (lastSyncedHand !== game.handNo) {
        lastSyncedHand = game.handNo;
        const meP = game.players[0];
        Store.get().coins = Math.max(0, meP.chips);
        Store.save();
        Store.recordHand(meP.winThisHand > 0, game.pot);
        // 经验：打一手 +12，赢了 +30，摊牌成大牌额外加成
        let xp = 12 + (meP.winThisHand > 0 ? 30 : 0);
        if (game.result && game.result.showdown && game.result.handScores && game.result.handScores[0]) xp += game.result.handScores[0][0] * 6;
        const up = Store.addXp(xp);
        syncWallet(true); syncLevel();
        if (up.leveled > 0) { setTimeout(() => { toast(`🎉 升到 ${up.level} 级！金币 +${(up.level * 10000).toLocaleString()}`); Store.addCoins(up.level * 10000); syncWallet(true); Sfx.reward(); }, 1200); }
      }
      if (lastDecoratedHand !== game.handNo) { lastDecoratedHand = game.handNo; decorateResult(); }
      hideHumanControls();
      $('start-area').classList.remove('hidden');
      $('btn-start').textContent = '下一手';
      scheduled = setTimeout(() => { if (game.phase === 'ended') nextHand(); }, 4200);
      return;
    }
    if (game.phase === 'gameover') { hideHumanControls(); $('start-area').classList.remove('hidden'); return; }
    if (!game.bettingOpen) {
      hideHumanControls();
      scheduled = setTimeout(() => { game.proceed(); tick(); }, 850);
      return;
    }

    const p = game.players[game.current];
    if (p.isHuman) enableHumanControls();
    else {
      hideHumanControls();
      const delay = 600 + Math.random() * 850;
      scheduled = setTimeout(() => {
        const d = AI.decide(p, game.aiContext());
        game.act(d.action, d.amount);
        actSound(p);
        maybeVoice(p);
        tick();
      }, delay);
    }
  }

  function nextHand() {
    raiseMode = false;
    humanWinPct = null; handAnalysis = null;
    Sfx.resume();
    $('result-banner').classList.add('hidden');
    // 破产救济（免费）
    if (Store.get().coins < game.bigBlind * 2) {
      const got = Store.relief();
      if (got > 0) toast(`金币不足，已免费补充 🪙${got.toLocaleString()}`);
    }
    // 人类带入全部金币；机器人补码到与你相近，保持牌桌活跃
    const base = Math.max(game.bigBlind * 20, Store.get().coins);
    game.players[0].chips = Store.get().coins;
    game.players[0].out = false;
    for (let i = 1; i < game.N; i++) {
      const factor = 0.6 + Math.random() * 0.9;
      game.players[i].chips = Math.max(game.bigBlind * 30, Math.round(base * factor / 100) * 100);
      game.players[i].out = false;
    }
    game.startHand();
    syncWallet();
    Sfx.deal();
    tick();
  }

  /* ---------- 人类操作 ---------- */
  function enableHumanControls() {
    $('start-area').classList.add('hidden');
    $('action-area').classList.remove('hidden');
    exitRaiseMode();
    // 教学助手：高精度蒙特卡洛 + 详细分析
    const meP = game.players[0];
    if (meP && !meP.folded && meP.hole.length === 2) {
      const opp = game.players.filter((p) => !p.folded && !p.out && p !== meP).length || 1;
      const ef = AI.equityFull(meP.hole, game.board, Math.min(opp, 6), 2500);
      const eq = ef.win + ef.tie / 2;
      const winPct = Math.round(ef.win * 100), tiePct = Math.round(ef.tie * 100), losePct = Math.round(ef.lose * 100);
      const name = game.board.length >= 3 ? P.handName(P.evaluateBest(meP.hole.concat(game.board)).score) : '翻牌前';
      const outs = computeOuts(meP.hole, game.board);
      const toCall = Math.max(0, game.currentBet - meP.bet), pot = game.pot;
      let rec, po = null;
      if (toCall === 0) rec = eq > 0.6 ? '强牌 · 下注要价值' : eq > 0.45 ? '中等 · 可过牌或小注' : '偏弱 · 过牌为主';
      else { po = Math.round(toCall / (pot + toCall) * 100); rec = eq * 100 > po + 12 ? '有利 · 跟注，强可加注' : eq * 100 > po ? '勉强 · 便宜可跟' : '不利 · 建议弃牌'; }
      handAnalysis = { winPct, tiePct, losePct, name, outs, po, rec, opp };
      humanWinPct = winPct;
      render();
    }
    const o = game.actionOptions();
    $('btn-fold').classList.remove('hidden');
    const checkBtn = $('btn-check'), callBtn = $('btn-call');
    if (o.canCheck) { checkBtn.classList.remove('hidden'); callBtn.classList.add('hidden'); }
    else {
      checkBtn.classList.add('hidden'); callBtn.classList.remove('hidden');
      callBtn.textContent = o.callAmount >= o.chips ? `全下 ${o.callAmount.toLocaleString()}` : `跟注 ${o.callAmount.toLocaleString()}`;
    }
    const raiseBtn = $('btn-raise');
    if (o.canRaise) { raiseBtn.classList.remove('hidden'); raiseBtn.textContent = o.isBet ? '下注' : '加注'; }
    else raiseBtn.classList.add('hidden');
  }
  function hideHumanControls() { $('action-area').classList.add('hidden'); }

  function enterRaiseMode() {
    raiseMode = true; Sfx.button();
    const o = game.actionOptions();
    $('raise-controls').classList.remove('hidden');
    const slider = $('raise-slider');
    slider.min = o.minRaiseTo; slider.max = o.maxRaiseTo;
    slider.step = Math.max(1, game.bigBlind / 2);
    slider.value = o.minRaiseTo;
    $('raise-value').textContent = o.minRaiseTo.toLocaleString();
    slider._opts = o;
    ['btn-fold', 'btn-check', 'btn-call', 'btn-raise'].forEach((id) => $(id).classList.add('hidden'));
    $('btn-confirm-raise').classList.remove('hidden');
    $('btn-cancel-raise').classList.remove('hidden');
  }
  function exitRaiseMode() {
    raiseMode = false;
    $('raise-controls').classList.add('hidden');
    $('btn-confirm-raise').classList.add('hidden');
    $('btn-cancel-raise').classList.add('hidden');
  }
  const roundToBB = (v) => Math.round(v / game.bigBlind) * game.bigBlind;

  function humanAct(action, amount) {
    const p = game.players[0];
    const facing = (game.currentBet - p.bet) > 0;
    window.OppModel.record(action, facing);
    game.act(action, amount);
    actSound(p);
    tick();
  }

  /* ---------- 弹窗 ---------- */
  const MODALS = ['modal-checkin', 'modal-shop', 'modal-redeem', 'modal-custom', 'modal-wheel'];
  function openModal(id) {
    Sfx.button();
    $('modal-overlay').classList.remove('hidden');
    MODALS.forEach((m) => $(m).classList.toggle('hidden', m !== id));
    if (id === 'modal-checkin') renderCheckin();
    if (id === 'modal-shop') renderShop(currentShopTab);
    if (id === 'modal-redeem') renderGiftCodes();
    if (id === 'modal-wheel') renderWheel();
  }
  function closeModal() {
    $('modal-overlay').classList.add('hidden');
    MODALS.forEach((m) => $(m).classList.add('hidden'));
  }
  function toast(text) {
    const t = $('modal-toast');
    $('modal-overlay').classList.remove('hidden');
    MODALS.forEach((m) => $(m).classList.add('hidden'));
    t.textContent = text; t.classList.remove('hidden');
    setTimeout(() => { t.classList.add('hidden'); if ([...$('modal-overlay').children].every((c) => c.classList.contains('hidden'))) $('modal-overlay').classList.add('hidden'); }, 1700);
  }

  function renderCheckin() {
    const grid = $('checkin-grid');
    const pv = Store.checkinPreview();
    const can = Store.canCheckin();
    grid.innerHTML = Store.CHECKIN.map((r, idx) => {
      const day = idx + 1;
      const claimed = !can ? day <= ((Store.get().checkinStreak - 1) % 7) + 1 && false : false;
      const isToday = can && day === pv.day;
      const done = (!can && day === (((Store.get().checkinStreak - 1) % 7) + 1));
      return `<div class="ci-cell ${day === 7 ? 'big' : ''} ${isToday ? 'today' : ''} ${done ? 'claimed' : ''}">
        <div class="ci-day">第${day}天</div>
        <div class="ci-coin">🪙${(r.coins / 10000)}万</div>
        <div class="ci-dia">💎${r.diamonds}</div>
      </div>`;
    }).join('');
    const btn = $('checkin-claim');
    btn.disabled = !can;
    btn.textContent = can ? '领取今日奖励' : '今日已签到 ✓';
  }

  let currentShopTab = 'coins';
  const COIN_PACKS = [
    { diamonds: 5, coins: 50000 }, { diamonds: 10, coins: 120000 },
    { diamonds: 20, coins: 300000 }, { diamonds: 40, coins: 700000 },
  ];
  function renderShop(tab) {
    currentShopTab = tab;
    document.querySelectorAll('.shop-tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === tab));
    const body = $('shop-body');
    const pr = Store.get();
    if (tab === 'coins') {
      body.innerHTML = `<div class="shop-grid">` + COIN_PACKS.map((pk, i) => `
        <div class="shop-item">
          <div class="si-title">🪙 ${pk.coins.toLocaleString()}</div>
          <div class="si-coins">💎 ${pk.diamonds}</div>
          <button class="buy-btn" data-pack="${i}" ${pr.diamonds < pk.diamonds ? 'disabled' : ''}>兑换</button>
        </div>`).join('') + `</div>`;
    } else if (tab === 'backs') {
      body.innerHTML = `<div class="shop-grid">` + Object.entries(Skins.backs).map(([id, s]) => {
        const owned = pr.ownedBacks.includes(id), active = pr.activeBack === id;
        return `<div class="shop-item">
          <div class="si-title">${s.name}</div>
          <div class="si-preview" style="background:${s.css}"></div>
          ${owned ? `<button class="buy-btn ${active ? 'active-skin' : 'owned'}" data-back="${id}">${active ? '使用中' : '装备'}</button>`
            : `<div class="si-price">💎 ${s.price}</div><button class="buy-btn" data-buyback="${id}" ${pr.diamonds < s.price ? 'disabled' : ''}>购买</button>`}
        </div>`;
      }).join('') + `</div>`;
    } else if (tab === 'avatars') {
      let h = '<div class="shop-grid avatar-grid">';
      for (let n = 1; n <= AVATAR_COUNT; n++) {
        const active = pr.activeAvatar === n;
        h += `<div class="shop-item ${active ? 'on' : ''}" data-avatar="${n}">
          <div class="av-pick" style="background-image:url('assets/av/${n}.png')"></div>
          <div class="si-title">${active ? '使用中' : '头像 ' + n}</div></div>`;
      }
      body.innerHTML = h + '</div>';
    } else if (tab === 'frames' || tab === 'titles' || tab === 'vehicles' || tab === 'watches' || tab === 'scenes') {
      const ownedKey = { frames: 'ownedFrames', titles: 'ownedTitles', vehicles: 'ownedVehicles', watches: 'ownedWatches', scenes: 'ownedScenes' }[tab];
      const activeKey = { frames: 'activeFrame', titles: 'activeTitle', vehicles: 'activeVehicle', watches: 'activeWatch', scenes: 'activeScene' }[tab];
      const preview = (s) => {
        if (tab === 'frames') return `<div class="si-preview" style="border-radius:50%;width:50px;height:50px;box-shadow:${s.css};background:radial-gradient(circle at 40% 30%,#4a6e57,#14281d)"></div>`;
        if (tab === 'titles') return `<div class="si-felt" style="display:flex;align-items:center;justify-content:center;color:${s.color};font-weight:800;font-size:14px">${s.text || '无称号'}</div>`;
        if (tab === 'scenes') return `<div class="si-felt" style="height:64px;background:url('${s.img}') center/cover"></div>`;
        return `<div class="si-felt" style="display:flex;align-items:center;justify-content:center;font-size:34px">${s.icon || '—'}</div>`;
      };
      body.innerHTML = `<div class="shop-grid">` + Object.entries(Skins[tab]).map(([id, s]) => {
        const owned = pr[ownedKey].includes(id) || s.price === 0, active = pr[activeKey] === id;
        return `<div class="shop-item">
          <div class="si-title">${s.name}</div>${preview(s)}
          ${owned ? `<button class="buy-btn ${active ? 'active-skin' : 'owned'}" data-cos="${tab}:${id}">${active ? '使用中' : '装备'}</button>`
            : `<div class="si-price">💎 ${s.price}</div><button class="buy-btn" data-cosbuy="${tab}:${id}" ${pr.diamonds < s.price ? 'disabled' : ''}>购买</button>`}
        </div>`;
      }).join('') + `</div>`;
    } else {
      body.innerHTML = `<div class="shop-grid">` + Object.entries(Skins.felts).map(([id, s]) => {
        const owned = pr.ownedFelts.includes(id), active = pr.activeFelt === id;
        const prev = s.img ? `background:url('${s.img}') center/cover` : `background:radial-gradient(ellipse at 50% 40%,${s.a},${s.b} 60%,${s.c})`;
        return `<div class="shop-item">
          <div class="si-title">${s.name}</div>
          <div class="si-felt" style="${prev}"></div>
          ${owned ? `<button class="buy-btn ${active ? 'active-skin' : 'owned'}" data-felt="${id}">${active ? '使用中' : '装备'}</button>`
            : `<div class="si-price">💎 ${s.price}</div><button class="buy-btn" data-buyfelt="${id}" ${pr.diamonds < s.price ? 'disabled' : ''}>购买</button>`}
        </div>`;
      }).join('') + `</div>`;
    }
  }

  // 礼包码（固定 nonce，稳定可展示；每码一次性）
  const GIFTS = [
    { reward: { type: 'C', value: 200000 }, nonce: 1001, label: '新手金币 20万' },
    { reward: { type: 'D', value: 50 }, nonce: 1002, label: '新手钻石 50' },
    { reward: { type: 'B', value: 'gold' }, nonce: 1003, label: '鎏金牌背' },
    { reward: { type: 'F', value: 'night' }, nonce: 1004, label: '午夜紫桌布' },
  ];
  function renderGiftCodes() {
    const box = $('gift-codes');
    box.innerHTML = `<div style="font-size:12px;color:#bfe6cf;margin-bottom:6px">🎁 礼包码（点填入领取）：</div>` +
      GIFTS.map((g) => {
        const code = Codec.encode(g.reward, g.nonce);
        const used = Store.get().redeemed.includes(code);
        return `<div class="gift-row"><span>${g.label}<br><code>${code}</code></span>
          <button data-fill="${code}" ${used ? 'disabled' : ''}>${used ? '已领' : '填入'}</button></div>`;
      }).join('');
  }

  /* ---------- 等级 ---------- */
  function syncLevel() {
    const li = Store.levelInfo(); const el = $('level-info'); if (!el) return;
    const pct = Math.min(100, Math.round(li.xp / li.need * 100));
    el.innerHTML = 'Lv.' + li.level + '<span class="lvl-bar"><i style="width:' + pct + '%"></i></span>';
  }

  /* ---------- 幸运转盘 ---------- */
  function renderWheel() {
    const w = $('wheel'), segs = Store.WHEEL, n = segs.length, ang = 360 / n;
    const colors = ['#1c5aa0', '#0e6b46', '#8a2330', '#3a2c66'];
    const stops = segs.map((_, i) => `${colors[i % 4]} ${i * ang}deg ${(i + 1) * ang}deg`);
    w.style.background = `conic-gradient(${stops.join(',')})`;
    w.style.transition = 'none'; w.style.transform = 'rotate(0deg)';
    w.innerHTML = segs.map((s, i) => `<div class="wheel-seg" style="transform:rotate(${i * ang + ang / 2}deg)"><b>${s.label}</b></div>`).join('');
    const can = Store.canSpin();
    $('wheel-spin').disabled = !can;
    $('wheel-spin').textContent = can ? '免费抽一次' : '明天再来';
  }
  function spinWheel() {
    if (!Store.canSpin()) return;
    const res = Store.doSpin(); if (!res) return;
    const n = Store.WHEEL.length, ang = 360 / n;
    const target = 360 * 5 - (res.index * ang + ang / 2);
    const w = $('wheel');
    w.style.transition = 'transform 4s cubic-bezier(.15,.85,.2,1)';
    void w.offsetWidth; w.style.transform = `rotate(${target}deg)`;
    $('wheel-spin').disabled = true; Sfx.button();
    setTimeout(() => {
      Sfx.reward(); toast(`🎉 抽中 ${res.reward.label}！`);
      syncWallet(true); syncLevel();
      $('wheel-spin').textContent = '明天再来';
      const wd = $('wheel-dot'); if (wd) wd.classList.add('hidden');
    }, 4100);
  }

  /* ---------- 多屏路由 ---------- */
  function showScreen(name) {
    ['home', 'select', 'table'].forEach((s) => $('screen-' + s).classList.toggle('hidden', s !== name));
  }

  // 场次（不同规则）
  const ROOMS = [
    { ic: '🌱', name: '新手场', desc: '盲注 50/100 · 6人 · 买入 1万', sb: 50, bb: 100, players: 6, buyin: 10000, ante: 0 },
    { ic: '🔥', name: '进阶场', desc: '盲注 200/400 · 6人 · 买入 5万', sb: 200, bb: 400, players: 6, buyin: 50000, ante: 0 },
    { ic: '💎', name: '高额场', desc: '盲注 1000/2000 · 6人 · 买入 20万', sb: 1000, bb: 2000, players: 6, buyin: 200000, ante: 0 },
    { ic: '⚔️', name: '单挑', desc: '盲注 100/200 · 2人 · 买入 2万', sb: 100, bb: 200, players: 2, buyin: 20000, ante: 0 },
    { ic: '👑', name: '九人桌', desc: '盲注 100/200 · 9人 · 买入 3万 · 含前注', sb: 100, bb: 200, players: 9, buyin: 30000, ante: 20 },
    { ic: '🦈', name: '高手场', desc: '紧凶鲨鱼 · 会读你打法 · 200/400 · 6人', sb: 200, bb: 400, players: 6, buyin: 60000, ante: 0, level: 'hard' },
    { ic: '🏆', name: '大师场', desc: '最强 AI · 极限剥削 · 500/1000 · 6人', sb: 500, bb: 1000, players: 6, buyin: 150000, ante: 50, level: 'master' },
  ];
  function renderRooms() {
    $('room-list').innerHTML = ROOMS.map((r, i) =>
      `<div class="room-card" data-room="${i}"><div class="room-ic">${r.ic}</div>
        <div class="room-info"><div class="room-name">${r.name}</div><div class="room-desc">${r.desc}</div></div>
        <button class="room-go">进入</button></div>`
    ).join('') +
      `<div class="room-card custom" data-custom="1"><div class="room-ic">🛠️</div>
        <div class="room-info"><div class="room-name">自定义牌桌</div><div class="room-desc">自己设盲注 / 人数 / 前注</div></div>
        <button class="room-go">设置</button></div>`;
  }

  // 自定义配置
  const custom = { bb: 100, players: 6, ante: 0 };
  function renderCustom() {
    const blinds = [[50, 100], [100, 200], [500, 1000], [1000, 2000]];
    const seats = [2, 6, 9];
    const antes = [0, 20, 50, 100];
    const seg = (label, opts, cur, key, fmt) =>
      `<div class="cf-row"><span>${label}</span><div class="cf-opts">${opts.map((o) =>
        `<button class="cf-opt ${(''+(fmt?fmt(o):o))===(''+cur)?'on':''}" data-k="${key}" data-v="${Array.isArray(o)?o[1]:o}">${fmt?fmt(o):o}</button>`).join('')}</div></div>`;
    $('custom-body').innerHTML =
      seg('盲注', blinds, custom.bb, 'bb', (o) => `${o[0]}/${o[1]}`) +
      seg('人数', seats, custom.players, 'players', (o) => o + '人') +
      seg('前注', antes, custom.ante, 'ante', (o) => o === 0 ? '无' : o);
  }

  /* ---------- 进入牌桌 ---------- */
  function startTable(cfg) {
    if (scheduled) { clearTimeout(scheduled); scheduled = null; }
    tableConfig = cfg;
    SEAT_POS = SEAT_LAYOUTS[cfg.players] || SEAT_LAYOUTS[6];
    game = new window.Game({ smallBlind: cfg.sb, bigBlind: cfg.bb, startChips: cfg.buyin, ante: cfg.ante || 0, bots: cfg.players - 1 });
    // 按难度配置 AI：高手/大师=鲨鱼，更准的模拟
    game.players.forEach((pl) => { if (!pl.isHuman) pl.ai = AI.makePersona(cfg.level); });
    AI.setSims(cfg.level === 'master' ? 260 : cfg.level === 'hard' ? 220 : 170);
    // 头像分配：你用所选头像，机器人用不重复的随机头像
    const me = Store.get().activeAvatar || 1;
    const pool = []; for (let k = 1; k <= AVATAR_COUNT; k++) if (k !== me) pool.push(k);
    for (let k = pool.length - 1; k > 0; k--) { const j = Math.floor(Math.random() * (k + 1)); const t = pool[k]; pool[k] = pool[j]; pool[j] = t; }
    seatAvatars = [me, ...pool];
    seatVoice = game.players.map((_, i) => i % 2); // 0辽宁东北女 / 1男声 错开
    boardCount = -1; lastDecoratedHand = -1; lastSyncedHand = -1; raiseMode = false;
    buildSeats();
    showScreen('table');
    $('start-area').classList.remove('hidden');
    $('btn-start').textContent = '开始发牌';
    hideHumanControls();
    render();
    // 入场特效：牌桌放大 + 座驾驶过 + 发牌音
    const tf = $('table-felt'); tf.classList.remove('enter'); void tf.offsetWidth; tf.classList.add('enter');
    Sfx.resume(); playVehicleEntrance(); setTimeout(() => Sfx.deal(), 120);
  }

  /* ---------- 事件绑定 ---------- */
  function setupEvents() {
    // 路由
    $('btn-play').addEventListener('click', () => { Sfx.resume(); if (window.Music && !Sfx.isMuted()) Music.start(); Sfx.button(); renderRooms(); showScreen('select'); });
    $('btn-select-back').addEventListener('click', () => { Sfx.button(); showScreen('home'); });
    $('btn-table-back').addEventListener('click', () => { if (scheduled) { clearTimeout(scheduled); scheduled = null; } Sfx.button(); showScreen('home'); syncWallet(); });
    $('room-list').addEventListener('click', (e) => {
      const card = e.target.closest('[data-room],[data-custom]'); if (!card) return;
      Sfx.button();
      if (card.dataset.custom) { renderCustom(); openModal('modal-custom'); }
      else startTable(ROOMS[+card.dataset.room]);
    });
    $('custom-body').addEventListener('click', (e) => {
      const b = e.target.closest('.cf-opt'); if (!b) return;
      custom[b.dataset.k] = +b.dataset.v; renderCustom();
    });
    $('custom-start').addEventListener('click', () => {
      closeModal();
      startTable({ sb: Math.round(custom.bb / 2), bb: custom.bb, players: custom.players, ante: custom.ante, buyin: Math.max(20000, custom.bb * 100) });
    });

    $('btn-start').addEventListener('click', () => { Sfx.resume(); nextHand(); });
    $('btn-fold').addEventListener('click', () => humanAct('fold'));
    $('btn-check').addEventListener('click', () => humanAct('check'));
    $('btn-call').addEventListener('click', () => humanAct('call'));
    $('btn-raise').addEventListener('click', enterRaiseMode);
    $('btn-cancel-raise').addEventListener('click', enableHumanControls);
    $('btn-confirm-raise').addEventListener('click', () => {
      const v = parseInt($('raise-slider').value, 10);
      exitRaiseMode(); humanAct('raise', v);
    });
    const slider = $('raise-slider');
    slider.addEventListener('input', () => { $('raise-value').textContent = (+slider.value).toLocaleString(); });
    document.querySelectorAll('.quick').forEach((b) => b.addEventListener('click', () => {
      const o = slider._opts || game.actionOptions();
      const q = b.dataset.q; let target;
      if (q === 'min') target = o.minRaiseTo;
      else if (q === 'half') target = roundToBB(o.currentBet + o.pot * 0.5);
      else if (q === 'pot') target = roundToBB(o.currentBet + o.pot);
      else target = o.maxRaiseTo;
      target = Math.max(o.minRaiseTo, Math.min(target, o.maxRaiseTo));
      slider.value = target; $('raise-value').textContent = target.toLocaleString();
    }));

    // 功能栏
    $('btn-checkin').addEventListener('click', () => openModal('modal-checkin'));
    $('btn-wheel').addEventListener('click', () => openModal('modal-wheel'));
    $('wheel-spin').addEventListener('click', spinWheel);
    $('btn-shop').addEventListener('click', () => openModal('modal-shop'));
    $('btn-redeem').addEventListener('click', () => openModal('modal-redeem'));
    $('btn-sound').addEventListener('click', () => {
      const m = !Sfx.isMuted();
      Sfx.setMuted(m); Store.setMuted(m); window.Music && Music.setMuted(m); window.Voice && Voice.setMuted(m);
      $('sound-icon').textContent = m ? '🔇' : '🔊';
      if (!m) { Sfx.resume(); Sfx.button(); window.Music && Music.start(); }
    });

    // 弹窗关闭
    document.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', closeModal));
    $('modal-overlay').addEventListener('click', (e) => { if (e.target.id === 'modal-overlay') closeModal(); });

    // 签到领取
    $('checkin-claim').addEventListener('click', () => {
      const r = Store.doCheckin();
      if (r) {
        Sfx.reward();
        toast(`签到成功！🪙+${r.reward.coins.toLocaleString()}  💎+${r.reward.diamonds}`);
        syncWallet(true);
      }
    });

    // 商店 tab + 购买
    document.querySelectorAll('.shop-tab').forEach((t) => t.addEventListener('click', () => { Sfx.button(); renderShop(t.dataset.tab); }));
    $('shop-body').addEventListener('click', (e) => {
      const av = e.target.closest('[data-avatar]');
      if (av) { Store.setAvatar(+av.dataset.avatar); Sfx.button(); renderShop('avatars'); return; }
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.pack !== undefined) {
        const pk = COIN_PACKS[+b.dataset.pack];
        if (Store.buyCoinPack(pk)) { Sfx.reward(); toast(`兑换成功 🪙+${pk.coins.toLocaleString()}`); syncWallet(true); renderShop('coins'); }
      } else if (b.dataset.buyback) {
        if (Store.buyBack(b.dataset.buyback)) { Sfx.reward(); toast('购买成功'); syncWallet(); renderShop('backs'); }
      } else if (b.dataset.back) {
        Store.setBack(b.dataset.back); Skins.apply(); Sfx.button(); renderShop('backs'); refreshCardSkins();
      } else if (b.dataset.buyfelt) {
        if (Store.buyFelt(b.dataset.buyfelt)) { Sfx.reward(); toast('购买成功'); syncWallet(); renderShop('felts'); }
      } else if (b.dataset.felt) {
        Store.setFelt(b.dataset.felt); Skins.apply(); Sfx.button(); renderShop('felts');
      } else if (b.dataset.cosbuy) {
        const [m, id] = b.dataset.cosbuy.split(':');
        const fn = { frames: 'buyFrame', titles: 'buyTitle', vehicles: 'buyVehicle', watches: 'buyWatch', scenes: 'buyScene' }[m];
        if (Store[fn](id)) { Sfx.reward(); toast('购买成功'); syncWallet(); renderShop(m); }
      } else if (b.dataset.cos) {
        const [m, id] = b.dataset.cos.split(':');
        const fn = { frames: 'setFrame', titles: 'setTitle', vehicles: 'setVehicle', watches: 'setWatch', scenes: 'setScene' }[m];
        Store[fn](id); Skins.apply(); Sfx.button(); renderShop(m);
        if (game) render();
        if (m === 'vehicles' && id !== 'none') playVehicleEntrance();
      }
    });

    // 兑换码
    $('redeem-submit').addEventListener('click', doRedeem);
    $('redeem-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') doRedeem(); });
    $('gift-codes').addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b || !b.dataset.fill) return;
      $('redeem-input').value = b.dataset.fill;
      doRedeem();
    });

    // 首次交互恢复音频
    document.addEventListener('pointerdown', () => { Sfx.resume(); if (window.Music && !Sfx.isMuted()) Music.start(); }, { once: true });
  }

  function doRedeem() {
    const code = $('redeem-input').value;
    const r = Store.redeem(code);
    const msg = $('redeem-msg');
    msg.textContent = r.msg;
    msg.className = r.ok ? 'ok' : 'err';
    if (r.ok) {
      Sfx.reward(); syncWallet(true);
      $('redeem-input').value = '';
      Skins.apply(); refreshCardSkins(); renderGiftCodes();
    } else Sfx.fold();
  }

  // 重新渲染牌背（皮肤切换后让已发的牌背更新）
  function refreshCardSkins() { for (let i = 0; i < seatSig.length; i++) seatSig[i] = ''; render(); }

  /* ---------- 初始化 ---------- */
  Skins.apply();
  Sfx.setMuted(Store.get().muted);
  if (window.Music) Music.setMuted(Store.get().muted);
  if (window.Voice) Voice.setMuted(Store.get().muted);
  $('sound-icon').textContent = Store.get().muted ? '🔇' : '🔊';
  setupEvents();
  syncWallet();
  syncLevel();
  showScreen('home');

  // 预览模式(仅用于截图调试，?preview 或 ?preview=4 指定场次)：摆静态演示局，不启动循环
  const pv = location.search.match(/preview=?(\d+)?/);
  if (pv) {
    startTable(ROOMS[pv[1] ? +pv[1] : 0]);
    const deck = P.shuffle(P.createDeck());
    game.handNo = 12; game.button = game.N - 1; game.phase = 'flop'; game.bettingOpen = true; game.current = 0;
    game.players[0].hole = [{ rank: 14, suit: 's' }, { rank: 14, suit: 'h' }]; // 你拿一对A，演示牌型提示
    game.board = [deck.pop(), deck.pop(), deck.pop()];
    game.players.forEach((p, i) => {
      p.out = false; p.folded = (i % 4 === 3); p.allIn = false;
      if (i > 0) p.hole = [deck.pop(), deck.pop()];
      p.bet = i === 0 ? 600 : (i % 3 === 0 ? 0 : 600);
      p.totalContribution = p.bet; p.lastAction = p.folded ? '弃牌' : (p.bet ? '跟注' : ''); p.winThisHand = 0;
    });
    for (let i = 0; i < seatSig.length; i++) seatSig[i] = '';
    render();
    enableHumanControls();
  }
})();
