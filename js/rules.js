/* ============================================================
   사무실 임포스터 — 게임 규칙

   방장 브라우저만 이 파일로 판을 계산한다. 화면도 네트워크도 모른다.
   그래서 Node 로 한 판을 통째로 돌려 볼 수 있다.

   step(s, dt, inputs) 는 상태 s 를 그 자리에서 고치고 일어난 일을 돌려준다.
   inputs = { pid: { x, y, cmds: [{ k, a }] } }
   x, y 는 -1~1 이동 입력. 입력이 안 온 사람은 직전 입력을 계속 쓴다.

   명령은 그대로 믿지 않는다. 역할, 거리, 쿨다운, 단계를 모두 여기서 본다.
   단, 미니게임을 진짜 했는지는 알 수 없다(그건 그 사람 브라우저 안의 일이다).

   ── 서버 패널·두꺼비집은 누구나 ─────────────────────────
   직원만 고칠 수 있게 하면 "임포스터가 눌렀는데 표시가 안 뜬다"로
   정체가 드러난다. 그래서 산 사람이면 역할과 상관없이 고칠 수 있다.
   ============================================================ */
(function (global) {
  'use strict';

  var M = global.OfficeMap, G = global.Geom;

  var C = {
    SPEED: 170, R: 14,
    KILL_R: 48, REPORT_R: 48, USE_R: 56, BTN_R: 40, VENT_R: 40,   // BTN_R 은 탁자 가장자리까지 거리
    KILL_CD: 25, EAT_CD: 30, BTN_CD: 15, BTN_PER_PLAYER: 1,
    TALK: 60, VOTE: 30, REVEAL: 4, RESULT: 10,
    SAB_FIRST: 10, SAB_CD: 30, REACTOR: 45, VENT_EXIT_DELAY: 0.3,
    VISION_CREW: 192, VISION_IMP: 288, VISION_LIGHTS: 48,
    TASKS_PER_PLAYER: 5
  };

  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }
  function num(v) { return (typeof v === 'number' && isFinite(v)) ? v : 0; }
  function dist(a, b) { var dx = a.x - b.x, dy = a.y - b.y; return Math.sqrt(dx * dx + dy * dy); }
  function own(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }

  /* 펠리컨이 이기려면 삼켜야 하는 사람 수 */
  function pelGoal(n) { return n >= 8 ? 3 : 2; }

  function create(list, roles, tasks) {
    var s = {
      phase: 'play', t: 0, order: [], players: {}, bodies: [],
      btnCdUntil: C.BTN_CD, sab: null, sabCdUntil: C.SAB_FIRST,
      meeting: null, winner: null, why: null, resultUntil: 0, ended: false,
      pelGoal: pelGoal(list.length)
    };
    for (var i = 0; i < list.length; i++) {
      var e = list[i], sp = M.spawn(i);
      s.players[e.pid] = {
        name: e.name, color: e.color, x: sp.x, y: sp.y,
        alive: true, left: false, role: roles[e.pid] === 'imp' || roles[e.pid] === 'pel' ? roles[e.pid] : 'crew',
        tasks: (tasks[e.pid] || []).slice(), done: {},
        killCd: C.KILL_CD, eatCd: C.EAT_CD, eats: 0, eaten: null, btnLeft: C.BTN_PER_PLAYER,
        vent: null, ventAt: 0, ix: 0, iy: 0
      };
      s.order.push(e.pid);
    }
    return s;
  }

  function progress(s) {
    var done = 0, total = 0;
    s.order.forEach(function (pid) {
      var p = s.players[pid];
      if (p.left || p.role !== 'crew') return;
      total += p.tasks.length;
      p.tasks.forEach(function (id) { if (p.done[id]) done++; });
    });
    return { done: done, total: total };
  }

  function counts(s) {
    var imp = 0, crew = 0;
    s.order.forEach(function (pid) {
      var p = s.players[pid];
      if (p.left || !p.alive) return;
      if (p.role === 'imp') imp++; else crew++;
    });
    return { imp: imp, crew: crew };
  }

  function finish(s, side, why, ev) {
    s.winner = side; s.why = why; s.phase = 'result';
    s.resultUntil = s.t + C.RESULT; s.meeting = null; s.sab = null;
    ev.push({ type: 'win', side: side, why: why });
    return true;
  }

  function checkWin(s, ev) {
    if (s.winner) return true;
    for (var i = 0; i < s.order.length; i++) {
      var q = s.players[s.order[i]];
      if (q.role === 'pel' && q.alive && !q.left && q.eats >= s.pelGoal) return finish(s, 'pel', 'eat', ev);
    }
    var pr = progress(s), c = counts(s);
    if (pr.total > 0 && pr.done >= pr.total) return finish(s, 'crew', 'tasks', ev);
    /* 뱃속 임포스터는 풀려날 수 있으니 소화되기 전까진 아직 판에 있는 걸로 센다 */
    var impEaten = s.order.filter(function (pid) { var q = s.players[pid]; return q.role === 'imp' && q.eaten && !q.left; }).length;
    if (c.imp + impEaten === 0) return finish(s, 'crew', 'vote', ev);
    if (c.imp >= c.crew) return finish(s, 'imp', 'kill', ev);
    return false;
  }

  /* ── 회의 ─────────────────────────────────────────────── */

  function startMeeting(s, by, body, ev) {
    s.phase = 'meeting';
    s.bodies = [];
    /* 뱃속에 있던 사람은 회의가 열리면 소화된다(그대로 죽음) */
    s.order.forEach(function (pid) { s.players[pid].eaten = null; });
    if (s.sab) { s.sab = null; s.sabCdUntil = s.t + C.SAB_CD; }
    s.order.forEach(function (pid) { var p = s.players[pid]; p.vent = null; p.ix = 0; p.iy = 0; });
    s.meeting = { by: by, body: body, stage: 'talk', until: s.t + C.TALK, votes: {},
      ejected: null, ejectedImp: false, ejectedPel: false, impsLeft: 0 };
    ev.push({ type: 'meeting', by: by, body: body });
  }

  function tally(votes) {
    var c = {}, k;
    for (k in votes) if (own(votes, k)) c[votes[k]] = (c[votes[k]] || 0) + 1;
    var best = null, bestN = 0, tie = false;
    for (k in c) {
      if (!own(c, k)) continue;
      if (c[k] > bestN) { best = k; bestN = c[k]; tie = false; }
      else if (c[k] === bestN) tie = true;
    }
    if (!best || tie || best === 'skip') return null;
    return best;
  }

  function allVoted(s) {
    var m = s.meeting;
    return s.order.every(function (pid) {
      var p = s.players[pid];
      return p.left || !p.alive || m.votes[pid] !== undefined;
    });
  }

  function reveal(s, ev) {
    var m = s.meeting, e = tally(m.votes);
    if (e && (!s.players[e] || s.players[e].left)) e = null;
    m.stage = 'reveal'; m.until = s.t + C.REVEAL; m.ejected = e; m.ejectedImp = false; m.ejectedPel = false;
    if (e) { s.players[e].alive = false; m.ejectedImp = s.players[e].role === 'imp'; m.ejectedPel = s.players[e].role === 'pel'; }
    m.impsLeft = counts(s).imp;
    ev.push({ type: 'reveal', ejected: e, imp: m.ejectedImp });
  }

  function endMeeting(s, ev) {
    s.meeting = null;
    if (checkWin(s, ev)) return;
    s.phase = 'play';
    s.order.forEach(function (pid, i) {
      var p = s.players[pid], sp = M.spawn(i);
      p.x = sp.x; p.y = sp.y; p.vent = null; p.ix = 0; p.iy = 0;
      if (p.role === 'imp') p.killCd = C.KILL_CD;
      if (p.role === 'pel') p.eatCd = C.EAT_CD;
    });
    s.btnCdUntil = s.t + C.BTN_CD;
    ev.push({ type: 'resume' });
  }

  function meetingStep(s, ev) {
    var m = s.meeting;
    if (!m) return;
    if (m.stage === 'talk') {
      if (s.t >= m.until) { m.stage = 'vote'; m.until = s.t + C.VOTE; ev.push({ type: 'vote' }); }
      return;
    }
    if (m.stage === 'vote') {
      if (s.t >= m.until || allVoted(s)) reveal(s, ev);
      return;
    }
    if (m.stage === 'reveal' && s.t >= m.until) endMeeting(s, ev);
  }

  /* ── 명령 ─────────────────────────────────────────────── */

  function use(s, pid, a, ev) {
    var p = s.players[pid], o = M.byId(a);
    if (!o) return;
    var d = dist(p, M.center(o));
    if (p.eaten) return;   // 뱃속에선 아무것도 못 한다
    if (o.kind === 'task') {
      if (p.role !== 'crew' || p.tasks.indexOf(a) < 0 || p.done[a] || d > C.USE_R) return;
      p.done[a] = true;
      ev.push({ type: 'task', pid: pid, id: a });
      checkWin(s, ev);
      return;
    }
    if (o.kind === 'button') {
      if (!p.alive || p.btnLeft <= 0 || s.t < s.btnCdUntil || M.tableDist(p.x, p.y) > C.BTN_R) return;
      if (s.sab && s.sab.kind === 'reactor') return;
      p.btnLeft--;
      startMeeting(s, pid, null, ev);
      return;
    }
    if (o.kind === 'vent') {
      if (p.role !== 'imp' || !p.alive) return;
      var c = M.center(o);
      if (p.vent) {
        if (M.ventPair(p.vent) !== a) return;
        p.vent = a; p.x = c.x; p.y = c.y; p.ventAt = s.t;
        ev.push({ type: 'ventmove', pid: pid, id: a });
        return;
      }
      if (d > C.VENT_R) return;
      p.vent = a; p.x = c.x; p.y = c.y; p.ventAt = s.t;
      ev.push({ type: 'vent', pid: pid, id: a });
      return;
    }
    if (o.kind === 'breaker') {
      if (!s.sab || s.sab.kind !== 'lights' || !p.alive || d > C.USE_R) return;
      s.sab = null; s.sabCdUntil = s.t + C.SAB_CD;
      ev.push({ type: 'fixed', kind: 'lights' });
    }
  }

  function kill(s, pid, a, ev) {
    var p = s.players[pid], v = own(s.players, a) ? s.players[a] : null;
    if (p.role !== 'imp' || !p.alive || p.vent || p.killCd > 0) return;
    if (!v || !v.alive || v.left || v.role === 'imp') return;
    if (dist(p, v) > C.KILL_R) return;
    v.alive = false;
    s.bodies.push({ pid: a, x: v.x, y: v.y });
    p.x = v.x; p.y = v.y; p.killCd = C.KILL_CD;
    ev.push({ type: 'kill', pid: a, by: pid });
    if (v.role === 'pel') release(s, a, ev);
    checkWin(s, ev);
  }

  /* 펠리컨: 가까운 사람을 꿀꺽. 시체가 안 남는다. 다음 회의 때 소화된다. */
  function eat(s, pid, a, ev) {
    var p = s.players[pid], v = own(s.players, a) ? s.players[a] : null;
    if (p.role !== 'pel' || !p.alive || p.eatCd > 0) return;
    if (!v || v === p || !v.alive || v.left || v.vent) return;
    if (dist(p, v) > C.KILL_R) return;
    v.alive = false; v.eaten = pid; v.x = p.x; v.y = p.y;
    p.eatCd = C.EAT_CD; p.eats++;
    ev.push({ type: 'eat', pid: a, by: pid });
    checkWin(s, ev);
  }

  /* 회의 전에 펠리컨이 죽거나 나가면 뱃속 사람이 그 자리에서 살아 나온다 */
  function release(s, pel, ev) {
    var pp = s.players[pel];
    s.order.forEach(function (pid) {
      var q = s.players[pid];
      if (q.eaten !== pel) return;
      q.eaten = null;
      if (q.left) return;
      q.alive = true; q.x = pp.x; q.y = pp.y;
      ev.push({ type: 'spit', pid: pid, by: pel });
    });
  }

  function report(s, pid, a, ev) {
    var p = s.players[pid];
    if (!p.alive || p.vent) return;
    var body = null;
    for (var i = 0; i < s.bodies.length; i++) if (s.bodies[i].pid === a) body = s.bodies[i];
    if (!body || dist(p, body) > C.REPORT_R) return;
    startMeeting(s, pid, a, ev);
  }

  function sabotage(s, pid, a, ev) {
    var p = s.players[pid];
    if (p.role !== 'imp' || p.eaten || s.sab || s.t < s.sabCdUntil) return;
    if (a === 'lights') s.sab = { kind: 'lights' };
    else if (a === 'reactor') s.sab = { kind: 'reactor', until: s.t + C.REACTOR, held: {} };
    else return;
    ev.push({ type: 'sab', kind: a });
  }

  function hold(s, pid, a) {
    if (!s.sab || s.sab.kind !== 'reactor') return;
    var h = s.sab.held, p = s.players[pid];
    if (h.p1 === pid) delete h.p1;
    if (h.p2 === pid) delete h.p2;
    if (a !== 'p1' && a !== 'p2') return;
    if (!p.alive || dist(p, M.center(M.byId(a))) > C.USE_R) return;
    h[a] = pid;
  }

  function vote(s, pid, a, ev) {
    var p = s.players[pid], m = s.meeting;
    if (s.phase !== 'meeting' || !m || m.stage !== 'vote') return;
    if (!p.alive || p.left || m.votes[pid] !== undefined) return;
    if (a !== 'skip') {
      var t = own(s.players, a) ? s.players[a] : null;
      if (!t || !t.alive || t.left) return;
    }
    m.votes[pid] = a;
    ev.push({ type: 'voted', pid: pid });
  }

  function command(s, pid, c, ev) {
    if (!c || typeof c.k !== 'string') return;
    var a = typeof c.a === 'string' ? c.a : '';
    if (c.k === 'vote') { vote(s, pid, a, ev); return; }
    if (s.phase !== 'play') return;
    if (c.k === 'use') use(s, pid, a, ev);
    else if (c.k === 'kill') kill(s, pid, a, ev);
    else if (c.k === 'eat') eat(s, pid, a, ev);
    else if (c.k === 'report') report(s, pid, a, ev);
    else if (c.k === 'sab') sabotage(s, pid, a, ev);
    else if (c.k === 'hold') hold(s, pid, a);
  }

  /* ── 진행 ─────────────────────────────────────────────── */

  function playStep(s, dt, ev) {
    s.order.forEach(function (pid) {
      var p = s.players[pid];
      if (p.left) return;
      if (p.role === 'imp' && p.alive) p.killCd = Math.max(0, p.killCd - dt);
      if (p.role === 'pel' && p.alive) p.eatCd = Math.max(0, p.eatCd - dt);
      if (p.eaten) return;   // 뱃속에선 못 움직인다
      var ix = p.ix, iy = p.iy, m = Math.sqrt(ix * ix + iy * iy);
      if (m > 1) { ix /= m; iy /= m; m = 1; }
      if (p.vent) {
        if (m > 0.3 && s.t - p.ventAt >= C.VENT_EXIT_DELAY) {
          ev.push({ type: 'unvent', pid: pid, id: p.vent });
          p.vent = null;
        }
        return;
      }
      if (m === 0) return;
      var dx = ix * C.SPEED * dt, dy = iy * C.SPEED * dt;
      if (!p.alive) {
        /* 유령은 벽을 통과한다 */
        p.x = clamp(p.x + dx, 0, M.W * M.T);
        p.y = clamp(p.y + dy, 0, M.H * M.T);
        return;
      }
      var r = G.move(M, p.x, p.y, dx, dy, C.R);
      p.x = r.x; p.y = r.y;
    });

    if (s.sab && s.sab.kind === 'reactor') {
      var h = s.sab.held;
      ['p1', 'p2'].forEach(function (k) {
        var hp = h[k] ? s.players[h[k]] : null;
        if (!hp || hp.left || !hp.alive || dist(hp, M.center(M.byId(k))) > C.USE_R) delete h[k];
      });
      if (h.p1 && h.p2 && h.p1 !== h.p2) {
        s.sab = null; s.sabCdUntil = s.t + C.SAB_CD;
        ev.push({ type: 'fixed', kind: 'reactor' });
      } else if (s.t >= s.sab.until) {
        finish(s, 'imp', 'sab', ev);
      }
    }
  }

  function step(s, dt, inputs) {
    var ev = [];
    s.t += dt;
    if (s.phase === 'result') {
      if (!s.ended && s.t >= s.resultUntil) { s.ended = true; ev.push({ type: 'end' }); }
      return ev;
    }
    inputs = inputs || {};
    for (var pid in inputs) {
      if (!own(inputs, pid)) continue;
      var p = own(s.players, pid) ? s.players[pid] : null, inp = inputs[pid];
      if (!p || p.left || !inp) continue;
      p.ix = clamp(num(inp.x), -1, 1);
      p.iy = clamp(num(inp.y), -1, 1);
      var cmds = Array.isArray(inp.cmds) ? inp.cmds : [];
      for (var i = 0; i < cmds.length; i++) {
        command(s, pid, cmds[i], ev);
        if (s.phase === 'result') return ev;
      }
    }
    if (s.phase === 'play') playStep(s, dt, ev);
    else if (s.phase === 'meeting') meetingStep(s, ev);
    return ev;
  }

  function drop(s, pid) {
    var ev = [], p = own(s.players, pid) ? s.players[pid] : null;
    if (!p || p.left) return ev;
    p.left = true; p.alive = false; p.vent = null;
    if (p.role === 'pel' && s.phase === 'play') release(s, pid, ev);
    if (s.meeting) delete s.meeting.votes[pid];
    if (s.phase === 'play' || s.phase === 'meeting') checkWin(s, ev);
    return ev;
  }

  global.Rules = {
    C: C, create: create, step: step, drop: drop, pelGoal: pelGoal,
    progress: progress, counts: counts, tally: tally
  };
})(window);
