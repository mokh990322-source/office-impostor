# 사무실 임포스터 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 회사 동료 4~10명이 브라우저로 방 코드를 쳐서 하는 사무실 테마 어몽어스.

**Architecture:** 모코파크와 같은 호스트 권위 구조. 방장 브라우저가 `rules.js`(순수 규칙)로 판을 계산해 Firebase `crew/<코드>/st`에 10Hz로 올리고, 참가자는 `in/<pid>`에 입력·명령만 쓴다. 역할은 ECDH+AES-GCM으로 본인만 풀게 `sec/<pid>`에 둔다. Firebase 없이도 개발할 수 있게 같은 API의 `LocalNet`(BroadcastChannel)과 방장 탭 안에서 도는 시험용 봇(`?bots=N`)을 둔다.

**Tech Stack:** 순수 JS(ES5 스타일 IIFE), Canvas2D, DOM, WebCrypto, Firebase Realtime DB REST+SSE, Node 24 `node --test`.

## Global Constraints

- 폴더 `C:\Users\NAU\Desktop\OfficeImpostor`, 자체 git(main). 커밋 작성자는 저장소 로컬 설정 `mokh990322-source <mokh990322-source@users.noreply.github.com>`.
- 외부 라이브러리 0, 이미지 파일 0, 클래식 `<script>`만. 모든 js 파일은 `(function (global) { 'use strict'; ... })(window);`
- 전역 이름 `Map`을 덮어쓰지 않는다. 맵 모듈 전역 이름은 `OfficeMap`.
- Firebase 경로는 `crew/` 아래만. `scores/`, `rooms/`에 절대 쓰지 않는다.
- 사용자에게 보이는 글은 전부 한국어. 오류는 "무엇을 확인하라" 안내 문장.
- 한글이 든 파일은 Write 도구로 쓴다(`python - <<EOF` 금지). `.bat`는 cp949로 저장.
- 숫자 상수는 `Rules.C` 한 곳에만 둔다: 속도 170px/s, 반지름 14, 칸 32px, 킬 48, 신고 48, 사용 56, 버튼 80, 환풍구 40, 킬쿨 25초, 버튼 대기 15초, 1인 1회, 토론 60, 투표 30, 추방 연출 4, 결과 10, 첫 사보타주 10초, 사보타주 쿨 30, 서버 과열 45, 시야 직원 192·임포스터 288·정전 48, 1인 임무 5.
- 테스트 실행: 저장소 루트에서 `node --test`.

## 파일 지도

| 파일 | 책임 |
|---|---|
| `js/cloud-config.js` | Firebase 주소 |
| `js/net.js` | 모코파크 복사. `Net.put/del/get/watch/applyEvent` |
| `js/localnet.js` | `?local` 이면 `Net`을 BroadcastChannel 판으로 바꿔 끼움 |
| `js/room.js` | 모코파크 복사. 방 코드, 살아있는 사람, 방장 승계 판단 |
| `js/interp.js` | 모코파크 복사. 남 보간, 내 예측 보정 |
| `js/map.js` | `OfficeMap`: 격자, 방, 물건, 시작 자리 |
| `js/geom.js` | `Geom`: 충돌 이동, 시야 다각형, 시선 |
| `js/rules.js` | `Rules`: 판 규칙 전부 |
| `js/roles.js` | `Roles`: 역할·임무 뽑기, 암호화 |
| `js/snap.js` | `Snap.pack`: 방송용 상태 |
| `js/tasks/*.js` | 미니게임 6개 + 공통 창 |
| `js/view.js` | 캔버스 그리기 |
| `js/hud.js` | 진행 바, 임무 목록, 버튼, 알림 |
| `js/meeting.js` | 회의 화면 |
| `js/lobby.js` | 첫 화면, 대기실 |
| `js/devbots.js` | `?bots=N` 시험용 봇 |
| `js/game.js` | 조립: 방장 루프, 참가자 루프 |
| `testlib/load.js`, `testlib/walker.js` | Node 시험 도구 |
| `test/*.test.js` | 시험 |
| `docs/firebase-rules-crew.json` | 콘솔에 붙일 규칙 |
| `게임 실행.bat`, `깃허브업데이트.bat`, `README.md` | 실행·배포 |

## 맵 좌표 (칸 단위, 안쪽 포함)

격자 58×40. 방 3×3 배치.

| | x 2~15 | x 22~35 | x 42~55 |
|---|---|---|---|
| y 2~11 | 대표실 | 서버실 | 렌더팜 |
| y 16~25 | 탕비실 | 회의실 | 복사실 |
| y 30~37 | 휴게실 | 엘리베이터 홀 | 창고 |

- 이웃한 방끼리 폭 3칸 복도로 모두 잇는다(가로 6개, 세로 6개).
- 회의실 탁자: x26~30, y19~21 막힘. 긴급 버튼은 탁자 가운데(28,20).
- 엘리베이터 홀은 복도 역할의 빈 방이다(물건 없음). 설계서의 "방 8개와 복도"에서 복도 허브에 해당.

| id | 종류 | 칸 | 방 |
|---|---|---|---|
| btn | button | 28,20 | 회의실 |
| stamp1 | task/stamp | 23,17 | 회의실 |
| coffee | task/coffee | 3,17 | 탕비실 |
| cable | task/cable | 23,3 | 서버실 |
| render | task/render | 43,3 | 렌더팜 |
| copier1 | task/copier | 54,17 | 복사실 |
| plant | task/plant | 3,31 | 휴게실 |
| stamp2 | task/stamp | 3,3 | 대표실 |
| copier2 | task/copier | 43,31 | 창고 |
| p1 | panel | 34,3 | 서버실 |
| p2 | panel | 54,3 | 렌더팜 |
| breaker | breaker | 54,31 | 창고 |
| A1/A2 | vent | 13,24 / 43,24 | 탕비실 / 복사실 |
| B1/B2 | vent | 54,10 / 14,10 | 렌더팜 / 대표실 |
| C1/C2 | vent | 14,36 / 54,36 | 휴게실 / 창고 |

시작 자리 10개: (25,18) (27,18) (29,18) (31,18) (25,22) (27,22) (29,22) (31,22) (24,20) (32,20).

## 규칙 결정 (설계서에서 구현 수준으로 굳힌 것)

- 서버 패널 누르기·두꺼비집 고치기는 **역할과 상관없이 산 사람 누구나** 할 수 있다. 직원만 되게 하면 "임포스터가 눌렀는데 표시가 안 뜬다"로 정체가 드러난다.
- 사보타주 쿨다운은 사보타주가 **끝난 때부터** 30초. 첫 사보타주는 판 시작 10초 뒤부터.
- 회의가 열리면 진행 중인 사보타주는 풀린다.
- 환풍구에 들어간 직후 0.3초 동안은 방향키로 나가지 않는다(들어갈 때 누르고 있던 키 때문에 바로 튀어나오는 것 방지).
- 투표 대상이 그사이 나갔으면 그 표는 무효가 아니라 "아무도 추방 안 됨"으로 처리한다.
- 회의 채팅은 방장이 회의를 시작할 때 `chat/`를 지워서 새로 시작한다. 글의 `t`(쓴 사람 시계)는 정렬에만 쓴다.
- 나간 사람은 `Room.alive(who, now, seenAt)`로 판단한다(값이 바뀌는 걸 내 시계로 봤는지). `who.seen` 값을 내 시계와 빼지 않는다.

---

## 1단계

### Task 1: 뼈대와 접속 부품

**Files:**
- Create: `js/cloud-config.js`, `testlib/load.js`, `.gitignore`
- Copy from `C:\Users\NAU\Desktop\Overworked`: `js/net.js`, `js/room.js`, `js/interp.js`, `test/net-apply.test.js`, `test/room-code.test.js`, `test/room-host.test.js`, `test/interp.test.js`
- Modify: 복사한 파일 머리말의 "오버워크드/모코파크" → "사무실 임포스터 (모코파크에서 가져옴)"

**Interfaces:**
- Produces: `testlib/load.js` → `load(names: string[], win?: object) → win`. `names`는 `js/` 기준 경로(`'tasks/coffee'` 가능).
- Produces: `window.Net`, `window.Room`, `window.Interp` (모코파크와 동일 API)

- [ ] **Step 1: 파일 복사**

```bash
cd /c/Users/NAU/Desktop/OfficeImpostor
mkdir -p js/tasks test testlib
cp ../Overworked/js/net.js ../Overworked/js/room.js ../Overworked/js/interp.js js/
cp ../Overworked/test/net-apply.test.js ../Overworked/test/room-code.test.js ../Overworked/test/room-host.test.js ../Overworked/test/interp.test.js test/
```

- [ ] **Step 2: `testlib/load.js` 작성**

```js
'use strict';
const fs = require('fs');
const path = require('path');

/* js/<name>.js 는 IIFE 라 require 가 안 된다. 가짜 window 위에 직접 평가한다.
   crypto, btoa, atob, TextEncoder 는 Node 24 전역에 이미 있어서 그대로 보인다. */
function load(names, win) {
  const w = win || {};
  for (const n of [].concat(names)) {
    const src = fs.readFileSync(path.join(__dirname, '..', 'js', n + '.js'), 'utf8');
    new Function('window', 'globalThis', src + '\n//# sourceURL=' + n + '.js')(w, w);
  }
  return w;
}

module.exports = { load };
```

- [ ] **Step 3: `js/cloud-config.js`**

```js
/* ============================================================
   사무실 임포스터 — Firebase 주소

   퇴근의 계단·모코파크와 같은 프로젝트다. 경로만 다르다.
   이 게임은 crew/ 아래만 쓴다. scores/ (사내 랭킹), rooms/ (모코파크)는
   절대 건드리지 않는다.
   ============================================================ */
(function (global) {
  'use strict';
  global.CLOUD_URL = 'https://mohag-8a5b8-default-rtdb.asia-southeast1.firebasedatabase.app';
})(window);
```

- [ ] **Step 4: `.gitignore`**

```
node_modules/
*.log
shots/
```

- [ ] **Step 5: 시험** — Run: `node --test` / Expected: 복사한 4개 파일 시험 전부 통과.
- [ ] **Step 6: Commit** — `git add -A && git commit -m "뼈대: 모코파크 접속 부품 가져오기"`

---

### Task 2: 맵과 기하

**Files:**
- Create: `js/map.js`, `js/geom.js`, `test/map.test.js`, `test/geom.test.js`

**Interfaces:**
- Produces `OfficeMap`: `T=32, W=58, H=40`, `solid(tx,ty)→bool` (범위 밖 true), `rooms: [{id,name,x0,y0,x1,y1}]`, `objects: [{id,kind,type?,tx,ty,room}]`, `byId(id)→obj|null`, `center(obj)→{x,y}` (칸 중심 px), `roomAt(px,py)→name|''`, `spawn(i)→{x,y}` (i는 10으로 나눈 나머지), `ventPair(id)→id`, `stationIds()→string[]`
- Produces `Geom`: `hits(map,x,y,r)→bool`, `move(map,x,y,dx,dy,r)→{x,y}`, `ray(map,x,y,ang,max)→거리`, `vision(map,x,y,radius,n?)→[[x,y],...]`, `clear(map,ax,ay,bx,by)→bool`, `canSee(map,ax,ay,bx,by,radius)→bool`

- [ ] **Step 1: 시험 작성 `test/map.test.js`**

```js
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { load } = require('../testlib/load');
const M = load(['map']).OfficeMap;

function bfs(start) {
  const seen = new Set([start.join(',')]);
  const q = [start];
  while (q.length) {
    const [x, y] = q.shift();
    for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const nx = x + dx, ny = y + dy, k = nx + ',' + ny;
      if (seen.has(k) || M.solid(nx, ny)) continue;
      seen.add(k); q.push([nx, ny]);
    }
  }
  return seen;
}

test('격자 크기와 바깥은 막힘', () => {
  assert.equal(M.W, 58); assert.equal(M.H, 40);
  assert.equal(M.solid(-1, 5), true);
  assert.equal(M.solid(0, 0), true);
  assert.equal(M.solid(58, 5), true);
});

test('방 9개, 이름이 설계대로', () => {
  assert.deepEqual(M.rooms.map(r => r.name).sort(),
    ['대표실','렌더팜','복사실','서버실','엘리베이터 홀','창고','탕비실','회의실','휴게실'].sort());
});

test('임무 장소 8개, 종류 6가지', () => {
  const ids = M.stationIds();
  assert.equal(ids.length, 8);
  const types = new Set(ids.map(id => M.byId(id).type));
  assert.deepEqual([...types].sort(), ['cable','coffee','copier','plant','render','stamp']);
});

test('버튼 말고 모든 물건은 바닥 위, 버튼은 탁자 위', () => {
  for (const o of M.objects) {
    if (o.id === 'btn') assert.equal(M.solid(o.tx, o.ty), true, 'btn');
    else assert.equal(M.solid(o.tx, o.ty), false, o.id);
  }
});

test('시작 자리 10개는 바닥이고 서로 다르다', () => {
  const keys = new Set();
  for (let i = 0; i < 10; i++) {
    const p = M.spawn(i);
    assert.equal(M.solid(Math.floor(p.x / M.T), Math.floor(p.y / M.T)), false);
    keys.add(p.x + ',' + p.y);
  }
  assert.equal(keys.size, 10);
});

test('시작 자리에서 모든 물건에 걸어서 닿는다', () => {
  const s = M.spawn(0);
  const reach = bfs([Math.floor(s.x / M.T), Math.floor(s.y / M.T)]);
  for (const o of M.objects) {
    if (o.id === 'btn') { assert.ok(reach.has('28,18'), 'btn 위쪽'); continue; }
    assert.ok(reach.has(o.tx + ',' + o.ty), o.id);
  }
});

test('환풍구 짝은 서로를 가리킨다', () => {
  for (const id of ['A1','A2','B1','B2','C1','C2']) {
    assert.equal(M.ventPair(M.ventPair(id)), id);
    assert.notEqual(M.ventPair(id), id);
  }
});

test('roomAt 은 방 안에서 방 이름, 복도에서 빈 문자열', () => {
  assert.equal(M.roomAt(28.5 * 32, 17.5 * 32), '회의실');
  assert.equal(M.roomAt(18 * 32, 20 * 32), '');
});
```

- [ ] **Step 2: Run** `node --test test/map.test.js` / Expected: FAIL (`map.js` 없음)

- [ ] **Step 3: `js/map.js`**

```js
/* ============================================================
   사무실 임포스터 — 맵 데이터

   사무실 한 층. 3×3 으로 방을 놓고 이웃끼리 폭 3칸 복도로 잇는다.
   한가운데가 회의실(긴급 버튼), 시작 자리도 회의실 탁자 둘레다.

   격자 한 칸 = 32px. 1 이 벽, 0 이 바닥.
   전역 이름을 Map 으로 하면 브라우저 내장 Map 을 덮어쓴다. 그래서 OfficeMap.
   ============================================================ */
(function (global) {
  'use strict';

  var T = 32, W = 58, H = 40;
  var COLS = [[2, 15], [22, 35], [42, 55]];
  var ROWS = [[2, 11], [16, 25], [30, 37]];
  var NAMES = [
    ['대표실', '서버실', '렌더팜'],
    ['탕비실', '회의실', '복사실'],
    ['휴게실', '엘리베이터 홀', '창고']
  ];

  var grid = new Array(W * H);
  for (var i = 0; i < grid.length; i++) grid[i] = 1;

  function carve(x0, y0, x1, y1, v) {
    for (var y = y0; y <= y1; y++)
      for (var x = x0; x <= x1; x++)
        if (x >= 0 && y >= 0 && x < W && y < H) grid[y * W + x] = v;
  }
  function mid(r) { return Math.floor((r[0] + r[1]) / 2); }

  var rooms = [];
  for (var r = 0; r < 3; r++) {
    for (var c = 0; c < 3; c++) {
      rooms.push({ id: 'r' + r + c, name: NAMES[r][c],
        x0: COLS[c][0], y0: ROWS[r][0], x1: COLS[c][1], y1: ROWS[r][1] });
      carve(COLS[c][0], ROWS[r][0], COLS[c][1], ROWS[r][1], 0);
    }
  }
  /* 가로 복도: 같은 줄의 이웃 방 사이 */
  for (r = 0; r < 3; r++) {
    for (c = 0; c < 2; c++) {
      var my = mid(ROWS[r]);
      carve(COLS[c][1] + 1, my - 1, COLS[c + 1][0] - 1, my + 1, 0);
    }
  }
  /* 세로 복도: 같은 칸의 이웃 방 사이 */
  for (c = 0; c < 3; c++) {
    for (r = 0; r < 2; r++) {
      var mx = mid(COLS[c]);
      carve(mx - 1, ROWS[r][1] + 1, mx + 1, ROWS[r + 1][0] - 1, 0);
    }
  }
  /* 회의실 탁자 */
  carve(26, 19, 30, 21, 1);

  var objects = [
    { id: 'btn',     kind: 'button',  tx: 28, ty: 20 },
    { id: 'stamp1',  kind: 'task', type: 'stamp',  tx: 23, ty: 17 },
    { id: 'coffee',  kind: 'task', type: 'coffee', tx: 3,  ty: 17 },
    { id: 'cable',   kind: 'task', type: 'cable',  tx: 23, ty: 3 },
    { id: 'render',  kind: 'task', type: 'render', tx: 43, ty: 3 },
    { id: 'copier1', kind: 'task', type: 'copier', tx: 54, ty: 17 },
    { id: 'plant',   kind: 'task', type: 'plant',  tx: 3,  ty: 31 },
    { id: 'stamp2',  kind: 'task', type: 'stamp',  tx: 3,  ty: 3 },
    { id: 'copier2', kind: 'task', type: 'copier', tx: 43, ty: 31 },
    { id: 'p1',      kind: 'panel',   tx: 34, ty: 3 },
    { id: 'p2',      kind: 'panel',   tx: 54, ty: 3 },
    { id: 'breaker', kind: 'breaker', tx: 54, ty: 31 },
    { id: 'A1', kind: 'vent', tx: 13, ty: 24 },
    { id: 'A2', kind: 'vent', tx: 43, ty: 24 },
    { id: 'B1', kind: 'vent', tx: 54, ty: 10 },
    { id: 'B2', kind: 'vent', tx: 14, ty: 10 },
    { id: 'C1', kind: 'vent', tx: 14, ty: 36 },
    { id: 'C2', kind: 'vent', tx: 54, ty: 36 }
  ];
  var PAIR = { A1: 'A2', A2: 'A1', B1: 'B2', B2: 'B1', C1: 'C2', C2: 'C1' };
  var SPAWN = [[25, 18], [27, 18], [29, 18], [31, 18], [25, 22], [27, 22], [29, 22], [31, 22], [24, 20], [32, 20]];

  function solid(tx, ty) {
    if (tx < 0 || ty < 0 || tx >= W || ty >= H) return true;
    return grid[ty * W + tx] === 1;
  }
  function roomAtTile(tx, ty) {
    for (var i = 0; i < rooms.length; i++) {
      var m = rooms[i];
      if (tx >= m.x0 && tx <= m.x1 && ty >= m.y0 && ty <= m.y1) return m.name;
    }
    return '';
  }
  function roomAt(px, py) { return roomAtTile(Math.floor(px / T), Math.floor(py / T)); }
  objects.forEach(function (o) { o.room = roomAtTile(o.tx, o.ty); });

  var byIdMap = {};
  objects.forEach(function (o) { byIdMap[o.id] = o; });

  global.OfficeMap = {
    T: T, W: W, H: H, rooms: rooms, objects: objects,
    solid: solid,
    roomAt: roomAt,
    byId: function (id) { return Object.prototype.hasOwnProperty.call(byIdMap, id) ? byIdMap[id] : null; },
    center: function (o) { return { x: (o.tx + 0.5) * T, y: (o.ty + 0.5) * T }; },
    spawn: function (i) { var s = SPAWN[((i % 10) + 10) % 10]; return { x: (s[0] + 0.5) * T, y: (s[1] + 0.5) * T }; },
    ventPair: function (id) { return PAIR[id] || null; },
    stationIds: function () { return objects.filter(function (o) { return o.kind === 'task'; }).map(function (o) { return o.id; }); }
  };
})(window);
```

- [ ] **Step 4: Run** `node --test test/map.test.js` / Expected: PASS

- [ ] **Step 5: 시험 작성 `test/geom.test.js`**

```js
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { load } = require('../testlib/load');
const W = load(['map', 'geom']);
const M = W.OfficeMap, G = W.Geom;

const ROOM = { x: 28.5 * 32, y: 17.5 * 32 };   // 회의실 위쪽 바닥

test('벽에 박히지 않는다', () => {
  // 회의실 위쪽 벽(y=15 줄)으로 300px 밀기. 단, 세로 복도(x27~29)가 아닌 x=23 에서.
  const p = G.move(M, 23.5 * 32, 16.5 * 32, 0, -300, 14);
  assert.ok(p.y >= 16 * 32 + 14 - 0.01, 'y=' + p.y);
});

test('벽을 따라 미끄러진다', () => {
  const p = G.move(M, 23.5 * 32, 16 * 32 + 14, 40, -40, 14);
  assert.ok(p.x > 23.5 * 32 + 30, 'x 는 움직임');
  assert.ok(p.y >= 16 * 32 + 14 - 0.01, 'y 는 막힘');
});

test('빈 곳에서는 그대로 움직인다', () => {
  const p = G.move(M, ROOM.x, ROOM.y, 10, 0, 14);
  assert.ok(Math.abs(p.x - (ROOM.x + 10)) < 1e-9);
});

test('시야 다각형은 반경을 넘지 않는다', () => {
  const pts = G.vision(M, ROOM.x, ROOM.y, 192, 64);
  assert.equal(pts.length, 64);
  for (const [x, y] of pts) assert.ok(Math.hypot(x - ROOM.x, y - ROOM.y) <= 192 + 1e-6);
});

test('벽 너머는 안 보이고 같은 방은 보인다', () => {
  assert.equal(G.canSee(M, ROOM.x, ROOM.y, 23.5 * 32, 17.5 * 32, 288), true);
  // 회의실 위쪽 벽 너머 서버실 (복도 아닌 x=23)
  assert.equal(G.canSee(M, 23.5 * 32, 16.5 * 32, 23.5 * 32, 10.5 * 32, 288), false);
});

test('반경 밖은 안 보인다', () => {
  assert.equal(G.canSee(M, ROOM.x, ROOM.y, ROOM.x + 200, ROOM.y, 192), false);
});
```

- [ ] **Step 6: Run** `node --test test/geom.test.js` / Expected: FAIL

- [ ] **Step 7: `js/geom.js`**

```js
/* ============================================================
   사무실 임포스터 — 충돌과 시야

   캐릭터는 원, 벽은 격자 칸이다. 이동은 4px 이하로 잘게 나눠
   x, y 를 따로 시도한다. 한 축이 막혀도 다른 축은 움직여서
   벽을 따라 미끄러진다.

   시야는 광선을 여러 갈래로 쏴서 처음 벽에 닿는 곳까지를 잇는다.
   꼭짓점을 정확히 계산하는 방식보다 단순하고, 160갈래면 눈에는 충분하다.
   ============================================================ */
(function (global) {
  'use strict';

  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }

  function hits(map, x, y, r) {
    var T = map.T;
    var tx0 = Math.floor((x - r) / T), tx1 = Math.floor((x + r) / T);
    var ty0 = Math.floor((y - r) / T), ty1 = Math.floor((y + r) / T);
    for (var ty = ty0; ty <= ty1; ty++) {
      for (var tx = tx0; tx <= tx1; tx++) {
        if (!map.solid(tx, ty)) continue;
        var nx = clamp(x, tx * T, tx * T + T), ny = clamp(y, ty * T, ty * T + T);
        var dx = x - nx, dy = y - ny;
        if (dx * dx + dy * dy < r * r) return true;
      }
    }
    return false;
  }

  function move(map, x, y, dx, dy, r) {
    var n = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / 4));
    var sx = dx / n, sy = dy / n;
    for (var i = 0; i < n; i++) {
      if (sx && !hits(map, x + sx, y, r)) x += sx;
      if (sy && !hits(map, x, y + sy, r)) y += sy;
    }
    return { x: x, y: y };
  }

  var STEP = 4;

  function ray(map, x, y, ang, max) {
    var c = Math.cos(ang), s = Math.sin(ang), T = map.T;
    for (var d = 0; d < max; d += STEP) {
      if (map.solid(Math.floor((x + c * d) / T), Math.floor((y + s * d) / T))) return d;
    }
    return max;
  }

  function vision(map, x, y, radius, n) {
    n = n || 160;
    var pts = [];
    for (var i = 0; i < n; i++) {
      var a = i / n * Math.PI * 2;
      var d = ray(map, x, y, a, radius);
      pts.push([x + Math.cos(a) * d, y + Math.sin(a) * d]);
    }
    return pts;
  }

  function clear(map, ax, ay, bx, by) {
    var dx = bx - ax, dy = by - ay, len = Math.sqrt(dx * dx + dy * dy), T = map.T;
    if (len < 1e-6) return true;
    for (var d = 0; d <= len; d += STEP) {
      var k = d / len;
      if (map.solid(Math.floor((ax + dx * k) / T), Math.floor((ay + dy * k) / T))) return false;
    }
    return true;
  }

  function canSee(map, ax, ay, bx, by, radius) {
    var dx = bx - ax, dy = by - ay;
    if (dx * dx + dy * dy > radius * radius) return false;
    return clear(map, ax, ay, bx, by);
  }

  global.Geom = { hits: hits, move: move, ray: ray, vision: vision, clear: clear, canSee: canSee };
})(window);
```

- [ ] **Step 8: Run** `node --test` / Expected: 전부 PASS
- [ ] **Step 9: Commit** — `git add -A && git commit -m "맵과 충돌·시야"`

---

### Task 3: 게임 규칙

**Files:**
- Create: `js/rules.js`, `test/rules.test.js`

**Interfaces:**
- Consumes: `OfficeMap`, `Geom`
- Produces `Rules`:
  - `C` 상수 묶음 (Global Constraints 값 그대로)
  - `create(list:[{pid,name,color}], roles:{pid:'imp'|'crew'}, tasks:{pid:[stationId]}) → state`
  - `step(state, dt, inputs:{pid:{x,y,cmds:[{k,a}]}}) → events[]` (상태를 그 자리에서 고침)
  - `drop(state, pid) → events[]`
  - `progress(state) → {done,total}`, `counts(state) → {imp,crew}` (산 사람만), `tally(votes) → pid|null`
- 상태 모양:
  ```
  { phase:'play'|'meeting'|'result', t, order:[pid], players:{pid:{name,color,x,y,alive,left,role,tasks,done,killCd,btnLeft,vent,ventAt,ix,iy}},
    bodies:[{pid,x,y}], btnCdUntil, sab:null|{kind:'lights'}|{kind:'reactor',until,held:{p1?,p2?}}, sabCdUntil,
    meeting:null|{by,body,stage:'talk'|'vote'|'reveal',until,votes:{pid:target|'skip'},ejected,ejectedImp,impsLeft},
    winner:null|'crew'|'imp', why:null|'tasks'|'vote'|'kill'|'sab', resultUntil, ended }
  ```
- 명령 `k`: `use`(a=물건 id), `kill`(a=pid), `report`(a=시체 pid), `vote`(a=pid|'skip'), `sab`(a='lights'|'reactor'), `hold`(a='p1'|'p2'|'')
- 이벤트 `type`: `task, kill, meeting, vote, voted, reveal, resume, win, end, vent, ventmove, unvent, sab, fixed`

- [ ] **Step 1: 시험 작성 `test/rules.test.js`**

```js
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { load } = require('../testlib/load');
const W = load(['map', 'geom', 'rules']);
const R = W.Rules, M = W.OfficeMap;

function mk(n, imps, tasks) {
  const list = [], roles = {}, tk = {};
  for (let i = 1; i <= n; i++) {
    const pid = 'p' + i;
    list.push({ pid, name: '사람' + i, color: i - 1 });
    roles[pid] = imps.includes(pid) ? 'imp' : 'crew';
    tk[pid] = tasks || ['stamp1', 'coffee'];
  }
  return R.create(list, roles, tk);
}
function at(s, pid, x, y) { s.players[pid].x = x; s.players[pid].y = y; }
function cmd(s, pid, k, a) { return R.step(s, 0.01, { [pid]: { x: 0, y: 0, cmds: [{ k, a }] } }); }
function run(s, secs, inputs) { const ev = []; const dt = 1 / 30; for (let t = 0; t < secs; t += dt) ev.push(...R.step(s, dt, inputs || {})); return ev; }
const C = R.C;
const cen = id => M.center(M.byId(id));

test('만들면 판 진행 중, 회의실 시작 자리', () => {
  const s = mk(5, ['p1']);
  assert.equal(s.phase, 'play');
  assert.deepEqual({ x: s.players.p1.x, y: s.players.p1.y }, M.spawn(0));
  assert.equal(s.players.p1.role, 'imp');
  assert.equal(s.players.p2.role, 'crew');
});

test('이동: 1초 오른쪽이면 속도만큼', () => {
  const s = mk(4, ['p1']);
  const x0 = s.players.p2.x;
  R.step(s, 0.5, { p2: { x: 1, y: 0 } });
  assert.ok(Math.abs(s.players.p2.x - (x0 + C.SPEED * 0.5)) < 1e-6);
});

test('대각선 입력은 1로 눌러 속도를 넘지 않는다', () => {
  const s = mk(4, ['p1']);
  const p = s.players.p2, x0 = p.x, y0 = p.y;
  at(s, 'p2', 28.5 * 32, 17.5 * 32);
  R.step(s, 0.1, { p2: { x: 1, y: 1 } });
  const d = Math.hypot(p.x - 28.5 * 32, p.y - 17.5 * 32);
  assert.ok(d <= C.SPEED * 0.1 + 1e-6, String(d));
  void x0; void y0;
});

test('임무: 장소 근처에서 use 하면 완료, 멀면 무시', () => {
  const s = mk(4, ['p1']);
  const c = cen('coffee');
  at(s, 'p2', c.x + 200, c.y);
  cmd(s, 'p2', 'use', 'coffee');
  assert.equal(!!s.players.p2.done.coffee, false);
  at(s, 'p2', c.x + 20, c.y);
  const ev = cmd(s, 'p2', 'use', 'coffee');
  assert.equal(s.players.p2.done.coffee, true);
  assert.ok(ev.some(e => e.type === 'task'));
});

test('임무: 내 목록에 없는 장소, 임포스터는 무시', () => {
  const s = mk(4, ['p1']);
  const c = cen('cable');
  at(s, 'p2', c.x, c.y + 20);
  cmd(s, 'p2', 'use', 'cable');
  assert.equal(!!s.players.p2.done.cable, false);
  const k = cen('coffee');
  at(s, 'p1', k.x, k.y + 20);
  cmd(s, 'p1', 'use', 'coffee');
  assert.equal(!!s.players.p1.done.coffee, false);
});

test('진행률은 직원 임무만 센다', () => {
  const s = mk(4, ['p1']);
  assert.deepEqual(R.progress(s), { done: 0, total: 6 });
});

test('킬: 쿨다운 중엔 안 되고, 끝나면 거리 안에서 된다', () => {
  const s = mk(5, ['p1']);
  at(s, 'p1', 28.5 * 32, 17.5 * 32); at(s, 'p2', 28.5 * 32 + 30, 17.5 * 32);
  cmd(s, 'p1', 'kill', 'p2');
  assert.equal(s.players.p2.alive, true, '쿨다운');
  s.players.p1.killCd = 0;
  cmd(s, 'p1', 'kill', 'p2');
  assert.equal(s.players.p2.alive, false);
  assert.equal(s.bodies.length, 1);
  assert.equal(s.players.p1.killCd, C.KILL_CD);
  assert.equal(s.players.p1.x, s.bodies[0].x);
});

test('킬: 멀면 안 되고, 임포스터끼리 안 되고, 직원은 못 한다', () => {
  const s = mk(8, ['p1', 'p2']);
  s.players.p1.killCd = 0; s.players.p3.killCd = 0;
  at(s, 'p1', 28.5 * 32, 17.5 * 32); at(s, 'p4', 28.5 * 32 + 100, 17.5 * 32);
  cmd(s, 'p1', 'kill', 'p4'); assert.equal(s.players.p4.alive, true, '거리');
  at(s, 'p2', 28.5 * 32 + 20, 17.5 * 32);
  cmd(s, 'p1', 'kill', 'p2'); assert.equal(s.players.p2.alive, true, '동료');
  at(s, 'p3', 28.5 * 32 + 90, 17.5 * 32 + 10);
  at(s, 'p4', 28.5 * 32 + 100, 17.5 * 32 + 10);
  cmd(s, 'p3', 'kill', 'p4'); assert.equal(s.players.p4.alive, true, '직원');
});

test('킬쿨은 시간이 가면 줄어든다', () => {
  const s = mk(5, ['p1']);
  run(s, 5);
  assert.ok(Math.abs(s.players.p1.killCd - (C.KILL_CD - 5)) < 0.05);
});

test('신고: 시체 근처에서 회의, 시체는 치운다', () => {
  const s = mk(5, ['p1']);
  s.players.p1.killCd = 0;
  at(s, 'p1', 23.5 * 32, 17.5 * 32); at(s, 'p2', 23.5 * 32 + 20, 17.5 * 32);
  cmd(s, 'p1', 'kill', 'p2');
  at(s, 'p3', s.bodies[0].x + 20, s.bodies[0].y);
  const ev = cmd(s, 'p3', 'report', 'p2');
  assert.equal(s.phase, 'meeting');
  assert.equal(s.meeting.by, 'p3'); assert.equal(s.meeting.body, 'p2');
  assert.equal(s.bodies.length, 0);
  assert.ok(ev.some(e => e.type === 'meeting'));
});

test('신고: 멀면 안 된다', () => {
  const s = mk(5, ['p1']);
  s.bodies.push({ pid: 'p5', x: 100, y: 100 });
  at(s, 'p3', 23.5 * 32, 17.5 * 32);
  cmd(s, 'p3', 'report', 'p5');
  assert.equal(s.phase, 'play');
});

test('긴급 버튼: 대기 시간 뒤 탁자 근처에서 한 번만', () => {
  const s = mk(5, ['p1']);
  at(s, 'p2', 28.5 * 32, 18.5 * 32);
  cmd(s, 'p2', 'use', 'btn');
  assert.equal(s.phase, 'play', '처음 15초는 막힘');
  s.t = C.BTN_CD + 1;
  cmd(s, 'p2', 'use', 'btn');
  assert.equal(s.phase, 'meeting');
  assert.equal(s.players.p2.btnLeft, 0);
});

test('회의: 토론 → 투표 → 공개 → 재개, 추방은 시체 없이', () => {
  const s = mk(6, ['p1']);
  s.t = C.BTN_CD + 1;
  at(s, 'p2', 28.5 * 32, 18.5 * 32);
  cmd(s, 'p2', 'use', 'btn');
  run(s, C.TALK + 0.1);
  assert.equal(s.meeting.stage, 'vote');
  for (const v of ['p2', 'p3', 'p4']) cmd(s, v, 'vote', 'p5');
  for (const v of ['p1', 'p5', 'p6']) cmd(s, v, 'vote', 'skip');
  // 3 대 3 동점 → 아무도 안 나감. 다 투표했으니 바로 공개
  R.step(s, 0.01, {});
  assert.equal(s.meeting.stage, 'reveal');
  assert.equal(s.meeting.ejected, null);
  run(s, C.REVEAL + 0.1);
  assert.equal(s.phase, 'play');
  assert.equal(s.players.p1.killCd, C.KILL_CD);
  assert.deepEqual({ x: s.players.p3.x, y: s.players.p3.y }, M.spawn(2));
});

test('투표는 한 번만, 죽은 사람은 못 한다', () => {
  const s = mk(6, ['p1']);
  s.t = C.BTN_CD + 1;
  s.players.p6.alive = false;
  at(s, 'p2', 28.5 * 32, 18.5 * 32);
  cmd(s, 'p2', 'use', 'btn');
  run(s, C.TALK + 0.1);
  cmd(s, 'p2', 'vote', 'p3'); cmd(s, 'p2', 'vote', 'p4');
  assert.equal(s.meeting.votes.p2, 'p3');
  cmd(s, 'p6', 'vote', 'p3');
  assert.equal(s.meeting.votes.p6, undefined);
});

test('tally: 최다 득표, 동점·건너뛰기 최다는 null', () => {
  assert.equal(R.tally({ a: 'x', b: 'x', c: 'y' }), 'x');
  assert.equal(R.tally({ a: 'x', b: 'y' }), null);
  assert.equal(R.tally({ a: 'skip', b: 'skip', c: 'x' }), null);
  assert.equal(R.tally({ a: 'x', b: 'skip' }), null);
  assert.equal(R.tally({}), null);
});

test('임포스터를 추방하면 회의 끝에 직원 승리', () => {
  const s = mk(5, ['p1']);
  s.t = C.BTN_CD + 1;
  at(s, 'p2', 28.5 * 32, 18.5 * 32);
  cmd(s, 'p2', 'use', 'btn');
  run(s, C.TALK + 0.1);
  for (const v of ['p1', 'p2', 'p3', 'p4', 'p5']) cmd(s, v, 'vote', 'p1');
  R.step(s, 0.01, {});
  assert.equal(s.meeting.ejected, 'p1');
  assert.equal(s.meeting.ejectedImp, true);
  assert.equal(s.meeting.impsLeft, 0);
  const ev = run(s, C.REVEAL + 0.1);
  assert.equal(s.phase, 'result');
  assert.equal(s.winner, 'crew'); assert.equal(s.why, 'vote');
  assert.ok(ev.some(e => e.type === 'win'));
});

test('임포스터 수가 직원 수 이상이면 임포스터 승리', () => {
  const s = mk(4, ['p1']);
  s.players.p1.killCd = 0;
  at(s, 'p1', 23.5 * 32, 17.5 * 32); at(s, 'p2', 23.5 * 32 + 20, 17.5 * 32);
  cmd(s, 'p1', 'kill', 'p2');
  assert.equal(s.phase, 'play', '1 대 2');
  s.players.p1.killCd = 0;
  at(s, 'p3', 23.5 * 32 + 20, 17.5 * 32 + 10);
  cmd(s, 'p1', 'kill', 'p3');
  assert.equal(s.winner, 'imp'); assert.equal(s.why, 'kill');
});

test('임무를 다 하면 직원 승리 (유령 임무도 센다)', () => {
  const s = mk(4, ['p1'], ['coffee']);
  s.players.p4.alive = false;
  for (const p of ['p2', 'p3', 'p4']) {
    const c = cen('coffee');
    at(s, p, c.x + 10, c.y);
    cmd(s, p, 'use', 'coffee');
  }
  assert.equal(s.winner, 'crew'); assert.equal(s.why, 'tasks');
});

test('결과 화면 시간이 지나면 end 한 번', () => {
  const s = mk(4, ['p1'], ['coffee']);
  for (const p of ['p2', 'p3', 'p4']) { const c = cen('coffee'); at(s, p, c.x, c.y + 10); cmd(s, p, 'use', 'coffee'); }
  const ev = run(s, C.RESULT + 1);
  assert.equal(ev.filter(e => e.type === 'end').length, 1);
});

test('나간 사람: 죽은 것으로 치고 시체 없음, 임무 총량에서 빠진다', () => {
  const s = mk(5, ['p1']);
  R.drop(s, 'p2');
  assert.equal(s.players.p2.alive, false);
  assert.equal(s.bodies.length, 0);
  assert.equal(R.progress(s).total, 6);
});

test('임포스터가 나가면 직원 승리', () => {
  const s = mk(5, ['p1']);
  R.drop(s, 'p1');
  assert.equal(s.winner, 'crew');
});

test('나간 사람에게 몰린 표는 아무도 추방 안 함', () => {
  const s = mk(6, ['p1']);
  s.t = C.BTN_CD + 1;
  at(s, 'p2', 28.5 * 32, 18.5 * 32);
  cmd(s, 'p2', 'use', 'btn');
  run(s, C.TALK + 0.1);
  for (const v of ['p2', 'p3', 'p4']) cmd(s, v, 'vote', 'p6');
  R.drop(s, 'p6');
  run(s, C.VOTE + 0.1);
  assert.equal(s.meeting.ejected, null);
});

test('이상한 명령과 입력은 무시한다', () => {
  const s = mk(4, ['p1']);
  R.step(s, 0.1, { p2: { x: NaN, y: 'a', cmds: [null, { k: 5 }, { k: 'use', a: 'nope' }] }, nobody: { x: 1 } });
  assert.equal(s.phase, 'play');
});
```

- [ ] **Step 2: Run** `node --test test/rules.test.js` / Expected: FAIL (`rules.js` 없음)

- [ ] **Step 3: `js/rules.js`** (Task 4의 환풍구·사보타주·유령 규칙까지 이 파일에 함께 들어간다. 시험은 Task 4에서 추가)

```js
/* ============================================================
   사무실 임포스터 — 게임 규칙

   방장 브라우저만 이 파일로 판을 계산한다. 화면도 네트워크도 모른다.
   그래서 Node 로 한 판을 통째로 돌려 볼 수 있다.

   step(s, dt, inputs) 는 상태 s 를 그 자리에서 고치고 일어난 일을 돌려준다.
   inputs = { pid: { x, y, cmds: [{ k, a }] } }
   x, y 는 -1~1 이동 입력. 입력이 안 온 사람은 직전 입력을 계속 쓴다.

   명령은 그대로 믿지 않는다. 역할, 거리, 쿨다운, 단계를 모두 여기서 본다.
   단, 미니게임을 진짜 했는지는 알 수 없다(그건 그 사람 브라우저 안의 일이다).
   ============================================================ */
(function (global) {
  'use strict';

  var M = global.OfficeMap, G = global.Geom;

  var C = {
    SPEED: 170, R: 14,
    KILL_R: 48, REPORT_R: 48, USE_R: 56, BTN_R: 72, VENT_R: 40,
    KILL_CD: 25, BTN_CD: 15, BTN_PER_PLAYER: 1,
    TALK: 60, VOTE: 30, REVEAL: 4, RESULT: 10,
    SAB_FIRST: 10, SAB_CD: 30, REACTOR: 45, VENT_EXIT_DELAY: 0.3,
    VISION_CREW: 192, VISION_IMP: 288, VISION_LIGHTS: 48,
    TASKS_PER_PLAYER: 5
  };

  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }
  function num(v) { return (typeof v === 'number' && isFinite(v)) ? v : 0; }
  function dist(a, b) { var dx = a.x - b.x, dy = a.y - b.y; return Math.sqrt(dx * dx + dy * dy); }
  function own(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }

  function create(list, roles, tasks) {
    var s = {
      phase: 'play', t: 0, order: [], players: {}, bodies: [],
      btnCdUntil: C.BTN_CD, sab: null, sabCdUntil: C.SAB_FIRST,
      meeting: null, winner: null, why: null, resultUntil: 0, ended: false
    };
    for (var i = 0; i < list.length; i++) {
      var e = list[i], sp = M.spawn(i);
      s.players[e.pid] = {
        name: e.name, color: e.color, x: sp.x, y: sp.y,
        alive: true, left: false, role: roles[e.pid] === 'imp' ? 'imp' : 'crew',
        tasks: (tasks[e.pid] || []).slice(), done: {},
        killCd: C.KILL_CD, btnLeft: C.BTN_PER_PLAYER,
        vent: null, ventAt: 0, ix: 0, iy: 0
      };
      s.order.push(e.pid);
    }
    return s;
  }

  function progress(s) {
    var done = 0, total = 0;
    s.order.forEach(function (pid) {
      var p = s.players[pid];
      if (p.left || p.role !== 'crew') return;
      total += p.tasks.length;
      p.tasks.forEach(function (id) { if (p.done[id]) done++; });
    });
    return { done: done, total: total };
  }

  function counts(s) {
    var imp = 0, crew = 0;
    s.order.forEach(function (pid) {
      var p = s.players[pid];
      if (p.left || !p.alive) return;
      if (p.role === 'imp') imp++; else crew++;
    });
    return { imp: imp, crew: crew };
  }

  function finish(s, side, why, ev) {
    s.winner = side; s.why = why; s.phase = 'result';
    s.resultUntil = s.t + C.RESULT; s.meeting = null; s.sab = null;
    ev.push({ type: 'win', side: side, why: why });
    return true;
  }

  function checkWin(s, ev) {
    if (s.winner) return true;
    var pr = progress(s), c = counts(s);
    if (pr.total > 0 && pr.done >= pr.total) return finish(s, 'crew', 'tasks', ev);
    if (c.imp === 0) return finish(s, 'crew', 'vote', ev);
    if (c.imp >= c.crew) return finish(s, 'imp', 'kill', ev);
    return false;
  }

  /* ── 회의 ─────────────────────────────────────────────── */

  function startMeeting(s, by, body, ev) {
    s.phase = 'meeting';
    s.bodies = [];
    if (s.sab) { s.sab = null; s.sabCdUntil = s.t + C.SAB_CD; }
    s.order.forEach(function (pid) { var p = s.players[pid]; p.vent = null; p.ix = 0; p.iy = 0; });
    s.meeting = { by: by, body: body, stage: 'talk', until: s.t + C.TALK, votes: {},
      ejected: null, ejectedImp: false, impsLeft: 0 };
    ev.push({ type: 'meeting', by: by, body: body });
  }

  function tally(votes) {
    var c = {}, k;
    for (k in votes) if (own(votes, k)) c[votes[k]] = (c[votes[k]] || 0) + 1;
    var best = null, bestN = 0, tie = false;
    for (k in c) {
      if (!own(c, k)) continue;
      if (c[k] > bestN) { best = k; bestN = c[k]; tie = false; }
      else if (c[k] === bestN) tie = true;
    }
    if (!best || tie || best === 'skip') return null;
    return best;
  }

  function allVoted(s) {
    var m = s.meeting;
    return s.order.every(function (pid) {
      var p = s.players[pid];
      return p.left || !p.alive || m.votes[pid] !== undefined;
    });
  }

  function reveal(s, ev) {
    var m = s.meeting, e = tally(m.votes);
    if (e && (!s.players[e] || s.players[e].left)) e = null;
    m.stage = 'reveal'; m.until = s.t + C.REVEAL; m.ejected = e; m.ejectedImp = false;
    if (e) { s.players[e].alive = false; m.ejectedImp = s.players[e].role === 'imp'; }
    m.impsLeft = counts(s).imp;
    ev.push({ type: 'reveal', ejected: e, imp: m.ejectedImp });
  }

  function endMeeting(s, ev) {
    s.meeting = null;
    if (checkWin(s, ev)) return;
    s.phase = 'play';
    s.order.forEach(function (pid, i) {
      var p = s.players[pid], sp = M.spawn(i);
      p.x = sp.x; p.y = sp.y; p.vent = null; p.ix = 0; p.iy = 0;
      if (p.role === 'imp') p.killCd = C.KILL_CD;
    });
    s.btnCdUntil = s.t + C.BTN_CD;
    ev.push({ type: 'resume' });
  }

  function meetingStep(s, ev) {
    var m = s.meeting;
    if (!m) return;
    if (m.stage === 'talk') {
      if (s.t >= m.until) { m.stage = 'vote'; m.until = s.t + C.VOTE; ev.push({ type: 'vote' }); }
      return;
    }
    if (m.stage === 'vote') {
      if (s.t >= m.until || allVoted(s)) reveal(s, ev);
      return;
    }
    if (m.stage === 'reveal' && s.t >= m.until) endMeeting(s, ev);
  }

  /* ── 명령 ─────────────────────────────────────────────── */

  function use(s, pid, a, ev) {
    var p = s.players[pid], o = M.byId(a);
    if (!o) return;
    var d = dist(p, M.center(o));
    if (o.kind === 'task') {
      if (p.role !== 'crew' || p.tasks.indexOf(a) < 0 || p.done[a] || d > C.USE_R) return;
      p.done[a] = true;
      ev.push({ type: 'task', pid: pid, id: a });
      checkWin(s, ev);
      return;
    }
    if (o.kind === 'button') {
      if (!p.alive || p.btnLeft <= 0 || s.t < s.btnCdUntil || d > C.BTN_R) return;
      if (s.sab && s.sab.kind === 'reactor') return;
      p.btnLeft--;
      startMeeting(s, pid, null, ev);
      return;
    }
    if (o.kind === 'vent') {
      if (p.role !== 'imp' || !p.alive) return;
      var c = M.center(o);
      if (p.vent) {
        if (M.ventPair(p.vent) !== a) return;
        p.vent = a; p.x = c.x; p.y = c.y; p.ventAt = s.t;
        ev.push({ type: 'ventmove', pid: pid, id: a });
        return;
      }
      if (d > C.VENT_R) return;
      p.vent = a; p.x = c.x; p.y = c.y; p.ventAt = s.t;
      ev.push({ type: 'vent', pid: pid, id: a });
      return;
    }
    if (o.kind === 'breaker') {
      if (!s.sab || s.sab.kind !== 'lights' || !p.alive || d > C.USE_R) return;
      s.sab = null; s.sabCdUntil = s.t + C.SAB_CD;
      ev.push({ type: 'fixed', kind: 'lights' });
    }
  }

  function kill(s, pid, a, ev) {
    var p = s.players[pid], v = s.players[a];
    if (p.role !== 'imp' || !p.alive || p.vent || p.killCd > 0) return;
    if (!v || !v.alive || v.left || v.role !== 'crew') return;
    if (dist(p, v) > C.KILL_R) return;
    v.alive = false;
    s.bodies.push({ pid: a, x: v.x, y: v.y });
    p.x = v.x; p.y = v.y; p.killCd = C.KILL_CD;
    ev.push({ type: 'kill', pid: a });
    checkWin(s, ev);
  }

  function report(s, pid, a, ev) {
    var p = s.players[pid];
    if (!p.alive || p.vent) return;
    var body = null;
    for (var i = 0; i < s.bodies.length; i++) if (s.bodies[i].pid === a) body = s.bodies[i];
    if (!body || dist(p, body) > C.REPORT_R) return;
    startMeeting(s, pid, a, ev);
  }

  function sabotage(s, pid, a, ev) {
    var p = s.players[pid];
    if (p.role !== 'imp' || s.sab || s.t < s.sabCdUntil) return;
    if (a === 'lights') s.sab = { kind: 'lights' };
    else if (a === 'reactor') s.sab = { kind: 'reactor', until: s.t + C.REACTOR, held: {} };
    else return;
    ev.push({ type: 'sab', kind: a });
  }

  function hold(s, pid, a) {
    if (!s.sab || s.sab.kind !== 'reactor') return;
    var h = s.sab.held, p = s.players[pid];
    if (h.p1 === pid) delete h.p1;
    if (h.p2 === pid) delete h.p2;
    if (a !== 'p1' && a !== 'p2') return;
    if (!p.alive || dist(p, M.center(M.byId(a))) > C.USE_R) return;
    h[a] = pid;
  }

  function vote(s, pid, a, ev) {
    var p = s.players[pid], m = s.meeting;
    if (s.phase !== 'meeting' || !m || m.stage !== 'vote') return;
    if (!p.alive || p.left || m.votes[pid] !== undefined) return;
    if (a !== 'skip') {
      var t = s.players[a];
      if (!t || !t.alive || t.left) return;
    }
    m.votes[pid] = a;
    ev.push({ type: 'voted', pid: pid });
  }

  function command(s, pid, c, ev) {
    if (!c || typeof c.k !== 'string') return;
    var a = typeof c.a === 'string' ? c.a : '';
    if (c.k === 'vote') { vote(s, pid, a, ev); return; }
    if (s.phase !== 'play') return;
    if (c.k === 'use') use(s, pid, a, ev);
    else if (c.k === 'kill') kill(s, pid, a, ev);
    else if (c.k === 'report') report(s, pid, a, ev);
    else if (c.k === 'sab') sabotage(s, pid, a, ev);
    else if (c.k === 'hold') hold(s, pid, a);
  }

  /* ── 진행 ─────────────────────────────────────────────── */

  function playStep(s, dt, ev) {
    s.order.forEach(function (pid) {
      var p = s.players[pid];
      if (p.left) return;
      if (p.role === 'imp' && p.alive) p.killCd = Math.max(0, p.killCd - dt);
      var ix = p.ix, iy = p.iy, m = Math.sqrt(ix * ix + iy * iy);
      if (m > 1) { ix /= m; iy /= m; m = 1; }
      if (p.vent) {
        if (m > 0.3 && s.t - p.ventAt >= C.VENT_EXIT_DELAY) {
          ev.push({ type: 'unvent', pid: pid, id: p.vent });
          p.vent = null;
        }
        return;
      }
      if (m === 0) return;
      var dx = ix * C.SPEED * dt, dy = iy * C.SPEED * dt;
      if (!p.alive) {
        /* 유령은 벽을 통과한다 */
        p.x = clamp(p.x + dx, 0, M.W * M.T);
        p.y = clamp(p.y + dy, 0, M.H * M.T);
        return;
      }
      var r = G.move(M, p.x, p.y, dx, dy, C.R);
      p.x = r.x; p.y = r.y;
    });

    if (s.sab && s.sab.kind === 'reactor') {
      var h = s.sab.held;
      ['p1', 'p2'].forEach(function (k) {
        var hp = h[k] ? s.players[h[k]] : null;
        if (!hp || hp.left || !hp.alive || dist(hp, M.center(M.byId(k))) > C.USE_R) delete h[k];
      });
      if (h.p1 && h.p2 && h.p1 !== h.p2) {
        s.sab = null; s.sabCdUntil = s.t + C.SAB_CD;
        ev.push({ type: 'fixed', kind: 'reactor' });
      } else if (s.t >= s.sab.until) {
        finish(s, 'imp', 'sab', ev);
      }
    }
  }

  function step(s, dt, inputs) {
    var ev = [];
    s.t += dt;
    if (s.phase === 'result') {
      if (!s.ended && s.t >= s.resultUntil) { s.ended = true; ev.push({ type: 'end' }); }
      return ev;
    }
    inputs = inputs || {};
    for (var pid in inputs) {
      if (!own(inputs, pid)) continue;
      var p = s.players[pid], inp = inputs[pid];
      if (!p || p.left || !inp) continue;
      p.ix = clamp(num(inp.x), -1, 1);
      p.iy = clamp(num(inp.y), -1, 1);
      var cmds = Array.isArray(inp.cmds) ? inp.cmds : [];
      for (var i = 0; i < cmds.length; i++) {
        command(s, pid, cmds[i], ev);
        if (s.phase === 'result') return ev;
      }
    }
    if (s.phase === 'play') playStep(s, dt, ev);
    else if (s.phase === 'meeting') meetingStep(s, ev);
    return ev;
  }

  function drop(s, pid) {
    var ev = [], p = s.players[pid];
    if (!p || p.left) return ev;
    p.left = true; p.alive = false; p.vent = null;
    if (s.meeting) delete s.meeting.votes[pid];
    if (s.phase === 'play' || s.phase === 'meeting') checkWin(s, ev);
    return ev;
  }

  global.Rules = {
    C: C, create: create, step: step, drop: drop,
    progress: progress, counts: counts, tally: tally
  };
})(window);
```

- [ ] **Step 4: Run** `node --test test/rules.test.js` / Expected: PASS
- [ ] **Step 5: Commit** — `git add -A && git commit -m "게임 규칙: 이동·임무·킬·신고·회의·투표·승리"`

---

### Task 4: 환풍구·사보타주·유령 규칙 시험

**Files:**
- Create: `test/rules-extra.test.js`
- Modify: `js/rules.js` (시험이 실패하면 그 부분만)

**Interfaces:** Task 3의 `Rules` 그대로.

- [ ] **Step 1: 시험 작성**

```js
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { load } = require('../testlib/load');
const W = load(['map', 'geom', 'rules']);
const R = W.Rules, M = W.OfficeMap, C = R.C;

function mk(n, imps) {
  const list = [], roles = {}, tk = {};
  for (let i = 1; i <= n; i++) { const pid = 'p' + i; list.push({ pid, name: 'n' + i, color: i - 1 }); roles[pid] = imps.includes(pid) ? 'imp' : 'crew'; tk[pid] = ['stamp1', 'coffee']; }
  return R.create(list, roles, tk);
}
const cen = id => M.center(M.byId(id));
function at(s, pid, p) { s.players[pid].x = p.x; s.players[pid].y = p.y; }
function cmd(s, pid, k, a, x, y) { return R.step(s, 0.01, { [pid]: { x: x || 0, y: y || 0, cmds: [{ k, a }] } }); }
function run(s, secs, inputs) { const ev = []; for (let t = 0; t < secs; t += 1 / 30) ev.push(...R.step(s, 1 / 30, inputs || {})); return ev; }

test('환풍구: 들어가고, 짝으로 옮기고, 방향키로 나온다', () => {
  const s = mk(5, ['p1']);
  const a1 = cen('A1'), a2 = cen('A2');
  at(s, 'p1', { x: a1.x + 10, y: a1.y });
  cmd(s, 'p1', 'use', 'A1');
  assert.equal(s.players.p1.vent, 'A1');
  cmd(s, 'p1', 'use', 'B1');
  assert.equal(s.players.p1.vent, 'A1', '짝이 아니면 무시');
  cmd(s, 'p1', 'use', 'A2');
  assert.equal(s.players.p1.vent, 'A2');
  assert.deepEqual({ x: s.players.p1.x, y: s.players.p1.y }, a2);
  run(s, 0.5, { p1: { x: 1, y: 0 } });
  assert.equal(s.players.p1.vent, null);
});

test('환풍구: 직원은 못 쓰고, 들어가자마자 누르던 키로는 안 나온다', () => {
  const s = mk(5, ['p1']);
  const a1 = cen('A1');
  at(s, 'p2', { x: a1.x, y: a1.y });
  cmd(s, 'p2', 'use', 'A1');
  assert.equal(s.players.p2.vent, null);
  at(s, 'p1', { x: a1.x, y: a1.y });
  cmd(s, 'p1', 'use', 'A1', 1, 0);
  R.step(s, 0.1, { p1: { x: 1, y: 0 } });
  assert.equal(s.players.p1.vent, 'A1');
});

test('환풍구 안에선 킬·신고 못 한다', () => {
  const s = mk(5, ['p1']);
  const a1 = cen('A1');
  at(s, 'p1', a1); at(s, 'p2', { x: a1.x + 20, y: a1.y });
  s.players.p1.killCd = 0;
  cmd(s, 'p1', 'use', 'A1');
  cmd(s, 'p1', 'kill', 'p2');
  assert.equal(s.players.p2.alive, true);
});

test('사보타주: 처음 10초는 안 되고, 직원은 못 건다', () => {
  const s = mk(5, ['p1']);
  cmd(s, 'p1', 'sab', 'lights');
  assert.equal(s.sab, null);
  s.t = C.SAB_FIRST + 1;
  cmd(s, 'p2', 'sab', 'lights');
  assert.equal(s.sab, null);
  cmd(s, 'p1', 'sab', 'lights');
  assert.deepEqual(s.sab, { kind: 'lights' });
});

test('정전: 두꺼비집에서 고치면 풀리고 쿨다운 30초', () => {
  const s = mk(5, ['p1']);
  s.t = C.SAB_FIRST + 1;
  cmd(s, 'p1', 'sab', 'lights');
  const b = cen('breaker');
  at(s, 'p3', { x: b.x, y: b.y + 20 });
  const ev = cmd(s, 'p3', 'use', 'breaker');
  assert.equal(s.sab, null);
  assert.ok(ev.some(e => e.type === 'fixed' && e.kind === 'lights'));
  cmd(s, 'p1', 'sab', 'lights');
  assert.equal(s.sab, null, '쿨다운');
  s.t += C.SAB_CD;
  cmd(s, 'p1', 'sab', 'lights');
  assert.ok(s.sab);
});

test('하나 진행 중이면 다른 사보타주를 못 건다', () => {
  const s = mk(5, ['p1']);
  s.t = C.SAB_FIRST + 1;
  cmd(s, 'p1', 'sab', 'lights');
  cmd(s, 'p1', 'sab', 'reactor');
  assert.equal(s.sab.kind, 'lights');
});

test('서버 과열: 두 사람이 동시에 누르면 풀린다', () => {
  const s = mk(5, ['p1']);
  s.t = C.SAB_FIRST + 1;
  cmd(s, 'p1', 'sab', 'reactor');
  at(s, 'p2', { x: cen('p1').x, y: cen('p1').y + 20 });
  at(s, 'p3', { x: cen('p2').x, y: cen('p2').y + 20 });
  cmd(s, 'p2', 'hold', 'p1');
  assert.ok(s.sab, '한 명으론 안 됨');
  const ev = R.step(s, 0.01, { p3: { x: 0, y: 0, cmds: [{ k: 'hold', a: 'p2' }] } });
  assert.equal(s.sab, null);
  assert.ok(ev.some(e => e.type === 'fixed' && e.kind === 'reactor'));
});

test('서버 과열: 한 사람이 두 패널은 못 누른다, 자리를 뜨면 놓친다', () => {
  const s = mk(5, ['p1']);
  s.t = C.SAB_FIRST + 1;
  cmd(s, 'p1', 'sab', 'reactor');
  at(s, 'p2', { x: cen('p1').x, y: cen('p1').y + 20 });
  cmd(s, 'p2', 'hold', 'p1');
  assert.equal(s.sab.held.p1, 'p2');
  at(s, 'p2', { x: cen('p1').x, y: cen('p1').y + 200 });
  R.step(s, 0.01, {});
  assert.equal(s.sab.held.p1, undefined);
});

test('서버 과열: 시간이 다 되면 임포스터 승리', () => {
  const s = mk(5, ['p1']);
  s.t = C.SAB_FIRST + 1;
  cmd(s, 'p1', 'sab', 'reactor');
  run(s, C.REACTOR + 0.5);
  assert.equal(s.winner, 'imp'); assert.equal(s.why, 'sab');
});

test('서버 과열 중엔 긴급 버튼이 막히고, 신고로 회의를 열면 사보타주가 풀린다', () => {
  const s = mk(5, ['p1']);
  s.t = C.BTN_CD + 1;
  cmd(s, 'p1', 'sab', 'reactor');
  at(s, 'p2', { x: 28.5 * 32, y: 18.5 * 32 });
  cmd(s, 'p2', 'use', 'btn');
  assert.equal(s.phase, 'play');
  s.bodies.push({ pid: 'p5', x: 28.5 * 32, y: 18.5 * 32 });
  s.players.p5.alive = false;
  cmd(s, 'p2', 'report', 'p5');
  assert.equal(s.phase, 'meeting');
  assert.equal(s.sab, null);
});

test('유령: 벽을 통과한다', () => {
  const s = mk(5, ['p1']);
  s.players.p2.alive = false;
  at(s, 'p2', { x: 23.5 * 32, y: 16.5 * 32 });
  run(s, 1, { p2: { x: 0, y: -1 } });
  assert.ok(s.players.p2.y < 15 * 32, '위쪽 벽을 지나감');
});

test('유령: 신고·버튼·투표·킬 못 하고, 임무는 한다', () => {
  const s = mk(5, ['p1']);
  s.players.p2.alive = false;
  s.t = C.BTN_CD + 1;
  at(s, 'p2', { x: 28.5 * 32, y: 18.5 * 32 });
  cmd(s, 'p2', 'use', 'btn');
  assert.equal(s.phase, 'play');
  const c = cen('coffee');
  at(s, 'p2', { x: c.x, y: c.y + 10 });
  cmd(s, 'p2', 'use', 'coffee');
  assert.equal(s.players.p2.done.coffee, true);
});

test('추방된 임포스터 유령도 사보타주는 건다, 킬은 못 한다', () => {
  const s = mk(8, ['p1', 'p2']);
  s.players.p1.alive = false;
  s.t = C.SAB_FIRST + 1;
  cmd(s, 'p1', 'sab', 'lights');
  assert.ok(s.sab);
  s.players.p1.killCd = 0;
  at(s, 'p1', { x: 23.5 * 32, y: 17.5 * 32 }); at(s, 'p3', { x: 23.5 * 32 + 10, y: 17.5 * 32 });
  cmd(s, 'p1', 'kill', 'p3');
  assert.equal(s.players.p3.alive, true);
});
```

- [ ] **Step 2: Run** `node --test test/rules-extra.test.js` / Expected: PASS (규칙은 Task 3에서 이미 넣었다). 실패하면 `js/rules.js`의 해당 함수만 고치고 다시 실행.
- [ ] **Step 3: Commit** — `git add -A && git commit -m "환풍구·사보타주·유령 규칙 시험"`

---

### Task 5: 역할 암호화와 방송용 상태

**Files:**
- Create: `js/roles.js`, `js/snap.js`, `test/roles.test.js`, `test/snap.test.js`

**Interfaces:**
- Produces `Roles`: `impLimit(n)→1|2`, `pick(pids, nImp, rand?)→{pid:'imp'|'crew'}`, `pickTasks(ids, n, rand?)→string[]`, `makeKeys()→Promise<{priv:CryptoKey, pub:string}>`, `seal(myPriv, theirPub, obj)→Promise<{iv,ct}>`, `open(myPriv, theirPub, sealed)→Promise<obj|null>`
- 봉투 내용(`obj`): `{ r: 'imp'|'crew', t: [stationId], m: [동료 임포스터 pid] }`
- Produces `Snap.pack(state)→st`:
  ```
  { t: 0.1초 정수, ph: phase, bc: 버튼 남은 초,
    p: { pid: [x, y, alive 0|1, vent 0|1, btnLeft] }   (나간 사람 제외),
    b: [[pid, x, y]], tp: 0~1000,
    sb?: { k: 'lights' } | { k: 'reactor', r: 남은 초, h: [p1 0|1, p2 0|1] },
    m?: { by, bd, s: stage, r: 남은 초, v: [투표한 pid] , vt?, e?, ei?, il? },
    w?: { s: side, y: why, imps: [pid] } }
  ```
  역할(`role`), 임무 목록, 킬쿨은 결과(`w`) 전에는 절대 싣지 않는다. 누가 누구에게 투표했는지(`vt`)는 공개 단계에서만.

- [ ] **Step 1: 시험 작성 `test/roles.test.js`**

```js
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { load } = require('../testlib/load');
const Ro = load(['roles']).Roles;

function seq(vals) { let i = 0; return () => vals[i++ % vals.length]; }

test('임포스터 상한: 7명부터 2명', () => {
  assert.equal(Ro.impLimit(4), 1); assert.equal(Ro.impLimit(6), 1);
  assert.equal(Ro.impLimit(7), 2); assert.equal(Ro.impLimit(10), 2);
});

test('pick: 정확히 n명이 임포스터', () => {
  const pids = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
  for (let k = 0; k < 20; k++) {
    const r = Ro.pick(pids, 2);
    assert.equal(Object.values(r).filter(v => v === 'imp').length, 2);
    assert.equal(Object.keys(r).length, 7);
  }
});

test('pick: rand 가 1 을 돌려줘도 범위를 안 넘는다', () => {
  const r = Ro.pick(['a', 'b', 'c', 'd'], 1, seq([1, 0.99, 0]));
  assert.equal(Object.values(r).filter(v => v === 'imp').length, 1);
});

test('pickTasks: 겹치지 않게 n개', () => {
  const ids = ['s1', 's2', 's3', 's4', 's5', 's6', 's7', 's8'];
  for (let k = 0; k < 20; k++) {
    const t = Ro.pickTasks(ids, 5);
    assert.equal(t.length, 5);
    assert.equal(new Set(t).size, 5);
    t.forEach(x => assert.ok(ids.includes(x)));
  }
});

test('암호: 방장이 잠근 것을 그 사람만 연다', async () => {
  const host = await Ro.makeKeys(), me = await Ro.makeKeys(), other = await Ro.makeKeys();
  assert.ok(me.pub.length <= 200);
  const box = { r: 'imp', t: ['coffee', 'cable'], m: ['p7'] };
  const sealed = await Ro.seal(host.priv, me.pub, box);
  assert.ok(sealed.iv.length <= 32 && sealed.ct.length <= 600);
  assert.ok(!sealed.ct.includes('imp'));
  assert.deepEqual(await Ro.open(me.priv, host.pub, sealed), box);
  assert.equal(await Ro.open(other.priv, host.pub, sealed), null);
});

test('암호: 망가진 봉투는 null', async () => {
  const host = await Ro.makeKeys(), me = await Ro.makeKeys();
  assert.equal(await Ro.open(me.priv, host.pub, null), null);
  assert.equal(await Ro.open(me.priv, host.pub, { iv: 'AAAA', ct: 'BBBB' }), null);
});
```

- [ ] **Step 2: Run** `node --test test/roles.test.js` / Expected: FAIL

- [ ] **Step 3: `js/roles.js`**

```js
/* ============================================================
   사무실 임포스터 — 역할 뽑기와 봉투

   누가 임포스터인지는 방장 브라우저만 안다. 각 사람에게는 그 사람만
   열 수 있는 봉투로 보낸다.

   ── 봉투 만드는 법 ─────────────────────────────────────
   입장할 때 각자 ECDH 키 쌍을 만들고 공개키만 who/<pid>/pub 에 올린다.
   방장은 (방장 비밀키 × 그 사람 공개키)로, 그 사람은 (자기 비밀키 × 방장
   공개키)로 같은 AES 키를 얻는다. 두 사람 말고는 이 키를 만들 수 없다.
   그래서 sec/<pid> 를 누가 개발자 도구로 읽어도 남의 역할은 못 연다.

   방장 자신은 모든 역할을 안다. 서버 없이 하는 게임이라 피할 수 없다.
   ============================================================ */
(function (global) {
  'use strict';

  function rnd(rand) {
    var r = (rand || Math.random)();
    return r >= 1 ? 0.999999 : (r < 0 ? 0 : r);
  }
  function shuffle(a, rand) {
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(rnd(rand) * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function impLimit(n) { return n >= 7 ? 2 : 1; }

  function pick(pids, n, rand) {
    var out = {}, a = shuffle(pids.slice(), rand);
    pids.forEach(function (p) { out[p] = 'crew'; });
    for (var i = 0; i < n && i < a.length; i++) out[a[i]] = 'imp';
    return out;
  }

  function pickTasks(ids, n, rand) {
    return shuffle(ids.slice(), rand).slice(0, Math.min(n, ids.length));
  }

  /* ── 암호 ─────────────────────────────────────────────── */

  function cryptoObj() {
    if (global.crypto && global.crypto.subtle) return global.crypto;
    return (typeof crypto !== 'undefined') ? crypto : null;
  }
  function sub() { return cryptoObj().subtle; }

  function b64(buf) {
    var u = new Uint8Array(buf), s = '';
    for (var i = 0; i < u.length; i++) s += String.fromCharCode(u[i]);
    return btoa(s);
  }
  function unb64(s) {
    var bin = atob(s), u = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    return u;
  }

  var CURVE = { name: 'ECDH', namedCurve: 'P-256' };

  function makeKeys() {
    return sub().generateKey(CURVE, true, ['deriveKey']).then(function (kp) {
      return sub().exportKey('raw', kp.publicKey).then(function (raw) {
        return { priv: kp.privateKey, pub: b64(raw) };
      });
    });
  }

  function shared(priv, pubB64) {
    return sub().importKey('raw', unb64(pubB64), CURVE, false, []).then(function (pub) {
      return sub().deriveKey({ name: 'ECDH', public: pub }, priv,
        { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
    });
  }

  function seal(myPriv, theirPub, obj) {
    var iv = cryptoObj().getRandomValues(new Uint8Array(12));
    var data = new TextEncoder().encode(JSON.stringify(obj));
    return shared(myPriv, theirPub).then(function (k) {
      return sub().encrypt({ name: 'AES-GCM', iv: iv }, k, data);
    }).then(function (ct) { return { iv: b64(iv), ct: b64(ct) }; });
  }

  function open(myPriv, theirPub, sealed) {
    if (!sealed || typeof sealed.iv !== 'string' || typeof sealed.ct !== 'string') return Promise.resolve(null);
    return Promise.resolve().then(function () {
      return shared(myPriv, theirPub);
    }).then(function (k) {
      return sub().decrypt({ name: 'AES-GCM', iv: unb64(sealed.iv) }, k, unb64(sealed.ct));
    }).then(function (pt) {
      return JSON.parse(new TextDecoder().decode(pt));
    }).catch(function () { return null; });
  }

  global.Roles = {
    impLimit: impLimit, pick: pick, pickTasks: pickTasks,
    makeKeys: makeKeys, seal: seal, open: open
  };
})(window);
```

- [ ] **Step 4: Run** `node --test test/roles.test.js` / Expected: PASS

- [ ] **Step 5: 시험 작성 `test/snap.test.js`**

```js
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { load } = require('../testlib/load');
const W = load(['map', 'geom', 'rules', 'snap']);
const R = W.Rules, S = W.Snap, C = R.C;

function mk() {
  const list = [], roles = {}, tk = {};
  for (let i = 1; i <= 5; i++) { const pid = 'p' + i; list.push({ pid, name: 'n' + i, color: i - 1 }); roles[pid] = i === 1 ? 'imp' : 'crew'; tk[pid] = ['coffee']; }
  return R.create(list, roles, tk);
}

test('진행 중 꾸러미에는 역할·임무·킬쿨이 없다', () => {
  const s = mk();
  const txt = JSON.stringify(S.pack(s));
  for (const bad of ['imp', 'crew', 'coffee', 'killCd', 'role']) assert.ok(!txt.includes(bad), bad);
});

test('위치는 정수, 산 사람 표시', () => {
  const s = mk();
  s.players.p2.x = 100.7;
  const st = S.pack(s);
  assert.equal(st.p.p2[0], 101);
  assert.equal(st.p.p2[2], 1);
  assert.equal(st.ph, 'play');
});

test('나간 사람은 빠진다', () => {
  const s = mk();
  R.drop(s, 'p3');
  assert.equal(S.pack(s).p.p3, undefined);
});

test('투표 중엔 누가 투표했는지만, 공개 때 누구에게 했는지', () => {
  const s = mk();
  s.t = C.BTN_CD + 1;
  s.players.p2.x = 28.5 * 32; s.players.p2.y = 18.5 * 32;
  R.step(s, 0.01, { p2: { x: 0, y: 0, cmds: [{ k: 'use', a: 'btn' }] } });
  for (let t = 0; t < C.TALK + 0.1; t += 0.1) R.step(s, 0.1, {});
  R.step(s, 0.01, { p2: { x: 0, y: 0, cmds: [{ k: 'vote', a: 'p3' }] } });
  let st = S.pack(s);
  assert.deepEqual(st.m.v, ['p2']);
  assert.equal(st.m.vt, undefined);
  for (const v of ['p1', 'p3', 'p4', 'p5']) R.step(s, 0.01, { [v]: { x: 0, y: 0, cmds: [{ k: 'vote', a: 'skip' }] } });
  R.step(s, 0.01, {});
  st = S.pack(s);
  assert.equal(st.m.s, 'reveal');
  assert.equal(st.m.vt.p2, 'p3');
  assert.equal(st.m.e, '');
});

test('결과에서 임포스터 공개', () => {
  const s = mk();
  R.drop(s, 'p1');
  const st = S.pack(s);
  assert.deepEqual(st.w, { s: 'crew', y: 'vote', imps: ['p1'] });
});

test('서버 과열 남은 시간과 누른 패널', () => {
  const s = mk();
  s.t = C.SAB_FIRST + 1;
  R.step(s, 0.01, { p1: { x: 0, y: 0, cmds: [{ k: 'sab', a: 'reactor' }] } });
  const st = S.pack(s);
  assert.equal(st.sb.k, 'reactor');
  assert.equal(st.sb.r, C.REACTOR);
  assert.deepEqual(st.sb.h, [0, 0]);
});
```

- [ ] **Step 6: Run** `node --test test/snap.test.js` / Expected: FAIL

- [ ] **Step 7: `js/snap.js`**

```js
/* ============================================================
   사무실 임포스터 — 방송용 상태 꾸러미

   방장이 10Hz 로 crew/<코드>/st 에 올린다. 모두가 읽을 수 있는 곳이라
   비밀이 새면 안 된다: 역할, 임무 목록, 킬쿨은 판이 끝나기 전엔 안 싣는다.
   (킬쿨을 실으면 쿨이 도는 사람 = 임포스터라고 광고하는 꼴이다.)

   모코파크와 같은 이유로 항상 전체를 보낸다. 한 번 놓쳐도 다음 것이 고친다.
   키를 한 글자로 줄이고 좌표를 정수로 반올림한다.

   감수하는 것: 위치는 전부 실린다. 개발자 도구로 어둠 속 위치와
   환풍구 안 여부를 볼 수 있다. 사내 게임이라 허용한다(설계서 "비밀 지키기").
   ============================================================ */
(function (global) {
  'use strict';

  var R = global.Rules;

  function left(until, now) { return Math.max(0, Math.ceil(until - now)); }

  function pack(s) {
    var o = { t: Math.round(s.t * 10), ph: s.phase, p: {}, b: [], tp: 0, bc: left(s.btnCdUntil, s.t) };
    s.order.forEach(function (pid) {
      var p = s.players[pid];
      if (p.left) return;
      o.p[pid] = [Math.round(p.x), Math.round(p.y), p.alive ? 1 : 0, p.vent ? 1 : 0, p.btnLeft];
    });
    s.bodies.forEach(function (b) { o.b.push([b.pid, Math.round(b.x), Math.round(b.y)]); });
    var pr = R.progress(s);
    o.tp = pr.total ? Math.round(pr.done / pr.total * 1000) : 0;
    if (s.sab) {
      o.sb = { k: s.sab.kind };
      if (s.sab.kind === 'reactor') {
        o.sb.r = left(s.sab.until, s.t);
        o.sb.h = [s.sab.held.p1 ? 1 : 0, s.sab.held.p2 ? 1 : 0];
      }
    }
    if (s.meeting) {
      var m = s.meeting;
      o.m = { by: m.by, bd: m.body || '', s: m.stage, r: left(m.until, s.t), v: Object.keys(m.votes) };
      if (m.stage === 'reveal') {
        o.m.vt = m.votes; o.m.e = m.ejected || ''; o.m.ei = m.ejectedImp ? 1 : 0; o.m.il = m.impsLeft;
      }
    }
    if (s.winner) {
      o.w = { s: s.winner, y: s.why, imps: s.order.filter(function (pid) { return s.players[pid].role === 'imp'; }) };
    }
    return o;
  }

  global.Snap = { pack: pack };
})(window);
```

- [ ] **Step 8: Run** `node --test` / Expected: 전부 PASS
- [ ] **Step 9: Commit** — `git add -A && git commit -m "역할 봉투와 방송용 상태"`

---

### Task 6: 한 판 통째로 시험 (가짜 플레이어)

**Files:**
- Create: `testlib/walker.js`, `test/fullgame.test.js`

**Interfaces:**
- Produces `walker.js`: `route(M, from:{x,y}, target:{x,y}, range) → [{x,y}] | null` (칸 중심 경유점, 목표까지 range 안에 드는 첫 바닥 칸에서 끝), `steer(p:{x,y}, path) → {x,y}` (다음 경유점 방향 단위벡터, 가까우면 경유점을 빼고 다음으로; 경로가 비면 {0,0})
- 이 걷기 도구는 Task 10의 `js/devbots.js`도 같은 알고리즘을 쓴다(브라우저용으로 다시 적는다).

- [ ] **Step 1: `testlib/walker.js`**

```js
'use strict';

/* 칸 격자 위 너비우선 탐색. 목표 픽셀에서 range 안에 드는 바닥 칸을 찾으면 멈춘다.
   그래서 탁자 위 긴급 버튼처럼 그 칸 자체가 막혀 있어도 옆 칸까지 길을 찾는다. */
function route(M, from, target, range) {
  const T = M.T;
  const sx = Math.floor(from.x / T), sy = Math.floor(from.y / T);
  const ok = (tx, ty) => Math.hypot((tx + 0.5) * T - target.x, (ty + 0.5) * T - target.y) <= range;
  const key = (x, y) => y * M.W + x;
  const prev = new Map([[key(sx, sy), -1]]);
  const q = [[sx, sy]];
  let end = null;
  while (q.length) {
    const [x, y] = q.shift();
    if (ok(x, y)) { end = [x, y]; break; }
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy, k = key(nx, ny);
      if (prev.has(k) || M.solid(nx, ny)) continue;
      prev.set(k, key(x, y)); q.push([nx, ny]);
    }
  }
  if (!end) return null;
  const pts = [];
  for (let k = key(end[0], end[1]); k !== -1; k = prev.get(k)) {
    pts.push({ x: (k % M.W + 0.5) * T, y: (Math.floor(k / M.W) + 0.5) * T });
  }
  pts.reverse();
  pts.shift();
  return pts;
}

function steer(p, path) {
  while (path.length && Math.hypot(path[0].x - p.x, path[0].y - p.y) < 6) path.shift();
  if (!path.length) return { x: 0, y: 0 };
  const dx = path[0].x - p.x, dy = path[0].y - p.y, d = Math.hypot(dx, dy);
  return { x: dx / d, y: dy / d };
}

module.exports = { route, steer };
```

- [ ] **Step 2: 시험 작성 `test/fullgame.test.js`**

```js
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { load } = require('../testlib/load');
const { route, steer } = require('../testlib/walker');
const W = load(['map', 'geom', 'rules', 'roles']);
const R = W.Rules, M = W.OfficeMap, Ro = W.Roles, C = R.C;
const DT = 1 / 30;
const cen = id => M.center(M.byId(id));

function game(n, imps, taskMap) {
  const list = [], roles = {}, tasks = {};
  for (let i = 1; i <= n; i++) {
    const pid = 'p' + i;
    list.push({ pid, name: 'n' + i, color: i - 1 });
    roles[pid] = imps.includes(pid) ? 'imp' : 'crew';
    tasks[pid] = taskMap ? taskMap(pid) : Ro.pickTasks(M.stationIds(), C.TASKS_PER_PLAYER);
  }
  return R.create(list, roles, tasks);
}

/* 한 사람을 목표까지 걸린다. 도착하면 true. */
function walk(s, pid, target, range, maxSecs) {
  const p = s.players[pid];
  const path = route(M, p, target, range);
  assert.ok(path, pid + ' 길 없음');
  for (let t = 0; t < (maxSecs || 60); t += DT) {
    if (Math.hypot(p.x - target.x, p.y - target.y) <= range) { R.step(s, DT, { [pid]: { x: 0, y: 0 } }); return true; }
    const v = steer(p, path);
    if (!v.x && !v.y) { R.step(s, DT, { [pid]: { x: 0, y: 0 } }); return Math.hypot(p.x - target.x, p.y - target.y) <= range + 8; }
    R.step(s, DT, { [pid]: v });
    if (s.phase !== 'play') return false;
  }
  return false;
}
function cmd(s, pid, k, a) { return R.step(s, DT, { [pid]: { x: 0, y: 0, cmds: [{ k, a }] } }); }

test('직원들이 걸어가서 임무를 다 하면 직원 승리', () => {
  const s = game(4, ['p1']);
  for (const pid of ['p2', 'p3', 'p4']) {
    for (const id of s.players[pid].tasks) {
      assert.ok(walk(s, pid, cen(id), C.USE_R - 10), pid + ' → ' + id);
      cmd(s, pid, 'use', id);
      assert.equal(s.players[pid].done[id], true, pid + ' ' + id);
      if (s.winner) break;
    }
  }
  assert.equal(s.winner, 'crew');
  assert.equal(s.why, 'tasks');
});

test('킬 → 다른 직원이 걸어가 신고 → 투표로 추방 → 직원 승리', () => {
  const s = game(6, ['p1'], () => ['coffee']);
  for (let t = 0; t < C.KILL_CD + 0.1; t += DT) R.step(s, DT, {});
  // p2 를 탕비실로 보내고 임포스터가 따라간다
  assert.ok(walk(s, 'p2', cen('coffee'), 30));
  assert.ok(walk(s, 'p1', s.players.p2, C.KILL_R - 10));
  cmd(s, 'p1', 'kill', 'p2');
  assert.equal(s.players.p2.alive, false);
  const body = s.bodies[0];
  assert.ok(walk(s, 'p3', body, C.REPORT_R - 10));
  cmd(s, 'p3', 'report', 'p2');
  assert.equal(s.phase, 'meeting');
  for (let t = 0; t < C.TALK + 0.1; t += DT) R.step(s, DT, {});
  for (const v of ['p1', 'p3', 'p4', 'p5', 'p6']) cmd(s, v, 'vote', 'p1');
  for (let t = 0; t < C.REVEAL + 0.5; t += DT) R.step(s, DT, {});
  assert.equal(s.winner, 'crew');
  assert.equal(s.why, 'vote');
});

test('긴급 버튼까지 걸어가서 누를 수 있다', () => {
  const s = game(5, ['p1']);
  for (let t = 0; t < C.BTN_CD + 0.1; t += DT) R.step(s, DT, {});
  assert.ok(walk(s, 'p4', cen('btn'), C.BTN_R - 10));
  cmd(s, 'p4', 'use', 'btn');
  assert.equal(s.phase, 'meeting');
});

test('정전 → 직원이 창고 두꺼비집까지 걸어가 고친다', () => {
  const s = game(5, ['p1']);
  for (let t = 0; t < C.SAB_FIRST + 0.1; t += DT) R.step(s, DT, {});
  cmd(s, 'p1', 'sab', 'lights');
  assert.ok(walk(s, 'p3', cen('breaker'), C.USE_R - 10));
  cmd(s, 'p3', 'use', 'breaker');
  assert.equal(s.sab, null);
});

test('서버 과열 → 두 직원이 각자 패널로 가서 동시에 누른다', () => {
  const s = game(5, ['p1']);
  for (let t = 0; t < C.SAB_FIRST + 0.1; t += DT) R.step(s, DT, {});
  cmd(s, 'p1', 'sab', 'reactor');
  assert.ok(walk(s, 'p2', cen('p1'), C.USE_R - 10));
  cmd(s, 'p2', 'hold', 'p1');
  assert.ok(walk(s, 'p3', cen('p2'), C.USE_R - 10));
  R.step(s, DT, { p3: { x: 0, y: 0, cmds: [{ k: 'hold', a: 'p2' }] } });
  assert.equal(s.sab, null);
  assert.ok(s.t < C.SAB_FIRST + C.REACTOR, '시간 안에');
});

test('임포스터가 환풍구로 탕비실에서 복사실로 간다', () => {
  const s = game(5, ['p1']);
  assert.ok(walk(s, 'p1', cen('A1'), C.VENT_R - 10));
  cmd(s, 'p1', 'use', 'A1');
  cmd(s, 'p1', 'use', 'A2');
  for (let t = 0; t < 0.5; t += DT) R.step(s, DT, { p1: { x: -1, y: 0 } });
  assert.equal(s.players.p1.vent, null);
  assert.equal(M.roomAt(s.players.p1.x, s.players.p1.y), '복사실');
});
```

- [ ] **Step 3: Run** `node --test test/fullgame.test.js` / Expected: PASS. 실패하면 원인이 맵(길 막힘)인지 규칙(거리)인지 로그로 가르고, 해당 파일과 그 단위 시험을 함께 고친다.
- [ ] **Step 4: Run** `node --test` / Expected: 전부 PASS
- [ ] **Step 5: Commit** — `git add -A && git commit -m "가짜 플레이어로 한 판 통째로 시험"`

---

### Task 7: 로컬 접속판과 Firebase 규칙 파일

**Files:**
- Create: `js/localnet.js`, `test/localnet.test.js`, `docs/firebase-rules-crew.json`

**Interfaces:**
- Consumes: `Net.applyEvent`
- Produces: `LocalNet.make(channelName, BroadcastChannelCtor) → { put, del, get, watch }` (Net과 같은 모양, 모두 Promise / watch는 `{close, state}`). 주소에 `local`이 있으면 `window.Net`의 `put/del/get/watch`를 이것으로 바꿔 끼운다(`applyEvent`, `url`은 그대로).
- 동작: 탭마다 DB 사본을 들고, 쓰기는 자기 사본에 반영 + 채널로 `{type:'w', path, data}` 방송. 새 탭은 `{type:'hello'}`를 보내고, 받은 탭이 `{type:'full', db}`로 답한다. 내 사본이 비었을 때만 받아들인다. `watch(path)`는 그 경로 아래 쓰기를 Firebase SSE와 같은 `put` 의미(경로 기준 교체)로 콜백한다.

- [ ] **Step 1: 시험 작성 `test/localnet.test.js`** (Node에서 가짜 채널로)

```js
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { load } = require('../testlib/load');

/* Node 24 에도 BroadcastChannel 이 있다. 같은 프로세스 안의 두 인스턴스로 두 탭을 흉내낸다. */
function two() {
  const name = 'oi-test-' + Math.random();
  const a = load(['net', 'localnet'], { location: { search: '' } });
  const b = load(['net', 'localnet'], { location: { search: '' } });
  return [a.LocalNet.make(name, BroadcastChannel), b.LocalNet.make(name, BroadcastChannel), () => {}];
}
const tick = (ms) => new Promise(r => setTimeout(r, ms || 30));

test('한 탭이 쓴 것을 다른 탭이 지켜본다', async () => {
  const [A, B] = two();
  let seen = null;
  const w = B.watch('crew/ABCD', s => { seen = s; });
  await A.put('crew/ABCD/who/p1', { name: '가' });
  await tick();
  assert.deepEqual(seen, { who: { p1: { name: '가' } } });
  await A.del('crew/ABCD/who/p1');
  await tick();
  assert.deepEqual(seen && seen.who, undefined);
  w.close(); A.close(); B.close();
});

test('나중에 연 탭이 기존 내용을 받아 온다', async () => {
  const name = 'oi-test-' + Math.random();
  const a = load(['net', 'localnet'], { location: { search: '' } }).LocalNet.make(name, BroadcastChannel);
  await a.put('crew/WXYZ/meta', { host: 'p1', phase: 'lobby' });
  const b = load(['net', 'localnet'], { location: { search: '' } }).LocalNet.make(name, BroadcastChannel);
  await tick(60);
  assert.deepEqual(await b.get('crew/WXYZ/meta'), { host: 'p1', phase: 'lobby' });
  a.close(); b.close();
});

test('get 은 없는 경로에 null', async () => {
  const [A] = two();
  assert.equal(await A.get('crew/NONE'), null);
  A.close();
});
```

- [ ] **Step 2: Run** `node --test test/localnet.test.js` / Expected: FAIL

- [ ] **Step 3: `js/localnet.js`**

```js
/* ============================================================
   사무실 임포스터 — 로컬 접속판 (개발·시험용)

   주소에 ?local 이 붙으면 Firebase 대신 이걸 쓴다. 같은 브라우저의
   탭끼리 BroadcastChannel 로 주고받는다. Firebase 규칙을 콘솔에
   올리기 전에도 대기실·게임·회의를 끝까지 돌려 볼 수 있다.

   API 는 Net 과 똑같다(put/del/get/watch). 그래서 게임 코드는
   자기가 어느 쪽에 붙었는지 모른다.

   탭마다 DB 사본을 들고 있다. 공용 저장소(localStorage)에 통째로
   쓰면 두 탭이 동시에 쓸 때 한쪽이 지워진다. 그래서 쓰기만 방송하고
   각자 자기 사본에 적용한다. 새 탭은 hello 를 보내 사본을 받아 온다.
   ============================================================ */
(function (global) {
  'use strict';

  function segs(p) { return String(p || '').split('/').filter(function (s) { return s; }); }

  function make(name, BC) {
    var apply = global.Net.applyEvent;
    var db = null, watchers = [], ch = new BC(name);

    function sub(state, path) {
      var parts = segs(path), node = state;
      for (var i = 0; i < parts.length; i++) {
        if (node === null || typeof node !== 'object') return null;
        node = node[parts[i]];
        if (node === undefined) return null;
      }
      return node === undefined ? null : node;
    }

    function notify(path, data) {
      var p = segs(path);
      watchers.forEach(function (w) {
        var base = segs(w.path);
        var under = p.length >= base.length && base.every(function (s, i) { return s === p[i]; });
        var above = !under && base.length > p.length && p.every(function (s, i) { return s === base[i]; });
        if (under) w.state = apply(w.state, 'put', '/' + p.slice(base.length).join('/'), data);
        else if (above) w.state = sub(db, w.path);
        else return;
        if (w.onData) w.onData(w.state);
      });
    }

    function write(path, data) {
      db = apply(db, 'put', '/' + segs(path).join('/'), data);
      notify(path, data);
    }

    ch.onmessage = function (e) {
      var m = e.data;
      if (!m) return;
      if (m.type === 'w') write(m.path, m.data);
      else if (m.type === 'hello') { if (db !== null) ch.postMessage({ type: 'full', db: db }); }
      else if (m.type === 'full') {
        if (db === null && m.db) {
          db = m.db;
          watchers.forEach(function (w) { w.state = sub(db, w.path); if (w.onData) w.onData(w.state); });
        }
      }
    };
    ch.postMessage({ type: 'hello' });

    function put(path, value) {
      var v = value === undefined ? null : JSON.parse(JSON.stringify(value));
      write(path, v);
      ch.postMessage({ type: 'w', path: path, data: v });
      return Promise.resolve({ ok: true, status: 200 });
    }

    return {
      put: put,
      del: function (path) { return put(path, null); },
      get: function (path) { return Promise.resolve(sub(db, path)); },
      watch: function (path, onData) {
        var w = { path: path, onData: onData, state: sub(db, path) };
        watchers.push(w);
        setTimeout(function () { if (w.onData) w.onData(w.state); }, 0);
        return {
          close: function () { watchers = watchers.filter(function (x) { return x !== w; }); },
          state: function () { return w.state; }
        };
      },
      close: function () { try { ch.close(); } catch (e) {} }
    };
  }

  global.LocalNet = { make: make };

  var q = (global.location && global.location.search) || '';
  if (/[?&]local\b/.test(q) && global.Net && typeof global.BroadcastChannel === 'function') {
    var ln = make('office-impostor', global.BroadcastChannel);
    global.Net.put = ln.put; global.Net.del = ln.del; global.Net.get = ln.get; global.Net.watch = ln.watch;
    global.Net.isLocal = true;
  }
})(window);
```

- [ ] **Step 4: Run** `node --test test/localnet.test.js` / Expected: PASS
- [ ] **Step 5: `docs/firebase-rules-crew.json`** — 설계서 "Firebase 규칙" 블록을 그대로 담는다. 위아래에 기존 `scores`, `rooms` 블록까지 포함한 **완성본 전체**로 만든다(`C:\Users\NAU\Desktop\Overworked\docs\firebase-rules.json`의 내용 + `"crew"` 블록). 콘솔에는 이 파일 전체를 붙여넣는다.
- [ ] **Step 6: 확인** — `node -e "JSON.parse(require('fs').readFileSync('docs/firebase-rules-crew.json','utf8'))"` / Expected: 오류 없음
- [ ] **Step 7: Commit** — `git add -A && git commit -m "로컬 접속판과 crew 규칙 파일"`

---

### Task 8: 대기실과 접속 흐름

**Files:**
- Create: `index.html`, `css/style.css`, `js/lobby.js`, `js/game.js`, `게임 실행.bat`(cp949)
- Test: 브라우저 (`?local` 두 탭)

**Interfaces:**
- Consumes: `Net`, `Room`, `Roles`, `Rules`, `Snap`
- Produces `Lobby`: `Lobby.show(root, ctx)` — 첫 화면/대기실 DOM을 그리고 `ctx`의 콜백을 부른다. `ctx = { me:{pid,name,color}, onCreate(name), onJoin(name, code), onColor(c), onImp(n), onStart(), onLeave() }`. `Lobby.render(view)`로 갱신: `view = { code, isHost, who:[{pid,name,color,host}], imp, impMax, canStart, why, status }`.
- Produces `Game` (game.js 안, 전역 노출 안 함): 화면 단계 `'title'|'lobby'|'play'|'meeting'|'result'`.

**화면 요구:**
- 첫 화면: 제목 "사무실 임포스터", 이름 입력(12자, 지난 이름 localStorage에 기억), [방 만들기], 방 코드 입력 4칸 + [들어가기]. 잘못된 코드는 "그런 방 코드가 없어요. 대문자와 숫자 4자리인지 확인하세요".
- 대기실: 방 코드 크게 + [복사], 참가자 목록(색 점 + 이름 + 방장 왕관 ★), 내 색 고르기 10칸(남이 쓰는 색은 흐리게, 누르면 안 됨), 방장만 임포스터 수 1/2(7명 미만이면 2는 꺼짐), 방장만 [시작](4명 미만이면 꺼짐 + "4명 이상 모여야 시작할 수 있어요 (지금 N명)").
- 오른쪽 위 연결 상태 점: 초록 "연결됨" / 노랑 "다시 연결 중" / 빨강 "끊김". `?local`이면 회색 "로컬 시험 모드".

**흐름 (game.js):**
1. 시작: `pid = 'p' + 무작위 8자`, `Roles.makeKeys()`로 키. 이름은 localStorage `oi_name`.
2. 방 만들기: `Room.makeCode()` → `Net.get('crew/'+code+'/meta')`가 null일 때까지 다시 뽑기 → `meta = {host: pid, phase:'lobby', imp:1, born: Date.now()}` 쓰기 → 입장.
3. 들어가기: `Room.cleanCode` 실패 또는 meta 없음 → 안내문. 있으면 입장.
4. 입장: `who/<pid> = {name, color: 빈 색 중 가장 앞, join: Date.now(), seen: Date.now(), pub}` 쓰기 → `Net.watch('crew/'+code, onRoom)`. 2초마다 `who/<pid>/seen` 갱신. `beforeunload`에 `who/<pid>` 삭제(실패해도 무시).
5. `onRoom(state)`: 다른 사람 `seen` 값이 바뀐 것을 본 내 시각을 `seenAt[pid]`에 기록. `meta.phase`에 따라 화면 전환.
6. 방장 승계: 0.5초마다 `Room.shouldClaim({ me, host: meta.host, who, nowMs, seenAt, lastTick, lastChangeMs, lastEventMs, claimedAtMs })`. `'claim'`이면 `meta.host = me` 쓰고 1초 뒤 재확인(`'yield'`면 물러남). 내가 새 방장이 됐는데 `phase`가 `play|meeting|result`면 "방장이 나가서 판을 끝냈어요" 안내 후 `meta.phase='lobby'`, `st`, `sec`, `chat`, `in` 삭제.
7. 시작(방장): 산 사람 목록 = `Room.alive(who, now, seenAt)` + 나. 4명 미만이면 무시. `roles = Roles.pick(pids, imp)`, 각자 `Roles.pickTasks(OfficeMap.stationIds(), 5)`. 각 pid에 `Roles.seal(myPriv, who[pid].pub, {r, t, m})`를 `sec/<pid>`에 쓴다(임포스터 봉투의 `m`은 다른 임포스터 pid 목록, 직원은 `[]`). 모두 쓴 뒤 `meta.phase = 'play'`. 방장 메모리에 `Rules.create(...)`.
8. 참가자: `phase === 'play'`이고 내 봉투가 아직 없으면 `sec/<me>`를 `Roles.open(myPriv, who[host].pub, sec[me])`로 연다. 실패(null)면 "역할을 못 받았어요. 새로고침 후 다시 들어오세요" 안내.

- [ ] **Step 1: `index.html`** — 스크립트 순서: `cloud-config, net, localnet, room, interp, map, geom, rules, roles, snap, tasks/common, tasks/copier, tasks/render, tasks/coffee, tasks/cable, tasks/stamp, tasks/plant, view, hud, meeting, lobby, devbots, game`. 본문: `<div id="app"><canvas id="world"></canvas><div id="hud"></div><div id="layer"></div><div id="net"></div></div>`. 아직 없는 파일은 이 Task에서 빈 IIFE로 만들어 둔다(`(function(global){'use strict';})(window);`).
- [ ] **Step 2: `css/style.css`** — 어두운 사무실 톤(배경 #1d2230, 패널 #2b3245, 강조 #ffcc4d, 글자 #eef1f7), 기본 글꼴 `'Pretendard', 'Malgun Gothic', sans-serif`, 버튼 큼직하게(최소 높이 44px), 꺼진 버튼은 투명도 0.4 + 커서 not-allowed.
- [ ] **Step 3: `js/lobby.js`, `js/game.js`의 대기실 부분** — 위 "화면 요구"와 "흐름" 1~8을 그대로 구현.
- [ ] **Step 4: `게임 실행.bat`** — 모코파크 것과 같은 모양, 제목 "사무실 임포스터", 포트 8896, 안내문에 "혼자 시험: http://localhost:8896/?local&bots=5". 내용을 UTF-8 임시 파일로 Write 도구로 쓴 뒤 PowerShell로 cp949 변환 저장:

```powershell
$t = [IO.File]::ReadAllText('<임시 파일>', [Text.Encoding]::UTF8)
[IO.File]::WriteAllText('C:\Users\NAU\Desktop\OfficeImpostor\게임 실행.bat', $t, [Text.Encoding]::GetEncoding(949))
```
- [ ] **Step 5: 브라우저 확인** — `.claude/launch.json`에 `{"name":"office-impostor","runtimeExecutable":"python","runtimeArgs":["-m","http.server","8896","--directory","C:/Users/NAU/Desktop/OfficeImpostor"],"port":8896}` 추가 후 preview_start. 탭 A `/?local` 방 만들기 → 탭 B `/?local` 코드로 입장 → 두 탭 모두 참가자 2명, 색 겹침 없음, A만 시작 버튼(꺼짐, "4명 이상" 안내). 스크린샷.
- [ ] **Step 6: Commit** — `git add -A && git commit -m "첫 화면과 대기실"`

---

### Task 9: 게임 화면 (이동·시야·그리기·HUD)

**Files:**
- Create/Modify: `js/view.js`, `js/hud.js`, `js/game.js`

**Interfaces:**
- Produces `View`: `View.init(canvas)`, `View.draw(frame)` — `frame = { me, meX, meY, others:[{pid,x,y,color,name,alive,vent}], bodies:[[pid,x,y]], myTasks:[{id,done}], role, ghost, vision, near: objectId|null, sab, now }`
- Produces `Hud`: `Hud.init(root, handlers)`, `Hud.render(h)` — `h = { role, tasks:[{id,room,label,done}], progress:0~1, buttons:{use:{on,label}, kill:{on,cd}, report:{on}, sab:{on}}, banner:string|null, sab:null|{k,r,h} }`. `handlers = { use(), kill(), report(), sab(kind) }`
- 방장 루프(game.js): `requestAnimationFrame`마다 `Rules.step(state, dt, inputs)`, 100ms마다 `Net.put(st, Snap.pack(state))`. 입력은 `onRoom`에서 `in[pid].n`이 바뀔 때마다 `{k,a}`를 그 사람 대기열에 넣고, 다음 step의 `cmds`로 넘긴다. 방장 자신의 입력은 네트워크를 거치지 않고 바로 넣는다.
- 참가자 루프: 이동 입력이 바뀌면(또는 100ms마다) `in/<me> = {x,y,n,k,a}` 쓰기. 명령은 `n += 1`과 함께. 내 캐릭터는 `Geom.move`로 미리 움직이고 `Interp.correct`로 방장 값에 당긴다. 남은 `Interp.Buffer`(로컬 수신 시각 `performance.now()/1000`으로 push)로 보간.
- 숨은 탭 대책: 방장 탭이 숨겨지면(`document.hidden`) `setInterval(…, 50)`으로 step과 방송을 계속한다(rAF가 멈추므로). 화면은 안 그린다.

**그리기 요구:**
- 카메라는 나를 가운데, 화면 가로에 약 24칸이 보이게 배율.
- 바닥: 방마다 다른 바닥색(회의실 카펫 남색, 탕비실 타일 베이지, 서버실 진회색, 렌더팜 짙은 남보라, 복사실 연회색, 휴게실 원목, 대표실 와인색 카펫, 창고 콘크리트, 엘리베이터 홀 대리석 흰색), 복도 회색. 벽은 짙은 남색 + 위쪽 테두리 밝게. 방 이름을 바닥에 옅게.
- 가구(장식, 충돌 없음): 회의실 탁자(막힌 칸 위에), 서버실 서버 랙, 렌더팜 PC 줄, 복사실 복사기, 탕비실 싱크대·냉장고, 휴게실 소파, 대표실 큰 책상, 창고 선반. 단순 사각형·원 조합.
- 임무 장소: 내 남은 임무면 노란 테두리가 깜빡임, 가까우면 진하게. 환풍구는 철망 사각형. 긴급 버튼은 빨간 원.
- 캐릭터: 콩 모양 몸(색), 하늘색 고글, 등 배낭, 아래 이름표. 움직이면 살짝 통통 튐. 유령은 반투명 + 꼬리.
- 시체: 몸 아래 절반 + 뼈 하나.
- 어둠: 화면 크기 오프스크린 캔버스를 rgba(0,0,0,0.88)로 채우고 `destination-out`으로 시야 다각형(가장자리 그라데이션)을 뚫어 위에 덮는다. 유령은 어둠 없음. 시야 밖 남·시체는 그리지 않는다(`Geom.canSee`).
- 산 사람에게 유령은 그리지 않는다. 환풍구 안(`vent`)인 사람도 그리지 않는다.

**HUD 요구:**
- 위 가운데: 전체 임무 진행 바(초록), "회사 업무 진행률".
- 왼쪽: 내 임무 목록 "방 이름: 할 일" — 끝난 건 초록 줄긋기. 임포스터는 맨 위에 빨간 "가짜 임무 — 하는 척만 하세요".
- 왼쪽 위: 역할 작은 글씨(직원 하늘색 / 임포스터 빨강, 동료 이름 함께).
- 오른쪽 아래 큰 버튼: [사용 E] (가까운 물건 있을 때 켜짐, 라벨이 "임무"/"긴급 회의"/"환풍구"/"고치기"/"누르기"로 바뀜), [신고 R](시체 근처), 임포스터만 [킬 Q](쿨다운 숫자와 원형 감소), [사보타주 Tab].
- 시작 3초: 화면 가운데 큰 글씨 "직원" 또는 "임포스터" + 설명 한 줄.
- 키: WASD/방향키 이동, E/스페이스 사용, Q 킬(가장 가까운 산 직원 대상, 클라이언트는 자기가 아는 동료는 제외), R 신고(가장 가까운 시체), Tab 사보타주 메뉴.

- [ ] **Step 1~3: `view.js`, `hud.js`, game.js 게임 루프 구현** (위 요구 그대로)
- [ ] **Step 4: 브라우저 확인** — `/?local` 단일 탭은 4명 미만이라 시작 불가 → Task 10의 봇 전에는 임시로 `?local&min=1` 일 때 최소 인원 1명으로 시작 가능하게 한다(이 옵션은 `local`일 때만 먹는다). 확인: 이동, 벽 충돌, 시야 어둠, 임무 노란 표시, HUD 배치. 스크린샷.
- [ ] **Step 5: Commit** — `git add -A && git commit -m "게임 화면: 이동·시야·HUD"`

---

### Task 10: 시험용 봇 (`?bots=N`, 로컬 전용)

**Files:**
- Create: `js/devbots.js`

**Interfaces:**
- Produces `DevBots.start(ctx)`, `DevBots.stop()`. `ctx = { code, net: Net, me: hostPid }`. `?local&bots=N`(1~9)일 때만, **방장 탭 안에서** N명의 가짜 참가자를 만든다: `who/bot1..N`(이름 "봇1"…, 빈 색, `pub`은 진짜 키), 2초마다 `seen` 갱신, 방장 메모리 상태(`state`)를 직접 읽어 자기 역할을 안다.
- 봇 행동(방장 루프에서 0.2초마다 결정, `in/<bot>`에 씀):
  - 직원 봇: 남은 임무 장소로 BFS 경로(Task 6 `walker.js`와 같은 알고리즘을 브라우저용으로 다시 적은 `route/steer`) → 도착하면 1.5초 서 있다가 `use`. 다 하면 회의실로 돌아와 서성임. 시체가 시야(192) 안에 보이면 걸어가 `report`.
  - 임포스터 봇: 무작위 방으로 걸어다니다가 킬쿨 0이고 반경 48 안에 혼자 있는 직원이 있으면 `kill`. 25% 확률로 환풍구 이용.
  - 회의: 투표 단계 시작 2~8초 뒤 무작위로 투표(직원 봇은 시체 근처에서 본 사람 중 하나, 없으면 `skip`). 채팅에 "저 탕비실에 있었어요" 같은 짧은 문장 하나.
- `local`이 아니면 이 파일은 아무것도 안 한다.

- [ ] **Step 1: 구현**
- [ ] **Step 2: 브라우저 확인** — `/?local&bots=5` 한 탭으로 방 만들기 → 6명 → 시작 → 봇들이 움직이고 임무 진행 바가 오른다 → 킬 → 신고 → 회의 화면까지 가는지(회의 화면은 Task 12 전이면 빈 화면이어도 단계 전환만 확인). 스크린샷.
- [ ] **Step 3: Commit** — `git add -A && git commit -m "시험용 봇 (로컬 전용)"`

---

### Task 11: 미니게임 6종

**Files:**
- Create: `js/tasks/common.js`, `js/tasks/copier.js`, `js/tasks/render.js`, `js/tasks/coffee.js`, `js/tasks/cable.js`, `js/tasks/stamp.js`, `js/tasks/plant.js`, `test/tasks.test.js`

**Interfaces:**
- `Tasks.open(type, layerEl) → Promise<'done'|'cancel'>`: 화면 가운데 480×360 창(제목, 닫기 ✕, Esc로 닫기), 끝나면 "완료!" 0.6초 후 닫힘.
- 각 미니게임은 `Tasks.kinds[type] = { title, label, mount(el, done) }`와 순수 판정 함수를 노출한다:
  - `copier.inTray(x, y)` — 종이 중심이 용지함 사각형 `{x:300,y:140,w:140,h:100}` 안
  - `render.next(checked:[bool,bool,bool], i) → bool` — i번째는 앞의 것이 모두 체크됐을 때만 체크 가능
  - `coffee.judge(level) → 'ok'|'low'|'over'` — 0.78~0.92 ok, 미만 low, 초과 over
  - `cable.solved(links:{0..3: 0..3}, left:[색], right:[색]) → bool` — 네 줄 모두 같은 색끼리
  - `stamp.hit(x, y, box:{x,y,w,h}) → bool` — 도장 중심이 빈칸 안
  - `plant.judge(level) → 'ok'|'low'|'over'` — 0.6~0.8 ok
- 할 일 문구(`label`): copier "복사기에 용지 넣기", render "렌더 큐 걸기", coffee "커피 내리기", cable "서버 케이블 연결", stamp "결재 도장 찍기", plant "화분 물 주기".

- [ ] **Step 1: 판정 시험 작성 `test/tasks.test.js`**

```js
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { load } = require('../testlib/load');
const W = load(['tasks/common', 'tasks/copier', 'tasks/render', 'tasks/coffee', 'tasks/cable', 'tasks/stamp', 'tasks/plant'], { document: undefined });
const K = W.Tasks.kinds;

test('여섯 가지가 다 등록되어 있고 문구가 있다', () => {
  assert.deepEqual(Object.keys(K).sort(), ['cable', 'coffee', 'copier', 'plant', 'render', 'stamp']);
  for (const k of Object.keys(K)) assert.ok(K[k].label.length > 0);
});
test('복사기: 용지함 안만 인정', () => {
  assert.equal(K.copier.inTray(370, 190), true);
  assert.equal(K.copier.inTray(100, 190), false);
});
test('렌더: 순서대로만 체크', () => {
  assert.equal(K.render.next([false, false, false], 0), true);
  assert.equal(K.render.next([false, false, false], 1), false);
  assert.equal(K.render.next([true, false, false], 1), true);
});
test('커피: 선까지만', () => {
  assert.equal(K.coffee.judge(0.5), 'low');
  assert.equal(K.coffee.judge(0.85), 'ok');
  assert.equal(K.coffee.judge(0.95), 'over');
});
test('케이블: 같은 색끼리 넷 다', () => {
  const L = ['red', 'blue', 'yellow', 'green'], Rr = ['blue', 'green', 'red', 'yellow'];
  assert.equal(K.cable.solved({ 0: 2, 1: 0, 2: 3, 3: 1 }, L, Rr), true);
  assert.equal(K.cable.solved({ 0: 2, 1: 0, 2: 3 }, L, Rr), false);
  assert.equal(K.cable.solved({ 0: 0, 1: 2, 2: 3, 3: 1 }, L, Rr), false);
});
test('도장: 빈칸 안', () => {
  const box = { x: 100, y: 100, w: 80, h: 60 };
  assert.equal(K.stamp.hit(140, 130, box), true);
  assert.equal(K.stamp.hit(90, 130, box), false);
});
test('화분: 초록 칸', () => {
  assert.equal(K.plant.judge(0.7), 'ok');
  assert.equal(K.plant.judge(0.3), 'low');
  assert.equal(K.plant.judge(0.9), 'over');
});
```

- [ ] **Step 2: Run** `node --test test/tasks.test.js` / Expected: FAIL
- [ ] **Step 3: 구현** — 각 파일은 판정 함수 + `mount`(DOM·작은 캔버스). `document`가 없으면(Node) `mount`는 안 부른다.
  - copier: 왼쪽 종이 묶음을 끌어 오른쪽 용지함에 놓기. 놓친 곳에 놓으면 제자리로.
  - render: 샷 이름 3개("SH010_조명", "SH020_카페인트", "SH030_턴테이블") 체크박스, 순서 어기면 흔들림. 다 체크 후 [렌더] → 2초 진행 바.
  - coffee: [누르고 있기] 버튼을 누르는 동안 잔이 0→1을 2.2초에 참. 떼면 판정. low면 "조금 더", over면 "넘쳤어요! 다시" 후 0으로.
  - cable: 왼쪽 4색 단자 → 오른쪽 섞인 4색 단자로 마우스 끌기. 틀린 색에 놓으면 선이 사라짐.
  - stamp: 서류 3장이 차례로 나옴, 빈칸(점선 상자)에 클릭하면 빨간 도장. 빗나가면 "빈칸에 찍어 주세요"와 함께 그 장 다시.
  - plant: [물 주기] 버튼을 누르는 동안 게이지 상승(초당 0.4), 떼면 판정.
- [ ] **Step 4: Run** `node --test` / Expected: 전부 PASS
- [ ] **Step 5: 게임 연결** — 내 남은 임무 장소에서 E → `Tasks.open(type)` → `'done'`이면 `use` 명령 전송. 열려 있는 동안 이동 입력은 0. 임포스터가 가짜 임무에서 E를 누르면 같은 창이 열리고 끝나도 명령은 안 보낸다(하는 척).
- [ ] **Step 6: 브라우저 확인** — 여섯 개 각각 열어 끝까지 해 보고 스크린샷 6장.
- [ ] **Step 7: Commit** — `git add -A && git commit -m "미니게임 6종"`

---

### Task 12: 회의·채팅·투표·추방·결과

**Files:**
- Create/Modify: `js/meeting.js`, `js/game.js`

**Interfaces:**
- Produces `Meeting`: `Meeting.open(layerEl, handlers)`, `Meeting.render(v)`, `Meeting.close()`. `handlers = { send(text), vote(pid|'skip') }`. `v = { stage, left(초), by, body, me, meAlive, players:[{pid,name,color,alive,voted}], chat:[{pid,name,color,m,g}], votes:{pid:target}|null, ejected:{pid,name,imp,impsLeft}|null }`
- game.js: 방장은 `meeting` 이벤트가 나면 `Net.del('crew/'+code+'/chat')`. 채팅 쓰기는 `chat/<Date.now()>_<pid>` 에 `{p, m(120자 자름), t: Date.now(), g: !meAlive}`. 산 사람 화면에서는 `g:true` 글을 숨긴다.

**화면 요구:**
- 시작 순간 1.5초 큰 글씨: 신고면 "시체 발견! — OOO님이 신고", 버튼이면 "긴급 회의 — OOO님이 소집".
- 왼쪽 2열 카드: 색 콩 + 이름, 죽은 사람은 회색·X, 신고자에 📢, 투표한 사람에 "투표함" 도장. 투표 단계에 내 카드 아닌 산 사람 카드를 누르면 [투표]/[취소] 확인 → 투표. 아래 [건너뛰기].
- 오른쪽 채팅창: 글 목록(색 점 + 이름 + 내용), 입력칸(120자, Enter 전송). 죽은 사람이 쓰면 유령끼리만 보인다는 안내를 입력칸 위에.
- 위쪽: 단계와 남은 초 "토론 0:42" / "투표 0:17".
- 공개 단계: 각 카드 아래에 그 사람에게 투표한 사람들의 색 점, [건너뛰기] 아래도 같이. 1초 뒤 전체 화면 추방 연출: 검은 배경에 콩이 화면을 가로질러 날아감 + "OOO님은 임포스터였습니다/가 아니었습니다", 아래 "남은 임포스터 N명". 아무도 없으면 "아무도 추방되지 않았습니다".
- 결과 화면: "직원 승리" 하늘색 / "임포스터 승리" 빨강 + 이유 문장(tasks "업무를 모두 끝냈습니다", vote "임포스터를 모두 찾아냈습니다", kill "직원이 너무 많이 사라졌습니다", sab "서버가 과열로 멈췄습니다"), 임포스터였던 사람들 콩 + 이름. 10초 뒤 방장이 `meta.phase='lobby'`로 되돌리고 `st`, `sec`, `chat`, `in` 삭제.

- [ ] **Step 1: 구현**
- [ ] **Step 2: 브라우저 확인** — `/?local&bots=5`로 회의까지 가서 채팅 입력, 투표, 공개, 추방 연출, 다시 게임, 결과, 대기실 복귀까지. 스크린샷 4장(토론, 공개, 추방, 결과).
- [ ] **Step 3: Commit** — `git add -A && git commit -m "회의·채팅·투표·추방·결과"`

---

## 2단계

### Task 13: 환풍구·사보타주·유령 화면

**Files:**
- Modify: `js/view.js`, `js/hud.js`, `js/game.js`, `js/meeting.js`

**요구:**
- 환풍구: 임포스터가 환풍구 근처면 [사용] 라벨 "환풍구". 들어가면 화면 가운데 위에 "환풍구 안 — ←/→ 없이 E: 연결된 환풍구로, 방향키: 나가기" 안내와 짝 환풍구 방향 화살표. E → 짝으로 이동 명령(`use`, a=짝 id).
- 사보타주: Tab → 작은 메뉴 [정전] [서버 과열], 쿨다운 중이면 남은 초. 진행 중이면 메뉴 꺼짐. 산·추방된 임포스터 모두 가능.
- 정전 중: 직원 시야 48로 줄어듦(임포스터는 그대로), 화면 위 노란 띠 "정전! 창고 두꺼비집을 고치세요", 두꺼비집이 노랗게 깜빡임.
- 서버 과열 중: 화면 가장자리 붉은 맥동, 위 빨간 띠 "서버 과열! 0:37 — 서버실·렌더팜 패널을 동시에 누르세요 (1/2)". 패널 근처에서 E를 **누르고 있는 동안** `hold`(a=p1|p2), 떼거나 멀어지면 `hold`(a='').
- 유령: 죽으면 "당신은 죽었습니다 — 유령으로 남은 임무를 계속할 수 있어요" 3초 안내, 화면 어둠 없음, 반투명 내 캐릭터, 신고·버튼 비활성. 유령끼리는 반투명으로 보임. 회의 채팅에서 유령 글은 유령에게만.
- [ ] **Step 1: 구현**
- [ ] **Step 2: 브라우저 확인** — `/?local&bots=5`에서 내가 임포스터가 될 때까지 다시 시작(대기실에서 `?local&me=imp`이면 방장 자신을 임포스터로 고정하는 시험 옵션, local 전용). 환풍구 이동, 정전, 서버 과열(봇이 패널로 감), 죽은 뒤 유령 화면 스크린샷.
- [ ] **Step 3: Commit** — `git add -A && git commit -m "환풍구·사보타주·유령 화면"`

---

### Task 14: 실제 Firebase로 마무리와 배포 준비

**Files:**
- Create: `README.md`, `깃허브업데이트.bat`(cp949)

- [ ] **Step 1: 규칙 게시 요청** — 사용자에게: Firebase 콘솔 → Realtime Database → 규칙 탭에서 현재 규칙을 먼저 복사해 `docs/firebase-rules-backup-<날짜>.json`로 저장, 그다음 `docs/firebase-rules-crew.json` 전체를 붙여넣고 [게시]. Claude는 콘솔을 만지지 않는다. **사용자가 게시했다고 말하기 전에는 다음 단계를 진행하지 않는다.**
- [ ] **Step 2: 실제 접속 확인** — `http://localhost:8896/` 탭 두 개(?local 없이)로 방 만들기·입장·나가기. 그다음 `Net.put('crew/TEST/...')` 직접 호출로 규칙 검증: 허용 필드는 200, `crew/TEST/meta/evil` 같은 금지 필드는 401/403. `rooms/`·`scores/`는 읽기만 해서 기존 데이터가 그대로인지 확인.
- [ ] **Step 3: `README.md`** — 하는 법(조작키 표), 혼자 시험하는 법(`?local&bots=5`), 파일 지도, Firebase 경로 금지 규칙.
- [ ] **Step 4: `깃허브업데이트.bat`** — 모코파크 것과 같은 모양, 주소 `https://mokh990322-source.github.io/office-impostor/`. cp949.
- [ ] **Step 5: 저장소 만들기 확인** — 사용자에게 "공개 저장소 `mokh990322-source/office-impostor`를 만들고 GitHub Pages를 켤까요?"를 묻는다. 허락하면 `gh repo create mokh990322-source/office-impostor --public --source . --push` 후 Pages 설정(`gh api -X POST repos/mokh990322-source/office-impostor/pages -f "source[branch]=main" -f "source[path]=/"`). 허락 없으면 로컬 커밋까지만.
- [ ] **Step 6: Commit** — `git add -A && git commit -m "README와 배포 파일"`
