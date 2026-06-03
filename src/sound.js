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
    // 全下：码堆 + 上扬强调
    allin() { this.bet(); tone(523, 0.14, 'triangle', 0.16, 0.1, 880); },
    win() { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.32, 'triangle', 0.2, i * 0.09)); for (let i = 0; i < 5; i++) clink(0.3 + i * 0.06, 1 + i * 0.05); },
    lose() { tone(330, 0.3, 'sine', 0.14); tone(247, 0.4, 'sine', 0.12, 0.12); },
    reward() { [659, 880, 1175].forEach((f, i) => tone(f, 0.26, 'sine', 0.2, i * 0.07)); clink(0, 1.2); clink(0.1, 1.1); },
    button() { tone(700, 0.04, 'square', 0.08); },
  };
  window.Sfx = Sfx;
})();
