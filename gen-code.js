/* 兑换码生成器
   用法:
     node gen-code.js coins 100000      生成 10 万金币码
     node gen-code.js diamonds 50        生成 50 钻石码
     node gen-code.js back dragon        生成"神龙"牌背皮肤码
     node gen-code.js felt night         生成"午夜紫"桌布皮肤码
     node gen-code.js coins 100000 5     一次生成 5 个不同的金币码
   生成的码可在 App「兑换码」里输入领取（每个码一次性）。 */
const Codec = require('./src/codec.js');

const TYPE_MAP = { coins: 'C', diamonds: 'D', back: 'B', felt: 'F' };
const args = process.argv.slice(2);
const kind = (args[0] || '').toLowerCase();
const value = args[1];
const count = parseInt(args[2], 10) || 1;

if (!TYPE_MAP[kind] || value === undefined) {
  console.log('用法: node gen-code.js <coins|diamonds|back|felt> <数量或皮肤id> [生成个数]');
  process.exit(1);
}

const type = TYPE_MAP[kind];
const val = (type === 'C' || type === 'D') ? parseInt(value, 10) : value;

// 用递增 nonce + 时间偏移制造不同的码（不依赖随机，便于复现）
const base = Date.now ? (Date.now() & 0xffffff) : 0;
console.log(`\n类型: ${kind}  内容: ${val}  共 ${count} 个\n`);
for (let i = 0; i < count; i++) {
  const nonce = (base + i * 7919) >>> 0;
  console.log('  ' + Codec.encode({ type, value: val }, nonce));
}
console.log('');
