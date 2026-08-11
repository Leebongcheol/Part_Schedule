import * as React from 'react';
import { createContext, useContext, useReducer, useCallback, ReactNode } from 'react';
import { WebPartContext } from '@microsoft/sp-webpart-base';
import { SharePointService } from '../services/SharePointService';
import {
  ITeamMember,
  ISchedule,
  IAttendanceStatus,
  ITodo,
  IWorkloadStatus,
} from '../models';

// ─── State ───────────────────────────────────────────────────

interface AppState {
  members: ITeamMember[];
  schedules: ISchedule[];
  attendance: IAttendanceStatus[];
  todos: ITodo[];
  workloadStatuses: IWorkloadStatus[];
  selectedMemberId: number | null;
  currentDate: Date;
  view: 'calendar' | 'dashboard';
  isLoading: boolean;
  error: string | null;
}

const initialState: AppState = {
  members: [],
  schedules: [],
  attendance: [],
  todos: [],
  workloadStatuses: [],
  selectedMemberId: null,
  currentDate: new Date(),
  view: 'calendar',
  isLoading: false,
  error: null,
};

// ─── Actions ─────────────────────────────────────────────────

type AppAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_MEMBERS'; payload: ITeamMember[] }
  | { type: 'SET_SCHEDULES'; payload: ISchedule[] }
  | { type: 'SET_ATTENDANCE'; payload: IAttendanceStatus[] }
  | { type: 'SET_TODOS'; payload: ITodo[] }
  | { type: 'SET_WORKLOAD'; payload: IWorkloadStatus[] }
  | { type: 'SELECT_MEMBER'; payload: number | null }
  | { type: 'SET_DATE'; payload: Date }
  | { type: 'SET_VIEW'; payload: 'calendar' | 'dashboard' }
  | { type: 'ADD_SCHEDULE'; payload: ISchedule }
  | { type: 'UPDATE_SCHEDULE'; payload: { id: number; data: Partial<ISchedule> } }
  | { type: 'DELETE_SCHEDULE'; payload: number }
  | { type: 'ADD_TODO'; payload: ITodo }
  | { type: 'UPDATE_TODO'; payload: { id: number; data: Partial<ITodo> } }
  | { type: 'DELETE_TODO'; payload: number };

function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    case 'SET_ERROR':
      return { ...state, error: action.payload };
    case 'SET_MEMBERS':
      return { ...state, members: action.payload };
    case 'SET_SCHEDULES':
      return { ...state, schedules: action.payload };
    case 'SET_ATTENDANCE':
      return { ...state, attendance: action.payload };
    case 'SET_TODOS':
      return { ...state, todos: action.payload };
    case 'SET_WORKLOAD':
      return { ...state, workloadStatuses: action.payload };
    case 'SELECT_MEMBER':
      return { ...state, selectedMemberId: action.payload };
    case 'SET_DATE':
      return { ...state, currentDate: action.payload };
    case 'SET_VIEW':
      return { ...state, view: action.payload };
    case 'ADD_SCHEDULE':
      return { ...state, schedules: [...state.schedules, action.payload] };
    case 'UPDATE_SCHEDULE':
      return {
        ...state,
        schedules: state.schedules.map(s =>
          s.id === action.payload.id ? { ...s, ...action.payload.data } : s
        ),
      };
    case 'DELETE_SCHEDULE':
      return { ...state, schedules: state.schedules.filter(s => s.id !== action.payload) };
    case 'ADD_TODO':
      return { ...state, todos: [...state.todos, action.payload] };
    case 'UPDATE_TODO':
      return {
        ...state,
        todos: state.todos.map(t =>
          t.id === action.payload.id ? { ...t, ...action.payload.data } : t
        ),
      };
    case 'DELETE_TODO':
      return { ...state, todos: state.todos.filter(t => t.id !== action.payload) };
    default:
      return state;
  }
}

// ─── Context ─────────────────────────────────────────────────

interface AppContextValue {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
  service: SharePointService;
  loadInitialData: () => Promise<void>;
}

const AppContext = createContext<AppContextValue | undefined>(undefined);

export function useAppContext(): AppContextValue {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext must be used within AppProvider');
  }
  return context;
}

// ─── Provider ────────────────────────────────────────────────

interface AppProviderProps {
  context: WebPartContext;
  children: ReactNode;
}

export function AppProvider({ context, children }: AppProviderProps): React.ReactElement {
  const [state, dispatch] = useReducer(appReducer, initialState);
  const service = React.useMemo(() => new SharePointService(context), [context]);

  const loadInitialData = useCallback(async () => {
    dispatch({ type: 'SET_LOADING', payload: true });
    dispatch({ type: 'SET_ERROR', payload: null });

    try {
      const today = new Date();
      const year = today.getFullYear();
      const month = today.getMonth();
      const startOfMonth = new Date(year, month, 1);
      const endOfMonth = new Date(year, month + 1, 0, 23, 59, 59);

      const [members, schedules, attendance, workload] = await Promise.all([
        service.getMembers(),
        service.getSchedules(startOfMonth, endOfMonth),
        service.getAttendanceByDate(today),
        service.getWorkloadStatuses(),
      ]);

      dispatch({ type: 'SET_MEMBERS', payload: members });
      dispatch({ type: 'SET_SCHEDULES', payload: schedules });
      dispatch({ type: 'SET_ATTENDANCE', payload: attendance });
      dispatch({ type: 'SET_WORKLOAD', payload: workload });
    } catch (err) {
      dispatch({ type: 'SET_ERROR', payload: (err as Error).message });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, [service]);

  const value: AppContextValue = { state, dispatch, service, loadInitialData };

  return React.createElement(AppContext.Provider, { value }, children);
}
