# Firebase 연결 가이드 (파트원 실시간 공유)

이 문서대로 설정하면 **링크 하나만 공유하면 로그인 없이 바로 쓰고, 서로의 입력이 실시간 반영**됩니다.
설정 전에는 오프라인 모드(브라우저별 개별 저장)로 동작합니다.

소요 시간: 약 10분. **신용카드 등록이 필요 없습니다.**

---

## 1. Firebase 프로젝트 만들기

1. https://console.firebase.google.com 접속 (Google 계정 로그인)
2. **프로젝트 추가** → 이름: `part-schedule` → 계속
3. Google 애널리틱스는 **사용 안함** 선택 → 프로젝트 만들기

## 2. Realtime Database 생성

1. 좌측 메뉴에서 **Realtime Database** 클릭
   - 메뉴 그룹 이름은 콘솔 버전에 따라 **Databases & Storage** 또는 **빌드(Build)** 로 표시됩니다
   - **Firestore가 아닙니다.** 반드시 *Realtime* Database 를 선택하세요
2. **데이터베이스 만들기** 클릭
3. 위치: **싱가포르 `asia-southeast1`** — 한국에서 가장 가깝습니다
   - 선택지는 미국(`us-central1`), 벨기에(`europe-west1`), 싱가포르(`asia-southeast1`) 3곳
   - ⚠️ 위치는 생성 후 변경할 수 없습니다
4. 보안 규칙: **잠금 모드로 시작(Start in locked mode)** → 사용 설정
   - 규칙은 5번에서 직접 넣습니다
5. 생성 후 화면 상단의 URL을 복사해 둡니다
   예: `https://part-schedule-1234-default-rtdb.asia-southeast1.firebasedatabase.app`

## 3. 웹 앱 등록 & 설정값 복사

1. 좌측 상단 **프로젝트 개요** 옆 ⚙️ → **프로젝트 설정**
2. 아래 **내 앱** 에서 **웹 아이콘 `</>`** 클릭
3. 앱 닉네임 `part-schedule-web` 입력 → **앱 등록**
   (Firebase 호스팅은 체크하지 않음 — GitHub Pages를 사용합니다)
4. 표시되는 `firebaseConfig` 값을 복사

## 4. 익명 로그인 사용 설정 (로그인 화면 없애기)

1. 좌측 메뉴 **Authentication** → **시작하기**
2. **로그인 방법(Sign-in method)** 탭 → 목록에서 **익명(Anonymous)** 클릭
3. **사용 설정** 토글을 켜고 저장

이게 전부입니다. 계정을 만들 필요도, 비밀번호를 공유할 필요도 없습니다.
접속하면 앱이 자동으로 인증하므로 **파트원은 로그인 화면을 보지 않습니다.**

> 반대로 아무나 못 들어오게 막고 싶다면 6번에서 `AUTH_MODE`를 `'login'`으로 바꾸고
> **이메일/비밀번호** 공급자를 켠 뒤 Users 탭에서 공유 계정 1개를 만드세요.
> 이 경우에도 한 번 로그인하면 브라우저에 유지되어 매번 입력하지는 않습니다.

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

익명 인증도 `auth != null` 을 만족하므로 이 규칙 그대로 동작합니다.
`".read": true` 처럼 완전히 열어두지 마세요 — 인증 절차 없이 데이터가 노출됩니다.

## 6. 설정값 입력

`docs/firebase-config.js` 를 열어 3번에서 복사한 값을 채웁니다.

```js
window.FIREBASE_CONFIG = {
  apiKey: 'AIzaSy...',
  authDomain: 'part-schedule-1234.firebaseapp.com',
  databaseURL: 'https://part-schedule-1234-default-rtdb.asia-southeast1.firebasedatabase.app',
  projectId: 'part-schedule-1234'
};

window.TEAM_ID = 'packaging-tech';
window.AUTH_MODE = 'anonymous';   // 로그인 화면 없음 (권장)
```

저장 후 커밋 & 푸시:

```bash
git add docs/firebase-config.js
git commit -m "chore: Firebase 설정 추가"
git push
```

1~2분 후 사이트에 접속하면 **로그인 없이 바로 열리고**,
좌측 하단에 **🟢 실시간 공유 중** 이 표시됩니다.

---

## 인증 방식 비교

| `AUTH_MODE` | 파트원 경험 | 보안 수준 | 추가 설정 |
|---|---|---|---|
| `'anonymous'` (권장) | 링크 클릭 → 바로 사용 | 인증 없는 직접 접근 차단 | 익명 공급자 켜기 |
| `'login'` | 최초 1회 로그인 (이후 유지) | 계정 없으면 접근 불가 | 이메일/비밀번호 + 계정 생성 |
| `'none'` | 바로 사용 | ❌ 규칙을 완전 공개해야 함 | 권장하지 않음 |

**익명 모드의 한계 (알고 쓰셔야 합니다)**
익명 인증은 "누구인지 확인"이 아니라 "인증 절차를 거쳤는지"만 봅니다.
저장소가 public이라 설정값이 공개되므로, 마음먹은 사람은 익명 인증을 거쳐 데이터에 접근할 수 있습니다.
URL과 설정을 알아야 하니 우연히 노출될 가능성은 낮지만, **완전한 접근 통제는 아닙니다.**

- 근태·업무 제목 수준의 내부 정보라면 실무상 충분합니다.
- 더 막아야 한다면 `'login'` 모드를 쓰세요.
- 도메인 단위로 더 조이려면 **App Check(reCAPTCHA)** 를 추가로 켤 수 있습니다.
  우리 사이트에서 온 요청만 허용하게 되지만 설정이 늘어납니다.

---

## 동작 확인 방법

1. 브라우저 두 개(또는 PC와 휴대폰)로 같은 URL 접속
2. 한쪽에서 근태를 입력하거나 할 일을 추가
3. **다른 쪽 화면이 새로고침 없이 즉시 바뀌면** 정상입니다

---

## 무료 한도 (Spark 플랜)

| 항목 | 한도 | 파트 8명 기준 |
|---|---|---|
| 동시 접속 | 100명 | 충분 (8명) |
| 저장 용량 | 1 GB | 충분 (연간 수 MB 수준) |
| 월 다운로드 | 10 GB | 충분 |
| 데이터베이스 개수 | 프로젝트당 1개 | 충분 (`TEAM_ID`로 파트 구분) |
| 비용 | 무료 (카드 등록 불필요) | — |

한도를 넘으면 자동 과금되지 않고 기능이 일시 중단됩니다.
즉 **의도치 않은 요금이 발생하지 않습니다.**

---

## 알아두실 점

- `apiKey`는 공개되어도 되는 값입니다. Firebase는 **보안 규칙**으로 접근을 통제합니다.
  다만 5번 규칙을 반드시 적용해야 합니다.
- 사내 정책상 외부 클라우드 사용이 제한되는 경우, 파트장/보안 담당자 확인 후 진행하세요.
  대안으로 SharePoint 리스트 연동이 가능합니다
  (`src/webparts/teamSchedule/services/SharePointService.ts` 참고).
- 실시간 공유 모드에서도 마지막 데이터가 브라우저에 캐시되어 네트워크가 끊겨도 화면은 유지됩니다.

---

## 문제 해결

| 증상 | 원인 / 해결 |
|---|---|
| 🔴 자동 인증 실패 안내 | 4번에서 **익명(Anonymous)** 공급자를 켜지 않음 |
| 🔴 연결 오류 | 5번 보안 규칙 미적용 |
| ⚪ 오프라인 모드 그대로 | `firebase-config.js`의 `databaseURL`, `apiKey`가 비어 있음 |
| 로그인 화면이 뜬다 | `AUTH_MODE`가 `'login'`으로 되어 있음 |
| 다른 사람 변경이 안 보임 | `TEAM_ID`가 서로 다른지 확인 |
