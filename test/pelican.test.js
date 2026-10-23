'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { load } = require('../testlib/load');
const W = load(['map', 'geom', 'rules', 'roles', 'snap']);
const R = W.Rules, M = W.OfficeMap, Ro = W.Roles, S = W.Snap, C = R.C;

/* p1 = 임포스터, p2 = 펠리컨, 나머지 직원 */
function mk(n) {
  const list = [], roles = {}, tk = {};
  for (let i = 1; i <= n; i++) {
    const pid = 'p' + i;
    list.push({ pid, name: 'n' + i, color: i - 1 });
    roles[pid] = i === 1 ? 'imp' : i === 2 ? 'pel' : 'crew';
    tk[pid] = roles[pid] === 'crew' ? ['coffee'] : [];
  }
  return R.create(list, roles, tk);
}
function at(s, pid, x, y) { s.players[pid].x = x; s.players[pid].y = y; }
function cmd(s, pid, k, a) { return R.step(s, 0.01, { [pid]: { x: 0, y: 0, cmds: [{ k, a }] } }); }
const X = 23.5 * 32, Y = 17.5 * 32;

test('펠리컨 수: 6명부터 1명, 목표는 6~7명 2명·8명 이상 3명', () => {
  assert.equal(Ro.pelLimit(5), 0); assert.equal(Ro.pelLimit(6), 1); assert.equal(Ro.pelLimit(10), 1);
  assert.equal(mk(6).pelGoal, 2); assert.equal(mk(7).pelGoal, 2); assert.equal(mk(8).pelGoal, 3);
});

test('pick: 임포스터와 펠리컨이 겹치지 않는다', () => {
  for (let k = 0; k < 30; k++) {
    const r = Ro.pick(['a', 'b', 'c', 'd', 'e', 'f', 'g'], 2, null, 1);
    const v = Object.values(r);
    assert.equal(v.filter(x => x === 'imp').length, 2);
    assert.equal(v.filter(x => x === 'pel').length, 1);
  }
});

test('꿀꺽: 쿨다운 뒤 가까운 사람을 삼킨다, 시체는 없다', () => {
  const s = mk(6);
  at(s, 'p2', X, Y); at(s, 'p3', X + 20, Y);
  cmd(s, 'p2', 'eat', 'p3');
  assert.equal(s.players.p3.alive, true, '쿨다운');
  s.players.p2.eatCd = 0;
  const ev = cmd(s, 'p2', 'eat', 'p3');
  assert.equal(s.players.p3.alive, false);
  assert.equal(s.players.p3.eaten, 'p2');
  assert.equal(s.bodies.length, 0);
  assert.ok(ev.some(e => e.type === 'eat' && e.pid === 'p3' && e.by === 'p2'));
  assert.ok(s.players.p2.eatCd > C.EAT_CD - 0.5);
});

test('꿀꺽: 멀면 안 되고, 펠리컨이 아니면 못 한다', () => {
  const s = mk(6);
  s.players.p2.eatCd = 0; s.players.p3.eatCd = 0;
  at(s, 'p2', X, Y); at(s, 'p4', X + 200, Y);
  cmd(s, 'p2', 'eat', 'p4'); assert.equal(s.players.p4.alive, true);
  at(s, 'p3', X + 180, Y + 10);
  cmd(s, 'p3', 'eat', 'p4'); assert.equal(s.players.p4.alive, true);
});

test('삼킨 사람은 다음 회의 때 소화된다', () => {
  const s = mk(6);
  s.players.p2.eatCd = 0;
  at(s, 'p2', X, Y); at(s, 'p3', X + 20, Y);
  cmd(s, 'p2', 'eat', 'p3');
  s.t = C.BTN_CD + 1;
  at(s, 'p4', 28.5 * 32, 18.5 * 32);
  cmd(s, 'p4', 'use', 'btn');
  assert.equal(s.phase, 'meeting');
  assert.equal(s.players.p3.alive, false);
  assert.equal(s.players.p3.eaten, null, '소화됨');
});

test('회의 전에 임포스터가 펠리컨을 처치하면 삼킨 사람이 살아서 나온다', () => {
  const s = mk(7);
  s.players.p2.eatCd = 0; s.players.p1.killCd = 0;
  at(s, 'p2', X, Y); at(s, 'p3', X + 20, Y);
  cmd(s, 'p2', 'eat', 'p3');
  at(s, 'p1', s.players.p2.x - 20, s.players.p2.y);
  cmd(s, 'p1', 'kill', 'p2');
  assert.equal(s.players.p2.alive, false);
  assert.equal(s.players.p3.alive, true);
  assert.equal(s.players.p3.eaten, null);
  assert.equal(s.players.p3.x, s.players.p2.x);
});

test('목표만큼 삼키면 펠리컨 단독 승리', () => {
  const s = mk(6);
  for (const v of ['p3', 'p4']) {
    s.players.p2.eatCd = 0;
    at(s, 'p2', X, Y); at(s, v, X + 20, Y);
    cmd(s, 'p2', 'eat', v);
  }
  assert.equal(s.winner, 'pel'); assert.equal(s.why, 'eat');
  const st = S.pack(s);
  assert.deepEqual(st.w.pel, ['p2']);
});

test('삼킨 사람은 움직이지 않고 산 사람 수에서 빠진다', () => {
  const s = mk(6);
  s.players.p2.eatCd = 0;
  at(s, 'p2', X, Y); at(s, 'p3', X + 20, Y);
  cmd(s, 'p2', 'eat', 'p3');
  const x0 = s.players.p3.x;
  R.step(s, 0.5, { p3: { x: 1, y: 0 } });
  assert.equal(s.players.p3.x, x0);
  assert.deepEqual(R.counts(s), { imp: 1, crew: 4 });
});

test('펠리컨은 일반 임무가 없고 진행률에서 빠진다, 추방되면 펠리컨이라고 알려 준다', () => {
  const s = mk(6);
  assert.equal(R.progress(s).total, 4);
  s.t = C.BTN_CD + 1;
  at(s, 'p4', 28.5 * 32, 18.5 * 32);
  cmd(s, 'p4', 'use', 'btn');
  for (let t = 0; t < C.TALK + 0.1; t += 0.1) R.step(s, 0.1, {});
  for (const v of ['p1', 'p2', 'p3', 'p4', 'p5', 'p6']) cmd(s, v, 'vote', 'p2');
  R.step(s, 0.01, {});
  assert.equal(s.meeting.ejected, 'p2');
  assert.equal(s.meeting.ejectedPel, true);
  assert.equal(S.pack(s).m.ep, 1);
});

test('꾸러미: 삼켜진 사람 표시, 펠리컨 쿨은 안 싣는다', () => {
  const s = mk(6);
  s.players.p2.eatCd = 0;
  at(s, 'p2', X, Y); at(s, 'p3', X + 20, Y);
  cmd(s, 'p2', 'eat', 'p3');
  const st = S.pack(s);
  assert.equal(st.p.p3[5], 1);
  assert.equal(st.p.p2[5], 0);
  assert.ok(!JSON.stringify(st).includes('pel'), '역할이 새지 않는다');
});

test('임포스터가 삼켜져도 소화되기 전엔 판이 안 끝난다, 소화되면 직원 승리', () => {
  const s = mk(7);
  s.players.p2.eatCd = 0;
  at(s, 'p2', X, Y); at(s, 'p1', X + 20, Y);
  cmd(s, 'p2', 'eat', 'p1');
  assert.equal(s.players.p1.eaten, 'p2');
  assert.equal(s.winner, null);
  s.t = C.BTN_CD + 1;
  at(s, 'p4', 28.5 * 32, 18.5 * 32);
  cmd(s, 'p4', 'use', 'btn');
  for (let t = 0; t < C.TALK + C.VOTE + C.REVEAL + 1; t += 0.1) R.step(s, 0.1, {});
  assert.equal(s.winner, 'crew');
});
