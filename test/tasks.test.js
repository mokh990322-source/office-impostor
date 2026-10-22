'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { load } = require('../testlib/load');
const W = load(['tasks/common', 'tasks/copier', 'tasks/render', 'tasks/coffee', 'tasks/cable', 'tasks/stamp', 'tasks/plant']);
const K = W.Tasks.kinds;

test('여섯 가지가 다 등록되어 있고 문구가 있다', () => {
  assert.deepEqual(Object.keys(K).sort(), ['cable', 'coffee', 'copier', 'plant', 'render', 'stamp']);
  for (const k of Object.keys(K)) { assert.ok(K[k].label.length > 0); assert.equal(typeof K[k].mount, 'function'); }
});
test('복사기: 용지함 안만 인정', () => {
  assert.equal(K.copier.inTray(370, 190), true);
  assert.equal(K.copier.inTray(100, 190), false);
});
test('렌더: 순서대로만 체크', () => {
  assert.equal(K.render.next([false, false, false], 0), true);
  assert.equal(K.render.next([false, false, false], 1), false);
  assert.equal(K.render.next([true, false, false], 1), true);
  assert.equal(K.render.next([true, false, false], 0), false, '이미 체크한 건 다시 못 함');
});
test('커피: 선까지만', () => {
  assert.equal(K.coffee.judge(0.5), 'low');
  assert.equal(K.coffee.judge(0.85), 'ok');
  assert.equal(K.coffee.judge(0.95), 'over');
});
test('케이블: 같은 색끼리 넷 다', () => {
  const L = ['red', 'blue', 'yellow', 'green'], Rr = ['blue', 'green', 'red', 'yellow'];
  assert.equal(K.cable.solved({ 0: 2, 1: 0, 2: 3, 3: 1 }, L, Rr), true);
  assert.equal(K.cable.solved({ 0: 2, 1: 0, 2: 3 }, L, Rr), false);
  assert.equal(K.cable.solved({ 0: 0, 1: 2, 2: 3, 3: 1 }, L, Rr), false);
});
test('도장: 빈칸 안', () => {
  const box = { x: 100, y: 100, w: 80, h: 60 };
  assert.equal(K.stamp.hit(140, 130, box), true);
  assert.equal(K.stamp.hit(90, 130, box), false);
});
test('화분: 초록 칸', () => {
  assert.equal(K.plant.judge(0.7), 'ok');
  assert.equal(K.plant.judge(0.3), 'low');
  assert.equal(K.plant.judge(0.9), 'over');
});
