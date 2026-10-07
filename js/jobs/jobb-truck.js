// FOODTRUCKEN – passet i luckan (eget företag, game.js TRUCK_*, js/core/foretag.js). Man står inne i
// trucken och ser ut genom den uppfällda luckan: platsen där trucken står (parken med fontänen,
// Tjurtorget i downtown, parkeringen i förorten) syns utanför. Kunderna ställer sig vid luckan och
// beställer (bubblan: rätterna + tålamodet). Man lagar vid stationerna inne i trucken – korvgrillen,
// stora grillen (hamburgare), tacobaren, glassfrysen och dryckeskylen (de man har uppgraderat till) –
// det färdiga hamnar på hyllan i luckan. Klicka på det på hyllan och sedan på kunden. Rätt = kunden
// betalar (priset efter priserna man valt), fel = det åker i soporna. Tröttnar kunden går hen arg.
// Det man säljer går direkt till en (g.truckPass) – passet är 4 timmar (75 s).
//   makeJobbTruck(A, { onDone })  onDone({ sald: [rätt-id], fel, arga, ok })
import { Pix, SMALL, BIG, ctxText, textW, mix, mul, hash, bayer } from '../core/floor-pix.js';
import { drawPerson, makeLookRich } from '../core/people.js';
import { openModal, closeModal } from '../core/ui.js';
import { play } from '../core/sound.js';
import { TRUCK_MENY, TRUCK_PRISER, truckRattOf, fmt } from '../game.js';
import { drawShiftHud, drawTimeUp, makePops } from './shift.js';
import { $t } from '../core/i18n.js';

const FW = 384, FH = 216;
export const TRUCK_DUR = 75;
const OUT_Y = 140;          // luckans underkant (hyllan)
const SHELF = { y0: 140, y1: 152 };
const SLOTS = [52, 112, 172, 232, 292];          // platser på hyllan (mitt)
const BIN = { x0: 330, x1: 360 };                // soptunnan längst till höger på hyllan
const SPOTS = [92, 192, 292];                    // där kunderna står vid luckan
const FEET = 152;                                // kundernas fötter (dolda bakom disken – huvud och överkropp syns)
const BENCH_Y = 162;
// stationerna inne i trucken (rätt-id, x-intervall)
const STATIONS = [
  { id: 'korv', x0: 6, x1: 82, namn: $t('KORVGRILL') },
  { id: 'burgare', x0: 86, x1: 164, namn: $t('STORA GRILLEN') },
  { id: 'taco', x0: 168, x1: 236, namn: $t('TACOBAR') },
  { id: 'glass', x0: 240, x1: 306, namn: $t('GLASSFRYS') },
  { id: 'dricka', x0: 310, x1: 378, namn: $t('DRYCKESKYL') },
];

// ---------------------------------------------------------------- bilderna på rätterna (12×12)
const ICON = new Map();
export function truckIcon(id) {
  if (ICON.has(id)) return ICON.get(id);
  const P = new Pix(12, 12);
  const o = 0x2a1e1a;
  if (id === 'korv') {
    for (let x = 1; x < 11; x++) { P.px(x, 7, 0xd8a050); P.px(x, 8, 0xc08838); P.px(x, 9, 0x9a6828); }
    for (let x = 2; x < 10; x++) { P.px(x, 5, 0xb8402a); P.px(x, 6, 0x8a2a1a); }
    P.px(1, 6, 0xb8402a); P.px(10, 6, 0xb8402a);
    for (let x = 2; x < 10; x += 2) { P.px(x, 4, 0xf0d030); P.px(x + 1, 5, 0xf0d030); }
    P.px(0, 7, o); P.px(11, 7, o); for (let x = 1; x < 11; x++) P.px(x, 10, o);
  } else if (id === 'burgare') {
    for (let x = 2; x < 10; x++) P.px(x, 2, 0xd8902a);
    for (let x = 1; x < 11; x++) { P.px(x, 3, 0xe8a040); P.px(x, 4, 0xc8802a); }
    P.px(3, 3, 0xfff0c0); P.px(6, 2, 0xfff0c0); P.px(8, 3, 0xfff0c0);
    for (let x = 0; x < 12; x++) P.px(x, 5, x % 2 ? 0x4aa83a : 0x6ac84a);
    for (let x = 1; x < 11; x++) P.px(x, 6, 0xf0c030);
    for (let x = 1; x < 11; x++) { P.px(x, 7, 0x6a3a1e); P.px(x, 8, 0x4a2814); }
    for (let x = 1; x < 11; x++) P.px(x, 9, 0xd8902a); for (let x = 2; x < 10; x++) P.px(x, 10, o);
  } else if (id === 'taco') {
    for (let y = 3; y < 11; y++) for (let x = 1; x < 11; x++) { const d = Math.hypot(x - 5.5, (y - 10) * 1.2); if (d < 6 && d > 4.2) P.px(x, y, y < 6 ? 0xf0c048 : 0xd8a030); }
    for (let x = 3; x < 9; x++) { P.px(x, 5, 0x5ab83a); P.px(x, 6, 0x8a4a2a); }
    P.px(4, 4, 0xd8302a); P.px(7, 4, 0xd8302a); P.px(5, 5, 0xf0e0a0);
  } else if (id === 'glass') {
    for (let y = 1; y < 6; y++) for (let x = 2; x < 10; x++) if (Math.hypot(x - 5.5, y - 4) < 4) P.px(x, y, y < 3 ? 0xffd0e0 : 0xf08ab0);
    P.px(5, 0, 0xd8202a); P.px(6, 0, 0xd8202a);
    for (let y = 6; y < 12; y++) { const w = Math.max(0, 4 - ((y - 6) * 0.7) | 0); for (let x = 6 - w; x < 6 + w; x++) P.px(x, y, (x + y) % 3 ? 0xd8a050 : 0xa87028); }
  } else if (id === 'dricka') {
    for (let y = 3; y < 12; y++) { const w = y < 10 ? 4 : 3; for (let x = 6 - w; x < 6 + w; x++) P.px(x, y, (y === 6 || y === 7) ? 0xf4f1ea : 0xd8302a); }
    for (let x = 1; x < 11; x++) P.px(x, 2, 0xf4f1ea); P.px(8, 0, 0x3a7bd5); P.px(7, 1, 0x3a7bd5);
  }
  const cv = P.flush();
  ICON.set(id, cv);
  return cv;
}

// ---------------------------------------------------------------- utsikten genom luckan
const BG = new Map();
function paintOut(plats, kvall) {
  const key = plats + (kvall ? ':k' : '');
  if (BG.has(key)) return BG.get(key);
  const P = new Pix(FW, FH);
  const sky = (top, bot) => { for (let y = 0; y < 70; y++) for (let x = 0; x < FW; x++) P.px(x, y, mix(top, bot, y / 70)); };
  if (plats === 'downtown') {
    sky(0x7ab0e0, 0xc8e0f4);
    // höga hus med fönsterrutor
    for (let i = 0, x = -10; x < FW; i++) {
      const w = 40 + hash(i, 1, 9) * 34, h = 60 + hash(i, 2, 9) * 50, top = 96 - h, glas = hash(i, 3, 9) > 0.5;
      const base = glas ? mix(0x5a7a9a, 0x8aa8c8, hash(i, 4, 9)) : mix(0x9a948a, 0xc8c0b0, hash(i, 4, 9));
      for (let y = Math.max(0, Math.round(top)); y < 96; y++) for (let xx = Math.round(x); xx < x + w; xx++) {
        const win = glas ? ((xx - x) % 6 < 4 && (y - top) % 7 < 5) : ((xx - x) % 8 > 2 && (xx - x) % 8 < 6 && (y - top) % 9 > 2 && (y - top) % 9 < 7);
        P.px(xx, y, win ? (kvall && hash(xx >> 2, y >> 3, i) > 0.6 ? 0xf8d878 : mul(base, glas ? 1.25 : 0.7)) : base);
      }
      x += w + 4;
    }
    // torgets plattor
    for (let y = 96; y < FH; y++) for (let x = 0; x < FW; x++) P.px(x, y, ((x + (y >> 3 & 1) * 6) % 12 === 0 || y % 8 === 0) ? 0xb8b0a0 : mix(0xd8d0c0, 0xc8c0b0, hash(x >> 3, y >> 3, 3)));
    // tjuren på sin sockel
    const bx = 250;
    P.rect(bx - 18, 92, 36, 10, 0x6a6a72); P.hl(bx - 18, 92, 36, 0x8a8a92);
    for (let y = 72; y < 92; y++) for (let x = bx - 20; x < bx + 20; x++) { const body = Math.hypot((x - bx) / 15, (y - 82) / 7) < 1, head = Math.hypot((x - bx - 15) / 6, (y - 77) / 5) < 1, leg = (y > 86 && [bx - 12, bx - 6, bx + 6, bx + 11].some((lx) => Math.abs(x - lx) < 2)); if (body || head || leg) P.px(x, y, mix(0x6a4a2a, 0x9a6a3a, (y - 72) / 20 + hash(x, y, 4) * 0.2)); }
    P.px(bx + 19, 72, 0xe8d8a0); P.px(bx + 20, 71, 0xe8d8a0); P.px(bx + 12, 72, 0xe8d8a0); P.px(bx + 11, 71, 0xe8d8a0);
    // kaffevagnen långt bort
    P.rect(60, 84, 22, 10, 0x2a6a4a); P.rect(58, 80, 26, 4, 0xf0e8d0); P.px(62, 95, 0x1a1a1e); P.px(78, 95, 0x1a1a1e);
  } else if (plats === 'fororten') {
    sky(0x9aa8b8, 0xd0d8e0);
    // betonghus med balkonger
    for (let i = 0, x = -6; x < FW; i++) {
      const w = 70 + hash(i, 1, 5) * 30, h = 50 + hash(i, 2, 5) * 30, top = 92 - h;
      for (let y = Math.round(top); y < 92; y++) for (let xx = Math.round(x); xx < x + w; xx++) {
        const r = (y - top) % 10, c = (xx - x) % 14;
        let col = mix(0x9a9a92, 0xb8b4a8, hash(i, 3, 5));
        if (r > 2 && r < 7 && c > 3 && c < 11) col = kvall && hash(xx >> 2, y >> 2, i) > 0.55 ? 0xf8d070 : 0x4a5a6a;
        if (r === 8) col = mul(col, 0.8);
        P.px(xx, y, col);
      }
      x += w + 8;
    }
    // asfalt med p-rutor och en parkerad bil
    for (let y = 92; y < FH; y++) for (let x = 0; x < FW; x++) P.px(x, y, mix(0x4a4a50, 0x5a5a62, hash(x >> 1, y >> 1, 7)));
    for (let x = 20; x < FW; x += 52) for (let y = 96; y < 128; y++) P.px(x, y, 0xd8d8d0);
    P.rect(130, 98, 34, 12, 0x3a7bd5); P.rect(136, 92, 22, 7, 0x3a7bd5); P.rect(138, 93, 18, 5, 0x9ac8e8); P.rect(132, 110, 6, 4, 0x1a1a1e); P.rect(156, 110, 6, 4, 0x1a1a1e);
    // graffiti på en mur
    P.rect(300, 76, 84, 18, 0x8a8a84);
    [[0xd8302a, 304], [0xf0c030, 324], [0x3ab8a8, 344], [0xc65fa0, 362]].forEach(([c, x]) => { for (let k = 0; k < 14; k++) P.px(x + k, 82 + Math.round(Math.sin(k / 2) * 3), c); });
  } else {
    sky(0x8ac8f0, 0xd8eef8);
    // trädraden långt bort
    for (let x = 0; x < FW; x++) { const h = 14 + Math.sin(x / 9) * 4 + Math.sin(x / 4) * 2 + hash(x >> 2, 1, 3) * 3; for (let y = Math.round(70 - h); y < 72; y++) P.px(x, y, mix(0x2e6a26, 0x4a8a3a, hash(x >> 1, y >> 1, 2))); }
    // gräset och grusgången
    for (let y = 72; y < FH; y++) for (let x = 0; x < FW; x++) {
      const path = Math.abs((x - 60) - (y - 72) * 1.6) < 14;
      P.px(x, y, path ? mix(0xd8c8a0, 0xc8b890, hash(x, y, 5)) : (bayer(x, y) < 0.15 ? 0x6ac84a : mix(0x4a9a3a, 0x5aaa42, hash(x >> 2, y >> 2, 6))));
    }
    // fontänen
    const fx = 270;
    for (let y = 84; y < 100; y++) for (let x = fx - 34; x < fx + 34; x++) { const d = Math.hypot((x - fx) / 34, (y - 92) / 8); if (d < 1) P.px(x, y, d > 0.8 ? 0x8a8a90 : mix(0x5ab0e0, 0x8ad0f0, hash(x, y, 8))); }
    P.rect(fx - 4, 70, 8, 18, 0x9a9aa0); P.rect(fx - 10, 68, 20, 4, 0xa8a8b0);
    for (let k = 0; k < 10; k++) P.px(fx - 6 + k + (k % 3), 60 + (k * 7) % 9, 0xc8e8f8);
    // blommor
    for (let k = 0; k < 40; k++) P.px((hash(k, 1, 11) * FW) | 0, 100 + ((hash(k, 2, 11) * 40) | 0), [0xf06a8a, 0xf0d030, 0xffffff][k % 3]);
  }
  if (kvall) for (let y = 0; y < FH; y++) for (let x = 0; x < FW; x++) P.px(x, y, 0x283868, 0.32);
  // ---- trucken runt luckan: markisen, stolparna, hyllan och väggen nedanför
  for (let y = 0; y < 16; y++) for (let x = 0; x < FW; x++) P.px(x, y, ((x >> 4) & 1) ? 0xd8343c : 0xf4f1ea);
  for (let x = 0; x < FW; x += 16) for (let k = 0; k < 6; k++) { P.px(x + 8 + Math.round(Math.sin(k) * 1), 16 + k, ((x >> 4) & 1) ? 0xd8343c : 0xf4f1ea); }
  P.hl(0, 15, FW, 0x8a2028);
  for (const [x0, x1] of [[0, 14], [FW - 14, FW]]) { P.rect(x0, 0, x1 - x0, FH, 0xe8e4d8); P.vl(x0 === 0 ? 13 : FW - 14, 0, OUT_Y, 0x8a8478); P.vl(x0 === 0 ? 1 : FW - 2, 0, FH, 0xfaf8f0); }
  // hyllan (rostfri)
  P.rect(0, SHELF.y0, FW, SHELF.y1 - SHELF.y0, 0xc8ccd4); P.hl(0, SHELF.y0, FW, 0xf0f2f6); P.hl(0, SHELF.y1 - 1, FW, 0x8a8e96);
  for (let x = 0; x < FW; x += 3) P.px(x, SHELF.y0 + 5, 0xb8bcc4);
  // soptunnan på hyllan
  P.rect(BIN.x0, SHELF.y0 - 12, BIN.x1 - BIN.x0, 12, 0x3a6a4a); P.hl(BIN.x0, SHELF.y0 - 12, BIN.x1 - BIN.x0, 0x5a9a6a); P.rect(BIN.x0 + 10, SHELF.y0 - 14, 10, 2, 0x2a4a3a);
  // väggen under hyllan (insidan) och arbetsbänken
  P.rect(0, SHELF.y1, FW, BENCH_Y - SHELF.y1, 0x4a4e58); for (let x = 0; x < FW; x += 24) P.vl(x, SHELF.y1, BENCH_Y - SHELF.y1, 0x3a3e48);
  P.rect(0, BENCH_Y, FW, FH - BENCH_Y, 0x6a6e78); P.hl(0, BENCH_Y, FW, 0xb8bcc6); P.hl(0, BENCH_Y + 1, FW, 0x9a9ea8);
  // stationerna
  for (const S of STATIONS) {
    const x0 = S.x0, w = S.x1 - S.x0, y0 = BENCH_Y + 4;
    if (S.id === 'korv' || S.id === 'burgare') {
      P.rect(x0, y0, w, 30, 0x2a2a30); P.hl(x0, y0, w, 0x5a5a62);
      for (let y = y0 + 4; y < y0 + 26; y += 3) P.hl(x0 + 4, y, w - 8, 0x4a4a52);
      for (let k = 0; k < 18; k++) P.px(x0 + 4 + ((hash(k, S.x0, 3) * (w - 8)) | 0), y0 + 24 + ((hash(k, 2, 3) * 4) | 0), [0xf06a2a, 0xffb040, 0xd8302a][k % 3]);
    } else if (S.id === 'taco') {
      P.rect(x0, y0, w, 30, 0xd8d8d0); P.hl(x0, y0, w, 0xf4f4ee);
      [[0x5ab83a, 0], [0x8a4a2a, 1], [0xd8302a, 2], [0xf0e0a0, 3]].forEach(([c, i]) => { const bx = x0 + 4 + i * 16; P.rect(bx, y0 + 6, 13, 9, 0x9aa0a8); P.rect(bx + 1, y0 + 7, 11, 7, c); });
    } else if (S.id === 'glass') {
      P.rect(x0, y0, w, 30, 0xe8f0f8); P.rect(x0 + 2, y0 + 2, w - 4, 12, 0xb8d8f0);
      [0xffd0e0, 0xf0e0b0, 0x8a5a3a, 0xa8e0a8].forEach((c, i) => P.rect(x0 + 6 + i * 14, y0 + 5, 10, 7, c));
    } else {
      P.rect(x0, y0, w, 30, 0xe8e8ec); P.rect(x0 + 3, y0 + 3, w - 6, 22, 0x2a3a4a);
      for (let i = 0; i < 8; i++) P.rect(x0 + 6 + i * 7, y0 + 8 + (i % 2) * 8, 4, 7, [0xd8302a, 0x3a7bd5, 0x46a35a, 0xf0b429][i % 4]);
    }
  }
  const cv = P.flush();
  BG.set(key, cv);
  return cv;
}

// ---------------------------------------------------------------- scenen
export function makeJobbTruck(A, { onDone }) {
  const g = A.game, T = g.truck;
  const meny = g.truckMeny();
  const har = new Set(meny.map((m) => m.id));
  const pr = TRUCK_PRISER[T?.priser] || TRUCK_PRISER.vanlig;
  const plats = T?.plats || 'parken';
  const kvall = g.min >= 18 * 60 || g.min < 6 * 60;
  const takt = { parken: 1, downtown: 0.8, fororten: 1.25 }[plats] || 1;
  const pops = makePops();
  const stats = { sald: [], fel: 0, arga: 0, ok: 0, kr: 0 };
  let t = 0, done = false, doneT = 0, reported = false, seq = 0, spawnIn = 1.2, sel = -1, flash = null;
  const shelf = SLOTS.map(() => null);           // rätt-id på hyllan
  const cooking = STATIONS.map(() => null);      // { id, t, dur } per station
  const kunder = [];                             // { id, look, x, spot, state, order: [id], tal, max, dir }

  const free = () => shelf.indexOf(null);
  const spotFree = (i) => !kunder.some((k) => k.spot === i && k.state !== 'gar');
  function newKund() {
    const i = [0, 1, 2].filter(spotFree)[Math.floor(Math.random() * 3)] ?? [0, 1, 2].find(spotFree);
    if (i === undefined) return;
    const ratter = meny.filter((m) => m.id !== 'dricka');
    const order = [ratter[Math.floor(Math.random() * ratter.length)].id];
    if (Math.random() < 0.3 && ratter.length) order.push(ratter[Math.floor(Math.random() * ratter.length)].id);
    if (har.has('dricka') && Math.random() < 0.45) order.push('dricka');
    const fromLeft = Math.random() < 0.5;
    const max = 24 - Math.min(8, t * 0.06);
    kunder.push({ id: seq++, look: makeLookRich(), x: fromLeft ? -20 : FW + 20, spot: i, state: 'in', order, tal: max, max, dir: fromLeft ? 'right' : 'left' });
  }
  function startCook(si) {
    const S = STATIONS[si];
    if (!har.has(S.id)) { pops.add((S.x0 + S.x1) / 2, BENCH_Y - 4, $t('UPPGRADERA!'), '#ffd23f'); play('fel'); return; }
    if (cooking[si]) return;
    const R = truckRattOf(S.id);
    if (!R.tid) { if (!toShelf(S.id)) return; play('click'); return; }
    cooking[si] = { id: S.id, t: 0, dur: R.tid };
    play('click');
  }
  function toShelf(id) {
    const f = free();
    if (f < 0) { pops.add(FW / 2, SHELF.y0 - 8, $t('HYLLAN ÄR FULL'), '#ff6a5a'); play('fel'); return false; }
    shelf[f] = id;
    return true;
  }
  function serve(k) {
    if (sel < 0 || !shelf[sel]) return;
    const id = shelf[sel];
    shelf[sel] = null; sel = -1;
    const at = k.order.indexOf(id);
    if (at < 0) { stats.fel++; k.tal = Math.max(1, k.tal - k.max * 0.3); pops.add(k.x, FEET - 60, $t('FEL!'), '#ff6a5a'); play('fel'); return; }
    k.order.splice(at, 1);
    const kr = Math.round(truckRattOf(id).pris * pr.mult);
    stats.sald.push(id); stats.kr += kr;
    pops.add(k.x, FEET - 60, $t`+${kr} KR`, '#7ee07e');
    play('ok');
    if (!k.order.length) { k.state = 'gar'; k.dir = k.x < FW / 2 ? 'left' : 'right'; stats.ok++; play('coin'); }
  }
  function finish() { if (!done) { done = true; doneT = 0; } }
  const kundAt = (x, y) => kunder.find((k) => k.state === 'vantar' && Math.abs(k.x - x) < 14 && y > FEET - 52 && y < SHELF.y0);

  return {
    update(dt) {
      pops.update(dt);
      if (done) { doneT += dt; if (doneT > 1.2 && !reported) { reported = true; onDone(stats); } return; }
      t += dt;
      if (t >= TRUCK_DUR) { finish(); return; }
      spawnIn -= dt;
      if (spawnIn <= 0) { spawnIn = (5.2 - Math.min(2, t * 0.03)) * takt * (pr.kunder ? 1 / pr.kunder : 1) * (0.8 + Math.random() * 0.4); newKund(); }
      // det som steker: klart → till hyllan (är hyllan full väntar det på grillen tills det finns plats)
      cooking.forEach((c, i) => {
        if (!c) return;
        if (c.t < c.dur) { c.t = Math.min(c.dur, c.t + dt); if (c.t >= c.dur && free() < 0) pops.add((STATIONS[i].x0 + STATIONS[i].x1) / 2, BENCH_Y - 4, $t('HYLLAN ÄR FULL'), '#ff6a5a'); }
        if (c.t >= c.dur && free() >= 0) { shelf[free()] = c.id; cooking[i] = null; play('ok'); }
      });
      for (const k of kunder) {
        const tx = k.state === 'gar' ? (k.dir === 'left' ? -30 : FW + 30) : SPOTS[k.spot];
        if (k.state === 'in' || k.state === 'gar') {
          const d = tx - k.x, step = 48 * dt;
          k.dir = d < 0 ? 'left' : 'right';
          if (Math.abs(d) <= step) { k.x = tx; if (k.state === 'in') { k.state = 'vantar'; k.dir = 'down'; } } else k.x += Math.sign(d) * step;
        } else if (k.state === 'vantar') {
          k.tal -= dt;
          if (k.tal <= 0) { k.state = 'gar'; k.arg = true; k.dir = k.x < FW / 2 ? 'left' : 'right'; stats.arga++; pops.add(k.x, FEET - 60, $t('SUCK…'), '#ff9a5a'); play('fel'); }
        }
      }
      for (let i = kunder.length - 1; i >= 0; i--) if (kunder[i].state === 'gar' && (kunder[i].x < -24 || kunder[i].x > FW + 24)) kunder.splice(i, 1);
      if (flash) { flash.t -= dt; if (flash.t <= 0) flash = null; }
    },
    down(x, y) {
      if (done) return;
      // stäng luckan i förtid (skylten på högra stolpen)
      if (x > FW - 14 && y > 40 && y < 80) { askClose(); return; }
      // hyllan: välj det som ska lämnas ut
      if (y >= SHELF.y0 - 14 && y < SHELF.y1) {
        if (x >= BIN.x0 && x <= BIN.x1) { if (sel >= 0) { shelf[sel] = null; sel = -1; play('slide'); } return; }
        const i = SLOTS.findIndex((sx) => Math.abs(sx - x) <= 14);
        if (i >= 0 && shelf[i]) { sel = sel === i ? -1 : i; play('click'); return; }
      }
      // en kund vid luckan
      const k = kundAt(x, y);
      if (k) { if (sel >= 0) serve(k); else { pops.add(k.x, FEET - 60, k.order.map((id) => truckRattOf(id).namn.split(' ')[0].toUpperCase()).join(' + '), '#f4f1ea'); } return; }
      // stationerna
      if (y >= BENCH_Y) { const si = STATIONS.findIndex((S) => x >= S.x0 && x <= S.x1); if (si >= 0) startCook(si); }
    },
    key(k) { if (k === 'Escape' && !done) askClose(); },
    draw(ctx) {
      ctx.setTransform(A.pxs, 0, 0, A.pxs, 0, 0);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(paintOut(plats, kvall), 0, 0);
      // kunderna (bakom hyllan – fötterna döljs av väggen nedanför)
      ctx.save(); ctx.beginPath(); ctx.rect(14, 16, FW - 28, SHELF.y0 - 16); ctx.clip();
      for (const k of [...kunder].sort((a, b) => a.id - b.id)) drawPerson(ctx, k.x, FEET, k.look, k.dir, k.state === 'vantar' ? 0 : [1, 3, 2, 3][Math.floor(t * 8 + k.id) % 4]);
      ctx.restore();
      // bubblorna: beställningen och tålamodet
      for (const k of kunder) {
        if (k.state !== 'vantar') continue;
        const n = k.order.length, w = n * 14 + 6, x = Math.round(k.x - w / 2), y = FEET - 66;
        ctx.fillStyle = '#1e1a24'; ctx.fillRect(x - 1, y - 1, w + 2, 22);
        ctx.fillStyle = '#f4f1ea'; ctx.fillRect(x, y, w, 20);
        k.order.forEach((id, i) => ctx.drawImage(truckIcon(id), x + 3 + i * 14, y + 2));
        const f = Math.max(0, k.tal / k.max);
        ctx.fillStyle = '#3a3a42'; ctx.fillRect(x + 2, y + 16, w - 4, 2);
        ctx.fillStyle = f > 0.5 ? '#46b964' : f > 0.25 ? '#f0b429' : '#d9433b'; ctx.fillRect(x + 2, y + 16, Math.round((w - 4) * f), 2);
        ctx.fillStyle = '#f4f1ea'; ctx.fillRect(Math.round(k.x) - 1, y + 20, 3, 2);
      }
      // det som står på hyllan
      shelf.forEach((id, i) => {
        if (!id) return;
        const x = SLOTS[i] - 6, y = SHELF.y0 - 12 - (sel === i ? 3 : 0);
        if (sel === i) { ctx.fillStyle = '#ffd23f'; ctx.fillRect(x - 2, y - 2, 16, 16); }
        ctx.fillStyle = '#f4f1ea'; ctx.fillRect(x - 1, SHELF.y0 - 1, 14, 2);
        ctx.drawImage(truckIcon(id), x, y);
      });
      // stationerna: namnet, ikonen, låset och det som steker
      STATIONS.forEach((S, i) => {
        const cx = (S.x0 + S.x1) / 2, ok = har.has(S.id), c = cooking[i];
        ctxText(ctx, SMALL, S.namn, Math.round(cx - textW(SMALL, S.namn) / 2), FH - 13, ok ? '#f4f1ea' : '#8a8e96');
        if (!ok) { ctx.fillStyle = 'rgba(20,20,26,.55)'; ctx.fillRect(S.x0, BENCH_Y + 4, S.x1 - S.x0, 30); ctxText(ctx, SMALL, $t('LÅST'), Math.round(cx - textW(SMALL, $t('LÅST')) / 2), BENCH_Y + 14, '#ffd23f'); return; }
        if (c) {
          ctx.drawImage(truckIcon(c.id), Math.round(cx - 6), BENCH_Y + 8);
          ctx.fillStyle = '#1e1a24'; ctx.fillRect(S.x0 + 6, BENCH_Y + 26, S.x1 - S.x0 - 12, 4);
          ctx.fillStyle = c.t >= c.dur ? '#ffd23f' : '#46b964'; ctx.fillRect(S.x0 + 6, BENCH_Y + 26, Math.round((S.x1 - S.x0 - 12) * Math.min(1, c.t / c.dur)), 4);
          if (S.id === 'korv' || S.id === 'burgare') for (let k = 0; k < 3; k++) { const u = (t * 1.5 + k / 3) % 1; ctx.fillStyle = `rgba(220,220,230,${(0.5 * (1 - u)).toFixed(2)})`; ctx.fillRect(Math.round(cx - 6 + k * 5), Math.round(BENCH_Y + 6 - u * 14), 2, 2); }
        } else ctx.drawImage(truckIcon(S.id), Math.round(cx - 6), BENCH_Y - 8 + 18);
      });
      // STÄNG-skylten på högra stolpen
      ctx.fillStyle = '#d9433b'; ctx.fillRect(FW - 13, 46, 12, 30);
      const stang = $t('STÄNG');
      for (let i = 0; i < stang.length; i++) ctxText(ctx, SMALL, stang[i], FW - 10, 49 + i * 5.4 | 0, '#f4f1ea');
      pops.draw(ctx);
      drawShiftHud(ctx, { W: FW }, { t, dur: TRUCK_DUR, ok: stats.ok, fel: stats.fel + stats.arga, title: $t`FOODTRUCKEN ${fmt(stats.kr).toUpperCase()}` });
      if (done) drawTimeUp(ctx, { W: FW, H: FH });
    },
    exit() {},
    _debug: {
      stats: () => ({ ...stats, sald: [...stats.sald] }),
      kunder: () => kunder.map((k) => ({ id: k.id, x: Math.round(k.x), st: k.state, order: [...k.order], spot: k.spot })),
      shelf: () => [...shelf],
      meny: () => [...har],
      force: (order) => { const i = [0, 1, 2].find(spotFree); if (i === undefined) return null; kunder.push({ id: seq++, look: makeLookRich(), x: SPOTS[i], spot: i, state: 'vantar', order: [...order], tal: 30, max: 30, dir: 'down' }); return i; },
      cook: (id) => { const si = STATIONS.findIndex((S) => S.id === id); if (si < 0) return false; startCook(si); return true; },
      fastCook: () => { cooking.forEach((c, i) => { if (c) { c.t = c.dur; } }); },
      pick: (i) => { sel = i; },
      serveTo: (spot) => { const k = kunder.find((q) => q.spot === spot && q.state === 'vantar'); if (k) serve(k); return !!k; },
      slot: (i) => ({ x: SLOTS[i], y: SHELF.y0 - 6 }),
      station: (id) => { const S = STATIONS.find((q) => q.id === id); return S ? { x: (S.x0 + S.x1) / 2, y: BENCH_Y + 16 } : null; },
      spot: (i) => ({ x: SPOTS[i], y: FEET - 30 }),
      end: () => finish(),
    },
  };
  function askClose() {
    openModal($t('🚚 Stänga luckan?'), `<p style="font-size:var(--f2);margin-top:0">${$t`Stänger du nu får du det du sålt hittills (${fmt(stats.kr)}).`}</p>`, [
      { label: $t('Fortsätt sälja'), cls: 'btn-go', onClick: closeModal },
      { label: $t('Stäng luckan'), onClick: () => { closeModal(); finish(); } },
    ]);
  }
}
