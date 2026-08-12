/**
 * 실시간 동기화 검증
 *  - 가짜 Firebase 서버 하나를 두 클라이언트(브라우저 2개)가 공유
 *  - 한쪽 입력이 다른 쪽에 즉시 반영되는지 확인
 *  실행: node test-sync.js
 */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const { createFakeServer, makeFirebase, getPath } = require('./test-fake-firebase');

const html = fs.readFileSync(path.join('docs', 'index.html'), 'utf8');
const appJs = fs.readFileSync(path.join('docs', 'app.js'), 'utf8');
const dsJs = fs.readFileSync(path.join('docs', 'datastore.js'), 'utf8');

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { console.log('  PASS  ' + name); pass++; }
  else { console.log('  FAIL  ' + name + (extra ? ' -> ' + extra : '')); fail++; }
}
function sec(t) { console.log('\n=== ' + t + ' ==='); }
const tick = (ms = 5) => new Promise(r => setTimeout(r, ms));

const CLOUD_CFG = {
  apiKey: 'fake-key',
  authDomain: 'fake.firebaseapp.com',
  databaseURL: 'https://fake-rtdb.firebasedatabase.app',
  projectId: 'fake'
};

/** 브라우저 1개를 띄운다. fb 가 있으면 클라우드 모드 */
async function makeClient(label, fb, cfg, teamId) {
  const dom = new JSDOM(html, { runScripts: 'outside-only', url: 'https://example.com' });
  const w = dom.window;
  const store = {};
  Object.defineProperty(w, 'localStorage', {
    value: {
      getItem: k => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: k => { delete store[k]; },
      clear: () => { for (const k in store) delete store[k]; }
    }, configurable: true
  });
  w.alert = m => { w.__lastAlert = m; };
  w.confirm = () => true;
  w.print = () => {};
  if (!w.Element.prototype.matches) {
    w.Element.prototype.matches = function (s) {
      const a = (this.ownerDocument || w.document).querySelectorAll(s);
      for (let i = 0; i < a.length; i++) if (a[i] === this) return true;
      return false;
    };
  }
  if (!w.Element.prototype.closest) {
    w.Element.prototype.closest = function (s) {
      let e = this;
      while (e && e.nodeType === 1) { if (e.matches(s)) return e; e = e.parentElement; }
      return null;
    };
  }
  if (fb) w.firebase = fb;
  w.FIREBASE_CONFIG = cfg || { apiKey: '', authDomain: '', databaseURL: '', projectId: '' };
  w.TEAM_ID = teamId || 'packaging-tech';
  w.AUTH_MODE = cfg ? (cfg.__authMode || 'login') : undefined;

  w.eval(dsJs);
  w.eval(appJs);
  w.document.dispatchEvent(new w.Event('DOMContentLoaded', { bubbles: true }));
  await tick(15);

  return {
    label, w, store,
    D: w.document,
    click: sel => {
      const el = typeof sel === 'string' ? w.document.querySelector(sel) : sel;
      if (!el) throw new Error(`[${label}] 요소 없음: ${sel}`);
      el.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
    },
    nav: v => w.document.querySelector(`.nav-btn[data-view="${v}"]`)
      .dispatchEvent(new w.MouseEvent('click', { bubbles: true }))
  };
}

async function main() {
  // ==========================================================
  sec('1. 오프라인 모드 (설정 없음) - 기존 동작 유지');
  const off = await makeClient('offline', null, null);
  check('오프라인 모드로 판정', off.w.DataStore.mode === 'local', off.w.DataStore.mode);
  check('상태 표시 = 이 브라우저에만 저장',
    off.D.getElementById('conn-status').textContent.includes('이 브라우저'),
    off.D.getElementById('conn-status').textContent);
  check('오프라인 배너 표시', off.D.getElementById('offline-banner').hidden === false);
  check('로그인 모달 숨김', off.D.getElementById('modal-login').hidden === true);
  check('기본 팀원 6명 시드', off.w.DataStore.data.members.length === 6,
    'got=' + off.w.DataStore.data.members.length);
  check('주간표 6행 렌더', off.D.querySelectorAll('#sch-body tr').length === 6);

  off.click('#sch-body .att-mini');
  off.click('.sopt[data-status="휴가"]');
  off.click('#btn-status-save');
  await tick();
  check('오프라인 쓰기가 localStorage에 저장',
    !!off.store['ps2_sch'] && off.store['ps2_sch'].includes('휴가'));
  check('화면에 배지 반영', off.D.querySelector('#sch-body .att-mini.att-vac') !== null);
  check('Firebase 미사용 (SDK 없어도 정상)', off.w.DataStore.isCloud() === false);

  // ==========================================================
  sec('2. 클라우드 모드 + 로그인 게이트');
  const server = createFakeServer();
  const fbA = makeFirebase(server, { enforceAuth: true, users: { 'team@part.local': 'pw1234' } });
  const A = await makeClient('A', fbA, Object.assign({}, CLOUD_CFG));

  check('클라우드 모드로 판정', A.w.DataStore.mode === 'cloud', A.w.DataStore.mode);
  check('로그인 전 상태 = auth-required', A.w.DataStore.status === 'auth-required', A.w.DataStore.status);
  check('로그인 모달 표시', A.D.getElementById('modal-login').hidden === false);
  check('상태 표시 = 로그인 필요',
    A.D.getElementById('conn-status').textContent.includes('로그인'),
    A.D.getElementById('conn-status').textContent);
  check('오프라인 배너 숨김', A.D.getElementById('offline-banner').hidden === true);
  check('로그인 전에는 서버에 아무것도 안 씀',
    Object.keys(server.data).length === 0, JSON.stringify(Object.keys(server.data)));

  A.D.getElementById('login-email').value = 'team@part.local';
  A.D.getElementById('login-pw').value = 'wrong';
  A.click('#btn-login');
  await tick(15);
  check('잘못된 비밀번호 시 오류 표시',
    A.D.getElementById('login-err').hidden === false &&
    A.D.getElementById('login-err').textContent.includes('auth/invalid-credential'),
    A.D.getElementById('login-err').textContent);

  A.D.getElementById('login-pw').value = 'pw1234';
  A.click('#btn-login');
  await tick(25);
  check('로그인 성공 시 모달 닫힘', A.D.getElementById('modal-login').hidden === true);
  check('상태 = online', A.w.DataStore.status === 'online', A.w.DataStore.status);
  check('상태 표시 = 실시간 공유 중',
    A.D.getElementById('conn-status').textContent.includes('실시간'),
    A.D.getElementById('conn-status').textContent);
  check('기본 팀원이 서버에 시드됨',
    Object.keys(getPath(server.data, 'teams/packaging-tech/members') || {}).length === 6,
    'got=' + Object.keys(getPath(server.data, 'teams/packaging-tech/members') || {}).length);
  check('비밀번호 입력칸 비워짐(잔존 방지)', A.D.getElementById('login-pw').value === '');

  // ==========================================================
  sec('3. 두 명 동시 접속 - 실시간 반영');
  const fbB = makeFirebase(server, { enforceAuth: true, startSignedIn: true });
  const B = await makeClient('B', fbB, Object.assign({}, CLOUD_CFG, { __authMode: 'none' }));

  check('B도 클라우드 모드', B.w.DataStore.mode === 'cloud');
  check('B가 A의 팀원 데이터를 즉시 수신', B.w.DataStore.data.members.length === 6,
    'got=' + B.w.DataStore.data.members.length);
  check('B 주간표도 6행', B.D.querySelectorAll('#sch-body tr').length === 6);

  // A가 근태 입력 -> B 반영
  const aCell = A.D.querySelector('#sch-body .att-mini');
  const [aMid, aDate] = aCell.dataset.att.split('|');
  A.click(aCell);
  A.click('.sopt[data-status="출장"]');
  A.D.getElementById('status-note').value = '평택';
  A.click('#btn-status-save');
  await tick();

  check('A 화면에 출장 배지', A.D.querySelector('#sch-body .att-mini.att-trip') !== null);
  check('서버에 근태 저장',
    Object.values(getPath(server.data, 'teams/packaging-tech/schedules') || {})
      .some(s => s.status === '출장' && s.note === '평택'));
  check('★ B 화면에 새로고침 없이 반영',
    B.D.querySelector('#sch-body .att-mini.att-trip') !== null);
  const bSch = B.w.DataStore.data.schedules.find(s => s.memberId === aMid && s.date === aDate);
  check('B 데이터에도 동일 레코드', !!bSch && bSch.status === '출장' && bSch.note === '평택',
    JSON.stringify(bSch));

  // B가 할 일 추가 -> A 반영
  const bIds = B.w.DataStore.data.members.map(m => m.id);
  B.click('#btn-add-todo');
  B.D.getElementById('td-title').value = '낙하 시험 조건 검토';
  B.D.getElementById('td-assignee').value = bIds[1];
  B.D.getElementById('td-support').checked = true;
  B.D.getElementById('td-due').value = aDate;   // 요일 칸에 표시되도록 마감일 지정
  B.click('#btn-todo-save');
  await tick();

  check('B 화면에 할 일 표시', B.D.querySelector('#sch-body .dt') !== null);
  check('★ A 화면에도 즉시 표시', A.D.querySelector('#sch-body .dt') !== null);
  check('A 데이터에 할 일 수신',
    A.w.DataStore.data.todos.some(t => t.title === '낙하 시험 조건 검토'));
  check('지원필요 플래그도 전파', A.D.querySelector('#sch-body .dt.sup') !== null);

  // A가 완료 처리 -> B 반영
  A.click('#sch-body .dt-c');
  await tick();
  check('A에서 완료 처리',
    A.w.DataStore.data.todos.find(t => t.title === '낙하 시험 조건 검토').done === true);
  check('★ B에도 완료 상태 전파',
    B.w.DataStore.data.todos.find(t => t.title === '낙하 시험 조건 검토').done === true);
  check('B 화면 완료 스타일', B.D.querySelector('#sch-body .dt.done') !== null);

  // B가 공지 작성 -> A 반영
  B.nav('notice');
  B.click('#btn-add-notice');
  B.D.getElementById('nt-title').value = '금주 회의 15시';
  B.click('#btn-notice-save');
  await tick();
  check('B 공지 카드 생성', B.D.querySelectorAll('#notice-list .ncard').length === 1);
  check('★ A 공지 목록에도 즉시 반영',
    A.D.querySelectorAll('#notice-list .ncard').length === 1 &&
    A.D.querySelector('#notice-list h4').textContent === '금주 회의 15시',
    A.D.querySelectorAll('#notice-list .ncard').length + '건');

  // A가 팀원 추가 -> B 반영
  A.nav('members');
  A.click('#btn-add-member');
  A.D.getElementById('mb-name').value = '신입사원';
  A.click('#btn-member-save');
  await tick();
  check('A 팀원 7명', A.w.DataStore.data.members.length === 7);
  check('★ B도 팀원 7명', B.w.DataStore.data.members.length === 7,
    'got=' + B.w.DataStore.data.members.length);
  B.nav('week');
  check('B 주간표 7행으로 갱신', B.D.querySelectorAll('#sch-body tr').length === 7);

  // ==========================================================
  sec('4. 동시 수정 - 서로 덮어쓰지 않음 (레코드 단위 저장)');
  A.nav('week');
  const key = (m, d) => m + '|' + d;
  const used = new Set(A.w.DataStore.data.schedules.map(s => key(s.memberId, s.date)));
  const aPick = [...A.D.querySelectorAll('#sch-body .att-mini')]
    .map(c => c.dataset.att.split('|'))
    .find(([mid, ds]) => !used.has(key(mid, ds)));
  const aPickMid = aPick[0], aPickDate = aPick[1];
  // B가 고를 대상(다른 팀원)의 좌표만 미리 정해둔다 — 엘리먼트는 재렌더로 무효화되므로 매번 다시 조회
  const bPick = [...B.D.querySelectorAll('#sch-body .att-mini')]
    .map(c => c.dataset.att.split('|'))
    .find(([mid, ds]) => mid !== aPickMid && !used.has(key(mid, ds)));
  const bPickMid = bPick[0], bPickDate = bPick[1];

  A.click(`#sch-body .att-mini[data-att="${aPickMid}|${aPickDate}"]`);
  A.click('.sopt[data-status="교육"]');
  A.click('#btn-status-save');
  await tick();

  // A의 쓰기로 B의 표가 다시 그려졌으므로 셀을 새로 조회한다
  B.click(`#sch-body .att-mini[data-att="${bPickMid}|${bPickDate}"]`);
  check('B 근태 모달이 열림(대상 셀 유효)', B.D.getElementById('modal-status').hidden === false);
  B.click('.sopt[data-status="휴가"]');
  B.click('#btn-status-save');
  await tick();

  const allSch = Object.values(getPath(server.data, 'teams/packaging-tech/schedules') || {});
  check('A의 교육 입력 보존', allSch.some(s => s.status === '교육'));
  check('B의 휴가 입력 보존', allSch.some(s => s.status === '휴가'));
  check('A의 기존 출장도 보존', allSch.some(s => s.status === '출장'));
  check('★ 세 입력이 모두 살아있음 (덮어쓰기 없음)', allSch.length === 3,
    'count=' + allSch.length + ' ' + JSON.stringify(allSch.map(s => s.status)));
  check('잘못된 레코드(memberId 없음) 생성 안 됨',
    allSch.every(s => !!s.memberId && !!s.date),
    JSON.stringify(allSch.map(s => ({ m: s.memberId, d: s.date }))));
  check('A 화면에 B의 휴가도 보임', A.D.querySelector('#sch-body .att-mini.att-vac') !== null);
  check('B 화면에 A의 교육도 보임', B.D.querySelector('#sch-body .att-mini.att-edu') !== null);

  // ==========================================================
  sec('5. 삭제 전파');
  const delId = A.w.DataStore.data.todos[0].id;
  A.click('#sch-body .dt-t');
  A.click('#tasks-body [data-tk-del]');
  await tick();
  check('A에서 할 일 삭제', !A.w.DataStore.data.todos.some(t => t.id === delId));
  check('★ B에도 삭제 전파', !B.w.DataStore.data.todos.some(t => t.id === delId));
  check('서버에서도 제거',
    !Object.keys(getPath(server.data, 'teams/packaging-tech/todos') || {}).includes(delId));

  // 팀원 삭제 시 연관 데이터까지
  const victim = A.w.DataStore.data.members.find(m => m.name === '신입사원');
  A.nav('members');
  A.click(`[data-del-member="${victim.id}"]`);
  await tick(15);
  check('팀원 삭제 전파', !B.w.DataStore.data.members.some(m => m.id === victim.id));
  check('삭제된 팀원의 일정도 정리',
    !Object.values(getPath(server.data, 'teams/packaging-tech/schedules') || {})
      .some(s => s.memberId === victim.id));

  // ==========================================================
  sec('6. 네트워크 끊김 / 재연결');
  fbA._disconnect();
  await tick();
  check('끊기면 상태 = connecting', A.w.DataStore.status === 'connecting', A.w.DataStore.status);
  check('상태 표시가 재연결 중',
    A.D.getElementById('conn-status').textContent.includes('연결 중'),
    A.D.getElementById('conn-status').textContent);
  check('끊긴 동안에도 마지막 데이터 유지', A.w.DataStore.data.members.length === 6,
    'got=' + A.w.DataStore.data.members.length);
  check('localStorage 캐시 보유(오프라인 대비)',
    !!A.store['ps2_members'] && JSON.parse(A.store['ps2_members']).length === 6);
  fbA._reconnect();
  await tick();
  check('재연결 시 online 복귀', A.w.DataStore.status === 'online', A.w.DataStore.status);

  // ==========================================================
  sec('7. 세션 만료 시 재인증 게이트 (login 모드)');
  await A.w.DataStore.signOut();   // UI 버튼은 없음 - 세션 만료 상황을 API로 재현
  await tick(15);
  check('세션 끊기면 로그인 모달 재표시', A.D.getElementById('modal-login').hidden === false);
  check('상태 = auth-required', A.w.DataStore.status === 'auth-required', A.w.DataStore.status);

  // ==========================================================
  sec('8. TEAM_ID 로 파트 분리');
  const fbC = makeFirebase(server, { enforceAuth: false, startSignedIn: true });
  const C = await makeClient('C', fbC,
    Object.assign({}, CLOUD_CFG, { __authMode: 'none' }), 'other-part');
  check('다른 TEAM_ID는 데이터가 분리됨 (팀원 재시드)',
    getPath(server.data, 'teams/other-part/members') !== null);
  check('원래 팀 데이터는 그대로',
    Object.keys(getPath(server.data, 'teams/packaging-tech/members') || {}).length === 6,
    'got=' + Object.keys(getPath(server.data, 'teams/packaging-tech/members') || {}).length);
  check('원래 팀의 공지도 유지',
    Object.keys(getPath(server.data, 'teams/packaging-tech/notices') || {}).length === 1);

  // ==========================================================
  sec('9. 익명 인증 모드 (로그인 화면 없이 링크만 공유)');
  const srvA = createFakeServer();
  const fbAnon1 = makeFirebase(srvA, { enforceAuth: true });
  const N1 = await makeClient('anon1', fbAnon1,
    Object.assign({}, CLOUD_CFG, { __authMode: 'anonymous' }));

  check('로그인 화면이 뜨지 않음', N1.D.getElementById('modal-login').hidden === true);
  check('자동 인증되어 online', N1.w.DataStore.status === 'online', N1.w.DataStore.status);
  check('상태 표시 = 실시간 공유 중',
    N1.D.getElementById('conn-status').textContent.includes('실시간'),
    N1.D.getElementById('conn-status').textContent);
  check('익명 사용자로 인증됨', !!N1.w.DataStore.user && N1.w.DataStore.user.isAnonymous === true);
  check('로그아웃 버튼 자체가 제거됨', N1.D.getElementById('btn-logout') === null);
  check('백업/인쇄 버튼도 없음',
    N1.D.getElementById('btn-backup') === null &&
    N1.D.getElementById('btn-restore') === null &&
    N1.D.getElementById('btn-print') === null);
  check('기본 팀원이 서버에 시드됨',
    Object.keys(getPath(srvA.data, 'teams/packaging-tech/members') || {}).length === 6,
    'got=' + Object.keys(getPath(srvA.data, 'teams/packaging-tech/members') || {}).length);
  check('주간표 6행 렌더', N1.D.querySelectorAll('#sch-body tr').length === 6);

  // 두 번째 방문자도 로그인 없이 같은 데이터
  const fbAnon2 = makeFirebase(srvA, { enforceAuth: true });
  const N2 = await makeClient('anon2', fbAnon2,
    Object.assign({}, CLOUD_CFG, { __authMode: 'anonymous' }));
  check('두번째 접속자도 로그인 없이 진입', N2.D.getElementById('modal-login').hidden === true);
  check('두번째 접속자가 기존 데이터 수신', N2.w.DataStore.data.members.length === 6,
    'got=' + N2.w.DataStore.data.members.length);

  // 익명 모드에서도 실시간 전파
  N1.nav('week');
  N2.nav('week');
  N1.click('#sch-body .att-mini');
  N1.click('.sopt[data-status="교육"]');
  N1.click('#btn-status-save');
  await tick();
  check('★ 익명 모드에서도 실시간 전파',
    N2.D.querySelector('#sch-body .att-mini.att-edu') !== null);

  N2.click('#btn-add-todo');
  N2.D.getElementById('td-title').value = '익명 모드 업무';
  N2.D.getElementById('td-due').value = N2.D.querySelector('#sch-body .att-mini').dataset.att.split('|')[1];
  click2(N2);
  await tick();
  check('★ 반대 방향 전파도 정상',
    N1.w.DataStore.data.todos.some(t => t.title === '익명 모드 업무'));

  // ==========================================================
  sec('10. 익명 로그인 미설정 시 안내');
  const srvB = createFakeServer();
  const fbNoAnon = makeFirebase(srvB, { enforceAuth: true, anonymousDisabled: true });
  const NB = await makeClient('anon-off', fbNoAnon,
    Object.assign({}, CLOUD_CFG, { __authMode: 'anonymous' }));
  check('상태 = error', NB.w.DataStore.status === 'error', NB.w.DataStore.status);
  check('설정 안내 메시지 노출',
    NB.w.DataStore.statusMessage.includes('익명 로그인'),
    NB.w.DataStore.statusMessage);
  check('무한 재시도하지 않음', NB.w.DataStore._anonTried === true);

  console.log('\n' + '='.repeat(52));
  console.log(fail === 0 ? `동기화 테스트 전체 통과 ✅ (${pass}개)` : `${fail}개 실패 ❌ (통과 ${pass}개)`);
  console.log('='.repeat(52));
  process.exit(fail === 0 ? 0 : 1);
}

/** Todo 모달 저장 (담당자 기본 선택 사용) */
function click2(c) { c.click('#btn-todo-save'); }

main().catch(e => {
  console.error('\n테스트 실행 오류:', e && e.stack ? e.stack : e);
  process.exit(1);
});
