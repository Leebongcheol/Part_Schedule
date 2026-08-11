/**
 * 패키징기술파트 Schedule - App
 */

// === Constants ===
const STATUS_LIST = ['출장', '휴가', '교육', '기타'];
const STATUS_COLOR = { '출장': '#f59e0b', '휴가': '#3b82f6', '교육': '#8b5cf6', '기타': '#6b7280' };
const STATUS_CLASS = { '출장': 'badge-trip', '휴가': 'badge-vacation', '교육': 'badge-training', '기타': 'badge-etc' };
const POSITIONS = ['선임연구원', '책임연구원', '파트장'];

const KEYS = {
  members: 'ps_members',
  schedules: 'ps_schedules',
  todos: 'ps_todos',
  notices: 'ps_notices'
};

const DEFAULT_MEMBERS = [
  { id: uid(), name: '홍길동', position: '파트장', empNo: '', email: '', color: '#E91E63' },
  { id: uid(), name: '김철수', position: '책임연구원', empNo: '', email: '', color: '#3F51B5' },
  { id: uid(), name: '이영희', position: '선임연구원', empNo: '', email: '', color: '#009688' },
  { id: uid(), name: '박민수', position: '책임연구원', empNo: '', email: '', color: '#FF5722' },
  { id: uid(), name: '정수진', position: '선임연구원', empNo: '', email: '', color: '#795548' },
  { id: uid(), name: '한지원', position: '선임연구원', empNo: '', email: '', color: '#607D8B' }
];

// === State ===
let members = [];
let schedules = [];
let todos = [];
let notices = [];
let currentDate = new Date();
let currentView = 'calendar';
let todoFilter = 'all';
let todoMemberFilter = 'all';
let statusCtx = { memberId: null, date: null, selected: null };

// === Helpers ===
function uid() { return Date.now().toString(36) + Math.random().toString(36).substr(2, 8); }
function fmt(d) { const x = new Date(d); return `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}-${String(x.getDate()).padStart(2,'0')}`; }
function weekDates(date) {
  const d = new Date(date);
  const day = d.getDay();
  const mon = new Date(d); mon.setDate(d.getDate() - day + (day === 0 ? -6 : 1));
  return Array.from({length: 5}, (_, i) => { const x = new Date(mon); x.setDate(mon.getDate()+i); return x; });
}
function weekLabel(dates) {
  const s = dates[0], e = dates[4];
  return `${s.getFullYear()}.${s.getMonth()+1}.${s.getDate()} ~ ${e.getMonth()+1}.${e.getDate()}`;
}

// === Persistence ===
function load() {
  members = JSON.parse(localStorage.getItem(KEYS.members) || 'null') || [...DEFAULT_MEMBERS];
  schedules = JSON.parse(localStorage.getItem(KEYS.schedules) || '[]');
  todos = JSON.parse(localStorage.getItem(KEYS.todos) || '[]');
  notices = JSON.parse(localStorage.getItem(KEYS.notices) || '[]');
  save();
}
function save() {
  localStorage.setItem(KEYS.members, JSON.stringify(members));
  localStorage.setItem(KEYS.schedules, JSON.stringify(schedules));
  localStorage.setItem(KEYS.todos, JSON.stringify(todos));
  localStorage.setItem(KEYS.notices, JSON.stringify(notices));
}

// === Schedule CRUD ===
function getSch(memberId, dateStr) { return schedules.find(s => s.memberId === memberId && s.date === dateStr); }
function setSch(memberId, dateStr, status, note) {
  const idx = schedules.findIndex(s => s.memberId === memberId && s.date === dateStr);
  if (idx >= 0) { if (status) { schedules[idx].status = status; schedules[idx].note = note||''; } else { schedules.splice(idx, 1); } }
  else if (status) { schedules.push({ id: uid(), memberId, date: dateStr, status, note: note||'' }); }
  save();
}

// === Member CRUD ===
function addMember(name, position, empNo, email, color) {
  members.push({ id: uid(), name, position, empNo: empNo||'', email: email||'', color }); save();
}
function updateMember(id, data) {
  const m = members.find(x => x.id === id);
  if (m) { Object.assign(m, data); save(); }
}
function deleteMember(id) {
  if (!confirm('팀원을 삭제하면 관련 일정/할일도 삭제됩니다. 계속할까요?')) return;
  members = members.filter(x => x.id !== id);
  schedules = schedules.filter(x => x.memberId !== id);
  todos = todos.filter(x => x.assigneeId !== id);
  save(); renderAll();
}

// === Todo CRUD ===
function addTodo(title, assigneeId, priority, dueDate, needSupport, desc) {
  todos.push({ id: uid(), title, assigneeId, priority, dueDate, needSupport: !!needSupport, description: desc||'', done: false, createdAt: new Date().toISOString() });
  save();
}
function toggleTodo(id) { const t = todos.find(x => x.id === id); if (t) { t.done = !t.done; save(); } }
function delTodo(id) { todos = todos.filter(x => x.id !== id); save(); }

// === Notice CRUD ===
function addNotice(title, content) {
  notices.unshift({ id: uid(), title, content, date: new Date().toISOString() }); save();
}
function delNotice(id) { notices = notices.filter(x => x.id !== id); save(); }

// === Workload ===
function getWorkload(memberId) {
  const incomplete = todos.filter(t => t.assigneeId === memberId && !t.done).length;
  const hasSupport = todos.some(t => t.assigneeId === memberId && !t.done && t.needSupport);
  return { incomplete, needSupport: hasSupport || incomplete >= 5 };
}


// === Render: Calendar ===
function renderCalendar() {
  const dates = weekDates(currentDate);
  const today = fmt(new Date());
  const dayNames = ['월','화','수','목','금'];

  document.getElementById('week-label').textContent = weekLabel(dates);

  // Update headers
  const ths = document.querySelectorAll('#schedule-table thead th');
  for (let i = 1; i <= 5; i++) {
    const d = dates[i-1];
    ths[i].innerHTML = `${dayNames[i-1]} <small>${d.getMonth()+1}/${d.getDate()}</small>`;
    ths[i].classList.toggle('today-th', fmt(d) === today);
  }

  // Body
  const tbody = document.getElementById('schedule-body');
  let html = '';
  members.forEach(m => {
    html += '<tr>';
    html += `<td><div class="sch-member"><span class="sch-dot" style="background:${m.color}"></span>${m.name}</div></td>`;
    dates.forEach(d => {
      const ds = fmt(d);
      const sch = getSch(m.id, ds);
      if (sch) {
        const cls = STATUS_CLASS[sch.status] || 'badge-etc';
        const note = sch.note ? `<span class="cell-note">📝</span>` : '';
        html += `<td class="cell-click" data-mid="${m.id}" data-date="${ds}" title="${sch.note||sch.status}"><span class="badge ${cls}">${sch.status}</span>${note}</td>`;
      } else {
        html += `<td class="cell-click" data-mid="${m.id}" data-date="${ds}"><span class="cell-empty">·</span></td>`;
      }
    });
    html += '</tr>';
  });
  tbody.innerHTML = html;
}

// === Render: Dashboard ===
function renderDashboard() {
  const today = fmt(new Date());
  let trip = 0, vac = 0, training = 0, supportCount = 0;
  const inProgress = todos.filter(t => !t.done).length;

  members.forEach(m => {
    const sch = getSch(m.id, today);
    if (sch) { if (sch.status === '출장') trip++; if (sch.status === '휴가') vac++; if (sch.status === '교육') training++; }
    if (getWorkload(m.id).needSupport) supportCount++;
  });

  document.getElementById('dash-cards').innerHTML = `
    <div class="dash-card"><div class="dash-card-val">${members.length}</div><div class="dash-card-lbl">전체 인원</div></div>
    <div class="dash-card"><div class="dash-card-val">${members.length - trip - vac}</div><div class="dash-card-lbl">출근</div></div>
    <div class="dash-card"><div class="dash-card-val">${trip}</div><div class="dash-card-lbl">출장</div></div>
    <div class="dash-card"><div class="dash-card-val">${vac}</div><div class="dash-card-lbl">휴가</div></div>
    <div class="dash-card"><div class="dash-card-val">${training}</div><div class="dash-card-lbl">교육</div></div>
    <div class="dash-card ${supportCount?'alert':''}"><div class="dash-card-val">${supportCount}</div><div class="dash-card-lbl">🔴 지원 필요</div></div>
    <div class="dash-card"><div class="dash-card-val">${inProgress}</div><div class="dash-card-lbl">진행중 업무</div></div>
  `;

  // Member table
  let tHtml = '';
  members.forEach(m => {
    const sch = getSch(m.id, today);
    const status = sch ? sch.status : '출근';
    const sColor = STATUS_COLOR[status] || '#16a34a';
    const wl = getWorkload(m.id);
    const wlTxt = wl.needSupport ? '<span style="color:#dc2626;font-weight:600">🔴 지원 필요</span>' : '<span style="color:#16a34a">🟢 정상</span>';
    tHtml += `<tr><td><span class="sch-dot" style="background:${m.color};display:inline-block;vertical-align:middle;margin-right:5px"></span>${m.name}</td><td>${m.position}</td><td><span class="badge" style="background:${sColor}">${status}</span></td><td>${wl.incomplete}</td><td>${wlTxt}</td></tr>`;
  });
  document.getElementById('dash-member-body').innerHTML = tHtml;

  // Support list
  const supportMembers = members.filter(m => getWorkload(m.id).needSupport);
  const supportEl = document.getElementById('dash-support-list');
  if (supportMembers.length === 0) {
    supportEl.innerHTML = '<p style="color:var(--gray-400);font-size:13px;padding:10px;">현재 지원 필요 인원이 없습니다 ✅</p>';
  } else {
    supportEl.innerHTML = supportMembers.map(m => {
      const wl = getWorkload(m.id);
      return `<div class="support-item">🔴 <strong>${m.name}</strong> (${m.position}) - 미완료 ${wl.incomplete}건</div>`;
    }).join('');
  }
}


// === Render: Todo ===
function renderTodos() {
  let list = [...todos];

  // Member filter
  if (todoMemberFilter !== 'all') list = list.filter(t => t.assigneeId === todoMemberFilter);

  // Status filter
  if (todoFilter === 'inprogress') list = list.filter(t => !t.done);
  else if (todoFilter === 'done') list = list.filter(t => t.done);
  else if (todoFilter === 'support') list = list.filter(t => !t.done && t.needSupport);

  // Sort
  const pOrd = { high: 0, medium: 1, low: 2 };
  list.sort((a, b) => (a.done - b.done) || (pOrd[a.priority]||1) - (pOrd[b.priority]||1));

  const el = document.getElementById('todo-list');
  if (list.length === 0) {
    el.innerHTML = '<p style="text-align:center;color:var(--gray-400);padding:20px;">항목이 없습니다.</p>';
  } else {
    el.innerHTML = list.map(t => {
      const m = members.find(x => x.id === t.assigneeId);
      const name = m ? m.name : '미지정';
      const pLabel = { high:'높음', medium:'보통', low:'낮음' }[t.priority]||'보통';
      const pCls = { high:'p-high', medium:'p-medium', low:'p-low' }[t.priority]||'p-medium';
      const supportCls = (!t.done && t.needSupport) ? 'support-flag' : '';
      return `
        <div class="todo-item ${t.done?'done':''} ${supportCls}">
          <input type="checkbox" class="todo-chk" data-id="${t.id}" ${t.done?'checked':''}>
          <div class="todo-body">
            <div class="todo-title">${t.needSupport&&!t.done?'🔴 ':''}${t.title}</div>
            <div class="todo-meta">
              <span>👤 ${name}</span>
              <span class="todo-priority ${pCls}">${pLabel}</span>
              ${t.dueDate?`<span>📅 ${t.dueDate}</span>`:''}
              ${t.needSupport&&!t.done?'<span style="color:#dc2626;font-weight:600">지원필요</span>':''}
            </div>
          </div>
          <button class="todo-del" data-id="${t.id}">🗑️</button>
        </div>`;
    }).join('');
  }

  // Progress
  const total = todos.length;
  const done = todos.filter(t => t.done).length;
  const pct = total ? Math.round(done/total*100) : 0;
  document.getElementById('todo-progress').style.width = pct + '%';
  document.getElementById('todo-pct').textContent = pct + '%';

  // Member filter dropdown
  const sel = document.getElementById('todo-member-filter');
  const curVal = sel.value;
  sel.innerHTML = '<option value="all">전체 팀원</option>' + members.map(m => `<option value="${m.id}">${m.name}</option>`).join('');
  sel.value = curVal || 'all';
}

// === Render: Notice ===
function renderNotices() {
  const el = document.getElementById('notice-list');
  if (notices.length === 0) {
    el.innerHTML = '<p style="text-align:center;color:var(--gray-400);padding:20px;">등록된 공지사항이 없습니다.</p>';
  } else {
    el.innerHTML = notices.map(n => {
      const d = new Date(n.date);
      const dateStr = `${d.getFullYear()}.${d.getMonth()+1}.${d.getDate()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
      return `
        <div class="notice-card">
          <h4>${n.title}</h4>
          <p>${n.content || ''}</p>
          <div class="notice-date">${dateStr}</div>
          <button class="notice-del" data-id="${n.id}">🗑️</button>
        </div>`;
    }).join('');
  }
}

// === Render: Members ===
function renderMembers() {
  document.getElementById('member-count').textContent = members.length;
  const tbody = document.getElementById('member-tbody');
  tbody.innerHTML = members.map(m => `
    <tr>
      <td><span class="color-dot" style="background:${m.color}"></span></td>
      <td>${m.name}</td>
      <td>${m.position}</td>
      <td>${m.empNo || '-'}</td>
      <td>${m.email || '-'}</td>
      <td>
        <button class="btn-outline btn-sm" data-edit-member="${m.id}">수정</button>
        <button class="btn-danger btn-sm" data-del-member="${m.id}">삭제</button>
      </td>
    </tr>
  `).join('');
}

// === Render All ===
function renderAll() {
  renderCalendar();
  renderDashboard();
  renderTodos();
  renderNotices();
  renderMembers();
}


// === View Switching ===
function switchView(view) {
  currentView = view;
  document.querySelectorAll('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.view === view));
  document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.id === 'view-' + view));
  // Re-render active view
  if (view === 'calendar') renderCalendar();
  else if (view === 'dashboard') renderDashboard();
  else if (view === 'todo') renderTodos();
  else if (view === 'notice') renderNotices();
  else if (view === 'members') renderMembers();
}

// === Status Modal ===
function openStatusModal(memberId, dateStr) {
  const m = members.find(x => x.id === memberId);
  const existing = getSch(memberId, dateStr);
  statusCtx = { memberId, date: dateStr, selected: existing ? existing.status : null };

  document.getElementById('status-title').textContent = `${m?m.name:''} - ${dateStr}`;
  document.getElementById('status-note').value = existing ? existing.note||'' : '';
  document.getElementById('btn-status-clear').hidden = !existing;
  document.querySelectorAll('.status-opt').forEach(b => b.classList.toggle('active', b.dataset.status === statusCtx.selected));
  document.getElementById('modal-status').hidden = false;
}

function closeStatusModal() { document.getElementById('modal-status').hidden = true; }

function saveStatusModal() {
  if (!statusCtx.selected) { alert('상태를 선택해주세요.'); return; }
  const note = document.getElementById('status-note').value.trim();
  setSch(statusCtx.memberId, statusCtx.date, statusCtx.selected, note);
  closeStatusModal(); renderAll();
}

function clearStatus() {
  setSch(statusCtx.memberId, statusCtx.date, null, '');
  closeStatusModal(); renderAll();
}

// === Todo Modal ===
function openTodoModal() {
  const sel = document.getElementById('todo-assignee');
  sel.innerHTML = members.map(m => `<option value="${m.id}">${m.name}</option>`).join('');
  document.getElementById('todo-title').value = '';
  document.getElementById('todo-priority').value = 'medium';
  document.getElementById('todo-due').value = '';
  document.getElementById('todo-support').checked = false;
  document.getElementById('todo-desc').value = '';
  document.getElementById('modal-todo').hidden = false;
}
function closeTodoModal() { document.getElementById('modal-todo').hidden = true; }
function saveTodoModal() {
  const title = document.getElementById('todo-title').value.trim();
  if (!title) { alert('제목을 입력해주세요.'); return; }
  const assigneeId = document.getElementById('todo-assignee').value;
  if (!assigneeId) { alert('담당자를 선택해주세요.'); return; }
  const priority = document.getElementById('todo-priority').value;
  const dueDate = document.getElementById('todo-due').value;
  const needSupport = document.getElementById('todo-support').checked;
  const desc = document.getElementById('todo-desc').value.trim();
  addTodo(title, assigneeId, priority, dueDate, needSupport, desc);
  closeTodoModal(); renderTodos(); renderDashboard();
}

// === Notice Modal ===
function openNoticeModal() {
  document.getElementById('notice-title').value = '';
  document.getElementById('notice-content').value = '';
  document.getElementById('modal-notice').hidden = false;
}
function closeNoticeModal() { document.getElementById('modal-notice').hidden = true; }
function saveNoticeModal() {
  const title = document.getElementById('notice-title').value.trim();
  if (!title) { alert('제목을 입력해주세요.'); return; }
  const content = document.getElementById('notice-content').value.trim();
  addNotice(title, content);
  closeNoticeModal(); renderNotices();
}

// === Member Edit ===
function startEditMember(id) {
  const m = members.find(x => x.id === id);
  if (!m) return;
  document.getElementById('edit-member-id').value = m.id;
  document.getElementById('m-name').value = m.name;
  document.getElementById('m-position').value = m.position;
  document.getElementById('m-empno').value = m.empNo || '';
  document.getElementById('m-email').value = m.email || '';
  document.getElementById('m-color').value = m.color;
  document.getElementById('member-form-title').textContent = '팀원 수정';
  document.getElementById('btn-member-submit').textContent = '저장';
  document.getElementById('btn-member-cancel').hidden = false;
}

function cancelEditMember() {
  document.getElementById('edit-member-id').value = '';
  document.getElementById('m-name').value = '';
  document.getElementById('m-position').value = '선임연구원';
  document.getElementById('m-empno').value = '';
  document.getElementById('m-email').value = '';
  document.getElementById('m-color').value = '#4A90D9';
  document.getElementById('member-form-title').textContent = '팀원 추가';
  document.getElementById('btn-member-submit').textContent = '추가';
  document.getElementById('btn-member-cancel').hidden = true;
}

// === Event Bindings ===
function bind() {
  // Sidebar nav
  document.querySelectorAll('.sidebar-nav .nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      switchView(item.dataset.view);
      document.getElementById('sidebar').classList.remove('open');
      document.getElementById('overlay').classList.remove('open');
    });
  });

  // Mobile menu
  document.getElementById('btn-menu').addEventListener('click', () => {
    document.getElementById('sidebar').classList.add('open');
    document.getElementById('overlay').classList.add('open');
  });
  document.getElementById('overlay').addEventListener('click', () => {
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('overlay').classList.remove('open');
  });

  // Print
  document.getElementById('btn-print').addEventListener('click', () => window.print());

  // Calendar navigation
  document.getElementById('btn-prev').addEventListener('click', () => { currentDate.setDate(currentDate.getDate()-7); renderCalendar(); });
  document.getElementById('btn-next').addEventListener('click', () => { currentDate.setDate(currentDate.getDate()+7); renderCalendar(); });
  document.getElementById('btn-today-nav').addEventListener('click', () => { currentDate = new Date(); renderCalendar(); });

  // Calendar cell click
  document.getElementById('schedule-body').addEventListener('click', (e) => {
    const td = e.target.closest('td[data-mid]');
    if (td) openStatusModal(td.dataset.mid, td.dataset.date);
  });

  // Status modal
  document.getElementById('close-status').addEventListener('click', closeStatusModal);
  document.getElementById('btn-status-save').addEventListener('click', saveStatusModal);
  document.getElementById('btn-status-clear').addEventListener('click', clearStatus);
  document.getElementById('modal-status').addEventListener('click', (e) => { if (e.target === e.currentTarget) closeStatusModal(); });
  document.querySelectorAll('.status-opt').forEach(btn => {
    btn.addEventListener('click', () => {
      statusCtx.selected = btn.dataset.status;
      document.querySelectorAll('.status-opt').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  // Todo
  document.getElementById('btn-add-todo').addEventListener('click', openTodoModal);
  document.getElementById('close-todo').addEventListener('click', closeTodoModal);
  document.getElementById('btn-todo-cancel').addEventListener('click', closeTodoModal);
  document.getElementById('btn-todo-save').addEventListener('click', saveTodoModal);
  document.getElementById('modal-todo').addEventListener('click', (e) => { if (e.target === e.currentTarget) closeTodoModal(); });

  document.getElementById('todo-list').addEventListener('click', (e) => {
    const chk = e.target.closest('.todo-chk');
    if (chk) { toggleTodo(chk.dataset.id); renderTodos(); renderDashboard(); return; }
    const del = e.target.closest('.todo-del');
    if (del && confirm('삭제할까요?')) { delTodo(del.dataset.id); renderTodos(); renderDashboard(); }
  });

  // Todo filters
  document.querySelector('.todo-filters').addEventListener('click', (e) => {
    const btn = e.target.closest('.filter-chip');
    if (btn) {
      todoFilter = btn.dataset.filter;
      document.querySelectorAll('.filter-chip').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderTodos();
    }
  });

  document.getElementById('todo-member-filter').addEventListener('change', (e) => {
    todoMemberFilter = e.target.value;
    renderTodos();
  });

  // Notice
  document.getElementById('btn-add-notice').addEventListener('click', openNoticeModal);
  document.getElementById('close-notice').addEventListener('click', closeNoticeModal);
  document.getElementById('btn-notice-cancel').addEventListener('click', closeNoticeModal);
  document.getElementById('btn-notice-save').addEventListener('click', saveNoticeModal);
  document.getElementById('modal-notice').addEventListener('click', (e) => { if (e.target === e.currentTarget) closeNoticeModal(); });
  document.getElementById('notice-list').addEventListener('click', (e) => {
    const del = e.target.closest('.notice-del');
    if (del && confirm('삭제할까요?')) { delNotice(del.dataset.id); renderNotices(); }
  });

  // Member form
  document.getElementById('form-member').addEventListener('submit', (e) => {
    e.preventDefault();
    const editId = document.getElementById('edit-member-id').value;
    const name = document.getElementById('m-name').value.trim();
    const position = document.getElementById('m-position').value;
    const empNo = document.getElementById('m-empno').value.trim();
    const email = document.getElementById('m-email').value.trim();
    const color = document.getElementById('m-color').value;
    if (!name) { alert('이름을 입력해주세요.'); return; }

    if (editId) {
      updateMember(editId, { name, position, empNo, email, color });
      cancelEditMember();
    } else {
      addMember(name, position, empNo, email, color);
    }
    renderAll();
  });

  document.getElementById('btn-member-cancel').addEventListener('click', cancelEditMember);

  // Member table delegation (edit/delete)
  document.getElementById('member-tbody').addEventListener('click', (e) => {
    const editBtn = e.target.closest('[data-edit-member]');
    if (editBtn) { startEditMember(editBtn.dataset.editMember); return; }
    const delBtn = e.target.closest('[data-del-member]');
    if (delBtn) { deleteMember(delBtn.dataset.delMember); }
  });
}

// === Init ===
document.addEventListener('DOMContentLoaded', () => {
  load();
  bind();
  renderAll();
});
