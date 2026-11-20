// 🧸 DOCKSKÅPET – lekläget (Carl 2026-11-21: "ett mode där man likt Toca Boca kan möblera …
// vi vill ha med husdjuren och allt sådant … lägg som ett menyval på första sidan").
// Ett eget hus med fem rum i rad (vardagsrum, kök, barnrum, sovrum, badrum) som man möblerar
// fritt: hela möbelkatalogen ligger i lådan, gratis, och allt dras med fingret – från lådan in
// i rummet, mellan rummen och upp på borden. Inga pengar, ingen klocka, inga behov: spelet
// (A.game) står still medan man leker (main.js tickReal hoppar över scener med .dockskap).
// Huset sparas för sig i localStorage (DOCK_KEY), utanför sparfilen, och syns inte i världen.
//   • Rummen ritas som hemma (room.js buildBg, spriteProp, wallProp …) med samma möbelbilder,
//     rotationer, omfärgning, bordsskivor att ställa småsaker på (ON_TABLE/SURFACES) och brasor.
//   • Tryck och dra på en möbel = flytta den (också till ett annat rum – det som står på ett
//     bord följer med). Ett kort tryck = menyn: vrid, byt modell, färg, tänd, ta bort.
//     Dra i tomrummet = panorera; rumsknapparna i lådan hoppar till ett rum.
//   • Lådan: dra en möbel från lådan rakt in i rummet, eller tryck på den och sedan i rummet.
//   • 🌙 Natt: lamporna tänds och rummen mörknar (room.js light).
//   • Dörren UT i första rummet och ⬅ i lådan går tillbaka dit man kom ifrån (A.leaveDockskap).
// Kommande: figurerna (dockorna), husdjuren och deras prylar, lösa saker (mat, leksaker),
// tapet- och golvbyten. Test: tools/dockskap-test.mjs.
import { buildBg, spriteProp, wallProp, flatProp, rugImg, makePlantProp, dimsOf, isWall, isFlat, ON_TABLE, SURFACES, surfaceRow,
  thumbCanvas, furnView, drawArt, nameOf, canRecolor, FW, FH, WALL_Y, WALL_TOP, DOOR, RUG, APT } from './room.js';
import { KATALOG, katalogOf, knownKind, rotStates, functionOf } from '../game.js';
import { VISNING } from '../core/visning.js';
import { openModal, closeModal, toast } from '../core/ui.js';
import { play } from '../core/sound.js';
import { mix, css } from '../core/floor-pix.js';
import { $t, $n } from '../core/i18n.js';

export const DOCK_KEY = 'snabbfilen_dockskap';
const WALLW = APT.WALLW;
const NIGHT_DIM = 0.22;
const MAX_I_RUM = 60;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// Husets rum (samma fält som room.js PLANS): ljusa, glada färger – badrummet sist.
export const RUM = [
  { id: 'vardagsrum', ik: '🛋️', name: $n('VARDAGSRUM'), wall: 0xf2d6a0, wallDk: 0xc49c62, floorA: 0xe4cfa8, floorB: 0xcab088, windows: [[80, 130], [250, 300]], view: 'tradgard' },
  { id: 'kok', ik: '🍳', name: $n('KÖK'), wall: 0xcfe6c4, wallDk: 0x86ae82, floorA: 0xe6e8dc, floorB: 0xc6ccbe, windows: [[150, 190], [250, 290]], view: 'tradgard' },
  { id: 'barnrum', ik: '🧸', name: $n('BARNRUM'), wall: 0xf6cfe0, wallDk: 0xc088a8, floorA: 0xf0e2cc, floorB: 0xd8c8ae, windows: [[90, 140], [240, 290]], view: 'sky' },
  { id: 'sovrum', ik: '🛏️', name: $n('SOVRUM'), wall: 0xc4d6f0, wallDk: 0x8099c2, floorA: 0xe8ded0, floorB: 0xd2c4b2, windows: [[120, 170], [300, 350]], view: 'sky' },
  { id: 'badrum', ik: '🛁', name: $n('BADRUM'), bath: true, tiles: 'bla', wall: 0xa6cfe0, wallDk: 0x7aa4b8, floorA: 0xf0eee8, floorB: 0x6a9ec0, windows: [[150, 186], [250, 286]], winY: [16, 38], view: 'frost', towels: [128, 312], lamp: 'plafond' },
];
const PLAN = { partition: 0, rooms: RUM };

// Startmöbleringen (x = vänsterkant, y = fotlinje; mattan överkant; väggsaker underkant) – det
// som inte finns i arket hoppas över, och allt kläms innanför rummet (klamma).
const SEED = [
  [{ k: 'matta', v: 0, x: 130, y: 118 }, { k: 'soffa', v: 0, x: 150, y: 152 }, { k: 'soffbord', v: 0, x: 152, y: 172 }, { k: 'fatolj', v: 0, x: 104, y: 150 },
    { k: 'lampa', v: 0, x: 216, y: 150 }, { k: 'bokhylla', v: 0, x: 290, y: 122 }, { k: 'blomtavla', v: 0, x: 170, y: 72 }, { k: 'vaxtS', v: 0, x: 340, y: 150 }],
  [{ k: 'kyl', v: 0, x: 24, y: 122 }, { k: 'koksspis', v: 0, x: 66, y: 122 }, { k: 'diskbank', v: 0, x: 104, y: 122 }, { k: 'overskap', v: 0, x: 66, y: 60 },
    { k: 'bordM', v: 0, x: 200, y: 166 }, { k: 'matstol', v: 0, x: 182, y: 168 }, { k: 'matstol', v: 0, x: 256, y: 168 }, { k: 'fruktskal', v: 0, x: 218, y: 167 }],
  [{ k: 'lillmatta', v: 0, x: 150, y: 190 }, { k: 'enkelsang', v: 0, x: 40, y: 150 }, { k: 'leksakslada', v: 0, x: 220, y: 166 }, { k: 'jattenalle', v: 0, x: 290, y: 160 },
    { k: 'byggklossar', v: 0, x: 160, y: 196 }, { k: 'barntavla', v: 0, x: 130, y: 66 }, { k: 'golvkudde', v: 0, x: 120, y: 170 }],
  [{ k: 'rundmatta', v: 0, x: 150, y: 190 }, { k: 'sang', v: 2, x: 60, y: 150 }, { k: 'nattduksbord', v: 0, x: 100, y: 150 }, { k: 'garderob', v: 0, x: 250, y: 122 },
    { k: 'ramtavla', v: 0, x: 200, y: 62 }, { k: 'lagbyra', v: 0, x: 180, y: 150 }],
  [{ k: 'badkar', v: 0, x: 40, y: 152 }, { k: 'toalett', v: 0, x: 280, y: 142 }, { k: 'handfat', v: 0, x: 200, y: 130 }, { k: 'medicinskap', v: 0, x: 200, y: 62 },
    { k: 'badhylla', v: 0, x: 120, y: 128 }],
];

// Lådans flikar: katalogens avdelningar, väggsakerna för sig, jul och spök för sig.
const JUL = /^(jul|advents|polkagris|pepparkakshus|snogubbe|kulgran|ljusgran|minigran|girlang|ljusgirlang)/;
const SPOK = /^(pumpa|pumplykta|spindelnat|fladdermoss|gravsten|haxkittel|skelett|fagelskramma|gargoyl|spoktrad)/;
const av = (rum) => (k) => k.room === rum && !k.wall && !JUL.test(k.kind) && !SPOK.test(k.kind);
export const FLIKAR = [
  { id: 'vardagsrum', ik: '🛋️', namn: $t('Vardagsrum'), valj: av('VARDAGSRUM') },
  { id: 'kok', ik: '🍳', namn: $t('Kök'), valj: av('KÖK') },
  { id: 'sovrum', ik: '🛏️', namn: $t('Sovrum'), valj: av('SOVRUM') },
  { id: 'barnrum', ik: '🧸', namn: $t('Barnrum'), valj: av('BARNRUM') },
  { id: 'badrum', ik: '🛁', namn: $t('Badrum'), valj: av('BADRUM') },
  { id: 'kontor', ik: '💼', namn: $t('Kontor'), valj: av('KONTOR') },
  { id: 'hall', ik: '🚪', namn: $t('Hall'), valj: av('HALL') },
  { id: 'vagg', ik: '🖼️', namn: $t('Väggen'), valj: (k) => !!k.wall && !JUL.test(k.kind) && !SPOK.test(k.kind) },
  { id: 'ovrigt', ik: '🪴', namn: $t('Övrigt'), valj: av('ÖVRIGT') },
  { id: 'jul', ik: '🎄', namn: $t('Jul'), valj: (k) => JUL.test(k.kind) },
  { id: 'spok', ik: '🎃', namn: $t('Spök'), valj: (k) => SPOK.test(k.kind) },
];
// allt i katalogen utom visningsmöblerna (de visar ens egna designer), plus monsteran
const KAT = [...KATALOG.filter((k) => !VISNING.has(k.kind)), { kind: 'vaxt', icon: '🪴', name: nameOf('vaxt'), vars: 1, room: 'ÖVRIGT' }];

// ---------- huset i localStorage ----------
function klamma(d) {
  const { w, h } = dimsOf(d.k, d.v, d.r | 0);
  if (isWall(d.k)) { d.x = clamp(d.x, 5, FW - 5 - w); d.y = clamp(d.y, WALL_TOP + h, WALL_Y - 3); }
  else if (d.k === 'matta') { d.x = clamp(d.x, 6, FW - 4 - w); d.y = clamp(d.y, WALL_Y + 2, FH - 3 - h); }
  else if (isFlat(d.k)) { d.x = clamp(d.x, 6, FW - 4 - w); d.y = clamp(d.y, WALL_Y + 2 + h, FH - 3); }
  else { d.x = clamp(d.x, 8, FW - 5 - w); d.y = clamp(d.y, WALL_Y + 6, FH - 4); }
  return d;
}
const tvattaDeco = (d) => ({ k: d.k, v: d.v | 0, ...(d.c ? { c: d.c } : {}), ...(d.r ? { r: d.r | 0 } : {}), x: d.x | 0, y: d.y | 0, ...(d.up > 0 ? { up: +d.up } : {}), ...(d.lit ? { lit: true } : {}) });
function lasHus() {
  let p = null;
  try { p = JSON.parse(localStorage.getItem(DOCK_KEY) || 'null'); } catch { p = null; }
  if (!p || !Array.isArray(p.rooms)) return null;
  return { v: 1, natt: !!p.natt, rooms: RUM.map((_, i) => ({ deco: (p.rooms[i]?.deco || []).filter((d) => d && knownKind(d.k)).map(tvattaDeco) })) };
}
const nyttHus = () => ({ v: 1, natt: false, rooms: SEED.map((list) => ({ deco: list.filter((d) => knownKind(d.k)).map(tvattaDeco) })) });

// pekarens plats på skärmen → spelpixlar (samma räkning som main.js toLocal)
function tillLogisk(A, cv, clientX, clientY) {
  const r = cv.getBoundingClientRect();
  const lw = cv.width / A.pxs, lh = cv.height / A.pxs;
  return { x: (clientX - r.left) / r.width * lw - A.view.boxX, y: (clientY - r.top) / r.height * lh - A.view.boxY,
    inne: clientX >= r.left && clientX <= r.right && clientY >= r.top && clientY <= r.bottom };
}

export function makeDockskap(A) {
  const H = lasHus() || nyttHus();
  for (const r of H.rooms) for (const d of r.deco) if (!(d.up > 0)) klamma(d);
  const n = RUM.length;
  const ox = (i) => i * (FW + WALLW);
  const W = n * FW + (n - 1) * WALLW;
  const roomAt = (wx) => clamp(Math.floor(wx / (FW + WALLW)), 0, n - 1);
  const bgs = RUM.map((r, i) => buildBg(r, FW, [], i === 0, PLAN, false));

  // ---------- kameran ----------
  const seen = () => { const sf = A.view?.safe; const x0 = sf ? sf.x0 : 0, x1 = sf ? sf.x1 : (A.W || FW); return x1 > x0 ? [x0, x1] : [0, A.W || FW]; };
  const clampCam = (c) => { const [x0, x1] = seen(), vis = x1 - x0; if (W <= vis) return -(x0 + (vis - W) / 2); return Math.max(-x0, Math.min(W - x1, c)); };
  const camRoom = (i) => { const [x0, x1] = seen(), vis = x1 - x0; return clampCam(ox(i) - x0 - (vis - FW) / 2); };
  let camX = camRoom(0), camTo = null;

  // ---------- sparningen ----------
  let tmr = 0;
  const skriv = () => { try { localStorage.setItem(DOCK_KEY, JSON.stringify(H)); } catch { /* fullt */ } };
  function spara(nu = false) { clearTimeout(tmr); if (nu) skriv(); else tmr = setTimeout(skriv, 300); }

  // ---------- småsaker på bord (som i room.js) ----------
  const isRider = (d) => !!d && d.up > 0;
  const upOn = (s) => { const row = surfaceRow(s.k, s.v, s.r | 0); return row == null ? null : dimsOf(s.k, s.v, s.r | 0).h - row + 1; };
  function surfaceOf(d, list, skip = -1) {
    const { w } = dimsOf(d.k, d.v, d.r | 0);
    return list.find((s, j) => j !== skip && s !== d && s && SURFACES.has(s.k) && !isRider(s) && d.y === s.y + 1 && d.x >= s.x && d.x + w <= s.x + dimsOf(s.k, s.v, s.r | 0).w) || null;
  }
  const ridersOf = (list, idx) => list.filter((d) => isRider(d) && surfaceOf(d, list) === list[idx]).map((d) => ({ d, dx: d.x - list[idx].x }));
  // det som stod på ett bord som försvann står nu på golvet
  function settle(i) {
    for (const d of H.rooms[i].deco) if (isRider(d) && !surfaceOf(d, H.rooms[i].deco)) { delete d.up; klamma(d); }
  }

  // ---------- det ritade, per rum ----------
  let drag = null;   // { room, idx, d, k, v, c, r, offx, offy, moved, px, py, sx, sy, riders, groom, gx, gy, gup, fromTray }
  let pan = null;    // { sx, cam0, moved }
  let armed = null;  // { k, v, r } – vald i lådan: nästa tryck i rummet ställer den där
  const built = RUM.map(() => ({ props: [], rugs: [], walls: [] }));
  function rebuild(i) {
    const b = built[i]; b.props = []; b.rugs = []; b.walls = [];
    H.rooms[i].deco.forEach((d, idx) => {
      if (drag && !drag.fromTray && drag.room === i && drag.idx === idx) return;   // lyft just nu
      if (drag?.riders?.some((q) => q.d === d)) return;                             // står på bordet man bär
      if (d.k === 'matta') { b.rugs.push({ idx, x: d.x, y: d.y, w: RUG.w, h: RUG.h, draw: (ctx) => ctx.drawImage(rugImg(d.v, d.c), d.x, d.y) }); return; }
      if (d.k === 'vaxt') { const p = makePlantProp(d.x + 10, d.y); b.props.push({ ...p, k: 'vaxt', idx, rect: [d.x - 2, p.top, d.x + 22, d.y + 1] }); return; }
      if (isWall(d.k)) { const w = wallProp(d, idx); if (w) b.walls.push({ ...w, idx }); return; }
      if (isFlat(d.k)) { const f = flatProp(d, idx); if (f) b.rugs.push({ ...f, idx }); return; }
      const p = spriteProp(d, idx, false);
      if (p) b.props.push({ ...p, idx, rect: p.hit || [p.solid[0] + 1, p.top, p.solid[2] - 1, p.solid[3] - 1] });
    });
    b.props.sort((a, c) => a.sort - c.sort);
  }
  const rebuildAll = () => { for (let i = 0; i < n; i++) rebuild(i); };
  rebuildAll();

  const inRect = (x, y, r) => x >= r[0] && x <= r[2] && y >= r[1] && y <= r[3];
  // möbeln under pekaren i rummet i: främst golvmöblerna (den längst fram vinner), sedan
  // väggsakerna, sist mattorna
  function hitAt(i, lx, ly) {
    const b = built[i];
    for (let j = b.props.length - 1; j >= 0; j--) if (inRect(lx, ly, b.props[j].rect)) return b.props[j].idx;
    for (let j = b.walls.length - 1; j >= 0; j--) { const w = b.walls[j]; if (inRect(lx, ly, [w.x, w.top, w.x + w.w, w.top + w.h])) return w.idx; }
    for (let j = b.rugs.length - 1; j >= 0; j--) { const r = b.rugs[j]; if (inRect(lx, ly, [r.x, r.y, r.x + r.w, r.y + r.h])) return r.idx; }
    return -1;
  }

  // var det man håller i hamnar i rummet j med pekaren på (mx, my): { x, y, up } – en småsak
  // över en bordsskiva ställs uppe på skivan, annars kläms den innanför golvet/väggen
  function placeFor(c, j, mx, my) {
    const { w } = dimsOf(c.k, c.v, c.r);
    const list = H.rooms[j].deco, skip = !c.fromTray && c.room === j ? c.idx : -1;
    if (ON_TABLE.has(c.k)) {
      let best = null;
      list.forEach((s, k2) => {
        if (k2 === skip || !s || !SURFACES.has(s.k) || isRider(s)) return;
        const sd = dimsOf(s.k, s.v, s.r | 0), u = upOn(s);
        if (u == null || w > sd.w - 2 || mx < s.x || mx > s.x + sd.w || my < s.y - sd.h - 4 || my > s.y + 2) return;
        if (!best || s.y > best.s.y) best = { s, sd, u };
      });
      if (best) { const { s, sd, u } = best; return { x: Math.max(s.x + 1, Math.min(s.x + sd.w - 1 - w, Math.round(mx - w / 2))), y: s.y + 1, up: u }; }
    }
    const d = klamma({ k: c.k, v: c.v, r: c.r, x: Math.round(mx + c.offx), y: Math.round(my + c.offy) });
    return { x: d.x, y: d.y, up: 0 };
  }
  function ghostTo(x, y) {
    const wx = x + camX, j = roomAt(wx), lx = clamp(wx - ox(j), 0, FW);
    const pos = placeFor(drag, j, lx, y);
    drag.groom = j; drag.gx = pos.x; drag.gy = pos.y; drag.gup = pos.up;
  }
  function laggTill(i, d) {
    const list = H.rooms[i].deco;
    if (list.length >= MAX_I_RUM) { play('fel'); toast($t('Rummet är fullt – ta bort något först.'), 'bad'); return false; }
    const it = tvattaDeco(d);
    if (!(it.up > 0)) klamma(it);
    list.push(it);
    play('ok'); spara(); rebuild(i);
    return true;
  }
  function taBort(i, idx) {
    const list = H.rooms[i].deco;
    if (!list[idx]) return;
    list.splice(idx, 1);
    settle(i);
    play('click'); spara(); rebuild(i);
  }
  // släpp det man drar: nytt från lådan, flyttat i rummet, eller flyttat till ett annat rum
  function commit(c) {
    if (c.fromTray) { laggTill(c.groom, { k: c.k, v: c.v, r: c.r, x: c.gx, y: c.gy, up: c.gup }); return; }
    const from = H.rooms[c.room].deco, d = c.d;
    if (!from.includes(d)) { rebuild(c.room); return; }
    if (c.groom !== c.room) {
      from.splice(from.indexOf(d), 1);
      for (const q of c.riders) { const qi = from.indexOf(q.d); if (qi >= 0) from.splice(qi, 1); }
      const to = H.rooms[c.groom].deco;
      to.push(d); for (const q of c.riders) to.push(q.d);
    }
    d.x = c.gx; d.y = c.gy;
    if (c.gup > 0) d.up = c.gup; else delete d.up;
    for (const q of c.riders) { q.d.x = d.x + q.dx; q.d.y = d.y + 1; }
    settle(c.groom); if (c.groom !== c.room) settle(c.room);
    play('click'); spara(); rebuild(c.room); rebuild(c.groom);
  }

  // ---------- menyn för en möbel (kort tryck) ----------
  function menyFor(i, idx) {
    const d = H.rooms[i].deco[idx];
    if (!d) return;
    const kat = katalogOf(d.k), vars = kat?.vars | 0, fn = functionOf(d.k);
    const igen = () => { spara(); rebuild(i); play('click'); menyFor(i, idx); };
    openModal(`${kat?.icon || '🪴'} ${nameOf(d.k)}`, `<div class="dock-meny"><span data-thumb></span><p style="font-size:var(--f2);margin:0">${$t('Dra möbeln dit du vill ha den – även in i ett annat rum. Här vrider, målar och byter du den.')}</p></div>`, [
      ...(d.k !== 'vaxt' ? [{ label: $t('🔄 Vrid'), onClick: () => { d.r = ((d.r | 0) + 1) % rotStates(d.k); if (!d.r) delete d.r; if (!(d.up > 0)) klamma(d); igen(); } }] : []),
      ...(vars > 1 ? [{ label: $t('🔁 Byt modell'), onClick: () => { d.v = ((d.v | 0) + 1) % vars; if (!(d.up > 0)) klamma(d); igen(); } }] : []),
      ...(canRecolor(d.k) ? [{ label: $t('🎨 Färg'), cls: 'btn-gold', onClick: () => {
        closeModal();
        import('./shop-mobler.js').then((m) => m.openRecolor(A, { kind: d.k, v: d.v, c: d.c, onPick: (hex) => { if (hex) d.c = hex; else delete d.c; spara(); rebuild(i); play('ok'); } })).catch(() => {});
      } }] : []),
      ...(fn === 'brasa' || fn === 'lykta' ? [{ label: d.lit ? $t('🔥 Släck') : $t('🔥 Tänd'), onClick: () => { if (d.lit) delete d.lit; else d.lit = true; igen(); } }] : []),
      { label: $t('🗑 Ta bort'), cls: 'btn-red', onClick: () => { closeModal(); taBort(i, idx); } },
      { label: $t('Stäng'), onClick: closeModal },
    ]);
    const el = document.querySelector('#modal [data-thumb]');
    if (el) el.replaceWith(thumbCanvas(d.k, d.v, d.c));
  }

  // ---------- pekaren ----------
  function down(x, y) {
    camTo = null;
    const wx = x + camX, i = roomAt(wx), lx = wx - ox(i);
    if (armed) {   // vald i lådan: ställ den här
      const c = { ...armed, fromTray: true, offx: -dimsOf(armed.k, armed.v, armed.r).w / 2, offy: 0 };
      const pos = placeFor(c, i, lx, y);
      laggTill(i, { k: c.k, v: c.v, r: c.r, x: pos.x, y: pos.y, up: pos.up });
      armed = null; fyllLada();
      return;
    }
    const idx = hitAt(i, lx, y);
    if (idx >= 0) {
      const d = H.rooms[i].deco[idx];
      drag = { room: i, idx, d, k: d.k, v: d.v, c: d.c, r: d.r | 0, offx: d.x - lx, offy: d.y - y, moved: false, px: x, py: y, sx: x, sy: y,
        riders: SURFACES.has(d.k) ? ridersOf(H.rooms[i].deco, idx) : [], groom: i, gx: d.x, gy: d.y, gup: d.up || 0 };
      rebuild(i);
      return;
    }
    pan = { sx: x, cam0: camX, moved: false };
  }
  function move(x, y) {
    if (drag) {
      drag.px = x; drag.py = y;
      if (!drag.moved && Math.hypot(x - drag.sx, y - drag.sy) > 3) drag.moved = true;
      if (drag.moved) ghostTo(x, y);
      return;
    }
    if (pan) { const dx = x - pan.sx; if (Math.abs(dx) > 3) pan.moved = true; if (pan.moved) camX = clampCam(pan.cam0 - dx); }
  }
  function up(x, y) {
    if (drag) {
      const c = drag; drag = null;
      if (c.moved) commit(c);
      else { rebuild(c.room); menyFor(c.room, c.idx); }
      return;
    }
    if (pan) {
      const p = pan; pan = null;
      if (p.moved) return;
      const wx = x + camX, i = roomAt(wx), lx = wx - ox(i);
      if (i === 0 && inRect(lx, y, [DOOR.x0, 30, DOOR.x1, WALL_Y + 9])) { play('door'); A.leaveDockskap?.(); }
    }
  }
  function key(k) {
    if (k === 'Escape') {
      if (drag) { const c = drag; drag = null; if (!c.fromTray) rebuild(c.room); return; }
      if (armed) { armed = null; fyllLada(); }
      return;
    }
    if ((k === 'r' || k === 'R') && drag) { drag.r = (drag.r + 1) % rotStates(drag.k); if (drag.moved) ghostTo(drag.px, drag.py); return; }
    if (k === 'ArrowLeft') camTo = clampCam((camTo ?? camX) - 120);
    if (k === 'ArrowRight') camTo = clampCam((camTo ?? camX) + 120);
  }

  // ---------- lådan (DOM) ----------
  let panel = null, flik = 'vardagsrum';
  function byggPanel() {
    panel = document.getElementById('dock-panel');
    if (!panel) { panel = document.createElement('div'); panel.id = 'dock-panel'; document.body.append(panel); }
    panel.innerHTML = `<div class="dp-head"><span>🧸 ${$t('Dockskåpet')}</span><span class="dock-rum">${RUM.map((r, i) => `<button class="btn btn-small" data-rum="${i}" title="${$t(r.name)}">${r.ik}</button>`).join('')}</span></div>
      <div class="dock-flikar">${FLIKAR.map((f) => `<button class="btn btn-small ${f.id === flik ? 'btn-go' : ''}" data-flik="${f.id}" title="${f.namn}">${f.ik}</button>`).join('')}</div>
      <div id="dock-items"></div>
      <div class="dp-foot"><button class="btn btn-small" data-natt>${H.natt ? $t('☀️ Dag') : $t('🌙 Natt')}</button><button class="btn btn-small" data-ut title="${$t('Tillbaka till menyn')}">${$t('⬅ Tillbaka')}</button></div>`;
    panel.querySelectorAll('[data-rum]').forEach((b) => (b.onclick = () => { play('click'); camTo = camRoom(+b.dataset.rum); }));
    panel.querySelectorAll('[data-flik]').forEach((b) => (b.onclick = () => { play('click'); flik = b.dataset.flik; byggPanel(); }));
    panel.querySelector('[data-natt]').onclick = () => { H.natt = !H.natt; spara(true); play('click'); byggPanel(); };
    panel.querySelector('[data-ut]').onclick = () => { play('door'); A.leaveDockskap?.(); };
    fyllLada();
    panel.classList.remove('hidden');
  }
  function fyllLada() {
    const box = panel?.querySelector('#dock-items');
    if (!box) return;
    const f = FLIKAR.find((x) => x.id === flik) || FLIKAR[0];
    const list = KAT.filter(f.valj);
    box.innerHTML = list.map((k) => `<button class="dock-item ${armed?.k === k.kind ? 'on' : ''}" data-k="${k.kind}" title="${k.name}"><span data-thumb="${k.kind}"></span><small>${k.name}</small></button>`).join('');
    box.querySelectorAll('[data-thumb]').forEach((el) => el.replaceWith(thumbCanvas(el.dataset.thumb, 0, null)));
    box.querySelectorAll('.dock-item').forEach((b) => { b.onpointerdown = (e) => tagFranLadan(e, b.dataset.k); });
  }
  // Ur lådan: drar man möbeln in över rummet följer ett spöke med och släpps där; ett kort
  // tryck väljer den i stället (nästa tryck i rummet ställer den där).
  function tagFranLadan(e, k) {
    if (!knownKind(k)) return;
    e.preventDefault();
    const cv = document.getElementById('scene');
    const start = { x: e.clientX, y: e.clientY };
    let moved = false;
    const onMove = (ev) => {
      if (!moved && Math.hypot(ev.clientX - start.x, ev.clientY - start.y) > 6) moved = true;
      if (!moved) return;
      const p = tillLogisk(A, cv, ev.clientX, ev.clientY);
      if (!p.inne) { if (drag?.fromTray) drag = null; return; }
      if (!drag) drag = { fromTray: true, room: -1, idx: -1, k, v: 0, r: 0, offx: -dimsOf(k, 0, 0).w / 2, offy: 0, moved: true, riders: [], px: p.x, py: p.y, sx: p.x, sy: p.y, groom: 0, gx: 0, gy: 0, gup: 0 };
      drag.px = p.x; drag.py = p.y;
      ghostTo(p.x, p.y);
    };
    const onUp = () => {
      document.removeEventListener('pointermove', onMove); document.removeEventListener('pointerup', onUp); document.removeEventListener('pointercancel', onUp);
      if (drag?.fromTray) { const c = drag; drag = null; commit(c); return; }
      if (moved) return;
      armed = armed?.k === k ? null : { k, v: 0, r: 0 };
      if (armed) toast($t('Tryck i rummet där den ska stå – eller dra den dit.'));
      fyllLada();
    };
    document.addEventListener('pointermove', onMove); document.addEventListener('pointerup', onUp); document.addEventListener('pointercancel', onUp);
  }

  // ---------- ritandet ----------
  // mellanväggen mellan två rum (som i js/scenes/apartment.js): gaveln mot bakväggen, krönet
  // ut över golvet och en öppning på golvets höjd med tröskel
  function drawWall(ctx, L, R, rx) {
    const x0 = Math.round(rx - WALLW - camX), w = WALLW;
    if (x0 > (A.W || FW) || x0 + w < 0) return;
    const face = mix(L.wallDk, R.wallDk, 0.5), cap = mix(mix(L.wall, R.wall, 0.5), 0xf4f0e6, 0.45), edge = 0x1c1a20;
    const f = (c, a, b, cw, ch) => { ctx.fillStyle = css(c); ctx.fillRect(a, b, cw, ch); };
    f(face, x0, 0, w, WALL_Y);
    f(mix(face, 0xffffff, 0.18), x0 + 1, 0, 1, WALL_Y);
    f(mix(face, 0x000000, 0.25), x0 + w - 2, 0, 1, WALL_Y);
    const seg = (a, b) => { f(cap, x0, a, w, b - a); f(edge, x0, a, 1, b - a); f(edge, x0 + w - 1, a, 1, b - a); f(mix(cap, 0x000000, 0.12), x0 + 1, b - 2, w - 2, 2); };
    seg(WALL_Y, APT.DY0);
    seg(APT.DY1, FH);
    f(mix(L.floorA, R.floorA, 0.5), x0, APT.DY0, w, APT.DY1 - APT.DY0);
    f(mix(mix(L.floorB, R.floorB, 0.5), 0x000000, 0.1), x0 + 2, APT.DY0, w - 4, APT.DY1 - APT.DY0);
    f(0x6a4a2a, x0, APT.DY0 - 2, w, 2);
    f(0x6a4a2a, x0, APT.DY1, w, 2);
    ctx.fillStyle = 'rgba(20,12,28,0.18)';
    ctx.fillRect(x0 - 2, WALL_Y, 2, APT.DY0 - 2 - WALL_Y); ctx.fillRect(x0 + w, WALL_Y, 2, APT.DY0 - 2 - WALL_Y);
    ctx.fillRect(x0 - 2, APT.DY1 + 2, 2, FH - APT.DY1 - 2); ctx.fillRect(x0 + w, APT.DY1 + 2, 2, FH - APT.DY1 - 2);
    if (R.bath) { const dx = x0 + w, dy = APT.DY0 - 2; f(0x1c1a20, dx, dy - 1, 20, 5); f(0xb08a5a, dx, dy, 19, 3); f(0xd0aa74, dx, dy, 19, 1); f(0xe8c070, dx + 15, dy + 1, 2, 1); }
  }
  // spöket: det man drar, halvgenomskinligt där det kommer att hamna (med det som står på bordet)
  function drawGhost(ctx) {
    const c = drag;
    ctx.globalAlpha = 0.72;
    const rita = (k, v, col, r, x, y, upp) => {
      if (k === 'matta') { ctx.drawImage(rugImg(v, col), x, y); return; }
      if (k === 'vaxt') { makePlantProp(x + 10, y).draw(ctx); return; }
      const a = furnView(k, v, col, r);
      if (a) drawArt(ctx, a, x, y - (upp || 0) - a.sh);
    };
    rita(c.k, c.v, c.c, c.r, c.gx, c.gy, c.gup);
    if (c.riders?.length) for (const q of c.riders) rita(q.d.k, q.d.v, q.d.c, q.d.r | 0, c.gx + q.dx, c.gy + 1, q.d.up);
    ctx.globalAlpha = 1;
  }
  function draw(ctx) {
    ctx.setTransform(A.pxs, 0, 0, A.pxs, 0, 0);
    ctx.fillStyle = '#17151a'; ctx.fillRect(0, 0, A.W, A.H);
    const night = H.natt, vw = A.W || FW;
    for (let i = 0; i < n; i++) {
      const x0 = Math.round(ox(i) - camX);
      if (x0 >= vw || x0 + FW <= 0) continue;
      ctx.save();
      ctx.setTransform(A.pxs, 0, 0, A.pxs, x0 * A.pxs, 0);
      ctx.beginPath(); ctx.rect(0, 0, FW, FH); ctx.clip();
      ctx.drawImage(bgs[i](night), 0, 0);
      const b = built[i];
      for (const r of b.rugs) r.draw(ctx);
      for (const w of b.walls) w.draw(ctx);
      const items = b.props.map((p) => ({ fy: p.sort, draw: () => p.draw(ctx) }));
      if (drag?.moved && drag.groom === i) items.push({ fy: isWall(drag.k) ? -1 : drag.gy + 0.5, draw: () => drawGhost(ctx) });
      items.sort((a, c) => a.fy - c.fy).forEach((it) => it.draw());
      if (night) {
        ctx.fillStyle = `rgba(10,12,40,${NIGHT_DIM})`; ctx.fillRect(0, 0, FW, FH);
        for (const w of b.walls) w.light?.(ctx);
        for (const p of b.props) p.light?.(ctx);
      }
      ctx.restore();
    }
    ctx.setTransform(A.pxs, 0, 0, A.pxs, 0, 0);
    for (let i = 0; i < n - 1; i++) drawWall(ctx, RUM[i], RUM[i + 1], ox(i + 1));
    if (night) { ctx.fillStyle = `rgba(10,12,40,${NIGHT_DIM})`; for (let i = 0; i < n - 1; i++) ctx.fillRect(Math.round(ox(i + 1) - WALLW - camX), 0, WALLW, FH); }
  }
  function update(dt) {
    if (camTo != null && !pan) {
      camX += (camTo - camX) * Math.min(1, dt * 8);
      if (Math.abs(camTo - camX) < 0.3) { camX = camTo; camTo = null; }
    }
    if (drag?.moved) {   // dra mot kanten → bilden rullar med
      const [x0, x1] = seen();
      if (drag.px < x0 + 24) camX = clampCam(camX - 170 * dt);
      else if (drag.px > x1 - 24) camX = clampCam(camX + 170 * dt);
      ghostTo(drag.px, drag.py);
    }
  }

  const scene = {
    dockskap: true,   // (main.js: spelklockan står still, ingen pixel-HUD)
    get viewMax() { return { w: W, h: FH }; },
    update, draw, down, move, up, key,
    enter() { document.body.classList.add('dock-on'); byggPanel(); window.dispatchEvent(new Event('resize')); },
    exit() { spara(true); drag = null; armed = null; pan = null; document.body.classList.remove('dock-on'); panel?.classList.add('hidden'); window.dispatchEvent(new Event('resize')); },
  };
  // testerna (tools/dockskap-test.mjs)
  scene._debug = {
    W, rooms: () => RUM.map((r, i) => ({ id: r.id, name: r.name, ox: ox(i) })),
    deco: (i) => H.rooms[i].deco.map((d) => ({ ...d })),
    cam: () => camX, goRoom: (i) => { camX = camRoom(i); camTo = null; return camX; },
    natt: () => H.natt,
    // skärmläge för möbeln idx i rummet i (mitt på, strax ovanför fotlinjen)
    spot: (i, idx) => { const d = H.rooms[i].deco[idx]; if (!d) return null; const { w, h } = dimsOf(d.k, d.v, d.r | 0); const y = d.k === 'matta' ? d.y + h / 2 : isWall(d.k) ? d.y - h / 2 : d.y - Math.min(6, h / 2); return { x: d.x + w / 2 + ox(i) - camX, y }; },
    place: (k, i, x, y) => laggTill(i, { k, v: 0, x, y }),
    remove: (i, idx) => taBort(i, idx),
    rotate: (i, idx) => { const d = H.rooms[i].deco[idx]; if (!d) return false; d.r = ((d.r | 0) + 1) % rotStates(d.k); klamma(d); spara(); rebuild(i); return true; },
    arm: (k) => { armed = { k, v: 0, r: 0 }; fyllLada(); },
    drag: () => (drag ? { room: drag.room, idx: drag.idx, moved: drag.moved, groom: drag.groom, gx: drag.gx, gy: drag.gy, gup: drag.gup, fromTray: !!drag.fromTray } : null),
    flik: (id) => { flik = id; byggPanel(); },
    key: DOCK_KEY,
  };
  return scene;
}
