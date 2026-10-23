/* ============================================================
   모몽어스 — 맵 데이터

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
  var TABLE = { x0: 26, y0: 19, x1: 30, y1: 21 };
  carve(TABLE.x0, TABLE.y0, TABLE.x1, TABLE.y1, 1);

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
  /* 시야를 막는 칸: 벽만. 탁자는 걸어서는 못 지나가도 너머는 보인다. */
  function opaque(tx, ty) {
    if (!solid(tx, ty)) return false;
    return !(tx >= TABLE.x0 && tx <= TABLE.x1 && ty >= TABLE.y0 && ty <= TABLE.y1);
  }
  /* 탁자 가장자리까지의 거리(px). 탁자 안이면 0.
     긴급 버튼은 탁자 위에 있어서, 버튼 한가운데까지 거리로 재면 가로로 긴 탁자의
     옆에 선 사람은 영영 못 누른다(2026-10-22 실제 버그). 그래서 탁자 가장자리로 잰다. */
  function tableDist(px, py) {
    var x0 = TABLE.x0 * T, x1 = (TABLE.x1 + 1) * T, y0 = TABLE.y0 * T, y1 = (TABLE.y1 + 1) * T;
    var dx = Math.max(x0 - px, 0, px - x1), dy = Math.max(y0 - py, 0, py - y1);
    return Math.sqrt(dx * dx + dy * dy);
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
    T: T, W: W, H: H, rooms: rooms, objects: objects, table: TABLE,
    solid: solid,
    opaque: opaque,
    roomAt: roomAt,
    tableDist: tableDist,
    byId: function (id) { return Object.prototype.hasOwnProperty.call(byIdMap, id) ? byIdMap[id] : null; },
    center: function (o) { return { x: (o.tx + 0.5) * T, y: (o.ty + 0.5) * T }; },
    spawn: function (i) { var s = SPAWN[((i % 10) + 10) % 10]; return { x: (s[0] + 0.5) * T, y: (s[1] + 0.5) * T }; },
    ventPair: function (id) { return Object.prototype.hasOwnProperty.call(PAIR, id) ? PAIR[id] : null; },
    stationIds: function () { return objects.filter(function (o) { return o.kind === 'task'; }).map(function (o) { return o.id; }); }
  };
})(window);
