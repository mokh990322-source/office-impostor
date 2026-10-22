/* ============================================================
   사무실 임포스터 — 로컬 접속판 (개발·시험용)

   주소에 ?local 이 붙으면 Firebase 대신 이걸 쓴다. 같은 브라우저의
   탭끼리 BroadcastChannel 로 주고받는다. Firebase 규칙을 콘솔에
   올리기 전에도 대기실·게임·회의를 끝까지 돌려 볼 수 있다.

   API 는 Net 과 똑같다(put/del/get/watch). 그래서 게임 코드는
   자기가 어느 쪽에 붙었는지 모른다.

   탭마다 DB 사본을 들고 있다. 공용 저장소(localStorage)에 통째로
   쓰면 두 탭이 동시에 쓸 때 한쪽이 지워진다. 그래서 쓰기만 방송하고
   각자 자기 사본에 적용한다. 새 탭은 hello 를 보내 사본을 받아 온다.

   Firebase 처럼 빈 객체는 남기지 않는다. 마지막 자식을 지우면 부모도
   사라진다. 게임 코드가 "칸이 없다"와 "빈 칸이다"를 따로 다루지 않게.
   ============================================================ */
(function (global) {
  'use strict';

  function segs(p) { return String(p || '').split('/').filter(function (s) { return s; }); }

  /* Firebase 는 빈 배열·빈 객체를 저장하지 않는다. 로컬도 똑같이 지워야 로컬 시험이
     온라인 버그를 잡는다(2026-10-22: 빈 투표 목록이 온라인에서만 사라져 회의 화면이 빈 칸). */
  function prune(v) {
    if (v === null || typeof v !== 'object') return v;
    if (Array.isArray(v)) {
      if (!v.length) return null;
      return v.map(function (x) { var c = prune(x); return c === undefined ? null : c; });
    }
    var out = {}, any = false;
    for (var k in v) {
      if (!Object.prototype.hasOwnProperty.call(v, k)) continue;
      var c = prune(v[k]);
      if (c === null || c === undefined) continue;
      out[k] = c; any = true;
    }
    return any ? out : null;
  }

  function make(name, BC) {
    var apply = global.Net.applyEvent;
    var db = null, watchers = [], ch = new BC(name);

    function sub(state, path) {
      var parts = segs(path), node = state;
      for (var i = 0; i < parts.length; i++) {
        if (node === null || typeof node !== 'object') return null;
        node = node[parts[i]];
        if (node === undefined) return null;
      }
      return node === undefined ? null : node;
    }

    function write(path, data) {
      db = prune(apply(db, 'put', '/' + segs(path).join('/'), data));
      var p = segs(path);
      watchers.forEach(function (w) {
        var base = segs(w.path);
        var n = Math.min(base.length, p.length);
        for (var i = 0; i < n; i++) if (base[i] !== p[i]) return;   // 서로 다른 가지
        w.state = sub(db, w.path);
        if (w.onData) w.onData(w.state);
      });
    }

    ch.onmessage = function (e) {
      var m = e.data;
      if (!m) return;
      if (m.type === 'w') write(m.path, m.data);
      else if (m.type === 'hello') { if (db !== null) ch.postMessage({ type: 'full', db: db }); }
      else if (m.type === 'full') {
        if (db === null && m.db) {
          db = m.db;
          watchers.forEach(function (w) { w.state = sub(db, w.path); if (w.onData) w.onData(w.state); });
        }
      }
    };
    ch.postMessage({ type: 'hello' });

    function put(path, value) {
      var v = value === undefined ? null : JSON.parse(JSON.stringify(value));
      write(path, v);
      ch.postMessage({ type: 'w', path: path, data: v });
      return Promise.resolve({ ok: true, status: 200 });
    }

    return {
      put: put,
      del: function (path) { return put(path, null); },
      get: function (path) { return Promise.resolve(sub(db, path)); },
      watch: function (path, onData) {
        var w = { path: path, onData: onData, state: sub(db, path) };
        watchers.push(w);
        setTimeout(function () { if (w.onData && watchers.indexOf(w) >= 0) w.onData(w.state); }, 0);
        return {
          close: function () { watchers = watchers.filter(function (x) { return x !== w; }); },
          state: function () { return w.state; }
        };
      },
      close: function () { try { ch.close(); } catch (e) {} }
    };
  }

  global.LocalNet = { make: make, prune: prune };

  var q = (global.location && global.location.search) || '';
  if (/[?&]local\b/.test(q) && global.Net && typeof global.BroadcastChannel === 'function') {
    var ln = make('office-impostor', global.BroadcastChannel);
    global.Net.put = ln.put; global.Net.del = ln.del; global.Net.get = ln.get; global.Net.watch = ln.watch;
    global.Net.isLocal = true;
  }
})(window);
