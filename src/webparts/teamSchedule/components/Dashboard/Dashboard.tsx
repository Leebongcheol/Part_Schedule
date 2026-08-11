import * as React from 'react';
import { useEffect, useState } from 'react';
import { useAppContext } from '../../context/AppContext';
import { ATTENDANCE_COLORS, AttendanceStatusType } from '../../models';
import styles from './Dashboard.module.scss';

export function Dashboard(): React.ReactElement {
  const { state, service } = useAppContext();
  const { members, attendance, workloadStatuses } = state;
  const [todosInProgress, setTodosInProgress] = useState(0);

  useEffect(() => {
    service.getDashboardSummary().then(data => {
      setTodosInProgress(data.todosInProgress);
    });
  }, [service]);

  const attendanceSummary = {
    출근: attendance.filter(a => a.status === '출근').length,
    출장: attendance.filter(a => a.status === '출장').length,
    휴가: attendance.filter(a => a.status === '휴가').length,
    공가: attendance.filter(a => a.status === '공가').length,
    재택: attendance.filter(a => a.status === '재택').length,
  };

  const needSupportMembers = workloadStatuses
    .filter(w => w.status === 'NeedSupport')
    .map(w => members.find(m => m.id === w.memberId))
    .filter(Boolean);

  return (
    <div className={styles.container}>
      <h2 className={styles.title}>📊 팀 현황 대시보드</h2>

      {/* 요약 카드 */}
      <div className={styles.cardGrid}>
        <div className={styles.card}>
          <span className={styles.cardValue}>{members.length}</span>
          <span className={styles.cardLabel}>전체 인원</span>
        </div>
        <div className={styles.card}>
          <span className={styles.cardValue}>{attendanceSummary.출장}</span>
          <span className={styles.cardLabel}>출장</span>
        </div>
        <div className={styles.card}>
          <span className={styles.cardValue}>{attendanceSummary.휴가}</span>
          <span className={styles.cardLabel}>휴가</span>
        </div>
        <div className={styles.card}>
          <span className={styles.cardValue}>{attendanceSummary.재택}</span>
          <span className={styles.cardLabel}>재택</span>
        </div>
        <div className={`${styles.card} ${needSupportMembers.length > 0 ? styles.alertCard : ''}`}>
          <span className={styles.cardValue}>{needSupportMembers.length}</span>
          <span className={styles.cardLabel}>🔴 지원 필요</span>
        </div>
        <div className={styles.card}>
          <span className={styles.cardValue}>{todosInProgress}</span>
          <span className={styles.cardLabel}>진행중 업무</span>
        </div>
      </div>

      {/* 지원 필요 인원 */}
      {needSupportMembers.length > 0 && (
        <div className={styles.alertSection}>
          <h3>⚠️ 지원 필요 인원</h3>
          <div className={styles.alertList}>
            {needSupportMembers.map(member => member && (
              <div key={member.id} className={styles.alertItem}>
                <span className={styles.alertDot}>🔴</span>
                <span className={styles.alertName}>{member.name}</span>
                <span className={styles.alertDept}>{member.department}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 팀원별 현황 */}
      <div className={styles.tableSection}>
        <h3>📈 팀원별 현황</h3>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>이름</th>
              <th>근태</th>
              <th>업무부하</th>
            </tr>
          </thead>
          <tbody>
            {members.map(member => {
              const att = attendance.find(a => a.memberId === member.id);
              const wl = workloadStatuses.find(w => w.memberId === member.id);
              const status = att?.status || '출근';
              const isAlert = wl?.status === 'NeedSupport';

              return (
                <tr key={member.id} className={isAlert ? styles.alertRow : ''}>
                  <td>
                    <span className={styles.colorDot} style={{ backgroundColor: member.color }} />
                    {member.name}
                  </td>
                  <td>
                    <span
                      className={styles.statusTag}
                      style={{ backgroundColor: ATTENDANCE_COLORS[status as AttendanceStatusType] }}
                    >
                      {status}
                    </span>
                  </td>
                  <td>
                    {isAlert ? (
                      <span className={styles.alertBadge}>🔴 지원 필요</span>
                    ) : (
                      <span className={styles.normalBadge}>🟢 정상</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
