// 🌊 VATTENLANDET – kartan (stadsdel 7 i stadsdelsplanen, Carl 2026-11-18: "Vattenlandet: rutschkanor, vågpool, badvakt").
// En egen plats som Djurparken: vattenbussen går hit. Utanför staketet (x < STAKET): hållplatsen och ENTRÉHUSET med kassan.
// Innanför: PROMENADEN (ljusa plattor) runt tre bassänger – BARNPOOLEN (grund, med svampfontänen), VÅGPOOLEN (stor, med
// vågmaskinen i norr och trappan i söder) och LANDNINGSPOOLEN under RUTSCHTORNET med tre kanor (gul, blå, röd), var och en
// en bana av punkter som åkaren följer. OMKLÄDNINGSRUMMET (byt om till badkläder – krävs i vattnet), KIOSKEN, BADVAKTSTORNET,
// SOLSTOLARNA på trädäcket med parasoller, DUSCHARNA, palmer och gräsmattan längst i öster. Natt = stängt, poolerna lyser.
//
// Ritordning i scenen: himlen (skyCanvas) → kullarna bakom (kullCanvas, parallax) → marken (paintGround, en gång) →
// hus, kanor, folk, spelaren y-sorterade (deko.js) → vågorna/glittret per bildruta → kvällens mörker och ljusen.
import { Pix, mix, mul, hash, bayer } from '../core/floor-pix.js';
import { $t } from '../core/i18n.js';

export const TW = 1800, TH = 520;
export const G = { BASE: 150, TOP: 154, BOTTOM: 508 };                       // husens fot / gåbart område
export const STAKET = 230;                                                    // staketet mellan entrén och parken (x)
export const VANDKORS = { x: STAKET, y0: 290, y1: 330 };                      // vändkorset – öppet när man betalat
export const HALLPLATS = { x: 60, y: 470 };
export const ENTRE = { PRIS: 40, OPPET: [10, 19] };
export const KASSA = { x: 70, y: 150, w: 130, h: 60, lucka: { x0: 112, x1: 156 } };      // entréhuset (foten på y)
export const OMKLADNING = { x: 260, y: 150, w: 120, h: 58, door: { x0: 300, x1: 326 } };
export const KIOSK = { x: 1480, y: 150, w: 110, h: 54, lucka: { x0: 1506, x1: 1562 } };
export const TORN = { x: 1160, y: 150, w: 130, h: 118, topp: 32 };            // rutschtornet: foten på y, krönet på y - h
export const BARNPOOL = { x: 470, y: 300, rx: 92, ry: 40 };                   // ellips
export const SVAMP = { x: 470, y: 292 };
export const VAGPOOL = { x0: 640, y0: 186, x1: 1080, y1: 362, trappa: { x0: 660, x1: 704 } };   // trappan i sydvästra hörnet
export const LANDNING = { x0: 1140, y0: 300, x1: 1430, y1: 380, trappa: { x0: 1380, x1: 1420 } };
export const BADVAKT = { x: 1105, y: 420 };                                   // tornet står på promenaden söder om vågpoolen
export const SOLSTOLAR = [[330, 452], [400, 452], [470, 452], [540, 452], [860, 452], [930, 452], [1000, 452]];
export const PARASOLLER = [[365, 440], [505, 440], [895, 440], [965, 440]];
export const DUSCH = { x: 620, y: 470 };
export const PALMER = [[1470, 230], [1620, 300], [1740, 220], [1700, 440], [1540, 480], [250, 480], [20, 300], [120, 240]];
export const BANKAR = [[1520, 400], [1660, 360]];
export const PAPPERSKORGAR = [[400, 500], [1120, 500]];
export const SKYLT = { x: 160, y: 470 };
export const BLOMMOR = [[440, 180], [560, 180], [1120, 180]];
// de tre kanorna: start uppe i tornet (plattformens höjd), banan ner till landningspoolen (punkterna i världen)
export const KANOR = [
  { id: 'gul', namn: $t('Gula kanan'), c: 0xf0c030, cl: 0xffe070, cd: 0xb08010, tid: 2.6, glad: 1, hojd: 56, bana: [[1272, 112], [1320, 118], [1360, 150], [1370, 200], [1340, 250], [1300, 290], [1280, 322]] },
  { id: 'bla', namn: $t('Blå virveln'), c: 0x3a7bd5, cl: 0x7ab0f0, cd: 0x1e4a90, tid: 3.6, glad: 2, hojd: 84, bana: [[1272, 84], [1330, 86], [1390, 120], [1410, 170], [1380, 210], [1330, 220], [1300, 250], [1330, 290], [1340, 330]] },
  { id: 'rod', namn: $t('Röda tornadon'), c: 0xd8343c, cl: 0xf07a7a, cd: 0x8a1820, tid: 4.8, glad: 3, hojd: 112, bana: [[1272, 56], [1340, 50], [1420, 80], [1450, 140], [1420, 190], [1360, 200], [1310, 180], [1280, 210], [1300, 250], [1350, 270], [1390, 300], [1380, 338]] },
];
export const VAG = { LUGN: 42, VAGOR: 18 };                                   // vågpoolens cykel i sekunder: lugnt, sedan vågor
export const GLASS_PRIS = 15, POMMES_PRIS = 25, MELON_PRIS = 12;

const inEll = (x, y, e) => ((x - e.x) / e.rx) ** 2 + ((y - e.y) / e.ry) ** 2 <= 1;
export const iVagpool = (x, y) => x > VAGPOOL.x0 && x < VAGPOOL.x1 && y > VAGPOOL.y0 && y < VAGPOOL.y1;
export const iLandning = (x, y) => x > LANDNING.x0 && x < LANDNING.x1 && y > LANDNING.y0 && y < LANDNING.y1;
export const iBarnpool = (x, y) => inEll(x, y, BARNPOOL);

// gånghinder: lage 'torr' (promenaden; betalt = vändkorset öppet) eller 'vag' (simmar i vågpoolen)
export function hinder(lage = 'torr', betalt = false) {
  const o = [];
  if (lage === 'vag') {
    o.push([0, 0, TW, VAGPOOL.y0 + 10], [0, VAGPOOL.y1 - 6, TW, TH], [0, 0, VAGPOOL.x0 + 6, TH], [VAGPOOL.x1 - 6, 0, TW, TH]);
    return o;
  }
  o.push([0, 0, TW, G.BASE - 2]);
  for (const H of [KASSA, OMKLADNING, KIOSK, TORN]) { const d = H.door || { x0: H.x + H.w, x1: H.x + H.w }; o.push([H.x, H.y - 30, d.x0 - 1, H.y - 2], [d.x1 + 1, H.y - 30, H.x + H.w, H.y - 2]); }
  if (betalt) o.push([STAKET - 3, 0, STAKET + 3, VANDKORS.y0], [STAKET - 3, VANDKORS.y1, STAKET + 3, TH]);
  else o.push([STAKET - 3, 0, STAKET + 3, TH]);
  o.push([VAGPOOL.x0 - 8, VAGPOOL.y0 - 10, VAGPOOL.x1 + 8, VAGPOOL.y1 + 6]);
  o.push([LANDNING.x0 - 8, LANDNING.y0 - 10, LANDNING.x1 + 8, LANDNING.y1 + 6]);
  o.push([BARNPOOL.x - BARNPOOL.rx - 6, BARNPOOL.y - BARNPOOL.ry - 6, BARNPOOL.x + BARNPOOL.rx + 6, BARNPOOL.y + BARNPOOL.ry + 4]);
  o.push([BADVAKT.x - 12, BADVAKT.y - 10, BADVAKT.x + 12, BADVAKT.y + 2]);
  for (const [x, y] of SOLSTOLAR) o.push([x - 14, y - 6, x + 14, y + 2]);
  for (const [x, y] of PALMER) o.push([x - 5, y - 3, x + 6, y + 2]);
  for (const [x, y] of BANKAR) o.push([x - 15, y - 4, x + 16, y + 1]);
  for (const [x, y] of PAPPERSKORGAR) o.push([x - 4, y - 4, x + 5, y + 1]);
  o.push([DUSCH.x - 8, DUSCH.y - 4, DUSCH.x + 8, DUSCH.y + 2], [SKYLT.x - 8, SKYLT.y - 3, SKYLT.x + 8, SKYLT.y + 1]);
  return o;
}

// ---------------------------------------------------------------- kullarna bakom (parallax)
const BACK = new Map();
export function kullCanvas(night) {
  if (BACK.has(night)) return BACK.get(night);
  const w = 1200, h = 120, P = new Pix(w, h);
  const N = (c) => (night ? mix(mul(c, 0.4), 0x101634, 0.4) : c);
  for (let x = 0; x < w; x++) {
    const h1 = 50 + Math.round(Math.sin(x / 140) * 18 + Math.sin(x / 51 + 1) * 8), h2 = 34 + Math.round(Math.sin(x / 90 + 2) * 12 + Math.sin(x / 31) * 4);
    for (let y = h - h1; y < h; y++) { const u = (y - (h - h1)) / h1; P.px(x, y, N(mix(0x7ab070, 0x4a8050, u))); }
    for (let y = h - h2; y < h; y++) { const u = (y - (h - h2)) / h2; P.px(x, y, N(mix(0x3e8a46, 0x2a6a36, u))); if (hash(x >> 2, y >> 2, 7) > 0.86) P.px(x, y, N(0x1e5a2e)); }
    if (x % 97 === 40) for (let j = 0; j < 14; j++) P.px(x, h - h2 - j, N(0x3a2a1a));   // enstaka stammar i skogsbrynet
  }
  const cv = P.flush(); BACK.set(night, cv); return cv;
}

// ---------------------------------------------------------------- marken (en gång)
const vnoise = (x, y, s, cell) => {
  const gx = Math.floor(x / cell), gy = Math.floor(y / cell), sm = (t) => t * t * (3 - 2 * t), u = sm(x / cell - gx), v = sm(y / cell - gy);
  const a = hash(gx, gy, s), b = hash(gx + 1, gy, s), c = hash(gx, gy + 1, s), d = hash(gx + 1, gy + 1, s);
  return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
};
function water(P, x, y, d, deep, shallow, s) {   // d = 0 vid kanten … 1 mitt i
  let c = mix(shallow, deep, Math.min(1, d * 1.3) + (vnoise(x, y, s, 14) - 0.5) * 0.3);
  if (hash(x >> 2, y, s + 1) > 0.94 && (x + y) % 3 === 0) c = mix(c, 0xffffff, 0.3);
  P.px(x, y, c);
}
export function paintGround() {
  const P = new Pix(TW, TH);
  // gräs utanför staketet och på picknickängen i öster, promenadens plattor däremellan
  for (let y = G.BASE - 20; y < TH; y++) for (let x = 0; x < TW; x++) {
    const n = vnoise(x, y, 3, 40);
    const gras = x < STAKET - 20 ? y > 300 || y < G.BASE : x > 1440 && y > G.BASE;
    if (gras) { P.px(x, y, mix(0x4a8a3a, 0x6aa848, n + (hash(x, y, 4) - 0.5) * 0.3)); if (hash(x, y, 5) > 0.985) P.px(x, y, 0xf0e060); continue; }
    if (y < G.BASE) { P.px(x, y, mix(0x3e7a34, 0x58984a, n)); continue; }                                   // häcken bakom husen
    const fx = ((x + (((y / 16) | 0) & 1) * 16) % 32) === 31, fy = (y % 16) === 15;
    let c = mix(0xe8dcc0, 0xd8ccb0, vnoise(x, y, 6, 50) * 0.8 + (hash(x >> 2, y >> 2, 7) - 0.5) * 0.25 + (bayer(x, y) - 0.5) * 0.1);
    if (fx || fy) c = mul(c, 0.82);
    if (x < STAKET && y <= 300) c = mix(c, 0xc8bca0, 0.2);                                                      // entrégården
    if (vnoise(x, y, 8, 30) > 0.9) c = mix(c, 0x8ab0c8, 0.22);                                                  // blöta fläckar
    P.px(x, y, c);
  }
  // trädäcket med solstolarna: bräder på tvären
  for (const [x0, x1] of [[290, 590], [820, 1040]]) for (let y = 430; y < 486; y++) for (let x = x0; x < x1; x++) P.px(x, y, (y % 7 === 6) ? 0x8a6a40 : mix(0xc8a060, 0xb08850, hash(x >> 3, y, 9) * 0.6 + ((x % 40) === 0 ? 0.4 : 0)));
  // vågpoolen: kakelkant, djupt vatten mot vågmaskinen i norr, trappan i sydväst
  const kant = (x, y, k) => { const d = Math.min(x - VAGPOOL.x0, VAGPOOL.x1 - x, y - VAGPOOL.y0, VAGPOOL.y1 - y); return d < k; };
  for (let y = VAGPOOL.y0 - 6; y <= VAGPOOL.y1 + 4; y++) for (let x = VAGPOOL.x0 - 6; x <= VAGPOOL.x1 + 6; x++) {
    const inne = x >= VAGPOOL.x0 && x <= VAGPOOL.x1 && y >= VAGPOOL.y0 && y <= VAGPOOL.y1;
    if (!inne) { P.px(x, y, ((x + y) & 2) ? 0xf4f1ea : 0x7ab0d8); continue; }                                   // kaklet runt om
    if (kant(x, y, 4)) { P.px(x, y, 0x5a9ad0); continue; }
    const u = (y - VAGPOOL.y0) / (VAGPOOL.y1 - VAGPOOL.y0);
    water(P, x, y, 1 - u, 0x1a5aa0, 0x5ab0e0, 10);
    if ((x - VAGPOOL.x0) % 48 === 24 && y > VAGPOOL.y0 + 40 && (y & 2)) P.px(x, y, mix(P.get(x, y), 0x1e4a80, 0.5));   // bottenlinjerna
  }
  for (let y = VAGPOOL.y1 - 22; y <= VAGPOOL.y1; y++) for (let x = VAGPOOL.trappa.x0; x <= VAGPOOL.trappa.x1; x++) P.px(x, y, ((VAGPOOL.y1 - y) % 6 < 3) ? 0xcfe4f4 : 0x9ac4e8);   // trappstegen
  for (let x = VAGPOOL.x0; x <= VAGPOOL.x1; x++) for (let y = VAGPOOL.y0 - 16; y < VAGPOOL.y0 - 6; y++) P.px(x, y, (y === VAGPOOL.y0 - 16) ? 0x8a8a94 : (x % 12 < 6 ? 0x5a5a66 : 0x6a6a78));   // vågmaskinens vägg
  // landningspoolen under kanorna
  for (let y = LANDNING.y0 - 6; y <= LANDNING.y1 + 4; y++) for (let x = LANDNING.x0 - 6; x <= LANDNING.x1 + 6; x++) {
    const inne = x >= LANDNING.x0 && x <= LANDNING.x1 && y >= LANDNING.y0 && y <= LANDNING.y1;
    if (!inne) { P.px(x, y, ((x + y) & 2) ? 0xf4f1ea : 0xe0a040); continue; }
    const d = Math.min(x - LANDNING.x0, LANDNING.x1 - x, y - LANDNING.y0, LANDNING.y1 - y);
    if (d < 4) { P.px(x, y, 0x5a9ad0); continue; }
    water(P, x, y, Math.min(1, d / 40), 0x2a6ab0, 0x6ab8e4, 12);
  }
  for (let y = LANDNING.y1 - 16; y <= LANDNING.y1; y++) for (let x = LANDNING.trappa.x0; x <= LANDNING.trappa.x1; x++) P.px(x, y, ((LANDNING.y1 - y) % 6 < 3) ? 0xcfe4f4 : 0x9ac4e8);
  // barnpoolen: grund och ljus, med en bred kakelkant
  for (let y = BARNPOOL.y - BARNPOOL.ry - 5; y <= BARNPOOL.y + BARNPOOL.ry + 5; y++) for (let x = BARNPOOL.x - BARNPOOL.rx - 5; x <= BARNPOOL.x + BARNPOOL.rx + 5; x++) {
    const d = ((x - BARNPOOL.x) / BARNPOOL.rx) ** 2 + ((y - BARNPOOL.y) / BARNPOOL.ry) ** 2;
    if (d > 1.14) continue;
    if (d > 1) { P.px(x, y, ((x + y) & 2) ? 0xf4f1ea : 0xf07090); continue; }
    if (d > 0.9) { P.px(x, y, 0x8ac4e8); continue; }
    water(P, x, y, 1 - d, 0x4a98d0, 0x9ad8f0, 14);
  }
  // duschplattan och avloppet
  for (let y = DUSCH.y - 8; y <= DUSCH.y + 4; y++) for (let x = DUSCH.x - 14; x <= DUSCH.x + 14; x++) P.px(x, y, mix(0xa8b0b8, 0x8a9298, hash(x >> 1, y >> 1, 15) * 0.6));
  P.rect(DUSCH.x - 2, DUSCH.y - 2, 4, 3, 0x3a3a42);
  return P.flush();
}
export const OPPETTEXT = () => $t`Öppet ${ENTRE.OPPET[0]}–${ENTRE.OPPET[1]} · entré ${ENTRE.PRIS} kr`;
