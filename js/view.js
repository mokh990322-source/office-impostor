/* ============================================================
   모몽어스 — 게임 화면 그리기

   바닥·벽·가구는 처음에 한 장으로 그려 두고(정적 층) 매 프레임
   잘라 붙인다. 매 프레임 그리는 건 물건 표시, 캐릭터, 시체, 어둠뿐이다.

   어둠: 화면 크기 캔버스를 검게 칠하고 destination-out 으로 시야
   다각형을 뚫어서 위에 덮는다. 벽 너머가 어두워지는 건 다각형이
   벽에서 멈추기 때문이다(geom.js vision).
   ============================================================ */
(function (global) {
  'use strict';

  var M = global.OfficeMap, G = global.Geom, UI = global.UI;
  var T = M.T;

  var FLOOR = {
    '회의실': '#2c3a66', '탕비실': '#d9c9a8', '서버실': '#3b3f47', '렌더팜': '#33304f',
    '복사실': '#b9bec8', '휴게실': '#8a6542', '대표실': '#5a2633', '창고': '#6b6e73',
    '엘리베이터 홀': '#e6e2da'
  };
  var LIGHT = { '탕비실': 1, '복사실': 1, '엘리베이터 홀': 1 };
  var CORRIDOR = '#4a5163';

  var cv, ctx, dark, dctx, base = null, dpr = 1;
  var prevX = {};

  /* ── 정적 층 ─────────────────────────────────────────── */

  function box(c, x, y, w, hh, fill, stroke, r) {
    UI.rr(c, x, y, w, hh, r || 4);
    c.fillStyle = fill; c.fill();
    if (stroke) { c.lineWidth = 3.5; c.lineJoin = 'round'; c.strokeStyle = stroke; c.stroke(); }
  }

  function furniture(c) {
    var s = '#151821';
    /* 회의실 탁자와 의자 */
    var tb = M.table;
    box(c, tb.x0 * T + 4, tb.y0 * T + 4, (tb.x1 - tb.x0 + 1) * T - 8, (tb.y1 - tb.y0 + 1) * T - 8, '#7a4f2c', s, 14);
    box(c, tb.x0 * T + 14, tb.y0 * T + 14, (tb.x1 - tb.x0 + 1) * T - 28, (tb.y1 - tb.y0 + 1) * T - 28, '#8d5d35', null, 10);
    /* 대표실: 큰 책상, 책장, 액자 */
    box(c, 6 * T, 4 * T + 8, 5 * T, 1.5 * T, '#3d2618', s, 6);
    box(c, 7.5 * T, 6 * T, 2 * T, T * 0.8, '#222', s, 8);
    box(c, 11 * T, 2 * T + 2, 4 * T - 4, T * 0.8, '#5b3a22', s, 3);
    for (var i = 0; i < 7; i++) box(c, 11 * T + 8 + i * 16, 2 * T + 6, 10, T * 0.55, ['#c0392b', '#2980b9', '#27ae60', '#f39c12'][i % 4], null, 2);
    /* 서버실: 랙 */
    [25, 29].forEach(function (x) {
      box(c, x * T + 4, 5 * T, 2 * T - 8, 5 * T, '#1c1f26', s, 4);
      for (var k = 0; k < 9; k++) {
        c.fillStyle = k % 3 ? '#2ecc71' : '#f1c40f';
        c.fillRect(x * T + 12, 5 * T + 10 + k * 17, 4, 4);
        c.fillStyle = '#2a2e38';
        c.fillRect(x * T + 22, 5 * T + 10 + k * 17, 2 * T - 38, 6);
      }
    });
    /* 렌더팜: PC 책상 두 줄 */
    [5, 8].forEach(function (y) {
      box(c, 49 * T, y * T + 6, 5 * T, T - 10, '#cfd3dc', s, 4);
      for (var k = 0; k < 4; k++) {
        box(c, 49 * T + 10 + k * T * 1.2, y * T - 10, 26, 20, '#111', s, 3);
        c.fillStyle = ['#5dade2', '#af7ac5', '#48c9b0', '#f5b041'][k];
        c.fillRect(49 * T + 13 + k * T * 1.2, y * T - 7, 20, 13);
      }
    });
    /* 탕비실: 싱크대, 냉장고, 둥근 탁자 */
    box(c, 5 * T, 16 * T + 2, 5 * T, T - 6, '#9aa3ad', s, 4);
    box(c, 7 * T, 16 * T + 6, T, T - 16, '#d6eaf8', s, 6);
    box(c, 14 * T + 2, 16 * T + 2, T - 4, 2 * T - 4, '#ecf0f1', s, 6);
    c.beginPath(); c.arc(8.5 * T, 21.5 * T, T * 1.1, 0, Math.PI * 2); c.fillStyle = '#f5f0e6'; c.fill(); c.lineWidth = 2; c.strokeStyle = s; c.stroke();
    /* 복사실: 선반, 종이 상자 */
    box(c, 44 * T, 16 * T + 2, 4 * T, T - 6, '#7f8c8d', s, 3);
    [49, 50.2].forEach(function (x) { box(c, x * T, 23 * T + 4, T, T - 8, '#c9a26b', s, 3); });
    /* 휴게실: 소파, TV, 러그 */
    box(c, 4 * T, 32.5 * T, 7 * T, 3 * T, '#a9784e', null, 16);
    box(c, 5 * T, 34.6 * T, 5 * T, T * 0.9, '#2e86c1', s, 10);
    box(c, 5 * T, 30 * T + 4, 5 * T, T * 0.6, '#111', s, 3);
    /* 창고: 선반 */
    box(c, 48 * T, 30 * T + 4, 5 * T, T - 8, '#6e5a44', s, 3);
    box(c, 46 * T, 36.2 * T, 6 * T, T * 0.7, '#6e5a44', s, 3);
    for (var j = 0; j < 4; j++) box(c, 48.4 * T + j * 36, 30 * T + 8, 24, 18, '#c9a26b', s, 2);
    /* 엘리베이터 홀: 문 두 짝 */
    [24, 30].forEach(function (x) {
      box(c, x * T, 37 * T - 4, 3 * T, T, '#95a5a6', s, 3);
      c.fillStyle = '#7f8c8d'; c.fillRect(x * T + 1.5 * T - 1, 37 * T - 4, 2, T);
    });
  }

  function buildBase() {
    base = document.createElement('canvas');
    base.width = M.W * T; base.height = M.H * T;
    var c = base.getContext('2d');
    c.fillStyle = '#0d0f15'; c.fillRect(0, 0, base.width, base.height);
    var x, y;
    for (y = 0; y < M.H; y++) {
      for (x = 0; x < M.W; x++) {
        if (M.solid(x, y)) continue;
        var rn = M.roomAt((x + 0.5) * T, (y + 0.5) * T);
        var col = rn ? FLOOR[rn] : CORRIDOR;
        c.fillStyle = col; c.fillRect(x * T, y * T, T, T);
        c.fillStyle = (rn === '탕비실' && (x + y) % 2) ? 'rgba(0,0,0,0.06)' : 'rgba(0,0,0,0.035)';
        c.fillRect(x * T, y * T, T, 1); c.fillRect(x * T, y * T, 1, T);
        if (rn === '탕비실' && (x + y) % 2) c.fillRect(x * T, y * T, T, T);
      }
    }
    /* 벽: 바닥과 닿은 막힌 칸. 아래가 바닥이면 앞면(밝게)을 그려 입체감 */
    for (y = 0; y < M.H; y++) {
      for (x = 0; x < M.W; x++) {
        if (!M.solid(x, y)) continue;
        var near = !M.solid(x + 1, y) || !M.solid(x - 1, y) || !M.solid(x, y + 1) || !M.solid(x, y - 1) ||
          !M.solid(x + 1, y + 1) || !M.solid(x - 1, y - 1) || !M.solid(x + 1, y - 1) || !M.solid(x - 1, y + 1);
        var tb = M.table;
        if (x >= tb.x0 && x <= tb.x1 && y >= tb.y0 && y <= tb.y1) {
          c.fillStyle = FLOOR['회의실']; c.fillRect(x * T, y * T, T, T); continue;
        }
        if (!near) continue;
        c.fillStyle = '#262c3d'; c.fillRect(x * T, y * T, T, T);
        if (!M.solid(x, y + 1)) {
          c.fillStyle = '#4b5574'; c.fillRect(x * T, y * T + T * 0.35, T, T * 0.65);
          c.fillStyle = '#5d6890'; c.fillRect(x * T, y * T + T * 0.35, T, 3);
        }
      }
    }
    /* 벽과 바닥이 만나는 선을 굵게 (만화풍 외곽선) */
    c.strokeStyle = '#0b0d12'; c.lineWidth = 4; c.lineCap = 'square';
    c.beginPath();
    for (y = 0; y < M.H; y++) {
      for (x = 0; x < M.W; x++) {
        if (!M.solid(x, y) || !M.opaque(x, y)) continue;
        if (!M.solid(x, y + 1)) { c.moveTo(x * T, (y + 1) * T); c.lineTo((x + 1) * T, (y + 1) * T); }
        if (!M.solid(x, y - 1)) { c.moveTo(x * T, y * T); c.lineTo((x + 1) * T, y * T); }
        if (!M.solid(x + 1, y)) { c.moveTo((x + 1) * T, y * T); c.lineTo((x + 1) * T, (y + 1) * T); }
        if (!M.solid(x - 1, y)) { c.moveTo(x * T, y * T); c.lineTo(x * T, (y + 1) * T); }
      }
    }
    c.stroke();
    furniture(c);
    /* 방 이름 */
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.font = '900 30px "Pretendard","Malgun Gothic",sans-serif';
    M.rooms.forEach(function (r) {
      var cx = (r.x0 + r.x1 + 1) / 2 * T, cy = (r.y0 + r.y1 + 1) / 2 * T;
      if (r.name === '회의실') cy = (r.y0 + 1.6) * T;
      c.fillStyle = LIGHT[r.name] ? 'rgba(0,0,0,0.16)' : 'rgba(255,255,255,0.13)';
      c.fillText(r.name, cx, cy);
    });
  }

  /* ── 물건 ────────────────────────────────────────────── */

  function drawObject(c, o, f, t) {
    var p = M.center(o), x = p.x, y = p.y, s = '#151821';
    var mine = f.tasks && f.tasks[o.id];
    var lit = false;
    if (o.kind === 'task') {
      if (o.type === 'copier') { box(c, x - 18, y - 14, 36, 28, '#dfe3ea', s, 4); box(c, x - 12, y - 18, 24, 6, '#b2b9c6', s, 2); c.fillStyle = '#2ecc71'; c.fillRect(x + 8, y - 8, 5, 5); }
      if (o.type === 'render') { box(c, x - 16, y - 16, 32, 22, '#111', s, 3); c.fillStyle = '#5dade2'; c.fillRect(x - 13, y - 13, 26, 16); box(c, x - 4, y + 6, 8, 8, '#555', null, 2); }
      if (o.type === 'coffee') { box(c, x - 14, y - 16, 28, 30, '#2d2d2d', s, 5); c.fillStyle = '#c0392b'; c.beginPath(); c.arc(x, y - 6, 4, 0, 7); c.fill(); box(c, x - 6, y + 4, 12, 9, '#f5f5f5', s, 2); }
      if (o.type === 'cable') { box(c, x - 16, y - 14, 32, 28, '#34495e', s, 4); ['#e74c3c', '#3498db', '#f1c40f', '#2ecc71'].forEach(function (k, i) { c.fillStyle = k; c.fillRect(x - 11 + i * 6, y - 8, 4, 16); }); }
      if (o.type === 'stamp') { box(c, x - 18, y - 12, 36, 24, '#8d5d35', s, 4); box(c, x - 12, y - 9, 16, 18, '#fff', s, 1); c.fillStyle = '#c0392b'; c.beginPath(); c.arc(x + 9, y, 5, 0, 7); c.fill(); }
      if (o.type === 'plant') { box(c, x - 10, y, 20, 14, '#b9653a', s, 3); c.fillStyle = '#27ae60'; c.beginPath(); c.arc(x, y - 6, 12, 0, 7); c.fill(); c.lineWidth = 2; c.strokeStyle = s; c.stroke(); }
      lit = mine;
    } else if (o.kind === 'vent') {
      box(c, x - 14, y - 10, 28, 20, '#5f6b7a', s, 3);
      c.strokeStyle = '#2c333d'; c.lineWidth = 2;
      for (var i = -8; i <= 8; i += 4) { c.beginPath(); c.moveTo(x + i, y - 7); c.lineTo(x + i, y + 7); c.stroke(); }
      lit = f.role === 'imp' && f.alive && f.near === o.id;
    } else if (o.kind === 'button') {
      c.beginPath(); c.arc(x, y, 15, 0, 7); c.fillStyle = '#7f8c8d'; c.fill(); c.lineWidth = 2; c.strokeStyle = s; c.stroke();
      c.beginPath(); c.arc(x, y - 2, 10, 0, 7); c.fillStyle = '#e74c3c'; c.fill(); c.stroke();
    } else if (o.kind === 'panel') {
      var on = f.sab && f.sab.k === 'reactor';
      box(c, x - 14, y - 16, 28, 30, '#2c3e50', s, 4);
      var held = on && f.sab.h && f.sab.h[o.id === 'p1' ? 0 : 1];
      c.fillStyle = held ? '#2ecc71' : (on && Math.floor(t * 4) % 2 ? '#e74c3c' : '#7f8c8d');
      c.fillRect(x - 9, y - 11, 18, 10);
      box(c, x - 6, y + 2, 12, 8, '#95a5a6', null, 2);
      lit = on;
    } else if (o.kind === 'breaker') {
      var lo = f.sab && f.sab.k === 'lights';
      box(c, x - 12, y - 16, 24, 30, '#95a5a6', s, 3);
      c.fillStyle = lo && Math.floor(t * 4) % 2 ? '#f1c40f' : '#2c3e50';
      c.fillRect(x - 6, y - 10, 12, 16);
      lit = lo;
    }
    if (lit) {
      var a = 0.55 + 0.45 * Math.sin(t * 6);
      c.lineWidth = f.near === o.id ? 5 : 3;
      c.strokeStyle = 'rgba(255,214,64,' + a.toFixed(2) + ')';
      UI.rr(c, x - 22, y - 22, 44, 44, 8); c.stroke();
    }
  }

  /* ── 공개 함수 ───────────────────────────────────────── */

  function init(canvas) {
    cv = canvas; ctx = cv.getContext('2d');
    dark = document.createElement('canvas'); dctx = dark.getContext('2d');
    buildBase();
    resize();
    global.addEventListener('resize', resize);
  }

  function resize() {
    dpr = global.devicePixelRatio || 1;
    var w = cv.clientWidth || global.innerWidth, hh = cv.clientHeight || global.innerHeight;
    cv.width = Math.round(w * dpr); cv.height = Math.round(hh * dpr);
    dark.width = cv.width; dark.height = cv.height;
  }

  function zoom() {
    var w = cv.width / dpr;
    return Math.max(0.6, Math.min(1.5, w / (22 * T))) * dpr;
  }

  /* f = { me:{x,y}, color, alive, vent, players:[{pid,x,y,color,name,alive,vent}], bodies:[{pid,x,y,color}],
           tasks:{id:true}, near, role, vision, sab, t } */
  function draw(f) {
    if (!ctx) return;
    /* 창이 가려지거나 최소화된 채 열리면 크기가 0 으로 잡힌다. 매 프레임 확인해 다시 잰다. */
    var want = Math.round((cv.clientWidth || global.innerWidth) * (global.devicePixelRatio || 1));
    if (!cv.width || !cv.height || Math.abs(cv.width - want) > 1) resize();
    if (!cv.width || !cv.height) return;
    var z = zoom(), W = cv.width, H = cv.height;
    var cx = W / 2 - f.me.x * z, cy = H / 2 - f.me.y * z;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#0d0f15'; ctx.fillRect(0, 0, W, H);
    ctx.setTransform(z, 0, 0, z, cx, cy);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(base, 0, 0);

    var t = f.t || 0;
    M.objects.forEach(function (o) { drawObject(ctx, o, f, t); });

    var R = f.vision;
    function seen(x, y) { return !isFinite(R) || G.canSee(M, f.me.x, f.me.y, x, y, R + 20); }


    var list = f.players.slice().sort(function (a, b) { return a.y - b.y; });
    list.forEach(function (p) {
      if (p.vent && !p.self) return;
      if (!p.alive && f.alive && !p.self) return;          // 산 사람에겐 유령이 안 보인다
      if (!p.self && !seen(p.x, p.y)) return;
      var mem = prevX[p.pid] || (prevX[p.pid] = { x: p.x, y: p.y, flip: false });
      var dx = p.x - mem.x, dy = p.y - mem.y;
      if (dx > 0.3) mem.flip = false; else if (dx < -0.3) mem.flip = true;
      var moving = Math.abs(dx) + Math.abs(dy) > 0.4, flip = mem.flip;
      mem.x = p.x; mem.y = p.y;
      if (p.vent) { ctx.save(); ctx.globalAlpha = 0.35; }
      UI.drawBean(ctx, p.x, p.y + 14, 1, p.color, { flip: flip, ghost: !p.alive, bob: moving ? Math.abs(Math.sin(t * 14)) * 1.5 : 0, walk: moving && p.alive ? t * 14 : null });
      if (p.vent) ctx.restore();
      ctx.save();
      ctx.font = '15px "Black Han Sans","Do Hyeon","Malgun Gothic",sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'; ctx.lineJoin = 'round';
      ctx.lineWidth = 4.5; ctx.strokeStyle = '#0b0d12';
      ctx.fillStyle = p.red ? '#ff5b5b' : '#fff';
      if (!p.alive) ctx.globalAlpha = 0.6;
      ctx.strokeText(p.name, p.x, p.y - 24); ctx.fillText(p.name, p.x, p.y - 24);
      ctx.restore();
    });

    /* 시체는 사람 위에 그린다. 킬하면 임포스터가 시체 자리로 옮겨지는데,
       밑에 그리면 임포스터 몸에 통째로 가려져 안 보인다. */
    f.bodies.forEach(function (b) { if (seen(b.x, b.y)) UI.drawBody(ctx, b.x, b.y + 16, 1.3, b.color); });

    /* 어둠 */
    if (isFinite(R)) {
      var pts = G.vision(M, f.me.x, f.me.y, R, 180);
      dctx.setTransform(1, 0, 0, 1, 0, 0);
      dctx.globalCompositeOperation = 'source-over';
      dctx.clearRect(0, 0, W, H);
      dctx.fillStyle = 'rgba(4,5,9,0.9)';
      dctx.fillRect(0, 0, W, H);
      dctx.globalCompositeOperation = 'destination-out';
      dctx.setTransform(z, 0, 0, z, cx, cy);
      var g = dctx.createRadialGradient(f.me.x, f.me.y, R * 0.55, f.me.x, f.me.y, R);
      g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      dctx.fillStyle = g;
      dctx.beginPath();
      dctx.moveTo(pts[0][0], pts[0][1]);
      for (var i = 1; i < pts.length; i++) dctx.lineTo(pts[i][0], pts[i][1]);
      dctx.closePath(); dctx.fill();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawImage(dark, 0, 0);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  function clearScreen() {
    if (!ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#0d0f15'; ctx.fillRect(0, 0, cv.width, cv.height);
  }

  global.View = { init: init, draw: draw, clear: clearScreen, resize: resize };
})(window);
