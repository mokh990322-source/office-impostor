/* 서버 케이블 연결 — 왼쪽 단자를 같은 색 오른쪽 단자로 끌어 잇는다 */
(function (global) {
  'use strict';
  var Tasks = global.Tasks;
  var COL = { red: '#e74c3c', blue: '#3498db', yellow: '#f1c40f', green: '#2ecc71' };

  function solved(links, left, right) {
    for (var i = 0; i < left.length; i++) {
      if (links[i] === undefined || links[i] === null) return false;
      if (left[i] !== right[links[i]]) return false;
    }
    return true;
  }

  function shuffle(a) {
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }

  function mount(stage, done, say) {
    var c = Tasks.canvas(stage), ctx = c.ctx;
    var left = shuffle(['red', 'blue', 'yellow', 'green']);
    var right = shuffle(left.slice());
    var links = {}, drag = null;
    function ly(i) { return 50 + i * 66; }
    say('왼쪽 단자를 같은 색 오른쪽 단자로 끌어 이으세요.');
    function draw() {
      ctx.fillStyle = '#2c3440'; ctx.fillRect(0, 0, Tasks.W, Tasks.H);
      ctx.fillStyle = '#1f252e'; ctx.fillRect(0, 0, 70, Tasks.H); ctx.fillRect(Tasks.W - 70, 0, 70, Tasks.H);
      for (var i = 0; i < 4; i++) {
        ctx.fillStyle = COL[left[i]]; ctx.fillRect(14, ly(i) - 12, 44, 24);
        ctx.fillStyle = COL[right[i]]; ctx.fillRect(Tasks.W - 58, ly(i) - 12, 44, 24);
        if (links[i] !== undefined) line(70, ly(i), Tasks.W - 70, ly(links[i]), COL[left[i]]);
      }
      if (drag) line(70, ly(drag.i), drag.x, drag.y, COL[left[drag.i]]);
    }
    function line(x1, y1, x2, y2, col) {
      ctx.strokeStyle = col; ctx.lineWidth = 12; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    }
    function hitRow(q, side) {
      for (var i = 0; i < 4; i++) {
        var inX = side === 'L' ? q.x < 90 : q.x > Tasks.W - 90;
        if (inX && Math.abs(q.y - ly(i)) < 26) return i;
      }
      return -1;
    }
    c.cv.addEventListener('pointerdown', function (e) {
      var q = c.pos(e), i = hitRow(q, 'L');
      if (i < 0 || links[i] !== undefined) return;
      drag = { i: i, x: q.x, y: q.y };
      try { c.cv.setPointerCapture(e.pointerId); } catch (x) {}
      draw();
    });
    c.cv.addEventListener('pointermove', function (e) {
      if (!drag) return;
      var q = c.pos(e); drag.x = q.x; drag.y = q.y; draw();
    });
    c.cv.addEventListener('pointerup', function (e) {
      if (!drag) return;
      var j = hitRow(c.pos(e), 'R'), i = drag.i;
      drag = null;
      if (j >= 0 && right[j] === left[i]) { links[i] = j; say(''); }
      else if (j >= 0) say('색이 달라요. 같은 색끼리 이어 주세요.');
      draw();
      if (solved(links, left, right)) done();
    });
    draw();
    return function () {};
  }

  Tasks.kinds.cable = { title: '서버 케이블 연결', label: '서버 케이블 연결', mount: mount, solved: solved };
})(window);
