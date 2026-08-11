/**
 * 패키징기술파트 Schedule
 * 데이터 저장: localStorage (브라우저 로컬)
 */

// ===== Constants =====
const STATUS = ['출장', '휴가', '교육', '기타'];
const S_COLOR = { '출장': '#f59e0b', '휴가': '#3b82f6', '교육': '#8b5cf6', '기타': '#6b7280' };
const S_CLASS = { '출장': 'b-trip', '휴가': 'b-vac', '교육': 'b-edu', '기타': 'b-etc' };
const POSITIONS = ['파트장', '책임연구원', '선임연구원'];
const P_LABEL = { high: '🔴 높음', medium: '🟡 보통', low: '🟢 낮음' };
const P_CLASS = { high: 'p-h', medium: 'p-m', low: 'p-l' };

const K = { m: 'ps2_members', s: 'ps2_sch', t: 'ps2_todos', n: 'ps2_notices' };

const DEFAULT_MEMBERS = [
  { id: uid(), name: '홍길동', position: '파트장', empNo: '', email: '', color: '#e11d48' },
  { id: uid(), name: '김철수', position: '책임연구원', empNo: '', email: '', color: '#2563eb' },
  { id: uid(), name: '이영희', position: '책임연구원', empNo: '', email: '', color: '#0d9488' },
  { id: uid(), name: '박민수', position: '선임연구원', empNo: '', email: '', color: '#ea580c' },
  { id: uid(), name: '정수진', position: '선임연구원', empNo: '', email: '', color: '#7c3aed' },
  { id: uid(), name: '한지원', position: '선임연구원', empNo: '', email: '', color: '#0891b2' }
];

// ===== State =====
let members = [], schedules = [], todos = [], notices = [];
let curDate = new Date();
let view = 'calendar';
let tFilter = 'all', tMemberFilter = 'all', hideDone = false;
let sCtx = { mid: null, date: null, sel: null };

// ===== Helpers =====
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 9); }
function fmt(d) { const x = new Date(d); return `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}-${String(x.getDate()).padStart(2,'0')}`; }
function today() { return fmt(new Date()); }
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function weekOf(date) {
  const d = new Date(date), day = d.getDay();
  const mon = new Date(d); mon.setDate(d.getDate() - day + (day === 0 ? -6 : 1));
  return Array.from({ length: 5 }, (_, i) => { const x = new Date(mon); x.setDate(mon.getDate() + i); return x; });
}
function daysLeft(dueStr) {
  if (!dueStr) return null;
  const diff = new Date(dueStr + 'T00:00:00') - new Date(today() + 'T00:00:00');
  return Math.round(diff / 86400000);
}
function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg; el.hidden = false;
  clearTimeout(el._t);
  el._t = setTimeout(() => { el.hidden = true; }, 2200);
}
function $(id) { return document.getElementById(id); }

// ===== Persistence =====
function load() {
  try {
    members = JSON.parse(localStorage.getItem(K.m)) || [...DEFAULT_MEMBERS];
    schedules = JSON.parse(localStorage.getItem(K.s)) || [];
    todos = JSON.parse(localStorage.getItem(K.t)) || [];
    notices = JSON.parse(localStorage.getItem(K.n)) || [];
  } catch (e) {
    members = [...DEFAULT_MEMBERS]; schedules = []; todos = []; notices = [];
  }
  save();
}
function save() {
  localStorage.setItem(K.m, JSON.stringify(members));
  localStorage.setItem(K.s, JSON.stringify(schedules));
  localStorage.setItem(K.t, JSON.stringify(todos));
  localStorage.setItem(K.n, JSON.stringify(notices));
}

// ===== Backup / Restore =====
function backup() {
  const data = { version: 2, exportedAt: new Date().toISOString(), members, schedules, todos, notices };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `파트스케줄_백업_${today()}.json`;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
  toast('백업 파일이 저장되었습니다 💾');
}

function restore(file) {
  const r = new FileReader();
  r.onload = e => {
    try {
      const d = JSON.parse(e.target.result);
      if (!d.members) throw new Error('형식 오류');
      if (!confirm('현재 데이터를 백업 파일 내용으로 덮어씁니다. 계속할까요?')) return;
      members = d.members || []; schedules = d.schedules || [];
      todos = d.todos || []; notices = d.notices || [];
      save(); renderAll(); toast('백업을 불러왔습니다 ✅');
    } catch (err) { alert('불러오기 실패: ' + err.message); }
  };
  r.readAsText(file);
}

// ===== Schedule =====
function getSch(mid, date) { return schedules.find(s => s.memberId === mid && s.date === date); }
function setSch(mid, date, status, note) {
  const i = schedules.findIndex(s => s.memberId === mid && s.date === date);
  if (i >= 0) {
    if (status) { schedules[i].status = status; schedules[i].note = note || ''; }
    else schedules.splice(i, 1);
  } else if (status) {
    schedules.push({ id: uid(), memberId: mid, date, status, note: note || '' });
  }
  save();
}

// ===== Member =====
function addMember(o) { members.push({ id: uid(), ...o }); save(); }
function updMember(id, patch) { const m = members.find(x => x.id === id); if (m) { Object.assign(m, patch); save(); } }
function delMember(id) {
  const m = members.find(x => x.id === id);
  if (!confirm(`'${m ? m.name : ''}' 팀원을 삭제합니다.\n관련 일정과 할 일도 함께 삭제됩니다. 계속할까요?`)) return;
  members = members.filter(x => x.id !== id);
  schedules = schedules.filter(x => x.memberId !== id);
  todos = todos.filter(x => x.assigneeId !== id);
  save(); renderAll(); toast('팀원이 삭제되었습니다');
}

// ===== Todo =====
function addTodo(o) { todos.push({ id: uid(), done: false, createdAt: new Date().toISOString(), ...o }); save(); }
function updTodo(id, patch) { const t = todos.find(x => x.id === id); if (t) { Object.assign(t, patch); save(); } }
function delTodo(id) { todos = todos.filter(x => x.id !== id); save(); }

// ===== Notice =====
function addNotice(o) { notices.unshift({ id: uid(), date: new Date().toISOString(), ...o }); save(); }
function updNotice(id, patch) { const n = notices.find(x => x.id === id); if (n) { Object.assign(n, patch); save(); } }
function delNotice(id) { notices = notices.filter(x => x.id !== id); save(); }

// ===== Workload =====
function stat(mid) {
  const mine = todos.filter(t => t.assigneeId === mid);
  const open = mine.filter(t => !t.done);
  const done = mine.filter(t => t.done);
  const sup = open.some(t => t.needSupport);
  const dueSoon = open.filter(t => { const d = daysLeft(t.dueDate); return d !== null && d <= 2; }).length;
  const pct = mine.length ? Math.round(done.length / mine.length * 100) : 0;
  return { total: mine.length, open: open.length, done: done.length, sup, dueSoon, pct,
           need: sup || open.length >= 5 };
}


// ===== Render: Calendar =====
function renderCalendar() {
  const dates = weekOf(curDate), td = today(), names = ['월','화','수','목','금'];
  const ws = fmt(dates[0]), we = fmt(dates[4]);

  $('week-label').textContent = `${dates[0].getFullYear()}.${dates[0].getMonth()+1}.${dates[0].getDate()} ~ ${dates[4].getMonth()+1}.${dates[4].getDate()}`;

  const ths = document.querySelectorAll('.sch-table thead th');
  for (let i = 1; i <= 5; i++) {
    const d = dates[i-1];
    ths[i].innerHTML = `${names[i-1]}<br><small style="font-weight:500;opacity:.85">${d.getMonth()+1}/${d.getDate()}</small>`;
    ths[i].classList.toggle('today', fmt(d) === td);
  }

  let html = '';
  members.forEach(m => {
    html += '<tr>';
    html += `<td><div class="mcell"><span class="mdot" style="background:${m.color}"></span>${esc(m.name)}</div></td>`;
    dates.forEach(d => {
      const ds = fmt(d), s = getSch(m.id, ds);
      if (s) {
        html += `<td class="clk" data-mid="${m.id}" data-date="${ds}" title="${esc(s.note || s.status)}">`
              + `<span class="badge ${S_CLASS[s.status] || 'b-etc'}">${s.status}</span>`
              + (s.note ? '<span class="note-ico">📝</span>' : '') + '</td>';
      } else {
        html += `<td class="clk" data-mid="${m.id}" data-date="${ds}"><span class="empty">·</span></td>`;
      }
    });

    // 주간 할 일 컬럼: 이번 주 관련 todo (마감일이 주 범위 내 or 마감없는 미완료)
    const wTodos = todos.filter(t => t.assigneeId === m.id &&
      ((t.dueDate && t.dueDate >= ws && t.dueDate <= we) || (!t.dueDate && !t.done))).slice(0, 4);
    let tHtml = '';
    if (wTodos.length) {
      tHtml = '<div class="mini-todos">' + wTodos.map(t => {
        const c = t.needSupport && !t.done ? '#dc2626' : (t.priority === 'high' ? '#f59e0b' : '#94a3b8');
        return `<span class="mini-todo ${t.done?'done':''}"><span class="mini-dot" style="background:${c}"></span>${esc(t.title)}</span>`;
      }).join('') + '</div>';
    } else {
      tHtml = '<span class="mini-add">+ 할 일 추가</span>';
    }
    html += `<td class="todo-cell" data-add-todo="${m.id}" title="클릭하여 할 일 추가">${tHtml}</td>`;
    html += '</tr>';
  });
  $('sch-body').innerHTML = html || '<tr><td colspan="7" class="none-txt">등록된 팀원이 없습니다. 팀원 관리에서 추가하세요.</td></tr>';
}

// ===== Render: Dashboard =====
function renderDashboard() {
  const td = today();
  const now = new Date();
  $('dash-date').textContent = `${now.getFullYear()}.${now.getMonth()+1}.${now.getDate()} 기준`;

  let trip = 0, vac = 0, edu = 0, etc = 0, need = 0;
  members.forEach(m => {
    const s = getSch(m.id, td);
    if (s) { if (s.status==='출장') trip++; else if (s.status==='휴가') vac++; else if (s.status==='교육') edu++; else etc++; }
    if (stat(m.id).need) need++;
  });
  const open = todos.filter(t => !t.done).length;
  const dueSoon = todos.filter(t => !t.done && (() => { const d = daysLeft(t.dueDate); return d !== null && d <= 2; })()).length;

  $('dash-cards').innerHTML = `
    <div class="card"><div class="card-val">${members.length}</div><div class="card-lb">전체 인원</div></div>
    <div class="card"><div class="card-val">${members.length - trip - vac - edu - etc}</div><div class="card-lb">🏢 출근</div></div>
    <div class="card"><div class="card-val">${trip}</div><div class="card-lb">✈️ 출장</div></div>
    <div class="card"><div class="card-val">${vac}</div><div class="card-lb">🏖️ 휴가</div></div>
    <div class="card"><div class="card-val">${edu}</div><div class="card-lb">📚 교육</div></div>
    <div class="card"><div class="card-val">${open}</div><div class="card-lb">📋 진행중 업무</div></div>
    <div class="card ${dueSoon?'alert':''}"><div class="card-val">${dueSoon}</div><div class="card-lb">⏰ 마감 임박</div></div>
    <div class="card ${need?'alert':''}"><div class="card-val">${need}</div><div class="card-lb">🔴 지원 필요</div></div>
  `;

  $('dash-body').innerHTML = members.map(m => {
    const s = getSch(m.id, td), st = s ? s.status : '출근';
    const cls = s ? (S_CLASS[st] || 'b-etc') : 'b-work';
    const k = stat(m.id);
    return `<tr>
      <td><div class="mcell"><span class="mdot" style="background:${m.color}"></span>${esc(m.name)}</div></td>
      <td>${esc(m.position)}</td>
      <td><span class="badge ${cls}">${st}</span></td>
      <td>${k.open}</td><td>${k.done}</td>
      <td>${k.need ? '<b style="color:#dc2626">🔴 지원 필요</b>' : '<span style="color:#16a34a">🟢 정상</span>'}</td>
    </tr>`;
  }).join('') || '<tr><td colspan="6" class="none-txt">팀원이 없습니다</td></tr>';

  // Alerts
  let aHtml = '';
  members.forEach(m => {
    const k = stat(m.id);
    if (k.need) aHtml += `<div class="alert-item">🔴 <b>${esc(m.name)}</b> · 진행중 ${k.open}건${k.sup?' · 지원요청':''}</div>`;
  });
  todos.filter(t => !t.done).forEach(t => {
    const d = daysLeft(t.dueDate);
    if (d !== null && d <= 2) {
      const m = members.find(x => x.id === t.assigneeId);
      const lb = d < 0 ? `${-d}일 지남` : (d === 0 ? '오늘 마감' : `${d}일 남음`);
      aHtml += `<div class="alert-item due">⏰ <b>${esc(t.title)}</b> · ${m?esc(m.name):'미지정'} · ${lb}</div>`;
    }
  });
  $('dash-alerts').innerHTML = aHtml || '<div class="none-txt">특이사항 없습니다 ✅</div>';

  // Recent notices
  $('dash-notices').innerHTML = notices.slice(0, 3).map(n => {
    const d = new Date(n.date);
    return `<div class="mini-notice"><b>${esc(n.title)}</b><span>${d.getFullYear()}.${d.getMonth()+1}.${d.getDate()} · ${esc(n.author||'-')}</span></div>`;
  }).join('') || '<div class="none-txt">공지 없음</div>';
}


// ===== Render: Todo =====
function renderTodos() {
  // 팀원별 요약
  $('todo-summary-body').innerHTML = members.map(m => {
    const k = stat(m.id);
    return `<tr>
      <td><div class="mcell"><span class="mdot" style="background:${m.color}"></span>${esc(m.name)}</div></td>
      <td>${esc(m.position)}</td>
      <td>${k.open}</td><td>${k.done}</td>
      <td>${k.sup ? '<b style="color:#dc2626">🔴</b>' : '-'}</td>
      <td><span class="mini-prog"><i style="width:${k.pct}%"></i></span> <small>${k.pct}%</small></td>
      <td><button class="addbtn" data-add-todo="${m.id}" title="${esc(m.name)}에게 할 일 추가">+</button></td>
    </tr>`;
  }).join('') || '<tr><td colspan="7" class="none-txt">팀원이 없습니다</td></tr>';

  // 목록
  let list = todos.slice();
  if (tMemberFilter !== 'all') list = list.filter(t => t.assigneeId === tMemberFilter);
  if (tFilter === 'inprogress') list = list.filter(t => !t.done);
  else if (tFilter === 'done') list = list.filter(t => t.done);
  else if (tFilter === 'support') list = list.filter(t => !t.done && t.needSupport);
  else if (tFilter === 'duesoon') list = list.filter(t => { if (t.done) return false; const d = daysLeft(t.dueDate); return d !== null && d <= 2; });
  if (hideDone) list = list.filter(t => !t.done);

  const po = { high: 0, medium: 1, low: 2 };
  list.sort((a, b) => (a.done - b.done) || (po[a.priority] ?? 1) - (po[b.priority] ?? 1)
    || (a.dueDate || 'zzz').localeCompare(b.dueDate || 'zzz'));

  $('todo-list').innerHTML = list.map(t => {
    const m = members.find(x => x.id === t.assigneeId);
    const d = daysLeft(t.dueDate);
    const soon = !t.done && d !== null && d <= 2;
    const dueTxt = t.dueDate ? (d < 0 ? `⏰ ${-d}일 지남` : d === 0 ? '⏰ 오늘 마감' : d <= 2 ? `⏰ ${d}일 남음` : `📅 ${t.dueDate}`) : '';
    return `<div class="titem ${t.done?'done':''} ${!t.done&&t.needSupport?'sup':soon?'due':''}">
      <input type="checkbox" class="tchk" data-chk="${t.id}" ${t.done?'checked':''}>
      <div class="tbody-c">
        <div class="tt-title">${!t.done&&t.needSupport?'🔴 ':''}${esc(t.title)}</div>
        <div class="tt-meta">
          <span>👤 ${m?esc(m.name):'미지정'}</span>
          <span class="tprio ${P_CLASS[t.priority]||'p-m'}">${P_LABEL[t.priority]||'🟡 보통'}</span>
          ${dueTxt?`<span${soon?' style="color:#d97706;font-weight:600"':''}>${dueTxt}</span>`:''}
          ${t.description?`<span title="${esc(t.description)}">💬</span>`:''}
        </div>
      </div>
      <div class="tacts">
        <button class="iconbtn" data-edit-todo="${t.id}" title="수정">✏️</button>
        <button class="iconbtn del" data-del-todo="${t.id}" title="삭제">🗑️</button>
      </div>
    </div>`;
  }).join('') || '<div class="none-txt">해당 조건의 할 일이 없습니다.</div>';

  const tot = todos.length, dn = todos.filter(t => t.done).length;
  const pct = tot ? Math.round(dn / tot * 100) : 0;
  $('todo-prog').style.width = pct + '%';
  $('todo-pct').textContent = pct + '%';

  const sel = $('todo-member-filter'), cur = sel.value;
  sel.innerHTML = '<option value="all">전체 팀원</option>' + members.map(m => `<option value="${m.id}">${esc(m.name)}</option>`).join('');
  sel.value = members.some(m => m.id === cur) ? cur : 'all';
  $('btn-toggle-done').textContent = hideDone ? '완료 항목 보기' : '완료 항목 숨기기';
}

// ===== Render: Notice =====
function renderNotices() {
  const icon = { '공지': '📢', '회의록': '📝', '메모': '💡' };
  $('notice-list').innerHTML = notices.map(n => {
    const d = new Date(n.date);
    const ds = `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
    return `<div class="ncard type-${n.type||'공지'}">
      <div class="n-acts">
        <button class="sbtn" data-edit-notice="${n.id}">수정</button>
        <button class="dbtn" data-del-notice="${n.id}">삭제</button>
      </div>
      <div class="n-top"><span class="n-type">${icon[n.type]||'📢'} ${esc(n.type||'공지')}</span><h4>${esc(n.title)}</h4></div>
      ${n.content?`<p>${esc(n.content)}</p>`:''}
      <div class="n-meta">✍️ ${esc(n.author||'-')} · ${ds}${n.editedAt?' (수정됨)':''}</div>
    </div>`;
  }).join('') || '<div class="none-txt">등록된 공지사항이 없습니다. 우측 상단 "+ 작성" 버튼을 눌러 추가하세요.</div>';
}

// ===== Render: Members (inline editable) =====
function renderMembers() {
  $('member-count-txt').textContent = `총 ${members.length}명`;
  $('member-body').innerHTML = members.map(m => `
    <tr data-mid="${m.id}">
      <td><input type="color" class="cdot" value="${m.color}" data-field="color" title="색상 변경"></td>
      <td class="edit-cell" data-field="name">${esc(m.name)}</td>
      <td class="edit-cell" data-field="position">${esc(m.position)}</td>
      <td class="edit-cell" data-field="empNo">${esc(m.empNo) || '<span style="color:#cbd5e1">-</span>'}</td>
      <td class="edit-cell" data-field="email">${esc(m.email) || '<span style="color:#cbd5e1">-</span>'}</td>
      <td><button class="dbtn" data-del-member="${m.id}">삭제</button></td>
    </tr>`).join('') || '<tr><td colspan="6" class="none-txt">등록된 팀원이 없습니다.</td></tr>';
}

// ===== Inline edit =====
function startInlineEdit(td) {
  if (td.querySelector('input, select')) return;
  const tr = td.closest('tr'), mid = tr.dataset.mid, field = td.dataset.field;
  const m = members.find(x => x.id === mid);
  if (!m) return;
  const orig = m[field] || '';

  let el;
  if (field === 'position') {
    el = document.createElement('select');
    el.className = 'inline-sel';
    el.innerHTML = POSITIONS.map(p => `<option value="${p}" ${p===orig?'selected':''}>${p}</option>`).join('');
  } else {
    el = document.createElement('input');
    el.className = 'inline-inp';
    el.type = field === 'email' ? 'email' : 'text';
    el.value = orig;
  }
  td.innerHTML = '';
  td.appendChild(el);
  el.focus();
  if (el.select) el.select();

  let closed = false;
  const commit = () => {
    if (closed) return; closed = true;
    const val = el.value.trim();
    if (val !== orig) { updMember(mid, { [field]: val }); toast('저장되었습니다'); }
    renderAll();
  };
  const cancel = () => { if (closed) return; closed = true; renderMembers(); };

  el.addEventListener('blur', commit);
  el.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); commit(); }
    else if (e.key === 'Escape') { e.preventDefault(); cancel(); }
  });
  if (field === 'position') el.addEventListener('change', commit);
}

// ===== Render All =====
function renderAll() {
  renderCalendar(); renderDashboard(); renderTodos(); renderNotices(); renderMembers();
}


// ===== View switching =====
function switchView(v) {
  view = v;
  document.querySelectorAll('.nav-btn[data-view]').forEach(b => b.classList.toggle('active', b.dataset.view === v));
  document.querySelectorAll('.view').forEach(s => s.classList.toggle('active', s.id === 'view-' + v));
  if (v === 'calendar') renderCalendar();
  else if (v === 'dashboard') renderDashboard();
  else if (v === 'todo') renderTodos();
  else if (v === 'notice') renderNotices();
  else if (v === 'members') renderMembers();
  closeSidebar();
}
function closeSidebar() {
  $('sidebar').classList.remove('open');
  $('ovl').classList.remove('open');
}
function openModal(id) { $(id).hidden = false; }
function closeModal(id) { $(id).hidden = true; }

// ===== Status modal =====
function openStatus(mid, date) {
  const m = members.find(x => x.id === mid), s = getSch(mid, date);
  sCtx = { mid, date, sel: s ? s.status : null };
  $('status-title').textContent = `${m ? m.name : ''} · ${date}`;
  $('status-note').value = s ? (s.note || '') : '';
  $('btn-status-clear').hidden = !s;
  document.querySelectorAll('.sopt').forEach(b => b.classList.toggle('on', b.dataset.status === sCtx.sel));
  openModal('modal-status');
}

// ===== Todo modal =====
function openTodo(presetMid, editId) {
  const sel = $('td-assignee');
  sel.innerHTML = members.map(m => `<option value="${m.id}">${esc(m.name)}</option>`).join('');
  $('todo-edit-id').value = editId || '';

  if (editId) {
    const t = todos.find(x => x.id === editId);
    if (!t) return;
    $('todo-modal-title').textContent = '할 일 수정';
    $('td-title').value = t.title;
    sel.value = t.assigneeId || '';
    $('td-priority').value = t.priority || 'medium';
    $('td-start').value = t.startDate || '';
    $('td-due').value = t.dueDate || '';
    $('td-support').checked = !!t.needSupport;
    $('td-desc').value = t.description || '';
  } else {
    $('todo-modal-title').textContent = '할 일 추가';
    $('td-title').value = '';
    if (presetMid) sel.value = presetMid;
    $('td-priority').value = 'medium';
    $('td-start').value = '';
    $('td-due').value = '';
    $('td-support').checked = false;
    $('td-desc').value = '';
  }
  openModal('modal-todo');
  setTimeout(() => $('td-title').focus(), 50);
}

function saveTodoModal() {
  const title = $('td-title').value.trim();
  if (!title) { alert('제목을 입력해주세요.'); return; }
  const assigneeId = $('td-assignee').value;
  if (!assigneeId) { alert('담당자를 선택해주세요.'); return; }
  const o = {
    title, assigneeId,
    priority: $('td-priority').value,
    startDate: $('td-start').value,
    dueDate: $('td-due').value,
    needSupport: $('td-support').checked,
    description: $('td-desc').value.trim()
  };
  const editId = $('todo-edit-id').value;
  if (editId) { updTodo(editId, o); toast('수정되었습니다'); }
  else { addTodo(o); toast('할 일이 추가되었습니다'); }
  closeModal('modal-todo'); renderAll();
}

// ===== Notice modal =====
function openNotice(editId) {
  const sel = $('nt-author');
  sel.innerHTML = '<option value="">-- 선택 --</option>' + members.map(m => `<option value="${esc(m.name)}">${esc(m.name)}</option>`).join('');
  $('notice-edit-id').value = editId || '';
  if (editId) {
    const n = notices.find(x => x.id === editId);
    if (!n) return;
    $('notice-modal-title').textContent = '공지사항 수정';
    $('nt-title').value = n.title;
    sel.value = n.author || '';
    $('nt-type').value = n.type || '공지';
    $('nt-content').value = n.content || '';
  } else {
    $('notice-modal-title').textContent = '공지사항 작성';
    $('nt-title').value = ''; sel.value = '';
    $('nt-type').value = '공지'; $('nt-content').value = '';
  }
  openModal('modal-notice');
  setTimeout(() => $('nt-title').focus(), 50);
}

function saveNoticeModal() {
  const title = $('nt-title').value.trim();
  if (!title) { alert('제목을 입력해주세요.'); return; }
  const o = { title, author: $('nt-author').value, type: $('nt-type').value, content: $('nt-content').value.trim() };
  const editId = $('notice-edit-id').value;
  if (editId) { updNotice(editId, { ...o, editedAt: new Date().toISOString() }); toast('수정되었습니다'); }
  else { addNotice(o); toast('공지가 등록되었습니다'); }
  closeModal('modal-notice'); renderNotices(); renderDashboard();
}

// ===== Member modal =====
function openMemberModal() {
  $('mb-name').value = ''; $('mb-position').value = '선임연구원';
  $('mb-empno').value = ''; $('mb-email').value = '';
  $('mb-color').value = '#' + Math.floor(Math.random()*0xffffff).toString(16).padStart(6,'0');
  openModal('modal-member');
  setTimeout(() => $('mb-name').focus(), 50);
}
function saveMemberModal() {
  const name = $('mb-name').value.trim();
  if (!name) { alert('이름을 입력해주세요.'); return; }
  addMember({ name, position: $('mb-position').value, empNo: $('mb-empno').value.trim(),
              email: $('mb-email').value.trim(), color: $('mb-color').value });
  closeModal('modal-member'); renderAll(); toast(`${name} 팀원이 추가되었습니다`);
}

// ===== Bindings =====
function bind() {
  // nav
  document.querySelectorAll('.nav-btn[data-view]').forEach(b =>
    b.addEventListener('click', () => switchView(b.dataset.view)));
  $('btn-menu').addEventListener('click', () => {
    $('sidebar').classList.add('open'); $('ovl').classList.add('open');
  });
  $('ovl').addEventListener('click', closeSidebar);
  $('btn-print').addEventListener('click', () => window.print());
  $('btn-backup').addEventListener('click', backup);
  $('btn-restore').addEventListener('change', e => {
    if (e.target.files[0]) { restore(e.target.files[0]); e.target.value = ''; }
  });

  // modal close via data-close
  document.querySelectorAll('[data-close]').forEach(b =>
    b.addEventListener('click', () => closeModal(b.dataset.close)));
  document.querySelectorAll('.mask').forEach(mk =>
    mk.addEventListener('click', e => { if (e.target === mk) mk.hidden = true; }));
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') document.querySelectorAll('.mask:not([hidden])').forEach(m => m.hidden = true);
  });

  // week nav
  $('btn-prev').addEventListener('click', () => { curDate.setDate(curDate.getDate()-7); renderCalendar(); });
  $('btn-next').addEventListener('click', () => { curDate.setDate(curDate.getDate()+7); renderCalendar(); });
  $('btn-today').addEventListener('click', () => { curDate = new Date(); renderCalendar(); });

  // calendar clicks
  $('sch-body').addEventListener('click', e => {
    const addCell = e.target.closest('[data-add-todo]');
    if (addCell) { openTodo(addCell.dataset.addTodo); return; }
    const td = e.target.closest('td.clk');
    if (td) openStatus(td.dataset.mid, td.dataset.date);
  });

  // status modal
  $('btn-status-save').addEventListener('click', () => {
    if (!sCtx.sel) { alert('상태를 선택해주세요.'); return; }
    setSch(sCtx.mid, sCtx.date, sCtx.sel, $('status-note').value.trim());
    closeModal('modal-status'); renderAll(); toast('저장되었습니다');
  });
  $('btn-status-clear').addEventListener('click', () => {
    setSch(sCtx.mid, sCtx.date, null, '');
    closeModal('modal-status'); renderAll(); toast('삭제되었습니다');
  });
  document.querySelectorAll('.sopt').forEach(b => b.addEventListener('click', () => {
    sCtx.sel = b.dataset.status;
    document.querySelectorAll('.sopt').forEach(x => x.classList.remove('on'));
    b.classList.add('on');
  }));

  // todo
  $('btn-add-todo').addEventListener('click', () => openTodo());
  $('btn-todo-save').addEventListener('click', saveTodoModal);
  $('btn-toggle-done').addEventListener('click', () => { hideDone = !hideDone; renderTodos(); });
  $('todo-summary-body').addEventListener('click', e => {
    const b = e.target.closest('[data-add-todo]');
    if (b) openTodo(b.dataset.addTodo);
  });
  $('todo-list').addEventListener('click', e => {
    const c = e.target.closest('[data-chk]');
    if (c) { updTodo(c.dataset.chk, { done: c.checked }); renderAll(); return; }
    const ed = e.target.closest('[data-edit-todo]');
    if (ed) { openTodo(null, ed.dataset.editTodo); return; }
    const dl = e.target.closest('[data-del-todo]');
    if (dl && confirm('이 할 일을 삭제할까요?')) { delTodo(dl.dataset.delTodo); renderAll(); toast('삭제되었습니다'); }
  });
  document.querySelector('.filters').addEventListener('click', e => {
    const b = e.target.closest('.fchip');
    if (b) {
      tFilter = b.dataset.filter;
      document.querySelectorAll('.fchip').forEach(x => x.classList.remove('active'));
      b.classList.add('active'); renderTodos();
    }
  });
  $('todo-member-filter').addEventListener('change', e => { tMemberFilter = e.target.value; renderTodos(); });

  // notice
  $('btn-add-notice').addEventListener('click', () => openNotice());
  $('btn-notice-save').addEventListener('click', saveNoticeModal);
  $('notice-list').addEventListener('click', e => {
    const ed = e.target.closest('[data-edit-notice]');
    if (ed) { openNotice(ed.dataset.editNotice); return; }
    const dl = e.target.closest('[data-del-notice]');
    if (dl && confirm('이 공지를 삭제할까요?')) { delNotice(dl.dataset.delNotice); renderNotices(); renderDashboard(); toast('삭제되었습니다'); }
  });

  // members
  $('btn-add-member').addEventListener('click', openMemberModal);
  $('btn-member-save').addEventListener('click', saveMemberModal);
  $('member-body').addEventListener('click', e => {
    const dl = e.target.closest('[data-del-member]');
    if (dl) { delMember(dl.dataset.delMember); return; }
    const cell = e.target.closest('td.edit-cell');
    if (cell) startInlineEdit(cell);
  });
  $('member-body').addEventListener('change', e => {
    const ci = e.target.closest('input[data-field="color"]');
    if (ci) {
      const mid = ci.closest('tr').dataset.mid;
      updMember(mid, { color: ci.value });
      renderAll(); toast('색상이 변경되었습니다');
    }
  });
}

// ===== Init =====
document.addEventListener('DOMContentLoaded', () => {
  load(); bind(); renderAll();
});
