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
check('대시보드 카드 8개', D.querySelectorAll('#dash-cards .card').length === 8,
  'cards=' + D.querySelectorAll('#dash-cards .card').length);
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
check('대시보드 지원필요 반영', D.querySelector('#dash-cards .card.alert') !== null);
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
['dashboard','todo','notice','members','guide','calendar'].forEach(v => {
  D.querySelector(`.nav-btn[data-view="${v}"]`).dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  check(`${v} 뷰 활성화`, D.getElementById('view-' + v).classList.contains('active'));
});

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

console.log('\n=== 13. 백업/복원 왕복 (팀원 간 공유 경로) ===');
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
