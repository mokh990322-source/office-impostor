/* 렌더 큐 걸기 — 샷 3개를 순서대로 체크하고 렌더 버튼 */
(function (global) {
  'use strict';
  var Tasks = global.Tasks;
  var SHOTS = ['SH010_조명', 'SH020_카페인트', 'SH030_턴테이블'];

  function next(checked, i) {
    if (checked[i]) return false;
    for (var k = 0; k < i; k++) if (!checked[k]) return false;
    return true;
  }

  function mount(stage, done, say) {
    var UI = global.UI, h = UI.h;
    var checked = [false, false, false], running = false, stop = null;
    var wrap = h('div', { style: { padding: '18px 22px', height: '100%', background: '#1f2433', color: '#e8ecf3', display: 'flex', flexDirection: 'column', gap: '10px' } });
    wrap.appendChild(h('div', { style: { fontWeight: '800', color: '#ffcc4d' }, text: 'Render Queue — 대기 중인 샷' }));
    var rows = SHOTS.map(function (name, i) {
      var box = h('span', { style: { width: '26px', height: '26px', borderRadius: '6px', border: '3px solid #8a93a8', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: '900' } });
      var row = h('button', { style: { display: 'flex', alignItems: 'center', gap: '12px', background: '#2b3245', justifyContent: 'flex-start', transition: 'transform .1s' },
        onclick: function () {
          if (running) return;
          if (!next(checked, i)) {
            if (!checked[i]) { say('위에서부터 순서대로 체크하세요.'); row.style.transform = 'translateX(6px)'; setTimeout(function () { row.style.transform = ''; }, 120); }
            return;
          }
          checked[i] = true; box.textContent = '✓'; box.style.background = '#2fb45a'; box.style.borderColor = '#2fb45a';
          say('');
          if (checked[2]) go.disabled = false;
        } }, [box, h('span', { text: name })]);
      return row;
    });
    rows.forEach(function (r) { wrap.appendChild(r); });
    var bar = h('i');
    var barWrap = h('div', { class: 'bar', style: { marginTop: '6px' } }, [bar]);
    var go = h('button', { class: 'primary', disabled: true, onclick: function () {
      if (running) return;
      running = true; go.disabled = true; say('렌더 중…');
      var p = 0;
      stop = Tasks.loop(function (dt) {
        p = Math.min(1, p + dt / 2);
        bar.style.width = (p * 100) + '%';
        if (p >= 1 && stop) { stop(); stop = null; done(); }
      });
    } }, ['렌더']);
    wrap.appendChild(go);
    wrap.appendChild(barWrap);
    stage.appendChild(wrap);
    say('샷을 위에서부터 체크한 뒤 [렌더]를 누르세요.');
    return function () { if (stop) stop(); };
  }

  Tasks.kinds.render = { title: '렌더 큐 걸기', label: '렌더 큐 걸기', mount: mount, next: next };
})(window);
