/* ============================================================
   사무실 임포스터 — 게임 중 화면 위 표시 (HUD)

   진행 바, 내 역할과 임무 목록, 오른쪽 아래 큰 버튼들, 사보타주 메뉴,
   알림 띠, 가운데 큰 글씨(역할 공개·죽음 안내).

   DOM 은 한 번 만들고 render 때 바뀐 글자만 갈아 끼운다.
   매 프레임 innerHTML 을 새로 쓰면 버튼을 누르는 순간 버튼이 바뀌어
   클릭이 먹지 않는다.
   ============================================================ */
(function (global) {
  'use strict';

  var UI = global.UI, h = UI.h;
  var root, el = {}, hd = {}, last = {};

  function setText(node, key, v) { if (last[key] !== v) { last[key] = v; node.textContent = v; } }
  function show(node, key, on) { var v = on ? '' : 'none'; if (last[key] !== v) { last[key] = v; node.style.display = v; } }

  function act(cls, label, key, onclick) {
    var b = h('button', { class: 'act ' + cls, onclick: onclick }, [
      h('span', { text: label }), h('small', { text: key })
    ]);
    b.cd = h('div', { class: 'cd', style: { display: 'none' } });
    b.appendChild(b.cd);
    return b;
  }

  function init(rootEl, handlers) {
    root = rootEl; hd = handlers || {};
    UI.clear(root); last = {};
    el.top = h('div', { class: 'hud-top' }, [
      h('div', { class: 'bar-label', text: '회사 업무 진행률' }),
      el.barWrap = h('div', { class: 'bar' }, [el.bar = h('i')])
    ]);
    el.left = h('div', { class: 'hud-left' }, [
      el.role = h('div', { class: 'role' }),
      el.fake = h('div', { class: 'fake', text: '가짜 임무 — 하는 척만 하세요. 진행 바는 안 올라가요.' }),
      el.tasks = h('ul')
    ]);
    el.use = act('use', '사용', 'E', function () { if (hd.use) hd.use(); });
    el.report = act('report', '신고', 'R', function () { if (hd.report) hd.report(); });
    el.kill = act('kill', '킬', 'Q', function () { if (hd.kill) hd.kill(); });
    el.sab = act('sab', '사보타주', 'Tab', function () { if (hd.sabMenu) hd.sabMenu(); });
    el.btns = h('div', { class: 'hud-btns' }, [el.sab, el.kill, el.report, el.use]);
    el.menu = h('div', { class: 'menu', style: { display: 'none' } }, [
      h('div', { class: 't', text: '사보타주 (Tab 으로 닫기)' }),
      el.mLights = h('button', { onclick: function () { if (hd.sab) hd.sab('lights'); } }, ['정전 (직원 시야 줄이기)']),
      el.mReactor = h('button', { class: 'danger', onclick: function () { if (hd.sab) hd.sab('reactor'); } }, ['서버 과열 (45초 안에 못 막으면 승리)']),
      el.mNote = h('div', { class: 't' })
    ]);
    el.alert = h('div', { class: 'alert', style: { display: 'none' } });
    el.vent = h('div', { class: 'alert vent', style: { display: 'none' } });
    el.edge = h('div', { class: 'redge', style: { display: 'none' } });
    el.banner = h('div', { class: 'banner', style: { display: 'none' } }, [el.bTitle = h('h1'), el.bSub = h('p')]);
    el.wait = h('div', { class: 'wait', style: { display: 'none' } });
    [el.edge, el.top, el.left, el.btns, el.menu, el.alert, el.vent, el.banner, el.wait].forEach(function (n) { root.appendChild(n); });
  }

  function button(b, key, o) {
    show(b, key + 'show', o.show !== false);
    var dis = !o.on;
    if (last[key + 'dis'] !== dis) { last[key + 'dis'] = dis; b.disabled = dis; }
    if (o.label !== undefined) setText(b.firstChild, key + 'label', o.label);
    var cdTxt = o.cd > 0 ? String(Math.ceil(o.cd)) : '';
    show(b.cd, key + 'cdshow', !!cdTxt);
    setText(b.cd, key + 'cd', cdTxt);
  }

  /* v = { role, mates, tasks:[{text,done}], progress, use:{on,label}, report:{on}, kill:{show,on,cd},
           sab:{show,on,cd}, menu, alert:null|{cls,text}, vent:string|null, edge, banner:null|{title,sub,color}, wait } */
  function render(v) {
    if (!root) return;
    var bw = Math.round((v.progress || 0) * 1000) / 10 + '%';
    if (last.bar !== bw) { last.bar = bw; el.bar.style.width = bw; }

    var roleTxt = v.role === 'imp' ? '임포스터' + (v.mates && v.mates.length ? ' · 동료: ' + v.mates.join(', ') : '')
      : v.role === 'crew' ? '직원 — 업무를 끝내고 임포스터를 찾으세요' : '역할 받는 중…';
    if (v.ghost) roleTxt = '유령 — ' + (v.role === 'imp' ? '사보타주만 할 수 있어요' : '남은 임무를 계속하세요');
    setText(el.role, 'role', roleTxt);
    var rc = 'role ' + (v.role || '');
    if (last.rc !== rc) { last.rc = rc; el.role.className = rc; }
    show(el.fake, 'fake', v.role === 'imp');
    var tk = JSON.stringify(v.tasks || []);
    if (last.tasks !== tk) {
      last.tasks = tk; UI.clear(el.tasks);
      (v.tasks || []).forEach(function (t) { el.tasks.appendChild(h('li', { class: t.done ? 'done' : '', text: t.text })); });
    }

    button(el.use, 'use', { on: v.use && v.use.on, label: (v.use && v.use.label) || '사용' });
    button(el.report, 'rep', { on: v.report && v.report.on, show: !v.ghost });
    button(el.kill, 'kill', { on: v.kill && v.kill.on, show: v.kill && v.kill.show, cd: v.kill && v.kill.cd });
    button(el.sab, 'sab', { on: v.sab && v.sab.on, show: v.sab && v.sab.show, cd: v.sab && v.sab.cd });

    show(el.menu, 'menu', !!(v.menu && v.sab && v.sab.show));
    if (v.menu) {
      var dis = !(v.sab && v.sab.on);
      el.mLights.disabled = dis; el.mReactor.disabled = dis;
      setText(el.mNote, 'mnote', dis ? (v.sab && v.sab.cd > 0 ? Math.ceil(v.sab.cd) + '초 뒤에 다시 걸 수 있어요' : '이미 사보타주가 진행 중이에요') : '');
    }

    show(el.alert, 'alert', !!v.alert);
    if (v.alert) {
      setText(el.alert, 'alertT', v.alert.text);
      var ac = 'alert ' + v.alert.cls;
      if (last.ac !== ac) { last.ac = ac; el.alert.className = ac; }
    }
    show(el.vent, 'vent', !!v.vent);
    if (v.vent) setText(el.vent, 'ventT', v.vent);
    show(el.edge, 'edge', !!v.edge);

    show(el.banner, 'banner', !!v.banner);
    if (v.banner) {
      setText(el.bTitle, 'bt', v.banner.title);
      setText(el.bSub, 'bs', v.banner.sub || '');
      if (last.bc !== v.banner.color) { last.bc = v.banner.color; el.bTitle.style.color = v.banner.color || '#fff'; }
    }
    show(el.wait, 'wait', !!v.wait);
    if (v.wait) setText(el.wait, 'waitT', v.wait);
    show(el.top, 'top', !v.wait);
    show(el.left, 'left', !v.wait);
    show(el.btns, 'btns', !v.wait);
  }

  function hide() { if (root) UI.clear(root); root = null; last = {}; }

  global.Hud = { init: init, render: render, hide: hide };
})(window);
