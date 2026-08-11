# Part_Schedule - 파트 스케줄표

팀원 10명 내외가 사용하는 주간 스케줄 공유 웹앱입니다.

## GitHub Pages 버전 (현재 사용)

> SharePoint 없이 **GitHub Pages URL 하나만 공유**하면 바로 사용 가능!

### 배포 방법

1. 이 레포를 GitHub에 push
2. Settings → Pages → Branch: `main`, Folder: `/docs` → Save
3. 생성된 URL을 팀원에게 공유

### 파일 위치

```
docs/
├── index.html    # 메인 페이지
├── style.css     # 스타일
└── app.js        # 앱 로직
```

### 주요 기능

- 📅 주간 캘린더 (월~금)
- 👥 팀원 관리 (추가/삭제/색상 지정)
- 🏷️ 상태: 출근 / 출장 / 휴가 / 공가 / 재택 / 교육
- 💾 localStorage 기반 (서버 불필요)
- 📤 JSON 내보내기/가져오기 (팀원 간 데이터 공유)
- 🖨️ 인쇄 최적화

### 사용법

1. URL 접속 → 북마크
2. 셀 클릭 → 상태 선택
3. 팀원 관리 버튼으로 멤버 추가/삭제
4. 데이터 공유: 내보내기 → JSON 파일 전달 → 가져오기

---

## (구버전) SharePoint Framework 버전

이전 SPFx 기반 버전의 파일들은 `src/`, `config/`, `sharepoint/` 등에 남아있습니다.  
더 이상 사용하지 않으며, GitHub Pages 버전으로 대체되었습니다.
