/* ============================================================
   사무실 임포스터 — 첫 화면과 대기실

   화면만 그린다. 방을 만들고 들어가는 실제 일은 game.js 가 하고,
   여기서는 버튼이 눌렸다고 알려 주기만 한다.
   ============================================================ */
(function (global) {
  'use strict';

  var UI = global.UI, h = UI.h;

  function title(root, o) {
    UI.clear(root);
    var name = h('input', { maxlength: '12', placeholder: '이름 (12자까지)', value: o.name || '' });
    var code = h('input', { maxlength: '4', placeholder: '방 코드 4자리', style: { textTransform: 'uppercase', letterSpacing: '6px' } });
    var err = h('div', { class: 'err' });
    var busy = false;

    function nm() {
      var v = name.value.trim();
      if (!v) { err.textContent = '이름을 먼저 적어 주세요.'; name.focus(); return null; }
      return v.slice(0, 12);
    }
    function run(p) {
      if (busy) return;
      busy = true; err.textContent = '';
      Promise.resolve(p).then(function (msg) { busy = false; if (msg) err.textContent = msg; },
        function () { busy = false; err.textContent = '연결에 실패했어요. 인터넷 연결을 확인하고 다시 눌러 주세요.'; });
    }
    var mk = h('button', { class: 'primary', onclick: function () { var n = nm(); if (n) run(o.onCreate(n)); } }, ['방 만들기']);
    var join = h('button', { onclick: function () { var n = nm(); if (n) run(o.onJoin(n, code.value)); } }, ['들어가기']);
    code.addEventListener('keydown', function (e) { if (e.key === 'Enter') join.click(); });

    root.appendChild(h('div', { class: 'page' }, [
      h('div', { class: 'card' }, [
        h('h1', { class: 'title' }, ['사무실 ', h('b', { text: '임포스터' })]),
        h('p', { class: 'sub', text: '우리 중에 일 안 하는 사람이 있다. 업무를 끝내거나, 범인을 찾아내세요.' }),
        h('div', { class: 'label', text: '내 이름' }),
        name,
        h('div', { class: 'label', text: '새 방' }),
        mk,
        h('div', { class: 'label', text: '친구 방에 들어가기' }),
        h('div', { class: 'row' }, [code, join]),
        err,
        o.localNote ? h('div', { class: 'hint', text: o.localNote }) : null
      ])
    ]));
    if (!name.value) name.focus();
  }

  function room(root, v, o) {
    UI.clear(root);
    var list = h('ul', { class: 'who' }, v.who.map(function (w) {
      return h('li', { class: w.me ? 'me' : '' }, [
        UI.beanIcon(w.color, 34),
        h('span', { text: w.name + (w.me ? ' (나)' : '') }),
        w.host ? h('span', { class: 'star', text: '★ 방장' }) : null
      ]);
    }));

    var colors = h('div', { class: 'colors' }, UI.COLORS.map(function (c, i) {
      var used = v.used.indexOf(i) >= 0 && v.myColor !== i;
      return h('button', {
        class: v.myColor === i ? 'sel' : '', title: c.name, disabled: used,
        style: { background: c.hex }, onclick: function () { o.onColor(i); }
      });
    }));

    var impSeg = h('div', { class: 'seg' }, [1, 2].map(function (n) {
      return h('button', {
        class: v.imp === n ? 'sel' : '', disabled: !v.isHost || n > v.impMax,
        onclick: function () { o.onImp(n); }
      }, ['임포스터 ' + n + '명']);
    }));

    var copy = h('button', { onclick: function () {
      var done = function () { UI.toast('방 코드를 복사했어요: ' + v.code); };
      if (navigator.clipboard) navigator.clipboard.writeText(v.code).then(done, done); else done();
    } }, ['복사']);

    root.appendChild(h('div', { class: 'page' }, [
      h('div', { class: 'card' }, [
        h('div', { class: 'row', style: { justifyContent: 'space-between' } }, [
          h('div', {}, [h('div', { class: 'label', style: { margin: 0 }, text: '방 코드 — 동료에게 불러 주세요' }), h('div', { class: 'code', text: v.code })]),
          copy
        ]),
        h('div', { class: 'label', text: '모인 사람 ' + v.who.length + '명 (4~10명)' }),
        list,
        h('div', { class: 'label', text: '내 색' }),
        colors,
        h('div', { class: 'label', text: '임포스터 수' + (v.isHost ? '' : ' (방장이 정해요)') }),
        impSeg,
        h('div', { class: 'row', style: { marginTop: '20px' } }, [
          h('button', { onclick: o.onLeave }, ['나가기']),
          v.isHost ? h('button', { class: 'primary', style: { flex: 1 }, disabled: !v.canStart, onclick: o.onStart }, ['시작'])
                   : h('div', { class: 'hint', style: { flex: 1, textAlign: 'center' }, text: '방장이 시작하기를 기다리는 중…' })
        ]),
        h('div', { class: 'hint', text: v.why || '' })
      ])
    ]));
  }

  global.Lobby = { title: title, room: room };
})(window);
