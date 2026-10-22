'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { load } = require('../testlib/load');
const W = load(['map', 'geom', 'rules']);
const R = W.Rules, M = W.OfficeMap, C = R.C;

function mk(n, imps) {
  const list = [], roles = {}, tk = {};
  for (let i = 1; i <= n; i++) { const pid = 'p' + i; list.push({ pid, name: 'n' + i, color: i - 1 }); roles[pid] = imps.includes(pid) ? 'imp' : 'crew'; tk[pid] = ['stamp1', 'coffee']; }
  return R.create(list, roles, tk);
}
const cen = id => M.center(M.byId(id));
function at(s, pid, p) { s.players[pid].x = p.x; s.players[pid].y = p.y; }
function cmd(s, pid, k, a, x, y) { return R.step(s, 0.01, { [pid]: { x: x || 0, y: y || 0, cmds: [{ k, a }] } }); }
function run(s, secs, inputs) { const ev = []; for (let t = 0; t < secs; t += 1 / 30) ev.push(...R.step(s, 1 / 30, inputs || {})); return ev; }

test('환풍구: 들어가고, 짝으로 옮기고, 방향키로 나온다', () => {
  const s = mk(5, ['p1']);
  const a1 = cen('A1'), a2 = cen('A2');
  at(s, 'p1', { x: a1.x + 10, y: a1.y });
  cmd(s, 'p1', 'use', 'A1');
  assert.equal(s.players.p1.vent, 'A1');
  cmd(s, 'p1', 'use', 'B1');
  assert.equal(s.players.p1.vent, 'A1', '짝이 아니면 무시');
  cmd(s, 'p1', 'use', 'A2');
  assert.equal(s.players.p1.vent, 'A2');
  assert.deepEqual({ x: s.players.p1.x, y: s.players.p1.y }, a2);
  run(s, 0.5, { p1: { x: 1, y: 0 } });
  assert.equal(s.players.p1.vent, null);
});

test('환풍구: 직원은 못 쓰고, 들어가자마자 누르던 키로는 안 나온다', () => {
  const s = mk(5, ['p1']);
  const a1 = cen('A1');
  at(s, 'p2', { x: a1.x, y: a1.y });
  cmd(s, 'p2', 'use', 'A1');
  assert.equal(s.players.p2.vent, null);
  at(s, 'p1', { x: a1.x, y: a1.y });
  cmd(s, 'p1', 'use', 'A1', 1, 0);
  R.step(s, 0.1, { p1: { x: 1, y: 0 } });
  assert.equal(s.players.p1.vent, 'A1');
});

test('환풍구 안에선 킬 못 한다', () => {
  const s = mk(5, ['p1']);
  const a1 = cen('A1');
  at(s, 'p1', a1); at(s, 'p2', { x: a1.x + 20, y: a1.y });
  s.players.p1.killCd = 0;
  cmd(s, 'p1', 'use', 'A1');
  cmd(s, 'p1', 'kill', 'p2');
  assert.equal(s.players.p2.alive, true);
});

test('사보타주: 처음 10초는 안 되고, 직원은 못 건다', () => {
  const s = mk(5, ['p1']);
  cmd(s, 'p1', 'sab', 'lights');
  assert.equal(s.sab, null);
  s.t = C.SAB_FIRST + 1;
  cmd(s, 'p2', 'sab', 'lights');
  assert.equal(s.sab, null);
  cmd(s, 'p1', 'sab', 'lights');
  assert.deepEqual(s.sab, { kind: 'lights' });
});

test('정전: 두꺼비집에서 고치면 풀리고 쿨다운 30초', () => {
  const s = mk(5, ['p1']);
  s.t = C.SAB_FIRST + 1;
  cmd(s, 'p1', 'sab', 'lights');
  const b = cen('breaker');
  at(s, 'p3', { x: b.x, y: b.y + 20 });
  const ev = cmd(s, 'p3', 'use', 'breaker');
  assert.equal(s.sab, null);
  assert.ok(ev.some(e => e.type === 'fixed' && e.kind === 'lights'));
  cmd(s, 'p1', 'sab', 'lights');
  assert.equal(s.sab, null, '쿨다운');
  s.t += C.SAB_CD;
  cmd(s, 'p1', 'sab', 'lights');
  assert.ok(s.sab);
});

test('하나 진행 중이면 다른 사보타주를 못 건다', () => {
  const s = mk(5, ['p1']);
  s.t = C.SAB_FIRST + 1;
  cmd(s, 'p1', 'sab', 'lights');
  cmd(s, 'p1', 'sab', 'reactor');
  assert.equal(s.sab.kind, 'lights');
});

test('서버 과열: 두 사람이 동시에 누르면 풀린다', () => {
  const s = mk(5, ['p1']);
  s.t = C.SAB_FIRST + 1;
  cmd(s, 'p1', 'sab', 'reactor');
  at(s, 'p2', { x: cen('p1').x, y: cen('p1').y + 20 });
  at(s, 'p3', { x: cen('p2').x, y: cen('p2').y + 20 });
  cmd(s, 'p2', 'hold', 'p1');
  assert.ok(s.sab, '한 명으론 안 됨');
  const ev = R.step(s, 0.01, { p3: { x: 0, y: 0, cmds: [{ k: 'hold', a: 'p2' }] } });
  assert.equal(s.sab, null);
  assert.ok(ev.some(e => e.type === 'fixed' && e.kind === 'reactor'));
});

test('서버 과열: 한 사람이 두 패널은 못 누른다, 자리를 뜨면 놓친다', () => {
  const s = mk(5, ['p1']);
  s.t = C.SAB_FIRST + 1;
  cmd(s, 'p1', 'sab', 'reactor');
  at(s, 'p2', { x: cen('p1').x, y: cen('p1').y + 20 });
  cmd(s, 'p2', 'hold', 'p1');
  assert.equal(s.sab.held.p1, 'p2');
  cmd(s, 'p2', 'hold', 'p2');
  assert.equal(s.sab.held.p1, undefined, '다른 패널을 누르면 먼저 것을 놓는다');
  cmd(s, 'p2', 'hold', 'p1');
  at(s, 'p2', { x: cen('p1').x, y: cen('p1').y + 200 });
  R.step(s, 0.01, {});
  assert.equal(s.sab.held.p1, undefined);
});

test('서버 과열: 시간이 다 되면 임포스터 승리', () => {
  const s = mk(5, ['p1']);
  s.t = C.SAB_FIRST + 1;
  cmd(s, 'p1', 'sab', 'reactor');
  run(s, C.REACTOR + 0.5);
  assert.equal(s.winner, 'imp'); assert.equal(s.why, 'sab');
});

test('서버 과열 중엔 긴급 버튼이 막히고, 신고로 회의를 열면 사보타주가 풀린다', () => {
  const s = mk(5, ['p1']);
  s.t = C.BTN_CD + 1;
  cmd(s, 'p1', 'sab', 'reactor');
  at(s, 'p2', { x: 28.5 * 32, y: 18.5 * 32 });
  cmd(s, 'p2', 'use', 'btn');
  assert.equal(s.phase, 'play');
  s.bodies.push({ pid: 'p5', x: 28.5 * 32, y: 18.5 * 32 });
  s.players.p5.alive = false;
  cmd(s, 'p2', 'report', 'p5');
  assert.equal(s.phase, 'meeting');
  assert.equal(s.sab, null);
});

test('유령: 벽을 통과한다', () => {
  const s = mk(5, ['p1']);
  s.players.p2.alive = false;
  at(s, 'p2', { x: 23.5 * 32, y: 16.5 * 32 });
  run(s, 1, { p2: { x: 0, y: -1 } });
  assert.ok(s.players.p2.y < 15 * 32, '위쪽 벽을 지나감');
});

test('유령: 버튼 못 누르고, 임무는 한다', () => {
  const s = mk(5, ['p1']);
  s.players.p2.alive = false;
  s.t = C.BTN_CD + 1;
  at(s, 'p2', { x: 28.5 * 32, y: 18.5 * 32 });
  cmd(s, 'p2', 'use', 'btn');
  assert.equal(s.phase, 'play');
  const c = cen('coffee');
  at(s, 'p2', { x: c.x, y: c.y + 10 });
  cmd(s, 'p2', 'use', 'coffee');
  assert.equal(s.players.p2.done.coffee, true);
});

test('추방된 임포스터 유령도 사보타주는 건다, 킬은 못 한다', () => {
  const s = mk(8, ['p1', 'p2']);
  s.players.p1.alive = false;
  s.t = C.SAB_FIRST + 1;
  cmd(s, 'p1', 'sab', 'lights');
  assert.ok(s.sab);
  s.players.p1.killCd = 0;
  at(s, 'p1', { x: 23.5 * 32, y: 17.5 * 32 }); at(s, 'p3', { x: 23.5 * 32 + 10, y: 17.5 * 32 });
  cmd(s, 'p1', 'kill', 'p3');
  assert.equal(s.players.p3.alive, true);
});
