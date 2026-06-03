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

  window.Fx = { flyChip, pulseWin, floatText, vibrate, coinBurst, handCelebration, shake };
})();
