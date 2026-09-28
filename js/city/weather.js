// Vädret i Pixelstaden. Deterministiskt ur speldagen: samma dag och klockslag
// ger samma väder för alla spelare (ingen slump per klient). En årstid varar
// 7 speldagar (vår → sommar → höst → vinter → vår …) och vädret kan slå om
// två gånger per dygn (kl 11 och 17) med en mjuk övergång på ~45 minuter.
// Dagshändelsen 'regn' (ösregn) ger regn hela dagen (snöstorm på vintern).
//
// Kontrakt (se docs/STADEN.md):
//   createWeather(env) → { update(dt), drawBack(ctx, view), drawFront(ctx, view), glow(ctx, view) }
//     update sätter env.weather = { kind, intensity, wind, snowCover, wet, season, temp, dayIndex,
//                                  cloud, thunder, windNow, gust, flash, golden }
//     och env.rain (v1-fältet) = kind === 'regn'.
//     drawBack  – efter marken, före husen/folket: molnskuggor, snötäcke (nertrampat på
//                 trottoarerna, slask och hjulspår på vägarna, plogvallar), is på kanalen och
//                 dammen, pölar som krusas i regnet, solglitter på vatten/pölar/snö
//     drawFront – efter allt y-sorterat, före mörkret: årstidston, väderljus, regn i lager
//                 (snett i blåst, stänk, blixtar), snöfall (flingor i tre djup som virvlar),
//                 dimma (dithrade dis-lager som driver), blåst (vindstrimmor, löv, papper)
//     glow      – efter mörkret: snöfall/regn/dimma/blixtar som syns även i natten
//   env.forceWeather = { kind?, intensity?, snow?, season?, temp?, thunder?, wind?, wet?, flash? } tvingar vädret.
//   weatherAt(day, hour, eventId) – det rena vädret (för tester och andra moduler).
//   snowCoverAt(day, hour, eventId) – snötäcket 0–1 (växer medan det snöar, smälter i plusgrader).
//   weatherLabel(w) → '☀️ Sol, 18° · sommar'   weatherText(w) → 'Sol, 18° · sommar'
//   weatherIcon(w) → '☀️'   drawWeatherBadge(ctx, x, y, w) – liten pixelskylt (ikon, temperatur, vind).
//
// Allt statiskt (snörutor, is, dimbankar, regnrutor, molnskuggor, pölar) målas en gång
// och cachas; per bildruta bara drawImage av rutor och några hundra fillRect.
// Ritas alltid bara i view-rektangeln.
import { hash, bayer, mix, mul, Pix, SMALL, ctxText, textW } from '../core/floor-pix.js';
import { CITY, ROADS, PATHS, LOTS, STREETS_ALL, PARK_LAYOUT } from './map.js';

export const V2 = true;
export const SEASONS = ['vår', 'sommar', 'höst', 'vinter'];
export const KINDS = ['sol', 'moln', 'regn', 'snö', 'dimma', 'blåst'];
export const seasonOf = (day) => SEASONS[Math.floor((Math.max(1, day | 0) - 1) / 7) % 4];

// hur ofta varje väder dyker upp per årstid (vikter)
const TABLE = {
  vår: [['sol', 4], ['moln', 3], ['regn', 2], ['blåst', 1], ['dimma', 1]],
  sommar: [['sol', 7], ['moln', 2], ['regn', 1], ['blåst', 1]],
  höst: [['moln', 3], ['regn', 3], ['blåst', 2], ['dimma', 2], ['sol', 2]],
  vinter: [['snö', 4], ['moln', 3], ['sol', 2], ['dimma', 1], ['blåst', 1]],
};
const BASE_TEMP = { vår: 8, sommar: 21, höst: 9, vinter: -5 };
const KIND_TEMP = { sol: 3, moln: 0, regn: -2, snö: -2, dimma: -1, blåst: -3 };
const CLOUD = { sol: 0.15, moln: 0.85, regn: 1, snö: 1, dimma: 0.7, blåst: 0.5 };
const SEG = [0, 11, 17, 24]; // tre väderpass per dygn

function pick(season, day, seg) {
  const t = TABLE[season], sum = t.reduce((a, [, w]) => a + w, 0);
  let r = hash(day, seg, 7701) * sum;
  for (const [k, w] of t) { r -= w; if (r < 0) return k; }
  return t[0][0];
}
const segOf = (h) => (h < SEG[1] ? 0 : h < SEG[2] ? 1 : 2);
const smooth = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const mod = (a, n) => ((a % n) + n) % n;
const rgba = (r, g, b, a) => `rgba(${r},${g},${b},${a.toFixed(3)})`;

// temperaturen en viss timme: årstid + dygnskurva (varmast kl 15) + vädret + dagens lynne
const tempAt = (day, hour, season, kind) =>
  Math.round(BASE_TEMP[season] + 4 * Math.sin(((hour - 9) / 24) * Math.PI * 2) + (KIND_TEMP[kind] || 0) + (hash(day, 4, 7706) - 0.5) * 6);
// vädret i ett pass; regn i minusgrader faller som snö (vinterns ösregn = snöstorm)
function kindAt(day, seg, season, ev) {
  const k = ev === 'regn' ? 'regn' : pick(season, day, seg);
  if (k === 'regn' && tempAt(day, SEG[seg] + 2, season, 'regn') <= 0) return 'snö';
  return k;
}
const intensityOf = (day, seg, ev) => (ev === 'regn' ? 0.85 + hash(day, 3, 7702) * 0.15 : 0.45 + hash(day, seg, 7703) * 0.55);

// ---------------------------------------------------------------------
// Snötäcket räknas fram pass för pass: det växer medan det snöar (fortare i tätt
// snöfall), smälter i plusgrader (fortare ju varmare, och i regn) och ligger annars
// kvar. Vinterns första dag börjar bar; våren ärver vinterns täcke tills det smält.
// ---------------------------------------------------------------------
const coverMemo = new Map();
function coverAtEnd(day) {
  if (day < 1) return 0;
  if (!coverMemo.has(day)) coverMemo.set(day, snowCoverAt(day, 24, null));
  return coverMemo.get(day);
}
export function snowCoverAt(day, hour, eventId = null) {
  day = Math.max(1, day | 0);
  const season = seasonOf(day), first = (day - 1) % 7 === 0;
  if (season === 'sommar') return 0;
  let c = first && season !== 'vår' ? 0 : coverAtEnd(day - 1);
  for (let s = 0; s < 3 && SEG[s] < hour; s++) {
    const end = Math.min(hour, SEG[s + 1]), h = end - SEG[s];
    const kind = kindAt(day, s, season, eventId), temp = tempAt(day, (SEG[s] + end) / 2, season, kind);
    if (kind === 'snö') c += h * (0.04 + 0.08 * intensityOf(day, s, eventId));
    else if (temp > 0) c -= h * (kind === 'regn' ? 0.12 : 0.025 + 0.012 * temp);
    else if (kind === 'sol' && temp > -3) c -= h * 0.006; // solen tär lite även i lätt kyla
    c = clamp01(c);
  }
  return +c.toFixed(3);
}

// Det rena vädret en viss dag och timme.
export function weatherAt(day, hour, eventId = null) {
  day = Math.max(1, day | 0);
  const season = seasonOf(day), seg = segOf(hour), dIn = (day - 1) % 7;
  const kind = kindAt(day, seg, season, eventId);
  // övergång: första 45 min av ett pass tonar upp ur förra passets väder
  const prev = seg > 0 ? kindAt(day, seg - 1, season, eventId) : kindAt(day - 1, 2, seasonOf(day - 1), null);
  const ramp = prev === kind ? 1 : smooth((hour - SEG[seg]) / 0.75);
  const intensity = +(intensityOf(day, seg, eventId) * ramp).toFixed(3);
  // vind (px/s, + = österut)
  const sign = hash(day, 9, 7704) > 0.5 ? 1 : -1;
  const wind = Math.round(sign * (kind === 'blåst' ? 55 + 35 * intensity : kind === 'regn' ? 16 + 12 * intensity : kind === 'snö' ? 8 + 10 * intensity : 3 + 9 * hash(day, seg, 7705)));
  const snowCover = snowCoverAt(day, hour, eventId);
  const temp = tempAt(day, hour, season, kind);
  // blöt mark: regnar nu, regnade förra passet (torkar på ~4 h), regnade i natt, eller snösmältning
  let wet = kind === 'regn' ? 0.55 + 0.45 * intensity : 0;
  if (!wet && seg > 0 && prev === 'regn') wet = Math.max(0, 0.8 - (hour - SEG[seg]) * 0.2);
  if (!wet && seg === 0 && prev === 'regn') wet = Math.max(0, 0.6 - hour * 0.15);
  if (snowCover > 0 && temp > 0) wet = Math.max(wet, 0.35 + 0.3 * snowCover);
  // molntäcke (tonar mellan passen) och åska i kraftigt sommar-/höstregn
  const cloudOf = (k) => (k === 'sol' ? 0.05 + 0.25 * hash(day, seg, 7708) : k === 'moln' ? 0.6 + 0.4 * intensity : k === 'blåst' ? 0.3 + 0.4 * hash(day, seg, 7709) : CLOUD[k]);
  const cloud = +(cloudOf(prev) + (cloudOf(kind) - cloudOf(prev)) * ramp).toFixed(3);
  const thunder = kind === 'regn' && intensity >= 0.7 && (season === 'sommar' || season === 'höst' || eventId === 'regn') && hash(day, seg, 7707) < (eventId === 'regn' ? 0.7 : 0.45) ? 1 : 0;
  return { kind, intensity, wind, snowCover, wet: +wet.toFixed(3), season, temp, dayIndex: dIn, cloud, thunder };
}

// ---------------------------------------------------------------------
// Etiketter: text, emoji-ikon och pixelskylten.
// ---------------------------------------------------------------------
const EMOJI = { sol: '☀️', moln: '☁️', regn: '🌧️', snö: '🌨️', dimma: '🌫️', blåst: '🌬️' };
export function weatherName(w) {
  if (!w) return '';
  const k = w.intensity ?? 0.6, wind = Math.abs(w.wind || 0);
  switch (w.kind) {
    case 'sol': return w.cloud > 0.25 ? 'Sol och moln' : w.temp >= 25 ? 'Solhetta' : 'Sol';
    case 'moln': return k >= 0.7 ? 'Mulet' : 'Molnigt';
    case 'regn': return w.thunder ? 'Åskväder' : k >= 0.85 ? 'Ösregn' : k < 0.45 ? 'Duggregn' : 'Regn';
    case 'snö': return k >= 0.75 && wind > 24 ? 'Yrsnö' : k >= 0.8 ? 'Tätt snöfall' : 'Snöfall';
    case 'dimma': return k >= 0.75 ? 'Tät dimma' : 'Dimma';
    case 'blåst': return k >= 0.85 ? 'Kuling' : 'Blåsigt';
    default: return w.kind;
  }
}
export const weatherIcon = (w) => (w ? (w.kind === 'regn' && w.thunder ? '⛈️' : EMOJI[w.kind] || '🌡️') : '');
export const weatherText = (w) => (w ? `${weatherName(w)}, ${w.temp}° · ${w.season}` : '');
export const weatherLabel = (w) => (w ? `${weatherIcon(w)} ${weatherText(w)}` : '');

const ICON = {
  sol: ['..y.y..', 'y.yyy.y', '.yYYYy.', 'yyYYYyy', '.yYYYy.', 'y.yyy.y', '..y.y..'],
  moln: ['.......', '..www..', '.wwWww.', 'wwWWWww', 'wwwwwww', '.ggggg.', '.......'],
  regn: ['..www..', '.wwWww.', 'wwwwwww', '.ggggg.', 'b.b.b..', '.b.b.b.', 'b.b.b..'],
  åska: ['..www..', '.wwWww.', 'wwwwwww', '.gyygg.', 'b.yy.b.', '.yy..b.', 'y.b....'],
  snö: ['..w....', 'w.w.w..', '.www...', 'wwWww.w', '.www.w.', 'w.w.w.w', '..w..w.'],
  dimma: ['.......', 'gggg...', '.......', '..ggggg', '.......', 'ggggg..', '.......'],
  blåst: ['.......', 'wwwww..', '.....w.', 'wwwwww.', '.......', 'wwww.w.', '....w..'],
};
const ICOL = { y: '#ffd23f', Y: '#fff1a0', w: '#e8eef6', W: '#ffffff', g: '#9aa4b2', b: '#6fb2ff' };
export function drawWeatherBadge(ctx, x, y, w) {
  if (!w) return;
  const t = `${weatherName(w)} ${w.temp}`.toUpperCase(), s = w.season.toUpperCase();
  const windy = Math.abs(w.wind || 0) >= 22;
  const tw = textW(SMALL, t) + 4, sw = textW(SMALL, s) + (windy ? 8 : 0);
  const bw = 7 + 3 + Math.max(tw, sw) + 5, bh = 17;
  x = Math.round(x - bw); y = Math.round(y);
  ctx.fillStyle = 'rgba(16,18,30,0.72)'; ctx.fillRect(x, y, bw, bh);
  ctx.fillStyle = 'rgba(255,255,255,0.14)'; ctx.fillRect(x, y, bw, 1);
  const ic = ICON[w.kind === 'regn' && w.thunder ? 'åska' : w.kind] || ICON.sol;
  ic.forEach((row, j) => { for (let i = 0; i < row.length; i++) if (row[i] !== '.') { ctx.fillStyle = ICOL[row[i]]; ctx.fillRect(x + 3 + i, y + 5 + j, 1, 1); } });
  ctxText(ctx, SMALL, t, x + 13, y + 3, '#f4f1ea');
  // gradtecken: en liten ring
  const gx = x + 13 + textW(SMALL, t) + 1;
  ctx.fillStyle = '#f4f1ea'; ctx.fillRect(gx, y + 3, 2, 1); ctx.fillRect(gx, y + 5, 2, 1); ctx.fillRect(gx - 1, y + 4, 1, 1); ctx.fillRect(gx + 2, y + 4, 1, 1);
  ctxText(ctx, SMALL, s, x + 13, y + 10, '#a9b4c8');
  // vindpil (åt det håll det blåser), fetare ju hårdare
  if (windy) {
    const ax = x + 13 + textW(SMALL, s) + 3, ay = y + 11, d = w.wind > 0 ? 1 : -1, hard = Math.abs(w.wind) >= 50;
    ctx.fillStyle = hard ? '#ffd23f' : '#c5cfdd';
    ctx.fillRect(ax, ay + 1, 5, 1);
    ctx.fillRect(ax + (d > 0 ? 3 : 1), ay, 1, 1); ctx.fillRect(ax + (d > 0 ? 3 : 1), ay + 2, 1, 1);
    if (hard) ctx.fillRect(ax + (d > 0 ? 2 : 2), ay, 1, 1), ctx.fillRect(ax + 2, ay + 2, 1, 1);
  }
}

// ---------------------------------------------------------------------
// Rutmålare. Alla rutor är sömlösa (periodiskt värdebrus) och ligger i
// världskoordinater så att de inte simmar när kameran rör sig.
// ---------------------------------------------------------------------
const TS = 128; // snö-/slaskrutans sida
// periodiskt värdebrus: gittret upprepas var px (och py, om givet) pixel
function pnoise(x, y, s, seed, px, py) {
  const nx = Math.max(1, Math.round(px / s)), ny = py ? Math.max(1, Math.round(py / s)) : 0;
  const sx = px / nx, sy = py ? py / ny : s;
  const fx = x / sx, fy = y / sy, ix = Math.floor(fx), iy = Math.floor(fy);
  let tx = fx - ix, ty = fy - iy;
  tx = tx * tx * (3 - 2 * tx); ty = ty * ty * (3 - 2 * ty);
  const h = (i, j) => hash(mod(i, nx), ny ? mod(j, ny) : j, seed);
  const a = h(ix, iy), b = h(ix + 1, iy), c = h(ix, iy + 1), d = h(ix + 1, iy + 1);
  return a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty;
}
function tile(w, h, fn) {
  const P = new Pix(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) fn(P, x, y);
  return P.flush();
}
const CACHE = new Map();
const cached = (key, make) => { if (!CACHE.has(key)) CACHE.set(key, make()); return CACHE.get(key); };

// snö på öppen mark: drivor med 4 toner, dithrade kanter, gnistor och lite smuts
const snowGround = (q) => cached('sg' + q, () => {
  const thr = 1 - (q / 10) * 1.08;
  return tile(TS, TS, (P, x, y) => {
    const n = pnoise(x, y, 16, 3101, TS, TS) * 0.55 + pnoise(x, y, 6, 3102, TS, TS) * 0.3 + hash(x, y, 3103) * 0.15;
    const e = n - thr;
    if (e < 0 || (e < 0.03 && bayer(x, y) > e / 0.03)) return;
    const sh = pnoise(x, y, 32, 3104, TS, TS);
    let c = e < 0.06 ? 0xc6d0e0 : sh < 0.3 ? 0xd9e1ee : sh < 0.62 ? 0xe9eef6 : 0xf6f8fc;
    if (hash(x, y, 3105) > 0.978) c = 0xffffff;
    else if (q >= 6 && hash(x, y, 3106) > 0.994) c = 0xb4bccc;
    P.px(x, y, c);
  });
});
// snö på trottoarer och gångar: tunnare, nertrampad, fotspår och grå slaskfläckar
const snowWalk = (q) => cached('sw' + q, () => {
  const qq = Math.max(1, Math.round(q * 0.7)), thr = 1 - qq / 10;
  const steps = new Set();
  for (let i = 0; i < 16; i++) {
    const x0 = hash(i, 1, 3110) * TS, y0 = hash(i, 2, 3110) * TS, dir = hash(i, 3, 3110) > 0.5 ? 1 : -1, vert = hash(i, 4, 3110) > 0.7;
    for (let k = 0; k < 6; k++) {
      const sx = Math.round(vert ? x0 + (k % 2 ? 3 : 0) : x0 + k * 5 * dir), sy = Math.round(vert ? y0 + k * 4 * dir : y0 + (k % 2 ? 3 : 0));
      for (let j = 0; j < 3; j++) for (let i2 = 0; i2 < 2; i2++) steps.add(mod(sx + i2, TS) + ',' + mod(sy + j, TS));
    }
  }
  return tile(TS, TS, (P, x, y) => {
    const n = pnoise(x, y, 12, 3111, TS, TS) * 0.5 + pnoise(x, y, 5, 3112, TS, TS) * 0.3 + hash(x, y, 3113) * 0.2;
    const e = n - thr;
    if (e < 0 || (e < 0.04 && bayer(x, y) > e / 0.04)) return;
    if (steps.has(x + ',' + y)) { if (qq >= 3) P.px(x, y, 0xa6adba, 0.85); return; }
    const sh = pnoise(x, y, 28, 3114, TS, TS);
    let c = e < 0.08 ? 0xcbd3e0 : sh < 0.4 ? 0xdde4ee : 0xedf1f7;
    if (hash(x, y, 3115) > 0.9) c = 0xb6bdc9;
    else if (hash(x, y, 3116) > 0.985) c = 0xffffff;
    P.px(x, y, c);
  });
});
// vägarna är plogade/uppkörda: grå, brunaktig slask
const slush = (q) => cached('sl' + q, () => {
  const thr = 1 - (q / 10) * 0.92;
  return tile(TS, TS, (P, x, y) => {
    const n = pnoise(x, y, 10, 3120, TS, TS) * 0.45 + pnoise(x, y, 4, 3121, TS, TS) * 0.25 + hash(x, y, 3122) * 0.3;
    if (n < thr) return;
    const sh = pnoise(x, y, 24, 3123, TS, TS);
    let c = sh < 0.25 ? 0x76797f : sh < 0.5 ? 0x8a8d93 : sh < 0.78 ? 0x9da0a6 : 0xb0b3b9;
    if (hash(x, y, 3124) > 0.88) c = 0x86807a;
    else if (hash(x, y, 3125) > 0.965) c = 0xdde1e6;
    P.px(x, y, c, 0.9);
  });
});
// plogvallen längs vägkanten (3 rader)
const ridge = () => cached('ridge', () => tile(TS, 3, (P, x, y) => {
  const h = hash(x, y, 3126);
  if (y === 0) { if (h > 0.45) P.px(x, y, 0xf3f6fa); }
  else if (y === 1) { if (h > 0.12) P.px(x, y, h > 0.7 ? 0xfafcff : 0xe6ecf4); }
  else if (h > 0.35) P.px(x, y, 0xcdd6e2);
}));
// is: blek blågrå yta med ljusare fält, sprickor och (vid mycket snö) snöfläckar
function paintIce(P, x, y, w, h, q, seed, edge) {
  const n = pnoise(x, y, 24, seed, w, h) * 0.6 + pnoise(x, y, 9, seed + 1, w, h) * 0.4;
  let c = n < 0.35 ? 0xbfd0dc : n < 0.6 ? 0xcfdde8 : n < 0.85 ? 0xdbe7ef : 0xe8f0f5;
  if (q >= 4 && pnoise(x, y, 14, seed + 2, w, h) > 0.92 - q * 0.03) c = 0xf2f6fa;
  if (hash(x, y, seed + 3) > 0.985) c = 0xffffff;
  if (edge) c = mix(c, 0xeef4f8, 0.6);
  P.px(x, y, c);
}
function cracks(P, w, h, n, seed) {
  for (let i = 0; i < n; i++) {
    let x = hash(i, 1, seed) * w, y = hash(i, 2, seed) * h;
    const segs = 3 + ((hash(i, 3, seed) * 4) | 0);
    for (let s = 0; s < segs; s++) {
      const nx = x + (hash(i, s * 2, seed + 1) - 0.5) * 16, ny = y + (hash(i, s * 2 + 1, seed + 1) - 0.5) * 6;
      P.line(mod(x, w), mod(y, h), mod(x, w) + (nx - x), mod(y, h) + (ny - y), 0x9db6c8, 0.8);
      x = nx; y = ny;
    }
  }
}
const iceCanal = (q) => cached('ic' + q, () => {
  const h = CITY.H - CITY.CANAL[0];
  const P = new Pix(TS, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < TS; x++) paintIce(P, x, y, TS, h, q, 3130, y === 0);
  cracks(P, TS, h, 5, 3134);
  for (let x = 0; x < TS; x++) P.px(x, 0, 0x9fb8ca, 0.7);
  return P.flush();
});
// dammen: blåare is än kanalen (skuggad av träden), strandkant av snö och en mörk iskant
const icePond = (q) => cached('ip' + q, () => {
  const { rx, ry } = PARK_LAYOUT.pond, w = rx * 2 + 2, h = ry * 2 + 2;
  const P = new Pix(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const t = Math.hypot((x + 0.5 - w / 2) / (rx - 1), (y + 0.5 - h / 2) / (ry - 1)) + (hash(x, y, 3145) - 0.5) * 0.06;
    if (t >= 1) continue;
    if (t > 0.92) { P.px(x, y, y < h / 2 ? 0x8ea4b6 : 0xa9bccb); continue; }          // iskanten mot stranden
    if (t > 0.82) { P.px(x, y, 0xeaf1f6); continue; }                                  // snö längs kanten
    const n = pnoise(x, y, 14, 3140, w, h) * 0.6 + pnoise(x, y, 6, 3141, w, h) * 0.4;
    let c = n < 0.35 ? 0xa9c2d3 : n < 0.6 ? 0xb9cfdd : n < 0.85 ? 0xc8dae5 : 0xd6e4ec;
    if (q >= 4 && pnoise(x, y, 10, 3142, w, h) > 0.9 - q * 0.03) c = 0xeef3f7;         // snöfläckar på isen
    if (hash(x, y, 3143) > 0.985) c = 0xffffff;
    P.px(x, y, c);
  }
  P.clip(4, 4, w - 4, h - 4); cracks(P, w, h, 3, 3144); P.clip();
  return P.flush();
});
// molnskuggor: mjuka klumpar, dithrade kanter, sömlös ruta 512 × 256
const CW = 512, CH = 256;
const cloudTex = () => cached('cloud', () => {
  const dens = new Float32Array(CW * CH);
  for (let i = 0; i < 7; i++) {
    const cx = hash(i, 1, 3150) * CW, cy = hash(i, 2, 3150) * CH, sz = 70 + hash(i, 3, 3150) * 90;
    for (let j = 0; j < 9; j++) {
      const bx = cx + (hash(i, j, 3151) - 0.5) * sz * 1.7, by = cy + (hash(i, j, 3152) - 0.5) * sz * 0.5;
      const rx = sz * (0.3 + hash(i, j, 3153) * 0.4), ry = sz * (0.18 + hash(i, j, 3154) * 0.16);
      for (let y = Math.floor(by - ry); y <= by + ry; y++) for (let x = Math.floor(bx - rx); x <= bx + rx; x++) {
        const d = 1 - Math.hypot((x + 0.5 - bx) / rx, (y + 0.5 - by) / ry);
        if (d <= 0) continue;
        const k = mod(y, CH) * CW + mod(x, CW);
        if (d > dens[k]) dens[k] = d;
      }
    }
  }
  return tile(CW, CH, (P, x, y) => {
    const d0 = dens[y * CW + x];
    if (d0 <= 0) return;
    const d = d0 + (pnoise(x, y, 9, 3155, CW, CH) - 0.5) * 0.14;
    if (d > 0.3 || (d > 0 && bayer(x, y) < d / 0.3)) P.px(x, y, 0x0c1422);
  });
});
// dimbankar: två sömlösa, dithrade lager
const FW = 256, FH = 128;
const fogTex = (i) => cached('fog' + i, () => tile(FW, FH, (P, x, y) => {
  const d = pnoise(x, y, 64, 3160 + i * 10, FW, FH) * 0.55 + pnoise(x, y, 20, 3161 + i * 10, FW, FH) * 0.3 + pnoise(x, y, 7, 3162 + i * 10, FW, FH) * 0.15;
  const lv = (d - 0.42) * 2.4;
  if (bayer(x, y) < lv) P.px(x, y, lv > 0.75 ? 0xeff2f6 : 0xdfe4ea);
}));
// regnrutor: droppar som streck, lutade efter vinden (slant = px i sidled per 4 px fall)
const RT = 96;
const rainTile = (slant, L) => cached(`rain${slant}:${L}`, () => {
  const len = [2, 4, 7][L], n = [30, 18, 9][L], col = [0xb0c6e8, 0xccdef6, 0xe4eefc][L], a = [0.45, 0.7, 0.9][L];
  const P = new Pix(RT, RT);
  for (let i = 0; i < n; i++) {
    const x0 = hash(i, 1, 3170 + L) * RT, y0 = hash(i, 2, 3170 + L) * RT;
    for (let k = 0; k < len; k++) P.px(mod(Math.round(x0 + (k * slant) / 4), RT), mod(Math.round(y0 + k), RT), col, a * (k === 0 || k === len - 1 ? 0.6 : 1));
  }
  return P.flush();
});
// pölar: spegling av himlen, ljus överkant, mörk nederkant, våt kant runtom
const PUD = [[4, 2], [6, 3], [9, 4], [12, 5]];
const puddleSprite = (sz, night) => cached(`pud${sz}:${night ? 1 : 0}`, () => {
  const [rx, ry] = PUD[sz], w = rx * 2 + 4, h = ry * 2 + 4, cx = w / 2, cy = h / 2;
  return tile(w, h, (P, x, y) => {
    const t = Math.hypot((x + 0.5 - cx) / rx, (y + 0.5 - cy) / ry) + (hash(x, y, 3180 + sz) - 0.5) * 0.3;
    if (t < 1) {
      const f = (y + 0.5 - (cy - ry)) / (ry * 2);
      let c = night ? mix(0x2c3654, 0x161c30, f) : mix(0xc2d6e8, 0x66788e, f);
      if (t > 0.8) c = mul(c, 0.84);
      if (!night && y < cy - 1 && hash(x, y, 3185) > 0.78) c = mix(c, 0xf2f7fc, 0.55);
      P.px(x, y, c, 0.78);
    } else if (t < 1.3 && bayer(x, y) < (1.3 - t) / 0.3) P.px(x, y, 0x0a1420, 0.28);
  });
});
// ringar (ellipser) för regndroppar i pölar, radie 1–4
const RING = [null];
for (let r = 1; r <= 4; r++) {
  const pts = new Set(), ry = Math.max(1, r * 0.5);
  for (let i = 0; i < 48; i++) { const a = (i / 48) * Math.PI * 2; pts.add(Math.round(Math.cos(a) * r) + ',' + Math.round(Math.sin(a) * ry)); }
  RING.push([...pts].map((s) => s.split(',').map(Number)));
}

// ---------------------------------------------------------------------
// Kartans zoner för snö och pölar: öppen mark (drivor), trottoarer/gångar/tomter
// (nertrampat), vägar (slask + hjulspår + plogvall), kanalen (is).
// ---------------------------------------------------------------------
let Z = null;
const isRect = (r) => Array.isArray(r) && r.length >= 4 && r.every((v) => Number.isFinite(v)) && r[2] > r[0] && r[3] > r[1];
function zones() {
  if (Z) return Z;
  const W = CITY.W, band = (b) => (b ? [0, b[0], W, b[1]] : null);
  const walk = [band(CITY.BACK), band(CITY.SIDEWALK_N), band(CITY.SIDEWALK_S), band(CITY.SIDEWALK_SN), band(CITY.SIDEWALK_SS), band(CITY.QUAY),
    ...(PATHS || []).map((p) => p?.rect?.slice()),
    ...(LOTS || []).filter((l) => /parkering|grusplan|atervinning|vagnsplatsen/.test(l?.kind || '')).map((l) => l.rect?.slice()),
    ...(STREETS_ALL || []).filter((s) => s && (s.kind === 'alley' || s.kind === 'street')).map((s) => [s.x0, s.y0, s.x1, s.y1])].filter(isRect);
  const road = (ROADS || []).map((r) => ({ r, rect: [r.x0, r.y0, r.x1, r.y1] })).filter(({ r, rect }) => isRect(rect) && Array.isArray(r.lanes));
  const water = CITY.CANAL ? [[0, CITY.CANAL[0], W, CITY.H]] : [];
  // pölarna: på hårda ytor, tätast i rännstenarna
  const puddles = [];
  let i = 0;
  const addIn = (rect, per, gutter) => {
    const [x0, y0, x1, y1] = rect, n = Math.round(((x1 - x0) * (y1 - y0)) / per);
    for (let k = 0; k < n; k++, i++) {
      let y = y0 + 3 + hash(i, 2, 3190) * (y1 - y0 - 6);
      if (gutter && hash(i, 3, 3190) < 0.6) y = hash(i, 4, 3190) < 0.5 ? y0 + 3 + hash(i, 5, 3190) * 3 : y1 - 4 - hash(i, 5, 3190) * 3;
      const r = hash(i, 6, 3190), sz = r > 0.82 ? 3 : r > 0.58 ? 2 : r > 0.3 ? 1 : 0;
      puddles.push({ x: Math.round(x0 + 4 + hash(i, 1, 3190) * (x1 - x0 - 8)), y: Math.round(y), sz, i });
    }
  };
  for (const r of walk) addIn(r, r[2] - r[0] > 400 ? 2600 : 1800, false);
  for (const { rect } of road) addIn(rect, 4200, true);
  Z = { walk, road, water, puddles };
  return Z;
}
const overlap = (a, b) => a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1];
const isect = (a, b) => [Math.max(a[0], b[0]), Math.max(a[1], b[1]), Math.min(a[2], b[2]), Math.min(a[3], b[3])];
// tar bort h ur varje rektangel i listan (delar i upp till fyra bitar)
function subtract(rects, h) {
  const out = [];
  for (const r of rects) {
    if (!overlap(r, h)) { out.push(r); continue; }
    if (h[1] > r[1]) out.push([r[0], r[1], r[2], h[1]]);
    if (h[3] < r[3]) out.push([r[0], h[3], r[2], r[3]]);
    const y0 = Math.max(r[1], h[1]), y1 = Math.min(r[3], h[3]);
    if (h[0] > r[0]) out.push([r[0], y0, h[0], y1]);
    if (h[2] < r[2]) out.push([h[2], y0, r[2], y1]);
  }
  return out;
}
// lägger rutan img (världsjusterad, förskjuten ox/oy) över rektangeln r
function blit(ctx, img, r, ox = 0, oy = 0) {
  const tw = img.width, th = img.height;
  if (r[2] <= r[0] || r[3] <= r[1]) return;
  for (let ty = Math.floor((r[1] - oy) / th) * th + oy; ty < r[3]; ty += th) for (let tx = Math.floor((r[0] - ox) / tw) * tw + ox; tx < r[2]; tx += tw) {
    const x0 = Math.max(tx, r[0]), y0 = Math.max(ty, r[1]), x1 = Math.min(tx + tw, r[2]), y1 = Math.min(ty + th, r[3]);
    if (x1 > x0 && y1 > y0) ctx.drawImage(img, x0 - tx, y0 - ty, x1 - x0, y1 - y0, x0, y0, x1 - x0, y1 - y0);
  }
}

// ---------------------------------------------------------------------
// Partiklar (lokala – bara utseende, aldrig spellogik)
// ---------------------------------------------------------------------
const FLAKES = Array.from({ length: 420 }, (_, i) => ({
  a: hash(i, 1, 55) * 1000, b: hash(i, 2, 55) * 1000, z: hash(i, 3, 55), ph: hash(i, 4, 55) * 6.28,
  fr: 0.5 + hash(i, 5, 55) * 1.3, sw: 2 + hash(i, 6, 55) * 7,
}));
const LEAVES = Array.from({ length: 36 }, (_, i) => ({
  a: hash(i, 1, 56) * 1000, b: hash(i, 2, 56) * 1000, z: hash(i, 3, 56), ph: hash(i, 4, 56) * 6.28, c: hash(i, 5, 56), fr: 3 + hash(i, 6, 56) * 4,
}));
const LEAF_COL = {
  vår: ['#f2b8d4', '#fbe1ec', '#ffffff', '#9ecb6a'],                // körsbärsblad och färska blad
  sommar: ['#6f9d3f', '#8fbd52', '#e9e2cf', '#c8c2b0'],            // gröna blad, papper
  höst: ['#d9822b', '#b8461f', '#e8b230', '#8b5a2b', '#c65a26'],   // höstlöv
  vinter: ['#e9eef4', '#c8c2b0', '#ffffff'],                       // snödamm, papper
};
// fyra tumlingsbilder för ett löv (3 × 2)
const LEAF_FR = [['xx.', '.xx'], ['.x.', 'xxx'], ['xxx', '...'], ['x..', 'xx.']];

// ---------------------------------------------------------------------
export function createWeather(env) {
  const W = () => env.weather;
  let forcedSince = null; // för att låta tvingad snö lägga sig gradvis i förhandsvisningen
  let lastFlash = false;

  // blixtar: fönster om 11 s, ~70 % av dem har en dubbelblixt
  function flashAt(t) {
    const P = 11, i = Math.floor(t / P);
    if (hash(i, 2, 7710) < 0.3) return 0;
    const f = t - (i * P + hash(i, 1, 7710) * (P - 1));
    if (f < 0) return 0;
    if (f < 0.08) return 1;
    if (f < 0.16) return 0.25;
    if (f < 0.24) return 0.7;
    if (f < 0.5) return 0.7 * (1 - (f - 0.24) / 0.26);
    return 0;
  }
  const goldenAt = (h) => Math.max(0, 1 - Math.abs(h - 7.3) / 1.4, 1 - Math.abs(h - 18.2) / 1.6); // gyllene timmen

  // ---------- partikelritare (delas av drawFront och glow) ----------
  const cnt = (n, view) => Math.round((n * (view.w * view.h)) / (384 * 216));
  function drawSnowfall(ctx, view, w, alpha) {
    const t = env.t, k = w.intensity, vx = view.x, vy = view.y, vw = view.w, vh = view.h;
    const n = Math.min(FLAKES.length, cnt(40 + 200 * k, view)), gust = w.gust || 1, wind = w.windNow || 0;
    const yr = Math.abs(wind) > 24 && k > 0.6; // yrsnö: flingorna far mer i sidled
    for (let i = 0; i < n; i++) {
      const f = FLAKES[i], drift = wind * (0.35 + 0.55 * f.z);
      const fx = vx + mod(f.a + t * drift + Math.sin(t * f.fr + f.ph) * f.sw * gust, vw + 8) - 4;
      const fy = vy + mod(f.b + t * (14 + f.z * 30) * (0.8 + 0.4 * k) + Math.cos(t * f.fr * 0.7 + f.ph) * 2, vh + 8) - 4;
      const x = fx | 0, y = fy | 0;
      if (f.z < 0.45) { ctx.fillStyle = rgba(214, 226, 242, 0.55 * alpha); ctx.fillRect(x, y, 1, 1); }
      else if (f.z < 0.78) { ctx.fillStyle = rgba(244, 248, 255, 0.9 * alpha); ctx.fillRect(x, y, yr ? 2 : 1, 1); }
      else if (f.z < 0.93) { ctx.fillStyle = rgba(255, 255, 255, 0.95 * alpha); ctx.fillRect(x, y, 2, 2); }
      else { ctx.fillStyle = rgba(255, 255, 255, alpha); ctx.fillRect(x - 1, y, 3, 1); ctx.fillRect(x, y - 1, 1, 3); }
    }
  }
  function drawRain(ctx, view, w, alpha) {
    const t = env.t, k = w.intensity, wind = w.windNow || 0;
    const slant = Math.max(-4, Math.min(4, Math.round(wind / 12)));
    const r = [view.x, view.y, view.x + view.w, view.y + view.h];
    const layers = k > 0.65 ? 3 : k > 0.25 ? 2 : 1;
    for (let L = 0; L < layers; L++) {
      const sp = [120, 200, 300][L] * (0.85 + 0.3 * k);
      ctx.globalAlpha = alpha * (L === 0 ? 0.55 + 0.3 * k : L === 1 ? 0.75 : 0.85);
      blit(ctx, rainTile(slant, L), r, Math.floor(mod(t * sp * slant / 4, RT)), Math.floor(mod(t * sp, RT)));
    }
    ctx.globalAlpha = 1;
  }
  function drawFog(ctx, view, w, night) {
    const t = env.t, k = w.intensity, wind = w.windNow || 0, r = [view.x, view.y, view.x + view.w, view.y + view.h];
    const col = night ? [150, 160, 180] : [214, 220, 228];
    ctx.fillStyle = rgba(...col, night ? 0.16 + 0.12 * k : 0.1 + 0.16 * k); ctx.fillRect(view.x, view.y, view.w, view.h);
    ctx.globalAlpha = (night ? 0.22 : 0.36) + 0.22 * k;
    blit(ctx, fogTex(0), r, Math.floor(mod(t * (3 + wind * 0.12), FW)), Math.floor(mod(t * 0.6, FH)));
    if (!night) {
      ctx.globalAlpha = 0.28 + 0.18 * k;
      blit(ctx, fogTex(1), r, Math.floor(mod(-t * (1.5 - wind * 0.2), FW)), Math.floor(mod(-t * 0.4, FH)));
    }
    ctx.globalAlpha = 1;
    // tätare längst bort (överkanten)
    for (let i = 0; i < 3; i++) { ctx.fillStyle = rgba(...col, (0.12 - i * 0.04) * (0.6 + 0.6 * k)); ctx.fillRect(view.x, view.y + i * 24, view.w, 24); }
  }
  function drawWind(ctx, view, w, alpha) {
    const t = env.t, k = w.intensity, wind = w.windNow || w.wind || 40, vx = view.x, vy = view.y, vw = view.w, vh = view.h;
    // vindstrimmor
    const n = cnt(8 + 16 * k, view);
    ctx.fillStyle = rgba(236, 238, 232, 0.28 * alpha);
    for (let i = 0; i < n; i++) {
      const sx = vx + mod(i * 131.7 + t * wind * 2.4, vw + 60) - 30;
      const sy = vy + mod(i * 71.3 + Math.sin(t * 2 + i) * 4, vh);
      ctx.fillRect(sx | 0, sy | 0, 5 + (i % 5) * 2, 1);
    }
    // löv, blomblad och papper som tumlar förbi
    const cols = LEAF_COL[w.season] || LEAF_COL.sommar, m = Math.min(LEAVES.length, cnt(10 + 18 * k, view));
    for (let i = 0; i < m; i++) {
      const l = LEAVES[i], sp = wind * (1.1 + 0.6 * l.z);
      const lx = vx + mod(l.a + t * sp, vw + 24) - 12;
      const ly = vy + mod(l.b + t * (6 + l.z * 10) + Math.sin(t * l.fr + l.ph) * (5 + l.z * 6), vh + 12) - 6;
      const fr = LEAF_FR[Math.floor(t * l.fr * 1.3 + l.ph) & 3];
      ctx.fillStyle = cols[Math.floor(l.c * cols.length)];
      ctx.globalAlpha = alpha * (0.7 + 0.3 * l.z);
      for (let j = 0; j < 2; j++) for (let i2 = 0; i2 < 3; i2++) if (fr[j][i2] === 'x') ctx.fillRect((lx | 0) + (wind > 0 ? i2 : 2 - i2), (ly | 0) + j, 1, 1);
    }
    ctx.globalAlpha = 1;
  }

  // ---------- markens lager ----------
  function drawCloudShadows(ctx, view, w) {
    const t = env.t, tex = cloudTex(), sp = 6 + Math.abs(w.windNow || 0) * 0.5, dir = (w.wind || 1) > 0 ? 1 : -1;
    const a = (w.kind === 'moln' ? 0.14 + 0.08 * w.intensity : 0.12) * (1 - env.dark / 0.4);
    ctx.globalAlpha = a;
    blit(ctx, tex, [view.x, view.y, view.x + view.w, view.y + view.h], Math.floor(mod(t * sp * dir, CW)), Math.floor(mod(t * 1.4, CH)));
    ctx.globalAlpha = 1;
  }
  function drawSnowCover(ctx, view, w, q) {
    const z = zones(), vr = [view.x, view.y, view.x + view.w, view.y + view.h];
    // 1. öppen mark = allt utom trottoarer/gångar, vägar och kanalen
    let ground = [vr];
    const walk = [], roads = [];
    for (const r of z.walk) if (overlap(r, vr)) { const c = isect(r, vr); ground = subtract(ground, c); walk.push(c); }
    for (const { r, rect } of z.road) if (overlap(rect, vr)) { const c = isect(rect, vr); ground = subtract(ground, c); roads.push({ r, c }); }
    for (const r of z.water) if (overlap(r, vr)) ground = subtract(ground, isect(r, vr));
    ctx.globalAlpha = 0.96;
    const tg = snowGround(q);
    for (const r of ground) blit(ctx, tg, r);
    // 2. trottoarer och gångar: nertrampat (varje yta bara en gång även där de överlappar)
    const tw = snowWalk(q);
    let done = [];
    for (const c of walk) { let parts = [c]; for (const d of done) parts = subtract(parts, d); for (const p of parts) blit(ctx, tw, p); done.push(c); }
    // 3. vägarna: slask, hjulspår och plogvallar
    const ts = slush(q);
    for (const { r, c } of roads) {
      blit(ctx, ts, c);
      if (q >= 3) {
        ctx.fillStyle = rgba(50, 52, 58, 0.55 + q * 0.03);
        for (const l of r.lanes) for (const off of [-5, 4]) {
          if (r.axis === 'x') { const y = l.y + off; if (y >= c[1] && y < c[3]) ctx.fillRect(c[0], y, c[2] - c[0], 2); }
          else { const x = l.x + off; if (x >= c[0] && x < c[2]) ctx.fillRect(x, c[1], 2, c[3] - c[1]); }
        }
      }
      if (q >= 4) {
        ctx.globalAlpha = 0.9;
        if (r.axis === 'x') {
          if (r.y0 >= c[1]) blit(ctx, ridge(), [c[0], r.y0, c[2], r.y0 + 3]);
          if (r.y1 <= c[3]) blit(ctx, ridge(), [c[0], r.y1 - 3, c[2], r.y1]);
        }
        ctx.globalAlpha = 0.96;
      }
    }
    ctx.globalAlpha = 1;
  }
  function drawIce(ctx, view, w, q, strength) {
    const vr = [view.x, view.y, view.x + view.w, view.y + view.h], z = zones();
    ctx.globalAlpha = strength;
    for (const r of z.water) if (overlap(r, vr)) blit(ctx, iceCanal(q), isect(r, vr));
    const p = PARK_LAYOUT?.pond;
    if (p) {
      const px = p.cx - p.rx - 1, py = p.cy - p.ry - 1;
      if (px < vr[2] && px + p.rx * 2 + 2 > vr[0] && py < vr[3] && py + p.ry * 2 + 2 > vr[1]) ctx.drawImage(icePond(q), px, py);
    }
    ctx.globalAlpha = 1;
  }
  function drawPuddles(ctx, view, w, night) {
    const t = env.t, vr = [view.x - 16, view.y - 8, view.x + view.w + 16, view.y + view.h + 8], raining = w.kind === 'regn';
    const base = clamp01((w.wet - 0.15) / 0.5);
    for (const p of zones().puddles) {
      if (p.x < vr[0] || p.x > vr[2] || p.y < vr[1] || p.y > vr[3]) continue;
      // små pölar torkar först
      const a = base * (p.sz >= 2 ? 1 : p.sz === 1 ? clamp01((w.wet - 0.25) / 0.4) : clamp01((w.wet - 0.4) / 0.4));
      if (a <= 0.02) continue;
      const img = puddleSprite(p.sz, night);
      ctx.globalAlpha = a;
      ctx.drawImage(img, p.x - (img.width >> 1), p.y - (img.height >> 1));
      if (raining && p.sz >= 1) {
        const [rx, ry] = PUD[p.sz], n = p.sz >= 2 ? 2 : 1, rmax = Math.max(1, Math.min(4, Math.floor(rx * 0.45)));
        for (let k = 0; k < n; k++) {
          const ph = t * (1.2 + 0.8 * w.intensity) + hash(p.i, k, 950) * 3, cyc = Math.floor(ph), f = ph - cyc;
          const cx = Math.round(p.x + (hash(p.i, k * 31 + cyc, 951) - 0.5) * (rx - rmax)), cy = Math.round(p.y + (hash(p.i, k * 31 + cyc, 952) - 0.5) * ry * 0.6);
          const r = 1 + Math.floor(f * rmax);
          ctx.fillStyle = rgba(214, 228, 246, 0.65 * (1 - f));
          for (const [dx, dy] of RING[Math.min(4, r)]) ctx.fillRect(cx + dx, cy + dy, 1, 1);
        }
      }
    }
    ctx.globalAlpha = 1;
  }
  // solglitter: blinkande vita korn på vatten, is/snö och pölar
  function drawGlitter(ctx, view, w, ice, q) {
    const t = env.t, cyc = Math.floor(t * 5), vx = view.x, vy = view.y, vw = view.w, vh = view.h;
    const spark = (x, y, big) => { ctx.fillRect(x, y, 1, 1); if (big) { ctx.fillRect(x - 1, y, 1, 1); ctx.fillRect(x + 1, y, 1, 1); } };
    // kanalen
    const c0 = CITY.CANAL[0] + 2, c1 = CITY.H - 2;
    if (c0 < vy + vh && c1 > vy) {
      const n = cnt(ice ? 10 : 22, view);
      for (let i = 0; i < n; i++) {
        if (hash(i, cyc, 3200) < 0.45) continue;
        const x = vx + Math.floor(hash(i, 1, 3201) * vw), y = Math.max(c0, Math.min(c1, c0 + Math.floor(hash(i, 2, 3201) * (c1 - c0))));
        if (y < vy || y >= vy + vh) continue;
        ctx.fillStyle = hash(i, cyc, 3202) > 0.5 ? '#ffffff' : '#fff6c8';
        spark(x, y, hash(i, cyc, 3203) > 0.75);
      }
    }
    // dammen
    const p = PARK_LAYOUT?.pond;
    if (p && p.cx + p.rx > vx && p.cx - p.rx < vx + vw && p.cy + p.ry > vy && p.cy - p.ry < vy + vh) {
      for (let i = 0; i < 8; i++) {
        if (hash(i, cyc, 3204) < 0.5) continue;
        const ax = (hash(i, 1, 3205) - 0.5) * 1.8, ay = (hash(i, 2, 3205) - 0.5) * 1.8;
        if (ax * ax + ay * ay > 0.85) continue;
        ctx.fillStyle = '#ffffff';
        spark(Math.round(p.cx + ax * p.rx), Math.round(p.cy + ay * p.ry), false);
      }
    }
    // snön gnistrar
    if (q >= 3) {
      const n = cnt(14 + q, view);
      ctx.fillStyle = '#ffffff';
      for (let i = 0; i < n; i++) {
        if (hash(i, cyc, 3206) < 0.6) continue;
        spark(vx + Math.floor(hash(i, 1, 3207) * vw), vy + Math.floor(hash(i, 2, 3207) * vh), false);
      }
    }
    // pölarna
    if (w.wet > 0.3 && q < 6) {
      ctx.fillStyle = '#ffffff';
      for (const pd of zones().puddles) {
        if (pd.sz < 1 || pd.x < vx || pd.x > vx + vw || pd.y < vy || pd.y > vy + vh) continue;
        if (hash(pd.i, cyc, 3208) < 0.55) continue;
        spark(pd.x + Math.round((hash(pd.i, cyc, 3209) - 0.5) * PUD[pd.sz][0]), pd.y - 1 + Math.round(hash(pd.i, cyc, 3210) * 2), false);
      }
    }
  }

  const SEASON_TINT = { vår: [170, 230, 190, 0.035], sommar: [255, 226, 150, 0.045], höst: [235, 160, 80, 0.06], vinter: [170, 190, 235, 0.06] };

  return {
    update() {
      const f = env.forceWeather;
      let w = weatherAt(env.day || 1, env.hour ?? 12, env.eventId || null);
      if (f) {
        const kind = f.kind || w.kind, season = f.season || w.season;
        w = { ...w, kind, season, intensity: f.intensity ?? (f.kind ? 0.8 : w.intensity) };
        w.cloud = f.kind ? (kind === 'sol' ? 0.15 : kind === 'moln' ? 0.6 + 0.4 * w.intensity : CLOUD[kind]) : w.cloud;
        if (f.snow !== undefined) w.snowCover = +f.snow;
        else if (f.kind === 'snö') { forcedSince ??= env.t; w.snowCover = clamp01(Math.max(w.snowCover, 0.35) + (env.t - forcedSince) * 0.02); } // lägger sig gradvis
        if (f.kind === 'regn') w.wet = Math.max(w.wet, 0.8);
        if (f.temp !== undefined) w.temp = f.temp;
        else if (f.season || f.kind) w.temp = Math.round(BASE_TEMP[season] + KIND_TEMP[kind]);
        const dir = w.wind < 0 ? -1 : 1;
        if (f.kind === 'blåst') w.wind = 70 * dir;
        else if (f.kind === 'regn') w.wind = dir * Math.max(Math.abs(w.wind), Math.round(16 + 12 * w.intensity));
        else if (f.kind === 'snö') w.wind = dir * Math.max(Math.abs(w.wind), Math.round(8 + 10 * w.intensity));
        if (f.wind !== undefined) w.wind = +f.wind;
        if (f.wet !== undefined) w.wet = +f.wet;
        w.thunder = f.thunder !== undefined ? +f.thunder : f.kind === 'regn' ? (w.intensity >= 0.7 ? 1 : 0) : w.thunder;
        if (f.kind === 'snö' && w.temp > 0) w.temp = -2;
      } else forcedSince = null;
      // levande delar (lokala): byar, blixtar, gyllene timmen
      const t = env.t;
      w.gust = +(1 + 0.25 * Math.sin(t * 0.63) + 0.15 * Math.sin(t * 1.7 + 1.3) + (w.kind === 'blåst' ? 0.2 * Math.sin(t * 3.1 + 0.4) : 0)).toFixed(3);
      w.windNow = Math.round(w.wind * w.gust);
      w.flash = f?.flash !== undefined ? +f.flash : w.kind === 'regn' && w.thunder ? +(flashAt(t) * (0.6 + 0.4 * w.intensity)).toFixed(3) : 0;
      // mullret: ett anrop per blixt (ljudet 'aska' finns inte i sound.js ännu – okänt namn är tyst)
      if (w.flash > 0.5 && !lastFlash) { try { env.play?.('aska'); } catch { /* ljudet är valfritt */ } }
      lastFlash = w.flash > 0.5;
      w.golden = w.kind === 'sol' ? +goldenAt(env.hour ?? 12).toFixed(3) : 0;
      w.label = weatherLabel(w);
      env.weather = w;
      env.rain = w.kind === 'regn';
    },

    drawBack(ctx, view) {
      const w = W();
      if (!w) return;
      const cover = clamp01(w.snowCover), q = Math.round(cover * 10), night = env.night;
      ctx.save();
      // molnskuggor (i solsken ritar ground.js sina egna – här bara de tunga molnen och blåstens jagande skuggor)
      if (env.dark < 0.4 && (w.kind === 'moln' || w.kind === 'blåst')) drawCloudShadows(ctx, view, w);
      if (q >= 1) drawSnowCover(ctx, view, w, q);
      // is på kanalen och dammen: vinterkyla, eller ett smältande täcke på våren
      const frozen = w.season === 'vinter' && w.temp <= 0, ice = frozen || cover > 0.25;
      if (ice) drawIce(ctx, view, w, Math.max(q, frozen ? 3 : 0), frozen ? clamp01(0.55 + cover * 0.5) : clamp01(cover * 1.6));
      if (w.wet > 0.15 && cover < 0.6) drawPuddles(ctx, view, w, night);
      if (w.kind === 'sol' && env.dark < 0.3) drawGlitter(ctx, view, w, ice, q);
      ctx.restore();
    },

    drawFront(ctx, view) {
      const w = W();
      if (!w) return;
      const k = w.intensity, vx = view.x, vy = view.y, vw = view.w, vh = view.h, day = env.dark < 0.5;
      ctx.save();
      // årstidens ton över hela bilden (dagtid; natten sköter mörkret)
      if (day) { const s = SEASON_TINT[w.season] || SEASON_TINT.sommar; ctx.fillStyle = rgba(s[0], s[1], s[2], s[3] * (1 - env.dark * 2)); ctx.fillRect(vx, vy, vw, vh); }
      // himlens ljus per väder
      if (w.kind === 'moln') { ctx.fillStyle = rgba(40, 48, 70, 0.06 + 0.1 * k); ctx.fillRect(vx, vy, vw, vh); }
      if (w.kind === 'regn') { ctx.fillStyle = rgba(36, 46, 72, 0.08 + 0.14 * k); ctx.fillRect(vx, vy, vw, vh); }
      if (w.kind === 'snö') { ctx.fillStyle = rgba(222, 230, 246, 0.05 + 0.08 * k); ctx.fillRect(vx, vy, vw, vh); }
      if (w.kind === 'blåst') { ctx.fillStyle = rgba(230, 226, 214, 0.03 + 0.03 * k); ctx.fillRect(vx, vy, vw, vh); }
      if (w.kind === 'sol' && day) {
        // varmt ljus, kallare på vintern, och den gyllene timmen morgon/kväll
        const warm = w.season === 'vinter' ? [255, 244, 224, 0.03] : [255, 214, 140, 0.045 + 0.035 * k * (1 - w.cloud)];
        ctx.fillStyle = rgba(warm[0], warm[1], warm[2], warm[3]); ctx.fillRect(vx, vy, vw, vh);
        if (w.golden > 0) { ctx.fillStyle = rgba(255, 160, 70, 0.09 * w.golden); ctx.fillRect(vx, vy, vw, vh); }
      }
      if (w.kind === 'regn') {
        drawRain(ctx, view, w, 1);
        // stänk där dropparna slår i
        const n = cnt(8 + 26 * k, view), s = Math.floor(env.t * 10);
        ctx.fillStyle = 'rgba(214,228,248,0.55)';
        for (let j = 0; j < n; j++) {
          const x = vx + Math.floor(hash(j, s, 3220) * vw), y = vy + Math.floor(hash(j, s, 3221) * vh);
          ctx.fillRect(x, y, 1, 1);
          if (hash(j, s, 3222) > 0.55) { ctx.fillRect(x - 1, y - 1, 1, 1); ctx.fillRect(x + 1, y - 1, 1, 1); }
        }
        if (w.flash > 0 && day) { ctx.fillStyle = rgba(236, 240, 255, 0.5 * w.flash); ctx.fillRect(vx, vy, vw, vh); }
      }
      if (w.kind === 'snö') drawSnowfall(ctx, view, w, 1);
      if (w.kind === 'dimma') drawFog(ctx, view, w, false);
      if (w.kind === 'blåst' || Math.abs(w.windNow || 0) > 46) drawWind(ctx, view, w, w.kind === 'blåst' ? 1 : 0.6);
      // blöt mark ger en svag kall ton även när det slutat regna
      if (w.wet > 0.2 && w.kind !== 'regn') { ctx.fillStyle = rgba(30, 44, 70, 0.05 * w.wet); ctx.fillRect(vx, vy, vw, vh); }
      ctx.restore();
    },

    // efter mörkret: det som ska synas även i natten
    glow(ctx, view) {
      const w = W();
      if (!w) return;
      const d = env.dark, vx = view.x, vy = view.y, vw = view.w, vh = view.h;
      ctx.save();
      if (w.kind === 'snö') drawSnowfall(ctx, view, w, 0.45 + 0.5 * d);
      if (w.kind === 'regn') {
        if (d > 0.2) drawRain(ctx, view, w, 0.35);
        if (w.flash > 0) { ctx.fillStyle = rgba(205, 220, 255, 0.5 * w.flash); ctx.fillRect(vx, vy, vw, vh); }
      }
      if (w.kind === 'dimma') drawFog(ctx, view, w, true);
      if (w.kind === 'blåst' && d > 0.25) drawWind(ctx, view, w, 0.4);
      ctx.restore();
    },
  };
}
