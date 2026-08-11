import * as React from 'react';
import { useEffect, useState, useCallback } from 'react';
import { useAppContext } from '../../context/AppContext';
import { ITeamMember, ITodo, IWorkloadStatus, ATTENDANCE_COLORS, AttendanceStatusType } from '../../models';
import { TodoList } from '../Todo/TodoList';
import styles from './MemberDetail.module.scss';

interface IMemberDetailProps {
  memberId: number;
}

export function MemberDetail({ memberId }: IMemberDetailProps): React.ReactElement {
  const { state, dispatch, service } = useAppContext();
  const [todos, setTodos] = useState<ITodo[]>([]);
  const [loading, setLoading] = useState(true);

  const member = state.members.find(m => m.id === memberId);
  const attendance = state.attendance.find(a => a.memberId === memberId);
  const workload = state.workloadStatuses.find(w => w.memberId === memberId);

  const loadTodos = useCallback(async () => {
    setLoading(true);
    const data = await service.getTodosByMember(memberId);
    setTodos(data);
    setLoading(false);
  }, [memberId, service]);

  useEffect(() => {
    loadTodos();
  }, [loadTodos]);

  const handleToggleWorkload = async (): Promise<void> => {
    const newStatus = await service.toggleWorkloadStatus(memberId);
    const updated = await service.getWorkloadStatuses();
    dispatch({ type: 'SET_WORKLOAD', payload: updated });
  };

  const handleAttendanceChange = async (status: AttendanceStatusType): Promise<void> => {
    await service.setAttendance(memberId, new Date(), status);
    const updated = await service.getAttendanceByDate(new Date());
    dispatch({ type: 'SET_ATTENDANCE', payload: updated });
  };

  if (!member) {
    return <div className={styles.container}>팀원을 찾을 수 없습니다.</div>;
  }

  const isNeedSupport = workload?.status === 'NeedSupport';
  const currentStatus = attendance?.status || '출근';

  return (
    <div className={styles.container}>
      {/* 헤더 */}
      <div className={styles.header}>
        <div className={styles.memberInfo}>
          <div className={styles.avatar} style={{ backgroundColor: member.color }}>
            {member.name.charAt(0)}
          </div>
          <div>
            <h3 className={styles.name}>{member.name}</h3>
            <span className={styles.department}>{member.department}</span>
          </div>
        </div>
        <button
          className={styles.closeBtn}
          onClick={() => dispatch({ type: 'SELECT_MEMBER', payload: null })}
        >
          ✕
        </button>
      </div>

      {/* 근태 상태 */}
      <div className={styles.section}>
        <h4>근태 상태</h4>
        <div className={styles.statusBadge} style={{ backgroundColor: ATTENDANCE_COLORS[currentStatus] }}>
          {currentStatus}
        </div>
        <div className={styles.statusButtons}>
          {(['출근', '출장', '휴가', '공가', '재택'] as AttendanceStatusType[]).map(s => (
            <button
              key={s}
              className={`${styles.statusBtn} ${s === currentStatus ? styles.activeStatus : ''}`}
              style={{ borderColor: ATTENDANCE_COLORS[s] }}
              onClick={() => handleAttendanceChange(s)}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* 업무부하 토글 */}
      <div className={styles.section}>
        <h4>업무부하 상태</h4>
        <button
          className={`${styles.workloadBtn} ${isNeedSupport ? styles.needSupport : styles.normal}`}
          onClick={handleToggleWorkload}
        >
          {isNeedSupport ? '🔴 지원 필요' : '🟢 정상'}
        </button>
        <p className={styles.hint}>
          클릭하여 상태를 변경하세요
        </p>
      </div>

      {/* To Do */}
      <div className={styles.section}>
        <h4>To Do</h4>
        {loading ? (
          <p>로딩 중...</p>
        ) : (
          <TodoList
            todos={todos}
            memberId={memberId}
            onRefresh={loadTodos}
          />
        )}
      </div>
    </div>
  );
}
