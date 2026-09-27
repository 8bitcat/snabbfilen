// Hemma – i Pixelverkstans butiksstil: rakt framifrån-trekvartsvy med målad
// tapetvägg, stort plattgolv med glans och ljuskäglor, och möbler ritade
// pixel för pixel med Pix-pennan (samma teknik som datorbutikens montrar).
// Man går fritt på golvet (klicka = gå dit, A* runt möblerna), figurer och
// möbler y-sorteras på fotlinjen. Bostadsstorleken styrs av en avdelarvägg:
// Lilla rummet använder en bit av lokalen, Villan hela – precis som
// Pixelverkstans lokaler. Bakgrunden byggs en gång per läge och återanvänds.
import { drawPerson } from '../core/people.js';
import { openAvatarEditor, avatarTagColors } from '../core/avatar.js';
import { Pix, SMALL, BIG, ctxText, textW, text, mix, mul, css, hash, bayer } from '../core/floor-pix.js';
import { openModal, closeModal, toast } from '../core/ui.js';
import { foodOf } from '../game.js';
import { play } from '../core/sound.js';
import { worldFolksHere, worldMyEmote } from '../net/world.js';

const WALK_SEQ = [1, 3, 2, 3];
const FW = 768, FH = 432;
const WALL_Y = 150;          // väggens fot
const DOOR = { x0: 56, x1: 124, cx: 90 };

// Planer per bostad: hur mycket av lokalen man har (partition), tema och möbler.
// Möbler: x = vänsterkant, base = fotlinje (y-sortering). Skyltar ritas på möbeln.
const PLANS = {
  rum: {
    partition: 450, wall: 0x8c7a62, wallDk: 0x6a5c48, floorA: 0xcbb894, floorB: 0xb09a74,
    windows: [[160, 240]],
    furniture: [
      { id: 'sang', x: 36, base: 268 },
      { id: 'garderob', x: 262, base: 186 },
      { id: 'kylskap', x: 356, base: 182 },
    ],
    extra: { soffa: { x: 180, base: 350 }, bord: { x: 320, base: 380 }, vaxt: { x: 415, base: 220 }, tv: { wx: 300 }, matta: [150, 300, 430, 408] },
  },
  lagenhet: {
    partition: 620, wall: 0x6e88a0, wallDk: 0x4e6478, floorA: 0xd9cbaf, floorB: 0xc0ac88,
    windows: [[160, 240], [270, 350]],
    furniture: [
      { id: 'sang', x: 36, base: 268 },
      { id: 'garderob', x: 392, base: 186 },
      { id: 'kylskap', x: 490, base: 182 },
      { id: 'soffa', x: 200, base: 356 },
      { id: 'bord', x: 350, base: 386 },
      { id: 'vaxt', x: 578, base: 224 },
    ],
    extra: { tv: { wx: 430 }, matta: [170, 306, 500, 414], fatolj: { x: 470, base: 340 } },
  },
  villa: {
    partition: 0, wall: 0xc4b190, wallDk: 0x9a8a6a, floorA: 0xefe6d2, floorB: 0xd9ccb2,
    windows: [[160, 240], [268, 344], [614, 694]],
    furniture: [
      { id: 'sang', x: 36, base: 268 },
      { id: 'garderob', x: 456, base: 186 },
      { id: 'kylskap', x: 545, base: 182 },
      { id: 'soffa', x: 210, base: 360 },
      { id: 'bord', x: 360, base: 390 },
      { id: 'fatolj', x: 480, base: 344 },
      { id: 'vaxt', x: 700, base: 224 },
      { id: 'vaxt2', x: 660, base: 410 },
      { id: 'tv', wx: 358 },
      { id: 'matta', rect: [180, 310, 560, 420] },
    ],
    lyx: true,
  },
};
// Köpta möbler dyker upp i mindre bostäder på extraplatserna
const BUYABLE = ['soffa', 'vaxt', 'tv', 'matta'];

export function makeRoom(A, { visit = false } = {}) {
  const g = A.game;
  const homeId = () => (visit ? A.visitTarget?.home || 'rum' : g.home);
  const furnOwned = () => (visit ? A.visitTarget?.furniture || [] : g.furniture);

  const plan = PLANS[homeId()] || PLANS.rum;
  const RIGHT = plan.partition || FW;    // avdelarväggen
  // möbellistan: planens + köpta extra
  const items = [...plan.furniture];
  let rug = plan.furniture.find((f) => f.id === 'matta')?.rect || null;
  for (const id of BUYABLE) {
    if (!furnOwned().includes(id)) continue;
    if (items.some((f) => f.id === id) || (id === 'matta' && rug)) continue;
    const ex = plan.extra?.[id];
    if (!ex) continue;
    if (id === 'matta') rug = plan.extra.matta;
    else if (id === 'tv') items.push({ id: 'tv', wx: ex.wx });
    else items.push({ id, ...ex });
  }
  if (furnOwned().includes('bord') && !items.some((f) => f.id === 'bord') && plan.extra?.bord) items.push({ id: 'bord', ...plan.extra.bord });
  const hasTV = items.some((f) => f.id === 'tv');
  const tvX = items.find((f) => f.id === 'tv')?.wx;

  // ---------- möblerna (Pix-ritade, cacheas per hem) ----------
  const props = [];
  for (const f of items) {
    if (f.id === 'tv' || f.id === 'matta') continue;
    const p = MAKERS[f.id.replace(/\d+$/, '')]?.(f.x, f.base, !visit);
    if (p) props.push({ ...p, id: f.id, fx: f.x, fbase: f.base });
  }

  // hinder (fotrektanglar) för gången
  const obstacles = props.map((p) => p.solid).filter(Boolean);
  // gång-grid 8 px
  const CELL = 8, GW = Math.ceil(FW / CELL), GH = Math.ceil(FH / CELL);
  const freeGrid = new Uint8Array(GW * GH);
  for (let gy = 0; gy < GH; gy++) for (let gx = 0; gx < GW; gx++) {
    const x = gx * CELL + 4, y = gy * CELL + 4;
    let ok = x > 14 && x < RIGHT - 10 && y > WALL_Y + 8 && y < FH - 8;
    if (ok) for (const [x0, y0, x1, y1] of obstacles) if (x > x0 - 4 && x < x1 + 4 && y > y0 - 3 && y < y1 + 3) { ok = false; break; }
    freeGrid[gy * GW + gx] = ok ? 1 : 0;
  }
  const walkable = (x, y) => !!freeGrid[Math.max(0, Math.min(GH - 1, (y / CELL) | 0)) * GW + Math.max(0, Math.min(GW - 1, (x / CELL) | 0))];
  function nearestFree(x, y) {
    if (walkable(x, y)) return [x, y];
    for (let r = 1; r < 40; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
      const nx = x + dx * CELL, ny = y + dy * CELL;
      if (nx > 0 && ny > 0 && nx < FW && ny < FH && walkable(nx, ny)) return [nx, ny];
    }
    return [x, y];
  }
  const los = (ax, ay, bx, by) => {
    const n = Math.ceil(Math.hypot(bx - ax, by - ay) / 4);
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
    if (!from.has(goal)) return [[tx, ty]].filter(() => los(sx, sy, tx, ty));
    const cells = [];
    for (let i = goal; i !== -1; i = from.get(i)) cells.push([(i % GW) * CELL + 4, ((i / GW) | 0) * CELL + 4]);
    cells.reverse();
    cells[cells.length - 1] = [tx, ty];
    const out = [];   // släta ut med siktlinjer
    let ax = sx, ay = sy, i = 0;
    while (i < cells.length) {
      let j = cells.length - 1;
      while (j > i && !los(ax, ay, cells[j][0], cells[j][1])) j--;
      out.push(cells[j]); [ax, ay] = cells[j]; i = j + 1;
    }
    return out;
  }

  let px = visit ? DOOR.cx : Math.min(RIGHT - 80, 200), py = WALL_Y + 60;
  [px, py] = nearestFree(px, py);
  let path = [], onArrive = null, dir = 'down', t = 0;
  function walkTo(x, y, cb) { path = findPath(px, py, x, y); onArrive = cb || null; if (!path.length) { const d = onArrive; onArrive = null; d?.(); } }

  const acts = {
    dorr: visit
      ? () => { A.visitTarget = null; g.passTime(20); g.save(); play('door'); toast('🚗 Hemma igen.'); A.go('city'); }
      : () => { play('door'); A.go('city'); },
    sang: visit ? null : () => A.sleepFlow(),
    garderob: visit ? null : () => { play('click'); openAvatarEditor({ onDone: (av) => { A.avatar = av; toast('👕 Snyggt!', 'good'); } }); },
    kylskap: visit ? null : () => openFridge(A),
  };
  // klickytor: dörren + möbler med handling
  const hotRects = [
    { id: 'dorr', r: [DOOR.x0, 60, DOOR.x1, WALL_Y + 18], go: [DOOR.cx, WALL_Y + 24] },
    ...props.filter((p) => p.solid && acts[p.id] !== undefined).map((p) => ({ id: p.id, r: [p.solid[0], p.y, p.solid[2], p.solid[3] + 4], go: [(p.solid[0] + p.solid[2]) / 2, p.solid[3] + 10] })),
  ];

  const bg = buildBg(A, plan, homeId(), RIGHT, rug, hasTV, tvX, visit);

  return {
    get worldX() { return px; },
    get worldY() { return py; },
    _debug: {
      spot: (id) => { const h = hotRects.find((h) => h.id === id); return h ? { x: (h.r[0] + h.r[2]) / 2, y: (h.r[1] + h.r[3]) / 2 } : null; },
      tile: (a, b) => ({ x: Math.min(RIGHT - 40, 60 + a * 80), y: Math.min(FH - 20, WALL_Y + 30 + b * 36) }),
    },

    update(dt) {
      t += dt;
      if (path.length) {
        const [gx, gy] = path[0];
        const dx = gx - px, dy = gy - py, dist = Math.hypot(dx, dy), step = 120 * dt;
        dir = Math.abs(dx) > Math.abs(dy) * 1.2 ? (dx < 0 ? 'left' : 'right') : dy < 0 ? 'up' : 'down';
        if (dist <= step) {
          px = gx; py = gy;
          path.shift();
          if (!path.length) { dir = 'down'; const cb = onArrive; onArrive = null; cb?.(); }
        } else { px += dx / dist * step; py += dy / dist * step; }
      }
      if (visit && !A.visitTarget) A.go('city');
    },

    down(x, y) {
      for (const h of hotRects) {
        if (x >= h.r[0] && x <= h.r[2] && y >= h.r[1] && y <= h.r[3]) {
          walkTo(h.go[0], h.go[1], acts[h.id] || undefined);
          return;
        }
      }
      if (y > WALL_Y && x < RIGHT) walkTo(x, y);
    },

    draw(ctx) {
      const night = isNight(g);
      ctx.drawImage(bg(night), 0, 0);

      // y-sorterat: möbler + figurer
      const folks = worldFolksHere(A);
      const drawables = props.map((p) => ({ fy: p.sort, draw: () => ctx.drawImage(p.img, p.x, p.y) }));
      const mine = worldMyEmote();
      drawables.push({ fy: py, draw: () => {
        const frame = path.length ? WALK_SEQ[Math.floor(t * 8.5) % 4] : (Math.sin(t * 2) > 0.9 ? 4 : 0);
        drawPerson(ctx, px, py, A.avatar.look, dir, frame);
        if (folks.length) nameTag(ctx, px, py - 50, A.avatar);
        if (mine) emoteBubble(ctx, px, py - 62, mine);
      } });
      for (const f of folks) {
        drawables.push({ fy: f.y, draw: () => {
          drawPerson(ctx, f.x, f.y, f.av.look, 'down', f.walking ? WALK_SEQ[Math.floor(t * 8.5) % 4] : (Math.sin(t * 2 + f.x) > 0.9 ? 4 : 0));
          nameTag(ctx, f.x, f.y - 50, f.av);
          if (f.emote) emoteBubble(ctx, f.x, f.y - 62, f.emote);
        } });
      }
      drawables.sort((a, b) => a.fy - b.fy).forEach((d) => d.draw());

      if (night) { ctx.fillStyle = 'rgba(10,12,40,0.22)'; ctx.fillRect(0, 0, FW, FH); }
    },
  };
}

const isNight = (g) => { const h = g.min / 60; return h >= 19.5 || h < 6.5; };

// ================= bakgrunden (byggs en gång per dag/natt-läge) =================
function buildBg(A, plan, homeId, RIGHT, rug, hasTV, tvX, visit) {
  const cache = {};
  return (night) => {
    const key = night ? 'n' : 'd';
    if (cache[key]) return cache[key];
    const P = new Pix(FW, FH);
    const wall = night ? mul(plan.wall, 0.8) : plan.wall;
    const wallDk = night ? mul(plan.wallDk, 0.8) : plan.wallDk;

    // ---- golvet: stora plattor med skarv, glans och slumpkorn ----
    const TW2 = 46, TH2 = 30;
    for (let y = WALL_Y; y < FH; y++) for (let x = 0; x < FW; x++) {
      const tx = (x / TW2) | 0, ty = ((y - WALL_Y) / TH2) | 0;
      const lx = x - tx * TW2, ly = (y - WALL_Y) - ty * TH2;
      let c = mix(plan.floorA, plan.floorB, ((tx + ty) & 1) ? 0.2 : 0.62);
      c = mul(c, 0.97 + hash(tx, ty, 1) * 0.05);
      const h = hash(x, y, 2);
      if (h > 0.94) c = mul(c, 0.95); else if (h < 0.02) c = mix(c, 0xffffff, 0.25);
      if (plan.lyx) { const vein = Math.sin(x * 0.17 + y * 0.31 + Math.sin(x * 0.05) * 4); if (vein > 0.96) c = mix(c, 0xd8b24a, 0.22); }
      if (lx === 0 || ly === 0) c = mul(c, 0.84);
      else if (lx === 1 || ly === 1) c = mix(c, 0xffffff, 0.2);
      else if (lx + ly > 14 && lx + ly < 18 && ly < 12) c = mix(c, 0xffffff, 0.07); // glans
      P.px(x, y, c);
    }

    // ---- väggen: gradient, paneler och bröstpanel ----
    for (let y = 8, y1 = WALL_Y; y < y1; y++) for (let x = 8; x < FW - 8; x++) {
      let c = mix(mul(wall, 0.8), wall, Math.min(1, (y - 8) / 40) + (bayer(x, y) - 0.5) * 0.12);
      if (x % 54 === 0) c = mul(c, 0.9); else if (x % 54 === 1) c = mix(c, 0xffffff, 0.05);
      if (y >= WALL_Y - 38) { // bröstpanel
        const bx = (x - 8) % 48, by = y - (WALL_Y - 38);
        c = wallDk;
        if (by === 0) c = mul(wallDk, 0.75);
        else if (bx === 4 || by === 4) c = mix(wallDk, 0xffffff, 0.12);
        else if (bx === 44 || by === 33) c = mul(wallDk, 0.8);
        c = mix(c, wallDk, (bayer(x, y) - 0.5) * 0.2 + 0.15);
      }
      if (y >= WALL_Y - 3) c = mul(wallDk, 0.55); // golvlisten
      P.px(x, y, c);
    }
    P.hl(8, 8, FW - 16, mul(wall, 0.6));
    P.hl(8, WALL_Y - 4, FW - 16, mix(wallDk, 0xffffff, 0.25));
    if (plan.lyx) { P.hl(8, WALL_Y - 40, FW - 16, 0xf0d070); P.hl(8, WALL_Y - 39, FW - 16, 0xc8a24a); }

    // ---- dörren ----
    for (let y = 56, y1 = WALL_Y; y < y1; y++) for (let x = DOOR.x0; x < DOOR.x1; x++) {
      let c = mix(0x5a4632, 0x6a5238, hash(x >> 2, y >> 3, 7) * 0.6 + (bayer(x, y) - 0.5) * 0.1);
      if ((y - 56) % 44 < 3 || x === DOOR.x0 + 33 || x === DOOR.x0 + 34) c = mul(c, 0.7);
      P.px(x, y, c);
    }
    P.box(DOOR.x0 - 2, 54, DOOR.x1 - DOOR.x0 + 4, WALL_Y - 54, 0x2e2418);
    P.box(DOOR.x0 - 1, 55, DOOR.x1 - DOOR.x0 + 2, WALL_Y - 55, 0x8a7050);
    P.rect(DOOR.x1 - 12, 108, 4, 8, 0xd8b24a); P.px(DOOR.x1 - 11, 110, 0xfbe7a0);
    // EXIT-skylt + dörrmatta
    P.rect(DOOR.cx - 14, 42, 28, 11, 0x1d2b1f); P.box(DOOR.cx - 14, 42, 28, 11, 0x0e1510);
    text(P, SMALL, visit ? 'HEM' : 'UT', DOOR.cx - (textW(SMALL, visit ? 'HEM' : 'UT') >> 1), 45, 0x6fe08a);
    for (let y = WALL_Y + 2; y < WALL_Y + 18; y++) for (let x = DOOR.cx - 26; x < DOOR.cx + 26; x++) P.px(x, y, (x + y) % 2 ? 0x4a4038 : 0x3e352e);
    P.box(DOOR.cx - 26, WALL_Y + 2, 52, 16, 0x2a2018);
    text(P, SMALL, 'HEJ!', DOOR.cx - (textW(SMALL, 'HEJ!') >> 1), WALL_Y + 8, 0xb9a888);

    // ---- fönster med karm, spröjs och ljus ----
    const sky0 = night ? 0x101838 : 0x8ed0ea, sky1 = night ? 0x1c2140 : 0xbfe6f2;
    for (const [wx0, wx1] of plan.windows) {
      if (wx1 > RIGHT - 10) continue;
      const wy0 = 34, wy1 = 98;
      P.rect(wx0 - 4, wy0 - 4, wx1 - wx0 + 8, wy1 - wy0 + 8, 0xf0ece0);
      P.box(wx0 - 4, wy0 - 4, wx1 - wx0 + 8, wy1 - wy0 + 8, mul(wall, 0.5));
      for (let y = wy0; y < wy1; y++) for (let x = wx0; x < wx1; x++) {
        let c = mix(sky0, sky1, (y - wy0) / (wy1 - wy0) + (bayer(x, y) - 0.5) * 0.08);
        if (!night && hash(x >> 3, y >> 2, 9) > 0.93) c = mix(c, 0xffffff, 0.5); // moln
        if (night && hash(x, y, 10) > 0.985) c = 0xe8ecff;                        // stjärnor
        P.px(x, y, c);
      }
      P.rect(wx0, (wy0 + wy1 >> 1) - 1, wx1 - wx0, 2, 0xf0ece0);
      P.rect((wx0 + wx1 >> 1) - 1, wy0, 2, wy1 - wy0, 0xf0ece0);
      P.hl(wx0 - 4, wy1 + 4, wx1 - wx0 + 8, 0xd8d2c2);
      // ljuskägla på golvet
      if (!night) for (let y = WALL_Y; y < WALL_Y + 60; y++) {
        const s = (y - WALL_Y) * 0.5, fade = 1 - (y - WALL_Y) / 60;
        for (let x = Math.round(wx0 + s); x < wx1 + s; x++) if (bayer(x, y) < fade * 0.85) P.px(x, y, 0xfff6dc, 0.1);
      }
    }

    // ---- tavlor ----
    const arts = [[plan.windows.at(-1)[1] + 30, 0x2aa39a], [DOOR.x1 + 16, 0xb83d7a]];
    for (const [ax, ac] of arts) {
      if (ax + 34 > RIGHT - 12 || plan.windows.some(([a, b]) => ax + 34 > a - 8 && ax < b + 8)) continue;
      P.rect(ax, 52, 34, 26, 0x5a4632); P.box(ax, 52, 34, 26, 0x3a2c1e);
      for (let y = 55; y < 75; y++) for (let x = ax + 3; x < ax + 31; x++) P.px(x, y, mix(ac, mul(ac, 0.5), (bayer(x, y) - 0.5) * 0.5 + (y - 55) / 20));
      P.ell(ax + 12, 62, 6, 4, mix(ac, 0xffffff, 0.5), 0.8, 3);
      P.hl(ax + 1, 53, 32, 0x8a7050);
    }

    // ---- TV på väggen ----
    if (hasTV && tvX && tvX + 90 < RIGHT) {
      P.rect(tvX - 3, 47, 96, 56, 0x17181c); P.box(tvX - 3, 47, 96, 56, 0x3a3d44); P.hl(tvX - 3, 47, 96, 0x6a6f7a);
      for (let y = 50, y1 = 100; y < y1; y++) for (let x = tvX; x < tvX + 90; x++) {
        let c = night ? mix(0x1a5a78, 0x3fc4ff, hash(x >> 4, y >> 3, 12) * 0.7) : mix(0x1c2026, 0x2a3038, (y - 50) / 50);
        if (night && hash(x >> 5, y >> 4, 13) > 0.7) c = mix(c, 0xffffff, 0.25);
        P.px(x, y, c);
      }
      if (!night) { P.line(tvX + 8, 96, tvX + 30, 54, 0x3a444e); P.line(tvX + 9, 96, tvX + 31, 54, 0x323a44); }
      P.px(tvX + 86, 100, night ? 0x45e06a : 0x2a4a34);
      P.rect(tvX + 20, 104, 50, 3, 0x5a4632); P.hl(tvX + 20, 104, 50, 0x8a7050); // hylla under
    }

    // ---- mattan (under möblerna) ----
    if (rug) paintRug(P, rug[0], rug[1], rug[2], rug[3], plan.lyx ? 0x5e1622 : 0x3f5667, plan.lyx ? 0xd8b24a : 0xd9d2c3, plan.lyx ? 'museum' : 'stripe');

    // ---- avdelarväggen (mindre bostäder) + mörkret utanför ----
    if (RIGHT < FW) {
      for (let y = 8; y < FH; y++) for (let x = RIGHT; x < FW; x++) P.px(x, y, mix(0x17131c, 0x221c28, (bayer(x, y) - 0.5) * 0.4 + 0.5));
      for (let y = 8; y < FH; y++) {
        P.px(RIGHT - 6, y, mul(wallDk, 0.5)); P.px(RIGHT - 5, y, mix(wallDk, 0xffffff, 0.15));
        P.px(RIGHT - 4, y, wallDk); P.px(RIGHT - 3, y, wallDk); P.px(RIGHT - 2, y, mul(wallDk, 0.7)); P.px(RIGHT - 1, y, mul(wallDk, 0.4));
      }
      // "GRANNEN"-skylt på avdelaren
      P.rect(RIGHT - 4, 70, 4, 26, mul(wallDk, 0.9));
    }

    // ---- ljuskäglor + AO längs väggen ----
    for (let sx = 120; sx < RIGHT - 40; sx += 170) P.ell(sx, WALL_Y + 46, 44, 20, 0xfff3d0, night ? 0.05 : 0.1, 4);
    for (let y = WALL_Y; y < WALL_Y + 8; y++) for (let x = 0; x < RIGHT; x++) {
      if (x >= DOOR.cx - 26 && x < DOOR.cx + 26) continue;
      if (bayer(x, y) < 1 - (y - WALL_Y) / 8) P.px(x, y, 0x1a1426, 0.18);
    }
    // yttre ram
    P.box(0, 0, FW, FH, 0x0e0d12); P.box(1, 1, FW - 2, FH - 2, 0x1d1a20);
    for (let x = 0; x < FW; x++) for (let y = 0; y < 8; y++) P.px(x, y, 0x14121a);

    cache[key] = P.flush();
    return cache[key];
  };
}

// mattmålaren – från Pixelverkstans floor-scene
function paintRug(P, x0, y0, x1, y1, base, trim, kind) {
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    const bx = Math.min(x - x0, x1 - 1 - x), by = Math.min(y - y0, y1 - 1 - y), b = Math.min(bx, by);
    let c = mul(base, 0.95 + hash(x, y, 11) * 0.08);
    if (b === 0) c = mul(base, 0.6);
    else if (b === 2 || b === 3) c = trim;
    else if (kind === 'museum' && b > 6) {
      const u = Math.abs(((x - x0) % 16) - 8) + Math.abs(((y - y0) % 12) - 6);
      if (u === 5) c = mix(base, trim, 0.45);
      if (u === 0) c = trim;
    } else if (kind === 'stripe' && b > 5 && ((y - y0) >> 2) % 3 === 0) c = mix(base, trim, 0.18);
    if (b === 1 && (x + y) % 2) c = mix(c, 0x000000, 0.2);
    P.px(x, y, c);
  }
}

// ================= möblerna (Pixelverkstans teknik) =================
// klädsel med sömmar – från floor-props
function upholstery(P, x0, y0, w, h, c, seams = []) {
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) {
    let k = mul(c, 0.96 + hash(x, y, 61) * 0.06);
    if (y === y0) k = mix(c, 0xffffff, 0.22);
    if (y === y0 + h - 1) k = mul(c, 0.72);
    if (x === x0) k = mix(k, 0xffffff, 0.1);
    if (x === x0 + w - 1) k = mul(k, 0.8);
    P.px(x, y, k);
  }
  for (const s of seams) { P.vl(s, y0 + 1, h - 2, mul(c, 0.7)); P.vl(s + 1, y0 + 1, h - 2, mix(c, 0xffffff, 0.12)); }
}
const shadow = (P, x, base, w) => P.ell(x + w / 2, base + 1, w / 2 + 2, 4, 0x140c1c, 0.3, 3);
const plate = (P, cx, y, label) => {
  const w = textW(SMALL, label) + 10;
  P.rect(cx - (w >> 1), y, w, 11, 0xd8b85a); P.box(cx - (w >> 1), y, w, 11, 0x8a6a2a);
  P.hl(cx - (w >> 1) + 1, y + 1, w - 2, 0xf6d880);
  text(P, SMALL, label, cx - (textW(SMALL, label) >> 1), y + 3, 0x3a2a10);
};

const MAKERS = {
  // Sängen: hög trägavel, två kuddar, rött påslakan med diskret mönster
  // och en vikt filt vid fotändan – sedd snett framifrån som Pixelverkstans möbler.
  sang(x, base, sign) {
    const w = 96, hb = 82, P = new Pix(w + 8, hb + 10, x - 4, base - hb);
    const frame = 0x8a6446;
    // gaveln (hög, bakom kuddarna)
    for (let y = base - hb; y < base - hb + 26; y++) for (let x2 = x + 2; x2 < x + w - 2; x2++) {
      const grain = Math.sin(x2 * 0.2 + y * 0.4);
      let c = mix(frame, 0x6a4a30, 0.5 + grain * 0.3 + (hash(x2, y, 52) - 0.5) * 0.15);
      if (x2 === x + 2) c = mix(c, 0xffffff, 0.2); if (x2 === x + w - 3) c = mul(c, 0.6);
      P.px(x2, y, c);
    }
    P.hl(x + 2, base - hb, w - 4, 0xc9a36b); P.hl(x + 2, base - hb + 1, w - 4, 0x9a7a50);
    P.hl(x + 2, base - hb + 25, w - 4, 0x4a3020);
    // kuddarna lutade mot gaveln
    for (const kx of [x + 10, x + 52]) {
      P.rect(kx, base - hb + 12, 34, 14, 0xf7f4ec);
      P.hl(kx, base - hb + 12, 34, 0xffffff); P.hl(kx + 1, base - hb + 25, 33, 0xc8c2b4);
      P.vl(kx + 33, base - hb + 13, 13, 0xbcb8ac);
      P.px(kx + 7, base - hb + 18, 0xdcd6ca); P.px(kx + 22, base - hb + 16, 0xdcd6ca); P.px(kx + 15, base - hb + 21, 0xdcd6ca);
    }
    // påslakanet: varmrött med diskret rutmönster, ljus vikkant upptill
    const q0 = base - hb + 28;
    for (let y = q0; y < base - 8; y++) for (let x2 = x + 2; x2 < x + w - 2; x2++) {
      const t = (y - q0) / (base - 8 - q0);
      let c = mix(0xa83a42, 0x8a2a32, t + (hash(x2, y, 53) - 0.5) * 0.1);
      if ((x2 + y) % 12 === 0 || (x2 - y) % 12 === 0) c = mix(c, 0xd8b24a, 0.14); // diskret ruta
      if (x2 === x + 2) c = mix(c, 0xffffff, 0.18); if (x2 === x + w - 3) c = mul(c, 0.72);
      P.px(x2, y, c);
    }
    P.hl(x + 2, q0, w - 4, 0xf0ece0); P.hl(x + 2, q0 + 1, w - 4, 0xd8d2c2); P.hl(x + 2, q0 + 2, w - 4, 0xc06a70);
    // vikt filt vid fotändan
    upholstery(P, x + 2, base - 20, w - 4, 8, 0x2f6f7a);
    P.hl(x + 2, base - 13, w - 4, 0x1d4f5a);
    // sockel + ben
    P.rect(x + 1, base - 8, w - 2, 5, 0x5a3d2b); P.hl(x + 1, base - 8, w - 2, 0x7a5a3e);
    P.rect(x + 4, base - 3, 5, 3, 0x2a2018); P.rect(x + w - 9, base - 3, 5, 3, 0x2a2018);
    shadow(P, x, base, w);
    if (sign) plate(P, x + w - 22, base - hb + 30, 'SÄNG');
    return { img: P.flush(), x: x - 4, y: base - hb, sort: base, solid: [x - 2, base - 50, x + w + 2, base + 2] };
  },

  // Garderoben: hög ekgarderob med spegeldörr, lister och mässingsknoppar
  garderob(x, base, sign) {
    const w = 64, hb = 118, P = new Pix(w + 8, hb + 24, x - 4, base - hb - 16);
    for (let y = base - hb; y < base; y++) for (let x2 = x; x2 < x + w; x2++) {
      const grain = Math.sin(x2 * 0.18 + Math.sin(y * 0.9 + x2 * 0.05) * 2.2 + y * 0.35);
      let c = mix(0x5a3a26, 0x7a5236, 0.5 + grain * 0.35 + (hash(x2, y, 22) - 0.5) * 0.2);
      if (x2 === x) c = mix(c, 0xffffff, 0.25); if (x2 === x + w - 1) c = mul(c, 0.55);
      P.px(x2, y, c);
    }
    P.hl(x, base - hb, w, 0xc9a36b); P.hl(x, base - hb + 1, w, 0x9a7a50); P.hl(x, base - hb + 6, w, 0x3a2618);
    P.hl(x, base - 6, w, 0x3a2618); P.rect(x + 2, base - 4, w - 4, 4, 0x1b1a1f);
    // dörrspegel (vänster) och spegeldörr (höger)
    P.box(x + 4, base - hb + 10, 26, hb - 20, 0x3a2618); P.hl(x + 5, base - hb + 11, 24, 0x9a7a50);
    for (let y = base - hb + 12; y < base - 12; y++) for (let x2 = x + 34; x2 < x + 58; x2++) {
      const s = (x2 + y) % 26;
      P.px(x2, y, mix(0x9fc8d8, 0x6f98a8, (y - base + hb) / hb + (s < 3 ? -0.3 : 0)));
    }
    P.box(x + 33, base - hb + 11, 26, hb - 22, 0x3a2618);
    P.px(x + 29, base - 62, 0xd8b24a); P.px(x + 29, base - 61, 0xf6d880);
    P.px(x + 61, base - 62, 0xd8b24a);
    shadow(P, x, base, w);
    if (sign) plate(P, x + (w >> 1), base - hb - 14, 'GARDEROB');
    return { img: P.flush(), x: x - 4, y: base - hb - 16, sort: base, solid: [x - 2, base - 26, x + w + 2, base + 2] };
  },

  // Kylskåpet: tvådörrars med krom, magneter och teckning
  kylskap(x, base, sign) {
    const w = 52, hb = 104, P = new Pix(w + 8, hb + 24, x - 4, base - hb - 16);
    for (let y = base - hb; y < base; y++) for (let x2 = x; x2 < x + w; x2++) {
      let c = mix(0xe8e4dc, 0xc8c4bc, (x2 - x) / w + (bayer(x2, y) - 0.5) * 0.06);
      if (x2 === x) c = 0xffffff; if (x2 === x + w - 1) c = 0x8a857c;
      P.px(x2, y, c);
    }
    P.hl(x, base - hb, w, 0xffffff); P.hl(x, base - hb + 1, w, 0xd8d4cc);
    P.hl(x, base - 66, w, 0x9a958c); P.hl(x, base - 65, w, 0xf4f1ea);       // frysdörrens skarv
    P.rect(x + w - 8, base - 96, 3, 22, 0x8a857c); P.rect(x + w - 8, base - 58, 3, 34, 0x8a857c); // handtag
    P.vl(x + w - 8, base - 96, 22, 0xb5b0a6); P.vl(x + w - 8, base - 58, 34, 0xb5b0a6);
    // magneter + barnteckning
    P.rect(x + 8, base - 88, 5, 5, 0xc9323a); P.rect(x + 20, base - 82, 5, 5, 0x3a7bd5); P.rect(x + 14, base - 92, 4, 4, 0x45b964);
    P.rect(x + 8, base - 50, 16, 20, 0xfffdf4); P.box(x + 8, base - 50, 16, 20, 0xd8d2c6);
    P.px(x + 12, base - 44, 0xe8b230); P.px(x + 13, base - 44, 0xe8b230); P.px(x + 12, base - 43, 0xe8b230);
    P.line(x + 10, base - 34, x + 20, base - 34, 0x5a8a4a); P.px(x + 15, base - 38, 0xc9323a);
    P.rect(x + 2, base - 3, w - 4, 3, 0x1b1a1f);
    shadow(P, x, base, w);
    if (sign) plate(P, x + (w >> 1), base - hb - 14, 'KYLSKÅP');
    return { img: P.flush(), x: x - 4, y: base - hb - 16, sort: base, solid: [x - 2, base - 24, x + w + 2, base + 2] };
  },

  // Soffan – Pixelverkstans väntrumssoffa med kudde
  soffa(x, base) {
    const w = 104, P = new Pix(w + 6, 52, x - 2, base - 48);
    const c = 0x2f6f7a, cush = 0x3b8894;
    const inner0 = x + 10, inner1 = x + w - 10, third = (inner1 - inner0) / 3;
    const seams = [Math.round(inner0 + third), Math.round(inner0 + 2 * third)];
    upholstery(P, x + 2, base - 42, w - 4, 24, c, seams);
    upholstery(P, inner0, base - 19, inner1 - inner0, 9, cush, seams);
    upholstery(P, inner0, base - 10, inner1 - inner0, 6, mul(cush, 0.8), seams);
    for (const ax of [x, x + w - 8]) { upholstery(P, ax, base - 27, 8, 23, mul(c, 0.92)); P.hl(ax, base - 27, 8, mix(c, 0xffffff, 0.3)); }
    P.rect(x + 1, base - 4, w - 2, 2, mul(c, 0.55));
    for (const lx of [x + 3, x + w - 5]) P.rect(lx, base - 2, 2, 2, 0x2a2018);
    P.rect(inner0 + 3, base - 33, 12, 10, 0xe8b230); P.hl(inner0 + 3, base - 33, 12, 0xf6d880); P.vl(inner0 + 14, base - 32, 9, 0xb8861b);
    shadow(P, x, base, w);
    return { img: P.flush(), x: x - 2, y: base - 48, sort: base, solid: [x, base - 22, x + w, base + 2] };
  },

  // Fåtöljen
  fatolj(x, base) {
    const w = 52, P = new Pix(w + 6, 48, x - 2, base - 44);
    const c = 0xb8452e, cush = 0xcf5a3f;
    upholstery(P, x + 2, base - 40, w - 4, 22, c);
    upholstery(P, x + 7, base - 19, w - 14, 9, cush);
    upholstery(P, x + 7, base - 10, w - 14, 6, mul(cush, 0.8));
    for (const ax of [x, x + w - 7]) upholstery(P, ax, base - 26, 7, 22, mul(c, 0.9));
    P.rect(x + 1, base - 4, w - 2, 2, mul(c, 0.55));
    for (const lx of [x + 3, x + w - 5]) P.rect(lx, base - 2, 2, 2, 0x2a2018);
    shadow(P, x, base, w);
    return { img: P.flush(), x: x - 2, y: base - 44, sort: base, solid: [x, base - 20, x + w, base + 2] };
  },

  // Soffbordet med tidningar, kaffekopp och kaktus
  bord(x, base) {
    const w = 84, P = new Pix(w + 6, 34, x - 2, base - 30);
    for (let y = base - 16; y < base - 8; y++) for (let x2 = x; x2 < x + w; x2++) P.px(x2, y, mix(0xd9b98a, 0xc4a276, (y - base + 16) / 8 + (hash(x2, y, 71) - 0.5) * 0.12));
    P.hl(x, base - 16, w, 0xecd3a8); P.rect(x, base - 8, w, 3, 0x8a6446); P.hl(x, base - 8, w, 0xb08a58);
    for (const lx of [x + 2, x + w - 4]) P.rect(lx, base - 5, 2, 5, 0x5a3d2b);
    P.rect(x + 5, base - 15, 14, 9, 0xf4f1ea); P.rect(x + 6, base - 14, 12, 3, 0x2c6fb7); P.hl(x + 6, base - 10, 10, 0x9a9ea6);
    P.rect(x + w - 16, base - 16, 6, 5, 0xffffff); P.px(x + w - 10, base - 15, 0xffffff); P.hl(x + w - 15, base - 16, 4, 0x6b4226);
    P.rect(x + w - 7, base - 14, 5, 4, 0xb5652f); P.rect(x + w - 6, base - 20, 3, 6, 0x4a9a58); P.px(x + w - 5, base - 21, 0xe23b5a);
    shadow(P, x, base, w);
    return { img: P.flush(), x: x - 2, y: base - 30, sort: base, solid: [x, base - 14, x + w, base + 2] };
  },

  // Monsteran – Pixelverkstans makePlant
  vaxt(x, base) {
    const P = new Pix(40, 54, x - 20, base - 52);
    const cx = x;
    P.rect(cx - 7, base - 12, 14, 12, 0xe8e4da); P.hl(cx - 8, base - 13, 16, 0xffffff); P.hl(cx - 8, base - 12, 16, 0xcfc8b8);
    P.vl(cx + 5, base - 11, 11, 0xbdb5a5); P.vl(cx + 6, base - 11, 11, 0xa9a192); P.hl(cx - 6, base - 1, 12, 0x9a9282);
    P.rect(cx - 6, base - 12, 12, 1, 0x3a2a1c);
    const leaves = [[-10, -30, 9, 6], [2, -38, 8, 7], [-4, -44, 7, 6], [6, -26, 9, 6], [-12, -20, 8, 5], [8, -16, 7, 5], [-2, -24, 8, 6]];
    for (const [dx, dy, rx, ry] of leaves) {
      for (let yy = -ry; yy <= ry; yy++) for (let xx = -rx; xx <= rx; xx++) {
        const dd = Math.hypot(xx / rx, yy / ry);
        if (dd >= 1) continue;
        let c = dd < 0.5 && xx + yy < 0 ? 0x5fbf6e : 0x2f8f46;
        if (dd > 0.8) c = 0x216b36;
        if (xx === 0 || (Math.abs(xx - yy) === 0 && dd < 0.7)) c = 0x7fd48a;
        P.px(cx + dx + xx, base + dy + yy, c);
      }
      P.line(cx, base - 12, cx + dx, base + dy + ry, 0x2c6e3a);
    }
    P.ell(cx, base + 1, 10, 3, 0x140c1c, 0.3, 3);
    return { img: P.flush(), x: x - 20, y: base - 52, sort: base, solid: [x - 9, base - 12, x + 9, base + 2] };
  },
};

function nameTag(ctx, x, y, av) {
  const c = avatarTagColors(av);
  const w = textW(SMALL, av.name || '?') + 8;
  ctx.fillStyle = c.bg; ctx.fillRect(x - w / 2 | 0, y | 0, w, 10);
  ctxText(ctx, SMALL, av.name || '?', (x - w / 2 | 0) + 4, (y | 0) + 2, c.fg);
}

// Pratbubbla med en emoji (k = skala)
export function emoteBubble(ctx, x, y, e, k = 1) {
  ctx.fillStyle = '#17151a'; ctx.fillRect(x - 9 * k | 0, y - 15 * k, 18 * k, 16 * k);
  ctx.fillStyle = '#f4f1ea'; ctx.fillRect(x - 8 * k | 0, y - 14 * k, 16 * k, 14 * k);
  ctx.fillStyle = '#f4f1ea'; ctx.fillRect(x - k | 0, y, 3 * k, 3 * k);
  ctx.font = `${10 * k}px "Segoe UI Emoji", sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(e, x, y - 7 * k);
  ctx.textAlign = 'start'; ctx.textBaseline = 'alphabetic';
}

// Kylskåpet: ät något du köpt. Att äta tar en kvart.
function openFridge(A) {
  const g = A.game;
  const items = Object.entries(g.fridge).filter(([, n]) => n > 0);
  const body = items.length
    ? `<p style="font-size:19px;margin-top:0">Mätthet: <b>${Math.round(g.hunger)}/100</b></p><div class="plist">${items.map(([id, n]) => {
      const f = foodOf(id);
      return `<div class="prow"><span style="font-size:28px;text-align:center">${f.icon}</span>
        <span class="nm">${f.name} ×${n}<br><small class="sp">+${f.fill} mätthet</small></span>
        <button class="btn btn-small btn-go" data-eat="${id}">Ät</button></div>`;
    }).join('')}</div>`
    : `<p style="font-size:20px">Kylskåpet är tomt! 🕸️<br><small>Gå till MAT-butiken i Pixelstaden och handla.</small></p>`;
  const dlg = openModal('🧊 Kylskåpet', body, [{ label: 'Stäng', onClick: closeModal }]);
  dlg.querySelectorAll('[data-eat]').forEach((b) => (b.onclick = () => {
    const f = foodOf(b.dataset.eat);
    if (A.game.eatFromFridge(b.dataset.eat)) { play('ok'); toast(`${f.icon} Mums! +${f.fill} mätthet`, 'good'); openFridge(A); }
  }));
}
