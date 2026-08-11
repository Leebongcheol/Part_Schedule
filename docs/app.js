/**
 * Team Schedule Management App
 * Pure vanilla JavaScript - localStorage persistence
 */

// ============================================================
// Constants & Configuration
// ============================================================

const STATUS_TYPES = ['출근', '출장', '휴가', '공가', '재택', '교육'];

const STATUS_COLORS = {
  '출근': '#4CAF50',
  '출장': '#2196F3',
  '휴가': '#FF9800',
  '공가': '#9C27B0',
  '재택': '#00BCD4',
  '교육': '#FF5722'
};

const STORAGE_KEYS = {
  members: 'teamSchedule_members',
  schedules: 'teamSchedule_schedules'
};

const DEFAULT_MEMBERS = [
  { id: generateId(), name: '김철수', color: '#E91E63', department: '개발팀' },
  { id: generateId(), name: '이영희', color: '#3F51B5', department: '디자인팀' },
  { id: generateId(), name: '박민수', color: '#009688', department: '개발팀' },
  { id: generateId(), name: '정수진', color: '#FF5722', department: '기획팀' },
  { id: generateId(), name: '최동혁', color: '#795548', department: '개발팀' },
  { id: generateId(), name: '한지원', color: '#607D8B', department: '디자인팀' }
];

// ============================================================
// State
// ============================================================

let currentDate = new Date();
let members = [];
let schedules = [];

// ============================================================
// Helper Functions
// ============================================================

function generateId() {
  return 'id_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 9);
}

function formatDate(date) {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getWeekDates(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust for Monday
  const monday = new Date(d.setDate(diff));
  const dates = [];
  for (let i = 0; i < 5; i++) {
    const current = new Date(monday);
    current.setDate(monday.getDate() + i);
    dates.push(current);
  }
  return dates;
}

function getDayName(date) {
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  return days[new Date(date).getDay()];
}

// ============================================================
// Data Persistence
// ============================================================

function loadData() {
  const storedMembers = localStorage.getItem(STORAGE_KEYS.members);
  const storedSchedules = localStorage.getItem(STORAGE_KEYS.schedules);

  if (storedMembers) {
    members = JSON.parse(storedMembers);
  } else {
    members = DEFAULT_MEMBERS;
    saveMembers();
  }

  if (storedSchedules) {
    schedules = JSON.parse(storedSchedules);
  } else {
    schedules = [];
    saveSchedules();
  }
}

function saveMembers() {
  localStorage.setItem(STORAGE_KEYS.members, JSON.stringify(members));
}

function saveSchedules() {
  localStorage.setItem(STORAGE_KEYS.schedules, JSON.stringify(schedules));
}

function clearAllData() {
  if (confirm('모든 데이터를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) {
    localStorage.removeItem(STORAGE_KEYS.members);
    localStorage.removeItem(STORAGE_KEYS.schedules);
    members = DEFAULT_MEMBERS.map(m => ({ ...m, id: generateId() }));
    schedules = [];
    saveMembers();
    saveSchedules();
    render();
  }
}

// ============================================================
// Export / Import
// ============================================================

function exportData() {
  const data = {
    exportDate: new Date().toISOString(),
    members: members,
    schedules: schedules
  };
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `team-schedule-${formatDate(new Date())}.json`;
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
      if (data.members && data.schedules) {
        members = data.members;
        schedules = data.schedules;
        saveMembers();
        saveSchedules();
        render();
        alert('데이터를 성공적으로 가져왔습니다.');
      } else {
        alert('올바른 형식의 파일이 아닙니다.');
      }
    } catch (err) {
      alert('파일을 읽는 중 오류가 발생했습니다: ' + err.message);
    }
  };
  reader.readAsText(file);
}


// ============================================================
// Schedule CRUD
// ============================================================

function getSchedule(memberId, date) {
  const dateStr = formatDate(date);
  return schedules.find(s => s.memberId === memberId && s.date === dateStr);
}

function setSchedule(memberId, date, status, note) {
  const dateStr = typeof date === 'string' ? date : formatDate(date);
  const existing = schedules.find(s => s.memberId === memberId && s.date === dateStr);

  if (existing) {
    if (status) {
      existing.status = status;
      existing.note = note || '';
    } else {
      // Remove if status is cleared
      schedules = schedules.filter(s => s.id !== existing.id);
    }
  } else if (status) {
    schedules.push({
      id: generateId(),
      memberId: memberId,
      date: dateStr,
      status: status,
      note: note || ''
    });
  }

  saveSchedules();
}

// ============================================================
// Member Management
// ============================================================

function addMember(name, color, department) {
  const member = {
    id: generateId(),
    name: name,
    color: color || '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0'),
    department: department || ''
  };
  members.push(member);
  saveMembers();
  render();
}

function removeMember(memberId) {
  if (confirm('이 팀원을 삭제하시겠습니까?')) {
    members = members.filter(m => m.id !== memberId);
    schedules = schedules.filter(s => s.memberId !== memberId);
    saveMembers();
    saveSchedules();
    render();
  }
}

function updateMember(memberId, name, color, department) {
  const member = members.find(m => m.id === memberId);
  if (member) {
    member.name = name;
    member.color = color;
    member.department = department;
    saveMembers();
    render();
  }
}


// ============================================================
// Week Navigation
// ============================================================

function prevWeek() {
  currentDate.setDate(currentDate.getDate() - 7);
  render();
}

function nextWeek() {
  currentDate.setDate(currentDate.getDate() + 7);
  render();
}

function goToday() {
  currentDate = new Date();
  render();
}

// ============================================================
// Rendering
// ============================================================

function render() {
  const app = document.getElementById('app');
  const weekDates = getWeekDates(currentDate);
  const weekStart = formatDate(weekDates[0]);
  const weekEnd = formatDate(weekDates[4]);

  app.innerHTML = `
    <div class="container">
      <header class="header">
        <h1>📅 팀 일정관리</h1>
        <div class="header-actions">
          <button onclick="showMemberModal()" class="btn btn-primary">👥 팀원 관리</button>
          <button onclick="exportData()" class="btn btn-secondary">📤 내보내기</button>
          <label class="btn btn-secondary">
            📥 가져오기
            <input type="file" accept=".json" onchange="handleImport(event)" style="display:none">
          </label>
          <button onclick="clearAllData()" class="btn btn-danger">🗑️ 초기화</button>
        </div>
      </header>

      <nav class="week-nav">
        <button onclick="prevWeek()" class="btn btn-nav">◀ 이전 주</button>
        <button onclick="goToday()" class="btn btn-nav">오늘</button>
        <span class="week-range">${weekStart} ~ ${weekEnd}</span>
        <button onclick="nextWeek()" class="btn btn-nav">다음 주 ▶</button>
      </nav>

      <div class="schedule-grid">
        <table>
          <thead>
            <tr>
              <th class="member-col">팀원</th>
              ${weekDates.map(d => `
                <th class="day-col ${formatDate(d) === formatDate(new Date()) ? 'today' : ''}">
                  ${getDayName(d)} (${new Date(d).getMonth() + 1}/${new Date(d).getDate()})
                </th>
              `).join('')}
            </tr>
          </thead>
          <tbody>
            ${members.map(member => `
              <tr>
                <td class="member-cell">
                  <span class="member-color" style="background:${member.color}"></span>
                  <span class="member-name">${member.name}</span>
                  <span class="member-dept">${member.department}</span>
                </td>
                ${weekDates.map(d => {
                  const schedule = getSchedule(member.id, d);
                  const dateStr = formatDate(d);
                  const cellClass = schedule ? 'has-status' : '';
                  const bgColor = schedule ? STATUS_COLORS[schedule.status] : '';
                  const noteIcon = schedule && schedule.note ? ' 📝' : '';
                  return `
                    <td class="schedule-cell ${cellClass}"
                        style="${bgColor ? `background-color: ${bgColor}22; border-left: 3px solid ${bgColor}` : ''}"
                        data-member-id="${member.id}"
                        data-date="${dateStr}"
                        onclick="showStatusSelector(event, '${member.id}', '${dateStr}')"
                        title="${schedule && schedule.note ? schedule.note : '클릭하여 상태 설정'}">
                      ${schedule ? `<span class="status-badge" style="background:${bgColor}">${schedule.status}</span>${noteIcon}` : '<span class="empty-cell">+</span>'}
                    </td>
                  `;
                }).join('')}
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <div class="legend">
        <span class="legend-title">상태:</span>
        ${STATUS_TYPES.map(s => `
          <span class="legend-item">
            <span class="legend-dot" style="background:${STATUS_COLORS[s]}"></span>${s}
          </span>
        `).join('')}
      </div>
    </div>
  `;
}


// ============================================================
// Status Selector Popup
// ============================================================

function showStatusSelector(event, memberId, dateStr) {
  event.stopPropagation();
  closeAllPopups();

  const cell = event.currentTarget;
  const rect = cell.getBoundingClientRect();
  const existing = schedules.find(s => s.memberId === memberId && s.date === dateStr);

  const popup = document.createElement('div');
  popup.className = 'status-popup';
  popup.id = 'status-popup';

  popup.innerHTML = `
    <div class="popup-header">
      <strong>${members.find(m => m.id === memberId)?.name || ''}</strong>
      <span>${dateStr}</span>
      <button onclick="closeAllPopups()" class="popup-close">✕</button>
    </div>
    <div class="popup-statuses">
      ${STATUS_TYPES.map(status => `
        <button class="status-option ${existing && existing.status === status ? 'active' : ''}"
                style="border-color: ${STATUS_COLORS[status]}; ${existing && existing.status === status ? `background: ${STATUS_COLORS[status]}; color: white;` : ''}"
                onclick="selectStatus('${memberId}', '${dateStr}', '${status}')">
          ${status}
        </button>
      `).join('')}
    </div>
    <div class="popup-note">
      <input type="text" id="status-note" placeholder="메모 입력 (선택사항)"
             value="${existing && existing.note ? existing.note : ''}"
             onkeydown="if(event.key==='Enter') applyStatusWithNote('${memberId}', '${dateStr}')">
    </div>
    <div class="popup-actions">
      ${existing ? `<button class="btn btn-danger btn-sm" onclick="removeStatus('${memberId}', '${dateStr}')">삭제</button>` : ''}
      <button class="btn btn-primary btn-sm" onclick="applyStatusWithNote('${memberId}', '${dateStr}')">확인</button>
    </div>
  `;

  // Position popup near the cell
  popup.style.position = 'fixed';
  popup.style.top = `${Math.min(rect.bottom + 5, window.innerHeight - 300)}px`;
  popup.style.left = `${Math.min(rect.left, window.innerWidth - 250)}px`;
  popup.style.zIndex = '1000';

  document.body.appendChild(popup);

  // Close popup when clicking outside
  setTimeout(() => {
    document.addEventListener('click', handleOutsideClick);
  }, 0);
}

let selectedStatusTemp = null;

function selectStatus(memberId, dateStr, status) {
  selectedStatusTemp = status;
  const buttons = document.querySelectorAll('.status-option');
  buttons.forEach(btn => {
    btn.classList.remove('active');
    btn.style.background = '';
    btn.style.color = '';
  });
  const activeBtn = [...buttons].find(btn => btn.textContent.trim() === status);
  if (activeBtn) {
    activeBtn.classList.add('active');
    activeBtn.style.background = STATUS_COLORS[status];
    activeBtn.style.color = 'white';
  }
}

function applyStatusWithNote(memberId, dateStr) {
  const noteInput = document.getElementById('status-note');
  const note = noteInput ? noteInput.value.trim() : '';
  const existing = schedules.find(s => s.memberId === memberId && s.date === dateStr);
  const status = selectedStatusTemp || (existing ? existing.status : null);

  if (status) {
    setSchedule(memberId, dateStr, status, note);
    closeAllPopups();
    render();
  } else {
    alert('상태를 선택해주세요.');
  }
  selectedStatusTemp = null;
}

function removeStatus(memberId, dateStr) {
  setSchedule(memberId, dateStr, null, '');
  closeAllPopups();
  render();
}

function closeAllPopups() {
  const popup = document.getElementById('status-popup');
  if (popup) popup.remove();
  const modal = document.getElementById('member-modal');
  if (modal) modal.style.display = 'none';
  document.removeEventListener('click', handleOutsideClick);
  selectedStatusTemp = null;
}

function handleOutsideClick(event) {
  const popup = document.getElementById('status-popup');
  if (popup && !popup.contains(event.target)) {
    closeAllPopups();
  }
}


// ============================================================
// Member Management Modal
// ============================================================

function showMemberModal() {
  closeAllPopups();

  let modal = document.getElementById('member-modal');
  if (modal) modal.remove();

  modal = document.createElement('div');
  modal.id = 'member-modal';
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <h2>👥 팀원 관리</h2>
        <button onclick="closeMemberModal()" class="popup-close">✕</button>
      </div>
      <div class="modal-body">
        <div class="member-form">
          <h3>팀원 추가</h3>
          <div class="form-row">
            <input type="text" id="new-member-name" placeholder="이름" class="form-input">
            <input type="text" id="new-member-dept" placeholder="부서" class="form-input">
            <input type="color" id="new-member-color" value="#4CAF50" class="form-color">
            <button onclick="handleAddMember()" class="btn btn-primary">추가</button>
          </div>
        </div>
        <div class="member-list">
          <h3>현재 팀원 (${members.length}명)</h3>
          <table class="member-table">
            <thead>
              <tr>
                <th>색상</th>
                <th>이름</th>
                <th>부서</th>
                <th>작업</th>
              </tr>
            </thead>
            <tbody>
              ${members.map(m => `
                <tr>
                  <td><span class="member-color-dot" style="background:${m.color}"></span></td>
                  <td>${m.name}</td>
                  <td>${m.department}</td>
                  <td>
                    <button onclick="editMemberPrompt('${m.id}')" class="btn btn-sm btn-secondary">수정</button>
                    <button onclick="removeMember('${m.id}')" class="btn btn-sm btn-danger">삭제</button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  modal.style.display = 'flex';

  // Close on overlay click
  modal.addEventListener('click', function(e) {
    if (e.target === modal) closeMemberModal();
  });
}

function closeMemberModal() {
  const modal = document.getElementById('member-modal');
  if (modal) modal.remove();
}

function handleAddMember() {
  const name = document.getElementById('new-member-name').value.trim();
  const dept = document.getElementById('new-member-dept').value.trim();
  const color = document.getElementById('new-member-color').value;

  if (!name) {
    alert('이름을 입력해주세요.');
    return;
  }

  addMember(name, color, dept);
  closeMemberModal();
  showMemberModal(); // Reopen to show updated list
}

function editMemberPrompt(memberId) {
  const member = members.find(m => m.id === memberId);
  if (!member) return;

  const newName = prompt('이름:', member.name);
  if (newName === null) return;

  const newDept = prompt('부서:', member.department);
  if (newDept === null) return;

  const newColor = prompt('색상 (HEX):', member.color);
  if (newColor === null) return;

  updateMember(memberId, newName || member.name, newColor || member.color, newDept || member.department);
  closeMemberModal();
  showMemberModal();
}

// ============================================================
// Import Handler
// ============================================================

function handleImport(event) {
  const file = event.target.files[0];
  if (file) {
    importData(file);
    event.target.value = ''; // Reset file input
  }
}


// ============================================================
// Styles (injected into document)
// ============================================================

function injectStyles() {
  const style = document.createElement('style');
  style.textContent = `
    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Malgun Gothic', sans-serif;
      background: #f5f7fa;
      color: #333;
      line-height: 1.6;
    }

    .container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 20px;
    }

    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
      flex-wrap: wrap;
      gap: 10px;
    }

    .header h1 {
      font-size: 1.5rem;
      color: #1a1a2e;
    }

    .header-actions {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }

    .btn {
      padding: 8px 16px;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      font-size: 0.85rem;
      font-weight: 500;
      transition: all 0.2s;
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }

    .btn:hover { opacity: 0.85; transform: translateY(-1px); }
    .btn-primary { background: #4361ee; color: white; }
    .btn-secondary { background: #e2e8f0; color: #475569; }
    .btn-danger { background: #ef4444; color: white; }
    .btn-nav { background: #fff; color: #333; border: 1px solid #ddd; }
    .btn-nav:hover { background: #f0f0f0; }
    .btn-sm { padding: 4px 10px; font-size: 0.78rem; }

    .week-nav {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 16px;
      margin-bottom: 20px;
      padding: 12px;
      background: white;
      border-radius: 10px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.08);
    }

    .week-range {
      font-size: 1.1rem;
      font-weight: 600;
      color: #1a1a2e;
      min-width: 220px;
      text-align: center;
    }

    .schedule-grid {
      background: white;
      border-radius: 10px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.06);
      overflow-x: auto;
      margin-bottom: 20px;
    }

    .schedule-grid table {
      width: 100%;
      border-collapse: collapse;
      min-width: 700px;
    }

    .schedule-grid th {
      padding: 12px 8px;
      text-align: center;
      background: #f8fafc;
      font-weight: 600;
      font-size: 0.85rem;
      color: #475569;
      border-bottom: 2px solid #e2e8f0;
    }

    .schedule-grid th.today {
      background: #eef2ff;
      color: #4361ee;
    }

    .member-col { text-align: left !important; min-width: 140px; }
    .day-col { min-width: 100px; }

    .member-cell {
      padding: 10px 12px;
      display: flex;
      align-items: center;
      gap: 8px;
      border-bottom: 1px solid #f1f5f9;
    }

    .member-color {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      flex-shrink: 0;
    }

    .member-name {
      font-weight: 500;
      font-size: 0.9rem;
    }

    .member-dept {
      font-size: 0.7rem;
      color: #94a3b8;
    }

    .schedule-cell {
      padding: 8px;
      text-align: center;
      border-bottom: 1px solid #f1f5f9;
      cursor: pointer;
      transition: background 0.15s;
      min-height: 44px;
      vertical-align: middle;
    }

    .schedule-cell:hover {
      background: #f0f4ff !important;
    }

    .empty-cell {
      color: #cbd5e1;
      font-size: 1.2rem;
    }

    .status-badge {
      display: inline-block;
      padding: 3px 10px;
      border-radius: 12px;
      font-size: 0.75rem;
      font-weight: 600;
      color: white;
    }

    .legend {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 12px 16px;
      background: white;
      border-radius: 10px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.08);
      flex-wrap: wrap;
    }

    .legend-title { font-weight: 600; color: #475569; font-size: 0.85rem; }

    .legend-item {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 0.8rem;
      color: #64748b;
    }

    .legend-dot {
      width: 12px;
      height: 12px;
      border-radius: 50%;
    }

    /* Status Popup */
    .status-popup {
      background: white;
      border-radius: 12px;
      box-shadow: 0 10px 40px rgba(0,0,0,0.15);
      padding: 16px;
      min-width: 220px;
      max-width: 280px;
    }

    .popup-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
      padding-bottom: 8px;
      border-bottom: 1px solid #eee;
      gap: 8px;
    }

    .popup-header strong { font-size: 0.9rem; }
    .popup-header span { font-size: 0.75rem; color: #94a3b8; }

    .popup-close {
      background: none;
      border: none;
      font-size: 1.1rem;
      cursor: pointer;
      color: #94a3b8;
      padding: 2px 6px;
      border-radius: 4px;
    }

    .popup-close:hover { background: #f1f5f9; }

    .popup-statuses {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 6px;
      margin-bottom: 12px;
    }

    .status-option {
      padding: 6px 10px;
      border: 2px solid #e2e8f0;
      border-radius: 8px;
      background: white;
      cursor: pointer;
      font-size: 0.8rem;
      font-weight: 500;
      transition: all 0.15s;
    }

    .status-option:hover { transform: scale(1.03); }
    .status-option.active { color: white; }

    .popup-note {
      margin-bottom: 12px;
    }

    .popup-note input {
      width: 100%;
      padding: 8px 12px;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      font-size: 0.82rem;
      outline: none;
    }

    .popup-note input:focus { border-color: #4361ee; }

    .popup-actions {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
    }

    /* Modal */
    .modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0,0,0,0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 2000;
    }

    .modal-content {
      background: white;
      border-radius: 14px;
      padding: 24px;
      max-width: 600px;
      width: 90%;
      max-height: 80vh;
      overflow-y: auto;
      box-shadow: 0 20px 60px rgba(0,0,0,0.2);
    }

    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
    }

    .modal-header h2 { font-size: 1.2rem; }

    .member-form {
      margin-bottom: 20px;
      padding: 16px;
      background: #f8fafc;
      border-radius: 10px;
    }

    .member-form h3 { font-size: 0.9rem; margin-bottom: 10px; color: #475569; }

    .form-row {
      display: flex;
      gap: 8px;
      align-items: center;
      flex-wrap: wrap;
    }

    .form-input {
      padding: 8px 12px;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      font-size: 0.85rem;
      outline: none;
      flex: 1;
      min-width: 100px;
    }

    .form-input:focus { border-color: #4361ee; }

    .form-color {
      width: 40px;
      height: 36px;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      cursor: pointer;
      padding: 2px;
    }

    .member-list h3 { font-size: 0.9rem; margin-bottom: 10px; color: #475569; }

    .member-table {
      width: 100%;
      border-collapse: collapse;
    }

    .member-table th, .member-table td {
      padding: 8px 12px;
      text-align: left;
      border-bottom: 1px solid #f1f5f9;
      font-size: 0.85rem;
    }

    .member-table th {
      font-weight: 600;
      color: #64748b;
      font-size: 0.78rem;
    }

    .member-color-dot {
      display: inline-block;
      width: 16px;
      height: 16px;
      border-radius: 50%;
    }

    @media (max-width: 768px) {
      .header { flex-direction: column; align-items: flex-start; }
      .header-actions { width: 100%; }
      .week-nav { flex-wrap: wrap; }
      .form-row { flex-direction: column; }
      .form-input { width: 100%; }
    }
  `;
  document.head.appendChild(style);
}

// ============================================================
// Initialization
// ============================================================

document.addEventListener('DOMContentLoaded', function() {
  // Create app container if not exists
  if (!document.getElementById('app')) {
    const appDiv = document.createElement('div');
    appDiv.id = 'app';
    document.body.appendChild(appDiv);
  }

  injectStyles();
  loadData();
  render();
});
