'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { load } = require('../testlib/load');

function I() { return load('interp').Interp; }

test('상수가 말이 되는 범위다', () => {
  const N = I();
  assert.ok(N.DELAY >= 0.1 && N.DELAY <= 0.3, '지연 버퍼는 스냅샷 간격(0.1초)보다 커야 한다');
  assert.ok(N.SNAP_DIST > 100, '너무 작으면 평범한 이동에도 순간이동한다');
  assert.ok(N.CORRECT_RATE > 0);
});

test('lerp 기본', () => {
  const N = I();
  assert.strictEqual(N.lerp(0, 10, 0), 0);
  assert.strictEqual(N.lerp(0, 10, 1), 10);
  assert.strictEqual(N.lerp(0, 10, 0.5), 5);
});

test('between 은 두 점 사이를 준다', () => {
  const N = I();
  /* 거리 156 — 순간이동 문턱(220)보다 한참 안쪽 */
  assert.deepStrictEqual(N.between([0, 0], [100, 120], 0.5), { x: 50, y: 60 });
  assert.deepStrictEqual(N.between([0, 0], [100, 120], 0), { x: 0, y: 0 });
  assert.deepStrictEqual(N.between([0, 0], [100, 120], 1), { x: 100, y: 120 });
});

test('순간이동 문턱이 정상 이동보다 한참 크다', () => {
  const N = I();
  /* 스냅샷 두 개 사이(0.1초)에 정상적으로 움직일 수 있는 최대 거리는
     Sim.SPEED(210) x 0.1 = 21px 다. 문턱이 그보다 훨씬 커야 평범한 달리기가
     순간이동으로 오인되지 않는다. */
  const perSnapshot = 210 * 0.1;
  assert.ok(N.SNAP_DIST > perSnapshot * 5,
    '문턱 ' + N.SNAP_DIST + ' 가 한 스냅샷 이동거리 ' + perSnapshot + ' 에 비해 너무 좁다');
});

test('between 은 너무 멀면 뒤쪽으로 튄다', () => {
  const N = I();
  const far = N.SNAP_DIST + 100;
  const out = N.between([0, 0], [far, 0], 0.5);
  assert.strictEqual(out.x, far, '멀면 끌지 말고 바로 옮겨야 한다');
});

test('버퍼는 스냅샷이 하나뿐이면 그것만 준다', () => {
  const N = I();
  const b = new N.Buffer();
  b.push(1.0, { t: 10, p: { a: [0, 0, 0, -1] } });
  const s = b.sample(1.0);
  assert.ok(s, '하나라도 있으면 뭔가 줘야 한다');
  assert.strictEqual(s.a, s.b, '앞뒤가 같아야 한다');
  assert.strictEqual(s.k, 0);
});

test('버퍼는 아무것도 없으면 null', () => {
  const N = I();
  assert.strictEqual(new N.Buffer().sample(1.0), null);
});

test('버퍼는 지연만큼 과거를 보여 준다', () => {
  const N = I();
  const b = new N.Buffer();
  b.push(1.0, { t: 10 });
  b.push(1.1, { t: 11 });
  b.push(1.2, { t: 12 });
  /* 지금이 1.2 라면 (1.2 - DELAY) 시점을 본다 */
  const s = b.sample(1.2);
  const target = 1.2 - N.DELAY;
  assert.ok(s.a.t <= 11, '과거 스냅샷을 골라야 한다: ' + s.a.t + ' (목표시각 ' + target + ')');
});

test('버퍼는 두 스냅샷 사이 비율을 준다', () => {
  const N = I();
  const b = new N.Buffer();
  const d = N.DELAY;
  b.push(1.0, { t: 10 });
  b.push(1.2, { t: 12 });
  const s = b.sample(1.1 + d);          // 목표시각 1.1 — 딱 중간
  assert.strictEqual(s.a.t, 10);
  assert.strictEqual(s.b.t, 12);
  assert.ok(Math.abs(s.k - 0.5) < 0.02, '중간이어야 한다: ' + s.k);
});

test('버퍼는 목표시각이 최신보다 뒤면 최신에 붙는다', () => {
  const N = I();
  const b = new N.Buffer();
  b.push(1.0, { t: 10 });
  b.push(1.1, { t: 11 });
  /* 목표시각 = 2.0 - DELAY = 1.85 — 최신(1.1)보다도 미래다. 스냅샷이 한동안
     안 오는데 로컬 시계는 계속 흐르는 상황(네트워크 지연)을 흉내낸다.
     (예전 버전은 sample(1.1) 을 썼는데, 그러면 목표시각이 0.95 로 오히려
     "최신보다 앞" 분기를 타서 이 테스트가 실제로는 아무것도 확인하지
     못했다.) */
  const s = b.sample(2.0);
  assert.strictEqual(s.a, s.b, '더 새 스냅샷이 없으니 앞뒤가 같아야 한다');
  assert.strictEqual(s.a.t, 11, '최신에 붙어야 한다');
});

test('버퍼는 무한히 쌓이지 않는다', () => {
  const N = I();
  const b = new N.Buffer();
  for (let i = 0; i < 500; i++) b.push(i * 0.1, { t: i });
  assert.ok(b.size() <= 30, '오래된 건 버려야 한다: ' + b.size());
});

test('버퍼는 순서가 뒤집힌 스냅샷을 버린다', () => {
  const N = I();
  const b = new N.Buffer();
  b.push(1.0, { t: 10 });
  b.push(1.1, { t: 11 });
  b.push(1.05, { t: 9 });               // 늦게 도착한 옛날 것
  const s = b.sample(1.1 + N.DELAY);
  assert.strictEqual(s.b.t, 11, '옛날 것이 최신을 밀어내면 안 된다');
});

/* ========== I4: Buffer.push 의 tSec 은 로컬 수신 시각이다 (계약 확인용) ========== */

test('tSec 은 로컬 수신 시각이다 — 스냅샷 자신의 t 값과 무관하게 정상 보간된다', () => {
  const N = I();
  const b = new N.Buffer();
  /* 스냅샷 자신의 t(호스트 시계)는 뭐든 상관없다 — 여기서는 호스트가 오래
     켜져 있었다고 하고 500초대로 뒀다. 그리는 쪽은 이 값을 push 에 절대
     넣지 않고, 패킷을 받은 로컬 시각만 넣는다. */
  b.push(1.0, { t: 500.0 });
  b.push(1.1, { t: 500.1 });
  b.push(1.2, { t: 500.2 });
  const s = b.sample(1.2);              // sample 도 같은 로컬 시계를 쓴다
  assert.ok(s.a.t <= 500.1, '로컬 시계로 앞뒤를 정상적으로 골라야 한다');
  assert.ok(s.k >= 0 && s.k <= 1);
});

test('tSec 자리에 스냅샷의 t 를 잘못 넣으면 보간이 영원히 멈춘다 — 계약이 왜 필요한지 보여준다', () => {
  const N = I();
  const b = new N.Buffer();
  /* 잘못된 사용: push 에 로컬 수신 시각이 아니라 스냅샷 자신의 t(작은 값,
     호스트 시계)를 그대로 넣었다고 하자. */
  b.push(1.0, { t: 1 });
  b.push(1.1, { t: 2 });
  b.push(1.2, { t: 3 });
  /* sample 은 여전히 로컬 시계(nowSec)를 받는다 — 보통 훨씬 큰 값이다.
     두 시계가 섞이면 target 이 버퍼의 모든 time 보다 영원히 커져서
     "최신보다 뒤" 분기에 갇힌다. */
  const localNow = 1700000000;
  const s = b.sample(localNow);
  assert.strictEqual(s.k, 0, '시계를 섞으면 항상 최신에 얼어붙는다');
  assert.strictEqual(s.a, s.b, '보간이 아예 시작되지 않는다');
});

/* ---------- 내 캐릭터 보정 ---------- */

test('오차가 없으면 그대로 둔다', () => {
  const N = I();
  const out = N.correct({ x: 100, y: 100 }, { x: 100, y: 100 }, 1 / 60);
  assert.strictEqual(Math.round(out.x), 100);
});

test('작은 오차는 조금씩 당긴다', () => {
  const N = I();
  const out = N.correct({ x: 100, y: 100 }, { x: 120, y: 100 }, 1 / 60);
  assert.ok(out.x > 100 && out.x < 120, '한 번에 다 가면 튄다: ' + out.x);
});

test('당기다 보면 결국 맞는다', () => {
  const N = I();
  let p = { x: 100, y: 100 };
  for (let i = 0; i < 120; i++) p = N.correct(p, { x: 120, y: 100 }, 1 / 60);
  assert.ok(Math.abs(p.x - 120) < 1, '2초면 붙어야 한다: ' + p.x);
});

test('오차가 아주 크면 그냥 순간이동한다', () => {
  const N = I();
  const far = N.SNAP_DIST + 200;
  const out = N.correct({ x: 0, y: 0 }, { x: far, y: 0 }, 1 / 60);
  assert.strictEqual(out.x, far, '되감기 수준으로 벌어지면 끌지 말고 옮긴다');
});

test('correct 는 원본을 고치지 않는다', () => {
  const N = I();
  const local = { x: 100, y: 100 };
  N.correct(local, { x: 200, y: 100 }, 1 / 60);
  assert.strictEqual(local.x, 100);
});


/* ---------- 늦추는 양을 망에 맞춰 스스로 잡는다 ----------

   고정 150ms 였을 때, 스냅샷 간격(100ms)보다 흔들림이 크면 sample 이
   짝을 못 찾아 마지막 자리에 멈췄다. 그 멈춤이 눈에는 렉으로 보인다.
   지터 ±90ms 를 흉내내면 프레임의 12.6% 가 얼었다. 아래 시험이 그
   회귀를 막는다. */

/* 흔들리며 도착하는 스냅샷을 흉내낸다. 난수는 씨앗을 박아 늘 같게. */
function arrivals(hz, jitterMs, dropRate, seconds) {
  let rnd = 987654321;
  const rand = () => { rnd = (rnd * 1103515245 + 12345) & 0x7fffffff; return rnd / 0x7fffffff; };
  const out = [];
  for (let t = 0; t < seconds; t += 1 / hz) {
    if (rand() < dropRate) continue;
    out.push({ at: t + 0.076 + (rand() - 0.5) * 2 * (jitterMs / 1000), snap: [t, 0] });
  }
  out.sort((a, b) => a.at - b.at);
  return out;
}

/* 화면이 언 프레임 비율. a===b 면 보간할 짝이 없어 멈춰 있다는 뜻이다. */
function frozenRatio(Interp, hz, jitterMs, dropRate, fixedDelay) {
  const buf = new Interp.Buffer();
  if (fixedDelay !== undefined) buf.delay = function () { return fixedDelay; };
  const arr = arrivals(hz, jitterMs, dropRate, 60);
  let ai = 0, frozen = 0, frames = 0;
  for (let now = 0; now < 60; now += 1 / 60) {
    while (ai < arr.length && arr[ai].at <= now) { buf.push(arr[ai].at, arr[ai].snap); ai++; }
    if (buf.size() < 2) continue;
    const s = buf.sample(now);
    if (!s) continue;
    frames++;
    if (s.a === s.b) frozen++;
  }
  return frames ? frozen / frames : 1;
}

test('망이 흔들려도 화면이 거의 안 언다', () => {
  const Ip = I();
  /* 사내망 수준(지터 ±90ms, 누락 8%). 예전 방식(고정 150ms)이면 10% 넘게 언다. */
  const now = frozenRatio(Ip, 15, 90, 0.08);
  const before = frozenRatio(Ip, 10, 90, 0.08, 0.15);
  assert.ok(now < 0.02,
    '언 프레임이 ' + (now * 100).toFixed(1) + '% 다 (2% 미만이어야 한다)');
  assert.ok(now < before / 4,
    '고정 지연(' + (before * 100).toFixed(1) + '%)보다 확실히 나아야 한다: ' +
    (now * 100).toFixed(1) + '%');
});

test('망이 좋으면 괜히 늦추지 않는다', () => {
  const Ip = I();
  const buf = new Ip.Buffer();
  /* 15Hz 로 거의 정확히 도착 */
  for (let k = 0; k < 30; k++) buf.push(k / 15, [k, 0]);
  assert.ok(buf.delay() <= 0.16,
    '좋은 망인데 ' + Math.round(buf.delay() * 1000) + 'ms 나 늦춘다');
  assert.ok(buf.delay() >= Ip.DELAY_MIN);
});

test('망이 나빠지면 빨리 늘리고, 좋아지면 천천히 줄인다', () => {
  const Ip = I();
  const buf = new Ip.Buffer();
  let t = 0;
  for (let k = 0; k < 20; k++) { t += 1 / 15; buf.push(t, [k, 0]); }
  const good = buf.delay();

  /* 갑자기 간격이 벌어진다 */
  for (let k = 0; k < 6; k++) { t += 0.25; buf.push(t, [100 + k, 0]); }
  const bad = buf.delay();
  assert.ok(bad > good + 0.05,
    '망이 나빠졌는데 안 늘었다: ' + Math.round(good * 1000) + ' → ' + Math.round(bad * 1000) + 'ms');

  /* 다시 좋아져도 한 번에 안 줄인다 — 급히 줄이면 그것 자체가 한 번 튄다 */
  for (let k = 0; k < 6; k++) { t += 1 / 15; buf.push(t, [200 + k, 0]); }
  assert.ok(buf.delay() > good,
    '좋아지자마자 확 줄였다 — 보는 시점이 앞으로 당겨지며 남들이 훌쩍 건너뛴다');
});

test('늦추는 양은 정해진 범위를 안 벗어난다', () => {
  const Ip = I();
  const buf = new Ip.Buffer();
  let t = 0;
  /* 아주 나쁜 망이어도 상한을 넘지 않는다 — 넘으면 남을 밟고 설 때
     조작이 답답해서 게임이 안 된다. */
  for (let k = 0; k < 40; k++) { t += 2.0; buf.push(t, [k, 0]); }
  assert.ok(buf.delay() <= Ip.DELAY_MAX + 1e-9,
    '상한(' + Ip.DELAY_MAX + ')을 넘었다: ' + buf.delay());
  const b2 = new Ip.Buffer();
  let t2 = 0;
  for (let k = 0; k < 40; k++) { t2 += 0.001; b2.push(t2, [k, 0]); }
  assert.ok(b2.delay() >= Ip.DELAY_MIN - 1e-9, '하한을 밑돌았다: ' + b2.delay());
});
