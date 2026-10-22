'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { load } = require('../testlib/load');
const W = load(['map', 'geom', 'rules', 'snap']);
const R = W.Rules, S = W.Snap, C = R.C;

function mk() {
  const list = [], roles = {}, tk = {};
  for (let i = 1; i <= 5; i++) { const pid = 'p' + i; list.push({ pid, name: 'n' + i, color: i - 1 }); roles[pid] = i === 1 ? 'imp' : 'crew'; tk[pid] = ['coffee']; }
  return R.create(list, roles, tk);
}

test('진행 중 꾸러미에는 역할·임무·킬쿨이 없다', () => {
  const s = mk();
  const txt = JSON.stringify(S.pack(s));
  for (const bad of ['imp', 'crew', 'coffee', 'killCd', 'role']) assert.ok(!txt.includes(bad), bad);
});

test('위치는 정수, 산 사람 표시', () => {
  const s = mk();
  s.players.p2.x = 100.7;
  const st = S.pack(s);
  assert.equal(st.p.p2[0], 101);
  assert.equal(st.p.p2[2], 1);
  assert.equal(st.ph, 'play');
});

test('나간 사람은 빠진다', () => {
  const s = mk();
  R.drop(s, 'p3');
  assert.equal(S.pack(s).p.p3, undefined);
});

test('투표 중엔 누가 투표했는지만, 공개 때 누구에게 했는지', () => {
  const s = mk();
  s.t = C.BTN_CD + 1;
  s.players.p2.x = 28.5 * 32; s.players.p2.y = 18.5 * 32;
  R.step(s, 0.01, { p2: { x: 0, y: 0, cmds: [{ k: 'use', a: 'btn' }] } });
  for (let t = 0; t < C.TALK + 0.1; t += 0.1) R.step(s, 0.1, {});
  R.step(s, 0.01, { p2: { x: 0, y: 0, cmds: [{ k: 'vote', a: 'p3' }] } });
  let st = S.pack(s);
  assert.deepEqual(st.m.v, ['p2']);
  assert.equal(st.m.vt, undefined);
  for (const v of ['p1', 'p3', 'p4', 'p5']) R.step(s, 0.01, { [v]: { x: 0, y: 0, cmds: [{ k: 'vote', a: 'skip' }] } });
  R.step(s, 0.01, {});
  st = S.pack(s);
  assert.equal(st.m.s, 'reveal');
  assert.equal(st.m.vt.p2, 'p3');
  assert.equal(st.m.e, '');
});

test('결과에서 임포스터 공개', () => {
  const s = mk();
  R.drop(s, 'p1');
  const st = S.pack(s);
  assert.deepEqual(st.w, { s: 'crew', y: 'vote', imps: ['p1'] });
});

test('서버 과열 남은 시간과 누른 패널', () => {
  const s = mk();
  s.t = C.SAB_FIRST + 1;
  R.step(s, 0.01, { p1: { x: 0, y: 0, cmds: [{ k: 'sab', a: 'reactor' }] } });
  const st = S.pack(s);
  assert.equal(st.sb.k, 'reactor');
  assert.equal(st.sb.r, C.REACTOR);
  assert.deepEqual(st.sb.h, [0, 0]);
});
