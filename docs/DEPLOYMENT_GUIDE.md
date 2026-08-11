# 배포 가이드 - Team Schedule WebPart

> 대상 사이트: https://lgeteams.sharepoint.com/sites/packing_part_schedule/

---

## 1단계: SharePoint List 생성 (브라우저)

아래 5개 List를 SharePoint 사이트에서 직접 생성합니다.

### 1-1. TeamMembers 리스트

1. 사이트 접속 → ⚙️ 설정 → **사이트 콘텐츠**
2. **+ 새로 만들기** → **목록** → **빈 목록** 선택
3. 이름: `TeamMembers` → **만들기**
4. **+ 열 추가** 로 아래 열 추가:

| 열 이름 | 유형 | 비고 |
|---------|------|------|
| Color | 한 줄 텍스트 | #HEX 색상코드 |
| Department | 한 줄 텍스트 | 부서 |
| Role | 선택 | 선택값: `Member`, `Leader` |
| Email | 한 줄 텍스트 | 이메일 |
| IsActive | 예/아니요 | 기본값: 예 |

5. 초기 데이터 입력 (**+ 새 항목**):

| Title(제목) | Color | Department | Role | Email | IsActive |
|-------------|-------|------------|------|-------|----------|
| 이봉철 | #0000FF | 개발팀 | Leader | bclee@company.com | 예 |
| 박상율 | #00AA00 | 개발팀 | Member | sypark@company.com | 예 |
| 김철수 | #FF8800 | 개발팀 | Member | cskim@company.com | 예 |
| 홍길동 | #9900CC | 개발팀 | Member | gdhong@company.com | 예 |

---

### 1-2. Schedules 리스트

1. **사이트 콘텐츠** → **+ 새로 만들기** → **목록** → `Schedules`
2. 열 추가:

| 열 이름 | 유형 | 비고 |
|---------|------|------|
| StartDate | 날짜 및 시간 | 시작일 |
| EndDate | 날짜 및 시간 | 종료일 |
| Description | 여러 줄 텍스트 | 설명 |
| Category | 선택 | 선택값: `회의`, `업무`, `기타` |
| IsRecurring | 예/아니요 | 반복 여부 |
| RecurrenceRule | 한 줄 텍스트 | 반복 규칙 |
| Assignee | 조회 | 조회 대상: `TeamMembers` → `Title` 열 |

---

### 1-3. AttendanceStatus 리스트

1. **사이트 콘텐츠** → **+ 새로 만들기** → **목록** → `AttendanceStatus`
2. 열 추가:

| 열 이름 | 유형 | 비고 |
|---------|------|------|
| Date | 날짜 및 시간 | 날짜만 |
| Status | 선택 | 선택값: `출근`, `출장`, `휴가`, `공가`, `재택` |
| Note | 한 줄 텍스트 | 비고 |
| Member | 조회 | 조회 대상: `TeamMembers` → `Title` 열 |

---

### 1-4. Todos 리스트

1. **사이트 콘텐츠** → **+ 새로 만들기** → **목록** → `Todos`
2. 열 추가:

| 열 이름 | 유형 | 비고 |
|---------|------|------|
| Status | 선택 | 선택값: `대기`, `진행중`, `완료` |
| Priority | 선택 | 선택값: `높음`, `보통`, `낮음` |
| DueDate | 날짜 및 시간 | 마감일 |
| Memo | 여러 줄 텍스트 | 메모 |
| Assignee | 조회 | 조회 대상: `TeamMembers` → `Title` 열 |

---

### 1-5. WorkloadStatus 리스트

1. **사이트 콘텐츠** → **+ 새로 만들기** → **목록** → `WorkloadStatus`
2. 열 추가:

| 열 이름 | 유형 | 비고 |
|---------|------|------|
| Status | 선택 | 선택값: `Normal`, `NeedSupport` |
| UpdatedAt | 날짜 및 시간 | 변경일시 |
| UpdatedBy | 사용자 | 변경자 |
| Member | 조회 | 조회 대상: `TeamMembers` → `Title` 열 |

3. TeamMembers의 각 팀원에 대해 초기 항목 추가 (Status = `Normal`)

---

## 2단계: App Catalog에 WebPart 배포

### 방법 A: Site Collection App Catalog 사용 (권장 - 관리자 권한 불필요)

> Site Collection App Catalog이 활성화되어 있어야 합니다.
> 활성화 안 됨 → 방법 B 사용

1. 사이트 접속 → ⚙️ 설정 → **사이트 콘텐츠**
2. **Site Collection 앱** 폴더 클릭 (또는 URL에 `/AppCatalog` 추가)
   - URL: `https://lgeteams.sharepoint.com/sites/packing_part_schedule/AppCatalog`
3. **업로드** → `sharepoint\solution\team-schedule.sppkg` 파일 선택
4. **신뢰** 대화상자 → **배포** 클릭

### 방법 B: 테넌트 App Catalog 사용 (SharePoint 관리자 필요)

1. SharePoint 관리 센터 접속
   - URL: `https://lgeteams-admin.sharepoint.com`
2. **고급** → **앱** → **앱 카탈로그**
3. **SharePoint용 앱** 클릭
4. **업로드** → `sharepoint\solution\team-schedule.sppkg` 파일 선택
5. **이 솔루션을 조직의 모든 사이트에서 사용할 수 있도록 합니다** 체크
6. **배포** 클릭

---

## 3단계: 사이트에 WebPart 추가

1. `https://lgeteams.sharepoint.com/sites/packing_part_schedule/` 접속
2. **+ 새로 만들기** → **페이지** (또는 기존 페이지 편집)
3. 페이지 편집 모드에서 **+** (섹션 추가) 클릭
4. **전체 너비** 레이아웃 선택 (권장)
5. **+** (웹 파트 추가) 클릭
6. 검색창에 `팀 일정관리` 입력
7. **팀 일정관리** WebPart 클릭하여 추가
8. **게시** 클릭

---

## 4단계: 확인

1. 페이지가 정상적으로 캘린더를 표시하는지 확인
2. 팀원 목록이 나타나는지 확인
3. 일정 추가/수정/삭제 테스트
4. 근태 상태 변경 테스트
5. "지원 필요" 토글 테스트
6. 대시보드 뷰 전환 테스트

---

## 배포 후 URL 공유

팀원들에게 아래 URL만 공유하면 됩니다:

```
https://lgeteams.sharepoint.com/sites/packing_part_schedule/SitePages/팀일정관리.aspx
```

(페이지 이름은 생성 시 지정한 이름에 따라 다름)

---

## 업데이트 방법

코드 수정 후:

```bash
npm run package
```

생성된 `.sppkg` 파일을 App Catalog에 다시 업로드 → **기존 항목 바꾸기** → **배포**

---

## 문제 해결

| 증상 | 해결 방법 |
|------|-----------|
| WebPart가 검색에 안 나옴 | App Catalog에 배포 여부 확인, 페이지 새로고침 |
| "액세스 거부" 오류 | Site Members 권한 확인 |
| List 데이터 안 나옴 | 리스트 이름 정확히 일치하는지 확인 (대소문자 구분) |
| 빈 화면 | F12 → Console 탭에서 오류 확인 |
