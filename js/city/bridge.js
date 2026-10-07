// FLODEN OCH BROARNA (v3) – Pixelfloden mellan downtown och förorten.
// Carl: "en stor bro över som Brooklyn Bridge och att det efter den kommer förorten så att
// den inte sitter ihop med centrum".
//
// Modulen äger hela flodrummet x 2400–3032, y 0–820 (RIVER och BRIDGES i map.js):
//   • VATTNET – strömfåror längs flödet (norr → söder), krusningar, murarnas skugga, tornens
//     och bärkabelns spegling, skum kring tornfötterna och bropelarna, solglitter; isen på
//     vintern lägger weather.js (då syns inga båtar och inget glitter). Tornens långa skuggor
//     på vattnet och isen ritas levande och följer solen (borta på natten)
//   • KAJERNA – granithällar, räcken, pollare, förtöjningsringar, livbojar, trappor ner till
//     vattnet och kajlyktor
//   • STORA BRON (Pixelgatan) à la Brooklyn Bridge – två granittorn med dubbla gotiska
//     spetsbågar som vägen går igenom (valven är genomskärningsfönster: man ser folk och bilar
//     i dem, promenadens plankor fortsätter i valvets skugga), bärkablar i båge mellan tornen och ner till förankringarna vid kajerna, lodräta
//     hängstag och solfjäderformade stag (Brooklyn-nätet), upphöjda gångbanor av plank med
//     kantsten, järnräcken med gallerverk, lyktor, flaggor på tornen och fackverksbalken
//     under körbanan
//   • JÄRNBRON (Södergatan) – grönmålad nitad kamelrygg-fackverksbro i tre spann på
//     stenpelare, gångbanor av räfflad plåt, gjutjärnsskylt på balken
//   • BÅTAR som glider under broarna (pråm med påskjutare, motorbåt, turistbåt) och
//     FISKMÅSAR i luften och på tornen
//   • KVÄLLEN – lyktor, kabelljus, strålkastare som lyser upp tornen, valvlyktor i passagerna,
//     speglingar i vattnet
//
// Kontraktet (docs/STADEN.md, avsnitt 8):
//   paintRiver(night) → canvas 632 × 820, läggs på marken vid (RIVER.x0, 0) och cachas per
//                       dag/natt. Genomskinligt = ground.js syns (körbanorna över broarna med
//                       körfält och mittlinje, kanalens kaj längst ner).
//   riverLive(ctx, env, view)  varje bildruta efter groundLive, före vädret
//   createBridge(env) → { items(), obstacles, update(dt), glow(ctx, view) }
// Lager (y-nycklar): allt norr om Stora brons däck ≤ 181, allt söder om det ≥ 311,
// Järnbrons norra fackverk ≤ 635 och södra ≥ 760. Föremål som spänner över hela floden har
// inget x (scenen sållar bara på y). Vatten, räcken, tornben och mittpelare är redan hinder i
// map.js – modulen lägger bara till kajlyktorna och pollarna på kajerna (obstacles); brolyktorna
// står på räckena och förankringarna i vattnet.
import { Pix, mix, mul, hash, bayer, SMALL, BIG, textW, eachTextPixel } from '../core/floor-pix.js';
import { CITY, RIVER, BRIDGES } from './map.js';
import { $t } from '../core/i18n.js';

export const PLACEHOLDER = false;
// figurerna (skridskoåkarna på isen) – laddas för sig så att floden lever även om den modulen inte gör det
let drawPerson = null;
import('../core/people.js').then((m) => { drawPerson = m.drawPerson || null; }).catch(() => {});

// ---------------------------------------------------------------------
// Geometrin (allt räknas ur map.js)
// ---------------------------------------------------------------------
const H = CITY.H;
const RX0 = RIVER.x0, RX1 = RIVER.x1, RW = RX1 - RX0;                 // 2400–3032
const WX0 = RIVER.wx0, WX1 = RIVER.wx1;                               // vattnet 2424–3008
const SB = BRIDGES.find((b) => b.towers && b.towers.length) || BRIDGES[0];   // Stora bron
const IB = BRIDGES.find((b) => b !== SB) || null;                             // Järnbron
const N_RAIL = SB.rails[0][1], N_DECK = SB.walk[1], S_DECK = SB.walk[3], S_RAIL = SB.rails[1][3]; // 181 186 306 311
const ROAD0 = CITY.ROAD[0], ROAD1 = CITY.ROAD[1];                     // 218 / 276
const GIRD = 12;                                                      // fackverksbalken under södra kanten
const TOWERS = SB.towers.map((t, i) => ({ ...t, i, cx: (t.x0 + t.x1) >> 1, base: t.legs[1][3], nTop: t.legs[0][1] }));
const T1 = TOWERS[0], T2 = TOWERS[TOWERS.length - 1];
const TOP = 18;                                                       // tornkrönets överkant (världs-y ≥ 0)
const APEX = 102;                                                     // valvens spetsar
const WIN_B = S_DECK + 3;                                             // valvens underkant (södra räcket)
const AW = SB.x0 + 14, AE = SB.x1 - 14;                               // förankringarnas mitt
const CAB_N = { top: TOP + 2, low: N_RAIL - 16, anchor: N_RAIL - 15 };  // norra bärkabeln (bakom)
const CAB_S = { top: TOP + 9, low: S_RAIL - 20, anchor: S_RAIL + 6 };   // södra bärkabeln (framför)
// Järnbron
const IN_RAIL = IB ? IB.rails[0][1] : 635, IN_DECK = IB ? IB.walk[1] : 640, IS_DECK = IB ? IB.walk[3] : 760, IS_RAIL = IB ? IB.rails[1][3] : 765;
const IROAD0 = CITY.ROAD_S[0], IROAD1 = CITY.ROAD_S[1];               // 672 / 730
const IGIRD = 10;
const SPANS = 3;
const PIERS = IB ? Array.from({ length: SPANS - 1 }, (_, k) => Math.round(IB.x0 + ((IB.x1 - IB.x0) * (k + 1)) / SPANS)) : [];
const QUAY_END = CITY.QUAY[0];                                        // 760: kanalens kaj (ground.js) tar vid

// Vattnet där båtar syns: under balkarna på brornas södra sida syns de inte.
const CLIPS = RIVER.water.map((r) => {
  let y0 = r[1];
  if (y0 === S_RAIL) y0 += GIRD;
  if (y0 === IS_RAIL) y0 += IGIRD;
  return [r[0], y0, r[2], r[3]];
});

// ---------------------------------------------------------------------
// Färger
// ---------------------------------------------------------------------
const ST = { hi: 0xe6dcc4, lit: 0xd2c6aa, a: 0xc6b89c, b: 0xab9c80, joint: 0x8a7d66, dark: 0x6e624e, deep: 0x4e4436 };
const CAB = { hi: 0x9aa3ae, mid: 0x565d68, lo: 0x2a2e36, band: 0x8c949e };
const SUSP = 0x4e545e, STAY = 0x707680;
const IRON = { hi: 0x7eaa92, lit: 0x5e8a74, mid: 0x3f6b58, dark: 0x2a4a3c, deep: 0x1a2e26, rivet: 0xa8c8b6, rust: 0x7a5236 };
const LAMP = { hi: 0x5e7268, mid: 0x34443c, dark: 0x1e2824, glass: 0xe8e0c0, glassHi: 0xfffbe8, gold: 0xc8a040 };
const WOOD = [0xa08466, 0x927858, 0x806a4e, 0x9a8062];
const SNOW = 0xf4f8fc, SNOW_D = 0xdde6f0;

// ---------------------------------------------------------------------
// Hjälpare
// ---------------------------------------------------------------------
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const clamp01 = (v) => clamp(v, 0, 1);
const smooth = (a, b, v) => { const t = clamp01((v - a) / (b - a)); return t * t * (3 - 2 * t); };
const inR = (x, y, r) => x >= r[0] && x < r[2] && y >= r[1] && y < r[3];
function vnoise(x, y, s, seed) {
  const fx = x / s, fy = y / s, ix = Math.floor(fx), iy = Math.floor(fy);
  let tx = fx - ix, ty = fy - iy;
  tx = tx * tx * (3 - 2 * tx); ty = ty * ty * (3 - 2 * ty);
  const a = hash(ix, iy, seed), b = hash(ix + 1, iy, seed), c = hash(ix, iy + 1, seed), d = hash(ix + 1, iy + 1, seed);
  return a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty;
}
function granite(x, y, c) {
  const h = hash(x, y, 5);
  if (h > 0.9) return mul(c, 0.78);
  if (h < 0.06) return mix(c, 0xffffff, 0.28);
  return mul(c, 0.94 + hash(x, y, 6) * 0.1);
}
const inTowerX = (x, m = 0) => TOWERS.some((t) => x >= t.x0 - m && x < t.x1 + m);
// Tornets skugga på vattnet norr om bron (solen i sydväst – skuggan faller mot nordost, 0,22 px
// österut per px norrut). Rakt bakom tornet döljs den av tornet självt: synlig är kilen öster om
// schaktet och, ovanför krönet, hela den förskjutna skuggan. Ger [x0, x1) för raden y.
function towerShadow(t, y) {
  const d = 0.22 * (N_RAIL + 20 - y);
  return [y < TOP - 3 ? Math.round(t.x0 + d) : t.x1, Math.round(t.x1 + d)];
}
// Skuggorna bakas inte in i vattnet eller isen (de är cachade oberoende av dygnet) – de ritas
// levande som ett eget halvgenomskinligt lager med solens styrka: fulla mitt på dagen, svagare
// i skymningen och under moln, borta på natten. ice = isens blåaktiga skugga (bara på isytan).
const SHADE_ART = {};
function towerShadowArt(ice) {
  if (SHADE_ART[ice]) return SHADE_ART[ice];
  const P = new Pix(RW, N_RAIL, RX0, 0), c = ice ? 0x3a4e70 : 0x0a1624, a = ice ? 0.26 : 0.22;
  for (const t of TOWERS) for (let y = 0; y < N_RAIL; y++) {
    const [xa, xb] = towerShadow(t, y);
    for (let x = xa; x < xb; x++) {
      if (ice ? x < WX0 + 2 || x >= WX1 - 2 : !inWater(x, y)) continue;
      if (x < xb - 2 || bayer(x, y) < 0.5) P.px(x, y, c, a);
    }
  }
  return (SHADE_ART[ice] = P.flush());
}
// solens styrka för de levande skuggorna: 1 = klar middagssol, 0 = natt
function sunShade(env) {
  const w = env.weather, day = clamp01(1 - (env.dark || 0) / 0.4);
  return day * (1 - 0.75 * clamp01(w ? w.cloud ?? 0 : 0));
}
// lägg skugglagret över raderna y0–y1 (världskoordinater) med styrkan k
function drawTowerShadow(ctx, ice, k, y0, y1, x0 = RX0, x1 = RX1) {
  y0 = Math.max(0, Math.floor(y0)); y1 = Math.min(N_RAIL, Math.ceil(y1));
  x0 = Math.max(RX0, Math.floor(x0)); x1 = Math.min(RX1, Math.ceil(x1));
  if (k <= 0.03 || y1 <= y0 || x1 <= x0) return;
  const a = ctx.globalAlpha;
  ctx.globalAlpha = a * k;
  ctx.drawImage(towerShadowArt(ice), x0 - RX0, y0, x1 - x0, y1 - y0, x0, y0, x1 - x0, y1 - y0);
  ctx.globalAlpha = a;
}
const inWater = (x, y) => RIVER.water.some((r) => inR(x, y, r));
const inClip = (x, y) => CLIPS.some((r) => inR(x, y, r));
const frozenNow = (w) => !!w && ((w.season === 'vinter' && w.temp <= 0) || (w.snowCover || 0) > 0.25);
const rgba = (c, a) => `rgba(${(c >> 16) & 255},${(c >> 8) & 255},${c & 255},${clamp01(a).toFixed(3)})`;
// spetsbåge (liksidig): radien = bredden, spetsen mitt över öppningen i y = apex
function inPointed(a, b, apex, x, y) {
  const R = b - a, ys = apex + R * 0.866;
  if (y >= ys) return x >= a && x < b;
  const px = x + 0.5, py = y + 0.5;
  return Math.hypot(px - b, py - ys) <= R && Math.hypot(px - a, py - ys) <= R;
}
function spr(w, h, fn) { const P = new Pix(w, h); fn(P); return P.flush(); }

// ---------------------------------------------------------------------
// Bärkablarna: höjden (skärm-y) som funktion av x. Över tornen går de i sadlar på krönet.
// ---------------------------------------------------------------------
function cableFn(c) {
  const xa = T1.x1, xb = T2.x0, mid = (xa + xb) / 2, half = (xb - xa) / 2, sag = 16;
  return (x) => {
    if (inTowerX(x)) return c.top;
    if (x >= xa && x < xb) { const u = (x - mid) / half; return c.top + (c.low - c.top) * (1 - u * u); }
    if (x < T1.x0) { const t = clamp01((x - AW) / (T1.x0 - AW)); return c.anchor + (c.top - c.anchor) * t + sag * 4 * t * (1 - t); }
    const t = clamp01((x - T2.x1) / (AE - T2.x1)); return c.top + (c.anchor - c.top) * t + sag * 4 * t * (1 - t);
  };
}
const FN = cableFn(CAB_N), FS = cableFn(CAB_S);

// ---------------------------------------------------------------------
// TORNEN – granit, krön med gesims och hörntinnar, bronsplakett/årtalssten, blinda
// lansettnischer, dubbla spetsbågar (genomskinliga) och rustik fot i vattnet.
// ---------------------------------------------------------------------
const PIER_W = 5, MULL = 4;
function towerWindows(t) {
  const w = (t.x1 - t.x0 - 2 * PIER_W - MULL) >> 1;
  const a0 = t.x0 + PIER_W, a1 = a0 + w, b0 = a1 + MULL, b1 = b0 + w;
  return [[a0, a1], [b0, b1]];
}
const inTowerWin = (t, x, y) => y >= APEX && y < WIN_B && towerWindows(t).some(([a, b]) => inPointed(a, b, APEX, x, y));
function towerStone(t, x, y) {
  const course = Math.floor((y - TOP) / 6), ly = (((y - TOP) % 6) + 6) % 6;
  const off = (course & 1) * 6, lx = (((x - t.x0 + off) % 12) + 12) % 12, bx = Math.floor((x - t.x0 + off) / 12);
  let c = mix(ST.a, ST.b, hash(bx, course, 1810 + t.i) * 0.85);
  c = granite(x, y, c);
  if (ly === 5) c = mix(c, ST.joint, 0.8);
  else if (lx === 11) c = mix(c, ST.joint, 0.6);
  else if (ly === 0) c = mix(c, 0xffffff, 0.1);
  // regnränder under listerna och vattnets mörka fuktrand nertill
  if (hash(x, 3, 1813 + t.i) > 0.82 && ((y > 34 && y < 34 + 26 * hash(x, 4, 1814)) || (y > 100 && y < 100 + 30 * hash(x, 5, 1815)))) c = mul(c, 0.9);
  if (y > 290) c = mix(c, 0x6a6a58, (y - 290) / 60);
  return c;
}
function towerText(P, t, cx) {
  if (t.i === 0) {
    // bronsplakett: STORA / BRON
    const pw = 27, ph = 17, px0 = cx - (pw >> 1), py0 = 42;
    for (let y = py0; y < py0 + ph; y++) for (let x = px0; x < px0 + pw; x++) {
      const e = x === px0 || y === py0 || x === px0 + pw - 1 || y === py0 + ph - 1;
      const e2 = x === px0 + 1 || y === py0 + 1 || x === px0 + pw - 2 || y === py0 + ph - 2;
      P.px(x, y, e ? (x === px0 + pw - 1 || y === py0 + ph - 1 ? 0x3a2814 : 0x9a7040) : e2 ? (x === px0 + 1 || y === py0 + 1 ? 0xd8b068 : 0x5a3c1e) : mix(0x6a4824, 0x5a3c1e, hash(x, y, 1820) * 0.6));
    }
    const [w1, ...wr] = $t('STORA BRON').split(' ');   // två rader på plaketten
    for (const [s, yy] of [[w1, py0 + 3], [wr.join(' '), py0 + 9]]) {
      const tx = cx - (textW(SMALL, s) >> 1);
      eachTextPixel(SMALL, s, tx + 1, yy + 1, 1, (x, y) => P.px(x, y, 0x3a2814));
      eachTextPixel(SMALL, s, tx, yy, 1, (x, y) => P.px(x, y, 0xecc878));
    }
    return [px0, py0, px0 + pw, py0 + ph];
  }
  // årtalssten: 1883 inhugget
  const s = '1883', pw = textW(BIG, s) + 6, ph = 13, px0 = cx - (pw >> 1), py0 = 44;
  for (let y = py0; y < py0 + ph; y++) for (let x = px0; x < px0 + pw; x++) {
    const e = x === px0 || y === py0, f = x === px0 + pw - 1 || y === py0 + ph - 1;
    P.px(x, y, e ? ST.hi : f ? ST.dark : granite(x, y, 0xd4c8ae));
  }
  const tx = cx - (textW(BIG, s) >> 1);
  eachTextPixel(BIG, s, tx + 1, py0 + 4, 1, (x, y) => P.px(x, y, 0xeee4cc));
  eachTextPixel(BIG, s, tx, py0 + 3, 1, (x, y) => P.px(x, y, 0x6e604a));
  return [px0, py0, px0 + pw, py0 + ph];
}
function paintTower(t, snow) {
  const x0 = t.x0, x1 = t.x1, cx = t.cx, yB = t.base;
  const ox = x0 - 7, oy = TOP - 3;
  const P = new Pix(x1 - x0 + 14, yB - oy + 12, ox, oy);
  const WIN = towerWindows(t);
  const spring = APEX + Math.round((WIN[0][1] - WIN[0][0]) * 0.866);
  // 1. schaktet (granitkvader i löpförband), västkanten solbelyst, östkanten i skugga
  for (let y = TOP + 8; y < WIN_B; y++) for (let x = x0; x < x1; x++) {
    if (inTowerWin(t, x, y)) continue;
    let c = towerStone(t, x, y);
    if (x < x0 + 2) c = mix(c, 0xffffff, x === x0 ? 0.22 : 0.12);
    else if (x >= x1 - 3) c = mul(c, x === x1 - 1 ? 0.66 : 0.78);
    P.px(x, y, c);
  }
  // 2. krönet (taket i förkortning) + gesimsen med tandsnitt
  for (let y = TOP; y < TOP + 8; y++) for (let x = x0 - 1; x < x1 + 1; x++) {
    let c = y === TOP ? ST.hi : y === TOP + 7 ? ST.b : granite(x, y, mix(0xd8ccb0, 0xc6b89a, vnoise(x, y, 5, 1830)));
    if ((x - x0) % 16 === 15 && y > TOP) c = mul(c, 0.86);
    if (x === x0 - 1) c = mix(c, 0xffffff, 0.2); else if (x === x1) c = mul(c, 0.8);
    P.px(x, y, c);
  }
  for (let x = x0 - 3; x < x1 + 3; x++) {
    const e = x === x0 - 3 ? 0.18 : x >= x1 + 1 ? -0.2 : 0;
    const f = (c) => (e > 0 ? mix(c, 0xffffff, e) : e < 0 ? mul(c, 1 + e) : c);
    P.px(x, TOP + 8, f(ST.hi)); P.px(x, TOP + 9, f(ST.lit)); P.px(x, TOP + 10, f(ST.a));
    P.px(x, TOP + 11, f(x % 3 === 0 ? ST.dark : ST.lit));                                 // tandsnitt
    P.px(x, TOP + 12, f(ST.b)); P.px(x, TOP + 13, f(ST.joint));
  }
  for (let x = x0; x < x1; x++) { P.px(x, TOP + 14, mul(P.get(x, TOP + 14) || ST.b, 0.72)); P.px(x, TOP + 15, mul(P.get(x, TOP + 15) || ST.b, 0.86)); }
  // hörntinnar på krönet
  for (const px of [x0 - 1, x1 - 3]) { P.rect(px, TOP - 3, 4, 3, ST.lit); P.hl(px, TOP - 3, 4, ST.hi); P.px(px + 3, TOP - 2, ST.b); P.px(px + 3, TOP - 1, ST.b); }
  // 3. rundbågefris under gesimsen
  for (let x = x0 + 1; x < x1 - 1; x++) {
    const k = (x - x0 - 1) % 6;
    P.px(x, TOP + 16, k === 0 ? ST.lit : mul(ST.a, 0.95));
    if (k >= 2 && k <= 4) { P.px(x, TOP + 17, ST.deep); P.px(x, TOP + 18, k === 3 ? ST.deep : ST.dark); }
    else P.px(x, TOP + 17, k === 1 ? ST.hi : ST.a);
    P.px(x, TOP + 19, ST.hi); P.px(x, TOP + 20, ST.joint);
  }
  // 4. plakett (torn 1) / årtalssten (torn 2)
  const plaque = towerText(P, t, cx);
  // 5. blinda lansettnischer
  const nw = 8, niches = [[x0 + 9, x0 + 9 + nw], [x1 - 9 - nw, x1 - 9]], n0 = 64, n1 = 92;
  for (const [a, b] of niches) {
    for (let y = n0 - 2; y < n0 + nw; y++) for (let x = a - 1; x <= b; x++) {                // bågens kantsten
      if (!inPointed(a, b, n0, x, y) && inPointed(a - 1, b + 1, n0 - 2, x, y)) P.px(x, y, ST.lit);
    }
    for (let y = n0; y < n1; y++) for (let x = a; x < b; x++) {
      if (!inPointed(a, b, n0, x, y)) continue;
      const depth = 1 - (y - n0) / (n1 - n0);
      let c = mix(0x8a7c64, 0x5a4e3e, 0.35 + depth * 0.5);
      if (x === a) c = mix(c, 0xffffff, 0.1); else if (x === b - 1) c = mul(c, 0.8);
      if (!inPointed(a, b, n0, x, y - 1)) c = mul(c, 0.72);
      P.px(x, y, c);
    }
    for (let x = a - 1; x <= b; x++) { P.px(x, n1, ST.hi); P.px(x, n1 + 1, ST.joint); }       // fönsterbänken
  }
  for (let y = n0 - 2; y < n1; y++) { P.px(cx - 1, y, mix(P.get(cx - 1, y), 0xffffff, 0.1)); P.px(cx + 1, y, mul(P.get(cx + 1, y), 0.86)); }
  // 6. kämpfergesimsen (där valven börjar)
  for (let x = x0 - 1; x < x1 + 1; x++) {
    const e = x === x0 - 1 ? 1.08 : x === x1 ? 0.8 : 1;
    P.px(x, APEX - 7, mul(ST.hi, Math.min(1, e))); P.px(x, APEX - 6, mul(ST.lit, e)); P.px(x, APEX - 5, mul(ST.a, e)); P.px(x, APEX - 4, mul(ST.joint, e));
  }
  for (let x = x0; x < x1; x++) P.px(x, APEX - 3, mul(P.get(x, APEX - 3) || ST.a, 0.8));
  // 7. valven: voussoirer runt spetsarna, droppkupa, smygar (ljus västsida, skuggad östsida/överkant)
  for (const [a, b] of WIN) {
    const R = b - a, ys = APEX + R * 0.866, mx = (a + b) / 2;
    for (let y = APEX - 6; y < spring; y++) for (let x = a - 4; x < b + 4; x++) {
      if (inPointed(a - 2, b + 2, APEX - 3, x, y)) continue;
      if (inPointed(a - 3, b + 3, APEX - 5, x, y)) P.px(x, y, (x + y) % 2 ? ST.hi : ST.lit);
    }
    for (let y = APEX - 4; y < spring + 2; y++) for (let x = a - 3; x < b + 3; x++) {
      if (inPointed(a, b, APEX, x, y) || !inPointed(a - 2, b + 2, APEX - 3, x, y)) continue;
      const seg = Math.floor(Math.atan2(y + 0.5 - ys, x + 0.5 - mx) * 5);
      let c = mix(0xe0d4b8, 0xcfc2a4, hash(seg, a, 1840));
      if (Math.floor(Math.atan2(y + 0.5 - ys, x - 0.5 - mx) * 5) !== seg) c = ST.joint;
      P.px(x, y, c);
    }
    for (let y = APEX; y < WIN_B; y++) for (let x = a; x < b; x++) {
      if (!inPointed(a, b, APEX, x, y)) continue;
      const l = !inPointed(a, b, APEX, x - 1, y), r = !inPointed(a, b, APEX, x + 1, y), u = !inPointed(a, b, APEX, x, y - 1);
      if (r || u) P.px(x, y, u && !l ? 0x4a4034 : 0x5e5242);
      else if (l) P.px(x, y, 0xb8aa8e);
    }
  }
  // mittposten mellan valven: en smal kolonnett med kapitäl vid kämpferhöjden
  const m0 = WIN[0][1];
  for (let y = spring + 2; y < WIN_B; y++) { P.px(m0, y, mix(P.get(m0, y), 0xffffff, 0.14)); P.px(m0 + MULL - 1, y, mul(P.get(m0 + MULL - 1, y), 0.74)); }
  for (const cxm of [x0 + 1, m0, x1 - 4]) { P.hl(cxm, spring, 3, ST.hi); P.hl(cxm, spring + 1, 3, ST.joint); }
  // 8. foten i vattnet: rustik kvadersten, släntar utåt, våt och algig nertill
  for (let y = WIN_B; y < yB; y++) {
    const ex = Math.floor((y - WIN_B) / 7);
    for (let x = x0 - ex; x < x1 + ex; x++) {
      const row = Math.floor((y - WIN_B) / 5), ly = (y - WIN_B) % 5, off = (row & 1) * 5, lx = (((x - x0 + off) % 10) + 10) % 10;
      let c = granite(x, y, mix(0xa89c86, 0x8e8472, hash(Math.floor((x - x0 + off) / 10), row, 1850 + t.i)));
      if (ly === 0 || lx === 0) c = mix(c, 0xe0d6c0, 0.35);
      else if (ly === 4 || lx === 9) c = mix(c, 0x3a342a, 0.6);
      if (x < x0 - ex + 2) c = mix(c, 0xffffff, 0.12); else if (x >= x1 + ex - 3) c = mul(c, 0.74);
      if (y >= yB - 5) c = mix(mul(c, 0.62), 0x2e4430, y >= yB - 3 ? 0.45 : 0.25);
      P.px(x, y, c);
    }
  }
  for (let x = x0 - 1; x < x1 + 1; x++) { P.px(x, WIN_B, ST.hi); P.px(x, WIN_B + 1, ST.lit); }
  // stäven nedströms (spetsig, våt, algig) – syns under tornbilden i vattnet
  for (let y = yB; y < yB + 10; y++) {
    const hw = ((x1 - x0) / 2 + 3) * clamp01((yB + 10 - y) / 10);
    for (let x = Math.floor(cx - hw); x < Math.ceil(cx + hw); x++) {
      let c = mix(granite(x, y, mix(0x8e8472, 0x6e6658, (y - yB) / 10)), 0x2e4430, 0.35);
      if (x >= cx) c = mul(c, 0.8);
      if (y === yB) c = mul(c, 0.7);
      P.px(x, y, c);
    }
  }
  // strålkastarna på foten (lyser upp tornet på kvällen)
  for (const fx of [x0 + 5, x1 - 8]) { P.rect(fx, WIN_B + 2, 3, 2, 0x2a2c30); P.hl(fx, WIN_B + 2, 3, 0x4a4e56); P.px(fx + 1, WIN_B + 2, 0xe8e0c0); }
  // 9. snö på krönet, gesimsen, kämpfergesimsen, nischernas fönsterbänkar och fotens överkant
  if (snow) {
    for (let x = x0 - 1; x < x1 + 1; x++) for (let y = TOP; y < TOP + 6; y++) if (y < TOP + 5 || bayer(x, y) < 0.5) P.px(x, y, y === TOP ? 0xffffff : bayer(x, y) < 0.3 ? SNOW_D : SNOW);
    for (const px of [x0 - 1, x1 - 3]) P.hl(px, TOP - 3, 4, 0xffffff);
    for (let x = x0 - 3; x < x1 + 3; x++) { P.px(x, TOP + 8, SNOW); if (hash(x, 1, 1860) > 0.4) P.px(x, TOP + 9, SNOW_D); }
    for (let x = x0 - 1; x < x1 + 1; x++) { P.px(x, APEX - 7, SNOW); if (hash(x, 2, 1860) > 0.3) P.px(x, APEX - 6, SNOW_D); }
    for (const [a, b] of niches) for (let x = a - 1; x <= b; x++) P.px(x, n1, SNOW);
    for (let x = x0 - 1; x < x1 + 1; x++) P.px(x, WIN_B, SNOW);
  }
  // 10. bärkablarna i sadlarna på krönet
  for (const [yy, back] of [[CAB_N.top, 1], [CAB_S.top, 0]]) {
    for (let x = x0 - 3; x < x1 + 3; x++) { P.px(x, yy, snow ? SNOW : back ? mul(CAB.hi, 0.9) : CAB.hi); P.px(x, yy + 1, CAB.mid); P.px(x, yy + 2, CAB.lo); }
    for (const sx of [x0 + 3, x1 - 9]) { P.rect(sx, yy - 2, 6, 3, 0x3a3e46); P.hl(sx, yy - 2, 6, snow ? SNOW : 0x6a707a); P.px(sx + 5, yy - 1, 0x22252a); }
  }
  const cv = P.flush();
  // strålkastarljuset (additivt på kvällen): starkast nertill och under gesimsen, aldrig över plaketten
  const L = new Pix(P.w, P.h, ox, oy);
  for (let y = oy; y < oy + P.h; y++) for (let x = ox; x < ox + P.w; x++) {
    const i = ((y - oy) * P.w + (x - ox)) * 4;
    if (P.d[i + 3] === 0 || inR(x, y, plaque)) continue;
    const a = clamp(0.5 * Math.exp(-(yB - y) / 80) + 0.32 * Math.exp(-(y - TOP) / 26), 0, 0.55);
    const q = Math.floor(a * 14 + bayer(x, y) * 0.9) / 14;
    if (q > 0) L.px(x, y, 0xffd8a4, q);
  }
  return { cv, light: L.flush(), ox, oy, d: P.d, w: P.w, h: P.h, plaque };
}

// ---------------------------------------------------------------------
// Järnräcken, lyktor, förankringar och kabelnätet
// ---------------------------------------------------------------------
// Brooklyn-räcket: överliggare, underliggare, stolpar och sicksackgaller emellan.
function railing(P, xa, xb, yb, snow) {
  const top = yb - 7;
  for (let x = xa; x < xb; x++) {
    if (inTowerX(x, 1)) continue;
    const lx = (((x - xa) % 8) + 8) % 8;
    for (let y = top + 2; y < yb - 1; y++) {
      const u = (y - top - 2) / (yb - top - 4);
      if (Math.abs(lx - u * 8) < 0.6 || Math.abs(lx - (1 - u) * 8) < 0.6) P.px(x, y, 0x3a3f48);
    }
    P.px(x, top, snow ? SNOW : 0x7a828e); P.px(x, top + 1, 0x2c3038);                      // överliggaren
    P.px(x, yb - 2, 0x4a505a); P.px(x, yb - 1, 0x24272e);                                   // underliggaren
    if (lx === 0) { for (let y = top - 1; y < yb; y++) P.px(x, y, y === top - 1 ? (snow ? 0xffffff : 0x9aa2ae) : 0x3a3f48); P.px(x + 1, top - 1, 0x24272e); }
  }
}
function bridgeLamp(P, x, yb, snow, tall = 20) {
  P.rect(x - 1, yb - 3, 4, 3, LAMP.dark); P.hl(x - 1, yb - 3, 4, LAMP.hi); P.px(x + 2, yb - 2, 0x141a18);
  for (let y = yb - tall; y < yb - 3; y++) { P.px(x, y, LAMP.hi); P.px(x + 1, y, LAMP.dark); }
  P.hl(x - 1, yb - 9, 4, LAMP.mid); P.px(x - 1, yb - 9, LAMP.hi);                          // krage
  const ly = yb - tall - 7;                                                                  // lyktans överkant
  P.hl(x - 2, ly + 1, 6, LAMP.dark); P.hl(x - 1, ly, 4, LAMP.mid); P.px(x, ly - 1, LAMP.dark); P.px(x + 1, ly - 1, LAMP.dark);
  P.px(x, ly - 2, LAMP.gold); P.px(x + 1, ly - 2, mul(LAMP.gold, 0.7));
  for (let y = ly + 2; y < ly + 6; y++) {
    P.px(x - 2, y, LAMP.dark); P.px(x + 3, y, LAMP.dark);
    P.px(x - 1, y, y === ly + 2 ? LAMP.glassHi : LAMP.glass); P.px(x, y, LAMP.glass); P.px(x + 1, y, mix(LAMP.glass, 0xa89c7c, 0.3)); P.px(x + 2, y, mix(LAMP.glass, 0x8a7e60, 0.5));
  }
  P.hl(x - 2, ly + 6, 6, LAMP.dark); P.hl(x - 1, ly + 7, 4, LAMP.mid);
  if (snow) { P.hl(x - 1, ly - 1, 4, SNOW); P.hl(x - 2, ly, 6, SNOW_D); }
  return { x: x + 0.5, y: ly + 4 };                                                          // ljuspunkten
}
// förankringsblocket där bärkabeln går ner (granit, rustik)
function anchorBlock(P, x0, x1, yb, hgt, snow) {
  const top = yb - hgt, roof = top - 7;
  for (let y = roof; y < yb; y++) for (let x = x0; x < x1; x++) {
    let c;
    if (y < top) c = y === roof ? ST.hi : granite(x, y, mix(0xd0c4a8, 0xbeb094, (y - roof) / 7));
    else {
      const row = Math.floor((y - top) / 4), ly = (y - top) % 4, off = (row & 1) * 4, lx = (((x - x0 + off) % 8) + 8) % 8;
      c = granite(x, y, mix(0xb4a88e, 0x9a8e76, hash(Math.floor((x - x0 + off) / 8), row, 1870 + x0)));
      if (ly === 0 || lx === 0) c = mix(c, 0xe0d6c0, 0.3); else if (ly === 3 || lx === 7) c = mix(c, 0x3a342a, 0.55);
      if (y >= yb - 3) c = mix(mul(c, 0.6), 0x2e4430, 0.35);
    }
    if (x === x0) c = mix(c, 0xffffff, 0.15); else if (x >= x1 - 2) c = mul(c, 0.76);
    P.px(x, y, c);
  }
  P.hl(x0, top, x1 - x0, ST.joint);
  if (snow) for (let x = x0; x < x1; x++) for (let y = roof; y < roof + 4; y++) P.px(x, y, y === roof ? 0xffffff : SNOW);
}
// kabeln: 3 px (ljus överkant, mitt, mörk underkant), lodrätt fylld i de branta partierna
function drawCable(P, f, xa, xb, snow) {
  let prev = null;
  for (let x = xa; x <= xb; x++) {
    const y = Math.round(f(x)), py = prev === null ? y : prev;
    const y0 = Math.min(y, py), y1 = Math.max(y, py) + 2;
    for (let yy = y0; yy <= y1; yy++) P.px(x, yy, yy === y0 ? (snow && y1 - y0 < 5 ? SNOW : CAB.hi) : yy === y1 ? CAB.lo : CAB.mid);
    prev = y;
  }
}
// ett plan av nätet: hängstag, solfjädersstag och kabeln
function cablePlane(P, f, deckY, stayTop, snow) {
  for (let x = AW + 7; x <= AE - 7; x += 6) {
    if (inTowerX(x, 3)) continue;
    const yc = Math.round(f(x)) + 3;
    if (yc >= deckY - 3) continue;
    for (let y = yc; y < deckY; y++) P.px(x, y, (y - yc) % 9 === 8 ? 0x6a707a : SUSP);
  }
  const mid = (T1.x1 + T2.x0) / 2;
  for (const t of TOWERS) for (const s of [-1, 1]) for (let k = 1; k <= 7; k++) {
    const xt = s < 0 ? t.x0 : t.x1 - 1, yt = stayTop + 6 + k * 4, xd = xt + s * (6 + k * 13);
    if (xd <= AW + 10 || xd >= AE - 10 || (s > 0 && t === T1 && xd > mid - 4) || (s < 0 && t === T2 && xd < mid + 4)) continue;
    P.line(xt, yt, xd, deckY - 1, STAY);
  }
  drawCable(P, f, AW - 2, AE + 2, snow);
  for (let x = AW + 7; x <= AE - 7; x += 6) if (!inTowerX(x, 3)) { const y = Math.round(f(x)); P.px(x, y + 1, CAB.band); }   // kabelbanden
}

// ---------------------------------------------------------------------
// Lagren för Stora bron (bakre: norra planet, främre: södra planet) och Järnbrons fackverk
// ---------------------------------------------------------------------
const BR_LAMPS = [];                                                  // { x, side, lx, ly }
for (let x = SB.x0 + 24; x < SB.x1 - 20; x += 44) {
  if (inTowerX(x, 10) || x < AW + 16 || x > AE - 16) continue;
  BR_LAMPS.push({ x, side: 'n' }, { x, side: 's' });
}
// brofästets hörn: granitpostament med en stor lykta ovanpå (räcket börjar vid dem)
const PED_W = 6;
const PED_LAMPS = [SB.x0, SB.x1 - PED_W].flatMap((x) => [{ x: x + 2.5, y: N_DECK - 1 - 25, side: 'n' }, { x: x + 2.5, y: S_RAIL - 1 - 25, side: 's' }]); // = pedestal() ljuspunkter
function pedestal(P, x, yb, snow) {
  const top = yb - 12;
  for (let y = top; y < yb; y++) for (let xx = x; xx < x + PED_W; xx++) {
    let c = granite(xx, y, (y - top) % 6 === 5 ? ST.joint : mix(ST.a, ST.b, hash(xx >> 2, (y - top) / 6 | 0, 1990)));
    if (xx === x) c = mix(c, 0xffffff, 0.18); else if (xx === x + PED_W - 1) c = mul(c, 0.72);
    P.px(xx, y, c);
  }
  P.hl(x - 1, top - 2, PED_W + 2, snow ? SNOW : ST.hi); P.hl(x - 1, top - 1, PED_W + 2, ST.lit); P.px(x + PED_W, top - 1, ST.b);
  P.hl(x, top, PED_W, ST.joint);
  return bridgeLamp(P, x + 2, top - 2, snow, 8);
}
// valvens insida bakom de genomskinliga spetsbågarna: valvet i skugga och det bortre valvet
// (genom det syns vattnet norr om bron), tröskeln över norra foten
function farArches(P) {
  for (const t of TOWERS) for (const [a, b] of towerWindows(t)) {
    const fa = APEX + 36;
    for (let y = APEX; y < N_RAIL + 2; y++) for (let x = a; x < b; x++) {
      if (!inPointed(a, b, APEX, x, y)) continue;
      const far = inPointed(a + 2, b - 2, fa, x, y);
      if (far && y < t.nTop) continue;                                     // genom bortre valvet: vattnet
      let c;
      if (far) c = mix(0x6a6252, 0x4a4438, (y - t.nTop) / 18);             // tröskeln (norra foten)
      else {
        c = mix(0x3a342a, 0x6e6250, clamp01((y - APEX) / 70));             // valvets insida, ljusare nedåt
        if ((y - APEX) % 6 === 5) c = mul(c, 0.84);
        if (inPointed(a + 1, b - 1, fa - 2, x, y)) c = mix(c, 0xb4a68c, 0.45); // bortre valvets kantsten
      }
      P.px(x, y, c);
    }
  }
}
function paintBack(snow) {
  const P = new Pix(RW, N_DECK + 2, RX0, 0);
  farArches(P);
  anchorBlock(P, SB.x0, SB.x0 + 24, N_RAIL, 10, snow);
  anchorBlock(P, SB.x1 - 24, SB.x1, N_RAIL, 10, snow);
  cablePlane(P, FN, N_RAIL + 2, CAB_N.top, snow);
  railing(P, SB.x0 + PED_W, SB.x1 - PED_W, N_DECK - 1, snow);
  for (const l of BR_LAMPS) if (l.side === 'n') { const p = bridgeLamp(P, l.x, N_DECK - 2, snow); l.lx = p.x; l.ly = p.y; }
  for (const x of [SB.x0, SB.x1 - PED_W]) pedestal(P, x, N_DECK - 1, snow);
  return P.flush();
}
function paintFront(snow) {
  const P = new Pix(RW, S_RAIL + GIRD + 1, RX0, 0);
  paintGirder(P);
  cablePlane(P, FS, S_RAIL - 1, CAB_S.top, snow);
  railing(P, SB.x0 + PED_W, SB.x1 - PED_W, S_RAIL - 1, snow);
  for (const l of BR_LAMPS) if (l.side === 's') { const p = bridgeLamp(P, l.x, S_RAIL - 2, snow); l.lx = p.x; l.ly = p.y; }
  for (const x of [SB.x0, SB.x1 - PED_W]) pedestal(P, x, S_RAIL - 1, snow);
  return P.flush();
}
// trapporna ner till vattnet (egna föremål: isen får inte täcka dem)
const STEPS = [[WX0, 420, 'w'], [WX1, 520, 'e']];
function paintStairs(snow) {
  return STEPS.map(([wx, sy, s]) => {
    const x0 = s === 'w' ? wx : wx - 10, P = new Pix(10, 14, x0, sy);
    for (let k = 0; k < 7; k++) for (let y = sy + k * 2; y < sy + k * 2 + 2; y++) {
      for (let i = 0; i < 10 - k; i++) {
        const x = s === 'w' ? wx + i : wx - 1 - i, wet = k >= 4;
        let c = granite(x, y, mix(0xb0a898, 0x7e7a6c, k / 7));
        if (y === sy + k * 2) c = snow && !wet ? SNOW : mix(c, 0xffffff, wet ? 0.05 : 0.15);
        if (wet) c = mix(c, 0x3e5a3a, 0.35 + (k - 4) * 0.12);
        if (i === 10 - k - 1) c = mul(c, 0.8);
        P.px(x, y, c);
      }
    }
    return { cv: P.flush(), x: x0, y: sy, key: sy + 14, cx: x0 + 5 };
  });
}
function paintAnchorsS(snow) {
  const hgt = 12, yb = S_RAIL + 23, y0 = S_RAIL - 12;
  return [SB.x0, SB.x1 - 24].map((x0) => {
    const west = x0 === SB.x0;
    const P = new Pix(24, yb - y0, x0, y0);
    anchorBlock(P, x0, x0 + 24, yb, hgt, snow);
    drawCable(P, FS, west ? AW - 2 : AE - 8, west ? AW + 8 : AE + 2, snow);                   // kabeln går ner i blocket
    return { cv: P.flush(), x: x0, y: y0, key: yb, cx: x0 + 12 };
  });
}
// Järnbron: kamelrygg-fackverk (Pratt) i tre spann, grönmålat och nitat
const IRON_LAMPS = [];
function truss(P, base, snow, side) {
  const ends = [IB.x0, ...PIERS, IB.x1];
  const hEnd = 15, hMid = 26;
  for (let s = 0; s < SPANS; s++) {
    const sx0 = ends[s], sx1 = ends[s + 1], n = 12, pw = (sx1 - sx0) / n;
    const X = (i) => Math.round(sx0 + i * pw);
    const Hh = (i) => (i <= 0 || i >= n ? 0 : Math.round(hEnd + (hMid - hEnd) * (1 - ((i - n / 2) / (n / 2 - 1)) ** 2)));
    const topY = (i) => base - Hh(i);
    // diagonaler (Pratt: lutar ner mot mitten) + motstag i mittfälten
    for (let i = 1; i < n - 1; i++) {
      if (i < n / 2) P.line(X(i), topY(i) + 2, X(i + 1), base - 2, IRON.mid);
      else P.line(X(i + 1), topY(i + 1) + 2, X(i), base - 2, IRON.mid);
      if (i === n / 2 - 1) P.line(X(i + 1), topY(i + 1) + 2, X(i), base - 2, IRON.dark);
      if (i === n / 2) P.line(X(i), topY(i) + 2, X(i + 1), base - 2, IRON.dark);
    }
    // vertikaler
    for (let i = 1; i < n; i++) for (let y = topY(i); y < base; y++) { P.px(X(i), y, IRON.lit); P.px(X(i) + 1, y, IRON.dark); }
    // ändstolparna (lutande, 3 px)
    for (let k = 0; k < 3; k++) {
      const c = k === 0 ? IRON.hi : k === 1 ? IRON.mid : IRON.dark;
      P.line(X(0) + k, base - 1, X(1) + k, topY(1) + 1, c);
      P.line(X(n) - k, base - 1, X(n - 1) - k + 1, topY(n - 1) + 1, c);
    }
    // överramen (polygon, 3 px)
    for (let i = 1; i < n - 1; i++) {
      const xa = X(i), xb = X(i + 1), ya = topY(i), yb = topY(i + 1);
      for (let x = xa; x <= xb; x++) {
        const y = Math.round(ya + ((yb - ya) * (x - xa)) / Math.max(1, xb - xa));
        P.px(x, y, snow ? SNOW : IRON.hi); P.px(x, y + 1, IRON.mid); P.px(x, y + 2, IRON.dark);
      }
    }
    // knutplåtar med nitar
    for (let i = 1; i < n; i++) for (const yy of [topY(i) + 1, base - 3]) { P.rect(X(i) - 1, yy - 1, 4, 3, IRON.lit); P.px(X(i), yy, IRON.rivet); P.px(X(i) + 2, yy, IRON.rivet); P.px(X(i) + 2, yy + 1, IRON.dark); }
    // lyktor på brofästena och pelarna
    for (const x of s === 0 ? [X(0) + 5, X(n)] : [X(n)]) {
      if (x >= IB.x1 - 1) continue;
      const p = bridgeLamp(P, x, base - 2, snow, 14);
      IRON_LAMPS.push({ x: p.x, y: p.y, side });
    }
    if (s === SPANS - 1) { const p = bridgeLamp(P, X(n) - 6, base - 2, snow, 14); IRON_LAMPS.push({ x: p.x, y: p.y, side }); }
  }
  // underramen (hela bron)
  for (let x = IB.x0; x < IB.x1; x++) { P.px(x, base - 2, snow ? SNOW : IRON.lit); P.px(x, base - 1, IRON.mid); P.px(x, base, IRON.dark); if ((x - IB.x0) % 6 === 3) P.px(x, base - 1, IRON.rivet); }
  for (let x = IB.x0; x < IB.x1; x++) if (hash(x, base, 1880) > 0.93) P.px(x, base + 1, IRON.rust, 0.7);     // rostdroppar
  // kärlekslås som par har hängt på fackverket mot gångbanan (södra sidan) – i klungor
  if (side === 's') {
    const LOCK = [0xd83a3a, 0xe8c040, 0xe86ab0, 0x3a7bd5, 0xc0c4c8, 0x40a060, 0xf08a30];
    for (let k = 0; k < 12; k++) {
      const cx = IB.x0 + 30 + Math.floor(hash(k, 1, 1885) * (IB.x1 - IB.x0 - 60)), n = 5 + Math.floor(hash(k, 2, 1885) * 10);
      for (let j = 0; j < n; j++) {
        const x = cx + Math.round((hash(k, j, 1886) - 0.5) * 16), y = base - 4 - Math.floor(hash(j, k, 1887) * 3);
        if (PIERS.some((p) => Math.abs(x - p) < 3)) continue;
        const c = LOCK[Math.floor(hash(j, k + 9, 1888) * LOCK.length)];
        P.px(x, y - 1, 0x9aa0a8); P.px(x, y, c); P.px(x, y + 1, mul(c, 0.7));                           // byglen, låset, skuggsidan
      }
    }
  }
}
function paintIron(snow) {
  if (!IB) return null;
  IRON_LAMPS.length = 0;
  const by = IN_RAIL - 40, fy = IS_RAIL - 44;
  const B = new Pix(RW, IN_RAIL + 3 - by, RX0, by), F = new Pix(RW, IS_RAIL + IGIRD + 17 - fy, RX0, fy);
  paintIronNoses(B);
  truss(B, IN_RAIL + 1, snow, 'n');
  paintIronGirder(F);
  truss(F, IS_RAIL - 2, snow, 's');
  return { back: B.flush(), front: F.flush(), by, fy };
}
// Kajlyktorna (står på kajen en bit in från räcket – stolpen syns mot hällarna) och pollarna
// ute vid kanten. Båda är hinder (kajen är 20 px bred, det finns gott om plats förbi).
const QUAY_LAMPS = [], QUAY_BOLLARDS = [];
{
  const bad = (y) => (y > N_RAIL - 34 && y < S_RAIL + 44) || y > IN_RAIL - 34;
  for (let y = 48; y < QUAY_END - 20; y += 84) {
    if (!bad(y)) QUAY_LAMPS.push({ x: RIVER.quayW[2] - 9, y, side: 'w' });
    if (!bad(y + 40)) QUAY_LAMPS.push({ x: RIVER.quayE[0] + 8, y: y + 40, side: 'e' });
  }
  const near = (y, m) => (y > N_RAIL - m && y < S_RAIL + m) || y > IN_RAIL - m;
  for (const [q, side] of [[RIVER.quayW, 'w'], [RIVER.quayE, 'e']]) {
    for (let y = 30 + (side === 'e' ? 44 : 0); y < QUAY_END - 16; y += 96) {
      if (near(y, 14)) continue;
      QUAY_BOLLARDS.push({ x: side === 'w' ? q[2] - 5 : q[0] + 2, y, side });
    }
  }
}
const QUAY_OBSTACLES = [...QUAY_LAMPS.map((q) => [q.x - 1, q.y - 2, q.x + 3, q.y + 1]), ...QUAY_BOLLARDS.map((b) => [b.x, b.y + 1, b.x + 3, b.y + 4])];
function quayLampSprite(snow) {
  const P = new Pix(9, 32, -4, -31);
  P.rect(-2, -3, 5, 3, LAMP.dark); P.hl(-2, -3, 5, LAMP.hi);
  for (let y = -24; y < -3; y++) { P.px(0, y, LAMP.hi); P.px(1, y, LAMP.dark); }
  P.hl(-1, -14, 4, LAMP.mid);
  const ly = -31;
  P.hl(-2, ly + 1, 6, LAMP.dark); P.hl(-1, ly, 4, LAMP.mid);
  for (let y = ly + 2; y < ly + 6; y++) { P.px(-2, y, LAMP.dark); P.px(3, y, LAMP.dark); P.px(-1, y, LAMP.glassHi); P.px(0, y, LAMP.glass); P.px(1, y, LAMP.glass); P.px(2, y, mix(LAMP.glass, 0x8a7e60, 0.5)); }
  P.hl(-2, ly + 6, 6, LAMP.dark); P.hl(-1, ly + 7, 4, LAMP.mid);
  for (let y = ly + 8; y < -24; y++) { P.px(0, y, LAMP.hi); P.px(1, y, LAMP.dark); }
  if (snow) P.hl(-1, ly, 4, SNOW);
  return P.flush();
}

const ART = {};
function art(snow) {
  if (ART[snow]) return ART[snow];
  ART[snow] = {
    back: paintBack(snow), front: paintFront(snow), anchors: paintAnchorsS(snow), stairs: paintStairs(snow),
    towers: TOWERS.map((t) => paintTower(t, snow)), iron: paintIron(snow), qlamp: quayLampSprite(snow),
  };
  return ART[snow];
}

// ---------------------------------------------------------------------
// paintRiver: vattnet, kajerna, däcken, balkarna, pelarfötterna, skuggor och speglingar
// ---------------------------------------------------------------------
// Kanalens vatten precis som marken (ground.js paintCanal) målar det – samma brus och frön, så att
// floden och kanalen går ihop utan skarv i mynningen. wall = kajmuren står ovanför (dess spegling).
const CANAL_WL = CITY.CANAL[0] + 7;                                          // 783: kanalens vattenlinje
function canalColor(x, y, wall) {
  let c = mix(0x3e7088, 0x1c3c54, (y - CANAL_WL) / (H - CANAL_WL));
  if (wall && y < CANAL_WL + 4) c = mix(c, 0x2a3a40, (CANAL_WL + 4 - y) * 0.16 + (vnoise(x, y, 4, 384) - 0.5) * 0.2);
  const r = vnoise(x * 0.3, y * 1.6, 3, 385) * 0.7 + vnoise(x * 0.1, y, 6, 386) * 0.3;
  if (r > 0.7) c = mix(c, 0x9ac4dc, 0.3 + (r - 0.7) * 0.9);
  else if (r < 0.28) c = mul(c, 0.86);
  return c;
}
function waterColor(x, y) {
  // i mynningen tar kanalens vatten över (dithrad övergång kring kanalens vattenlinje)
  const k = smooth(CANAL_WL - 14, CANAL_WL + 14, y);
  if (k > 0 && bayer(x, y) < k) return canalColor(x, y, false);
  const dW = x - WX0, dE = WX1 - 1 - x, edge = Math.min(dW, dE);
  const f = smooth(0, 80, edge);
  let c = mix(0x3f7b8f, 0x1f4d68, f * 0.8 + vnoise(x, y, 70, 1701) * 0.2);
  const band = vnoise(x * 0.7, y * 0.06, 12, 1702);                         // strömfåror längs flödet
  c = mix(c, band > 0.5 ? 0x3a7890 : 0x173a52, Math.abs(band - 0.5) * 0.55);
  const r = vnoise(x * 0.3, y * 1.6, 3, 1703) * 0.7 + vnoise(x * 0.1, y, 6, 1704) * 0.3;
  if (r > 0.7) c = mix(c, 0x9ac4dc, 0.28 + (r - 0.7) * 0.9);
  else if (r < 0.28) c = mul(c, 0.86);
  const s = vnoise(x * 0.5, y * 0.14, 5, 1705);                             // breda, svaga strömstråk längs flödet
  if (s > 0.74) c = mix(c, 0x5a98b0, (s - 0.74) * 0.9);
  if (y < CANAL_WL) {                                                       // kajmurarna längs floden slutar vid kanalen
    if (dW < 7) c = mul(c, 0.64 + dW * 0.05);                               // västra kajmurens skugga
    else if (dE < 2) c = mix(c, 0x86b4c4, 0.3 - dE * 0.12);
    if (dW === 0 || dE === 0) c = mix(c, 0x2e4430, 0.5);                    // alger i vattenlinjen
  }
  return c;
}
function paintWater(P) {
  for (const r of RIVER.water) for (let y = Math.max(0, r[1]); y < Math.min(H, r[3]); y++) for (let x = r[0]; x < r[2]; x++) P.px(x, y, waterColor(x, y));
  // däckens skugga norr om broarna (solen i sydväst)
  for (const [y1, n] of [[N_RAIL, 11], [IN_RAIL, 9]]) for (let y = y1 - n; y < y1; y++) for (let x = WX0; x < WX1; x++) {
    if (bayer(x, y) < ((y - (y1 - n)) / n) * 0.9 + 0.1) P.darken(x, y, 1, 1, 0.72);
  }
  // (tornens långa skuggor snett mot nordost bakas inte in: de följer solen – se towerShadowArt)
  // under balkarna: den mörka undersidan speglas
  for (const [y0, n] of [[S_RAIL + GIRD, 6], [IS_RAIL + IGIRD, 5]]) for (let y = y0; y < y0 + n; y++) for (let x = WX0; x < WX1; x++) {
    const u = (y - y0) / n;
    if (bayer(x, y) > u) P.darken(x, y, 1, 1, 0.62 + u * 0.2);
  }
}
// kajerna: stora granithällar, kantsten mot land, räcket mot vattnet
function paintQuays(P) {
  const rowsSkip = (y) => (y >= N_DECK && y < S_DECK) || (y >= IN_DECK && y < IS_DECK) || y >= QUAY_END;
  const railRow = (y) => (y >= N_RAIL && y < N_DECK) || (y >= S_DECK && y < S_RAIL) || (y >= IN_RAIL && y < IN_DECK);
  const nearBridge = (y, m) => (y > N_RAIL - m && y < S_RAIL + m) || y > IN_RAIL - m;
  for (const [q, side] of [[RIVER.quayW, 'w'], [RIVER.quayE, 'e']]) {
    const x0 = q[0], x1 = q[2], worn = side === 'e' ? 0.5 : 0, seed = 1710 + x0;
    let y = 0, row = 0;
    while (y < QUAY_END) {
      const h = 9 + Math.floor(hash(row, 1, seed) * 4);
      const split = hash(row, 2, seed) < 0.6 ? x0 + 6 + Math.floor(hash(row, 3, seed) * 9) : -1;
      for (let yy = y; yy < y + h && yy < QUAY_END; yy++) {
        if (rowsSkip(yy)) continue;
        const xe0 = side === 'e' && railRow(yy) ? x0 - 4 : x0, xe1 = side === 'w' && railRow(yy) ? x1 + 4 : x1;
        for (let x = xe0; x < xe1; x++) {
          const k = split > 0 && x >= split ? 1 : 0, ly = yy - y;
          let c = granite(x, yy, mix(0xb8b2a6, 0xa49d90, hash(row, k, seed + 4)));
          if (ly === h - 1 || x === split - 1) c = worn && hash(x, yy, seed + 5) > 0.7 ? 0x5a6a3a : 0x6c675e;
          else if (ly === 0 || x === split) c = mix(c, 0xffffff, 0.12);
          if (worn && hash(Math.floor(x / 3), Math.floor(yy / 3), seed + 6) > 0.93) c = mul(c, 0.86);
          if ((side === 'w' && x === x0) || (side === 'e' && x === x1 - 1)) c = side === 'w' ? mix(c, 0xe0dace, 0.4) : mul(c, 0.82); // kantsten mot land
          P.px(x, yy, c);
        }
      }
      y += h; row++;
    }
    // dagvattengaller
    for (let yy = 70 + (side === 'e' ? 40 : 0); yy < QUAY_END - 20; yy += 170) {
      if (nearBridge(yy, 10)) continue;
      const gx = x0 + 6;
      for (let j = 0; j < 4; j++) for (let i = 0; i < 6; i++) P.px(gx + i, yy + j, i === 0 || j === 0 ? 0x4a4640 : i % 2 ? 0x2a2826 : 0x6a655c);
    }
  }
  // räckena mot vattnet: kantsten (ljus) + järnräcke (stolpar var 8:e px)
  for (const r of RIVER.rails) {
    const west = r[0] < RX0 + RW / 2;
    for (let y = Math.max(0, r[1]); y < Math.min(r[3], CITY.QUAY[1]); y++) {
      const gap = STEPS.some(([, sy, s]) => (s === 'w') === west && y >= sy && y < sy + 14);
      for (let x = r[0]; x < r[2]; x++) {
        const lx = west ? x - r[0] : r[2] - 1 - x;                     // 0 = mot kajen, 3 = mot vattnet
        let c = lx === 0 ? granite(x, y, 0xd8d0c2) : lx === 3 ? granite(x, y, 0x9e968a) : granite(x, y, 0xc6beb0);
        if (!gap) {
          if (lx === 1) c = 0x2c2f36;
          if (y % 8 === 0 && lx <= 2) c = lx === 1 ? 0x8a929c : 0x2a2c32;                     // stolpen
          if (y % 8 === 1 && lx === 1) c = 0x1e2026;
        } else if (lx === 1 && y % 3 === 0) c = 0x6a6258;                                       // kedjan över trappan
        P.px(x, y, c);
      }
      if (!gap && y % 8 === 1) P.darken(r[2], y - 1, 1, 1, 0.75);                              // stolparnas skugga
    }
  }
  // pollare, förtöjningsringar och livbojar
  for (const { x: bx, y } of QUAY_BOLLARDS) {
    P.rect(bx, y, 3, 4, 0x2e3036); P.px(bx, y, 0x6a707a); P.px(bx + 1, y, 0x4a4e56); P.hl(bx - 1, y + 1, 5, 0x3a3e46); P.px(bx - 1, y + 1, 0x5a5e68);
    P.darken(bx + 3, y - 1, 1, 3, 0.8);
    P.px(bx, y + 4, mul(P.get(bx, y + 4), 0.8)); P.px(bx + 1, y + 4, mul(P.get(bx + 1, y + 4), 0.85));
  }
  for (const [q, side] of [[RIVER.quayW, 'w'], [RIVER.quayE, 'e']]) {
    for (let y = 30 + (side === 'e' ? 44 : 0); y < QUAY_END - 16; y += 96) {
      const ry = y + 48;
      if (!nearBridge(ry, 14)) {
        const rx = side === 'w' ? q[2] + 2 : q[0] - 3;
        P.px(rx, ry, 0x2a2a2c); P.px(rx, ry + 2, 0x2a2a2c); P.px(rx - 1, ry + 1, 0x3a3a3e); P.px(rx + 1, ry + 1, 0x1a1a1c); P.px(rx, ry + 1, 0x8a5a36);
      }
    }
    for (const ly of side === 'w' ? [110, 560] : [130, 470]) {
      const bx = side === 'w' ? q[2] - 1 : q[0] - 4;
      P.rect(bx, ly - 1, 4, 8, 0x5a4a38);
      [[1, 0], [2, 0], [0, 1], [3, 1], [0, 2], [3, 2], [0, 3], [3, 3], [1, 4], [2, 4]].forEach(([i, j], n) => P.px(bx + i, ly + j, n % 3 === 0 ? 0xf4f0e8 : 0xe0501e));
      P.px(bx + 1, ly + 1, 0x3a2e22); P.px(bx + 2, ly + 1, 0x3a2e22);
    }
  }
}
// Mynningen: där kajräckena når kanalen (y ≥ CANAL[0]) viker kanalens kajmur runt hörnet och
// vattnet går ihop med kanalen – samma mur och samma vatten (samma brus) som marken målar i
// kanalen väster och öster om floden, så att skarven inte syns.
function paintMouth(P) {
  const y0 = CITY.CANAL[0], wl = y0 + 7;
  for (const [xa, xb, west] of [[RIVER.quayW[2], WX0, 1], [WX1, RIVER.quayE[0], 0]]) {
    for (let y = y0; y < H; y++) for (let x = xa; x < xb; x++) {
      let c;
      if (y < wl) {                                                        // kajmurens framsida (mot söder)
        const row = Math.floor((y - y0) / 3.5), off = (row & 1) * 7;
        c = mul(mix(0x7e7a72, 0x6a665e, hash(Math.floor((x + off) / 14), row, 381)), 1 - (y - y0) * 0.06);
        if ((((x + off) % 14) + 14) % 14 === 0) c = 0x3a3834;
        if (y === wl - 1) c = mix(c, 0x3e5a3a, 0.7);                        // alger i vattenlinjen
        if (west ? x === xb - 1 : x === xa) c = west ? mix(c, 0xffffff, 0.14) : mul(c, 0.78);   // hörnet där muren viker in längs floden
      } else c = canalColor(x, y, true);
      P.px(x, y, c);
    }
  }
}
// Stora bron: gångbanor av plank (upphöjda, kantsten), räckenas kantstenar, expansionsfogar,
// mittpelaren mellan körfälten och fackverksbalken under södra kanten
// en planka (bräderna 4 px breda tvärs gångriktningen, en skarv per bräda) – xa är brons början,
// så att bräderna fortsätter obrutna in under tornens valv
function plankAt(x, y, xa, ya, yb, seed) {
  const bx = Math.floor((x - xa) / 4), lx = (x - xa) % 4;
  if (lx === 3) return 0x3b2f25;
  const joint = ya + 5 + Math.floor(hash(bx, 5, seed) * (yb - ya - 10));
  const seg = y < joint ? 0 : 1;
  let c = mix(WOOD[Math.floor(hash(bx, seg, seed) * 4)], 0x8e8a80, 0.2 + hash(bx, seg + 2, seed) * 0.35);   // väderbitet, gråblekt
  c = mul(c, 0.92 + hash(x, y >> 1, seed + 1) * 0.12);
  if (lx === 0) c = mix(c, 0xffffff, 0.08); else if (lx === 2) c = mul(c, 0.92);
  if (y === joint) c = 0x4a3c2e;
  if ((y === ya + 1 || y === yb - 2 || y === joint + 1) && lx === 1) c = 0x7a7e84;                  // spikar
  if (hash(x, y, seed + 2) > 0.994) c = mul(c, 0.7);                                                  // kvistar
  return c;
}
function planks(P, xa, xb, ya, yb, seed, tower = false) {
  for (let x = xa; x < xb; x++) {
    if (inTowerX(x) !== tower) continue;
    for (let y = ya; y < yb; y++) P.px(x, y, plankAt(x, y, xa, ya, yb, seed));
  }
}
// Valvets skugga i passagen genom tornet: solen (sydväst) lyser in genom den västra öppningen,
// mitt i tornet och mot den östra öppningen ligger golvet i skugga (ger faktorn för x).
function vaultShade(t, x) {
  const u = clamp01((x + 0.5 - t.x0) / (t.x1 - t.x0));
  return 0.58 + 0.22 * (1 - u) * (1 - u) + 0.05 * u ** 4;
}
// expansionsfog (fingerfog i stål) tvärs över däcket: två kammar som griper i varandra. Över
// körbanan (genomskinlig i flodbilden – marken målar asfalten) läggs den halvtäckande så att
// asfalten syns igenom, på gångbanorna och kantstenarna täckande.
function joint(P, jx, ya, yb, roadA, roadB) {
  for (let y = ya; y < yb; y++) {
    const road = y >= roadA && y < roadB, tooth = y % 3 === 2;
    if (road) {
      P.px(jx, y, 0x8a9098, 0.4);
      P.px(jx + 1, y, tooth ? 0x16181e : 0x6a7078, tooth ? 0.55 : 0.4);
    } else {
      P.px(jx, y, tooth ? 0x6a7078 : 0x969ca4);
      P.px(jx + 1, y, tooth ? 0x24272e : 0x5a6068);
    }
  }
}
function paintBigDeck(P) {
  const x0 = WX0, x1 = WX1;
  for (let x = x0; x < x1; x++) {
    // norra räckets kantsten
    P.px(x, N_RAIL, granite(x, N_RAIL, 0x8e887c)); P.px(x, N_RAIL + 1, granite(x, N_RAIL + 1, 0xd2cbbc)); P.px(x, N_RAIL + 2, granite(x, N_RAIL + 2, 0xc2baac));
    P.px(x, N_RAIL + 3, 0x5a5f68); P.px(x, N_RAIL + 4, x % 6 === 2 ? 0x9aa2ac : 0x4a4f58);
    // norra gångbanans kantsten mot körbanan (upphöjd, solbelyst framsida)
    P.px(x, ROAD0 - 4, granite(x, ROAD0 - 4, 0xe2dacb)); P.px(x, ROAD0 - 3, granite(x, ROAD0 - 3, 0xc8bfae)); P.px(x, ROAD0 - 2, granite(x, ROAD0 - 2, 0xb4ab9a)); P.px(x, ROAD0 - 1, 0x4a4640);
    // södra gångbanans kantsten; dess skugga faller norrut på körbanan
    P.px(x, ROAD1, granite(x, ROAD1, 0xe2dacb)); P.px(x, ROAD1 + 1, granite(x, ROAD1 + 1, 0xb8b0a0));
    P.px(x, ROAD1 - 1, 0x1a1c24, 0.4); if (bayer(x, ROAD1 - 2) < 0.5) P.px(x, ROAD1 - 2, 0x1a1c24, 0.25);
    // södra räckets kantsten (framsidan solbelyst)
    P.px(x, S_DECK - 2, 0x4a4f58); P.px(x, S_DECK - 1, 0x5a5f68);
    P.px(x, S_DECK, granite(x, S_DECK, 0xdcd4c4)); P.px(x, S_DECK + 1, granite(x, S_DECK + 1, 0xcfc6b4));
    P.px(x, S_DECK + 2, granite(x, S_DECK + 2, 0xc2b8a4)); P.px(x, S_DECK + 3, granite(x, S_DECK + 3, 0xb0a692)); P.px(x, S_DECK + 4, 0x6e685e);
  }
  planks(P, x0, x1, N_DECK, ROAD0 - 4, 1720);
  planks(P, x0, x1, ROAD1 + 2, S_DECK - 2, 1730);
  // genom tornen: promenadens plankor fortsätter in under valvet (samma bräder som ute på bron,
  // så att gångbanan läses som mark och inte som mur), mittpelarens fot mellan körfälten – och
  // allt i valvets skugga: ljusast vid den västra öppningen, en mörk kontaktskugga där golvet
  // möter valvets bortre vägg, körbanan halvtäckande (marken målar asfalten)
  planks(P, x0, x1, N_DECK, ROAD0 - 4, 1720, true);
  planks(P, x0, x1, ROAD1 + 2, S_DECK - 2, 1730, true);
  for (const t of TOWERS) {
    const [px0, py0, px1, py1] = t.pier;
    for (let x = px0; x < px1; x++) {
      P.px(x, py0 - 1, ST.hi); P.px(x, py0, granite(x, py0, ST.lit)); P.px(x, py0 + 1, granite(x, py0 + 1, ST.a));
      for (let y = py0 + 2; y < py1 + 1; y++) P.px(x, y, granite(x, y, y === py1 ? ST.dark : ST.b));
    }
    for (const bx of [px0 + 2, px1 - 5]) { P.rect(bx, py0 - 3, 3, 3, 0xe0c040); P.hl(bx, py0 - 3, 3, 0xfff0a0); P.hl(bx, py0 - 1, 3, 0x2a2a2e); }   // påkörningsskydd
    for (let y = N_RAIL + 1; y < S_DECK + 5; y++) for (let x = t.x0; x < t.x1; x++) {
      let f = vaultShade(t, x);
      if (y >= N_DECK && y < N_DECK + 3) f *= 0.7 + (y - N_DECK) * 0.1;                     // kontaktskuggan mot valvets vägg
      const i = ((y - P.oy) * P.w + (x - P.ox)) * 4;
      if (P.d[i + 3] < 255) { P.px(x, y, 0x10121a, 1 - f); continue; }                        // körbanan: halvtäckande skugga
      P.px(x, y, mix(mul(P.get(x, y), f), 0x222a3c, 0.1));                                   // plankor, kantstenar, pelaren
    }
    for (let x = px0; x < px1; x++) P.px(x, py1 + 1, 0x1a1c24, 0.35);                         // pelarens skugga på asfalten
  }
  // expansionsfogar: vid brofästena och på båda sidor om tornen
  for (const jx of [x0, x1 - 2, ...TOWERS.flatMap((t) => [t.x0 - 3, t.x1 + 1])]) joint(P, jx, N_RAIL + 1, S_DECK + 4, ROAD0, ROAD1);
  // tornens östsida kastar en smal skugga på gångbanorna
  for (const t of TOWERS) for (let y = N_DECK; y < S_DECK; y++) for (let x = t.x1 + 2; x < t.x1 + 6; x++) if (bayer(x, y) < 0.75 - (x - t.x1 - 2) * 0.18) P.px(x, y, 0x10141e, 0.24);
}
// fackverksbalken under Stora brons södra kant ("stålbalkarna under körbanan") – i det främre
// lagret så att isen på vintern (weather.js lägger den över allt vatten) inte döljer den
function paintGirder(P) {
  const x0 = WX0, x1 = WX1;
  for (let x = x0; x < x1; x++) {
    const px = (x - x0) % 14;
    for (let y = S_RAIL; y < S_RAIL + GIRD; y++) {
      const ly = y - S_RAIL;
      let c = 0x1c2027;                                                             // undersidan i djup skugga
      if (ly === 0) c = 0x8e96a0; else if (ly === 1) c = 0x5a616c;
      else if (ly === GIRD - 3) c = 0x626a74; else if (ly === GIRD - 2) c = 0x3a4048; else if (ly === GIRD - 1) c = 0x16191e;
      else {
        const u = (ly - 2) / (GIRD - 5);
        if (Math.abs(px - u * 14) < 0.7 || Math.abs(px - (1 - u) * 14) < 0.7) c = 0x56606a;
        if (px === 0) c = 0x6a727c; else if (px === 1) c = 0x3e444e;
      }
      if ((px === 0 || px === 7) && (ly === 1 || ly === GIRD - 3)) c = 0xa8b0ba;   // nitar
      P.px(x, y, c);
    }
  }
}
// Järnbron: gångbanor av räfflad plåt, kantstenar, balken med gjutjärnsskylten, pelarna
function checker(P, xa, xb, ya, yb) {
  for (let y = ya; y < yb; y++) for (let x = xa; x < xb; x++) {
    let c = mix(0x70767a, 0x62686c, hash(Math.floor(x / 24), Math.floor(y / 16), 1900));
    const a = (((x + y * 2) % 6) + 6) % 6, b = (((x - y * 2) % 6) + 6) % 6;
    if ((y % 4 === 0 && a === 0) || (y % 4 === 2 && b === 0)) c = 0x9ca2a6;
    else if ((y % 4 === 1 && a === 1) || (y % 4 === 3 && b === 5)) c = 0x4e5458;
    if ((x - xa) % 24 === 23) c = 0x3a3e42;                                            // skarvarna
    if ((x - xa) % 24 === 21 && (y === ya + 1 || y === yb - 2)) c = 0xb0b6ba;          // nitar
    c = mul(c, 0.95 + hash(x, y, 1901) * 0.08);
    if (hash(x >> 2, y >> 2, 1902) > 0.96) c = mix(c, IRON.rust, 0.4);                // rostfläckar
    P.px(x, y, c);
  }
}
function paintIronDeck(P) {
  if (!IB) return;
  const x0 = IB.x0, x1 = IB.x1;
  for (let x = x0; x < x1; x++) {
    for (let y = IN_RAIL; y < IN_DECK; y++) P.px(x, y, y === IN_RAIL ? IRON.deep : y === IN_DECK - 1 ? IRON.dark : IRON.mid);
    P.px(x, IROAD0 - 3, 0xd8d0c0); P.px(x, IROAD0 - 2, 0xb8b0a0); P.px(x, IROAD0 - 1, 0x4a4640);
    P.px(x, IROAD1, 0xd8d0c0); P.px(x, IROAD1 + 1, 0xb0a898); P.px(x, IROAD1 - 1, 0x1a1c24, 0.4);
    for (let y = IS_DECK; y < IS_RAIL; y++) P.px(x, y, y === IS_DECK ? IRON.lit : y === IS_RAIL - 1 ? IRON.deep : IRON.mid);
  }
  checker(P, x0, x1, IN_DECK, IROAD0 - 3);
  checker(P, x0, x1, IROAD1 + 2, IS_DECK);
  for (const jx of [x0, x1 - 2, ...PIERS.map((p) => p - 1)]) joint(P, jx, IN_RAIL, IS_RAIL, IROAD0, IROAD1);
}
// Järnbrons stenpelare: stävarna mot strömmen (norr om däcket, i det bakre fackverkslagret)
function paintIronNoses(P) {
  for (const px of PIERS) {
    for (let y = IN_RAIL - 16; y < IN_RAIL; y++) {
      const hw = Math.round(7 * clamp01((y - (IN_RAIL - 16)) / 10));
      for (let x = px - hw; x < px + hw; x++) {
        let c = granite(x, y, mix(0xa8a090, 0x8e8676, hash(x >> 2, y >> 2, 1920)));
        if (x < px) c = mix(c, 0xffffff, 0.08); else c = mul(c, 0.8);
        if (x === px - hw || x === px + hw - 1) c = mix(c, 0x2e4430, 0.5);
        if (y >= IN_RAIL - 3) c = mul(c, 0.7);                                          // i däckets skugga
        P.px(x, y, c);
      }
    }
  }
}
// Järnbrons plåtbalk under södra kanten med gjutjärnsskylten och pelarnas stävar nedströms
// (i det främre fackverkslagret, så att isen inte döljer dem)
function paintIronGirder(P) {
  const x0 = IB.x0, x1 = IB.x1;
  // plåtbalken under södra kanten, med förstyvningar och nitrader
  const g0 = IS_RAIL, g1 = IS_RAIL + IGIRD;
  for (let x = x0; x < x1; x++) for (let y = g0; y < g1; y++) {
    const ly = y - g0, st = (x - x0) % 16;
    let c = mix(IRON.mid, IRON.lit, 0.25 + hash(x >> 3, 0, 1910) * 0.1);
    if (ly === 0) c = IRON.hi; else if (ly === IGIRD - 2) c = IRON.dark; else if (ly === IGIRD - 1) c = IRON.deep;
    else if (st === 0) c = IRON.hi; else if (st === 1) c = IRON.dark;
    if ((ly === 2 || ly === IGIRD - 3) && x % 4 === 1) c = IRON.rivet;
    if (hash(x, y, 1911) > 0.97) c = mix(c, IRON.rust, 0.5);
    if (ly > 2 && ly < IGIRD - 2 && hash(x, 7, 1912) > 0.9 && ly < 2 + 5 * hash(x, 8, 1912)) c = mix(c, IRON.rust, 0.35);   // rostränder
    P.px(x, y, c);
  }
  // gjutjärnsskylten mitt på balken
  const s = `${$t('JÄRNBRON')} 1907`, tw = textW(SMALL, s), sx = ((x0 + x1) >> 1) - (tw >> 1) - 3;
  for (let y = g0 + 1; y < g1 - 1; y++) for (let x = sx; x < sx + tw + 6; x++) {
    const e = x === sx || y === g0 + 1, f = x === sx + tw + 5 || y === g1 - 2;
    P.px(x, y, e ? 0x5a5e62 : f ? 0x121416 : 0x24282c);
  }
  eachTextPixel(SMALL, s, sx + 4, g0 + 3, 1, (x, y) => P.px(x, y, 0x0e1012));
  eachTextPixel(SMALL, s, sx + 3, g0 + 2, 1, (x, y) => P.px(x, y, 0xd8dcd0));
  // pelarnas stävar nedströms
  for (const px of PIERS) for (let y = g1; y < g1 + 16; y++) {
    const hw = Math.round(7 * clamp01((g1 + 14 - y) / 10));
    for (let x = px - hw; x < px + hw; x++) {
      let c = granite(x, y, mix(0xa8a090, 0x8e8676, hash(x >> 2, y >> 2, 1921)));
      if (x < px) c = mix(c, 0xffffff, 0.06); else c = mul(c, 0.78);
      if (y < g1 + 3) c = mul(c, 0.6);
      if (y >= g1 + 12) c = mix(c, 0x2e4430, 0.3);
      P.px(x, y, c);
    }
  }
}
// svallet vid Järnbrons pelare (i vattnet – syns inte när isen ligger)
function paintIronFoam(P) {
  for (const px of PIERS) {
    for (let y = IN_RAIL - 14; y < IN_RAIL; y++) {
      const hw = Math.round(7 * clamp01((y - (IN_RAIL - 16)) / 10));
      for (const sx2 of [px - hw - 1, px + hw]) P.px(sx2, y, 0xdceef4, 0.55);
    }
    const g1 = IS_RAIL + IGIRD;
    for (let k = 0; k < 26; k++) {
      const y = g1 + 14 + k, sp = 1 + k * 0.35;
      for (const s2 of [-1, 1]) if (hash(k, s2 + 2, 1922 + px) > 0.35) P.px(Math.round(px + s2 * sp), y, 0xdceef4, 0.5 * (1 - k / 26));
    }
  }
}
// tornfötternas virvlar nedströms (stävarna själva hör till tornbilden) och förankringsblockens svall
function paintFootings(P) {
  for (const t of TOWERS) {
    const sy1 = t.legs[1][3];
    for (let k = 0; k < 40; k++) {
      const y = sy1 + 8 + k, sp = 2 + k * 0.45;
      for (const s of [-1, 1]) if (hash(k, s + 2, 1940 + t.i) > 0.3) P.px(Math.round(t.cx + s * sp), y, 0xdceef4, 0.55 * (1 - k / 40));
      if (k < 20 && hash(k, 9, 1941 + t.i) > 0.6) P.px(Math.round(t.cx + (hash(k, 10, 1942) - 0.5) * sp * 1.6), y, 0xdceef4, 0.3);
    }
  }
  for (const [xa, xb, y] of [[SB.x0, SB.x0 + 24, N_RAIL - 21], [SB.x1 - 24, SB.x1, N_RAIL - 21], [SB.x0, SB.x0 + 24, S_RAIL + 23], [SB.x1 - 24, SB.x1, S_RAIL + 23]]) {
    for (let x = xa; x < xb; x++) if (hash(x, y, 1950) > 0.35) P.px(x, y, 0xdceef4, 0.45);
  }
}
// Tornens och södra kabelns spegling i vattnet söder om bron (natten tonas som marken)
function paintReflections(P) {
  const A = art(0);
  A.towers.forEach((T, ti) => {
    const t = TOWERS[ti], water0 = t.base + 10, L = 150;
    for (let y = water0; y < water0 + L; y++) {
      const sy = t.base - (y - t.base);
      if (sy < T.oy || hash(y >> 1, 3, 1960) < 0.2) continue;                          // krusningarna bryter bilden
      const wob = Math.round(Math.sin((y >> 1) * 0.9) * 1.6), fade = 0.3 * (1 - (y - water0) / L);
      for (let x = t.x0 - 2; x < t.x1 + 2; x++) {
        const sx = x - wob - T.ox, syy = sy - T.oy;
        if (sx < 0 || sx >= T.w || syy < 0 || syy >= T.h || !inWater(x, y)) continue;
        const i = (syy * T.w + sx) * 4;
        let c;
        if (T.d[i + 3] === 0) {                                                          // valvens genomskärning: mörkt valv i speglingen
          if (sx + T.ox < t.x0 || sx + T.ox >= t.x1 || sy < APEX || sy >= WIN_B) continue;
          c = 0x3a3a34;
        } else c = (T.d[i] << 16) | (T.d[i + 1] << 8) | T.d[i + 2];
        P.px(x, y, mix(mul(c, 0.8), 0x1f4d68, 0.3), fade);
      }
    }
  });
  for (let x = T1.x1 + 2; x < T2.x0 - 2; x++) {
    const y = Math.round(S_RAIL + GIRD + 6 + (S_RAIL - FS(x)) * 0.9);
    if (y >= IN_RAIL - 12 || hash(x, y >> 2, 1961) < 0.3) continue;
    P.px(x, y, 0x1a2c3c, 0.3); P.px(x, y + 1, 0x1a2c3c, 0.15);
  }
}
function nightTint(d) {
  for (let i = 0; i < d.length; i += 4) { if (!d[i + 3]) continue; d[i] *= 0.86; d[i + 1] *= 0.9; d[i + 2] = Math.min(255, d[i + 2] * 0.97 + 8); }
}
let RIVER_DAY = null;
export function paintRiver(night) {
  if (!RIVER) return null;
  const P = new Pix(RW, H, RX0, 0);
  if (!RIVER_DAY) {
    paintWater(P);
    paintFootings(P);
    try { paintReflections(P); } catch (e) { console.error('floden: speglingarna kunde inte målas:', e); }
    paintQuays(P);
    paintMouth(P);
    paintBigDeck(P);
    if (IB) { paintIronDeck(P); paintIronFoam(P); }
    RIVER_DAY = new Uint8ClampedArray(P.d);
  } else P.d.set(RIVER_DAY);
  if (night) nightTint(P.d);
  return P.flush();
}

// ---------------------------------------------------------------------
// Båtarna – sprites sedda uppifrån; den södra änden visar skrovets sida
// ---------------------------------------------------------------------
// Pråm med containrar (fören söderut), 26 × 62
function paintBarge(P) {
  const W = 26, L = 58;
  for (let y = 0; y < L + 4; y++) for (let x = 0; x < W; x++) {
    const bow = y >= L - 5 ? y - (L - 5) : 0, inset = bow > 2 ? bow - 2 : 0;
    if (x < inset || x >= W - inset) continue;
    let c;
    if (y >= L - 1) c = y === L + 3 ? 0x1a3040 : y === L + 2 ? 0x8a2a22 : mix(0x2a2a2e, 0x3a3a40, bayer(x, y));   // skrovsidan
    else if (x === inset || x === W - 1 - inset || y === 0) c = 0x6a707a;
    else if (x === inset + 1 || y === 1) c = 0x3a3e46;
    else c = mix(0x4a3a30, 0x5a4638, hash(x >> 2, y >> 2, 2001));
    if (y >= L - 1 && y < L + 2 && hash(x, 3, 2002) > 0.8) c = mix(c, 0x7a4a2a, 0.5);   // rost
    P.px(x, y, c);
  }
  // containrar i två rader × fyra (taket + södra sidan syns)
  const cols = [0xb83a2a, 0x2a5aa0, 0x3a8a4a, 0xd89a2a, 0x7a7a82, 0x2a8a8a, 0xa84a6a, 0xc8c0b0];
  for (let r = 0; r < 4; r++) for (let k = 0; k < 2; k++) {
    const cx0 = 3 + k * 10, cy0 = 3 + r * 13, c = cols[(r * 2 + k + 3) % cols.length];
    for (let y = cy0; y < cy0 + 12; y++) for (let x = cx0; x < cx0 + 10; x++) {
      const side = y >= cy0 + 8;
      let q = side ? mul(c, 0.72) : mix(c, 0xffffff, 0.08);
      if (!side && (x - cx0) % 2 === 1) q = mul(q, 0.9);                              // korrugerat tak
      if (side && (x - cx0) % 2 === 0) q = mul(q, 0.86);
      if (x === cx0 || y === cy0) q = mix(q, 0xffffff, 0.2);
      if (x === cx0 + 9) q = mul(q, 0.7);
      if (side && y === cy0 + 8) q = mix(q, 0xffffff, 0.15);
      if (side && (x === cx0 + 4 || x === cx0 + 5) && y > cy0 + 8) q = mul(q, 0.6);    // dörrarnas regel
      P.px(x, y, q);
    }
  }
}
// Ytterkant på ett skrov: sant om (x, y) ligger i skrovet men någon granne inte gör det.
const hullEdge = (inside, x, y) => inside(x, y) && (!inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1));
// Påskjutaren (trycker pråmen framför sig), fören söderut, 18 × 29. Uppifrån: svart gummifender
// runt om, rött brädgångsband, stålgrått däck med pollare och trossrulle, styrhytten (vitt tak
// med radar och mast, fönsterbandet i södra väggen), skorstenen bakom och tryckknäna fram.
function paintTug(P) {
  const W = 18, L = 26, INS = [4, 2, 1, 1, 0];
  const inset = (y) => (y < INS.length ? INS[y] : 0);
  const inside = (x, y) => y >= 0 && y < L && x >= inset(y) && x < W - inset(y);
  for (let y = 0; y < L; y++) for (let x = inset(y); x < W - inset(y); x++) {
    let c;
    if (hullEdge(inside, x, y)) c = x < W / 2 || y < 2 ? 0x3a3a42 : 0x18181c;               // gummifendern (västkanten i solen)
    else if (hullEdge((a, b) => inside(a - 1, b) && inside(a + 1, b) && inside(a, b - 1), x, y)) c = x < W / 2 ? 0xd04a36 : x > W / 2 ? 0x8e2c22 : 0xb8382a; // brädgången
    else {
      c = mix(0x746c64, 0x665e58, hash(x >> 2, (y / 7) | 0, 2010) * 0.8);                     // stålplåtar
      if (y % 7 === 6) c = 0x544c46;
      c = mul(c, 0.96 + hash(x, y, 2011) * 0.08);
    }
    P.px(x, y, c);
  }
  // fören (södra sidan syns): rött skrov, fendern, vattenlinjen
  for (let x = 0; x < W; x++) { P.px(x, L, x < 2 ? 0x7a2418 : 0xa83424); P.px(x, L + 1, 0x1a1a1e); P.px(x, L + 2, 0x1a3040); }
  // tryckknäna: två svarta gummiklädda block längst fram
  for (const kx of [3, W - 6]) { P.rect(kx, L - 3, 3, 5, 0x1c1c20); P.hl(kx, L - 3, 3, 0x4a4a52); P.px(kx, L - 2, 0x3a3a40); }
  // pollare och trossrulle
  for (const [bx, by] of [[2, 6], [W - 4, 6], [2, 20], [W - 4, 20]]) { P.rect(bx, by, 2, 2, 0x2a2a30); P.px(bx, by, 0x7a7e86); }
  P.rect(5, 21, 3, 2, 0xb89a6a); P.px(6, 21, 0x7a6040); P.px(7, 22, 0x8a7050);
  // skorstenen bakom hytten: svart topp, rött och vitt band
  P.hl(7, 2, 4, 0x3a3a40); P.px(7, 3, 0x2a2a2e); P.hl(8, 3, 2, 0x0a0a0c); P.px(10, 3, 0x2a2a2e);
  P.hl(7, 4, 4, 0xc83a2a); P.px(7, 4, 0xe05040); P.hl(7, 5, 4, 0xe8e8e0); P.px(10, 5, 0xb8bcc0);
  for (let y = 3; y < 7; y++) P.px(11, y, 0x3e3834);                                          // skuggan österut
  // styrhytten: taket (vitt, reling runt kanten), radarn och masten, södra väggen med fönsterbandet
  for (let y = 8; y < 16; y++) for (let x = 4; x < 14; x++) {
    let c = x < 9 ? 0xf0f2f2 : 0xe2e6e8;                                                        // taket lutar lite åt öster
    if (x === 4 || y === 8) c = 0xffffff; else if (x === 13) c = 0xbcc2c6;
    if (y === 15) c = 0xb4babe;
    P.px(x, y, c);
  }
  P.hl(6, 11, 5, 0x9aa0a8); P.hl(7, 12, 3, 0x6a7078);                                          // radarantennen på sin fot
  P.px(11, 9, 0x5a5e66); P.px(11, 10, 0x7a7e86);                                               // masten med topplanternan
  for (let x = 4; x < 14; x++) {
    P.px(x, 16, 0xd8dcdc);
    const mull = (x - 4) % 3 === 2;
    P.px(x, 17, mull ? 0xe8eaea : x === 5 || x === 8 ? 0x8ab0cc : 0x2a3a52);
    P.px(x, 18, mull ? 0xd8dcdc : 0x1e2a40);
    P.px(x, 19, 0xc4c8cc);
    P.px(x, 20, mul(P.get(x, 20), 0.7));                                                       // hyttens skugga på däcket
  }
  for (let y = 9; y < 20; y++) P.px(14, y, mul(P.get(14, y), 0.78));
  // livbojar på hyttens sidor
  for (const lx of [2, W - 4]) { P.px(lx, 12, 0xe0501e); P.px(lx + 1, 12, 0xf4f0e8); P.px(lx, 13, 0xf4f0e8); P.px(lx + 1, 13, 0xe0501e); }
}
// Motorbåt (fören norrut), 12 × 26
function paintMotorboat(P) {
  const W = 12, L = 23;
  for (let y = 0; y < L + 3; y++) for (let x = 0; x < W; x++) {
    const inset = y < 8 ? Math.round((8 - y) * 0.7) : 0;
    if (x < inset || x >= W - inset) continue;
    let c;
    if (y >= L) c = y === L + 2 ? 0x1a3040 : y === L + 1 ? 0x2a5ab0 : 0xf2f2ee;          // akterspegeln
    else if (x === inset || x === W - 1 - inset) c = x === inset ? 0xffffff : 0xc8ccd0;
    else if (y < 9) c = mix(0xf4f4f0, 0xe0e2e2, x / W);
    else c = y < 20 ? 0xd8c8a8 : 0x8a7a64;                                               // teakdäck, sittbrunn
    if ((x === inset + 1 || x === W - 2 - inset) && y > 4 && y < L) c = 0x2a5ab0;       // blå rand
    P.px(x, y, c);
  }
  for (let x = 2; x < 10; x++) { P.px(x, 9, 0x6a8aa8); P.px(x, 10, 0x3a5a78); }          // vindrutan
  P.px(3, 9, 0xe8f4ff);
  P.rect(4, 12, 4, 3, 0x3a7bd5); P.rect(5, 11, 2, 2, 0x5a3a24); P.px(5, 11, 0x7a5a3a);   // föraren
  P.rect(2, 16, 8, 2, 0xf4f4f0); P.px(2, 16, 0xffffff);                                 // soffan
  P.rect(4, L + 1, 4, 3, 0x2a2e36); P.hl(4, L + 1, 4, 0x6a707a);                        // utombordaren
}
// Turistbåt (fören söderut), 22 × 52: marinblått skrov med vit reling, akterdäck av teak med
// bänkar och folk, en lång salong med glastak (ljusare västsida, nock i mitten, spröjsar)
// där passagerarna syns genom glaset, salongens södra vägg med fönster, fördäck med tross och
// livboj – och förstäven (södra sidan) med vattenlinjen.
const TOUR_FOLK = [[0x3b2619, 0xe0a97f, 0xc9323a], [0xd8a040, 0xf0c8a0, 0x3a7bd5], [0x1c1c1c, 0x8a5a3a, 0xf0c830], [0xa0522d, 0xeabf98, 0x2f8a5a], [0xc8c8c8, 0xe8c0a0, 0x7a4aa0], [0x5a3a2a, 0xd8a078, 0xe86ab0]];
function paintTourBoat(P) {
  const W = 22, L = 48, S0 = 10, S1 = 40;                                                      // salongen y 10–40
  const inset = (y) => (y < 2 ? 2 - y : y > 41 ? Math.round((y - 41) * 1.1) : 0);
  const inside = (x, y) => y >= 0 && y < L && x >= inset(y) && x < W - inset(y);
  for (let y = 0; y < L; y++) for (let x = inset(y); x < W - inset(y); x++) {
    let c;
    if (hullEdge(inside, x, y)) c = x < W / 2 ? 0x2e5a9a : 0x1a3462;                           // skrovets utfall (marinblått)
    else if (hullEdge((a, b) => inside(a - 1, b) && inside(a + 1, b) && inside(a, b - 1), x, y)) c = x < W / 2 ? 0xf6f6f0 : 0xc4c8cc; // relingen
    else {                                                                                      // teakdäck
      c = ((x >> 1) & 1) ? 0xa88254 : 0xb88e5e;
      if ((x & 1) && ((x >> 1) & 1)) c = 0x7a5a36;
      c = mul(c, 0.94 + hash(x, y >> 2, 2030) * 0.1);
    }
    P.px(x, y, c);
  }
  // förstäven (södra sidan syns): vit relingskant, marinblått skrov, vattenlinjen
  const i0 = inset(L - 1);
  for (let x = i0; x < W - i0; x++) { P.px(x, L, 0xeeeee8); P.px(x, L + 1, x < W / 2 ? 0x24477e : 0x1a3462); P.px(x, L + 2, 0x16305a); P.px(x, L + 3, 0x1a3040); }
  // akterdäcket: bänkar längs relingen med folk, flaggstången i aktern
  const folk = (x, y, k, glass) => {
    const [hair, skin, shirt] = TOUR_FOLK[k % TOUR_FOLK.length], g = (c) => (glass ? mix(c, 0x9ab8cc, 0.4) : c);
    P.px(x, y, g(hair)); P.px(x, y + 1, g(skin)); P.px(x - 1, y + 2, g(shirt)); P.px(x, y + 2, g(mul(shirt, 0.8)));
  };
  for (const bx of [2, W - 4]) for (let y = 3; y < 9; y++) { P.px(bx, y, 0x6a4a2a); P.px(bx + 1, y, 0x805a34); }
  folk(3, 3, 0, false); folk(3, 6, 1, false); folk(W - 3, 4, 2, false);
  P.px(11, 1, 0x8a8e96); P.px(11, 2, 0x6a6e76);                                                // flaggstången
  // salongen: glastak med spröjsar och nock, passagerarna under glaset, solreflexer
  for (let y = S0; y < S1; y++) for (let x = 3; x < W - 3; x++) {
    let c;
    if (x === 3 || y === S0) c = 0xf4f6f6;
    else if (x === W - 4) c = 0xc0c6cc;
    else if ((y - S0) % 5 === 0) c = x < 11 ? 0xdce4ea : 0xb8c4ce;                               // spröjsarna
    else if (x === 10) c = 0xe4ecf2; else if (x === 11) c = 0xb4c4d0;                           // nocken
    else {
      c = x < 10 ? mix(0xa8c4d6, 0x94b4ca, (x - 4) / 6) : mix(0x7e9eb8, 0x6a8aa6, (x - 12) / 6);
      if (x < 10 && (x + y) % 9 === 0 && ((y - S0) / 5 | 0) % 2 === 0) c = 0xf0f8ff;           // solreflexer i glaset
    }
    P.px(x, y, c);
  }
  for (let bay = 0; bay < 6; bay++) {                                                          // två säten per sida och fack
    const y = S0 + 1 + bay * 5;
    if (bay % 3 !== 1) folk(5, y, bay, true);
    folk(8, y + 1, bay + 2, true);
    folk(14, y, bay + 4, true);
    if (bay % 2 === 0) folk(17, y + 1, bay + 1, true);
  }
  // salongens södra vägg (styrhytten längst fram): vit list, fönsterbandet, skuggan på fördäcket
  for (let x = 3; x < W - 3; x++) {
    P.px(x, S1, 0xeef0f0);
    P.px(x, S1 + 1, (x - 3) % 3 === 2 ? 0xe4e8ea : x === 5 || x === 6 ? 0x8ab0cc : 0x24364e);
    P.px(x, S1 + 2, x === W - 4 ? 0xb4b8bc : 0xd4d8da);
    if (inside(x, S1 + 3)) P.px(x, S1 + 3, mul(P.get(x, S1 + 3), 0.7));
  }
  for (let y = S0 + 1; y < S1 + 3; y++) if (inside(W - 3, y)) P.px(W - 3, y, mul(P.get(W - 3, y), 0.8));   // skuggan österut
  // fördäcket: trossen i en rulle och en livboj
  P.px(10, 45, 0xc8b088); P.px(11, 45, 0xa89068); P.px(10, 46, 0xa89068); P.px(11, 46, 0x7a6448);
  P.px(7, 44, 0xe0501e); P.px(8, 44, 0xf4f0e8); P.px(7, 45, 0xf4f0e8); P.px(8, 45, 0xe0501e);
}
// Kajak (fören norrut), 7 × 17: gult skrov med mörk kant, sittbrunnen med paddlaren (hår, ansikte,
// röd flytväst); paddeln ritas för sig och rör sig (se boatItems)
function paintKayak(P) {
  const HW = [0, 1, 1, 2, 2, 3, 3, 3, 3, 3, 3, 2, 2, 2, 1, 1, 0];                             // halva bredden per rad
  for (let y = 0; y < HW.length; y++) for (let x = 3 - HW[y]; x <= 3 + HW[y]; x++) {
    let c = x === 3 - HW[y] ? 0xf8e070 : x === 3 + HW[y] ? 0xb88a18 : x === 3 ? 0xfff0a0 : 0xf0c830;
    if (y === 0 || y === HW.length - 1) c = 0xd8a820;
    P.px(x, y, c);
  }
  for (let y = 6; y < 11; y++) for (let x = 1; x < 6; x++) P.px(x, y, x === 1 || x === 5 || y === 6 || y === 10 ? 0x2a2a2e : 0x3a3a40); // sittbrunnens sarg
  P.px(3, 6, 0x3b2619); P.px(2, 7, 0x3b2619); P.px(3, 7, 0xe0a97f); P.px(4, 7, 0x3b2619);     // huvudet
  P.hl(2, 8, 3, 0xd83a2a); P.px(2, 8, 0xe85a4a); P.hl(2, 9, 3, 0xb82a1e);                      // flytvästen
  P.px(3, 12, 0x2a2a2e); P.px(3, 13, 0x6a6e76);                                                  // däckslinan
}
function shadowOf(img) {
  const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
  const g = c.getContext('2d'); g.drawImage(img, 0, 0); g.globalCompositeOperation = 'source-in'; g.fillStyle = '#081420'; g.fillRect(0, 0, c.width, c.height);
  return c;
}
let BOATS_SPR = null;
function boatSprites() {
  if (BOATS_SPR) return BOATS_SPR;
  const S = { barge: spr(26, 62, paintBarge), tug: spr(18, 29, paintTug), motor: spr(12, 26, paintMotorboat), tour: spr(22, 52, paintTourBoat), kayak: spr(7, 17, paintKayak) };
  for (const k of Object.keys(S)) S[k + 'Sh'] = shadowOf(S[k]);
  BOATS_SPR = S;
  return S;
}
// Båttyper: fart (px/s), riktning (1 = söderut, −1 = norrut), fil (x = mitten), längd, bredd
const BOAT_KINDS = {
  pram: { dir: 1, speed: 7, x: 2702, len: 88, wid: 26, wake: 0.5, lights: [[12, 9]] },
  motor: { dir: -1, speed: 30, x: 2776, len: 26, wid: 12, wake: 1, lights: [[6, 12]] },
  tur: { dir: 1, speed: 12, x: 2494, len: 52, wid: 22, wake: 0.7, lights: [[11, 1]] },
  kajak: { dir: -1, speed: 9, x: 2934, len: 17, wid: 7, wake: 0.15, lights: [], day: true },    // bara dagtid, inga lanternor
};
function boatParts(kind) {
  const S = boatSprites();
  if (kind === 'pram') return [{ img: S.barge, sh: S.bargeSh, dx: 0, dy: 26 }, { img: S.tug, sh: S.tugSh, dx: 4, dy: 0 }];
  if (kind === 'motor') return [{ img: S.motor, sh: S.motorSh, dx: 0, dy: 0 }];
  if (kind === 'kajak') return [{ img: S.kayak, sh: S.kayakSh, dx: 0, dy: 0 }];
  return [{ img: S.tour, sh: S.tourSh, dx: 0, dy: 0 }];
}

// Fiskmåsarna (samma form som livets förbiflygande måsar)
const GULL_FLY = { pal: { G: 0xb8c0cc, W: 0xf4f4f0, k: 0x22222a, y: 0xe8c040 }, fr: [
  ['k.........k', '.GG.....GG.', '...GWWWG...', '.....W.....'],
  ['...........', 'kGGGWWWGGGk', '....WWW....', '.....y.....'],
  ['...........', '...GWWWG...', '.GG..W..GG.', 'k.........k'],
] };
const GULL_SIT = { pal: { h: 0xffffff, H: 0xebebe5, B: 0xcfd0cc, G: 0xa9b3c1, g: 0x87929f, x: 0x24242c, e: 0x2a2226, y: 0xecc23a, r: 0xd84a3a, f: 0xe2a676, W: 0xf6f6f2 }, fr: [
  ['...hH..', '..hHeyy', '..HHHr.', 'GGGHHB.', 'xGgGWB.', '.BBBB..', '..f.f..'],
  ['..Hh...', 'yyeHh..', '.rHHH..', '.BHHGGG', '.BWGgGx', '..BBBB.', '..f.f..'],
] };
function mapSprite(map, pal) {
  const w = Math.max(...map.map((r) => r.length));
  return spr(w, map.length, (P) => map.forEach((row, j) => [...row].forEach((ch, i) => { if (pal[ch] !== undefined) P.px(i, j, pal[ch]); })));
}
let GULL_SPR = null;
function gullSprites() {
  if (GULL_SPR) return GULL_SPR;
  GULL_SPR = { fly: GULL_FLY.fr.map((m) => mapSprite(m, GULL_FLY.pal)), sit: GULL_SIT.fr.map((m) => mapSprite(m, GULL_SIT.pal)) };
  return GULL_SPR;
}

// ---------------------------------------------------------------------
// ISEN PÅ FLODEN. weather.js lägger kanalens isbild över allt vatten när kanalen fryser – på
// den breda floden syns dess skarvar. Ovanpå den läggs här en egen isyta: snötäckt (vindräfflor,
// blanka fläckar, drivor längs kajmurarna) eller blank (luftbubblor, snödamm, svartis),
// sprickor, skruvis runt stävarna, skridskospår och brornas skuggor. Ritas som remsor i
// y-ordningen (nyckeln = remsans nederkant, alltid före det som står i vattnet ovanför).
// ---------------------------------------------------------------------
const ICE_REGIONS = [[0, N_RAIL], [S_RAIL + GIRD, IN_RAIL], [IS_RAIL + IGIRD, H]];
const ICE = {};
function iceArt(snowy) {
  if (ICE[snowy]) return ICE[snowy];
  const P = new Pix(RW, H, RX0, 0);
  // det som står i vattnet och ritas före isremsorna (tornfötter, förankringar, trappor, pelarstävar)
  const masks = [
    ...TOWERS.map((t) => [t.x0 - 4, S_RAIL, t.x1 + 4, t.base + 11]),
    [SB.x0, S_RAIL, SB.x0 + 24, S_RAIL + 24], [SB.x1 - 24, S_RAIL, SB.x1, S_RAIL + 24],
    ...PIERS.map((p) => [p - 8, IS_RAIL + IGIRD, p + 8, IS_RAIL + IGIRD + 17]),
    ...STEPS.map(([wx, sy, s]) => (s === 'w' ? [wx, sy, wx + 10, sy + 14] : [wx - 10, sy, wx, sy + 14])),
  ];
  // skruvis: ringar runt stävarna
  const ridges = [
    ...TOWERS.map((t) => ({ r: [t.x0 - 3, t.base, t.x1 + 3, t.base + 10], nose: 's' })),
    ...PIERS.flatMap((p) => [{ r: [p - 7, IN_RAIL - 16, p + 7, IN_RAIL], nose: 'n' }, { r: [p - 7, IS_RAIL + IGIRD, p + 7, IS_RAIL + IGIRD + 16], nose: 's' }]),
  ];
  const ridgeD = (x, y) => {
    let d = 99;
    for (const { r } of ridges) { const dx = Math.max(r[0] - x, 0, x - r[2] + 1), dy = Math.max(r[1] - y, 0, y - r[3] + 1); d = Math.min(d, Math.max(dx, dy)); }
    return d;
  };
  for (const [ya, yb] of ICE_REGIONS) for (let y = ya; y < yb; y++) for (let x = WX0 + 2; x < WX1 - 2; x++) {
    if (masks.some((m) => inR(x, y, m))) continue;
    const wall = Math.min(x - WX0, WX1 - 1 - x);
    let c;
    if (snowy) {
      const rip = vnoise(x * 0.22, y * 1.4, 5, 2400) * 0.7 + vnoise(x * 0.08, y * 0.5, 9, 2401) * 0.3;   // vindräfflor
      c = mix(0xf2f6fa, 0xdae4ee, clamp01((rip - 0.35) * 1.6));
      if (rip > 0.62 && hash(x, y, 2404) > 0.4) c = mix(c, 0xc4d2e0, 0.5);                         // räfflornas skuggsida
      // blankis där vinden sopat bort snön: långsmala stråk i vindens riktning (öst–väst),
      // samlade i några fält, med en tunn kant av snödamm
      const bare = (vnoise(x * 0.28, y * 1.3, 9, 2402) * 0.8 + vnoise(x, y, 4, 2403) * 0.2) * (0.55 + 0.6 * vnoise(x, y, 110, 2405));
      if (bare > 0.6) {
        const k = clamp01((bare - 0.6) * 9);
        c = mix(c, mix(0xb2c8d8, 0x8eaabe, vnoise(x * 0.5, y * 2, 6, 2406)), k < 0.34 ? 0.35 : k < 0.67 ? 0.7 : 1);
        if (k >= 1 && hash(x, y >> 1, 2407) > 0.9) c = mix(c, 0xe4eef6, 0.6);                    // strimmor av snödamm på blankisen
      }
      if (wall < 7) c = mix(c, 0xffffff, (7 - wall) / 9);                                           // drivor längs kajmurarna
      if (wall === 7 && x < (WX0 + WX1) / 2) c = mix(c, 0xb8c8d8, 0.5);                            // drivans skuggkant
      if (hash(x, y, 2408) > 0.992) c = 0xffffff;                                                  // glitter
    } else {
      c = mix(0x9cbccc, 0x7898ae, vnoise(x, y, 40, 2404) * 0.7 + vnoise(x, y, 9, 2405) * 0.3);
      const dust = vnoise(x * 0.4, y * 1.2, 7, 2406);
      if (dust > 0.62) c = mix(c, 0xe4eef4, clamp01((dust - 0.62) * 3));                            // snödamm
      if (vnoise(x, y, 26, 2407) < 0.26) c = mix(c, 0x4e6e84, 0.45);                                // svartis
      if (hash(x, y, 2408) > 0.985) c = mix(c, 0xeaf4fa, 0.7);                                      // luftbubblor
      if (wall < 4) c = mix(c, 0xe8f0f6, (4 - wall) / 5);
    }
    // skruvis runt stävarna
    const rd = ridgeD(x, y);
    if (rd < 5) { const h = hash(x >> 1, y >> 1, 2409); c = h > 0.6 ? 0xffffff : h > 0.3 ? 0xc8d8e4 : 0x8aa6ba; if (rd === 0) c = mul(c, 0.9); }
    // brornas skuggor (solen i sydväst): norr om däcken och under balkarna
    if ((y >= N_RAIL - 11 && y < N_RAIL) || (y >= IN_RAIL - 9 && y < IN_RAIL)) { const u = y < N_RAIL ? (y - N_RAIL + 11) / 11 : (y - IN_RAIL + 9) / 9; if (bayer(x, y) < u * 0.9 + 0.1) c = mul(c, 0.78); }
    if ((y >= S_RAIL + GIRD && y < S_RAIL + GIRD + 5) || (y >= IS_RAIL + IGIRD && y < IS_RAIL + IGIRD + 4)) c = mul(c, 0.84);
    // i mynningen tar kanalens is (weather.js) över
    const a = y > 778 ? 1 - smooth(778, 812, y) : 1;
    P.px(x, y, c, a);
  }
  // sprickor: slumpvandringar
  for (let i = 0; i < 26; i++) {
    const reg = ICE_REGIONS[i % 3];
    let x = WX0 + 12 + hash(i, 1, 2410) * (WX1 - WX0 - 24), y = reg[0] + 4 + hash(i, 2, 2410) * (reg[1] - reg[0] - 8), ang = hash(i, 3, 2410) * 6.28;
    const len = 20 + hash(i, 4, 2410) * 70;
    for (let k = 0; k < len; k++) {
      ang += (hash(i, k, 2411) - 0.5) * 0.9;
      x += Math.cos(ang); y += Math.sin(ang) * 0.6;
      const px = Math.round(x), py = Math.round(y);
      if (py < reg[0] || py >= reg[1] || px < WX0 + 3 || px >= WX1 - 3 || masks.some((m) => inR(px, py, m))) break;
      P.px(px, py, snowy ? 0xa6bccc : 0x4a6a80, snowy ? 0.7 : 0.9);
      if (!snowy) P.px(px, py + 1, 0xe8f2f8, 0.6);
      if (hash(i, k, 2412) > 0.93) { const b = ang + (hash(i, k, 2413) > 0.5 ? 1 : -1); for (let j = 1; j < 7; j++) P.px(Math.round(px + Math.cos(b) * j), Math.round(py + Math.sin(b) * j * 0.6), snowy ? 0xb4c6d4 : 0x5a7a90, 0.7); }
    }
  }
  // skridskospår: långa slingor mellan broarna
  const [my0, my1] = ICE_REGIONS[1];
  for (let s = 0; s < 4; s++) {
    const cx = WX0 + 110 + s * 120 + hash(s, 1, 2420) * 40, cy = my0 + 90 + hash(s, 2, 2420) * (my1 - my0 - 180), rx = 50 + hash(s, 3, 2420) * 70, ry = 26 + hash(s, 4, 2420) * 40;
    for (let a = 0; a < 6.28; a += 0.004) {
      for (const off of [0, 2 + s % 2]) {
        const x = Math.round(cx + Math.cos(a) * (rx + off * 0.3) + Math.sin(a * 3 + s) * 6), y = Math.round(cy + Math.sin(a) * ry + off);
        if (masks.some((m) => inR(x, y, m)) || x < WX0 + 3 || x >= WX1 - 3) continue;
        P.px(x, y, snowy ? 0xc2d0dc : 0xe4eef4, 0.8);
      }
    }
  }
  ICE[snowy] = P.flush();
  return ICE[snowy];
}
// Skridskoåkare på isen mellan broarna (dagtid)
const SKATER_LOOKS = [
  { skin: '#e0a97f', hair: '#3b2619', style: 'short', top: 'jacket', shirt: '#c9323a', accent: '#f4f1ea', bottom: 'pants', pants: '#2d3a5c', hat: 'beanie', cap: '#3a7bd5', shoes: '#f2f2f2' },
  { kid: true, skin: '#f0c8a0', hair: '#d8a040', style: 'long', top: 'hoodie', shirt: '#e86ab0', accent: '#ffffff', bottom: 'pants', pants: '#3a3f4c', hat: 'beanie', cap: '#f0c830', shoes: '#f2f2f2' },
  { skin: '#8a5a3a', hair: '#1c1c1c', style: 'short', top: 'sweater', shirt: '#2f8a5a', accent: '#e8e4dc', bottom: 'pants', pants: '#2b2b30', hat: 'beanie', cap: '#c9323a', shoes: '#1c1c1c' },
  { skin: '#eabf98', hair: '#a0522d', style: 'long', top: 'jacket', shirt: '#3a7bd5', accent: '#f4f1ea', bottom: 'pants', pants: '#1f2330', hat: null, shoes: '#f2f2f2' },
];

// Delat levande läge (riverLive läser båtarna för kölvattnet)
const LIVE = { boats: [], frozen: false };

// ---------------------------------------------------------------------
// riverLive: strömmen, glittret, skummet vid pelarna, kölvattnet och regnringar
// ---------------------------------------------------------------------
export function riverLive(ctx, env, view) {
  if (!RIVER) return;
  const w = env.weather;
  if (frozenNow(w)) return;                                                   // isen (weather.js) ligger på
  const vx0 = view.x, vx1 = view.x + view.w, vy0 = view.y, vy1 = view.y + view.h;
  if (vx1 < WX0 || vx0 > WX1) return;
  const t = env.t || 0, night = !!env.night, day = (env.dark || 0) < 0.25;
  ctx.save();
  // tornens skuggor på vattnet (följer solen – se towerShadowArt)
  drawTowerShadow(ctx, 0, sunShade(env), vy0, vy1, vx0, vx1);
  for (const r of CLIPS) {
    const x0 = Math.max(r[0], vx0), x1 = Math.min(r[2], vx1), y0 = Math.max(r[1], vy0), y1 = Math.min(r[3], vy1);
    if (x1 <= x0 || y1 <= y0) continue;
    // vågkammar som driver med strömmen (söderut) och vaggar
    ctx.fillStyle = night ? 'rgba(130,160,200,0.26)' : 'rgba(214,236,248,0.42)';
    const H0 = r[3] - r[1], n = Math.round(((r[2] - r[0]) * H0) / 700);
    for (let i = 0; i < n; i++) {
      const bx = r[0] + Math.floor(hash(i, 1, 2100 + r[1]) * (r[2] - r[0]));
      if (bx < x0 - 6 || bx >= x1) continue;
      const sp = 5 + hash(i, 2, 2100) * 5, y = r[1] + ((hash(i, 3, 2100 + r[1]) * H0 + t * sp) % H0);
      if (y < y0 || y >= y1) continue;
      const l = Math.max(1, Math.round((2 + Math.floor(hash(i, 4, 2100) * 4)) * (0.55 + 0.45 * Math.sin(t * 1.3 + i * 1.7))));
      ctx.fillRect(Math.round(bx + Math.sin(t * 0.7 + i) * 1.5), Math.floor(y), l, 1);
    }
    // solglitter (dag) / månglitter (natt)
    const cyc = Math.floor(t * 5), ng = Math.round(((x1 - x0) * (y1 - y0)) / (day ? 1400 : 3000));
    for (let i = 0; i < ng; i++) {
      if (hash(i, cyc, 2110) < 0.5) continue;
      const x = x0 + Math.floor(hash(i, cyc, 2111) * (x1 - x0)), y = y0 + Math.floor(hash(i, cyc, 2112) * (y1 - y0));
      ctx.fillStyle = day ? (hash(i, cyc, 2113) > 0.5 ? '#ffffff' : '#fff6c8') : 'rgba(200,215,255,0.6)';
      ctx.fillRect(x, y, 1, 1);
      if (day && hash(i, cyc, 2114) > 0.8) { ctx.fillRect(x - 1, y, 1, 1); ctx.fillRect(x + 1, y, 1, 1); }
    }
  }
  // skummet runt tornfötterna och bropelarna (flimrar)
  ctx.fillStyle = night ? 'rgba(190,210,230,0.45)' : 'rgba(236,246,250,0.7)';
  const foam = (cx, y0, hw, len, seed) => {
    if (cx + hw + len < vx0 || cx - hw - len > vx1 || y0 + len < vy0 || y0 > vy1) return;
    const c = Math.floor(t * 6);
    for (let k = 0; k < len; k++) for (const s of [-1, 1]) {
      if (hash(k, c + s * 7, seed) > 0.55 - (k / len) * 0.3) continue;
      const x = Math.round(cx + s * (hw + k * 0.45 + hash(k, c, seed + 1) * 1.5)), y = y0 + k;
      if (inClip(x, y)) ctx.fillRect(x, y, 1, 1);
    }
  };
  for (const tw of TOWERS) foam(tw.cx, tw.base + 6, (tw.x1 - tw.x0) / 2 - 2, 26, 2120 + tw.i);
  for (const px of PIERS) foam(px, IS_RAIL + IGIRD + 12, 3, 20, 2124 + px);
  // kölvatten bakom båtarna och bogvågen
  for (const b of LIVE.boats) {
    if (!b.on) continue;
    const K = BOAT_KINDS[b.kind], sternY = K.dir > 0 ? b.y : b.y + K.len, cx = K.x;
    if (cx + 60 < vx0 || cx - 60 > vx1) continue;
    const L = Math.round(40 + 40 * K.wake), c = Math.floor(t * 8);
    for (let d = 0; d < L; d++) {
      const y = Math.round(sternY - K.dir * d), a = (1 - d / L) * (night ? 0.4 : 0.65);
      if (y < vy0 - 2 || y > vy1 + 2) continue;
      const spread = K.wid / 2 + d * (0.35 + 0.15 * K.wake);
      for (const s of [-1, 1]) {
        const x = Math.round(cx + s * spread + Math.sin(d * 0.5 + t * 3) * 0.6);
        if (inClip(x, y) && hash(d, c + s, 2130) > 0.25) { ctx.fillStyle = rgba(0xeef6fa, a); ctx.fillRect(x, y, 1, 1); }
      }
      if (d < 22 * (0.5 + K.wake)) {                                                    // propellerns virvlar
        const x = Math.round(cx + (hash(d, c, 2131) - 0.5) * K.wid * 0.6);
        if (inClip(x, y) && hash(d, c, 2132) > 0.45) { ctx.fillStyle = rgba(0xeef6fa, a * 0.8); ctx.fillRect(x, y, 1 + (hash(d, c, 2133) > 0.7 ? 1 : 0), 1); }
      }
    }
    const bowY = K.dir > 0 ? b.y + K.len : b.y;
    for (let k = 0; k < 6; k++) for (const s of [-1, 1]) {
      const x = Math.round(cx + s * (K.wid / 2 + k * 0.8)), y = Math.round(bowY - K.dir * (k * 1.2 - 1));
      if (inClip(x, y) && hash(k, Math.floor(t * 7) + s, 2134) > 0.3) { ctx.fillStyle = rgba(0xf4fafc, 0.7 - k * 0.1); ctx.fillRect(x, y, 1, 1); }
    }
  }
  // regnringar på floden
  if (w && w.kind === 'regn') {
    const cnt = Math.round(40 * (w.intensity ?? 0.6)), s = Math.floor(t * 4), f = (t * 4) % 1, r = 1 + Math.floor(f * 3);
    ctx.fillStyle = `rgba(214,228,246,${(0.55 * (1 - f)).toFixed(3)})`;
    for (let j = 0; j < cnt; j++) {
      const x = Math.floor(vx0 + hash(j, s, 2140) * (vx1 - vx0)), y = Math.floor(vy0 + hash(j, s, 2141) * (vy1 - vy0));
      if (!inClip(x - r, y) || !inClip(x + r, y + 1)) continue;
      ctx.fillRect(x - r, y, 1, 1); ctx.fillRect(x + r, y, 1, 1); ctx.fillRect(x, y - 1, 1, 1); ctx.fillRect(x, y + 1, 1, 1);
    }
  }
  ctx.restore();
}

// ---------------------------------------------------------------------
// Glödsprites (kvantiserad, dithrad alfa – samma stil som rekvisitans lyktor)
// ---------------------------------------------------------------------
function glowSpr(rx, ry, c, amax, steps = 20) {
  const w = rx * 2 + 1, h = ry * 2 + 1;
  return spr(w, h, (P) => {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const t = Math.hypot((x - rx) / rx, (y - ry) / ry);
      if (t >= 1) continue;
      const q = Math.floor(amax * Math.pow(1 - t, 1.6) * steps + bayer(x, y)) / steps;
      if (q > 0) P.px(x, y, c, q);
    }
  });
}
let GLOW = null;
function glows() {
  if (GLOW) return GLOW;
  GLOW = {
    halo: glowSpr(11, 10, 0xffe0a8, 0.55), pool: glowSpr(16, 5, 0xffcc88, 0.35), core: glowSpr(3, 3, 0xfff4d8, 0.9),
    red: glowSpr(4, 4, 0xff4030, 0.8), navR: glowSpr(3, 3, 0xff4a3a, 0.8), navG: glowSpr(3, 3, 0x40ff80, 0.8), navW: glowSpr(3, 3, 0xfff4d8, 0.9),
    spot: glowSpr(9, 16, 0xffd8a0, 0.35), vault: glowSpr(9, 11, 0xffcc88, 0.42),
  };
  return GLOW;
}

// ---------------------------------------------------------------------
// createBridge – lagren, båtarna, måsarna, flaggorna och kvällsljuset
// ---------------------------------------------------------------------
export function createBridge(env) {
  if (!RIVER) return { items: () => [], obstacles: [], update() {}, glow() {} };
  let t = 0;
  const snowNow = () => ((env.weather?.snowCover || 0) > 0.5 ? 1 : 0);
  // båtarna: en av varje sort, med paus mellan turerna
  const boats = Object.keys(BOAT_KINDS).map((kind, i) => ({ kind, y: 0, on: false, wait: 4 + i * 23 + hash(i, 1, 2200) * 10, trip: 0 }));
  LIVE.boats = boats;
  const startBoat = (b) => { const K = BOAT_KINDS[b.kind]; b.on = true; b.trip++; b.y = K.dir > 0 ? -K.len - 30 : H + 30; };
  startBoat(boats[0]); boats[0].y = 360;                                      // pråmen syns direkt mellan broarna
  // måsarna: några cirklar över vattnet, två följer pråmen, några sitter på tornen
  const gulls = [];
  for (let i = 0; i < 6; i++) gulls.push({ cx: WX0 + 60 + hash(i, 1, 2210) * (WX1 - WX0 - 120), cy: 60 + hash(i, 2, 2210) * 540, rx: 30 + hash(i, 3, 2210) * 60, ry: 14 + hash(i, 4, 2210) * 26, sp: (0.25 + hash(i, 5, 2210) * 0.3) * (i % 2 ? 1 : -1), ph: hash(i, 6, 2210) * 6.3, follow: i < 2 ? 0 : -1 });
  const perched = [];
  for (const tw of TOWERS) for (let k = 0; k < (tw.i ? 2 : 3); k++) perched.push({ x: tw.x0 + 4 + Math.floor(hash(k, tw.i, 2220) * (tw.x1 - tw.x0 - 12)), y: TOP + 4 + (k % 2), f: hash(k, tw.i, 2221) > 0.5 ? 1 : 0, ph: hash(k, tw.i, 2222) * 9, key: tw.base + 0.6 });

  const boatItems = (out) => {
    if (LIVE.frozen) return;
    for (const b of boats) {
      if (!b.on) continue;
      const K = BOAT_KINDS[b.kind], parts = boatParts(b.kind), top = b.y, bot = b.y + K.len + 4;
      for (const r of CLIPS) {
        if (bot <= r[1] || top >= r[3]) continue;
        out.push({ x: K.x, y: clamp(bot, r[1], r[3] - 1), draw: (ctx) => {
          ctx.save(); ctx.beginPath(); ctx.rect(r[0], r[1], r[2] - r[0], r[3] - r[1]); ctx.clip();
          const bx = K.x - (K.wid >> 1), by = Math.round(b.y);
          ctx.globalAlpha = 0.3;
          for (const p of parts) ctx.drawImage(p.sh, bx + p.dx + 2, by + p.dy - 1);  // skuggan (solen i sydväst)
          ctx.globalAlpha = 1;
          for (const p of parts) ctx.drawImage(p.img, bx + p.dx, by + p.dy);
          if (b.kind === 'kajak') {                                                    // paddeln: skaftet lutar, bladet i vattnet stänker
            const s = Math.sin(t * 2.6 + b.trip), tilt = Math.round(s * 2), cx = K.x, cy = by + 8;
            ctx.fillStyle = '#3a3a40';
            for (let i = -5; i <= 5; i++) ctx.fillRect(cx + i, cy - Math.round((tilt * i) / 5), 1, 1);
            ctx.fillStyle = '#c83a2a'; ctx.fillRect(cx - 7, cy + tilt - 1, 2, 3); ctx.fillRect(cx + 6, cy - tilt - 1, 2, 3);
            if (Math.abs(s) > 0.55) { ctx.fillStyle = 'rgba(240,248,252,0.8)'; const wx = s > 0 ? cx - 8 : cx + 8, wy = cy + Math.abs(tilt) + 1; ctx.fillRect(wx, wy, 1, 1); ctx.fillRect(wx + (s > 0 ? 2 : -2), wy + 1, 1, 1); }
          }
          if (b.kind === 'pram') for (let k = 0; k < 5; k++) {                        // röken ur skorstenen
            const ph = (t * 0.6 + k * 0.2) % 1, sx = bx + 13 + Math.round(ph * 8 + Math.sin(t + k)), sy = by + 4 - Math.round(ph * 14);
            ctx.fillStyle = rgba(0x6a6a70, 0.45 * (1 - ph)); ctx.fillRect(sx, sy, 2 + Math.round(ph * 2), 2);
          }
          ctx.restore();
        } });
      }
    }
  };
  const gullItems = (out) => {
    const S = gullSprites();
    for (const p of perched) {
      const f = Math.floor((t + p.ph) / 2.4) % 5 === 0 ? 1 - p.f : p.f;
      out.push({ x: p.x, y: p.key, draw: (ctx) => ctx.drawImage(S.sit[f], p.x - 3, p.y - 6) });
    }
    if (env.night) return;                                                     // natt: måsarna sover på tornen
    gulls.forEach((g, i) => {
      const a = t * g.sp + g.ph;
      let cx = g.cx, cy = g.cy;
      const fb = g.follow >= 0 ? boats[g.follow] : null;
      if (fb && fb.on && !LIVE.frozen) { cx = BOAT_KINDS[fb.kind].x; cy = fb.y + 10; }
      const x = Math.round(cx + Math.cos(a) * g.rx), y = Math.round(cy + Math.sin(a) * g.ry * 0.6 - 30);
      const fr = Math.sin(t * 1.1 + i) > 0.3 ? 1 : [0, 1, 2, 1][Math.floor(t * 5 + i) % 4];
      out.push({ x, y: 1e5 + 20 + i, draw: (ctx) => ctx.drawImage(S.fly[fr], x - 5, y - 2) });
    });
  };
  const flagItems = (out) => {
    const wind = env.weather?.windNow ?? env.weather?.wind ?? 6, dir = wind >= 0 ? 1 : -1, strong = Math.min(1, Math.abs(wind) / 30);
    for (const tw of TOWERS) out.push({ x: tw.cx, y: tw.base + 0.5, draw: (ctx) => {
      const px = tw.cx, top = TOP - 16;
      ctx.fillStyle = '#5a5e66'; ctx.fillRect(px, top, 1, 16);
      ctx.fillStyle = '#9aa0a8'; ctx.fillRect(px - 1, top + 12, 1, 4);
      ctx.fillStyle = '#e0c048'; ctx.fillRect(px, top - 1, 1, 1);
      // svenska flaggan som vajar (tre bildrutor, fortare i blåst)
      const fr = Math.floor(t * (4 + strong * 6)) % 3;
      for (let i = 0; i < 10; i++) {
        const wave = Math.round(Math.sin(i * 0.9 - fr * 2.1) * (0.5 + strong * 0.7) * (i / 10));
        for (let j = 0; j < 6; j++) {
          const cross = i === 3 || i === 4 || j === 2 || j === 3;
          ctx.fillStyle = cross ? (j === 2 && i > 4 ? '#f8d850' : '#f0c830') : j === 0 ? '#3a6ac0' : '#2a5ab0';
          ctx.fillRect(px + 1 + dir * i - (dir < 0 ? 1 : 0), top + 1 + j + wave, 1, 1);
        }
      }
    } });
  };

  function items() {
    const snow = snowNow(), A = art(snow), out = [];
    out.push({ y: N_RAIL - 0.5, draw: (ctx) => ctx.drawImage(A.back, RX0, 0) });
    out.push({ y: S_RAIL + 0.1, draw: (ctx) => ctx.drawImage(A.front, RX0, 0) });
    for (const a of A.anchors) out.push({ x: a.cx, y: a.key, draw: (ctx) => ctx.drawImage(a.cv, a.x, a.y) });
    A.towers.forEach((T, i) => out.push({ x: TOWERS[i].cx, y: TOWERS[i].base, draw: (ctx) => ctx.drawImage(T.cv, T.ox, T.oy) }));
    if (A.iron) {
      out.push({ y: IN_RAIL - 0.5, draw: (ctx) => ctx.drawImage(A.iron.back, RX0, A.iron.by) });
      out.push({ y: IS_DECK + 0.5, draw: (ctx) => ctx.drawImage(A.iron.front, RX0, A.iron.fy) });
    }
    for (const q of QUAY_LAMPS) out.push({ x: q.x, y: q.y + 0.2, draw: (ctx) => ctx.drawImage(A.qlamp, q.x - 4, q.y - 31) });
    for (const s of A.stairs) out.push({ x: s.cx, y: s.key, draw: (ctx) => ctx.drawImage(s.cv, s.x, s.y) });
    if (LIVE.frozen) iceItems(out);
    flagItems(out);
    boatItems(out);
    gullItems(out);
    return out;
  }
  // isen som remsor (se iceArt) + skridskoåkarna
  function iceItems(out) {
    const img = iceArt((env.weather?.snowCover || 0) > 0.45 ? 1 : 0), sun = sunShade(env);
    for (const [ya, yb] of ICE_REGIONS) for (let y0 = ya; y0 < yb; y0 += 64) {
      const y1 = Math.min(yb, y0 + 64);
      out.push({ y: y1 - 0.6, draw: (ctx) => {
        ctx.drawImage(img, 0, y0, RW, y1 - y0, RX0, y0, RW, y1 - y0);
        if (y0 < N_RAIL) drawTowerShadow(ctx, 1, sun, y0, y1);                                     // tornens skuggor på isen
      } });
    }
    if (!drawPerson || env.night || (env.hour ?? 12) < 8 || (env.hour ?? 12) > 18) return;
    const [my0, my1] = ICE_REGIONS[1];
    SKATER_LOOKS.forEach((L, i) => {
      const cx = WX0 + 150 + i * 105, cy = my0 + 110 + ((i * 53) % 120), rx = 46 + i * 9, ry = 22 + (i % 2) * 14, sp = (0.22 + i * 0.04) * (i % 2 ? -1 : 1);
      const a = t * sp + i * 1.7, x = Math.round(cx + Math.cos(a) * rx), y = Math.round(cy + Math.sin(a) * ry);
      const vx = -Math.sin(a) * rx * sp, vy = Math.cos(a) * ry * sp;
      const dir = Math.abs(vx) > Math.abs(vy) * 1.4 ? (vx > 0 ? 'right' : 'left') : vy > 0 ? 'down' : 'up';
      const fr = [1, 3, 2, 3][Math.floor(t * 2.6 + i) % 4];
      out.push({ x, y: 1e5 + i, draw: (ctx) => drawPerson(ctx, x, y, L, dir, fr) });                 // ≥ 1e5: sållas aldrig på y
    });
  }

  function update(dt) {
    dt = Math.min(0.25, dt || 0);
    t += dt;
    LIVE.frozen = frozenNow(env.weather);
    if (LIVE.frozen) return;                                                  // isen: båtarna ligger i vinterhamnen
    for (const b of boats) {
      const K = BOAT_KINDS[b.kind];
      if (!b.on) {
        b.wait -= dt;
        const dark = env.night || (env.dark || 0) > 0.15;
        if (b.wait <= 0 && !(K.day && dark)) startBoat(b);                         // kajaken paddlar bara när det är ljust
        continue;
      }
      b.y += K.dir * K.speed * dt;
      if ((K.dir > 0 && b.y > H + 20) || (K.dir < 0 && b.y < -K.len - 20)) { b.on = false; b.wait = 18 + hash(b.trip, 3, 2201) * 50; }
    }
  }

  function glow(ctx, view) {
    const k = clamp(((env.dark || 0) - 0.1) / 0.3, 0, 1);
    if (k <= 0) return;
    if (view && (view.x > RX1 + 20 || view.x + view.w < RX0 - 20)) return;
    const G = glows(), A = art(snowNow()), tt = env.t || 0, frozen = frozenNow(env.weather);
    const vis = (x, y, m = 40) => !view || (x > view.x - m && x < view.x + view.w + m && y > view.y - m && y < view.y + view.h + m);
    const put = (img, x, y) => ctx.drawImage(img, Math.round(x - (img.width >> 1)), Math.round(y - (img.height >> 1)));
    const boatAt = (x, y) => !frozen && LIVE.boats.some((b) => { if (!b.on) return false; const K = BOAT_KINDS[b.kind]; return x >= K.x - K.wid / 2 - 1 && x < K.x + K.wid / 2 + 1 && y >= b.y - 2 && y < b.y + K.len + 4; });
    ctx.globalCompositeOperation = 'lighter';
    // tornens strålkastare: varmt ljus på granitfasaden (inte på plaketten) + speglingen i vattnet
    A.towers.forEach((T, i) => {
      const tw = TOWERS[i];
      if (!vis(tw.cx, 170, 190)) return;
      ctx.globalAlpha = k * 0.75; ctx.drawImage(T.light, T.ox, T.oy);
      ctx.globalAlpha = k * 0.6;
      for (const fx of [tw.x0 + 6, tw.x1 - 7]) put(G.spot, fx, WIN_B - 10);
      if (!frozen) for (let y = tw.base + 10; y < tw.base + 110; y++) {
        if (hash(y >> 1, Math.floor(tt * 3), 2300 + i) < 0.35) continue;
        const wob = Math.round(Math.sin(y * 0.7 + tt * 2.2) * 2), w = Math.round((tw.x1 - tw.x0) * (0.6 + 0.3 * hash(y, 2, 2301)));
        ctx.globalAlpha = k * 0.22 * (1 - (y - tw.base - 10) / 100);
        ctx.fillStyle = '#ffc880';
        for (let x = tw.cx - (w >> 1) + wob; x < tw.cx + (w >> 1) + wob; x += 1 + (hash(x, y, 2302) > 0.7 ? 1 : 0)) if (!boatAt(x, y)) ctx.fillRect(x, y, 1, 1);
      }
      if (Math.floor(tt * 1.2 + i * 0.5) % 2 === 0) { ctx.globalAlpha = k; put(G.red, tw.x0, TOP - 2); put(G.red, tw.x1 - 1, TOP - 2); }   // hinderljusen
      // valvlyktorna: en varm ljuspöl på promenadens plankor inne i passagen (klipps mot valvöppningarna)
      for (const [a, b] of towerWindows(tw)) for (const [ya, yb] of [[N_DECK, ROAD0 - 4], [ROAD1 + 2, S_DECK - 2]]) {
        ctx.save(); ctx.beginPath(); ctx.rect(a, ya, b - a, yb - ya); ctx.clip();
        ctx.globalAlpha = k * 0.75; put(G.vault, (a + b) / 2, (ya + yb) / 2 + 1);
        ctx.restore();
      }
    });
    // kabelljusen: små lampor längs bärkablarna ("pärlbandet")
    for (const [f, a0] of [[FN, 0.8], [FS, 1]]) for (let x = AW + 4; x < AE - 4; x += 9) {
      if (inTowerX(x, 2)) continue;
      const y = Math.round(f(x)) - 1;
      if (!vis(x, y, 4)) continue;
      ctx.globalAlpha = k * a0 * (0.75 + 0.25 * Math.sin(tt * 1.7 + x * 0.3));
      ctx.fillStyle = '#fff2c8'; ctx.fillRect(x, y, 1, 1);
      ctx.fillStyle = 'rgba(255,220,150,0.35)'; ctx.fillRect(x - 1, y, 3, 1); ctx.fillRect(x, y - 1, 1, 3);
    }
    // lyktorna: sken, ljuspöl på gångbanan och speglingen i vattnet
    const lamps = [
      ...BR_LAMPS.filter((l) => l.lx !== undefined).map((l) => ({ x: l.lx, y: l.ly, pool: l.side === 'n' ? N_DECK + 8 : S_DECK - 6, rx: l.side === 's' ? l.lx : null, ry: S_RAIL + GIRD + 2 })),
      ...PED_LAMPS.map((l) => ({ x: l.x, y: l.y, pool: l.side === 'n' ? N_DECK + 8 : S_DECK - 6, rx: l.side === 's' ? l.x + 4 : null, ry: S_RAIL + GIRD + 2 })),
      ...IRON_LAMPS.map((l) => ({ x: l.x, y: l.y, pool: l.side === 'n' ? IN_DECK + 7 : IS_DECK - 6, rx: l.side === 's' ? l.x : null, ry: IS_RAIL + IGIRD + 2 })),
      ...QUAY_LAMPS.map((q) => ({ x: q.x + 0.5, y: q.y - 27, pool: q.y + 2, rx: q.side === 'w' ? WX0 + 3 : WX1 - 4, ry: q.y + 2 })),
    ];
    for (const l of lamps) {
      if (!vis(l.x, l.y, 60)) continue;
      ctx.globalAlpha = k * 0.9; put(G.halo, l.x, l.y);
      ctx.globalAlpha = k * 0.8; put(G.pool, l.x, l.pool);
      if (frozen || l.rx === null) continue;
      ctx.fillStyle = '#ffd890';
      for (let d = 0; d < 34; d++) {
        if (hash(l.x | 0, (d + Math.floor(tt * 6)) >> 1, 2310) < 0.4) continue;
        const y = l.ry + d, x = Math.round(l.rx + Math.sin(tt * 2.1 + d * 0.6) * 1.3);
        if (!inClip(x, y) || boatAt(x, y)) continue;
        ctx.globalAlpha = k * 0.5 * (1 - d / 34);
        ctx.fillRect(x - (d < 10 ? 1 : 0), y, d < 10 ? 3 : 2, 1);
      }
    }
    // båtarnas lanternor och upplysta fönster
    if (!frozen) for (const b of LIVE.boats) {
      if (!b.on) continue;
      const K = BOAT_KINDS[b.kind], bx = K.x - (K.wid >> 1);
      if (K.day || !vis(K.x, b.y + K.len / 2, 80)) continue;                            // kajaken har inga lanternor
      const lit = (x, y, img, a = 1) => { if (inClip(x, y)) { ctx.globalAlpha = k * a; put(img, x, y); } };
      lit(bx + 1, b.y + K.len * 0.5, K.dir > 0 ? G.navG : G.navR, 0.9);
      lit(bx + K.wid - 2, b.y + K.len * 0.5, K.dir > 0 ? G.navR : G.navG, 0.9);
      for (const [lx, ly] of K.lights) lit(bx + lx, b.y + ly, G.navW, 1);
      if (b.kind === 'tur') for (let y = b.y + 12; y < b.y + 40; y += 5) { lit(bx + 6, y, G.core, 0.5); lit(bx + 15, y + 2, G.core, 0.5); }   // salongens lampor
    }
    ctx.globalCompositeOperation = 'source-over';
    // de tända lyktglasen (skarpa pixlar ovanpå)
    ctx.globalAlpha = k;
    ctx.fillStyle = '#fff6d8';
    for (const l of lamps) if (vis(l.x, l.y, 10)) ctx.fillRect(Math.round(l.x - 1.5), Math.round(l.y - 2), 4, 4);
    ctx.globalAlpha = 1;
  }

  return {
    items, obstacles: QUAY_OBSTACLES.map((r) => r.slice()), update, glow,
    // för förhandsbilder/test: var båtarna är, och lägg en båt på en viss höjd (y = fören/aktern överst)
    _debug: {
      boats: () => boats.map((b) => ({ kind: b.kind, y: Math.round(b.y), on: b.on })),
      place: (kind, y) => { const b = boats.find((q) => q.kind === kind); if (!b) return false; b.on = true; b.y = y; return true; },
    },
  };
}
