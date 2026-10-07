// PANTBANKEN – förortens pantbank som man går in i med sin egen figur. En TRÅNG butik i
// gammal stil: mörkgrön damasttapet, boasering och präglat plåttak, stavparkett i korgflätning
// och en nött orientalisk matta. Allt värdefullt står bakom GALLER:
//
//   bakväggen:  gitarrväggen (akustisk, röd elgitarr, svart bas, sunburst och en banjo) med
//               förstärkartornet och ett trumset framför · buren med papegojan som hänger i
//               taket · tavlan VI KÖPER GULD · klockväggen (regulatorn som går rätt, gökuret
//               som gal varje hel timme, stationsuret och köksklockan – ingen annan går rätt)
//               · de tre guldkulorna · TV-hyllan (testbild, myrornas krig, akvariet, fotboll)
//               · pantlagret PANTER där ens egna pantsatta möbler står med kvittonummer
//   glasdisken: en lång monter med ringar, klockor, kedjor och en guldtand på röd sammet,
//               med ett galler ända upp mot taket – bara kassaluckan är öppen. Bakom gallret
//               står pantlånaren (misstänksam, följer en med blicken) framför kassaskåpet med
//               övervakningsmonitorn ovanpå. Disklocka, penna i kedja, kvittospik, lappar.
//   golvet:     moraklockan, en tunna med golfklubbor och hockeyklubbor, LP-backen,
//               damcykeln och glasskåpet med kameror och tv-spel längs framväggen
//   framväggen: dörren med dörrklocka, gallerfönster med PANTBANKEN spegelvänt i guld
//
// Vid luckan (klicka på luckan eller pantlånaren) kan man
//   1) SÄLJA möbler ur förrådet för halva katalogpriset (g.sellStorage – såld är såld),
//   2) LÅNA mot pant: en möbel ur förrådet blir kvar som pant, man får PANT_RATE av
//      katalogpriset direkt och ska betala tillbaka lånet + 20 % ränta inom 7 dagar – annars
//      behåller pantbanken möbeln (logiken bor i game.js: pawnStorage/redeemPant/pantMorning),
//   3) LÖSA UT sina panter. Varje affär spelas upp: möbeln läggs på disken, pantlånaren
//      synar den med lupp, bjuder, hämtar pengar i kassaskåpet och räknar upp sedlarna.
// Kunder kommer in och prutar vid luckan. Öppettiderna följer huset i staden (js/city/map.js,
// husid 'pantbank'); efter stängning är rullgallret nere över luckan.
// Allt målas en gång med Pix-pennan (ett pixelkorn, ramper med 3–5 toner, mörk kontur) och
// cachas; varje bildruta ritar bara färdiga bilder plus det som lever.
import { Pix, SMALL, BIG, ctxText, textW, text, eachTextPixel, mix, mul, hash, bayer } from '../core/floor-pix.js';
import { drawPerson, makeLook, portrait } from '../core/people.js';
import { openModal, closeModal, toast, esc, modalOpen } from '../core/ui.js';
import * as GM from '../game.js';
import { fmt, katalogOf, viewOf, DAY_NAMES } from '../game.js';
import { play, audioContext, isMuted } from '../core/sound.js';
import { $t } from '../core/i18n.js';
import { createWalker, selfDrawable, folkDrawables, WALK_SEQ, createSpeech } from './walkable.js';
import { worldFolksHere } from '../net/world.js';
import { FRAMES } from '../data/frames.js';
import { tintSprite, isHex } from '../core/recolor.js';
import * as MAP from '../city/map.js';

// ================= regler (game.js äger dem – här finns reserver om patchen saknas) =================
const RATE = () => (typeof GM.PANT_RATE === 'number' ? GM.PANT_RATE : 0.4);
const DAYS = () => (typeof GM.PANT_DAYS === 'number' ? GM.PANT_DAYS : 7);
const MAXP = () => (typeof GM.MAX_PANT === 'number' ? GM.MAX_PANT : 4);
const MAXS = () => (typeof GM.MAX_STORAGE === 'number' ? GM.MAX_STORAGE : 80);
const INTEREST = () => (typeof GM.PANT_INTEREST === 'number' ? GM.PANT_INTEREST : 0.2);
export const loanOf = (k) => (typeof GM.pantLoanOf === 'function' ? GM.pantLoanOf(k) : Math.max(1, Math.round((katalogOf(k)?.price || 0) * RATE())));
export const debtOf = (lan) => (typeof GM.pantDebtOf === 'function' ? GM.pantDebtOf(lan) : Math.ceil((Math.round(lan) * (100 + INTEREST() * 100)) / 100 - 1e-9));
export const saleOf = (k) => Math.round((katalogOf(k)?.price || 0) / 2); // samma som g.sellStorage
const pantList = (g) => (Array.isArray(g.pant) ? g.pant : []);
const canPawn = (g) => typeof g.pawnStorage === 'function';

// öppettiderna följer huset i staden
export const PANT_OPEN = [10, 18];
const CITY_PB = (() => { try { return MAP.buildingById?.('pantbank') || MAP.ALL_BUILDINGS?.find?.((b) => b.id === 'pantbank') || null; } catch { return null; } })();
const HOURS = Array.isArray(CITY_PB?.open) && CITY_PB.open.length === 2 ? CITY_PB.open : PANT_OPEN;

// ================= geometri (spelpixlar, världskoordinater) =================
const W = 464, H = 232;
let VW = 384, VH = 216; // mobilfyllning: vyn följer skärmen, klampad till butiken
const syncView = (A) => { VW = Math.max(384, Math.min(A.W || 384, W)); VH = Math.max(216, Math.min(A.H || 216, H)); };
const SIDE = 6;                 // sidoväggarnas tjocklek
const CEIL = 10;                // takets underkant = bakväggens överkant
const WALL_Y = 72;              // bakväggens fot = golvets början
const FRONT_Y = 214;            // framväggens överkant
const DOOR = { x0: 92, x1: 120 }, DOOR_X = 106;
const CNT = { x0: 156, x1: W - SIDE, top: 104, face: 111, base: 134 }; // glasdisken
const FLAP = { x0: 156, x1: 176 };                                     // disklocket (personalens genväg)
const GRL = { x0: 176, x1: W - SIDE, top: 45 };                        // gallret ovanpå disken
const HATCH = { x0: 262, x1: 292, top: 77 };                           // kassaluckan i gallret
const HATCH_X = 277;
const ITEM_X = 248;             // där varan ställs på disken medan pantlånaren synar den
const SERVE = [277, 146];       // där man står vid luckan
const QUEUE = [226, 162];       // kön om någon redan står där
const PB_Y = 118;               // pantlånarens fötter bakom disken
const PB_MIN = 186, PB_MAX = 446, PB_HOME = HATCH_X;
const SAFE = { x0: 180, x1: 212, top: 72, base: 104 };                  // kassaskåpet
const GOLD = { x0: 178, x1: 212, top: 12, bot: 40 };                    // tavlan VI KÖPER GULD
const CAGE = { x0: 137, x1: 159, top: 15, bot: 46, cx: 148 };           // papegojans bur
const REG = { x0: 214, x1: 228, top: 12, bot: 66 };                     // regulatorn (går rätt)
const CUCKOO = { x0: 231, x1: 255, top: 12, bot: 38 };                  // gökuret
const BALLS = { x0: 258, x1: 306 };                                     // de tre guldkulorna
const SIGN = { x0: 250, x1: 304, top: 46, bot: 75 };                    // emaljskylten PANTLÅN
const TVR = { x0: 306, x1: 384, top: 12, b1: 41, b2: 71 };              // TV-hyllan
const PSH = { x0: 387, x1: 456, top: 11, b1: 43, b2: 71 };              // pantlagret
const SLOTS = [[391, 43], [423, 43], [391, 71], [423, 71]].map(([x, b]) => ({ x, b, w: 30, h: b === 43 ? 23 : 26 }));
const SLOT_OF = new Map();      // kvittonummer → hyllplats (stabilt så länge panten står kvar)
const GUITARS = [
  { x: 23, kind: 'akustisk' }, { x: 46, kind: 'el' }, { x: 69, kind: 'bas' }, { x: 93, kind: 'lespaul' }, { x: 118, kind: 'banjo' },
];
const AMP = { x0: 10, x1: 42, base: 101 };
const DRUMS = { x0: 43, x1: 101, base: 106 };
const MORA = { x0: 8, x1: 27, base: 158 };
const CLUBS = { x0: 128, x1: 150, base: 207 };
const LP = { x0: 190, x1: 228, base: 207 };
const BIKE = { x0: 306, x1: 372, base: 207 };
const VITR = { x0: 402, x1: 455, base: 208 };
const RUG = { x0: 166, x1: 306, y0: 150, y1: 194 };
const BELL = { x: 302, y: 104 };  // disklockan

// allt man inte kan gå igenom
const OBST = [
  [CNT.x0, WALL_Y - 8, W, CNT.base + 1],
  [AMP.x0, AMP.base - 16, AMP.x1, AMP.base],
  [DRUMS.x0, DRUMS.base - 16, DRUMS.x1, DRUMS.base],
  [MORA.x0, MORA.base - 10, MORA.x1, MORA.base],
  [CLUBS.x0, CLUBS.base - 12, CLUBS.x1, CLUBS.base],
  [LP.x0, LP.base - 12, LP.x1, LP.base],
  [BIKE.x0 + 4, BIKE.base - 8, BIKE.x1 - 4, BIKE.base],
  [VITR.x0, VITR.base - 16, VITR.x1, VITR.base],
];

// ================= färger och typsnitt =================
const OUT = 0x231c22;
const STEEL = [0x2a2e36, 0x4a505a, 0x6e7680, 0x9aa2ac, 0xc8d0d8];
const MAHOG = [0x2a120e, 0x48201a, 0x6a3222, 0x8a4830, 0xa8643e];
const OAK = [0x4a2e16, 0x6a4422, 0x8a5c30, 0xa8743e, 0xc8925a];
const BRASS = [0x5a3a0a, 0x8a6414, 0xc89a2a, 0xf0c848, 0xfff0a0];
const VELVET = [0x2a0610, 0x4a0c1c, 0x6e1428, 0x902038, 0xb04058];
const LOUD = [0xff3a4a, 0xffc81a, 0x2ac0ff, 0x4ae05a, 0xff7a1a, 0xb05aff, 0x1ad8b8, 0xff4ac0, 0xf0f040, 0x3a5aff];
const SM = {
  ...SMALL,
  '&': { rows: ['.#..', '#.#.', '.#..', '#.##', '.##.'], up: [], w: 4 },
  '·': { rows: ['.', '.', '#', '.', '.'], up: [], w: 1 },
};
const BG = { ...BIG, '·': { rows: ['..', '..', '..', '##', '##', '..', '..'], up: [], w: 2 } };

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const hexs = (c) => '#' + (c & 0xffffff).toString(16).padStart(6, '0');
// fem toner ur en grundfärg: djup skugga, skugga, bas, ljus, högdager
const rampOf = (c) => [mix(mul(c, 0.4), 0x160c26, 0.3), mix(mul(c, 0.7), 0x2a1f3a, 0.1), c, mix(c, 0xfff6e8, 0.32), mix(c, 0xffffff, 0.66)];
function tone(pal, v, x, y) {
  const f = clamp(v, 0, 0.999) * (pal.length - 1);
  let i = Math.floor(f);
  if (f - i > 0.25 + bayer(x, y) * 0.5) i++;
  return pal[Math.min(pal.length - 1, i)];
}
// skuggad låda: ljus överkant/vänsterkant, mörk högerkant/underkant
function sbox(P, x, y, w, h, c) {
  const r = rampOf(c);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    let k = r[2];
    if (j === 0) k = r[3]; else if (j === h - 1) k = r[1]; else if (i === 0) k = r[3]; else if (i === w - 1) k = r[1];
    P.px(x + i, y + j, k);
  }
  if (w > 2 && h > 2) P.px(x, y, r[4]);
}
// snedställda reflexstrimmor på glas
function glare(P, x, y, w, h, a = 0.28, step = 13, seed = 0) {
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const d = (i + j + seed * 5) % step;
    if (d < 2) P.px(x + i, y + j, 0xffffff, a); else if (d === 3) P.px(x + i, y + j, 0xffffff, a * 0.45);
  }
}
// slagskugga på golvet – bara på tomma pixlar (läggs sist)
function groundShadow(P, cx, cy, rx, ry, a = 0.3) {
  for (let y = Math.floor(cy - ry); y <= cy + ry; y++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
    const t = Math.hypot((x + 0.5 - cx) / rx, (y + 0.5 - cy) / ry);
    if (t >= 1) continue;
    const xx = x - P.ox, yy = y - P.oy;
    if (xx < 0 || yy < 0 || xx >= P.w || yy >= P.h || P.d[(yy * P.w + xx) * 4 + 3]) continue;
    const q = clamp(Math.round((1 - t) * 3 + bayer(x, y) - 0.5), 0, 3) / 3;
    if (q > 0) P.px(x, y, 0x0a0c18, a * (0.4 + 0.6 * q));
  }
}
// mörk kontur runt allt målat: hård nedtill/höger, mjukare upptill/vänster
function outline(P, dark = OUT, softA = 0.7) {
  const { w, h, d } = P;
  const on = (x, y) => x >= 0 && y >= 0 && x < w && y < h && d[(y * w + x) * 4 + 3] > 200;
  const add = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (d[(y * w + x) * 4 + 3]) continue;
    const hard = on(x, y - 1) || on(x - 1, y), soft = on(x, y + 1) || on(x + 1, y);
    if (hard || soft) add.push(x, y, hard ? 1 : 0);
  }
  for (let i = 0; i < add.length; i += 3) P.px(add[i] + P.ox, add[i + 1] + P.oy, dark, add[i + 2] ? 1 : softA);
}
// förmålad bild i världskoordinater
function sprite(x0, y0, w, h, fn) {
  const P = new Pix(w, h, x0, y0);
  fn(P);
  return { img: P.flush(), x: x0, y: y0, w, h };
}
const put = (ctx, s, dx = 0, dy = 0) => ctx.drawImage(s.img, s.x + dx, s.y + dy);
// en "sned" penna: var k:te kolumn flyttas en pixel – handskrivna lappar som sitter snett
function skew(P, x0, k, dir = 1) {
  const off = (x) => dir * Math.floor((x - x0) / k);
  const S = {
    px: (x, y, c, a) => P.px(x, y + off(x), c, a),
    rect(x, y, w, h, c, a) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) S.px(x + i, y + j, c, a); },
    hl(x, y, w, c, a) { S.rect(x, y, w, 1, c, a); },
    vl(x, y, h, c, a) { S.rect(x, y, 1, h, c, a); },
  };
  return S;
}
// handskrivet: bokstäverna guppar lite och glipar ibland
function hand(P, F, s, x, y, c, seed = 0, a = 1) {
  let cx = Math.round(x), i = 0;
  for (const ch of String(s).toUpperCase()) {
    const bob = hash(i, seed, 401) > 0.74 ? 1 : 0;
    eachTextPixel(F, ch, cx, y + bob, 1, (px, py) => P.px(px, py, c, a));
    cx += textW(F, ch) + 1 + (hash(i, seed, 402) > 0.86 ? 1 : 0);
    i++;
  }
  return cx - Math.round(x) - 1;
}
function handW(F, s, seed = 0) {
  let w = 0, i = 0;
  for (const ch of String(s).toUpperCase()) { w += textW(F, ch) + 1 + (hash(i, seed, 402) > 0.86 ? 1 : 0); i++; }
  return w - 1;
}
// fantasiskrift (loggor, etiketter utan riktigt språk)
function script(P, x, y, w, c, seed, a = 1) {
  let cx = x, i = 0;
  while (cx < x + w - 1) {
    const r = hash(i, seed, 78);
    P.px(cx, y + 1, c, a); P.px(cx + 1, y, c, a); if (r < 0.5) P.px(cx + 1, y + 2, c, a); if (r > 0.7) P.px(cx + 2, y + 1, c, a);
    cx += 3 + (r > 0.8 ? 1 : 0); i++;
  }
}
// en liten pappersetikett på ett snöre (prislapp) med kråkfötter på
function tag(P, x, y, seed, col = 0xf4f0e2) {
  P.line(x, y - 3, x + 1, y, 0xd8d0b8, 0.9);
  const S = skew(P, x, 3, hash(seed, 1, 41) > 0.5 ? 1 : -1);
  S.rect(x, y, 5, 4, col); S.hl(x, y, 5, mix(col, 0xffffff, 0.5)); S.hl(x, y + 3, 5, mul(col, 0.78));
  S.px(x + 1, y + 1, 0xc0202a); S.px(x + 2, y + 2, 0xc0202a); S.px(x + 3, y + 1, 0x1a1a3a);
}
function vnoise(x, y, s, seed) {
  const fx = x / s, fy = y / s, ix = Math.floor(fx), iy = Math.floor(fy);
  let tx = fx - ix, ty = fy - iy;
  tx = tx * tx * (3 - 2 * tx); ty = ty * ty * (3 - 2 * ty);
  const a = hash(ix, iy, seed), b = hash(ix + 1, iy, seed), c = hash(ix, iy + 1, seed), d = hash(ix + 1, iy + 1, seed);
  return a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty;
}
// guldklump: rund boll med högdager
function goldBall(P, cx, cy, r) {
  for (let y = Math.floor(cy - r); y <= cy + r; y++) for (let x = Math.floor(cx - r); x <= cx + r; x++) {
    const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
    if (d > r) continue;
    const lit = 0.72 - ((x + 0.5 - cx) + (y + 0.5 - cy)) / (r * 2.6) - d / r * 0.18;
    P.px(x, y, tone(BRASS, lit, x, y));
  }
  P.px(Math.round(cx - r * 0.4), Math.round(cy - r * 0.45), 0xffffff);
}

// ================= bakgrunden =================
// gångstråken där folk nött golvet: [x0, y0, x1, y1, halva bredden]
const WEAR = [[DOOR_X, 212, SERVE[0], SERVE[1] + 4, 14], [DOOR_X, 212, 70, 118, 11], [110, 150, 30, 160, 8], [SERVE[0], 150, 420, 150, 9]];
function wearAt(x, y) {
  let best = 0;
  for (const [x0, y0, x1, y1, hw] of WEAR) {
    const dx = x1 - x0, dy = y1 - y0, L = dx * dx + dy * dy || 1;
    const t = clamp(((x - x0) * dx + (y - y0) * dy) / L, 0, 1);
    best = Math.max(best, 1 - Math.hypot(x - (x0 + dx * t), y - (y0 + dy * t)) / hw);
  }
  return clamp(best + (vnoise(x, y, 5, 21) - 0.5) * 0.5, 0, 1);
}
// stavparkett i korgflätning: rutor om 8×8 med två liggande eller två stående stavar,
// varje stav med egen ton och ådring, mörka fogar, nött och dammig
function paintFloor(P) {
  for (let y = WALL_Y - 4; y < FRONT_Y; y++) for (let x = SIDE; x < W - SIDE; x++) {
    const bx = x >> 3, by = (y + 4) >> 3, lx = x & 7, ly = (y + 4) & 7;
    const horiz = ((bx + by) & 1) === 0;
    const stave = horiz ? ly >> 2 : lx >> 2, along = horiz ? lx : ly, across = horiz ? ly & 3 : lx & 3;
    const id = bx * 7 + by * 13 + stave * 3;
    let v = 0.42 + hash(id, 1, 11) * 0.3;
    if (((along + Math.floor(hash(id, 2, 12) * 5)) % 5) === 0 && across === 1) v -= 0.12; // ådring
    if (across === 3) v -= 0.17;                                                         // fogen mellan stavarna
    if (along === 0) v -= 0.2;                                                           // stavens ände
    if (across === 0) v += 0.05;
    let c = tone(OAK, 0.2 + v * 0.75, x, y);
    const w = wearAt(x, y);
    c = mix(c, 0xb89a6a, w * 0.3);                          // nött ljust där folk går
    c = mix(c, 0x2a1a10, Math.max(0, vnoise(x, y, 11, 13) - 0.62) * 0.8); // mörka fläckar av vax och smuts
    if (hash(x, y, 14) > 0.965) c = mix(c, 0x2a1a10, 0.4);
    // bakom disken: en sliten gummimatta i skugga (pantlånarens plats)
    if (x >= CNT.x0 && y < CNT.top + 2) c = mix((x + y) % 3 === 0 ? 0x221c1a : 0x2c2522, c, 0.18 + (hash(x >> 2, y >> 2, 15) > 0.8 ? 0.1 : 0));
    P.px(x, y, c);
  }
  // den nötta orientaliska mattan framför disken
  {
    const { x0, x1, y0, y1 } = RUG, w = x1 - x0, h = y1 - y0;
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      const i = x - x0, j = y - y0, e = Math.min(i, j, w - 1 - i, h - 1 - j);
      let c;
      if (e === 0) c = 0x3a0e10;
      else if (e < 3) c = e === 1 ? 0x1c2a58 : ((i + j) % 3 === 0 ? 0xd8b060 : 0x1c2a58);  // ytterbård med guldprickar
      else if (e < 5) c = 0xe0d0a8;                                                         // ljus bård
      else if (e < 7) c = ((i >> 1) + (j >> 1)) % 2 ? 0x8a1a1a : 0x6a1212;                  // tandad röd bård
      else {
        const cx = i - w / 2, cy = (j - h / 2) * 2.4, d = Math.abs(cx) + Math.abs(cy);
        c = 0x8a1a1a;
        if (d < 22) c = d < 8 ? 0x1c2a58 : d < 10 ? 0xe0d0a8 : d < 19 ? 0xa82a22 : 0xd8b060;  // medaljongen
        else if ((Math.abs(cx) + Math.abs(cy)) % 14 < 1.5) c = 0x5a1010;                     // rutmönster
        if (d >= 22 && ((i * 3 + j * 5) % 23 === 0)) c = 0xd8b060;
        if (Math.abs(Math.abs(cx) - w / 2 + 12) < 2 && Math.abs(cy) < 6) c = 0x1c2a58;       // hörnrosor
      }
      c = mix(c, 0xb09878, wearAt(x, y) * 0.42);          // nött blek i gången
      if (hash(x, y, 31) > 0.9) c = mul(c, 0.86);
      P.px(x, y, c);
    }
    for (let j = 1; j < h - 1; j += 2) { P.hl(x0 - 2, y0 + j, 2, 0xe8dcc0); P.hl(x1, y0 + j, 2 + (j % 3 === 0 ? 1 : 0), 0xe8dcc0); } // fransar
    P.hl(x0, y1, w, 0x1a0a08, 0.35);
  }
  // dörrmattan
  for (let y = 203; y < FRONT_Y; y++) for (let x = DOOR.x0 - 3; x < DOOR.x1 + 3; x++) {
    const e = x === DOOR.x0 - 3 || x === DOOR.x1 + 2 || y === 203;
    P.px(x, y, e ? 0x1e1a16 : (x + y) & 1 ? 0x3a3a2e : 0x2e2e26);
  }
  // smutsränder längs väggarna och damm i hörnen
  for (let x = SIDE; x < W - SIDE; x++) for (let k = 0; k < 4; k++) P.px(x, WALL_Y + k, 0x1a0e08, 0.3 - k * 0.07);
  for (let y = WALL_Y; y < FRONT_Y; y++) for (let k = 0; k < 3; k++) { P.px(SIDE + k, y, 0x1a0e08, 0.26 - k * 0.08); P.px(W - SIDE - 1 - k, y, 0x1a0e08, 0.26 - k * 0.08); }
  for (let x = SIDE; x < W - SIDE; x++) for (let k = 0; k < 3; k++) P.px(x, FRONT_Y - 1 - k, 0x1a0e08, 0.24 - k * 0.07);
  // skosulemärken, ett kapsyl och ett gem på golvet
  for (let k = 0; k < 22; k++) {
    const x = 12 + Math.floor(hash(k, 1, 61) * 440), y = WALL_Y + 40 + Math.floor(hash(k, 2, 61) * 130);
    if (!freeFloor(x, y)) continue;
    P.line(x, y, x + 2 + Math.floor(hash(k, 3, 61) * 4), y + (hash(k, 4, 61) > 0.5 ? 1 : 0), 0x1a100a, 0.34);
  }
  P.rect(142, 176, 2, 2, 0xc8a040); P.px(142, 176, 0xfff0a0);
  P.hl(360, 160, 3, 0xc8ccd4); P.px(362, 161, 0xc8ccd4);
}
const freeFloor = (x, y) => !OBST.some(([x0, y0, x1, y1]) => x > x0 - 3 && x < x1 + 3 && y > y0 - 3 && y < y1 + 3);

// präglat plåttak i brons med taklist
function paintCeiling(P) {
  for (let y = 0; y < CEIL; y++) for (let x = 0; x < W; x++) {
    const lx = x % 12, ly = y % 10;
    const d = Math.abs(lx - 5.5) + Math.abs(ly - 4.5);
    let v = 0.5;
    if (d < 2) v = 0.8; else if (d < 3) v = 0.3; else if (d > 7.5) v = 0.62;
    if (lx === 0) v = 0.2;
    let c = tone([0x3a2e1e, 0x5e4c32, 0x8a7652, 0xb09a6e, 0xd0bc8a], v - y / CEIL * 0.15, x, y);
    c = mix(c, 0x1a120a, Math.max(0, vnoise(x, y, 9, 71) - 0.6) * 0.9); // sot
    P.px(x, y, c);
  }
  P.hl(0, CEIL - 2, W, 0xc8b080); P.hl(0, CEIL - 1, W, 0x4a3a22);
  // övervakningskamera i hörnet
  P.rect(W - 26, 2, 9, 5, 0xe8e8e0); P.hl(W - 26, 2, 9, 0xffffff); P.px(W - 27, 4, 0x1a1a22); P.px(W - 28, 4, 0x3a4a6a); P.vl(W - 20, 0, 2, 0x9a9a90);
  // konvex spegel i taket ovanför dörren (så pantlånaren ser hela butiken)
  const mx = 132, my = 6;
  for (let y = 0; y <= my + 6; y++) for (let x = mx - 7; x <= mx + 7; x++) {
    const d = Math.hypot(x - mx, (y - my) * 1.1);
    if (d > 6.5) continue;
    let c = d > 5.5 ? 0x2a2a32 : mix(0x9aa6ae, 0x4a545c, (y - my + 6) / 12);
    if (d <= 5.5 && x - mx + y - my < -4) c = mix(c, 0xffffff, 0.5);
    if (d <= 5.5 && d > 2 && hash(x, y, 73) > 0.75) c = mix(c, 0x8a3a2a, 0.5);
    P.px(x, y, c);
  }
}

// bakväggen: mörkgrön damasttapet ovanför en boasering i mahogny
const DAMASK = ['....#....', '...###...', '..#.#.#..', '.#..#..#.', '#.#####.#', '.#..#..#.', '..#.#.#..', '...###...', '....#....', '.........', '.........'];
function paintWall(P) {
  const panelTop = WALL_Y - 15;
  for (let y = CEIL; y < WALL_Y; y++) for (let x = SIDE; x < W - SIDE; x++) {
    let c;
    if (y < panelTop) {
      const row = (y - CEIL) % 11, col = (x + (Math.floor((y - CEIL) / 11) % 2) * 5) % 10;
      c = DAMASK[row]?.[col] === '#' ? 0x40604a : 0x2c4636;
      if ((x % 10 === 0) && hash(x, y, 81) > 0.5) c = 0x28402f;
      c = mix(c, 0x14100a, (1 - (y - CEIL) / (panelTop - CEIL)) * 0.2);         // sot uppe vid taket
      if (vnoise(x, y, 7, 82) > 0.74) c = mix(c, 0x6a6a44, 0.28);                  // blekt och fläckigt
    } else {
      const lx = (x - SIDE) % 26, ly = y - panelTop;
      let v = 0.45;
      if (ly === 0) v = 0.85; else if (ly === 1) v = 0.25; else if (ly >= 14) v = 0.15;
      else if (lx === 2 || ly === 3) v = 0.7; else if (lx === 23 || ly === 12) v = 0.2;
      else if (lx < 2 || lx > 23 || ly < 3 || ly > 12) v = 0.4; else v = 0.5 + ((lx + ly * 3) % 7 === 0 ? 0.05 : 0);
      c = tone(MAHOG, v, x, y);
    }
    P.px(x, y, c);
  }
}

// ---------- gitarrväggen ----------
function guitar(P, gx, kind) {
  const neck = (y0, y1, c = 0x3a2014, frets = true) => {
    for (let y = y0; y < y1; y++) { P.px(gx - 1, y, mul(c, 1.3)); P.px(gx, y, c); P.px(gx + 1, y, mul(c, 0.7)); }
    if (frets) for (let y = y0 + 2; y < y1; y += 3) { P.px(gx - 1, y, 0xc8ccd0); P.px(gx + 1, y, 0x8a8e94); }
    for (let y = y0 + 4; y < y1 - 2; y += 6) P.px(gx, y, 0xf0ece0); // markeringsprickar
  };
  const head = (y0, w, c, pegs, inline = false) => {
    for (let y = y0; y < y0 + 6; y++) for (let x = -(w >> 1); x <= w >> 1; x++) {
      if (inline && x < 0 && y < y0 + 2) continue;
      P.px(gx + x, y, x === -(w >> 1) ? mul(c, 1.3) : x === w >> 1 ? mul(c, 0.7) : c);
    }
    for (let k = 0; k < pegs; k++) {
      const py = y0 + 1 + (k % 3) * 2, side = inline ? 1 : k < pegs / 2 ? -1 : 1;
      P.px(gx + side * ((w >> 1) + 1), py, 0xd8dce0); P.px(gx + side * ((w >> 1) + 2), py, 0x8a8e94);
    }
    P.hl(gx - 1, y0 + 6, 3, 0xf0ece0); // sadeln
  };
  // kropp ur två ellipser med midja: [cy, rx, ry] för övre och undre del
  const body = (b0, b1, fill, rim = null, cut = 0) => {
    for (let y = b0[0] - b0[2]; y <= b1[0] + b1[2]; y++) for (let x = gx - 12; x <= gx + 12; x++) {
      const inA = Math.hypot((x + 0.5 - gx) / b0[1], (y + 0.5 - b0[0]) / b0[2]) < 1, inB = Math.hypot((x + 0.5 - gx) / b1[1], (y + 0.5 - b1[0]) / b1[2]) < 1;
      if (!inA && !inB) continue;
      if (cut && y < b0[0] && x > gx + 1 && x < gx + 1 + cut) continue; // utskärning (singlecut)
      const ea = Math.hypot((x + 0.5 - gx) / b0[1], (y + 0.5 - b0[0]) / b0[2]), eb = Math.hypot((x + 0.5 - gx) / b1[1], (y + 0.5 - b1[0]) / b1[2]);
      const e = Math.min(ea, eb);
      P.px(x, y, fill(x, y, e));
      if (rim && e > 0.84) P.px(x, y, rim);
    }
  };
  if (kind === 'akustisk') {
    head(22, 5, 0x2a1a10, 6);
    neck(28, 42);
    body([46, 6, 5.5], [56, 8, 7], (x, y, e) => tone([0x5a2a10, 0x9a5a22, 0xd09848, 0xe8c070, 0xf8e0a0], 0.86 - e * 0.62 - (x - gx) * 0.02, x, y), 0x3a1a0a);
    for (let y = 44; y < 49; y++) for (let x = gx - 3; x <= gx + 3; x++) if (Math.hypot(x - gx, (y - 46.5) * 1.2) < 2.8) P.px(x, y, Math.hypot(x - gx, (y - 46.5) * 1.2) > 2 ? 0x6a3a14 : 0x1a0e08); // ljudhålet
    P.hl(gx - 3, 57, 7, 0x2a140a); P.hl(gx - 2, 58, 5, 0x4a2a14);                                  // stallet
    for (let y = 49; y < 55; y++) P.px(gx + 3, y, 0x4a1a0a);                                         // pickguard
    for (let y = 36; y < 58; y++) { if (y % 2) P.px(gx, y, 0xe8e8e0, 0.6); }                         // strängarna
  } else if (kind === 'el') {
    head(22, 4, 0xe8d8b0, 6, true);
    neck(28, 44, 0xd8b070);
    body([48, 6, 5], [56, 7.5, 6.5], (x, y, e) => tone([0x4a0808, 0x8a1010, 0xc82020, 0xf04a3a, 0xffa090], 0.9 - e * 0.6 - (x - gx) * 0.03, x, y));
    P.px(gx + 5, 43, 0); // hornen
    for (let y = 44; y < 47; y++) { P.px(gx - 4, y, 0xc82020); P.px(gx + 4, y - 1, 0xa81818); }
    for (let y = 47; y < 60; y++) for (let x = gx - 3; x <= gx + 2; x++) if (Math.hypot(x - gx + 0.5, (y - 53) / 1.6) < 4) P.px(x, y, 0xf4f0e6); // vit pickguard
    for (const py of [48, 51, 54]) { P.hl(gx - 1, py, 3, 0x2a2a30); P.px(gx, py, 0x9aa0a8); }        // mikrofonerna
    for (const [kx, ky] of [[gx + 3, 57], [gx + 4, 59], [gx + 2, 60]]) P.px(kx, ky, 0xf8f8f0);        // rattarna
    P.hl(gx - 2, 58, 4, 0x8a8e94);
  } else if (kind === 'bas') {
    head(22, 5, 0x14141a, 4);
    neck(28, 46, 0x2a1810);
    body([50, 6, 5.5], [59, 8, 6.5], (x, y, e) => tone([0x08080c, 0x16161e, 0x26262e, 0x4a4a56, 0x9a9aa8], 0.7 - e * 0.5 - (x - gx) * 0.04, x, y));
    for (let y = 50; y < 62; y++) for (let x = gx - 4; x <= gx + 2; x++) if (Math.hypot(x - gx + 1, (y - 56) / 1.5) < 3.6) P.px(x, y, hash(x, y, 91) > 0.5 ? 0x7a3a14 : 0x5a2a0a); // sköldpaddsplektrumskydd
    P.hl(gx - 2, 53, 5, 0x1a1a1e); P.hl(gx - 2, 58, 5, 0x1a1a1e); P.px(gx, 58, 0x8a8e94);
    P.hl(gx - 2, 62, 5, 0xb8bcc4);
  } else if (kind === 'lespaul') {
    head(22, 5, 0x1a0e08, 6);
    neck(28, 44, 0x3a2014);
    body([49, 6.5, 5], [57, 8, 6.5], (x, y, e) => tone([0x3a1406, 0x7a3a10, 0xc0781c, 0xe8b040, 0xf8e08a], 0.95 - e * 0.95, x, y), 0xf0e8d0, 4);
    for (const py of [50, 55]) { P.rect(gx - 2, py, 5, 2, 0x1a1a1e); P.hl(gx - 2, py, 5, 0x9aa0a8); }
    P.hl(gx - 2, 59, 5, 0xc0c4cc);
    for (const [kx, ky] of [[gx + 4, 57], [gx + 5, 59], [gx + 3, 60], [gx + 4, 61]]) P.px(kx, ky, 0xf0c848);
  } else { // banjo
    head(23, 4, 0x3a2014, 4);
    neck(29, 47, 0x5a3418);
    for (let y = 46; y < 67; y++) for (let x = gx - 10; x <= gx + 10; x++) {
      const d = Math.hypot(x + 0.5 - gx, (y + 0.5 - 56.5) * 1.05);
      if (d > 9.5) continue;
      P.px(x, y, d > 8.4 ? tone(STEEL, 0.8 - (y - 46) / 30, x, y) : d > 7.6 ? 0x6a4a28 : tone([0xa89878, 0xc8b898, 0xe8dcc0, 0xf4ecd8, 0xfffaf0], 0.8 - d / 18 - (x - gx) * 0.02, x, y));
    }
    for (let a = 0; a < 16; a++) { const t = a / 16 * Math.PI * 2; P.px(Math.round(gx + Math.cos(t) * 9), Math.round(56.5 + Math.sin(t) * 8.6), 0xe8ecf0); } // spännskruvarna
    P.hl(gx - 2, 60, 5, 0x3a2014); for (let y = 40; y < 60; y++) if (y % 2) P.px(gx, y, 0xd8d8d0, 0.7);
  }
}
function paintGuitarWall(P) {
  const x0 = 9, x1 = 134, y0 = 13, y1 = 69;
  // spårpanel i grå eukalyptus med aluminiumlister
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    const ly = (y - y0) % 5;
    let c = ly === 4 ? 0x2a2622 : ly === 3 ? 0x5a544c : mix(0x7a7266, 0x8a8276, hash(x >> 4, y, 93));
    if (ly === 0) c = 0x9a9286;
    P.px(x, y, c);
  }
  P.box(x0 - 1, y0 - 1, x1 - x0 + 2, y1 - y0 + 2, 0x2a1e16);
  // handskriven kartongskylt längst upp
  {
    const t = $t('GITARRER - RÖR EJ!'), w = handW(SM, t, 3) + 8, sx = ((x0 + x1) >> 1) - (w >> 1), sy = 13;
    const S = skew(P, sx, 22, 1);
    S.rect(sx, sy, w, 8, 0xe0c898); S.hl(sx, sy, w, 0xf0dcb0); S.hl(sx, sy + 7, w, 0xa88a58);
    hand(S, SM, t, sx + 4, sy + 2, 0xa8141a, 3);
  }
  // krokarna (gitarrerna är egna bilder så att de kan gunga)
  for (const G of GUITARS) { P.px(G.x, 22, STEEL[3]); P.px(G.x, 23, STEEL[2]); P.px(G.x - 1, 23, STEEL[1]); P.px(G.x + 1, 23, STEEL[1]); }
  groundShadow(P, (x0 + x1) / 2, y1 + 1, (x1 - x0) / 2, 1.5, 0.3);
}
// en gitarr med sin prislapp
const GTAGS = [[6, 40, 1, 0xf4f0e2], [6, 45, 2, 0xfff08a], [-9, 48, 3, 0xf4f0e2], [7, 44, 4, 0xf4f0e2], [-11, 47, 5, 0xff9ab8]];
function paintGuitar(i) {
  const G = GUITARS[i];
  return sprite(G.x - 13, 20, 27, 50, (P) => {
    guitar(P, G.x, G.kind);
    const [dx, y, s, c] = GTAGS[i];
    tag(P, G.x + dx, y, s, c);
    outline(P, OUT, 0.35);
  });
}

// ---------- VI KÖPER GULD ----------
function paintGoldBoard(P) {
  const { x0, x1, top, bot } = GOLD;
  P.rect(x0, top, x1 - x0, bot - top, 0x141016);
  P.box(x0, top, x1 - x0, bot - top, BRASS[2]); P.box(x0 + 1, top + 1, x1 - x0 - 2, bot - top - 2, BRASS[0]);
  for (let y = top + 2; y < bot - 2; y++) for (let x = x0 + 2; x < x1 - 2; x++) if (hash(x, y, 101) > 0.93) P.px(x, y, 0x241c20);
  const t1 = $t('VI KÖPER'), w1 = textW(SM, t1);
  text(P, SM, t1, x0 + ((x1 - x0 - w1) >> 1), top + 4, 0xe8d8a8);
  const t2 = $t('GULD'), w2 = textW(BG, t2), gx = x0 + ((x1 - x0 - w2) >> 1);
  eachTextPixel(BG, t2, gx, top + 12, 1, (px, py) => P.px(px, py, tone(BRASS, 0.95 - (py - top - 12) / 8, px, py)));
  // en guldtacka
  const bx = x0 + 11, by = bot - 8;
  for (let j = 0; j < 4; j++) for (let i = j; i < 12 - j; i++) P.px(bx + i, by + j, j === 0 ? BRASS[4] : tone(BRASS, 0.75 - j * 0.12, bx + i, by + j));
  P.px(bx + 3, by + 1, 0xffffff);
  P.vl(x0 + 6, top - 2, 2, STEEL[2]); P.vl(x1 - 7, top - 2, 2, STEEL[2]);
}

// ---------- klockväggen ----------
function clockFace(P, cx, cy, r, rim = BRASS, face = 0xf4ecd8) {
  for (let y = Math.floor(cy - r - 1); y <= cy + r + 1; y++) for (let x = Math.floor(cx - r - 1); x <= cx + r + 1; x++) {
    const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
    if (d > r + 1) continue;
    P.px(x, y, d > r ? tone(rim, 0.7 - (y - cy) / (r * 3) - (x - cx) / (r * 4), x, y) : mix(face, 0xb8a888, d / r * 0.25));
  }
  for (let k = 0; k < 12; k++) { const t = k / 12 * Math.PI * 2; if (r > 4 || k % 3 === 0) P.px(Math.round(cx + Math.cos(t) * (r - 1)), Math.round(cy + Math.sin(t) * (r - 1)), 0x2a2420); }
}
// visaren ritas levande; här kläder urtavlorna och fodralen
const CLOCKS = [
  { id: 'reg', cx: 221, cy: 22, r: 5, off: 0 },            // regulatorn: den enda som går rätt
  { id: 'gok', cx: 243, cy: 30, r: 4, off: 37 },           // gökuret
  { id: 'station', cx: 236, cy: 59, r: 5, off: -95 },      // stationsuret
];
function paintClocks(P) {
  // regulatorn: hög väggklocka i mörk ek med glasdörr och pendelfönster
  {
    const { x0, x1, top, bot } = REG;
    sbox(P, x0, top + 3, x1 - x0, bot - top - 3, 0x5a3418);
    for (let i = 0; i < x1 - x0; i++) P.px(x0 + i, top + 2 - (i > 3 && i < x1 - x0 - 4 ? 1 : 0), MAHOG[3]); // krönet
    P.rect(x0 + 5, top - 1, 4, 2, MAHOG[3]); P.px(x0 + 6, top - 2, BRASS[3]);
    clockFace(P, 221, 22, 5);
    P.rect(x0 + 3, 31, x1 - x0 - 6, bot - 35, 0x1a1008);                       // pendelfönstret
    P.box(x0 + 2, 30, x1 - x0 - 4, bot - 33, BRASS[1]);
    glare(P, x0 + 3, 31, x1 - x0 - 6, bot - 35, 0.18, 9, 2);
    P.rect(x0 + 2, bot - 3, x1 - x0 - 4, 2, MAHOG[2]); P.px(x0 + 6, bot - 1, MAHOG[1]); P.px(x0 + 7, bot, MAHOG[1]); // droppen under
  }
  // gökuret: litet schweizerhus med tak, snidade löv och kottar i kedjor
  {
    const { x0, x1, top } = CUCKOO, cx = (x0 + x1) >> 1;
    for (let j = 0; j < 7; j++) for (let i = -12 + j; i <= 12 - j; i++) P.px(cx + i, top + 6 - j, j === 6 ? MAHOG[4] : tone(MAHOG, 0.35 + (6 - j) * 0.02 - i * 0.01, cx + i, j)); // taket
    for (let i = -12; i <= 12; i += 2) P.px(cx + i, top + 7, 0x8a4a1a);
    sbox(P, x0 + 3, top + 7, x1 - x0 - 6, 20, 0x7a4a24);
    P.rect(cx - 2, top + 8, 5, 5, 0x2a1408); P.box(cx - 3, top + 7, 7, 7, MAHOG[3]); // luckan där göken bor
    clockFace(P, cx, top + 18, 4, [0x2a1408, 0x4a2410, 0x6a3a1a, 0x8a5a2a, 0xa87a3a], 0xf0e6d0);
    for (const [lx, ly] of [[x0 + 2, top + 12], [x1 - 3, top + 12], [x0 + 3, top + 24], [x1 - 4, top + 24], [cx - 6, top + 26], [cx + 6, top + 26]]) { // snidade löv
      P.px(lx, ly, 0x5a7a2a); P.px(lx + 1, ly - 1, 0x4a6a1a); P.px(lx - 1, ly + 1, 0x3a5a14);
    }
    P.px(cx, top + 27, 0x8a5a2a); P.px(cx - 1, top + 28, 0x5a3a18); P.px(cx + 1, top + 28, 0x5a3a18); // fågeln på krönet nertill
    for (const [kx, len] of [[cx - 4, 6], [cx + 3, 12]]) { // kedjorna och kottarna
      for (let y = top + 27; y < top + 27 + len; y++) P.px(kx, y, y % 2 ? STEEL[3] : STEEL[1]);
      for (let j = 0; j < 6; j++) for (let i = -1; i <= 1; i++) if (!(j === 5 && i)) P.px(kx + i, top + 27 + len + j, (i + j) % 2 ? 0x6a3a14 : 0x4a2a0a);
    }
  }
  // stationsuret: runt i svart plåt med sekundvisare
  clockFace(P, 236, 59, 5, STEEL, 0xf8f6ee);
  P.px(236, 52, STEEL[1]); P.px(236, 51, STEEL[1]);
  // prislappar på snören
  tag(P, REG.x0 - 1, 32, 11); tag(P, CUCKOO.x1 - 3, 30, 12, 0xfff08a); tag(P, 242, 62, 13);
}

// ---------- de tre guldkulorna – pantbankernas gamla tecken ----------
function paintBalls(P) {
  const cx = (BALLS.x0 + BALLS.x1) >> 1, y = 14;
  // konsolen i smide
  P.hl(cx - 16, y, 33, STEEL[1]); P.hl(cx - 16, y + 1, 33, STEEL[0]);
  for (let k = 0; k < 5; k++) { P.px(cx - 16 + k, y + 2 + k, STEEL[1]); P.px(cx + 16 - k, y + 2 + k, STEEL[1]); }
  P.px(cx, y - 1, STEEL[2]); P.px(cx - 1, y - 2, STEEL[2]); P.px(cx + 1, y - 2, STEEL[2]); P.px(cx, y - 3, BRASS[3]);
  for (const [bx, by] of [[cx - 10, 30], [cx + 10, 30], [cx, 39]]) {
    for (let yy = y + 2; yy < by - 5; yy++) P.px(bx, yy, yy % 2 ? BRASS[1] : BRASS[2]);
    goldBall(P, bx + 0.5, by, 5.4);
  }
}

// ---------- TV-hyllan: gamla tv-apparater på en hylla i plåt ----------
// skärmarna [x, y, w, h] fylls levande
const SCREENS = [
  { x: 310, y: 19, w: 16, h: 12, kind: 'test' },
  { x: 335, y: 25, w: 10, h: 8, kind: 'snow' },
  { x: 356, y: 17, w: 20, h: 15, kind: 'fisk' },
  { x: 311, y: 50, w: 18, h: 13, kind: 'fotboll' },
  { x: 342, y: 52, w: 13, h: 10, kind: 'snow' },
];
function crt(P, x, y, w, h, s, cab, knobs = true) {
  sbox(P, x, y, w, h, cab);
  for (let j = 0; j < s.h + 2; j++) for (let i = 0; i < s.w + 2; i++) P.px(s.x - 1 + i, s.y - 1 + j, (i === 0 || j === 0) ? 0x0a0a0c : 0x2a2a2e);
  if (knobs) {
    const kx = s.x + s.w + 2;
    if (kx + 2 < x + w) { P.px(kx, s.y + 1, 0xd8d0c0); P.px(kx + 1, s.y + 1, 0x6a6258); P.px(kx, s.y + 4, 0xd8d0c0); P.px(kx + 1, s.y + 4, 0x6a6258); for (let k = 0; k < 3; k++) P.hl(kx, s.y + 7 + k * 2, 2, mul(cab, 0.6)); }
  }
}
function paintTvRack(P) {
  const { x0, x1, top, b1, b2 } = TVR;
  // plåthyllan: stolpar och två hyllplan
  for (const b of [b1, b2]) { P.hl(x0, b, x1 - x0, STEEL[3]); P.hl(x0, b + 1, x1 - x0, STEEL[1]); for (let x = x0 + 2; x < x1 - 2; x += 4) P.px(x, b + 1, STEEL[0]); }
  for (const sx of [x0, x1 - 2]) { P.vl(sx, top, b2 - top + 2, STEEL[2]); P.vl(sx + 1, top, b2 - top + 2, STEEL[0]); }
  // övre hyllan: trä-tv, liten bärbar med antenn, stor tv
  crt(P, 306 + 2, 15, 26, b1 - 15, SCREENS[0], 0x7a4a24);
  P.rect(311, b1 - 5, 16, 3, 0x5a3418); for (let k = 0; k < 6; k++) P.px(312 + k * 2, b1 - 4, 0x2a1a0a);        // högtalartyget
  crt(P, 333, 22, 15, b1 - 22, SCREENS[1], 0xd8d4c8);
  P.line(338, 22, 332, 12, STEEL[3]); P.line(342, 22, 349, 13, STEEL[3]); P.px(332, 12, 0xffffff); P.px(349, 13, 0xffffff); // antennen
  crt(P, 353, 14, 29, b1 - 14, SCREENS[2], 0x3a3a40);
  P.hl(357, b1 - 4, 20, 0x5a5a62); P.px(378, b1 - 6, 0xd83a2a);                                             // lampan
  // nedre hyllan: en till tv, en liten, videobandspelare i stapel
  crt(P, 308, 46, 25, b2 - 46, SCREENS[3], 0x6a6258);
  crt(P, 339, 49, 18, b2 - 49, SCREENS[4], 0x9a3a2a, false);
  for (let k = 0; k < 3; k++) { const vy = b2 - 5 - k * 5; sbox(P, 360, vy, 22, 5, [0x2a2a30, 0x3a3a42, 0x1e1e24][k]); P.hl(363, vy + 2, 8, 0x0a0a0c); P.px(378, vy + 2, k === 1 ? 0x40ff60 : 0xd82a2a); }
  // prislappar
  tag(P, 330, 33, 21, 0xfff08a); tag(P, 380, 34, 22); tag(P, 334, 62, 23);
  // SÅLD-lapp tejpad snett på den stora
  { const S = skew(P, 360, 4, 1); S.rect(360, 34, 15, 6, 0xffffff); text(S, SM, $t('SÅLD'), 361, 35, 0xd8202a); }
}

// ---------- pantlagret: hylla med kvittonumrerade panter ----------
function paintPawnShelf(P) {
  const { x0, x1, top, b1, b2 } = PSH;
  // mörkbetsad bokhylla med rygg
  // varje fack har en liten lampa i taket som lyser upp panterna
  const fackTop = (y) => (y < b1 ? top + 9 : b1 + 3);
  for (let y = top + 9; y < b2; y++) for (let x = x0 + 2; x < x1 - 2; x++) {
    const lx = (x - x0 - 2) % 34, lit = Math.max(0, 1 - Math.hypot(lx - 15, (y - fackTop(y)) * 1.4) / 22);
    P.px(x, y, mix(hash(x, y, 111) > 0.9 ? 0x241208 : 0x34200f, 0x8a6a3a, lit * 0.5));
  }
  for (const yy of [top + 9, b1 + 3]) for (const lx of [x0 + 17, x0 + 51]) { P.hl(lx - 3, yy, 7, BRASS[1]); P.hl(lx - 2, yy + 1, 5, 0xfff0c0); }
  for (const b of [b1, b2]) { P.hl(x0, b, x1 - x0, MAHOG[3]); P.hl(x0, b + 1, x1 - x0, MAHOG[1]); P.hl(x0, b + 2, x1 - x0, 0x0a0604, 0.5); }
  for (const sx of [x0, (x0 + x1) >> 1, x1 - 2]) { P.vl(sx, top, b2 - top + 2, MAHOG[3]); P.vl(sx + 1, top, b2 - top + 2, MAHOG[1]); }
  // skylten PANTER överst: svart med guld
  P.rect(x0, top, x1 - x0, 9, 0x141016); P.hl(x0, top, x1 - x0, BRASS[2]); P.hl(x0, top + 8, x1 - x0, BRASS[1]);
  const t = $t('PANTER'), tw = textW(SM, t);
  eachTextPixel(SM, t, x0 + ((x1 - x0 - tw) >> 1), top + 2, 1, (px, py) => P.px(px, py, py < top + 4 ? BRASS[4] : BRASS[3]));
  for (const x of [x0 + 4, x1 - 7]) { P.px(x, top + 4, BRASS[3]); P.px(x + 1, top + 4, BRASS[3]); }
}

// ---------- framväggen: gallerfönster, dörren och PANTBANKEN spegelvänt ----------
function paintFront(P) {
  const y0 = FRONT_Y;
  for (let x = 0; x < W; x++) { P.px(x, y0, 0x1e120c); P.px(x, y0 + 1, 0x3a2418); P.px(x, y0 + 2, 0x5a3a26); P.px(x, y0 + 3, 0xa88a6a); }
  // fönsterglaset ritas levande (dag/kväll) – här karmarna och gallret inne i butiken
  for (const x of [DOOR.x0 - 3, DOOR.x1, 270, W - SIDE - 1]) { P.rect(x, y0 + 3, 3, H - y0 - 3, 0x3a2418); P.vl(x, y0 + 3, H - y0 - 3, 0x6a4a30); }
  // sidoväggarna
  P.rect(0, 0, SIDE, H, 0x1e140e); P.vl(SIDE - 1, CEIL, H - CEIL, 0x3a2a1e);
  P.rect(W - SIDE, 0, SIDE, H, 0x1e140e); P.vl(W - SIDE, CEIL, H - CEIL, 0x3a2a1e);
}
// gallret framför fönstren (egen bild – ligger över det levande glaset)
function paintFrontBars() {
  return sprite(0, FRONT_Y, W, H - FRONT_Y, (P) => {
    const y0 = FRONT_Y + 4;
    const bars = (x0, x1) => {
      for (let x = x0 + 2; x < x1 - 1; x += 5) { P.vl(x, y0, H - y0, 0x1a1a1e); P.vl(x + 1, y0, H - y0, 0x4a4e58); }
      P.hl(x0, y0 + 5, x1 - x0, 0x1a1a1e); P.hl(x0, y0 + 6, x1 - x0, 0x4a4e58);
    };
    bars(SIDE, DOOR.x0 - 3); bars(DOOR.x1 + 3, 270); bars(273, W - SIDE - 1);
    // PANTBANKEN i guld – spegelvänt inifrån, på det högra fönstret
    const N = new Pix(80, 9);
    text(N, BG, $t('PANTBANKEN'), 1, 1, 0xffffff);
    const nx = 300, ny = FRONT_Y + 6;
    for (let y = 0; y < 9; y++) for (let x = 0; x < 80; x++) if (N.d[(y * 80 + x) * 4 + 3]) P.px(nx + 79 - x, ny + y, y < 4 ? 0xe8c060 : 0xb88a2a);
    // lappen i dörrens fönster: STÄNGT syns inifrån när det är ÖPPET utåt
    const sw = textW(SM, $t('STÄNGT')) + 5, sx = DOOR.x0 + ((DOOR.x1 - DOOR.x0 - sw) >> 1), sy = FRONT_Y + 7;
    P.line(sx + 3, sy - 3, sx + (sw >> 1), sy - 6, 0x8a8a80); P.line(sx + sw - 4, sy - 3, sx + (sw >> 1), sy - 6, 0x8a8a80);
    P.rect(sx, sy - 2, sw, 9, 0xf4f0e2); P.box(sx, sy - 2, sw, 9, 0x8a2a1a);
    text(P, SM, $t('STÄNGT'), sx + 3, sy, 0x8a2a1a);
  });
}
// dörren: mörkt trä med ett litet gallerfönster (ritas i bakgrunden, öppnas levande)
function paintDoor(P) {
  const y0 = FRONT_Y + 2;
  P.rect(DOOR.x0, y0, DOOR.x1 - DOOR.x0, H - y0, 0x3a1e12);
  for (let y = y0; y < H; y++) for (let x = DOOR.x0 + 1; x < DOOR.x1 - 1; x++) P.px(x, y, tone(MAHOG, 0.45 + ((x - DOOR.x0) % 7 === 0 ? -0.15 : 0) + hash(x, y, 121) * 0.08, x, y));
  P.hl(DOOR.x0 + 3, y0 + 14, 8, BRASS[3]); P.hl(DOOR.x0 + 3, y0 + 15, 8, BRASS[1]); // tvärhandtaget
}

function paintBackground() {
  const P = new Pix(W, H);
  paintFloor(P);
  paintCeiling(P);
  paintWall(P);
  paintGuitarWall(P);
  paintGoldBoard(P);
  paintClocks(P);
  paintBalls(P);
  paintTvRack(P);
  paintPawnShelf(P);
  paintFront(P);
  paintDoor(P);
  return P.flush();
}

// ================= föremålen på golvet (egna bilder, y-sorteras med figurerna) =================
// ---------- glasdisken med gallret ----------
// små smycken sedda uppifrån genom glasskivan
function jewelTop(P, x, y, k) {
  const g = [0xf8d870, 0xe8e8f0, 0xf0c040][k % 3], gem = [0xd82a4a, 0x3a8ae8, 0x40d080, 0xffffff][(k >> 2) % 4];
  switch (k % 5) {
    case 0: P.px(x, y, g); P.px(x + 1, y, gem); P.px(x + 2, y, g); P.px(x + 1, y + 1, mul(g, 0.7)); break;            // ring med sten
    case 1: P.rect(x, y, 2, 2, 0xf4f0e6); P.px(x + 1, y, 0x2a2a30); P.px(x - 1, y, 0x3a2418); P.px(x + 2, y + 1, 0x3a2418); break; // armbandsur
    case 2: for (let i = 0; i < 6; i++) P.px(x + i, y + (i & 1), g); break;                                          // kedja
    case 3: P.px(x, y, g); P.px(x + 1, y + 1, g); P.px(x + 2, y, g); break;                                           // örhängen
    default: P.px(x, y, BRASS[3]); P.px(x + 1, y, BRASS[2]); P.px(x, y + 1, BRASS[1]);                              // guldmynt
  }
}
function paintCounter() {
  const Y0 = GRL.top - 4;
  return sprite(CNT.x0 - 1, Y0, CNT.x1 - CNT.x0 + 3, CNT.base - Y0 + 4, (P) => {
    const { top, face, base } = CNT;
    // ---- disklocket i mahogny (personalens väg ut) ----
    for (let y = top; y < base; y++) for (let x = FLAP.x0; x < FLAP.x1; x++) {
      const i = x - FLAP.x0, j = y - face;
      let v = y < face ? 0.7 - (y - top) * 0.05 : 0.45;
      if (y >= face) { if (i === 2 || j === 2) v = 0.7; else if (i === FLAP.x1 - FLAP.x0 - 3 || j === 18) v = 0.22; else if (i < 2 || j < 2 || i > FLAP.x1 - FLAP.x0 - 3 || j > 18) v = 0.36; }
      if (y >= base - 3) v = 0.18;
      P.px(x, y, tone(MAHOG, v, x, y));
    }
    P.hl(FLAP.x0, top, FLAP.x1 - FLAP.x0, MAHOG[4]); P.vl(FLAP.x0 + 3, top + 1, 5, MAHOG[1]); // gångjärnsskarven
    P.px(FLAP.x0 + 14, top + 3, BRASS[3]); P.px(FLAP.x0 + 15, top + 3, BRASS[1]);               // ringen man lyfter i
    P.rect(FLAP.x0 + 3, face + 6, 14, 7, 0xe8e0c8); P.box(FLAP.x0 + 3, face + 6, 14, 7, BRASS[1]);
    text(P, SM, $t('EJ IN'), FLAP.x0 + 4, face + 7, 0xa8141a);
    // ---- glasmontern ----
    const gx0 = FLAP.x1, gx1 = CNT.x1;
    // insidan sedd uppifrån genom glasskivan: sammetsbrickor med smycken
    for (let y = top + 1; y < face - 1; y++) for (let x = gx0; x < gx1; x++) P.px(x, y, tone(VELVET, 0.55 - (y - top) * 0.05 + (((x - gx0) % 30) < 1 ? -0.3 : 0), x, y));
    for (let x = gx0 + 3, k = 0; x < gx1 - 5; x += 5 + Math.floor(hash(x, 1, 131) * 4), k++) {
      if (x > HATCH.x0 + 1 && x < HATCH.x1 - 5) continue;
      jewelTop(P, x, top + 2 + (k % 3 === 0 ? 1 : 0) + (k % 2), Math.floor(hash(x, k, 132) * 20));
    }
    // framsidan i glas: en hylla med smycken, fickur, en byst med guldkedja och guldtanden
    for (let y = face; y < base - 6; y++) for (let x = gx0; x < gx1; x++) P.px(x, y, tone(VELVET, 0.62 - (y - face) / 30, x, y));
    const shelfY = face + 9;
    P.hl(gx0, shelfY, gx1 - gx0, 0xf0e8f0, 0.7); P.hl(gx0, shelfY + 1, gx1 - gx0, VELVET[0]);
    let x = gx0 + 4, k = 0;
    while (x < gx1 - 10) {
      const kind = Math.floor(hash(x, k, 133) * 7);
      if (kind === 0) { // byst med kedja
        for (let j = 0; j < 8; j++) for (let i = -(1 + (j >> 1)); i <= 1 + (j >> 1); i++) P.px(x + 3 + i, shelfY - 8 + j, j < 3 ? 0x1a0e14 : 0x241420);
        P.px(x + 3, shelfY - 8, 0x3a2430);
        for (let i = -2; i <= 2; i++) P.px(x + 3 + i, shelfY - 4 + (Math.abs(i) < 2 ? 1 : 0), BRASS[3]); P.px(x + 3, shelfY - 2, 0xd82a4a);
        x += 9;
      } else if (kind === 1) { // fickur med kedja
        for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) P.px(x + i, shelfY - 5 + j, (i === 0 || j === 0 || i === 3 || j === 3) ? BRASS[2] : 0xf4ecd8);
        P.px(x + 1, shelfY - 4, 0x2a2420); P.px(x + 2, shelfY - 3, 0x2a2420); P.px(x + 1, shelfY - 6, BRASS[3]);
        for (let i = 0; i < 5; i++) P.px(x + 4 + i, shelfY - 2 + (i % 2), BRASS[3]);
        x += 11;
      } else if (kind === 2) { // ringkonor
        for (let r = 0; r < 3; r++) { P.vl(x + r * 3, shelfY - 5, 5, 0xe8e0d0); P.px(x + r * 3, shelfY - 5, 0xffffff); P.px(x + r * 3, shelfY - 3, [BRASS[3], 0xd8dce4, BRASS[3]][r]); P.px(x + r * 3 - 1, shelfY - 3, [0xd82a4a, 0x3a8ae8, 0x40d080][r]); }
        x += 10;
      } else if (kind === 3) { // guldtanden på ett kort
        P.rect(x, shelfY - 6, 8, 6, 0xf4f0e6); P.hl(x, shelfY - 6, 8, 0xffffff);
        P.px(x + 3, shelfY - 5, BRASS[4]); P.px(x + 4, shelfY - 5, BRASS[3]); P.px(x + 3, shelfY - 4, BRASS[3]); P.px(x + 4, shelfY - 4, BRASS[2]); P.px(x + 3, shelfY - 3, BRASS[2]); P.px(x + 5, shelfY - 3, BRASS[1]);
        x += 11;
      } else if (kind === 4) { // öppen klockask
        P.rect(x, shelfY - 4, 7, 4, 0x1a1a2a); P.rect(x, shelfY - 8, 7, 4, 0x2a2a44); P.rect(x + 1, shelfY - 3, 5, 2, 0xe8e0f0);
        P.rect(x + 2, shelfY - 4, 3, 3, BRASS[2]); P.px(x + 3, shelfY - 3, 0xf4ecd8);
        x += 10;
      } else if (kind === 5) { // halsband på ställning
        P.vl(x + 3, shelfY - 8, 8, 0x2a1a24); P.hl(x, shelfY - 8, 7, 0x2a1a24);
        for (let i = 0; i < 7; i++) P.px(x + i, shelfY - 7 + Math.round(Math.sin(i / 6 * Math.PI) * 4), i === 3 ? 0x3a8ae8 : 0xe8e8f0);
        x += 10;
      } else { // mynt i en rad
        for (let i = 0; i < 3; i++) { P.px(x + i * 2, shelfY - 2, BRASS[3]); P.px(x + i * 2 + 1, shelfY - 2, BRASS[1]); P.px(x + i * 2, shelfY - 3, BRASS[4]); }
        x += 8;
      }
      if (hash(x, k, 134) > 0.55) { P.rect(x - 3, shelfY + 2, 3, 2, 0xf8f8f0); P.px(x - 2, shelfY + 2, 0xd8202a); } // prislapp
      x += 1 + Math.floor(hash(x, k, 135) * 3); k++;
    }
    // nedre hyllan: ringar i rader på sammetsdynor
    for (let x2 = gx0 + 3; x2 < gx1 - 4; x2 += 3) if (hash(x2, 2, 136) > 0.35) { P.px(x2, shelfY + 5, hash(x2, 3, 136) > 0.5 ? BRASS[3] : 0xd8dce4); P.px(x2 + 1, shelfY + 5, hash(x2, 4, 136) > 0.7 ? 0xd82a4a : BRASS[1]); }
    // glaset: blå ton, reflexer, fingeravtryck
    for (let y = top; y < base - 6; y++) for (let x2 = gx0; x2 < gx1; x2++) P.px(x2, y, 0xc8e8ff, y < face ? 0.12 : 0.08);
    glare(P, gx0, top + 1, gx1 - gx0, face - top - 2, 0.3, 17, 1);
    glare(P, gx0, face + 1, gx1 - gx0, base - face - 8, 0.22, 23, 3);
    for (let n = 0; n < 7; n++) { const fx = gx0 + 10 + Math.floor(hash(n, 1, 137) * (gx1 - gx0 - 20)), fy = face + 3 + Math.floor(hash(n, 2, 137) * 8); P.px(fx, fy, 0xffffff, 0.3); P.px(fx + 1, fy + 1, 0xffffff, 0.25); P.px(fx - 1, fy + 1, 0xffffff, 0.2); }
    // ramen: mässingslist överst, mahognystolpar, sparklist med mässingsskydd
    P.hl(gx0, top, gx1 - gx0, BRASS[3]); P.hl(gx0, face - 1, gx1 - gx0, MAHOG[2]); P.hl(gx0, face, gx1 - gx0, BRASS[1]);
    for (const px of [gx0, 238, 300, 362, 424, gx1 - 2]) { P.vl(px, top, base - top, MAHOG[3]); P.vl(px + 1, top, base - top, MAHOG[1]); }
    for (let y = base - 6; y < base; y++) for (let x2 = gx0; x2 < gx1; x2++) P.px(x2, y, y === base - 6 ? MAHOG[4] : y >= base - 2 ? BRASS[y === base - 2 ? 3 : 1] : tone(MAHOG, 0.4 + ((x2 - gx0) % 31 === 0 ? -0.2 : 0), x2, y));
    // pengabrickan i luckan: en grop i disken
    P.rect(HATCH.x0 + 4, top + 1, HATCH.x1 - HATCH.x0 - 8, 5, 0x8a6414); P.hl(HATCH.x0 + 4, top + 1, HATCH.x1 - HATCH.x0 - 8, 0x5a3a0a); P.hl(HATCH.x0 + 5, top + 5, HATCH.x1 - HATCH.x0 - 10, BRASS[3]);
    // ---- bordslampan i grönt glas (bakom gallret, på diskens bortre kant) ----
    { const lx = 375, GL = [0x0a3a1a, 0x145a2a, 0x1e7a3a, 0x3aa85a, 0x8ae0a0];
      P.hl(lx - 5, top - 1, 11, BRASS[1]); P.hl(lx - 4, top - 2, 9, BRASS[3]);           // foten
      P.vl(lx, top - 9, 7, BRASS[2]); P.vl(lx + 1, top - 9, 7, BRASS[0]);                  // armen
      for (let j = 0; j < 5; j++) for (let i = -8; i <= 8; i++) {                          // den gröna glasskärmen
        if (j === 0 && Math.abs(i) > 6) continue;
        P.px(lx + i, top - 14 + j, j === 4 ? 0xfff4c0 : tone(GL, 0.85 - j * 0.14 - Math.abs(i) * 0.02 - i * 0.02, lx + i, j));
      }
      P.hl(lx - 6, top - 14, 12, 0xb8f0c8); P.px(lx - 8, top - 10, BRASS[3]); P.px(lx + 8, top - 10, BRASS[1]);
      P.vl(lx + 4, top - 9, 3, BRASS[2]); P.px(lx + 4, top - 6, BRASS[3]); }                // dragkedjan
    // ---- gallret (målas efter konturen – annars fyller konturen glipan mellan stängerna) ----
    const paintGrille = () => {
    const gT = GRL.top, gB = top;
    const inHatch = (x2, y) => x2 >= HATCH.x0 && x2 < HATCH.x1 && y >= HATCH.top;
    for (let bx = gx0 + 2; bx < gx1 - 1; bx += 5) {
      for (let y = gT; y < gB; y++) { if (inHatch(bx, y) || inHatch(bx + 1, y)) continue; P.px(bx, y, 0x5a5e68); P.px(bx + 1, y, 0x1e1e24); }
      if (!(bx >= HATCH.x0 - 1 && bx < HATCH.x1)) { P.px(bx, gT - 1, 0x5a5e68); P.px(bx + 1, gT - 1, 0x2a2a30); P.px(bx, gT - 2, 0x8a8e98); } // spjutspetsar
    }
    for (const [y, th] of [[gT, 2], [gT + 17, 1], [gB - 2, 2]]) for (let t2 = 0; t2 < th; t2++) for (let x2 = gx0; x2 < gx1; x2++) { if (inHatch(x2, y + t2)) continue; P.px(x2, y + t2, t2 === 0 ? 0x6a6e78 : 0x1e1e24); }
    for (const px of [gx0, 219, gx1 - 3]) for (let y = gT - 3; y < gB; y++) { P.px(px, y, 0x7a7e88); P.px(px + 1, y, 0x3a3e46); P.px(px + 2, y, 0x1e1e24); } // grova stolpar
    // luckans mässingsram
    for (let y = HATCH.top - 1; y < gB; y++) { P.px(HATCH.x0 - 1, y, BRASS[3]); P.px(HATCH.x0 - 2, y, BRASS[1]); P.px(HATCH.x1, y, BRASS[1]); P.px(HATCH.x1 + 1, y, BRASS[0]); }
    P.hl(HATCH.x0 - 2, HATCH.top - 1, HATCH.x1 - HATCH.x0 + 4, BRASS[3]); P.hl(HATCH.x0 - 2, HATCH.top, HATCH.x1 - HATCH.x0 + 4, BRASS[1]);
    // emaljskylten PANTLÅN ovanför luckan
    {
      const { x0: sx0, x1: sx1, top: st, bot: sb } = SIGN;
      P.rect(sx0, st, sx1 - sx0, sb - st, 0xf4f0e6); P.box(sx0, st, sx1 - sx0, sb - st, 0x1a1a24); P.box(sx0 + 1, st + 1, sx1 - sx0 - 2, sb - st - 2, 0xc8202a);
      for (let y = st + 2; y < sb - 2; y++) for (let x2 = sx0 + 2; x2 < sx1 - 2; x2++) if (hash(x2, y, 141) > 0.97) P.px(x2, y, 0x3a3440, 0.6); // emaljen har slagits av här och där
      const c = (s, F, y, col) => text(P, F, s, sx0 + ((sx1 - sx0 - textW(F, s)) >> 1), y, col);
      c($t('PANTLÅN'), BG, st + 4, 0xc8202a);
      c($t('LÅN 40 %'), SM, st + 13, 0x1a1a24);
      c($t('RÄNTA 20 %'), SM, st + 19, 0x1a1a24);
      c($t('7 DAGAR'), SM, sb - 7 + 1, 0x1a1a24);
      P.px(sx0 + 3, st + 3, 0xd8dce4); P.px(sx1 - 4, st + 3, 0xd8dce4); // skruvarna
    }
    // lappar tejpade på gallret
    const note = (x2, y, s, paper, ink, seed) => {
      const w = handW(SM, s, seed) + 5, S = skew(P, x2, 10, seed % 2 ? 1 : -1);
      S.rect(x2, y, w, 8, paper); S.hl(x2, y, w, mix(paper, 0xffffff, 0.4)); S.hl(x2, y + 7, w, mul(paper, 0.8));
      hand(S, SM, s, x2 + 3, y + 2, ink, seed);
      S.rect(x2 + 1, y - 1, 4, 2, 0xf8f8f0, 0.6); S.rect(x2 + w - 5, y - 1, 4, 2, 0xf8f8f0, 0.6);
    };
    // (lapparna sitter på glasmontern – på gallret skulle de skymma pantlånaren)
    note(184, face + 2, $t('INGA RETURER'), 0xf8f4e8, 0xc8141a, 3);
    note(318, face + 3, $t('LEG. KRÄVS'), 0xfff08a, 0x1a1a3a, 4);
    note(404, face + 2, $t('KONTANT'), 0xf8f4e8, 0x1a1a3a, 5);
    };
    // ---- på disken, kundens sida: disklockan, pennan i kedja, kvittospiken ----
    { const bx = BELL.x, by = BELL.y;
      P.hl(bx - 3, by + 3, 7, 0x1a1a1e); P.hl(bx - 2, by + 2, 5, 0x2a2a30);
      for (let j = 0; j < 3; j++) for (let i = -2 + (j === 0 ? 1 : 0); i <= 2 - (j === 0 ? 1 : 0); i++) P.px(bx + i, by - 1 + j, tone(BRASS, 0.95 - j * 0.22 - i * 0.08, bx + i, j));
      P.px(bx, by - 2, BRASS[2]); P.px(bx - 1, by - 1, 0xffffff); }
    P.line(232, top + 4, 228, top + 2, 0x2a2a30); P.hl(224, top + 2, 5, 0x3a6ad8); P.px(223, top + 2, 0xf4f0e6); // pennan i kedjan
    P.vl(314, top - 4, 7, STEEL[3]); for (let k2 = 0; k2 < 3; k2++) P.hl(311, top - 1 + k2, 7, 0xf4f0e6); P.px(314, top - 5, STEEL[4]); // kvittospiken
    outline(P, OUT, 0.45);
    paintGrille();
    groundShadow(P, (CNT.x0 + CNT.x1) / 2, base + 1, (CNT.x1 - CNT.x0) / 2, 2.5, 0.45);
  });
}

// ---------- kassaskåpet med övervakningsmonitorn ----------
function paintSafe(open) {
  const { x0, x1, top, base } = SAFE;
  return sprite(x0 - 4, top - 14, x1 - x0 + 8, base - top + 17, (P) => {
    const w = x1 - x0, h = base - top;
    // stommen: grönsvart stål med mässingslister
    for (let y = top; y < base - 2; y++) for (let x = x0; x < x1; x++) P.px(x, y, tone([0x121a16, 0x1e2a24, 0x2e3e36, 0x4a5e52, 0x7a9282], 0.5 - (x - x0) / w * 0.25 + (y === top ? 0.35 : 0), x, y));
    P.hl(x0, top, w, 0x7a9282); P.vl(x0, top, h - 2, 0x4a5e52); P.vl(x1 - 1, top, h - 2, 0x121a16);
    for (const fx of [x0 + 1, x1 - 4]) { P.rect(fx, base - 2, 3, 2, 0x0e1210); P.px(fx, base - 2, 0x3a4a42); } // fötterna
    if (!open) {
      P.box(x0 + 2, top + 3, w - 4, h - 8, BRASS[1]); P.hl(x0 + 3, top + 3, w - 6, BRASS[3]);
      // kombinationsratten och vredet
      const dx = x0 + 11, dy = top + 13;
      for (let y = dy - 4; y <= dy + 4; y++) for (let x = dx - 4; x <= dx + 4; x++) { const d = Math.hypot(x - dx, y - dy); if (d <= 4) P.px(x, y, d > 3 ? BRASS[1] : d > 2 ? tone(STEEL, 0.9 - (y - dy) / 8, x, y) : 0x1a1e20); }
      for (let a = 0; a < 8; a++) { const t = a / 8 * Math.PI * 2; P.px(Math.round(dx + Math.cos(t) * 3), Math.round(dy + Math.sin(t) * 3), 0xf4f0e0); }
      P.px(dx, dy - 4, 0xd82a2a);
      const hx = x0 + 23, hy = top + 17;
      P.px(hx, hy, BRASS[3]); for (let k = 1; k <= 3; k++) { P.px(hx - k, hy - k, BRASS[2]); P.px(hx + k, hy - k, BRASS[2]); P.px(hx, hy + k, BRASS[2]); }
      text(P, SM, '1912', x0 + 9, base - 11, BRASS[2]);
      script(P, x0 + 5, top + 5, w - 10, BRASS[2], 7, 0.8);
    } else {
      // öppet: sedelbuntar och guldtackor därinne, dörren utsvängd åt vänster
      P.rect(x0 + 2, top + 3, w - 4, h - 8, 0x0e1210);
      for (const sy of [top + 11, top + 19]) P.hl(x0 + 2, sy, w - 4, 0x3a4a42);
      for (let k = 0; k < 4; k++) { P.rect(x0 + 4 + k * 6, top + 6, 5, 5, 0x5a8a4a); P.hl(x0 + 4 + k * 6, top + 8, 5, 0xe8e0c8); }
      for (let k = 0; k < 3; k++) for (let j = 0; j < 3; j++) for (let i = j; i < 7 - j; i++) P.px(x0 + 5 + k * 8 + i, top + 16 + j, j === 0 ? BRASS[4] : BRASS[3 - j]);
      for (let k = 0; k < 5; k++) P.rect(x0 + 4 + k * 5, top + 21, 3, 3, [0xc84a3a, 0x3a6ad8, 0x5a8a4a, 0xe0c060, 0x8a5ad8][k]);
      for (let y = top + 1; y < base - 3; y++) for (let x = x0 - 3; x < x0 + 1; x++) P.px(x, y, x === x0 - 3 ? 0x7a9282 : tone([0x121a16, 0x1e2a24, 0x2e3e36, 0x4a5e52, 0x7a9282], 0.4, x, y));
    }
    // övervakningsmonitorn ovanpå (bilden ritas levande)
    sbox(P, x0 + 7, top - 13, 18, 13, 0xd8d4c8); P.rect(x0 + 9, top - 11, 14, 9, 0x0a0c0a);
    P.px(x0 + 22, top - 2, 0x40ff60);
    outline(P, OUT, 0.5);
  });
}

// ---------- förstärkartornet ----------
function paintAmp() {
  const { x0, x1, base } = AMP;
  return sprite(x0 - 2, base - 38, x1 - x0 + 5, 41, (P) => {
    const w = x1 - x0;
    // kabinettet: svart tolex, gulbrun grilltyg med snedränder
    for (let y = base - 26; y < base; y++) for (let x = x0; x < x1; x++) P.px(x, y, (x === x0 || y === base - 26) ? 0x3a3a42 : (x === x1 - 1 || y === base - 1) ? 0x0a0a0e : 0x1a1a20);
    for (let y = base - 23; y < base - 3; y++) for (let x = x0 + 3; x < x1 - 3; x++) P.px(x, y, (x + y) % 3 === 0 ? 0x6a5a3a : (x + y) % 3 === 1 ? 0x8a7a54 : 0x7a6a48);
    P.box(x0 + 2, base - 24, w - 4, 22, 0xd8d0b8);
    for (const [cx, cy] of [[x0 + 1, base - 25], [x1 - 2, base - 25], [x0 + 1, base - 1], [x1 - 2, base - 1]]) P.px(cx, cy, 0xc8ccd4); // hörnskydd
    script(P, x0 + 6, base - 21, 14, 0xf4f0e6, 44);
    // toppen: förstärkarhuvudet med rattar
    for (let y = base - 37; y < base - 27; y++) for (let x = x0 + 1; x < x1 - 1; x++) P.px(x, y, y === base - 37 ? 0x3a3a42 : 0x1a1a20);
    P.rect(x0 + 3, base - 34, w - 6, 5, 0xc8a050); P.hl(x0 + 3, base - 34, w - 6, 0xe8c878);
    for (let k = 0; k < 6; k++) P.px(x0 + 5 + k * 3, base - 32, 0x1a1a1e);
    P.px(x1 - 4, base - 31, 0xd82a2a);
    P.hl(x0 + 8, base - 38, 10, 0x2a2a30); // handtaget
    // lappen: FUNKAR (NÄSTAN)
    { const nw = Math.max(handW(SM, $t('FUNKAR'), 12), handW(SM, $t('NÄSTAN'), 13)) + 4, S = skew(P, x0 + 4, 9, 1);
      S.rect(x0 + 4, base - 19, nw, 14, 0xfff08a); S.hl(x0 + 4, base - 19, nw, 0xfff8c0); S.hl(x0 + 4, base - 6, nw, 0xc8b050);
      hand(S, SM, $t('FUNKAR'), x0 + 6, base - 17, 0x1a1a3a, 12); hand(S, SM, $t('NÄSTAN'), x0 + 6, base - 11, 0xc8141a, 13); S.rect(x0 + 5 + (nw >> 1), base - 20, 4, 2, 0xf8f8f0, 0.6); }
    P.line(x1 - 3, base - 6, x1 + 2, base, 0x1a1a1e); // sladden
    outline(P, OUT, 0.5);
    groundShadow(P, (x0 + x1) / 2, base + 1, w / 2 + 1, 2, 0.4);
  });
}

// ---------- trumsetet: bastrumma, pukor, virvel, hi-hat och crash ----------
function paintDrums() {
  const { x0, x1, base } = DRUMS;
  return sprite(x0 - 3, base - 44, x1 - x0 + 7, 47, (P) => {
    const cx = (x0 + x1) >> 1;
    const WRAP = [0x3a0610, 0x6a0c1c, 0xa01a2a, 0xd84a4a, 0xff9a9a];
    const shell = (sx, sy, w, h, head = true) => { // trumma: skal med glitter + skinn ovanpå (ellips)
      for (let y = sy; y < sy + h; y++) for (let x = sx; x < sx + w; x++) {
        const v = 0.8 - Math.abs(x + 0.5 - sx - w / 2) / w * 1.1;
        P.px(x, y, hash(x, y, 151) > 0.86 ? WRAP[4] : tone(WRAP, v, x, y));
      }
      if (head) for (let y = sy - 3; y < sy + 2; y++) for (let x = sx; x < sx + w; x++) { const d = Math.hypot((x + 0.5 - sx - w / 2) / (w / 2), (y + 0.5 - sy) / 2.5); if (d < 1) P.px(x, y, d > 0.8 ? STEEL[3] : 0xf0ece0); }
      P.hl(sx, sy + h - 1, w, STEEL[2]);
    };
    const stand = (x, y0, y1) => { P.vl(x, y0, y1 - y0, STEEL[3]); P.line(x, y1, x - 3, y1 + 3, STEEL[2]); P.line(x, y1, x + 3, y1 + 3, STEEL[2]); };
    const cymbal = (x, y, r) => { for (let i = -r; i <= r; i++) { P.px(x + i, y, tone(BRASS, 0.9 - Math.abs(i) / r * 0.5, x + i, y)); if (Math.abs(i) < r - 2) P.px(x + i, y - 1, BRASS[3]); } P.px(x, y - 2, STEEL[3]); };
    stand(x0 + 6, base - 34, base - 4); cymbal(x0 + 6, base - 34, 6); cymbal(x0 + 6, base - 31, 6); // hi-hat
    stand(x1 - 5, base - 33, base - 4); cymbal(x1 - 5, base - 33, 8);                               // crash
    shell(x0 + 8, base - 20, 12, 9);                                                                 // virveln
    for (let y = base - 11; y < base - 2; y++) P.px(x0 + 13, y, STEEL[2]);
    shell(x1 - 20, base - 20, 13, 14);                                                               // golvpukan
    // bastrumman: frontskinnet rakt mot oss med loggan
    for (let y = base - 22; y < base - 1; y++) for (let x = cx - 12; x <= cx + 12; x++) {
      const d = Math.hypot((x + 0.5 - cx) / 12, (y + 0.5 - (base - 12)) / 10.5);
      if (d > 1) continue;
      P.px(x, y, d > 0.86 ? (hash(x, y, 152) > 0.7 ? WRAP[4] : WRAP[2]) : d > 0.8 ? STEEL[3] : mix(0xf4f0e6, 0xc8c0b0, (y - base + 22) / 24));
    }
    for (let y = base - 15; y < base - 9; y++) for (let x = cx - 5; x <= cx + 5; x++) if (Math.hypot(x - cx, (y - base + 12) * 1.6) < 5.5) P.px(x, y, 0xc8141a);
    script(P, cx - 4, base - 13, 9, 0xf4f0e6, 61);
    // pukorna uppe på bastrumman
    shell(cx - 11, base - 28, 9, 6); shell(cx + 2, base - 28, 9, 6);
    P.vl(cx, base - 24, 3, STEEL[2]);
    // trumstockarna liggande på virveln
    P.line(x0 + 7, base - 23, x0 + 18, base - 25, 0xe8c890); P.line(x0 + 9, base - 22, x0 + 20, base - 22, 0xd8b880);
    tag(P, x1 - 3, base - 14, 31, 0xfff08a);
    outline(P, OUT, 0.5);
    groundShadow(P, cx, base + 1, (x1 - x0) / 2, 2.2, 0.38);
  });
}

// ---------- moraklockan ----------
function paintMora() {
  const { x0, x1, base } = MORA, h = 62;
  return sprite(x0 - 2, base - h - 4, x1 - x0 + 4, h + 7, (P) => {
    const cx = (x0 + x1) / 2;
    const BODY = [0x3a4a5e, 0x5e7488, 0x8aa2b4, 0xb4c6d2, 0xe0eaf0]; // gråblå allmogemålning
    const T = base - h;
    // mora-formen: rundat huvud kring urtavlan, smal midja, bred rund mage, fot som svänger ut
    const half = (t) => {
      if (t < 0.05) return 5.5 + t / 0.05 * 1.6;                            // huvudets rundade överkant
      if (t < 0.26) return 7.3;                                              // huvudet
      if (t < 0.3) return 7.3 - (t - 0.26) / 0.04 * 2.4;                     // axlarna
      if (t < 0.38) return 4.9;                                              // midjan
      if (t < 0.84) return 4.9 + Math.sin((t - 0.38) / 0.46 * Math.PI) * 3.8; // magen
      if (t < 0.93) return 5.6;                                              // foten
      return 5.6 + (t - 0.93) / 0.07 * 2.2;                                  // foten svänger ut
    };
    for (let y = T; y < base; y++) {
      const t = (y - T) / h, hw = half(t);
      for (let x = Math.floor(cx - hw); x < cx + hw; x++) {
        const nx = (x + 0.5 - cx) / hw;
        P.px(x, y, tone(BODY, 0.8 - nx * 0.28 - nx * nx * 0.32, x, y));
      }
    }
    // förgyllda lister där formen byter
    for (const t of [0.26, 0.38, 0.84, 0.93]) { const y = Math.round(T + t * h), hw = half(t); for (let x = Math.floor(cx - hw); x < cx + hw; x++) P.px(x, y, tone(BRASS, 0.8 - (x - cx) / hw * 0.3, x, y)); }
    // kronan överst
    for (let i = -5; i <= 5; i++) P.px(Math.round(cx - 0.5 + i), T - 1 - (Math.abs(i) < 2 ? 2 : Math.abs(i) < 4 ? 1 : 0), BRASS[Math.abs(i) < 2 ? 3 : 2]);
    P.px(Math.round(cx - 0.5), T - 4, BRASS[4]); P.px(Math.round(cx - 1.5), T - 3, BRASS[2]); P.px(Math.round(cx + 0.5), T - 3, BRASS[2]);
    clockFace(P, cx, T + 9, 5, BRASS, 0xf8f4e8);
    // pendelfönstret: ovalt glas med mässingspendeln bakom
    for (let y = T + 30; y < T + 44; y++) for (let x = Math.floor(cx - 3); x < cx + 3; x++) {
      const d = Math.hypot((x + 0.5 - cx) / 3, (y + 0.5 - T - 37) / 7);
      if (d < 1) P.px(x, y, d > 0.78 ? BRASS[1] : 0x1a2028);
    }
    P.vl(Math.round(cx - 0.5), T + 31, 9, BRASS[2]); P.rect(Math.round(cx - 1.5), T + 39, 3, 3, BRASS[3]); P.px(Math.round(cx - 1.5), T + 39, BRASS[4]);
    glare(P, Math.floor(cx - 3), T + 30, 6, 14, 0.25, 7, 1);
    // en målad krans av rosor och blad runt magen, och på foten
    for (let a = 0; a < 11; a++) {
      const th = Math.PI * (0.15 + a / 10 * 0.7), rx = cx - 0.5 + Math.cos(th) * 6.4 * (a % 2 ? 1 : 0.92), ry = T + 37 + Math.sin(th) * 9;
      const X = Math.round(rx), Y = Math.round(ry);
      if (a % 3 === 0) { P.px(X, Y, 0xc8202a); P.px(X + 1, Y, 0xe8584a); P.px(X, Y + 1, 0x8a1418); P.px(X + 1, Y + 1, 0xc8202a); }
      else { P.px(X, Y, 0x3a7a3a); P.px(X + (a % 2 ? 1 : -1), Y - 1, 0x5a9a4a); }
    }
    for (const dx of [-3, 0, 3]) { const X = Math.round(cx - 0.5 + dx), Y = base - 7; P.px(X, Y, dx ? 0xf0c040 : 0xc8202a); P.px(X, Y + 1, 0x3a7a3a); P.px(X + 1, Y, dx ? 0xf8e080 : 0xe8584a); }
    tag(P, x1 - 2, base - 40, 41);
    outline(P, OUT, 0.5);
    groundShadow(P, cx, base + 1, 9, 2, 0.4);
  });
}

// ---------- tunnan med golfklubbor, hockeyklubbor och ett paraply ----------
function paintClubs() {
  const { x0, x1, base } = CLUBS;
  return sprite(x0 - 4, base - 44, x1 - x0 + 8, 47, (P) => {
    const cx = (x0 + x1) >> 1;
    // det som sticker upp
    const stick = (bx, tx, ty, c, end) => {
      P.line(bx, base - 16, tx, ty, c);
      if (end === 'golf') { P.hl(tx - 2, ty, 3, STEEL[4]); P.hl(tx - 2, ty + 1, 3, STEEL[2]); }
      else if (end === 'hockey') { P.line(tx, ty, tx - 1, ty - 1, 0x1a1a1e); P.hl(tx, ty - 1, 1, 0xf4f0e6); }
      else if (end === 'racket') { for (let a = 0; a < 16; a++) { const t = a / 16 * Math.PI * 2; P.px(Math.round(tx + Math.cos(t) * 3), Math.round(ty - 3 + Math.sin(t) * 4), 0xc8202a); } P.px(tx, ty - 3, 0xe8e8e0); P.px(tx - 1, ty - 4, 0xe8e8e0); P.px(tx + 1, ty - 2, 0xe8e8e0); }
      else if (end === 'paraply') { P.px(tx, ty, 0x3a2418); P.px(tx + 1, ty + 1, 0x3a2418); }
    };
    stick(cx - 5, x0 - 1, base - 40, STEEL[3], 'golf');
    stick(cx - 2, cx - 3, base - 43, 0xc8a060, 'hockey');
    stick(cx + 1, cx + 6, base - 42, 0xb8905a, 'hockey');
    stick(cx + 3, x1 + 1, base - 36, STEEL[3], 'golf');
    stick(cx, cx + 1, base - 38, 0x1a1a1e, 'racket');
    for (let y = base - 34; y < base - 16; y++) for (let i = -1; i <= 1; i++) P.px(cx - 8 + i + Math.round((y - base + 34) * 0.1), y, i === 0 ? 0x2a4a8a : 0x1a3a6a); // hopfällt paraply
    stick(cx - 7, cx - 9, base - 36, 0x2a4a8a, 'paraply');
    // tunnan i trä med järnband
    for (let y = base - 17; y < base; y++) {
      const bulge = Math.sin((y - base + 17) / 17 * Math.PI) * 1.5;
      for (let x = Math.floor(x0 + 1 - bulge); x < x1 - 1 + bulge; x++) {
        let c = tone(OAK, 0.8 - (x - x0) / (x1 - x0) * 0.7 + ((x - x0) % 4 === 0 ? -0.15 : 0), x, y);
        if (y === base - 15 || y === base - 4) c = (x - x0) % 5 === 0 ? 0x6a6e78 : 0x2a2a30;
        P.px(x, y, c);
      }
    }
    for (let x = x0 + 1; x < x1 - 1; x++) P.px(x, base - 17, 0x1a0e08);
    tag(P, x1 - 1, base - 13, 51);
    outline(P, OUT, 0.5);
    groundShadow(P, cx, base + 1, (x1 - x0) / 2 + 1, 2, 0.4);
  });
}

// ---------- LP-backen ----------
function paintLp() {
  const { x0, x1, base } = LP;
  return sprite(x0 - 2, base - 30, x1 - x0 + 5, 33, (P) => {
    // skivorna som sticker upp ur backen (ryggar i alla färger)
    for (let x = x0 + 2; x < x1 - 2; x++) {
      const hgt = 10 + Math.floor(hash(x, 1, 161) * 3), c = [0xd8a030, 0x2a2a30, 0xc83a2a, 0x3a6ad8, 0xe8e0c8, 0x6a3a8a, 0x3a8a5a, 0xe86a2a][Math.floor(hash(x >> 1, 2, 161) * 8)];
      for (let y = base - 14 - hgt + 10; y < base - 12; y++) P.px(x, y, x % 2 ? c : mul(c, 0.78));
    }
    // en skiva står framför backen: omslag med en solnedgång
    const sx = x0 + 23, sy = base - 26;
    for (let j = 0; j < 13; j++) for (let i = 0; i < 13; i++) P.px(sx + i, sy + j, j < 7 ? mix(0xf08a30, 0xd83a6a, j / 7) : mix(0x2a2a6a, 0x1a1a3a, (j - 7) / 6));
    for (let j = 4; j < 8; j++) for (let i = 4; i < 9; i++) if (Math.hypot(i - 6.5, j - 7) < 2.6 && j < 7) P.px(sx + i, sy + j, 0xfff0a0);
    P.box(sx, sy, 13, 13, 0xe8e0d0); script(P, sx + 2, sy + 1, 9, 0xffffff, 71);
    // backen i trä
    for (let y = base - 13; y < base; y++) for (let x = x0; x < x1; x++) P.px(x, y, tone(OAK, 0.72 - (y - base + 13) / 20 + ((x - x0) % 12 === 0 ? -0.2 : 0), x, y));
    P.hl(x0, base - 13, x1 - x0, OAK[4]); P.rect(x0 + 13, base - 9, 8, 3, OAK[0]); // handtagshålet
    // skylten LP 10:-
    { const lw = handW(SM, $t('LP 10:-'), 21) + 4, S = skew(P, x0 + 1, 9, -1); S.rect(x0 + 1, base - 11, lw, 8, 0xf8f4e8); S.hl(x0 + 1, base - 4, lw, 0xc8c0a8); hand(S, SM, $t('LP 10:-'), x0 + 3, base - 10, 0xc8141a, 21); }
    outline(P, OUT, 0.5);
    groundShadow(P, (x0 + x1) / 2, base + 1, (x1 - x0) / 2 + 1, 2, 0.4);
  });
}

// ---------- damcykeln med korg ----------
function paintBike() {
  const { x0, x1, base } = BIKE;
  return sprite(x0 - 2, base - 32, x1 - x0 + 5, 35, (P) => {
    const wy = base - 10, rx = x0 + 11, fx = x1 - 12, R = 10;
    const wheel = (cx) => {
      for (let a = 0; a < 90; a++) { const t = a / 90 * Math.PI * 2; P.px(Math.round(cx + Math.cos(t) * R), Math.round(wy + Math.sin(t) * (R - 0.5)), 0x1a1a1e); P.px(Math.round(cx + Math.cos(t) * (R - 1)), Math.round(wy + Math.sin(t) * (R - 1.5)), STEEL[3]); }
      for (let k = 0; k < 8; k++) { const t = k / 8 * Math.PI; P.line(cx - Math.cos(t) * (R - 2), wy - Math.sin(t) * (R - 2), cx + Math.cos(t) * (R - 2), wy + Math.sin(t) * (R - 2), 0xb8bcc4, 0.6); }
      P.px(cx, wy, STEEL[4]);
    };
    wheel(rx); wheel(fx);
    const F = 0x2a6a4a, F2 = 0x1a4a32;
    P.line(rx, wy, x0 + 26, wy, F); P.line(rx, wy - 1, x0 + 26, wy - 1, F2);        // kedjestaget
    P.line(x0 + 26, wy, x0 + 22, base - 26, F); P.line(x0 + 27, wy, x0 + 23, base - 26, F2); // sadelröret
    P.line(x0 + 26, wy, fx - 8, base - 24, F); P.line(x0 + 26, wy - 1, fx - 8, base - 25, F2); // det låga damröret
    P.line(rx, wy, x0 + 22, base - 24, F);                                            // bakgaffeln
    P.line(fx, wy, fx - 5, base - 25, F); P.line(fx - 5, base - 25, fx - 7, base - 29, F2); // framgaffel och styrstam
    P.hl(fx - 11, base - 29, 8, 0x1a1a1e); P.px(fx - 12, base - 29, 0x6a3a1a); P.px(fx - 3, base - 29, 0x6a3a1a); // styret
    P.rect(x0 + 18, base - 28, 8, 2, 0x3a2418); P.hl(x0 + 18, base - 28, 8, 0x6a4a30);  // sadeln
    for (let y = base - 26; y < base - 19; y++) for (let x = fx - 7; x < fx + 4; x++) P.px(x, y, (x + y) % 2 ? 0xb88a4a : 0x8a6430); // korgen
    P.hl(fx - 7, base - 26, 11, 0xd8a868);
    P.px(fx - 1, base - 27, 0xd82a4a); P.px(fx, base - 27, 0xf0e030); P.px(fx - 3, base - 27, 0x4ac05a); // blommor i korgen
    P.rect(rx - 7, wy - 12, 14, 2, F); // pakethållaren
    P.px(fx - 9, base - 30, STEEL[4]); P.px(fx - 9, base - 31, STEEL[2]); // ringklockan
    P.line(x0 + 26, wy, x0 + 28, wy + 3, 0x1a1a1e); P.hl(x0 + 26, wy + 3, 4, 0x1a1a1e); // pedalen
    tag(P, fx - 13, base - 27, 61, 0xff9ab8);
    outline(P, OUT, 0.35);
    groundShadow(P, (x0 + x1) / 2, base + 1, (x1 - x0) / 2, 2, 0.4);
  });
}

// ---------- glasskåpet med kameror, tv-spel, trumpet och pokal ----------
function paintVitrine() {
  const { x0, x1, base } = VITR, h = 58;
  return sprite(x0 - 2, base - h - 2, x1 - x0 + 5, h + 5, (P) => {
    const top = base - h;
    for (let y = top; y < base; y++) for (let x = x0; x < x1; x++) P.px(x, y, (x < x0 + 2 || x >= x1 - 2 || y < top + 2 || y >= base - 5) ? tone(OAK, 0.6 - (y - top) / 200 + (x < x0 + 1 ? 0.25 : 0), x, y) : 0x2a1a14);
    const shelves = [top + 16, top + 30, top + 43];
    for (const s of shelves) { P.hl(x0 + 2, s, x1 - x0 - 4, 0xe8f0f4); P.hl(x0 + 2, s + 1, x1 - x0 - 4, 0x5a6a70); }
    // hylla 1: kameror
    for (let k = 0; k < 3; k++) { const cx = x0 + 5 + k * 15; sbox(P, cx, shelves[0] - 7, 11, 7, [0x2a2a30, 0xd8d4c8, 0x3a3a42][k]); for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) if (Math.hypot(i - 1.5, j - 1.5) < 2) P.px(cx + 4 + i, shelves[0] - 5 + j, j + i < 2 ? 0x8ab0d8 : 0x1a1a22); P.px(cx + 1, shelves[0] - 8, 0x2a2a30); }
    // hylla 2: tv-spel med handkontroller och en pokal
    sbox(P, x0 + 4, shelves[1] - 5, 14, 5, 0x9a9aa8); P.hl(x0 + 6, shelves[1] - 4, 6, 0x3a3a44); P.px(x0 + 15, shelves[1] - 3, 0xd82a2a);
    P.rect(x0 + 19, shelves[1] - 3, 5, 3, 0x2a2a30); P.px(x0 + 20, shelves[1] - 2, 0xd82a2a); P.px(x0 + 22, shelves[1] - 2, 0x3a6ad8);
    const tx = x0 + 34; for (let j = 0; j < 5; j++) for (let i = -2 + (j >> 1); i <= 2 - (j >> 1); i++) P.px(tx + i, shelves[1] - 10 + j, tone(BRASS, 0.9 - j * 0.1 - i * 0.1, tx + i, j));
    P.vl(tx, shelves[1] - 5, 3, BRASS[2]); P.hl(tx - 2, shelves[1] - 2, 5, 0x3a2418); P.hl(tx - 2, shelves[1] - 1, 5, 0x3a2418);
    P.px(tx - 3, shelves[1] - 9, BRASS[2]); P.px(tx + 3, shelves[1] - 9, BRASS[2]);
    // hylla 3: en trumpet och en kikare
    for (let i = 0; i < 16; i++) P.px(x0 + 5 + i, shelves[2] - 3, tone(BRASS, 0.8 - (i % 5) * 0.08, i, 1));
    for (let j = -2; j <= 2; j++) P.px(x0 + 21, shelves[2] - 3 + j, BRASS[Math.abs(j) === 2 ? 1 : 3]); P.px(x0 + 22, shelves[2] - 3, BRASS[2]);
    P.px(x0 + 10, shelves[2] - 4, BRASS[2]); P.px(x0 + 12, shelves[2] - 4, BRASS[2]); P.px(x0 + 14, shelves[2] - 4, BRASS[2]);
    P.rect(x0 + 30, shelves[2] - 5, 4, 5, 0x1a1a1e); P.rect(x0 + 35, shelves[2] - 5, 4, 5, 0x1a1a1e); P.hl(x0 + 34, shelves[2] - 4, 1, 0x3a3a42); P.px(x0 + 31, shelves[2] - 5, 0x8ab0d8); P.px(x0 + 36, shelves[2] - 5, 0x8ab0d8);
    // hylla 4 (botten): en bergsprängare
    sbox(P, x0 + 6, base - 13, 26, 8, 0x3a3a42); for (const sx of [x0 + 11, x0 + 26]) for (let j = -2; j <= 2; j++) for (let i = -2; i <= 2; i++) if (Math.hypot(i, j) < 2.6) P.px(sx + i, base - 9 + j, Math.hypot(i, j) < 1.2 ? 0x6a6a74 : 0x1a1a1e);
    P.rect(x0 + 15, base - 11, 8, 3, 0x1a2a1a); P.hl(x0 + 16, base - 10, 5, 0x6ae08a); P.hl(x0 + 9, base - 15, 20, STEEL[3]);
    // glaset och en skylt
    for (let y = top + 2; y < base - 5; y++) for (let x = x0 + 2; x < x1 - 2; x++) P.px(x, y, 0xc8e8ff, 0.1);
    glare(P, x0 + 2, top + 2, x1 - x0 - 4, h - 7, 0.26, 15, 2);
    P.vl((x0 + x1) >> 1, top + 2, h - 7, OAK[2]);
    { const s = $t('KAMEROR & SPEL'), w = textW(SM, s) + 4, sx = ((x0 + x1) >> 1) - (w >> 1); P.rect(sx, top - 1, w, 7, 0x141016); P.box(sx, top - 1, w, 7, BRASS[2]); text(P, SM, s, sx + 2, top, BRASS[3]); }
    outline(P, OUT, 0.5);
    groundShadow(P, (x0 + x1) / 2, base + 1, (x1 - x0) / 2 + 1, 2.2, 0.42);
  });
}

// ---------- papegojans bur (baksida med pinne och gunga, framsidans galler separat) ----------
function paintCage(front) {
  const { x0, x1, top, bot, cx } = CAGE;
  return sprite(x0 - 1, 0, x1 - x0 + 3, bot + 3, (P) => {
    const inDome = (x, y) => y >= top || Math.hypot((x + 0.5 - cx) / ((x1 - x0) / 2), (y + 0.5 - top) / 7) < 1;
    if (!front) {
      P.vl(cx, 0, top - 6, STEEL[2]); P.px(cx, top - 7, BRASS[3]); P.px(cx - 1, top - 8, BRASS[2]); P.px(cx + 1, top - 8, BRASS[2]); // kedjan och kroken
      for (let y = top - 7; y < bot; y++) for (let x = x0; x < x1; x++) if (inDome(x, y)) P.px(x, y, 0x1a2418, 0.35); // skuggan därinne
      for (let y = top - 7; y < bot; y++) for (let x = x0 + 1; x < x1; x += 3) if (inDome(x, y)) P.px(x, y, BRASS[1]); // bakre gallret
      P.hl(x0 + 3, top + 12, x1 - x0 - 6, 0x6a4a28); // pinnen
      P.px(x0 + 4, bot - 5, 0xe8e0d0); P.rect(x1 - 7, bot - 6, 4, 3, 0xd8c8a0); // vattenskål och fröskål
      for (let y = bot - 3; y < bot; y++) for (let x = x0; x < x1; x++) P.px(x, y, y === bot - 3 ? BRASS[3] : tone(BRASS, 0.5 - (x - x0) / 60, x, y)); // bottenbrickan
      for (let x = x0 + 1; x < x1 - 1; x += 2) if (hash(x, 1, 171) > 0.4) P.px(x, bot - 4, [0xd8b060, 0xe8e0d0, 0x8a6a3a][x % 3]); // frön och fjun
    } else {
      for (let y = top - 7; y < bot - 3; y++) for (let x = x0; x < x1; x += 3) if (inDome(x, y)) P.px(x, y, (y + x) % 7 === 0 ? BRASS[4] : BRASS[2]);
      for (const y of [top + 2, top + 18]) for (let x = x0; x < x1; x++) P.px(x, y, BRASS[3]);
      P.px(cx, top - 7, BRASS[4]);
    }
  });
}

// ================= papegojan (små pixelkartor) =================
const PARROT_PAL = { k: 0x1a1016, r: 0xd8202a, R: 0x8a1018, y: 0xf8d020, b: 0x2a6ad8, B: 0x1a3a8a, w: 0xf4f0e6, g: 0x3ab04a, s: 0x2a2a30 };
const PARROT = {
  sit: ['..rr..', '.rwkr.', '.rrss.', 'rrrr..', 'rryr..', 'rbyr..', 'rbBr..', '.bB...', '.BB...', '..B...'],
  talk: ['..rr..', '.rwkr.', '.rrs..', 'rrrrs.', 'rryr..', 'rbyr..', 'rbBr..', '.bB...', '.BB...', '..B...'],
  flap: ['..rr..', 'grwkr.', 'grrss.', 'brrr.g', 'bryrgb', '.byrb.', '.bBr..', '.bB...', '.BB...', '..B...'],
};
function parrotSprite(name, flip) {
  const rows = PARROT[name], w = 6, h = rows.length, P = new Pix(w, h);
  rows.forEach((row, j) => { for (let i = 0; i < w; i++) { const c = PARROT_PAL[row[i]]; if (c !== undefined) P.px(flip ? w - 1 - i : i, j, c); } });
  return { img: P.flush(), w, h };
}

// ================= pantade möbler: ur möbelatlasen, eller inslagna i papper =================
const ATLAS = typeof Image !== 'undefined' ? new Image() : null;
if (ATLAS) ATLAS.src = 'assets/interior.png';
const FURN = new Map();
// möbelns bild (k, v, c, r) → { img, sx, sy, w, h, flip } eller null om atlasen inte har laddats
function furnImg(k, v = 0, c = null, r = 0) {
  if (!ATLAS?.complete || !ATLAS.naturalWidth) return null;
  const key = `${k}:${v}:${c || ''}:${r | 0}`;
  if (FURN.has(key)) return FURN.get(key);
  const vw = viewOf(k, v, r);
  const f = FRAMES[vw.k + (vw.v | 0)] || FRAMES[vw.k + '0'] || FRAMES[k + '0'];
  let out = null;
  if (f) {
    const t = isHex(c) ? tintSprite(ATLAS, f, c) : null;
    out = t ? { img: t, sx: 0, sy: 0, w: f[2], h: f[3], flip: vw.flip } : { img: ATLAS, sx: f[0], sy: f[1], w: f[2], h: f[3], flip: vw.flip };
  }
  FURN.set(key, out);
  return out;
}
function drawFurn(ctx, a, x, y) {
  if (!a.flip) { ctx.drawImage(a.img, a.sx, a.sy, a.w, a.h, x, y, a.w, a.h); return; }
  ctx.save(); ctx.translate(x + a.w, y); ctx.scale(-1, 1); ctx.drawImage(a.img, a.sx, a.sy, a.w, a.h, 0, 0, a.w, a.h); ctx.restore();
}
// ett paket i brunt papper med snöre (för möbler som inte ryms eller innan atlasen laddats)
const PARCELS = new Map();
function parcel(w, h, seed) {
  const key = w + 'x' + h + ':' + (seed % 4);
  if (PARCELS.has(key)) return PARCELS.get(key);
  const P = new Pix(w + 2, h + 2);
  for (let y = 1; y < h + 1; y++) for (let x = 1; x < w + 1; x++) {
    let v = 0.55 - (x - 1) / w * 0.25 + (y === 1 ? 0.3 : 0);
    if (hash(x, y, 181 + seed) > 0.9) v -= 0.1;
    P.px(x, y, tone([0x5a3a1a, 0x8a6030, 0xb88c50, 0xd0a868, 0xe8c888], v, x, y));
  }
  const sx = 1 + (w >> 1) + (seed % 3) - 1, sy = 1 + (h >> 1);
  for (let x = 1; x < w + 1; x++) P.px(x, sy, 0xe8e0d0); for (let y = 1; y < h + 1; y++) P.px(sx, y, 0xe8e0d0);
  P.px(sx - 1, sy - 1, 0xe8e0d0); P.px(sx + 1, sy - 1, 0xe8e0d0); P.px(sx - 2, sy - 2, 0xe8e0d0); P.px(sx + 2, sy - 2, 0xe8e0d0); // rosetten
  outline(P, OUT, 0.6);
  const out = { img: P.flush(), w: w + 2, h: h + 2 };
  PARCELS.set(key, out);
  return out;
}
// lappen med kvittonumret som hänger i en pant
function numberTag(ctx, x, y, nr, col) {
  const s = String(nr), w = textW(SM, s) + 4;
  ctx.fillStyle = '#17151a'; ctx.fillRect(x - 1, y - 1, w + 2, 9);
  ctx.fillStyle = col; ctx.fillRect(x, y, w, 7);
  ctxText(ctx, SM, s, x + 2, y + 1, '#17151a');
}

// ================= pantbankens egna panter (andras) som fyller tomma platser på hyllan =================
// plats 0: en skrivmaskin · 1: en trumpet i öppet fodral · 2: en bergsprängare · 3: en kamera och ett fickur
function paintOtherPawn(i) {
  const S = SLOTS[i];
  return sprite(S.x - 1, S.b - S.h - 2, S.w + 3, S.h + 3, (P) => {
    const b = S.b;
    if (i === 0) { const x = S.x + 4; sbox(P, x, b - 9, 22, 9, 0x2a2a30); for (let r = 0; r < 3; r++) for (let k = 0; k < 6; k++) P.px(x + 2 + k * 3 + (r & 1), b - 7 + r * 2, 0xe8e0d0); P.rect(x + 3, b - 14, 16, 5, 0xf4f0e6); P.hl(x + 1, b - 10, 20, 0x5a5a62); P.px(x + 20, b - 12, STEEL[3]); }
    else if (i === 1) { const x = S.x + 2; P.rect(x, b - 6, 26, 6, 0x3a1a14); P.rect(x + 1, b - 5, 24, 4, VELVET[2]); for (let k = 0; k < 18; k++) P.px(x + 3 + k, b - 3, tone(BRASS, 0.8 - (k % 5) * 0.1, k, 1)); for (let j = -2; j <= 2; j++) P.px(x + 21, b - 3 + j, BRASS[3]); P.hl(x, b - 7, 26, 0x5a2a1a); }
    else if (i === 2) { const x = S.x + 2; sbox(P, x, b - 11, 26, 11, 0x9a9aa8); for (const sx of [x + 5, x + 20]) for (let j = -3; j <= 3; j++) for (let k = -3; k <= 3; k++) if (Math.hypot(k, j) < 3.4) P.px(sx + k, b - 5 + j, Math.hypot(k, j) < 1.5 ? 0x6a6a74 : 0x1a1a1e); P.rect(x + 10, b - 9, 6, 4, 0x1a2a1a); P.hl(x + 11, b - 8, 4, 0x6ae08a); P.hl(x + 3, b - 13, 20, STEEL[3]); }
    else { const x = S.x + 3; sbox(P, x, b - 9, 13, 9, 0x2a2a30); for (let j = 0; j < 5; j++) for (let k = 0; k < 5; k++) if (Math.hypot(k - 2, j - 2) < 2.6) P.px(x + 4 + k, b - 7 + j, k + j < 3 ? 0x8ab0d8 : 0x1a1a22); P.px(x + 1, b - 10, 0x2a2a30);
      for (let j = 0; j < 5; j++) for (let k = 0; k < 5; k++) if (Math.hypot(k - 2, j - 2) < 2.6) P.px(x + 17 + k, b - 5 + j, Math.hypot(k - 2, j - 2) > 1.8 ? BRASS[2] : 0xf4ecd8); P.px(x + 19, b - 6, BRASS[3]); }
    outline(P, OUT, 0.5);
  });
}

// ================= ljuden (egna toner – inga av de vanliga passar) =================
let NOISE = null;
function noiseBuf(c) {
  if (NOISE && NOISE.sampleRate === c.sampleRate) return NOISE;
  NOISE = c.createBuffer(1, c.sampleRate, c.sampleRate);
  const d = NOISE.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return NOISE;
}
function sfx(fn) {
  if (isMuted()) return;
  try { const c = audioContext(); if (c) fn(c, c.currentTime); } catch { /* ljud är aldrig ett krav */ }
}
function osc(c, t0, f, dur, vol, type = 'sine', f1 = null, dest = null) {
  const o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t0);
  if (f1) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + dur);
  g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g); g.connect(dest || c.destination); o.start(t0); o.stop(t0 + dur + 0.05);
}
function noise(c, t0, dur, vol, type = 'bandpass', freq = 1800, q = 0.8) {
  const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
  s.buffer = noiseBuf(c); f.type = type; f.frequency.value = freq; f.Q.value = q;
  g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  s.connect(f); f.connect(g); g.connect(c.destination); s.start(t0, Math.random() * 0.5); s.stop(t0 + dur + 0.05);
}
const SND = {
  door: () => sfx((c, t) => { for (const [f, at, v] of [[1318, 0, 0.05], [2637, 0.004, 0.01], [988, 0.2, 0.045]]) osc(c, t + at, f, 1.1, v); }),
  ding: () => sfx((c, t) => { osc(c, t, 2349, 1.5, 0.07); osc(c, t, 4698, 0.8, 0.018); osc(c, t, 3520, 0.5, 0.012); }),
  kaching: () => sfx((c, t) => { noise(c, t, 0.12, 0.05, 'bandpass', 900, 1.2); osc(c, t + 0.1, 2637, 0.6, 0.05); osc(c, t + 0.16, 3951, 0.7, 0.04); }),
  bill: () => sfx((c, t) => noise(c, t, 0.05, 0.05, 'highpass', 3000, 0.7)),
  tick: () => sfx((c, t) => { osc(c, t, 3200, 0.03, 0.03, 'square'); osc(c, t + 0.5, 2600, 0.03, 0.025, 'square'); }),
  cuckoo: (n = 1) => sfx((c, t) => { for (let k = 0; k < n; k++) { osc(c, t + k * 0.62, 698, 0.26, 0.06, 'triangle'); osc(c, t + k * 0.62 + 0.26, 587, 0.34, 0.06, 'triangle'); } }),
  amp: () => sfx((c, t) => { osc(c, t, 50, 0.8, 0.05, 'sawtooth'); osc(c, t, 100, 0.8, 0.02, 'sawtooth'); osc(c, t + 0.35, 1760, 0.6, 0.012, 'sine', 2300); }),
  drums: () => sfx((c, t) => {
    const snare = (at) => { noise(c, t + at, 0.14, 0.12, 'bandpass', 1900, 0.7); osc(c, t + at, 190, 0.08, 0.06, 'triangle', 160); };
    const tom = (at, f) => osc(c, t + at, f, 0.3, 0.16, 'sine', f * 0.6);
    snare(0); snare(0.12); tom(0.24, 220); tom(0.36, 170); tom(0.48, 120);
    osc(c, t + 0.64, 120, 0.3, 0.3, 'sine', 45); noise(c, t + 0.64, 1.3, 0.05, 'highpass', 6000, 0.5);
  }),
  // gitarr: ackordet slås an sträng för sträng, varje ton klingar av med ett mjukt filter
  strum: (freqs, dur = 1.6, bright = 2400) => sfx((c, t) => {
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(bright, t); lp.frequency.exponentialRampToValueAtTime(600, t + dur); lp.connect(c.destination);
    freqs.forEach((f, i) => { osc(c, t + i * 0.022, f, dur, 0.05, 'sawtooth', null, lp); osc(c, t + i * 0.022, f * 2, dur * 0.5, 0.012, 'triangle', null, lp); });
  }),
  scratch: () => sfx((c, t) => noise(c, t, 0.06, 0.035, 'bandpass', 2600 + Math.random() * 1200, 1.4)),
};
const CHORDS = {
  akustisk: { f: [98, 123.5, 147, 196, 247, 392], dur: 1.8, bright: 2600 },     // G-dur
  el: { f: [82.4, 123.5, 164.8, 207.7, 247, 329.6], dur: 1.4, bright: 3600 },  // E-dur
  bas: { f: [41.2, 82.4], dur: 1.6, bright: 900 },                             // låga E
  lespaul: { f: [110, 164.8, 220], dur: 1.5, bright: 3200 },                   // A5, rockackord
  banjo: { f: [147, 196, 247, 294, 392], dur: 0.7, bright: 5200 },             // öppen G, kort och spetsig
};

// ================= figurer =================
function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
// pantlånaren: flintskallig, grå mustasch, smala misstänksamma ögon, väst och guldkedja.
// Tre varianter av ögonen (rakt fram / snett åt vänster / åt höger) – blicken följer kunden.
const PB_BASE = { skin: '#e0a97f', hair: '#b9b3ab', style: 'bald', brows: 'skeptic', mouth: 'flat', beard: 'mustache', top: 'waistcoat', shirt: '#5a1a24', accent: '#e8e0d0', neck: 'chain', jewel: 'rings', bottom: 'pants', pants: '#2b2b30', shoes: '#1c1c1c', build: 6, bag: null, kid: false };
const PB_LOOK = { c: { ...PB_BASE, eyes: 'narrow' }, l: { ...PB_BASE, eyes: 'glanceL' }, r: { ...PB_BASE, eyes: 'glanceR' }, glad: { ...PB_BASE, eyes: 'narrow', mouth: 'smirk' } };
const npcLook = (seed) => { const L = makeLook(rng(seed)); return { ...L, kid: false, build: L.build === 4 ? 5 : L.build, bag: null }; };

const PB_HELLO = [$t('Hm. En kund.'), $t('Torka fötterna.'), $t('Vad vill du?'), $t('Titta, men rör inte.')];
const PB_IDLE = [$t('Jag har ögonen på dig.'), $t('Allt är äkta. Nästan.'), $t('Inga returer. Aldrig.'), $t('Kontant eller ingenting.'), $t('Den höga klockan går rätt. De andra ljuger.'), $t('Hm.')];
const PB_WATCH = [$t('Rör inte gitarrerna.'), $t('Spela inte på den.'), $t('Titta, men rör inte.'), $t('Den där är inte till salu åt dig.')];
const PB_INSPECT = [$t('Hmm...'), $t('Är den stulen?'), $t('Den har sett bättre dagar.'), $t('Repor. Här. Och här.'), $t('Äkta? Vi får se.'), $t('Luktar lite hund.')];
const PB_CLOSED = [$t('Stängt. Kom tillbaka i morgon.'), $t('Vi har stängt. Ut med dig.')];
const PB_DESK = [$t('Vad har du med dig? Visa.'), $t('Säg vad du vill. Snabbt.'), $t('Sälja? Låna? Jag har inte hela dagen.'), $t('Hm. Ja?')];
const PARROT_LINES = [$t('🦜 INGA RETURER!'), $t('🦜 KONTANT! KONTANT!'), $t('🦜 Äkta guld!'), $t('🦜 Rör inte!'), $t('🦜 Hej hej!'), $t('🦜 Är den stulen?')];
// kunderna som prutar vid luckan: [vem, replik]; sells = pantlånaren tar varan
const HAGGLE = [
  { carry: 'gitarr', sells: true, lines: [['n', $t('Vad får jag för den här?')], ['p', $t('Femtio.')], ['n', $t('Femtio?! Den är värd tusen!')], ['p', $t('Fyrtio.')], ['n', $t('Okej, okej. Femtio!')]] },
  { carry: 'klocka', sells: false, lines: [['n', $t('Jag vill pantsätta farfars klocka.')], ['p', $t('Äkta guld?')], ['n', $t('Självklart!')], ['p', $t('Mässing. Tjugo kronor.')], ['n', $t('Tjugo?! Jag går.')]] },
  { carry: 'tv', sells: true, lines: [['n', $t('En tv. Den funkar!')], ['p', $t('Alla säger så.')], ['n', $t('Nästan i alla fall.')], ['p', $t('Trettio. Ställ den där.')]] },
  { carry: null, sells: false, lines: [['n', $t('Har ni kvar min cykel?')], ['p', $t('Kvitto?')], ['n', $t('Eh... nej.')], ['p', $t('Då har vi ingen cykel.')]] },
  { carry: null, sells: false, lines: [['n', $t('Vad kostar den röda gitarren?')], ['p', $t('Två tusen.')], ['n', $t('Två tusen?!')], ['p', $t('Tre tusen om du frågar igen.')]] },
];
const BROWSE = [[26, 114, 'up'], [72, 116, 'up'], [118, 112, 'up'], [38, 150, 'left'], [209, 190, 'down'], [340, 190, 'down'], [428, 188, 'down'], [345, 150, 'up'], [236, 150, 'up']];
const pick = (L) => L[Math.floor(Math.random() * L.length)];

// ================= förmålade bilder =================
let ART = null;
function art() {
  if (ART) return ART;
  ART = {
    bg: paintBackground(),
    counter: paintCounter(),
    safe: paintSafe(false), safeOpen: paintSafe(true),
    amp: paintAmp(), drums: paintDrums(), mora: paintMora(), clubs: paintClubs(), lp: paintLp(), bike: paintBike(), vitrine: paintVitrine(),
    frontBars: paintFrontBars(),
    cageBack: paintCage(false), cageFront: paintCage(true),
    parrot: Object.fromEntries(Object.keys(PARROT).flatMap((k) => [[k, parrotSprite(k, false)], [k + 'L', parrotSprite(k, true)]])),
    others: SLOTS.map((_, i) => paintOtherPawn(i)),
    guitars: GUITARS.map((_, i) => paintGuitar(i)),
    snow: Array.from({ length: 5 }, (_, k) => { const P = new Pix(20, 15); for (let y = 0; y < 15; y++) for (let x = 0; x < 20; x++) { const v = hash(x, y, 500 + k); P.px(x, y, v > 0.5 ? mix(0x8a8a90, 0xf0f0f4, (v - 0.5) * 2) : mix(0x1a1a22, 0x6a6a70, v * 2)); } return P.flush(); }),
    glowLamp: glowImg(26, 12, 0xfff0b0, 0.34), glowTv: glowImg(16, 10, 0xb8d0ff, 0.22), glowWin: glowImg(60, 14, 0xe8f0ff, 0.12),
    holeBig: glowImg(90, 50, 0x000000, 1), holeSmall: glowImg(34, 22, 0x000000, 1),
  };
  return ART;
}
// mjuk ljuspöl (dithrad ellips) som bild
function glowImg(rx, ry, c, amax) {
  const P = new Pix(rx * 2 + 2, ry * 2 + 2);
  P.ell(rx + 1, ry + 1, rx, ry, c, amax, 5);
  return P.flush();
}

// ================= scenen =================
export function makePantbank(A) {
  const g = A.game;
  const R = art();
  const talk = createSpeech();      // mina egna tankar och tips
  const talkPB = createSpeech();    // pantlånaren
  const talkBird = createSpeech();  // papegojan
  const walker = createWalker({ W, H, left: SIDE + 4, right: W - SIDE - 4, top: WALL_Y + 4, bottom: FRONT_Y - 3, spawn: [DOOR_X, FRONT_Y - 8] });
  walker.speed = 66;
  walker.setObstacles(OBST);
  walker.snapFree();
  walker.dir = 'up';

  let t = 0, lockedCam = null, hoverId = null, hoverT = -9, lastHint = -9, fast = 1;
  let door = 0, bellT = -9, deskTab = 'salj', tvCh = 0, shutter = isOpen() ? 0 : 1, closedSaid = false, lastHour = Math.floor(g.min / 60);
  const pops = [], flyers = [];
  const wob = GUITARS.map(() => 0);   // gitarrerna gungar på kroken när man rör dem
  const cam = { x: 0, y: 0 };
  function isOpen() { const h = (g.min / 60) % 24; return h >= HOURS[0] && h < HOURS[1]; }
  const camTarget = () => lockedCam || { x: clamp(walker.px - VW / 2, 0, W - VW), y: clamp(walker.py - VH * 0.62, 0, H - VH) };
  Object.assign(cam, camTarget());

  // ---------- pantlånaren ----------
  const pb = { x: PB_HOME, tx: PB_HOME, dir: 'down', mode: 'idle', t: 3, said: -9, carry: null, bite: 0, cb: null, watchT: -9 };
  const PB_SPEED = 58;
  function pbWalk(x, cb) { pb.tx = clamp(x, PB_MIN, PB_MAX); pb.cb = cb || null; pb.mode = 'walk'; if (Math.abs(pb.tx - pb.x) < 1) { pb.mode = 'idle'; const f = pb.cb; pb.cb = null; f?.(); } }
  const pbInView = () => pb.x + 8 >= cam.x && pb.x - 8 <= cam.x + VW;
  function pbSay(s, force = false, secs) {
    if (!force && !pbInView()) return;
    if (t - pb.said < 1.1 && talkPB.active() && !force) return;
    pb.said = t;
    talkPB.say(s, () => ({ x: pb.x, y: PB_Y - 44 }), secs, { voice: PB_BASE });
  }
  function updatePB(dt) {
    if (pb.mode === 'walk') {
      const d = pb.tx - pb.x, step = PB_SPEED * fast * dt;
      pb.dir = d < 0 ? 'left' : 'right';
      if (Math.abs(d) <= step) { pb.x = pb.tx; pb.mode = 'idle'; pb.dir = 'down'; const f = pb.cb; pb.cb = null; f?.(); }
      else pb.x += Math.sign(d) * step;
      return;
    }
    if (deal) return; // affären styr pantlånaren
    pb.t -= dt;
    // misstänksam: säger till när man fingrar på instrumenten
    const nearToys = walker.px < 128 && walker.py < 125;
    if (nearToys && t - pb.watchT > 14 && isOpen()) { pb.watchT = t; pbSay(pick(PB_WATCH)); }
    if (pb.t > 0) return;
    const r = Math.random();
    if (Math.abs(pb.x - PB_HOME) > 2 && r < 0.7) { pbWalk(PB_HOME); pb.t = 3; return; }
    if (r < 0.2) { pb.mode = 'bite'; pb.bite = 1.6; pb.t = 4 + Math.random() * 3; }
    else if (r < 0.32) { pbWalk(SAFE.x0 + 16, () => { pb.dir = 'up'; pb.t = 2.5; }); }          // kollar monitorn på kassaskåpet
    else if (r < 0.42) { pbWalk(300 + Math.random() * 120, () => { pb.dir = 'up'; pb.t = 2; }); }  // plockar i hyllorna
    else { pb.mode = 'idle'; pb.dir = 'down'; pb.t = 4 + Math.random() * 5; if (Math.random() < 0.35 && isOpen() && Math.hypot(walker.px - pb.x, walker.py - PB_Y) < 170) pbSay(pick(PB_IDLE)); }
  }
  // blicken: rakt fram, eller snett mot kunden om den står en bit åt sidan
  const pbLook = () => {
    if (deal?.phase === 'klart' || deal?.phase === 'ge') return PB_LOOK.glad;
    if (deal?.phase === 'syna' || deal?.phase === 'bud') return ITEM_X < pb.x - 8 ? PB_LOOK.l : PB_LOOK.c; // stirrar på varan på disken
    if (pb.dir !== 'down') return PB_LOOK.c;
    const dx = walker.px - pb.x;
    return dx < -26 ? PB_LOOK.l : dx > 26 ? PB_LOOK.r : PB_LOOK.c;
  };

  // ---------- papegojan ----------
  const bird = { x: CAGE.cx - 2, y: CAGE.top + 12, flip: false, state: 'sit', t: 0, next: 12 + Math.random() * 14, flap: 0 };
  function birdSay(s = pick(PARROT_LINES)) {
    bird.state = 'talk'; bird.t = 1.6; bird.flap = 0.8;
    talkBird.say(s, { x: CAGE.cx + (walker.px < CAGE.cx ? 12 : -12), y: CAGE.top - 4 }, 2.6, { animal: 'fagel' });
  }
  function updateBird(dt) {
    bird.t -= dt; bird.flap = Math.max(0, bird.flap - dt);
    if (bird.state === 'talk' && bird.t <= 0) bird.state = 'sit';
    bird.next -= dt;
    if (bird.next <= 0) {
      bird.next = 14 + Math.random() * 22;
      if (Math.random() < 0.5 && isOpen()) birdSay(); else { bird.flip = !bird.flip; bird.flap = 0.5; bird.x = CAGE.cx - 2 + (bird.flip ? 3 : -2); }
    }
  }

  // ---------- kunderna ----------
  let npcSeed = (g.day | 0) * 211 + 5;
  const nw = createWalker({ W, H, left: SIDE + 4, right: W - SIDE - 4, top: WALL_Y + 4, bottom: FRONT_Y - 3, spawn: [DOOR_X, FRONT_Y - 6] });
  nw.setObstacles(OBST); nw.speed = 34;
  const npc = { w: nw, look: npcLook(npcSeed), state: 'away', t: 5 + Math.random() * 8, plan: [], goal: null, carry: null, talk: createSpeech(), script: null, line: 0 };
  function spawnNpc() {
    npc.look = npcLook(npcSeed += 37);
    npc.w.px = DOOR_X; npc.w.py = FRONT_Y - 6; npc.w.stop(); npc.w.dir = 'up';
    npc.script = HAGGLE[Math.floor(Math.random() * HAGGLE.length)];
    npc.carry = npc.script.carry;
    const pool = BROWSE.slice(), picks = [];
    for (let k = 0, n = 1 + Math.floor(Math.random() * 2); k < n; k++) picks.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
    npc.plan = [...picks.map(([x, y, dir]) => ({ x, y, dir, kind: 'browse' })), { x: SERVE[0], y: SERVE[1], dir: 'up', kind: 'haggle' }, { x: DOOR_X, y: FRONT_Y - 5, dir: 'down', kind: 'exit' }];
    ring();
    nextGoal();
  }
  const playerAtHatch = () => Math.hypot(walker.px - SERVE[0], walker.py - SERVE[1]) < 16 || !!deal;
  function nextGoal() {
    npc.goal = npc.plan.shift() || null;
    if (!npc.goal) { npc.state = 'away'; npc.t = 10 + Math.random() * 18; return; }
    npc.state = 'walk';
    let { x, y } = npc.goal;
    if (npc.goal.kind === 'haggle' && (playerAtHatch() || !isOpen())) {
      if (!isOpen()) { npc.goal = npc.plan.shift(); x = npc.goal.x; y = npc.goal.y; } // stängt: vänd i dörren
      else { x = QUEUE[0]; y = QUEUE[1]; npc.goal = { ...npc.goal, queue: true }; }
    }
    npc.w.walkTo(x, y);
    if (!npc.w.path.length) arrive();
  }
  function arrive() {
    const G = npc.goal;
    if (!G) return nextGoal();
    if (G.dir) npc.w.dir = G.dir;
    if (G.kind === 'browse') { npc.state = 'browse'; npc.t = 2.5 + Math.random() * 3; if (G.x < 130 && G.y < 125 && Math.random() < 0.6) { npcSay($t('Oj, vilka gitarrer.')); pb.watchT = t - 10; } }
    else if (G.kind === 'haggle') {
      if (G.queue) { npc.state = 'queue'; npc.t = 0; return; }
      npc.state = 'haggle'; npc.line = 0; npc.t = 0.4;
      if (!deal) pbWalk(SERVE[0], () => { pb.dir = 'down'; });
    } else if (G.kind === 'exit') { ring(); npc.state = 'away'; npc.t = 10 + Math.random() * 20; npc.talk.clear(); }
  }
  function npcSay(s) { npc.talk.say(s, () => ({ x: npc.w.px, y: npc.w.py - 44 }), 2.4, { voice: npc.look }); }
  function updateNpc(dt) {
    if (npc.state === 'away') {
      npc.t -= dt;
      if (npc.t <= 0) { if (isOpen()) spawnNpc(); else npc.t = 20; }
      return;
    }
    npc.w.update(dt);
    if (npc.state === 'walk') { if (!npc.w.path.length) arrive(); }
    else if (npc.state === 'browse') { npc.t -= dt; if (npc.t <= 0) nextGoal(); }
    else if (npc.state === 'queue') {
      npc.t += dt;
      if (!playerAtHatch()) { npc.goal = { x: SERVE[0], y: SERVE[1], dir: 'up', kind: 'haggle' }; npc.state = 'walk'; npc.w.walkTo(SERVE[0], SERVE[1]); }
      else if (npc.t > 16) { npcSay($t('Jag kommer tillbaka.')); nextGoal(); }
    } else if (npc.state === 'haggle') {
      npc.t -= dt;
      if (deal) { npc.state = 'queue'; npc.t = 0; npc.w.walkTo(QUEUE[0], QUEUE[1]); return; } // spelaren gick före
      if (npc.t > 0) return;
      const L = npc.script.lines[npc.line];
      if (!L) {
        if (npc.script.sells && npc.carry) { npc.carry = null; play('coin'); }
        nextGoal(); return;
      }
      if (L[0] === 'n') npcSay(L[1]); else pbSay(L[1], true, 2.4);
      npc.line++; npc.t = 2.3;
    }
  }
  // det kunden bär i händerna
  function drawNpcCarry(ctx, x, y, kind) {
    if (kind === 'gitarr') { ctx.fillStyle = '#17151a'; ctx.fillRect(x - 1, y - 20, 3, 15); ctx.fillRect(x - 5, y - 7, 11, 9); ctx.fillStyle = '#d09848'; ctx.fillRect(x - 4, y - 6, 9, 7); ctx.fillStyle = '#3a2014'; ctx.fillRect(x, y - 19, 1, 13); ctx.fillStyle = '#1a0e08'; ctx.fillRect(x - 1, y - 4, 2, 2); }
    else if (kind === 'tv') { ctx.fillStyle = '#17151a'; ctx.fillRect(x - 7, y - 10, 14, 11); ctx.fillStyle = '#6a6258'; ctx.fillRect(x - 6, y - 9, 12, 9); ctx.fillStyle = '#2a3a4a'; ctx.fillRect(x - 5, y - 8, 8, 6); ctx.fillStyle = '#8ab0d8'; ctx.fillRect(x - 4, y - 7, 2, 1); }
    else if (kind === 'klocka') { ctx.fillStyle = '#8a6414'; ctx.fillRect(x - 2, y - 4, 5, 5); ctx.fillStyle = '#f4ecd8'; ctx.fillRect(x - 1, y - 3, 3, 3); ctx.fillStyle = '#f0c848'; ctx.fillRect(x, y - 6, 1, 2); }
  }
  function ring() { if (t - bellT < 0.5) return; bellT = t; SND.door(); }

  // ---------- affärerna vid luckan ----------
  // deal = { kind: 'salj'|'pant'|'losa', ref, item, name, amount, skuld, nr, phase, t, ... }
  // salj/pant: lagg → syna → bud (dialogen) → hamta → kassa → bar → rakna → klart → stuva
  // (eller tillbaka om man säger nej). losa: hamtaPant → barPant → ge.
  // Pengarna och möbeln byter ägare i game.js i samma ögonblick som man säger ja –
  // resten är bara pantlånaren som gör sitt (man kan gå därifrån utan att något går förlorat).
  let deal = null, safeOpen = false, pendingHello = 0.8, cuckooT = -9;
  // Dialogerna stängs med closeDlg: ett dubbelklick på "Sälj"/"Pantsätt" får inte låta
  // andra klicket landa på golvet (då går man iväg och pantlånaren lägger tillbaka varan).
  let clickGuard = 0;
  const closeDlg = () => { closeModal(); clickGuard = performance.now() + 350; };
  const itemOf = (it) => ({ k: it.k, v: it.v | 0, c: it.c || null, r: it.r | 0 });
  const nameOf = (k) => katalogOf(k)?.name || k;
  // "nästa torsdag (dag 17)" – en vecka bort är samma veckodag som i dag, så ordet "nästa"
  // behövs för att ingen ska tro att det gäller i dag
  const weekday = (d) => DAY_NAMES[((d - 1) % 7 + 7) % 7].toLowerCase();
  const dayWord = (d) => {
    const rel = d - g.day;
    return rel <= 0 ? $t`i dag, ${weekday(d)}` : rel === 1 ? $t`i morgon, ${weekday(d)}` : rel >= 7 ? $t`nästa ${weekday(d)}` : weekday(d);
  };
  const dayLabel = (d) => $t`${dayWord(d)} (dag ${d})`; // hårt mellanslag: "(dag 10)" bryts aldrig isär
  const dagar = (n) => (n === 1 ? $t`${n} dag` : $t`${n} dagar`);
  function startDeal(kind, idx) {
    const it = g.storage[idx];
    if (!it || deal) return false;
    if (!g.sellable(it)) { toast($t('💍 Startmöbler tar pantlånaren inte emot – du behöver dem.'), 'bad'); return false; }
    if (kind === 'pant' && !canPawn(g)) { toast($t('💍 Pantlånet har inte öppnat än – men du kan sälja.'), 'bad'); return false; }
    if (kind === 'pant' && pantList(g).length >= MAXP()) { toast($t`💍 Högst ${MAXP()} panter åt gången – lös ut något först.`, 'bad'); return false; }
    deal = { kind, ref: it, item: itemOf(it), name: nameOf(it.k), amount: kind === 'salj' ? saleOf(it.k) : loanOf(it.k), phase: 'lagg', t: 0, from: [walker.px, walker.py - 22] };
    deal.skuld = debtOf(deal.amount);
    if (Math.abs(pb.x - HATCH_X) > 1) pbWalk(HATCH_X, () => { pb.dir = 'down'; });
    walker.dir = 'up';
    play('click');
    return true;
  }
  function openOffer() {
    const d = deal;
    const sell = d.kind === 'salj';
    const line = sell ? $t`Jag ger dig ${d.amount} kronor. Inte en krona mer.` : $t`${d.amount} kronor i lån. ${d.skuld} tillbaka senast ${dayLabel(g.day + DAYS())} – annars är den min.`;
    const body = `<div style="display:flex;gap:12px;align-items:center"><span data-pbface></span><p style="font-size:var(--f2);margin:0">«${esc(line)}»</p></div>
      <div class="plist" style="margin-top:8px"><div class="prow shoprow"><span data-dealfurn></span><span class="nm">${esc(d.name)}<br><small class="sp">${$t`Katalogpris ${fmt(katalogOf(d.item.k)?.price || 0)}`}</small></span><b style="font-size:var(--f2)">${fmt(d.amount)}</b><span></span></div></div>
      ${sell ? `<p style="font-size:var(--f2);margin:8px 0 0">${$t`Säljer du får du <b>${fmt(d.amount)}</b> direkt och möbeln är borta för gott – <b>INGA RETURER</b>.`}</p>`
        : `<p style="font-size:var(--f2);margin:8px 0 0">${$t`Du får <b>${fmt(d.amount)}</b> nu. Betala tillbaka <b>${fmt(d.skuld)}</b> (lånet + ${Math.round(INTEREST() * 100)} % ränta) senast <b>${dayLabel(g.day + DAYS())}</b> så får du tillbaka möbeln. Annars behåller pantbanken den.`}</p>`}`;
    const dlg = openModal(sell ? $t('🔍 Pantlånaren synar – sälja?') : $t('🔍 Pantlånaren synar – låna?'), body, [
      { label: $t('Nej tack'), onClick: () => { closeDlg(); declineDeal(); } },
      { label: sell ? $t`🤝 Affär – ${fmt(d.amount)}` : $t`🤝 Låna ${fmt(d.amount)}`, cls: 'btn-go', onClick: () => { closeDlg(); acceptDeal(); } },
    ], { closable: false });
    faceInto(dlg);
    furnInto(dlg.querySelector('[data-dealfurn]'), d.item);
  }
  function acceptDeal() {
    if (!deal || deal.phase !== 'bud') return { ok: false };
    const idx = g.storage.indexOf(deal.ref);
    if (idx < 0) { declineDeal(true); return { ok: false }; }
    let r;
    if (deal.kind === 'salj') { const ok = g.sellStorage(idx); r = { ok, msg: $t('Den kan inte säljas.') }; }
    else r = g.pawnStorage(idx);
    if (!r?.ok) { toast('💍 ' + (r?.msg || $t('Det gick inte.')), 'bad'); declineDeal(true); return { ok: false }; }
    if (deal.kind === 'pant') { deal.nr = r.pant.nr; deal.sista = r.sista; deal.skuld = r.skuld; deal.amount = r.lan; deal.hide = r.pant.nr; }
    deal.phase = 'hamta'; deal.t = 0;
    pbSay(deal.kind === 'salj' ? $t('Affär. Inga returer.') : $t`Kvitto nummer ${deal.nr}. Glöm den inte.`, true, 2.4);
    if (deal.kind === 'salj') toast($t`💰 Sålt: ${deal.name} för ${fmt(deal.amount)}. Såld är såld!`, 'good');
    else toast($t`🤝 Lånat ${fmt(deal.amount)} mot ${deal.name} (kvitto nr ${deal.nr}). Lös ut den för ${fmt(deal.skuld)} senast ${dayLabel(deal.sista)}.`, 'good');
    pbWalk(SAFE.x0 + 16, () => { pb.dir = 'up'; if (deal) { deal.phase = 'kassa'; deal.t = 0; safeOpen = true; play('click'); } });
    return { ok: true };
  }
  function declineDeal(silent = false) {
    if (!deal) return;
    deal.phase = 'tillbaka'; deal.t = 0;
    if (!silent) pbSay($t('Som du vill.'), true);
  }
  function redeem(nr) {
    if (deal) { pbSay($t('Ett ögonblick.'), true); return { ok: false }; }
    const before = pantList(g).find((p) => p.nr === nr);
    if (!before || typeof g.redeemPant !== 'function') return { ok: false };
    const slot = slotMap().get(nr);
    const r = g.redeemPant(nr);
    if (!r.ok) { play('fel'); toast('💍 ' + r.msg, 'bad'); pbSay(g.money < (before.skuld | 0) || /råd/.test(r.msg) ? $t('Inga pengar, ingen möbel.') : $t('Nej.'), true); return r; }   // (pengarna avgör, inte texten – den är översatt)
    play('coin');
    deal = { kind: 'losa', item: itemOf(before), name: nameOf(before.k), amount: before.skuld, nr, phase: 'hamtaPant', t: 0, ghost: slot !== undefined ? { slot, item: itemOf(before), nr } : null };
    pbSay($t('Jaha. Du kom tillbaka.'), true);
    toast($t`📦 Utlöst: ${deal.name} för ${fmt(before.skuld)} – den hamnar i förrådet.`, 'good');
    const sx = slot !== undefined ? SLOTS[slot].x + 15 : 420;
    pbWalk(sx, () => {
      pb.dir = 'up';
      if (!deal) return;
      deal.ghost = null; pb.carry = deal.item; deal.phase = 'barPant';
      pbWalk(HATCH_X, () => { pb.dir = 'down'; if (deal) { pb.carry = null; deal.phase = 'ge'; deal.t = 0; play('click'); } });
    });
    return r;
  }
  function bills() { return clamp(Math.ceil((deal?.amount || 0) / 100), 1, 8); }
  function updateDeal(dt) {
    if (!deal) return;
    const d = deal;
    d.t += dt * fast;
    switch (d.phase) {
      case 'lagg':
        if (d.t > 0.45) { d.phase = 'syna'; d.t = 0; pbSay(pick(PB_INSPECT), true, 2); }
        break;
      case 'syna':
        if (pb.mode === 'walk') d.t = 0;
        else if (d.t > 1.9) { d.phase = 'bud'; d.t = 0; openOffer(); }
        break;
      case 'bud':
        if (!modalOpen()) declineDeal();
        break;
      case 'tillbaka':
        if (d.t > 0.45) deal = null;
        break;
      case 'kassa':
        if (d.t > 0.7) { d.phase = 'bar'; safeOpen = false; play('click'); pbWalk(HATCH_X, () => { pb.dir = 'down'; if (deal) { deal.phase = 'rakna'; deal.t = 0; deal.n = 0; } }); }
        break;
      case 'rakna': {
        const n = Math.min(bills(), Math.floor(d.t / 0.17));
        if (n > d.n) { d.n = n; SND.bill(); }
        if (d.t > bills() * 0.17 + 0.35) {
          d.phase = 'klart'; d.t = 0;
          SND.kaching();
          for (let k = 0; k < bills(); k++) flyers.push({ kind: 'bill', x0: HATCH_X - 6 + (k % 4) * 3, y0: CNT.top + 2, t: -k * 0.05 });
          pops.push({ x: walker.px, y: walker.py - 52, s: $t`+${d.amount} KR`, t: 0 });
        }
        break;
      }
      case 'klart':
        if (d.t > 0.6) {
          pb.carry = d.item; d.phase = 'stuva'; d.t = 0;
          if (d.kind === 'pant') {
            const slot = slotMap().get(d.nr);
            pbWalk(slot !== undefined ? SLOTS[slot].x + 15 : 420, () => { pb.dir = 'up'; pb.carry = null; deal = null; play('click'); pb.t = 1.5; });
          } else pbWalk(PB_MAX, () => { pb.dir = 'right'; pb.carry = null; deal = null; pb.t = 1; }); // sålt: in bakom disken, bort till lagret
        }
        break;
      case 'ge':
        if (d.t > 0.5 && !d.flew) { d.flew = true; flyers.push({ kind: 'item', item: d.item, x0: ITEM_X, y0: CNT.top + 4, t: 0 }); pbSay($t('Här. Ta hand om den nu.'), true); }
        if (d.t > 1.1) deal = null;
        break;
    }
  }
  // hyllplatserna för mina panter: stabila (samma pant står kvar på sin plats)
  function slotMap() {
    const pl = pantList(g), used = new Set();
    for (const nr of [...SLOT_OF.keys()]) if (!pl.some((p) => p.nr === nr) && deal?.ghost?.nr !== nr) SLOT_OF.delete(nr);
    for (const s of SLOT_OF.values()) used.add(s);
    for (const p of pl) {
      if (SLOT_OF.has(p.nr)) continue;
      const free = [0, 1, 2, 3].find((i) => !used.has(i));
      if (free === undefined) continue;
      SLOT_OF.set(p.nr, free); used.add(free);
    }
    return SLOT_OF;
  }

  // ---------- dialogen vid luckan ----------
  function faceInto(root) {
    const el = root?.querySelector('[data-pbface]');
    if (!el) return;
    try { const c = portrait(PB_LOOK.c, '#3a2418'); c.style.cssText = 'width:64px;height:auto;image-rendering:pixelated;border:3px solid #17151a;flex:none'; el.replaceWith(c); } catch { el.remove(); }
  }
  // möbelns bild i en dialograd (heltalsförstoring, skarpa pixlar)
  function furnInto(el, item) {
    if (!el) return;
    const a = furnImg(item.k, item.v, item.c, item.r);
    const c = document.createElement('canvas');
    if (a) {
      c.width = a.w; c.height = a.h;
      drawFurn(c.getContext('2d'), a, 0, 0);
      const k = Math.max(1, Math.floor(40 / Math.max(a.w, a.h)));
      c.style.cssText = `width:${a.w * k}px;height:${a.h * k}px;image-rendering:pixelated;justify-self:center`;
    } else {
      const p = parcel(18, 12, item.k.length);
      c.width = p.w; c.height = p.h; c.getContext('2d').drawImage(p.img, 0, 0);
      c.style.cssText = `width:${p.w * 2}px;height:${p.h * 2}px;image-rendering:pixelated;justify-self:center`;
    }
    el.replaceWith(c);
  }
  function openDesk(tab = deskTab) {
    if (!isOpen()) { pbSay(pick(PB_CLOSED), true); hint($t`🔒 Stängt – pantbanken har öppet ${HOURS[0]}–${HOURS[1]}.`); return false; }
    if (deal) { pbSay($t('Ett ögonblick. Jag räknar.'), true); return false; }
    if (Math.abs(pb.x - HATCH_X) > 2) { pbSay($t('Jaja. Jag kommer.'), true); pbWalk(HATCH_X, () => { pb.dir = 'down'; openDesk(tab); }); return false; }
    deskTab = tab;
    walker.dir = 'up';
    const st = g.storage, pl = pantList(g), full = pl.length >= MAXP();
    const tabs = [['salj', $t('💰 Sälj')], ['pant', $t('🤝 Låna mot pant')], ['panter', $t`🧾 Mina panter (${pl.length})`]];
    let rows = '', intro = '';
    const row = (furn, name, sub, price, btn) => `<div class="prow shoprow">${furn}<span class="nm">${name}<br><small class="sp">${sub}</small></span><b style="font-size:var(--f2)">${price}</b>${btn}</div>`;
    if (tab === 'salj') {
      intro = $t`Pantlånaren köper möbler ur ditt förråd för <b>halva katalogpriset</b>. Såld är såld – <b>inga returer</b>.`;
      rows = st.map((it, i) => (g.sellable(it)
        ? row(`<span data-furn="${i}"></span>`, esc(nameOf(it.k)), $t`Katalogpris ${fmt(katalogOf(it.k).price)} · du får hälften`, fmt(saleOf(it.k)), `<button class="btn btn-small btn-go" data-salj="${i}">${$t('💰 Sälj')}</button>`)
        : row(`<span data-furn="${i}"></span>`, esc(nameOf(it.k)), $t('Startmöbel – den tar pantlånaren inte emot'), '–', `<button class="btn btn-small" disabled>${$t('Behåll')}</button>`))).join('');
    } else if (tab === 'pant') {
      intro = canPawn(g)
        ? `${$t`Lämna en möbel som pant och få <b>${Math.round(RATE() * 100)} % av katalogpriset</b> direkt. Betala tillbaka lånet + <b>${Math.round(INTEREST() * 100)} % ränta</b> inom <b>${DAYS()} dagar</b> så får du tillbaka möbeln – annars behåller pantbanken den.`}${full ? ` <b class="bad">${$t`Du har redan ${MAXP()} panter – lös ut något först.`}</b>` : ''}`
        : $t('Pantlånet har inte öppnat än – men du kan sälja.');
      rows = st.map((it, i) => {
        if (!g.sellable(it)) return row(`<span data-furn="${i}"></span>`, esc(nameOf(it.k)), $t('Startmöbel – den tar pantlånaren inte emot'), '–', `<button class="btn btn-small" disabled>${$t('Behåll')}</button>`);
        const lan = loanOf(it.k);
        return row(`<span data-furn="${i}"></span>`, esc(nameOf(it.k)), $t`Lån ${fmt(lan)} nu · betala ${fmt(debtOf(lan))} senast ${dayLabel(g.day + DAYS())}`, fmt(lan),
          `<button class="btn btn-small btn-go" data-pant="${i}" ${full || !canPawn(g) ? 'disabled' : ''}>${$t('🤝 Pantsätt')}</button>`);
      }).join('');
    } else {
      intro = pl.length ? $t('Dina möbler som står i pantbanken. Lös ut dem innan tiden går ut!') : $t('Du har inga panter. Pantsätt en möbel under fliken <b>Låna mot pant</b>.');
      const storageFull = st.length >= MAXS();
      rows = pl.map((p) => {
        const left = g.pantDaysLeft ? g.pantDaysLeft(p) : p.sista - g.day;
        const when = left <= 0 ? `<b class="bad">${$t('SISTA DAGEN I DAG!')}</b>` : $t`${dagar(left)} kvar – senast ${dayLabel(p.sista)}`;
        const can = g.money >= p.skuld && !storageFull;
        return row(`<span data-pfurn="${p.nr}"></span>`, `${esc(nameOf(p.k))} <small class="sp">${$t`kvitto nr ${p.nr}`}</small>`, `${$t`Lånade ${fmt(p.lan)} dag ${p.dag}`} · ${when}${storageFull ? ` · ${$t('förrådet är fullt')}` : g.money < p.skuld ? ` · ${$t('du har inte råd än')}` : ''}`,
          fmt(p.skuld), `<button class="btn btn-small ${can ? 'btn-go' : ''}" data-losa="${p.nr}" ${can ? '' : 'disabled'}>${$t('📦 Lös ut')}</button>`);
      }).join('');
    }
    if (!rows && tab !== 'panter') rows = `<p style="font-size:var(--f2)">${$t('Förrådet är tomt. Köp möbler på MÖBELJÄTTEN – eller ställ undan något hemma i Möblera-läget så hamnar det i förrådet.')}</p>`;
    const body = `<div style="display:flex;gap:12px;align-items:center"><span data-pbface></span><p style="font-size:var(--f2);margin:0">«${esc(pick(PB_DESK))}»<br><small class="sp">${$t`💰 Du har <b>${fmt(g.money)}</b> · 📦 ${st.length} i förrådet`}</small></p></div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin:10px 0 6px">${tabs.map(([id, label]) => `<button class="btn btn-small ${id === tab ? 'btn-gold' : ''}" data-tab="${id}">${label}</button>`).join('')}</div>
      <p style="font-size:var(--f2);margin:0 0 8px">${intro}</p><div class="plist">${rows}</div>`;
    const dlg = openModal($t('💍 Pantbanken'), body, [{ label: $t('Stäng'), onClick: closeDlg }]);
    faceInto(dlg);
    dlg.querySelectorAll('[data-furn]').forEach((el) => { const it = st[+el.dataset.furn]; if (it) furnInto(el, itemOf(it)); });
    dlg.querySelectorAll('[data-pfurn]').forEach((el) => { const p = pl.find((q) => q.nr === +el.dataset.pfurn); if (p) furnInto(el, itemOf(p)); });
    dlg.querySelectorAll('[data-tab]').forEach((b) => (b.onclick = () => { play('click'); openDesk(b.dataset.tab); }));
    dlg.querySelectorAll('[data-salj]').forEach((b) => (b.onclick = () => { closeDlg(); startDeal('salj', +b.dataset.salj); }));
    dlg.querySelectorAll('[data-pant]').forEach((b) => (b.onclick = () => { closeDlg(); startDeal('pant', +b.dataset.pant); }));
    dlg.querySelectorAll('[data-losa]').forEach((b) => (b.onclick = () => { closeDlg(); redeem(+b.dataset.losa); }));
    return true;
  }

  // ---------- gå ut ----------
  function exit() { ring(); play('door'); A.go('city'); }

  // ---------- klickbara platser ----------
  let pendingHint = null;
  const sayHint = (s) => talk.say(s, () => ({ x: walker.px, y: walker.py - 44 }), undefined, { voice: 'self' });
  function hint(s) {
    if (t - lastHint < 1.6) return;
    lastHint = t; play('click');
    if (talkPB.active() && Math.abs(pb.x - walker.px) < 90 && walker.py < 170) pendingHint = { s, until: t + 4 };
    else { pendingHint = null; sayHint(s); }
  }
  function updateHint() {
    if (!pendingHint) return;
    if (t > pendingHint.until) pendingHint = null;
    else if (!talkPB.active()) { sayHint(pendingHint.s); pendingHint = null; }
  }
  function strum(i) {
    const G = GUITARS[i], C = CHORDS[G.kind];
    SND.strum(C.f, C.dur, C.bright);
    wob[i] = 1;
    if (isOpen() && t - pb.watchT > 5) { pb.watchT = t; pbSay(pick(PB_WATCH), false); }
    hint([$t('🎸 En gammal akustisk. Strängarna är rostiga.'), $t('🎸 Röd elgitarr – låter bättre i en förstärkare.'), $t('🎸 En svart bas. Det brummar i magen.'), $t('🎸 Sunburst med guldrattar. Tung!'), $t('🪕 En banjo! Plonk-plonk.')][i]);
  }
  const mySlots = () => { const m = slotMap(); return pantList(g).map((p) => ({ p, s: m.get(p.nr) })); };
  const spots = [
    { id: 'lucka', r: [HATCH.x0 - 4, HATCH.top - 2, HATCH.x1 + 4, CNT.base], go: SERVE, act: () => openDesk() },
    { id: 'skylt', r: [SIGN.x0, SIGN.top, SIGN.x1, SIGN.bot], go: SERVE, act: () => hint($t`📜 PANTLÅN: ${Math.round(RATE() * 100)} % av priset direkt. Tillbaka inom ${DAYS()} dagar + ${Math.round(INTEREST() * 100)} % – annars är möbeln deras.`) },
    { id: 'klocka', r: [BELL.x - 5, BELL.y - 5, BELL.x + 5, BELL.y + 5], go: [BELL.x, 146], act: () => {
      SND.ding();
      if (!isOpen()) { pbSay(pick(PB_CLOSED), true); return; }
      pbSay(Math.random() < 0.5 ? $t('Jag hör. Jag är inte döv.') : $t('Ja, ja, JA.'), true);
      walker.walkTo(SERVE[0], SERVE[1], () => { walker.dir = 'up'; setTimeout(() => { if (A.scene === SCENE && !modalOpen()) openDesk(); }, 350); });
    } },
    ...GUITARS.map((G, i) => ({ id: 'gitarr' + i, r: [G.x - 9, 20, G.x + 9, 68], go: [G.x, 112], act: () => strum(i) })),
    { id: 'forstarkare', r: [AMP.x0, AMP.base - 38, AMP.x1, AMP.base], go: [26, 112], act: () => { SND.amp(); hint($t('🔊 FUNKAR (NÄSTAN). Den brummar och tjuter.')); } },
    { id: 'trummor', r: [DRUMS.x0, DRUMS.base - 44, DRUMS.x1, DRUMS.base], go: [72, 114], act: () => { SND.drums(); hint($t('🥁 Ba-dom-tsch!')); if (isOpen()) setTimeout(() => pbSay($t('TYST!'), true), 900); } },
    { id: 'mora', r: [MORA.x0, MORA.base - 66, MORA.x1, MORA.base], go: [36, 152], face: 'left', act: () => { SND.tick(); hint($t('🕰️ En moraklocka för 3 500 kr. Den tickar högt.')); } },
    { id: 'papegoja', r: [CAGE.x0, CAGE.top - 8, CAGE.x1, CAGE.bot], go: [146, 100], act: () => birdSay() },
    { id: 'guld', r: [GOLD.x0, GOLD.top, GOLD.x1, GOLD.bot], go: [196, 146], act: () => hint($t('💰 VI KÖPER GULD. Jag har inget guld – bara möbler.')) },
    { id: 'kassaskap', r: [SAFE.x0, SAFE.top - 14, SAFE.x1, SAFE.base], go: [196, 146], act: () => { hint($t('🔒 Ett kassaskåp från 1912 med en monitor ovanpå.')); if (isOpen()) pbSay($t('Glöm det.'), true); } },
    { id: 'klockor', r: [REG.x0, CEIL, 256, 68], go: [236, 146], act: () => { SND.tick(); hint($t('🕰️ Tre klockor, tre tider. Bara den höga går rätt.')); } },
    { id: 'kulor', r: [266, 12, 298, 45], go: SERVE, act: () => hint($t('🟡 Tre guldkulor – pantbankernas gamla tecken.')) },
    { id: 'tv', r: [TVR.x0, TVR.top, TVR.x1, TVR.b2 + 2], go: [345, 146], act: () => { tvCh = (tvCh + 1) % 4; play('click'); hint([$t('📺 Akvariet. Fiskarna simmar i en tv från 1978.'), $t('📺 Testbilden. Klockan är mitt i natten i tv-land.'), $t('📺 Myrornas krig.'), $t('📺 Fotboll! Ingen vet vem som leder.')][tvCh]); } },
    { id: 'panter', r: [PSH.x0, PSH.top, PSH.x1, PSH.b2 + 2], go: [420, 146], act: () => {
      const mine = mySlots();
      if (!mine.length) { hint($t('📦 PANTER – andras saker med kvittonummer. Inget av det är mitt.')); return; }
      const p = mine[0].p, left = g.pantDaysLeft ? g.pantDaysLeft(p) : p.sista - g.day;
      hint(left <= 0 ? $t`📦 Där står ${nameOf(p.k).toLowerCase()} – kvitto nr ${p.nr}. SISTA DAGEN I DAG!` : $t`📦 Där står ${nameOf(p.k).toLowerCase()} – kvitto nr ${p.nr}. ${dagar(left)} kvar.`);
    } },
    { id: 'monter', r: [FLAP.x1, CNT.face - 2, CNT.x1, CNT.base], go: null, row: CNT.base, act: () => hint($t('💍 Ringar, fickur, en byst med guldkedja – och en guldtand.')) },
    { id: 'disklock', r: [FLAP.x0, CNT.top - 2, FLAP.x1, CNT.base], go: [166, 146], act: () => { hint($t('🚪 EJ IN. Disklocket är personalens väg.')); if (isOpen()) pbSay($t('Stanna på din sida.'), true); } },
    { id: 'lp', r: [LP.x0, LP.base - 30, LP.x1, LP.base], go: [209, 190], face: 'down', act: () => hint($t('💿 LP-skivor för 10 kr. En har en solnedgång på omslaget.')) },
    { id: 'cykel', r: [BIKE.x0, BIKE.base - 32, BIKE.x1, BIKE.base], go: [340, 190], face: 'down', act: () => hint($t('🚲 En damcykel med blommor i korgen. Någons cykel?')) },
    { id: 'vitrin', r: [VITR.x0, VITR.base - 60, VITR.x1, VITR.base], go: [428, 188], face: 'down', act: () => hint($t('📷 Kameror, tv-spel, en trumpet och en pokal. Allt inlåst.')) },
    { id: 'klubbor', r: [CLUBS.x0 - 4, CLUBS.base - 44, CLUBS.x1 + 4, CLUBS.base], go: [139, 190], face: 'down', act: () => hint($t('🏑 Golfklubbor, hockeyklubbor och ett paraply i en tunna.')) },
    { id: 'dorr', r: [DOOR.x0 - 6, FRONT_Y - 10, DOOR.x1 + 6, H], go: [DOOR_X, FRONT_Y - 5], act: exit },
  ];
  const spotAt = (x, y) => spots.find((s) => x >= s.r[0] && x <= s.r[2] && y >= s.r[1] && y <= s.r[3]);
  const spotById = (id) => spots.find((s) => s.id === id);
  function clickSpot(s, x) {
    const done = () => { walker.dir = s.face || 'up'; s.act(); };
    if (s.go) walker.walkTo(s.go[0], s.go[1], done);
    else if (s.row !== undefined) walker.walkTo(clamp(x, s.r[0] + 6, s.r[2] - 6), s.row + 12, done);
    else s.act();
  }
  const focusSpot = () => {
    const h = hoverId && t - hoverT < 4 && spotById(hoverId);
    if (h && (h.id === 'lucka' || h.id === 'dorr')) return h;
    if (walker.path.length) return null;
    if (Math.hypot(walker.px - SERVE[0], walker.py - SERVE[1]) < 8) return spotById('lucka');
    return null;
  };

  // ---------- HUD: mina panter (panel uppe i hörnet) och namnskylten ----------
  let panelHits = [], panelSide = 'left';
  function drawPanel(ctx) {
    panelHits = [];
    const pl = pantList(g);
    if (!pl.length) return;
    const w = 128, y0 = 4 + (globalThis.SF?.view?.safe?.y0 | 0), h = 15 + pl.length * 9 + 3;
    const fx = walker.px - cam.x, fy = walker.py - cam.y;
    const under = (px0) => fx > px0 - 10 && fx < px0 + w + 10 && fy - 40 < y0 + h + 4;
    if (panelSide === 'left' && under(4)) panelSide = 'right';
    else if (panelSide === 'right' && under(VW - 4 - w) && !under(4)) panelSide = 'left';
    const x0 = panelSide === 'left' ? 4 : VW - 4 - w;
    ctx.fillStyle = '#0e0d12'; ctx.fillRect(x0 - 2, y0 - 2, w + 4, h + 4);
    ctx.fillStyle = '#c8a040'; ctx.fillRect(x0 - 1, y0 - 1, w + 2, h + 2);
    ctx.fillStyle = '#f6f1e2'; ctx.fillRect(x0, y0, w, h);
    ctx.fillStyle = '#141016'; ctx.fillRect(x0, y0, w, 11);
    ctxText(ctx, SM, $t('MINA PANTER'), x0 + 4, y0 + 3, '#f0c848');
    const cnt = `${pl.length}/${MAXP()}`;
    ctxText(ctx, SM, cnt, x0 + w - 4 - textW(SM, cnt), y0 + 3, '#e8d8a8');
    let y = y0 + 14;
    for (const p of pl) {
      const left = g.pantDaysLeft ? g.pantDaysLeft(p) : p.sista - g.day;
      const col = left <= 0 ? '#c9323a' : left <= 2 ? '#a86a10' : '#2a6a3a';
      ctxText(ctx, SM, $t`NR ${p.nr}`, x0 + 4, y, '#6a6070');
      const nm = nameOf(p.k).toUpperCase().replace(/[^A-ZÅÄÖÉÁÀÂÃÇĆÈÊËÍÌÎÏÑŃÓÒÔÕŚŹŻÚÙÛÜŸÝĄĘŁŒÆ¡¿€$0-9 ]/g, '').slice(0, 11);
      ctxText(ctx, SM, nm, x0 + 30, y, '#2a2430');
      const d = left <= 0 ? $t('I DAG') : $t`${left} D`, pr = $t`${p.skuld}:-`;
      ctxText(ctx, SM, d, x0 + w - 36 - textW(SM, d), y, col);
      ctxText(ctx, SM, pr, x0 + w - 4 - textW(SM, pr), y, '#8a1a10');
      y += 9;
    }
  }
  function bigLabel(ctx, s, atTop) {
    let name, hintTxt, col = '#f0c848';
    if (s.id === 'lucka') {
      name = isOpen() ? $t('KASSALUCKAN') : $t('STÄNGT');
      hintTxt = !isOpen() ? $t`ÖPPET ${HOURS[0]}-${HOURS[1]}` : !deal ? $t('KLICKA - SÄLJ, LÅNA ELLER LÖS UT')
        : ['lagg', 'syna', 'bud'].includes(deal.phase) ? $t('PANTLÅNAREN SYNAR VARAN') : deal.phase === 'tillbaka' ? $t('VARAN LÄGGS TILLBAKA') : $t('PANTLÅNAREN RÄKNAR OCH STÄDAR UNDAN');
    } else if (s.id === 'dorr') { name = $t('UTGÅNG'); hintTxt = $t('TILLBAKA UT I FÖRORTEN'); col = '#ffa43a'; }
    else return;
    const nwd = textW(BG, name), hw = textW(SM, hintTxt);
    const w = Math.max(nwd, hw) + 14, h = 22;
    const x0 = Math.round((VW - w) / 2), y0 = atTop ? 3 + (globalThis.SF?.view?.safe?.y0 | 0) : VH - h - 3;
    ctx.fillStyle = '#0e0d12'; ctx.fillRect(x0 - 2, y0 - 2, w + 4, h + 4);
    ctx.fillStyle = col; ctx.fillRect(x0 - 1, y0 - 1, w + 2, h + 2);
    ctx.fillStyle = '#17151a'; ctx.fillRect(x0, y0, w, h);
    ctxText(ctx, BG, name, x0 + 7, y0 + 3, '#ffffff');
    ctxText(ctx, SM, hintTxt, x0 + 7, y0 + 14, Math.floor(t * 2) % 2 === 0 ? col : '#c9c2d2');
  }

  // ---------- ritning ----------
  // glittret i montern: några guldprickar som blänker till då och då
  const GLINTS = Array.from({ length: 14 }, (_, k) => [FLAP.x1 + 6 + Math.floor(hash(k, 1, 191) * (CNT.x1 - FLAP.x1 - 12)), CNT.top + 1 + Math.floor(hash(k, 2, 191) * 20), hash(k, 3, 191) * 6]);
  function drawItemAt(ctx, item, cx, base, maxW = 48, maxH = 40) {
    const a = furnImg(item.k, item.v, item.c, item.r);
    if (a && a.w <= maxW && a.h <= maxH) { drawFurn(ctx, a, Math.round(cx - a.w / 2), Math.round(base - a.h)); return a.h; }
    const p = parcel(Math.min(20, maxW - 4), Math.min(13, maxH - 4), item.k.length);
    ctx.drawImage(p.img, Math.round(cx - p.w / 2), Math.round(base - p.h));
    return p.h;
  }
  function liveWall(ctx) {
    // visarna: regulatorn går rätt, de andra fel
    for (const C of CLOCKS) {
      const m = (g.min + C.off + 1440 * 4) % 1440;
      const ha = ((m % 720) / 720) * Math.PI * 2 - Math.PI / 2, ma = ((m % 60) / 60) * Math.PI * 2 - Math.PI / 2;
      ctx.fillStyle = '#1a1612';
      for (let k = 0; k <= Math.max(1, Math.round(C.r * 0.5)); k++) ctx.fillRect(Math.round(C.cx - 0.5 + Math.cos(ha) * k), Math.round(C.cy - 0.5 + Math.sin(ha) * k), 1, 1);
      ctx.fillStyle = '#3a3a44';
      for (let k = 0; k <= Math.round(C.r * 0.8); k++) ctx.fillRect(Math.round(C.cx - 0.5 + Math.cos(ma) * k), Math.round(C.cy - 0.5 + Math.sin(ma) * k), 1, 1);
      if (C.id === 'station') { const sa = (t % 60) / 60 * Math.PI * 2 - Math.PI / 2; ctx.fillStyle = '#d82a2a'; for (let k = 1; k <= C.r - 1; k++) ctx.fillRect(Math.round(C.cx - 0.5 + Math.cos(sa) * k), Math.round(C.cy - 0.5 + Math.sin(sa) * k), 1, 1); }
    }
    // regulatorns pendel
    { const sw = Math.sin(t * Math.PI) * 3.2, x0 = 221, y0 = 32, y1 = 57;
      ctx.fillStyle = '#b89a4a';
      for (let y = y0; y < y1; y++) ctx.fillRect(Math.round(x0 - 0.5 + sw * (y - y0) / (y1 - y0)), y, 1, 1);
      const bx = Math.round(x0 - 0.5 + sw) - 2; ctx.fillStyle = '#8a6414'; ctx.fillRect(bx, y1 - 1, 5, 4); ctx.fillStyle = '#f0c848'; ctx.fillRect(bx + 1, y1 - 1, 3, 3); ctx.fillStyle = '#fff0a0'; ctx.fillRect(bx + 1, y1 - 1, 1, 1); }
    // gökuret: luckan går upp och göken tittar ut varje hel timme
    if (t - cuckooT < 2.6) {
      const cx = (CUCKOO.x0 + CUCKOO.x1) >> 1, ph = Math.floor((t - cuckooT) / 0.62) % 2;
      ctx.fillStyle = '#6a3a1a'; ctx.fillRect(cx - 5, CUCKOO.top + 8, 2, 5); // luckan öppen
      const bx = cx - 2, by = CUCKOO.top + 8 + (ph ? 1 : 0);
      ctx.fillStyle = '#17151a'; ctx.fillRect(bx - 1, by - 1, 7, 6);
      ctx.fillStyle = '#8a5a2a'; ctx.fillRect(bx, by, 4, 4); ctx.fillStyle = '#e8d8b0'; ctx.fillRect(bx + 1, by + 2, 2, 2);
      ctx.fillStyle = '#f0c040'; ctx.fillRect(bx + 4, by + 1 + ph, 2, 1); ctx.fillStyle = '#17151a'; ctx.fillRect(bx + 2, by + 1, 1, 1);
    }
    // TV-skärmarna
    SCREENS.forEach((S, i) => {
      const kind = i === 2 ? ['fisk', 'test', 'snow', 'fotboll'][tvCh] : S.kind;
      tvScreen(ctx, S, kind, i);
    });
    // övervakningsmonitorn på kassaskåpet visar butiken i grönt: prickar där folk står
    { const mx = SAFE.x0 + 9, my = SAFE.top - 11, mw = 14, mh = 9;
      ctx.fillStyle = '#0e1a10'; ctx.fillRect(mx, my, mw, mh);
      ctx.fillStyle = '#1e3a22'; for (let y = my; y < my + mh; y += 2) ctx.fillRect(mx, y, mw, 1);
      ctx.fillStyle = '#2e5a32'; ctx.fillRect(mx + 5, my + 2, mw - 5, 2); // disken
      const dot = (x, y, c) => { ctx.fillStyle = c; ctx.fillRect(mx + clamp(Math.round(x / W * mw), 0, mw - 1), my + clamp(Math.round((y - WALL_Y) / (FRONT_Y - WALL_Y) * mh), 0, mh - 1), 1, 1); };
      if (Math.floor(t * 3) % 4) dot(walker.px, walker.py, '#c8ffc8');
      if (npc.state !== 'away') dot(npc.w.px, npc.w.py, '#8ae08a');
      if (Math.floor(t * 7) % 9 === 0) { ctx.fillStyle = 'rgba(200,255,200,.35)'; ctx.fillRect(mx, my + Math.floor(t * 11) % mh, mw, 1); } }
    // pantlagret: mina panter på sina platser, annars pantbankens egna saker
    const m = slotMap();
    for (let i = 0; i < SLOTS.length; i++) {
      const S = SLOTS[i];
      let mine = null;
      for (const p of pantList(g)) if (m.get(p.nr) === i && deal?.hide !== p.nr) mine = { item: itemOf(p), nr: p.nr, left: g.pantDaysLeft ? g.pantDaysLeft(p) : p.sista - g.day };
      if (!mine && deal?.ghost?.slot === i) mine = { item: deal.ghost.item, nr: deal.ghost.nr, left: 1 };
      if (mine) {
        drawItemAt(ctx, mine.item, S.x + S.w / 2, S.b, S.w, S.h);
        numberTag(ctx, S.x + S.w - 11, S.b - 8, mine.nr, mine.left <= 0 ? '#ff7a7a' : mine.left <= 2 ? '#ffe070' : '#8ae08a');
      } else put(ctx, R.others[i]);
    }
    // papegojan i sin bur
    put(ctx, R.cageBack);
    const bs = R.parrot[(bird.flap > 0 && Math.floor(t * 10) % 2 ? 'flap' : bird.state === 'talk' && Math.floor(t * 6) % 2 ? 'talk' : 'sit') + (bird.flip ? 'L' : '')];
    ctx.drawImage(bs.img, Math.round(bird.x - 3), Math.round(bird.y - bs.h + (bird.state === 'sit' && Math.floor(t * 0.8) % 5 === 0 ? 1 : 0)));
    put(ctx, R.cageFront);
  }
  // en tv-skärm: testbild, myrornas krig, akvariet eller fotboll
  function tvScreen(ctx, S, kind, i) {
    const { x, y, w, h } = S;
    if (kind === 'test') {
      const cols = ['#e8e8e8', '#e8e030', '#30d8e0', '#30d040', '#d830d0', '#d83030', '#3030d8'];
      for (let k = 0; k < w; k++) { ctx.fillStyle = cols[Math.floor(k / w * 7)]; ctx.fillRect(x + k, y, 1, h - 3); }
      ctx.fillStyle = '#1a1a1e'; ctx.fillRect(x, y + h - 3, w, 3); ctx.fillStyle = '#f4f4f4'; ctx.fillRect(x + (w >> 1) - 1, y + h - 3, 3, 3);
    } else if (kind === 'snow') {
      ctx.drawImage(R.snow[(Math.floor(t * 14) + i) % R.snow.length], 0, 0, w, h, x, y, w, h);
      const band = Math.floor((t * 7 + i * 3) % (h + 6)) - 3; if (band >= 0 && band < h) { ctx.fillStyle = 'rgba(255,255,255,.3)'; ctx.fillRect(x, y + band, w, 1); }
    } else if (kind === 'fisk') {
      for (let j = 0; j < h; j++) { ctx.fillStyle = j < h * 0.3 ? '#1a4a8a' : j < h * 0.7 ? '#12367a' : '#0a2458'; ctx.fillRect(x, y + j, w, 1); }
      ctx.fillStyle = '#c8b070'; ctx.fillRect(x, y + h - 2, w, 2); ctx.fillStyle = '#2a8a3a'; ctx.fillRect(x + 3, y + h - 6, 1, 4); ctx.fillRect(x + 4, y + h - 5, 1, 3); ctx.fillRect(x + w - 4, y + h - 7, 1, 5);
      for (let k = 0; k < 3; k++) {
        const dir = k % 2 ? -1 : 1, fx = x + ((t * (5 + k * 2) * dir + k * 7) % w + w) % w, fy = y + 3 + k * 3 + Math.round(Math.sin(t * 2 + k) * 1);
        ctx.fillStyle = ['#ff8a2a', '#f0e040', '#ff5a8a'][k]; ctx.fillRect(Math.round(fx), fy, 3, 2); ctx.fillRect(Math.round(fx) - dir, fy, 1, 2);
        ctx.fillStyle = '#17151a'; ctx.fillRect(Math.round(fx) + (dir > 0 ? 2 : 0), fy, 1, 1);
      }
      ctx.fillStyle = '#b8e0ff'; for (let k = 0; k < 2; k++) { const ph = (t * 0.6 + k * 0.5) % 1; ctx.fillRect(x + 5 + k * 9, Math.round(y + h - 3 - ph * (h - 3)), 1, 1); }
    } else {
      ctx.fillStyle = '#2a8a3a'; ctx.fillRect(x, y, w, h); ctx.fillStyle = '#34a044'; for (let k = 0; k < w; k += 4) ctx.fillRect(x + k, y, 2, h);
      ctx.fillStyle = '#e8f0e8'; ctx.fillRect(x + (w >> 1), y, 1, h); ctx.fillRect(x, y + 1, w, 1); ctx.fillRect(x, y + h - 2, w, 1);
      for (let k = 0; k < 4; k++) { const px = x + 2 + ((Math.sin(t * (0.7 + k * 0.3) + k * 2) + 1) / 2) * (w - 4), py = y + 3 + ((Math.cos(t * (0.5 + k * 0.2) + k) + 1) / 2) * (h - 6); ctx.fillStyle = k % 2 ? '#d82a2a' : '#2a4ad8'; ctx.fillRect(Math.round(px), Math.round(py), 1, 2); }
      ctx.fillStyle = '#ffffff'; ctx.fillRect(Math.round(x + 2 + ((Math.sin(t * 1.3) + 1) / 2) * (w - 4)), Math.round(y + 4 + ((Math.sin(t * 0.9 + 1) + 1) / 2) * (h - 8)), 1, 1);
    }
    ctx.fillStyle = 'rgba(255,255,255,.16)'; ctx.fillRect(x, y, 2, 1); ctx.fillRect(x, y, 1, 2); // glaset buktar
  }
  // pantlånaren bakom disken (gallret ritas över honom av diskens bild)
  function drawPB(ctx) {
    const walking = pb.mode === 'walk';
    const frame = walking ? WALK_SEQ[Math.floor(t * 8) % 4] : pb.carry ? 9 : (deal?.phase === 'syna' ? 0 : Math.sin(t * 1.3) > 0.94 ? 4 : 0);
    const L = pbLook();
    drawPerson(ctx, pb.x, PB_Y, L, pb.dir, pb.carry && walking ? [7, 9, 8, 9][Math.floor(t * 8) % 4] : frame);
    const x = Math.round(pb.x), y = PB_Y;
    // det han bär: små saker som de är, större inslagna i papper (annars skymmer de honom helt)
    if (pb.carry) drawItemAt(ctx, pb.carry, x + (pb.dir === 'left' ? -5 : pb.dir === 'right' ? 5 : 0), y - 15, 16, 14);
    // lupp i ögat när han synar en vara
    if (deal?.phase === 'syna' && pb.dir === 'down') {
      ctx.fillStyle = '#17151a'; ctx.fillRect(x + 1, y - 30, 4, 4);
      ctx.fillStyle = '#b8e0ff'; ctx.fillRect(x + 2, y - 29, 2, 2); ctx.fillStyle = '#ffffff'; ctx.fillRect(x + 2, y - 29, 1, 1);
    }
    // biter i ett guldmynt för att se om det är äkta
    if (pb.mode === 'bite' && pb.bite > 0 && pb.dir === 'down') {
      const up = Math.floor(t * 4) % 2;
      ctx.fillStyle = '#8a6414'; ctx.fillRect(x - 1, y - 24 - up, 3, 3); ctx.fillStyle = '#f0c848'; ctx.fillRect(x - 1, y - 24 - up, 2, 2);
    }
  }
  // det som ligger på disken i luckan: varan, sedlarna, rullgallret
  function drawTray(ctx) {
    if (deal) {
      // varan ställs på disken bredvid luckan (så att pantlånaren syns när han synar den)
      const d = deal, tx = ITEM_X, base = CNT.top + 5;
      const onTray = ['syna', 'bud', 'hamta', 'kassa', 'bar', 'rakna', 'klart'].includes(d.phase) || (d.phase === 'ge' && !d.flew);
      if (d.phase === 'lagg' || d.phase === 'tillbaka') {
        const k = clamp(d.t / 0.45, 0, 1), f = d.phase === 'lagg' ? k : 1 - k;
        const x = d.from[0] + (tx - d.from[0]) * f, y = d.from[1] + (base - d.from[1]) * f - Math.sin(f * Math.PI) * 12;
        drawItemAt(ctx, d.item, x, y);
      } else if (onTray) drawItemAt(ctx, d.item, tx, base, 44, 40);
      if (d.phase === 'rakna' || (d.phase === 'klart' && d.t < 0.05)) {
        for (let k = 0; k < (d.n || 0); k++) {
          const bx = HATCH_X - 10 + (k % 4) * 5, by = CNT.top + 1 + (k >> 2);
          ctx.fillStyle = '#17151a'; ctx.fillRect(bx - 1, by - 1, 8, 4);
          ctx.fillStyle = k % 3 === 2 ? '#8ab0e8' : '#8ad09a'; ctx.fillRect(bx, by, 6, 2); ctx.fillStyle = '#e8f8e8'; ctx.fillRect(bx + 2, by, 2, 1);
        }
      }
    }
    // rullgallret över luckan när det är stängt
    if (shutter > 0.02) {
      const hh = Math.round((CNT.top - HATCH.top) * shutter);
      for (let y = HATCH.top; y < HATCH.top + hh; y++) { ctx.fillStyle = (y - HATCH.top) % 3 === 0 ? '#3a3e46' : (y - HATCH.top) % 3 === 1 ? '#9aa2ac' : '#6e7680'; ctx.fillRect(HATCH.x0, y, HATCH.x1 - HATCH.x0, 1); }
      if (shutter > 0.9) { ctx.fillStyle = '#f4f0e6'; ctx.fillRect(HATCH_X - 13, HATCH.top + 8, 27, 9); ctx.fillStyle = '#c8202a'; ctx.fillRect(HATCH_X - 13, HATCH.top + 8, 27, 1); ctxText(ctx, SM, $t('STÄNGT'), HATCH_X - 11, HATCH.top + 11, '#c8202a'); }
    }
  }
  // gitarrerna på väggen – gungar på kroken en stund när man rört dem
  function drawGuitars(ctx) {
    for (let i = 0; i < GUITARS.length; i++) {
      const off = wob[i] > 0.05 ? Math.round(Math.sin(t * 16) * wob[i] * 1.6) : 0;
      put(ctx, R.guitars[i], off, 3); // hänger tre pixlar lägre än de är ritade (under skylten)
    }
  }
  // ljuset: dämpat varmt ljus med hål där lampor, tv-apparater och fönster lyser
  const mask = typeof document !== 'undefined' ? document.createElement('canvas') : null;
  if (mask) { mask.width = W; mask.height = H; }
  const mctx = mask?.getContext('2d');
  function lights(ctx) {
    if (!mctx) return;
    const open = isOpen(), hour = (g.min / 60) % 24, dark = hour >= 20 || hour < 6;
    mctx.globalCompositeOperation = 'source-over';
    mctx.clearRect(0, 0, W, H);
    mctx.fillStyle = open ? 'rgba(34,16,6,.2)' : dark ? 'rgba(6,6,24,.5)' : 'rgba(20,12,20,.32)';
    mctx.fillRect(0, 0, W, H);
    mctx.globalCompositeOperation = 'destination-out';
    const hole = (img, x, y, k) => { mctx.globalAlpha = k; mctx.drawImage(img, Math.round(x - img.width / 2), Math.round(y - img.height / 2)); };
    hole(R.holeBig, 300, 110, open ? 0.9 : 0.4);
    hole(R.holeBig, 90, 110, open ? 0.75 : 0.3);
    hole(R.holeSmall, 375, 96, 0.9);
    hole(R.holeSmall, 345, 40, 0.6);
    hole(R.holeBig, 240, FRONT_Y + 10, dark ? 0.3 : 0.7);
    mctx.globalAlpha = 1; mctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(mask, 0, 0);
    // bordslampans sken och tv-apparaternas blå glöd
    ctx.globalAlpha = open ? 0.9 : 0.5; ctx.drawImage(R.glowLamp, 375 - 27, CNT.top - 16); ctx.globalAlpha = 1;
    ctx.globalAlpha = 0.6; for (const S of SCREENS.slice(0, 3)) ctx.drawImage(R.glowTv, S.x + S.w / 2 - 17, S.y + S.h / 2 - 11); ctx.globalAlpha = 1;
  }
  // framväggen: fönstren (dag, kväll, natt) med folk som går förbi, gallret, dörren
  function drawFront(ctx) {
    const hour = (g.min / 60) % 24, night = hour >= 21 || hour < 6, eve = hour >= 18 && !night;
    const y0 = FRONT_Y + 4;
    for (const [a, b] of [[SIDE, DOOR.x0 - 3], [DOOR.x1 + 3, 270], [273, W - SIDE - 1]]) {
      for (let y = y0; y < H; y++) { const k = (y - y0) / (H - y0); ctx.fillStyle = hexs(night ? mix(0x141a30, 0x0a0e1e, k) : eve ? mix(0x8a6a8a, 0x4a4a6a, k) : mix(0xc8d4dc, 0x9aaab4, k)); ctx.fillRect(a, y, b - a, 1); }
      // gatan: kantstenen och en förbipasserande
      ctx.fillStyle = night ? '#1e2236' : '#8a929a'; ctx.fillRect(a, H - 3, b - a, 3);
      const px = ((t * 18) % (W + 60)) - 30, walker2 = ((t * -13 + 200) % (W + 60) + W + 60) % (W + 60) - 30;
      for (const [fx, c] of [[px, night ? '#0a0c18' : '#3a3440'], [walker2, night ? '#0e1020' : '#4a3a3a']]) if (fx > a - 4 && fx < b + 4) {
        ctx.save(); ctx.beginPath(); ctx.rect(a, y0, b - a, H - y0); ctx.clip();
        ctx.fillStyle = c; ctx.fillRect(Math.round(fx) - 3, y0 + 3, 7, 12); ctx.fillRect(Math.round(fx) - 2, y0 - 1, 5, 4);
        ctx.restore();
      }
    }
    put(ctx, R.frontBars);
    // dörren går upp när någon kommer och dörrklockan svänger
    const o = Math.round(door * 11);
    if (o > 0) {
      ctx.fillStyle = night ? '#0a0e1e' : '#c8d4dc'; ctx.fillRect(DOOR.x0 + 2, FRONT_Y + 3, DOOR.x1 - DOOR.x0 - 4, H - FRONT_Y - 3);
      ctx.fillStyle = '#3a1e12'; ctx.fillRect(DOOR.x1 - 4, FRONT_Y + 2 - o, 4, H - FRONT_Y + o - 2);
      ctx.fillStyle = '#6a3a22'; ctx.fillRect(DOOR.x1 - 4, FRONT_Y + 2 - o, 1, H - FRONT_Y + o - 2);
    }
    const sw = t - bellT < 1.5 ? Math.round(Math.sin((t - bellT) * 18) * 2 * (1 - (t - bellT) / 1.5)) : 0;
    ctx.fillStyle = '#5a5a60'; ctx.fillRect(DOOR_X, FRONT_Y - 1, 1, 3);
    ctx.fillStyle = '#c8a040'; ctx.fillRect(DOOR_X - 2 + sw, FRONT_Y + 2, 5, 3); ctx.fillStyle = '#f0d070'; ctx.fillRect(DOOR_X - 1 + sw, FRONT_Y + 2, 2, 1);
  }
  function drawWorld(ctx, cx, cy, vw, vh) {
    ctx.drawImage(R.bg, cx, cy, vw, vh, cx, cy, vw, vh);
    drawGuitars(ctx);
    liveWall(ctx);
    const inView = (x0, y0, x1, y1) => x1 >= cx - 8 && x0 <= cx + vw + 8 && y1 >= cy - 8 && y0 <= cy + vh + 8;
    const items = [];
    const add = (fy, x0, y0, x1, y1, draw) => { if (inView(x0, y0, x1, y1)) items.push({ fy, draw }); };
    add(SAFE.base, SAFE.x0 - 4, SAFE.top - 14, SAFE.x1 + 4, SAFE.base + 3, () => put(ctx, safeOpen ? R.safeOpen : R.safe));
    add(PB_Y, pb.x - 14, PB_Y - 44, pb.x + 14, PB_Y + 2, () => drawPB(ctx));
    add(CNT.base, CNT.x0, GRL.top - 4, CNT.x1, CNT.base + 3, () => {
      put(ctx, R.counter);
      for (const [gx, gy, ph] of GLINTS) { const k = (t * 0.7 + ph) % 6; if (k < 0.25) { ctx.fillStyle = '#ffffff'; ctx.fillRect(gx, gy, 1, 1); if (k < 0.12) { ctx.fillRect(gx - 1, gy, 3, 1); ctx.fillRect(gx, gy - 1, 1, 3); } } }
      drawTray(ctx);
    });
    add(AMP.base, AMP.x0 - 2, AMP.base - 38, AMP.x1 + 3, AMP.base + 3, () => put(ctx, R.amp));
    add(DRUMS.base, DRUMS.x0 - 3, DRUMS.base - 44, DRUMS.x1 + 4, DRUMS.base + 3, () => put(ctx, R.drums));
    add(MORA.base, MORA.x0 - 2, MORA.base - 66, MORA.x1 + 2, MORA.base + 3, () => { put(ctx, R.mora); moraHands(ctx); });
    add(CLUBS.base, CLUBS.x0 - 4, CLUBS.base - 44, CLUBS.x1 + 4, CLUBS.base + 3, () => put(ctx, R.clubs));
    add(LP.base, LP.x0 - 2, LP.base - 30, LP.x1 + 3, LP.base + 3, () => put(ctx, R.lp));
    add(BIKE.base, BIKE.x0 - 2, BIKE.base - 32, BIKE.x1 + 3, BIKE.base + 3, () => put(ctx, R.bike));
    add(VITR.base, VITR.x0 - 2, VITR.base - 60, VITR.x1 + 3, VITR.base + 3, () => put(ctx, R.vitrine));
    // kunden
    if (npc.state !== 'away') {
      const w = npc.w, walking = w.path.length > 0, carry = !!npc.carry;
      const frame = carry ? (walking ? [7, 9, 8, 9][Math.floor(t * 7) % 4] : 9) : walking ? WALK_SEQ[Math.floor(t * 7) % 4] : Math.sin(t * 2 + w.px) > 0.9 ? 4 : 0;
      add(w.py, w.px - 12, w.py - 46, w.px + 12, w.py + 2, () => {
        const bx = Math.round(w.px) + (w.dir === 'left' ? -6 : w.dir === 'right' ? 6 : 0), by = Math.round(w.py) - 12;
        if (carry && w.dir === 'up') drawNpcCarry(ctx, bx, by, npc.carry);
        drawPerson(ctx, w.px, w.py, npc.look, w.dir, frame);
        if (carry && w.dir !== 'up') drawNpcCarry(ctx, bx, by, npc.carry);
      });
    }
    for (const d of folkDrawables(A, t)) items.push({ fy: d.fy, draw: () => d.draw(ctx) });
    const me = selfDrawable(A, walker, t, { folksHere: worldFolksHere(A).length });
    items.push({ fy: walker.py, me: true, draw: () => me.draw(ctx) });
    items.sort((a, b) => a.fy - b.fy);
    for (const it of items) it.draw();
    const ghost = items.find((it) => it.me);
    if (ghost) { ctx.globalAlpha = 0.24; ghost.draw(); ctx.globalAlpha = 1; }
    drawFront(ctx);
    lights(ctx);
    // sedlar och möbler som flyger till mig, +400 KR
    for (const f of flyers) {
      if (f.t < 0) continue;
      const k = Math.min(1, f.t / 0.45), tx = walker.px, ty = walker.py - 24;
      const x = f.x0 + (tx - f.x0) * k, y = f.y0 + (ty - f.y0) * k - Math.sin(k * Math.PI) * 18;
      if (f.kind === 'bill') { ctx.fillStyle = '#17151a'; ctx.fillRect(Math.round(x) - 4, Math.round(y) - 2, 8, 4); ctx.fillStyle = '#8ad09a'; ctx.fillRect(Math.round(x) - 3, Math.round(y) - 1, 6, 2); }
      else drawItemAt(ctx, f.item, x, y, 48, 40);
    }
    for (const p of pops) {
      const s = p.s, x = Math.round(p.x - textW(BG, s) / 2), y = Math.round(p.y - p.t * 14);
      for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) ctxText(ctx, BG, s, x + ox, y + oy, '#14121a');
      ctxText(ctx, BG, s, x, y, p.t < 0.7 || Math.floor(p.t * 10) % 2 ? '#6ae08a' : '#ffffff');
    }
  }
  // moraklockans visare (den går tio minuter fel)
  function moraHands(ctx) {
    const cx = (MORA.x0 + MORA.x1) / 2, cy = MORA.base - 62 + 9, m = (g.min + 10) % 1440;
    const ha = ((m % 720) / 720) * Math.PI * 2 - Math.PI / 2, ma = ((m % 60) / 60) * Math.PI * 2 - Math.PI / 2;
    ctx.fillStyle = '#1a1612'; for (let k = 0; k <= 2; k++) ctx.fillRect(Math.round(cx + Math.cos(ha) * k), Math.round(cy + Math.sin(ha) * k), 1, 1);
    ctx.fillStyle = '#3a3a44'; for (let k = 0; k <= 4; k++) ctx.fillRect(Math.round(cx + Math.cos(ma) * k), Math.round(cy + Math.sin(ma) * k), 1, 1);
  }

  const SCENE = {
    viewMax: { w: W, h: H },
    get worldX() { return walker.px; },
    get worldY() { return walker.py; },
    enter() { ring(); pendingHello = 0.8; },
    exit() {
      talk.clear(); talkPB.clear(); talkBird.clear(); npc.talk.clear();
      if (deal?.phase === 'bud' && modalOpen()) closeModal();
    },
    _debug: {
      // platsens läge i vyn (låser kameran över den om den ligger utanför bild)
      spot: (id) => {
        const s = spotById(id);
        let x, y;
        if (id === 'pantlanare') { x = pb.x; y = PB_Y - 20; }
        else if (!s) return null;
        else { x = (s.r[0] + s.r[2]) / 2; y = (s.r[1] + s.r[3]) / 2; }
        if (x - cam.x < 6 || x - cam.x > VW - 6 || y - cam.y < 6 || y - cam.y > VH - 6) {
          lockedCam = { x: clamp(x - VW / 2, 0, W - VW), y: clamp(y - VH / 2, 0, H - VH) }; Object.assign(cam, lockedCam);
        }
        return { x: x - cam.x, y: y - cam.y };
      },
      spots: () => spots.map((s) => s.id),
      state: () => ({
        money: g.money, day: g.day, storage: g.storage.map((it) => it.k), pant: pantList(g).map((p) => ({ ...p })),
        deal: deal ? { kind: deal.kind, phase: deal.phase, amount: deal.amount } : null, pb: { x: Math.round(pb.x), mode: pb.mode, carry: !!pb.carry },
        open: isOpen(), hours: HOURS.slice(), shutter: +shutter.toFixed(2), npc: { state: npc.state }, bird: bird.state,
        pos: { x: Math.round(walker.px), y: Math.round(walker.py), path: walker.path.length }, cam: { ...cam }, slots: [...slotMap()],
      }),
      prices: (k) => ({ katalog: katalogOf(k)?.price || 0, salj: saleOf(k), lan: loanOf(k), skuld: debtOf(loanOf(k)) }),
      sell: (idx) => g.sellStorage(idx),
      pawn: (idx) => (canPawn(g) ? g.pawnStorage(idx) : { ok: false, msg: 'ingen patch' }),
      redeem: (nr) => redeem(nr),
      desk: (tab) => openDesk(tab),
      deal: (kind, idx) => startDeal(kind, idx),
      accept: () => { if (deal?.phase === 'bud') { closeModal(); return acceptDeal(); } return { ok: false }; },
      fast: (k = 1) => { fast = k; },
      // spola fram tills affären är klar (eller väntar på svar i dialogen)
      finish: (maxSec = 30) => { for (let i = 0; i < maxSec * 60 && deal && deal.phase !== 'bud'; i++) SCENE.update(1 / 60); return deal ? deal.phase : null; },
      lockCam: (x, y) => { lockedCam = x === null || x === undefined ? null : { x: clamp(x, 0, W - VW), y: clamp(y ?? cam.y, 0, H - VH) }; if (lockedCam) Object.assign(cam, lockedCam); },
      teleport: (x, y) => { walker.px = x; walker.py = y; walker.stop(); walker.snapFree(); Object.assign(cam, camTarget()); },
      walkTo: (x, y) => { walker.walkTo(x, y); return walker.path.length; },
      walkable: (x, y) => walker.walkable(x, y),
      hover: (id) => { hoverId = id || null; hoverT = t; },
      hideNpcs: () => { npc.state = 'away'; npc.t = 9999; npc.talk.clear(); },
      npcNow: () => { spawnNpc(); return npc.state; },
      npc: () => ({ state: npc.state, x: Math.round(npc.w.px), y: Math.round(npc.w.py), goal: npc.goal?.kind || null, carry: npc.carry }),
      bird: () => { birdSay(); return bird.state; },
      strum: (i) => strum(i),
      cuckoo: () => { cuckooT = t; SND.cuckoo(1); },
      pbSay: (s) => pbSay(s, true),
      panorama: (scale = 1) => {
        const c = document.createElement('canvas'); c.width = W * scale; c.height = H * scale;
        const x = c.getContext('2d'); x.imageSmoothingEnabled = false; x.setTransform(scale, 0, 0, scale, 0, 0);
        drawWorld(x, 0, 0, W, H);
        talkPB.draw(x, { x0: 0, x1: W }); talkBird.draw(x, { x0: 0, x1: W }); npc.talk.draw(x, { x0: 0, x1: W }); talk.draw(x, { x0: 0, x1: W });
        return c.toDataURL('image/png');
      },
    },

    update(dt) {
      t += dt;
      walker.update(dt);
      if (pendingHello > 0) { pendingHello -= dt; if (pendingHello <= 0) pbSay(isOpen() ? pick(PB_HELLO) : pick(PB_CLOSED), true); }
      const near = [{ x: walker.px, y: walker.py }, ...(npc.state !== 'away' ? [{ x: npc.w.px, y: npc.w.py }] : [])].some((p) => Math.abs(p.x - DOOR_X) < 16 && p.y > FRONT_Y - 14);
      door += ((near ? 1 : 0) - door) * Math.min(1, dt * 6);
      updatePB(dt);
      updateBird(dt);
      updateNpc(dt);
      updateDeal(dt);
      // man gick därifrån medan pantlånaren synade varan: han lägger tillbaka den
      if (deal && (deal.phase === 'lagg' || deal.phase === 'syna') && Math.hypot(walker.px - SERVE[0], walker.py - SERVE[1]) > 30) declineDeal();
      // stängningsdags: rullgallret ner (och upp igen när det öppnar)
      const open = isOpen();
      shutter = clamp(shutter + ((open ? 0 : 1) - shutter > 0 ? dt * 1.6 : -dt * 1.6), 0, 1);
      if (!open && !closedSaid && t > 1.2 && !deal) { closedSaid = true; pbSay($t('Vi stänger! Kom tillbaka i morgon.'), true); play('slide'); }
      if (open) closedSaid = false;
      // gökuret gal varje hel timme
      const hr = Math.floor(g.min / 60);
      if (hr !== lastHour) { lastHour = hr; cuckooT = t; SND.cuckoo(Math.min(3, (hr % 12) || 12)); }
      for (let i = 0; i < wob.length; i++) wob[i] = Math.max(0, wob[i] - dt * 0.9);
      for (let i = flyers.length - 1; i >= 0; i--) { flyers[i].t += dt; if (flyers[i].t > 0.45) flyers.splice(i, 1); }
      for (let i = pops.length - 1; i >= 0; i--) { pops[i].t += dt; if (pops[i].t > 1.3) pops.splice(i, 1); }
      updateHint();
      const tg = camTarget(), k = lockedCam ? 1 : Math.min(1, dt * 6);
      cam.x += (tg.x - cam.x) * k; cam.y += (tg.y - cam.y) * k;
    },

    down(sx, sy) {
      hoverId = null;
      if (performance.now() < clickGuard) return; // andra halvan av ett dubbelklick i dialogen
      for (const h of panelHits) if (sx >= h.r[0] && sx <= h.r[2] && sy >= h.r[1] && sy <= h.r[3]) { h.act(); return; }
      const x = sx + cam.x, y = sy + cam.y;
      // pantlånaren själv: gå fram till luckan
      if (x >= pb.x - 9 && x <= pb.x + 9 && y >= PB_Y - 40 && y <= CNT.top) { clickSpot(spotById('lucka'), x); return; }
      const s = spotAt(x, y);
      if (s) { clickSpot(s, x); return; }
      if (y > WALL_Y) walker.walkTo(x, y);
    },
    move(sx, sy) { hoverId = spotAt(sx + cam.x, sy + cam.y)?.id || null; hoverT = t; },

    draw(ctx) {
      syncView(A);
      const cx = Math.round(cam.x), cy = Math.round(cam.y);
      ctx.setTransform(A.pxs, 0, 0, A.pxs, -cx * A.pxs, -cy * A.pxs);
      drawWorld(ctx, cx, cy, VW, VH);
      const view = { x0: cx, x1: cx + VW };
      if (pbInView()) talkPB.draw(ctx, view);
      talkBird.draw(ctx, view);
      if (npc.state !== 'away') npc.talk.draw(ctx, view);
      talk.draw(ctx, view);
      ctx.setTransform(A.pxs, 0, 0, A.pxs, 0, 0);
      drawPanel(ctx);
      const focus = focusSpot();
      if (focus) bigLabel(ctx, focus, walker.py - cam.y > VH - 50);
    },
  };
  return SCENE;
}




