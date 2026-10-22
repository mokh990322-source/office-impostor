'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { load } = require('../testlib/load');
const Ro = load(['roles']).Roles;

function seq(vals) { let i = 0; return () => vals[i++ % vals.length]; }

test('임포스터 상한: 7명부터 2명', () => {
  assert.equal(Ro.impLimit(4), 1); assert.equal(Ro.impLimit(6), 1);
  assert.equal(Ro.impLimit(7), 2); assert.equal(Ro.impLimit(10), 2);
});

test('pick: 정확히 n명이 임포스터', () => {
  const pids = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
  for (let k = 0; k < 20; k++) {
    const r = Ro.pick(pids, 2);
    assert.equal(Object.values(r).filter(v => v === 'imp').length, 2);
    assert.equal(Object.keys(r).length, 7);
  }
});

test('pick: rand 가 1 을 돌려줘도 범위를 안 넘는다', () => {
  const r = Ro.pick(['a', 'b', 'c', 'd'], 1, seq([1, 0.99, 0]));
  assert.equal(Object.values(r).filter(v => v === 'imp').length, 1);
});

test('pickTasks: 겹치지 않게 n개', () => {
  const ids = ['s1', 's2', 's3', 's4', 's5', 's6', 's7', 's8'];
  for (let k = 0; k < 20; k++) {
    const t = Ro.pickTasks(ids, 5);
    assert.equal(t.length, 5);
    assert.equal(new Set(t).size, 5);
    t.forEach(x => assert.ok(ids.includes(x)));
  }
});

test('암호: 방장이 잠근 것을 그 사람만 연다', async () => {
  const host = await Ro.makeKeys(), me = await Ro.makeKeys(), other = await Ro.makeKeys();
  assert.ok(me.pub.length <= 200);
  const box = { r: 'imp', t: ['coffee', 'cable'], m: ['p7'] };
  const sealed = await Ro.seal(host.priv, me.pub, box);
  assert.ok(sealed.iv.length <= 32 && sealed.ct.length <= 600);
  assert.ok(!sealed.ct.includes('imp'));
  assert.deepEqual(await Ro.open(me.priv, host.pub, sealed), box);
  assert.equal(await Ro.open(other.priv, host.pub, sealed), null);
});

test('암호: 망가진 봉투는 null', async () => {
  const host = await Ro.makeKeys(), me = await Ro.makeKeys();
  assert.equal(await Ro.open(me.priv, host.pub, null), null);
  assert.equal(await Ro.open(me.priv, host.pub, { iv: 'AAAA', ct: 'BBBB' }), null);
  assert.equal(await Ro.open(me.priv, 'not-a-key', { iv: 'AAAA', ct: 'BBBB' }), null);
});

test('암호: 임무 5개 + 동료 1명짜리 봉투도 규칙 길이 안', async () => {
  const host = await Ro.makeKeys(), me = await Ro.makeKeys();
  const box = { r: 'imp', t: ['copier1', 'copier2', 'stamp1', 'stamp2', 'render'], m: ['pabcdefgh'] };
  const sealed = await Ro.seal(host.priv, me.pub, box);
  assert.ok(sealed.ct.length <= 600, String(sealed.ct.length));
});
