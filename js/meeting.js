/* ============================================================
   모몽어스 — 회의 화면, 추방 연출, 결과 화면

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
      o.pel ? o.name + '님은 펠리컨이었습니다.' :
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

  /* 처형 장면 (죽은 사람 화면에만, 약 2.6초).
     범인이 왼쪽에서 달려들어 칼로 찌르고, 나는 쓰러져 시체가 된다.
     killerColor() 는 범인 색 번호를 돌려준다. 봉투가 아직 안 왔으면 null → 검은 그림자로 그린다. */
  var killEl = null;
  function killScene(layerEl, myColor, killerColor) {
    if (killEl && killEl.parentNode) killEl.parentNode.removeChild(killEl);
    var cv = h('canvas');
    killEl = h('div', { class: 'kill-scene' }, [cv]);
    layerEl.appendChild(killEl);
    var me = killEl, dpr = global.devicePixelRatio || 1;
    var W = (killEl.clientWidth || 800), H = (killEl.clientHeight || 600);
    cv.width = W * dpr; cv.height = H * dpr;
    var ctx = cv.getContext('2d'), t0 = performance.now(), DUR = 2.6;
    var S = Math.min(W, H) / 120;               // 콩 배율
    function ease(x) { return x < 0 ? 0 : x > 1 ? 1 : 1 - Math.pow(1 - x, 3); }
    function knife(x, y, s, ang) {
      ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.scale(s, s);
      ctx.lineWidth = 2.5; ctx.strokeStyle = '#0b0d12'; ctx.lineJoin = 'round';
      ctx.fillStyle = '#7a4a24'; ctx.beginPath(); ctx.rect(-14, -3, 12, 6); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#e8eef5'; ctx.beginPath(); ctx.moveTo(-2, -5); ctx.lineTo(22, -1); ctx.lineTo(24, 1); ctx.lineTo(-2, 5); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.restore();
    }
    function frame(now) {
      if (killEl !== me) return;
      var t = (now - t0) / 1000;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      /* 배경: 검붉은 방사형 + 바닥 띠 */
      var g = ctx.createRadialGradient(W / 2, H / 2, 10, W / 2, H / 2, Math.max(W, H) * 0.7);
      g.addColorStop(0, '#5a0d12'); g.addColorStop(1, '#05060c');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      var floorY = H * 0.68;
      ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(0, floorY, W, H - floorY);
      ctx.fillStyle = '#0b0d12'; ctx.fillRect(0, floorY - 3, W, 6);

      var vx = W * 0.6, kx0 = -W * 0.2, kx1 = W * 0.42;
      var kx = kx0 + (kx1 - kx0) * ease((t - 0.25) / 0.45);
      var hit = t >= 0.8;

      /* 나: 찔리기 전엔 서 있고, 찔리면 흔들리다 쓰러진다 */
      if (t < 1.25) {
        var shake = hit ? Math.sin(t * 90) * 4 * (1.25 - t) : 0;
        UI.drawBean(ctx, vx + shake, floorY, S, myColor, { flip: true });
      } else {
        UI.drawBody(ctx, vx, floorY, S, myColor);
      }

      /* 범인 */
      var kc = killerColor();
      ctx.save();
      if (kc === null || kc === undefined) ctx.filter = 'brightness(0)';
      UI.drawBean(ctx, kx, floorY, S, kc === null || kc === undefined ? 0 : kc, { bob: t < 0.7 ? Math.abs(Math.sin(t * 20)) * S * 2 : 0, walk: t < 0.7 ? t * 20 : null });
      ctx.restore();
      if (t > 0.55) {
        var thrust = ease((t - 0.6) / 0.2) - ease((t - 1.0) / 0.3) * 0.6;
        knife(kx + S * 14 + thrust * S * 14, floorY - S * 10, S * 0.9, 0);   // 손 높이 (얼굴을 가리지 않게)
      }

      /* 찌르는 순간 번쩍 */
      if (t > 0.8 && t < 0.95) { ctx.fillStyle = 'rgba(255,255,255,' + (1 - (t - 0.8) / 0.15).toFixed(2) + ')'; ctx.fillRect(0, 0, W, H); }

      /* 글씨 */
      if (t > 1.4) {
        var a = Math.min(1, (t - 1.4) / 0.3);
        ctx.globalAlpha = a;
        ctx.font = Math.round(S * 9) + 'px "Black Han Sans","Do Hyeon","Malgun Gothic",sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
        ctx.lineWidth = S * 1.6; ctx.strokeStyle = '#0b0d12'; ctx.fillStyle = '#ff4d4d';
        ctx.strokeText('처치당했습니다', W / 2, H * 0.22); ctx.fillText('처치당했습니다', W / 2, H * 0.22);
        ctx.globalAlpha = 1;
      }
      /* 끝: 서서히 사라짐 */
      if (t > DUR - 0.3) { killEl.style.opacity = String(Math.max(0, (DUR - t) / 0.3)); }
      if (t >= DUR) { if (killEl && killEl.parentNode) killEl.parentNode.removeChild(killEl); killEl = null; return; }
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  /* 꿀꺽 장면 (삼켜진 사람 화면에만, 약 2.6초).
     펠리컨(콩 + 커다란 주황 부리)이 부리를 쩍 벌리고, 나는 빨려 들어가 작아진다. */
  function eatScene(layerEl, myColor, pelColor) {
    if (killEl && killEl.parentNode) killEl.parentNode.removeChild(killEl);
    var cv = h('canvas');
    killEl = h('div', { class: 'kill-scene' }, [cv]);
    layerEl.appendChild(killEl);
    var me = killEl, dpr = global.devicePixelRatio || 1;
    var W = (killEl.clientWidth || 800), H = (killEl.clientHeight || 600);
    cv.width = W * dpr; cv.height = H * dpr;
    var ctx = cv.getContext('2d'), t0 = performance.now(), DUR = 2.6;
    var S = Math.min(W, H) / 120;
    function ease(x) { return x < 0 ? 0 : x > 1 ? 1 : 1 - Math.pow(1 - x, 3); }
    function beak(x, y, open) {
      /* 위 부리는 들리고, 아래 부리 주머니는 처진다 */
      ctx.save(); ctx.translate(x, y); ctx.scale(S, S);
      ctx.lineWidth = 2.2; ctx.strokeStyle = '#0b0d12'; ctx.lineJoin = 'round';
      ctx.save(); ctx.rotate(-open * 0.5);
      ctx.fillStyle = '#ffd27a'; ctx.beginPath(); ctx.moveTo(0, -2); ctx.quadraticCurveTo(18, -6, 34, 0); ctx.lineTo(0, 3); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.restore();
      ctx.save(); ctx.rotate(open * 0.35);
      ctx.fillStyle = '#ff7a1a'; ctx.beginPath(); ctx.moveTo(0, 2); ctx.lineTo(34, 2); ctx.quadraticCurveTo(22, 20 + open * 8, 4, 12); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.restore();
      ctx.restore();
    }
    function frame(now) {
      if (killEl !== me) return;
      var t = (now - t0) / 1000;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      var g = ctx.createRadialGradient(W / 2, H / 2, 10, W / 2, H / 2, Math.max(W, H) * 0.7);
      g.addColorStop(0, '#6b3a0a'); g.addColorStop(1, '#05060c');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      var floorY = H * 0.68;
      ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(0, floorY, W, H - floorY);
      ctx.fillStyle = '#0b0d12'; ctx.fillRect(0, floorY - 3, W, 6);

      var px = W * 0.3, open = ease(t / 0.5) - ease((t - 1.15) / 0.2);
      /* 펠리컨 */
      var pc = pelColor();
      ctx.save();
      if (pc === null || pc === undefined) ctx.filter = 'brightness(0)';
      UI.drawBean(ctx, px, floorY, S * 1.2, pc === null || pc === undefined ? 0 : pc, {});
      ctx.restore();
      var bx = px + S * 14, by = floorY - S * 22;   // 얼굴 창 오른쪽, 입 높이

      /* 나: 0.5초부터 부리 쪽으로 빨려 들어간다 */
      var k = ease((t - 0.5) / 0.6);
      if (k < 1) {
        var vx = W * 0.72 + (bx + S * 14 - W * 0.72) * k, vy = floorY + (by + S * 6 - floorY) * k;
        ctx.save(); ctx.translate(vx, vy); ctx.rotate(-k * 4); ctx.scale(1 - k * 0.8, 1 - k * 0.8);
        UI.drawBean(ctx, 0, 0, S, myColor, { flip: true, bob: k ? 0 : Math.abs(Math.sin(t * 20)) * S });
        ctx.restore();
      }
      beak(bx, by, open);
      /* 삼킨 뒤 목이 불룩 */
      if (t > 1.15 && t < 2) {
        var sw = Math.sin(Math.min(1, (t - 1.15) / 0.85) * Math.PI);
        ctx.fillStyle = '#ff7a1a'; ctx.strokeStyle = '#0b0d12'; ctx.lineWidth = S * 1.2;
        ctx.beginPath(); ctx.ellipse(bx + S * 6, by + S * 10, S * (4 + sw * 6), S * (3 + sw * 5), 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      }

      if (t > 1.2) {
        var a = Math.min(1, (t - 1.2) / 0.3);
        ctx.globalAlpha = a;
        ctx.font = Math.round(S * 10) + 'px "Black Han Sans","Do Hyeon","Malgun Gothic",sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
        ctx.lineWidth = S * 1.6; ctx.strokeStyle = '#0b0d12'; ctx.fillStyle = '#ffb347';
        ctx.strokeText('꿀꺽!', W / 2, H * 0.2); ctx.fillText('꿀꺽!', W / 2, H * 0.2);
        ctx.globalAlpha = 1;
      }
      if (t > DUR - 0.3) { killEl.style.opacity = String(Math.max(0, (DUR - t) / 0.3)); }
      if (t >= DUR) { if (killEl && killEl.parentNode) killEl.parentNode.removeChild(killEl); killEl = null; return; }
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  var WHY = {
    tasks: '업무를 모두 끝냈습니다', vote: '임포스터를 모두 찾아냈습니다',
    kill: '직원이 너무 많이 사라졌습니다', sab: '서버가 과열로 멈췄습니다',
    eat: '펠리컨이 배를 가득 채웠습니다'
  };
  function result(layerEl, o) {
    hideResult();
    resultEl = h('div', { class: 'result space' }, [
      o.mine ? h('div', { class: 'mine', style: { color: o.won ? '#5ff0ff' : '#ff5b5b' }, text: o.won ? '승리' : '패배' }) : null,
      h('h1', { class: o.side, text: o.side === 'crew' ? '직원 승리' : o.side === 'pel' ? '펠리컨 단독 승리' : '임포스터 승리' }),
      h('div', { class: 'why', text: WHY[o.why] || '' }),
      h('div', { class: 'label', text: '임포스터였던 사람' }),
      h('div', { class: 'imps' }, o.imps.map(function (p) {
        return h('div', {}, [h('span', { text: p.name }), UI.beanIcon(p.color, 96)]);
      })),
      o.pels && o.pels.length ? h('div', { class: 'label', text: '펠리컨이었던 사람' }) : null,
      o.pels && o.pels.length ? h('div', { class: 'pels' }, o.pels.map(function (p) {
        return h('div', {}, [h('span', { text: p.name }), UI.beanIcon(p.color, 72)]);
      })) : null,
      h('p', { class: 'hint', text: '잠시 뒤 대기실로 돌아가요.' })
    ]);
    layerEl.appendChild(resultEl);
  }
  function hideResult() { if (resultEl && resultEl.parentNode) resultEl.parentNode.removeChild(resultEl); resultEl = null; }

  global.Meeting = {
    open: open, render: render, close: close, isOpen: isOpen,
    splash: splash, eject: eject, hideEject: hideEject, result: result, hideResult: hideResult, killScene: killScene, eatScene: eatScene
  };
})(window);
