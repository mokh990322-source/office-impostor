/* 결재 도장 찍기 — 서류 3장의 빈칸에 도장 */
(function (global) {
  'use strict';
  var Tasks = global.Tasks;

  function hit(x, y, box) { return x >= box.x && x <= box.x + box.w && y >= box.y && y <= box.y + box.h; }

  function mount(stage, done, say) {
    var c = Tasks.canvas(stage), ctx = c.ctx;
    var sheet = 0, box = null, mark = null, locked = false;
    var TITLES = ['휴가 신청서', '장비 구매 품의서', '야근 식대 청구서'];
    function newSheet() {
      box = { x: 150 + Math.random() * 180, y: 170 + Math.random() * 60, w: 74, h: 56 };
      mark = null;
    }
    function draw() {
      ctx.fillStyle = '#8d5d35'; ctx.fillRect(0, 0, Tasks.W, Tasks.H);
      ctx.fillStyle = '#fff'; ctx.fillRect(110, 14, 300, 272);
      ctx.strokeStyle = '#ccc'; ctx.strokeRect(110, 14, 300, 272);
      Tasks.text(ctx, TITLES[sheet] + '  (' + (sheet + 1) + '/3)', 260, 40, 17);
      ctx.fillStyle = '#d5d9e1';
      for (var i = 0; i < 5; i++) ctx.fillRect(132, 66 + i * 18, 250 - (i % 2) * 60, 7);
      ctx.setLineDash([5, 4]); ctx.strokeStyle = '#888'; ctx.lineWidth = 2;
      ctx.strokeRect(box.x, box.y, box.w, box.h); ctx.setLineDash([]);
      Tasks.text(ctx, '결재', box.x + box.w / 2, box.y - 10, 12, '#888');
      if (mark) {
        ctx.strokeStyle = mark.ok ? '#c0392b' : 'rgba(192,57,43,.45)'; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.arc(mark.x, mark.y, 22, 0, 7); ctx.stroke();
        Tasks.text(ctx, '승인', mark.x, mark.y, 15, mark.ok ? '#c0392b' : 'rgba(192,57,43,.45)');
      }
      ctx.fillStyle = '#c0392b'; ctx.fillRect(22, 120, 56, 30);
      ctx.fillStyle = '#6e2c00'; ctx.fillRect(38, 70, 24, 52);
      Tasks.text(ctx, '도장', 50, 170, 13, '#fff');
    }
    c.cv.addEventListener('pointerdown', function (e) {
      if (locked) return;
      var q = c.pos(e);
      var ok = hit(q.x, q.y, box);
      mark = { x: q.x, y: q.y, ok: ok };
      draw();
      if (!ok) { say('빈칸 안에 찍어 주세요.'); return; }
      say('');
      locked = true;
      setTimeout(function () {
        locked = false;
        sheet++;
        if (sheet >= 3) { done(); return; }
        newSheet(); draw();
      }, 380);
    });
    say('점선 빈칸에 클릭해서 도장을 찍으세요. 3장입니다.');
    newSheet(); draw();
    return function () {};
  }

  Tasks.kinds.stamp = { title: '결재 도장 찍기', label: '결재 도장 찍기', mount: mount, hit: hit };
})(window);
