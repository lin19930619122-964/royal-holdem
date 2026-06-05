/* 最小测试骨架（无第三方框架，Node 直接跑）。每个测试文件 require 它，失败则进程退出码非 0。 */
function harness(name) {
  let pass = 0, fail = 0;
  const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.log('  ✗ ' + msg); } };
  const eq = (got, want, msg) => ok(JSON.stringify(got) === JSON.stringify(want),
    `${msg}  (got=${JSON.stringify(got)} want=${JSON.stringify(want)})`);
  const done = () => { console.log(`\n${name}: ${pass} 通过, ${fail} 失败`); process.exit(fail ? 1 : 0); };
  return { ok, eq, done };
}
module.exports = { harness };
