/* 牌型评估测试 —— 覆盖必需用例 1~12。运行：node src/core/poker/__tests__/hand-evaluator.test.js */
const Card = require('../Card.js');
const HE = require('../HandEvaluator.js');
const { harness } = require('./_harness.js');
const { ok, eq, done } = harness('规则·牌型评估');

const C = (s) => s.split(' ').map(Card.parse);      // 'As Kd 9h' → [{rank,suit}...]
const sc = (s) => HE.evaluate5(C(s));               // 5 张评分
const best = (s) => HE.evaluateBest(C(s));          // ≤7 张取最佳
const gt = (a, b, m) => ok(HE.compare(sc(a), sc(b)) > 0, m);  // a 强于 b
const tie = (a, b, m) => ok(HE.compare(sc(a), sc(b)) === 0, m);

// 1) 高牌比较：踢脚定胜负
gt('Ah Kd 9s 6c 2h', 'Ah Kd 9s 5c 2h', '高牌：A K 9 6 2 > A K 9 5 2');
eq(sc('Ah Kd 9s 6c 2h')[0], 0, '高牌类别=0');

// 2) 一对比较：对子大小优先于踢脚；对子相同看踢脚
gt('Kh Kd 9s 6c 2h', 'Qh Qd As Kc 2h', '一对：KK > QQ（即便对方有 A 踢脚）');
gt('Kh Kd As 6c 2h', 'Ks Kc Qs 6d 2c', '一对相同：A 踢脚 > Q 踢脚');
eq(sc('Kh Kd 9s 6c 2h')[0], 1, '一对类别=1');

// 3) 两对比较：高对优先
gt('Ah Ad 5s 5c Kh', 'Kh Kd 9s 9c 2h', '两对：AA55 > KK99');
eq(sc('Ah Ad 5s 5c Kh')[0], 2, '两对类别=2');

// 4) 三条比较
gt('Kh Kd Ks 6c 2h', 'Qh Qd Qs Ac Kh', '三条：KKK > QQQ');
eq(sc('Kh Kd Ks 6c 2h')[0], 3, '三条类别=3');

// 5) 顺子比较
gt('Th 9d 8s 7c 6h', '9h 8d 7s 6c 5h', '顺子：T 高 > 9 高');
eq(sc('Th 9d 8s 7c 6h')[0], 4, '顺子类别=4');

// 6) A2345 轮子顺子
eq(sc('Ah 2d 3s 4c 5h')[0], 4, '轮子是顺子(类别4)');
eq(sc('Ah 2d 3s 4c 5h')[1], 5, '轮子高牌=5(非 A)');
gt('6h 5d 4s 3c 2h', 'Ah 2d 3s 4c 5h', '6 高顺 > 轮子(5 高)');
gt('Ah 2d 3s 4c 5h', 'Ah Kd Qs Jc 9h', '轮子(顺子) > 高牌 A');

// 7) 同花比较
gt('Ah Qh 9h 6h 2h', 'Kd Qd 9d 6d 2d', '同花：A 高 > K 高');
gt('Ah Qh 9h 6h 2h', 'Th 9d 8s 7c 6h', '同花 > 顺子');
eq(sc('Ah Qh 9h 6h 2h')[0], 5, '同花类别=5');

// 8) 葫芦比较
gt('Kh Kd Ks 2c 2h', 'Qh Qd Qs Ac Ah', '葫芦：KKK22 > QQQAA（三条大小优先）');
eq(sc('Kh Kd Ks 2c 2h')[0], 6, '葫芦类别=6');

// 9) 四条比较
gt('Kh Kd Ks Kc 2h', 'Qh Qd Qs Qc Ah', '四条：KKKK > QQQQ');
eq(sc('Kh Kd Ks Kc 2h')[0], 7, '四条类别=7');

// 10) 同花顺比较
gt('Th 9h 8h 7h 6h', '9h 8h 7h 6h 5h', '同花顺：T 高 > 9 高');
eq(sc('Th 9h 8h 7h 6h')[0], 8, '同花顺类别=8');
gt('Th 9h 8h 7h 6h', 'Ah Ad As Ac Kh', '同花顺 > 四条');

// 11) 皇家同花顺显示
eq(sc('Ah Kh Qh Jh Th')[0], 8, '皇家=同花顺类别8');
eq(sc('Ah Kh Qh Jh Th')[1], 14, '皇家高牌=14');
eq(HE.name(sc('Ah Kh Qh Jh Th')), '皇家同花顺', 'name 显示「皇家同花顺」');
eq(HE.name(sc('Kh Qh Jh Th 9h')), '同花顺', '非皇家同花顺显示「同花顺」');

// 12) 7 张牌选最佳 5 张
eq(best('As Ks Qs Js Ts 2c 3d').score[0], 8, '7张含皇家→选出同花顺');
eq(best('As Ks Qs Js Ts 2c 3d').score[1], 14, '7张→皇家高牌14');
eq(best('2h 5h 9h Kh Ah 3d 4c').score[0], 5, '7张→选出同花(忽略散牌)');
eq(best('Ah Ad Ks Kd Qc Qh 2s').score[0], 2, '7张三组对子→选出最强两对(AAKK)');
eq(best('Ah Ad Ks Kd Qc Qh 2s').score.slice(0, 3), [2, 14, 13], '两对取最高两对 AA/KK(踢脚 Q)');
eq(best('Ah Ad Ac Kd Kc 2h 3s').score[0], 6, '7张→AAA KK 选出葫芦');

done();
