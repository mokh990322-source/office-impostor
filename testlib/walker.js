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
