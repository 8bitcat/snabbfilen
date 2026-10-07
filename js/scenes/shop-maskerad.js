// MASKERADBUTIKEN – maskerad, utklädnad och Halloween i det gamla övergivna huset i förorten
// (Carl 2026-10-06: "en butik som säljer maskeradsaker och utklädnader … halloween tema …
// pumpor, spökdräkt, olika typer av dräkter … tända pumporna med ljus").
//
// 640 px bred, kameran följer figuren. Från vänster: dörren UT, HATTVÄGGEN med masker och öron på
// byster, DRÄKTERNA på dockor i två rader (häxa, trollkarl, vampyr, pirat – superhjälte, djävul,
// fé, ängel), provhytten. I mitten KASSAN där häxan Hilda står, den stora kitteln som bubblar och
// SPÖKLÅDAN (klicka – om du vågar). Till höger PUMPOR & PYNT: pumphögen, väggen med spindelnät
// och fladdermöss, gravstenarna, skelettet, fågelskrämmorna, gargoylen och spökträdet.
//
// Dräkterna köps som hela dräkter (openKit, klader/buy.js) – det man redan har tar man bara på
// sig. Hattarna (openBuy) och pyntet (möbeldialogen openFurnBuy) som i de andra butikerna. Pumplyktan
// tänds hemma (room.js function 'lykta').
//
// _debug-API för tools/maskerad-test.mjs.
import { drawPerson } from '../core/people.js';
import { Pix, SMALL, BIG, ctxText, textW, text, mix, mul, hash, bayer } from '../core/floor-pix.js';
import { toast } from '../core/ui.js';
import { play } from '../core/sound.js';
import { createWalker, selfDrawable, folkDrawables, createSpeech } from './walkable.js';
import { itemById } from '../data/wardrobe.js';
import { openBuy, openKit, owns, priceOf } from './klader/buy.js';
import { openBuy as openFurnBuy } from './shop-mobler.js';
import { furnArt, drawArt, halo } from './room.js';
import { katalogOf } from '../game.js';
import { FRAMES } from '../data/frames.js';
import { $t } from '../core/i18n.js';

const W = 640, H = 216, WALL_Y = 72;
const DOOR = { x0: 18, x1: 50 };
const HATWALL = { x: 62, y: 18, w: 160 };
const FITTING = { x: 276, w: 40 };
const DESK = { x: 336, y: 80, w: 72, h: 30 };
const KITTEL = { x: 360, y: 150 };
const KISTA = { x: 420, y: 196 };
const GRAN = (k, v, x, y, wall = false) => ({ k, v, x, y, wall });
// pyntet: väggsakerna [underkant] och golvsakerna [fot]
const PYNT = [
  GRAN('spindelnat', 0, 440, 34, true), GRAN('fladdermoss', 0, 470, 30, true), GRAN('spindelnat', 0, 604, 34, true),
  GRAN('pumpa', 0, 448, 112), GRAN('pumpa', 1, 470, 112), GRAN('pumplykta', 0, 494, 112), GRAN('pumplykta', 1, 516, 112), GRAN('pumplykta', 2, 538, 112),
  GRAN('gravsten', 0, 566, 112), GRAN('gravsten', 2, 586, 112),
  GRAN('skelett', 0, 450, 176), GRAN('haxkittel', 0, 478, 176), GRAN('fagelskramma', 2, 502, 180), GRAN('fagelskramma', 0, 538, 180),
  GRAN('gargoyl', 0, 574, 180), GRAN('spoktrad', 1, 604, 184),
];
// dräkterna: namn, plats (x, fot-y), delarna [id, färger, valfri?] och dockans utseende
const MANNE = { skin: '#ece6ee', style: 'bald', hair: '#ecd489', beard: false, glasses: false, phones: false, bag: null, blush: false, hat: null, top: 'tee', shirt: '#f4f1ea', accent: '#f4f1ea', bottom: 'jeans', pants: '#3f5f8f', shoes: '#1c1c1c', cap: '#d9433b', build: 5 };
const doll = (o) => ({ ...MANNE, ...o });
const DRAKTER = [
  { id: 'haxa', namn: $t('HÄXA'), x: 80, y: 116, parts: [['hat-witch', { cap: '#26242c', accent: '#8e5bd1' }], ['top-robe', { shirt: '#26242c' }]],
    look: doll({ style: 'long', hair: '#3b2619', hat: 'witch', cap: '#26242c', accent: '#8e5bd1', top: 'robe', shirt: '#26242c', bottom: 'skirt', pants: '#26242c', shoes: '#1c1c1c', build: 4 }) },
  { id: 'trollkarl', namn: $t('TROLLKARL'), x: 124, y: 116, parts: [['hat-wizard', { cap: '#3f4fa8' }], ['top-robe-stars', { shirt: '#3f4fa8', print2: '#f8d860' }]],
    look: doll({ style: 'short', hair: '#f4f1ea', beard: 'long', hat: 'wizard', cap: '#3f4fa8', top: 'robe', topPrint: 'stars', shirt: '#3f4fa8', print2: '#f8d860', bottom: 'pants', pants: '#2d3a5c' }) },
  { id: 'vampyr', namn: $t('VAMPYR'), x: 168, y: 116, parts: [['top-vampire', { shirt: '#1d1d22', accent: '#b8262e' }]],
    look: doll({ style: 'side', hair: '#1d1714', top: 'vampire', shirt: '#1d1d22', accent: '#b8262e', bottom: 'suitPants', pants: '#1d1d22' }) },
  { id: 'pirat', namn: $t('PIRAT'), x: 212, y: 116, parts: [['hat-pirate', { cap: '#1d1d22' }], ['top-pirate', { shirt: '#8a2a2e', accent: '#e8b830' }], ['glasses-eyepatch', {}]],
    look: doll({ style: 'long', hair: '#6b4226', hat: 'pirate', cap: '#1d1d22', top: 'pirate', shirt: '#8a2a2e', accent: '#e8b830', glasses: 'eyepatch', bottom: 'pants', pants: '#3a2a1a' }) },
  { id: 'hjalte', namn: $t('HJÄLTE'), x: 76, y: 176, parts: [['top-hero', { shirt: '#3a7bd5', accent: '#d9433b' }], ['glasses-heromask', {}]],
    look: doll({ style: 'short', hair: '#1d1714', top: 'hero', shirt: '#3a7bd5', accent: '#d9433b', glasses: 'heroMask', bottom: 'leggings', pants: '#3a7bd5' }) },
  { id: 'djavul', namn: $t('DJÄVUL'), x: 116, y: 176, parts: [['hat-devil', { cap: '#d83a4a' }], ['top-vampire', { shirt: '#b8262e', accent: '#1d1d22' }]],
    look: doll({ style: 'messy', hair: '#1d1714', hat: 'devil', cap: '#d83a4a', top: 'vampire', shirt: '#b8262e', accent: '#1d1d22', bottom: 'pants', pants: '#7a1a20' }) },
  { id: 'fe', namn: $t('FÉ'), x: 156, y: 176, parts: [['bag-fairywings', { bagColor: '#c8f0ff' }], ['bottom-tutu', { shirt: '#f2a0d8', pants2: '#f2a0d8' }], ['hat-tiara', {}, true]],
    look: doll({ style: 'bun', hair: '#ecd489', bag: 'fairyWings', bagColor: '#c8f0ff', bottom: 'tutu', shirt: '#f2a0d8', pants2: '#f2a0d8', pants: '#f2a0d8', hat: 'tiara', blush: true, build: 4 }) },
  { id: 'angel', namn: $t('ÄNGEL'), x: 196, y: 176, parts: [['bag-wings', { bagColor: '#f4f1ea' }], ['hat-halo', { cap: '#f8d860' }]],
    look: doll({ style: 'wavy', hair: '#d9a95c', bag: 'wings', bagColor: '#f4f1ea', hat: 'halo', cap: '#f8d860', top: 'tee', shirt: '#f4f1ea', bottom: 'skirt', pants: '#f4f1ea', blush: true, build: 4 }) },
  // de nya Halloween-dräkterna (0.88): spöket (lakan), skelettet och pumpan
  { id: 'spoke', namn: $t('SPÖKE'), x: 256, y: 116, parts: [['hat-ghost', { cap: '#f4f6fa' }]],
    look: doll({ style: 'short', hair: '#3b2619', hat: 'ghost', cap: '#f4f6fa' }) },
  { id: 'skelett', namn: $t('SKELETT'), x: 236, y: 176, parts: [['top-hoodie-skeleton', { shirt: '#1c1c22', print2: '#f4f1ea' }], ['bottom-leggings-skeleton', { pants: '#1c1c22', pants2: '#f4f1ea' }]],
    look: doll({ style: 'buzz', hair: '#1d1714', top: 'hoodie', topPrint: 'skeleton', shirt: '#1c1c22', print2: '#f4f1ea', bottom: 'leggings', bottomPrint: 'skeleton', pants: '#1c1c22', pants2: '#f4f1ea' }) },
  { id: 'pumpa', namn: $t('PUMPA'), x: 276, y: 176, parts: [['top-puffer-pumpkin', { shirt: '#e0701c', print2: '#1c1820' }]],
    look: doll({ style: 'messy', hair: '#6b4226', top: 'puffer', topPrint: 'pumpkin', shirt: '#e0701c', print2: '#1c1820', bottom: 'pants', pants: '#2f6a2a', hat: 'beanie', cap: '#2f8f46' }) },
];
// hattväggen: byster på två hyllor
const HATTAR = [['hat-witch', '#26242c'], ['hat-catears', '#1d1d22'], ['hat-bunnyears', '#f4f1ea'], ['hat-unicorn', '#f2a0b8'],
  ['hat-viking', '#8a5a33'], ['glasses-heromask', null]];
const HILDA = { skin: '#b8d8a0', hair: '#26242c', style: 'long', hat: 'witch', cap: '#26242c', accent: '#46a35a', top: 'robe', shirt: '#4a2a5a', bottom: 'skirt', pants: '#26242c', shoes: '#1c1c1c', glasses: 'round', beard: false, phones: false, bag: null, blush: false, build: 4 };
const HILDA_SAY = [
  $t('Hihihi! Välkommen till Maskeraden! 🎃 Prova en dräkt – du ser dig själv i den direkt.'),
  $t('Har du en dräkt på dig? Tryck på 🎭-knappen så gör den sin grej – spöket skrämmer, fén trollar!'),
  $t('Pumplyktorna tänder du hemma – klicka på pumpan så får den ljus i sig!'),
  $t('Våga öppna spöklådan där borta … om du törs. 👻'),
  $t('Häxhatten är min egen design. Den sitter som gjuten!'),
  $t('Kitteln? Bara lite trolldryck. Smaka inte!'),
];

// ================= bakgrunden =================
let BG = null;
function paintBg() {
  const P = new Pix(W, H);
  // väggen: mörklila tapet med orange fladdermusmönster
  const BAT = ['#.....#', '##.#.##', '.#####.', '..#.#..'];
  for (let y = 0; y < WALL_Y; y++) for (let x = 0; x < W; x++) {
    let c = ((x / 12) | 0) % 2 ? 0x3a2248 : 0x34203f;
    c = mix(c, 0x000000, (bayer(x, y) - 0.5) * 0.08);
    P.px(x, y, c);
  }
  for (let y = 8; y < 56; y += 16) for (let x = 6; x < W - 8; x += 26) {
    const ox = x + (((y / 16) | 0) % 2 ? 13 : 0);
    BAT.forEach((r, j) => { for (let i = 0; i < 7; i++) if (r[i] === '#') P.px(ox + i, y + j, 0xe8762a, 0.22); });
  }
  // bröstpanel och taklist
  for (let x = 0; x < W; x++) for (let y = WALL_Y - 12; y < WALL_Y; y++) P.px(x, y, y === WALL_Y - 12 ? 0xe8762a : y === WALL_Y - 11 ? 0xffa060 : y >= WALL_Y - 2 ? 0x1a1020 : (x % 20 === 0 ? 0x1e1228 : 0x2a1a34));
  P.rect(0, 0, W, 3, 0x1a1020); P.hl(0, 3, W, 0x5a3a6a);
  // spindelnät i taket här och där
  for (const cx of [2, 230, 330, 636]) for (let r = 2; r < 12; r++) { P.px(cx + (cx > 600 ? -r : r), 4, 0xe8ecf0, 0.4); P.px(cx, 4 + r, 0xe8ecf0, 0.4); P.px(cx + (cx > 600 ? -1 : 1) * Math.round(r * 0.7), 4 + Math.round(r * 0.7), 0xe8ecf0, 0.4); }
  // dörren UT
  P.rect(DOOR.x0 - 3, 20, DOOR.x1 - DOOR.x0 + 6, WALL_Y - 20, 0x1a1020);
  for (let y = 22; y < WALL_Y; y++) for (let x = DOOR.x0; x < DOOR.x1; x++) P.px(x, y, mix(0x6a3a22, 0x4a2a16, ((x - DOOR.x0) % 8 === 0 ? 0.6 : 0) + hash(x >> 2, y, 3) * 0.2));
  P.vl(DOOR.x0 + 16, 22, WALL_Y - 22, 0x2a1a10);
  P.rect(DOOR.x0 + 6, 26, 20, 9, 0x1d2b1f); text(P, SMALL, $t('UT'), DOOR.x0 + 12, 28, 0x6fe08a);
  P.px(DOOR.x0 + 13, 48, 0xe8b830); P.px(DOOR.x0 + 18, 48, 0xe8b830);
  // skyltarna
  bigSign(P, $t('DRÄKTER'), 200, 4, 0x1e1228, 0xe8762a, 0xffb060);
  bigSign(P, $t('KASSA'), DESK.x + DESK.w / 2, 4, 0x1e1228, 0x8af08a, 0xc8ffc8);
  bigSign(P, $t('PUMPOR + PYNT'), 530, 4, 0x1e1228, 0xe8762a, 0xffb060);
  // hattväggen: två hyllor
  const hw = HATWALL;
  P.rect(hw.x, hw.y + 8, hw.w, 34, 0x24142e); P.box(hw.x, hw.y + 8, hw.w, 34, 0xe8762a);
  const ml = $t('MASKER + HATTAR'), mw = textW(SMALL, ml) + 8; P.rect(hw.x + hw.w / 2 - mw / 2, hw.y + 2, mw, 9, 0x17151a); text(P, SMALL, ml, hw.x + hw.w / 2 - mw / 2 + 4, hw.y + 4, 0xffb060);
  { const sy = hw.y + 40; P.rect(hw.x + 1, sy, hw.w - 2, 2, 0xc89a60); P.hl(hw.x + 1, sy, hw.w - 2, 0xe8c080); P.hl(hw.x + 1, sy + 2, hw.w - 2, 0x5a3a20); }
  // provhytten
  const f = FITTING;
  P.rect(f.x, 18, f.w, WALL_Y - 18, 0x1a1020); P.rect(f.x + 2, 22, f.w - 4, WALL_Y - 22, 0x2a1a34);
  for (let y = 23; y < WALL_Y - 1; y++) for (let x = f.x + 3; x < f.x + f.w - 3; x++) { const k = (x - f.x) % 4; P.px(x, y, k === 0 ? 0x4a1a5a : k === 1 ? 0x8a3a9a : 0x6a2a7a); }
  P.hl(f.x + 2, 22, f.w - 4, 0xc8ccd6);
  const pl = $t('PROVHYTT'), plw = textW(SMALL, pl) + 6; P.rect(f.x + f.w / 2 - plw / 2, 12, plw, 9, 0x17151a); text(P, SMALL, pl, f.x + f.w / 2 - plw / 2 + 3, 14, 0xffb060);
  // golvet: mörka plankor, en orange löpare och dimma längs väggen (dimman rör sig levande)
  for (let y = WALL_Y; y < H; y++) for (let x = 0; x < W; x++) {
    const row = ((y - WALL_Y) / 7) | 0, off = (hash(row, 1, 7) * 40) | 0, pin = (x + off) % 40;
    let c = mul(0x4a3040, 0.92 + hash(((x + off) / 40) | 0, row, 9) * 0.12);
    if ((y - WALL_Y) % 7 === 6) c = mul(c, 0.75); else if (pin === 0) c = mul(c, 0.8);
    P.px(x, y, c);
  }
  for (let y = 128; y < 142; y++) for (let x = 60; x < 620; x++) P.px(x, y, y === 128 || y === 141 ? 0xc85a1a : mix(0x8a2a1a, 0x9a3a1a, hash(x >> 1, y >> 1, 11) * 0.4));
  for (let i = 0; i < 5; i++) P.darken(0, WALL_Y + i, W, 1, 0.75 + i * 0.05);
  // ljuspölar från takets lampor (lila och orange)
  for (const x of [120, 200, 372, 480, 570]) P.ell(x, 150, 40, 14, x === 372 ? 0x8af08a : 0xffb060, 0.12, 4);
  P.box(0, 0, W, H, 0x0e0d12);
  return P.flush();
}
function bigSign(P, lbl, cx, y, board, trim, neon) {
  const tw = textW(BIG, lbl), w = tw + 16, x0 = Math.round(cx - w / 2), h = 13;
  P.ell(cx, y + h / 2, w * 0.7, h, trim, 0.15, 4);
  P.rect(x0, y, w, h, board); P.box(x0, y, w, h, trim);
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) text(P, BIG, lbl, x0 + 8 + dx, y + 3 + dy, trim, 0.35);
  text(P, BIG, lbl, x0 + 8, y + 3, neon);
}

// ================= scenen =================
export function makeShopMaskerad(A) {
  const g = A.game;
  if (!BG) BG = paintBg();
  let VW = 384;
  const syncView = () => { VW = Math.max(384, Math.min(A.W || 384, W)); };
  const walker = createWalker({ W, H, left: 6, right: W - 6, top: WALL_Y + 6, bottom: H - 4, spawn: [(DOOR.x0 + DOOR.x1) / 2, WALL_Y + 12] });
  walker.speed = 72;
  const dims = (p) => { const f = FRAMES[p.k + (katalogOf(p.k)?.anim ? (p.v | 0) * katalogOf(p.k).anim : p.v)] || FRAMES[p.k + '0'] || [0, 0, 16, 16]; return { w: f[2], h: f[3] }; };
  walker.setObstacles([
    ...DRAKTER.map((d) => [d.x - 12, d.y - 6, d.x + 12, d.y + 4]),
    [DESK.x, DESK.y, DESK.x + DESK.w, DESK.y + DESK.h],
    [KITTEL.x - 14, KITTEL.y - 8, KITTEL.x + 14, KITTEL.y + 2],
    [KISTA.x - 12, KISTA.y - 8, KISTA.x + 12, KISTA.y + 1],
    ...PYNT.filter((p) => !p.wall).map((p) => { const d = dims(p); return [p.x - 1, p.y - 6, p.x + d.w + 1, p.y + 1]; }),
  ]);
  walker.snapFree();
  let t = 0, hover = null, hoverT = 0, lockedCam = null, sayIdx = 0, greeted = false, kista = 0;
  const talk = createSpeech();
  const hSay = (s, secs = 4) => talk.say(s, () => ({ x: DESK.x + 40, y: DESK.y - 30 }), secs, { voice: HILDA });
  const camTarget = () => lockedCam ?? Math.max(0, Math.min(W - VW, walker.px - VW / 2));
  syncView();
  const cam = { x: camTarget() };

  const hatX = (i) => HATWALL.x + 14 + i * 26, hatY = () => HATWALL.y + 40;
  const kitOf = (d) => ({
    title: $t`${d.namn[0] + d.namn.slice(1).toLowerCase()}dräkt`, where: $t('Maskeradbutiken · dräkterna'), dept: 'halloween', icon: '🎭',
    parts: d.parts.map(([id, colors, optional]) => ({ id, colors, optional: !!optional, label: itemById(id)?.name?.replace(/­/g, '') + (optional ? ` (${$t('om du vill')})` : '') })),
    newLabel: $t('I dräkten'), wearLabel: $t('🎭 Ta på mig dräkten'),
    allOwnedText: $t('✓ Hela dräkten är din – ta på dig den!'), someOwnedText: $t('✓ Det du har tar du på dig – eller kryssa i resten.'),
    note: $t('Dräkten följer med hem i garderoben – färgerna kan du byta där.'),
  });
  const spots = () => [
    { id: 'dorr', r: [DOOR.x0, 20, DOOR.x1, WALL_Y + 6], go: [(DOOR.x0 + DOOR.x1) / 2, WALL_Y + 10], label: $t('UT'), act: () => { play('door'); A.go('city'); } },
    ...DRAKTER.map((d) => ({ id: 'drakt-' + d.id, drakt: d, r: [d.x - 12, d.y - 40, d.x + 12, d.y + 14], go: [d.x + 20, d.y + 2], label: $t`${d.namn} · DRÄKT`, act: () => { play('click'); openKit(A, kitOf(d)); } })),
    ...HATTAR.map(([id, cap], i) => ({ id: 'hatt-' + id, hatt: i, r: [hatX(i) - 12, hatY(i) - 24, hatX(i) + 12, hatY(i) + 2], go: [hatX(i), WALL_Y + 12], label: (itemById(id)?.name || id).replace(/­/g, '').toUpperCase(), act: () => { play('click'); openBuy(A, itemById(id), { dept: 'halloween', colors: cap ? { cap } : {}, fromDoll: true }); } })),
    { id: 'provhytt', r: [FITTING.x, 18, FITTING.x + FITTING.w, WALL_Y], go: [FITTING.x + FITTING.w / 2, WALL_Y + 12], label: $t('PROVHYTTEN'), act: () => talk.say($t('🪞 Klicka på en dräkt så ser du dig själv i den innan du köper!'), () => ({ x: walker.px, y: walker.py - 44 }), 3, { self: true }) },
    { id: 'hilda', r: [DESK.x, DESK.y - 34, DESK.x + DESK.w, DESK.y + DESK.h], go: [DESK.x + DESK.w / 2, DESK.y + DESK.h + 10], label: $t('HÄXAN HILDA'), act: () => hSay(HILDA_SAY[sayIdx++ % HILDA_SAY.length]) },
    { id: 'kittel', r: [KITTEL.x - 16, KITTEL.y - 22, KITTEL.x + 16, KITTEL.y + 2], go: [KITTEL.x, KITTEL.y + 12], label: $t('TROLLDRYCK'), act: () => { play('slide'); hSay($t('Rör inte min trolldryck! … Nåja, lukta får du. 🧪'), 3); } },
    { id: 'kista', r: [KISTA.x - 12, KISTA.y - 16, KISTA.x + 12, KISTA.y + 1], go: [KISTA.x, KISTA.y + 10], label: $t('SPÖKLÅDAN'), act: () => { if (kista > 0) return; kista = 2.4; play('fel'); talk.say($t('BUUU! 👻'), () => ({ x: KISTA.x, y: KISTA.y - 40 }), 1.6); setTimeout(() => toast($t('😱 Spöket skrämde dig! Spökdräkten hänger bland dräkterna – med den kan DU skrämmas (🎭-knappen).'), 'good'), 600); } },
    ...PYNT.map((p) => { const d = dims(p); return { id: `pynt-${p.k}${p.v}`, pynt: p, r: [p.x - 1, p.y - d.h - 1, p.x + d.w + 1, p.y + 1], go: p.wall ? [p.x + d.w / 2, WALL_Y + 12] : [p.x + d.w / 2, p.y + 10], label: (katalogOf(p.k)?.name || p.k).toUpperCase(), act: () => { play('click'); openFurnBuy(A, p.k); } }; }),
  ];
  const spotAt = (x, y) => spots().find((s) => x >= s.r[0] && x <= s.r[2] && y >= s.r[1] && y <= s.r[3]);
  const focusSpot = () => {
    const h = hover && t - hoverT < 4 && spotAt(hover.x, hover.y);
    if (h) return h;
    if (walker.path.length) return null;
    return spots().find((s) => s.id !== 'dorr' && Math.abs(walker.px - s.go[0]) < 7 && Math.abs(walker.py - s.go[1]) < 7) || null;
  };

  // ---------- ritning ----------
  function drawDrakt(ctx, d, on) {
    if (on) { ctx.fillStyle = 'rgba(255,190,90,.35)'; ctx.fillRect(d.x - 14, d.y - 44, 28, 50); }
    // podiet: svart med orange kant
    ctx.fillStyle = '#1a1020'; ctx.fillRect(d.x - 11, d.y - 2, 22, 6); ctx.fillStyle = '#e8762a'; ctx.fillRect(d.x - 11, d.y - 2, 22, 1); ctx.fillStyle = '#3a2448'; ctx.fillRect(d.x - 11, d.y + 3, 22, 1);
    drawPerson(ctx, d.x, d.y, d.look, 'down', 0);
    const need = d.parts.filter(([, , opt]) => !opt), all = need.every(([id]) => owns(g, itemById(id))), sum = need.reduce((a, [id]) => a + (owns(g, itemById(id)) ? 0 : priceOf(g, itemById(id))), 0);
    plate(ctx, d.x, d.y + 6, d.namn, all ? $t('DIN!') : $t`${sum} KR`, all, on);
  }
  function drawPynt(ctx, p, on) {
    const a = furnArt(p.k === 'pumplykta' ? 'pumplyktaL' : p.k, p.v);
    if (!a) return;
    if (on) { ctx.fillStyle = 'rgba(255,190,90,.4)'; ctx.fillRect(p.x - 2, p.y - a.sh - 2, a.sw + 4, a.sh + 4); }
    if (!p.wall) { ctx.fillStyle = 'rgba(10,6,14,0.3)'; ctx.fillRect(p.x + 1, p.y - 1, a.sw - 2, 2); }
    if (p.k === 'pumplykta') halo(ctx, p.x + a.sw / 2, p.y - a.sh / 2, 14, 8, '#ffb040', 0.12 * (0.8 + 0.2 * Math.sin(t * 9 + p.x)));
    if (p.k === 'haxkittel') halo(ctx, p.x + a.sw / 2, p.y - a.sh, 12, 5, '#8af08a', 0.18);
    drawArt(ctx, a, p.x, p.y - a.sh);
    tag(ctx, p.x + a.sw / 2, p.y + 2, $t`${katalogOf(p.k).price}:-`);
  }
  function drawKittel(ctx) {
    // den stora kitteln: svart gryta på tre ben, grön dryck som bubblar och ånga
    const { x, y } = KITTEL;
    halo(ctx, x, y - 14, 26, 10, '#8af08a', 0.14);
    ctx.fillStyle = '#0e0e14'; for (let j = 0; j < 14; j++) { const w = Math.round(14 * Math.sqrt(1 - ((j - 7) / 8) ** 2)); ctx.fillRect(x - w, y - 16 + j, w * 2, 1); }
    ctx.fillStyle = '#2a2a34'; ctx.fillRect(x - 10, y - 14, 4, 5);
    ctx.fillStyle = '#4a4a58'; ctx.fillRect(x - 14, y - 17, 28, 2);
    ctx.fillStyle = '#46c85a'; ctx.fillRect(x - 12, y - 18, 24, 2);
    for (let k = 0; k < 5; k++) { const u = (t * 0.8 + k / 5) % 1, bx = x - 10 + ((k * 7) % 20); ctx.fillStyle = '#8af08a'; ctx.fillRect(bx, y - 19 - Math.round(u * 3), 2, 2); }
    for (let k = 0; k < 4; k++) { const u = (t * 0.3 + k / 4) % 1; ctx.fillStyle = `rgba(160,240,160,${(0.35 * (1 - u)).toFixed(3)})`; ctx.fillRect(x - 6 + k * 4 + Math.round(Math.sin(t + k) * 2), y - 22 - Math.round(u * 26), 3, 2); }
    ctx.fillStyle = '#0e0e14'; for (const lx of [x - 10, x, x + 9]) ctx.fillRect(lx, y - 2, 2, 4);
  }
  function drawKista(ctx) {
    const { x, y } = KISTA, open = kista > 0;
    ctx.fillStyle = 'rgba(10,6,14,0.3)'; ctx.fillRect(x - 11, y - 1, 22, 2);
    ctx.fillStyle = '#5a3418'; ctx.fillRect(x - 11, y - 12, 22, 12); ctx.fillStyle = '#7a4a24'; ctx.fillRect(x - 11, y - 12, 22, 2);
    ctx.fillStyle = '#e8b830'; ctx.fillRect(x - 2, y - 9, 4, 3); ctx.fillStyle = '#2a1a0e'; ctx.fillRect(x - 11, y - 6, 22, 1);
    if (open) {
      // locket uppe och spöket som skjuter upp
      ctx.fillStyle = '#7a4a24'; ctx.fillRect(x - 11, y - 20, 22, 3);
      const up = Math.min(1, (2.4 - kista) * 4), gy = y - 12 - Math.round(up * 20);
      ctx.fillStyle = '#f4f6fa'; ctx.fillRect(x - 6, gy, 12, 14); ctx.fillRect(x - 5, gy - 2, 10, 2); ctx.fillRect(x - 9, gy + 3, 3, 4); ctx.fillRect(x + 6, gy + 3, 3, 4);
      ctx.fillStyle = '#1c1820'; ctx.fillRect(x - 3, gy + 3, 2, 3); ctx.fillRect(x + 1, gy + 3, 2, 3); ctx.fillRect(x - 2, gy + 8, 4, 3);
    } else { ctx.fillStyle = '#4a2a10'; ctx.fillRect(x - 11, y - 14, 22, 2); }
  }
  function drawHilda(ctx) {
    drawPerson(ctx, DESK.x + 40, DESK.y + 14, HILDA, 'down', Math.sin(t * 1.7) > 0.93 ? 4 : 0);
    // kassadisken: svart med orange list, en skål godis och ett ljus
    ctx.fillStyle = '#1a1020'; ctx.fillRect(DESK.x, DESK.y + 8, DESK.w, DESK.h - 8);
    ctx.fillStyle = '#e8762a'; ctx.fillRect(DESK.x, DESK.y + 8, DESK.w, 2); ctx.fillStyle = '#3a2448'; ctx.fillRect(DESK.x + 2, DESK.y + 14, DESK.w - 4, DESK.h - 17);
    ctx.fillStyle = '#e8762a'; for (let x = DESK.x + 6; x < DESK.x + DESK.w - 4; x += 10) ctx.fillRect(x, DESK.y + 20, 4, 4);
    ctx.fillStyle = '#f4f1ea'; ctx.fillRect(DESK.x + 6, DESK.y + 3, 10, 5); ctx.fillStyle = '#d9433b'; ctx.fillRect(DESK.x + 7, DESK.y + 2, 2, 2); ctx.fillStyle = '#ffd23f'; ctx.fillRect(DESK.x + 11, DESK.y + 2, 2, 2);
    ctx.fillStyle = '#f2ead0'; ctx.fillRect(DESK.x + 60, DESK.y + 1, 2, 7); ctx.fillStyle = Math.sin(t * 13) > 0 ? '#ffd23f' : '#ff9d0e'; ctx.fillRect(DESK.x + 60, DESK.y - 1, 2, 2);
  }
  function drawFog(ctx, cx) {
    // låg dimma som driver längs golvet
    for (let k = 0; k < 14; k++) {
      const x = ((k * 61 + t * (6 + (k % 3) * 3)) % (W + 80)) - 40, y = 150 + ((k * 37) % 60);
      if (x < cx - 60 || x > cx + VW + 60) continue;
      ctx.fillStyle = 'rgba(200,190,220,0.07)'; ctx.fillRect(Math.round(x), y, 46, 4); ctx.fillRect(Math.round(x) + 8, y - 2, 30, 2);
    }
  }
  function drawBats(ctx, cx) {
    for (let k = 0; k < 3; k++) {
      const u = (t * 0.08 + k / 3) % 1, x = Math.round(u * (W + 40)) - 20, y = 12 + k * 6 + Math.round(Math.sin(t * 3 + k) * 3);
      if (x < cx - 10 || x > cx + VW + 10) continue;
      const up = Math.floor(t * 9 + k) % 2;
      ctx.fillStyle = '#120a18'; ctx.fillRect(x + 1, y, 3, 2);
      if (up) { ctx.fillRect(x - 1, y - 1, 2, 1); ctx.fillRect(x + 4, y - 1, 2, 1); } else { ctx.fillRect(x - 1, y + 1, 2, 1); ctx.fillRect(x + 4, y + 1, 2, 1); }
    }
  }
  function label(ctx, s, cx) {
    if (!s) return;
    const txt = s.label, w = textW(SMALL, txt) + 10, x = Math.round(Math.max(cx + 2, Math.min(cx + VW - w - 2, (s.r[0] + s.r[2]) / 2 - w / 2))), y = Math.max(2, s.r[1] - 13);
    ctx.fillStyle = 'rgba(20,12,26,.92)'; ctx.fillRect(x, y, w, 11); ctx.fillStyle = '#e8762a'; ctx.fillRect(x, y + 10, w, 1);
    ctxText(ctx, SMALL, txt, x + 5, y + 3, '#ffd23f');
  }

  return {
    viewMax: { w: W, h: H },
    get worldX() { return walker.px; }, get worldY() { return walker.py; },
    update(dt) {
      dt = Math.min(0.1, Math.max(0, dt));
      t += dt; syncView(); walker.update(dt);
      if (kista > 0) kista = Math.max(0, kista - dt);
      if (!greeted && t > 0.8) { greeted = true; hSay(HILDA_SAY[0], 5); sayIdx = 1; }
      const k = lockedCam !== null ? 1 : Math.min(1, dt * 6);
      cam.x += (camTarget() - cam.x) * k;
    },
    draw(ctx) {
      syncView();
      const cx = Math.round(cam.x);
      ctx.setTransform(A.pxs, 0, 0, A.pxs, -cx * A.pxs, 0);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(BG, cx, 0, VW, H, cx, 0, VW, H);
      const focus = focusSpot();
      drawBats(ctx, cx);
      // hattväggen
      HATTAR.forEach(([id, cap], i) => {
        const it = itemById(id), x = hatX(i), y = hatY(i), on = focus?.hatt === i;
        if (on) { ctx.fillStyle = 'rgba(255,190,90,.4)'; ctx.fillRect(x - 12, y - 24, 24, 24); }
        bust(ctx, x, y, { ...MANNE, style: 'short', hair: '#3b2619', ...it.look, ...(cap ? { cap } : {}) });
        tag(ctx, x, y + 3, owns(g, it) ? $t('DIN') : $t`${priceOf(g, it)}:-`, owns(g, it));
      });
      for (const p of PYNT) if (p.wall) drawPynt(ctx, p, focus?.pynt === p);
      const list = [...folkDrawables(A, t), selfDrawable(A, walker, t)];
      for (const d of DRAKTER) list.push({ fy: d.y, draw: () => drawDrakt(ctx, d, focus?.drakt === d) });
      for (const p of PYNT) if (!p.wall) list.push({ fy: p.y, draw: () => drawPynt(ctx, p, focus?.pynt === p) });
      list.push({ fy: DESK.y + DESK.h, draw: () => drawHilda(ctx) });
      list.push({ fy: KITTEL.y, draw: () => drawKittel(ctx) });
      list.push({ fy: KISTA.y, draw: () => drawKista(ctx) });
      list.sort((a, b) => a.fy - b.fy).forEach((d) => d.draw(ctx));
      drawFog(ctx, cx);
      talk.draw(ctx, { x0: cx, x1: cx + VW });
      label(ctx, focus, cx);
    },
    down(sx, sy) {
      const x = sx + cam.x, y = sy;
      hover = null;
      const s = spotAt(x, y);
      if (s) { walker.walkTo(s.go[0], s.go[1], s.act); return; }
      if (y > WALL_Y) walker.walkTo(x, y);
    },
    move(sx, sy) { hover = { x: sx + cam.x, y: sy }; hoverT = t; },
    exit() { talk.clear(); },
    _debug: {
      spots: () => spots().map((s) => s.id),
      spot: (id) => {
        const s = spots().find((q) => q.id === id);
        if (!s) return null;
        const x = (s.r[0] + s.r[2]) / 2;
        if (lockedCam === null && (x - cam.x < 8 || x - cam.x > VW - 8)) cam.x = Math.max(0, Math.min(W - VW, x - VW / 2));
        return { x: Math.round(x - cam.x), y: Math.round((s.r[1] + s.r[3]) / 2) };
      },
      act: (id) => { const s = spots().find((q) => q.id === id); if (!s) return false; s.act(); return true; },
      lockCam: (x) => { lockedCam = x === null || x === undefined ? null : Math.max(0, Math.min(W - VW, x)); cam.x = camTarget(); },
      teleport: (x, y) => { walker.px = x; walker.py = y; walker.stop(); walker.snapFree(); cam.x = camTarget(); },
      pos: () => ({ x: Math.round(walker.px), y: Math.round(walker.py) }),
      kista: () => kista,
      hilda: () => talk.text?.() ?? null,
    },
  };
}

// ================= små ritningar =================
function plate(ctx, x, y, l1, l2, own, hi) {
  const w = Math.max(textW(SMALL, l1), textW(SMALL, l2)) + 6, h = 15, x0 = Math.round(x - w / 2);
  if (hi) { ctx.fillStyle = '#ffd23f'; ctx.fillRect(x0 - 2, y - 2, w + 4, h + 4); }
  ctx.fillStyle = '#17151a'; ctx.fillRect(x0 - 1, y - 1, w + 2, h + 2);
  ctx.fillStyle = own ? '#45b964' : '#f6efe0'; ctx.fillRect(x0, y, w, h);
  ctx.fillStyle = '#e8762a'; ctx.fillRect(x0, y, w, 2);
  ctxText(ctx, SMALL, l1, x0 + Math.round((w - textW(SMALL, l1)) / 2), y + 3, own ? '#ffffff' : '#17151a');
  ctxText(ctx, SMALL, l2, x0 + Math.round((w - textW(SMALL, l2)) / 2), y + 9, own ? '#ffffff' : '#7a3a10');
}
function tag(ctx, x, y, lbl, own = false) {
  const w = textW(SMALL, lbl) + 4, x0 = Math.round(x - w / 2);
  ctx.fillStyle = '#17151a'; ctx.fillRect(x0 - 1, y - 1, w + 2, 9);
  ctx.fillStyle = own ? '#45b964' : '#ffb060'; ctx.fillRect(x0, y, w, 7);
  ctxText(ctx, SMALL, lbl, x0 + 2, y + 1, own ? '#ffffff' : '#3a1a08');
}
// byst (huvud + axlar) på en liten fot – för hattarna och maskerna
function bust(ctx, x, base, look) {
  ctx.fillStyle = '#5a5058'; ctx.fillRect(x - 5, base - 2, 11, 2);
  ctx.fillStyle = '#a8a0aa'; ctx.fillRect(x - 1, base - 5, 3, 3);
  ctx.save(); ctx.beginPath(); ctx.rect(x - 12, base - 28, 24, 23); ctx.clip();
  drawPerson(ctx, x, base - 26 + 39, { ...look, skin: '#e9e2ea', top: 'tee', shirt: '#d9d0c8', accent: '#d9d0c8' }, 'down', 0);
  ctx.restore();
}
