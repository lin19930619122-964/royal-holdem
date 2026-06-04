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
  let seatProfiles = [];      // AI 对手画像(本桌):风格 + 本局观察统计
  // AI 风格 → 原创中文画像
  const STYLE_INFO = {
    nit:     { label: '岩石', tag: '紧弱', color: '#8fb6ff', desc: '极紧，只玩强牌，怕被诈唬。对策：多偷盲、单挑施压。' },
    tag:     { label: '紧凶', tag: 'TAG', color: '#5fd38a', desc: '紧且有侵略性，价值清晰。对策：尊重其加注，别轻易跟丢。' },
    lag:     { label: '松凶', tag: 'LAG', color: '#ffb454', desc: '范围宽、爱施压，诈唬多。对策：用强牌抓诈，慎打边缘牌。' },
    station: { label: '跟注站', tag: '松弱', color: '#ff8db0', desc: '什么都跟，很少弃。对策：只打价值，别对它诈唬。' },
    maniac:  { label: '疯子', tag: '超凶', color: '#ff6b6b', desc: '疯狂加注全下，方差极大。对策：耐心等强牌收割。' },
    shark:   { label: '鲨鱼', tag: '高手', color: '#c9a6ff', desc: '紧凶+高纪律+读你弱点，难被抓。对策：减少漏洞、保持平衡。' },
  };
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
  let handDecisions = [];   // 本手牌内你的每个决策(用于复盘/错误分析)
  const prevLA = [];

  // 牌局复盘：把一张牌渲染成带花色颜色的小标签
  function cardChip(card) {
    if (!card) return '';
    const red = P.isRed(card);
    return `<span class="rc-card${red ? ' red' : ''}">${P.RANK_LABEL[card.rank]}${P.SUIT_SYMBOL[card.suit]}</span>`;
  }
  const STREET_CN = (n) => (n === 0 ? '翻牌前' : n === 3 ? '翻牌' : n === 4 ? '转牌' : '河牌');
  const ACTION_CN = { fold: '弃牌', check: '过牌', call: '跟注', raise: '加注' };
  // 决策对错判定：用决策当下的胜率(权益) 对比 底池赔率，给出训练反馈
  function verdictFor(action, winPct, toCall, pot) {
    if (winPct == null) return { tag: '—', good: null, why: '' };
    const eq = winPct / 100;
    const po = toCall > 0 ? toCall / (pot + toCall) : 0;       // 需要的最低胜率
    const poTxt = toCall > 0 ? `需≥${Math.round(po * 100)}%` : '无需跟注';
    if (action === 'fold') {
      if (toCall > 0 && eq > po + 0.10) return { tag: '❗偏误', good: false, why: `胜率 ${winPct}% 高于赔率门槛(${poTxt})，弃牌丢了价值` };
      return { tag: '✓ 合理', good: true, why: `胜率 ${winPct}% 不足以跟注(${poTxt})，弃牌正确` };
    }
    if (action === 'call') {
      if (toCall > 0 && eq < po - 0.04) return { tag: '❗偏误', good: false, why: `胜率 ${winPct}% 低于赔率门槛(${poTxt})，赔率不足` };
      return { tag: '✓ 合理', good: true, why: `胜率 ${winPct}% 满足赔率门槛(${poTxt})` };
    }
    if (action === 'raise') {
      if (eq > 0.6) return { tag: '✓ 价值', good: true, why: `胜率 ${winPct}%，加注要价值` };
      if (eq < 0.33) return { tag: '⚠ 诈唬', good: null, why: `胜率 ${winPct}% 偏低，属高风险诈唬` };
      return { tag: '◆ 进攻', good: null, why: `胜率 ${winPct}%，半诈唬/施压` };
    }
    if (action === 'check') return { tag: '○ 过牌', good: null, why: `胜率 ${winPct}%，免费看牌` };
    return { tag: '—', good: null, why: '' };
  }

  // 听牌/改善张数(outs)：枚举剩余牌，能提升牌型类别的张数
  // 翻牌前起手牌分类（原创简化范围，用于训练范围意识）
  function preflopClass(hole) {
    if (!hole || hole.length < 2) return '翻牌前';
    const a = Math.max(hole[0].rank, hole[1].rank), b = Math.min(hole[0].rank, hole[1].rank);
    const suited = hole[0].suit === hole[1].suit, pair = a === b, gap = a - b;
    const L = (r) => P.RANK_LABEL[r];
    const note = pair ? `${L(a)}${L(a)}` : `${L(a)}${L(b)}${suited ? 's' : 'o'}`;
    let cls;
    if (pair && a >= 12) cls = '顶级强牌';          // QQ+
    else if (a === 14 && b === 13) cls = '顶级强牌'; // AK
    else if (pair && a >= 9) cls = '强开牌';         // 99-JJ
    else if (a === 14 && b >= 11) cls = '强开牌';    // AQ/AJ
    else if (pair) cls = '可玩对子';
    else if (suited && a >= 13 && b >= 10) cls = '强开牌';
    else if (a >= 12 && b >= 10) cls = '边缘可玩';   // 大牌
    else if (suited && gap <= 2 && b >= 5) cls = '投机同花连张';
    else if (a === 14) cls = '边缘可玩';             // Ax
    else cls = '偏弱牌';
    return `${cls} (${note})`;
  }
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
    syncHome();
  }

  function syncHome() {
    const p = Store.get();
    const av = $('home-avatar');
    if (av) av.src = `assets/av/${p.activeAvatar || 1}.png`;
    const title = $('home-title');
    if (title) {
      const t = Skins.titles[p.activeTitle];
      title.textContent = t && t.text ? t.text.replace(/[^\u4e00-\u9fa5A-Za-z0-9]/g, '') : '德州新秀';
    }
    const hands = p.handsPlayed || 0;
    const wins = p.handsWon || 0;
    const rate = hands ? Math.round(wins / hands * 100) : 0;
    if ($('home-hands')) $('home-hands').textContent = `${hands}手`;
    if ($('home-winrate')) $('home-winrate').textContent = `胜率 ${rate}%`;
    if ($('home-pot')) $('home-pot').textContent = `最大底池 ${fmtChips(p.biggestPot || 0)}`;
    const tasks = Store.getTasks();
    const doneN = tasks.filter((t) => t.done).length;
    const claimable = tasks.some((t) => t.done && !t.claimed) || Store.getAchievements().some((a) => a.unlocked && !a.claimed);
    if ($('home-mission-line')) $('home-mission-line').textContent = claimable ? `有奖励可领取！(${doneN}/${tasks.length} 完成)` : `${doneN}/${tasks.length} 已完成，继续打牌领奖励`;
    const vip = vipInfo(p);
    if ($('home-vip')) $('home-vip').textContent = vip.level;
    if ($('home-vip-next')) $('home-vip-next').textContent = vip.nextText;
    if ($('home-vip-bar')) $('home-vip-bar').style.width = vip.progress + '%';
    const season = seasonInfo(p);
    if ($('home-season')) $('home-season').textContent = season.rank;
    if ($('home-season-next')) $('home-season-next').textContent = `Lv.${p.level || 1} / 50`;
    if ($('home-season-bar')) $('home-season-bar').style.width = season.progress + '%';
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
    if (Store.get().coachMode && me && me.hole.length === 2 && !me.folded && !me.out && handAnalysis && game.phase !== 'idle' && game.phase !== 'gameover') {
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

  /* ---------- 牌桌社交（快捷语 / 礼物 / AI 闲聊） ---------- */
  function activeOpponents() {
    if (!game) return [];
    return game.players.filter((p) => !p.isHuman && !p.out);
  }
  // 你说一句快捷语：座位上方冒泡，随机对手回应
  function sayPhrase(text) {
    if (!game || !seatEls[0]) return;
    Fx.speechBubble(seatEls[0], text, 'mine');
    Sfx.button();
    const opps = activeOpponents();
    if (opps.length && Math.random() < 0.8) {
      const opp = opps[Math.floor(Math.random() * opps.length)];
      setTimeout(() => {
        const el = seatEls[opp.id];
        const reply = Social.pickChatter(Math.random() < 0.5 ? 'raise' : 'fold') || '哼';
        if (el) Fx.speechBubble(el, reply);
      }, 900 + Math.random() * 700);
    }
  }
  // 送礼物：扣训练筹码（如有价），飞向随机对手并命中爆开
  function sendGift(id) {
    const gf = (Social.GIFTS || []).find((g) => g.id === id);
    if (!gf || !game || !seatEls[0]) return;
    if (gf.cost > 0 && Store.get().coins < gf.cost) { toast('训练筹码不足'); return; }
    const opps = activeOpponents();
    if (!opps.length) { toast('暂无可赠送的对手'); return; }
    const target = opps[Math.floor(Math.random() * opps.length)];
    if (gf.cost > 0) { Store.get().coins -= gf.cost; Store.save(); syncWallet(true); }
    closeModal();
    Fx.flyGift(seatEls[0], seatEls[target.id], fxLayer, gf.icon);
    try { Sfx.gift(gf.sfx); } catch (_) {}
    setTimeout(() => { if (seatEls[target.id]) Fx.speechBubble(seatEls[target.id], Social.pickChatter('win') || '多谢'); }, 1000);
  }
  // 记录 AI 本局行动统计（用于对手画像）
  function recordSeatAct(p) {
    const pr = seatProfiles[p.id];
    if (!pr) return;
    pr.acts++;
    switch (p.lastAction) {
      case '加注': case '下注': pr.raises++; pr.entered++; break;
      case '跟注': pr.calls++; pr.entered++; break;
      case '弃牌': pr.folds++; break;
      case '全下': pr.allins++; pr.entered++; break;
    }
  }
  // AI 行动时偶尔闲聊（冒泡），与语音错峰
  function maybeChatter(p) {
    if (!p || p.isHuman || !window.Social || !seatEls[p.id]) return;
    const key = ACT2VOICE[p.lastAction];
    let ck = (key === 'raise') ? 'raise' : (key === 'allin') ? 'allin' : (key === 'fold') ? 'fold' : null;
    if (!ck) return;
    if (Math.random() < 0.28) {
      const line = Social.pickChatter(ck);
      if (line) Fx.speechBubble(seatEls[p.id], line);
    }
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
    if (humanWon) {
      Sfx.win(); Fx.vibrate(60);
      // 连胜烈焰：≥2 连胜起阶梯升级（程序化火焰，无大资源）
      const streak = Store.get().winStreak || 0;
      if (streak >= 2) {
        const L = Fx.streakFlame(fxLayer, streak);
        try { Sfx.streak(L || 1); } catch (_) {}
        if (streak >= 4) Fx.shake($('table-wrap'), streak >= 6 ? 9 : 6);
      }
    } else { Sfx.lose(); }

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
        const hc = (game.result && game.result.showdown && game.result.handScores && game.result.handScores[0]) ? game.result.handScores[0][0] : 0;
        Store.recordHand(meP.winThisHand > 0, game.pot, hc);
        // 经验：打一手 +12，赢了 +30，摊牌成大牌额外加成
        let xp = 12 + (meP.winThisHand > 0 ? 30 : 0);
        if (game.result && game.result.showdown && game.result.handScores && game.result.handScores[0]) xp += game.result.handScores[0][0] * 6;
        const up = Store.addXp(xp);
        Store.addSeasonXp(xp);  // 赛季经验同步累计
        const promo = Store.recordRank(meP.winThisHand > 0);  // 段位积分，晋升则提示
        if (promo) setTimeout(() => { toast(`🏆 段位晋升：${promo}！`); Sfx.reward(); }, 1600);
        // 牌局复盘记录：编号、公共牌、你的手牌、净盈亏、摊牌信息、你的决策与对错
        try {
          const res = game.result || {};
          const net = (meP.winThisHand || 0) - (meP.totalContribution || 0);
          const showdown = !!res.showdown;
          const oppShow = showdown && res.handScores
            ? game.players.filter((pl) => !pl.isHuman && !pl.folded && !pl.out && pl.hole && pl.hole.length === 2)
                .map((pl) => ({ name: pl.name, hole: pl.hole.slice(), hand: (res.handNames && res.handNames[pl.id]) || '' }))
            : [];
          const mistakes = handDecisions.filter((d) => d.good === false).length;
          Store.addHandRecord({
            no: Store.nextHandNo(),
            board: game.board.slice(),
            hole: (meP.hole || []).slice(),
            net, won: meP.winThisHand > 0, folded: meP.folded,
            myHand: showdown && res.handNames ? (res.handNames[0] || '') : '',
            summary: res.summary || '',
            showdown, oppShow,
            decisions: handDecisions.slice(),
            mistakes,
          });
        } catch (e) {}
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
        recordSeatAct(p);
        actSound(p);
        maybeVoice(p);
        maybeChatter(p);
        tick();
      }, delay);
    }
  }

  function nextHand() {
    raiseMode = false;
    humanWinPct = null; handAnalysis = null; handDecisions = [];
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
      const name = game.board.length >= 3 ? P.handName(P.evaluateBest(meP.hole.concat(game.board)).score) : preflopClass(meP.hole);
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
    // 复盘记录：在出手前抓取决策当下的胜率/底池/待跟注，并即时判定对错
    const toCall = Math.max(0, game.currentBet - p.bet), potNow = game.pot;
    const v = verdictFor(action, humanWinPct, toCall, potNow);
    handDecisions.push({
      street: STREET_CN(game.board.length), action: ACTION_CN[action] || action,
      winPct: humanWinPct, toCall, pot: potNow,
      tag: v.tag, good: v.good, why: v.why,
    });
    window.OppModel.record(action, facing);
    game.act(action, amount);
    if (p.lastAction === '全下') Store.recordAllin();
    actSound(p);
    tick();
  }

  /* ---------- 弹窗 ---------- */
  const MODALS = ['modal-checkin', 'modal-shop', 'modal-redeem', 'modal-custom', 'modal-wheel', 'modal-panel'];
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

  function pct(n, d) { return Math.max(0, Math.min(100, d ? Math.round(n / d * 100) : 0)); }
  function vipInfo(p) {
    const hands = p.handsPlayed || 0;
    const thresholds = [0, 20, 60, 140, 300, 600, 1000];
    let level = 0;
    for (let i = 0; i < thresholds.length; i++) if (hands >= thresholds[i]) level = i;
    const next = thresholds[level + 1] || thresholds[thresholds.length - 1];
    const prev = thresholds[level] || 0;
    const progress = level >= thresholds.length - 1 ? 100 : pct(hands - prev, next - prev);
    return {
      level,
      progress,
      nextText: level >= thresholds.length - 1 ? '已达最高贵宾' : `距 VIP${level + 1} 还差 ${Math.max(0, next - hands)}局`,
      rebate: [0, 2, 4, 6, 8, 10, 12][level] || 0,
    };
  }
  function seasonInfo(p) {
    const lv = p.level || 1;
    const ranks = ['青铜 I', '青铜 II', '白银 I', '黄金 I', '铂金 I', '钻石 I', '皇家大师'];
    const idx = Math.min(ranks.length - 1, Math.floor((lv - 1) / 8));
    return { rank: ranks[idx], progress: pct(lv, 50), idx };
  }
  function panelRow(ic, title, text, tag) {
    return `<div class="panel-row"><div class="pr-ic">${ic}</div><div><b>${title}</b><div class="pr-text">${text}</div></div><em>${tag || ''}</em></div>`;
  }
  // 复盘列表：最近若干手，含编号、净盈亏、错误数、可点击进入详情
  function renderHandLogList() {
    const log = Store.getHandLog();
    const totalMistakes = log.reduce((s, h) => s + (h.mistakes || 0), 0);
    const reviewed = log.length;
    const acc = (() => {
      let n = 0, g = 0;
      log.forEach((h) => (h.decisions || []).forEach((d) => { if (d.good === true || d.good === false) { n++; if (d.good) g++; } }));
      return n ? Math.round(g / n * 100) : 0;
    })();
    let html = `<div class="panel-hero"><b>牌局复盘</b><span>每手牌自动记录你的决策，并按"胜率 vs 底池赔率"判定对错。点任意一手查看逐步复盘与对手摊牌。</span></div>
      <div class="metric-grid">
        <div class="metric"><b>${reviewed}</b><span>已记录手数</span></div>
        <div class="metric"><b>${acc}%</b><span>决策正确率</span></div>
        <div class="metric"><b>${totalMistakes}</b><span>待复盘失误</span></div>
      </div>`;
    if (!log.length) {
      html += `<div class="panel-list">${panelRow('🃏', '暂无记录', '打完一手牌后，这里会出现可点击复盘的牌谱。', '提示')}</div>`;
      return html;
    }
    html += `<div class="panel-list">` + log.map((h, idx) => {
      const sign = h.net > 0 ? '+' : '';
      const cls = h.net > 0 ? 'pr-net-up' : h.net < 0 ? 'pr-net-down' : '';
      const flag = h.mistakes > 0 ? `<span class="rc-flag">${h.mistakes}处待复盘</span>` : `<span class="rc-ok">✓</span>`;
      const cards = (h.hole || []).map(cardChip).join('');
      const result = h.folded ? '弃牌' : (h.won ? '获胜' : (h.showdown ? '摊牌负' : '未赢'));
      return `<div class="panel-row rc-row" data-hand="${idx}">
        <div class="pr-ic">#${h.no}</div>
        <div><b>${cards} <span class="rc-sub">${result}</span></b>
          <div class="pr-text">${flag} · ${(h.decisions || []).length} 个决策</div></div>
        <em class="${cls}">${sign}${fmtChips(h.net)}</em></div>`;
    }).join('') + `</div>
      <div class="rc-actions"><button class="pr-claim" data-hand-clear="1">清空复盘记录</button></div>`;
    return html;
  }
  // 单手复盘详情：公共牌、你的手牌、逐决策对错与解释、对手摊牌
  function renderHandDetail(idx) {
    const log = Store.getHandLog();
    const h = log[idx];
    if (!h) return renderHandLogList();
    const board = (h.board || []).map(cardChip).join(' ') || '<span class="rc-sub">未到翻牌</span>';
    const hole = (h.hole || []).map(cardChip).join(' ');
    const sign = h.net > 0 ? '+' : '';
    const netCls = h.net > 0 ? 'pr-net-up' : h.net < 0 ? 'pr-net-down' : '';
    let html = `<div class="rc-back"><button class="pr-ghost" data-hand-back="1">← 返回列表</button><span>第 ${h.no} 手复盘</span></div>
      <div class="rc-board"><div class="rc-line"><span class="rc-label">公共牌</span>${board}</div>
        <div class="rc-line"><span class="rc-label">你的手牌</span>${hole} ${h.myHand ? `<span class="rc-sub">(${h.myHand})</span>` : ''}</div>
        <div class="rc-line"><span class="rc-label">结果</span><b class="${netCls}">${sign}${fmtChips(h.net)}</b> <span class="rc-sub">${h.summary || ''}</span></div></div>`;
    html += `<div class="rc-steps">`;
    if (!(h.decisions || []).length) {
      html += `<div class="rc-sub" style="padding:10px">本手你未行动(自动盖牌/盲注)。</div>`;
    } else {
      h.decisions.forEach((d, i) => {
        const badge = d.good === true ? 'rc-good' : d.good === false ? 'rc-bad' : 'rc-neutral';
        const wp = d.winPct != null ? `胜率 ${d.winPct}%` : '';
        const odds = d.toCall > 0 ? ` · 跟${fmtChips(d.toCall)}/池${fmtChips(d.pot)}` : '';
        html += `<div class="rc-step">
          <div class="rc-step-h"><b>${i + 1}. ${d.street} · ${d.action}</b><span class="rc-tag ${badge}">${d.tag}</span></div>
          <div class="rc-sub">${wp}${odds}</div>
          ${d.why ? `<div class="rc-why">${d.why}</div>` : ''}</div>`;
      });
    }
    html += `</div>`;
    if (h.showdown && h.oppShow && h.oppShow.length) {
      html += `<div class="rc-board"><div class="rc-line"><span class="rc-label">对手摊牌</span></div>` +
        h.oppShow.map((o) => `<div class="rc-line"><span class="rc-sub" style="min-width:64px">${o.name}</span>${(o.hole || []).map(cardChip).join(' ')} <span class="rc-sub">${o.hand}</span></div>`).join('') +
        `</div>`;
    }
    return html;
  }

  // 皇家赛季 battle pass：奖励表 + 领取 + 进度（season 与 passport 共用）
  function renderSeasonTrack() {
    const s = Store.getSeason();
    const rankI = Store.rankInfo();
    let html = `<div class="panel-hero"><b>皇家赛季 · ${s.id || ''}</b><span>免费赛季通行证：打牌积累赛季经验，逐级解锁金币与钻石奖励，每月初重置。</span></div>
      <div class="metric-grid">
        <div class="metric"><b>Lv.${s.level}/${s.total}</b><span>赛季等级</span></div>
        <div class="metric"><b>${rankI.name}</b><span>当前段位</span></div>
        <div class="metric"><b>${rankI.points}</b><span>段位积分</span></div>
      </div>
      <div class="curve-wrap"><div class="curve-title">本级进度 ${s.need ? s.xp + '/' + s.need : '已满级'}</div>
        <div class="progress-track"><i style="width:${s.need ? pct(s.xp, s.need) : 100}%"></i></div></div>`;
    if (s.claimable) html += `<div class="rc-actions"><button class="pr-claim" data-claim-season-all="1">一键领取全部可领</button></div>`;
    html += `<div class="season-track">`;
    s.rewards.forEach((r) => {
      const state = r.claimed ? `<em class="rc-ok">已领</em>`
        : r.unlocked ? `<button class="pr-claim" data-claim-season="${r.level}">领取</button>`
        : `<em class="rc-sub">未解锁</em>`;
      html += `<div class="season-row${r.unlocked && !r.claimed ? ' season-ready' : ''}${r.claimed ? ' season-done' : ''}">
        <div class="season-lv">Lv.${r.level}</div>
        <div class="season-reward">🪙${fmtChips(r.coins)}${r.diamonds ? ' · 💎' + r.diamonds : ''}</div>
        ${state}</div>`;
    });
    html += `</div>`;
    return html;
  }

  // 盈利曲线：把牌谱净收益按时间累计，画成 Canvas 折线（程序化，无大资源）
  function drawProfitCurve() {
    const cv = $('profit-curve'); if (!cv || !cv.getContext) return;
    const log = Store.getHandLog(); if (log.length < 2) return;
    const series = log.slice().reverse(); // 旧→新
    let cum = 0; const pts = series.map((h) => (cum += (h.net || 0)));
    const w = cv.width, hgt = cv.height, pad = 6;
    const ctx = cv.getContext('2d'); ctx.clearRect(0, 0, w, hgt);
    const min = Math.min(0, ...pts), max = Math.max(0, ...pts), range = (max - min) || 1;
    const X = (i) => pad + i * (w - pad * 2) / (pts.length - 1);
    const Y = (v) => hgt - pad - (v - min) / range * (hgt - pad * 2);
    // 零线
    ctx.strokeStyle = 'rgba(255,255,255,.18)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(pad, Y(0)); ctx.lineTo(w - pad, Y(0)); ctx.stroke();
    // 填充
    const grad = ctx.createLinearGradient(0, 0, 0, hgt);
    grad.addColorStop(0, 'rgba(95,211,138,.35)'); grad.addColorStop(1, 'rgba(95,211,138,0)');
    ctx.beginPath(); ctx.moveTo(X(0), Y(pts[0]));
    pts.forEach((v, i) => ctx.lineTo(X(i), Y(v)));
    ctx.lineTo(X(pts.length - 1), Y(0)); ctx.lineTo(X(0), Y(0)); ctx.closePath();
    ctx.fillStyle = grad; ctx.fill();
    // 折线
    ctx.beginPath(); ctx.moveTo(X(0), Y(pts[0]));
    pts.forEach((v, i) => ctx.lineTo(X(i), Y(v)));
    ctx.strokeStyle = pts[pts.length - 1] >= 0 ? '#5fd38a' : '#ff7a7a'; ctx.lineWidth = 2; ctx.stroke();
    // 末点
    const lx = X(pts.length - 1), ly = Y(pts[pts.length - 1]);
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(lx, ly, 3, 0, Math.PI * 2); ctx.fill();
  }

  function openPanel(kind) {
    const p = Store.get();
    const hands = p.handsPlayed || 0, wins = p.handsWon || 0;
    const rate = hands ? Math.round(wins / hands * 100) : 0;
    const titleMap = {
      profile: '玩家资料', missions: '每日任务', rank: '排行榜', mail: '邮件中心',
      club: '俱乐部', vault: '保险箱', support: '客服中心', notice: '系统公告',
      season: '皇家赛季', tourney: '锦标赛', vip: '贵宾中心', security: '牌局安全',
      events: '活动中心', gifts: '牌桌礼物', coach: '训练营', achievements: '成就殿堂',
      friends: '好友中心', analytics: '数据中心', settings: '系统设置',
      activityMap: '运营总览', passport: '皇家征程', mysteryShop: '秘宝商店',
      goldenPig: '金库钱罐', invite: '邀请礼', tableChat: '牌桌聊天',
      tableGift: '牌桌礼物', tableHistory: '牌局记录', jackpot: '皇家奖池',
      voiceCenter: '语音中心',
    };
    $('panel-title').textContent = titleMap[kind] || '详情';
    let html = '';
    if (kind === 'profile') {
      html = `<div class="panel-hero"><b>皇家玩家档案</b><span>当前档案保存在本机，包含金币、钻石、等级、牌局记录和已装备外观。</span></div>
        <div class="metric-grid">
          <div class="metric"><b>${fmtChips(p.coins)}</b><span>金币</span></div>
          <div class="metric"><b>${p.diamonds || 0}</b><span>钻石</span></div>
          <div class="metric"><b>${rate}%</b><span>胜率</span></div>
        </div>
        <div class="panel-list">
          ${panelRow('♠', '牌局履历', `已完成 ${hands} 手，获胜 ${wins} 手，最大底池 ${fmtChips(p.biggestPot || 0)}。`, '统计')}
          ${panelRow('👑', '当前外观', `${Skins.scenes[p.activeScene]?.name || 'VIP包厢'} · ${Skins.backs[p.activeBack]?.name || '皇室红'} · ${Skins.felts[p.activeFelt]?.name || '翡翠绒'}`, '已装备')}
          ${panelRow('📈', '成长等级', `Lv.${p.level || 1}，经验 ${p.xp || 0}/${Store.levelInfo().need}。`, '成长')}
        </div>`;
    } else if (kind === 'missions') {
      const tasks = Store.getTasks();
      html = `<div class="panel-hero"><b>今日任务</b><span>完成目标即可领取金币和钻石，每日 0 点刷新。</span></div>
        <div class="panel-list">` +
        tasks.map((t) => {
          const btn = t.claimed ? `<em>已领</em>`
            : t.done ? `<button class="pr-claim" data-claim-task="${t.id}">领取</button>`
              : `<em>${t.cur}/${t.goal}</em>`;
          return `<div class="panel-row"><div class="pr-ic">🎯</div>
            <div><b>${t.name}</b><div class="pr-text"><div class="progress-track"><i style="width:${pct(t.cur, t.goal)}%"></i></div>奖励 🪙${fmtChips(t.coins)} · 💎${t.diamonds}</div></div>${btn}</div>`;
        }).join('') + `</div>`;
    } else if (kind === 'vip') {
      const vip = vipInfo(p);
      html = `<div class="panel-hero"><b>VIP${vip.level} 贵宾中心</b><span>贵宾体系按牌局活跃成长，提供身份、返利、专属活动和牌桌展示。</span></div>
        <div class="metric-grid">
          <div class="metric"><b>VIP${vip.level}</b><span>当前等级</span></div>
          <div class="metric"><b>${vip.rebate}%</b><span>模拟返水</span></div>
          <div class="metric"><b>${p.winStreak || 0}</b><span>当前连胜</span></div>
        </div>
        <div class="panel-list">
          ${panelRow('👑', '贵宾进度', `<div>${vip.nextText}</div><div class="progress-track"><i style="width:${vip.progress}%"></i></div>`, '成长')}
          ${panelRow('💎', '专属权益', '头像框、称号、场景折扣、活动优先报名。', '权益')}
          ${panelRow('🎁', '每日礼金', `当前 VIP${vip.level} 可领取 ${fmtChips(20000 + vip.level * 15000)} 金币体验礼。`, '模拟')}
          ${panelRow('☎️', '专属客服', '高等级用户可进入专属服务通道。', vip.level >= 3 ? '开放' : '未开放')}
        </div>`;
    } else if (kind === 'security') {
      html = `<div class="panel-hero"><b>公平牌局中心</b><span>面向成熟产品的安全与风控入口，用于展示洗牌、断线、反作弊和牌局记录能力。</span></div>
        <div class="panel-list">
          ${panelRow('🔀', '洗牌机制', '本地模式每手重新生成牌堆并随机洗牌；联机模式建议改为服务端权威发牌。', '通过')}
          ${panelRow('🛡️', '反作弊策略', '限制客户端只提交操作，不提交结果；真人桌由服务端校验行动。', '规划')}
          ${panelRow('📜', '牌局回放', '可扩展为每手记录按钮、公共牌、下注线和赢家。', '待接入')}
          ${panelRow('🌐', '断线重连', '真人对战已有 token 重连基础，可继续加超时托管。', '基础')}
        </div>`;
    } else if (kind === 'rank') {
      const me = Math.max(6, 18 - Math.min(12, wins));
      html = `<div class="panel-hero"><b>财富榜 · 本周</b><span>展示完整排行榜体验，当前包含本机玩家和模拟榜单。</span></div>
        <div class="panel-list">
          <div class="panel-row rank-row"><div class="pr-ic">1</div><div><b>澳门金鲨</b><span>胜率 68% · 连胜 9</span></div><em>8.8亿</em></div>
          <div class="panel-row rank-row"><div class="pr-ic">2</div><div><b>拉斯维加斯王</b><span>胜率 63% · 连胜 6</span></div><em>6.2亿</em></div>
          <div class="panel-row rank-row"><div class="pr-ic">3</div><div><b>游艇先生</b><span>胜率 59% · 连胜 5</span></div><em>4.9亿</em></div>
          <div class="panel-row rank-row"><div class="pr-ic">${me}</div><div><b>皇家玩家</b><span>胜率 ${rate}% · 已玩 ${hands} 手</span></div><em>${fmtChips(p.coins)}</em></div>
        </div>`;
    } else if (kind === 'mail') {
      html = `<div class="panel-list">
        ${panelRow('🎁', '欢迎礼包', '感谢加入皇室德州，礼包码入口已放在大厅。', '未领取')}
        ${panelRow('📣', '赛季公告', '皇家赛季开放，完成每日任务可获得额外奖励。', '新')}
        ${panelRow('🛠️', '系统通知', '当前版本强化了大厅、商店、任务、排行榜与活动面板。', '已读')}
      </div>`;
    } else if (kind === 'events') {
      html = `<div class="panel-hero"><b>限时活动中心</b><span>原创活动体系，用于承载首胜、连胜、节日活动和回流奖励。</span></div>
        <div class="panel-list">
          ${panelRow('🔥', '首胜加奖', '每日第一手获胜额外奖励 5万金币。', wins > 0 ? '已达成' : '进行中')}
          ${panelRow('⚡', '三连胜挑战', `当前连胜 ${p.winStreak || 0}/3，完成后奖励 10 钻石。`, (p.winStreak || 0) >= 3 ? '可领' : '挑战')}
          ${panelRow('🎊', '周末豪客夜', '高额场、大师场结算经验提升 30%。', '周末')}
          ${panelRow('🔁', '回流礼遇', '连续 3 天未登录后回归可领取补给。', '运营')}
        </div>`;
    } else if (kind === 'gifts') {
      html = `<div class="panel-hero"><b>牌桌礼物</b><span>礼物体系增加社交氛围和付费承载点，当前先做产品入口和礼物目录。</span></div>
        <div class="panel-list">
          ${panelRow('🌹', '玫瑰', '轻量互动礼物，可在座位间飘动。', '5钻')}
          ${panelRow('🍾', '香槟', '胜利时触发喷洒动效。', '18钻')}
          ${panelRow('🚁', '空投', '全桌可见的高级礼物特效。', '66钻')}
          ${panelRow('👑', '加冕', '为赢家播放皇冠登场动画。', '99钻')}
        </div>`;
    } else if (kind === 'coach') {
      const coachOn = Store.get().coachMode;
      html = `<div class="panel-hero"><b>训练营</b><span>训练模式实时显示胜率/赔率/建议与起手牌范围；考试模式隐藏提示，检验你的真实水平。</span></div>
        <div class="panel-list">
          <div class="panel-row"><div class="pr-ic">${coachOn ? '🎓' : '📝'}</div>
            <div><b>${coachOn ? '训练模式（提示开启）' : '考试模式（提示隐藏）'}</b>
            <div class="pr-text">${coachOn ? '牌桌实时显示胜率、底池赔率、起手牌范围与行动建议。' : '不显示任何提示，复盘时再看对错分析。'}</div></div>
            <button class="pr-claim" data-toggle="coach">${coachOn ? '切到考试' : '切到训练'}</button></div>`;
      // 当前牌桌的对手画像
      if (currentScreen === 'table' && game && seatProfiles.length) {
        html += `<div class="panel-title-sm">本桌对手画像</div>`;
        game.players.forEach((pl) => {
          const pr = seatProfiles[pl.id]; if (!pr || pl.out) return;
          const si = STYLE_INFO[pr.style] || STYLE_INFO.tag;
          const aggr = pr.acts ? Math.round((pr.raises + pr.allins) / pr.acts * 100) : 0;
          html += `<div class="panel-row"><div class="pr-ic"><img class="prof-av" src="assets/av/${seatAvatars[pl.id] || 1}.png" onerror="this.style.display='none'"/></div>
            <div><b>${pl.name} <span class="style-tag" style="background:${si.color}">${si.label}·${si.tag}</span></b>
            <div class="pr-text">${si.desc}<br>本局观察：行动 ${pr.acts} · 激进度 ${aggr}% · 入池 ${pr.entered} · 弃牌 ${pr.folds}</div></div>
            <em>🪙${fmtChips(pl.chips)}</em></div>`;
        });
      } else {
        html += `<div class="panel-list">${panelRow('🦈', '对手画像', '进入牌桌后，这里实时显示每个对手的风格标签与本局打法统计。', '进桌可见')}</div>`;
      }
    } else if (kind === 'activityMap') {
      html = `<div class="panel-hero"><b>成熟运营骨架</b><span>按商业 App 的结构拆成成长、活动、社交、牌桌互动和安全五条线，先用轻量面板承载，后续可逐个接服务端。</span></div>
        <div class="panel-list">
          ${panelRow('🎖️', '成长线', '等级、VIP、赛季通行证、成就墙、称号和外观展示。', '已铺底')}
          ${panelRow('🎊', '活动线', '首胜、连胜、转盘、签到、秘宝商店、金猪钱罐。', '已铺底')}
          ${panelRow('🤝', '社交线', '好友、俱乐部、邀请、礼物、牌桌聊天。', '已铺底')}
          ${panelRow('🃏', '牌桌线', '牌谱、奖池、语音、礼物、数据中心和训练营。', '已铺底')}
          ${panelRow('🛡️', '安全线', '公平说明、回放、举报、断线重连、服务端权威发牌。', '路线')}
        </div>`;
    } else if (kind === 'passport') {
      html = renderSeasonTrack();
    } else if (kind === 'mysteryShop') {
      html = `<div class="panel-hero"><b>秘宝商店</b><span>用于承载周期折扣和外观轮换，做成皇室自己的轻奢货架。</span></div>
        <div class="panel-list">
          ${panelRow('🃏', '鎏金牌背', '限时 7 折，适合赛季奖励或钻石购买。', '今日')}
          ${panelRow('🟩', '翡翠桌布', '桌面皮肤轮换，保持牌桌新鲜感。', '热卖')}
          ${panelRow('🎩', '绅士头像框', '身份装饰，和 VIP、成就联动展示。', '稀有')}
          ${panelRow('⏱️', '刷新机制', '商业版可接每日刷新、库存、折扣和购买限制。', '体系')}
        </div>`;
    } else if (kind === 'goldenPig') {
      const saved = Math.min(500000, hands * 8000 + wins * 22000);
      html = `<div class="panel-hero"><b>金库钱罐</b><span>把日常活跃转成可见积累，形成“越玩越满”的反馈。</span></div>
        <div class="metric-grid">
          <div class="metric"><b>${fmtChips(saved)}</b><span>累计金币</span></div>
          <div class="metric"><b>${Math.min(100, Math.round(saved / 5000))}%</b><span>储蓄进度</span></div>
          <div class="metric"><b>${hands}</b><span>贡献牌局</span></div>
        </div>
        <div class="panel-list">
          ${panelRow('💰', '活跃储蓄', `<div>每手牌局和胜利会增加钱罐容量</div><div class="progress-track"><i style="width:${pct(saved,500000)}%"></i></div>`, '成长')}
          ${panelRow('💎', '开启奖励', '满额后可领取金币，商业版可叠加钻石开罐。', '预留')}
        </div>`;
    } else if (kind === 'invite') {
      html = `<div class="panel-hero"><b>邀请礼</b><span>邀请体系连接真人对战、好友和俱乐部，是成熟棋牌 App 的关键社交入口。</span></div>
        <div class="panel-list">
          ${panelRow('🔗', '入桌邀请', '生成真人对战房间链接，让朋友直接进入同一桌。', '联机')}
          ${panelRow('🎁', '首局奖励', '好友完成首局后，双方领取金币和钻石。', '奖励')}
          ${panelRow('🏛️', '俱乐部邀请', '邀请好友加入俱乐部，进入内部排行榜和活动。', '社交')}
          ${panelRow('🛡️', '反刷限制', '商业版需绑定设备、账号和风控规则。', '安全')}
        </div>`;
    } else if (kind === 'club') {
      html = `<div class="panel-hero"><b>皇家俱乐部</b><span>俱乐部用于承载好友房、成员排行榜、俱乐部基金和内部锦标赛。</span></div>
        <div class="panel-list">
          ${panelRow('🏛️', '皇室训练营', '当前成员 28/50，今日活跃 12 人。', '已加入')}
          ${panelRow('👥', '好友牌桌', '后续可把真人对战房间绑定到俱乐部。', '联机')}
          ${panelRow('🏆', '俱乐部赛', '每晚 20:00 开赛，按积分发奖。', '预告')}
        </div>`;
    } else if (kind === 'vault') {
      html = `<div class="panel-hero"><b>保险箱</b><span>把金币资产、钻石和贵宾权益集中展示，形成商业 App 的资产中心体验。</span></div>
        <div class="metric-grid">
          <div class="metric"><b>${fmtChips(p.coins)}</b><span>可用金币</span></div>
          <div class="metric"><b>${p.diamonds || 0}</b><span>钻石</span></div>
          <div class="metric"><b>VIP0</b><span>贵宾</span></div>
        </div>
        <div class="panel-list">
          ${panelRow('💼', '资产保护', '本地试玩模式下资产保存在浏览器档案。', '本机')}
          ${panelRow('💳', '充值中心', '商业版可接入 IAP、订单、风控和发货流水。', '接口')}
          ${panelRow('🔐', '服务端账户', '接入登录后可把资产迁移到云端账户。', '规划')}
        </div>`;
    } else if (kind === 'achievements') {
      const list = Store.getAchievements();
      const got = list.filter((a) => a.unlocked).length;
      html = `<div class="panel-hero"><b>成就殿堂</b><span>达成里程碑领取奖励，记录你的高手之路。</span></div>
        <div class="metric-grid">
          <div class="metric"><b>${got}/${list.length}</b><span>已解锁</span></div>
          <div class="metric"><b>${list.filter((a) => a.unlocked && !a.claimed).length}</b><span>可领取</span></div>
          <div class="metric"><b>${list.filter((a) => a.claimed).length}</b><span>已领奖</span></div>
        </div>
        <div class="achv-wall">` +
        list.map((a) => {
          const cls = a.claimed ? 'achv-claimed' : a.unlocked ? 'achv-unlocked' : 'achv-locked';
          const ic = a.claimed ? '🏅' : a.unlocked ? '🎖️' : '🔒';
          const btn = a.claimed ? `<em class="rc-ok">已领</em>`
            : a.unlocked ? `<button class="pr-claim" data-claim-achv="${a.id}">领取</button>`
              : `<em class="rc-sub">未达成</em>`;
          return `<div class="achv-cell ${cls}"><div class="achv-ic">${ic}</div><b>${a.name}</b>
            <span>${a.desc}</span><div class="achv-rw">🪙${fmtChips(a.coins)} · 💎${a.diamonds}</div>${btn}</div>`;
        }).join('') + `</div>`;
    } else if (kind === 'friends') {
      html = `<div class="panel-hero"><b>好友中心</b><span>好友体系为真人桌、邀请、俱乐部和礼物互动做准备。</span></div>
        <div class="panel-list">
          ${panelRow('🤝', '最近牌友', '小敏、财神、黑桃J、老李。', '模拟')}
          ${panelRow('📨', '邀请入桌', '生成真人对战链接或二维码，邀请同一网络/Tailnet 的朋友。', '联机')}
          ${panelRow('🎁', '好友礼物', '每日互赠金币，形成轻社交循环。', '规划')}
          ${panelRow('🚫', '黑名单', '商业版需要屏蔽、举报和禁言能力。', '安全')}
        </div>`;
    } else if (kind === 'analytics') {
      const foldRate = window.OppModel.betsFaced ? Math.round(window.OppModel.folds / window.OppModel.betsFaced * 100) : 0;
      const log = Store.getHandLog();
      let dN = 0, dG = 0, netSum = 0;
      log.forEach((h) => { netSum += (h.net || 0); (h.decisions || []).forEach((d) => { if (d.good === true || d.good === false) { dN++; if (d.good) dG++; } }); });
      const acc = dN ? Math.round(dG / dN * 100) : 0;
      const netCls = netSum > 0 ? 'pr-net-up' : netSum < 0 ? 'pr-net-down' : '';
      html = `<div class="panel-hero"><b>数据中心</b><span>把玩家表现转成可读数据，形成高端牌手工具感。点"牌局复盘"逐手回看你的决策对错。</span></div>
        <div class="metric-grid">
          <div class="metric"><b>${rate}%</b><span>胜率</span></div>
          <div class="metric"><b>${acc}%</b><span>决策正确率</span></div>
          <div class="metric"><b class="${netCls}">${netSum >= 0 ? '+' : ''}${fmtChips(netSum)}</b><span>近${log.length}手净收益</span></div>
        </div>
        ${log.length >= 2 ? `<div class="curve-wrap"><div class="curve-title">盈利曲线（近 ${log.length} 手累计净收益）</div><canvas id="profit-curve" width="300" height="110"></canvas></div>` : ''}
        <div class="panel-list">
          <div class="panel-row rc-row" data-open-history="1"><div class="pr-ic">🔍</div><div><b>牌局复盘</b><div class="pr-text">逐手回看公共牌、你的决策与对手摊牌，附胜率/赔率对错判定。</div></div><em>${log.length} 手</em></div>
          ${panelRow('📊', '牌风画像', `样本 ${window.OppModel.acts || 0} 次，激进度 ${Math.round((window.OppModel.exploit().aggr || 0) * 100)}%。`, '模型')}
          ${panelRow('🧠', 'AI 读牌', '高手场会根据你的弃牌率和激进度调整策略。', '已接入')}
          ${panelRow('📉', '面对下注弃牌', `你面对下注的弃牌率约 ${foldRate}%，过高会被对手频繁施压。`, '诊断')}
        </div>`;
    } else if (kind === 'support') {
      html = `<div class="panel-list">
        ${panelRow('🎧', '在线客服', '处理安装、联机、账号、奖励发放等问题。', '模拟')}
        ${panelRow('📘', '规则说明', '德州扑克采用标准 Hold’em 规则，支持单挑、六人桌、九人桌。', '帮助')}
        ${panelRow('🛠️', '问题反馈', '崩溃上报和日志系统接入后可自动定位问题。', '待接入')}
        ${panelRow('⚖️', '公平申诉', '可对异常牌局提交牌局编号和回放。', '规划')}
      </div>`;
    } else if (kind === 'settings') {
      const muted = Store.get().muted, coachOn = Store.get().coachMode;
      html = `<div class="panel-hero"><b>系统设置</b><span>成熟 App 需要把音效、训练、隐私、网络集中到设置中心。</span></div>
        <div class="panel-list">
          <div class="panel-row"><div class="pr-ic">${muted ? '🔇' : '🔊'}</div><div><b>声音</b><div class="pr-text">音效与语音 ${muted ? '已关闭' : '已开启'}。</div></div><button class="pr-claim" data-toggle="sound">${muted ? '开启' : '关闭'}</button></div>
          <div class="panel-row"><div class="pr-ic">${coachOn ? '🎓' : '📝'}</div><div><b>训练提示</b><div class="pr-text">${coachOn ? '牌桌实时显示胜率/赔率/建议。' : '考试模式：隐藏所有提示。'}</div></div><button class="pr-claim" data-toggle="coach">${coachOn ? '关闭' : '开启'}</button></div>
          ${panelRow('🌐', '联机服务器', '真人对战默认连接本地 Tailscale 节点。', '当前')}
          ${panelRow('🔒', '隐私说明', '本地训练版不接相机、定位、IDFA、麦克风，不采集上报。', '合规')}
        </div>`;
    } else if (kind === 'tableChat') {
      const inTable = currentScreen === 'table' && game;
      html = `<div class="panel-hero"><b>牌桌聊天</b><span>${inTable ? '点一句话，座位上方会冒出气泡，对手也会回应你。' : '进入牌桌后即可使用快捷语，向对手喊话。'}</span></div>`;
      (Social.PHRASES || []).forEach((g) => {
        html += `<div class="say-group"><div class="say-cat">${g.cat}</div><div class="say-wrap">` +
          g.items.map((t) => `<button class="say-chip" data-say="${t}"${inTable ? '' : ' disabled'}>${t}</button>`).join('') +
          `</div></div>`;
      });
    } else if (kind === 'tableGift') {
      const inTable = currentScreen === 'table' && game;
      html = `<div class="panel-hero"><b>牌桌礼物</b><span>${inTable ? '送给对手一份礼物，看它飞过牌桌命中爆开。免费礼物不花筹码。' : '进入牌桌后可向对手赠送互动礼物。'}</span><em>🪙 ${fmtChips(Store.get().coins)}</em></div>
        <div class="gift-grid">` +
        (Social.GIFTS || []).map((gf) => `<button class="gift-card" data-gift="${gf.id}"${inTable ? '' : ' disabled'}>
          <span class="gift-ic">${gf.icon}</span><b>${gf.name}</b><em>${gf.cost ? '🪙' + fmtChips(gf.cost) : '免费'}</em></button>`).join('') +
        `</div>`;
    } else if (kind === 'tableHistory') {
      html = renderHandLogList();
    } else if (kind === 'jackpot') {
      const jackpot = 880000 + hands * 12000 + wins * 46000;
      html = `<div class="panel-hero"><b>皇家奖池</b><span>奖池入口增加高额目标感，先做展示与规则，后续可接真实计奖。</span></div>
        <div class="metric-grid">
          <div class="metric"><b>${fmtChips(jackpot)}</b><span>当前奖池</span></div>
          <div class="metric"><b>皇家同花顺</b><span>大奖牌型</span></div>
          <div class="metric"><b>1%</b><span>模拟注入</span></div>
        </div>
        <div class="panel-list">
          ${panelRow('💰', '奖池规则', '指定牌型或活动桌触发奖励，按牌桌盲注区间分级。', '规则')}
          ${panelRow('🎖️', '小奖触发', '四条、同花顺可触发小奖展示。', '预留')}
          ${panelRow('🛡️', '结算要求', '真实奖池必须由服务端结算，客户端只展示结果。', '安全')}
        </div>`;
    } else if (kind === 'voiceCenter') {
      html = `<div class="panel-hero"><b>语音中心</b><span>当前版本不请求麦克风权限，先保留语音入口和快捷语音结构；商业版再按合规流程接入。</span></div>
        <div class="panel-list">
          ${panelRow('🎙️', '快捷语音', '全下、跟注、漂亮、别跑、再来。', '目录')}
          ${panelRow('🔇', '隐私默认', '未接麦克风权限，不采集用户语音。', '合规')}
          ${panelRow('🧩', '接入路线', '真人桌可接语音房间、静音、举报、变声和音量控制。', '路线')}
        </div>`;
    } else if (kind === 'notice') {
      html = `<div class="panel-list">
        ${panelRow('✨', '大厅焕新', '新增玩家档案、活动横幅、任务、邮件、排行和俱乐部入口。', '今日')}
        ${panelRow('🎮', '玩法保留', '经典牌桌、真人对战、签到、转盘、商店和礼包码均保留。', '稳定')}
        ${panelRow('📦', '资源建议', '后续可继续补更多角色立绘、礼物动画、赛季通行证素材。', '建议')}
        ${panelRow('🛡️', '安全路线', '服务端权威牌局、回放、举报、封禁是下一阶段重点。', '路线')}
      </div>`;
    } else if (kind === 'season') {
      html = renderSeasonTrack();
    } else if (kind === 'tourney') {
      html = `<div class="panel-hero"><b>锦标赛大厅</b><span>这里用于模拟商业 App 的赛事入口；真正开赛需要服务端报名、桌位调度和结算。</span></div>
        <div class="panel-list">
          ${panelRow('🌙', '午夜快速赛', '6人桌 · 10分钟一轮 · 奖池 50万金币。', '20:00')}
          ${panelRow('👑', '皇家大师赛', '9人桌 · 积分制 · 奖励限定称号。', '周赛')}
          ${panelRow('⚔️', '单挑王', 'Heads-up 淘汰赛，适合练习压迫打法。', '报名')}
        </div>`;
    }
    $('panel-body').innerHTML = html;
    openModal('modal-panel');
    if (kind === 'analytics') drawProfitCurve();
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
  let currentScreen = 'home';
  function showScreen(name) {
    currentScreen = name;
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
    // 对手画像：记录每个 AI 的风格 + 本局观察统计(入池/加注/弃牌/全下)
    seatProfiles = game.players.map((pl) => pl.isHuman ? null : {
      style: (pl.ai && pl.ai.style) || 'tag', acts: 0, raises: 0, calls: 0, folds: 0, allins: 0, entered: 0, hands: 0,
    });
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

    // 大厅功能入口
    document.querySelectorAll('[data-panel]').forEach((el) => el.addEventListener('click', () => openPanel(el.dataset.panel)));
    // 面板内领取(任务/成就)
    $('panel-body').addEventListener('click', (e) => {
      const tk = e.target.closest('[data-claim-task]'), ac = e.target.closest('[data-claim-achv]');
      const row = e.target.closest('[data-hand]'), back = e.target.closest('[data-hand-back]'), clr = e.target.closest('[data-hand-clear]'), oh = e.target.closest('[data-open-history]');
      const sc = e.target.closest('[data-claim-season]'), sca = e.target.closest('[data-claim-season-all]');
      if (sc) { const r = Store.claimSeason(sc.dataset.claimSeason); if (r) { Sfx.reward(); toast(`赛季奖励 🪙+${fmtChips(r.coins)}${r.diamonds ? ' 💎+' + r.diamonds : ''}`); syncWallet(true); syncHome(); $('panel-body').innerHTML = renderSeasonTrack(); } return; }
      if (sca) { const r = Store.claimSeasonAll(); if (r) { Sfx.reward(); toast(`领取 ${r.n} 级 🪙+${fmtChips(r.coins)}${r.diamonds ? ' 💎+' + r.diamonds : ''}`); syncWallet(true); syncHome(); $('panel-body').innerHTML = renderSeasonTrack(); } return; }
      if (tk) { const r = Store.claimTask(tk.dataset.claimTask); if (r) { Sfx.reward(); toast(`领取成功 🪙+${fmtChips(r.coins)} 💎+${r.diamonds}`); syncWallet(true); syncHome(); openPanel('missions'); } }
      else if (ac) { const r = Store.claimAchv(ac.dataset.claimAchv); if (r) { Sfx.reward(); toast(`成就奖励 🪙+${fmtChips(r.coins)} 💎+${r.diamonds}`); syncWallet(true); openPanel('achievements'); } }
      else if (clr) { Store.clearHandLog(); $('panel-body').innerHTML = renderHandLogList(); try { Sfx.button(); } catch (_) {} }
      else if (back) { $('panel-body').innerHTML = renderHandLogList(); try { Sfx.button(); } catch (_) {} }
      else if (oh) { openPanel('tableHistory'); }
      else if (row) { $('panel-body').innerHTML = renderHandDetail(parseInt(row.dataset.hand, 10)); try { Sfx.button(); } catch (_) {} }
      else { const say = e.target.closest('[data-say]'), gift = e.target.closest('[data-gift]'), tg = e.target.closest('[data-toggle]');
        if (say && !say.disabled) { closeModal(); sayPhrase(say.dataset.say); }
        else if (gift && !gift.disabled) { sendGift(gift.dataset.gift); }
        else if (tg) {
          const which = tg.dataset.toggle, src = $('panel-title').textContent === '训练营' ? 'coach' : 'settings';
          if (which === 'coach') { const on = Store.toggleCoach(); toast(on ? '已切到训练模式' : '已切到考试模式'); if (game) render(); }
          else if (which === 'sound') { const m = !Store.get().muted; Store.get().muted = m; Store.save(); Sfx.setMuted(m); if (window.Voice) Voice.setMuted(m); $('sound-icon') && ($('sound-icon').textContent = m ? '🔇' : '🔊'); }
          try { Sfx.button(); } catch (_) {}
          openPanel(src);
        }
      }
    });
    $('home-task-checkin').addEventListener('click', () => openModal('modal-checkin'));
    $('home-task-wheel').addEventListener('click', () => openModal('modal-wheel'));
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
