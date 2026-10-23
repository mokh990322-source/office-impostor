'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { load } = require('../testlib/load');
const I = load(['interp']).Interp;

/* 방장 값은 왕복 시간만큼 늦게 온다. 속도 170px/s, 지연 0.35초면 약 60px 뒤에 있다. */
const SPEED = 170, LAG = 0.35, DT = 1 / 60;

function walk(secs, lag) {
  let me = { x: 0, y: 0 }, stillFor = 0, back = 0, maxErr = 0;
  const hist = [];
  for (let t = 0; t < secs; t += DT) {
    const prev = me.x;
    me = { x: me.x + SPEED * DT, y: 0 };                 // 예측 이동
    hist.push({ t, x: me.x });
    const old = hist.filter(h => h.t <= t - lag).pop() || hist[0];
    const server = { x: old.x, y: 0 };                   // 늦게 온 방장 값
    me = I.reconcile(me, server, true, stillFor, DT);
    if (me.x < prev + SPEED * DT - 1e-6) back++;         // 앞으로 덜 갔거나 뒤로 갔다 = 당겨짐
    maxErr = Math.max(maxErr, me.x - server.x);
  }
  return { back, maxErr };
}

test('걷는 동안 늦게 온 방장 값 때문에 당겨지지 않는다', () => {
  const r = walk(3, LAG);
  assert.equal(r.back, 0, '당겨진 프레임 수');
});

test('망이 꽤 느려도(0.5초) 걷는 중엔 당기지 않는다', () => {
  assert.equal(walk(3, 0.5).back, 0);
});

test('멈추자마자는 그대로 두고, 방장 값이 따라올 시간이 지나면 살짝 맞춘다', () => {
  const me = { x: 100, y: 0 }, server = { x: 95, y: 0 };
  assert.deepEqual(I.reconcile(me, server, false, 0.1, DT), me, '멈춘 직후는 안 건드림');
  const later = I.reconcile(me, server, false, 1.0, DT);
  assert.ok(later.x < 100 && later.x > 95, '천천히 붙음');
});

test('크게 어긋나면(순간이동: 킬·환풍구·회의 뒤 재배치) 바로 방장 값으로', () => {
  const r = I.reconcile({ x: 0, y: 0 }, { x: 400, y: 0 }, true, 0, DT);
  assert.deepEqual(r, { x: 400, y: 0 });
});

test('걷는 중이라도 지연으로 설명 안 되는 차이(벽에 막힘 등)는 천천히 맞춘다', () => {
  const r = I.reconcile({ x: 0, y: 0 }, { x: 0, y: 130 }, true, 0, DT);
  assert.ok(r.y > 0 && r.y < 130);
});
