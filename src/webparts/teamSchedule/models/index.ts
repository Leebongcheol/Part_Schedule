/**
 * 팀원 정보
 */
export interface ITeamMember {
  id: number;
  name: string;
  color: string;
  department: string;
  role: 'Member' | 'Leader';
  email: string;
  isActive: boolean;
}

/**
 * 일정 정보
 */
export interface ISchedule {
  id: number;
  title: string;
  startDate: Date;
  endDate: Date;
  assigneeId: number;
  assigneeName?: string;
  description: string;
  category: '회의' | '업무' | '기타';
  isRecurring: boolean;
  recurrenceRule?: string;
}

/**
 * 근태 상태
 */
export type AttendanceStatusType = '출근' | '출장' | '휴가' | '공가' | '재택';

export interface IAttendanceStatus {
  id: number;
  memberId: number;
  memberName?: string;
  date: Date;
  status: AttendanceStatusType;
  note?: string;
}

/**
 * To Do 항목
 */
export type TodoStatus = '대기' | '진행중' | '완료';
export type TodoPriority = '높음' | '보통' | '낮음';

export interface ITodo {
  id: number;
  title: string;
  assigneeId: number;
  assigneeName?: string;
  status: TodoStatus;
  priority: TodoPriority;
  dueDate?: Date;
  memo?: string;
}

/**
 * 업무부하 상태
 */
export type WorkloadStatusType = 'Normal' | 'NeedSupport';

export interface IWorkloadStatus {
  id: number;
  memberId: number;
  memberName?: string;
  status: WorkloadStatusType;
  updatedAt: Date;
  updatedBy?: string;
}

/**
 * 근태 상태별 색상 매핑
 */
export const ATTENDANCE_COLORS: Record<AttendanceStatusType, string> = {
  '출근': '#4CAF50',  // 녹색
  '출장': '#FF9800',  // 주황
  '휴가': '#2196F3',  // 파랑
  '공가': '#9E9E9E',  // 회색
  '재택': '#9C27B0',  // 보라
};

/**
 * 대시보드 요약 데이터
 */
export interface IDashboardSummary {
  totalMembers: number;
  onTrip: number;
  onLeave: number;
  remote: number;
  needSupport: number;
  needSupportMembers: ITeamMember[];
  inProgressTodos: number;
}
