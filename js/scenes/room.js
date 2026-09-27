// Hemma – i Habbo-stil men i hög upplösning (768×432): ett isometriskt
// rutnätsgolv med 48×24-plattor man går runt på, väggar med tapet, tavlor och
// fönster, möbler som iso-boxar på rutorna och figurer som y-sorteras mot
// möblerna. Klicka på golvet så går figuren dit (BFS på rutnätet), klicka på
// en möbel så går den fram och använder den. Samma scen ritar besök hemma hos
// en kompis (A.visitTarget) – då är bara dörren aktiv.
// Större bostad = större rum: 6×6 → 8×7 → 10×8 rutor.
import { drawPerson } from '../core/people.js';
import { openAvatarEditor, avatarTagColors } from '../core/avatar.js';
import { SMALL, ctxText, textW, mix, css, hash } from '../core/floor-pix.js';
import { openModal, closeModal, toast } from '../core/ui.js';
import { foodOf } from '../game.js';
import { play } from '../core/sound.js';
import { worldFolksHere, worldMyEmote } from '../net/world.js';

const WALK_SEQ = [1, 3, 2, 3];
const TW = 24, TH = 12;   // halva plattbredden/-höjden (platta = 48×24)
const WALL_H = 72;

// Planer per bostad: rutnätets storlek, färger och var möblerna står.
const PLANS = {
  rum: {
    W: 6, D: 6, wall: 0x8c8270, wall2: 0x6e675a, floorA: 0x9a7a50, floorB: 0x8a6c46,
    items: [
      { id: 'sang', tx: 0, ty: 2, w: 1, d: 2, h: 14 },
      { id: 'garderob', tx: 2, ty: 0, w: 1, d: 1, h: 52 },
      { id: 'kylskap', tx: 4, ty: 0, w: 1, d: 1, h: 44 },
    ],
  },
  lagenhet: {
    W: 8, D: 7, wall: 0x7a94a8, wall2: 0x5e7488, floorA: 0xb08a58, floorB: 0x9e7a4c,
    items: [
      { id: 'sang', tx: 0, ty: 2, w: 1, d: 2, h: 14 },
      { id: 'garderob', tx: 2, ty: 0, w: 1, d: 1, h: 52 },
      { id: 'kylskap', tx: 6, ty: 0, w: 1, d: 1, h: 44 },
      { id: 'soffa', tx: 4, ty: 4, w: 2, d: 1, h: 14 },
      { id: 'vaxt', tx: 7, ty: 0, w: 1, d: 1, h: 12 },
    ],
  },
  villa: {
    W: 10, D: 8, wall: 0xc0b090, wall2: 0xa08e6e, floorA: 0x8a6a42, floorB: 0x7a5c38,
    items: [
      { id: 'sang', tx: 0, ty: 2, w: 1, d: 2, h: 14 },
      { id: 'garderob', tx: 2, ty: 0, w: 1, d: 1, h: 52 },
      { id: 'kylskap', tx: 8, ty: 0, w: 1, d: 1, h: 44 },
      { id: 'soffa', tx: 6, ty: 4, w: 2, d: 1, h: 14 },
      { id: 'vaxt', tx: 9, ty: 0, w: 1, d: 1, h: 12 },
      { id: 'tv', wallNV: 3 },
      { id: 'matta', tx: 3, ty: 3, w: 2, d: 2, flat: true },
    ],
  },
};
// Köpta möbler dyker upp även i mindre bostäder
const EXTRA = {
  soffa: { rum: { tx: 3, ty: 4, w: 2, d: 1, h: 14 }, lagenhet: null },
  vaxt: { rum: { tx: 5, ty: 0, w: 1, d: 1, h: 12 }, lagenhet: null },
  tv: { rum: { wallNV: 4 }, lagenhet: { wallNV: 5 } },
  matta: { rum: { tx: 2, ty: 3, w: 2, d: 2, flat: true }, lagenhet: { tx: 3, ty: 3, w: 2, d: 2, flat: true } },
};
const LABELS = { sang: 'SÄNG', garderob: 'GARDEROB', kylskap: 'KYLSKÅP' };

export function makeRoom(A, { visit = false } = {}) {
  const g = A.game;
  const homeId = () => (visit ? A.visitTarget?.home || 'rum' : g.home);
  const furn = () => (visit ? A.visitTarget?.furniture || [] : g.furniture);

  // ---------- bygg planen ----------
  const plan = PLANS[homeId()] || PLANS.rum;
  const { W, D } = plan;
  const OX = 384 + (D - W) * TH;
  const OY = Math.round((432 - (W + D) * TH) / 2) + 24;
  const placed = [...plan.items];
  for (const [id, spots] of Object.entries(EXTRA)) {
    if (!furn().includes(id)) continue;
    if (placed.some((it) => it.id === id)) continue;
    const spot = spots[homeId()];
    if (spot) placed.push({ id, ...spot });
  }
  const dorr = { id: 'dorr', tx: 0, ty: D - 1 };

  // gångbara rutor
  const blocked = new Set();
  for (const it of placed) {
    if (it.flat || it.wallNV !== undefined) continue;
    for (let a = 0; a < (it.w || 1); a++) for (let b = 0; b < (it.d || 1); b++) blocked.add(`${it.tx + a},${it.ty + b}`);
  }
  const free = (tx, ty) => tx >= 0 && ty >= 0 && tx < W && ty < D && !blocked.has(`${tx},${ty}`);

  const isoX = (tx, ty) => OX + (tx - ty) * TW;
  const isoY = (tx, ty) => OY + (tx + ty) * TH;
  const tileAt = (x, y) => {
    const fx = ((x - OX) / TW + (y - OY) / TH) / 2, fy = ((y - OY) / TH - (x - OX) / TW) / 2;
    return [Math.floor(fx), Math.floor(fy)];
  };

  // ---------- figuren ----------
  let ptx = visit ? Math.min(1, W - 1) : 2, pty = D - 2;
  if (!free(ptx, pty)) [ptx, pty] = nearestFreeTile(ptx, pty);
  let px = isoX(ptx, pty), py = isoY(ptx, pty) + TH;
  let path = [], onArrive = null, dir = 'down', t = 0;

  function nearestFreeTile(tx, ty) {
    for (let r = 0; r < 8; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++)
      if (free(tx + dx, ty + dy)) return [tx + dx, ty + dy];
    return [0, 0];
  }
  function findPath(stx, sty, ttx, tty) {
    if (!free(ttx, tty)) [ttx, tty] = nearestFreeTile(ttx, tty);
    const key = (a, b) => a + b * W;
    const from = new Map([[key(stx, sty), null]]);
    const q = [[stx, sty]];
    while (q.length) {
      const [cx, cy] = q.shift();
      if (cx === ttx && cy === tty) break;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        const nx = cx + dx, ny = cy + dy;
        if (!free(nx, ny) || from.has(key(nx, ny))) continue;
        if (dx && dy && (!free(cx + dx, cy) || !free(cx, cy + dy))) continue;
        from.set(key(nx, ny), [cx, cy]);
        q.push([nx, ny]);
      }
    }
    if (!from.has(key(ttx, tty))) return [];
    const out = [];
    let cur = [ttx, tty];
    while (cur && !(cur[0] === stx && cur[1] === sty)) { out.push(cur); cur = from.get(key(cur[0], cur[1])); }
    return out.reverse();
  }
  function walkToTile(ttx, tty, cb) {
    path = findPath(ptx, pty, ttx, tty);
    onArrive = cb || null;
    if (!path.length) { const done = onArrive; onArrive = null; done?.(); }
  }
  function approach(it, cb) {
    let best = null, bd = 1e9;
    for (let a = -1; a <= (it.w || 1); a++) for (let b = -1; b <= (it.d || 1); b++) {
      const tx = it.tx + a, ty = it.ty + b;
      if (!free(tx, ty)) continue;
      const d = Math.abs(tx - ptx) + Math.abs(ty - pty);
      if (d < bd) { bd = d; best = [tx, ty]; }
    }
    if (best) walkToTile(best[0], best[1], cb);
  }

  const acts = {
    dorr: visit
      ? () => { A.visitTarget = null; g.passTime(20); g.save(); play('door'); toast('🚗 Hemma igen.'); A.go('city'); }
      : () => { play('door'); A.go('city'); },
    sang: visit ? null : () => A.sleepFlow(),
    garderob: visit ? null : () => { play('click'); openAvatarEditor({ onDone: (av) => { A.avatar = av; toast('👕 Snyggt!', 'good'); } }); },
    kylskap: visit ? null : () => openFridge(A),
  };

  return {
    get worldX() { return px; },
    get worldY() { return py; },
    _debug: {
      spot: (id) => { const it = id === 'dorr' ? dorr : placed.find((i) => i.id === id); return it ? { x: isoX(it.tx, it.ty), y: isoY(it.tx, it.ty) + TH } : null; },
      tile: (tx, ty) => ({ x: isoX(tx, ty), y: isoY(tx, ty) + TH }),
    },

    update(dt) {
      t += dt;
      if (path.length) {
        const [ttx, tty] = path[0];
        const gx = isoX(ttx, tty), gy = isoY(ttx, tty) + TH;
        const dx = gx - px, dy = gy - py, dist = Math.hypot(dx, dy), step = 116 * dt;
        dir = ttx > ptx ? 'right' : ttx < ptx ? 'left' : tty > pty ? 'down' : 'up';
        if (dist <= step) {
          px = gx; py = gy; ptx = ttx; pty = tty;
          path.shift();
          if (!path.length) { dir = 'down'; const cb = onArrive; onArrive = null; cb?.(); }
        } else { px += dx / dist * step; py += dy / dist * step; }
      }
      if (visit && !A.visitTarget) A.go('city');
    },

    down(x, y) {
      const hit = [...placed, dorr].sort((a, b) => (b.tx + b.ty) - (a.tx + a.ty)).find((it) => {
        if (it.wallNV !== undefined || it.flat) return false;
        const w = it.w || 1, d = it.d || 1;
        const x0 = isoX(it.tx, it.ty + d - 1) - TW, x1 = isoX(it.tx + w - 1, it.ty) + TW;
        const y0 = isoY(it.tx, it.ty) - (it.h || 0), y1 = isoY(it.tx + w - 1, it.ty + d - 1) + TH * 2;
        return x >= x0 && x <= x1 && y >= y0 && y <= y1;
      });
      if (hit && (acts[hit.id] || hit.id === 'dorr')) { approach(hit, acts[hit.id] || undefined); return; }
      const [tx, ty] = tileAt(x, y);
      if (tx >= 0 && ty >= 0 && tx < W && ty < D) walkToTile(tx, ty);
    },

    draw(ctx) {
      const { W: CW, H: CH } = A;
      const hour = g.min / 60, night = hour >= 19.5 || hour < 6.5;
      // bakgrund: mjuk mörk gradient med svaga prickar – rummet svävar som en diorama
      for (let y = 0; y < CH; y += 8) {
        ctx.fillStyle = css(mix(0x1c1824, 0x2b2436, y / CH));
        ctx.fillRect(0, y, CW, 8);
      }
      ctx.fillStyle = 'rgba(180,170,220,0.10)';
      for (let i = 0; i < 60; i++) ctx.fillRect((hash(i, 61) * CW) | 0, (hash(i, 62) * CH) | 0, 2, 2);

      drawWalls(ctx, plan, W, D, OX, OY, night, furn(), homeId(), dorr);

      // trägolv med plankådring
      for (let ty = 0; ty < D; ty++) for (let tx = 0; tx < W; tx++) {
        const seed = hash(tx * 7, ty * 13);
        const c = mix(plan.floorA, plan.floorB, (ty % 2) * 0.5 + seed * 0.4);
        woodTile(ctx, isoX(tx, ty), isoY(tx, ty), c, tx, ty);
      }
      // golvets platåkant
      ctx.fillStyle = css(mix(plan.floorB, 0x000000, 0.55));
      for (let tx = 0; tx < W; tx++) { const cx = isoX(tx, D - 1), sy = isoY(tx, D - 1); for (let i = 0; i < 24; i++) ctx.fillRect(cx - 24 + i, (sy + 12 + i / 2) | 0, 1, 10); }
      ctx.fillStyle = css(mix(plan.floorB, 0x000000, 0.7));
      for (let ty = 0; ty < D; ty++) { const cx = isoX(W - 1, ty), sy = isoY(W - 1, ty); for (let i = 0; i < 24; i++) ctx.fillRect(cx + i, (sy + 24 - i / 2) | 0, 1, 10); }
      // väggskugga på golvet
      ctx.fillStyle = 'rgba(20,14,32,0.16)';
      for (let tx = 0; tx < W; tx++) halfTile(ctx, isoX(tx, 0), isoY(tx, 0), 'nv');
      for (let ty = 0; ty < D; ty++) if (ty !== dorr.ty) halfTile(ctx, isoX(0, ty), isoY(0, ty), 'no');
      // dörrmattan
      isoTile(ctx, isoX(dorr.tx, dorr.ty), isoY(dorr.tx, dorr.ty), '#c9b27a', '#8a7a50');
      ctx.fillStyle = '#a8905a'; ctx.fillRect(isoX(dorr.tx, dorr.ty) - 12, isoY(dorr.tx, dorr.ty) + 11, 24, 2);

      // taklampan
      const lampX = isoX((W / 2) | 0, (D / 2) | 0), lampTop = OY - WALL_H - 8;
      const lampY = lampTop + 30;
      if (night) {
        ctx.fillStyle = 'rgba(255,214,120,0.10)';
        for (let r = 0; r < 3; r++) fullTileGlow(ctx, lampX, isoY((W / 2) | 0, (D / 2) | 0) - 12 + r * 8);
      }
      ctx.fillStyle = '#3a3440'; ctx.fillRect(lampX, lampTop, 2, 24);
      ctx.fillStyle = '#c9323a';
      ctx.fillRect(lampX - 10, lampY - 6, 22, 4); ctx.fillRect(lampX - 6, lampY - 10, 14, 4); ctx.fillRect(lampX - 2, lampY - 14, 6, 4);
      ctx.fillStyle = css(mix(0xc9323a, 0xffffff, 0.25)); ctx.fillRect(lampX - 8, lampY - 6, 3, 4);
      ctx.fillStyle = night ? '#ffd97a' : '#8a8478'; ctx.fillRect(lampX - 4, lampY - 2, 10, 3);

      // platta saker (mattan)
      for (const it of placed) if (it.flat) drawFurniture(ctx, it, isoX(it.tx, it.ty), isoY(it.tx, it.ty));

      // y-sorterat: möbler + jag + kompisar (figurer ritas i 2× skala)
      const folks = worldFolksHere(A);
      const drawables = [];
      for (const it of placed) {
        if (it.flat || it.wallNV !== undefined) continue;
        const fy = isoY(it.tx + (it.w || 1) - 1, it.ty + (it.d || 1) - 1) + TH * 2;
        drawables.push({ fy, draw: () => drawFurniture(ctx, it, isoX(it.tx, it.ty), isoY(it.tx, it.ty)) });
      }
      const mine = worldMyEmote();
      drawables.push({ fy: py, draw: () => {
        const frame = path.length ? WALK_SEQ[Math.floor(t * 8.5) % 4] : (Math.sin(t * 2) > 0.9 ? 4 : 0);
        person2x(ctx, px, py, A.avatar.look, dir, frame);
        if (folks.length) nameTag(ctx, px, py - 96, A.avatar);
        if (mine) emoteBubble(ctx, px, py - 116, mine, 2);
      } });
      for (const f of folks) {
        drawables.push({ fy: f.y, draw: () => {
          person2x(ctx, f.x, f.y, f.av.look, 'down', f.walking ? WALK_SEQ[Math.floor(t * 8.5) % 4] : (Math.sin(t * 2 + f.x) > 0.9 ? 4 : 0));
          nameTag(ctx, f.x, f.y - 96, f.av);
          if (f.emote) emoteBubble(ctx, f.x, f.y - 116, f.emote, 2);
        } });
      }
      drawables.sort((a, b) => a.fy - b.fy).forEach((d) => d.draw());

      if (!visit) for (const it of placed) if (LABELS[it.id]) label(ctx, isoX(it.tx, it.ty), isoY(it.tx, it.ty) - (it.h || 0) - 24, LABELS[it.id]);
      label(ctx, isoX(dorr.tx, dorr.ty) - 28, isoY(dorr.tx, dorr.ty) - WALL_H - 12, visit ? 'ÅK HEM' : 'UT');

      if (night) { ctx.fillStyle = 'rgba(10,12,40,0.18)'; ctx.fillRect(0, 0, CW, CH); }
    },
  };
}

// Figuren i 2× (spriten är 24×40 – här blir den 48×80)
function person2x(ctx, x, y, look, dir, frame) {
  ctx.save();
  ctx.translate(Math.round(x), Math.round(y));
  ctx.scale(2, 2);
  drawPerson(ctx, 0, 0, look, dir, frame);
  ctx.restore();
}

// ---------- iso-ritning (platta = 48×24) ----------
function isoTile(ctx, cx, sy, fill, edge) {
  ctx.fillStyle = fill;
  for (let j = 0; j < 24; j++) {
    const hw = j < 12 ? (j + 1) * 2 : (24 - j) * 2;
    ctx.fillRect(cx - hw, sy + j, hw * 2, 1);
  }
  ctx.fillStyle = edge;
  ctx.fillRect(cx - 2, sy, 4, 1);
  for (let j = 0; j < 12; j++) { ctx.fillRect(cx + (j + 1) * 2 - 2, sy + j, 2, 1); ctx.fillRect(cx + 22 - j * 2, sy + 12 + j, 2, 1); }
}
// Träplatta: bas + två ådringslinjer + kvistar + mörka springor
function woodTile(ctx, cx, sy, c, tx, ty) {
  ctx.fillStyle = css(c);
  for (let j = 0; j < 24; j++) {
    const hw = j < 12 ? (j + 1) * 2 : (24 - j) * 2;
    ctx.fillRect(cx - hw, sy + j, hw * 2, 1);
  }
  ctx.fillStyle = css(mix(c, 0x000000, 0.14));
  for (let i = 0; i < 24; i++) ctx.fillRect(cx - 24 + i, (sy + 12 + i / 2 - 6) | 0, 1, 1);
  for (let i = 0; i < 16; i++) ctx.fillRect(cx - 10 + i, (sy + 17 + i / 2 - 6) | 0, 1, 1);
  ctx.fillStyle = css(mix(c, 0xffffff, 0.08));
  for (let i = 0; i < 20; i++) ctx.fillRect(cx - 16 + i, (sy + 8 + i / 2 - 2) | 0, 1, 1);
  if (hash(tx * 3, ty * 5) > 0.72) {
    ctx.fillStyle = css(mix(c, 0x000000, 0.3));
    const kx = cx + ((hash(tx, ty) * 16) | 0) - 8;
    ctx.fillRect(kx, sy + 10, 3, 2); ctx.fillRect(kx + 1, sy + 9, 1, 1);
  }
  ctx.fillStyle = css(mix(c, 0x000000, 0.32));
  for (let j = 0; j < 12; j++) { ctx.fillRect(cx + 22 - j * 2, sy + 12 + j, 2, 1); ctx.fillRect(cx - 24 + j * 2, sy + 12 + j, 2, 1); }
}
function halfTile(ctx, cx, sy, side) {
  for (let j = 0; j < 24; j++) {
    const hw = j < 12 ? (j + 1) * 2 : (24 - j) * 2;
    if (side === 'nv') ctx.fillRect(cx - hw, sy + j, hw, 1);
    else ctx.fillRect(cx, sy + j, hw, 1);
  }
}
function fullTileGlow(ctx, cx, sy) {
  for (let j = 0; j < 24; j++) {
    const hw = j < 12 ? (j + 1) * 2 : (24 - j) * 2;
    ctx.fillRect(cx - hw, sy + j, hw * 2, 1);
  }
}
// En "låda" på en ruta: topp-diamant på höjd h + två synliga sidor
function isoBlock(ctx, cx, sy, h, top, left, right) {
  ctx.fillStyle = left;
  for (let i = 0; i < 24; i++) ctx.fillRect(cx - 24 + i, (sy + 12 + i / 2 - h) | 0, 1, h);
  ctx.fillStyle = right;
  for (let i = 0; i < 24; i++) ctx.fillRect(cx + i, (sy + 24 - i / 2 - h) | 0, 1, h);
  ctx.fillStyle = top;
  for (let j = 0; j < 24; j++) {
    const hw = j < 12 ? (j + 1) * 2 : (24 - j) * 2;
    ctx.fillRect(cx - hw, sy + j - h, hw * 2, 1);
  }
}
function isoBox(ctx, x0, y0, w, d, h, c) {
  const top = css(mix(c, 0xffffff, 0.18)), left = css(mix(c, 0x000000, 0.22)), right = css(mix(c, 0x000000, 0.42));
  for (let s = 0; s <= w + d - 2; s++)
    for (let a = 0; a < w; a++) { const b = s - a; if (b < 0 || b >= d) continue; isoBlock(ctx, x0 + (a - b) * TW, y0 + (a + b) * TH, h, top, left, right); }
}

function drawFurniture(ctx, it, cx, sy) {
  if (it.id === 'sang') {
    isoBlock(ctx, cx, sy - 10, 24, css(mix(0x5a4632, 0xffffff, 0.15)), css(mix(0x5a4632, 0x000000, 0.2)), css(mix(0x5a4632, 0x000000, 0.4))); // gaveln
    isoBox(ctx, cx, sy, 1, 2, 10, 0x6a5238);
    isoBlock(ctx, cx, sy - 10, 6, '#f7f4ec', '#ddd8ca', '#bcb8ac');           // kudden
    ctx.fillStyle = '#e4e0d2'; ctx.fillRect(cx - 12, sy - 12, 16, 2);
    isoBlock(ctx, cx - TW, sy + TH - 10, 8, '#c9323a', '#a82832', '#8a1a22'); // täcket
    ctx.fillStyle = '#e05a62';
    ctx.fillRect(cx - TW - 8, sy + TH - 14, 6, 2); ctx.fillRect(cx - TW + 4, sy + TH - 10, 6, 2); ctx.fillRect(cx - TW - 14, sy + TH - 8, 6, 2);
    ctx.fillStyle = '#f4f1ea'; for (let i = 0; i < 20; i++) ctx.fillRect(cx - TW - 20 + i, (sy + TH + 8 + i / 2 - 8) | 0, 1, 2); // lakankant
    ctx.fillStyle = '#2a1f16'; ctx.fillRect(cx - TW - 20, sy + TH * 3 + 4, 4, 4); ctx.fillRect(cx + 16, sy + TH * 2 + 8, 4, 4);  // ben
  } else if (it.id === 'garderob') {
    isoBox(ctx, cx, sy, 1, 1, it.h, 0x5a4632);
    ctx.fillStyle = '#3a2a18'; for (let i = 0; i < 20; i++) ctx.fillRect(cx - 12 + i, (sy + 18 - i / 2 - it.h + 24) | 0, 1, it.h - 32);
    // spegel på högra dörren
    ctx.fillStyle = '#9fc8d8'; for (let i = 4; i < 18; i++) ctx.fillRect(cx + i, (sy + 24 - i / 2 - it.h + 20) | 0, 1, it.h - 36);
    ctx.fillStyle = '#d8f0f8'; for (let i = 6; i < 10; i++) ctx.fillRect(cx + i, (sy + 24 - i / 2 - it.h + 24) | 0, 1, it.h - 48);
    ctx.fillStyle = '#e8b230'; ctx.fillRect(cx - 8, sy - it.h + 44, 3, 6);
    ctx.fillStyle = '#2a1f16'; ctx.fillRect(cx - 20, sy + 16, 4, 4); ctx.fillRect(cx + 16, sy + 16, 4, 4); // fötter
  } else if (it.id === 'kylskap') {
    isoBox(ctx, cx, sy, 1, 1, it.h, 0xd8d4cc);
    ctx.fillStyle = '#b5b0a6'; for (let i = 0; i < 22; i++) ctx.fillRect(cx + i, (sy + 24 - i / 2 - it.h + 14) | 0, 1, 2);
    ctx.fillStyle = '#8a857c'; ctx.fillRect(cx + 17, sy - it.h + 20, 3, 8); ctx.fillRect(cx + 17, sy - it.h + 32, 3, 12);
    ctx.fillStyle = '#c9323a'; ctx.fillRect(cx + 6, sy - it.h + 26, 4, 4);
    ctx.fillStyle = '#3a7bd5'; ctx.fillRect(cx + 10, sy - it.h + 36, 4, 4);
    ctx.fillStyle = css(mix(0xd8d4cc, 0xffffff, 0.35)); for (let i = 2; i < 6; i++) ctx.fillRect(cx - 24 + i, (sy + 12 + i / 2 - it.h + 4) | 0, 1, it.h - 10); // glans
  } else if (it.id === 'soffa') {
    isoBox(ctx, cx + TW, sy + TH, 1, 1, 18, 0x24578f);             // armstöd (främre änden)
    isoBox(ctx, cx, sy, it.w, it.d, 8, 0x1d4f8a);                  // sitsen
    isoBox(ctx, cx, sy - 8, it.w, 1, 18, 0x2c6fb7);                // ryggstödet
    ctx.fillStyle = css(mix(0x2c6fb7, 0xffffff, 0.25));            // sittkuddar
    ctx.fillRect(cx - 20, sy - 2, 16, 4); ctx.fillRect(cx + TW - 20, sy + TH - 2, 16, 4);
    ctx.fillStyle = css(mix(0x1d4f8a, 0x000000, 0.4)); ctx.fillRect(cx - 2, sy + 2, 4, 6);
    ctx.fillStyle = '#2a1f16'; ctx.fillRect(cx - TW - 16, sy + TH + 12, 4, 4); ctx.fillRect(cx + TW + 16, sy + TH * 3, 4, 4);
  } else if (it.id === 'vaxt') {
    isoBox(ctx, cx, sy + 6, 1, 1, 10, 0xb5651d);
    ctx.fillStyle = '#8a4a12'; ctx.fillRect(cx - 16, sy + 16, 32, 2);
    ctx.fillStyle = '#2f8f46';
    ctx.fillRect(cx - 2, sy - 28, 4, 28);
    ctx.fillRect(cx - 12, sy - 18, 10, 6); ctx.fillRect(cx + 4, sy - 22, 10, 6); ctx.fillRect(cx - 8, sy - 32, 8, 6); ctx.fillRect(cx + 2, sy - 12, 8, 4);
    ctx.fillStyle = '#45b964'; ctx.fillRect(cx - 12, sy - 20, 4, 2); ctx.fillRect(cx + 8, sy - 24, 4, 2); ctx.fillRect(cx - 6, sy - 34, 4, 2);
    ctx.fillStyle = '#1d5a2c'; ctx.fillRect(cx - 4, sy - 16, 4, 2); ctx.fillRect(cx + 6, sy - 18, 2, 2);
  } else if (it.id === 'matta') {
    for (let a = 0; a < it.w; a++) for (let b = 0; b < it.d; b++) {
      const edgeTile = a === 0 || b === 0 || a === it.w - 1 || b === it.d - 1;
      const inner = css(mix(edgeTile ? 0x8a2a32 : 0xb83d3d, (a + b) % 2 ? 0xd96a5a : 0xb83d3d, 0.5));
      isoTile(ctx, cx + (a - b) * TW, sy + (a + b) * TH - 2, inner, '#e8b230');
    }
    ctx.fillStyle = '#f0d048';
    ctx.fillRect(cx - 4, sy + TH * 2 - 6, 8, 2); ctx.fillRect(cx - TW - 2, sy + TH - 2, 4, 2); ctx.fillRect(cx + TW - 2, sy + TH - 2, 4, 2);
  }
}

// Väggarna: tapet med ränder, krön- och golvlist, tavlor, fönster, TV.
function drawWalls(ctx, plan, W, D, OX, OY, night, furniture, homeId, dorr) {
  const wallNV = plan.wall, wallNO = mix(plan.wall, 0x000000, 0.18);
  const sky = night ? '#101838' : '#8ed0ea';
  for (let tx = 0; tx < W; tx++) {
    const cx = OX + tx * TW, sy = OY + tx * TH;
    for (let i = 0; i < 48; i++) {
      const x = cx - 24 + i, y0 = (sy + 12 + i / 2 - 12 - WALL_H) | 0;
      ctx.fillStyle = css(wallNV); ctx.fillRect(x, y0, 1, WALL_H);
      if (((tx * 48 + i) % 24) < 3) { ctx.fillStyle = css(mix(wallNV, 0xffffff, 0.07)); ctx.fillRect(x, y0 + 6, 1, WALL_H - 20); }
      ctx.fillStyle = css(mix(wallNV, 0x000000, 0.28)); ctx.fillRect(x, y0, 1, 3);
      ctx.fillStyle = css(mix(wallNV, 0xffffff, 0.14)); ctx.fillRect(x, y0 + 3, 1, 2);
      ctx.fillStyle = css(mix(wallNV, 0x000000, 0.35)); ctx.fillRect(x, y0 + WALL_H - 4, 1, 4);
      ctx.fillStyle = css(mix(wallNV, 0xffffff, 0.2)); ctx.fillRect(x, y0 + WALL_H - 6, 1, 2);
    }
  }
  for (let ty = 0; ty < D; ty++) {
    const cx = OX - ty * TW, sy = OY + ty * TH;
    const isDoor = ty === dorr.ty;
    for (let i = 0; i < 48; i++) {
      const x = cx - 24 + i, y0 = (sy + 24 - i / 2 - 12 - WALL_H) | 0;
      const h2 = isDoor && i > 5 && i < 44 ? 12 : WALL_H;
      ctx.fillStyle = css(wallNO); ctx.fillRect(x, y0, 1, h2);
      ctx.fillStyle = css(mix(wallNO, 0x000000, 0.3)); ctx.fillRect(x, y0, 1, 3);
      if (!isDoor || i <= 5 || i >= 44) {
        if (((ty * 48 + i) % 24) < 3) { ctx.fillStyle = css(mix(wallNO, 0xffffff, 0.06)); ctx.fillRect(x, y0 + 6, 1, WALL_H - 20); }
        ctx.fillStyle = css(mix(wallNO, 0x000000, 0.4)); ctx.fillRect(x, y0 + WALL_H - 4, 1, 4);
      }
    }
    if (isDoor) {
      for (let i = 6; i < 44; i++) {
        const x = cx - 24 + i, y0 = (sy + 24 - i / 2 - 12 - WALL_H + 12) | 0;
        ctx.fillStyle = '#141019'; ctx.fillRect(x, y0, 1, WALL_H - 24);
        if (i === 6 || i === 43) { ctx.fillStyle = '#c9b27a'; ctx.fillRect(x, y0, 1, WALL_H - 24); }
      }
      ctx.fillStyle = '#8a7a50';
      for (let i = 6; i < 44; i++) ctx.fillRect(cx - 24 + i, (sy + 24 - i / 2 - 12 - WALL_H + 8) | 0, 1, 4);
    }
  }
  // tavlor
  const deco = (tx, art) => {
    const cx = OX + tx * TW, sy = OY + tx * TH;
    for (let i = 16; i < 34; i++) {
      const x = cx - 24 + i, y0 = (sy + 12 + i / 2 - 12 - WALL_H + 20) | 0;
      ctx.fillStyle = '#5a4632'; ctx.fillRect(x, y0, 1, 18);
      if (i > 17 && i < 32) { ctx.fillStyle = art; ctx.fillRect(x, y0 + 2, 1, 14); }
    }
    ctx.fillStyle = '#f0b429'; ctx.fillRect(cx - 4, (sy - WALL_H + 24) | 0, 4, 2);
  };
  if (homeId !== 'rum') deco(0, '#2aa39a');
  if (homeId === 'villa') deco(1, '#b83d7a');
  // fönster
  const winAt = (tx) => {
    const cx = OX + tx * TW, sy = OY + tx * TH;
    for (let i = 6; i < 44; i++) {
      const x = cx - 24 + i, top = (sy + 12 + i / 2 - 12 - WALL_H + 12) | 0;
      ctx.fillStyle = '#f0ece0'; ctx.fillRect(x, top, 1, 38);
      if (i > 8 && i < 41) { ctx.fillStyle = sky; ctx.fillRect(x, top + 3, 1, 31); }
      ctx.fillStyle = '#d8d2c2'; ctx.fillRect(x, top + 38, 1, 3);
    }
    ctx.fillStyle = '#f0ece0';
    for (let i = 9; i < 41; i++) ctx.fillRect(cx - 24 + i, (sy + 12 + i / 2 - 12 - WALL_H + 28) | 0, 1, 2); // spröjs
    if (!night) { ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.fillRect(cx - 8, sy - WALL_H + 12, 4, 12); ctx.fillRect(cx - 2, sy - WALL_H + 14, 2, 10); }
    else { ctx.fillStyle = '#e8ecff'; ctx.fillRect(cx - 8, sy - WALL_H + 16, 2, 2); ctx.fillRect(cx + 4, sy - WALL_H + 24, 2, 2); }
  };
  winAt(homeId === 'rum' ? W - 2 : W - 3);
  if (homeId === 'villa') winAt(W - 5);
  // väggmonterad TV
  const tvItem = (PLANS[homeId].items.find((i) => i.id === 'tv') || (furniture.includes('tv') ? EXTRA.tv[homeId] : null));
  if (tvItem && tvItem.wallNV !== undefined) {
    const tx = tvItem.wallNV, cx = OX + tx * TW, sy = OY + tx * TH;
    for (let i = 6; i < 44; i++) {
      const x = cx - 24 + i, y0 = (sy + 12 + i / 2 - 12 - WALL_H + 18) | 0;
      ctx.fillStyle = '#17151a'; ctx.fillRect(x, y0, 1, 26);
      if (i > 7 && i < 42) { ctx.fillStyle = night ? '#3fc4ff' : '#2a3038'; ctx.fillRect(x, y0 + 2, 1, 22); }
      if (i > 11 && i < 15) { ctx.fillStyle = night ? '#a8e8ff' : '#3a444e'; ctx.fillRect(x, y0 + 4, 1, 18); }
      ctx.fillStyle = '#5a4632'; ctx.fillRect(x, y0 + 30, 1, 2);
    }
  }
}

// text i dubbel skala så den matchar hi-res-rummet
function label(ctx, cx, y, s) {
  const w = textW(SMALL, s, 2) + 12;
  ctx.fillStyle = 'rgba(23,21,26,0.75)'; ctx.fillRect(cx - w / 2 | 0, y | 0, w, 18);
  ctxText(ctx, SMALL, s, (cx - w / 2 | 0) + 6, (y | 0) + 4, '#f4f1ea', 2);
}
function nameTag(ctx, x, y, av) {
  const c = avatarTagColors(av);
  const w = textW(SMALL, av.name || '?', 2) + 12;
  ctx.fillStyle = c.bg; ctx.fillRect(x - w / 2 | 0, y | 0, w, 18);
  ctxText(ctx, SMALL, av.name || '?', (x - w / 2 | 0) + 6, (y | 0) + 4, c.fg, 2);
}

// Pratbubbla med en emoji (k = skala: 1 i staden, 2 i rummet)
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
