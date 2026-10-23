/* ============================================================
   사무실 임포스터 — 화면 공통 도구

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
  var COLORS = [
    { name: 'NEW정균',    hex: '#ff5252', face: 1, crop: [0.5, 0.571, 0.723] },
    { name: '박사장',       hex: '#ff8fd0', face: 2, crop: [0.505, 0.618, 0.701] },
    { name: '스펀지송',       hex: '#ffee58', face: 3, crop: [0.502, 0.61, 0.765] },
    { name: '나 주희 아님', hex: '#66bb6a', face: 4, crop: [0.474, 0.589, 0.691] },
    { name: '서지훈남',    hex: '#26c6da', face: 5, crop: [0.442, 0.618, 0.803] },
    { name: '모몽가',     hex: '#5c6bc0', face: 6, crop: [0.495, 0.68, 0.784] },
    { name: '남이카와',       hex: '#ab47bc', face: 7, crop: [0.44, 0.606, 0.769] },
    { name: '황누렁이',         hex: '#ec407a', face: 8, crop: [0.394, 0.606, 0.716] },
    /* 9·10번: 새로 오신 두 분. 사진은 img/face/9.jpg, 10.jpg — 파일이 없으면 고글로 그린다.
       사진은 나중에 받기로 함(2026-10-22). */
    { name: '호현견',         hex: '#8d6e63', face: 9, crop: [0.373, 0.592, 0.473] },
    { name: '선호합니다',         hex: '#c0ca33', face: 10, crop: [0.487, 0.515, 0.619] }
  ];

  function hex(c) { return (COLORS[c] || COLORS[0]).hex; }

  /* ── 실사 얼굴 ────────────────────────────────────────────
     img/face/<번호>.jpg 를 26px 로 줄여 두고 픽셀 그대로 키워 그린다
     (모코파크·퇴근의 계단과 같은 농담). 사진이 없거나 못 읽으면 그냥
     고글을 그린다. 사진 하나 빠졌다고 게임이 죽으면 안 된다. */
  var FACE_PX = 26, FACE_V = '20261023', faces = {}, faceListeners = [];
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

  /* 사진마다 얼굴 자리가 다르다. COLORS[i].crop = [가운데 x, 가운데 y, 정사각형 한 변] (사진 가로 대비 비율).
     눈이 정사각형 위쪽 40% 쯤 오도록 사진을 보고 하나씩 잡은 값이다(2026-10-23).
     crop 이 없으면 옛 규칙(높이 38% 를 중심, 짧은 변의 78%)으로 자른다. */
  function faceCanvas(i) {
    var f = faces[i];
    if (!f) return null;
    if (f.small) return f.small;
    var cv = document.createElement('canvas');
    cv.width = FACE_PX; cv.height = FACE_PX;
    var iw = f.img.naturalWidth, ih = f.img.naturalHeight, c = (COLORS[i] || {}).crop;
    var sq, sx, sy;
    if (c) { sq = c[2] * iw; sx = c[0] * iw - sq / 2; sy = c[1] * ih - sq / 2; }
    else { sq = Math.min(iw, ih) * 0.78; sx = (iw - sq) / 2; sy = ih * 0.38 - sq / 2; }
    sq = Math.min(sq, iw, ih);
    sx = Math.max(0, Math.min(iw - sq, sx));
    sy = Math.max(0, Math.min(ih - sq, sy));
    cv.getContext('2d').drawImage(f.img, sx, sy, sq, sq, 0, 0, FACE_PX, FACE_PX);
    f.small = cv;
    return cv;
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
      /* 고글 자리에 얼굴 사진. 몸을 뒤집어도 얼굴은 뒤집지 않는다(사진이 거울상이 되면 어색하다). */
      ctx.fillStyle = '#9fdcf3';
      rr(ctx, -5, -33, 19, 19, 6); ctx.fill(); ctx.stroke();
      ctx.save();
      rr(ctx, -4, -32, 17, 17, 5); ctx.clip();
      if (o.flip) { ctx.translate(4.5, 0); ctx.scale(-1, 1); ctx.translate(-4.5, 0); }
      var sm = ctx.imageSmoothingEnabled;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(fc, -4, -32, 17, 17);
      ctx.imageSmoothingEnabled = sm;
      ctx.restore();
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
