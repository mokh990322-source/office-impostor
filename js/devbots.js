/* ============================================================
   모몽어스 — 시험용 봇 (?local&bots=N 일 때만)

   혼자서 한 판을 끝까지 확인하려고 만든 가짜 참가자다. 정식 기능이 아니다.
   방장 탭 안에서 돌고, 방장이 가진 판 상태를 직접 읽어 자기 역할을 안다.
   Firebase 모드(?local 없음)에서는 아무것도 하지 않는다.

   길찾기는 testlib/walker.js 와 같은 알고리즘(칸 격자 너비우선 탐색).
   ============================================================ */
(function (global) {
  'use strict';

  var Q = (global.location && global.location.search) || '';
  var M = global.OfficeMap, R = global.Rules, C = R.C, G = global.Geom;
  var enabled = !!(global.Net && global.Net.isLocal);
  var m = /[?&]bots=(\d+)/.exec(Q);
  var COUNT = enabled && m ? Math.max(0, Math.min(9, +m[1])) : 0;

  var bots = [], hb = null, path = '', started = false;
  var LINES = ['저 계속 탕비실에 있었어요', '복사실 쪽에서 누가 뛰어가던데요?', '저는 렌더 걸고 있었어요',
    '잘 모르겠어요… 건너뛰죠', '서버실 근처가 수상해요', '저 진짜 일만 했어요', '아까 대표실에서 혼자 있던 사람 누구죠?'];

  function rand(a) { return a[Math.floor(Math.random() * a.length)]; }

  function route(from, target, range) {
    var T = M.T, sx = Math.floor(from.x / T), sy = Math.floor(from.y / T);
    var prev = {}, q = [[sx, sy]], end = null;
    prev[sy * M.W + sx] = -1;
    while (q.length) {
      var cur = q.shift(), x = cur[0], y = cur[1];
      if (Math.hypot((x + 0.5) * T - target.x, (y + 0.5) * T - target.y) <= range) { end = cur; break; }
      [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d) {
        var nx = x + d[0], ny = y + d[1], k = ny * M.W + nx;
        if (prev[k] !== undefined || M.solid(nx, ny)) return;
        prev[k] = y * M.W + x; q.push([nx, ny]);
      });
    }
    if (!end) return [];
    var pts = [];
    for (var k = end[1] * M.W + end[0]; k !== -1; k = prev[k]) pts.push({ x: (k % M.W + 0.5) * T, y: (Math.floor(k / M.W) + 0.5) * T });
    pts.reverse(); pts.shift();
    return pts;
  }

  function steer(p, pts) {
    while (pts.length && Math.hypot(pts[0].x - p.x, pts[0].y - p.y) < 6) pts.shift();
    if (!pts.length) return { x: 0, y: 0 };
    var dx = pts[0].x - p.x, dy = pts[0].y - p.y, d = Math.hypot(dx, dy);
    return { x: dx / d, y: dy / d };
  }

  function start(ctx) {
    if (!COUNT || started) return;
    started = true; path = ctx.path;
    var used = ctx.used.slice();
    var chain = Promise.resolve();
    for (var i = 1; i <= COUNT; i++) {
      (function (i) {
        chain = chain.then(function () { return global.Roles.makeKeys(); }).then(function (keys) {
          var color = 0; while (used.indexOf(color) >= 0 && color < 9) color++;
          used.push(color);
          var b = { pid: 'bot' + i, name: '봇' + i, color: color, join: Date.now() + i, pub: keys.pub, brain: {} };
          bots.push(b);
          return global.Net.put(path + '/who/' + b.pid, who(b));
        });
      })(i);
    }
    hb = setInterval(function () {
      bots.forEach(function (b) { global.Net.put(path + '/who/' + b.pid, who(b)); });
    }, 2000);
  }
  function who(b) { return { name: b.name, color: b.color, join: b.join, seen: Date.now(), pub: b.pub }; }

  function stop() {
    if (hb) clearInterval(hb); hb = null;
    bots.forEach(function (b) { global.Net.del(path + '/who/' + b.pid); });
    bots = []; started = false;
  }

  function isBot(pid) { return /^bot\d+$/.test(pid); }

  /* 매 틱 방장 루프가 부른다. inputs 에 봇 입력을 채운다. hooks.chat(pid, text) */
  function tick(s, dt, inputs, hooks) {
    if (!COUNT || !s) return;
    bots.forEach(function (b, idx) {
      var p = s.players[b.pid];
      if (!p || p.left) return;
      var br = b.brain, cmds = [];
      var inp = { x: 0, y: 0, cmds: cmds };
      inputs[b.pid] = inp;
      br.t = (br.t || 0) + dt;

      if (s.phase === 'meeting' && s.meeting) {
        var mt = s.meeting;
        var key = mt.by + ':' + Math.round(mt.until - (mt.stage === 'talk' ? C.TALK : 0));
        if (br.meet !== mt.by + (mt.body || '')) {
          br.meet = mt.by + (mt.body || '');
          br.chatAt = br.t + 3 + Math.random() * 12;
          br.voteDelay = 2 + Math.random() * 6;
          br.said = false; br.voteAt = null;
        }
        void key;
        if (mt.stage === 'talk' && !br.said && br.t >= br.chatAt && p.alive) { br.said = true; hooks.chat(b.pid, rand(LINES), !p.alive); }
        if (mt.stage === 'vote' && p.alive && mt.votes[b.pid] === undefined) {
          if (br.voteAt === null) br.voteAt = br.t + br.voteDelay;
          if (br.t >= br.voteAt) {
            var alive = s.order.filter(function (q) { return q !== b.pid && s.players[q].alive && !s.players[q].left; });
            var target = (p.role === 'crew' && Math.random() < 0.5 && alive.length) ? rand(alive) : 'skip';
            cmds.push({ k: 'vote', a: target });
          }
        }
        br.path = null;
        return;
      }
      if (s.phase !== 'play') return;

      function go(target, range) {
        if (!br.path || br.goalKey !== target.x + ',' + target.y) { br.path = route(p, target, range); br.goalKey = target.x + ',' + target.y; }
        if (Math.hypot(p.x - target.x, p.y - target.y) <= range) return true;
        var v = steer(p, br.path);
        if (!v.x && !v.y) { br.path = null; return Math.hypot(p.x - target.x, p.y - target.y) <= range + 10; }
        inp.x = v.x; inp.y = v.y;
        return false;
      }

      /* 사보타주 고치기: 산 봇 중 앞 번호가 맡는다 */
      if (s.sab && p.alive) {
        var aliveBots = bots.filter(function (x) { var q = s.players[x.pid]; return q && q.alive && !q.left; });
        var rank = aliveBots.indexOf(b);
        if (s.sab.kind === 'lights' && rank === 0) {
          var bk = M.center(M.byId('breaker'));
          if (go(bk, C.USE_R - 12)) cmds.push({ k: 'use', a: 'breaker' });
          return;
        }
        if (s.sab.kind === 'reactor' && (rank === 0 || rank === 1)) {
          var pid2 = rank === 0 ? 'p1' : 'p2', pc = M.center(M.byId(pid2));
          if (go(pc, C.USE_R - 12)) {
            if (s.sab.held[pid2] !== b.pid && (!br.holdAt || br.t - br.holdAt > 0.5)) { br.holdAt = br.t; cmds.push({ k: 'hold', a: pid2 }); }
          }
          return;
        }
      }

      if (p.role === 'imp') {
        if (p.alive && p.killCd <= 0 && !p.vent) {
          var victim = null;
          s.order.forEach(function (q) {
            var v = s.players[q];
            if (q === b.pid || !v.alive || v.left || v.role === 'imp') return;
            if (Math.hypot(v.x - p.x, v.y - p.y) > C.KILL_R) return;
            var witnesses = s.order.filter(function (w) {
              var o = s.players[w];
              return w !== q && w !== b.pid && o.alive && !o.left && o.role === 'crew' && G.canSee(M, o.x, o.y, p.x, p.y, C.VISION_CREW);
            });
            if (!witnesses.length) victim = q;
          });
          if (victim) { cmds.push({ k: 'kill', a: victim }); br.path = null; return; }
        }
        if (s.t > (br.sabAt || 40) && !s.sab && s.t >= s.sabCdUntil && Math.random() < 0.002) {
          br.sabAt = s.t + 40;
          cmds.push({ k: 'sab', a: Math.random() < 0.7 ? 'lights' : 'reactor' });
        }
        if (p.vent) {
          if (!br.ventMoved) { br.ventMoved = true; cmds.push({ k: 'use', a: M.ventPair(p.vent) }); }
          else if (br.t - (br.ventT || 0) > 1.2) { inp.x = 1; br.goal = null; }
          return;
        }
        if (!br.goal || go(br.goal.c, br.goal.r)) {
          if (br.goal && br.goal.vent && p.alive) { cmds.push({ k: 'use', a: br.goal.vent }); br.ventMoved = false; br.ventT = br.t; br.goal = null; return; }
          var useVent = Math.random() < 0.25;
          var vents = M.objects.filter(function (o) { return o.kind === 'vent'; });
          var o = useVent ? rand(vents) : M.byId(rand(M.stationIds()));
          br.goal = { c: M.center(o), r: useVent ? C.VENT_R - 12 : 40, vent: useVent ? o.id : null };
          br.path = null;
        }
        return;
      }

      /* 펠리컨: 보는 사람이 없으면 가까운 사람을 꿀꺽, 아니면 서성이기 */
      if (p.role === 'pel' && p.alive && p.eatCd <= 0) {
        var prey = null;
        s.order.forEach(function (q) {
          var v = s.players[q];
          if (q === b.pid || !v.alive || v.left || v.vent) return;
          if (Math.hypot(v.x - p.x, v.y - p.y) > C.KILL_R) return;
          var seen = s.order.some(function (w) {
            var o = s.players[w];
            return w !== q && w !== b.pid && o.alive && !o.left && G.canSee(M, o.x, o.y, p.x, p.y, C.VISION_CREW);
          });
          if (!seen) prey = q;
        });
        if (prey) { cmds.push({ k: 'eat', a: prey }); return; }
      }
      if (p.eaten) return;

      /* 직원: 보이는 시체 신고 → 남은 임무 → 서성이기 */
      if (p.alive) {
        for (var i = 0; i < s.bodies.length; i++) {
          var bd = s.bodies[i];
          if (G.canSee(M, p.x, p.y, bd.x, bd.y, C.VISION_CREW)) {
            if (go(bd, C.REPORT_R - 10)) cmds.push({ k: 'report', a: bd.pid });
            return;
          }
        }
      }
      var todo = p.tasks.filter(function (id) { return !p.done[id]; });
      if (todo.length) {
        var tid = todo[0], c = M.center(M.byId(tid));
        if (go(c, C.USE_R - 12)) {
          if (!br.workAt) br.workAt = br.t;
          if (br.t - br.workAt > 4) { cmds.push({ k: 'use', a: tid }); br.workAt = 0; }
        } else br.workAt = 0;
        return;
      }
      if (!br.goal || go(br.goal.c, 40)) { br.goal = { c: M.center(M.byId(rand(M.stationIds()))) }; br.path = null; }
      void idx;
    });
  }

  global.DevBots = { COUNT: COUNT, start: start, stop: stop, tick: tick, isBot: isBot };
})(window);
