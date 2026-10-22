/* ============================================================
   사무실 임포스터 — 미니게임 공통 창

   Tasks.open(type, layer) 가 화면 가운데에 창을 띄우고, 끝나면
   'done', 닫으면 'cancel' 로 풀리는 Promise 를 돌려준다.
   각 미니게임은 Tasks.kinds[type] = { title, label, mount(stage, done, say) }
   로 등록한다. mount 는 정리 함수를 돌려준다(애니메이션 멈추기).

   판정 함수(inTray, judge …)는 화면과 떼어 두어 Node 로 시험한다.
   ============================================================ */
(function (global) {
  'use strict';

  var Tasks = global.Tasks || (global.Tasks = { kinds: {} });
  var W = 452, H = 300;
  Tasks.W = W; Tasks.H = H;
  Tasks._cur = null;

  Tasks.open = function (type, layer) {
    var k = Tasks.kinds[type], UI = global.UI, h = UI.h;
    if (!k) return Promise.resolve('cancel');
    Tasks.close();
    return new Promise(function (resolve) {
      var finished = false, cleanup = null;
      var stage = h('div', { class: 'stage' });
      var msg = h('div', { class: 'msg' });
      var back = h('div', { class: 'task-back' }, [
        h('div', { class: 'task-win' }, [
          h('h3', { text: k.title }),
          h('button', { class: 'x', title: '닫기 (Esc)', onclick: function () { finish('cancel'); } }, ['✕']),
          stage, msg
        ])
      ]);
      function onKey(e) { if (e.key === 'Escape') { e.preventDefault(); finish('cancel'); } }
      function finish(r) {
        if (finished) return;
        finished = true;
        Tasks._cur = null;
        document.removeEventListener('keydown', onKey, true);
        if (cleanup) { try { cleanup(); } catch (e) { /* 정리 실패는 무시 */ } }
        if (r === 'done') {
          stage.appendChild(h('div', { class: 'ok', text: '완료!' }));
          setTimeout(function () { if (back.parentNode) back.parentNode.removeChild(back); resolve('done'); }, 600);
        } else {
          if (back.parentNode) back.parentNode.removeChild(back);
          resolve(r);
        }
      }
      document.addEventListener('keydown', onKey, true);
      layer.appendChild(back);
      Tasks._cur = { finish: finish, type: type };
      cleanup = k.mount(stage, function () { finish('done'); }, function (t) { msg.textContent = t || ''; });
    });
  };

  Tasks.close = function () { if (Tasks._cur) Tasks._cur.finish('cancel'); };
  Tasks.isOpen = function () { return !!Tasks._cur; };

  /* 452×300 캔버스와 마우스 좌표 변환 */
  Tasks.canvas = function (stage) {
    var cv = global.UI.h('canvas', { width: String(W), height: String(H),
      style: { width: '100%', height: '100%', display: 'block', touchAction: 'none' } });
    stage.appendChild(cv);
    return {
      cv: cv, ctx: cv.getContext('2d'),
      pos: function (e) {
        var r = cv.getBoundingClientRect();
        return { x: (e.clientX - r.left) * W / r.width, y: (e.clientY - r.top) * H / r.height };
      }
    };
  };

  /* 애니메이션 루프. 돌려준 함수를 부르면 멈춘다. */
  Tasks.loop = function (fn) {
    var on = true, last = performance.now();
    function f(t) {
      if (!on) return;
      var dt = Math.min(0.05, (t - last) / 1000); last = t;
      fn(dt);
      requestAnimationFrame(f);
    }
    requestAnimationFrame(f);
    return function () { on = false; };
  };

  /* 누르고 있는 동안 true 인 버튼 */
  Tasks.holdButton = function (label, cls) {
    var b = global.UI.h('button', { class: cls || 'primary', style: { position: 'absolute', left: '50%', bottom: '14px', transform: 'translateX(-50%)', touchAction: 'none' } }, [label]);
    b.held = false;
    b.addEventListener('pointerdown', function (e) { b.held = true; try { b.setPointerCapture(e.pointerId); } catch (x) {} });
    function up() { if (b.held) { b.held = false; if (b.onRelease) b.onRelease(); } }
    b.addEventListener('pointerup', up);
    b.addEventListener('pointercancel', up);
    return b;
  };

  Tasks.text = function (ctx, s, x, y, size, color, align) {
    ctx.font = '700 ' + (size || 16) + 'px "Pretendard","Malgun Gothic",sans-serif';
    ctx.fillStyle = color || '#1d2230';
    ctx.textAlign = align || 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(s, x, y);
  };
})(window);
