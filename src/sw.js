/* 离线缓存：网络优先（联网拿最新，断网才用缓存）— v6 修复白屏 */
const CACHE = 'royal-holdem-v49';
const ASSETS = [
  './', './index.html', './online.html', './styles.css',
  './codec.js', './skins.js', './store.js', './sound.js', './music.js', './voice.js', './fx.js', './social.js',
  './poker.js', './ai.js', './game.js', './router.js', './ui.js', './online.js',
  './core/poker/SeededRng.js', './core/poker/types.js', './core/poker/Card.js', './core/poker/Deck.js',
  './core/poker/HandEvaluator.js', './core/poker/HandComparator.js', './core/poker/SidePot.js',
  './core/poker/TableState.js', './core/poker/LegalActions.js', './core/poker/HandHistory.js',
  './core/poker/GameReducer.js', './core/poker/Equity.js', './core/poker/selectors.js',
  './core/ai/types.js', './core/ai/BotProfiles.js', './core/ai/BotProfile.js', './core/ai/PreflopMatrix.js',
  './core/ai/BoardTexture.js', './core/ai/EquityCalculator.js', './core/ai/HandClassDescriber.js', './core/ai/BoardTextureDescriber.js', './core/ai/ActionHistoryFormatter.js', './core/ai/DecisionReasonFormatter.js', './core/ai/PostflopHeuristics.js',
  './core/ai/PokerBrain.js', './core/ai/OpponentModel.js', './core/ai/BotDecisionEngine.js', './game/table/GameAdapter.js',
  './services/EventBus.js', './services/AudioManager.js', './services/GameFeelDirector.js',
  './core/Lessons.js',
  './gamefeel/GameFeelEvent.js', './gamefeel/GameFeelConfig.js', './gamefeel/TableAnimationQueue.js', './gamefeel/HapticDirector.js',
  './gamefeel/ChipFlyAnimator.js', './gamefeel/CardDealAnimator.js', './gamefeel/PotWinAnimator.js', './gamefeel/HighlightDirector.js', './gamefeel/GameFeelDirector.js',
  './view/table/SeatView.js', './view/table/ActionPanel.js', './view/table/PlayerViewModel.js', './view/table/TableScene.js',
  './view/table/layers/_base.js', './view/table/layers/TableBackgroundLayer.js', './view/table/layers/TableFeltLayer.js', './view/table/layers/SeatLayer.js',
  './view/table/layers/DealerButtonLayer.js', './view/table/layers/CommunityCardLayer.js', './view/table/layers/PotLayer.js', './view/table/layers/BetChipLayer.js',
  './view/table/layers/PlayerHandLayer.js', './view/table/layers/ActionPanelLayer.js', './view/table/layers/TrainingAssistantLayer.js', './view/table/layers/ChatEmojiLayer.js',
  './view/table/layers/GiftAnimationLayer.js', './view/table/layers/HistoryLayer.js', './view/table/layers/ModalLayer.js',
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
