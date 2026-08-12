/**
 * 실제 Firebase 프로젝트 연결 검증 (브라우저 없이 REST로 확인)
 *  1) 보안 규칙이 미인증 접근을 차단하는가
 *  2) 익명 인증이 켜져 있는가
 *  3) 인증 후 읽기/쓰기가 되는가
 *
 * 실행: node verify-live.js
 * ※ 토큰은 출력하지 않습니다.
 */
const fs = require('fs');

// docs/firebase-config.js 에서 값 추출
const cfgSrc = fs.readFileSync('docs/firebase-config.js', 'utf8');
const pick = k => (cfgSrc.match(new RegExp(k + ":\\s*'([^']+)'")) || [])[1];
const API_KEY = pick('apiKey');
const DB_URL = pick('databaseURL').replace(/\/+$/, '');
const TEAM = (cfgSrc.match(/TEAM_ID\s*=\s*'([^']+)'/) || [])[1];

let pass = 0, fail = 0, warn = 0;
const ok = (n, e) => { console.log('  PASS  ' + n + (e ? '  (' + e + ')' : '')); pass++; };
const no = (n, e) => { console.log('  FAIL  ' + n + (e ? '  -> ' + e : '')); fail++; };
const hm = (n, e) => { console.log('  WARN  ' + n + (e ? '  -> ' + e : '')); warn++; };

(async () => {
  console.log('\n대상 프로젝트: ' + DB_URL);
  console.log('데이터 경로  : teams/' + TEAM);

  // ---------- 1) 미인증 접근 차단 확인 ----------
  console.log('\n=== 1. 보안 규칙: 미인증 접근 차단 ===');
  let unauth;
  try {
    unauth = await fetch(`${DB_URL}/teams/${TEAM}/members.json`);
  } catch (e) {
    no('DB에 연결할 수 없음', e.message);
    return finish();
  }
  const unauthBody = await unauth.text();

  if (unauth.status === 401) {
    ok('미인증 읽기가 차단됨 (401 Permission denied)');
  } else if (unauth.status === 200) {
    if (unauthBody.trim() === 'null') {
      hm('규칙이 공개 상태일 수 있음 (200이지만 데이터 없음)',
        '규칙에 ".read": "auth != null" 이 적용됐는지 확인하세요');
    } else {
      no('⚠️ 누구나 데이터를 읽을 수 있음 - 규칙이 공개 상태입니다',
        '5번 보안 규칙을 다시 게시하세요');
    }
  } else {
    hm('예상치 못한 응답 코드', unauth.status + ' ' + unauthBody.slice(0, 120));
  }

  // ---------- 2) 익명 인증 확인 ----------
  console.log('\n=== 2. 익명 인증 사용 설정 확인 ===');
  let idToken = null;
  const signUp = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ returnSecureToken: true })
    }
  );
  const su = await signUp.json();

  if (signUp.ok && su.idToken) {
    idToken = su.idToken;
    ok('익명 인증 성공', 'uid=' + String(su.localId).slice(0, 6) + '…');
  } else {
    const code = su.error && su.error.message;
    if (code === 'ADMIN_ONLY_OPERATION') {
      no('익명 인증이 꺼져 있음',
        'Authentication → 로그인 방법 → 익명(Anonymous) 사용 설정 필요');
    } else if (code === 'OPERATION_NOT_ALLOWED') {
      no('익명 로그인 공급자가 활성화되지 않음', code);
    } else {
      no('익명 인증 실패', code || JSON.stringify(su).slice(0, 200));
    }
    return finish();
  }

  // ---------- 3) 인증 후 읽기 ----------
  console.log('\n=== 3. 인증 후 읽기 / 쓰기 ===');
  const authRead = await fetch(`${DB_URL}/teams/${TEAM}/members.json?auth=${idToken}`);
  const readBody = await authRead.text();
  if (authRead.status === 200) {
    ok('인증 후 읽기 성공');
    let n = 0;
    try { const j = JSON.parse(readBody); n = j ? Object.keys(j).length : 0; } catch (e) {}
    console.log('        현재 저장된 팀원 수: ' + n + '명' +
      (n === 0 ? ' (아직 아무도 접속하지 않음 - 정상)' : ''));
  } else {
    no('인증했는데도 읽기 실패', authRead.status + ' ' + readBody.slice(0, 160) +
      '\n        규칙의 경로가 teams/$teamId 구조인지 확인하세요');
    return finish();
  }

  // 쓰기 테스트 (임시 노드 생성 후 삭제)
  const probe = `${DB_URL}/teams/${TEAM}/_healthcheck.json?auth=${idToken}`;
  const put = await fetch(probe, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ at: new Date().toISOString(), by: 'verify-live' })
  });
  if (put.status === 200) {
    ok('인증 후 쓰기 성공');
    const del = await fetch(probe, { method: 'DELETE' });
    if (del.status === 200) ok('테스트 데이터 정리 완료');
    else hm('테스트 노드 삭제 실패 - 콘솔에서 _healthcheck 삭제 필요', del.status);
  } else {
    no('쓰기 실패', put.status + ' ' + (await put.text()).slice(0, 160));
  }

  finish();

  function finish() {
    console.log('\n' + '='.repeat(52));
    if (fail === 0 && warn === 0) console.log(`실제 연결 검증 통과 ✅ (${pass}개)`);
    else if (fail === 0) console.log(`통과 ${pass}개 / 확인 필요 ${warn}개 ⚠️`);
    else console.log(`실패 ${fail}개 ❌ (통과 ${pass}개)`);
    console.log('='.repeat(52));
    process.exit(fail === 0 ? 0 : 1);
  }
})().catch(e => { console.error('검증 오류:', e.message); process.exit(1); });
