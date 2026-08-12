/**
 * 실제 DB의 업무 목록 조회 / 삭제
 *   조회: node manage-todos.js
 *   삭제: node manage-todos.js delete <id> [<id> ...]
 */
const fs = require('fs');
const cfg = fs.readFileSync('docs/firebase-config.js', 'utf8');
const pick = k => (cfg.match(new RegExp(k + ":\\s*'([^']+)'")) || [])[1];
const API_KEY = pick('apiKey');
const DB = pick('databaseURL').replace(/\/+$/, '');
const TEAM = (cfg.match(/TEAM_ID\s*=\s*'([^']+)'/) || [])[1];

(async () => {
  // 익명 인증
  const r = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${API_KEY}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ returnSecureToken: true }) });
  const auth = await r.json();
  if (!auth.idToken) { console.error('인증 실패:', auth.error && auth.error.message); process.exit(1); }
  const T = auth.idToken;

  const base = `${DB}/teams/${TEAM}`;
  const [todosRes, memRes] = await Promise.all([
    fetch(`${base}/todos.json?auth=${T}`),
    fetch(`${base}/members.json?auth=${T}`)
  ]);
  const todos = (await todosRes.json()) || {};
  const members = (await memRes.json()) || {};
  const nameOf = id => (members[id] && members[id].name) || (id ? id.slice(0, 6) + '…' : '미지정');

  const args = process.argv.slice(2);

  if (args[0] === 'delete') {
    const ids = args.slice(1);
    if (!ids.length) { console.error('삭제할 id를 지정하세요'); process.exit(1); }
    for (const id of ids) {
      const t = todos[id];
      if (!t) { console.log(`  건너뜀 (없음): ${id}`); continue; }
      const res = await fetch(`${base}/todos/${id}.json?auth=${T}`, { method: 'DELETE' });
      console.log(`  ${res.status === 200 ? '삭제됨' : '실패(' + res.status + ')'}: ` +
        `"${t.title}" (담당 ${nameOf(t.assigneeId)}, 시작 ${t.startDate || '-'}, 마감 ${t.dueDate || '-'})`);
    }
    const after = await (await fetch(`${base}/todos.json?auth=${T}`)).json();
    console.log(`\n남은 업무: ${after ? Object.keys(after).length : 0}건`);
    return;
  }

  const keys = Object.keys(todos);
  console.log(`\n등록된 업무 ${keys.length}건  (경로: teams/${TEAM}/todos)\n`);
  if (!keys.length) { console.log('  (없음)'); return; }
  keys.forEach(id => {
    const t = todos[id];
    console.log(`  id=${id}`);
    console.log(`     제목   : ${t.title}`);
    console.log(`     담당자 : ${nameOf(t.assigneeId)}`);
    console.log(`     시작일 : ${t.startDate || '(없음)'}   마감일: ${t.dueDate || '(없음)'}`);
    console.log(`     완료   : ${t.done ? 'Y' : 'N'}   지원필요: ${t.needSupport ? 'Y' : 'N'}`);
    console.log('');
  });
})().catch(e => { console.error('오류:', e.message); process.exit(1); });
