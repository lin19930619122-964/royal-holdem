/* 皮肤系统 —— 原创牌背与桌布（纯 CSS），可购买/兑换/切换。price 为钻石价；price 0 = 默认免费拥有。 */
(function () {
  const backs = {
    classic: {
      name: '皇室红', price: 0,
      css: "url('assets/cardback.png') center/cover, #5a0b18",
    },
    ocean: {
      name: '深海蓝', price: 8,
      css: 'repeating-linear-gradient(45deg,#1b4f8a 0 7px,#0f3160 7px 14px)',
    },
    gold: {
      name: '鎏金', price: 15,
      css: 'linear-gradient(135deg,#5a4310,#b8862f 45%,#f5cf6b 50%,#b8862f 55%,#5a4310)',
    },
    dragon: {
      name: '神龙', price: 30,
      css: 'radial-gradient(circle at 50% 40%,#1f7a4e,#0a3d27),repeating-conic-gradient(from 0deg,#0a3d27 0deg 12deg,#125c39 12deg 24deg)',
    },
    royal: {
      name: '皇室紫', price: 20,
      css: 'repeating-linear-gradient(45deg,#4a2070 0 7px,#311049 7px 14px)',
    },
  };

  const felts = {
    // AI 生成的高清绒布(可切换)
    imgGreen: { name: '翡翠绒', price: 0, img: 'assets/felts/green.png', a: '#15835a', b: '#0e6b46', c: '#084f33' },
    imgBlue: { name: '宝蓝绒', price: 10, img: 'assets/felts/blue.png', a: '#1c5aa0', b: '#123f72', c: '#0a2748' },
    imgCrimson: { name: '红钻绒', price: 15, img: 'assets/felts/crimson.png', a: '#8a2330', b: '#5e1620', c: '#380c12' },
    imgPurple: { name: '紫晶绒', price: 18, img: 'assets/felts/purple.png', a: '#3a2c66', b: '#241a4a', c: '#140d2e' },
    // 纯色经典
    green: { name: '经典绿', price: 0, a: '#15835a', b: '#0e6b46', c: '#084f33' },
    night: { name: '午夜紫', price: 12, a: '#3a2c66', b: '#241a4a', c: '#140d2e' },
    obsidian: { name: '曜石黑', price: 20, a: '#2a3138', b: '#1a2026', c: '#0c1014' },
  };

  function apply() {
    const p = window.Store.get();
    const back = backs[p.activeBack] || backs.classic;
    const felt = felts[p.activeFelt] || felts.imgGreen;
    const root = document.documentElement.style;
    root.setProperty('--card-back', back.css);
    root.setProperty('--felt-img', felt.img ? `url('${felt.img}')` : 'none');
    root.setProperty('--felt-a', felt.a);
    root.setProperty('--felt', felt.b);
    root.setProperty('--felt-dark', felt.c);
  }

  window.Skins = { backs, felts, apply };
})();
