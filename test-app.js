const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const html = fs.readFileSync(path.join('docs', 'index.html'), 'utf8');
const appJs = fs.readFileSync(path.join('docs', 'app.js'), 'utf8');

let failures = 0;
function check(name, cond, extra) {
  if (cond) { console.log('  PASS  ' + name); }
  else { console.log('  FAIL  ' + name + (extra ? ' -> ' + extra : '')); failures++; }
}

const dom = new JSDOM(html, { runScripts: 'outside-only', url: 'https://example.com' });
const { window } = dom;

// localStorage shim
const store = {};
Object.defineProperty(window, 'localStorage', {
  value: {
    getItem: k => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: k => { delete store[k]; },
    clear: () => { for (const k in store) delete store[k]; }
  },
  configurable: true
});
window.alert = () => {};
window.confirm = () => true;
window.print = () => {};

// jsdom 11 lacks Element.prototype.closest / matches (browsers all support it).
// Polyfill so the harness can exercise the app's event-delegation code paths.
if (!window.Element.prototype.matches) {
  window.Element.prototype.matches = function (sel) {
    const all = (this.ownerDocument || window.document).querySelectorAll(sel);
    for (let i = 0; i < all.length; i++) if (all[i] === this) return true;
    return false;
  };
}
if (!window.Element.prototype.closest) {
  window.Element.prototype.closest = function (sel) {
    let el = this;
    while (el && el.nodeType === 1) {
      if (el.matches(sel)) return el;
      el = el.parentElement;
    }
    return null;
  };
}

// Run app.js then fire DOMContentLoaded
window.eval(appJs);
window.document.dispatchEvent(new window.Event('DOMContentLoaded', { bubbles: true }));

const D = window.document;
console.log('\n=== 1. 초기 렌더링 ===');
check('팀원 6명 기본 로드', D.querySelectorAll('#member-body tr').length === 6,
  'rows=' + D.querySelectorAll('#member-body tr').length);
check('캘린더 6행 렌더', D.querySelectorAll('#sch-body tr').length === 6);
check('캘린더 행당 7칸(팀원+5일+할일)', D.querySelector('#sch-body tr').children.length === 7,
  'cells=' + (D.querySelector('#sch-body tr') || {}).childElementCount);
check('주간 라벨 채워짐', D.getElementById('week-label').textContent.length > 0);
check('대시보드 근태 카드 6개', D.querySelectorAll('#dash-cards-att .card').length === 6,
  'cards=' + D.querySelectorAll('#dash-cards-att .card').length);
check('대시보드 업무 카드 5개', D.querySelectorAll('#dash-cards-work .card').length === 5,
  'cards=' + D.querySelectorAll('#dash-cards-work .card').length);
check('Todo 팀원별 요약 6행', D.querySelectorAll('#todo-summary-body tr').length === 6);

console.log('\n=== 2. 폰트 크기 (CSS) ===');
const css = fs.readFileSync(path.join('docs', 'style.css'), 'utf8');
check('html 기준 16px', /html\{font-size:16px\}/.test(css));
check('본문 1rem 사용', /body\{[^}]*font-size:1rem/.test(css));
check('테이블 셀 0.9375rem(15px)', css.includes('font-size:.9375rem'));

console.log('\n=== 3. 근태 4종만 존재 ===');
const sopts = [...D.querySelectorAll('.sopt')].map(b => b.dataset.status);
check('출장/휴가/교육/기타 4개', JSON.stringify(sopts) === JSON.stringify(['출장','휴가','교육','기타']),
  JSON.stringify(sopts));
check('"출근" 버튼 없음', !sopts.includes('출근'));

console.log('\n=== 4. 근태 입력 동작 ===');
const firstCell = D.querySelector('#sch-body td.clk');
firstCell.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
check('근태 모달 열림', D.getElementById('modal-status').hidden === false);
D.querySelector('.sopt[data-status="출장"]').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
check('출장 선택 활성', D.querySelector('.sopt[data-status="출장"]').classList.contains('on'));
D.getElementById('status-note').value = '평택 출장';
D.getElementById('btn-status-save').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
check('모달 닫힘', D.getElementById('modal-status').hidden === true);
check('배지 렌더됨', D.querySelector('#sch-body .badge.b-trip') !== null);
check('메모 아이콘 표시', D.querySelector('#sch-body .note-ico') !== null);
check('localStorage 저장됨', store['ps2_sch'] && store['ps2_sch'].includes('평택 출장'));

console.log('\n=== 5. 팀원 인라인 수정 ===');
const nameCell = D.querySelector('#member-body td.edit-cell[data-field="name"]');
nameCell.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
const inlineInput = D.querySelector('#member-body .inline-inp');
check('인라인 input 생성', inlineInput !== null);
if (inlineInput) {
  inlineInput.value = '이봉철';
  const ev = new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true });
  inlineInput.dispatchEvent(ev);
  const firstName = D.querySelector('#member-body td.edit-cell[data-field="name"]').textContent.trim();
  check('이름이 수정 반영됨', firstName === '이봉철', 'got=' + firstName);
  check('저장소 반영', store['ps2_members'].includes('이봉철'));
}
const posCell = D.querySelector('#member-body td.edit-cell[data-field="position"]');
posCell.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
const inlineSel = D.querySelector('#member-body .inline-sel');
check('직책은 드롭다운으로 편집', inlineSel !== null);
check('직책 옵션 3개', inlineSel && inlineSel.options.length === 3);

console.log('\n=== 6. Todo 추가 + 지원필요 ===');
D.getElementById('btn-add-todo').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
check('Todo 모달 열림', D.getElementById('modal-todo').hidden === false);
check('담당자 드롭다운 채워짐', D.getElementById('td-assignee').options.length === 6);
D.getElementById('td-title').value = '포장 설계 검토';
D.getElementById('td-support').checked = true;
D.getElementById('td-priority').value = 'high';
D.getElementById('btn-todo-save').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
check('Todo 목록에 추가', D.querySelectorAll('#todo-list .titem').length === 1);
check('지원필요 스타일 적용', D.querySelector('#todo-list .titem.sup') !== null);
check('대시보드 지원필요 반영', D.querySelector('#dash-cards-work .card.alert') !== null);
check('캘린더 할일 컬럼에 표시', D.querySelector('#sch-body .mini-todo') !== null);

console.log('\n=== 7. Todo 완료 처리 / 진행률 ===');
const chk = D.querySelector('#todo-list [data-chk]');
// A click on a checkbox toggles `checked` itself (browser + jsdom activation behavior),
// so do NOT pre-set it — that would flip it back to false.
chk.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
check('진행률 100%', D.getElementById('todo-pct').textContent === '100%',
  'got=' + D.getElementById('todo-pct').textContent);
check('완료 스타일', D.querySelector('#todo-list .titem.done') !== null);

console.log('\n=== 8. 팀원별 + 버튼으로 배정 ===');
const addBtn = D.querySelector('#todo-summary-body .addbtn');
check('팀원별 + 버튼 존재', addBtn !== null);
addBtn.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
check('모달 열리고 담당자 프리셋', D.getElementById('modal-todo').hidden === false &&
  D.getElementById('td-assignee').value === addBtn.dataset.addTodo);
D.querySelector('[data-close="modal-todo"]').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));

console.log('\n=== 9. 공지 작성 + 수정 ===');
D.getElementById('btn-add-notice').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
D.getElementById('nt-title').value = '주간 회의 안내';
D.getElementById('nt-content').value = '금요일 14시';
D.getElementById('btn-notice-save').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
check('공지 카드 생성', D.querySelectorAll('#notice-list .ncard').length === 1);
check('수정 버튼 존재', D.querySelector('#notice-list [data-edit-notice]') !== null);
check('삭제 버튼 존재', D.querySelector('#notice-list [data-del-notice]') !== null);
D.querySelector('#notice-list [data-edit-notice]').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
check('수정 모달 제목 변경', D.getElementById('notice-modal-title').textContent === '공지사항 수정');
check('기존 값 로드', D.getElementById('nt-title').value === '주간 회의 안내');
D.getElementById('nt-title').value = '주간 회의 안내(변경)';
D.getElementById('btn-notice-save').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
check('수정 반영', D.querySelector('#notice-list h4').textContent === '주간 회의 안내(변경)');
check('수정됨 표기', D.querySelector('#notice-list .n-meta').textContent.includes('수정됨'));

console.log('\n=== 10. 뷰 전환 ===');
['dashboard','month','notice','members','guide','week'].forEach(v => {
  D.querySelector(`.nav-btn[data-view="${v}"]`).dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  check(`${v} 뷰 활성화`, D.getElementById('view-' + v).classList.contains('active'));
});
check('메뉴에 별도 todo 항목 없음(주간과 통합)',
  D.querySelector('.nav-btn[data-view="todo"]') === null);
check('To Do 블록이 주간 뷰 안에 있음',
  D.getElementById('view-week').contains(D.getElementById('todo-list')));
check('주간 할일 테이블도 주간 뷰 안에 있음',
  D.getElementById('view-week').contains(D.getElementById('sch-body')));

console.log('\n=== 11. XSS 방어 ===');
D.querySelector('.nav-btn[data-view="notice"]').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
D.getElementById('btn-add-notice').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
D.getElementById('nt-title').value = '<img src=x onerror=alert(1)>';
D.getElementById('btn-notice-save').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
check('스크립트 태그 이스케이프됨', D.querySelector('#notice-list img') === null);

console.log('\n=== 12. 데이터 영속성 (재접속 시뮬레이션) ===');
const savedMembers = store['ps2_members'];
const savedSch = store['ps2_sch'];
check('팀원 데이터 저장', !!savedMembers && savedMembers.includes('이봉철'));
check('일정 데이터 저장', !!savedSch && savedSch.includes('출장'));
check('공지 데이터 저장', !!store['ps2_notices']);
check('Todo 데이터 저장', !!store['ps2_todos']);

console.log('\n=== 13. 내용 미리보기 셀 (숫자 대신 내용) ===');
D.querySelector('.nav-btn[data-view="week"]').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));

// 기존 할 일 전부 UI로 삭제 (깨끗한 상태 확보)
let guard = 0;
while (D.querySelector('#todo-list [data-del-todo]') && guard++ < 50) {
  D.querySelector('#todo-list [data-del-todo]').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
}
check('사전 정리: 할 일 0건', JSON.parse(store['ps2_todos']).length === 0,
  'left=' + JSON.parse(store['ps2_todos']).length);

const firstMemberId = JSON.parse(store['ps2_members'])[0].id;
const LONG = '포장 낙하 시험 조건 재검토 및 사양서 개정 작업 진행 필요';
const LONGDESC = '상세 설명 본문입니다.\n두번째 줄입니다.';

// 실제 모달 UI로 3건 등록
function addViaUI({ title, priority, support, desc }) {
  D.getElementById('btn-add-todo').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  D.getElementById('td-title').value = title;
  D.getElementById('td-assignee').value = firstMemberId;
  D.getElementById('td-priority').value = priority;
  D.getElementById('td-support').checked = !!support;
  D.getElementById('td-desc').value = desc || '';
  D.getElementById('btn-todo-save').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
}
// 제목으로 해당 항목의 체크박스를 찾아 완료 처리 (정렬 순서에 의존하지 않음)
function markDoneByTitle(title) {
  const item = [...D.querySelectorAll('#todo-list .titem')]
    .find(el => el.querySelector('.tt-title').textContent.includes(title));
  if (!item) return false;
  item.querySelector('[data-chk]').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  return true;
}
addViaUI({ title: LONG, priority: 'high', support: true, desc: LONGDESC });
addViaUI({ title: '2차 시험 준비', priority: 'medium' });
addViaUI({ title: '1차 보고서 제출', priority: 'low' });
check('완료 처리 대상 항목 찾음', markDoneByTitle('1차 보고서 제출'));

const storedTodos = JSON.parse(store['ps2_todos']);
check('UI로 3건 등록됨', storedTodos.length === 3, 'got=' + storedTodos.length);
check('1건은 완료 상태', storedTodos.filter(t => t.done).length === 1);

const row0 = D.querySelector('#todo-summary-body tr');
const cells = row0.querySelectorAll('[data-tasks]');
check('진행중/완료/지원필요 3칸 모두 클릭 가능', cells.length === 3, 'got=' + cells.length);
check('진행중 칸에 업무 제목 표시(숫자 아님)',
  cells[0].textContent.includes('포장 낙하 시험'), JSON.stringify(cells[0].textContent.trim()));
check('여러 건이면 +N 표시', cells[0].querySelector('.cp-more') &&
  cells[0].querySelector('.cp-more').textContent === '+1',
  cells[0].querySelector('.cp-more') && cells[0].querySelector('.cp-more').textContent);
check('완료 칸에 완료 업무명 표시', cells[1].textContent.includes('1차 보고서'),
  JSON.stringify(cells[1].textContent.trim()));
check('지원필요 칸에 🔴 + 내용', cells[2].textContent.includes('🔴') && cells[2].textContent.includes('포장 낙하'));
check('긴 제목은 CSS ellipsis 적용(.cp-text)', /\.cp-text\{[^}]*text-overflow:ellipsis/.test(css));
check('title 속성에 전체 목록 툴팁', (cells[0].getAttribute('title') || '').includes('2차 시험 준비'),
  JSON.stringify(cells[0].getAttribute('title')));

console.log('\n=== 14. 진행중 칸 클릭 → 상세 모달 ===');
cells[0].dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
check('상세 모달 열림', D.getElementById('modal-tasks').hidden === false);
check('제목에 팀원명+구분+건수', /진행중 업무 \(2건\)/.test(D.getElementById('tasks-title').textContent),
  D.getElementById('tasks-title').textContent);
check('모달에 업무 2건 표시', D.querySelectorAll('#tasks-body .tk').length === 2);
check('긴 제목 전문이 모달에 표시', D.querySelector('#tasks-body .tk-title').textContent === LONG);
check('설명 전문 표시', D.querySelector('#tasks-body .tk-desc') !== null &&
  D.querySelector('#tasks-body .tk-desc').textContent.includes('두번째 줄입니다'));
check('지원필요 강조 스타일', D.querySelector('#tasks-body .tk.sup') !== null);

console.log('\n=== 15. 모달 내 완료 처리 / 삭제 ===');
const longId = JSON.parse(store['ps2_todos']).find(t => t.title === LONG).id;
D.querySelector(`#tasks-body [data-tk-toggle="${longId}"]`)
  .dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
check('완료 처리 후 저장 반영',
  JSON.parse(store['ps2_todos']).find(t => t.id === longId).done === true);
check('모달이 갱신되어 1건만 남음', D.querySelectorAll('#tasks-body .tk').length === 1,
  'got=' + D.querySelectorAll('#tasks-body .tk').length);
D.querySelector('#tasks-body [data-tk-del]').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
check('삭제 반영', JSON.parse(store['ps2_todos']).length === 2,
  'got=' + JSON.parse(store['ps2_todos']).length);

console.log('\n=== 16. 완료 칸 클릭 → 완료 업무 목록 ===');
const cells2 = D.querySelector('#todo-summary-body tr').querySelectorAll('[data-tasks]');
cells2[1].dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
check('완료 업무 모달 열림', /완료 업무/.test(D.getElementById('tasks-title').textContent));
check('완료 처리한 항목 포함', D.getElementById('tasks-body').textContent.includes('포장 낙하 시험'));
D.querySelector('[data-close="modal-tasks"]').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
check('모달 닫힘', D.getElementById('modal-tasks').hidden === true);

console.log('\n=== 17. 할 일 목록/캘린더에서 제목 클릭 → 상세 ===');
const tt = D.querySelector('#todo-list [data-open-task]');
check('목록 제목이 클릭 가능', tt !== null);
tt.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
check('단일 업무 상세 모달 열림', D.getElementById('modal-tasks').hidden === false &&
  D.querySelectorAll('#tasks-body .tk').length === 1);
D.querySelector('[data-close="modal-tasks"]').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));

// 캘린더 주간 컬럼은 "미완료(마감일 없음) 또는 이번 주 마감" 만 표시하므로
// 앞 단계에서 모두 완료/삭제된 상태이면 비어 있는 것이 정상 → 미완료 1건을 새로 등록
addViaUI({ title: '캘린더 표시용 미완료 업무', priority: 'medium' });
const cm = D.querySelector('#sch-body [data-open-task]');
check('캘린더 할일도 클릭 가능', cm !== null);
if (cm) {
  cm.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  check('캘린더에서 상세 모달 열림 (추가 모달 아님)',
    D.getElementById('modal-tasks').hidden === false && D.getElementById('modal-todo').hidden === true);
  D.querySelector('[data-close="modal-tasks"]').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
}
// 빈 곳 클릭은 여전히 추가 동작
const emptyCell = [...D.querySelectorAll('#sch-body td.todo-cell')].find(c => c.querySelector('.mini-add'));
if (emptyCell) {
  emptyCell.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  check('빈 할일칸 클릭 시 추가 모달', D.getElementById('modal-todo').hidden === false);
  D.querySelector('[data-close="modal-todo"]').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
}

console.log('\n=== 18. 대시보드 표도 내용+클릭 ===');
D.querySelector('.nav-btn[data-view="dashboard"]').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
const dCells = D.querySelector('#dash-body tr').querySelectorAll('[data-tasks]');
check('대시보드 진행중/완료 칸 클릭 가능', dCells.length === 2, 'got=' + dCells.length);
dCells[1].dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
check('대시보드에서 상세 모달 열림', D.getElementById('modal-tasks').hidden === false);
D.querySelector('[data-close="modal-tasks"]').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));

console.log('\n=== 19. 업무 없는 팀원은 "-" 표시 ===');
const lastRow = [...D.querySelectorAll('#dash-body tr')].pop();
const lastCells = lastRow.querySelectorAll('[data-tasks]');
check('빈 칸은 - 로 표시', lastCells[0].querySelector('.cp-none') !== null);
lastCells[0].dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
check('빈 칸 클릭 시 "없습니다" 안내', D.getElementById('tasks-body').textContent.includes('없습니다'));
D.querySelector('[data-close="modal-tasks"]').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));

console.log('\n=== 20. 출근 = 녹색 원 표시 ===');
D.querySelector('.nav-btn[data-view="week"]').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
const dots = D.querySelectorAll('#sch-body .work-dot');
check('입력값 없는 칸에 녹색 원 표시', dots.length > 0, 'count=' + dots.length);
check('녹색 원 CSS가 초록색', /\.work-dot\{[^}]*background:var\(--suc\)/.test(css));
const workCell = dots[0].closest('td');
check('출근 칸 title이 "출근"임', (workCell.getAttribute('title') || '').includes('출근'),
  workCell.getAttribute('title'));
check('범례에도 출근 녹색 원 있음', D.querySelector('.legend .work-dot') !== null);
// 근태를 넣으면 녹색 원이 배지로 바뀌는지
const before = D.querySelectorAll('#sch-body .work-dot').length;
workCell.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
D.querySelector('.sopt[data-status="휴가"]').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
D.getElementById('btn-status-save').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
check('근태 입력 시 녹색 원 → 배지로 대체',
  D.querySelectorAll('#sch-body .work-dot').length === before - 1,
  `before=${before} after=${D.querySelectorAll('#sch-body .work-dot').length}`);
// 다시 출근으로 되돌리기
const vacCell = D.querySelector('#sch-body .badge.b-vac').closest('td');
vacCell.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
check('되돌리기 버튼 노출', D.getElementById('btn-status-clear').hidden === false);
D.getElementById('btn-status-clear').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
check('출근으로 되돌리면 녹색 원 복귀',
  D.querySelectorAll('#sch-body .work-dot').length === before);

console.log('\n=== 21. 월간 근태 달력 ===');
D.querySelector('.nav-btn[data-view="month"]').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
check('월간 뷰 활성화', D.getElementById('view-month').classList.contains('active'));
check('요일 헤더 7개(일~토)', D.querySelectorAll('.mon-table thead th').length === 7);
check('일요일 헤더가 일', D.querySelector('.mon-table thead th').textContent === '일');
const monRows = D.querySelectorAll('#mon-body tr');
check('주 행이 4~6주', monRows.length >= 4 && monRows.length <= 6, 'rows=' + monRows.length);
check('각 행 7칸', [...monRows].every(r => r.children.length === 7));
const nowM = new Date();
check('월 라벨이 이번 달', D.getElementById('month-label').textContent ===
  `${nowM.getFullYear()}년 ${nowM.getMonth()+1}월`, D.getElementById('month-label').textContent);
check('오늘 칸 강조', D.querySelector('#mon-body td.tday') !== null);
check('할 일은 월간에 표시되지 않음', D.querySelector('#mon-body [data-open-task]') === null);
check('월간 집계표 렌더', D.querySelectorAll('#mon-sum-body tr').length === 6);

// 월 이동
const curLabel = D.getElementById('month-label').textContent;
D.getElementById('btn-m-next').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
check('다음 달 이동', D.getElementById('month-label').textContent !== curLabel);
D.getElementById('btn-m-prev').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
check('이전 달로 복귀', D.getElementById('month-label').textContent === curLabel);
D.getElementById('btn-m-next').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
D.getElementById('btn-m-today').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
check('이번 달 버튼 동작', D.getElementById('month-label').textContent === curLabel);

console.log('\n=== 22. 월간 날짜 클릭 → 근태 일괄 입력 ===');
const dayCell = D.querySelector('#mon-body td[data-day]');
const dayStr = dayCell.dataset.day;
dayCell.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
check('일자별 입력 모달 열림', D.getElementById('modal-day').hidden === false);
check('제목에 날짜+요일', /\d+\.\d+\.\d+ \([일월화수목금토]\) 근태 입력/.test(D.getElementById('day-title').textContent),
  D.getElementById('day-title').textContent);
check('팀원 6행 표시', D.querySelectorAll('#day-body .day-row').length === 6);
check('행마다 5개 옵션(출근+4)', D.querySelector('#day-body .day-row').querySelectorAll('.dopt').length === 5);
check('기본은 출근이 활성', D.querySelector('#day-body .dopt[data-s=""]').classList.contains('on'));
check('메모는 출근일 때 비활성', D.querySelector('#day-body .day-note').disabled === true);

// 출장 지정
const tripBtn = D.querySelector('#day-body .dopt[data-s="출장"]');
const targetMid = tripBtn.dataset.m;
tripBtn.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
const savedSch2 = JSON.parse(store['ps2_sch']).find(s => s.memberId === targetMid && s.date === dayStr);
check('출장이 저장됨', savedSch2 && savedSch2.status === '출장');
check('버튼 활성 상태 갱신',
  D.querySelector(`#day-body .dopt[data-s="출장"][data-m="${targetMid}"]`).classList.contains('on'));
check('메모 입력 활성화됨',
  D.querySelector(`#day-body [data-note="${targetMid}"]`).disabled === false);
check('월간 달력에 칩 표시', D.querySelector(`#mon-body td[data-day="${dayStr}"] .d-chip`) !== null);

// 같은 값 재클릭 = 해제
D.querySelector(`#day-body .dopt[data-s="출장"][data-m="${targetMid}"]`)
  .dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
check('같은 값 재클릭 시 해제(출근)',
  !JSON.parse(store['ps2_sch']).some(s => s.memberId === targetMid && s.date === dayStr));

// 휴가 → 출근 버튼으로 해제
D.querySelector(`#day-body .dopt[data-s="휴가"][data-m="${targetMid}"]`)
  .dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
check('휴가 저장 확인',
  JSON.parse(store['ps2_sch']).some(s => s.memberId === targetMid && s.date === dayStr));
D.querySelector(`#day-body .dopt[data-s=""][data-m="${targetMid}"]`)
  .dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
check('출근 클릭 시 입력 해제',
  !JSON.parse(store['ps2_sch']).some(s => s.memberId === targetMid && s.date === dayStr));
D.querySelector('[data-close="modal-day"]').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
check('모달 닫힘', D.getElementById('modal-day').hidden === true);

console.log('\n=== 23. 대시보드 타이틀 + 섹션 분리 ===');
D.querySelector('.nav-btn[data-view="dashboard"]').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
const dTitle = D.getElementById('dash-title').textContent;
check('타이틀에 오늘 날짜 포함', dTitle.includes(String(nowM.getFullYear())) &&
  dTitle.includes(String(nowM.getMonth()+1).padStart(2,'0')), dTitle);
check('타이틀에 요일 포함', /\(\d{4}\.\d{2}\.\d{2} [일월화수목금토]\)/.test(dTitle), dTitle);
const secs = D.querySelectorAll('#view-dashboard .dash-sec');
check('섹션이 3개로 구분', secs.length === 3, 'sections=' + secs.length);
const secHeads = [...D.querySelectorAll('#view-dashboard .sec-h')].map(h => h.textContent.trim());
check('근태/업무 섹션 제목 존재',
  secHeads.some(t => t.includes('근태')) && secHeads.some(t => t.includes('업무')),
  JSON.stringify(secHeads));
check('근태 카드와 업무 카드가 서로 다른 컨테이너',
  D.getElementById('dash-cards-att') !== D.getElementById('dash-cards-work') &&
  !D.getElementById('dash-cards-att').contains(D.getElementById('dash-cards-work')));
check('섹션 간 여백 CSS 적용', /\.dash-sec\{[^}]*margin-bottom/.test(css));
check('섹션 제목 CSS 적용', /\.sec-h\{/.test(css));

console.log('\n=== 24. 백업/복원 왕복 (팀원 간 공유 경로) ===');
// backup() builds a JSON blob; verify the payload shape the restore path expects
const payload = JSON.stringify({
  version: 2, exportedAt: new Date().toISOString(),
  members: JSON.parse(store['ps2_members']),
  schedules: JSON.parse(store['ps2_sch']),
  todos: JSON.parse(store['ps2_todos']),
  notices: JSON.parse(store['ps2_notices'])
});
// wipe, then restore from payload via the app's own FileReader path
const beforeMembers = JSON.parse(store['ps2_members']).length;
const beforeNotices = JSON.parse(store['ps2_notices']).length;
class FakeReader {
  readAsText() { setTimeout(() => this.onload({ target: { result: payload } }), 0); }
}
window.FileReader = FakeReader;
store['ps2_members'] = '[]'; store['ps2_notices'] = '[]';
const restoreInput = D.getElementById('btn-restore');
Object.defineProperty(restoreInput, 'files', { value: [{ name: 'b.json' }], configurable: true });
restoreInput.dispatchEvent(new window.Event('change', { bubbles: true }));
setTimeout(() => {
  const okM = JSON.parse(store['ps2_members']).length === beforeMembers;
  const okN = JSON.parse(store['ps2_notices']).length === beforeNotices;
  check('복원 후 팀원 수 일치', okM, 'got=' + JSON.parse(store['ps2_members']).length + ' want=' + beforeMembers);
  check('복원 후 공지 수 일치', okN);
  check('복원 후 화면 재렌더', D.querySelectorAll('#member-body tr').length === beforeMembers);

  console.log('\n' + '='.repeat(46));
  console.log(failures === 0 ? `모든 테스트 통과 ✅` : `${failures}개 실패 ❌`);
  console.log('='.repeat(46));
  process.exit(failures === 0 ? 0 : 1);
}, 30);
