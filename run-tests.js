const { execSync } = require('child_process');
const suites = ['test-app.js', 'test-sync.js'];
let allOk = true;

suites.forEach(s => {
  let out = '', code = 0;
  try { out = execSync('node ' + s, { encoding: 'utf8' }); }
  catch (e) { out = (e.stdout || '') + '\n' + (e.stderr || ''); code = e.status || 1; }
  const p = (out.match(/PASS/g) || []).length;
  const f = (out.match(/FAIL/g) || []).length;
  console.log(`\n### ${s}  ->  PASS=${p} FAIL=${f} exit=${code}`);
  let section = '';
  out.split(/\r?\n/).forEach(l => {
    if (l.trim().startsWith('===')) section = l.replace(/=/g, '').trim();
    if (l.includes('FAIL')) console.log(`   [${section}] ${l.trim()}`);
  });
  if (out.includes('테스트 실행 오류') || out.includes('TypeError') || out.includes('ReferenceError')) {
    console.log('   !! 실행 중 예외 발생:');
    out.split(/\r?\n/).filter(l => /Error|at Object|요소 없음/.test(l)).slice(0, 8)
      .forEach(l => console.log('      ' + l.trim()));
  }
  if (code !== 0 || f > 0) allOk = false;
});

console.log('\n' + '='.repeat(52));
console.log(allOk ? '전체 스위트 통과 ✅' : '실패 있음 ❌');
console.log('='.repeat(52));
process.exit(allOk ? 0 : 1);
