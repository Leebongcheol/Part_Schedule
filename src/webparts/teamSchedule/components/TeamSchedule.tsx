import * as React from 'react';
import { useEffect } from 'react';
import { WebPartContext } from '@microsoft/sp-webpart-base';
import { AppProvider, useAppContext } from '../context/AppContext';
import { MonthlyCalendar } from './Calendar/MonthlyCalendar';
import { AttendanceBar } from './Attendance/AttendanceBar';
import { MemberDetail } from './MemberDetail/MemberDetail';
import { Dashboard } from './Dashboard/Dashboard';
import styles from './TeamSchedule.module.scss';

interface ITeamScheduleProps {
  context: WebPartContext;
}

function TeamScheduleInner(): React.ReactElement {
  const { state, dispatch, loadInitialData } = useAppContext();

  useEffect(() => {
    loadInitialData();
  }, []);

  if (state.isLoading) {
    return <div className={styles.loading}>로딩 중...</div>;
  }

  if (state.error) {
    return <div className={styles.error}>오류: {state.error}</div>;
  }

  return (
    <div className={styles.container}>
      {/* 헤더 */}
      <header className={styles.header}>
        <h1 className={styles.title}>📅 Team Schedule</h1>
        <nav className={styles.nav}>
          <button
            className={`${styles.navBtn} ${state.view === 'calendar' ? styles.active : ''}`}
            onClick={() => dispatch({ type: 'SET_VIEW', payload: 'calendar' })}
          >
            캘린더
          </button>
          <button
            className={`${styles.navBtn} ${state.view === 'dashboard' ? styles.active : ''}`}
            onClick={() => dispatch({ type: 'SET_VIEW', payload: 'dashboard' })}
          >
            대시보드
          </button>
        </nav>
      </header>

      {/* 근태 현황 바 */}
      <AttendanceBar />

      {/* 메인 콘텐츠 */}
      <main className={styles.main}>
        {state.view === 'calendar' ? (
          <div className={styles.calendarLayout}>
            <div className={styles.calendarArea}>
              <MonthlyCalendar />
            </div>
            {state.selectedMemberId && (
              <aside className={styles.sidePanel}>
                <MemberDetail memberId={state.selectedMemberId} />
              </aside>
            )}
          </div>
        ) : (
          <Dashboard />
        )}
      </main>
    </div>
  );
}

export default function TeamSchedule({ context }: ITeamScheduleProps): React.ReactElement {
  return (
    <AppProvider context={context}>
      <TeamScheduleInner />
    </AppProvider>
  );
}
