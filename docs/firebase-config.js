/**
 * ============================================================
 *  Firebase 연결 설정
 * ============================================================
 *  값이 비어 있으면 → 오프라인 모드(브라우저 localStorage)로 동작합니다.
 *  값을 채우면      → 파트원 전체가 실시간으로 공유합니다.
 *
 *  ※ SDK는 index.html에서 <script> 태그로 이미 불러옵니다.
 *    npm install 이나 import 코드는 추가할 필요가 없습니다.
 *
 *  설정 방법은 docs/SETUP-FIREBASE.md 문서를 참고하세요.
 * ============================================================
 */
window.FIREBASE_CONFIG = {
  apiKey: 'AIzaSyA3skAyqXHuChi6LON9-aYlAaDiu_ifCr4',
  authDomain: 'part-schedule.firebaseapp.com',
  databaseURL: 'https://part-schedule-default-rtdb.asia-southeast1.firebasedatabase.app',
  projectId: 'part-schedule',
  storageBucket: 'part-schedule.firebasestorage.app',
  messagingSenderId: '897125965086',
  appId: '1:897125965086:web:fd27b34963b21856c63d0f'
};

/** 파트 데이터가 저장될 경로 (여러 파트가 한 프로젝트를 쓸 때 구분) */
window.TEAM_ID = 'packaging-tech';

/**
 * 인증 방식
 *
 *  'anonymous' (권장) : 로그인 화면 없음. 접속하면 자동 인증되어 바로 사용.
 *                       보안 규칙은 "auth != null" 을 사용하세요.
 *                       → 링크만 공유하면 되므로 파트 공유에 가장 편합니다.
 *
 *  'login'            : 공유 계정(이메일/비밀번호)으로 로그인해야 사용.
 *                       한 번 로그인하면 브라우저에 유지되어 매번 입력하지 않습니다.
 *                       → 외부 노출을 더 막고 싶을 때 사용.
 *
 *  'none'             : 인증 없이 접근. 보안 규칙을 완전히 공개(true)해야 하므로
 *                       권장하지 않습니다.
 */
window.AUTH_MODE = 'anonymous';
