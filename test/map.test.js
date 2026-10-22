'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { load } = require('../testlib/load');
const M = load(['map']).OfficeMap;

function bfs(start) {
  const seen = new Set([start.join(',')]);
  const q = [start];
  while (q.length) {
    const [x, y] = q.shift();
    for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const nx = x + dx, ny = y + dy, k = nx + ',' + ny;
      if (seen.has(k) || M.solid(nx, ny)) continue;
      seen.add(k); q.push([nx, ny]);
    }
  }
  return seen;
}

test('격자 크기와 바깥은 막힘', () => {
  assert.equal(M.W, 58); assert.equal(M.H, 40);
  assert.equal(M.solid(-1, 5), true);
  assert.equal(M.solid(0, 0), true);
  assert.equal(M.solid(58, 5), true);
});

test('방 9개, 이름이 설계대로', () => {
  assert.deepEqual(M.rooms.map(r => r.name).sort(),
    ['대표실','렌더팜','복사실','서버실','엘리베이터 홀','창고','탕비실','회의실','휴게실'].sort());
});

test('임무 장소 8개, 종류 6가지', () => {
  const ids = M.stationIds();
  assert.equal(ids.length, 8);
  const types = new Set(ids.map(id => M.byId(id).type));
  assert.deepEqual([...types].sort(), ['cable','coffee','copier','plant','render','stamp']);
});

test('버튼 말고 모든 물건은 바닥 위, 버튼은 탁자 위', () => {
  for (const o of M.objects) {
    if (o.id === 'btn') assert.equal(M.solid(o.tx, o.ty), true, 'btn');
    else assert.equal(M.solid(o.tx, o.ty), false, o.id);
  }
});

test('시작 자리 10개는 바닥이고 서로 다르다', () => {
  const keys = new Set();
  for (let i = 0; i < 10; i++) {
    const p = M.spawn(i);
    assert.equal(M.solid(Math.floor(p.x / M.T), Math.floor(p.y / M.T)), false);
    keys.add(p.x + ',' + p.y);
  }
  assert.equal(keys.size, 10);
});

test('시작 자리에서 모든 물건에 걸어서 닿는다', () => {
  const s = M.spawn(0);
  const reach = bfs([Math.floor(s.x / M.T), Math.floor(s.y / M.T)]);
  for (const o of M.objects) {
    if (o.id === 'btn') { assert.ok(reach.has('28,18'), 'btn 위쪽'); continue; }
    assert.ok(reach.has(o.tx + ',' + o.ty), o.id);
  }
});

test('환풍구 짝은 서로를 가리킨다', () => {
  for (const id of ['A1','A2','B1','B2','C1','C2']) {
    assert.equal(M.ventPair(M.ventPair(id)), id);
    assert.notEqual(M.ventPair(id), id);
  }
});

test('roomAt 은 방 안에서 방 이름, 복도에서 빈 문자열', () => {
  assert.equal(M.roomAt(28.5 * 32, 17.5 * 32), '회의실');
  assert.equal(M.roomAt(18 * 32, 20 * 32), '');
});

test('물건마다 방 이름이 붙어 있다', () => {
  for (const o of M.objects) assert.ok(o.room.length > 0, o.id);
});
