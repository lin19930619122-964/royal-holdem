/* PreflopMatrix —— 169 手起手分组 + 位置修正评分。纯逻辑，无 UI。
   分组：premium / strong / playable / speculative / trash。 */
(function (root, factory) {
  const m = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = m;
  if (typeof window !== 'undefined') (window.RHCore = window.RHCore || {}).PreflopMatrix = m;
})(this, function () {
  const PREMIUM = new Set(['AA', 'KK', 'QQ', 'JJ', 'AKs', 'AKo']);
  const STRONG = new Set(['TT', '99', 'AQs', 'AQo', 'AJs', 'KQs']);
  const PLAYABLE = new Set(['88', '77', '66', 'ATs', 'KJs', 'KTs', 'QJs', 'QTs', 'JTs', 'T9s', '98s', 'AJo', 'KQo']);
  const SPECULATIVE = new Set(['55', '44', '33', '22', 'A2s', 'A3s', 'A4s', 'A5s', 'A6s', 'A7s', 'A8s', 'A9s', 'K9s', 'Q9s', 'J9s', 'T8s', '97s', '87s', '76s', '65s', '54s']);
  const RANK_CHAR = { 14: 'A', 13: 'K', 12: 'Q', 11: 'J', 10: 'T', 9: '9', 8: '8', 7: '7', 6: '6', 5: '5', 4: '4', 3: '3', 2: '2' };
  const RANK_VALUE = { A: 14, K: 13, Q: 12, J: 11, T: 10, '9': 9, '8': 8, '7': 7, '6': 6, '5': 5, '4': 4, '3': 3, '2': 2 };
  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

  function handCode(a, b) {
    const hi = a.rank >= b.rank ? a : b, lo = a.rank >= b.rank ? b : a;
    const r1 = RANK_CHAR[hi.rank], r2 = RANK_CHAR[lo.rank];
    if (hi.rank === lo.rank) return `${r1}${r2}`;
    return `${r1}${r2}${hi.suit === lo.suit ? 's' : 'o'}`;
  }
  function preflopClass(code) {
    if (PREMIUM.has(code)) return 'premium';
    if (STRONG.has(code)) return 'strong';
    if (PLAYABLE.has(code)) return 'playable';
    if (SPECULATIVE.has(code)) return 'speculative';
    return 'trash';
  }
  function basePreflopScore(code) {
    const cls = preflopClass(code);
    const pair = code.length === 2 && code[0] === code[1];
    if (cls === 'premium') return 92;
    if (cls === 'strong') return 78;
    if (cls === 'playable') return 61;
    if (cls === 'speculative') return pair ? 48 : 42;
    const r1 = RANK_VALUE[code[0]], r2 = RANK_VALUE[code[1]];
    const suited = code.endsWith('s'), gap = Math.abs(r1 - r2) - 1;
    let score = (r1 + r2) * 1.7 + (suited ? 6 : 0) - Math.max(0, gap) * 3;
    if (r1 === 14) score += 4;
    if (r2 <= 5 && r1 < 12) score -= 6;
    return clamp(score, 5, 55);
  }
  // 6 位语义：UTG/HJ/CO/BTN/SB/BB（MP 视为 HJ）
  function positionBonus(pos) {
    switch (pos) {
      case 'UTG': return -10; case 'HJ': case 'MP': return -4;
      case 'CO': return 4; case 'BTN': return 10; case 'SB': return -3; case 'BB': return 2; default: return 0;
    }
  }
  function classifyPreflop(holeCards, ctx) {
    const code = handCode(holeCards[0], holeCards[1]);
    const cls = preflopClass(code);
    let score = basePreflopScore(code);
    if (ctx) {
      score += positionBonus(ctx.position);
      if (ctx.amountToCall > 0) score -= 8;
      if (ctx.previousActions && ctx.previousActions.some((a) => a.action && a.action.type === 'raise')) score -= 10;
    }
    score = clamp(score, 0, 100);
    const openRaiseWeight = clamp((score - 42) / 42, 0, 1);
    const callWeight = clamp((score - 30) / 50, 0, 1);
    const threeBetWeight = clamp((score - 70) / 25, 0, 1);
    const fourBetWeight = clamp((score - 84) / 16, 0, 1);
    const jamWeight = clamp((score - 88) / 14, 0, 1);
    const foldWeight = clamp((55 - score) / 55, 0, 1);
    return { code, handClass: cls, baseScore: score, openRaiseWeight, callWeight, threeBetWeight, fourBetWeight, jamWeight, foldWeight, explanation: `${code} 属于${cls}，位置与前序行动修正后评分 ${Math.round(score)}/100。` };
  }
  return { PREMIUM, STRONG, PLAYABLE, SPECULATIVE, RANK_CHAR, RANK_VALUE, handCode, preflopClass, basePreflopScore, positionBonus, classifyPreflop };
});
