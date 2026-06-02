/* 音效 —— 全部用 WebAudio 实时合成，无任何外部/版权音频。可静音。 */
(function () {
  let ctx = null;
  let muted = false;

  function ac() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) ctx = new AC();
    }
    if (ctx && ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function tone(freq, dur, type, gain, delay) {
    const c = ac();
    if (!c || muted) return;
    const t0 = c.currentTime + (delay || 0);
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain || 0.2, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(c.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }
  function noise(dur, gain, delay) {
    const c = ac();
    if (!c || muted) return;
    const t0 = c.currentTime + (delay || 0);
    const n = Math.floor(c.sampleRate * dur);
    const buf = c.createBuffer(1, n, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < n; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = c.createBufferSource();
    src.buffer = buf;
    const g = c.createGain();
    g.gain.value = gain || 0.15;
    const f = c.createBiquadFilter();
    f.type = 'highpass'; f.frequency.value = 2000;
    src.connect(f).connect(g).connect(c.destination);
    src.start(t0);
  }

  const Sfx = {
    setMuted(m) { muted = !!m; },
    isMuted() { return muted; },
    resume() { ac(); },
    deal() { noise(0.06, 0.12); tone(520, 0.05, 'square', 0.05); },
    chip() { tone(900, 0.05, 'triangle', 0.12); tone(1300, 0.05, 'triangle', 0.08, 0.04); },
    check() { tone(330, 0.12, 'sine', 0.16); },
    fold() { tone(400, 0.18, 'sawtooth', 0.12); tone(220, 0.22, 'sawtooth', 0.1, 0.06); },
    bet() { tone(523, 0.1, 'triangle', 0.16); tone(784, 0.12, 'triangle', 0.14, 0.05); this.chip(); },
    win() {
      [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.3, 'triangle', 0.18, i * 0.08));
    },
    lose() { tone(330, 0.3, 'sine', 0.14); tone(247, 0.4, 'sine', 0.12, 0.12); },
    reward() { [659, 880, 1175].forEach((f, i) => tone(f, 0.25, 'sine', 0.18, i * 0.07)); },
    button() { tone(660, 0.04, 'square', 0.08); },
  };

  window.Sfx = Sfx;
})();
