/**
 * ============================================================
 *  Firebase 연결 설정
 * ============================================================
 *  값이 비어 있으면 → 오프라인 모드(브라우저 localStorage)로 동작합니다.
 *  값을 채우면      → 파트원 전체가 실시간으로 공유합니다.
 *
 *  설정 방법은 docs/SETUP-FIREBASE.md 문서를 참고하세요.
 * ============================================================
 */
window.FIREBASE_CONFIG = {
  apiKey: '',
  authDomain: '',
  databaseURL: '',   // 예: https://part-schedule-xxxx-default-rtdb.firebaseio.com
  projectId: ''
};

/** 파트 데이터가 저장될 경로 (여러 파트가 한 프로젝트를 쓸 때 구분) */
window.TEAM_ID = 'packaging-tech';

/**
 * 로그인 요구 여부.
 * true  : 공유 계정으로 로그인해야 데이터 접근 (권장)
 * false : URL을 아는 사람은 누구나 읽기/쓰기 가능 (보안 규칙도 공개여야 함)
 */
window.REQUIRE_LOGIN = true;
