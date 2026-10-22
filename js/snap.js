/* ============================================================
   사무실 임포스터 — 방송용 상태 꾸러미

   방장이 10Hz 로 crew/<코드>/st 에 올린다. 모두가 읽을 수 있는 곳이라
   비밀이 새면 안 된다: 역할, 임무 목록, 킬쿨은 판이 끝나기 전엔 안 싣는다.
   (킬쿨을 실으면 쿨이 도는 사람 = 임포스터라고 광고하는 꼴이다.)

   모코파크와 같은 이유로 항상 전체를 보낸다. 한 번 놓쳐도 다음 것이 고친다.
   키를 한 글자로 줄이고 좌표를 정수로 반올림한다.

   감수하는 것: 위치는 전부 실린다. 개발자 도구로 어둠 속 위치와
   환풍구 안 여부를 볼 수 있다. 사내 게임이라 허용한다(설계서 "비밀 지키기").
   ============================================================ */
(function (global) {
  'use strict';

  var R = global.Rules;

  function left(until, now) { return Math.max(0, Math.ceil(until - now)); }

  function pack(s) {
    var o = { t: Math.round(s.t * 10), ph: s.phase, p: {}, b: [], tp: 0, bc: left(s.btnCdUntil, s.t) };
    s.order.forEach(function (pid) {
      var p = s.players[pid];
      if (p.left) return;
      o.p[pid] = [Math.round(p.x), Math.round(p.y), p.alive ? 1 : 0, p.vent ? 1 : 0, p.btnLeft];
    });
    s.bodies.forEach(function (b) { o.b.push([b.pid, Math.round(b.x), Math.round(b.y)]); });
    var pr = R.progress(s);
    o.tp = pr.total ? Math.round(pr.done / pr.total * 1000) : 0;
    if (s.sab) {
      o.sb = { k: s.sab.kind };
      if (s.sab.kind === 'reactor') {
        o.sb.r = left(s.sab.until, s.t);
        o.sb.h = [s.sab.held.p1 ? 1 : 0, s.sab.held.p2 ? 1 : 0];
      }
    }
    if (s.meeting) {
      var m = s.meeting;
      o.m = { by: m.by, bd: m.body || '', s: m.stage, r: left(m.until, s.t), v: Object.keys(m.votes) };
      if (m.stage === 'reveal') {
        o.m.vt = m.votes; o.m.e = m.ejected || ''; o.m.ei = m.ejectedImp ? 1 : 0; o.m.il = m.impsLeft;
      }
    }
    if (s.winner) {
      o.w = { s: s.winner, y: s.why, imps: s.order.filter(function (pid) { return s.players[pid].role === 'imp'; }) };
    }
    return o;
  }

  global.Snap = { pack: pack };
})(window);
