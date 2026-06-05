/* BoardTextureDescriber —— 公共牌面多维描述：花色形态 + 干湿 + 高低 + 连接/对子 + 听牌可能。
   输出如 "rainbow dry q-high disconnected"（+ 结构化对象 + 中文）。纯逻辑，无 UI。 */
(function (root, factory) {
  const req = (typeof require !== 'undefined');
  const BoardTexture = req ? require('./BoardTexture.js') : window.RHCore.BoardTexture;
  const m = factory(BoardTexture);
  if (typeof module !== 'undefined' && module.exports) module.exports = m;
  if (typeof window !== 'undefined') (window.RHCore = window.RHCore || {}).BoardTextureDescriber = m;
})(this, function (BoardTexture) {
  const RANK_CH = { 14: 'a', 13: 'k', 12: 'q', 11: 'j', 10: 't', 9: '9', 8: '8', 7: '7', 6: '6', 5: '5', 4: '4', 3: '3', 2: '2' };
  const RANK_CN = { 14: 'A', 13: 'K', 12: 'Q', 11: 'J', 10: 'T', 9: '9', 8: '8', 7: '7', 6: '6', 5: '5', 4: '4', 3: '3', 2: '2' };
  function describe(board) {
    if (!board || board.length < 3) return { text: 'preflop', cn: '翻前无公共牌', tokens: [], suitPattern: 'n/a', wetnessTier: 'n/a', highLabel: 'n/a', connectivity: 'n/a', paired: false, flushDrawPossible: false, straightDrawPossible: false };
    const t = BoardTexture.analyze(board);
    const suitPattern = t.monotone ? 'monotone' : t.twoTone ? 'two-tone' : 'rainbow';
    const wetnessTier = t.wetness >= 60 ? 'wet' : t.wetness >= 30 ? 'semi-wet' : 'dry';
    const topRank = Math.max.apply(null, board.map((c) => c.rank));
    const broadway = board.filter((c) => c.rank >= 10).length;
    const highLabel = broadway >= 2 ? 'broadway-heavy' : (topRank >= 11 ? RANK_CH[topRank] + '-high' : (topRank <= 9 ? 'low-card' : RANK_CH[topRank] + '-high'));
    const connectivity = t.paired ? 'paired' : (t.straightConnected ? 'connected' : 'disconnected');
    const flushDrawPossible = t.twoTone || t.monotone;
    const straightDrawPossible = t.straightConnected;
    const tokens = [suitPattern, wetnessTier, (topRank >= 11 ? RANK_CH[topRank] + '-high' : 'low-card'), connectivity];
    if (broadway >= 2) tokens.push('broadway-heavy');
    if (flushDrawPossible) tokens.push('fd');
    if (straightDrawPossible) tokens.push('sd');
    const text = tokens.slice(0, 4).join(' ');
    // 中文
    const cnSuit = { rainbow: '彩虹', 'two-tone': '两同花', monotone: '单色' }[suitPattern];
    const cnWet = { dry: '干燥', 'semi-wet': '半湿', wet: '湿润' }[wetnessTier];
    const cnConn = { paired: '对子面', connected: '连接面', disconnected: '不连接' }[connectivity];
    const cn = `${cnSuit} ${cnWet} ${RANK_CN[topRank]} 高 ${cnConn}`;
    return { text, cn, tokens, suitPattern, wetnessTier, highLabel, connectivity, paired: t.paired, flushDrawPossible, straightDrawPossible, wetness: t.wetness, topRank };
  }
  return { describe };
});
