/* ============================================================
   사무실 임포스터 — 조립

   첫 화면 → 대기실 → 게임 → 회의 → 결과 → 대기실.

   ── 방장과 참가자 ───────────────────────────────────────
   방장 탭: Rules 로 판을 계산하고 0.1초마다 st 를 올린다. 참가자의
   입력은 in/<pid> 를 지켜보다가 n(명령 번호)이 바뀔 때마다 대기열에 넣는다.
   참가자 탭: 입력과 명령만 in/<pid> 에 쓰고, st 를 받아 그린다.
   내 캐릭터는 먼저 움직이고(예측) 방장 값으로 천천히 당긴다.

   ── 비밀 ────────────────────────────────────────────────
   내 역할·임무는 sec/<pid> 봉투를 열어서만 안다(roles.js).
   st 에는 역할이 없으므로 화면은 내 봉투 + st 만으로 그린다.

   ── 시험 옵션 (?local 일 때만) ──────────────────────────
   ?local       Firebase 대신 같은 브라우저 탭끼리 (localnet.js)
   &bots=N      방장 탭 안에 가짜 참가자 N명 (devbots.js)
   &min=N       최소 인원을 N명으로 (기본 4)
   &me=imp      방장을 임포스터로 고정
   ============================================================ */
(function (global) {
  'use strict';

  var M = global.OfficeMap, R = global.Rules, C = R.C, G = global.Geom, UI = global.UI;
  var Net = global.Net, Room = global.Room, Roles = global.Roles, Snap = global.Snap;
  var Q = (global.location && global.location.search) || '';
  var LOCAL = !!Net.isLocal;
  function qnum(name, d) { var m = new RegExp('[?&]' + name + '=(\\d+)').exec(Q); return m ? +m[1] : d; }
  var MIN_PLAYERS = LOCAL ? Math.max(1, qnum('min', 4)) : 4;
  var FORCE_IMP = LOCAL && /[?&]me=imp\b/.test(Q);
  var DevBots = global.DevBots;

  var $ = function (id) { return document.getElementById(id); };
  var screenEl, hudEl, layerEl, netEl, canvas;

  function rand8() { var s = ''; for (var i = 0; i < 8; i++) s += 'abcdefghijkmnpqrstuvwxyz23456789'.charAt(Math.floor(Math.random() * 32)); return s; }

  var S = {
    pid: 'p' + rand8(), keys: null, name: '', color: 0, join: 0,
    code: '', path: '', room: {}, watch: null, hb: null, claimTimer: null,
    seenAt: {}, seenVal: {}, lastTick: null, lastChangeMs: 0, lastEventMs: 0, claimedAtMs: 0,
    screen: 'title', lobbyKey: '',
    /* 방장 */
    state: null, inputs: {}, queues: {}, lastN: {}, lastPhase: null, sendAt: 0, dropAt: 0, hostLast: 0, myCmds: [],
    /* 참가자 공통 */
    box: null, boxBusy: false, boxFailed: false, buf: null, st: null, me: null, n: 0, lastK: '', lastA: '',
    sentX: 0, sentY: 0, sentAt: 0, myIn: { x: 0, y: 0 }, doneLocal: {}, holding: '', holdKey: false, holdToggle: false,
    killReadyAt: 0, sabReadyAt: 0, prevSb: null, prevPh: null, wasAlive: true, menu: false,
    banner: null, bannerUntil: 0, near: null, killTarget: null, reportTarget: null,
    ejectShown: false, resultShown: false, meetingKey: '', killSentAt: 0, killBodies: 0, lastFrame: 0
  };
  var keys = {};

  /* ── 공용 ─────────────────────────────────────────────── */

  function isHost() { return !!(S.room && S.room.meta && S.room.meta.host === S.pid); }
  function meta() { return (S.room && S.room.meta) || {}; }
  function who() { return (S.room && S.room.who) || {}; }
  function nameOf(pid) { var w = who()[pid]; if (w) return w.name; if (S.state && S.state.players[pid]) return S.state.players[pid].name; return '누군가'; }
  function colorOf(pid) { var w = who()[pid]; if (w) return w.color; if (S.state && S.state.players[pid]) return S.state.players[pid].color; return 0; }
  function nowMs() { return Date.now(); }

  function setNet(kind, text) {
    netEl.className = kind;
    netEl.lastChild.textContent = text;
  }

  /* ── 첫 화면 ──────────────────────────────────────────── */

  function showTitle() {
    S.screen = 'title';
    Hud.hide(); global.Meeting.close(); global.Meeting.hideResult(); global.Tasks.close();
    View.clear();
    var name = '';
    try { name = global.localStorage.getItem('oi_name') || ''; } catch (e) { /* 저장 불가 */ }
    global.Lobby.title(screenEl, {
      name: name,
      onCreate: createRoom,
      onJoin: joinRoom,
      localNote: LOCAL ? '로컬 시험 모드: 이 브라우저의 탭끼리만 연결돼요.' + (DevBots.COUNT ? ' 방을 만들면 봇 ' + DevBots.COUNT + '명이 들어와요.' : '') : ''
    });
  }

  function remember(name) { S.name = name; try { global.localStorage.setItem('oi_name', name); } catch (e) { /* 무시 */ } }

  function createRoom(name) {
    remember(name);
    var tries = 0;
    function attempt() {
      var code = Room.makeCode();
      return Net.get('crew/' + code + '/meta').then(function (m) {
        if (m && ++tries < 8) return attempt();
        return Net.put('crew/' + code + '/meta', { host: S.pid, phase: 'lobby', imp: 1, born: nowMs() }).then(function (r) {
          if (!r.ok) return 'Firebase 에 방을 못 만들었어요. 규칙(crew/)이 게시됐는지 확인하세요. (코드 ' + r.status + ')';
          return enter(code);
        });
      });
    }
    return attempt();
  }

  function joinRoom(name, raw) {
    remember(name);
    var code = Room.cleanCode(raw || '');
    if (!code) return Promise.resolve('그런 방 코드가 없어요. 대문자와 숫자 4자리인지 확인하세요.');
    return Net.get('crew/' + code + '/meta').then(function (m) {
      if (!m) return '그런 방 코드가 없어요. 대문자와 숫자 4자리인지 확인하세요.';
      return enter(code);
    });
  }

  function enter(code) {
    S.code = code; S.path = 'crew/' + code;
    S.seenAt = {}; S.seenVal = {}; S.lastTick = null; S.claimedAtMs = 0; S.lobbyKey = '';
    return Net.get(S.path + '/who').then(function (w) {
      var used = [];
      for (var k in (w || {})) if (Object.prototype.hasOwnProperty.call(w, k) && w[k]) used.push(w[k].color);
      S.color = 0; while (used.indexOf(S.color) >= 0 && S.color < 9) S.color++;
      S.join = nowMs();
      return heartbeat();
    }).then(function () {
      S.screen = 'lobby';
      S.watch = Net.watch(S.path, onRoom, function () { if (!LOCAL) setNet('retry', '다시 연결 중'); });
      S.hb = setInterval(heartbeat, 2000);
      S.claimTimer = setInterval(claimCheck, 500);
      return null;
    });
  }

  function heartbeat() {
    return Net.put(S.path + '/who/' + S.pid, { name: S.name, color: S.color, join: S.join, seen: nowMs(), pub: S.keys.pub });
  }

  function leave() {
    if (S.watch) S.watch.close();
    clearInterval(S.hb); clearInterval(S.claimTimer);
    S.watch = null;
    if (S.path) Net.del(S.path + '/who/' + S.pid);
    if (DevBots) DevBots.stop();
    S.state = null; S.room = {}; S.code = ''; S.path = '';
    showTitle();
  }

  /* ── 방 상태 수신 ─────────────────────────────────────── */

  function onRoom(state) {
    S.room = state || {};
    S.lastEventMs = nowMs();
    if (!LOCAL) setNet('ok', global.LAN_MODE ? '사내망 연결됨' : '연결됨');
    var w = who(), k;
    for (k in w) {
      if (!Object.prototype.hasOwnProperty.call(w, k) || !w[k]) continue;
      if (w[k].seen !== S.seenVal[k]) { S.seenVal[k] = w[k].seen; S.seenAt[k] = nowMs(); }
    }
    var st = S.room.st;
    if (st && st.t !== S.lastTick) {
      S.lastTick = st.t; S.lastChangeMs = nowMs();
      if (!isHost()) { var us = Snap.unpack(st); S.st = us; if (S.buf) S.buf.push(performance.now() / 1000, us); }
    }
    if (!st) S.lastTick = null;
    if (isHost() && S.state) readInputs();

    var ph = meta().phase;
    if (!ph) return;
    if (ph === 'lobby') {
      if (S.screen !== 'lobby') toLobby();
      renderLobby();
      if (isHost() && DevBots && DevBots.COUNT) DevBots.start({ path: S.path, used: usedColors() });
    } else if (S.screen === 'lobby') {
      enterGame();
    }
  }

  function readInputs() {
    var ins = S.room.in || {};
    for (var pid in ins) {
      if (!Object.prototype.hasOwnProperty.call(ins, pid) || !ins[pid]) continue;
      var inp = ins[pid];
      S.inputs[pid] = { x: +inp.x || 0, y: +inp.y || 0 };
      var n = +inp.n || 0;
      if (n !== (S.lastN[pid] || 0)) {
        S.lastN[pid] = n;
        (S.queues[pid] = S.queues[pid] || []).push({ k: String(inp.k || ''), a: String(inp.a || '') });
      }
    }
  }

  function claimCheck() {
    if (!S.path || !meta().host) return;
    if (!LOCAL && nowMs() - S.lastEventMs > 7000) setNet('retry', '다시 연결 중');
    var r = Room.shouldClaim({
      me: S.pid, host: meta().host, who: who(), nowMs: nowMs(), seenAt: S.seenAt,
      lastTick: S.lastTick, lastChangeMs: S.lastChangeMs, lastEventMs: S.lastEventMs, claimedAtMs: S.claimedAtMs
    });
    if (r === 'claim') { S.claimedAtMs = nowMs(); Net.put(S.path + '/meta/host', S.pid); return; }
    if (S.claimedAtMs && r !== 'wait') {
      S.claimedAtMs = 0;
      if (isHost() && meta().phase !== 'lobby' && !S.state) {
        UI.toast('방장이 나가서 판을 끝냈어요. 대기실로 돌아갑니다.');
        backToLobby();
      }
    }
  }

  /* ── 대기실 ──────────────────────────────────────────── */

  function aliveList() {
    var list = Room.alive(who(), nowMs(), S.seenAt);
    if (list.indexOf(S.pid) < 0 && who()[S.pid]) list.unshift(S.pid);
    return list;
  }
  function usedColors() { var w = who(), out = []; aliveList().forEach(function (p) { if (w[p]) out.push(w[p].color); }); return out; }

  function toLobby() {
    S.screen = 'lobby'; S.state = null; S.box = null; S.lobbyKey = '';
    Hud.hide(); global.Meeting.close(); global.Meeting.hideResult(); global.Tasks.close();
    View.clear();
  }

  function renderLobby() {
    if (S.screen !== 'lobby') return;
    var w = who(), list = aliveList(), host = meta().host;
    var n = list.length, impMax = Roles.impLimit(n), imp = Math.min(meta().imp || 1, 2);
    var v = {
      code: S.code, isHost: isHost(), imp: imp, impMax: impMax, myColor: S.color,
      used: usedColors(),
      who: list.filter(function (p) { return w[p]; }).map(function (p) { return { pid: p, name: w[p].name, color: w[p].color, host: p === host, me: p === S.pid }; }),
      canStart: isHost() && n >= MIN_PLAYERS,
      why: n < MIN_PLAYERS ? MIN_PLAYERS + '명 이상 모여야 시작할 수 있어요 (지금 ' + n + '명)' :
        (imp > impMax ? '7명 미만이면 임포스터는 1명이에요.' : '')
    };
    var key = JSON.stringify(v);
    if (key === S.lobbyKey) return;
    S.lobbyKey = key;
    global.Lobby.room(screenEl, v, {
      onColor: function (c) { if (v.used.indexOf(c) >= 0 && c !== S.color) return; S.color = c; heartbeat(); },
      onImp: function (k) { if (isHost()) Net.put(S.path + '/meta/imp', k); },
      onStart: startGame,
      onLeave: leave
    });
  }

  function startGame() {
    if (!isHost() || S.state) return;
    var w = who(), list = aliveList().filter(function (p) { return w[p] && w[p].pub; });
    if (list.length < MIN_PLAYERS) return;
    var nImp = Math.min(meta().imp || 1, Roles.impLimit(list.length));
    var roles = Roles.pick(list, nImp);
    if (FORCE_IMP && roles[S.pid] !== 'imp') {
      var other = list.filter(function (p) { return roles[p] === 'imp'; })[0];
      if (other) roles[other] = 'crew';
      roles[S.pid] = 'imp';
    }
    var tasks = {};
    list.forEach(function (p) { tasks[p] = Roles.pickTasks(M.stationIds(), C.TASKS_PER_PLAYER); });
    var P = S.path;
    Promise.all([Net.del(P + '/st'), Net.del(P + '/sec'), Net.del(P + '/chat'), Net.del(P + '/in')]).then(function () {
      return Promise.all(list.map(function (p) {
        var mates = list.filter(function (q) { return roles[q] === 'imp' && q !== p; });
        var box = { r: roles[p], t: tasks[p], m: roles[p] === 'imp' ? mates : [] };
        if (p === S.pid) { S.box = box; return null; }
        return Roles.seal(S.keys.priv, w[p].pub, box).then(function (sealed) { return Net.put(P + '/sec/' + p, sealed); });
      }));
    }).then(function () {
      S.state = R.create(list.map(function (p) { return { pid: p, name: w[p].name, color: w[p].color }; }), roles, tasks);
      S.inputs = {}; S.queues = {}; S.lastN = {}; S.myCmds = []; S.lastPhase = 'play'; S.hostLast = performance.now() / 1000;
      return Net.put(P + '/meta/phase', 'play');
    });
  }

  function backToLobby() {
    S.state = null;
    var P = S.path;
    Promise.all([Net.del(P + '/st'), Net.del(P + '/sec'), Net.del(P + '/chat'), Net.del(P + '/in')]).then(function () {
      return Net.put(P + '/meta/phase', 'lobby');
    });
  }

  /* ── 게임 시작 (모두) ─────────────────────────────────── */

  function enterGame() {
    S.screen = 'game';
    UI.clear(screenEl);
    if (!isHost()) S.box = null;
    S.boxBusy = false; S.boxFailed = false;
    S.buf = new global.Interp.Buffer(); S.st = null; S.me = null;
    S.n = 0; S.lastK = ''; S.lastA = ''; S.sentAt = 0;
    S.doneLocal = {}; S.holding = ''; S.holdToggle = false; S.menu = false;
    S.killReadyAt = nowMs() + C.KILL_CD * 1000; S.sabReadyAt = nowMs() + C.SAB_FIRST * 1000;
    S.prevSb = null; S.prevPh = 'play'; S.wasAlive = true; S.banner = null; S.bannerUntil = 0;
    S.ejectShown = false; S.resultShown = false; S.meetingKey = '';
    if (S.box) roleBanner();
    Hud.init(hudEl, {
      use: onUse, kill: onKill, report: onReport,
      sabMenu: function () { S.menu = !S.menu; },
      sab: function (k) { S.menu = false; sendCmd('sab', k); S.sabReadyAt = nowMs() + 999999; }
    });
    if (!isHost()) Net.put(S.path + '/in/' + S.pid, { x: 0, y: 0, n: 0, k: '', a: '' });
  }

  function roleBanner() {
    var imp = S.box && S.box.r === 'imp';
    S.banner = imp
      ? { title: '임포스터', sub: '들키지 말고 직원을 줄이세요. Q 킬 · Tab 사보타주', color: '#ff4d4d' }
      : { title: '직원', sub: '업무를 끝내고 임포스터를 찾아내세요. E 사용 · R 신고', color: '#7fd3ff' };
    S.bannerUntil = nowMs() + 3500;
  }

  /* ── 입력 ─────────────────────────────────────────────── */

  function sendCmd(k, a) {
    if (isHost()) { S.myCmds.push({ k: k, a: a || '' }); return; }
    S.n++; S.lastK = k; S.lastA = a || '';
    Net.put(S.path + '/in/' + S.pid, { x: S.myIn.x, y: S.myIn.y, n: S.n, k: S.lastK, a: S.lastA });
    S.sentAt = performance.now();
  }

  function sendMove(x, y) {
    if (isHost()) return;
    var t = performance.now();
    if (x === S.sentX && y === S.sentY && t - S.sentAt < 400) return;
    if ((x !== S.sentX || y !== S.sentY) && t - S.sentAt < 50) return;
    S.sentX = x; S.sentY = y; S.sentAt = t;
    Net.put(S.path + '/in/' + S.pid, { x: x, y: y, n: S.n, k: S.lastK, a: S.lastA });
  }

  function moveVector() {
    var x = 0, y = 0;
    if (keys.KeyA || keys.ArrowLeft) x -= 1;
    if (keys.KeyD || keys.ArrowRight) x += 1;
    if (keys.KeyW || keys.ArrowUp) y -= 1;
    if (keys.KeyS || keys.ArrowDown) y += 1;
    if (x && y) { x *= Math.SQRT1_2; y *= Math.SQRT1_2; }
    return { x: Math.round(x * 1000) / 1000, y: Math.round(y * 1000) / 1000 };
  }

  function typing(e) { var t = e.target; return t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA'); }

  function onKeyDown(e) {
    if (typing(e)) return;
    if (S.screen !== 'game') return;
    if (e.code === 'Tab') { e.preventDefault(); if (S.box && S.box.r === 'imp') S.menu = !S.menu; return; }
    if (e.repeat) { keys[e.code] = true; return; }
    keys[e.code] = true;
    if (global.Tasks.isOpen()) return;
    if (e.code === 'KeyE' || e.code === 'Space') { e.preventDefault(); if (S.near && S.near.kind === 'panel') S.holdKey = true; else onUse(); }
    else if (e.code === 'KeyQ') onKill();
    else if (e.code === 'KeyR') onReport();
  }
  function onKeyUp(e) {
    keys[e.code] = false;
    if (e.code === 'KeyE' || e.code === 'Space') S.holdKey = false;
  }

  function onUse() {
    var n = S.near;
    if (!n || !n.on) return;
    if (n.kind === 'task') { openTask(n.id, n.type); return; }
    if (n.kind === 'panel') { S.holdToggle = !S.holdToggle; return; }
    sendCmd('use', n.id);
  }

  function openTask(id, type) {
    var role = S.box && S.box.r;
    global.Tasks.open(type, layerEl).then(function (res) {
      if (res !== 'done') return;
      S.doneLocal[id] = true;
      if (role === 'crew') sendCmd('use', id);
    });
  }

  function onKill() { if (S.killTarget) { sendCmd('kill', S.killTarget); S.killSentAt = nowMs(); S.killBodies = S.lastBodies || 0; } }
  function onReport() { if (S.reportTarget) sendCmd('report', S.reportTarget); }

  function sendChat(text) {
    var st = S.frameSt, me = st && st.p[S.pid];
    var ghost = !(me && me[2] === 1);
    Net.put(S.path + '/chat/' + nowMs() + '_' + S.pid, { p: S.pid, m: text, t: nowMs(), g: ghost });
  }

  /* ── 방장 틱 ─────────────────────────────────────────── */

  function hostTick() {
    var s = S.state;
    if (!s) return;
    var t = performance.now() / 1000, elapsed = Math.min(1, Math.max(0, t - S.hostLast));
    S.hostLast = t;
    /* 탭이 잠깐 멈췄다 돌아오면 밀린 시간을 0.05초씩 나눠 따라잡는다.
       한 번에 큰 dt 를 넣으면 벽을 뚫거나 쿨다운이 한꺼번에 끝난다. */
    while (elapsed > 1e-4 && S.state) {
      var dt = Math.min(0.05, elapsed);
      elapsed -= dt;
      hostStep(dt, t);
    }
  }

  function hostStep(dt, t) {
    var s = S.state;
    var inputs = {};
    s.order.forEach(function (pid) {
      var b = S.inputs[pid] || { x: 0, y: 0 };
      inputs[pid] = { x: b.x, y: b.y, cmds: S.queues[pid] || [] };
    });
    S.queues = {};
    inputs[S.pid] = { x: S.myIn.x, y: S.myIn.y, cmds: S.myCmds };
    S.myCmds = [];
    if (DevBots && DevBots.COUNT) DevBots.tick(s, dt, inputs, { chat: function (pid, m, g) { Net.put(S.path + '/chat/' + nowMs() + '_' + pid, { p: pid, m: m, t: nowMs(), g: !!g }); } });

    var ev = [];
    if (t - S.dropAt > 1) {
      S.dropAt = t;
      var alive = Room.alive(who(), nowMs(), S.seenAt);
      s.order.forEach(function (pid) {
        if (pid === S.pid || s.players[pid].left || DevBots.isBot(pid)) return;
        if (alive.indexOf(pid) < 0) ev = ev.concat(R.drop(s, pid));
      });
    }
    ev = ev.concat(R.step(s, dt, inputs));
    ev.forEach(function (e) {
      if (e.type === 'meeting') Net.del(S.path + '/chat');
      if (e.type === 'end') { backToLobby(); }
    });
    if (!S.state) return;
    if (s.phase !== S.lastPhase) { S.lastPhase = s.phase; Net.put(S.path + '/meta/phase', s.phase); }
    if (t - S.sendAt >= 0.1) { S.sendAt = t; Net.put(S.path + '/st', Snap.pack(s)); }
  }

  /* ── 매 프레임 (모두) ─────────────────────────────────── */

  function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }

  function gameFrame(dt) {
    var host = isHost();
    var st = host && S.state ? Snap.pack(S.state) : S.st;
    S.frameSt = st;
    var nowS = performance.now() / 1000, now = nowMs();
    var box = S.box, role = box ? box.r : null;

    if (!host && !box && !S.boxBusy && !S.boxFailed && S.room.sec && S.room.sec[S.pid]) {
      var hostW = who()[meta().host];
      if (hostW && hostW.pub) {
        S.boxBusy = true;
        Roles.open(S.keys.priv, hostW.pub, S.room.sec[S.pid]).then(function (b) {
          S.boxBusy = false;
          if (b) { S.box = b; roleBanner(); }
          else { S.boxFailed = true; UI.toast('역할을 못 받았어요. 새로고침 후 다시 들어오세요.', 6000); }
        });
      }
    }

    if (!st) { View.clear(); Hud.render({ wait: '판을 준비하는 중…' }); return; }
    var myP = st.p[S.pid];
    if (!myP) {
      /* 판에서 빠졌다(나갔다 처리됨). 회의·미니게임 창이 열려 있으면 얼어붙은 채 남으니 닫는다. */
      if (global.Meeting.isOpen()) global.Meeting.close();
      global.Tasks.close();
      View.clear();
      Hud.render({ wait: st.ph === 'result' ? '판이 끝났어요. 곧 대기실로 돌아가요.' : '게임이 진행 중이에요. 다음 판부터 함께해요.' });
      return;
    }
    var alive = myP[2] === 1, inVent = myP[3] === 1;

    /* 이동 입력 */
    var playing = st.ph === 'play';
    var inp = (!playing || global.Tasks.isOpen() || global.Meeting.isOpen()) ? { x: 0, y: 0 } : moveVector();
    S.myIn = inp;
    sendMove(inp.x, inp.y);

    /* 내 위치: 방장은 판 값 그대로, 참가자는 예측 + 보정 */
    var server = { x: myP[0], y: myP[1] };
    if (host) S.me = { x: S.state.players[S.pid].x, y: S.state.players[S.pid].y };
    else {
      if (!S.me) S.me = { x: server.x, y: server.y };
      if (playing && !inVent && (inp.x || inp.y)) {
        var dx = inp.x * C.SPEED * dt, dy = inp.y * C.SPEED * dt;
        if (alive) S.me = G.move(M, S.me.x, S.me.y, dx, dy, C.R);
        else S.me = { x: S.me.x + dx, y: S.me.y + dy };
      }
      var moving = !!(inp.x || inp.y);
      S.stillFor = moving ? 0 : (S.stillFor || 0) + dt;
      if (inVent || !playing) S.me = { x: server.x, y: server.y };
      else S.me = global.Interp.reconcile(S.me, server, moving, S.stillFor, dt);
    }

    /* 남들 위치 */
    var others = [], ref = st;
    var sample = (!host && S.buf) ? S.buf.sample(nowS) : null;
    Object.keys(st.p).forEach(function (pid) {
      if (pid === S.pid) return;
      var p = st.p[pid], pos = { x: p[0], y: p[1] };
      if (sample && sample.a.p && sample.b.p && sample.a.p[pid] && sample.b.p[pid]) pos = global.Interp.between(sample.a.p[pid], sample.b.p[pid], sample.k);
      others.push({ pid: pid, x: pos.x, y: pos.y, alive: p[2] === 1, vent: p[3] === 1, color: colorOf(pid), name: nameOf(pid),
        red: role === 'imp' && box && box.m.indexOf(pid) >= 0 });
    });
    void ref;
    var bodies = (st.b || []).map(function (b) { return { pid: b[0], x: b[1], y: b[2], color: colorOf(b[0]) }; });
    S.lastBodies = bodies.length;

    /* 시야 */
    var sb = st.sb || null;
    var vision = !alive ? Infinity : role === 'imp' ? C.VISION_IMP : (sb && sb.k === 'lights' ? C.VISION_LIGHTS : C.VISION_CREW);
    function visible(x, y) { return !isFinite(vision) || G.canSee(M, S.me.x, S.me.y, x, y, vision + 20); }

    /* 쿨다운 추정 (참가자) */
    if (S.prevSb && !sb) S.sabReadyAt = now + C.SAB_CD * 1000;
    S.prevSb = sb;
    if (S.prevPh === 'meeting' && st.ph === 'play') S.killReadyAt = now + C.KILL_CD * 1000;
    if (S.killSentAt && now - S.killSentAt < 1500 && bodies.length > S.killBodies) { S.killReadyAt = now + C.KILL_CD * 1000; S.killSentAt = 0; }
    var killCd, sabCd;
    if (host && S.state) {
      killCd = S.state.players[S.pid].killCd;
      sabCd = Math.max(0, S.state.sabCdUntil - S.state.t);
    } else {
      killCd = Math.max(0, (S.killReadyAt - now) / 1000);
      sabCd = Math.max(0, (S.sabReadyAt - now) / 1000);
    }

    /* 가까운 물건 */
    var near = null;
    function consider(o, range, label, on) {
      var c = M.center(o), d = o.kind === 'button' ? M.tableDist(S.me.x, S.me.y) : dist(S.me, c);
      if (d <= range && (!near || d < near.d)) near = { id: o.id, kind: o.kind, type: o.type, label: label, on: on, d: d };
    }
    var myTasks = {};
    if (box) box.t.forEach(function (id) { if (!S.doneLocal[id] && !(host && S.state.players[S.pid].done[id])) myTasks[id] = true; });
    if (playing) {
      if (inVent) {
        var cur = null;
        M.objects.forEach(function (o) { if (o.kind === 'vent' && dist(M.center(o), server) < 6) cur = o; });
        if (cur) { var pr = M.byId(M.ventPair(cur.id)); near = { id: pr.id, kind: 'vent', label: '환풍구 이동', on: true, d: 0 }; }
      } else {
        M.objects.forEach(function (o) {
          if (o.kind === 'task' && myTasks[o.id]) consider(o, C.USE_R, global.Tasks.kinds[o.type] ? '임무' : '사용', true);
          else if (o.kind === 'button' && alive) {
            var ok = st.bc === 0 && myP[4] > 0 && !(sb && sb.k === 'reactor');
            consider(o, C.BTN_R, myP[4] <= 0 ? '버튼 다 씀' : st.bc > 0 ? '긴급 회의 ' + st.bc : '긴급 회의', ok);
          } else if (o.kind === 'vent' && role === 'imp' && alive) consider(o, C.VENT_R, '환풍구', true);
          else if (o.kind === 'breaker' && alive && sb && sb.k === 'lights') consider(o, C.USE_R, '고치기', true);
          else if (o.kind === 'panel' && alive && sb && sb.k === 'reactor') consider(o, C.USE_R, S.holding === o.id ? '누르는 중' : '꾹 누르기', true);
        });
      }
    }
    S.near = near;

    /* 서버 패널 누르고 있기 */
    var want = (playing && sb && sb.k === 'reactor' && near && near.kind === 'panel' && (S.holdKey || S.holdToggle)) ? near.id : '';
    if (want !== S.holding) { S.holding = want; sendCmd('hold', want); if (!want) S.holdToggle = false; }

    /* 킬·신고 대상 */
    S.killTarget = null; S.reportTarget = null;
    if (playing && role === 'imp' && alive && !inVent && killCd <= 0) {
      var bestK = null;
      others.forEach(function (o) {
        if (!o.alive || o.red || o.vent) return;
        var d = dist(S.me, o);
        if (d <= C.KILL_R && visible(o.x, o.y) && (!bestK || d < bestK.d)) bestK = { pid: o.pid, d: d };
      });
      S.killTarget = bestK && bestK.pid;
    }
    if (playing && alive && !inVent) {
      var bestB = null;
      bodies.forEach(function (b) { var d = dist(S.me, b); if (d <= C.REPORT_R && (!bestB || d < bestB.d)) bestB = { pid: b.pid, d: d }; });
      S.reportTarget = bestB && bestB.pid;
    }

    /* 죽음 안내 */
    if (S.wasAlive && !alive && st.ph === 'play') {
      S.banner = { title: '당신은 죽었습니다', sub: role === 'imp' ? '유령으로 사보타주는 계속 걸 수 있어요.' : '유령으로 남은 임무를 계속할 수 있어요.', color: '#cfd6e6' };
      S.bannerUntil = now + 3000;
    }
    S.wasAlive = alive;

    /* 그리기. 그리기가 실패해도(캔버스 크기 문제 등) 아래 HUD·회의 화면은 계속 돌아야 한다.
       한 번 여기서 던지면 회의가 시작돼도 회의 화면이 영영 안 열린다. */
    try { View.draw({
      me: S.me, alive: alive, role: role, vision: vision, sab: sb, near: near && near.id, tasks: myTasks, t: nowS,
      bodies: bodies,
      players: others.concat([{ pid: S.pid, self: true, x: S.me.x, y: S.me.y, alive: alive, vent: inVent, color: colorOf(S.pid), name: nameOf(S.pid), red: role === 'imp' }])
    }); } catch (e) { if (global.console) console.error(e); }

    var taskList = box ? box.t.map(function (id) {
      var o = M.byId(id), k = global.Tasks.kinds[o.type];
      return { text: o.room + ': ' + (k ? k.label : o.type), done: !myTasks[id] };
    }) : [];
    var alert = null;
    if (sb && sb.k === 'lights') alert = { cls: 'lights', text: role === 'imp' ? '정전 중 — 직원들은 앞이 잘 안 보여요' : '정전! 창고 두꺼비집을 고치세요' };
    if (sb && sb.k === 'reactor') {
      var held = (sb.h || [0, 0]).reduce(function (a, b) { return a + b; }, 0);
      alert = { cls: 'reactor', text: '서버 과열! ' + Math.floor(sb.r / 60) + ':' + ('0' + (sb.r % 60)).slice(-2) + ' — 서버실·렌더팜 패널을 동시에 누르세요 (' + held + '/2)' };
    }
    Hud.render({
      role: role, ghost: !alive,
      mates: role === 'imp' && box ? box.m.map(nameOf) : [],
      tasks: taskList, progress: (st.tp || 0) / 1000,
      use: { on: !!(near && near.on), label: near ? near.label : '사용' },
      report: { on: !!S.reportTarget },
      kill: { show: role === 'imp' && alive, on: !!S.killTarget, cd: killCd },
      sab: { show: role === 'imp', on: playing && !sb && sabCd <= 0, cd: sb ? 0 : sabCd },
      menu: S.menu && role === 'imp',
      alert: playing ? alert : null,
      vent: inVent && playing ? '환풍구 안 — E: 연결된 환풍구로 이동 · 방향키: 나가기' : null,
      edge: playing && sb && sb.k === 'reactor',
      banner: now < S.bannerUntil ? S.banner : null
    });

    meetingFrame(st, alive);
    S.prevPh = st.ph;
  }

  function meetingFrame(st, alive) {
    var Mt = global.Meeting;
    if (st.ph === 'meeting' && st.m) {
      var mk = st.m.by + '|' + st.m.bd;
      if (!Mt.isOpen() || S.meetingKey !== mk) {
        S.meetingKey = mk; S.ejectShown = false;
        global.Tasks.close(); S.menu = false; S.holdToggle = false;
        Mt.close();
        Mt.open(layerEl, { send: sendChat, vote: function (v) { sendCmd('vote', v); } });
        Mt.splash(layerEl, st.m.bd ? '시체 발견!' : '긴급 회의',
          nameOf(st.m.by) + '님이 ' + (st.m.bd ? nameOf(st.m.bd) + '님의 시체를 신고했어요' : '회의를 소집했어요'));
      }
      var chat = [], ch = S.room.chat || {};
      Object.keys(ch).sort().forEach(function (k) {
        var c = ch[k];
        if (!c || (c.g && alive)) return;
        chat.push({ key: k, pid: c.p, name: nameOf(c.p), color: colorOf(c.p), m: String(c.m || ''), g: !!c.g });
      });
      var byPid = {};
      var players = Object.keys(st.p).map(function (pid) {
        var p = { pid: pid, name: nameOf(pid), color: colorOf(pid), alive: st.p[pid][2] === 1, voted: st.m.v.indexOf(pid) >= 0, isBy: pid === st.m.by };
        byPid[pid] = p; return p;
      });
      Mt.render({
        stage: st.m.s, left: st.m.r, me: S.pid, meAlive: alive, meVoted: st.m.v.indexOf(S.pid) >= 0,
        by: st.m.by, body: st.m.bd, players: players, chat: chat, votes: st.m.vt || null, byPid: byPid
      });
      if (st.m.s === 'reveal' && !S.ejectShown) {
        S.ejectShown = true;
        var e = st.m.e;
        var info = e ? { name: nameOf(e), color: colorOf(e), imp: st.m.ei === 1, impsLeft: st.m.il } : { nobody: true, impsLeft: st.m.il };
        setTimeout(function () { if (Mt.isOpen()) Mt.eject(layerEl, info); }, 900);
      }
    } else if (Mt.isOpen()) {
      Mt.close();
    }
    if (st.ph === 'result' && st.w && !S.resultShown) {
      S.resultShown = true;
      Mt.close(); global.Tasks.close();
      var mine = S.box ? S.box.r : null;
      Mt.result(layerEl, {
        side: st.w.s, why: st.w.y, mine: !!mine, won: mine === (st.w.s === 'crew' ? 'crew' : 'imp'),
        imps: st.w.imps.map(function (p) { return { name: nameOf(p), color: colorOf(p) }; })
      });
    }
  }

  /* ── 루프 ─────────────────────────────────────────────── */

  function frame() {
    var t = performance.now() / 1000, dt = Math.min(0.1, t - (S.lastFrame || t));
    S.lastFrame = t;
    if (S.screen === 'game') {
      if (isHost() && S.state) hostTick();
      try { gameFrame(dt); } catch (e) { if (global.console) console.error(e); }
    }
    S.rafAt = performance.now();
    global.requestAnimationFrame(frame);
  }

  /* 방장 탭이 가려지면 requestAnimationFrame 이 멈추고, 보통 타이머도 1초에 한 번으로
     늦춰진다. document.hidden 이 false 인 채로 멈추는 경우도 있다(가려진 창, 미리보기 창).
     그래서 화면 갱신이 0.2초 넘게 없으면 워커 타이머로 판을 민다.
     워커 안의 타이머는 늦춰지지 않는다. */
  function hiddenTick() {
    if (S.screen !== 'game' || !isHost() || !S.state) return;
    if (document.hidden || performance.now() - (S.rafAt || 0) > 200) hostTick();
  }
  (function () {
    try {
      var src = 'setInterval(function(){postMessage(0)},50);';
      var wk = new Worker(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })));
      wk.onmessage = hiddenTick;
    } catch (e) {
      setInterval(hiddenTick, 50);
    }
  })();

  function boot() {
    screenEl = $('screen'); hudEl = $('hud'); layerEl = $('layer'); netEl = $('net'); canvas = $('world');
    View.init(canvas);
    UI.onFaceLoad(function () { if (S.screen === 'lobby') { S.lobbyKey = ''; renderLobby(); } });
    if (LOCAL) setNet('', '로컬 시험 모드'); else setNet('retry', '연결 확인 중');
    global.addEventListener('keydown', onKeyDown);
    global.addEventListener('keyup', onKeyUp);
    global.addEventListener('blur', function () { keys = {}; S.holdKey = false; });
    global.addEventListener('beforeunload', function () { if (S.path) Net.del(S.path + '/who/' + S.pid); });
    Roles.makeKeys().then(function (k) {
      S.keys = k;
      showTitle();
      global.requestAnimationFrame(frame);
    }, function () {
      screenEl.textContent = '이 브라우저는 암호 기능(WebCrypto)을 지원하지 않아요. 크롬이나 엣지 최신판으로 열어 주세요. (주소가 https 이거나 localhost 여야 해요)';
    });
  }

  var View = global.View, Hud = global.Hud;
  global.OfficeGame = { S: S };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})(window);
