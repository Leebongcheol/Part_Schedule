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
let monDate = new Date();
let view = 'notice';
let tFilter = 'all';
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
/** 공지는 항상 최신순 (DB에서 오는 순서는 보장되지 않음) */
function noticesSorted() {
  return notices.slice().sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
}

// ===== Persistence (DataStore: local 또는 Firebase 실시간) =====
// 읽기 코드가 그대로 동작하도록 전역 배열을 DataStore 배열에 다시 연결한다.
function syncRefs() {
  members = DataStore.data.members;
  schedules = DataStore.data.schedules;
  todos = DataStore.data.todos;
  notices = DataStore.data.notices;
}

function load() {
  DataStore.onChange = () => { syncRefs(); renderAll(); };
  DataStore.onStatus = (s, msg) => renderConnStatus(s, msg);
  // 데이터가 처음 준비된 뒤(클라우드는 로그인·최초 수신 후) 비어 있으면 기본 팀원 시드
  DataStore.onReady = () => {
    syncRefs();
    if (members.length === 0) {
      DataStore.seedIfEmpty('members', DEFAULT_MEMBERS.map(m => ({ ...m })))
        .then(() => { syncRefs(); renderAll(); });
    } else {
      renderAll();
    }
  };
  return DataStore.init().then(() => syncRefs());
}

// ===== Backup / Restore =====
function backup() {
  const data = { version: 3, exportedAt: new Date().toISOString(), members, schedules, todos, notices };
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
      const warn = DataStore.isCloud()
        ? '⚠️ 파트 공유 데이터 전체를 백업 파일로 덮어씁니다.\n다른 팀원의 최신 입력도 사라집니다. 계속할까요?'
        : '현재 데이터를 백업 파일 내용으로 덮어씁니다. 계속할까요?';
      if (!confirm(warn)) return;
      DataStore.replaceAll(d).then(() => {
        syncRefs(); renderAll(); toast('백업을 불러왔습니다 ✅');
      });
    } catch (err) { alert('불러오기 실패: ' + err.message); }
  };
  r.readAsText(file);
}

// ===== Schedule =====
function getSch(mid, date) { return schedules.find(s => s.memberId === mid && s.date === date); }
function setSch(mid, date, status, note) {
  const cur = getSch(mid, date);
  if (!status) {
    if (cur) DataStore.remove('schedules', cur.id);
    return;
  }
  const rec = cur
    ? { ...cur, status, note: note || '' }
    : { id: uid(), memberId: mid, date, status, note: note || '' };
  DataStore.put('schedules', rec);
}

// ===== Member =====
function addMember(o) { DataStore.put('members', { id: uid(), ...o }); }
function updMember(id, patch) {
  const m = members.find(x => x.id === id);
  if (m) DataStore.put('members', { ...m, ...patch });
}
function delMember(id) {
  const m = members.find(x => x.id === id);
  if (!confirm(`'${m ? m.name : ''}' 팀원을 삭제합니다.\n관련 일정과 할 일도 함께 삭제됩니다. 계속할까요?`)) return;
  Promise.all([
    DataStore.removeWhere('schedules', x => x.memberId === id),
    DataStore.removeWhere('todos', x => x.assigneeId === id)
  ]).then(() => DataStore.remove('members', id))
    .then(() => { syncRefs(); renderAll(); toast('팀원이 삭제되었습니다'); });
}

// ===== Todo =====
function addTodo(o) {
  DataStore.put('todos', { id: uid(), done: false, createdAt: new Date().toISOString(), ...o });
}
function updTodo(id, patch) {
  const t = todos.find(x => x.id === id);
  if (t) DataStore.put('todos', { ...t, ...patch });
}
function delTodo(id) { DataStore.remove('todos', id); }

// ===== Notice =====
function addNotice(o) { DataStore.put('notices', { id: uid(), date: new Date().toISOString(), ...o }); }
function updNotice(id, patch) {
  const n = notices.find(x => x.id === id);
  if (n) DataStore.put('notices', { ...n, ...patch });
}
function delNotice(id) { DataStore.remove('notices', id); }

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


// ===== Render: 월간 근태 =====
function monthGrid(base) {
  const y = base.getFullYear(), mo = base.getMonth();
  const first = new Date(y, mo, 1);
  const start = new Date(first);
  start.setDate(1 - first.getDay()); // 그 주 일요일부터
  const cells = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start); d.setDate(start.getDate() + i);
    cells.push(d);
    // 마지막 주가 다음 달로 완전히 넘어가면 종료
    if (i % 7 === 6 && d.getMonth() !== mo && d > first) {
      if (cells.length >= 35) break;
    }
  }
  return { cells, month: mo, year: y };
}

function renderMonth() {
  const { cells, month, year } = monthGrid(monDate);
  const td = today();
  $('month-label').textContent = `${year}년 ${month + 1}월`;

  let html = '';
  for (let w = 0; w < cells.length / 7; w++) {
    html += '<tr>';
    for (let i = 0; i < 7; i++) {
      const d = cells[w * 7 + i];
      if (!d) { html += '<td class="other"></td>'; continue; }
      const ds = fmt(d);
      const isOther = d.getMonth() !== month;
      const dow = d.getDay();
      const cls = [
        isOther ? 'other' : '',
        (dow === 0 || dow === 6) && !isOther ? 'wknd' : '',
        ds === td ? 'tday' : '',
        dow === 0 ? 'sun-c' : '', dow === 6 ? 'sat-c' : ''
      ].filter(Boolean).join(' ');

      if (isOther) {
        html += `<td class="${cls}"><span class="d-num">${d.getDate()}</span></td>`;
        continue;
      }
      const dayScheds = schedules.filter(s => s.date === ds);
      const shown = dayScheds.slice(0, 3);
      let inner = `<span class="d-num">${d.getDate()}</span><div class="d-list">`;
      shown.forEach(s => {
        const m = members.find(x => x.id === s.memberId);
        if (!m) return;
        inner += `<span class="d-chip" style="background:${S_COLOR[s.status] || '#6b7280'}" title="${esc(m.name)} ${s.status}${s.note ? ' · ' + esc(s.note) : ''}">${esc(m.name)} ${s.status}</span>`;
      });
      if (dayScheds.length > 3) inner += `<span class="d-more">+${dayScheds.length - 3}건</span>`;
      inner += '</div>';
      html += `<td class="${cls}" data-day="${ds}" title="클릭하여 근태 입력">${inner}</td>`;
    }
    html += '</tr>';
  }
  $('mon-body').innerHTML = html;

  // 월간 집계
  const ms = String(month + 1).padStart(2, '0');
  const pre = `${year}-${ms}`;
  $('mon-sum-body').innerHTML = members.map(m => {
    const mine = schedules.filter(s => s.memberId === m.id && s.date.startsWith(pre));
    const c = k => mine.filter(s => s.status === k).length;
    const t = c('출장'), v = c('휴가'), e = c('교육'), o = c('기타');
    return `<tr>
      <td><div class="mcell"><span class="mdot" style="background:${m.color}"></span>${esc(m.name)}</div></td>
      <td>${esc(m.position)}</td>
      <td>${t || '-'}</td><td>${v || '-'}</td><td>${e || '-'}</td><td>${o || '-'}</td>
      <td><b>${t + v + e + o || '-'}</b></td>
    </tr>`;
  }).join('') || '<tr><td colspan="7" class="none-txt">팀원이 없습니다</td></tr>';
}

// ===== 일자별 근태 일괄 입력 =====
function openDay(ds) {
  const d = new Date(ds + 'T00:00:00');
  const dowNames = ['일', '월', '화', '수', '목', '금', '토'];
  $('day-title').textContent = `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()} (${dowNames[d.getDay()]}) 근태 입력`;
  $('day-body').dataset.date = ds;
  renderDayBody(ds);
  openModal('modal-day');
}

function renderDayBody(ds) {
  $('day-body').innerHTML = members.map(m => {
    const s = getSch(m.id, ds);
    const cur = s ? s.status : '';
    const opts = ['', ...STATUS].map(st =>
      `<button class="dopt ${cur === st ? 'on' : ''}" data-s="${st}" data-m="${m.id}">${st || '출근'}</button>`
    ).join('');
    return `<div class="day-row">
      <div class="day-mem"><span class="mdot" style="background:${m.color}"></span>${esc(m.name)}</div>
      <div class="day-opts">${opts}</div>
      <input type="text" class="day-note" data-note="${m.id}" placeholder="메모" value="${s ? esc(s.note || '') : ''}" ${cur ? '' : 'disabled'}>
    </div>`;
  }).join('') || '<div class="none-txt">팀원이 없습니다</div>';
}

// ===== Render: Calendar =====
function renderCalendar() {
  const dates = weekOf(curDate), td = today(), names = ['월','화','수','목','금'];
  const ws = fmt(dates[0]), we = fmt(dates[4]);

  $('week-label').textContent = `${dates[0].getFullYear()}.${dates[0].getMonth()+1}.${dates[0].getDate()} ~ ${dates[4].getMonth()+1}.${dates[4].getDate()}`;

  const ths = document.querySelectorAll('.wk-table thead th');
  for (let i = 1; i <= 5; i++) {
    const d = dates[i-1];
    ths[i].innerHTML = `${names[i-1]}<br><small style="font-weight:500;opacity:.85">${d.getMonth()+1}/${d.getDate()}</small>`;
    ths[i].classList.toggle('today', fmt(d) === td);
  }

  let html = '';
  members.forEach(m => {
    html += '<tr>';
    // 팀원
    html += `<td class="w-mem"><div class="wk-mem"><span class="mdot" style="background:${m.color}"></span>`
          + `<span class="wk-mem-n">${esc(m.name)}</span></div>`
          + `<span class="wk-mem-p">${esc(m.position)}</span></td>`;
    // 근태 5칸
    dates.forEach(d => {
      const ds = fmt(d), s = getSch(m.id, ds);
      if (s) {
        html += `<td class="w-att" data-mid="${m.id}" data-date="${ds}" title="${esc(s.note || s.status)}">`
              + `<span class="badge ${S_CLASS[s.status] || 'b-etc'}">${s.status}</span>`
              + (s.note ? '<span class="note-ico">📝</span>' : '') + '</td>';
      } else {
        html += `<td class="w-att" data-mid="${m.id}" data-date="${ds}" title="출근 (입력값 없음)"><span class="work-dot"></span></td>`;
      }
    });

    // 할 일 (필터 적용)
    const mine = todos.filter(t => t.assigneeId === m.id).filter(t => {
      if (tFilter === 'inprogress') return !t.done;
      if (tFilter === 'done') return t.done;
      if (tFilter === 'support') return !t.done && t.needSupport;
      if (tFilter === 'duesoon') { if (t.done) return false; const dl = daysLeft(t.dueDate); return dl !== null && dl <= 2; }
      return true;
    });
    const po = { high: 0, medium: 1, low: 2 };
    mine.sort((a, b) => (a.done - b.done) || (po[a.priority] ?? 1) - (po[b.priority] ?? 1)
      || (a.dueDate || 'zzz').localeCompare(b.dueDate || 'zzz'));

    let tHtml = '<div class="wt-list">';
    if (mine.length) {
      mine.forEach(t => {
        const dl = daysLeft(t.dueDate);
        const soon = !t.done && dl !== null && dl <= 2;
        let flags = '';
        if (!t.done && t.needSupport) flags += '<span class="wt-f sup">지원</span>';
        if (soon) flags += `<span class="wt-f due">${dl < 0 ? `${-dl}일↑` : dl === 0 ? '오늘' : `D-${dl}`}</span>`;
        else if (!t.done && t.priority === 'high') flags += '<span class="wt-f hi">높음</span>';
        const tip = `${t.title}${t.dueDate ? ` (마감 ${t.dueDate})` : ''}${t.description ? '\n' + t.description : ''}`;
        tHtml += `<div class="wt ${t.done ? 'done' : ''}">`
              + `<input type="checkbox" class="wt-c" data-chk="${t.id}" ${t.done ? 'checked' : ''} title="완료 처리">`
              + `<span class="wt-t" data-open-task="${t.id}" title="${esc(tip)}">${esc(t.title)}</span>`
              + flags + '</div>';
      });
    } else {
      tHtml += '<span class="wt-none">할 일 없음</span>';
    }
    tHtml += `<button class="wt-add" data-add-todo="${m.id}">+ 추가</button></div>`;
    html += `<td class="w-tdo" data-add-todo="${m.id}" title="빈 곳 클릭 = 할 일 추가">${tHtml}</td>`;

    // 진행률
    const all = todos.filter(t => t.assigneeId === m.id);
    const dn = all.filter(t => t.done).length;
    const pc = all.length ? Math.round(dn / all.length * 100) : 0;
    const wl = stat(m.id);
    html += `<td><div class="wk-pg ${wl.need ? 'alert' : ''}">`
          + `<div class="wk-pg-bar"><i style="width:${pc}%"></i></div>`
          + `<span class="wk-pg-t">${wl.need ? '🔴 ' : ''}${dn}/${all.length} · ${pc}%</span></div></td>`;
    html += '</tr>';
  });
  $('sch-body').innerHTML = html || '<tr><td colspan="8" class="none-txt">등록된 팀원이 없습니다. 팀원 관리에서 추가하세요.</td></tr>';

  // 파트 전체 진행률
  const tot = todos.length, dnAll = todos.filter(t => t.done).length;
  const pctAll = tot ? Math.round(dnAll / tot * 100) : 0;
  $('todo-prog').style.width = pctAll + '%';
  $('todo-pct').textContent = pctAll + '%';
  $('todo-cnt').textContent = tot ? `(완료 ${dnAll} / 전체 ${tot}건)` : '(등록된 할 일 없음)';
}

// ===== Render: Dashboard =====
function renderDashboard() {
  const td = today();
  const now = new Date();
  const dowNames = ['일', '월', '화', '수', '목', '금', '토'];
  $('dash-title').textContent =
    `📊 대시보드 (${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}.${String(now.getDate()).padStart(2, '0')} ${dowNames[now.getDay()]})`;

  let trip = 0, vac = 0, edu = 0, etc = 0, need = 0;
  members.forEach(m => {
    const s = getSch(m.id, td);
    if (s) { if (s.status==='출장') trip++; else if (s.status==='휴가') vac++; else if (s.status==='교육') edu++; else etc++; }
    if (stat(m.id).need) need++;
  });
  const open = todos.filter(t => !t.done).length;
  const doneCnt = todos.filter(t => t.done).length;
  const dueSoon = todos.filter(t => !t.done && (() => { const d = daysLeft(t.dueDate); return d !== null && d <= 2; })()).length;
  const working = members.length - trip - vac - edu - etc;

  // 근태 현황 카드
  $('dash-cards-att').innerHTML = `
    <div class="card"><div class="card-val">${members.length}</div><div class="card-lb">전체 인원</div></div>
    <div class="card"><div class="card-val" style="color:#16a34a">${working}</div><div class="card-lb">🟢 출근</div></div>
    <div class="card"><div class="card-val">${trip}</div><div class="card-lb">✈️ 출장</div></div>
    <div class="card"><div class="card-val">${vac}</div><div class="card-lb">🏖️ 휴가</div></div>
    <div class="card"><div class="card-val">${edu}</div><div class="card-lb">📚 교육</div></div>
    <div class="card"><div class="card-val">${etc}</div><div class="card-lb">📌 기타</div></div>
  `;

  // 업무 현황 카드
  const totalT = todos.length;
  const pct = totalT ? Math.round(doneCnt / totalT * 100) : 0;
  $('dash-cards-work').innerHTML = `
    <div class="card"><div class="card-val">${open}</div><div class="card-lb">📋 진행중 업무</div></div>
    <div class="card"><div class="card-val">${doneCnt}</div><div class="card-lb">✅ 완료 업무</div></div>
    <div class="card"><div class="card-val">${pct}%</div><div class="card-lb">📈 전체 진행률</div></div>
    <div class="card ${dueSoon?'alert':''}"><div class="card-val">${dueSoon}</div><div class="card-lb">⏰ 마감 임박</div></div>
    <div class="card ${need?'alert':''}"><div class="card-val">${need}</div><div class="card-lb">🔴 지원 필요</div></div>
  `;

  $('dash-body').innerHTML = members.map(m => {
    const s = getSch(m.id, td), st = s ? s.status : '출근';
    const cls = s ? (S_CLASS[st] || 'b-etc') : 'b-work';
    const k = stat(m.id);
    const mine = todos.filter(t => t.assigneeId === m.id);
    return `<tr>
      <td><div class="mcell"><span class="mdot" style="background:${m.color}"></span>${esc(m.name)}</div></td>
      <td>${esc(m.position)}</td>
      <td><span class="badge ${cls}">${st}</span></td>
      ${previewCell(m.id, 'open', mine.filter(t => !t.done))}
      ${previewCell(m.id, 'done', mine.filter(t => t.done))}
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
  $('dash-notices').innerHTML = noticesSorted().slice(0, 3).map(n => {
    const d = new Date(n.date);
    return `<div class="mini-notice"><b>${esc(n.title)}</b><span>${d.getFullYear()}.${d.getMonth()+1}.${d.getDate()} · ${esc(n.author||'-')}</span></div>`;
  }).join('') || '<div class="none-txt">공지 없음</div>';
}


// ===== 내용 미리보기 셀 =====
const KIND_LABEL = { open: '진행중 업무', done: '완료 업무', support: '지원 필요 업무' };

function previewCell(mid, kind, list) {
  if (!list.length) return `<td class="cell-preview" data-tasks="${mid}|${kind}"><span class="cp-none">-</span></td>`;
  const cls = kind === 'support' ? 'cp-sup' : (kind === 'done' ? 'cp-done' : '');
  const first = list[0].title;
  const more = list.length > 1 ? `<span class="cp-more">+${list.length - 1}</span>` : '';
  const tip = list.map(t => '· ' + t.title).join('\n');
  return `<td class="cell-preview" data-tasks="${mid}|${kind}" title="${esc(tip)}\n\n(클릭하여 상세 보기)">
    <div class="cp-wrap"><span class="cp-text ${cls}">${kind==='support'?'🔴 ':''}${esc(first)}</span>${more}</div>
  </td>`;
}

// ===== 업무 상세 모달 =====
function taskCard(t) {
  const m = members.find(x => x.id === t.assigneeId);
  const d = daysLeft(t.dueDate);
  const dueTxt = t.dueDate
    ? (d < 0 ? `${t.dueDate} (${-d}일 지남)` : d === 0 ? `${t.dueDate} (오늘 마감)` : `${t.dueDate} (${d}일 남음)`)
    : '미정';
  return `<div class="tk ${t.done?'done':''} ${!t.done&&t.needSupport?'sup':''}">
    <div class="tk-top">
      <span class="tprio ${P_CLASS[t.priority]||'p-m'}">${P_LABEL[t.priority]||'🟡 보통'}</span>
      ${!t.done&&t.needSupport?'<span class="tprio p-h">🔴 지원 필요</span>':''}
      <span class="tprio ${t.done?'p-l':'p-m'}">${t.done?'✅ 완료':'⏳ 진행중'}</span>
    </div>
    <div class="tk-title">${esc(t.title)}</div>
    <div class="tk-meta">
      <span>👤 ${m?esc(m.name):'미지정'}</span>
      ${t.startDate?`<span>▶️ 시작 ${t.startDate}</span>`:''}
      <span>📅 마감 ${dueTxt}</span>
    </div>
    ${t.description?`<div class="tk-desc">${esc(t.description)}</div>`:''}
    <div class="tk-acts">
      <button class="sbtn" data-tk-toggle="${t.id}">${t.done?'↩️ 진행중으로':'✅ 완료 처리'}</button>
      <button class="sbtn" data-tk-edit="${t.id}">✏️ 수정</button>
      <button class="dbtn" data-tk-del="${t.id}">🗑️ 삭제</button>
    </div>
  </div>`;
}

function openTasks(mid, kind) {
  const m = members.find(x => x.id === mid);
  const mine = todos.filter(t => t.assigneeId === mid);
  let list;
  if (kind === 'open') list = mine.filter(t => !t.done);
  else if (kind === 'done') list = mine.filter(t => t.done);
  else list = mine.filter(t => !t.done && t.needSupport);

  const po = { high: 0, medium: 1, low: 2 };
  list.sort((a, b) => (po[a.priority] ?? 1) - (po[b.priority] ?? 1)
    || (a.dueDate || 'zzz').localeCompare(b.dueDate || 'zzz'));

  $('tasks-title').textContent = `${m ? m.name : ''} · ${KIND_LABEL[kind]} (${list.length}건)`;
  $('tasks-body').innerHTML = list.length
    ? list.map(taskCard).join('')
    : '<div class="none-txt">해당 업무가 없습니다.</div>';
  $('tasks-body').dataset.ctx = `${mid}|${kind}`;
  openModal('modal-tasks');
}

function openOneTask(id) {
  const t = todos.find(x => x.id === id);
  if (!t) return;
  const m = members.find(x => x.id === t.assigneeId);
  $('tasks-title').textContent = `업무 상세${m ? ' · ' + m.name : ''}`;
  $('tasks-body').innerHTML = taskCard(t);
  $('tasks-body').dataset.ctx = '';
  openModal('modal-tasks');
}

function refreshTasksModal() {
  const ctx = $('tasks-body').dataset.ctx;
  if (ctx) { const [mid, kind] = ctx.split('|'); openTasks(mid, kind); }
  else closeModal('modal-tasks');
}

// ===== Render: Notice =====
function renderNotices() {
  const icon = { '공지': '📢', '회의록': '📝', '메모': '💡' };
  $('notice-list').innerHTML = noticesSorted().map(n => {
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

// ===== 연결 상태 표시 =====
const CONN_UI = {
  online:          { cls: 'ok',   ico: '🟢', txt: '실시간 공유 중' },
  connecting:      { cls: 'wait', ico: '🟡', txt: '연결 중...' },
  offline:         { cls: 'off',  ico: '⚪', txt: '이 브라우저에만 저장' },
  'auth-required': { cls: 'warn', ico: '🔒', txt: '로그인 필요' },
  error:           { cls: 'err',  ico: '🔴', txt: '연결 오류' }
};

function renderConnStatus(s, msg) {
  const el = $('conn-status');
  if (!el) return;
  const u = CONN_UI[s] || CONN_UI.offline;
  el.className = 'conn ' + u.cls;
  el.innerHTML = `<span class="conn-ico">${u.ico}</span><span class="conn-tx">${u.txt}</span>`;
  el.title = msg || u.txt;

  // 로그인 게이트 (login 모드에서만 사용)
  const gate = $('modal-login');
  if (gate) gate.hidden = (s !== 'auth-required');

  // 로그아웃 버튼은 계정 로그인 방식일 때만 노출
  const lo = $('btn-logout');
  if (lo) {
    const usesLogin = DataStore.isCloud() && DataStore.authMode() === 'login';
    lo.hidden = !usesLogin;
  }

  // 오프라인 모드 안내 배너
  const banner = $('offline-banner');
  if (banner) banner.hidden = DataStore.isCloud();
}

function doLogin() {
  const em = $('login-email').value.trim();
  const pw = $('login-pw').value;
  const err = $('login-err');
  if (!em || !pw) { err.textContent = '이메일과 비밀번호를 입력하세요.'; err.hidden = false; return; }
  err.hidden = true;
  $('btn-login').disabled = true;
  $('btn-login').textContent = '로그인 중...';
  DataStore.signIn(em, pw)
    .then(() => { $('login-pw').value = ''; toast('로그인되었습니다'); })
    .catch(e => {
      err.textContent = '로그인 실패: ' + (e && e.code ? e.code : (e.message || '알 수 없는 오류'));
      err.hidden = false;
    })
    .then(() => { $('btn-login').disabled = false; $('btn-login').textContent = '로그인'; });
}

// ===== 연결 상태 표시 끝 =====

// ===== Render All =====
function renderAll() {
  renderCalendar(); renderMonth(); renderDashboard();
  renderNotices(); renderMembers();
}


// ===== View switching =====
function switchView(v) {
  view = v;
  document.querySelectorAll('.nav-btn[data-view]').forEach(b => b.classList.toggle('active', b.dataset.view === v));
  document.querySelectorAll('.view').forEach(s => s.classList.toggle('active', s.id === 'view-' + v));
  if (v === 'week') renderCalendar();
  else if (v === 'month') renderMonth();
  else if (v === 'dashboard') renderDashboard();
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

  // month nav
  $('btn-m-prev').addEventListener('click', () => { monDate.setDate(1); monDate.setMonth(monDate.getMonth()-1); renderMonth(); });
  $('btn-m-next').addEventListener('click', () => { monDate.setDate(1); monDate.setMonth(monDate.getMonth()+1); renderMonth(); });
  $('btn-m-today').addEventListener('click', () => { monDate = new Date(); renderMonth(); });

  // month day click → 일괄 입력 모달
  $('mon-body').addEventListener('click', e => {
    const td = e.target.closest('td[data-day]');
    if (td) openDay(td.dataset.day);
  });

  // 일자별 근태 모달 내 동작
  $('day-body').addEventListener('click', e => {
    const b = e.target.closest('.dopt');
    if (!b) return;
    const ds = $('day-body').dataset.date;
    const mid = b.dataset.m, st = b.dataset.s;
    const prev = getSch(mid, ds);
    if (!st) setSch(mid, ds, null, '');                       // 출근 = 입력 해제
    else if (prev && prev.status === st) setSch(mid, ds, null, ''); // 같은 값 재클릭 = 해제
    else setSch(mid, ds, st, prev ? prev.note : '');
    renderDayBody(ds);
    renderMonth(); renderCalendar(); renderDashboard();
  });
  $('day-body').addEventListener('change', e => {
    const n = e.target.closest('[data-note]');
    if (!n) return;
    const ds = $('day-body').dataset.date;
    const s = getSch(n.dataset.note, ds);
    if (s) { setSch(n.dataset.note, ds, s.status, n.value.trim()); renderMonth(); renderCalendar(); toast('메모가 저장되었습니다'); }
  });

  // status modal
  $('btn-status-save').addEventListener('click', () => {
    // 대상 셀 정보가 없으면 저장하지 않는다 (잘못된 레코드 생성 방지)
    if (!sCtx.mid || !sCtx.date) { closeModal('modal-status'); return; }
    if (!sCtx.sel) { alert('상태를 선택해주세요.'); return; }
    setSch(sCtx.mid, sCtx.date, sCtx.sel, $('status-note').value.trim());
    closeModal('modal-status'); renderAll(); toast('저장되었습니다');
  });
  $('btn-status-clear').addEventListener('click', () => {
    if (!sCtx.mid || !sCtx.date) { closeModal('modal-status'); return; }
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

  $('dash-body').addEventListener('click', e => {
    const c = e.target.closest('[data-tasks]');
    if (c) { const [mid, kind] = c.dataset.tasks.split('|'); openTasks(mid, kind); }
  });

  // 업무 상세 모달 내 동작
  $('tasks-body').addEventListener('click', e => {
    const tg = e.target.closest('[data-tk-toggle]');
    if (tg) {
      const t = todos.find(x => x.id === tg.dataset.tkToggle);
      if (t) { updTodo(t.id, { done: !t.done }); renderAll(); refreshTasksModal(); toast('변경되었습니다'); }
      return;
    }
    const ed = e.target.closest('[data-tk-edit]');
    if (ed) { closeModal('modal-tasks'); openTodo(null, ed.dataset.tkEdit); return; }
    const dl = e.target.closest('[data-tk-del]');
    if (dl && confirm('이 업무를 삭제할까요?')) {
      delTodo(dl.dataset.tkDel); renderAll(); refreshTasksModal(); toast('삭제되었습니다');
    }
  });
  // 범례 우측 필터 (주간 표의 할 일 표시 범위)
  document.querySelector('.lg-right').addEventListener('click', e => {
    const b = e.target.closest('.fchip');
    if (b) {
      tFilter = b.dataset.filter;
      document.querySelectorAll('.lg-right .fchip').forEach(x => x.classList.remove('active'));
      b.classList.add('active');
      renderCalendar();
    }
  });

  // 주간 통합 표: 체크박스 / 상세 / 추가 / 근태
  $('sch-body').addEventListener('click', e => {
    const c = e.target.closest('[data-chk]');
    if (c) { updTodo(c.dataset.chk, { done: c.checked }); renderCalendar(); renderDashboard(); return; }
    const op = e.target.closest('[data-open-task]');
    if (op) { openOneTask(op.dataset.openTask); return; }
    const ad = e.target.closest('[data-add-todo]');
    if (ad) { openTodo(ad.dataset.addTodo); return; }
    const at = e.target.closest('td.w-att');
    if (at) openStatus(at.dataset.mid, at.dataset.date);
  });

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

  // 로그인
  if ($('btn-login')) {
    $('btn-login').addEventListener('click', doLogin);
    $('login-pw').addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });
    $('login-email').addEventListener('keydown', e => { if (e.key === 'Enter') $('login-pw').focus(); });
  }
  if ($('btn-logout')) {
    $('btn-logout').addEventListener('click', () => {
      if (confirm('로그아웃 하시겠습니까?')) DataStore.signOut();
    });
  }
}

// ===== Init =====
document.addEventListener('DOMContentLoaded', () => {
  bind();
  renderConnStatus(DataStore.hasCloudConfig() ? 'connecting' : 'offline', '');
  load().then(() => { syncRefs(); renderAll(); });
});
