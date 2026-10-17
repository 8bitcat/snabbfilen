// 💪 PIXEL GYM i förorten (v0.138, Carl 2026-10-17: "många tjejer rapporterar att tiden för att göra saker på jobbet
// är för kort … skapa ett gym dit man kan gå för att gå snabbare när man jobbar och bära flera brickor … lyfta vikter,
// slå på boxsäcken, dansa, köra gruppklass – små minispel som är roliga, gör det till ett riktigt coolt gym").
//
// 704 px bred lokal som rullar med figuren. Från vänster: dörren UT, receptionen där coachen Benke står (dagskortet och
// din form), skåpen och vattenautomaten, löpbanden (Lo springer), HANTLARNA där Saga lyfter, BOXSÄCKEN som hänger från
// taket, DANSGOLVET med spegelvägg, högtalare och lysande rutor, och GRUPPASSET på mattorna där Mia leder två elever.
// Fyra minispel (ett pass = 10 energi, dagskortet 30 kr första gången varje dag):
//   🏋️ Hantlarna – lyft i takt: tryck (eller mellanslag) när markören är i det gröna fältet, tio lyft, fältet krymper
//   🥊 Boxsäcken – träffa handsken som dyker upp på säcken innan den bleknar (pilarna: ← → ↑ ↓ åt det hållet), kombo
//   💃 Dansgolvet – pilarna faller mot linjen, tryck på rätt pil i takt (knapparna eller piltangenterna)
//   🧘 Gruppasset – gör samma rörelse som Mia visar (fyra knappar eller 1–4), fortare och fortare
// Poängen (0–24 per pass; de två första passen per gren och dag räknas fullt, resten en fjärdedel) blir STYRKA
// (hantlar, box), KONDITION (gruppass, halva dansen) och RYTM (dans). Nivåerna (game.js GYM_NIVAER) ger på jobbet:
// snabbare fötter (kondition → walkable.js jobbFart) och fler brickor/påsar i taget (styrka → gymBar). Ett pixelkorn.
import { drawPerson, makeLook } from '../core/people.js';
import { Pix, SMALL, BIG, ctxText, textW, text, mix, mul, hash, bayer } from '../core/floor-pix.js';
import { openModal, closeModal, toast, esc, modalOpen } from '../core/ui.js';
import { play } from '../core/sound.js';
import { fmt, GYM_NIVAER } from '../game.js';
import { createWalker, selfDrawable, folkDrawables, createSpeech, WALK_SEQ, synligRuta } from './walkable.js';
import { $t } from '../core/i18n.js';
import { eluttag, brandslackare, dorrmatta, matta, taklampa, lysror, vaggklocka, ritaLampsken, ritaKrukvaxt, ritaPapperskorg, ritaVattenautomat } from '../tassbacken/inne-kit.js';
import { tone, fyll, bild, put, skugga, F } from '../core/pennor.js';

const { VIT, JARN, ZINK, ROD, BLA, GUL, TURK } = F;
const W = 704, H = 216, WALL_Y = 76;
const DOOR = { x0: 14, x1: 46 };
const DISK = { x: 64, y: 86, w: 66, h: 26 };                       // receptionen
const SKAP = { x0: 146, x1: 212, y0: 20, y1: 74 };                  // skåpen på väggen
const VATTEN = { x: 226, y: 112 };
const LOPBAND = [{ x: 262, y: 128 }, { x: 306, y: 128 }];
const HANTLAR = { x: 380, y: 140, stall: { x0: 348, x1: 410 } };    // hantelstället på väggen, lyftplatsen framför
const BOX = { x: 456, top: 16, fot: 112, r: 8 };                    // säcken hänger från taket (top = kedjans fäste)
const DANS = { x0: 490, x1: 598, y0: 112, y1: 190 };                // dansgolvet (spegelväggen ovanför)
const KLASS = { x0: 612, x1: 694, y: 156, podium: { x: 654, y: 104 } };
const KORT = 30, ENERGI = 10, MAXP = 24;
const CYAN = 0x18c8e0, ROSA = 0xff4ab0, GRON = 0x46e07a;

// ---- folket ----
const BENKE = { skin: '#c68a5c', hair: '#1d1714', style: 'short', top: 'tee', shirt: '#18c8e0', accent: '#f4f1ea', bottom: 'shorts', pants: '#2a2a30', shoes: '#f2f2f2', hat: 'cap', cap: '#14181c', glasses: false, beard: true, phones: false, bag: null, build: 7, blush: false, kid: false };
const LO = { skin: '#eec3a0', hair: '#e0a030', style: 'ponytail', top: 'vest', shirt: '#ff4ab0', accent: '#ff4ab0', bottom: 'shorts', pants: '#2d3a5c', shoes: '#f2f2f2', hat: null, glasses: false, beard: false, phones: true, phoneColor: '#18c8e0', bag: null, build: 4, blush: true, kid: false };
const SAGA = { skin: '#8a5a3a', hair: '#1d1714', style: 'bun', top: 'vest', shirt: '#9ad8ff', accent: '#9ad8ff', bottom: 'pants', pants: '#14181c', shoes: '#1c1c1c', hat: null, glasses: false, beard: false, phones: false, bag: null, build: 6, blush: false, kid: false };
const MIA = { skin: '#e0a97f', hair: '#6b4226', style: 'ponytail', top: 'tee', shirt: '#ffd23f', accent: '#ff4ab0', bottom: 'shorts', pants: '#ff4ab0', shoes: '#f2f2f2', hat: null, glasses: false, beard: false, phones: true, phoneColor: '#ffd23f', bag: null, build: 4, blush: true, kid: false };
const ELEV = [{ ...makeLook(() => hash(3, 1, 4)), kid: true, hat: null, top: 'tee', shirt: '#46e07a' }, { ...makeLook(() => hash(8, 2, 6)), hat: null, top: 'vest', shirt: '#9a6ad8', kid: false }];
const DANSARE = { ...makeLook(() => hash(5, 5, 9)), hat: null, top: 'tee', shirt: '#18c8e0', kid: false };
const BENKE_SAY = [
  $t('Välkommen till Pixel Gym! Hantlarna och boxsäcken ger STYRKA, gruppasset KONDITION och dansgolvet RYTM.'),
  $t('Kondition ger snabbare fötter på jobbet – varje nivå är åtta procent fortare. Styrka nivå två: två brickor i taget!'),
  $t('De två första passen per gren och dag ger fulla poäng. Sedan är det vila som gäller – kroppen växer när den vilar.'),
  $t('Ett pass tar tio energi. Trött? Ät något eller sov först, annars blir lyften sluddriga.'),
  $t('Lo har sprungit på löpbandet sedan i morse. Jag tror inte hon vet hur man stänger av det.'),
];
const RORELSER = [
  { id: 'armar', ik: '🙌', namn: $t('ARMAR UPP'), frame: 10 },
  { id: 'knaboj', ik: '🦵', namn: $t('KNÄBÖJ'), frame: 5 },
  { id: 'klapp', ik: '👏', namn: $t('KLAPPA'), frame: 9 },
  { id: 'spring', ik: '🏃', namn: $t('SPRING'), frame: -1 },
];
const PILAR = ['←', '↓', '↑', '→'], PILKEY = ['ArrowLeft', 'ArrowDown', 'ArrowUp', 'ArrowRight'];
const GRENAR = { vikter: 'styrka', box: 'styrka', dans: 'rytm', klass: 'kondition' };
const SPEL_NAMN = { vikter: $t('🏋️ Hantlarna'), box: $t('🥊 Boxsäcken'), dans: $t('💃 Dansgolvet'), klass: $t('🧘 Gruppasset') };
const SPEL_RUBRIK = { vikter: $t('HANTLARNA'), box: $t('BOXSÄCKEN'), dans: $t('DANSGOLVET'), klass: $t('GRUPPASSET') };   // (pixelfonten saknar emoji)
// pilarna som pixelbilder (7 × 7) – ← ↓ ↑ → finns inte i pixelfonten
const PIL = [
  ['...#...', '..##...', '.######', '#######', '.######', '..##...', '...#...'],
  ['.#####.', '.#####.', '.#####.', '#######', '.#####.', '..###..', '...#...'],
  ['...#...', '..###..', '.#####.', '#######', '.#####.', '.#####.', '.#####.'],
  ['...#...', '...##..', '######.', '#######', '######.', '...##..', '...#...'],
];
const ritaPil = (ctx, i, x, y, c) => { ctx.fillStyle = c; PIL[i].forEach((r, j) => { for (let k = 0; k < 7; k++) if (r[k] === '#') ctx.fillRect(x + k, y + j, 1, 1); }); };
const GREN_NAMN = { styrka: $t('Styrka'), kondition: $t('Kondition'), rytm: $t('Rytm') }, GREN_IK = { styrka: '💪', kondition: '🏃', rytm: '🎵' };

// ================= bakgrunden =================
let BG = null;
function paintBg() {
  const P = new Pix(W, H);
  // väggen: mörk betong med en turkos list och en mörkare nederdel, PIXEL GYM i stora bokstäver mitt på
  for (let y = 0; y < WALL_Y; y++) for (let x = 0; x < W; x++) P.px(x, y, mix(0x3a4048, 0x2e343c, (y / WALL_Y) * 0.6 + (hash(x >> 2, y >> 2, 5) - 0.5) * 0.12));
  for (let x = 0; x < W; x++) { P.px(x, 46, CYAN); P.px(x, 47, 0x0a7a8c); P.px(x, WALL_Y - 2, 0x1e2226); P.px(x, WALL_Y - 1, 0x14181c); }
  P.rect(0, 0, W, 3, 0x1e2226); P.hl(0, 3, W, 0x4a5058);
  { const s = $t('PIXEL GYM'), tw = textW(BIG, s, 2); const x = 300 - (tw >> 1); for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) text(P, BIG, s, x + dx, 14 + dy, 0x0a7a8c, 0.35, 2); text(P, BIG, s, x, 14, 0x9af0ff, 1, 2); }
  // lysrör i taket och taklampor
  for (const lx of [40, 200, 340, 540, 650]) lysror(P, lx - 16, 5, 32);
  for (const lx of [120, 420]) taklampa(P, lx, 6, 26, [0x0a4a58, 0x0a7a8c, 0x18c8e0, 0x6ae0f0, 0xc8f8ff]);
  // skåpen: sex höga plåtskåp i turkos med ventiler och nummer
  for (let k = 0; k < 6; k++) {
    const x = SKAP.x0 + k * 11;
    fyll(P, x, SKAP.y0, x + 9, SKAP.y1, (X, Y) => tone(TURK, 0.5 - (X - x) * 0.03 + (Y === SKAP.y0 ? 0.3 : 0) + ((Y - SKAP.y0) % 18 === 17 ? -0.2 : 0), X, Y));
    for (let j = 0; j < 3; j++) P.hl(x + 2, SKAP.y0 + 4 + j * 2, 5, 0x0a4a58);
    P.px(x + 7, SKAP.y0 + 30, 0xf4f1ea); P.rect(x + 2, SKAP.y0 + 14, 5, 4, 0xf4f1ea); text(P, SMALL, String(k + 1), x + 3, SKAP.y0 + 14, 0x14181c);
  }
  P.rect(SKAP.x0 - 2, SKAP.y1, SKAP.x1 - SKAP.x0 + 4, 2, 0x14181c);
  // affischerna: "SVETT ÄR BARA GLITTER", "TRÄNA MED KOMPISAR" och en hantel
  affischGym(P, 60, 10, 0xff4ab0, $t('SVETT'), $t('= GLITTER'));
  affischGym(P, 240, 50, 0x46e07a, $t('TRÄNA'), $t('IHOP!'));
  affischGym(P, 630, 10, 0xffd23f, $t('KÖR'), $t('HÅRT!'));
  vaggklocka(P, 300, 36, 6);
  // hantelstället: tre hyllor med hantlar i stigande storlek, en viktskivehög
  for (let r = 0; r < 3; r++) { const y = 30 + r * 12; P.hl(HANTLAR.stall.x0, y, HANTLAR.stall.x1 - HANTLAR.stall.x0, 0x8a929c); P.hl(HANTLAR.stall.x0, y + 1, HANTLAR.stall.x1 - HANTLAR.stall.x0, 0x4a5058); for (let k = 0; k < 6; k++) { const hx = HANTLAR.stall.x0 + 4 + k * 10, hh = 3 + r; P.rect(hx, y - hh - 1, 2, hh + 1, 0x2a2a30); P.rect(hx + 5, y - hh - 1, 2, hh + 1, 0x2a2a30); P.hl(hx + 2, y - 2, 3, 0xa8b0b8); P.px(hx, y - hh - 1, 0x5a626c); P.px(hx + 5, y - hh - 1, 0x5a626c); } }
  for (let k = 0; k < 4; k++) { const px = HANTLAR.stall.x0 - 12 + k * 3; P.rect(px, 56 - k * 0, 2, 16, k % 2 ? 0xe04848 : 0x2a2a30); P.px(px, 62, 0x8a929c); }
  // spegelväggen över dansgolvet med en snedstrimma, högtalare på båda sidor, discokulan
  fyll(P, DANS.x0 - 2, 8, DANS.x1 + 2, WALL_Y - 4, (X, Y) => { const d = ((X - Y * 2) % 37 + 37) % 37; return mix(0x9ad0e0, 0x4a7a8c, (Y - 8) / 64 + (d < 4 ? -0.25 : 0)); });
  P.box(DANS.x0 - 3, 7, DANS.x1 - DANS.x0 + 6, WALL_Y - 10, 0x14181c); P.box(DANS.x0 - 2, 8, DANS.x1 - DANS.x0 + 4, WALL_Y - 12, 0x6ae0f0);
  for (const sx of [DANS.x0 - 22, DANS.x1 + 4]) { P.rect(sx, 36, 18, 36, 0x1e2226); P.box(sx, 36, 18, 36, 0x4a5058); P.ell(sx + 9, 48, 6, 6, 0x2a2a30, 1, 1); P.ell(sx + 9, 48, 3, 3, 0x5a626c, 1, 1); P.ell(sx + 9, 63, 4, 4, 0x2a2a30, 1, 1); P.ell(sx + 9, 63, 2, 2, 0x5a626c, 1, 1); }
  P.vl(544, 3, 6, 0x8a929c); for (let y = -4; y <= 4; y++) for (let x = -4; x <= 4; x++) if (x * x + y * y <= 17) P.px(544 + x, 13 + y, (x + y) % 2 ? 0xe8f4ff : 0x9ad0e0);
  // whiteboarden vid gruppasset: DAGENS PASS
  P.rect(612, 12, 70, 30, 0xf4f1ea); P.box(611, 11, 72, 32, 0x8a929c); text(P, SMALL, $t('DAGENS PASS'), 616, 14, 0x14181c);
  [$t('1. UPPVÄRMNING'), $t('2. STYRKA'), $t('3. STRETCH')].forEach((r, i) => text(P, SMALL, r, 616, 22 + i * 6, [0x18c8e0, 0xff4ab0, 0x46e07a][i]));
  eluttag(P, 136, 66); eluttag(P, 330, 66); eluttag(P, 604, 66); brandslackare(P, 232, 60);
  // golvet: gummiplattor i mörkgrått med turkosa linjer
  for (let y = WALL_Y; y < H; y++) for (let x = 0; x < W; x++) {
    const tx = (x / 16) | 0, ty = ((y - WALL_Y) / 10) | 0;
    let c = (tx + ty) % 2 ? 0x4a5058 : 0x444a52;
    if (x % 48 === 0) c = 0x18c8e0; else if ((x % 16) === 15 || ((y - WALL_Y) % 10) === 9) c = mul(c, 0.86);
    P.px(x, y, c);
  }
  for (let i = 0; i < 5; i++) P.darken(0, WALL_Y + i, W, 1, 0.8 + i * 0.04);
  // dansgolvet: blanka svarta plattor med ett rutnät (rutorna tänds live)
  for (let y = DANS.y0; y < DANS.y1; y++) for (let x = DANS.x0; x < DANS.x1; x++) P.px(x, y, ((x - DANS.x0) % 18 === 0 || (y - DANS.y0) % 13 === 0) ? 0x14181c : mix(0x1e2230, 0x2a2e3c, (bayer(x, y) - 0.5) * 0.3));
  P.box(DANS.x0 - 1, DANS.y0 - 1, DANS.x1 - DANS.x0 + 2, DANS.y1 - DANS.y0 + 2, 0x6ae0f0);
  // mattorna för gruppasset (blå), den röda mattan under hantlarna, dörrmattan
  for (let k = 0; k < 3; k++) matta(P, KLASS.x0 + k * 26, KLASS.y - 6, 22, 24, 0x2a6ac8, 0x3a8ae0, 0x1a4a98);
  matta(P, HANTLAR.x - 28, HANTLAR.y - 10, 56, 24, 0xa8302a, 0xc0403a, 0x6a1a18);
  dorrmatta(P, DOOR.x0 - 4, 78, DOOR.x1 - DOOR.x0 + 8, 10, 0x18c8e0, 0x0a7a8c);
  // podiet vid väggen där Mia står
  P.rect(KLASS.podium.x - 16, KLASS.podium.y - 4, 32, 8, 0x5a626c); P.hl(KLASS.podium.x - 16, KLASS.podium.y - 4, 32, 0x8a929c); P.hl(KLASS.podium.x - 16, KLASS.podium.y + 3, 32, 0x2a2e36);
  // ljuspölar från taket
  for (const x of [120, 420]) P.ell(x, 150, 46, 14, 0xffffff, 0.08, 4);
  // dörren UT (turkos med glasruta)
  P.rect(DOOR.x0 - 3, 18, DOOR.x1 - DOOR.x0 + 6, WALL_Y - 18, 0x14181c);
  for (let y = 20; y < WALL_Y; y++) for (let x = DOOR.x0; x < DOOR.x1; x++) P.px(x, y, mix(0x18c8e0, 0x0a7a8c, ((x - DOOR.x0) % 8 === 0 ? 0.5 : 0) + hash(x >> 2, y, 3) * 0.15));
  P.rect(DOOR.x0 + 6, 26, 20, 16, 0xb8e4f4); P.box(DOOR.x0 + 6, 26, 20, 16, 0xf4f1ea);
  P.rect(DOOR.x0 + 8, 46, 16, 7, 0x0a4a58); text(P, SMALL, $t('UT'), DOOR.x0 + 12, 47, 0xf4f1ea);
  P.px(DOOR.x0 + 26, 54, 0xe8b830);
  P.box(0, 0, W, H, 0x0e0d12);
  return P.flush();
}
function affischGym(P, x, y, c, r1, r2) {
  P.rect(x, y, 44, 30, 0x14181c); P.box(x, y, 44, 30, c);
  text(P, BIG, r1, x + 22 - (textW(BIG, r1) >> 1), y + 5, c);
  text(P, SMALL, r2, x + 22 - (textW(SMALL, r2) >> 1), y + 18, 0xf4f1ea);
  P.hl(x + 4, y + 26, 36, mul(c, 0.6));
}

// ================= rekvisitan (cachade bilder) =================
function lopbandBild() {
  return bild('lopband', 44, 44, 22, 40, (P) => {
    fyll(P, -18, -6, 16, 0, (X, Y) => tone(JARN, 0.45 + (Y === -6 ? 0.3 : 0) - (X + 18) * 0.005, X, Y));   // basen
    P.hl(-16, -5, 30, 0x1e2226); P.hl(-16, -2, 30, 0x1e2226);
    P.rect(14, -32, 2, 28, ZINK[1]); P.rect(13, -34, 8, 4, 0x18c8e0); P.rect(14, -33, 3, 2, 0x9af0ff); P.hl(12, -30, 10, ZINK[3]);   // konsolen och handtaget
    P.rect(-18, -30, 2, 24, ZINK[1]); P.hl(-18, -30, 32, ZINK[2]);
  });
}
function hogtalarBild() { return bild('hogtalare', 20, 40, 10, 38, (P) => { fyll(P, -9, -36, 8, 0, (X, Y) => tone(JARN, 0.4 + (X === -9 ? 0.3 : 0), X, Y)); P.ell(0, -26, 6, 6, 0x2a2a30, 1, 1); P.ell(0, -26, 3, 3, 0x5a626c, 1, 1); P.ell(0, -10, 4, 4, 0x2a2a30, 1, 1); }); }

// ================= scenen =================
export function makeShopGym(A) {
  const g = A.game;
  if (!BG) BG = paintBg();
  let VW = 384, VH = 216;
  const syncView = () => { VW = Math.max(384, Math.min(A.W || 384, W)); VH = Math.max(160, Math.min(A.H || 216, H)); };
  const walker = createWalker({ W, H, left: 6, right: W - 6, top: WALL_Y + 6, bottom: H - 4, spawn: [(DOOR.x0 + DOOR.x1) / 2, WALL_Y + 12] });
  walker.speed = 72;
  walker.setObstacles([
    [DISK.x, DISK.y, DISK.x + DISK.w, DISK.y + DISK.h],
    [VATTEN.x - 6, VATTEN.y - 6, VATTEN.x + 6, VATTEN.y + 1],
    ...LOPBAND.map((l) => [l.x - 20, l.y - 8, l.x + 18, l.y + 1]),
    [HANTLAR.stall.x0, WALL_Y, HANTLAR.stall.x1, WALL_Y + 6],
    [BOX.x - 10, BOX.fot - 4, BOX.x + 10, BOX.fot + 2],
    [KLASS.podium.x - 18, KLASS.podium.y - 8, KLASS.podium.x + 18, KLASS.podium.y + 4],
    [DANS.x0 - 24, 72, DANS.x0 - 4, 82], [DANS.x1 + 2, 72, DANS.x1 + 22, 82],   // högtalarna
    [548, 120, 560, 128],   // papperskorgen
    [682, 112, 698, 124],   // palmen
  ]);
  walker.snapFree();
  let t = 0, hover = null, hoverT = 0, lockedCam = null, sayIdx = 0, greeted = false;
  let spel = null;             // pågående minispel (se startSpel)
  let bag = { v: 0, a: 0 };    // boxsäckens svängning: vinkel (px i nederkanten) och fart
  let knappar = [];            // minispelets knappar på skärmen [{ id, x, y, w, h, txt }]
  const talk = createSpeech();
  const bSay = (s, secs = 4) => talk.say(s, () => ({ x: DISK.x + 46, y: DISK.y - 36 }), secs, { voice: BENKE });
  const camTarget = () => lockedCam ?? Math.max(0, Math.min(W - VW, (spel ? spel.cx : walker.px) - VW / 2));
  syncView();
  const cam = { x: camTarget() };
  const niva = (gren) => g.gymNiva(gren);
  const nasta = (gren) => { const n = niva(gren); return n >= GYM_NIVAER.length - 1 ? null : GYM_NIVAER[n + 1]; };

  // ---------- receptionen: dagskortet och formen ----------
  const formRad = (gren) => { const n = niva(gren), nx = nasta(gren), p = g.gym[gren] | 0; return `<div class="prow" style="grid-template-columns:auto 1fr auto"><span style="font-size:20px">${GREN_IK[gren]}</span><span class="nm">${esc(GREN_NAMN[gren])} <small class="sp">${$t`nivå ${n}`}</small><br><small class="sp">${nx === null ? $t('högsta nivån!') : $t`${p} / ${nx} poäng till nästa nivå`}</small></span><span class="sp">${'●'.repeat(n)}${'○'.repeat(5 - n)}</span></div>`; };
  function oppnaDisk() {
    play('click');
    const harKort = g.gym.kort === g.day;
    const fart = Math.round((g.gymFart() - 1) * 100), bar = g.gymBar();
    const dlg = openModal($t('💪 Pixel Gym – receptionen'), `<p style="font-size:var(--f2);margin-top:0">${harKort ? $t('Du har dagskort – kör på! Ett pass tar 10 energi.') : $t`Ett dagskort kostar ${fmt(KORT)} och gäller hela dagen. Ett pass tar 10 energi.`}</p>
      <div class="plist">${['styrka', 'kondition', 'rytm'].map(formRad).join('')}</div>
      <p style="font-size:var(--f2);margin-bottom:0">${$t`På jobbet: fötterna ${fart} % snabbare · ${bar} ${bar === 1 ? $t('bricka') : $t('brickor')} i taget.`}</p>`, [
      ...(harKort ? [] : [{ label: $t`🎫 Köp dagskort · ${fmt(KORT)}`, cls: 'btn-go', onClick: () => { if (kopKort()) { closeModal(); bSay($t('Välkommen in! Värm upp lite först så går lyften lättare.'), 4); } } }]),
      { label: $t('Stäng'), onClick: closeModal },
    ]);
    void dlg;
  }
  function kopKort() {
    if (g.gym.kort === g.day) return true;
    if (g.money < KORT) { toast($t`Dagskortet kostar ${fmt(KORT)} – du har inte råd just nu.`, 'bad'); play('fel'); return false; }
    g.money -= KORT; g.gym.kort = g.day; g.save(); play('coin');
    toast($t`🎫 Dagskort köpt (${fmt(KORT)}) – träna så mycket du orkar i dag!`, 'good');
    return true;
  }

  // ---------- minispelen ----------
  const STATION = {
    vikter: { x: HANTLAR.x, y: HANTLAR.y, dir: 'down', cx: HANTLAR.x },
    box: { x: BOX.x - 16, y: BOX.fot + 6, dir: 'right', cx: BOX.x },
    dans: { x: (DANS.x0 + DANS.x1) / 2, y: DANS.y1 - 12, dir: 'down', cx: (DANS.x0 + DANS.x1) / 2 },
    klass: { x: KLASS.x0 + 38, y: KLASS.y + 10, dir: 'down', cx: KLASS.x0 + 40 },
  };
  function kanTrana() {
    if (spel) return false;
    if (g.energy < ENERGI + 5) { toast($t('😪 Du är för trött för att träna – ät något eller sov först.'), 'bad'); play('fel'); return false; }
    return kopKort();
  }
  function startSpel(typ) {
    if (!kanTrana()) return false;
    const S = STATION[typ];
    walker.stop(); walker.px = S.x; walker.py = S.y; walker.dir = S.dir;
    g.energy = Math.max(0, g.energy - ENERGI);
    if (g.gym.dag !== g.day) { g.gym.dag = g.day; g.gym.pass = {}; }
    spel = { typ, t: 0, cx: S.cx, klar: false, perf: 0, max: 1, pose: 0, poseT: 0, combo: 0, best: 0, text: '', textT: 0 };
    if (typ === 'vikter') Object.assign(spel, { fas: 0.1, dir: 1, hast: 0.9, zon: [0.62, 0.84], reps: 0, miss: 0, max: 10, lyft: 0, fel: 0 });
    else if (typ === 'box') Object.assign(spel, { tid: 25, mal: null, paus: 0.6, hits: 0, miss: 0, max: 18 });
    else if (typ === 'dans') { const noter = []; for (let i = 0; i < 32; i++) { const l = Math.floor(hash(i, g.day, 71) * 4); noter.push({ lane: l, t: 2.5 + i * 0.5, hit: null }); if (i % 7 === 3) noter.push({ lane: (l + 2) % 4, t: 2.5 + i * 0.5, hit: null }); } Object.assign(spel, { noter, poang: 0, max: noter.length * 2, miss: 0, slut: 2.5 + 31 * 0.5 + 1.2 }); }
    else if (typ === 'klass') Object.assign(spel, { n: 0, max: 20, ratt: 0, miss: 0, drag: null, paus: 1.2, dur: 1.5 });
    play('fanfare');
    toast(typ === 'vikter' ? $t('🏋️ Tryck när markören är i det gröna fältet – tio lyft!') : typ === 'box' ? $t('🥊 Träffa handsken innan den bleknar – kombo ger extra!') : typ === 'dans' ? $t('💃 Tryck på pilen när den når linjen – i takt!') : $t('🧘 Gör samma rörelse som Mia – snabbt!'), 'wrap');
    return true;
  }
  const pop = (s, secs = 0.8) => { spel.text = s; spel.textT = secs; };
  // ---- hantlarna ----
  function lyft() {
    const S = spel; if (!S || S.typ !== 'vikter' || S.klar) return;
    if (S.fas >= S.zon[0] && S.fas <= S.zon[1]) { S.reps++; S.lyft = 0.4; S.combo++; S.hast += 0.12; const w = Math.max(0.1, (S.zon[1] - S.zon[0]) - 0.02); S.zon = [S.zon[1] - w, S.zon[1]]; play('ok'); pop(S.reps === S.max ? $t('SISTA!') : $t`${S.reps}!`); }
    else { S.miss++; S.fel = 0.45; S.combo = 0; play('miss'); pop($t('FÖR TIDIGT!')); }
    if (S.reps >= S.max || S.reps + S.miss >= 14) avsluta(S.reps / S.max);
  }
  // ---- boxsäcken ----
  const MALPOS = [[-5, -34], [5, -34], [-5, -18], [5, -18]];   // hö/vä uppe/nere på säcken (relativt säckens fot)
  function sla(k) {
    const S = spel; if (!S || S.typ !== 'box' || S.klar || !S.mal) return;
    if (k !== S.mal.pos) { S.miss++; S.combo = 0; play('miss'); pop($t('MISS!')); bag.v += 1.5; return; }
    S.hits++; S.combo++; S.best = Math.max(S.best, S.combo); S.mal = null; S.paus = 0.25 + Math.max(0, 0.3 - S.t * 0.01);
    S.pose = 1; S.poseT = 0.22; bag.v += (k % 2 ? 1 : -1) * (3.5 + Math.min(4, S.combo * 0.5)); play('box');
    pop(S.combo >= 5 ? $t`KOMBO ×${S.combo}!` : S.combo >= 3 ? $t('BRA!') : $t('POW!'));
  }
  // ---- dansgolvet ----
  function dansa(lane) {
    const S = spel; if (!S || S.typ !== 'dans' || S.klar) return;
    let best = null, bd = 1e9;
    for (const n of S.noter) { if (n.hit !== null || n.lane !== lane) continue; const d = Math.abs(n.t - S.t); if (d < bd) { bd = d; best = n; } }
    if (!best || bd > 0.22) { S.combo = 0; play('miss'); pop($t('OOPS')); S.pose = 2; S.poseT = 0.2; return; }
    best.hit = bd <= 0.09 ? 2 : 1; S.poang += best.hit; S.combo++; S.best = Math.max(S.best, S.combo);
    S.pose = best.hit === 2 ? 1 : 0; S.poseT = 0.25; play(best.hit === 2 ? 'ok' : 'click');
    pop(best.hit === 2 ? (S.combo >= 4 ? $t`PERFEKT ×${S.combo}` : $t('PERFEKT!')) : $t('BRA'));
  }
  // ---- gruppasset ----
  function gor(k) {
    const S = spel; if (!S || S.typ !== 'klass' || S.klar) return;
    S.pose = k; S.poseT = 0.7;
    if (!S.drag || S.drag.svar !== undefined) return;
    S.drag.svar = k;
    if (k === S.drag.k) { S.ratt++; S.combo++; play('ok'); pop(S.combo >= 5 ? $t`${S.combo} I RAD!` : $t('RÄTT!')); }
    else { S.miss++; S.combo = 0; play('fel'); pop($t('FEL RÖRELSE')); }
    S.paus = 0.5;
  }
  // ---- slutet: poängen, nivåerna, rutan ----
  function avsluta(perf) {
    const S = spel; if (!S || S.klar) return;
    S.klar = true; S.perf = Math.max(0, Math.min(1, perf));
    const typ = S.typ, gren = GRENAR[typ], p = Math.round(MAXP * S.perf);
    const n0 = g.gym.pass[typ] | 0, faktor = n0 < 2 ? 1 : 0.25, pts = Math.round(p * faktor);
    const fore = { styrka: niva('styrka'), kondition: niva('kondition'), rytm: niva('rytm') };
    g.gym[gren] += pts;
    if (typ === 'dans') g.gym.kondition += Math.round(pts / 2);
    g.gym.pass[typ] = n0 + 1;
    const h = g.glad?.(2, $t('Du tränade på Pixel Gym'), 'gym-' + typ, 2) || 0;
    g.save();
    const upp = ['styrka', 'kondition', 'rytm'].filter((gr) => niva(gr) > fore[gr]);
    play(upp.length ? 'fanfare' : 'coin');
    const rad = typ === 'vikter' ? $t`${S.reps} av ${S.max} lyft i takt` : typ === 'box' ? $t`${S.hits} träffar · bästa kombo ${S.best}` : typ === 'dans' ? $t`${S.poang} av ${S.max} poäng · bästa kombo ${S.best}` : $t`${S.ratt} av ${S.max} rörelser rätt`;
    const vinst = `${GREN_IK[gren]} +${pts} ${esc(GREN_NAMN[gren])}${typ === 'dans' ? ` · 🏃 +${Math.round(pts / 2)} ${esc(GREN_NAMN.kondition)}` : ''}${faktor < 1 ? ` <small class="sp">${$t('(tredje passet i dag – en fjärdedel)')}</small>` : ''}`;
    const effekt = upp.map((gr) => `<p style="font-size:var(--f2);background:#eaf6e4;border:2px solid #46a35a;padding:6px 8px;margin:6px 0 0">${$t`⬆️ ${GREN_NAMN[gr]} nivå ${niva(gr)}!`} ${gr === 'kondition' ? $t`Fötterna är nu ${Math.round((g.gymFart() - 1) * 100)} % snabbare på jobbet.` : gr === 'styrka' ? (g.gymBar() > 1 ? $t`Du bär nu ${g.gymBar()} brickor i taget på jobbet!` : $t('Snart orkar du bära två brickor i taget.')) : $t('Dansgolvet är ditt!')}</p>`).join('');
    openModal(`${SPEL_NAMN[typ]} – ${S.perf >= 0.9 ? $t('SUVERÄNT!') : S.perf >= 0.6 ? $t('BRA JOBBAT!') : $t('BRA FÖRSÖK!')}`, `<p style="font-size:var(--f2);margin-top:0">${rad}</p><p style="font-size:var(--f2)">${vinst}${h ? ` · +${h} 😊` : ''}</p>${effekt}<p style="font-size:var(--f2);margin-bottom:0">${['styrka', 'kondition', 'rytm'].map((gr) => `${GREN_IK[gr]} ${esc(GREN_NAMN[gr])} ${niva(gr)}`).join(' · ')}</p>`, [
      { label: $t('Träna igen'), cls: 'btn-go', onClick: () => { closeModal(); spel = null; startSpel(typ); } },
      { label: $t('Klart'), onClick: () => { closeModal(); spel = null; } },
    ]);
  }
  function avbryt() { if (!spel || spel.klar) return; spel = null; toast($t('Passet avbrutet.')); }

  // ---------- platserna ----------
  const spots = () => [
    { id: 'dorr', r: [DOOR.x0, 18, DOOR.x1, WALL_Y + 6], go: [(DOOR.x0 + DOOR.x1) / 2, WALL_Y + 10], label: $t('UT'), act: () => { play('door'); A.go('city'); } },
    { id: 'disk', r: [DISK.x - 4, DISK.y - 40, DISK.x + DISK.w + 4, DISK.y + DISK.h], go: [DISK.x + 30, DISK.y + DISK.h + 10], label: $t('RECEPTIONEN – DAGSKORT OCH DIN FORM'), act: oppnaDisk },
    { id: 'skap', r: [SKAP.x0, SKAP.y0, SKAP.x1, SKAP.y1], go: [(SKAP.x0 + SKAP.x1) / 2, WALL_Y + 12], label: $t('SKÅPEN'), act: () => { play('click'); toast($t('🔒 Dina grejer ligger i skåp 4. Nyckeln sitter i.')); } },
    { id: 'vatten', r: [VATTEN.x - 8, VATTEN.y - 40, VATTEN.x + 8, VATTEN.y + 2], go: [VATTEN.x + 12, VATTEN.y + 2], label: $t('VATTENAUTOMATEN'), act: () => { play('slide'); g.energy = Math.min(100, g.energy + 2); toast($t('💧 Ett glas kallt vatten. Ahh!'), 'good'); } },
    { id: 'lopband', r: [LOPBAND[0].x - 22, LOPBAND[0].y - 44, LOPBAND[1].x + 20, LOPBAND[1].y + 2], go: [LOPBAND[1].x + 24, LOPBAND[1].y + 8], label: $t('LÖPBANDEN – LO SPRINGER'), act: () => talk.say($t('Kom igen … bara … tre … kilometer till!'), () => ({ x: LOPBAND[0].x, y: LOPBAND[0].y - 44 }), 3, { voice: LO }) },
    { id: 'hantlar', r: [HANTLAR.stall.x0, 20, HANTLAR.stall.x1, HANTLAR.y + 4], go: [HANTLAR.x, HANTLAR.y + 12], label: $t('HANTLARNA – LYFT I TAKT (STYRKA)'), act: () => startSpel('vikter') },
    { id: 'box', r: [BOX.x - 14, BOX.top, BOX.x + 14, BOX.fot + 4], go: [BOX.x - 16, BOX.fot + 8], label: $t('BOXSÄCKEN – SLÅ (STYRKA)'), act: () => startSpel('box') },
    { id: 'dans', r: [DANS.x0, 8, DANS.x1, DANS.y1], go: [(DANS.x0 + DANS.x1) / 2, DANS.y1 - 8], label: $t('DANSGOLVET – DANSA I TAKT (RYTM)'), act: () => startSpel('dans') },
    { id: 'klass', r: [KLASS.x0, 8, KLASS.x1, KLASS.y + 20], go: [KLASS.x0 + 38, KLASS.y + 12], label: $t('GRUPPASSET MED MIA (KONDITION)'), act: () => startSpel('klass') },
  ];
  const spotAt = (x, y) => spots().find((s) => x >= s.r[0] && x <= s.r[2] && y >= s.r[1] && y <= s.r[3]);
  const focusSpot = () => {
    if (spel) return null;
    const h = hover && t - hoverT < 4 && spotAt(hover.x, hover.y);
    if (h) return h;
    if (walker.path.length) return null;
    return spots().find((s) => s.id !== 'dorr' && Math.abs(walker.px - s.go[0]) < 8 && Math.abs(walker.py - s.go[1]) < 8) || null;
  };

  // ---------- ritning: rekvisitan och folket ----------
  function drawDisk(ctx) {
    const d = DISK;
    ctx.fillStyle = '#2a2e36'; ctx.fillRect(d.x, d.y + 6, d.w, d.h - 6); ctx.fillStyle = '#18c8e0'; ctx.fillRect(d.x, d.y + 6, d.w, 2); ctx.fillStyle = '#4a5058'; ctx.fillRect(d.x + 2, d.y + 12, d.w - 4, 1);
    ctx.fillStyle = '#14181c'; ctx.fillRect(d.x + 4, d.y + 14, 16, 8); ctx.fillStyle = '#9af0ff'; ctx.fillRect(d.x + 6, d.y + 16, 12, 2); ctx.fillRect(d.x + 6, d.y + 19, 8, 1);   // datorn
    ctx.fillStyle = '#ffd23f'; ctx.fillRect(d.x + 46, d.y + 14, 14, 9); ctx.fillStyle = '#14181c'; ctx.fillRect(d.x + 48, d.y + 16, 10, 1); ctx.fillRect(d.x + 48, d.y + 19, 7, 1);   // dagskorten
    ctx.fillStyle = '#e04848'; ctx.fillRect(d.x + 28, d.y + 12, 8, 4); ctx.fillStyle = '#f4f1ea'; ctx.fillRect(d.x + 30, d.y + 9, 4, 3);   // vattenflaskan
    const rop = Math.sin(t * 1.3) > 0.92;
    drawPerson(ctx, d.x + 34, d.y + 4, BENKE, 'down', rop ? 10 : Math.sin(t * 0.7) > 0.9 ? 4 : 0);
  }
  function drawLopband(ctx, l, lopare) {
    skugga(ctx, l.x, l.y, 36);
    put(ctx, lopbandBild(), l.x, l.y);
    ctx.fillStyle = '#5a626c'; for (let k = 0; k < 7; k++) ctx.fillRect(l.x - 16 + ((k * 4 + Math.floor(t * 14)) % 28), l.y - 4, 1, 1);   // bandet rullar
    if (lopare) { drawPerson(ctx, l.x - 2, l.y - 4, lopare, 'right', WALK_SEQ[Math.floor(t * 10) % 4]); for (let k = 0; k < 2; k++) if (Math.floor(t * 4 + k) % 3 === 0) { ctx.fillStyle = '#9ad8ff'; ctx.fillRect(l.x - 8 + k * 14, l.y - 34 + k * 3, 1, 2); } }
  }
  function drawHantel(ctx, x, y, w = 7) { ctx.fillStyle = '#2a2a30'; ctx.fillRect(x - 1, y - 2, 2, 4); ctx.fillRect(x + w - 1, y - 2, 2, 4); ctx.fillStyle = '#8a929c'; ctx.fillRect(x + 1, y - 1, w - 2, 1); ctx.fillStyle = '#4a5058'; ctx.fillRect(x + 1, y, w - 2, 1); }
  function drawSaga(ctx) {
    const x = HANTLAR.x - 22, y = HANTLAR.y - 2, upp = Math.floor(t * 1.2) % 2 === 0;
    drawPerson(ctx, x, y, SAGA, 'down', upp ? 10 : 0);
    if (upp) { drawHantel(ctx, x - 9, y - 40); drawHantel(ctx, x + 3, y - 40); } else { drawHantel(ctx, x - 11, y - 14); drawHantel(ctx, x + 5, y - 14); }
  }
  function drawBox(ctx) {
    // kedjan från taket, säcken som svänger (nederkanten förskjuts bag.a px), skuggan på golvet
    const r = BOX.r, len = BOX.fot - 30 - BOX.top;
    ctx.fillStyle = '#5a626c'; ctx.fillRect(BOX.x - 3, BOX.top - 4, 6, 4);
    for (let y = BOX.top; y < BOX.top + 18; y += 2) { const dx = Math.round(bag.a * ((y - BOX.top) / len)); ctx.fillStyle = y % 4 ? '#8a929c' : '#5a626c'; ctx.fillRect(BOX.x - 1 + dx, y, 2, 2); }
    skugga(ctx, BOX.x + Math.round(bag.a * 0.6), BOX.fot + 2, 18, 0.2);
    for (let y = BOX.top + 18; y <= BOX.fot - 12; y++) {
      const dx = Math.round(bag.a * ((y - BOX.top) / len)), k = (y - BOX.top - 18) / (BOX.fot - 30 - BOX.top);
      const top = y < BOX.top + 22, bot = y > BOX.fot - 16;
      ctx.fillStyle = top || bot ? '#14181c' : y % 9 === 0 ? '#8a1a22' : '#c42a34'; ctx.fillRect(BOX.x - r + dx, y, r * 2, 1);
      ctx.fillStyle = top || bot ? '#2a2e36' : '#e04848'; ctx.fillRect(BOX.x - r + 1 + dx, y, 3, 1);
      ctx.fillStyle = '#6a0e16'; ctx.fillRect(BOX.x + r - 2 + dx, y, 1, 1);
      void k;
    }
    ctx.fillStyle = '#f4f1ea'; const ly = BOX.top + 44, ldx = Math.round(bag.a * ((ly - BOX.top) / len)); ctx.fillRect(BOX.x - 5 + ldx, ly, 10, 6); ctx.fillStyle = '#14181c'; ctx.fillRect(BOX.x - 3 + ldx, ly + 2, 6, 1); ctx.fillRect(BOX.x - 2 + ldx, ly + 4, 4, 1);   // etiketten
    // målet (handsken) under boxpasset
    const S = spel;
    if (S && S.typ === 'box' && S.mal && !S.klar) {
      const [mx, my] = MALPOS[S.mal.pos], gx = BOX.x + mx + Math.round(bag.a * ((BOX.fot + my - BOX.top) / len)), gy = BOX.fot + my, a = Math.max(0.25, 1 - S.mal.t / S.mal.liv);
      ctx.globalAlpha = a; ctx.fillStyle = '#ffd23f'; ctx.fillRect(gx - 4, gy - 4, 8, 8); ctx.fillStyle = '#ff4ab0'; ctx.fillRect(gx - 3, gy - 3, 6, 6); ctx.fillStyle = '#ffffff'; ctx.fillRect(gx - 2, gy - 2, 2, 2); ctx.globalAlpha = 1;
      if (Math.floor(t * 8) % 2) { ctx.fillStyle = '#ffffff'; ctx.fillRect(gx - 6, gy, 1, 1); ctx.fillRect(gx + 5, gy, 1, 1); ctx.fillRect(gx, gy - 6, 1, 1); ctx.fillRect(gx, gy + 5, 1, 1); }
    }
  }
  function drawDansgolv(ctx) {
    // rutorna tänds i ett vandrande mönster (snabbare och i takt under dansen), discokulans gnistor
    const S = spel, aktiv = S && S.typ === 'dans' && !S.klar, beat = aktiv ? Math.floor((S.t - 2.5) / 0.5) : Math.floor(t * 1.5);
    const cols = ['#ff4ab0', '#18c8e0', '#ffd23f', '#46e07a', '#9a6ad8'];
    for (let gy = 0; gy < 6; gy++) for (let gx = 0; gx < 6; gx++) {
      const on = ((gx + gy + beat) % 5 === 0) || (aktiv && (gx * 7 + gy * 3 + beat) % 4 === 0);
      if (!on) continue;
      ctx.fillStyle = cols[(gx + gy * 2 + beat) % cols.length]; ctx.globalAlpha = aktiv ? 0.55 : 0.3;
      ctx.fillRect(DANS.x0 + 1 + gx * 18, DANS.y0 + 1 + gy * 13, 17, 12); ctx.globalAlpha = 1;
    }
    for (let k = 0; k < 5; k++) { const u = (t * 0.6 + k * 0.2) % 1; ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.fillRect(DANS.x0 + 10 + Math.round(u * (DANS.x1 - DANS.x0 - 20)), DANS.y0 + 4 + ((k * 23) % 60), 1, 1); }
    if (!aktiv) drawPerson(ctx, DANS.x0 + 30, DANS.y1 - 20, DANSARE, Math.floor(t * 2) % 2 ? 'left' : 'right', Math.floor(t * 4) % 2 ? 10 : WALK_SEQ[Math.floor(t * 8) % 4]);
  }
  function drawKlass(ctx) {
    // Mia på podiet visar rörelsen; eleverna gör samma sak ett ögonblick senare
    const S = spel, aktiv = S && S.typ === 'klass' && !S.klar;
    const k = aktiv && S.drag ? S.drag.k : Math.floor(t / 2) % 4, R = RORELSER[k];
    const fr = (ph) => (R.frame < 0 ? WALK_SEQ[Math.floor((t + ph) * 9) % 4] : R.frame);
    drawPerson(ctx, KLASS.podium.x, KLASS.podium.y - 2, MIA, 'down', fr(0));
    if (aktiv && S.drag) { const ik = R.ik; ctx.fillStyle = 'rgba(20,18,26,.9)'; ctx.fillRect(KLASS.podium.x - 10, KLASS.podium.y - 58, 20, 14); ctx.font = '10px sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.fillText(ik, KLASS.podium.x, KLASS.podium.y - 47); ctx.textAlign = 'left'; }
    drawPerson(ctx, KLASS.x0 + 12, KLASS.y + 8, ELEV[0], 'down', fr(0.15));
    drawPerson(ctx, KLASS.x0 + 66, KLASS.y + 8, ELEV[1], 'down', fr(0.3));
  }
  function drawJag(ctx) {
    // figuren vid stationen under passet, annars den vanliga
    const S = spel;
    if (!S) return;
    const P = STATION[S.typ];
    if (S.typ === 'vikter') {
      const upp = S.lyft > 0, fel = S.fel > 0, ox = fel ? Math.round(Math.sin(t * 40) * 1.5) : 0;
      drawPerson(ctx, P.x + ox, P.y, A.avatar.look, 'down', upp ? 10 : 0);
      if (upp) { drawHantel(ctx, P.x + ox - 9, P.y - 40); drawHantel(ctx, P.x + ox + 3, P.y - 40); } else { drawHantel(ctx, P.x + ox - 11, P.y - 14); drawHantel(ctx, P.x + ox + 5, P.y - 14); }
    } else if (S.typ === 'box') {
      drawPerson(ctx, P.x, P.y, A.avatar.look, 'right', S.poseT > 0 ? 9 : Math.floor(t * 6) % 2 ? 4 : 0);
      ctx.fillStyle = '#e04848'; if (S.poseT > 0) { ctx.fillRect(P.x + 6, P.y - 18, 5, 4); } else { ctx.fillRect(P.x + 2, P.y - 16, 4, 4); ctx.fillRect(P.x + 3, P.y - 21, 4, 4); }   // handskarna
    } else if (S.typ === 'dans') {
      const fr = S.poseT > 0 ? (S.pose === 1 ? 10 : S.pose === 2 ? 4 : 11) : WALK_SEQ[Math.floor(S.t * 4) % 4];
      drawPerson(ctx, P.x, P.y, A.avatar.look, Math.floor(S.t * 2) % 2 ? 'left' : 'right', fr);
    } else if (S.typ === 'klass') {
      const R = RORELSER[S.poseT > 0 ? S.pose : (S.drag ? S.drag.k : 0)], fr = R.frame < 0 ? WALK_SEQ[Math.floor(t * 9) % 4] : S.poseT > 0 ? R.frame : 0;
      drawPerson(ctx, P.x, P.y, A.avatar.look, 'down', fr);
    }
  }
  function label(ctx, s, cx) {
    if (!s) return;
    const txt = s.label, w = textW(SMALL, txt) + 10, x = Math.round(Math.max(cx + 2, Math.min(cx + VW - w - 2, (s.r[0] + s.r[2]) / 2 - w / 2))), y = Math.max(2, s.r[1] - 13);
    ctx.fillStyle = 'rgba(20,24,28,.92)'; ctx.fillRect(x, y, w, 11); ctx.fillStyle = '#18c8e0'; ctx.fillRect(x, y + 10, w, 1);
    ctxText(ctx, SMALL, txt, x + 5, y + 3, '#ffd23f');
  }
  // ---------- minispelets skärmlager (skärmkoordinater, innanför den synliga rutan) ----------
  function knapp(ctx, k, aktiv, farg = '#18c8e0') {
    ctx.fillStyle = 'rgba(20,24,28,.9)'; ctx.fillRect(k.x, k.y, k.w, k.h); ctx.fillStyle = aktiv ? '#ffffff' : farg; ctx.fillRect(k.x, k.y, k.w, 2); ctx.fillRect(k.x, k.y + k.h - 2, k.w, 2);
    if (k.ik) { ctx.font = '10px sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.fillText(k.ik, k.x + k.w / 2, k.y + 11); ctx.textAlign = 'left'; }
    if (k.pil !== undefined) { ritaPil(ctx, k.pil, Math.round(k.x + k.w / 2) - 3, Math.round(k.y + k.h / 2) - 3, aktiv ? '#ffffff' : ['#ff4ab0', '#18c8e0', '#ffd23f', '#46e07a'][k.pil]); return; }
    const tw = textW(SMALL, k.txt); ctxText(ctx, SMALL, k.txt, Math.round(k.x + (k.w - tw) / 2), k.y + k.h - 9, aktiv ? '#ffffff' : '#ffd23f');
  }
  function drawSpelHud(ctx) {
    const S = spel; knappar = [];
    if (!S || S.klar) return;
    const R = synligRuta(VH), top = R.y0 + 3, bot = R.y1;
    // rubriken och mätaren överst
    const namn = SPEL_RUBRIK[S.typ], w = textW(SMALL, namn) + 10;
    ctx.fillStyle = 'rgba(20,24,28,.9)'; ctx.fillRect(4, top, w, 11); ctxText(ctx, SMALL, namn, 9, top + 3, '#9af0ff');
    let info = '';
    if (S.typ === 'vikter') info = $t`LYFT ${S.reps}/${S.max}`;
    else if (S.typ === 'box') info = $t`TID ${Math.max(0, Math.ceil(S.tid - S.t))}  TRÄFFAR ${S.hits}  KOMBO ${S.combo}`;
    else if (S.typ === 'dans') info = $t`POÄNG ${S.poang}  KOMBO ${S.combo}`;
    else info = $t`RÖRELSE ${Math.min(S.max, S.n)}/${S.max}  RÄTT ${S.ratt}`;
    const iw = textW(SMALL, info) + 10; ctx.fillStyle = 'rgba(20,24,28,.9)'; ctx.fillRect(VW - iw - 4, top, iw, 11); ctxText(ctx, SMALL, info, VW - iw + 1, top + 3, '#ffd23f');
    if (S.textT > 0) { const tw = textW(BIG, S.text); ctxText(ctx, BIG, S.text, Math.round((VW - tw) / 2), top + 16, S.text.includes('!') && !/MISS|OOPS|FEL|TIDIGT/.test(S.text) ? '#46e07a' : '#ff8a8a'); }
    // knapparna nederst
    const kh = 22, ky = bot - kh - 4;
    if (S.typ === 'vikter') knappar.push({ id: 'lyft', x: Math.round(VW / 2) - 40, y: ky, w: 80, h: kh, txt: $t('LYFT!') });
    else if (S.typ === 'dans') PILAR.forEach((p, i) => knappar.push({ id: 'lane' + i, x: Math.round(VW / 2) - 88 + i * 44, y: ky, w: 40, h: kh, txt: p, pil: i }));
    else if (S.typ === 'klass') RORELSER.forEach((r, i) => knappar.push({ id: 'gor' + i, x: Math.round(VW / 2) - 92 + i * 46, y: ky, w: 44, h: kh, ik: r.ik, txt: r.namn }));
    else knappar.push({ id: 'info', x: Math.round(VW / 2) - 60, y: ky, w: 120, h: kh - 6, txt: $t('TRYCK PÅ HANDSKEN') });
    knappar.push({ id: 'avbryt', x: 4, y: ky + (kh - 12), w: 36, h: 12, txt: $t('SLUTA') });
    for (const k of knappar) { let aktiv = false; if (S.typ === 'dans' && k.id.startsWith('lane')) aktiv = S.poseT > 0.15 && S.lane === +k.id.slice(4); if (S.typ === 'klass' && k.id.startsWith('gor')) aktiv = S.poseT > 0.4 && S.pose === +k.id.slice(3); knapp(ctx, k, aktiv, k.id === 'avbryt' ? '#8a929c' : '#18c8e0'); }
    // hantlarna: kraftmätaren vid figuren (i skärmkoordinater: stationens x minus kameran)
    if (S.typ === 'vikter') {
      const mx = Math.round(HANTLAR.x + 26 - cam.x), my0 = HANTLAR.y - 52, mh = 48;
      ctx.fillStyle = 'rgba(20,24,28,.9)'; ctx.fillRect(mx - 4, my0 - 2, 10, mh + 4);
      ctx.fillStyle = '#46e07a'; ctx.fillRect(mx - 2, Math.round(my0 + mh * (1 - S.zon[1])), 6, Math.max(1, Math.round(mh * (S.zon[1] - S.zon[0]))));
      ctx.fillStyle = '#2a2e36'; ctx.fillRect(mx - 2, my0, 6, 1); ctx.fillRect(mx - 2, my0 + mh - 1, 6, 1);
      ctx.fillStyle = '#ffd23f'; ctx.fillRect(mx - 4, Math.round(my0 + mh * (1 - S.fas)) - 1, 10, 3); ctx.fillStyle = '#ffffff'; ctx.fillRect(mx - 3, Math.round(my0 + mh * (1 - S.fas)), 8, 1);
    }
    // dansen: lanorna över dansgolvet med fallande pilar och träfflinjen
    if (S.typ === 'dans') {
      const lx0 = Math.round((DANS.x0 + DANS.x1) / 2 - cam.x) - 36, ly1 = DANS.y1 - 26, ly0 = Math.max(top + 14, ly1 - 90);
      ctx.fillStyle = 'rgba(20,24,28,.55)'; ctx.fillRect(lx0 - 2, ly0, 76, ly1 - ly0 + 8);
      for (let i = 0; i < 4; i++) { ctx.fillStyle = 'rgba(154,240,255,.25)'; ctx.fillRect(lx0 + i * 18 + 17, ly0, 1, ly1 - ly0 + 8); }
      ctx.fillStyle = '#ffd23f'; ctx.fillRect(lx0 - 2, ly1, 76, 2);
      for (const n of S.noter) {
        if (n.hit !== null) continue;
        const y = ly1 - (n.t - S.t) * 60; if (y < ly0 - 6 || y > ly1 + 14) continue;
        const x = lx0 + n.lane * 18 + 4; ctx.fillStyle = n.t - S.t < 0 ? '#8a929c' : ['#ff4ab0', '#18c8e0', '#ffd23f', '#46e07a'][n.lane]; ctx.fillRect(x - 1, Math.round(y) - 6, 11, 11); ritaPil(ctx, n.lane, x + 1, Math.round(y) - 4, '#14181c');
      }
    }
  }
  function tryckKnapp(sx, sy) {
    for (const k of knappar) if (sx >= k.x && sx < k.x + k.w && sy >= k.y && sy < k.y + k.h) {
      if (k.id === 'lyft') lyft(); else if (k.id.startsWith('lane')) { dansa(+k.id.slice(4)); if (spel) spel.lane = +k.id.slice(4); } else if (k.id.startsWith('gor')) gor(+k.id.slice(3)); else if (k.id === 'avbryt') avbryt();
      return true;
    }
    return false;
  }
  function boxTryck(x, y) {   // ett tryck på själva säcken (världskoordinater): närmaste målet eller miss
    const S = spel; if (!S || S.typ !== 'box' || !S.mal) return;
    const len = BOX.fot - 30 - BOX.top; let best = -1, bd = 1e9;
    MALPOS.forEach(([mx, my], i) => { const gx = BOX.x + mx + Math.round(bag.a * ((BOX.fot + my - BOX.top) / len)), gy = BOX.fot + my, d = Math.hypot(gx - x, gy - y); if (d < bd) { bd = d; best = i; } });
    if (bd < 14) sla(best);
  }

  return {
    viewMax: { w: W, h: H },
    get worldX() { return walker.px; }, get worldY() { return walker.py; },
    update(dt) {
      dt = Math.min(0.1, Math.max(0, dt));
      t += dt; syncView();
      if (!spel) walker.update(dt);
      // boxsäcken: en fjädrad pendel
      bag.v += (-bag.a * 9 - bag.v * 1.6) * dt; bag.a += bag.v * dt * 10;
      if (spel && !spel.klar && !modalOpen()) {
        const S = spel; S.t += dt;
        if (S.textT > 0) S.textT -= dt;
        if (S.poseT > 0) S.poseT -= dt;
        if (S.typ === 'vikter') {
          S.fas += S.dir * S.hast * dt; if (S.fas >= 1) { S.fas = 1; S.dir = -1; } else if (S.fas <= 0) { S.fas = 0; S.dir = 1; }
          if (S.lyft > 0) S.lyft -= dt; if (S.fel > 0) S.fel -= dt;
        } else if (S.typ === 'box') {
          if (S.mal) { S.mal.t += dt; if (S.mal.t >= S.mal.liv) { S.mal = null; S.miss++; S.combo = 0; S.paus = 0.35; pop($t('FÖR SENT')); } }
          else { S.paus -= dt; if (S.paus <= 0) S.mal = { pos: Math.floor(hash(Math.floor(S.t * 10), S.hits, 13) * 4), t: 0, liv: Math.max(0.55, 1.15 - S.t * 0.02) }; }
          if (S.t >= S.tid) avsluta(S.hits / S.max);
        } else if (S.typ === 'dans') {
          for (const n of S.noter) if (n.hit === null && S.t - n.t > 0.25) { n.hit = 0; S.miss++; S.combo = 0; }
          if (S.t >= S.slut) avsluta(S.poang / S.max);
        } else if (S.typ === 'klass') {
          if (S.drag) { if (S.drag.svar !== undefined) { S.paus -= dt; if (S.paus <= 0) S.drag = null; } else if (S.t - S.drag.t0 > S.dur) { S.drag.svar = -1; S.miss++; S.combo = 0; S.paus = 0.4; pop($t('FÖR LÅNGSAMT')); play('miss'); } }
          else if (S.n >= S.max) avsluta(S.ratt / S.max);
          else { S.paus -= dt; if (S.paus <= 0) { S.n++; S.dur = Math.max(0.75, 1.5 - S.n * 0.04); S.drag = { k: Math.floor(hash(S.n, g.day, 17) * 4), t0: S.t }; } }
        }
      }
      if (!greeted && t > 0.8) { greeted = true; bSay(BENKE_SAY[0], 5); sayIdx = 1; }
      const k = lockedCam !== null ? 1 : Math.min(1, dt * 6);
      cam.x += (camTarget() - cam.x) * k;
    },
    draw(ctx) {
      syncView();
      const cx = Math.round(cam.x);
      ctx.setTransform(A.pxs, 0, 0, A.pxs, -cx * A.pxs, 0);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(BG, cx, 0, VW, H, cx, 0, VW, H);
      ritaLampsken(ctx, [120, 420], 30, '160,232,255');
      drawDansgolv(ctx);
      const focus = focusSpot();
      if (focus && focus.id !== 'dorr') { ctx.fillStyle = 'rgba(255,210,63,.12)'; ctx.fillRect(focus.r[0], focus.r[1], focus.r[2] - focus.r[0], focus.r[3] - focus.r[1]); }
      const list = [...folkDrawables(A, t)];
      if (!spel) list.push(selfDrawable(A, walker, t)); else list.push({ fy: STATION[spel.typ].y + 0.5, draw: () => drawJag(ctx) });
      list.push({ fy: DISK.y + DISK.h, draw: () => drawDisk(ctx) });
      list.push({ fy: VATTEN.y, draw: () => ritaVattenautomat(ctx, VATTEN.x, VATTEN.y) });
      list.push({ fy: LOPBAND[0].y, draw: () => drawLopband(ctx, LOPBAND[0], LO) }, { fy: LOPBAND[1].y, draw: () => drawLopband(ctx, LOPBAND[1], null) });
      list.push({ fy: HANTLAR.y - 2, draw: () => drawSaga(ctx) });
      list.push({ fy: BOX.fot + 1, draw: () => drawBox(ctx) });
      list.push({ fy: 82, draw: () => { put(ctx, hogtalarBild(), DANS.x0 - 12, 82); put(ctx, hogtalarBild(), DANS.x1 + 12, 82); if (spel?.typ === 'dans') { ctx.fillStyle = 'rgba(154,240,255,.5)'; const b = Math.floor(spel.t * 2) % 2; ctx.fillRect(DANS.x0 - 16 - b, 52, 8 + b * 2, 1); ctx.fillRect(DANS.x1 + 8 - b, 52, 8 + b * 2, 1); } } });
      list.push({ fy: KLASS.y + 9, draw: () => drawKlass(ctx) });
      list.push({ fy: 124, draw: () => ritaKrukvaxt(ctx, 690, 124, 'palm') }, { fy: 128, draw: () => ritaPapperskorg(ctx, 554, 128, 0x18c8e0) }, { fy: 120, draw: () => ritaKrukvaxt(ctx, 338, 120, 'ficus') });
      list.sort((a, b) => a.fy - b.fy).forEach((d) => d.draw(ctx));
      talk.draw(ctx, { x0: cx, x1: cx + VW });
      label(ctx, focus, cx);
      ctx.setTransform(A.pxs, 0, 0, A.pxs, 0, 0);
      drawSpelHud(ctx);
    },
    down(sx, sy) {
      if (spel && !spel.klar) {
        if (tryckKnapp(sx, sy)) return;
        const x = sx + cam.x;
        if (spel.typ === 'vikter') lyft();
        else if (spel.typ === 'box') boxTryck(x, sy);
        return;
      }
      if (spel) return;
      const x = sx + cam.x, y = sy;
      hover = null;
      const s = spotAt(x, y);
      if (s) { walker.walkTo(s.go[0], s.go[1], s.act); return; }
      if (y > WALL_Y) walker.walkTo(x, y);
    },
    move(sx, sy) { hover = { x: sx + cam.x, y: sy }; hoverT = t; },
    key(k) {
      if (!spel || spel.klar) return;
      if (k === 'Escape') { avbryt(); return; }
      if (spel.typ === 'vikter' && (k === ' ' || k === 'Enter' || k === 'ArrowUp')) lyft();
      else if (spel.typ === 'dans') { const i = PILKEY.indexOf(k); if (i >= 0) { dansa(i); spel.lane = i; } }
      else if (spel.typ === 'klass') { const i = k >= '1' && k <= '4' ? +k - 1 : PILKEY.indexOf(k); if (i >= 0) gor(i); }
      else if (spel.typ === 'box' && spel.mal) {
        const p = spel.mal.pos, ok = (k === 'ArrowLeft' && p % 2 === 0) || (k === 'ArrowRight' && p % 2 === 1) || (k === 'ArrowUp' && p < 2) || (k === 'ArrowDown' && p >= 2);
        if (PILKEY.includes(k)) sla(ok ? p : (p + 1) % 4);
      }
    },
    exit() { talk.clear(); spel = null; },
    _debug: {
      spots: () => spots().map((s) => s.id),
      act: (id) => { const s = spots().find((q) => q.id === id); if (!s) return false; s.act(); return true; },
      start: (typ) => startSpel(typ),
      spel: () => (spel ? { typ: spel.typ, t: spel.t, klar: spel.klar, reps: spel.reps, hits: spel.hits, poang: spel.poang, ratt: spel.ratt, miss: spel.miss, mal: spel.mal ? spel.mal.pos : null, drag: spel.drag ? spel.drag.k : null, fas: spel.fas, zon: spel.zon, noter: spel.noter?.filter((n) => n.hit === null).length } : null),
      lyft: () => { if (spel?.typ === 'vikter') { spel.fas = (spel.zon[0] + spel.zon[1]) / 2; lyft(); } },
      sla: (ratt = true) => { if (spel?.typ === 'box' && spel.mal) sla(ratt ? spel.mal.pos : (spel.mal.pos + 1) % 4); },
      dansa: () => { if (spel?.typ === 'dans') { const n = spel.noter.find((q) => q.hit === null && q.t >= spel.t - 0.2); if (n) { spel.t = n.t; dansa(n.lane); } } },
      gor: (ratt = true) => { if (spel?.typ === 'klass' && spel.drag && spel.drag.svar === undefined) gor(ratt ? spel.drag.k : (spel.drag.k + 1) % 4); },
      snabba: (sek) => { t += sek; if (spel) spel.t += sek; },
      hoppa: () => { if (spel) spel.paus = 0; },   // (testerna: nästa rörelse/handske direkt)
      form: () => ({ ...g.gym, nivaer: { styrka: niva('styrka'), kondition: niva('kondition'), rytm: niva('rytm') }, fart: g.gymFart(), bar: g.gymBar() }),
      teleport: (x, y) => { walker.px = x; walker.py = y; walker.stop(); walker.snapFree(); cam.x = camTarget(); },
      pos: () => ({ x: Math.round(walker.px), y: Math.round(walker.py) }),
      cam: () => ({ x: cam.x, VW, VH }),
      knappar: () => knappar.map((k) => ({ id: k.id, x: k.x + k.w / 2, y: k.y + k.h / 2 })),
      benke: () => talk.text?.() ?? null,
    },
  };
}
