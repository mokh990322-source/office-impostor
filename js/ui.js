/* ============================================================
   모몽어스 — 화면 공통 도구

   DOM 만드는 h(), 잠깐 뜨는 안내(toast), 캐릭터(콩) 그리기.
   콩 그리기는 게임 화면·대기실·회의 카드가 같이 쓴다. 한 곳에서만
   모양을 정해야 화면마다 캐릭터가 달라 보이지 않는다.
   ============================================================ */
(function (global) {
  'use strict';

  /* 캐릭터 = 모코파크의 회사분들 8명 + 새로 오신 두 분(9·10번).
     번호(0~9)는 Firebase who/<pid>/color 에 그대로 실린다. 순서를 바꾸면
     규칙·저장 값이 어긋나니 뒤에 붙이기만 할 것.
     이름과 색은 모코파크 js/sprite.js 의 CHARS 와 같다. */
  /* eyes = 사진 속 두 눈 위치 [왼눈 x, 왼눈 y, 오른눈 x, 오른눈 y] (사진 가로·세로 대비 비율).
     눈금 그린 사진을 보고 하나씩 잰 값(2026-10-23). 이 두 점을 기준으로 모든 얼굴을
     같은 크기·같은 눈높이·수평으로 맞춰 바이저에 넣는다.
     4번(모자)·6번(그늘)은 눈이 안 보여 코·입으로 짐작, 9번(옆얼굴)은 머리가 가운데 오게 잡은 가상의 눈. */
  var COLORS = [
    { name: 'NEW정균',    hex: '#ff5252', face: 1, eyes: [0.37, 0.51, 0.70, 0.505] },
    { name: '박사장',       hex: '#ff8fd0', face: 2, eyes: [0.455, 0.572, 0.82, 0.575] },
    { name: '스펀지송',       hex: '#ffee58', face: 3, eyes: [0.32, 0.49, 0.684, 0.49] },
    { name: '나 주희 아님', hex: '#66bb6a', face: 4, eyes: [0.285, 0.53, 0.575, 0.53] },
    { name: '서지훈남',    hex: '#26c6da', face: 5, eyes: [0.206, 0.535, 0.56, 0.503] },
    { name: '모몽가',     hex: '#5c6bc0', face: 6, eyes: [0.26, 0.50, 0.61, 0.51] },
    { name: '남이카와',       hex: '#ab47bc', face: 7, eyes: [0.378, 0.535, 0.73, 0.535] },
    { name: '황누렁이',         hex: '#ec407a', face: 8, eyes: [0.283, 0.54, 0.646, 0.565] },
    /* 9·10번: 새로 오신 두 분. 사진은 img/face/9.jpg, 10.jpg — 파일이 없으면 고글로 그린다. */
    { name: '호현견',         hex: '#8d6e63', face: 9, eyes: [0.29, 0.47, 0.55, 0.47] },
    { name: '선호합니다',         hex: '#c0ca33', face: 10, eyes: [0.376, 0.47, 0.677, 0.475] }
  ];

  /* 콩의 바이저(유리창). 원작처럼 몸 앞쪽으로 살짝 튀어나온 넓은 창이고, 얼굴이 보이도록
     게임 원래 고글보다 크게 잡았다. 로컬 단위(콩 키 약 34). */
  var VISOR = { x: -6.5, y: -32, w: 20, h: 16, r: 6.5 };

  function hex(c) { return (COLORS[c] || COLORS[0]).hex; }

  /* ── 실사 얼굴 ────────────────────────────────────────────
     img/face/<번호>.jpg 를 바이저 비율의 작은 그림(FACE_W×FACE_H)으로 한 번 만들어 두고
     매번 그걸 바이저에 그린다. 사진이 없거나 못 읽으면 그냥 고글을 그린다.
     사진 하나 빠졌다고 게임이 죽으면 안 된다. */
  var FACE_W = 98, FACE_H = 78, FACE_V = '20261023', faces = {}, faceListeners = [];
  var EYE_GAP = 0.35;   // 두 눈 사이 = 바이저 가로 × 이 값 (이마부터 턱까지 들어가는 크기)
  var EYE_Y = 0.08;     // 눈높이 = 바이저 가운데에서 바이저 세로 × 이 값만큼 위
  (function loadFaces() {
    if (typeof global.Image !== 'function') return;          // Node 시험
    COLORS.forEach(function (c, i) {
      if (!c.face) return;
      var im = new global.Image();
      im.onload = function () {
        if (!im.naturalWidth) return;
        faces[i] = { img: im, small: null };
        faceListeners.forEach(function (fn) { try { fn(i); } catch (e) { /* 무시 */ } });
      };
      im.src = 'img/face/' + c.face + '.jpg?v=' + FACE_V;   // 사진을 바꾸면 FACE_V 를 올린다(캐시된 옛 사진에 새 자르기 값이 적용되는 것 방지)
    });
  })();

  /* 바이저에 넣을 얼굴 그림. 두 눈(COLORS[i].eyes)을 기준으로 크기·높이·기울기를 맞추고,
     사진이 바이저보다 작아 비는 곳은 사진 테두리 평균색으로 채운다.
     사진 끝이 경계선으로 보이지 않게 가장자리를 투명하게 녹여서 얹는다. */
  function faceCanvas(i) {
    var f = faces[i];
    if (!f) return null;
    if (f.small) return f.small;
    var im = f.img, iw = im.naturalWidth, ih = im.naturalHeight;
    var e = (COLORS[i] || {}).eyes || [0.35, 0.45, 0.65, 0.45];

    /* 가장자리를 녹인 사진 사본 + 테두리 평균색 */
    var sc = document.createElement('canvas'); sc.width = iw; sc.height = ih;
    var sg = sc.getContext('2d'), fe = Math.round(Math.min(iw, ih) * 0.12);
    sg.drawImage(im, 0, 0);
    var edge = edgeColor(sg, iw, ih);
    sg.globalCompositeOperation = 'destination-in';
    var gx = sg.createLinearGradient(0, 0, iw, 0);
    gx.addColorStop(0, 'rgba(0,0,0,0)'); gx.addColorStop(fe / iw, '#000'); gx.addColorStop(1 - fe / iw, '#000'); gx.addColorStop(1, 'rgba(0,0,0,0)');
    sg.fillStyle = gx; sg.fillRect(0, 0, iw, ih);
    var gy = sg.createLinearGradient(0, 0, 0, ih);
    gy.addColorStop(0, 'rgba(0,0,0,0)'); gy.addColorStop(fe / ih, '#000'); gy.addColorStop(1 - fe / ih, '#000'); gy.addColorStop(1, 'rgba(0,0,0,0)');
    sg.fillStyle = gy; sg.fillRect(0, 0, iw, ih);

    var cv = document.createElement('canvas');
    cv.width = FACE_W; cv.height = FACE_H;
    var g = cv.getContext('2d');
    g.fillStyle = edge; g.fillRect(0, 0, FACE_W, FACE_H);
    var lx = e[0] * iw, ly = e[1] * ih, rx = e[2] * iw, ry = e[3] * ih;
    var d = Math.hypot(rx - lx, ry - ly), ang = Math.atan2(ry - ly, rx - lx), k = EYE_GAP * FACE_W / d;
    g.imageSmoothingQuality = 'high';
    g.filter = 'contrast(1.1) brightness(1.05)';
    g.translate(FACE_W / 2, FACE_H / 2 - EYE_Y * FACE_H); g.rotate(-ang); g.scale(k, k);
    g.drawImage(sc, -(lx + rx) / 2, -(ly + ry) / 2);
    f.small = cv;
    return cv;
  }
  function edgeColor(g, w, h) {
    var c = document.createElement('canvas'); c.width = 10; c.height = 10;
    var cg = c.getContext('2d'); cg.drawImage(g.canvas, 0, 0, w, h, 0, 0, 10, 10);
    var px = cg.getImageData(0, 0, 10, 10).data, r = 0, gr = 0, b = 0, n = 0;
    for (var y = 0; y < 10; y++) for (var x = 0; x < 10; x++) {
      if (x > 0 && x < 9 && y > 0 && y < 9) continue;
      var o = (y * 10 + x) * 4; r += px[o]; gr += px[o + 1]; b += px[o + 2]; n++;
    }
    return 'rgb(' + Math.round(r / n) + ',' + Math.round(gr / n) + ',' + Math.round(b / n) + ')';
  }
  function onFaceLoad(fn) { faceListeners.push(fn); }

  function shade(h, k) {
    var n = parseInt(h.slice(1), 16);
    var r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    r = Math.round(r * k); g = Math.round(g * k); b = Math.round(b * k);
    return 'rgb(' + Math.min(255, r) + ',' + Math.min(255, g) + ',' + Math.min(255, b) + ')';
  }

  function h(tag, attrs, kids) {
    var el = document.createElement(tag), k, v;
    if (attrs) {
      for (k in attrs) {
        if (!Object.prototype.hasOwnProperty.call(attrs, k)) continue;
        v = attrs[k];
        if (v === undefined || v === null || v === false) continue;
        if (k === 'class') el.className = v;
        else if (k === 'text') el.textContent = v;
        else if (k === 'style') { for (var s in v) if (Object.prototype.hasOwnProperty.call(v, s)) el.style[s] = v[s]; }
        else if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v);
        else if (v === true) el.setAttribute(k, '');
        else el.setAttribute(k, v);
      }
    }
    (kids || []).forEach(function (c) {
      if (c === null || c === undefined || c === false) return;
      el.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
    });
    return el;
  }

  function clear(el) { while (el && el.firstChild) el.removeChild(el.firstChild); }

  var toastEl = null, toastTimer = 0;
  function toast(msg, ms) {
    if (!toastEl) { toastEl = h('div', { class: 'toast' }); document.body.appendChild(toastEl); }
    toastEl.textContent = msg;
    toastEl.classList.add('on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('on'); }, ms || 3200);
  }

  function rr(ctx, x, y, w, hh, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + hh - r); ctx.quadraticCurveTo(x + w, y + hh, x + w - r, y + hh);
    ctx.lineTo(x + r, y + hh); ctx.quadraticCurveTo(x, y + hh, x, y + hh - r);
    ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  /* 콩 캐릭터. (x, y) 는 발 가운데. s 는 배율(1 이면 키 약 34px).
     o.flip: 왼쪽을 봄, o.ghost: 반투명 + 꼬리, o.bob: 통통 튀는 높이(px),
     o.walk: 걷는 위상(라디안). 있으면 두 다리가 번갈아 앞뒤로 움직인다. */
  function drawBean(ctx, x, y, s, color, o) {
    o = o || {};
    var c = hex(color), dark = shade(c, 0.62), line = '#151821';
    ctx.save();
    ctx.translate(x, y - (o.bob || 0));
    if (o.flip) ctx.scale(-1, 1);
    ctx.scale(s, s);
    if (o.ghost) ctx.globalAlpha *= 0.45;
    ctx.lineWidth = 3.4; ctx.strokeStyle = line; ctx.lineJoin = 'round';

    /* 배낭 */
    ctx.fillStyle = dark;
    rr(ctx, -16, -24, 7, 15, 3); ctx.fill(); ctx.stroke();

    if (o.ghost) {
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.moveTo(-11, -14);
      ctx.quadraticCurveTo(-11, -34, 0, -34);
      ctx.quadraticCurveTo(11, -34, 11, -14);
      ctx.quadraticCurveTo(10, -2, 4, 2);
      ctx.quadraticCurveTo(0, 6, -3, 0);
      ctx.quadraticCurveTo(-8, -4, -11, -14);
      ctx.closePath(); ctx.fill(); ctx.stroke();
    } else {
      /* 다리 — 걸으면 번갈아 앞뒤로 */
      var sw = o.walk !== undefined && o.walk !== null ? Math.sin(o.walk) : 0;
      var up1 = sw > 0 ? sw * 2.5 : 0, up2 = sw < 0 ? -sw * 2.5 : 0;
      ctx.fillStyle = dark;
      rr(ctx, -10 + sw * 3, -9 - up1, 8, 9, 3); ctx.fill(); ctx.stroke();
      rr(ctx, 2 - sw * 3, -9 - up2, 8, 9, 3); ctx.fill(); ctx.stroke();
      /* 몸 */
      ctx.fillStyle = c;
      rr(ctx, -11, -34, 22, 29, 10); ctx.fill(); ctx.stroke();
      /* 몸 그늘 (만화풍 음영) */
      ctx.save(); rr(ctx, -11, -34, 22, 29, 10); ctx.clip();
      ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(-11, -14, 22, 10);
      ctx.restore();
      rr(ctx, -11, -34, 22, 29, 10); ctx.stroke();
    }
    var fc = faceCanvas(color);
    if (fc) {
      /* 바이저에 얼굴 사진. 몸을 뒤집어도 얼굴은 뒤집지 않는다(사진이 거울상이 되면 어색하다). */
      var V = VISOR, vcx = V.x + V.w / 2;
      ctx.save();
      rr(ctx, V.x, V.y, V.w, V.h, V.r); ctx.fillStyle = '#9fdcf3'; ctx.fill(); ctx.clip();
      if (o.flip) { ctx.translate(vcx, 0); ctx.scale(-1, 1); ctx.translate(-vcx, 0); }
      ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(fc, V.x, V.y, V.w, V.h);
      /* 유리 느낌: 살짝 푸른 막 + 반사광 */
      ctx.fillStyle = 'rgba(159,220,243,0.16)'; ctx.fillRect(V.x, V.y, V.w, V.h);
      ctx.restore();
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      rr(ctx, V.x + V.w - 6, V.y + 1.3, 3.6, 1.4, 0.7); ctx.fill();
      /* 바이저 테는 몸 테두리보다 얇게(두꺼우면 얼굴 가장자리를 가린다) */
      ctx.save(); ctx.lineWidth = 2.2; rr(ctx, V.x, V.y, V.w, V.h, V.r); ctx.stroke(); ctx.restore();
    } else {
      /* 고글 */
      ctx.fillStyle = '#9fdcf3';
      rr(ctx, -2, -29, 15, 9, 4.5); ctx.fill(); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      rr(ctx, 3, -27, 6, 3, 1.5); ctx.fill();
    }
    ctx.restore();
  }

  /* 시체: 몸 아래 절반 + 뼈 */
  function drawBody(ctx, x, y, s, color) {
    var c = hex(color), dark = shade(c, 0.62);
    ctx.save();
    ctx.translate(x, y); ctx.scale(s, s);
    ctx.lineWidth = 2.4; ctx.strokeStyle = '#151821';
    ctx.fillStyle = dark;
    rr(ctx, -10, -8, 8, 8, 3); ctx.fill(); ctx.stroke();
    rr(ctx, 2, -8, 8, 8, 3); ctx.fill(); ctx.stroke();
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.moveTo(-11, -5); ctx.lineTo(-11, -16);
    ctx.lineTo(-6, -13); ctx.lineTo(-2, -17); ctx.lineTo(3, -13); ctx.lineTo(7, -17); ctx.lineTo(11, -14);
    ctx.lineTo(11, -5); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#f3efe2';
    rr(ctx, -2, -24, 4, 9, 1.5); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(-1.5, -24, 2.6, 0, Math.PI * 2); ctx.arc(1.5, -24, 2.6, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  /* DOM 용 작은 콩 그림 (대기실 목록, 회의 카드) */
  function beanIcon(color, size, o) {
    var cv = h('canvas', { class: 'bean' });
    var dpr = global.devicePixelRatio || 1;
    cv.width = size * dpr; cv.height = size * dpr;
    cv.style.width = size + 'px'; cv.style.height = size + 'px';
    var ctx = cv.getContext('2d');
    ctx.scale(dpr, dpr);
    var s = size / 40;
    if (o && o.dead) drawBody(ctx, size / 2, size * 0.92, s * 1.1, color);
    else drawBean(ctx, size / 2, size * 0.94, s * 1.05, color, o);
    return cv;
  }

  global.UI = {
    COLORS: COLORS, hex: hex, shade: shade, h: h, clear: clear, toast: toast,
    onFaceLoad: onFaceLoad, hasFace: function (i) { return !!faces[i]; },
    rr: rr, drawBean: drawBean, drawBody: drawBody, beanIcon: beanIcon
  };
})(window);
