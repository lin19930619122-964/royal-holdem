/* 皇室德州 — 扑克核心引擎：牌、洗牌、牌型判定 */
(function () {
  const SUITS = ['s', 'h', 'd', 'c']; // 黑桃 红心 方块 梅花
  const SUIT_SYMBOL = { s: '♠', h: '♥', d: '♦', c: '♣' };
  const SUIT_RED = { h: true, d: true };
  const RANK_LABEL = {
    14: 'A', 13: 'K', 12: 'Q', 11: 'J', 10: '10',
    9: '9', 8: '8', 7: '7', 6: '6', 5: '5', 4: '4', 3: '3', 2: '2',
  };

  function createDeck() {
    const deck = [];
    for (const s of SUITS) {
      for (let r = 2; r <= 14; r++) {
        deck.push({ rank: r, suit: s });
      }
    }
    return deck;
  }

  function shuffle(deck) {
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
  }

  function cardLabel(card) {
    return RANK_LABEL[card.rank] + SUIT_SYMBOL[card.suit];
  }

  function isRed(card) {
    return !!SUIT_RED[card.suit];
  }

  /* 评估 5 张牌，返回可比较的分值数组：[类别, 主牌..., 踢脚...] */
  function evaluate5(cards) {
    const ranks = cards.map((c) => c.rank).sort((a, b) => b - a);
    const suits = cards.map((c) => c.suit);
    const isFlush = suits.every((s) => s === suits[0]);

    const uniq = [...new Set(ranks)].sort((a, b) => b - a);
    let straightHigh = 0;
    if (uniq.length === 5) {
      if (uniq[0] - uniq[4] === 4) straightHigh = uniq[0];
      else if (uniq[0] === 14 && uniq[1] === 5 && uniq[4] === 2) straightHigh = 5; // 轮子 A-2-3-4-5
    }

    const cnt = {};
    for (const r of ranks) cnt[r] = (cnt[r] || 0) + 1;
    const groups = Object.entries(cnt)
      .map(([r, c]) => ({ rank: +r, count: c }))
      .sort((a, b) => b.count - a.count || b.rank - a.rank);
    const counts = groups.map((g) => g.count);
    const isStraight = straightHigh > 0;

    if (isStraight && isFlush) return [8, straightHigh];
    if (counts[0] === 4) return [7, groups[0].rank, groups[1].rank];
    if (counts[0] === 3 && counts[1] === 2) return [6, groups[0].rank, groups[1].rank];
    if (isFlush) return [5, ...ranks];
    if (isStraight) return [4, straightHigh];
    if (counts[0] === 3) return [3, groups[0].rank, groups[1].rank, groups[2].rank];
    if (counts[0] === 2 && counts[1] === 2) return [2, groups[0].rank, groups[1].rank, groups[2].rank];
    if (counts[0] === 2) return [1, groups[0].rank, groups[1].rank, groups[2].rank, groups[3].rank];
    return [0, ...ranks];
  }

  function compareScores(a, b) {
    const len = Math.max(a.length, b.length);
    for (let i = 0; i < len; i++) {
      const x = a[i] || 0;
      const y = b[i] || 0;
      if (x !== y) return x - y;
    }
    return 0;
  }

  /* 从最多 7 张牌中取最优 5 张，返回 { score, cards } */
  function evaluateBest(cards) {
    if (cards.length <= 5) {
      return { score: evaluate5(cards), cards: cards.slice() };
    }
    const n = cards.length;
    let best = null;
    let bestCards = null;
    // 枚举所有 C(n,5) 组合
    for (let a = 0; a < n - 4; a++)
      for (let b = a + 1; b < n - 3; b++)
        for (let c = b + 1; c < n - 2; c++)
          for (let d = c + 1; d < n - 1; d++)
            for (let e = d + 1; e < n; e++) {
              const combo = [cards[a], cards[b], cards[c], cards[d], cards[e]];
              const sc = evaluate5(combo);
              if (best === null || compareScores(sc, best) > 0) {
                best = sc;
                bestCards = combo;
              }
            }
    return { score: best, cards: bestCards };
  }

  const CATEGORY_NAME = {
    0: '高牌', 1: '一对', 2: '两对', 3: '三条', 4: '顺子',
    5: '同花', 6: '葫芦', 7: '四条', 8: '同花顺',
  };

  function handName(score) {
    if (!score) return '';
    const cat = score[0];
    if (cat === 8 && score[1] === 14) return '皇家同花顺';
    return CATEGORY_NAME[cat] || '';
  }

  window.Poker = {
    SUITS, SUIT_SYMBOL, RANK_LABEL,
    createDeck, shuffle, cardLabel, isRed,
    evaluate5, evaluateBest, compareScores, handName,
  };
})();
