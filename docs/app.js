/**
 * 패키징기술파트 Schedule - App Logic
 * Vanilla JS, localStorage-based
 */

// ============================================================
// Constants
// ============================================================
const STATUS_TYPES = ['출근', '출장', '휴가', '공가', '재택', '교육'];

const STATUS_COLORS = {
  '출근': '#16a34a',
  '출장': '#f59e0b',
  '휴가': '#3b82f6',
  '공가': '#8b5cf6',
  '재택': '#0d9488',
  '교육': '#ea580c'
};

const STORAGE_KEYS = {
  members: 'partSchedule_members',
  schedules: 'partSchedule_schedules',
  todos: 'partSchedule_todos'
};

const DEFAULT_MEMBERS = [
  { id: uid(), name: '김철수', color: '#E91E63', department: '패키징기술파트' },
  { id: uid(), name: '이영희', color: '#3F51B5', department: '패키징기술파트' },
  { id: uid(), name: '박민수', color: '#009688', department: '패키징기술파트' },
  { id: uid(), name: '정수진', color: '#FF5722', department: '패키징기술파트' },
  { id: uid(), name: '최동혁', color: '#795548', department: '패키징기술파트' },
  { id: uid(), name: '한지원', color: '#607D8B', department: '패키징기술파트' }
];

// ============================================================
// State
// ============================================================
let state = {
  currentView: 'calendar',
  currentDate: new Date(),
  members: [],
  schedules: [],
  todos: [],
  todoFilter: 'all',
  statusModal: { memberId: null, date: null, selectedStatus: null }
};

// ============================================================
// Helpers
// ============================================================
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

function formatDate(d) {
  const date = new Date(d);
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}

function getWeekDates(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d);
  monday.setDate(diff);
  const dates = [];
  for (let i = 0; i < 5; i++) {
    const curr = new Date(monday);
    curr.setDate(monday.getDate() + i);
    dates.push(curr);
  }
  return dates;
}

function getWeekLabel(dates) {
  const s = dates[0];
  const e = dates[4];
  return `${s.getFullYear()}년 ${s.getMonth()+1}월 ${Math.ceil(s.getDate()/7)}주차 (${s.getMonth()+1}/${s.getDate()} ~ ${e.getMonth()+1}/${e.getDate()})`;
}

function getDayNames() { return ['월','화','수','목','금']; }

// ============================================================
// Data Persistence
// ============================================================
function loadData() {
  const m = localStorage.getItem(STORAGE_KEYS.members);
  const s = localStorage.getItem(STORAGE_KEYS.schedules);
  const t = localStorage.getItem(STORAGE_KEYS.todos);
  state.members = m ? JSON.parse(m) : [...DEFAULT_MEMBERS];
  state.schedules = s ? JSON.parse(s) : [];
  state.todos = t ? JSON.parse(t) : [];
  if (!m) saveMembers();
  if (!s) saveSchedules();
  if (!t) saveTodos();
}

function saveMembers() { localStorage.setItem(STORAGE_KEYS.members, JSON.stringify(state.members)); }
function saveSchedules() { localStorage.setItem(STORAGE_KEYS.schedules, JSON.stringify(state.schedules)); }
function saveTodos() { localStorage.setItem(STORAGE_KEYS.todos, JSON.stringify(state.todos)); }

// ============================================================
// Schedule CRUD
// ============================================================
function getSchedule(memberId, dateStr) {
  return state.schedules.find(s => s.memberId === memberId && s.date === dateStr);
}

function setSchedule(memberId, dateStr, status, note) {
  const idx = state.schedules.findIndex(s => s.memberId === memberId && s.date === dateStr);
  if (idx >= 0) {
    if (status) {
      state.schedules[idx].status = status;
      state.schedules[idx].note = note || '';
    } else {
      state.schedules.splice(idx, 1);
    }
  } else if (status) {
    state.schedules.push({ id: uid(), memberId, date: dateStr, status, note: note || '' });
  }
  saveSchedules();
}

// ============================================================
// Member CRUD
// ============================================================
function addMember(name, color, department) {
  state.members.push({ id: uid(), name, color, department: department || '' });
  saveMembers();
}

function removeMember(memberId) {
  state.members = state.members.filter(m => m.id !== memberId);
  state.schedules = state.schedules.filter(s => s.memberId !== memberId);
  state.todos = state.todos.filter(t => t.assigneeId !== memberId);
  saveMembers();
  saveSchedules();
  saveTodos();
}

// ============================================================
// Todo CRUD
// ============================================================
function addTodo(title, assigneeId, priority, dueDate, desc) {
  state.todos.push({
    id: uid(), title, assigneeId, priority: priority || 'medium',
    dueDate: dueDate || '', description: desc || '', done: false, createdAt: new Date().toISOString()
  });
  saveTodos();
}

function toggleTodo(todoId) {
  const t = state.todos.find(x => x.id === todoId);
  if (t) { t.done = !t.done; saveTodos(); }
}

function deleteTodo(todoId) {
  state.todos = state.todos.filter(x => x.id !== todoId);
  saveTodos();
}

// ============================================================
// Workload Calculation
// ============================================================
function getWorkload(memberId) {
  const weekDates = getWeekDates(state.currentDate);
  const weekStart = formatDate(weekDates[0]);
  const weekEnd = formatDate(weekDates[4]);
  const scheduleCount = state.schedules.filter(s =>
    s.memberId === memberId && s.date >= weekStart && s.date <= weekEnd
  ).length;
  const incompleteTodos = state.todos.filter(t => t.assigneeId === memberId && !t.done).length;
  const needSupport = scheduleCount >= 10 || incompleteTodos >= 5;
  return { scheduleCount, incompleteTodos, needSupport };
}

// ============================================================
// Export / Import
// ============================================================
function exportData() {
  const data = { exportDate: new Date().toISOString(), members: state.members, schedules: state.schedules, todos: state.todos };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `part-schedule-${formatDate(new Date())}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function importData(file) {
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const data = JSON.parse(e.target.result);
      if (data.members) { state.members = data.members; saveMembers(); }
      if (data.schedules) { state.schedules = data.schedules; saveSchedules(); }
      if (data.todos) { state.todos = data.todos; saveTodos(); }
      renderAll();
      alert('데이터를 성공적으로 가져왔습니다.');
    } catch (err) { alert('파일 형식 오류: ' + err.message); }
  };
  reader.readAsText(file);
}


// ============================================================
// Rendering - Attendance Bar
// ============================================================
function renderAttendanceBar() {
  const chips = document.getElementById('attendance-chips');
  const alertEl = document.getElementById('attendance-alert');
  const alertNames = document.getElementById('alert-names');
  const today = formatDate(new Date());

  let chipsHtml = '';
  const needSupportList = [];

  state.members.forEach(member => {
    const schedule = state.schedules.find(s => s.memberId === member.id && s.date === today);
    const status = schedule ? schedule.status : '출근';
    const color = STATUS_COLORS[status];
    chipsHtml += `<span class="attendance-chip"><span class="chip-dot" style="background:${color}"></span>${member.name} <small>${status}</small></span>`;

    const wl = getWorkload(member.id);
    if (wl.needSupport) needSupportList.push(member.name);
  });

  chips.innerHTML = chipsHtml;

  if (needSupportList.length > 0) {
    alertEl.hidden = false;
    alertNames.textContent = needSupportList.join(', ');
  } else {
    alertEl.hidden = true;
  }
}

// ============================================================
// Rendering - Calendar
// ============================================================
function renderCalendar() {
  const weekDates = getWeekDates(state.currentDate);
  const today = formatDate(new Date());

  // Update header dates
  document.getElementById('week-label').textContent = getWeekLabel(weekDates);

  // Update th with dates
  const ths = document.querySelectorAll('.calendar-grid th.col-day');
  const dayNames = getDayNames();
  ths.forEach((th, i) => {
    const d = weekDates[i];
    const dateStr = formatDate(d);
    th.innerHTML = `${dayNames[i]}<br><small>${d.getMonth()+1}/${d.getDate()}</small>`;
    th.classList.toggle('today-col', dateStr === today);
  });

  // Build body
  const tbody = document.getElementById('calendar-body');
  let html = '';

  state.members.forEach(member => {
    html += '<tr>';
    html += `<td><div class="member-cell"><span class="member-dot" style="background:${member.color}"></span><span class="member-name-text">${member.name}</span></div></td>`;

    weekDates.forEach(d => {
      const dateStr = formatDate(d);
      const schedule = getSchedule(member.id, dateStr);
      if (schedule) {
        const color = STATUS_COLORS[schedule.status];
        const noteIcon = schedule.note ? '<span class="cell-note-icon">📝</span>' : '';
        html += `<td data-member="${member.id}" data-date="${dateStr}" title="${schedule.note || schedule.status}"><span class="cell-badge" style="background:${color}">${schedule.status}</span>${noteIcon}</td>`;
      } else {
        html += `<td data-member="${member.id}" data-date="${dateStr}"><span class="cell-empty">+</span></td>`;
      }
    });
    html += '</tr>';
  });

  tbody.innerHTML = html;
}

// ============================================================
// Rendering - Dashboard
// ============================================================
function renderDashboard() {
  const today = formatDate(new Date());
  const totalMembers = state.members.length;

  let tripCount = 0, vacationCount = 0, remoteCount = 0, needSupportCount = 0;
  const inProgressTodos = state.todos.filter(t => !t.done).length;

  state.members.forEach(member => {
    const schedule = state.schedules.find(s => s.memberId === member.id && s.date === today);
    const status = schedule ? schedule.status : '출근';
    if (status === '출장') tripCount++;
    if (status === '휴가') vacationCount++;
    if (status === '재택') remoteCount++;
    if (getWorkload(member.id).needSupport) needSupportCount++;
  });

  // Cards
  const cardsEl = document.getElementById('dashboard-cards');
  cardsEl.innerHTML = `
    <div class="dash-card"><span class="dash-card-value">${totalMembers}</span><span class="dash-card-label">전체 인원</span></div>
    <div class="dash-card"><span class="dash-card-value">${tripCount}</span><span class="dash-card-label">출장</span></div>
    <div class="dash-card"><span class="dash-card-value">${vacationCount}</span><span class="dash-card-label">휴가</span></div>
    <div class="dash-card"><span class="dash-card-value">${remoteCount}</span><span class="dash-card-label">재택</span></div>
    <div class="dash-card ${needSupportCount > 0 ? 'alert' : ''}"><span class="dash-card-value">${needSupportCount}</span><span class="dash-card-label">🔴 지원 필요</span></div>
    <div class="dash-card"><span class="dash-card-value">${inProgressTodos}</span><span class="dash-card-label">진행중 업무</span></div>
  `;

  // Workload table
  const workloadBody = document.getElementById('workload-body');
  let wHtml = '';
  state.members.forEach(member => {
    const schedule = state.schedules.find(s => s.memberId === member.id && s.date === today);
    const status = schedule ? schedule.status : '출근';
    const wl = getWorkload(member.id);
    const wlClass = wl.needSupport ? 'workload-alert' : 'workload-normal';
    const wlText = wl.needSupport ? '🔴 지원 필요' : '🟢 정상';
    wHtml += `<tr>
      <td><span class="member-color-dot" style="background:${member.color}"></span> ${member.name}</td>
      <td><span class="status-tag" style="background:${STATUS_COLORS[status]}">${status}</span></td>
      <td>${wl.scheduleCount}</td>
      <td>${wl.incompleteTodos}</td>
      <td class="${wlClass}">${wlText}</td>
    </tr>`;
  });
  workloadBody.innerHTML = wHtml;

  // Summary
  const summaryEl = document.getElementById('summary-list');
  summaryEl.innerHTML = `
    <div class="summary-item"><span class="summary-icon">👥</span> 전체 ${totalMembers}명 중 ${totalMembers - vacationCount - tripCount}명 근무중</div>
    <div class="summary-item"><span class="summary-icon">✈️</span> 출장 ${tripCount}명</div>
    <div class="summary-item"><span class="summary-icon">🏖️</span> 휴가 ${vacationCount}명</div>
    <div class="summary-item"><span class="summary-icon">🏠</span> 재택 ${remoteCount}명</div>
    <div class="summary-item"><span class="summary-icon">📋</span> 진행중 To Do ${inProgressTodos}건</div>
    ${needSupportCount > 0 ? `<div class="summary-item"><span class="summary-icon">⚠️</span> 지원 필요 ${needSupportCount}명</div>` : ''}
  `;
}


// ============================================================
// Rendering - To Do
// ============================================================
function renderTodos() {
  const list = document.getElementById('todo-list');
  let filtered = [...state.todos];

  if (state.todoFilter === 'inprogress') filtered = filtered.filter(t => !t.done);
  else if (state.todoFilter === 'done') filtered = filtered.filter(t => t.done);

  // Sort: incomplete first, then by priority
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  filtered.sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    return (priorityOrder[a.priority] || 1) - (priorityOrder[b.priority] || 1);
  });

  if (filtered.length === 0) {
    list.innerHTML = '<p style="text-align:center;color:var(--color-text-secondary);padding:24px;">등록된 할 일이 없습니다.</p>';
  } else {
    let html = '';
    filtered.forEach(todo => {
      const assignee = state.members.find(m => m.id === todo.assigneeId);
      const assigneeName = assignee ? assignee.name : '-';
      const dueStr = todo.dueDate ? `마감: ${todo.dueDate}` : '';
      const priorityLabel = { high: '높음', medium: '보통', low: '낮음' }[todo.priority] || '보통';

      html += `
        <div class="todo-item ${todo.done ? 'done' : ''}">
          <input type="checkbox" class="todo-check" data-id="${todo.id}" ${todo.done ? 'checked' : ''}>
          <div class="todo-content">
            <div class="todo-title">${todo.title}</div>
            <div class="todo-meta">
              <span>👤 ${assigneeName}</span>
              <span class="todo-priority priority-${todo.priority}">${priorityLabel}</span>
              ${dueStr ? `<span>📅 ${dueStr}</span>` : ''}
            </div>
          </div>
          <button class="todo-delete" data-id="${todo.id}" title="삭제">🗑️</button>
        </div>
      `;
    });
    list.innerHTML = html;
  }

  // Progress
  const total = state.todos.length;
  const done = state.todos.filter(t => t.done).length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  document.getElementById('todo-progress-fill').style.width = pct + '%';
  document.getElementById('todo-progress-percent').textContent = pct + '%';
}

// ============================================================
// Rendering - Members
// ============================================================
function renderMembers() {
  const tbody = document.getElementById('member-list-body');
  document.getElementById('member-count').textContent = state.members.length;

  let html = '';
  state.members.forEach(member => {
    const wl = getWorkload(member.id);
    const wlClass = wl.needSupport ? 'workload-alert' : 'workload-normal';
    const wlText = wl.needSupport ? '🔴 지원 필요' : '🟢 정상';
    html += `<tr>
      <td><span class="member-color-dot" style="background:${member.color}"></span></td>
      <td>${member.name}</td>
      <td>${member.department}</td>
      <td class="${wlClass}">${wlText}</td>
      <td><button class="btn-danger btn-sm" data-delete-member="${member.id}">삭제</button></td>
    </tr>`;
  });
  tbody.innerHTML = html;
}

// ============================================================
// Render All
// ============================================================
function renderAll() {
  renderAttendanceBar();
  renderCalendar();
  renderDashboard();
  renderTodos();
  renderMembers();
}

// ============================================================
// View Switching
// ============================================================
function switchView(view) {
  state.currentView = view;

  // Update sidebar
  document.querySelectorAll('.sidebar-menu-item').forEach(item => {
    item.classList.toggle('active', item.dataset.view === view);
  });

  // Show/hide panels
  document.querySelectorAll('.view-panel').forEach(panel => {
    panel.hidden = panel.id !== `view-${view}`;
  });

  // Re-render active view
  if (view === 'calendar') renderCalendar();
  else if (view === 'dashboard') renderDashboard();
  else if (view === 'todo') renderTodos();
  else if (view === 'members') renderMembers();
}

// ============================================================
// Status Modal
// ============================================================
function openStatusModal(memberId, dateStr) {
  const modal = document.getElementById('modal-status');
  const existing = getSchedule(memberId, dateStr);
  const member = state.members.find(m => m.id === memberId);
  const deleteBtn = document.getElementById('btn-delete-status');

  state.statusModal = { memberId, date: dateStr, selectedStatus: existing ? existing.status : null };

  document.getElementById('status-modal-title').textContent = `${member ? member.name : ''} - ${dateStr}`;
  document.getElementById('status-note').value = existing ? existing.note : '';
  deleteBtn.hidden = !existing;

  // Highlight active status
  document.querySelectorAll('.status-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.status === (existing ? existing.status : ''));
  });

  modal.hidden = false;
}

function closeStatusModal() {
  document.getElementById('modal-status').hidden = true;
  state.statusModal = { memberId: null, date: null, selectedStatus: null };
}

function saveStatus() {
  const { memberId, date, selectedStatus } = state.statusModal;
  if (!selectedStatus) { alert('상태를 선택해주세요.'); return; }
  const note = document.getElementById('status-note').value.trim();
  setSchedule(memberId, date, selectedStatus, note);
  closeStatusModal();
  renderAll();
}

function deleteStatus() {
  const { memberId, date } = state.statusModal;
  setSchedule(memberId, date, null, '');
  closeStatusModal();
  renderAll();
}

// ============================================================
// Todo Modal
// ============================================================
function openTodoModal() {
  const modal = document.getElementById('modal-todo');
  const select = document.getElementById('todo-assignee');

  // Populate assignee dropdown
  let optHtml = '<option value="">-- 선택 --</option>';
  state.members.forEach(m => { optHtml += `<option value="${m.id}">${m.name}</option>`; });
  select.innerHTML = optHtml;

  // Reset form
  document.getElementById('todo-title').value = '';
  document.getElementById('todo-priority').value = 'medium';
  document.getElementById('todo-due').value = '';
  document.getElementById('todo-desc').value = '';

  modal.hidden = false;
}

function closeTodoModal() {
  document.getElementById('modal-todo').hidden = true;
}

function saveTodo() {
  const title = document.getElementById('todo-title').value.trim();
  if (!title) { alert('제목을 입력해주세요.'); return; }
  const assigneeId = document.getElementById('todo-assignee').value;
  const priority = document.getElementById('todo-priority').value;
  const dueDate = document.getElementById('todo-due').value;
  const desc = document.getElementById('todo-desc').value.trim();
  addTodo(title, assigneeId, priority, dueDate, desc);
  closeTodoModal();
  renderTodos();
  renderDashboard();
  renderAttendanceBar();
}


// ============================================================
// Event Bindings
// ============================================================
function bindEvents() {
  // Sidebar navigation
  document.querySelectorAll('.sidebar-menu-item').forEach(item => {
    item.addEventListener('click', () => {
      switchView(item.dataset.view);
      // Close mobile sidebar
      document.getElementById('sidebar').classList.remove('open');
      document.getElementById('sidebar-overlay').classList.remove('open');
    });
  });

  // Mobile hamburger
  document.getElementById('btn-hamburger').addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('open');
    document.getElementById('sidebar-overlay').classList.toggle('open');
  });

  // Mobile overlay close
  document.getElementById('sidebar-overlay').addEventListener('click', () => {
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('sidebar-overlay').classList.remove('open');
  });

  // Week navigation
  document.getElementById('btn-prev-week').addEventListener('click', () => {
    state.currentDate.setDate(state.currentDate.getDate() - 7);
    renderCalendar();
    renderAttendanceBar();
  });

  document.getElementById('btn-next-week').addEventListener('click', () => {
    state.currentDate.setDate(state.currentDate.getDate() + 7);
    renderCalendar();
    renderAttendanceBar();
  });

  document.getElementById('btn-today').addEventListener('click', () => {
    state.currentDate = new Date();
    renderCalendar();
    renderAttendanceBar();
  });

  // Calendar cell clicks (event delegation)
  document.getElementById('calendar-body').addEventListener('click', (e) => {
    const td = e.target.closest('td[data-member]');
    if (td) {
      openStatusModal(td.dataset.member, td.dataset.date);
    }
  });

  // Status modal
  document.getElementById('btn-close-status').addEventListener('click', closeStatusModal);
  document.getElementById('btn-save-status').addEventListener('click', saveStatus);
  document.getElementById('btn-delete-status').addEventListener('click', deleteStatus);

  document.querySelectorAll('.status-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      state.statusModal.selectedStatus = btn.dataset.status;
      document.querySelectorAll('.status-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  // Close status modal on overlay click
  document.getElementById('modal-status').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeStatusModal();
  });

  // Todo modal
  document.getElementById('btn-add-todo').addEventListener('click', openTodoModal);
  document.getElementById('btn-close-todo').addEventListener('click', closeTodoModal);
  document.getElementById('btn-cancel-todo').addEventListener('click', closeTodoModal);
  document.getElementById('btn-save-todo').addEventListener('click', saveTodo);

  document.getElementById('modal-todo').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeTodoModal();
  });

  // Todo filters
  document.getElementById('todo-filters').addEventListener('click', (e) => {
    const btn = e.target.closest('.filter-btn');
    if (btn) {
      state.todoFilter = btn.dataset.filter;
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderTodos();
    }
  });

  // Todo list clicks (check/delete via delegation)
  document.getElementById('todo-list').addEventListener('click', (e) => {
    const check = e.target.closest('.todo-check');
    if (check) {
      toggleTodo(check.dataset.id);
      renderTodos();
      renderDashboard();
      renderAttendanceBar();
      return;
    }
    const del = e.target.closest('.todo-delete');
    if (del) {
      if (confirm('이 할 일을 삭제하시겠습니까?')) {
        deleteTodo(del.dataset.id);
        renderTodos();
        renderDashboard();
        renderAttendanceBar();
      }
    }
  });

  // Member form
  document.getElementById('form-add-member').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('input-member-name').value.trim();
    const dept = document.getElementById('input-member-dept').value.trim();
    const color = document.getElementById('input-member-color').value;
    if (!name) { alert('이름을 입력해주세요.'); return; }
    addMember(name, color, dept);
    document.getElementById('input-member-name').value = '';
    document.getElementById('input-member-dept').value = '';
    renderAll();
  });

  // Member delete (delegation)
  document.getElementById('member-list-body').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-delete-member]');
    if (btn) {
      if (confirm('이 팀원을 삭제하시겠습니까? 관련 일정/할 일도 함께 삭제됩니다.')) {
        removeMember(btn.dataset.deleteMember);
        renderAll();
      }
    }
  });

  // Export / Import
  document.getElementById('btn-export').addEventListener('click', exportData);
  document.getElementById('btn-import').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) { importData(file); e.target.value = ''; }
  });
}

// ============================================================
// Initialization
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  loadData();
  bindEvents();
  renderAll();
});
