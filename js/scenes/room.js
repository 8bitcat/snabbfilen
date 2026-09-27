// Hemma – i Habbo-stil: ett isometriskt rutnätsgolv man går runt på, med två
// väggar bakåt, möbler som står på rutor och figurer som y-sorteras mot
// möblerna. Klicka på golvet så går figuren dit (BFS-vägsökning på rutnätet),
// klicka på en möbel så går den fram och använder den. Samma scen ritar besök
// hemma hos en kompis (via A.visitTarget) – då är bara dörren aktiv.
// Större bostad = större rum: 6×6 → 8×7 → 10×8 rutor.
import { drawPerson } from '../core/people.js';
import { openAvatarEditor, avatarTagColors } from '../core/avatar.js';
import { SMALL, ctxText, textW, mix, css, hash } from '../core/floor-pix.js';
import { openModal, closeModal, toast } from '../core/ui.js';
import { foodOf } from '../game.js';
import { play } from '../core/sound.js';
import { worldFolksHere, worldMyEmote } from '../net/world.js';

const WALK_SEQ = [1, 3, 2, 3];
const TW = 12, TH = 6;    // halva plattbredden/-höjden (platta = 24×12)
const WALL_H = 36;

// Planer per bostad: rutnätets storlek, färger och var möblerna står.
// Möbler: tx/ty = bas-ruta, w/d = rutor i tx-/ty-led, h = höjd i pixlar.
const PLANS = {
  rum: {
    W: 6, D: 6, wall: 0x8c8270, wall2: 0x6e675a, floorA: 0x9a7a50, floorB: 0x8a6c46,
    items: [
      { id: 'sang', tx: 0, ty: 2, w: 1, d: 2, h: 7 },
      { id: 'garderob', tx: 2, ty: 0, w: 1, d: 1, h: 26 },
      { id: 'kylskap', tx: 4, ty: 0, w: 1, d: 1, h: 22 },
    ],
  },
  lagenhet: {
    W: 8, D: 7, wall: 0x7a94a8, wall2: 0x5e7488, floorA: 0xb08a58, floorB: 0x9e7a4c,
    items: [
      { id: 'sang', tx: 0, ty: 2, w: 1, d: 2, h: 7 },
      { id: 'garderob', tx: 2, ty: 0, w: 1, d: 1, h: 26 },
      { id: 'kylskap', tx: 6, ty: 0, w: 1, d: 1, h: 22 },
      { id: 'soffa', tx: 4, ty: 4, w: 2, d: 1, h: 7 },
      { id: 'vaxt', tx: 7, ty: 0, w: 1, d: 1, h: 6 },
    ],
  },
  villa: {
    W: 10, D: 8, wall: 0xc0b090, wall2: 0xa08e6e, floorA: 0x8a6a42, floorB: 0x7a5c38,
    items: [
      { id: 'sang', tx: 0, ty: 2, w: 1, d: 2, h: 7 },
      { id: 'garderob', tx: 2, ty: 0, w: 1, d: 1, h: 26 },
      { id: 'kylskap', tx: 8, ty: 0, w: 1, d: 1, h: 22 },
      { id: 'soffa', tx: 6, ty: 4, w: 2, d: 1, h: 7 },
      { id: 'vaxt', tx: 9, ty: 0, w: 1, d: 1, h: 6 },
      { id: 'tv', wallNV: 3 },
      { id: 'matta', tx: 3, ty: 3, w: 2, d: 2, flat: true },
    ],
  },
};
// Köpta möbler dyker upp även i mindre bostäder (om det finns en ledig plats)
const EXTRA = {
  soffa: { rum: { tx: 3, ty: 4, w: 2, d: 1, h: 7 }, lagenhet: null },
  vaxt: { rum: { tx: 5, ty: 0, w: 1, d: 1, h: 6 }, lagenhet: null },
  tv: { rum: { wallNV: 4 }, lagenhet: { wallNV: 5 } },
  matta: { rum: { tx: 2, ty: 3, w: 2, d: 2, flat: true }, lagenhet: { tx: 3, ty: 3, w: 2, d: 2, flat: true } },
};
const LABELS = { sang: 'SÄNG', garderob: 'GARDEROB', kylskap: 'KYLSKÅP', dorr: 'UT' };

export function makeRoom(A, { visit = false } = {}) {
  const g = A.game;
  const homeId = () => (visit ? A.visitTarget?.home || 'rum' : g.home);
  const furn = () => (visit ? A.visitTarget?.furniture || [] : g.furniture);

  // ---------- bygg planen ----------
  const plan = PLANS[homeId()] || PLANS.rum;
  const { W, D } = plan;
  const OX = 192 + (D - W) * TH;
  const OY = Math.round((216 - (W + D) * TH) / 2) + 12;
  // planens fasta möbler + köpta extra (för mindre bostäder)
  const placed = [...plan.items];
  for (const [id, spots] of Object.entries(EXTRA)) {
    if (!furn().includes(id)) continue;
    if (placed.some((it) => it.id === id)) continue;
    const spot = spots[homeId()];
    if (spot) placed.push({ id, ...spot });
  }
  const dorr = { id: 'dorr', tx: 0, ty: D - 1 }; // dörröppningen i vänstra väggen

  // gångbara rutor
  const blocked = new Set();
  for (const it of placed) {
    if (it.flat || it.wallNV !== undefined) continue;
    for (let a = 0; a < (it.w || 1); a++) for (let b = 0; b < (it.d || 1); b++) blocked.add(`${it.tx + a},${it.ty + b}`);
  }
  const free = (tx, ty) => tx >= 0 && ty >= 0 && tx < W && ty < D && !blocked.has(`${tx},${ty}`);

  // iso-hjälpare
  const isoX = (tx, ty) => OX + (tx - ty) * TW;
  const isoY = (tx, ty) => OY + (tx + ty) * TH;
  const tileAt = (x, y) => {
    const fx = ((x - OX) / TW + (y - OY) / TH) / 2, fy = ((y - OY) / TH - (x - OX) / TW) / 2;
    return [Math.floor(fx), Math.floor(fy)];
  };

  // ---------- figuren ----------
  let ptx = visit ? Math.min(1, W - 1) : 2, pty = D - 2; // startruta innanför dörren
  if (!free(ptx, pty)) [ptx, pty] = nearestFreeTile(ptx, pty);
  let px = isoX(ptx, pty), py = isoY(ptx, pty) + TH;
  let path = [], onArrive = null, dir = 'down', t = 0;

  function nearestFreeTile(tx, ty) {
    for (let r = 0; r < 8; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++)
      if (free(tx + dx, ty + dy)) return [tx + dx, ty + dy];
    return [0, 0];
  }
  // BFS med diagonaler (hörnregel: båda kardinalerna måste vara fria)
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
  // närmsta fria granne till en möbel (att ställa sig på)
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

  // ---------- handlingar ----------
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
    // för tools/smoke.mjs: skärmpunkter att klicka på
    _debug: {
      spot: (id) => { const it = id === 'dorr' ? dorr : placed.find((i) => i.id === id); return it ? { x: isoX(it.tx, it.ty), y: isoY(it.tx, it.ty) + TH } : null; },
      tile: (tx, ty) => ({ x: isoX(tx, ty), y: isoY(tx, ty) + TH }),
    },

    update(dt) {
      t += dt;
      if (path.length) {
        const [ttx, tty] = path[0];
        const gx = isoX(ttx, tty), gy = isoY(ttx, tty) + TH;
        const dx = gx - px, dy = gy - py, dist = Math.hypot(dx, dy), step = 58 * dt;
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
      // möbel? (skärm-bounding-box, främsta först)
      const hit = [...placed, dorr].sort((a, b) => (b.tx + b.ty) - (a.tx + a.ty)).find((it) => {
        if (it.wallNV !== undefined) return false;
        const w = it.w || 1, d = it.d || 1;
        const x0 = isoX(it.tx, it.ty + d - 1) - TW, x1 = isoX(it.tx + w - 1, it.ty) + TW;
        const y0 = isoY(it.tx, it.ty) - (it.h || 0), y1 = isoY(it.tx + w - 1, it.ty + d - 1) + TH * 2;
        return x >= x0 && x <= x1 && y >= y0 && y <= y1 && !it.flat;
      });
      if (hit && (acts[hit.id] || hit.id === 'dorr')) { approach(hit, acts[hit.id] || undefined); return; }
      const [tx, ty] = tileAt(x, y);
      if (tx >= 0 && ty >= 0 && tx < W && ty < D) walkToTile(tx, ty);
    },

    draw(ctx) {
      const { W: CW, H: CH } = A;
      const hour = g.min / 60, night = hour >= 19.5 || hour < 6.5;
      // utanför rummet: mjuk vinjett
      ctx.fillStyle = '#221d2a'; ctx.fillRect(0, 0, CW, CH);
      ctx.fillStyle = '#28222f'; ctx.fillRect(20, 12, CW - 40, CH - 24);

      drawWalls(ctx, plan, W, D, OX, OY, night, furn(), homeId(), dorr);

      // trägolv: plankfärg per rad, ådring och springor
      for (let ty = 0; ty < D; ty++) for (let tx = 0; tx < W; tx++) {
        const seed = hash(tx * 7, ty * 13);
        const c = mix(plan.floorA, plan.floorB, (ty % 2) * 0.5 + seed * 0.4);
        woodTile(ctx, isoX(tx, ty), isoY(tx, ty), c, tx, ty);
      }
      // golvets platåkant (gör rummet till en ö som i Habbo, fast med trä)
      ctx.fillStyle = css(mix(plan.floorB, 0x000000, 0.55));
      for (let tx = 0; tx < W; tx++) { const cx = isoX(tx, D - 1), sy = isoY(tx, D - 1); for (let i = 0; i < 12; i++) ctx.fillRect(cx - 12 + i, (sy + 6 + i / 2) | 0, 1, 5); }
      ctx.fillStyle = css(mix(plan.floorB, 0x000000, 0.7));
      for (let ty = 0; ty < D; ty++) { const cx = isoX(W - 1, ty), sy = isoY(W - 1, ty); for (let i = 0; i < 12; i++) ctx.fillRect(cx + i, (sy + 12 - i / 2) | 0, 1, 5); }
      // väggskugga på golvet (mjuk ambient längs bakväggarna)
      ctx.fillStyle = 'rgba(20,14,32,0.16)';
      for (let tx = 0; tx < W; tx++) halfTile(ctx, isoX(tx, 0), isoY(tx, 0), 'nv');
      for (let ty = 0; ty < D; ty++) if (ty !== dorr.ty) halfTile(ctx, isoX(0, ty), isoY(0, ty), 'no');
      // dörrmattan
      isoTile(ctx, isoX(dorr.tx, dorr.ty), isoY(dorr.tx, dorr.ty), '#c9b27a', '#8a7a50');
      ctx.fillStyle = '#a8905a'; ctx.fillRect(isoX(dorr.tx, dorr.ty) - 6, isoY(dorr.tx, dorr.ty) + 5, 12, 1);

      // taklampan mitt i rummet
      const lampX = isoX((W / 2) | 0, (D / 2) | 0), lampTop = OY - WALL_H - 4;
      const lampY = lampTop + 16;
      if (night) { // varmt ljus på golvet under lampan
        ctx.fillStyle = 'rgba(255,214,120,0.12)';
        for (let r = 0; r < 3; r++) fullTileGlow(ctx, lampX, isoY((W / 2) | 0, (D / 2) | 0) - 6 + r * 4);
      }
      ctx.fillStyle = '#3a3440'; ctx.fillRect(lampX, lampTop, 1, 12);
      ctx.fillStyle = '#c9323a'; ctx.fillRect(lampX - 5, lampY - 4, 11, 2); ctx.fillRect(lampX - 3, lampY - 6, 7, 2); ctx.fillRect(lampX - 1, lampY - 8, 3, 2);
      ctx.fillStyle = night ? '#ffd97a' : '#8a8478'; ctx.fillRect(lampX - 2, lampY - 2, 5, 2);

      // platta saker först (mattan)
      for (const it of placed) if (it.flat) drawFurniture(ctx, it, isoX(it.tx, it.ty), isoY(it.tx, it.ty));

      // y-sorterat: möbler + jag + kompisar
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
        drawPerson(ctx, px, py, A.avatar.look, dir, frame);
        if (folks.length) nameTag(ctx, px, py - 48, A.avatar);
        if (mine) emoteBubble(ctx, px, py - 58, mine);
      } });
      for (const f of folks) {
        drawables.push({ fy: f.y, draw: () => {
          drawPerson(ctx, f.x, f.y, f.av.look, 'down', f.walking ? WALK_SEQ[Math.floor(t * 8.5) % 4] : (Math.sin(t * 2 + f.x) > 0.9 ? 4 : 0));
          nameTag(ctx, f.x, f.y - 48, f.av);
          if (f.emote) emoteBubble(ctx, f.x, f.y - 58, f.emote);
        } });
      }
      drawables.sort((a, b) => a.fy - b.fy).forEach((d) => d.draw());

      // etiketter på klickytorna (inte på besök – där gäller bara dörren)
      if (!visit) {
        for (const it of placed) if (LABELS[it.id]) label(ctx, isoX(it.tx, it.ty), isoY(it.tx, it.ty) - (it.h || 0) - 12, LABELS[it.id]);
      }
      label(ctx, isoX(dorr.tx, dorr.ty) - 14, isoY(dorr.tx, dorr.ty) - WALL_H - 6, visit ? 'ÅK HEM' : 'UT');

      if (night) { ctx.fillStyle = 'rgba(10,12,40,0.18)'; ctx.fillRect(0, 0, CW, CH); }
    },
  };
}

// ---------- iso-ritning ----------
// En golvplatta (24×12) med topphörnet i (cx, sy), skarpa pixlar via scanlines
function isoTile(ctx, cx, sy, fill, edge) {
  ctx.fillStyle = fill;
  for (let j = 0; j < 12; j++) {
    const hw = j < 6 ? (j + 1) * 2 : (12 - j) * 2;
    ctx.fillRect(cx - hw, sy + j, hw * 2, 1);
  }
  ctx.fillStyle = edge;
  ctx.fillRect(cx - 2, sy, 4, 1);
  for (let j = 0; j < 6; j++) { ctx.fillRect(cx + (j + 1) * 2 - 2, sy + j, 2, 1); ctx.fillRect(cx + 10 - j * 2, sy + 6 + j, 2, 1); }
}
// Träplatta: bas + ådring längs NV–SO-riktningen + mörk springa på nedre kanterna
function woodTile(ctx, cx, sy, c, tx, ty) {
  ctx.fillStyle = css(c);
  for (let j = 0; j < 12; j++) {
    const hw = j < 6 ? (j + 1) * 2 : (12 - j) * 2;
    ctx.fillRect(cx - hw, sy + j, hw * 2, 1);
  }
  // ådringen: två linjer parallella med plattans högerkant
  ctx.fillStyle = css(mix(c, 0x000000, 0.14));
  for (let i = 0; i < 12; i++) { ctx.fillRect(cx - 12 + i, (sy + 6 + i / 2 - 3) | 0, 1, 1); }
  ctx.fillStyle = css(mix(c, 0xffffff, 0.08));
  for (let i = 0; i < 10; i++) { ctx.fillRect(cx - 8 + i, (sy + 4 + i / 2 - 1) | 0, 1, 1); }
  // kvist då och då
  if (hash(tx * 3, ty * 5) > 0.75) { ctx.fillStyle = css(mix(c, 0x000000, 0.3)); ctx.fillRect(cx + ((hash(tx, ty) * 8) | 0) - 4, sy + 5, 2, 1); }
  // springorna (nedre kanterna)
  ctx.fillStyle = css(mix(c, 0x000000, 0.32));
  for (let j = 0; j < 6; j++) { ctx.fillRect(cx + 10 - j * 2, sy + 6 + j, 2, 1); ctx.fillRect(cx - 12 + j * 2, sy + 6 + j, 2, 1); }
}
// Halv platta i aktuell fillStyle – används för väggskuggan
function halfTile(ctx, cx, sy, side) {
  for (let j = 0; j < 12; j++) {
    const hw = j < 6 ? (j + 1) * 2 : (12 - j) * 2;
    if (side === 'nv') ctx.fillRect(cx - hw, sy + j, hw, 1);
    else ctx.fillRect(cx, sy + j, hw, 1);
  }
}
// Hel platta i aktuell fillStyle (halvtransparent ljus)
function fullTileGlow(ctx, cx, sy) {
  for (let j = 0; j < 12; j++) {
    const hw = j < 6 ? (j + 1) * 2 : (12 - j) * 2;
    ctx.fillRect(cx - hw, sy + j, hw * 2, 1);
  }
}
// En "låda" på en ruta: topp-diamant på höjd h + vänster/höger sida
function isoBlock(ctx, cx, sy, h, top, left, right) {
  ctx.fillStyle = left;
  for (let i = 0; i < 12; i++) ctx.fillRect(cx - 12 + i, sy + 6 + i / 2 - h | 0, 1, h);
  ctx.fillStyle = right;
  for (let i = 0; i < 12; i++) ctx.fillRect(cx + i, sy + 12 - i / 2 - h | 0, 1, h);
  ctx.fillStyle = top;
  for (let j = 0; j < 12; j++) {
    const hw = j < 6 ? (j + 1) * 2 : (12 - j) * 2;
    ctx.fillRect(cx - hw, sy + j - h, hw * 2, 1);
  }
}
// Hela möbeln: block per täckt ruta i rätt ordning
function isoBox(ctx, x0, y0, w, d, h, c) {
  const top = css(mix(c, 0xffffff, 0.18)), left = css(mix(c, 0x000000, 0.22)), right = css(mix(c, 0x000000, 0.42));
  for (let s = 0; s <= w + d - 2; s++)
    for (let a = 0; a < w; a++) { const b = s - a; if (b < 0 || b >= d) continue; isoBlock(ctx, x0 + (a - b) * TW, y0 + (a + b) * TH, h, top, left, right); }
}

function drawFurniture(ctx, it, cx, sy) {
  if (it.id === 'sang') {
    isoBlock(ctx, cx, sy - 5, 12, css(mix(0x5a4632, 0xffffff, 0.15)), css(mix(0x5a4632, 0x000000, 0.2)), css(mix(0x5a4632, 0x000000, 0.4))); // gaveln
    isoBox(ctx, cx, sy, 1, 2, 5, 0x6a5238);
    isoBlock(ctx, cx, sy - 5, 3, '#f7f4ec', '#ddd8ca', '#bcb8ac');            // kudden
    ctx.fillStyle = '#e4e0d2'; ctx.fillRect(cx - 6, sy - 6, 8, 1);            // kuddens veck
    isoBlock(ctx, cx - TW, sy + TH - 5, 4, '#c9323a', '#a82832', '#8a1a22');  // täcket
    ctx.fillStyle = '#e05a62';                                                // rutmönster på täcket
    ctx.fillRect(cx - TW - 4, sy + TH - 7, 3, 1); ctx.fillRect(cx - TW + 2, sy + TH - 5, 3, 1); ctx.fillRect(cx - TW - 7, sy + TH - 4, 3, 1);
    ctx.fillStyle = '#f4f1ea'; for (let i = 0; i < 10; i++) ctx.fillRect(cx - TW - 10 + i, (sy + TH + 4 + i / 2 - 4) | 0, 1, 1); // lakankant
    ctx.fillStyle = '#2a1f16'; ctx.fillRect(cx - TW - 10, sy + TH * 3 + 2, 2, 2); ctx.fillRect(cx + 8, sy + TH * 2 + 4, 2, 2);   // ben
  } else if (it.id === 'garderob') {
    isoBox(ctx, cx, sy, 1, 1, it.h, 0x5a4632);
    ctx.fillStyle = '#3a2a18'; for (let i = 0; i < 10; i++) ctx.fillRect(cx - 6 + i, (sy + 9 - i / 2 - it.h + 12) | 0, 1, it.h - 16);
    // spegel på högra dörren
    ctx.fillStyle = '#9fc8d8'; for (let i = 2; i < 9; i++) ctx.fillRect(cx + i, (sy + 12 - i / 2 - it.h + 10) | 0, 1, it.h - 18);
    ctx.fillStyle = '#d8f0f8'; for (let i = 3; i < 5; i++) ctx.fillRect(cx + i, (sy + 12 - i / 2 - it.h + 12) | 0, 1, it.h - 24);
    ctx.fillStyle = '#e8b230'; ctx.fillRect(cx - 4, sy - it.h + 22, 2, 3);
    ctx.fillStyle = '#2a1f16'; ctx.fillRect(cx - 10, sy + 8, 2, 2); ctx.fillRect(cx + 8, sy + 8, 2, 2); // fötter
  } else if (it.id === 'kylskap') {
    isoBox(ctx, cx, sy, 1, 1, it.h, 0xd8d4cc);
    ctx.fillStyle = '#b5b0a6'; for (let i = 0; i < 11; i++) ctx.fillRect(cx + i, (sy + 12 - i / 2 - it.h + 7) | 0, 1, 1); // frysdörren
    ctx.fillStyle = '#8a857c'; ctx.fillRect(cx + 8, sy - it.h + 10, 2, 4); ctx.fillRect(cx + 8, sy - it.h + 16, 2, 6);    // handtag
    ctx.fillStyle = '#c9323a'; ctx.fillRect(cx + 3, sy - it.h + 13, 2, 2);   // magnet
    ctx.fillStyle = '#3a7bd5'; ctx.fillRect(cx + 5, sy - it.h + 18, 2, 2);   // magnet till
  } else if (it.id === 'soffa') {
    isoBox(ctx, cx + TW, sy + TH, 1, 1, 9, 0x24578f);              // armstöd höger (främre änden)
    isoBox(ctx, cx, sy, it.w, it.d, 4, 0x1d4f8a);                  // sitsen
    isoBox(ctx, cx, sy - 4, it.w, 1, 9, 0x2c6fb7);                 // ryggstödet
    ctx.fillStyle = css(mix(0x2c6fb7, 0xffffff, 0.25));            // sittkuddar med springa
    ctx.fillRect(cx - 10, sy - 1, 8, 2); ctx.fillRect(cx + TW - 10, sy + TH - 1, 8, 2);
    ctx.fillStyle = css(mix(0x1d4f8a, 0x000000, 0.4)); ctx.fillRect(cx - 1, sy + 1, 2, 3);
    ctx.fillStyle = '#2a1f16'; ctx.fillRect(cx - TW - 8, sy + TH + 6, 2, 2); ctx.fillRect(cx + TW + 8, sy + TH * 3, 2, 2); // ben
  } else if (it.id === 'vaxt') {
    isoBox(ctx, cx, sy + 3, 1, 1, 5, 0xb5651d);                    // terrakottakruka
    ctx.fillStyle = '#8a4a12'; ctx.fillRect(cx - 8, sy + 8, 16, 1); // fatets kant
    ctx.fillStyle = '#2f8f46';                                      // stor grönska
    ctx.fillRect(cx - 1, sy - 14, 2, 14);
    ctx.fillRect(cx - 6, sy - 9, 5, 3); ctx.fillRect(cx + 2, sy - 11, 5, 3); ctx.fillRect(cx - 4, sy - 16, 4, 3); ctx.fillRect(cx + 1, sy - 6, 4, 2);
    ctx.fillStyle = '#45b964'; ctx.fillRect(cx - 6, sy - 10, 2, 1); ctx.fillRect(cx + 4, sy - 12, 2, 1); ctx.fillRect(cx - 3, sy - 17, 2, 1);
    ctx.fillStyle = '#1d5a2c'; ctx.fillRect(cx - 2, sy - 8, 2, 1); ctx.fillRect(cx + 3, sy - 9, 1, 1);
  } else if (it.id === 'matta') {
    for (let a = 0; a < it.w; a++) for (let b = 0; b < it.d; b++) {
      const edgeTile = a === 0 || b === 0 || a === it.w - 1 || b === it.d - 1;
      const inner = css(mix(edgeTile ? 0x8a2a32 : 0xb83d3d, (a + b) % 2 ? 0xd96a5a : 0xb83d3d, 0.5));
      isoTile(ctx, cx + (a - b) * TW, sy + (a + b) * TH - 1, inner, '#e8b230');
    }
    ctx.fillStyle = '#f0d048'; // mönsterprickar
    ctx.fillRect(cx - 2, sy + TH * 2 - 3, 4, 1); ctx.fillRect(cx - TW - 1, sy + TH - 1, 2, 1); ctx.fillRect(cx + TW - 1, sy + TH - 1, 2, 1);
  }
}

// Väggarna: tapet med mönster, krönlist, golvlist, tavlor, fönster med karm
// och fönsterbräda samt ev. väggmonterad TV.
function drawWalls(ctx, plan, W, D, OX, OY, night, furniture, homeId, dorr) {
  const wallNV = plan.wall, wallNO = mix(plan.wall, 0x000000, 0.18);
  const sky = night ? '#101838' : '#8ed0ea';
  // NV-väggen (längs ty=0): paneler åt höger-ner
  for (let tx = 0; tx < W; tx++) {
    const cx = OX + tx * TW, sy = OY + tx * TH;
    for (let i = 0; i < 24; i++) {
      const x = cx - 12 + i, y0 = (sy + 6 + i / 2 - 6 - WALL_H) | 0;
      ctx.fillStyle = css(wallNV); ctx.fillRect(x, y0, 1, WALL_H);
      // tapetränder + bård
      if (((tx * 24 + i) % 12) < 2) { ctx.fillStyle = css(mix(wallNV, 0xffffff, 0.07)); ctx.fillRect(x, y0 + 3, 1, WALL_H - 10); }
      ctx.fillStyle = css(mix(wallNV, 0x000000, 0.28)); ctx.fillRect(x, y0, 1, 2);            // krönlist
      ctx.fillStyle = css(mix(wallNV, 0xffffff, 0.14)); ctx.fillRect(x, y0 + 2, 1, 1);
      ctx.fillStyle = css(mix(wallNV, 0x000000, 0.35)); ctx.fillRect(x, y0 + WALL_H - 2, 1, 2); // golvlist
      ctx.fillStyle = css(mix(wallNV, 0xffffff, 0.2)); ctx.fillRect(x, y0 + WALL_H - 3, 1, 1);
    }
  }
  // NO-väggen (längs tx=0), med dörröppning
  for (let ty = 0; ty < D; ty++) {
    const cx = OX - ty * TW, sy = OY + ty * TH;
    const isDoor = ty === dorr.ty;
    for (let i = 0; i < 24; i++) {
      const x = cx - 12 + i, y0 = (sy + 12 - i / 2 - 6 - WALL_H) | 0;
      const h2 = isDoor && i > 2 && i < 22 ? 6 : WALL_H;
      ctx.fillStyle = css(wallNO); ctx.fillRect(x, y0, 1, h2);
      ctx.fillStyle = css(mix(wallNO, 0x000000, 0.3)); ctx.fillRect(x, y0, 1, 2);
      if (!isDoor || i <= 2 || i >= 22) {
        if (((ty * 24 + i) % 12) < 2) { ctx.fillStyle = css(mix(wallNO, 0xffffff, 0.06)); ctx.fillRect(x, y0 + 3, 1, WALL_H - 10); }
        ctx.fillStyle = css(mix(wallNO, 0x000000, 0.4)); ctx.fillRect(x, y0 + WALL_H - 2, 1, 2);
      }
    }
    if (isDoor) { // öppningen: mörker utanför, karm och ljuskant
      for (let i = 3; i < 22; i++) {
        const x = cx - 12 + i, y0 = (sy + 12 - i / 2 - 6 - WALL_H + 6) | 0;
        ctx.fillStyle = '#141019'; ctx.fillRect(x, y0, 1, WALL_H - 12);
        if (i === 3 || i === 21) { ctx.fillStyle = '#c9b27a'; ctx.fillRect(x, y0, 1, WALL_H - 12); }
      }
      ctx.fillStyle = '#8a7a50';
      for (let i = 3; i < 22; i++) ctx.fillRect(cx - 12 + i, (sy + 12 - i / 2 - 6 - WALL_H + 4) | 0, 1, 2);
    }
  }
  // tavlor på NV-väggen (på plattor utan fönster/TV)
  const deco = (tx, art) => {
    const cx = OX + tx * TW, sy = OY + tx * TH;
    for (let i = 8; i < 17; i++) {
      const x = cx - 12 + i, y0 = (sy + 6 + i / 2 - 6 - WALL_H + 10) | 0;
      ctx.fillStyle = '#5a4632'; ctx.fillRect(x, y0, 1, 9);
      if (i > 8 && i < 16) { ctx.fillStyle = art; ctx.fillRect(x, y0 + 1, 1, 7); }
    }
    ctx.fillStyle = '#f0b429'; ctx.fillRect(cx - 2, (sy - WALL_H + 12) | 0, 2, 1);
  };
  if (homeId !== 'rum') deco(0, '#2aa39a');
  if (homeId === 'villa') deco(1, '#b83d7a');
  // fönster med karm och bräda
  const winAt = (tx) => {
    const cx = OX + tx * TW, sy = OY + tx * TH;
    for (let i = 3; i < 22; i++) {
      const x = cx - 12 + i, top = (sy + 6 + i / 2 - 6 - WALL_H + 6) | 0;
      ctx.fillStyle = '#f0ece0'; ctx.fillRect(x, top, 1, 19);                       // karmen
      if (i > 4 && i < 20) { ctx.fillStyle = sky; ctx.fillRect(x, top + 2, 1, 15); }
      ctx.fillStyle = '#d8d2c2'; ctx.fillRect(x, top + 19, 1, 2);                   // brädan
    }
    ctx.fillStyle = '#f0ece0';
    for (let i = 5; i < 20; i++) ctx.fillRect(cx - 12 + i, (sy + 6 + i / 2 - 6 - WALL_H + 14) | 0, 1, 1); // spröjs
    if (!night) { ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fillRect(cx - 4, sy - WALL_H + 6, 2, 6); }
    else { ctx.fillStyle = '#e8ecff'; ctx.fillRect(cx - 4, sy - WALL_H + 8, 1, 1); ctx.fillRect(cx + 2, sy - WALL_H + 12, 1, 1); }
  };
  winAt(homeId === 'rum' ? W - 2 : W - 3);
  if (homeId === 'villa') winAt(W - 5);
  // väggmonterad TV med hylla
  const tvItem = (PLANS[homeId].items.find((i) => i.id === 'tv') || (furniture.includes('tv') ? EXTRA.tv[homeId] : null));
  if (tvItem && tvItem.wallNV !== undefined) {
    const tx = tvItem.wallNV, cx = OX + tx * TW, sy = OY + tx * TH;
    for (let i = 3; i < 22; i++) {
      const x = cx - 12 + i, y0 = (sy + 6 + i / 2 - 6 - WALL_H + 9) | 0;
      ctx.fillStyle = '#17151a'; ctx.fillRect(x, y0, 1, 13);
      if (i > 3 && i < 21) { ctx.fillStyle = night ? '#3fc4ff' : '#2a3038'; ctx.fillRect(x, y0 + 1, 1, 11); }
      if (i === 6 || i === 7) { ctx.fillStyle = night ? '#a8e8ff' : '#3a444e'; ctx.fillRect(x, y0 + 2, 1, 9); } // reflex
      ctx.fillStyle = '#5a4632'; ctx.fillRect(x, y0 + 15, 1, 1); // hyllan
    }
  }
}

function label(ctx, cx, y, s) {
  const w = textW(SMALL, s) + 6;
  ctx.fillStyle = 'rgba(23,21,26,0.75)'; ctx.fillRect(cx - w / 2 | 0, y | 0, w, 9);
  ctxText(ctx, SMALL, s, (cx - w / 2 | 0) + 3, (y | 0) + 2, '#f4f1ea');
}

function nameTag(ctx, x, y, av) {
  const c = avatarTagColors(av);
  const w = textW(SMALL, av.name || '?') + 6;
  ctx.fillStyle = c.bg; ctx.fillRect(x - w / 2 | 0, y | 0, w, 9);
  ctxText(ctx, SMALL, av.name || '?', (x - w / 2 | 0) + 3, (y | 0) + 2, c.fg);
}

// Pratbubbla med en emoji ovanför huvudet
export function emoteBubble(ctx, x, y, e) {
  ctx.fillStyle = '#17151a'; ctx.fillRect(x - 9 | 0, y - 15, 18, 16);
  ctx.fillStyle = '#f4f1ea'; ctx.fillRect(x - 8 | 0, y - 14, 16, 14);
  ctx.fillStyle = '#f4f1ea'; ctx.fillRect(x - 1 | 0, y, 3, 3); // pilen ner
  ctx.font = '10px "Segoe UI Emoji", sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(e, x, y - 7);
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
