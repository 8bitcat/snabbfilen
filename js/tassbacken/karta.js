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
import { qmix } from '../city/facade-kit.js';
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
  kafe: { id: 'kafe', namn: $t('KATTCAFÉ KURR'), x: 830, w: 160, h: 86, door: { x0: 900, x1: 920 } },
  trim: { id: 'trim', namn: $t('DJURTRIMMAREN'), x: 1020, w: 160, h: 96, door: { x0: 1088, x1: 1110 } },
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
// södra sidan i full prakt (v0.133, js/tassbacken/park.js): parklyktor, buskar, andhuset, påsautomaten, hundfontänen,
// picknickkorgen och rastgårdens vattenho och däck; rabatterna runt torget och bryggan målas i marken
export const PARKLAMPOR = [[292, 322], [694, 462], [1380, 368], [1530, 334], [880, 318]].map(([x, y]) => ({ x, y }));
export const BUSKAR = [[600, 382, 'rosa'], [520, 500, 'bla'], [1372, 330, 'rodo'], [1528, 452, 'rosa'], [1640, 420, 'rodo'], [240, 488, 'bla'], [880, 502, 'rodo']].map(([x, y, typ]) => ({ x, y, typ }));
export const PARKPRYL = [{ typ: 'ankhus', x: 512, y: 400 }, { typ: 'pasar', x: 1048, y: 318 }, { typ: 'hundfontan', x: 1100, y: 345 }, { typ: 'korg', x: 1336, y: 421 }, { typ: 'ho', x: 120, y: 352 }, { typ: 'dack', x: 180, y: 430 }];
export const RABATTER = [[1395, 350], [1505, 350], [1395, 420], [1505, 420]].map(([x, y]) => ({ x, y }));
export const SMATT = [
  { typ: 'brandpost', x: 250, y: T.SIDEWALK_N[1] - 4 }, { typ: 'brandpost', x: 1250, y: T.SIDEWALK_N[1] - 4 },
  { typ: 'korg', x: 700, y: T.SIDEWALK_S[1] - 3 }, { typ: 'korg', x: 1500, y: T.SIDEWALK_N[1] - 4 }, { typ: 'korg', x: 470, y: T.SIDEWALK_N[1] - 4 },
  { typ: 'kafebord', x: 858, y: T.BASE + 16 }, { typ: 'kafebord', x: 962, y: T.BASE + 16 },
  { typ: 'pudel', x: 1083, y: T.BASE + 4 }, { typ: 'pudel', x: 1116, y: T.BASE + 4 },   // pudelbuskarna vid trimmarens dörr (hus.js)
  { typ: 'tavla', x: 889, y: T.BASE + 7 },                                              // kattcaféets gatupratare
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
  for (const l of PARKLAMPOR) o.push([l.x - 2, l.y - 2, l.x + 3, l.y + 1]);
  for (const b of BUSKAR) o.push([b.x - 7, b.y - 3, b.x + 8, b.y + 1]);
  for (const p of PARKPRYL) if (p.typ !== 'ankhus' && p.typ !== 'korg' && p.typ !== 'dack') o.push([p.x - 4, p.y - 3, p.x + 5, p.y + 1]);
  for (const r of RABATTER) o.push([r.x - 11, r.y - 4, r.x + 12, r.y + 4]);
  for (const s of SMATT) o.push(s.typ === 'kafebord' ? [s.x - 8, s.y - 4, s.x + 9, s.y + 1] : s.typ === 'blomlada' ? [s.x - (s.w >> 1), s.y - 5, s.x + (s.w >> 1), s.y + 1] : [s.x - 3, s.y - 3, s.x + 4, s.y + 1]);
  return o;
}

// ---------------------------------------------------------------- backen (parallax bakom husen)
// En sluttning i tre terrasser (gråstensmurar) med små pastellhus: trä eller puts, tak med pannrader, skorstenar,
// fönster med vita bågar (tända på kvällen), dörrar med trappsteg, staket och grindar, träd, buskar, tvättlinor,
// växthus och gungor i trädgårdarna – och kyrktornet med urtavla, ljudluckor och en tass på flöjeln.
const BACKE = new Map();
export function backeCanvas(night) {
  if (BACKE.has(night)) return BACKE.get(night);
  const w = 1400, h = 120, P = new Pix(w, h);
  const N = (c) => (night ? mix(mul(c, 0.42), 0x101634, 0.3) : c);
  const px = (x, y, c) => { if (c != null) P.px(x, y, N(c)); }, rect = (x, y, ww, hh, c) => P.rect(x, y, ww, hh, N(c));
  for (let x = 0; x < w; x++) {
    const ridge = 26 + Math.sin(x / 110) * 10 + Math.sin(x / 37) * 3;
    for (let y = Math.round(ridge); y < h; y++) {
      let c = mix(0x5a9a46, 0x4a8a3a, hash(x >> 1, y >> 1, 3));
      if (y - ridge < 2) c = mix(c, 0x9ad07a, 0.4);
      else if (((x >> 3) + (y >> 2)) % 2 === 0) c = mix(c, 0x6aaa52, 0.22);   // klippta gräsmattor i ränder
      px(x, y, c);
    }
  }
  // terrassmurarna (gråsten med fogar och en ljus avtäckning) under varje husrad
  for (let row = 0; row < 3; row++) for (let x = 0; x < w; x++) { const y0 = 55 + row * 24; for (let j = 0; j < 4; j++) px(x, y0 + j, j === 0 ? 0xd0cabe : j === 3 ? 0x4e5a3e : (x + (j & 1) * 3) % 6 === 0 ? 0x6a665e : mix(0x9a948a, 0xb4aea2, hash(x >> 1, j, 51))); }
  // trapporna upp mellan terrasserna
  for (const sx of [120, 410, 690, 980, 1250]) for (let y = 34; y < h; y++) { rect(sx, y, 5, 1, (y >> 1) & 1 ? 0xc8c0b2 : 0x9a9488); px(sx - 1, y, 0x6a665e); }
  const PAST = [0xf4c8d0, 0xf8e4a0, 0xb8e0d0, 0xc8d4f4, 0xf4d8b8, 0xe8c8f0, 0xf4f1ea, 0xc85a4a];
  const TAK = [0xb84a3a, 0x5a5a66, 0x8a4a3a, 0x3a5a7a, 0x4a7a5a];
  const trad = (x, yb, r, s) => {
    px(x, yb - 1, 0x4a3420); px(x, yb - 2, 0x5a3a20); px(x, yb - 3, 0x5a3a20);
    for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) { const d = Math.hypot(i, j * 1.15); if (d > r + 0.3) continue; const v = 0.5 - i * 0.06 - j * 0.07 + (hash(x + i, j, s) - 0.5) * 0.3; px(x + i, yb - 3 - r + j, v > 0.62 ? 0x8ac85a : v > 0.42 ? 0x58a03a : v > 0.25 ? 0x3e7e2a : 0x2a5a1e); }
    if (hash(x, yb, s + 1) > 0.6) { const bc = [0xf4a8c8, 0xffffff, 0xd84a6a, 0xf8f0a0][(hash(x, s, 2) * 4) | 0]; for (let k = 0; k < 4; k++) px(x - r + 1 + ((hash(k, x, s) * r * 2) | 0), yb - 3 - r * 2 + 2 + ((hash(k, yb, s) * r * 1.6) | 0), bc); }
  };
  for (let row = 0; row < 3; row++) {
    const yb = 54 + row * 24;
    for (let x = 6 + row * 23; x < w - 40;) {
      const steg = 58 + ((hash(x, row, 5) * 30) | 0);
      const hw = 22 + ((hash(x, row, 6) * 14) | 0), hh = 12 + ((hash(x, row, 7) * 6) | 0), c = PAST[(hash(x, row, 8) * PAST.length) | 0], tc = TAK[(hash(x, row, 9) * TAK.length) | 0];
      const tra = hash(x, row, 12) > 0.45, top = yb - hh;
      // väggen: trä (stående panel med vita knutar) eller puts; skuggsidan till höger, skugga under takfoten
      for (let j = 0; j < hh; j++) for (let i = 0; i < hw; i++) { let k = c; if (tra && i % 3 === 2) k = mul(c, 0.9); if (i === hw - 1) k = mul(c, 0.78); if (j < 2) k = mul(k, 0.86); if (tra && (i === 0 || i === hw - 2)) k = 0xf4f1ea; px(x + i, top + j, k); }
      // taket: pannrader, takfot, skorsten (och ibland en takkupa)
      for (let j = 0; j < 8; j++) { const ww = hw + 4 - j * 2; if (ww <= 0) break; for (let i = 0; i < ww; i++) { const X = x - 2 + j + i; let k = tc; if (j % 2 === 1) k = mul(tc, 0.85); if ((X + j) % 4 === 0) k = mul(k, 0.9); if (i === 0) k = mix(k, 0xffffff, 0.15); if (i === ww - 1) k = mul(k, 0.7); px(X, top - 1 - j, j === 0 ? mul(tc, 0.62) : k); } }
      const sx = x + hw - 7; rect(sx, top - 7, 3, 5, 0x8a5a4a); px(sx, top - 7, 0xa87a6a); rect(sx - 1, top - 8, 5, 1, 0x5a4a44);
      if (hw > 30 && hash(x, row, 13) > 0.5) { const kx = x + 6, lit = night && hash(kx, row, 3) > 0.4; rect(kx, top - 5, 6, 4, c); px(kx + 5, top - 5, mul(c, 0.8)); for (let i = 0; i < 8; i++) px(kx - 1 + i, top - 6, mul(tc, 0.75)); P.px(kx + 2, top - 4, lit ? 0xf8d878 : N(0x4a6a90)); P.px(kx + 3, top - 4, lit ? 0xf8d878 : N(0x6a8ab0)); }
      // fönstren: vita bågar med mittpost och fönsterbänk – blomlådor under en del
      const dorrX = x + (hw >> 1) - 1;
      for (let i = x + 3; i < x + hw - 5; i += 7) {
        if (Math.abs(i + 2 - (dorrX + 1)) < 4) continue;
        const lit = night && hash(i, row, 4) > 0.42;
        rect(i, top + 3, 5, 6, 0xf4f1ea);
        for (let jj = 0; jj < 4; jj++) for (let ii = 0; ii < 3; ii++) P.px(i + 1 + ii, top + 4 + jj, lit ? (jj < 2 ? 0xffe8a0 : 0xf0b860) : night ? 0x1c2a44 : (jj === 0 ? 0x9ab8d8 : ii === 0 && jj === 1 ? 0xd0e4f4 : 0x5a7ca4));
        for (let jj = 0; jj < 4; jj++) px(i + 2, top + 4 + jj, 0xf4f1ea);
        rect(i - 1, top + 9, 7, 1, 0xd8d2c4);
        if (hash(i, row, 14) > 0.6) for (let ii = 0; ii < 5; ii++) px(i + ii, top + 10, (ii & 1) ? [0xd84a6a, 0xf8f0a0, 0xffffff][(hash(i, ii, 2) * 3) | 0] : 0x3e7e2a);
      }
      // dörren med karm och trappsteg (ibland ett litet skärmtak)
      rect(dorrX - 1, yb - 7, 5, 7, 0xf4f1ea); rect(dorrX, yb - 6, 3, 6, mul(c, 0.5)); px(dorrX + 2, yb - 3, 0xe8c050); rect(dorrX - 1, yb, 5, 1, 0xb0aa9e);
      if (hash(x, row, 15) > 0.5) for (let i = 0; i < 7; i++) px(dorrX - 2 + i, yb - 8, mul(tc, 0.8));
      // staketet framför (vitt eller brunt) med en öppning vid dörren
      const fc = hash(x, row, 16) > 0.5 ? 0xf4f1ea : 0x8a5a30;
      for (let i = x - 4; i < x + hw + 4; i++) { if (Math.abs(i - dorrX - 1) < 3) continue; px(i, yb - 2, fc); if (i % 2 === 0) { px(i, yb - 3, fc); px(i, yb - 1, fc); } }
      // trädgården fram till nästa hus: ett träd och en tvättlina, ett växthus, en gunga eller buskar
      const gx = x + hw + 6, ledigt = steg - hw - 10, g = hash(x, row, 17);
      if (ledigt > 10) {
        trad(gx + 4, yb, 4 + ((hash(x, row, 18) * 3) | 0), x + row);
        if (g < 0.3 && ledigt > 24) { const lx = gx + 11; for (let yy = yb - 6; yy < yb - 1; yy++) { px(lx, yy, 0x8a7a6a); px(lx + 10, yy, 0x8a7a6a); } for (let i = 1; i < 10; i++) px(lx + i, yb - 6, 0xd8d4ca); [0xf06aa0, 0x3a7bd5, 0xffffff].forEach((cc, k) => rect(lx + 2 + k * 3, yb - 5, 2, 2 + (k & 1), cc)); }
        else if (g < 0.5 && ledigt > 22) { const vx = gx + 12; for (let j = 0; j < 5; j++) for (let i = 0; i < 8; i++) px(vx + i, yb - 6 + j, j === 0 || i === 0 || i === 7 ? 0xd8e8e0 : (i + j) % 3 === 0 ? 0xc8e4d8 : 0x8ac8a8); for (let i = 1; i < 7; i++) px(vx + i, yb - 7 - (i < 4 ? i - 1 : 6 - i), 0xd8e8e0); }
        else if (g < 0.65 && ledigt > 20) { const s2 = gx + 12; for (let j = 0; j < 7; j++) { px(s2 + (j >> 1), yb - 1 - j, 0x3a7bd5); px(s2 + 8 - (j >> 1), yb - 1 - j, 0x3a7bd5); } for (let i = 3; i < 6; i++) px(s2 + i, yb - 7, 0x3a7bd5); px(s2 + 4, yb - 6, 0x8a7a6a); px(s2 + 4, yb - 5, 0x8a7a6a); rect(s2 + 3, yb - 4, 3, 1, 0xd84a3a); }
        else if (ledigt > 18) for (let k = 0; k < 3; k++) { const bx2 = gx + 11 + k * 4; for (let j = 0; j < 3; j++) for (let i = -1; i <= 1; i++) if (!(j === 2 && i)) px(bx2 + i, yb - 2 - j, hash(bx2 + i, j, 9) > 0.5 ? 0x3e7e2a : 0x58a03a); px(bx2, yb - 4, [0xd84a6a, 0xf8f0a0, 0xf4a8c8][k]); }
      }
      rect(x, yb + 1, hw, 1, 0x3a6a2e);
      x += steg;
    }
  }
  // kyrktornet på krönet: vit puts, urtavla, ljudluckor, ärgad kopparspira och en tass på flöjeln
  const kx = 820, ky = 40;
  for (let j = 0; j < 34; j++) for (let i = 0; i < 14; i++) px(kx + i, ky + j, i === 13 ? 0xc8c4b8 : i === 0 ? 0xffffff : j % 8 === 7 ? 0xe0dcd2 : 0xf4f1ea);
  for (let j = 0; j < 3; j++) rect(kx - 1, ky + j, 16, 1, j === 0 ? 0xffffff : 0xd8d4ca);
  for (let j = 0; j < 18; j++) { const half = Math.max(0, 8 - (j >> 1)); for (let i = -half; i < half; i++) px(kx + 7 + i, ky - 1 - j, (i + 20) % 3 === 0 ? 0x2a6a5a : i < -half + 2 ? 0x7ac8b0 : 0x4a8a7a); }
  for (let j = 0; j < 5; j++) for (let i = 0; i < 5; i++) { const d = Math.hypot(i - 2, j - 2); if (d < 2.6) px(kx + 5 + i, ky + 5 + j, d > 1.8 ? 0x2a2a30 : 0xfaf6ea); }
  px(kx + 7, ky + 6, 0x2a2a30); px(kx + 8, ky + 7, 0x2a2a30);
  for (const sx of [kx + 3, kx + 8]) for (let j = 0; j < 6; j++) for (let i = 0; i < 3; i++) px(sx + i, ky + 14 + j, j % 2 ? 0x2a3448 : 0x5a5a66);
  P.rect(kx + 5, ky + 24, 4, 6, night ? 0xf8d878 : N(0x6a8ab0)); px(kx + 7, ky + 24, 0xf4f1ea);
  rect(kx + 4, ky + 30, 6, 4, 0x6a4a2a);
  P.vl(kx + 7, ky - 24, 6, N(0x3a3a3e)); px(kx + 7, ky - 25, 0xd8b040);
  for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [-2, -2], [0, -3], [2, -2]]) px(kx + 7 + dx, ky - 28 + dy, 0xd8b040);   // tassen
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
  // trapporna upp i backen mellan husen: steg med ljus framkant, stenkinder, smidesräcke och krukor vid foten
  for (const sx of [292, 474, 812, 1002, 1194, 1394, 1548]) {
    for (let y = 104; y < T.BASE; y++) { const r = (y - 104) % 4; for (let x = sx; x < sx + 12; x++) P.px(x, y, r === 0 ? mix(0xd0c8bc, 0xc0b8ac, hash(x >> 2, y, 61)) : r === 3 ? 0x7a746a : mix(0xa8a094, 0x9a9488, hash(x >> 2, y, 62))); }
    for (let y = 104; y < T.BASE; y++) { P.px(sx - 2, y, 0x8a847a); P.px(sx - 1, y, 0xb8b0a4); P.px(sx + 12, y, 0x8a847a); P.px(sx + 13, y, 0x6a645c); }
    for (let y = 110; y < T.BASE - 2; y++) { P.px(sx + 1, y - 6, 0x2c323a); if ((y - 110) % 8 === 0) P.vl(sx + 1, y - 6, 6, 0x434b56); }
    for (const kx of [sx - 4, sx + 15]) { P.rect(kx - 1, T.BASE - 14, 4, 3, 0xc0602e); P.hl(kx - 2, T.BASE - 15, 6, 0xdc8048); for (const [i, j] of [[0, -1], [1, -2], [2, -1], [-1, -2], [1, -3], [3, -2]]) P.px(kx + i, T.BASE - 15 + j, j === -3 ? 0xf06aa0 : 0x3e7e2a); }
  }
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
  // bryggan ut i dammen (plank på stolpar) där grusgången slutar
  for (let y = 348; y < 382; y++) for (let x = 413; x < 428; x++) { const kant = x === 413 || x === 427; P.px(x, y, kant ? 0x5e3a20 : (y - 348) % 3 === 2 ? 0x6a4424 : mix(0xb8864c, 0xa0723c, hash(x >> 2, (y / 3) | 0, 63))); }
  for (const [px2, py2] of [[413, 368], [427, 368], [413, 381], [427, 381]]) { P.px(px2, py2 + 1, 0x3a2414); P.px(px2, py2 + 2, 0x3a2414); }
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
  // rabatterna runt torget: jord med en kant av gatsten, tulpaner i rader
  for (const r of RABATTER) for (let y = r.y - 5; y <= r.y + 5; y++) for (let x = r.x - 12; x <= r.x + 12; x++) {
    const d = Math.hypot((x - r.x) / 12.5, (y - r.y) / 5.5); if (d > 1) continue;
    if (d > 0.82) { P.px(x, y, mix(0x9a948a, 0xc0b8ac, hash(x >> 1, y, 64))); continue; }
    P.px(x, y, mix(0x5a3a22, 0x6e4a2c, hash(x, y, 65)));
  }
  RABATTER.forEach((r, i) => { const F = [[0xe0383c, 0xff7a6a], [0xf0c030, 0xfff08a], [0xf06aa0, 0xffb0d0], [0xffffff, 0xfff6e0]]; for (let y = r.y - 2; y <= r.y + 3; y += 2) for (let x = r.x - 9 + ((y - r.y) & 2 ? 1 : 0); x <= r.x + 8; x += 3) { if (Math.hypot((x - r.x) / 10, (y - r.y) / 4.2) > 1) continue; const [a, b] = F[(i + ((x - r.x + 30) / 3 | 0)) % 4]; P.px(x, y, 0x3e7e2a); P.px(x, y - 1, 0x2e6a26); P.px(x + 1, y - 1, 0x58a03a); P.px(x, y - 2, a); P.px(x + 1, y - 2, b); P.px(x, y - 3, a); P.px(x + 1, y - 3, mix(a, 0x000000, 0.15)); } });
  // picknickfilten (rutig) vid torget och tennisbollar i hundparken
  for (let y = 414; y < 425; y++) for (let x = 1306; x < 1331; x++) P.px(x, y, (((x - 1306) >> 2) + ((y - 414) >> 2)) % 2 ? 0xd8343c : 0xf4f1ea);
  for (let k = 0; k < 7; k++) { const x = 780 + ((hash(k, 1, 66) * 480) | 0), y = 340 + ((hash(k, 2, 66) * 140) | 0); P.rect(x, y, 2, 2, 0xd8e848); P.px(x, y, 0xf8ff98); }
  // blommor och tuvor i gräset
  const iGras = (x, y) => !(Math.hypot((x - DAMM.x) / DAMM.rx, (y - DAMM.y) / DAMM.ry) < 1.06 || Math.hypot(x - TORG.x, (y - TORG.y) * 1.4) < TORG.r + 1 || (x >= RASTGARD[0] && x < RASTGARD[2] && y >= RASTGARD[1] && y < RASTGARD[3]));
  for (let k = 0; k < 700; k++) { const x = (hash(k, 1, 21) * TW) | 0, y = 310 + ((hash(k, 2, 21) * (TH - 310)) | 0); if (iGras(x, y)) P.px(x, y, [0xf8f0a0, 0xffffff, 0xd84a6a, 0x8a5ad8, 0x2e6a26][k % 5]); }
  // backens gräs ovanför muren: blommor och små trädgårdslotter
  for (let k = 0; k < 200; k++) { const x = (hash(k, 3, 22) * TW) | 0, y = 104 + ((hash(k, 4, 22) * 70) | 0); P.px(x, y, [0xf8f0a0, 0xffffff, 0xd84a6a, 0xf4a8c8][k % 4]); }
  return P.flush();
}

// ---------------------------------------------------------------- husen
// Fasaderna målas i js/tassbacken/hus.js (v0.133: husen i full prakt – husBild, husLiv, husSken).
// husbildens övre vänstra hörn i världen
export const husPos = (id) => { const H = HUS[id]; return { x: H.x - 8, y: T.BASE + 4 - (H.h + 44) }; };
export { tass };
