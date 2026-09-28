// BOSTADSBYRÅN – ett elegant mäklarkontor man går runt i med sin egen figur.
// Kontoret är en och en halv skärm brett (kameran följer figuren):
//
//   väntrummet   – kaffebänk med espressomaskin och kanelbullar, väggklocka som
//                  visar spelets tid, stort fönster ut mot gatan (bilar och folk
//                  passerar på riktigt), chesterfieldsoffa där en kund sitter och
//                  väntar, marmorbord med tidningar och tulpaner, fåtölj, golvlampa
//   dörren       – glasdörr ut till staden med öppettider i guld, dörrmatta,
//                  paraplyställ, nummerlappsautomat och flyttkartonger
//   annonsväggen – mörkblå vägg med en stor inramad planch per bostad i HOMES:
//                  detaljerad bild, insats, hyra och sömn. Den man bor i får en
//                  grön "DITT HEM"-rosett; insatsen lyser grönt om man har råd.
//                  Framför: gallerisoffa (sätt dig och titta), arkitektmodell i
//                  monter, staffli med planritning från visningen, pampasvas
//   mäklaren     – skrivbord i valnöt med dator (visar annonserna), bankirlampa,
//                  namnskylt och kaffe; bokhylla med pärmar, arkivskåp, nyckelskåp,
//                  diplom, "NUMMER"-tavla, fönster med persienner och taxen
//                  Kanelbulle som sover i sin korg (vaknar och viftar när man kommer)
//
// Klick på en planch (eller på mäklaren) → figuren går dit och bostadsdialogen
// (js/shops/bostad.js via A.openHousing) öppnas. Allt målas en gång med
// Pix-pennan (ett pixelkorn, 3–5 toner, mörk kontur) och cachas; varje bildruta
// ritar bara färdiga bilder plus det som lever (trafik, ånga, klockan, lappar,
// taxen). På kvällen läggs ett dunkel med ljuskäglor runt lamporna över allt.
import { drawPerson, makeLook } from '../core/people.js';
import { Pix, SMALL, BIG, ctxText, textW, text, eachTextPixel, mix, mul, hash, bayer } from '../core/floor-pix.js';
import { toast } from '../core/ui.js';
import { HOMES, fmt } from '../game.js';
import { play } from '../core/sound.js';
import { createWalker, selfDrawable, folkDrawables, WALK_SEQ } from './walkable.js';

// ================= mått och plats =================
const VW = 384, W = 600, H = 216;
const WALL_Y = 100;                              // golvet börjar här
const WIN1 = { x: 52, y: 24, w: 80, h: 52 };     // glaset i väntrummets stora fönster
const WIN2 = { x: 486, y: 24, w: 62, h: 48 };    // fönstret bakom mäklaren
const DOOR = { x0: 146, x1: 174, top: 38 };      // glasdörren ut till gatan
const DOOR_CX = (DOOR.x0 + DOOR.x1) / 2;
const FEAT = { x0: 184, x1: 386 };               // den mörkblå annonsväggen
const PW = 62, PH = 72, PY = 20;                 // planscherna
const POSTERS = (() => {
  const n = Math.max(1, HOMES.length), gap = 5;
  const pw = Math.min(PW, Math.floor((FEAT.x1 - FEAT.x0 - 8 - gap * (n - 1)) / n));
  const x0 = FEAT.x0 + Math.floor((FEAT.x1 - FEAT.x0 - (n * pw + (n - 1) * gap)) / 2);
  return HOMES.map((home, i) => ({ home, x: x0 + i * (pw + gap), y: PY, w: pw, h: PH }));
})();
const COFFEE = { x: 8, base: 106 };              // kaffebänken (vänster kant, golvlinje)
const SOFA = { x: 52, base: 119, w: 78 };        // chesterfieldsoffan under fönstret
const TABLE = { x: 91, base: 146 };              // marmorbordet
const CHAIR = { x: 22, base: 156 };              // fåtöljen
const LAMP = { x: 40, base: 116 };               // golvlampan
const RACK = { x: 44, base: 160 };               // tidningsstället
const TICKET = { x: 180, base: 110 };            // nummerlappsautomaten
const UMBR = { x: 139, base: 105 };              // paraplystället vid dörren
const BENCH = { x: 285, base: 152, w: 58 };      // gallerisoffan framför planscherna
const MODEL = { x: 228, base: 196 };             // arkitektmodellen i monter
const EASEL = { x: 348, base: 192 };             // stafflit med veckans visning
const DOG = { x: 572, base: 154 };               // mäklarens tax i sin korg
const BOXES = { x: 158, base: 204 };             // flyttkartonger (för kunder som ska flytta)
const PAMPAS = { x: 432, base: 198 };            // golvvas med pampasgräs
const DOLL = { x: 100, base: 204 };              // dockskåpet i barnhörnan
const BROCH = { x: 292, base: 206 };             // broschyrstället
const SIDE = { x: 392, base: 174 };              // sidobord med godisskål och lampa
const PRINT = { x: 573, base: 138 };             // skrivaren på sideboarden bredvid skrivbordet
const BIN = { x: 473, base: 140 };               // papperskorgen vid skrivbordet
const SIGN = { x: 530, base: 208 };              // TILL SALU-skylten med SÅLT!-lapp
const DESK = { x: 484, base: 142, w: 66 };       // mäklarens skrivbord
const DESK_CX = DESK.x + 33;
const BOSS = { x: DESK.x + 38, y: 124 };         // mäklaren sitter här (fötterna)
const GUEST = [DESK.x + 10, DESK.x + 56];        // besöksstolarna (x), ryggen mot oss
const GUEST_Y = 160;
const SHELF = { x: 436, base: 104 };             // bokhyllan med pärmar
const COOLER = { x: 420, base: 106 };            // vattenautomaten
const FILES = { x: 556, base: 106 };             // arkivskåpen
const PLANTS = [{ x: 402, base: 108, k: 'fikus' }, { x: 14, base: 212, k: 'monstera' }, { x: 588, base: 214, k: 'monstera2' }];
const SEATS = [SOFA.x + 22, SOFA.x + 57];        // sittplatser i soffan (x) – kunden har den högra
const DIPLOMA_X = 436;                           // diplomet (vänsterkant) mellan nummertavlan och fotona
const PHOTO = { x: 469, y: 18 };                 // inramade foton intill fönstret bakom mäklaren
// kontaktskuggor på golvet: [x, y, rx, ry] (fotpunkt och storlek)
const SHADOWS = [
  [SOFA.x + SOFA.w / 2, SOFA.base, SOFA.w / 2 + 3, 4], [TABLE.x, TABLE.base, 24, 4], [CHAIR.x, CHAIR.base, 13, 3.5],
  [LAMP.x, LAMP.base, 6, 2], [RACK.x, RACK.base, 8, 2.5], [TICKET.x, TICKET.base, 6, 2], [UMBR.x, UMBR.base, 7, 2],
  [MODEL.x, MODEL.base, 14, 3], [BENCH.x, BENCH.base, (BENCH.w >> 1) + 2, 3], [EASEL.x, EASEL.base, 18, 3],
  [DOG.x, DOG.base, 17, 3], [BOXES.x, BOXES.base, 19, 3.5], [PAMPAS.x, PAMPAS.base, 8, 2.5],
  [DESK.x + DESK.w / 2, DESK.base, DESK.w / 2 + 4, 4], ...GUEST.map((x) => [x, GUEST_Y, 9, 2.5]),
  ...PLANTS.map((p) => [p.x, p.base, 9, 3]), [DOLL.x + 2, DOLL.base, 22, 3.5], [BROCH.x, BROCH.base, 10, 2.5],
  [SIDE.x, SIDE.base, 9, 2.5], [PRINT.x, PRINT.base, 19, 3], [BIN.x, BIN.base, 6, 2], [SIGN.x - 2, SIGN.base, 11, 2.5],
  [COFFEE.x + 19, COFFEE.base, 22, 3], [SHELF.x + 21, SHELF.base, 23, 3], [COOLER.x, COOLER.base, 9, 2.5], [FILES.x + 22, FILES.base, 24, 3],
];
const isNight = (h) => h >= 19.5 || h < 6.5;

// ================= färger =================
const OUT = 0x221a26;
const NAVY = 0x1f2d48, NAVY_HI = 0x34496e, NAVY_LO = 0x121a2e;
const GOLD = 0xd8b45a, GOLD_HI = 0xfff0b0, GOLD_LO = 0x8a6a2a;
const PAPER = 0xfbf7ee, WHITE = 0xf6f2ea;
const LEATHER = [0x3e1c10, 0x62301a, 0x8a4a26, 0xb06a38, 0xcf8e52, 0xecb884];
const VELVET = [0x0c1428, 0x18264a, 0x283c6a, 0x3c568a, 0x5a78ae, 0x88a4d0];
const CHROME = [0x3a4048, 0x646c76, 0x9aa2ac, 0xc8ced6, 0xeef2f6];
const WALNUT = [0x2a160c, 0x472714, 0x683c20, 0x8c5630, 0xb07444, 0xcc9460];
const LEAF = [0x0e2a14, 0x1a4422, 0x28602c, 0x3a7e38, 0x5a9e46, 0x8cc462];
const STEEL = [0x4a4e56, 0x70767e, 0x9aa0a8, 0xc0c6cc, 0xe2e6ea];

// ================= små verktyg =================
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const q = (t, x, y, n = 4) => clamp(Math.round(t * n + bayer(x, y) - 0.5), 0, n) / n;
// välj ton ur en palett; ordnad dithering bara i övergången mellan två toner
function tone(pal, v, x, y) {
  const f = clamp(v, 0, 0.999) * (pal.length - 1);
  let i = Math.floor(f);
  if (f - i > 0.25 + bayer(x, y) * 0.5) i++;
  return pal[Math.min(pal.length - 1, i)];
}
function vgrad(P, x, y, w, h, c0, c1, n = 4) {
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) P.px(x + i, y + j, mix(c0, c1, q(h > 1 ? j / (h - 1) : 0, x + i, y + j, n)));
}
function disc(P, cx, cy, rx, ry, c, a = 1) {
  for (let y = Math.floor(cy - ry); y <= cy + ry; y++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
    if (((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1) P.px(x, y, c, a);
  }
}
// mörk kontur runt allt målat: hård nedtill/höger, mjukare upptill/vänster
function outline(P, dark = OUT, softA = 0.75) {
  const { w, h, d } = P;
  const S = (x, y) => x >= 0 && y >= 0 && x < w && y < h && d[(y * w + x) * 4 + 3] > 200;
  const add = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (d[(y * w + x) * 4 + 3]) continue;
    const hard = S(x, y - 1) || S(x - 1, y), soft = S(x, y + 1) || S(x + 1, y);
    if (hard || soft) add.push(x, y, hard ? 1 : 0);
  }
  for (let i = 0; i < add.length; i += 3) P.px(add[i] + P.ox, add[i + 1] + P.oy, dark, add[i + 2] ? 1 : softA);
}
// en sprite: lokalt origo (0,0) = fotpunkten på golvet, som ligger på canvasens (ax, ay)
function spr(w, h, ax, ay, fn, line = true) {
  const P = new Pix(w, h, -ax, -ay);
  fn(P);
  if (line) outline(P);
  return { img: P.flush(), ax, ay, w, h };
}
const put = (ctx, s, x, y) => ctx.drawImage(s.img, Math.round(x) - s.ax, Math.round(y) - s.ay);
// präglad text: skugga under, ljus överkant
function embossText(P, F, s, x, y, cTop, cMid, cLow, shadow) {
  eachTextPixel(F, s, x, y + 1, 1, (px, py) => P.px(px, py, shadow));
  eachTextPixel(F, s, x, y, 1, (px, py) => { const r = py - y; P.px(px, py, r <= 0 ? cTop : r >= F.h - 2 ? cLow : cMid); });
}
// deterministisk slump (samma kund och samma folk på gatan varje besök)
function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
// pixellinje direkt på ctx (klockans visare)
function ctxLine(ctx, x0, y0, x1, y1) {
  x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let e = dx + dy;
  for (;;) {
    ctx.fillRect(x0, y0, 1, 1);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * e;
    if (e2 >= dy) { e += dy; x0 += sx; }
    if (e2 <= dx) { e += dx; y0 += sy; }
  }
}

// ================= utsikten: gatan utanför =================
const FAC = [0xe6c68a, 0xe0a898, 0xb4c6a4, 0xefe9dc, 0xb46a4c, 0xa6bad2, 0xd6b2c6, 0xdccb98];
const AWN = [[0xc9323a, 0xf4f1ea], [0x2a5a48, 0xefe6d2], [0x3a7bd5, 0xf4f1ea], [0xe8b230, 0x6a4424], [0x8e5bd1, 0xf4f1ea], [0x2aa39a, 0xf4f1ea]];
const SHOPS = ['BAGERI', 'KAFÉ', 'BLOMMOR', 'FRISÖR', 'KIOSK', 'OPTIK', 'PIZZA', 'BÖCKER'];
const FAR_LANE = 74, NEAR_LANE = 81, PED_Y = 97;
const LAMPS_OUT = [104, 360, 520];               // lyktstolpar på trottoaren utanför

function cloud(P, cx, cy, s) {
  const parts = [[0, 0, s, s * 0.42], [-s * 0.62, s * 0.14, s * 0.58, s * 0.3], [s * 0.6, s * 0.12, s * 0.62, s * 0.32], [s * 0.12, -s * 0.28, s * 0.5, s * 0.36]];
  for (let y = Math.floor(cy - s); y <= cy + s; y++) for (let x = Math.floor(cx - s * 1.4); x <= cx + s * 1.4; x++) {
    let inside = false;
    for (const [dx, dy, rx, ry] of parts) if (((x + 0.5 - cx - dx) / rx) ** 2 + ((y + 0.5 - cy - dy) / ry) ** 2 <= 1) { inside = true; break; }
    if (!inside) continue;
    const v = (y - (cy - s * 0.6)) / (s * 0.95);
    P.px(x, y, v < 0.35 ? 0xffffff : v < 0.7 ? (bayer(x, y) < 0.5 ? 0xffffff : 0xe6eef6) : 0xc8d6e6);
  }
}
function facade(P, x0, top, w, i, night) {
  const base = FAC[i % FAC.length], y1 = 64;
  for (let y = top; y < y1; y++) for (let x = x0; x < x0 + w; x++) {
    let c = mul(base, 0.93 + hash(x >> 1, y >> 1, 40 + i) * 0.09);
    if (hash(x, y, 41) > 0.94) c = mul(c, 0.93);
    if (night) c = mix(mul(c, 0.42), 0x1a2040, 0.35);
    P.px(x, y, c);
  }
  const dk = night ? 0.4 : 1;
  // takfot med list, gräns mot grannhuset, våningsband
  P.hl(x0, top, w, mul(base, 0.45 * dk)); P.hl(x0, top + 1, w, mul(mix(base, 0xffffff, 0.45), dk)); P.hl(x0, top + 2, w, mul(base, 0.8 * dk));
  P.darken(x0, top + 3, w, 1, 0.88);
  P.vl(x0, top, y1 - top, mul(base, 0.6 * dk));
  P.hl(x0, 38, w, mul(mix(base, 0xffffff, 0.3), dk)); P.hl(x0, 39, w, mul(base, 0.76 * dk));
  // fönster på övervåningarna
  const cols = Math.max(1, Math.floor((w - 6) / 11)), ox = x0 + Math.floor((w - cols * 11) / 2) + 3;
  for (const wy of [26, 13, 0]) {
    if (wy < top + 4) continue;
    for (let c = 0; c < cols; c++) {
      const wx = ox + c * 11, lit = night && hash(i * 5 + c, wy, 42) > 0.42;
      P.rect(wx - 1, wy - 1, 8, 11, mul(base, 0.7 * dk));
      vgrad(P, wx, wy, 6, 9, lit ? 0xfff0b0 : night ? 0x2a3450 : 0xc4e0f2, lit ? 0xe89a40 : night ? 0x121a2c : 0x4a6c90, 3);
      if (!night) { P.px(wx, wy, 0xffffff); P.px(wx + 1, wy, 0xffffff, 0.6); P.px(wx, wy + 1, 0xffffff, 0.6); }
      if (hash(i, c + wy, 43) > 0.5) { const cc = lit ? 0xffe0a0 : night ? 0x3a4058 : 0xeae0cc; P.vl(wx, wy, 9, cc); P.vl(wx + 5, wy, 9, cc); }
      const fr = night ? 0x8a8a98 : 0xf4f0e6;
      P.vl(wx + 3, wy, 9, fr); P.hl(wx, wy + 3, 6, fr);
      P.hl(wx - 1, wy + 9, 8, night ? 0x6a6a78 : 0xf0ece4); P.hl(wx - 1, wy + 10, 8, mul(base, 0.55 * dk));
      if (!night && hash(i, c + wy, 44) > 0.66) for (let k = 0; k < 6; k++) P.px(wx + k, wy + 8, k % 2 ? 0x3a7a34 : [0xd9433b, 0xf28bb3, 0xf0c020][(c + k) % 3]);
    }
  }
  // bottenvåningen: skyltband, markis, skyltfönster, dörr
  const [a1, a2] = AWN[i % AWN.length], name = SHOPS[i % SHOPS.length];
  P.rect(x0 + 1, 41, w - 1, 6, night ? 0x141220 : 0x2a2430);
  if (textW(SMALL, name) < w - 6) text(P, SMALL, name, x0 + 1 + Math.floor((w - 1 - textW(SMALL, name)) / 2), 42, night ? 0xffe890 : mix(a2 === 0x6a4424 ? a1 : a2, 0xffffff, 0.3));
  for (let y = 47; y < 51; y++) for (let x = x0 + 1; x < x0 + w; x++) {
    const s = Math.floor((x - x0) / 3) & 1 ? a2 : a1;
    let c = y === 47 ? mul(s, 0.7) : y === 50 ? mul(s, 0.82) : s;
    if (night) c = mix(mul(c, 0.45), 0x1a2040, 0.3);
    P.px(x, y, c);
  }
  for (let x = x0 + 1; x < x0 + w; x += 3) P.px(x + 1, 51, night ? 0x2a2438 : mul(a1, 0.8));
  const sw = w - 13;
  vgrad(P, x0 + 3, 52, sw, 11, night ? 0xffe6a8 : 0x5a6a84, night ? 0xe0a050 : 0x222a3a, 3);
  for (let k = 0; k < sw; k += 3) { const pc = [0xd9433b, 0xf0c020, 0xf4f1ea, 0x3a7bd5, 0x46a35a][(k + i) % 5]; P.rect(x0 + 4 + k, 60 - (k % 2), 2, 2 + (k % 2), night ? mix(pc, 0xffe0a0, 0.3) : mul(pc, 0.8)); }
  if (!night) for (let y = 52; y < 63; y++) for (let x = x0 + 3; x < x0 + 3 + sw; x++) if ((x + y) % 13 < 2) P.px(x, y, 0xffffff, 0.25);
  P.box(x0 + 2, 51, sw + 2, 13, night ? 0x2a2438 : mul(base, 0.5));
  const dx = x0 + w - 9;
  P.rect(dx, 52, 6, 12, night ? 0x3a2a20 : 0x5a3a24); P.rect(dx + 1, 53, 4, 5, night ? 0xffd890 : 0x8aa8c0); P.px(dx + 4, 59, GOLD);
  P.hl(x0, 63, w, night ? 0x2a2a34 : 0x6a6260);
}
function streetTree(P, x, night) {
  P.rect(x, 50, 2, 15, night ? 0x2a1e18 : 0x5a3a24); P.vl(x, 50, 15, night ? 0x3a2a20 : 0x7a5030);
  const pal = night ? [0x0c1a18, 0x142a24, 0x1e3a30, 0x284838] : [0x1c4422, 0x28602c, 0x3a7e38, 0x5a9e46, 0x8cc462];
  for (let y = 34; y < 56; y++) for (let xx = x - 10; xx < x + 12; xx++) {
    const e = ((xx + 0.5 - x - 1) / 10) ** 2 + ((y + 0.5 - 45) / 10) ** 2;
    if (e > 1 || (e > 0.8 && hash(xx, y, 45) > 0.5)) continue;
    const lv = 1 - Math.hypot((xx - x + 4) / 12, (y - 39) / 12) + (hash(xx >> 1, y >> 1, 46) - 0.5) * 0.3;
    P.px(xx, y, tone(pal, lv, xx, y));
  }
}
function lampPost(P, x, night) {
  P.vl(x, 38, 26, 0x26322e); P.vl(x + 1, 38, 26, 0x3a4844); P.rect(x - 1, 62, 4, 2, 0x26322e);
  P.rect(x - 2, 35, 6, 3, 0x26322e); P.hl(x - 1, 38, 4, night ? 0xfff0b0 : 0x8a9aa0);
  if (night) P.ell(x + 0.5, 42, 8, 10, 0xffe8a0, 0.35, 4);
}
function paintOutside(night) {
  const P = new Pix(W, WALL_Y);
  // himmel med moln (dag) eller stjärnor och måne (natt)
  for (let y = 0; y < 64; y++) for (let x = 0; x < W; x++) {
    let c = night ? mix(0x0a0f2a, 0x2c3258, q(y / 63, x, y, 5)) : mix(0x5aa0de, 0xd6ecf8, q(y / 63, x, y, 5));
    if (night && hash(x, y, 91) > 0.993) c = hash(x, y, 92) > 0.5 ? 0xfff6d8 : 0x9ab0e0;
    P.px(x, y, c);
  }
  if (!night) for (let i = 0; i < 10; i++) cloud(P, 10 + i * 62 + hash(i, 1, 93) * 30, 22 + hash(i, 2, 93) * 12, 6 + hash(i, 3, 93) * 6);
  else { disc(P, 118, 28, 4.5, 4.5, 0xfff4d0); P.px(116, 27, 0xe6dcb8); P.px(119, 29, 0xe6dcb8); P.px(117, 30, 0xe6dcb8); P.ell(118, 28, 12, 12, 0xfff0c0, 0.18, 4); }
  // husen på andra sidan gatan
  let x = -6;
  for (let i = 0; x < W; i++) {
    const bw = 46 + Math.floor(hash(i, 1, 94) * 40), top = 4 + Math.floor(hash(i, 2, 94) * 30);
    facade(P, x, top, bw, i, night);
    x += bw;
  }
  // gatuträd och lyktor på bortre trottoaren
  for (let i = 0; i < 8; i++) { const tx = 22 + i * 78 + Math.floor(hash(i, 5, 95) * 18); if (i % 2) lampPost(P, tx, night); else streetTree(P, tx, night); }
  // bortre trottoaren, gatan, närmaste trottoaren
  for (let y = 64; y < WALL_Y; y++) for (let x = 0; x < W; x++) {
    let c;
    if (y < 67) c = (x % 9 === 0) ? 0x8e8a84 : mix(0xb4b0a8, 0xa8a49c, hash(x >> 1, y, 96));
    else if (y === 67) c = 0xd8d4cc;
    else if (y < 82) {
      c = mix(0x4c4e56, 0x40424a, hash(x, y, 97) * 0.8);
      if (hash(x, y, 98) > 0.96) c = 0x5a5c64;
      if (y === 68) c = 0x2e3036;
      if (y === 75 && (x % 14) < 7) c = 0xe8e4d8;
    } else if (y < 84) c = y === 82 ? 0xdcd8d0 : 0x9a968e;
    else {
      const off = ((y - 84) >> 2 & 1) * 6, sy = (y - 84) % 4;
      c = mix(0xbcb8b0, 0xaaa69e, hash(Math.floor((x + off) / 12), y >> 2, 99));
      if (sy === 3 || (x + off) % 12 === 0) c = 0x8e8a82;
    }
    if (night) c = mix(mul(c, 0.45), 0x141a34, 0.3);
    P.px(x, y, c);
  }
  // gatlyktornas ljus på trottoaren utanför (kväll)
  if (night) for (const lx of LAMPS_OUT) P.ell(lx, 92, 30, 7, 0xffe0a0, 0.3, 4);
  return P.flush();
}
// saker på närmaste trottoaren som bilarna åker bakom (lyktstolpar, en cykel)
function paintNear(night) {
  const P = new Pix(W, WALL_Y);
  for (const lx of LAMPS_OUT) {
    P.vl(lx, 0, 98, night ? 0x1a2220 : 0x26322e); P.vl(lx + 1, 0, 98, night ? 0x2a3632 : 0x4a5a54); P.vl(lx + 2, 0, 98, night ? 0x141a18 : 0x1e2826);
    P.rect(lx - 1, 90, 5, 8, night ? 0x1a2220 : 0x26322e); P.hl(lx - 1, 90, 5, night ? 0x3a4642 : 0x5a6a64);
    P.rect(lx - 1, 60, 5, 2, night ? 0x2a3632 : 0x3a4844);
  }
  // röd cykel parkerad utanför dörren
  const bx = 150;
  const wheel = (cx) => { for (let a = 0; a < 24; a++) { const t = a / 24 * Math.PI * 2; P.px(Math.round(cx + Math.cos(t) * 5), Math.round(90 + Math.sin(t) * 5), night ? 0x1a1a20 : 0x222228); } P.px(cx, 90, 0x9a9aa0); };
  wheel(bx); wheel(bx + 15);
  const fr = night ? 0x6a2420 : 0xc9323a;
  P.line(bx, 90, bx + 6, 84, fr); P.line(bx + 6, 84, bx + 14, 84, fr); P.line(bx + 14, 84, bx + 15, 90, fr); P.line(bx + 6, 84, bx + 8, 90, fr); P.line(bx + 8, 90, bx, 90, fr);
  P.line(bx + 5, 84, bx + 4, 81, fr); P.hl(bx + 2, 80, 4, 0x2a2228); P.line(bx + 14, 84, bx + 13, 80, fr); P.hl(bx + 12, 79, 3, 0x2a2228);
  return P.flush();
}
// bilar från sidan (30×13), åt höger; flip = åt vänster
function paintCar(col, kind, flip) {
  const w = 30, h = 13;
  const P = new Pix(w, h);
  const R = [mix(mul(col, 0.45), 0x1a1026, 0.25), mul(col, 0.72), col, mix(col, 0xffffff, 0.3), mix(col, 0xffffff, 0.65)];
  const px = (x, y, c) => P.px(flip ? w - 1 - x : x, y, c);
  const van = kind === 'van';
  // kaross
  for (let y = 5; y <= 10; y++) for (let x = 1; x <= 28; x++) {
    if ((x === 1 || x === 28) && (y === 5 || y === 10)) continue;
    let c = y === 5 ? R[3] : y >= 9 ? R[1] : R[2];
    if (y === 7) c = mix(R[2], 0xffffff, 0.08);
    px(x, y, c);
  }
  // hytt och rutor
  const top = van ? 0 : 1;
  for (let y = top; y <= 4; y++) {
    const a = van ? 3 : 9 - (y - 1), b = van ? 21 : 20 + (y - 1);
    for (let x = a; x <= b; x++) px(x, y, y === top ? R[3] : R[2]);
  }
  for (let y = top + 1; y <= 4; y++) {
    const a = van ? 5 : 11 - (y - 1), b = van ? 20 : 18 + (y - 1);
    for (let x = a; x <= b; x++) {
      if (x === (van ? 13 : 15)) continue;
      px(x, y, y === top + 1 ? 0x9ab8d0 : 0x2a3a50);
    }
  }
  // dörrlinjer, handtag, lister, lampor
  px(15, 6, R[1]); px(15, 7, R[1]); px(15, 8, R[1]); px(12, 7, R[4]); px(19, 7, R[4]);
  for (let x = 2; x < 28; x++) px(x, 9, R[1]);
  px(28, 6, 0xfff4c0); px(27, 6, 0xfff4c0); px(1, 6, 0xd8323a); px(1, 7, 0x9a1a20);
  if (kind === 'taxi') { px(14, 0, 0xf0c020); px(15, 0, 0xf0c020); px(16, 0, 0xf0c020); }
  // hjul
  for (const cx of [7, 22]) {
    for (let y = 8; y <= 12; y++) for (let x = cx - 2; x <= cx + 2; x++) if ((x - cx) ** 2 + (y - 10) ** 2 <= 5) px(x, y, 0x18181c);
    px(cx, 10, 0xb8bcc4); px(cx - 1, 10, 0x6a6e76); px(cx, 9, 0x8a8e96);
  }
  outline(P);
  return P.flush();
}
const CAR_KINDS = [[0xc9323a, 'car'], [0x3a7bd5, 'car'], [0xf0ece0, 'car'], [0xf0c020, 'taxi'], [0x46a35a, 'car'], [0x5a6068, 'van'], [0x2d3a5c, 'car']];

// ================= planschernas bilder (ca 51×32) =================
function picVilla(P, x, y, w, h) {
  vgrad(P, x, y, w, 20, 0x5aa8ea, 0xd4eefa, 5);
  disc(P, x + w - 10, y + 6, 3.5, 3.5, 0xfff6c0); P.ell(x + w - 10, y + 6, 8, 8, 0xfff8d0, 0.3, 3);
  cloud(P, x + 12, y + 6, 4); cloud(P, x + 28, y + 3, 3);
  // skogsbryn i fjärran
  for (let i = 0; i < w; i++) {
    const t = 3 + Math.floor(hash(x + i, 1, 51) * 3) + (Math.sin(i * 0.8) > 0.2 ? 1 : 0);
    for (let j = 0; j < t; j++) P.px(x + i, y + 19 - j, j === t - 1 ? 0x4a7a4a : j === t - 2 ? 0x3a6a42 : 0x2e5a3a);
  }
  // gräsmatta med klipprandar
  for (let j = 19; j < h; j++) for (let i = 0; i < w; i++) {
    const band = Math.floor((i + (j - 19) * 0.6) / 5) & 1;
    P.px(x + i, y + j, mix(band ? 0x66ac50 : 0x56983f, 0x2e6a2a, (j - 19) / 26));
  }
  // grusgången
  for (let j = 23; j < h; j++) { const sp = Math.floor((j - 23) * 0.35); for (let i = -1 - sp; i <= 1 + sp; i++) P.px(x + 29 + i, y + j, hash(i, j, 52) > 0.5 ? 0xe0d0a8 : 0xd0bc90); }
  // huset: falurött med vita knutar, sadeltak, skorsten
  const hx = x + 14, hy = y + 11, hw = 26, hh = 12;
  for (let j = 0; j < hh; j++) for (let i = 0; i < hw; i++) {
    let c = i % 3 === 2 ? 0x8e2a22 : 0xb23c2e;
    if (j === 0) c = 0x6a1c16;
    if (i > hw - 7) c = mul(c, 0.86);
    P.px(hx + i, hy + j, c);
  }
  P.vl(hx, hy, hh, 0xf6f2ea); P.vl(hx + 1, hy, hh, 0xe0d8cc); P.vl(hx + hw - 1, hy, hh, 0xd0c8bc);
  for (let j = 0; j < 7; j++) {
    const inset = 6 - j;
    for (let i = -2 + inset; i < hw + 2 - inset; i++) {
      let c = (j % 2) ? 0x3a3c48 : 0x4c4e5c;
      if ((i + j) % 4 === 0) c = mul(c, 0.85);
      if (j === 0) c = 0x6a6c7a;
      P.px(hx + i, hy - 7 + j, c);
    }
  }
  P.hl(hx - 2, hy - 1, hw + 4, 0xf6f2ea); P.hl(hx - 1, hy, hw + 2, 0x3a2a26);
  P.rect(hx + 18, hy - 11, 3, 6, 0x9a3a2a); P.hl(hx + 17, hy - 11, 5, 0x4a2a24); P.vl(hx + 20, hy - 10, 5, 0x6a2a20);
  P.px(hx + 19, hy - 13, 0xe8eef4); P.px(hx + 20, hy - 14, 0xdce4ec); P.px(hx + 21, hy - 14, 0xe8eef4); P.px(hx + 22, hy - 15, 0xd0dae4);
  // takkupa med fönster
  P.rect(hx + 5, hy - 5, 5, 4, 0xb23c2e); P.hl(hx + 4, hy - 6, 7, 0x3a3c48); P.px(hx + 7, hy - 7, 0x3a3c48);
  P.rect(hx + 6, hy - 4, 3, 2, 0x8ec4e8); P.px(hx + 6, hy - 4, 0xffffff);
  // fönster med vita karmar och spröjs
  for (const wx of [hx + 3, hx + 8, hx + 19]) {
    P.rect(wx - 1, hy + 3, 5, 6, 0xf6f2ea);
    vgrad(P, wx, hy + 4, 3, 4, 0xcfeafa, 0x4a7ab0, 2);
    P.hl(wx, hy + 5, 3, 0xf6f2ea); P.px(wx + 1, hy + 4, 0xf6f2ea);
    P.px(wx, hy + 4, 0xffffff);
    P.hl(wx - 1, hy + 9, 5, 0xe8e0d4);
  }
  // förstukvist med trappa
  P.rect(hx + 12, hy + 4, 5, 8, 0x2a5a48); P.box(hx + 11, hy + 3, 7, 9, 0xf6f2ea); P.px(hx + 15, hy + 8, GOLD);
  P.hl(hx + 10, hy + 2, 9, 0xf6f2ea); P.hl(hx + 11, hy + 1, 7, 0x3a3c48);
  P.hl(hx + 10, hy + 12, 9, 0xb8b0a4); P.hl(hx + 9, hy + 13, 11, 0x9a9288);
  // blomrabatter under fönstren
  for (let i = 1; i < hw - 1; i++) if (i < 10 || i > 18) { P.px(hx + i, hy + 12, i % 2 ? 0x2e6a2a : [0xd9433b, 0xf28bb3, 0xf0c020, 0xffffff][i % 4]); P.px(hx + i, hy + 13, 0x2e5a26); }
  // äppelträd
  P.rect(x + 6, y + 17, 2, 9, 0x6a4424); P.px(x + 5, y + 20, 0x6a4424); P.px(x + 8, y + 19, 0x6a4424);
  for (let yy = y + 6; yy < y + 20; yy++) for (let xx = x; xx < x + 14; xx++) {
    const e = ((xx + 0.5 - x - 7) / 7) ** 2 + ((yy + 0.5 - y - 12.5) / 6.5) ** 2;
    if (e > 1 || (e > 0.78 && hash(xx, yy, 53) > 0.55)) continue;
    const lv = 1 - Math.hypot((xx - x - 4) / 10, (yy - y - 9) / 8) + (hash(xx, yy, 54) - 0.5) * 0.3;
    P.px(xx, yy, tone(LEAF, lv * 0.9 + 0.1, xx, yy));
  }
  for (const [ax, ay] of [[3, 10], [8, 9], [10, 13], [5, 15], [11, 17], [2, 14], [7, 12]]) P.px(x + ax, y + ay, 0xe0302a);
  // flaggstång med svensk flagga
  const fx = x + w - 3;
  P.vl(fx, y + 3, 24, 0xf6f2ea); P.vl(fx + 1, y + 5, 22, 0xb8b0a4); P.px(fx, y + 2, GOLD);
  for (let j = 0; j < 5; j++) for (let i = 0; i < 7; i++) P.px(fx - 1 - i, y + 4 + j + (i > 4 ? 1 : 0), (i === 2 || j === 2) ? 0xf0c820 : 0x2a5ab0);
  // vitt spjälstaket med grind
  for (let i = 0; i < w; i++) {
    if (i >= 26 && i <= 32) continue;
    if (i % 2 === 0) { P.vl(x + i, y + h - 5, 4, 0xf6f2ea); P.px(x + i, y + h - 6, 0xffffff); } else P.px(x + i, y + h - 4, 0xe0d8cc);
    P.px(x + i, y + h - 1, 0x3a6a2a);
  }
}
function picLagenhet(P, x, y, w, h) {
  // kvällshimmel över Pixelstaden
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const t = j / (h - 8);
    const c = t < 0.45 ? mix(0x5a4a9a, 0xe0708a, q(t / 0.45, x + i, y + j, 4)) : mix(0xe0708a, 0xfad08a, q(Math.min(1, (t - 0.45) / 0.55), x + i, y + j, 4));
    P.px(x + i, y + j, c);
  }
  disc(P, x + 8, y + 19, 4, 4, 0xfff0b0); P.ell(x + 8, y + 19, 9, 7, 0xffe0a0, 0.35, 3);
  for (const [cx, cy, l] of [[x + 30, y + 5, 10], [x + 6, y + 9, 7], [x + 44, y + 11, 6]]) { P.hl(cx - (l >> 1), cy, l, 0xf8b0b0); P.hl(cx - (l >> 1) + 2, cy - 1, l - 4, 0xfcd0c0); }
  // stadssiluett i fjärran
  for (let i = 0; i < w; i++) {
    const tall = 8 + Math.floor(hash(Math.floor(i / 5), 3, 55) * 12) + (Math.floor(i / 5) === 7 ? 6 : 0);
    for (let j = 0; j < tall; j++) {
      const yy = y + h - 7 - j;
      P.px(x + i, yy, j === tall - 1 ? 0xa890c0 : 0x8a72a8);
      if (j > 1 && j < tall - 2 && i % 5 === 2 && j % 3 === 0 && hash(i, j, 56) > 0.45) P.px(x + i, yy, 0xffe8a0);
    }
  }
  // huset: sex våningar, balkonger med glasräcken, takterrass
  const bx = x + 14, bw = 24, by = y + 3, bh = h - 8;
  for (let j = 0; j < bh; j++) for (let i = 0; i < bw + 4; i++) {
    let c = i >= bw ? mix(0xb8a898, 0x8a7a88, 0.3) : mix(0xf0e4d0, 0xe0d0bc, hash(i >> 1, j >> 1, 57) * 0.4);
    if (i < bw && i > bw - 5) c = mix(c, 0xf0a080, 0.18); // solnedgången lyser på hörnet
    P.px(bx + i, by + j, c);
  }
  P.hl(bx, by, bw + 4, 0x6a5a68); P.hl(bx, by + 1, bw + 4, 0xfff4e4);
  for (let i = 0; i < bw; i += 2) P.px(bx + i, by - 1, 0xd8e8f0);
  P.px(bx + 3, by - 2, 0x3a7e38); P.px(bx + 4, by - 2, 0x5a9e46); P.px(bx + 4, by - 3, 0x3a7e38); P.px(bx + 18, by - 2, 0x3a7e38); P.px(bx + 19, by - 3, 0x5a9e46);
  for (let f = 0; f < 6; f++) {
    const fy = by + 3 + f * 4;
    for (let c = 0; c < 4; c++) {
      const wx = bx + 2 + c * 6;
      const lit = hash(f, c, 58) > 0.55;
      P.rect(wx, fy, 3, 3, lit ? 0xffe0a0 : 0x3a4a6a); P.px(wx, fy, lit ? 0xfff4c8 : 0xf0a0a0);
      if (c % 2 === 1) { // balkong med glasräcke
        P.hl(wx - 1, fy + 3, 6, 0xf6f2ea); P.hl(wx - 1, fy + 2, 6, 0xa8d4e0); P.px(wx - 1, fy + 2, 0xf6f2ea); P.px(wx + 4, fy + 2, 0xf6f2ea);
        if (hash(f, c, 59) > 0.5) P.px(wx + 3, fy + 1, [0xd9433b, 0xf28bb3, 0xf0c020][f % 3]);
      }
    }
  }
  // ljusslinga på översta balkongen
  for (let i = 0; i < 6; i++) P.px(bx + 7 + i, by + 5, i % 2 ? 0xfff0a0 : 0xffa0c0);
  // entré
  P.rect(bx + 9, by + bh - 5, 6, 5, 0x2a2a34); P.rect(bx + 10, by + bh - 4, 4, 4, 0xffe0a0); P.hl(bx + 8, by + bh - 6, 8, NAVY);
  // träd, gräs, trottoar, parkerad bil
  for (const tx of [x + 4, x + w - 7]) {
    P.rect(tx + 1, y + h - 9, 1, 5, 0x5a3a24);
    for (let yy = y + h - 17; yy < y + h - 7; yy++) for (let xx = tx - 3; xx < tx + 6; xx++) {
      const e = ((xx + 0.5 - tx - 1.5) / 4.5) ** 2 + ((yy + 0.5 - (y + h - 12)) / 5) ** 2;
      if (e <= 1) P.px(xx, yy, tone([0x1a3a22, 0x2a5a2e, 0x3e7a38, 0x6a9a48], 1 - Math.hypot((xx - tx) / 6, (yy - (y + h - 15)) / 6), xx, yy));
    }
  }
  for (let i = 0; i < w; i++) { P.px(x + i, y + h - 5, 0x4a8a3a); P.px(x + i, y + h - 4, 0x3a7a32); P.px(x + i, y + h - 3, 0xb8b0a8); P.px(x + i, y + h - 2, 0x9a948c); P.px(x + i, y + h - 1, 0x5a5a62); }
  P.rect(x + 40, y + h - 5, 8, 2, 0x3a7bd5); P.hl(x + 42, y + h - 6, 4, 0x3a7bd5); P.px(x + 43, y + h - 6, 0xb8d8f0); P.px(x + 41, y + h - 3, 0x18181c); P.px(x + 46, y + h - 3, 0x18181c);
}
function picRum(P, x, y, w, h) {
  // blommig tapet
  for (let j = 0; j < 23; j++) for (let i = 0; i < w; i++) {
    let c = mix(0xf2dca0, 0xe8cc88, q(j / 22, x + i, y + j, 3));
    const u = (i + (Math.floor(j / 5) & 1) * 3) % 6, v = j % 5;
    if (u === 1 && v === 2) c = 0xe07a8a; else if ((u === 0 || u === 2) && v === 2) c = 0xf0a8b0; else if (u === 1 && v === 3) c = 0x7aa05a;
    P.px(x + i, y + j, c);
  }
  // golvlist och trägolv
  P.hl(x, y + 22, w, 0xf6f2ea); P.hl(x, y + 23, w, 0xb8ac98);
  for (let j = 24; j < h; j++) for (let i = 0; i < w; i++) {
    const row = j - 24, off = (row & 1) * 7;
    let c = mul(0xb07a48, 0.92 + hash(Math.floor((i + off) / 14), row, 60) * 0.14);
    if ((i + off) % 14 === 0) c = 0x7a4a28;
    P.px(x + i, y + j, c);
  }
  // fönster med rutiga gardiner och kvällshimmel
  const fx = x + 28, fy = y + 3;
  vgrad(P, fx, fy, 12, 10, 0x3a4a8a, 0xf0a878, 3);
  P.px(fx + 8, fy + 2, 0xfff4d0); P.px(fx + 3, fy + 1, 0xffffff); P.px(fx + 10, fy + 4, 0xffffff);
  P.box(fx - 1, fy - 1, 14, 12, 0xf6f2ea); P.vl(fx + 6, fy, 10, 0xf6f2ea); P.hl(fx, fy + 4, 12, 0xf6f2ea);
  for (let j = -1; j < 11; j++) for (const cx of [fx - 2, fx + 11]) for (let k = 0; k < 3; k++) {
    if (j > 6 && k === (cx < fx ? 2 : 0)) continue;
    P.px(cx + k, fy + j, ((j + k) & 1) ? 0xd9433b : 0xf6f2ea);
  }
  P.hl(fx - 3, fy - 2, 18, 0x8a5a36); P.hl(fx - 2, fy + 11, 16, 0xe0d8cc);
  // garderob med en kartong ovanpå
  const gx = x + 2;
  P.rect(gx, y + 4, 11, 24, 0x9a6438); P.vl(gx + 5, y + 5, 22, 0x6a4020); P.hl(gx, y + 4, 11, 0xc0885a); P.vl(gx, y + 4, 24, 0xb07a4a); P.vl(gx + 10, y + 4, 24, 0x6a4020);
  P.px(gx + 4, y + 15, GOLD); P.px(gx + 6, y + 15, GOLD); P.hl(gx, y + 27, 11, 0x4a2a14);
  P.rect(gx + 2, y + 6, 2, 3, 0xe8d8b0); P.rect(gx + 7, y + 19, 2, 2, 0xe8d8b0);
  P.rect(gx + 2, y + 1, 7, 3, 0xd8c098); P.hl(gx + 2, y + 1, 7, 0xe8d4b0);
  // litet kylskåp med magneter och en radio ovanpå
  const kx = x + 15;
  P.rect(kx, y + 12, 9, 16, 0xf4f4f0); P.vl(kx + 8, y + 12, 16, 0xc8c8c4); P.hl(kx, y + 12, 9, 0xffffff); P.hl(kx, y + 17, 9, 0xb8b8b4);
  P.vl(kx + 1, y + 14, 2, 0x8a8a90); P.vl(kx + 1, y + 19, 3, 0x8a8a90);
  P.px(kx + 4, y + 20, 0xd9433b); P.px(kx + 6, y + 22, 0x3a7bd5); P.px(kx + 5, y + 14, 0xf0c020);
  P.rect(kx + 2, y + 9, 4, 3, 0x3a3a44); P.px(kx + 3, y + 10, 0x6fe08a);
  // säng med lapptäcke
  const sx = x + 27;
  P.rect(sx, y + 14, 3, 13, 0x8a5a36); P.hl(sx, y + 14, 3, 0xb07a4a);
  P.rect(sx + 3, y + 19, 22, 3, 0xf6f2ea);
  for (let j = 20; j < 26; j++) for (let i = 8; i < 25; i++) P.px(sx + i, y + j, ((Math.floor(i / 3) + Math.floor(j / 2)) & 1) ? 0xd9433b : 0xf4d0c0);
  P.hl(sx + 8, y + 19, 17, 0xff8a80);
  P.rect(sx + 3, y + 17, 6, 3, 0xffffff); P.hl(sx + 3, y + 19, 6, 0xd8d4cc);
  P.hl(sx + 3, y + 26, 22, 0x6a4020); P.vl(sx + 24, y + 26, 2, 0x5a3a20); P.vl(sx + 4, y + 26, 2, 0x5a3a20);
  // matta, glödlampa, affisch
  for (let i = 0; i < 16; i++) { P.px(x + 10 + i, y + 29, i % 3 ? 0x3a7bd5 : 0xf0c020); P.px(x + 11 + i, y + 30, i % 2 ? 0x2d5aa8 : 0x3a7bd5); }
  P.vl(x + 24, y, 5, 0x3a3440); P.rect(x + 23, y + 5, 3, 3, 0xfff4c0); P.px(x + 24, y + 5, 0xffffff); P.ell(x + 24.5, y + 7, 5, 4, 0xfff4c0, 0.4, 3);
  P.rect(x + 44, y + 3, 6, 8, 0x3a7bd5); P.box(x + 44, y + 3, 6, 8, 0xf6f2ea); P.px(x + 46, y + 5, 0xf0c020); P.rect(x + 45, y + 8, 4, 2, 0x46a35a);
}
function picGeneric(P, x, y, w, h, seed) {
  vgrad(P, x, y, w, 20, 0x6ab0ea, 0xd0ecfa, 4);
  for (let j = 20; j < h; j++) for (let i = 0; i < w; i++) P.px(x + i, y + j, mix(0x5aa04a, 0x2e6a2a, (j - 20) / 14));
  const c = FAC[seed % FAC.length], hx = x + 14, hy = y + 12;
  P.rect(hx, hy, 24, 13, c); for (let j = 0; j < 7; j++) P.hl(hx - 2 + j, hy - 1 - j, 28 - j * 2, 0x4a4c5a);
  P.rect(hx + 10, hy + 5, 4, 8, 0x5a3a24);
  for (const wx of [hx + 3, hx + 17]) { P.rect(wx, hy + 3, 4, 4, 0x8ec4e8); P.box(wx - 1, hy + 2, 6, 6, 0xf6f2ea); }
}
const PICS = { rum: picRum, lagenhet: picLagenhet, villa: picVilla };

// ================= rummet (väggar, golv, allt på väggen) =================
function parquet(x, y) {
  // fiskbensparkett: 10 px breda kolumner där brädorna lutar åt varannat håll
  const CW = 10, yy = y - WALL_Y;
  const c = Math.floor(x / CW), lx = x - c * CW;
  const d = Math.floor(yy + ((c & 1) ? lx : CW - 1 - lx) * 0.5);
  const p = Math.floor(d / 4), r = d - p * 4;
  let k = mix(0xcc9c62, 0xb07c48, hash(c, p, 7));
  k = mul(k, 0.95 + hash(c, p, 8) * 0.1);
  if (hash(c, p, 9) > 0.86) k = mix(k, 0x9a643a, 0.35);
  if ((r === 1 || r === 2) && hash(c * 7 + (lx >> 2), p * 4 + r, 12) > 0.7) k = mul(k, 0.93);
  if (r === 3) k = mix(k, 0x5a3a20, 0.5);
  else if (r === 0) k = mix(k, 0xf6dcae, 0.2);
  if (lx === 0) k = mix(k, 0x5a3a20, 0.4);
  return k;
}
function wainscot(P, x0, x1) {
  const w = x1 - x0;
  if (w <= 0) return;
  for (let y = 83; y < 95; y++) for (let x = x0; x < x1; x++) P.px(x, y, mix(0xf4efe4, 0xe8e0d0, (bayer(x, y) - 0.5) * 0.3 + 0.2));
  P.hl(x0, 80, w, 0xfdfaf2); P.hl(x0, 81, w, 0xe4dccb); P.hl(x0, 82, w, 0xb4aa98);
  for (let px = x0 + 3; px + 14 <= x1 - 2; px += 20) {
    const pw = Math.min(16, x1 - 3 - px);
    P.bevel(px, 85, pw, 8, 0xfffdf8, 0xc8bea8); P.box(px + 2, 87, pw - 4, 4, 0xece4d6); P.hl(px + 2, 87, pw - 4, 0xd8cfbc);
  }
  P.hl(x0, 95, w, 0xfdfaf2); P.rect(x0, 96, w, 3, 0xece6da); P.hl(x0, 98, w, 0xd4ccbc); P.hl(x0, 99, w, 0x8a8070);
}
// glasruta: genomskinlig (gatan ritas under rummet) med svag ton och reflexstrimmor
function glass(P, x, y, w, h, night, seed = 0) {
  P.erase(x, y, w, h);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const d = (i + j + seed * 7 + 400) % 23;
    P.px(x + i, y + j, night ? 0x2a3050 : 0xd8eefa, night ? 0.12 : 0.1);
    if (d < 2) P.px(x + i, y + j, 0xffffff, night ? 0.08 : 0.26);
    else if (d === 3) P.px(x + i, y + j, 0xffffff, night ? 0.04 : 0.12);
  }
}
function drape(P, x, y0, w, y1, inner) {
  // tung sammetsgardin i mörkgrönt, veckad, uppknuten med guldsnodd
  const C = [0x10261e, 0x1a3a2e, 0x28503e, 0x386a52, 0x528a6c];
  const tie = y0 + Math.round((y1 - y0) * 0.55);
  for (let y = y0; y < y1; y++) {
    const pinch = y < tie ? Math.round(((y - y0) / (tie - y0)) ** 2 * (w * 0.45)) : Math.round(Math.max(0, 1 - (y - tie) / 10) * w * 0.45);
    for (let i = 0; i < w; i++) {
      const fromInner = inner === 'right' ? w - 1 - i : i;
      if (fromInner < pinch) continue;
      const fold = (i + (y > tie ? 1 : 0)) % 4;
      let v = [0.55, 0.8, 0.6, 0.3][fold] - (y - y0) / (y1 - y0) * 0.15;
      if (fromInner === pinch) v -= 0.25;
      P.px(x + i, y, tone(C, v, x + i, y));
    }
  }
  for (let i = 0; i < w; i++) P.px(x + i, y0, i % 2 ? C[1] : C[3]);
  const tx = inner === 'right' ? x + Math.round(w * 0.3) : x + Math.round(w * 0.7) - 1;
  P.hl(tx - 2, tie, 5, GOLD); P.hl(tx - 2, tie + 1, 5, GOLD_LO); P.px(tx, tie + 2, GOLD); P.vl(tx, tie + 3, 3, GOLD_HI); P.px(tx - 1, tie + 5, GOLD_LO); P.px(tx + 1, tie + 5, GOLD_LO);
}
function architrave(P, x, y, w, h) {
  // vitt profilerat foder runt fönster/dörr med smyg (nisch) innanför
  P.rect(x - 5, y - 5, w + 10, h + 5, 0xfaf6ee);
  P.hl(x - 5, y - 5, w + 10, 0xffffff); P.vl(x - 5, y - 4, h + 4, 0xfdfaf4); P.vl(x + w + 4, y - 4, h + 4, 0xc8bea8);
  P.box(x - 3, y - 3, w + 6, h + 3, 0xe0d6c4);
  P.rect(x - 2, y - 2, w + 4, 2, 0xc4b8a2); P.vl(x - 2, y, h, 0xd8ccb8); P.vl(x + w + 1, y, h, 0xe8dece);
}
function bigWindow(P, night) {
  const { x, y, w, h } = WIN1;
  architrave(P, x, y, w, h);
  glass(P, x, y, w, h, night, 1);
  // karm: tre lufter och överljus
  const fr = WHITE, lo = 0xc8c0b0;
  P.rect(x, y, w, 2, fr); P.rect(x, y + h - 2, w, 2, fr); P.rect(x, y, 2, h, fr); P.rect(x + w - 2, y, 2, h, fr);
  P.hl(x + 2, y + 2, w - 4, lo); P.vl(x + 2, y + 2, h - 4, lo);
  const t = y + 14;
  P.rect(x, t, w, 2, fr); P.hl(x + 2, t + 2, w - 4, lo);
  for (const mx of [x + Math.round(w / 3), x + Math.round(w * 2 / 3)]) { P.rect(mx - 1, y, 2, h, fr); P.vl(mx + 1, t + 2, h - (t - y) - 4, lo); P.px(mx - 2, t + 18, GOLD); P.px(mx - 2, t + 19, GOLD_LO); }
  // fönsterbänk i marmor med orkidé och ljusstake
  for (let yy = y + h; yy < y + h + 3; yy++) for (let xx = x - 6; xx < x + w + 6; xx++) {
    let c = yy === y + h ? 0xfbf9f5 : mix(0xeeeae4, 0xdcd8d0, hash(xx >> 1, yy, 31));
    if (Math.abs(((xx * 0.6 + yy * 2 + 400) % 13) - 6.5) < 0.5) c = mix(c, 0xa09aa0, 0.35);
    P.px(xx, yy, c);
  }
  P.hl(x - 6, y + h + 3, w + 12, 0x9a948a); P.darken(x - 5, y + h + 4, w + 10, 2, 0.8);
  const ox = x + 10, oy = y + h;
  P.rect(ox - 2, oy - 4, 5, 4, 0xf6f4f0); P.vl(ox + 2, oy - 4, 4, 0xc8c4bc); P.hl(ox - 2, oy - 4, 5, 0xffffff);
  P.vl(ox, oy - 12, 8, 0x3a6a32); P.px(ox + 1, oy - 12, 0x3a6a32); P.px(ox + 2, oy - 11, 0x3a6a32);
  for (const [dx, dy] of [[2, -13], [3, -11], [1, -10], [4, -12]]) { P.px(ox + dx, oy + dy, 0xf0b8e0); P.px(ox + dx + 1, oy + dy, 0xd87ab8); }
  P.px(ox - 2, oy - 5, 0x4a8a3a); P.px(ox - 3, oy - 5, 0x3a7a32); P.px(ox + 3, oy - 5, 0x4a8a3a);
  const lx = x + w - 12;
  P.hl(lx - 2, oy - 1, 5, GOLD_LO); P.vl(lx, oy - 6, 5, GOLD); P.hl(lx - 1, oy - 6, 3, GOLD_HI);
  P.vl(lx, oy - 10, 4, 0xf6f2ea); P.px(lx, oy - 11, 0xffd060);
  // gardinstång och tunga gardiner
  P.hl(x - 14, y - 9, w + 28, GOLD); P.hl(x - 14, y - 8, w + 28, GOLD_LO);
  for (const fx of [x - 15, x + w + 14]) { P.rect(fx - 1, y - 11, 3, 4, GOLD); P.px(fx - 1, y - 11, GOLD_HI); P.px(fx + 1, y - 8, GOLD_LO); }
  for (let i = x - 12; i < x + w + 12; i += 3) P.px(i, y - 7, GOLD_LO);
  drape(P, x - 13, y - 7, 12, WALL_Y - 2, 'right');
  drape(P, x + w + 1, y - 7, 12, WALL_Y - 2, 'left');
}
function blindsWindow(P, night) {
  const { x, y, w, h } = WIN2;
  architrave(P, x, y, w, h);
  glass(P, x, y, w, h, night, 3);
  // persienner nerdragna halvvägs: lameller med glipor där gatan skymtar
  const by = y + 20;
  for (let j = y + 2; j < by; j++) {
    const r = (j - y) % 3;
    if (r === 2) continue;
    for (let i = 2; i < w - 2; i++) P.px(x + i, j, r === 0 ? mix(0xf6f2ea, 0xe8e2d6, (i % 7) / 14) : 0xcac2b2);
  }
  P.hl(x + 2, by, w - 4, 0xeee8dc); P.hl(x + 2, by + 1, w - 4, 0xa89e8c);
  P.vl(x + 6, y + 2, by - y, 0xe0dacc, 0.8); P.vl(x + w - 7, y + 2, by - y, 0xe0dacc, 0.8);
  P.vl(x + w - 5, by + 2, 14, 0xe6e0d2); P.rect(x + w - 6, by + 16, 3, 3, 0xd8d0c0); P.px(x + w - 5, by + 19, 0xb8b0a0);
  const fr = WHITE, lo = 0xc8c0b0;
  P.rect(x, y, w, 2, fr); P.rect(x, y + h - 2, w, 2, fr); P.rect(x, y, 2, h, fr); P.rect(x + w - 2, y, 2, h, fr);
  const mx = x + (w >> 1);
  P.rect(mx - 1, by + 2, 2, h - (by - y) - 2, fr); P.vl(mx + 1, by + 2, h - (by - y) - 4, lo);
  for (let xx = x - 5; xx < x + w + 5; xx++) { P.px(xx, y + h, 0xfbf9f5); P.px(xx, y + h + 1, 0xe8e4de); P.px(xx, y + h + 2, 0xd8d4cc); }
  P.hl(x - 5, y + h + 3, w + 10, 0x9a948a); P.darken(x - 4, y + h + 4, w + 8, 2, 0.8);
  // kaktus i terrakottakruka på fönsterbänken
  const cx = x + 8, cy = y + h;
  P.rect(cx - 2, cy - 3, 5, 3, 0xc0603a); P.hl(cx - 2, cy - 3, 5, 0xe08050);
  P.rect(cx - 1, cy - 9, 3, 6, 0x3a8a44); P.vl(cx - 1, cy - 9, 6, 0x5aaa5a); P.px(cx - 2, cy - 7, 0x3a8a44); P.px(cx - 3, cy - 8, 0x3a8a44); P.px(cx + 2, cy - 6, 0x3a8a44); P.px(cx + 3, cy - 7, 0x3a8a44); P.px(cx, cy - 10, 0xf28bb3);
}
function paintDoor(P, night) {
  const { x0, x1, top } = DOOR, dw = x1 - x0;
  architrave(P, x0, top, dw, WALL_Y - top);
  P.rect(x0 - 2, top - 2, dw + 4, WALL_Y - top + 2, GOLD); P.hl(x0 - 2, top - 2, dw + 4, GOLD_HI); P.vl(x0 + dw + 1, top - 1, WALL_Y - top + 1, GOLD_LO);
  const lw = dw >> 1;
  for (let k = 0; k < 2; k++) {
    const lx = x0 + k * lw;
    P.rect(lx, top, lw, WALL_Y - top, 0x2a2e38); P.vl(lx, top, WALL_Y - top, 0x4a4e5a);
    glass(P, lx + 2, top + 2, lw - 4, 50, night, 5 + k);
    // tryckstång och sparkplåt i mässing
    P.rect(lx + 2, top + 26, lw - 4, 2, GOLD); P.hl(lx + 2, top + 26, lw - 4, GOLD_HI); P.hl(lx + 2, top + 28, lw - 4, 0x000000, 0.3);
    P.rect(lx + 1, top + 53, lw - 2, WALL_Y - top - 54, GOLD); P.hl(lx + 1, top + 53, lw - 2, GOLD_HI); P.hl(lx + 1, WALL_Y - 2, lw - 2, GOLD_LO);
    for (let i = lx + 2; i < lx + lw - 2; i += 3) P.px(i, top + 57, 0xfff8d8);
  }
  P.vl(x0 + lw - 1, top, WALL_Y - top, 0x16181e);
  // öppettider i guldtext på glaset (över båda dörrbladen)
  for (const [s, yy] of [['ÖPPET', top + 5], ['7-20', top + 12]]) {
    const tx = Math.round(DOOR_CX - textW(SMALL, s) / 2);
    text(P, SMALL, s, tx + 1, yy + 1, 0x000000, 0.45);
    embossText(P, SMALL, s, tx, yy, GOLD_HI, GOLD, GOLD, GOLD_LO);
  }
  P.hl(x0 + 4, top + 19, dw - 8, GOLD, 0.8);
  // grön UT-skylt ovanför
  const sw = textW(SMALL, 'UT') + 12, sx = Math.round(DOOR_CX - sw / 2);
  P.rect(sx, top - 14, sw, 8, 0x1d6a3a); P.box(sx, top - 14, sw, 8, 0x0e2a18); P.hl(sx + 1, top - 13, sw - 2, 0x3a9a5a);
  text(P, SMALL, 'UT', sx + 3, top - 12, 0xe8ffe8);
  P.px(sx + sw - 5, top - 11, 0xe8ffe8); P.px(sx + sw - 4, top - 10, 0xe8ffe8); P.px(sx + sw - 5, top - 9, 0xe8ffe8); P.hl(sx + sw - 7, top - 10, 3, 0xe8ffe8);
}
// Planschen som egen bild (annonsdialogen visar samma målning som hänger på väggen)
export function posterImage(homeId) {
  const i = HOMES.findIndex((h) => h.id === homeId);
  if (i < 0) return null;
  const P = new Pix(PW + 2, PH + 2);
  paintPosterStatic(P, { home: HOMES[i], x: 0, y: 0, w: PW, h: PH }, i);
  return P.flush();
}

function paintPosterStatic(P, p, idx) {
  const { x, y, w, h, home } = p;
  P.darken(x + 2, y + h, w, 2, 0.55); P.darken(x + w, y + 2, 2, h - 2, 0.55);
  P.rect(x, y, w, h, OUT);
  P.bevel(x + 1, y + 1, w - 2, h - 2, GOLD_HI, GOLD_LO);
  P.box(x + 2, y + 2, w - 4, h - 4, GOLD);
  P.rect(x + 3, y + 3, w - 6, h - 6, PAPER);
  for (let j = 3; j < h - 3; j++) for (let i = 3; i < w - 3; i++) if (hash(x + i, y + j, 70) > 0.93) P.px(x + i, y + j, 0xf0e8d8);
  // rubrikband
  P.rect(x + 3, y + 3, w - 6, 10, NAVY); P.hl(x + 3, y + 3, w - 6, NAVY_HI); P.hl(x + 3, y + 12, w - 6, GOLD);
  const name = home.name.toUpperCase(), tw = textW(SMALL, name);
  if (tw <= w - 8) embossText(P, SMALL, name, x + Math.floor((w - tw) / 2), y + 5, GOLD_HI, GOLD, GOLD, NAVY_LO);
  // bilden
  const px0 = x + 5, py0 = y + 15, pw = w - 10, ph = 32;
  P.clip(px0, py0, px0 + pw, py0 + ph);
  (PICS[home.id] || ((PP, a, b, c, d) => picGeneric(PP, a, b, c, d, idx)))(P, px0, py0, pw, ph);
  P.clip();
  P.box(px0 - 1, py0 - 1, pw + 2, ph + 2, 0x8a8478);
  P.hl(px0, py0 + ph + 1, pw, 0xe4dccb);
  // tunna linjer mellan raderna (texten ritas levande)
  for (const ly of [y + 56, y + 62]) for (let i = x + 5; i < x + w - 5; i += 2) P.px(i, ly, 0xd8d0c0);
}
function pictureLight(P, cx, y) {
  P.vl(cx, y - 3, 3, GOLD_LO); P.px(cx, y - 4, GOLD);
  for (let i = -7; i <= 7; i++) { P.px(cx + i, y, GOLD_HI); P.px(cx + i, y + 1, GOLD); P.px(cx + i, y + 2, GOLD_LO); }
  P.px(cx - 8, y + 1, GOLD_LO); P.px(cx + 8, y + 1, GOLD_LO);
  for (let i = -6; i <= 6; i++) P.px(cx + i, y + 3, 0xfff8d8);
}
function wallClockFace(P, cx, cy) {
  disc(P, cx + 1, cy + 1, 9, 9, 0x000000, 0.2);
  disc(P, cx, cy, 9, 9, GOLD_LO); disc(P, cx - 0.5, cy - 0.5, 8.5, 8.5, GOLD); disc(P, cx, cy, 7.5, 7.5, 0xfdfaf2);
  for (let k = 0; k < 12; k++) {
    const a = k / 12 * Math.PI * 2;
    P.px(Math.round(cx + Math.sin(a) * 6), Math.round(cy - Math.cos(a) * 6), k % 3 === 0 ? NAVY : 0xa89e8c);
  }
  P.px(cx - 4, cy - 5, 0xffffff); P.px(cx - 5, cy - 4, 0xffffff);
}
function paintRoom(night) {
  const P = new Pix(W, H);
  // ===== väggarna: randig tapet och den mörkblå annonsväggen =====
  for (let y = 0; y < WALL_Y; y++) for (let x = 0; x < W; x++) {
    let c;
    if (x >= FEAT.x0 && x < FEAT.x1) {
      const gx = (x - FEAT.x0) % 10;
      c = mix(NAVY_LO, NAVY, q(Math.min(1, (y - 4) / 26), x, y, 4));
      if (gx === 0) c = mul(c, 0.8); else if (gx === 1) c = mix(c, 0x8aa0c8, 0.08);
      if (hash(x, y >> 1, 4) > 0.92) c = mul(c, 0.95);
    } else {
      const s = Math.floor(x / 6) & 1;
      c = s ? 0xf1e7d3 : 0xeadfc9;
      if (x % 12 === 0) c = mix(c, 0xcdb88c, 0.45);
      if (s && x % 6 === 3 && (y + (Math.floor(x / 12) & 1) * 6) % 12 === 0) c = mix(c, 0xd4bc8c, 0.7);
      if (s && x % 6 === 3 && (y + 1 + (Math.floor(x / 12) & 1) * 6) % 12 === 0) c = mix(c, 0xd4bc8c, 0.35);
      c = mix(c, 0xffffff, (bayer(x, y) - 0.5) * 0.05);
    }
    P.px(x, y, c);
  }
  for (let i = 0; i < 8; i++) P.darken(0, 5 + i, W, 1, 0.8 + i * 0.025);
  // taklist med tandsnitt
  P.hl(0, 0, W, 0xa89e8c); P.hl(0, 1, W, 0xfdfaf2); P.hl(0, 2, W, 0xe4dccb); P.hl(0, 3, W, 0xf6f0e4); P.hl(0, 4, W, 0xb4a894);
  for (let x = 0; x < W; x += 3) P.px(x, 3, 0xcfc4ae);
  // boasering på de ljusa väggarna (fönster och dörr målas ovanpå)
  wainscot(P, 0, FEAT.x0 - 3);
  wainscot(P, FEAT.x1 + 3, W);
  // annonsväggens sockel
  P.rect(FEAT.x0, 94, FEAT.x1 - FEAT.x0, 6, NAVY_LO); P.hl(FEAT.x0, 94, FEAT.x1 - FEAT.x0, GOLD); P.hl(FEAT.x0, 99, FEAT.x1 - FEAT.x0, 0x0a0e18);
  // pilastrar mellan väggarna
  for (const px of [FEAT.x0 - 3, FEAT.x1 - 2]) {
    P.rect(px, 5, 5, WALL_Y - 5, 0xf2ece0); P.vl(px, 5, WALL_Y - 5, 0xfffcf4); P.vl(px + 3, 5, WALL_Y - 5, 0xd8ceba); P.vl(px + 4, 5, WALL_Y - 5, 0xb4a894);
    P.rect(px - 1, 5, 7, 3, 0xe8e0d0); P.hl(px - 1, 7, 7, 0xb4a894); P.rect(px - 1, WALL_Y - 6, 7, 6, 0xe8e0d0); P.hl(px - 1, WALL_Y - 6, 7, 0xfffcf4); P.hl(px - 1, WALL_Y - 1, 7, 0x8a8070);
  }
  // ===== fönster och dörr =====
  bigWindow(P, night);
  blindsWindow(P, night);
  paintDoor(P, night);
  // ===== annonsväggen: rubrik, tavelbelysning, planscher =====
  const head = 'VÅRA BOSTÄDER', hw = textW(BIG, head), hx = Math.round((FEAT.x0 + FEAT.x1) / 2 - hw / 2);
  embossText(P, BIG, head, hx, 7, GOLD_HI, GOLD, GOLD_LO, 0x0a0e18);
  for (const kx of [hx - 14, hx + hw + 5]) { // små nyckelloggor
    for (let yy = 0; yy < 5; yy++) for (let xx = 0; xx < 5; xx++) { const e = Math.hypot(xx - 2, yy - 2); if (e <= 2.3 && e >= 1) P.px(kx + xx, 8 + yy, yy < 2 ? GOLD_HI : GOLD); }
    P.hl(kx + 5, 10, 4, GOLD); P.px(kx + 7, 11, GOLD); P.px(kx + 8, 12, GOLD_LO);
  }
  POSTERS.forEach((p, i) => paintPosterStatic(P, p, i));
  for (const p of POSTERS) {
    const cx = p.x + Math.floor(p.w / 2);
    P.ell(cx, p.y + 10, p.w * 0.62, 26, 0xfff4d8, night ? 0.3 : 0.2, 5);
    pictureLight(P, cx, PY - 4);
  }
  // ===== väntrummet: väggklocka (visarna ritas levande) =====
  wallClockFace(P, 27, 42);
  // ===== mäklarhörnan: nummertavla, diplom, nyckelskåp =====
  P.rect(394, 24, 36, 22, 0x2a2430); P.box(393, 23, 38, 24, OUT); P.hl(394, 24, 36, 0x4a4450);
  text(P, SMALL, 'NUMMER', 394 + Math.floor((36 - textW(SMALL, 'NUMMER')) / 2), 26, 0xf0d048);
  P.rect(397, 32, 30, 12, 0x120a0a); P.hl(397, 32, 30, 0x2a1818);
  // diplom
  const dx = DIPLOMA_X - 440;
  P.darken(442 + dx, 42, 31, 1, 0.7); P.darken(472 + dx, 22, 1, 20, 0.8);
  P.rect(440 + dx, 20, 32, 22, OUT); P.bevel(441 + dx, 21, 30, 20, GOLD_HI, GOLD_LO); P.rect(443 + dx, 23, 26, 16, PAPER);
  text(P, SMALL, 'DIPLOM', 443 + dx + Math.floor((26 - textW(SMALL, 'DIPLOM')) / 2), 24, NAVY);
  for (const ly of [31, 33]) for (let i = 446; i < 466; i++) if (hash(i, ly, 71) > 0.25) P.px(i + dx, ly, 0xa8a090);
  P.line(446 + dx, 36, 452 + dx, 35, 0x2a3a6a); P.line(452 + dx, 35, 455 + dx, 37, 0x2a3a6a);
  disc(P, 465 + dx, 36, 2.5, 2.5, 0xc9323a); P.px(464 + dx, 35, 0xff7a6b); P.px(464 + dx, 39, 0xa01a20); P.px(466 + dx, 39, 0xa01a20);
  // små inramade foton: Kanelbulle med rosett och en såld villa
  dogPortrait(P, PHOTO.x, PHOTO.y);
  soldPhoto(P, PHOTO.x + 1, PHOTO.y + 15);
  // inramad karta över Pixelstaden ovanför kaffebaren
  cityMap(P, 5, 9, 29, 20);
  // nyckelskåp: glasdörr, grön filt, krokar med nycklar och färgade brickor
  const kx = 558, ky = 24, kw = 36, kh = 30;
  P.rect(kx, ky, kw, kh, OUT); P.rect(kx + 1, ky + 1, kw - 2, kh - 2, WALNUT[3]); P.hl(kx + 1, ky + 1, kw - 2, WALNUT[4]); P.vl(kx + kw - 2, ky + 2, kh - 3, WALNUT[1]);
  P.rect(kx + 3, ky + 3, kw - 6, kh - 6, 0x1e3a2c);
  for (let j = ky + 3; j < ky + kh - 3; j++) for (let i = kx + 3; i < kx + kw - 3; i++) if (hash(i, j, 72) > 0.85) P.px(i, j, 0x28483a);
  const TAGS = [0xd9433b, 0xf0c020, 0x3a7bd5, 0x46a35a, 0xf28bb3, 0xe07a2e];
  for (let r = 0; r < 3; r++) for (let c = 0; c < 6; c++) {
    const hx2 = kx + 5 + c * 5, hy2 = ky + 5 + r * 8;
    P.px(hx2, hy2, GOLD_HI);
    if (hash(r, c, 73) > 0.8) continue;
    P.px(hx2, hy2 + 1, 0xb8bcc4); P.box(hx2 - 1, hy2 + 1, 3, 3, 0xa8acb4); P.vl(hx2, hy2 + 4, 3, 0xc8ccd4); P.px(hx2 + 1, hy2 + 5, 0xc8ccd4);
    P.rect(hx2 + 1, hy2 + 2, 2, 3, TAGS[(r * 6 + c) % TAGS.length]);
  }
  for (let j = ky + 3; j < ky + kh - 3; j++) for (let i = kx + 3; i < kx + kw - 3; i++) if ((i + j) % 15 < 2) P.px(i, j, 0xffffff, 0.18);
  P.px(kx + kw - 4, ky + 15, GOLD); P.px(kx + kw - 4, ky + 16, GOLD_LO);
  P.darken(kx + 1, ky + kh, kw, 2, 0.7);
  const nl = 'NYCKLAR', nw = textW(SMALL, nl) + 4, nx = kx + Math.floor((kw - nw) / 2);
  P.rect(nx, ky - 8, nw, 7, GOLD); P.box(nx, ky - 8, nw, 7, GOLD_LO); text(P, SMALL, nl, nx + 2, ky - 7, NAVY);
  // ===== taklampor: opalglobar i mässing =====
  for (const lx of [92, 518]) {
    P.vl(lx, 5, 6, 0x2a2430); P.rect(lx - 1, 10, 3, 2, GOLD); P.px(lx - 1, 10, GOLD_HI);
    disc(P, lx + 0.5, 16, 4.5, 4.5, 0xe8e4dc); disc(P, lx, 15.5, 3.5, 3.5, 0xfdfbf6); P.px(lx - 1, 14, 0xffffff); P.px(lx + 2, 18, 0xd0c8bc);
    P.ell(lx + 0.5, 16, 14, 11, 0xfff4d0, night ? 0.4 : 0.18, 4);
  }
  // ===== golvet =====
  for (let y = WALL_Y; y < H; y++) for (let x = 0; x < W; x++) P.px(x, y, parquet(x, y));
  // mattor: väntrummet (marinblå med guldbård), monterns ovala, mäklarens röda kelim
  rugNavy(P, 30, 108, 112, 56);
  rugOval(P, MODEL.x, MODEL.base - 6, 46, 15);
  rugKilim(P, 470, 114, 122, 64);
  rugRunner(P, 190, 116, 192, 13);
  rugKids(P, DOLL.x + 2, DOLL.base - 2, 34, 10);
  // golvgaller i mässing och en tappad broschyr
  P.rect(312, 184, 12, 5, 0x3a2a10); for (let i = 0; i < 12; i += 2) P.vl(312 + i, 184, 5, GOLD); P.hl(312, 184, 12, GOLD_HI); P.hl(312, 188, 12, GOLD_LO); P.darken(312, 189, 12, 1, 0.8);
  P.rect(337, 160, 7, 4, 0xfbf7ee); P.hl(337, 160, 7, 0x3a7bd5); P.px(338, 162, 0xd9433b); P.hl(340, 162, 3, 0x8a8478); P.darken(338, 164, 7, 1, 0.75);
  // kontaktskuggor under allt som står på golvet
  for (const [cx, cy, rx, ry] of SHADOWS) P.ell(cx, cy, rx, ry, 0x1a0e06, 0.42, 3);
  // dörrmatta med VÄLKOMMEN
  const mx0 = DOOR.x0 - 8, mw = DOOR.x1 - DOOR.x0 + 16;
  for (let y = WALL_Y + 1; y < WALL_Y + 12; y++) for (let x = mx0; x < mx0 + mw; x++) {
    let c = ((x + y) & 1) ? 0x5a4a38 : 0x4a3c2e;
    if (y === WALL_Y + 1 || y === WALL_Y + 11 || x === mx0 || x === mx0 + mw - 1) c = 0x2a2018;
    P.px(x, y, c);
  }
  text(P, SMALL, 'VÄLKOMMEN', mx0 + Math.floor((mw - textW(SMALL, 'VÄLKOMMEN')) / 2), WALL_Y + 4, 0xd8c8a0);
  // solkatter från fönstren (dag) och lampornas ljuspölar (kväll)
  if (!night) {
    sunPatch(P, WIN1.x, WIN1.w, 44, [Math.round(WIN1.w / 3), Math.round(WIN1.w * 2 / 3)]);
    sunPatch(P, DOOR.x0 + 2, DOOR.x1 - DOOR.x0 - 4, 30, [(DOOR.x1 - DOOR.x0) / 2 - 2]);
    sunPatch(P, WIN2.x, WIN2.w, 36, [WIN2.w >> 1]);
  } else {
    for (const [lx, ly, rx] of [[92, 140, 50], [518, 150, 50], [LAMP.x, LAMP.base + 6, 26], [MODEL.x, MODEL.base - 4, 50], [BENCH.x, BENCH.base, 44], [SIDE.x - 5, SIDE.base + 2, 24]]) P.ell(lx, ly, rx, rx * 0.35, 0xffe8b0, 0.22, 4);
  }
  // skugga längs väggen
  for (let i = 0; i < 5; i++) P.darken(0, WALL_Y + i, W, 1, 0.72 + i * 0.055);
  // sidoväggarna i kanterna
  for (let i = 0; i < 4; i++) { P.darken(i, 0, 1, H, 0.6 + i * 0.1); P.darken(W - 1 - i, 0, 1, H, 0.6 + i * 0.1); }
  P.box(0, 0, W, H, 0x0e0d12);
  return P.flush();
}
function sunPatch(P, x0, w, len, mull) {
  for (let j = 0; j < len; j++) {
    const y = WALL_Y + 2 + j, sh = Math.round(j * 0.65);
    for (let i = 0; i < w; i++) {
      if (mull.some((m) => Math.abs(i - m) <= 1)) continue;
      const lv = q(1 - j / len, x0 + i + sh, y, 3);
      if (lv > 0) P.px(x0 + i + sh, y, 0xfff0c0, 0.22 * lv);
    }
  }
}
function rugNavy(P, x0, y0, w, h) {
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) {
    const ex = Math.min(x - x0, x0 + w - 1 - x), ey = Math.min(y - y0, y0 + h - 1 - y), e = Math.min(ex, ey);
    let c = mix(VELVET[1], VELVET[2], hash(x >> 1, y, 80) * 0.5);
    if (e === 0) c = VELVET[0];
    else if (e < 3) c = e === 1 ? GOLD_LO : GOLD;
    else if (e === 4) c = 0xe8dcc0;
    else if (e > 6) {
      const u = Math.abs(((x - x0 - w / 2) % 16 + 16) % 16 - 8) + Math.abs(((y - y0 - h / 2) % 10 + 10) % 10 - 5);
      if (u === 5) c = mix(GOLD, VELVET[2], 0.35); else if (u === 2) c = 0xc8b890;
      const m = Math.abs(x - x0 - w / 2) / 20 + Math.abs(y - y0 - h / 2) / 10;
      if (m < 1) c = mix(c, 0x9a2a2a, m > 0.8 ? 0.8 : m > 0.5 ? 0.2 : 0.55);
      if (Math.abs(m - 0.8) < 0.08) c = GOLD;
    }
    P.px(x, y, c);
  }
  for (let y = y0 + 1; y < y0 + h - 1; y += 2) { P.px(x0 - 1, y, 0xe8dcc0); P.px(x0 + w, y, 0xe8dcc0); } // fransar
  P.darken(x0, y0 + h, w, 1, 0.8);
}
function rugOval(P, cx, cy, rx, ry) {
  for (let y = Math.floor(cy - ry); y <= cy + ry; y++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
    const e = Math.hypot((x + 0.5 - cx) / rx, (y + 0.5 - cy) / ry);
    if (e > 1) continue;
    let c = mix(0xeee4d0, 0xe0d4bc, hash(x >> 1, y, 81) * 0.6);
    if (e > 0.92) c = NAVY; else if (e > 0.86) c = GOLD; else if (e > 0.8 && e < 0.83) c = NAVY_HI;
    P.px(x, y, c);
  }
}
function rugRunner(P, x0, y0, w, h) {
  // gångmatta framför planscherna: marinblå med guldbård, små guldromber och fransar
  const cy = y0 + (h >> 1);
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) {
    const ex = Math.min(x - x0, x0 + w - 1 - x), ey = Math.min(y - y0, y0 + h - 1 - y), e = Math.min(ex, ey);
    let c = mix(VELVET[1], VELVET[2], hash(x >> 1, y, 120) * 0.5);
    if (e === 0) c = VELVET[0];
    else if (e === 1) c = GOLD_LO;
    else if (e === 2) c = (x + y) & 1 ? GOLD : GOLD_HI;
    else if (e === 3) c = VELVET[0];
    else {
      const dx = Math.abs(((x - x0) % 14) - 7), dy = Math.abs(y - cy);
      if (dx + dy === 2) c = GOLD; else if (dx + dy === 0) c = 0xe8dcc0; else if (dy === 0 && dx > 3) c = mix(c, GOLD, 0.3);
    }
    P.px(x, y, c);
  }
  for (let y = y0 + 1; y < y0 + h - 1; y += 2) for (const fx of [x0 - 1, x0 + w]) P.px(fx, y, 0xe8dcc0);
  for (let y = y0 + 2; y < y0 + h - 1; y += 2) { P.px(x0 - 2, y, 0xd8ccb0, 0.7); P.px(x0 + w + 1, y, 0xd8ccb0, 0.7); }
  P.darken(x0, y0 + h, w, 1, 0.78);
}
function rugKids(P, cx, cy, rx, ry) {
  // rund flätad trasmatta i regnbågens färger (barnhörnan)
  const R = [0xf4ead0, 0x8e5bd1, 0x3a7bd5, 0x46a35a, 0xf0d048, 0xf0a030, 0xd9433b];
  for (let y = Math.floor(cy - ry); y <= cy + ry; y++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
    const e = Math.hypot((x + 0.5 - cx) / rx, (y + 0.5 - cy) / ry);
    if (e > 1) continue;
    let c = R[Math.min(R.length - 1, Math.floor(e * R.length))];
    const k = (x + (y & 1) * 2 + 40) & 3;
    if (k === 0) c = mul(c, 0.8); else if (k === 2) c = mix(c, 0xffffff, 0.18);
    P.px(x, y, c);
  }
  P.darken(cx - rx * 0.7, cy + ry, rx * 1.4, 1, 0.82);
}
function dogPortrait(P, x, y) {
  // inramat foto av Kanelbulle med röd rosett (10×13)
  P.darken(x + 1, y + 13, 10, 1, 0.75); P.darken(x + 10, y + 1, 1, 12, 0.8);
  P.rect(x, y, 10, 13, WALNUT[1]); P.bevel(x, y, 10, 13, WALNUT[4], WALNUT[0]); P.box(x + 1, y + 1, 8, 11, GOLD);
  vgrad(P, x + 2, y + 2, 6, 9, 0xc4e0f2, 0x8ab4d8, 3);
  const B = [0x4a220e, 0x7a3e1a, 0xa05a28, 0xc47a3e];
  P.hl(x + 2, y + 10, 6, 0x5a9e46); P.px(x + 3, y + 9, 0x5a9e46);
  P.rect(x + 3, y + 4, 4, 4, B[1]); P.hl(x + 3, y + 4, 3, B[2]); P.px(x + 4, y + 3, B[3]); P.px(x + 3, y + 5, B[2]); // huvudet
  P.px(x + 2, y + 6, 0x140a06); P.px(x + 2, y + 7, B[1]);                    // nosen
  P.vl(x + 6, y + 5, 4, B[0]);                                                // hängörat
  P.px(x + 4, y + 5, 0x140a06); P.px(x + 5, y + 4, 0xffffff);                 // ögat med glans
  P.rect(x + 4, y + 8, 3, 2, B[2]);                                           // halsen
  P.px(x + 4, y + 9, 0xc9323a); P.px(x + 5, y + 9, 0x8a1a20); P.px(x + 6, y + 9, 0xc9323a); P.px(x + 4, y + 10, 0xc9323a); P.px(x + 6, y + 10, 0xc9323a); // rosetten
  P.px(x + 2, y + 2, 0xffffff, 0.7);
}
function soldPhoto(P, x, y) {
  // litet foto av en såld villa med rött SÅLT-band (8×10)
  P.darken(x + 1, y + 10, 8, 1, 0.75); P.darken(x + 8, y + 1, 1, 9, 0.8);
  P.rect(x, y, 8, 10, 0x2a2430); P.hl(x, y, 8, 0x4a4450);
  P.rect(x + 1, y + 1, 6, 8, 0xfbf7ee);
  P.rect(x + 2, y + 2, 4, 4, 0x9ad0f0); P.hl(x + 2, y + 5, 4, 0x5aa04a);
  P.rect(x + 3, y + 4, 2, 1, 0xb23c2e); P.hl(x + 2, y + 3, 4, 0x3a3c48);
  P.hl(x + 1, y + 7, 6, 0xc9323a); P.px(x + 2, y + 7, 0xffffff); P.px(x + 4, y + 7, 0xffffff);
}
function cityMap(P, x, y, w, h) {
  // inramad karta över Pixelstaden: kvarter, parker, ån och nålar vid bostäderna
  P.darken(x + 1, y + h, w, 1, 0.75); P.darken(x + w, y + 1, 1, h, 0.8);
  P.rect(x, y, w, h, OUT); P.bevel(x + 1, y + 1, w - 2, h - 2, GOLD_HI, GOLD_LO);
  P.rect(x + 2, y + 2, w - 4, h - 4, PAPER);
  const mx = x + 3, my = y + 3, mw = w - 6, mh = h - 6;
  for (let j = 0; j < mh; j++) for (let i = 0; i < mw; i++) {
    let c;
    if (i % 5 === 4 || j % 4 === 3) c = 0xfbf7ee;
    else {
      const bx = Math.floor(i / 5), by = Math.floor(j / 4), hh = hash(bx, by, 121);
      c = hh > 0.72 ? ((i + j) & 1 ? 0x8cc462 : 0x7ab456) : hh > 0.4 ? 0xe4d4b0 : 0xd4c09a;
      if (hh <= 0.72 && (i + j * 3) % 5 === 0) c = mul(c, 0.9);
    }
    if (Math.abs(i - (mw * 0.72 - j * 0.9)) < 1.2) c = (i + j) & 1 ? 0x6aa4d4 : 0x5a94c8;
    P.px(mx + i, my + j, c);
  }
  for (const [px, py, c] of [[3, 2, 0xd9433b], [13, 6, 0x3a7bd5], [7, 10, 0xf0c020], [20, 3, 0x46a35a]]) {
    if (px >= mw || py >= mh) continue;
    P.px(mx + px, my + py, c); P.px(mx + px, my + py + 1, 0x2a2430); P.px(mx + px + 1, my + py - 1, 0xffffff, 0.7);
  }
  // kompassros i hörnet
  P.px(mx + mw - 2, my + mh - 3, NAVY); P.px(mx + mw - 2, my + mh - 1, NAVY); P.px(mx + mw - 3, my + mh - 2, NAVY); P.px(mx + mw - 1, my + mh - 2, NAVY); P.px(mx + mw - 2, my + mh - 2, 0xc9323a);
}
function rugKilim(P, x0, y0, w, h) {
  const R = [0x6a1a1a, 0x9a2a26, 0xc0503a, 0xe0a060, 0xf0e0c0, 0x2a3a5a];
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) {
    const ex = Math.min(x - x0, x0 + w - 1 - x), ey = Math.min(y - y0, y0 + h - 1 - y), e = Math.min(ex, ey);
    let c = mix(R[1], R[2], hash(x >> 1, y, 82) * 0.4);
    if (e === 0) c = R[0];
    else if (e < 4) c = e === 2 ? R[4] : R[5];
    else {
      const band = Math.floor((y - y0 - 4) / 9), yy = (y - y0 - 4) % 9;
      const u = Math.abs(((x - x0) % 12) - 6) + Math.abs(yy - 4);
      if (u === 4) c = band % 2 ? R[3] : R[4]; else if (u < 2) c = band % 2 ? R[5] : R[3];
      if (yy === 8) c = R[0];
    }
    P.px(x, y, c);
  }
  for (let x = x0 + 1; x < x0 + w - 1; x += 2) { P.px(x, y0 - 1, 0xf0e0c0); P.px(x, y0 + h, 0xf0e0c0); }
}

// ================= möbler och föremål (sprites, fotpunkt = origo) =================
function paintCoffeeBar() {
  return spr(42, 50, 1, 47, (P) => {
    const w = 38;
    // skåp i vitlack med marmorskiva
    for (let y = -21; y <= -19; y++) for (let x = 0; x < w; x++) {
      let c = y === -21 ? 0xfbf9f5 : mix(0xeeeae4, 0xdcd8d0, hash(x >> 1, y, 83));
      if (Math.abs(((x * 0.7 + y * 2 + 400) % 11) - 5.5) < 0.5) c = mix(c, 0xa09aa0, 0.35);
      P.px(x, y, c);
    }
    P.hl(0, -18, w, 0xc8c2b8);
    for (let y = -17; y <= -3; y++) for (let x = 0; x < w; x++) P.px(x, y, mix(0xf4f0e8, 0xd8d0c0, q((x / w) * 0.6 + (y + 17) / 40, x, y, 3)));
    P.vl(Math.floor(w / 2), -17, 14, 0xc0b8a8); P.vl(Math.floor(w / 2) + 1, -17, 14, 0xffffff);
    P.box(2, -16, 15, 12, 0xe0d8c8); P.box(w - 17, -16, 15, 12, 0xe0d8c8);
    P.rect(16, -11, 1, 3, GOLD); P.rect(21, -11, 1, 3, GOLD); P.px(16, -11, GOLD_HI); P.px(21, -11, GOLD_HI);
    P.rect(1, -2, w - 2, 2, 0x3a3228); P.px(1, -1, 0x1a1410);
    // espressomaskin i krom
    const ex = 3;
    for (let y = -38; y <= -22; y++) for (let x = ex; x < ex + 15; x++) P.px(x, y, tone(CHROME, 0.85 - (x - ex) / 15 * 0.55 - (y + 38) / 60, x, y));
    P.rect(ex, -39, 15, 2, 0x2a2a30); for (let x = ex + 1; x < ex + 14; x += 2) P.px(x, -39, 0x6a6a74);
    P.rect(ex + 2, -42, 3, 3, 0xf6f4f0); P.rect(ex + 6, -42, 3, 3, 0xf6f4f0); P.px(ex + 4, -41, 0xc8c4bc); P.px(ex + 8, -41, 0xc8c4bc);
    P.rect(ex + 1, -35, 13, 4, 0x1e1e24); P.px(ex + 3, -34, 0x6fe08a); P.px(ex + 5, -34, 0xd8323a);
    disc(P, ex + 10.5, -33, 2, 2, 0xf6f4f0); P.px(ex + 10, -33, OUT); P.px(ex + 11, -34, OUT);
    P.rect(ex + 5, -30, 5, 2, CHROME[1]); P.hl(ex + 5, -30, 5, CHROME[4]);
    P.rect(ex + 9, -28, 6, 1, 0x1a1a1e); P.px(ex + 14, -28, 0x3a3a44);
    P.vl(ex + 1, -30, 6, CHROME[3]); P.px(ex + 2, -25, CHROME[2]);
    P.rect(ex + 5, -25, 4, 3, 0xf6f4f0); P.hl(ex + 5, -25, 4, 0x6a3a1e); P.px(ex + 8, -24, 0xc8c4bc);
    P.rect(ex, -22, 15, 1, 0x2a2a30); for (let x = ex + 1; x < ex + 14; x += 2) P.px(x, -22, 0x5a5a64);
    // koppstapel och kanelbullar på fat
    for (let k = 0; k < 3; k++) { P.rect(20, -24 - k * 3, 5, 3, 0xf6f4f0); P.vl(24, -24 - k * 3, 3, 0xc8c4bc); P.hl(20, -24 - k * 3, 5, NAVY); }
    for (let x = 26; x < 37; x++) { P.px(x, -22, 0xe8e4de); P.px(x, -23, 0xf6f4f0); }
    for (const [bx, by] of [[27, -25], [31, -25], [29, -27], [33, -26]]) {
      disc(P, bx + 1.5, by + 1, 2.2, 1.8, 0xb8743a);
      P.px(bx + 1, by + 1, 0x7a4a22); P.px(bx + 2, by, 0xd89a5a); P.px(bx + 1, by, 0xf6f0e0); P.px(bx + 3, by + 1, 0xf6f0e0);
    }
  });
}
function paintSofa() {
  const w = SOFA.w;
  return spr(w + 4, 40, 2, 37, (P) => {
    for (const fx of [4, w - 7]) { P.rect(fx, -3, 3, 3, 0x2a1810); P.px(fx, -3, 0x5a3a24); }
    // ryggstöd med romb-knappning
    for (let y = -32; y <= -15; y++) for (let x = 6; x < w - 6; x++) {
      const a = (((x - 6) - (y + 32)) % 8 + 8) % 8, b = (((x - 6) + (y + 32)) % 8 + 8) % 8;
      let v = 0.5 + 0.2 * (1 - b / 7) + 0.06 * (a / 7) - (y + 32) / 18 * 0.12;
      if (a === 0 || b === 0) v -= 0.22;
      P.px(x, y, a === 0 && b === 0 ? LEATHER[0] : tone(LEATHER, v, x, y));
    }
    for (let y = -31; y <= -15; y++) for (let x = 6; x < w - 6; x++) {
      const a = (((x - 6) - (y + 32)) % 8 + 8) % 8, b = (((x - 6) + (y + 32)) % 8 + 8) % 8;
      if (a === 0 && b === 0) P.px(x, y - 1, LEATHER[4]);
    }
    P.hl(7, -34, w - 14, LEATHER[3]); P.hl(6, -33, w - 12, LEATHER[5]); P.hl(6, -32, w - 12, LEATHER[4]);
    // sittdynor
    for (let y = -15; y <= -9; y++) for (let x = 7; x < w - 7; x++) {
      let c = y <= -14 ? (y === -15 ? LEATHER[5] : LEATHER[4]) : tone(LEATHER, 0.64 - (y + 13) * 0.05, x, y);
      if (x === 29 || x === 50) c = y <= -14 ? LEATHER[2] : LEATHER[1];
      if (y === -9) c = LEATHER[2];
      P.px(x, y, c);
    }
    // sarg med mässingsnubb
    for (let y = -8; y <= -3; y++) for (let x = 6; x < w - 6; x++) P.px(x, y, tone(LEATHER, 0.5 - (y + 8) * 0.06, x, y));
    for (let x = 7; x < w - 7; x += 2) P.px(x, -8, GOLD);
    P.hl(6, -3, w - 12, LEATHER[0]);
    // rullade armstöd
    for (const ax of [0, w - 7]) {
      for (let y = -25; y <= -3; y++) for (let x = ax; x < ax + 7; x++) {
        if (y === -25 && (x === ax || x === ax + 6)) continue;
        const v = y < -21 ? 0.9 - (y + 25) * 0.08 : 0.55 - (x - ax - 3) ** 2 * 0.02 - (y + 21) * 0.012;
        P.px(x, y, tone(LEATHER, v, x, y));
      }
      for (let y = -20; y <= -5; y += 2) { P.px(ax + 1, y, GOLD); P.px(ax + 5, y, GOLD); }
      P.px(ax + 3, -22, LEATHER[1]); P.px(ax + 2, -21, LEATHER[1]); P.px(ax + 4, -21, LEATHER[1]); P.px(ax + 3, -20, LEATHER[0]);
    }
    // prydnadskuddar: marinblå sammet och ljus med grönt mönster
    for (let y = -24; y <= -14; y++) for (let x = 10; x < 23; x++) {
      const e = Math.min(x - 10, 22 - x, y + 24, -14 - y);
      P.px(x, y, e === 0 ? GOLD : tone(VELVET, 0.7 - (y + 24) / 20 - (x - 10) / 60, x, y));
    }
    for (let y = -23; y <= -14; y++) for (let x = w - 23; x < w - 10; x++) {
      const e = Math.min(x - (w - 23), w - 11 - x, y + 23, -14 - y);
      let c = mix(0xf2ead8, 0xd8ccb0, (y + 23) / 12);
      if (e > 1 && (x + y) % 4 === 0) c = 0x2a5a48;
      P.px(x, y, e === 0 ? 0xc8b890 : c);
    }
  });
}
function paintTable() {
  return spr(58, 42, 29, 38, (P) => {
    for (const [lx, back] of [[-15, 1], [13, 1], [-20, 0], [18, 0]]) {
      const top = back ? -12 : -10, len = back ? 9 : 10;
      P.vl(lx, top, len, back ? GOLD_LO : GOLD); P.vl(lx + 1, top, len, back ? 0x5a441a : GOLD_LO);
      if (!back) P.px(lx, -1, GOLD_HI);
    }
    P.hl(-17, -5, 34, GOLD_LO); P.hl(-16, -6, 32, GOLD); // hylla
    for (const [mx, c] of [[-12, 0xd9433b], [-4, 0x3a7bd5], [4, 0xf0c020]]) { P.rect(mx, -8, 7, 2, c); P.hl(mx, -8, 7, mix(c, 0xffffff, 0.4)); }
    for (let y = -18; y <= -11; y++) for (let x = -24; x <= 24; x++) {
      const e = (x / 24.5) ** 2 + ((y + 14.5) / 4) ** 2;
      if (e > 1) continue;
      let c = mix(0xf8f6f2, 0xdedad4, q((y + 18) / 7, x, y, 3));
      if (Math.abs(((x * 0.7 + y * 1.6 + 400) % 17) - 8.5) < 0.6 && hash(x >> 2, y, 84) > 0.3) c = mix(c, 0x9a969a, 0.4);
      if (e > 0.8 && y < -15) c = mix(c, 0xffffff, 0.5);
      P.px(x, y, c);
    }
    for (let x = -24; x <= 24; x++) {
      const yb = Math.round(-14.5 + 4 * Math.sqrt(Math.max(0, 1 - (x / 24.5) ** 2)));
      P.px(x, yb + 1, 0xb0aaa2); P.px(x, yb + 2, 0x8a847c);
    }
    // tidningar: en stapel och en uppslagen
    P.rect(-18, -15, 12, 4, 0x3a7bd5); P.rect(-17, -16, 12, 4, 0xf4f1ea); P.rect(-16, -17, 12, 4, 0xd9433b);
    P.hl(-16, -17, 12, 0xff7a6b); P.rect(-15, -16, 6, 1, 0xffffff); P.px(-8, -15, 0xf0c020); P.px(-7, -14, 0xf0c020);
    P.rect(-2, -15, 6, 3, 0xffffff); P.rect(4, -15, 6, 3, 0xf6f2ea); P.vl(4, -15, 3, 0xc8c4bc);
    for (const lx of [-1, 5]) { P.hl(lx, -14, 4, 0xa8a4a0); P.hl(lx, -13, 3, 0xa8a4a0); }
    P.rect(0, -14, 2, 1, 0x46a35a);
    // glasvas med tulpaner
    const vx = 14;
    P.rect(vx - 2, -21, 5, 7, 0xd8eef8); P.vl(vx - 2, -21, 7, 0xffffff); P.vl(vx + 2, -21, 7, 0xa8c8d8); P.hl(vx - 1, -17, 3, 0xb8dce8);
    for (const [dx, dy, c] of [[-2, -30, 0xd9433b], [1, -32, 0xf0c020], [3, -29, 0xf28bb3], [-1, -27, 0xe07a2e]]) {
      P.line(vx, -21, vx + dx, dy + 2, 0x3a7a32); P.rect(vx + dx, dy, 2, 2, c); P.px(vx + dx, dy, mix(c, 0xffffff, 0.4)); P.px(vx + dx + 1, dy - 1, c);
    }
    P.px(vx - 3, -24, 0x4a8a3a); P.px(vx + 3, -23, 0x4a8a3a);
  });
}
function paintArmchair() {
  return spr(32, 38, 16, 35, (P) => {
    for (const lx of [-10, 9]) { P.vl(lx, -3, 3, GOLD); P.px(lx, -1, GOLD_HI); }
    // öronlappar och rygg med kanalsömmar
    for (let y = -32; y <= -12; y++) for (let x = -12; x <= 12; x++) {
      if (y === -32 && Math.abs(x) > 10) continue;
      const wing = Math.abs(x) > 8;
      let v = wing ? 0.45 + (x < 0 ? 0.15 : -0.1) : 0.6 - (y + 32) / 40;
      if (!wing && (x + 20) % 6 === 0 && y > -30) v -= 0.12;
      P.px(x, y, tone(VELVET, v, x, y));
    }
    P.hl(-11, -32, 22, VELVET[4]);
    // armstöd, dyna, sarg
    for (const ax of [-12, 9]) for (let y = -18; y <= -3; y++) for (let x = ax; x < ax + 4; x++) P.px(x, y, tone(VELVET, y === -18 ? 0.9 : 0.5 - (x - ax) * 0.05, x, y));
    for (let y = -13; y <= -9; y++) for (let x = -8; x <= 8; x++) P.px(x, y, y === -13 ? VELVET[5] : tone(VELVET, 0.72 - (y + 13) * 0.07, x, y));
    for (let y = -8; y <= -3; y++) for (let x = -8; x <= 8; x++) P.px(x, y, tone(VELVET, 0.45 - (y + 8) * 0.04, x, y));
    for (let x = -8; x <= 8; x += 2) P.px(x, -8, GOLD);
  });
}
function paintFloorLamp() {
  return spr(18, 70, 9, 67, (P) => {
    for (let x = -4; x <= 4; x++) { P.px(x, -1, GOLD_LO); P.px(x, -2, x < 0 ? GOLD_HI : GOLD); }
    P.vl(0, -54, 52, GOLD); P.vl(1, -54, 52, GOLD_LO); P.px(0, -30, GOLD_HI);
    for (let y = -64; y <= -54; y++) {
      const half = 4 + Math.floor((y + 64) / 3);
      for (let x = -half; x <= half; x++) {
        let c = mix(0xfaf0d8, 0xe0cca4, (x + half) / (half * 2 + 1) * 0.8);
        if ((x + 40) % 2 === 0) c = mul(c, 0.95);
        P.px(x, y, c);
      }
    }
    P.hl(-3, -64, 7, GOLD); for (let x = -7; x <= 7; x++) P.px(x, -54, GOLD);
    for (let x = -6; x <= 6; x++) P.px(x, -53, 0xfff8d8);
  });
}
function paintRack() {
  return spr(16, 20, 8, 17, (P) => {
    P.rect(-6, -10, 12, 10, WALNUT[3]); P.hl(-6, -10, 12, WALNUT[5]); P.vl(5, -10, 10, WALNUT[1]);
    for (let x = -5; x < 5; x += 2) P.vl(x, -9, 8, WALNUT[2]);
    for (const [x, c, hh] of [[-5, 0xf4f1ea, 15], [-2, 0xd9433b, 14], [1, 0x3a7bd5, 13], [3, 0xf0c020, 12]]) { P.rect(x, -hh, 3, hh - 8, c); P.hl(x, -hh, 3, mix(c, 0xffffff, 0.4)); }
    P.hl(-5, -14, 2, 0x8a8478);
  });
}
function paintPlant(kind) {
  const big = kind !== 'fikus';
  return spr(big ? 40 : 28, big ? 52 : 64, big ? 20 : 14, big ? 49 : 61, (P) => {
    // kruka
    const pw = big ? 16 : 12, ph = big ? 12 : 11, pot = kind === 'monstera2' ? NAVY : kind === 'fikus' ? 0xf4f1ea : 0xc86a3a;
    const potR = [mix(mul(pot, 0.5), 0x1a1026, 0.2), mul(pot, 0.75), pot, mix(pot, 0xffffff, 0.3), mix(pot, 0xffffff, 0.6)];
    for (let y = -ph; y <= -1; y++) {
      const inset = y + ph < 5 ? 0 : 1;
      for (let x = -pw / 2 + inset; x < pw / 2 - inset; x++) P.px(x, y, tone(potR, 0.75 - (x + pw / 2) / pw * 0.6, x, y));
    }
    P.hl(-pw / 2, -ph, pw, potR[4]); P.hl(-pw / 2, -ph + 1, pw, potR[1]);
    if (kind !== 'monstera') P.hl(-pw / 2 + 1, -ph + 4, pw - 2, GOLD);
    P.hl(-pw / 2 + 1, -ph, pw - 2, 0x3a2616);
    if (kind === 'fikus') {
      // fikus lyrata: stam med stora ovala blad
      P.vl(0, -54, 44, 0x5a3a24); P.vl(1, -50, 40, 0x7a5030);
      const leaves = [[-6, -52, -1], [5, -56, 1], [-7, -44, -1], [6, -46, 1], [-6, -34, -1], [6, -37, 1], [-5, -26, -1], [5, -28, 1], [0, -60, 0]];
      for (const [lx, ly, s] of leaves) {
        for (let y = -4; y <= 4; y++) for (let x = -4; x <= 4; x++) {
          const u = x * 0.8 - y * 0.5 * s, v = y * 0.8 + x * 0.5 * s;
          if ((u / 3.2) ** 2 + (v / 4.4) ** 2 > 1) continue;
          let lv = 0.55 - v / 12 + (s < 0 ? 0.08 : -0.05) + (hash(lx + x, ly + y, 85) - 0.5) * 0.12;
          if (Math.abs(u) < 0.5) lv -= 0.2;
          P.px(lx + x, ly + y, tone(LEAF, lv, lx + x, ly + y));
        }
        P.line(Math.sign(lx), ly + 3, lx, ly, 0x3a5a24);
      }
    } else {
      // monstera: stora blad med slitsar
      const leaves = kind === 'monstera2'
        ? [[-9, -30, 7], [8, -34, 7], [0, -40, 7], [-12, -20, 6], [11, -22, 6], [2, -26, 6]]
        : [[-10, -32, 7], [9, -30, 7], [-1, -40, 7], [-13, -20, 6], [12, -19, 6], [0, -25, 6], [6, -44, 5]];
      for (const [lx, ly] of leaves) P.line(0, -ph, lx, ly + 3, 0x2a5a2e);
      for (const [lx, ly, r] of leaves) {
        for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) {
          const e = (x / r) ** 2 + (y / (r * 0.85)) ** 2;
          if (e > 1) continue;
          const ang = Math.atan2(y, x), rad = Math.hypot(x, y) / r;
          if (rad > 0.45 && Math.abs(((ang * 4 / Math.PI) % 1 + 1) % 1 - 0.5) < 0.09) continue; // slitsar
          let lv = 0.62 - y / (r * 3) - x / (r * 6) + (hash(lx + x, ly + y, 86) - 0.5) * 0.1;
          if (x === 0 && y > -r + 1) lv -= 0.18;
          P.px(lx + x, ly + y, tone(LEAF, lv, lx + x, ly + y));
        }
        P.px(lx - 2, ly - Math.floor(r * 0.6), LEAF[5]);
      }
    }
  });
}
function paintCooler() {
  return spr(22, 50, 11, 47, (P) => {
    for (let y = -26; y <= -1; y++) for (let x = -7; x <= 7; x++) P.px(x, y, tone([0x8a8e96, 0xb8bcc4, 0xdcdfe4, 0xf2f4f6, 0xffffff], 0.8 - (x + 7) / 14 * 0.5, x, y));
    P.hl(-7, -26, 15, 0xffffff); P.hl(-7, -1, 15, 0x6a6e76);
    P.rect(-5, -21, 11, 7, 0x3a3e48); P.hl(-5, -21, 11, 0x5a5e68);
    P.rect(-4, -20, 2, 2, 0xd8323a); P.rect(3, -20, 2, 2, 0x3a7bd5); P.px(-3, -18, 0xb8bcc4); P.px(4, -18, 0xb8bcc4);
    P.rect(-5, -14, 11, 2, 0x2a2e36); for (let x = -4; x < 6; x += 2) P.px(x, -14, 0x6a6e76);
    P.vl(-6, -12, 10, 0xc8ccd2);
    // vattenflaskan
    for (let y = -44; y <= -29; y++) for (let x = -6; x <= 6; x++) {
      if ((y === -44 || y === -29) && Math.abs(x) > 4) continue;
      let c = y < -40 ? mix(0xc8e4fa, 0x9ac8ee, (x + 6) / 12) : tone([0x2a5a98, 0x3a78b8, 0x5a9ad8, 0x8ac0f0, 0xc8e4fa], 0.85 - (x + 6) / 12 * 0.6, x, y);
      if ((y + 44) % 5 === 0) c = mix(c, 0xffffff, 0.2);
      if (x === -4) c = mix(c, 0xffffff, 0.6);
      P.px(x, y, c);
    }
    P.hl(-5, -40, 11, 0xe8f4ff);
    P.rect(-3, -28, 7, 2, 0x5a9ad8); P.hl(-6, -27, 13, 0xe8eaee);
    // muggtub
    P.rect(8, -30, 3, 14, 0xe8e4de); P.vl(10, -30, 14, 0xb8b4ae); for (let y = -29; y < -17; y += 2) P.px(9, y, 0xffffff);
  });
}
function paintTicket() {
  return spr(14, 40, 7, 37, (P) => {
    for (let x = -4; x <= 4; x++) { P.px(x, -1, 0x3a3e48); P.px(x, -2, x < 0 ? 0x8a8e96 : 0x5a5e68); }
    P.vl(0, -26, 24, CHROME[2]); P.vl(1, -26, 24, CHROME[1]);
    for (let y = -34; y <= -25; y++) for (let x = -4; x <= 4; x++) P.px(x, y, tone([0x6a1018, 0x9a1a22, 0xc9323a, 0xe85a5a, 0xff9a90], 0.8 - (x + 4) / 12 - (y + 34) / 40, x, y));
    P.hl(-4, -34, 9, 0xff9a90);
    P.rect(-2, -31, 5, 3, 0x2a1418); P.px(-1, -30, 0xff5a4a); P.px(1, -30, 0xff5a4a);
    P.rect(-1, -25, 3, 3, 0xf6f2ea); P.px(1, -23, 0xd8d4cc);
  });
}
function paintModel() {
  return spr(32, 46, 16, 43, (P) => {
    // sockel i vitlack med guldband och mässingsskylt
    for (let y = -14; y <= -1; y++) for (let x = -11; x <= 11; x++) P.px(x, y, tone([0xa89e8c, 0xd8d0c0, 0xece6da, 0xf8f4ec, 0xffffff], 0.85 - (x + 11) / 22 * 0.5, x, y));
    P.hl(-11, -14, 23, 0xffffff); P.hl(-11, -12, 23, GOLD); P.hl(-11, -11, 23, GOLD_LO); P.hl(-11, -1, 23, 0x8a8070);
    P.rect(-6, -8, 13, 5, GOLD); P.hl(-6, -8, 13, GOLD_HI); P.hl(-6, -4, 13, GOLD_LO); P.hl(-4, -6, 9, GOLD_LO);
    // modellen: tomt, hus, träd, flaggstång
    for (let y = -18; y <= -15; y++) for (let x = -9; x <= 9; x++) P.px(x, y, y === -18 ? 0x7ac05a : ((x + y) & 1) ? 0x5aa04a : 0x4c9040);
    P.hl(-9, -15, 19, 0x3a3228);
    P.rect(-5, -24, 8, 6, 0xb23c2e); P.vl(-5, -24, 6, 0xf6f2ea); P.vl(2, -24, 6, 0xd8d0c4);
    for (let j = 0; j < 4; j++) P.hl(-6 + j, -25 - j, 10 - j * 2, j % 2 ? 0x3a3c48 : 0x4c4e5c);
    P.px(-3, -22, 0x8ec4e8); P.px(0, -22, 0x8ec4e8); P.rect(-2, -20, 2, 2, 0x2a5a48);
    P.rect(1, -29, 1, 3, 0x9a3a2a);
    disc(P, 6, -21, 2.5, 2.5, 0x3a7e38); P.px(5, -22, 0x5a9e46); P.px(6, -18, 0x5a3a24); P.px(7, -21, 0xe0302a);
    P.vl(-8, -28, 10, 0xf6f2ea); P.rect(-7, -28, 3, 2, 0x2a5ab0); P.px(-6, -28, 0xf0c820); P.px(-6, -27, 0xf0c820);
    for (let x = -9; x <= 9; x += 2) P.px(x, -19, 0xffffff);
    // glasmonter
    for (let y = -36; y <= -15; y++) for (let x = -12; x <= 12; x++) {
      P.px(x, y, 0xd8eef8, 0.1);
      if ((x - y + 60) % 13 < 2) P.px(x, y, 0xffffff, 0.3);
    }
    P.hl(-12, -36, 25, 0xe8f4fa); P.vl(-12, -36, 22, 0xc8dce8); P.vl(12, -36, 22, 0x9ab0c0);
    P.hl(-12, -15, 25, 0xb8ccd8);
  });
}
function paintShelf() {
  return spr(46, 62, 1, 59, (P) => {
    const w = 42, h = 50;
    for (let y = -h; y <= -1; y++) for (let x = 0; x < w; x++) P.px(x, y, tone(WALNUT, 0.3 + hash(x >> 2, y, 87) * 0.1, x, y));
    P.rect(0, -h, 2, h, WALNUT[4]); P.vl(0, -h, h, WALNUT[5]); P.rect(w - 2, -h, 2, h, WALNUT[3]); P.vl(w - 1, -h, h, WALNUT[1]);
    P.rect(0, -h, w, 2, WALNUT[4]); P.hl(0, -h, w, WALNUT[5]);
    for (const sy of [-34, -19]) { P.rect(2, sy, w - 4, 2, WALNUT[4]); P.hl(2, sy, w - 4, WALNUT[5]); P.hl(2, sy + 2, w - 4, WALNUT[0]); }
    P.vl(21, -h + 2, 14, WALNUT[3]); P.vl(22, -h + 2, 14, WALNUT[1]);
    // pärmar med etiketter och fingerhål
    const BIND = [0x2d3a5c, 0xc9323a, 0x2a5a48, 0x8a8e96, 0xe8b230, 0x3a7bd5, 0x7a2e3e, 0x46a35a];
    const binders = (x0, x1, yb, seed) => {
      let x = x0, i = 0;
      while (x + 3 <= x1) {
        const c = BIND[Math.floor(hash(i, seed, 88) * BIND.length)], bh = 12 + (hash(i, seed, 89) > 0.6 ? 1 : 0);
        P.rect(x, yb - bh, 3, bh, c); P.vl(x, yb - bh, bh, mix(c, 0xffffff, 0.3)); P.vl(x + 2, yb - bh, bh, mul(c, 0.7));
        P.rect(x, yb - bh + 2, 3, 3, 0xf6f2ea); P.px(x + 1, yb - bh + 3, 0x8a8478);
        P.px(x + 1, yb - 4, 0x1a1418); P.px(x + 1, yb - 5, mix(c, 0x000000, 0.4));
        x += 3 + (hash(i, seed, 90) > 0.85 ? 1 : 0); i++;
      }
    };
    binders(3, 21, -34, 1); binders(23, 40, -34, 2); binders(3, 28, -19, 3);
    // pokal ("årets mäklare") och broschyrer
    P.rect(33, -21, 5, 1, GOLD_LO); P.vl(35, -24, 3, GOLD); P.rect(33, -29, 5, 5, GOLD); P.vl(33, -29, 5, GOLD_HI); P.px(32, -28, GOLD); P.px(38, -28, GOLD); P.px(32, -27, GOLD_LO); P.px(38, -27, GOLD_LO);
    for (let k = 0; k < 3; k++) P.hl(29, -20 - k, 4, [0xf4f1ea, 0x3a7bd5, 0xd9433b][k]);
    // stängt skåp nederst
    for (let y = -17; y <= -2; y++) for (let x = 2; x < w - 2; x++) P.px(x, y, tone(WALNUT, 0.5 - (y + 17) / 60 + hash(x >> 1, y >> 2, 91) * 0.08, x, y));
    P.vl(20, -17, 15, WALNUT[1]); P.vl(21, -17, 15, WALNUT[4]);
    P.box(4, -15, 15, 11, WALNUT[2]); P.box(23, -15, 15, 11, WALNUT[2]);
    P.px(18, -10, GOLD); P.px(24, -10, GOLD);
    // krukväxt och liten mässingslampa ovanpå
    P.rect(6, -h - 3, 5, 3, 0xf4f1ea); P.hl(6, -h - 3, 5, 0xffffff);
    for (const [dx, dy] of [[0, -5], [1, -7], [2, -6], [3, -8], [4, -5], [-1, -4], [5, -4]]) P.px(6 + dx, -h + dy, dx % 2 ? LEAF[3] : LEAF[4]);
    P.hl(29, -h - 1, 5, GOLD_LO); P.vl(31, -h - 5, 4, GOLD);
    P.hl(29, -h - 6, 5, 0xf4ead0); P.hl(28, -h - 7, 7, 0xf8f0dc); P.hl(29, -h - 8, 5, 0xe0d0b0);
  });
}
function paintDesk() {
  return spr(70, 52, 2, 48, (P) => {
    const w = DESK.w;
    // skiva i valnöt med grönt skrivunderlägg
    for (let y = -24; y <= -21; y++) for (let x = 0; x < w; x++) {
      let c = tone(WALNUT, 0.72 - (y + 24) * 0.06 + (hash(x >> 3, y, 92) - 0.5) * 0.1, x, y);
      if (Math.abs(((x + y * 3 + 200) % 9) - 4.5) < 0.5) c = mul(c, 0.92);
      P.px(x, y, c);
    }
    P.hl(0, -24, w, WALNUT[5]);
    for (let x = 18; x < 46; x++) { P.px(x, -23, 0x2f5a48); P.px(x, -22, 0x264a3c); }
    P.px(17, -23, GOLD); P.px(46, -23, GOLD);
    P.rect(0, -20, w, 2, WALNUT[2]); P.hl(0, -19, w, GOLD); // framkant med guldintarsia
    // fronten: två lådhurtsar och ett indraget mittparti
    for (let y = -18; y <= -1; y++) for (let x = 0; x < w; x++) {
      const mid = x >= 18 && x < w - 18;
      let c = tone(WALNUT, (mid ? 0.28 : 0.52) - (y + 18) / 80 + (hash(x >> 1, y >> 3, 93) - 0.5) * 0.1, x, y);
      if (!mid && (x === 0 || x === 17 || x === w - 18 || x === w - 1)) c = WALNUT[1];
      P.px(x, y, c);
    }
    for (const px0 of [1, w - 17]) for (const dy of [-18, -12, -6]) {
      P.hl(px0, dy, 16, WALNUT[4]); P.hl(px0, dy + 5, 16, WALNUT[1]);
      P.rect(px0 + 6, dy + 2, 4, 1, GOLD); P.px(px0 + 6, dy + 2, GOLD_HI); P.px(px0 + 9, dy + 3, GOLD_LO);
    }
    for (let x = 19; x < w - 19; x += 4) P.vl(x, -17, 15, WALNUT[1]);
    P.hl(0, -1, w, WALNUT[0]);
    // datorskärm (innehållet ritas levande)
    P.rect(8, -26, 10, 2, CHROME[3]); P.hl(8, -26, 10, CHROME[4]); P.rect(12, -31, 2, 5, CHROME[2]); P.px(12, -31, CHROME[4]);
    P.rect(2, -46, 22, 16, 0x16181e); P.hl(2, -46, 22, 0x3a3e48); P.rect(3, -45, 20, 13, 0x0a0c10);
    P.rect(2, -31, 22, 2, CHROME[3]); P.px(12, -30, 0x5a5e68);
    // tangentbord, mus, papper
    P.rect(5, -23, 14, 2, 0xd8dce2); for (let x = 6; x < 18; x += 2) P.px(x, -23, 0xa8acb4); P.hl(5, -21, 14, 0x8a8e96);
    P.rect(21, -23, 2, 2, 0xe8eaee); P.px(21, -23, 0xffffff);
    P.rect(26, -25, 9, 3, 0xffffff); P.rect(27, -26, 9, 3, 0xf6f2ea); P.hl(28, -25, 6, 0xb8b4ae); P.px(34, -26, 0x8a8e96);
    // mugg och pennställ
    P.rect(38, -27, 4, 4, 0xf6f4f0); P.hl(38, -26, 4, NAVY); P.px(42, -26, 0xc8c4bc); P.px(42, -25, 0xc8c4bc); P.hl(39, -27, 2, 0x5a3016);
    P.rect(44, -25, 3, 3, 0x2a2a32); for (const [dx, c] of [[0, 0xd9433b], [1, 0x3a7bd5], [2, 0x1a1a1e]]) P.vl(44 + dx, -28, 3, c);
    // bankirlampa med grön skärm
    const lx = 57;
    P.hl(lx - 3, -24, 7, GOLD_LO); P.hl(lx - 3, -25, 7, GOLD); P.vl(lx, -31, 6, GOLD); P.px(lx - 1, -31, GOLD_HI);
    for (let y = -35; y <= -32; y++) for (let x = lx - 6; x <= lx + 5; x++) P.px(x, y, y === -35 ? 0x5aaa7a : y === -32 ? 0x1a4a2e : 0x2a7a4a);
    P.hl(lx - 5, -36, 10, 0x2a7a4a); P.px(lx - 6, -34, GOLD); P.px(lx + 5, -34, GOLD); P.hl(lx - 5, -31, 10, 0xfff4c0);
    // namnskylt på framkanten
    const nm = 'MÄKLARE', nw = textW(SMALL, nm) + 6, nx = 20;
    P.rect(nx, -29, nw, 8, NAVY); P.box(nx, -29, nw, 8, GOLD); P.hl(nx + 1, -28, nw - 2, NAVY_HI);
    text(P, SMALL, nm, nx + 3, -27, GOLD_HI);
  });
}
function paintBossChair() {
  // chefsstol i konjaksfärgat läder (samma som soffan) så mäklarens mörka kavaj syns mot den
  const C = LEATHER.slice(0, 5);
  return spr(24, 40, 12, 37, (P) => {
    for (let y = -36; y <= -10; y++) for (let x = -9; x <= 9; x++) {
      if (y < -34 && Math.abs(x) > 7 - (y + 36)) continue;
      let v = 0.55 - Math.abs(x) / 30 - (y + 36) / 80 + (x < 0 ? 0.1 : -0.05);
      if ((x + 40) % 6 === 0 && y > -34 && y < -14) v -= 0.18;
      if ((y + 40) % 7 === 0 && Math.abs(x) < 8) v -= 0.1;
      P.px(x, y, tone(C, v, x, y));
    }
    P.hl(-6, -36, 13, C[4]);
    for (let y = -33; y <= -11; y += 2) { P.px(-9, y, GOLD); P.px(9, y, GOLD_LO); } // mässingsnubb längs kanten
    for (const ax of [-11, 8]) { P.rect(ax, -18, 3, 3, C[2]); P.hl(ax, -18, 3, C[4]); P.vl(ax + 1, -15, 4, CHROME[2]); }
  });
}
function paintGuestChair() {
  return spr(20, 30, 10, 27, (P) => {
    // ramstolpar i valnöt, ryggen klädd i marinblått med guldkant
    for (const lx of [-7, 6]) { P.vl(lx, -24, 24, WALNUT[3]); P.vl(lx + 1, -24, 24, WALNUT[1]); P.px(lx, -25, WALNUT[5]); }
    for (let y = -23; y <= -11; y++) for (let x = -6; x <= 5; x++) P.px(x, y, tone(VELVET, 0.55 - (y + 23) / 40 + (x < 0 ? 0.06 : 0), x, y));
    P.hl(-6, -23, 12, GOLD); P.hl(-6, -11, 12, GOLD_LO); P.vl(-6, -23, 13, GOLD); P.vl(5, -23, 13, GOLD_LO);
    P.hl(-8, -10, 17, VELVET[3]); P.hl(-8, -9, 17, VELVET[1]);
    P.hl(-7, -5, 15, WALNUT[2]);
  });
}
function paintFiles() {
  return spr(46, 54, 1, 51, (P) => {
    for (const cx0 of [0, 22]) {
      for (let y = -44; y <= -1; y++) for (let x = cx0; x < cx0 + 20; x++) P.px(x, y, tone(STEEL, 0.72 - (x - cx0) / 20 * 0.4, x, y));
      P.hl(cx0, -44, 20, STEEL[4]); P.vl(cx0 + 19, -44, 44, STEEL[0]);
      for (let k = 0; k < 4; k++) {
        const dy = -43 + k * 10, open = cx0 === 22 && k === 1, oy = open ? 2 : 0;
        if (open) {
          P.rect(cx0 + 2, dy - 1, 16, 3, 0x3a3e48);
          for (let i = 0; i < 6; i++) P.rect(cx0 + 3 + i * 2 + (i % 2), dy - 2 - (i % 2), 2, 2, [0xf0c020, 0x3a7bd5, 0xd9433b, 0x46a35a, 0xf4f1ea, 0xe07a2e][i]);
        }
        P.bevel(cx0 + 1, dy + oy, 18, 9, STEEL[4], STEEL[1]);
        if (open) P.darken(cx0 + 1, dy + 11, 18, 1, 0.7);
        P.rect(cx0 + 7, dy + oy + 2, 6, 3, 0xf6f2ea); P.box(cx0 + 6, dy + oy + 1, 8, 5, STEEL[1]); P.hl(cx0 + 8, dy + oy + 3, 4, 0xa8a4a0);
        P.rect(cx0 + 7, dy + oy + 6, 6, 1, 0x2a2e36); P.hl(cx0 + 7, dy + oy + 7, 6, STEEL[4]);
      }
      P.rect(cx0, -2, 20, 2, 0x2a2e36);
    }
    // pärmar och en suckulent ovanpå
    for (let k = 0; k < 3; k++) { const c = [0x2d3a5c, 0xc9323a, 0xe8b230][k]; P.rect(3, -47 - k * 2, 14 - k * 2, 2, c); P.hl(3, -47 - k * 2, 14 - k * 2, mix(c, 0xffffff, 0.35)); }
    P.rect(30, -48, 6, 4, 0xf4f1ea); P.hl(30, -48, 6, 0xffffff);
    for (const [dx, dy] of [[0, -2], [2, -3], [4, -2], [1, -4], [3, -5], [5, -3]]) P.px(30 + dx, -48 + dy, dx % 2 ? 0x6aaa7a : 0x4a8a5a);
  });
}

function paintBench() {
  // gallerisoffa utan rygg: knappad marinblå sammet på valnötsram med mässingsfötter
  const w = BENCH.w, hw = w >> 1;
  return spr(w + 4, 24, hw + 2, 21, (P) => {
    // bakre ben (kortare, i skugga) och främre ben med mässingshättor
    for (const lx of [-hw + 4, hw - 5]) { P.vl(lx, -6, 3, WALNUT[1]); P.vl(lx + 1, -6, 3, WALNUT[0]); }
    for (const lx of [-hw + 1, hw - 3]) {
      for (let y = -6; y <= -2; y++) { P.px(lx, y, y === -4 ? WALNUT[4] : WALNUT[3]); P.px(lx + 1, y, y === -4 ? WALNUT[2] : WALNUT[1]); }
      P.hl(lx, -1, 2, GOLD); P.px(lx, -1, GOLD_HI);
    }
    // sarg i valnöt med guldintarsia
    for (let y = -9; y <= -6; y++) for (let x = -hw; x < hw; x++) {
      let c = tone(WALNUT, 0.62 - (y + 9) * 0.1 + (hash(x >> 2, y, 101) - 0.5) * 0.12, x, y);
      if (y === -8) c = GOLD;
      P.px(x, y, c);
    }
    P.hl(-hw, -9, w, WALNUT[5]);
    // dynans ovansida: rombknappning i perspektiv
    for (let y = -17; y <= -12; y++) {
      const inset = y === -17 ? 2 : y === -16 ? 1 : 0;
      for (let x = -hw + inset; x < hw - inset; x++) {
        const r = y + 17, a = ((x + r * 2 + 64) % 8 + 8) % 8, b = ((x - r * 2 + 64) % 8 + 8) % 8;
        let v = 0.78 - r * 0.05 - (x + hw) / w * 0.12;
        if (a === 0 || b === 0) v -= 0.18;
        P.px(x, y, tone(VELVET, v, x, y));
        if (a === 0 && b === 0) P.px(x, y, GOLD);
      }
    }
    P.hl(-hw + 2, -17, w - 4, VELVET[5]);
    // dynans framkant: veckad med guldsnodd upptill och nertill
    for (let y = -11; y <= -10; y++) for (let x = -hw; x < hw; x++) {
      let v = 0.46 - (y + 11) * 0.12 - (x + hw) / w * 0.1;
      if ((x + 64) % 4 === 0) v -= 0.15;
      P.px(x, y, tone(VELVET, v, x, y));
    }
    for (let x = -hw; x < hw; x++) P.px(x, -12, (x & 1) ? GOLD : GOLD_HI);
    for (let x = -hw + 1; x < hw - 1; x += 2) P.px(x, -10, GOLD_LO);
    // en bortglömd broschyr på sitsen
    P.rect(12, -16, 7, 3, 0xfbf7ee); P.hl(12, -16, 7, NAVY); P.px(13, -14, 0xd9433b); P.px(15, -14, 0x8a8478); P.px(16, -14, 0x8a8478);
  });
}
function paintEasel() {
  // staffli med visningsskylt och planritning på blåkopia
  return spr(50, 68, 25, 65, (P) => {
    // bakbenet och de två frambenen
    P.line(0, -60, 7, -1, WALNUT[1]); P.line(1, -60, 8, -1, WALNUT[0]);
    P.line(-3, -62, -16, -1, WALNUT[4]); P.line(-2, -62, -15, -1, WALNUT[2]);
    P.line(3, -62, 16, -1, WALNUT[3]); P.line(4, -62, 17, -1, WALNUT[1]);
    P.rect(-3, -64, 8, 2, WALNUT[3]); P.hl(-3, -64, 8, WALNUT[5]);
    // tavlan
    const bx = -20, by = -60, bw = 41, bh = 46;
    P.rect(bx, by, bw, bh, WALNUT[2]); P.bevel(bx, by, bw, bh, WALNUT[5], WALNUT[0]);
    P.rect(bx + 2, by + 2, bw - 4, bh - 4, 0xfbf7ee);
    for (let j = 2; j < bh - 2; j++) for (let i = 2; i < bw - 2; i++) if (hash(bx + i, by + j, 103) > 0.94) P.px(bx + i, by + j, 0xf0e8d8);
    // rubrik
    P.rect(bx + 2, by + 2, bw - 4, 9, NAVY); P.hl(bx + 2, by + 2, bw - 4, NAVY_HI); P.hl(bx + 2, by + 11, bw - 4, GOLD);
    const s = 'VISNING', tw = textW(SMALL, s);
    embossText(P, SMALL, s, bx + Math.floor((bw - tw) / 2), by + 4, GOLD_HI, GOLD, GOLD, NAVY_LO);
    // blåkopian: rum, dörrbågar, fönster, möbler och måttlinjer
    const px0 = bx + 5, py0 = by + 14, pw = bw - 10, ph = 21;
    for (let j = 0; j < ph; j++) for (let i = 0; i < pw; i++) {
      let c = mix(0x1e4a8a, 0x2a5a9e, hash((px0 + i) >> 1, py0 + j, 102) * 0.6);
      if (i % 4 === 0 || j % 4 === 0) c = mix(c, 0x6a9ad8, 0.22);
      P.px(px0 + i, py0 + j, c);
    }
    const L = 0xeaf2ff, BG = 0x24528f;
    P.box(px0 + 2, py0 + 2, pw - 4, ph - 5, L);
    P.vl(px0 + 14, py0 + 2, 10, L); P.hl(px0 + 14, py0 + 11, pw - 16, L); P.hl(px0 + 2, py0 + 9, 8, L);
    P.px(px0 + 14, py0 + 5, BG); P.px(px0 + 14, py0 + 6, BG); P.px(px0 + 15, py0 + 5, L); P.px(px0 + 16, py0 + 6, L); // dörrbåge
    P.hl(px0 + 6, py0 + 9, 2, BG); P.px(px0 + 6, py0 + 10, L); P.px(px0 + 7, py0 + 11, L);
    P.hl(px0 + 20, py0 + 11, 2, BG); P.px(px0 + 20, py0 + 12, L);
    P.hl(px0 + 5, py0 + 2, 5, 0x9ac8f0); P.hl(px0 + 19, py0 + 2, 5, 0x9ac8f0); P.vl(px0 + pw - 3, py0 + 12, 3, 0x9ac8f0); P.vl(px0 + 2, py0 + 12, 2, 0x9ac8f0); // fönster
    P.rect(px0 + 4, py0 + 4, 4, 3, L); P.px(px0 + 5, py0 + 5, BG); // säng
    P.rect(px0 + 17, py0 + 13, 5, 1, L); P.vl(px0 + 17, py0 + 13, 2, L); // soffa
    disc(P, px0 + 9.5, py0 + 13.5, 1.6, 1.6, L); // matbord
    P.rect(px0 + 18, py0 + 4, 3, 3, L); P.px(px0 + 19, py0 + 5, BG); // badkar
    for (let i = 2; i < pw - 2; i++) P.px(px0 + i, py0 + ph - 2, i === 2 || i === pw - 3 ? L : (i & 1) ? 0xb8d0f0 : BG); // måttlinje
    P.box(px0 - 1, py0 - 1, pw + 2, ph + 2, 0x8a8478);
    // dag och tid
    const d = 'SÖN 13-15', dw = textW(SMALL, d);
    text(P, SMALL, d, bx + Math.floor((bw - dw) / 2), by + 38, 0xc9323a);
    // stafflihyllan med broschyrer och en visitkortshållare
    P.rect(bx - 2, by + bh, bw + 4, 3, WALNUT[3]); P.hl(bx - 2, by + bh, bw + 4, WALNUT[5]); P.hl(bx - 2, by + bh + 2, bw + 4, WALNUT[0]);
    for (let k = 0; k < 3; k++) { P.rect(bx + 3 + k, by + bh - 3 + k, 8, 1, k === 0 ? NAVY : 0xfbf7ee); P.px(bx + 10 + k, by + bh - 3 + k, 0xc8c0b0); }
    P.rect(bx + bw - 10, by + bh - 2, 6, 2, GOLD); P.hl(bx + bw - 10, by + bh - 2, 6, GOLD_HI); P.rect(bx + bw - 9, by + bh - 4, 4, 2, 0xffffff);
  });
}
function paintBoxes() {
  // flyttkartonger med tejp, pilar och en krukväxt som sticker upp
  const CARD = [0x5a3a1a, 0x8a5e30, 0xb88a4e, 0xd6aa6a, 0xecc890];
  return spr(40, 44, 20, 41, (P) => {
    const box = (x0, y0, w, h, lbl, flip) => {
      // framsida
      for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) {
        let v = 0.55 - (y - y0) / h * 0.12 - (x - x0) / w * 0.12 + (hash(x >> 1, y >> 1, 104) - 0.5) * 0.08;
        P.px(x, y, tone(CARD, v, x, y));
      }
      // ovansida i perspektiv
      for (let j = 0; j < 3; j++) for (let x = x0 + (2 - j); x < x0 + w + (2 - j) - 2; x++) P.px(x, y0 - 3 + j, j === 0 ? CARD[4] : CARD[3]);
      // tejp och flikar
      const tx = x0 + (w >> 1) - 1;
      P.rect(tx, y0 - 3, 3, 4 + 2, 0xd8c8a0); P.vl(tx + 2, y0 - 3, 6, 0xb8a47c);
      P.hl(x0 + 1, y0 - 2, w - 2, CARD[2]);
      P.vl(x0 + w - 1, y0, h, CARD[1]); P.hl(x0, y0 + h - 1, w, CARD[1]);
      // märkning
      if (lbl) {
        const lw = textW(SMALL, lbl);
        text(P, SMALL, lbl, x0 + Math.floor((w - lw) / 2), y0 + 4, 0x2a1a10);
      }
      // handtagshål och en tejpbit över kanten
      const hx = flip ? x0 + w - 5 : x0 + 2;
      P.hl(hx, y0 + h - 4, 3, CARD[0]); P.hl(hx, y0 + h - 3, 3, CARD[3]);
      P.hl(x0, y0 + h - 1, 2, 0xd8c8a0);
    };
    // en krukväxt som sticker upp ur den översta lådan (bakom)
    P.vl(5, -36, 8, LEAF[1]); P.line(5, -33, 1, -37, LEAF[1]); P.line(5, -32, 9, -36, LEAF[1]);
    for (const [lx, ly] of [[1, -39], [9, -38], [5, -41], [-1, -35], [11, -34], [3, -36], [7, -35]]) {
      for (let y = -2; y <= 1; y++) for (let x = -2; x <= 2; x++) if (x * x / 5 + y * y / 3 <= 1) P.px(lx + x, ly + y, tone(LEAF, 0.7 - y * 0.12 - x * 0.04, lx + x, ly + y));
    }
    box(-17, -13, 18, 13, 'KÖK', false);
    box(2, -12, 15, 12, '', true);
    // röd "ömtåligt"-symbol (ett vinglas) på den högra lådan
    P.hl(6, -9, 5, 0xc9323a); P.hl(7, -8, 3, 0xc9323a); P.px(8, -7, 0xc9323a); P.px(8, -6, 0xc9323a); P.hl(7, -5, 3, 0xc9323a); P.px(6, -9, 0xf08080);
    box(-12, -26, 24, 12, 'FLYTT', false);
    // rulle med packtejp ovanpå
    disc(P, -12, -29, 2.6, 1.6, 0xd8c8a0); P.px(-12, -29, 0x8a7a5a);
  });
}
function paintPampas() {
  // hög marinblå keramikvas med guldkant och yviga pampasvippor
  const CR = [0x9a8660, 0xc4ac80, 0xe2d0a8, 0xf4ead2, 0xfffaf0];
  return spr(36, 66, 18, 63, (P) => {
    const plumes = [[-11, -44, -0.6], [-5, -50, -0.25], [1, -52, 0.05], [7, -48, 0.35], [12, -40, 0.7], [-13, -35, -0.9], [0, -43, 0], [-7, -40, -0.4], [6, -38, 0.45]];
    for (const [px2, py2] of plumes) P.line(0, -27, Math.round(px2 * 0.8), py2 + 7, 0xc8b480);
    // några gröna grässtrån mellan vipporna
    P.line(-1, -27, -6, -33, 0x6a8a4a); P.line(1, -27, 5, -34, 0x5a7a3a); P.line(0, -27, -2, -36, 0x7a9a5a);
    for (const [px2, py2, lean] of plumes) {
      for (let j = -8; j <= 8; j++) for (let i = -3; i <= 3; i++) {
        const x = px2 + i + Math.round(j * lean * 0.5), y = py2 + j;
        const e = (i / 3.2) ** 2 + (j / 8.5) ** 2;
        if (e > 1 || (e > 0.6 && hash(x, y, 105) > 0.55)) continue;
        P.px(x, y, tone(CR, 0.85 - i * 0.1 - (j + 8) * 0.025 + (hash(x, y, 106) - 0.5) * 0.25, x, y));
      }
    }
    // vasen: smal fot, rund buk, lång hals
    for (let y = -28; y <= -1; y++) {
      const t = (y + 28) / 27;
      const r = t < 0.35 ? 2.5 + t * 2 : 3.2 + Math.sin(((t - 0.35) / 0.65) * Math.PI) * 3.6 - (t > 0.92 ? 0.8 : 0);
      for (let x = -Math.round(r); x <= Math.round(r); x++) {
        const v = 0.85 - (x + r) / (2 * r + 1) * 0.7;
        P.px(x, y, tone(VELVET, v, x, y));
      }
      if ((y + 28) % 9 === 5) { const rr = Math.round(r); P.px(-rr + 1, y, VELVET[5]); }
    }
    P.hl(-3, -28, 7, GOLD_HI); P.hl(-3, -27, 7, GOLD); P.hl(-2, -26, 5, GOLD_LO);
    for (let x = -6; x <= 6; x++) if (Math.abs(x) <= 6) P.px(x, -12, x < -2 ? GOLD_HI : x > 3 ? GOLD_LO : GOLD);
    P.hl(-3, -1, 7, GOLD_LO); P.hl(-3, -2, 7, GOLD);
    P.px(-3, -18, 0xffffff, 0.7); P.px(-3, -17, 0xffffff, 0.4);
  });
}
function paintUmbrellas() {
  // paraplyställ i mässing med två paraplyn
  return spr(16, 34, 8, 31, (P) => {
    // paraplyerna (bakom stället)
    P.vl(-2, -26, 12, 0x1f2d48); P.vl(-1, -24, 10, 0x2e4470); P.px(-3, -20, 0x1f2d48); P.px(0, -18, 0x1f2d48);
    P.vl(-2, -29, 3, WALNUT[3]); P.px(-3, -30, WALNUT[3]); P.px(-4, -30, WALNUT[4]); P.px(-5, -29, WALNUT[3]); P.px(-5, -28, WALNUT[2]);
    P.vl(2, -22, 9, 0xc9323a); P.vl(3, -21, 7, 0x9a1a22); P.px(1, -17, 0xc9323a); P.px(4, -15, 0x9a1a22);
    P.vl(2, -25, 3, 0x2a2a30); P.px(3, -26, 0x2a2a30); P.px(4, -26, 0x2a2a30); P.px(5, -25, 0x2a2a30);
    // stället: smal mässingscylinder med öppning upptill och två ringar
    for (let y = -15; y <= -1; y++) for (let x = -4; x <= 4; x++) {
      let v = 0.9 - (x + 4) / 9 * 0.7 + (x === -3 ? 0.12 : 0);
      if (y === -6 || y === -12) v -= 0.3;
      if (y === -7 || y === -13) v += 0.15;
      P.px(x, y, tone([GOLD_LO, 0xb08a3a, GOLD, 0xecd488, GOLD_HI], v, x, y));
    }
    P.hl(-3, -16, 7, GOLD_HI); P.hl(-3, -15, 7, 0x3a2a10); P.px(-4, -15, GOLD); P.px(4, -15, GOLD_LO); // öppningen
    P.px(-1, -15, 0x1f2d48); P.px(2, -15, 0x9a1a22);
    P.hl(-4, -1, 9, 0x5a4418);
  });
}
function paintDollhouse() {
  // dockskåp med öppen framsida: sovrum och badrum uppe, kök och vardagsrum nere,
  // tegeltak med takfönster och skorsten – och byggklossar och en boll framför
  const FR = [0xa89e8c, 0xd8d0c0, 0xf0eadc, 0xfffcf4];
  const TILE = [0x5a1612, 0x8a2622, 0xb8402e, 0xd8664a, 0xf0906a];
  return spr(52, 50, 24, 46, (P) => {
    // sockel i valnöt
    for (let x = -18; x <= 17; x++) { P.px(x, -2, x < -10 ? WALNUT[5] : WALNUT[4]); P.px(x, -1, WALNUT[2]); }
    P.hl(-18, 0, 36, WALNUT[0]);
    // stommen: vitmålade väggar och bjälklag
    for (let y = -29; y <= -3; y++) for (let x = -16; x <= 15; x++) P.px(x, y, tone(FR, 0.8 - (x + 16) / 32 * 0.35, x, y));
    const room = (x0, y0, w, h, wall, fn) => {
      for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) P.px(x, y, wall(x, y));
      fn();
      P.darken(x0, y0, w, 1, 0.72); P.darken(x0, y0 + 1, w, 1, 0.86); P.darken(x0, y0, 1, h, 0.84); // skugga under taket och vid väggen
    };
    // uppe till vänster: sovrum med rosa randig tapet, fönster, säng med lapptäcke och en tavla
    room(-14, -27, 13, 11, (x) => ((x + 40) % 3 === 0 ? 0xe8a8b8 : 0xf6cad2), () => {
      P.hl(-14, -17, 13, 0xb07444); P.px(-10, -17, 0x8c5630); P.px(-5, -17, 0x8c5630);
      P.rect(-12, -25, 5, 4, 0x9ad0f0); P.px(-12, -25, 0xffffff); P.vl(-10, -25, 4, 0xffffff); P.hl(-12, -23, 5, 0xffffff); P.box(-13, -26, 7, 6, 0xfffcf4);
      P.vl(-13, -21, 4, WALNUT[3]); P.px(-13, -22, WALNUT[4]);
      P.hl(-12, -20, 8, 0xffffff); P.rect(-12, -21, 2, 1, 0xfffcf4);
      for (let x = -10; x <= -5; x++) { P.px(x, -19, (x & 1) ? 0xd9433b : 0xfbf7ee); P.px(x, -18, (x & 1) ? 0xfbf7ee : 0xd9433b); }
      P.px(-5, -18, WALNUT[2]);
      P.box(-5, -26, 4, 4, GOLD); P.rect(-4, -25, 2, 2, 0x5a9e46);
    });
    // uppe till höger: badrum med kakel, badkar på lejontassar, badanka, spegel och handduk
    room(1, -27, 13, 11, (x, y) => ((x % 3 === 0) || ((y + 27) % 3 === 0) ? 0xa8cce0 : 0xd4ecf4), () => {
      for (let x = 1; x < 14; x++) P.px(x, -17, (x & 1) ? 0xfbf7ee : 0x6a9ac8);
      P.rect(3, -21, 8, 3, 0xfbf7ee); P.hl(3, -21, 8, 0xffffff); P.hl(4, -21, 6, 0x5aa0e0); P.hl(3, -18, 8, 0xc8c4bc);
      P.px(3, -18, GOLD); P.px(10, -18, GOLD); P.px(7, -22, 0xf0d048); P.px(6, -22, 0xe8a030);
      P.rect(11, -25, 2, 3, 0xe8f4fa); P.px(11, -25, 0xffffff); P.box(10, -26, 4, 5, 0xc8ccd4);
      P.rect(1, -24, 2, 4, 0xf0c020); P.px(2, -24, 0xd8a010);
    });
    // nere till vänster: kök med mintgrön tapet, spis med kastrull, hylla med tallrikar och bord
    room(-14, -14, 13, 10, (x, y) => (((x + y) & 3) === 0 ? 0xa8d4bc : 0xc8e8d6), () => {
      for (let x = -14; x < -1; x++) P.px(x, -5, ((x + 40) & 1) ? 0x2a2430 : 0xfbf7ee);
      P.rect(-13, -10, 5, 5, 0xfbf7ee); P.hl(-13, -10, 5, 0x2a2a30); P.rect(-12, -8, 3, 2, 0x3a3e48); P.px(-12, -8, 0x8a8e96);
      P.rect(-12, -12, 3, 2, 0x9aa0a8); P.hl(-12, -12, 3, 0xc8ced6); P.px(-11, -13, 0xffffff, 0.6);
      P.hl(-8, -12, 6, WALNUT[3]); for (const [dx, c] of [[0, 0x3a7bd5], [2, 0xd9433b], [4, 0xf0c020]]) P.px(-8 + dx, -13, c);
      P.hl(-7, -8, 5, 0xd9433b); P.px(-6, -8, 0xfbf7ee); P.px(-4, -8, 0xfbf7ee); P.vl(-7, -7, 2, WALNUT[2]); P.vl(-3, -7, 2, WALNUT[2]);
      P.px(-5, -9, 0xf4f1ea); P.px(-4, -9, 0xe07a2e);
    });
    // nere till höger: vardagsrum med gul prickig tapet, blå soffa, golvlampa, tavla och en docka
    room(1, -14, 13, 10, (x, y) => ((x % 4 === 1 && (y + 14) % 3 === 1) ? 0xd8b060 : 0xf4dea4), () => {
      P.hl(1, -5, 13, 0xb07444); P.px(5, -5, 0x8c5630); P.px(10, -5, 0x8c5630);
      P.rect(2, -9, 7, 2, VELVET[2]); P.hl(2, -9, 7, VELVET[4]); P.rect(2, -7, 7, 1, VELVET[3]); P.vl(2, -9, 3, VELVET[1]); P.vl(8, -9, 3, VELVET[1]); P.px(2, -6, WALNUT[1]); P.px(8, -6, WALNUT[1]);
      P.box(3, -13, 5, 3, GOLD); P.px(4, -12, 0x5aa0de); P.px(5, -12, 0x8cc462); P.px(6, -12, 0x5aa0de);
      P.vl(10, -12, 7, GOLD_LO); P.hl(9, -13, 3, 0xf4ead0); P.hl(9, -14, 3, 0xe0d0b0);
      P.px(12, -9, 0xe0a97f); P.px(12, -10, 0x6a3a1e); P.vl(12, -8, 2, 0xd9433b); P.px(12, -6, 0x2a2430);
    });
    // mellanväggen och bjälklaget med lister
    P.vl(-1, -27, 23, FR[3]); P.vl(0, -27, 23, FR[1]);
    P.hl(-16, -16, 32, FR[3]); P.hl(-16, -15, 32, FR[1]);
    P.hl(-16, -4, 32, FR[3]); P.hl(-16, -3, 32, FR[0]);
    P.vl(-16, -29, 27, FR[3]); P.vl(15, -29, 27, FR[0]);
    // taket: tegelpannor i rader, vita vindskivor, runt takfönster och skorsten
    P.rect(7, -42, 4, 8, 0xa8402e); P.vl(7, -42, 8, 0xd06040); P.hl(6, -43, 6, FR[3]); P.hl(6, -42, 6, FR[1]); P.px(8, -39, 0x6a1a1a); P.px(9, -37, 0x6a1a1a);
    for (let r = 0; r <= 12; r++) {
      const y = -30 - r, half = Math.round(18 - r * 1.45);
      for (let x = -half; x < half; x++) {
        let v = 0.72 - r * 0.02 - (x > 0 ? 0.16 : 0);
        if ((r & 1) === 0) v -= 0.12;
        if (((x + (r & 2 ? 2 : 0) + 40) % 4) === 0) v -= 0.1;
        P.px(x, y, tone(TILE, v, x, y));
      }
      P.px(-half, y, FR[3]); P.px(half - 1, y, FR[1]);
      if (r === 0) P.hl(-half, y, half * 2, FR[2]);
    }
    disc(P, 0, -35, 3.2, 3.2, FR[3]); disc(P, 0, -35, 2.2, 2.2, 0x2a3450); P.px(-1, -36, 0x9ad0f0); P.px(0, -36, 0x6a90b8);
    // byggklossar och en boll på mattan
    const block = (x, y, c, dot) => { P.rect(x, y, 4, 4, c); P.hl(x, y, 4, mix(c, 0xffffff, 0.4)); P.vl(x + 3, y + 1, 3, mul(c, 0.7)); P.px(x + 1, y + 1, dot); P.px(x + 2, y + 2, dot); };
    block(18, -4, 0xd9433b, 0xfbf7ee); block(23, -4, 0x3a7bd5, 0xf0d048); block(20, -8, 0xf0c020, 0x2a5a48);
    disc(P, -20.5, -2.5, 2.6, 2.6, 0xd9433b); P.hl(-23, -3, 5, 0xfbf7ee); P.px(-21, -4, 0xffffff);
  });
}
function paintBrochures() {
  // fristående broschyrställ i valnöt: tre plexifack med broschyrer om bostäderna och en TA EN!-skylt
  const COV = [[0x3a7bd5, 0xf4f1ea], [0xc9323a, 0xf0c020], [0x2a5a48, 0xecd488], [0xf28bb3, 0xffffff], [0xe07a2e, 0x2d3a5c], [0x1f2d48, 0xd8b45a], [0x46a35a, 0xf4f1ea], [0x8e5bd1, 0xf0e0c0], [0xf0c020, 0x2a2430]];
  return spr(34, 60, 17, 57, (P) => {
    // fot och stolpe i krom
    for (let x = -8; x <= 8; x++) { P.px(x, -1, x < 0 ? 0x2a2a30 : 0x1a1a1e); P.px(x, -2, x < -3 ? 0x7a7a84 : 0x4a4a54); }
    P.vl(-1, -11, 9, CHROME[3]); P.vl(0, -11, 9, CHROME[1]); P.px(-1, -11, CHROME[4]);
    // bakstycket
    const bx = -10, bw = 20, by = -46, bh = 36;
    for (let y = by; y < by + bh; y++) for (let x = bx; x < bx + bw; x++) P.px(x, y, tone(WALNUT, 0.55 - (x - bx) / bw * 0.3 + (hash(x >> 2, y, 110) - 0.5) * 0.1, x, y));
    P.bevel(bx, by, bw, bh, WALNUT[5], WALNUT[0]);
    for (let r = 0; r < 3; r++) {
      const fy = by + 2 + r * 11;
      for (let c = 0; c < 3; c++) {
        const [c1, c2] = COV[(r * 3 + c) % COV.length], fx = bx + 2 + c * 6;
        // omslaget: ett litet hus, rubrikrad och prickar
        P.rect(fx, fy, 5, 9, c1); P.hl(fx, fy, 5, mix(c1, 0xffffff, 0.35)); P.vl(fx + 4, fy + 1, 8, mul(c1, 0.72));
        P.px(fx + 2, fy + 1, c2); P.hl(fx + 1, fy + 2, 3, c2); P.rect(fx + 1, fy + 3, 3, 2, c2); P.px(fx + 2, fy + 4, c1);
        P.hl(fx + 1, fy + 6, 3, c2); P.px(fx + 1, fy + 8, mix(c1, 0xffffff, 0.5)); P.px(fx + 3, fy + 8, mix(c1, 0xffffff, 0.5));
      }
      // plexifacket täcker broschyrernas nedre halva
      for (let y = fy + 5; y < fy + 10; y++) for (let x = bx + 1; x < bx + bw - 1; x++) P.px(x, y, 0xd8eef8, 0.24);
      P.hl(bx + 1, fy + 5, bw - 2, 0xffffff, 0.8); P.hl(bx + 1, fy + 10, bw - 2, 0x7a90a0);
      for (let k = 0; k < 3; k++) P.px(bx + 3 + k * 6 + r, fy + 7 + (k & 1), 0xffffff, 0.8);
    }
    // skylten ovanpå
    const s = 'TA EN!', sw = textW(SMALL, s) + 6, sx = -Math.floor(sw / 2), sy = by - 10;
    P.vl(-6, sy + 9, 1, GOLD_LO); P.vl(5, sy + 9, 1, GOLD_LO);
    P.rect(sx, sy, sw, 9, NAVY); P.box(sx, sy, sw, 9, GOLD); P.hl(sx + 1, sy + 1, sw - 2, NAVY_HI);
    embossText(P, SMALL, s, sx + 3, sy + 2, GOLD_HI, GOLD, GOLD, NAVY_LO);
  });
}
function paintSideTable() {
  // runt sidobord med marmorskiva på svarvad valnötsfot: mässingslampa med veckad skärm och godisskål
  const MARBLE = [0xb8b4ae, 0xdcd8d0, 0xeeeae4, 0xfbf9f5];
  return spr(30, 42, 15, 39, (P) => {
    P.hl(-6, -1, 13, WALNUT[1]); P.hl(-5, -2, 11, WALNUT[3]); P.px(-6, -2, WALNUT[4]); P.px(6, -2, WALNUT[2]); P.px(-7, -1, WALNUT[2]); P.px(7, -1, WALNUT[0]);
    for (let y = -13; y <= -3; y++) { P.px(-1, y, WALNUT[4]); P.px(0, y, WALNUT[3]); P.px(1, y, WALNUT[1]); }
    P.hl(-2, -9, 5, WALNUT[5]); P.hl(-2, -8, 5, WALNUT[1]); P.hl(-2, -4, 5, WALNUT[4]);
    // skivans kant och ovansida (ellips i perspektiv) med ådring
    for (let x = -10; x <= 10; x++) { if (Math.abs(x) === 10) continue; P.px(x, -14, WALNUT[4]); P.px(x, -13, WALNUT[2]); }
    for (let y = -18; y <= -14; y++) for (let x = -11; x <= 11; x++) {
      const e = (x / 10.6) ** 2 + ((y + 16) / 2.6) ** 2;
      if (e > 1) continue;
      let c = tone(MARBLE, 0.9 - (y + 18) * 0.1 - (x + 10) / 60, x, y);
      if (Math.abs(((x * 0.7 + y * 2 + 400) % 9) - 4.5) < 0.5) c = mix(c, 0x9a949a, 0.3);
      P.px(x, y, c);
    }
    // lampan: rund fot, stång och veckad skärm
    P.hl(-7, -17, 5, GOLD_LO); P.hl(-7, -18, 5, GOLD); P.px(-7, -18, GOLD_HI);
    P.vl(-5, -26, 8, GOLD); P.px(-6, -26, GOLD_HI); P.px(-4, -22, GOLD_LO);
    for (let y = -34; y <= -27; y++) {
      const half = 2 + Math.round((y + 34) * 0.55);
      for (let x = -5 - half; x <= -5 + half; x++) P.px(x, y, ((x + 40) & 1) ? 0xf4ead0 : (x < -5 ? 0xfaf2de : 0xe0d0b0));
    }
    P.hl(-7, -35, 5, GOLD); P.hl(-10, -27, 11, 0xd8c8a0); P.hl(-9, -26, 9, 0xfff4c0);
    // glasskål med inslagna karameller och polkagrisar
    for (let y = -21; y <= -18; y++) for (let x = 1; x <= 9; x++) {
      const e = ((x - 5) / 4.6) ** 2 + ((y + 21) / 3.6) ** 2;
      if (e > 1 || y < -21) continue;
      P.px(x, y, 0xd8eef8, 0.55);
    }
    P.hl(1, -21, 9, 0xffffff, 0.8); P.px(4, -18, 0xffffff, 0.8); P.hl(3, -17, 5, 0xa8c0cc);
    for (const [cx, cy, c] of [[3, -22, 0xd9433b], [5, -23, 0x46a35a], [7, -22, 0xf0c020], [4, -21, 0x3a7bd5], [6, -21, 0xf28bb3], [8, -21, 0xe07a2e]]) {
      P.px(cx, cy, c); P.px(cx - 1, cy, mix(c, 0xffffff, 0.5), 0.9); P.px(cx + 1, cy, mix(c, 0xffffff, 0.5), 0.9);
    }
    P.px(5, -24, 0xfbf7ee); P.px(5, -25, 0xd9433b); // en polkagris sticker upp
    // en tidskrift på skivans framkant
    P.rect(-2, -15, 6, 2, 0xfbf7ee); P.hl(-2, -15, 6, 0x3a7bd5); P.px(2, -14, 0xd9433b);
  });
}
function paintPrinter() {
  // låg sideboard i valnöt med laserskrivare, papperspacke och en liten suckulent
  const PR = [0x5a5e68, 0x8a8e96, 0xb8bcc4, 0xdcdfe4, 0xf4f5f7];
  return spr(40, 38, 20, 35, (P) => {
    const w = 34, x0 = -17;
    for (let y = -16; y <= -2; y++) for (let x = x0; x < x0 + w; x++) P.px(x, y, tone(WALNUT, 0.5 - (y + 16) / 70 + (hash(x >> 1, y >> 3, 111) - 0.5) * 0.1, x, y));
    P.rect(x0 - 1, -18, w + 2, 2, WALNUT[4]); P.hl(x0 - 1, -18, w + 2, WALNUT[5]); P.hl(x0 - 1, -16, w + 2, WALNUT[0]);
    P.box(x0 + 2, -14, 14, 11, WALNUT[2]); P.box(x0 + 18, -14, 14, 11, WALNUT[2]);
    P.hl(x0 + 3, -13, 12, WALNUT[4]); P.hl(x0 + 19, -13, 12, WALNUT[4]);
    P.px(x0 + 14, -9, GOLD_HI); P.px(x0 + 14, -8, GOLD_LO); P.px(x0 + 20, -9, GOLD_HI); P.px(x0 + 20, -8, GOLD_LO);
    P.hl(x0, -1, w, WALNUT[0]); P.px(x0 + 1, 0, WALNUT[0]); P.px(x0 + w - 2, 0, WALNUT[0]);
    // skrivaren: ljusgrå låda, pappersfack bak, springa, panel med display
    const px0 = -13, pw = 20;
    for (let y = -27; y <= -19; y++) for (let x = px0; x < px0 + pw; x++) P.px(x, y, tone(PR, 0.9 - (x - px0) / pw * 0.35 - (y + 27) / 28, x, y));
    P.hl(px0, -27, pw, PR[4]); P.vl(px0 + pw - 1, -27, 9, PR[1]); P.hl(px0, -19, pw, PR[0]);
    P.rect(px0 + 3, -31, 12, 4, 0xffffff); P.vl(px0 + 14, -31, 4, 0xd8d4cc); P.hl(px0 + 4, -30, 8, 0xe8e6e0);
    P.hl(px0 + 2, -28, 14, PR[2]);
    P.hl(px0 + 2, -23, 12, 0x1a1c22); P.hl(px0 + 2, -22, 12, PR[3]);
    P.rect(px0 + 14, -26, 5, 2, 0x1e2a22); P.px(px0 + 15, -26, 0x6fe08a); P.px(px0 + 16, -26, 0x6fe08a); P.px(px0 + 17, -25, 0x3a8a54);
    P.px(px0 + 15, -22, PR[1]); P.px(px0 + 17, -22, PR[1]);
    // papperspacke med blått band
    P.rect(9, -24, 6, 6, 0xf8f6f0); P.hl(9, -24, 6, 0xffffff); P.vl(14, -23, 5, 0xd8d4cc);
    P.rect(9, -22, 6, 2, 0x3a7bd5); P.hl(9, -22, 6, 0x6a9ae5);
    // suckulent i vit kruka
    P.rect(11, -28, 4, 3, 0xf4f1ea); P.hl(11, -28, 4, 0xffffff);
    for (const [dx, dy] of [[0, -2], [1, -3], [2, -2], [3, -3], [1, -1], [2, -4]]) P.px(11 + dx, -28 + dy, dx % 2 ? LEAF[4] : LEAF[3]);
  });
}
function paintBin() {
  // papperskorg i svart metallnät vid skrivbordet, full av skrynkliga utkast –
  // pappret skymtar genom nätet, och ett utkast har missat och ligger på golvet
  const M = [0x16161c, 0x2c2c34, 0x484850, 0x6a6a76, 0x8e8e9a];
  return spr(28, 24, 13, 20, (P) => {
    for (let y = -14; y <= -1; y++) {
      const r = y > -6 ? 4 : 5;                          // lite smalare nertill
      for (let x = -r; x <= r; x++) {
        const wire = ((x + 40) & 1) === 0 || ((y + 40) & 1) === 0;
        const shade = 0.9 - (x + r) / (2 * r + 1) * 0.75;
        // genom maskorna: papper i övre halvan, mörkt inuti längre ner
        P.px(x, y, wire ? tone(M, shade, x, y) : y < -8 ? (x < 1 ? 0xe8e4dc : 0xb8b4ae) : (x < 1 ? 0x2a2a30 : 0x1a1a20));
      }
      P.px(-r, y, M[4]); P.px(r, y, M[0]);
    }
    // kanten uppe (ring i perspektiv) och foten
    P.hl(-6, -15, 13, M[3]); P.hl(-5, -16, 11, M[4]); P.px(-5, -16, 0xb8b8c4); P.hl(-4, -14, 9, 0x3a3a44);
    P.hl(-5, -1, 11, M[0]); P.hl(-4, 0, 9, M[1]); P.px(-5, 0, M[2]);
    // skrynkliga papper som sticker upp över kanten
    const ball = (cx, cy, r, c) => { disc(P, cx, cy, r, r, c); P.px(Math.round(cx) - 1, Math.round(cy) - 1, 0xffffff); P.px(Math.round(cx), Math.round(cy), 0xb8b4ae); P.px(Math.round(cx) + 1, Math.round(cy), 0xc8c4bc); P.px(Math.round(cx), Math.round(cy) + 1, 0xd8d4cc); };
    ball(-2, -16, 2.2, 0xf6f4f0); ball(2, -17, 2.4, 0xfbf7ee); ball(0, -15, 1.6, 0xf0e8d0);
    P.px(1, -19, 0xe8e4dc); P.px(-3, -18, 0xe8e4dc); // hörn som sticker ut
    // utkastet som missade – ligger på golvet bredvid
    ball(-10, -1, 1.9, 0xfbf7ee); P.px(-12, 0, 0xd8d4cc); P.px(-8, 0, 0xd8d4cc);
  });
}
function paintSign() {
  // TILL SALU-skylt på stolpe i en tung gjutjärnsfot, med en röd SÅLT!-lapp över
  return spr(40, 50, 20, 47, (P) => {
    P.hl(-9, -1, 15, 0x1a1a1e); P.hl(-8, -2, 13, 0x3a3a44); P.hl(-8, -3, 13, 0x4a4a54); P.hl(-8, -3, 4, 0x7a7a84);
    // stolpen och armen i valnöt
    P.vl(-6, -45, 42, WALNUT[4]); P.vl(-5, -45, 42, WALNUT[2]); P.px(-6, -46, WALNUT[5]); P.px(-5, -46, WALNUT[3]);
    P.hl(-6, -43, 23, WALNUT[4]); P.hl(-6, -42, 23, WALNUT[1]); P.px(17, -43, WALNUT[5]);
    P.vl(-2, -41, 3, CHROME[2]); P.vl(14, -41, 3, CHROME[2]); P.px(-2, -41, CHROME[4]); P.px(14, -41, CHROME[4]);
    // själva skylten
    const sx = -4, sy = -38, sw = 21, sh = 23;
    P.rect(sx, sy, sw, sh, NAVY); P.box(sx, sy, sw, sh, GOLD); P.hl(sx + 1, sy + 1, sw - 2, NAVY_HI); P.hl(sx + 1, sy + sh - 2, sw - 2, NAVY_LO);
    for (const [s, yy] of [['TILL', sy + 3], ['SALU', sy + 10]]) embossText(P, SMALL, s, sx + Math.floor((sw - textW(SMALL, s)) / 2), yy, GOLD_HI, GOLD, GOLD, NAVY_LO);
    // SÅLT!-lappen, lite snett påklistrad
    for (let x = sx - 2; x < sx + sw + 2; x++) {
      const top = sy + 16 + (x < sx + 10 ? 1 : 0);
      for (let y = top; y < top + 7; y++) P.px(x, y, y === top ? 0xf06a60 : y === top + 6 ? 0x8a1a20 : 0xc9323a);
    }
    const lbl = 'SÅLT!', lx = sx + Math.floor((sw - textW(SMALL, lbl)) / 2);
    text(P, SMALL, lbl, lx, sy + 18, 0xffffff);
  });
}
function paintDog(breath, awake) {
  // tax som ligger ihoprullad på en rund dyna i en flätad korg (svansen ritas levande)
  const BROWN = [0x2a1206, 0x4e240e, 0x7a3e1a, 0xa45e2c, 0xcc8a4c, 0xe8b074];
  const CREAM = [0x8a7a60, 0xc8b894, 0xe8dcc0, 0xf8f0dc, 0xffffff];
  return spr(40, 22, 19, 19, (P) => {
    // korgen: flätad rotting
    for (let y = -11; y <= -1; y++) for (let x = -17; x <= 17; x++) {
      const e = (x / 17.5) ** 2 + ((y + 5.5) / 5.8) ** 2;
      if (e > 1) continue;
      let c = ((x * 2 + y * 3 + 90) % 5 < 2) ? 0x9a6a32 : ((x * 2 - y * 3 + 90) % 5 < 1) ? 0xe0bc7c : 0xc0985a;
      if (y > -5) c = mul(c, 0.82 + (y + 5) * -0.02);
      if (y === -11 || e > 0.86 && y < -6) c = mix(c, 0xffe8b8, 0.35);
      P.px(x, y, c);
    }
    // krämvit dyna med marinblå kantband
    for (let y = -10; y <= -3; y++) for (let x = -14; x <= 14; x++) {
      const e = (x / 14.5) ** 2 + ((y + 6.5) / 3.9) ** 2;
      if (e > 1) continue;
      P.px(x, y, e > 0.8 ? (y > -6 ? NAVY : NAVY_HI) : tone(CREAM, 0.72 - (y + 10) * 0.07 + (x < 0 ? 0.05 : 0), x, y));
    }
    // kroppen
    const top = breath ? -14 : -13, bcy = (top - 5) / 2, bry = (-5 - top) / 2 + 0.8;
    for (let y = top; y <= -5; y++) for (let x = -6; x <= 11; x++) {
      const e = ((x - 2.5) / 9.2) ** 2 + ((y - bcy) / bry) ** 2;
      if (e > 1) continue;
      let v = 0.82 - (y - top) * 0.09 - (x - 2) / 50;
      if (y === top || (e > 0.7 && y < bcy)) v += 0.12;
      P.px(x, y, tone(BROWN, v, x, y));
    }
    // bakben och framtassar
    P.rect(6, -7, 5, 2, BROWN[1]); P.hl(6, -7, 4, BROWN[2]); P.px(11, -6, BROWN[3]);
    P.hl(-9, -5, 5, BROWN[3]); P.hl(-9, -6, 4, BROWN[4]); P.px(-10, -5, BROWN[2]);
    // huvudet vilar på tassarna (lyfts när den är vaken)
    const hy = awake ? -12 : -9;
    for (let y = hy - 3; y <= hy + 2; y++) for (let x = -11; x <= -4; x++) {
      if ((x === -11 || x === -4) && (y === hy - 3 || y === hy + 2)) continue;
      P.px(x, y, tone(BROWN, 0.9 - (y - hy + 3) * 0.1 - (x + 11) * 0.02, x, y));
    }
    // lång nos med svart tryffel
    P.hl(-15, hy, 4, BROWN[4]); P.hl(-15, hy + 1, 4, BROWN[3]); P.hl(-14, hy + 2, 3, BROWN[2]); P.px(-16, hy, 0x140a06); P.px(-16, hy + 1, 0x140a06);
    // hängöra
    P.rect(-7, hy - 2, 3, 5, BROWN[1]); P.vl(-7, hy - 2, 5, BROWN[2]); P.px(-6, hy + 3, BROWN[0]); P.px(-5, hy + 3, BROWN[1]);
    // ögat: öppet och blankt eller stängt
    if (awake) { P.px(-10, hy - 1, 0x140a06); P.px(-9, hy - 1, 0x140a06); P.px(-10, hy - 2, 0xffffff); }
    else { P.hl(-10, hy - 1, 2, BROWN[0]); P.px(-11, hy - 1, BROWN[1]); }
    // rött halsband med guldbricka
    P.vl(-4, hy - 2, 5, 0xc9323a); P.vl(-3, hy - 2, 5, 0x8a1a20); P.px(-4, hy + 3, GOLD); P.px(-4, hy + 4, GOLD_HI);
  });
}

// ================= alla bilder (målas en gång) =================
const CACHE = {};
function art() {
  if (CACHE.art) return CACHE.art;
  CACHE.art = {
    coffee: paintCoffeeBar(), sofa: paintSofa(), table: paintTable(), armchair: paintArmchair(), lamp: paintFloorLamp(),
    rack: paintRack(), cooler: paintCooler(), ticket: paintTicket(), model: paintModel(), shelf: paintShelf(),
    desk: paintDesk(), bossChair: paintBossChair(), guestChair: paintGuestChair(), files: paintFiles(),
    bench: paintBench(), easel: paintEasel(), umbrellas: paintUmbrellas(), boxes: paintBoxes(), pampas: paintPampas(),
    doll: paintDollhouse(), broch: paintBrochures(), side: paintSideTable(), printer: paintPrinter(), bin: paintBin(), sign: paintSign(),
    dog: [paintDog(false, false), paintDog(true, false), paintDog(false, true)],
    plants: Object.fromEntries(['fikus', 'monstera', 'monstera2'].map((k) => [k, paintPlant(k)])),
    cars: CAR_KINDS.map(([c, k]) => [paintCar(c, k, false), paintCar(c, k, true)]),
  };
  return CACHE.art;
}
const roomImg = (night) => CACHE['room' + night] || (CACHE['room' + night] = paintRoom(night));
const outsideImg = (night) => CACHE['out' + night] || (CACHE['out' + night] = paintOutside(night));
const nearImg = (night) => CACHE['near' + night] || (CACHE['near' + night] = paintNear(night));

// ================= kvällsljus =================
// Kvällen: ett blåviolett dunkel över kontoret, med ljuskäglor runt varje lampa
// (trappstegat med bayer-dither, ett pixelkorn) och ett varmt sken ovanpå.
const LIGHTS = () => [
  [92, 18, 78, 1], [518, 18, 78, 1],                                   // taklamporna
  [LAMP.x, LAMP.base - 58, 56, 1],                                     // golvlampan
  ...POSTERS.map((p) => [p.x + (p.w >> 1), PY + 8, 46, 0.8]),         // tavelbelysningen
  [DESK.x + 57, DESK.base - 30, 36, 0.9],                              // bankirlampan
  [412, 38, 16, 0.4], [DOOR_CX, DOOR.top - 10, 14, 0.4],               // nummertavlan, UT-skylten
  [SIDE.x - 5, SIDE.base - 28, 30, 0.8],                               // lampan på sidobordet
];
function nightShade() {
  if (CACHE.shade) return CACHE.shade;
  const P = new Pix(W, H), L = LIGHTS();
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let lit = 0;
    for (const [lx, ly, r, k] of L) {
      const d = Math.hypot(x - lx, (y - ly) * (y > ly ? 0.75 : 1.2)) / r;
      if (d < 1) lit = Math.max(lit, (1 - d) * k);
    }
    const a = 0.36 * (1 - q(Math.min(1, lit * 1.6), x, y, 4));
    if (a > 0) P.px(x, y, 0x0c0f2a, a);
  }
  return (CACHE.shade = P.flush());
}
function nightGlow() {
  if (CACHE.glow) return CACHE.glow;
  const P = new Pix(W, H);
  for (const [lx, ly, r, k] of LIGHTS()) P.ell(lx, ly, r * 0.55, r * 0.45, 0xffc870, 0.16 * k, 4);
  return (CACHE.glow = P.flush());
}

// ================= personer =================
const BROKER = { skin: '#c68a5c', hair: '#1d1714', style: 'bun', top: 'suit', shirt: '#1f2d48', accent: '#d8b45a', bottom: 'pants', pants: '#1f2d48', shoes: '#1c1c1c', glasses: 'round', beard: false, phones: false, bag: null, hat: null, blush: true, build: 5 };
const CUSTOMER = { ...makeLook(rng(4242)), kid: false, bag: null, hat: null, phones: false, build: 5, top: 'sweater', shirt: '#b9a3e8', bottom: 'jeans', pants: '#3f5f8f' };

// hinder för gången (fotplanet)
const OBSTACLES = [
  [COFFEE.x - 4, WALL_Y, COFFEE.x + 40, COFFEE.base + 2],
  [SOFA.x - 2, WALL_Y, SOFA.x + SOFA.w + 2, SOFA.base],
  [TABLE.x - 24, TABLE.base - 10, TABLE.x + 24, TABLE.base],
  [CHAIR.x - 12, CHAIR.base - 10, CHAIR.x + 12, CHAIR.base],
  [LAMP.x - 3, LAMP.base - 3, LAMP.x + 3, LAMP.base + 1],
  [RACK.x - 6, RACK.base - 5, RACK.x + 6, RACK.base],
  [TICKET.x - 3, TICKET.base - 3, TICKET.x + 3, TICKET.base + 1],
  [MODEL.x - 12, MODEL.base - 8, MODEL.x + 12, MODEL.base],
  [UMBR.x - 5, UMBR.base - 4, UMBR.x + 5, UMBR.base],
  [BENCH.x - (BENCH.w >> 1), BENCH.base - 7, BENCH.x + (BENCH.w >> 1), BENCH.base],
  [EASEL.x - 15, EASEL.base - 5, EASEL.x + 15, EASEL.base],
  [DOG.x - 17, DOG.base - 8, DOG.x + 17, DOG.base],
  // hörnet till höger om skrivbordet (skrivaren, arkivet, taxen) är ett enda block –
  // annars blev det en instängd ficka där klick inte ledde någonstans
  [DESK.x + DESK.w, WALL_Y, W, DOG.base],
  [BOXES.x - 17, BOXES.base - 6, BOXES.x + 17, BOXES.base],
  [DOLL.x - 22, DOLL.base - 8, DOLL.x + 26, DOLL.base],
  [BROCH.x - 9, BROCH.base - 4, BROCH.x + 9, BROCH.base],
  [SIDE.x - 9, SIDE.base - 4, SIDE.x + 9, SIDE.base],
  [BIN.x - 5, BIN.base - 4, BIN.x + 5, BIN.base],
  [SIGN.x - 9, SIGN.base - 4, SIGN.x + 7, SIGN.base],
  [PAMPAS.x - 6, PAMPAS.base - 4, PAMPAS.x + 6, PAMPAS.base],
  [SHELF.x - 2, WALL_Y, SHELF.x + 44, SHELF.base + 2],
  [COOLER.x - 8, WALL_Y, COOLER.x + 8, COOLER.base + 1],
  [DESK.x - 2, WALL_Y + 6, DESK.x + DESK.w + 2, DESK.base],
  ...GUEST.map((x) => [x - 7, GUEST_Y - 6, x + 7, GUEST_Y]),
  [FILES.x - 2, WALL_Y, W, FILES.base + 2],
  ...PLANTS.map((p) => [p.x - 7, p.base - 5, p.x + 7, p.base]),
];

// ================= scenen =================
export function makeShopBostad(A) {
  const g = A.game;
  const G = art();
  const walker = createWalker({ W, H, left: 6, right: W - 6, top: WALL_Y + 4, bottom: H - 4, spawn: [DOOR_CX, WALL_Y + 10] });
  walker.setObstacles(OBSTACLES);
  walker.snapFree();
  let t = 0, lockedCam = null, hold = 0, hoverId = null, hoverT = -9, seat = null;
  let greetT = -9, greeted = false, bubbleT = -9, headline = 0, wagT = -9;
  // taxen vaknar när någon kommer nära eller klappar den
  const dogAwake = () => t - wagT < 8 || Math.hypot(walker.px - DOG.x, walker.py - DOG.base) < 34;
  let served = 38 + Math.floor(Math.random() * 20), nextServe = 14;
  const camTarget = () => lockedCam ?? clamp(walker.px - VW / 2, 0, W - VW);
  const cam = { x: camTarget() };

  // trafiken och folket utanför fönstren
  const R = rng(99);
  const cars = [0, 1, 2, 3, 4, 5].map((i) => ({ lane: i % 2, x: (i * 131 + R() * 60) % (W + 80) - 40, s: Math.floor(R() * CAR_KINDS.length) }));
  const peds = [0, 1, 2, 3, 4].map((i) => { const r = rng(300 + i * 17); return { look: { ...makeLook(r), bag: null }, x: r() * W, v: (i % 2 ? 1 : -1) * (12 + r() * 8), ph: Math.floor(r() * 4) }; });

  const night = () => isNight(g.min / 60);
  const homeDeposit = () => HOMES.find((x) => x.id === g.home)?.deposit ?? -1;
  const nextHome = () => HOMES.find((h) => h.deposit > homeDeposit());

  function openHousing(home) {
    play('click');
    let dlg = null;
    try { dlg = A.openHousing(); } catch (e) { console.error('bostadsdialogen kunde inte öppnas:', e); return; }
    if (!home || !dlg?.querySelector) return;
    // markera bostaden man klickade på i listan
    const row = dlg.querySelector(`[data-move="${home.id}"]`)?.closest('.prow');
    if (row) { row.style.outline = '3px solid #e8b230'; row.style.outlineOffset = '2px'; row.scrollIntoView?.({ block: 'nearest' }); }
  }
  const greet = () => { greetT = t; greeted = true; };
  const say = (msg, snd = 'click') => { play(snd); toast(msg); };
  const HEADLINES = [
    '📰 DRÖMHEM: "Tio sätt att få plats med en soffa i Lilla rummet"',
    '📰 PIXELPOSTEN: "Större bostad – bättre sömn, säger forskarna"',
    '📰 BO BÄTTRE: "Villan med flaggstång – så får alla kompisar plats"',
    '📰 VECKANS RÖST: "Kanelbullen fyller år – mäklarna firar"',
  ];

  // alla klickbara saker (världskoordinater)
  const spots = [
    { id: 'dorr', r: [DOOR.x0 - 2, DOOR.top - 16, DOOR.x1 + 2, WALL_Y + 8], go: [DOOR_CX, WALL_Y + 8], label: 'UTGÅNG', hint: 'KLICKA FÖR ATT GÅ UT PÅ GATAN', act: () => { play('door'); A.go('city'); } },
    ...POSTERS.map((p) => ({ id: p.home.id, poster: p, r: [p.x, p.y, p.x + p.w, p.y + p.h], go: [p.x + p.w / 2, WALL_Y + 26], face: 'up', act: () => openHousing(p.home) })),
    { id: 'maklare', r: [DESK.x, 76, DESK.x + DESK.w, DESK.base], go: [DESK_CX, GUEST_Y + 2], face: 'up', label: 'MÄKLAREN', hint: 'KLICKA SÅ HJÄLPER HON DIG ATT FLYTTA',
      act: () => {
        greet();
        const nx = nextHome();
        toast(nx
          ? `💬 Mäklaren: "${g.money >= nx.deposit ? `Du har råd med ${nx.name.toLowerCase()} nu – ska vi skriva kontrakt?` : `Spara ${fmt(nx.deposit - g.money)} till, så fixar jag ${nx.name.toLowerCase()} åt dig!`}"`
          : '💬 Mäklaren: "Villan är det finaste vi har – och den är din!"');
        openHousing(null);
      } },
    { id: 'soffa', r: [SOFA.x, SOFA.base - 34, SOFA.x + SOFA.w, SOFA.base], go: [SEATS[0], SOFA.base + 5], label: 'SOFFAN', hint: 'KLICKA FÖR ATT SLÅ DIG NER',
      act: () => { seat = { x: SEATS[0], y: SOFA.base + 1, dir: 'down', exit: [SEATS[0], SOFA.base + 5] }; walker.px = SEATS[0]; play('click'); } },
    { id: 'banken', r: [BENCH.x - (BENCH.w >> 1), BENCH.base - 18, BENCH.x + (BENCH.w >> 1), BENCH.base], go: [BENCH.x - 8, BENCH.base + 5], label: 'GALLERISOFFAN', hint: 'SITT OCH TITTA PÅ BOSTÄDERNA',
      act: () => { seat = { x: BENCH.x - 8, y: BENCH.base - 5, fy: BENCH.base + 0.5, dir: 'up', exit: [BENCH.x - 8, BENCH.base + 5] }; play('click'); } },
    { id: 'staffli', r: [EASEL.x - 17, EASEL.base - 62, EASEL.x + 18, EASEL.base], go: [EASEL.x, EASEL.base + 8], label: 'VISNING', hint: 'SÖNDAG KLOCKAN 13-15',
      act: () => say('📐 Planritning från visningen: tre rum och kök, balkong i söderläge. Visning söndag kl 13–15 – kaffe bjuder vi på!') },
    { id: 'hund', r: [DOG.x - 17, DOG.base - 18, DOG.x + 17, DOG.base], go: [DOG.x - 22, DOG.base + 10], label: 'KANELBULLE', hint: 'MÄKLARENS TAX',
      act: () => { wagT = t; say(dogAwake() ? '🐶 Kanelbulle viftar på svansen och nosar på din hand.' : '🐶 Kanelbulle vaknar, gäspar och viftar på svansen.', 'ok'); } },
    { id: 'kartonger', r: [BOXES.x - 17, BOXES.base - 40, BOXES.x + 17, BOXES.base], go: [BOXES.x + 22, BOXES.base + 2], label: 'FLYTTKARTONGER', hint: 'GRATIS NÄR DU FLYTTAR',
      act: () => say('📦 Flyttkartonger – gratis för alla som skriver kontrakt. Någon har redan packat köket!') },
    { id: 'paraply', r: [UMBR.x - 6, UMBR.base - 30, UMBR.x + 6, UMBR.base], go: [UMBR.x + 6, UMBR.base + 8], label: 'PARAPLYSTÄLLET', hint: 'LÅNA ETT PARAPLY',
      act: () => say(g.event?.id === 'regn' ? '☂️ Du lånar ett paraply – lämna tillbaka det nästa gång!' : '☂️ Det regnar inte just nu. Paraplyerna får stå kvar.') },
    { id: 'kaffe', r: [COFFEE.x, 58, COFFEE.x + 38, COFFEE.base], go: [COFFEE.x + 19, COFFEE.base + 8], label: 'KAFFEBAREN', hint: 'GRATIS KAFFE OCH KANELBULLAR',
      act: () => say('☕ Kundkaffe och en kanelbulle – mäklarna bjuder!', 'ok') },
    { id: 'vatten', r: [COOLER.x - 8, 58, COOLER.x + 10, COOLER.base], go: [COOLER.x, COOLER.base + 8], label: 'VATTEN', hint: 'KLICKA FÖR EN KOPP',
      act: () => { bubbleT = t; say('💧 Blubb blubb – iskallt vatten.'); } },
    { id: 'tidning', r: [TABLE.x - 24, TABLE.base - 32, TABLE.x + 24, TABLE.base], go: [TABLE.x, TABLE.base + 8], label: 'TIDNINGAR', hint: 'KLICKA FÖR ATT BLÄDDRA',
      act: () => { say(HEADLINES[headline % HEADLINES.length]); headline++; } },
    { id: 'kolapp', r: [TICKET.x - 5, TICKET.base - 36, TICKET.x + 5, TICKET.base], go: [TICKET.x + 1, TICKET.base + 8], label: 'NUMMERLAPPAR', hint: 'TA EN LAPP',
      act: () => say(`🎫 Du tog nummerlapp ${(served + 1) % 100}. Mäklaren har tid för dig direkt – gå fram till skrivbordet!`) },
    { id: 'modell', r: [MODEL.x - 12, MODEL.base - 38, MODEL.x + 12, MODEL.base], go: [MODEL.x, MODEL.base + 10], label: 'MODELLEN', hint: 'VILLAN I SKALA 1:100',
      act: () => say('🏡 En modell av Villan i skala 1:100 – trädgård, flaggstång och allt!') },
    { id: 'bokhylla', r: [SHELF.x, 48, SHELF.x + 42, SHELF.base], go: [SHELF.x + 21, SHELF.base + 8], label: 'PÄRMARNA', hint: 'RITNINGAR OCH KONTRAKT',
      act: () => say('📚 Pärmar med ritningar och kontrakt för varenda bostad i Pixelstaden, från A till Ö.') },
    { id: 'arkiv', r: [FILES.x, 16, FILES.x + 44, FILES.base], go: [FILES.x + 20, FILES.base + 8], label: 'ARKIVET', hint: 'KONTRAKT OCH NYCKLAR',
      act: () => say('🗄️ Arkivskåpen är fulla av kontrakt. Nycklarna hänger i skåpet ovanför – en till varje bostad.') },
    { id: 'klocka', r: [17, 32, 37, 52], go: [COFFEE.x + 19, COFFEE.base + 8], label: 'KLOCKAN', hint: '',
      act: () => say(`🕒 Klockan är ${String(Math.floor(g.min / 60)).padStart(2, '0')}:${String(Math.floor(g.min % 60)).padStart(2, '0')}. Bostadsbyrån har öppet 07–20.`) },
    { id: 'dockskap', r: [DOLL.x - 24, DOLL.base - 48, DOLL.x + 28, DOLL.base], go: [DOLL.x + 2, DOLL.base + 6], label: 'BARNHÖRNAN', hint: 'DOCKSKÅP MED FYRA RUM',
      act: () => say('🏠 Dockskåpet har sovrum, badrum, kök och vardagsrum – precis som Villan, fast i miniatyr.', 'ok') },
    { id: 'broschyrer', r: [BROCH.x - 17, BROCH.base - 58, BROCH.x + 17, BROCH.base], go: [BROCH.x + 14, BROCH.base + 2], label: 'BROSCHYRER', hint: 'TA EN!',
      act: () => { const nx = nextHome(); say(nx ? `📄 Du tar en broschyr om ${nx.name}: ${nx.rent} kr i veckan, insats ${nx.deposit} kr. Bilderna är tagna en solig dag.` : '📄 Broschyren om Villan – din egen bostad på glansigt papper!'); } },
    { id: 'godis', r: [SIDE.x - 15, SIDE.base - 39, SIDE.x + 15, SIDE.base], go: [SIDE.x, SIDE.base + 8], label: 'GODISSKÅLEN', hint: 'TA EN KARAMELL',
      act: () => say('🍬 Du tar en polkagris ur skålen. Mäklaren låtsas inte se att du tar två.', 'ok') },
    { id: 'skrivare', r: [PRINT.x - 20, PRINT.base - 36, PRINT.x + 20, PRINT.base], go: [PRINT.x - 4, DOG.base + 10], label: 'SKRIVAREN', hint: 'KONTRAKTEN SKRIVS UT HÄR',
      act: () => say('🖨️ Skrivaren surrar och spottar ut ett kontrakt. Fel namn – mäklaren suckar och trycker igen.') },
    { id: 'papperskorg', r: [BIN.x - 12, BIN.base - 20, BIN.x + 7, BIN.base], go: [BIN.x, BIN.base + 8], label: 'PAPPERSKORGEN', hint: 'FULL AV UTKAST',
      act: () => say('🗑️ Skrynkliga utkast till annonser. "Charmig etta med utsikt över ... parkeringen."') },
    { id: 'skylt', r: [SIGN.x - 10, SIGN.base - 48, SIGN.x + 18, SIGN.base], go: [SIGN.x - 14, SIGN.base + 2], label: 'TILL SALU', hint: 'REDAN SÅLD!',
      act: () => say('🪧 SÅLT! Den här skylten ska ut på nästa visning – om det bara fanns något kvar att sälja.') },
  ];
  const spotAt = (x, y) => spots.find((h) => x >= h.r[0] && x <= h.r[2] && y >= h.r[1] && y <= h.r[3]);
  const focusSpot = () => {
    const h = hoverId && t - hoverT < 4 && spots.find((s) => s.id === hoverId);
    if (h) return h;
    if (walker.path.length || seat) return null;
    return spots.find((s) => (s.poster || s.id === 'maklare') && Math.abs(walker.px - s.go[0]) < 7 && Math.abs(walker.py - s.go[1]) < 7) || null;
  };
  function goTo(h) {
    seat = null;
    walker.walkTo(h.go[0], h.go[1], () => { if (h.face) walker.dir = h.face; h.act(); });
  }

  // ---------- ritning av hela kontoret (även för panorama) ----------
  function drawWorld(ctx, cx, vw) {
    const nt = night();
    // gatan utanför (syns genom glaset)
    ctx.drawImage(outsideImg(nt), cx, 0, vw, WALL_Y, cx, 0, vw, WALL_Y);
    for (const c of cars) {
      if (c.x < cx - 40 || c.x > cx + vw + 40) continue;
      const ly = c.lane ? NEAR_LANE : FAR_LANE;
      ctx.drawImage(G.cars[c.s][c.lane ? 0 : 1], Math.round(c.x) - 15, ly - 12);
      if (nt) { ctx.fillStyle = 'rgba(255,240,180,.35)'; ctx.fillRect(Math.round(c.x) + (c.lane ? 14 : -22), ly - 7, 8, 2); }
    }
    ctx.drawImage(nearImg(nt), cx, 0, vw, WALL_Y, cx, 0, vw, WALL_Y);
    for (const p of peds) {
      if (p.x < cx - 20 || p.x > cx + vw + 20) continue;
      drawPerson(ctx, p.x, PED_Y, p.look, p.v > 0 ? 'right' : 'left', WALK_SEQ[(Math.floor(t * 7) + p.ph) % 4]);
    }
    // själva rummet (glaset är genomskinligt)
    ctx.drawImage(roomImg(nt), cx, 0, vw, H, cx, 0, vw, H);

    // ---- levande saker på väggen ----
    drawClock(ctx, 27, 42, g.min);
    drawServing(ctx, served);
    const focus = focusSpot();
    for (const p of POSTERS) drawPosterLive(ctx, p, g, focus?.poster === p, t);

    // ---- golvet: allt sorterat på djup ----
    const items = [];
    const add = (fy, draw) => items.push({ fy, draw });
    add(COFFEE.base, () => { put(ctx, G.coffee, COFFEE.x, COFFEE.base); steam(ctx, COFFEE.x + 10, COFFEE.base - 26, t, 0); });
    add(SOFA.base, () => put(ctx, G.sofa, SOFA.x, SOFA.base));
    add(SOFA.base + 1, () => drawPerson(ctx, SEATS[1], SOFA.base + 1, CUSTOMER, 'down', Math.floor(t / 3.2) % 3 === 2 ? 6 : 5));
    add(TABLE.base, () => put(ctx, G.table, TABLE.x, TABLE.base));
    add(CHAIR.base, () => put(ctx, G.armchair, CHAIR.x, CHAIR.base));
    add(LAMP.base, () => put(ctx, G.lamp, LAMP.x, LAMP.base));
    add(RACK.base, () => put(ctx, G.rack, RACK.x, RACK.base));
    add(TICKET.base, () => put(ctx, G.ticket, TICKET.x, TICKET.base));
    add(MODEL.base, () => put(ctx, G.model, MODEL.x, MODEL.base));
    add(UMBR.base, () => put(ctx, G.umbrellas, UMBR.x, UMBR.base));
    add(BENCH.base, () => put(ctx, G.bench, BENCH.x, BENCH.base));
    add(EASEL.base, () => put(ctx, G.easel, EASEL.x, EASEL.base));
    add(BOXES.base, () => put(ctx, G.boxes, BOXES.x, BOXES.base));
    add(PAMPAS.base, () => put(ctx, G.pampas, PAMPAS.x, PAMPAS.base));
    // barnhörnan, broschyrstället, sidobordet, skrivaren, papperskorgen och skylten
    add(DOLL.base, () => put(ctx, G.doll, DOLL.x, DOLL.base));
    add(BROCH.base, () => put(ctx, G.broch, BROCH.x, BROCH.base));
    add(SIDE.base, () => { put(ctx, G.side, SIDE.x, SIDE.base); drawLampGlow(ctx, SIDE.x - 5, SIDE.base - 27, nt); });
    add(PRINT.base, () => { put(ctx, G.printer, PRINT.x, PRINT.base); printerBlink(ctx, PRINT.x, PRINT.base, t); });
    add(BIN.base, () => put(ctx, G.bin, BIN.x, BIN.base));
    add(SIGN.base, () => put(ctx, G.sign, SIGN.x, SIGN.base));
    add(DOG.base, () => {
      const awake = dogAwake();
      put(ctx, G.dog[awake ? 2 : Math.floor(t / 1.6) % 2], DOG.x, DOG.base);
      // svansen: viftar när taxen är vaken, ligger still längs dynan annars
      const TAIL = [[[12, -9], [13, -9], [14, -8], [15, -8]], [[12, -11], [13, -12], [14, -13], [14, -14]], [[12, -10], [13, -10], [14, -11], [15, -12]]];
      const k = awake ? 1 + Math.floor(t * (t - wagT < 3 ? 12 : 5)) % 2 : 0;
      for (const [dx, dy] of TAIL[k]) {
        ctx.fillStyle = '#221a26'; ctx.fillRect(DOG.x + dx, DOG.base + dy + 1, 1, 1);
        ctx.fillStyle = '#7a3e1a'; ctx.fillRect(DOG.x + dx, DOG.base + dy, 1, 1);
      }
      if (!awake) { // Zzz som stiger: vita Z med mörk kant så de syns mot väggen
        for (let i = 0; i < 2; i++) {
          const ph = (t * 0.45 + i * 0.5) % 1;
          const zx = DOG.x - 14 + Math.round(ph * 5) + i * 2, zy = DOG.base - 19 - Math.round(ph * 11);
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) ctxText(ctx, SMALL, 'Z', zx + dx, zy + dy, '#221a26');
          ctxText(ctx, SMALL, 'Z', zx, zy, ph < 0.7 ? '#ffffff' : '#c0c8e0');
        }
      }
    });
    add(SHELF.base, () => put(ctx, G.shelf, SHELF.x, SHELF.base));
    add(COOLER.base, () => { put(ctx, G.cooler, COOLER.x, COOLER.base); coolerBubbles(ctx, COOLER.x, COOLER.base, t, bubbleT); });
    add(FILES.base, () => put(ctx, G.files, FILES.x, FILES.base));
    for (const p of PLANTS) add(p.base, () => put(ctx, G.plants[p.k], p.x, p.base));
    // mäklaren: stolen bakom, hon själv, skrivbordet framför
    add(DESK.base, () => {
      put(ctx, G.bossChair, BOSS.x, BOSS.y - 2);
      const close = Math.hypot(walker.px - DESK_CX, walker.py - GUEST_Y) < 70;
      drawPerson(ctx, BOSS.x, BOSS.y, BROKER, close || t - greetT < 3 ? 'down' : 'left', 5);
      put(ctx, G.desk, DESK.x, DESK.base);
      drawScreen(ctx, DESK.x + 3, DESK.base - 45, t);
      steam(ctx, DESK.x + 40, DESK.base - 28, t, 1);
      drawLampGlow(ctx, DESK.x + 57, DESK.base - 31, nt);
    });
    for (const x of GUEST) add(GUEST_Y, () => put(ctx, G.guestChair, x, GUEST_Y));
    // figurerna
    for (const d of folkDrawables(A, t)) items.push(d);
    // sittande: i soffan bakom armstöden, på gallerisoffan ovanpå sitsen (ryggen mot oss)
    if (seat) add(seat.fy ?? seat.y + 0.02, () => drawPerson(ctx, seat.x, seat.y, A.avatar.look, seat.dir, 5));
    else items.push({ ...selfDrawable(A, walker, t, { folksHere: A.worldFolksHere?.().length || 0 }), fy: walker.py + 0.01 });
    items.sort((a, b) => a.fy - b.fy);
    for (const it of items) it.draw(ctx);
    // kväll: dunkel med ljuskäglor, och lampornas varma sken
    if (nt) {
      ctx.drawImage(nightShade(), cx, 0, vw, H, cx, 0, vw, H);
      const op = ctx.globalCompositeOperation;
      ctx.globalCompositeOperation = 'lighter';
      ctx.drawImage(nightGlow(), cx, 0, vw, H, cx, 0, vw, H);
      ctx.globalCompositeOperation = op;
    }

    // mäklarens hälsning
    if (t - greetT < 3) speech(ctx, BOSS.x, BOSS.y - 46, 'HEJ! VÄLKOMMEN!');
  }

  return {
    get worldX() { return walker.px; },
    get worldY() { return walker.py; },
    _debug: {
      spot: (id) => {
        const h = spots.find((s) => s.id === id);
        if (!h) return null;
        const mx = (h.r[0] + h.r[2]) / 2, my = (h.r[1] + h.r[3]) / 2;
        // ligger platsen utanför skärmen flyttas kameran dit en stund
        if (mx - cam.x < 8 || mx - cam.x > VW - 8) { cam.x = clamp(mx - VW / 2, 0, W - VW); hold = 1.5; }
        return { x: mx - Math.round(cam.x), y: my };
      },
      lockCam: (x) => { lockedCam = x === null || x === undefined ? null : clamp(x, 0, W - VW); cam.x = camTarget(); },
      teleport: (x, y) => { seat = null; walker.px = x; walker.py = y; walker.stop(); walker.snapFree(); cam.x = camTarget(); },
      hover: (id) => { hoverId = id || null; hoverT = t; },
      cam: () => cam.x,
      path: () => walker.path.map(([x, y]) => [Math.round(x), Math.round(y)]),
      pos: () => [Math.round(walker.px), Math.round(walker.py)],
      walkable: (x, y) => walker.walkable(x, y),
      // hur många steg vägen dit blir från där figuren står (0 = går inte att nå)
      reach: (x, y) => walker.findPath(walker.px, walker.py, x, y).length,
      open: (id) => spots.find((s) => s.id === id)?.act?.(),
      spots: () => spots.map((s) => s.id),
      seated: () => !!seat,
      panorama: () => {
        const c = document.createElement('canvas'); c.width = W; c.height = H;
        const x = c.getContext('2d'); x.imageSmoothingEnabled = false;
        drawWorld(x, 0, W);
        return c.toDataURL('image/png');
      },
    },

    update(dt) {
      t += dt;
      walker.update(dt);
      // trafiken: bortre filen åt vänster, närmaste åt höger – med avstånd i filen
      for (const c of cars) {
        const v = c.lane ? 34 : -28;
        const blocked = cars.some((o) => o !== c && o.lane === c.lane && (c.lane ? o.x - c.x : c.x - o.x) > 0 && (c.lane ? o.x - c.x : c.x - o.x) < 34);
        if (!blocked) c.x += v * dt;
        if (c.lane && c.x > W + 40) { c.x = -40 - Math.random() * 80; c.s = Math.floor(Math.random() * CAR_KINDS.length); }
        if (!c.lane && c.x < -40) { c.x = W + 40 + Math.random() * 80; c.s = Math.floor(Math.random() * CAR_KINDS.length); }
      }
      for (const p of peds) {
        p.x += p.v * dt;
        if (p.x > W + 24) p.x = -24; else if (p.x < -24) p.x = W + 24;
      }
      // nummertavlan tickar fram ibland
      nextServe -= dt;
      if (nextServe <= 0) { served++; nextServe = 16 + Math.random() * 14; }
      // mäklaren hälsar när man kommer fram till skrivbordet
      const d = Math.hypot(walker.px - DESK_CX, walker.py - GUEST_Y);
      if (d < 46 && !greeted) greet();
      if (d > 110) greeted = false;
      if (hold > 0) hold -= dt;
      else {
        const k = lockedCam !== null ? 1 : Math.min(1, dt * 6);
        cam.x += (camTarget() - cam.x) * k;
      }
    },

    down(sx, sy) {
      const x = sx + Math.round(cam.x), y = sy;
      hold = 0;
      hoverId = null;
      if (seat) { [walker.px, walker.py] = seat.exit; seat = null; }
      const h = spotAt(x, y);
      if (h) { goTo(h); return; }
      if (y > WALL_Y) walker.walkTo(x, y);
    },
    move(sx, sy) { hoverId = spotAt(sx + Math.round(cam.x), sy)?.id || null; hoverT = t; },

    draw(ctx) {
      const cx = Math.round(cam.x);
      ctx.setTransform(A.pxs, 0, 0, A.pxs, -cx * A.pxs, 0);
      drawWorld(ctx, cx, VW);
      // skyltar i skärmkanten och namnskylten för det man står vid/pekar på
      ctx.setTransform(A.pxs, 0, 0, A.pxs, 0, 0);
      if (cx < W - VW - 40 && walker.px < DESK.x - 60) edgeSign(ctx, 'MÄKLAREN', false);
      if (cx > DOOR.x1 + 20) edgeSign(ctx, 'UT', true);
      const f = focusSpot();
      if (f && (f.poster || f.label)) bigLabel(ctx, f, g, t, walker.py > H - 48);
    },
  };
}

// ================= levande ritning =================
function drawClock(ctx, cx, cy, min) {
  const ha = ((min / 60) % 12) / 12 * Math.PI * 2, ma = (min % 60) / 60 * Math.PI * 2;
  ctx.fillStyle = '#1f2d48';
  ctxLine(ctx, cx, cy, cx + Math.sin(ha) * 3.6, cy - Math.cos(ha) * 3.6);
  ctx.fillStyle = '#17151a';
  ctxLine(ctx, cx, cy, cx + Math.sin(ma) * 5.6, cy - Math.cos(ma) * 5.6);
  ctx.fillStyle = '#c9323a'; ctx.fillRect(cx, cy, 1, 1);
}
function drawServing(ctx, n) {
  // siffrorna på nummertavlan – röda lysdioder
  const s = String(n % 100).padStart(2, '0');
  const x = 412 - Math.floor(textW(BIG, s) / 2);
  ctxText(ctx, BIG, s, x + 1, 35, '#4a0e10');
  ctxText(ctx, BIG, s, x, 34, '#ff4a3a');
}
function drawPosterLive(ctx, p, g, on, t) {
  const { x, y, w, h, home } = p;
  const here = g.home === home.id, afford = g.money >= home.deposit;
  if (on) { // blinkande ram när man pekar på planschen
    ctx.fillStyle = Math.floor(t * 3) % 2 ? '#fff0b0' : '#e8b230';
    ctx.fillRect(x - 2, y - 2, w + 4, 1); ctx.fillRect(x - 2, y + h + 1, w + 4, 1); ctx.fillRect(x - 2, y - 1, 1, h + 2); ctx.fillRect(x + w + 1, y - 1, 1, h + 2);
  }
  if (here) {
    ctx.fillStyle = '#45b964';
    ctx.fillRect(x - 1, y - 1, w + 2, 1); ctx.fillRect(x - 1, y + h, w + 2, 1); ctx.fillRect(x - 1, y, 1, h); ctx.fillRect(x + w, y, 1, h);
  }
  const lx = x + 5, rx = x + w - 5;
  const row = (ly, label, val, col) => {
    ctxText(ctx, SMALL, label, lx, ly, '#8a8478');
    ctxText(ctx, SMALL, val, rx - textW(SMALL, val), ly, col);
  };
  // svenska prislappar: 1500:- och 600:-/V (vecka) – får plats med luft emellan
  row(y + 50, 'INSATS', home.deposit ? `${home.deposit}:-` : 'GRATIS', here ? '#1f2d48' : afford ? '#2f8f46' : '#c9323a');
  row(y + 57, 'HYRA', `${home.rent}:-/V`, '#1f2d48');
  ctxText(ctx, SMALL, 'SÖMN', lx, y + 63, '#8a8478');
  const stars = 1 + Math.round((home.restBonus || 0) / 10);
  for (let i = 0; i < 3; i++) star(ctx, rx - 17 + i * 6, y + 63, i < stars ? '#e8b230' : '#d8d0c0');
  // DITT HEM-rosett över bildens nederkant
  if (here) {
    const lbl = 'DITT HEM', bw = textW(SMALL, lbl) + 14, bx = x + Math.floor((w - bw) / 2), by = y + 40;
    ctx.fillStyle = '#1d5a2c'; ctx.fillRect(bx - 3, by + 2, 4, 7); ctx.fillRect(bx + bw - 1, by + 2, 4, 7);
    ctx.fillStyle = '#fbf7ee'; ctx.fillRect(bx - 3, by + 5, 1, 1); ctx.fillRect(bx + bw + 2, by + 5, 1, 1);
    ctx.fillStyle = '#17151a'; ctx.fillRect(bx - 1, by - 1, bw + 2, 11);
    ctx.fillStyle = '#2f8f46'; ctx.fillRect(bx, by, bw, 9);
    ctx.fillStyle = '#6fe08a'; ctx.fillRect(bx, by, bw, 1);
    ctx.fillStyle = '#1f6a34'; ctx.fillRect(bx, by + 8, bw, 1);
    ctx.fillStyle = '#ffffff'; // litet hus
    ctx.fillRect(bx + 3, by + 4, 5, 3); ctx.fillRect(bx + 4, by + 3, 3, 1); ctx.fillRect(bx + 5, by + 2, 1, 1);
    ctx.fillStyle = '#2f8f46'; ctx.fillRect(bx + 5, by + 5, 1, 2);
    ctxText(ctx, SMALL, lbl, bx + 10, by + 2, '#ffffff');
    if (Math.floor(t * 1.5) % 4 === 0) { ctx.fillStyle = '#ffffff'; ctx.fillRect(bx + bw - 3, by + 1, 1, 1); }
  }
}
function star(ctx, x, y, c) {
  const S = ['..#..', '.###.', '#####', '.###.', '.#.#.'];
  ctx.fillStyle = c;
  S.forEach((r, j) => { for (let i = 0; i < 5; i++) if (r[i] === '#') ctx.fillRect(x + i, y + j, 1, 1); });
}
function steam(ctx, x, y, t, seed) {
  // ånga som ringlar upp ur koppen
  for (let i = 0; i < 4; i++) {
    const ph = (t * 0.9 + i * 0.25 + seed * 0.13) % 1;
    const yy = y - ph * 9, xx = x + Math.round(Math.sin(ph * 6 + i + seed) * 1.2);
    ctx.fillStyle = `rgba(255,255,255,${(0.55 * (1 - ph)).toFixed(2)})`;
    ctx.fillRect(xx, Math.round(yy), 1, 1);
  }
}
function coolerBubbles(ctx, x, base, t, bubbleT) {
  // en bubbla stiger i flaskan då och då (och många när man tar vatten)
  const burst = t - bubbleT < 1.2, n = burst ? 4 : 1;
  for (let i = 0; i < n; i++) {
    const ph = (t * (burst ? 1.6 : 0.35) + i * 0.27) % 1;
    if (!burst && ph > 0.6) continue;
    const by = Math.round(base - 30 - ph * 12), bx = x - 2 + ((i * 3) % 5);
    ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.fillRect(bx, by, 1, 1);
    if (burst) { ctx.fillStyle = 'rgba(255,255,255,.4)'; ctx.fillRect(bx + 1, by - 1, 1, 1); }
  }
}
function drawScreen(ctx, x, y, t) {
  // datorn visar annonserna i tur och ordning (20×13 px)
  const home = HOMES[Math.floor(t / 3) % Math.max(1, HOMES.length)];
  ctx.fillStyle = '#f6f2ea'; ctx.fillRect(x, y, 20, 13);
  ctx.fillStyle = '#1f2d48'; ctx.fillRect(x, y, 20, 2);
  ctx.fillStyle = '#d8b45a'; ctx.fillRect(x + 1, y, 3, 1);
  thumb(ctx, x + 1, y + 3, home?.id);
  ctx.fillStyle = '#8a8478'; ctx.fillRect(x + 11, y + 4, 7, 1); ctx.fillRect(x + 11, y + 6, 5, 1);
  ctx.fillStyle = '#2f8f46'; ctx.fillRect(x + 11, y + 8, 6, 1);
  ctx.fillStyle = '#c9323a'; ctx.fillRect(x + 11, y + 10, 3, 1);
  // muspekaren glider över skärmen
  const px = x + 3 + Math.round((Math.sin(t * 0.9) * 0.5 + 0.5) * 14), py = y + 4 + Math.round((Math.cos(t * 0.7) * 0.5 + 0.5) * 6);
  ctx.fillStyle = '#17151a'; ctx.fillRect(px, py, 1, 3); ctx.fillRect(px + 1, py + 1, 1, 1);
  ctx.fillStyle = 'rgba(160,200,255,.18)'; ctx.fillRect(x, y, 20, 13);
}
function thumb(ctx, x, y, id) {
  // liten bild av bostaden (9×8)
  ctx.fillStyle = id === 'lagenhet' ? '#f0a08a' : '#8ec8f0'; ctx.fillRect(x, y, 9, 8);
  ctx.fillStyle = '#5aa04a'; ctx.fillRect(x, y + 6, 9, 2);
  if (id === 'lagenhet') {
    ctx.fillStyle = '#e8dcc8'; ctx.fillRect(x + 2, y + 1, 5, 6);
    ctx.fillStyle = '#3a4a6a'; for (let k = 0; k < 3; k++) { ctx.fillRect(x + 3, y + 2 + k * 2, 1, 1); ctx.fillRect(x + 5, y + 2 + k * 2, 1, 1); }
  } else if (id === 'rum') {
    ctx.fillStyle = '#f2dca0'; ctx.fillRect(x, y, 9, 6);
    ctx.fillStyle = '#d9433b'; ctx.fillRect(x + 4, y + 4, 4, 2);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(x + 1, y + 2, 2, 4);
  } else {
    ctx.fillStyle = id === 'villa' ? '#b23c2e' : '#c8b8a8'; ctx.fillRect(x + 2, y + 3, 5, 4);
    ctx.fillStyle = '#3a3c48'; ctx.fillRect(x + 1, y + 2, 7, 1); ctx.fillRect(x + 2, y + 1, 5, 1);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(x + 3, y + 4, 1, 1);
  }
}
function printerBlink(ctx, x, base, t) {
  // skrivarens gröna lampa blinkar då och då, och ett papper matas ut
  const ph = (t * 0.22) % 1;
  if (ph < 0.06) { ctx.fillStyle = '#fff0b0'; ctx.fillRect(x + 2, base - 26, 2, 1); }
  if (ph > 0.3 && ph < 0.7) { const k = Math.min(4, Math.round((ph - 0.3) * 12)); if (k > 0) { ctx.fillStyle = '#fbf7ee'; ctx.fillRect(x - 10, base - 22, 12, k); ctx.fillStyle = '#d8d4cc'; ctx.fillRect(x - 10, base - 22 + k - 1, 12, 1); } }
}
function drawLampGlow(ctx, x, y, nt) {
  ctx.fillStyle = nt ? 'rgba(255,236,170,.35)' : 'rgba(255,236,170,.18)';
  ctx.fillRect(x - 5, y + 1, 10, 1);
  ctx.fillStyle = nt ? 'rgba(255,236,170,.2)' : 'rgba(255,236,170,.1)';
  ctx.fillRect(x - 7, y + 2, 14, 2);
}
function speech(ctx, x, y, s) {
  const w = textW(SMALL, s) + 8, x0 = Math.round(x - w / 2), y0 = Math.round(y);
  ctx.fillStyle = '#17151a'; ctx.fillRect(x0 - 1, y0 - 1, w + 2, 11);
  ctx.fillStyle = '#fbf7ee'; ctx.fillRect(x0, y0, w, 9);
  ctx.fillStyle = '#17151a'; ctx.fillRect(x0 + (w >> 1) - 1, y0 + 10, 3, 1); ctx.fillRect(x0 + (w >> 1), y0 + 11, 2, 1);
  ctx.fillStyle = '#fbf7ee'; ctx.fillRect(x0 + (w >> 1), y0 + 9, 1, 2);
  ctxText(ctx, SMALL, s, x0 + 4, y0 + 2, '#1f2d48');
}
function edgeSign(ctx, lbl, left) {
  const w = textW(SMALL, lbl) + 13, x0 = left ? 3 : VW - w - 3, y0 = H - 14;
  ctx.fillStyle = '#d8b45a'; ctx.fillRect(x0 - 1, y0 - 1, w + 2, 11);
  ctx.fillStyle = '#1f2d48'; ctx.fillRect(x0, y0, w, 9);
  ctxText(ctx, SMALL, lbl, left ? x0 + 9 : x0 + 3, y0 + 2, '#fff0b0');
  ctx.fillStyle = '#fff0b0';
  for (let i = 0; i < 3; i++) ctx.fillRect(left ? x0 + 3 + i : x0 + w - 4 - i, y0 + 4 - i, 1, 1 + 2 * i);
}
// Namnskylt i skärmens nederkant för planschen/saken man står vid eller pekar på
function bigLabel(ctx, spot, g, t, atTop) {
  let name, val = '', valCol = '#f0d048', hint;
  if (spot.poster) {
    const h = spot.poster.home, here = g.home === h.id, afford = g.money >= h.deposit;
    name = h.name.toUpperCase();
    val = here ? 'DITT HEM' : h.deposit ? `${h.deposit} KR` : 'GRATIS';
    valCol = here || afford ? '#6fe08a' : '#ff8a80';
    hint = here ? 'HÄR BOR DU - KLICKA FÖR ALLA BOSTÄDER' : afford ? 'KLICKA SÅ FÅR DU FLYTTA HIT' : `DU BEHÖVER ${h.deposit - Math.max(0, Math.floor(g.money))} KR TILL`;
  } else { name = spot.label; hint = spot.hint || ''; }
  const nw = textW(BIG, name), vw = val ? textW(BIG, val) : 0, hw = textW(SMALL, hint);
  const w = Math.max(nw + (val ? vw + 10 : 0), hw) + 14, h = hint ? 22 : 13;
  const x0 = Math.round((VW - w) / 2), y0 = atTop ? 3 : H - h - 3;
  ctx.fillStyle = '#0e0d12'; ctx.fillRect(x0 - 2, y0 - 2, w + 4, h + 4);
  ctx.fillStyle = '#d8b45a'; ctx.fillRect(x0 - 1, y0 - 1, w + 2, h + 2);
  ctx.fillStyle = '#1f2d48'; ctx.fillRect(x0, y0, w, h);
  ctxText(ctx, BIG, name, x0 + 7, y0 + 3, '#ffffff');
  if (val) ctxText(ctx, BIG, val, x0 + 17 + nw, y0 + 3, valCol);
  if (hint) ctxText(ctx, SMALL, hint, x0 + 7, y0 + 14, Math.floor(t * 2) % 2 === 0 ? '#fff0b0' : '#c9c2d2');
}
