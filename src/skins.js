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

  // —— 程序化扩充商店：批量牌背(花纹×配色) + 桌布(配色) ——
  const PAL = [
    ['翡翠', '#0e6b46', '#15835a'], ['宝蓝', '#123f72', '#1c5aa0'], ['酒红', '#5e1620', '#8a2330'],
    ['皇紫', '#311049', '#4a2070'], ['鎏金', '#5a4310', '#b8862f'], ['曜黑', '#1a2026', '#3a4450'],
    ['玫红', '#7a1140', '#c0306a'], ['青碧', '#0c5a52', '#16a89a'], ['橙焰', '#7a3a0c', '#d2691e'],
    ['天青', '#1a4a6a', '#2f8fc0'], ['樱粉', '#7a2a4a', '#d46a90'], ['墨绿', '#10331f', '#1f6a3a'],
  ];
  const PAT = [
    ['斜纹', (a, b) => `repeating-linear-gradient(45deg,${a} 0 7px,${b} 7px 14px)`],
    ['竖纹', (a, b) => `repeating-linear-gradient(90deg,${a} 0 6px,${b} 6px 12px)`],
    ['圆心', (a, b) => `radial-gradient(circle at 50% 50%,${b} 0 28%,${a} 29%)`],
    ['波点', (a, b) => `repeating-radial-gradient(circle at 50% 50%,${a} 0 4px,${b} 4px 8px)`],
    ['菱格', (a, b) => `conic-gradient(from 0deg,${a} 0 90deg,${b} 90deg 180deg,${a} 180deg 270deg,${b} 270deg)`],
    ['流光', (a, b) => `linear-gradient(135deg,${a},${b} 50%,${a})`],
    ['交织', (a, b) => `repeating-linear-gradient(45deg,${a} 0 6px,${b} 6px 12px), repeating-linear-gradient(-45deg,${a}55 0 6px,transparent 6px 12px)`],
    ['鳞光', (a, b) => `radial-gradient(circle at 50% 0,${b} 0 30%,${a} 31%), radial-gradient(circle at 50% 100%,${b} 0 30%,${a} 31%)`],
  ];
  let _bi = 0;
  for (const [cn, a, b] of PAL) {
    for (const [pn, fn] of PAT) {
      if (_bi >= 48) break;
      backs['g' + _bi] = { name: cn + pn, price: 5 + (_bi % 6) * 3, css: `${fn(a, b)}, ${b}` };
      _bi++;
    }
  }
  const FPAL = [
    ['翠湖绿', '#1aa06a', '#0e6b46', '#063a25'], ['深海蓝', '#2070b0', '#123f72', '#0a2748'],
    ['烈焰红', '#a83040', '#6e1822', '#3a0c12'], ['皇室紫', '#5a3c8c', '#2e1a52', '#160d2e'],
    ['黄金殿', '#b8862f', '#7a5414', '#3a2808'], ['曜石灰', '#3a4450', '#222a32', '#10151a'],
    ['玫瑰金', '#c47a6a', '#8a4a40', '#4a221c'], ['碧波青', '#16a89a', '#0c5a52', '#063029'],
    ['落日橙', '#d2802e', '#8a4e14', '#4a2808'], ['星空蓝', '#2a4a8c', '#162a5a', '#0a142e'],
    ['樱花粉', '#d46a90', '#8a3a58', '#4a1c2e'], ['翡翠墨', '#1f6a3a', '#103320', '#081a10'],
    ['琥珀棕', '#9a6a30', '#5e3e18', '#2e1e0a'], ['冰川白', '#5a7a8a', '#39505c', '#1c2a32'],
    ['绛紫红', '#8a2a5a', '#5a1838', '#2e0c1c'], ['孔雀绿', '#0e8a7a', '#085049', '#042a26'],
    ['钴蓝', '#2858c0', '#163a8a', '#0a1e4a'], ['玛瑙红', '#b0303a', '#701820', '#3a0c10'],
    ['翡冷翠', '#1ea88c', '#0e5a4a', '#062e26'], ['夜皇', '#3a2a7a', '#201450', '#0e0a2e'],
    ['鎏金黑', '#c8a040', '#6a5018', '#241a06'], ['绯樱', '#d4506a', '#8a2a44', '#4a1422'],
  ];
  FPAL.forEach(([nm, a, b, c], i) => { felts['gf' + i] = { name: nm, price: 8 + (i % 4) * 4, a, b, c }; });

  // 精绘牌背(AI 图)
  backs.imgGold = { name: '黄金艺术', price: 20, css: "url('assets/backs/gold.png') center/cover, #5a0b18" };
  backs.imgRoyal = { name: '皇家蓝', price: 22, css: "url('assets/backs/royal.png') center/cover, #123f72" };
  backs.imgDragon = { name: '盘龙', price: 28, css: "url('assets/backs/dragon.png') center/cover, #0e6b46" };
  backs.imgPhoenix = { name: '凤凰', price: 30, css: "url('assets/backs/phoenix.png') center/cover, #311049" };

  // 场景主题(整体背景)
  const scenes = {
    vip: { name: 'VIP包厢', price: 0, img: 'assets/scenes/vip.png' },
    palace: { name: '皇宫大殿', price: 15, img: 'assets/scenes/palace.png' },
    yacht: { name: '豪华游艇', price: 20, img: 'assets/scenes/yacht.png' },
    vegas: { name: '拉斯维加斯', price: 25, img: 'assets/scenes/vegas.png' },
    macau: { name: '澳门金殿', price: 30, img: 'assets/scenes/macau.png' },
  };

  const DEFAULT_RING = '0 0 0 2px #160d05,0 0 0 4px #b8862f,0 0 0 5px #2a1a0c,inset 0 2px 6px rgba(255,255,255,.22),inset 0 -3px 6px rgba(0,0,0,.4),0 4px 10px rgba(0,0,0,.55)';
  // 头像框(戴在你头像外圈)
  const frames = {
    none: { name: '默认金边', price: 0, css: DEFAULT_RING },
    gold: { name: '黄金框', price: 10, css: '0 0 0 3px #fff3cf,0 0 0 5px #b8862f,0 0 14px rgba(245,207,107,.9)' },
    silver: { name: '白银框', price: 10, css: '0 0 0 3px #eef4f8,0 0 0 5px #8a9aa6,0 0 12px rgba(220,235,245,.85)' },
    neon: { name: '霓虹框', price: 16, css: '0 0 0 3px #00e5ff,0 0 16px #00e5ff,0 0 30px rgba(0,229,255,.6)' },
    flame: { name: '烈焰框', price: 18, css: '0 0 0 3px #ff7a18,0 0 18px #ff3d00,0 0 34px rgba(255,61,0,.6)' },
    emerald: { name: '翡翠框', price: 14, css: '0 0 0 3px #6ff0b0,0 0 0 5px #0e6b46,0 0 14px rgba(26,160,106,.8)' },
    royal: { name: '皇紫框', price: 20, css: '0 0 0 3px #c9a6ff,0 0 16px #7a3df0,0 0 30px rgba(122,61,240,.6)' },
    rose: { name: '玫瑰金', price: 16, css: '0 0 0 3px #ffd9cf,0 0 0 5px #c47a6a,0 0 14px rgba(196,122,106,.8)' },
    ice: { name: '寒冰框', price: 16, css: '0 0 0 3px #d6f3ff,0 0 16px #66c8ff,0 0 30px rgba(102,200,255,.6)' },
    blood: { name: '血玉框', price: 20, css: '0 0 0 3px #ff6a7a,0 0 16px #c0102a,0 0 30px rgba(192,16,42,.6)' },
    rainbow: { name: '七彩框', price: 30, css: '0 0 0 3px #ff5e5e,0 0 0 5px #5eff8a,0 0 18px #5e8aff,0 0 34px rgba(255,255,255,.4)' },
    crown: { name: '王者框', price: 38, css: '0 0 0 3px #fff3cf,0 0 0 6px #f5cf6b,0 0 22px #f5cf6b,0 0 44px rgba(245,207,107,.7)' },
  };
  // 称号(显示在你名牌上)
  const titles = {
    none: { name: '无称号', price: 0, text: '', color: '#eafff2' },
    rookie: { name: '德州新秀', price: 5, text: '德州新秀', color: '#7fe3a0' },
    gambler: { name: '老赌棍', price: 10, text: '老赌棍', color: '#cfe7d8' },
    shark: { name: '牌桌鲨鱼', price: 15, text: '🦈鲨鱼', color: '#7fd4ff' },
    bluffer: { name: '诈唬大师', price: 15, text: '诈唬大师', color: '#ff8a8a' },
    allin: { name: '全下狂魔', price: 18, text: '全下狂魔', color: '#ff9a3c' },
    lucky: { name: '欧皇', price: 20, text: '🍀欧皇', color: '#7fe3a0' },
    tycoon: { name: '大亨', price: 25, text: '💰大亨', color: '#f5cf6b' },
    god: { name: '赌神', price: 38, text: '👑赌神', color: '#fff3cf' },
    legend: { name: '皇家传说', price: 50, text: '✨皇家传说', color: '#c9a6ff' },
  };

  // 载具(进场特效，代表身份)
  const vehicles = {
    none: { name: '步行', price: 0, icon: '🚶' },
    bike: { name: '自行车', price: 5, icon: '🚲' },
    car: { name: '轿车', price: 20, icon: '🚗' },
    sport: { name: '跑车', price: 50, icon: '🏎️' },
    suv: { name: '越野', price: 35, icon: '🚙' },
    yacht: { name: '游艇', price: 80, icon: '🛥️' },
    heli: { name: '直升机', price: 120, icon: '🚁' },
    jet: { name: '私人飞机', price: 200, icon: '✈️' },
    rocket: { name: '火箭', price: 500, icon: '🚀' },
  };
  // 腕表(身份配饰)
  const watches = {
    none: { name: '无', price: 0, icon: '' },
    steel: { name: '精钢表', price: 10, icon: '⌚' },
    business: { name: '商务表', price: 25, icon: '🕰️' },
    diamond: { name: '钻石表', price: 60, icon: '💎' },
    gold: { name: '黄金表', price: 100, icon: '🥇' },
    crown: { name: '王冠陀飞轮', price: 250, icon: '👑' },
  };

  function apply() {
    const p = window.Store.get();
    const back = backs[p.activeBack] || backs.classic;
    const felt = felts[p.activeFelt] || felts.imgGreen;
    const frame = frames[p.activeFrame] || frames.none;
    const root = document.documentElement.style;
    root.setProperty('--card-back', back.css);
    root.setProperty('--felt-img', felt.img ? `url('${felt.img}')` : 'none');
    root.setProperty('--felt-a', felt.a);
    root.setProperty('--felt', felt.b);
    root.setProperty('--felt-dark', felt.c);
    root.setProperty('--frame', frame.css);
    const scene = scenes[p.activeScene] || scenes.vip;
    root.setProperty('--scene-bg', `url('${scene.img}')`);
  }

  // 牌面主题(程序化样式，非资源图)：classic=传统白底，neon=暗底霓虹描边
  const cardFaces = {
    classic: { name: '经典', cls: 'cf-classic', price: 0 },
    neon: { name: '霓虹', cls: 'cf-neon', price: 0 },
  };

  window.Skins = { backs, felts, frames, titles, vehicles, watches, scenes, cardFaces, apply };
})();
