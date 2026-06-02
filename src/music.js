/* 背景音乐 —— WebAudio 实时合成的轻爵士/休闲循环，原创无版权，可静音。低音量不扰人。 */
(function () {
  let ctx = null, timer = null, master = null, playing = false, muted = false;
  // 一段舒缓的和弦进行（半音值，相对根音），循环：i - VI - III - VII 风格
  const CHORDS = [
    [0, 3, 7, 10],   // Cm7
    [-4, 0, 3, 7],   // AbMaj7-ish
    [-1, 2, 5, 9],   // Bb..
    [2, 5, 9, 12],
  ];
  const ROOT = 130.81; // C3
  let step = 0;

  function ac() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.0;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }
  function freq(semi) { return ROOT * Math.pow(2, semi / 12); }

  function voice(f, t0, dur, gain, type) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type || 'sine'; o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.3);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(master); o.start(t0); o.stop(t0 + dur + 0.1);
  }

  function schedule() {
    const c = ac(); if (!c) return;
    const t0 = c.currentTime + 0.05;
    const chord = CHORDS[step % CHORDS.length];
    // 柔和铺底和弦
    chord.forEach((s, i) => voice(freq(s), t0, 3.4, 0.06, 'sine'));
    // 低音
    voice(freq(chord[0] - 12), t0, 3.2, 0.10, 'triangle');
    // 偶尔一个高音点缀
    if (step % 2 === 0) voice(freq(chord[3] + 12), t0 + 1.6, 1.0, 0.04, 'triangle');
    step++;
  }

  const Music = {
    start() {
      if (playing) return; const c = ac(); if (!c) return;
      playing = true;
      master.gain.cancelScheduledValues(c.currentTime);
      master.gain.linearRampToValueAtTime(muted ? 0 : 0.5, c.currentTime + 1.2);
      schedule();
      timer = setInterval(schedule, 3200);
    },
    stop() { if (timer) clearInterval(timer); timer = null; playing = false; if (master && ctx) master.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.4); },
    setMuted(m) { muted = !!m; if (master && ctx) master.gain.linearRampToValueAtTime(muted ? 0 : 0.5, ctx.currentTime + 0.3); },
    isPlaying() { return playing; },
  };
  window.Music = Music;
})();
