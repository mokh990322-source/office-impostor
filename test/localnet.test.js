'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { load } = require('../testlib/load');

/* Node 24 에도 BroadcastChannel 이 있다. 같은 프로세스 안의 두 인스턴스로 두 탭을 흉내낸다. */
function inst(name) { return load(['net', 'localnet'], { location: { search: '' } }).LocalNet.make(name, BroadcastChannel); }
const tick = (ms) => new Promise(r => setTimeout(r, ms || 30));

test('한 탭이 쓴 것을 다른 탭이 지켜본다, 지우면 빈 칸도 사라진다', async () => {
  const name = 'oi-test-' + Math.random();
  const A = inst(name), B = inst(name);
  let seen = 'none';
  const w = B.watch('crew/ABCD', s => { seen = s; });
  await A.put('crew/ABCD/who/p1', { name: '가' });
  await tick();
  assert.deepEqual(seen, { who: { p1: { name: '가' } } });
  await A.del('crew/ABCD/who/p1');
  await tick();
  assert.equal(seen, null);
  w.close(); A.close(); B.close();
});

test('내가 쓴 것도 내 watch 에 온다', async () => {
  const A = inst('oi-test-' + Math.random());
  let seen = null;
  const w = A.watch('crew/ABCD/st', s => { seen = s; });
  await A.put('crew/ABCD/st', { t: 1 });
  assert.deepEqual(seen, { t: 1 });
  w.close(); A.close();
});

test('위쪽 경로를 통째로 바꿔도 아래를 보는 watch 가 갱신된다', async () => {
  const A = inst('oi-test-' + Math.random());
  let seen = null;
  const w = A.watch('crew/ABCD/meta', s => { seen = s; });
  await A.put('crew/ABCD', { meta: { host: 'p1', phase: 'lobby' } });
  assert.deepEqual(seen, { host: 'p1', phase: 'lobby' });
  w.close(); A.close();
});

test('나중에 연 탭이 기존 내용을 받아 온다', async () => {
  const name = 'oi-test-' + Math.random();
  const a = inst(name);
  await a.put('crew/WXYZ/meta', { host: 'p1', phase: 'lobby' });
  const b = inst(name);
  await tick(60);
  assert.deepEqual(await b.get('crew/WXYZ/meta'), { host: 'p1', phase: 'lobby' });
  a.close(); b.close();
});

test('get 은 없는 경로에 null', async () => {
  const A = inst('oi-test-' + Math.random());
  assert.equal(await A.get('crew/NONE'), null);
  A.close();
});
