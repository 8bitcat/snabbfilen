// Gå-motorn: samma rutnäts-A* och figurstyrning som hemma, för alla gåbara
// miljöer (staden, butikerna, jobben). En scen skapar en walker, matar in
// hinder-rektanglar och får gång med utslätade vägar. Dessutom gemensam
// ritning av andra spelare (världen) och namnskyltar/pratbubblor.
import { drawPerson } from '../core/people.js';
import { avatarTagColors } from '../core/avatar.js';
import { SMALL, ctxText, textW } from '../core/floor-pix.js';
import { worldFolksHere, worldMyEmote } from '../net/world.js';

export const WALK_SEQ = [1, 3, 2, 3];
const FW = 384, FH = 216;

export function createWalker({ left = 8, right = FW - 8, top = 90, bottom = FH - 4, spawn }) {
  const CELL = 4, GW = Math.ceil(FW / CELL), GH = Math.ceil(FH / CELL);
  let freeGrid = new Uint8Array(GW * GH);
  let obstacles = [];
  function setObstacles(list) {
    obstacles = list;
    freeGrid = new Uint8Array(GW * GH);
    for (let gy = 0; gy < GH; gy++) for (let gx = 0; gx < GW; gx++) {
      const x = gx * CELL + 2, y = gy * CELL + 2;
      let ok = x > left && x < right && y > top && y < bottom;
      if (ok) for (const [x0, y0, x1, y1] of obstacles) if (x > x0 - 2 && x < x1 + 2 && y > y0 - 2 && y < y1 + 2) { ok = false; break; }
      freeGrid[gy * GW + gx] = ok ? 1 : 0;
    }
  }
  setObstacles([]);
  const walkable = (x, y) => !!freeGrid[Math.max(0, Math.min(GH - 1, (y / CELL) | 0)) * GW + Math.max(0, Math.min(GW - 1, (x / CELL) | 0))];
  function nearestFree(x, y) {
    if (walkable(x, y)) return [x, y];
    for (let r = 1; r < 50; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
      const nx = x + dx * CELL, ny = y + dy * CELL;
      if (nx > 0 && ny > 0 && nx < FW && ny < FH && walkable(nx, ny)) return [nx, ny];
    }
    return [x, y];
  }
  const los = (ax, ay, bx, by) => {
    const n = Math.ceil(Math.hypot(bx - ax, by - ay) / 2);
    for (let i = 1; i < n; i++) if (!walkable(ax + (bx - ax) * i / n, ay + (by - ay) * i / n)) return false;
    return true;
  };
  function findPath(sx, sy, tx, ty) {
    [tx, ty] = nearestFree(tx, ty);
    if (los(sx, sy, tx, ty)) return [[tx, ty]];
    const cellOf = (x, y) => [Math.max(0, Math.min(GW - 1, (x / CELL) | 0)), Math.max(0, Math.min(GH - 1, (y / CELL) | 0))];
    const [s0, s1] = cellOf(...nearestFree(sx, sy)), [t0, t1] = cellOf(tx, ty);
    const from = new Map([[s1 * GW + s0, -1]]);
    const q = [s1 * GW + s0];
    const goal = t1 * GW + t0;
    while (q.length) {
      const cur = q.shift();
      if (cur === goal) break;
      const cx = cur % GW, cy = (cur / GW) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        const nx = cx + dx, ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= GW || ny >= GH) continue;
        const ni = ny * GW + nx;
        if (!freeGrid[ni] || from.has(ni)) continue;
        if (dx && dy && (!freeGrid[cy * GW + nx] || !freeGrid[ny * GW + cx])) continue;
        from.set(ni, cur);
        q.push(ni);
      }
    }
    if (!from.has(goal)) return los(sx, sy, tx, ty) ? [[tx, ty]] : [];
    const cells = [];
    for (let i = goal; i !== -1; i = from.get(i)) cells.push([(i % GW) * CELL + 2, ((i / GW) | 0) * CELL + 2]);
    cells.reverse();
    cells[cells.length - 1] = [tx, ty];
    const out = [];
    let ax = sx, ay = sy, i = 0;
    while (i < cells.length) {
      let j = cells.length - 1;
      while (j > i && !los(ax, ay, cells[j][0], cells[j][1])) j--;
      out.push(cells[j]); [ax, ay] = cells[j]; i = j + 1;
    }
    return out;
  }

  const W = {
    px: spawn?.[0] ?? 100, py: spawn?.[1] ?? 150,
    dir: 'down', path: [], onArrive: null, speed: 62,
    setObstacles, walkable, nearestFree, findPath,
    snapFree() { [W.px, W.py] = nearestFree(W.px, W.py); },
    walkTo(x, y, cb) {
      W.path = findPath(W.px, W.py, x, y);
      W.onArrive = cb || null;
      if (!W.path.length) { const d = W.onArrive; W.onArrive = null; d?.(); }
    },
    stop() { W.path = []; W.onArrive = null; },
    update(dt) {
      if (!W.path.length) return false;
      const [gx, gy] = W.path[0];
      const dx = gx - W.px, dy = gy - W.py, dist = Math.hypot(dx, dy), step = W.speed * dt;
      W.dir = Math.abs(dx) > Math.abs(dy) * 1.2 ? (dx < 0 ? 'left' : 'right') : dy < 0 ? 'up' : 'down';
      if (dist <= step) {
        W.px = gx; W.py = gy;
        W.path.shift();
        if (!W.path.length) { W.dir = 'down'; const cb = W.onArrive; W.onArrive = null; cb?.(); }
      } else { W.px += dx / dist * step; W.py += dy / dist * step; }
      return true;
    },
  };
  W.snapFree();
  return W;
}

// Min figur som drawable (med namnskylt när andra är här, bär-frames vid carry)
export function selfDrawable(A, walker, t, { carry = false, folksHere = 0 } = {}) {
  return {
    fy: walker.py,
    draw(ctx) {
      const walking = walker.path.length > 0;
      const frame = carry
        ? (walking ? [7, 9, 8, 9][Math.floor(t * 8.5) % 4] : 9)
        : walking ? WALK_SEQ[Math.floor(t * 8.5) % 4] : (Math.sin(t * 2) > 0.9 ? 4 : 0);
      drawPerson(ctx, walker.px, walker.py, A.avatar.look, walker.dir, frame);
      if (folksHere) nameTag(ctx, walker.px, walker.py - 50, A.avatar);
      const mine = worldMyEmote();
      if (mine) emoteBubble(ctx, walker.px, walker.py - 60, mine);
    },
  };
}
// Andra spelare på samma plats som drawables
export function folkDrawables(A, t) {
  return worldFolksHere(A).map((f) => ({
    fy: f.y,
    draw(ctx) {
      drawPerson(ctx, f.x, f.y, f.av.look, 'down', f.walking ? WALK_SEQ[Math.floor(t * 8.5) % 4] : (Math.sin(t * 2 + f.x) > 0.9 ? 4 : 0));
      nameTag(ctx, f.x, f.y - 50, f.av);
      if (f.emote) emoteBubble(ctx, f.x, f.y - 58, f.emote);
    },
  }));
}

export function nameTag(ctx, x, y, av) {
  const c = avatarTagColors(av);
  const w = textW(SMALL, av.name || '?') + 6;
  ctx.fillStyle = c.bg; ctx.fillRect(x - w / 2 | 0, y | 0, w, 9);
  ctxText(ctx, SMALL, av.name || '?', (x - w / 2 | 0) + 3, (y | 0) + 2, c.fg);
}

export function emoteBubble(ctx, x, y, e, k = 1) {
  ctx.fillStyle = '#17151a'; ctx.fillRect(x - 9 * k | 0, y - 15 * k, 18 * k, 16 * k);
  ctx.fillStyle = '#f4f1ea'; ctx.fillRect(x - 8 * k | 0, y - 14 * k, 16 * k, 14 * k);
  ctx.fillStyle = '#f4f1ea'; ctx.fillRect(x - k | 0, y, 3 * k, 3 * k);
  ctx.font = `${10 * k}px "Segoe UI Emoji", sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(e, x, y - 7 * k);
  ctx.textAlign = 'start'; ctx.textBaseline = 'alphabetic';
}

// Pratbubbla med en pixelritad ikon (8×8-karta) – för kunder och tallrikar
export function iconBubble(ctx, x, y, drawIcon, hot = false) {
  ctx.fillStyle = hot ? '#e8b230' : '#17151a'; ctx.fillRect(x - 8 | 0, y - 16, 20, 18);
  ctx.fillStyle = '#f4f1ea'; ctx.fillRect(x - 7 | 0, y - 15, 18, 16);
  ctx.fillStyle = '#f4f1ea'; ctx.fillRect(x - 1 | 0, y + 1, 3, 3);
  drawIcon(ctx, x + 2, y - 7);
}
