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
check('세번째가 주간 스케줄', navLabels[2].includes('주간'), navLabels[2]);

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
check('헤더 7열 (팀원+5일+진행률)', wkHeads.length === 7, JSON.stringify(wkHeads));
check('할 일 컬럼 제거됨', !wkHeads.some(h => h.includes('할 일')), JSON.stringify(wkHeads));
check('마지막 열 = 진행률', wkHeads[6].includes('진행률'), wkHeads[6]);
check('기본 팀원 6행', D.querySelectorAll('#sch-body tr').length === 6);
check('행마다 7칸', [...D.querySelectorAll('#sch-body tr')].every(r => r.children.length === 7));
check('요일 칸 5개/행', D.querySelector('#sch-body tr').querySelectorAll('td.w-cell').length === 5);
check('요일 칸에 업무 목록 컨테이너', D.querySelector('#sch-body td.w-cell .dc-list') !== null);
check('요일 칸에 업무 추가 버튼', D.querySelector('#sch-body td.w-cell .dc-add') !== null);
check('진행률 표시 존재', D.querySelector('#sch-body .wk-pg-t') !== null);
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
check('출근 녹색원 범례 포함', legend.querySelector('.work-dot') !== null);
check('4가지 근태 칩 포함', legend.querySelectorAll('.chip').length === 4);
check('구버전 큰 범례 미사용', D.querySelector('#view-week .legend') === null);

sec('6. 근태 최소 표시 (칸 좌상단 칩)');
const atts = D.querySelectorAll('#sch-body .att-mini');
check('모든 요일 칸에 근태 칩', atts.length === 30, 'count=' + atts.length);
check('입력 없으면 출근 스타일', D.querySelectorAll('#sch-body .att-mini.att-work').length === 30);
check('출근 칩은 초록 원 CSS', /\.att-work\{[^}]*background:var\(--suc\)/.test(css));
check('칩 title에 안내', (atts[0].getAttribute('title') || '').includes('출근'), atts[0].getAttribute('title'));

// 근태 칩 클릭 -> 근태 모달
click(atts[0]);
check('근태 칩 클릭 시 모달 열림', D.getElementById('modal-status').hidden === false);
click(D.querySelector('.sopt[data-status="출장"]'));
D.getElementById('status-note').value = '평택 출장';
click(D.getElementById('btn-status-save'));
check('출장 칩으로 변경', D.querySelector('#sch-body .att-mini.att-trip') !== null);
check('출근 칩 1개 감소', D.querySelectorAll('#sch-body .att-mini.att-work').length === 29);
check('메모 있으면 * 표시', D.querySelector('#sch-body .att-mini.att-trip').textContent.includes('*'));
check('저장소 반영', store['ps2_sch'].includes('평택 출장'));

const tripChip = D.querySelector('#sch-body .att-mini.att-trip');
click(tripChip);
check('되돌리기 버튼 노출', D.getElementById('btn-status-clear').hidden === false);
click(D.getElementById('btn-status-clear'));
check('출근으로 복귀', D.querySelectorAll('#sch-body .att-mini.att-work').length === 30);

sec('7. 요일 칸에 업무 배치 / 완료 / 상세');
const ids0 = memberIds();
const LONG = '포장 낙하 시험 조건 재검토 및 사양서 개정 작업 진행 필요';
const LONGDESC = '상세 설명 본문입니다.\n두번째 줄입니다.';

// 이번 주 월/화 날짜
const wkDates = [...D.querySelectorAll('#sch-body tr:first-child td.w-cell')]
  .map(c => c.dataset.add.split('|')[1]);
const MON = wkDates[0], TUE = wkDates[1];

function addTodoUI({ title, mid, priority = 'medium', support = false, desc = '', due = '' }) {
  click(D.getElementById('btn-add-todo'));
  D.getElementById('td-title').value = title;
  if (mid) D.getElementById('td-assignee').value = mid;
  D.getElementById('td-priority').value = priority;
  D.getElementById('td-support').checked = support;
  D.getElementById('td-desc').value = desc;
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
check('+ 클릭 시 날짜 자동 지정(마감일)', D.getElementById('td-due').value === TUE,
  D.getElementById('td-due').value);
check('모달 제목에 날짜 표시', D.getElementById('todo-modal-title').textContent.includes(TUE),
  D.getElementById('todo-modal-title').textContent);
click(D.querySelector('[data-close="modal-todo"]'));

// 빈 곳(칸 자체) 클릭도 추가
click(cellOf(ids0[0], MON));
check('빈 곳 클릭도 추가 모달', D.getElementById('modal-todo').hidden === false);
check('날짜 프리셋 동일', D.getElementById('td-due').value === MON);
click(D.querySelector('[data-close="modal-todo"]'));

addTodoUI({ title: LONG, mid: ids0[0], priority: 'high', support: true, desc: LONGDESC, due: MON });
addTodoUI({ title: '2차 시험 준비', mid: ids0[0], due: MON });
addTodoUI({ title: '1차 보고서 제출', mid: ids0[0], priority: 'low', due: TUE });
addTodoUI({ title: '치구 도면 검토', mid: ids0[1], due: TUE });
addTodoUI({ title: '마감일 없는 업무', mid: ids0[0] });

check('할 일 5건 저장', todosOf().length === 5, 'got=' + todosOf().length);
check('월요일 칸에 2건', cellOf(ids0[0], MON).querySelectorAll('.dt').length === 2,
  'got=' + cellOf(ids0[0], MON).querySelectorAll('.dt').length);
check('화요일 칸에 1건', cellOf(ids0[0], TUE).querySelectorAll('.dt').length === 1);
check('다른 팀원 화요일 칸에 1건', cellOf(ids0[1], TUE).querySelectorAll('.dt').length === 1);
check('다른 팀원 월요일 칸은 비어있음', cellOf(ids0[1], MON).querySelectorAll('.dt').length === 0);
check('마감일 없는 업무는 팀원칸에 배지로 표시',
  rowOf(ids0[0]).querySelector('.wk-undated') !== null);
check('미지정 배지에 건수 표시',
  rowOf(ids0[0]).querySelector('.wk-undated').textContent.includes('1'),
  rowOf(ids0[0]).querySelector('.wk-undated').textContent);
check('근태 칩과 업무가 같은 칸에 공존',
  cellOf(ids0[0], MON).querySelector('.att-mini') !== null &&
  cellOf(ids0[0], MON).querySelector('.dt') !== null);
check('긴 제목 2줄 클램프 CSS', /\.dt-t\{[^}]*-webkit-line-clamp:2/.test(css));
check('지원필요 업무 강조 클래스', cellOf(ids0[0], MON).querySelector('.dt.sup') !== null);
check('진행률 0/5', rowOf(ids0[0]).querySelector('.wk-pg-t').textContent.includes('0/4'),
  rowOf(ids0[0]).querySelector('.wk-pg-t').textContent);

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
check('진행률 1/4 갱신', rowOf(ids0[0]).querySelector('.wk-pg-t').textContent.includes('1/4'),
  rowOf(ids0[0]).querySelector('.wk-pg-t').textContent);
check('파트 전체 진행률', D.getElementById('todo-pct').textContent === '20%',
  D.getElementById('todo-pct').textContent);

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
check('8행 모두 7칸', [...D.querySelectorAll('#sch-body tr')].every(r => r.children.length === 7));
check('근태 칩 40개(8명 x 5일)', D.querySelectorAll('#sch-body .att-mini').length === 40,
  'got=' + D.querySelectorAll('#sch-body .att-mini').length);
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
check('메인 업무 칸 클릭 가능', dRow.querySelector('[data-tasks$="|open"]') !== null);
check('메인 업무는 내용 표시(숫자 아님)',
  !/^\\d+$/.test(dRow.querySelector('[data-tasks$="|open"]').textContent.trim()),
  JSON.stringify(dRow.querySelector('[data-tasks$="|open"]').textContent.trim()));
check('비고 컬럼 렌더', dRow.querySelector('.rm') !== null);
click(dRow.querySelector('[data-tasks$="|open"]'));
check('상세 모달 열림', D.getElementById('modal-tasks').hidden === false);
click(D.querySelector('[data-close="modal-tasks"]'));

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

sec('14. 팀원 인라인 수정');
nav('members');
check('8행 렌더', D.querySelectorAll('#member-body tr').length === 8);
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
