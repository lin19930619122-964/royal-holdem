/* types —— 常量与枚举（JS 运行期）+ JSDoc 类型说明。纯逻辑，无 UI。
 *
 * @typedef {{rank:number, suit:('s'|'h'|'d'|'c')}} Card
 * @typedef {{id:string, seat:number, stack:number, bet:number, totalBet:number,
 *            folded:boolean, allIn:boolean, sittingOut:boolean, hole:Card[],
 *            hasActed:boolean, lastAction:string, isHuman:boolean}} Player
 * @typedef {{config:object, players:Player[], button:number, sbIndex:number, bbIndex:number,
 *            deck:Card[], board:Card[], street:Street, current:number, currentBet:number,
 *            minRaise:number, lastRaiseSize:number, handNo:number, seed:number, rng:object,
 *            result:object|null, log:object[]}} TableState
 * @typedef {'idle'|'preflop'|'flop'|'turn'|'river'|'showdown'|'handover'} Street
 */
(function (root, factory) {
  const m = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = m;
  if (typeof window !== 'undefined') (window.RHCore = window.RHCore || {}).types = m;
})(this, function () {
  const SUITS = ['s', 'h', 'd', 'c'];
  const STREETS = ['preflop', 'flop', 'turn', 'river', 'showdown', 'handover'];
  const ACTIONS = { FOLD: 'fold', CHECK: 'check', CALL: 'call', BET: 'bet', RAISE: 'raise', ALLIN: 'allin' };
  const ACTION_TYPES = {
    PLAYER_ACTION: 'PLAYER_ACTION',
    DEAL_HOLE_CARDS: 'DEAL_HOLE_CARDS',
    DEAL_FLOP: 'DEAL_FLOP',
    DEAL_TURN: 'DEAL_TURN',
    DEAL_RIVER: 'DEAL_RIVER',
    SHOWDOWN: 'SHOWDOWN',
    START_NEXT_HAND: 'START_NEXT_HAND',
  };
  const CATEGORY = { HIGH: 0, PAIR: 1, TWO_PAIR: 2, TRIPS: 3, STRAIGHT: 4, FLUSH: 5, FULL_HOUSE: 6, QUADS: 7, STRAIGHT_FLUSH: 8 };
  const CATEGORY_NAME = ['高牌', '一对', '两对', '三条', '顺子', '同花', '葫芦', '四条', '同花顺'];
  return { SUITS, STREETS, ACTIONS, ACTION_TYPES, CATEGORY, CATEGORY_NAME };
});
