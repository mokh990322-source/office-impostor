/* 복사기에 용지 넣기 — 종이 묶음을 끌어서 용지함에 놓는다 */
(function (global) {
  'use strict';
  var Tasks = global.Tasks;
  var TRAY = { x: 300, y: 140, w: 140, h: 100 };
  var HOME = { x: 70, y: 130 };
  var PW = 100, PH = 70;

  function inTray(x, y) { return x >= TRAY.x && x <= TRAY.x + TRAY.w && y >= TRAY.y && y <= TRAY.y + TRAY.h; }

  function mount(stage, done, say) {
    var c = Tasks.canvas(stage), ctx = c.ctx, UI = global.UI;
    var p = { x: HOME.x, y: HOME.y }, drag = null, over = false;
    say('종이 묶음을 오른쪽 복사기 용지함으로 끌어다 놓으세요.');
    function draw() {
      ctx.clearRect(0, 0, Tasks.W, Tasks.H);
      ctx.fillStyle = '#f2f4f8'; ctx.fillRect(0, 0, Tasks.W, Tasks.H);
      UI.rr(ctx, 280, 40, 170, 240, 12); ctx.fillStyle = '#c9ced9'; ctx.fill(); ctx.strokeStyle = '#555'; ctx.lineWidth = 2; ctx.stroke();
      UI.rr(ctx, 295, 52, 140, 60, 6); ctx.fillStyle = '#2c3e50'; ctx.fill();
      Tasks.text(ctx, '복사기', 365, 82, 18, '#fff');
      UI.rr(ctx, TRAY.x, TRAY.y, TRAY.w, TRAY.h, 6); ctx.fillStyle = over ? '#d5f5e3' : '#e5e8ee'; ctx.fill(); ctx.setLineDash([6, 5]); ctx.stroke(); ctx.setLineDash([]);
      Tasks.text(ctx, '용지함', TRAY.x + TRAY.w / 2, TRAY.y + TRAY.h + 16, 14, '#555');
      for (var i = 3; i >= 0; i--) {
        ctx.fillStyle = '#fff'; ctx.fillRect(p.x + i * 3, p.y - i * 3, PW, PH);
        ctx.strokeStyle = '#9aa3b2'; ctx.strokeRect(p.x + i * 3, p.y - i * 3, PW, PH);
      }
      Tasks.text(ctx, 'A4 용지', p.x + PW / 2, p.y + PH / 2, 15, '#7b8496');
    }
    function down(e) {
      var q = c.pos(e);
      if (q.x >= p.x && q.x <= p.x + PW + 12 && q.y >= p.y - 12 && q.y <= p.y + PH) {
        drag = { dx: q.x - p.x, dy: q.y - p.y };
        try { c.cv.setPointerCapture(e.pointerId); } catch (x) {}
      }
    }
    function move(e) {
      if (!drag) return;
      var q = c.pos(e);
      p.x = q.x - drag.dx; p.y = q.y - drag.dy;
      over = inTray(p.x + PW / 2, p.y + PH / 2);
      draw();
    }
    function up() {
      if (!drag) return;
      drag = null;
      if (inTray(p.x + PW / 2, p.y + PH / 2)) { done(); return; }
      say('용지함 안에 놓아야 해요. 다시 해 보세요.');
      p.x = HOME.x; p.y = HOME.y; over = false; draw();
    }
    c.cv.addEventListener('pointerdown', down);
    c.cv.addEventListener('pointermove', move);
    c.cv.addEventListener('pointerup', up);
    draw();
    return function () {};
  }

  Tasks.kinds.copier = { title: '복사기에 용지 넣기', label: '복사기에 용지 넣기', mount: mount, inTray: inTray };
})(window);
