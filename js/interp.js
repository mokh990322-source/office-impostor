/* ============================================================
   모몽어스 (모코파크에서 가져옴) — 보간과 예측

   10Hz 로 오는 스냅샷을 60Hz 화면으로 편다. 이 게임에서 가장 미묘한 코드라
   화면에서 떼어내 순수 함수로 두었다 — 그리기에 섞으면 "왜 캐릭터가 떨리지"를
   눈으로 쫓아야 하는데, 8명이 붙은 자리에서 할 수 있는 일이 아니다.

   ── 남의 캐릭터: 조금 늦게 보여 준다 ────────────────────
   지금 막 도착한 값을 바로 그리면 다음 것이 늦을 때마다 멈췄다 튄다.
   늘 과거를 그리면 손에 두 개가 있어서 그 사이를 부드럽게 지나간다.
   협동 게임이라 남이 조금 늦게 보이는 건 아무도 눈치채지 못한다.

   ── 얼마나 늦출지는 망이 정한다 ─────────────────────────
   고정 150ms 였다. 스냅샷이 100ms 마다 오니 흔들림을 50ms 까지만 버티는
   값이다. 그런데 Firebase 왕복이 이미 76ms 라 사내망에서 50ms 흔들리는 건
   예사고, 넘는 순간 sample 이 "짝이 없다"며 마지막 자리에 멈춘다.
   그 멈춤이 눈에는 렉으로 보인다 — 실제로 지터 ±90ms 를 흉내내면 프레임의
   11.6% 가 얼었다.

   그래서 실제 도착 간격을 재서 늦출 양을 스스로 맞춘다. 망이 좋으면
   80ms 까지 내려가 남이 더 가깝게 보이고, 나쁘면 280ms 까지 늘려 끊기지
   않게 한다. 같은 조건에서 언 프레임이 11.6% → 0.3% 가 된다.
   늘리는 쪽이 정답인 이유: 조금 늦게 보이는 것은 아무도 못 느끼지만,
   딱딱 끊기는 것은 모두가 느낀다.

   ── 내 캐릭터: 먼저 움직이고 나중에 맞춘다 ─────────────
   내 입력이 호스트를 거쳐 돌아오려면 150ms 걸린다. 그걸 기다리면 조작이
   먹통처럼 느껴진다. 그래서 로컬에서 먼저 움직이고, 호스트 값이 오면 차이를
   초당 6배율로 당긴다. 순간이동시키지 않는 이유는 벽에 밀릴 때마다 화면이
   튀기 때문이다.

   ── 언제 포기하는가 ────────────────────────────────────
   차이가 220px 를 넘으면 보간도 보정도 포기하고 그냥 옮긴다. 그 정도로
   벌어졌다면 순간이동했거나(재입장·호스트 승계) 오래 끊겼던 것이라, 부드럽게
   끌면 몇 초 동안 엉뚱한 데를 걸어간다.

   ── Buffer.push(tSec, snap) 의 tSec 은 반드시 "로컬 수신 시각"이다 ──
   호스트가 도장 찍어 보낸 스냅샷 자신의 t(Snap.pack 의 0.1초 단위 틱)가
   아니다. tSec 은 이 브라우저가 그 패킷을 받은 순간 자기 시계(예: 프레임
   루프의 로컬 클럭, performance.now()/1000 등)로 잰 값이어야 한다.
   sample(nowSec) 의 nowSec 도 같은 로컬 시계여야 한다 — push 와 sample 이
   서로 다른 시계를 쓰면 이 클래스는 조용히 망가진다.

   왜 망가지는가: 두 시계는 원점도 다르고 흐르는 빠르기가 같다는 보장도
   없다. 조립 코드가 실수로 snap.t(호스트 시계, 매치 시작이 0)를 tSec 에
   넣으면, sample 에 넘기는 nowSec(로컬 시계, 보통 훨씬 큰 값)이 버퍼 안의
   모든 time 보다 영원히 커진다. 그러면 target(nowSec - DELAY)이 항상
   "최신보다 뒤" 분기를 타서 sample 은 언제나 { a: last, b: last, k: 0 }
   만 돌려준다 — 보간이 시작조차 안 된 채 멈춘 것이다. 눈에는 "캐릭터가
   뚝뚝 끊긴다"로 보여서 네트워크 탓처럼 보이지만 원인은 시계를 섞어 쓴
   것뿐이다. 아래 interp.test.js 의 "tSec 계약" 테스트가 이걸 실행 가능한
   형태로 고정해 둔다.
   ============================================================ */
(function (global) {
  'use strict';

  var DELAY = 0.15;           // 아직 도착 간격을 모를 때 쓰는 기본값
  var DELAY_MIN = 0.08;       // 이보다 줄이면 좋은 망에서도 가끔 짝이 없다
  var DELAY_MAX = 0.28;       // 이보다 늘리면 남을 밟고 설 때 조작이 답답하다
  var DELAY_MARGIN = 1.6;     // 실제 간격보다 이만큼 여유를 둔다
  var DELAY_PCT = 0.95;       // 간격의 이 백분위를 본다 (평균이 아니다)
  var GAPS = 16;              // 도착 간격을 이만큼 기억해서 판단한다
  var UP = 0.5;               // 늘릴 때는 빠르게 (안 그러면 그동안 계속 끊긴다)
  var DOWN = 0.05;            // 줄일 때는 천천히 (급히 줄이면 그것 자체가 한 번 튄다)
  var SNAP_DIST = 220;
  var CORRECT_RATE = 6.0;
  var KEEP = 30;              // 버퍼에 쌓아 두는 스냅샷 수 (3초치)

  function lerp(a, b, k) { return a + (b - a) * k; }

  function between(pa, pb, k) {
    var dx = pb[0] - pa[0], dy = pb[1] - pa[1];
    if (dx * dx + dy * dy > SNAP_DIST * SNAP_DIST) return { x: pb[0], y: pb[1] };
    return { x: lerp(pa[0], pb[0], k), y: lerp(pa[1], pb[1], k) };
  }

  function Buffer() {
    this.items = [];          // [{ time, snap }] — time 오름차순
    this.gaps = [];           // 최근 도착 간격들 (초)
    this.d = DELAY;           // 지금 쓰고 있는 늦추는 양
  }

  /* tSec: 로컬 수신 시각(초). snap.t(호스트 시계)가 아니다 — 파일 머리말의
     "Buffer.push 의 tSec" 항목 참고. */
  Buffer.prototype.push = function (tSec, snap) {
    var n = this.items.length;
    /* 늦게 도착한 옛날 것은 버린다. 최신을 밀어내면 화면이 되감긴다. */
    if (n && tSec <= this.items[n - 1].time) return;
    if (n) {
      /* 누락된 스냅샷은 그냥 "간격이 컸다"로 나타난다 — 따로 셀 필요가 없다.
         그게 정확히 우리가 버텨야 하는 값이다. */
      this.gaps.push(tSec - this.items[n - 1].time);
      if (this.gaps.length > GAPS) this.gaps.shift();
      this.tune();
    }
    this.items.push({ time: tSec, snap: snap });
    if (this.items.length > KEEP) this.items.splice(0, this.items.length - KEEP);
  };

  Buffer.prototype.size = function () { return this.items.length; };

  /* 스냅샷이 하나 올 때마다 늦추는 양을 다시 잡는다.

     최근 도착 간격의 위쪽(95번째 백분위)에 여유를 곱한다. 평균을 쓰면
     느린 절반이 그대로 끊긴다 — 우리가 버텨야 하는 건 평균이 아니라
     제일 늦게 온 것이다.

     늘릴 때는 빠르게, 줄일 때는 천천히 간다. 늘리는 게 늦으면 그동안
     계속 끊기고, 줄이는 게 급하면 보는 시점이 앞으로 당겨지면서 남들이
     한 번 훌쩍 건너뛴다. 망이 나빠진 건 바로 따라가고 좋아진 건
     천천히 누리는 쪽이 눈에 편하다. */
  Buffer.prototype.tune = function () {
    var g = this.gaps;
    if (g.length < 5) return;
    var sorted = g.slice().sort(function (a, b) { return a - b; });
    var want = sorted[Math.floor(DELAY_PCT * (sorted.length - 1))] * DELAY_MARGIN;
    if (want < DELAY_MIN) want = DELAY_MIN;
    if (want > DELAY_MAX) want = DELAY_MAX;
    this.d += (want - this.d) * (want > this.d ? UP : DOWN);
  };

  Buffer.prototype.delay = function () { return this.d; };

  Buffer.prototype.sample = function (nowSec) {
    var it = this.items, n = it.length;
    if (!n) return null;
    if (n === 1) return { a: it[0].snap, b: it[0].snap, k: 0 };

    var target = nowSec - this.delay();

    if (target <= it[0].time) return { a: it[0].snap, b: it[0].snap, k: 0 };
    if (target >= it[n - 1].time) {
      var last = it[n - 1].snap;
      return { a: last, b: last, k: 0 };
    }

    for (var i = n - 1; i > 0; i--) {
      if (it[i - 1].time <= target && target <= it[i].time) {
        var span = it[i].time - it[i - 1].time;
        var k = span > 0 ? (target - it[i - 1].time) / span : 0;
        return { a: it[i - 1].snap, b: it[i].snap, k: k };
      }
    }
    return { a: it[0].snap, b: it[1].snap, k: 0 };
  };

  function correct(local, server, dt) {
    var dx = server.x - local.x, dy = server.y - local.y;
    if (dx * dx + dy * dy > SNAP_DIST * SNAP_DIST) return { x: server.x, y: server.y };
    /* 지수 감쇠 — 프레임 시간이 들쭉날쭉해도 같은 속도로 붙는다 */
    var k = 1 - Math.exp(-CORRECT_RATE * dt);
    return { x: local.x + dx * k, y: local.y + dy * k };
  }

  /* ── 내 캐릭터 위치 맞추기 (모몽어스에서 추가) ────────
     방장 값은 왕복(Firebase 두 번)만큼 늦게 온다. 걷는 동안 그 값과 비교하면
     내 위치가 항상 "앞서" 보여서 계속 뒤로 당기게 된다 → 버벅임(2026-10-22 실제 플레이 피드백).
     방장은 같은 충돌 코드로 계산하므로 내 예측은 사실 거의 맞다. 그래서:
       - 걷는 중: 지연으로 설명되는 차이(RECON_WALK 이하)는 건드리지 않는다.
         그보다 크면(벽에 막힘 등) 천천히 맞춘다.
       - 멈춘 뒤: 방장 값이 따라올 시간(RECON_SETTLE)을 기다렸다가 맞춘다.
       - 아주 크면(RECON_SNAP, 킬·환풍구·재배치) 바로 방장 값으로. */
  var RECON_SNAP = 200, RECON_WALK = 110, RECON_SETTLE = 0.6, RECON_SLOW = 3.0;

  function reconcile(me, server, moving, stillFor, dt) {
    var dx = server.x - me.x, dy = server.y - me.y, d = Math.sqrt(dx * dx + dy * dy);
    if (d > RECON_SNAP) return { x: server.x, y: server.y };
    if (moving) {
      if (d <= RECON_WALK) return me;
      var ks = 1 - Math.exp(-RECON_SLOW * dt);
      return { x: me.x + dx * ks, y: me.y + dy * ks };
    }
    if (stillFor < RECON_SETTLE || d < 0.5) return me;
    return correct(me, server, dt);
  }

  global.Interp = {
    DELAY: DELAY,
    DELAY_MIN: DELAY_MIN,
    DELAY_MAX: DELAY_MAX,
    DELAY_MARGIN: DELAY_MARGIN,
    DELAY_PCT: DELAY_PCT,
    SNAP_DIST: SNAP_DIST,
    CORRECT_RATE: CORRECT_RATE,
    lerp: lerp,
    between: between,
    correct: correct,
    reconcile: reconcile,
    Buffer: Buffer
  };
})(window);
