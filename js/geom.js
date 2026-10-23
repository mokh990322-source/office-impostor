/* ============================================================
   모몽어스 — 충돌과 시야

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

  /* 시야는 벽만 막는다(map.opaque). 없으면 막힌 칸 전부. */
  function blocks(map, tx, ty) { return map.opaque ? map.opaque(tx, ty) : map.solid(tx, ty); }

  function ray(map, x, y, ang, max) {
    var c = Math.cos(ang), s = Math.sin(ang), T = map.T;
    for (var d = 0; d < max; d += STEP) {
      if (blocks(map, Math.floor((x + c * d) / T), Math.floor((y + s * d) / T))) return d;
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
      if (blocks(map, Math.floor((ax + dx * k) / T), Math.floor((ay + dy * k) / T))) return false;
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
