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
    activeAvatar: 1,     // 玩家头像(1..16)
    ownedFrames: ['none'], activeFrame: 'none',   // 头像框
    ownedTitles: ['none'], activeTitle: 'none',   // 称号
    ownedVehicles: ['none'], activeVehicle: 'none', // 载具(进场特效)
    ownedWatches: ['none'], activeWatch: 'none',     // 腕表
    ownedScenes: ['vip'], activeScene: 'vip',        // 场景主题
    redeemed: [],        // 已用兑换码(去重)
    muted: false,
    handsPlayed: 0,
    handsWon: 0,
    biggestPot: 0,
    xp: 0,               // 经验
    level: 1,            // 等级
    lastSpin: null,      // 每日幸运转盘日期
    winStreak: 0,
    bestStreak: 0,       // 最高连胜
    bestHand: 0,         // 最佳牌型类别(0..8)
    allinTotal: 0,       // 全下总次数
    dailyDate: null,     // 每日任务日期
    dHands: 0, dWins: 0, dAllin: 0,  // 今日进度
    dMaxStreak: 0, dBestHand: 0,     // 今日最高连胜 / 今日最佳牌型
    eventClaimed: [],    // 今日已领活动
    taskClaimed: [],     // 今日已领任务
    achvClaimed: [],     // 已领成就
    handLog: [],         // 牌局复盘记录(最近 N 手)
    handSeq: 0,          // 累计手数编号(牌局编号)
    coachMode: true,     // 训练模式:实时显示胜率/赔率/建议(关=考试模式)
    seasonId: null,      // 皇家赛季(按月) id
    seasonXp: 0,         // 赛季经验
    seasonLevel: 1,      // 赛季等级
    seasonClaimed: [],   // 已领赛季奖励等级
    rankPoints: 0,       // 段位积分(赢+/输-)
    lastDailyGift: null, // 每日礼包领取日期
    vault: 0,            // 金库钱罐累计
    vaultCracked: 0,     // 金库累计敲碎次数
    mailClaimed: [],     // 已领邮件 id
    tutorialDone: false, // 新手教程是否已看
  };
  const VAULT_MIN = 20000; // 金库最低可敲碎额
  const SEASON_LEN = 30;          // 赛季 30 级
  // 段位阶梯(原创命名)
  const RANK_TIERS = [
    { name: '青铜', need: 0 }, { name: '白银', need: 200 }, { name: '黄金', need: 500 },
    { name: '铂金', need: 900 }, { name: '钻石', need: 1400 }, { name: '星耀', need: 2000 }, { name: '皇家大师', need: 2800 },
  ];
  const HANDLOG_CAP = 30;

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

  // 通用饰品(头像框/称号/载具/腕表)购买与装备
  function mkCosmetic(mapName, ownedKey, activeKey) {
    return {
      buy(id) { const s = window.Skins[mapName][id]; if (!s || profile[ownedKey].includes(id)) return false; if (!spendDiamonds(s.price)) return false; profile[ownedKey].push(id); save(); return true; },
      set(id) { const s = window.Skins[mapName][id]; ownFree(profile[ownedKey], id, s); if (profile[ownedKey].includes(id)) { profile[activeKey] = id; save(); } },
    };
  }
  const _frame = mkCosmetic('frames', 'ownedFrames', 'activeFrame');
  const _title = mkCosmetic('titles', 'ownedTitles', 'activeTitle');
  const _veh = mkCosmetic('vehicles', 'ownedVehicles', 'activeVehicle');
  const _watch = mkCosmetic('watches', 'ownedWatches', 'activeWatch');
  const _scene = mkCosmetic('scenes', 'ownedScenes', 'activeScene');

  function setMuted(m) { profile.muted = !!m; save(); }

  function dailyReset() {
    if (profile.dailyDate !== todayStr()) {
      profile.dailyDate = todayStr();
      profile.dHands = 0; profile.dWins = 0; profile.dAllin = 0; profile.taskClaimed = [];
      profile.dMaxStreak = 0; profile.dBestHand = 0; profile.eventClaimed = [];
    }
  }
  function recordHand(won, pot, handCat) {
    dailyReset();
    profile.handsPlayed++; profile.dHands++;
    if ((handCat || 0) > (profile.dBestHand || 0)) profile.dBestHand = handCat || 0;
    if (won) { profile.handsWon++; profile.dWins++; profile.winStreak = (profile.winStreak || 0) + 1; if (profile.winStreak > (profile.bestStreak || 0)) profile.bestStreak = profile.winStreak; if (profile.winStreak > (profile.dMaxStreak || 0)) profile.dMaxStreak = profile.winStreak; }
    else profile.winStreak = 0;
    if (pot > profile.biggestPot) profile.biggestPot = pot;
    if ((handCat || 0) > (profile.bestHand || 0)) profile.bestHand = handCat || 0;
    save();
  }
  function recordAllin() { dailyReset(); profile.dAllin++; profile.allinTotal = (profile.allinTotal || 0) + 1; save(); }

  // ---- 每日任务 ----
  const TASKS = [
    { id: 'play', name: '今日对局 10 手', goal: 10, prog: (p) => p.dHands, coins: 30000, diamonds: 2 },
    { id: 'win', name: '今日获胜 3 手', goal: 3, prog: (p) => p.dWins, coins: 50000, diamonds: 3 },
    { id: 'allin', name: '今日全下 1 次', goal: 1, prog: (p) => p.dAllin, coins: 40000, diamonds: 2 },
  ];
  function getTasks() {
    dailyReset();
    return TASKS.map((t) => { const cur = Math.min(t.prog(profile), t.goal); return { id: t.id, name: t.name, cur, goal: t.goal, done: cur >= t.goal, claimed: profile.taskClaimed.includes(t.id), coins: t.coins, diamonds: t.diamonds }; });
  }
  function claimTask(id) {
    dailyReset();
    const t = TASKS.find((x) => x.id === id); if (!t) return null;
    if (t.prog(profile) < t.goal || profile.taskClaimed.includes(id)) return null;
    profile.taskClaimed.push(id); profile.coins += t.coins; profile.diamonds += t.diamonds; save();
    return { coins: t.coins, diamonds: t.diamonds };
  }

  // ---- 成就 ----
  const ACHV = [
    { id: 'firstwin', name: '首胜', desc: '赢得 1 手', ok: (p) => p.handsWon >= 1, coins: 20000, diamonds: 2 },
    { id: 'hands100', name: '百战之身', desc: '游玩 100 手', ok: (p) => p.handsPlayed >= 100, coins: 50000, diamonds: 5 },
    { id: 'hands1000', name: '千锤百炼', desc: '游玩 1000 手', ok: (p) => p.handsPlayed >= 1000, coins: 200000, diamonds: 20 },
    { id: 'bigpot', name: '大赢家', desc: '单手底池 10 万', ok: (p) => p.biggestPot >= 100000, coins: 80000, diamonds: 8 },
    { id: 'lv10', name: '崭露头角', desc: '达到 10 级', ok: (p) => p.level >= 10, coins: 100000, diamonds: 10 },
    { id: 'flush', name: '同花高手', desc: '做成同花或更大', ok: (p) => (p.bestHand || 0) >= 5, coins: 60000, diamonds: 6 },
    { id: 'allin10', name: '全下狂魔', desc: '全下 10 次', ok: (p) => (p.allinTotal || 0) >= 10, coins: 60000, diamonds: 6 },
    { id: 'streak5', name: '五连胜', desc: '连胜 5 手', ok: (p) => (p.bestStreak || 0) >= 5, coins: 80000, diamonds: 8 },
  ];
  function getAchievements() {
    return ACHV.map((a) => ({ id: a.id, name: a.name, desc: a.desc, unlocked: a.ok(profile), claimed: profile.achvClaimed.includes(a.id), coins: a.coins, diamonds: a.diamonds }));
  }
  function claimAchv(id) {
    const a = ACHV.find((x) => x.id === id); if (!a || !a.ok(profile) || profile.achvClaimed.includes(id)) return null;
    profile.achvClaimed.push(id); profile.coins += a.coins; profile.diamonds += a.diamonds; save();
    return { coins: a.coins, diamonds: a.diamonds };
  }
  function hasClaimable() {
    return getTasks().some((t) => t.done && !t.claimed) || getAchievements().some((a) => a.unlocked && !a.claimed) || getSeason().claimable
      || getEvents().some((e) => e.done && !e.claimed) || canDailyGift() || mailUnreadCount() > 0;
  }
  const HANDNAMES = ['高牌', '一对', '两对', '三条', '顺子', '同花', '葫芦', '四条', '同花顺'];
  function getStats() {
    const wr = profile.handsPlayed ? Math.round(profile.handsWon / profile.handsPlayed * 100) : 0;
    return { hands: profile.handsPlayed, wins: profile.handsWon, winrate: wr, biggest: profile.biggestPot, level: profile.level, bestStreak: profile.bestStreak || 0, allin: profile.allinTotal || 0, bestHand: HANDNAMES[profile.bestHand || 0] };
  }

  // 牌局复盘：记录每手牌(牌局编号、公共牌、手牌、决策序列与对错判定、结果)
  function nextHandNo() { profile.handSeq = (profile.handSeq || 0) + 1; return profile.handSeq; }
  function addHandRecord(rec) {
    if (!profile.handLog) profile.handLog = [];
    profile.handLog.unshift(rec);
    if (profile.handLog.length > HANDLOG_CAP) profile.handLog.length = HANDLOG_CAP;
    save();
  }
  function getHandLog() { return profile.handLog || []; }
  function clearHandLog() { profile.handLog = []; save(); }
  function toggleCoach() { profile.coachMode = !profile.coachMode; save(); return profile.coachMode; }

  // ---- 皇家赛季（免费 battle pass，按月）----
  function seasonIdNow() { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}`; }
  function seasonXpForLevel(l) { return 200 + l * 60; }
  function seasonReward(level) {
    // 原创奖励表：金币随等级递增，每 5 级钻石加成，里程碑大奖
    const coins = 12000 + level * 3000;
    let diamonds = 0;
    if (level % 10 === 0) diamonds = 20;
    else if (level % 5 === 0) diamonds = 8;
    else if (level % 2 === 0) diamonds = 2;
    return { coins, diamonds };
  }
  function seasonCheck() {
    const id = seasonIdNow();
    if (profile.seasonId !== id) { profile.seasonId = id; profile.seasonXp = 0; profile.seasonLevel = 1; profile.seasonClaimed = []; save(); }
  }
  function addSeasonXp(n) {
    seasonCheck();
    profile.seasonXp = (profile.seasonXp || 0) + n;
    while (profile.seasonLevel < SEASON_LEN && profile.seasonXp >= seasonXpForLevel(profile.seasonLevel)) {
      profile.seasonXp -= seasonXpForLevel(profile.seasonLevel); profile.seasonLevel++;
    }
    if (profile.seasonLevel >= SEASON_LEN) profile.seasonXp = 0;
    save();
  }
  function getSeason() {
    seasonCheck();
    const rewards = [];
    for (let l = 1; l <= SEASON_LEN; l++) {
      const r = seasonReward(l);
      rewards.push({ level: l, coins: r.coins, diamonds: r.diamonds, unlocked: l <= profile.seasonLevel, claimed: (profile.seasonClaimed || []).includes(l) });
    }
    return {
      id: profile.seasonId, level: profile.seasonLevel, xp: profile.seasonXp,
      need: profile.seasonLevel >= SEASON_LEN ? 0 : seasonXpForLevel(profile.seasonLevel),
      total: SEASON_LEN, rewards,
      claimable: rewards.some((r) => r.unlocked && !r.claimed),
    };
  }
  function claimSeason(level) {
    seasonCheck();
    level = +level;
    if (level > profile.seasonLevel) return null;
    if ((profile.seasonClaimed || []).includes(level)) return null;
    const r = seasonReward(level);
    profile.coins += r.coins; profile.diamonds += r.diamonds;
    profile.seasonClaimed = profile.seasonClaimed || []; profile.seasonClaimed.push(level);
    save();
    return r;
  }
  // 一键领取所有可领等级
  function claimSeasonAll() {
    seasonCheck();
    let coins = 0, diamonds = 0, n = 0;
    for (let l = 1; l <= profile.seasonLevel; l++) {
      if (!(profile.seasonClaimed || []).includes(l)) { const r = claimSeason(l); if (r) { coins += r.coins; diamonds += r.diamonds; n++; } }
    }
    return n ? { coins, diamonds, n } : null;
  }

  // ---- 限时活动（每日，条件达成可领，免费）----
  function getEvents() {
    dailyReset();
    const claimed = profile.eventClaimed || [];
    const defs = [
      { id: 'firstwin', name: '今日首胜', desc: '今日获胜 1 手', cur: () => profile.dWins || 0, goal: 1, coins: 50000, diamonds: 5 },
      { id: 'streak3', name: '三连胜挑战', desc: '今日达成 3 连胜', cur: () => profile.dMaxStreak || 0, goal: 3, coins: 60000, diamonds: 8 },
      { id: 'bighand', name: '同花及以上', desc: '今日打出同花或更大牌型', cur: () => profile.dBestHand || 0, goal: 5, coins: 80000, diamonds: 10 },
      { id: 'grind', name: '勤练 20 手', desc: '今日完成 20 手对局', cur: () => profile.dHands || 0, goal: 20, coins: 60000, diamonds: 6 },
    ];
    return defs.map((e) => { const c = e.cur(); return { id: e.id, name: e.name, desc: e.desc, cur: c, goal: e.goal, done: c >= e.goal, claimed: claimed.includes(e.id), coins: e.coins, diamonds: e.diamonds }; });
  }
  function claimEvent(id) {
    const e = getEvents().find((x) => x.id === id);
    if (!e || !e.done || e.claimed) return null;
    profile.coins += e.coins; profile.diamonds += e.diamonds;
    profile.eventClaimed = profile.eventClaimed || []; profile.eventClaimed.push(id); save();
    return { coins: e.coins, diamonds: e.diamonds };
  }

  // ---- 每日礼包（免费，每日一次）----
  function canDailyGift() { return profile.lastDailyGift !== todayStr(); }
  function claimDailyGift() {
    if (!canDailyGift()) return null;
    const coins = 30000 + Math.floor(Math.random() * 4) * 10000, diamonds = 3 + Math.floor(Math.random() * 4);
    profile.coins += coins; profile.diamonds += diamonds; profile.lastDailyGift = todayStr(); save();
    return { coins, diamonds };
  }

  // ---- 金库钱罐（每手累积，敲碎收取）----
  function addVault(pot) { profile.vault = (profile.vault || 0) + Math.max(300, Math.round((pot || 0) * 0.02)); save(); }
  function getVault() { return { amount: profile.vault || 0, min: VAULT_MIN, canCrack: (profile.vault || 0) >= VAULT_MIN, cracked: profile.vaultCracked || 0 }; }
  function crackVault() {
    if ((profile.vault || 0) < VAULT_MIN) return null;
    const got = profile.vault; profile.coins += got; profile.vault = 0; profile.vaultCracked = (profile.vaultCracked || 0) + 1; save();
    return { coins: got };
  }

  // ---- 邮件中心（本地，条件解锁，可领附件）----
  function getMail() {
    const claimed = profile.mailClaimed || [];
    const defs = [
      { id: 'welcome', title: '欢迎来到皇室德州训练场', body: '这是一款纯本地训练 App，所有筹码均为训练筹码。祝你练成高手！', coins: 50000, diamonds: 10, cond: () => true },
      { id: 'lv10', title: '段位新星', body: '恭喜达到 10 级，奖励已附上。', coins: 80000, diamonds: 8, cond: () => (profile.level || 1) >= 10 },
      { id: 'bigpot', title: '大底池纪念', body: '你赢下过 10 万以上的底池，收下这份纪念奖励。', coins: 100000, diamonds: 12, cond: () => (profile.biggestPot || 0) >= 100000 },
      { id: 'veteran', title: '百战礼包', body: '完成 100 手对局，老牌手的勋章奖励。', coins: 120000, diamonds: 15, cond: () => (profile.handsPlayed || 0) >= 100 },
    ];
    return defs.filter((m) => m.cond()).map((m) => ({ id: m.id, title: m.title, body: m.body, coins: m.coins, diamonds: m.diamonds, claimed: claimed.includes(m.id) }));
  }
  function claimMail(id) {
    const m = getMail().find((x) => x.id === id);
    if (!m || m.claimed) return null;
    profile.coins += m.coins; profile.diamonds += m.diamonds;
    profile.mailClaimed = profile.mailClaimed || []; profile.mailClaimed.push(id); save();
    return { coins: m.coins, diamonds: m.diamonds };
  }
  function mailUnreadCount() { return getMail().filter((m) => !m.claimed).length; }

  // ---- 段位（原创积分阶梯）----
  function rankInfo() {
    const pts = profile.rankPoints || 0;
    let idx = 0;
    for (let i = 0; i < RANK_TIERS.length; i++) if (pts >= RANK_TIERS[i].need) idx = i;
    const cur = RANK_TIERS[idx], next = RANK_TIERS[idx + 1];
    const progress = next ? Math.round((pts - cur.need) / (next.need - cur.need) * 100) : 100;
    return { idx, name: cur.name, points: pts, next: next ? next.name : null, toNext: next ? next.need - pts : 0, progress };
  }
  // 记录段位积分，返回是否晋升
  function recordRank(won) {
    const before = rankInfo().idx;
    profile.rankPoints = Math.max(0, (profile.rankPoints || 0) + (won ? 25 : -15));
    save();
    const after = rankInfo().idx;
    return after > before ? rankInfo().name : null;
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
    buyFrame: _frame.buy, setFrame: _frame.set,
    buyTitle: _title.buy, setTitle: _title.set,
    buyVehicle: _veh.buy, setVehicle: _veh.set,
    buyWatch: _watch.buy, setWatch: _watch.set,
    buyScene: _scene.buy, setScene: _scene.set,
    setMuted, recordHand, recordAllin, addXp, levelInfo,
    canSpin, doSpin, WHEEL,
    getTasks, claimTask, getAchievements, claimAchv, hasClaimable, getStats,
    nextHandNo, addHandRecord, getHandLog, clearHandLog, toggleCoach,
    addSeasonXp, getSeason, claimSeason, claimSeasonAll, rankInfo, recordRank,
    canDailyGift, claimDailyGift, addVault, getVault, crackVault,
    getMail, claimMail, mailUnreadCount, getEvents, claimEvent,
    CHECKIN,
  };
})();
