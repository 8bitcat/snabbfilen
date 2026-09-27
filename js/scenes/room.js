// Hemma – Pixelverkstans butiksstil i spelets gemensamma 384×216-rymd.
// Bostäderna har flera delrum (dörrar i bakväggen), och allt bohag är
// "deco"-poster { k, v, x, y, c? } per delrum som ritas från möbelatlasen
// (köpta EmanuelleDev-sprites; c = egen färg, ritas med tintSprite). Med
// Möblera-läget flyttar, placerar, målar om och säljer man möbler fritt –
// och besökare ser din inredning (med färgerna) via världen.
import { drawPerson } from '../core/people.js';
import { openAvatarEditor, avatarTagColors } from '../core/avatar.js';
import { Pix, SMALL, ctxText, textW, text, mix, mul, css, hash, bayer } from '../core/floor-pix.js';
import { openModal, closeModal, toast } from '../core/ui.js';
import { foodOf, katalogOf } from '../game.js';
import { play } from '../core/sound.js';
import { worldFolksHere, worldMyEmote } from '../net/world.js';
import { FRAMES } from '../data/frames.js';
import { tintSprite, spriteBaseColor, isHex } from '../core/recolor.js';

const WALK_SEQ = [1, 3, 2, 3];
const FW = 384, FH = 216;
const WALL_Y = 86;
const DOOR = { x0: 28, x1: 62, cx: 45 };
const RUG = { w: 90, h: 48 };

export const ATLAS = typeof Image !== 'undefined' ? new Image() : null;
if (ATLAS) ATLAS.src = 'assets/interior.png';

// Bostädernas delrum: tema + fönster per rum. partition = hur bred lokalen är.
const PLANS = {
  rum: {
    partition: 225,
    rooms: [{ name: 'RUMMET', wall: 0x8c7a62, wallDk: 0x6a5c48, floorA: 0xcbb894, floorB: 0xb09a74, windows: [[80, 120]] }],
  },
  lagenhet: {
    partition: 310,
    rooms: [
      { name: 'VARDAGSRUM', wall: 0x6e88a0, wallDk: 0x4e6478, floorA: 0xd9cbaf, floorB: 0xc0ac88, windows: [[80, 120], [134, 174]] },
      { name: 'SOVRUM', wall: 0x8a7f9a, wallDk: 0x685e78, floorA: 0xd0c2b0, floorB: 0xb8a892, windows: [[100, 140]] },
    ],
  },
  villa: {
    partition: 0, lyx: true,
    rooms: [
      { name: 'VARDAGSRUM', wall: 0xc4b190, wallDk: 0x9a8a6a, floorA: 0xefe6d2, floorB: 0xd9ccb2, windows: [[80, 120], [134, 172], [240, 280]] },
      { name: 'SOVRUM', wall: 0xb8a0a8, wallDk: 0x907880, floorA: 0xe8ded0, floorB: 0xd2c4b2, windows: [[110, 150], [210, 250]] },
      { name: 'KÖK', wall: 0xa8b8a0, wallDk: 0x808f78, floorA: 0xe2e6da, floorB: 0xc8cec0, windows: [[110, 150], [230, 270]] },
    ],
  },
};

// Startmöbleringen per bostad och delrum. fx = funktionsmöbel (kan flyttas, inte säljas).
const SEEDS = {
  'rum:0': [
    { k: 'sang', v: 0, x: 18, y: 133, fx: 1 }, { k: 'garderob', v: 0, x: 140, y: 96, fx: 1 },
    { k: 'kylskap', v: 0, x: 190, y: 94, fx: 1 },
  ],
  'lagenhet:0': [
    { k: 'kylskap', v: 0, x: 214, y: 94, fx: 1 },
    { k: 'soffa', v: 4, x: 106, y: 179 }, { k: 'bordR', v: 0, x: 150, y: 196 }, { k: 'vaxt', v: 0, x: 270, y: 206 },
  ],
  'lagenhet:1': [
    { k: 'sang', v: 2, x: 40, y: 133, fx: 1 }, { k: 'garderob', v: 0, x: 196, y: 96, fx: 1 },
    { k: 'byra', v: 1, x: 120, y: 96 },
  ],
  'villa:0': [
    { k: 'soffa', v: 0, x: 112, y: 182 }, { k: 'fatolj', v: 3, x: 164, y: 166 }, { k: 'bordR', v: 0, x: 150, y: 200 },
    { k: 'tv', v: 0, x: 176, y: 151 }, { k: 'bokhylla', v: 0, x: 180, y: 96 }, { k: 'spis', v: 1, x: 336, y: 131 },
    { k: 'lampa', v: 0, x: 320, y: 151 }, { k: 'vaxt', v: 0, x: 48, y: 151 }, { k: 'matta', v: 0, x: 100, y: 156 },
  ],
  'villa:1': [
    { k: 'sang', v: 1, x: 40, y: 133, fx: 1 }, { k: 'garderob', v: 0, x: 250, y: 96, fx: 1 },
    { k: 'byra', v: 3, x: 160, y: 96 }, { k: 'spegel', v: 0, x: 220, y: 94 }, { k: 'matta', v: 1, x: 80, y: 150 },
  ],
  'villa:2': [
    { k: 'kylskap', v: 0, x: 300, y: 94, fx: 1 },
    { k: 'bordM', v: 0, x: 130, y: 160 }, { k: 'stol', v: 0, x: 110, y: 158 }, { k: 'stol', v: 0, x: 188, y: 158 },
    { k: 'byra', v: 0, x: 60, y: 96 }, { k: 'vaxtS', v: 0, x: 340, y: 140 },
  ],
};
const seedFor = (home, sub) => (SEEDS[`${home}:${sub}`] || []).map((d) => ({ ...d }));

// hur hög kollisionsrektangeln vid foten är, per möbeltyp
const SOLID_LOW = new Set(['soffa', 'fatolj', 'stol', 'bordR', 'bordM', 'byra', 'sang']);
const frameOf = (k, v) => FRAMES[k + (v | 0)] || FRAMES[k + '0'];
const frameName = (k, v) => (FRAMES[k + (v | 0)] ? k + (v | 0) : k + '0');

// ---------- möbelbilder (atlas, omfärgade eller mattor) ----------
// Tips till omfärgningen där huvudmaterialet inte är det största: krukväxten
// ska få ny kruka (inte nya blad), silverspegeln ny ram (inte nytt glas),
// golvlampan ny skärm (foten blir en mörkare ton av samma färg).
const TINT_HINT = { vaxtS0: { hue: 24 }, spegel2: { maxL: 0.5 }, lampa0: { minL: 0.8 } };
export const canRecolor = (k) => k !== 'vaxt'; // monsteran är ritad för hand, inte ur atlasen
// Möbeln k/v i färgen c (null = original): { img, sx, sy, sw, sh } att rita
// i heltalsskala, eller null om atlasen inte har laddats än.
export function furnArt(k, v, c = null) {
  if (k === 'matta') return { img: rugImg(v, c), sx: 0, sy: 0, sw: RUG.w, sh: RUG.h };
  const f = frameOf(k, v);
  if (!f || !ATLAS?.complete) return null;
  const t = isHex(c) ? tintSprite(ATLAS, f, c, TINT_HINT[frameName(k, v)]) : null;
  return t ? { img: t, sx: 0, sy: 0, sw: f[2], sh: f[3] } : { img: ATLAS, sx: f[0], sy: f[1], sw: f[2], sh: f[3] };
}
// möbelns originalkulör (till "Original"-rutan i färgvalet)
export function furnBaseColor(k, v) {
  if (k === 'matta') return (v | 0) === 1 ? '#3f5667' : '#5e1622';
  const f = frameOf(k, v);
  return f && ATLAS?.complete ? spriteBaseColor(ATLAS, f, TINT_HINT[frameName(k, v)]) : null;
}

export function makeRoom(A, { visit = false } = {}) {
  const g = A.game;
  const home = visit ? A.visitTarget?.home || 'rum' : g.home;
  const plan = PLANS[home] || PLANS.rum;
  const sub = Math.max(0, Math.min(plan.rooms.length - 1, A.roomSub | 0));
  A.roomSub = sub;
  const roomDef = plan.rooms[sub];
  const RIGHT = plan.partition || FW;
  const decoKey = `${home}:${sub}`;

  // deco-listan: min egen (seedas vid behov) eller värdens (read-only)
  function decoList() {
    if (visit) return A.visitTarget?.deco?.[decoKey] || seedFor(home, sub);
    if (!g.deco[decoKey]) { g.deco[decoKey] = seedFor(home, sub); g.save(); }
    return g.deco[decoKey];
  }

  // ---------- delrumsdörrar + bakgrund ----------
  const subDoors = plan.rooms.map((r, i) => i).filter((i) => i !== sub)
    .map((i, n) => ({ to: i, name: plan.rooms[i].name, x0: RIGHT - 48 - n * 44, x1: RIGHT - 18 - n * 44 }));
  const bg = buildBg(roomDef, RIGHT, subDoors, sub === 0, !!plan.lyx, visit);

  // ---------- props byggs ur deco (görs om efter varje ändring) ----------
  let props = [], rugs = [], obstacles = [], hotRects = [], freeGrid;
  const CELL = 4, GW = Math.ceil(FW / CELL), GH = Math.ceil(FH / CELL);

  const acts = {
    sang: visit ? null : () => A.sleepFlow(),
    garderob: visit ? null : () => { play('click'); openAvatarEditor({ onDone: (av) => { A.avatar = av; toast('👕 Snyggt!', 'good'); } }); },
    kylskap: visit ? null : () => openFridge(A),
  };
  const exitAct = visit
    ? () => { A.visitTarget = null; A.roomSub = 0; g.passTime(20); g.save(); play('door'); toast('🚗 Hemma igen.'); A.go('city'); }
    : () => { A.roomSub = 0; play('door'); A.go('city'); };

  function rebuild() {
    props = []; rugs = [];
    decoList().forEach((d, i) => {
      if (decor.carry && decor.carry.src === 'deco' && decor.carry.idx === i) return; // lyftad just nu
      if (d.k === 'matta') { rugs.push({ d, idx: i, img: rugImg(d.v, d.c) }); return; }
      if (d.k === 'vaxt') { props.push({ ...makePlantProp(d.x + 10, d.y), k: 'vaxt', decoIdx: i, fx: d.fx }); return; }
      const p = spriteProp(d, i, !visit);
      if (p) props.push(p);
    });
    obstacles = props.map((p) => p.solid).filter(Boolean);
    freeGrid = new Uint8Array(GW * GH);
    for (let gy = 0; gy < GH; gy++) for (let gx = 0; gx < GW; gx++) {
      const x = gx * CELL + 2, y = gy * CELL + 2;
      let ok = x > 7 && x < RIGHT - 5 && y > WALL_Y + 4 && y < FH - 4;
      if (ok) for (const [x0, y0, x1, y1] of obstacles) if (x > x0 - 2 && x < x1 + 2 && y > y0 - 2 && y < y1 + 2) { ok = false; break; }
      freeGrid[gy * GW + gx] = ok ? 1 : 0;
    }
    hotRects = [];
    if (sub === 0) hotRects.push({ id: 'dorr', act: exitAct, r: [DOOR.x0, 30, DOOR.x1, WALL_Y + 9], go: [DOOR.cx, WALL_Y + 12] });
    for (const sd of subDoors) hotRects.push({ id: 'sub' + sd.to, act: () => { A.roomSub = sd.to; play('door'); A.go(A.sceneName); }, r: [sd.x0, 34, sd.x1, WALL_Y + 6], go: [(sd.x0 + sd.x1) / 2, WALL_Y + 12] });
    for (const p of props) {
      if (!p.solid) continue;
      const act = acts[p.k];
      if (act === undefined || act === null) continue;
      hotRects.push({ id: p.k, act, r: [p.solid[0], p.top, p.solid[2], p.solid[3] + 2], go: [(p.solid[0] + p.solid[2]) / 2, p.solid[3] + 5] });
    }
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
    if (!from.has(goal)) return [[tx, ty]].filter(() => los(sx, sy, tx, ty));
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

  // ---------- möblera-läget ----------
  const decor = { on: false, carry: null, mx: 100, my: 150 };
  function canPlace(k, v, x, y) {
    if (k === 'matta') {
      const x0 = x - RUG.w / 2, y0 = y - RUG.h / 2;
      return x0 >= 6 && x0 + RUG.w <= RIGHT - 4 && y0 >= WALL_Y + 2 && y0 + RUG.h <= FH - 3;
    }
    const f = k === 'vaxt' ? [0, 0, 20, 52] : frameOf(k, v);
    const w = f[2], left = Math.round(x - w / 2), base = Math.round(y);
    const solidH = SOLID_LOW.has(k) ? Math.round(f[3] * 0.5) : Math.min(13, Math.round(f[3] * 0.4));
    if (left < 8 || left + w > RIGHT - 5 || base < WALL_Y + 6 || base > FH - 4) return false;
    const s = [left - 1, base - solidH, left + w + 1, base + 1];
    for (const h of hotRects) if (h.id.startsWith('sub') || h.id === 'dorr') {
      if (s[2] > h.r[0] - 2 && s[0] < h.r[2] + 2 && s[3] > WALL_Y && s[1] < h.r[3] + 6) return false;
    }
    for (const o of obstacles) if (s[2] > o[0] && s[0] < o[2] && s[3] > o[1] && s[1] < o[3]) return false;
    return true;
  }
  function commitPlace() {
    const c = decor.carry;
    const k = c.k, v = c.v;
    const pos = k === 'matta'
      ? { x: Math.round(decor.mx - RUG.w / 2), y: Math.round(decor.my - RUG.h / 2) }
      : { x: Math.round(decor.mx - (k === 'vaxt' ? 10 : frameOf(k, v)[2] / 2)), y: Math.round(decor.my) };
    if (c.src === 'storage') g.placeFromStorage(c.idx, sub, pos.x, pos.y);
    else g.moveDeco(sub, c.idx, pos.x, pos.y);
    decor.carry = null;
    rebuild(); renderStoragePanel();
  }
  function toggleDecor(force) {
    if (visit) return;
    decor.on = force !== undefined ? force : !decor.on;
    if (!decor.on && decor.carry) { decor.carry = null; rebuild(); } // lyft möbel läggs tillbaka (låg kvar i listan)
    document.querySelector('#decor-panel')?.classList.toggle('hidden', !decor.on);
    if (decor.on) { renderStoragePanel(); toast('🛋️ Möblera: klicka på en möbel för att flytta, eller välj ur förrådet.'); }
    else g.save();
  }
  function renderStoragePanel() {
    const box = document.querySelector('#decor-storage');
    if (!box) return;
    box.innerHTML = g.storage.length
      ? g.storage.map((it, i) => {
        const kat = katalogOf(it.k);
        return `<button class="dp-item" data-st="${i}"><span data-thumb="${i}"></span>${kat?.name || it.k}</button>`;
      }).join('')
      : '<div class="dp-empty">Tomt – köp möbler i möbelvaruhuset!</div>';
    box.querySelectorAll('[data-thumb]').forEach((el) => { const it = g.storage[+el.dataset.thumb]; el.replaceWith(thumbCanvas(it.k, it.v, it.c)); });
    box.querySelectorAll('[data-st]').forEach((b) => (b.onclick = () => {
      const it = g.storage[+b.dataset.st];
      if (!it) return;
      decor.carry = { src: 'storage', idx: +b.dataset.st, k: it.k, v: it.v, c: it.c };
      updateSellBtn();
    }));
    updateSellBtn();
  }
  function updateSellBtn() {
    const c = decor.carry;
    document.querySelectorAll('#decor-storage [data-st]').forEach((b) => b.classList.toggle('on', c?.src === 'storage' && +b.dataset.st === c.idx));
    const paintBtn = document.querySelector('#decor-paint');
    if (paintBtn) {
      paintBtn.disabled = !c || !canRecolor(c.k);
      paintBtn.title = c ? (canRecolor(c.k) ? 'Måla om möbeln du håller i – gratis' : 'Den här går inte att måla om') : 'Välj en möbel först';
      paintBtn.onclick = () => paintCarry();
    }
    const btn = document.querySelector('#decor-sell');
    if (!btn) return;
    const sellable = c && (c.src === 'storage' || !decoList()[c.idx]?.fx) && katalogOf(c.k);
    btn.disabled = !sellable;
    btn.textContent = sellable ? `Sälj +${Math.round(katalogOf(c.k).price / 2)} kr` : 'Sälj';
    btn.onclick = () => {
      if (!sellable) return;
      if (c.src === 'storage') g.sellStorage(c.idx); else g.sellDeco(sub, c.idx);
      play('coin');
      decor.carry = null;
      rebuild(); renderStoragePanel();
    };
    const done = document.querySelector('#decor-done');
    if (done) done.onclick = () => toggleDecor(false);
  }
  // 🎨 Färg: samma färgval som i varuhuset, för möbeln man håller i – gratis.
  // (Dialogen laddas vid behov så att room.js och shop-mobler.js inte
  // importerar varandra.)
  function paintCarry() {
    const c = decor.carry;
    if (!c || !canRecolor(c.k)) return;
    play('click');
    import('./shop-mobler.js').then((m) => m.openRecolor(A, { kind: c.k, v: c.v, c: c.c, onPick: (hex) => {
      const ok = c.src === 'storage' ? g.recolorStorage(c.idx, hex) : g.recolorDeco(sub, c.idx, hex);
      if (!ok) return;
      c.c = hex || undefined;
      play('ok');
      toast(hex ? '🎨 Nymålad!' : '🎨 Tillbaka i originalfärgen.', 'good');
      rebuild(); renderStoragePanel();
    } }));
  }

  // ---------- figuren ----------
  rebuild();
  let px = visit ? DOOR.cx : Math.min(RIGHT - 40, 100), py = WALL_Y + 34;
  [px, py] = nearestFree(px, py);
  let path = [], onArrive = null, dir = 'down', t = 0;
  function walkTo(x, y, cb) { path = findPath(px, py, x, y); onArrive = cb || null; if (!path.length) { const d = onArrive; onArrive = null; d?.(); } }

  return {
    get worldX() { return px; },
    get worldY() { return py; },
    toggleDecor,
    _debug: {
      spot: (id) => { const h = hotRects.find((h) => h.id === id); return h ? { x: (h.r[0] + h.r[2]) / 2, y: (h.r[1] + h.r[3]) / 2 } : null; },
      tile: (a, b) => ({ x: Math.min(RIGHT - 20, 30 + a * 40), y: Math.min(FH - 10, WALL_Y + 15 + b * 18) }),
    },

    update(dt) {
      t += dt;
      if (path.length) {
        const [gx, gy] = path[0];
        const dx = gx - px, dy = gy - py, dist = Math.hypot(dx, dy), step = 62 * dt;
        dir = Math.abs(dx) > Math.abs(dy) * 1.2 ? (dx < 0 ? 'left' : 'right') : dy < 0 ? 'up' : 'down';
        if (dist <= step) {
          px = gx; py = gy;
          path.shift();
          if (!path.length) { dir = 'down'; const cb = onArrive; onArrive = null; cb?.(); }
        } else { px += dx / dist * step; py += dy / dist * step; }
      }
      if (visit && !A.visitTarget) A.go('city');
    },

    move(x, y) { decor.mx = x; decor.my = y; },
    down(x, y) {
      decor.mx = x; decor.my = y;
      if (decor.on) {
        if (decor.carry) { if (canPlace(decor.carry.k, decor.carry.v, x, y)) { play('ok'); commitPlace(); } else play('fel'); return; }
        // plocka upp möbeln under pekaren (främst sorterad först)
        const list = decoList();
        const hit = [...props, ...rugs.map((r) => ({ decoIdx: r.idx, k: 'matta', top: r.d.y, solid: [r.d.x, r.d.y, r.d.x + RUG.w, r.d.y + RUG.h] }))]
          .filter((p) => p.decoIdx !== undefined)
          .sort((a, b) => (b.solid?.[3] ?? 0) - (a.solid?.[3] ?? 0))
          .find((p) => { const r = p.k === 'matta' ? p.solid : [p.solid[0], p.top, p.solid[2], p.solid[3] + 2]; return x >= r[0] && x <= r[2] && y >= r[1] && y <= r[3]; });
        if (hit) {
          const d = list[hit.decoIdx];
          decor.carry = { src: 'deco', idx: hit.decoIdx, k: d.k, v: d.v, c: d.c, fx: d.fx };
          rebuild(); updateSellBtn();
        }
        return;
      }
      for (const h of hotRects) {
        if (x >= h.r[0] && x <= h.r[2] && y >= h.r[1] && y <= h.r[3]) {
          walkTo(h.go[0], h.go[1], h.act || undefined);
          return;
        }
      }
      if (y > WALL_Y && x < RIGHT) walkTo(x, y);
    },
    key(k) { if (k === 'Escape' && decor.on) toggleDecor(false); },
    exit() { toggleDecor(false); document.querySelector('#decor-panel')?.classList.add('hidden'); },

    draw(ctx) {
      ctx.setTransform(A.pxs, 0, 0, A.pxs, 0, 0);
      const night = isNight(g);
      ctx.drawImage(bg(night), 0, 0);
      for (const r of rugs) ctx.drawImage(r.img, r.d.x, r.d.y);

      const folks = worldFolksHere(A);
      const drawables = props.map((p) => ({ fy: p.sort, draw: () => p.draw(ctx) }));
      const mine = worldMyEmote();
      drawables.push({ fy: py, draw: () => {
        const frame = path.length ? WALK_SEQ[Math.floor(t * 8.5) % 4] : (Math.sin(t * 2) > 0.9 ? 4 : 0);
        drawPerson(ctx, px, py, A.avatar.look, dir, frame);
        if (folks.length) nameTag(ctx, px, py - 50, A.avatar);
        if (mine) emoteBubble(ctx, px, py - 60, mine);
      } });
      for (const f of folks) {
        drawables.push({ fy: f.y, draw: () => {
          drawPerson(ctx, f.x, f.y, f.av.look, 'down', f.walking ? WALK_SEQ[Math.floor(t * 8.5) % 4] : (Math.sin(t * 2 + f.x) > 0.9 ? 4 : 0));
          nameTag(ctx, f.x, f.y - 50, f.av);
          if (f.emote) emoteBubble(ctx, f.x, f.y - 60, f.emote);
        } });
      }
      drawables.sort((a, b) => a.fy - b.fy).forEach((d) => d.draw(ctx));

      // spöket i möblera-läget
      if (decor.on && decor.carry) {
        const { k, v, c } = decor.carry;
        const okHere = canPlace(k, v, decor.mx, decor.my);
        ctx.globalAlpha = 0.7;
        if (k === 'matta') ctx.drawImage(rugImg(v, c), decor.mx - RUG.w / 2 | 0, decor.my - RUG.h / 2 | 0);
        else if (k === 'vaxt') { const p = makePlantProp(decor.mx | 0, decor.my | 0); p.draw(ctx); }
        else { const a = furnArt(k, v, c); if (a) ctx.drawImage(a.img, a.sx, a.sy, a.sw, a.sh, decor.mx - a.sw / 2 | 0, decor.my - a.sh | 0, a.sw, a.sh); }
        ctx.globalAlpha = 1;
        ctx.fillStyle = okHere ? 'rgba(80,220,110,0.8)' : 'rgba(230,60,60,0.8)';
        ctx.fillRect(decor.mx - 6 | 0, decor.my | 0, 12, 2);
      } else if (decor.on) {
        ctx.fillStyle = 'rgba(23,21,26,0.7)'; ctx.fillRect(4, 4, 150, 10);
        ctxText(ctx, SMALL, 'MÖBLERA: KLICKA PÅ EN MÖBEL', 7, 6, '#ffd23f');
      }

      if (night) { ctx.fillStyle = 'rgba(10,12,40,0.22)'; ctx.fillRect(0, 0, FW, FH); }
    },
  };
}

const isNight = (g) => { const h = g.min / 60; return h >= 19.5 || h < 6.5; };

// ---------- sprite-props ----------
function spriteProp(d, decoIdx, sign) {
  const f = frameOf(d.k, d.v);
  if (!f) return null;
  const [fx, fy, fw, fh] = f;
  const x = d.x, base = d.y, top = base - fh;
  const solidH = SOLID_LOW.has(d.k) ? Math.round(fh * 0.5) : Math.min(13, Math.round(fh * 0.4));
  const label = sign ? { sang: 'SÄNG', garderob: 'GARDEROB', kylskap: 'KYLSKÅP' }[d.k] : null;
  return {
    k: d.k, decoIdx, fx: d.fx, sort: base, top,
    solid: [x - 1, base - solidH, x + fw + 1, base + 1],
    draw(ctx) {
      ctx.fillStyle = 'rgba(20,12,28,0.22)';
      ctx.fillRect(x + 1, base - 1, fw - 2, 2);
      ctx.fillRect(x + 3, base + 1, fw - 6, 1);
      if (ATLAS && ATLAS.complete) {
        const t = isHex(d.c) ? tintSprite(ATLAS, f, d.c, TINT_HINT[frameName(d.k, d.v)]) : null; // cachad per (ruta, färg)
        if (t) ctx.drawImage(t, x, top); else ctx.drawImage(ATLAS, fx, fy, fw, fh, x, top, fw, fh);
      }
      if (label) ctxPlate(ctx, x + fw / 2, top - 9, label);
    },
  };
}
function ctxPlate(ctx, cx, y, label) {
  const w = textW(SMALL, label) + 6;
  ctx.fillStyle = '#8a6a2a'; ctx.fillRect(cx - w / 2 - 1 | 0, y - 1, w + 2, 9);
  ctx.fillStyle = '#d8b85a'; ctx.fillRect(cx - w / 2 | 0, y, w, 7);
  ctxText(ctx, SMALL, label, (cx - textW(SMALL, label) / 2) | 0, y + 1, '#3a2a10');
}
// miniatyr till förrådspanelen (DOM) – i färgen c. Pixelkonst i heltalsskala:
// små möbler dubbelt så stora, stora i 1:1 (mattan beskärs till ett hörn).
const THUMB = { w: 52, h: 44 };
function thumbCanvas(k, v, c) {
  const cv = document.createElement('canvas');
  cv.width = THUMB.w; cv.height = THUMB.h;
  const x = cv.getContext('2d');
  x.imageSmoothingEnabled = false;
  const draw = () => {
    const a = furnArt(k, v, c);
    if (!a) return;
    const s = a.sw * 2 <= THUMB.w && a.sh * 2 <= THUMB.h ? 2 : 1;
    const w = Math.min(a.sw, THUMB.w / s | 0), h = Math.min(a.sh, THUMB.h / s | 0);
    cv.width = w * s; cv.height = h * s;
    x.imageSmoothingEnabled = false;
    x.drawImage(a.img, a.sx, a.sy, w, h, 0, 0, w * s, h * s);
  };
  if (ATLAS.complete) draw(); else ATLAS.addEventListener('load', draw, { once: true });
  return cv;
}

// mattor: två mönster (museum/rand), valfri bottenfärg c – cachade
const rugCache = new Map();
function rugImg(v, c) {
  const key = `${v | 0}|${isHex(c) ? c.toLowerCase() : ''}`;
  if (rugCache.has(key)) return rugCache.get(key);
  const P = new Pix(RUG.w, RUG.h);
  const own = isHex(c) ? parseInt(c.slice(1), 16) : null;
  if ((v | 0) === 1) paintRug(P, 0, 0, RUG.w, RUG.h, own ?? 0x3f5667, 0xd9d2c3, 'stripe');
  else paintRug(P, 0, 0, RUG.w, RUG.h, own ?? 0x5e1622, 0xd8b24a, 'museum');
  if (rugCache.size > 120) rugCache.delete(rugCache.keys().next().value); // egen färg kan ge många
  rugCache.set(key, P.flush());
  return rugCache.get(key);
}
function paintRug(P, x0, y0, x1, y1, base, trim, kind) {
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    const bx = Math.min(x - x0, x1 - 1 - x), by = Math.min(y - y0, y1 - 1 - y), b = Math.min(bx, by);
    let c = mul(base, 0.95 + hash(x, y, 11) * 0.08);
    if (b === 0) c = mul(base, 0.6);
    else if (b === 2) c = trim;
    else if (kind === 'museum' && b > 4) {
      const u = Math.abs(((x - x0) % 12) - 6) + Math.abs(((y - y0) % 10) - 5);
      if (u === 4) c = mix(base, trim, 0.45);
      if (u === 0) c = trim;
    } else if (kind === 'stripe' && b > 3 && ((y - y0) >> 1) % 3 === 0) c = mix(base, trim, 0.18);
    if (b === 1 && (x + y) % 2) c = mix(c, 0x000000, 0.2);
    P.px(x, y, c);
  }
}

// Monsteran (Pix)
function makePlantProp(cx, base) {
  const P = new Pix(40, 54, cx - 20, base - 52);
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
  const ox = cx - 20, oy = base - 52;
  return { img, sort: base, top: oy, solid: [cx - 9, base - 12, cx + 9, base + 1], draw: (ctx) => ctx.drawImage(img, ox, oy) };
}

// ================= bakgrunden (per delrum + dag/natt) =================
function buildBg(roomDef, RIGHT, subDoors, hasExit, lyx, visit) {
  const cache = {};
  return (night) => {
    const key = night ? 'n' : 'd';
    if (cache[key]) return cache[key];
    const P = new Pix(FW, FH);
    const wall = night ? mul(roomDef.wall, 0.8) : roomDef.wall;
    const wallDk = night ? mul(roomDef.wallDk, 0.8) : roomDef.wallDk;

    // golvet
    const TW2 = 23, TH2 = 15;
    for (let y = WALL_Y; y < FH; y++) for (let x = 0; x < FW; x++) {
      const tx = (x / TW2) | 0, ty = ((y - WALL_Y) / TH2) | 0;
      const lx = x - tx * TW2, ly = (y - WALL_Y) - ty * TH2;
      let c = mix(roomDef.floorA, roomDef.floorB, ((tx + ty) & 1) ? 0.2 : 0.62);
      c = mul(c, 0.97 + hash(tx, ty, 1) * 0.05);
      const h = hash(x, y, 2);
      if (h > 0.94) c = mul(c, 0.95); else if (h < 0.02) c = mix(c, 0xffffff, 0.25);
      if (lyx) { const vein = Math.sin(x * 0.31 + y * 0.55 + Math.sin(x * 0.09) * 4); if (vein > 0.96) c = mix(c, 0xd8b24a, 0.22); }
      if (lx === 0 || ly === 0) c = mul(c, 0.84);
      else if (lx === 1 || ly === 1) c = mix(c, 0xffffff, 0.2);
      else if (lx + ly > 7 && lx + ly < 9 && ly < 6) c = mix(c, 0xffffff, 0.07);
      P.px(x, y, c);
    }

    // väggen med bröstpanel
    for (let y = 5; y < WALL_Y; y++) for (let x = 4; x < FW - 4; x++) {
      let c = mix(mul(wall, 0.8), wall, Math.min(1, (y - 5) / 20) + (bayer(x, y) - 0.5) * 0.12);
      if (x % 27 === 0) c = mul(c, 0.9); else if (x % 27 === 1) c = mix(c, 0xffffff, 0.05);
      if (y >= WALL_Y - 19) {
        const bx = (x - 4) % 24, by = y - (WALL_Y - 19);
        c = wallDk;
        if (by === 0) c = mul(wallDk, 0.75);
        else if (bx === 2 || by === 2) c = mix(wallDk, 0xffffff, 0.12);
        else if (bx === 22 || by === 17) c = mul(wallDk, 0.8);
        c = mix(c, wallDk, (bayer(x, y) - 0.5) * 0.2 + 0.15);
      }
      if (y >= WALL_Y - 2) c = mul(wallDk, 0.55);
      P.px(x, y, c);
    }
    P.hl(4, 5, FW - 8, mul(wall, 0.6));
    P.hl(4, WALL_Y - 2, FW - 8, mix(wallDk, 0xffffff, 0.25));
    if (lyx) { P.hl(4, WALL_Y - 20, FW - 8, 0xf0d070); P.hl(4, WALL_Y - 19, FW - 8, 0xc8a24a); }

    // dörrarna: ut (bara rum 0) + delrumsdörrar
    const paintDoor = (x0, x1, signText, signCol) => {
      for (let y = 28; y < WALL_Y; y++) for (let x = x0; x < x1; x++) {
        let c = mix(0x5a4632, 0x6a5238, hash(x >> 1, y >> 2, 7) * 0.6 + (bayer(x, y) - 0.5) * 0.1);
        if ((y - 28) % 22 < 2 || x === x0 + ((x1 - x0) >> 1)) c = mul(c, 0.7);
        P.px(x, y, c);
      }
      P.box(x0 - 1, 27, x1 - x0 + 2, WALL_Y - 27, 0x2e2418);
      P.box(x0, 28, x1 - x0, WALL_Y - 28, 0x8a7050);
      P.rect(x1 - 6, 54, 2, 4, 0xd8b24a);
      const tw = textW(SMALL, signText) + 8;
      const sx = Math.round((x0 + x1) / 2 - tw / 2);
      P.rect(sx, 20, tw, 9, 0x1d2b1f); P.box(sx, 20, tw, 9, 0x0e1510);
      text(P, SMALL, signText, sx + 4, 22, signCol);
    };
    if (hasExit) {
      paintDoor(DOOR.x0, DOOR.x1, visit ? 'HEM' : 'UT', 0x6fe08a);
      for (let y = WALL_Y + 1; y < WALL_Y + 9; y++) for (let x = DOOR.cx - 13; x < DOOR.cx + 13; x++) P.px(x, y, (x + y) % 2 ? 0x4a4038 : 0x3e352e);
      P.box(DOOR.cx - 13, WALL_Y + 1, 26, 8, 0x2a2018);
    }
    for (const sd of subDoors) paintDoor(sd.x0, sd.x1, sd.name, 0xffd23f);

    // fönster
    const sky0 = night ? 0x101838 : 0x8ed0ea, sky1 = night ? 0x1c2140 : 0xbfe6f2;
    for (const [wx0, wx1] of roomDef.windows) {
      if (wx1 > RIGHT - 5 || subDoors.some((sd) => wx1 > sd.x0 - 4 && wx0 < sd.x1 + 4)) continue;
      const wy0 = 17, wy1 = 49;
      P.rect(wx0 - 2, wy0 - 2, wx1 - wx0 + 4, wy1 - wy0 + 4, 0xf0ece0);
      P.box(wx0 - 2, wy0 - 2, wx1 - wx0 + 4, wy1 - wy0 + 4, mul(wall, 0.5));
      for (let y = wy0; y < wy1; y++) for (let x = wx0; x < wx1; x++) {
        let c = mix(sky0, sky1, (y - wy0) / (wy1 - wy0) + (bayer(x, y) - 0.5) * 0.08);
        if (!night && hash(x >> 2, y >> 1, 9) > 0.93) c = mix(c, 0xffffff, 0.5);
        if (night && hash(x, y, 10) > 0.985) c = 0xe8ecff;
        P.px(x, y, c);
      }
      P.rect(wx0, (wy0 + wy1 >> 1), wx1 - wx0, 1, 0xf0ece0);
      P.rect((wx0 + wx1 >> 1), wy0, 1, wy1 - wy0, 0xf0ece0);
      P.hl(wx0 - 2, wy1 + 2, wx1 - wx0 + 4, 0xd8d2c2);
      if (!night) for (let y = WALL_Y; y < WALL_Y + 30; y++) {
        const s = (y - WALL_Y) * 0.5, fade = 1 - (y - WALL_Y) / 30;
        for (let x = Math.round(wx0 + s); x < wx1 + s; x++) if (bayer(x, y) < fade * 0.85) P.px(x, y, 0xfff6dc, 0.1);
      }
    }

    // avdelarvägg + mörker utanför lokalen
    if (RIGHT < FW) {
      for (let y = 5; y < FH; y++) for (let x = RIGHT; x < FW; x++) P.px(x, y, mix(0x17131c, 0x221c28, (bayer(x, y) - 0.5) * 0.4 + 0.5));
      for (let y = 5; y < FH; y++) {
        P.px(RIGHT - 3, y, mul(wallDk, 0.5)); P.px(RIGHT - 2, y, mix(wallDk, 0xffffff, 0.15));
        P.px(RIGHT - 1, y, wallDk);
      }
    }

    // ljuskäglor + AO
    for (let sx = 60; sx < RIGHT - 20; sx += 85) P.ell(sx, WALL_Y + 23, 22, 10, 0xfff3d0, night ? 0.05 : 0.1, 4);
    for (let y = WALL_Y; y < WALL_Y + 4; y++) for (let x = 0; x < RIGHT; x++) {
      if (hasExit && x >= DOOR.cx - 13 && x < DOOR.cx + 13) continue;
      if (bayer(x, y) < 1 - (y - WALL_Y) / 4) P.px(x, y, 0x1a1426, 0.18);
    }
    P.box(0, 0, FW, FH, 0x0e0d12); P.box(1, 1, FW - 2, FH - 2, 0x1d1a20);
    for (let x = 0; x < FW; x++) for (let y = 0; y < 5; y++) P.px(x, y, 0x14121a);

    cache[key] = P.flush();
    return cache[key];
  };
}

function nameTag(ctx, x, y, av) {
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
