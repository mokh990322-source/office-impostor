/* 커피 내리기 — 누르고 있다가 선까지 찼을 때 뗀다 */
(function (global) {
  'use strict';
  var Tasks = global.Tasks;
  var LO = 0.78, HI = 0.92, FILL = 1 / 2.2;

  function judge(level) { return level < LO ? 'low' : (level > HI ? 'over' : 'ok'); }

  function mount(stage, done, say) {
    var c = Tasks.canvas(stage), ctx = c.ctx, UI = global.UI;
    var level = 0, ended = false;
    var btn = Tasks.holdButton('누르고 있기');
    stage.appendChild(btn);
    say('버튼을 누르고 있다가 커피가 노란 선 사이에 오면 떼세요.');
    btn.onRelease = function () {
      if (ended) return;
      var r = judge(level);
      if (r === 'ok') { ended = true; done(); }
      else if (r === 'low') say('조금 더 채워 주세요.');
      else { say('넘쳤어요! 다시 해 보세요.'); level = 0; }
    };
    var cup = { x: 166, y: 70, w: 120, h: 150 };
    var stop = Tasks.loop(function (dt) {
      if (btn.held && !ended) {
        level += FILL * dt;
        if (level > 1.02) { btn.held = false; say('넘쳤어요! 다시 해 보세요.'); level = 0; }
      }
      ctx.clearRect(0, 0, Tasks.W, Tasks.H);
      ctx.fillStyle = '#efe6d8'; ctx.fillRect(0, 0, Tasks.W, Tasks.H);
      UI.rr(ctx, 130, 10, 192, 40, 8); ctx.fillStyle = '#2d2d2d'; ctx.fill();
      Tasks.text(ctx, '커피 머신', 226, 30, 15, '#fff');
      if (btn.held) { ctx.fillStyle = '#5b3a1e'; ctx.fillRect(222, 50, 8, cup.y + cup.h - 50 - Math.min(1, level) * cup.h); }
      ctx.fillStyle = '#fff'; ctx.fillRect(cup.x, cup.y, cup.w, cup.h);
      var fh = Math.min(1, level) * cup.h;
      ctx.fillStyle = '#6f4321'; ctx.fillRect(cup.x, cup.y + cup.h - fh, cup.w, fh);
      ctx.lineWidth = 3; ctx.strokeStyle = '#1d2230'; ctx.strokeRect(cup.x, cup.y, cup.w, cup.h);
      ctx.beginPath(); ctx.arc(cup.x + cup.w + 14, cup.y + 60, 22, -1.2, 1.2); ctx.stroke();
      [LO, HI].forEach(function (k) {
        var y = cup.y + cup.h - k * cup.h;
        ctx.strokeStyle = '#f1c40f'; ctx.setLineDash([6, 4]);
        ctx.beginPath(); ctx.moveTo(cup.x - 14, y); ctx.lineTo(cup.x + cup.w + 4, y); ctx.stroke();
        ctx.setLineDash([]);
      });
    });
    return stop;
  }

  Tasks.kinds.coffee = { title: '커피 내리기', label: '커피 내리기', mount: mount, judge: judge };
})(window);
