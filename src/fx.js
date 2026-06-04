/* 视觉特效 —— 筹码飞行、卡牌翻转、赢家光效、震动。纯 DOM/CSS，原创。 */
(function () {
  function centerOf(el, container) {
    const r = el.getBoundingClientRect();
    const c = container.getBoundingClientRect();
    return { x: r.left + r.width / 2 - c.left, y: r.top + r.height / 2 - c.top };
  }

  function flyChip(fromEl, toEl, layer, opts) {
    if (!fromEl || !toEl || !layer) return;
    const from = centerOf(fromEl, layer);
    const to = centerOf(toEl, layer);
    const n = (opts && opts.count) || 1;
    for (let i = 0; i < n; i++) {
      const chip = document.createElement('div');
      chip.className = 'fly-chip';
      chip.style.left = from.x + 'px';
      chip.style.top = from.y + 'px';
      layer.appendChild(chip);
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      const delay = i * 60;
      // 强制 reflow 后启动过渡
      chip.getBoundingClientRect();
      setTimeout(() => {
        chip.style.transform = `translate(${dx}px, ${dy}px) scale(0.7)`;
        chip.style.opacity = '0.9';
      }, delay + 10);
      setTimeout(() => { chip.remove(); }, delay + 480);
    }
  }

  function pulseWin(seatEl) {
    if (!seatEl) return;
    seatEl.classList.add('win-glow');
    setTimeout(() => seatEl.classList.remove('win-glow'), 2600);
  }

  function floatText(targetEl, text, layer, cls) {
    if (!targetEl || !layer) return;
    const p = centerOf(targetEl, layer);
    const el = document.createElement('div');
    el.className = 'float-text ' + (cls || '');
    el.textContent = text;
    el.style.left = p.x + 'px';
    el.style.top = p.y + 'px';
    layer.appendChild(el);
    setTimeout(() => el.remove(), 1400);
  }

  function vibrate(ms) {
    if (navigator.vibrate) { try { navigator.vibrate(ms); } catch (e) {} }
  }

  // 金币雨：在目标处洒落一串金币
  function coinBurst(targetEl, layer, count) {
    if (!targetEl || !layer) return;
    const p = centerOf(targetEl, layer);
    count = count || 10;
    for (let i = 0; i < count; i++) {
      const c = document.createElement('div');
      c.className = 'coin-burst';
      c.style.left = (p.x + (i - count / 2) * 7) + 'px';
      c.style.top = (p.y - 14) + 'px';
      c.style.animation = `coinFall ${0.7 + (i % 4) * 0.12}s ease ${i * 0.04}s forwards`;
      layer.appendChild(c);
      setTimeout(() => c.remove(), 1300 + i * 40);
    }
  }

  // 牌型特效：tier 1(高牌)..9(皇家同花顺)，越大越炫
  function handCelebration(layer, tier, label) {
    if (!layer) return;
    const b = document.createElement('div');
    b.className = 'hand-cele tier' + Math.min(9, tier);
    b.textContent = label;
    layer.appendChild(b);
    setTimeout(() => b.remove(), 2200);
    const n = 5 + tier * 5;
    const set = tier >= 8 ? ['👑', '💎', '⭐', '🪙'] : tier >= 6 ? ['💎', '⭐', '🪙'] : tier >= 4 ? ['⭐', '🪙'] : ['✨', '⭐'];
    const r = layer.getBoundingClientRect();
    const cx = r.width / 2, cy = r.height * 0.4;
    for (let i = 0; i < n; i++) {
      const p = document.createElement('div');
      p.className = 'cele-particle';
      p.textContent = set[i % set.length];
      const ang = Math.random() * Math.PI * 2, dist = 50 + Math.random() * (70 + tier * 22);
      p.style.left = cx + 'px'; p.style.top = cy + 'px';
      p.style.fontSize = (11 + tier * 1.6) + 'px';
      p.style.setProperty('--dx', Math.cos(ang) * dist + 'px');
      p.style.setProperty('--dy', (Math.sin(ang) * dist - 20) + 'px');
      p.style.animation = `celeFly ${0.8 + Math.random() * 0.7}s ease-out ${i * 0.018}s forwards`;
      layer.appendChild(p);
      setTimeout(() => p.remove(), 1700);
    }
  }
  function shake(el, intensity) {
    if (!el) return;
    el.style.setProperty('--shake', (intensity || 6) + 'px');
    el.classList.remove('shaking'); void el.offsetWidth; el.classList.add('shaking');
    setTimeout(() => el.classList.remove('shaking'), 600);
  }

  // 座位上方的快捷语/闲聊气泡（挂在座位元素内，跟随座位定位）
  function speechBubble(seatEl, text, cls, below) {
    if (!seatEl || !text) return;
    seatEl.querySelectorAll('.speech-bubble').forEach((b) => b.remove());
    const b = document.createElement('div');
    b.className = 'speech-bubble' + (cls ? ' ' + cls : '') + (below ? ' below' : '');
    b.textContent = text;
    seatEl.appendChild(b);
    void b.offsetWidth; b.classList.add('show');
    setTimeout(() => { b.classList.remove('show'); setTimeout(() => b.remove(), 300); }, 2400);
  }

  // 互动礼物：从送礼方飞向目标，命中后爆开
  function flyGift(fromEl, toEl, layer, icon) {
    if (!fromEl || !toEl || !layer) return;
    const a = centerOf(fromEl, layer), z = centerOf(toEl, layer);
    const g = document.createElement('div');
    g.className = 'gift-fly'; g.textContent = icon;
    g.style.left = a.x + 'px'; g.style.top = a.y + 'px';
    g.style.setProperty('--gx', (z.x - a.x) + 'px');
    g.style.setProperty('--gy', (z.y - a.y) + 'px');
    layer.appendChild(g);
    setTimeout(() => {
      g.remove();
      // 命中爆开
      const burst = ['✨', '💥', icon];
      for (let i = 0; i < 10; i++) {
        const p = document.createElement('div');
        p.className = 'cele-particle'; p.textContent = burst[i % burst.length];
        const ang = Math.random() * Math.PI * 2, dist = 30 + Math.random() * 50;
        p.style.left = z.x + 'px'; p.style.top = z.y + 'px'; p.style.fontSize = '16px';
        p.style.setProperty('--dx', Math.cos(ang) * dist + 'px');
        p.style.setProperty('--dy', (Math.sin(ang) * dist - 10) + 'px');
        p.style.animation = `celeFly ${0.6 + Math.random() * 0.5}s ease-out forwards`;
        layer.appendChild(p);
        setTimeout(() => p.remove(), 1200);
      }
    }, 760);
  }

  // 连胜烈焰：≥5 级阶梯，越连越炸（程序化，无大资源）
  function streakFlame(layer, streak) {
    if (!layer || streak < 2) return;
    const L = streak >= 8 ? 6 : streak >= 6 ? 5 : streak >= 5 ? 4 : streak >= 4 ? 3 : streak >= 3 ? 2 : 1;
    const labels = ['', '连胜 ×2 🔥', '连胜 ×3 🔥🔥', '势不可挡 🔥🔥🔥', '烈焰连胜 🔥🔥🔥🔥', '燎原之势 🔥🔥🔥🔥🔥', '皇家统治 👑🔥'];
    const tint = document.createElement('div');
    tint.className = 'streak-tint lv' + L;
    layer.appendChild(tint);
    setTimeout(() => tint.remove(), 1400 + L * 120);
    const banner = document.createElement('div');
    banner.className = 'streak-banner lv' + L;
    banner.textContent = labels[L];
    layer.appendChild(banner);
    setTimeout(() => banner.remove(), 1900);
    // 底部升腾火苗，数量随级别
    const r = layer.getBoundingClientRect();
    const n = 6 + L * 6;
    for (let i = 0; i < n; i++) {
      const f = document.createElement('div');
      f.className = 'flame-particle';
      f.textContent = L >= 5 ? '🔥' : (Math.random() < 0.7 ? '🔥' : '✨');
      f.style.left = (Math.random() * r.width) + 'px';
      f.style.top = (r.height - 6) + 'px';
      f.style.fontSize = (12 + L * 2 + Math.random() * 6) + 'px';
      f.style.setProperty('--fy', -(80 + L * 30 + Math.random() * 60) + 'px');
      f.style.setProperty('--fx', (Math.random() * 40 - 20) + 'px');
      f.style.animation = `flameRise ${0.9 + Math.random() * 0.8}s ease-out ${i * 0.02}s forwards`;
      layer.appendChild(f);
      setTimeout(() => f.remove(), 1800);
    }
    return L;
  }

  // 顶级全场通告：横幅从右向左滑过牌桌顶部（程序化）
  function topBanner(layer, text) {
    if (!layer || !text) return;
    const b = document.createElement('div');
    b.className = 'top-banner'; b.innerHTML = `<span>📣 ${text}</span>`;
    layer.appendChild(b);
    setTimeout(() => b.remove(), 4200);
  }

  window.Fx = { flyChip, pulseWin, floatText, vibrate, coinBurst, handCelebration, shake, speechBubble, flyGift, streakFlame, topBanner };
})();
