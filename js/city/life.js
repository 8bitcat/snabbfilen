// Stadslivet i Pixelstaden (v2 – hela världen): fotgängare med hundar, kassar,
// paraplyer, sällskap och joggare, folk som sitter på bänkarna och väntar på
// bussen i kurerna, barn på lekplatserna, ungdomar som hänger vid kiosken i
// förorten, hundar som nosar, skäller och viftar på svansen (och springer lösa
// i hundrastgården), duvor, måsar, kråkor, småfåglar i buskarna, fågelflockar,
// ekorrar i träden, änder i dammen, svanar i kanalen, katter, fjärilar,
// eldflugor och snögubbar på vintern. Allt i samma pixelkorn som resten av
// staden (1 enhet = 1 spelpixel). Alla småfigurer målas EN gång till cachade
// canvasar – per bildruta blir det bara drawImage/fillRect.
//
// Fotgängarna går på ett eget gångnät över hela världen (4000 × 820): gånglinjer
// på bakgatan, trottoarerna, promenaden, parkgången, kajen, noder i alla gränder,
// vid alla dörrar (även de fristående husens), övergångsställena (även Infartens
// och Södergatans), lekplatserna, hundrastgården, parkeringen och grusplanen.
// v3 (staden på längden): DOWNTOWN har Finanstorget (ringar kring tjuren och
// fontänerna, två tvärstråk) och kostymfolk – kavaj/dräkt, portfölj, kaffe i handen
// och telefonen mot örat; kontorsfolket går in på morgonen och ut på kvällen.
// Gånglinjerna bryts vid floden och fortsätter bara över STORA BRON och JÄRNBRON
// (där man stannar vid räcket och tittar ut över vattnet); kajerna längs floden är
// en egen promenad (norr–söder) med måsar, och i floden mellan broarna simmar svanar.
// Kanterna mellan noderna räknas ut EN gång mot hindren på ett 2-px-rutnät; per
// figur blir det en liten Dijkstra (binär hög) över nätet när den väljer ett
// nytt mål. Vägen korsas bara vid övergångsställena och bara när
// traffic.pedGreen(i) är sann.
//
// Vädret (env.weather): paraplyer och regnställ i regn, vinterkläder, mössor och
// halsdukar när det är kallt, shorts och solglasögon när det är varmt, snögubbar
// när snön ligger, färre människor ute i ösregn, snöstorm och dimma.
//
// Kontrakt (se docs/STADEN.md):
//   createLife(env, traffic, props?) → { items(), update(dt), positions(), glow(ctx), obstacles }
//   props (valfritt, annars env.props): props.seats() ger bänkarnas och kurernas platser
//   { id, x, y, dir, walk: {x, y}, stop?, broken?, bench } – saknas den räknar livet ut
//   platserna själv ur hindren. Extra: busySeats() → Set med upptagna plats-id,
//   seatBusy(id), dogs() (för tools/dog-test.mjs), _debug.
import * as MAP from './map.js';
import { drawPerson, makeLook, isValid } from '../core/people.js';
import { Pix, mix, mul, hash } from '../core/floor-pix.js';

// ---------- kartan (tåligt: allt som saknas får ett v1-värde) ----------
const CITY = MAP.CITY;
const inRect = MAP.inRect || ((x, y, r) => x >= r[0] && x < r[2] && y >= r[1] && y < r[3]);
const baseOf = MAP.baseOf || ((b) => b.base ?? CITY.BASE);
const doorCenter = MAP.doorCenter || ((b) => ({ x: (b.door.x0 + b.door.x1) / 2, y: baseOf(b) + 12 }));
const BUILDINGS = MAP.BUILDINGS || [];
const ALL_B = MAP.ALL_BUILDINGS || BUILDINGS;
const STREETS_ALL = MAP.STREETS_ALL || MAP.STREETS || [];
const CROSS_ALL = MAP.CROSSWALKS_ALL || MAP.CROSSWALKS || [];
const PARK = MAP.PARK_LAYOUT || { plaza: { cx: 934, cy: 366, r: 42 }, promenade: [20, 334, 1680, 346], paths: [] };
const SUB = MAP.SUB_LAYOUT || { paths: [] };
const PATHS = MAP.PATHS || (MAP.PATH_RECTS || []).map((rect) => ({ rect, kind: 'grus' }));
const LOTS = MAP.LOTS || [];
const BUS_STOPS = MAP.BUS_STOPS && MAP.BUS_STOPS.length ? MAP.BUS_STOPS
  : [{ id: 'pixeltorget', name: 'PIXELTORGET', x: MAP.BUS_STOP.x, y: MAP.BUS_STOP.y, road: 'pixelgatan', lane: 1 }];
const districtAt = MAP.districtAt || (() => null);
const byId = (id) => ALL_B.find((b) => b.id === id) || null;

const WALK_SEQ = [1, 3, 2, 3];
const CW = CITY.W, CH = CITY.H, BASE = CITY.BASE;
const LX = CITY.X0 || 0;                                // (v4) världens västra kant (Linnéstaden ligger i x LX–0)
const LIN = MAP.LINNE_LAYOUT || null;
const VW = CITY.VIEW_W, VH = CITY.VIEW_H;
const midOf = (a, d) => (a ? Math.round((a[0] + a[1]) / 2) : d);
const ROAD_N = CITY.ROAD, ROAD_S = CITY.ROAD_S || [CITY.ROAD[0] + 454, CITY.ROAD[1] + 454];
const XI = CITY.INFARTEN || [1700, 1752];
const X_SUB = CITY.X_SUB || XI[1];
const SDX = CITY.SUB_DX || 0;                          // v3: förortens fasta platser nedan står i v2-x + SDX
// v3: downtown (finanskvarteret) och floden med broarna
const RIV = MAP.RIVER || null;
const BRIDGES = MAP.BRIDGES || [];
const DTL = MAP.DOWNTOWN_LAYOUT || null;
const DT0 = CITY.X_DT || XI[1], DT1 = RIV ? RIV.x0 : DT0;   // downtown: x 1752–2400
const inWater = (x, y) => !!RIV && RIV.water.some((r) => x >= r[0] && x < r[2] && y >= r[1] && y < r[3]);
// finns plagget/väskan i figurmotorn? (nya plagg kommer successivt – annars ett äldre)
const hasLook = (field, v) => { try { return isValid(field, v); } catch { return false; } };
// gånglinjerna (fotpunkternas y)
const Y_BACK = 22, Y_N = 203, Y_S = 291, Y_PROM = 340;
const Y_BKS = midOf(CITY.BACK_S, 476);                 // parkgången bakom den södra raden
const Y_SN = midOf(CITY.SIDEWALK_SN, 656);             // trottoaren framför de södra husen
const Y_SS = (CITY.SIDEWALK_SS ? CITY.SIDEWALK_SS[0] : 730) + 7;   // bortre trottoaren (nära kanten – bänkarna står mot kanalen)
const Y_Q = (CITY.QUAY ? CITY.QUAY[0] : 760) + 7;      // kajen
const WALK_BOTTOM = CITY.WALK_BOTTOM ?? CH - 4;
const CURB_N = ROAD_N[0] - 4, CURB_S = ROAD_N[1] + 5;
const CURB_SN = ROAD_S[0] - 4, CURB_SS = ROAD_S[1] + 5;
const DOOR_H = 34; // dörröppningens höjd i v1-husen – figurerna klipps mot den när de går in/ut
const doorH = (b) => (BUILDINGS.includes(b) ? DOOR_H : b.row === 'f' ? Math.max(18, Math.min(26, (b.h || 30) - 4)) : 30);

// ---------- små hjälpare ----------
const rnd = Math.random;
const rr = (a, b) => a + rnd() * (b - a);
const ri = (a, b) => Math.floor(a + rnd() * (b - a + 1));
const pick = (a) => a[Math.floor(rnd() * a.length)];
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
function wpick(list) {
  let s = 0;
  for (const [, w] of list) s += w;
  let r = rnd() * s;
  for (const [v, w] of list) { r -= w; if (r <= 0) return v; }
  return list[list.length - 1][0];
}
const headingDir = (hx, hy) => (Math.abs(hx) > Math.abs(hy) * 0.8 ? (hx < 0 ? 'left' : 'right') : hy < 0 ? 'up' : 'down');
const faceTo = (dx, dy) => headingDir(dx, dy);
const safe = (fn, fb) => { try { return fn(); } catch { return fb; } };

// ---------- ställena: hur ofta man går dit, hur länge man stannar, vad man bär ut ----------
// eve = mest på kvällen, warm = bara när det är varmt, dog = hundägare går gärna dit
const PLACES = {
  mat: { w: 5, stay: [8, 20], carry: [['kasse', 0.75]] },
  klader: { w: 2.2, stay: [8, 18], carry: [['pase', 0.65]] },
  mobler: { w: 2.2, stay: [14, 30], carry: [['kartong', 0.35], ['frakt', 0.5]] },
  burgare: { w: 2.2, stay: [8, 22], carry: [['burgare', 0.5]] },
  bostad: { w: 0.6, stay: [6, 14], carry: [] },
  frukt: { w: 0.8, stay: [6, 16], carry: [['frukt', 0.45]] },
  flyg: { w: 1.2, stay: [6, 14], carry: [['resvaska', 0.6]] },
  kafe: { w: 1.8, stay: [10, 26], carry: [['kaffe', 0.55]] },
  pizzeria: { w: 2, stay: [8, 20], carry: [['pizza', 0.6]] },
  posten: { w: 1.6, stay: [8, 20], carry: [['paket', 0.6]] },
  djuraffar: { w: 1.3, stay: [8, 20], carry: [['pase', 0.5]], dog: 3 },
  bio: { w: 1.2, stay: [30, 80], carry: [], eve: true },
  kyrka: { w: 0.4, stay: [20, 60], carry: [] },
  vardcentral: { w: 0.7, stay: [20, 50], carry: [] },
  bensinmack: { w: 1, stay: [6, 14], carry: [['kaffe', 0.35], ['kasse', 0.25]] },
  narbutik: { w: 3, stay: [5, 12], carry: [['kasse', 0.7]] },
  pantbank: { w: 0.4, stay: [8, 20], carry: [] },
  kebab: { w: 1.6, stay: [8, 18], carry: [['burgare', 0.6]] },
  tvatteri: { w: 1, stay: [10, 30], carry: [['tvatt', 0.65]] },
  kiosk: { w: 2.2, stay: [3, 8], carry: [['glass', 0.9]], warm: true }, // glasståndet (förr kiosken)
  toalett: { w: 0.35, stay: [5, 12], carry: [] },
  // DOWNTOWN (v3): banken, butikerna och kontorstornen (kontoren: office = kostymfolkets arbetsplats)
  bank: { w: 1.4, stay: [10, 30], carry: [], suit: 2 },
  elektronik: { w: 2.2, stay: [14, 34], carry: [['elpase', 0.5], ['tvlada', 0.14]] },
  skor: { w: 1.5, stay: [10, 26], carry: [['skokasse', 0.62]] },
  frisor: { w: 1, stay: [30, 70], carry: [], hair: true },
  accessoarer: { w: 1.3, stay: [8, 22], carry: [['smyckespase', 0.55]], sun: true },
  kontor1: { w: 0.5, stay: [60, 200], carry: [], office: true },
  kontor2: { w: 0.5, stay: [60, 200], carry: [], office: true },
  kontor3: { w: 0.5, stay: [60, 200], carry: [], office: true },
  kontor4: { w: 0.5, stay: [60, 200], carry: [], office: true },
};
// bostadshusen: folk kommer ut ur dem och går hem igen
const HOMES = ['hem', 'radhus', 'tornhuset', 'hoghus', 'hoghus2', 'lamell', 'husvagn'];
// kontorstornen i downtown: kostymfolket går in på morgonen och kommer ut på eftermiddagen
const OFFICES = ['kontor1', 'kontor2', 'kontor3', 'kontor4'];
const isOpen = (b, h) => !b.open || (h >= b.open[0] && h < b.open[1]) || (b.open[1] > 24 && h < b.open[1] - 24);
// butiker man kan fönstershoppa vid (norra och södra raden)
const WINDOW_SHOPS = ['bostad', 'mat', 'klader', 'mobler', 'kafe', 'burgare', 'frukt', 'pizzeria', 'posten', 'djuraffar', 'bio', 'narbutik', 'pantbank',
  'elektronik', 'skor', 'frisor', 'accessoarer'];
const enterable = (b) => b && b.door && b.door.type !== 'boarded' && b.door.type !== 'roll';

// =====================================================================
//  Sprites – pixelkartor och små målare, cachade canvasar
// =====================================================================
const mkCanvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };

// Mörk kontur runt allt som är ritat (samma recept som personerna i people.js)
function outline(d, w, h) {
  const src = new Uint8ClampedArray(d);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4;
    if (src[i + 3]) continue;
    let best = -1;
    for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
      const xx = x + dx, yy = y + dy;
      if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
      const j = (yy * w + xx) * 4;
      if (src[j + 3] > 200) { best = j; if (dy === -1) break; }
    }
    if (best < 0) continue;
    d[i] = src[best] * 0.28 + 14; d[i + 1] = src[best + 1] * 0.24 + 10; d[i + 2] = src[best + 2] * 0.3 + 20; d[i + 3] = 255;
  }
}
// Pixelkarta → canvas. Varje tecken slås upp i paletten; '.' och okända = genomskinligt.
// Med kontur får bilden 1 px marginal runt om.
function fromMap(rows, pal, line = true) {
  const m = line ? 1 : 0;
  const w = Math.max(...rows.map((r) => r.length)) + m * 2, h = rows.length + m * 2;
  const c = mkCanvas(w, h), x = c.getContext('2d'), img = x.createImageData(w, h), d = img.data;
  rows.forEach((row, j) => {
    for (let i = 0; i < row.length; i++) {
      const col = pal[row[i]];
      if (col === undefined) continue;
      const k = ((j + m) * w + i + m) * 4;
      d[k] = (col >> 16) & 255; d[k + 1] = (col >> 8) & 255; d[k + 2] = col & 255; d[k + 3] = 255;
    }
  });
  if (line) outline(d, w, h);
  x.putImageData(img, 0, 0);
  return c;
}
function fromPix(P, line = true) { if (line) outline(P.d, P.w, P.h); return P.flush(); }
// spegelvänd kopia (pixel för pixel – aldrig ctx.scale)
function flipX(c) {
  const w = c.width, h = c.height, s = c.getContext('2d').getImageData(0, 0, w, h).data;
  const n = mkCanvas(w, h), x = n.getContext('2d'), img = x.createImageData(w, h), d = img.data;
  for (let y = 0; y < h; y++) for (let i = 0; i < w; i++) {
    const a = (y * w + i) * 4, b = (y * w + (w - 1 - i)) * 4;
    d[b] = s[a]; d[b + 1] = s[a + 1]; d[b + 2] = s[a + 2]; d[b + 3] = s[a + 3];
  }
  x.putImageData(img, 0, 0);
  return n;
}
function flipY(c) {
  const w = c.width, h = c.height, s = c.getContext('2d').getImageData(0, 0, w, h).data;
  const n = mkCanvas(w, h), x = n.getContext('2d'), img = x.createImageData(w, h), d = img.data;
  for (let y = 0; y < h; y++) for (let i = 0; i < w; i++) {
    const a = (y * w + i) * 4, b = ((h - 1 - y) * w + i) * 4;
    d[b] = s[a]; d[b + 1] = s[a + 1]; d[b + 2] = s[a + 2]; d[b + 3] = s[a + 3];
  }
  x.putImageData(img, 0, 0);
  return n;
}
const pairOf = (c) => ({ r: c, l: flipX(c), w: c.width, h: c.height });

// ---------- markfåglar (vända åt höger; vänster speglas) ----------
// Duvor och kråkor delar kroppsform, måsarna och småfåglarna har egna.
const PIG_VARIANTS = [
  { H: 0x8e97ab, h: 0xb6bece, B: 0x8a93a6, L: 0xaab3c4, D: 0x68708a, W: 0xa0a8ba, w: 0x7c8498, x: 0x2e3244, T: 0x5d6578, t: 0x2b2f3e, g: 0x5aae8a, p: 0xa06cb8 },
  { H: 0x5e6474, h: 0x7c8494, B: 0x5a6070, L: 0x767d8e, D: 0x454a58, W: 0x6c7282, w: 0x4a5060, x: 0x202230, T: 0x3c404c, t: 0x1e2028, g: 0x4e9a7a, p: 0x8a5aa0 },
  { H: 0xe6e4de, h: 0xffffff, B: 0xe0ddd6, L: 0xf4f2ec, D: 0xc2beb4, W: 0xeae8e2, w: 0xcecac0, x: 0xa29e94, T: 0xc6c2b8, t: 0x98948a, g: 0xcfe0d6, p: 0xe0d2e6 },
  { H: 0x9a8474, h: 0xbca696, B: 0x9a8676, L: 0xb8a494, D: 0x786456, W: 0xaa9686, w: 0x846e5e, x: 0x3a2e28, T: 0x6a5648, t: 0x352a24, g: 0x6aa888, p: 0x9a6a9a },
];
const PIG_COMMON = { e: 0xf08a2a, c: 0xefe9dc, b: 0x4a4448, f: 0xd9667a };
// kråkan: svart med blåvioletta skimmer i nacken, mörk näbb och mörka fötter
const CROW_PAL = { H: 0x2a2a34, h: 0x46465a, B: 0x24242e, L: 0x30303c, D: 0x18181f, W: 0x34343f, w: 0x26262f, x: 0x121216, T: 0x1e1e26, t: 0x101014,
  g: 0x3a4c72, p: 0x4c3c70, e: 0x8a8a70, c: 0x3a3a44, b: 0x26262c, f: 0x1e1e24 };
const PIG_MAPS = {
  stand: [
    '......hH...',
    '.....hHecb.',
    '......Hg...',
    '....WWgpL..',
    '..WWWwWLL..',
    'TTwxwxWLL..',
    'tTTwwwBBD..',
    '....DDDD...',
    '.....f.f...',
  ],
  walk: [
    '.......hH..',
    '......hHecb',
    '......gHg..',
    '....WWgpL..',
    '..WWWwWLL..',
    'TTwxwxWLL..',
    'tTTwwwBBD..',
    '....DDDD...',
    '....f...f..',
  ],
  peck: [
    '...........',
    '...........',
    '...........',
    '...WWW.....',
    '..WWWwWL...',
    'TTwxwxWLg..',
    'tTTwwwBLpH.',
    '....DDDD.He',
    '.....f.f..b',
  ],
  up: [
    '..WW.......',
    '..WWW......',
    '...wWW.....',
    '....xwW.hH.',
    'TT..xwLLHec',
    'tTTBBBLLg..',
    '..TDDDDD...',
  ],
  mid: [
    '...........',
    '........hH.',
    '.......hHec',
    'TTWWWWWLg..',
    'tTwxwxWLL..',
    '..TDDDDD...',
    '...........',
  ],
  down: [
    '...........',
    '........hH.',
    '.......hHec',
    'TT.BBBBLg..',
    'tTTDwxWLL..',
    '...WxwW....',
    '...Ww......',
  ],
};
// fiskmåsen: vitt huvud, grå mantel, svarta vingspetsar med vita prickar, gul näbb med röd fläck
const GULL_PAL = { h: 0xffffff, H: 0xebebe5, B: 0xcfd0cc, W: 0xf6f6f2, G: 0xa9b3c1, g: 0x87929f, x: 0x24242c, s: 0xf2f2ec, e: 0x2a2226, y: 0xecc23a, r: 0xd84a3a, f: 0xe2a676 };
const GULL_MAPS = {
  stand: [
    '........hH...',
    '.......hHeHyy',
    '.......HHHHr.',
    '.....GGGHHH..',
    '..GGGgGGWHHB.',
    'xsGGgGgGWHHB.',
    'xxxGGGGGWBBB.',
    '....BBBBBBB..',
    '......f..f...',
    '......f..f...',
  ],
  walk: [
    '.........hH..',
    '........hHeHy',
    '........HHHHy',
    '.....GGGHHHr.',
    '..GGGgGGWHHB.',
    'xsGGgGgGWHHB.',
    'xxxGGGGGWBBB.',
    '....BBBBBBB..',
    '.....f....f..',
    '....f......f.',
  ],
  peck: [
    '.............',
    '.............',
    '.............',
    '.....GGG.....',
    '..GGGgGGWHH..',
    'xsGGgGgGWHHH.',
    'xxxGGGGGWBHHh',
    '....BBBBBBHeH',
    '......f..f.yy',
    '......f..f..r',
  ],
  up: [
    '....GG.........',
    '....GGG........',
    '.....GgG.......',
    '......GGW..hH..',
    'xx..GGGWWHHeHyy',
    '.xxGGgWHHHHH...',
    '.....BBBBB.....',
  ],
  mid: [
    '...............',
    '..........hH...',
    'xxsGGGGGGWHeHyy',
    '.xxGgGgGWHHHH..',
    '....BBBBBBB....',
    '...............',
    '...............',
  ],
  down: [
    '...............',
    '...........hH..',
    'x...GGGWWHHeHyy',
    '.x.GGgWHHHHH...',
    '...GgGBBBBB....',
    '..GGG..........',
    '.GG............',
  ],
};
// småfåglar (gråsparv, talgoxe, bofink): hoppar och pickar, flyger in i buskarna
const SPARROW_PALS = [
  { c: 0x7a4a2a, H: 0x9a9488, e: 0x121212, k: 0x3a3430, T: 0x5a3c26, B: 0x8e5e36, d: 0x4e3420, w: 0xe0d8c8, y: 0xc8b89c, f: 0xa88a6a },
  { c: 0x16161c, H: 0x1c1c24, e: 0x0a0a0a, k: 0x2a2a2e, T: 0x4a6078, B: 0x7a9a3c, d: 0x4a6a8a, w: 0xf4f4f0, y: 0xf0d040, f: 0x6a7a8a },
  { c: 0x5a7a9a, H: 0x6a8aa8, e: 0x121212, k: 0x8a8a90, T: 0x4a3a2e, B: 0x8a5a3a, d: 0x3a2a22, w: 0xe8e0d8, y: 0xd8987e, f: 0xa88a7a },
];
const SPARROW_MAPS = {
  stand: ['.....cc.', '....cHek', '..TBBHww', '.TBdByyw', '...Byy..', '....f.f.'],
  peck: ['........', '........', '..TBBc..', '.TBdBHc.', '...ByHek', '....f.f.'],
  hop: ['.....cc.', '....cHek', '..TBBHww', '.TBdByyw', '...Byy..', '.....f..'],
  up: ['..B.....', '..BB..c.', '...BBHek', '.TBdyy..', '........'],
  mid: ['......c.', '.BBBBHek', 'TBdByy..', '........', '........'],
  down: ['......c.', '..TBBHek', '.BBdyy..', '.B......', '........'],
};

// ---------- ekorren (vänd åt höger) ----------
const SQ_PAL = { R: 0xb8522a, r: 0xda773c, o: 0x8a3a1c, T: 0xa84820, t: 0xd4783a, w: 0xf2e6d2, k: 0x120c0a, n: 0x3a2016, e: 0x7a3014 };
const SQ_MAPS = {
  // sitter upp med svansen som ett S bakom sig
  sit: [
    '.tTt........',
    'tTTTT...e.e.',
    'TTttT...RRR.',
    'TT..T..RRkRn',
    '.T..T..rRRR.',
    '....TT.RRw..',
    '....TRRRRw..',
    '...TTRrRRw..',
    '....TRRRRwR.',
    '....TRRRRR..',
    '.....oo.oo..',
  ],
  // sitter och gnager på en kotte (tassarna uppe vid munnen)
  gnaw: [
    '.tTt........',
    'tTTTT...e.e.',
    'TTttT...RRR.',
    'TT..T..RRkRn',
    '.T..T..rRRRo',
    '....TT.RRwoo',
    '....TRRRRw..',
    '...TTRrRRw..',
    '....TRRRRw..',
    '....TRRRRR..',
    '.....oo.oo..',
  ],
  run1: [
    '..tTt........',
    '.tTTTTt...e.e',
    'tTT..TtT.RRRR',
    'TT....TRRRRkRn',
    '......RRrRRRR.',
    '.....oRRRwwR..',
    '....o.....o...',
  ],
  run2: [
    '.............',
    '..tTTt....e.e',
    '.tTTTTTt.RRRR',
    'tTT...TRRRRkRn',
    'T.....RRrRRR..',
    '.......RwwRo..',
    '.......oo.....',
  ],
  // klättrar uppför stammen (huvudet upp)
  climb: [
    '.e.e..',
    '.RRR..',
    'RRkRo.',
    '.RRR..',
    '.rRRo.',
    '.RRR..',
    '.RRRo.',
    '.TT...',
    'TTt...',
    'TtT...',
    '.TT...',
    '..t...',
  ],
};

// ---------- änder och svanar ----------
const DUCK_PALS = [
  // gräsand hane: grönt huvud, vit halsring, brunt bröst
  { G: 0x2a7a4a, h: 0x4aa870, g: 0x1e5a38, e: 0x0a0a0a, y: 0xe8c43a, w: 0xf4f4ee, C: 0x8a4a2a, c: 0x6a3620, B: 0xbcbcb6, b: 0x96968f, K: 0x26262c, W: 0x3a5ac0 },
  // hona: brunspräcklig
  { G: 0x8a6a44, h: 0xa88a5e, g: 0x6a4e30, e: 0x1a1410, y: 0xd8883a, w: 0x8a6a44, C: 0x9a7a54, c: 0x7a5a3a, B: 0xaa8c62, b: 0x7a5e3e, K: 0x6a5034, W: 0x3a5ac0 },
];
const DUCK_MAPS = {
  swim: [
    '.......GG...',
    '......GhGeyy',
    '.......GG...',
    '.......ww...',
    '.KbBBBBCC...',
    'KKbBWWBBCc..',
    '..bbbbbbbc..',
  ],
  // grundsim: huvudet under vattnet, stjärten upp
  dab: [
    '............',
    '............',
    '.K..........',
    '.KK.........',
    '..KbBBB.....',
    '..bBWWBBC...',
    '...bbbbbbCc.',
  ],
};
const SWAN_PAL = { h: 0xffffff, W: 0xf2f2ee, w: 0xd6dae0, d: 0xb2b8c2, o: 0xe8742a, k: 0x1a1a1e };
const SWAN_MAP = [
  '..........hW..',
  '.........hWWk.',
  '..........WWoo',
  '..........wW..',
  '..........wW..',
  '.........wW...',
  '....hWWWWWW...',
  '..hWWWwwwWWW..',
  '.WWwwwwwwwWWd.',
  '..dddddddddd..',
];

// ---------- katter (liggande, vakna, sittande) ----------
const CAT_PALS = [
  { O: 0xdc8a3c, o: 0xf4b468, r: 0xa65a22, s: 0x8a4418, w: 0xf6eee0, W: 0xd6ccbc, k: 0x3a2418, g: 0x9ad65a, n: 0xe48a8e, E: 0xe8a0a0 },  // rödrandig
  { O: 0x8a8a90, o: 0xb0b0b6, r: 0x5a5a62, s: 0x4a4a52, w: 0xeeeeea, W: 0xcacac4, k: 0x2a2a30, g: 0xe8d040, n: 0xd88a8e, E: 0xd8a0a4 },  // grå tigrerad
  { O: 0x26242c, o: 0x3a3842, r: 0x18161c, s: 0x121016, w: 0x3a3842, W: 0x2c2a32, k: 0x0e0c10, g: 0xd8e040, n: 0x6a4a50, E: 0x5a4048 },  // svart
];
const CAT_MAPS = {
  // ligger och sover: ögonen stängda, svansen runt tassarna
  sleep: [
    '............r..r.',
    '...........rEOrEr',
    '...sOsOsO..OOOOOO',
    '..sOoOoOoOrOkOOkO',
    '.rOOoOoOoOOOOwnwO',
    'rOOOOOOOOOOOOwwwO',
    'rOOOOOOOOOOOwWwWr',
    '.rrrrrrrrrrrrrrr.',
  ],
  // vaken: huvudet uppe, ögonen öppna
  awake: [
    '............r..r.',
    '...........rEOrEr',
    '...........OOOOOO',
    '...sOsOsO..OgOOgO',
    '..sOoOoOoOrOOwnwO',
    '.rOOoOoOoOOOOwwwr',
    'rOOOOOOOOOOOwWwWr',
    '.rrrrrrrrrrrrrrr.',
  ],
  // sitter upp och tittar (någon kommer nära)
  sit: [
    '.r....r..',
    '.rEOOOEr.',
    '.OOOOOOO.',
    '.OgOOOgO.',
    '.OOwnwOO.',
    '..OwwwO..',
    '..OsOsO..',
    '.OOoOoOO.',
    '.OoOwOOO.',
    '.OoOwOOr.',
    '.OOwwwOOr',
    '.rrWrWrrr',
  ],
};
// svanstippen i tre lägen (vift) – läggs ovanpå liggande katt
const CAT_TAILS = [[], [[0, 4], [0, 3]], [[1, 3], [0, 2], [1, 1]]];

// ---------- fjärilar ----------
const BF_COLORS = [
  { A: 0xf6f4ec, a: 0x2a2a2a, b: 0x2a2420 },   // kålfjäril
  { A: 0xf4e04a, a: 0xd8b830, b: 0x3a3020 },   // citronfjäril
  { A: 0xd4502e, a: 0x3a58a8, b: 0x2a1c18 },   // påfågelöga
  { A: 0x7aa6ee, a: 0x3a60b8, b: 0x22243a },   // blåvinge
];
// vingarna i tre lägen (fladder); ritas med mörk kontur så de syns mot blommorna
const BF_MAPS = {
  open: ['Aa...aA', 'AAAbAAA', '.aAbAa.', '.AA.AA.'],
  half: ['.a...a.', '.AAbAA.', '..AbA..', '..A.A..'],
  shut: ['...a...', '...A...', '...A...', '...b...'],
};

// ---------- förbiflygande fåglar (sedda underifrån) ----------
const BIRD = {
  sw: { pal: { k: 0x241f2a, K: 0x3a3440 }, fr: [
    ['k.......k', '.kK...Kk.', '...kkk...', '....k....'],
    ['.........', 'kkKK.KKkk', '...kkk...', '....k....'],
    ['.........', '...kkk...', '.kK.k.Kk.', 'k.......k'],
  ] },
  gull: { pal: { G: 0xb8c0cc, W: 0xf4f4f0, k: 0x22222a, y: 0xe8c040 }, fr: [
    ['k.........k', '.GG.....GG.', '...GWWWG...', '.....W.....'],
    ['...........', 'kGGGWWWGGGk', '....WWW....', '.....y.....'],
    ['...........', '...GWWWG...', '.GG..W..GG.', 'k.........k'],
  ] },
  crow: { pal: { k: 0x1e1c24, K: 0x3a3844 }, fr: [
    ['k.........k', '.kK.....Kk.', '...kkkkk...', '.....k.....'],
    ['...........', 'kkKKkkkKKkk', '....kkk....', '.....k.....'],
    ['...........', '...kkkkk...', '.kK..k..Kk.', 'k.........k'],
  ] },
  // stare i flock: små prickar
  star: { pal: { k: 0x1c1a22 }, fr: [['k.k', '.k.'], ['kkk', '...'], ['.k.', 'k.k']] },
  // grågäss i plogformation (vår och höst)
  goose: { pal: { k: 0x1e1c20, G: 0x6e665a, g: 0x8e8578, W: 0xe8e4dc }, fr: [
    ['G...........G', '.GG.......GG.', '...ggWkWgg...', '.....WkW.....', '......k......'],
    ['.............', 'GGGgggWkWgggG', '.....WkW.....', '......k......', '.............'],
    ['.............', '...ggWkWgg...', '.GG..WkW..GG.', 'G.....k.....G', '.............'],
  ] },
};

// ---------- sånt man bär ----------
const CARRY_MAPS = {
  // matkasse av papper med purjolök och baguette
  kasse: { rows: [
    '.G..b..',
    '.Gg.bB.',
    '.gG.bB.',
    'QQQQQQQ',
    'pPPPPPd',
    'pPPPPPd',
    'pPPPPPd',
    'pdddddd',
  ], pal: { G: 0x3f8a34, g: 0x8ccf5a, b: 0xe0aa60, B: 0xb07a34, Q: 0xe6cc96, P: 0xc9a46a, p: 0xdcbc84, d: 0x9c7a44 }, ax: 3, ay: 3 },
  // klädpåse med snören (färg per person)
  pase: { rows: [
    '.kkkk.',
    '.k..k.',
    'CCCCCC',
    'ChCCCc',
    'ChCLCc',
    'ChCCCc',
    'ChCCCc',
    'cccccc',
  ], pal: { k: 0x2a2630, C: 0xd24a8a, h: 0xe87ab0, c: 0xa0306a, L: 0xf4f1ea }, ax: 3, ay: 0 },
  // Möbeljättens stora blå bärkasse
  frakt: { rows: [
    '.YYY.YYY.',
    '.Y.Y.Y.Y.',
    'BYbBBBYBd',
    'BYbBBBYBd',
    'BybBBByBd',
    'BYbBBBYBd',
    'BYbBBBYBd',
    'BybBBByBd',
    'ddddddddd',
  ], pal: { B: 0x2f63c4, b: 0x5a8ae0, d: 0x1f4590, Y: 0xf2c83a, y: 0xc89a22 }, ax: 4, ay: 0 },
  // hamburgarpåse
  burgare: { rows: [
    '.QQQ.',
    'PPPPP',
    'pPRPd',
    'pRRRd',
    'pPPPd',
    'ddddd',
  ], pal: { Q: 0xe6cc96, P: 0xc9a46a, p: 0xdcbc84, d: 0x9c7a44, R: 0xd23a2e }, ax: 2, ay: 0 },
  // nät med apelsiner och äpplen från fruktfabriken
  frukt: { rows: [
    '.k.k.',
    '..k..',
    'oOrOo',
    'OroOr',
    'rOoOO',
    '.OrO.',
  ], pal: { k: 0x3a3430, O: 0xf0902a, o: 0xf8c060, r: 0xd0342a }, ax: 2, ay: 0 },
  // platt möbelkartong från Möbeljätten (bärs med båda händerna)
  kartong: { rows: [
    'KKKKKKKKKKKKKKK',
    'kkkkkkttkkkkkkd',
    'kLLLLkttkkkkkkd',
    'kbbbbkttkkykkkd',
    'kLyLLkttkkkkkkd',
    'kkkkkkttkkkkkkd',
    'ddddddddddddddd',
  ], pal: { K: 0xe0bc80, k: 0xc49a60, d: 0x98723e, L: 0xf2efe6, b: 0x2f63c4, y: 0xf2c83a, t: 0xd9cba4 }, ax: 7, ay: 0 },
  // resväska på hjul
  resvaska: { rows: [
    'CCCCCC',
    'ChCCCd',
    'ChCCCd',
    'CkkkkC',
    'ChCCCd',
    'ChCCCd',
    'Cddddd',
    '.w..w.',
  ], pal: { C: 0x2a8a8a, h: 0x4ab0b0, d: 0x1c5e5e, k: 0x1c4848, w: 0x1a1a1e }, ax: 3, ay: 7 },
  // kaffe att ta med: pappmugg med lock och hylsa
  kaffe: { rows: ['wwww', 'WccW', 'WssW', 'WssW', '.WW.'], pal: { w: 0xf4f1ea, W: 0xd8d2c4, c: 0x2a2226, s: 0xb07a44 }, ax: 1, ay: 2 },
  // pizzakartong (platt, med tryck) i handen
  pizza: { rows: ['KKKKKKKKKK', 'kkkRRRRkkd', 'kkRrRRrRkd', 'dddddddddd'], pal: { K: 0xf0e8d8, k: 0xd8ccb4, d: 0xa8987c, R: 0xc8322a, r: 0x2a8a3a }, ax: 2, ay: 0 },
  // postpaket med tejp och adresslapp
  paket: { rows: ['PPPtPPP', 'pPPtPPd', 'pwwtPPd', 'pPPtPPd', 'ddddddd'], pal: { P: 0xc8964e, p: 0xdcae6a, d: 0x9a6e36, t: 0xe8d8a8, w: 0xf6f2e8 }, ax: 3, ay: 0 },
  // kvällstidning från kiosken
  tidning: { rows: ['WWWWW', 'WRRRW', 'WkkkW', 'WkWkW', 'wwwww'], pal: { W: 0xf4f1ea, w: 0xc8c4bc, R: 0xe0302a, k: 0x3a3a40 }, ax: 2, ay: 1 },
  // glasstrut med två kulor
  glass: { rows: ['.pw.', 'pppw', 'cccc', '.cc.', '.c..'], pal: { p: 0xf4a8c0, w: 0xf8f0d8, c: 0xd89a4a }, ax: 1, ay: 3 },
  // tvättpåse från tvätteriet
  tvatt: { rows: ['..kk...', '.BBBB..', 'BbwBBBd', 'BwwbBBd', 'BBBBBBd', '.ddddd.'], pal: { k: 0x2a2630, B: 0x3a6ab0, b: 0x5a8ad0, w: 0xf4f4f0, d: 0x284a80 }, ax: 3, ay: 0 },
  // --- DOWNTOWN (v3) ---
  // elektronikbutikens vita plastpåse: blått band, gul blixt, en mobilkartong sticker upp
  elpase: { rows: [
    '.k...k.',
    '.kGGGk.',
    'WWGgGWW',
    'WBBBBBw',
    'WBYYBBw',
    'WBBYBBw',
    'WWWWWWw',
    'WWWWWWw',
    'wwwwwww',
  ], pal: { k: 0x2a2630, G: 0x3a3c44, g: 0x8a8e98, W: 0xf2f4f6, w: 0xc6ccd4, B: 0x2a5ad0, Y: 0xf2c83a }, ax: 3, ay: 0 },
  // platt tv-kartong med tryck (bärs med båda händerna, som möbelkartongen)
  tvlada: { rows: [
    'KKKKKKKKKKKKKKK',
    'kkkkkkkkkkkkkkd',
    'kSSSSSSSSSSSkkd',
    'kSbbbbbbbbbSkRd',
    'kSbBbbbbbbbSkkd',
    'kSbbBbbbbCbSkkd',
    'kSbbbbbbbbbSkkd',
    'kSSSSSSSSSSSkkd',
    'kkkkkSSSkkkkkkd',
    'kkkkSSSSSkkLLkd',
    'ddddddddddddddd',
  ], pal: { K: 0xe0bc80, k: 0xc49a60, d: 0x98723e, S: 0xb8bcc4, b: 0x1e2a44, B: 0x5a8ad0, C: 0x9ad0f0, R: 0xd23a2e, L: 0xf2efe6 }, ax: 7, ay: 0 },
  // skobutikens papperskasse – den röda skokartongen sticker upp
  skokasse: { rows: [
    '.k..k.',
    '.kRRk.',
    'PPRrPP',
    'PpPPPd',
    'PpWWPd',
    'PpPPPd',
    'PpPPPd',
    'dddddd',
  ], pal: { k: 0x3a2a1e, R: 0xd23a2e, r: 0xf06a5a, P: 0xc89a5e, p: 0xdcb47a, d: 0x9a723c, W: 0xf4efe4 }, ax: 2, ay: 0 },
  // accessoarbutikens lilla blanksvarta påse med guldsnören
  smyckespase: { rows: [
    '.gg.',
    'g..g',
    'KKKK',
    'KkKK',
    'KGKK',
    'KKKK',
    'dddd',
  ], pal: { g: 0xe8b830, K: 0x1c1c22, k: 0x4a4a56, G: 0xf0c848, d: 0x0c0c10 }, ax: 1, ay: 0 },
  // portfölj i läder med mässingslås (när figurmotorn inte har en egen)
  portfolj: { rows: [
    '..ddd..',
    '..d.d..',
    'LLLLLLL',
    'LlLLLLd',
    'LlLGLLd',
    'LlLLLLd',
    'ddddddd',
  ], pal: { L: 0x6a3e22, l: 0x8a5a34, d: 0x3a2210, G: 0xe8b830 }, ax: 3, ay: 0 },
};
// saker som bärs med båda händerna framför magen (bildrutorna 7–9)
const BOXES = new Set(['kartong', 'tvlada']);
const PASE_COLORS = [0xd24a8a, 0x2a2a30, 0xe8c13a, 0x3a8ad0, 0xf4f1ea, 0x46a35a];
const CASE_COLORS = [0x2a8a8a, 0xc9323a, 0x2a2a30, 0xb8bcc4, 0x3a5fb0, 0xe0a02a];
const UMB_COLORS = [0xc9323a, 0x2a2e48, 0x1e1e24, 0xe8c13a, 0x2f8f6f, 0x3a7bd5, 0x8e5bd1, 0xe07a2e];

// ---------- hundar: en liten målare med raser ----------
// size: m mellan · s liten · t tax · c corgi. ears: flop hängöron · up ståöron · big stora ståöron
const DOGS = [
  { n: 'blandras', base: 0xa8683a, hi: 0xcc8e56, lo: 0x7a4624, ear: 0x5a3018, size: 'm', ears: 'flop' },
  { n: 'labrador', base: 0x2e2c34, hi: 0x4e4c58, lo: 0x1c1b20, ear: 0x19181c, size: 'm', ears: 'flop', collar: 0xe0b020 },
  { n: 'golden', base: 0xdcaa56, hi: 0xf0c880, lo: 0xa87a34, ear: 0xb88438, size: 'm', ears: 'flop', collar: 0x3a6ad0 },
  { n: 'jackrussell', base: 0xeceae4, hi: 0xffffff, lo: 0xbcb8ae, ear: 0x6a4428, size: 's', ears: 'up', spots: 0x7a4a2a },
  { n: 'tax', base: 0x7a4a26, hi: 0x9c6a3c, lo: 0x55321a, ear: 0x3e2412, size: 't', ears: 'flop' },
  { n: 'schnauzer', base: 0x8a8e96, hi: 0xb0b4bc, lo: 0x5e626a, ear: 0x3a3c44, size: 's', ears: 'up', belly: 0xd8dade },
  { n: 'dalmatiner', base: 0xf2f0ea, hi: 0xffffff, lo: 0xc8c4bc, ear: 0x26262a, size: 'm', ears: 'flop', spots: 0x1e1e24, dense: true, collar: 0x2a8a4a },
  { n: 'corgi', base: 0xd8883a, hi: 0xf0a858, lo: 0xa8602a, ear: 0xb8682a, size: 'c', ears: 'big', belly: 0xf6eee0, mask: 0xf6eee0, tail: 'stub', collar: 0x3a6ad0 },
  { n: 'pudel', base: 0xeee4d2, hi: 0xffffff, lo: 0xc8baa4, ear: 0xd8ccb6, size: 's', ears: 'flop', curls: true, collar: 0xe04a8a },
  { n: 'husky', base: 0x7a7e88, hi: 0x9ea2ac, lo: 0x565a64, ear: 0x464a54, size: 'm', ears: 'up', belly: 0xf0f0ee, mask: 0xf0f0ee, tail: 'curl', eye: 0x5aa8e8, collar: 0xd83a3a },
  { n: 'mops', base: 0xd8bc8a, hi: 0xecd4a6, lo: 0xae9262, ear: 0x2a2420, size: 's', ears: 'flop', snout: 'short', muzzle: 0x2a2420, tail: 'curl', collar: 0x2a8a8a },
  { n: 'schäfer', base: 0xb8783a, hi: 0xd89858, lo: 0x8a5424, ear: 0x2a1e16, size: 'm', ears: 'up', saddle: 0x2a2220, muzzle: 0x2a2220, collar: 0xe0b020 },
];
// fr: 0 stå · 1/2 gå · 3 sitt · 4 nosa · 5 skäll (huvudet upp, munnen öppen) · 6 stå och vifta (svansen upp)
function paintDog(br, fr) {
  const P = new Pix(22, 16);
  const sz = br.size, small = sz === 's', tax = sz === 't', corgi = sz === 'c';
  const bodyL = small ? 8 : tax ? 12 : corgi ? 11 : 11, bodyH = small ? 4 : tax ? 4 : 5, legH = small ? 2 : tax || corgi ? 1 : 3;
  const gy = 14, by1 = gy - legH, by0 = by1 - bodyH + 1;
  const bx0 = 4, bx1 = bx0 + bodyL - 1;
  const C = br, far = mix(C.lo, 0x1a1420, 0.3), nose = 0x16141a;
  const sit = fr === 3, sniff = fr === 4, bark = fr === 5;
  const wagS = fr === 2 ? 1 : fr === 6 ? -1 : 0;
  // pudelns lockar: ljusa och mörka prickar i pälsen
  const fur = (x, y, c) => (C.curls ? (hash(x, y, 9) < 0.28 ? C.hi : hash(x, y, 11) < 0.18 ? mix(c, C.lo, 0.6) : c) : c);
  const put = (x, y, c) => P.px(x, y, c);
  // svans
  if (sit) { put(bx0 - 1, gy, C.lo); put(bx0 - 2, gy - 1, C.lo); }
  else if (C.tail === 'curl') {
    // husky och mops: svansen i en ring upp över ryggen (viftar i sidled)
    const o = wagS > 0 ? 1 : 0;
    put(bx0 - 1, by0 + 1, C.base); put(bx0 - 1, by0, C.hi); put(bx0, by0 - 1, C.hi); put(bx0 + 1 + o, by0 - 2, C.hi);
    put(bx0 + 1, by0 - 1, C.belly || C.base); if (wagS < 0) put(bx0 - 1, by0 - 1, C.hi);
  } else if (C.tail === 'stub') {
    put(bx0 - 1, by0 + (wagS < 0 ? 0 : 1), C.base);
  } else if (wagS < 0) {
    put(bx0 - 1, by0 + 1, C.base); put(bx0 - 2, by0, C.base); put(bx0 - 1, by0 - 1, C.hi); if (!small) put(bx0 - 1, by0 - 2, C.hi);
  } else {
    const wag = wagS > 0 ? 1 : 0;
    put(bx0 - 1, by0 + 1, C.base);
    put(bx0 - 2, by0, C.base);
    put(bx0 - 2 - wag, by0 - 1, C.hi);
    if (!small) put(bx0 - 3 - wag, by0 - 2, C.hi);
  }
  // ben: bortre paret mörkare, sedan det närmaste
  if (!sit) {
    const sw = fr === 1 ? 1 : fr === 2 ? -1 : 0;
    const legs = [[bx0 + 2, sw, true], [bx1 - 1, -sw, true], [bx0 + 1, -sw, false], [bx1 - 2, sw, false]];
    for (const [lx, o, isFar] of legs) {
      for (let j = 1; j < legH; j++) put(lx + (j === legH - 1 && legH > 2 ? o : 0), by1 + j, isFar ? far : C.base);
      put(lx + o, gy, isFar ? mix(far, 0x000000, 0.2) : (C.belly && corgi ? C.belly : C.lo));
    }
  } else {
    // sittande: bakbenet vikt under kroppen, frambenen raka
    for (let y = by1 - 1; y <= gy; y++) { put(bx1 - 2, y, far); put(bx1 - 1, y, C.base); }
    put(bx1 - 1, gy, C.lo);
    for (let x = bx0 + 1; x < bx0 + 5; x++) put(x, gy, C.lo);
  }
  // kropp (sittande: bakdelen sjunker, ryggen lutar)
  for (let x = bx0; x <= bx1; x++) {
    const t = (x - bx0) / (bodyL - 1);
    const top = by0 + (sit ? Math.round((1 - t) * 3) - 1 : 0);
    const bot = sit ? (x < bx0 + 5 ? gy - 1 : by1) : by1;
    for (let y = top; y <= bot; y++) {
      if (y === top && (x === bx0 || x === bx1)) continue;
      let c = y === top ? C.hi : y === bot ? C.lo : C.base;
      if (C.saddle && y <= top + 1 && x > bx0 && x < bx1 - 1) c = y === top ? mix(C.saddle, C.hi, 0.25) : C.saddle;
      if (C.spots && y > top && y < bot + (C.dense ? 1 : 0) && hash(x, y, 3) < (C.dense ? 0.34 : 0.3)) c = C.spots;
      if (C.belly && y === bot && x > bx0 + 1 && x < bx1) c = C.belly;
      put(x, y, fur(x, y, c));
    }
  }
  // huvud
  const hs = small ? 4 : 5;
  const hx0 = bx1 - (small ? 1 : 2) + (sniff ? 2 : 0);
  const hy0 = (sniff ? by1 - 2 : by0 - hs + 2 - (sit ? 2 : 0)) - (bark ? 1 : 0);
  if (!sniff) for (let y = hy0 + hs - 1; y <= by0 + 1; y++) for (let x = hx0; x < hx0 + 3; x++) put(x, y, fur(x, y, C.saddle && x === hx0 ? C.saddle : C.base)); // hals
  for (let j = 0; j < hs; j++) for (let i = 0; i < hs; i++) {
    if ((j === 0 || j === hs - 1) && (i === 0 || i === hs - 1)) continue;
    let c = j === 0 ? C.hi : i === hs - 1 && j > 1 ? C.lo : C.base;
    if (C.mask && j >= 2 && i >= 2) c = C.mask;
    if (C.dense && hash(i, j, 21) < 0.2) c = C.spots;
    put(hx0 + i, hy0 + j, fur(hx0 + i, hy0 + j, c));
  }
  // nos (mopsen har en kort, svart nos; schäfern en mörk)
  const sy = hy0 + hs - 3, sn = C.snout === 'short' ? 1 : small ? 2 : 3;
  const snC = C.muzzle || C.base, snL = C.muzzle ? mul(C.muzzle, 0.8) : C.lo;
  for (let i = 0; i < sn; i++) {
    put(hx0 + hs - 1 + i, sy + 1, i === 0 && !C.muzzle ? C.base : snC);
    if (bark && i > 0) { put(hx0 + hs - 1 + i, sy + 2, i === 1 ? 0xc84a5a : 0x3a1a22); put(hx0 + hs - 2 + i, sy + 3, snL); }
    else put(hx0 + hs - 1 + i, sy + 2, C.mask && i < sn ? C.mask : snL);
  }
  put(hx0 + hs - 2 + sn, sy + 1, nose);
  put(hx0 + hs - 2, hy0 + 1, C.eye || nose); // öga
  // öron
  if (br.ears === 'up') { put(hx0, hy0 - 1, C.ear); put(hx0 + 1, hy0 - 1, C.ear); put(hx0 + 1, hy0 - 2, C.ear); }
  else if (br.ears === 'big') { put(hx0, hy0 - 1, C.ear); put(hx0 + 1, hy0 - 1, C.ear); put(hx0 + 1, hy0 - 2, C.ear); put(hx0, hy0 - 2, C.hi); put(hx0 + 1, hy0 - 3, C.ear); put(hx0 + 2, hy0 - 1, C.ear); }
  else { for (let j = 1; j <= 3; j++) put(hx0, hy0 + j, C.ear); put(hx0 + 1, hy0 + 1, C.ear); put(hx0 + 1, hy0 + 2, C.ear); }
  // halsband
  if (!sniff) { const col = C.collar || 0xc8323a; put(hx0 + 1, hy0 + hs, col); put(hx0 + 2, hy0 + hs, mix(col, 0xffffff, 0.2)); }
  // tunga när den går
  if (fr === 1 || fr === 2) put(hx0 + hs, sy + 3, 0xe06a7a);
  const neck = sniff ? [hx0 + 1, hy0 + 1] : [hx0 + 2, hy0 + hs];
  return { c: fromPix(P), neck, mouth: [hx0 + hs - 1 + sn, sy + 2] };
}

// ---------- paraply (fyra dukpaneler, spröt och uddar), ett per färg ----------
// Canvasen är 19×9: spetsen i (9,1), duken rad 2–6, uddarna rad 7.
function paintUmbrella(c) {
  const P = new Pix(19, 9, -1, -1);
  const hi = mix(c, 0xffffff, 0.3), mid = mul(c, 0.86), lo = mul(c, 0.7), dk = mix(mul(c, 0.5), 0x1a1426, 0.2);
  const panel = [hi, c, mid, lo];
  P.px(8, 0, 0x2a2630);
  [2, 4, 6, 7, 8].forEach((w, j) => {
    const y = j + 1;
    for (let x = 8 - w; x <= 8 + w; x++) {
      const t = (x - 8) / w;
      let col = panel[t < -0.5 ? 0 : t < 0 ? 1 : t < 0.5 ? 2 : 3];
      if (j > 0 && [-1, -0.5, 0, 0.5, 1].some((r) => Math.round(8 + r * w) === x)) col = mix(col, dk, 0.4); // spröt
      if (j === 4) col = mix(col, dk, 0.18); // kanten lite mörkare
      P.px(x, y, col);
    }
  });
  for (const x of [0, 4, 8, 12, 16]) P.px(x, 6, x < 8 ? mid : dk); // uddarna
  P.px(5, 2, mix(hi, 0xffffff, 0.55)); P.px(4, 3, mix(hi, 0xffffff, 0.4)); P.px(3, 4, mix(hi, 0xffffff, 0.2)); // glans
  return fromPix(P);
}

// ---------- snögubbar: tre klot med skuggning, kol, morot, pinnarmar och hatt/mössa/hink ----------
const SNOW4 = [0x9aacc4, 0xc6d4e6, 0xe6eef8, 0xffffff];
function paintSnowman(v) {
  const P = new Pix(22, 32, -11, -30);
  // mjuk skugga och snövall vid foten
  P.ell(2, 0, 9, 2.4, 0x6a80a0, 0.45, 4);
  const ball = (cx, cy, rx, ry) => {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const u = (x + 0.5 - cx) / rx, w = (y + 0.5 - cy) / ry;
      if (u * u + w * w > 1) continue;
      // ljuset från sydväst: vänster/nedre kant ljusast, höger/övre mörkare
      const l = 0.62 - u * 0.42 + w * 0.12 + (hash(x, y, 71) - 0.5) * 0.14;
      P.px(x, y, SNOW4[clamp(Math.round(l * 3.4), 0, 3)]);
    }
  };
  ball(0, -5, 7, 5.4); ball(0, -14.5, 5.2, 4.4); ball(0, -22, 4, 3.8);
  // snöklumpar och fotspår runt foten
  for (const [x, y] of [[-8, -1], [7, -1], [-6, 0], [5, 0], [9, 0]]) P.px(x, y, SNOW4[2]);
  // knappar av kol
  P.px(0, -16, 0x1a1a1e); P.px(0, -13, 0x1a1a1e); P.px(0, -7, 0x26262a);
  // ansiktet: ögon och en morot som pekar åt höger
  P.px(-2, -23, 0x16161a); P.px(1, -23, 0x16161a); P.px(-1, -20, 0x2a2a30); P.px(0, -20, 0x2a2a30); P.px(1, -20, 0x2a2a30);
  P.hl(1, -22, 3, 0xe8782a); P.px(4, -22, 0xc05818); P.px(2, -21, 0xc05818);
  // pinnarmar med kvistar
  P.line(-5, -15, -10, -19, 0x5a3a22); P.px(-9, -20, 0x5a3a22); P.px(-11, -19, 0x7a5232);
  P.line(5, -15, 10, -18, 0x5a3a22); P.px(9, -19, 0x5a3a22); P.px(11, -17, 0x7a5232);
  if (v === 0) { // hög hatt
    P.hl(-5, -26, 11, 0x1e1e24); P.rect(-3, -31, 7, 5, 0x26262c); P.hl(-3, -27, 7, 0xc8323a); P.vl(-3, -31, 5, 0x3a3a44);
  } else if (v === 1) { // röd toppluva med tofs och randig halsduk
    P.rect(-4, -27, 9, 2, 0xf4f1ea); P.rect(-3, -30, 7, 3, 0xd23a3a); P.px(-2, -30, 0xe86060); P.rect(-1, -32, 3, 2, 0xf4f1ea);
    for (let x = -4; x <= 4; x++) P.px(x, -18, x % 2 ? 0x3a6ad0 : 0xf4f1ea);
    P.vl(3, -17, 4, 0x3a6ad0); P.px(3, -14, 0xf4f1ea);
  } else if (v === 2) { // hink på huvudet
    P.rect(-4, -29, 9, 4, 0x3a8ad0); P.hl(-4, -29, 9, 0x6aaae8); P.hl(-4, -26, 9, 0x2a6aa8); P.px(-5, -26, 0x2a6aa8); P.px(5, -26, 0x2a6aa8);
  } else { // bara halsduk (röd) som fladdrar
    P.hl(-4, -18, 9, 0xc8323a); P.hl(-3, -17, 7, 0xa02a2a); P.line(3, -17, 6, -13, 0xc8323a); P.px(6, -12, 0xa02a2a);
  }
  return fromPix(P);
}

let SPR = null;
function buildSprites() {
  if (SPR) return SPR;
  const S = { pig: [], crow: null, gull: null, sparrow: [], sq: {}, duck: [], swan: null, cat: [], bf: [], bird: {}, carry: {}, pase: {}, case: {}, umb: {}, dog: [], snowman: [] };
  const setOf = (maps, pal) => { const set = {}; for (const k in maps) set[k] = pairOf(fromMap(maps[k], pal)); return set; };
  for (const v of PIG_VARIANTS) S.pig.push(setOf(PIG_MAPS, { ...v, ...PIG_COMMON }));
  S.crow = setOf(PIG_MAPS, CROW_PAL);
  S.gull = setOf(GULL_MAPS, GULL_PAL);
  for (const pal of SPARROW_PALS) S.sparrow.push(setOf(SPARROW_MAPS, pal));
  S.sq = setOf(SQ_MAPS, SQ_PAL);
  S.sq.down = { r: flipY(S.sq.climb.r), l: flipY(S.sq.climb.l), w: S.sq.climb.w, h: S.sq.climb.h };
  for (const pal of DUCK_PALS) S.duck.push(setOf(DUCK_MAPS, pal));
  S.swan = pairOf(fromMap(SWAN_MAP, SWAN_PAL));
  for (const pal of CAT_PALS) {
    const set = {};
    for (const k in CAT_MAPS) set[k] = pairOf(fromMap(CAT_MAPS[k], pal));
    set.tails = CAT_TAILS.map((extra) => {
      const rows = CAT_MAPS.awake.map((r) => r.split(''));
      for (const [x, y] of extra) rows[y][x] = 'r';
      if (extra.length) { rows[6][0] = 'O'; rows[5][0] = 'r'; }
      return pairOf(fromMap(rows.map((r) => r.join('')), pal));
    });
    S.cat.push(set);
  }
  for (const col of BF_COLORS) { const set = {}; for (const k in BF_MAPS) set[k] = fromMap(BF_MAPS[k], col, true); S.bf.push(set); }
  for (const k in BIRD) S.bird[k] = BIRD[k].fr.map((rows) => fromMap(rows, BIRD[k].pal, false));
  for (const k in CARRY_MAPS) { const m = CARRY_MAPS[k]; S.carry[k] = { ...pairOf(fromMap(m.rows, m.pal)), ax: m.ax + 1, ay: m.ay + 1 }; }
  for (const c of PASE_COLORS) {
    const m = CARRY_MAPS.pase;
    S.pase[c] = { ...pairOf(fromMap(m.rows, { ...m.pal, C: c, h: mix(c, 0xffffff, 0.3), c: mul(c, 0.7), L: c === 0xf4f1ea ? 0xd24a8a : 0xf4f1ea })), ax: m.ax + 1, ay: m.ay + 1 };
  }
  for (const c of CASE_COLORS) {
    const m = CARRY_MAPS.resvaska;
    S.case[c] = { ...pairOf(fromMap(m.rows, { ...m.pal, C: c, h: mix(c, 0xffffff, 0.28), d: mul(c, 0.68), k: mul(c, 0.55) })), ax: m.ax + 1, ay: m.ay + 1 };
  }
  for (const c of UMB_COLORS) S.umb[c] = paintUmbrella(c);
  for (const br of DOGS) {
    const frames = [];
    for (let f = 0; f < 7; f++) { const d = paintDog(br, f); frames.push({ r: d.c, l: flipX(d.c), neck: d.neck, mouth: d.mouth }); }
    S.dog.push(frames);
  }
  for (let v = 0; v < 4; v++) S.snowman.push(pairOf(paintSnowman(v)));
  SPR = S;
  return S;
}

// Förhandsvisning av alla småfigurer (för utveckling): ark i skala 1.
export function _sheet() {
  const S = buildSprites();
  const c = mkCanvas(420, 300), x = c.getContext('2d');
  x.fillStyle = '#8a8478'; x.fillRect(0, 0, 420, 300);
  let px = 2;
  for (const set of [...S.pig, S.crow]) { let py = 2; for (const k in set) { x.drawImage(set[k].r, px, py); py += 12; } px += 15; }
  { let py = 2; for (const k in S.gull) { x.drawImage(S.gull[k].r, px, py); py += 13; } px += 18; }
  for (const set of S.sparrow) { let py = 2; for (const k in set) { x.drawImage(set[k].r, px, py); py += 9; } px += 11; }
  let cx = px + 2;
  for (const set of S.cat) { let cy = 2; for (const k of ['sleep', 'awake', 'sit']) { x.drawImage(set[k].r, cx, cy); cy += 15; } cx += 22; }
  S.dog.forEach((frames, i) => frames.forEach((f, j) => x.drawImage(f.r, 2 + j * 23 + (i >= 6 ? 170 : 0), 80 + (i % 6) * 17)));
  let sx = 2;
  for (const k of ['sit', 'gnaw', 'run1', 'run2', 'climb', 'down']) { x.drawImage(S.sq[k].r, sx, 186); sx += S.sq[k].w + 3; }
  for (const set of S.duck) for (const k in set) { x.drawImage(set[k].r, sx, 188); sx += 16; }
  x.drawImage(S.swan.r, sx, 184); sx += 18;
  for (const s of S.snowman) { x.drawImage(s.r, sx, 176); sx += 23; }
  let bx = 2;
  for (const set of S.bf) { let by = 206; for (const k in set) { x.drawImage(set[k], bx, by); by += 5; } bx += 8; }
  let gx = 40;
  for (const k in S.bird) { S.bird[k].forEach((f, i) => x.drawImage(f, gx + i * 15, 210)); gx += 48; }
  let kx = 2;
  for (const k in S.carry) { x.drawImage(S.carry[k].r, kx, 232); kx += S.carry[k].w + 2; }
  let ux = 2;
  for (const k in S.umb) { x.drawImage(S.umb[k], ux, 260); ux += 21; }
  return c.toDataURL('image/png');
}

// =====================================================================
//  Telefonen mot örat (v3): figurmotorn har ingen sådan pose, så figuren ritas som
//  vanligt och armen på telefonsidan görs om pixel för pixel – underarmen och handen
//  suddas (och får ny kontur), en upplyft arm med handen och mobilen vid örat ritas in.
//  Mått ur people.js (vuxen, bildrutorna 0–2): bålen börjar på rad 18, huvudet på rad 6,
//  armarna på x 12 ∓ tw (tw = look.build). Framifrån: personens högra hand (vänster i bild),
//  bakifrån: höger i bild; från sidan: närmaste armen (bålen från stå-bilden, benen från
//  gå-bilden så att figuren fortfarande går). Cachas per utseende, riktning och bildruta.
//  Bär figuren en väska i handen (portfölj, handväska …) hänger den i den högra handen –
//  då tar man telefonen med den vänstra (framifrån/bakifrån); från sidan skymmer kroppen
//  den armen, så där syns bara väskan (vanliga figuren).
// =====================================================================
const HELD_BAGS = new Set(['briefcase', 'handbag', 'shoppingBag', 'sportsBag', 'skateboard']);
const CALL_CACHE = new WeakMap();
function callSprite(L, dir, frame, suit) {
  if (!L || typeof document === 'undefined') return null;
  let m = CALL_CACHE.get(L);
  if (!m) { m = new Map(); CALL_CACHE.set(L, m); }
  const key = dir + frame;
  if (m.has(key)) return m.get(key);
  let out = null;
  try { out = dir === 'left' ? flipX(callSprite(L, 'right', frame, suit)) : paintCall(L, dir, frame, suit); } catch { out = null; }
  m.set(key, out);
  return out;
}
function paintCall(L, dir, frame, suit) {
  const W = 24, H = 40;
  const grab = (f) => {
    const c = mkCanvas(W, H + 4), g = c.getContext('2d', { willReadFrequently: true });
    drawPerson(g, 12, 39, L, dir, f);
    const d = g.getImageData(0, 0, W, H).data;
    for (let i = 3; i < d.length; i += 4) if (d[i] < 250) { d[i - 3] = d[i - 2] = d[i - 1] = d[i] = 0; }   // skuggan bort
    return d;
  };
  const d = grab(dir === 'right' ? 0 : frame);
  if (dir === 'right' && frame) { const w = grab(frame); for (let i = 29 * W * 4; i < d.length; i++) d[i] = w[i]; }   // benen går
  const at = (x, y) => (y * W + x) * 4;
  const inside = (x, y) => x >= 0 && y >= 0 && x < W && y < H;
  const get = (x, y) => { const i = at(x, y); return d[i + 3] ? (d[i] << 16) | (d[i + 1] << 8) | d[i + 2] : -1; };
  // vilka pixlar är figur (inte kontur)? en konturpixel har exakt den mörka tonen av en granne
  const olOf = (i) => [d[i] * 0.28 + 14, d[i + 1] * 0.24 + 10, d[i + 2] * 0.3 + 20];
  const real = new Uint8Array(W * H), touched = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = at(x, y);
    if (!d[i + 3]) continue;
    let ol = false;
    for (const [dx, dy] of [[0, -1], [-1, 0], [1, 0], [0, 1]]) {
      if (!inside(x + dx, y + dy)) continue;
      const j = at(x + dx, y + dy);
      if (!d[j + 3]) continue;
      const o = olOf(j);
      if (Math.abs(d[i] - (o[0] | 0)) <= 1 && Math.abs(d[i + 1] - (o[1] | 0)) <= 1 && Math.abs(d[i + 2] - (o[2] | 0)) <= 1) { ol = true; break; }
    }
    if (!ol) real[y * W + x] = 1;
  }
  const set = (x, y, c) => { if (!inside(x, y)) return; const i = at(x, y); d[i] = (c >> 16) & 255; d[i + 1] = (c >> 8) & 255; d[i + 2] = c & 255; d[i + 3] = 255; real[y * W + x] = 1; touched[y * W + x] = 1; };
  const clear = (x, y) => { if (!inside(x, y)) return; const i = at(x, y); d[i] = d[i + 1] = d[i + 2] = d[i + 3] = 0; real[y * W + x] = 0; touched[y * W + x] = 1; };
  const T0 = 18, tw = L.build || 5, sw = frame === 1 ? 1 : frame === 2 ? -1 : 0;
  const PHONE = 0x1c1c22, PHONE_HI = 0x5a5e6a, PHONE_EDGE = 0x4a4e5c, PHONE_TOP = 0x9aa0ac, CUFF = 0xecebe6;
  const paint = set;
  const other = HELD_BAGS.has(L.bag);                  // väskan i högra handen → telefonen i den vänstra
  if (other && dir !== 'down' && dir !== 'up') return null;
  if (dir === 'down' || dir === 'up') {
    // framifrån: vänster arm i bild (x0 = 12 − tw − 2); bakifrån: höger arm (x0 = 12 + tw) – med väska tvärtom
    const left = (dir === 'down') !== other, x0 = left ? 12 - tw - 2 : 12 + tw, len = 8 + (left ? sw : -sw);
    const sHi = get(x0, T0 + 2), sLo = get(x0 + 1, T0 + 2), sk = get(x0 + (left ? 0 : 1), T0 + len - 1), skLo = get(x0 + (left ? 1 : 0), T0 + len - 1);
    if (sHi < 0 || sk < 0) return null;
    // sudda underarmen och handen (och deras kontur) – från höfterna och neråt bara armens egna färger
    // (en kjol som vidgar sig får stå kvar)
    const armCol = new Set([sHi, sLo, sk, skLo]);
    for (let y = T0 + 4; y <= T0 + len + 1; y++) for (let x = left ? x0 - 1 : x0; x <= (left ? x0 + 1 : x0 + 2); x++) {
      if (!inside(x, y)) continue;
      if (y >= 27 && real[y * W + x] && !armCol.has(get(x, y))) continue;
      clear(x, y);
    }
    // upplyft underarm: från armbågen (x0, rad 21) upp längs huvudets sida till handen vid käken
    const hx = left ? 6 : 16, tip = 16;               // handens vänstra kolumn, underarmens översta rad
    for (let y = T0 + 3; y >= tip; y--) {
      const u = (T0 + 3 - y) / (T0 + 3 - tip), x = Math.round(x0 + (hx - x0) * u);
      paint(x, y, left ? sHi : sLo); paint(x + 1, y, left ? sLo : sHi);
    }
    if (suit) { paint(hx, tip, CUFF); paint(hx + 1, tip, 0xcfcdc6); }   // skjortmanschetten
    // handen (2 × 3) runt mobilens nedre del, mobilen (2 × 5) vid örat
    const ox = left ? hx : hx + 1, ix = left ? hx + 1 : hx;   // mobilens yttre kant (blank) och inre
    for (let y = 10; y <= 14; y++) { paint(ox, y, y === 10 ? PHONE_TOP : PHONE_EDGE); paint(ix, y, y === 10 ? PHONE_HI : PHONE); }
    for (let y = 13; y <= 15; y++) { paint(hx, y, left ? sk : skLo); paint(hx + 1, y, left ? skLo : sk); }
  } else {
    // från sidan (höger): bålen målas om där den hängande armen låg (x 11–13) …
    const sLo = get(11, T0 + 3), sB = get(12, T0 + 3), sHi = get(13, T0 + 3), sk = get(12, T0 + 7), skLo = get(11, T0 + 7);
    if (sB < 0 || sk < 0) return null;
    for (let y = T0 + 1; y <= T0 + 8; y++) { const c = get(10, y); if (c >= 0) for (let x = 11; x <= 13; x++) set(x, y, c); }
    // … och armen lyfts: överarmen snett fram till armbågen, underarmen upp till örat
    for (let k = 0; k <= 3; k++) { const x = 11 + k, y = T0 + 1 + k; set(x, y, sLo); set(x + 1, y, sB); set(x + 2, y, sHi); }
    for (let y = T0 + 3; y >= 16; y--) { const u = (T0 + 3 - y) / (T0 + 3 - 16), x = Math.round(14 + (12 - 14) * u); set(x, y, sB); set(x + 1, y, sHi); }
    if (suit) { set(12, 16, CUFF); set(13, 16, 0xcfcdc6); }
    for (let y = 10; y <= 14; y++) { set(11, y, y === 10 ? PHONE_TOP : PHONE_EDGE); set(12, y, y === 10 ? PHONE_HI : PHONE); }
    for (let y = 13; y <= 15; y++) { set(12, y, sk); set(13, y, y === 15 ? skLo : sk); }
  }
  // ny kontur runt det som ändrats: varje pixel i (eller intill) det ändrade som inte är figur blir
  // en mörk ton av sin figurgranne (ovanför > vänster > höger > under, som people.js) – eller genomskinlig
  const src = new Uint8ClampedArray(d);
  const isReal = (x, y) => inside(x, y) && real[y * W + x] === 1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (real[y * W + x]) continue;
    let near = touched[y * W + x] === 1;
    for (const [dx, dy] of [[0, -1], [-1, 0], [1, 0], [0, 1]]) if (!near && inside(x + dx, y + dy) && touched[(y + dy) * W + x + dx]) near = true;
    if (!near) continue;
    const i = at(x, y);
    let b = -1;
    if (isReal(x, y - 1)) b = at(x, y - 1); else if (isReal(x - 1, y)) b = at(x - 1, y); else if (isReal(x + 1, y)) b = at(x + 1, y); else if (isReal(x, y + 1)) b = at(x, y + 1);
    if (b < 0) { d[i] = d[i + 1] = d[i + 2] = d[i + 3] = 0; continue; }
    d[i] = src[b] * 0.28 + 14; d[i + 1] = src[b + 1] * 0.24 + 10; d[i + 2] = src[b + 2] * 0.3 + 20; d[i + 3] = 255;
  }
  const c = mkCanvas(W, H), g = c.getContext('2d'), im = g.createImageData(W, H);
  im.data.set(d); g.putImageData(im, 0, 0);
  return c;
}

// Förhandsvisning (utveckling): kostymfolk i telefon i alla riktningar och bildrutor, 1:1.
export function _callSheet(looks) {
  const c = mkCanvas(24 * 12 + 8, 44 * looks.length + 4), g = c.getContext('2d');
  g.fillStyle = '#9a9488'; g.fillRect(0, 0, c.width, c.height);
  looks.forEach((L, j) => {
    let i = 0;
    for (const dir of ['down', 'right', 'left', 'up']) for (const f of [0, 1, 2]) {
      const s = callSprite(L, dir, f, true);
      if (s) g.drawImage(s, 4 + i * 24, 2 + j * 44);
      i++;
    }
  });
  return c.toDataURL('image/png');
}

// =====================================================================
//  Utseenden: årstid, väder, stadsdel
// =====================================================================
function dress(L0, o) {
  const L = { ...L0 };
  const w = o.w || {}, t = w.temp ?? 15, season = w.season || 'sommar', kind = w.kind || (o.rain ? 'regn' : 'sol');
  const winter = season === 'vinter' || t < 3, cool = !winter && t < 11, warm = t >= 19 && (kind === 'sol' || kind === 'moln');
  const noShorts = () => { if (['shorts', 'skirt', 'bermuda', 'cargoShorts', 'denimShorts', 'miniSkirt'].includes(L.bottom)) L.bottom = pick(['jeans', 'pants', 'chinos', 'jeans']); };
  if (o.jog) {
    L.bag = null; L.shoeType = 'sneakers'; L.shoes = pick(['#f2f2f2', '#3a6bc2', '#c23b3b', '#1c1c1c']); L.phones = rnd() < 0.5;
    if (winter) { L.top = pick(['fleece', 'windbreaker', 'track']); L.bottom = pick(['leggings', 'trackPants']); L.hat = pick(['beanie', 'headband', 'beanie']); }
    else if (cool) { L.top = pick(['track', 'windbreaker', 'tee']); L.bottom = pick(['leggings', 'trackPants', 'sportShorts']); L.hat = pick([null, 'headband', 'cap']); }
    else { L.top = pick(['tee', 'tank', 'tee', 'track']); L.bottom = pick(['sportShorts', 'bikeShorts', 'shorts', 'leggings']); L.hat = pick([null, 'cap', 'sweatband', 'headband']); }
    return L;
  }
  if (o.youth || (o.sub && !L.kid && rnd() < 0.5)) {
    L.top = winter ? pick(['puffer', 'bomber', 'zipHoodie', 'puffer']) : pick(['zipHoodie', 'hoodie', 'track', 'bomber', 'zipHoodie', 'tee']);
    L.bottom = pick(['trackPants', 'joggers', 'jeansBaggy', 'jeans', 'sweatpants', 'jeansRipped']);
    L.shoeType = pick(['sneakers', 'highTops', 'sneakers']);
    if (rnd() < 0.55) L.hat = pick(['capBack', 'cap', 'beanie', 'capBack', 'bucket']);
    if (rnd() < 0.2) L.neck = 'chain';
    L.phones = rnd() < 0.3;
  }
  // DOWNTOWN (v3): finanskvarterets folk går i kavaj och slips, mörka byxor och blanka skor
  // (inte barn, inte ungdomsgänget; på vintern en rock över)
  if (o.suit && !L.kid && !o.youth && rnd() < 0.92) { // finanskvarteret: nästan alla vuxna i kavaj eller dräkt (Carl: "kostymklädda")
    // kostym (kavaj + byxor) eller dräkt (blazer + penn-/rak kjol), mörka toner, vit skjorta och slips;
    // ordentlig frisyr i naturlig hårfärg; portfölj eller handväska; på vintern rock och halsduk
    const dräkt = rnd() < 0.38;
    L.top = dräkt && hasLook('top', 'blazer') ? 'blazer' : 'suit';
    if (winter && rnd() < 0.7) { const c = pick(['coat', 'trench', 'coat']); if (hasLook('top', c)) L.top = c; }
    else if (cool && rnd() < 0.3 && hasLook('top', 'trench')) L.top = 'trench';
    L.bottom = dräkt ? (hasLook('bottom', 'pencil') ? 'pencil' : 'skirt') : (hasLook('bottom', 'suitPants') ? 'suitPants' : 'pants');
    L.shirt = pick(['#2f3440', '#1f2330', '#3a3f4c', '#2d3a5c', '#4a4038', '#5a5f6a', '#262a36', '#6a6e78']);
    L.pants = rnd() < 0.7 ? L.shirt : pick(['#2b2b30', '#2d3a5c', '#1f2330', '#3a3f4c']);   // oftast samma tyg som kavajen
    L.accent = pick(['#c9323a', '#3a7bd5', '#e8b230', '#2f8a5a', '#8a3ac9', '#b02a4a', '#1f4a8a']);   // slipsen/scarfen
    const firstOk = (field, list, def) => { for (const v of list) if (hasLook(field, v)) return v; return def; };
    L.shoeType = dräkt && rnd() < 0.55 ? firstOk('shoeType', ['heels', 'ballerina'], 'normal') : firstOk('shoeType', ['dressShoes'], 'normal');
    L.shoes = pick(['#1c1c1c', '#3a2a1e', '#1c1c1c', '#2f2f36']);
    L.hair = pick(['#1d1714', '#3b2619', '#3b2619', '#6b4226', '#a5692f', '#d9a95c', '#b9b3ab', '#e6e2da', '#1d1714']);
    // ordentliga frisyrer (de som finns i motorn)
    const styles = (dräkt ? ['bob', 'lob', 'sleek', 'lowBun', 'bun', 'ponytail', 'lowPony', 'frenchBraid', 'pixie', 'long', 'bob']
      : ['short', 'side', 'crew', 'quiff', 'slick', 'hardPart', 'buzz', 'fade', 'short', 'side', 'bald']).filter((s) => hasLook('style', s));
    if (styles.length) L.style = pick(styles);
    L.hat = null; L.hairAcc = 'none'; L.hairFx = 'none'; L.hair2 = null;
    L.phones = false; L.beard = rnd() < 0.75 ? false : L.beard; L.makeup = dräkt ? L.makeup : 'none'; L.marks = 'none';
    if (L.glasses === 'sun' || (L.glasses && !['square', 'round', 'halfRim'].includes(L.glasses))) L.glasses = false;
    if (rnd() < 0.28) L.glasses = firstOk('glasses', [pick(['halfRim', 'square', 'round'])], false);
    const bag = rnd();
    L.bag = bag < 0.5 && hasLook('bag', 'briefcase') ? 'briefcase' : bag < 0.66 ? (dräkt && hasLook('bag', 'handbag') ? 'handbag' : hasLook('bag', 'messenger') ? 'messenger' : 'shoulder') : null;
    L.bagColor = pick(['#2a2a2e', '#5a3a22', '#1c1c1c', '#6b4a33']);
    // halsen: halsduk på vintern, pärlhalsband till dräkten, passerkort i band (på väg till kontoret)
    L.neck = 'none';
    if (winter && rnd() < 0.6) L.neck = firstOk('neck', [pick(['scarf', 'scarfLong', 'scarf'])], 'none');
    else if (dräkt && rnd() < 0.3) L.neck = firstOk('neck', ['pearls'], 'none');
    else if (rnd() < 0.18) L.neck = firstOk('neck', ['lanyard'], 'none');
    L.neckColor = L.neck === 'lanyard' ? pick(['#2a5ad0', '#c9323a', '#2f8a5a']) : null;
    if (winter && rnd() < 0.25) L.hat = firstOk('hat', [pick(['flatCap', 'fedora', 'beret'])], null);
    o.suited = true;
    return L;
  }
  if (L.kid && winter) { L.top = 'puffer'; L.bottom = 'snowsuit'; L.hat = pick(['pompom', 'beanie', 'pompom', 'ushanka']); L.shoeType = 'winterBoots'; L.neck = rnd() < 0.5 ? pick(['scarf', 'scarfStripe']) : L.neck; }
  else if (L.kid && kind === 'regn') { L.top = 'raincoat'; L.bottom = 'rainPants'; L.shoeType = 'rubberBoots'; L.shirt = pick(['#f0b429', '#d9433b', '#3a7bd5', '#46a35a']); }
  else if (winter) {
    if (!o.youth && rnd() < 0.85) L.top = pick(['puffer', 'parka', 'coat', 'puffer', 'coat', 'downVest', 'fleece', 'parka']);
    if (rnd() < 0.72) L.hat = pick(['beanie', 'pompom', 'beanie', 'ushanka', 'earmuffs', 'beanie', 'flatCap']);
    if (rnd() < 0.62) L.neck = pick(['scarf', 'scarfStripe', 'scarfLong', 'scarf']);
    L.shoeType = pick(['winterBoots', 'boots', 'winterBoots', 'ankleBoots']);
    noShorts();
    L.glasses = L.glasses === 'sun' ? false : L.glasses;
  } else if (cool) {
    if (!o.youth && rnd() < 0.7) L.top = pick(['jacket', 'windbreaker', 'trench', 'bomber', 'denim', 'zipHoodie', 'fleece', 'coat', 'hoodie', 'sweater', 'cardigan', 'leather']);
    if (rnd() < 0.2) L.neck = pick(['scarf', 'scarfStripe']);
    if (rnd() < 0.2) L.shoeType = pick(['boots', 'ankleBoots']);
    noShorts();
  } else if (warm) {
    if (!o.youth && rnd() < 0.7) L.top = pick(['tee', 'tank', 'hawaii', 'polo', 'tee', 'blouse', 'vneck', 'tee']);
    if (!L.kid && rnd() < 0.45) L.bottom = pick(['shorts', 'denimShorts', 'skirt', 'sundress', 'bermuda', 'cargoShorts', 'shorts']);
    else if (L.kid && rnd() < 0.5) L.bottom = pick(['shorts', 'sundress', 'dungareeShorts']);
    if (rnd() < 0.25) L.shoeType = pick(['sandals', 'flipflops', 'sandals']);
    if (rnd() < 0.22) L.hat = pick(['cap', 'straw', 'bucket', 'visor']);
    if (rnd() < 0.3) L.glasses = 'sun';
  }
  if (kind === 'regn' && !L.kid && rnd() < 0.3) { L.top = 'raincoat'; if (rnd() < 0.6) L.shoeType = 'rubberBoots'; }
  return L;
}

// =====================================================================
//  Gångnätet
// =====================================================================
const CELL = 2, GW = Math.ceil((CW - LX) / CELL), GH = Math.ceil(CH / CELL);   // (v4) rutnätet börjar i LX
const DIRS8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
const cwMid = (c) => Math.round((c.x0 + c.x1) / 2);

// Rutnätet ritas med rektanglar: 0 = spärrat, 1 = gräs/grus (går att gå på), 2 = belagt
// (trottoar, gränd, gång, övergångsställe, parkering). Hindren (hus, rekvisita, stolpar) spärras sist.
function rasterNav(obstacles) {
  const G = new Uint8Array(GW * GH);
  const fill = (r, v) => {
    if (!r) return;
    const gx0 = Math.max(0, Math.ceil((r[0] - 1 - LX) / CELL)), gx1 = Math.min(GW - 1, Math.ceil((r[2] - 1 - LX) / CELL) - 1);
    const gy0 = Math.max(0, Math.ceil((r[1] - 1) / CELL)), gy1 = Math.min(GH - 1, Math.ceil((r[3] - 1) / CELL) - 1);
    for (let gy = gy0; gy <= gy1; gy++) G.fill(v, gy * GW + gx0, gy * GW + gx1 + 1);
  };
  const disc = (cx, cy, r, v) => {
    for (let gy = Math.floor((cy - r) / CELL); gy <= Math.ceil((cy + r) / CELL); gy++) for (let gx = Math.floor((cx - r - LX) / CELL); gx <= Math.ceil((cx + r - LX) / CELL); gx++) {
      if (gx < 0 || gy < 0 || gx >= GW || gy >= GH) continue;
      if (Math.hypot(gx * CELL + 1 + LX - cx, gy * CELL + 1 - cy) < r) G[gy * GW + gx] = v;
    }
  };
  // mellanbandet (parken, förortens gräsytor) går att gå på
  fill([LX, CITY.PARK[0], CW, (CITY.BACK_S || [462])[0]], 1);
  // bakgata, gränder och tvärgator i båda raderna
  fill([LX + 4, CITY.BACK[0] + 2, CW - 4, CITY.FOOT_TOP], 2);
  for (const s of STREETS_ALL) if (s.kind !== 'lot' && s.kind !== 'road') fill([Math.max(LX + 4, s.x0), s.y0 ?? CITY.BACK[1], Math.min(CW - 4, s.x1), s.y1 ?? BASE], 2);
  // trottoarerna och kajen
  fill([LX + 4, CITY.SIDEWALK_N[0], CW - 4, CITY.SIDEWALK_N[1]], 2);
  fill([LX + 4, CITY.SIDEWALK_S[0], CW - 4, CITY.SIDEWALK_S[1]], 2);
  if (CITY.SIDEWALK_SN) fill([LX + 4, CITY.SIDEWALK_SN[0], CW - 4, CITY.SIDEWALK_SN[1]], 2);
  if (CITY.SIDEWALK_SS) fill([LX + 4, CITY.SIDEWALK_SS[0], CW - 4, CITY.SIDEWALK_SS[1]], 2);
  if (CITY.QUAY) fill([LX + 4, CITY.QUAY[0], CW - 4, WALK_BOTTOM], 2);
  for (const p of PATHS) fill(p.rect, 2);
  // (v3) kajerna längs floden går norr–söder tvärs genom hela världen – men körbanorna vid
  // brofästena är fortfarande gata: där går man inte (bara vid övergångsställena, som överallt)
  for (const p of PATHS) if (p.kind === 'kaj') for (const r of [ROAD_N, ROAD_S]) fill([p.rect[0], r[0], p.rect[2], r[1]], 0);
  if (PARK.plaza) disc(PARK.plaza.cx, PARK.plaza.cy, PARK.plaza.r - 2, 2);
  // övergångsställena över de vågräta gatorna
  for (const c of CROSS_ALL) if (c.road !== 'infarten') fill([c.x0 + 6, c.y0 ?? ROAD_N[0], c.x1 - 6, c.y1 ?? ROAD_N[1]], 2);
  // tomterna: kyrkogården och lekplatsen är gräs/sand, parkeringen och återvinningen asfalt, skrottomten stängd
  for (const l of LOTS) fill(l.rect, l.kind === 'tomten' ? 0 : l.kind === 'parkering' || l.kind === 'atervinning' || l.kind === 'vagnsplatsen' ? 2 : 1);
  for (const b of ALL_B) if (b.yard) fill(b.yard.rect, 2);
  // Infarten: bilväg söder om Pixelgatan – bara zebrorna går att gå på
  if (CITY.INFARTEN) {
    fill([XI[0], ROAD_N[1], XI[1], ROAD_S[0]], 0);
    for (const c of CROSS_ALL) if (c.road === 'infarten') fill([c.x0, c.y0, c.x1, c.y1], 2);
  }
  // världens kanter (nedanför kajen bara piren och bryggan – v4)
  for (let gy = 0; gy < GH; gy++) { const y = gy * CELL + 1; if (y < CITY.BACK[0] + 2 || y > WALK_BOTTOM) G.fill(0, gy * GW, gy * GW + GW); }
  if (MAP.PIER) { fill(MAP.PIER.walk, 2); fill(MAP.PIER.deck, 2); }
  // hindren
  for (const o of obstacles) {
    if (!o || o.length < 4) continue;
    const x0 = Math.max(0, Math.floor((o[0] - 4 - LX) / CELL)), x1 = Math.min(GW - 1, Math.floor((o[2] + 3 - LX) / CELL));
    const y0 = Math.max(0, Math.floor((o[1] - 2) / CELL)), y1 = Math.min(GH - 1, Math.floor((o[3] + 1) / CELL));
    for (let gy = y0; gy <= y1; gy++) G.fill(0, gy * GW + x0, gy * GW + x1 + 1);
  }
  return G;
}

function buildNav(obstacles) {
  const G = rasterNav(obstacles);
  const cell = (x, y) => {
    const gx = Math.floor((x - LX) / CELL), gy = Math.floor(y / CELL);
    return gx < 0 || gy < 0 || gx >= GW || gy >= GH ? 0 : G[gy * GW + gx];
  };
  const walk = (x, y) => cell(x, y) > 0;
  const paved = (x, y) => cell(x, y) === 2;
  const grass = (x, y) => cell(x, y) === 1;
  const los = (ax, ay, bx, by, test) => {
    const n = Math.ceil(Math.hypot(bx - ax, by - ay));
    for (let i = 1; i < n; i++) if (!test(ax + (bx - ax) * i / n, ay + (by - ay) * i / n)) return false;
    return true;
  };
  function nearest(x, y, test, R = 12) {
    if (test(x, y)) return [x, y];
    for (let r = 1; r <= R; r++) {
      let best = null, bd = 1e9;
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r || !test(x + dx, y + dy)) continue;
        const d = dx * dx + dy * dy * 1.6;
        if (d < bd) { bd = d; best = [x + dx, y + dy]; }
      }
      if (best) return best;
    }
    return null;
  }
  // bredden-först i en ruta runt sträckan, sedan åtstramad med siktlinjer
  function gridPath(ax, ay, bx, by, test, pad = 36) {
    const gx0 = Math.max(0, Math.floor((Math.min(ax, bx) - pad - LX) / CELL)), gx1 = Math.min(GW - 1, Math.floor((Math.max(ax, bx) + pad - LX) / CELL));
    const gy0 = Math.max(0, Math.floor((Math.min(ay, by) - pad) / CELL)), gy1 = Math.min(GH - 1, Math.floor((Math.max(ay, by) + pad) / CELL));
    const w = gx1 - gx0 + 1, h = gy1 - gy0 + 1;
    const okc = (i, j) => test((gx0 + i) * CELL + 1 + LX, (gy0 + j) * CELL + 1);
    const si = Math.floor((ax - LX) / CELL) - gx0, sj = Math.floor(ay / CELL) - gy0, ti = Math.floor((bx - LX) / CELL) - gx0, tj = Math.floor(by / CELL) - gy0;
    if (si < 0 || sj < 0 || ti < 0 || tj < 0 || si >= w || ti >= w || sj >= h || tj >= h) return null;
    const start = sj * w + si, goal = tj * w + ti;
    const prev = new Int32Array(w * h).fill(-1), q = new Int32Array(w * h);
    let qh = 0, qt = 0;
    prev[start] = start; q[qt++] = start;
    while (qh < qt) {
      const cur = q[qh++];
      if (cur === goal) break;
      const ci = cur % w, cj = (cur / w) | 0;
      for (const [dx, dy] of DIRS8) {
        const ni = ci + dx, nj = cj + dy;
        if (ni < 0 || nj < 0 || ni >= w || nj >= h) continue;
        const k = nj * w + ni;
        if (prev[k] >= 0 || !okc(ni, nj)) continue;
        if (dx && dy && (!okc(ci + dx, cj) || !okc(ci, cj + dy))) continue;
        prev[k] = cur; q[qt++] = k;
      }
    }
    if (prev[goal] < 0) return null;
    const cells = [];
    for (let k = goal; k !== start; k = prev[k]) cells.push(k);
    cells.reverse();
    const P = cells.map((k) => [(gx0 + (k % w)) * CELL + 1 + LX, (gy0 + ((k / w) | 0)) * CELL + 1]);
    if (!P.length) return [[ax, ay], [bx, by]];
    P[P.length - 1] = [bx, by];
    const out = [[ax, ay]];
    let cx = ax, cy = ay, i = 0;
    while (i < P.length) {
      let j = P.length - 1;
      while (j > i && !los(cx, cy, P[j][0], P[j][1], test)) j--;
      out.push(P[j]); [cx, cy] = P[j]; i = j + 1;
    }
    return out;
  }

  const nodes = [], edges = [];
  const node = (x, y, tag) => {
    const p = nearest(Math.round(x), Math.round(y), paved, 12) || nearest(Math.round(x), Math.round(y), walk, 12);
    if (!p) return -1;
    // samma plats två gånger blir en nod
    for (let i = nodes.length - 1; i >= 0 && i > nodes.length - 400; i--) if (nodes[i].x === p[0] && nodes[i].y === p[1]) return i;
    nodes.push({ x: p[0], y: p[1], tag, adj: [], i: nodes.length });
    return nodes.length - 1;
  };
  function link(a, b, opt = {}) {
    if (a < 0 || b < 0 || a === b) return false;
    const A = nodes[a], B = nodes[b];
    if (A.adj.some((e) => e.a === b || e.b === b)) return true;
    let pts = los(A.x, A.y, B.x, B.y, paved) ? [[A.x, A.y], [B.x, B.y]] : null;
    if (!pts) pts = gridPath(A.x, A.y, B.x, B.y, paved) || gridPath(A.x, A.y, B.x, B.y, walk);
    if (!pts) return false;
    let len = 0;
    for (let k = 1; k < pts.length; k++) len += Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]);
    // gräs kostar lite extra – man går hellre på gångarna
    let soft = 0;
    for (let k = 1; k < pts.length; k++) { const mx = (pts[k][0] + pts[k - 1][0]) / 2, my = (pts[k][1] + pts[k - 1][1]) / 2; if (grass(mx, my)) soft += Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]) * 0.5; }
    const e = { a, b, pts, len, cross: opt.cross ?? -1, cost: len + soft + (opt.extra || 0) };
    edges.push(e); A.adj.push(e); B.adj.push(e);
    return true;
  }
  // en rak gånglinje med noder vid alla x (sammanslagna inom 6 px, utfyllda var 110:e px)
  function line(y, xs, tag, xa = LX + 6, xb = CW - 6) {
    const sorted = [...xs].map(Math.round).filter((x) => x >= xa && x <= xb).sort((a, b) => a - b), out = [];
    for (const x of sorted) {
      if (out.length && x - out[out.length - 1] < 6) continue;
      if (out.length) {
        const prev = out[out.length - 1], n = Math.floor((x - prev) / 110);
        for (let k = 1; k <= n; k++) out.push(Math.round(prev + (x - prev) * k / (n + 1)));
      }
      out.push(x);
    }
    const ids = [];
    for (const x of out) { const i = node(x, y, tag); if (i >= 0 && !ids.includes(i)) ids.push(i); }
    for (let k = 1; k < ids.length; k++) link(ids[k - 1], ids[k]);
    return ids;
  }
  const at = (ids, x, y) => ids.reduce((best, i) => (Math.abs(nodes[i].x - x) + (y === undefined ? 0 : Math.abs(nodes[i].y - y) * 2) < Math.abs(nodes[best].x - x) + (y === undefined ? 0 : Math.abs(nodes[best].y - y) * 2) ? i : best), ids[0]);
  const nearNode = (x, y, ids = null, maxD = 160) => {
    let best = -1, bd = maxD;
    for (const n of ids ? ids.map((i) => nodes[i]) : nodes) { const d = Math.hypot(n.x - x, n.y - y); if (d < bd) { bd = d; best = n.i; } }
    return best;
  };

  const gapsOf = (row) => STREETS_ALL.filter((s) => s.row === row && (s.kind === 'alley' || s.kind === 'street' || s.kind === 'edge'))
    .map((s) => ({ s, x0: Math.max(s.x0, LX + 5), x1: Math.min(s.x1, CW - 5) }))
    .filter((g) => g.x1 - g.x0 >= 10)
    .map((g) => ({ ...g, cx: Math.round((g.x0 + g.x1) / 2) }));
  const gN = gapsOf('n'), gS = gapsOf('s');
  const cwP = CROSS_ALL.filter((c) => (c.road || 'pixelgatan') === 'pixelgatan');
  const cwS = CROSS_ALL.filter((c) => c.road === 'sodergatan');
  const dX = (b) => Math.round(doorCenter(b).x);
  const rowN = ALL_B.filter((b) => b.row === 'n' || !b.row), rowS = ALL_B.filter((b) => b.row === 's'), rowF = ALL_B.filter((b) => b.row === 'f');
  const stopsP = BUS_STOPS.filter((s) => (s.road || 'pixelgatan') === 'pixelgatan'), stopsS = BUS_STOPS.filter((s) => s.road === 'sodergatan');
  const pl = PARK.plaza, prom = PARK.promenade;
  const walks = (PARK.walks || []).map((r) => Math.round((r[0] + r[2]) / 2));
  const lot = (id) => LOTS.find((l) => l.id === id) || null;
  const kyrk = lot('kyrkogard'), lekX = lot('lekplats_x'), grus = lot('grusplan'), park = lot('parkering'), aterv = lot('atervinning'), vagn = lot('vagnsplatsen');
  const gate = (l, side) => (l?.gates || []).find((g) => g.side === side) || null;
  const gmid = (g) => Math.round((g.x0 + g.x1) / 2);
  const infW = XI[0] - 7, infE = XI[1] + 7;
  const subPaths = (SUB.paths || []).map((r) => Math.round((r[0] + r[2]) / 2));
  // v3: kajerna längs floden (en nod på varje gånglinje, sedan kajpromenaden norr–söder),
  // broarnas brofästen (gånglinjerna bryts vid vattnet och fortsätter bara över däcken) och
  // Finanstorgets stråk (x där torget knyts till trottoaren och bakgatan)
  const QX = RIV ? [Math.round((RIV.quayW[0] + RIV.quayW[2]) / 2) - 2, Math.round((RIV.quayE[0] + RIV.quayE[2]) / 2) + 4] : [];
  const BRX = RIV ? [RIV.wx0 + 6, RIV.wx1 - 6] : [];
  const PLX = DTL ? [DTL.plaza[0] + 22, ...(DTL.fountains || []).map((f) => f.x), DTL.axis, DTL.plaza[2] - 30].map(Math.round) : [];
  // v4: Linnéstaden – där torget, odlingens grind och Lindparkens gångar knyts till trottoaren och parkgången
  const LNX = LIN ? [LIN.torg[0] + 30, LIN.well.x, LIN.torg[2] - 30, -1116, ...LIN.walks.map((r) => Math.round((r[0] + r[2]) / 2)), LIN.promenade[0] + 6].map(Math.round) : [];

  // ---- gånglinjerna ----
  const Bk = line(Y_BACK, [LX + 6, CW - 6, ...gN.map((g) => g.cx), ...QX], 'b');
  const N = line(Y_N, [LX + 6, CW - 6, ...gN.map((g) => g.cx), ...rowN.map(dX), ...cwP.map(cwMid), ...QX, ...BRX], 'n');
  const S = line(Y_S, [LX + 6, CW - 6, ...cwP.map(cwMid), ...stopsP.flatMap((s) => [s.x - 42, s.x + 30, s.x + 44]), infW, infE, ...subPaths, ...QX, ...BRX, ...PLX, ...LNX,
    ...(lekX && gate(lekX, 'n') ? [gmid(gate(lekX, 'n'))] : []), ...(grus && gate(grus, 'n') ? [gmid(gate(grus, 'n'))] : []), ...(park?.drive ? [Math.round((park.drive[0] + park.drive[1]) / 2)] : [])], 's');
  const Pm = prom ? line(Y_PROM, [prom[0] + 4, prom[2] - 4, ...cwP.filter((c) => c.x1 <= prom[2]).map(cwMid), pl.cx - 40, pl.cx + 40, ...walks, ...(PARK.dogGate ? [Math.round((PARK.dogGate[0] + PARK.dogGate[1]) / 2)] : [])], 'p', prom[0], prom[2]) : [];
  const BkS = CITY.BACK_S ? line(Y_BKS, [LX + 6, CW - 6, ...walks, ...gS.map((g) => g.cx), ...rowF.filter((b) => Math.abs(baseOf(b) + 9 - Y_BKS) < 26).map(dX), infW, infE, ...subPaths, ...QX, ...PLX, ...LNX,
    ...(kyrk && gate(kyrk, 'n') ? [gmid(gate(kyrk, 'n'))] : []), ...(lekX && gate(lekX, 's') ? [gmid(gate(lekX, 's'))] : []), ...(grus && gate(grus, 's') ? [gmid(gate(grus, 's'))] : []),
    ...(aterv ? [Math.round((aterv.rect[0] + aterv.rect[2]) / 2)] : []), ...(vagn ? [Math.round((vagn.rect[0] + vagn.rect[2]) / 2)] : [])], 'k') : [];
  const SN = CITY.SIDEWALK_SN ? line(Y_SN, [LX + 6, CW - 6, ...gS.map((g) => g.cx), ...rowS.map(dX), ...cwS.map(cwMid), infW, infE, ...(kyrk && gate(kyrk, 's') ? [gmid(gate(kyrk, 's'))] : []),
    ...rowF.filter((b) => Math.abs(baseOf(b) + 9 - Y_SN) < 30).map(dX), ...(aterv ? [Math.round((aterv.rect[0] + aterv.rect[2]) / 2)] : []), ...(vagn ? [Math.round((vagn.rect[0] + vagn.rect[2]) / 2)] : []), ...QX, ...BRX], 'sn') : [];
  const SS = CITY.SIDEWALK_SS ? line(Y_SS, [LX + 6, CW - 6, ...cwS.map(cwMid), ...stopsS.flatMap((s) => [s.x - 42, s.x + 30, s.x + 44]), ...QX, ...BRX], 'ss') : [];
  const PIERX = MAP.PIER ? Math.round((MAP.PIER.walk[0] + MAP.PIER.walk[2]) / 2) : null;
  const Q = CITY.QUAY ? line(Y_Q, [LX + 6, CW - 6, ...QX, ...(PIERX !== null ? [PIERX] : [])], 'q') : [];
  // v4: piren – från kajen ner till bryggan framför Sjöboden
  const pierNodes = [];
  if (MAP.PIER && Q.length) {
    const P = MAP.PIER, dy = P.deck[1] + 22;
    const ids = [node(PIERX, Y_Q + 12, 'pir'), node(PIERX, 830, 'pir'), node(PIERX, dy, 'pir'), node(Math.round((P.deck[0] + P.walk[0]) / 2), dy, 'pir'), node(P.deck[0] + 14, dy, 'pir')];
    link(at(Q, PIERX), ids[0]);
    for (let k = 1; k < ids.length; k++) link(ids[k - 1], ids[k]);
    pierNodes.push(...ids.filter((i) => i >= 0));
  }

  // ---- tvärförbindelser ----
  // gränder och tvärgator i norra raden: bakgatan ↔ trottoaren
  for (const g of gN) link(at(Bk, g.cx), at(N, g.cx));
  // övergångsställena (Pixelgatan med trafikljus; Betonggatans är trasigt – där väjer bilarna)
  const curbs = [];
  for (const c of cwP) {
    const x = cwMid(c);
    const kN = node(x, CURB_N, 'kant'), kS = node(x, CURB_S, 'kant');
    link(at(N, x), kN);
    link(kN, kS, { cross: c.i, extra: 50 });
    link(kS, at(S, x));
    curbs.push(kN, kS);
  }
  for (const c of cwS) {
    if (!SN.length || !SS.length) break;
    const x = cwMid(c);
    const kN = node(x, CURB_SN, 'kant'), kS = node(x, CURB_SS, 'kant');
    link(at(SN, x), kN);
    link(kN, kS, { cross: c.i, extra: 50 });
    link(kS, at(SS, x));
    curbs.push(kN, kS);
  }
  // parkgångarna: trottoaren ↔ promenaden (v1) och promenaden ↔ parkgången (v2)
  for (const r of PARK.paths || []) { const x = Math.round((r[0] + r[2]) / 2); if (Pm.length) link(at(S, x), at(Pm, x)); }
  // torget: en ring runt fontänen
  const ring = [];
  if (pl) {
    for (let k = 0; k < 8; k++) {
      const a = k * Math.PI / 4;
      const i = node(pl.cx + Math.cos(a) * (pl.r - 8), pl.cy + Math.sin(a) * (pl.r - 8), 'torg');
      if (i >= 0 && !ring.includes(i)) ring.push(i);
    }
    for (let k = 0; k < ring.length; k++) link(ring[k], ring[(k + 1) % ring.length]);
  }
  const ringNear = (x, y) => ring.reduce((b, i) => (Math.hypot(nodes[i].x - x, nodes[i].y - y) < Math.hypot(nodes[b].x - x, nodes[b].y - y) ? i : b), ring[0]);
  if (ring.length && Pm.length) {
    link(ringNear(pl.cx, pl.cy - pl.r), at(Pm, pl.cx));
    link(ringNear(pl.cx - pl.r, pl.cy - pl.r * 0.7), at(Pm, pl.cx - 40));
    link(ringNear(pl.cx + pl.r, pl.cy - pl.r * 0.7), at(Pm, pl.cx + 40));
  }
  for (const r of PARK.walks || []) {
    const x = Math.round((r[0] + r[2]) / 2);
    if (!BkS.length) break;
    if (ring.length && r[1] > Y_PROM + 30) link(ringNear(x, r[1]), at(BkS, x));
    else if (Pm.length) link(at(Pm, x), at(BkS, x));
  }
  // Infartens trottoarer genom mellanbandet
  if (BkS.length) { link(at(S, infW), at(BkS, infW, Y_BKS)); link(at(S, infE), at(BkS, infE, Y_BKS)); }
  if (BkS.length && SN.length) link(at(BkS, infE), at(SN, infE));
  // förortens stig från hållplatsen till gångvägen
  for (const x of subPaths) if (BkS.length) link(at(S, x), at(BkS, x));
  // gränderna i södra raden: parkgången ↔ trottoaren
  for (const g of gS) if (BkS.length && SN.length) link(at(BkS, g.cx), at(SN, g.cx));
  // kajen: några trappor ner från bortre trottoaren
  if (Q.length && SS.length) for (let x = LX + 120; x < CW - 60; x += 240) link(at(SS, x), at(Q, x));
  // v3: kajpromenaden längs floden – från bakgatan ner till kanalkajen på båda stränderna
  // (gatorna korsas inte här: där bryts länken av sig själv, man går till övergångsstället)
  const quayNodes = [];
  for (const qx of QX) {
    const chain = [Bk, N, S, BkS, SN, SS, Q].filter((L) => L.length).map((L) => at(L, qx)).filter((i) => i >= 0 && Math.abs(nodes[i].x - qx) < 12);
    for (let k = 1; k < chain.length; k++) link(chain[k - 1], chain[k]);
    quayNodes.push(...chain);
  }
  // v3: Finanstorget – en ring kring tjuren, ringar kring fontänerna och två tvärstråk (norr och söder
  // om statyn), knutna till trottoaren (Pixelgatan) och bakgatan bakom den södra raden
  const plazaRing = [], fountRings = [], plazaAll = [];
  if (DTL && S.length) {
    const [px0, py0, px1, py1] = DTL.plaza, st = DTL.statue, yN = py0 + 16, yS = py1 - 14;
    const ringAt = (cx, cy, rx, ry, n, tag) => {
      const ids = [];
      for (let k = 0; k < n; k++) { const a = k * 2 * Math.PI / n; const i = node(cx + Math.cos(a) * rx, cy + Math.sin(a) * ry, tag); if (i >= 0 && !ids.includes(i)) ids.push(i); }
      for (let k = 0; k < ids.length; k++) link(ids[k], ids[(k + 1) % ids.length]);
      return ids;
    };
    if (st) plazaRing.push(...ringAt(st.x, st.y, 46, 27, 10, 'tjur'));
    for (const f of DTL.fountains || []) fountRings.push(ringAt(f.x, f.y, 42, 23, 8, 'fontän'));
    const top = line(yN, [px0 + 10, px1 - 12, ...PLX], 'torgN', px0 + 6, px1 - 6);
    // det södra stråket går bara mellan skyskraporna i den södra raden: bakom ett högt hus skulle
    // bara huvudet sticka upp över taket (hela figuren skyms först på bakgatan)
    let bx0 = px0 + 10, bx1 = px1 - 12;
    for (const t of ALL_B.filter((b) => b.row === 's' && b.h >= 150 && b.x < px1 && b.x + b.w > px0)) {
      if (t.x + t.w / 2 < (px0 + px1) / 2) bx0 = Math.max(bx0, t.x + t.w + 6); else bx1 = Math.min(bx1, t.x - 6);
    }
    const bot = bx1 - bx0 > 40 ? line(yS, [bx0, bx1, ...PLX], 'torgS', bx0, bx1) : [];
    plazaAll.push(...plazaRing, ...fountRings.flat(), ...top, ...bot);
    for (const x of PLX) { if (top.length) link(at(S, x), at(top, x)); if (BkS.length && bot.length && x >= bx0 && x <= bx1) link(at(bot, x), at(BkS, x)); }
    const closest = (ids, x, y) => ids.reduce((b, i) => (Math.hypot(nodes[i].x - x, nodes[i].y - y) < Math.hypot(nodes[b].x - x, nodes[b].y - y) ? i : b), ids[0]);
    for (const R of [plazaRing, ...fountRings]) {
      if (!R.length || !top.length || !bot.length) continue;
      const cx = R.reduce((s, i) => s + nodes[i].x, 0) / R.length, cy = R.reduce((s, i) => s + nodes[i].y, 0) / R.length;
      link(closest(R, cx, cy - 40), closest(top, cx, yN)); link(closest(R, cx, cy + 40), closest(bot, cx, yS));
      link(closest(R, cx - 70, cy), closest(top, cx - 60, yN)); link(closest(R, cx + 70, cy), closest(bot, cx + 60, yS));
    }
  }
  // noderna på broarnas trottoarer (över vattnet) – där stannar man vid räcket och tittar ut
  const onBridge = (i) => !!RIV && nodes[i].x > RIV.wx0 + 14 && nodes[i].x < RIV.wx1 - 14;
  const bridgeNodes = { n: N.filter(onBridge), s: S.filter(onBridge), sn: SN.filter(onBridge), ss: SS.filter(onBridge) };

  // ---- tomterna ----
  const special = {};
  const gateNode = (l, side, dy) => { const g = gate(l, side); if (!g) return -1; return side === 'w' ? node(l.rect[0] + (dy || 0), Math.round((g.y0 + g.y1) / 2), 'grind') : node(gmid(g), (side === 'n' ? l.rect[1] : l.rect[3]) + (dy || 0), 'grind'); };
  if (kyrk && BkS.length && SN.length) {
    const gn = gateNode(kyrk, 'n', 6), gs = gateNode(kyrk, 's', -6), mid = node((kyrk.rect[0] + kyrk.rect[2]) / 2, (kyrk.rect[1] + kyrk.rect[3]) / 2, 'kyrk');
    if (gn >= 0) { link(at(BkS, nodes[gn].x), gn); link(gn, mid); }
    if (gs >= 0) { link(at(SN, nodes[gs].x), gs); link(gs, mid); }
    special.kyrk = mid;
  }
  if (lekX) {
    const gn = gateNode(lekX, 'n', 6), gs = gateNode(lekX, 's', -6), mid = node((lekX.rect[0] + lekX.rect[2]) / 2, (lekX.rect[1] + lekX.rect[3]) / 2 + 6, 'lek');
    if (gn >= 0) { link(at(S, nodes[gn].x), gn); link(gn, mid); }
    if (gs >= 0 && BkS.length) { link(at(BkS, nodes[gs].x), gs); link(gs, mid); }
    special.lekX = mid;
  }
  if (grus) {
    const gn = gateNode(grus, 'n', 6), gs = gateNode(grus, 's', -6), gw = gateNode(grus, 'w', 6), mid = node((grus.rect[0] + grus.rect[2]) / 2, (grus.rect[1] + grus.rect[3]) / 2, 'grus');
    if (gn >= 0) { link(at(S, nodes[gn].x), gn); link(gn, mid); }
    if (gs >= 0 && BkS.length) { link(at(BkS, nodes[gs].x), gs); link(gs, mid); }
    if (gw >= 0) link(gw, mid);
    special.grus = mid;
  }
  if (park) {
    const x = park.drive ? Math.round((park.drive[0] + park.drive[1]) / 2) : park.rect[0] + 30;
    const a = node(x, park.rect[1] + 12, 'p-lot'), b = node((park.rect[0] + park.rect[2]) / 2, park.rect[3] - 10, 'p-lot');
    link(at(S, x), a); link(a, b); if (BkS.length) link(b, at(BkS, nodes[b]?.x ?? x));
    special.parkering = b;
  }
  if (aterv && BkS.length && SN.length) link(at(BkS, (aterv.rect[0] + aterv.rect[2]) / 2), at(SN, (aterv.rect[0] + aterv.rect[2]) / 2));
  if (vagn && BkS.length && SN.length) link(at(BkS, (vagn.rect[0] + vagn.rect[2]) / 2), at(SN, (vagn.rect[0] + vagn.rect[2]) / 2));
  // parkens lekplats och hundrastgården
  if (PARK.playground && BkS.length) {
    const r = PARK.playground, mid = node((r[0] + r[2]) / 2, (r[1] + r[3]) / 2, 'lek');
    link(mid, at(BkS, nodes[mid]?.x ?? r[0]));
    if (Pm.length) link(mid, nearNode(nodes[mid].x, nodes[mid].y - 60, Pm, 140));
    special.lekP = mid;
  }
  if (PARK.dogPark && PARK.dogGate && Pm.length) {
    const r = PARK.dogPark, gx = Math.round((PARK.dogGate[0] + PARK.dogGate[1]) / 2);
    const out = node(gx, r[1] - 8, 'hund'), inn = node(gx, r[1] + 14, 'hund');
    link(at(Pm, gx), out); link(out, inn);
    special.dogIn = inn;
  }

  // v4: Linnéstaden – Marknadstorget (en ring kring brunnen och två stråk tvärs över torget, knutna till
  // trottoaren och parkgången), Lindparkens promenad (in mot centrums promenad), en ring kring
  // musikpaviljongen och stadsodlingen (norra grinden → gångarna mellan pallkragarna → östra grinden)
  const linneAll = [];
  if (LIN && S.length) {
    const [tx0, ty0, tx1, ty1] = LIN.torg, W0 = LIN.well;
    const ringAround = (cx, cy, rx, ry, n, tag) => {
      const ids = [];
      for (let k = 0; k < n; k++) { const a = k * 2 * Math.PI / n; const i = node(cx + Math.cos(a) * rx, cy + Math.sin(a) * ry, tag); if (i >= 0 && !ids.includes(i)) ids.push(i); }
      for (let k = 0; k < ids.length; k++) link(ids[k], ids[(k + 1) % ids.length]);
      return ids;
    };
    const closest = (ids, x, y) => ids.reduce((b, i) => (Math.hypot(nodes[i].x - x, nodes[i].y - y) < Math.hypot(nodes[b].x - x, nodes[b].y - y) ? i : b), ids[0]);
    const inT = LNX.filter((x) => x > tx0 && x < tx1);
    const tN = line(ty0 + 12, [tx0 + 10, tx1 - 10, ...inT], 'linneN', tx0 + 6, tx1 - 6);
    const tS = line(ty1 - 8, [tx0 + 10, tx1 - 10, ...inT], 'linneS', tx0 + 6, tx1 - 6);
    const wR = ringAround(W0.x, W0.y, 44, 28, 10, 'brunn');
    for (const x of inT) { if (tN.length) link(at(S, x), at(tN, x)); if (tS.length && BkS.length) link(at(tS, x), at(BkS, x)); }
    if (wR.length && tN.length && tS.length) { link(closest(wR, W0.x, W0.y - 30), closest(tN, W0.x, ty0)); link(closest(wR, W0.x, W0.y + 30), closest(tS, W0.x, ty1)); link(closest(wR, W0.x - 50, W0.y), closest(tN, W0.x - 60, ty0)); link(closest(wR, W0.x + 50, W0.y), closest(tS, W0.x + 60, ty1)); }
    // Lindparken
    const pr = LIN.promenade, py = Math.round((pr[1] + pr[3]) / 2), wx = LIN.walks.map((r) => Math.round((r[0] + r[2]) / 2)).filter((x) => x > pr[0]);
    const LP = line(py, [pr[0] + 4, pr[2] - 4, LIN.pavilion.x, ...wx], 'lindpark', pr[0] + 2, pr[2] - 2);
    if (LP.length) {
      if (tN.length) link(at(LP, pr[0] + 4), closest(tN, tx1 - 10, ty0));
      if (Pm.length) link(at(LP, pr[2] - 4), at(Pm, prom[0] + 4));
      for (const x of wx) if (BkS.length) link(at(LP, x), at(BkS, x));
      const pv = LIN.pavilion, pR = ringAround(pv.x, pv.y + 2, pv.rx + 10, pv.ry + 8, 10, 'paviljong');
      if (pR.length) { link(closest(pR, pv.x, pv.y - 30), at(LP, pv.x)); if (BkS.length) link(closest(pR, pv.x, pv.y + 30), at(BkS, pv.x)); }
      linneAll.push(...LP, ...pR);
    }
    // stadsodlingen
    const gN = node(-1116, LIN.odling[1] + 5, 'odling'), gE = node(LIN.odling[2] - 6, 352, 'odling');
    const inner = [node(-1138, LIN.odling[1] + 5, 'odling'), node(-1138, 418, 'odling'), node(-1090, 418, 'odling'), node(-1090, 352, 'odling')];
    if (gN >= 0) link(at(S, -1116), gN);
    link(gN, inner[0]); link(inner[0], inner[1]); link(inner[1], inner[2]); link(inner[2], inner[3]); link(inner[3], gE);
    if (gE >= 0 && tN.length) link(gE, closest([...tN, ...tS], tx0, 352));
    special.odling = inner[1];
    linneAll.push(...tN, ...tS, ...wR, ...inner.filter((i) => i >= 0));
  }
  // ---- dörrarna ----
  const doorNode = {};
  for (const b of rowN) if (N.length) doorNode[b.id] = at(N, dX(b));
  for (const b of rowS) if (SN.length) doorNode[b.id] = at(SN, dX(b));
  for (const b of rowF) {
    const i = node(dX(b), baseOf(b) + 9, 'dörr');
    if (i < 0) continue;
    // de två närmaste noderna på gånglinjerna (gräs går bra – man kliver av gången fram till kiosken)
    const cand = nodes.filter((n) => n.i !== i && n.tag !== 'kant' && n.tag !== 'dörr').map((n) => [n.i, Math.hypot(n.x - nodes[i].x, (n.y - nodes[i].y) * 1.2)]).sort((a, b) => a[1] - b[1]);
    let k = 0;
    for (const [j, d] of cand) { if (d > 150 || k >= 2) break; if (link(i, j)) k++; }
    doorNode[b.id] = i;
  }
  const lineOf = (b) => (b.row === 's' ? SN : b.row === 'f' ? null : N);

  function route(from, to) {
    if (from === to) return [];
    const n = nodes.length, dist = new Float64Array(n).fill(Infinity), via = new Array(n).fill(null), done = new Uint8Array(n);
    // binär hög av [avstånd, nod]
    const H = [];
    const push = (d, i) => { H.push([d, i]); let k = H.length - 1; while (k > 0) { const p = (k - 1) >> 1; if (H[p][0] <= H[k][0]) break; const t = H[p]; H[p] = H[k]; H[k] = t; k = p; } };
    const pop = () => {
      const top = H[0], last = H.pop();
      if (H.length) {
        H[0] = last;
        for (let k = 0; ;) {
          const l = 2 * k + 1, r = l + 1; let m = k;
          if (l < H.length && H[l][0] < H[m][0]) m = l;
          if (r < H.length && H[r][0] < H[m][0]) m = r;
          if (m === k) break;
          const t = H[m]; H[m] = H[k]; H[k] = t; k = m;
        }
      }
      return top;
    };
    dist[from] = 0; push(0, from);
    while (H.length) {
      const [d, u] = pop();
      if (done[u]) continue;
      done[u] = 1;
      if (u === to) break;
      for (const e of nodes[u].adj) {
        const v = e.a === u ? e.b : e.a, nd = d + e.cost;
        if (nd < dist[v]) { dist[v] = nd; via[v] = e; push(nd, v); }
      }
    }
    if (!via[to]) return null;
    const segs = [];
    for (let v = to; v !== from;) { const e = via[v], u = e.a === v ? e.b : e.a; segs.push([e, u]); v = u; }
    segs.reverse();
    const pts = [];
    for (const [e, u] of segs) {
      const P = e.a === u ? e.pts : [...e.pts].reverse();
      for (let k = 1; k < P.length; k++) pts.push({ x: P[k][0], y: P[k][1], gate: k === 1 ? e.cross : -1 });
    }
    return pts;
  }
  // gångväg mellan två godtyckliga punkter (rak om det går, annars runt hindren)
  function pathTo(ax, ay, bx, by, pad = 36) {
    if (los(ax, ay, bx, by, walk)) return [{ x: bx, y: by, gate: -1, noOff: true }];
    const P = gridPath(ax, ay, bx, by, paved, pad) || gridPath(ax, ay, bx, by, walk, pad);
    return P ? P.slice(1).map(([x, y]) => ({ x, y, gate: -1, noOff: true })) : null;
  }

  // ---- fönstren man kan stanna vid ----
  const windows = [];
  for (const b of [...rowN, ...rowS]) {
    if (!WINDOW_SHOPS.includes(b.id) || !doorNode[b.id] && doorNode[b.id] !== 0) continue;
    const L = lineOf(b);
    if (!L || !L.length) continue;
    const base = baseOf(b), half = (b.door.x1 - b.door.x0) / 2 + 12, dc = dX(b);
    for (let x = b.x + 12; x < b.x + b.w - 12; x += 9) {
      if (Math.abs(x - dc) < half) continue;
      const nn = at(L, x), ny = nodes[nn].y, wy = base + 7;
      if (paved(x, wy) && paved(x, ny) && los(nodes[nn].x, ny, x, ny, paved) && los(x, ny, x, wy, paved)) windows.push({ b, x, y: wy, node: nn, ny });
    }
  }

  // ---- busshållplatserna: väntplatser runt kuren, närmast kanten och skylten först ----
  const stops = [];
  for (const s of BUS_STOPS) {
    const L = s.road === 'sodergatan' ? SS : S;
    if (!L.length) continue;
    const w = s.wait || { x: s.x + 30, y: s.y - 3 };
    const nd = at(L, w.x);
    const B0 = nodes[nd], curb = s.road === 'sodergatan' ? CURB_SS : CURB_S;
    const cand = [];
    for (let x = s.x - 50; x <= s.x + 56; x += 6) for (let y = curb + 3; y <= s.y + 1; y += 4) {
      if (!paved(x, y)) continue;
      cand.push({ x, y, s: Math.abs(x - (s.x + 12)) * 0.5 + Math.abs(y - (curb + 8)) * 0.9 });
    }
    cand.sort((a, b) => a.s - b.s);
    const spots = [];
    for (const c of cand) {
      if (spots.length >= 8) break;
      if (spots.some((b) => Math.abs(b.x - c.x) < 8 && Math.abs(b.y - c.y) < 6)) continue;
      const there = pathTo(B0.x, B0.y, c.x, c.y);
      if (!there || there.length > 6) continue;
      const back = pathTo(c.x, c.y, B0.x, B0.y);
      if (!back) continue;
      // under kurens tak (då behövs inget paraply)
      const roof = Math.abs(c.x - s.x) < 32 && c.y < s.y + 1 && c.y > s.y - 18;
      spots.push({ x: c.x, y: c.y, busy: null, there, back, roof });
    }
    stops.push({ s, node: nd, spots, curb, road: s.road || 'pixelgatan', served: false });
  }

  const endsOf = (ids) => (ids.length ? [ids[0], ids[ids.length - 1]].filter((i) => nodes[i].x < LX + 16 || nodes[i].x > CW - 16).map((i) => ({ n: i, dir: nodes[i].x < (LX + CW) / 2 ? -1 : 1 })) : []);
  const exits = [...endsOf(N), ...endsOf(S), ...endsOf(SN), ...endsOf(SS), ...endsOf(Q), ...endsOf(BkS), ...endsOf(Bk).map((e) => ({ ...e, back: true }))];
  const curbSet = new Set(curbs);
  const spawnNodes = [...N, ...S, ...Pm, ...BkS, ...SN, ...SS, ...Q, ...plazaAll, ...linneAll, ...pierNodes].filter((i) => !curbSet.has(i));
  const parkNodes = [...Pm, ...ring, ...BkS.filter((i) => nodes[i].x < XI[0]), ...linneAll, ...pierNodes, ...['lekP', 'kyrk', 'lekX', 'grus', 'parkering', 'odling'].map((k) => special[k]).filter((i) => i >= 0)];
  const lines = { Bk, N, S, Pm, BkS, SN, SS, Q };
  // v3: de långa linjerna bryts vid floden – runs() delar en linje i sammanhängande bitar (joggarna)
  const linked = (a, b) => nodes[a].adj.some((e) => e.a === b || e.b === b);
  const runs = (ids) => {
    const out = [];
    let cur = [];
    for (const i of ids) { if (cur.length && !linked(cur[cur.length - 1], i)) { out.push(cur); cur = []; } cur.push(i); }
    if (cur.length) out.push(cur);
    return out;
  };
  const plaza = { ring: plazaRing, fountains: fountRings, all: plazaAll };

  return { G, walk, paved, grass, los, nearest, pathTo, gridPath, nodes, edges, route, lines, ring, doorNode, windows, stops, exits, spawnNodes, parkNodes, special, nearNode, at,
    runs, plaza, quayNodes, bridgeNodes, quayX: QX };
}

// =====================================================================
//  createLife
// =====================================================================
export function createLife(env, traffic, props) {
  const T = traffic || {};
  const PR = () => props || env.props || null;
  const green = (i) => { try { return typeof T.pedGreen === 'function' ? !!T.pedGreen(i) : true; } catch { return true; } };
  const S = buildSprites();
  const nav = buildNav(env.obstacles || []);
  const { nodes, walk, paved } = nav;
  const W = () => env.weather || { kind: env.rain ? 'regn' : 'sol', intensity: 0.6, snowCover: 0, season: 'sommar', temp: 15, wind: 0 };

  // ---------- kameran ----------
  let cam = { x: 0, y: 0 };
  const updCam = () => {
    const v = env.view;
    if (v && v.w) { cam = { x: v.x, y: v.y }; return; }
    const px = env.player?.x ?? CW / 2, py = env.player?.y ?? 200;
    cam = { x: clamp(px - VW / 2, LX, CW - VW), y: clamp(py - VH * 0.62, 0, CH - VH) };
  };
  const visible = (x, y, m = 16) => x > cam.x - m && x < cam.x + VW + m && y > cam.y - m && y < cam.y + VH + 44;
  const camCX = () => cam.x + VW / 2, camCY = () => cam.y + VH / 2;
  const camD = (x, y) => Math.hypot(x - camCX(), (y - camCY()) * 1.25);

  // ---------- sittplatserna (bänkar och kurer) ----------
  // Rekvisitan (props.seats()) äger platserna. Saknas den räknas de ut ur hindren:
  // en bänk är ett 27×4-hinder, kurerna står vid hållplatserna.
  let seatSrc = null, seatList = [];
  const seatUse = new Map();         // plats-id → fotgängare
  const seatMeta = new Map();        // plats-id → { node, there, back } (lat)
  function fallbackSeats() {
    const out = [];
    const add = (kind, xs, y, dir, walkY, extra = {}) => { const bench = `${kind}@${xs[0]},${y}`; xs.forEach((sx, i) => out.push({ id: `${bench}:${i}`, kind, x: sx, y, dir, walk: { x: sx, y: walkY }, bench, ...extra })); };
    for (const o of env.obstacles || []) {
      if (!o || o[2] - o[0] !== 27 || o[3] - o[1] !== 4) continue;
      const x = o[0] + 13, y = o[3];
      // bakifrån sedda bänkar: parkens nedre del, kyrkogården och kajen
      const back = x < XI[0] && ((y > 348 && y < 452) || (y > 494 && y < 640 && x > 1000 && x < 1212) || y > 740);
      if (back) add('bank', [x - 7, x + 6], y - 6, 'up', y - 9); else add('bank', [x - 7, x + 6], y + 1, 'down', y + 5);
    }
    BUS_STOPS.forEach((s, k) => {
      const by = k === 0 ? CITY.SIDEWALK_S[0] + 10 : s.y - 13;
      add('busskur', s.broken ? [s.x - 21] : [s.x - 20, s.x - 7], by + 6, 'down', by + 10, { stop: s.id, ...(s.broken ? { broken: true } : {}) });
    });
    return out;
  }
  function seats() {
    const P = PR();
    let raw = null;
    if (P && typeof P.seats === 'function') raw = safe(() => P.seats(), null);
    else if (Array.isArray(env.seats)) raw = env.seats;
    if (raw && raw.length) {
      if (raw !== seatSrc || raw.length !== seatList.length) {
        seatSrc = raw;
        seatList = raw.filter((s) => s && Number.isFinite(s.x) && Number.isFinite(s.y)).map((s) => ({
          id: s.id ?? `${s.x},${s.y}`, kind: s.kind || 'bank', x: s.x, y: s.y, dir: s.dir || s.face || (s.back ? 'up' : 'down'),
          walk: s.walk || { x: s.x, y: s.y + ((s.dir || s.face) === 'up' ? -3 : 4) }, stop: s.stop ?? null, broken: !!s.broken, bench: s.bench ?? s.id,
        }));
      }
    } else if (!seatSrc) { seatSrc = 'egna'; seatList = fallbackSeats(); }
    return seatList;
  }
  const npcAt = (x, y, r) => { for (const q of env.people || []) if (Math.abs(q.x - x) < r && Math.abs(q.y - y) < r) return true; return false; };
  // en plats är ledig om ingen fotgängare har tagit den och ingen spelare sitter där
  const seatFree = (s, me = null) => { const u = seatUse.get(s.id); if (u && u !== me && !u.gone) return false; return !playerAt(s.x, s.y, 3); };
  function playerAt(x, y, r) {
    const ppl = env.people || [], n = ppl.length - peds.filter((p) => !p.hidden).length;
    for (let i = 0; i < Math.max(0, n); i++) { const q = ppl[i]; if (q && Math.abs(q.x - x) < r && Math.abs(q.y - y) < r) return true; }
    return false;
  }
  function seatInfo(s) {
    let m = seatMeta.get(s.id);
    if (m !== undefined) return m;
    m = null;
    const w = s.walk;
    const cand = nodes.filter((n) => n.tag !== 'kant' && Math.abs(n.x - w.x) < 130 && Math.abs(n.y - w.y) < 90)
      .map((n) => [n, Math.hypot(n.x - w.x, (n.y - w.y) * 1.2)]).sort((a, b) => a[1] - b[1]).slice(0, 5);
    for (const [n] of cand) {
      const there = nav.pathTo(n.x, n.y, w.x, w.y);
      if (!there || there.length > 8) continue;
      const back = nav.pathTo(w.x, w.y, n.x, n.y);
      if (!back) continue;
      m = { node: n.i, there, back };
      break;
    }
    seatMeta.set(s.id, m);
    return m;
  }
  const claimSeat = (s, p) => { seatUse.set(s.id, p); };
  const freeSeat = (s, p) => { if (s && seatUse.get(s.id) === p) seatUse.delete(s.id); };

  // ---------- träd och buskar (för ekorrar och småfåglar) ----------
  const TREE_KINDS = { lind: 30, bjork: 28, korsbar: 26, ek: 40, lonn: 34, gran: 8, 'dött träd': 26 };
  let trees = [], bushes = [];
  function findFlora() {
    const P = PR();
    const items = P && typeof P.items === 'function' ? safe(() => P.items(), []) : [];
    for (const it of items || []) {
      if (!it || !Number.isFinite(it.x)) continue;
      if (TREE_KINDS[it.kind] !== undefined) trees.push({ x: Math.round(it.x), y: Math.round(it.y), h: TREE_KINDS[it.kind], kind: it.kind });
      else if (it.kind === 'buske' || it.kind === 'häck') bushes.push([Math.round(it.x), Math.round(it.y)]);
    }
    // utan rekvisitans lista: ett träd är ett 5×3-hinder (stammen), en buske 12×3, en häck 5 hög
    const needT = !trees.length, needB = !bushes.length;
    if (needT || needB) {
      for (const o of env.obstacles || []) {
        if (!o) continue;
        const w = o[2] - o[0], h = o[3] - o[1];
        if (needT && w === 5 && h === 3) trees.push({ x: o[0] + 2, y: o[3] - 1, h: 28, kind: '?' });
        if (!needB) continue;
        if (w === 12 && h === 3) bushes.push([o[0] + 6, o[3]]);
        else if (h === 5 && w >= 24 && w <= 60) bushes.push([Math.round((o[0] + o[2]) / 2), o[3]]);
      }
    }
    // bara träd som står på gräs eller trottoar (inte inne i ett hus eller staket)
    trees = trees.filter((t) => t.y > 30);
  }

  // ------------------------------------------------------------------
  //  Fotgängare
  // ------------------------------------------------------------------
  let peds = [];
  let nextId = 1;
  function lookFor(o = {}) {
    let L = makeLook();
    for (let i = 0; i < 40 && !!L.kid !== !!o.kid; i++) L = makeLook();
    const oo = { ...o, w: env.weather, rain: env.rain };
    L = dress(L, oo);
    o.suited = !!oo.suited;             // kostymfolk (downtown) – spawn() ger dem portfölj, kaffe och mobil
    return L;
  }
  function mkPed(look) {
    return {
      id: nextId++, look, x: 0, y: 0, ox: 0, oy: 0, hx: 1, hy: 0, lane: rr(2.5, 9), speed: look.kid ? rr(30, 38) : rr(24, 34),
      anim: rnd() * 4, face: 'down', path: [], plan: [], hold: 0, node: -1, moving: false, hidden: false, door: null,
      carry: null, carryCol: pick(PASE_COLORS), caseCol: pick(CASE_COLORS), umb: rnd() < 0.8 ? pick(UMB_COLORS) : null,
      dog: null, comp: null, leader: null, jogger: false, trail: [], trailT: 0, seed: rnd() * 100, gone: false, leaving: false,
      onCross: -1, look4bus: false, spot: null, wj: [rr(-1, 1), rr(0, 1)], kind: 'folk',
      sit: null, seatT: null, wantSeat: null, stop: null, hang: null, play: null, jump: false, gest: 0, gestT: rr(1, 4),
      showMove: false, stillT: 1, showDir: 'down', dirT: 0, leaves: 0,
      suit: false, caller: false, call: 0, callT: rr(2, 10), photo: 0,
    };
  }
  const subAt = (x) => x >= X_SUB - 10;
  const dtAt = (x) => x >= XI[1] - 8 && x < DT1 + 24;   // v3: downtown (och brofästet) – kostym och kavaj
  // kostymfolket: raskt tempo, svart paraply, kaffe på morgonen, portfölj (om figuren inte har en egen)
  // och ibland telefonen mot örat (bara den som har en hand ledig: inget i händerna – en portfölj eller
  // handväska i högra handen går bra, då tar man telefonen med den vänstra, se callSprite)
  function suitUp(p) {
    p.suit = true;
    p.speed = rr(30, 39);
    p.umb = pick([0x1e1e24, 0x2a2e48, 0x1e1e24, 0xc9323a]);
    const h = env.hour;
    if (!p.carry) {
      const r = rnd();
      if (r < (h >= 6.5 && h < 11 ? 0.34 : 0.14)) p.carry = 'kaffe';
      else if (r < 0.5 && !p.look.bag) p.carry = 'portfolj';
    }
    p.caller = !p.carry && rnd() < 0.42;
    if (p.caller && rnd() < 0.4) { p.call = rr(4, 14); p.callT = rr(6, 18); }
  }
  function addDog(p, late) {
    const br = ri(0, DOGS.length - 1);
    p.dog = { br, x: p.x - 8, y: p.y, dir: 1, fr: 0, anim: 0, act: 'walk', t: 0, tx: p.x, ty: p.y, tie: null, moving: false, dirT: 0, bark: 0, wag: 0, cool: rr(2, 6), free: null };
    p.speed = Math.min(p.speed, 28);
    return late;
  }
  function addExtras(p) {
    const h = env.hour, late = h < 6 || h >= 21;
    if (p.look.kid || p.kind !== 'folk') return;
    if (rnd() < (p.suit ? 0.04 : late ? 0.4 : 0.22)) addDog(p, late);
    else if (!late && rnd() < 0.2 && ordinary() < targetCount(h)) {
      const o = { kid: !p.suit && rnd() < 0.5, sub: subAt(p.x), suit: dtAt(p.x) };
      const c = mkPed(lookFor(o));
      c.leader = p; c.x = p.x - 6; c.y = p.y; c.node = p.node; c.umb = rnd() < 0.5 ? c.umb : null;
      if (o.suited) { suitUp(c); c.caller = false; c.call = 0; }   // (sällskapet pratar med ledaren, inte i telefon)
      p.comp = c; p.speed = Math.min(p.speed, 30);
      if (p.comp && p.call > 0) p.call = 0;
      peds.push(c);
    }
    if (!p.dog && !p.suit && rnd() < 0.12) p.carry = pick(['kasse', 'pase', 'kasse', 'frakt', 'kaffe', 'tidning']);
  }
  function spawn(kind, arg, o = {}) {
    const h = env.hour, late = h < 6 || h >= 21.5, w = W();
    const jogOk = kind !== 'door' && !o.special && ((h >= 6 && h < 10) || (h >= 16.5 && h < 21)) && !(w.kind === 'regn' && (w.intensity ?? 0.6) > 0.7);
    const jog = jogOk && rnd() < 0.11;
    const at = kind === 'node' ? nodes[arg] : kind === 'edge' ? nodes[arg.n] : kind === 'door' ? doorCenter(arg) : { x: camCX(), y: camCY() };
    // kontorsdörrarna och banken släpper ut kostymfolk även utanför downtown-bandet
    const office = kind === 'door' && (OFFICES.includes(arg.id) || arg.id === 'bank');
    const lo = { kid: o.kid ?? (!late && !jog && !dtAt(at.x) && rnd() < 0.1), jog, youth: o.youth, sub: subAt(at.x), suit: o.suit ?? (office || dtAt(at.x)) };
    const p = mkPed(lookFor(lo));
    if (o.special) p.kind = o.special;
    if (jog) { p.jogger = true; p.speed = rr(58, 70); p.umb = null; }
    else if (lo.suited) suitUp(p);
    if (kind === 'node') {
      const n = nodes[arg];
      p.node = arg; p.x = n.x; p.y = n.y;
    } else if (kind === 'edge') {
      const n = nodes[arg.n];
      p.node = arg.n; p.x = arg.dir < 0 ? LX - 12 : CW + 12; p.y = n.y;
      p.plan.push({ k: 'to', x: n.x, y: n.y });
    } else if (kind === 'door') {
      const b = arg, dc = doorCenter(b), base = baseOf(b);
      p.node = nav.doorNode[b.id]; p.x = dc.x; p.y = base - 3;
      p.door = { b, base, ph: 'inside', t: rr(0.3, 3), stay: 0, spawned: true };
      p.hidden = true;
      if (b.id === 'flyg' && rnd() < 0.7) p.carry = 'resvaska';
    }
    peds.push(p);
    if (!p.jogger && !o.special) addExtras(p);
    if (p.comp) { p.comp.x = p.x; p.comp.y = p.y; p.comp.hidden = p.hidden; }
    if (p.dog) { p.dog.x = p.x - 8; p.dog.y = p.y; }
    if (p.door && p.dog) p.dog.tie = tieSpot(p.door.b);
    p.plan.push(...(o.plan || planFor(p)));
    return p;
  }

  // ---------- planerna ----------
  // mål nära kameran är mycket vanligare än mål långt bort
  const nearW = (x, y, spread = 190) => Math.exp(-Math.max(0, camD(x, y ?? camCY()) - 160) / spread);
  function nearNodes(ids, spread = 190) {
    return wpick(ids.map((i) => [i, nearW(nodes[i].x, nodes[i].y, spread) + 0.005]));
  }
  // vädret styr lusten: sol → parken och bänkarna, regn → butiker och bussen
  function mood() {
    const w = W(), k = w.kind, I = w.intensity ?? 0.6, t = w.temp ?? 15;
    const wet = k === 'regn' ? 0.25 + (1 - I) * 0.3 : k === 'snö' ? 0.55 : k === 'dimma' ? 0.7 : 1;
    const nice = (k === 'sol' ? 1.35 : k === 'moln' ? 1 : wet) * (t < -5 ? 0.6 : t < 3 ? 0.8 : t > 18 ? 1.15 : 1);
    return { nice, wet: k === 'regn', cold: t < 3, warm: t >= 16 };
  }
  function placeList(h) {
    const out = [];
    const m = mood();
    for (const b of ALL_B) {
      const P = PLACES[b.id];
      if (!P || !enterable(b) || nav.doorNode[b.id] === undefined || !isOpen(b, h + 0.3)) continue;
      if (P.warm && !m.warm) continue;
      let w = P.w;
      if (P.eve) w *= h >= 17 ? 2.2 : 0.4;
      out.push([b, w]);
    }
    return out;
  }
  // ---------- kaffevagnen på Finanstorget (rekvisitans föremål kind 'kaffevagn') ----------
  // Man ställer sig framför luckan en stund och går därifrån med en pappmugg i handen.
  let coffeeSpot = null;
  function findCoffee() {
    const P = PR();
    const items = P && typeof P.items === 'function' ? safe(() => P.items(), []) : [];
    const cart = (items || []).find((it) => it && it.kind === 'kaffevagn' && Number.isFinite(it.x));
    if (!cart) return;
    const q = nav.nearest(Math.round(cart.x), Math.round(cart.y) + 9, paved, 8);
    if (!q) return;
    const nn = nav.nearNode(q[0], q[1], null, 140);
    if (nn < 0 || !nav.pathTo(nodes[nn].x, nodes[nn].y, q[0], q[1], 24)) return;
    coffeeSpot = { x: q[0], y: q[1], node: nn, cx: cart.x, cy: cart.y };
  }
  function coffeePlan() {
    const c = coffeeSpot;
    if (!c) return [];
    const q = nav.nearest(c.x + ri(-7, 7), c.y + ri(0, 4), paved, 4) || [c.x, c.y];
    return [{ k: 'go', n: c.node }, { k: 'goto', x: q[0], y: q[1], at: c.node }, { k: 'wait', t: rr(3, 7), face: 'up' }, { k: 'give', item: 'kaffe' }, { k: 'goto', x: nodes[c.node].x, y: nodes[c.node].y, at: c.node }];
  }
  // downtown: närhet till finanskvarteret (0–1) – styr torget, kontoren och kaffevagnen
  const dtNear = () => { const x = camCX(); return x > DT0 - 200 && x < DT1 + 260 ? 1 : 0; };
  const rushAM = (h) => h >= 7 && h < 9.6, rushPM = (h) => h >= 16 && h < 18.8;
  function planFor(p) {
    const st = [], h = env.hour, dark = env.dark > 0.3, m = mood();
    if (p.jogger) return jogPlan(p);
    // kostymfolket på morgonen: raka vägen till kontoret (in genom karuselldörren – sedan är man på jobbet)
    if (p.suit && rushAM(h) && rnd() < 0.7) {
      const offs = OFFICES.map(byId).filter((b) => b && nav.doorNode[b.id] !== undefined);
      if (offs.length) {
        const b = wpick(offs.map((b) => [b, nearW(doorCenter(b).x, baseOf(b), 300) + 0.01]));
        if (rnd() < 0.3 && coffeeSpot) st.push(...coffeePlan());
        st.push({ k: 'go', n: nav.doorNode[b.id] }, { k: 'door', b, t: 0, home: true });
        return st;
      }
    }
    const n = ri(1, 3);
    for (let i = 0; i < n; i++) {
      const shops = placeList(h).filter(([b]) => !PLACES[b.id].office || (p.suit && !rushPM(h))).map(([b, w]) => [b, w * (p.suit && PLACES[b.id].suit ? PLACES[b.id].suit : 1)]);
      const opts = [];
      if (shops.length) opts.push(['shop', (m.wet ? 5 : 3) * (p.dog ? 0.45 : 1)]);
      // v3: Finanstorget, kaffevagnen, broarna och kajerna längs floden
      if (!m.wet && h >= 7 && h < 22 && nav.plaza.all.length) opts.push(['plaza', (0.5 + 2.2 * dtNear()) * m.nice]);
      if (coffeeSpot && h >= 6.5 && h < 18 && !p.carry && !p.dog) opts.push(['coffee', (p.suit ? 1.6 : 0.5) * dtNear() * (m.cold ? 1.5 : 1)]);
      const riverNear = RIV ? nearW((RIV.x0 + RIV.x1) / 2, camCY(), 320) : 0;
      if (!m.wet && h >= 6.5 && h < 23 && nav.bridgeNodes.n.length) opts.push(['bridge', 2.6 * m.nice * riverNear]);
      if (!m.wet && h >= 7 && h < 22 && nav.quayNodes.length) opts.push(['quayview', 1.2 * m.nice * riverNear]);
      if (!dark && nav.windows.length) opts.push(['window', 1.4]);
      if (!m.wet && h >= 6.5 && h < 22 && nav.parkNodes.length) opts.push(['park', (p.dog ? 4 : 2) * m.nice]);
      if (h >= 6 && h < 23.5 && nav.stops.length) opts.push(['bus', m.wet ? 2.4 : 1.3]);
      if (!m.wet && h >= 7 && h < 22.5) opts.push(['seat', (m.cold ? 0.5 : 1.6) * m.nice * (p.comp ? 1.3 : 1)]);
      if (!m.wet && h >= 7 && h < 22 && nav.lines.Q.length) opts.push(['quay', 0.7 * m.nice]);
      if (p.dog && nav.special.dogIn >= 0 && !m.wet && h >= 6 && h < 22) opts.push(['dogpark', 2.2]);
      opts.push(['wander', 1.6]);
      if (!dark && nav.lines.Bk.length) opts.push(['alley', 0.4]);
      if (i === n - 1) opts.push(['home', 0.9]);
      const a = wpick(opts);
      if (a === 'shop') {
        const near = shops.map(([b, w]) => [b, w * (PLACES[b.id].dog && p.dog ? PLACES[b.id].dog : 1) * (nearW(doorCenter(b).x, baseOf(b), 260) + 0.01)]);
        const b = wpick(near);
        if (b.id === 'flyg' && rnd() < 0.5 && !p.carry) p.carry = 'resvaska';
        st.push({ k: 'go', n: nav.doorNode[b.id] }, { k: 'door', b, t: rr(...PLACES[b.id].stay) });
      } else if (a === 'home') {
        const homes = HOMES.map(byId).filter((b) => enterable(b) && nav.doorNode[b.id] !== undefined);
        if (!homes.length) continue;
        const b = wpick(homes.map((b) => [b, nearW(doorCenter(b).x, baseOf(b), 240) + 0.01]));
        st.push({ k: 'go', n: nav.doorNode[b.id] }, { k: 'door', b, t: 0, home: true });
        return st; // hemma – planen tar slut här
      } else if (a === 'window') {
        const w = wpick(nav.windows.map((w) => [w, nearW(w.x, w.y) + 0.01]));
        st.push({ k: 'go', n: w.node }, { k: 'to', x: w.x, y: w.ny, at: w.node }, { k: 'to', x: w.x, y: w.y, noOff: true, at: w.node },
          { k: 'wait', t: rr(2.5, 7), face: 'up' }, { k: 'to', x: w.x, y: w.ny, at: w.node });
      } else if (a === 'park') {
        const k = ri(2, 4);
        for (let j = 0; j < k; j++) {
          const nn = nearNodes(nav.parkNodes, 260);
          st.push({ k: 'go', n: nn });
          if (nav.ring.includes(nn) && rnd() < 0.5) {
            const pl = PARK.plaza;
            st.push({ k: 'wait', t: rr(3, 9), face: faceTo(pl.cx - nodes[nn].x, pl.cy - nodes[nn].y) });
          }
        }
      } else if (a === 'seat') {
        const list = seats().filter((s) => !s.stop && seatFree(s));
        if (!list.length) continue;
        const s = wpick(list.map((s) => [s, nearW(s.x, s.y, 200) + 0.003]));
        const info = seatInfo(s);
        if (!info) continue;
        st.push({ k: 'go', n: info.node }, { k: 'seat', seat: s, t: rr(12, 45) * (m.cold ? 0.5 : 1) });
      } else if (a === 'quay') {
        const nn = nearNodes(nav.lines.Q, 220);
        st.push({ k: 'go', n: nn }, { k: 'to', x: nodes[nn].x + rr(-6, 6), y: Math.min(WALK_BOTTOM - 1, nodes[nn].y + 3), noOff: true, at: nn }, { k: 'wait', t: rr(4, 12), face: 'down' });
      } else if (a === 'dogpark') {
        st.push({ k: 'go', n: nav.special.dogIn }, { k: 'dogpark', t: rr(20, 50) });
      } else if (a === 'bus') {
        const s = wpick(nav.stops.map((s) => [s, nearW(s.s.x, s.s.y, 220) + 0.005]));
        st.push({ k: 'go', n: s.node }, { k: 'bus', stop: s, t: rr(10, 30) });
      } else if (a === 'alley') {
        st.push({ k: 'go', n: nearNodes(nav.lines.Bk, 200) }, { k: 'go', n: nearNodes(nav.lines.Bk, 200) });
      } else if (a === 'plaza') {
        // över Finanstorget: runt tjuren (stanna och titta – ibland en bild med mobilen), förbi fontänerna
        const P = nav.plaza, k = ri(1, 3);
        for (let j = 0; j < k; j++) {
          const nn = nearNodes(P.all, 220);
          st.push({ k: 'go', n: nn });
          const N0 = nodes[nn], st0 = DTL?.statue, fo = (DTL?.fountains || []).find((f) => Math.hypot(f.x - N0.x, (f.y - N0.y) * 1.6) < 60);
          if (P.ring.includes(nn) && st0 && rnd() < 0.6) st.push({ k: 'wait', t: rr(3, 9), face: faceTo(st0.x - N0.x, st0.y - N0.y), photo: !p.suit && rnd() < 0.4 });
          else if (fo && rnd() < 0.5) st.push({ k: 'wait', t: rr(3, 8), face: faceTo(fo.x - N0.x, fo.y - N0.y) });
        }
      } else if (a === 'coffee') {
        st.push(...coffeePlan());
      } else if (a === 'bridge') {
        // ut på bron: stanna vid räcket och titta ut över floden (norrut eller söderut), ta en bild
        const side = rnd() < 0.5 ? 'n' : 's', B = nav.bridgeNodes[side].length ? nav.bridgeNodes[side] : nav.bridgeNodes.n;
        const nn = nearNodes(B, 260), N0 = nodes[nn], br = BRIDGES[0];
        const ry = side === 'n' ? br.rails[0][3] + 4 : br.rails[1][1] - 4;
        const spot = nav.nearest(Math.round(N0.x + rr(-10, 10)), ry, paved, 6);
        st.push({ k: 'go', n: nn });
        if (spot) st.push({ k: 'goto', x: spot[0], y: spot[1], at: nn }, { k: 'wait', t: rr(5, 16), face: side === 'n' ? 'up' : 'down', photo: rnd() < 0.35 }, { k: 'goto', x: N0.x, y: N0.y, at: nn });
      } else if (a === 'quayview') {
        // kajen: gå fram till räcket och titta på vattnet (västra kajen österut, östra kajen västerut)
        const nn = nearNodes(nav.quayNodes, 240), N0 = nodes[nn];
        const west = nav.quayX.length && Math.abs(N0.x - nav.quayX[0]) < Math.abs(N0.x - nav.quayX[1]);
        const tx = west ? RIV.x0 + 16 : RIV.x1 - 17, ty = N0.y + Math.round(rr(-18, 18));
        const spot = inWater(west ? tx + 12 : tx - 12, ty) ? nav.nearest(tx, ty, paved, 5) : null;
        st.push({ k: 'go', n: nn });
        if (spot) st.push({ k: 'goto', x: spot[0], y: spot[1], at: nn }, { k: 'wait', t: rr(5, 14), face: west ? 'right' : 'left' }, { k: 'goto', x: N0.x, y: N0.y, at: nn });
      } else {
        st.push({ k: 'go', n: nearNodes(nav.spawnNodes) });
        if (rnd() < 0.3) st.push({ k: 'wait', t: rr(1, 4), face: pick(['down', 'left', 'right']) });
      }
    }
    st.push({ k: 'leave' });
    return st;
  }
  // joggarna springer längs de långa raka gångarna: promenaden, parkgången, kajen, bakgatan
  function jogPlan(p) {
    const L = nav.lines;
    // (v3: kajen, parkgången och bakgatan bryts vid floden – varje sammanhängande bit är en egen runda;
    // Pixelgatans södra trottoar från Infarten över Stora bron är joggarnas favorit)
    const overBridge = RIV ? L.S.filter((i) => nodes[i].x > DT0 && nodes[i].x < RIV.x1 + 200) : [];
    const routes = [L.Pm, ...nav.runs(L.Q), ...nav.runs(L.BkS.filter((i) => nodes[i].x < XI[0])), ...nav.runs(L.BkS.filter((i) => nodes[i].x > XI[1])), ...nav.runs(L.SS), ...nav.runs(overBridge)].filter((r) => r.length > 3);
    if (!routes.length) return [{ k: 'leave' }];
    const r = wpick(routes.map((r) => [r, nearW(nodes[r[r.length >> 1]].x, nodes[r[0]].y, 300) + 0.01]));
    const a = r[0], b = r[r.length - 1];
    const first = Math.abs(nodes[a].x - p.x) < Math.abs(nodes[b].x - p.x) ? a : b, last = first === a ? b : a;
    const st = [{ k: 'go', n: nav.nearNode(p.x, p.y, r, 400) >= 0 ? nav.nearNode(p.x, p.y, r, 400) : first }];
    if (r === L.Pm && nav.ring.length && rnd() < 0.5) st.push({ k: 'go', n: pick(nav.ring) }, { k: 'go', n: pick(nav.ring) });
    st.push({ k: 'go', n: last }, { k: 'leave' });
    return st;
  }

  function nextStep(p) {
    const s = p.plan.shift();
    if (!s) { p.plan = planFor(p); return; }
    switch (s.k) {
      case 'go': {
        if (p.node === s.n || s.n === undefined || s.n < 0) return;
        const r = p.node >= 0 ? nav.route(p.node, s.n) : null;
        if (!r) return; // går inte att nå – hoppa över steget
        const N0 = nodes[p.node];
        if (Math.hypot(N0.x - p.x, N0.y - p.y) > 2) {
          const back = nav.pathTo(p.x, p.y, N0.x, N0.y, 24);
          if (back) r.unshift(...back.map((q) => ({ ...q, noOff: false })));
          else r.unshift({ x: N0.x, y: N0.y, gate: -1 });
        }
        p.path = r; p.node = s.n;
        return;
      }
      case 'to':
        // en avstickare från en nod (fönster, kajkanten) – bara om man faktiskt kom fram till noden
        if (s.at !== undefined && p.node !== s.at) return;
        p.path = [{ x: s.x, y: s.y, gate: -1, noOff: !!s.noOff }];
        return;
      case 'wait': p.hold = s.t; p.face = s.face || p.face; p.jump = !!s.jump; p.photo = s.photo ? s.t : 0; if (s.photo) p.call = 0; return;
      // (v3) en avstickare som går runt hindren (kaffevagnen, räcket på bron, kajkanten)
      case 'goto':
        if (s.at !== undefined && p.node !== s.at) return;
        p.path = nav.pathTo(p.x, p.y, s.x, s.y, 24) || [];
        if (p.path.length) p.path[p.path.length - 1].noOff = true;
        return;
      // (v3) fick något i handen (kaffet från kaffevagnen) – och lägger på luren
      case 'give': if (!p.carry && !p.look.kid) { p.carry = s.item; p.caller = false; p.call = 0; } return;
      case 'seat': {
        const seat = s.seat, info = seatInfo(seat);
        if (!info || p.node !== info.node || !seatFree(seat, p)) return;
        claimSeat(seat, p);
        p.wantSeat = seat;
        p.path = [...info.there.map((q) => ({ ...q })), { x: seat.x, y: seat.y, gate: -1, noOff: true }];
        // sällskapet sätter sig bredvid om det finns plats på samma bänk
        if (p.comp) {
          const two = seats().find((q) => q !== seat && q.bench === seat.bench && seatFree(q));
          if (two) { claimSeat(two, p.comp); p.comp.seatWant = two; }
        }
        p.plan.unshift({ k: 'sitdown', seat, t: s.t, bus: s.bus || null }, { k: 'standup', seat });
        return;
      }
      case 'sitdown':
        if (Math.hypot(p.x - s.seat.x, p.y - s.seat.y) > 2) { freeSeat(s.seat, p); p.wantSeat = null; return; }
        p.sit = s.seat; p.wantSeat = null; p.hold = s.t; p.face = s.seat.dir; p.ox = p.oy = 0;
        if (s.bus) { p.stop = s.bus; p.look4bus = true; }
        return;
      case 'standup': {
        const seat = s.seat, info = seatInfo(seat);
        p.sit = null; freeSeat(seat, p); p.look4bus = false;
        if (p.comp && p.comp.seatWant) { freeSeat(p.comp.seatWant, p.comp); p.comp.seatWant = null; p.comp.sit = null; }
        p.path = [{ x: seat.walk.x, y: seat.walk.y, gate: -1, noOff: true }, ...(info ? info.back.map((q) => ({ ...q })) : [])];
        return;
      }
      case 'bus': {
        const B = s.stop;
        if (!B || p.node !== B.node) return;
        p.stop = B;
        // sitt i kuren om det finns en ledig plats, annars stå och vänta
        // (bänkens nod kan vara en annan än hållplatsens – gå dit först; i regn tar man helst taket)
        const inShelter = seats().filter((q) => q.stop === B.s.id && seatFree(q));
        if (inShelter.length && rnd() < (mood().wet ? 0.95 : 0.7)) {
          const q = pick(inShelter), info = seatInfo(q);
          // reservera platsen direkt så att inte två väljer samma bänkplats i samma stund
          if (info) { claimSeat(q, p); p.wantSeat = q; p.plan.unshift({ k: 'go', n: info.node }, { k: 'seat', seat: q, t: s.t + rr(20, 50), bus: B }, { k: 'unbus' }); return; }
        }
        const free = B.spots.filter((b) => !b.busy);
        if (!free.length) { p.stop = null; return; }
        const spot = pick(free.slice(0, 5)), N0 = nodes[p.node];
        spot.busy = p.id; p.spot = spot;
        p.path = spot.there.map((q) => ({ ...q }));
        if (Math.hypot(N0.x - p.x, N0.y - p.y) > 2) p.path.unshift({ x: N0.x, y: N0.y, gate: -1 });
        p.plan.unshift({ k: 'wait', t: s.t, face: 'up', bus: true }, { k: 'unbus' });
        return;
      }
      case 'unbus': {
        const spot = p.spot;
        if (spot) { spot.busy = null; p.spot = null; }
        if (p.wantSeat) { freeSeat(p.wantSeat, p); p.wantSeat = null; }
        p.look4bus = false; p.stop = null;
        // "bussen kom" – är man utom synhåll kliver man bara på
        if (!visible(p.x, p.y, 40) && rnd() < 0.6) { p.gone = true; return; }
        const N0 = nodes[p.node];
        if (spot) p.path = spot.back.map((q) => ({ ...q }));
        else if (Math.hypot(N0.x - p.x, N0.y - p.y) > 2) p.path = nav.pathTo(p.x, p.y, N0.x, N0.y) || [{ x: N0.x, y: N0.y, gate: -1 }];
        return;
      }
      case 'pts': p.path = s.pts.map((q) => ({ ...q })); return;
      case 'door': {
        const b = s.b, dc = doorCenter(b), base = baseOf(b);
        if (p.node !== nav.doorNode[b.id]) return; // kom aldrig fram till dörren
        p.door = { b, base, ph: 'app', t: 0, stay: s.t, home: !!s.home };
        const tx = dc.x + rr(-2, 2), ty = base + 9;
        p.path = nav.pathTo(p.x, p.y, tx, ty) || [{ x: tx, y: ty, gate: -1, noOff: true }];
        if (p.dog && !s.home) p.dog.tie = tieSpot(b);
        return;
      }
      case 'dogpark': {
        const r = PARK.dogPark;
        if (!r || !p.dog || p.node !== nav.special.dogIn) return;
        const q = nav.nearest(Math.round(rr(r[0] + 16, r[2] - 16)), Math.round(rr(r[1] + 14, r[1] + 34)), walk, 8);
        if (q) p.path = nav.pathTo(p.x, p.y, q[0], q[1]) || [];
        p.plan.unshift({ k: 'unleash', t: s.t }, { k: 'calldog' });
        return;
      }
      case 'unleash':
        if (p.dog) { const r = PARK.dogPark; p.dog.free = [r[0] + 6, r[1] + 8, Math.min(r[2], 132) - 6, r[3] - 6]; p.dog.t = 0; }
        p.hold = s.t; p.face = 'down';
        return;
      case 'calldog':
        // vänta tills hunden har kommit tillbaka och fått kopplet på
        if (p.dog && p.dog.free) {
          p.dog.free = null; p.dog.call = true;
        }
        if (p.dog && Math.hypot(p.dog.x - p.x, p.dog.y - p.y) > 14) { p.hold = 0.4; p.plan.unshift({ k: 'calldog' }); return; }
        if (p.dog) p.dog.call = false;
        return;
      case 'play': {
        // barnen springer runt på lekplatsen, stannar, hoppar och springer vidare
        // (aldrig i skymningsbandet bakom gungställningen/rutschkanan – där ser
        // barnet ut att stå ovanpå överliggaren)
        if (env.t > s.until) return;
        const q = lekPunkt(s.rect);
        if (q) p.path = nav.pathTo(p.x, p.y, q[0], q[1], 20) || [];
        p.speed = rr(34, 46);
        p.plan.unshift({ k: 'wait', t: rr(0.4, 2.2), face: pick(['down', 'left', 'right', 'up', 'down']), jump: rnd() < 0.45 }, { ...s });
        return;
      }
      case 'hang': {
        // ungdomarna: stå i en klunga, vänd mot varandra, skratta, titta i mobilen
        p.hang = s.spot; p.hold = s.t; p.face = faceTo(s.spot.cx - p.x, (s.spot.cy - p.y) * 0.6);
        return;
      }
      case 'unhang':
        if (p.hang) { const i = p.hang.used.indexOf(p); if (i >= 0) p.hang.used[i] = null; p.hang = null; }
        return;
      case 'leave': {
        if (!visible(p.x, p.y, 60) || ++p.leaves > 6) { p.gone = true; return; }
        // ut ur världen vid kanten, eller till en plats utom synhåll där man försvinner
        const ex = nav.exits.filter((e) => !e.back && Math.abs(nodes[e.n].x - p.x) < 260);
        if (ex.length && rnd() < 0.6) { const e = pick(ex); p.plan.unshift({ k: 'go', n: e.n }, { k: 'out', dir: e.dir }); return; }
        const far = nav.spawnNodes.filter((i) => { const n = nodes[i], d = Math.hypot(n.x - p.x, n.y - p.y); return d > 170 && d < 520 && !visible(n.x, n.y, 30); });
        if (far.length) { p.plan.unshift({ k: 'go', n: wpick(far.map((i) => [i, 1 / (1 + Math.hypot(nodes[i].x - p.x, nodes[i].y - p.y) / 200)])) }, { k: 'vanish' }); return; }
        p.gone = true;
        return;
      }
      case 'vanish': if (!visible(p.x, p.y, 40)) p.gone = true; else p.plan.unshift({ k: 'leave' }); return;
      case 'out': p.leaving = true; p.path = [{ x: s.dir < 0 ? LX - 14 : CW + 14, y: p.y, gate: -1, noOff: true }]; return;
      case 'board': {
        // klev på bussen – men hann den gå får man vänta på nästa
        const B = s.stop;
        if (!B || busAt(B) || !visible(p.x, p.y, 30)) { p.gone = true; return; }
        const B0 = nodes[B.node];
        p.face = 'right';
        p.plan.unshift({ k: 'wait', t: rr(0.6, 1.4), face: 'right' }, { k: 'pts', pts: nav.pathTo(p.x, p.y, B0.x, B0.y) || [{ x: B0.x, y: B0.y, gate: -1 }] }, { k: 'bus', stop: B, t: rr(15, 40) });
        return;
      }
    }
  }

  // ---------- bussarna: de som väntar kliver på, några kliver av ----------
  // traffic.vehicles() ger bussarna med stop (hållplatsens id) och dwell när de står still vid en hållplats.
  function busAt(B) {
    if (typeof T.vehicles !== 'function') return null;
    let vs = null;
    try { vs = T.vehicles(); } catch { return null; }
    for (const v of vs || []) {
      if (v.kind !== 'buss' || Math.abs(v.v) > 1.5) continue;
      if (v.stop !== undefined && v.stop !== null) { if (v.stop === B.s.id && (v.dwell || 0) > 0) return v; continue; }
      if ((v.road || 'pixelgatan') !== B.road) continue;
      const front = v.dir > 0 ? v.x1 : v.x0;
      if (Math.abs(front - (B.s.x + 10 * v.dir)) < 16) return v;
    }
    return null;
  }
  function updBus() {
    for (const B of nav.stops) {
      if (Math.abs(B.s.x - camCX()) > 700) { B.served = false; continue; }
      const bus = busAt(B);
      if (!bus) { B.served = false; continue; }
      const bx = Math.round((bus.x0 + bus.x1) / 2) + 4, by = B.curb;
      // alla som väntar här (även de som hinner fram medan bussen står still) kliver på
      for (const p of peds) {
        if (p.leader || p.door || p.stop !== B) continue;
        if (p.spot) { p.spot.busy = null; p.spot = null; }
        if (p.sit) { freeSeat(p.sit, p); p.sit = null; }
        if (p.wantSeat) { freeSeat(p.wantSeat, p); p.wantSeat = null; }
        p.look4bus = false; p.stop = null;
        p.hold = rr(0, 0.5); p.path = [];
        const tx = bx + rr(-3, 3), pts = nav.pathTo(p.x, p.y, tx, by) || [{ x: tx, y: by, gate: -1, noOff: true }];
        p.plan = [{ k: 'pts', pts }, { k: 'board', stop: B }];
      }
      if (B.served) continue;
      B.served = true;
      // någon kliver av (en gång per stopp)
      const want = targetCount(env.hour);
      if (ordinary() < want) {
        for (let i = Math.min(ri(0, 2), want - ordinary()); i > 0; i--) {
          const p = spawn('node', B.node);
          p.x = bx + rr(-3, 3); p.y = by; p.hidden = true; p.hold = 0.8 + i * rr(0.5, 1); p.fromBus = true;
          if (p.comp) { p.comp.x = p.x; p.comp.y = p.y; }
          if (p.dog) { p.dog.x = p.x; p.dog.y = p.y + 2; }
          const B0 = nodes[B.node];
          p.plan.unshift({ k: 'pts', pts: nav.pathTo(p.x, p.y, B0.x, B0.y) || [{ x: B0.x, y: B0.y, gate: -1 }] });
        }
      }
    }
  }
  function tieSpot(b) {
    const dc = doorCenter(b), half = (b.door.x1 - b.door.x0) / 2 + 12, base = baseOf(b);
    for (const side of [1, -1]) {
      const q = nav.nearest(Math.round(dc.x + side * half), base + 7, paved, 6) || nav.nearest(Math.round(dc.x + side * half), base + 7, walk, 6);
      if (q) return { x: q[0], y: q[1] };
    }
    return null;
  }
  function gotItem(p, b) {
    const shop = PLACES[b.id];
    if (!shop || p.look.kid || p.jogger) return;
    if (b.id === 'flyg' && p.carry === 'resvaska') { p.carry = null; if (rnd() < 0.8) p.flew = true; return; }
    // frisören: ut med en ny frisyr (ibland ny färg); accessoarbutiken: nya solglasögon när solen skiner
    if (shop.hair) {
      const L = { ...p.look }, styles = ['bob', 'lob', 'pixie', 'short', 'side', 'quiff', 'fade', 'undercut', 'curtains', 'sleek', 'buzz', 'wavy', 'bun'].filter((s) => s !== L.style && hasLook('style', s));
      if (styles.length) L.style = pick(styles);
      if (rnd() < 0.25) L.hair = pick(['#d9a95c', '#ecd489', '#b7392b', '#6b4226', '#1d1714']);
      p.look = L;
    }
    if (shop.sun && mood().warm && !p.look.glasses && rnd() < 0.5 && hasLook('glasses', 'sun')) p.look = { ...p.look, glasses: 'sun' };
    for (const [kind, prob] of shop.carry) if (rnd() < prob) { p.carry = kind; p.caller = false; p.call = 0; break; }
  }

  // ---------- dörrarna: gå in, var borta en stund, kom ut igen ----------
  function updDoor(p, dt) {
    const D = p.door, dc = doorCenter(D.b), base = D.base;
    if (D.ph === 'app') {
      if (p.path.length) return false;
      D.ph = 'pause'; D.t = 0.35; p.face = 'up';
    }
    if (D.ph === 'pause') { D.t -= dt; p.moving = false; if (D.t <= 0) D.ph = 'in'; return true; }
    if (D.ph === 'in') {
      p.y -= 17 * dt; p.x += (dc.x - p.x) * Math.min(1, dt * 5);
      p.moving = true; p.hx = 0; p.hy = -1; p.anim += dt * 17 / 5;
      if (p.y <= base - 3) {
        p.y = base - 3; p.hidden = true; D.ph = 'inside'; D.t = D.stay;
        if (p.flew || D.home) p.gone = true;
      }
      return true;
    }
    if (D.ph === 'inside') {
      D.t -= dt; p.moving = false;
      if (D.t <= 0) {
        // resenärer som dök upp inne på flygplatsen kommer ut med sin väska
        if (!(D.spawned && D.b.id === 'flyg')) gotItem(p, D.b);
        if (p.flew) { p.gone = true; return true; }
        if (p.comp && rnd() < 0.4) gotItem(p.comp, D.b);
        D.ph = 'out0'; D.t = 0.55; p.hidden = false; p.face = 'down';
      }
      return true;
    }
    if (D.ph === 'out0') { D.t -= dt; p.moving = false; p.face = 'down'; if (D.t <= 0) D.ph = 'out'; return true; }
    if (D.ph === 'out') {
      p.y += 17 * dt; p.moving = true; p.hx = 0; p.hy = 1; p.anim += dt * 17 / 5;
      if (p.y >= base + 9) {
        p.door = null;
        if (p.dog) p.dog.tie = null;
        const N0 = nodes[p.node];
        p.path = N0 ? (nav.pathTo(p.x, p.y, N0.x, N0.y) || [{ x: N0.x, y: N0.y, gate: -1 }]) : [];
      }
      return true;
    }
    return false;
  }
  const doorAlpha = (p, y) => {
    const D = p.door;
    if (!D) return 1;
    if (D.ph === 'out0') return clamp(0.35 * (1 - D.t / 0.55), 0.05, 0.35);
    return clamp(0.35 + (y - (D.base - 3)) / 7 * 0.65, 0.35, 1);
  };

  // ---------- gång ----------
  let others = [];
  function movePed(p, dt) {
    if (p.door && updDoor(p, dt)) { p.ox *= 0.8; p.oy *= 0.8; return; }
    if (p.hold > 0) {
      p.hold -= dt; p.moving = false;
      // står man på en utvald plats (fönster, hållplats, bänk) glider sidoförskjutningen bort
      if (p.stillSpot || p.sit || !walk(p.x + p.ox, p.y + p.oy)) { const k = 1 - Math.min(1, dt * 5); p.ox *= k; p.oy *= k; }
      if (p.hang) idleHang(p, dt);
      if (p.hold <= 0) { p.look4bus = false; p.jump = false; if (p.fromBus) { p.fromBus = false; p.hidden = false; p.face = 'down'; } }
      return;
    }
    let wp = p.path[0];
    if (!wp) {
      if (p.leaving) { p.gone = true; return; }
      nextStep(p);
      if (p.plan[0]?.bus) p.look4bus = true;
      wp = p.path[0];
      // ingen ny väg (vänta, sitta, dörr …): stå still – annars fortsätt gå samma bildruta (inget blink)
      if (!wp || p.hold > 0) { p.moving = false; return; }
    }
    let dx = wp.x - p.x, dy = wp.y - p.y, d = Math.hypot(dx, dy);
    if (d > 0.01) { p.hx = dx / d; p.hy = dy / d; }
    // rödljus: stå vid kanten tills gubben blir grön
    if (wp.gate >= 0) {
      if (!green(wp.gate)) { p.moving = false; p.waitGate = true; p.face = faceTo(dx, dy); laneOffset(p, dt, wp); return; }
      // reaktionstid när gubben slår om – sedan kollas ljuset igen innan man kliver ut
      if (p.waitGate) { p.waitGate = false; p.hold = rr(0.15, 0.7); return; }
      if (typeof T.pedLight === 'function') { let l = 'g'; try { l = T.pedLight(wp.gate); } catch { /* strunta i det */ } if (l === 'x') { p.waitGate = true; p.moving = false; return; } }
      p.onCross = wp.gate; wp.gate = -1;
    }
    let sp = p.speed;
    if (env.rain && !(p.umb) && !p.jogger) sp *= 1.2;
    if (p.onCross >= 0 && !green(p.onCross)) sp *= 1.45;
    // någon rakt framför? sakta in lite
    const X = p.x + p.ox, Y = p.y + p.oy;
    let block = 0;
    for (const q of others) {
      if (q === p || q.hidden || q.sit) continue;
      const qx = q.x + (q.ox || 0), qy = q.y + (q.oy || 0);
      const rx = qx - X, ry = qy - Y, ahead = rx * p.hx + ry * p.hy;
      if (ahead <= 0 || ahead > 12) continue;
      const side = -rx * p.hy + ry * p.hx;
      if (Math.abs(side) < 5) block = Math.max(block, 1 - ahead / 14);
    }
    if (block) sp *= 1 - block * 0.55;
    const step = sp * dt;
    if (d <= step) {
      p.x = wp.x; p.y = wp.y; p.path.shift(); p.stillSpot = !!wp.noOff;
      if (p.onCross >= 0 && (!p.path.length || p.y >= CURB_S - 1 && p.y <= CURB_S + 3 || p.y <= CURB_N + 1 && p.y >= CURB_N - 3 || p.y >= CURB_SS - 1 && p.y < CURB_SS + 3 || p.y <= CURB_SN + 1 && p.y > CURB_SN - 3)) p.onCross = -1;
    } else { p.x += dx / d * step; p.y += dy / d * step; }
    p.moving = true;
    p.anim += dt * sp / (p.jogger ? 4.5 : 5);
    laneOffset(p, dt, wp);
  }
  // sidoförskjutningen måste vara fri både här och en bit framåt (annars hinner man in i hindret)
  const okOff = (p, tx, ty) => paved(p.x + tx, p.y + ty) && paved(p.x + p.hx * 5 + tx, p.y + p.hy * 5 + ty) && paved(p.x + p.hx * 10 + tx, p.y + p.hy * 10 + ty);
  // högertrafik på trottoaren: varje figur håller sig en bit till höger om mittlinjen
  function laneOffset(p, dt, wp) {
    const lane = wp && wp.noOff ? 0 : p.lane;
    let tx = -p.hy * lane, ty = p.hx * lane;
    if (lane) {
      if (!okOff(p, tx, ty)) { tx *= 0.5; ty *= 0.5; if (!okOff(p, tx, ty)) { tx = 0; ty = 0; } }
      // väj för någon som står i vägen
      for (const q of others) {
        if (q === p || q.hidden) continue;
        const rx = q.x + (q.ox || 0) - (p.x + p.ox), ry = q.y + (q.oy || 0) - (p.y + p.oy);
        const ahead = rx * p.hx + ry * p.hy;
        if (ahead <= 0 || ahead > 16) continue;
        const side = -rx * p.hy + ry * p.hx;
        if (Math.abs(side) < 6) {
          const s = side >= 0 ? -7 : 7, ax = tx - p.hy * s, ay = ty + p.hx * s;
          if (paved(p.x + ax, p.y + ay)) { tx = ax; ty = ay; }
          break;
        }
      }
    }
    if (p.waitGate) {
      // vid rödljuset sprider man ut sig längs kanten och några står en bit bakom
      const a = p.wj[0] * 8, bk = p.wj[1] * 8;
      const wx = tx - p.hy * a - p.hx * bk, wy = ty + p.hx * a - p.hy * bk;
      if (paved(p.x + wx, p.y + wy)) { tx = wx; ty = wy; }
    }
    // mjukt mot målet; står förskjutningen i ett hinder glider den snabbare hem (inget ryck)
    const k = Math.min(1, dt * (walk(p.x + p.ox, p.y + p.oy) ? 4 : 12));
    p.ox += (tx - p.ox) * k; p.oy += (ty - p.oy) * k;
  }
  function sampleTrail(p, dt) {
    p.trailT += dt;
    if (p.trailT < 0.05) return;
    p.trailT = 0;
    p.trail.push({ x: p.x + p.ox, y: p.y + p.oy });
    if (p.trail.length > 14) p.trail.shift();
  }
  // Det man SER: gå/stå och riktning med lite tröghet, så att en figur aldrig
  // blinkar mellan stå- och gåbild eller vänder sig fram och tillbaka mellan två bildrutor.
  function updShow(p, dt) {
    if (p.moving) { p.showMove = true; p.stillT = 0; } else { p.stillT += dt; if (p.stillT > 0.14) p.showMove = false; }
    let want;
    if (p.sit) want = p.sit.dir;
    else if (p.showMove) want = headingDir(p.hx, p.hy);
    else want = p.look4bus && Math.sin(env.t * 0.8 + p.seed) > 0.75 ? 'left' : p.face;
    if (want === p.showDir) { p.dirT = 0; return; }
    p.dirT += dt;
    // stilla figurer vänder sig direkt när de vill; gående först när riktningen hållit i sig en stund
    if (!p.showMove || p.dirT > 0.12 || p.sit) { p.showDir = want; p.dirT = 0; }
  }

  // ---------- sällskap: går bredvid ledaren (följer dess spår) ----------
  function updComp(c, dt) {
    const L = c.leader;
    c.hidden = L.hidden;
    c.door = L.door;
    if (c.hidden) { c.x = L.x; c.y = L.y; c.ox = c.oy = 0; c.moving = false; return; }
    // ledaren sitter: sätt dig på platsen bredvid (via bänkens gångpunkt)
    if (L.sit && c.seatWant) {
      const s = c.seatWant, onSeat = Math.hypot(c.x - s.x, c.y - s.y) < 0.8;
      if (onSeat) { c.sit = s; c.moving = false; c.face = s.dir; return; }
      const nearWalk = Math.hypot(c.x - s.walk.x, c.y - s.walk.y) < 1.5 || c.goSeat;
      const tx = nearWalk ? s.x : s.walk.x, ty = nearWalk ? s.y : s.walk.y;
      if (nearWalk) c.goSeat = true;
      const dx = tx - c.x, dy = ty - c.y, d = Math.hypot(dx, dy), st = Math.min(d, 30 * dt);
      if (d > 0.01) { c.x += dx / d * st; c.y += dy / d * st; c.hx = dx / d; c.hy = dy / d; }
      c.moving = d > 0.3; if (c.moving) c.anim += dt * 6;
      return;
    }
    c.goSeat = false;
    if (c.sit) { c.sit = null; c.x = c.sitFrom?.x ?? c.x; }
    const tr = L.trail, lag = Math.min(tr.length - 1, 5);
    const src = lag >= 0 ? tr[tr.length - 1 - lag] : { x: L.x, y: L.y };
    let tx = src.x + L.hy * 8, ty = src.y - L.hx * 8;
    if (L.door || !paved(tx, ty) || L.waitGate || L.sit) {
      tx = src.x; ty = src.y;
      if (L.waitGate) { tx = L.x + L.ox - L.hy * -9; ty = L.y + L.oy + L.hx * -9; if (!paved(tx, ty)) { tx = src.x; ty = src.y; } }
      if (L.sit) { tx = L.sit.walk.x + 9; ty = L.sit.walk.y; }
    }
    const dx = tx - c.x, dy = ty - c.y, d = Math.hypot(dx, dy);
    const sp = Math.max(L.speed * 1.5, 34) * dt;
    // hysteres: börja gå vid > 1,5 px, stanna först när man är nästan framme
    if (!c.moving && d > 1.5) c.moving = true;
    else if (c.moving && d < 0.4 && !L.moving) c.moving = false;
    if (d > 0.3) {
      const s = Math.min(d, sp), nx = c.x + dx / d * s, ny = c.y + dy / d * s;
      // glid längs hindret i stället för att hoppa tillbaka i ledarens spår
      if (walk(nx, ny) || L.door) { c.x = nx; c.y = ny; }
      else if (walk(nx, c.y)) c.x = nx;
      else if (walk(c.x, ny)) c.y = ny;
      else { c.stuck = (c.stuck || 0) + dt; if (c.stuck > 0.5) { c.x = nx; c.y = ny; } }
      if (d > 1) { c.hx = dx / d; c.hy = dy / d; }
    } else c.stuck = 0;
    if (c.moving) c.anim += dt * L.speed / 5;
    c.face = L.moving ? headingDir(c.hx, c.hy) : L.face;
    c.speed = L.speed;
  }

  // ---------- ungdomarna i klungan ----------
  function idleHang(p, dt) {
    p.gestT -= dt;
    if (p.gest > 0) p.gest -= dt;
    if (p.gestT > 0) return;
    p.gestT = rr(1.2, 4.5);
    const H = p.hang, r = rnd();
    if (r < 0.35) {
      // vänd dig mot någon annan i klungan
      const o = H.used.filter((q) => q && q !== p);
      if (o.length) { const q = pick(o); p.face = faceTo(q.x - p.x, (q.y - p.y) * 0.6); }
    } else if (r < 0.6) p.gest = rr(0.3, 0.8);            // skrattar/gestikulerar
    else if (r < 0.75) { p.face = 'down'; p.phoneT = rr(2, 5); } // tittar i mobilen
    else p.face = faceTo(H.cx - p.x, (H.cy - p.y) * 0.6);
  }

  // ---------- hundar ----------
  function updDog(p, dt) {
    const g = p.dog, X = p.x + p.ox, Y = p.y + p.oy;
    const inside = p.door && p.door.ph !== 'app' && p.door.ph !== 'out';
    let tx, ty, spd = Math.max(p.speed * 1.5, 40);
    g.cool -= dt; if (g.bark > 0) g.bark -= dt; if (g.wag > 0) g.wag -= dt;
    if (inside && g.tie) { tx = g.tie.x; ty = g.tie.y; g.act = 'sit'; }
    else if (g.free) {
      // lös i hundrastgården: spring runt, nosa, sitt en stund, spring igen
      g.t -= dt;
      if (g.t <= 0 || (!g.moving && g.act === 'run')) {
        const r = g.free, a = rnd();
        g.act = a < 0.45 ? 'run' : a < 0.8 ? 'sniff' : 'sit';
        g.t = g.act === 'run' ? rr(1, 2.6) : rr(1.2, 3.5);
        if (g.act === 'run') { const q = nav.nearest(Math.round(rr(r[0], r[2])), Math.round(rr(r[1], r[3])), walk, 6); if (q) { g.tx = q[0]; g.ty = q[1]; } }
        else { g.tx = g.x; g.ty = g.y; if (rnd() < 0.5) g.wag = rr(0.8, 2); }
      }
      tx = g.tx; ty = g.ty; spd = g.act === 'run' ? 52 : 24;
    } else if (g.call || p.moving || p.waitGate) {
      // hunden drar lite före, på vänstra sidan (på väg tillbaka från rastgården: rakt till matte/husse)
      tx = X + p.hx * 9 + p.hy * 4; ty = Y + p.hy * 9 - p.hx * 4;
      if (g.call) { tx = X + 6; ty = Y + 2; spd = 50; }
      if (p.waitGate) {
        // vid rödljuset: sitt kvar bredvid, inte ute i gatan
        tx = X + p.hy * 7; ty = Y - p.hx * 7;
        if (!paved(tx, ty) || !paved(tx + p.hx * 6, ty + p.hy * 6)) { tx = X - p.hx * 6; ty = Y - p.hy * 6; }
        g.act = 'sit';
      } else if (!walk(tx, ty) || (p.onCross >= 0 && !paved(tx, ty))) {
        const tr = p.trail, s = tr[Math.max(0, tr.length - 8)];
        if (s) { tx = s.x; ty = s.y; } else { tx = X - p.hx * 8; ty = Y - p.hy * 8; }
      }
      if (!p.waitGate) g.act = 'walk';
    } else if (p.sit) {
      // matte/husse sitter på bänken: lägg dig vid fötterna
      tx = p.sit.walk.x + (p.sit.dir === 'up' ? 6 : 8); ty = p.sit.walk.y + (p.sit.dir === 'up' ? -1 : 1); g.act = 'sit'; spd = 22;
    } else {
      // matte/husse står still: nosa runt, ibland sitta
      g.t -= dt;
      if (g.t <= 0) {
        g.act = rnd() < 0.4 ? 'sit' : 'sniff';
        g.t = rr(1.5, 4);
        const a = rnd() * Math.PI * 2, r = rr(5, 11);
        g.tx = X + Math.cos(a) * r; g.ty = Y + Math.sin(a) * r * 0.5;
        if (!walk(g.tx, g.ty)) { g.tx = X + 6; g.ty = Y + 1; }
        if (rnd() < 0.35) g.wag = rr(0.8, 2.2);
      }
      tx = g.tx; ty = g.ty; spd = 22;
    }
    const dx = tx - g.x, dy = ty - g.y, d = Math.hypot(dx, dy);
    // hysteres: börja gå först när målet är en bit bort, sluta först när man är nästan
    // framme. Följer hunden sin GÅENDE ägare stannar den inte alls – målpunkten flyttar
    // sig ju en halv pixel i taget och gå/stå skulle annars blinka i ägarens takt.
    const follow = p.moving && !g.free && !p.waitGate && !inside;
    if (!g.moving && d > (follow ? 1.2 : 2.5)) g.moving = true;
    else if (g.moving && d < 0.6 && !follow) g.moving = false;
    if (g.moving && d > 0.01) {
      const s = Math.min(d, spd * dt), nx = g.x + dx / d * s, ny = g.y + dy / d * s;
      // glid längs hindret i stället för att hoppa: prova hela steget, sedan bara x, sedan bara y
      if (walk(nx, ny) || d < 3 || g.call) { g.x = nx; g.y = ny; }
      else if (walk(nx, g.y)) g.x = nx;
      else if (walk(g.x, ny)) g.y = ny;
      // bentakt efter den faktiska farten (tätt bakom ägaren travar hunden i hens takt)
      const asp = dt > 0 ? Math.min(spd, s / dt) : spd;
      g.anim += dt * Math.max(asp, 16) / 3.2;
    }
    // kopplet är 18 px långt (mjukt: dras in gradvis, högst lite snabbare än hunden själv går)
    if (!inside && !g.free) {
      const lx = g.x - X, ly = g.y - Y, ld = Math.hypot(lx, ly);
      if (ld > 18) {
        const k = Math.min(1, dt * 8), mx = (X + lx / ld * 18 - g.x) * k, my = (Y + ly / ld * 18 - g.y) * k, mm = Math.hypot(mx, my), cap = Math.max(spd, 60) * dt * 1.2;
        const f = mm > cap ? cap / mm : 1;
        g.x += mx * f; g.y += my * f;
      }
    }
    // riktning med tröghet: byt bara om den nya riktningen hållit i sig i 0,3 s
    let want = g.dir;
    if (inside && !g.moving) want = doorCenter(p.door.b).x < g.x ? -1 : 1;
    else if (g.moving) { if (!g.free && p.moving && Math.abs(p.hx) > 0.2) want = p.hx < 0 ? -1 : 1; else if (Math.abs(dx) > 1.5) want = dx < 0 ? -1 : 1; }
    else if (g.look) want = g.look;
    else if (!g.free && g.act !== 'sit' && Math.abs(X - g.x) > 3) want = X < g.x ? -1 : 1;
    if (want !== g.dir) { g.dirT = (g.dirT || 0) + dt; if (g.dirT >= 0.3) { g.dir = want; g.dirT = 0; } } else g.dirT = 0;
    // bildrutan: gå · skälla · sitta · nosa · vifta · stå
    if (g.moving) g.fr = 1 + (Math.floor(g.anim) % 2);
    else if (g.bark > 0) g.fr = Math.floor(env.t * 7 + p.seed) % 2 ? 5 : 0;
    else if (g.act === 'sit' || (inside && !g.moving)) g.fr = 3;
    else if (g.act === 'sniff' && Math.sin(env.t * 3 + p.seed) > -0.3) g.fr = 4;
    else if (g.wag > 0) g.fr = Math.floor(env.t * 9 + p.seed) % 2 ? 6 : 0;
    else g.fr = 0;
    if (g.bark <= 0) g.look = 0;
  }
  // hundar som möts skäller och viftar; katter och ekorrar får en skäll
  function dogSocial() {
    const dogs = [];
    for (const p of peds) if (p.dog && !p.hidden && !(p.door && p.door.ph === 'inside' && !p.dog.tie)) dogs.push(p.dog);
    for (let i = 0; i < dogs.length; i++) {
      const a = dogs[i];
      if (a.cool > 0) continue;
      for (let j = 0; j < dogs.length; j++) {
        if (i === j) continue;
        const b = dogs[j];
        if (Math.abs(a.x - b.x) > 34 || Math.abs(a.y - b.y) > 16) continue;
        a.cool = rr(4, 9); b.cool = Math.max(b.cool, rr(3, 6));
        if (rnd() < 0.55) { a.bark = rr(0.6, 1.3); a.look = b.x < a.x ? -1 : 1; } else a.wag = rr(1.2, 2.4);
        b.wag = Math.max(b.wag, rr(1, 2));
        if (a.bark > 0) env.play?.('bark');
        break;
      }
      if (a.cool > 0) continue;
      for (const c of cats) if (visibleCat(c) && Math.abs(a.x - c.x) < 30 && Math.abs(a.y - c.y) < 14) { a.bark = rr(0.8, 1.6); a.look = c.x < a.x ? -1 : 1; a.cool = rr(5, 10); c.st = 'sit'; c.t = rr(2, 4); break; }
      if (a.cool > 0) continue;
      for (const q of squirrels) if (q.st === 'g' && Math.abs(a.x - q.x) < 40 && Math.abs(a.y - q.y) < 18) { a.bark = rr(0.8, 1.4); a.look = q.x < a.x ? -1 : 1; a.cool = rr(4, 9); break; }
    }
  }

  // ---------- befolkningen ----------
  function weatherFactor() {
    const w = W(), I = w.intensity ?? 0.6, k = w.kind;
    let f = 1;
    if (k === 'regn') f = I > 0.75 ? 0.45 : 0.72;
    else if (k === 'snö') f = I > 0.75 ? 0.55 : 0.85;
    else if (k === 'dimma') f = 0.62;
    else if (k === 'blåst') f = 0.85;
    else if (k === 'sol' && (w.temp ?? 15) > 16) f = 1.12;
    if ((w.temp ?? 15) < -8) f *= 0.8;
    return f;
  }
  function targetCount(h) {
    const n = h < 5 ? 3 : h < 6.5 ? 4 : h < 8 ? 10 : h < 16 ? 15 : h < 19 ? 16 : h < 21 ? 10 : h < 23 ? 7 : 4;
    // (v3) finanskvarteret myllrar på dagen – mest i rusningen morgon och eftermiddag
    const dt = dtNear() && h >= 7 && h < 19 ? (rushAM(h) || rushPM(h) ? 1.4 : 1.2) : 1;
    return Math.max(2, Math.round(n * dt * weatherFactor()));
  }
  const ordinary = () => { let n = 0; for (const p of peds) if (p.kind === 'folk') n++; return n; };
  // Nya figurer dyker upp strax utanför bild (eller kommer ut ur en butik/ett hus),
  // så att det alltid är liv där spelaren är – världen är tio skärmar bred och fyra hög.
  function spawnSomewhere(initial) {
    const h = env.hour;
    const doors = ALL_B.filter((b) => enterable(b) && nav.doorNode[b.id] !== undefined && ((PLACES[b.id] && isOpen(b, h)) || HOMES.includes(b.id)) && camD(doorCenter(b).x, baseOf(b)) < 330);
    // (v3) eftermiddagsrusningen: kontorsfolket strömmar ut genom karuselldörrarna
    if (rushPM(h) && dtNear() && rnd() < (initial ? 0.25 : 0.4)) {
      const offs = doors.filter((b) => OFFICES.includes(b.id));
      if (offs.length) return spawn('door', pick(offs));
    }
    if (rnd() < (initial ? 0.2 : 0.3) && doors.length) return spawn('door', pick(doors));
    const cands = nav.spawnNodes.filter((i) => {
      const n = nodes[i];
      return Math.abs(n.x - camCX()) < (initial ? 300 : 340) && Math.abs(n.y - camCY()) < 230 && (initial || !visible(n.x, n.y, 26));
    });
    const edges = nav.exits.filter((e) => !e.back && camD(nodes[e.n].x, nodes[e.n].y) < 340);
    if (edges.length && (!cands.length || rnd() < 0.3)) return spawn('edge', pick(edges));
    if (cands.length) return spawn('node', pick(cands));
    return nav.exits.length ? spawn('edge', pick(nav.exits)) : spawn('node', pick(nav.spawnNodes));
  }
  let spawnT = 0;
  function manage(dt) {
    // alla vanliga figurer räknas (även sällskap), målet är 10–16 på dagen och färre på natten och i ösregn
    const want = targetCount(env.hour);
    const have = ordinary();
    spawnT -= dt;
    if (have < want && spawnT <= 0) { spawnSomewhere(false); spawnT = want - have > 4 ? rr(0.1, 0.3) : rr(0.4, 1.6); }
    // de som vandrat långt från kameran byts ut mot nya i närheten
    for (const p of peds) {
      if (p.leader || p.gone) continue;
      if (camD(p.x, p.y) > 460 && !visible(p.x, p.y, 40) && rnd() < dt * 0.5) p.gone = true;
      if (p.kind === 'folk' && have > want + 1 && !visible(p.x, p.y, 40) && rnd() < dt * 0.05) p.gone = true;
    }
    manageSpots(dt, false);
    cleanup();
  }
  function release(p) {
    if (p.spot) { p.spot.busy = null; p.spot = null; }
    if (p.sit) freeSeat(p.sit, p);
    if (p.wantSeat) freeSeat(p.wantSeat, p);
    if (p.seatWant) freeSeat(p.seatWant, p);
    if (p.hang) { const i = p.hang.used.indexOf(p); if (i >= 0) p.hang.used[i] = null; }
    if (p.play) p.play.kids = p.play.kids.filter((q) => q !== p);
  }
  function cleanup() {
    if (!peds.some((p) => p.gone || (p.leader && p.leader.gone))) return;
    for (const p of peds) if (p.gone || (p.leader && p.leader.gone)) release(p);
    peds = peds.filter((p) => !p.gone && !(p.leader && p.leader.gone));
  }
  // Kameran hoppade (ut ur en butik långt bort, buss, teleport): byt ut de som blev
  // kvar långt borta och fyll på runt den nya platsen direkt.
  let lastCam = null;
  function repopulate() {
    for (const p of peds) if (!p.leader && camD(p.x, p.y) > 380) p.gone = true;
    cleanup();
    for (let i = 0; i < 40 && ordinary() < targetCount(env.hour); i++) preRun(spawnSomewhere(true), rr(0, 16));
    manageSpots(0, true);
  }

  // ---------- platser med eget folk: ungdomar vid kiosken, barn på lekplatserna ----------
  const HANGS = [];
  {
    const add = (id, cx, cy, hours, want, nodeId) => {
      const c = nav.nearest(Math.round(cx), Math.round(cy), walk, 10);
      if (!c || nodeId === undefined || nodeId < 0) return;
      // 4–5 platser i en ring runt mitten (på gångbar mark)
      const pos = [];
      for (let k = 0; k < 7 && pos.length < 5; k++) {
        const a = k * 2.4 + 0.3, q = nav.nearest(Math.round(c[0] + Math.cos(a) * 8), Math.round(c[1] + Math.sin(a) * 4), walk, 4);
        if (q && !pos.some((o) => Math.hypot(o[0] - q[0], o[1] - q[1]) < 6) && nav.pathTo(nodes[nodeId].x, nodes[nodeId].y, q[0], q[1])) pos.push(q);
      }
      if (pos.length >= 3) HANGS.push({ id, cx: c[0], cy: c[1], pos, used: pos.map(() => null), hours, want, node: nodeId });
    };
    const nb = byId('narbutik'), L = nav.lines;
    // "kiosken" i förorten är närbutiken som har öppet dygnet runt
    if (nb && L.N.length) add('kiosken', nb.door.x1 + 18, baseOf(nb) + 17, [14, 25], [3, 5], nav.at(L.N, nb.door.x1 + 18));
    const bt = BUS_STOPS.find((s) => s.broken);
    if (bt && L.S.length) add('betongtorget', bt.x + 58, bt.y - 12, [15, 23.5], [2, 4], nav.at(L.S, bt.x + 44));
    const lx = LOTS.find((l) => l.id === 'lekplats_x');
    if (lx && nav.special.lekX >= 0) add('lekplatsen', (lx.rect[0] + lx.rect[2]) / 2 + 20, lx.rect[1] + 50, [19, 23], [2, 4], nav.special.lekX);
  }
  const PLAYS = [];
  if (PARK.playground && nav.special.lekP >= 0) PLAYS.push({ id: 'parken', rect: [PARK.playground[0] + 6, PARK.playground[1] + 6, PARK.playground[2] - 6, PARK.playground[3] - 4], node: nav.special.lekP, kids: [] });
  {
    const lx = LOTS.find((l) => l.id === 'lekplats_x');
    if (lx && nav.special.lekX >= 0) PLAYS.push({ id: 'förorten', rect: [lx.rect[0] + 8, lx.rect[1] + 10, lx.rect[2] - 8, lx.rect[3] - 8], node: nav.special.lekX, kids: [] });
  }
  const inHours = (h, [a, b]) => (b > 24 ? h >= a || h < b - 24 : h >= a && h < b);
  // De höga lekredskapen (gungställningen, rutschkanan) ritas 30–40 pixlar över sin
  // basrad. Ett barn som stannar i bandet strax bakom (norr om) dem skyms av konsten
  // och ser ut att stå ovanpå överliggaren – så i det bandet stannar ingen.
  let lekBand = null;
  function lekSkymd(x, y) {
    if (!lekBand) {
      lekBand = [];
      const P = PR();
      const its = P && typeof P.items === 'function' ? safe(() => P.items(), []) : [];
      for (const it of its || []) {
        if (!it || !Number.isFinite(it.x) || !Number.isFinite(it.y)) continue;
        if (it.kind === 'gunga' || it.kind === 'rutschkana') lekBand.push([it.x - 24, it.y - 40, it.x + 24, it.y - 2]);
        else if (it.kind === 'gunghäst' || it.kind === 'gungbräda') lekBand.push([it.x - 20, it.y - 12, it.x + 20, it.y - 2]);
      }
      // utan rekvisitans lista: smala, grunda hinder i lekytorna behandlas som redskap
      if (!lekBand.length) {
        for (const Pl of PLAYS) for (const o of env.obstacles || []) {
          if (!o || o[2] - o[0] > 60 || o[3] - o[1] > 6) continue;
          if (o[0] >= Pl.rect[0] - 30 && o[2] <= Pl.rect[2] + 30 && o[1] >= Pl.rect[1] - 10 && o[3] <= Pl.rect[3] + 10) lekBand.push([o[0] - 2, o[1] - 30, o[2] + 2, o[1] - 2]);
        }
      }
    }
    for (const b of lekBand) if (x >= b[0] && x <= b[2] && y >= b[1] && y <= b[3]) return true;
    return false;
  }
  // en slumpad, gångbar punkt i lekytan där barnet syns helt (inte skymd bakom ett redskap)
  function lekPunkt(r) {
    for (let k = 0; k < 8; k++) {
      const c = nav.nearest(Math.round(rr(r[0], r[2])), Math.round(rr(r[1], r[3])), walk, 6);
      if (c && !lekSkymd(c[0], c[1])) return c;
    }
    return null;
  }
  function spawnFor(nodeId, o, initial, placeAt) {
    // kom gående från en nod utom synhåll i närheten – eller stå redan på plats vid start
    let p;
    if (initial && placeAt) {
      p = spawn('node', nodeId, o);
      p.x = placeAt[0]; p.y = placeAt[1];
    } else {
      const N0 = nodes[nodeId];
      const cands = nav.spawnNodes.filter((i) => { const n = nodes[i]; const d = Math.hypot(n.x - N0.x, n.y - N0.y); return d < 300 && d > 60 && !visible(n.x, n.y, 26); });
      p = spawn('node', cands.length ? pick(cands) : nodeId, o);
    }
    return p;
  }
  function manageSpots(dt, initial) {
    const h = env.hour, w = W(), wet = w.kind === 'regn' && (w.intensity ?? 0.6) > 0.5, f = weatherFactor();
    for (const H of HANGS) {
      const near = camD(H.cx, H.cy) < 420 && inHours(h, H.hours);
      if (!near) continue;
      const want = Math.round((H.want[0] + (hash(env.day | 0, H.cx, 5) * (H.want[1] - H.want[0] + 0.99))) * (wet ? 0.5 : f > 1 ? 1 : f));
      const have = H.used.filter((q) => q && !q.gone).length + peds.filter((q) => q.goHang === H).length;
      if (have >= want || (!initial && rnd() > dt * 0.8)) continue;
      const k = H.used.findIndex((q) => !q || q.gone);
      if (k < 0) continue;
      const pos = H.pos[k];
      const plan = [{ k: 'go', n: H.node }, { k: 'to', x: pos[0], y: pos[1], noOff: true, at: H.node }, { k: 'hang', spot: H, t: rr(60, 220) }, { k: 'unhang' }, { k: 'to', x: nodes[H.node].x, y: nodes[H.node].y }, { k: 'leave' }];
      const p = spawnFor(H.node, { special: 'youth', youth: true, kid: false, plan: initial ? [{ k: 'hang', spot: H, t: rr(40, 220) }, { k: 'unhang' }, { k: 'to', x: nodes[H.node].x, y: nodes[H.node].y }, { k: 'leave' }] : plan }, initial, pos);
      p.umb = rnd() < 0.3 ? p.umb : null; p.speed = rr(22, 28);
      H.used[k] = p; p.goHang = initial ? null : H;
      if (initial) { p.node = H.node; }
    }
    for (const Pl of PLAYS) {
      const [x0, y0, x1, y1] = Pl.rect, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
      Pl.kids = Pl.kids.filter((q) => !q.gone);
      const day = h >= 8.5 && h < 19.5 && !(w.kind === 'regn' && (w.intensity ?? 0.6) > 0.45) && w.kind !== 'dimma';
      if (!day || camD(cx, cy) > 430) continue;
      const want = Math.max(0, Math.round((2 + hash(env.day | 0, Math.round(cx), 9) * 2.99) * (w.kind === 'regn' ? 0.4 : f > 1 ? 1.2 : f)));
      if (Pl.kids.length >= want || (!initial && rnd() > dt * 0.6)) continue;
      // ett barn (ibland två) och en förälder som sätter sig på en bänk nära lekplatsen eller står vid kanten
      const n = Math.min(want - Pl.kids.length, rnd() < 0.4 ? 2 : 1);
      const at = initial ? lekPunkt(Pl.rect) : null;
      for (let i = 0; i < n; i++) {
        const plan = [{ k: 'go', n: Pl.node }, { k: 'play', rect: Pl.rect, until: env.t + rr(50, 150) }, { k: 'leave' }];
        // barn två ställs en bit åt sidan – men inte in i skymningsbandet
        const off = at && (i === 0 || !lekSkymd(at[0] + i * 7, at[1])) ? i * 7 : 0;
        const kid = spawnFor(Pl.node, { special: 'play', kid: true, plan: initial ? [{ k: 'play', rect: Pl.rect, until: env.t + rr(30, 150) }, { k: 'leave' }] : plan }, initial, at && [at[0] + off, at[1]]);
        kid.play = Pl; kid.umb = null; if (initial) kid.node = Pl.node;
        Pl.kids.push(kid);
      }
      const seat = seats().filter((s) => !s.stop && seatFree(s) && Math.hypot(s.x - cx, s.y - cy) < 90).sort((a, b) => Math.hypot(a.x - cx, a.y - cy) - Math.hypot(b.x - cx, b.y - cy))[0];
      const info = seat && seatInfo(seat);
      const edge = nav.nearest(Math.round(x1 + 8), Math.round(cy), walk, 10) || nav.nearest(Math.round(x0 - 8), Math.round(cy), walk, 10);
      const pplan = info ? [{ k: 'go', n: info.node }, { k: 'seat', seat, t: rr(60, 160) }, { k: 'leave' }]
        : edge ? [{ k: 'go', n: Pl.node }, { k: 'pts', pts: nav.pathTo(nodes[Pl.node].x, nodes[Pl.node].y, edge[0], edge[1]) || [] }, { k: 'wait', t: rr(50, 140), face: faceTo(cx - edge[0], 0) }, { k: 'leave' }] : null;
      if (pplan && rnd() < 0.85) {
        const par = spawnFor(info ? info.node : Pl.node, { special: 'parent', kid: false, plan: pplan }, initial, null);
        if (initial && info) { par.node = info.node; par.x = nodes[info.node].x; par.y = nodes[info.node].y; }
      }
    }
  }

  // ------------------------------------------------------------------
  //  Markfåglar: duvor, måsar, kråkor och småfåglar
  // ------------------------------------------------------------------
  const spotsOf = (list) => list.map(([x, y]) => nav.nearest(Math.round(x), Math.round(y), walk, 10)).filter(Boolean);
  const FLOCK = spotsOf([[1040, 207], [470, 209], [1395, 206], [720, 293], [1110, 294], [170, 293], [905, 386], [962, 352],
    [620, 352], [1470, 358], [150, 356], [560, 24], [1300, 24], [800, 210], [1560, 294],
    [230, 652], [700, 655], [1010, 660], [1500, 652], [400, 742], [900, 741], [1300, 738], [2060 + SDX, 296], [1880 + SDX, 205], [2230 + SDX, 300], [1900 + SDX, 430], [2110 + SDX, 472],
    // v3: Finanstorget (kring tjuren, fontänerna och bänkarna) och downtowns trottoarer
    ...(DTL ? [[DTL.statue.x - 30, DTL.statue.y + 36], [DTL.statue.x + 40, DTL.statue.y - 34], [DTL.plaza[0] + 60, 330], [DTL.axis + 40, 452],
      ...(DTL.fountains || []).map((f) => [f.x + 8, f.y + 34]), [2010, 297], [1860, 655]] : [])]);
  // måsarna: kanalkajen, och (v3) broarnas trottoarer vid räckena och kajerna längs floden
  const riverGulls = RIV ? [[RIV.wx0 + 40, 190], [RIV.wx0 + 250, 190], [RIV.wx1 - 70, 190], [RIV.wx0 + 110, 302], [RIV.wx1 - 150, 302],
    [RIV.wx0 + 90, 644], [RIV.wx1 - 60, 756], [RIV.quayW[0] + 8, 110], [RIV.quayW[0] + 8, 560], [RIV.quayE[0] + 12, 420], [RIV.quayE[0] + 12, 90], [RIV.quayE[0] + 12, 710]] : [];
  const GULL_SPOTS = spotsOf([[150, 766], [480, 764], [820, 768], [1180, 766], [1520, 764], [1900 + SDX, 766], [2280 + SDX, 768], [2600 + SDX, 765], [2196 + SDX, 205], [1150, 207], [640, 740], [2420 + SDX, 742], ...riverGulls]);
  // (kråkorna på kyrkogården håller sig innanför muren även när tomten krympt – Leksakslådan tog östra delen)
  const KGX = (LOTS.find((l) => l.id === 'kyrkogard')?.rect || [1000, 0, 1212])[2];
  const CROW_SPOTS = spotsOf([[1060, 560], [Math.min(1150, KGX - 20), 610], [Math.min(1110, KGX - 30), 520], [2520 + SDX, 360], [2640 + SDX, 420], [2060 + SDX, 360], [2320 + SDX, 610], [1790 + SDX, 420], [2560 + SDX, 28], [2350 + SDX, 476], [1850 + SDX, 470],
    ...(DTL ? [[DTL.back[0] + 132, 476], [DTL.back[2] - 8, 476]] : [])]);   // (i gränderna – bakgatan bakom tornen är hinder)
  const birdsG = [];
  const SPEC = {
    duva: { sets: () => S.pig, flee: 20, spd: 9, spots: FLOCK, day: true },
    mas: { sets: () => [S.gull], flee: 26, spd: 11, spots: GULL_SPOTS, day: false },
    kraka: { sets: () => [S.crow], flee: 34, spd: 8, spots: CROW_SPOTS, day: true },
    sparv: { sets: () => S.sparrow, flee: 22, spd: 0, spots: [], hide: true },
  };
  const threatsNear = (x, y, r) => {
    for (const q of env.people || []) if (Math.abs(q.x - x) < r && Math.abs(q.y - y) < r * 0.7) return q;
    for (const p of peds) if (p.dog && Math.abs(p.dog.x - x) < r + 4 && Math.abs(p.dog.y - y) < (r + 4) * 0.7) return p.dog;
    return null;
  };
  function landSpot(s, r = 14) {
    for (let i = 0; i < 6; i++) {
      const x = s[0] + rr(-r, r), y = s[1] + rr(-r * 0.43, r * 0.43);
      if (walk(x, y)) return [x, y];
    }
    return [s[0], s[1]];
  }
  function mkBird(sp, spot, x, y, v) {
    return { sp, x, y, v, dir: pick([-1, 1]), st: 'g', act: 'stand', t: rr(0.2, 2), alt: 0, spot, tx: x, ty: y, fl: null, panic: 0, anim: rnd() * 10, from: null, hop: 0 };
  }
  function seedBirds() {
    const place = (sp, spots, nFlocks, per, variants) => {
      for (const s of [...spots].sort(() => rnd() - 0.5).slice(0, nFlocks)) {
        const n = ri(per[0], per[1]);
        for (let i = 0; i < n; i++) { const [x, y] = landSpot(s, sp === 'sparv' ? 10 : 14); birdsG.push(mkBird(sp, s, x, y, pick(variants))); }
      }
    };
    place('duva', FLOCK, 11, [2, 5], [0, 0, 0, 0, 1, 1, 2, 3]);
    place('mas', GULL_SPOTS, 7, [1, 3], [0]);
    place('kraka', CROW_SPOTS, 6, [1, 3], [0]);
    // småfåglarna bor i buskarna och häckarna: gråsparvar oftast, en och annan talgoxe och bofink
    const homes = bushes.length ? bushes : [];
    SPEC.sparv.spots = homes.map(([x, y]) => [x, y + 3]);
    place('sparv', SPEC.sparv.spots, Math.min(14, homes.length), [1, 3], [0, 0, 0, 1, 2]);
  }
  function flight(pg, tx, ty, a1) {
    const dist = Math.hypot(tx - pg.x, ty - pg.y), sp = pg.sp === 'sparv' ? rr(60, 80) : pg.sp === 'mas' ? rr(55, 75) : rr(70, 92);
    pg.fl = { x0: pg.x, y0: pg.y, a0: pg.alt, x1: tx, y1: ty, a1, T: Math.max(pg.sp === 'sparv' ? 0.35 : 0.9, dist / sp), u: 0, h: (pg.sp === 'sparv' ? 5 : 12) + dist * 0.08, away: a1 > 0 };
    pg.st = 'f';
    if (Math.abs(tx - pg.x) > 2) pg.dir = tx < pg.x ? -1 : 1;
  }
  function takeOff(pg, from) {
    const SP = SPEC[pg.sp];
    if (SP.hide && pg.spot) { flight(pg, pg.spot[0] + rr(-3, 3), pg.spot[1] - 3, 0); pg.hideAfter = true; return; }
    const away = Math.sign(pg.x - (from ? from.x : pg.x - 1)) || pick([-1, 1]);
    const cands = SP.spots.filter((s) => Math.sign(s[0] - pg.x) === away && Math.abs(s[0] - pg.x) > 60 && Math.abs(s[0] - pg.x) < 460 && Math.abs(s[1] - pg.y) < 260 && !threatsNear(s[0], s[1], 36));
    if (cands.length && rnd() < 0.75 && env.dark < 0.3) {
      const s = pick(cands), [x, y] = landSpot(s);
      pg.spot = s; flight(pg, x, y, 0);
    } else flight(pg, pg.x + away * rr(180, 300), pg.y - rr(30, 80), rr(70, 100));
  }
  function updBirdsG(dt) {
    const dark = env.dark > 0.3, cx = camCX(), cy = camCY();
    for (const pg of birdsG) {
      pg.anim += dt;
      const SP = SPEC[pg.sp];
      // långt från kameran står fåglarna bara still (ingen syns, inget kostar)
      if (pg.st === 'g' && (Math.abs(pg.x - cx) > 520 || Math.abs(pg.y - cy) > 360)) continue;
      if (pg.st === 'g') {
        if (pg.panic > 0) { pg.panic -= dt; if (pg.panic <= 0) takeOff(pg, pg.from); continue; }
        const th = threatsNear(pg.x, pg.y, SP.flee);
        if (th) {
          takeOff(pg, th);
          // hela flocken flaxar iväg, en efter en
          for (const o of birdsG) if (o !== pg && o.sp === pg.sp && o.st === 'g' && o.panic <= 0 && Math.hypot(o.x - pg.x, o.y - pg.y) < 34) { o.panic = rr(0.05, 0.35); o.from = th; }
          continue;
        }
        if (dark && pg.sp !== 'mas' && rnd() < dt * 0.6) { takeOff(pg, null); continue; }
        pg.t -= dt;
        if (pg.act === 'walk') {
          const dx = pg.tx - pg.x, dy = pg.ty - pg.y, d = Math.hypot(dx, dy);
          if (d < 0.5) { pg.act = 'stand'; pg.t = rr(0.3, 1.2); }
          else {
            const s = Math.min(d, SP.spd * dt), nx = pg.x + dx / d * s, ny = pg.y + dy / d * s;
            if (walk(nx, ny)) { pg.x = nx; pg.y = ny; } else { pg.act = 'stand'; }
            if (Math.abs(dx) > 1) pg.dir = dx < 0 ? -1 : 1;
          }
        } else if (pg.act === 'hop') {
          // småfåglarna hoppar: små skutt med fötterna ihop
          pg.hop += dt * 5;
          const u = Math.min(1, pg.hop), nx = pg.hx0 + (pg.tx - pg.hx0) * u, ny = pg.hy0 + (pg.ty - pg.hy0) * u;
          if (walk(nx, ny)) { pg.x = nx; pg.y = ny; }
          if (u >= 1) { pg.act = rnd() < 0.5 ? 'hop' : 'stand'; pg.t = rr(0.2, 0.9); if (pg.act === 'hop') startHop(pg); }
        }
        if (pg.t <= 0 && pg.act !== 'hop') {
          const r = rnd();
          if (r < 0.45) { pg.act = 'peck'; pg.t = rr(0.8, 2.2); }
          else if (r < 0.8) {
            if (pg.sp === 'sparv') { pg.act = 'hop'; startHop(pg); }
            else {
              pg.act = 'walk'; pg.t = 3;
              const s = pg.spot || [pg.x, pg.y];
              pg.tx = clamp(pg.x + rr(-12, 12), s[0] - 18, s[0] + 18); pg.ty = clamp(pg.y + rr(-4, 4), s[1] - 7, s[1] + 7);
            }
          } else { pg.act = 'stand'; pg.t = rr(0.4, 1.6); if (rnd() < 0.5) pg.dir = -pg.dir; }
        }
      } else if (pg.st === 'f') {
        const f = pg.fl;
        f.u += dt / f.T;
        const u = Math.min(1, f.u);
        pg.x = f.x0 + (f.x1 - f.x0) * u; pg.y = f.y0 + (f.y1 - f.y0) * u;
        pg.alt = Math.max(0, f.a0 + (f.a1 - f.a0) * u + f.h * Math.sin(Math.PI * u));
        if (u >= 1) {
          if (pg.hideAfter) { pg.hideAfter = false; pg.st = 'h'; pg.alt = 0; pg.t = rr(3, 10); }
          else if (f.away) { pg.st = 'a'; pg.t = rr(8, 40); }
          else { pg.st = 'g'; pg.alt = 0; pg.act = 'stand'; pg.t = rr(0.4, 1.2); }
        }
      } else if (pg.st === 'h') {
        // gömd i busken: kika ut igen när ingen är nära (och det är ljust)
        pg.t -= dt;
        if (pg.t <= 0) {
          if (dark || threatsNear(pg.x, pg.y, SP.flee + 6)) { pg.t = rr(2, 6); continue; }
          const [x, y] = landSpot(pg.spot, 10);
          pg.st = 'g'; pg.act = 'hop'; pg.hx0 = pg.x; pg.hy0 = pg.y; pg.tx = x; pg.ty = y; pg.hop = 0; pg.t = 0.5;
        }
      } else {
        // borta (på taken): kom tillbaka efter en stund om det är ljust
        pg.t -= dt;
        if (pg.t <= 0) {
          if (env.dark > 0.2 && pg.sp !== 'mas') { pg.t = rr(10, 30); continue; }
          const near = SP.spots.filter((s) => Math.abs(s[0] - cx) < 700);
          const s = pick(near.length ? near : SP.spots);
          if (!s) { pg.t = rr(10, 30); continue; }
          const [x, y] = landSpot(s), side = pick([-1, 1]);
          pg.spot = s; pg.x = x + side * rr(160, 240); pg.y = y - rr(20, 60); pg.alt = rr(60, 90);
          flight(pg, x, y, 0);
        }
      }
    }
  }
  function startHop(pg) {
    const s = pg.spot || [pg.x, pg.y];
    pg.hx0 = pg.x; pg.hy0 = pg.y; pg.hop = 0;
    pg.tx = clamp(pg.x + rr(-6, 6), s[0] - 14, s[0] + 14); pg.ty = clamp(pg.y + rr(-2, 2), s[1] - 5, s[1] + 5);
    if (Math.abs(pg.tx - pg.x) > 1) pg.dir = pg.tx < pg.x ? -1 : 1;
  }
  function birdGItem(pg) {
    const SP = SPEC[pg.sp], set = SP.sets()[pg.v] || SP.sets()[0];
    if (pg.st === 'g') {
      let fr = 'stand', lift = 0;
      if (pg.act === 'peck') fr = Math.sin(pg.anim * (pg.sp === 'sparv' ? 14 : 9)) > 0.1 ? 'peck' : 'stand';
      else if (pg.act === 'walk') fr = Math.floor(pg.anim * 7) % 2 ? 'walk' : 'stand';
      else if (pg.act === 'hop') { fr = 'hop'; lift = Math.round(Math.sin(Math.min(1, pg.hop) * Math.PI) * 2); }
      const sp = set[fr] || set.stand, img = pg.dir < 0 ? sp.l : sp.r;
      const x = Math.round(pg.x), y = Math.round(pg.y);
      return { x, y: pg.y, draw: (ctx) => ctx.drawImage(img, x - (img.width >> 1), y - img.height + 1 - lift) };
    }
    const f = pg.fl, u = f ? f.u : 0;
    let fr;
    if (f && !f.away && u > 0.82) fr = 'up';
    else fr = ['up', 'mid', 'down', 'mid'][Math.floor(pg.anim * (pg.sp === 'sparv' ? 22 : pg.sp === 'mas' ? 8 : u < 0.2 ? 18 : 12)) % 4];
    const sp = set[fr], img = pg.dir < 0 ? sp.l : sp.r;
    const x = Math.round(pg.x), y = Math.round(pg.y), a = Math.round(pg.alt);
    return { x, y: a > 10 ? 1e5 + pg.y : pg.y, draw: (ctx) => {
      if (a < 40) { ctx.fillStyle = 'rgba(20,12,30,.18)'; ctx.fillRect(x - 2, y - 1, 5, 1); }
      ctx.drawImage(img, x - (img.width >> 1), y - a - (img.height >> 1));
    } };
  }

  // ------------------------------------------------------------------
  //  Förbiflygande fåglar och flockar
  // ------------------------------------------------------------------
  let birds = [], birdT = rr(2, 6);
  function updBirds(dt) {
    birdT -= dt;
    const w = W();
    if (birdT <= 0) {
      birdT = rr(6, 16);
      if (env.dark < 0.4 && w.kind !== 'dimma') {
        const dir = pick([-1, 1]), x = dir > 0 ? cam.x - 16 : cam.x + VW + 16, y = cam.y + rr(12, 96);
        const migr = (w.season === 'vår' || w.season === 'höst');
        const kind = wpick([['sw', w.season === 'sommar' ? 3 : 0.6], ['gull', env.rain ? 0.4 : 1.2], ['crow', 1], ['star', w.season === 'vinter' ? 0.4 : 1.4], ['goose', migr ? 1 : 0.05]]);
        const n = kind === 'sw' ? ri(2, 4) : kind === 'star' ? ri(9, 16) : kind === 'goose' ? ri(5, 9) : 1;
        for (let i = 0; i < n; i++) {
          let ox = -dir * i * rr(10, 18), oy = rr(-8, 8);
          if (kind === 'star') { ox = -dir * rr(0, 40); oy = rr(-12, 12); }
          // plogen: två skänklar bakåt från den första gåsen
          if (kind === 'goose') { const k = (i + 1) >> 1, side = i % 2 ? 1 : -1; ox = -dir * k * 13; oy = side * k * 6; }
          birds.push({
            k: kind, x: x + ox, y: y + oy, y0: 0, dir,
            vx: dir * (kind === 'sw' ? rr(105, 140) : kind === 'gull' ? rr(38, 50) : kind === 'star' ? rr(66, 74) : kind === 'goose' ? 44 : rr(52, 66)),
            ph: rnd() * 10, t: 0, wob: rr(0.6, 1.4),
          });
        }
      }
    }
    for (const b of birds) {
      b.t += dt;
      b.x += b.vx * dt;
      if (b.k === 'star') { b.x += Math.sin(b.t * 2.3 * b.wob + b.ph) * dt * 18; b.y0 = Math.sin(b.t * 1.7 + b.ph) * 7; }
      else b.y0 = b.k === 'sw' ? Math.sin(b.t * 2.6 + b.ph) * 5 : b.k === 'goose' ? Math.sin(b.t * 0.7) * 1.5 : Math.sin(b.t * 0.9 + b.ph) * 2;
    }
    birds = birds.filter((b) => (b.dir > 0 ? b.x < cam.x + VW + 60 : b.x > cam.x - 60) && Math.abs(b.x - camCX()) < 700);
  }
  function birdItem(b) {
    const fr = S.bird[b.k];
    let i;
    if (b.k === 'gull') i = Math.sin(b.t * 1.2 + b.ph) > 0.2 ? 1 : [0, 1, 2, 1][Math.floor(b.t * 5) % 4];
    else i = [0, 1, 2, 1][Math.floor(b.t * (b.k === 'sw' ? 14 : b.k === 'star' ? 16 : b.k === 'goose' ? 4 : 7) + b.ph) % 4];
    const img = fr[i], x = Math.round(b.x), y = Math.round(b.y + b.y0);
    return { x, y: 2e5 + y, draw: (ctx) => ctx.drawImage(img, x - (img.width >> 1), y - (img.height >> 1)) };
  }

  // ------------------------------------------------------------------
  //  Ekorrar i träden
  // ------------------------------------------------------------------
  const squirrels = [];
  function seedSquirrels() {
    const park = trees.filter((t) => t.y > CITY.PARK[0] && t.y < (CITY.FOOT_TOP_S || 494) + 150 && t.kind !== 'gran');
    const pool = park.length >= 3 ? park : trees;
    for (let i = 0; i < Math.min(5, pool.length); i++) {
      const t = pool[Math.floor((i + 0.5) * pool.length / Math.min(5, pool.length))];
      squirrels.push({ tree: t, x: t.x + 1, y: t.y + 1, alt: t.h, st: 'u', t: rr(1, 12), dir: 1, anim: 0, tx: 0, ty: 0, next: null, act: 'sit' });
    }
  }
  const treeNear = (x, y, r, not) => trees.filter((t) => t !== not && Math.abs(t.x - x) < r && Math.abs(t.y - y) < r * 0.6);
  function updSquirrels(dt) {
    const w = W();
    for (const q of squirrels) {
      if (Math.abs(q.x - camCX()) > 560) continue;
      q.anim += dt; q.t -= dt;
      const th = q.st === 'g' ? threatsNear(q.x, q.y, 30) : null;
      if (q.st === 'u') {
        // uppe i kronan (syns inte): kom ner när det är lugnt, ljust och inte ösregnar
        if (q.t <= 0) {
          if (env.dark > 0.3 || (w.kind === 'regn' && (w.intensity ?? 0.6) > 0.6) || threatsNear(q.tree.x, q.tree.y, 34)) { q.t = rr(4, 12); continue; }
          q.st = 'down'; q.alt = q.tree.h; q.x = q.tree.x + 1; q.y = q.tree.y + 1;
        }
      } else if (q.st === 'down' || q.st === 'up') {
        const sp = q.st === 'up' ? (q.flee ? 55 : 30) : 22;
        q.alt += (q.st === 'up' ? sp : -sp) * dt;
        if (q.st === 'down' && q.alt <= 0) { q.alt = 0; q.st = 'g'; q.act = 'sit'; q.t = rr(1.5, 4); q.dir = pick([-1, 1]); }
        if (q.st === 'up' && q.alt >= q.tree.h) { q.st = 'u'; q.flee = false; q.t = rr(4, 16); }
      } else if (q.st === 'g') {
        if (th) { // någon kommer: spring till närmaste träd och upp
          q.flee = true;
          const t = [q.tree, ...treeNear(q.x, q.y, 60)].sort((a, b) => Math.hypot(a.x - q.x, a.y - q.y) - Math.hypot(b.x - q.x, b.y - q.y))[0];
          q.next = t; q.act = 'run'; q.tx = t.x + 1; q.ty = t.y + 1;
        }
        if (q.act === 'run') {
          const dx = q.tx - q.x, dy = q.ty - q.y, d = Math.hypot(dx, dy), s = Math.min(d, (q.flee ? 62 : 44) * dt);
          if (d > 0.5) { q.x += dx / d * s; q.y += dy / d * s; if (Math.abs(dx) > 1) q.dir = dx < 0 ? -1 : 1; }
          else if (q.next) { q.tree = q.next; q.next = null; q.st = 'up'; q.alt = 0; }
          else { q.act = 'sit'; q.t = rr(1, 3); }
        } else if (q.t <= 0) {
          const r = rnd();
          if (r < 0.3) { q.act = 'gnaw'; q.t = rr(2, 5); }
          else if (r < 0.55) { q.act = 'run'; q.next = null; const a = rnd() * 6.28; q.tx = q.tree.x + Math.cos(a) * rr(8, 22); q.ty = q.tree.y + Math.sin(a) * rr(3, 9); if (!walk(q.tx, q.ty)) { q.tx = q.tree.x + 6; q.ty = q.tree.y + 3; } }
          else if (r < 0.8) { const o = treeNear(q.x, q.y, 110, q.tree); if (o.length) { q.next = pick(o); q.act = 'run'; q.tx = q.next.x + 1; q.ty = q.next.y + 1; } else { q.act = 'sit'; q.t = rr(1, 3); } }
          else { q.act = 'run'; q.next = q.tree; q.tx = q.tree.x + 1; q.ty = q.tree.y + 1; }
          if (q.act === 'sit' || q.act === 'gnaw') q.dir = rnd() < 0.3 ? -q.dir : q.dir;
        }
      }
    }
  }
  function squirrelItem(q) {
    if (q.st === 'u') return null;
    const x = Math.round(q.x), y = Math.round(q.y);
    if (q.st === 'up' || q.st === 'down') {
      const spr = q.st === 'up' ? S.sq.climb : S.sq.down, img = spr.r, a = Math.round(q.alt);
      // på stammen: ritas precis framför trädet
      return { x, y: q.tree.y + 0.4, draw: (ctx) => ctx.drawImage(img, x - 3, y - a - img.height + 2) };
    }
    const run = q.act === 'run', k = run ? (Math.floor(q.anim * 12) % 2 ? 'run1' : 'run2') : q.act === 'gnaw' ? 'gnaw' : 'sit';
    const spr = S.sq[k], img = q.dir < 0 ? spr.l : spr.r;
    return { x, y: q.y, draw: (ctx) => {
      ctx.fillStyle = 'rgba(20,12,30,.2)'; ctx.fillRect(x - 3, y - 1, 7, 1);
      ctx.drawImage(img, x - (img.width >> 1), y - img.height + 1 - (run && Math.floor(q.anim * 12) % 2 ? 1 : 0));
    } };
  }

  // ------------------------------------------------------------------
  //  Änder i dammen och svanar i kanalen
  // ------------------------------------------------------------------
  const pond = PARK.pond;
  const ducks = [];
  if (pond) for (let i = 0; i < 4; i++) ducks.push({ v: i === 1 || i === 3 ? 1 : 0, x: pond.cx + rr(-pond.rx * 0.5, pond.rx * 0.5), y: pond.cy + rr(-pond.ry * 0.4, pond.ry * 0.4), tx: pond.cx, ty: pond.cy, dir: pick([-1, 1]), t: rr(1, 5), dab: 0, ph: rnd() * 6 });
  const swans = [];
  if (CITY.CANAL) for (let i = 0; i < 3; i++) swans.push({ x: rr(LX + 200, CW - 200), y: CITY.CANAL[0] + 12 + i * 3, dir: pick([-1, 1]), v: rr(4, 7), ph: rnd() * 6 });
  const frozen = () => { const w = W(); return (w.snowCover || 0) > 0.45 || (w.season === 'vinter' && (w.temp ?? 0) < -1); };
  // (v3) i floden mellan Stora bron och Järnbron: ett svanpar och några gräsänder som driver
  // sakta med strömmen och simmar tillbaka. Samma isregel som vädret (då är floden blankis).
  const RW = RIV && RIV.water[1] ? RIV.water[1] : null;
  const riverIce = () => { const w = W(); return (w.season === 'vinter' && (w.temp ?? 15) <= 0) || (w.snowCover || 0) > 0.25; };
  const riverBirds = [];
  if (RW) {
    const rx = (m) => rr(RW[0] + m, RW[2] - m), ry = (m) => rr(RW[1] + m, RW[3] - m);
    const sx = rx(60), sy = ry(40);
    riverBirds.push({ swan: true, x: sx, y: sy, tx: sx, ty: sy, dir: 1, t: rr(2, 6), ph: rnd() * 6 }, { swan: true, x: sx + 14, y: sy + 3, tx: sx, ty: sy, dir: 1, t: rr(2, 6), ph: rnd() * 6, follow: 0 });
    for (let i = 0; i < 3; i++) { const x = rx(30), y = ry(20); riverBirds.push({ v: i % 2, x, y, tx: x, ty: y, dir: pick([-1, 1]), t: rr(1, 5), dab: 0, ph: rnd() * 6 }); }
  }
  function updRiver(dt) {
    if (!RW || riverIce()) return;
    for (const d of riverBirds) {
      if (Math.abs(d.x - camCX()) > 600) continue;
      d.t -= dt;
      if (d.dab > 0) { d.dab -= dt; continue; }
      if (d.follow !== undefined) { const L = riverBirds[d.follow]; d.tx = L.x - L.dir * 13; d.ty = L.y + 2; }
      const dx = d.tx - d.x, dy = d.ty - d.y, dd = Math.hypot(dx, dy), sp = d.swan ? 4 : 6;
      if (dd > 0.4) { d.x += dx / dd * Math.min(dd, sp * dt); d.y += dy / dd * Math.min(dd, sp * dt); if (Math.abs(dx) > 1.5) d.dir = dx < 0 ? -1 : 1; }
      d.y += 0.6 * dt;                                         // strömmen för söderut mot kanalen
      d.x = clamp(d.x, RW[0] + 8, RW[2] - 8); d.y = clamp(d.y, RW[1] + 16, RW[3] - 8);
      if (d.t <= 0 && d.follow === undefined) {
        d.t = rr(3, 9);
        if (!d.swan && rnd() < 0.3) d.dab = rr(1, 2.4);
        else { d.tx = clamp(d.x + rr(-70, 70), RW[0] + 20, RW[2] - 20); d.ty = clamp(d.y + rr(-30, 18), RW[1] + 24, RW[3] - 14); }
      }
    }
  }
  function riverItems(out) {
    if (!RW || riverIce()) return;
    const t = env.t;
    for (const d of riverBirds) {
      if (!visible(d.x, d.y, 24)) continue;
      const x = Math.round(d.x), y = Math.round(d.y), bob = Math.sin(t * (d.swan ? 1.4 : 2.2) + d.ph) > 0.65 ? 1 : 0;
      const moving = Math.hypot(d.tx - d.x, d.ty - d.y) > 0.5 && !(d.dab > 0);
      if (d.swan) {
        const img = d.dir < 0 ? S.swan.l : S.swan.r;
        out.push({ x, y: d.y, draw: (ctx) => {
          ctx.drawImage(img, x - (img.width >> 1), y - img.height + 3 + bob);
          ctx.fillStyle = 'rgba(210,236,250,.5)'; ctx.fillRect(x - 6, y + 2, 12, 1);
          if (moving) { ctx.fillStyle = 'rgba(230,246,255,.35)'; ctx.fillRect(x - d.dir * 10, y + 1, 3, 1); ctx.fillRect(x - d.dir * 14, y, 3, 1); ctx.fillRect(x - d.dir * 14, y + 3, 3, 1); }
        } });
      } else {
        const set = S.duck[d.v], spr = d.dab > 0 ? set.dab : set.swim, img = d.dir < 0 ? spr.l : spr.r;
        out.push({ x, y: d.y, draw: (ctx) => {
          ctx.drawImage(img, x - (img.width >> 1), y - img.height + 2 + bob);
          ctx.fillStyle = 'rgba(210,236,250,.55)'; ctx.fillRect(x - 5, y + 1, 10, 1);
          if (moving) { ctx.fillStyle = 'rgba(230,246,255,.4)'; ctx.fillRect(x - d.dir * 8, y, 2, 1); ctx.fillRect(x - d.dir * 11, y - 1, 2, 1); ctx.fillRect(x - d.dir * 11, y + 1, 2, 1); }
        } });
      }
    }
  }
  function updWater(dt) {
    updRiver(dt);
    if (frozen()) return;
    for (const d of ducks) {
      d.t -= dt;
      if (d.dab > 0) { d.dab -= dt; continue; }
      const dx = d.tx - d.x, dy = d.ty - d.y, dd = Math.hypot(dx, dy);
      if (dd > 0.4) { d.x += dx / dd * Math.min(dd, 5 * dt); d.y += dy / dd * Math.min(dd, 5 * dt); if (Math.abs(dx) > 1.5) d.dir = dx < 0 ? -1 : 1; }
      if (d.t <= 0) {
        d.t = rr(2, 7);
        if (rnd() < 0.3) d.dab = rr(1, 2.4);
        else {
          const a = rnd() * 6.28, r = Math.sqrt(rnd()) * 0.62;
          d.tx = pond.cx + Math.cos(a) * pond.rx * r; d.ty = pond.cy + Math.sin(a) * pond.ry * r * 0.8;
          // änderna följer gärna efter varandra
          if (rnd() < 0.3) { const o = pick(ducks); if (o !== d) { d.tx = o.x - o.dir * 9; d.ty = o.y + 1; } }
        }
      }
    }
    for (const s of swans) {
      s.x += s.dir * s.v * dt;
      if (s.x < LX + 20 || s.x > CW - 20) s.dir = -s.dir;
      if (rnd() < dt * 0.02) s.dir = -s.dir;
    }
  }
  function waterItems(out) {
    riverItems(out);
    if (frozen()) return;
    const t = env.t;
    for (const d of ducks) {
      if (!visible(d.x, d.y, 20)) continue;
      const set = S.duck[d.v], spr = d.dab > 0 ? set.dab : set.swim, img = d.dir < 0 ? spr.l : spr.r;
      const x = Math.round(d.x), y = Math.round(d.y), bob = Math.sin(t * 2.2 + d.ph) > 0.6 ? 1 : 0;
      out.push({ x, y: d.y, draw: (ctx) => {
        ctx.drawImage(img, x - (img.width >> 1), y - img.height + 2 + bob);
        // vattenlinjen och ett litet kölvatten
        ctx.fillStyle = 'rgba(210,236,250,.55)'; ctx.fillRect(x - 5, y + 1, 10, 1);
        const moving = Math.hypot(d.tx - d.x, d.ty - d.y) > 0.5 && d.dab <= 0;
        if (moving) { ctx.fillStyle = 'rgba(230,246,255,.4)'; ctx.fillRect(x - d.dir * 8, y, 2, 1); ctx.fillRect(x - d.dir * 11, y - 1, 2, 1); ctx.fillRect(x - d.dir * 11, y + 1, 2, 1); }
      } });
    }
    for (const s of swans) {
      if (!visible(s.x, s.y, 20)) continue;
      const img = s.dir < 0 ? S.swan.l : S.swan.r, x = Math.round(s.x), y = Math.round(s.y), bob = Math.sin(t * 1.4 + s.ph) > 0.7 ? 1 : 0;
      out.push({ x, y: s.y, draw: (ctx) => {
        ctx.drawImage(img, x - (img.width >> 1), y - img.height + 3 + bob);
        ctx.fillStyle = 'rgba(210,236,250,.5)'; ctx.fillRect(x - 6, y + 2, 12, 1);
        ctx.fillStyle = 'rgba(230,246,255,.35)'; ctx.fillRect(x - s.dir * 10, y + 1, 3, 1); ctx.fillRect(x - s.dir * 14, y, 3, 1); ctx.fillRect(x - s.dir * 14, y + 3, 3, 1);
      } });
    }
  }

  // ------------------------------------------------------------------
  //  Fjärilar vid rabatterna i parken
  // ------------------------------------------------------------------
  // Rabatterna hittas bland rekvisitans hinder i parken (låga, breda rutor);
  // saknas de flyger fjärilarna vid kanterna av gångarna i stället.
  let BF_HOMES = (env.obstacles || [])
    .filter((o) => o && o[1] > CITY.PARK[0] && o[3] < (CITY.BACK_S || [462])[0] && o[0] < XI[0] && o[2] - o[0] >= 28 && o[3] - o[1] >= 7 && o[3] - o[1] <= 14)
    .map((o) => [(o[0] + o[2]) / 2, o[3] - 1, (o[2] - o[0]) / 2]);
  if (BF_HOMES.length < 3) {
    BF_HOMES = [];
    for (const r of PARK.paths || []) BF_HOMES.push([r[0] - 9, 318, 10], [r[2] + 9, 324, 10]);
    for (let x = 90; x < XI[0] - 60; x += 130) BF_HOMES.push([x, (x / 130) % 2 < 1 ? 328 : 354, 12]);
  }
  if (PARK.meadow) { const m = PARK.meadow; for (let i = 0; i < 4; i++) BF_HOMES.push([m[0] + 20 + i * (m[2] - m[0] - 40) / 3, m[1] + 20 + (i % 2) * 40, 16]); }
  const butterflies = [];
  for (let i = 0; i < 20; i++) {
    const h = BF_HOMES[i % BF_HOMES.length];
    butterflies.push({ hx: h[0], hy: h[1], hw: h[2], x: h[0], y: h[1], alt: rr(4, 12), tx: h[0], ty: h[1], ta: 8, c: ri(0, BF_COLORS.length - 1), ph: rnd() * 10, t: 0 });
  }
  const bfActive = () => { const w = W(); return env.dark === 0 && !env.rain && env.hour >= 8 && env.hour < 19.5 && (w.season === 'vår' || w.season === 'sommar' || (w.temp ?? 15) >= 14) && w.kind !== 'snö' && (w.temp ?? 15) >= 10; };
  function updButterflies(dt) {
    if (!bfActive()) return;
    for (const f of butterflies) {
      if (Math.abs(f.x - camCX()) > 500) continue;
      f.t += dt;
      const dx = f.tx - f.x, dy = f.ty - f.y, d = Math.hypot(dx, dy);
      let sp = 14;
      const th = threatsNear(f.x, f.y, 14);
      if (th) { sp = 30; f.tx = f.x + Math.sign(f.x - th.x || 1) * 20; f.ty = f.y + rr(-6, 6); f.ta = rr(12, 20); }
      if (d < 1.5) {
        if (rnd() < 0.05) { const h = pick(BF_HOMES.filter((q) => Math.abs(q[0] - f.hx) < 220 && Math.abs(q[1] - f.hy) < 120)); if (h) { f.hx = h[0]; f.hy = h[1]; f.hw = h[2]; } }
        f.tx = f.hx + rr(-f.hw, f.hw); f.ty = f.hy + rr(-3, 3); f.ta = rr(4, 14);
      } else {
        const s = Math.min(d, sp * dt);
        f.x += dx / d * s + Math.sin(f.t * 7 + f.ph) * dt * 6; f.y += dy / d * s;
      }
      f.alt += (f.ta - f.alt) * Math.min(1, dt * 2) + Math.sin(f.t * 9 + f.ph) * dt * 8;
    }
  }
  function bfItem(f) {
    const set = S.bf[f.c], w = Math.sin(f.t * 24 + f.ph);
    const img = w > 0.3 ? set.open : w > -0.4 ? set.half : set.shut;
    const x = Math.round(f.x), y = Math.round(f.y), a = Math.round(Math.max(1, f.alt));
    return { x, y: f.y + 2, draw: (ctx) => ctx.drawImage(img, x - (img.width >> 1), y - a - 1) };
  }

  // ------------------------------------------------------------------
  //  Katterna: på trappan vid Pixelgatan 1, i radhusträdgården och vid det övergivna huset
  // ------------------------------------------------------------------
  const cats = [];
  {
    const home = byId('hem') || BUILDINGS[0];
    // trappstenen vid porten går ~5 px utanför dörren – katten ligger på dess högra ände
    if (home) cats.push({ x: home.door.x1 + 3, y: baseOf(home) + 3, pal: 0, st: 'sleep', t: rr(4, 10), tail: 0, tailT: 0, dir: -1 });
    const rh = byId('radhus');
    if (rh) { const q = nav.nearest(Math.round(rh.door.x0 - 10), baseOf(rh) + 9, walk, 6); /* i gräset vänster om trappan – inte bakom häcken */ if (q) cats.push({ x: q[0], y: q[1], pal: 1, st: 'awake', t: rr(4, 10), tail: 0, tailT: 0, dir: 1 }); }
    const ov = byId('maskerad');   // den svarta katten sover vid maskeradbutikens dörr
    if (ov) { const q = nav.nearest(Math.round(ov.door.x0 - 10), baseOf(ov) + 4, walk, 6); if (q) cats.push({ x: q[0], y: q[1], pal: 2, st: 'sleep', t: rr(4, 10), tail: 0, tailT: 0, dir: 1, night: true }); }
  }
  const visibleCat = (c) => !(c.pal === 1 && env.rain); // grå katten går in när det regnar
  function updCat(dt) {
    for (const cat of cats) {
      if (Math.abs(cat.x - camCX()) > 500) continue;
      cat.t -= dt; cat.tailT -= dt;
      const near = (env.people || []).some((q) => Math.abs(q.x - cat.x) < 18 && Math.abs(q.y - cat.y) < 12)
        || peds.some((p) => p.dog && Math.abs(p.dog.x - cat.x) < 26 && Math.abs(p.dog.y - cat.y) < 16);
      if (near) { cat.st = 'sit'; cat.t = rr(2, 4); }
      else if (cat.t <= 0) {
        if (cat.st === 'sit') cat.st = 'awake';
        else cat.st = cat.st === 'sleep' ? 'awake' : (env.dark > 0.3 && !cat.night ? 'awake' : 'sleep');
        cat.t = cat.st === 'sleep' ? rr(8, 20) : rr(4, 10);
      }
      if (cat.tailT <= 0) { cat.tail = cat.st === 'sleep' ? 0 : ri(0, 2); cat.tailT = rr(0.3, 1.4); }
    }
  }
  function catItem(cat) {
    const set = S.cat[cat.pal];
    const spr = cat.st === 'sit' ? set.sit : cat.st === 'sleep' ? set.sleep : set.tails[cat.tail];
    const img = cat.dir < 0 ? spr.l : spr.r, x = Math.round(cat.x), y = Math.round(cat.y);
    return { x, y: cat.y, draw: (ctx) => {
      ctx.fillStyle = 'rgba(20,12,30,.22)'; ctx.fillRect(x - (img.width >> 1) + 2, y - 1, img.width - 4, 2);
      ctx.drawImage(img, x - (img.width >> 1), y - img.height + 1);
    } };
  }
  const catEyes = (cat) => {
    if (cat.st === 'sleep') return [];
    const set = S.cat[cat.pal], spr = cat.st === 'sit' ? set.sit : set.tails[0], x0 = Math.round(cat.x) - (spr.w >> 1), y0 = Math.round(cat.y) - spr.h + 1;
    // ögonen ('g') i kartan + 1 px kontur
    const rows = cat.st === 'sit' ? CAT_MAPS.sit : CAT_MAPS.awake, out = [];
    rows.forEach((r, j) => { for (let i = 0; i < r.length; i++) if (r[i] === 'g') out.push([cat.dir < 0 ? x0 + spr.w - 2 - i : x0 + 1 + i, y0 + 1 + j]); });
    return out;
  };

  // ------------------------------------------------------------------
  //  Snögubbar på gräset när snön ligger
  // ------------------------------------------------------------------
  const snowmen = [];
  {
    const areas = [[560, 372, 880, 452], [1236, 360, 1460, 452], [1480, 372, 1668, 452], [150, 424, 380, 456], [20, 620, 146, 638], [2040 + SDX, 350, 2160 + SDX, 440], [2450 + SDX, 334, 2690 + SDX, 444], [2200 + SDX, 316, 2400 + SDX, 404]];
    const clear = (x, y) => { for (let dy = -6; dy <= 1; dy += 2) for (let dx = -8; dx <= 8; dx += 2) if (!walk(x + dx, y + dy)) return false; return !paved(x, y) || y > 600; };
    areas.forEach((r, i) => {
      for (let k = 0; k < 24; k++) {
        const x = Math.round(r[0] + hash(i, k, 301) * (r[2] - r[0])), y = Math.round(r[1] + hash(i, k, 302) * (r[3] - r[1]));
        if (!clear(x, y) || snowmen.some((s) => Math.hypot(s.x - x, s.y - y) < 40)) continue;
        snowmen.push({ x, y, v: (i + k) % 4, dir: hash(i, k, 303) < 0.5 ? 1 : -1, day: i });
        break;
      }
    });
  }
  function snowmanItems(out) {
    const w = W();
    if ((w.snowCover || 0) < 0.35) return;
    for (const s of snowmen) {
      if (!visible(s.x, s.y, 30)) continue;
      // inte alla varje dag: vilka som byggts beror på dagen
      if (hash(env.day | 0, s.day, 17) < 0.3) continue;
      const img = s.dir < 0 ? S.snowman[s.v].l : S.snowman[s.v].r, x = Math.round(s.x), y = Math.round(s.y);
      out.push({ x, y: s.y, draw: (ctx) => ctx.drawImage(img, x - 12, y - 30) });
    }
  }

  // ------------------------------------------------------------------
  //  Eldflugor över gräset en mörk sommarkväll (ritas i glow)
  // ------------------------------------------------------------------
  const flies = [];
  function updFlies(dt) {
    const w = W();
    const on = env.dark > 0.3 && !env.rain && (w.season === 'sommar' || (w.temp ?? 15) >= 14) && w.kind !== 'snö';
    const top = Math.max(CITY.PARK[0] + 4, cam.y), bot = Math.min((CITY.BACK_S || [CH])[0] - 2, cam.y + VH);
    if (!on || bot - top < 8) { flies.length = 0; return; }
    while (flies.length < 16) flies.push({ x: cam.x + rr(0, VW), y: rr(top, bot), vx: rr(-4, 4), vy: rr(-2, 2), ph: rnd() * 10 });
    for (const f of flies) {
      f.vx += rr(-6, 6) * dt; f.vy += rr(-4, 4) * dt;
      f.vx = clamp(f.vx, -6, 6); f.vy = clamp(f.vy, -3, 3);
      f.x += f.vx * dt; f.y += f.vy * dt;
      if (f.x < cam.x - 10 || f.x > cam.x + VW + 10 || f.y < top || f.y > bot || paved(f.x, f.y)) {
        f.x = cam.x + rr(0, VW); f.y = rr(top, bot); if (paved(f.x, f.y)) f.y = rr(top, bot);
      }
    }
  }

  // ------------------------------------------------------------------
  //  Ritning av en fotgängare (med paraply, kasse, hund i koppel …)
  // ------------------------------------------------------------------
  function handPos(p, X, Y, dir, frame) {
    const K = !!p.look.kid, tw = K ? 4 : (p.look.build || 5);
    const bob = frame === 3 || frame === 4 ? -1 : 0, torso = K ? 25 : 18, arm = K ? 5 : 8;
    if (dir === 'down' || dir === 'up') {
      const sw = frame === 1 ? 1 : frame === 2 ? -1 : 0;
      return { x: X + tw, y: Y - 39 + torso + bob + arm - sw, side: 1 };
    }
    const a = frame === 1 ? -3 : frame === 2 ? 3 : 0;
    return { x: dir === 'right' ? X + a : X - 1 - a, y: Y - 39 + torso + bob + arm, side: dir === 'right' ? 1 : -1 };
  }
  function drawLeash(ctx, x0, y0, x1, y1) {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    const sag = Math.min(4, n / 5);
    ctx.fillStyle = '#6a2a2a';
    let lx = null, ly = null;
    for (let i = 0; i <= n; i++) {
      const t = i / n, x = Math.round(x0 + (x1 - x0) * t), y = Math.round(y0 + (y1 - y0) * t + sag * 4 * t * (1 - t));
      if (x === lx && y === ly) continue;
      ctx.fillRect(x, y, 1, 1); lx = x; ly = y;
    }
  }
  function underRoof(p) { return !!(p.sit && p.sit.kind === 'busskur') || !!(p.spot && p.spot.roof); }
  // ---------- telefonen mot örat (v3, mest kostymfolket i downtown) ----------
  function updCall(p, dt) {
    if (p.call > 0) { p.call -= dt; if (p.call <= 0) p.callT = rr(8, 26); return; }
    p.callT -= dt;
    if (p.callT <= 0) {
      if (!p.carry && !p.sit && !p.door && !p.comp && !p.leader && !p.hang && !(p.photo > 0) && !p.look.kid) p.call = rr(5, 16);
      else p.callT = rr(3, 8);
    }
  }
  const onCall = (p, frame) => p.call > 0 && !p.sit && !p.look.kid && frame <= 2 && !p.carry && !(p.photo > 0);
  // kroppen: vanliga figuren – eller, i telefon, samma figur med armen uppe och mobilen vid örat
  function drawBody(ctx, p, X, Y, dir, frame) {
    if (!onCall(p, frame)) { drawPerson(ctx, X, Y, p.look, dir, frame); return; }
    const img = callSprite(p.look, dir, frame, p.suit);
    if (!img) { drawPerson(ctx, X, Y, p.look, dir, frame); return; }
    ctx.fillStyle = 'rgba(20,12,30,.28)';                 // skuggan (samma som drawPerson)
    ctx.fillRect(X - 5, Y - 1, 10, 2); ctx.fillRect(X - 4, Y + 1, 8, 1);
    ctx.drawImage(img, X - 12, Y - 39);
  }
  function drawPed(ctx, p) {
    const X = Math.round(p.x + p.ox);
    let Y = Math.round(p.y + p.oy);
    const dir = p.showDir || 'down';
    const box = BOXES.has(p.carry);
    let frame;
    if (p.sit) frame = p.carry === 'glass' || p.carry === 'burgare' || (p.carry === 'kaffe' && Math.sin(env.t * 0.9 + p.seed) > 0.4) ? 6 : 5;
    else if (p.showMove) frame = box ? [7, 9, 8, 9][Math.floor(p.anim) % 4] : WALK_SEQ[Math.floor(p.anim) % 4];
    else if (p.jump) { const ph = (env.t * 3.2 + p.seed) % 1; frame = ph < 0.45 ? 3 : 0; if (ph < 0.45) Y -= 2; }
    else if (p.hang && p.gest > 0) frame = Math.floor(env.t * 6 + p.seed) % 2 ? 3 : 4;
    else frame = box ? 9 : Math.sin(env.t * 1.3 + p.seed) > 0.93 ? 4 : 0;
    const door = p.door || (p.leader && p.leader.door);
    // klipp bara den som faktiskt står i dörröppningen (inte sällskapet bredvid)
    const dbase = door ? door.base : BASE;
    const clip = door && Y < dbase + 5 && X > door.b.door.x0 - 8 && X < door.b.door.x1 + 8;
    const alpha = door ? doorAlpha(p.leader || p, Y) : 1;
    if (clip) {
      const b = door.b, dh = doorH(b);
      ctx.save();
      ctx.beginPath();
      ctx.rect(b.door.x0, dbase - dh, b.door.x1 - b.door.x0, dh); // dörröppningen
      ctx.rect(X - 20, dbase, 40, 60);
      ctx.clip();
    }
    if (alpha < 1) ctx.globalAlpha = alpha;
    const rain = env.rain && p.umb && !underRoof(p);
    const kidH = p.look.kid ? 8 : 0;
    const h = handPos(p, X, Y, dir, frame);
    const side = dir === 'left' || dir === 'right';
    // bakom kroppen: paraplyets skaft, släpande resväska, kartong bakifrån, kassen på marken bredvid den som sitter
    if (rain) { ctx.fillStyle = '#2a2630'; ctx.fillRect(X + (side ? (dir === 'right' ? 2 : -2) : 1), Y - 35 + kidH + (p.sit ? 1 : 0), 1, 16); }
    if (p.sit && p.carry && p.carry !== 'glass' && p.carry !== 'burgare' && p.carry !== 'kaffe') {
      const spr = p.carry === 'pase' ? S.pase[p.carryCol] : p.carry === 'resvaska' ? S.case[p.caseCol] : S.carry[p.carry];
      if (spr) ctx.drawImage(spr.r, X + 7, Y - spr.h + 2);
    }
    if (!p.sit && p.carry === 'resvaska' && side) drawCase(ctx, p, X, Y, dir, h);
    if (!p.sit && box && dir === 'up') drawCarry(ctx, p.carry, X - 7, Y - 27, 'r');
    drawBody(ctx, p, X, Y, dir, frame);
    // framför: kasse i handen, kartong, resväska bredvid, paraplyets duk, mobilen
    if (!p.sit && p.carry && !box && p.carry !== 'resvaska') {
      const spr = p.carry === 'pase' ? S.pase[p.carryCol] : S.carry[p.carry];
      if (spr) {
        const img = h.side < 0 ? spr.l : spr.r, ax = h.side < 0 ? spr.w - 1 - spr.ax : spr.ax;
        ctx.drawImage(img, h.x - ax, h.y - spr.ay);
      }
    }
    if (!p.sit && box && dir !== 'up') {
      const bx = dir === 'right' ? X + 1 : dir === 'left' ? X - 16 : X - 8;
      drawCarry(ctx, p.carry, bx, Y - 26, 'r');
    }
    // (v3) mobilen upp för en bild: framifrån hålls den framför ansiktet, bakifrån syns den över axeln
    if (p.photo > 0 && !p.showMove && !p.sit) drawPhoto(ctx, p, X, Y, dir);
    if (!p.sit && p.carry === 'resvaska' && !side) drawCase(ctx, p, X, Y, dir, h);
    if (p.hang && p.phoneT > 0 && dir === 'down' && !p.showMove) {
      // mobilen lyser i handen
      ctx.fillStyle = '#1a1a20'; ctx.fillRect(X - 1, Y - 18, 3, 4);
      ctx.fillStyle = env.dark > 0.2 ? '#bfe4ff' : '#6a8ab0'; ctx.fillRect(X, Y - 17, 1, 2);
    }
    if (rain) {
      const u = S.umb[p.umb];
      const ux = X + (side ? (dir === 'right' ? 2 : -2) : 1) - 9;
      ctx.drawImage(u, ux, Y - 42 + kidH + (p.sit ? 2 : 0));
    }
    if (alpha < 1) ctx.globalAlpha = 1;
    if (clip) ctx.restore();
  }
  // mobilen som tar en bild (turister på bron och vid tjuren): framifrån håller man den framför bröstet
  // och tittar ner på skärmen, bakifrån syns skärmen (med utsikten) snett upp till höger om huvudet,
  // från sidan hålls den ut framför ansiktet. Blixten smäller av ibland.
  function drawPhoto(ctx, p, X, Y, dir) {
    const flash = Math.floor(env.t * 12 + p.seed * 7) % 34 === 0;
    const R = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); }, SK = p.look.skin || '#e0a97f';
    if (dir === 'up') {
      const x = X + 3, y = Y - 38;
      R(x, y, 6, 5, '#1a1a20'); R(x + 1, y + 1, 4, 3, env.dark > 0.3 ? '#27405e' : '#6aa8d8'); R(x + 1, y + 3, 4, 1, env.dark > 0.3 ? '#2a3a2e' : '#5a8a5a');
      R(x - 1, y + 3, 1, 2, SK); R(x + 6, y + 3, 1, 2, SK);
    } else if (dir === 'down') {
      R(X - 2, Y - 21, 4, 5, '#1a1a20'); R(X - 1, Y - 20, 1, 1, '#7a8290'); R(X - 3, Y - 18, 1, 2, SK); R(X + 2, Y - 18, 1, 2, SK);
      if (flash) { R(X - 1, Y - 23, 1, 1, '#ffffff'); R(X - 3, Y - 21, 1, 1, '#fff4c8'); R(X + 1, Y - 21, 1, 1, '#fff4c8'); }
    } else {
      const s = dir === 'right' ? 1 : -1, x = X + s * 6 - (s < 0 ? 2 : 0);
      R(x, Y - 32, 2, 5, '#1a1a20'); R(x + (s > 0 ? 1 : 0), Y - 31, 1, 3, env.dark > 0.3 ? '#9ad0f0' : '#6a8ab0'); R(x, Y - 27, 2, 1, SK);
      if (flash) { R(x + (s > 0 ? 2 : -1), Y - 31, 1, 1, '#ffffff'); }
    }
  }
  function drawCarry(ctx, k, x, y, side) {
    const spr = S.carry[k];
    ctx.drawImage(side === 'l' ? spr.l : spr.r, x, y);
  }
  function drawCase(ctx, p, X, Y, dir, h) {
    const spr = S.case[p.caseCol];
    let cx;
    if (dir === 'right') cx = X - 13;
    else if (dir === 'left') cx = X + 13;
    else cx = X + 11;
    const img = spr.r, x0 = cx - (spr.w >> 1), y0 = Y - spr.h + 1;
    // teleskophandtaget upp till handen
    ctx.fillStyle = '#3a3a42';
    const tx = cx, ty = y0 + 1, hx = h.x, hy = h.y;
    const n = Math.max(Math.abs(hx - tx), Math.abs(hy - ty), 1);
    for (let i = 0; i <= n; i++) ctx.fillRect(Math.round(tx + (hx - tx) * i / n), Math.round(ty + (hy - ty) * i / n), 1, 1);
    ctx.drawImage(img, x0, y0);
  }
  function drawDog(ctx, p) {
    const g = p.dog, fr = S.dog[g.br][g.fr], img = g.dir < 0 ? fr.l : fr.r;
    const x = Math.round(g.x), y = Math.round(g.y);
    const x0 = x - 11, y0 = y - 15;
    ctx.fillStyle = 'rgba(20,12,30,.22)'; ctx.fillRect(x - 6, y - 1, 12, 2);
    ctx.drawImage(img, x0, y0);
    // skallet: små streck framför munnen
    if (g.fr === 5) {
      const mx = g.dir < 0 ? x0 + 21 - fr.mouth[0] : x0 + fr.mouth[0], my = y0 + fr.mouth[1], s = g.dir < 0 ? -1 : 1;
      ctx.fillStyle = '#f4f1ea';
      ctx.fillRect(mx + s * 2, my - 3, 1, 1); ctx.fillRect(mx + s * 3, my - 4, 1, 1);
      ctx.fillRect(mx + s * 3, my - 1, 2 * s > 0 ? 2 : 1, 1); if (s < 0) ctx.fillRect(mx - 4, my - 1, 1, 1);
      ctx.fillRect(mx + s * 2, my + 1, 1, 1); ctx.fillRect(mx + s * 3, my + 2, 1, 1);
    }
    const inside = p.door && p.door.ph !== 'app' && p.door.ph !== 'out';
    if (!inside && !p.hidden && !g.free) {
      const nx = g.dir < 0 ? x0 + 21 - fr.neck[0] : x0 + fr.neck[0], ny = y0 + fr.neck[1];
      const X = Math.round(p.x + p.ox), Y = Math.round(p.y + p.oy);
      const dir = p.showDir || 'down';
      const hx = dir === 'down' || dir === 'up' ? X - (p.look.build || 5) - 1 : dir === 'right' ? X + 1 : X - 2;
      drawLeash(ctx, hx, Y - (p.sit ? 10 : 14), nx, ny);
    }
  }

  // ------------------------------------------------------------------
  //  Startbefolkning
  // ------------------------------------------------------------------
  // Varje ny figur får "redan ha gått" en slumpad stund, så att de sprids
  // ut längs sina vägar i stället för att starta i klungor.
  function preRun(p, secs) {
    others = peds;
    for (let k = 0, n = Math.round(secs * 10); k < n && !p.gone; k++) { movePed(p, 0.1); sampleTrail(p, 0.1); }
    const X = p.x + p.ox, Y = p.y + p.oy;
    if (p.comp) { p.comp.x = X; p.comp.y = Y; p.comp.hidden = p.hidden; p.comp.door = p.door; }
    if (p.dog) {
      const dx = X - p.hx * 8, dy = Y - p.hy * 8;
      p.dog.x = walk(dx, dy) ? dx : X; p.dog.y = walk(dx, dy) ? dy : Y;
      if (p.door && p.dog.tie) { p.dog.x = p.dog.tie.x; p.dog.y = p.dog.tie.y; }
    }
    p.showMove = p.moving; p.showDir = p.sit ? p.sit.dir : p.moving ? headingDir(p.hx, p.hy) : p.face;
  }
  // Scenen skapar modulerna innan den fyllt i env (klockan, spelarens plats),
  // så startbefolkningen sätts ut vid första update() i stället.
  let started = false;
  function start() {
    started = true;
    updCam();
    lastCam = [camCX(), camCY()];
    findFlora();
    findCoffee();
    seedBirds();
    seedSquirrels();
    if (env.dark > 0.3) for (const pg of birdsG) { if (pg.sp === 'sparv') { pg.st = 'h'; pg.t = rr(5, 40); } else if (pg.sp !== 'mas') { pg.st = 'a'; pg.t = rr(5, 40); } } // på natten sover fåglarna
    for (let i = 0, n = targetCount(env.hour); i < 40 && ordinary() < n; i++) preRun(spawnSomewhere(true), rr(0, 16));
    manageSpots(0, true);
    cleanup();
  }

  // ---------- prata med folk (klick i city.js) ----------
  // Personen stannar (inte mitt på övergångsstället – och joggaren springer vidare), vänder sig mot
  // en och säger något som passar: tid på dygnet, vädret, vem hen är och vad hen bär på. Rösten är
  // personens egen (look → voices.js), bubblan ritas av city.js via talks().
  const SMALLTALK = {
    morgon: ['God morgon!', 'Tidigt uppe, du med?', 'Jag behöver kaffe …'],
    dag: ['Hej hej!', 'Hallå där!', 'Trevligt att ses!', 'Känner vi varandra?', 'Fin stad, va?', 'Har du varit på Burgarbaren?', 'Jag ska bara handla lite.', 'Hej! Allt bra?'],
    kvall: ['God kväll!', 'Snart dags att gå hem.', 'Vilken fin kväll.'],
    natt: ['Oj, är du också vaken?', 'Sent nu – nattbussen går snart.'],
    sol: ['Vilket väder!', 'Äntligen sol!', 'Perfekt dag för glass.'],
    regn: ['Usch, vilket regn!', 'Glömde du paraplyet?', 'Jag blir blöt ända in!'],
    'snö': ['Snö! Ska vi bygga en snögubbe?', 'Akta så du inte halkar!'],
    dimma: ['Jag ser knappt var jag går.'],
    kallt: ['Brr, så kallt!', 'Jag fryser om fingrarna.'],
    varmt: ['Puh, vad varmt!'],
    barn: ['Hej! Vill du leka?', 'Jag har lov i dag!', 'Titta, jag kan hoppa!', 'Jag ska bli brandman!', 'Mamma säger att jag inte får prata med främlingar!'],
    kostym: ['Ursäkta, jag har ett möte.', 'Aktierna går upp i dag!', 'Har du sett kurserna på Finanshuset?', 'Tid är pengar!', 'Jag är lite sen.'],
    jogg: ['Kan inte stanna!', 'Puh … tre kilometer kvar!', 'Spring med!'],
    hund: ['Han är snäll, du får klappa!', 'Vi är ute på promenad.', 'Hon älskar parken.'],
    kaffe: ['Bästa kaffet i stan!', 'Har du provat kaféet?'],
    resvaska: ['Jag ska ut och flyga!', 'Vet du var bussen till flygplatsen går?'],
    glass: ['Mmm, glass!'],
    sitter: ['Skönt att sitta en stund.', 'Sätt dig du med!'],
    telefon: ['Vänta, jag pratar i telefon!', 'Jag ringer tillbaka sen!'],
  };
  function smalltalk(p) {
    const w = W(), h = env.hour, t = w.temp ?? 15, pools = [];
    const add = (k, n = 1) => { for (let i = 0; i < n; i++) pools.push(SMALLTALK[k]); };
    if (p.call > 0) add('telefon', 4);
    if (p.jogger) add('jogg', 4);
    if (p.look.kid) add('barn', 3);
    if (p.suit) add('kostym', 3);
    if (p.dog) add('hund', 2);
    if (p.carry === 'kaffe') add('kaffe');
    if (p.carry === 'resvaska') add('resvaska', 2);
    if (p.carry === 'glass') add('glass');
    if (p.sit) add('sitter');
    if (w.kind === 'sol' ? h >= 8 && h < 19 : SMALLTALK[w.kind] && w.kind !== 'moln') add(w.kind, 2);
    if (t < 3) add('kallt'); else if (t > 22 && h >= 9 && h < 20) add('varmt');
    add(h < 5 || h >= 22 ? 'natt' : h < 10 ? 'morgon' : h >= 18 ? 'kvall' : 'dag', 2);
    add('dag');
    const pool = pick(pools);
    let s = pick(pool);
    if (s === p.lastSaid) s = pick(pool); // helst inte samma sak två gånger i rad
    return s;
  }
  // stå kvar och vänta på den som är på väg fram (klick på någon en bit bort)
  function holdFor(p, secs, fx, fy) {
    const lead = p.leader || p;
    if (p.jogger || lead.onCross >= 0 || lead.door) return false;
    lead.hold = Math.max(lead.hold || 0, secs);
    for (const q of [lead, lead.comp].filter(Boolean)) if (!q.sit) q.face = faceTo(fx - q.x, (fy - q.y) * 0.6);
    return true;
  }
  function talkTo(p, fx, fy) {
    const text = smalltalk(p);
    p.lastSaid = text;
    p.talk = { text, t: 2.2 + text.length * 0.06 };
    holdFor(p, p.talk.t + 0.6, fx, fy);
    return text;
  }

  // ==================================================================
  return {
    obstacles: [],
    update(dt) {
      dt = Math.min(0.1, Math.max(0, dt || 0));
      if (!started) start();
      updCam();
      const nNpc = peds.filter((p) => !p.hidden).length;
      if (lastCam && Math.hypot(camCX() - lastCam[0], camCY() - lastCam[1]) > 260) repopulate();
      lastCam = [camCX(), camCY()];
      const ppl = env.people || [];
      others = [...peds, ...ppl.slice(0, Math.max(1, ppl.length - nNpc))];
      manage(dt);
      updBus();
      for (const p of peds) if (!p.leader) { movePed(p, dt); sampleTrail(p, dt); }
      for (const p of peds) if (p.leader) updComp(p, dt);
      for (const p of peds) { updShow(p, dt); if (p.phoneT > 0) p.phoneT -= dt; if (p.photo > 0) p.photo -= dt; if (p.caller) updCall(p, dt); if (p.talk && (p.talk.t -= dt) <= 0) p.talk = null; }
      for (const p of peds) if (p.dog) updDog(p, dt);
      dogSocial();
      updBirdsG(dt);
      updBirds(dt);
      updSquirrels(dt);
      updWater(dt);
      updButterflies(dt);
      updCat(dt);
      updFlies(dt);
    },
    // hundarna (för tools/dog-test.mjs: inga hopp, inga riktningsbyten varje bildruta)
    dogs() { return peds.filter((p) => p.dog).map((p) => ({ id: p.seed, x: p.dog.x, y: p.dog.y, dir: p.dog.dir, fr: p.dog.fr, moving: !!p.dog.moving, free: !!p.dog.free, owner: { x: p.x, y: p.y, moving: !!p.moving } })); },
    positions() {
      const out = [];
      for (const p of peds) if (!p.hidden) out.push({ x: p.x + p.ox, y: p.y + p.oy });
      return out;
    },
    // klick på folk: den synliga fotgängaren under pekaren (närmast mitten av figuren vinner)
    personAt(x, y) {
      let best = null, bd = 1e9;
      for (const p of peds) {
        if (p.hidden || p.gone) continue;
        const X = p.x + p.ox, Y = p.y + p.oy, hgt = p.look.kid ? 24 : 33;
        if (x < X - 6 || x > X + 6 || y < Y - hgt || y > Y + 2) continue;
        const d = Math.abs(x - X) + Math.abs(y - (Y - hgt / 2)) * 0.5;
        if (d < bd) { bd = d; best = p; }
      }
      return best;
    },
    talkTo,
    holdFor,
    // pratbubblorna just nu (världskoordinater: fotpunkten x, bubblans spets y) – city.js ritar dem
    talks() {
      const out = [];
      for (const p of peds) if (p.talk && !p.hidden && !p.gone && visible(p.x, p.y, 40)) out.push({ id: p.id, x: Math.round(p.x + p.ox), y: Math.round(p.y + p.oy) - (p.look.kid ? 26 : 34), text: p.talk.text, voice: p.look });
      return out;
    },
    // sittplatser som fotgängarna har tagit (så att spelaren inte sätter sig i knät på någon)
    busySeats() { const s = new Set(); for (const [id, p] of seatUse) if (p && !p.gone) s.add(id); return s; },
    seatBusy(id) { const p = seatUse.get(id); return !!(p && !p.gone); },
    items() {
      const out = [];
      for (const p of peds) {
        if (!p.hidden && visible(p.x, p.y, 60)) {
          const Y = p.y + p.oy, door = p.door || (p.leader && p.leader.door);
          out.push({ x: p.x + p.ox, y: p.sit ? p.sit.y : door ? Math.max(Y, door.base + 0.5) : Y, draw: (ctx) => drawPed(ctx, p) });
        }
        if (p.dog && visible(p.dog.x, p.dog.y, 40) && !(p.hidden && p.door && p.door.home)) out.push({ x: p.dog.x, y: p.dog.y, draw: (ctx) => drawDog(ctx, p) });
      }
      for (const pg of birdsG) if ((pg.st === 'g' || pg.st === 'f') && visible(pg.x, pg.y - pg.alt, 30)) out.push(birdGItem(pg));
      for (const b of birds) out.push(birdItem(b));
      for (const q of squirrels) if (visible(q.x, q.y, 30)) { const it = squirrelItem(q); if (it) out.push(it); }
      waterItems(out);
      snowmanItems(out);
      if (bfActive()) for (const f of butterflies) if (visible(f.x, f.y, 20)) out.push(bfItem(f));
      for (const c of cats) if (visibleCat(c) && visible(c.x, c.y, 20)) out.push(catItem(c));
      return out;
    },
    glow(ctx) {
      ctx.globalCompositeOperation = 'lighter';
      for (const f of flies) {
        const b = Math.max(0, Math.sin(env.t * 1.7 + f.ph)), a = b * b;
        if (a < 0.04) continue;
        const x = Math.round(f.x), y = Math.round(f.y);
        // pixelhalo i tre steg: stor svag ruta, kors, ljus kärna
        ctx.fillStyle = `rgba(90,170,30,${(a * 0.12).toFixed(3)})`; ctx.fillRect(x - 3, y - 2, 7, 5); ctx.fillRect(x - 2, y - 3, 5, 7);
        ctx.fillStyle = `rgba(150,230,60,${(a * 0.5).toFixed(3)})`; ctx.fillRect(x - 1, y, 3, 1); ctx.fillRect(x, y - 1, 1, 3);
        ctx.fillStyle = `rgba(245,255,170,${a.toFixed(3)})`; ctx.fillRect(x, y, 1, 1);
      }
      ctx.globalCompositeOperation = 'source-over';
      if (env.dark > 0.2) {
        for (const c of cats) {
          if (!visibleCat(c) || !visible(c.x, c.y, 10)) continue;
          ctx.fillStyle = c.pal === 2 ? 'rgba(230,240,90,0.9)' : 'rgba(170,255,110,0.85)';
          for (const [x, y] of catEyes(c)) ctx.fillRect(x, y, 1, 1);
        }
        // mobilskärmarna lyser i mörkret
        for (const p of peds) if (p.hang && p.phoneT > 0 && p.showDir === 'down' && !p.showMove && visible(p.x, p.y, 10)) {
          const X = Math.round(p.x + p.ox), Y = Math.round(p.y + p.oy);
          ctx.fillStyle = 'rgba(170,215,255,0.35)'; ctx.fillRect(X - 2, Y - 19, 5, 6);
          ctx.fillStyle = 'rgba(210,235,255,0.9)'; ctx.fillRect(X, Y - 17, 1, 2);
        }
        // (v3) mobilen som tar en bild: skärmen lyser (bakifrån syns den, framifrån lyser den upp bröstet)
        for (const p of peds) if (p.photo > 0 && !p.showMove && !p.sit && visible(p.x, p.y, 10)) {
          const X = Math.round(p.x + p.ox), Y = Math.round(p.y + p.oy), d = p.showDir;
          if (d === 'up') { ctx.fillStyle = 'rgba(150,200,255,0.3)'; ctx.fillRect(X + 2, Y - 39, 8, 7); ctx.fillStyle = 'rgba(190,225,255,0.85)'; ctx.fillRect(X + 4, Y - 37, 4, 3); }
          else if (d === 'down') { ctx.fillStyle = 'rgba(170,215,255,0.3)'; ctx.fillRect(X - 3, Y - 22, 6, 7); }
        }
      }
    },
    _debug: { nav, peds: () => peds, birds: birdsG, squirrels, ducks, swans, cats, snowmen, seats, seatUse, hangs: HANGS, plays: PLAYS, spawn, planFor, buildings: ALL_B, butterflies, bfHomes: () => BF_HOMES, trees: () => trees, bushes: () => bushes,
      riverBirds, coffee: () => coffeeSpot },
  };
}
