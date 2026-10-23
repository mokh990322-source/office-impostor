/* ============================================================
   사무실 임포스터 — 회의 화면, 추방 연출, 결과 화면

   카드 목록은 내용이 바뀔 때만 다시 그린다. 채팅 입력칸은 한 번 만들고
   그대로 둔다(다시 만들면 치던 글자가 날아간다).
   ============================================================ */
(function (global) {
  'use strict';

  var UI = global.UI, h = UI.h;
  var layer = null, root = null, hd = {}, el = {}, last = {}, pick = null, view = null;
  var splashEl = null, ejectEl = null, resultEl = null, ejectStop = null;

  function mmss(s) { s = Math.max(0, s | 0); return Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2); }

  function open(layerEl, handlers) {
    if (root) return;
    layer = layerEl; hd = handlers || {}; last = {}; pick = null;
    el.time = h('span', { class: 'time' });
    el.stage = h('span');
    el.cards = h('div', { class: 'cards' });
    el.log = h('div', { class: 'log' });
    el.input = h('input', { maxlength: '120', placeholder: '채팅 입력 후 Enter' });
    el.note = h('div', { class: 'note' });
    el.sendBtn = h('button', { onclick: send }, ['보내기']);
    el.input.addEventListener('keydown', function (e) { e.stopPropagation(); if (e.key === 'Enter') send(); });
    el.skip = h('button', { onclick: function () { if (hd.vote) hd.vote('skip'); } }, ['건너뛰기']);
    el.skipVoters = h('div', { class: 'skipvoters' });
    el.foot = h('div', { class: 'meet-foot' }, [el.skip, el.skipVoters, el.help = h('div', { class: 'hint' })]);
    root = h('div', { class: 'meet' }, [h('div', { class: 'tablet' }, [
      h('div', { class: 'meet-head' }, [el.stage, el.time]),
      h('div', { class: 'meet-body' }, [
        el.cards,
        h('div', { class: 'chat' }, [el.log, el.note, h('div', { class: 'send' }, [el.input, el.sendBtn])])
      ]),
      el.foot
    ])]);
    layer.appendChild(root);
  }

  function send() {
    var t = el.input.value.trim();
    if (!t) return;
    el.input.value = '';
    if (hd.send) hd.send(t.slice(0, 120));
  }

  function card(p, v) {
    var canVote = v.stage === 'vote' && v.meAlive && !v.meVoted && p.alive && p.pid !== v.me;
    var c = h('div', { class: 'pcard' + (p.alive ? '' : ' dead') + (canVote ? ' can' : '') }, [
      UI.beanIcon(p.color, 52, { dead: !p.alive }),
      h('div', {}, [h('div', { class: 'nm', text: p.name + (p.pid === v.me ? ' (나)' : '') }),
        p.isBy ? h('div', { style: { fontSize: '12px' }, text: v.body ? '📢 신고함' : '🚨 회의 소집' }) : null]),
      p.voted && v.stage !== 'reveal' ? h('span', { class: 'tag', text: '투표함' }) : null
    ]);
    if (v.stage === 'reveal' && v.votes) {
      var dots = h('div', { class: 'voters' });
      Object.keys(v.votes).forEach(function (voter) {
        if (v.votes[voter] !== p.pid) return;
        var vp = v.byPid[voter];
        dots.appendChild(h('i', { style: { background: UI.hex(vp ? vp.color : 0) } }));
      });
      c.appendChild(dots);
    }
    if (canVote) {
      c.addEventListener('click', function () { pick = p.pid; last.cards = null; render(view); });
      if (pick === p.pid) {
        c.appendChild(h('div', { class: 'confirm' }, [
          h('button', { class: 'danger', title: '투표', onclick: function (e) { e.stopPropagation(); pick = null; if (hd.vote) hd.vote(p.pid); } }, ['✔']),
          h('button', { title: '취소', onclick: function (e) { e.stopPropagation(); pick = null; last.cards = null; render(view); } }, ['✖'])
        ]));
      }
    }
    return c;
  }

  /* v = { stage, left, me, meAlive, meVoted, by, body, players:[{pid,name,color,alive,voted,isBy}],
           chat:[{key,pid,name,color,m,g}], votes|null, byPid } */
  function render(v) {
    if (!root || !v) return;
    view = v;
    var st = v.stage === 'talk' ? '토론 시간 — 의심 가는 사람을 이야기하세요' :
      v.stage === 'vote' ? '투표 시간 — 카드를 눌러 투표하세요' : '투표 결과';
    if (last.stage !== st) { last.stage = st; el.stage.textContent = st; }
    var tm = v.stage === 'reveal' ? '' : (v.stage === 'talk' ? '토론 ' : '투표 ') + mmss(v.left);
    if (last.tm !== tm) { last.tm = tm; el.time.textContent = tm; }

    var key = JSON.stringify([v.stage, v.meVoted, v.meAlive, v.players, v.votes, pick]);
    if (last.cards !== key) {
      last.cards = key; UI.clear(el.cards);
      v.players.forEach(function (p) { el.cards.appendChild(card(p, v)); });
      UI.clear(el.skipVoters);
      if (v.stage === 'reveal' && v.votes) {
        Object.keys(v.votes).forEach(function (voter) {
          if (v.votes[voter] !== 'skip') return;
          var vp = v.byPid[voter];
          el.skipVoters.appendChild(h('i', { style: { background: UI.hex(vp ? vp.color : 0) } }));
        });
      }
      el.skip.disabled = !(v.stage === 'vote' && v.meAlive && !v.meVoted);
      el.help.textContent = !v.meAlive ? '유령은 투표할 수 없어요.' :
        v.stage === 'talk' ? '토론이 끝나면 투표가 열려요.' : v.meVoted ? '투표했어요. 결과를 기다리는 중…' :
        v.stage === 'vote' ? '' : '';
    }

    var ck = v.chat.length ? v.chat[v.chat.length - 1].key + ':' + v.chat.length : '0';
    if (last.chat !== ck) {
      last.chat = ck;
      var atBottom = el.log.scrollTop + el.log.clientHeight >= el.log.scrollHeight - 30;
      UI.clear(el.log);
      if (!v.chat.length) el.log.appendChild(h('div', { class: 'note', text: '아직 아무도 말하지 않았어요.' }));
      v.chat.forEach(function (c) {
        el.log.appendChild(h('div', { class: 'line' + (c.g ? ' ghost' : '') }, [
          h('i', { style: { width: '10px', height: '10px', borderRadius: '50%', background: UI.hex(c.color), display: 'inline-block', marginTop: '6px', flex: 'none' } }),
          h('b', { text: c.name + (c.g ? ' 👻' : '') }), h('span', { text: c.m })
        ]));
      });
      if (atBottom) el.log.scrollTop = el.log.scrollHeight;
    }
    var nt = v.meAlive ? '' : '유령의 말은 유령에게만 보여요.';
    if (last.note !== nt) { last.note = nt; el.note.textContent = nt; }
  }

  function close() {
    if (root && root.parentNode) root.parentNode.removeChild(root);
    root = null; view = null; pick = null;
    hideSplash(); hideEject();
  }

  function isOpen() { return !!root; }

  function splash(layerEl, title, sub, ms) {
    hideSplash();
    splashEl = h('div', { class: 'splash' }, [h('h1', { text: title }), h('p', { text: sub || '' })]);
    layerEl.appendChild(splashEl);
    var me = splashEl;
    setTimeout(function () { if (splashEl === me) hideSplash(); }, ms || 1600);
  }
  function hideSplash() { if (splashEl && splashEl.parentNode) splashEl.parentNode.removeChild(splashEl); splashEl = null; }

  /* 추방 연출: 검은 하늘에 별, 콩이 빙글빙글 돌며 가로질러 날아간다 */
  function eject(layerEl, o) {
    hideEject();
    var cv = h('canvas');
    var line = o.nobody ? '아무도 추방되지 않았습니다.' :
      o.name + '님은 임포스터' + (o.imp ? '였습니다.' : '가 아니었습니다.');
    var txt = h('h2', { text: '' });
    var sub = h('p', { text: '' });
    ejectEl = h('div', { class: 'eject' }, [cv, txt, sub]);
    layerEl.appendChild(ejectEl);
    var W = cv.width = ejectEl.clientWidth || 800, H = cv.height = ejectEl.clientHeight || 600;
    var ctx = cv.getContext('2d'), stars = [];
    for (var i = 0; i < 120; i++) stars.push([Math.random() * W, Math.random() * H, Math.random() * 1.6 + 0.4]);
    var t0 = performance.now(), on = true;
    function frame(now) {
      if (!on) return;
      var t = (now - t0) / 1000;
      ctx.fillStyle = '#05060a'; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#fff';
      stars.forEach(function (s) { s[0] -= s[2] * 0.6; if (s[0] < 0) s[0] = W; ctx.fillRect(s[0], s[1], s[2], s[2]); });
      if (!o.nobody) {
        var x = -80 + (W + 160) * Math.min(1, t / 2.6);
        ctx.save(); ctx.translate(x, H / 2 - 60); ctx.rotate(t * 3);
        UI.drawBean(ctx, 0, 17, 2, o.color, {});
        ctx.restore();
      }
      var n = Math.min(line.length, Math.floor(t * 18));
      txt.textContent = line.slice(0, n);
      if (n >= line.length && o.impsLeft !== undefined) sub.textContent = '남은 임포스터 ' + o.impsLeft + '명';
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
    ejectStop = function () { on = false; };
  }
  function hideEject() {
    if (ejectStop) ejectStop(); ejectStop = null;
    if (ejectEl && ejectEl.parentNode) ejectEl.parentNode.removeChild(ejectEl); ejectEl = null;
  }

  var WHY = {
    tasks: '업무를 모두 끝냈습니다', vote: '임포스터를 모두 찾아냈습니다',
    kill: '직원이 너무 많이 사라졌습니다', sab: '서버가 과열로 멈췄습니다'
  };
  function result(layerEl, o) {
    hideResult();
    resultEl = h('div', { class: 'result space' }, [
      o.mine ? h('div', { class: 'mine', style: { color: o.won ? '#5ff0ff' : '#ff5b5b' }, text: o.won ? '승리' : '패배' }) : null,
      h('h1', { class: o.side, text: o.side === 'crew' ? '직원 승리' : '임포스터 승리' }),
      h('div', { class: 'why', text: WHY[o.why] || '' }),
      h('div', { class: 'label', text: '임포스터였던 사람' }),
      h('div', { class: 'imps' }, o.imps.map(function (p) {
        return h('div', {}, [h('span', { text: p.name }), UI.beanIcon(p.color, 96)]);
      })),
      h('p', { class: 'hint', text: '잠시 뒤 대기실로 돌아가요.' })
    ]);
    layerEl.appendChild(resultEl);
  }
  function hideResult() { if (resultEl && resultEl.parentNode) resultEl.parentNode.removeChild(resultEl); resultEl = null; }

  global.Meeting = {
    open: open, render: render, close: close, isOpen: isOpen,
    splash: splash, eject: eject, hideEject: hideEject, result: result, hideResult: hideResult
  };
})(window);
