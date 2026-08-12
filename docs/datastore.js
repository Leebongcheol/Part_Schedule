/**
 * DataStore - 저장 계층 추상화
 *
 *  local  : localStorage (오프라인, 개인 브라우저)
 *  cloud  : Firebase Realtime Database (파트 전체 실시간 공유)
 *
 * 레코드 단위로 읽고 쓰기 때문에 여러 명이 동시에 수정해도
 * 서로의 변경을 덮어쓰지 않습니다. (같은 레코드를 동시에 고칠 때만 나중 값이 남음)
 */
(function (global) {
  'use strict';

  const COLLECTIONS = ['members', 'schedules', 'todos', 'notices'];
  const LS_KEY = {
    members: 'ps2_members',
    schedules: 'ps2_sch',
    todos: 'ps2_todos',
    notices: 'ps2_notices'
  };

  const DataStore = {
    mode: 'local',          // 'local' | 'cloud'
    status: 'offline',      // 'offline' | 'connecting' | 'online' | 'auth-required' | 'error'
    statusMessage: '',
    user: null,
    data: { members: [], schedules: [], todos: [], notices: [] },

    onChange: null,   // 데이터 변경 시 호출
    onStatus: null,   // 연결 상태 변경 시 호출
    onReady: null,    // 데이터가 처음 준비된 시점 1회 호출 (시드 등에 사용)

    _ref: {},
    _db: null,
    _readyFired: false,
    _seen: null,
    _anonTried: false,

    // ---------- 공통 ----------
    _emit() { if (typeof this.onChange === 'function') this.onChange(); },
    _setStatus(s, msg) {
      this.status = s;
      this.statusMessage = msg || '';
      if (typeof this.onStatus === 'function') this.onStatus(s, this.statusMessage);
    },
    _fireReady() {
      if (this._readyFired) return;
      this._readyFired = true;
      if (typeof this.onReady === 'function') this.onReady();
    },

    isCloud() { return this.mode === 'cloud'; },

    /** 설정이 유효한지 (databaseURL 이 채워졌는지) */
    hasCloudConfig() {
      const c = global.FIREBASE_CONFIG;
      return !!(c && c.databaseURL && c.apiKey && String(c.databaseURL).trim() !== '');
    },

    // ---------- 초기화 ----------
    init() {
      if (this.hasCloudConfig() && typeof global.firebase !== 'undefined') {
        try { return this._initCloud(); }
        catch (e) {
          console.warn('[DataStore] 클라우드 초기화 실패, 오프라인으로 전환:', e);
          return this._initLocal('클라우드 연결 실패 - 오프라인 모드');
        }
      }
      const why = this.hasCloudConfig()
        ? 'Firebase SDK 로드 실패 - 오프라인 모드'
        : '';
      return this._initLocal(why);
    },

    _initLocal(msg) {
      this.mode = 'local';
      this.loadLocal();
      this._setStatus('offline', msg || '');
      this._emit();
      this._fireReady();
      return Promise.resolve('local');
    },

    // ---------- localStorage ----------
    loadLocal() {
      COLLECTIONS.forEach(c => {
        try {
          const raw = global.localStorage.getItem(LS_KEY[c]);
          this.data[c] = raw ? JSON.parse(raw) : [];
        } catch (e) { this.data[c] = []; }
      });
    },

    saveLocal(col) {
      const list = col ? [col] : COLLECTIONS;
      list.forEach(c => {
        try { global.localStorage.setItem(LS_KEY[c], JSON.stringify(this.data[c])); }
        catch (e) { /* 용량 초과 등 */ }
      });
    },

    // ---------- Firebase ----------
    _initCloud() {
      const cfg = global.FIREBASE_CONFIG;
      this.mode = 'cloud';
      this._setStatus('connecting', '연결 중...');

      if (!global.firebase.apps || !global.firebase.apps.length) {
        global.firebase.initializeApp(cfg);
      }
      this._db = global.firebase.database();

      // 오프라인 캐시(있으면) - 네트워크 끊겨도 마지막 값 표시
      this.loadLocal();
      this._emit();

      const mode = this.authMode();
      if (mode === 'none') { this._attach(); return Promise.resolve('cloud'); }

      return new Promise(resolve => {
        global.firebase.auth().onAuthStateChanged(u => {
          this.user = u;
          if (u) { this._attach(); resolve('cloud'); return; }

          if (mode === 'anonymous') {
            // 로그인 화면 없이 자동 인증
            if (this._anonTried) {
              this._setStatus('error', '자동 인증 실패 - Authentication에서 익명 로그인을 사용 설정하세요');
              resolve('error');
              return;
            }
            this._anonTried = true;
            this._setStatus('connecting', '자동 인증 중...');
            global.firebase.auth().signInAnonymously().catch(e => {
              const code = (e && e.code) || (e && e.message) || '';
              console.warn('[DataStore] 익명 로그인 실패:', code);
              this._setStatus('error',
                '자동 인증 실패(' + code + ') - Authentication에서 익명 로그인을 사용 설정하세요');
              resolve('error');
            });
            return;
          }

          // mode === 'login'
          this._detach();
          this._setStatus('auth-required', '로그인이 필요합니다');
          resolve('auth-required');
        });
      });
    },

    /** 인증 방식 결정 (구버전 REQUIRE_LOGIN 설정도 계속 지원) */
    authMode() {
      if (global.AUTH_MODE) return global.AUTH_MODE;
      if (global.REQUIRE_LOGIN === false) return 'none';
      return 'login';
    },

    signIn(email, password) {
      if (!this.isCloud() || typeof global.firebase === 'undefined') {
        return Promise.reject(new Error('클라우드 모드가 아닙니다'));
      }
      return global.firebase.auth().signInWithEmailAndPassword(email, password);
    },

    signOut() {
      if (this.isCloud() && typeof global.firebase !== 'undefined') {
        return global.firebase.auth().signOut();
      }
      return Promise.resolve();
    },

    _basePath() { return 'teams/' + (global.TEAM_ID || 'default'); },

    _attach() {
      this._detach();
      const base = this._basePath();
      this._seen = {};

      // 연결 상태 표시
      const connRef = this._db.ref('.info/connected');
      connRef.on('value', snap => {
        this._setStatus(snap.val() ? 'online' : 'connecting',
          snap.val() ? '실시간 연결됨' : '재연결 중...');
      });
      this._ref['.info/connected'] = connRef;

      COLLECTIONS.forEach(c => {
        const r = this._db.ref(base + '/' + c);
        r.on('value', snap => {
          const val = snap.val() || {};
          // 객체(키=id) -> 배열
          this.data[c] = Object.keys(val).map(k => {
            const rec = val[k] || {};
            if (!rec.id) rec.id = k;
            return rec;
          });
          this.saveLocal(c);      // 오프라인 대비 캐시
          this._emit();

          // 모든 컬렉션의 첫 스냅샷을 받은 뒤에 ready
          if (this._seen && !this._seen[c]) {
            this._seen[c] = true;
            if (COLLECTIONS.every(x => this._seen[x])) this._fireReady();
          }
        }, err => {
          console.warn('[DataStore] 읽기 실패:', c, err && err.message);
          this._setStatus('error', '권한 또는 네트워크 오류');
        });
        this._ref[c] = r;
      });
    },

    _detach() {
      Object.keys(this._ref).forEach(k => {
        try { this._ref[k].off(); } catch (e) { /* noop */ }
      });
      this._ref = {};
    },

    // ---------- 쓰기 (레코드 단위) ----------
    put(col, rec) {
      if (!rec || !rec.id) return Promise.resolve();
      const arr = this.data[col];
      const i = arr.findIndex(x => x.id === rec.id);
      if (i >= 0) arr[i] = rec; else arr.push(rec);

      if (this.isCloud() && this._db && this.status !== 'auth-required') {
        return this._db.ref(this._basePath() + '/' + col + '/' + rec.id)
          .set(rec).catch(e => { console.warn('[DataStore] 쓰기 실패:', e); });
      }
      this.saveLocal(col);
      this._emit();
      return Promise.resolve();
    },

    remove(col, id) {
      this.data[col] = this.data[col].filter(x => x.id !== id);

      if (this.isCloud() && this._db && this.status !== 'auth-required') {
        return this._db.ref(this._basePath() + '/' + col + '/' + id)
          .remove().catch(e => { console.warn('[DataStore] 삭제 실패:', e); });
      }
      this.saveLocal(col);
      this._emit();
      return Promise.resolve();
    },

    /** 여러 레코드 한꺼번에 삭제 (팀원 삭제 시 관련 일정/할일 정리) */
    removeWhere(col, predicate) {
      const doomed = this.data[col].filter(predicate);
      return Promise.all(doomed.map(r => this.remove(col, r.id)));
    },

    /** 백업 복원 - 전체 교체 */
    replaceAll(payload) {
      COLLECTIONS.forEach(c => {
        if (Array.isArray(payload[c])) this.data[c] = payload[c];
      });
      if (this.isCloud() && this._db && this.status !== 'auth-required') {
        const upd = {};
        const base = this._basePath();
        COLLECTIONS.forEach(c => {
          const obj = {};
          this.data[c].forEach(r => { if (r && r.id) obj[r.id] = r; });
          upd[base + '/' + c] = obj;
        });
        return this._db.ref().update(upd)
          .catch(e => { console.warn('[DataStore] 복원 실패:', e); });
      }
      this.saveLocal();
      this._emit();
      return Promise.resolve();
    },

    /** 초기 시드 데이터 주입 (비어 있을 때만) */
    seedIfEmpty(col, records) {
      if (this.data[col].length > 0) return Promise.resolve(false);
      return Promise.all(records.map(r => this.put(col, r))).then(() => true);
    }
  };

  global.DataStore = DataStore;
})(typeof window !== 'undefined' ? window : globalThis);
