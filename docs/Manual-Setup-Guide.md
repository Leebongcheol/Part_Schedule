# Microsoft Lists 수동 생성 가이드 — 패키징기술파트

스크립트 실행이 불가한 경우, 아래 절차로 수동 생성합니다.

---

## 사전 준비

- Teams "기구코어기술Project" → "패키징기술파트" 채널이 생성되어 있어야 함
- 비공개 채널인 경우 별도의 SharePoint 사이트가 자동 생성됨

---

## 생성 순서 (중요!)

**PKG_TeamMembers를 가장 먼저 생성** → 나머지 리스트에서 Lookup 참조

---

## 1. PKG_TeamMembers 리스트

### 생성
1. Teams → 기구코어기술Project → 패키징기술파트 채널
2. 상단 `+` (탭 추가) → **Lists** 선택
3. **빈 목록 만들기** 선택
4. 이름: `PKG_TeamMembers`

### 컬럼 추가
| 컬럼명 | 유형 | 설정 |
|--------|------|------|
| Title | 한 줄 텍스트 | (기본 존재 - "이름"으로 사용) |
| Color | 한 줄 텍스트 | #HEX 색상값 |
| Department | 한 줄 텍스트 | 부서명 |
| Role | 선택 | 선택지: Member, Leader |
| Email | 한 줄 텍스트 | 이메일 |
| IsActive | 예/아니요 | 기본값: 예 |

### 샘플 데이터
| Title | Color | Department | Role | Email | IsActive |
|-------|-------|------------|------|-------|----------|
| 홍길동 | #0078D4 | 패키징기술파트 | Leader | hong@company.com | ✅ |
| 김철수 | #107C10 | 패키징기술파트 | Member | kim@company.com | ✅ |
| 이영희 | #FF8C00 | 패키징기술파트 | Member | lee@company.com | ✅ |

---

## 2. PKG_Schedules 리스트

### 생성
- 탭 추가 → Lists → 빈 목록 → 이름: `PKG_Schedules`

### 컬럼 추가
| 컬럼명 | 유형 | 설정 |
|--------|------|------|
| Title | 한 줄 텍스트 | (기본 존재 - "일정 제목"으로 사용) |
| StartDate | 날짜 및 시간 | 날짜만 |
| EndDate | 날짜 및 시간 | 날짜만 |
| Assignee | 조회 | 조회 목록: PKG_TeamMembers, 표시 컬럼: Title |
| Description | 여러 줄 텍스트 | |
| Category | 선택 | 선택지: 회의, 업무, 기타 |
| IsRecurring | 예/아니요 | 기본값: 아니요 |
| RecurrenceRule | 한 줄 텍스트 | 반복 규칙 |

---

## 3. PKG_AttendanceStatus 리스트

### 생성
- 탭 추가 → Lists → 빈 목록 → 이름: `PKG_AttendanceStatus`

### 컬럼 추가
| 컬럼명 | 유형 | 설정 |
|--------|------|------|
| Title | 한 줄 텍스트 | (기본 - 사용하지 않거나 날짜 메모용) |
| Member | 조회 | 조회 목록: PKG_TeamMembers, 표시 컬럼: Title |
| Date | 날짜 및 시간 | 날짜만 |
| Status | 선택 | 선택지: 출근, 출장, 휴가, 공가, 재택 |
| Note | 한 줄 텍스트 | 비고 |

---

## 4. PKG_Todos 리스트

### 생성
- 탭 추가 → Lists → 빈 목록 → 이름: `PKG_Todos`

### 컬럼 추가
| 컬럼명 | 유형 | 설정 |
|--------|------|------|
| Title | 한 줄 텍스트 | (기본 존재 - "업무명"으로 사용) |
| Assignee | 조회 | 조회 목록: PKG_TeamMembers, 표시 컬럼: Title |
| Status | 선택 | 선택지: 대기, 진행중, 완료 |
| Priority | 선택 | 선택지: 높음, 보통, 낮음 |
| DueDate | 날짜 및 시간 | 날짜만 |
| Memo | 여러 줄 텍스트 | |

---

## 5. PKG_WorkloadStatus 리스트

### 생성
- 탭 추가 → Lists → 빈 목록 → 이름: `PKG_WorkloadStatus`

### 컬럼 추가
| 컬럼명 | 유형 | 설정 |
|--------|------|------|
| Title | 한 줄 텍스트 | (기본 - 사용하지 않거나 메모용) |
| Member | 조회 | 조회 목록: PKG_TeamMembers, 표시 컬럼: Title |
| Status | 선택 | 선택지: Normal, NeedSupport |
| UpdatedAt | 날짜 및 시간 | 날짜 및 시간 포함 |

---

## 뷰 설정 (선택)

### PKG_Schedules - 캘린더 뷰
1. 리스트 상단 → 뷰 → 캘린더
2. 시작일: StartDate, 종료일: EndDate, 제목: Title

### PKG_AttendanceStatus - 그룹화 뷰
1. 기본 뷰에서 "Member" 기준 그룹화
2. 또는 "Date" 기준 그룹화 (일별 확인)

### PKG_Todos - 보드 뷰 (칸반)
1. 리스트 상단 → 뷰 → 보드
2. 버킷 기준: Status (대기/진행중/완료)

---

## Teams 채널 탭 고정

생성된 리스트는 자동으로 탭에 추가됩니다.
추가 탭이 필요하면:

1. Teams → 기구코어기술Project → 패키징기술파트 채널
2. 상단 `+` → Lists → "기존 목록에서" → 원하는 리스트 선택

### 추천 탭 구성
- `PKG_Schedules` — 일정 (캘린더 뷰)
- `PKG_AttendanceStatus` — 근태
- `PKG_Todos` — 할 일 (보드 뷰)

---

## 참고

- 조회(Lookup) 컬럼은 **PKG_TeamMembers 리스트를 먼저 생성**해야 설정 가능
- 생성 순서: PKG_TeamMembers → PKG_Schedules → PKG_AttendanceStatus → PKG_Todos → PKG_WorkloadStatus
- PKG_ 접두사는 다른 파트(설계파트, 평가파트 등)와 리스트명 충돌 방지용
