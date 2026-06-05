# 规则核心 src/core/poker —— UI 无关、reducer 驱动

纯逻辑德州扑克引擎。**不含任何 UI/DOM/网络**。所有状态变化只经 `GameReducer`。
（项目当前为免构建 PWA，浏览器直接加载 JS，故以 `.js` 编写——结构/命名与规范一致，可平移为 `.ts`。每个模块同时支持 Node `require` 与浏览器全局 `window.RHCore.*`。）

## 模块
| 文件 | 职责 |
|---|---|
| `types.js` | 常量/枚举（花色、街、动作、牌型）+ JSDoc 类型 |
| `SeededRng.js` | 可复现随机（mulberry32）+ Fisher-Yates 洗牌 |
| `Card.js` | 单牌构造/解析/展示 |
| `Deck.js` | 52 张标准牌 + 种子化洗牌 |
| `HandEvaluator.js` | 5 张评估 + 7 选 5；A2345 轮子；皇家同花顺最高 |
| `HandComparator.js` | 多人摊牌排名/分组 |
| `SidePot.js` | 主池/边池分层 + 按名次分配（含平分、零头规则） |
| `TableState.js` | 初始状态 + 座位顺序助手 |
| `LegalActions.js` | 当前行动者的合法动作与下注边界（最小加注/有效筹码/全下） |
| `GameReducer.js` | **唯一状态推进入口**（纯函数 reducer） |
| `HandHistory.js` | 每手完整结构化日志 |

## 用法（UI 只 dispatch + 渲染）
```js
const TableState = require('./TableState.js');
const { reducer } = require('./GameReducer.js');
const Legal = require('./LegalActions.js');

let state = TableState.create({ numPlayers: 6, smallBlind: 50, bigBlind: 100, ante: 0, startingStack: 10000, seed: 12345 });
state = reducer(state, { type: 'START_NEXT_HAND' });
state = reducer(state, { type: 'DEAL_HOLE_CARDS' });
// 轮到玩家时：用 Legal.forCurrent(state) 决定按钮可用性，再 dispatch：
state = reducer(state, { type: 'PLAYER_ACTION', playerId: 'p2', action: 'call' });
// 本街结束(state.current<0)后按 state.awaitingDeal 推进：
//   'DEAL_FLOP' | 'DEAL_TURN' | 'DEAL_RIVER' | 'SHOWDOWN'
while (!state.handOver && state.current < 0 && state.awaitingDeal) state = reducer(state, { type: state.awaitingDeal });
// state.result 为摊牌/结算结果；state.log 为完整手牌日志。
```

**铁律**：UI 不得直接改 `stack / pot / deck / board`。只能 `dispatch(action)` 后渲染返回的新 `state`。
`reducer` 不修改入参（返回新对象）；随机仅来自 `state.rng`（同 `seed` 完全可复现）。

## 全下自动跑牌
当可行动玩家 ≤1（其余全下/弃牌），`state.current` 置 -1 且 `state.awaitingDeal` 逐街推进；
直接 `dispatch SHOWDOWN` 也会自动补满公共牌再评定。

## 测试
`node test-core.js`（已并入 `npm test`）：53 项——52 牌唯一、种子可复现、轮子/皇家、
7 选 5、边池/平分/零头、合法动作门控、2/6/9 人自动跑一手筹码守恒、全下跑牌、完整日志。

## 迁移说明
现行牌桌仍用 `src/game.js`（可用、已大量实战）。本核心是**新的权威实现**，
下一步可在回归套件保护下把 `ui.js` 改为「dispatch + 渲染 state」，逐步替换 `game.js`。
