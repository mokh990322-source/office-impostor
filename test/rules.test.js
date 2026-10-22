'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { load } = require('../testlib/load');
const W = load(['map', 'geom', 'rules']);
const R = W.Rules, M = W.OfficeMap;

function mk(n, imps, tasks) {
  const list = [], roles = {}, tk = {};
  for (let i = 1; i <= n; i++) {
    const pid = 'p' + i;
    list.push({ pid, name: '사람' + i, color: i - 1 });
    roles[pid] = imps.includes(pid) ? 'imp' : 'crew';
    tk[pid] = tasks || ['stamp1', 'coffee'];
  }
  return R.create(list, roles, tk);
}
function at(s, pid, x, y) { s.players[pid].x = x; s.players[pid].y = y; }
function cmd(s, pid, k, a) { return R.step(s, 0.01, { [pid]: { x: 0, y: 0, cmds: [{ k, a }] } }); }
function run(s, secs, inputs) { const ev = []; const dt = 1 / 30; for (let t = 0; t < secs; t += dt) ev.push(...R.step(s, dt, inputs || {})); return ev; }
const C = R.C;
const cen = id => M.center(M.byId(id));

test('만들면 판 진행 중, 회의실 시작 자리', () => {
  const s = mk(5, ['p1']);
  assert.equal(s.phase, 'play');
  assert.deepEqual({ x: s.players.p1.x, y: s.players.p1.y }, M.spawn(0));
  assert.equal(s.players.p1.role, 'imp');
  assert.equal(s.players.p2.role, 'crew');
});

test('이동: 0.5초 오른쪽이면 속도의 절반만큼', () => {
  const s = mk(4, ['p1']);
  const x0 = s.players.p2.x;
  R.step(s, 0.5, { p2: { x: 1, y: 0 } });
  assert.ok(Math.abs(s.players.p2.x - (x0 + C.SPEED * 0.5)) < 1e-6);
});

test('대각선 입력은 1로 눌러 속도를 넘지 않는다', () => {
  const s = mk(4, ['p1']);
  const p = s.players.p2;
  at(s, 'p2', 28.5 * 32, 17.5 * 32);
  R.step(s, 0.1, { p2: { x: 1, y: 1 } });
  const d = Math.hypot(p.x - 28.5 * 32, p.y - 17.5 * 32);
  assert.ok(d <= C.SPEED * 0.1 + 1e-6, String(d));
});

test('임무: 장소 근처에서 use 하면 완료, 멀면 무시', () => {
  const s = mk(4, ['p1']);
  const c = cen('coffee');
  at(s, 'p2', c.x + 200, c.y);
  cmd(s, 'p2', 'use', 'coffee');
  assert.equal(!!s.players.p2.done.coffee, false);
  at(s, 'p2', c.x + 20, c.y);
  const ev = cmd(s, 'p2', 'use', 'coffee');
  assert.equal(s.players.p2.done.coffee, true);
  assert.ok(ev.some(e => e.type === 'task'));
});

test('임무: 내 목록에 없는 장소, 임포스터는 무시', () => {
  const s = mk(4, ['p1']);
  const c = cen('cable');
  at(s, 'p2', c.x, c.y + 20);
  cmd(s, 'p2', 'use', 'cable');
  assert.equal(!!s.players.p2.done.cable, false);
  const k = cen('coffee');
  at(s, 'p1', k.x, k.y + 20);
  cmd(s, 'p1', 'use', 'coffee');
  assert.equal(!!s.players.p1.done.coffee, false);
});

test('진행률은 직원 임무만 센다', () => {
  const s = mk(4, ['p1']);
  assert.deepEqual(R.progress(s), { done: 0, total: 6 });
});

test('킬: 쿨다운 중엔 안 되고, 끝나면 거리 안에서 된다', () => {
  const s = mk(5, ['p1']);
  at(s, 'p1', 28.5 * 32, 17.5 * 32); at(s, 'p2', 28.5 * 32 + 30, 17.5 * 32);
  cmd(s, 'p1', 'kill', 'p2');
  assert.equal(s.players.p2.alive, true, '쿨다운');
  s.players.p1.killCd = 0;
  cmd(s, 'p1', 'kill', 'p2');
  assert.equal(s.players.p2.alive, false);
  assert.equal(s.bodies.length, 1);
  assert.ok(s.players.p1.killCd > C.KILL_CD - 0.5, String(s.players.p1.killCd));
  assert.equal(s.players.p1.x, s.bodies[0].x);
});

test('킬: 멀면 안 되고, 임포스터끼리 안 되고, 직원은 못 한다', () => {
  const s = mk(8, ['p1', 'p2']);
  s.players.p1.killCd = 0; s.players.p3.killCd = 0;
  at(s, 'p1', 28.5 * 32, 17.5 * 32); at(s, 'p4', 28.5 * 32 + 100, 17.5 * 32);
  cmd(s, 'p1', 'kill', 'p4'); assert.equal(s.players.p4.alive, true, '거리');
  at(s, 'p2', 28.5 * 32 + 20, 17.5 * 32);
  cmd(s, 'p1', 'kill', 'p2'); assert.equal(s.players.p2.alive, true, '동료');
  at(s, 'p3', 28.5 * 32 + 90, 17.5 * 32 + 10);
  at(s, 'p4', 28.5 * 32 + 100, 17.5 * 32 + 10);
  cmd(s, 'p3', 'kill', 'p4'); assert.equal(s.players.p4.alive, true, '직원');
});

test('킬쿨은 시간이 가면 줄어든다', () => {
  const s = mk(5, ['p1']);
  run(s, 5);
  assert.ok(Math.abs(s.players.p1.killCd - (C.KILL_CD - 5)) < 0.05);
});

test('신고: 시체 근처에서 회의, 시체는 치운다', () => {
  const s = mk(5, ['p1']);
  s.players.p1.killCd = 0;
  at(s, 'p1', 23.5 * 32, 17.5 * 32); at(s, 'p2', 23.5 * 32 + 20, 17.5 * 32);
  cmd(s, 'p1', 'kill', 'p2');
  at(s, 'p3', s.bodies[0].x + 20, s.bodies[0].y);
  const ev = cmd(s, 'p3', 'report', 'p2');
  assert.equal(s.phase, 'meeting');
  assert.equal(s.meeting.by, 'p3'); assert.equal(s.meeting.body, 'p2');
  assert.equal(s.bodies.length, 0);
  assert.ok(ev.some(e => e.type === 'meeting'));
});

test('신고: 멀면 안 된다', () => {
  const s = mk(5, ['p1']);
  s.bodies.push({ pid: 'p5', x: 100, y: 100 });
  at(s, 'p3', 23.5 * 32, 17.5 * 32);
  cmd(s, 'p3', 'report', 'p5');
  assert.equal(s.phase, 'play');
});

test('긴급 버튼: 대기 시간 뒤 탁자 근처에서 한 번만', () => {
  const s = mk(5, ['p1']);
  at(s, 'p2', 28.5 * 32, 18.5 * 32);
  cmd(s, 'p2', 'use', 'btn');
  assert.equal(s.phase, 'play', '처음 15초는 막힘');
  s.t = C.BTN_CD + 1;
  cmd(s, 'p2', 'use', 'btn');
  assert.equal(s.phase, 'meeting');
  assert.equal(s.players.p2.btnLeft, 0);
});

test('회의: 토론 → 투표 → 공개 → 재개, 추방은 시체 없이', () => {
  const s = mk(6, ['p1']);
  s.t = C.BTN_CD + 1;
  at(s, 'p2', 28.5 * 32, 18.5 * 32);
  cmd(s, 'p2', 'use', 'btn');
  run(s, C.TALK + 0.1);
  assert.equal(s.meeting.stage, 'vote');
  for (const v of ['p2', 'p3', 'p4']) cmd(s, v, 'vote', 'p5');
  for (const v of ['p1', 'p5', 'p6']) cmd(s, v, 'vote', 'skip');
  R.step(s, 0.01, {});
  assert.equal(s.meeting.stage, 'reveal');
  assert.equal(s.meeting.ejected, null);
  run(s, C.REVEAL + 0.1);
  assert.equal(s.phase, 'play');
  assert.ok(s.players.p1.killCd > C.KILL_CD - 0.5, String(s.players.p1.killCd));
  assert.deepEqual({ x: s.players.p3.x, y: s.players.p3.y }, M.spawn(2));
});

test('투표는 한 번만, 죽은 사람은 못 한다', () => {
  const s = mk(6, ['p1']);
  s.t = C.BTN_CD + 1;
  s.players.p6.alive = false;
  at(s, 'p2', 28.5 * 32, 18.5 * 32);
  cmd(s, 'p2', 'use', 'btn');
  run(s, C.TALK + 0.1);
  cmd(s, 'p2', 'vote', 'p3'); cmd(s, 'p2', 'vote', 'p4');
  assert.equal(s.meeting.votes.p2, 'p3');
  cmd(s, 'p6', 'vote', 'p3');
  assert.equal(s.meeting.votes.p6, undefined);
});

test('토론 중에는 투표가 안 된다', () => {
  const s = mk(6, ['p1']);
  s.t = C.BTN_CD + 1;
  at(s, 'p2', 28.5 * 32, 18.5 * 32);
  cmd(s, 'p2', 'use', 'btn');
  cmd(s, 'p3', 'vote', 'p4');
  assert.equal(s.meeting.votes.p3, undefined);
});

test('tally: 최다 득표, 동점·건너뛰기 최다는 null', () => {
  assert.equal(R.tally({ a: 'x', b: 'x', c: 'y' }), 'x');
  assert.equal(R.tally({ a: 'x', b: 'y' }), null);
  assert.equal(R.tally({ a: 'skip', b: 'skip', c: 'x' }), null);
  assert.equal(R.tally({ a: 'x', b: 'skip' }), null);
  assert.equal(R.tally({}), null);
});

test('임포스터를 추방하면 회의 끝에 직원 승리', () => {
  const s = mk(5, ['p1']);
  s.t = C.BTN_CD + 1;
  at(s, 'p2', 28.5 * 32, 18.5 * 32);
  cmd(s, 'p2', 'use', 'btn');
  run(s, C.TALK + 0.1);
  for (const v of ['p1', 'p2', 'p3', 'p4', 'p5']) cmd(s, v, 'vote', 'p1');
  R.step(s, 0.01, {});
  assert.equal(s.meeting.ejected, 'p1');
  assert.equal(s.meeting.ejectedImp, true);
  assert.equal(s.meeting.impsLeft, 0);
  const ev = run(s, C.REVEAL + 0.1);
  assert.equal(s.phase, 'result');
  assert.equal(s.winner, 'crew'); assert.equal(s.why, 'vote');
  assert.ok(ev.some(e => e.type === 'win'));
});

test('임포스터 수가 직원 수 이상이면 임포스터 승리', () => {
  const s = mk(4, ['p1']);
  s.players.p1.killCd = 0;
  at(s, 'p1', 23.5 * 32, 17.5 * 32); at(s, 'p2', 23.5 * 32 + 20, 17.5 * 32);
  cmd(s, 'p1', 'kill', 'p2');
  assert.equal(s.phase, 'play', '1 대 2');
  s.players.p1.killCd = 0;
  at(s, 'p3', 23.5 * 32 + 20, 17.5 * 32 + 10);
  cmd(s, 'p1', 'kill', 'p3');
  assert.equal(s.winner, 'imp'); assert.equal(s.why, 'kill');
});

test('임무를 다 하면 직원 승리 (유령 임무도 센다)', () => {
  const s = mk(4, ['p1'], ['coffee']);
  s.players.p4.alive = false;
  for (const p of ['p2', 'p3', 'p4']) {
    const c = cen('coffee');
    at(s, p, c.x + 10, c.y);
    cmd(s, p, 'use', 'coffee');
  }
  assert.equal(s.winner, 'crew'); assert.equal(s.why, 'tasks');
});

test('결과 화면 시간이 지나면 end 한 번', () => {
  const s = mk(4, ['p1'], ['coffee']);
  for (const p of ['p2', 'p3', 'p4']) { const c = cen('coffee'); at(s, p, c.x, c.y + 10); cmd(s, p, 'use', 'coffee'); }
  const ev = run(s, C.RESULT + 1);
  assert.equal(ev.filter(e => e.type === 'end').length, 1);
});

test('나간 사람: 죽은 것으로 치고 시체 없음, 임무 총량에서 빠진다', () => {
  const s = mk(5, ['p1']);
  R.drop(s, 'p2');
  assert.equal(s.players.p2.alive, false);
  assert.equal(s.bodies.length, 0);
  assert.equal(R.progress(s).total, 6);
});

test('임포스터가 나가면 직원 승리', () => {
  const s = mk(5, ['p1']);
  R.drop(s, 'p1');
  assert.equal(s.winner, 'crew');
});

test('나간 사람에게 몰린 표는 아무도 추방 안 함', () => {
  const s = mk(6, ['p1']);
  s.t = C.BTN_CD + 1;
  at(s, 'p2', 28.5 * 32, 18.5 * 32);
  cmd(s, 'p2', 'use', 'btn');
  run(s, C.TALK + 0.1);
  for (const v of ['p2', 'p3', 'p4']) cmd(s, v, 'vote', 'p6');
  R.drop(s, 'p6');
  run(s, C.VOTE + 0.1);
  assert.equal(s.meeting.ejected, null);
});

test('이상한 명령과 입력은 무시한다', () => {
  const s = mk(4, ['p1']);
  R.step(s, 0.1, { p2: { x: NaN, y: 'a', cmds: [null, { k: 5 }, { k: 'use', a: 'nope' }] }, nobody: { x: 1 } });
  assert.equal(s.phase, 'play');
});
