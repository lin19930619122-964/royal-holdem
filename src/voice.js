/* AI 中文语音 —— 播放 macOS 中文 TTS 生成的语音包(弃牌/过牌/跟注/加注/全下/获胜)。
   3 个嗓音(0婷婷 1美佳 2善怡) × 每动作 2 句变体。可随音效一起静音。 */
(function () {
  let muted = false;
  // dialect: 'db'(东北) / 'cd'(成都)；key: fold/check/call/raise/allin/win/taunt
  function play(dialect, key) {
    if (muted || !key) return;
    const variant = Math.random() < 0.5 ? 0 : 1;
    try {
      const a = new Audio(`assets/voice/${dialect}_${key}_${variant}.m4a`);
      a.volume = 0.95;
      a.play().catch(() => {});
    } catch (e) {}
  }
  window.Voice = { play, setMuted(m) { muted = !!m; }, isMuted() { return muted; } };
})();
