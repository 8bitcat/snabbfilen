// Pixelstadens mark (v2/v3) – hela världen CITY.W × 820, målad pixel för pixel i samma
// korn som figurerna (1 enhet = 1 px):
//   bakgatan, gränderna, tvärgatorna och gågatorna i båda husraderna, trottoarerna,
//   Pixelgatan, Södergatan och Infarten (asfalt, zebror, stopplinjer, busszoner),
//   parken (gräs, grusgångar, torget, dammen, hundrastgården, lekplatsens sand, ängen),
//   kyrkogården, macken, kajen och kanalen, Linnéstaden (v4, x < 0: Marknadstorget,
//   stadsodlingen, Lindparken) – och förorten, där allt är slitet:
//   spruckna och saknade plattor, potthål, lappad asfalt, fimpar, glasskärvor,
//   ogräs i sprickorna, bleka övergångsställen, klotter, parkeringen med linjer,
//   den slitna lekplatsen, grusplanen, återvinningen och vagnsplatsen.
//
// Kontrakt (docs/STADEN.md):
//   paintGround(night) → canvas (CITY.W − CITY.X0) × CITY.H, duk-x = världs-x − X0 (v4: Linnéstaden
//                        ligger i x X0–0 – scenen ritar duken med X0 som förskjutning). Målas EN gång per dag/natt och cachas
//                        av scenen (natten = dagens bild tonad, så bara ett tungt pass).
//   groundLive(ctx, env, view) → det som rör sig på marken varje bildruta: blöt asfalt
//                        med himmelsreflexer och pölar efter env.weather.wet, regnringar,
//                        krusningar på kanalen, (molnskuggor bara utan weather.js).
//   groundOver(ctx, env, view) → fotspår i snön där folk går. Ska ritas EFTER
//                        weather.drawBack (snötäcket) – annars ritar groundLive dem själv.
//   V2 = true           → scenen hoppar över platshållarmarken i fallback-v2.js.
// Ljuset kommer snett från sydväst: fasaderna mot trottoaren är solbelysta och
// husen kastar skugga snett bakåt (norrut/österut) – in i gränderna och över
// bakgatan/parkgången. Det är det som ger djup mellan husen.
import { Pix, mix, mul, hash, bayer, BIG, SMALL, eachTextPixel } from '../core/floor-pix.js';
import { CITY, BUILDINGS, BUILDINGS_S, BUILDINGS_D, BUILDINGS_X, BUILDINGS_L, FREESTANDING, STREETS_ALL, CROSSWALKS, CROSSWALKS_S, CROSSWALKS_I,
  BUS_STOPS, PARK_LAYOUT, SUB_LAYOUT, DOWNTOWN_LAYOUT, LINNE_LAYOUT, PIER, RIVER, BRIDGES, LOTS, footprint } from './map.js';

export const V2 = true;

const W = CITY.W, H = CITY.H;
const X0 = CITY.X0 || 0, GW = W - X0;              // (v4) världen börjar i X0 (Linnéstaden); bufferten är GW bred
const W1 = 1700;                                   // v1-stadens bredd (de gamla slumpslingorna behåller sitt utseende)
const BASE = CITY.BASE, TOP = CITY.FOOT_TOP;       // 186 / 40
const BASE_S = CITY.BASE_S, TOP_S = CITY.FOOT_TOP_S; // 640 / 494
const DY = CITY.DY_S;                              // 454
const [R0, R1] = CITY.ROAD;                        // 218–276
const [RS0, RS1] = CITY.ROAD_S;                    // 672–730
const [SN0] = CITY.SIDEWALK_N;                     // 186
const [SS0, SS1] = CITY.SIDEWALK_S;                // 276–306
const [SX0] = CITY.SIDEWALK_SS;                    // 730
const PK0 = CITY.PARK[0];                          // 306
const [BS0, BS1] = CITY.BACK_S;                    // 462–490
const [I0, I1] = CITY.INFARTEN;                    // 1700–1752
const XS = CITY.X_SUB;                             // 3032 (v3 – förorten ligger öster om floden)
const SDX = CITY.SUB_DX || 0;                      // 1280: förortens detaljer nedan står i v2-x (1752–2720) + SDX
const XD = CITY.X_DT || I1;                        // 1752: downtown börjar (v3)
const RX0 = RIVER ? RIVER.x0 : XS, RX1 = RIVER ? RIVER.x1 : XS; // flodrummet 2400–3032 (bridge.js målar det på riktigt)
const [Q0, Q1] = CITY.QUAY;                        // 760–776
const CN0 = CITY.CANAL[0];                         // 776
const SUN_DX = 0.2;                                // skuggan förskjuts så här mycket österut per pixel norrut
const IW0 = 1686, IE1 = 1766;                      // Infartens trottoarer: väster 1686–1700, öster 1752–1766
const ROW_N = STREETS_ALL.filter((s) => s.row === 'n'), ROW_S = STREETS_ALL.filter((s) => s.row === 's');
const L_N = (BUILDINGS_L || []).filter((b) => b.row === 'n'), L_S = (BUILDINGS_L || []).filter((b) => b.row === 's');
const HOUSES_N = [...BUILDINGS, ...(BUILDINGS_D || []).filter((b) => b.row === 'n'), ...BUILDINGS_X.filter((b) => b.row === 'n'), ...L_N];
const HOUSES_S = [...BUILDINGS_S, ...(BUILDINGS_D || []).filter((b) => b.row === 's'), ...BUILDINGS_X.filter((b) => b.row === 's'), ...L_S];
const lotById = (id) => LOTS.find((l) => l.id === id);

// ---------- pixelbuffert (skrivs direkt i ImageData under målningen) ----------
let D = null, SH = null;
// Klippningen: Linnéstadens pass (west) målar bara x < 0, så att centrum aldrig rörs av dem.
let CX0 = X0, CX1 = W;
const inb = (x, y) => x >= CX0 && y >= 0 && x < CX1 && y < H;
function west(fn) {
  if (X0 >= 0) return;
  const a = CX0, b = CX1;
  CX0 = X0; CX1 = 0;
  try { fn(); } finally { CX0 = a; CX1 = b; }
}
function put(x, y, c) {
  x = Math.floor(x); y = Math.floor(y);
  if (!inb(x, y)) return;
  const i = (y * GW + x - X0) << 2;
  D[i] = (c >> 16) & 255; D[i + 1] = (c >> 8) & 255; D[i + 2] = c & 255; D[i + 3] = 255;
}
function get(x, y) {
  x = Math.floor(x); y = Math.floor(y);
  if (x < X0 || y < 0 || x >= W || y >= H) return 0;
  const i = (y * GW + x - X0) << 2;
  return (D[i] << 16) | (D[i + 1] << 8) | D[i + 2];
}
function blend(x, y, c, a) {
  if (a <= 0 || !inb(Math.floor(x), Math.floor(y))) return;
  put(x, y, a >= 1 ? c : mix(get(x, y), c, a));
}
function shade(x, y, f) {
  x = Math.floor(x); y = Math.floor(y);
  if (!inb(x, y)) return;
  const i = (y * GW + x - X0) << 2;
  D[i] *= f; D[i + 1] *= f; D[i + 2] *= f;
}
// kastad skugga: mörkare och lite blåare, aldrig dubbelt på samma pixel
function shadow(x, y, f = 0.66) {
  x = Math.floor(x); y = Math.floor(y);
  if (!inb(x, y) || SH[y * GW + x - X0]) return;
  SH[y * GW + x - X0] = 1;
  put(x, y, mix(mul(get(x, y), f), 0x1a2238, 0.1));
}
function ellipse(cx, cy, rx, ry, fn) {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
    const t = Math.hypot((x + 0.5 - cx) / rx, (y + 0.5 - cy) / ry);
    if (t < 1) fn(x, y, t);
  }
}
const fillR = (r, fn) => { for (let y = r[1]; y < r[3]; y++) for (let x = r[0]; x < r[2]; x++) put(x, y, fn(x, y)); };
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = (a, b, v) => { const t = clamp01((v - a) / (b - a)); return t * t * (3 - 2 * t); };
const mod = (a, n) => ((a % n) + n) % n;
const al = (x, n) => Math.floor(x / n) * n;                                       // (v4) närmaste multipel nedåt – förband som möts i x 0
const inR = (x, y, r) => x >= r[0] && x < r[2] && y >= r[1] && y < r[3];

// ---------- brus ----------
function vnoise(x, y, s, seed) {
  const fx = x / s, fy = y / s, ix = Math.floor(fx), iy = Math.floor(fy);
  let tx = fx - ix, ty = fy - iy;
  tx = tx * tx * (3 - 2 * tx); ty = ty * ty * (3 - 2 * ty);
  const a = hash(ix, iy, seed), b = hash(ix + 1, iy, seed), c = hash(ix, iy + 1, seed), d = hash(ix + 1, iy + 1, seed);
  return a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty;
}
const fbm = (x, y, s, seed) => vnoise(x, y, s, seed) * 0.58 + vnoise(x, y, s / 2.3, seed + 1) * 0.28 + vnoise(x, y, s / 5.1, seed + 2) * 0.14;

// Slitaget 0–1 per plats: centrum/parken 0, söder 0.15, downtown 0 (välskött finanskvarter),
// förorten 1 – med en prickig, ojämn övergång vid flodens östra kaj (vägarna blir sämre
// när man kommit över bron).
function wornAt(x, y) {
  if (x < 0) return 0;                                                                      // (v4) Linnéstaden: välskött
  const base = x < I1 && y >= BS1 && y < Q1 ? 0.15 : 0;
  if (x < XS - 36) return base;
  if (x >= XS + 64) return 1;
  return base + (1 - base) * smooth(XS - 30, XS + 60, x + (vnoise(x, y, 17, 7) - 0.5) * 44);
}

// granit: fläckig med mörka korn och glittrande kvarts
function granite(x, y, c) {
  const h = hash(x, y, 5);
  if (h > 0.9) return mul(c, 0.76);
  if (h < 0.06) return mix(c, 0xffffff, 0.3);
  return mul(c, 0.94 + hash(x, y, 6) * 0.1);
}
const grainy = (c, x, y, amt) => mul(c, 1 - amt + hash(x, y, 3) * amt * 2);
// smutsa ner en färg efter slitaget (grått, brunt damm)
const grime = (c, x, y, worn, seed = 40) => (worn > 0 ? mix(c, mul(0x8a8274, 0.9 + vnoise(x, y, 9, seed) * 0.2), worn * (0.18 + vnoise(x, y, 23, seed + 1) * 0.2)) : c);

// ---------- stenrader ----------
// Rader med (ev. varierande) höjd, stenar med varierande bredd. bond = halvstensförband.
function rows(x0, x1, y0, y1, o) {
  const R = [], rowOf = new Int16Array(y1 - y0), n = x1 - x0;
  let y = y0, r = 0;
  while (y < y1) {
    const h = o.h[0] + ((hash(r, 1, o.seed) * (o.h[1] - o.h[0] + 1)) | 0);
    const k = new Int16Array(n), st = new Int32Array(n), wd = new Int16Array(n);
    let x = o.bond ? x0 - (r & 1) * (o.w[0] >> 1) - (o.shift || 0) : x0 - ((hash(r, 2, o.seed) * o.w[1]) | 0);
    for (let i = 0; x < x1; i++) {
      const w = o.w[0] + ((hash(r, i + 3, o.seed) * (o.w[1] - o.w[0] + 1)) | 0);
      for (let xx = Math.max(x, x0); xx < Math.min(x + w, x1); xx++) { k[xx - x0] = i; st[xx - x0] = x; wd[xx - x0] = w; }
      x += w;
    }
    R.push({ y, h, k, st, wd });
    for (let yy = y; yy < Math.min(y + h, y1); yy++) rowOf[yy - y0] = r;
    y += h; r++;
  }
  const S = { r: 0, k: 0, lx: 0, ly: 0, w: 0, h: 0 };
  return (x, yy) => {
    const ri = rowOf[yy - y0], Q = R[ri], j = x - x0;
    S.r = ri; S.k = Q.k[j]; S.lx = x - Q.st[j]; S.ly = yy - Q.y; S.w = Q.wd[j]; S.h = Q.h;
    return S;
  };
}
// Målar stenarna med fog nere/höger, högdager uppe/vänster och skugga nere/höger.
// col får returnera -1 = "sten saknas" (målas då av o.hole).
function stones(at, x0, x1, y0, y1, col, o = {}) {
  const hi = o.hi ?? 0.16, lo = o.lo ?? 0.82, jc = o.joint || (() => 0x4a443c), gr = o.grain ?? 0.06;
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    const s = at(x, y);
    if (s.lx === s.w - 1 || s.ly === s.h - 1) { put(x, y, jc(x, y)); continue; }
    let c = col(s, x, y);
    if (c < 0) { put(x, y, o.hole ? o.hole(x, y, s) : dirt(x, y)); continue; }
    const L = s.lx, T = s.ly, Rr = s.w - 2, B = s.h - 2;
    if (o.round && (L === 0 || L === Rr) && (T === 0 || T === B)) c = mix(c, jc(x, y), 0.6);
    else if (T === 0) c = mix(c, 0xffffff, hi);
    else if (T === B) c = mul(c, lo);
    else if (L === 0) c = mix(c, 0xffffff, hi * 0.45);
    else if (L === Rr) c = mul(c, (1 + lo) / 2);
    put(x, y, grainy(c, x, y, gr));
  }
}

// ---------- jord, grus, betong, ogräs, skräp ----------
// jord med småsten (saknade plattor, tomter, trampade ytor)
function dirt(x, y) {
  let c = grainy(mix(0x7a6a54, 0x927e62, vnoise(x, y, 6, 610)), x, y, 0.08);
  const h = hash(x, y, 611);
  if (h > 0.94) c = mix(0xb0a48e, 0x9a9488, hash(x, y, 612));
  else if (hash(x, y - 1, 611) > 0.94) c = mul(c, 0.78);
  else if (h < 0.05) c = mul(c, 0.78);
  return c;
}
// grus: krattat, ljust (kyrkogården, macken) eller rödaktigt (grusplanen)
function gravel(x, y, base, seed = 620) {
  let c = mul(mix(base, mul(base, 1.1), vnoise(x, y, 7, seed)), 0.94 + hash(x, y, seed + 1) * 0.1);
  const h = hash(x, y, seed + 2);
  if (h > 0.93) c = [0xe8dcc0, 0xd4c4a4, 0xa89478, 0x9a948a][(hash(x, y, seed + 3) * 4) | 0];
  else if (hash(x, y - 1, seed + 2) > 0.93) c = mul(c, 0.8);
  else if (h < 0.05) c = mul(c, 0.82);
  return c;
}
// betongplattor (ruta cw × ch) med fogar, ballast och slitage
function concrete(x, y, cw, ch, seed, worn = 0) {
  const lx = mod(x, cw), ly = mod(y, ch), id = hash(Math.floor(x / cw), Math.floor(y / ch), seed);
  if (lx === cw - 1 || ly === ch - 1) return worn > 0.5 && hash(x, y, seed + 1) > 0.7 ? mix(0x4a5a30, 0x5e7a3a, hash(x, y, seed + 2)) : mul(0x6e6a62, 0.9 + hash(x, y, seed + 3) * 0.16);
  let c = mix(0xb0aca2, 0xa2a096, id);
  if (id > 0.9) c = mul(c, 0.88);
  if (ly === 0) c = mix(c, 0xffffff, 0.12); else if (ly === ch - 2) c = mul(c, 0.9);
  if (lx === 0) c = mix(c, 0xffffff, 0.05); else if (lx === cw - 2) c = mul(c, 0.94);
  c = grainy(c, x, y, 0.06);
  if (hash(x, y, seed + 4) > 0.96) c = mul(c, 0.84);
  return grime(c, x, y, worn, seed + 5);
}
// ogrästuva i en spricka/fog (ritas uppåt från fotpunkten)
const WEED = [0x2a4f22, 0x3a6c2c, 0x528a38, 0x72aa48];
function tuft(x, y, s, big = false) {
  put(x, y, WEED[0]); put(x, y - 1, WEED[1]);
  if (hash(x, y, s) > 0.4) put(x - 1, y - 1, WEED[2]);
  if (hash(x, y, s + 1) > 0.5) put(x + 1, y - 2, WEED[2]);
  if (big) { put(x - 1, y - 2, WEED[1]); put(x, y - 3, WEED[3]); put(x + 1, y - 1, WEED[2]); put(x + 2, y - 2, WEED[1]); put(x - 2, y - 1, WEED[2]); }
  if (hash(x, y, s + 2) > 0.86) put(x, y - (big ? 4 : 2), 0xf2d23a);                     // maskros
}
// skräp: fimpar, glasskärvor, kapsyler, papper, tuggummi, burkar, påsar, löv
function litter(x, y, k, s) {
  x = Math.floor(x); y = Math.floor(y);
  if (k < 0.3) { put(x, y, 0xefeadf); put(x + 1, y, 0xe4ded2); put(x + 2, y, 0xd08a3c); shade(x, y + 1, 0.85); }   // fimp
  else if (k < 0.48) {                                                                                               // glasskärvor
    const g = [0x5a9a5a, 0x8a5a26, 0xcfdde4][(hash(x, y, s) * 3) | 0];
    for (let j = 0; j < 4; j++) { const dx = ((hash(j, s, 1) - 0.5) * 6) | 0, dy = ((hash(j, s, 2) - 0.5) * 3) | 0; put(x + dx, y + dy, g); if (j === 0) put(x + dx + 1, y + dy, mix(g, 0xffffff, 0.8)); }
  } else if (k < 0.56) { put(x, y, hash(x, y, s) > 0.5 ? 0xc8a030 : 0xb03a2a); put(x + 1, y, 0x6a5a3a); }           // kapsyl
  else if (k < 0.66) { put(x, y, 0xe8e2d4); put(x + 1, y, 0xd8d2c4); put(x, y + 1, 0xc4beb0); shade(x + 1, y + 1, 0.8); } // papperslapp
  else if (k < 0.74) { put(x, y, 0x6e6a64); if (hash(x, y, s) > 0.5) put(x + 1, y, 0x7c7872); }                       // tuggummi
  else if (k < 0.82) { const c = hash(x, y, s) > 0.5 ? 0xc83a32 : 0x9aa4ae; put(x, y, c); put(x + 1, y, mix(c, 0xffffff, 0.4)); put(x + 2, y, mul(c, 0.7)); shade(x, y + 1, 0.8); shade(x + 1, y + 1, 0.8); } // burk
  else if (k < 0.88) { put(x, y, 0xe6e8ea); put(x + 1, y, 0xd2d6da); put(x - 1, y + 1, 0xc8ccd0); put(x, y + 1, 0xf0f2f4); put(x + 1, y + 1, 0xb8bcc2); } // plastpåse
  else { const lc = [0xc88a2a, 0x9a5a22, 0xd8b040][(hash(x, y, s) * 3) | 0]; put(x, y, lc); put(x + 1, y, mul(lc, 0.75)); } // löv
}
function scatter(r, n, seed, kinds = [0, 1]) {
  for (let i = 0; i < n; i++) {
    const x = r[0] + hash(i, 1, seed) * (r[2] - r[0] - 3), y = r[1] + 1 + hash(i, 2, seed) * (r[3] - r[1] - 3);
    litter(x, y, kinds[0] + hash(i, 3, seed) * (kinds[1] - kinds[0]), seed + i);
  }
}
// sprejad tagg på marken/muren: SMALL-text med dimmig kant
function tag(x0, y0, s, col, seed) {
  eachTextPixel(SMALL, s, x0, y0, 1, (px, py) => {
    put(px, py, mul(col, 0.9 + hash(px, py, seed) * 0.2));
    if (hash(px, py, seed + 1) > 0.7) blend(px + (hash(px, py, seed + 2) > 0.5 ? 1 : -1), py + (hash(px, py, seed + 3) > 0.5 ? 1 : 0), col, 0.35);
  });
}

// ---------- asfalt ----------
const ASPH = 0x46484f;
// hjulspåren i körfälten (y-band där däcken nöter asfalten blank) – Pixelgatan och Södergatan
const TRACKS_N = [[233, 236], [240, 244], [259, 262], [266, 270]];
const TRACKS = [...TRACKS_N, ...TRACKS_N.map(([a, b]) => [a + DY, b + DY])];
const trackAt = (y) => { for (const t of TRACKS) if (y >= t[0] && y < t[1]) return 1; return 0; };
// Infartens hjulspår (lodräta band kring körfälten x 1713 och 1739)
const TRACKS_I = [[1706, 1709], [1716, 1720], [1732, 1735], [1742, 1746]];
const trackAtX = (x) => { for (const t of TRACKS_I) if (x >= t[0] && x < t[1]) return 1; return 0; };
function asphalt(x, y, tone = 0, road = true) {
  // grundton i tre skalor: stora fläckar, mellanstora och klumpig ballast (inte salt-och-peppar)
  const f = vnoise(x, y, 2.4, 26);
  let c = mul(ASPH, 1 + (vnoise(x, y, 44, 21) - 0.5) * 0.12 + (vnoise(x, y, 10, 22) - 0.5) * 0.08 + (f - 0.5) * 0.12 + tone);
  const tr = road ? trackAt(y) * (0.6 + vnoise(x, y, 18, 25) * 0.4) : 0;
  const h = hash(x, y, 23);
  if (h < 0.06) c = mul(c, 0.8);                                                       // mörk ballast
  else if (h > 0.992) c = mix(c, 0xaaa49a, 0.6 * (1 - tr * 0.5));                      // kvartskorn
  else if (h > 0.968) c = mix(c, 0x8e8a84, 0.36 * (1 - tr * 0.5));                     // ljust grus
  else if (h > 0.93 && f > 0.45) c = mix(c, 0x6e7078, 0.3);                            // gråblå sten
  if (tr) c = mul(c, 1 - 0.07 * tr);
  return c;
}
// gammal asfalt: oxiderad (gråare, ljusare), stensläpp i fläckar där ballasten lossnat
function asphaltW(x, y, tone = 0, road = true, worn = 0) {
  let c = asphalt(x, y, tone, road);
  if (worn <= 0.02) return c;
  c = mix(c, mul(0x5f5e5a, 0.94 + vnoise(x, y, 30, 28) * 0.12), 0.34 * worn);
  const v = vnoise(x, y, 5, 27);
  if (v > 0.66 && hash(x, y, 29) > 0.6 - worn * 0.2) c = hash(x, y, 30) > 0.55 ? mix(c, 0x827d72, 0.26 * worn) : mul(c, 1 - 0.18 * worn);
  return c;
}
// Infartens asfalt: hjulspåren går lodrätt
function asphaltI(x, y, worn) {
  let c = asphaltW(x, y, 0, false, worn);
  const tr = trackAtX(x) * (0.6 + vnoise(x, y, 18, 25) * 0.4);
  if (tr) c = mul(c, 1 - 0.07 * tr);
  return c;
}
// vägmarkering med slitage (asfalten lyser igenom där färgen nötts bort)
function mark(x, y, col, wear) {
  const h = hash(x, y, 31);
  if (h < wear) return;
  let c = mul(col, 0.9 + hash(x, y, 32) * 0.12);
  if (h < wear + 0.15) c = mix(c, get(x, y), 0.5);
  put(x, y, c);
}
const wearAt = (x, y, base = 0.05) => base + trackAt(y) * 0.3 + vnoise(x, y, 7, 33) * 0.15;

// sprickor: slumpvandring. sealed = tätad med blank svart bitumen
function crack(x, y, len, seed, o = {}) {
  let px = Math.floor(x), py = Math.floor(y);
  for (let i = 0; i < len; i++) {
    if (o.sealed) {
      put(px, py, 0x1d1e23);
      if (hash(i, seed, 1) > 0.55) put(px, py + 1, 0x26272d);
      if (hash(i, seed, 2) > 0.8) put(px, py - 1, 0x3c3e46);
    } else {
      shade(px, py, 0.55);
      if (hash(i, seed, 3) > 0.6) blend(px, py + 1, 0xffffff, 0.08);
      if (o.weeds && hash(i, seed, 7) > 1 - o.weeds) tuft(px, py, seed + i, hash(i, seed, 8) > 0.7);
    }
    if (o.vert) { py += 1; if (hash(i, seed, 4) < 0.4) px += hash(i, seed, 5) < 0.5 ? -1 : 1; }
    else { px += o.dx || 1; if (hash(i, seed, 4) < 0.38) py += hash(i, seed, 5) < 0.5 ? -1 : 1; }
    if (o.x0 !== undefined) px = Math.max(o.x0, Math.min(o.x1 - 1, px));
    py = Math.max(o.y0 ?? 0, Math.min((o.y1 ?? H) - 1, py));
    if (o.branch && hash(i, seed, 6) > 0.93) crack(px, py, (len - i) >> 1, seed + 17 + i, { ...o, branch: false, vert: !o.vert, dx: 1 });
  }
}
// oljefläck / smutsfläck
function stain(cx, cy, rx, ry, a, col = 0x1c1e24) {
  ellipse(cx, cy, rx, ry, (x, y, t) => {
    const q = (1 - t) * 1.6 + (hash(x, y, 91) - 0.5) * 0.5;
    if (q > 0.2) blend(x, y, col, Math.min(1, q) * a);
  });
}
// krackelering (krokodilsprickor): ett nät av sprickor inom en ellips
function alligator(cx, cy, rx, ry, seed) {
  ellipse(cx, cy, rx, ry, (x, y, t) => {
    const v = cellAt(x, y, 4.6, 3.4, seed), e = v.d2 - v.d1;
    if (e < 0.09 && hash(x, y, seed + 1) < 1.25 - t) { shade(x, y, 0.58); if (hash(x, y, seed + 2) > 0.7) blend(x, y + 1, 0xffffff, 0.06); }
    else if (t < 0.7 && hash(v.id, 3, seed) > 0.8) put(x, y, mix(get(x, y), 0x8a857a, 0.12));           // lösa bitar
  });
}
// oregelbunden lagning (en klick ny asfalt med tätad, ojämn kant)
function blobPatch(cx, cy, rx, ry, tone, seed, ya = 0, yb = H) {
  ellipse(cx, cy, rx * 1.2, ry * 1.2, (x, y, t) => {
    if (y < ya || y >= yb) return;
    const e = t + (vnoise(x, y, 4, seed) - 0.5) * 0.5;
    if (e > 1) return;
    put(x, y, e > 0.88 ? (hash(x, y, seed + 1) > 0.3 ? 0x23242a : mul(get(x, y), 0.7)) : asphaltW(x, y, tone, true, 0.2));
  });
}
// potthål: trasig kant, grus i botten, belyst bortre innervägg (ljuset från sydväst)
const POTHOLES = [];
function pothole(cx, cy, rx, ry, seed) {
  const x0 = Math.floor(cx - rx * 1.5), x1 = Math.ceil(cx + rx * 1.5), y0 = Math.floor(cy - ry * 1.6), y1 = Math.ceil(cy + ry * 1.6);
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const t = Math.hypot((x + 0.5 - cx) / rx, (y + 0.5 - cy) / ry) + (vnoise(x, y, 2.2, seed) - 0.5) * 0.45;
    if (t < 1) {
      const dy = (y + 0.5 - cy) / ry;
      let c = mix(0x3a3834, 0x2a2926, clamp01(dy * 0.5 + 0.5));
      if (dy < -0.45 && t > 0.62) c = mix(0x6e6a62, 0x585650, hash(x, y, seed + 1));                // bortre väggen i ljuset
      else if (dy > 0.3 && t > 0.7) c = 0x1e1d1c;                                                    // närmaste väggen i skugga
      const h = hash(x, y, seed + 2);
      if (h > 0.8) c = mix(0x8a857a, 0x6a665e, hash(x, y, seed + 3));                                  // grus och asfaltbitar i botten
      else if (h < 0.08) c = 0x181716;
      put(x, y, c);
    } else if (t < 1.35) {
      const q = (1.35 - t) / 0.35;
      if (hash(x, y, seed + 4) < q * 0.8) put(x, y, hash(x, y, seed + 5) > 0.5 ? mix(get(x, y), 0x7c786e, 0.4) : mul(get(x, y), 0.72)); // söndersmulad kant
    }
  }
  POTHOLES.push({ x: cx, y: cy, rx: rx * 0.85, ry: ry * 0.8 });
}
// dagvattengaller: järnram och spalter, lite rost
function grate(x0, y0, w, h, vertical = true, rust = 0.16) {
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) {
    const lx = x - x0, ly = y - y0, edge = lx === 0 || ly === 0 || lx === w - 1 || ly === h - 1;
    let c;
    if (edge) c = ly === 0 ? 0x8a8984 : lx === 0 ? 0x6e6d68 : 0x3a3935;
    else c = (vertical ? lx % 2 === 0 : ly % 2 === 0) ? 0x121316 : (ly === 1 || lx === 1 ? 0x6e6d6a : 0x55544f);
    if (hash(x, y, 77) > 1 - rust) c = mix(c, 0x8a5230, 0.4 + rust);
    put(x, y, c);
  }
}
// brunnslock (runt, sett snett ovanifrån = ellips)
function manhole(cx, cy, rx, ry, rust = 0) {
  for (let y = Math.floor(cy - ry - 1); y <= cy + ry + 1; y++) for (let x = Math.floor(cx - rx - 1); x <= cx + rx + 1; x++) {
    const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry, t = Math.hypot(dx, dy);
    if (t > 1.2) continue;
    let c;
    if (t > 1) c = 0x34332f;                                                            // spalten
    else if (t > 0.76) c = dy < -0.25 ? 0xa8a49c : dy > 0.3 ? 0x5a5852 : 0x7e7a72;      // ramen
    else if (t > 0.42 && t < 0.56) c = 0x4c4a45;                                          // inre ring
    else {
      c = (x & 1) === 0 && (y & 1) === 0 ? 0x8c887f : 0x66625b;                            // halkskydd
      if (dx + dy < -0.5) c = mix(c, 0xffffff, 0.14);
      if (vnoise(x, y, 3, 88) > 0.66 - rust * 0.3) c = mix(c, 0x8a5a36, 0.4 + rust * 0.2); // rost
    }
    put(x, y, c);
  }
}
// fyrkantigt gjutjärnslock i trottoaren (ljus ram, rutmönster, skugga nere/höger)
function lid(x0, y0, w, h) {
  for (let y = y0 - 1; y <= y0 + h; y++) for (let x = x0 - 1; x <= x0 + w; x++) {
    const lx = x - x0, ly = y - y0;
    let c;
    if (lx < 0 || ly < 0) c = mul(get(x, y), 0.8);                                            // fog runt ramen
    else if (lx === w || ly === h) c = 0x4e4b46;                                               // skugga
    else if (ly === 0) c = 0xc2beb4;
    else if (lx === 0) c = 0xa6a298;
    else if (lx === w - 1 || ly === h - 1) c = 0x6e6a63;
    else c = (lx + ly) & 1 ? 0x7c786f : 0x908b82;
    if (lx > 0 && ly > 0 && lx < w - 1 && ly < h - 1 && vnoise(x, y, 3, 89) > 0.7) c = mix(c, 0x8a5a36, 0.35);
    put(x, y, c);
  }
}
// liten rund ventilkåpa (vatten) med ljus kant
function valve(cx, cy) {
  put(cx, cy - 1, 0x9c988e); put(cx + 1, cy - 1, 0xb2aea4);
  put(cx - 1, cy, 0x7a766e); put(cx, cy, 0x4a5a78); put(cx + 1, cy, 0x3e4c66); put(cx + 2, cy, 0x6a665e);
  put(cx, cy + 1, 0x55524c); put(cx + 1, cy + 1, 0x55524c);
}
// voronoiceller på ett skakat rutnät (kullersten, krackelering)
const CB = { d1: 0, d2: 0, id: 0, px: 0, py: 0 };
function cellAt(x, y, sx, sy, seed) {
  const gx = Math.floor(x / sx), gy = Math.floor(y / sy);
  CB.d1 = CB.d2 = 1e9;
  for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
    const cx = gx + i, cy = gy + j;
    const fx = (cx + 0.18 + hash(cx, cy, seed) * 0.64) * sx, fy = (cy + 0.18 + hash(cx, cy, seed + 1) * 0.64) * sy;
    const d = Math.hypot((x + 0.5 - fx) / sx, (y + 0.5 - fy) / sy);
    if (d < CB.d1) { CB.d2 = CB.d1; CB.d1 = d; CB.id = cx * 7919 + cy; CB.px = fx; CB.py = fy; } else if (d < CB.d2) CB.d2 = d;
  }
  return CB;
}

// ---------- pölar ----------
// Varje pöl målas torr i marken (en mörk, siltig fläck där vattnet brukar stå) och
// fylls av groundLive när det är blött (env.weather.wet). Delas med regnringarna.
const PUDDLES = [
  // bakgatan
  [95, 30, 7, 2.2], [455, 15, 9, 2.4], [838, 31, 6, 2], [1190, 17, 8, 2.4], [1586, 29, 10, 2.6],
  // gränderna
  [151, 170, 6, 2], [522, 144, 7, 2.4], [675, 162, 6, 2], [1066, 150, 7, 2.2], [1438, 166, 6, 2],
  // tvärgatorna
  [292, 122, 7, 2.4], [944, 92, 6, 2], [1234, 150, 8, 2.4],
  // rännstenarna
  [382, 273, 12, 1.8], [1046, 273, 10, 1.8], [822, 219, 9, 1.6], [1392, 219, 11, 1.6],
  // trottoaren och promenaden
  [1592, 292, 6, 2], [470, 340, 8, 2.4], [1386, 341, 6, 2], [1640, 339, 5, 2],
  // v2 – parkgången, gränderna i söder, Södergatans rännstenar, bortre trottoaren
  [390, 476, 8, 2.2], [1120, 482, 7, 2], [1520, 474, 9, 2.4], [160, 604, 5, 2], [1588, 580, 5, 2], [1434, 560, 5, 1.8],
  [520, 727, 12, 1.8], [1180, 673, 10, 1.6], [960, 727, 9, 1.6], [300, 746, 6, 2], [1380, 748, 7, 2],
  // downtown (v3): få – finanskvarteret är välskött; i rännstenarna och på bakgatan
  [1830, 30, 8, 2.2], [2250, 16, 7, 2], [1990, 273, 10, 1.6], [2330, 219, 9, 1.6], [2160, 727, 11, 1.8], [1900, 476, 7, 2],
  // förorten (v2-x + SDX)
  ...[[1860, 28, 11, 2.6], [2140, 17, 8, 2.4], [2470, 30, 12, 2.8], [2640, 20, 7, 2.2], [1950, 150, 5, 2], [2410, 120, 6, 2],
    [2262, 110, 8, 2.4], [2130, 273, 13, 1.8], [2520, 219, 12, 1.6], [2330, 727, 14, 1.8], [2600, 673, 11, 1.6],
    [1860, 390, 14, 3], [1950, 430, 9, 2.4], [1800, 346, 8, 2], [2080, 476, 10, 2.4], [2560, 480, 8, 2.2],
    [2566, 392, 12, 3.2], [2460, 430, 9, 2.6], [2090, 418, 6, 2], [2670, 540, 10, 2.6], [2650, 600, 8, 2.2],
    [2330, 612, 9, 2.4], [2262, 560, 6, 2], [1942, 590, 5, 2], [2070, 540, 5, 1.8], [1760, 420, 4, 1.8],
    [1900, 292, 7, 2], [2240, 746, 9, 2.2], [2620, 750, 8, 2]].map(([x, y, rx, ry]) => [x + SDX, y, rx, ry]),
  // Linnéstaden (v4): få – i rännstenarna, på parkgången och i en gränd
  [-1010, 273, 10, 1.8], [-330, 219, 9, 1.6], [-700, 476, 8, 2.2], [-150, 727, 11, 1.8], [-1060, 30, 7, 2.2], [-440, 160, 5, 2],
].map(([x, y, rx, ry], i) => ({ x, y, rx, ry, i }));

// torr pöl: silt och damm i en svacka (ljus kant där smutsvattnet torkat in)
function paintDryPuddles() {
  for (const p of PUDDLES) ellipse(p.x, p.y, p.rx * 1.15, p.ry * 1.2, (x, y, t) => {
    const n = t + (vnoise(x, y, 3, 700 + p.i) - 0.5) * 0.4;
    if (n < 0.8) blend(x, y, 0x2c2a26, 0.14);
    else if (n < 1) blend(x, y, 0xb8ac94, 0.16 * (hash(x, y, 702) > 0.35 ? 1 : 0));
  });
}

// =====================================================================
// BAKGATAN (y 0–40) + bakgårdarna bakom husen
// =====================================================================
const COB = [0xa0988a, 0x938d84, 0xa99e8c, 0x978e8f, 0xafa696, 0x8c867c, 0xa39988, 0x9e9480, 0xa8948a];
// kullersten: oregelbundna, rundade stenar (voronoiceller på ett skakat rutnät)
const CBX = 6.2, CBY = 4.4;
function cobble(x, y) {
  const v = cellAt(x, y, CBX, CBY, 720), edge = v.d2 - v.d1;
  if (edge < 0.1) {                                                                            // fog: sand, jord och mossa
    if (fbm(x, y, 16, 14) > 0.6 && hash(x, y, 15) > 0.3) return hash(x, y, 16) > 0.5 ? 0x6a7a42 : 0x56663a;
    return mul(0x5e574d, 0.9 + hash(x, y, 17) * 0.2);
  }
  let c = mul(COB[(hash(v.id, 1, 12) * COB.length) | 0], 0.9 + hash(v.id, 2, 13) * 0.18);
  const lx = (x + 0.5 - v.px) / CBX, ly = (y + 0.5 - v.py) / CBY, lit = -(lx * 0.8 + ly * 1.3);
  if (lit > 0.22 && edge > 0.2) c = mix(c, 0xffffff, 0.24);                                  // blank ovansida
  else if (lit < -0.28) c = mul(c, 0.76);                                                      // skuggsida
  else if (edge < 0.2) c = mul(c, 0.88);                                                       // rundad kant
  return grainy(c, x, y, 0.05);
}
function paintBack() {
  // centrum: kullersten med en mittränna av släta hällar
  for (let y = 8; y < TOP; y++) for (let x = X0; x < XS; x++) put(x, y, cobble(x, y));        // (v4: ända ut genom Linnéstaden)
  for (let x = X0; x < XS; x++) {
    shade(x, 21, 0.78);
    for (let y = 22; y < 25; y++) {
      const j = mod(x + 3, 11) === 0;
      put(x, y, j ? 0x57514a : granite(x, y, y === 22 ? 0xa7a197 : y === 23 ? 0x948e85 : 0x847e76));
    }
    if (vnoise(x, 0, 30, 18) > 0.55) blend(x, 23, 0x4a5664, 0.45);                   // vattenstrimma
  }
  for (let x = 128; x < XS - 10; x += 262) grate(x, 22, 7, 3);
  for (let x = X0 + 140; x < -10; x += 262) grate(x, 22, 7, 3);
  // förorten: sprucken, lappad asfalt med en betongränna, kullerstenen tar slut i en ojämn skarv
  for (let y = 8; y < TOP; y++) for (let x = XS - 30; x < W; x++) {
    const edge = x - XS + (vnoise(x, y, 5, 730) - 0.5) * 22;
    if (edge < 0) continue;
    let c = asphaltW(x, y, 0.02, false, 1);
    if (y < 11 || y >= TOP - 3) c = mul(c, 0.9);                                              // smuts längs kanterna
    put(x, y, c);
  }
  for (let x = XS; x < W; x++) for (let y = 22; y < 25; y++) {
    let c = concrete(x, y, 13, 40, 731, 1);
    if (y === 22) c = mix(c, 0xffffff, 0.08); else if (y === 24) c = mul(c, 0.82);
    if (y === 23 && vnoise(x, 0, 20, 732) > 0.5) c = mix(c, 0x3a4450, 0.4);                    // unket vatten i rännan
    put(x, y, c);
  }
  for (let i = 0; i < 26; i++) crack(XS + hash(i, 1, 733) * (W - XS), 10 + hash(i, 2, 733) * 26, 8 + hash(i, 3, 733) * 22, 734 + i, { sealed: i % 3 === 0, branch: i % 4 === 0, dx: hash(i, 4, 733) > 0.5 ? 1 : -1, y0: 9, y1: TOP - 1, weeds: 0.08 });
  for (const [px, pw, tone] of [[1800, 40, -0.12], [2010, 26, 0.08], [2190, 58, -0.14], [2350, 30, -0.1], [2560, 46, 0.07], [2690, 24, -0.12]].map(([a, ...r]) => [a + SDX, ...r])) {
    for (let y = 11; y < 34; y++) for (let x = px; x < px + pw; x++) {
      if (y >= 22 && y < 25) continue;
      const e = x === px || x === px + pw - 1 || y === 11 || y === 33;
      put(x, y, e && hash(x, y, 735) > 0.25 ? 0x25262b : asphaltW(x, y, tone, false, 0.6));
    }
  }
  for (const [cx, cy, rx, ry] of [[1880, 30, 5, 2.2], [2120, 14, 4, 1.8], [2300, 31, 6, 2.4], [2500, 15, 4, 1.8], [2630, 30, 5, 2]]) pothole(cx + SDX, cy, rx, ry, 736 + cx);
  for (let x = XS + 70; x < W - 10; x += 230) grate(x, 22, 7, 3, true, 0.45);
  for (let i = 0; i < 20; i++) stain(XS + hash(i, 1, 737) * (W - XS), 12 + hash(i, 2, 737) * 22, 3 + hash(i, 3, 737) * 6, 1.4 + hash(i, 4, 737) * 1.6, 0.3);
  // ogräs längs muren och husens bakväggar
  for (let x = XS; x < W; x++) { if (hash(x, 9, 738) > 0.9) tuft(x, 10, 738 + x, hash(x, 9, 739) > 0.6); if (hash(x, 38, 738) > 0.93) tuft(x, TOP - 1, 740 + x); }
  // bakgårdarna bakom husen: packad jord och grus med tuvor, i husens skugga
  for (const b of HOUSES_N) for (let y = TOP; y < BASE; y++) for (let x = b.x; x < b.x + b.w; x++) {
    let c = grainy(mix(0x7c705f, 0x8e826c, vnoise(x, y, 7, 30)), x, y, 0.08);
    const h = hash(x, y, 31);
    if (h > 0.93) c = mix(0xb0a48e, 0x9a9488, hash(x, y, 32));
    else if (hash(x, y - 1, 31) > 0.93) c = mul(c, 0.78);
    else if (h < 0.04) c = mul(c, 0.8);
    if (vnoise(x, y, 11, 33) > 0.6 && hash(x, y, 34) > 0.45) c = hash(x, y, 35) > 0.5 ? 0x5e7a3c : 0x4a6632;
    if (y === TOP) c = 0x3e3932;                                                              // husväggens fot
    put(x, y, mul(c, y === TOP + 1 ? 0.6 : 0.72));
    SH[y * GW + x - X0] = 1;
  }
  // skräp och löv mellan stenarna (centrum) – mycket mer i förorten
  for (let i = 0; i < 90; i++) {
    const x = (hash(i, 1, 19) * W1) | 0, y = 10 + ((hash(i, 2, 19) * 28) | 0), k = hash(i, 3, 19);
    if (k < 0.5) { put(x, y, 0x9a6a2a); put(x + 1, y, 0x7a5220); }                        // brunt löv
    else if (k < 0.7) put(x, y, 0xd8d2c4);                                                  // papperslapp
    else if (k < 0.8) { put(x, y, 0x3a6a8a); put(x + 1, y, 0x2a4a6a); }                     // kapsyl/burk
    else put(x, y, 0x2a2622);                                                                // fläck
  }
  scatter([XS, 10, W, 13], 40, 741); scatter([XS, TOP - 5, W, TOP - 1], 36, 745); scatter([XS, 13, W, TOP - 5], 24, 746);
  // marktaggar borttagna (Carl: klotter bara på byggnader och väggar)
  paintBoundary();
  west(paintBoundaryWest);
}
// Linnéstaden: smidesstaket framför trädgårdar, häckar, tegelmurar med murgröna och falurött plank
function paintBoundaryWest() {
  const KINDS = ['staket', 'hack', 'mur', 'staket', 'plank', 'hack'];
  const PAINT = { hack: hedge, plank, mur: brickWall, staket: railing };
  let x = X0, i = 0, prev = '';
  while (x < 0) {
    const len = 90 + ((hash(i, 1, 57) * 110) | 0);
    let kind = KINDS[(hash(i, 2, 57) * KINDS.length) | 0];
    if (kind === prev) kind = KINDS[(KINDS.indexOf(kind) + 1) % KINDS.length];
    const x1 = Math.min(0, x + len);
    PAINT[kind](x, x1, 40 + i);
    if (x > X0) post(x - 1, false);
    prev = kind; x = x1; i++;
  }
}

// y 0–8: häck, plank, mur och staket mot kvarteret bakom – i förorten betongmur,
// trasigt nätstängsel, grått klotterplank och vildvuxet sly
function paintBoundary() {
  const KINDS = ['hack', 'plank', 'mur', 'staket'], KX = ['betong', 'nat', 'plank2', 'sly'];
  const PAINT = { hack: hedge, plank, mur: brickWall, staket: railing, betong: concreteWall, nat: chainLink, plank2: greyPlank, sly: scrub };
  let x = 0, i = 0, prev = '';
  while (x < W) {
    const sub = x >= XS - 20;
    const len = (sub ? 90 : 110) + ((hash(i, 1, 51) * (sub ? 120 : 150)) | 0);
    const K = sub ? KX : KINDS;
    let kind = K[(hash(i, 2, 51) * K.length) | 0];
    if (kind === prev) kind = K[(K.indexOf(kind) + 1) % K.length];
    let x1 = Math.min(W, x + len);
    if (!sub && x1 > XS - 20) x1 = XS - 20;
    PAINT[kind](x, x1, i);
    if (x > 0) post(x - 1, sub);
    prev = kind; x = x1; i++;
  }
}
function post(x0, sub) {
  for (let y = 0; y < 9; y++) for (let x = x0; x < x0 + 3; x++) {
    let c = y === 0 ? 0xd0cbc0 : y === 1 ? 0xb8b2a6 : x === x0 ? 0xaaa498 : x === x0 + 2 ? 0x77726a : 0x958f85;
    if (y === 8) c = 0x5a554e;
    if (sub) c = grime(c, x, y, 1, 52);
    put(x, y, granite(x, y, c));
  }
  for (let x = x0 - 1; x < x0 + 5; x++) shade(x, 9, 0.75);
}
function hedge(x0, x1, s) {
  for (let x = x0; x < x1; x++) {
    const bot = 7 + Math.round(vnoise(x, 0, 5, 60 + s) * 2);                              // 7–9
    for (let y = 0; y < bot; y++) {
      const emb = vnoise(x, y, 2.5, 63) - vnoise(x + 1, y + 1, 2.5, 63);                    // löv-klumpar
      const n = fbm(x, y, 6, 61) * 0.6 + emb * 1.4 + (hash(x, y, 62) - 0.5) * 0.25 - y * 0.03 + 0.2;
      let c = n > 0.66 ? 0x80bc52 : n > 0.52 ? 0x5e9a40 : n > 0.38 ? 0x467f35 : n > 0.26 ? 0x356a2c : 0x274f24;
      if (y >= bot - 1) c = mul(c, 0.7);
      put(x, y, c);
    }
    if (hash(x, 3, 64) > 0.985) put(x, 2 + ((hash(x, 4, 64) * 4) | 0), 0xf4eef0);           // hagtornsblomma
    for (let y = bot; y < bot + 3; y++) if (bayer(x, y) < (bot + 3 - y) / 3.2) shade(x, y, 0.72);
  }
}
function plank(x0, x1, s) {
  const g0 = x0 + (((x1 - x0) >> 1) & ~3) - 8, g1 = g0 + 16;                               // grind mitt på
  for (let x = x0; x < x1; x++) {
    const bx = (x - x0) % 4, board = ((x - x0) / 4) | 0, f = hash(board, s, 71);
    const gate = x >= g0 && x < g1;
    let base = f > 0.88 ? 0x8a8278 : mix(0x93311f, 0xb05a48, f * 0.55);                     // falurött, en och annan grå bräda
    if (gate) base = mix(0x7a2a1c, 0x93311f, f);
    put(x, 0, bx === 1 ? mix(base, 0xffffff, 0.2) : 0x2c4a28);                              // spetsade bräder, grönska bakom
    for (let y = 1; y < 8; y++) {
      let c = base;
      if (bx === 3) c = 0x2a1810;
      else {
        if (bx === 0) c = mix(c, 0xffffff, 0.14);
        if (bx === 2) c = mul(c, 0.84);
        c = mul(c, 0.9 + hash(x, y >> 1, 73) * 0.16);                                       // ådring
        if (y === 7) c = mul(c, 0.72);
        if (y === 1) c = mix(c, 0xffffff, 0.16);
        if (hash(x, y, 74) > 0.97) c = mul(c, 0.6);                                          // kvist
      }
      put(x, y, c);
    }
    shade(x, 8, 0.7); if (bayer(x, 9) < 0.5) shade(x, 9, 0.85);
  }
  // grinden: ram, snedsträva och handtag
  for (let x = g0; x < g1; x++) { put(x, 1, 0x5a1c12); put(x, 7, 0x4a160e); }
  for (let y = 1; y < 8; y++) { put(g0, y, 0x3a120a); put(g1 - 1, y, 0x3a120a); }
  for (let i = 0; i < 12; i++) put(g0 + 2 + i, 6 - Math.floor(i / 2.4), 0x6a2416);
  put(g1 - 4, 4, 0xd8c070); put(g1 - 4, 5, 0x8a7030);
}
function brickWall(x0, x1, s) {
  for (let x = x0; x < x1; x++) {
    for (let y = 0; y < 8; y++) {
      let c;
      if (y === 0) c = granite(x, y, 0xcbc5b9);
      else if (y === 1) c = granite(x, y, 0xa29c90);
      else if (y === 2) c = 0x54403a;
      else {
        const row = ((y - 3) / 3) | 0, ly = (y - 3) % 3, off = (row & 1) * 3;
        if (ly === 2 || (x + off) % 6 === 0) c = mix(0xb8ac98, 0x8a8070, hash(x, y, 81) * 0.5);  // murbruk
        else {
          const br = hash(((x + off) / 6) | 0, row, 82 + s);
          c = br > 0.9 ? 0x6a3024 : mix(0x9e4a34, 0xb4604a, br);
          if (ly === 0) c = mix(c, 0xffffff, 0.1);
          c = grainy(c, x, y, 0.07);
        }
      }
      put(x, y, c);
    }
    // murgröna som klättrar
    if (vnoise(x, 0, 9, 83 + s) > 0.62) for (let y = 7; y > 2 + hash(x, 1, 84) * 4; y--) if (hash(x, y, 85) > 0.35) put(x, y, hash(x, y, 86) > 0.5 ? 0x3e7a34 : 0x2e5e2a);
    shade(x, 8, 0.72); if (bayer(x, 9) < 0.5) shade(x, 9, 0.85);
  }
}
function railing(x0, x1, s) {
  for (let x = x0; x < x1; x++) {
    // trädgården bakom staketet
    for (let y = 0; y < 6; y++) {
      const n = fbm(x, y, 5, 90 + s) + (hash(x, y, 91) - 0.5) * 0.3;
      let c = n > 0.62 ? 0x6aa648 : n > 0.45 ? 0x4c8a3a : 0x356a2e;
      if (hash(x, y, 92) > 0.965) c = [0xe85a6a, 0xf4d23c, 0xf0f0f4, 0xb07ad8][(hash(x, y, 93) * 4) | 0]; // rabatt
      put(x, y, c);
    }
    // stenfot
    put(x, 6, granite(x, 6, 0xcdc7bb)); put(x, 7, granite(x, 7, 0x9c968c));
    // smidesspjälor och överliggare
    const lx = (x - x0) % 3;
    if (lx === 1) { put(x, 0, 0x4a4c54); for (let y = 1; y < 6; y++) put(x, y, y === 1 ? 0x3a3c44 : 0x1e2026); }
    put(x, 1, lx === 1 ? 0x3a3c44 : 0x24262c); put(x, 4, 0x24262c);
    shade(x, 8, 0.72); if (bayer(x, 9) < 0.5) shade(x, 9, 0.85);
  }
}
// förortens gränser
const SPRAY = [0xe8443a, 0x3a9bff, 0xf4d23c, 0x5ad35a, 0xe070c0, 0xf4f1ea, 0xff8a2a];
function concreteWall(x0, x1, s) {
  for (let x = x0; x < x1; x++) {
    const px = (x - x0) % 30;
    for (let y = 0; y < 8; y++) {
      let c = y === 0 ? 0xb4b0a6 : y === 7 ? 0x6e6a62 : mix(0x9a968c, 0x8a867e, vnoise(x, y, 6, 110 + s));
      if (px === 29) c = 0x55524c;                                                          // skarv mellan elementen
      else if (px === 0) c = mix(c, 0xffffff, 0.1);
      if (y > 3 && vnoise(x, y, 4, 111) > 0.62) c = mix(c, 0x5a4a34, 0.3);                  // rostränder från armeringen
      if (y >= 5 && hash(x, y, 112) > 0.6 && vnoise(x, 0, 7, 113) > 0.5) c = mix(c, 0x4a5a34, 0.4); // mossa nertill
      put(x, y, grainy(c, x, y, 0.06));
    }
    shade(x, 8, 0.72); if (bayer(x, 9) < 0.5) shade(x, 9, 0.85);
  }
  // taggar på muren
  for (let k = 0; k < (x1 - x0) / 34; k++) {
    const tx = x0 + 4 + ((hash(k, 1, 114 + s) * (x1 - x0 - 20)) | 0), col = SPRAY[(hash(k, 2, 114 + s) * SPRAY.length) | 0];
    tag(tx, 1 + ((hash(k, 3, 114 + s) * 2) | 0), ['BTG', 'ZOK', 'NEJ', 'KAOS', 'PXL', 'YO', 'ACAB'.slice(0, 3), 'LOL'][(hash(k, 4, 114 + s) * 8) | 0], col, 115 + k);
  }
}
function chainLink(x0, x1, s) {
  for (let x = x0; x < x1; x++) {
    for (let y = 0; y < 8; y++) {
      // torrt gräs och sly bakom
      const n = fbm(x, y, 5, 120 + s) + (hash(x, y, 121) - 0.5) * 0.3;
      let c = n > 0.6 ? 0x8a8a4a : n > 0.44 ? 0x6a7038 : 0x4a5430;
      // nätet: diagonala trådar
      const hole = vnoise(x, y, 5, 122 + s) > 0.74;
      if (!hole && ((x + y) % 4 === 0 || (x - y + 64) % 4 === 0)) c = hash(x, y, 123) > 0.8 ? 0x8a5a36 : 0x9a9c9e;
      if (y === 0) c = 0x6a6c70;
      put(x, y, c);
    }
    if ((x - x0) % 24 === 0) for (let y = 0; y < 8; y++) put(x, y, y === 0 ? 0x9a9ca0 : 0x5a5c60);
    if (hash(x, 7, 124) > 0.8) tuft(x, 8, 125 + x, hash(x, 7, 126) > 0.6);
    shade(x, 8, 0.8);
  }
}
function greyPlank(x0, x1, s) {
  for (let x = x0; x < x1; x++) {
    const bx = (x - x0) % 5, board = ((x - x0) / 5) | 0, f = hash(board, s, 130);
    const gone = f > 0.9;                                                                   // bräda saknas
    for (let y = 0; y < 8; y++) {
      let c;
      if (gone) c = y < 6 ? mix(0x3a4a2a, 0x2a3420, hash(x, y, 131)) : 0x2a2a24;
      else if (bx === 4) c = 0x2a2620;
      else {
        c = mix(0x8a847a, 0x6e6a62, f);
        if (bx === 0) c = mix(c, 0xffffff, 0.1); if (bx === 3) c = mul(c, 0.84);
        c = mul(c, 0.9 + hash(x, y >> 1, 132) * 0.16);
        if (y === 7) c = mul(c, 0.7);
      }
      put(x, y, c);
    }
    shade(x, 8, 0.72); if (bayer(x, 9) < 0.5) shade(x, 9, 0.85);
  }
}
function scrub(x0, x1, s) {
  for (let x = x0; x < x1; x++) {
    const bot = 6 + Math.round(vnoise(x, 0, 4, 140 + s) * 4);
    for (let y = 0; y < bot; y++) {
      const n = fbm(x, y, 5, 141 + s) * 0.7 + (hash(x, y, 142) - 0.5) * 0.4 - y * 0.02;
      let c = n > 0.6 ? 0x7a8a42 : n > 0.46 ? 0x5a6a32 : n > 0.34 ? 0x4a5428 : 0x6a5a3a;   // grönt, torrt och brunt sly
      if (hash(x, y, 143) > 0.97) c = 0x2a1c14;                                             // kvistar
      put(x, y, c);
    }
    if (hash(x, 2, 144) > 0.985) { put(x, 3, 0xe8e4dc); put(x + 1, 3, 0xd0ccc4); }           // påse som fastnat
    for (let y = bot; y < bot + 2; y++) if (bayer(x, y) < 0.5) shade(x, y, 0.78);
  }
}

// husens skuggor snett bakåt över bakgatan (norra raden) och parkgången (södra raden)
function backShadows(houses, top, row) {
  for (const b of houses) {
    const L = 9 + ((b.h * 0.05) | 0);
    const gap = (row === 'n' ? ROW_N : ROW_S).find((s) => s.x0 === b.x + b.w);
    const cap = gap ? Math.min((gap.x1 - gap.x0) * 0.7, 31) : 12;
    for (let y = Math.max(8, top - L - 2); y < top; y++) {
      const up = top - y, xs = b.x + up * SUN_DX, xe = b.x + b.w + cap;
      for (let x = Math.floor(xs) - 2; x < xe + 2; x++) {
        let q = Math.min(x + 0.5 - xs, xe - x - 0.5) / 2.5 + 0.5;
        q = Math.min(q, (L - up) / 3 + 0.5);
        if (q >= 1 || (q > 0 && bayer(x, y) < q)) shadow(x, y, 0.76);
      }
    }
  }
}
// skuggan från huset till vänster ner i en gränd/tvärgata (snett avskuren mot trottoaren)
function gapShadow(g, top = TOP, base = BASE) {
  const w = g.x1 - g.x0;
  const houses = g.row === 's' ? HOUSES_S : HOUSES_N;
  if (!houses.some((b) => b.x + b.w === g.x0)) return;                                     // inget hus till vänster
  for (let y = top; y < base; y++) {
    const dmax = Math.min(w * 0.7, 2 + (base - y) * SUN_DX);
    for (let x = g.x0; x < g.x1; x++) {
      const q = (dmax - (x - g.x0 + 0.5)) / 2.5 + 0.5;
      if (q >= 1 || (q > 0 && bayer(x, y) < q)) shadow(x, y);
    }
  }
}

// =====================================================================
// GRÄNDERNA – sliten stenläggning, brunn, pölar, mossa (förorten: trasig och skräpig)
// =====================================================================
const FLAG = [0x877f73, 0x7b756c, 0x90887a, 0x746f68, 0x8a7f72, 0x80796e];
function paintAlley(g, top = TOP, base = BASE) {
  const { x0, x1 } = g, w = x1 - x0, seed = 200 + x0 + (g.row === 's' ? 5000 : 0), edge = g.kind === 'edge';
  const worn = wornAt(x0 + (w >> 1), base - 10);
  const at = rows(x0, x1, top, base - 2, { h: [5, 7], w: [6, 11], seed });
  stones(at, x0, x1, top, base - 2, (s, x, y) => {
    const h = hash(s.r, s.k, seed + 1);
    if (h > 0.94 - worn * 0.2) return -1;                                                    // sten saknas – jord och grus
    let c = mul(FLAG[(hash(s.k, s.r, seed + 2) * FLAG.length) | 0], 0.86 + hash(s.r, s.k, seed + 3) * 0.2);
    if (worn > 0.5 && hash(s.k, s.r, seed + 7) > 0.7) c = mul(c, 0.84);                      // sjunkna, fuktiga hällar
    return grime(c, x, y, worn * 0.8, seed);
  }, {
    hi: 0.12, lo: 0.84, grain: 0.07,
    hole: (x, y) => (worn > 0.5 && vnoise(x, y, 6, seed + 8) > 0.62 ? asphaltW(x, y, -0.08, false, 0.5) : dirt(x, y)), // lagat med asfalt
    joint: (x, y) => {
      const e = Math.min(x - x0, x1 - 1 - x);
      if ((e < 5 || worn > 0.5) && hash(x, y, seed + 4) > 0.5 - worn * 0.2) return hash(x, y, seed + 5) > 0.5 ? 0x527c36 : 0x3e6a2c; // ogräs i fogarna
      return mul(0x4e4840, 0.9 + hash(x, y, 8) * 0.2);
    },
  });
  // fuktig, mossig kant längs husväggarna
  for (let y = top; y < base - 2; y++) for (const x of [x0, x1 - 1]) {
    const m = vnoise(x, y, 6, seed + 6);
    put(x, y, m > 0.55 ? mix(0x3c4a2c, 0x5a6c3c, hash(x, y, 1)) : mul(0x4a443c, 0.85 + hash(x, y, 2) * 0.2));
    const xi = x === x0 ? x + 1 : x - 1;
    if (m > 0.6) blend(xi, y, 0x4a6034, 0.6); else shade(xi, y, 0.86);
  }
  // tröskel mot trottoaren
  for (let x = x0; x < x1; x++) { put(x, base - 2, granite(x, base - 2, 0xaaa59b)); put(x, base - 1, granite(x, base - 1, 0x86817a)); }
  // sprickor i hällarna
  for (let i = 0; i < 4 + worn * 6; i++) crack(x0 + 3 + hash(i, 1, seed) * (w - 6), top + 8 + hash(i, 2, seed) * (base - top - 20), 5 + hash(i, 3, seed) * 8, seed + i, { vert: true, x0: x0 + 1, x1: x1 - 1, y0: top, y1: base - 3, weeds: worn * 0.1 });
  if (!edge && w >= 20) {
    // dagvattenbrunn mitt i gränden, fuktig ring och rostrand
    const cx = x0 + (w >> 1), dy = top + 64 + ((hash(x0, 1, 210) * 44) | 0);
    ellipse(cx, dy + 2.5, 9, 5, (x, y, t) => { if (bayer(x, y) < (1 - t) * 1.3) shade(x, y, 0.84); });
    grate(cx - 4, dy, 8, 5, true, 0.16 + worn * 0.3);
    for (let x = cx - 3; x < cx + 3; x++) for (let y = dy + 5; y < dy + 8; y++) if (hash(x, y, 211) > 0.45) blend(x, y, 0x7a4a2a, 0.3 - (y - dy - 5) * 0.08);
    stain(x0 + 7 + hash(x0, 2, 212) * 12, top + 30 + hash(x0, 3, 212) * 40, 4, 2, 0.35);
    // lite skräp
    put(x0 + 4 + ((hash(x0, 4, 213) * 18) | 0), top + 90, 0xd8d2c4);
    put(x0 + 3 + ((hash(x0, 5, 213) * 20) | 0), top + 120, 0x9a6a2a);
  }
  if (worn > 0.5) {
    scatter([x0 + 1, top + 2, x0 + 5, base - 4], 7, seed + 30); scatter([x1 - 5, top + 2, x1 - 1, base - 4], 7, seed + 31);
    stain(x0 + (w >> 1), top + 40 + hash(x0, 6, 214) * 60, 5, 3, 0.4, 0x2a2622);             // urin/olja
  }
  gapShadow(g, top, base);
}

// =====================================================================
// TVÄRGATORNA (52 bred) – asfalt, kantsten, smala trottoarer, mittlinje
// =====================================================================
const SLAB = [0xb4ac9e, 0xaca598, 0xbab3a6, 0xa9a59d, 0xb8ae9e, 0xb0a99b];
function paintSideStreet(g) {
  const { x0, x1 } = g, w = x1 - x0, seed = 500 + x0, mid = x0 + (w >> 1);
  const yA = TOP, yB = BASE - 2, worn = wornAt(mid, yB);
  for (let y = yA; y < yB; y++) for (let x = x0; x < x1; x++) {
    const lx = x - x0, rx = x1 - 1 - x;
    let c;
    if (lx <= 5 || rx <= 5) {                                                                // smal trottoar längs husen
      const s = lx <= 5 ? lx : rx, row = ((y - yA) / 8) | 0, ly = (y - yA) % 8;
      if (s === 5 || ly === 7) c = worn > 0.5 && hash(x, y, seed + 11) > 0.6 ? WEED[1] : mul(0x857d71, 0.92 + hash(x, y, 4) * 0.12);
      else if (worn > 0.5 && hash(row, lx <= 5 ? 1 : 2, seed + 12) > 0.85) c = dirt(x, y);     // platta saknas
      else {
        c = SLAB[(hash(row, lx <= 5 ? 1 : 2, seed) * SLAB.length) | 0];
        if (ly === 0) c = mix(c, 0xffffff, 0.1);
        if (ly === 6) c = mul(c, 0.9);
        c = grainy(grime(c, x, y, worn), x, y, 0.05);
        if (hash(x, y, seed + 9) > 0.93) c = mul(c, 0.86);
        if (s === 0) c = mul(c, 0.74); else if (s === 1) c = mul(c, 0.9);                      // mot husväggen
      }
    } else if (lx === 6 || rx === 6) c = granite(x, y, 0xd0cbc1);                              // kantstenens överkant
    else if (lx === 7 || rx === 7) c = granite(x, y, 0xa6a197);
    else if (lx === 8 || rx === 8) c = mul(asphaltW(x, y, -0.05, false, worn), 0.72);          // ränna vid kantstenen
    else c = asphaltW(x, y, 0, false, worn);
    if ((lx === 6 || lx === 7 || rx === 6 || rx === 7) && (y - yA) % 16 === 15) c = 0x5c5750;   // fogar i kantstenen
    put(x, y, c);
  }
  // möte med bakgatan och nedsänkt kantsten mot trottoaren (genomgående gångbana)
  for (let x = x0 + 6; x < x1 - 6; x++) { put(x, yA, granite(x, yA, 0xb2ada3)); put(x, yA + 1, granite(x, yA + 1, 0x8a857c)); }
  for (let x = x0; x < x1; x++) { put(x, yB, granite(x, yB, 0xbdb8ae)); put(x, yB + 1, granite(x, yB + 1, 0x96918a)); }
  // lagning och sprickor
  const py = yA + 20 + ((hash(seed, 1, 1) * 60) | 0);
  for (let y = py; y < py + 12; y++) for (let x = x0 + 9; x < mid - 1; x++) put(x, y, (y === py || y === py + 11 || x === x0 + 9 || x === mid - 2) ? 0x26272c : asphaltW(x, y, -0.12, false, worn * 0.5));
  for (let i = 0; i < 3 + worn * 7; i++) crack(x0 + 12 + hash(i, 1, seed) * 28, yA + 6 + hash(i, 2, seed) * 110, 18 + hash(i, 3, seed) * 20, seed + i * 7, { vert: true, sealed: i < 2, x0: x0 + 9, x1: x1 - 9, y0: yA + 2, y1: yB - 1, weeds: worn * 0.06 });
  // mittlinje
  for (let y = yA + 4; y < yB - 14; y++) if ((y - yA) % 18 < 9) for (const x of [mid - 1, mid]) mark(x, y, 0xe8e2cc, 0.08 + vnoise(x, y, 6, seed) * 0.2 + worn * 0.4);
  // hajtänder: väjningsplikt mot den genomgående gångbanan (södergående körfältet)
  for (let tx = x0 + 11; tx + 5 <= mid - 2; tx += 7) {
    for (let r = 0; r < 3; r++) for (let i = 2 - r; i <= 2 + r; i++) mark(tx + i, yB - 9 + r, 0xece6d2, 0.08 + worn * 0.4);
  }
  // brunnslock, galler och oljefläckar
  manhole(mid + 8, yA + 58 + ((hash(seed, 2, 2) * 30) | 0), 5, 2.6, worn);
  grate(x0 + 9, yA + 96, 3, 8, false, 0.16 + worn * 0.3);
  grate(x1 - 12, yA + 40, 3, 8, false, 0.16 + worn * 0.3);
  stain(mid - 9, yA + 130, 4, 2, 0.4); stain(mid + 10, yA + 30, 3, 1.6, 0.3);
  if (worn > 0.5) {
    pothole(mid - 12, yA + 76, 5, 2.4, seed + 60); pothole(mid + 9, yA + 112, 4, 2, seed + 61);
    alligator(mid + 6, yA + 20, 10, 7, seed + 62);
    for (let y = yA + 2; y < yB - 2; y++) for (const x of [x0 + 8, x1 - 9]) if (hash(x, y, seed + 63) > 0.8) tuft(x, y, seed + y, hash(x, y, seed + 64) > 0.7);
    scatter([x0 + 8, yA + 2, x0 + 12, yB - 3], 9, seed + 65); scatter([x1 - 12, yA + 2, x1 - 8, yB - 3], 9, seed + 66);
  }
  gapShadow(g);
}

// =====================================================================
// GÅGATORNA – korgflätat tegel, granitband och en mittränna (södra raden, Infarten)
// =====================================================================
const BRICK = [0x9a5a44, 0xa8644a, 0x8e5240, 0xb06e52, 0x94604e, 0x7e4a3c];
const CBRICK = [0xa8a49a, 0x9a968c, 0xb2aea4, 0x8e8a82, 0xa09a8e];                          // betongsten (förorten)
function paintPedestrian(g, top, base, style) {
  const { x0, x1 } = g, w = x1 - x0, mid = x0 + (w >> 1), seed = 800 + x0 + (g.row === 's' ? 7000 : 0);
  const worn = wornAt(mid, base - 10), pal = style === 'betong' ? CBRICK : BRICK;
  const SETT = [0xc4beb2, 0xb8b2a6, 0xcdc7bb, 0xb0aa9e];
  for (let y = top; y < base - 2; y++) for (let x = x0; x < x1; x++) {
    const lx = x - x0, rx = x1 - 1 - x;
    let c;
    if (lx < 5 || rx < 5) {                                                                  // granitband längs husen (smågatsten 4×4)
      const s = lx < 5 ? lx : rx, gx = Math.floor((s + 4) / 4), gy = Math.floor((y - top) / 4), lxx = (s + 4) % 4, ly = (y - top) % 4;
      if (lxx === 3 || ly === 3) c = worn > 0.5 && hash(x, y, seed + 1) > 0.5 ? WEED[1] : 0x6c665d;
      else {
        c = mul(SETT[(hash(gx + (lx < 5 ? 0 : 9), gy, seed + 2) * SETT.length) | 0], 0.92 + hash(gx, gy, seed + 3) * 0.14);
        if (ly === 0) c = mix(c, 0xffffff, 0.14); else if (ly === 2) c = mul(c, 0.88);
        c = grime(c, x, y, worn);
      }
      if (s === 0) c = mul(c, 0.78);
    } else if (Math.abs(x + 0.5 - (mid + 0.5)) <= 1.5 && style !== 'granit') {                // mittränna av mörk granit
      c = x === mid ? granite(x, y, 0x5a5650) : granite(x, y, 0x7e7a72);
      if (x === mid && vnoise(x, y, 14, seed + 4) > 0.55) c = mix(c, 0x3a4450, 0.4);
    } else if (style === 'granit') {                                                         // stora granithällar i halvförband
      const row = Math.floor((y - top) / 10), off = (row & 1) * 8, cx = Math.floor((x - x0 - 5 + off) / 16), lxx = mod(x - x0 - 5 + off, 16), ly = (y - top) % 10;
      if (lxx === 15 || ly === 9) c = 0x6a655d;
      else {
        const id = hash(cx, row, seed + 5);
        c = mul(id > 0.5 ? 0xbab4a8 : 0xa8a296, 0.94 + hash(cx, row, seed + 6) * 0.1);
        if (ly === 0) c = mix(c, 0xffffff, 0.12); else if (ly === 8) c = mul(c, 0.88);
        c = granite(x, y, c);
      }
    } else {                                                                                 // korgflätat tegel (8×4-stenar parvis)
      const bx = x - x0 - 5, by = y - top, cx = Math.floor(bx / 8), cy = Math.floor(by / 8), lxx = mod(bx, 8), ly = mod(by, 8);
      const horiz = ((cx + cy) & 1) === 0;
      let joint, topE, botE, id;
      if (horiz) { joint = lxx === 7 || ly === 3 || ly === 7; topE = ly === 0 || ly === 4; botE = ly === 2 || ly === 6; id = hash(cx * 2 + (ly >= 4 ? 1 : 0), cy, seed + 7); }
      else { joint = ly === 7 || lxx === 3 || lxx === 7; topE = ly === 0; botE = ly === 6; id = hash(cx, cy * 2 + (lxx >= 4 ? 1 : 0), seed + 8); }
      if (joint) c = worn > 0.4 && hash(x, y, seed + 9) > 0.55 ? (hash(x, y, seed + 10) > 0.5 ? WEED[1] : WEED[0]) : mul(0x4e4840, 0.9 + hash(x, y, 8) * 0.2);
      else if (id > 1 - worn * 0.12) c = dirt(x, y);                                          // sten saknas
      else {
        c = mul(pal[(id * pal.length) | 0], 0.9 + hash(x, y, seed + 11) * 0.1);
        if (topE) c = mix(c, 0xffffff, 0.14); else if (botE) c = mul(c, 0.84);
        c = grime(c, x, y, worn, seed);
      }
    }
    put(x, y, c);
  }
  if (style === 'granit') {
    // tvärband av mörk granit var 36:e px, en rund mässingsplatta mitt på och ett blanknött stråk
    for (let y = top + 18; y < base - 8; y += 36) for (let x = x0 + 5; x < x1 - 5; x++) for (let j = 0; j < 3; j++) {
      let c = granite(x, y + j, j === 0 ? 0x8a857c : j === 1 ? 0x6e6a62 : 0x5e5a54);
      if ((x - x0) % 8 === 7) c = 0x4a4640;
      put(x, y + j, c);
    }
    const px = mid, py = top + 72;
    ellipse(px, py, 7, 4.5, (x, y, t) => {
      let c = t > 0.8 ? 0x5a4a2a : mix(0xc8a050, 0x8a6a30, clamp01((y - py + 3) / 7));
      if (t < 0.8 && ((x - px) * (x - px) * 0.3 + (y - py) * (y - py) < 3)) c = 0xe8c870;         // stjärnan i mitten
      if (t < 0.8 && hash(x, y, seed + 20) > 0.85) c = mix(c, 0x3a7a5a, 0.4);                        // ärg
      put(x, y, c);
    });
    for (let y = top + 2; y < base - 4; y++) for (let x = mid - 9; x < mid + 9; x++) if (bayer(x, y) < 0.3 * (1 - Math.abs(x - mid) / 9)) blend(x, y, 0xffffff, 0.08);
    for (const [lx, ly] of [[x0 + 9, top + 30], [x1 - 17, top + 118]]) lid(lx, ly, 8, 5);
  }
  // galler i mittrännan och trösklar mot trottoaren/parkgången
  if (style !== 'granit') for (let y = top + 20; y < base - 16; y += 44) grate(mid - 1, y, 3, 6, false, 0.16 + worn * 0.3);
  for (let x = x0; x < x1; x++) { put(x, base - 2, granite(x, base - 2, 0xbdb8ae)); put(x, base - 1, granite(x, base - 1, 0x96918a)); put(x, top, granite(x, top, 0xb2ada3)); }
  // nötta stråk mitt i gatan, tuggummi
  for (let y = top + 2; y < base - 4; y++) for (let x = x0 + 6; x < x1 - 6; x++) {
    if (Math.abs(x - mid - 6 * Math.sin(y * 0.03)) < 7 && bayer(x, y) < 0.25) blend(x, y, 0xffffff, 0.05);
    if (hash(x, y, seed + 12) > 0.998) put(x, y, 0x6e6a64);
  }
  if (worn > 0.5) {
    // lagat med asfalt, sprickor, skräp och en tagg
    for (let k = 0; k < 3; k++) {
      const px = x0 + 8 + ((hash(k, 1, seed + 13) * (w - 30)) | 0), py = top + 10 + ((hash(k, 2, seed + 13) * (base - top - 40)) | 0), pw = 10 + ((hash(k, 3, seed + 13) * 12) | 0), ph = 6 + ((hash(k, 4, seed + 13) * 10) | 0);
      ellipse(px + pw / 2, py + ph / 2, pw / 2, ph / 2, (x, y, t) => put(x, y, t > 0.86 ? 0x26272c : asphaltW(x, y, -0.1, false, 0.5)));
    }
    for (let i = 0; i < 8; i++) crack(x0 + 6 + hash(i, 1, seed + 14) * (w - 12), top + 6 + hash(i, 2, seed + 14) * (base - top - 14), 10 + hash(i, 3, seed + 14) * 16, seed + 15 + i, { vert: true, x0: x0 + 5, x1: x1 - 5, y0: top + 1, y1: base - 3, weeds: 0.1 });
    scatter([x0 + 5, top + 2, x0 + 9, base - 4], 9, seed + 16); scatter([x1 - 9, top + 2, x1 - 5, base - 4], 9, seed + 19);
  }
  gapShadow(g, top, base);
}

// =====================================================================
// TROTTOARERNA – plattor, smågatsten, kantsten (norra typen: kantstenens framsida syns)
// =====================================================================
const SETT = [0x9e9890, 0xa9a298, 0x958f87, 0xaea496, 0x9a948d];
const slabCol = (seed) => (s, x, y) => {
  const h = hash(s.r, s.k, seed), worn = wornAt(x, y);
  if (worn > 0.3 && h > 1 - 0.07 * worn) return -1;                                         // platta saknas
  let c = SLAB[(hash(s.k, s.r, seed + 1) * SLAB.length) | 0];
  if (h > 0.93) c = 0xc4c2ba;                                                                 // utbytt, nyare platta
  else if (h < 0.05 + 0.1 * worn) c = mul(c, 0.86);                                           // fläckig/sjunken
  c = mul(c, 0.95 + hash(s.r, s.k, seed + 2) * 0.08);
  const gg = hash(x, y, seed + 3);
  if (gg > 0.93) c = mul(c, 0.86); else if (gg < 0.04) c = mix(c, 0xffffff, 0.25);           // ballast i betongen
  return grime(mul(c, 0.96 + vnoise(x, y, 5, seed + 4) * 0.08), x, y, worn, seed + 5);
};
const settCol = (seed) => (s, x, y) => {
  const worn = wornAt(x, y);
  if (worn > 0.3 && hash(s.r, s.k, seed + 2) > 1 - 0.08 * worn) return -1;
  return grime(mul(SETT[(hash(s.r, s.k, seed) * SETT.length) | 0], 0.9 + hash(s.k, s.r, seed + 1) * 0.16), x, y, worn, seed + 3);
};
const slabJoint = (x, y) => {
  const worn = wornAt(x, y);
  if (worn > 0.3 && hash(x, y, 950) > 1 - 0.45 * worn) return hash(x, y, 951) > 0.5 ? WEED[1] : WEED[2];
  return mul(0x877f73, 0.92 + hash(x, y, 4) * 0.12);
};
// v3: downtowns trottoarer – ljus polerad granit i stora hällar (24 × 9) och ett band av mörk,
// glittrande diabas mot kantstenen i stället för smågatstenen. (Infartens östra trottoar, x < 1766,
// målas av Infarten.)
const DT_SLAB = [0xd6d2c8, 0xcecac0, 0xdcd8ce, 0xc8c4ba, 0xd2cec3];
const dtSlabCol = (seed) => (s, x, y) => granite(x, y, mul(DT_SLAB[(hash(s.k, s.r, seed) * DT_SLAB.length) | 0], 0.97 + hash(s.r, s.k, seed + 1) * 0.05));
const dtBandCol = (seed) => (s, x, y) => { const c = mul(0x4a4e56, 0.88 + hash(s.k, s.r, seed) * 0.2); return hash(x, y, seed + 2) > 0.93 ? mix(c, 0xd8dee8, 0.35) : c; };
function paintDowntownWalk(ya, yb, yBand0, yBand1, seed) {
  if (!RIVER) return;
  const a = IE1, b = RX0;
  stones(rows(a, b, ya, yb, { h: [9, 9], w: [24, 24], seed, bond: true, shift: 3 }), a, b, ya, yb, dtSlabCol(seed + 1), { hi: 0.14, lo: 0.9, grain: 0.02, joint: () => 0x96918a });
  stones(rows(a, b, yBand0, yBand1, { h: [yBand1 - yBand0, yBand1 - yBand0], w: [16, 16], seed: seed + 2, bond: true }), a, b, yBand0, yBand1, dtBandCol(seed + 3), { hi: 0.24, lo: 0.78, grain: 0.02, joint: () => 0x26282c });
}

// kännbar varningsyta (kupolplattor) vid övergångsställena (trasig i förorten)
function tactile(xa, xb, ya, yb, broken = false) {
  for (let y = ya; y < yb; y++) for (let x = xa; x < xb; x++) {
    const lx = (x - xa) % 7, ly = y - ya;
    if (broken && hash(Math.floor((x - xa) / 7), 1, xa) > 0.6) continue;                     // plattor saknas
    let c = granite(x, y, broken ? 0xc4bfb2 : 0xd8d4ca);
    if (lx === 6) c = 0x9a958b;
    else if ((lx === 1 || lx === 4) && (ly % 3 === 1)) c = 0xf4f0e8;                         // kupol
    else if ((lx === 1 || lx === 4) && (ly % 3 === 2)) c = 0xa9a59b;                         // kupolens skugga
    put(x, y, c);
  }
}
// sprickor, tuggummi, fläckar, fimpar och ogräs på plattor
function paintSidewalkWear(ya, yb, seed, x0 = 0, x1 = W1) {
  for (let y = ya; y < yb; y++) for (let x = x0; x < x1; x++) {
    const h = hash(x, y, seed);
    if (h > 0.9975) { put(x, y, 0x6e6a64); if (hash(x, y, seed + 1) > 0.5) put(x + 1, y, 0x7c7872); }   // tuggummi
    else if (h < 0.0012) blend(x, y, 0x4a3a2a, 0.3);
  }
  const n = Math.round(26 * (x1 - x0) / W1);
  for (let i = 0; i < n; i++) {
    const x = x0 + hash(i, 1, seed + 2) * (x1 - x0), y = ya + 2 + hash(i, 2, seed + 2) * (yb - ya - 4);
    crack(x, y, 4 + hash(i, 3, seed + 2) * 7, seed + i, { dx: hash(i, 4, seed) > 0.5 ? 1 : -1, y0: ya, y1: yb });
  }
  for (let i = 0; i < 8 * (x1 - x0) / W1; i++) stain(x0 + hash(i, 5, seed) * (x1 - x0), ya + 3 + hash(i, 6, seed) * (yb - ya - 6), 2 + hash(i, 7, seed) * 3, 1.3, 0.12, 0x3a3026);
}
// förortens slitage ovanpå plattorna
function subWear(ya, yb, seed) {
  const r = [XS, ya, W, yb];
  for (let i = 0; i < 70; i++) {
    const x = XS + hash(i, 1, seed) * (W - XS), y = ya + 2 + hash(i, 2, seed) * (yb - ya - 4);
    crack(x, y, 8 + hash(i, 3, seed) * 16, seed + i, { dx: hash(i, 4, seed) > 0.5 ? 1 : -1, y0: ya, y1: yb, branch: i % 5 === 0, weeds: 0.07 });
  }
  for (let i = 0; i < 16; i++) stain(XS + hash(i, 5, seed) * (W - XS), ya + 3 + hash(i, 6, seed) * (yb - ya - 6), 3 + hash(i, 7, seed) * 4, 1.6, 0.22, 0x3a3026);
  scatter([XS, ya, W, ya + 4], 34, seed + 1); scatter([XS, yb - 4, W, yb], 34, seed + 8); scatter(r, 22, seed + 9);
  for (let x = XS; x < W; x++) if (hash(x, ya, seed + 2) > 0.94) tuft(x, ya + 1 + ((hash(x, 1, seed + 2) * (yb - ya - 2)) | 0), seed + x, hash(x, 2, seed + 2) > 0.7);
}

// Norra typen: plattor närmast fasaderna, smågatsten, kantsten vars framsida syns (mot vägen).
// S = { y0, cws, houses, drives, lids, valves, seed }
function paintSidewalkTop(S) {
  const y0 = S.y0, sd = S.seed, xa = S.xa ?? 0, xb = S.xb ?? W, wst = xb <= 0;                 // (v4) wst: Linnéstadens bit
  const at = rows(al(xa, 18), xb, y0, y0 + 18, { h: [9, 9], w: [18, 18], seed: sd, bond: true });
  stones(at, xa, xb, y0, y0 + 18, slabCol(sd + 1), { hi: 0.1, lo: 0.9, grain: 0.04, joint: slabJoint });
  const at2 = rows(xa, xb, y0 + 18, y0 + 25, { h: [3, 4], w: [3, 5], seed: sd + 2 });
  stones(at2, xa, xb, y0 + 18, y0 + 25, settCol(sd + 3), { round: true, hi: 0.2, lo: 0.8, grain: 0.06, joint: () => 0x6c665d });
  if (!wst) paintDowntownWalk(y0, y0 + 18, y0 + 18, y0 + 25, sd + 60);                        // (v3) downtown: granit
  // kantsten mot vägen (framsidan syns – den vetter mot kameran)
  const k = y0 + 25;                                                                          // 211 / 665
  const low = (x) => S.cws.some((c) => x >= c.x0 && x < c.x1) || S.drives.some(([a, b]) => x >= a && x < b);
  for (let x = xa; x < xb; x++) {
    const worn = wornAt(x, k);
    put(x, k, 0x5b564f);
    if (low(x)) {                                                                              // nedsänkt vid övergångsställen och utfarter
      put(x, k + 1, granite(x, k + 1, 0xc6c1b7)); put(x, k + 2, granite(x, k + 2, 0xb3aea4)); put(x, k + 3, granite(x, k + 3, 0xaea99f));
      put(x, k + 4, granite(x, k + 4, 0xa9a49a)); put(x, k + 5, granite(x, k + 5, 0xa29d94)); put(x, k + 6, 0x77736c);
    } else {
      put(x, k + 1, granite(x, k + 1, 0xd8d3c9)); put(x, k + 2, granite(x, k + 2, 0xb6b1a7)); put(x, k + 3, granite(x, k + 3, 0xafaaa0));
      put(x, k + 4, granite(x, k + 4, 0xc6c1b7)); put(x, k + 5, granite(x, k + 5, 0x9a958c)); put(x, k + 6, granite(x, k + 6, 0x76716a));
    }
    if (mod(x, 24) === 0) for (let y = k + 2; y < k + 7; y++) put(x, y, 0x5c5750);
    if (worn > 0.3) {                                                                          // kantstenen i förorten: kantstött och smutsig
      if (hash(x >> 2, k, sd + 4) > 1 - 0.18 * worn) for (let y = k + 1; y < k + 4; y++) put(x, y, mix(get(x, y), 0x5e5a52, 0.6));
      for (let y = k + 1; y < k + 7; y++) put(x, y, grime(get(x, y), x, y, worn, sd + 5));
    }
  }
  for (const c of S.cws) tactile(c.x0 + 3, c.x1 - 3, y0 + 18, y0 + 25, !!c.broken);
  // utfarter: grova betongplattor tvärs över trottoaren, däckspår
  for (const [a, b] of S.drives) for (let y = y0 + 2; y < k; y++) for (let x = a; x < b; x++) {
    let c = concrete(x, y, 12, 12, sd + 6, wornAt(x, y));
    if (Math.abs(x - a - 8) < 3 || Math.abs(b - 8 - x) < 3) c = mul(c, 0.84);
    put(x, y, c);
  }
  if (wst) paintSidewalkWear(y0 + 2, y0 + 17, sd + 10, xa, xb);
  else { paintSidewalkWear(y0 + 2, y0 + 17, sd + 10); subWear(y0 + 1, y0 + 25, sd + 20); }
  for (const mx of S.lids) lid(mx - 4, y0 + 11, 8, 5);
  for (const vx of S.valves) valve(vx, y0 + 22);
  // blankslitet framför dörrarna
  for (const b of S.houses) ellipse((b.door.x0 + b.door.x1) / 2, b.base + 10, (b.door.x1 - b.door.x0) / 2 + 8, 7, (x, y, t) => { if (bayer(x, y) < (1 - t) * 0.9) blend(x, y, 0xffffff, 0.07); });
  // husens fot: mörk kontaktskugga precis under fasaden
  for (const b of S.houses) for (let x = b.x; x < b.x + b.w; x++) { shade(x, b.base + 4, 0.78); if (bayer(x, b.base + 5) < 0.5) shade(x, b.base + 5, 0.9); }
}

// Södra typen: kantstenens ovansida, smågatsten, plattor, låg kant mot parken/kajen.
// S = { y0, cws, stops, drives, lowAt(x), lids, valves, seed, hop }
function paintSidewalkBottom(S) {
  const y0 = S.y0, y1 = y0 + 30, sd = S.seed, xa = S.xa ?? 0, xb = S.xb ?? W, wst = xb <= 0;
  const zone = (x) => S.stops.find((s) => x >= s.x - 44 && x < s.x + 44);
  for (let x = xa; x < xb; x++) {
    const cw = S.cws.some((c) => x >= c.x0 && x < c.x1) || S.drives.some(([a, b]) => x >= a && x < b), bus = zone(x);
    put(x, y0, granite(x, y0, cw ? 0xc8c3b9 : bus ? 0xe2ddd3 : 0xdad5cb));
    put(x, y0 + 1, granite(x, y0 + 1, cw ? 0xaca79d : bus ? 0xc6c1b7 : 0xb6b1a7));
    put(x, y0 + 2, granite(x, y0 + 2, cw ? 0xa6a197 : 0xa9a49a));
    put(x, y0 + 3, 0x5c5750);
    if (mod(x, 24) === 12) for (let y = y0; y < y0 + 3; y++) put(x, y, 0x5c5750);
    const worn = wornAt(x, y0);
    if (worn > 0.3) for (let y = y0; y < y0 + 3; y++) put(x, y, grime(get(x, y), x, y, worn, sd));
  }
  const at = rows(xa, xb, y0 + 4, y0 + 10, { h: [3, 3], w: [3, 5], seed: sd + 1 });
  stones(at, xa, xb, y0 + 4, y0 + 10, settCol(sd + 2), { round: true, hi: 0.2, lo: 0.8, grain: 0.06, joint: () => 0x6c665d });
  const at2 = rows(al(xa, 18), xb, y0 + 10, y0 + 28, { h: [9, 9], w: [18, 18], seed: sd + 3, bond: true, shift: 5 });
  stones(at2, xa, xb, y0 + 10, y0 + 28, slabCol(sd + 4), { hi: 0.1, lo: 0.9, grain: 0.04, joint: slabJoint });
  if (!wst) paintDowntownWalk(y0 + 10, y0 + 28, y0 + 4, y0 + 10, sd + 60);                    // (v3) downtown: granit
  // låg kant mot parken/kajen (lägre där gångarna börjar)
  for (let x = xa; x < xb; x++) {
    const p = S.lowAt(x);
    put(x, y1 - 2, granite(x, y1 - 2, p ? 0xbcb7ad : 0xcfcac0));
    put(x, y1 - 1, granite(x, y1 - 1, p ? 0xb2ada3 : 0x928d85));
  }
  for (const c of S.cws) tactile(c.x0 + 3, c.x1 - 3, y0 + 4, y0 + 10, !!c.broken);
  // hållplatsytorna: ljusa plattor och vit ledlinje (den trasiga: spruckna, bortnötta)
  for (const s of S.stops) {
    const bx0 = s.x - 44, bx1 = s.x + 44, br = !!s.broken;
    for (let y = y0 + 4; y < y0 + 10; y++) for (let x = bx0; x < bx1; x++) {
      if (br && vnoise(x, y, 5, sd + 5) > 0.66) continue;
      let c = granite(x, y, br ? 0xb4aea2 : 0xc6c0b4);
      if ((x - bx0) % 12 === 11 || y === y0 + 9) c = 0x8e887e;
      if ((y === y0 + 5 || y === y0 + 6) && !(br && hash(x >> 2, y, sd + 6) > 0.45)) c = (mod(x, 3) === 2) ? 0xb4b0a6 : 0xf0ece4;
      put(x, y, br ? grime(c, x, y, 1, sd + 7) : c);
    }
    if (br) {
      for (let i = 0; i < 10; i++) crack(bx0 + hash(i, 1, sd + 8) * 88, y0 + 5 + hash(i, 2, sd + 8) * 20, 10 + hash(i, 3, sd + 8) * 16, sd + 9 + i, { dx: 1, y0: y0 + 4, y1: y1 - 2, branch: true, weeds: 0.1 });
      for (let k = 0; k < 6; k++) litter(s.x - 30 + hash(k, 1, sd + 10) * 60, y0 + 14 + hash(k, 2, sd + 10) * 10, 0.3 + hash(k, 3, sd + 10) * 0.18, sd + 11 + k); // krossat glas från kuren
    }
  }
  // utfarter: nedsänkt kantsten och asfalt tvärs över trottoaren
  for (const [a, b] of S.drives) for (let y = y0 + 4; y < y1 - 2; y++) for (let x = a; x < b; x++) put(x, y, asphaltW(x, y, 0.03, false, wornAt(x, y) * 0.8));
  if (wst) paintSidewalkWear(y0 + 11, y0 + 27, sd + 20, xa, xb);
  else { paintSidewalkWear(y0 + 11, y0 + 27, sd + 20); subWear(y0 + 4, y1 - 2, sd + 30); }
  for (const mx of S.lids) lid(mx - 4, y0 + 17, 8, 5);
  for (const vx of S.valves) valve(vx, y0 + 7);
  if (S.hop) paintHopscotch(S.hop[0], y0 + 12, S.hop[1]);
}
// kritritad hage på trottoaren
const DIGITS = { 1: ['.#', '##', '.#', '.#', '.#'], 2: ['##', '.#', '##', '#.', '##'], 3: ['##', '.#', '##', '.#', '##'], 4: ['#.', '#.', '##', '.#', '.#'], 5: ['##', '#.', '##', '.#', '##'], 6: ['#.', '#.', '##', '##', '##'], 7: ['##', '.#', '.#', '.#', '.#'], 8: ['##', '##', '..', '##', '##'] };
function paintHopscotch(x0, y0, faded = 0) {
  const CH = [0xf4eaf0, 0xf0c8d8, 0xc8e0f4];
  const cells = [[0, 0, 9, 14, 1], [9, 0, 9, 14, 2], [18, 0, 9, 7, 3], [18, 7, 9, 7, 4], [27, 0, 9, 14, 5], [36, 0, 9, 7, 6], [36, 7, 9, 7, 7], [45, 0, 10, 14, 8]];
  const chalk = (x, y, c) => { if (hash(x, y, 461) > 0.18 + faded) blend(x, y, c, (0.55 + hash(x, y, 462) * 0.3) * (1 - faded * 0.6)); };
  cells.forEach(([cx, cy, cw, chh, n], i) => {
    const c = CH[i % 3];
    for (let x = x0 + cx; x <= x0 + cx + cw; x++) { chalk(x, y0 + cy, c); chalk(x, y0 + cy + chh, c); }
    for (let y = y0 + cy; y <= y0 + cy + chh; y++) { chalk(x0 + cx, y, c); chalk(x0 + cx + cw, y, c); }
    const tx = x0 + cx + (cw >> 1) - 1, ty = y0 + cy + ((chh - 5) >> 1) + 1;
    DIGITS[n].forEach((row, j) => { for (let k = 0; k < row.length; k++) if (row[k] === '#') chalk(tx + k, ty + j, 0xffffff); });
  });
  // en liten kritsol bredvid
  const sx = x0 + 64, sy = y0 + 7;
  ellipse(sx, sy, 3, 3, (x, y, t) => { if (t > 0.6) chalk(x, y, 0xf8e070); });
  for (const [dx, dy] of [[0, -5], [0, 5], [-5, 0], [5, 0], [-4, -4], [4, 4], [-4, 4], [4, -4]]) chalk(sx + dx, sy + dy, 0xf8e070);
}

// =====================================================================
// VÄGARNA (Pixelgatan, Södergatan) – högupplöst asfalt med allt som hör till
// =====================================================================
const PATCH_N = [[118, 224, 46, 14, -0.13], [522, 250, 30, 18, 0.07], [758, 228, 62, 12, -0.1], [1012, 256, 40, 12, 0.06], [1330, 222, 26, 22, -0.14], [1560, 252, 52, 15, -0.08], [40, 250, 22, 10, 0.08], [1452, 226, 34, 11, 0.07]];
const TRENCH_N = [[436, R0 + 3, 6, 26, -0.15], [1118, 247, 6, 24, -0.15], [1622, R0 + 3, 7, 50, -0.12]];
function paintRoadX(R) {
  const A = R.y0, B = R.y1, d = A - R0, sd = R.seed;
  const xa = R.xa ?? 0, xb = R.xb ?? W, wst = xb <= 0;                                       // (v4) wst: Linnéstadens bit (x < 0)
  const open = (list, x) => list.some(([a, b]) => x >= a && x < b);
  // rännstenar av gatsten (öppna där Infarten mynnar)
  const gN = rows(xa, xb, A, A + 3, { h: [3, 3], w: [4, 6], seed: sd + 1 });
  stones(gN, xa, xb, A, A + 3, (s) => mul(0x6f6b65, 0.86 + hash(s.r, s.k, sd + 2) * 0.26), { hi: 0.14, lo: 0.8, joint: (x, y) => mul(0x3a3733, 0.9 + hash(x, y, 1) * 0.2) });
  const gS = rows(xa, xb, B - 4, B - 1, { h: [3, 3], w: [4, 6], seed: sd + 3 });
  stones(gS, xa, xb, B - 4, B - 1, (s) => mul(0x6f6b65, 0.86 + hash(s.r, s.k, sd + 4) * 0.26), { hi: 0.14, lo: 0.8, joint: (x, y) => mul(0x3a3733, 0.9 + hash(x, y, 1) * 0.2) });
  for (let x = xa; x < xb; x++) { put(x, B - 1, 0x2a2b30); put(x, A + 2, mul(get(x, A + 2), 0.8)); }
  // asfalt
  for (let y = A + 3; y < B - 4; y++) for (let x = xa; x < xb; x++) put(x, y, asphaltW(x, y, 0, true, wornAt(x, y)));
  for (let x = xa; x < xb; x++) {
    if (open(R.openN, x)) for (let y = A; y < A + 3; y++) put(x, y, asphaltW(x, y, 0, false, wornAt(x, y)));
    if (open(R.openS, x)) for (let y = B - 4; y < B; y++) put(x, y, asphaltW(x, y, 0, false, wornAt(x, y)));
  }
  if (!wst) {
  // grus och ogräs i förortens rännstenar
  for (let x = XS; x < W; x++) for (const y of [A, A + 1, B - 4, B - 3]) {
    if (open(R.openN, x) || open(R.openS, x)) continue;
    if (hash(x, y, sd + 5) > 0.93) put(x, y, dirt(x, y));
    if (hash(x, y, sd + 6) > 0.985) tuft(x, y === A || y === A + 1 ? A + 2 : B - 2, sd + x, hash(x, y, sd + 7) > 0.6);
  }
  // lagningar: nyare (mörkare) eller äldre (blekare) asfalt med tätade skarvar
  const PATCH = R.dy === 0 ? [...PATCH_N, ...TRENCH_N]
    : [...PATCH_N.map(([px, py, pw, ph, t], i) => [(px + 290 + i * 37) % 1640, py + d, pw, ph, t]), ...TRENCH_N.map(([px, py, pw, ph, t]) => [(px + 400) % 1640, py + d, pw, ph, t])];
  for (let i = 0; i < 10; i++) PATCH.push([XS + 10 + ((hash(i, 1, sd + 8) * (W - XS - 80)) | 0), A + 5 + ((hash(i, 2, sd + 8) * (B - A - 26)) | 0), 16 + ((hash(i, 3, sd + 8) * 56) | 0), 7 + ((hash(i, 4, sd + 8) * 16) | 0), hash(i, 5, sd + 8) > 0.5 ? -0.15 : 0.1]);
  for (let i = 0; i < 12; i++) blobPatch(XS + 20 + hash(i, 1, sd + 9) * (W - XS - 40), A + 10 + hash(i, 2, sd + 9) * (B - A - 22), 8 + hash(i, 3, sd + 9) * 20, 4 + hash(i, 4, sd + 9) * 7, hash(i, 5, sd + 9) > 0.4 ? -0.16 : 0.08, sd + 90 + i, A + 3, B - 4);
  for (const [px, py, pw, ph, tone] of PATCH) {
    for (let y = Math.max(A + 3, py); y < Math.min(B - 4, py + ph); y++) for (let x = px; x < px + pw; x++) {
      const e = x === px || y === py || x === px + pw - 1 || y === py + ph - 1;
      const c = asphaltW(x, y, tone, true, wornAt(x, y) * 0.4);
      put(x, y, e && hash(x, y, 405) > 0.3 ? mul(c, 0.72) : c);                                // tätad skarv, lite ojämn
      if (e && hash(x, y, 406) > 0.85) blend(x + (x === px ? -1 : x === px + pw - 1 ? 1 : 0), y + (y === py ? -1 : y === py + ph - 1 ? 1 : 0), 0x202126, 0.5);
    }
  }
  } else {
    // Linnéstaden: välskött gata – några få, prydliga lagningar
    for (const [px, py, pw, ph, tone] of R.patch || []) for (let y = Math.max(A + 3, py); y < Math.min(B - 4, py + ph); y++) for (let x = px; x < px + pw; x++) {
      const e = x === px || y === py || x === px + pw - 1 || y === py + ph - 1;
      const c = asphaltW(x, y, tone, true, 0);
      put(x, y, e && hash(x, y, 405) > 0.3 ? mul(c, 0.72) : c);
    }
  }
  // spöklinjer: gammal, bortfräst mittlinje som fortfarande anas
  for (let x = xa; x < xb; x++) if (mod(x + 20, 40) < 18 && vnoise(x, 5 + d, 60, 407) > 0.42) for (const y of [A + 33, A + 34]) if (hash(x, y, 408) > 0.35) put(x, y, mix(get(x, y), 0x6a6c72, 0.35));
  // sand och grus (vintersand) som samlats längs kantstenen, löv i rännstenen
  for (let x = xa; x < xb; x++) {
    for (let dd = 0; dd < 5; dd++) for (const y of [A + 3 + dd, B - 5 - dd]) {
      if (hash(x, y, 409) < (0.24 - dd * 0.05) * (0.4 + vnoise(x, y, 20, 411)) * (1 + wornAt(x, y) * 0.8)) put(x, y, mix(mix(0xa09682, 0x7e766a, hash(x, y, 412)), get(x, y), 0.3));
    }
    if (hash(x, d, 413) > 0.965) {
      const y = hash(x, 1 + d, 413) > 0.5 ? A + 1 : B - 3, k = hash(x, 2 + d, 413);
      const lc = k < 0.4 ? 0xc88a2a : k < 0.7 ? 0x9a5a22 : 0xd8b040;
      put(x, y, lc); if (k > 0.3) put(x + 1, y, mul(lc, 0.75));
    }
  }
  if (wst) {
    // Linnéstaden: några tätade sprickor och lite oljedropp där bilarna väntar vid rött
    for (let i = 0; i < 6; i++) crack(xa + hash(i, 1, sd + 70) * (xb - xa), A + 6 + hash(i, 2, sd + 70) * (B - A - 14), 8 + hash(i, 3, sd + 70) * 18, sd + 70 + i * 3, { sealed: true, dx: hash(i, 4, sd + 70) > 0.5 ? 1 : -1, y0: A + 3, y1: B - 4 });
    for (let i = 0; i < 18; i++) stain(xa + hash(i, 1, sd + 71) * (xb - xa), (i & 1 ? A + 45.5 : A + 19.5) + (hash(i, 2, sd + 71) - 0.5) * 3, 2 + hash(i, 3, sd + 71) * 3, 1 + hash(i, 4, sd + 71), 0.18);
  } else {
  // sprickor: tätade (blanka svarta) och öppna hårfina
  for (let i = 0; i < 16; i++) crack(hash(i, 1, sd + 10) * W1, A + 6 + hash(i, 2, sd + 10) * (B - A - 14), 8 + hash(i, 3, sd + 10) * 22, sd + 10 + i * 3, { sealed: i < 9, branch: i < 5, dx: hash(i, 4, sd + 10) > 0.5 ? 1 : -1, y0: A + 3, y1: B - 4 });
  for (let i = 0; i < 46; i++) crack(XS + hash(i, 1, sd + 11) * (W - XS), A + 6 + hash(i, 2, sd + 11) * (B - A - 14), 10 + hash(i, 3, sd + 11) * 30, sd + 11 + i * 3, { sealed: i % 3 !== 0, branch: i % 3 === 0, dx: hash(i, 4, sd + 11) > 0.5 ? 1 : -1, y0: A + 3, y1: B - 4 });
  crack(R.dy ? 610 : 330, A + 31, 70, sd + 30, { sealed: true, y0: A + 30, y1: A + 33 });           // längsspricka vid mitten
  crack(R.dy ? 1480 : 1320, A + 31, 54, sd + 31, { sealed: true, y0: A + 30, y1: A + 33 });
  crack(2000 + SDX, A + 31, 120, sd + 32, { sealed: true, y0: A + 30, y1: A + 33 }); crack(2400 + SDX, A + 31, 150, sd + 33, { sealed: false, y0: A + 30, y1: A + 33 });
  // krackelering nära södra kanten
  const kx = R.dy ? 700 : 1396;
  for (let i = 0; i < 12; i++) crack(kx + hash(i, 1, 432) * 44, A + 44 + hash(i, 2, 432) * 8, 4 + hash(i, 3, 432) * 6, 433 + i + d, { dx: hash(i, 4, 432) > 0.5 ? 1 : -1, y0: A + 42, y1: A + 53 });
  // förorten: krokodilsprickor och potthål i hjulspåren
  for (let i = 0; i < 9; i++) alligator(XS + 30 + hash(i, 1, sd + 40) * (W - XS - 60), A + 12 + hash(i, 2, sd + 40) * (B - A - 26), 12 + hash(i, 3, sd + 40) * 18, 4 + hash(i, 4, sd + 40) * 4, sd + 41 + i);
  const cwNear = (x, pad) => R.cws.some((c) => x >= c.x0 - pad && x < c.x1 + pad);
  for (let i = 0; i < 12; i++) {
    const x = XS + 40 + hash(i, 1, sd + 50) * (W - XS - 80), band = TRACKS_N[(hash(i, 2, sd + 50) * 4) | 0];
    if (cwNear(x, 14)) continue;
    pothole(x, band[0] + d + 1.5 + (hash(i, 3, sd + 50) - 0.5) * 3, 3 + hash(i, 4, sd + 50) * 5, 1.6 + hash(i, 5, sd + 50) * 1.4, sd + 51 + i);
  }
  // oljedropp mitt i körfälten – tätare där bilarna står och väntar vid rött
  for (let i = 0; i < 60; i++) stain(hash(i, 1, 440 + d) * W1, (i & 1 ? A + 45.5 : A + 19.5) + (hash(i, 2, 440) - 0.5) * 3, 2 + hash(i, 3, 440) * 3, 1 + hash(i, 4, 440), 0.22);
  for (let i = 0; i < 44; i++) stain(XS + hash(i, 1, 441 + d) * (W - XS), (i & 1 ? A + 45.5 : A + 19.5) + (hash(i, 2, 441) - 0.5) * 4, 2 + hash(i, 3, 441) * 4, 1 + hash(i, 4, 441) * 1.4, 0.3);
  }
  for (const c of R.cws) for (let i = 0; i < 6; i++) {
    stain(c.x1 + 12 + hash(i, 5, c.x0) * 50, A + 19.5 + (hash(i, 6, c.x0) - 0.5) * 3, 2 + hash(i, 7, c.x0) * 4, 1.2 + hash(i, 8, c.x0), 0.35);
    stain(c.x0 - 12 - hash(i, 9, c.x0) * 50, A + 45.5 + (hash(i, 10, c.x0) - 0.5) * 3, 2 + hash(i, 11, c.x0) * 4, 1.2 + hash(i, 12, c.x0), 0.35);
  }
  // bromsspår före det andra övergångsstället (och ett par sladdar i förorten)
  const tc = R.cws[1] || R.cws[0];
  if (tc) for (let x = tc.x0 - 44; x < tc.x0 - 8; x++) for (const y of [A + 43, A + 50]) { const f = (x - (tc.x0 - 44)) / 36; if (hash(x, y, 450) < 0.35 + f * 0.6) blend(x, y, 0x17181c, 0.55); }
  if (!wst) for (const [sx, sy] of [[1900 + SDX + d, A + 44], [2480 + SDX - d, A + 18]]) for (let k = 0; k < 40; k++) { const x = sx + k, y = sy + Math.round(Math.sin(k * 0.12) * 3); for (const o of [0, 7]) if (hash(x, y + o, 451) < 0.7) blend(x, y + o, 0x17181c, 0.45); }
  // mittlinje (slitna streck) och streckade kantlinjer – uppehåll vid övergångsställena och Infarten
  const nearCW = (x, pad) => R.cws.some((c) => x >= c.x0 - pad && x < c.x1 + pad);
  const busZone = (x) => R.stops.some((s) => x >= s.x - 60 && x < s.x + 60);
  for (let x = xa; x < xb; x++) {
    const wx = wornAt(x, A + 28) * 0.42;
    if (!nearCW(x, 14) && mod(x + 6, 34) < 16) {
      mark(x, A + 28, 0xefe9d4, wearAt(x, A + 28, 0.03) + wx);
      mark(x, A + 29, 0xd6d0bc, wearAt(x, A + 29, 0.03) + wx);
      if (hash(x, A + 30, 36) > 0.4) shade(x, A + 30, 0.88);                                    // färgens kant
    }
    if (!nearCW(x, 8)) {
      if (!open(R.openN, x)) mark(x, A + 4, 0xcfc9b6, 0.12 + vnoise(x, d, 9, 37) * 0.3 + wx);     // tunna, slitna kantlinjer
      if (!busZone(x) && !open(R.openS, x)) mark(x, B - 6, 0xcfc9b6, 0.12 + vnoise(x, 1 + d, 9, 37) * 0.3 + wx);
    }
  }
  // övergångsställen: sju breda zebraränder, smutsiga och nötta i hjulspåren, + stopplinjer
  for (const c of R.cws) {
    const br = c.broken ? 0.45 : 0;
    for (let k = 0; k < 7; k++) {
      const by = A + 5 + k * 7;
      for (let y = by; y < by + 4; y++) for (let x = c.x0 + 3; x < c.x1 - 3; x++) {
        const tr = trackAt(y), n = vnoise(x, y, 5, 34 + c.x0);
        if (hash(x, y, 35) < tr * 0.22 + (n > 0.78 - br * 0.5 ? 0.35 + br : 0.01) + br * 0.3) continue; // bortnött – asfalten syns
        let col = y === by ? 0xfaf7ee : y === by + 3 ? 0xd4cebe : 0xefebde;
        col = mix(col, 0x8e8c86, tr * 0.28 + n * 0.1 + br * 0.4);                                // däckgrå smuts
        if (x === c.x0 + 3 || x === c.x1 - 4) col = mix(col, get(x, y), 0.35);
        put(x, y, mul(col, 0.95 + hash(x, y, 36) * 0.06));
      }
      for (let x = c.x0 + 3; x < c.x1 - 3; x++) if (hash(x, by + 4, 37) > 0.15 + br) shade(x, by + 4, 0.84); // färgens tjocklek
    }
    // övre körfältet kör västerut: stopplinje öster om övergångsstället
    for (let y = A + 4; y < A + 28; y++) for (let x = c.x1 + 4; x < c.x1 + 7; x++) mark(x, y, 0xf0ecde, wearAt(x, y, 0.05) + br);
    // undre körfältet kör österut: stopplinje väster om övergångsstället
    for (let y = A + 30; y < B - 5; y++) for (let x = c.x0 - 6; x < c.x0 - 3; x++) mark(x, y, 0xf0ecde, wearAt(x, y, 0.05) + br);
    if (c.broken) {                                                                            // en lagning rakt över zebran
      for (let y = A + 12; y < A + 30; y++) for (let x = c.x0 + 14; x < c.x0 + 34; x++) {
        const e = x === c.x0 + 14 || y === A + 12 || x === c.x0 + 33 || y === A + 29;
        put(x, y, e && hash(x, y, 452) > 0.3 ? 0x25262b : asphaltW(x, y, -0.14, true, 0.3));
      }
    }
  }
  // busshållplatser: gul sicksack längs kanten och BUSS i körfältet
  for (const s of R.stops) {
    const bx0 = s.x - 60, bx1 = s.x + 60, br = s.broken ? 0.45 : 0;
    for (let x = bx0; x < bx1; x++) {
      const ph = (x - bx0) % 8, yy = B - 8 + Math.round((ph < 4 ? ph : 8 - ph) * 0.75);
      mark(x, yy, 0xe8c040, 0.1 + br);
    }
    eachTextPixel(BIG, 'BUSS', s.x - 11, A + 36, 1, (px, py) => mark(px, py, 0xe8e0c8, wearAt(px, py, 0.08) + br));
  }
  // brunnslock med lagad asfaltruta runt
  const MH = wst ? R.mh || [] : R.dy === 0 ? [[180, 233], [705, 259], [1125, 234], [1480, 260], [1860, 233], [2250, 260], [1900 + SDX, 234], [2350 + SDX, 260], [2620 + SDX, 233]]
    : [[330, A + 41], [880, A + 15], [1380, A + 41], [1640, A + 16], [1960, A + 41], [2300, A + 15], [2010 + SDX, A + 41], [2470 + SDX, A + 15]];
  for (const [mx, my] of MH) {
    const worn = wornAt(mx, my);
    for (let y = my - 5; y < my + 5; y++) for (let x = mx - 9; x < mx + 9; x++) {
      const e = x === mx - 9 || y === my - 5 || x === mx + 8 || y === my + 4;
      put(x, y, e ? 0x25262b : asphaltW(x, y, -0.12, true, worn * 0.5));
    }
    manhole(mx, my, 6, 3.2, worn);
    if (worn > 0.5) for (let x = mx - 8; x < mx + 8; x++) if (hash(x, my, 453) > 0.6) shade(x, my + 5, 0.7);   // locket har sjunkit
  }
  // dagvattengaller i rännstenarna
  for (let i = 0, x = wst ? xa + 40 : 52 + (R.dy ? 30 : 0); x < (wst ? xb : W) - 10; i++, x += 118) {
    if (nearCW(x, 12) || nearCW(x + 8, 12) || open(R.openS, x) || open(R.openS, x + 38) || open(R.openN, x)) continue;
    const rust = 0.16 + wornAt(x, A) * 0.34;
    if (i & 1) { grate(x, A, 9, 3, true, rust); ellipse(x + 4.5, A + 4, 7, 2, (px, py, t) => { if (bayer(px, py) < (1 - t)) shade(px, py, 0.85); }); }
    else if (!busZone(x) && !busZone(x + 38)) grate(x + 30, B - 4, 9, 3, true, rust);
  }
  // skräp i förortens rännstenar
  if (!wst) { scatter([XS, A, W, A + 4], 44, sd + 60); scatter([XS, B - 5, W, B - 1], 44, sd + 61); }
}

// =====================================================================
// INFARTEN – lodrät väg mellan Pixelgatan och Södergatan, trottoarer på båda sidor
// =====================================================================
function paintInfarten() {
  const y0 = R1, y1 = RS0, worn = 0.55;
  // trottoarerna längs vägen (väster: parken → parkgången, öster: parkeringen → Södergatan)
  const walk = (xa, xb, ya, yb, curbX, seed) => {
    for (let y = ya; y < yb; y++) for (let x = xa; x < xb; x++) {
      const w = wornAt(x, y);
      let c = concrete(x - xa, y, 7, 12, seed, w * 0.9);
      if (w > 0.4 && hash(Math.floor((x - xa) / 7), Math.floor(y / 12), seed + 1) > 0.93) c = dirt(x, y);
      put(x, y, c);
    }
    for (let y = ya; y < yb; y++) {
      put(curbX, y, granite(curbX, y, 0xd0cbc1)); put(curbX + (curbX < I0 ? 1 : -1), y, granite(curbX, y, 0xa6a197));
      if (y % 16 === 15) put(curbX, y, 0x5c5750);
    }
  };
  walk(IW0, I0 - 2, SS1, BS1, I0 - 2, 960);
  for (let y = SS1; y < BS1; y++) put(I0 - 1, y, granite(I0 - 1, y, 0x9a958b));
  walk(I1 + 2, IE1, SS1, BASE_S, I1 + 1, 961);
  for (let y = SS1; y < BASE_S; y++) put(I1, y, granite(I1, y, 0xc4bfb5));
  for (let x = I1 + 2; x < IE1; x++) { put(x, SS1, granite(x, SS1, 0xbcb7ad)); }
  for (let i = 0; i < 20; i++) crack(I1 + 3 + hash(i, 1, 962) * 12, SS1 + hash(i, 2, 962) * (BASE_S - SS1), 6 + hash(i, 3, 962) * 10, 963 + i, { vert: true, x0: I1 + 2, x1: IE1, weeds: 0.12 });
  scatter([I1 + 2, SS1, IE1, BASE_S], 18, 964);
  // vägbanan
  for (let y = y0; y < y1; y++) for (let x = I0; x < I1; x++) put(x, y, asphaltI(x, y, wornAt(x, y) * 0.5 + 0.2));
  // rännstenar längs trottoarerna (inte där vägen korsar trottoarerna)
  const gutter = (x, y, s) => (y % 4 === 3 ? 0x3a3733 : mul(0x6f6b65, 0.86 + hash(x >> 1, y >> 2, s) * 0.26));
  for (let y = SS1; y < BASE_S; y++) {
    if (y < BS1) for (const x of [I0, I0 + 1]) put(x, y, gutter(x, y, 965));
    for (const x of [I1 - 2, I1 - 1]) put(x, y, gutter(x, y, 967));
  }
  for (let y = SS1; y < BASE_S; y++) put(I1 - 1, y, mul(get(I1 - 1, y), 0.8));
  // lagningar, sprickor, oljefläckar, potthål
  for (const [px, py, pw, ph, tone] of [[1704, 360, 18, 30, -0.13], [1728, 520, 20, 40, 0.07], [1703, 590, 14, 18, -0.1]]) {
    for (let y = py; y < py + ph; y++) for (let x = px; x < px + pw; x++) {
      const e = x === px || y === py || x === px + pw - 1 || y === py + ph - 1;
      put(x, y, e && hash(x, y, 968) > 0.3 ? 0x25262b : asphaltI(x, y, 0.3 + tone));
    }
  }
  for (let i = 0; i < 16; i++) crack(I0 + 4 + hash(i, 1, 969) * 44, y0 + 30 + hash(i, 2, 969) * (y1 - y0 - 60), 12 + hash(i, 3, 969) * 30, 970 + i, { vert: true, sealed: i % 2 === 0, x0: I0 + 2, x1: I1 - 2 });
  for (let i = 0; i < 26; i++) stain((i & 1 ? 1739 : 1713) + (hash(i, 1, 971) - 0.5) * 4, y0 + 30 + hash(i, 2, 971) * (y1 - y0 - 60), 1.2 + hash(i, 3, 971), 2 + hash(i, 4, 971) * 3, 0.25);
  pothole(1744, 430, 3.5, 2, 972); pothole(1708, 560, 4, 2.2, 973);
  // mittlinje och kantlinjer (lodräta), uppehåll vid zebrorna
  const nearZ = (y, pad) => CROSSWALKS_I.some((c) => y >= c.y0 - pad && y < c.y1 + pad);
  for (let y = y0; y < y1; y++) {
    if (!nearZ(y, 6) && (y + 4) % 26 < 12) { mark(1725, y, 0xefe9d4, wearAt(1725, 0, 0.05) + 0.2); mark(1726, y, 0xd6d0bc, wearAt(1726, 0, 0.05) + 0.2); if (hash(1727, y, 36) > 0.4) shade(1727, y, 0.88); }
    if (!nearZ(y, 4) && y > SS1 && y < BASE_S) { mark(I0 + 3, y, 0xcfc9b6, 0.25 + vnoise(0, y, 9, 37) * 0.3); if (y < BS1 || true) mark(I1 - 4, y, 0xcfc9b6, 0.25 + vnoise(1, y, 9, 37) * 0.3); }
  }
  // zebror tvärs över Infarten (ränderna går längs vägen) och stopplinjer
  for (const c of CROSSWALKS_I) {
    for (let k = 0; k < 7; k++) {
      const bx = I0 + 4 + k * 7;
      for (let x = bx; x < bx + 4; x++) for (let y = c.y0; y < c.y1; y++) {
        const tr = trackAtX(x), n = vnoise(x, y, 5, 34 + c.y0);
        if (hash(x, y, 35) < tr * 0.25 + (n > 0.74 ? 0.4 : 0.04)) continue;
        let col = x === bx ? 0xfaf7ee : x === bx + 3 ? 0xd4cebe : 0xefebde;
        col = mix(col, 0x8e8c86, tr * 0.3 + n * 0.12);
        if (y === c.y0 || y === c.y1 - 1) col = mix(col, get(x, y), 0.35);
        put(x, y, mul(col, 0.95 + hash(x, y, 36) * 0.06));
      }
      for (let y = c.y0; y < c.y1; y++) if (hash(bx + 4, y, 37) > 0.15) shade(bx + 4, y, 0.84);
    }
    for (let y = c.stop[1] - 2; y <= c.stop[1]; y++) for (let x = I0 + 3; x < 1724; x++) mark(x, y, 0xf0ecde, wearAt(x, 0, 0.08));   // söderut
    for (let y = c.stop[-1]; y <= c.stop[-1] + 2; y++) for (let x = 1728; x < I1 - 3; x++) mark(x, y, 0xf0ecde, wearAt(x, 0, 0.08)); // norrut
  }
  // hajtänder där Infarten mynnar i Pixelgatan (norrut) och Södergatan (söderut)
  for (let tx = 1729; tx + 5 <= I1 - 2; tx += 7) for (let r = 0; r < 3; r++) for (let i = 2 - r; i <= 2 + r; i++) mark(tx + i, y0 + 2 - r, 0xece6d2, 0.12);
  for (let tx = I0 + 3; tx + 5 <= 1724; tx += 7) for (let r = 0; r < 3; r++) for (let i = 2 - r; i <= 2 + r; i++) mark(tx + i, y1 - 5 + r, 0xece6d2, 0.12);
  // pilar: söderut delar sig vänster/höger mot Södergatan, norrut rakt fram
  const arrow = (cx, cy, dir, split) => {
    for (let j = 0; j < 14; j++) for (const dx of [0, 1]) mark(cx + dx, cy + j * dir, 0xeee8d4, 0.15);
    if (split) { for (let j = 0; j < 6; j++) { mark(cx - j - 1, cy + (13 - j) * dir, 0xeee8d4, 0.15); mark(cx + j + 2, cy + (13 - j) * dir, 0xeee8d4, 0.15); } }
    else for (let r = 0; r < 4; r++) for (let i = -r; i <= r + 1; i++) mark(cx + i, cy + (14 + 3 - r) * dir, 0xeee8d4, 0.15);
  };
  arrow(1712, 600, 1, true); arrow(1738, 350, -1, false);
  manhole(1739, 470, 5, 2.6, 0.5); grate(I0, 400, 3, 8, false, 0.4); grate(I1 - 3, 560, 3, 8, false, 0.5);
  scatter([I0, y0 + 30, I0 + 4, y1 - 30], 20, 974); scatter([I1 - 5, y0 + 30, I1, y1 - 30], 26, 975);
}

// =====================================================================
// PARKEN (306–490) – gräs, grusgångar, torget, dammen, hundrastgården, lekplatsen, ängen
// =====================================================================
const GR = [0x2d5a28, 0x3a7131, 0x49863a, 0x5a9a42, 0x6daf4b, 0x88c458];
const PRX = PARK_LAYOUT.plaza.r * 1.2, PRY = PARK_LAYOUT.plaza.r * 0.96;
const PX1 = IW0, PY1 = TOP_S;                                                      // parkens ruta: x 0–1686, y 306–494
// mask: 0 gräs, 1 grus, 2 torget, 3 dammen, 4 sand, 5 hundrastgården, 6 platta, 8 ängen
function parkMask() {
  const M = new Uint8Array(PX1 * (PY1 - PK0));
  const { cx, cy } = PARK_LAYOUT.plaza, [px0, py0, px1, py1] = PARK_LAYOUT.promenade;
  const paths = [...PARK_LAYOUT.paths, ...PARK_LAYOUT.walks, PARK_LAYOUT.promenade, PARK_LAYOUT.back];
  const pond = PARK_LAYOUT.pond, pg = PARK_LAYOUT.playground, dog = PARK_LAYOUT.dogPark, mw = PARK_LAYOUT.meadow;
  const dogX1 = Math.min(dog[2], ...PARK_LAYOUT.walks.filter((w) => w[0] < dog[2] && w[2] > dog[0]).map((w) => w[0]));
  const pads = FREESTANDING.filter((b) => b.district === 'PARKEN').map((b) => [b.x - 2, b.top - 2, b.x + b.w + 2, b.base + 3]);
  for (let y = PK0; y < PY1; y++) for (let x = 0; x < PX1; x++) {
    let m = 0;
    if (y >= BS1) m = 9;                                                                      // kanten mot södra raden
    else {
      for (const r of paths) if (x >= r[0] && x < r[2] && y >= r[1] && y < r[3]) { m = 1; break; }
      if (m && y >= py0 && y < py1 && (x < px0 + 2 || x >= px1 - 2)) {                           // rundade ändar på promenaden
        const ex = x < px0 + 2 ? x - px0 : px1 - 1 - x, ey = Math.min(y - py0, py1 - 1 - y);
        if (ex + ey < 2) m = 0;
      }
      if (Math.hypot((x + 0.5 - cx) / PRX, (y + 0.5 - cy) / PRY) < 1) m = 2;
      if (!m) {
        if (Math.hypot((x + 0.5 - pond.cx) / pond.rx, (y + 0.5 - pond.cy) / pond.ry) < 1) m = 3;
        else if (inR(x, y, pg)) m = 4;
        else if (x >= dog[0] && x < dogX1 && y >= dog[1] && y < dog[3]) m = 5;
        else if (pads.some((r) => inR(x, y, r))) m = 6;
        else if (inR(x, y, mw) && fbm(x, y, 16, 150) + Math.min(x - mw[0], mw[2] - x, y - mw[1], mw[3] - y) / 60 > 0.62) m = 8;
      }
    }
    M[(y - PK0) * PX1 + x] = m;
  }
  return M;
}
function paintPark() {
  const M = parkMask();
  const mk = (x, y) => (x < 0 || x >= PX1 || y < PK0 || y >= PY1 ? 1 : M[(y - PK0) * PX1 + x]);
  const grassy = (m) => m === 0 || m === 8 || m === 5;
  // gräs: fläckigt i flera skalor, små tuvor med ljus ovansida (ängen: ljusare, gulare, högre)
  for (let y = PK0; y < BS0; y++) for (let x = 0; x < PX1; x++) {
    const m = mk(x, y);
    if (!grassy(m)) continue;
    const emb = vnoise(x, y, 3.4, 105) - vnoise(x + 0.7, y + 1.6, 3.4, 105);                   // tuvor, ljusa ovanpå
    const n = fbm(x, y, 30, 101) * 0.6 + vnoise(x, y, 9, 102) * 0.24 + emb * 0.85 + (hash(x, y, 103) - 0.5) * 0.12 + 0.08;
    const i = n < 0.3 ? 0 : n < 0.41 ? 1 : n < 0.53 ? 2 : n < 0.65 ? 3 : n < 0.77 ? 4 : 5;
    let c = mul(GR[i], 0.97 + hash(x, y, 104) * 0.05);
    if (m === 8) c = mix(c, 0x9aa850, 0.22 + vnoise(x, y, 11, 151) * 0.2);
    put(x, y, c);
  }
  // grässtrån (lodräta små streck med ljus topp) – högre på ängen
  for (let y = PK0 + 3; y < BS0; y++) for (let x = 1; x < PX1 - 1; x++) {
    const m = mk(x, y);
    if (!grassy(m) || !grassy(mk(x, y - 1)) || !grassy(mk(x, y - 2)) || hash(x, y, 110) < (m === 8 ? 0.8 : 0.9)) continue;
    const lean = hash(x, y, 111) < 0.3 ? -1 : hash(x, y, 111) > 0.7 ? 1 : 0;
    put(x, y, GR[1]); put(x, y - 1, GR[3]);
    if (hash(x, y, 112) > 0.4 && grassy(mk(x + lean, y - 2))) put(x + lean, y - 2, GR[hash(x, y, 113) > 0.6 ? 5 : 4]);
    if (m === 8 && hash(x, y, 114) > 0.5 && grassy(mk(x + lean, y - 3))) put(x + lean, y - 3, hash(x, y, 115) > 0.7 ? 0xd8d890 : 0xa8b860); // vippor
  }
  // klöver i fläckar
  for (let y = PK0 + 2; y < BS0 - 2; y++) for (let x = 1; x < PX1 - 2; x++) {
    if (mk(x, y) !== 0 || mk(x + 1, y) !== 0 || mk(x, y + 1) !== 0 || vnoise(x, y, 14, 120) < 0.68 || hash(x, y, 121) < 0.93) continue;
    put(x, y, 0x5aa662); put(x + 1, y, 0x4c9658); put(x, y + 1, 0x3e8048); put(x + 1, y + 1, 0x2e6a3a);
    if (hash(x, y, 122) > 0.9) put(x, y - 1, 0xecdcec);                                       // klöverblomma
  }
  // blommor: ängsfläckar med prästkragar, maskrosor, violer, rödklöver, smörblommor (tätt på ängen)
  for (let y = PK0 + 3; y < BS0 - 1; y++) for (let x = 1; x < PX1 - 3; x++) {
    const m = mk(x, y);
    if ((m !== 0 && m !== 8) || mk(x + 2, y) !== m || mk(x, y + 1) !== m) continue;
    const mv = vnoise(x, y, 34, 130) + (m === 8 ? 0.3 : 0), h = hash(x, y, 131);
    if (!(mv > 0.6 ? h > 0.99 - (mv - 0.6) * 0.04 : h > 0.9993)) continue;
    const k = hash(x, y, 132);
    if (k < 0.42) {                                                                           // prästkrage
      put(x, y + 1, 0x3e7a34);
      if (k < 0.2) { put(x - 1, y, 0xf6f4ec); put(x, y, 0xf2c830); put(x + 1, y, 0xf6f4ec); put(x, y - 1, 0xf6f4ec); }
      else put(x, y, 0xf6f4ec);
    } else if (k < 0.64) { put(x, y, 0xf6d23a); put(x, y + 1, 0xc49a22); }                     // maskros
    else if (k < 0.78) { put(x, y, 0x9a7ae0); put(x, y + 1, 0x6a50b0); }                       // viol
    else if (k < 0.9) { put(x, y, 0xe07aa2); put(x + 1, y, 0xc85a88); }                        // rödklöver
    else put(x, y, 0xfbe45a);                                                                 // smörblomma
  }
  // trampstigar där folk genar över gräset
  for (const [ax, ay, bx, by, wd] of [[598, PK0, 640, 334, 5], [1224, 318, 1196, 334, 4], [300, 318, 326, 334, 3.5], [412, 346, 412, 426, 3], [780, 346, 779, 428, 3], [1166, 346, 1154, 378, 3], [1340, 346, 1340, 406, 3.5]]) {
    const L = Math.hypot(bx - ax, by - ay);
    for (let y = Math.min(ay, by) - 6; y < Math.max(ay, by) + 6; y++) for (let x = Math.min(ax, bx) - 8; x < Math.max(ax, bx) + 8; x++) {
      if (mk(x, y) !== 0 || y < PK0) continue;
      const t = Math.max(0, Math.min(1, ((x - ax) * (bx - ax) + (y - ay) * (by - ay)) / (L * L)));
      const dd = Math.hypot(x - (ax + (bx - ax) * t), y - (ay + (by - ay) * t)) + (vnoise(x, y, 4, 140) - 0.5) * 2;
      const q = 1 - dd / wd;
      if (q <= 0) continue;
      if (bayer(x, y) < q * 1.4) put(x, y, mix(0x9a8458, 0x7e6a44, hash(x, y, 141)));
      else put(x, y, mix(get(x, y), 0xa8a860, 0.35));
    }
  }
  // mullvadshögar
  for (const [mx, my] of [[152, 396], [712, 404], [1566, 402], [1106, 388], [520, 440], [1450, 430]]) {
    if (mk(mx, my) !== 0 && mk(mx, my) !== 8) continue;
    ellipse(mx, my, 3.5, 2, (x, y, t) => put(x, y, y < my - 0.5 ? (t < 0.5 ? 0x8a6c4c : 0x72563a) : 0x5a4230));
    for (let x = mx - 4; x < mx + 4; x++) shade(x, my + 2, 0.8);
  }
  paintDogRun(mk);
  // grus
  const [, py0, , py1] = PARK_LAYOUT.promenade;
  for (let y = PK0; y < BS1; y++) for (let x = 0; x < PX1; x++) {
    if (mk(x, y) !== 1) continue;
    const edge = mk(x - 1, y) !== 1 || mk(x + 1, y) !== 1 || mk(x, y - 1) !== 1 || mk(x, y + 1) !== 1 || mk(x - 2, y) !== 1 || mk(x + 2, y) !== 1;
    const center = y >= py0 + 4 && y < py1 - 4;
    let c = mix(0xc6b28c, 0xd6c6a2, vnoise(x, y, 9, 401) * (center ? 1.2 : 0.8));
    c = mul(c, 0.94 + hash(x, y, 402) * 0.1);
    const h = hash(x, y, 403), thr = center ? 0.95 : edge ? 0.86 : 0.92;
    if (h > thr) c = [0xe8dcc0, 0xd8c8a4, 0xb8906c, 0xa6a098][(hash(x, y, 404) * 4) | 0];     // småsten
    else if (hash(x, y - 1, 403) > thr) c = mul(c, 0.78);                                       // stenens skugga
    else if (h < 0.05) c = mul(c, 0.82);
    if (edge) c = mul(c, 0.9);
    if (y >= BS0 && y < BS1 && Math.abs(y - (BS0 + 12 + Math.sin(x * 0.02) * 3)) < 4 && bayer(x, y) < 0.2) c = mul(c, 0.93); // nött mitt i parkgången
    put(x, y, c);
  }
  // cykelspår i promenaden och parkgången
  for (let x = 60; x < PX1 - 60; x++) {
    if (x > 860 && x < 1010) continue;
    const y = Math.round(339.5 + Math.sin(x * 0.045) * 1.4 + Math.sin(x * 0.013) * 1.1);
    if (mk(x, y) === 1 && hash(x, 0, 406) > 0.15) put(x, y, mul(get(x, y), 0.86));
    const y2 = Math.round(BS0 + 14 + Math.sin(x * 0.037) * 2.4 + Math.sin(x * 0.011) * 1.6);
    if (mk(x, y2) === 1 && hash(x, 1, 406) > 0.2) put(x, y2, mul(get(x, y2), 0.87));
  }
  // kantsten mellan gräs och grus
  for (let y = PK0; y < BS1; y++) for (let x = 0; x < PX1; x++) {
    if (!grassy(mk(x, y))) continue;
    const dn = mk(x, y + 1) === 1, up = mk(x, y - 1) === 1, lr = mk(x - 1, y) === 1 || mk(x + 1, y) === 1;
    if (dn) put(x, y, granite(x, y, 0xd6d1c7));
    else if (up) { put(x, y, granite(x, y, 0xa29d94)); if (grassy(mk(x, y + 1))) shade(x, y + 1, 0.82); }
    else if (lr) put(x, y, granite(x, y, 0xbab5ab));
  }
  paintPlaza(mk);
  paintPond(mk);
  paintPlayground(mk);
  paintPads(mk);
  // kanten mellan parkgången och den södra raden (y 490–494): granitkant och en smal rännsten
  for (let x = 0; x < I0; x++) {
    put(x, BS1, granite(x, BS1, 0xc8c3b9)); put(x, BS1 + 1, granite(x, BS1 + 1, 0x9a958c));
    put(x, BS1 + 2, mul(dirt(x, BS1 + 2), 0.7)); put(x, BS1 + 3, mul(dirt(x, BS1 + 3), 0.6));
  }
  // kantstenens skugga där parken möter trottoaren
  for (let x = 0; x < PX1; x++) { if (grassy(mk(x, PK0))) shade(x, PK0, 0.74); if (grassy(mk(x, PK0 + 1)) && bayer(x, PK0 + 1) < 0.5) shade(x, PK0 + 1, 0.88); }
}
// hundrastgården: nött gräs, jordfläckar, ett upptrampat spår innanför staketet och tassavtryck
function paintDogRun(mk) {
  const [x0, y0, , y1] = PARK_LAYOUT.dogPark;
  let x1 = x0; for (let x = x0; x < PX1; x++) if (mk(x, y0 + 5) === 5) x1 = x + 1;
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    if (mk(x, y) !== 5) continue;
    const e = Math.min(x - x0, x1 - 1 - x, y - y0, y1 - 1 - y) + (vnoise(x, y, 9, 163) - 0.5) * 5;
    const along = vnoise(x * 0.5, y * 0.5, 7, 164);                                           // spåret är tydligt på sina ställen, borta på andra
    const run = e >= 2 && e <= 10 ? (1 - Math.abs(e - 6) / 4) * (0.3 + along) : 0;             // spåret längs staketet
    const q = fbm(x, y, 12, 160) * 0.8 + run * 0.55 + (hash(x, y, 161) - 0.5) * 0.2;
    if (q > 0.62) put(x, y, dirt(x, y));
    else if (q > 0.5) put(x, y, mix(get(x, y), 0x8a7a54, 0.5));
  }
  // vägen från grinden
  const [g0, g1] = PARK_LAYOUT.dogGate;
  for (let y = PARK_LAYOUT.promenade[3]; y < y0 + 16; y++) for (let x = g0 + 2; x < g1 - 2; x++) if (bayer(x, y) < 0.7 - (y - y0) / 30) put(x, y, dirt(x, y));
  // tassavtryck och ett grävt hål
  for (let i = 0; i < 40; i++) {
    const x = x0 + 6 + ((hash(i, 1, 162) * (x1 - x0 - 12)) | 0), y = y0 + 6 + ((hash(i, 2, 162) * (y1 - y0 - 12)) | 0);
    if (mk(x, y) !== 5) continue;
    blend(x, y, 0x4a3a28, 0.5); blend(x + 2, y + 1, 0x4a3a28, 0.5);
  }
  ellipse(x0 + 30, y1 - 22, 3, 1.6, (x, y) => put(x, y, 0x3a2c1e)); ellipse(x0 + 30, y1 - 20, 5, 1.4, (x, y, t) => { if (t > 0.5) put(x, y, 0x8a6c4c); });
  put(x0 + 60, y0 + 40, 0xd8e040); put(x0 + 61, y0 + 40, 0xb8c030); put(x0 + 60, y0 + 41, 0x9aa028);   // en tennisboll
}
// dammen: stenkant, grund strand, djupt i mitten, näckrosor och himlens spegling
function paintPond(mk) {
  const { cx, cy, rx, ry } = PARK_LAYOUT.pond;
  for (let y = Math.floor(cy - ry * 1.3); y <= cy + ry * 1.3; y++) for (let x = Math.floor(cx - rx * 1.3); x <= cx + rx * 1.3; x++) {
    const t = Math.hypot((x + 0.5 - cx) / rx, (y + 0.5 - cy) / ry) + (vnoise(x, y, 3, 170) - 0.5) * 0.05;
    const m = mk(x, y);
    if (t < 0.93) {
      const dy = (y + 0.5 - cy) / ry;
      let c = mix(0x5a8a8e, 0x1e4a5e, clamp01(1.1 - t * 1.1));                              // grunt vid kanten, djupt i mitten
      c = mix(c, 0x9ac4d8, clamp01(-dy * 0.5) * 0.35);                                      // himlen speglas i bortre halvan
      if (t > 0.8) c = mix(c, 0x6a7a4a, 0.35);                                               // botten syns i strandkanten
      const r = vnoise(x * 0.35, y * 2, 3, 171);
      if (r > 0.72) c = mix(c, 0xd0e4ee, 0.35); else if (r < 0.22) c = mul(c, 0.88);         // krusningar
      put(x, y, c);
      continue;
    }
    if (t < 1.18 && (m === 3 || m === 0 || m === 8)) {
      // strandstenar: runda, mossiga
      const v = cellAt(x, y, 4, 3, 172), e = v.d2 - v.d1;
      let c = e < 0.12 ? 0x3e4a2e : mul(mix(0x9a948a, 0x7e7a70, hash(v.id, 1, 173)), 0.9 + hash(v.id, 2, 173) * 0.2);
      const ly = (y + 0.5 - v.py) / 3;
      if (e >= 0.12 && ly < -0.2) c = mix(c, 0xffffff, 0.2); else if (e >= 0.12 && ly > 0.3) c = mul(c, 0.78);
      if (vnoise(x, y, 4, 174) > 0.6 && e >= 0.12) c = mix(c, 0x5a7a3a, 0.4);                  // mossa
      if (t < 0.99) c = mul(c, 0.8);                                                           // våt nertill
      put(x, y, c);
    }
  }
  // skugga från strandkanten på vattnet (bortre kanten)
  ellipse(cx, cy, rx * 0.93, ry * 0.93, (x, y, t) => { if (t > 0.84 && y < cy && bayer(x, y) < 0.6) shade(x, y, 0.82); });
  // näckrosor
  for (let k = 0; k < 8; k++) {
    const lx = Math.round(cx + (hash(k, 1, 175) - 0.5) * rx * 1.4), ly = Math.round(cy + (hash(k, 2, 175) - 0.5) * ry * 1.2);
    if (Math.hypot((lx - cx) / rx, (ly - cy) / ry) > 0.8) continue;
    for (let i = -2; i <= 2; i++) put(lx + i, ly, i === 0 ? 0x3a7a3a : 0x4a8a3a); put(lx - 1, ly - 1, 0x5a9a4a); put(lx + 1, ly - 1, 0x5a9a4a); put(lx, ly - 1, 0x2e5e2e);
    for (let i = -2; i <= 2; i++) shade(lx + i, ly + 1, 0.8);
    if (k % 3 === 0) { put(lx, ly - 1, 0xf4c4d8); put(lx + 1, ly - 2, 0xfae4ec); }            // blomma
  }
}
// lekplatsen i parken: sand i en träram, krattspår, fotspår och lite leksaker
function paintPlayground(mk) {
  const [x0, y0, x1, y1] = PARK_LAYOUT.playground;
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    const e = Math.min(x - x0, x1 - 1 - x, y - y0, y1 - 1 - y);
    let c;
    if (e < 2) {                                                                              // träramen (sliper)
      c = e === 0 ? 0x5a3e24 : 0x8a6238;
      if ((y === y0 || y === y1 - 1) ? (x - x0) % 20 === 19 : (y - y0) % 20 === 19) c = 0x3a2616;
      c = grainy(c, x, y, 0.1);
    } else {
      c = mix(0xd8c49a, 0xe6d6ae, vnoise(x, y, 6, 180));
      if (Math.sin((x + y * 0.3) * 0.9) > 0.85) c = mul(c, 0.94);                               // krattspår
      if (vnoise(x, y, 5, 181) > 0.7) c = mix(c, 0xb8a078, 0.4);                                 // fuktig, uppgrävd sand
      const h = hash(x, y, 182);
      if (h > 0.97) c = 0xf4ead0; else if (h < 0.03) c = 0xa8946e;
    }
    put(x, y, c);
  }
  // nött under gungorna och vid rutschkanans slut, fotspår
  ellipse(1056, 438, 12, 4, (x, y, t) => { if (bayer(x, y) < (1 - t)) put(x, y, mix(get(x, y), 0x9a8460, 0.5)); });
  ellipse(1094, 437, 6, 3, (x, y, t) => { if (bayer(x, y) < (1 - t)) put(x, y, mix(get(x, y), 0x9a8460, 0.45)); });
  for (let i = 0; i < 30; i++) { const x = x0 + 4 + ((hash(i, 1, 183) * (x1 - x0 - 8)) | 0), y = y0 + 4 + ((hash(i, 2, 183) * (y1 - y0 - 8)) | 0); blend(x, y, 0x8a7450, 0.4); blend(x + 1, y, 0x8a7450, 0.3); }
  put(1076, 420, 0xd83a2a); put(1077, 420, 0xb02a1e); put(1076, 421, 0x8a2016); put(1078, 419, 0x3a6ad0);  // en röd hink och en blå spade
  for (let x = x0; x < x1; x++) shade(x, y1, 0.8);
}
// plattor under och framför parkens småhus (kiosken, toaletten, glasskiosken, förrådet, paviljongen)
function paintPads(mk) {
  for (const b of FREESTANDING.filter((f) => f.district === 'PARKEN')) {
    const r = [b.x - 2, b.top - 2, b.x + b.w + 2, b.base + 3];
    for (let y = r[1]; y < r[3]; y++) for (let x = r[0]; x < r[2]; x++) put(x, y, concrete(x, y, 8, 8, 190 + b.x, 0));
    // en plattgång från dörren ner till närmaste grusgång
    let y = b.base + 3;
    while (y < BS1 && mk((b.door.x0 + b.door.x1) >> 1, y) !== 1 && y < b.base + 40) {
      for (let x = b.door.x0; x < b.door.x1; x++) put(x, y, concrete(x, y, 8, 6, 191 + b.x, 0));
      y++;
    }
    for (let x = r[0]; x < r[2]; x++) shade(x, r[3], 0.82);
  }
}
// torget: ringar av smågatsten i solfjäder, åttauddig stjärna i rödgranit, mörk kant
function paintPlaza(mk) {
  const { cx, cy } = PARK_LAYOUT.plaza, NR = 14, TAU = Math.PI * 2;
  const idAt = (x, y) => {
    const dx = (x + 0.5 - cx) / PRX, dy = (y + 0.5 - cy) / PRY, t = Math.hypot(dx, dy);
    if (t >= 1) return -1;
    const ring = Math.floor(t * NR);
    if (ring >= NR - 1) return 90000 + Math.floor((Math.atan2(dy, dx) / TAU + 0.5) * 40);    // kantstenen
    const count = Math.max(6, Math.round(ring * 6.4));
    const k = Math.floor(((Math.atan2(dy, dx) / TAU + 0.5) + ring * 0.37) * count) % count;
    return ring * 1000 + k;
  };
  for (let y = Math.floor(cy - PRY) - 1; y <= cy + PRY + 1; y++) for (let x = Math.floor(cx - PRX) - 1; x <= cx + PRX + 1; x++) {
    if (mk(x, y) !== 2) continue;
    const id = idAt(x, y);
    if (id < 0) continue;
    const dx = (x + 0.5 - cx) / PRX, dy = (y + 0.5 - cy) / PRY, t = Math.hypot(dx, dy);
    const joint = idAt(x + 1, y) !== id || idAt(x, y + 1) !== id, top = idAt(x, y - 1) !== id, left = idAt(x - 1, y) !== id;
    let c;
    if (id >= 90000) {                                                                        // mörk kantsten runt torget
      c = joint ? 0x4a4642 : dy < 0 ? 0xa29d95 : 0x7a766f;
      if (top && !joint) c = mix(c, 0xffffff, 0.22);
      put(x, y, granite(x, y, c));
      continue;
    }
    const ring = Math.floor(t * NR);
    // åttauddig kompassros (avgörs per sten, så uddarna följer fogarna): långa uddar i
    // väderstrecken, korta på diagonalerna
    const count = Math.max(6, Math.round(ring * 6.4)), k = id - ring * 1000;
    const sa = (mod((k + 0.5) / count - ring * 0.37, 1) - 0.5) * TAU;
    const Q = Math.PI / 2, dMain = Math.abs(mod(sa + Q / 2, Q) - Q / 2), dDiag = Math.abs(mod(sa, Q) - Q / 2);
    const main = ring >= 4 && ring <= 11 && dMain < 0.28 * (1 - (ring - 4) / 8.5);
    const diag = !main && ring >= 4 && ring <= 8 && dDiag < 0.22 * (1 - (ring - 4) / 5.5);
    if (ring === 12 || ring === 3) c = 0x7a756e;                                              // mörka band
    else if (main) c = 0xbc836a;                                                              // rödgranit
    else if (diag) c = 0x7e7872;                                                              // mörkgrå granit
    else if (ring <= 2) c = 0xd2ccc2;                                                         // ljus mitt (fontänen står här)
    else c = ring & 1 ? 0xd0c6b6 : 0xc6c0b6;
    c = mul(c, 0.9 + hash(id, 7, 480) * 0.16);
    if (joint) c = mul(0x5a5650, 0.9 + hash(x, y, 481) * 0.2);
    else if (top) c = mix(c, 0xffffff, 0.2);
    else if (left) c = mix(c, 0xffffff, 0.08);
    else if (idAt(x, y + 2) !== id) c = mul(c, 0.88);
    put(x, y, grainy(c, x, y, 0.05));
  }
  // lätt skugga på gräset söder om torgets kantsten
  ellipse(cx, cy, PRX + 1.5, PRY + 1.5, (x, y) => { if ((mk(x, y) === 0 || mk(x, y) === 8) && y > cy) shade(x, y, 0.84); });
}

// =====================================================================
// DOWNTOWN (v3) – FINANSTORGET (y 306–462) och bakgatan bakom den södra raden (462–490).
// Ljus, varm granit i hällar 16 × 8 (halvförband); ett kantband av mörk granit mot Infarten,
// kajen och bakgatan; axeln (Bankgatans mittlinje) är ett stråk av polerad svart diabas med en
// inlagd mässingslist, och ett tvärband av mörk granit binder ihop fontänerna och tjuren.
// Kompassrosen kring statyn och stenringarna under fontänerna ligger ovanpå. (Rekvisitan –
// statyn, fontänerna, planteringslådorna, bänkarna – står i props.js.)
// =====================================================================
function paintDowntownBand() {
  if (!DOWNTOWN_LAYOUT) return;
  const [x0, y0, x1, y1] = DOWNTOWN_LAYOUT.plaza, ax = DOWNTOWN_LAYOUT.axis, ST = DOWNTOWN_LAYOUT.statue, FO = DOWNTOWN_LAYOUT.fountains || [];
  const LIGHT = [0xd9d5cb, 0xd1cdc3, 0xdedacf, 0xcbc7bd, 0xd5d0c5], MID = [0xa8a39a, 0x9e998f], DIA = [0x3e4148, 0x46494f, 0x383b41];
  const cyB = ST ? ST.y : (y0 + y1) >> 1;                                                     // tvärbandets mitt (statyn och fontänerna)
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    const edge = x < x0 + 5 || x >= x1 - 5 || y >= y1 - 5;                                   // kantbandet
    const axisB = Math.abs(x + 0.5 - ax) < 7;                                                // axeln: polerad diabas
    const cross = Math.abs(y + 0.5 - cyB) < 5 && !edge;                                      // tvärbandet
    let c;
    if (axisB && !edge) {
      const ly = mod(y - y0, 12), lx = Math.round(Math.abs(x + 0.5 - ax));
      if (lx === 0) c = (y & 1) ? 0xd8b060 : 0xb08a40;                                        // mässingslisten
      else if (ly === 11 || lx === 6) c = 0x24262a;
      else { c = DIA[(hash(Math.floor((y - y0) / 12), x > ax ? 1 : 0, 1508) * 3) | 0]; if (ly === 0) c = mix(c, 0xb8c0cc, 0.22); if (hash(x, y, 1509) > 0.95) c = mix(c, 0xe0e6ee, 0.4); }
    } else if (edge || cross) {
      const u = edge ? (y >= y1 - 5 ? x - x0 : y - y0) : x - x0, lu = mod(u, 20), lv = edge ? (y >= y1 - 5 ? y - (y1 - 5) : (x < x0 + 5 ? x - x0 : x - (x1 - 5))) : Math.round(y + 0.5 - (cyB - 5));
      if (lu === 19) c = 0x5e5a54;
      else { c = MID[(hash(Math.floor(u / 20), edge ? 1 : 2, 1510) * 2) | 0]; if (lv === 0) c = mix(c, 0xffffff, 0.1); else if (lv >= 4 && !edge) c = mul(c, 0.9); c = granite(x, y, c); }
    } else {
      const row = Math.floor((y - y0) / 8), u = x - x0 + (row & 1) * 8, lx = mod(u, 16), ly = mod(y - y0, 8), k = Math.floor(u / 16);
      if (lx === 15 || ly === 7) c = mul(0x9a958b, 0.95 + hash(x, y, 1502) * 0.08);          // fog
      else {
        c = LIGHT[(hash(k, row, 1503) * LIGHT.length) | 0];
        if (ly === 0) c = mix(c, 0xffffff, 0.1); else if (ly === 6) c = mul(c, 0.93);
        if (lx === 0) c = mix(c, 0xffffff, 0.05); else if (lx === 14) c = mul(c, 0.95);
        c = granite(x, y, c);
      }
    }
    put(x, y, c);
  }
  // kompassrosen kring statyn: polerad ljus skiva, mörk ring och en åttauddig stjärna i svart diabas
  if (ST) ellipse(ST.x, ST.y, 40, 22, (x, y, t) => {
    const a = Math.atan2((y + 0.5 - ST.y) / 22, (x + 0.5 - ST.x) / 40), star = Math.abs(Math.cos(a * 4)) ** 6 * (1 - t) > 0.18 && t > 0.3;
    let c = t > 0.88 ? 0x5e5a56 : t > 0.8 ? 0xb8b2a6 : star ? (Math.cos(a * 8) > 0 ? 0x3a3a3e : 0x55555a) : 0xe4dfd4;
    if (t > 0.88 && hash(x, y, 1505) > 0.7) c = 0x6e6a66;
    put(x, y, granite(x, y, c));
  });
  // stenringar under fontänerna (bassängen ritas av rekvisitan)
  for (const f of FO) ellipse(f.x, f.y, 34, 18, (x, y, t) => {
    if (t < 0.72) return;
    put(x, y, granite(x, y, t > 0.9 ? 0x6e6a64 : mod(Math.round(Math.atan2(y - f.y, (x - f.x) / 1.9) * 9), 2) ? 0x9a948c : 0x8a857e));
  });
  // lite liv i stenen: tuggummi, en och annan fläck – finanskvarteret sopas varje morgon
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) if (hash(x, y, 1506) > 0.9985) put(x, y, 0x7c7872);
  for (let i = 0; i < 18; i++) stain(x0 + 20 + hash(i, 1, 1507) * (x1 - x0 - 40), y0 + 10 + hash(i, 2, 1507) * (y1 - y0 - 24), 2 + hash(i, 3, 1507) * 3, 1.2, 0.1, 0x3a3026);
  // bakgatan: mörk, välskött asfalt med granitkant mot torget, en ränna i mitten och brunnslock
  const [bx0, by0, bx1, by1] = DOWNTOWN_LAYOUT.back;
  for (let y = by0; y < by1; y++) for (let x = bx0; x < bx1; x++) {
    let c = asphaltW(x, y, 0.02, false, 0);
    if (y < by0 + 2) c = granite(x, y, y === by0 ? 0xc6c1b7 : 0x8e8a82);                       // kantsten mot torget
    else if (y === by0 + 2) c = mul(c, 0.7);                                                  // kantstenens skugga
    else if (y === (by0 + by1) >> 1) c = mix(c, 0x2a2c30, 0.5);                               // rännan
    else if (y >= by1 - 2) c = mul(c, 0.8);                                                   // mot husens baksidor
    put(x, y, c);
  }
  for (let x = bx0 + 60; x < bx1 - 20; x += 150) lid(x, by0 + 9, 8, 5);
  for (let x = bx0 + 130; x < bx1 - 20; x += 150) grate(x, ((by0 + by1) >> 1) - 1, 7, 3, true, 0.2);
  // skuggan från trottoarens kantsten ner över torgets norra kant
  for (let x = x0; x < x1; x++) { shade(x, y0, 0.8); if (bayer(x, y0 + 1) < 0.5) shade(x, y0 + 1, 0.9); }
}

// =====================================================================
// LINNÉSTADEN (v4) – mellanbandet väster om centrum (x X0–0, y 306–494):
// MARKNADSTORGET i bågsatt smågatsten (grå och röd granit), ett kantband av långa hällar och
// en stenring kring brunnen; STADSODLINGEN (barkflis och pallkragar med grönsaker, bär och
// lavendel); LINDPARKEN (gräsmatta full av blommor, rabatter, grusgångar och musikpaviljongens
// gruscirkel) som möter centrums park vid x 0; parkgången bakom den södra raden.
// Rekvisitan (brunnen, lindarna, bänkarna, paviljongen, boden) står i props.js.
// =====================================================================
const COBL = [0xa8a298, 0x9e988e, 0xb2aca2, 0x948e86, 0xaaa092];
const COBR = [0xb07a66, 0xa06a58, 0xb8846e];
const BED_PLANT = [
  [0x4f9a3a, 0x6dbb48, 0x3a7a2c],   // sallad
  [0x5aa040, 0x8ac858, 0xe0802a],   // morötter
  [0x3e8a34, 0x5aa846, 0xd8303a],   // jordgubbar
  [0x6a8a5a, 0x8aa070, 0x9a7ad8],   // lavendel
];
const FLOWERS = [[0xd8303a, 0xf2c830], [0xf09ab8, 0xf4f0f4], [0x9a7ad8, 0xc8b0f0], [0xf08a2a, 0xf6d23a], [0xf4f0f4, 0xd8303a]];
function linneMask() {
  // 0 gräs, 1 grus, 2 torget, 3 barkflis, 4 pallkrage, 6 rabatt, 7 paviljongens cirkel, 9 kanten mot södra raden
  const L = LINNE_LAYOUT, w = -X0, M = new Uint8Array(w * (TOP_S - PK0)), pv = L.pavilion;
  const grus = [L.promenade, ...L.walks, L.back];
  for (let y = PK0; y < TOP_S; y++) for (let x = X0; x < 0; x++) {
    let m = 0;
    if (y >= BS1) m = 9;
    else if (inR(x, y, L.torg)) m = 2;
    else if (grus.some((r) => inR(x, y, r))) m = 1;
    else if (Math.hypot((x + 0.5 - pv.x) / pv.rx, (y + 0.5 - pv.y) / pv.ry) < 1) m = 7;
    else if (L.beds.some((r) => inR(x, y, r))) m = 4;
    else if (inR(x, y, L.odling)) m = 3;
    else if (L.beds2.some((r) => inR(x, y, r))) m = 6;
    M[(y - PK0) * w + x - X0] = m;
  }
  return M;
}
function paintLinneBand() {
  if (X0 >= 0 || !LINNE_LAYOUT) return;
  const L = LINNE_LAYOUT, M = linneMask(), w = -X0;
  const mk = (x, y) => (x < X0 || x >= 0 || y < PK0 || y >= TOP_S ? 1 : M[(y - PK0) * w + x - X0]);
  // gräset: samma fläckiga gräs som parken (möts sömlöst vid x 0)
  for (let y = PK0; y < BS0; y++) for (let x = X0; x < 0; x++) {
    if (mk(x, y) !== 0) continue;
    const emb = vnoise(x, y, 3.4, 105) - vnoise(x + 0.7, y + 1.6, 3.4, 105);
    const n = fbm(x, y, 30, 101) * 0.6 + vnoise(x, y, 9, 102) * 0.24 + emb * 0.85 + (hash(x, y, 103) - 0.5) * 0.12 + 0.08;
    const i = n < 0.3 ? 0 : n < 0.41 ? 1 : n < 0.53 ? 2 : n < 0.65 ? 3 : n < 0.77 ? 4 : 5;
    put(x, y, mul(GR[i], 0.97 + hash(x, y, 104) * 0.05));
  }
  for (let y = PK0 + 3; y < BS0; y++) for (let x = X0 + 1; x < -1; x++) {                     // grässtrån
    if (mk(x, y) || mk(x, y - 1) || mk(x, y - 2) || hash(x, y, 110) < 0.9) continue;
    const lean = hash(x, y, 111) < 0.3 ? -1 : hash(x, y, 111) > 0.7 ? 1 : 0;
    put(x, y, GR[1]); put(x, y - 1, GR[3]);
    if (hash(x, y, 112) > 0.4 && !mk(x + lean, y - 2)) put(x + lean, y - 2, GR[hash(x, y, 113) > 0.6 ? 5 : 4]);
  }
  // blommor i gräset – tätare än i parken (Lindparken är stadsdelens stolthet)
  for (let y = PK0 + 3; y < BS0 - 1; y++) for (let x = X0 + 1; x < -3; x++) {
    if (mk(x, y) || mk(x + 2, y) || mk(x, y + 1)) continue;
    const mv = vnoise(x, y, 30, 1630), h = hash(x, y, 131);
    if (!(h > (mv > 0.55 ? 0.982 : 0.996))) continue;
    const k = hash(x, y, 132);
    if (k < 0.4) { put(x, y + 1, 0x3e7a34); put(x - 1, y, 0xf6f4ec); put(x, y, 0xf2c830); put(x + 1, y, 0xf6f4ec); put(x, y - 1, 0xf6f4ec); }   // prästkrage
    else if (k < 0.6) { put(x, y, 0xf6d23a); put(x, y + 1, 0xc49a22); }                       // maskros
    else if (k < 0.75) { put(x, y, 0x9a7ae0); put(x, y + 1, 0x6a50b0); }                      // viol
    else if (k < 0.9) { put(x, y, 0xe07aa2); put(x + 1, y, 0xc85a88); }                       // rödklöver
    else { put(x, y, 0x6a9ae8); put(x, y + 1, 0x3e6ab0); }                                    // förgätmigej
  }
  // grus: promenaden, gångarna, parkgången och paviljongens cirkel
  const [, py0, , py1] = L.promenade, pv = L.pavilion;
  for (let y = PK0; y < BS1; y++) for (let x = X0; x < 0; x++) {
    const m = mk(x, y);
    if (m !== 1 && m !== 7) continue;
    const g = (q) => q === 1 || q === 7;
    const edge = !g(mk(x - 1, y)) || !g(mk(x + 1, y)) || !g(mk(x, y - 1)) || !g(mk(x, y + 1)) || !g(mk(x - 2, y)) || !g(mk(x + 2, y));
    const center = y >= py0 + 4 && y < py1 - 4;
    let c = mix(0xc6b28c, 0xd6c6a2, vnoise(x, y, 9, 401) * (center ? 1.2 : 0.8));
    c = mul(c, 0.94 + hash(x, y, 402) * 0.1);
    const h = hash(x, y, 403), thr = center ? 0.95 : edge ? 0.86 : 0.92;
    if (h > thr) c = [0xe8dcc0, 0xd8c8a4, 0xb8906c, 0xa6a098][(hash(x, y, 404) * 4) | 0];
    else if (hash(x, y - 1, 403) > thr) c = mul(c, 0.78);
    else if (h < 0.05) c = mul(c, 0.82);
    if (edge) c = mul(c, 0.9);
    if (y >= BS0 && y < BS1 && Math.abs(y - (BS0 + 12 + Math.sin(x * 0.02) * 3)) < 4 && bayer(x, y) < 0.2) c = mul(c, 0.93);
    if (m === 7) {                                                                              // paviljongens cirkel: stenkant och krattade ringar
      const t = Math.hypot((x + 0.5 - pv.x) / pv.rx, (y + 0.5 - pv.y) / pv.ry);
      if (t > 0.9) c = granite(x, y, y < pv.y ? 0xd6d1c7 : 0xa29d94);
      else if (Math.sin(t * 40) > 0.8) c = mul(c, 0.95);
    }
    put(x, y, c);
  }
  for (let x = X0 + 40; x < -40; x++) {                                                       // cykelspår i parkgången
    const y2 = Math.round(BS0 + 14 + Math.sin(x * 0.037) * 2.4 + Math.sin(x * 0.011) * 1.6);
    if (mk(x, y2) === 1 && hash(x, 1, 406) > 0.2) put(x, y2, mul(get(x, y2), 0.87));
  }
  // MARKNADSTORGET
  const [tx0, ty0, tx1, ty1] = L.torg, WL = L.well, BAND = 6, ARC = 32, TAU = Math.PI * 2;
  const idAt = (x, y) => {
    if (x < tx0 || x >= tx1 || y < ty0 || y >= ty1) return -1;
    const e = Math.min(x - tx0, tx1 - 1 - x, y - ty0, ty1 - 1 - y);
    if (e < BAND) {                                                                           // kantbandet: långa hällar
      const hor = y - ty0 < BAND || ty1 - 1 - y < BAND;
      return 1e7 + (hor ? (y < (ty0 + ty1) / 2 ? 0 : 1) * 1000 + Math.floor((x - tx0) / 20) : (x < (tx0 + tx1) / 2 ? 2 : 3) * 1000 + Math.floor((y - ty0) / 20));
    }
    const dx = (x + 0.5 - WL.x) / 34, dy = (y + 0.5 - WL.y) / 19, t = Math.hypot(dx, dy);
    if (t < 1) {                                                                              // stenringen kring brunnen
      const ring = Math.floor(t * 6);
      if (ring >= 5) return 2e7 + 90000 + Math.floor((Math.atan2(dy, dx) / TAU + 0.5) * 36);
      const count = Math.max(6, ring * 11);
      return 2e7 + ring * 1000 + Math.floor(((Math.atan2(dy, dx) / TAU + 0.5) + ring * 0.37) * count) % count;
    }
    const u = mod(x - tx0, ARC) - ARC / 2 + 0.5, col = Math.floor((x - tx0) / ARC);       // bågsättning
    const yy = y - ty0 + 7 * (1 - (2 * u / ARC) ** 2), r = Math.floor(yy / 4);
    const k = Math.floor((x - tx0 + (r & 1) * 2.3 + col * 0.7) / 4.6);
    return (col * 997 + r) * 131 + k;
  };
  for (let y = ty0; y < ty1; y++) for (let x = tx0; x < tx1; x++) {
    const id = idAt(x, y);
    const joint = idAt(x + 1, y) !== id || idAt(x, y + 1) !== id, top = idAt(x, y - 1) !== id, left = idAt(x - 1, y) !== id;
    let c;
    if (id >= 2e7 + 90000) c = joint ? 0x4a4642 : top ? 0xc6c0b6 : 0x7a756e;                  // mörk ring runt brunnens sten
    else if (id >= 2e7) {
      const ring = Math.floor((id - 2e7) / 1000);
      c = ring === 3 ? COBR[(hash(id, 1, 1611) * 3) | 0] : ring <= 1 ? 0xd2ccc2 : COBL[(hash(id, 2, 1611) * COBL.length) | 0];
    } else if (id >= 1e7) c = mul(0xbdb7ac, 0.92 + hash(id, 3, 1612) * 0.12);
    else {
      const hh = hash(id, 4, 1613);
      c = hh < 0.16 ? COBR[(hash(id, 5, 1613) * 3) | 0] : COBL[(hash(id, 6, 1613) * COBL.length) | 0];
      c = mul(c, 0.9 + hash(id, 7, 1613) * 0.16);
    }
    if (id < 2e7 + 90000) {
      if (joint) c = mul(0x5a5448, 0.9 + hash(x, y, 1614) * 0.2);
      else if (top) c = mix(c, 0xffffff, 0.2);
      else if (left) c = mix(c, 0xffffff, 0.08);
      else if (idAt(x, y + 2) !== id) c = mul(c, 0.88);
      c = grainy(c, x, y, 0.05);
    }
    put(x, y, granite(x, y, c));
  }
  for (let x = tx0; x < tx1; x++) { shade(x, ty0, 0.8); if (bayer(x, ty0 + 1) < 0.5) shade(x, ty0 + 1, 0.9); }   // trottoarkantens skugga
  for (let y = ty0; y < ty1; y++) for (let x = tx0; x < tx1; x++) if (hash(x, y, 1615) > 0.9992) put(x, y, 0x7c7872);
  // STADSODLINGEN: barkflis, en smal träkant mot gräset, pallkragarna
  for (let y = PK0; y < BS0; y++) for (let x = X0; x < 0; x++) {
    if (mk(x, y) !== 3) continue;
    let c = mix(0x6a4a2e, 0x82603a, vnoise(x, y, 4, 1601));
    const h = hash(x, y, 1602);
    if (h > 0.9) c = 0xa07850; else if (h < 0.1) c = 0x4a3220;
    if (mk(x, y - 1) === 0 || mk(x - 1, y) === 0 || mk(x + 1, y) === 0) c = 0x9a7448;          // kantbrädan
    else if (mk(x, y + 1) === 0) c = 0x6a4a2a;
    put(x, y, c);
  }
  L.beds.forEach(([bx0, by0, bx1, by1], bi) => {
    const P = BED_PLANT[bi % BED_PLANT.length];
    for (let y = by0; y < by1; y++) for (let x = bx0; x < bx1; x++) {
      const lx = x - bx0, rx = bx1 - 1 - x, ly = y - by0, ry = by1 - 1 - y;
      let c;
      if (ry < 3) c = ry === 0 ? 0x5a3e24 : (ry === 1 ? 0x8a6238 : 0x9e7444);                 // framsidan (bräda)
      else if (ly < 2 || lx < 2 || rx < 2) c = ly === 0 ? 0xd2a874 : lx === 0 || rx === 0 ? 0x8a6238 : 0xb88c58;   // kanten
      else {
        c = mix(0x4a3424, 0x3a281a, hash(x, y, 1603));                                          // mullen
        const px = (lx - 2) % 6, row = ly < 6 ? 0 : 1;
        if (px >= 1 && px <= 4 && ((row === 0 && ly >= 3 && ly <= 5) || (row === 1 && ly >= 7 && ly <= 9))) {
          const q = hash(Math.floor((lx - 2) / 6), row + bi * 7, 1604);
          c = ly === (row ? 7 : 3) && px >= 2 && px <= 3 ? P[1] : P[0];
          if (q > 0.55 && px === 2 && ly === (row ? 8 : 4)) c = P[2];                          // frukten/blomman
          if (bi % BED_PLANT.length === 1 && ly === (row ? 9 : 5) && px === 2) c = P[2];        // morotstoppen
        }
      }
      put(x, y, c);
    }
    for (let x = bx0; x < bx1 + 1; x++) { shade(x, by1, 0.72); if (bayer(x, by1 + 1) < 0.5) shade(x, by1 + 1, 0.85); }
  });
  // rabatterna: kupad mull, tätt med blommor, granitkant
  L.beds2.forEach(([bx0, by0, bx1, by1], bi) => {
    const F = FLOWERS[bi % FLOWERS.length];
    for (let y = by0 - 1; y <= by1; y++) for (let x = bx0 - 1; x <= bx1; x++) {
      if (x < bx0 || x >= bx1 || y < by0 || y >= by1) { if (mk(x, y) === 0) put(x, y, granite(x, y, y < by0 ? 0xd6d1c7 : 0xa29d94)); continue; }
      let c = mix(0x4e3a28, 0x3e2c1e, hash(x, y, 1620));
      const h = hash(x, y, 1621);
      if (h > 0.42) c = h > 0.86 ? F[1] : h > 0.62 ? F[0] : (hash(x, y, 1622) > 0.5 ? 0x3e7a34 : 0x5a9a42);
      put(x, y, c);
    }
  });
  // kantsten mellan gräs och grus, skuggan under trottoarkanten, kanten mot södra raden
  for (let y = PK0; y < BS1; y++) for (let x = X0; x < 0; x++) {
    if (mk(x, y) !== 0) continue;
    const g = (q) => q === 1 || q === 2 || q === 7;
    const dn = g(mk(x, y + 1)), up = g(mk(x, y - 1)), lr = g(mk(x - 1, y)) || g(mk(x + 1, y));
    if (dn) put(x, y, granite(x, y, 0xd6d1c7));
    else if (up) { put(x, y, granite(x, y, 0xa29d94)); if (mk(x, y + 1) === 0) shade(x, y + 1, 0.82); }
    else if (lr) put(x, y, granite(x, y, 0xbab5ab));
  }
  for (let x = X0; x < 0; x++) {
    put(x, BS1, granite(x, BS1, 0xc8c3b9)); put(x, BS1 + 1, granite(x, BS1 + 1, 0x9a958c));
    put(x, BS1 + 2, mul(dirt(x, BS1 + 2), 0.7)); put(x, BS1 + 3, mul(dirt(x, BS1 + 3), 0.6));
    const m = mk(x, PK0);
    if (m === 0 || m === 3) { shade(x, PK0, 0.74); if (bayer(x, PK0 + 1) < 0.5) shade(x, PK0 + 1, 0.88); }
  }
}

// =====================================================================
// FLODEN (v3) – PLATSHÅLLARE: js/city/bridge.js målar flodrummet på riktigt (paintRiver,
// läggs ovanpå marken av scenen). Här: kajer av granit, räcken, vattnet med krusningar,
// broarnas södra sidor (balkar över vattnet) och skuggan under däcken. Gatorna över
// broarna är marken ovan (Pixelgatan/Södergatan med trottoarer fortsätter rakt över).
// =====================================================================
function paintRiverPlaceholder() {
  if (!RIVER) return;
  const deck = (y) => BRIDGES.some((b) => y >= b.walk[1] && y < b.walk[3]);
  // kajerna: stora granithällar, ljus kant mot vattnet
  for (const q of [RIVER.quayW, RIVER.quayE]) {
    const at = rows(q[0], q[2], 0, H, { h: [10, 10], w: [10, 14], seed: 1600 + q[0] });
    for (let y = 0; y < Math.min(H, q[3]); y++) {
      if (deck(y)) continue;
      for (let x = q[0]; x < q[2]; x++) {
        const s = at(x, y);
        let c = s.lx === s.w - 1 || s.ly === s.h - 1 ? 0x6a655d : granite(x, y, mix(0xb4aea2, 0xa6a094, hash(s.k, s.r, 1601)));
        if (s.ly === 0 && s.lx !== s.w - 1) c = mix(c, 0xffffff, 0.12);
        put(x, y, grime(c, x, y, wornAt(x, y) * 0.8));
      }
    }
  }
  // vattnet
  for (const r of RIVER.water) for (let y = Math.max(0, r[1]); y < Math.min(H, r[3]); y++) for (let x = r[0]; x < r[2]; x++) {
    let c = mix(0x2f6a84, 0x1d4660, vnoise(x, y, 48, 1610));
    const rr = vnoise(x * 0.3, y * 1.6, 3, 1611) * 0.7 + vnoise(x * 0.1, y, 6, 1612) * 0.3;
    if (rr > 0.7) c = mix(c, 0x9ac4dc, 0.28 + (rr - 0.7) * 0.9);
    else if (rr < 0.28) c = mul(c, 0.86);
    if (x < r[0] + 6) c = mul(c, 0.7 + (x - r[0]) * 0.05);                                   // västra kajmurens skugga (solen i sydväst)
    put(x, y, c);
  }
  // kajräckena: stenkant + järnräcke (stolpar var 6:e px)
  for (const r of RIVER.rails) for (let y = Math.max(0, r[1]); y < Math.min(H, r[3]); y++) for (let x = r[0]; x < r[2]; x++) {
    const post = mod(y, 6) === 0, lx = x - r[0];
    put(x, y, post ? (lx === 1 || lx === 2 ? 0x2a2c32 : 0x9a958c) : lx === 0 || lx === 3 ? granite(x, y, 0xc6c1b6) : lx === 1 ? 0x3a3c44 : 0x24262c);
  }
  // broarna: räckena (sten + järn), balken på södra sidan över vattnet, skuggan på vattnet norr om däcket
  for (const b of BRIDGES) {
    const [bx0, , bx1] = b.walk;
    for (const [rx0, ry0, rx1, ry1] of b.rails) for (let y = ry0; y < ry1; y++) for (let x = rx0; x < rx1; x++) {
      const ly = y - ry0, post = mod(x, 8) === 0;
      put(x, y, ly === 0 ? granite(x, y, 0xd0cbc0) : post ? 0x2a2c32 : ly === ry1 - ry0 - 1 ? granite(x, y, 0x8a857c) : ly === 1 ? 0x4a4e58 : granite(x, y, 0xb2ada2));
    }
    const s0 = b.rails[1][3];                                                                 // under södra räcket: balken
    for (let y = s0; y < s0 + 8; y++) for (let x = bx0; x < bx1; x++) {
      const ly = y - s0, rivet = ly === 2 && mod(x, 6) === 3;
      put(x, y, rivet ? 0x8a8e98 : ly === 0 ? 0x5a5e68 : ly === 7 ? 0x1a1c22 : mix(0x3a3e48, 0x2a2e36, ly / 7));
    }
    for (let x = bx0; x < bx1; x++) for (let y = s0 + 8; y < s0 + 12; y++) shade(x, y, 0.7 + (y - s0 - 8) * 0.07);   // balkens skugga i vattnet
    const n0 = b.rails[0][1];                                                                 // norr om däcket: däckets skugga (sol i sydväst)
    for (let x = bx0; x < bx1; x++) for (let y = n0 - 6; y < n0; y++) if (bayer(x, y) < (y - (n0 - 6)) / 6 + 0.2) shade(x, y, 0.72);
  }
}

// =====================================================================
// FÖRORTENS MELLANBAND (x 3032–4000, y 306–494) – sliten gräsmatta, parkeringen,
// lekplatsen, grusplanen, lamellhusets platta, asfaltgångarna. (v3: förorten flyttades
// SDX österut – de fasta koordinaterna nedan står i v2-x + SDX.)
// =====================================================================
const GRX = [0x3e4e26, 0x4c5e2c, 0x5c6e34, 0x6c7c3c, 0x808c48, 0x94985a];
function paintSuburbBand() {
  const x0 = XS, x1 = W, y0 = SS1, y1 = TOP_S;
  const P = lotById('parkering'), LK = lotById('lekplats_x'), GP = lotById('grusplan'), LM = FREESTANDING.find((b) => b.id === 'lamell');
  const paths = [...SUB_LAYOUT.paths, SUB_LAYOUT.back];
  const lamPad = LM ? [LM.x - 3, LM.top - 2, LM.x + LM.w + 3, LM.base + 4] : [0, 0, 0, 0];
  const lamWalk = LM ? [LM.door.x0 - 2, LM.base, LM.door.x1 + 2, BS0] : [0, 0, 0, 0];
  const drive = P?.drive ? [P.drive[0], y0, P.drive[1], P.rect[1]] : [0, 0, 0, 0];
  const kind = (x, y) => {
    if (y >= BS1) return 9;
    if (paths.some((r) => inR(x, y, r)) || inR(x, y, lamWalk)) return 1;
    if (P && inR(x, y, P.rect)) return 2;
    if (inR(x, y, drive)) return 7;
    if (LK && inR(x, y, LK.rect)) return 3;
    if (GP && inR(x, y, GP.rect)) return 4;
    if (inR(x, y, lamPad)) return 5;
    return 0;
  };
  // 1. sliten gräsmatta: gulnade fläckar, bar jord, vildvuxna tuvor
  for (let y = y0; y < BS0; y++) for (let x = x0; x < x1; x++) {
    if (kind(x, y) !== 0) continue;
    const emb = vnoise(x, y, 3.4, 205) - vnoise(x + 0.7, y + 1.6, 3.4, 205);
    const n = fbm(x, y, 26, 201) * 0.6 + vnoise(x, y, 8, 202) * 0.24 + emb * 0.85 + (hash(x, y, 203) - 0.5) * 0.14 + 0.06;
    const i = n < 0.3 ? 0 : n < 0.41 ? 1 : n < 0.53 ? 2 : n < 0.65 ? 3 : n < 0.77 ? 4 : 5;
    let c = mul(GRX[i], 0.96 + hash(x, y, 204) * 0.06);
    const bare = fbm(x, y, 20, 206);
    if (bare > 0.64) c = dirt(x, y);                                                           // bar jord
    else if (bare > 0.58) c = mix(c, 0x8a7a54, 0.5);
    else if (vnoise(x, y, 30, 207) > 0.66) c = mix(c, 0xb0a860, 0.35);                          // gulnat, torrt gräs
    put(x, y, c);
  }
  // grässtrån, vildvuxna tuvor, maskrosor och nässlor
  for (let y = y0 + 3; y < BS0; y++) for (let x = x0 + 1; x < x1 - 1; x++) {
    if (kind(x, y) !== 0 || kind(x, y - 2) !== 0) continue;
    const h = hash(x, y, 210);
    if (h > 0.93) { put(x, y, GRX[1]); put(x, y - 1, GRX[3]); if (hash(x, y, 211) > 0.5) put(x + (hash(x, y, 212) > 0.5 ? 1 : -1), y - 2, GRX[4]); }
    else if (h < 0.004) tuft(x, y, 213 + x, true);
    else if (h < 0.006) { put(x, y, 0x3e6a2c); put(x, y - 1, 0xf6d23a); }
  }
  // trampstigar: hållplatsen → lamellhuset, gången → lekplatsens grind, lamellhuset → grusplanen (hålet i stängslet)
  const trails = [[2016, SS1, 2294, 452, 4], [2026, 400, 2098, 336, 3], [2400, 430, 2432, 388, 3], [2312, 452, 2458, 452, 3.5], [1766, 460, 1820, 452, 3], [2566, SS1, 2568, 318, 4], [2172, 452, 2200, 440, 2.5]]
    .map(([ax, ay, bx, by, wd]) => [ax + SDX, ay, bx + SDX, by, wd]);
  for (const [ax, ay, bx, by, wd] of trails) {
    const L = Math.max(1, Math.hypot(bx - ax, by - ay));
    for (let y = Math.min(ay, by) - 6; y < Math.max(ay, by) + 6; y++) for (let x = Math.min(ax, bx) - 8; x < Math.max(ax, bx) + 8; x++) {
      if (kind(x, y) !== 0 || y < y0) continue;
      const t = Math.max(0, Math.min(1, ((x - ax) * (bx - ax) + (y - ay) * (by - ay)) / (L * L)));
      const dd = Math.hypot(x - (ax + (bx - ax) * t), y - (ay + (by - ay) * t)) + (vnoise(x, y, 4, 214) - 0.5) * 2;
      const q = 1 - dd / wd;
      if (q <= 0) continue;
      if (bayer(x, y) < q * 1.5) put(x, y, dirt(x, y)); else put(x, y, mix(get(x, y), 0x9a8a60, 0.4));
    }
  }
  // däckspår över gräset (någon har kört upp på gräsmattan) och en bränd fläck
  for (let x = 2180 + SDX; x < 2250 + SDX; x++) for (const o of [0, 9]) { const y = Math.round(318 + (x - 2180 - SDX) * 0.9 + o); if (kind(x, y) === 0 && hash(x, y, 215) < 0.8) { put(x, y, mix(dirt(x, y), 0x3a3024, 0.4)); put(x + 1, y, dirt(x + 1, y)); } }
  ellipse(2395 + SDX, 346, 8, 4, (x, y, t) => { if (kind(x, y) !== 0) return; put(x, y, t < 0.5 ? mix(0x2a2622, 0x4a443c, hash(x, y, 216)) : mix(get(x, y), 0x2a2622, (1 - t) * 1.2)); });
  for (let k = 0; k < 6; k++) put(2390 + SDX + ((hash(k, 1, 217) * 10) | 0), 344 + ((hash(k, 2, 217) * 4) | 0), 0xd8d4cc);    // aska
  // 2. parkeringen
  if (P) paintParking(P, kind);
  // 3. lekplatsen, 4. grusplanen, 5. lamellhusets platta
  if (LK) paintSubPlay(LK);
  if (GP) paintPitch(GP);
  if (LM) {
    for (let y = lamPad[1]; y < lamPad[3]; y++) for (let x = lamPad[0]; x < lamPad[2]; x++) put(x, y, concrete(x, y, 10, 8, 230, 0.9));
    for (let x = lamPad[0]; x < lamPad[2]; x++) shade(x, lamPad[3], 0.8);
    scatter([lamPad[0], LM.base, lamPad[2], lamPad[3]], 14, 231);
  }
  // asfaltgångarna (gången från hållplatsen, gångvägen bakom den södra raden, till lamellhusets port)
  for (let y = y0; y < BS1; y++) for (let x = x0; x < x1; x++) {
    if (kind(x, y) !== 1) continue;
    let c = asphaltW(x, y, 0.06, false, 0.85);
    const e = kind(x - 1, y) !== 1 || kind(x + 1, y) !== 1 || kind(x, y - 1) !== 1 || kind(x, y + 1) !== 1;
    if (e) c = mul(c, 0.86);
    put(x, y, c);
  }
  for (let i = 0; i < 44; i++) crack(x0 + hash(i, 1, 232) * (x1 - x0), BS0 + 2 + hash(i, 2, 232) * 24, 8 + hash(i, 3, 232) * 20, 233 + i, { dx: hash(i, 4, 232) > 0.5 ? 1 : -1, y0: BS0, y1: BS1, weeds: 0.1, sealed: i % 4 === 0 });
  for (let i = 0; i < 8; i++) crack(2006 + SDX + hash(i, 1, 234) * 18, y0 + 10 + hash(i, 2, 234) * 140, 8 + hash(i, 3, 234) * 14, 235 + i, { vert: true, x0: 2004 + SDX, x1: 2026 + SDX, weeds: 0.12 });
  for (let x = x0; x < x1; x++) { if (hash(x, BS0, 236) > 0.86) tuft(x, BS0 + 1, 237 + x, hash(x, 1, 236) > 0.6); if (hash(x, BS1, 236) > 0.88) tuft(x, BS1 - 1, 238 + x); }
  for (const [px, pw] of [[1880, 40], [2140, 26], [2420, 50], [2610, 30]].map(([a, b]) => [a + SDX, b])) for (let y = BS0 + 3; y < BS1 - 3; y++) for (let x = px; x < px + pw; x++) {
    const e = x === px || x === px + pw - 1 || y === BS0 + 3 || y === BS1 - 4;
    put(x, y, e && hash(x, y, 239) > 0.25 ? 0x25262b : asphaltW(x, y, -0.12, false, 0.4));
  }
  pothole(2080 + SDX, 476, 6, 2.6, 240); pothole(2560 + SDX, 480, 5, 2.2, 241); pothole(1930 + SDX, 470, 3.5, 1.8, 242);
  scatter([x0, BS0, x1, BS0 + 4], 26, 243); scatter([x0, BS1 - 4, x1, BS1], 26, 247);
  // skräp på gräset
  scatter([x0, y0 + 2, x1, BS0], 70, 244); scatter([x0, y0 + 1, x1, y0 + 6], 30, 248);
  // kanten mot södra raden
  for (let x = XS; x < x1; x++) { put(x, BS1, grime(granite(x, BS1, 0xb8b2a6), x, BS1, 1)); put(x, BS1 + 1, granite(x, BS1 + 1, 0x8a857c)); put(x, BS1 + 2, mul(dirt(x, BS1 + 2), 0.7)); put(x, BS1 + 3, mul(dirt(x, BS1 + 3), 0.6)); }
  // kantstenens skugga mot trottoaren
  for (let x = x0; x < x1; x++) if (kind(x, y0) === 0) { shade(x, y0, 0.74); if (bayer(x, y0 + 1) < 0.5) shade(x, y0 + 1, 0.88); }
}
// parkeringen: sliten asfalt, bleka rutor, hjulstopp, oljefläckar, potthål, ett krossat bilfönster
function paintParking(P, kind) {
  const [x0, y0, x1, y1] = P.rect;
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) put(x, y, asphaltW(x, y, 0.02, false, 0.9));
  if (P.drive) for (let y = SS1; y < y0; y++) for (let x = P.drive[0]; x < P.drive[1]; x++) put(x, y, asphaltW(x, y, 0.02, false, 0.8));
  // betongkant runt om (öppen vid infarten)
  for (let x = x0; x < x1; x++) for (const y of [y0, y1 - 1]) if (!(y === y0 && P.drive && x >= P.drive[0] && x < P.drive[1])) put(x, y, grime(granite(x, y, y === y0 ? 0xc0bbb0 : 0x9a958c), x, y, 1));
  for (let y = y0; y < y1; y++) for (const x of [x0, x1 - 1]) put(x, y, grime(granite(x, y, 0xb4afa4), x, y, 1));
  // rutor: övre raden v2-x 1826–1976 (bilarna står med fronten mot muren), undre raden 1776–1976 (+ SDX)
  const PD = SDX;
  const lineV = (x, ya, yb) => { for (let y = ya; y < yb; y++) for (const dx of [0, 1]) mark(x + dx, y, 0xe8e4d4, 0.3 + vnoise(x, y, 6, 250) * 0.4); };
  const lineH = (xa, xb, y) => { for (let x = xa; x < xb; x++) mark(x, y, 0xe8e4d4, 0.3 + vnoise(x, y, 6, 251) * 0.4); };
  for (let x = 1826 + PD; x <= 1976 + PD; x += 50) lineV(x, y0 + 8, y0 + 52);
  lineH(1826 + PD, 1978 + PD, y0 + 52);
  for (let x = 1776 + PD; x <= 1976 + PD; x += 50) lineV(x, y1 - 44, y1 - 4);
  lineH(1776 + PD, 1978 + PD, y1 - 44);
  // handikapprutan (blek blå) och P i gången
  for (let y = y1 - 30; y < y1 - 14; y++) for (let x = 1792 + PD; x < 1810 + PD; x++) if (hash(x, y, 252) > 0.45) blend(x, y, 0x3a6ab0, 0.35);
  eachTextPixel(BIG, 'P', 1990 + PD - 10, y0 + 66, 1, (px, py) => mark(px, py, 0xe8e4d4, 0.4));
  // pilar i gången
  for (const [ax, dir] of [[1860 + PD, 1], [1940 + PD, -1]]) {
    const ay = y0 + 70;
    for (let i = 0; i < 18; i++) for (const dy of [0, 1]) mark(ax + i * dir, ay + dy, 0xe8e4d4, 0.4);
    for (let r = 0; r < 4; r++) for (let j = -r; j <= r + 1; j++) mark(ax + (18 + 3 - r) * dir, ay + j, 0xe8e4d4, 0.4);
  }
  // hjulstopp av betong i överkant av varje ruta
  for (let x = 1831 + PD; x < 1976 + PD; x += 50) for (let i = 0; i < 40; i++) { if (i > 4 && i < 36 && (i < 12 || i > 28)) { put(x + i, y0 + 11, 0xc4bfb4); put(x + i, y0 + 12, 0x8a857c); shade(x + i, y0 + 13, 0.7); } }
  // oljefläckar under bilarna, lagningar, sprickor, potthål, ogräs
  for (let x = 1851 + PD; x < 1976 + PD; x += 50) { stain(x, y0 + 38, 10, 5, 0.45); stain(x - 4, y0 + 34, 4, 2, 0.4); }
  for (let x = 1801 + PD; x < 1976 + PD; x += 50) stain(x, y1 - 20, 9, 4, 0.4);
  for (const [px, py, pw, ph] of [[1900 + PD, y0 + 60, 44, 14], [1780 + PD, y0 + 20, 30, 20]]) for (let y = py; y < py + ph; y++) for (let x = px; x < px + pw; x++) {
    const e = x === px || y === py || x === px + pw - 1 || y === py + ph - 1;
    put(x, y, e && hash(x, y, 253) > 0.25 ? 0x25262b : asphaltW(x, y, -0.13, false, 0.4));
  }
  for (let i = 0; i < 40; i++) crack(x0 + 4 + hash(i, 1, 254) * (x1 - x0 - 8), y0 + 4 + hash(i, 2, 254) * (y1 - y0 - 8), 10 + hash(i, 3, 254) * 26, 255 + i, { dx: hash(i, 4, 254) > 0.5 ? 1 : -1, x0: x0 + 1, x1: x1 - 1, y0: y0 + 1, y1: y1 - 1, sealed: i % 3 === 0, branch: i % 4 === 0, weeds: 0.08 });
  alligator(1880 + PD, y0 + 78, 22, 8, 256); alligator(1990 + PD, y1 - 30, 10, 12, 257);
  pothole(1862 + PD, y0 + 72, 7, 3, 258); pothole(1952 + PD, y0 + 112, 5, 2.4, 259); pothole(1800 + PD, y0 + 50, 4, 2, 260);
  grate(1884 + PD, y0 + 90, 8, 5, true, 0.5);
  for (let x = x0 + 1; x < x1 - 1; x++) for (const y of [y0 + 1, y1 - 2]) if (hash(x, y, 261) > 0.86) tuft(x, y, 262 + x, hash(x, y, 263) > 0.6);
  // krossat bilfönster: glas som glittrar i en ruta
  for (let k = 0; k < 26; k++) { const x = 1930 + PD + ((hash(k, 1, 264) * 22) | 0), y = y0 + 40 + ((hash(k, 2, 264) * 12) | 0); put(x, y, hash(k, 3, 264) > 0.5 ? 0xdfe8ee : 0xa8c0cc); if (hash(k, 4, 264) > 0.7) put(x + 1, y, 0xffffff); }
  scatter([x0 + 2, y0 + 2, x1 - 2, y0 + 8], 16, 265); scatter([x0 + 2, y1 - 8, x1 - 2, y1 - 2], 16, 266); scatter([x0 + 2, y0 + 2, x1 - 2, y1 - 2], 14, 267);
}
// förortens lekplats: nött gräs och jord, sand under gungorna, trasig gummimatta, glas och fimpar
function paintSubPlay(L) {
  const [x0, y0, x1, y1] = L.rect;
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    const q = fbm(x, y, 14, 270);
    let c;
    if (q > 0.55) c = dirt(x, y);
    else {
      const n = fbm(x, y, 20, 271) + (hash(x, y, 272) - 0.5) * 0.2;
      c = mul(GRX[n < 0.35 ? 1 : n < 0.5 ? 2 : n < 0.62 ? 3 : 4], 0.96 + hash(x, y, 273) * 0.06);
      if (q > 0.48) c = mix(c, 0x8a7a54, 0.5);
    }
    put(x, y, c);
  }
  // sandytor under gungan och rutschkanan (utan kant, gräset växer in)
  for (const [cx, cy, rx, ry] of [[2062, 372, 26, 9], [2136, 368, 16, 7], [2064, 424, 24, 8]].map(([a, ...r]) => [a + SDX, ...r])) ellipse(cx, cy, rx, ry, (x, y, t) => {
    const e = t + (vnoise(x, y, 4, 274) - 0.5) * 0.36;
    if (e > 1 || (e > 0.78 && bayer(x, y) < (e - 0.78) / 0.22)) return;                       // prickig kant mot gräset
    let c = mix(0xb09a74, 0xc2ae86, vnoise(x, y, 5, 275));
    if (hash(x, y, 276) > 0.94) c = 0x8a7a5e; else if (hash(x, y, 276) < 0.04) c = 0xd4c49c;
    if (vnoise(x, y, 4, 277) > 0.68) c = mix(c, 0x7a6a4c, 0.4);                                 // blöt, uppgrävd
    if (hash(x, y, 278) > 0.985) { put(x, y, WEED[1]); return; }
    put(x, y, c);
  });
  for (const [cx, cy] of [[2056 + SDX, 374], [2068 + SDX, 374]]) ellipse(cx, cy, 4, 1.6, (x, y) => put(x, y, mix(get(x, y), 0x5a4a34, 0.5))); // gropar under gungsitsarna
  // trasig gummimatta vid gunghästen (röd/svart, en bit bortriven)
  for (let y = 414; y < 426; y++) for (let x = 2092 + SDX; x < 2110 + SDX; x++) {
    const lx = x - 2092 - SDX;
    if (lx > 12 && y > 420) continue;
    const g = (lx >> 2) + ((y - 414) >> 2);
    put(x, y, lx % 4 === 3 || (y - 414) % 4 === 3 ? 0x2a2222 : g & 1 ? 0x8a2a24 : 0x6a2420);
  }
  for (let i = 0; i < 26; i++) { const x = x0 + 4 + hash(i, 1, 278) * (x1 - x0 - 8), y = y0 + 4 + hash(i, 2, 278) * (y1 - y0 - 8); litter(x, y, hash(i, 3, 278) * 0.66, 279 + i); }
  for (let x = x0; x < x1; x++) { if (hash(x, y0, 280) > 0.7) tuft(x, y0 + 2, 281 + x, true); if (hash(x, y1, 280) > 0.75) tuft(x, y1 - 1, 282 + x, true); }
  for (let y = y0; y < y1; y++) { if (hash(x0, y, 283) > 0.75) tuft(x0 + 1, y, 284 + y, true); if (hash(x1, y, 283) > 0.75) tuft(x1 - 2, y, 285 + y, true); }
  paintHopscotch(2092 + SDX, 438, 0.5);
}
// grusplanen: rödaktigt grus, bleka kritlinjer, nötta målområden, vattensvackor, ogräs i kanterna
function paintPitch(G) {
  const [x0, y0, x1, y1] = G.rect, mx = (x0 + x1) >> 1, my = (y0 + y1) >> 1;
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    let c = gravel(x, y, 0xa88a68, 290);
    const e = Math.min(x - x0, x1 - 1 - x, y - y0, y1 - 1 - y);
    if (e < 6 && vnoise(x, y, 5, 291) > 0.5 - (6 - e) * 0.05) c = mix(c, GRX[2], 0.6);          // gräs som tar över i kanterna
    put(x, y, c);
  }
  // nötta ytor framför målen och i mittcirkeln (ljusare, hårt packat)
  for (const [cx, cy, rx, ry] of [[x0 + 22, my, 20, 16], [x1 - 22, my, 20, 16], [mx, my, 22, 12]]) ellipse(cx, cy, rx, ry, (x, y, t) => { if (bayer(x, y) < (1 - t) * 1.2) put(x, y, mix(get(x, y), 0xc4a480, 0.5)); });
  // kritlinjerna (bleka, delvis borta)
  const L = (x, y) => { if (vnoise(x, y, 8, 292) > 0.3) blend(x, y, 0xf0ece0, 0.55 + hash(x, y, 293) * 0.2); };
  for (let x = x0 + 5; x < x1 - 5; x++) { L(x, y0 + 5); L(x, y1 - 6); }
  for (let y = y0 + 5; y < y1 - 5; y++) { L(x0 + 5, y); L(x1 - 6, y); L(mx, y); }
  ellipse(mx, my, 20, 13, (x, y, t) => { if (t > 0.88) L(x, y); });
  for (const [bx0, bx1] of [[x0 + 5, x0 + 40], [x1 - 41, x1 - 6]]) { for (let y = my - 30; y <= my + 30; y++) L(bx0 === x0 + 5 ? bx1 : bx0, y); for (let x = bx0; x <= bx1; x++) { L(x, my - 30); L(x, my + 30); } }
  // vattensvackor (mörkare), ogräs, skräp
  for (const [cx, cy, rx, ry] of [[mx - 2, my - 12, 12, 3.4], [x0 + 30, y1 - 22, 9, 2.8]]) ellipse(cx, cy, rx, ry, (x, y, t) => blend(x, y, 0x5a4a38, (1 - t) * 0.35));
  for (let i = 0; i < 40; i++) tuft(x0 + 6 + hash(i, 1, 294) * (x1 - x0 - 12), y0 + 6 + hash(i, 2, 294) * (y1 - y0 - 12), 295 + i, hash(i, 3, 294) > 0.7);
  scatter([x0 + 2, y0 + 2, x1 - 2, y1 - 2], 18, 296);
}

// =====================================================================
// SÖDRA RADEN (y 494–640) – gränder, gågator, kyrkogården, gårdarna, förortens tomter
// =====================================================================
function paintSouthRow() {
  // under husen (syns knappt – taken täcker): packad jord
  for (const b of HOUSES_S) { const fp = footprint(b); for (let y = fp[1]; y <= fp[3]; y++) for (let x = fp[0]; x < fp[2]; x++) put(x, y, mul(dirt(x, y), 0.7)); }
  for (const g of ROW_S) {
    if (g.road) continue;                                                                    // Infarten målas för sig
    if (g.x0 === I1) continue;                                                               // Infartens östra trottoar
    if (g.kind === 'lot') { if (g.lot === 'kyrkogard') paintChurchyard(lotById(g.lot)); else if (g.lot === 'atervinning') paintRecycling(lotById(g.lot)); else if (g.lot === 'vagnsplatsen') paintTrailerLot(lotById(g.lot)); continue; }
    if (g.kind === 'street') { paintPedestrian(g, BS1, BASE_S, g.x0 >= XS ? 'betong' : g.x0 >= XD && g.x1 <= RX0 ? 'granit' : 'tegel'); continue; }   // (Bankgatan i downtown: granit)
    paintAlley(g, BS1, BASE_S);
  }
  // radhusens trädgårdar (husspecialisten ritar gräsmattan ovanpå som föremål – det här är grunden)
  for (const b of HOUSES_S) {
    if (!b.yard) continue;
    if (b.yard.kind === 'garden') {
      const [x0, y0, x1, y1] = b.yard.rect;
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
        const n = fbm(x, y, 12, 300) + (hash(x, y, 301) - 0.5) * 0.2;
        put(x, y, mul(GR[n < 0.35 ? 2 : n < 0.5 ? 3 : n < 0.64 ? 4 : 5], 0.97 + hash(x, y, 302) * 0.05));
      }
      for (let y = y0; y < y1; y++) for (let x = b.door.x0 + 2; x < b.door.x1 - 2; x++) put(x, y, concrete(x, y, 6, 6, 303, 0));
    } else if (b.yard.kind === 'forecourt') paintForecourt(b);
  }
  // Infartens östra trottoar i förortens södra rad fortsätter (målas av paintInfarten); den smala remsan intill
  for (let y = BS1; y < BASE_S; y++) for (let x = IE1; x < IE1 + 2; x++) put(x, y, mul(dirt(x, y), 0.75));
  backShadows(HOUSES_S, TOP_S, 's');
}
// kyrkogården: välklippt gräs med klippränder, krattade grusgångar mellan grindarna
function paintChurchyard(L) {
  const [x0, y0, x1, y1] = L.rect, gy = (y0 + y1) >> 1;
  const gN = (L.gates || []).find((g) => g.side === 'n'), gS = (L.gates || []).find((g) => g.side === 's');
  const onPath = (x, y) => (gN && x >= gN.x0 && x < gN.x1 && y < gy + 7) || (y >= gy - 7 && y < gy + 7 && x >= x0 + 6 && x < x1 - 6) || (gS && x >= gS.x0 && x < gS.x1 && y >= gy - 7);
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    if (onPath(x, y)) {
      const e = !onPath(x - 1, y) || !onPath(x + 1, y) || !onPath(x, y - 1) || !onPath(x, y + 1);
      let c = gravel(x, y, 0xcfc2a4, 310);
      if (e) c = granite(x, y, 0xa29d94);
      put(x, y, c);
      continue;
    }
    const n = fbm(x, y, 26, 311) * 0.5 + vnoise(x, y, 7, 312) * 0.3 + (hash(x, y, 313) - 0.5) * 0.12;
    let c = mul(GR[n < 0.35 ? 1 : n < 0.5 ? 2 : n < 0.63 ? 3 : 4], 0.95 + hash(x, y, 314) * 0.06);
    if (Math.floor((x - x0) / 10) & 1) c = mix(c, 0xffffff, 0.05); else c = mul(c, 0.97);   // klippränder
    if (hash(x, y, 315) > 0.93) { put(x, y, GR[1]); put(x, y - 1, GR[3]); continue; }
    put(x, y, c);
  }
  // små planteringar (mörk jord med blommor) längs mittgången
  for (let x = x0 + 14; x < x1 - 14; x += 34) {
    if ((gN && x + 10 > gN.x0 && x < gN.x1) || (gS && x + 10 > gS.x0 && x < gS.x1)) continue;
    for (const yy of [gy - 11, gy + 8]) for (let y = yy; y < yy + 3; y++) for (let xx = x; xx < x + 10; xx++) {
      let c = mix(0x4a3a2a, 0x3a2c20, hash(xx, y, 316));
      if (hash(xx, y, 317) > 0.72) c = [0xe85a6a, 0xf4f0f4, 0xf4d23c, 0xb07ad8][(hash(xx, y, 318) * 4) | 0];
      put(xx, y, c);
    }
  }
  // skuggan från kyrkan (västerut) ner över gräset
  gapShadow({ x0, x1, row: 's' }, y0, y1);
}
// macken: betongplattor, pumpöar med gul kant, pilar, en ränna och oljefläckar
function paintForecourt(b) {
  const [x0, y0, x1, y1] = b.yard.rect;
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) put(x, y, concrete(x, y, 16, 11, 320, 0.1));
  for (const [bx0, by0, bx1, by1] of b.blocks || []) {
    for (let y = by0 - 3; y < by1 + 3; y++) for (let x = bx0 - 3; x < bx1 + 3; x++) {
      const e = x < bx0 - 1 || x >= bx1 + 1 || y < by0 - 1 || y >= by1 + 1;
      let c = e ? ((x + y) % 6 < 3 ? 0xe8c040 : 0x2a2a2a) : granite(x, y, 0xc8c4ba);           // gul-svart kant
      if (y === by0 - 3) c = mix(c, 0xffffff, 0.2);
      put(x, y, c);
    }
    for (let x = bx0 - 3; x < bx1 + 3; x++) shade(x, by1 + 3, 0.7);
    stain((bx0 + bx1) / 2, by1 + 7, 7, 3, 0.4); stain(bx0 - 6, by1 + 4, 3, 1.6, 0.35);
  }
  // pilar och körfält mellan pumparna
  for (let y = y0 + 4; y < y1 - 4; y++) for (const x of [1648, 1649]) if ((y - y0) % 10 < 5) mark(x, y, 0xf4f0e4, 0.1);
  for (let r = 0; r < 4; r++) for (let i = -r; i <= r + 1; i++) mark(1648 + i, y1 - 6 + r, 0xf4f0e4, 0.1);
  // ränna tvärs över framkanten
  for (let x = x0; x < x1; x++) { put(x, y1 - 3, (x & 1) ? 0x2a2a2c : 0x6a6a6a); put(x, y1 - 2, 0x4a4a4c); }
  for (let i = 0; i < 10; i++) stain(x0 + 8 + hash(i, 1, 321) * (x1 - x0 - 16), y0 + 6 + hash(i, 2, 321) * (y1 - y0 - 12), 2 + hash(i, 3, 321) * 4, 1.2 + hash(i, 4, 321), 0.3);
  for (let x = x0; x < x1; x++) { shade(x, b.base + 4, 0.78); if (bayer(x, b.base + 5) < 0.5) shade(x, b.base + 5, 0.9); }
}
// återvinningen: sprucken betong, rost- och oljefläckar, mängder av glasskärvor vid glasigloon
function paintRecycling(L) {
  const [x0, y0, x1, y1] = L.rect;
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) put(x, y, concrete(x, y, 23, 15, 330, 1));
  for (let i = 0; i < 26; i++) crack(x0 + hash(i, 1, 331) * (x1 - x0), y0 + hash(i, 2, 331) * (y1 - y0), 8 + hash(i, 3, 331) * 20, 332 + i, { dx: hash(i, 4, 331) > 0.5 ? 1 : -1, x0, x1, y0, y1, weeds: 0.1, branch: i % 3 === 0 });
  for (let i = 0; i < 10; i++) stain(x0 + hash(i, 1, 333) * (x1 - x0), y0 + hash(i, 2, 333) * (y1 - y0), 3 + hash(i, 3, 333) * 6, 2 + hash(i, 4, 333) * 3, 0.3, i & 1 ? 0x5a3a22 : 0x1c1e24);
  for (let k = 0; k < 90; k++) {                                                              // glas framför GLAS-igloon
    const x = 2292 + SDX + ((hash(k, 1, 334) * 40) | 0), y = 552 + ((hash(k, 2, 334) * 30) | 0), g = [0x5a9a5a, 0x8a5a26, 0xcfdde4, 0x3a7a4a][(hash(k, 3, 334) * 4) | 0];
    put(x, y, g); if (hash(k, 4, 334) > 0.75) put(x + 1, y, mix(g, 0xffffff, 0.85));
  }
  scatter([x0 + 2, y0 + 2, x1 - 2, y1 - 2], 34, 335);
  for (let x = x0; x < x1; x++) if (hash(x, y0, 336) > 0.8) tuft(x, y0 + 2, 337 + x, true);
  for (let y = y0; y < y1; y++) for (const x of [x0 + 1, x1 - 2]) if (hash(x, y, 338) > 0.84) tuft(x, y, 339 + y, hash(x, y, 340) > 0.5);
  gapShadow({ x0, x1, row: 's' }, y0, y1);
}
// vagnsplatsen: grus och jord med hjulspår, ogräs och en eldstad av stenar
function paintTrailerLot(L) {
  const [x0, y0, x1, y1] = L.rect;
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    let c = fbm(x, y, 12, 350) > 0.55 ? dirt(x, y) : gravel(x, y, 0xa49a88, 351);
    if (vnoise(x, y, 9, 352) > 0.64) c = mix(c, GRX[3], 0.6);
    put(x, y, c);
  }
  // hjulspår där husvagnen drogs in
  for (let y = y0 + 20; y < y1; y++) for (const cx of [2652 + SDX, 2688 + SDX]) { const x = Math.round(cx + Math.sin(y * 0.05) * 2); for (let k = -1; k <= 1; k++) put(x + k, y, mix(get(x + k, y), 0x4a3c2c, k === 0 ? 0.5 : 0.25)); }
  // eldstad
  ellipse(2700 + SDX, 588, 5, 2.5, (x, y, t) => put(x, y, t > 0.7 ? mix(0x8a847a, 0x6a665e, hash(x, y, 353)) : mix(0x2a2622, 0x4a443c, hash(x, y, 354))));
  for (let i = 0; i < 30; i++) tuft(x0 + 3 + hash(i, 1, 355) * (x1 - x0 - 6), y0 + 3 + hash(i, 2, 355) * (y1 - y0 - 6), 356 + i, hash(i, 3, 355) > 0.5);
  scatter([x0 + 2, y0 + 2, x1 - 2, y1 - 2], 16, 357);
  gapShadow({ x0, x1, row: 's' }, y0, y1);
}
// norra radens tomt i förorten: skrot, jord, oljefläckar, ogräs
function paintJunkLot(g) {
  const L = lotById(g.lot), [x0, y0, x1, y1] = L ? L.rect : [g.x0, TOP, g.x1, BASE];
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    let c = fbm(x, y, 10, 360) > 0.5 ? dirt(x, y) : gravel(x, y, 0x9a9282, 361);
    if (vnoise(x, y, 8, 362) > 0.62) c = mix(c, GRX[2], 0.6);
    put(x, y, c);
  }
  for (let i = 0; i < 8; i++) stain(x0 + hash(i, 1, 363) * (x1 - x0), y0 + hash(i, 2, 363) * (y1 - y0), 4 + hash(i, 3, 363) * 6, 2 + hash(i, 4, 363) * 3, 0.45);
  for (let i = 0; i < 40; i++) tuft(x0 + 3 + hash(i, 1, 364) * (x1 - x0 - 6), y0 + 3 + hash(i, 2, 364) * (y1 - y0 - 6), 365 + i, hash(i, 3, 364) > 0.5);
  scatter([x0 + 2, y0 + 2, x1 - 2, y1 - 2], 26, 366);
  for (let x = x0; x < x1; x++) { put(x, y1 - 2, grime(granite(x, y1 - 2, 0xaaa59b), x, y1, 1)); put(x, y1 - 1, granite(x, y1 - 1, 0x86817a)); }
  gapShadow(g);
}

// =====================================================================
// KAJEN (760–776) och KANALEN (776–820)
// =====================================================================
function paintQuay(xa = 0, xb = W) {
  // gångytan: stora granithällar i halvförband
  const at = rows(xa, xb, Q0, Q0 + 10, { h: [10, 10], w: [22, 30], seed: 370 });
  stones(at, xa, xb, Q0, Q0 + 10, (s, x, y) => grime(mul(mix(0xb4aea2, 0xa6a094, hash(s.k, s.r, 371)), 0.94 + hash(s.r, s.k, 372) * 0.1), x, y, wornAt(x, y) * 0.8), { hi: 0.12, lo: 0.86, grain: 0.05, joint: (x, y) => (wornAt(x, y) > 0.5 && hash(x, y, 373) > 0.6 ? WEED[1] : 0x6a655d) });
  // kajkanten: överkant (ljus), framsida (solbelyst, sydväst) och en mörk droppkant
  for (let x = xa; x < xb; x++) {
    const worn = wornAt(x, Q1);
    put(x, Q0 + 10, granite(x, Q0 + 10, 0xd4cfc4)); put(x, Q0 + 11, granite(x, Q0 + 11, 0xc6c1b6));
    for (let y = Q0 + 12; y < Q1; y++) put(x, y, grime(granite(x, y, y === Q1 - 1 ? 0x8a857c : 0xb2ada2), x, y, worn * 0.8));
    if (mod(x, 26) === 25) for (let y = Q0 + 10; y < Q1; y++) put(x, y, 0x6a655d);
  }
  // förtöjningsringar i kajkanten
  for (let x = xa + 70; x < xb; x += 180) { put(x, Q1 - 3, 0x2a2a2c); put(x + 1, Q1 - 4, 0x3a3a3e); put(x + 2, Q1 - 3, 0x2a2a2c); put(x + 1, Q1 - 2, 0x1a1a1c); put(x + 1, Q1 - 3, 0x8a5a36); }
  // räcket: stolpar och två ledstänger (rostigt och bucklat i förorten, en bit saknas)
  const gone = (x) => (x > 2230 + SDX && x < 2262 + SDX) || (PIER && x >= PIER.walk[0] && x < PIER.walk[2]);   // (v4) öppningen till piren
  for (let x = xa; x < xb; x++) {
    if (gone(x)) continue;
    const worn = wornAt(x, Q1), sag = worn > 0.5 ? Math.round(Math.sin(x * 0.07) * vnoise(x, 0, 30, 374) * 1.4) : 0;
    const iron = worn > 0.5 && hash(x, 0, 375) > 0.6 ? 0x6a4a32 : 0x2a2c32, hi = worn > 0.5 ? 0x8a6a4a : 0x5a5e68;
    if (mod(x, 12) === 0) { for (let y = Q0 + 4; y < Q0 + 12; y++) put(x, y, y === Q0 + 4 ? hi : iron); put(x + 1, Q0 + 5, mul(iron, 0.7)); shade(x + 1, Q0 + 3, 0.8); }
    put(x, Q0 + 4 + sag, hi); put(x, Q0 + 5 + sag, iron);                                     // överliggaren
    put(x, Q0 + 8, iron);                                                                     // mittstången
    shade(x + 1, Q0 + 2 + sag, 0.86);                                                         // skuggan faller norrut
  }
}
function paintCanal(xa = 0, xb = W) {
  const y0 = CN0, wl = CN0 + 7, wst = xb <= 0;                                                // kajmurens framsida, vattenlinjen
  // kajmuren: granitblock som blir mörka och våta nertill, alger vid vattenlinjen
  const at = rows(xa, xb, y0, wl, { h: [3, 4], w: [10, 18], seed: 380, bond: true });
  stones(at, xa, xb, y0, wl, (s, x, y) => mul(mix(0x7e7a72, 0x6a665e, hash(s.k, s.r, 381)), 1 - (y - y0) * 0.06), { hi: 0.1, lo: 0.8, grain: 0.06, joint: () => 0x3a3834 });
  for (let x = xa; x < xb; x++) {
    put(x, wl - 1, mix(get(x, wl - 1), 0x3e5a3a, 0.7)); if (hash(x, 0, 382) > 0.5) put(x, wl - 2, mix(get(x, wl - 2), 0x4a6a3a, 0.5));
    if (hash(x, 1, 383) > 0.97) for (let y = y0 + 1; y < wl - 1; y++) put(x, y, mix(get(x, y), 0x5a4a34, 0.3)); // rostränder från ringarna
  }
  // vattnet: djupare nedåt, murens spegling överst, avlånga krusningar
  for (let y = wl; y < H; y++) for (let x = xa; x < xb; x++) {
    const f = (y - wl) / (H - wl), worn = wornAt(x, 790);
    let c = mix(0x3e7088, 0x1c3c54, f);
    if (worn > 0.3) c = mix(c, 0x3a5a4a, worn * 0.35);                                         // grumligare i förorten
    if (y < wl + 4) c = mix(c, 0x2a3a40, (wl + 4 - y) * 0.16 + (vnoise(x, y, 4, 384) - 0.5) * 0.2); // murens spegling
    const r = vnoise(x * 0.3, y * 1.6, 3, 385) * 0.7 + vnoise(x * 0.1, y, 6, 386) * 0.3;
    if (r > 0.7) c = mix(c, 0x9ac4dc, 0.3 + (r - 0.7) * 0.9);
    else if (r < 0.28) c = mul(c, 0.86);
    put(x, y, c);
  }
  for (let x = xa; x < xb; x++) if (hash(x, 2, 387) > 0.994) { put(x, wl + 2, 0xd8a040); }       // löv som flyter
  if (wst) return;
  // förorten: skräp i vattnet – en kundvagn som sticker upp, ett däck, en flaska, en påse
  const cart = [2130 + SDX, 806];
  for (let x = cart[0]; x < cart[0] + 12; x++) { put(x, cart[1], 0x9aa0a6); if (x % 3 === 0) for (let y = cart[1]; y < cart[1] + 5; y++) put(x, y, mix(get(x, y), 0x8a9096, 0.6)); }
  for (let y = cart[1]; y < cart[1] + 5; y++) put(cart[0] + 11, y, mix(get(cart[0] + 11, y), 0x9aa0a6, 0.7));
  ellipse(2460 + SDX, 798, 5, 2, (x, y, t) => { if (t > 0.45) put(x, y, t > 0.8 ? 0x1a1a1c : 0x2e2e30); });
  put(2580 + SDX, 790, 0x5a9a5a); put(2581 + SDX, 790, 0x6aaa6a); put(2582 + SDX, 790, 0xdfe8ee);
  for (const [px, py] of [[1980 + SDX, 812], [2640 + SDX, 802]]) { put(px, py, 0xe6e8ea); put(px + 1, py, 0xd2d6da); put(px, py + 1, 0xc8ccd0); put(px + 1, py + 1, 0xb8bcc2); }
}

// =====================================================================
// Marken för hela världen
// =====================================================================
const CWS_N = CROSSWALKS, CWS_S = CROSSWALKS_S;
const SLOW = new Set();
function step(name, fn) {
  try { fn(); } catch (e) { if (!SLOW.has(name)) { SLOW.add(name); console.error(`marken: ${name} kunde inte målas:`, e); } }
}
// Dagens mark som en lista med steg (namn, målare) – paintDay kör alla på en gång, prewarmGround
// några åt gången när webbläsaren har tid över (så att första gången ut i staden inte fryser).
function daySteps() {
  POTHOLES.length = 0;
  const L = [];
  const step = (name, fn) => L.push([name, fn]);
  step('bakgatan', paintBack);
  step('norra raden', () => {
    for (const g of ROW_N) {
      if (g.kind === 'lot') paintJunkLot(g);
      else if (g.kind === 'street' && g.road === 'infarten') paintPedestrian(g, TOP, BASE, 'granit');
      else if (g.kind === 'street' && g.x0 >= XD && g.x1 <= RX0) paintPedestrian(g, TOP, BASE, 'granit');   // (v3) Bankgatan: gångstråk i granit, inga bilar
      else if (g.kind === 'street' && g.x1 <= 0) paintPedestrian(g, TOP, BASE, 'tegel');                    // (v4) Marknadsgatan: gågata i tegel
      else if (g.kind === 'street') paintSideStreet(g);
      else paintAlley(g);
    }
    backShadows(HOUSES_N, TOP, 'n');
  });
  step('norra trottoaren', () => paintSidewalkTop({
    y0: SN0, cws: CWS_N, houses: HOUSES_N, drives: [], seed: 300,
    lids: [118, 470, 1116, 1400, 1622, 1830, 2290, 1880 + SDX, 2130 + SDX, 2380 + SDX, 2560 + SDX], valves: [232, 640, 1040, 1508, 1990, 1990 + SDX, 2440 + SDX],
  }));
  // (v4) Linnéstadens bitar av samma band: samma målare, klippta till x < 0
  const CWL_N = CWS_N.filter((c) => c.x1 <= 0), CWL_S = CWS_S.filter((c) => c.x1 <= 0), STL = BUS_STOPS.filter((s) => s.x < 0 && s.road === 'pixelgatan');
  step('Linnéstaden: norra trottoaren', () => west(() => paintSidewalkTop({
    xa: X0, xb: 0, y0: SN0, cws: CWL_N, houses: L_N, drives: [], seed: 2300, lids: [-1120, -700, -380, -60], valves: [-980, -520, -200],
  })));
  step('Pixelgatan', () => paintRoadX({ y0: R0, y1: R1, dy: 0, seed: 400, cws: CWS_N, stops: BUS_STOPS.filter((s) => s.road === 'pixelgatan'), openN: [], openS: [[I0, I1]] }));
  step('Linnéstaden: Pixelgatan', () => west(() => paintRoadX({
    xa: X0, xb: 0, y0: R0, y1: R1, dy: 0, seed: 2400, cws: CWL_N, stops: STL, openN: [], openS: [],
    patch: [[-1100, 250, 34, 12, -0.1], [-640, 226, 26, 14, 0.06], [-262, 254, 40, 11, -0.08]], mh: [[-980, 233], [-420, 260], [-150, 233]],
  })));
  // låg kant där gångarna börjar: parkens gångar, förortens hållplatsstig och hela Finanstorget (torget går ända fram)
  const parkLow = (x) => PARK_LAYOUT.paths.some((p) => x >= p[0] && x < p[2]) || SUB_LAYOUT.paths.some((p) => x >= p[0] && x < p[2])
    || (DOWNTOWN_LAYOUT && x >= DOWNTOWN_LAYOUT.plaza[0] && x < DOWNTOWN_LAYOUT.plaza[2]);
  step('södra trottoaren', () => paintSidewalkBottom({
    y0: SS0, cws: CWS_N, stops: BUS_STOPS.filter((s) => s.road === 'pixelgatan'), drives: lotById('parkering')?.drive ? [lotById('parkering').drive] : [],
    lowAt: parkLow, seed: 320, lids: [206, 842, 1330, 1566, 1900, 1850 + SDX, 2200 + SDX, 2480 + SDX], valves: [118, 1000, 1470, 2340, 2120 + SDX, 2600 + SDX], hop: [1122, 0],
  }));
  const LT = LINNE_LAYOUT;
  step('Linnéstaden: södra trottoaren', () => west(() => paintSidewalkBottom({
    xa: X0, xb: 0, y0: SS0, cws: CWL_N, stops: STL, drives: [], seed: 2320,
    lowAt: (x) => (LT && x >= LT.torg[0] && x < LT.torg[2]) || (LT && LT.walks.some((w) => x >= w[0] && x < w[2])),
    lids: [-1150, -690, -300], valves: [-1010, -420, -90], hop: [-412, 0.1],
  })));
  step('parken', paintPark);
  step('Linnéstaden: torget, odlingen och Lindparken', () => west(paintLinneBand));
  step('downtown: Finanstorget och bakgatan', paintDowntownBand);
  step('förortens mellanband', paintSuburbBand);
  step('södra raden', paintSouthRow);
  const doorDrive = [...HOUSES_S.filter((b) => b.door.type === 'roll').map((b) => [b.door.x0 - 2, b.door.x1 + 2]), [1604, 1642], [1662, 1698]];
  step('trottoaren framför södra raden', () => paintSidewalkTop({
    y0: BASE_S, cws: CWS_S, houses: HOUSES_S.filter((b) => b.base === BASE_S), drives: doorDrive, seed: 1300,
    lids: [96, 540, 980, 1180, 1540, 1860, 2310, 1880 + SDX, 2300 + SDX, 2640 + SDX], valves: [300, 760, 1300, 2000, 2060 + SDX, 2520 + SDX],
  }));
  step('Linnéstaden: trottoaren framför södra raden', () => west(() => paintSidewalkTop({
    xa: X0, xb: 0, y0: BASE_S, cws: CWL_S, houses: L_S.filter((b) => b.base === BASE_S), drives: [], seed: 3300, lids: [-1100, -560, -200], valves: [-860, -340],
  })));
  step('Södergatan', () => paintRoadX({ y0: RS0, y1: RS1, dy: DY, seed: 1400, cws: CWS_S, stops: BUS_STOPS.filter((s) => s.road === 'sodergatan'), openN: [[I0, I1]], openS: [] }));
  step('Linnéstaden: Södergatan', () => west(() => paintRoadX({
    xa: X0, xb: 0, y0: RS0, y1: RS1, dy: DY, seed: 3400, cws: CWL_S, stops: [], openN: [], openS: [],
    patch: [[-900, 690, 30, 12, -0.08], [-300, 712, 24, 10, 0.06]], mh: [[-700, RS0 + 41], [-240, RS0 + 15], [-1120, RS0 + 41]],
  })));
  step('bortre trottoaren', () => paintSidewalkBottom({
    y0: SX0, cws: CWS_S, stops: BUS_STOPS.filter((s) => s.road === 'sodergatan'), drives: [], lowAt: () => false, seed: 1320,
    lids: [150, 690, 1250, 1620, 1950, 2330, 2050 + SDX, 2500 + SDX], valves: [420, 900, 1460, 2200, 2280 + SDX], hop: [1840 + SDX, 0.55],
  }));
  step('Linnéstaden: bortre trottoaren', () => west(() => paintSidewalkBottom({
    xa: X0, xb: 0, y0: SX0, cws: CWL_S, stops: [], drives: [], lowAt: () => false, seed: 3320, lids: [-1000, -480, -120], valves: [-760, -260],
  })));
  step('kajen', () => { paintQuay(); west(() => paintQuay(X0, 0)); });
  step('kanalen', () => { paintCanal(); west(() => paintCanal(X0, 0)); });
  step('Infarten', paintInfarten);
  step('pölarna', paintDryPuddles);
  step('floden (platshållare)', paintRiverPlaceholder);
  return L;
}
function paintDay() {
  for (const [name, fn] of daySteps()) step(name, fn);
}

function nightTint(d) {
  for (let i = 0; i < d.length; i += 4) { d[i] *= 0.86; d[i + 1] *= 0.9; d[i + 2] = Math.min(255, d[i + 2] * 0.97 + 8); }
}
// Dagens bild målas en gång; natten är samma bild tonad (sparar ett helt tungt pass).
let DAY = null;
let WARM = null;   // påbörjad förmålning: { P, sh, steps, i }
// Måla dagens mark i förväg, ett steg i taget, högst ~budget ms per anrop (ett steg körs alltid helt).
// Scenen anropar den när webbläsaren har tid över; true = klart (paintGround blir då bara en kopia).
export function prewarmGround(budget = 12) {
  if (DAY) return true;
  if (!WARM) WARM = { P: new Pix(GW, H), sh: new Uint8Array(GW * H), steps: daySteps(), i: 0 };
  const t0 = performance.now();
  D = WARM.P.d; SH = WARM.sh;
  try {
    while (WARM.i < WARM.steps.length) {
      const [name, fn] = WARM.steps[WARM.i++];
      step(name, fn);
      if (performance.now() - t0 >= budget) break;
    }
  } finally { D = null; SH = null; }
  if (WARM.i < WARM.steps.length) return false;
  DAY = new Uint8ClampedArray(WARM.P.d);
  WARM = null;
  return true;
}
export function paintGround(night) {
  const P = new Pix(GW, H);
  if (!DAY && WARM) prewarmGround(Infinity);      // en påbörjad förmålning görs klar
  if (!DAY) {
    D = P.d; SH = new Uint8Array(GW * H);
    try { paintDay(); } finally { D = null; SH = null; }
    DAY = new Uint8ClampedArray(P.d);
  } else P.d.set(DAY);
  if (night) nightTint(P.d);
  return P.flush();
}

// =====================================================================
// LEVANDE MARK – blöt asfalt, pölar, regnringar, krusningar, fotspår i snön
// (billigt: förmålade bilder + några hundra pixlar per bildruta, bara i bild)
// =====================================================================
const CW = 720, CHh = 420;
let CLOUD = null;
function cloudTex() {
  if (CLOUD) return CLOUD;
  const dens = new Float32Array(CW * CHh);
  for (let i = 0; i < 4; i++) {
    const cx = (i + hash(i, 1, 901) * 0.6) * CW / 4, cy = hash(i, 2, 901) * CHh, sz = 80 + hash(i, 3, 901) * 70;
    for (let j = 0; j < 8; j++) {
      const bx = cx + (hash(i, j, 902) - 0.5) * sz * 1.6, by = cy + (hash(i, j, 903) - 0.5) * sz * 0.5;
      const rx = sz * (0.35 + hash(i, j, 904) * 0.35), ry = sz * (0.22 + hash(i, j, 905) * 0.14);
      for (let y = Math.floor(by - ry); y <= by + ry; y++) for (let x = Math.floor(bx - rx); x <= bx + rx; x++) {
        const d = 1 - Math.hypot((x + 0.5 - bx) / rx, (y + 0.5 - by) / ry);
        if (d <= 0) continue;
        const k = (((y % CHh) + CHh) % CHh) * CW + (((x % CW) + CW) % CW);
        if (d > dens[k]) dens[k] = d;
      }
    }
  }
  const P = new Pix(CW, CHh);
  for (let y = 0; y < CHh; y++) for (let x = 0; x < CW; x++) {
    const d0 = dens[y * CW + x];
    if (d0 <= 0) continue;
    const d = d0 + (vnoise(x, y, 9, 906) - 0.5) * 0.12;
    if (d > 0.3 || (d > 0 && bayer(x, y) < d / 0.3)) P.px(x, y, 0x0c1422);
  }
  return (CLOUD = P.flush());
}
// Ytslagen för den blöta marken: 1 väg, 2 gång/trottoar/tomt, 3 gräs, 0 vatten/inget
const PARK_WALKS = [...PARK_LAYOUT.walks, ...PARK_LAYOUT.paths, PARK_LAYOUT.promenade];
const SUB_HARD = [...LOTS.filter((l) => l.row === 'm' && l.kind !== 'lekplats_x').map((l) => l.rect), ...SUB_LAYOUT.paths];
const PARKING = lotById('parkering')?.rect || [0, 0, 0, 0];
const RIVER_WATER = RIVER ? RIVER.water : [];
const LINNE_HARD = LINNE_LAYOUT ? [LINNE_LAYOUT.torg, LINNE_LAYOUT.promenade, ...LINNE_LAYOUT.walks, LINNE_LAYOUT.odling] : [];
function surfaceAt(x, y) {
  if (x < 0 && y >= PK0 && y < BS0) return LINNE_HARD.some((r) => inR(x, y, r)) && !LINNE_LAYOUT.beds.some((r) => inR(x, y, r)) ? 2 : 3;   // (v4)
  if (x >= RX0 && x < RX1 && RIVER_WATER.some((r) => inR(x, y, r))) return 0;     // floden (broarnas däck är väg/gång)
  if (y >= CN0) return 0;
  if ((y >= R0 && y < R1) || (y >= RS0 && y < RS1) || (x >= I0 && x < I1 && y >= R1 && y < RS0)) return 1;
  if (y < 8) return 0;
  if (y < TOP || (y >= SN0 && y < R0) || (y >= SS0 && y < SS1) || (y >= BASE_S && y < RS0) || y >= RS1) return 2;
  if (y >= PK0 && y < BS0) {
    if (x < IW0) return PARK_WALKS.some((r) => inR(x, y, r)) ? 2 : 3;
    if (x < IE1) return 2;
    if (x < XS) return 2;                                                                   // Finanstorget och kajerna
    if (inR(x, y, PARKING)) return 1;
    return SUB_HARD.some((r) => inR(x, y, r)) ? 2 : 3;
  }
  // parkgången och husraderna: gränder och gator (under husen syns inget ändå)
  return 2;
}
// blöt mark: mörkare, mättad yta + blanka strimmor där himlen speglas (en förmålad bild)
let WET = null;
function wetTex() {
  if (WET) return WET;
  const P = new Pix(GW, H, X0, 0);                                                            // (v4) duk-x = världs-x − X0
  const srow = new Uint8Array(GW);
  for (let y = 0; y < H; y++) {
    for (let x = X0; x < W; x++) srow[x - X0] = surfaceAt(x, y);
    for (let x = X0; x < W; x++) {
      const s = srow[x - X0];
      if (!s) continue;
      if (s === 3) { P.px(x, y, 0x0a1420, 0.12); continue; }
      P.px(x, y, 0x0c1422, s === 1 ? 0.22 : 0.15);
      if (hash(x, y, 971) > 0.992) P.px(x, y, 0xc8d8ea, 0.35);                                  // glimtar i vattenfilmen
    }
  }
  // himlen speglas i de blanka hjulspåren (båda vägarna och Infarten)
  for (let i = 0; i < 2200; i++) {
    const band = TRACKS[i % TRACKS.length], x = (hash(i, 1, 970) * W) | 0;
    const y = band[0] + ((hash(i, 2, 970) * (band[1] - band[0])) | 0), len = 3 + ((hash(i, 3, 970) * 10) | 0);
    for (let k = 0; k < len; k++) P.px(x + k, y, 0xa8bcd4, 0.3 * (1 - Math.abs(k - len / 2) / len));
  }
  for (let i = 0; i < Math.round(-X0 * 0.55); i++) {                                            // (v4) Linnéstadens bit av vägarna
    const band = TRACKS[i % TRACKS.length], x = X0 + ((hash(i, 1, 973) * -X0) | 0);
    const y = band[0] + ((hash(i, 2, 973) * (band[1] - band[0])) | 0), len = 3 + ((hash(i, 3, 973) * 10) | 0);
    for (let k = 0; k < len; k++) P.px(x + k, y, 0xa8bcd4, 0.3 * (1 - Math.abs(k - len / 2) / len));
  }
  for (let i = 0; i < 160; i++) {
    const band = TRACKS_I[i % 4], x = band[0] + ((hash(i, 4, 970) * (band[1] - band[0])) | 0), y = R1 + ((hash(i, 5, 970) * (RS0 - R1)) | 0), len = 3 + ((hash(i, 6, 970) * 9) | 0);
    for (let k = 0; k < len; k++) P.px(x, y + k, 0xa8bcd4, 0.3 * (1 - Math.abs(k - len / 2) / len));
  }
  // vattenfilm längs rännstenarna
  for (let x = X0; x < W; x++) for (const y of [R0 + 1, R1 - 3, RS0 + 1, RS1 - 3]) {
    const v = vnoise(x, y, 14, 972);
    if (v > 0.45) P.px(x, y, 0xb4c6dc, (v - 0.45) * 0.7);
  }
  return (WET = P.flush());
}
// pölarna som små förmålade bilder (dag/natt): himlens spegling, ljus överkant, våt kant
const PUD_IMG = new Map();
function puddleImg(p, night) {
  const k = p.i + (night ? 'n' : 'd');
  if (PUD_IMG.has(k)) return PUD_IMG.get(k);
  const w = Math.ceil(p.rx * 2.8) + 2, h = Math.ceil(p.ry * 2.8) + 2, ox = Math.floor(p.x - p.rx * 1.4), oy = Math.floor(p.y - p.ry * 1.4);
  const P = new Pix(w, h);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const x = ox + i, y = oy + j;
    const t = Math.hypot((x + 0.5 - p.x) / p.rx, (y + 0.5 - p.y) / p.ry) + (vnoise(x, y, 3, 700 + p.i) - 0.5) * 0.4;
    if (t < 1) {
      const f = (y + 0.5 - (p.y - p.ry)) / (p.ry * 2);
      let c = night ? mix(0x2c3654, 0x161c30, f) : mix(0xb4c8da, 0x5c6c80, f);
      if (t > 0.78) c = mul(c, 0.86);
      if (!night && y < p.y && hash(x, y, 701) > 0.82) c = mix(c, 0xeef4fa, 0.5);
      P.px(i, j, c, 0.74);
    } else if (t < 1.4 && bayer(x, y) < (1.4 - t) / 0.4) P.px(i, j, 0x0a1420, 0.22);         // våt kant
  }
  const img = { cv: P.flush(), x: ox, y: oy };
  PUD_IMG.set(k, img);
  return img;
}
// kvällsreflexer: de tända fönstren speglar sig som darrande, varma strimmor i den
// blöta trottoaren nedanför fasaden (en förmålad bild per hus)
const REFL = new Map();
function reflectImg(b) {
  if (REFL.has(b.id)) return REFL.get(b.id);
  const w = b.w, h = 26, P = new Pix(w, h), seed = b.x + b.base;
  for (let cx = 6 + ((hash(seed, 1, 990) * 6) | 0); cx < w - 4; cx += 12 + ((hash(cx, 2, seed) * 8) | 0)) {
    if (cx >= b.door.x0 - b.x - 4 && cx <= b.door.x1 - b.x + 2) continue;
    const ww = 3 + ((hash(cx, 3, seed) * 4) | 0), warm = hash(cx, 4, seed) > 0.25 ? 0xffd890 : 0xb8d8ff;
    for (let y = 0; y < h; y++) {
      if (hash(cx, y >> 1, seed + 5) < 0.28) continue;                                         // strimman bryts av vattnet
      const wob = Math.round(Math.sin(y * 0.9 + cx) * 1.2), a = 0.5 * (1 - y / h);
      for (let i = 0; i < ww - (y > h * 0.6 ? 1 : 0); i++) P.px(cx + i + wob, y, warm, a * (i === 0 || i === ww - 1 ? 0.6 : 1));
    }
  }
  // dörren: bredare, ljusare
  const dx = b.door.x0 - b.x, dw = b.door.x1 - b.door.x0;
  for (let y = 0; y < h; y++) {
    if (hash(dx, y >> 1, seed + 6) < 0.2) continue;
    const wob = Math.round(Math.sin(y * 0.8) * 1.5);
    for (let i = 2; i < dw - 2; i++) P.px(dx + i + wob, y, 0xffe0a0, 0.55 * (1 - y / h));
  }
  const img = P.flush();
  REFL.set(b.id, img);
  return img;
}
const REFL_HOUSES = [...HOUSES_N, ...HOUSES_S.filter((b) => b.base === BASE_S)];

// ringar (ellipser) för regndroppar i pölar, radie 1–4
const RING = [null];
for (let r = 1; r <= 4; r++) {
  const pts = new Set(), ry = Math.max(1, r * 0.5);
  for (let i = 0; i < 48; i++) { const a = (i / 48) * Math.PI * 2; pts.add(Math.round(Math.cos(a) * r) + ',' + Math.round(Math.sin(a) * ry)); }
  RING.push([...pts].map((s) => s.split(',').map(Number)));
}
// alla pölar: de fasta + potthålen (som fylls först)
let ALL_PUDDLES = null;
function allPuddles() {
  if (ALL_PUDDLES) return ALL_PUDDLES;
  const all = [...PUDDLES, ...POTHOLES.map((p, k) => ({ x: p.x, y: p.y, rx: p.rx, ry: p.ry, i: 500 + k, hole: true }))];
  if (DAY) ALL_PUDDLES = all;                                                                   // potthålen finns först när marken är målad
  return all;
}

// fotspår i snön: varje person lämnar ett avtryck var 5:e px, växelvis vänster/höger fot
const PRINTS = [], MAXP = 1400;
let lastPos = [], printSide = [], printN = 0, overT = -1;
function trackPrints(env) {
  const w = env.weather, snow = w ? w.snowCover || 0 : 0;
  const ppl = env.people || [];
  if (snow < 0.15) { lastPos = ppl.map((p) => ({ x: p.x, y: p.y })); return; }
  for (let i = 0; i < ppl.length; i++) {
    const p = ppl[i], L = lastPos[i];
    if (!L) { lastPos[i] = { x: p.x, y: p.y }; continue; }
    const dx = p.x - L.x, dy = p.y - L.y, d = Math.hypot(dx, dy);
    if (d > 40) { lastPos[i] = { x: p.x, y: p.y }; continue; }                                // teleport/buss – inga spår
    if (d < 5) continue;
    printSide[i] = -(printSide[i] || 1);
    const nx = -dy / d, ny = dx / d;                                                          // åt sidan om gångriktningen
    const pr = { x: Math.round(p.x + nx * 1.6 * printSide[i]), y: Math.round(p.y + ny * 1.2 * printSide[i]), t: env.t, h: Math.abs(dx) >= Math.abs(dy) };
    if (PRINTS.length < MAXP) PRINTS.push(pr); else PRINTS[printN++ % MAXP] = pr;
    lastPos[i] = { x: p.x, y: p.y };
  }
  lastPos.length = ppl.length;
}
function drawPrints(ctx, env, view) {
  const w = env.weather, snow = w ? w.snowCover || 0 : 0;
  if (snow < 0.15 || !PRINTS.length) return;
  const vx0 = view.x - 2, vy0 = view.y - 2, vx1 = view.x + view.w + 2, vy1 = view.y + view.h + 2;
  const fill = w.kind === 'snö' ? 0.02 + 0.03 * (w.intensity || 0) : 0.006;                  // nysnö fyller igen spåren
  const k = clamp01((snow - 0.15) / 0.3);
  for (const p of PRINTS) {
    if (p.x < vx0 || p.x > vx1 || p.y < vy0 || p.y > vy1 || p.y > CITY.WALK_BOTTOM + 1) continue;
    const a = k * 0.55 * (1 - (env.t - p.t) * fill);
    if (a <= 0.03) continue;
    ctx.fillStyle = `rgba(92,104,128,${a.toFixed(3)})`;
    if (p.h) ctx.fillRect(p.x - 1, p.y, 3, 1); else ctx.fillRect(p.x, p.y - 1, 2, 2);
    ctx.fillStyle = `rgba(250,252,255,${(a * 0.7).toFixed(3)})`;
    ctx.fillRect(p.x - (p.h ? 1 : 0), p.y - (p.h ? 1 : 2), p.h ? 3 : 2, 1);                   // uppkastad snö vid kanten
  }
}

export function groundLive(ctx, env, view) {
  const vx0 = Math.floor(view.x), vy0 = Math.floor(view.y), vx1 = vx0 + Math.ceil(view.w), vy1 = vy0 + Math.ceil(view.h);
  const w = env.weather;
  // molnskuggor som driver förbi på dagen (bara utan väder-modulen – weather.js ritar egna)
  if (!w && !env.rain && env.dark < 0.4) {
    const tex = cloudTex();
    const ox = Math.floor(mod(env.t * 5, CW)), oy = Math.floor(mod(env.t * 1.2, CHh));
    ctx.save();
    ctx.globalAlpha = 0.13 * (1 - env.dark / 0.4);
    for (let ty = Math.floor((vy0 - oy) / CHh) * CHh + oy; ty < vy1; ty += CHh)
      for (let tx = Math.floor((vx0 - ox) / CW) * CW + ox; tx < vx1; tx += CW) {
        const sx0 = Math.max(vx0, tx), sy0 = Math.max(vy0, ty), sx1 = Math.min(vx1, tx + CW), sy1 = Math.min(vy1, ty + CHh);
        if (sx1 > sx0 && sy1 > sy0) ctx.drawImage(tex, sx0 - tx, sy0 - ty, sx1 - sx0, sy1 - sy0, sx0, sy0, sx1 - sx0, sy1 - sy0);
      }
    ctx.restore();
  }
  const snow = w ? w.snowCover || 0 : 0;
  const wet = w ? w.wet || 0 : env.rain ? 0.8 : 0;
  const raining = w ? w.kind === 'regn' : !!env.rain;
  const frozen = w && ((w.season === 'vinter' && w.temp <= 0) || snow > 0.25);
  ctx.save();
  // krusningar som driver på kanalen (inte när den är frusen)
  if (!frozen && vy1 > CN0 + 7) {
    const t = env.t, drift = (w?.windNow ?? w?.wind ?? 6) * 0.25 + 3;
    ctx.fillStyle = env.night ? 'rgba(120,150,190,0.22)' : 'rgba(210,232,246,0.34)';
    const n = Math.round(26 * view.w / 384);
    for (let i = 0; i < n; i++) {
      const y = CN0 + 9 + ((hash(i, 1, 980) * (H - CN0 - 11)) | 0);
      if (y < vy0 || y >= vy1) continue;
      const x = vx0 + mod(hash(i, 2, 980) * view.w + t * drift * (0.6 + hash(i, 3, 980)), view.w + 20) - 10;
      const len = 3 + ((hash(i, 4, 980) * 6) | 0), ph = Math.sin(t * 1.6 + i);
      ctx.fillRect(Math.round(x), y, Math.max(1, Math.round(len * (0.6 + 0.4 * ph))), 1);
    }
  }
  // blöt mark, pölar och regnringar
  if (wet > 0.05 && snow < 0.6) {
    const a = clamp01(wet * 1.25) * (1 - snow);
    const wx0 = Math.max(X0, vx0), wy0 = Math.max(0, vy0), wx1 = Math.min(W, vx1), wy1 = Math.min(H, vy1);
    ctx.globalAlpha = a;
    if (wx1 > wx0 && wy1 > wy0) ctx.drawImage(wetTex(), wx0 - X0, wy0, wx1 - wx0, wy1 - wy0, wx0, wy0, wx1 - wx0, wy1 - wy0);
    const night = !!env.night;
    for (const p of allPuddles()) {
      if (p.x + p.rx * 1.4 < vx0 || p.x - p.rx * 1.4 > vx1 || p.y + p.ry * 1.4 < vy0 || p.y - p.ry * 1.4 > vy1) continue;
      const size = p.rx * p.ry;                                                               // små pölar torkar först
      const pa = p.hole ? clamp01((wet - 0.08) / 0.25) : clamp01((wet - (size > 14 ? 0.12 : 0.28)) / 0.3);
      if (pa <= 0.02) continue;
      const img = puddleImg(p, night);
      ctx.globalAlpha = pa * (1 - snow);
      ctx.drawImage(img.cv, img.x, img.y);
      if (!raining) continue;
      const n = p.rx > 7 ? 3 : 2, rmax = Math.max(1, Math.min(4, Math.floor(p.rx * 0.5)));
      ctx.globalAlpha = 1;
      for (let k = 0; k < n; k++) {
        const ph = env.t * 1.3 + hash(p.i, k, 950) * 3, cyc = Math.floor(ph), f = ph - cyc;
        const cx = Math.round(p.x + (hash(p.i, k * 31 + cyc, 951) - 0.5) * (p.rx - rmax)), cy = Math.round(p.y + (hash(p.i, k * 31 + cyc, 952) - 0.5) * p.ry * 0.5);
        const r = 1 + Math.floor(f * rmax);
        ctx.fillStyle = `rgba(214,228,246,${(0.6 * (1 - f) * pa).toFixed(3)})`;
        for (const [dx, dy] of RING[Math.min(4, r)]) ctx.fillRect(cx + dx, cy + dy, 1, 1);
      }
    }
    // de tända fönstren speglar sig i den blöta trottoaren när det mörknar
    const kn = clamp01((env.dark - 0.15) / 0.3) * clamp01((wet - 0.15) / 0.4) * (1 - snow);
    if (kn > 0.02) {
      ctx.globalAlpha = kn;
      for (const b of REFL_HOUSES) {
        if (b.x + b.w < vx0 || b.x > vx1 || b.base + 30 < vy0 || b.base > vy1) continue;
        if (b.open && !(env.hour >= b.open[0] && env.hour < b.open[1])) continue;             // stängt och släckt
        ctx.drawImage(reflectImg(b), b.x, b.base + 3);
      }
    }
    ctx.globalAlpha = 1;
    // stänk där dropparna slår i marken (bara utan weather.js – den ritar egna stänk)
    if (raining && !w) {
      ctx.fillStyle = 'rgba(206,222,244,0.5)';
      const cnt = Math.min(260, Math.round(60 * (view.w * view.h) / (384 * 216))), s = Math.floor(env.t * 9);
      for (let j = 0; j < cnt; j++) {
        const x = vx0 + Math.floor(hash(j, s, 960) * (vx1 - vx0)), y = vy0 + Math.floor(hash(j, s, 961) * (vy1 - vy0));
        ctx.fillRect(x, y, 1, 1);
        if (hash(j, s, 962) > 0.6) { ctx.fillRect(x - 1, y - 1, 1, 1); ctx.fillRect(x + 1, y - 1, 1, 1); }
      }
    }
  }
  // fotspår i snön
  trackPrints(env);
  if (env.t - overT > 0.5) drawPrints(ctx, env, view);                                        // groundOver är inte inkopplat – rita här
  ctx.restore();
}

// Efter weather.drawBack (ovanpå snötäcket): fotspåren där folk har gått.
export function groundOver(ctx, env, view) {
  overT = env.t;
  ctx.save();
  drawPrints(ctx, env, view);
  ctx.restore();
}
