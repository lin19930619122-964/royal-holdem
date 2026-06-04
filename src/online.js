/* 真人对战客户端 —— 连接 WS，渲染服务器权威状态，发送行动。 */
(function () {
  const P = window.Poker, Sfx = window.Sfx, Fx = window.Fx, Skins = window.Skins;
  const $ = (id) => document.getElementById(id);
  const SEAT_POS = [
    { x: 50, y: 90 }, { x: 11, y: 60 }, { x: 18, y: 22 },
    { x: 50, y: 10 }, { x: 82, y: 22 }, { x: 89, y: 60 },
  ];
  const PHASE_LABEL = { flop: '翻 牌', turn: '转 牌', river: '河 牌', ended: '摊 牌' };
  const TOKEN_KEY = 'royal_mp_token';

  const seatsEl = $('seats'), boardEl = $('board'), dealerBtn = $('dealer-button');
  const fxLayer = $('fx-layer'), potEl = $('pot-display');
  const seatEls = [], betEls = [], seatSig = [], prevBet = [];
  let boardCount = -1, lastResultHand = -1, raiseMode = false;
  let ws = null, state = null, mySeat = -1, deadlineTimer = null;
  let myName = '玩家', spectating = false, chatPopulated = false;

  function buildSeats() {
    seatsEl.innerHTML = '';
    for (let i = 0; i < 6; i++) {
      const pos = SEAT_POS[i];
      const seat = document.createElement('div');
      seat.className = 'seat';
      seat.style.left = pos.x + '%'; seat.style.top = pos.y + '%';
      seat.innerHTML = `
        <div class="winner-badge hidden"></div>
        <div class="last-action"></div>
        <div class="player-cards"></div>
        <div class="player-box"><div class="avatar"><img class="av-img" src="assets/av/${i + 1}.png" onerror="this.style.display='none'"/><span class="av-emoji"></span></div>
          <div class="pinfo"><span class="pname"></span><span class="pchips"></span></div></div>`;
      seatsEl.appendChild(seat); seatEls.push(seat); seatSig.push(''); prevBet.push(0);
      const bx = pos.x + (50 - pos.x) * 0.34, by = pos.y + (50 - pos.y) * 0.34;
      const bet = document.createElement('div');
      bet.className = 'bet-tag hidden';
      bet.style.cssText = `position:absolute;left:${bx}%;top:${by}%;transform:translate(-50%,-50%)`;
      seatsEl.appendChild(bet); betEls.push(bet);
    }
  }
  function cardFaceHTML(c, small) {
    const red = P.isRed(c) ? ' red' : '';
    const r = P.RANK_LABEL[c.rank], s = P.SUIT_SYMBOL[c.suit];
    if (small) return `<div class="card small${red}"><span class="cmini"><b>${r}</b><i>${s}</i></span></div>`;
    return `<div class="card${red}"><span class="ci tl">${r}<i>${s}</i></span><span class="pip">${s}</span><span class="ci br">${r}<i>${s}</i></span></div>`;
  }
  const cardBackHTML = (s) => `<div class="card back${s ? ' small' : ''}"></div>`;

  function render() {
    if (!state) return;
    mySeat = state.youSeat;
    $('seatInfo').textContent = state.youSpectator ? `👁旁观 · ${state.seatedCount}人` : `座位 ${mySeat >= 0 ? mySeat + 1 : '-'}/6 · ${state.seatedCount}人`;
    $('blindInfo').textContent = `${state.smallBlind}/${state.bigBlind}`;
    $('pot-amount').textContent = (state.pot || 0).toLocaleString();

    if (state.board.length !== boardCount) {
      const grew = state.board.length > boardCount && boardCount >= 0;
      boardEl.innerHTML = state.board.map((c) => cardFaceHTML(c, false)).join('');
      boardCount = state.board.length;
      if (grew) Sfx.deal();
    }
    const banner = $('phase-banner');
    if (PHASE_LABEL[state.phase] && state.board.length) { banner.textContent = PHASE_LABEL[state.phase]; banner.style.opacity = '0.9'; }
    else banner.style.opacity = '0';

    for (let i = 0; i < 6; i++) {
      const s = state.seats[i], el = seatEls[i];
      const empty = s.kind === 'empty';
      el.querySelector('.av-emoji').textContent = empty ? '➕' : s.avatar;
      const pname = el.querySelector('.pname');
      pname.textContent = empty ? '空位' : s.name + (s.kind === 'bot' ? '🤖' : (s.connected ? '' : '📴'));
      pname.classList.toggle('is-human', i === mySeat);
      el.querySelector('.pchips').textContent = empty ? '—' : s.chips.toLocaleString();
      el.classList.toggle('folded', s.folded && !empty);
      el.classList.toggle('active', state.current === i && state.bettingOpen);
      el.style.opacity = empty ? '0.5' : '1';

      const la = el.querySelector('.last-action');
      la.textContent = s.lastAction || '';
      la.className = 'last-action';
      if (s.lastAction === '弃牌') la.classList.add('fold');
      else if (['加注', '下注', '全下'].includes(s.lastAction)) la.classList.add('raise');

      if (s.bet > prevBet[i]) Fx.flyChip(el, potEl, fxLayer, { count: 1 });
      prevBet[i] = s.bet;
      const betEl = betEls[i];
      if (s.bet > 0 && !empty) { betEl.classList.remove('hidden'); betEl.innerHTML = `<span class="chip-dot"></span>${s.bet.toLocaleString()}`; }
      else betEl.classList.add('hidden');

      const revealed = !!s.hole;
      const sig = (revealed && s.hole ? 'F' + s.hole.map((c) => c.rank + c.suit).join('') : 'B' + s.holeCount) + (empty ? 'e' : '');
      if (sig !== seatSig[i]) {
        const cardsEl = el.querySelector('.player-cards');
        if (empty || s.holeCount === 0) cardsEl.innerHTML = '';
        else if (revealed) cardsEl.innerHTML = s.hole.map((c) => cardFaceHTML(c, true)).join('');
        else cardsEl.innerHTML = Array.from({ length: s.holeCount }, () => cardBackHTML(true)).join('');
        seatSig[i] = sig;
      }
      const badge = el.querySelector('.winner-badge');
      if (state.result && s.winThisHand > 0) { badge.classList.remove('hidden'); badge.textContent = `+${s.winThisHand.toLocaleString()}`; }
      else badge.classList.add('hidden');
    }

    if (state.button >= 0 && state.phase !== 'idle' && state.seats[state.button].kind !== 'empty') {
      const pos = SEAT_POS[state.button];
      dealerBtn.classList.remove('hidden');
      dealerBtn.style.left = (pos.x + (50 - pos.x) * 0.26) + '%';
      dealerBtn.style.top = (pos.y + (50 - pos.y) * 0.24) + '%';
    } else dealerBtn.classList.add('hidden');

    // 摊牌特效（每手一次）
    if (state.phase === 'ended' && state.result && lastResultHand !== state.handNo) {
      lastResultHand = state.handNo;
      let won = false;
      for (let i = 0; i < 6; i++) if (state.seats[i].winThisHand > 0) {
        Fx.flyChip(potEl, seatEls[i], fxLayer, { count: 3 });
        Fx.floatText(seatEls[i], `+${state.seats[i].winThisHand.toLocaleString()}`, fxLayer);
        Fx.pulseWin(seatEls[i]);
        if (i === mySeat) won = true;
      }
      if (won) { Sfx.win(); Fx.vibrate(60); } else Sfx.lose();
    }

    updateControls();
    updateMessage();
    updateTimer();
  }

  function updateMessage() {
    const msg = $('message-bar');
    if (state.youSpectator) { msg.textContent = state.running ? '👁 旁观中…（可聊天）' : '👁 旁观中 · 等待开局'; return; }
    if (state.phase === 'idle' || !state.running) {
      msg.textContent = state.seatedCount < 2 ? '等待玩家加入…（可加机器人）' : (state.hostSeat === mySeat ? '可以开始了' : '等待房主开始');
      return;
    }
    if (state.phase === 'ended') { msg.textContent = state.result ? state.result.summary : '本手结束'; return; }
    if (!state.bettingOpen) { msg.textContent = '发牌中…'; return; }
    if (state.yourTurn) { msg.textContent = '轮到你行动'; return; }
    const cur = state.seats[state.current];
    msg.textContent = cur ? `等待 ${cur.name} 行动…` : '…';
  }

  function updateControls() {
    if (state.youSpectator) { $('host-area').classList.add('hidden'); $('action-area').classList.add('hidden'); return; }
    // 房主控制
    const host = state.hostSeat === mySeat && !state.running && state.seatedCount >= 1;
    $('host-area').classList.toggle('hidden', !host);
    if (host) $('btn-startmp').disabled = state.seatedCount < 2;
    // 行动按钮
    if (state.yourTurn && state.options) {
      $('action-area').classList.remove('hidden');
      if (!raiseMode) showActionButtons(state.options);
    } else {
      $('action-area').classList.add('hidden');
      raiseMode = false;
    }
  }

  function showActionButtons(o) {
    exitRaiseMode();
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

  function updateTimer() {
    const wrap = $('timer-wrap'), bar = $('timer-bar');
    if (deadlineTimer) { clearInterval(deadlineTimer); deadlineTimer = null; }
    if (state.deadline && state.bettingOpen) {
      const total = 20000;
      const tickBar = () => {
        const left = state.deadline - Date.now();
        if (left <= 0) { bar.style.width = '0%'; wrap.style.display = 'none'; clearInterval(deadlineTimer); return; }
        bar.style.width = Math.max(0, Math.min(100, (left / total) * 100)) + '%';
      };
      wrap.style.display = 'block'; tickBar();
      deadlineTimer = setInterval(tickBar, 250);
    } else wrap.style.display = 'none';
  }

  /* ---- 行动发送 ---- */
  function send(obj) { if (ws && ws.readyState === 1) ws.send(JSON.stringify(obj)); }
  function act(action, amount) { Sfx.button(); send({ type: 'action', action, amount }); raiseMode = false; }

  function enterRaiseMode() {
    raiseMode = true; Sfx.button();
    const o = state.options;
    $('raise-controls').classList.remove('hidden');
    const sl = $('raise-slider');
    sl.min = o.minRaiseTo; sl.max = o.maxRaiseTo; sl.step = Math.max(1, state.bigBlind / 2); sl.value = o.minRaiseTo;
    $('raise-value').textContent = o.minRaiseTo.toLocaleString();
    ['btn-fold', 'btn-check', 'btn-call', 'btn-raise'].forEach((id) => $(id).classList.add('hidden'));
    $('btn-confirm-raise').classList.remove('hidden');
    $('btn-cancel-raise').classList.remove('hidden');
  }
  function exitRaiseMode() {
    $('raise-controls').classList.add('hidden');
    $('btn-confirm-raise').classList.add('hidden');
    $('btn-cancel-raise').classList.add('hidden');
  }
  const roundToBB = (v) => Math.round(v / state.bigBlind) * state.bigBlind;

  /* ---- 大厅 / 社交 ---- */
  function renderLobby(rooms) {
    const box = $('lobby-list'); if (!box) return;
    box.innerHTML = (rooms || []).map((r) =>
      `<div class="room-card2"><div class="rinfo"><div class="rname">${r.name}</div>
        <div class="rdesc">盲注 ${r.blinds} · ${r.seated}人在座 · ${r.bots}机器人 · 👁${r.spectators}${r.running ? ' · 进行中' : ''}</div></div>
        <button class="r-sit" data-room="${r.id}" ${r.full ? 'disabled' : ''}>${r.full ? '满' : '入座'}</button>
        <button class="r-spec" data-room="${r.id}" data-spec="1">旁观</button></div>`).join('');
  }
  function appendChat(ev) {
    const log = $('chat-log'); if (!log) return;
    const div = document.createElement('div');
    if (ev.sys) div.innerHTML = `<span class="ci-sys">${ev.text}</span>`;
    else div.innerHTML = `<span class="ci-seat">${ev.name || ('座位' + ((ev.seat | 0) + 1))}</span>：${escapeHtml(ev.text)}`;
    log.appendChild(div);
    while (log.children.length > 30) log.removeChild(log.firstChild);
    log.scrollTop = log.scrollHeight;
  }
  function renderChat(list) { const log = $('chat-log'); if (log) { log.innerHTML = ''; (list || []).forEach(appendChat); } }
  function escapeHtml(s) { return String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c])); }
  function flyEmote(seat, txt) {
    if (seat == null || seat < 0 || !seatEls[seat]) return;
    const r = seatEls[seat].getBoundingClientRect(), c = fxLayer.getBoundingClientRect();
    const el = document.createElement('div'); el.className = 'emote-fly'; el.textContent = txt;
    el.style.left = (r.left + r.width / 2 - c.left) + 'px'; el.style.top = (r.top + r.height / 2 - c.top) + 'px';
    fxLayer.appendChild(el); setTimeout(() => el.remove(), 1600);
  }

  /* ---- 连接 ---- */
  function connect(name) {
    // 原生壳/独立部署可用 window.RH_SERVER 指定服务器(如 'm5.tail5255b4.ts.net')；网页版默认连当前主机
    const url = window.RH_SERVER
      ? `wss://${window.RH_SERVER}/ws`
      : `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`;
    ws = new WebSocket(url);
    ws.onopen = () => { $('conn-state').textContent = '已连接'; $('conn-state').className = 'ok'; send({ type: 'lobby' }); };
    ws.onmessage = (e) => {
      const m = JSON.parse(e.data);
      if (m.type === 'lobby') { renderLobby(m.rooms); }
      else if (m.type === 'joined') { localStorage.setItem(TOKEN_KEY, m.token); spectating = false; chatPopulated = false; $('join-overlay').classList.add('hidden'); }
      else if (m.type === 'spectating') { spectating = true; chatPopulated = false; $('join-overlay').classList.add('hidden'); }
      else if (m.type === 'state') { state = m; if (!chatPopulated && m.chat) { renderChat(m.chat); chatPopulated = true; } render(); }
      else if (m.type === 'chat') { appendChat(m); }
      else if (m.type === 'sys') { appendChat({ sys: true, text: m.text }); }
      else if (m.type === 'emote') { flyEmote(m.seat, m.emoji); }
      else if (m.type === 'gift') { flyEmote(m.toSeat, m.gift); }
    };
    ws.onclose = () => {
      $('conn-state').textContent = '已断开，重连中…'; $('conn-state').className = 'bad';
      setTimeout(() => connect(name), 1500);
    };
    ws.onerror = () => {};
  }

  /* ---- 事件 ---- */
  function setup() {
    $('join-go').addEventListener('click', () => {
      myName = ($('join-name').value || '玩家').trim().slice(0, 8) || '玩家';
      Sfx.resume();
      $('join-name').parentNode && ($('join-go').textContent = '选择下方房间 ↓');
      if (!ws || ws.readyState > 1) connect(myName); else send({ type: 'lobby' });
    });
    $('join-name').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('join-go').click(); });
    // 大厅房间选择：入座 / 旁观
    $('lobby-list').addEventListener('click', (e) => {
      const b = e.target.closest('[data-room]'); if (!b || b.disabled) return;
      Sfx.button();
      send({ type: 'join', room: b.dataset.room, name: myName, token: localStorage.getItem(TOKEN_KEY) || null, spectate: !!b.dataset.spec });
    });
    // 返回大厅
    $('btn-lobby').addEventListener('click', () => { Sfx.button(); send({ type: 'leave' }); state = null; chatPopulated = false; $('join-overlay').classList.remove('hidden'); $('join-go').textContent = '刷新房间'; });
    // 聊天 / 表情 / 举报
    $('chat-send').addEventListener('click', () => { const v = $('chat-input').value.trim(); if (v) { send({ type: 'chat', text: v }); $('chat-input').value = ''; } });
    $('chat-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('chat-send').click(); });
    document.querySelectorAll('.emo').forEach((b) => b.addEventListener('click', () => { Sfx.button(); send({ type: 'emote', emoji: b.dataset.emo }); }));
    $('btn-report').addEventListener('click', () => {
      const pick = $('report-pick');
      if (pick.style.display === 'flex') { pick.style.display = 'none'; return; }
      const opps = (state ? state.seats : []).filter((s) => s.kind === 'human' && s.seat !== mySeat);
      pick.innerHTML = opps.length ? opps.map((s) => `<button data-rep="${s.seat}">举报 ${s.name}</button>`).join('') : '<span class="ci-sys" style="font-size:12px">暂无可举报的真人玩家</span>';
      pick.style.display = 'flex';
    });
    $('report-pick').addEventListener('click', (e) => {
      const b = e.target.closest('[data-rep]'); if (!b) return;
      send({ type: 'report', seat: +b.dataset.rep, reason: '不当行为' });
      $('report-pick').style.display = 'none';
    });

    $('btn-addbot').addEventListener('click', () => { Sfx.button(); send({ type: 'addBot' }); });
    $('btn-startmp').addEventListener('click', () => { Sfx.button(); send({ type: 'start' }); });

    $('btn-fold').addEventListener('click', () => act('fold'));
    $('btn-check').addEventListener('click', () => act('check'));
    $('btn-call').addEventListener('click', () => act('call'));
    $('btn-raise').addEventListener('click', enterRaiseMode);
    $('btn-cancel-raise').addEventListener('click', () => { raiseMode = false; showActionButtons(state.options); });
    $('btn-confirm-raise').addEventListener('click', () => { act('raise', parseInt($('raise-slider').value, 10)); });
    const sl = $('raise-slider');
    sl.addEventListener('input', () => { $('raise-value').textContent = (+sl.value).toLocaleString(); });
    document.querySelectorAll('.quick').forEach((b) => b.addEventListener('click', () => {
      const o = state.options; if (!o) return;
      const q = b.dataset.q; let t;
      if (q === 'min') t = o.minRaiseTo;
      else if (q === 'half') t = roundToBB(o.currentBet + o.pot * 0.5);
      else if (q === 'pot') t = roundToBB(o.currentBet + o.pot);
      else t = o.maxRaiseTo;
      t = Math.max(o.minRaiseTo, Math.min(t, o.maxRaiseTo));
      sl.value = t; $('raise-value').textContent = t.toLocaleString();
    }));
    document.addEventListener('pointerdown', () => { Sfx.resume(); if (window.Music && !Sfx.isMuted()) Music.start(); }, { once: true });
  }

  Skins.apply();
  Sfx.setMuted(window.Store ? window.Store.get().muted : false);
  buildSeats();
  setup();
})();
