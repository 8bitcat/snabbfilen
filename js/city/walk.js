// Gång-motorn för den stora staden. Samma API som createWalker i
// scenes/walkable.js (px, py, dir, path, walkTo, stop, update, setObstacles,
// walkable, nearestFree, findPath, snapFree) men byggd för en värld på
// 2720 × 820: hindren rastreras rektangel för rektangel (inte cell × hinder)
// och vägen hittas med A* på typade arrayer i stället för en bred sökning med
// Array.shift. Vägen jämnas sedan ut med siktlinjer framåt.
// X0 = världens västra kant (Linnéstaden ligger väster om centrum, x < 0): rutnätet börjar där.
const DIRS = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2]];

export function createCityWalker({ X0 = 0, W: WW, H: WH, left = X0 + 4, right = WW - 4, top = 8, bottom = WH - 4, spawn, cell = 4 }) {
  const C = cell, GW = Math.ceil((WW - X0) / C), GH = Math.ceil(WH / C), N = GW * GH;
  let grid = new Uint8Array(N);
  // A*-arbetsminne (återanvänds mellan sökningarna; stämpeln slipper nollställning)
  const gScore = new Float32Array(N), from = new Int32Array(N), stamp = new Uint32Array(N), closed = new Uint32Array(N);
  let run = 0;

  function setObstacles(list) {
    grid = new Uint8Array(N);
    // gåbar inom ramen (cellens mittpunkt, samma regel som v1)
    for (let gy = 0; gy < GH; gy++) {
      const y = gy * C + 2;
      if (!(y > top && y < bottom)) continue;
      for (let gx = 0; gx < GW; gx++) { const x = X0 + gx * C + 2; if (x > left && x < right) grid[gy * GW + gx] = 1; }
    }
    // hindren: cellmitt (x, y) blockeras om x0−2 < x < x1+2 och y0−2 < y < y1+2
    for (const r of list) {
      if (!r) continue;
      const [x0, y0, x1, y1] = r;
      const gx0 = Math.max(0, Math.floor((x0 - 4 - X0) / C)), gx1 = Math.min(GW - 1, Math.ceil((x1 + 2 - X0) / C));
      const gy0 = Math.max(0, Math.floor((y0 - 4) / C)), gy1 = Math.min(GH - 1, Math.ceil((y1 + 2) / C));
      for (let gy = gy0; gy <= gy1; gy++) {
        const y = gy * C + 2;
        if (!(y > y0 - 2 && y < y1 + 2)) continue;
        const row = gy * GW;
        for (let gx = gx0; gx <= gx1; gx++) { const x = X0 + gx * C + 2; if (x > x0 - 2 && x < x1 + 2) grid[row + gx] = 0; }
      }
    }
  }
  setObstacles([]);
  const cx = (x) => Math.max(0, Math.min(GW - 1, Math.floor((x - X0) / C)));
  const cy = (y) => Math.max(0, Math.min(GH - 1, (y / C) | 0));
  const walkable = (x, y) => !!grid[cy(y) * GW + cx(x)];
  function nearestFree(x, y) {
    if (walkable(x, y)) return [x, y];
    for (let r = 1; r < 60; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
      const nx = x + dx * C, ny = y + dy * C;
      if (nx > X0 && ny > 0 && nx < WW && ny < WH && walkable(nx, ny)) return [nx, ny];
    }
    return [x, y];
  }
  const los = (ax, ay, bx, by) => {
    const n = Math.ceil(Math.hypot(bx - ax, by - ay) / 2);
    for (let i = 1; i < n; i++) if (!walkable(ax + (bx - ax) * i / n, ay + (by - ay) * i / n)) return false;
    return true;
  };

  // binär min-hög över (f, cell)
  const heapF = [], heapI = [];
  function push(f, i) {
    let k = heapF.length; heapF.push(f); heapI.push(i);
    while (k > 0) { const p = (k - 1) >> 1; if (heapF[p] <= f) break; heapF[k] = heapF[p]; heapI[k] = heapI[p]; k = p; }
    heapF[k] = f; heapI[k] = i;
  }
  function pop() {
    const top = heapI[0], lf = heapF.pop(), li = heapI.pop(), n = heapF.length;
    if (n) {
      let k = 0;
      for (;;) {
        let c = 2 * k + 1;
        if (c >= n) break;
        if (c + 1 < n && heapF[c + 1] < heapF[c]) c++;
        if (heapF[c] >= lf) break;
        heapF[k] = heapF[c]; heapI[k] = heapI[c]; k = c;
      }
      heapF[k] = lf; heapI[k] = li;
    }
    return top;
  }

  function findPath(sx, sy, tx, ty) {
    [tx, ty] = nearestFree(tx, ty);
    if (los(sx, sy, tx, ty)) return [[tx, ty]];
    const [fx, fy] = nearestFree(sx, sy);
    const s = cy(fy) * GW + cx(fx), goal = cy(ty) * GW + cx(tx), gxg = goal % GW, gyg = (goal / GW) | 0;
    run = (run + 1) >>> 0 || 1;
    heapF.length = 0; heapI.length = 0;
    const h = (i) => { const dx = Math.abs(i % GW - gxg), dy = Math.abs(((i / GW) | 0) - gyg); return Math.max(dx, dy) + (Math.SQRT2 - 1) * Math.min(dx, dy); };
    stamp[s] = run; gScore[s] = 0; from[s] = -1;
    push(h(s), s);
    let found = false;
    while (heapF.length) {
      const cur = pop();
      if (closed[cur] === run) continue;
      closed[cur] = run;
      if (cur === goal) { found = true; break; }
      const x = cur % GW, y = (cur / GW) | 0, g0 = gScore[cur];
      for (const [dx, dy, cost] of DIRS) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= GW || ny >= GH) continue;
        const ni = ny * GW + nx;
        if (!grid[ni] || closed[ni] === run) continue;
        if (dx && dy && (!grid[y * GW + nx] || !grid[ny * GW + x])) continue; // inga genvägar över hörn
        const g = g0 + cost;
        if (stamp[ni] === run && gScore[ni] <= g) continue;
        stamp[ni] = run; gScore[ni] = g; from[ni] = cur;
        push(g + h(ni), ni);
      }
    }
    if (!found) return los(sx, sy, tx, ty) ? [[tx, ty]] : [];
    const cells = [];
    for (let i = goal; i !== -1; i = from[i]) cells.push([X0 + (i % GW) * C + 2, ((i / GW) | 0) * C + 2]);
    cells.reverse();
    cells[cells.length - 1] = [tx, ty];
    // utjämning: gå så långt framåt som siktlinjen håller
    const out = [];
    let ax = sx, ay = sy, i = 0;
    while (i < cells.length) {
      let j = i;
      while (j + 1 < cells.length && los(ax, ay, cells[j + 1][0], cells[j + 1][1])) j++;
      out.push(cells[j]); [ax, ay] = cells[j]; i = j + 1;
    }
    return out;
  }

  const Wk = {
    px: spawn?.[0] ?? 100, py: spawn?.[1] ?? 150,
    dir: 'down', path: [], onArrive: null, speed: 62,
    setObstacles, walkable, nearestFree, findPath,
    snapFree() { [Wk.px, Wk.py] = nearestFree(Wk.px, Wk.py); },
    walkTo(x, y, cb) {
      Wk.path = findPath(Wk.px, Wk.py, x, y);
      Wk.onArrive = cb || null;
      if (!Wk.path.length) { const d = Wk.onArrive; Wk.onArrive = null; d?.(); }
    },
    stop() { Wk.path = []; Wk.onArrive = null; },
    update(dt) {
      if (!Wk.path.length) return false;
      const [gx, gy] = Wk.path[0];
      const dx = gx - Wk.px, dy = gy - Wk.py, dist = Math.hypot(dx, dy), step = Wk.speed * dt;
      Wk.dir = Math.abs(dx) > Math.abs(dy) * 1.2 ? (dx < 0 ? 'left' : 'right') : dy < 0 ? 'up' : 'down';
      if (dist <= step) {
        Wk.px = gx; Wk.py = gy;
        Wk.path.shift();
        if (!Wk.path.length) { Wk.dir = 'down'; const cb = Wk.onArrive; Wk.onArrive = null; cb?.(); }
      } else { Wk.px += dx / dist * step; Wk.py += dy / dist * step; }
      return true;
    },
  };
  Wk.snapFree();
  return Wk;
}
