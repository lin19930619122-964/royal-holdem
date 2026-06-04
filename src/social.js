/* 桌面社交数据层（原创内容，不取自任何参考 App） */
(function () {
  // 快捷语：原创中文短语，按情绪分类
  const PHRASES = [
    { cat: '挑衅', items: ['这把跟到底', '别怂，加注啊', '就这点筹码？', '敢全下吗', '慢慢想，我等你'] },
    { cat: '夸赞', items: ['打得漂亮', '这手秀啊', '大佬带带我', '服气服气', '高手高手'] },
    { cat: '认怂', items: ['这把不跟了', '弃了弃了', '打不过你', '我先撤一手', '下把再战'] },
    { cat: '情绪', items: ['天啊这也行', '手气真旺', '就差一张', '心态崩了', '再来一把'] },
    { cat: '礼貌', items: ['手气不错', '承让承让', '多谢', '久仰大名', '后会有期'] },
  ];

  // 互动礼物：原创图标组合 + 价格(训练筹码) + 命中音类型
  const GIFTS = [
    { id: 'rose',    icon: '🌹', name: '玫瑰',   cost: 0,    sfx: 'soft' },
    { id: 'beer',    icon: '🍺', name: '啤酒',   cost: 0,    sfx: 'pop' },
    { id: 'rocket',  icon: '🚀', name: '火箭',   cost: 2000,  sfx: 'whoosh' },
    { id: 'bomb',    icon: '💣', name: '炸弹',   cost: 2000,  sfx: 'boom' },
    { id: 'crown',   icon: '👑', name: '皇冠',   cost: 8000,  sfx: 'fanfare' },
    { id: 'diamond', icon: '💎', name: '钻',     cost: 8000,  sfx: 'sparkle' },
  ];

  // AI 自动闲聊：行动时偶尔冒泡的原创短语
  const AI_CHATTER = {
    raise: ['加点压力', '跟得起吗', '我有牌', '上点强度'],
    allin: ['梭哈！', '全下，怕了？', '一把定输赢', '舍命陪君子'],
    fold:  ['不玩了', '让你一手', '没看上这牌', '保留实力'],
    win:   ['多谢送钱', '收下了', '运气而已', '承让'],
    lose:  ['再来！', '不服', '下把翻盘', '只是热身'],
  };

  function pickChatter(key) {
    const arr = AI_CHATTER[key];
    if (!arr || !arr.length) return null;
    return arr[Math.floor(Math.random() * arr.length)];
  }

  window.Social = { PHRASES, GIFTS, AI_CHATTER, pickChatter };
})();
