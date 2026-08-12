/**
 * 테스트용 가짜 Firebase (compat SDK의 사용 부분만 구현)
 * 하나의 "서버" 객체를 여러 클라이언트가 공유하여 실시간 전파를 검증한다.
 */
function createFakeServer() {
  return { data: {}, listeners: [], connected: true, writeLog: [] };
}

function getPath(obj, path) {
  const parts = path.split('/').filter(Boolean);
  let cur = obj;
  for (const p of parts) {
    if (cur == null || typeof cur !== 'object') return null;
    cur = cur[p];
  }
  return cur === undefined ? null : cur;
}
function setPath(obj, path, val) {
  const parts = path.split('/').filter(Boolean);
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (typeof cur[parts[i]] !== 'object' || cur[parts[i]] === null) cur[parts[i]] = {};
    cur = cur[parts[i]];
  }
  if (val === null) delete cur[parts[parts.length - 1]];
  else cur[parts[parts.length - 1]] = JSON.parse(JSON.stringify(val));
}

/** server 를 공유하는 firebase 객체 생성 (클라이언트 1개 분) */
function makeFirebase(server, opts) {
  opts = opts || {};
  const authUsers = opts.users || { 'team@part.local': 'pw1234' };
  let currentUser = opts.startSignedIn ? { uid: 'u1', email: 'team@part.local' } : null;
  const authCbs = [];

  function notify(changedPath) {
    server.listeners.forEach(l => {
      // 변경 경로가 리스너 경로와 같거나 그 하위면 통지
      if (changedPath === l.path || changedPath.startsWith(l.path + '/') || l.path.startsWith(changedPath + '/')) {
        l.cb({ val: () => getPath(server.data, l.path) });
      }
    });
  }

  function ref(path) {
    path = String(path || '').replace(/^\/+|\/+$/g, '');
    return {
      path,
      child(sub) { return ref(path + '/' + sub); },
      on(evt, cb, errCb) {
        if (path === '.info/connected') {
          const l = { path, cb: () => cb({ val: () => server.connected }) };
          server.listeners.push(l);
          cb({ val: () => server.connected });
          return cb;
        }
        if (!currentUser && opts.enforceAuth) {
          if (errCb) errCb(new Error('permission_denied'));
          return cb;
        }
        const l = { path, cb };
        server.listeners.push(l);
        cb({ val: () => getPath(server.data, path) });   // 초기값 즉시 전달
        return cb;
      },
      off() { server.listeners = server.listeners.filter(l => l.path !== path); },
      set(val) {
        if (!currentUser && opts.enforceAuth) return Promise.reject(new Error('permission_denied'));
        server.writeLog.push({ op: 'set', path });
        setPath(server.data, path, val);
        notify(path);
        return Promise.resolve();
      },
      remove() {
        if (!currentUser && opts.enforceAuth) return Promise.reject(new Error('permission_denied'));
        server.writeLog.push({ op: 'remove', path });
        setPath(server.data, path, null);
        notify(path);
        return Promise.resolve();
      },
      update(updates) {
        if (!currentUser && opts.enforceAuth) return Promise.reject(new Error('permission_denied'));
        Object.keys(updates).forEach(p => {
          server.writeLog.push({ op: 'update', path: p });
          setPath(server.data, p, updates[p]);
        });
        Object.keys(updates).forEach(p => notify(p));
        return Promise.resolve();
      }
    };
  }

  const fb = {
    apps: [],
    initializeApp() { fb.apps.push({}); return {}; },
    database() { return { ref }; },
    auth() {
      return {
        onAuthStateChanged(cb) { authCbs.push(cb); cb(currentUser); return () => {}; },
        signInWithEmailAndPassword(em, pw) {
          if (authUsers[em] && authUsers[em] === pw) {
            currentUser = { uid: 'u1', email: em };
            authCbs.forEach(c => c(currentUser));
            return Promise.resolve({ user: currentUser });
          }
          const e = new Error('invalid'); e.code = 'auth/invalid-credential';
          return Promise.reject(e);
        },
        signOut() {
          currentUser = null;
          authCbs.forEach(c => c(null));
          return Promise.resolve();
        }
      };
    },
    _disconnect() { server.connected = false; notify('.info/connected'); },
    _reconnect() { server.connected = true; notify('.info/connected'); }
  };
  return fb;
}

module.exports = { createFakeServer, makeFirebase, getPath };
