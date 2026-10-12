// TASSBACKEN – kartan, marken och husen (Carl 2026-10-12: "bygg allting inklusive stadsdelarna").
// Djurens stadsdel väster om Linnéstaden: man går västerut på Pixelgatan förbi stadsgränsen
// (city.js) och kommer in i Tassbacken från ÖSTER – gatan (TASSGATAN) ligger på samma höjd som
// Pixelgatan (trottoarer 186–218 och 276–306, körbanan 218–276). Ett pixelkorn, ljuset från sydväst.
//
// Norr om gatan, från väster: DJURHEMMET Tassarnas hem, DJURKLINIKEN, UTSTÄLLNINGSHALLEN,
// KATTCAFÉ KURR, DJURTRIMMAREN Klipp & Klo och två bostadshus. Bakom husen stiger själva backen
// med små pastellhus (parallax). Söder om gatan: djurhemmets rastgård, DAMMEN med änderna,
// HUNDPARKEN med agilitybanan och TASSTORGET med kattstatyn som sprutar vatten; busshållplatsen
// TASSBACKEN (linjen till Marknadstorget). Tassavtryck i övergångsställena och på trottoarerna.
//
// Scenen (js/scenes/tassbacken.js) ritar: himlen + backen (parallax) → marken (paintGround, en gång)
// → husen, staketen, träden, djuren och folket y-sorterade → ljuset.
import { Pix, SMALL, BIG, text, textW, mix, mul, hash, bayer } from '../core/floor-pix.js';
import { WALLS, windowAt, signPlate, doorAt, jit, qmix } from '../city/facade-kit.js';
import { $t } from '../core/i18n.js';

export const TW = 1680, TH = 520;
export const T = {
  BASE: 186, SIDEWALK_N: [186, 218], ROAD: [218, 276], SIDEWALK_S: [276, 306],
  LANES: [244, 271], TOP: 182, BOTTOM: 512,
};
// husen på norra sidan (fasaden står på BASE, dörren x0–x1); open = går att gå in i
export const HUS = {
  hem: { id: 'hem', namn: $t('DJURHEMMET'), x: 70, w: 210, h: 86, door: { x0: 166, x1: 188 } },
  klinik: { id: 'klinik', namn: $t('DJURKLINIKEN'), x: 310, w: 150, h: 78, door: { x0: 372, x1: 398 } },
  hall: { id: 'hall', namn: $t('UTSTÄLLNINGSHALLEN'), x: 490, w: 310, h: 104, door: { x0: 628, x1: 662 } },
  kafe: { id: 'kafe', namn: $t('KATTCAFÉ KURR'), x: 830, w: 160, h: 78, door: { x0: 900, x1: 920 } },
  trim: { id: 'trim', namn: $t('DJURTRIMMAREN'), x: 1020, w: 160, h: 86, door: { x0: 1088, x1: 1110 } },
  bo1: { id: 'bo1', x: 1210, w: 170, h: 104, door: { x0: 1286, x1: 1302 } },
  bo2: { id: 'bo2', x: 1410, w: 120, h: 92, door: { x0: 1462, x1: 1476 } },
};
export const HUSLISTA = ['hem', 'klinik', 'hall', 'kafe', 'trim', 'bo1', 'bo2'];
// söder om gatan
export const RASTGARD = [60, 330, 270, 452];             // djurhemmets rastgård (staket, hundkojor)
export const DAMM = { x: 450, y: 404, rx: 128, ry: 50 };  // dammen (ellips)
export const PARK = [740, 326, 1290, 492];                // hundparken (vitt staket, grind mot gatan)
export const GRIND = [1000, 1036];                        // hundparkens grind (norra staketet)
export const TORG = { x: 1450, y: 384, r: 66 };           // Tasstorget (rund stenläggning)
export const STATY = { x: 1450, y: 384 };                 // kattstatyn med fontänen
export const HALLPLATS = { x: 1572, y: 300 };             // busshållplatsen TASSBACKEN (södra trottoaren)
export const SKYLT = { x: 1640, y: 212 };                 // ortsskylten TASSBACKEN (norra trottoaren, östra kanten)
export const OVERGANG = [600, 1120];                      // övergångsställena (tassar i stället för ränder)
// agilitybanan i hundparken: hinder (x, y, typ)
export const AGILITY = [
  { x: 800, y: 380, typ: 'hopp' }, { x: 860, y: 430, typ: 'tunnel' }, { x: 940, y: 372, typ: 'slalom' },
  { x: 1060, y: 446, typ: 'vipp' }, { x: 1140, y: 380, typ: 'ring' }, { x: 1210, y: 440, typ: 'hopp' },
];
// träden (stadens träd ur props.js propKit): i gräset söder om gatan, och i galler längs södra trottoaren
export const TRAD = [
  [1612, 178, 'ek'], [1556, 174, 'bjork'],
  [30, 322, 'lind'], [292, 470, 'korsbar'], [700, 330, 'bjork'], [712, 478, 'ek'], [1320, 340, 'lonn'], [1330, 470, 'korsbar'], [1560, 350, 'lind'], [1600, 476, 'bjork'], [1660, 340, 'korsbar'], [1250, 506, 'ek'], [40, 496, 'lonn'], [620, 500, 'lind'],
].map(([x, y, kind]) => ({ x, y, kind }));
export const GALLERTRAD = [120, 360, 560, 820, 1180, 1360].map((x, i) => ({ x, y: T.SIDEWALK_S[1] - 6, kind: i % 2 ? 'korsbar' : 'lind' }));
export const BANKAR = [{ x: 380, y: 470 }, { x: 520, y: 470 }, { x: 1400, y: 440 }, { x: 1500, y: 440 }, { x: 1290, y: 300 }];
// gatlyktorna (norra trottoaren vid kantstenen) och småsakerna på trottoarerna
export const LYKTOR = [40, 300, 560, 820, 1060, 1320, 1600].map((x) => ({ x, y: T.SIDEWALK_N[1] - 3 }));
export const SMATT = [
  { typ: 'brandpost', x: 250, y: T.SIDEWALK_N[1] - 4 }, { typ: 'brandpost', x: 1250, y: T.SIDEWALK_N[1] - 4 },
  { typ: 'korg', x: 700, y: T.SIDEWALK_S[1] - 3 }, { typ: 'korg', x: 1500, y: T.SIDEWALK_N[1] - 4 }, { typ: 'korg', x: 470, y: T.SIDEWALK_N[1] - 4 },
  { typ: 'kafebord', x: 858, y: T.BASE + 16 }, { typ: 'kafebord', x: 962, y: T.BASE + 16 },
  { typ: 'blomlada', x: 1046, y: T.BASE + 4, w: 24, cols: ['pink', 'white', 'purple'] }, { typ: 'blomlada', x: 1154, y: T.BASE + 4, w: 24, cols: ['pink', 'white', 'red'] },
  { typ: 'blomlada', x: 120, y: T.BASE + 4, w: 28, cols: ['red', 'white', 'yellow'] }, { typ: 'blomlada', x: 236, y: T.BASE + 4, w: 28, cols: ['red', 'white', 'yellow'] },
  { typ: 'skal', x: 930, y: T.BASE + 8 },
];

// gånghinder (fotavtryck)
export function hinder() {
  const o = [];
  for (const id of HUSLISTA) { const h = HUS[id]; o.push([h.x, T.BASE - 34, h.door.x0 - 1, T.BASE - 2], [h.door.x1 + 1, T.BASE - 34, h.x + h.w, T.BASE - 2]); }
  // gränderna mellan husen: backen (inte gåbar)
  o.push([0, 0, TW, T.BASE - 6]);
  // dammen (ellipsen som rader)
  for (let y = DAMM.y - DAMM.ry; y < DAMM.y + DAMM.ry; y += 4) { const w = DAMM.rx * Math.sqrt(Math.max(0, 1 - ((y + 2 - DAMM.y) / DAMM.ry) ** 2)); if (w > 2) o.push([DAMM.x - w, y, DAMM.x + w, y + 4]); }
  // staketen: rastgården (helt stängd tills djurhemmet öppnar) och hundparken (grind mot gatan)
  const fence = ([x0, y0, x1, y1], gap) => { for (const [ax, ay, bx, by] of [[x0, y0, x1, y0 + 3], [x0, y1 - 2, x1, y1 + 1], [x0, y0, x0 + 3, y1], [x1 - 3, y0, x1, y1]]) { if (gap && ay === y0) o.push([ax, ay, gap[0], by], [gap[1], ay, bx, by]); else o.push([ax, ay, bx, by]); } };
  fence(RASTGARD); fence(PARK, GRIND);
  for (const a of AGILITY) o.push([a.x - 12, a.y - 3, a.x + 12, a.y + 2]);
  o.push([STATY.x - 26, STATY.y - 8, STATY.x + 26, STATY.y + 9]);
  for (const t of TRAD) o.push([t.x - 4, t.y - 3, t.x + 5, t.y + 2]);
  for (const t of GALLERTRAD) o.push([t.x - 4, t.y - 3, t.x + 5, t.y + 2]);
  for (const b of BANKAR) o.push([b.x - 15, b.y - 4, b.x + 16, b.y + 1]);
  for (const l of LYKTOR) o.push([l.x - 2, l.y - 2, l.x + 3, l.y + 1]);
  for (const s of SMATT) o.push(s.typ === 'kafebord' ? [s.x - 8, s.y - 4, s.x + 9, s.y + 1] : s.typ === 'blomlada' ? [s.x - (s.w >> 1), s.y - 5, s.x + (s.w >> 1), s.y + 1] : [s.x - 3, s.y - 3, s.x + 4, s.y + 1]);
  return o;
}

// ---------------------------------------------------------------- backen (parallax bakom husen)
// En sluttning med små pastellhus i rader, trädgårdar, trappor och kyrktornet med en tass på flöjeln.
const BACKE = new Map();
export function backeCanvas(night) {
  if (BACKE.has(night)) return BACKE.get(night);
  const w = 1400, h = 120, P = new Pix(w, h);
  const N = (c) => (night ? mix(mul(c, 0.42), 0x101634, 0.3) : c);
  for (let x = 0; x < w; x++) {
    const ridge = 26 + Math.sin(x / 110) * 10 + Math.sin(x / 37) * 3;
    for (let y = Math.round(ridge); y < h; y++) {
      let c = mix(0x5a9a46, 0x4a8a3a, hash(x >> 1, y >> 1, 3));
      if (y - ridge < 2) c = mix(c, 0x9ad07a, 0.4);
      if ((y + Math.round(Math.sin(x / 40) * 3)) % 22 === 0) c = 0x3a6a2e;           // häckar längs terrasserna
      P.px(x, y, N(c));
    }
  }
  // husraderna på terrasserna: små hus med sadeltak i pastell
  const PAST = [0xf4c8d0, 0xf8e4a0, 0xb8e0d0, 0xc8d4f4, 0xf4d8b8, 0xe8c8f0, 0xf4f1ea];
  const TAK = [0xb84a3a, 0x5a5a66, 0x8a4a3a, 0x3a5a7a];
  for (let row = 0; row < 3; row++) {
    const yb = 54 + row * 24;
    for (let x = 6 + row * 23; x < w - 30; x += 58 + ((hash(x, row, 5) * 30) | 0)) {
      const hw = 22 + ((hash(x, row, 6) * 14) | 0), hh = 12 + ((hash(x, row, 7) * 6) | 0), c = PAST[(hash(x, row, 8) * PAST.length) | 0], tc = TAK[(hash(x, row, 9) * TAK.length) | 0];
      P.rect(x, yb - hh, hw, hh, N(c)); P.vl(x + hw - 1, yb - hh, hh, N(mul(c, 0.82)));
      for (let j = 0; j < 8; j++) { const ins = j; if (hw + 4 - ins * 2 <= 0) break; P.hl(x - 2 + ins, yb - hh - 1 - j, hw + 4 - ins * 2, N(j === 0 ? mul(tc, 0.7) : tc)); }
      for (let i = x + 3; i < x + hw - 4; i += 7) { P.rect(i, yb - hh + 3, 3, 4, night ? (hash(i, row, 4) > 0.45 ? 0xf8d878 : 0x2a3448) : 0x6a8ab0); }
      P.rect(x + (hw >> 1) - 1, yb - 5, 3, 5, N(mul(c, 0.55)));                                                  // dörren
      P.rect(x + hw - 7, yb - hh - 7, 3, 5, N(0x7a6a62)); P.hl(x + hw - 8, yb - hh - 8, 5, N(0x5a4a44));          // skorstenen
      P.hl(x - 1, yb, hw + 2, N(0x2e5a24));                                                                         // skuggan
      if (hash(x, row, 10) > 0.6) P.rect(x + hw + 3, yb - 6, 2, 6, N(0x5a3a1e));                             // en liten trädgårdsgrind/stolpe
      for (let k = 0; k < 4; k++) P.px(x + ((hash(k, x, 11) * hw) | 0), yb + 1, N([0xd84a6a, 0xf8f0a0, 0xffffff, 0x8a5ad8][k]));
    }
  }
  // kyrktornet på krönet med en tass på flöjeln
  const kx = 820, ky = 40;
  P.rect(kx, ky, 14, 34, N(0xf4f1ea)); P.vl(kx + 13, ky, 34, N(0xc8c4b8));
  for (let j = 0; j < 16; j++) { const half = Math.max(0, 8 - (j >> 1)); P.hl(kx + 7 - half, ky - 1 - j, half * 2, N(0x4a8a7a)); }
  P.rect(kx + 4, ky + 6, 6, 8, N(0x2a3448)); P.rect(kx + 5, ky + 18, 4, 5, night ? 0xf8d878 : N(0x6a8ab0));
  P.vl(kx + 7, ky - 22, 6, N(0x3a3a3e));
  for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [-2, -2], [0, -3], [2, -2]]) P.px(kx + 7 + dx, ky - 25 + dy, N(0xd8b040));   // tassen
  const cv = P.flush(); BACKE.set(night, cv); return cv;
}

// ---------------------------------------------------------------- marken (en gång)
const GRASS = [0x3e8a32, 0x4a9a3a, 0x58a842, 0x6ab84a];
// värdebrus 0–1 (bilinjärt mellan hash-punkter var cell:e pixel) – mjuka, organiska fläckar
function vnoise(x, y, s, cell) {
  const gx = Math.floor(x / cell), gy = Math.floor(y / cell), sm = (t) => t * t * (3 - 2 * t), u = sm(x / cell - gx), v = sm(y / cell - gy);
  const a = hash(gx, gy, s), b = hash(gx + 1, gy, s), c = hash(gx, gy + 1, s), d = hash(gx + 1, gy + 1, s);
  return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
}
const grass = (x, y, k = 0) => GRASS[Math.min(3, Math.max(0, Math.round(1.6 + (hash(x >> 1, y >> 1, 3) - 0.5) * 2 + k + (bayer(x, y) - 0.5))))];
// kullersten (som i Linnéstaden): rundade stenar i rader
function cobble(x, y, base = 0xa8a29a) {
  const r = Math.floor(y / 5), xx = x + (r & 1) * 3, c = Math.floor(xx / 6), rx = xx - c * 6, ry = y - r * 5;
  if (rx === 5 || ry === 4) return mix(base, 0x4a4640, 0.55);
  let k = mix(base, hash(c, r, 2) > 0.5 ? 0xc8c0b4 : 0x8a847c, hash(c, r, 3) * 0.5);
  if (ry === 0 || rx === 0) k = mix(k, 0xffffff, 0.1);
  return k;
}
// ett tassavtryck (trampdyna + fyra tår) centrerat i (x, y)
const TASS = ['.#.#.', '#...#', '.###.', '#####', '.###.'];
function tass(P, x, y, c, a = 1) { TASS.forEach((r, j) => { for (let i = 0; i < 5; i++) if (r[i] === '#') P.px(x - 2 + i, y - 2 + j, c, a); }); }
export function paintGround() {
  const P = new Pix(TW, TH);
  // backens nedersta del bakom husen (gräs, syns i gränderna) och gräset söder om gatan
  for (let y = 100; y < TH; y++) for (let x = 0; x < TW; x++) P.px(x, y, grass(x, y, y < T.BASE ? 0.25 : -0.05));
  // en mur längs backens fot (gråsten) och trappor upp mellan husen
  for (let x = 0; x < TW; x++) for (let y = T.BASE - 10; y < T.BASE; y++) P.px(x, y, mix(0x8a8680, 0xa8a49a, hash(x >> 2, y >> 1, 4)));
  for (const sx of [292, 474, 812, 1002, 1194, 1394, 1548]) for (let y = 104; y < T.BASE; y++) { const k = (y >> 2) & 1; P.rect(sx, y, 12, 1, k ? 0xb8b0a4 : 0x9a9488); }
  // trottoarerna: kullersten med en stig av tassavtryck
  for (const [y0, y1] of [T.SIDEWALK_N, T.SIDEWALK_S]) for (let y = y0; y < y1; y++) for (let x = 0; x < TW; x++) P.px(x, y, cobble(x, y, y === y0 || y === y1 - 1 ? 0x8a8478 : 0xa8a29a));
  for (let x = 30; x < TW; x += 26) { tass(P, x, T.SIDEWALK_N[0] + 12 + ((x / 26) & 1) * 6, 0xe8d8b0, 0.55); }
  // TASSGATAN: asfalt, kantlinjer och övergångsställen av stora vita tassar
  for (let y = T.ROAD[0]; y < T.ROAD[1]; y++) for (let x = 0; x < TW; x++) {
    let c = mix(0x4e4e56, 0x5c5c64, hash(x >> 1, y >> 1, 8));
    if (hash(x >> 4, y >> 3, 12) > 0.88) c = mul(c, 0.88);
    if (y === T.ROAD[0] + 1 || y === T.ROAD[1] - 2) c = 0xd8d8d0;
    if (Math.abs(y - (T.ROAD[0] + T.ROAD[1]) / 2) < 1 && (x % 24) < 12) c = 0xf0e0a0;
    P.px(x, y, c);
  }
  for (const ox of OVERGANG) for (let y = T.ROAD[0] + 8; y < T.ROAD[1] - 6; y += 12) { const big = ['..##..##..', '..##..##..', '##......##', '##.####.##', '..######..', '.########.', '.########.', '..######..']; big.forEach((r, j) => { for (let i = 0; i < 10; i++) if (r[i] === '#') P.px(ox - 5 + i + ((y / 12) & 1) * 8 - 4, y + j - 4, 0xf0f0e8); }); }
  // stigarna söder om gatan: grus till torget, till hundparkens grind och runt dammen
  const path = (x0, y0, x1, y1, w = 6) => { const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0)); for (let i = 0; i <= n; i++) { const x = x0 + (x1 - x0) * i / n, y = y0 + (y1 - y0) * i / n; for (let dy = -w; dy <= w; dy++) for (let dx = -w; dx <= w; dx++) if (dx * dx + dy * dy <= w * w) P.px(x + dx, y + dy, mix(0xd0c098, 0xb8a880, hash((x + dx) >> 1, (y + dy) >> 1, 27))); } };
  // raka grusgångar från trottoaren: till hundparkens grind, till torget och ner till dammen
  const grus = (x0, y0, x1, y1) => { for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const kant = x === x0 || x === x1 - 1; P.px(x, y, kant ? 0xa89870 : mix(0xd0c098, 0xb8a880, hash(x >> 1, y >> 1, 27))); } };
  grus(GRIND[0] + 2, T.SIDEWALK_S[1], GRIND[1] - 2, PARK[1] + 4); grus(1438, T.SIDEWALK_S[1], 1462, 330); grus(412, T.SIDEWALK_S[1], 428, 334);
  path(300, 330, 610, 330, 5); path(610, 330, 680, 470, 5); path(300, 330, 290, 470, 5); path(290, 470, 680, 470, 5);
  path(1300, 380, 1384, 384, 5);
  // hundparken: trampat gräs, en sandig agilityplan
  for (let y = PARK[1]; y < PARK[3]; y++) for (let x = PARK[0]; x < PARK[2]; x++) {
    // agilityplanen: sand med mjuka kanter (brus + avstånd till kanten), gräset runt om lite trampat
    const inre = Math.min(x - 770, 1250 - x, (y - 352) * 2, (470 - y) * 2) / 40, n = vnoise(x, y, 31, 16);
    const sand = inre + (n - 0.5) * 0.9 + (bayer(x, y) - 0.5) * 0.12 > 0.1;
    if (sand) { let c = mix(0xd8c498, 0xc8b488, hash(x >> 1, y >> 1, 32)); if (vnoise(x, y, 35, 6) > 0.72) c = mul(c, 0.93); if (hash(x, y, 36) > 0.985) c = 0x5a9a3a; P.px(x, y, c); }
    else if (vnoise(x, y, 33, 12) + (bayer(x, y) - 0.5) * 0.15 > 0.64) P.px(x, y, mix(0x6a9a4a, 0x8a9a5a, hash(x, y, 34)));
  }
  // rastgården: grus
  for (let y = RASTGARD[1]; y < RASTGARD[3]; y++) for (let x = RASTGARD[0]; x < RASTGARD[2]; x++) P.px(x, y, mix(0xc8b890, 0xb0a078, hash(x >> 1, y >> 1, 35)));
  // dammen: vatten med mörkare kant, stenar och näckrosblad
  for (let y = DAMM.y - DAMM.ry - 4; y <= DAMM.y + DAMM.ry + 4; y++) for (let x = DAMM.x - DAMM.rx - 4; x <= DAMM.x + DAMM.rx + 4; x++) {
    const d = Math.hypot((x - DAMM.x) / DAMM.rx, (y - DAMM.y) / DAMM.ry);
    if (d > 1.05) continue;
    if (d > 0.97) { P.px(x, y, mix(0x8a8478, 0xb0a898, hash(x >> 1, y >> 1, 36))); continue; }
    let c = qmix(0x5aa8d8, 0x2a6a9a, (y - (DAMM.y - DAMM.ry)) / (DAMM.ry * 2), x, y, 4);
    if (d > 0.88) c = mul(c, 0.82);
    if (((x * 3 + y * 7) % 41) === 0 && d < 0.8) c = mix(c, 0xffffff, 0.45);
    P.px(x, y, c);
  }
  for (const [lx, ly] of [[380, 380], [520, 420], [470, 372], [404, 430]]) { P.ell(lx, ly, 5, 3, 0x3a8a3a, 1, 1); P.px(lx + 2, ly - 1, 0x2a6a2a); if (lx % 3 === 0) { P.px(lx - 1, ly - 1, 0xf8c8d8); P.px(lx, ly - 2, 0xffffff); } }
  for (let k = 0; k < 26; k++) { const a = hash(k, 1, 37) * Math.PI * 2, x = DAMM.x + Math.cos(a) * DAMM.rx * 0.98, y = DAMM.y + Math.sin(a) * DAMM.ry * 0.98; if (Math.sin(a) < -0.2) continue; P.vl(x, y - 6, 6, 0x4a7a2a); P.rect(x, y - 8, 1, 3, 0x6a4a2a); }   // vass och kaveldun
  // Tasstorget: rund stenläggning med ett tassmönster runt fontänen
  for (let y = TORG.y - TORG.r; y <= TORG.y + TORG.r; y++) for (let x = TORG.x - TORG.r; x <= TORG.x + TORG.r; x++) {
    const d = Math.hypot(x - TORG.x, (y - TORG.y) * 1.4);
    if (d > TORG.r) continue;
    const ring = Math.floor(d / 6), ang = Math.floor((Math.atan2(y - TORG.y, x - TORG.x) + Math.PI) / (Math.PI * 2) * (8 + ring * 6));
    let c = mix(0xb8b0a4, 0xd0c8bc, hash(ring, ang, 38));
    if ((d % 6) < 1) c = 0x8a847a;
    if (d > TORG.r - 2) c = 0x8a847a;
    P.px(x, y, c);
  }
  for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; tass(P, TORG.x + Math.cos(a) * 44, TORG.y + Math.sin(a) * 30, 0x8a6a4a, 0.7); }
  // blommor och tuvor i gräset
  const iGras = (x, y) => !(Math.hypot((x - DAMM.x) / DAMM.rx, (y - DAMM.y) / DAMM.ry) < 1.06 || Math.hypot(x - TORG.x, (y - TORG.y) * 1.4) < TORG.r + 1 || (x >= RASTGARD[0] && x < RASTGARD[2] && y >= RASTGARD[1] && y < RASTGARD[3]));
  for (let k = 0; k < 700; k++) { const x = (hash(k, 1, 21) * TW) | 0, y = 310 + ((hash(k, 2, 21) * (TH - 310)) | 0); if (iGras(x, y)) P.px(x, y, [0xf8f0a0, 0xffffff, 0xd84a6a, 0x8a5ad8, 0x2e6a26][k % 5]); }
  // backens gräs ovanför muren: blommor och små trädgårdslotter
  for (let k = 0; k < 200; k++) { const x = (hash(k, 3, 22) * TW) | 0, y = 104 + ((hash(k, 4, 22) * 70) | 0); P.px(x, y, [0xf8f0a0, 0xffffff, 0xd84a6a, 0xf4a8c8][k % 4]); }
  return P.flush();
}

// ---------------------------------------------------------------- husen
const HUSBILD = new Map();
// sadeltak med pannor (överhäng 4 px)
function gableRoof(P, x, y, w, rise, c) {
  for (let j = 0; j < rise; j++) {
    const ins = Math.round(j * (w / 2 + 4) / rise), x0 = x - 4 + ins, ww = w + 8 - ins * 2;
    if (ww <= 0) break;
    for (let i = 0; i < ww; i++) { const X = x0 + i, Y = y - j; const r = j % 4, xx = X + ((j >> 2) & 1) * 2, rx = xx % 5; let k = mul(c, [1.12, 1.04, 0.96, 0.86, 0.7][rx]); if (r === 3) k = mul(k, 0.7); P.px(X, Y, jit(k, X, Y, 5, 0.05)); }
  }
  P.hl(x - 4, y, w + 8, mul(c, 0.55));
}
function flatRoof(P, x, y, w, c) { P.rect(x - 2, y - 4, w + 4, 4, c); P.hl(x - 2, y - 4, w + 4, mix(c, 0xffffff, 0.25)); P.hl(x - 2, y - 1, w + 4, mul(c, 0.6)); }
const wall = (P, x, y, w, h, kind, c, s) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) P.px(x + i, y + j, WALLS[kind](x + i, y + j, c, s)); };
export function husBild(id, night) {
  const key = `${id}|${night}`;
  if (HUSBILD.has(key)) return HUSBILD.get(key);
  const H = HUS[id], W = H.w + 16, HH = H.h + 44;
  const P = new Pix(W, HH);
  const ox = 8, gy = HH - 4, top = gy - H.h, dx = H.door.x0 - H.x + ox, dw = H.door.x1 - H.door.x0;
  const win = (x, y, w, h, o = {}) => windowAt(P, x, y, w, h, { night, lit: hash(x, y, 3) > 0.35, ...o });
  if (id === 'hem') {
    // Tassarnas hem: falurött trähus i två våningar med vita knutar, sadeltak och en stor tass på gaveln
    wall(P, ox, top + 14, H.w, H.h - 14, 'wood', 0xa8382a, 11);
    for (const x of [ox, ox + H.w - 3]) P.rect(x, top + 14, 3, H.h - 14, 0xf4f1ea);
    gableRoof(P, ox, top + 14, H.w, 26, 0x5a5a66);
    for (const wx of [ox + 12, ox + 36, ox + 162, ox + 186]) { win(wx, top + 24, 12, 14, { frame: 0xf4f1ea, curtain: 0xf4c8d0 }); win(wx, top + 50, 12, 14, { frame: 0xf4f1ea, curtain: 0xf8e4a0 }); }
    for (const wx of [ox + 66, ox + 130]) win(wx, top + 50, 12, 14, { frame: 0xf4f1ea, curtain: 0xb8e0d0 });
    doorAt(P, dx, gy - 26, dw, 26, 'door', 0x3a6a4a, night);
    P.rect(dx - 6, gy - 30, dw + 12, 3, 0xf4f1ea);
    signPlate(P, ox + H.w / 2, top + 30, $t('TASSARNAS HEM'), 0xf4f1ea, 0xa8382a);
    tass(P, ox + H.w / 2, top + 6, 0xf4f1ea);
    tass(P, dx + (dw >> 1), gy - 36, 0xf4f1ea);
  } else if (id === 'klinik') {
    // djurkliniken: vit puts, platt tak, grönt kors med en vit tass, glasdörrar och ett blått band
    wall(P, ox, top + 4, H.w, H.h - 4, 'plaster', 0xf0f0ec, 12);
    flatRoof(P, ox, top + 4, H.w, 0x8a929c);
    P.rect(ox, top + 40, H.w, 4, 0x3a7bd5); P.hl(ox, top + 40, H.w, 0x6aa8e8);
    for (const wx of [ox + 10, ox + 38, ox + 104, ox + 128]) win(wx, top + 14, 14, 18, { frame: 0xc8ccd4 });
    win(ox + 10, top + 52, 40, 22, { frame: 0xc8ccd4 }); win(ox + 104, top + 52, 38, 22, { frame: 0xc8ccd4 });
    doorAt(P, dx, gy - 28, dw, 28, 'slide', 0x8a929c, night);
    // korset
    const kx = ox + H.w / 2 - 9, ky = top + 10;
    P.rect(kx + 6, ky, 6, 18, 0x2a9a5a); P.rect(kx, ky + 6, 18, 6, 0x2a9a5a); tass(P, kx + 9, ky + 9, 0xffffff);
    signPlate(P, ox + H.w / 2, top + 30, $t('DJURKLINIK'), 0x2a9a5a, 0xffffff, { small: true });
  } else if (id === 'hall') {
    // utställningshallen: tegel, valvtak i ärgad koppar, höga välvda fönster och flaggor (flaggorna vajar i scenen)
    wall(P, ox, top + 22, H.w, H.h - 22, 'brick', 0xb86a4a, 13);
    for (let j = 0; j < 30; j++) { const half = Math.round(Math.sqrt(Math.max(0, 1 - (j / 30) ** 2)) * (H.w / 2 + 3)); for (let i = -half; i <= half; i++) { const X = ox + H.w / 2 + i, Y = top + 22 - j; P.px(X, Y, jit((i + 400) % 9 === 0 ? 0x3a7a6a : mix(0x5aa890, 0x4a988a, hash(X >> 2, Y, 14)), X, Y, 15, 0.06)); } }
    P.hl(ox - 3, top + 22, H.w + 6, 0x2a5a4a);
    for (const wx of [ox + 18, ox + 58, ox + 98, ox + 196, ox + 236, ox + 276]) {
      for (let j = 0; j < 40; j++) for (let i = 0; i < 20; i++) { const ry = j - 8, inside = j >= 8 || Math.hypot(i - 9.5, j - 8) < 10; if (!inside) continue; const X = wx + i, Y = top + 34 + j; P.px(X, Y, i === 0 || i === 19 || (j < 8 && Math.hypot(i - 9.5, j - 8) > 9) ? 0xf4f1ea : night ? (hash(wx, 0, 3) > 0.3 ? qmix(0xffe6a8, 0xf0a850, j / 40, X, Y, 3) : 0x1c2a44) : qmix(0xb8d4ec, 0x4e6e96, j / 40, X, Y, 4)); }
      P.vl(wx + 10, top + 36, 38, 0xf4f1ea); P.hl(wx + 1, top + 54, 18, 0xf4f1ea);
    }
    // portalen och skylten
    P.rect(dx - 8, gy - 40, dw + 16, 40, 0x8a4a32); doorAt(P, dx, gy - 32, dw, 32, 'door', 0x2a4a6a, night);
    signPlate(P, ox + H.w / 2, top + 26, $t('UTSTÄLLNINGSHALLEN'), 0x1e3a5a, 0xf8d860);
    P.rect(dx - 8, gy - 44, dw + 16, 4, 0xf4f1ea);
  } else if (id === 'kafe') {
    // kattcaféet: gul träpanel, randig markis, stora skyltfönster (katterna ritas i scenen) och kattöron på skylten
    wall(P, ox, top + 6, H.w, H.h - 6, 'wood', 0xf0c850, 16);
    flatRoof(P, ox, top + 6, H.w, 0x6a4a3a);
    for (const wx of [ox + 12, ox + 50, ox + 110, ox + 138]) win(wx, top + 14, 12, 12, { frame: 0xf4f1ea, curtain: 0xd84a6a });
    for (const [wx, ww] of [[ox + 6, 54], [ox + 100, 54]]) win(wx, gy - 30, ww, 24, { frame: 0x6a4a3a, lit: true });
    doorAt(P, dx, gy - 28, dw, 28, 'door', 0x6a4a3a, night);
    for (let i = 0; i < H.w + 8; i++) for (let j = 0; j < 8; j++) P.px(ox - 4 + i, gy - 40 + j, ((i >> 3) & 1) ? 0xf4f1ea : 0xe0a030);
    for (let i = 0; i < H.w + 8; i += 8) { P.px(ox - 4 + i + 3, gy - 32, 0xe0a030); P.px(ox - 4 + i + 4, gy - 32, 0xe0a030); }
    const s = signPlate(P, ox + H.w / 2, top + 30, $t('KATTCAFÉ KURR'), 0x3a2a2a, 0xf8d860);
    if (s) { const [sx, sy, sw] = s; for (const ex of [sx + 3, sx + sw - 9]) for (let j = 0; j < 5; j++) P.hl(ex + j, sy - 1 - j, 6 - j * 2 > 0 ? 6 - j * 2 : 1, 0x3a2a2a); }
  } else if (id === 'trim') {
    // djurtrimmaren Klipp & Klo: pastellrosa puts, vita lister, mintgrön dörr, ett runt "bubbelfönster" och saxskylten
    wall(P, ox, top + 6, H.w, H.h - 6, 'plaster', 0xf4b8c8, 17);
    flatRoof(P, ox, top + 6, H.w, 0xf4f1ea);
    P.rect(ox, top + 44, H.w, 3, 0xf4f1ea);
    for (const wx of [ox + 14, ox + 120]) win(wx, top + 14, 14, 16, { frame: 0xf4f1ea, curtain: 0xb8e0d0 });
    // bubbelfönstret (runt) med en hund i badet – ritas här; skyltfönstret med trimbordet
    const bx = ox + 70, by = top + 22;
    for (let j = -10; j <= 10; j++) for (let i = -10; i <= 10; i++) { const d = Math.hypot(i, j); if (d > 10) continue; P.px(bx + i, by + j, d > 8.6 ? 0xf4f1ea : night ? 0xf8d878 : qmix(0xb8e4f4, 0x6aa8d8, (j + 10) / 20, bx + i, by + j, 3)); }
    for (const [i, j, r] of [[-4, 3, 2], [3, 4, 3], [0, -4, 2], [5, -2, 1]]) for (let a = 0; a < 12; a++) P.px(bx + i + Math.round(Math.cos(a / 2) * r), by + j + Math.round(Math.sin(a / 2) * r), 0xffffff);
    win(ox + 8, gy - 32, 66, 26, { frame: 0xf4f1ea, lit: true });
    win(ox + 120, gy - 32, 32, 26, { frame: 0xf4f1ea, lit: true });
    doorAt(P, dx, gy - 30, dw, 30, 'door', 0x62c8a0, night);
    signPlate(P, ox + H.w / 2, top + 36, $t('KLIPP & KLO'), 0xf4f1ea, 0xd84a8a);
  } else if (id === 'bo1') {
    // bostadshus i mintgrön puts med balkonger (en katt solar på en av dem – ritas i scenen)
    wall(P, ox, top + 6, H.w, H.h - 6, 'plaster', 0xb8e0c8, 18);
    flatRoof(P, ox, top + 6, H.w, 0x6a6a72);
    for (let f = 0; f < 3; f++) for (const wx of [ox + 12, ox + 42, ox + 116, ox + 146]) win(wx, top + 14 + f * 28, 12, 14, { frame: 0xf4f1ea, curtain: [0xf4c8d0, 0xf8e4a0, 0xc8d4f4][(wx + f) % 3] });
    for (let f = 0; f < 2; f++) { const by = top + 32 + f * 28; P.rect(ox + 66, by, 38, 2, 0x8a8a92); for (let i = ox + 66; i < ox + 104; i += 3) P.vl(i, by - 8, 8, 0x5a5a62); P.hl(ox + 66, by - 8, 38, 0x5a5a62); for (let k = 0; k < 6; k++) P.px(ox + 68 + k * 6, by - 9, [0xd84a6a, 0xf8f0a0, 0xffffff][k % 3]); }
    doorAt(P, dx, gy - 24, dw, 24, 'door', 0x5a6a8a, night);
  } else {
    // bo2: ljusblått trähus med vita lister och sadeltak
    wall(P, ox, top + 16, H.w, H.h - 16, 'wood', 0x8ab4d8, 19);
    for (const x of [ox, ox + H.w - 3]) P.rect(x, top + 16, 3, H.h - 16, 0xf4f1ea);
    gableRoof(P, ox, top + 16, H.w, 22, 0xb84a3a);
    for (const wx of [ox + 12, ox + 34, ox + 80, ox + 100]) { win(wx, top + 26, 10, 12, { frame: 0xf4f1ea, curtain: 0xf4f1ea }); win(wx, top + 50, 10, 12, { frame: 0xf4f1ea, curtain: 0xf4c8d0 }); }
    doorAt(P, dx, gy - 24, dw, 24, 'door', 0xf4f1ea, night);
  }
  // mörk kontur runt huset
  const out = new Pix(W, HH);
  for (let y = 0; y < HH; y++) for (let x = 0; x < W; x++) {
    if (P.d[(y * W + x) * 4 + 3]) { out.px(x, y, P.get(x, y)); continue; }
    if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([ddx, ddy]) => { const xx = x + ddx, yy = y + ddy; return xx >= 0 && yy >= 0 && xx < W && yy < HH && P.d[(yy * W + xx) * 4 + 3]; })) out.px(x, y, 0x1e1a24);
  }
  const cv = out.flush();
  HUSBILD.set(key, cv);
  return cv;
}
// husbildens övre vänstra hörn i världen
export const husPos = (id) => { const H = HUS[id]; return { x: H.x - 8, y: T.BASE + 4 - (H.h + 44) }; };
export { tass };
