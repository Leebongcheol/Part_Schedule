# Firebase 연결 가이드 (파트원 실시간 공유)

이 문서대로 설정하면 **링크 하나로 파트원 8명이 실시간 공유**하게 됩니다.
설정 전에는 오프라인 모드(브라우저별 개별 저장)로 동작합니다.

소요 시간: 약 10분. **신용카드 등록이 필요 없습니다.**

---

## 1. Firebase 프로젝트 만들기

1. https://console.firebase.google.com 접속 (Google 계정 로그인)
2. **프로젝트 추가** → 이름: `part-schedule` → 계속
3. Google 애널리틱스는 **사용 안함** 선택 → 프로젝트 만들기

## 2. Realtime Database 생성

1. 좌측 메뉴 **빌드 → Realtime Database** → **데이터베이스 만들기**
2. 위치: **asia-southeast1 (싱가포르)** 선택 — 한국에서 가장 빠릅니다
3. 보안 규칙: **잠금 모드로 시작** 선택 → 사용 설정
4. 생성 후 화면 상단의 URL을 복사해 둡니다
   예: `https://part-schedule-1234-default-rtdb.asia-southeast1.firebasedatabase.app`

## 3. 웹 앱 등록 & 설정값 복사

1. 좌측 상단 **프로젝트 개요** 옆 ⚙️ → **프로젝트 설정**
2. 아래 **내 앱** 에서 **웹 아이콘 `</>`** 클릭
3. 앱 닉네임 `part-schedule-web` 입력 → **앱 등록** (호스팅은 체크하지 않음)
4. 표시되는 `firebaseConfig` 값을 복사

## 4. 로그인 계정 만들기

1. 좌측 메뉴 **빌드 → Authentication** → **시작하기**
2. **이메일/비밀번호** 선택 → **사용 설정** → 저장
3. **Users** 탭 → **사용자 추가**
   - 이메일: `packaging@part.local` (실제 메일 주소가 아니어도 됩니다)
   - 비밀번호: 파트원과 공유할 비밀번호
4. 이 계정 하나를 파트원 8명이 함께 사용합니다

> 개인별 계정을 원하면 사용자를 8명 추가하면 됩니다. 데이터 접근 권한은 동일합니다.

## 5. 보안 규칙 설정 ⚠️ 중요

**Realtime Database → 규칙** 탭에서 아래로 교체하고 **게시**:

```json
{
  "rules": {
    "teams": {
      "$teamId": {
        ".read": "auth != null",
        ".write": "auth != null"
      }
    }
  }
}
```

이 규칙은 **로그인한 사용자만** 읽기/쓰기를 허용합니다.
`.read: true` 처럼 열어두면 URL을 아는 누구나 데이터를 볼 수 있으니 사용하지 마세요.

## 6. 설정값 입력

`docs/firebase-config.js` 파일을 열어 3~4번에서 복사한 값을 채웁니다.

```js
window.FIREBASE_CONFIG = {
  apiKey: 'AIzaSy...',
  authDomain: 'part-schedule-1234.firebaseapp.com',
  databaseURL: 'https://part-schedule-1234-default-rtdb.asia-southeast1.firebasedatabase.app',
  projectId: 'part-schedule-1234'
};

window.TEAM_ID = 'packaging-tech';
window.REQUIRE_LOGIN = true;
```

저장 후 커밋 & 푸시:

```bash
git add docs/firebase-config.js
git commit -m "chore: Firebase 설정 추가"
git push
```

1~2분 후 사이트에 접속하면 로그인 화면이 나타나고,
로그인하면 좌측 하단에 **🟢 실시간 공유 중** 이 표시됩니다.

---

## 동작 확인 방법

1. 브라우저 두 개(또는 PC와 휴대폰)로 같은 URL 접속 후 각각 로그인
2. 한쪽에서 근태를 입력하거나 할 일을 추가
3. **다른 쪽 화면이 새로고침 없이 즉시 바뀌면** 정상입니다

---

## 무료 한도 (Spark 플랜)

| 항목 | 한도 | 파트 8명 기준 |
|---|---|---|
| 동시 접속 | 100명 | 충분 (8명) |
| 저장 용량 | 1 GB | 충분 (연간 수 MB 수준) |
| 월 다운로드 | 10 GB | 충분 |
| 비용 | 무료 (카드 등록 불필요) | — |

한도를 넘으면 자동 과금되지 않고 기능이 일시 중단됩니다.
즉 **의도치 않은 요금이 발생하지 않습니다.**

---

## 알아두실 점

- `apiKey`는 공개되어도 되는 값입니다. Firebase는 **보안 규칙**으로 접근을 통제합니다.
  다만 5번 규칙을 반드시 적용해야 합니다.
- 저장소가 public이므로 `firebase-config.js`도 공개됩니다. 로그인 비밀번호는
  코드에 넣지 말고 파트원에게 별도로 전달하세요.
- 사내 정책상 외부 클라우드 사용이 제한되는 경우, 파트장/보안 담당자 확인 후 진행하세요.
  대안으로 SharePoint 리스트 연동이 가능합니다 (`src/webparts/teamSchedule/services/SharePointService.ts` 참고).

---

## 문제 해결

| 증상 | 원인 / 해결 |
|---|---|
| 🔴 연결 오류 | 보안 규칙 미적용 또는 로그인 안 됨. 5번 규칙 확인 |
| 로그인 실패 `auth/invalid-credential` | 이메일/비밀번호 오타, 또는 4번에서 사용자 미생성 |
| ⚪ 오프라인 모드 그대로 | `firebase-config.js`의 `databaseURL`, `apiKey`가 비어 있음 |
| 다른 사람 변경이 안 보임 | `TEAM_ID`가 서로 다른지 확인 |
