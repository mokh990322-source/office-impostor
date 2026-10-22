'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { load } = require('../testlib/load');
const { route, steer } = require('../testlib/walker');
const W = load(['map', 'geom', 'rules', 'roles']);
const R = W.Rules, M = W.OfficeMap, Ro = W.Roles, C = R.C;
const DT = 1 / 30;
const cen = id => M.center(M.byId(id));

function game(n, imps, taskMap) {
  const list = [], roles = {}, tasks = {};
  for (let i = 1; i <= n; i++) {
    const pid = 'p' + i;
    list.push({ pid, name: 'n' + i, color: i - 1 });
    roles[pid] = imps.includes(pid) ? 'imp' : 'crew';
    tasks[pid] = taskMap ? taskMap(pid) : Ro.pickTasks(M.stationIds(), C.TASKS_PER_PLAYER);
  }
  return R.create(list, roles, tasks);
}

/* 한 사람을 목표까지 걸린다. 도착하면 true. */
function walk(s, pid, target, range, maxSecs) {
  const p = s.players[pid];
  const path = route(M, p, target, range);
  assert.ok(path, pid + ' 길 없음');
  for (let t = 0; t < (maxSecs || 60); t += DT) {
    if (Math.hypot(p.x - target.x, p.y - target.y) <= range) { R.step(s, DT, { [pid]: { x: 0, y: 0 } }); return true; }
    const v = steer(p, path);
    if (!v.x && !v.y) { R.step(s, DT, { [pid]: { x: 0, y: 0 } }); return Math.hypot(p.x - target.x, p.y - target.y) <= range + 8; }
    R.step(s, DT, { [pid]: v });
    if (s.phase !== 'play') return false;
  }
  return false;
}
function cmd(s, pid, k, a) { return R.step(s, DT, { [pid]: { x: 0, y: 0, cmds: [{ k, a }] } }); }

test('직원들이 걸어가서 임무를 다 하면 직원 승리', () => {
  const s = game(4, ['p1']);
  for (const pid of ['p2', 'p3', 'p4']) {
    for (const id of s.players[pid].tasks) {
      assert.ok(walk(s, pid, cen(id), C.USE_R - 10), pid + ' → ' + id);
      cmd(s, pid, 'use', id);
      assert.equal(s.players[pid].done[id], true, pid + ' ' + id);
      if (s.winner) break;
    }
  }
  assert.equal(s.winner, 'crew');
  assert.equal(s.why, 'tasks');
});

test('여덟 임무 장소 전부, 회의실에서 걸어가 쓸 수 있다', () => {
  for (const id of M.stationIds()) {
    const s = game(4, ['p1'], () => [id]);
    assert.ok(walk(s, 'p2', cen(id), C.USE_R - 10), id);
    cmd(s, 'p2', 'use', id);
    assert.equal(s.players.p2.done[id], true, id);
  }
});

test('킬 → 다른 직원이 걸어가 신고 → 투표로 추방 → 직원 승리', () => {
  const s = game(6, ['p1'], () => ['coffee']);
  for (let t = 0; t < C.KILL_CD + 0.1; t += DT) R.step(s, DT, {});
  assert.ok(walk(s, 'p2', cen('coffee'), 30));
  assert.ok(walk(s, 'p1', s.players.p2, C.KILL_R - 10));
  cmd(s, 'p1', 'kill', 'p2');
  assert.equal(s.players.p2.alive, false);
  const body = s.bodies[0];
  assert.ok(walk(s, 'p3', body, C.REPORT_R - 10));
  cmd(s, 'p3', 'report', 'p2');
  assert.equal(s.phase, 'meeting');
  for (let t = 0; t < C.TALK + 0.1; t += DT) R.step(s, DT, {});
  for (const v of ['p1', 'p3', 'p4', 'p5', 'p6']) cmd(s, v, 'vote', 'p1');
  for (let t = 0; t < C.REVEAL + 0.5; t += DT) R.step(s, DT, {});
  assert.equal(s.winner, 'crew');
  assert.equal(s.why, 'vote');
});

test('긴급 버튼까지 걸어가서 누를 수 있다', () => {
  const s = game(5, ['p1']);
  for (let t = 0; t < C.BTN_CD + 0.1; t += DT) R.step(s, DT, {});
  assert.ok(walk(s, 'p4', cen('btn'), C.BTN_R - 10));
  cmd(s, 'p4', 'use', 'btn');
  assert.equal(s.phase, 'meeting');
});

test('정전 → 직원이 창고 두꺼비집까지 걸어가 고친다', () => {
  const s = game(5, ['p1']);
  for (let t = 0; t < C.SAB_FIRST + 0.1; t += DT) R.step(s, DT, {});
  cmd(s, 'p1', 'sab', 'lights');
  assert.ok(walk(s, 'p3', cen('breaker'), C.USE_R - 10));
  cmd(s, 'p3', 'use', 'breaker');
  assert.equal(s.sab, null);
});

test('서버 과열 → 두 직원이 각자 패널로 가서 동시에 누른다', () => {
  const s = game(5, ['p1']);
  for (let t = 0; t < C.SAB_FIRST + 0.1; t += DT) R.step(s, DT, {});
  cmd(s, 'p1', 'sab', 'reactor');
  assert.ok(walk(s, 'p2', cen('p1'), C.USE_R - 10));
  cmd(s, 'p2', 'hold', 'p1');
  assert.ok(walk(s, 'p3', cen('p2'), C.USE_R - 10));
  R.step(s, DT, { p3: { x: 0, y: 0, cmds: [{ k: 'hold', a: 'p2' }] } });
  assert.equal(s.sab, null);
  assert.ok(s.t < C.SAB_FIRST + C.REACTOR, '시간 안에');
});

test('임포스터가 환풍구로 탕비실에서 복사실로 간다', () => {
  const s = game(5, ['p1']);
  assert.ok(walk(s, 'p1', cen('A1'), C.VENT_R - 10));
  cmd(s, 'p1', 'use', 'A1');
  cmd(s, 'p1', 'use', 'A2');
  for (let t = 0; t < 0.5; t += DT) R.step(s, DT, { p1: { x: -1, y: 0 } });
  assert.equal(s.players.p1.vent, null);
  assert.equal(M.roomAt(s.players.p1.x, s.players.p1.y), '복사실');
});
