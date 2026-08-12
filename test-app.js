/**
 * 패키징기술파트 Schedule - 기능 테스트 (jsdom)
 * 실행: node test-app.js   (종료코드 0 = 전체 통과)
 */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const html = fs.readFileSync(path.join('docs', 'index.html'), 'utf8');
const appJs = fs.readFileSync(path.join('docs', 'app.js'), 'utf8');
const dsJs = fs.readFileSync(path.join('docs', 'datastore.js'), 'utf8');
const css = fs.readFileSync(path.join('docs', 'style.css'), 'utf8');

let failures = 0, passes = 0;
function check(name, cond, extra) {
  if (cond) { console.log('  PASS  ' + name); passes++; }
  else { console.log('  FAIL  ' + name + (extra ? ' -> ' + extra : '')); failures++; }
}
function sec(t) { console.log('\n=== ' + t + ' ==='); }

const dom = new JSDOM(html, { runScripts: 'outside-only', url: 'https://example.com' });
const { window } = dom;
const store = {};
Object.defineProperty(window, 'localStorage', {
  value: {
    getItem: k => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: k => { delete store[k]; },
    clear: () => { for (const k in store) delete store[k]; }
  }, configurable: true
});
window.alert = () => {};
window.confirm = () => true;
window.print = () => {};

// jsdom 11 lacks Element.closest/matches (all browsers have them) -> polyfill for the harness
if (!window.Element.prototype.matches) {
  window.Element.prototype.matches = function (s) {
    const a = (this.ownerDocument || window.document).querySelectorAll(s);
    for (let i = 0; i < a.length; i++) if (a[i] === this) return true;
    return false;
  };
}
if (!window.Element.prototype.closest) {
  window.Element.prototype.closest = function (s) {
    let e = this;
    while (e && e.nodeType === 1) { if (e.matches(s)) return e; e = e.parentElement; }
    return null;
  };
}

const tick = (ms = 5) => new Promise(r => setTimeout(r, ms));

window.eval(dsJs);
window.eval(appJs);
window.document.dispatchEvent(new window.Event('DOMContentLoaded', { bubbles: true }));
const D = window.document;
const click = el => el.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
const nav = v => click(D.querySelector(`.nav-btn[data-view="${v}"]`));
const memberIds = () => JSON.parse(store['ps2_members']).map(m => m.id);
const todosOf = () => JSON.parse(store['ps2_todos']);

async function main() {
await tick(15);   // DataStore 초기화 + 기본 팀원 시드 완료 대기

sec('0. 저장 모드 (설정 없으면 오프라인)');
check('오프라인(local) 모드', window.DataStore.mode === 'local', window.DataStore.mode);
check('오프라인 배너 표시', D.getElementById('offline-banner').hidden === false);
check('로그인 모달 숨김', D.getElementById('modal-login').hidden === true);

sec('1. 메뉴 순서 (공지 > 월간 > 주간 > 대시보드 > 팀원 > 가이드)');
const navOrder = [...D.querySelectorAll('.nav .nav-btn')].map(b => b.dataset.view);
check('순서 정확', JSON.stringify(navOrder) ===
  JSON.stringify(['notice', 'month', 'week', 'dashboard', 'members', 'guide']),
  JSON.stringify(navOrder));
const navLabels = [...D.querySelectorAll('.nav .nav-btn')].map(b => b.textContent.trim());
check('첫 항목이 공지사항', navLabels[0].includes('공지사항'), navLabels[0]);
check('두번째가 월간 근태', navLabels[1].includes('월간'), navLabels[1]);
check('세번째가 주간 스케줄(To do)', navLabels[2].includes('주간 스케줄(To do)'), navLabels[2]);

sec('2. 기본 진입 화면 = 공지사항');
check('공지 뷰가 활성', D.getElementById('view-notice').classList.contains('active'));
check('공지 메뉴가 활성', D.querySelector('.nav-btn[data-view="notice"]').classList.contains('active'));
check('활성 뷰는 1개만', D.querySelectorAll('.view.active').length === 1);
check('활성 메뉴는 1개만', D.querySelectorAll('.nav-btn.active').length === 1);

sec('3. 폰트 크기');
check('html 기준 16px', /html\{font-size:16px\}/.test(css));
check('본문 1rem', /body\{[^}]*font-size:1rem/.test(css));
check('rem 단위 사용(고정 px 최소화)', (css.match(/font-size:\.?\d*\.?\d*rem/g) || []).length > 20);


sec('4. 주간 스케줄 구조 (요일 칸에 업무 배치)');
nav('week');
check('주간 뷰 활성', D.getElementById('view-week').classList.contains('active'));
const wkHeads = [...D.querySelectorAll('.wk-table thead th')].map(t => t.textContent.trim().split('\n')[0]);
check('헤더 6열 (팀원+5일)', wkHeads.length === 6, JSON.stringify(wkHeads));
check('할 일 컬럼 없음', !wkHeads.some(h => h.includes('할 일')), JSON.stringify(wkHeads));
check('진행률 컬럼 없음', !wkHeads.some(h => h.includes('진행률')), JSON.stringify(wkHeads));
check('하단 전체 진행률 바 제거', D.getElementById('todo-prog') === null &&
  D.getElementById('todo-pct') === null && D.getElementById('todo-cnt') === null);
check('기본 팀원 6행', D.querySelectorAll('#sch-body tr').length === 6);
check('행마다 6칸', [...D.querySelectorAll('#sch-body tr')].every(r => r.children.length === 6));
check('요일 칸 5개/행', D.querySelector('#sch-body tr').querySelectorAll('td.w-cell').length === 5);
check('요일 칸에 업무 목록 컨테이너', D.querySelector('#sch-body td.w-cell .dc-list') !== null);
check('요일 칸에 업무 추가 버튼', D.querySelector('#sch-body td.w-cell .dc-add') !== null);
check('팀원칸에 직책 표시', D.querySelector('#sch-body .wk-mem-p') !== null);
check('요일 칸 높이 확대 CSS', /\.wk-table td\.w-cell\{[^}]*height:106px/.test(css));
check('요일 열 폭 확대 CSS', /\.wk-table th\.w-day\{[^}]*min-width:148px/.test(css));

sec('5. 범례: 표 위 + 축소');
const legend = D.querySelector('#view-week .legend-top');
const wtable = D.querySelector('#view-week .wk-table');
check('범례 존재', legend !== null);
check('범례가 표보다 위에 위치',
  legend.compareDocumentPosition(wtable) & window.Node.DOCUMENT_POSITION_FOLLOWING);
check('범례 폰트 축소(.75rem)', /\.legend-top\{[^}]*font-size:\.75rem/.test(css));
check('범례 칩 축소(.6875rem)', /\.legend-top \.chip\.xs\{[^}]*font-size:\.6875rem/.test(css));
check('범례 패딩 축소', /\.legend-top\{[^}]*padding:6px 10px/.test(css));
check('범례에 출근 항목 없음(표시하지 않으므로)', legend.querySelector('.work-dot') === null);
check('4가지 근태 칩 포함', legend.querySelectorAll('.chip').length === 4);
check('구버전 큰 범례 미사용', D.querySelector('#view-week .legend') === null);

sec('6. 근태 표시: 출근은 표시하지 않음');
check('출근 칩이 하나도 없음', D.querySelectorAll('#sch-body .att-mini').length === 0,
  'count=' + D.querySelectorAll('#sch-body .att-mini').length);
check('att-work 클래스 자체가 제거됨', !/\.att-work\{/.test(css));
const ghosts = D.querySelectorAll('#sch-body .att-ghost');
check('대신 근태 입력 버튼 30개(호버 시 표시)', ghosts.length === 30, 'count=' + ghosts.length);
check('평상시 숨김 처리(opacity:0)', /\.att-ghost\{[^}]*opacity:0/.test(css));
check('칸 호버 시 노출 규칙', /td\.w-cell:hover \.att-ghost\{opacity:1\}/.test(css));
check('범례에서 출근 항목 제거', D.querySelector('#view-week .legend-top .work-dot') === null);

// 근태 입력 -> 칩 생성
click(ghosts[0]);
check('근태 버튼 클릭 시 모달', D.getElementById('modal-status').hidden === false);
click(D.querySelector('.sopt[data-status="출장"]'));
D.getElementById('status-note').value = '평택 출장';
click(D.getElementById('btn-status-save'));
check('출장 칩 생성', D.querySelector('#sch-body .att-mini.att-trip') !== null);
check('출장 칩은 1개만', D.querySelectorAll('#sch-body .att-mini').length === 1);
check('메모 있으면 * 표시', D.querySelector('#sch-body .att-mini.att-trip').textContent.includes('*'));
check('근태 버튼은 29개로 감소', D.querySelectorAll('#sch-body .att-ghost').length === 29);
check('저장소 반영', store['ps2_sch'].includes('평택 출장'));

click(D.querySelector('#sch-body .att-mini.att-trip'));
check('되돌리기 버튼 노출', D.getElementById('btn-status-clear').hidden === false);
click(D.getElementById('btn-status-clear'));
check('출근으로 되돌리면 칩 사라짐', D.querySelectorAll('#sch-body .att-mini').length === 0);
check('근태 버튼 30개로 복귀', D.querySelectorAll('#sch-body .att-ghost').length === 30);

sec('7. 요일 칸에 업무 배치 / 완료 / 상세');
const ids0 = memberIds();
const LONG = '포장 낙하 시험 조건 재검토 및 사양서 개정 작업 진행 필요';
const LONGDESC = '상세 설명 본문입니다.\n두번째 줄입니다.';

// 이번 주 월/화 날짜
const wkDates = [...D.querySelectorAll('#sch-body tr:first-child td.w-cell')]
  .map(c => c.dataset.add.split('|')[1]);
const MON = wkDates[0], TUE = wkDates[1];

function addTodoUI({ title, mid, priority = 'medium', support = false, desc = '', start = '', due = '' }) {
  click(D.getElementById('btn-add-todo'));
  D.getElementById('td-title').value = title;
  if (mid) D.getElementById('td-assignee').value = mid;
  D.getElementById('td-priority').value = priority;
  D.getElementById('td-support').checked = support;
  D.getElementById('td-desc').value = desc;
  D.getElementById('td-start').value = start;   // 주간 표시는 수행일(시작일) 기준
  D.getElementById('td-due').value = due;
  click(D.getElementById('btn-todo-save'));
}
/** 특정 팀원 행 */
function rowOf(mid) {
  return [...D.querySelectorAll('#sch-body tr')]
    .find(r => r.querySelector(`[data-add^="${mid}|"]`));
}
/** 특정 팀원 + 날짜 칸 */
function cellOf(mid, ds) {
  return D.querySelector(`#sch-body td.w-cell[data-add="${mid}|${ds}"]`);
}

check('초기에는 업무 없음', D.querySelectorAll('#sch-body .dt').length === 0);
check('칸마다 + 버튼', D.querySelectorAll('#sch-body .dc-add').length === 30);

// 칸의 + 버튼 → 담당자 + 날짜 프리셋
click(cellOf(ids0[1], TUE).querySelector('.dc-add'));
check('+ 클릭 시 담당자 자동 지정', D.getElementById('td-assignee').value === ids0[1]);
check('+ 클릭 시 수행일 자동 지정', D.getElementById('td-start').value === TUE,
  D.getElementById('td-start').value);
check('마감일은 기본 비어있음', D.getElementById('td-due').value === '',
  D.getElementById('td-due').value);
check('모달 제목에 날짜 표시', D.getElementById('todo-modal-title').textContent.includes(TUE),
  D.getElementById('todo-modal-title').textContent);
click(D.querySelector('[data-close="modal-todo"]'));

// 빈 곳(칸 자체) 클릭도 추가
click(cellOf(ids0[0], MON));
check('빈 곳 클릭도 추가 모달', D.getElementById('modal-todo').hidden === false);
check('수행일 프리셋 동일', D.getElementById('td-start').value === MON);
check('마감일 여전히 비어있음', D.getElementById('td-due').value === '');
click(D.querySelector('[data-close="modal-todo"]'));

addTodoUI({ title: LONG, mid: ids0[0], priority: 'high', support: true, desc: LONGDESC, start: MON });
addTodoUI({ title: '2차 시험 준비', mid: ids0[0], start: MON });
addTodoUI({ title: '1차 보고서 제출', mid: ids0[0], priority: 'low', start: TUE });
addTodoUI({ title: '치구 도면 검토', mid: ids0[1], start: TUE });
addTodoUI({ title: '수행일 없는 업무', mid: ids0[0] });

check('할 일 5건 저장', todosOf().length === 5, 'got=' + todosOf().length);
check('월요일 칸에 2건', cellOf(ids0[0], MON).querySelectorAll('.dt').length === 2,
  'got=' + cellOf(ids0[0], MON).querySelectorAll('.dt').length);
check('화요일 칸에 1건', cellOf(ids0[0], TUE).querySelectorAll('.dt').length === 1);
check('다른 팀원 화요일 칸에 1건', cellOf(ids0[1], TUE).querySelectorAll('.dt').length === 1);
check('다른 팀원 월요일 칸은 비어있음', cellOf(ids0[1], MON).querySelectorAll('.dt').length === 0);
check('수행일 없는 업무는 팀원칸에 배지로 표시',
  rowOf(ids0[0]).querySelector('.wk-undated') !== null);
check('마감일만 있고 수행일 없으면 요일 칸에 안 보임 (배지로 이동)',
  cellOf(ids0[0], MON).querySelectorAll('.dt').length === 2);
check('미지정 배지에 건수 표시',
  rowOf(ids0[0]).querySelector('.wk-undated').textContent.includes('1'),
  rowOf(ids0[0]).querySelector('.wk-undated').textContent);
check('근태 입력 버튼과 업무가 같은 칸에 공존',
  cellOf(ids0[0], MON).querySelector('.att-ghost') !== null &&
  cellOf(ids0[0], MON).querySelector('.dt') !== null);
check('긴 제목 2줄 클램프 CSS', /\.dt-t\{[^}]*-webkit-line-clamp:2/.test(css));
check('지원필요 업무 강조 클래스', cellOf(ids0[0], MON).querySelector('.dt.sup') !== null);
check('진행률 컬럼 없음(현 status만 공유)', rowOf(ids0[0]).querySelector('.wk-pg-t') === null);

sec('8. 지원 필요 비상 이펙트');
check('해당 팀원 행에 sos 클래스', rowOf(ids0[0]).classList.contains('sos'));
check('지원 필요 태그 표시', rowOf(ids0[0]).querySelector('.sos-tag') !== null);
check('깜빡이는 점 요소', rowOf(ids0[0]).querySelector('.sos-tag .dotb') !== null);
check('지원 없는 팀원은 sos 아님', !rowOf(ids0[1]).classList.contains('sos'));
check('배경 점멸 애니메이션 정의', /@keyframes sosBg/.test(css));
check('좌측 빨간 막대 펄스 정의', /@keyframes sosPulse/.test(css));
check('sos 행 배경 적용 규칙', /tr\.sos > td/.test(css));
check('모션 최소화 사용자 배려', /prefers-reduced-motion[\s\S]*tr\.sos/.test(css));

sec('8-1. 체크박스 완료 / 상세 보기');
const supChk = cellOf(ids0[0], MON).querySelector('.dt.sup .dt-c');
const supId = supChk.dataset.chk;
click(supChk);
check('체크 시 완료 저장', todosOf().find(t => t.id === supId).done === true);
check('완료 스타일', cellOf(ids0[0], MON).querySelector('.dt.done') !== null);
check('완료되면 sos 해제', !rowOf(ids0[0]).classList.contains('sos'));
check('완료해도 진행률 지표 없음', D.getElementById('todo-pct') === null);

click(cellOf(ids0[0], MON).querySelector(`.dt-t[data-open-task="${supId}"]`));
check('상세 모달 열림', D.getElementById('modal-tasks').hidden === false);
check('긴 제목 전문 표시', D.querySelector('#tasks-body .tk-title').textContent === LONG);
check('설명 전문 표시',
  D.querySelector('#tasks-body .tk-desc').textContent.includes('두번째 줄입니다'));
click(D.querySelector('[data-close="modal-tasks"]'));

sec('8-2. 범례 우측 필터가 요일 칸을 필터링');
const chips = [...D.querySelectorAll('.lg-right .fchip')].map(c => c.dataset.filter);
check('필터 5종', JSON.stringify(chips) ===
  JSON.stringify(['all', 'inprogress', 'done', 'support', 'duesoon']), JSON.stringify(chips));
click(D.querySelector('.lg-right .fchip[data-filter="done"]'));
check('완료 필터 활성', D.querySelector('.lg-right .fchip[data-filter="done"]').classList.contains('active'));
check('완료만 표시', cellOf(ids0[0], MON).querySelectorAll('.dt').length === 1,
  'got=' + cellOf(ids0[0], MON).querySelectorAll('.dt').length);
click(D.querySelector('.lg-right .fchip[data-filter="inprogress"]'));
check('진행중 필터', cellOf(ids0[0], MON).querySelectorAll('.dt').length === 1);
click(D.querySelector('.lg-right .fchip[data-filter="all"]'));
check('전체로 복귀', cellOf(ids0[0], MON).querySelectorAll('.dt').length === 2);

sec('9. 8명 레이아웃');
click(D.getElementById('btn-add-member'));
D.getElementById('mb-name').value = '신입1';
click(D.getElementById('btn-member-save'));
click(D.getElementById('btn-add-member'));
D.getElementById('mb-name').value = '신입2';
click(D.getElementById('btn-member-save'));
check('팀원 8명', JSON.parse(store['ps2_members']).length === 8);
nav('week');
check('주간표 8행', D.querySelectorAll('#sch-body tr').length === 8);
check('8행 모두 6칸', [...D.querySelectorAll('#sch-body tr')].every(r => r.children.length === 6));
check('근태 입력 버튼 40개(8명 x 5일)', D.querySelectorAll('#sch-body .att-ghost').length === 40,
  'got=' + D.querySelectorAll('#sch-body .att-ghost').length);
check('요일 칸 40개', D.querySelectorAll('#sch-body td.w-cell').length === 40);
check('표 최소폭 지정(가로스크롤 대비)', /\.wk-table\{[^}]*min-width:1000px/.test(css));
check('열 너비 고정 레이아웃', /\.wk-table\{[^}]*table-layout:fixed/.test(css));
check('가로 스크롤 래퍼', D.querySelector('#view-week .twrap') !== null);
check('셀 경계선으로 행 구분(8명 가독성)', /\.wk-table td\{[^}]*border:1px solid/.test(css));
nav('month');
check('월간 집계도 8행', D.querySelectorAll('#mon-sum-body tr').length === 8);


sec('10. 월간 근태 달력');
nav('month');
check('월간 뷰 활성', D.getElementById('view-month').classList.contains('active'));
check('요일 헤더 7개', D.querySelectorAll('.mon-table thead th').length === 7);
check('일요일부터 시작', D.querySelector('.mon-table thead th').textContent === '일');
const mRows = D.querySelectorAll('#mon-body tr');
check('4~6주 행', mRows.length >= 4 && mRows.length <= 6, 'rows=' + mRows.length);
check('행마다 7칸', [...mRows].every(r => r.children.length === 7));
const nowM = new Date();
check('월 라벨 = 이번 달',
  D.getElementById('month-label').textContent === `${nowM.getFullYear()}년 ${nowM.getMonth() + 1}월`,
  D.getElementById('month-label').textContent);
check('오늘 칸 강조', D.querySelector('#mon-body td.tday') !== null);
check('할 일은 월간에 없음', D.querySelector('#mon-body [data-open-task]') === null);
check('할 일 추가 버튼도 없음', D.querySelector('#mon-body .wt-add') === null);

const lbl = D.getElementById('month-label').textContent;
click(D.getElementById('btn-m-next'));
check('다음 달', D.getElementById('month-label').textContent !== lbl);
click(D.getElementById('btn-m-prev'));
check('이전 달 복귀', D.getElementById('month-label').textContent === lbl);
click(D.getElementById('btn-m-next'));
click(D.getElementById('btn-m-today'));
check('이번 달 버튼', D.getElementById('month-label').textContent === lbl);

sec('10-1. 공휴일 표시 (일요일과 동일 처리)');
const HOLI = ['2026-08-17', '2026-09-24', '2026-09-25', '2026-10-05', '2026-10-09', '2026-12-25'];
const appSrc = fs.readFileSync('docs/app.js', 'utf8');
check('공휴일 목록이 코드에 정의', /const HOLIDAYS = \{/.test(appSrc));
HOLI.forEach(d => check('공휴일 등록: ' + d, appSrc.includes("'" + d + "'")));
check('공휴일 배경 CSS(연한 빨강)', /\.mon-table td\.holi\{background:#fef2f2\}/.test(css));
check('공휴일 숫자 빨강 CSS', /\.mon-table td\.holi \.d-num\{color:#dc2626\}/.test(css));
check('일요일 숫자 빨강 CSS(동일 색)', /\.mon-table td\.sun-c \.d-num\{color:#dc2626\}/.test(css));

// 실제 달력에서 확인: 해당 월로 이동해 공휴일 칸 검사
function gotoMonth(y, mo) {
  nav('month');
  // 이번 달로 초기화 후 목표 월까지 이동
  click(D.getElementById('btn-m-today'));
  const now = new Date();
  let diff = (y - now.getFullYear()) * 12 + (mo - (now.getMonth() + 1));
  const btn = diff >= 0 ? 'btn-m-next' : 'btn-m-prev';
  for (let i = 0; i < Math.abs(diff); i++) click(D.getElementById(btn));
}
[['2026-08-17', 2026, 8], ['2026-10-09', 2026, 10], ['2026-12-25', 2026, 12]].forEach(([ds, y, mo]) => {
  gotoMonth(y, mo);
  const cell = D.querySelector(`#mon-body td[data-day="${ds}"]`);
  if (!cell) { check(ds + ' 칸 존재', false, '달력에 없음'); return; }
  check(ds + ' 칸에 holi 클래스', cell.classList.contains('holi'));
  check(ds + ' 공휴일명 표시', cell.querySelector('.d-holi') !== null,
    cell.querySelector('.d-holi') ? cell.querySelector('.d-holi').textContent : '없음');
});

// 평일은 공휴일 처리되지 않아야 함
gotoMonth(2026, 8);
const normal = D.querySelector('#mon-body td[data-day="2026-08-18"]');
if (normal) check('일반 평일은 holi 아님', !normal.classList.contains('holi'));
check('공휴일도 근태 입력 가능(클릭 가능)',
  (D.querySelector('#mon-body td[data-day="2026-08-17"]') || {}).dataset !== undefined);

sec('11. 월간 날짜 클릭 → 일괄 근태 입력');
const dayCell = D.querySelector('#mon-body td[data-day]');
const dayStr = dayCell.dataset.day;
click(dayCell);
check('모달 열림', D.getElementById('modal-day').hidden === false);
check('제목에 날짜+요일',
  /\d+\.\d+\.\d+ \([일월화수목금토]\) 근태 입력/.test(D.getElementById('day-title').textContent),
  D.getElementById('day-title').textContent);
check('8명 표시', D.querySelectorAll('#day-body .day-row').length === 8);
check('행당 5옵션(출근+4)', D.querySelector('#day-body .day-row').querySelectorAll('.dopt').length === 5);
check('기본 출근 활성', D.querySelector('#day-body .dopt[data-s=""]').classList.contains('on'));
check('출근일 때 메모 비활성', D.querySelector('#day-body .day-note').disabled === true);

const tb = D.querySelector('#day-body .dopt[data-s="출장"]');
const tMid = tb.dataset.m;
click(tb);
const rec = JSON.parse(store['ps2_sch']).find(s => s.memberId === tMid && s.date === dayStr);
check('출장 저장', rec && rec.status === '출장');
check('버튼 활성 갱신',
  D.querySelector(`#day-body .dopt[data-s="출장"][data-m="${tMid}"]`).classList.contains('on'));
check('메모 활성화', D.querySelector(`#day-body [data-note="${tMid}"]`).disabled === false);
check('달력에 칩 표시', D.querySelector(`#mon-body td[data-day="${dayStr}"] .d-chip`) !== null);
click(D.querySelector(`#day-body .dopt[data-s="출장"][data-m="${tMid}"]`));
check('같은 값 재클릭 = 해제',
  !JSON.parse(store['ps2_sch']).some(s => s.memberId === tMid && s.date === dayStr));
click(D.querySelector(`#day-body .dopt[data-s="휴가"][data-m="${tMid}"]`));
check('휴가 저장', JSON.parse(store['ps2_sch']).some(s => s.memberId === tMid && s.date === dayStr));
click(D.querySelector(`#day-body .dopt[data-s=""][data-m="${tMid}"]`));
check('출근 클릭 = 해제',
  !JSON.parse(store['ps2_sch']).some(s => s.memberId === tMid && s.date === dayStr));
click(D.querySelector('[data-close="modal-day"]'));
check('모달 닫힘', D.getElementById('modal-day').hidden === true);

sec('12. 대시보드: 타이틀 날짜 + 섹션 분리');
nav('dashboard');
const dT = D.getElementById('dash-title').textContent;
check('타이틀에 날짜', /\(\d{4}\.\d{2}\.\d{2} [일월화수목금토]\)/.test(dT), dT);
check('섹션 3개', D.querySelectorAll('#view-dashboard .dash-sec').length === 3);
const heads = [...D.querySelectorAll('#view-dashboard .sec-h')].map(h => h.textContent.trim());
check('근태/업무 섹션 제목', heads.some(t => t.includes('근태')) && heads.some(t => t.includes('업무')),
  JSON.stringify(heads));
check('근태 카드 6개', D.querySelectorAll('#dash-cards-att .card').length === 6);
check('업무 카드 5개', D.querySelectorAll('#dash-cards-work .card').length === 5);
check('카드 컨테이너 분리',
  !D.getElementById('dash-cards-att').contains(D.getElementById('dash-cards-work')));
check('섹션 여백 CSS', /\.dash-sec\{[^}]*margin-bottom/.test(css));
check('섹션 제목 띠 CSS', /\.sec-h\{[^}]*border-left/.test(css));
check('팀원표 8행', D.querySelectorAll('#dash-body tr').length === 8);
const dHead = [...D.querySelectorAll('#view-dashboard .dtable thead th')].map(t => t.textContent.trim());
check('컬럼 = 이름/직책/오늘 근태/메인 업무/지원 필요/비고',
  JSON.stringify(dHead) === JSON.stringify(['이름','직책','오늘 근태','메인 업무','지원 필요','비고']),
  JSON.stringify(dHead));
check('완료 업무 컬럼 없음', !dHead.includes('완료 업무'));
check('상태 컬럼은 비고로 대체', !dHead.includes('상태') && dHead.includes('비고'));
const dRow = D.querySelector('#dash-body tr');
check('메인 업무는 업무(To Do)와 연동되지 않음',
  dRow.querySelector('[data-tasks$="|open"]') === null);
check('역할 미입력 시 안내 표시', dRow.querySelector('.role-none') !== null);

// 팀원 관리에서 역할 입력 -> 대시보드 메인 업무에 반영
nav('members');
const roleCell = D.querySelector('#member-body td.edit-cell[data-field="role"]');
check('팀원 관리에 역할 컬럼 존재', roleCell !== null);
click(roleCell);
const roleInp = D.querySelector('#member-body .inline-inp');
check('역할 인라인 입력 가능', roleInp !== null);
roleInp.value = '낙하시험 / 포장설계 표준화';
roleInp.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
check('역할이 저장소에 반영', store['ps2_members'].includes('포장설계 표준화'));
nav('dashboard');
const roleTx = D.querySelector('#dash-body .role-tx');
check('대시보드 메인 업무에 역할 표시', roleTx !== null &&
  roleTx.textContent === '낙하시험 / 포장설계 표준화', roleTx && roleTx.textContent);
check('긴 역할은 말줄임 CSS', /\.role-tx\{[^}]*text-overflow:ellipsis/.test(css));
check('업무를 추가해도 메인 업무는 변하지 않음',
  D.querySelector('#dash-body .role-tx').textContent === '낙하시험 / 포장설계 표준화');


sec('12-1. 비고 컬럼: 휴가 D-n / 장기휴가 판정');
// 월간 뷰에서 특정 팀원에게 미래 휴가를 넣고 비고 표시를 확인
const vIds = memberIds();
function setAbsence(mid, dateStr, status) {
  // 일자별 모달을 통해 입력 (실제 사용 경로)
  nav('month');
  const cell = D.querySelector(`#mon-body td[data-day="${dateStr}"]`);
  if (!cell) return false;
  click(cell);
  const btn = D.querySelector(`#day-body .dopt[data-s="${status}"][data-m="${mid}"]`);
  if (!btn) return false;
  click(btn);
  click(D.querySelector('[data-close="modal-day"]'));
  return true;
}
function ymd(offsetDays) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' +
         String(d.getDate()).padStart(2, '0');
}
function remarkOf(mid) {
  nav('dashboard');
  const row = [...D.querySelectorAll('#dash-body tr')]
    .find(r => r.querySelector('.mdot') && r.textContent.includes(
      JSON.parse(store['ps2_members']).find(m => m.id === mid).name));
  return row ? (row.querySelector('.rm') || {}).textContent || '' : '';
}

// 기본 상태: 부재 없음 -> '-'
check('부재 없으면 - 표시', remarkOf(vIds[3]).trim() === '-', remarkOf(vIds[3]));

// 3일 뒤 단기 휴가 1일
const short = ymd(3);
if (setAbsence(vIds[3], short, '휴가')) {
  const r = remarkOf(vIds[3]);
  check('휴가 D-3 표시', /휴가 D-3/.test(r), r);
  check('장기 표기 아님', !/장기/.test(r), r);
} else {
  check('단기 휴가 입력(달력에 해당 날짜 존재)', false, short + ' 칸 없음');
}

// 오늘 휴가 -> "휴가 중"
if (setAbsence(vIds[4], ymd(0), '휴가')) {
  const r = remarkOf(vIds[4]);
  check('오늘 부재는 "중"으로 표시', /휴가 중/.test(r), r);
}

// 연속 4일 휴가 -> 장기휴가
let okLong = true;
for (let i = 5; i <= 8; i++) if (!setAbsence(vIds[5], ymd(i), '휴가')) okLong = false;
if (okLong) {
  const r = remarkOf(vIds[5]);
  check('4일 이상은 장기휴가로 표기', /장기휴가/.test(r), r);
  check('장기휴가에 D-n 포함', /D-\d+/.test(r), r);
  check('연속 일수 표기', /\(\d+일\)/.test(r), r);
} else {
  check('연속 휴가 입력 가능', false, '달력 범위를 벗어남');
}

// 출장도 동일 로직
if (setAbsence(vIds[2], ymd(2), '출장')) {
  const r = remarkOf(vIds[2]);
  check('출장도 D-n 표시', /출장 D-2/.test(r), r);
}

check('비고는 업무(To Do)와 무관하게 근태 기반',
  /function nextAbsence/.test(fs.readFileSync('docs/app.js', 'utf8')));

sec('13. 공지사항 CRUD + 수정');
nav('notice');
click(D.getElementById('btn-add-notice'));
D.getElementById('nt-title').value = '주간 회의 안내';
D.getElementById('nt-content').value = '금요일 14시';
click(D.getElementById('btn-notice-save'));
check('공지 카드 생성', D.querySelectorAll('#notice-list .ncard').length === 1);
check('수정 버튼', D.querySelector('#notice-list [data-edit-notice]') !== null);
check('삭제 버튼', D.querySelector('#notice-list [data-del-notice]') !== null);
click(D.querySelector('#notice-list [data-edit-notice]'));
check('수정 모달 제목', D.getElementById('notice-modal-title').textContent === '공지사항 수정');
check('기존 값 로드', D.getElementById('nt-title').value === '주간 회의 안내');
D.getElementById('nt-title').value = '주간 회의 안내(변경)';
click(D.getElementById('btn-notice-save'));
check('수정 반영', D.querySelector('#notice-list h4').textContent === '주간 회의 안내(변경)');
check('수정됨 표기', D.querySelector('#notice-list .n-meta').textContent.includes('수정됨'));
check('대시보드 최근공지 반영', (nav('dashboard'),
  D.getElementById('dash-notices').textContent.includes('주간 회의 안내')));

sec('13-1. 표 서식: 세로 구분선 / 열 너비 / 휴지통 버튼');
check('데이터 표에 세로 구분선', /\.dtable td\{[^}]*border-right:1px solid/.test(css));
check('헤더에도 세로 구분선', /\.dtable th\{[^}]*border-right:1px solid/.test(css));
check('마지막 열은 세로선 제거', /\.dtable td:last-child\{border-right:none\}/.test(css));
check('대시보드 표 고정 레이아웃', /#view-dashboard \.dtable\{table-layout:fixed\}/.test(css));
check('메인 업무 열이 가장 넓게(auto)', /th\.c-main\{width:auto\}/.test(css));
check('메인 업무 폭 제한 제거', !/\.role-tx\{[^}]*max-width/.test(css));
const dMain = D.querySelector('#dash-body td.c-main-td');
check('메인 업무 셀 클래스 적용', dMain !== null);
check('메인 업무 좌측 정렬', /\.dtable td\.c-main-td\{text-align:left\}/.test(css));
check('대시보드 표 영역 확대(2.4fr)', /\.dgrid\{[^}]*2\.4fr 1fr/.test(css));
check('구버전 sch-table CSS 제거', !/\.sch-table/.test(css));

nav('members');
const trash = D.querySelector('#member-body .trash');
check('삭제는 휴지통 아이콘 버튼', trash !== null);
check('휴지통에 🗑 문자', trash.textContent.includes('🗑'), trash.textContent);
check('빨간 채움 버튼 아님', !trash.classList.contains('dbtn'));
check('평상시 회색, 호버 시 빨강', /\.trash\{[^}]*color:var\(--g400\)/.test(css) &&
  /\.trash:hover\{[^}]*color:var\(--dan\)/.test(css));
check('접근성 라벨 존재', !!trash.getAttribute('aria-label'));

sec('13-2. 라벨/열너비/가이드/공지 모달');
// 메뉴 & 페이지 제목
check('메뉴 라벨 = 주간 스케줄(To do)',
  D.querySelector('.nav-btn[data-view="week"]').textContent.includes('주간 스케줄(To do)'),
  D.querySelector('.nav-btn[data-view="week"]').textContent.trim());
check('페이지 제목 = 주간 스케줄(To do)',
  D.querySelector('#view-week .vhead h2').textContent.includes('주간 스케줄(To do)'),
  D.querySelector('#view-week .vhead h2').textContent.trim());

// 대시보드 열 너비 1.5배
check('이름 열 144px (96 x1.5)', /th\.c-nm\{width:144px\}/.test(css));
check('직책 열 138px (92 x1.5)', /th\.c-po\{width:138px\}/.test(css));
check('메인 업무는 남는 폭(auto)', /th\.c-main\{width:auto\}/.test(css));

// 사용 가이드: 기술적 3항목 제거
const guideTxt = D.getElementById('view-guide').textContent;
check('백업 안내 제거', !guideTxt.includes('JSON 내보내기'));
check('SETUP-FIREBASE 안내 제거', !guideTxt.includes('SETUP-FIREBASE'));
check('삭제 되돌릴 수 없음 안내 제거', !guideTxt.includes('되돌릴 수 없습니다'));
check('데이터 저장 위치 블록은 유지', guideTxt.includes('데이터 저장 위치'));
check('상태 표시 설명은 유지', guideTxt.includes('실시간 공유 중'));
const dataLis = [...D.querySelectorAll('#view-guide .gblock.warn > ul > li')];
check('저장 위치 항목 3개로 축소', dataLis.length === 3, 'count=' + dataLis.length);

// 공지 구분에 자유 추가
nav('notice');
click(D.getElementById('btn-add-notice'));
const types = [...D.querySelectorAll('#nt-type option')].map(o => o.value);
check('구분 4종 (공지/회의록/메모/자유)',
  JSON.stringify(types) === JSON.stringify(['공지', '회의록', '메모', '자유']), JSON.stringify(types));
const freeOpt = D.querySelector('#nt-type option[value="자유"]');
check('자유 이모티콘 = 💬', freeOpt.textContent.includes('💬'), freeOpt.textContent);

// 모달 크기
const nModal = D.querySelector('#modal-notice .modal');
check('공지 모달에 xl 클래스', nModal.classList.contains('xl'));
check('가로 960px (480 x2)', /\.modal\.xl\{max-width:960px/.test(css));
check('세로 여유 확대(92vh)', /\.modal\.xl\{[^}]*max-height:92vh/.test(css));
check('내용 입력창 확대(min-height 330px)', /\.ta-lg\{min-height:330px/.test(css));
check('입력창 rows 14', D.getElementById('nt-content').getAttribute('rows') === '14');
check('제목/작성자/구분 3열 배치', D.querySelector('#modal-notice .row3') !== null);
check('모바일에서 1열로 전환', /\.row3\{grid-template-columns:1fr\}/.test(css));

// 자유 구분으로 공지 작성
D.getElementById('nt-title').value = '점심 메뉴 추천';
D.getElementById('nt-type').value = '자유';
D.getElementById('nt-content').value = '오늘 뭐 먹을까요';
click(D.getElementById('btn-notice-save'));
const freeCard = [...D.querySelectorAll('#notice-list .ncard')]
  .find(c => c.textContent.includes('점심 메뉴 추천'));
check('자유 공지 등록됨', freeCard !== null);
check('자유 카드에 type-자유 클래스', freeCard.classList.contains('type-자유'));
check('자유 카드에 💬 표시', freeCard.querySelector('.n-type').textContent.includes('💬'),
  freeCard.querySelector('.n-type').textContent);
check('자유 카드 좌측 색상 정의', /\.ncard\.type-자유\{border-left/.test(css));

sec('13-3. 대시보드 우측 패널: 클릭하여 상세 확인');
// 앞 단계에서 지원필요 업무가 완료 처리되었으므로 새로 하나 등록
const dIds = memberIds();
nav('week');
addTodoUI({ title: '치구 제작 지원 요청', mid: dIds[3], start: MON, support: true });
nav('dashboard');

// --- 지원 필요 알림 ---
const supAlert = D.querySelector('#dash-alerts .alert-item[data-tasks]');
check('지원 필요 알림 존재', supAlert !== null);
check('클릭 가능 표시(cursor pointer)', /\.alert-item\{[^}]*cursor:pointer/.test(css));
check('클릭 유도 화살표', /\.alert-item::after\{content:'›'/.test(css));
check('title 안내 존재', (supAlert.getAttribute('title') || '').includes('지원 필요'),
  supAlert.getAttribute('title'));
click(supAlert);
check('지원 필요 클릭 -> 업무 모달 열림', D.getElementById('modal-tasks').hidden === false);
check('모달 제목에 지원 필요',
  D.getElementById('tasks-title').textContent.includes('지원 필요'),
  D.getElementById('tasks-title').textContent);
check('모달에 업무 내용 표시', D.querySelector('#tasks-body .tk-title') !== null);
click(D.querySelector('[data-close="modal-tasks"]'));
check('모달 닫힘', D.getElementById('modal-tasks').hidden === true);

// --- 마감 임박 알림 ---
// 오늘 마감인 업무를 만들어 알림에 뜨게 함
nav('week');
addTodoUI({ title: '오늘 마감 보고서', mid: dIds[2], start: MON, due: ymd(0) });
nav('dashboard');
const dueAlert = D.querySelector('#dash-alerts .alert-item.due[data-open-task]');
check('마감 임박 알림 생성', dueAlert !== null);
check('알림에 업무명 표시', dueAlert.textContent.includes('오늘 마감 보고서'), dueAlert.textContent.trim());
click(dueAlert);
check('마감 임박 클릭 -> 업무 상세 열림', D.getElementById('modal-tasks').hidden === false);
check('해당 업무 1건 표시', D.querySelectorAll('#tasks-body .tk').length === 1);
check('제목 전문 표시',
  D.querySelector('#tasks-body .tk-title').textContent === '오늘 마감 보고서',
  D.querySelector('#tasks-body .tk-title').textContent);
click(D.querySelector('[data-close="modal-tasks"]'));

// --- 최근 공지 ---
const LONGNOTE = '1. 금요일 14시 회의\n2. 낙하시험 결과 공유\n3. 포장 사양서 개정안 검토';
nav('notice');
click(D.getElementById('btn-add-notice'));
D.getElementById('nt-title').value = '주간 회의 안건';
D.getElementById('nt-type').value = '회의록';
D.getElementById('nt-content').value = LONGNOTE;
click(D.getElementById('btn-notice-save'));

nav('dashboard');
const mini = [...D.querySelectorAll('#dash-notices .mini-notice')]
  .find(x => x.textContent.includes('주간 회의 안건'));
check('최근 공지에 표시', mini !== null);
check('구분 아이콘 표시(회의록)', mini.querySelector('b').textContent.includes('📝'),
  mini.querySelector('b').textContent);
check('본문 미리보기 한 줄 표시', mini.querySelector('.mn-pv') !== null);
check('미리보기는 말줄임', /\.mn-pv\{[^}]*text-overflow:ellipsis/.test(css));
check('클릭 가능 표시', /\.mini-notice\{[^}]*cursor:pointer/.test(css));

click(mini);
check('공지 클릭 -> 상세 모달 열림', D.getElementById('modal-notice-view').hidden === false);
const nv = D.getElementById('nv-body');
check('제목 표시', nv.querySelector('.nv-title').textContent === '주간 회의 안건',
  nv.querySelector('.nv-title').textContent);
check('구분 배지 표시', nv.querySelector('.n-type').textContent.includes('회의록'));
check('작성일 표시', /\d{4}\.\d{2}\.\d{2}/.test(nv.querySelector('.nv-meta').textContent),
  nv.querySelector('.nv-meta').textContent);
check('본문 전문 표시(3줄 모두)',
  nv.querySelector('.nv-content').textContent.includes('포장 사양서 개정안 검토'));
check('줄바꿈 보존 CSS', /\.nv-content\{[^}]*white-space:pre-wrap/.test(css));

// 상세에서 수정으로 연결
click(D.getElementById('btn-nv-edit'));
check('수정 클릭 시 상세 닫힘', D.getElementById('modal-notice-view').hidden === true);
check('수정 모달 열림', D.getElementById('modal-notice').hidden === false);
check('기존 값 로드', D.getElementById('nt-title').value === '주간 회의 안건');
check('구분도 로드', D.getElementById('nt-type').value === '회의록');
click(D.querySelector('[data-close="modal-notice"]'));

// 내용 없는 공지도 안전하게 열림
nav('notice');
click(D.getElementById('btn-add-notice'));
D.getElementById('nt-title').value = '내용 없는 공지';
D.getElementById('nt-content').value = '';
click(D.getElementById('btn-notice-save'));
nav('dashboard');
const empty = [...D.querySelectorAll('#dash-notices .mini-notice')]
  .find(x => x.textContent.includes('내용 없는 공지'));
if (empty) {
  check('내용 없으면 미리보기 생략', empty.querySelector('.mn-pv') === null);
  click(empty);
  check('내용 없는 공지도 모달 열림', D.getElementById('modal-notice-view').hidden === false);
  check('내용 없음 안내 표시',
    D.querySelector('#nv-body .nv-content').textContent.includes('내용이 없습니다'));
  click(D.querySelector('[data-close="modal-notice-view"]'));
}

sec('14. 팀원 인라인 수정');
nav('members');
check('8행 렌더', D.querySelectorAll('#member-body tr').length === 8);
const mHead = [...D.querySelectorAll('.mtable thead th')].map(t => t.textContent.trim());
check('팀원 관리 7열 (역할 추가)', mHead.length === 7, JSON.stringify(mHead));
check('역할 컬럼 존재', mHead.some(h => h.includes('역할')), JSON.stringify(mHead));
const nameCell = D.querySelector('#member-body td.edit-cell[data-field="name"]');
click(nameCell);
const inp = D.querySelector('#member-body .inline-inp');
check('인라인 input 생성', inp !== null);
inp.value = '이봉철';
inp.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
check('이름 수정 반영',
  D.querySelector('#member-body td.edit-cell[data-field="name"]').textContent.trim() === '이봉철');
check('저장소 반영', store['ps2_members'].includes('이봉철'));
click(D.querySelector('#member-body td.edit-cell[data-field="position"]'));
const isel = D.querySelector('#member-body .inline-sel');
check('직책은 드롭다운', isel !== null);
check('직책 옵션 3개', isel && isel.options.length === 3);

sec('15. XSS 방어');
nav('notice');
click(D.getElementById('btn-add-notice'));
D.getElementById('nt-title').value = '<img src=x onerror=alert(1)>';
click(D.getElementById('btn-notice-save'));
check('태그 이스케이프됨', D.querySelector('#notice-list img') === null);
nav('week');
addTodoUI({ title: '<script>alert(1)</script>', mid: memberIds()[0] });
check('할 일 제목도 이스케이프', D.querySelector('#sch-body script') === null);

sec('16. 불필요 기능 제거 확인 (백업/복원/인쇄/로그아웃)');
check('백업 저장 버튼 없음', D.getElementById('btn-backup') === null);
check('백업 불러오기 입력 없음', D.getElementById('btn-restore') === null);
check('인쇄 버튼 없음', D.getElementById('btn-print') === null);
check('로그아웃 버튼 없음', D.getElementById('btn-logout') === null);
check('사이드바 하단에 연결 상태만 남음',
  D.querySelectorAll('.nav-bottom .nav-btn').length === 0,
  'buttons=' + D.querySelectorAll('.nav-bottom .nav-btn').length);
check('연결 상태 표시는 유지', D.getElementById('conn-status') !== null);
check('DataStore.replaceAll 제거됨', typeof window.DataStore.replaceAll === 'undefined');
check('파일 선택 input이 사이드바에 없음',
  D.querySelector('.nav-bottom input[type="file"]') === null);
// 인쇄 스타일시트는 남겨둠 (Ctrl+P 로 여전히 깔끔하게 출력됨)
check('인쇄용 CSS는 유지 (Ctrl+P 대응)', /@media print/.test(css));

sec('17. 남은 메뉴 무결성');
const navAfter = [...D.querySelectorAll('.nav .nav-btn')].map(b => b.dataset.view);
check('메뉴 6개 그대로', navAfter.length === 6, JSON.stringify(navAfter));
for (const v of navAfter) {
  nav(v);
  check(`${v} 뷰 정상 전환`, D.getElementById('view-' + v).classList.contains('active'));
}

console.log('\n' + '='.repeat(50));
console.log(failures === 0
  ? `모든 테스트 통과 ✅  (${passes}개)`
  : `${failures}개 실패 ❌  (통과 ${passes}개)`);
console.log('='.repeat(50));
process.exit(failures === 0 ? 0 : 1);
}

main().catch(e => {
  console.error('\n테스트 실행 오류:', e && e.stack ? e.stack : e);
  process.exit(1);
});
