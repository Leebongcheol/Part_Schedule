# 패키징기술파트 Schedule

파트원 8명 내외가 사용하는 근태·업무 공유 웹앱입니다.
GitHub Pages URL 하나만 공유하면 바로 사용할 수 있습니다.

**배포 주소**: https://leebongcheol.github.io/Part_Schedule/

---

## 저장 방식 (중요)

두 가지 모드로 동작하며, 좌측 하단에 현재 상태가 표시됩니다.

| 상태 | 의미 |
|---|---|
| 🟢 실시간 공유 중 | 파트원 전체가 같은 데이터를 봅니다. 다른 사람 입력이 새로고침 없이 반영됩니다. |
| ⚪ 이 브라우저에만 저장 | 개인 브라우저에만 저장됩니다 (공유 안 됨). |

기본값은 **오프라인 모드**입니다.
파트 공유를 켜려면 **[docs/SETUP-FIREBASE.md](docs/SETUP-FIREBASE.md)** 를 따라
Firebase Realtime Database를 연결하세요. 약 10분, 무료, 카드 등록 불필요.

연결하면 **로그인 화면 없이 링크만 공유**해서 사용합니다 (익명 인증).
접근을 제한하려면 `AUTH_MODE`를 `'login'`으로 바꿔 공유 계정 방식으로 전환할 수 있습니다.

---

## 기능

| 메뉴 | 내용 |
|---|---|
| 📢 공지사항 | 공지 / 회의록 / 메모 작성·수정·삭제 |
| 🗓️ 월간 근태 | 달력 형식으로 한 달 근태 확인, 날짜 클릭 시 팀원 전체 일괄 입력, 월간 집계 |
| 📆 주간 스케줄 | 근태와 To Do를 한 테이블에서 관리 (팀원 1명 = 1행), 팀원별 진행률 |
| 📊 대시보드 | 오늘 날짜 표시, 근태 현황 / 업무 현황 섹션 분리, 지원 필요·마감 임박 알림 |
| 👥 팀원 관리 | 표에서 바로 수정(인라인), 직책·사번·이메일·색상 |
| 📖 사용 가이드 | 앱 내 사용법 안내 |

- 근태: **출장 / 휴가 / 교육 / 기타** (입력값 없으면 🟢 출근)
- 할 일: 담당자, 우선순위, 시작일/마감일, 지원 필요 표시, 진행률
- 인쇄 최적화, 모바일 반응형, 백업/복원(JSON)

---

## 파일 구조

```
docs/
├── index.html            # 화면
├── style.css             # 스타일
├── app.js                # 앱 로직 (렌더링/이벤트)
├── datastore.js          # 저장 계층 (localStorage ↔ Firebase 실시간)
├── firebase-config.js    # 연결 설정 (비어 있으면 오프라인)
└── SETUP-FIREBASE.md     # 공유 설정 가이드
```

## 테스트

```bash
node run-tests.js      # 전체 (기능 + 실시간 동기화)
node test-app.js       # 기능 테스트
node test-sync.js      # 실시간 동기화 (가짜 Firebase로 클라이언트 2개 시뮬레이션)
```

jsdom 기반이며 `node_modules`가 필요합니다 (`npm install`).

---

## (구버전) SharePoint Framework

`src/`, `config/`, `sharepoint/` 의 SPFx 기반 코드는 더 이상 사용하지 않습니다.
사내 SharePoint 연동이 필요할 경우 `src/webparts/teamSchedule/services/SharePointService.ts` 를 참고하세요.
