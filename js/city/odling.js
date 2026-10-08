// 🌱 HUSVAGNENS ODLING – Carl 2026-10-08: "the garden outside the caravan is really ugly … it looks like
// the oldschool game we built first … we can just have it as the suburbs with plantpots and a watercan
// (vattenkanna) så man kan vattna med den … det kan vara samma vy vi redan har ute i staden men att den är
// inhängad bakom husvagnen".
//
// Odlingen ligger mitt i staden, bakom husvagnen på vagnsplatsen (map.js ODLING). Trästaketet står i
// props.js och jorden målas i ground.js – här finns det som lever: tre stora terrakottakrukor med
// plantorna (en kruka per bädd i husvagnens trädgård, game.js TRADGARD.husvagn) och den gröna
// vattenkannan i hörnet. Den som bor i husvagnen klickar på en kruka: tom = så (fröpåsen), torr = vattna,
// växer = hur långt, mogen = skörda, vissen = rensa (js/core/odla.js, samma som trädgårdsscenen).
// Klick på kannan = vattna allt. Medan man vattnar håller figuren kannan och det droppar ur stril.
//
// Kontrakt: createOdling(env, { game, me }) → { items(), obstacles, update(dt), potAt(x, y), canAt(x, y),
//   water(i), _debug }   game() = spelet, me() = { x, y, dir } (figuren i staden)
//   openPot(A, O, i), useCan(A, O)  – det som händer när figuren har gått fram
import { Pix, mix, mul, hash, bayer } from '../core/floor-pix.js';
import { ODLING } from './map.js';
import { grodaOf } from '../game.js';
import { ravaraPal } from '../core/ravara-art.js';
import { toast } from '../core/ui.js';
import { bedAction, waterAll } from '../core/odla.js';
import { $t } from '../core/i18n.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
function tone(pal, v, x, y) {
  const f = clamp(v, 0, 0.999) * (pal.length - 1);
  let i = Math.floor(f);
  if (f - i > 0.25 + bayer(x, y) * 0.5) i++;
  return pal[Math.min(pal.length - 1, i)];
}
const css = (c) => `#${(c >>> 0).toString(16).padStart(6, '0')}`;
const r1 = (ctx, x, y, w, h, c) => { ctx.fillStyle = typeof c === 'number' ? css(c) : c; ctx.fillRect(Math.round(x), Math.round(y), w, h); };
// en sprite: (0,0) = fotpunkten, som ligger på canvasens (ax, ay)
function spr(w, h, ax, ay, fn) { const P = new Pix(w, h, -ax, -ay); fn(P); outline(P); return { img: P.flush(), ax, ay }; }
const put = (ctx, s, x, y) => ctx.drawImage(s.img, Math.round(x) - s.ax, Math.round(y) - s.ay);
// mörk, färgad kontur runt allt målat (hård nedtill/höger, mjukare uppe/vänster – ljuset kommer från vänster uppe)
function outline(P) {
  const { w, h, d } = P;
  const on = (x, y) => x >= 0 && y >= 0 && x < w && y < h && d[(y * w + x) * 4 + 3] > 200;
  const add = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (on(x, y)) continue;
    const below = on(x, y - 1), right = on(x - 1, y), above = on(x, y + 1), left = on(x + 1, y);
    if (below || right) add.push([x, y, 1]); else if (above || left) add.push([x, y, 0.7]);
  }
  for (const [x, y, a] of add) { const i = (y * w + x) * 4; d[i] = 0x24; d[i + 1] = 0x14; d[i + 2] = 0x14; d[i + 3] = Math.round(a * 255); }
}

// ---------- krukan: terrakotta, sedd lite uppifrån (kanten är en ellips, myllan syns i öppningen) ----------
const TERRA = [0x4a1c10, 0x78301a, 0xa4472a, 0xc8663c, 0xe48c5a, 0xf4b484];
const RIM = { cy: -14, rx: 10, ry: 3, irx: 8, iry: 1.8 };         // kantens ellips och öppningen
const inOpen = (x, y) => ((x + 0.5) / RIM.irx) ** 2 + ((y + 0.5 - RIM.cy) / RIM.iry) ** 2 < 1;
const inRim = (x, y) => ((x + 0.5) / RIM.rx) ** 2 + ((y + 0.5 - RIM.cy) / RIM.ry) ** 2 < 1;
function paintPot(P, seed) {
  // kroppen: 12 rader under kanten, smalnar av nedåt (9 → 7 px åt varje håll), rund i ljuset
  for (let y = -13; y <= -1; y++) {
    const k = (y + 13) / 12, half = 9 - Math.round(k * 2);
    for (let x = -half; x < half; x++) {
      const u = (x + half + 0.5) / (2 * half);                   // 0 vänster … 1 höger
      let v = 0.86 - u * 0.62 - k * 0.1 + (hash(x, y, seed) - 0.5) * 0.08;
      if (x === -half) v += 0.08; else if (x === half - 1) v -= 0.12;
      if (y === -1) v -= 0.2;                                    // mörk fot
      P.px(x, y, tone(TERRA, v, x, y));
    }
  }
  // vulsten under kanten: en mörkare rand runt krukan
  for (let x = -9; x < 9; x++) P.px(x, -11, tone(TERRA, 0.42 - (x + 9) / 18 * 0.3, x, -11));
  // kanten: ellipsring, ljus överst/vänster; öppningen lämnas tom (myllan ritas varje bildruta)
  for (let y = RIM.cy - RIM.ry - 1; y <= RIM.cy + RIM.ry + 1; y++) for (let x = -RIM.rx - 1; x <= RIM.rx; x++) {
    if (!inRim(x, y) || inOpen(x, y)) continue;
    const front = y > RIM.cy;                                    // framkanten (mot oss) är solbelyst
    const v = (front ? 0.78 : 0.5) - (x + RIM.rx) / (2 * RIM.rx) * 0.35 + (y === RIM.cy - RIM.ry ? 0.15 : 0);
    P.px(x, y, tone(TERRA, v, x, y));
  }
  // kalkränder och en flisa i kanten (olika på varje kruka)
  for (let i = 0; i < 6; i++) { const x = -7 + Math.round(hash(i, 1, seed) * 13), y = -9 + Math.round(hash(i, 2, seed) * 7); P.px(x, y, mix(TERRA[3], 0xe8dcc8, 0.45)); }
  const fx = -6 + Math.round(hash(3, 3, seed) * 12); P.px(fx, RIM.cy + RIM.ry, TERRA[1]); P.px(fx + 1, RIM.cy + RIM.ry, TERRA[2]);
  // slagskugga på marken
  for (let x = -10; x <= 11; x++) for (let y = 0; y <= 2; y++) { const t = ((x - 1) / 11) ** 2 + ((y - 0.5) / 2) ** 2; if (t < 1 && !P.get(x, y)) P.px(x, y, 0x0a0c18, 0.3 * (1 - t) + 0.08); }
}
// ---------- vattenkannan: grönlackerad plåt med stril, ljus från vänster ----------
const CANG = [0x16402a, 0x23603c, 0x33804e, 0x47a062, 0x6cc482, 0xb2e6c0];   // klargrön mot den mörka myllan
function paintCan(P) {
  for (let y = -8; y <= -1; y++) for (let x = -5; x <= 4; x++) {        // kroppen (en låg cylinder)
    const u = (x + 5) / 9; let v = 0.82 - u * 0.6 + (y === -8 ? 0.15 : 0) - (y === -1 ? 0.25 : 0);
    if (y === -5) v -= 0.12;                                              // pressad rand
    P.px(x, y, tone(CANG, v, x, y));
  }
  for (const [x, y] of [[-3, -10], [-2, -11], [-1, -11], [0, -11], [1, -11], [2, -10]]) P.px(x, y, CANG[4]);   // handtaget
  P.px(-4, -9, CANG[3]); P.px(3, -9, CANG[2]);
  for (let k = 0; k < 6; k++) P.px(5 + k, -3 - k, k < 5 ? tone(CANG, 0.7 - k * 0.05, 5 + k, -3 - k) : CANG[4]);  // pipen
  for (let k = 0; k < 5; k++) P.px(5 + k, -2 - k, CANG[1]);
  P.px(11, -9, 0xd8d0b8); P.px(11, -8, 0xb8ae96); P.px(12, -9, 0xb8ae96); P.px(10, -9, 0xe8e0c8);            // strilen (mässing)
  for (let x = -5; x <= 6; x++) { const t = (x / 6) ** 2; if (!P.get(x, 0)) P.px(x, 0, 0x0a0c18, 0.32 * (1 - t) + 0.06); }
}
const POT_ART = [0, 1, 2].map((i) => spr(26, 24, 12, 19, (P) => paintPot(P, 701 + i * 17)));
const CAN_ART = spr(22, 16, 7, 13, paintCan);

// myllan i öppningen: mörk och blank när den är vattnad i dag, ljus och sprucken när den är torr
const MYLLA_VAT = [0x1e140c, 0x2c1e12, 0x3c2a18, 0x4e3820];
const MYLLA_TORR = [0x6a5038, 0x7e6244, 0x927452, 0xa88a66];
const OPEN = [];
for (let y = RIM.cy - 2; y <= RIM.cy + 2; y++) for (let x = -RIM.irx; x < RIM.irx; x++) if (inOpen(x, y)) OPEN.push([x, y]);
function drawSoil(ctx, px, py, wet) {
  for (const [x, y] of OPEN) {
    const back = y < RIM.cy;                                              // bakre delen ligger i skugga under kanten
    let v = 0.45 + (hash(x, y, 731) - 0.5) * 0.5 - (back ? 0.25 : 0);
    if (!wet && hash(x >> 1, y, 732) > 0.8) v = 0.05;                     // sprickor i torr jord
    r1(ctx, px + x, py + y, 1, 1, tone(wet ? MYLLA_VAT : MYLLA_TORR, v, x, y));
  }
  if (wet) r1(ctx, px - 3, py + RIM.cy, 2, 1, 0x6a5a48);                 // blänk i den blöta jorden
}

// plantorna i en kruka: två stånd (sorten styr formen), höjden efter hur många nätter de har växt
function drawPlants(ctx, px, py, b, st, t) {
  const G = grodaOf(b.g);
  if (!G) return;
  const k = Math.min(1, b.v / G.dagar), ripe = st === 'mogen', dead = st === 'vissen';
  const leaf = dead ? [0x5a4a20, 0x7a6a30, 0x9a8a4a] : [0x2e6a26, 0x4a9a3a, 0x7ac85a];
  for (let p = 0; p < 2; p++) {
    const x0 = px + (p ? 3 : -4), base = py + RIM.cy;
    const h = dead ? 3 : Math.round(3 + k * 11) + (Math.sin(t * 2 + p * 1.7) > 0.7 ? 1 : 0);
    if (G.id === 'lok' || G.id === 'rodlok') {
      for (let s = 0; s < 3; s++) for (let q = 0; q < h; q++) r1(ctx, x0 + s * 2 - 2 + (dead ? q >> 2 : 0), base - q, 1, 1, leaf[q % 3]);
      if (k > 0.5 || ripe) { const pal = ravaraPal(G.id); r1(ctx, x0 - 2, base - 1, 5, 3, pal[2]); r1(ctx, x0 - 1, base - 2, 3, 1, pal[3]); }
    } else if (G.id === 'morot') {
      for (let q = 0; q < h; q++) { r1(ctx, x0 + (q % 2 ? 1 : -1) * (q >> 2), base - q, 1, 1, leaf[(q + p) % 3]); r1(ctx, x0, base - q, 1, 1, leaf[1]); }
      if (ripe || k > 0.6) r1(ctx, x0 - 1, base, 3, 1, 0xf07a1e);
    } else if (G.id === 'potatis') {
      for (let q = 0; q < h; q++) r1(ctx, x0 + Math.round(Math.sin(q) * 1.5), base - q, 1, 1, leaf[1]);
      for (let q = 2; q < h; q += 3) { r1(ctx, x0 - 2, base - q, 2, 2, leaf[2]); r1(ctx, x0 + 1, base - q - 1, 2, 2, leaf[0]); }
      if (ripe) r1(ctx, x0, base - h - 1, 2, 2, 0xf4f1ea);
    } else {                                                              // tomat och paprika: en buske med frukter
      for (let q = 0; q < h; q++) r1(ctx, x0, base - q, 1, 1, leaf[0]);
      for (let q = 3; q < h; q += 3) { r1(ctx, x0 - 3, base - q, 3, 2, leaf[1]); r1(ctx, x0 + 1, base - q + 1, 3, 2, leaf[2]); }
      if (ripe || k > 0.7) {
        const pal = ravaraPal(G.id);
        for (let f = 0; f < (ripe ? 2 : 1); f++) { const fy = base - 4 - f * 4, fx = x0 + (f & 1 ? 2 : -3); r1(ctx, fx, fy, 3, 3, ripe ? pal[2] : 0x6ab83a); r1(ctx, fx, fy, 1, 1, ripe ? pal[4] : 0xa8e070); }
      }
    }
  }
}
// en droppe som guppar över en torr kruka, gnistor över en mogen
function drawBadge(ctx, px, py, st, t) {
  const top = py + RIM.cy - 22;
  if (st === 'torr') { const bob = Math.round(Math.sin(t * 4) * 1.5); r1(ctx, px - 2, top + bob, 5, 5, 0x17151a); r1(ctx, px - 1, top - 2 + bob, 3, 2, 0x17151a); r1(ctx, px - 1, top + 1 + bob, 3, 3, 0x3a8ae0); r1(ctx, px, top - 1 + bob, 1, 2, 0x3a8ae0); r1(ctx, px - 1, top + 1 + bob, 1, 1, 0xc8e8ff); }
  if (st === 'mogen' && Math.floor(t * 3) % 2) for (const [dx, dy] of [[-7, -2], [7, 1], [0, -6]]) { r1(ctx, px + dx, top + dy, 1, 3, 0xfff6a0); r1(ctx, px + dx - 1, top + dy + 1, 3, 1, 0xfff6a0); }
}

export function createOdling(env, { game, me } = {}) {
  if (!ODLING) return null;
  const pots = ODLING.pots, [cx, cy] = ODLING.can;
  let t = 0, watering = 0, waterTo = [];
  const drops = [];
  const g = () => game?.();
  // husvagnens bäddar (utan att skapa några om man inte bor där)
  const beds = () => { const G = g(); return G?.home === 'husvagn' ? G.garden('husvagn')?.beds || [] : G?.odling?.husvagn?.beds || []; };
  const stateOf = (b) => g()?.bedState(b) || 'tom';
  const obstacles = [...pots.map(([x, y]) => [x - 9, y - 3, x + 10, y + 1]), [cx - 5, cy - 2, cx + 6, cy + 1]];

  function water(i) {
    watering = 1.4;
    waterTo = i < 0 ? pots.map((_, k) => k).filter((k) => stateOf(beds()[k]) === 'vattnad') : [i];   // (anropas efter att de vattnats)
    if (!waterTo.length) waterTo = [0];
  }
  function items() {
    const L = [], bs = beds();
    pots.forEach(([x, y], i) => {
      const b = bs[i] || null, st = stateOf(b);
      L.push({ x, y, kind: 'kruka', draw: (ctx) => {
        put(ctx, POT_ART[i % POT_ART.length], x, y);
        drawSoil(ctx, x, y, st === 'vattnad' || st === 'mogen');
        if (b) drawPlants(ctx, x, y, b, st, t);
        drawBadge(ctx, x, y, st, t);
      } });
    });
    const M = watering > 0 ? me?.() : null;
    if (!M) L.push({ x: cx, y: cy, kind: 'vattenkanna', draw: (ctx) => put(ctx, CAN_ART, cx, cy) });
    else {
      // kannan i handen (på den sida man vänder sig åt), strilen över krukan
      const side = M.dir === 'left' ? -1 : 1, hx = M.x + side * 7, hy = M.y - 14;
      L.push({ x: M.x, y: M.y + 0.2, kind: 'vattenkanna', draw: (ctx) => {
        if (side > 0) put(ctx, CAN_ART, hx, hy);
        else { ctx.save(); ctx.translate(Math.round(hx) * 2, 0); ctx.scale(-1, 1); put(ctx, CAN_ART, Math.round(hx), hy); ctx.restore(); }
      } });
    }
    if (drops.length) L.push({ x: cx, y: 1e5 + 1, kind: 'droppar', draw: (ctx) => { for (const d of drops) r1(ctx, d.x, d.y, 1, 2, d.c); } });
    return L;
  }
  function update(dt) {
    t += dt;
    if (watering > 0) {
      watering -= dt;
      // droppar faller ur strilen ner i krukorna
      for (const i of waterTo) {
        const [x, y] = pots[i] || pots[0];
        if (Math.random() < dt * 40) drops.push({ x: x - 6 + Math.random() * 12, y: y + RIM.cy - 12 - Math.random() * 4, vy: 40 + Math.random() * 30, end: y + RIM.cy + 1, c: Math.random() < 0.3 ? 0xc8e8ff : 0x6ab0f0 });
      }
    }
    for (const d of drops) d.y += d.vy * dt;
    for (let i = drops.length - 1; i >= 0; i--) if (drops[i].y >= drops[i].end) drops.splice(i, 1);
  }
  // klick: krukan (och plantorna över den) eller kannan → var figuren ska stå
  function potAt(x, y) {
    const i = pots.findIndex(([px, py]) => x >= px - 11 && x <= px + 11 && y >= py - 34 && y <= py + 2);
    return i < 0 ? null : { i, walk: { x: pots[i][0], y: pots[i][1] + 10 } };
  }
  const canAt = (x, y) => (x >= cx - 7 && x <= cx + 13 && y >= cy - 14 && y <= cy + 2 ? { walk: { x: cx - 4, y: cy + 9 } } : null);
  return {
    items, obstacles, update, potAt, canAt, water,
    _debug: { beds: () => beds().map((b, i) => ({ i, st: stateOf(b), b: b ? { ...b } : null })), watering: () => watering > 0, drops: () => drops.length },
  };
}

// det som händer när figuren har gått fram (city.js anropar med appen)
const notMine = (A) => { if (A.game.home === 'husvagn') return false; toast($t('🌱 Det här är husvagnens odling – den sköts av den som bor i husvagnen.')); return true; };
export function openPot(A, O, i) { if (!notMine(A)) bedAction(A, i, { water: () => O.water(i) }); }
export function useCan(A, O) { if (!notMine(A)) waterAll(A, { water: () => O.water(-1) }); }
