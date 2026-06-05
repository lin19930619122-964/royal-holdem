/* core/ai/types —— AI 决策枚举与常量（JS 运行期 + JSDoc）。纯逻辑，无 UI。
 *
 * PokerBrain 输入 DecisionContext：
 * @typedef {{
 *   holeCards:Card[], board:Card[], street:Street, position:Position,
 *   stack:number, effectiveStack:number, pot:number, amountToCall:number,
 *   currentBet:number, minRaiseTo:number, lastRaiseSize:number,
 *   playersInHand:number, activeOpponents:number,
 *   actionsThisStreet:Action[], previousActions:Action[], legalActions:LegalAction[],
 *   bigBlind:number, botProfile:BotProfile, seed?:number
 * }} DecisionContext
 *
 * PokerBrain 输出 Decision：
 * @typedef {{
 *   action:{type:string, amount?:number}, amount:number, confidence:number, reason:string,
 *   handClass:string, equity:number, potOdds:number, boardTexture:string, riskLevel:string,
 *   intent:string, reactionTimeMs:number, features:object
 * }} Decision
 */
(function (root, factory) {
  const m = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = m;
  if (typeof window !== 'undefined') (window.RHCore = window.RHCore || {}).AiTypes = m;
})(this, function () {
  // 6 个位置（含 9 人桌折叠为这 6 个语义位）
  const POSITIONS = ['UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB'];
  // 翻前起手分组
  const HAND_GROUPS = ['premium', 'strong', 'playable', 'speculative', 'trash'];
  // 翻后成牌类别（命名）
  const MADE = {
    NONE: 'none', PAIR_WEAK: 'weak_pair', SECOND_PAIR: 'second_pair', TOP_PAIR: 'top_pair',
    OVERPAIR: 'overpair', TWO_PAIR: 'two_pair', SET: 'set', TRIPS: 'trips',
    STRAIGHT: 'straight', FLUSH: 'flush', FULL_HOUSE: 'full_house', QUADS: 'quads', STRAIGHT_FLUSH: 'straight_flush',
  };
  const MADE_CN = {
    none: '未成牌', weak_pair: '弱对子', second_pair: '中对', top_pair: '顶对',
    overpair: '超对', two_pair: '两对', set: '暗三条', trips: '三条',
    straight: '顺子', flush: '同花', full_house: '葫芦', quads: '四条', straight_flush: '同花顺',
  };
  // 行动意图（用于复盘讲解）
  const INTENT = {
    VALUE: 'value', THIN_VALUE: 'thin_value', BLUFF: 'bluff', SEMI_BLUFF: 'semi_bluff',
    CHECK_CALL: 'check_call', CHECK_RAISE: 'check_raise', BLUFF_CATCH: 'bluff_catch',
    POT_CONTROL: 'pot_control', GIVE_UP: 'give_up', PREFLOP_OPEN: 'preflop_open',
    PREFLOP_3BET: 'preflop_3bet', PREFLOP_CALL: 'preflop_call', PREFLOP_FOLD: 'preflop_fold', PREFLOP_SHOVE: 'preflop_shove',
  };
  const INTENT_CN = {
    value: '价值下注', thin_value: '薄价值', bluff: '诈唬', semi_bluff: '半诈唬',
    check_call: '过牌跟注', check_raise: '过牌加注(check-raise)', bluff_catch: '抓诈唬',
    pot_control: '控池', give_up: '放弃', preflop_open: '翻前开池加注',
    preflop_3bet: '翻前再加注(3bet)', preflop_call: '翻前跟注', preflop_fold: '翻前弃牌', preflop_shove: '翻前全下',
  };
  const RISK = { LOW: 'low', MEDIUM: 'medium', HIGH: 'high' };
  const RISK_CN = { low: '低', medium: '中', high: '高' };
  return { POSITIONS, HAND_GROUPS, MADE, MADE_CN, INTENT, INTENT_CN, RISK, RISK_CN };
});
