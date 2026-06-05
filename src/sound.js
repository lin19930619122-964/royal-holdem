/* 音效 —— WebAudio 实时合成，更清晰好听：筹码叮当/码堆/扑克牌甩动/敲桌/获胜。原创无版权，可静音。 */
(function () {
  let ctx = null, muted = false;

  function ac() {
    if (!ctx) { const AC = window.AudioContext || window.webkitAudioContext; if (AC) ctx = new AC(); }
    if (ctx && ctx.state === 'suspended') ctx.resume();
    return ctx;
  }
  function tone(freq, dur, type, gain, delay, freqEnd) {
    const c = ac(); if (!c || muted) return;
    const t0 = c.currentTime + (delay || 0);
    const o = c.createOscillator(), g = c.createGain();
    o.type = type || 'sine'; o.frequency.setValueAtTime(freq, t0);
    if (freqEnd) o.frequency.exponentialRampToValueAtTime(freqEnd, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain || 0.2, t0 + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(c.destination); o.start(t0); o.stop(t0 + dur + 0.03);
  }
  // 噪声(可带滤波)：用于卡牌甩动/筹码摩擦
  function noise(dur, gain, delay, filter) {
    const c = ac(); if (!c || muted) return;
    const t0 = c.currentTime + (delay || 0);
    const n = Math.floor(c.sampleRate * dur);
    const buf = c.createBuffer(1, n, c.sampleRate), data = buf.getChannelData(0);
    for (let i = 0; i < n; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = c.createBufferSource(); src.buffer = buf;
    const g = c.createGain(); g.gain.value = gain || 0.15;
    const f = c.createBiquadFilter();
    f.type = filter && filter.type || 'highpass';
    f.frequency.setValueAtTime((filter && filter.from) || 3000, t0);
    if (filter && filter.to) f.frequency.exponentialRampToValueAtTime(filter.to, t0 + dur);
    if (filter && filter.q) f.Q.value = filter.q;
    src.connect(f).connect(g).connect(c.destination); src.start(t0);
  }
  // 单枚筹码"叮"
  function clink(delay, p) {
    p = p || 1;
    tone(1500 * p, 0.06, 'triangle', 0.16, delay);
    tone(2300 * p, 0.05, 'triangle', 0.10, (delay || 0) + 0.005);
    noise(0.03, 0.05, delay, { type: 'highpass', from: 5000 });
  }

  const Sfx = {
    setMuted(m) { muted = !!m; }, isMuted() { return muted; }, resume() { ac(); },
    // 发牌：扑克牌轻甩(噪声扫频) + 轻点
    deal() { noise(0.09, 0.13, 0, { type: 'bandpass', from: 4000, to: 1500, q: 1 }); tone(420, 0.04, 'square', 0.04, 0.02); },
    // 跟注/下注的筹码：两三枚叮当
    chip() { clink(0, 1); clink(0.05, 1.05); },
    // 下注/加注：码堆落桌 + 几枚叮当
    bet() { tone(150, 0.08, 'sine', 0.18); clink(0.02, 1); clink(0.08, 0.96); clink(0.14, 1.08); },
    // 过牌：敲两下桌子
    check() { tone(170, 0.06, 'sine', 0.22); tone(150, 0.06, 'sine', 0.18, 0.12); },
    // 弃牌：卡牌甩出去的"唰"
    fold() { noise(0.18, 0.14, 0, { type: 'lowpass', from: 6000, to: 800, q: 0.7 }); },
    // 加注：比下注更重更利，码堆 + 短促上扬叮（与 bet 明显区分）
    raise() { tone(120, 0.10, 'sine', 0.22); clink(0.02, 1.1); clink(0.07, 1.15); clink(0.12, 1.2); tone(660, 0.10, 'triangle', 0.12, 0.06, 990); },
    // 全下：码堆 + 强上扬强调（最重）
    allin() { tone(110, 0.12, 'sine', 0.26); clink(0.02, 1.2); clink(0.07, 1.25); clink(0.13, 1.3); tone(523, 0.18, 'triangle', 0.2, 0.1, 1047); noise(0.2, 0.1, 0.1, { type: 'lowpass', from: 1400, to: 200 }); },
    // 翻牌/亮牌：轻脆翻面声（与 deal 区分）
    flip() { tone(900, 0.03, 'square', 0.06); noise(0.05, 0.07, 0.005, { type: 'highpass', from: 4000 }); tone(1300, 0.03, 'triangle', 0.05, 0.02); },
    // 收池：筹码快速归集（连串叮当扫过）
    potwin() { for (let i = 0; i < 6; i++) clink(i * 0.04, 1 + i * 0.06); tone(523, 0.18, 'sine', 0.12, 0.1, 784); },
    // bad beat：下行不和谐 + 低沉一击
    badbeat() { tone(392, 0.22, 'sawtooth', 0.14); tone(370, 0.26, 'sawtooth', 0.12, 0.1); tone(98, 0.4, 'sine', 0.2, 0.18); },
    // 英雄大胜：比 win 更长更亮的号角
    winbig() { [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.4, 'triangle', 0.22, i * 0.1)); for (let i = 0; i < 8; i++) clink(0.4 + i * 0.05, 1 + i * 0.06); tone(1568, 0.5, 'sine', 0.16, 0.5); },
    win() { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.32, 'triangle', 0.2, i * 0.09)); for (let i = 0; i < 5; i++) clink(0.3 + i * 0.06, 1 + i * 0.05); },
    lose() { tone(330, 0.3, 'sine', 0.14); tone(247, 0.4, 'sine', 0.12, 0.12); },
    reward() { [659, 880, 1175].forEach((f, i) => tone(f, 0.26, 'sine', 0.2, i * 0.07)); clink(0, 1.2); clink(0.1, 1.1); },
    button() { tone(700, 0.04, 'square', 0.08); },
    // 礼物命中音效（合成，按礼物类型）
    gift(type) {
      switch (type) {
        case 'pop': tone(600, 0.05, 'square', 0.12); tone(900, 0.05, 'square', 0.1, 0.05); break;
        case 'whoosh': noise(0.35, 0.12, 0, { type: 'bandpass', from: 600, to: 4000, q: 0.8 }); tone(220, 0.3, 'sawtooth', 0.08, 0, 1200); break;
        case 'boom': tone(80, 0.4, 'sine', 0.3); noise(0.3, 0.22, 0.02, { type: 'lowpass', from: 1200, to: 200 }); break;
        case 'fanfare': [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.3, 'triangle', 0.18, i * 0.08)); break;
        case 'sparkle': [1047, 1319, 1568, 2093].forEach((f, i) => tone(f, 0.18, 'sine', 0.14, i * 0.05)); for (let i = 0; i < 4; i++) clink(0.1 + i * 0.05, 1.3 + i * 0.1); break;
        default: tone(880, 0.16, 'sine', 0.14); tone(1175, 0.16, 'sine', 0.12, 0.08); // soft
      }
    },
    // 连胜烈焰：火焰轰鸣，按连胜级别升调加层
    streak(level) {
      const L = Math.max(1, Math.min(6, level));
      tone(90, 0.3 + L * 0.05, 'sawtooth', 0.12 + L * 0.02);
      noise(0.25 + L * 0.05, 0.1 + L * 0.02, 0, { type: 'lowpass', from: 1800, to: 300, q: 0.6 });
      for (let i = 0; i < L; i++) tone(330 + i * 110, 0.18, 'triangle', 0.12, i * 0.06, 660 + i * 110);
    },
  };
  window.Sfx = Sfx;
})();
