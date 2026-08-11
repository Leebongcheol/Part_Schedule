# Copilot Instructions

## Project Overview

Team Schedule — SPFx WebPart for ~10 team members to manage schedules, attendance, todos, and workload status. Deployed to SharePoint Online, no separate server.

## Build & Run

```bash
npm install           # Install dependencies
npm run serve         # Local development (SharePoint Workbench)
npm run build         # Build
npm run package       # Build + package .sppkg for deployment
npm test              # Run all tests
npm test -- -t "Calendar"  # Run a single test by name
npm run lint          # ESLint
```

## Architecture

- **SPFx 1.18** WebPart with React 17
- **Data**: SharePoint Lists via PnPjs v4 (`src/webparts/teamSchedule/services/SharePointService.ts`)
- **State**: React Context + useReducer (`src/webparts/teamSchedule/context/AppContext.tsx`)
- **Styling**: SCSS Modules (`.module.scss` per component)
- **UI**: Fluent UI v8 tokens + custom components

### Component Structure

```
src/webparts/teamSchedule/
├── TeamScheduleWebPart.ts        # SPFx entry point
├── components/
│   ├── TeamSchedule.tsx          # App shell (routing, layout)
│   ├── Calendar/MonthlyCalendar  # 월간 캘린더 + 일정 CRUD
│   ├── Attendance/AttendanceBar  # 오늘 근태 현황 바
│   ├── MemberDetail/MemberDetail # 팀원 상세 사이드패널
│   ├── Dashboard/Dashboard       # 팀장 대시보드
│   └── Todo/TodoList             # To Do CRUD
├── models/index.ts               # All TypeScript interfaces
├── services/SharePointService.ts # SharePoint CRUD layer
└── context/AppContext.tsx        # Global state
```

## Key Conventions

### Language & Naming

- UI labels: Korean (출근, 휴가, 진행중, etc.)
- Code: English (variable names, function names)
- Comments: Korean allowed

### Attendance Status Colors (MUST match)

| 상태   | Hex Color |
|--------|-----------|
| 출근   | #4CAF50   |
| 출장   | #FF9800   |
| 휴가   | #2196F3   |
| 공가   | #9E9E9E   |
| 재택   | #9C27B0   |

### Workload Status

Workload is NOT auto-calculated. Users manually toggle "지원 필요" via a button. States: `Normal` | `NeedSupport`.

### Data Layer

All data access goes through `SharePointService`. Never call PnPjs directly from components. The service maps SharePoint list column names (PascalCase) to TypeScript model fields (camelCase).

### SharePoint Lists

5 lists: `TeamMembers`, `Schedules`, `AttendanceStatus`, `Todos`, `WorkloadStatus`. Lookup fields link back to `TeamMembers`.

## Deployment

1. Run `scripts/Setup-SharePointLists.ps1` to create lists (requires PnP PowerShell)
2. `npm run package` → upload `.sppkg` to App Catalog
3. Add WebPart to a SharePoint Site Page
