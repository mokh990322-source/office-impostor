'use strict';
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { spawn } = require('child_process');
const path = require('path');

/* lan_server.py 를 창 없이 띄워 Firebase 와 같은 동작을 하는지 본다. 파이썬이 없으면 건너뛴다. */
const PORT = 8899;
const BASE = 'http://127.0.0.1:' + PORT;
let proc = null, skip = false;

before(async () => {
  await new Promise((resolve) => {
    try {
      proc = spawn('python', [path.join(__dirname, '..', 'lan_server.py'), '--headless', '--port=' + PORT], { stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (e) { skip = true; return resolve(); }
    proc.on('error', () => { skip = true; resolve(); });
    proc.stdout.on('data', (d) => { if (String(d).includes('READY')) resolve(); });
    setTimeout(() => { if (!proc.exitCode) resolve(); }, 4000);
  });
});
after(() => { if (proc) proc.kill(); });

const put = (p, v) => fetch(BASE + '/db/' + p + '.json', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(v) });
const get = (p) => fetch(BASE + '/db/' + p + '.json').then(r => r.json());
const del = (p) => fetch(BASE + '/db/' + p + '.json', { method: 'DELETE' });

/* SSE 를 읽어 이벤트 목록을 모은다. 연결 재사용을 피하려고 http 모듈로 새 연결을 연다. */
function watch(p, n, ms) {
  const http = require('http');
  const events = []; let buf = '', req = null;
  const done = new Promise((resolve) => {
    req = http.get(BASE + '/db/' + p + '.json', { headers: { Accept: 'text/event-stream' }, agent: false }, (res) => {
      res.setEncoding('utf8');
      res.on('data', (d) => {
        buf += d;
        let i;
        while ((i = buf.indexOf('\n\n')) >= 0) {
          const chunk = buf.slice(0, i); buf = buf.slice(i + 2);
          const ev = /event: (.*)/.exec(chunk)[1], data = JSON.parse(/data: (.*)/.exec(chunk)[1]);
          if (ev !== 'keep-alive') events.push({ ev, data });
          if (events.length >= n) resolve();
        }
      });
      res.on('end', resolve);
    });
    req.on('error', resolve);
  });
  return { events, stop: () => req.destroy(), wait: () => Promise.race([done, new Promise(r => setTimeout(r, ms || 2000))]) };
}

test('쓰고 읽고 지운다, 빈 칸은 사라진다', async (t) => {
  if (skip) return t.skip('python 없음');
  await put('crew/LANT/meta', { host: 'p1', phase: 'lobby' });
  assert.deepEqual(await get('crew/LANT/meta'), { host: 'p1', phase: 'lobby' });
  await put('crew/LANT/st', { t: 1, b: [], m: { v: [] } });
  assert.deepEqual(await get('crew/LANT/st'), { t: 1 }, 'Firebase 처럼 빈 배열·객체는 사라진다');
  await del('crew/LANT');
  assert.equal(await get('crew/LANT'), null);
});

test('crew 밖은 거부한다', async (t) => {
  if (skip) return t.skip('python 없음');
  const r = await put('scores/x', { name: 'a' });
  assert.equal(r.status, 403);
});

test('스트림: 처음엔 전체, 이후엔 상대 경로로 바뀐 것만', async (t) => {
  if (skip) return t.skip('python 없음');
  await put('crew/LANS/meta', { host: 'p1', phase: 'lobby' });
  const w = watch('crew/LANS', 3);
  for (let k = 0; k < 50 && !w.events.length; k++) await new Promise(r => setTimeout(r, 20));   // 첫 이벤트(연결됨)까지 기다림
  await put('crew/LANS/in/p2', { x: 1, y: 0, n: 1, k: 'use', a: 'btn' });
  await put('crew/LANS', { meta: { host: 'p2', phase: 'play' } });
  await w.wait();
  w.stop();
  assert.deepEqual(w.events[0], { ev: 'put', data: { path: '/', data: { meta: { host: 'p1', phase: 'lobby' } } } });
  assert.deepEqual(w.events[1], { ev: 'put', data: { path: '/in/p2', data: { x: 1, y: 0, n: 1, k: 'use', a: 'btn' } } });
  assert.deepEqual(w.events[2], { ev: 'put', data: { path: '/', data: { meta: { host: 'p2', phase: 'play' } } } });
  await del('crew/LANS');
});

test('게임 파일도 내준다', async (t) => {
  if (skip) return t.skip('python 없음');
  const html = await fetch(BASE + '/').then(r => r.text());
  assert.ok(html.includes('사무실 임포스터'));
});
