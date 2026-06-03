/* 背景音乐 —— WebAudio 合成的温暖大调休闲循环(钢琴/竖琴风)，柔和不扰人、不渗人。可静音。 */
(function () {
  let ctx = null, timer = null, master = null, playing = false, muted = false, bar = 0;

  // C 大调暖色进行 I–vi–IV–V，每个和弦的音(相对 C 的半音)
  const PROG = [
    { root: -12, notes: [0, 4, 7, 12] },   // C
    { root: -15, notes: [-3, 0, 4, 9] },   // Am
    { root: -7, notes: [5, 9, 12, 17] },   // F
    { root: -5, notes: [7, 11, 14, 19] },  // G
  ];
  const BASE = 261.63; // C4
  const freq = (s) => BASE * Math.pow(2, s / 12);

  function ac() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain(); master.gain.value = 0; master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  // 柔和音符：正弦+轻微泛音，慢起慢落(竖琴/钢琴感)
  function note(f, t0, dur, gain, type) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type || 'triangle'; o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(gain, t0 + 0.04);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(master); o.start(t0); o.stop(t0 + dur + 0.05);
  }

  function schedule() {
    const c = ac(); if (!c) return;
    const t0 = c.currentTime + 0.04;
    const ch = PROG[bar % PROG.length];
    // 柔和铺底和弦
    ch.notes.forEach((s) => note(freq(s), t0, 3.0, 0.045, 'sine'));
    // 低音根音
    note(freq(ch.root), t0, 2.8, 0.07, 'triangle');
    // 轻拨旋律：在和弦音里挑两三个，错开时间，像竖琴
    const mel = ch.notes.slice().sort(() => Math.random() - 0.5);
    note(freq(mel[0] + 12), t0 + 0.5, 0.9, 0.05, 'triangle');
    note(freq(mel[1] + 12), t0 + 1.3, 0.9, 0.045, 'triangle');
    if (Math.random() < 0.6) note(freq(mel[2] + 12), t0 + 2.1, 0.8, 0.04, 'triangle');
    bar++;
  }

  const Music = {
    start() {
      if (playing) return; const c = ac(); if (!c) return;
      playing = true;
      master.gain.cancelScheduledValues(c.currentTime);
      master.gain.linearRampToValueAtTime(muted ? 0 : 0.6, c.currentTime + 1.5);
      schedule(); timer = setInterval(schedule, 2600);
    },
    stop() { if (timer) clearInterval(timer); timer = null; playing = false; if (master && ctx) master.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.4); },
    setMuted(m) { muted = !!m; if (master && ctx) master.gain.linearRampToValueAtTime(muted ? 0 : 0.6, ctx.currentTime + 0.3); },
    isPlaying() { return playing; },
  };
  window.Music = Music;
})();
