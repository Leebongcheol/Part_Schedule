/**
 * 실제 firebase-config.js 값으로 클라우드 모드가 활성화되는지 확인
 * (실제 서버에 접속하지 않고, 가짜 SDK로 초기화 경로만 검증)
 */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const { createFakeServer, makeFirebase, getPath } = require('./test-fake-firebase');

const html = fs.readFileSync(path.join('docs', 'index.html'), 'utf8');
const appJs = fs.readFileSync(path.join('docs', 'app.js'), 'utf8');
const dsJs = fs.readFileSync(path.join('docs', 'datastore.js'), 'utf8');
const cfgJs = fs.readFileSync(path.join('docs', 'firebase-config.js'), 'utf8');

let pass = 0, fail = 0;
const check = (n, c, e) => {
  if (c) { console.log('  PASS  ' + n); pass++; }
  else { console.log('  FAIL  ' + n + (e ? ' -> ' + e : '')); fail++; }
};
const tick = (ms = 15) => new Promise(r => setTimeout(r, ms));

(async () => {
  console.log('\n=== 실제 설정값 검증 ===');

  const dom = new JSDOM(html, { runScripts: 'outside-only', url: 'https://example.com' });
  const w = dom.window;
  const store = {};
  Object.defineProperty(w, 'localStorage', {
    value: {
      getItem: k => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: k => { delete store[k]; }, clear: () => {}
    }, configurable: true
  });
  w.alert = () => {}; w.confirm = () => true; w.print = () => {};
  if (!w.Element.prototype.matches) {
    w.Element.prototype.matches = function (s) {
      const a = (this.ownerDocument || w.document).querySelectorAll(s);
      for (let i = 0; i < a.length; i++) if (a[i] === this) return true;
      return false;
    };
  }
  if (!w.Element.prototype.closest) {
    w.Element.prototype.closest = function (s) {
      let e = this;
      while (e && e.nodeType === 1) { if (e.matches(s)) return e; e = e.parentElement; }
      return null;
    };
  }

  const server = createFakeServer();
  w.firebase = makeFirebase(server, { enforceAuth: true });

  // 실제 설정 파일을 그대로 평가
  w.eval(cfgJs);

  check('설정 파일이 FIREBASE_CONFIG를 정의', !!w.FIREBASE_CONFIG);
  check('apiKey 채워짐', !!w.FIREBASE_CONFIG.apiKey && w.FIREBASE_CONFIG.apiKey.startsWith('AIza'),
    w.FIREBASE_CONFIG.apiKey);
  check('databaseURL 채워짐', /^https:\/\/.+firebasedatabase\.app$/.test(w.FIREBASE_CONFIG.databaseURL) ||
    /^https:\/\/.+firebaseio\.com$/.test(w.FIREBASE_CONFIG.databaseURL), w.FIREBASE_CONFIG.databaseURL);
  check('리전이 URL에 반영(asia-southeast1)',
    w.FIREBASE_CONFIG.databaseURL.includes('asia-southeast1'), w.FIREBASE_CONFIG.databaseURL);
  check('projectId 채워짐', w.FIREBASE_CONFIG.projectId === 'part-schedule', w.FIREBASE_CONFIG.projectId);
  check('authDomain 채워짐', !!w.FIREBASE_CONFIG.authDomain, w.FIREBASE_CONFIG.authDomain);
  check('AUTH_MODE = anonymous', w.AUTH_MODE === 'anonymous', w.AUTH_MODE);
  check('TEAM_ID 설정됨', w.TEAM_ID === 'packaging-tech', w.TEAM_ID);

  w.eval(dsJs);
  w.eval(appJs);
  check('DataStore가 클라우드 설정으로 인식', w.DataStore.hasCloudConfig() === true);

  w.document.dispatchEvent(new w.Event('DOMContentLoaded', { bubbles: true }));
  await tick(25);

  const D = w.document;
  check('클라우드 모드로 전환', w.DataStore.mode === 'cloud', w.DataStore.mode);
  check('로그인 화면 안 뜸(익명 모드)', D.getElementById('modal-login').hidden === true);
  check('오프라인 배너 숨김', D.getElementById('offline-banner').hidden === true);
  check('상태 = online', w.DataStore.status === 'online', w.DataStore.status);
  check('상태 표시 = 실시간 공유 중',
    D.getElementById('conn-status').textContent.includes('실시간'),
    D.getElementById('conn-status').textContent);
  check('데이터 경로가 teams/packaging-tech',
    getPath(server.data, 'teams/packaging-tech/members') !== null,
    JSON.stringify(Object.keys(server.data)));
  check('기본 팀원 시드 완료',
    Object.keys(getPath(server.data, 'teams/packaging-tech/members') || {}).length === 6);
  check('화면 렌더 정상', D.querySelectorAll('#sch-body tr').length === 6);

  console.log('\n' + '='.repeat(46));
  console.log(fail === 0 ? `설정 검증 통과 ✅ (${pass}개)` : `${fail}개 실패 ❌`);
  console.log('='.repeat(46));
  process.exit(fail === 0 ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
