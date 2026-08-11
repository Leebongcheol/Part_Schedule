import * as React from 'react';
import { useMemo, useState, useCallback } from 'react';
import { useAppContext } from '../../context/AppContext';
import { ISchedule } from '../../models';
import styles from './MonthlyCalendar.module.scss';

export function MonthlyCalendar(): React.ReactElement {
  const { state, dispatch, service } = useAppContext();
  const { currentDate, schedules, members } = state;
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const calendarDays = useMemo(() => {
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days: (number | null)[] = [];

    // 빈 칸 (이전 월)
    for (let i = 0; i < firstDay; i++) {
      days.push(null);
    }
    // 해당 월 날짜
    for (let d = 1; d <= daysInMonth; d++) {
      days.push(d);
    }
    return days;
  }, [year, month]);

  const getSchedulesForDay = useCallback(
    (day: number): ISchedule[] => {
      const date = new Date(year, month, day);
      return schedules.filter(s => {
        const start = new Date(s.startDate.toString());
          const end = new Date(s.endDate.toString());
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
          return date.getTime() >= start.getTime() && date.getTime() <= end.getTime();
      });
    },
    [schedules, year, month]
  );

  const getMemberColor = useCallback(
    (assigneeId: number): string => {
      const member = members.find(m => m.id === assigneeId);
      return member?.color || '#8a8886';
    },
    [members]
  );

  const navigateMonth = (direction: number): void => {
    const newDate = new Date(year, month + direction, 1);
    dispatch({ type: 'SET_DATE', payload: newDate });

    // 새 월의 일정 로드
    const start = new Date(newDate.getFullYear(), newDate.getMonth(), 1);
    const end = new Date(newDate.getFullYear(), newDate.getMonth() + 1, 0, 23, 59, 59);
    service.getSchedules(start, end).then(data => {
      dispatch({ type: 'SET_SCHEDULES', payload: data });
    });
  };

  const isToday = (day: number): boolean => {
    const today = new Date();
    return (
      today.getFullYear() === year &&
      today.getMonth() === month &&
      today.getDate() === day
    );
  };

  const handleDayClick = (day: number): void => {
    setSelectedDate(new Date(year, month, day));
    setShowAddModal(true);
  };

  const handleAddSchedule = async (title: string, assigneeId: number): Promise<void> => {
    if (!selectedDate || !title.trim()) return;

    const newSchedule = await service.addSchedule({
      title,
      startDate: selectedDate,
      endDate: selectedDate,
      assigneeId,
      description: '',
      category: '업무',
      isRecurring: false,
    });
    dispatch({ type: 'ADD_SCHEDULE', payload: newSchedule });
    setShowAddModal(false);
  };

  const handleDeleteSchedule = async (id: number): Promise<void> => {
    await service.deleteSchedule(id);
    dispatch({ type: 'DELETE_SCHEDULE', payload: id });
  };

  const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

  return (
    <div className={styles.container}>
      {/* 월 네비게이션 */}
      <div className={styles.monthNav}>
        <button className={styles.navArrow} onClick={() => navigateMonth(-1)}>◀</button>
        <h2 className={styles.monthTitle}>{year}년 {month + 1}월</h2>
        <button className={styles.navArrow} onClick={() => navigateMonth(1)}>▶</button>
      </div>

      {/* 요일 헤더 */}
      <div className={styles.weekHeader}>
        {WEEKDAYS.map((day, i) => (
          <div
            key={day}
            className={`${styles.weekDay} ${i === 0 ? styles.sunday : ''} ${i === 6 ? styles.saturday : ''}`}
          >
            {day}
          </div>
        ))}
      </div>

      {/* 캘린더 그리드 */}
      <div className={styles.grid}>
        {calendarDays.map((day, index) => (
          <div
            key={index}
            className={`${styles.cell} ${day ? styles.hasDay : ''} ${day && isToday(day) ? styles.today : ''}`}
            onClick={() => day && handleDayClick(day)}
          >
            {day && (
              <>
                <span className={styles.dayNumber}>{day}</span>
                <div className={styles.scheduleList}>
                  {getSchedulesForDay(day).slice(0, 3).map(schedule => (
                    <div
                      key={schedule.id}
                      className={styles.scheduleItem}
                      style={{ backgroundColor: getMemberColor(schedule.assigneeId) }}
                      title={`${schedule.title} (${schedule.assigneeName || ''})`}
                    >
                      <span className={styles.scheduleTitle}>{schedule.title}</span>
                      <button
                        className={styles.deleteBtn}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteSchedule(schedule.id);
                        }}
                        title="삭제"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  {getSchedulesForDay(day).length > 3 && (
                    <span className={styles.moreCount}>
                      +{getSchedulesForDay(day).length - 3}
                    </span>
                  )}
                </div>
              </>
            )}
          </div>
        ))}
      </div>

      {/* 일정 추가 모달 */}
      {showAddModal && selectedDate && (
        <AddScheduleModal
          date={selectedDate}
          members={members}
          onAdd={handleAddSchedule}
          onClose={() => setShowAddModal(false)}
        />
      )}
    </div>
  );
}

// ─── 일정 추가 모달 ──────────────────────────────────────────

interface AddScheduleModalProps {
  date: Date;
  members: { id: number; name: string }[];
  onAdd: (title: string, assigneeId: number) => Promise<void>;
  onClose: () => void;
}

function AddScheduleModal({ date, members, onAdd, onClose }: AddScheduleModalProps): React.ReactElement {
  const [title, setTitle] = useState('');
  const [assigneeId, setAssigneeId] = useState(members[0]?.id || 0);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    await onAdd(title, assigneeId);
    setSaving(false);
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <h3>일정 추가 - {date.getMonth() + 1}/{date.getDate()}</h3>
        <form onSubmit={handleSubmit}>
          <div className={styles.formGroup}>
            <label>제목</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="일정 제목을 입력하세요"
              autoFocus
            />
          </div>
          <div className={styles.formGroup}>
            <label>담당자</label>
            <select value={assigneeId} onChange={e => setAssigneeId(Number(e.target.value))}>
              {members.map(m => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>
          <div className={styles.modalActions}>
            <button type="button" onClick={onClose}>취소</button>
            <button type="submit" disabled={saving || !title.trim()}>
              {saving ? '저장 중...' : '추가'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
