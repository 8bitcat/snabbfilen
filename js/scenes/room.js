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

// Möbelsprites: köpta EmanuelleDev-ark (Palssons Gård), inbakade i en egen
// atlas med bara det spelet använder (licenskravet). Ritas i 2×.
const ATLAS = typeof Image !== 'undefined' ? new Image() : null;
if (ATLAS) ATLAS.src = 'assets/interior.png';
const FRAMES = {
  sang: [2, 2, 33, 34], garderob: [37, 2, 35, 38], kylskap: [74, 2, 16, 48],
  soffa: [92, 2, 29, 20], fatolj: [123, 2, 17, 20], tv: [142, 2, 48, 23],
  bord: [192, 2, 22, 20], bokhylla: [216, 2, 34, 35], spis: [252, 2, 28, 42], lampa: [282, 2, 14, 30],
};

// Planer per bostad: hur mycket av lokalen man har (partition), tema och möbler.
// Möbler: x = vänsterkant, base = fotlinje (y-sortering). Skyltar ritas på möbeln.
const PLANS = {
  rum: {
    partition: 450, wall: 0x8c7a62, wallDk: 0x6a5c48, floorA: 0xcbb894, floorB: 0xb09a74,
    windows: [[160, 240]],
    furniture: [
      { id: 'sang', x: 36, base: 262 },
      { id: 'garderob', x: 280, base: 188 },
      { id: 'kylskap', x: 380, base: 184 },
    ],
    extra: {
      soffa: { x: 200, base: 352 }, bord: { x: 320, base: 386 }, vaxt: { x: 424, base: 230 },
      tv: { x: 160, base: 320 }, matta: [150, 300, 430, 408],
      bokhylla: { x: 165, base: 190 }, lampa: { x: 415, base: 330 }, spis: { x: 36, base: 330 },
    },
  },
  lagenhet: {
    partition: 620, wall: 0x6e88a0, wallDk: 0x4e6478, floorA: 0xd9cbaf, floorB: 0xc0ac88,
    windows: [[160, 240], [270, 350]],
    furniture: [
      { id: 'sang', x: 36, base: 262 },
      { id: 'garderob', x: 392, base: 188 },
      { id: 'kylskap', x: 500, base: 184 },
      { id: 'soffa', x: 210, base: 356 },
      { id: 'bord', x: 300, base: 390 },
      { id: 'vaxt', x: 586, base: 230 },
    ],
    extra: {
      tv: { x: 360, base: 320 }, matta: [180, 306, 520, 414], fatolj: { x: 460, base: 346 },
      bokhylla: { x: 165, base: 320 }, lampa: { x: 560, base: 330 }, spis: { x: 545, base: 300 },
    },
  },
  villa: {
    partition: 0, wall: 0xc4b190, wallDk: 0x9a8a6a, floorA: 0xefe6d2, floorB: 0xd9ccb2,
    windows: [[160, 240], [268, 344], [614, 694]],
    furniture: [
      { id: 'sang', x: 36, base: 262 },
      { id: 'garderob', x: 460, base: 188 },
      { id: 'kylskap', x: 552, base: 184 },
      { id: 'tv', x: 352, base: 300 },
      { id: 'soffa', x: 224, base: 362 },
      { id: 'fatolj', x: 320, base: 330 },
      { id: 'bord', x: 300, base: 398 },
      { id: 'bokhylla', x: 360, base: 190 },
      { id: 'spis', x: 686, base: 260 },
      { id: 'lampa', x: 648, base: 300 },
      { id: 'vaxt', x: 706, base: 420 },
      { id: 'vaxt2', x: 136, base: 300 },
      { id: 'matta', rect: [190, 312, 560, 424] },
    ],
    lyx: true,
  },
};
// Köpta möbler dyker upp i mindre bostäder på extraplatserna
const BUYABLE = ['soffa', 'vaxt', 'tv', 'matta', 'bokhylla', 'lampa', 'spis'];

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
    else items.push({ id, ...ex });
  }

  // ---------- möblerna: sprites ur atlasen + Pix-monsteran ----------
  const props = [];
  for (const f of items) {
    if (f.id === 'matta') continue;
    const kind = f.id.replace(/\d+$/, '');
    if (kind === 'vaxt') { const p = makePlantProp(f.x, f.base); props.push({ ...p, id: f.id }); continue; }
    if (!FRAMES[kind]) continue;
    props.push(spriteProp(f.id, kind, f.x, f.base, !visit));
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
    ...props.filter((p) => p.solid && acts[p.id] !== undefined).map((p) => ({ id: p.id, r: [p.solid[0], p.top, p.solid[2], p.solid[3] + 4], go: [(p.solid[0] + p.solid[2]) / 2, p.solid[3] + 10] })),
  ];

  const bg = buildBg(plan, homeId(), RIGHT, rug, visit);

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
      const drawables = props.map((p) => ({ fy: p.sort, draw: () => p.draw(ctx) }));
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
function buildBg(plan, homeId, RIGHT, rug, visit) {
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

// ================= möblerna: sprites ur atlasen (2×) =================
function spriteProp(id, kind, x, base, sign) {
  const [fx, fy, fw, fh] = FRAMES[kind];
  const w = fw * 2, h = fh * 2;
  const top = base - h;
  const solidH = kind === 'bord' || kind === 'soffa' || kind === 'fatolj' ? Math.round(h * 0.5) : Math.min(26, Math.round(h * 0.4));
  const label = { sang: 'SÄNG', garderob: 'GARDEROB', kylskap: 'KYLSKÅP' }[kind];
  return {
    id, sort: base, top,
    solid: [x - 2, base - solidH, x + w + 2, base + 2],
    draw(ctx) {
      // mjuk kontaktskugga
      ctx.fillStyle = 'rgba(20,12,28,0.22)';
      ctx.fillRect(x + 2, base - 2, w - 4, 3);
      ctx.fillRect(x + 5, base + 1, w - 10, 2);
      if (ATLAS && ATLAS.complete) ctx.drawImage(ATLAS, fx, fy, fw, fh, x, top, w, h);
      if (sign && label) ctxPlate(ctx, x + w / 2, top - 15, label);
    },
  };
}
// mässingsskylten (ctx-variant av Pixelverkstans plate)
function ctxPlate(ctx, cx, y, label) {
  const w = textW(SMALL, label) + 10;
  ctx.fillStyle = '#8a6a2a'; ctx.fillRect(cx - w / 2 - 1 | 0, y - 1, w + 2, 13);
  ctx.fillStyle = '#d8b85a'; ctx.fillRect(cx - w / 2 | 0, y, w, 11);
  ctx.fillStyle = '#f6d880'; ctx.fillRect(cx - w / 2 + 1 | 0, y + 1, w - 2, 1);
  ctxText(ctx, SMALL, label, (cx - textW(SMALL, label) / 2) | 0, y + 3, '#3a2a10');
}

// Monsteran från Pixelverkstans floor-props (Pix-ritad – passar in mellan spritsen)
function makePlantProp(x, base) {
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
  const img = P.flush();
  const ox = x - 20, oy = base - 52;
  return { img, sort: base, top: oy, solid: [x - 9, base - 12, x + 9, base + 2], draw: (ctx) => ctx.drawImage(img, ox, oy) };
}

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
