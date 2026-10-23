/* ============================================================
   사무실 임포스터 — 역할 뽑기와 봉투

   누가 임포스터인지는 방장 브라우저만 안다. 각 사람에게는 그 사람만
   열 수 있는 봉투로 보낸다.

   ── 봉투 만드는 법 ─────────────────────────────────────
   입장할 때 각자 ECDH 키 쌍을 만들고 공개키만 who/<pid>/pub 에 올린다.
   방장은 (방장 비밀키 × 그 사람 공개키)로, 그 사람은 (자기 비밀키 × 방장
   공개키)로 같은 AES 키를 얻는다. 두 사람 말고는 이 키를 만들 수 없다.
   그래서 sec/<pid> 를 누가 개발자 도구로 읽어도 남의 역할은 못 연다.

   방장 자신은 모든 역할을 안다. 서버 없이 하는 게임이라 피할 수 없다.
   ============================================================ */
(function (global) {
  'use strict';

  function rnd(rand) {
    var r = (rand || Math.random)();
    return r >= 1 ? 0.999999 : (r < 0 ? 0 : r);
  }
  function shuffle(a, rand) {
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(rnd(rand) * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function impLimit(n) { return n >= 7 ? 2 : 1; }

  /* 혼자 편인 펠리컨: 6명 이상이면 1명 */
  function pelLimit(n) { return n >= 6 ? 1 : 0; }

  function pick(pids, n, rand, pel) {
    var out = {}, a = shuffle(pids.slice(), rand);
    pids.forEach(function (p) { out[p] = 'crew'; });
    for (var i = 0; i < n && i < a.length; i++) out[a[i]] = 'imp';
    for (var j = 0; j < (pel || 0) && n + j < a.length; j++) out[a[n + j]] = 'pel';
    return out;
  }

  function pickTasks(ids, n, rand) {
    return shuffle(ids.slice(), rand).slice(0, Math.min(n, ids.length));
  }

  /* ── 암호 ─────────────────────────────────────────────── */

  function cryptoObj() {
    if (global.crypto && global.crypto.subtle) return global.crypto;
    return (typeof crypto !== 'undefined') ? crypto : null;
  }
  function sub() { return cryptoObj().subtle; }

  function b64(buf) {
    var u = new Uint8Array(buf), s = '';
    for (var i = 0; i < u.length; i++) s += String.fromCharCode(u[i]);
    return btoa(s);
  }
  function unb64(s) {
    var bin = atob(s), u = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    return u;
  }

  var CURVE = { name: 'ECDH', namedCurve: 'P-256' };

  function makeKeys() {
    return sub().generateKey(CURVE, true, ['deriveKey']).then(function (kp) {
      return sub().exportKey('raw', kp.publicKey).then(function (raw) {
        return { priv: kp.privateKey, pub: b64(raw) };
      });
    });
  }

  function shared(priv, pubB64) {
    return sub().importKey('raw', unb64(pubB64), CURVE, false, []).then(function (pub) {
      return sub().deriveKey({ name: 'ECDH', public: pub }, priv,
        { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
    });
  }

  function seal(myPriv, theirPub, obj) {
    var iv = cryptoObj().getRandomValues(new Uint8Array(12));
    var data = new TextEncoder().encode(JSON.stringify(obj));
    return shared(myPriv, theirPub).then(function (k) {
      return sub().encrypt({ name: 'AES-GCM', iv: iv }, k, data);
    }).then(function (ct) { return { iv: b64(iv), ct: b64(ct) }; });
  }

  function open(myPriv, theirPub, sealed) {
    if (!sealed || typeof sealed.iv !== 'string' || typeof sealed.ct !== 'string') return Promise.resolve(null);
    return Promise.resolve().then(function () {
      return shared(myPriv, theirPub);
    }).then(function (k) {
      return sub().decrypt({ name: 'AES-GCM', iv: unb64(sealed.iv) }, k, unb64(sealed.ct));
    }).then(function (pt) {
      return JSON.parse(new TextDecoder().decode(pt));
    }).catch(function () { return null; });
  }

  global.Roles = {
    impLimit: impLimit, pelLimit: pelLimit, pick: pick, pickTasks: pickTasks,
    makeKeys: makeKeys, seal: seal, open: open
  };
})(window);
