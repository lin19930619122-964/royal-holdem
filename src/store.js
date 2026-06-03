/* 玩家档案与经济系统 —— localStorage 持久化。金币(table本金)/钻石(高级币)，签到、兑换码、破产救济，全免费。 */
(function () {
  const KEY = 'royal_profile_v1';
  const Codec = window.Codec;

  const DEFAULT = {
    coins: 100000,       // 金币：上桌本金
    diamonds: 30,        // 钻石：签到/兑换获得，商店消费
    lastCheckin: null,   // 'YYYY-MM-DD'
    checkinStreak: 0,
    ownedBacks: ['classic'],
    ownedFelts: ['imgGreen', 'green'],
    activeBack: 'classic',
    activeFelt: 'imgGreen',
    activeAvatar: 1,     // 玩家头像(1..12)
    redeemed: [],        // 已用兑换码(去重)
    muted: false,
    handsPlayed: 0,
    handsWon: 0,
    biggestPot: 0,
    xp: 0,               // 经验
    level: 1,            // 等级
    lastSpin: null,      // 每日幸运转盘日期
    winStreak: 0,
  };

  // 7 天签到奖励（免费、慷慨）
  const CHECKIN = [
    { coins: 20000, diamonds: 2 },
    { coins: 30000, diamonds: 3 },
    { coins: 40000, diamonds: 4 },
    { coins: 60000, diamonds: 5 },
    { coins: 80000, diamonds: 6 },
    { coins: 120000, diamonds: 8 },
    { coins: 300000, diamonds: 20 }, // 第7天大奖
  ];

  // 内置礼包码（固定 nonce，便于在 README/界面展示）
  const GIFT_CODES = {
    'RHD-C.255S.0-': { label: '新手金币 10万' },   // 占位，真实码下方动态生成
  };

  let profile = load();

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return { ...DEFAULT };
      return { ...DEFAULT, ...JSON.parse(raw) };
    } catch (e) {
      return { ...DEFAULT };
    }
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(profile)); } catch (e) {}
  }
  function get() { return profile; }

  function todayStr() {
    const d = new Date();
    return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
  }
  function yesterdayStr() {
    const d = new Date(Date.now() - 86400000);
    return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
  }

  function addCoins(n) { profile.coins = Math.max(0, profile.coins + n); save(); }
  function addDiamonds(n) { profile.diamonds = Math.max(0, profile.diamonds + n); save(); }
  function spendDiamonds(n) {
    if (profile.diamonds < n) return false;
    profile.diamonds -= n; save(); return true;
  }

  // ---- 签到 ----
  function canCheckin() { return profile.lastCheckin !== todayStr(); }
  function checkinPreview() {
    let streak = profile.checkinStreak;
    if (profile.lastCheckin === yesterdayStr()) streak += 1;
    else streak = 1;
    return { day: ((streak - 1) % 7) + 1, reward: CHECKIN[(streak - 1) % 7], rewards: CHECKIN };
  }
  function doCheckin() {
    if (!canCheckin()) return null;
    let streak = profile.checkinStreak;
    if (profile.lastCheckin === yesterdayStr()) streak += 1;
    else streak = 1;
    const reward = CHECKIN[(streak - 1) % 7];
    profile.checkinStreak = streak;
    profile.lastCheckin = todayStr();
    profile.coins += reward.coins;
    profile.diamonds += reward.diamonds;
    save();
    return { day: ((streak - 1) % 7) + 1, reward };
  }

  // ---- 破产救济：金币不足时免费补满到底线 ----
  const RELIEF_FLOOR = 10000;
  function needsRelief(minBuyIn) { return profile.coins < minBuyIn; }
  function relief() {
    if (profile.coins < RELIEF_FLOOR) {
      const give = RELIEF_FLOOR - profile.coins + 40000; // 补到 5 万
      profile.coins += give;
      save();
      return give;
    }
    return 0;
  }

  // ---- 兑换码 ----
  function redeem(codeStr) {
    const d = Codec.decode(codeStr);
    if (!d.valid) return { ok: false, msg: '无效的兑换码' };
    if (profile.redeemed.includes(d.code)) return { ok: false, msg: '该码已被使用过' };
    let msg = '';
    if (d.type === 'C') { profile.coins += d.value; msg = `金币 +${d.value.toLocaleString()}`; }
    else if (d.type === 'D') { profile.diamonds += d.value; msg = `钻石 +${d.value}`; }
    else if (d.type === 'B') {
      if (!window.Skins.backs[d.value]) return { ok: false, msg: '皮肤不存在' };
      if (!profile.ownedBacks.includes(d.value)) profile.ownedBacks.push(d.value);
      msg = `解锁牌背【${window.Skins.backs[d.value].name}】`;
    } else if (d.type === 'F') {
      if (!window.Skins.felts[d.value]) return { ok: false, msg: '皮肤不存在' };
      if (!profile.ownedFelts.includes(d.value)) profile.ownedFelts.push(d.value);
      msg = `解锁桌布【${window.Skins.felts[d.value].name}】`;
    }
    profile.redeemed.push(d.code);
    save();
    return { ok: true, msg };
  }

  // ---- 商店：钻石购买 ----
  function buyCoinPack(pack) { // {diamonds, coins}
    if (!spendDiamonds(pack.diamonds)) return false;
    profile.coins += pack.coins; save(); return true;
  }
  function buyBack(id) {
    const s = window.Skins.backs[id];
    if (!s || profile.ownedBacks.includes(id)) return false;
    if (!spendDiamonds(s.price)) return false;
    profile.ownedBacks.push(id); save(); return true;
  }
  function buyFelt(id) {
    const s = window.Skins.felts[id];
    if (!s || profile.ownedFelts.includes(id)) return false;
    if (!spendDiamonds(s.price)) return false;
    profile.ownedFelts.push(id); save(); return true;
  }
  function ownFree(arr, id, skin) { if (skin && skin.price === 0 && !arr.includes(id)) arr.push(id); }
  function setBack(id) {
    ownFree(profile.ownedBacks, id, window.Skins.backs[id]);
    if (profile.ownedBacks.includes(id)) { profile.activeBack = id; save(); }
  }
  function setFelt(id) {
    ownFree(profile.ownedFelts, id, window.Skins.felts[id]);
    if (profile.ownedFelts.includes(id)) { profile.activeFelt = id; save(); }
  }
  function setAvatar(id) { profile.activeAvatar = id; save(); }

  function setMuted(m) { profile.muted = !!m; save(); }
  function recordHand(won, pot) {
    profile.handsPlayed++;
    if (won) { profile.handsWon++; profile.winStreak = (profile.winStreak || 0) + 1; }
    else profile.winStreak = 0;
    if (pot > profile.biggestPot) profile.biggestPot = pot;
    save();
  }

  // 经验/等级：升级所需经验随等级递增
  function xpForLevel(lvl) { return 100 + lvl * 100; }
  function addXp(n) {
    profile.xp = (profile.xp || 0) + n;
    let leveled = 0;
    while (profile.xp >= xpForLevel(profile.level)) { profile.xp -= xpForLevel(profile.level); profile.level++; leveled++; }
    save();
    return { leveled, level: profile.level, xp: profile.xp, need: xpForLevel(profile.level) };
  }
  function levelInfo() { return { level: profile.level, xp: profile.xp || 0, need: xpForLevel(profile.level) }; }

  // 每日幸运转盘
  const WHEEL = [
    { type: 'coins', value: 20000, label: '🪙2万' },
    { type: 'diamonds', value: 3, label: '💎3' },
    { type: 'coins', value: 50000, label: '🪙5万' },
    { type: 'diamonds', value: 8, label: '💎8' },
    { type: 'coins', value: 100000, label: '🪙10万' },
    { type: 'diamonds', value: 5, label: '💎5' },
    { type: 'coins', value: 300000, label: '🪙30万' },
    { type: 'diamonds', value: 20, label: '💎20' },
  ];
  function canSpin() { return profile.lastSpin !== todayStr(); }
  function doSpin() {
    if (!canSpin()) return null;
    const i = Math.floor(Math.random() * WHEEL.length);
    const r = WHEEL[i];
    if (r.type === 'coins') profile.coins += r.value; else profile.diamonds += r.value;
    profile.lastSpin = todayStr(); save();
    return { index: i, reward: r };
  }

  window.Store = {
    get, save, addCoins, addDiamonds, spendDiamonds,
    canCheckin, checkinPreview, doCheckin,
    needsRelief, relief, RELIEF_FLOOR,
    redeem, buyCoinPack, buyBack, buyFelt, setBack, setFelt, setAvatar,
    setMuted, recordHand, addXp, levelInfo,
    canSpin, doSpin, WHEEL,
    CHECKIN,
  };
})();
