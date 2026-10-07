// NÄRBUTIKEN 24/7 – förortens dygnetruntbutik som man går runt i med sin egen figur.
// Inte alls fräsch som Stormarknaden: TRÅNGT och lågt i tak, surrande lysrör där ett
// blinkar oregelbundet (ljuset dippar i konservhörnan), hyllor överfulla från golv
// till tak, kartonger i gångarna som man får kliva runt, fläckig vinylmatta, flugpapper,
// en hink med mopp – och butikens katt Sultan som sover på den varma frysboxen och
// flyttar sig ibland. Utomlandskänsla: påhittade märken med blandade fantasiskrifter,
// en hel kylvägg med färgglada läskburkar, säckar med ris och kryddor, snacks i remsor,
// en hylla med konstiga konserver, telefonkort bakom disken och en gammal TV som visar
// myrornas krig. Expediten sitter bakom plexiglas med radion (nattvakt-vibb).
//
//   bakväggen:  expeditens hörna (TV, skylten ALLTID ÖPPET · LITE DYRARE, telefonkort,
//               hylla med lyckokatt, pärlridå till lagret) · säckar · vägghylla ·
//               KYLVÄGGEN med åtta glasdörrar
//   golvet:     två rader smala gondoler (en figur bred mellan dem) med luckor att kliva
//               undan i, kartongstaplar, frysboxen, vattenpallen, uttagsautomaten
//               (ur funktion), korgarna och moppen i hörnet
//   framväggen: dörren med dörrklockan och gallerfönster med neonskylten baklänges
//
// Köpflödet är Stormarknaden i miniatyr: klicka en vara med handskriven neonlapp →
// figuren går dit och lägger den i korgen → betala vid disken. Allt kostar 20 % mer
// än på Stormarknaden (avrundat uppåt till hel krona). Varorna hamnar i kylskåpet
// hemma: A.game.buyFood per vara och mellanskillnaden dras direkt.
//
// Möten i de smala gångarna: kunderna kliver undan i en lucka ("Efter dig!") eller
// trycker sig mot hyllan och drar in magen när någon klämmer sig förbi – figuren
// blockeras aldrig.
//
// SKRAPLOTTER: lotter-stället LYCKOSKRAP står på golvet framför diskens högra ände. Klicka
// → köp en lott (25 kr) → lotten läggs upp över bilden och man skrapar fram sex belopp med
// musen/fingret. Tre lika = vinst (100/500/1000 kr, liten chans). Rättvis slump med seed per
// dag – reglerna och sparfältet g.lott bor i js/scenes/skraplott.js.
import { Pix, SMALL, BIG, ctxText, textW, text, eachTextPixel, mix, mul, hash, bayer } from '../core/floor-pix.js';
import { drawPerson, makeLook } from '../core/people.js';
import { openModal, closeModal, toast, esc, modalOpen } from '../core/ui.js';
import { FOOD, foodOf, fmt } from '../game.js';
import { play, audioContext, isMuted } from '../core/sound.js';
import { createWalker, selfDrawable, folkDrawables, WALK_SEQ, createSpeech } from './walkable.js';
import { worldFolksHere } from '../net/world.js';
import { LOTT_PRIS, LOTT_PER_DAG, lottOf, lottLeft, buyLott, settleLott, createTicket, lottPrize } from './skraplott.js';
import { $t } from '../core/i18n.js';

// Närbutikens pris: Stormarknadens + 20 %, uppåt till hel krona (heltalsräkning, inga flyttalsfel)
export const narPrice = (f) => Math.ceil((f.price * 120) / 100 - 1e-9);

// ================= geometri (spelpixlar, världskoordinater) =================
const W = 608, H = 256;
let VW = 384, VH = 216; // mobilfyllning: vyn följer skärmen, klampad till butiken
const syncView = (A) => { VW = Math.max(384, Math.min(A.W || 384, W)); VH = Math.max(216, Math.min(A.H || 216, H)); };
const SIDE = 6;                 // sidoväggarnas tjocklek
const CEIL = 10;                // takplattornas underkant = bakväggens överkant
const WALL_Y = 66;              // bakväggens fot = golvets början
const FRONT_Y = 240;            // framväggens överkant
const CH = WALL_Y - CEIL;       // takhöjden i bild – lysrör och flugpapper hänger där
const DOOR = { x0: 156, x1: 184 }, DOOR_X = 170;
const CNT = { x0: 12, x1: 142, top: 100, face: 108, base: 124 }; // disken
const PLEX = { x0: 44, x1: 110, top: 74, bot: 101 };             // plexiglaset på disken
const GRILL = { x0: 113, x1: 139 };                               // varmkorvgrillen på disken
const EXP = { x: 76, y: 111 };                                    // expeditens fötter (bakom disken)
const CURT = { x0: 118, x1: 146, top: 27 };                       // pärlridån till lagret
const TV = { x0: 8, x1: 32, y0: 13, y1: 35 };
const RADIO = { x0: 14, x1: 34 };
const PAY = [80, 137];          // där man står och betalar
const QUEUE = [106, 156];       // kön om någon redan står vid disken
const SACKS = { x0: 152, x1: 238, base: 80 };
const WSHELF = { x0: 238, x1: 334, base: 74 };
const FRIDGE = { x0: 336, x1: 600, n: 8, dw: 33, top: 12 };
const GH = 44;                  // gondolernas höjd i bild (hyllplanet överst)
const ROW1 = 146, ROW2 = 212;
const GONDOLAS = [
  { cat: 'nudlar', x0: 184, x1: 320, base: ROW1 },
  { cat: 'snacks', x0: 340, x1: 462, base: ROW1 },
  { cat: 'konserv', x0: 482, x1: 602, base: ROW1 },
  { cat: 'kryddor', x0: 184, x1: 282, base: ROW2 },
  { cat: 'te', x0: 302, x1: 410, base: ROW2 },
  { cat: 'hushall', x0: 430, x1: 560, base: ROW2 },
];
const FRZ = { x0: 14, x1: 72, top: 158, lid: 168, base: 178 };   // frysboxen (glassbox)
const PALLET = { x0: 84, x1: 120, base: 206 };                   // vatten i sexpack på pall
const BOXES = [ // kartongstaplar som ingen packat upp – man får kliva runt
  { x0: 294, x1: 314, base: 90, d: 16, n: 3 },   // gång 1, framför vägghyllan
  { x0: 380, x1: 400, base: 154, d: 8, n: 2 },   // gång 2, mot snackshyllan
  { x0: 470, x1: 492, base: 222, d: 10, n: 2 },  // gång 3, mot hushållshyllan
  { x0: 560, x1: 580, base: 84, d: 12, n: 1 },   // gång 1, en öppnad låda läsk framför kylen
];
const MOP = { x: 588, base: 236 };
const ATM = { x0: 8, x1: 32, base: 228 };
const BASKETS = { x0: 186, x1: 200, base: 238 };
const CRATES = { x0: 36, x1: 80, base: 238 };        // frukt från värmen i trälådor under fönstret
const SPIN = { x0: 134, x1: 148, base: 180 };        // snurrställ med solglasögon och nyckelringar
const BREAD = { x0: 8, x1: 28, base: 156 };          // brödställ med tunnbröd i påsar
const COOLER = { x0: 142, x1: 162, base: 118 };      // en liten energidryckskyl bredvid disken
const SODA = { x0: 578, x1: 600, base: 194 };        // läskbackar staplade i hörnet
const GLASS = { x0: 84, x1: 122, top: 160, lid: 168, base: 176 }; // glassboxen bredvid frysen
const NEWS = { x0: 126, x1: 150, base: 238 };        // tidningsställ med utländska tidningar
const LOTT = { x0: 114, x1: 140, top: 99, base: 131 }; // lotter-stället LYCKOSKRAP framför diskens högra ände
const MAX_BASKET = 10;

// allt man inte kan gå igenom (hyllorna blockerar hela sin bildhöjd – då kan ingen
// hamna gömd bakom dem, och gångarna blir precis en figur breda)
const OBST = [
  [SIDE, WALL_Y - 8, 152, CNT.base],
  [SACKS.x0, WALL_Y - 8, SACKS.x1, SACKS.base],
  [WSHELF.x0, WALL_Y - 8, WSHELF.x1, WSHELF.base],
  [FRIDGE.x0, WALL_Y - 8, W, WALL_Y + 4],
  ...GONDOLAS.map((g) => [g.x0, g.base - GH, g.x1, g.base]),
  [FRZ.x0, FRZ.top - 2, FRZ.x1, FRZ.base],
  [PALLET.x0, PALLET.base - 16, PALLET.x1, PALLET.base],
  ...BOXES.map((b) => [b.x0, b.base - b.d, b.x1, b.base]),
  [MOP.x - 10, MOP.base - 9, MOP.x + 10, MOP.base + 2],
  [ATM.x0, ATM.base - 24, ATM.x1, ATM.base],
  [BASKETS.x0, BASKETS.base - 9, BASKETS.x1, BASKETS.base + 2],
  [CRATES.x0, CRATES.base - 16, CRATES.x1, CRATES.base],
  [SPIN.x0, SPIN.base - 34, SPIN.x1, SPIN.base],
  [BREAD.x0, BREAD.base - 30, BREAD.x1, BREAD.base],
  [COOLER.x0, COOLER.base - 42, COOLER.x1, COOLER.base],
  [SODA.x0, SODA.base - 20, SODA.x1, SODA.base],
  [GLASS.x0, GLASS.top - 2, GLASS.x1, GLASS.base],
  [NEWS.x0, NEWS.base - 16, NEWS.x1, NEWS.base],
  [LOTT.x0, CNT.base - 2, LOTT.x1, LOTT.base],
];

// lysrören som hänger i taket: x och golvpunkten under (armaturen ritas CH högre upp).
// De hänger över hyllorna, INTE över luckorna – annars hamnar armaturen rakt över
// huvudet/bröstet på den som kliver undan i en lucka.
const TUBES = [
  { x: 84, yf: 116 },            // över disken
  { x: 294, yf: 160 },           // gång 2, över nudelhyllans högra ände
  { x: 536, yf: 160, broken: true }, // gång 2 inne vid konserverna – det som blinkar
  { x: 318, yf: 228 },           // gång 3, över te-hyllan
  { x: 452, yf: 228 },           // gång 3, över hushållshyllan
];
const CEIL_LAMPS = [226, 520];   // infällda armaturer i takkanten över gång 1
const DARK = { cx: 532, cy: 146, rx: 92, ry: 64 }; // där ljuset dippar när röret slocknar
const FLYPAPER = [{ x: 40, yf: 124, len: 17 }, { x: 568, yf: 182, len: 15 }];

// katten Sultans platser: var den ligger (x, y = fötterna), ritordning, golvpunkten nedanför
// (dit katten hoppar ner) och var man ställer sig för att klappa den: [x, y, vänd mot].
// Vid frysen och kartongerna står man BREDVID katten och vänder sig mot den – rakt
// nedanför skulle figuren skymma katten helt.
const CAT_SPOTS = {
  frys: { x: 61, y: 166, fy: FRZ.base + 0.5, floor: [60, 188], pet: [[79, 183, 'left']] },          // frysboxens varma motorhörna
  disk: { x: 24, y: 91, fy: CNT.base + 0.5, floor: [30, 136], pet: [[30, 136, 'up']] },             // ovanpå den varma radion på disken
  sack: { x: 174, y: 48, fy: SACKS.base + 0.5, floor: [180, 90], pet: [[180, 90, 'up']] },          // uppe på rissäckarna
  kartong: { x: 390, y: 139, fy: 154.5, floor: [390, 162], pet: [[409, 158, 'left'], [371, 158, 'right']] }, // på kartongerna i gång 2
};

// kunderna tittar på hyllorna härifrån [x, y, riktning]
const BROWSE = [
  [352, 80, 'up'], [386, 80, 'up'], [418, 80, 'up'], [452, 80, 'up'], [484, 80, 'up'], [518, 80, 'up'], [552, 80, 'up'], [584, 80, 'up'],
  [180, 90, 'up'], [214, 90, 'up'], [262, 88, 'up'],
  [232, 158, 'up'], [292, 158, 'up'], [360, 160, 'up'], [430, 158, 'up'], [512, 158, 'up'], [572, 158, 'up'],
  [226, 224, 'up'], [262, 224, 'up'], [330, 224, 'up'], [384, 224, 'up'], [458, 228, 'up'], [528, 224, 'up'],
  [44, 188, 'up'],
];
// fickor att kliva undan i: [x, y, vänd mot]
const POCKETS = {
  1: [[330, 106, 'down'], [472, 106, 'down'], [172, 92, 'right']],
  2: [[330, 142, 'down'], [472, 142, 'down'], [292, 172, 'up'], [420, 172, 'up'], [578, 170, 'left'], [172, 158, 'right']],
  3: [[292, 208, 'down'], [420, 208, 'down'], [580, 216, 'left'], [172, 222, 'right']],
};
const laneOf = (x, y) => (x < 182 ? 0 : y < 102 ? 1 : y > 146 && y < 168 ? 2 : y > 212 ? 3 : 0);

// ================= färger och typsnitt =================
const OUT = 0x231c22;
const STEEL = [0x3e444c, 0x646c76, 0x8e98a2, 0xbcc4cc, 0xe6ecf0];
const METAL = [0x5e5846, 0x8e8670, 0xbab296, 0xd2caae, 0xe6e0cc]; // gulnad hyllplåt
const WOOD = [0x2e1c10, 0x4a2e1a, 0x6a4428, 0x8a5c36, 0xa8764a];
const CARD = [0x5e4024, 0x8a6438, 0xb08a58, 0xc8a474, 0xe0c498]; // kartong
const PACKS = [0xd8323a, 0xf0b429, 0x3a7bd5, 0x46a35a, 0xe07a2e, 0x8e5bd1, 0x2aa39a, 0xc84a8a, 0x2d3a8c, 0xf4f1ea, 0x7a2e3e, 0xe8d020, 0x1a8a6a, 0xff5a8a];
const LOUD = [0xff3a4a, 0xffc81a, 0x2ac0ff, 0x4ae05a, 0xff7a1a, 0xb05aff, 0x1ad8b8, 0xff4ac0, 0xf0f040, 0x3a5aff, 0xff8ab0, 0x8aff3a];
const NEONS = [0xf6f24a, 0x9cf45a, 0xffa43a, 0xff86c8, 0x8ae8ff];
const SM = {
  ...SMALL,
  '&': { rows: ['.#..', '#.#.', '.#..', '#.##', '.##.'], up: [], w: 4 },
  '·': { rows: ['.', '.', '#', '.', '.'], up: [], w: 1 },
};
const BG = {
  ...BIG,
  '&': { rows: ['.##..', '#..#.', '#.#..', '.#...', '#.#.#', '#..#.', '.##.#'], up: [], w: 5 },
  '·': { rows: ['..', '..', '..', '##', '##', '..', '..'], up: [], w: 2 },
};

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const hexs = (c) => '#' + (c & 0xffffff).toString(16).padStart(6, '0');
const pickOf = (arr, ...k) => arr[Math.floor(hash(k[0] | 0, k[1] | 0, k[2] | 0) * arr.length) % arr.length];
// fem toner ur en grundfärg: djup skugga, skugga, bas, ljus, högdager
const rampOf = (c) => [mix(mul(c, 0.4), 0x160c26, 0.3), mix(mul(c, 0.7), 0x2a1f3a, 0.1), c, mix(c, 0xfff6e8, 0.32), mix(c, 0xffffff, 0.66)];
function tone(pal, v, x, y) {
  const f = clamp(v, 0, 0.999) * (pal.length - 1);
  let i = Math.floor(f);
  if (f - i > 0.25 + bayer(x, y) * 0.5) i++;
  return pal[Math.min(pal.length - 1, i)];
}
const qd = (t, x, y, n = 4) => clamp(Math.round(t * n + bayer(x, y) - 0.5), 0, n) / n;
function vgrad(P, x, y, w, h, c0, c1, n = 4) {
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) P.px(x + i, y + j, mix(c0, c1, qd(h > 1 ? j / (h - 1) : 0, x + i, y + j, n)));
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
const put = (ctx, s) => ctx.drawImage(s.img, s.x, s.y);
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
// fantasiskrift: krokar över en baslinje, streck under en taklinje, öglor eller små
// fyrkanter – blandade skriftkänslor utan något riktigt språk
function script(P, x, y, w, c, seed, style = null, a = 1) {
  const st = style ?? Math.floor(hash(seed, 1, 77) * 4);
  let cx = x, i = 0;
  if (st === 0) P.hl(x, y + 2, w, c, a);
  if (st === 1) P.hl(x, y, w, c, a);
  while (cx < x + w - 1) {
    const r = hash(i, seed, 78);
    if (st === 0) {
      if (r < 0.35) { P.px(cx, y + 1, c, a); P.px(cx, y, c, a); } else if (r < 0.55) P.px(cx, y + 3, c, a); else if (r < 0.72) P.px(cx + 1, y - 1, c, a);
      cx += 2;
    } else if (st === 1) {
      P.vl(cx, y, 2 + (r > 0.6 ? 1 : 0), c, a); if (r < 0.4) P.px(cx + 1, y + 2, c, a);
      cx += r < 0.3 ? 2 : 3;
    } else if (st === 2) {
      P.px(cx, y + 1, c, a); P.px(cx + 1, y, c, a); P.px(cx + 1, y + 2, c, a); if (r < 0.5) P.px(cx + 2, y + 1, c, a);
      cx += 3 + (r > 0.8 ? 1 : 0);
    } else {
      P.px(cx, y, c, a); P.px(cx + 1, y, c, a); P.px(cx, y + 1 + (r > 0.5 ? 1 : 0), c, a); if (r > 0.3) P.px(cx + 1, y + 2, c, a);
      cx += 3;
    }
    i++;
  }
}
// en pytteliten "logga" på en förpackning: prick, stjärna, våg eller cirkel
function logo(P, x, y, c, k) {
  switch (k % 5) {
    case 0: P.px(x, y, c); P.px(x + 1, y, c); P.px(x, y + 1, c); P.px(x + 1, y + 1, c); break;
    case 1: P.px(x + 1, y, c); P.px(x, y + 1, c); P.px(x + 2, y + 1, c); P.px(x + 1, y + 2, c); break;
    case 2: P.px(x, y + 1, c); P.px(x + 1, y, c); P.px(x + 2, y + 1, c); P.px(x + 3, y, c); break;
    case 3: P.px(x + 1, y, c); P.px(x, y + 1, c); P.px(x + 2, y + 1, c); break;
    default: P.px(x, y, c); P.px(x + 2, y, c); P.px(x + 1, y + 1, c);
  }
}

// ================= varor =================
// Varje sort ritar EN förpackning som står på hyllplanet b (varan slutar på b − 1).
const PR = {
  can: { w: 4, h: 6, draw(P, x, b, c, i) {
    const r = rampOf(c);
    P.hl(x, b - 6, 4, STEEL[3]); P.px(x, b - 6, STEEL[4]); P.px(x + 3, b - 6, STEEL[1]);
    for (let y = b - 5; y < b - 1; y++) { P.px(x, y, r[3]); P.px(x + 1, y, r[2]); P.px(x + 2, y, r[2]); P.px(x + 3, y, r[1]); }
    if (i % 3 === 0) { P.px(x + 1, b - 4, 0xf4f1ea); P.px(x + 2, b - 4, 0xf4f1ea); }
    else if (i % 3 === 1) P.hl(x, b - 3, 4, mix(c, 0xffffff, 0.55));
    else { P.px(x + 1, b - 4, 0xf8e040); P.px(x + 2, b - 3, 0x1a1a22); }
    P.hl(x, b - 1, 4, STEEL[1]); P.px(x, b - 1, STEEL[2]);
  } },
  tin: { w: 6, h: 6, draw(P, x, b, c, i) { // platta fiskburkar, två på varandra
    const r = rampOf(c);
    for (const y0 of [b - 6, b - 3]) {
      P.hl(x, y0, 5, STEEL[3]); P.px(x, y0, STEEL[4]); P.px(x + 4, y0, STEEL[1]);
      P.hl(x, y0 + 1, 5, r[2]); P.px(x, y0 + 1, r[3]); P.px(x + 4, y0 + 1, r[1]);
      P.px(x + 1 + (i & 1), y0 + 1, 0xd8e4ec); P.px(x + 2 + (i & 1), y0 + 1, 0x8aa4b8); // en fisk på etiketten
      P.hl(x, y0 + 2, 5, r[1]); P.px(x + 4, y0 + 2, r[0]);
    }
  } },
  jar: { w: 5, h: 7, draw(P, x, b, c, i) { // inläggningar: glas med saker som flyter
    const lid = [0xe8c050, 0xd8323a, 0x2a8a4a][i % 3];
    P.hl(x, b - 7, 4, lid); P.px(x, b - 7, mix(lid, 0xffffff, 0.5)); P.hl(x, b - 6, 4, mul(lid, 0.6));
    const r = rampOf(c);
    for (let y = b - 5; y < b; y++) for (let k = 0; k < 4; k++) P.px(x + k, y, k === 0 ? r[3] : k === 3 ? r[1] : r[2]);
    P.px(x + 1 + (i % 2), b - 4, mix(c, 0xffffff, 0.55)); P.px(x + 2, b - 2, mul(c, 0.5)); P.px(x + 1, b - 3, mix(c, 0xfff0a0, 0.5));
    P.hl(x, b - 3, 4, 0xf4ecd8, 0.8); P.px(x + 3, b - 3, 0xc8bca0);
    P.vl(x, b - 5, 2, 0xffffff, 0.7); P.hl(x, b - 1, 4, r[0]);
  } },
  cup: { w: 5, h: 6, draw(P, x, b, c, i) { // snabbnudlar i kopp
    const r = rampOf(c);
    P.hl(x, b - 6, 5, 0xf4f1ea); P.px(x, b - 6, 0xffffff); P.px(x + 4, b - 6, 0xc8c4bc);
    P.hl(x, b - 5, 5, r[2]); P.px(x + 4, b - 5, r[1]);
    P.hl(x, b - 4, 5, 0xf4f1ea); P.px(x + 1, b - 4, r[2]); P.px(x + 3, b - 4, 0x1a1a22); P.px(x + 4, b - 4, 0xc8c4bc);
    P.hl(x + 1, b - 3, 3, 0xf8e8c8); P.px(x + 2, b - 3, (i & 1) ? 0xf0b429 : 0x46a35a); P.px(x, b - 3, 0xe8e4dc);
    P.hl(x + 1, b - 2, 3, r[2]); P.px(x + 1, b - 1, r[1]); P.px(x + 2, b - 1, r[1]); P.px(x + 3, b - 1, r[0]);
  } },
  npack: { w: 7, h: 5, draw(P, x, b, c, i) { // nudelpaket, platta och skrikiga
    const r = rampOf(c);
    for (let y = b - 5; y < b; y++) for (let k = 0; k < 7; k++) P.px(x + k, y, y === b - 5 ? r[3] : y === b - 1 ? r[1] : r[2]);
    P.px(x + 2, b - 3, 0xf4f1ea); P.px(x + 3, b - 3, 0xf8d880); P.px(x + 4, b - 3, 0xf4f1ea); P.hl(x + 2, b - 2, 3, 0xffffff); // en skål
    P.px(x + 3, b - 4, 0xf0f0f0, 0.7);
    P.px(x + 5, b - 4, i % 2 ? 0xffe040 : 0x1a1a22); P.px(x, b - 5, r[4]);
  } },
  chips: { w: 6, h: 7, draw(P, x, b, c, i) { // uppblåst påse med räfflad topp
    const r = rampOf(c);
    for (let y = b - 7; y < b; y++) for (let k = 0; k < 6; k++) {
      if ((y === b - 1) && (k === 0 || k === 5)) continue;
      if (y === b - 7) { P.px(x + k, y, k % 2 ? r[4] : r[3]); continue; }
      P.px(x + k, y, k === 0 ? r[3] : k === 5 ? r[1] : r[2]);
    }
    P.hl(x + 1, b - 6, 4, r[1]);
    P.px(x + 2, b - 4, 0xf8d060); P.px(x + 3, b - 4, 0xe8a030); P.px(x + 2, b - 3, 0xe8a030); // chips på bilden
    logo(P, x + 1, b - 2, mix(c, 0xffffff, 0.7), i);
    P.px(x + 1, b - 5, 0xffffff, 0.6);
  } },
  cbox: { w: 6, h: 7, draw(P, x, b, c, i) { // kakor/te i kartong med fantasiskrift
    const r = rampOf(c);
    for (let y = b - 7; y < b; y++) for (let k = 0; k < 6; k++) P.px(x + k, y, k === 0 ? r[3] : k === 5 ? r[1] : r[2]);
    P.hl(x, b - 7, 6, r[4]);
    P.hl(x + 1, b - 5, 4, 0xf4f1ea); script(P, x + 1, b - 5, 4, mul(c, 0.5), i * 7 + 3, i % 4);
    P.rect(x + 1, b - 3, 2, 2, (i & 1) ? 0xf8d060 : 0xc86a3a); P.px(x + 4, b - 3, mix(c, 0xffffff, 0.6));
    P.hl(x, b - 1, 6, r[0]);
  } },
  bottle: { w: 3, h: 7, draw(P, x, b, c, i) { // sås/olja med lång hals
    const r = rampOf(c);
    P.px(x + 1, b - 7, [0xd8323a, 0xf4f1ea, 0x2a2a30][i % 3]); P.px(x + 1, b - 6, r[3]);
    for (let y = b - 5; y < b; y++) { P.px(x, y, r[3]); P.px(x + 1, y, r[2]); P.px(x + 2, y, r[1]); }
    P.hl(x, b - 3, 3, 0xf4f1ea); P.px(x + 1, b - 3, mul(c, 0.6));
    P.px(x, b - 5, 0xffffff, 0.6);
  } },
  oil: { w: 7, h: 7, draw(P, x, b, c, i) { // stor plåtdunk med handtag
    const r = rampOf(c);
    P.hl(x + 2, b - 7, 3, STEEL[2]); P.px(x + 1, b - 6, STEEL[3]); P.px(x + 5, b - 6, STEEL[1]);
    for (let y = b - 6; y < b; y++) for (let k = 0; k < 7; k++) P.px(x + k, y, y === b - 6 ? r[3] : k === 0 ? r[3] : k === 6 ? r[1] : r[2]);
    P.rect(x + 1, b - 4, 5, 2, 0xf4ecd0); P.px(x + 2, b - 4, 0x4a8a2a); P.px(x + 3, b - 3, 0x6ab03a); P.px(x + 4, b - 4, 0x2a6a1a); // olivkvist
    P.hl(x, b - 1, 7, r[0]);
  } },
  rice: { w: 6, h: 7, draw(P, x, b, c, i) { // rispåse
    for (let y = b - 7; y < b; y++) for (let k = 0; k < 6; k++) {
      if (y === b - 7 && (k === 0 || k === 5)) continue;
      P.px(x + k, y, k === 0 ? 0xffffff : k === 5 ? 0xc8c4b8 : 0xf0ece0);
    }
    P.hl(x, b - 5, 6, c); P.hl(x, b - 4, 6, mul(c, 0.8));
    script(P, x + 1, b - 3, 4, mul(c, 0.7), i * 5 + 1, 1);
    P.px(x + 4, b - 2, 0xe8d8a0); P.hl(x + 1, b - 1, 4, 0xa8a498);
  } },
  spice: { w: 4, h: 5, draw(P, x, b, c, i) { // liten kryddpåse
    const r = rampOf(c);
    P.hl(x, b - 5, 4, 0xe8e4dc); P.px(x + 1, b - 5, 0xd8323a);
    for (let y = b - 4; y < b; y++) { P.px(x, y, r[3]); P.px(x + 1, y, r[2]); P.px(x + 2, y, r[2]); P.px(x + 3, y, r[1]); }
    P.px(x + 1, b - 3, 0xf4f1ea); P.px(x + 2, b - 2, mul(c, 0.55));
  } },
  tp: { w: 8, h: 7, draw(P, x, b, c) { // toapapper i plastbal
    for (let k = 0; k < 2; k++) for (let j = 0; j < 2; j++) {
      const rx = x + k * 4, ry = b - 7 + j * 3;
      P.rect(rx, ry, 4, 3, 0xf4f4f0); P.px(rx + 3, ry + 1, 0xd0d0cc); P.px(rx + 1, ry + 1, 0xe0e0dc); P.px(rx + 2, ry, 0xffffff);
    }
    P.hl(x, b - 1, 8, c); P.px(x + 3, b - 1, 0xffffff); P.hl(x, b - 4, 8, 0xd8e8f8, 0.5);
  } },
  deterg: { w: 5, h: 7, draw(P, x, b, c, i) { // flaska med handtag
    const r = rampOf(c);
    P.hl(x + 1, b - 7, 2, 0xf4f1ea); P.px(x + 3, b - 6, r[3]); P.px(x + 4, b - 5, r[2]);
    for (let y = b - 6; y < b; y++) for (let k = 0; k < 4; k++) P.px(x + k, y, k === 0 ? r[3] : k === 3 ? r[1] : r[2]);
    P.rect(x + 1, b - 4, 2, 2, 0xf4f1ea); P.px(x + 1, b - 4, (i & 1) ? 0x3a7bd5 : 0xd8323a);
    P.hl(x, b - 1, 4, r[0]);
  } },
  batt: { w: 4, h: 5, draw(P, x, b, c) { // batterier i blister
    P.rect(x, b - 5, 4, 5, 0xe8ecf0); P.px(x, b - 5, 0xffffff);
    P.vl(x + 1, b - 4, 3, c); P.vl(x + 2, b - 4, 3, 0x2a2a30); P.px(x + 1, b - 4, 0xf8e040); P.px(x + 2, b - 4, 0xc0c0c0);
  } },
  candle: { w: 6, h: 5, draw(P, x, b) { // värmeljus i påse
    P.rect(x, b - 5, 6, 5, 0xe8e4f0); P.hl(x, b - 5, 6, 0xffffff);
    for (let k = 0; k < 3; k++) { P.px(x + 1 + k * 2, b - 3, 0xc0c4cc); P.px(x + 1 + k * 2, b - 2, 0xf8f8f0); }
    P.px(x + 2, b - 4, 0xd8323a);
  } },
  tea: { w: 6, h: 6, draw(P, x, b, c, i) {
    const r = rampOf(c);
    for (let y = b - 6; y < b; y++) for (let k = 0; k < 6; k++) P.px(x + k, y, k === 0 ? r[3] : k === 5 ? r[1] : r[2]);
    P.hl(x, b - 6, 6, r[4]); P.rect(x + 1, b - 4, 2, 2, 0x4a8a2a); P.px(x + 2, b - 4, 0x8ad05a); // teblad
    script(P, x + 3, b - 5, 2, 0xf8e8a0, i * 3, 1);
    P.hl(x + 1, b - 2, 4, mix(c, 0xf8e8a0, 0.6)); P.hl(x, b - 1, 6, r[0]);
  } },
  coffee: { w: 5, h: 7, draw(P, x, b, c, i) {
    const r = rampOf(c);
    P.hl(x, b - 7, 5, 0xc8a050); P.px(x, b - 7, 0xf0d080);
    for (let y = b - 6; y < b; y++) for (let k = 0; k < 5; k++) P.px(x + k, y, k === 0 ? r[3] : k === 4 ? r[1] : r[2]);
    P.px(x + 1, b - 4, 0x6a3a1a); P.px(x + 2, b - 4, 0x8a5a2a); P.px(x + 2, b - 3, 0x6a3a1a); // bönor
    script(P, x + 1, b - 6, 3, 0xf8e8c0, i * 11, 2, 0.8);
    P.hl(x, b - 1, 5, r[0]);
  } },
  dates: { w: 7, h: 4, draw(P, x, b, c) { // dadlar i platt ask med plastlock
    P.rect(x, b - 4, 7, 4, 0xe8d8a8); P.hl(x, b - 4, 7, 0xfff0c8);
    for (let k = 0; k < 3; k++) { P.px(x + 1 + k * 2, b - 3, 0x5a2a14); P.px(x + 2 + k * 2, b - 3, 0x7a3a1a); P.px(x + 1 + k * 2, b - 2, 0x3a1a0a); }
    P.px(x + 6, b - 2, c); P.hl(x, b - 4, 7, 0xffffff, 0.35);
  } },
  weird: { w: 4, h: 6, draw(P, x, b, c, i) { // konstiga konserver: öga, bläckfisk, fiskhuvud, självlysande, ledsen
    const k = i % 5, base = [0xc8c070, 0x8a4ab0, 0x5a8aa8, 0x6aff4a, 0xd8a0a0][k];
    const r = rampOf(base);
    P.hl(x, b - 6, 4, STEEL[3]); P.px(x + 3, b - 6, STEEL[1]);
    for (let y = b - 5; y < b - 1; y++) { P.px(x, y, r[3]); P.px(x + 1, y, r[2]); P.px(x + 2, y, r[2]); P.px(x + 3, y, r[1]); }
    if (k === 0) { P.px(x + 1, b - 4, 0xffffff); P.px(x + 2, b - 4, 0xffffff); P.px(x + 2, b - 4, 0x1a1a22); P.px(x + 1, b - 3, 0xe8e8e0); }
    else if (k === 1) { P.px(x, b - 2, 0xc070e0); P.px(x + 2, b - 2, 0xc070e0); P.px(x + 1, b - 4, 0xffffff); P.px(x + 3, b - 3, 0xc070e0); }
    else if (k === 2) { P.hl(x, b - 7, 3, 0x9ab8c8); P.px(x, b - 7, 0x1a1a22); P.px(x + 3, b - 7, 0x6a8aa0); } // ett fiskhuvud sticker upp!
    else if (k === 3) { P.px(x + 1, b - 4, 0xeaffa0); P.px(x + 2, b - 3, 0xeaffa0); P.px(x + 3, b - 5, 0xb0ff80); }
    else { P.px(x + 1, b - 4, 0x1a1a22); P.px(x + 2, b - 4, 0x1a1a22); P.px(x + 1, b - 2, 0x1a1a22); P.px(x + 2, b - 3, 0x1a1a22); }
    P.hl(x, b - 1, 4, STEEL[1]);
  } },
};
// fyll ett hyllplan överfullt: grupper om 2–5 likadana, utan glipor, och ovanpå dem
// ligger det ännu fler saker ner (så långt det går upp mot nästa hyllplan)
function stockShelf(P, x0, x1, b, kinds, seed, room = 7) {
  let x = x0, i = 0;
  while (x < x1 - 2) {
    const kind = kinds[Math.floor(hash(i, seed, 3) * kinds.length)];
    const pr = PR[kind];
    const c = (kind === 'can' || kind === 'chips' ? LOUD : PACKS)[Math.floor(hash(i, seed, 5) * (kind === 'can' || kind === 'chips' ? LOUD : PACKS).length)];
    const n = 2 + Math.floor(hash(i, seed, 7) * 4);
    const start = x;
    for (let k = 0; k < n && x + pr.w <= x1; k++) { pr.draw(P, x, b, c, i + k * (kind === 'weird' ? 1 : 0) + (kind === 'weird' ? i : 0)); x += pr.w; }
    if (x === start) { x++; i++; continue; }
    // liggande varor ovanpå där det finns plats kvar
    const gap = room - pr.h;
    if (gap >= 2 && hash(i, seed, 13) > 0.35) {
      const lw = Math.min(x - start, 4 + Math.floor(hash(i, seed, 14) * 6)), lc = PACKS[Math.floor(hash(i, seed, 15) * PACKS.length)];
      const lr = rampOf(lc), ly = b - pr.h - 2;
      P.hl(start, ly, lw, lr[3]); P.hl(start, ly + 1, lw, lr[1]); P.px(start + (lw >> 1), ly, 0xf4f1ea);
    }
    i++;
  }
}
// handskriven prislapp på hyllkanten: neonpapper, snett, ibland hängande i ett hörn
function shelfTag(P, x, y, seed) {
  const col = hash(seed, 6, 31) < 0.5 ? 0xf4f0e2 : NEONS[Math.floor(hash(seed, 3, 31) * NEONS.length)], droop = hash(seed, 4, 31) > 0.78;
  const S = skew(P, x, droop ? 2 : 4, hash(seed, 5, 31) > 0.5 ? 1 : -1);
  S.rect(x, y, 6, 4, col); S.hl(x, y, 6, mix(col, 0xffffff, 0.4));
  S.px(x + 1, y + 1, 0x1a1a3a); S.px(x + 2, y + 2, 0x1a1a3a); S.px(x + 3, y + 1, 0xc0202a); S.px(x + 4, y + 2, 0xc0202a);
  S.hl(x, y + 3, 6, mul(col, 0.75));
}

// ================= matens små ikoner (korgen, kvittot, disken) =================
const ICONS = {
  nudlar: { pal: { k: OUT, s: 0xe6ecf0, S: 0xffffff, r: 0xd8323a, R: 0x8a1a22, w: 0xf2eee6, W: 0xc8c4bc, y: 0xf0b429 }, map: [
    '.kkkkkkk.', 'kSsssssWk', '.krrrrrk.', '.kwwwwWk.', '.kwyrywk.', '.kwwwwWk.', '..kwwWk..', '..kkkkk..'] },
  macka: { pal: { k: OUT, b: 0xe0a858, B: 0xf8d898, d: 0xa86a2a, g: 0x5ab83a, G: 0x9ae060, y: 0xf8d040, Y: 0xfff0a0, r: 0xd84a3a }, map: [
    '..kkkkk..', '.kbBBBbk.', 'kbBBbbbdk', 'kGgGgrgGk', 'kyYyyyyyk', 'kbbbbbbdk', '.kddddk..', '..kkkk...'] },
  korv: { pal: { k: OUT, b: 0xe0a858, B: 0xf8d898, d: 0xa86a2a, r: 0xb84a2a, R: 0xe07a4a, y: 0xf8d020 }, map: [
    '.........', '.kkkkkkk.', 'kbBBBBBbk', 'kRyrryrRk', 'krrrrrrrk', 'kbbbbbbdk', '.kddddddk', '..kkkkkk.'] },
  pizza: { pal: { k: OUT, c: 0xc8883a, C: 0xe8b060, y: 0xf8d040, Y: 0xfff0a0, r: 0xc82a2a, g: 0x4a9a2a }, map: [
    'kkkkkkkkk', 'kCCCCCCck', '.kYyryYk.', '.kyyyrgk.', '..kyryk..', '..kyyk...', '...kyk...', '....k....'] },
  lyx: { pal: { k: OUT, w: 0xf4f1ea, W: 0xd8d4c8, o: 0xf08a50, O: 0xffb88a, g: 0x4a9a2a, G: 0x7ac050, y: 0xf8d040, Y: 0xfff0a0, K: 0x3a3440 }, map: [
    'kkkkkkkkk', 'kwWwKOooK', 'kwwWKoOok', 'kKKKKKKKk', 'kgGgKyYyk', 'kGggKyyYk', 'kkkkkkkkk', '.........'] },
};
function iconFor(id) {
  if (ICONS[id]) return ICONS[id];
  // okänd rätt (ny i FOOD): en färgad förpackning med vit etikett
  const c = PACKS[Math.floor(hash(id.length, id.charCodeAt(0), 5) * PACKS.length)];
  const r = rampOf(c);
  return { pal: { k: OUT, a: r[3], b: r[2], c: r[1], w: 0xf4f1ea }, map: ['.kkkkkkk.', 'kaaaaaabk', 'kabbbbbck', 'kawwwwwck', 'kabbbbbck', 'kabbbbbck', 'kcccccccck', '.kkkkkkk.'] };
}
function drawIcon(ctx, id, x, y) {
  const ic = iconFor(id);
  ic.map.forEach((row, j) => { for (let i = 0; i < row.length; i++) { const ch = row[i]; if (ch === '.' || !(ch in ic.pal)) continue; ctx.fillStyle = hexs(ic.pal[ch]); ctx.fillRect(x + i, y + j, 1, 1); } });
}
const SHORT = { nudlar: $t('NUDLAR'), macka: $t('OSTMACKA'), korv: $t('KORV'), pizza: $t('PIZZA'), lyx: $t('LYXLÅDA') };
const shortName = (f) => SHORT[f.id] || f.name.toUpperCase().replace(/[^A-ZÅÄÖÉÁÀÂÃÇĆÈÊËÍÌÎÏÑŃÓÒÔÕŚŹŻÚÙÛÜŸÝĄĘŁŒÆ¡¿€$0-9 ]/g, '').slice(0, 10).trim();
const priceLbl = (n) => $t`${n}:-`;

// ================= var maten står =================
// Fasta platser för rätterna i FOOD; nya rätter (utan egen plats) får en reservplats.
const FIXED = {
  nudlar: { kind: 'gondola', g: 0, dx: 46, w: 34 },
  macka: { kind: 'fridge', door: 0 },
  lyx: { kind: 'fridge', door: 6 },
  korv: { kind: 'grill' },
  pizza: { kind: 'freezer' },
};
const SPARE = [
  { kind: 'gondola', g: 4, dx: 40, w: 30 }, { kind: 'gondola', g: 5, dx: 50, w: 30 }, { kind: 'fridge', door: 2 },
  { kind: 'fridge', door: 5 }, { kind: 'gondola', g: 1, dx: 46, w: 30 }, { kind: 'gondola', g: 3, dx: 28, w: 28 },
];
const TAGCOL = { nudlar: 0xf6f24a, macka: 0x9cf45a, korv: 0xffa43a, pizza: 0xff86c8, lyx: 0x8ae8ff };
function layoutFood() {
  const spare = [...SPARE], out = [];
  FOOD.forEach((f, idx) => {
    const d = FIXED[f.id] || spare.shift();
    if (!d) return;
    const s = { f, d, idx };
    if (d.kind === 'gondola') {
      const G = GONDOLAS[d.g], x = G.x0 + d.dx;
      s.tag = [x + d.w / 2, G.base - 46];
      s.r = [x - 2, G.base - 46, x + d.w + 2, G.base]; // från lappens överkant – golvet ovanför hör till gången bakom
      s.glow = [x - 1, G.base - 27, d.w + 2, 24];
      s.go = [x + d.w / 2, G.base + 12];
    } else if (d.kind === 'fridge') {
      const x = FRIDGE.x0 + d.door * FRIDGE.dw;
      s.tag = [x + FRIDGE.dw / 2, FRIDGE.top + 11];
      s.r = [x, FRIDGE.top, x + FRIDGE.dw, WALL_Y + 4];
      s.glow = [x + 3, FRIDGE.top + 30, FRIDGE.dw - 6, 22];
      s.go = [x + FRIDGE.dw / 2, 82];
    } else if (d.kind === 'grill') {
      s.tag = [(GRILL.x0 + GRILL.x1) / 2, 70];
      s.r = [GRILL.x0 - 2, 68, GRILL.x1 + 3, CNT.base];
      s.glow = [GRILL.x0 + 1, 92, GRILL.x1 - GRILL.x0 - 2, 9];
      s.go = [126, 137];
    } else if (d.kind === 'freezer') {
      s.tag = [46, 137];
      s.r = [FRZ.x0, 134, FRZ.x1, FRZ.base];
      s.glow = [FRZ.x0 + 3, FRZ.top + 2, 40, 8];
      s.go = [38, 189];
    }
    out.push(s);
  });
  return out;
}
// handskriven neonlapp med namn och pris (tjock röd tuschpenna), sitter snett
function paintTag(f, i) {
  const name = shortName(f), pr = priceLbl(narPrice(f));
  const nw = handW(SM, name, i), pw = textW(BG, pr) + 1;
  const w = Math.max(nw, pw) + 8, h = 20, k = 9;
  const drop = Math.ceil(w / k);
  const P = new Pix(w + 4, h + drop + 5);
  const col = TAGCOL[f.id] ?? NEONS[i % NEONS.length];
  const S = skew(P, 2, k, 1);
  S.rect(2, 2, w, h, col);
  S.hl(2, 2, w, mix(col, 0xffffff, 0.45)); S.hl(2, h + 1, w, mul(col, 0.74)); S.vl(w + 1, 3, h - 1, mul(col, 0.84));
  for (let y = 3; y < h + 1; y++) for (let x = 3; x < w + 1; x++) if (hash(x, y, 90 + i) > 0.94) S.px(x, y, mul(col, 0.9));
  hand(S, SM, name, 2 + Math.round((w - nw) / 2), 4, 0x1a1a3a, i);
  const px0 = 2 + Math.round((w - pw) / 2);
  text(S, BG, pr, px0 + 1, 12, 0x6a0a0a);
  text(S, BG, pr, px0, 11, 0xd8202a);
  text(S, BG, pr, px0 + 1, 11, 0xd8202a);
  S.hl(px0, 19, pw, 0xd8202a, 0.9); // understruket
  outline(P, OUT, 0.55);
  // tejpbit överst (genomskinlig, efter konturen)
  S.rect(2 + (w >> 1) - 4, 0, 8, 4, 0xf8f8f0, 0.6);
  return { img: P.flush(), w: w + 4, h: h + drop + 5 };
}

// ================= bakgrunden =================
function vnoise(x, y, s, seed) {
  const fx = x / s, fy = y / s, ix = Math.floor(fx), iy = Math.floor(fy);
  let tx = fx - ix, ty = fy - iy;
  tx = tx * tx * (3 - 2 * tx); ty = ty * ty * (3 - 2 * ty);
  const a = hash(ix, iy, seed), b = hash(ix + 1, iy, seed), c = hash(ix, iy + 1, seed), d = hash(ix + 1, iy + 1, seed);
  return a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty;
}
// gångstråken där folk nött golvet: [x0, y0, x1, y1, halva bredden]
const WEAR = [
  [170, 236, 80, 140, 13], [176, 236, 176, 90, 11], [176, 158, 590, 158, 8], [176, 226, 590, 226, 9],
  [176, 88, 594, 84, 10], [100, 140, 40, 188, 9],
];
function wearAt(x, y) {
  let best = 0;
  for (const [x0, y0, x1, y1, hw] of WEAR) {
    const dx = x1 - x0, dy = y1 - y0, L = dx * dx + dy * dy || 1;
    const t = clamp(((x - x0) * dx + (y - y0) * dy) / L, 0, 1);
    const d = Math.hypot(x - (x0 + dx * t), y - (y0 + dy * t));
    best = Math.max(best, 1 - d / hw);
  }
  return clamp(best + (vnoise(x, y, 5, 21) - 0.5) * 0.5, 0, 1);
}
function paintFloor(P) {
  // sliten vinylplatta (VCT): två nästan lika gråbeige toner med prickar i, nött grå i
  // gångstråken, fläckig, någon platta utbytt i fel färg och några kantstötta hörn
  for (let y = WALL_Y - 4; y < FRONT_Y; y++) for (let x = SIDE; x < W - SIDE; x++) {
    const col = x >> 3, row = (y + 6) >> 3, tx = x & 7, ty = (y + 6) & 7;
    const odd = (col + row) & 1;
    let c = odd ? 0xa49c84 : 0xb8b096;
    const hv = hash(col, row, 11);
    if (hv > 0.982) c = odd ? 0x7e8a94 : 0xb49a6e;        // en utbytt platta i fel färg
    c = mul(c, 0.95 + hash(col, row, 12) * 0.07);
    const w = wearAt(x, y);
    c = mix(c, 0x7e7866, w * 0.5);                          // gångstråken är grå av smuts
    const n = vnoise(x, y, 9, 13);
    c = mix(c, 0x5e5440, Math.max(0, n - 0.55) * 0.75);     // fläckig
    const s = hash(x, y, 14);
    if (s > 0.9) c = mix(c, odd ? 0x6a6252 : 0x857c66, 0.55);      // vinylens prickar
    else if (s > 0.87) c = mix(c, 0xe8e0c8, 0.35);
    if (tx === 0 || ty === 0) c = mix(c, 0x4a4436, 0.2);   // fogarna, igensmutsade
    if (hash(col, row, 15) > 0.93 && tx >= 1 && ty >= 1 && tx + ty <= 3) c = 0x5a5244; // kantstött hörn
    P.px(x, y, c);
  }
  // fläckar: kaffe, läsk, något man inte vill veta
  const STAINS = [
    [118, 152, 5, 3, 0x6a4a2a, 'ring'], [412, 92, 8, 3, 0x8a2a3a, 'blob'], [252, 230, 5, 2, 0x3a3228, 'blob'],
    [548, 164, 9, 3, 0x2a2a30, 'blob'], [176, 212, 9, 3, 0x4a3e30, 'blob'], [60, 204, 6, 3, 0x5a4a2a, 'ring'],
    [342, 164, 4, 2, 0x7a6a2a, 'blob'], [506, 232, 7, 2, 0x3a3a2a, 'blob'], [222, 90, 4, 2, 0xa8402a, 'blob'], [470, 84, 5, 2, 0x2a6a8a, 'ring'],
  ];
  for (const [x, y, rx, ry, c, kind] of STAINS) {
    if (kind === 'ring') {
      for (let a = 0; a < 40; a++) { const t = a / 40 * Math.PI * 2; if (hash(a, x, 5) > 0.2) P.px(Math.round(x + Math.cos(t) * rx), Math.round(y + Math.sin(t) * ry), c, 0.45); }
    } else P.ell(x, y, rx, ry, c, 0.42, 3);
  }
  // svarta skosulemärken
  for (let k = 0; k < 26; k++) {
    const x = 160 + Math.floor(hash(k, 1, 61) * 430), y = WALL_Y + 14 + Math.floor(hash(k, 2, 61) * 160);
    if (!freeFloor(x, y)) continue;
    const len = 2 + Math.floor(hash(k, 3, 61) * 5), dy = hash(k, 4, 61) > 0.5 ? 1 : 0;
    P.line(x, y, x + len, y + dy, 0x1e1a18, 0.32);
  }
  // silvertejp över en spricka
  for (const [x, y] of [[232, 234], [444, 80], [132, 170]]) {
    P.rect(x, y, 9, 3, 0xa8acb0); P.hl(x, y, 9, 0xd0d4d8); P.hl(x, y + 2, 9, 0x7a7e84);
    for (let i = 0; i < 9; i += 2) P.px(x + i, y + 1, 0x9a9ea4);
    P.line(x - 5, y + 1, x - 1, y + 2, 0x3a3228, 0.6); P.line(x + 10, y + 1, x + 14, y, 0x3a3228, 0.6);
  }
  // smutsränder längs väggarna
  for (let x = SIDE; x < W - SIDE; x++) for (let k = 0; k < 4; k++) P.px(x, WALL_Y + k, 0x1a1410, 0.28 - k * 0.06);
  for (let y = WALL_Y; y < FRONT_Y; y++) for (let k = 0; k < 3; k++) { P.px(SIDE + k, y, 0x1a1410, 0.24 - k * 0.07); P.px(W - SIDE - 1 - k, y, 0x1a1410, 0.24 - k * 0.07); }
  for (let x = SIDE; x < W - SIDE; x++) for (let k = 0; k < 3; k++) P.px(x, FRONT_Y - 1 - k, 0x1a1410, 0.22 - k * 0.06);
  // blöta moppränder vid hinken
  for (let a = 0; a < 3; a++) for (let i = 0; i < 26; i++) {
    const x = 552 + i, y = 222 + a * 4 + Math.round(Math.sin(i * 0.4 + a) * 1.5);
    P.px(x, y, 0x4a5058, 0.25); if (i % 5 === 0) P.px(x, y - 1, 0xffffff, 0.25);
  }
  // dörrmattan
  const mx0 = DOOR.x0 - 2, mx1 = DOOR.x1 + 2, my0 = 227, my1 = FRONT_Y;
  for (let y = my0; y < my1; y++) for (let x = mx0; x < mx1; x++) {
    const edge = x === mx0 || x === mx1 - 1 || y === my0;
    let c = edge ? 0x2a2622 : ((x + y) & 1 ? 0x4a3e34 : 0x3e342c);
    if (!edge && (x - mx0 === 2 || mx1 - 1 - x === 2 || y - my0 === 2)) c = 0x8a3a2a;
    if (!edge && ((x - mx0) % 6 === 3 && (y - my0) % 4 === 1)) c = 0xb88a3a; // fantasimönster
    c = mix(c, 0x6a6a60, Math.max(0, 0.5 - Math.hypot(x - DOOR_X, y - 235) / 20) * 0.6); // nött mitt
    P.px(x, y, c);
  }
}
const freeFloor = (x, y) => !OBST.some(([x0, y0, x1, y1]) => x > x0 - 3 && x < x1 + 3 && y > y0 - 3 && y < y1 + 3);

function paintCeiling(P) {
  for (let y = 0; y < CEIL; y++) for (let x = 0; x < W; x++) {
    let c = 0xd4ceb8;
    if (x % 22 === 0) c = 0x9a9682;                       // T-profilerna
    else if (hash(x, y, 71) > 0.82) c = 0xb4ae98;          // akustikplattornas prickar
    const st = Math.hypot((x - 272) / 16, (y - 3) / 6);   // brun vattenfläck
    if (st < 1) c = mix(c, st > 0.8 ? 0x8a6a3a : 0xb8985a, st > 0.8 ? 0.55 : 0.32);
    const st2 = Math.hypot((x - 58) / 9, (y - 5) / 4);
    if (st2 < 1) c = mix(c, 0x9a7a4a, st2 > 0.7 ? 0.5 : 0.22);
    c = mix(c, 0x3a3428, y / CEIL * 0.28);                 // mörkare mot väggen (sot från lysrören)
    P.px(x, y, c);
  }
  // en platta saknas: svart hål med en sladd som hänger ner
  P.rect(441, 0, 21, CEIL - 1, 0x121016); P.hl(441, CEIL - 2, 21, 0x2a2622);
  P.line(446, 1, 450, 6, 0x3a3a44); P.line(450, 6, 452, 12, 0x3a3a44); P.px(452, 12, 0xc8a040);
  P.rect(455, 3, 4, 2, 0x5a5a60); // en gammal kabelränna
  // ventilationsgaller
  P.rect(364, 2, 16, 6, 0xc0bcae); P.box(364, 2, 16, 6, 0x6a6658);
  for (let i = 0; i < 4; i++) P.hl(366, 3 + i, 12, i % 2 ? 0x3a362c : 0x8a8676);
  P.line(378, 8, 380, 13, 0x5a5646, 0.6); // dammluddet som hänger från gallret
  // infällda lysrörsarmaturer i takkanten
  for (const lx of CEIL_LAMPS) {
    P.rect(lx - 15, 2, 30, 6, 0x8a8e8a); P.rect(lx - 14, 3, 28, 4, 0xf4fff4); P.hl(lx - 14, 4, 28, 0xffffff);
    for (let k = 0; k < 4; k++) P.vl(lx - 11 + k * 7, 3, 4, 0xc8d4c8); // gallret i armaturen
    P.px(lx - 6, 5, 0x2a2622); P.px(lx + 5, 4, 0x2a2622);            // döda flugor
  }
  // övervakningskamera i taket
  P.rect(154, 3, 8, 5, 0xe8e8e0); P.hl(154, 3, 8, 0xffffff); P.px(162, 5, 0x1a1a22); P.px(163, 5, 0x3a4a6a); P.vl(157, 0, 3, 0x9a9a90);
  // konvex säkerhetsspegel i taket (visar en förvrängd gång)
  const mx = 200, my = 8;
  for (let y = my - 7; y <= my + 7; y++) for (let x = mx - 7; x <= mx + 7; x++) {
    const d = Math.hypot(x - mx, (y - my) * 1.05);
    if (d > 7) continue;
    let c = d > 6 ? 0x3a3a42 : mix(0xa8b4bc, 0x5a646c, (y - my + 7) / 14);
    if (d <= 6 && d > 2 && hash(x, y, 73) > 0.7) c = mix(c, LOUD[Math.floor(hash(x, y, 74) * LOUD.length)], 0.5);
    if (d <= 6 && x - mx + y - my < -5) c = mix(c, 0xffffff, 0.5);
    P.px(x, y, c);
  }
  P.vl(mx, 0, 1, 0x3a3a42);
  // takets underkant
  P.hl(0, CEIL - 1, W, 0x5a5444);
}

function paintWall(P) {
  for (let y = CEIL; y < WALL_Y; y++) for (let x = SIDE; x < W - SIDE; x++) {
    const counter = x < 152;
    let c = counter ? 0x98b49c : 0xd2c8a2;
    if (counter && vnoise(x, y, 5, 81) > 0.72) c = 0xcfc4a0; // flagnande färg – den gula syns under
    c = mix(c, 0x6a5a3a, (1 - (y - CEIL) / (WALL_Y - CEIL)) * 0.14);   // sot uppe vid taket
    c = mix(c, 0x4a4030, Math.max(0, (y - WALL_Y + 20) / 20) * 0.24);   // smutsig nertill
    if (hash(x, y, 82) > 0.94) c = mul(c, 0.9);
    // vattenränder från taket
    for (const sx of [214, 396, 452]) if (Math.abs(x - sx - Math.sin(y * 0.3) * 0.6) < 1 && y < CEIL + 20 + (sx % 7)) c = mix(c, 0x9a7a4a, 0.3);
    P.px(x, y, c);
  }
  // sockel
  for (let x = SIDE; x < W - SIDE; x++) { P.px(x, WALL_Y - 5, 0x8a7a5e); for (let k = 1; k < 5; k++) P.px(x, WALL_Y - 5 + k, hash(x, k, 83) > 0.9 ? 0x3a3024 : mix(0x5e5040, 0x3e3428, k / 5)); }
}

// ---------- expeditens hörna: TV, skylt, telefonkort, hylla, pärlridå ----------
function paintCounterWall(P) {
  // TV:n på en väggkonsol (skärmen ritas levande – myrornas krig)
  const { x0, x1, y0, y1 } = TV;
  P.rect(x0 + 6, y1, 12, 2, 0x2a2a30); P.vl(x0 + 8, y1 + 2, 6, 0x3a3a40); P.vl(x0 + 15, y1 + 2, 6, 0x3a3a40); // konsolen
  P.hl(x0 + 7, y1 + 7, 10, 0x2a2a30);
  sbox(P, x0, y0, x1 - x0, y1 - y0, 0x8a8478);
  P.rect(x0 + 2, y0 + 2, 16, 14, 0x1a1a1e);            // bildrörets ram
  P.rect(x1 - 5, y0 + 3, 3, 3, 0x3a3a40); P.px(x1 - 4, y0 + 4, 0xc8c8c0); P.rect(x1 - 5, y0 + 8, 3, 3, 0x3a3a40); P.px(x1 - 4, y0 + 9, 0xc8c8c0); // rattarna
  for (let i = 0; i < 3; i++) P.hl(x1 - 5, y0 + 13 + i * 2, 3, 0x5a5650);   // högtalargallret
  P.line(x0 + 10, y0, x0 + 5, y0 - 6, 0x6a6a70); P.line(x0 + 12, y0, x0 + 18, y0 - 7, 0x6a6a70); // antennen
  P.px(x0 + 5, y0 - 6, 0xd0d0d0); P.px(x0 + 18, y0 - 7, 0xd0d0d0); P.px(x0 + 17, y0 - 5, 0xe8d040); // en bit folie på antennen
  // ALLTID ÖPPET · LITE DYRARE – kartongskylt med tusch, lite sned
  {
    const sx = 37, sy = 13, sw = 80, sh = 19;
    const S = skew(P, sx, 20, 1);
    S.rect(sx, sy, sw, sh, 0xe0c898); S.hl(sx, sy, sw, 0xf0dcb0); S.hl(sx, sy + sh - 1, sw, 0xa88a58); S.vl(sx + sw - 1, sy, sh, 0xb89a68);
    for (let y = sy + 1; y < sy + sh - 1; y++) for (let x = sx + 1; x < sx + sw - 1; x++) if (hash(x, y, 91) > 0.93) S.px(x, y, 0xc8ae80);
    const t1 = $t('ALLTID ÖPPET'), w1 = textW(BG, t1);
    text(S, BG, t1, sx + Math.round((sw - w1) / 2) + 1, sy + 3, 0x6a0a0a);
    text(S, BG, t1, sx + Math.round((sw - w1) / 2), sy + 2, 0xd8202a);
    const t2 = '· ' + $t('LITE DYRARE') + ' ·', w2 = textW(SM, t2);
    hand(S, SM, t2, sx + Math.round((sw - w2) / 2), sy + 12, 0x1a1a3a, 5);
    S.rect(sx - 1, sy - 1, 6, 3, 0xf8f8f0, 0.55); S.rect(sx + sw - 5, sy - 1, 6, 3, 0xf8f8f0, 0.55); // tejpbitar
  }
  // TELEFONKORT – blå panel med fantasiflaggor
  {
    const px = 8, py = 38, pw = 46, ph = 26;
    sbox(P, px, py, pw, ph, 0x2a4ab0);
    P.rect(px + 1, py + 1, pw - 2, 7, 0x1a2a80);
    text(P, SM, $t('TELEFONKORT'), px + 2, py + 2, 0xffffff);
    const FLAG = (x, y, k) => {
      const a = LOUD[k % LOUD.length], b = LOUD[(k * 5 + 3) % LOUD.length], c = [0xffffff, 0x1a1a22, 0xf8e040][k % 3];
      if (k % 4 === 0) { P.hl(x, y, 6, a); P.hl(x, y + 1, 6, c); P.hl(x, y + 2, 6, b); P.hl(x, y + 3, 6, a); }
      else if (k % 4 === 1) { P.rect(x, y, 2, 4, a); P.rect(x + 2, y, 2, 4, c); P.rect(x + 4, y, 2, 4, b); }
      else if (k % 4 === 2) { P.rect(x, y, 6, 4, a); P.px(x + 2, y + 1, c); P.px(x + 3, y + 2, c); P.px(x + 2, y + 2, c); }
      else { P.rect(x, y, 6, 4, b); P.px(x, y, a); P.px(x + 1, y + 1, a); P.px(x, y + 2, a); P.px(x + 4, y + 1, c); }
    };
    for (let r = 0; r < 2; r++) for (let k = 0; k < 6; k++) { FLAG(px + 3 + k * 7, py + 10 + r * 6, r * 6 + k); P.hl(px + 3 + k * 7, py + 14 + r * 6, 6, 0x0a1a50, 0.5); }
    hand(P, SM, $t('RING HEM'), px + 3, py + 21, 0xf8e040, 7);
    P.px(px + pw - 5, py + 22, 0xff5a5a); P.px(px + pw - 4, py + 22, 0xff5a5a);
  }
  // hylla med SIM-kort, laddare, batterier och en lyckokatt (tassen ritas levande)
  for (const sy of [46, 63]) {
    P.hl(56, sy, 60, WOOD[3]); P.hl(56, sy + 1, 60, WOOD[1]); P.px(58, sy + 2, 0x3a3a40); P.px(113, sy + 2, 0x3a3a40);
  }
  {
    let x = 57;
    // övre hyllan
    for (let k = 0; k < 5; k++) { const c = LOUD[k * 3 % LOUD.length]; P.rect(x, 39, 4, 7, 0xe8ecf0); P.rect(x + 1, 40, 2, 3, c); P.px(x + 1, 44, 0xf8d040); x += 5; } // SIM-kort i blister
    x += 11; // lyckokatten
    P.rect(x, 40, 3, 6, 0x6a8a3a); P.px(x + 1, 38, 0x8ab04a); P.px(x, 37, 0x6a9a3a); P.px(x + 2, 36, 0x8ab04a); P.vl(x + 1, 36, 4, 0x5a8a2a); // lyckobambu
    x += 5;
    for (let k = 0; k < 4; k++) { P.rect(x, 41, 5, 5, 0xf4f4f0); P.px(x + 2, 42, 0x2a2a30); P.hl(x + 1, 44, 3, 0xc8c8c8); x += 6; } // laddare
    // nedre hyllan
    x = 57;
    for (let k = 0; k < 8; k++) { PR.batt.draw(P, x, 63, [0x1a1a22, 0xe07a2e, 0xd8323a][k % 3]); x += 5; }
    PR.can.draw(P, x, 63, 0xff3a4a, 0); PR.can.draw(P, x + 4, 63, 0x1ad8b8, 1); PR.can.draw(P, x + 8, 63, 0xf0f040, 2); // energishots
  }
  // pärlridån till lagret (själva pärlorna ritas levande)
  {
    const { x0: cx0, x1: cx1, top } = CURT;
    P.rect(cx0, top, cx1 - cx0, WALL_Y - top, 0x16121a);                 // mörkt lager bakom
    sbox(P, cx0 + 4, WALL_Y - 12, 10, 8, CARD[2]); sbox(P, cx0 + 14, WALL_Y - 9, 8, 6, CARD[1]); // kartonger därinne
    P.rect(cx0 + 2, top + 4, 8, 1, 0x2a2430);
    P.rect(cx0 - 2, top - 2, cx1 - cx0 + 4, 2, WOOD[2]); P.hl(cx0 - 2, top - 2, cx1 - cx0 + 4, WOOD[3]);
    P.vl(cx0 - 2, top, WALL_Y - top, WOOD[2]); P.vl(cx0 - 1, top, WALL_Y - top, WOOD[1]);
    P.vl(cx1, top, WALL_Y - top, WOOD[2]); P.vl(cx1 + 1, top, WALL_Y - top, WOOD[1]);
    hand(P, SM, $t('PERSONAL'), cx0 - 1, top - 9, 0x3a2a2a, 9);
  }
  // golvet bakom disken: gummimatta och en liten element
  for (let y = 100; y < 116; y++) for (let x = 50; x < 104; x++) P.px(x, y, (x + y) % 3 === 0 ? 0x2a2a2e : 0x1a1a1e);
}

// ---------- säckarna ----------
// ---------- väggdekor: blekt resaffisch, kalender, vimpelgirlang, spindelväv ----------
function paintWallDecor(P) {
  // resaffischen: solnedgång, hav och en palm – urblekt av åren, tejpad, ett hörn rivet
  const ax = 160, ay = 14, aw = 30, ah = 24, wall = 0xd2c8a2;
  for (let j = 0; j < ah; j++) for (let i = 0; i < aw; i++) {
    if (i > aw - 5 && j < 4 - (aw - 1 - i)) continue;                     // rivet hörn
    let c = j < 11 ? mix(0xf0a040, 0xff7a9a, j / 11) : j < 16 ? mix(0x3a8ad8, 0x2a5aa8, (j - 11) / 5) : 0xe8d8a0;
    if (j >= 9 && j <= 11 && Math.abs(i - 20) <= 3 - (11 - j)) c = 0xfff0a0;  // solen i horisonten
    if (j >= 14 && j <= 15 && (i + j) % 5 === 0) c = 0xa8d0f8;               // vågor
    P.px(ax + i, ay + j, mix(c, wall, 0.38));
  }
  P.vl(ax + 8, ay + 6, 11, mix(0x3a2a1a, wall, 0.3)); P.vl(ax + 9, ay + 8, 9, mix(0x3a2a1a, wall, 0.3)); // palmstammen
  for (const [dx, dy] of [[-4, 0], [-3, -1], [-2, -1], [-1, 0], [1, 0], [2, -1], [3, -1], [4, 0], [5, 1], [-5, 1]]) P.px(ax + 8 + dx, ay + 6 + dy, mix(0x2a5a2a, wall, 0.3));
  script(P, ax + 3, ay + 19, aw - 6, mix(0xd8202a, wall, 0.3), 88, 0);
  P.rect(ax - 1, ay - 1, 5, 3, 0xf8f8f0, 0.5); P.rect(ax + aw - 4, ay + ah - 2, 5, 3, 0xf8f8f0, 0.5);
  // kalendern: en bergsbild och rutor, fantasiskrift i rubriken
  const kx = 198, ky = 14;
  P.rect(kx, ky, 24, 26, 0xf4f0e6); P.box(kx, ky, 24, 26, 0xa8a090);
  for (let j = 0; j < 9; j++) for (let i = 0; i < 22; i++) P.px(kx + 1 + i, ky + 1 + j, j > 5 - Math.abs(i - 8) * 0.6 ? 0x6a8a5a : j > 7 - Math.abs(i - 16) * 0.5 ? 0x8a9aa8 : 0x9ad0f0);
  script(P, kx + 3, ky + 11, 18, 0xd8202a, 91, 3);
  for (let r = 0; r < 3; r++) for (let k = 0; k < 6; k++) P.rect(kx + 2 + k * 3 + (k > 2 ? 1 : 0), ky + 16 + r * 3, 2, 2, (r * 6 + k) === 9 ? 0xd8202a : 0xb8b0a0);
  P.px(kx + 12, ky - 1, 0x3a3a40);
  // vimpelgirlang längs bakväggens överkant (från disken bort mot kylen)
  for (let x = 150; x < 336; x++) {
    const y = CEIL + 1 + Math.round(Math.sin(((x - 150) % 62) / 62 * Math.PI) * 4);
    P.px(x, y, 0x5a5a60);
    if ((x - 150) % 6 === 0) {
      const c = LOUD[((x - 150) / 6) % LOUD.length];
      for (let k = 0; k < 4; k++) P.hl(x - 2 + (k >> 1), y + 1 + k, 5 - k * 1.2 | 0, c);
    }
  }
  // spindelväv i hörnen
  for (const [cx, cy, dir] of [[W - SIDE - 1, CEIL, -1], [SACKS.x0, CEIL, 1]]) {
    for (let k = 0; k < 4; k++) P.line(cx, cy, cx + dir * (3 + k * 2), cy + 8 - k * 2, 0xe8e8f0, 0.45);
    for (let r = 3; r < 9; r += 3) P.line(cx + dir * r, cy, cx, cy + r, 0xe8e8f0, 0.35);
  }
  // kylen läcker: en blank pöl och en grå trasa framför dörr 2
  P.ell(412, 74, 11, 3, 0x6a8aa0, 0.3, 3); P.ell(410, 73, 5, 1.2, 0xffffff, 0.45, 2);
  P.rect(420, 72, 7, 3, 0x8a8a84); P.hl(420, 72, 7, 0xb0b0a8); P.px(426, 74, 0x5a5a54);
  // en råttfälla med ost vid vägghyllans fot
  P.rect(236, 79, 6, 3, 0xc8a070); P.hl(236, 79, 6, 0xe0c090); P.hl(237, 80, 4, 0x8a8a90); P.px(241, 79, 0xf8d040);
}
function paintSacks(P) {
  // liggande 25-kilossäckar i vävd plast: kuddformade, randiga i ändarna, tryck i mitten
  const SACK = [0x7a766a, 0xaeaa9c, 0xd8d4c8, 0xeeeae0, 0xffffff];
  const lying = (x, y, w, h, c, seed) => {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const nx = (i + 0.5 - w / 2) / (w / 2), ny = (j + 0.5 - h / 2) / (h / 2);
      if (Math.abs(nx) > 0.9 && Math.abs(ny) > 0.5) continue;           // hopsydda hörn
      if (Math.abs(nx) > 0.96 && Math.abs(ny) > 0.2) continue;
      let v = 0.66 - ny * 0.42 - Math.abs(nx) * 0.12 + (((i + j) & 1) ? 0.03 : -0.03);
      if (Math.abs(nx) > 0.82) v -= 0.12;                                // ändarna veckar sig
      let k = tone(SACK, v, x + i, y + j);
      const band = (i >= 4 && i <= 5) || (i >= w - 6 && i <= w - 5);
      if (band) k = mix(k, c, 0.75);
      P.px(x + i, y + j, k);
    }
    for (let j = 2; j < h - 2; j += 2) { P.px(x + 1, y + j, 0x8a8678); P.px(x + w - 2, y + j, 0x8a8678); } // sömmarna
    if (seed !== 2) { // tryck: en sol + fantasiskrift
      const ex = x + 10 + (seed % 3) * 2;
      P.ell(ex + 2, y + h / 2 - 0.5, 2.4, 2.4, seed % 4 === 1 ? 0xf08a20 : 0x2a8a4a, 1, 1);
      P.px(ex + 2, y + (h >> 1) - 2, 0xfff0a0);
      script(P, ex + 6, y + (h >> 1) - 2, w - 24, mul(c, 0.75), seed * 13, seed % 4);
    } else {
      text(P, SM, '25KG', x + (w >> 1) - 7, y + (h >> 1) - 2, mix(c, 0x2a2a3a, 0.4));
    }
  };
  lying(154, SACKS.base - 11, 38, 11, 0xd8323a, 1);
  lying(156, SACKS.base - 20, 36, 10, 0x2a8a4a, 2);
  lying(153, SACKS.base - 29, 38, 10, 0x3a5ad8, 3);
  lying(158, SACKS.base - 37, 32, 9, 0xe0a020, 4); // den översta – där katten gärna ligger
  // öppna jutesäckar med rullad kant: röda linser, gula ärtor, torkad chili
  const OPEN = [[196, 0xd86a3a, 0xa84a2a, 'LINSER'], [210, 0xe8c040, 0xb89020, 'ÄRTOR'], [224, 0xc82020, 0x7a1010, 'CHILI']];
  OPEN.forEach(([x, c1, c2, nm], k) => {
    const top = SACKS.base - 17, w = 13;
    for (let j = 4; j < 17; j++) for (let i = 0; i < w; i++) {
      if (j === 16 && (i === 0 || i === w - 1)) continue;
      let c = ((i * 3 + j) % 4 === 0) ? 0x8a6a3a : 0xa88452;              // jute
      if (i === 0) c = 0xc0a070; if (i === w - 1) c = 0x6a5030; if (j > 13) c = mul(c, 0.85);
      P.px(x + i, top + j, c);
    }
    for (let i = 0; i < w; i++) { P.px(x + i, top + 4, 0xd0b27e); P.px(x + i, top + 5, 0x8a6a3a); } // rullad kant
    for (let j = 0; j < 4; j++) for (let i = 1; i < w - 1; i++) {                      // innehållet sett ovanifrån
      const d = Math.abs(i - (w - 1) / 2) / ((w - 1) / 2);
      if (j === 0 && d > 0.6) continue;
      P.px(x + i, top + j + 1, hash(i, j, 300 + k) > 0.5 ? c1 : c2);
      if (hash(i, j, 310 + k) > 0.86) P.px(x + i, top + j + 1, mix(c1, 0xffffff, 0.5));
    }
    // handskriven lapp på en pinne (inte i ärtorna – där står skopan)
    if (k !== 1) {
      const S = skew(P, x - 1, 6, k ? 1 : -1), ty = top - 9, pr = k ? priceLbl(29) : priceLbl(19);
      P.vl(x + 6, top - 4, 6, 0xc8a878);
      S.rect(x - 1, ty, 15, 6, 0xf8f4e8); S.hl(x - 1, ty + 5, 15, 0xc8c0a8); text(S, SM, pr, x, ty + 1, 0x1a1a3a);
    }
  });
  // en plåtskopa i ärtorna
  P.line(214, SACKS.base - 16, 220, SACKS.base - 19, STEEL[3]); P.rect(212, SACKS.base - 16, 3, 2, STEEL[2]);
  groundShadow(P, 195, SACKS.base + 1, 44, 2.5, 0.3);
}

// ---------- vägghyllan: oljedunkar, mjöl, inläggningar, tekannor, kartonger till taket ----------
function paintWallShelf(P) {
  const { x0, x1, base } = WSHELF;
  const top = CEIL + 1;
  P.rect(x0 + 2, top, x1 - x0 - 4, base - top - 2, 0x3a2a1e);                   // mörk bakvägg i hyllan
  for (let y = top; y < base - 2; y++) for (let x = x0 + 2; x < x1 - 2; x++) if (hash(x, y, 101) > 0.9) P.px(x, y, 0x2e2016);
  const boards = [24, 36, 48, 60, 72];
  // hyllplanens varor
  const put1 = (b, fn) => { let x = x0 + 3; while (x < x1 - 4) x += fn(x, b) + 1; };
  put1(72, (x, b) => { const k = Math.floor(hash(x, 1, 102) * 4); const c = [0xe8c020, 0x2a8a3a, 0x3a6ad8, 0xd8323a][k]; if (x + 7 > x1 - 3) return 7; PR.oil.draw(P, x, b - 2, c, x); PR.oil.draw(P, x, b - 2, c, x); return 7; });
  put1(60, (x, b) => { // mjölsäckar och honungsburkar
    if (hash(x, 2, 103) > 0.4) { if (x + 7 > x1 - 3) return 7; PR.rice.draw(P, x, b, pickOf(PACKS, x, 3, 104), x); PR.rice.draw(P, x, b - 1, pickOf(PACKS, x, 3, 104), x); return 6; }
    if (x + 5 > x1 - 3) return 5; PR.jar.draw(P, x, b, 0xe0a020, x); return 5;
  });
  put1(48, (x, b) => { if (x + 5 > x1 - 3) return 5; PR.jar.draw(P, x, b, pickOf([0x6a8a2a, 0xc83a2a, 0xe8e0c0, 0x4a2a5a, 0xe0a030], x, 4, 105), x); return 5; });
  put1(36, (x, b) => { // tekannor i mässing och glas i askar
    if (hash(x, 5, 106) > 0.45) {
      if (x + 9 > x1 - 3) return 9;
      const c = hash(x, 6, 106) > 0.5 ? [0x6a4a14, 0xa87a2a, 0xd8a840, 0xf0d070, 0xfff0b0] : STEEL;
      for (let j = 0; j < 7; j++) for (let i = 0; i < 7; i++) { const d = Math.hypot(i - 3, (j - 4) * 1.2); if (d < 3.6) P.px(x + i, b - 8 + j, tone(c, 0.7 - (i - 3) * 0.12 - (j - 4) * 0.08, x + i, j)); }
      P.px(x + 3, b - 9, c[3]); P.hl(x + 2, b - 8, 3, c[2]); P.px(x + 7, b - 5, c[2]); P.px(x + 8, b - 6, c[2]); P.px(x - 1 + 0, b - 5, c[1]); // lock, pip, handtag
      return 9;
    }
    if (x + 6 > x1 - 3) return 6; PR.cbox.draw(P, x, b, pickOf(PACKS, x, 7, 107), x); return 6;
  });
  put1(24, (x, b) => { // kartonger ända upp i taket
    const w = 8 + Math.floor(hash(x, 8, 108) * 8), h = 9 + Math.floor(hash(x, 9, 108) * 4);
    if (x + w > x1 - 3) return w;
    sbox(P, x, b - h, w, h, CARD[2]); P.vl(x + (w >> 1), b - h, 2, CARD[4]);
    script(P, x + 2, b - h + 4, w - 4, 0x5a3a1a, x, Math.floor(hash(x, 10, 108) * 4), 0.8);
    return w;
  });
  // stolpar och hyllplan
  for (const b of boards) { P.hl(x0, b - 2, x1 - x0, WOOD[3]); P.hl(x0, b - 1, x1 - x0, WOOD[1]); for (let x = x0 + 5; x < x1 - 5; x += 13) shelfTag(P, x, b - 1, x * 7 + b); }
  for (const sx of [x0, (x0 + x1) >> 1, x1 - 2]) { P.vl(sx, top, base - top, WOOD[2]); P.vl(sx + 1, top, base - top, WOOD[0]); }
  // kryddpåsar i remsor som hänger på stolparna
  for (const sx of [x0 + 3, x1 - 6]) clipStrip(P, sx, CEIL + 16, 8, 1);
  groundShadow(P, (x0 + x1) / 2, base + 1, (x1 - x0) / 2, 2.5, 0.35);
}
// en upphängningsremsa med små påsar (snacks eller kryddor)
function clipStrip(P, x, y, n, seed) {
  P.vl(x + 1, y - 1, n * 4 + 2, 0x9aa0a8); P.px(x + 1, y - 2, 0x5a5e66);
  for (let k = 0; k < n; k++) {
    const c = LOUD[Math.floor(hash(k, seed, 111) * LOUD.length)], r = rampOf(c), yy = y + k * 4, xx = x + (k & 1 ? 0 : 1) - 1;
    P.hl(xx, yy, 4, 0xe8e8e0); P.rect(xx, yy + 1, 4, 3, r[2]); P.px(xx, yy + 1, r[3]); P.px(xx + 3, yy + 3, r[1]); P.px(xx + 1, yy + 2, 0xf4f1ea);
  }
}

// ---------- kylväggen: åtta glasdörrar fulla med läsk ----------
const DOOR_KIND = ['macka', 'burk', 'flaska', 'energi', 'exotisk', 'burk2', 'lyx', 'vatten'];
function fridgeGoods(P, kind, x0, x1, b, row, seed) {
  let x = x0, i = 0;
  const col = (k) => LOUD[Math.floor(hash(k, seed + row, 121) * LOUD.length)];
  while (x < x1) {
    const c = col(Math.floor(i / 3));
    if (kind === 'burk' || kind === 'burk2') { // små läskburkar, uppställda i rader
      if (x + 3 > x1) break;
      const r = rampOf(c);
      P.hl(x, b - 5, 3, STEEL[3]); P.px(x + 2, b - 5, STEEL[1]);
      for (let y = b - 4; y < b; y++) { P.px(x, y, r[3]); P.px(x + 1, y, r[2]); P.px(x + 2, y, r[1]); }
      if ((i + row) % 3 === 0) P.px(x + 1, b - 3, 0xffffff); else if ((i + row) % 3 === 1) P.hl(x, b - 2, 3, mix(c, 0xffffff, 0.5)); else P.px(x + 1, b - 2, 0x1a1a22);
      x += 3;
    } else if (kind === 'flaska' || kind === 'vatten') { // PET-flaskor med korkar
      if (x + 3 > x1) break;
      const cc = kind === 'vatten' ? 0xb8e0f8 : c, r = rampOf(cc);
      P.px(x + 1, b - 7, kind === 'vatten' ? 0x3a7bd5 : [0xf4f1ea, 0xd8323a, 0x2a8a3a][i % 3]);
      P.px(x + 1, b - 6, r[3]);
      for (let y = b - 5; y < b; y++) { P.px(x, y, r[3]); P.px(x + 1, y, r[2]); P.px(x + 2, y, r[1]); }
      P.hl(x, b - 3, 3, kind === 'vatten' ? 0x3a7bd5 : 0xf4f1ea); if (kind !== 'vatten') P.px(x + 1, b - 3, mul(c, 0.6));
      x += 3;
    } else if (kind === 'energi') { // höga svarta burkar med neon
      if (x + 3 > x1) break;
      P.hl(x, b - 7, 3, STEEL[3]);
      for (let y = b - 6; y < b; y++) { P.px(x, y, 0x3a3a44); P.px(x + 1, y, 0x22222a); P.px(x + 2, y, 0x14141a); }
      P.px(x + 1, b - 5, c); P.px(x, b - 4, c); P.px(x + 2, b - 4, c); P.px(x + 1, b - 3, c);
      x += 3;
    } else if (kind === 'exotisk') { // glasflaskor: mango, ros, aloe med bitar
      if (x + 3 > x1) break;
      const liq = [0xffa020, 0xff7ab0, 0xc8f0a0, 0xd8403a, 0xf8e8a0][Math.floor(hash(i, row, 131) * 5)];
      P.px(x + 1, b - 7, 0xc8a040); P.px(x + 1, b - 6, 0xe0f0e8);
      for (let y = b - 5; y < b; y++) { P.px(x, y, mix(liq, 0xffffff, 0.35)); P.px(x + 1, y, liq); P.px(x + 2, y, mul(liq, 0.72)); }
      if (liq === 0xc8f0a0) { P.px(x + 1, b - 4, 0xffffff); P.px(x, b - 2, 0xf0fff0); } // aloebitarna
      P.px(x + 1, b - 3, 0xf4f1ea);
      x += 3;
    } else if (kind === 'macka') { // smörgåstrianglar i plast och yoghurtdrickor
      if (row % 2 === 0) {
        if (x + 5 > x1) break;
        P.px(x, b - 4, 0xe8d0a0); P.hl(x, b - 3, 2, 0xe8d0a0); P.hl(x, b - 2, 3, 0xe8c890); P.hl(x, b - 1, 5, 0xd8b070);
        P.px(x + 1, b - 2, (i & 1) ? 0x5ab83a : 0xd84a3a); P.px(x + 2, b - 1, 0xf8d040);
        P.px(x + 3, b - 2, 0xffffff, 0.5); P.px(x + 4, b - 1, 0x3a7bd5);
        x += 5;
      } else {
        if (x + 3 > x1) break;
        P.px(x + 1, b - 5, 0xf4f1ea); P.rect(x, b - 4, 3, 4, 0xf8f4ec); P.hl(x, b - 3, 3, c); P.px(x + 2, b - 1, 0xc8c4bc);
        x += 3;
      }
    } else if (kind === 'lyx') { // lyxlådor: svarta askar med färgglada fack
      if (x + 7 > x1) break;
      P.rect(x, b - 4, 7, 4, 0x2a2430); P.hl(x, b - 4, 7, 0x4a4450);
      P.rect(x + 1, b - 3, 2, 2, 0xf4f1ea); P.rect(x + 4, b - 3, 2, 2, 0xf08a50); P.px(x + 1, b - 3, 0xff5a5a); P.px(x + 5, b - 2, 0x7ac050);
      P.hl(x, b - 4, 7, 0xffffff, 0.3);
      x += 7;
    } else break;
    i++;
  }
}
function paintFridge(P, displays) {
  const { x0, x1, top, n, dw } = FRIDGE, base = WALL_Y + 2;
  // ljuslådan överst: KALLA DRYCKER + fantasiskrift (en del av lådan är släckt)
  P.rect(x0 - 2, top - 2, x1 - x0 + 4, 11, 0x2a2e36);
  for (let y = top - 1; y < top + 8; y++) for (let x = x0; x < x1; x++) {
    let c = x < x0 + 64 ? 0xb8c0c4 : 0xeef6fa;
    if (x >= x0 + 64 && x < x0 + 66) c = 0xd0d8dc;
    P.px(x, y, mix(c, 0xa0b0c0, (y - top) / 12));
  }
  const hdr = $t('KALLA DRYCKER'), hw = textW(SM, hdr);
  text(P, SM, hdr, x0 + 80, top + 1, 0x1a4ab0);
  script(P, x0 + 86 + hw, top + 2, 60, 0xd8202a, 17, 0);
  script(P, x0 + 8, top + 2, 50, 0x6a7a8a, 23, 1);
  for (let x = x0 + 200; x < x1 - 4; x += 12) logo(P, x, top + 2, LOUD[(x >> 2) % LOUD.length], x);
  // stommen
  P.rect(x0 - 2, top + 8, x1 - x0 + 4, base - top - 8, 0x3a3e46);
  const food = (d) => displays.find((s) => s.d.kind === 'fridge' && s.d.door === d);
  for (let d = 0; d < n; d++) {
    const dx = x0 + d * dw, gx0 = dx + 2, gx1 = dx + dw - 2, gy0 = top + 10, gy1 = base - 6;
    // insidan: ljus bakvägg, hyllor av tråd
    vgrad(P, gx0, gy0, gx1 - gx0, gy1 - gy0, 0xf4fcff, 0xb8ccd8, 4);
    const kind = food(d) ? food(d).f.id === 'lyx' ? 'lyx' : food(d).f.id === 'macka' ? 'macka' : 'burk' : DOOR_KIND[d];
    for (let r = 0; r < 5; r++) {
      const b = gy0 + 8 + r * 8;
      if (b > gy1) break;
      fridgeGoods(P, food(d) && !['lyx', 'macka'].includes(food(d).f.id) ? 'macka' : kind, gx0 + 1, gx1 - 1, b, r, d * 17);
      P.hl(gx0, b, gx1 - gx0, 0x8a98a4); P.hl(gx0, b + 1, gx1 - gx0, 0xd8e4ec, 0.6);
      for (let x = gx0 + 3; x < gx1 - 4; x += 9) { P.rect(x, b, 3, 2, 0xf8f8f0); P.px(x + 1, b, 0xd8202a); } // prislappar på tråden
    }
    // glaset: blå ton, reflexer, imma nertill
    for (let y = gy0; y < gy1; y++) for (let x = gx0; x < gx1; x++) {
      P.px(x, y, 0xb0d8f0, 0.1);
      const fog = (y - gy1 + 12) / 12;
      if (fog > 0 && bayer(x, y) < fog * 0.55) P.px(x, y, 0xf0f8ff, 0.45);
    }
    glare(P, gx0, gy0, gx1 - gx0, gy1 - gy0, 0.22, 15, d * 3);
    // dörrkarmen och handtaget
    P.box(dx + 1, top + 9, dw - 1, base - top - 13, 0x5a606a);
    P.vl(dx + 1, top + 9, base - top - 13, 0x8a929c);
    const hx = d % 2 ? dx + 4 : dx + dw - 5;
    P.vl(hx, gy0 + 12, 12, 0xe6ecf0); P.vl(hx + 1, gy0 + 12, 12, 0x8e98a2); P.px(hx, gy0 + 11, 0x646c76); P.px(hx, gy0 + 24, 0x646c76);
    // lappar på några dörrar
    if (d === 3) { const S = skew(P, dx + 7, 5, 1); S.rect(dx + 7, gy0 + 2, 19, 13, 0xf8f8f0); S.hl(dx + 7, gy0 + 14, 19, 0xc8c4b8); hand(S, SM, $t('DRA'), dx + 11, gy0 + 3, 0xd8202a, 33); hand(S, SM, $t('HÅRT'), dx + 9, gy0 + 9, 0xd8202a, 34); }
    if (d === 4) { P.rect(dx + 8, gy0 + 28, 7, 5, 0xffd23f); P.px(dx + 9, gy0 + 29, 0xd8202a); P.px(dx + 12, gy0 + 30, 0xd8202a); } // en klistermärkesstjärna
    if (d === 7) { P.ell(dx + 22, gy0 + 6, 3, 3, 0xffffff, 0.7, 2); } // frost i hörnet
  }
  // mittstolpar
  for (let d = 0; d <= n; d++) P.vl(x0 + d * dw, top + 8, base - top - 10, d % 2 ? 0x2a2e34 : 0x4a4e56);
  // kompressorgallret nertill
  P.rect(x0 - 2, base - 4, x1 - x0 + 4, 4, 0x22262c);
  for (let x = x0; x < x1; x += 3) P.vl(x, base - 3, 2, 0x4a4e56);
  groundShadow(P, (x0 + x1) / 2, base + 1, (x1 - x0) / 2 + 2, 2, 0.4);
}

// ---------- framväggen: fönster med galler och dörren ----------
function paintFront(P, night) {
  const y0 = FRONT_Y;
  for (let x = 0; x < W; x++) {
    P.px(x, y0, 0x2a2420); P.px(x, y0 + 1, 0x4a3e34); P.px(x, y0 + 2, 0x6a5a4a); P.px(x, y0 + 3, 0xa8a090); // väggens ovansida + fönsterbräda
  }
  const win = (x0, x1) => {
    for (let y = y0 + 4; y < H; y++) for (let x = x0; x < x1; x++) {
      const t = (y - y0 - 4) / (H - y0 - 4);
      let c = night ? mix(0x141a30, 0x0a0e1e, t) : mix(0xb8c8d0, 0x8a9aa4, t);
      if (!night && hash(x >> 3, y, 141) > 0.8) c = mix(c, 0x7a8a94, 0.3); // gatan därute
      P.px(x, y, c);
    }
    for (let x = x0 + 2; x < x1; x += 4) P.vl(x, y0 + 4, H - y0 - 4, 0x2a2a30); // galler
    P.hl(x0, y0 + 9, x1 - x0, 0x2a2a30);
    glare(P, x0, y0 + 4, x1 - x0, H - y0 - 4, night ? 0.08 : 0.2, 17, x0);
  };
  win(SIDE, DOOR.x0 - 2); win(DOOR.x1 + 2, W - SIDE);
  for (const x of [DOOR.x0 - 2, DOOR.x1, 300, 440]) { P.rect(x, y0 + 3, 2, H - y0 - 3, 0x4a3e34); P.vl(x, y0 + 3, H - y0 - 3, 0x6a5a4a); }
  // klistermärken sedda bakifrån
  for (const [x, y, w] of [[30, 247, 6], [120, 249, 5], [230, 246, 7], [362, 250, 5], [520, 247, 6]]) { P.rect(x, y, w, 4, 0xe8e8e0); P.hl(x, y, w, 0xffffff); }
  // neonskylten 24/7 – baklänges inifrån
  {
    const N = new Pix(20, 7);
    text(N, SM, '24/7', 2, 1, 0xff2a3a);
    const nx = 60, ny = 247;
    for (let y = 0; y < 7; y++) for (let x = 0; x < 20; x++) { const c = N.get(x, y); if (N.d[(y * 20 + x) * 4 + 3]) P.px(nx + 19 - x, ny + y, night ? 0xff5a6a : 0xc8404a); }
    P.box(nx - 1, ny - 1, 22, 8, 0x3a3a40, 0.6);
  }
  // dörren: glas med gallergrind och ett tvärhandtag
  P.rect(DOOR.x0, y0 + 2, DOOR.x1 - DOOR.x0, H - y0 - 2, 0x3a3a40);
  for (let y = y0 + 4; y < H; y++) for (let x = DOOR.x0 + 2; x < DOOR.x1 - 2; x++) P.px(x, y, night ? 0x10162a : 0xa8b8c4);
  for (let x = DOOR.x0 + 4; x < DOOR.x1 - 2; x += 5) P.vl(x, y0 + 4, H - y0 - 4, 0x2a2a30);
  P.hl(DOOR.x0 + 2, y0 + 8, DOOR.x1 - DOOR.x0 - 4, 0xc8ccd0); P.hl(DOOR.x0 + 2, y0 + 9, DOOR.x1 - DOOR.x0 - 4, 0x6a6e74);
  hand(P, SM, $t('DRAG'), DOOR.x0 + 7, y0 + 11, night ? 0xc8c8c0 : 0x2a2a30, 12);
  // sidoväggarna
  P.rect(0, 0, SIDE, H, 0x2a2420); P.vl(SIDE - 1, CEIL, H - CEIL, 0x4a3e34);
  P.rect(W - SIDE, 0, SIDE, H, 0x2a2420); P.vl(W - SIDE, CEIL, H - CEIL, 0x4a3e34);
}

function paintBackground(displays, night) {
  const P = new Pix(W, H);
  paintFloor(P);
  paintCeiling(P);
  paintWall(P);
  paintWallDecor(P);
  paintCounterWall(P);
  paintSacks(P);
  paintWallShelf(P);
  paintFridge(P, displays);
  paintFront(P, night);
  return P.flush();
}

// ---------- gondolerna ----------
const CATS = {
  nudlar: { sign: $t('NUDLAR & RIS'), shelves: [['npack'], ['cup', 'npack'], ['cup'], ['rice']], strips: [0.18, 0.62] },
  snacks: { sign: $t('SNACKS'), shelves: [['chips'], ['cbox', 'chips'], ['chips'], ['cbox']], strips: [0.16, 0.5, 0.86] },
  konserv: { sign: $t('KONSERVER'), note: $t('FRÅGA INTE'), shelves: [['weird'], ['tin', 'weird'], ['jar', 'weird'], ['can', 'tin']], strips: [] },
  kryddor: { sign: $t('KRYDDOR'), shelves: [['spice'], ['jar', 'spice'], ['bottle'], ['oil']], strips: [0.3, 0.8] },
  te: { sign: $t('TE & KAFFE'), shelves: [['tea'], ['coffee', 'tea'], ['dates', 'cbox'], ['coffee', 'rice']], strips: [0.9] },
  hushall: { sign: $t('HUSHÅLL'), shelves: [['batt', 'candle'], ['deterg'], ['deterg', 'candle'], ['tp']], strips: [0.12] },
};
const LIPS = [36, 27, 18, 9]; // hyllplanens höjd över golvet (varorna står på dem)
function paintGondola(G, gi, displays) {
  const { x0, x1, base, cat } = G, w = x1 - x0, C = CATS[cat], topY = base - GH;
  const mine = displays.filter((s) => s.d.kind === 'gondola' && s.d.g === gi);
  return sprite(x0 - 3, base - GH - 22, w + 6, GH + 28, (P) => {
    // kartonger och balar ovanpå i två lager, ända upp mot lysrören
    const overBox = (x, y, bw, bh, i, layer) => {
      const kind = hash(i, gi + layer * 50, 143);
      if (kind > 0.3 || layer) {
        sbox(P, x, y - bh, bw, bh, mix(CARD[2], 0x8a7a5a, hash(i, gi + layer, 144) * 0.45));
        P.hl(x + 1, y - bh + 1, bw - 2, mix(CARD[3], 0xffffff, 0.1));
        P.vl(x + (bw >> 1), y - bh, 2, CARD[4]); // tejp
        if (hash(i, gi, 145 + layer) > 0.5) script(P, x + 2, y - bh + 3, bw - 4, 0x4a2a14, i * 31 + gi + layer * 7, Math.floor(hash(i, gi, 146) * 4), 0.8);
        else if (bh > 5) { P.px(x + 3, y - bh + 3, 0x4a3a2a); P.px(x + 2, y - bh + 4, 0x4a3a2a); P.px(x + 4, y - bh + 4, 0x4a3a2a); } // ↑
      } else if (kind > 0.12) { // en plastbal med varor
        const c = PACKS[Math.floor(hash(i, gi, 147) * PACKS.length)];
        for (let j = 0; j < bh; j++) for (let k = 0; k < bw; k++) P.px(x + k, y - bh + j, (k + j * 2) % 5 < 3 ? c : mul(c, 0.75));
        P.hl(x, y - bh, bw, 0xffffff, 0.5); P.vl(x + bw - 1, y - bh, bh, 0xffffff, 0.25);
      } else { // en liggande rissäck
        for (let j = 0; j < 5; j++) for (let k = 0; k < bw; k++) P.px(x + k, y - 5 + j, tone([0x8a8678, 0xb8b4a6, 0xdedad0, 0xf0ece4, 0xffffff], 0.7 - (j - 2) * 0.18, x + k, j));
        P.vl(x + 3, y - 5, 5, 0xd8323a); P.vl(x + bw - 4, y - 5, 5, 0xd8323a);
      }
    };
    for (let x = x0 + 1, i = 0; x < x1 - 6; i++) {
      const bw = 8 + Math.floor(hash(i, gi, 141) * 12), bh = 5 + Math.floor(hash(i, gi, 142) * 6);
      if (x + bw > x1 - 1) break;
      if (mine.some((s) => x + bw > s.tag[0] - 20 && x < s.tag[0] + 20)) { x += 3; continue; }
      overBox(x, topY, bw, bh, i, 0);
      if (hash(i, gi, 149) > 0.45 && bw > 9) { // ett lager till ovanpå
        const w2 = bw - 3 - Math.floor(hash(i, gi, 150) * 3), h2 = 4 + Math.floor(hash(i, gi, 151) * 4);
        overBox(x + 1 + Math.floor(hash(i, gi, 152) * 2), topY - bh, w2, h2, i + 40, 1);
      }
      x += bw + (hash(i, gi, 148) > 0.7 ? 1 : 0);
    }
    // hyllplanet överst
    P.hl(x0, topY, w, METAL[4]); P.hl(x0, topY + 1, w, METAL[2]); P.hl(x0, topY + 2, w, METAL[1]);
    // bakstycke: gulnad perforerad plåt
    for (let y = topY + 3; y < base - 4; y++) for (let x = x0; x < x1; x++) {
      let c = mix(0xcac2a4, 0xa8a086, (y - topY) / GH);
      if ((x - x0) % 4 === 2 && (y - base) % 4 === 0) c = 0x6a6450;
      if (hash(x, y, 150 + gi) > 0.985) c = 0x8a5a2a; // rostprickar
      P.px(x, y, c);
    }
    // varorna – överfulla
    LIPS.forEach((l, si) => {
      const b = base - l;
      let segs = [[x0 + 1, x1 - 1]];
      for (const s of mine) {
        const dx0 = x0 + s.d.dx, dx1 = dx0 + s.d.w;
        segs = segs.flatMap(([a, z]) => (dx1 <= a || dx0 >= z ? [[a, z]] : [[a, dx0 - 1], [dx1 + 1, z]].filter(([p, q]) => q - p > 3)));
        foodDisplay(P, s, dx0, dx1, b, si);
      }
      for (const [a, z] of segs) stockShelf(P, a, z, b, C.shelves[si], gi * 31 + si * 7);
      // hyllkant (med skugga under) + några handskrivna lappar
      for (let x = x0; x < x1; x++) { P.px(x, b, METAL[4]); P.px(x, b + 1, METAL[1]); P.px(x, b + 2, 0x1a1410, 0.3); }
      for (let x = x0 + 6 + ((si * 11) % 13); x < x1 - 8; x += 26 + Math.floor(hash(x, si, gi) * 16)) {
        if (mine.some((s) => x + 6 > x0 + s.d.dx - 1 && x < x0 + s.d.dx + s.d.w + 1)) continue;
        shelfTag(P, x, b, x * 13 + si * 7 + gi);
      }
    });
    // sockel med bucklor
    P.rect(x0, base - 4, w, 4, 0x4a4438); P.hl(x0, base - 4, w, 0x7a7262); P.hl(x0, base - 1, w, 0x1e1a14);
    for (let x = x0 + 3; x < x1 - 3; x += 7) if (hash(x, gi, 151) > 0.5) P.px(x, base - 3, 0x2a261e);
    // stolpar i ändarna
    for (const sx of [x0, x1 - 2]) { P.vl(sx, topY, GH, METAL[3]); P.vl(sx + 1, topY, GH, METAL[0]); }
    // snacks i remsor som hänger från hyllplanet
    for (const f of C.strips) {
      const sx = Math.round(x0 + 4 + f * (w - 10));
      if (mine.some((s) => sx + 5 > x0 + s.d.dx - 2 && sx < x0 + s.d.dx + s.d.w + 2)) continue;
      clipStrip(P, sx, topY + 4, 5, gi * 10 + Math.round(f * 10));
    }
    outline(P, OUT, 0.5);
    // kategoriskylt: handskriven kartongbit tejpad på hyllplanet (vänster ände)
    {
      const nm = C.sign, sw = handW(SM, nm, gi) + 6, sx = x0 + 3, sy = topY - 11;
      const S = skew(P, sx, 9, gi % 2 ? 1 : -1);
      S.rect(sx, sy, sw, 9, 0xe8d4a8); S.hl(sx, sy, sw, 0xf8e8c0); S.hl(sx, sy + 8, sw, 0xa88a58);
      hand(S, SM, nm, sx + 3, sy + 2, 0x1a1a3a, gi);
      S.rect(sx + 1, sy + 7, 3, 3, 0xf8f8f0, 0.6);
      if (C.note) { const nw = handW(SM, C.note, 3) + 4, nx = sx + sw + 4; const S2 = skew(P, nx, 5, 1); S2.rect(nx, sy + 1, nw, 7, 0xffffff); hand(S2, SM, C.note, nx + 2, sy + 2, 0xd8202a, 3); }
    }
    // ett nedfallet paket på golvet framför
    if (gi % 2 === 0) { const fx = x0 + 20 + Math.floor(hash(gi, 1, 152) * (w - 40)); P.rect(fx, base + 1, 5, 2, pickOf(LOUD, gi, 2, 153)); P.hl(fx, base + 1, 5, 0xffffff, 0.4); }
    // slagskugga
    P.hl(x0, base, w, 0x1a1422, 0.4); P.hl(x0 + 1, base + 1, w - 2, 0x1a1422, 0.18);
  });
}
// maten i en gondol: tätt packad med egen röd hyllkant
function foodDisplay(P, s, x0, x1, b, si) {
  if (s.f.id === 'nudlar') {
    if (si === 0) { for (let x = x0; x + 7 <= x1; x += 7) PR.npack.draw(P, x, b, (x & 8) ? 0xd8323a : 0xf0b429, x); }
    else for (let x = x0, i = 0; x + 5 <= x1; x += 5, i++) PR.cup.draw(P, x, b, [0xd8323a, 0xe07a2e, 0xd8323a][(i + si) % 3], i);
  } else {
    const c = PACKS[Math.floor(hash(s.f.id.length, s.f.id.charCodeAt(0), 5) * PACKS.length)];
    for (let x = x0; x + 6 <= x1; x += 6) PR.cbox.draw(P, x, b, c, x);
  }
  for (let x = x0; x < x1; x++) { P.px(x, b + 1, 0xd8323a); }
}

// ---------- disken med plexiglas, kassaapparat, radio och varmkorvgrill ----------
function paintCounter() {
  return sprite(CNT.x0 - 2, 62, CNT.x1 - CNT.x0 + 6, CNT.base - 62 + 3, (P) => {
    const { x0, x1, top, face, base } = CNT;
    // framsidan: brun laminatpanel med klistermärken och tuggummiställ
    for (let y = face; y < base - 2; y++) for (let x = x0; x < x1; x++) {
      let c = (x - x0) % 9 === 0 ? 0x4a2e1a : mix(0x7a4a2a, 0x5a361e, (y - face) / 16);
      if (hash(x, y, 161) > 0.9) c = mul(c, 0.88);
      P.px(x, y, c);
    }
    P.rect(x0, base - 2, x1 - x0, 2, 0x1e1812);
    // klistermärken
    for (const [sx, sy, c] of [[16, 111, 0xffd23f], [98, 116, 0x3a7bd5], [128, 112, 0xff5a8a], [60, 119, 0x4ae05a]]) { P.rect(sx, sy, 5, 3, c); P.hl(sx, sy, 5, mix(c, 0xffffff, 0.4)); }
    // två små ställ med godis
    for (const gx of [24, 88]) {
      P.rect(gx, face + 2, 22, 11, 0x2a2a30);
      for (let r = 0; r < 3; r++) for (let k = 0; k < 7; k++) { const c = LOUD[(k * 3 + r * 5 + gx) % LOUD.length]; P.rect(gx + 1 + k * 3, face + 3 + r * 3, 2, 2, c); P.px(gx + 1 + k * 3, face + 3 + r * 3, mix(c, 0xffffff, 0.5)); }
      P.hl(gx, face + 13, 22, 0x9aa0a8);
    }
    // ALLTID ÖPPET-lapp även på disken (liten)
    { const S = skew(P, 50, 6, -1); S.rect(50, face + 3, 30, 8, 0xf6f24a); hand(S, SM, $t('24 TIM'), 53, face + 4, 0x1a1a3a, 44); }
    // bänkskivan: sliten vit laminat med kaffe-ringar
    for (let y = top; y < face; y++) for (let x = x0; x < x1; x++) {
      let c = mix(0xe8e2d0, 0xc8c0aa, (y - top) / 8);
      if (hash(x, y, 162) > 0.92) c = mul(c, 0.93);
      P.px(x, y, c);
    }
    P.hl(x0, top, x1 - x0, 0xfaf6ec); P.hl(x0, face - 1, x1 - x0, 0x9a9080); P.hl(x0, face, x1 - x0, STEEL[3]);
    for (let a = 0; a < 20; a++) { const t = a / 20 * Math.PI * 2; P.px(Math.round(100 + Math.cos(t) * 3), Math.round(104 + Math.sin(t) * 1.5), 0x8a6a4a, 0.5); }
    // kassaapparaten (bakom glaset)
    sbox(P, 86, 86, 20, 13, 0xd8d0b8); P.rect(88, 88, 16, 3, 0x2a2a30); P.rect(88, 92, 16, 6, 0xb8b09a);
    for (let r = 0; r < 2; r++) for (let k = 0; k < 5; k++) P.rect(89 + k * 3, 93 + r * 3, 2, 2, r === 0 && k === 4 ? 0xd8323a : 0xf0ece0);
    P.rect(90, 80, 10, 6, 0x2a2a30); P.rect(91, 81, 8, 4, 0x0e2a1a); // kunddisplayen (siffrorna ritas levande)
    // kortterminal framför glaset
    P.rect(98, 97, 7, 5, 0x2a2a30); P.rect(99, 98, 5, 2, 0x6ab0c8); P.px(101, 101, 0x5a5a60); P.line(104, 101, 108, 103, 0x2a2a30);
    // radion på vänstra änden
    {
      const rx = RADIO.x0, ry = 90;
      sbox(P, rx, ry, 20, 11, 0x5a5a64);
      for (let k = 0; k < 4; k++) for (let j = 0; j < 3; j++) P.px(rx + 2 + k * 2, ry + 3 + j * 2, 0x2a2a30); // högtalaren
      for (let k = 0; k < 4; k++) for (let j = 0; j < 3; j++) P.px(rx + 12 + k * 2, ry + 3 + j * 2, 0x2a2a30);
      P.rect(rx + 9, ry + 2, 2, 4, 0xc8b060); P.px(rx + 9, ry + 8, 0xd8323a); // skalan och en knapp
      P.line(rx + 17, ry, rx + 25, ry - 12, 0xb8bcc4); P.px(rx + 25, ry - 12, 0xe6ecf0); // antennen
      P.hl(rx + 3, ry - 1, 14, 0x3a3a40); // handtaget
    }
    // en burk med klubbor
    P.rect(36, 94, 7, 7, 0xe8f4f8, 0.8); P.box(36, 94, 7, 7, 0x9ab0b8, 0.6);
    for (let k = 0; k < 4; k++) { P.vl(37 + k * 2, 90, 5, 0xf4f1ea); P.px(37 + k * 2, 89, LOUD[k * 2]); P.px(37 + k * 2, 88, mix(LOUD[k * 2], 0xffffff, 0.3)); }
    // varmkorvgrillen: rullar under en glaskupa (korvarna ritas levande)
    {
      const gx0 = GRILL.x0, gx1 = GRILL.x1;
      sbox(P, gx0, 94, gx1 - gx0, 8, 0xb8c0c8);
      P.rect(gx0 + 2, 95, gx1 - gx0 - 4, 5, 0x3a3e46);
      for (let y = 84; y < 95; y++) for (let x = gx0 + 1; x < gx1 - 1; x++) P.px(x, y, 0xe8f4ff, 0.14);
      P.hl(gx0 + 1, 84, gx1 - gx0 - 2, 0xe6ecf0, 0.8); P.vl(gx0 + 1, 84, 10, 0xe6ecf0, 0.6); P.vl(gx1 - 2, 84, 10, 0x8e98a2, 0.6);
      glare(P, gx0 + 2, 85, gx1 - gx0 - 4, 9, 0.3, 9, 1);
      P.rect(gx0 + 3, 102, 6, 3, 0x5a5a60); // strömbrytaren
    }
    // plexiglaset: ram, blå ton, repor, talhål, lucka
    {
      const { x0: px0, x1: px1, top: pt, bot } = PLEX;
      for (let y = pt; y < bot; y++) for (let x = px0; x < px1; x++) {
        if (y >= bot - 5 && x >= 64 && x < 84) continue; // luckan där pengarna går
        P.px(x, y, 0xa8d8e8, 0.16);
      }
      glare(P, px0 + 1, pt + 1, px1 - px0 - 2, bot - pt - 1, 0.3, 19, 4);
      for (let k = 0; k < 9; k++) { const sx = px0 + 4 + Math.floor(hash(k, 1, 171) * (px1 - px0 - 12)), sy = pt + 3 + Math.floor(hash(k, 2, 171) * 18); P.line(sx, sy, sx + 3 + (k % 4), sy + (k % 3) - 1, 0xffffff, 0.35); } // repor
      for (let r = 0; r < 3; r++) for (let k = 0; k < 3; k++) P.px(58 + k * 2, 84 + r * 2, 0x2a3a40, 0.7); // talhålen
      P.vl(px0, pt, bot - pt, 0x9aa4ae); P.vl(px0 + 1, pt, bot - pt, 0xe6ecf0, 0.6); P.vl(px1 - 1, pt, bot - pt, 0x6a727c);
      P.hl(px0, pt, px1 - px0, 0xe6ecf0); P.hl(px0, pt + 1, px1 - px0, 0x9aa4ae);
      P.rect(63, bot - 1, 22, 2, 0x8a929c); // myntskålen
      // lappar på glaset (i hörnen – expediten ska synas)
      { const S = skew(P, px0 + 2, 6, 1); S.rect(px0 + 2, pt + 3, 25, 7, 0xf8f8f0); text(S, SM, $t('SWISH'), px0 + 4, pt + 4, 0x6a2a8a); }
      { const S = skew(P, px0 + 2, 5, -1); S.rect(px0 + 2, bot - 11, 17, 7, 0xff86c8); hand(S, SM, $t('KORT'), px0 + 4, bot - 10, 0x1a1a3a, 52); }
    }
    // snacks i remsa som hänger från plexiglasets hörn
    clipStrip(P, PLEX.x1 + 1, PLEX.top + 2, 4, 77);
    groundShadow(P, (x0 + x1) / 2, base + 1, (x1 - x0) / 2, 2.5, 0.4);
  });
}

// ---------- frysboxen där katten ligger på den varma motorhörnan ----------
function paintFreezer(displays) {
  return sprite(FRZ.x0 - 2, FRZ.top - 2, FRZ.x1 - FRZ.x0 + 5, FRZ.base - FRZ.top + 5, (P) => {
    const { x0, x1, top, lid, base } = FRZ;
    const hasPizza = displays.some((s) => s.d.kind === 'freezer');
    // lockets ram och glasskjutdörrarna sedda ovanifrån
    P.rect(x0, top, x1 - x0, lid - top, 0xe8e4d8);
    const ix0 = x0 + 2, ix1 = x1 - 12, iy0 = top + 2, iy1 = lid - 1;
    P.rect(ix0, iy0, ix1 - ix0, iy1 - iy0, 0xc8dce8);
    // varorna därnere: pizzakartonger och glasspaket
    for (let k = 0; k * 9 < ix1 - ix0 - 6; k++) {
      const x = ix0 + 1 + k * 9, piz = hasPizza ? k < 3 : k % 2;
      if (piz) {
        P.rect(x, iy0 + 1, 8, 6, k % 2 ? 0xd8323a : 0xf0b429); P.ell(x + 3.5, iy0 + 4, 2.6, 2.2, 0xe8a040, 1, 1); P.px(x + 3, iy0 + 3, 0xc82020); P.px(x + 5, iy0 + 4, 0x4a9a2a);
      } else {
        P.rect(x, iy0 + 1, 8, 6, LOUD[(k * 5) % LOUD.length]); P.rect(x + 2, iy0 + 2, 4, 3, 0xf8f0e0); P.px(x + 3, iy0 + 3, 0xff8ab0);
      }
    }
    for (let y = iy0; y < iy1; y++) for (let x = ix0; x < ix1; x++) { if (y === iy0 || x === ix0 || x === ix1 - 1) P.px(x, y, 0xffffff, 0.55); } // frost i kanten
    glare(P, ix0, iy0, ix1 - ix0, iy1 - iy0, 0.3, 11, 2);
    P.vl((ix0 + ix1) >> 1, iy0, iy1 - iy0, 0xb8c0c8); // skarven mellan skjutluckorna
    // motorhörnan (varm – kattens plats) med galler
    P.rect(x1 - 11, top + 1, 10, lid - top - 1, 0xd8d4c8);
    for (let x = x1 - 10; x < x1 - 2; x += 2) P.vl(x, top + 3, 5, 0x8a867a);
    // framsidan: gulnad emalj, rostiga hörn, klistermärke med fantasiskrift
    for (let y = lid; y < base; y++) for (let x = x0; x < x1; x++) {
      let c = mix(0xeae4d4, 0xc8c0aa, (y - lid) / 10);
      if (x === x0 || x === x1 - 1) c = mul(c, 0.85);
      if ((y >= base - 2 && (x < x0 + 3 || x > x1 - 4)) || hash(x, y, 181) > 0.97) c = 0x9a6a3a; // rost
      P.px(x, y, c);
    }
    P.hl(x0, lid, x1 - x0, 0xffffff);
    P.rect(x0 + 6, lid + 3, 14, 5, 0x2ac0ff); script(P, x0 + 7, lid + 4, 12, 0xffffff, 91, 2);
    P.rect(x1 - 10, lid + 2, 8, 6, 0x5a564c); for (let y = lid + 3; y < lid + 7; y += 2) P.hl(x1 - 9, y, 6, 0x2a2622); // värmegallret
    P.px(x0 + 30, lid + 5, 0x40e060); // lampan
    outline(P, OUT, 0.6);
    groundShadow(P, (x0 + x1) / 2, base + 1, (x1 - x0) / 2, 2.5, 0.4);
  });
}

// ---------- vatten i sexpack på en pall ----------
function paintPallet() {
  return sprite(PALLET.x0 - 2, PALLET.base - 26, PALLET.x1 - PALLET.x0 + 5, 30, (P) => {
    const { x0, x1, base } = PALLET;
    // pallen
    P.rect(x0, base - 4, x1 - x0, 4, WOOD[3]); P.hl(x0, base - 4, x1 - x0, WOOD[4]);
    for (const x of [x0, (x0 + x1) >> 1, x1 - 5]) P.rect(x, base - 2, 5, 2, WOOD[1]);
    // två lager sexpack
    for (let layer = 0; layer < 2; layer++) {
      const by = base - 4 - layer * 9;
      for (let x = x0 + 1; x < x1 - 1; x += 8) {
        for (let k = 0; k < 3; k++) {
          const bx = x + k * 2 + 1;
          P.vl(bx, by - 8, 1, 0x3a7bd5); P.vl(bx, by - 7, 7, 0xb8e0f8); P.px(bx + 1, by - 6, 0xe0f4ff); P.vl(bx + 1, by - 5, 5, 0x8ab8d8);
          P.px(bx, by - 4, 0x3a7bd5);
        }
        P.hl(x, by - 1, 8, 0x5a8ab0);
      }
      for (let y = by - 8; y < by; y++) for (let x = x0 + 1; x < x1 - 1; x++) if ((x + y) % 7 === 0) P.px(x, y, 0xffffff, 0.35); // krympplasten
    }
    // en handskriven lapp
    { const S = skew(P, x0 + 2, 8, 1); S.rect(x0 + 2, base - 14, 32, 7, 0xf8f8f0); text(S, SM, $t('6 FÖR 49'), x0 + 4, base - 13, 0x1a1a3a); }
    outline(P, OUT, 0.55);
    groundShadow(P, (x0 + x1) / 2, base + 1, (x1 - x0) / 2, 2.5, 0.35);
  });
}

// ---------- kartongstaplar ----------
function paintBoxes(B, bi) {
  const hh = 8 + B.n * 8;
  return sprite(B.x0 - 2, B.base - hh - 4, B.x1 - B.x0 + 5, hh + 8, (P) => {
    const w = B.x1 - B.x0;
    for (let k = 0; k < B.n; k++) {
      const off = k % 2 ? 1 : 0, bw = w - off * 2 - (k === B.n - 1 ? 3 : 0), by = B.base - 8 - k * 8;
      const c = mix(CARD[2], 0x8a7a5a, hash(k, bi, 191) * 0.35);
      sbox(P, B.x0 + off, by, bw, 8, c);                                   // framsidan
      P.hl(B.x0 + off, by - 2, bw, mix(c, 0xffffff, 0.15)); P.hl(B.x0 + off, by - 1, bw, mix(c, 0xffffff, 0.08)); // ovansidan
      P.vl(B.x0 + off + (bw >> 1), by - 2, 3, CARD[4]);                    // tejp
      script(P, B.x0 + off + 2, by + 2, bw - 5, 0x4a2a14, bi * 7 + k, (bi + k) % 4, 0.85);
      if (k === 0) { P.px(B.x0 + off + bw - 4, by + 4, 0xd8202a); P.px(B.x0 + off + bw - 3, by + 5, 0xd8202a); }
    }
    // den översta är uppriven – varor sticker upp
    const ty = B.base - 8 - (B.n - 1) * 8 - 2;
    for (let x = B.x0 + 3; x < B.x1 - 5; x += 4) PR.can.draw(P, x, ty + 1, LOUD[(x + bi) % LOUD.length], x);
    P.line(B.x0 + 2, ty, B.x0 - 1, ty - 3, CARD[3]); P.line(B.x1 - 4, ty, B.x1 - 1, ty - 2, CARD[3]); // flikarna
    if (bi === 1) { P.rect(B.x0 + 4, ty - 2, 6, 1, 0xf8d040); P.px(B.x0 + 9, ty - 2, 0x3a3a40); } // en mattkniv ovanpå
    outline(P, OUT, 0.55);
    groundShadow(P, (B.x0 + B.x1) / 2, B.base + 1, w / 2 + 1, 2, 0.4);
  });
}

// ---------- hinken med moppen i hörnet ----------
function paintMop() {
  return sprite(MOP.x - 14, MOP.base - 44, 28, 48, (P) => {
    const { x, base } = MOP;
    P.line(x + 7, base - 42, x + 1, base - 9, 0xa8744a); P.line(x + 8, base - 42, x + 2, base - 9, 0x7a5030); // skaftet lutar mot väggen
    for (let j = 0; j < 10; j++) for (let i = -9; i <= 9; i++) {
      const d = Math.abs(i) / 9;
      if (j === 0 && d > 0.9) continue;
      P.px(x + i, base - 10 + j, j < 2 ? 0xffd23f : tone([0x8a6a08, 0xc89a10, 0xf0c020, 0xffe060, 0xfff4b0], 0.62 - i * 0.04 - j * 0.03, x + i, j));
    }
    P.rect(x - 7, base - 10, 14, 2, 0x5a5448); for (let i = -6; i < 7; i += 2) P.px(x + i, base - 10, 0x7a7466); // skitigt vatten
    P.rect(x - 2, base - 16, 10, 6, 0xd8c8a0); for (let k = 0; k < 5; k++) P.vl(x - 2 + k * 2, base - 16, 6, 0xb0a078); // moppens trasor
    P.rect(x + 4, base - 13, 6, 3, 0x3a3a40); P.hl(x + 4, base - 13, 6, 0x6a6a70); // vridaren
    P.px(x - 8, base - 1, 0x2a2a30); P.px(x + 8, base - 1, 0x2a2a30); // hjulen
    outline(P, OUT, 0.55);
    groundShadow(P, x, base + 1, 11, 2, 0.4);
  });
}

// ---------- uttagsautomaten – ur funktion ----------
function paintAtm() {
  return sprite(ATM.x0 - 2, ATM.base - 30, ATM.x1 - ATM.x0 + 5, 34, (P) => {
    const { x0, x1, base } = ATM, w = x1 - x0;
    sbox(P, x0, base - 26, w, 26, 0x6a707a);
    P.rect(x0 + 1, base - 26, w - 2, 6, 0x2a8a5a); text(P, SM, $t('UTTAG'), x0 + 3, base - 25, 0xffffff);
    P.rect(x0 + 3, base - 19, w - 6, 8, 0x1a2a6a); P.rect(x0 + 4, base - 18, w - 8, 6, 0x2a4ad8);
    { const S = skew(P, x0 - 1, 6, 1); S.rect(x0 - 1, base - 18, w + 1, 7, 0xf8f8f0); S.hl(x0 - 1, base - 12, w + 1, 0xc8c4b8); text(S, SM, $t('TRASIG'), x0, base - 17, 0xd8202a); } // lappen över skärmen
    for (let r = 0; r < 3; r++) for (let k = 0; k < 3; k++) P.rect(x0 + 4 + k * 3, base - 9 + r * 3, 2, 2, 0xd8dce0);
    P.rect(x1 - 7, base - 8, 4, 1, 0x1a1a22); P.px(x1 - 5, base - 6, 0x40e060);
    outline(P, OUT, 0.6);
    groundShadow(P, (x0 + x1) / 2, base + 1, w / 2 + 1, 2, 0.4);
  });
}

// ---------- korgarna vid dörren ----------
function paintBaskets() {
  return sprite(BASKETS.x0 - 2, BASKETS.base - 18, BASKETS.x1 - BASKETS.x0 + 5, 22, (P) => {
    const { x0, x1, base } = BASKETS, w = x1 - x0;
    for (let k = 0; k < 4; k++) {
      const y = base - 6 - k * 3;
      P.hl(x0, y, w, 0x6ae08a); P.rect(x0, y + 1, w, 3, 0x2aa84a); for (let i = 1; i < w; i += 3) P.px(x0 + i, y + 2, 0x0e6a2a);
    }
    P.rect(x0, base - 3, w, 3, 0x1e8a3a);
    P.line(x0 + 2, base - 15, x0 + 4, base - 19, 0x1a1a22); P.line(x1 - 3, base - 15, x1 - 5, base - 19, 0x1a1a22); P.hl(x0 + 4, base - 19, w - 8, 0x1a1a22);
    outline(P, OUT, 0.5);
    groundShadow(P, (x0 + x1) / 2, base + 1, w / 2, 2, 0.35);
  });
}

// ---------- frukt från värmen i trälådor under fönstret ----------
function fruitHeap(P, x0, y0, w, pal, r, seed, rows = 3) {
  const step = r * 1.8;
  for (let row = 0; row < rows; row++) for (let i = 0; i < Math.ceil(w / step) + 1; i++) {
    const cx = x0 + 1 + i * step + (row & 1 ? step / 2 : 0), cy = y0 + row * r * 1.05;
    if (cx > x0 + w - 1) continue;
    for (let y = Math.floor(cy - r); y <= cy + r; y++) for (let x = Math.floor(cx - r); x <= cx + r; x++) {
      const nx = (x + 0.5 - cx) / r, ny = (y + 0.5 - cy) / (r * 0.9), d = nx * nx + ny * ny;
      if (d > 1 || x < x0 || x >= x0 + w) continue;
      P.px(x, y, tone(pal, 0.64 - nx * 0.2 - ny * 0.3 - d * 0.2 + (hash(x, y, seed) - 0.5) * 0.12, x, y));
    }
    P.px(Math.round(cx - r * 0.4), Math.round(cy - r * 0.45), pal[4]);
  }
}
const FR_PAL = {
  mango: [0x6a2a0a, 0xc0501a, 0xf08a30, 0xffc060, 0xfff0b0],
  granat: [0x4a0812, 0x86101e, 0xc02838, 0xe8606a, 0xffb0b0],
  lime: [0x1e4a10, 0x3a7a1a, 0x6ab030, 0xa8dc68, 0xe0ffc0],
  dadel: [0x2a0e06, 0x4a1c0c, 0x6a2e14, 0x8a4a24, 0xb07040],
};
function paintCrates() {
  return sprite(CRATES.x0 - 2, CRATES.base - 30, CRATES.x1 - CRATES.x0 + 5, 34, (P) => {
    const { x0, x1, base } = CRATES;
    const crate = (x, y, w, h, fruit, r, seed, tag) => { // y = lådans fot
      P.rect(x, y - h - 5, w, 5, 0x2a1a0e);                                  // lådans insida
      fruitHeap(P, x + 1, y - h - 3, w - 2, FR_PAL[fruit], r, seed, 2);
      for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {            // framsidans ribbor
        let c = j === 0 || j === (h >> 1) + 1 ? WOOD[4] : j === h - 1 ? WOOD[1] : WOOD[3];
        if (j === (h >> 1)) c = 0x2a1a0e;
        if (i < 2 || i >= w - 2) c = j === 0 ? WOOD[3] : WOOD[2];
        if (hash(x + i, j, 211) > 0.9 && c !== 0x2a1a0e) c = mul(c, 0.86);
        P.px(x + i, y - h + j, c);
      }
      script(P, x + 4, y - h + 1, w - 8, 0x3a2410, seed, seed % 4, 0.7);     // stämpel på ribban
      if (tag) { const S = skew(P, x + 3, 5, seed % 2 ? 1 : -1); P.vl(x + 8, y - h - 11, 6, 0xc8a878); S.rect(x + 3, y - h - 14, 18, 6, 0xf8f4e8); hand(S, SM, tag, x + 4, y - h - 13, 0x1a1a3a, seed); }
    };
    crate(x0, base, 22, 8, 'mango', 2.7, 3, priceLbl(5));
    crate(x0 + 22, base, 22, 8, 'granat', 2.5, 7, priceLbl(9));
    crate(x0 + 12, base - 9, 20, 7, 'lime', 2.1, 11, null);   // en låda lime ovanpå, snett
    outline(P, OUT, 0.55);
    groundShadow(P, (x0 + x1) / 2, base + 1, (x1 - x0) / 2 + 1, 2, 0.35);
  });
}
// ---------- snurrstället: solglasögon, nyckelringar, mobilskal (roterar) ----------
function paintSpinner(frame) {
  const P = new Pix(24, 44, SPIN.x0 - 5, SPIN.base - 42);
  const cx = (SPIN.x0 + SPIN.x1) >> 1, base = SPIN.base;
  for (let x = cx - 7; x <= cx + 7; x++) { P.px(x, base - 1, 0x2a2a30); P.px(x, base - 2, x < cx ? 0x5a5a64 : 0x3a3a44); } // foten
  const tiers = [base - 34, base - 24, base - 14];
  const items = [];
  tiers.forEach((ty, ti) => { for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2 + frame * (Math.PI / 12) + ti * 0.5; items.push({ x: cx + Math.sin(a) * 6.5, d: Math.cos(a), y: ty, ti, k }); } });
  items.sort((a, b) => a.d - b.d);
  const item = (it) => {
    const x = Math.round(it.x), y = it.y, dim = it.d < 0 ? 0.55 : 1, c = mul(LOUD[(it.k * 3 + it.ti * 5) % LOUD.length], dim);
    P.line(cx, y - 1, x, y - 1, mul(0xb8bcc4, dim));
    if (it.ti === 0) { // solglasögon
      P.hl(x - 2, y, 5, c); P.rect(x - 2, y + 1, 2, 2, mul(0x1a1a22, 1)); P.rect(x + 1, y + 1, 2, 2, 0x1a1a22); P.px(x - 2, y + 1, mul(0x8ab4ff, dim));
    } else if (it.ti === 1) { // nyckelringar
      P.px(x, y, mul(0xd8d8d8, dim)); P.rect(x - 1, y + 1, 3, 3, c); P.px(x - 1, y + 1, mix(c, 0xffffff, 0.5));
    } else { // mobilskal
      P.rect(x - 1, y, 3, 5, c); P.px(x - 1, y, mix(c, 0xffffff, 0.45)); P.px(x + 1, y + 1, 0x1a1a22);
    }
  };
  for (const it of items) if (it.d < 0) item(it);
  P.vl(cx, base - 38, 36, 0xc8ccd4); P.vl(cx + 1, base - 38, 36, 0x6a6e78);   // stången
  for (const it of items) if (it.d >= 0) item(it);
  // skylten överst: en sol och ett pris
  P.rect(cx - 6, base - 42, 14, 6, 0xffd23f); P.hl(cx - 6, base - 42, 14, 0xfff08a);
  P.ell(cx - 2.5, base - 39, 1.6, 1.6, 0xf07a1a, 1, 1); text(P, SM, '49', cx + 1, base - 41, 0xc0202a);
  outline(P, OUT, 0.5);
  return { img: P.flush(), x: SPIN.x0 - 5, y: SPIN.base - 42 };
}
// ---------- brödstället med tunnbröd i påsar ----------
function paintBread() {
  return sprite(BREAD.x0 - 2, BREAD.base - 34, BREAD.x1 - BREAD.x0 + 5, 38, (P) => {
    const { x0, x1, base } = BREAD, w = x1 - x0;
    for (const sx of [x0, x1 - 1]) P.vl(sx, base - 30, 30, 0x8a909a);
    for (let k = 0; k < 3; k++) {
      const b = base - 3 - k * 9;
      P.hl(x0, b, w, 0xb8bec8); P.hl(x0, b + 1, w, 0x5a606a);
      for (let j = 0; j < 2; j++) { // två påsar per hyllplan
        const bx = x0 + 1 + j * 9, c = [0xd8323a, 0x2a8a4a, 0x3a5ad8][(k + j) % 3];
        P.rect(bx, b - 7, 9, 7, 0xf4f0e8, 0.9);
        P.ell(bx + 4.5, b - 3.5, 3.6, 2.6, 0xe0b878, 1, 1); P.px(bx + 3, b - 4, 0xc89858); P.px(bx + 6, b - 3, 0xc89858); // brödet
        P.hl(bx, b - 7, 9, c); P.px(bx + 1, b - 6, 0xffffff); script(P, bx + 1, b - 2, 7, c, k * 5 + j, (k + j) % 4, 0.8);
      }
    }
    { const S = skew(P, x0 - 1, 6, -1); S.rect(x0 - 1, base - 34, w + 2, 6, 0xe8d4a8); hand(S, SM, $t('BRÖD'), x0 + 2, base - 33, 0x1a1a3a, 81); }
    outline(P, OUT, 0.55);
    groundShadow(P, (x0 + x1) / 2, base + 1, w / 2 + 1, 2, 0.35);
  });
}
// ---------- energidryckskylen bredvid disken ----------
function paintCooler() {
  return sprite(COOLER.x0 - 2, COOLER.base - 46, COOLER.x1 - COOLER.x0 + 5, 50, (P) => {
    const { x0, x1, base } = COOLER, w = x1 - x0, top = base - 42;
    sbox(P, x0, top, w, 42, 0x2a2a34);
    P.rect(x0 + 1, top + 1, w - 2, 7, 0x0e0e14);                               // ljuslådan
    for (let x = x0 + 2; x < x1 - 2; x++) P.px(x, top + 4, 0x8aff3a);
    P.line(x0 + 7, top + 2, x0 + 10, top + 5, 0xf8f040); P.line(x0 + 10, top + 5, x0 + 12, top + 3, 0xf8f040); P.line(x0 + 12, top + 3, x0 + 14, top + 7, 0xf8f040); // en blixt
    const gx0 = x0 + 2, gx1 = x1 - 2, gy0 = top + 9, gy1 = base - 5;
    vgrad(P, gx0, gy0, gx1 - gx0, gy1 - gy0, 0xe8f8ff, 0xb0c8d8, 3);
    for (let r = 0; r < 4; r++) {
      const b = gy0 + 7 + r * 7;
      for (let x = gx0 + 1; x + 3 <= gx1; x += 3) {
        const c = [0x8aff3a, 0xff3a8a, 0x3ae0ff, 0xffd23a][(r + ((x - gx0) / 3 | 0)) % 4];
        P.hl(x, b - 6, 3, STEEL[3]); for (let y = b - 5; y < b; y++) { P.px(x, y, 0x3a3a44); P.px(x + 1, y, 0x22222a); P.px(x + 2, y, 0x14141a); }
        P.px(x + 1, b - 4, c); P.px(x, b - 3, c); P.px(x + 2, b - 3, c);
      }
      P.hl(gx0, b, gx1 - gx0, 0x6a7a88);
    }
    for (let y = gy0; y < gy1; y++) for (let x = gx0; x < gx1; x++) P.px(x, y, 0xb0d8f0, 0.1);
    glare(P, gx0, gy0, gx1 - gx0, gy1 - gy0, 0.25, 11, 3);
    P.vl(gx1 - 2, gy0 + 8, 12, 0xe6ecf0);                                       // handtaget
    P.rect(x0 + 1, base - 4, w - 2, 3, 0x1a1a22); for (let x = x0 + 2; x < x1 - 2; x += 2) P.px(x, base - 3, 0x4a4a54);
    outline(P, OUT, 0.6);
    groundShadow(P, (x0 + x1) / 2, base + 1, w / 2 + 1, 2, 0.4);
  });
}
// ---------- glassboxen: kyldisk med glasslock och en stor glasstrut på framsidan ----------
function paintGlass() {
  return sprite(GLASS.x0 - 2, GLASS.top - 4, GLASS.x1 - GLASS.x0 + 5, GLASS.base - GLASS.top + 8, (P) => {
    const { x0, x1, top, lid, base } = GLASS, w = x1 - x0;
    P.rect(x0, top, w, lid - top, 0xf0ece4);
    const ix0 = x0 + 2, ix1 = x1 - 2, iy0 = top + 2, iy1 = lid - 1;
    P.rect(ix0, iy0, ix1 - ix0, iy1 - iy0, 0xd0e4f0);
    for (let k = 0; k * 6 < ix1 - ix0 - 4; k++) { // glasspinnar och bägare sedda ovanifrån
      const x = ix0 + 1 + k * 6, c = LOUD[(k * 5 + 2) % LOUD.length];
      if (k % 2) { P.rect(x, iy0 + 1, 5, 4, c); P.hl(x, iy0 + 1, 5, mix(c, 0xffffff, 0.5)); P.px(x + 2, iy0 + 3, 0xffffff); }
      else { P.ell(x + 2.5, iy0 + 3, 2.4, 2.2, c, 1, 1); P.px(x + 2, iy0 + 2, 0xffffff); }
    }
    glare(P, ix0, iy0, ix1 - ix0, iy1 - iy0, 0.35, 9, 5);
    for (let x = ix0; x < ix1; x++) P.px(x, iy0, 0xffffff, 0.6);
    // framsidan: blå med en stor glasstrut och fantasiskrift
    for (let y = lid; y < base; y++) for (let x = x0; x < x1; x++) P.px(x, y, x === x0 || x === x1 - 1 ? 0x2a4a9a : mix(0x3a6ad8, 0x2a4aa8, (y - lid) / 8));
    P.hl(x0, lid, w, 0x8ab0ff);
    const cx = x0 + 8;
    P.ell(cx, lid + 2, 2.6, 2.4, 0xff8ab0, 1, 1); P.ell(cx + 3, lid + 2, 2.4, 2.2, 0xf8f0d0, 1, 1); P.px(cx - 1, lid + 1, 0xffffff);
    for (let j = 0; j < 4; j++) P.hl(cx - 1 + (j >> 1), lid + 4 + j, 4 - j, 0xe0a050);
    script(P, x0 + 15, lid + 2, w - 18, 0xffffff, 44, 2);
    text(P, SM, $t('GLASS'), x0 + 16, lid + 4 - 3 + 3, 0xf8e040);
    outline(P, OUT, 0.6);
    groundShadow(P, (x0 + x1) / 2, base + 1, w / 2 + 1, 2.5, 0.4);
  });
}
// ---------- tidningsstället med utländska tidningar ----------
function paintNews() {
  return sprite(NEWS.x0 - 2, NEWS.base - 22, NEWS.x1 - NEWS.x0 + 5, 26, (P) => {
    const { x0, x1, base } = NEWS, w = x1 - x0;
    for (const sx of [x0, x1 - 1]) P.vl(sx, base - 18, 18, 0x6a707a);
    for (let r = 0; r < 2; r++) {
      const b = base - 2 - r * 9;
      P.hl(x0, b, w, 0x9aa0a8);
      for (let k = 0; k < 3; k++) { // tidningar: grått papper, färgade rubriker, fantasiskrift
        const px = x0 + 1 + k * 8, py = b - 8 + (k % 2);
        P.rect(px, py, 7, 8, 0xe8e4d8); P.hl(px, py, 7, 0xf8f4ea);
        P.hl(px + 1, py + 1, 5, [0xd8202a, 0x1a4ab0, 0x1a1a22][(k + r) % 3]); P.hl(px + 1, py + 2, 4, [0xd8202a, 0x1a4ab0, 0x1a1a22][(k + r) % 3]);
        script(P, px + 1, py + 4, 5, 0x5a5a60, k * 7 + r, (k + r * 2) % 4, 0.8);
        P.rect(px + 4, py + 5, 2, 2, 0x8a8a90);
      }
    }
    outline(P, OUT, 0.55);
    groundShadow(P, (x0 + x1) / 2, base + 1, w / 2, 2, 0.35);
  });
}
// ---------- lotter-stället LYCKOSKRAP: en plexilåda med tre rullar på en fot ----------
function paintLott() {
  const { x0, x1, top, base } = LOTT, w = x1 - x0;
  return sprite(x0 - 2, top - 2, w + 5, base - top + 5, (P) => {
    const GREENS = [0x0a3a22, 0x125a34, 0x1e7a4a, 0x3aa86a, 0x7ad89a], GOLDS = [0x6a4a0a, 0x9a7414, 0xd0a42a, 0xf4d050, 0xfff4b0];
    // foten: svart plåtfot med ett rör upp
    P.rect(x0 + 5, base - 2, w - 10, 2, 0x1a1a1e); P.hl(x0 + 5, base - 2, w - 10, 0x4a4a52);
    P.vl(x0 + (w >> 1) - 1, base - 6, 4, 0x5a5e68); P.vl(x0 + (w >> 1), base - 6, 4, 0x2a2a30);
    // lådan: grön rygg med guldkant, tre fack med lotter som hänger ut i remsor
    const by0 = top + 8, by1 = base - 6;
    for (let y = by0; y < by1; y++) for (let x = x0 + 1; x < x1 - 1; x++) {
      const e = Math.min(x - x0 - 1, y - by0, x1 - 2 - x, by1 - 1 - y);
      P.px(x, y, e === 0 ? GOLDS[1] : tone(GREENS, 0.55 - (y - by0) / 60 + (((x + y) >> 1) % 5 === 0 ? 0.08 : 0), x, y));
    }
    const lanes = [x0 + 4, x0 + 11, x0 + 18], cols = [[0x3aa86a, 0xf4d050], [0xd8323a, 0xfff4b0], [0x3a6ad8, 0xf4d050]];
    lanes.forEach((lx, k) => {
      P.hl(lx - 1, by0 + 3, 7, 0x0a1a10);                                  // facket
      const len = 6 + ((k * 5) % 7);                                        // remsan med lotter ut ur facket
      for (let j = 0; j < len; j++) {
        const y = by0 + 4 + j, [c1, c2] = cols[k];
        for (let i = 0; i < 5; i++) P.px(lx + i, y, j % 5 === 4 ? mix(c1, 0xffffff, 0.5) : (i === 1 || i === 3) && j % 5 === 1 ? c2 : i === 0 ? mix(c1, 0xffffff, 0.3) : i === 4 ? mul(c1, 0.7) : c1);
        if (j % 5 === 4) for (let i = 0; i < 5; i += 2) P.px(lx + i, y, 0x0a1a10);    // perforeringen
      }
      P.px(lx + 2, by0 + 4 + len, cols[k][0]); P.px(lx + 1, by0 + 4 + len, mul(cols[k][0], 0.7)); // en lott som böjer sig
    });
    // plexifronten: blank med reflexer
    for (let y = by0 + 1; y < by1 - 1; y++) for (let x = x0 + 2; x < x1 - 2; x++) P.px(x, y, 0xd8f0ff, 0.12);
    glare(P, x0 + 2, by0 + 1, w - 4, by1 - by0 - 2, 0.35, 11, 3);
    // skylten överst: LOTTER i guld på svart med en klöver, och prislappen
    P.rect(x0, top, w, 8, 0x141016); P.hl(x0, top, w, GOLDS[3]); P.hl(x0, top + 7, w, GOLDS[1]);
    const lw = textW(SM, $t('LOTTER'));
    text(P, SM, $t('LOTTER'), x0 + ((w - lw) >> 1), top + 2, GOLDS[3]);
    P.hl(x0 + ((w - lw) >> 1), top + 2, lw, GOLDS[4], 0.5);
    { const tw = handW(SM, priceLbl(25), 61) + 3, S = skew(P, x1 - tw + 1, 5, 1); S.rect(x1 - tw + 1, by1 - 7, tw, 7, 0xffd23f); S.hl(x1 - tw + 1, by1 - 7, tw, 0xfff08a); hand(S, SM, priceLbl(25), x1 - tw + 2, by1 - 6, 0xc8141a, 61); }
    outline(P, OUT, 0.55);
    groundShadow(P, (x0 + x1) / 2, base + 1, w / 2 - 2, 1.6, 0.35);
  });
}
// ---------- läskbackar staplade i hörnet ----------
function paintSoda() {
  return sprite(SODA.x0 - 2, SODA.base - 26, SODA.x1 - SODA.x0 + 4, 30, (P) => {
    const { x0, x1, base } = SODA, w = x1 - x0;
    const cols = [0xd8323a, 0x3a5ad8, 0xf0b429];
    for (let k = 0; k < 3; k++) {
      const y = base - 6 - k * 6, c = cols[k], r = rampOf(c);
      P.rect(x0, y, w, 6, r[2]); P.hl(x0, y, w, r[3]); P.hl(x0, y + 5, w, r[1]);
      P.rect(x0 + 3, y + 2, 5, 2, r[0]); P.rect(x1 - 8, y + 2, 5, 2, r[0]);    // handtagshålen
      script(P, x0 + 9, y + 2, 4, r[4], k * 3, 3, 0.8);
    }
    for (let x = x0 + 1; x < x1 - 1; x += 3) { P.px(x, base - 19, [0xf4f1ea, 0xd8323a, 0x2a8a4a][x % 3]); P.px(x + 1, base - 19, 0x8ab4c8); } // korkarna i översta backen
    outline(P, OUT, 0.55);
    groundShadow(P, (x0 + x1) / 2, base + 1, w / 2, 2, 0.35);
  });
}

// ---------- lysrören (ritas ovanpå allt, hänger i sladdar från taket) ----------
function paintTube(on, broken = false) {
  const P = new Pix(34, 10);
  P.vl(7, 0, 3, 0x4a4a52); P.vl(26, 0, 3, 0x4a4a52);                      // korta kedjor upp i taket
  P.rect(2, 3, 30, 5, 0xb8bcb6); P.hl(2, 3, 30, 0xdadedb); P.hl(2, 7, 30, 0x6a6e68);
  const lit = on ? [0xffffff, 0xf0fff4] : [0x8a948e, 0x76807c];
  P.hl(3, 4, 28, lit[1]); P.hl(3, 5, 28, lit[0]); P.hl(3, 6, 28, lit[1]);
  P.rect(2, 4, 2, 3, 0x6a6e6a); P.rect(30, 4, 2, 3, 0x6a6e6a);
  if (broken) for (const x of [4, 5, 6, 27, 28, 29]) for (let y = 4; y < 7; y++) P.px(x, y, 0x2e2a28, x === 6 || x === 27 ? 0.5 : 0.85); // svärtade ändar
  for (const [x, y] of [[10, 5], [19, 6], [23, 4]]) P.px(x, y, 0x2a2622, 0.75);   // döda flugor i armaturen
  outline(P, 0x2a2a30, 0.5);
  return P.flush();
}
// ljuskäglan från ett lysrör ner mot golvet (glest dithrad, så den blir pixlig och svag)
function paintCone(h) {
  const w0 = 28, w1 = 76, WW = w1 + 2;
  const P = new Pix(WW, h);
  for (let j = 0; j < h; j++) {
    const f = j / (h - 1), hw = (w0 + (w1 - w0) * f) / 2;
    for (let i = 0; i < WW; i++) {
      const dx = Math.abs(i + 0.5 - WW / 2);
      if (dx > hw) continue;
      const edge = Math.min(1, (1 - dx / hw) * 3);
      const b = bayer(i, j);
      if (b < 0.5) P.px(i, j, 0xfaffea, (0.34 - f * 0.24) * edge);
      else if (b < 0.75 && f < 0.3) P.px(i, j, 0xfaffea, 0.14 * edge);
    }
  }
  return P.flush();
}
function paintGlow(rx, ry, c, amax) {
  const P = new Pix(rx * 2 + 2, ry * 2 + 2);
  P.ell(rx + 1, ry + 1, rx, ry, c, amax, 5);
  return P.flush();
}
function paintFlypaper(len) {
  const P = new Pix(6, len + 6);
  P.rect(1, 0, 4, 3, 0xd8c8a0); P.hl(1, 0, 4, 0xf0e0b8); P.vl(2, 3, 1, 0x3a3a30);
  for (let y = 4; y < len + 4; y++) {
    const tw = (y >> 1) & 1;
    P.px(2, y, tw ? 0xd8a838 : 0xb8882a); P.px(3, y, tw ? 0xb8882a : 0xe8b848);
    if (hash(y, len, 201) > 0.72) P.px(2 + (y & 1), y, 0x1a1612);                // fastklistrade flugor
  }
  outline(P, 0x3a2a14, 0.6);
  return P.flush();
}

// ---------- katten Sultan (grå tigré, rivet öra) ----------
const CAT_PAL = { k: 0x2a2630, d: 0x565664, g: 0x8a8a98, G: 0xb4b4c0, w: 0xf0ece4, p: 0xe89aa8, e: 0xc8d040, n: 0xd87a8a };
const CAT_F = {
  // ihopkrupen: huvudet till vänster på tassarna, svansen runt framtill (rivet öra till höger)
  sleep: ['..k...k.........', '.kGk.kGk........', '.kGGkGGGkkkkkk..', 'kGdGdGdGggdgggk.', 'kGkkGkkGgdggdggk', 'kGGwnwGGggdggdgk', '.kwwwwGgggggdggk', '.kddddddddddddk.', '..kkkkkkkkkkkk..'],
  sleep2: ['..k...k.........', '.kGk.kGk........', '.kGGkGGGkkkkkkk.', 'kGdGdGdGggdggggk', 'kGkkGkkGgdggdggk', 'kGGwnwGGggdggdgk', '.kwwwwGgggggdggk', '.kddddddddddGGk.', '..kkkkkkkkkkkk..'],
  // sitter framifrån med svansen runt tassarna
  sit: ['.k.....k...', 'kGk...kGk..', 'kGGkkkGGk..', 'kGdGdGdGk..', 'kGeGGGeGk..', 'kGGwnwGGk..', '.kGwwwGk...', '.kgwwwgk...', 'kggwwwggk..', 'kgdgwgdgk..', 'kggggggggkk', 'kgwgggwgkdk', '.kkkkkkkkk.'],
  // går åt höger (speglas åt vänster)
  walk1: ['............k.k..', '...........kGkGk.', 'kk........kGGGGGk', '.dk.......kGGeGGk', '..dkkkkkkkgGGGnk.', '...kgdgdgdggwwk..', '...kgggggggggk...', '...kgk.kgk.kgk...', '...kk..kk..kk....'],
  walk2: ['............k.k..', '...........kGkGk.', '.k........kGGGGGk', 'kdk.......kGGeGGk', '.kdkkkkkkkgGGGnk.', '...kgdgdgdggwwk..', '...kgggggggggk...', '..kgk..kgkkgk....', '..kk...kk.kk.....'],
  // sträcker på sig: framtassarna långt fram, baken upp
  stretch: ['k................', 'dk...............', '.dkkkkk..........', '..kgdgdkkkk..k.k.', '..kgggdgdggk.kGkGk', '...kgggggggkkGGGGk', '...kgk.kgggGGeGGk.', '...kgk..kkwwGGnk..', '...kk....kkkkkkk..'],
};
function catSprite(name, flip = false) {
  const rows = CAT_F[name], w = Math.max(...rows.map((r) => r.length)), h = rows.length;
  const P = new Pix(w, h);
  rows.forEach((row, j) => { for (let i = 0; i < row.length; i++) { const c = CAT_PAL[row[i]]; if (c !== undefined) P.px(flip ? w - 1 - i : i, j, c); } });
  return { img: P.flush(), w, h };
}

// ================= figurer =================
function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
// expediten: trött nattvakt i stickad kofta, mössa och läsglasögon
const CLERK = { skin: '#c68a5c', hair: '#1d1714', style: 'short', hat: 'beanie', cap: '#d8a02a', top: 'jacket', shirt: '#2e6a56', accent: '#e8e0d0', bottom: 'pants', pants: '#2b2b30', shoes: '#1c1c1c', glasses: 'square', beard: 'mustache', phones: false, bag: null, build: 6, blush: false, kid: false };
const npcLook = (seed) => { const L = makeLook(rng(seed)); return { ...L, kid: false, build: L.build === 4 ? 5 : L.build, bag: null }; };

const CLERK_LINES = [$t('Lysröret? Ja, jag vet.'), $t('Kylen surrar. Den har alltid surrat.'), $t('Nudlarna är de bästa i stan.'), $t('Myrornas krig igen.'), $t('Min kusin skickar konserverna.'), $t('Lite dyrare. Men vi har öppet.'), $t('Radion tar bara en kanal.'), $t('Katten ingår inte.')];
const CLERK_NIGHT = [$t('Tredje kaffet i natt.'), $t('Nattpasset är bäst. Tyst.'), $t('Öppet jämt. Även nu.'), $t('Sultan vaktar butiken.')];
const YIELD_LINES = [$t('Efter dig!'), $t('Oj, varsågod.'), $t('Smal gång, va?'), $t('Jag kliver undan.'), $t('Du först!')];
const SQUEEZE_LINES = [$t('Ursäkta!'), $t('Oj, förlåt.'), $t('Jag drar in magen.'), $t('Trångt, va?')];
const SHOP_LINES = {
  kyl: [$t('Var är mangoläsken?'), $t('Så många färger...'), $t('Aloe med bitar!')],
  nudlar: [$t('Sista nudlarna!'), $t('Den starka sorten.')],
  konserv: [$t('Konstig burk... ett öga?'), $t('Vad är det här?')],
  frys: [$t('Hej katten!'), $t('Flytta dig lite, katten.')],
  annat: [$t('Finns det kardemumma?'), $t('Var är tandkrämen?'), $t('Trångt, men allt finns.')],
};
const linesAt = (x, y) => (y < 90 && x >= FRIDGE.x0 ? SHOP_LINES.kyl : y > 180 && x < 90 ? SHOP_LINES.frys : laneOf(x, y) === 2 && x < 330 ? SHOP_LINES.nudlar : laneOf(x, y) === 2 && x > 480 ? SHOP_LINES.konserv : SHOP_LINES.annat);

// en dörrklocka som plingar (egna toner – ingen av de vanliga passar)
function bell() {
  if (isMuted()) return;
  try {
    const c = audioContext();
    if (!c) return;
    const t0 = c.currentTime;
    for (const [f, at, v] of [[1568, 0, 0.05], [3136, 0.004, 0.012], [1245, 0.17, 0.045], [2490, 0.174, 0.01]]) {
      const o = c.createOscillator(), g = c.createGain();
      o.type = 'sine'; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t0 + at); g.gain.exponentialRampToValueAtTime(v, t0 + at + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t0 + at + 1.1);
      o.connect(g); g.connect(c.destination); o.start(t0 + at); o.stop(t0 + at + 1.15);
    }
  } catch { /* ljud är aldrig ett krav */ }
}
// lysröret som tänds igen: ett litet surr
function buzz() {
  if (isMuted()) return;
  try {
    const c = audioContext();
    if (!c) return;
    const t0 = c.currentTime, o = c.createOscillator(), g = c.createGain();
    o.type = 'sawtooth'; o.frequency.value = 100;
    g.gain.setValueAtTime(0.012, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.12);
    o.connect(g); g.connect(c.destination); o.start(t0); o.stop(t0 + 0.14);
  } catch { /* ok */ }
}

// ================= förmålade bilder (per dag/natt) =================
let ART = null;
function art() {
  if (ART) return ART;
  const displays = layoutFood();
  ART = {
    displays,
    bgDay: null, bgNight: null,
    gondolas: GONDOLAS.map((G, i) => paintGondola(G, i, displays)),
    counter: paintCounter(),
    freezer: paintFreezer(displays),
    pallet: paintPallet(),
    boxes: BOXES.map((B, i) => paintBoxes(B, i)),
    mop: paintMop(),
    atm: paintAtm(),
    baskets: paintBaskets(),
    crates: paintCrates(),
    spinner: [0, 1, 2, 3].map((k) => paintSpinner(k)),
    bread: paintBread(),
    cooler: paintCooler(),
    soda: paintSoda(),
    glass: paintGlass(),
    news: paintNews(),
    lott: paintLott(),
    tubeOn: paintTube(true), tubeBrokenOn: paintTube(true, true), tubeBrokenOff: paintTube(false, true),
    tubeGlow: paintGlow(40, 13, 0xf8fff0, 0.26),
    halo: paintGlow(26, 9, 0xfcfff4, 0.7),
    cone: paintCone(CH - 8),
    coolerGlow: paintGlow(16, 22, 0xa0ff80, 0.18),
    // hål i mörkret (ljusmasken): där lamporna lyser
    holeTube: paintGlow(66, 44, 0x000000, 1),
    holeWide: paintGlow(150, 30, 0x000000, 1),
    holeCeil: paintGlow(50, 30, 0x000000, 1),
    holeSmall: paintGlow(26, 20, 0x000000, 1),
    dark: paintGlow(DARK.rx, DARK.ry, 0x04061a, 0.74),
    tvGlow: paintGlow(20, 14, 0xb8d0ff, 0.22),
    heat: paintGlow(14, 8, 0xff8030, 0.3),
    fridgeGlow: paintGlow(34, 12, 0xd8f0ff, 0.2),
    neon: paintGlow(26, 10, 0xff3040, 0.3),
    flypaper: FLYPAPER.map((f) => paintFlypaper(f.len)),
    tags: displays.map((s, i) => paintTag(s.f, s.idx ?? i)),
    cat: Object.fromEntries(Object.keys(CAT_F).flatMap((k) => [[k, catSprite(k)], [k + 'L', catSprite(k, true)]])),
    noise: Array.from({ length: 6 }, (_, k) => { // myrornas krig
      const P = new Pix(16, 14);
      for (let y = 0; y < 14; y++) for (let x = 0; x < 16; x++) { const v = hash(x, y, 500 + k); P.px(x, y, v > 0.5 ? mix(0x8a8a90, 0xf0f0f4, (v - 0.5) * 2) : mix(0x1a1a22, 0x6a6a70, v * 2)); }
      return P.flush();
    }),
  };
  return ART;
}
const bgOf = (R, night) => (night ? (R.bgNight ||= paintBackground(R.displays, true)) : (R.bgDay ||= paintBackground(R.displays, false)));

// ================= scenen =================
export function makeShopNarbutik(A) {
  const g = A.game;
  const R = art();
  const talk = createSpeech();      // mina egna tankar och tips
  const talkExp = createSpeech();   // expediten
  const talkCat = createSpeech();   // katten
  const walker = createWalker({ W, H, left: SIDE + 4, right: W - SIDE - 4, top: WALL_Y + 4, bottom: FRONT_Y - 3, spawn: [DOOR_X, FRONT_Y - 8] });
  walker.speed = 70;
  walker.setObstacles(OBST);
  walker.snapFree();
  walker.dir = 'up';

  let t = 0, lockedCam = null, hoverId = null, hoverT = -9, lastHint = -9;
  let basket = [], hasBasket = false, bag = false;
  let scan = null;          // pågående inslag vid disken: { items, i, t, total, shown, done, doneT }
  let receiptOpen = false;
  let door = 0, doorWas = false, bellT = -9;
  let panelHits = [], panelSide = 'left';
  let radioCh = 0, radioT = 0, curtSway = 0;
  let expState = { mode: 'idle', t: 4, dir: 'down', said: -9 };
  let pendingHello = 0.6;
  const flies = [], pops = [], notes = [];
  const fridgeOpen = new Array(FRIDGE.n).fill(0); // hur öppen varje kyldörr är (0–1)
  const fridgeHold = new Array(FRIDGE.n).fill(-9);
  const cam = { x: 0, y: 0 };
  const hour = () => (g.min / 60) % 24;
  const isNight = () => { const h = hour(); return h >= 21 || h < 6; };
  const camTarget = () => lockedCam || { x: clamp(walker.px - VW / 2, 0, W - VW), y: clamp(walker.py - VH * 0.62, 0, H - VH) };
  Object.assign(cam, camTarget());

  // ---------- lysröret som blinkar ----------
  // Oregelbundet men skonsamt: varje läge i en skur varar minst TUBE_MIN s och röret
  // slocknar högst tre gånger per sekund (under 3 Hz – snabbare blink kan trigga
  // ljuskänslig epilepsi). Bara själva röret byter läge hårt; ljuset i hörnan (mörkret,
  // ljusmaskens hål och ljuspölen) tonar över TUBE_FADE s via tube.lvl.
  const TUBE_MIN = 0.16, TUBE_FADE = 0.28;
  const tube = { on: true, t: 2.5, burst: 0, forced: null, offT: 0, flash: 0, lvl: 1, offs: [] };
  const recentOffs = () => tube.offs.filter((x) => t - x < 1.05).length;
  function updateTube(dt) {
    if (tube.forced) { tube.on = tube.forced === 'on'; tube.lvl = tube.on ? 1 : 0; tube.flash = 0; return; }
    const was = tube.on;
    tube.t -= dt;
    if (!tube.on) tube.offT += dt;
    if (tube.t <= 0) {
      if (tube.burst > 0) {
        tube.burst--;
        let next = tube.burst === 0 ? Math.random() < 0.6 : !tube.on;
        if (was && !next && recentOffs() >= 3) next = true; // redan tre släckningar den senaste sekunden
        tube.on = next;
        tube.t = tube.burst > 0 ? TUBE_MIN + Math.random() * 0.22
          : tube.on ? 2.5 + Math.random() * (isNight() ? 4 : 7) : 0.6 + Math.random() * 2.4;
      } else if (!tube.on) { tube.burst = 1 + (Math.random() * 4 | 0) * 2; tube.t = 0.05; }
      else { tube.burst = 3 + (Math.random() * 6 | 0); tube.t = 0.05; }
    }
    if (was && !tube.on) { tube.offs.push(t); if (tube.offs.length > 6) tube.offs.shift(); }
    if (tube.on && !was) {
      if (tube.offT > 0.35) { tube.flash = 0.18; if (Math.hypot(walker.px - 530, walker.py - 158) < 170) buzz(); }
      tube.offT = 0;
    }
    tube.flash = Math.max(0, tube.flash - dt);
    const k = dt / TUBE_FADE;
    tube.lvl = clamp(tube.lvl + clamp((tube.on ? 1 : 0) - tube.lvl, -k, k), 0, 1);
  }

  // ---------- katten Sultan ----------
  const catW = createWalker({ W, H, left: SIDE + 4, right: W - SIDE - 4, top: WALL_Y + 4, bottom: FRONT_Y - 3, spawn: CAT_SPOTS.frys.floor });
  catW.setObstacles(OBST); catW.speed = 26;
  const cat = { spot: 'frys', state: 'sleep', t: 0, next: 25 + Math.random() * 30, x: CAT_SPOTS.frys.x, y: CAT_SPOTS.frys.y, fy: CAT_SPOTS.frys.fy, dir: 'right', hop: null, to: null, purr: -9 };
  function catMove(to) {
    if (!CAT_SPOTS[to] || to === cat.spot) return false;
    const from = CAT_SPOTS[cat.spot];
    cat.to = to; cat.state = 'stretch'; cat.t = 0;
    cat.hop = { x0: from.x, y0: from.y, x1: from.floor[0], y1: from.floor[1], k: 0 };
    return true;
  }
  function updateCat(dt) {
    cat.t += dt;
    if (cat.state === 'sleep' || cat.state === 'sit') {
      if (cat.state === 'sit' && cat.t > 2.2) { cat.state = 'sleep'; cat.t = 0; }
      if (cat.state === 'sleep' && cat.t > cat.next) {
        const opts = Object.keys(CAT_SPOTS).filter((k) => k !== cat.spot);
        catMove(opts[Math.floor(Math.random() * opts.length)]);
        cat.next = 30 + Math.random() * 40;
      }
    } else if (cat.state === 'stretch') {
      if (cat.t > 0.9) { cat.state = 'hopdown'; cat.t = 0; }
    } else if (cat.state === 'hopdown' || cat.state === 'hopup') {
      const h = cat.hop, k = Math.min(1, cat.t / 0.4);
      cat.x = h.x0 + (h.x1 - h.x0) * k; cat.y = h.y0 + (h.y1 - h.y0) * k - Math.sin(k * Math.PI) * 8;
      cat.dir = h.x1 >= h.x0 ? 'right' : 'left';
      cat.fy = cat.state === 'hopdown' ? Math.max(CAT_SPOTS[cat.spot].fy, cat.y) : Math.max(CAT_SPOTS[cat.to || cat.spot].fy, cat.y);
      if (k >= 1) {
        if (cat.state === 'hopdown') {
          cat.state = 'walk'; cat.t = 0;
          catW.px = h.x1; catW.py = h.y1; catW.snapFree();
          const dst = CAT_SPOTS[cat.to];
          catW.walkTo(dst.floor[0], dst.floor[1]);
        } else {
          cat.spot = cat.to; cat.to = null; cat.state = 'sit'; cat.t = 0;
          const s = CAT_SPOTS[cat.spot]; cat.x = s.x; cat.y = s.y; cat.fy = s.fy;
        }
      }
    } else if (cat.state === 'walk') {
      catW.update(dt);
      cat.x = catW.px; cat.y = catW.py; cat.fy = catW.py;
      if (catW.dir === 'left' || catW.dir === 'right') cat.dir = catW.dir;
      if (!catW.path.length) {
        const s = CAT_SPOTS[cat.to];
        cat.state = 'hopup'; cat.t = 0;
        cat.hop = { x0: catW.px, y0: catW.py, x1: s.x, y1: s.y, k: 0 };
      }
    }
  }
  function petCat() {
    play('chirp');
    cat.purr = t + 3;
    // bubblan på kattens bortre sida – aldrig rakt ovanför min figur (då ser det ut som att jag spinner)
    const side = walker.px >= cat.x ? -1 : 1;
    const at = () => ({ x: cat.x + side * 12, y: cat.y - 10 });
    if (cat.state === 'sleep') talkCat.say($t('🐈 Mrrr...'), at, 2.5, { animal: 'katt', mood: 'glad' });
    else talkCat.say($t('🐈 Mjau!'), at, 2, { animal: 'katt' });
    expSay($t('Katten ingår inte.'));
  }
  // var jag ställer mig för att klappa katten: bredvid den (frysen, kartongerna) och vänd mot den
  function petSpot() {
    const moving = cat.state === 'walk' || cat.state === 'hopdown' || cat.state === 'hopup';
    const cands = moving
      ? [[cat.x + 14, Math.max(cat.y, catW.py) + 1, 'left'], [cat.x - 14, Math.max(cat.y, catW.py) + 1, 'right']]
      : CAT_SPOTS[cat.spot].pet || [[...CAT_SPOTS[cat.spot].floor, 'up']];
    let best = null, bd = 1e9;
    for (const c of cands) {
      if (!walker.walkable(c[0], c[1])) continue;
      const d = Math.hypot(c[0] - walker.px, c[1] - walker.py);
      if (d < bd) { bd = d; best = c; }
    }
    return best || [cat.x, cat.y + 10, 'up'];
  }
  const catRect = () => {
    const sleeping = cat.state === 'sleep' || cat.state === 'sit';
    return sleeping ? [cat.x - 10, cat.y - 12, cat.x + 10, cat.y + 2] : [cat.x - 10, cat.y - 12, cat.x + 10, cat.y + 3];
  };

  // ---------- expediten ----------
  // syns expediten i bild? Annars pratar han inte (bubblan skulle tryckas in vid
  // vykanten och sväva mitt i butiken, långt från honom)
  const expInView = () => EXP.x + 8 >= cam.x && EXP.x - 8 <= cam.x + VW && EXP.y - 36 <= cam.y + VH && EXP.y >= cam.y;
  function expSay(s, secs, force = false) {
    if (!force && !expInView()) return;
    if (t - expState.said < 1.2 && talkExp.active()) return;
    expState.said = t;
    talkExp.say(s, { x: EXP.x, y: EXP.y - 30 }, secs, { voice: CLERK });
  }
  function updateClerk(dt) {
    const e = expState;
    e.t -= dt;
    if (scan && !scan.done) { e.mode = 'scan'; e.dir = 'down'; return; }
    if (e.mode === 'scan') { e.mode = 'idle'; e.t = 3; }
    if (e.t > 0) return;
    const r = Math.random();
    if (e.mode === 'idle') {
      if (r < 0.4) { e.mode = 'tv'; e.dir = 'left'; e.t = 3 + Math.random() * 4; }
      else if (r < 0.55 && isNight()) { e.mode = 'doze'; e.dir = 'down'; e.t = 5 + Math.random() * 5; if (expInView()) talkExp.say('💤', { x: EXP.x + 4, y: EXP.y - 30 }, 3, { silent: true }); }
      else { e.mode = 'idle'; e.dir = 'down'; e.t = 4 + Math.random() * 5; if (Math.random() < 0.45 && Math.hypot(walker.px - EXP.x, walker.py - EXP.y) < 160) expSay(pickLine()); }
    } else { e.mode = 'idle'; e.dir = 'down'; e.t = 3 + Math.random() * 5; }
  }
  const pickLine = () => { const L = isNight() && Math.random() < 0.55 ? CLERK_NIGHT : CLERK_LINES; return L[Math.floor(Math.random() * L.length)]; };

  // ---------- kunderna ----------
  let npcSeed = (g.day | 0) * 131 + 7;
  const npcs = [0, 1].map((i) => {
    const w = createWalker({ W, H, left: SIDE + 4, right: W - SIDE - 4, top: WALL_Y + 4, bottom: FRONT_Y - 3, spawn: [DOOR_X, FRONT_Y - 6] });
    w.setObstacles(OBST); w.speed = 30 + i * 5;
    return { i, w, baseSpeed: w.speed, look: npcLook(npcSeed + i * 17), state: 'away', t: 1.5 + i * 8, plan: [], goal: null, carry: null, talk: createSpeech(), sq: 0, sqUntil: -9, lineT: -9, yield: null, stuck: 0 };
  });
  const maxNpcs = () => (isNight() ? 1 : 2);
  function spawnNpc(n) {
    n.look = npcLook(npcSeed += 37);
    n.w.px = DOOR_X + (n.i ? 4 : -4); n.w.py = FRONT_Y - 6; n.w.stop(); n.w.dir = 'up'; n.w.speed = n.baseSpeed;
    n.carry = null; n.yield = null;
    const picks = [];
    const pool = BROWSE.slice();
    const k = 1 + Math.floor(Math.random() * 3);
    for (let j = 0; j < k && pool.length; j++) picks.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
    n.plan = [...picks.map(([x, y, dir]) => ({ x, y, dir, kind: 'browse' })), { x: PAY[0], y: PAY[1], dir: 'up', kind: 'pay' }, { x: DOOR_X, y: FRONT_Y - 5, dir: 'down', kind: 'exit' }];
    n.state = 'walk';
    ring();
    nextGoal(n);
  }
  function nextGoal(n) {
    n.goal = n.plan.shift() || null;
    if (!n.goal) { n.state = 'away'; n.t = 6 + Math.random() * 14; return; }
    n.state = 'walk';
    let { x, y } = n.goal;
    if (n.goal.kind === 'pay' && (playerAtPay() || npcs.some((o) => o !== n && o.state === 'pay'))) { x = QUEUE[0]; y = QUEUE[1]; n.goal = { ...n.goal, queue: true }; }
    n.w.walkTo(x, y);
    if (!n.w.path.length) arrive(n);
  }
  const playerAtPay = () => Math.hypot(walker.px - PAY[0], walker.py - PAY[1]) < 12;
  function arrive(n) {
    const G = n.goal;
    if (!G) return nextGoal(n);
    if (G.dir) n.w.dir = G.dir;
    if (G.kind === 'browse') {
      n.state = 'browse'; n.t = 2.5 + Math.random() * 3.5;
      const fd = G.y < 90 && G.x >= FRIDGE.x0 ? Math.floor((G.x - FRIDGE.x0) / FRIDGE.dw) : -1;
      n.fridge = fd;
      if (fd >= 0) fridgeHold[fd] = t + 1.8;
      if (Math.random() < 0.3 && t - n.lineT > 8) { const L = linesAt(G.x, G.y); npcSay(n, L[Math.floor(Math.random() * L.length)]); }
    } else if (G.kind === 'pay') {
      if (G.queue) { n.state = 'queue'; n.t = 0; return; }
      n.state = 'pay'; n.t = 0;
      expSay(isNight() ? $t('Pip. Sent ute?') : $t('Pip. Pip.'));
    } else if (G.kind === 'exit') {
      ring();
      n.state = 'away'; n.t = 8 + Math.random() * 16;
    }
  }
  // pratbubblor som ligger nära varandra skymmer varandra i de smala gångarna:
  // är någon annans bubbla igång alldeles intill väntar man med sin replik
  // (ungefärlig bubbelbredd ur texten – bubblorna är högst 124 px breda och radbryts sen)
  const bubW = (s) => Math.min(124, textW(SM, String(s).toUpperCase().replace(/[^\x20-\x7eÅÄÖÉÜÁÀÂÃÇĆÈÊËÍÌÎÏÑŃÓÒÔÕŚŹŻÚÙÛÜŸÝĄĘŁŒÆ¡¿€$]/g, 'MM')) + 12);
  function talkNear(x, y, except, s = '') {
    const w = bubW(s || 'XXXXXXXXXXXXXXXXXXXXXXXXXX');
    const hit = (ox, oy, os) => !!os && Math.abs(ox - x) < (w + bubW(os)) / 2 + 4 && Math.abs(oy - y) < 30;
    if (except !== 'me' && hit(walker.px, walker.py, talk.text())) return true;
    if (hit(cat.x, cat.y + 22, talkCat.text())) return true;
    return npcs.some((o) => o !== except && o.state !== 'away' && hit(o.w.px, o.w.py, o.talk.text()));
  }
  function npcSay(n, s) {
    if (talkNear(n.w.px, n.w.py, n, s)) return; // repliken är bara krydda – hellre tyst än överlappande
    n.lineT = t;
    n.talk.say(s, () => ({ x: n.w.px, y: n.w.py - 32 + n.sq }), 2.6, { voice: n.look });
  }
  // alla andra figurer i butiken: position och fart i x-led (för möten i gångarna)
  function figures(except) {
    const out = [];
    if (except !== 'me') out.push({ id: 'me', x: walker.px, y: walker.py, vx: walker.path.length ? Math.sign(walker.path[0][0] - walker.px) : 0, moving: walker.path.length > 0 });
    for (const o of npcs) if (o !== except && o.state !== 'away') out.push({ id: o.i, x: o.w.px, y: o.w.py, vx: o.w.path.length ? Math.sign(o.w.path[0][0] - o.w.px) : 0, moving: o.w.path.length > 0, npc: o });
    for (const f of worldFolksHere(A)) out.push({ id: 'f' + f.id, x: f.x, y: f.y, vx: 0, moving: !!f.walking });
    return out;
  }
  const figPos = (id) => {
    if (id === 'me') return { x: walker.px, y: walker.py };
    const n = npcs.find((o) => o.i === id);
    if (n && n.state !== 'away') return { x: n.w.px, y: n.w.py };
    const f = worldFolksHere(A).find((q) => 'f' + q.id === id);
    return f ? { x: f.x, y: f.y } : null;
  };
  // möte i en smal gång: kliv undan i närmaste ficka och vänta tills den andra gått förbi
  function checkMeet(n) {
    const p = n.w.path[0];
    if (!p) return false;
    const dx = p[0] - n.w.px;
    if (Math.abs(dx) < 3) return false;
    const dir = Math.sign(dx), lane = laneOf(n.w.px, n.w.py);
    if (!lane || t < (n.yieldCD || 0)) return false;
    for (const o of figures(n)) {
      const ox = o.x - n.w.px, oy = o.y - n.w.py;
      if (Math.abs(oy) > 11 || ox * dir <= 0 || Math.abs(ox) > 64) continue;
      if (laneOf(o.x, o.y) !== lane) continue;
      if (!o.moving || o.vx === dir) continue;             // står still eller går åt samma håll – då klämmer man sig förbi
      if (o.npc && (o.npc.state === 'yield' || o.npc.state === 'wait')) continue; // den andra kliver redan undan
      const cands = [...(POCKETS[lane] || [])];
      if (lane === 1 && n.w.px >= FRIDGE.x0) cands.push([n.w.px, 75, 'down']);  // tryck dig mot kylen
      if (lane === 3) cands.push([n.w.px, 235, 'up']);                          // eller mot fönstret
      let best = null, bd = 1e9;
      for (const c of cands) {
        const cdx = (c[0] - n.w.px) * dir;
        if (cdx > Math.min(Math.abs(ox) - 10, Math.abs(ox) * 0.35)) continue; // fickan ligger för långt fram – backa hellre
        const d = Math.hypot(c[0] - n.w.px, c[1] - n.w.py);
        if (d > 66 || !n.w.walkable(c[0], c[1])) continue;
        if (d < bd) { bd = d; best = c; }
      }
      if (!best) return false;                               // ingen ficka – då klämmer man sig förbi
      n.yield = { x: best[0], y: best[1], face: best[2], other: o.id, odir: o.vx || -dir, t: 0 };
      n.state = 'yield'; n.w.speed = n.baseSpeed * 1.9; // skynda in i fickan
      n.w.walkTo(best[0], best[1]);
      if (t - n.lineT > 3) npcSay(n, YIELD_LINES[Math.floor(Math.random() * YIELD_LINES.length)]);
      return true;
    }
    return false;
  }
  function updateNpc(n, dt) {
    // tryck dig mot hyllan när någon klämmer sig förbi
    n.sq += ((t < n.sqUntil ? -6 : 0) - n.sq) * Math.min(1, dt * 10); // tryck dig mot hyllan (6 px bakåt)
    if (n.state === 'away') {
      n.t -= dt;
      if (n.t <= 0) { if (npcs.filter((o) => o.state !== 'away').length < maxNpcs()) spawnNpc(n); else n.t = 5; }
      return;
    }
    n.w.update(dt);
    if (n.state === 'walk') {
      if (checkMeet(n)) return;
      if (!n.w.path.length) arrive(n);
    } else if (n.state === 'yield') {
      n.yield.t += dt;
      if (!n.w.path.length) { n.state = 'wait'; n.w.dir = n.yield.face; n.t = 0; n.w.speed = n.baseSpeed; }
    } else if (n.state === 'wait') {
      n.t += dt;
      const o = figures(n).find((f) => f.id === n.yield.other);
      if (o && !o.moving) n.yield.still = (n.yield.still || 0) + dt; else n.yield.still = 0;
      const passed = !o || Math.hypot(o.x - n.w.px, o.y - n.w.py) > 44 || (o.x - n.w.px) * n.yield.odir > 16 || n.yield.still > 1.2 || n.t > 5;
      if (passed && n.t > 0.6) { n.state = 'walk'; n.yield = null; n.yieldCD = t + 3; n.w.walkTo(n.goal.x, n.goal.y); if (!n.w.path.length) arrive(n); }
    } else if (n.state === 'browse') {
      n.t -= dt;
      if (n.t <= 0) { n.carry = n.carry || 'basket'; nextGoal(n); }
    } else if (n.state === 'queue') {
      n.t += dt;
      if (!playerAtPay() && !npcs.some((o) => o !== n && o.state === 'pay')) { n.goal = { x: PAY[0], y: PAY[1], dir: 'up', kind: 'pay' }; n.state = 'walk'; n.w.walkTo(PAY[0], PAY[1]); }
      else if (n.t > 14) nextGoal(n);
    } else if (n.state === 'pay') {
      n.t += dt;
      if (n.t > 2.4 && n.carry !== 'bag') { n.carry = 'bag'; expSay('Tack. Kvitto? Nej.'); play('coin'); }
      if (n.t > 3.4) nextGoal(n);
    }
    // klämma sig förbi: någon i rörelse precis intill i samma gång
    if (n.state === 'browse' || n.state === 'walk' || n.state === 'queue') {
      for (const o of figures(n)) {
        if (!o.moving) continue;
        if (Math.abs(o.x - n.w.px) < 11 && Math.abs(o.y - n.w.py) < 9) {
          if (t > n.sqUntil) { if (t - n.lineT > 6) npcSay(n, SQUEEZE_LINES[Math.floor(Math.random() * SQUEEZE_LINES.length)]); }
          n.sqUntil = t + 0.7;
        }
      }
    }
  }
  function ring() {
    if (t - bellT < 0.5) return;
    bellT = t; bell();
  }

  // ---------- korgen ----------
  const total = () => basket.reduce((s, id) => s + (foodOf(id) ? narPrice(foodOf(id)) : 0), 0);
  const groups = () => {
    const m = new Map();
    for (const id of basket) m.set(id, (m.get(id) || 0) + 1);
    return [...m].map(([id, n]) => ({ f: foodOf(id), n })).filter((x) => x.f);
  };
  function removeOne(id) { const i = basket.lastIndexOf(id); if (i >= 0) basket.splice(i, 1); }
  function addToBasket(s) {
    if (basket.length >= MAX_BASKET) { play('fel'); toast($t('🧺 Korgen är full – gå till disken och betala!'), 'bad'); return false; }
    if (scan) cancelScan();
    const first = !hasBasket;
    hasBasket = true; bag = false;
    basket.push(s.f.id);
    play('ok');
    flies.push({ id: s.f.id, x0: s.tag[0], y0: s.tag[1] + 8, t: 0 });
    pops.push({ x: s.tag[0], y: s.tag[1] - 2, s: '+1', t: 0 });
    if (s.d.kind === 'fridge') fridgeHold[s.d.door] = t + 1.2;
    if (first) toast($t`🧺 ${s.f.icon} ${s.f.name} i korgen! Betala vid disken när du handlat klart.`, 'good');
    return true;
  }

  // ---------- disken ----------
  function startScan() {
    if (!basket.length) { expSay($t('Plocka först, betala sen.')); hint($t('🧺 Korgen är tom – klicka på en vara med neonlapp.')); return; }
    scan = { items: [...basket], i: 0, t: -0.3, total: 0, shown: [], done: false, doneT: 0, flash: 0 };
    expSay(isNight() ? $t('Pip, pip. Sent ute, va?') : $t('Pip, pip.'));
    play('click');
  }
  function cancelScan() { scan = null; receiptOpen = false; }
  function pay() {
    const sum = total();
    if (!basket.length) return { ok: false, paid: 0, n: 0, left: 0, msg: 'Korgen är tom.' };
    if (g.money < sum) {
      play('fel');
      toast($t`💸 Pengarna räcker inte! Du har ${fmt(g.money)} men varorna kostar ${fmt(sum)}.`, 'bad');
      return { ok: false, paid: 0, n: 0, left: basket.length, msg: 'Du har inte råd!' };
    }
    let paid = 0, n = 0;
    const left = [];
    for (const id of basket) {
      const f = foodOf(id);
      if (!f) continue;
      const price = narPrice(f);
      if (g.money < price) { left.push(id); continue; }
      const r = g.buyFood(id);                     // Stormarknadens pris + varan i kylskåpet …
      if (r.ok) { g.money -= price - f.price; paid += price; n++; } // … och närbutikens påslag
      else left.push(id);
    }
    g.save();
    basket = left;
    scan = null; receiptOpen = false;
    if (n) {
      play('buy'); bag = true; hasBasket = !!left.length;
      expSay(isNight() ? $t('Tack. Sov gott sen.') : $t('Tack. Kvitto? Nej. Hej då.'));
      toast(n === 1 ? $t`🧾 Betalt ${fmt(paid)} – ${n} vara ligger nu i kylskåpet där hemma!` : $t`🧾 Betalt ${fmt(paid)} – ${n} varor ligger nu i kylskåpet där hemma!`, 'good');
    }
    if (left.length) { play('fel'); toast($t`💸 Pengarna räckte inte till allt – ${left.length} kvar i korgen.`, 'bad'); }
    return { ok: !left.length, paid, n, left: left.length };
  }
  function openReceipt() {
    const gs = groups(), sum = total(), afford = g.money >= sum;
    const ord = basket.reduce((s, id) => s + (foodOf(id)?.price || 0), 0);
    receiptOpen = true;
    const rows = gs.map(({ f, n }) => `<div class="prow shoprow">
        <span style="font-size:28px;text-align:center">${f.icon}</span>
        <span class="nm">${esc(f.name)} × ${n}<br><small class="sp">${$t`${fmt(narPrice(f))}/st · Stormarknaden ${fmt(f.price)} · +${f.fill} mätthet`}</small></span>
        <b style="font-size:var(--f2)">${fmt(narPrice(f) * n)}</b>
        <button class="btn btn-small" data-back="${esc(f.id)}" title="${$t('Lägg tillbaka en')}">${$t('↩ Lägg tillbaka')}</button>
      </div>`).join('');
    const body = `<p style="font-size:var(--f2);margin-top:0">${$t`Expediten har slagit in allt bakom plexiglaset. 💰 Du har <b>${fmt(g.money)}</b>.`}</p>
      <p style="font-size:var(--f1);margin:0 0 6px;opacity:.85">${$t`🏪 <b>ALLTID ÖPPET · LITE DYRARE</b> – allt kostar 20 % mer än på Stormarknaden (där hade det blivit ${fmt(ord)}).`}</p>
      <div class="plist">${rows}</div>
      <p style="font-size:var(--f3);display:flex;justify-content:space-between;border-top:3px dashed var(--ink);padding-top:8px;margin-bottom:6px"><span>${$t('SUMMA')}</span><b>${fmt(sum)}</b></p>
      ${afford ? `<p style="font-size:var(--f2);margin:0">${$t`Maten hamnar i kylskåpet där hemma. Efter köpet har du ${fmt(g.money - sum)} kvar.`}</p>`
        : `<p class="bad" style="font-size:var(--f2);margin:0">${$t`<b>⚠️ Pengarna räcker inte!</b> Du har ${fmt(g.money)} – det fattas <b>${fmt(sum - g.money)}</b>. Lägg tillbaka något.`}</p>`}`;
    if (!afford) play('fel');
    const dlg = openModal($t('🧾 Disken – Närbutiken 24/7'), body, [
      { label: $t('Avbryt'), onClick: () => { closeModal(); cancelScan(); } },
      { label: $t`💳 Betala ${fmt(sum)}`, cls: 'btn-go', disabled: !afford, onClick: () => { closeModal(); pay(); } },
    ]);
    dlg.querySelectorAll('[data-back]').forEach((b) => (b.onclick = () => {
      removeOne(b.dataset.back);
      play('click');
      if (basket.length) { scan = { items: [...basket], i: basket.length, t: 0, total: total(), shown: [], done: true, doneT: 1, flash: 0 }; openReceipt(); }
      else { closeModal(); cancelScan(); hasBasket = true; toast($t('🧺 Korgen är tom igen.')); }
    }));
  }
  function goPay() {
    walker.walkTo(PAY[0], PAY[1], () => { walker.dir = 'up'; startScan(); });
  }

  // ---------- gå ut ----------
  function exit() {
    if (basket.length) {
      openModal($t('🧺 Obetalda varor'), `<p style="font-size:var(--f2);margin-top:0">${basket.length === 1 ? $t`Du har <b>${basket.length}</b> vara i korgen som inte är betalda (${fmt(total())}).` : $t`Du har <b>${basket.length}</b> varor i korgen som inte är betalda (${fmt(total())}).`}</p>
        <p style="font-size:var(--f2)">${$t('Betala vid disken – eller ställ tillbaka allt innan du går. Expediten ser allt i den runda spegeln.')}</p>`, [
        { label: $t('↩ Ställ tillbaka allt och gå'), onClick: () => { closeModal(); basket = []; scan = null; leave(); } },
        { label: $t('🧾 Till disken'), cls: 'btn-go', onClick: () => { closeModal(); goPay(); } },
      ]);
      return;
    }
    leave();
  }
  function leave() { ring(); play('door'); A.go('city'); }

  // ---------- skraplotterna (lotter-stället vid disken) ----------
  // Lotten ligger uppe över bilden medan man skrapar (ticket); allt om regler, slump och
  // sparfältet g.lott finns i js/scenes/skraplott.js.
  let ticket = null, lottSpark = -9;
  const LOTT_RELEASE = ['pointerup', 'pointercancel', 'blur'];
  const releaseLott = () => { ticket?.up(); };
  const pickOne = (L) => L[Math.floor(Math.random() * L.length)];
  function offerLott() {
    const L = lottOf(g);
    if (L.open) { showTicket(); return; } // en lott som inte är färdigskrapad
    const left = lottLeft(g);
    if (!left) { expSay($t('Rullen är slut. Kom i morgon.')); hint($t('🍀 Slut på lotter för i dag.')); return; }
    openModal($t('🍀 Lyckoskrap'), `<p style="font-size:var(--f2);margin-top:0">${$t`En skraplott kostar <b>${LOTT_PRIS} kr</b>. Skrapa fram sex belopp – <b>tre lika</b> och du vinner beloppet: 100, 500 eller 1 000 kr!`}</p>
      <p style="font-size:var(--f2);margin:0">${$t`De flesta lotter är nitlotter – det är liten chans att vinna. 💰 Du har <b>${fmt(g.money)}</b>`} · ${left === 1 ? $t`${left} lott kvar på rullen i dag (högst ${LOTT_PER_DAG}).` : $t`${left} lotter kvar på rullen i dag (högst ${LOTT_PER_DAG}).`}</p>`, [
      { label: $t('Nej tack'), onClick: closeModal },
      { label: $t`🍀 Köp en lott – ${LOTT_PRIS} kr`, cls: 'btn-go', disabled: g.money < LOTT_PRIS, onClick: () => { closeModal(); buyAndShow(); } },
    ]);
  }
  function buyAndShow() {
    const r = buyLott(g);
    if (!r.ok) { play('fel'); toast('🍀 ' + r.msg, 'bad'); if (r.open) showTicket(); return r; }
    play('coin');
    expSay(pickOne([$t('Lycka till.'), $t('Skrapa försiktigt.'), $t('Min kusin vann en gång. Tror jag.')]), undefined, true);
    showTicket();
    return r;
  }
  function showTicket() {
    const o = lottOf(g).open;
    if (!o) return false;
    walker.stop();
    if (scan) cancelScan();
    ticket = createTicket(o, {
      onScratch: scratchSound,
      onDone: () => {
        const r = settleLott(g);
        if (r.prize) {
          play('fanfare');
          toast($t`🍀 VINST! Tre lika – ${fmt(r.prize)} i fickan!`, 'good');
          expSay(r.prize >= 1000 ? $t('TUSEN?! Jag sa ju det. Min kusin...') : $t('Grattis! Det händer inte ofta.'), undefined, true);
          pops.push({ x: walker.px, y: walker.py - 50, s: `+${r.prize}`, t: 0 });
        } else {
          play('miss');
          expSay(pickOne([$t('Nästa gång kanske.'), $t('Nitlott. Som vanligt.'), $t('Ingen tur i dag.')]), undefined, true);
        }
        return r;
      },
      canMore: () => !lottOf(g).open && lottLeft(g) > 0 && g.money >= LOTT_PRIS,
      onMore: () => { ticket = null; play('click'); buyAndShow(); },
      onClose: () => { ticket = null; play('click'); },
    });
    return true;
  }
  // skrapljud: kort brus som låter som ett mynt mot silver
  function scratchSound() {
    if (isMuted()) return;
    try {
      const c = audioContext();
      if (!c) return;
      const len = Math.floor(c.sampleRate * 0.06), b = c.createBuffer(1, len, c.sampleRate), d = b.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const s = c.createBufferSource(), f = c.createBiquadFilter(), gn = c.createGain();
      s.buffer = b; f.type = 'bandpass'; f.frequency.value = 2400 + Math.random() * 1600; f.Q.value = 1.3; gn.gain.value = 0.05;
      s.connect(f); f.connect(gn); gn.connect(c.destination); s.start();
    } catch { /* ljud är aldrig ett krav */ }
  }
  // en gnista på stället då och då (klövern blänker)
  function liveLott(ctx) {
    if (t - lottSpark > 2.6) lottSpark = t + Math.random() * 1.5;
    const k = t - lottSpark;
    if (k >= 0 && k < 0.3) {
      const x = LOTT.x1 - 4, y = LOTT.top + 3;
      ctx.fillStyle = '#ffffff'; ctx.fillRect(x, y, 1, 1);
      if (k < 0.15) { ctx.fillRect(x - 1, y, 3, 1); ctx.fillRect(x, y - 1, 1, 3); }
    }
  }

  // ---------- klickbara platser ----------
  // mina egna tankar: pratar en kund alldeles intill väntar tanken tills kundens bubbla är klar
  let pendingHint = null;
  const sayHint = (s) => talk.say(s, () => ({ x: walker.px, y: walker.py - 32 }), undefined, { voice: 'self' });
  const hint = (s) => {
    if (t - lastHint < 2.2) return;
    lastHint = t; play('click');
    if (talkNear(walker.px, walker.py, 'me', s)) pendingHint = { s, until: t + 4 };
    else { pendingHint = null; sayHint(s); }
  };
  function updateHint() {
    if (!pendingHint) return;
    if (t > pendingHint.until) pendingHint = null;
    else if (!talkNear(walker.px, walker.py, 'me', pendingHint.s)) { sayHint(pendingHint.s); pendingHint = null; }
  }
  const LOOK = $t('Bara att titta på – varorna med neonlapp kan jag köpa.');
  const GLINES = {
    nudlar: $t('🍜 Nudlar i alla färger. Etiketterna går inte att läsa.'),
    snacks: $t('🥨 Chips som smakar räkor, gurka eller något lila. '),
    konserv: $t('🥫 Konstiga konserver. En har ett öga på etiketten.'),
    kryddor: $t('🌶️ Det luktar kardemumma och lysrörsdamm.'),
    te: $t('🍵 Te i askar med guldkant och dadlar i plast.'),
    hushall: $t('🧻 Batterier, värmeljus och toapapper i bal.'),
  };
  const spots = [
    { id: 'lotter', r: [LOTT.x0 - 2, LOTT.top - 2, LOTT.x1 + 2, LOTT.base], go: [127, 137], act: () => { walker.dir = 'up'; offerLott(); } },
    ...R.displays.map((s) => ({ id: s.f.id, food: s, r: s.r, go: s.go, act: () => addToBasket(s) })),
    { id: 'disk', r: [CNT.x0 + 20, PLEX.top - 4, GRILL.x0 - 2, CNT.base], go: PAY, act: () => { walker.dir = 'up'; startScan(); } },
    { id: 'dorr', r: [DOOR.x0 - 6, FRONT_Y - 12, DOOR.x1 + 6, H], go: [DOOR_X, FRONT_Y - 5], act: exit },
    { id: 'tv', r: [TV.x0, TV.y0 - 6, TV.x1, TV.y1 + 6], go: [44, 137], act: () => { expSay($t('Myrornas krig. Bästa programmet.')); } },
    { id: 'frukt', r: [CRATES.x0, CRATES.base - 30, CRATES.x1, CRATES.base], go: [58, 214], act: () => hint($t('🥭 Mango och granatäpplen från värmen. Doftar semester.')) },
    { id: 'snurr', r: [SPIN.x0 - 4, SPIN.base - 42, SPIN.x1 + 4, SPIN.base], go: [141, 188], act: () => hint($t('🕶️ Solglasögon för 49 kr. Snurrstället gnisslar.')) },
    { id: 'brod', r: [BREAD.x0, BREAD.base - 34, BREAD.x1, BREAD.base], go: [34, 146], act: () => hint($t('🫓 Tunnbröd i påsar med guldtryck.')) },
    { id: 'energikyl', r: [COOLER.x0, COOLER.base - 46, COOLER.x1, COOLER.base], go: [158, 124], act: () => hint($t('⚡ Energidryck med en blixt på. Surrar mer än lysrören.')) },
    { id: 'glassbox', r: [GLASS.x0, GLASS.top - 4, GLASS.x1, GLASS.base], go: [103, 184], act: () => hint($t('🍦 Glass med smaker jag aldrig hört talas om. Bara att titta på.')) },
    { id: 'tidningar', r: [NEWS.x0, NEWS.base - 22, NEWS.x1, NEWS.base], go: [138, 214], act: () => hint($t('📰 Tidningar från hela världen. Jag kan inte läsa en enda.')) },
    { id: 'backar', r: [SODA.x0, SODA.base - 26, SODA.x1, SODA.base], go: [568, 186], act: () => hint($t('🧃 Läskbackar som väntar på att bli pant.')) },
    { id: 'radio', r: [RADIO.x0, 76, RADIO.x0 + 26, CNT.base], go: [36, 137], act: () => { radioCh = (radioCh + 1) % 3; radioT = t; play('slide'); expSay(radioCh === 0 ? $t('Radion tar bara en kanal.') : radioCh === 1 ? $t('Den kanalen brusar.') : $t('Tillbaka till min kanal.')); } },
    { id: 'ridan', r: [CURT.x0 - 2, CURT.top - 10, CURT.x1 + 2, WALL_Y], go: [120, 137], act: () => { curtSway = 1; hint($t('🚪 PERSONAL – pärlridån rasslar. Där bakom bor kartongerna.')); } },
    { id: 'korgar', r: [BASKETS.x0 - 2, BASKETS.base - 20, BASKETS.x1 + 2, BASKETS.base + 2], go: [193, 224], act: () => { if (!hasBasket) { hasBasket = true; play('ok'); hint($t('🧺 En grön korg. Nu handlar vi.')); } else hint($t('🧺 Jag har redan en korg.')); } },
    { id: 'atm', r: [ATM.x0, ATM.base - 30, ATM.x1, ATM.base], go: [34, 226], act: () => hint($t('🏧 UTTAG – UR FUNKTION. Lappen har gulnat.')) },
    { id: 'mopp', r: [MOP.x - 12, MOP.base - 44, MOP.x + 12, MOP.base + 2], go: [574, 226], act: () => hint($t('🪣 Moppvattnet är grått. Golvet har sett bättre dagar.')) },
    { id: 'pall', r: [PALLET.x0, PALLET.base - 26, PALLET.x1, PALLET.base], go: [(PALLET.x0 + PALLET.x1) / 2, PALLET.base + 10], act: () => hint($t('💧 Vatten i sexpack. Bara att titta på.')) },
    ...BOXES.map((B, i) => ({ id: 'kartong' + i, r: [B.x0, B.base - B.d - 20, B.x1, B.base], go: null, row: B.base, act: () => hint($t('📦 Kartonger som ingen packat upp. Jag kliver runt.')) })),
    { id: 'sackar', r: [SACKS.x0, 36, SACKS.x1, SACKS.base], go: null, row: SACKS.base - 2, act: () => hint($t('🍚 Ris i 25-kilossäckar och kryddor att skopa själv.')) },
    { id: 'vagghylla', r: [WSHELF.x0, CEIL, WSHELF.x1, WSHELF.base], go: null, row: WSHELF.base, act: () => hint($t('🫒 Oljedunkar och tekannor ända upp till taket.')) },
    ...Array.from({ length: FRIDGE.n }, (_, d) => ({ id: 'kyl' + d, r: [FRIDGE.x0 + d * FRIDGE.dw, FRIDGE.top, FRIDGE.x0 + (d + 1) * FRIDGE.dw, WALL_Y + 4], go: [FRIDGE.x0 + d * FRIDGE.dw + FRIDGE.dw / 2, 82], act: () => { fridgeHold[d] = t + 1.4; play('click'); hint($t('🥤 Läsk i alla färger.') + ' ' + LOOK); } })),
    // hyllans klickyta = dess framsida (hindret). Kartongerna ovanpå sticker upp över gången
    // bakom – klickar man där vill man gå i gången, inte bli skickad runt till hyllans framsida.
    ...GONDOLAS.map((G, i) => ({ id: 'hylla' + i, r: [G.x0, G.base - GH, G.x1, G.base], go: null, row: G.base, act: () => hint(GLINES[G.cat] || LOOK) })),
  ];
  const spotAt = (x, y) => spots.find((s) => x >= s.r[0] && x <= s.r[2] && y >= s.r[1] && y <= s.r[3]);
  const spotById = (id) => spots.find((s) => s.id === id);
  const focusSpot = () => {
    const h = hoverId && t - hoverT < 4 && spotById(hoverId);
    if (h && (h.food || h.id === 'disk' || h.id === 'dorr' || h.id === 'lotter')) return h;
    if (walker.path.length) return null;
    return spots.find((s) => s.food && Math.abs(walker.px - s.go[0]) < 8 && Math.abs(walker.py - s.go[1]) < 8) || null;
  };
  function clickSpot(s, x) {
    if (s.go) walker.walkTo(s.go[0], s.go[1], () => { walker.dir = 'up'; s.act(); });
    else if (s.row !== undefined) walker.walkTo(clamp(x, s.r[0] + 4, s.r[2] - 4), s.row + 12, () => { walker.dir = 'up'; s.act(); });
    else s.act();
  }

  // ---------- HUD: korgen (panel uppe till vänster) ----------
  function drawPanel(ctx) {
    panelHits = [];
    const gs = groups();
    if (!gs.length && !scan) return;
    const w = 116, y0 = 4 + (globalThis.SF?.view?.safe?.y0 | 0);
    const h = 16 + gs.length * 11 + 34;
    const fx = walker.px - cam.x, fy = walker.py - cam.y;
    const under = (px0) => fx > px0 - 10 && fx < px0 + w + 10 && fy - 40 < y0 + h + 4;
    if (panelSide === 'left' && under(4)) panelSide = 'right';
    else if (panelSide === 'right' && under(VW - 4 - w) && !under(4)) panelSide = 'left';
    const x0 = panelSide === 'left' ? 4 : VW - 4 - w;
    ctx.fillStyle = '#0e0d12'; ctx.fillRect(x0 - 2, y0 - 2, w + 4, h + 4);
    ctx.fillStyle = '#b8323a'; ctx.fillRect(x0 - 1, y0 - 1, w + 2, h + 2);
    ctx.fillStyle = '#f6f1e2'; ctx.fillRect(x0, y0, w, h);
    ctx.fillStyle = '#d8323a'; ctx.fillRect(x0, y0, w, 12);
    ctx.fillStyle = '#ff6a6a'; ctx.fillRect(x0, y0, w, 1);
    drawMiniBasket(ctx, x0 + 3, y0 + 2);
    ctxText(ctx, SM, $t('KORGEN'), x0 + 19, y0 + 4, '#ffffff');
    const cnt = $t`${basket.length} ST`;
    ctxText(ctx, SM, cnt, x0 + w - 4 - textW(SM, cnt), y0 + 4, '#ffe0e0');
    let y = y0 + 15;
    for (const { f, n } of gs) {
      drawIcon(ctx, f.id, x0 + 3, y);
      ctxText(ctx, SM, shortName(f), x0 + 15, y + 2, '#2a2430');
      ctxText(ctx, SM, '×' + n, x0 + 60, y + 2, '#6a6070');
      const pr = priceLbl(narPrice(f) * n);
      ctxText(ctx, SM, pr, x0 + w - 16 - textW(SM, pr), y + 2, '#8a1a10');
      const bx = x0 + w - 11;
      ctx.fillStyle = '#17151a'; ctx.fillRect(bx, y, 9, 9);
      ctx.fillStyle = '#e8dcd0'; ctx.fillRect(bx + 1, y + 1, 7, 7);
      ctx.fillStyle = '#b8323a';
      for (let k = 0; k < 5; k++) { ctx.fillRect(bx + 2 + k, y + 2 + k, 1, 1); ctx.fillRect(bx + 6 - k, y + 2 + k, 1, 1); }
      panelHits.push({ r: [bx - 1, y - 1, bx + 10, y + 10], act: () => { if (scan) cancelScan(); removeOne(f.id); play('click'); } });
      y += 11;
    }
    ctx.fillStyle = '#c8bca8'; ctx.fillRect(x0 + 3, y, w - 6, 1);
    y += 3;
    const sum = total(), afford = g.money >= sum;
    ctxText(ctx, SM, $t('SUMMA'), x0 + 4, y + 2, '#2a2430');
    const st = priceLbl(sum);
    ctxText(ctx, BG, st, x0 + w - 4 - textW(BG, st), y, afford ? '#2a2430' : '#c9323a');
    y += 10;
    const btnTxt = scan ? $t('PIP PIP...') : $t('TILL DISKEN');
    const blink = !scan && Math.floor(t * 2) % 2 === 0;
    ctx.fillStyle = '#17151a'; ctx.fillRect(x0 + 3, y, w - 6, 11);
    ctx.fillStyle = scan ? '#8a909a' : blink ? '#f0c020' : '#e0a818'; ctx.fillRect(x0 + 4, y + 1, w - 8, 9);
    ctx.fillStyle = scan ? '#b8bec8' : '#fff080'; ctx.fillRect(x0 + 4, y + 1, w - 8, 1);
    ctxText(ctx, SM, btnTxt, x0 + Math.round((w - textW(SM, btnTxt)) / 2) - 3, y + 3, '#2a1a10');
    if (!scan) { ctx.fillStyle = '#2a1a10'; for (let k = 0; k < 3; k++) ctx.fillRect(x0 + w - 16 + k, y + 3 + k, 1, 5 - k * 2); }
    if (!scan) panelHits.push({ r: [x0 + 3, y, x0 + w - 3, y + 11], act: () => goPay() });
    y += 13;
    ctxText(ctx, SM, $t`DU HAR ${Math.round(g.money)} KR`, x0 + 4, y, afford ? '#6a6070' : '#c9323a');
  }
  function drawMiniBasket(ctx, x, y) {
    ctx.fillStyle = '#e6ecf0'; ctx.fillRect(x + 4, y, 6, 1); ctx.fillRect(x + 3, y + 1, 1, 2); ctx.fillRect(x + 10, y + 1, 1, 2);
    ctx.fillStyle = '#6ae08a'; ctx.fillRect(x, y + 3, 14, 1);
    ctx.fillStyle = '#2aa84a'; ctx.fillRect(x, y + 4, 14, 3); ctx.fillRect(x + 1, y + 7, 12, 1);
    ctx.fillStyle = '#0e6a2a'; for (let k = 1; k < 13; k += 3) ctx.fillRect(x + k, y + 5, 1, 1);
  }
  // korgen eller påsen i händerna
  function drawCarried(ctx, x, y, items, kind) {
    if (kind === 'bag') { // tunn vit plastpåse med ett rött TACK
      ctx.fillStyle = '#17151a'; ctx.fillRect(x - 6, y - 12, 12, 13);
      ctx.fillStyle = '#f4f4f0'; ctx.fillRect(x - 5, y - 11, 10, 11);
      ctx.fillStyle = '#d8d8d0'; ctx.fillRect(x + 3, y - 11, 2, 11);
      ctx.fillStyle = '#ffffff'; ctx.fillRect(x - 5, y - 11, 1, 11);
      ctx.fillStyle = '#d8202a'; ctx.fillRect(x - 3, y - 7, 1, 3); ctx.fillRect(x - 4, y - 7, 3, 1); ctx.fillRect(x, y - 7, 2, 3); ctx.fillRect(x - 3, y - 3, 5, 1);
      ctx.fillStyle = '#17151a'; ctx.fillRect(x - 4, y - 14, 2, 3); ctx.fillRect(x + 2, y - 14, 2, 3);
      return;
    }
    const COL = { nudlar: '#d8323a', macka: '#e0a858', korv: '#b84a2a', pizza: '#e07a2e', lyx: '#2a2a30' };
    items.slice(-4).forEach((id, i) => {
      ctx.fillStyle = '#17151a'; ctx.fillRect(x - 6 + i * 3, y - 11 - (i % 2), 4, 4);
      ctx.fillStyle = COL[id] || '#3a7bd5'; ctx.fillRect(x - 5 + i * 3, y - 10 - (i % 2), 3, 3);
    });
    ctx.fillStyle = '#17151a'; ctx.fillRect(x - 8, y - 8, 16, 9);
    ctx.fillStyle = '#6ae08a'; ctx.fillRect(x - 7, y - 7, 14, 1);
    ctx.fillStyle = '#2aa84a'; ctx.fillRect(x - 7, y - 6, 14, 5); ctx.fillRect(x - 6, y - 1, 12, 1);
    ctx.fillStyle = '#0e6a2a'; for (let k = -6; k < 7; k += 3) ctx.fillRect(x + k, y - 5, 1, 2);
    ctx.fillStyle = '#e6ecf0'; ctx.fillRect(x - 4, y - 11, 8, 1); ctx.fillStyle = '#8e98a2'; ctx.fillRect(x - 5, y - 10, 1, 2); ctx.fillRect(x + 4, y - 10, 1, 2);
  }

  // ---------- namnskylt för det man står vid / pekar på ----------
  function bigLabel(ctx, s, atTop) {
    let icon = null, name, price, hintTxt, col = '#ffe040';
    if (s.food) {
      const f = s.food.f;
      icon = f.id; name = shortName(f); price = $t`${narPrice(f)} KR`;
      hintTxt = basket.length >= MAX_BASKET ? $t('KORGEN ÄR FULL') : $t`+${f.fill} MÄTT - KLICKA SÅ HAMNAR DEN I KORGEN`;
    } else if (s.id === 'disk') { name = $t('DISKEN'); price = basket.length ? $t`${total()} KR` : ''; hintTxt = basket.length ? $t('KLICKA SÅ BETALAR DU') : $t('PLOCKA VAROR FÖRST'); col = '#ffa43a'; }
    else if (s.id === 'dorr') { name = $t('UTGÅNG'); price = ''; hintTxt = basket.length ? $t('BETALA FÖRST!') : $t('TILLBAKA UT I FÖRORTEN'); col = '#ffa43a'; }
    else if (s.id === 'lotter') { name = $t('LYCKOSKRAP'); price = $t`${LOTT_PRIS} KR`; hintTxt = lottLeft(g) ? $t('TRE LIKA BELOPP = VINST!') : $t('SLUT PÅ LOTTER I DAG'); col = '#6ae08a'; }
    else return;
    const nw = textW(BG, name), pw = price ? textW(BG, price) : 0, hw = textW(SM, hintTxt);
    const w = Math.max(nw + pw + (price ? 8 : 0) + (icon ? 14 : 0), hw + (icon ? 14 : 0)) + 12, h = 22;
    const x0 = Math.round((VW - w) / 2), y0 = atTop ? 3 : VH - h - 3;
    ctx.fillStyle = '#0e0d12'; ctx.fillRect(x0 - 2, y0 - 2, w + 4, h + 4);
    ctx.fillStyle = col; ctx.fillRect(x0 - 1, y0 - 1, w + 2, h + 2);
    ctx.fillStyle = '#17151a'; ctx.fillRect(x0, y0, w, h);
    let tx = x0 + 6;
    if (icon) { drawIcon(ctx, icon, x0 + 4, y0 + 4); tx = x0 + 17; }
    ctxText(ctx, BG, name, tx, y0 + 3, '#ffffff');
    if (price) ctxText(ctx, BG, price, tx + nw + 8, y0 + 3, col);
    ctxText(ctx, SM, hintTxt, tx, y0 + 14, Math.floor(t * 2) % 2 === 0 ? col : '#c9c2d2');
  }

  // ---------- uppdatering av disken ----------
  function updateScan(dt) {
    if (!scan) return;
    scan.flash = Math.max(0, scan.flash - dt);
    for (const s of scan.shown) s.t += dt;
    if (!scan.done) {
      scan.t += dt;
      if (scan.t > 0.3) {
        scan.t = 0;
        const id = scan.items[scan.i];
        scan.total += foodOf(id) ? narPrice(foodOf(id)) : 0;
        scan.shown.push({ id, t: 0 });
        play('click'); scan.flash = 0.12;
        scan.i++;
        if (scan.i >= scan.items.length) scan.done = true;
      }
    } else if (!receiptOpen) {
      scan.doneT += dt;
      if (scan.doneT > 0.35) openReceipt();
    }
  }

  // ---------- ritning ----------
  function drawWorld(ctx, cx, cy, vw, vh) {
    const night = isNight();
    ctx.drawImage(bgOf(R, night), cx, cy, vw, vh, cx, cy, vw, vh);
    const inView = (x0, y0, x1, y1) => x1 >= cx - 8 && x0 <= cx + vw + 8 && y1 >= cy - 8 && y0 <= cy + vh + 8;
    liveWall(ctx, night);
    floorLights(ctx, night);
    const focus = focusSpot();
    for (const s of R.displays) if (s.d.kind === 'fridge') displayTag(ctx, s, focus);
    const items = [];
    const add = (fy, x0, y0, x1, y1, draw) => { if (inView(x0, y0, x1, y1)) items.push({ fy, draw }); };
    // öppna kyldörrar sticker ut i gång 1
    for (let d = 0; d < FRIDGE.n; d++) if (fridgeOpen[d] > 0.05) add(WALL_Y + 30 * fridgeOpen[d], FRIDGE.x0 + d * FRIDGE.dw - 12, FRIDGE.top, FRIDGE.x0 + (d + 1) * FRIDGE.dw + 12, WALL_Y + 32, () => fridgeDoor(ctx, d));
    // expediten bakom disken
    add(EXP.y, EXP.x - 12, EXP.y - 40, EXP.x + 12, EXP.y, () => {
      const e = expState;
      const frame = e.mode === 'scan' ? 9 : e.mode === 'doze' ? 4 : Math.sin(t * 1.4) > 0.93 ? 4 : 0;
      drawPerson(ctx, EXP.x, EXP.y, CLERK, e.mode === 'tv' ? 'left' : 'down', frame);
    });
    add(CNT.base, CNT.x0 - 2, 60, CNT.x1 + 4, CNT.base + 3, () => { put(ctx, R.counter); liveCounter(ctx); for (const s of R.displays) if (s.d.kind === 'grill') displayTag(ctx, s, focus); });
    add(FRZ.base, FRZ.x0 - 2, 130, FRZ.x1 + 3, FRZ.base + 3, () => { put(ctx, R.freezer); for (const s of R.displays) if (s.d.kind === 'freezer') displayTag(ctx, s, focus); });
    add(PALLET.base, PALLET.x0, PALLET.base - 26, PALLET.x1 + 3, PALLET.base + 3, () => put(ctx, R.pallet));
    BOXES.forEach((B, i) => add(B.base, B.x0 - 2, B.base - 40, B.x1 + 3, B.base + 3, () => put(ctx, R.boxes[i])));
    add(MOP.base, MOP.x - 14, MOP.base - 44, MOP.x + 14, MOP.base + 4, () => put(ctx, R.mop));
    add(ATM.base, ATM.x0 - 2, ATM.base - 30, ATM.x1 + 3, ATM.base + 4, () => put(ctx, R.atm));
    add(BASKETS.base, BASKETS.x0 - 2, BASKETS.base - 18, BASKETS.x1 + 3, BASKETS.base + 4, () => put(ctx, R.baskets));
    add(CRATES.base, CRATES.x0 - 2, CRATES.base - 30, CRATES.x1 + 3, CRATES.base + 4, () => put(ctx, R.crates));
    add(SPIN.base, SPIN.x0 - 5, SPIN.base - 42, SPIN.x1 + 5, SPIN.base + 2, () => put(ctx, R.spinner[Math.floor(t * 1.5) % 4]));
    add(BREAD.base, BREAD.x0 - 2, BREAD.base - 34, BREAD.x1 + 3, BREAD.base + 4, () => put(ctx, R.bread));
    add(COOLER.base, COOLER.x0 - 2, COOLER.base - 46, COOLER.x1 + 3, COOLER.base + 4, () => put(ctx, R.cooler));
    add(SODA.base, SODA.x0 - 2, SODA.base - 26, SODA.x1 + 2, SODA.base + 4, () => put(ctx, R.soda));
    add(GLASS.base, GLASS.x0 - 2, GLASS.top - 4, GLASS.x1 + 3, GLASS.base + 4, () => put(ctx, R.glass));
    add(NEWS.base, NEWS.x0 - 2, NEWS.base - 22, NEWS.x1 + 3, NEWS.base + 4, () => put(ctx, R.news));
    add(LOTT.base, LOTT.x0 - 2, LOTT.top - 2, LOTT.x1 + 3, LOTT.base + 3, () => { put(ctx, R.lott); liveLott(ctx); });
    GONDOLAS.forEach((G, i) => add(G.base, G.x0 - 3, G.base - GH - 22, G.x1 + 3, G.base + 6, () => {
      put(ctx, R.gondolas[i]);
      for (const s of R.displays) if (s.d.kind === 'gondola' && s.d.g === i) displayTag(ctx, s, focus);
    }));
    // katten
    add(cat.fy, cat.x - 10, cat.y - 14, cat.x + 10, cat.y + 2, () => drawCat(ctx));
    // kunderna
    for (const n of npcs) {
      if (n.state === 'away') continue;
      const w = n.w, walking = w.path.length > 0, carry = !!n.carry;
      const frame = n.sq < -1 ? 4 : carry ? (walking ? [7, 9, 8, 9][Math.floor(t * 7) % 4] : 9) : walking ? WALK_SEQ[Math.floor(t * 7) % 4] : Math.sin(t * 2 + w.px) > 0.9 ? 4 : 0;
      const yy = w.py + Math.round(n.sq);
      add(w.py + n.sq, w.px - 12, w.py - 46, w.px + 12, w.py + 2, () => {
        const bx = Math.round(w.px) + (w.dir === 'left' ? -6 : w.dir === 'right' ? 6 : 0), by = Math.round(yy) - 12;
        if (carry && w.dir === 'up') drawCarried(ctx, bx, by, [], n.carry);
        drawPerson(ctx, w.px, yy, n.look, w.dir, frame);
        if (carry && w.dir !== 'up') drawCarried(ctx, bx, by, [], n.carry);
      });
    }
    // andra spelare och jag
    for (const d of folkDrawables(A, t)) items.push({ fy: d.fy, draw: () => d.draw(ctx) });
    const carrying = hasBasket || bag;
    const me = selfDrawable(A, walker, t, { carry: carrying, folksHere: worldFolksHere(A).length });
    const dir = walker.dir, ox = dir === 'left' ? -6 : dir === 'right' ? 6 : 0;
    const bx = Math.round(walker.px) + ox, by = Math.round(walker.py) - 12;
    const shown = scan ? [] : basket, kind = bag && !basket.length ? 'bag' : 'basket';
    if (carrying && dir === 'up') items.push({ fy: walker.py - 0.01, draw: () => drawCarried(ctx, bx, by, shown, kind) });
    items.push({ fy: walker.py, me: true, draw: () => me.draw(ctx) });
    if (carrying && dir !== 'up') items.push({ fy: walker.py + 0.01, draw: () => drawCarried(ctx, bx, by, shown, kind) });
    items.sort((a, b) => a.fy - b.fy);
    for (const it of items) it.draw();
    const ghost = items.find((it) => it.me);
    if (ghost) { ctx.globalAlpha = 0.24; ghost.draw(); ctx.globalAlpha = 1; }
    // ljuset: lysrörens sken och mörkret där det trasiga röret slocknat
    lights(ctx, night);
    // dörren och dörrklockan
    liveFront(ctx, night);
    // flygande varor, +1
    for (const f of flies) {
      const k = Math.min(1, f.t / 0.4), tx = walker.px, ty = walker.py - 24;
      const x = f.x0 + (tx - f.x0) * k, y = f.y0 + (ty - f.y0) * k - Math.sin(k * Math.PI) * 16;
      drawIcon(ctx, f.id, Math.round(x) - 4, Math.round(y) - 4);
    }
    for (const p of pops) ctxText(ctx, BG, p.s, Math.round(p.x) - 5, Math.round(p.y - p.t * 16), p.t < 0.6 || Math.floor(p.t * 10) % 2 ? '#2aba5a' : '#ffffff');
  }
  function drawCat(ctx) {
    const flip = cat.dir === 'left';
    let s;
    if (cat.state === 'sleep') s = R.cat[(Math.floor(t * 0.7) % 2 ? 'sleep2' : 'sleep') + (cat.spot === 'kartong' ? 'L' : '')];
    else if (cat.state === 'sit') s = R.cat.sit;
    else if (cat.state === 'stretch') s = R.cat['stretch' + (flip ? 'L' : '')];
    else s = R.cat[(Math.floor(t * 6) % 2 ? 'walk1' : 'walk2') + (flip ? 'L' : '')];
    const x = Math.round(cat.x - s.w / 2), y = Math.round(cat.y - s.h + 1);
    if (cat.state === 'walk') { ctx.fillStyle = 'rgba(20,12,30,.28)'; ctx.fillRect(Math.round(cat.x) - 5, Math.round(cat.y), 10, 1); }
    ctx.drawImage(s.img, x, y);
    if (cat.state === 'sleep' && t < cat.purr) { // nöjd: små hjärtan
      const ph = (t * 1.2) % 1;
      ctx.fillStyle = '#ff7a9a'; ctx.fillRect(Math.round(cat.x) + 4, Math.round(cat.y - 10 - ph * 6), 1, 1); ctx.fillRect(Math.round(cat.x) + 6, Math.round(cat.y - 10 - ph * 6), 1, 1); ctx.fillRect(Math.round(cat.x) + 5, Math.round(cat.y - 9 - ph * 6), 1, 1);
    } else if (cat.state === 'sleep' && Math.floor(t / 3) % 3 === 0) { // zzz
      const ph = (t % 3) / 3;
      ctxText(ctx, SM, 'Z', Math.round(cat.x) + 3 + Math.round(ph * 3), Math.round(cat.y - 12 - ph * 6), 'rgba(240,240,255,.8)');
    }
  }
  // lysrör, ljuspölar, mörkerzonen, flugpapper, flugor och nattfjärilen
  // ljusmasken: ett tunt mörker över hela butiken med hål där lamporna lyser – på natten
  // tjockare. Släcks det trasiga röret försvinner dess hål och hörnan blir mörk.
  const mask = document.createElement('canvas'); mask.width = W; mask.height = H;
  const mctx = mask.getContext('2d');
  function lightMask(ctx, night) {
    mctx.globalCompositeOperation = 'source-over';
    mctx.clearRect(0, 0, W, H);
    mctx.fillStyle = night ? 'rgba(6,8,28,.55)' : 'rgba(30,36,16,.2)'; // dagtid: sjukt gröngult lysrörsljus i skuggorna
    mctx.fillRect(0, 0, W, H);
    mctx.globalCompositeOperation = 'destination-out';
    const hole = (img, x, y, k) => { mctx.globalAlpha = k; mctx.drawImage(img, Math.round(x - img.width / 2), Math.round(y - img.height / 2)); };
    for (const tb of TUBES) {
      const k = tb.broken ? 0.95 * tube.lvl : 0.95; // det trasiga rörets hål tonar i stället för att blixtra
      if (k > 0.02) hole(R.holeTube, tb.x, tb.yf - 22, k);
    }
    for (const lx of CEIL_LAMPS) hole(R.holeCeil, lx, 38, 0.85);
    hole(R.holeWide, (FRIDGE.x0 + FRIDGE.x1) / 2, 70, 0.8);
    hole(R.holeSmall, (COOLER.x0 + COOLER.x1) / 2, COOLER.base - 16, 0.75);
    hole(R.holeSmall, (TV.x0 + TV.x1) / 2, TV.y1, 0.55);
    hole(R.holeSmall, 70, FRONT_Y + 2, night ? 0.5 : 0.3);
    hole(R.holeSmall, (FRZ.x0 + FRZ.x1) / 2, FRZ.top + 6, 0.45);
    mctx.globalAlpha = 1; mctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(mask, 0, 0);
  }
  // ljuspölar på golvet och ljuskäglor under rören – ritas FÖRE hyllor och figurer, som
  // ljus på golvet (annars lägger sig käglans rutmönster över den som står under röret)
  function floorLights(ctx, night) {
    for (const tb of TUBES) {
      const k = tb.broken ? 0.85 * tube.lvl : night ? 1.1 : 0.9;
      if (k < 0.02) continue;
      ctx.globalAlpha = Math.min(1, k); ctx.drawImage(R.tubeGlow, tb.x - 41, tb.yf - 14);
      ctx.globalAlpha = Math.min(1, k * 0.9); ctx.drawImage(R.cone, tb.x - 39, tb.yf - CH + 7);
    }
    ctx.globalAlpha = 1;
  }
  function lights(ctx, night) {
    lightMask(ctx, night);
    // mörkret när röret är släckt (lite skumt i hörnan även när det lyser – röret är svagt).
    // Tonar med tube.lvl så att hörnan inte blixtrar mellan ljus och mörker.
    const darkA = 0.12 + ((night ? 0.7 : 0.62) - 0.12) * (1 - tube.lvl);
    ctx.globalAlpha = darkA; ctx.drawImage(R.dark, DARK.cx - DARK.rx - 1, DARK.cy - DARK.ry - 1); ctx.globalAlpha = 1;
    // kylväggens och energikylens sken
    ctx.globalAlpha = night ? 0.9 : 0.55;
    for (let d = 0; d < FRIDGE.n; d += 2) ctx.drawImage(R.fridgeGlow, FRIDGE.x0 + d * FRIDGE.dw + FRIDGE.dw - 35, WALL_Y - 4);
    ctx.drawImage(R.coolerGlow, (COOLER.x0 + COOLER.x1) / 2 - 17, COOLER.base - 28);
    ctx.globalAlpha = 1;
    // armaturerna med sitt eget sken
    for (const tb of TUBES) {
      const y = tb.yf - CH - 1, lit = !tb.broken || tube.on;
      const img = tb.broken ? (tube.on ? R.tubeBrokenOn : R.tubeBrokenOff) : R.tubeOn;
      ctx.drawImage(img, tb.x - 17, y);
      if (lit) { ctx.globalAlpha = tb.broken && tube.flash > 0 ? 1 : 0.85; ctx.drawImage(R.halo, tb.x - 27, y - 5); ctx.globalAlpha = 1; }
      if (tb.broken && tube.on && tube.flash > 0) { ctx.fillStyle = 'rgba(255,255,240,.9)'; ctx.fillRect(tb.x - 14, y + 4, 28, 3); }
      if (tb.broken && !tube.on && Math.random() < 0.3) { ctx.fillStyle = '#c8d8ff'; ctx.fillRect(tb.x - 13 + Math.floor(Math.random() * 3), y + 5, 1, 1); } // en gnista i ändarna
      // det trasiga röret surrar: BZZ när det fladdrar eller ligger och glöder i ändarna.
      // Under rörets vänstra ände, med mörk kant – ovanför sitter lappen FRÅGA INTE.
      if (tb.broken && (tube.burst > 0 || tube.flash > 0 || (!tube.on && Math.floor(t * 3) % 3 !== 0))) {
        const j = Math.floor(t * 12) % 2, bx = tb.x - 22 + j, by = y + 9;
        for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [1, 1]]) ctxText(ctx, SM, 'BZZ', bx + ox, by + oy, '#14141e');
        ctxText(ctx, SM, 'BZZ', bx, by, tube.on ? '#fffbd0' : '#c8d0e8');
      }
    }
    // de infällda armaturerna i takkanten lyser ner på bakväggen
    ctx.globalAlpha = 0.6;
    for (const lx of CEIL_LAMPS) ctx.drawImage(R.halo, lx - 27, -4);
    ctx.globalAlpha = 1;
    // flugpapper
    FLYPAPER.forEach((f, i) => { const sw = Math.round(Math.sin(t * 0.8 + i) * 0.6); ctx.drawImage(R.flypaper[i], f.x - 3 + sw, f.yf - CH - 4); });
    // flugor som surrar kring flugpappret och moppen
    ctx.fillStyle = '#1a1612';
    for (let k = 0; k < 5; k++) {
      const [fx, fy] = k < 2 ? [FLYPAPER[0].x, FLYPAPER[0].yf - CH + 10] : k < 4 ? [MOP.x - 6, MOP.base - 20] : [FLYPAPER[1].x, FLYPAPER[1].yf - CH + 8];
      const a = t * (2.3 + k * 0.7) + k * 2;
      ctx.fillRect(Math.round(fx + Math.sin(a) * 9 + Math.sin(a * 2.7) * 3), Math.round(fy + Math.cos(a * 1.3) * 5), 1, 1);
    }
    // nattfjärilen kring lysröret i gång 2
    if (night) {
      const a = t * 3.1, tb = TUBES[3];
      ctx.fillStyle = '#d8c8a8';
      const mx = Math.round(tb.x + Math.sin(a) * 12), my = Math.round(tb.yf - CH - 2 + Math.cos(a * 1.7) * 4);
      ctx.fillRect(mx, my, 1, 1); if (Math.floor(t * 12) % 2) { ctx.fillRect(mx - 1, my - 1, 1, 1); ctx.fillRect(mx + 1, my - 1, 1, 1); }
    }
  }
  // levande detaljer på bakväggen: TV:n, klockan, lyckokatten, pärlridån, kylen, elementet
  function liveWall(ctx, night) {
    // myrornas krig
    const nf = R.noise[Math.floor(t * 14) % R.noise.length];
    ctx.drawImage(nf, TV.x0 + 2, TV.y0 + 2, 16, 14, TV.x0 + 2, TV.y0 + 2, 16, 14);
    const band = Math.floor((t * 9) % 18) - 2;
    if (band >= 0 && band < 14) { ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(TV.x0 + 2, TV.y0 + 2 + band, 16, 2); }
    ctx.globalAlpha = night ? 0.9 : 0.45; ctx.drawImage(R.tvGlow, TV.x0 + 10 - 21, TV.y0 + 9 - 15); ctx.globalAlpha = 1;
    // väggklockan mellan kalendern och vägghyllan visar spelets tid
    const kx = 230, ky = 21;
    ctx.fillStyle = '#2a2a30'; ctx.fillRect(kx - 5, ky - 5, 11, 11);
    ctx.fillStyle = '#f4f1ea'; ctx.fillRect(kx - 4, ky - 4, 9, 9);
    ctx.fillStyle = '#d8323a'; ctx.fillRect(kx - 4, ky - 4, 9, 1);
    const ha = ((g.min % 720) / 720) * Math.PI * 2 - Math.PI / 2, ma = ((g.min % 60) / 60) * Math.PI * 2 - Math.PI / 2;
    ctx.fillStyle = '#1a1a22';
    for (let k = 0; k <= 2; k++) ctx.fillRect(Math.round(kx + Math.cos(ha) * k), Math.round(ky + Math.sin(ha) * k), 1, 1);
    ctx.fillStyle = '#5a5e68';
    for (let k = 0; k <= 3; k++) ctx.fillRect(Math.round(kx + Math.cos(ma) * k), Math.round(ky + Math.sin(ma) * k), 1, 1);
    // lyckokatten vinkar
    const lx = 83, ly = 39, up = Math.floor(t * 2.2) % 2;
    ctx.fillStyle = '#6a4a10'; ctx.fillRect(lx - 1, ly - 1, 9, 8);
    ctx.fillStyle = '#f0c030'; ctx.fillRect(lx, ly, 7, 7);
    ctx.fillStyle = '#ffe070'; ctx.fillRect(lx, ly, 3, 3);
    ctx.fillStyle = '#6a4a10'; ctx.fillRect(lx + 1, ly - 2, 1, 1); ctx.fillRect(lx + 5, ly - 2, 1, 1);
    ctx.fillStyle = '#1a1a22'; ctx.fillRect(lx + 2, ly + 2, 1, 1); ctx.fillRect(lx + 4, ly + 2, 1, 1);
    ctx.fillStyle = '#d8323a'; ctx.fillRect(lx + 1, ly + 4, 5, 1);
    ctx.fillStyle = '#f0c030'; ctx.fillRect(lx + 7, ly + (up ? -2 : 0), 2, 3); ctx.fillStyle = '#6a4a10'; ctx.fillRect(lx + 7, ly + (up ? -3 : -1), 2, 1);
    // pärlridån: snören var tredje pixel, isärdragen i mitten, olika långa nertill
    // (svajar när man klickar eller när någon går förbi – curtSway klingar av i update)
    const BEAD = ['#8a4a1a', '#d8323a', '#f0b429', '#1ab8a8', '#c87a2a', '#f4f1ea'];
    for (let k = 0; k < 9; k++) {
      const base = CURT.x0 + 2 + k * 3, part = k < 4 ? -(4 - k) * 0.6 : k > 4 ? (k - 4) * 0.6 : 0;
      const len = WALL_Y - CURT.top - 3 - ((k * 7) % 4);
      for (let j = 0; j < len; j++) {
        const f = j / len;
        const sway = Math.round(Math.sin(t * 5 + k * 0.9 + j * 0.25) * curtSway * 2.2 * f + part * f * f * 2);
        const x = base + sway, y = CURT.top + 1 + j;
        if (j % 2 === 0) { ctx.fillStyle = BEAD[(k * 2 + (j >> 1)) % BEAD.length]; ctx.fillRect(x, y, 1, 1); }
        else { ctx.fillStyle = '#2a1a10'; ctx.fillRect(x, y, 1, 1); }
      }
    }
    ctx.fillStyle = '#6a4428'; ctx.fillRect(CURT.x0, CURT.top, CURT.x1 - CURT.x0, 1); // stången
    // elementet bakom disken glöder
    ctx.globalAlpha = night ? 0.9 : 0.45; ctx.drawImage(R.heat, 24 - 15, 96 - 9); ctx.globalAlpha = 1;
    ctx.fillStyle = '#6a6a70'; ctx.fillRect(20, 94, 10, 6); ctx.fillStyle = night ? '#ff7a2a' : '#d85a2a'; for (let k = 0; k < 4; k++) ctx.fillRect(21 + k * 2, 95, 1, 4);
    // kyldörrar som öppnas: insidan lyser, dörren sticker ut och kalluft väller ut
    for (let d = 0; d < FRIDGE.n; d++) {
      const o = fridgeOpen[d]; // stegas i update(dt) – samma fart i 30, 60 och 120 Hz
      if (o < 0.05) continue;
      const dx = FRIDGE.x0 + d * FRIDGE.dw, hinge = d % 2 ? dx + FRIDGE.dw - 2 : dx + 2, gy0 = FRIDGE.top + 10, gy1 = WALL_Y - 4;
      ctx.fillStyle = `rgba(255,255,255,${(0.18 * o).toFixed(3)})`; ctx.fillRect(dx + 2, gy0, FRIDGE.dw - 4, gy1 - gy0);
      ctx.fillStyle = 'rgba(240,250,255,.5)';
      for (let k = 0; k < 6; k++) { const ph = (t * 0.9 + k / 6) % 1; ctx.fillRect(Math.round(dx + 6 + k * 4 + Math.sin(ph * 5 + k) * 2), Math.round(gy1 + ph * 12), 1, 1); }
    }
    // en LED i kylens ljuslåda som flimrar
    if (Math.sin(t * 17) > 0.6 && Math.sin(t * 0.9) > 0.3) { ctx.fillStyle = 'rgba(40,50,60,.35)'; ctx.fillRect(FRIDGE.x0 + 150, FRIDGE.top - 1, 40, 9); }
    // övervakningskamerans lampa
    if (Math.floor(t * 1.5) % 2) { ctx.fillStyle = '#ff2a2a'; ctx.fillRect(155, 6, 1, 1); }
  }
  // en kyldörr som står öppen: glasdörren svänger ut mot gången (gångjärnet på ena sidan)
  function fridgeDoor(ctx, d) {
    const o = fridgeOpen[d], th = o * 1.3, side = d % 2 ? 1 : -1;
    const dx = FRIDGE.x0 + d * FRIDGE.dw, hx = side > 0 ? dx + FRIDGE.dw - 1 : dx + 1, top = FRIDGE.top + 9, bot = WALL_Y - 2, Dw = FRIDGE.dw - 3;
    const cs = Math.cos(th), sn = Math.sin(th);
    for (let s = 0; s <= Dw; s += 0.5) {
      const x = Math.round(hx - side * s * cs), yo = Math.round(s * sn * 0.9);
      const edge = s < 1.5 || s > Dw - 1.5;
      ctx.fillStyle = edge ? '#3a3e46' : 'rgba(200,232,250,.78)';
      ctx.fillRect(x, top + yo, 1, bot - top);
      if (!edge) { ctx.fillStyle = '#4a4e56'; ctx.fillRect(x, top + yo, 1, 1); ctx.fillRect(x, bot + yo - 1, 1, 1); }
      if (!edge && ((s * 2) | 0) % 9 === 0) { ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(x, top + yo + 3, 1, bot - top - 6); }
      if (s > Dw - 5 && s < Dw - 3.5) { ctx.fillStyle = '#e6ecf0'; ctx.fillRect(x, top + yo + 14, 1, 12); } // handtaget
    }
  }
  // disken: kunddisplayen, korvarna som rullar, radions toner, inslagna varor
  function liveCounter(ctx) {
    // kunddisplayen visar summan
    const sum = scan ? scan.total : 0, st = String(sum).slice(-3);
    ctxText(ctx, SM, st, 98 - textW(SM, st), 81, scan?.flash ? '#ffffff' : '#6fe08a');
    // korvarna rullar
    for (let k = 0; k < 4; k++) {
      const x = GRILL.x0 + 3 + k * 6, y = 96, ph = (Math.floor(t * 4) + k) % 3;
      ctx.fillStyle = '#6a2a14'; ctx.fillRect(x, y, 5, 3);
      ctx.fillStyle = ['#c05a30', '#a84a28', '#d06a3a'][ph]; ctx.fillRect(x, y, 5, 2);
      ctx.fillStyle = '#e8906a'; ctx.fillRect(x + 1 + ph, y, 1, 1);
    }
    ctx.fillStyle = 'rgba(255,255,255,.5)';
    for (let k = 0; k < 3; k++) { const ph = (t * 0.7 + k / 3) % 1; ctx.fillRect(Math.round(GRILL.x0 + 8 + k * 6 + Math.sin(ph * 6 + k) * 1.5), Math.round(92 - ph * 8), 1, 1); }
    // radion spelar: små noter stiger
    const rx = RADIO.x0 + 10;
    for (let k = 0; k < 2; k++) {
      const ph = ((t * 0.5) + k * 0.5) % 1;
      if (radioCh === 1 && k === 1) continue;
      const nx = Math.round(rx + Math.sin(ph * 5 + k * 2) * 4 + k * 3), ny = Math.round(88 - ph * 14);
      ctx.fillStyle = radioCh === 1 ? `rgba(200,200,200,${(1 - ph).toFixed(2)})` : `rgba(255,${radioCh === 2 ? 200 : 240},120,${(1 - ph).toFixed(2)})`;
      ctx.fillRect(nx, ny, 1, 3); ctx.fillRect(nx - 1, ny + 2, 1, 1); ctx.fillRect(nx + 1, ny, 1, 1);
    }
    // inslagna varor glider in under plexiglaset
    if (scan) for (const s of scan.shown) {
      const k = Math.min(1, s.t / 0.5), x = 66 + Math.round(k * 14), y = 95 - Math.round(Math.sin(k * Math.PI) * 3);
      if (s.t < 1.4) drawIcon(ctx, s.id, x, y);
    }
  }
  // dörren som går upp när någon kommer och dörrklockan som svänger
  function liveFront(ctx, night) {
    const o = Math.round(door * 12);
    if (o > 0) {
      ctx.fillStyle = night ? '#0a0e1e' : '#c8d4dc'; ctx.fillRect(DOOR.x0 + 2, FRONT_Y + 4, DOOR.x1 - DOOR.x0 - 4, H - FRONT_Y - 4);
      ctx.fillStyle = '#3a3a40'; ctx.fillRect(DOOR.x1 - 3, FRONT_Y + 2 - o, 3, H - FRONT_Y + o - 2);
      ctx.fillStyle = 'rgba(168,184,196,.6)'; ctx.fillRect(DOOR.x1 - 2, FRONT_Y + 3 - o, 1, H - FRONT_Y + o - 4);
    }
    const sw = t - bellT < 1.5 ? Math.round(Math.sin((t - bellT) * 18) * 2 * (1 - (t - bellT) / 1.5)) : 0;
    ctx.fillStyle = '#5a5a60'; ctx.fillRect(DOOR_X, FRONT_Y - 1, 1, 3);
    ctx.fillStyle = '#c8a040'; ctx.fillRect(DOOR_X - 2 + sw, FRONT_Y + 2, 5, 3); ctx.fillStyle = '#f0d070'; ctx.fillRect(DOOR_X - 1 + sw, FRONT_Y + 2, 2, 1);
    ctx.fillStyle = '#8a6a20'; ctx.fillRect(DOOR_X + sw, FRONT_Y + 5, 1, 1);
    if (night) { ctx.globalAlpha = 0.7 + Math.sin(t * 3) * 0.1; ctx.drawImage(R.neon, 70 - 27, FRONT_Y - 12); ctx.globalAlpha = 1; }
  }
  // prislappen på en matplats (med ljus ram när man står där eller pekar)
  function displayTag(ctx, s, focus) {
    const on = focus === spotById(s.f.id);
    const img = R.tags[R.displays.indexOf(s)];
    if (on) {
      const [gx, gy, gw, gh] = s.glow, a = 0.26 + Math.sin(t * 6) * 0.1;
      ctx.fillStyle = `rgba(255,236,120,${a.toFixed(3)})`; ctx.fillRect(gx, gy, gw, gh);
      ctx.fillStyle = '#ffe070';
      ctx.fillRect(gx - 1, gy - 1, gw + 2, 1); ctx.fillRect(gx - 1, gy + gh, gw + 2, 1); ctx.fillRect(gx - 1, gy, 1, gh); ctx.fillRect(gx + gw, gy, 1, gh);
    }
    const x = Math.round(s.tag[0] - img.w / 2), y = s.tag[1] - (on && Math.floor(t * 4) % 2 ? 1 : 0);
    if (on) { ctx.fillStyle = Math.floor(t * 4) % 2 ? '#ffffff' : '#ffe070'; ctx.fillRect(x, y + 1, img.w, img.h - 3); }
    ctx.drawImage(img.img, x, y);
  }

  return {
    viewMax: { w: W, h: H },
    get worldX() { return walker.px; },
    get worldY() { return walker.py; },
    enter() {
      ring(); pendingHello = 0.7;
      if (lottOf(g).open) setTimeout(() => hint($t('🍀 Jag har en oskrapad lott i fickan! Klicka på lotter-stället.')), 1600);
      // släpper man musen/fingret UTANFÖR spelvyn (i ramen, utanför fönstret) når inte up() scenen –
      // då måste lotten ändå sluta skrapa, annars skrapar vanliga musrörelser vidare
      for (const ev of LOTT_RELEASE) window.addEventListener(ev, releaseLott);
    },
    exit() {
      for (const ev of LOTT_RELEASE) window.removeEventListener(ev, releaseLott);
      talk.clear(); talkExp.clear(); talkCat.clear(); for (const n of npcs) n.talk.clear();
      // går man ut mitt i skrapandet skrapas lotten klart i farten – vinsten följer med
      if (lottOf(g).open) { const r = settleLott(g); toast(r.prize ? $t`🍀 Du skrapade klart lotten på vägen ut – VINST ${fmt(r.prize)}!` : $t('🍀 Du skrapade klart lotten på vägen ut – nitlott.'), r.prize ? 'good' : ''); }
      ticket = null;
    },
    _debug: {
      // skraplotterna: tillståndet, köp utan dialog, rutornas lägen i vyn, skrapa allt
      lott: () => { const L = lottOf(g); return { salt: L.salt, dag: L.dag, n: L.n, kopt: L.kopt, vunnit: L.vunnit, left: lottLeft(g), open: L.open ? { ...L.open, fields: [...L.open.fields] } : null, ticket: !!ticket, result: ticket?.result || null }; },
      lottOffer: () => offerLott(),
      lottBuy: () => buyAndShow(),
      lottRects: () => ticket?.rects() || null,
      lottReveal: () => ticket?.revealAll() || null,
      lottClose: () => { ticket = null; },
      lottPrize: (salt, day, n) => lottPrize(salt, day, n),
      spot: (id) => {
        const P = {
          gang1: [260, 90], gang2: [300, 158], gang3: [300, 226], kyl: [FRIDGE.x0 + 3.5 * FRIDGE.dw, 40], katt: [cat.x, cat.y - 4],
          dorr: [DOOR_X, FRONT_Y + 6], 'dörr': [DOOR_X, FRONT_Y + 6], disk: [70, 112], frys: [44, 172], entre: [176, 190],
        }[id];
        let x, y;
        if (P) [x, y] = P;
        else {
          const s = spotById(id);
          if (!s) return null;
          x = s.food ? s.food.tag[0] : (s.r[0] + s.r[2]) / 2;
          y = s.food ? s.food.tag[1] + 9 : (s.r[1] + s.r[3]) / 2;
        }
        return { x: x - cam.x, y: y - cam.y };
      },
      buy: (id) => { const s = spots.find((x) => x.id === id && x.food); if (!s) return { ok: false, msg: 'finns inte' }; addToBasket(s.food); return pay(); },
      pick: (id) => { const s = spots.find((x) => x.id === id && x.food); return s ? addToBasket(s.food) : false; },
      checkout: () => pay(),
      scan: () => { walker.px = PAY[0]; walker.py = PAY[1]; walker.stop(); walker.dir = 'up'; Object.assign(cam, camTarget()); startScan(); return !!scan; },
      basket: () => groups().map(({ f, n }) => ({ id: f.id, name: f.name, n, price: narPrice(f), ord: f.price })),
      basketIds: () => [...basket],
      total: () => total(),
      prices: () => Object.fromEntries(FOOD.map((f) => [f.id, { ord: f.price, nar: narPrice(f) }])),
      state: () => ({
        money: g.money, fridge: { ...g.fridge }, basket: [...basket], total: total(), hasBasket, bag, scan: scan ? { total: scan.total, done: scan.done } : null,
        pos: { x: Math.round(walker.px), y: Math.round(walker.py), path: walker.path.length }, cam: { ...cam }, night: isNight(), hour: hour(),
        tube: tube.on ? 'on' : 'off', tubeLvl: +tube.lvl.toFixed(3), cat: { spot: cat.spot, state: cat.state }, npcs: npcs.map((n) => ({ i: n.i, state: n.state, x: Math.round(n.w.px), y: Math.round(n.w.py), goal: n.goal?.kind || null })),
        fridgeOpen: fridgeOpen.map((o) => +o.toFixed(2)), receipt: receiptOpen,
      }),
      catAt: () => ({ spot: cat.state === 'sleep' || cat.state === 'sit' ? cat.spot : null, to: cat.to, state: cat.state, x: Math.round(cat.x), y: Math.round(cat.y) }),
      catTo: (spot) => catMove(spot),
      catJump: (spot) => { const s = CAT_SPOTS[spot]; if (!s) return false; cat.spot = spot; cat.state = 'sleep'; cat.t = 0; cat.x = s.x; cat.y = s.y; cat.fy = s.fy; cat.to = null; return true; },
      tube: (st) => { tube.forced = st || null; if (st) tube.on = st === 'on'; return tube.on; },
      lockCam: (x, y) => { lockedCam = x === null || x === undefined ? null : { x: clamp(x, 0, W - VW), y: clamp(y ?? cam.y, 0, H - VH) }; if (lockedCam) Object.assign(cam, lockedCam); },
      teleport: (x, y) => { walker.px = x; walker.py = y; walker.stop(); walker.snapFree(); Object.assign(cam, camTarget()); },
      walkTo: (x, y) => { walker.walkTo(x, y); return walker.path.length; },
      walkable: (x, y) => walker.walkable(x, y),
      openFridge: (d, secs = 1.4) => { fridgeHold[d] = t + secs; return fridgeOpen[d]; },
      hover: (id) => { hoverId = id || null; hoverT = t; },
      cam: () => ({ ...cam }),
      pos: () => ({ x: walker.px, y: walker.py, path: walker.path.length }),
      npcs: () => npcs.map((n) => ({ i: n.i, state: n.state, x: Math.round(n.w.px), y: Math.round(n.w.py), sq: +n.sq.toFixed(1), yield: n.yield ? { x: n.yield.x, y: n.yield.y } : null })),
      // lägg en kund i en gång på väg mot (tx, ty) – för att provocera fram ett möte
      placeNpc: (i, x, y, tx, ty) => {
        const n = npcs[i]; if (!n) return false;
        if (n.state === 'away') { n.look = npcLook(npcSeed += 37); }
        n.w.px = x; n.w.py = y; n.w.stop(); n.yield = null; n.carry = 'basket'; n.w.speed = n.baseSpeed;
        n.plan = [{ x: PAY[0], y: PAY[1], dir: 'up', kind: 'pay' }, { x: DOOR_X, y: FRONT_Y - 5, dir: 'down', kind: 'exit' }];
        n.goal = { x: tx ?? x, y: ty ?? y, dir: 'up', kind: 'browse' };
        n.state = 'walk'; n.w.walkTo(n.goal.x, n.goal.y); n.lineT = -9;
        return true;
      },
      hideNpcs: () => { for (const n of npcs) { n.state = 'away'; n.t = 999; } },
      expSay: (s) => expSay(s, undefined, true),
      panorama: (scale = 1) => {
        const c = document.createElement('canvas'); c.width = W * scale; c.height = H * scale;
        const x = c.getContext('2d'); x.imageSmoothingEnabled = false; x.setTransform(scale, 0, 0, scale, 0, 0);
        drawWorld(x, 0, 0, W, H);
        talkExp.draw(x, { x0: 0, x1: W }); talkCat.draw(x, { x0: 0, x1: W }); for (const n of npcs) n.talk.draw(x, { x0: 0, x1: W }); talk.draw(x, { x0: 0, x1: W });
        return c.toDataURL('image/png');
      },
    },

    update(dt) {
      t += dt;
      walker.update(dt);
      if (pendingHello > 0) { pendingHello -= dt; if (pendingHello <= 0) expSay(isNight() ? $t('Öppet jämt. Även nu.') : $t('Öppet jämt.')); }
      // dörren öppnas när någon är nära (och klockan plingar när man går in/ut)
      const near = [{ x: walker.px, y: walker.py }, ...npcs.filter((n) => n.state !== 'away').map((n) => ({ x: n.w.px, y: n.w.py }))].some((p) => Math.abs(p.x - DOOR_X) < 16 && p.y > FRONT_Y - 14);
      door += ((near ? 1 : 0) - door) * Math.min(1, dt * 6);
      doorWas = near;
      updateTube(dt);
      updateCat(dt);
      updateClerk(dt);
      for (const n of npcs) updateNpc(n, dt);
      updateScan(dt);
      if (receiptOpen && !modalOpen()) cancelScan();
      if (scan && !scan.done && !walker.path.length && Math.hypot(walker.px - PAY[0], walker.py - PAY[1]) > 14) cancelScan();
      for (let i = flies.length - 1; i >= 0; i--) { flies[i].t += dt; if (flies[i].t > 0.4) flies.splice(i, 1); }
      for (let i = pops.length - 1; i >= 0; i--) { pops[i].t += dt; if (pops[i].t > 1) pops.splice(i, 1); }
      updateHint();
      ticket?.update(dt);
      // pärlridån svajar när någon går förbi den och klingar av (per sekund, inte per bildruta)
      curtSway = Math.max(0, curtSway - dt * 0.6);
      if (Math.abs(walker.px - 132) < 20 && walker.py < 150 && walker.path.length) curtSway = Math.max(curtSway, 0.5);
      // kyldörrarna svänger upp och igen
      for (let d = 0; d < FRIDGE.n; d++) fridgeOpen[d] += ((t < fridgeHold[d] ? 1 : 0) - fridgeOpen[d]) * Math.min(1, dt * 9);
      const tg = camTarget(), k = lockedCam ? 1 : Math.min(1, dt * 6);
      cam.x += (tg.x - cam.x) * k; cam.y += (tg.y - cam.y) * k;
    },

    down(sx, sy) {
      hoverId = null;
      if (ticket) { ticket.down(sx, sy); return; } // lotten ligger uppe: man skrapar
      for (const h of panelHits) if (sx >= h.r[0] && sx <= h.r[2] && sy >= h.r[1] && sy <= h.r[3]) { h.act(); return; }
      const x = sx + cam.x, y = sy + cam.y;
      // katten först (den ligger ovanpå saker)
      const cr = catRect();
      if (x >= cr[0] && x <= cr[2] && y >= cr[1] && y <= cr[3]) {
        const [px, py, face] = petSpot();
        walker.walkTo(px, py, () => { walker.dir = face; petCat(); });
        return;
      }
      let s = spotAt(x, y);
      // golvet i gångarna går före hyllorna och kartongstaplarna (som annars skickar en runt till framsidan)
      if (s && /^(hylla|kartong)/.test(s.id) && walker.walkable(x, y)) s = null;
      if (scan && !scan.done && s?.id !== 'disk') cancelScan();
      if (s) { clickSpot(s, x); return; }
      if (y > WALL_Y) walker.walkTo(x, y);
    },
    move(sx, sy) { if (ticket) { ticket.move(sx, sy); return; } hoverId = spotAt(sx + cam.x, sy + cam.y)?.id || null; hoverT = t; },
    up() { ticket?.up(); },

    draw(ctx) {
      syncView(A);
      const cx = Math.round(cam.x), cy = Math.round(cam.y);
      ctx.setTransform(A.pxs, 0, 0, A.pxs, -cx * A.pxs, -cy * A.pxs);
      drawWorld(ctx, cx, cy, VW, VH);
      const view = { x0: cx, x1: cx + VW };
      // bubblor ritas bara när den som pratar syns – annars trycks de in vid kanten och svävar
      if (expInView()) talkExp.draw(ctx, view);
      talkCat.draw(ctx, view);
      for (const n of npcs) if (n.w.px > cx - 6 && n.w.px < cx + VW + 6) n.talk.draw(ctx, view);
      talk.draw(ctx, view);
      ctx.setTransform(A.pxs, 0, 0, A.pxs, 0, 0);
      drawPanel(ctx);
      const focus = focusSpot();
      if (ticket) ticket.draw(ctx, VW, VH, A.view?.safe);
      else if (focus) bigLabel(ctx, focus, walker.py - cam.y > VH - 50);
    },
  };
}
