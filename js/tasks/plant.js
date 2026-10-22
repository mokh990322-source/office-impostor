/* 화분 물 주기 — 누르는 동안 물이 차고, 떼었을 때 초록 칸이면 성공 */
(function (global) {
  'use strict';
  var Tasks = global.Tasks;
  var LO = 0.6, HI = 0.8, RATE = 0.4;

  function judge(level) { return level < LO ? 'low' : (level > HI ? 'over' : 'ok'); }

  function mount(stage, done, say) {
    var c = Tasks.canvas(stage), ctx = c.ctx, UI = global.UI;
    var level = 0, ended = false, t = 0;
    var btn = Tasks.holdButton('물 주기 (누르고 있기)');
    stage.appendChild(btn);
    say('버튼을 누르고 있다가 게이지가 초록 칸에 오면 떼세요.');
    btn.onRelease = function () {
      if (ended) return;
      var r = judge(level);
      if (r === 'ok') { ended = true; done(); }
      else if (r === 'low') say('아직 목말라요. 조금 더 주세요.');
      else { say('물이 넘쳤어요! 흙이 마를 때까지 다시.'); level = 0; }
    };
    var stop = Tasks.loop(function (dt) {
      t += dt;
      if (btn.held && !ended) { level += RATE * dt; if (level > 1) { btn.held = false; say('물이 넘쳤어요! 다시.'); level = 0; } }
      ctx.fillStyle = '#e8f3e8'; ctx.fillRect(0, 0, Tasks.W, Tasks.H);
      UI.rr(ctx, 150, 130, 110, 80, 10); ctx.fillStyle = "#b9653a"; ctx.fill();
      ctx.fillStyle = '#27ae60';
      for (var i = 0; i < 5; i++) { ctx.beginPath(); ctx.ellipse(205 + (i - 2) * 18, 100 - Math.abs(i - 2) * 10 + Math.sin(t * 2 + i) * 2, 14, 30, (i - 2) * 0.3, 0, 7); ctx.fill(); }
      var ang = btn.held ? -0.5 : 0;
      ctx.save(); ctx.translate(300, 90); ctx.rotate(ang);
      UI.rr(ctx, -30, -20, 60, 40, 8); ctx.fillStyle = '#3498db'; ctx.fill();
      ctx.fillRect(-60, -6, 34, 8);
      ctx.restore();
      if (btn.held) { ctx.fillStyle = 'rgba(52,152,219,.6)'; for (var d = 0; d < 6; d++) ctx.fillRect(238 + d * 3, 100 + ((t * 300 + d * 20) % 70), 3, 8); }
      ctx.fillStyle = '#ddd'; ctx.fillRect(390, 30, 30, 230);
      ctx.fillStyle = 'rgba(46,204,113,.5)'; ctx.fillRect(390, 30 + (1 - HI) * 230, 30, (HI - LO) * 230);
      ctx.fillStyle = '#3498db'; ctx.fillRect(394, 30 + (1 - level) * 230, 22, level * 230);
      ctx.strokeStyle = '#333'; ctx.lineWidth = 2; ctx.strokeRect(390, 30, 30, 230);
    });
    return stop;
  }

  Tasks.kinds.plant = { title: '화분 물 주기', label: '화분 물 주기', mount: mount, judge: judge };
})(window);
