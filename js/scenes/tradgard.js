// TRÄDGÅRDEN (Carl 2026-10-01: "vi fixar odla i trädgården"): uteplatsen bakom bostaden, dit man
// går genom ytterdörren hemma (room.js frågar: ut i stan eller ut i trädgården).
//   radhus    tegelfasad med altandörr, gräsmatta, sex odlingsbäddar och en häck
//   villa     vit panelfasad, stor gräsmatta, åtta bäddar och äppelträdet
//   husvagn   husvagnens sida och grustomten med tre pallkragar
//   takvaning terrassen: trädäck, glasräcke, stadens tak bakom – fyra stora krukor
// Klick på en bädd → figuren går dit: tom = så (välj fröpåse), torr = vattna, växer = hur långt,
// mogen = skörda (till skafferiet), vissen = rensa. Redskapsbänken: vattna alla. Dörren: in igen.
// Odlingen räknas i game.js (GRODOR, TRADGARD, plant/waterGarden/harvest/growGarden).
import { Pix, SMALL, ctxText, textW, mix, mul, hash, bayer, css } from '../core/floor-pix.js';
import { toast } from '../core/ui.js';
import { grodaOf, tradgardOf } from '../game.js';
import { createWalker, selfDrawable, folkDrawables } from './walkable.js';
import { ravaraIcon, ravaraPal } from '../core/ravara-art.js';
import { play } from '../core/sound.js';
import { $t } from '../core/i18n.js';
import { bedAction as odlaBed, waterAll } from '../core/odla.js';

const FW = 384, FH = 216, GROUND = 82;
// bäddarna per bostad: [x, y] = bäddens nedre vänstra hörn (fotlinjen), w × h
const BEDS = {
  radhus: [[120, 128], [176, 128], [232, 128], [120, 176], [176, 176], [232, 176]],
  villa: [[100, 124], [150, 124], [200, 124], [250, 124], [100, 172], [150, 172], [200, 172], [250, 172]],
  husvagn: [[150, 140], [204, 140], [258, 140]],
  takvaning: [[140, 150], [196, 150], [252, 150], [308, 150]],
};
const BW = 44, BH = 22;
const DOOR = { x0: 36, x1: 64 };
const BENCH = { x0: 14, x1: 70, y: 168 };
const TREE = { x: 336, y: 132 };

const tone = (pal, v, x, y) => { const t = Math.max(0, Math.min(0.999, v)) * (pal.length - 1), i = Math.floor(t); return pal[Math.min(pal.length - 1, i + (t - i > bayer(x, y) ? 1 : 0))]; };
const r1 = (c, x, y, w, h, col) => { c.fillStyle = typeof col === 'number' ? css(col) : col; c.fillRect(Math.round(x), Math.round(y), w, h); };

// ================= bakgrunderna (målade en gång per sort) =================
const BG = new Map();
function paintBg(kind) {
  const P = new Pix(FW, FH);
  const terrace = kind === 'takvaning', camp = kind === 'husvagn';
  // himmel
  for (let y = 0; y < GROUND; y++) for (let x = 0; x < FW; x++) P.px(x, y, tone([0x5aa0e0, 0x7ab8ec, 0x9acef4, 0xc0e2f8, 0xe2f2fc], 0.2 + y / GROUND * 0.7, x, y));
  // marken: gräs (radhus/villa), grus (tomten), trädäck (terrassen)
  for (let y = GROUND; y < FH; y++) for (let x = 0; x < FW; x++) {
    let c;
    if (terrace) { const b = Math.floor((y - GROUND) / 7); c = ((y - GROUND) % 7 === 6) ? 0x6a4626 : mix(0xb07a46, 0x9a6a3c, hash(Math.floor((x + b * 23) / 40), b, 5) * 0.6); }
    else if (camp) c = mix(0xb8aa90, 0x9a8c74, hash(x, y, 7));
    else { const band = Math.floor((x + (FH - y) * 0.4) / 20) & 1; c = band ? 0x5aa84a : 0x4e9a40; if (hash(x, y, 9) > 0.94) c = mix(c, 0xb8e070, 0.4); }
    P.px(x, y, c);
  }
  if (camp) for (let k = 0; k < 160; k++) P.px(hash(k, 1, 13) * FW, GROUND + hash(k, 2, 13) * (FH - GROUND), hash(k, 3, 13) > 0.5 ? 0x7a6e5a : 0xd8ccb0);
  // fasaden / bakgrunden
  if (kind === 'radhus') {
    for (let y = 0; y < GROUND; y++) for (let x = 0; x < FW; x++) {
      if (y < 10) continue;
      const row = Math.floor(y / 4), off = row & 1 ? 4 : 0, mortar = y % 4 === 3 || (x + off) % 8 === 7;
      P.px(x, y, mortar ? 0xc8b890 : mix(0xc8783a, 0xa85e2c, hash((x + off) >> 3, row, 3)));
    }
    P.rect(0, 6, FW, 4, 0x5a3a2a); P.hl(0, 6, FW, 0x7a5a42);           // takfoten
    window_(P, 110, 22, 50, 36); window_(P, 230, 22, 50, 36);
    door_(P, DOOR.x0, 30, DOOR.x1 - DOOR.x0, GROUND - 30, 0xf4f1ea, true);
    hedge(P, 0, FW, GROUND - 2);
  } else if (kind === 'villa') {
    for (let y = 8; y < GROUND; y++) for (let x = 0; x < FW; x++) P.px(x, y, (x % 9 === 8) ? 0xc8ccc4 : mix(0xf4f2ea, 0xe0ded4, (y - 8) / 74));
    P.rect(0, 4, FW, 4, 0x3a3a44); P.hl(0, 4, FW, 0x5a5a66);
    window_(P, 100, 20, 60, 40); window_(P, 190, 20, 60, 40);
    door_(P, DOOR.x0, 28, DOOR.x1 - DOOR.x0, GROUND - 28, 0x2a5a8a, true);
    P.rect(0, GROUND - 4, FW, 4, 0x8a8a8a); for (let x = 0; x < FW; x += 6) P.px(x, GROUND - 4, 0xb8b8b8);   // stenkanten
  } else if (kind === 'husvagn') {
    // husvagnens sida: krämvit med rand, fönster och dörren, hjulet
    for (let y = 14; y < GROUND - 6; y++) for (let x = 0; x < 200; x++) P.px(x, y, y > 40 && y < 46 ? 0x3a7ab8 : mix(0xf0e8d0, 0xd8ccb0, (y - 14) / 70));
    P.rect(0, 12, 200, 3, 0xb8b0a0); for (let x = 0; x < 200; x++) P.px(x, GROUND - 6, 0x8a8070);
    window_(P, 110, 20, 44, 18);
    door_(P, DOOR.x0, 22, DOOR.x1 - DOOR.x0, GROUND - 28, 0xe8e0c8, false);
    // hjulet: hjulhuset, däcket och navkapseln (fyllda)
    for (let j = -8; j <= 0; j++) for (let i = -8; i <= 8; i++) if (i * i + j * j <= 64) P.px(170 + i, GROUND - 6 + j, 0x5a5448);
    for (let j = -6; j <= 6; j++) for (let i = -6; i <= 6; i++) { const d = i * i + j * j; if (d <= 36) P.px(170 + i, GROUND - 6 + j, d <= 9 ? (d <= 2 ? 0xd8d8dc : 0x9a9aa4) : (d > 30 ? 0x0e0e12 : 0x26262c)); }
    // staket bakom tomten
    for (let x = 200; x < FW; x++) { for (const y of [40, 60]) P.px(x, y, 0x8a7a5a); if (x % 10 === 0) P.rect(x, 34, 2, GROUND - 34, 0x7a6a4a); }
  } else if (kind === 'takvaning') {
    // stadens tak bakom glasräcket
    for (let x = 0, i = 0; x < FW; i++) { const w = 18 + hash(i, 1, 21) * 30, h = 18 + hash(i, 2, 21) * 40; for (let y = Math.round(GROUND - h); y < GROUND; y++) for (let xx = x; xx < x + w; xx++) P.px(xx, y, (y % 6 === 2 && xx % 5 === 2) ? 0xf8e0a0 : mix(0x6a7a8e, 0x8a9aac, hash(i, 3, 21))); x += w + 2; }
    for (let y = GROUND - 30; y < GROUND; y++) for (let x = 0; x < FW; x++) P.px(x, y, 0xc8e8f8, 0.35);   // glaset
    P.rect(0, GROUND - 32, FW, 2, 0xd8dce4); P.rect(0, GROUND - 1, FW, 2, 0x8a909a);
    for (let x = 0; x < FW; x += 48) P.rect(x, GROUND - 32, 2, 32, 0xb8bcc6);
    door_(P, DOOR.x0, 26, DOOR.x1 - DOOR.x0, GROUND - 26, 0x2a2a32, true);
  }
  // redskapsbänken (vattenkannan och fröpåsarna)
  const by = BENCH.y;
  P.rect(BENCH.x0, by - 14, BENCH.x1 - BENCH.x0, 4, 0x8a5a30); P.hl(BENCH.x0, by - 14, BENCH.x1 - BENCH.x0, 0xb07a48);
  for (const x of [BENCH.x0 + 2, BENCH.x1 - 5]) P.rect(x, by - 10, 3, 10, 0x6a4424);
  for (let k = 0; k < 4; k++) { const x = BENCH.x0 + 30 + k * 6; P.rect(x, by - 22, 5, 8, [0xe8b230, 0x6ab83a, 0xd84a3a, 0x8a5ad8][k]); P.rect(x + 1, by - 20, 3, 3, 0xf4f1ea); }   // fröpåsarna
  return P.flush();
}
function window_(P, x, y, w, h) {
  P.rect(x - 2, y - 2, w + 4, h + 4, 0xf4f1ea);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) P.px(x + i, y + j, mix(0x6ab0e0, 0x2a5a8a, j / h));
  P.rect(x + (w >> 1) - 1, y, 2, h, 0xf4f1ea); P.rect(x, y + (h >> 1) - 1, w, 2, 0xf4f1ea);
  for (let k = 0; k < 10; k++) P.px(x + 3 + k, y + 3 + (k >> 1), 0xffffff, 0.5);
}
function door_(P, x, y, w, h, col, glass) {
  P.rect(x - 2, y - 2, w + 4, h + 2, 0x5a4a3a);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) P.px(x + i, y + j, glass && j > 4 && j < h - 6 && i > 3 && i < w - 4 ? mix(0x9ad0f0, 0x5a90c0, j / h) : mul(col, 0.92 + (i === 0 ? 0.1 : 0)));
  P.rect(x + w - 6, y + (h >> 1), 3, 2, 0xd8b040);
}
function hedge(P, x0, x1, y) { for (let x = x0; x < x1; x++) for (let k = 0; k < 6; k++) P.px(x, y - k, tone([0x1e4a1a, 0x2e6a26, 0x3e8a32, 0x5aa84a], 0.4 + hash(x, k, 31) * 0.5 - k * 0.03, x, y - k)); }

// ================= bäddarna och plantorna =================
function drawBed(c, kind, x, y, b, st, t) {
  const pot = kind === 'takvaning', pall = kind === 'husvagn';
  // lådan: trä (pallkrage) eller terrakottakruka
  if (pot) { for (let j = 0; j < BH; j++) { const k = j / BH, inset = Math.round(k * 4); r1(c, x + inset, y - BH + j, BW - inset * 2, 1, tone([0x8a3a1a, 0xb0522a, 0xd06a3a, 0xe88a5a], 0.6 - k * 0.3, x, y - BH + j)); } }
  else { r1(c, x, y - BH, BW, BH, pall ? 0x9a7448 : 0x7a5228); for (let j = 0; j < BH; j += 7) r1(c, x, y - BH + j, BW, 1, pall ? 0x6a4c2a : 0x5a3a1a); r1(c, x, y - BH, BW, 2, pall ? 0xb8925e : 0x9a6a3a); }
  // jorden: mörk när den är vattnad i dag, ljus och sprucken när den är torr
  const wet = st === 'vattnad' || st === 'mogen';
  for (let i = 2; i < BW - 2; i++) for (let j = 0; j < 5; j++) r1(c, x + i, y - BH - 4 + j, 1, 1, tone(wet ? [0x2a1a10, 0x3a2414, 0x4a2e1a, 0x5a3a22] : [0x6a4a2a, 0x7a5a36, 0x8a6a42, 0x9a7a52], 0.4 + hash(i, j, 7) * 0.5, x + i, j));
  if (!b) return;
  const G = grodaOf(b.g);
  if (!G) return;
  const k = Math.min(1, b.v / G.dagar), ripe = st === 'mogen', dead = st === 'vissen';
  const leaf = dead ? [0x5a4a20, 0x7a6a30, 0x9a8a4a] : [0x2e6a26, 0x4a9a3a, 0x7ac85a];
  const n = 4;
  for (let p = 0; p < n; p++) {
    const px = x + 6 + p * 10, base = y - BH - 2;
    const h = dead ? 4 : Math.round(3 + k * 12) + (Math.sin(t * 2 + p) > 0.6 ? 1 : 0);
    // stjälken och bladen (sorten styr formen)
    if (G.id === 'lok' || G.id === 'rodlok') { for (let s = 0; s < 3; s++) for (let q = 0; q < h; q++) r1(c, px + s * 2 - 2 + (dead ? q >> 2 : 0), base - q, 1, 1, leaf[q % 3]); if (k > 0.5 || ripe) { const pal = ravaraPal(G.id); r1(c, px - 2, base - 1, 5, 3, pal[2]); r1(c, px - 1, base - 2, 3, 1, pal[3]); } }
    else if (G.id === 'morot') { for (let q = 0; q < h; q++) { r1(c, px + (q % 2 ? 1 : -1) * (q >> 2), base - q, 1, 1, leaf[(q + p) % 3]); r1(c, px, base - q, 1, 1, leaf[1]); } if (ripe || k > 0.6) r1(c, px - 1, base, 3, 2, 0xf07a1e); }
    else if (G.id === 'potatis') { for (let q = 0; q < h; q++) r1(c, px + Math.round(Math.sin(q) * 1.5), base - q, 1, 1, leaf[1]); for (let q = 2; q < h; q += 3) { r1(c, px - 2, base - q, 2, 2, leaf[2]); r1(c, px + 1, base - q - 1, 2, 2, leaf[0]); } if (ripe) r1(c, px, base - h - 1, 2, 2, 0xf4f1ea); }
    else { // tomat och paprika: buske med frukter
      for (let q = 0; q < h; q++) r1(c, px, base - q, 1, 1, leaf[0]);
      for (let q = 3; q < h; q += 3) { r1(c, px - 3, base - q, 3, 2, leaf[1]); r1(c, px + 1, base - q + 1, 3, 2, leaf[2]); }
      if (ripe || k > 0.7) { const pal = ravaraPal(G.id); for (let f = 0; f < (ripe ? 3 : 1); f++) { const fy = base - 4 - f * 4; r1(c, px + (f & 1 ? 2 : -3), fy, 3, 3, ripe ? pal[2] : 0x6ab83a); r1(c, px + (f & 1 ? 2 : -3), fy, 1, 1, ripe ? pal[4] : 0xa8e070); } }
    }
  }
  // en skylt med grödan, en droppe om den är torr, gnistor när den är mogen
  c.drawImage(ravaraIcon(G.id), x + BW - 13, y - BH + 6);
  if (st === 'torr') { const bob = Math.round(Math.sin(t * 4) * 1.5); r1(c, x + BW / 2 - 2, y - BH - 26 + bob, 5, 6, 0x3a8ae0); r1(c, x + BW / 2 - 1, y - BH - 28 + bob, 3, 2, 0x3a8ae0); r1(c, x + BW / 2 - 1, y - BH - 25 + bob, 1, 2, 0xc8e8ff); }
  if (ripe && Math.floor(t * 3) % 2) for (const [dx, dy] of [[4, -24], [BW - 6, -20], [BW / 2, -28]]) { r1(c, x + dx, y - BH + dy, 1, 3, 0xfff6a0); r1(c, x + dx - 1, y - BH + dy + 1, 3, 1, 0xfff6a0); }
}
function drawTree(c, ripe, t) {
  const { x, y } = TREE;
  r1(c, x - 3, y - 40, 7, 40, 0x6a4424); r1(c, x - 3, y - 40, 2, 40, 0x8a5a30);
  for (let j = -24; j <= 24; j++) for (let i = -30; i <= 30; i++) { const d = (i / 30) ** 2 + (j / 24) ** 2; if (d > 1 || (d > 0.8 && hash(i, j, 41) > 0.6)) continue; r1(c, x + i, y - 62 + j, 1, 1, tone([0x1e4a1a, 0x2e6a26, 0x3e8a32, 0x6ab84a], 0.6 - i / 80 - j / 60 + (hash(i, j, 42) - 0.5) * 0.3, x + i, j)); }
  if (ripe) for (let k = 0; k < 9; k++) { const ax = x - 22 + hash(k, 1, 43) * 44, ay = y - 74 + hash(k, 2, 43) * 30; r1(c, ax, ay, 3, 3, 0xd02c30); r1(c, ax, ay, 1, 1, 0xff9a88); }
}
function drawCan(c, x, y) { // vattenkannan (i handen eller på bänken)
  r1(c, x, y, 8, 6, 0x3a8a5a); r1(c, x, y, 8, 1, 0x6ab88a); r1(c, x + 8, y + 1, 4, 1, 0x3a8a5a); r1(c, x + 11, y, 2, 2, 0x3a8a5a); r1(c, x + 2, y - 3, 4, 1, 0x2a6a4a); r1(c, x + 1, y - 2, 1, 2, 0x2a6a4a); r1(c, x + 6, y - 2, 1, 2, 0x2a6a4a);
}

// ================= scenen =================
export function makeTradgard(A) {
  const g = A.game, kind = tradgardOf(g.home) ? g.home : 'radhus', T = tradgardOf(kind);
  if (!BG.has(kind)) BG.set(kind, paintBg(kind));
  const beds = BEDS[kind];
  const walker = createWalker({ W: FW, H: FH, left: 6, right: FW - 6, top: GROUND + 4, bottom: FH - 4, spawn: [DOOR.x0 + 14, GROUND + 10] });
  const obst = beds.map(([x, y]) => [x - 1, y - BH - 4, x + BW + 1, y + 1]);
  obst.push([BENCH.x0, BENCH.y - 10, BENCH.x1, BENCH.y]);
  if (T.trad) obst.push([TREE.x - 5, TREE.y - 6, TREE.x + 6, TREE.y + 1]);
  walker.setObstacles(obst); walker.snapFree();
  walker.speed = 70;
  let t = 0, hover = null, watering = 0;
  const drops = [];
  const gd = () => g.garden();
  const stateOf = (i) => g.bedState(gd().beds[i]);

  // bäddarna och kannan: samma odling som husvagnens krukor i staden (js/core/odla.js)
  const waterAt = (i) => () => { const [x, y] = beds[i]; water(x + BW / 2, y - BH); };
  const bedAction = (i) => odlaBed(A, i, { water: waterAt(i) });
  function water(x, y) { watering = 1.2; play('slide'); for (let k = 0; k < 18; k++) drops.push({ x: x + (Math.random() - 0.5) * 30, y: y - 20 - Math.random() * 6, vy: 30 + Math.random() * 30, life: 0.6 }); }
  const benchAction = () => waterAll(A, { water: () => water((BENCH.x0 + BENCH.x1) / 2 + 60, BENCH.y - 30) });
  function treeAction() {
    if (g.treeReady()) { const r = g.harvestTree(); play('ok'); toast($t`🍎 ${r.n} äpplen till skafferiet!${r.glad ? ` +${r.glad} 😊` : ''}`, 'good'); }
    else { const kvar = Math.max(1, 3 - (g.day - (gd().trad.skord | 0))); toast(kvar === 1 ? $t`🍎 Äpplena mognar om ${kvar} dag.` : $t`🍎 Äpplena mognar om ${kvar} dagar.`); }
  }
  function goIn() { play('door'); A.roomSub = 0; A.go('room'); }
  function spots() {
    const L = beds.map(([x, y], i) => ({ id: 'badd' + i, r: [x - 2, y - BH - 30, x + BW + 2, y + 2], go: [x + BW / 2, y + 8], act: () => bedAction(i) }));
    L.push({ id: 'bank', r: [BENCH.x0, BENCH.y - 26, BENCH.x1, BENCH.y], go: [(BENCH.x0 + BENCH.x1) / 2, BENCH.y + 8], act: benchAction });
    L.push({ id: 'dorr', r: [DOOR.x0 - 4, 20, DOOR.x1 + 4, GROUND + 6], go: [(DOOR.x0 + DOOR.x1) / 2, GROUND + 6], act: goIn });
    if (T.trad) L.push({ id: 'trad', r: [TREE.x - 32, TREE.y - 88, TREE.x + 32, TREE.y + 2], go: [TREE.x - 12, TREE.y + 8], act: treeAction });
    return L;
  }
  const spotAt = (x, y) => spots().find((s) => x >= s.r[0] && x <= s.r[2] && y >= s.r[1] && y <= s.r[3]);
  function label(ctx) {
    const s = hover && spotAt(hover.x, hover.y);
    if (!s) return;
    let txt = '';
    if (s.id.startsWith('badd')) { const i = +s.id.slice(4), b = gd().beds[i], st = stateOf(i), G = b && grodaOf(b.g); txt = st === 'tom' ? $t('TOM BÄDD - SÅ NÅGOT') : st === 'torr' ? $t`${G.name.toUpperCase()} - BEHÖVER VATTEN` : st === 'vattnad' ? $t`${G.name.toUpperCase()} - DAG ${b.v}/${G.dagar}` : st === 'mogen' ? $t`${G.name.toUpperCase()} - MOGEN! SKÖRDA` : $t('VISSNAD - RENSA'); }
    else txt = { bank: $t('VATTENKANNAN - VATTNA ALLT'), dorr: $t('IN IGEN'), trad: g.treeReady() ? $t('ÄPPELTRÄDET - PLOCKA ÄPPLEN') : $t('ÄPPELTRÄDET') }[s.id];
    const w = textW(SMALL, txt) + 10, x = Math.round(Math.max(2, Math.min(FW - w - 2, hover.x - w / 2))), y = Math.max(2, hover.y - 24);
    r1(ctx, x, y, w, 11, 'rgba(20,18,26,.9)'); ctxText(ctx, SMALL, txt, x + 5, y + 3, '#ffd23f');
  }

  return {
    get worldX() { return walker.px; }, get worldY() { return walker.py; },
    update(dt) {
      t += dt; walker.update(dt);
      if (watering > 0) watering -= dt;
      for (const d of drops) { d.y += d.vy * dt; d.life -= dt; }
      for (let i = drops.length - 1; i >= 0; i--) if (drops[i].life <= 0) drops.splice(i, 1);
    },
    draw(ctx) {
      ctx.setTransform(A.pxs, 0, 0, A.pxs, 0, 0);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(BG.get(kind), 0, 0);
      // kvällsljus (gult → blått) efter klockan
      const h = (g.min / 60) % 24, dusk = h >= 19 ? Math.min(1, (h - 19) / 3) : h < 6 ? 1 : 0;
      const items = [];
      beds.forEach(([x, y], i) => items.push({ fy: y, draw: () => drawBed(ctx, kind, x, y, gd().beds[i], stateOf(i), t) }));
      if (T.trad) items.push({ fy: TREE.y, draw: () => drawTree(ctx, g.treeReady(), t) });
      if (!(watering > 0)) items.push({ fy: BENCH.y - 1, draw: () => drawCan(ctx, BENCH.x0 + 8, BENCH.y - 20) });
      items.push(...folkDrawables(A, t), selfDrawable(A, walker, t));
      if (watering > 0) items.push({ fy: walker.py + 0.1, draw: () => drawCan(ctx, walker.px + (walker.dir === 'left' ? -14 : 4), walker.py - 22) });
      items.sort((a, b) => a.fy - b.fy).forEach((d) => d.draw(ctx));
      for (const d of drops) r1(ctx, d.x, d.y, 1, 2, 0x8ac8ff);
      if (dusk > 0) { ctx.fillStyle = `rgba(20,24,60,${(0.45 * dusk).toFixed(2)})`; ctx.fillRect(0, 0, FW, FH); }
      // namnet på platsen
      const name = $t(T.namn).toUpperCase(); r1(ctx, 4, 4, textW(SMALL, name) + 10, 11, 'rgba(20,18,26,.85)'); ctxText(ctx, SMALL, name, 9, 7, '#8edc4c');
      label(ctx);
    },
    down(x, y) {
      hover = { x, y };
      const s = spotAt(x, y);
      if (s) { walker.walkTo(s.go[0], s.go[1], s.act); return; }
      if (y > GROUND) walker.walkTo(x, y);
    },
    move(x, y) { hover = { x, y }; },
    exit() {},
    _debug: {
      beds: () => gd().beds.map((b, i) => ({ i, st: stateOf(i), b: b ? { ...b } : null })),
      spot: (id) => { const s = spots().find((x) => x.id === id); return s ? { x: Math.round((s.r[0] + s.r[2]) / 2), y: Math.round((s.r[1] + s.r[3]) / 2), go: s.go } : null; },
      act: (id) => { const s = spots().find((x) => x.id === id); if (!s) return false; s.act(); return true; },
      teleport: (x, y) => { walker.px = x; walker.py = y; walker.stop(); },
      kind: () => kind,
    },
  };
}
