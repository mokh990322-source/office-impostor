'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { load } = require('../testlib/load');
const W = load(['map', 'geom']);
const M = W.OfficeMap, G = W.Geom;

const ROOM = { x: 28.5 * 32, y: 17.5 * 32 };   // 회의실 위쪽 바닥

test('벽에 박히지 않는다', () => {
  // 회의실 위쪽 벽(y=15 줄)으로 300px 밀기. 단, 세로 복도(x27~29)가 아닌 x=23 에서.
  const p = G.move(M, 23.5 * 32, 16.5 * 32, 0, -300, 14);
  assert.ok(p.y >= 16 * 32 + 14 - 0.01, 'y=' + p.y);
});

test('벽을 따라 미끄러진다', () => {
  const p = G.move(M, 23.5 * 32, 16 * 32 + 14, 40, -40, 14);
  assert.ok(p.x > 23.5 * 32 + 30, 'x 는 움직임');
  assert.ok(p.y >= 16 * 32 + 14 - 0.01, 'y 는 막힘');
});

test('빈 곳에서는 그대로 움직인다', () => {
  const p = G.move(M, ROOM.x, ROOM.y, 10, 0, 14);
  assert.ok(Math.abs(p.x - (ROOM.x + 10)) < 1e-9);
});

test('시야 다각형은 반경을 넘지 않는다', () => {
  const pts = G.vision(M, ROOM.x, ROOM.y, 192, 64);
  assert.equal(pts.length, 64);
  for (const [x, y] of pts) assert.ok(Math.hypot(x - ROOM.x, y - ROOM.y) <= 192 + 1e-6);
});

test('벽 너머는 안 보이고 같은 방은 보인다', () => {
  assert.equal(G.canSee(M, ROOM.x, ROOM.y, 23.5 * 32, 17.5 * 32, 288), true);
  // 회의실 위쪽 벽 너머 서버실 (복도 아닌 x=23)
  assert.equal(G.canSee(M, 23.5 * 32, 16.5 * 32, 23.5 * 32, 10.5 * 32, 288), false);
});

test('반경 밖은 안 보인다', () => {
  assert.equal(G.canSee(M, ROOM.x, ROOM.y, ROOM.x + 200, ROOM.y, 192), false);
});
