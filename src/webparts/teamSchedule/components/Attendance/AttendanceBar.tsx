import * as React from 'react';
import { useMemo } from 'react';
import { useAppContext } from '../../context/AppContext';
import { ATTENDANCE_COLORS } from '../../models';
import styles from './AttendanceBar.module.scss';

export function AttendanceBar(): React.ReactElement {
  const { state, dispatch } = useAppContext();
  const { members, attendance, workloadStatuses } = state;

  const needSupportMembers = useMemo(
    () => workloadStatuses.filter(w => w.status === 'NeedSupport'),
    [workloadStatuses]
  );

  return (
    <div className={styles.container}>
      {/* 오늘 근태 현황 */}
      <div className={styles.attendanceRow}>
        <span className={styles.label}>오늘 근태</span>
        <div className={styles.memberList}>
          {members.map(member => {
            const att = attendance.find(a => a.memberId === member.id);
            const statusText = att?.status || '출근';
            const statusColor = ATTENDANCE_COLORS[statusText];

            return (
              <button
                key={member.id}
                className={styles.memberChip}
                style={{ borderColor: member.color }}
                onClick={() => dispatch({ type: 'SELECT_MEMBER', payload: member.id })}
                title={`${member.name} - ${statusText}`}
              >
                <span
                  className={styles.statusDot}
                  style={{ backgroundColor: statusColor }}
                />
                <span className={styles.memberName}>{member.name}</span>
                <span className={styles.statusText}>{statusText}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 지원 필요 알림 */}
      {needSupportMembers.length > 0 && (
        <div className={styles.alertRow}>
          <span className={styles.alertIcon}>🔴</span>
          <span className={styles.alertLabel}>지원 필요:</span>
          {needSupportMembers.map(w => {
            const member = members.find(m => m.id === w.memberId);
            return member ? (
              <button
                key={w.id}
                className={styles.alertChip}
                onClick={() => dispatch({ type: 'SELECT_MEMBER', payload: member.id })}
              >
                🚨 {member.name}
              </button>
            ) : null;
          })}
        </div>
      )}
    </div>
  );
}
