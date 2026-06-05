/* 离线缓存：网络优先（联网拿最新，断网才用缓存）— v6 修复白屏 */
const CACHE = 'royal-holdem-v42';
const ASSETS = [
  './', './index.html', './online.html', './styles.css',
  './codec.js', './skins.js', './store.js', './sound.js', './music.js', './voice.js', './fx.js', './social.js',
  './poker.js', './ai.js', './game.js', './router.js', './ui.js', './online.js',
  './core/poker/SeededRng.js', './core/poker/types.js', './core/poker/Card.js', './core/poker/Deck.js',
  './core/poker/HandEvaluator.js', './core/poker/HandComparator.js', './core/poker/SidePot.js',
  './core/poker/TableState.js', './core/poker/LegalActions.js', './core/poker/HandHistory.js',
  './core/poker/GameReducer.js', './core/poker/Equity.js', './core/poker/selectors.js',
  './core/ai/PokerBrain.js', './core/ai/BotDecisionEngine.js', './game/table/GameAdapter.js',
  './services/EventBus.js', './services/AudioManager.js', './services/GameFeelDirector.js',
  './manifest.webmanifest',
  './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  // 单个文件失败不阻断整体安装（用 allSettled 而非 addAll）
  e.waitUntil(
    caches.open(CACHE).then((c) =>
      Promise.allSettled(ASSETS.map((a) => c.add(a)))
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  // 网络优先：联网永远拿最新，成功后顺便更新缓存；失败（断网）才回退缓存
  e.respondWith(
    fetch(e.request).then((res) => {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {});
      return res;
    }).catch(() =>
      caches.match(e.request).then((hit) => hit || caches.match('./index.html'))
    )
  );
});
