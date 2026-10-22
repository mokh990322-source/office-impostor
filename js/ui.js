/* ============================================================
   사무실 임포스터 — 화면 공통 도구

   DOM 만드는 h(), 잠깐 뜨는 안내(toast), 캐릭터(콩) 그리기.
   콩 그리기는 게임 화면·대기실·회의 카드가 같이 쓴다. 한 곳에서만
   모양을 정해야 화면마다 캐릭터가 달라 보이지 않는다.
   ============================================================ */
(function (global) {
  'use strict';

  var COLORS = [
    { name: '빨강', hex: '#e5383b' }, { name: '파랑', hex: '#3a6ff7' },
    { name: '초록', hex: '#2fb45a' }, { name: '분홍', hex: '#f272c6' },
    { name: '주황', hex: '#f48c06' }, { name: '노랑', hex: '#f7d02c' },
    { name: '검정', hex: '#3f474e' }, { name: '흰색', hex: '#e8ecf3' },
    { name: '보라', hex: '#8b4ee8' }, { name: '청록', hex: '#2ec4c4' }
  ];

  function hex(c) { return (COLORS[c] || COLORS[0]).hex; }

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
     o.flip: 왼쪽을 봄, o.ghost: 반투명 + 꼬리, o.bob: 통통 튀는 높이(px) */
  function drawBean(ctx, x, y, s, color, o) {
    o = o || {};
    var c = hex(color), dark = shade(c, 0.62), line = '#151821';
    ctx.save();
    ctx.translate(x, y - (o.bob || 0));
    if (o.flip) ctx.scale(-1, 1);
    ctx.scale(s, s);
    if (o.ghost) ctx.globalAlpha *= 0.45;
    ctx.lineWidth = 2.4; ctx.strokeStyle = line;

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
      /* 다리 */
      ctx.fillStyle = dark;
      rr(ctx, -10, -8, 8, 8, 3); ctx.fill(); ctx.stroke();
      rr(ctx, 2, -8, 8, 8, 3); ctx.fill(); ctx.stroke();
      /* 몸 */
      ctx.fillStyle = c;
      rr(ctx, -11, -34, 22, 29, 10); ctx.fill(); ctx.stroke();
    }
    /* 고글 */
    ctx.fillStyle = '#9fdcf3';
    rr(ctx, -2, -29, 15, 9, 4.5); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    rr(ctx, 3, -27, 6, 3, 1.5); ctx.fill();
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
    rr: rr, drawBean: drawBean, drawBody: drawBody, beanIcon: beanIcon
  };
})(window);
