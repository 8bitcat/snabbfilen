// KLÄDER – klädaffären man går runt i med sin egen figur, nu i TVÅ VÅNINGAR.
//
// PLAN 1 · MODE (1280 px bred, kameran följer figuren): TJEJER till vänster, KILLAR till
// höger och mitthallen med dörren, kassan, accessoarhyllan, hatthyllan och TRAPPAN UPP.
// Varje avdelning har skyltdockor (ett plagg per docka, med lapp) och klädställningar – fyra
// väggmoduler och fyra fristående – där HELA klädkatalogens över- och underdelar hänger på
// galgar, sorterade i kategorier (egna avdelningens först, sedan unisex). Klick på en ställning
// = bläddra bland alla dess plagg; klick på ett plagg eller en docka = prova på DIN figur och köp.
//
// PLAN 2 · SPORT & FOTBOLL: trappan kommer upp ur ett schakt i golvet. KUNGSLADUGÅRD – hela
// laget som skyltdockor i matchställ (nummer + förnamn på ryggen, nummerskylt under), lagfotot
// på väggen, fotbollsskorna ur lagfotot och matchstället till salu. KÄNDA LAG – tolv lags
// matchställ med bara stadsnamn (inga märken, inga sponsorer), sporttröjor och mjukis. En
// liten provplan med mål: klicka på bollen så skjuter du.
//
// Köpen registreras med katalog-id (g.buyWardrobe / g.ownsWardrobe i game.js). Lagen delar
// tröjmodeller (katalogen tillåter inte två likadana plagg): äger man modellen säger lappen
// TA PÅ DIG och dialogen klär på en i lagets färger. Klick på lagfotot = fotot i stort.
//
// MOBILEN (NÄRA-läget beskär upptill och nertill, main.js v.safe): en lodrät kamera följer
// figuren inom det synliga radbandet, och skyltarna läggs alltid innanför det.
import { drawPerson } from '../core/people.js';
import { SMALL, BIG, ctxText, textW, mix, mul, hex, css } from '../core/floor-pix.js';
import { toast } from '../core/ui.js';
import { play } from '../core/sound.js';
import { createWalker, selfDrawable, createSpeech, WALK_SEQ, nameTag, emoteBubble, sayBubble } from './walkable.js';
import { worldFolksHere } from '../net/world.js';
import { itemById } from '../data/wardrobe.js';
import * as D from './klader/data.js';
import * as PT from './klader/paint.js';
import { drawHanging, drawTeamDoll, isDressLike } from './klader/garment.js';
import { openBuy, openBrowse, openKit, openPhoto, owns, priceOf, nameOf } from './klader/buy.js';

const { H, WALL_Y } = D;
const STAIR_V = 44;                    // gångfart i trappan (px/s längs trappan)
const talk = createSpeech();           // repliker och beskrivningar som pratbubblor i scenen
let VW = 384;                          // mobilfyllning: vyn följer skärmen, klampad till våningen

// ---------- kortnamn på dockornas lappar (lappen får vara högst ~48 px bred) ----------
const SHORT = {
  'top-vest': 'LINNE', 'top-hoodie': 'HUVTRÖJA', 'top-hawaii': 'HAWAII', 'top-sweater': 'STICKAT', 'top-shirt': 'SKJORTA',
  'top-jacket': 'JACKA', 'top-suit': 'KAVAJ', 'bottom-shorts': 'SHORTS', 'bottom-skirt': 'KJOL', 'bottom-dress': 'KLÄNNING',
  'hat-cap': 'KEPS', 'hat-bucket': 'FISKEHATT', 'hat-headband': 'HÅRBAND', 'hat-beanie': 'MÖSSA', 'hat-bow': 'ROSETT',
  'hat-tophat': 'HÖG HATT', 'hat-crown': 'KRONA',
};
const OK_CH = /[A-ZÅÄÖÉ0-9 \-+!.:,?/%'=]/;
// text i spelets pixeltypsnitt: versaler, bara tecken som finns
const pix = (s) => [...String(s).replace(/­/g, '').replace(/&/g, '+').replace(/·/g, '-').toUpperCase()].map((c) => (OK_CH.test(c) ? c : c === 'Ü' ? 'U' : ' ')).join('').replace(/ +/g, ' ').trim();
// var på dockan (fötterna i 0,0, framifrån) plagget sitter – där hänger den gula lappen
const HANG_AT = { hat: [5, -36], top: [6, -23], bottom: [5, -11], shoes: [5, -2] };
// dockans färger som förslag i köpdialogen
function dollColors(it, look) {
  const pick = (...f) => Object.fromEntries(f.filter((k) => look[k]).map((k) => [k, look[k]]));
  switch (it.slot) {
    case 'top': return pick('shirt', 'accent', 'print2');
    case 'bottom': return isDressLike(it) ? pick('shirt', 'pants2') : pick('pants', 'pants2');
    case 'hat': return { cap: look.cap };
    case 'bag': return { bagColor: look.bagColor };
    case 'phones': return { phoneColor: look.phoneColor };
    default: return {};
  }
}

const CLERK = { skin: '#c68a5c', hair: '#1d1714', style: 'bun', top: 'shirt', shirt: '#f4f1ea', accent: '#b83d7a', bottom: 'pants', pants: '#2d3a5c', shoes: '#1c1c1c', glasses: 'round', beard: false, phones: false, bag: null, hat: null, blush: true, build: 5 };
const COACH_LOOK = { skin: '#a06a43', hair: '#1d1714', style: 'buzz', top: 'track', shirt: '#7a1f2e', accent: '#f4f1ea', bottom: 'trackPants', pants: '#1d1d22', pants2: '#f4f1ea', shoeType: 'sneakers', shoes: '#f4f1ea', shoes2: '#d9434b', beard: 'short', glasses: false, phones: false, bag: null, hat: null, build: 6 };
const POSTER = [
  D.girl({ skin: '#eec3a0', style: 'ponytail', hair: '#d9a95c', top: 'hoodie', shirt: '#f28bb3', bottom: 'skirt', pants: '#8e5bd1', hat: 'bow', cap: '#f0b429' }),
  D.boy({ skin: '#a06a43', style: 'fade', hair: '#1d1714', top: 'jacket', shirt: '#3a7bd5', accent: '#f0b429', bottom: 'jeans', pants: '#2d3a5c', hat: 'cap', cap: '#46a35a' }),
];

// ================= butikens innehåll (byggs en gång) =================
const DUMMIES = [
  ...D.GIRLS.map(([k, c, r, look, short]) => ({ it: D.itemOf(k), key: k, short, dept: 'tjej', x: D.COLS[c], y: D.ROW_Y[r], look })),
  ...D.BOYS.map(([k, c, r, look, short]) => ({ it: D.itemOf(k), key: k, short, dept: 'kille', x: D.W1 - D.COLS[D.COLS.length - 1 - c], y: D.ROW_Y[r], look })),
];
// ställningar och väggmoduler: { kind, cat, dept, x, base?, items }
const PLACES1 = [];
for (const dept of ['tjej', 'kille']) for (const [catId, kind, i] of D.PLACES[dept]) {
  const cat = D.catById(catId), items = D.catItems(cat);
  if (kind === 'wall') PLACES1.push({ kind, cat, dept, items, x: dept === 'tjej' ? D.MOD_X[i] : D.W1 - D.MOD_X[i] - D.MOD_W });
  else { const [x0, base] = D.RACK_SLOTS[i]; PLACES1.push({ kind, cat, dept, items, x: dept === 'tjej' ? x0 : D.W1 - x0 - D.RACK_W, base }); }
}
const PLACES2 = [
  { kind: 'wall', cat: D.catById('spTrojor'), dept: 'sport', x: D.SPORT_MOD_X[0] },
  { kind: 'wall', cat: D.catById('spMjukis'), dept: 'sport', x: D.SPORT_MOD_X[1] },
  { kind: 'rack', cat: D.catById('spFotboll'), dept: 'sport', x: D.SPORT_RACK[0], base: D.SPORT_RACK[1] },
].map((p) => ({ ...p, items: D.catItems(p.cat) }));
const GTOP = PT.GTOP, GBOT = PT.GBOT;
const SHELF = [
  ['glasses:round', D.GOND.x + 18, GTOP, null],
  ['glasses:square', D.GOND.x + 46, GTOP, null],
  ['glasses:sun', D.GOND.x + 74, GTOP, null],
  ['phones:true', D.GOND.x + 102, GTOP, D.bust({ style: 'short', hair: '#3b2619', phones: true, phoneColor: '#d9433b' })],
  ['bag:backpack', D.GOND.x + 30, GBOT, { bagColor: '#3a7bd5' }],
  ['bag:shoulder', D.GOND.x + 90, GBOT, { bagColor: '#b83d7a' }],
].map(([k, x, y, look]) => ({ it: D.itemOf(k), key: k, dept: 'mid', x, y, look: look || {} }));
const HATBUSTS = D.HAT_BUSTS.map(([k, look], i) => ({
  it: D.itemOf(k), key: k, dept: 'mid', look,
  x: D.HATS.x + (i < 4 ? 16 + i * 28 : 30 + (i - 4) * 28), y: i < 4 ? PT.HTOP : PT.HBOT,
}));
const KUNGS = D.KUNGS_PLAYERS.map(([n, name], i) => ({ n, name, i, ...D.KUNGS_POS[i], look: D.kungsLook(i) }));
const TEAMS = D.TEAMS.map((tm, i) => ({ ...tm, i, ...D.TEAM_POS[i], look: D.teamLook(tm, i), it: itemById(tm.item) }));
const KIT_LOOK = D.girl({ style: 'ponytail', hair: '#6b4226', top: 'football', shirt: D.KUNGS_KIT.shirt, accent: D.KUNGS_KIT.accent, bottom: 'sportShorts', pants: D.KUNGS_KIT.pants, pants2: D.KUNGS_KIT.pants, shoeType: 'cleats', shoes: '#e4f22e', shoes2: '#1d1d22' });
const KSOCKS = { socks: D.KUNGS_KIT.socks, stripe: D.KUNGS_KIT.sockStripe };
const BENCH = { x: 452, y: 122 };      // provbänken framför fotbollsskorna (y = benens fot)
const cityName = (c) => c[0] + c.slice(1).toLowerCase();
const cityGen = (c) => (/s$/i.test(c) ? cityName(c) : cityName(c) + 's');

// Kungsladugårds matchställ som köps (tröjan = fotbollströjan i lagets färger, utan namn)
function kungsKit(player = null) {
  const cl = D.CLEATS[player ? player.i % D.CLEATS.length : 0];
  return {
    title: 'Kungsladugårds matchställ', where: 'Kungsladugård · plan 2', dept: 'kungs', icon: '⚽',
    player: player ? `Nr ${player.n} · ${player.name}` : null,
    // ryggen i stort: nummer och förnamn i spelets pixeltypsnitt (på dockan får namnet inte plats)
    back: player ? { number: player.n, name: player.name, shirt: D.KUNGS_KIT.shirt, accent: D.KUNGS_KIT.accent } : null,
    parts: [
      { id: 'top-football', label: 'Matchtröja (vinröd)', colors: { shirt: D.KUNGS_KIT.shirt, accent: D.KUNGS_KIT.accent } },
      { id: 'bottom-sportShorts', label: 'Svarta shorts', colors: { pants: D.KUNGS_KIT.pants, pants2: D.KUNGS_KIT.pants2 } },
      { id: 'shoes-cleats', label: `Fotbollsskor (${cl.name.toLowerCase()})`, colors: { shoes: cl.shoes, shoes2: cl.shoes2 }, optional: !!player },
    ],
    wearLabel: '👕 Ta på mig matchstället',
    ownedNote: '✓ Fotbollströjan har du redan – här tar du på dig den i Kungsladugårds vinröda färger.',
    note: player
      ? `Tröjan är lagets – vinröd med ljusröda ärmslut. Nummer och namn på ryggen har bara ${player.name} och hennes lagkompisar.`
      : 'Vinröd tröja med ljusare röda ärmslut, svarta shorts och fotbollsskor – precis som laget. Nummer och namn på ryggen har bara lagets spelare.',
  };
}
// Ett känt lags matchställ. Lagen delar tröjmodeller (vanlig, randig, tvärrandig – katalogen
// tillåter inte två likadana plagg), så äger man modellen tar man bara på sig den i lagets färger.
function teamKit(tm) {
  const it = tm.it, gen = cityGen(tm.city);
  return {
    title: `${gen} matchställ`, where: 'Kända lag · plan 2', dept: 'lag', icon: '⚽',
    parts: [
      { id: it.id, label: `Matchtröja ${cityName(tm.city)}`, colors: tm.colors },
      { id: 'bottom-sportShorts', label: 'Shorts', colors: { pants: tm.pants, pants2: tm.pants } },
      { id: 'shoes-cleats', label: 'Fotbollsskor (svarta)', colors: { shoes: '#26242c', shoes2: '#f4f1ea' }, optional: true },
    ],
    wearLabel: `👕 Ta på mig i ${gen} färger`,
    ownedNote: `✓ Tröjan har du redan! Det är ${it.id === 'top-football' ? 'den vanliga fotbollströjan' : nameOf(it).toLowerCase()} – samma modell för flera lag, bara färgerna skiljer. Här tar du på dig den i ${gen} färger.`,
    note: `I ${gen} färger – utan klubbmärke och sponsorer. Samma tröja kan du färga i vilket lags färger du vill hemma i garderoben.`,
  };
}
// Bär man just nu tröjan i de här färgerna? (lappen säger då PÅ DIG)
const wearsShirt = (look, it, shirt) => look.top === 'football' && (look.topPrint || 'none') === (it?.look.topPrint || 'none') && String(look.shirt || '').toLowerCase() === shirt.toLowerCase();

let ART = null;
function art() {
  if (ART) return ART;
  const bg1 = PT.paintModules(PT.paintFloor1(), PLACES1.filter((p) => p.kind === 'wall').map((p) => ({ x: p.x, key: p.dept, sign: p.cat.sign })));
  const bg2 = PT.paintModules(PT.paintFloor2(), PLACES2.filter((p) => p.kind === 'wall').map((p) => ({ x: p.x, key: p.dept, sign: p.cat.sign })));
  const racks = new Map();
  [...PLACES1, ...PLACES2].forEach((p, i) => { if (p.kind === 'rack') racks.set(p.cat.id, PT.rackImg(p.dept, p.cat.sign, i)); });
  ART = {
    bg1, bg2, racks,
    pod: { tjej: PT.podiumImg('tjej'), kille: PT.podiumImg('kille'), kungs: PT.podiumImg('kungs'), lag: PT.podiumImg('lag') },
    glow: PT.glowImg(), plant: PT.plantImg(), gond: PT.gondolaImg(), hats: PT.hatGondolaImg(), desk: PT.deskImg(),
    stairs1: PT.stairArt(D.STAIRS1), stairs2: PT.stairArt(D.STAIRS2),
    pitFront: PT.pitFrontImg(D.STAIRS2.pit[1] - D.STAIRS2.pit[0] + 2), goal: PT.goalImg(), bench: PT.benchImg(),
  };
  return ART;
}

export function makeShopKlader(A, opts = {}) {
  const g = A.game;
  const P = art();
  let lastLabel = null;
  let t = 0, lockedCam = null, hoverId = null, hoverT = 0, fade = 0, nagAt = -9, floorT = 0; // floorT = när man kom till våningen
  let climb = null;                 // { e, d, v } – medan man går i trappan
  const ball = { x: D.BALL0[0], y: D.BALL0[1], z: 0, st: 'rest', t: 0, fx: 0, fy: 0, tx: 0, ty: 0 };
  const syncView = () => { VW = Math.max(384, Math.min(A.W || 384, F.W)); };

  // ---------- våningarna ----------
  const mkWalker = (W, spawn, obstacles) => {
    const w = createWalker({ W, H, top: WALL_Y + 4, bottom: H - 6, spawn });
    w.speed = 80; // butiken är stor – lite raskare än i de små butikerna
    w.setObstacles(obstacles);
    w.snapFree();
    return w;
  };
  const board1 = [D.STAIRS1.lx - D.STAIRS1.sx * 12, D.STAIRS1.ly], board2 = [D.STAIRS2.lx - D.STAIRS2.sx * 12, D.STAIRS2.ly];
  const [p0, p1, pb, pl] = D.STAIRS2.pit;
  const floor1 = {
    n: 1, W: D.W1, bg: P.bg1, name: 'PLAN 1 - MODE', col: '#e8b230',
    walker: mkWalker(D.W1, [(D.DOOR.x0 + D.DOOR.x1) / 2, WALL_Y + 14], [
      ...DUMMIES.map((d) => [d.x - 12, d.y - 6, d.x + 12, d.y + 22]),
      ...PLACES1.filter((p) => p.kind === 'rack').map((p) => [p.x - 2, p.base - 8, p.x + D.RACK_W + 2, p.base + 3]),
      [D.GOND.x - 5, D.GOND.y + 2, D.GOND.x + D.GOND.w + 5, D.GOND.y + D.GOND.h],
      [D.HATS.x - 4, D.HATS.y + 2, D.HATS.x + D.HATS.w + 4, D.HATS.y + D.HATS.h],
      [D.DESK.x, D.DESK.y, D.DESK.x + D.DESK.w, D.DESK.y + D.DESK.h],
      [D.STAIRS1.lx - 2, WALL_Y, D.MID1 - 4, D.STAIRS1.ly + 5],
      ...D.PLANTS1.map(([x, y]) => [x - 6, y - 4, x + 6, y + 2]),
    ]),
  };
  const floor2 = {
    n: 2, W: D.W2, bg: P.bg2, name: 'PLAN 2 - SPORT + FOTBOLL', col: '#d9434b',
    walker: mkWalker(D.W2, [board2[0] + 8, board2[1] + 14], [
      ...KUNGS.map((k) => [k.x - 12, k.y - 6, k.x + 12, k.y + 20]),
      ...TEAMS.map((k) => [k.x - 12, k.y - 6, k.x + 12, k.y + 20]),
      [D.KIT_DOLL.x - 12, D.KIT_DOLL.y - 6, D.KIT_DOLL.x + 12, D.KIT_DOLL.y + 20],
      [p0 - 3, pb - 14, p1 + 3, pl + 3],
      [D.GOAL.x - 17, D.GOAL.y - 6, D.GOAL.x + 17, D.GOAL.y + 1],
      [D.COACH.x - 6, D.COACH.y - 4, D.COACH.x + 6, D.COACH.y + 2],
      [BENCH.x - 1, BENCH.y - 7, BENCH.x + PT.BENCH_W + 1, BENCH.y + 1],
      ...PLACES2.filter((p) => p.kind === 'rack').map((p) => [p.x - 2, p.base - 8, p.x + D.RACK_W + 2, p.base + 3]),
      ...D.PLANTS2.map(([x, y]) => [x - 6, y - 4, x + 6, y + 2]),
    ]),
  };
  const floors = { 1: floor1, 2: floor2 };
  let F = opts.floor === 2 ? floor2 : floor1;
  if (opts.floor === 2) { F.walker.px = board2[0] + 8; F.walker.py = board2[1] + 14; F.walker.snapFree(); }
  const W = () => F.walker;

  // ---------- klickbara saker ----------
  const itemSpot = (id, o, r, go, dept) => ({ id, item: o, r, go, dept, act: () => { hoverId = null; openBuy(A, o.it, { dept, colors: dollColors(o.it, o.look), fromDoll: true }); } });
  const placeSpot = (p) => {
    const r = p.kind === 'wall' ? [p.x, 27, p.x + D.MOD_W, WALL_Y - 2] : [p.x, p.base - 56, p.x + D.RACK_W, p.base + 2];
    const go = p.kind === 'wall' ? [p.x + D.MOD_W / 2, WALL_Y + 12] : [p.x + D.RACK_W / 2, p.base + 14];
    return { id: (p.kind === 'wall' ? 'mod-' : 'rack-') + p.cat.id, place: p, r, go, dept: p.dept, act: () => { hoverId = null; play('click'); openBrowse(A, p.cat, p.items, { dept: p.dept }); } };
  };
  const say = (msg) => { play('click'); talk.say(msg, () => ({ x: W().px, y: W().py - 44 }), undefined, { self: true }); };
  floor1.spots = [
    { id: 'dorr', r: [D.DOOR.x0 - 2, 26, D.DOOR.x1 + 2, WALL_Y + 4], go: [(D.DOOR.x0 + D.DOOR.x1) / 2, WALL_Y + 10], act: () => { play('door'); A.go('city'); } },
    { id: 'trappa', stairs: true, r: [D.STAIRS1.lx - 14, D.STAIRS1.clip, D.MID1 - 4, D.STAIRS1.ly + 6], go: board1, act: () => startClimb() },
    // man ställer sig BREDVID dockan (på mittgångens sida), så att figuren inte skymmer lappen
    ...DUMMIES.map((d, i) => itemSpot('dummy' + i, d, [d.x - 12, d.y - 40, d.x + 12, d.y + 22], [d.x + (d.dept === 'tjej' ? 22 : -22), d.y + 3], d.dept)),
    ...SHELF.map((s, i) => itemSpot('hylla' + i, s,
      s.y === GTOP ? [s.x - 13, D.GOND.y + 10, s.x + 13, GTOP + 7] : [s.x - 20, GTOP + 8, s.x + 20, D.GOND.y + D.GOND.h],
      [s.y === GTOP ? s.x : s.x < D.GOND.x + D.GOND.w / 2 ? s.x - 22 : s.x + 22, D.GOND.y + D.GOND.h + 12], 'mid')),
    ...HATBUSTS.map((b, i) => itemSpot('hatt' + i, b, [b.x - 12, b.y - 26, b.x + 12, b.y + 4], [b.x, D.HATS.y + D.HATS.h + 12], 'mid')),
    ...PLACES1.map(placeSpot),
    { id: 'kassa', r: [D.DESK.x, D.DESK.y - 30, D.DESK.x + D.DESK.w, D.DESK.y + D.DESK.h], go: [D.DESK.x + D.DESK.w / 2, D.DESK.y + D.DESK.h + 10], act: () => { play('click'); talk.say('Hej! 👋 Allt hänger på galgarna – klicka på en ställning så ser du alla plagg. Sport och fotboll finns en trappa upp!', { x: D.DESK.x + D.DESK.w / 2, y: D.DESK.y - 30 }); } },
    ...[[8, 84], [D.W1 - 84, D.W1 - 8]].map(([a, b], i) => ({ id: 'prov' + i, r: [a, 18, b, WALL_Y], go: [(a + b) / 2, WALL_Y + 12], act: () => say('🪞 Provhytten! Klickar jag på ett plagg ser jag det på mig innan jag köper.') })),
  ];
  floor2.spots = [
    { id: 'trappa', stairs: true, r: [p0, pb - 14, p1 + 24, pl + 4], go: board2, act: () => startClimb() },
    ...KUNGS.map((k) => ({ id: 'kungs' + k.i, kungs: k, r: [k.x - 12, k.y - 40, k.x + 12, k.y + 18], go: [k.x, k.y + (k.y < 150 ? 30 : 32)], dept: 'kungs', act: () => { hoverId = null; play('click'); openKit(A, kungsKit(k)); } })),
    { id: 'matchstall', kit: true, r: [D.KIT_DOLL.x - 12, D.KIT_DOLL.y - 40, D.KIT_DOLL.x + 12, D.KIT_DOLL.y + 18], go: [D.KIT_DOLL.x, D.KIT_DOLL.y + 32], dept: 'kungs', act: () => { hoverId = null; play('click'); openKit(A, kungsKit()); } },
    ...PT.SHOE_SPOTS.map((s) => ({ id: 'skor-' + s.c.id, cleat: s, r: [s.x - 2, s.y - 11, s.x + 18, s.y + 2], go: [s.x + 8, WALL_Y + 12], dept: 'kungs', act: () => {
      hoverId = null; play('click');
      openBuy(A, itemById('shoes-cleats'), { dept: 'kungs', where: 'Kungsladugård · fotbollsskorna ur lagfotot', title: `${s.c.name} fotbollsskor`, colors: { shoes: s.c.shoes, shoes2: s.c.shoes2 }, note: 'Samma fotbollsskor som laget har på lagfotot – färgen väljer du fritt hemma i garderoben.' });
    } })),
    // lagfotot: klick = fotot i stort med hela laget (syns också på mobilen, där väggen är beskuren)
    { id: 'lagfoto', photo: true, r: [D.PHOTO.x, D.PHOTO.y, D.PHOTO.x + D.PHOTO.w, D.PHOTO.y + D.PHOTO.h + 10], go: [D.PHOTO.x + D.PHOTO.w / 2, WALL_Y + 12], dept: 'kungs', act: () => {
      hoverId = null; play('click');
      openPhoto(A, P.bg2, [D.PHOTO.x, D.PHOTO.y, D.PHOTO.w, D.PHOTO.h], 'Kungsladugård – laget 2026', D.KUNGS_PLAYERS);
    } },
    ...TEAMS.map((tm) => ({ id: 'lag' + tm.i, team: tm, r: [tm.x - 12, tm.y - 40, tm.x + 12, tm.y + 18], go: [tm.x, tm.y + (tm.y < 150 ? 30 : 32)], dept: 'lag', act: () => { hoverId = null; play('click'); openKit(A, teamKit(tm)); } })),
    ...PLACES2.map(placeSpot),
    { id: 'coach', r: [D.COACH.x - 8, D.COACH.y - 40, D.COACH.x + 8, D.COACH.y + 2], go: [D.COACH.x - 16, D.COACH.y + 10], act: () => { play('click'); talk.say(['Välkommen upp! ⚽ Laget står där borta – klicka på en spelare så provar du matchstället.', 'Skjut ett skott på provplanen – klicka på bollen!', 'Fotbollsskorna på väggen är samma som laget har på lagfotot.'][Math.floor(t / 4) % 3], { x: D.COACH.x, y: D.COACH.y - 44 }); } },
    { id: 'boll', r: [D.PITCH.x0, D.PITCH.y0 + 18, D.PITCH.x1, D.PITCH.y1], go: [D.BALL0[0], D.BALL0[1] + 12], act: () => kick() },
    { id: 'pokaler', r: [578, 30, 642, 58], go: [610, WALL_Y + 12], act: () => say('🏆 Pokalerna! Kungsladugård har vunnit en hel hylla.') },
  ];
  for (const f of [floor1, floor2]) for (const s of f.spots) s.floor = f.n;
  const spotAt = (x, y) => F.spots.find((h) => x >= h.r[0] && x <= h.r[2] && y >= h.r[1] && y <= h.r[3]);
  // den sak man står vid (eller pekar på) får namnskylten nertill; musens pekning glöms
  // efter en stund utan rörelse (main.js säger inte till när musen lämnar spelet)
  const focusSpot = () => {
    if (climb) return null;
    const h = hoverId && t - hoverT < 4 && F.spots.find((s) => s.id === hoverId);
    if (h && h.act && !['dorr', 'kassa', 'coach', 'pokaler'].includes(h.id) && !h.id.startsWith('prov')) return h;
    if (W().path.length) return null;
    return F.spots.find((s) => (s.item || s.place || s.kungs || s.team || s.cleat || s.kit || s.stairs || s.photo) && Math.abs(W().px - s.go[0]) < 7 && Math.abs(W().py - s.go[1]) < 7) || null;
  };

  // ---------- trappan ----------
  const nag = (msg) => { if (t - nagAt > 1.2) { nagAt = t; toast(msg); } };
  function startClimb() {
    talk.clear();
    climb = { e: F.n === 1 ? D.STAIRS1 : D.STAIRS2, d: -12, v: STAIR_V };
    W().stop();
    play('click');
  }
  function enterFloor(n, at) {
    F = floors[n];
    const w = F.walker;
    w.stop(); w.px = at[0]; w.py = at[1]; w.snapFree(); w.dir = 'down';
    hoverId = null;
    floorT = t;
    syncView();
    snapCam();
  }
  function climbStep(dt) {
    climb.d += climb.v * dt;
    const e = climb.e;
    if (climb.v > 0 && climb.d >= e.top) {
      // försvunnen genom taket (plan 1) eller ner i schaktet (plan 2): byt våning
      const other = e.n === 1 ? D.STAIRS2 : D.STAIRS1;
      enterFloor(other.n, other.n === 1 ? board1 : board2);
      climb = { e: other, d: other.top, v: -STAIR_V };
      fade = 0.7;
      play('slide');
    } else if (climb.v < 0 && climb.d <= -12) {
      const w = W(), b = e.n === 1 ? board1 : board2;
      climb = null;
      w.px = b[0]; w.py = b[1]; w.snapFree();
      if (e.n === 2) { w.walkTo(b[0] + 6, b[1] + 16); toast('⚽ PLAN 2 – SPORT & FOTBOLL. Kungsladugård till vänster, kända lag till höger!', 'good'); }
      else { w.walkTo(b[0] - 6, b[1] + 16); toast('👗 PLAN 1 – MODE. Tjejer till vänster, killar till höger.', 'good'); }
    }
  }
  const climbPos = () => {
    const e = climb.e;
    return climb.d < 0 ? [e.lx + e.sx * climb.d, e.ly] : PT.stairPos(e, climb.d);
  };
  const climbDir = () => { const right = (climb.v > 0) === (climb.e.sx > 0); return right ? 'right' : 'left'; };
  const playerPos = () => (climb ? climbPos() : [W().px, W().py]);

  // ---------- bollen på provplanen ----------
  function kick() {
    if (ball.st !== 'rest') { say('Vänta tills bollen har rullat tillbaka!'); return; }
    const w = W();
    w.dir = 'up';
    ball.st = 'fly'; ball.t = 0; ball.fx = ball.x; ball.fy = ball.y;
    ball.tx = D.GOAL.x + Math.round((Math.random() - 0.5) * 18); ball.ty = D.GOAL.y - 5;
    play('slide');
  }
  function ballStep(dt) {
    if (ball.st === 'rest') return;
    ball.t += dt;
    if (ball.st === 'fly') {
      const k = Math.min(1, ball.t / 0.55);
      ball.x = ball.fx + (ball.tx - ball.fx) * k; ball.y = ball.fy + (ball.ty - ball.fy) * k; ball.z = Math.sin(k * Math.PI) * 12;
      if (k >= 1) {
        ball.st = 'net'; ball.t = 0; ball.z = 0;
        play('ok');
        // bubblan en bit åt sidan så att bollen i nätet syns
        talk.say(['MÅÅÅL! ⚽', 'MÅL! HEJA KUNGSLADUGÅRD!', 'KRYSSET! 🎯'][Math.floor(Math.random() * 3)], () => ({ x: W().px + 46, y: W().py - 36 }), 2.2, { self: true });
      }
    } else if (ball.st === 'net' && ball.t > 1.3) { ball.st = 'back'; ball.t = 0; ball.fx = ball.x; ball.fy = ball.y; }
    else if (ball.st === 'back') {
      const k = Math.min(1, ball.t / 1.1), e = 1 - (1 - k) * (1 - k);
      ball.x = ball.fx + (D.BALL0[0] - ball.fx) * e; ball.y = ball.fy + (D.BALL0[1] - ball.fy) * e;
      if (k >= 1) { ball.st = 'rest'; ball.x = D.BALL0[0]; ball.y = D.BALL0[1]; }
    }
  }

  // ---------- kameran ----------
  // Sidled: följer figuren längs våningen. Höjdled: mobilens NÄRA-läge beskär upptill och
  // nertill (main.js v.safe) – då följer en lodrät kamera figuren inom det synliga radbandet,
  // så att lagfotot och skoväggen syns när man står vid väggen och dockraderna med sina lappar
  // när man går ner (samma sätt som i terminalen). På datorn syns allt och ty förblir 0.
  syncView();
  const camTarget = () => lockedCam ?? Math.max(0, Math.min(F.W - VW, playerPos()[0] - VW / 2));
  const band = () => {
    const s = A.view?.safe;
    const y0 = Math.max(0, Math.min(H - 96, Math.round(s?.y0 ?? 0)));
    const y1 = Math.max(y0 + 96, Math.min(H, Math.round(s?.y1 ?? H)));
    return { y0, y1, v: y1 - y0 };
  };
  const camYTarget = () => {
    const b = band();
    if (b.v >= H) return 0;
    return Math.max(0, Math.min(H - b.v, Math.round(playerPos()[1] - b.v * 0.62)));
  };
  const cam = { x: camTarget(), y: camYTarget() };
  let ty = 0;                        // radförskjutningen i senaste ritningen: skärm-y = värld-y + ty
  const syncTy = () => { ty = band().y0 - Math.round(cam.y); };
  const snapCam = () => { cam.x = camTarget(); cam.y = camYTarget(); syncTy(); };
  syncTy();

  // ---------- andra spelare (y + 1000 = plan 2) ----------
  // Byter någon våning hoppar hens worldY ±1000, och nätet (world.js) låter figuren glida dit.
  // Mellanläget ska inte synas: med målet (f.ty, world.js-patchen) ritas figuren direkt där den
  // ska vara; utan det göms den medan den glider mellan våningarna och syns när den är framme.
  const FLOOR_DY = 1000, TRANSIT = new Map(), LASTY = new Map(); // id → egen glidning { x, y } (med mål) / { t } (utan) · id → förra y
  const floorOf = (y) => (y >= FLOOR_DY * 0.6 ? 2 : 1);
  const onFloorBand = (y) => { const ly = y - (floorOf(y) === 2 ? FLOOR_DY : 0); return ly >= -8 && ly <= H + 40; };
  let folkCache = [];
  function folkStep(dt) {
    const out = [], seen = new Set();
    for (const f of worldFolksHere(A)) {
      seen.add(f.id);
      const hasTarget = Number.isFinite(f.ty);
      const goal = hasTarget ? f.ty : f.y;
      if (floorOf(goal) !== F.n) { TRANSIT.delete(f.id); continue; }
      const base = F.n === 2 ? FLOOR_DY : 0;
      if (hasTarget) {
        // Ett stort hopp (våningsbyte): figuren dyker upp direkt vid målet och glider sedan
        // själv härifrån med samma lag som world.js (max(62, 3·avstånd) px/s) – när nätets
        // glidning hunnit ikapp tar den över igen. Ingen glidning genom tak eller golv.
        const gx = Number.isFinite(f.tx) ? f.tx : f.x;
        let tr = TRANSIT.get(f.id);
        if (!tr && Math.abs(f.y - goal) > 60) { tr = { x: gx, y: goal }; TRANSIT.set(f.id, tr); }
        if (tr) {
          const dx = gx - tr.x, dy = goal - tr.y, dist = Math.hypot(dx, dy), step = Math.max(62, dist * 3) * dt;
          if (dist <= step) { tr.x = gx; tr.y = goal; } else { tr.x += dx / dist * step; tr.y += dy / dist * step; }
          if (Math.hypot(f.x - tr.x, f.y - tr.y) < 1) TRANSIT.delete(f.id);
          else { out.push({ ...f, x: tr.x, y: tr.y - base, walking: dist > 1 }); continue; }
        }
        out.push({ ...f, y: f.y - base });
        continue;
      }
      // utan mål: ett hopp (mycket fortare än man går) eller ett y mellan våningarna = på väg
      const prev = LASTY.get(f.id), v = prev == null ? 0 : Math.abs(f.y - prev) / Math.max(dt, 1e-3);
      LASTY.set(f.id, f.y);
      let tr = TRANSIT.get(f.id);
      if (!onFloorBand(f.y) || v > 400) { TRANSIT.set(f.id, { t: 0 }); continue; }
      if (tr) {
        // fortfarande i glidningen: göm tills den saktat in till gångfart (eller 1,6 s gått)
        tr.t += dt;
        if (v > 70 && tr.t < 1.6 && f.walking) continue;
        TRANSIT.delete(f.id);
      }
      out.push({ ...f, y: f.y - base });
    }
    for (const id of TRANSIT.keys()) if (!seen.has(id)) TRANSIT.delete(id);
    for (const id of LASTY.keys()) if (!seen.has(id)) LASTY.delete(id);
    folkCache = out;
  }
  const folksHere = () => folkCache;
  function folkDrawables() {
    return folksHere().map((f) => ({
      fy: f.y,
      draw(ctx) {
        drawPerson(ctx, f.x, f.y, f.av.look, 'down', f.walking ? WALK_SEQ[Math.floor(t * 8.5) % 4] : (Math.sin(t * 2 + f.x) > 0.9 ? 4 : 0));
        nameTag(ctx, f.x, f.y - 50, f.av);
        if (f.emote) emoteBubble(ctx, f.x, f.y - 58, f.emote);
        if (f.say) sayBubble(ctx, f.x, f.y - (f.emote ? 76 : 60), f.say, { voice: f.av || f.id });
      },
    }));
  }

  // ---------- ritning ----------
  function drawStairs(ctx, e, S) {
    ctx.drawImage(S.back, S.x, S.y);
    ctx.drawImage(S.steps, S.x, S.y);
    if (climb && climb.e === e) {
      ctx.save();
      ctx.beginPath();
      if (e.sy < 0) ctx.rect(S.x - 20, e.clip, S.w + 40, 400); else ctx.rect(S.x - 20, e.clip - 400, S.w + 40, 400);
      ctx.clip();
      const [x, y] = climbPos();
      drawPerson(ctx, x, y, A.avatar.look, climbDir(), WALK_SEQ[Math.floor(t * 8.5) % 4]);
      ctx.restore();
    }
    ctx.drawImage(S.front, S.x, S.y);
    if (e.sy > 0) ctx.drawImage(P.pitFront, p0 - 1, pl - 1);
  }
  function drawGarments(ctx, p, focus) {
    const on = focus?.place === p;
    if (p.kind === 'wall') {
      if (on) { ctx.fillStyle = 'rgba(255,230,128,.35)'; ctx.fillRect(p.x + 1, 38, D.MOD_W - 2, WALL_Y - 12 - 38); }
      p.items.slice(0, 6).forEach((it, i) => {
        const cx = p.x + 8 + i * 12;
        drawHanging(ctx, it, cx, PT.MOD_RAIL);
        if (owns(g, it)) ownDot(ctx, cx + 2, PT.MOD_RAIL + 2);
      });
    } else {
      const img = P.racks.get(p.cat.id), top = p.base - PT.RACK_H + 1;
      if (on) ctx.drawImage(P.glow, p.x + D.RACK_W / 2 - 20, p.base - 7);
      ctx.drawImage(img, p.x, top);
      p.items.slice(0, 5).forEach((it, i) => {
        const cx = p.x + 10 + i * 13;
        drawHanging(ctx, it, cx, top + PT.RACK_RAIL - 1);
        if (owns(g, it)) ownDot(ctx, cx + 2, top + PT.RACK_RAIL + 1);
      });
      if (on) { ctx.strokeStyle = '#ffe070'; ctx.lineWidth = 1; ctx.strokeRect(p.x - 1.5, top - 1.5, D.RACK_W + 3, 13); }
    }
  }

  function draw1(ctx, focus) {
    // väggen: affischen, REA-skylten, plaggen i väggmodulerna
    drawPoster(ctx);
    if (g.eventIs('rea')) drawRea(ctx, t);
    for (const p of PLACES1) if (p.kind === 'wall') drawGarments(ctx, p, focus);
    const list = [...folkDrawables()];
    if (!climb) list.push(selfDrawable(A, W(), t, { folksHere: folksHere().length }));
    for (const d of DUMMIES) list.push({
      fy: d.y,
      draw: () => {
        const on = focus?.item === d;
        if (on) ctx.drawImage(P.glow, d.x - 20, d.y - 7);
        ctx.drawImage(P.pod[d.dept], d.x - 12, d.y - 4);
        drawPerson(ctx, d.x, d.y, d.look, 'down', 0);
        const [hx, hy] = HANG_AT[d.it.slot] || HANG_AT.top;
        hangTag(ctx, d.x + hx, d.y + hy, owns(g, d.it), on && Math.floor(t * 4) % 2 === 0);
        dummyTag(ctx, d.x, d.y + 7, d.it, owns(g, d.it), g, d.dept, false, d.short);
        if (on) sparkle(ctx, d, t);
      },
    });
    for (const p of PLACES1) if (p.kind === 'rack') list.push({ fy: p.base, draw: () => drawGarments(ctx, p, focus) });
    list.push({
      fy: D.GOND.y + D.GOND.h,
      draw: () => {
        ctx.drawImage(P.gond, D.GOND.x, D.GOND.y);
        for (const s of SHELF) {
          const on = focus?.item === s;
          if (on) { ctx.fillStyle = 'rgba(255,230,128,.45)'; ctx.fillRect(s.x - 13, s.y - (s.y === GTOP ? 23 : 17), 26, s.y === GTOP ? 23 : 17); }
          if (s.it.slot === 'bag') drawBag(ctx, s.x, s.y, s.it.look.bag, s.look.bagColor);
          else if (s.it.slot === 'glasses') drawGlassesStand(ctx, s.x, s.y, s.it.look.glasses);
          else drawBust(ctx, s.x, s.y, s.look);
          priceTag(ctx, s.x, s.y + 1, s.it, owns(g, s.it), g);
        }
      },
    });
    list.push({
      fy: D.HATS.y + D.HATS.h,
      draw: () => {
        ctx.drawImage(P.hats, D.HATS.x, D.HATS.y);
        for (const b of HATBUSTS) {
          const on = focus?.item === b;
          if (on) { ctx.fillStyle = 'rgba(255,230,128,.45)'; ctx.fillRect(b.x - 12, b.y - 24, 24, 24); }
          drawBust(ctx, b.x, b.y, b.look);
          priceTag(ctx, b.x, b.y + 1, b.it, owns(g, b.it), g);
        }
      },
    });
    list.push({
      fy: D.DESK.y + D.DESK.h,
      draw: () => {
        drawPerson(ctx, D.DESK.x + 34, D.DESK.y + 14, CLERK, 'down', Math.sin(t * 1.7) > 0.93 ? 4 : 0);
        ctx.drawImage(P.desk, D.DESK.x, D.DESK.y);
      },
    });
    list.push({ fy: D.STAIRS1.ly + 4, draw: () => { if (focus?.stairs) stairGlow(ctx, D.STAIRS1); drawStairs(ctx, D.STAIRS1, P.stairs1); } });
    for (const [x, y] of D.PLANTS1) list.push({ fy: y, draw: () => ctx.drawImage(P.plant, x - 11, y - 31) });
    list.sort((a, b) => a.fy - b.fy).forEach((d) => d.draw(ctx));
    // den valda dockans lapp överst (så att ingen som går förbi skymmer den), med ljus ram
    if (focus && DUMMIES.includes(focus.item)) dummyTag(ctx, focus.item.x, focus.item.y + 7, focus.item.it, owns(g, focus.item.it), g, focus.item.dept, true, focus.item.short);
  }

  function draw2(ctx, focus) {
    for (const p of PLACES2) if (p.kind === 'wall') drawGarments(ctx, p, focus);
    // fotbollsskorna på väggen
    for (const s of PT.SHOE_SPOTS) {
      const on = focus?.cleat === s;
      if (on) { ctx.fillStyle = 'rgba(255,230,128,.5)'; ctx.fillRect(s.x - 2, s.y - 11, 20, 12); }
      ctx.drawImage(PT.cleatImg(s.c), s.x, s.y - 9);
      if (owns(g, itemById('shoes-cleats'))) ownDot(ctx, s.x + 16, s.y - 9);
    }
    const list = [...folkDrawables()];
    if (!climb) list.push(selfDrawable(A, W(), t, { folksHere: folksHere().length }));
    for (const k of KUNGS) list.push({
      fy: k.y,
      draw: () => {
        const on = focus?.kungs === k;
        if (on) ctx.drawImage(P.glow, k.x - 20, k.y - 7);
        ctx.drawImage(P.pod.kungs, k.x - 12, k.y - 4);
        drawTeamDoll(ctx, k.x, k.y, k.look, 'up', { ...KSOCKS, number: k.n, name: k.name });
        numberPlate(ctx, k.x, k.y + 7, k.n, k.name, on);
      },
    });
    list.push({ fy: D.KIT_DOLL.y, draw: () => { drawKitDoll(ctx, focus?.kit); } });
    for (const tm of TEAMS) list.push({ fy: tm.y, draw: () => drawTeam(ctx, tm, focus?.team === tm, true) });
    for (const p of PLACES2) if (p.kind === 'rack') list.push({ fy: p.base, draw: () => drawGarments(ctx, p, focus) });
    list.push({ fy: D.STAIRS2.pit[3], draw: () => { if (focus?.stairs) stairGlow(ctx, D.STAIRS2); drawStairs(ctx, D.STAIRS2, P.stairs2); } });
    list.push({ fy: D.COACH.y, draw: () => { drawPerson(ctx, D.COACH.x, D.COACH.y, COACH_LOOK, 'down', Math.sin(t * 1.3) > 0.93 ? 4 : 0); whistle(ctx, D.COACH.x, D.COACH.y); } });
    list.push({ fy: D.GOAL.y, draw: () => { ctx.drawImage(P.goal, D.GOAL.x - 16, D.GOAL.y - 19); if (ball.st === 'net' && Math.floor(ball.t * 10) % 2 === 0) { ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.fillRect(D.GOAL.x - 13, D.GOAL.y - 15, 26, 13); } } });
    list.push({ fy: ball.y + (ball.st === 'net' ? -20 : 0), draw: () => drawBall(ctx, ball, focus?.id === 'boll', t) });
    for (const [x, y] of D.PLANTS2) list.push({ fy: y, draw: () => ctx.drawImage(P.plant, x - 11, y - 31) });
    list.push({ fy: BENCH.y, draw: () => ctx.drawImage(P.bench, BENCH.x, BENCH.y - 15) });
    list.sort((a, b) => a.fy - b.fy).forEach((d) => d.draw(ctx));
    // den valda dockans lapp överst: figuren står framför dockan och skymmer den annars
    if (focus?.kungs) numberPlate(ctx, focus.kungs.x, focus.kungs.y + 7, focus.kungs.n, focus.kungs.name, true);
    else if (focus?.team) drawTeam(ctx, focus.team, true, false);
    else if (focus?.kit) drawKitDoll(ctx, true, false);
  }
  // Lagets matchställ (säljs): lappen FRÅN 390 KR, TA PÅ DIG när tröjan redan är din, PÅ DIG när man bär den
  function kitState(it, shirt) {
    if (wearsShirt(A.avatar.look, it, shirt)) return ['PÅ DIG', 'on'];
    if (owns(g, it)) return ['TA PÅ DIG', 'have'];
    return null;
  }
  function drawKitDoll(ctx, on, doll = true) {
    const it = itemById('top-football');
    if (doll) {
      if (on) ctx.drawImage(P.glow, D.KIT_DOLL.x - 20, D.KIT_DOLL.y - 7);
      ctx.drawImage(P.pod.kungs, D.KIT_DOLL.x - 12, D.KIT_DOLL.y - 4);
      drawTeamDoll(ctx, D.KIT_DOLL.x, D.KIT_DOLL.y, KIT_LOOK, 'down', KSOCKS);
    }
    const st = kitState(it, D.KUNGS_KIT.shirt);
    plate(ctx, D.KIT_DOLL.x, D.KIT_DOLL.y + 7, 'MATCHSTÄLL', st ? st[0] : `FRÅN ${priceOf(g, it)} KR`, st?.[1], '#d9434b', on);
  }
  function drawTeam(ctx, tm, on, doll = true) {
    if (doll) {
      if (on) ctx.drawImage(P.glow, tm.x - 20, tm.y - 7);
      ctx.drawImage(P.pod.lag, tm.x - 12, tm.y - 4);
      drawTeamDoll(ctx, tm.x, tm.y, tm.look, 'down', { socks: tm.socks, stripe: tm.socks });
    }
    const st = kitState(tm.it, tm.colors.shirt);
    plate(ctx, tm.x, tm.y + 7, tm.city, st ? st[0] : `${priceOf(g, tm.it)} KR`, st?.[1], tm.colors.shirt === '#f4f1ea' ? tm.colors.accent : tm.colors.shirt, on);
  }

  return {
    get worldX() { return playerPos()[0]; },
    get worldY() { return playerPos()[1] + (F.n === 2 ? 1000 : 0); },
    get floor() { return F.n; },
    viewMax: { get w() { return F.W; }, h: H },
    _debug: {
      floor: () => F.n,
      goFloor: (n) => { climb = null; enterFloor(n === 2 ? 2 : 1, n === 2 ? [board2[0] + 8, board2[1] + 14] : [(D.DOOR.x0 + D.DOOR.x1) / 2, WALL_Y + 14]); return F.n; },
      spot: (id) => { const h = F.spots.find((s) => s.id === id); return h ? { x: (h.r[0] + h.r[2]) / 2 - cam.x, y: (h.r[1] + h.r[3]) / 2 + ty } : null; },
      spots: () => F.spots.map((s) => s.id),
      dummies: DUMMIES.map((d) => d.it.legacy || d.it.id),
      dummyIds: DUMMIES.map((d) => d.it.id),
      depts: DUMMIES.map((d) => d.dept),
      places: () => [...PLACES1, ...PLACES2].map((p) => ({ id: p.cat.id, kind: p.kind, dept: p.dept, x: p.x, n: p.items.length, shown: p.items.slice(0, p.kind === 'wall' ? 6 : 5).map((it) => it.id), items: p.items.map((it) => it.id) })),
      kungs: () => KUNGS.map((k) => ({ n: k.n, name: k.name, x: k.x, y: k.y })),
      teams: () => TEAMS.map((tm) => ({ city: tm.city, item: tm.it?.id, x: tm.x, y: tm.y })),
      lockCam: (x) => { lockedCam = x === null || x === undefined ? null : Math.max(0, Math.min(F.W - VW, x)); snapCam(); },
      teleport: (x, y) => { const w = W(); climb = null; w.px = x; w.py = y; w.stop(); w.snapFree(); snapCam(); },
      hover: (id) => { hoverId = id || null; hoverT = t; },
      cam: () => ({ x: cam.x, y: cam.y, ty, band: band() }),
      view: () => VW,
      pos: () => { const [x, y] = playerPos(); return { x: Math.round(x), y: Math.round(y), floor: F.n }; },
      path: () => W().path.map(([x, y]) => [Math.round(x), Math.round(y)]),
      climb: () => (climb ? { floor: climb.e.n, d: Math.round(climb.d), v: climb.v } : null),
      stairs: () => startClimb(),
      ball: () => ({ st: ball.st, x: Math.round(ball.x), y: Math.round(ball.y) }),
      kick: () => kick(),
      open: (id) => F.spots.find((h) => h.id === id)?.act?.(),
      focus: () => focusSpot()?.id || null,
      // lapparnas rad 2 under lagdockorna (pris / TA PÅ DIG / PÅ DIG) och matchställsdockan
      plates: () => ({ kit: kitState(itemById('top-football'), D.KUNGS_KIT.shirt)?.[0] || 'PRIS', teams: TEAMS.map((tm) => kitState(tm.it, tm.colors.shirt)?.[0] || 'PRIS') }),
      label: () => lastLabel,       // senaste namnskylten (skärmrutan) – för mobiltestet
      band: () => band(),
      folks: () => folkCache.map((f) => ({ id: f.id, x: Math.round(f.x), y: Math.round(f.y) })), // andra spelare på våningen
      owns: (id) => owns(g, itemById(id)),
    },
    update(dt) {
      t += dt;
      syncView();
      if (climb) climbStep(dt); else W().update(dt);
      ballStep(dt);
      if (fade > 0) fade = Math.max(0, fade - dt * 1.6);
      const k = lockedCam !== null ? 1 : Math.min(1, dt * 6);
      cam.x += (camTarget() - cam.x) * k;
      const ky = camYTarget() - cam.y;
      cam.y = Math.abs(ky) < 0.5 ? camYTarget() : cam.y + ky * Math.min(1, dt * 5);
      folkStep(dt);
    },
    exit() { talk.clear(); }, // pratbubblan och rösten stannar i butiken
    down(sx, sy) {
      const x = sx + cam.x, y = sy - ty; // skärm → värld (radbandet kan vara förskjutet)
      hoverId = null; // skylten följer figuren igen tills musen rör sig
      if (climb) { nag(climb.e.n === 1 && climb.v > 0 || climb.e.n === 2 && climb.v < 0 ? '⬆️ Vänta tills du är uppe!' : '⬇️ Vänta tills du är nere!'); return; }
      const h = spotAt(x, y);
      if (h) { W().walkTo(h.go[0], h.go[1], h.act); return; }
      if (y > WALL_Y) W().walkTo(x, y);
    },
    move(sx, sy) { hoverId = spotAt(sx + cam.x, sy - ty)?.id || null; hoverT = t; },
    draw(ctx) {
      syncView();
      const cx = Math.round(cam.x);
      syncTy();
      const b = band();
      if (ty !== 0) {
        // radbandet är förskjutet (mobilens NÄRA-läge): raderna utanför våningen ligger under
        // beskärningen, men får ändå en mörk ton i stället för förra bildrutans rester
        ctx.setTransform(A.pxs, 0, 0, A.pxs, 0, 0);
        ctx.fillStyle = '#0e0d12'; ctx.fillRect(0, 0, VW, Math.max(H, A.H || H));
      }
      ctx.setTransform(A.pxs, 0, 0, A.pxs, -cx * A.pxs, ty * A.pxs);
      ctx.drawImage(F.bg, cx, 0, VW, H, cx, 0, VW, H);
      const focus = focusSpot();
      if (F.n === 1) draw1(ctx, focus); else draw2(ctx, focus);
      talk.draw(ctx, { x0: cx, x1: cx + VW });
      // skärmen: våningsskylt, pilar mot det man inte ser, namnskylten, tonad övergång –
      // alltid inom den synliga rutan (b.y0–b.y1)
      ctx.setTransform(A.pxs, 0, 0, A.pxs, 0, 0);
      if (t - floorT < 4) floorPlate(ctx, F, t - floorT, b.y0);
      if (F.n === 1) {
        if (cx > 150) edgeSign(ctx, 'TJEJER', DEPT_LBL.tjej, true, b.y1);
        if (cx < F.W - VW - 150) edgeSign(ctx, 'KILLAR', DEPT_LBL.kille, false, b.y1);
      } else {
        if (cx > 330) edgeSign(ctx, 'KUNGSLADUGÅRD', DEPT_LBL.kungs, true, b.y1);
        if (cx < F.W - VW - 330) edgeSign(ctx, 'KÄNDA LAG', DEPT_LBL.lag, false, b.y1);
      }
      // namnskylten nertill – eller upptill när figuren själv står längst ner i bild
      lastLabel = null;
      if (focus) bigLabel(ctx, focus, g, t, playerPos()[1] + ty > b.y1 - 44 ? b.y0 + (t - floorT < 4 ? 21 : 3) : b.y1 - 25);
      if (fade > 0) { ctx.fillStyle = `rgba(14,13,18,${Math.min(1, fade * 1.4).toFixed(3)})`; ctx.fillRect(0, 0, VW, Math.max(H, A.H || H)); }
    },
  };

  // ---------- namnskylten i skärmens nederkant ----------
  function bigLabel(ctx, spot, g, t, y0) {
    let name, right, hint, own = false, key = spot.dept || 'mid';
    if (spot.item) {
      const it = spot.item.it;
      own = owns(g, it);
      name = pix(nameOf(it)); right = own ? 'DIN!' : `${priceOf(g, it)} KR`;
      hint = own ? 'KLICKA SÅ TAR DU PÅ DIG DEN' : 'KLICKA SÅ PROVAR DU DEN PÅ DIG';
    } else if (spot.place) {
      const p = spot.place, n = p.items.length, mine = p.items.filter((it) => owns(g, it)).length;
      name = pix(p.cat.name); right = `${n} PLAGG`; hint = mine ? `${mine} ÄR DINA · KLICKA SÅ BLÄDDRAR DU` : 'KLICKA SÅ BLÄDDRAR DU BLAND ALLA';
    } else if (spot.kungs) {
      const k = spot.kungs;
      name = pix(`NR ${k.n} ${k.name}`); right = 'KUNGSLADUGÅRD'; hint = 'KLICKA SÅ PROVAR DU MATCHSTÄLLET';
    } else if (spot.kit || spot.team) {
      // tröjmodellen delas av flera lag: äger man den tar man bara på sig den i lagets färger
      const it = spot.kit ? itemById('top-football') : spot.team.it;
      const shirt = spot.kit ? D.KUNGS_KIT.shirt : spot.team.colors.shirt;
      const on = wearsShirt(A.avatar.look, it, shirt), have = owns(g, it);
      own = on || have;
      name = spot.kit ? 'KUNGSLADUGÅRDS MATCHSTÄLL' : pix(spot.team.city);
      right = on ? 'PÅ DIG!' : have ? 'TRÖJAN HAR DU' : `${spot.kit ? 'FRÅN ' : ''}${priceOf(g, it)} KR`;
      hint = have && !on ? 'KLICKA SÅ TAR DU PÅ DIG DEN I LAGETS FÄRGER' : spot.kit ? 'TRÖJA, SHORTS OCH FOTBOLLSSKOR' : 'KLICKA SÅ PROVAR DU MATCHSTÄLLET';
    } else if (spot.photo) {
      name = 'LAGFOTOT'; right = 'KUNGSLADUGÅRD'; hint = 'KLICKA SÅ SER DU HELA LAGET I STORT';
    } else if (spot.cleat) {
      const it = itemById('shoes-cleats'); own = owns(g, it);
      name = pix(`${spot.cleat.c.name} fotbollsskor`); right = own ? 'DIN!' : `${priceOf(g, it)} KR`; hint = own ? 'KLICKA SÅ TAR DU PÅ DIG DEM' : 'KLICKA SÅ PROVAR DU DEM PÅ DIG';
    } else if (spot.stairs) {
      name = F.n === 1 ? 'TRAPPA UPP' : 'TRAPPA NER'; right = F.n === 1 ? 'PLAN 2' : 'PLAN 1'; hint = F.n === 1 ? 'SPORT + FOTBOLL · KUNGSLADUGÅRD' : 'MODE · TJEJER OCH KILLAR';
      key = F.n === 1 ? 'kungs' : 'mid';
    } else if (spot.id === 'boll') { name = 'PROVPLANEN'; right = ''; hint = 'KLICKA SÅ SKJUTER DU PÅ MÅL'; key = 'lag'; }
    else return;
    const lblC = DEPT_LBL[key] || '#f0d048';
    name = pix(name); right = pix(right || ''); hint = pix(hint);
    const nw = textW(BIG, name), pw = right ? textW(BIG, right) : 0, hw = textW(SMALL, hint);
    let w = Math.max(nw + pw + (right ? 26 : 20), hw + 26), big = true;
    if (w > VW - 8) { big = false; w = Math.max(textW(SMALL, name) + textW(SMALL, right) + 26, hw + 26); }
    const h = 22, x0 = Math.round((VW - w) / 2);
    lastLabel = { x0, y0, w, h, name };
    ctx.fillStyle = '#0e0d12'; ctx.fillRect(x0 - 2, y0 - 2, w + 4, h + 4);
    ctx.fillStyle = lblC; ctx.fillRect(x0 - 1, y0 - 1, w + 2, h + 2);
    ctx.fillStyle = '#17151a'; ctx.fillRect(x0, y0, w, h);
    hangTag(ctx, x0 + 4, y0 + 3, own, false);
    const F2 = big ? BIG : SMALL;
    ctxText(ctx, F2, name, x0 + 16, y0 + (big ? 3 : 4), '#ffffff');
    if (right) ctxText(ctx, F2, right, x0 + 22 + textW(F2, name), y0 + (big ? 3 : 4), own ? '#6fe08a' : '#f0d048');
    const blink = Math.floor(t * 2) % 2 === 0;
    ctxText(ctx, SMALL, hint, x0 + 16, y0 + 14, blink ? lblC : '#c9c2d2');
  }
  // Våningsskylten: syns en stund när man kommer in eller byter våning, glider sedan upp
  function floorPlate(ctx, F, age, top = 0) {
    const lbl = F.name, w = textW(BIG, lbl) + 16, h = 15;
    const x0 = Math.round((VW - w) / 2), y0 = top + 3 - Math.round(Math.max(0, age - 3.4) * 60);
    ctx.fillStyle = '#0e0d12'; ctx.fillRect(x0 - 2, y0 - 2, w + 4, h + 4);
    ctx.fillStyle = F.col; ctx.fillRect(x0 - 1, y0 - 1, w + 2, h + 2);
    ctx.fillStyle = '#17151a'; ctx.fillRect(x0, y0, w, h);
    ctxText(ctx, BIG, lbl, x0 + 8, y0 + 4, '#ffffff');
  }
}

// ================= små ritningar =================
const DEPT_LBL = Object.fromEntries(Object.entries(D.DEPT).map(([k, v]) => [k, v.lbl]));

// grön prick = plagget är ditt
function ownDot(ctx, x, y) {
  ctx.fillStyle = '#17151a'; ctx.fillRect(x - 1, y - 1, 5, 5);
  ctx.fillStyle = '#45b964'; ctx.fillRect(x, y, 3, 3);
  ctx.fillStyle = '#8fe0a2'; ctx.fillRect(x, y, 3, 1);
}
// Mannekängens lapp: namnet överst, priset under (grön "DIN"-lapp när den är din)
function dummyTag(ctx, x, y, it, isOwned, g, dept, hi = false, short = null) {
  const name = short || SHORT[it.id] || pix(nameOf(it));
  const price = priceOf(g, it), rea = price !== it.price;
  const line2 = isOwned ? 'DIN' : `${price} KR`;
  const w = Math.max(textW(SMALL, name), textW(SMALL, line2)) + 6, h = 15;
  const x0 = Math.round(x - w / 2);
  if (hi) { ctx.fillStyle = '#ffe070'; ctx.fillRect(x0 - 2, y - 2, w + 4, h + 4); }
  ctx.fillStyle = '#17151a'; ctx.fillRect(x0 - 1, y - 1, w + 2, h + 2);
  ctx.fillStyle = isOwned ? '#45b964' : '#fbf6ea'; ctx.fillRect(x0, y, w, h);
  ctx.fillStyle = isOwned ? '#2f8f46' : D.DEPT[dept]?.tag || '#3a7bd5'; ctx.fillRect(x0, y, w, 2);
  ctxText(ctx, SMALL, name, x0 + Math.round((w - textW(SMALL, name)) / 2), y + 3, isOwned ? '#ffffff' : '#17151a');
  ctxText(ctx, SMALL, line2, x0 + Math.round((w - textW(SMALL, line2)) / 2), y + 9, isOwned ? '#ffffff' : rea ? '#c9323a' : '#6d4a10');
}
// Lapp under en lag-docka: rad 1 (namn/stad), rad 2 (pris / TA PÅ DIG / PÅ DIG), färgad topplist.
// st: 'on' = man bär tröjan i de här färgerna (grön lapp), 'have' = tröjmodellen är ens egen (grön text)
function plate(ctx, x, y, l1, l2, st, col, hi) {
  const on = st === 'on' || st === true;
  const w = Math.max(textW(SMALL, l1), textW(SMALL, l2)) + 4, h = 15, x0 = Math.round(x - w / 2);
  if (hi) { ctx.fillStyle = '#ffe070'; ctx.fillRect(x0 - 2, y - 2, w + 4, h + 4); }
  ctx.fillStyle = '#17151a'; ctx.fillRect(x0 - 1, y - 1, w + 2, h + 2);
  ctx.fillStyle = on ? '#45b964' : '#fbf6ea'; ctx.fillRect(x0, y, w, h);
  ctx.fillStyle = col || '#46a35a'; ctx.fillRect(x0, y, w, 2);
  ctxText(ctx, SMALL, l1, x0 + Math.round((w - textW(SMALL, l1)) / 2), y + 3, on ? '#ffffff' : '#17151a');
  ctxText(ctx, SMALL, l2, x0 + Math.round((w - textW(SMALL, l2)) / 2), y + 9, on ? '#ffffff' : st === 'have' ? '#2f8f46' : '#6d4a10');
}
// Nummerskylten under en Kungsladugård-spelare: numret i vinrött, förnamnet under
function numberPlate(ctx, x, y, n, name, hi) {
  const nm = pix(name), num = String(n);
  const w = Math.max(textW(SMALL, nm), textW(SMALL, num) + 4) + 4, h = 15, x0 = Math.round(x - w / 2);
  if (hi) { ctx.fillStyle = '#ffe070'; ctx.fillRect(x0 - 2, y - 2, w + 4, h + 4); }
  ctx.fillStyle = '#17151a'; ctx.fillRect(x0 - 1, y - 1, w + 2, h + 2);
  ctx.fillStyle = '#f6efe6'; ctx.fillRect(x0, y, w, h);
  const nw = textW(SMALL, num) + 4, nx = Math.round(x - nw / 2);
  ctx.fillStyle = '#7a1f2e'; ctx.fillRect(nx, y, nw, 7);
  ctxText(ctx, SMALL, num, nx + 2, y + 1, '#ffffff');
  ctxText(ctx, SMALL, nm, x0 + Math.round((w - textW(SMALL, nm)) / 2), y + 9, '#3a0d16');
}
// Liten prislapp under en vara på hyllan ("150:-" = 150 kronor)
function priceTag(ctx, x, y, it, isOwned, g) {
  const price = priceOf(g, it);
  const lbl = isOwned ? 'DIN' : `${price}:-`;
  const w = textW(SMALL, lbl) + 4, x0 = Math.round(x - w / 2);
  ctx.fillStyle = '#17151a'; ctx.fillRect(x0 - 1, y - 1, w + 2, 9);
  ctx.fillStyle = isOwned ? '#45b964' : price !== it.price ? '#ff8a80' : '#f0d048'; ctx.fillRect(x0, y, w, 7);
  ctxText(ctx, SMALL, lbl, x0 + 2, y + 1, isOwned ? '#ffffff' : '#3a2a10');
}
// Gul hänglapp (grön = din) som hänger i ett snöre från plagget som säljs
function hangTag(ctx, x, y, isOwned, blink) {
  ctx.fillStyle = '#3a3440'; ctx.fillRect(x - 1, y - 1, 1, 1); ctx.fillRect(x, y, 1, 1); ctx.fillRect(x + 1, y + 1, 1, 1);
  ctx.fillStyle = blink ? '#ffffff' : '#17151a'; ctx.fillRect(x + 1, y + 2, 6, 7);
  ctx.fillStyle = isOwned ? '#45b964' : '#f0d048'; ctx.fillRect(x + 2, y + 3, 4, 5);
  ctx.fillStyle = isOwned ? '#8fe0a2' : '#fff2a0'; ctx.fillRect(x + 2, y + 3, 4, 1);
  ctx.fillStyle = isOwned ? '#2f8f46' : '#c9982a'; ctx.fillRect(x + 2, y + 7, 4, 1);
  ctx.fillStyle = '#17151a'; ctx.fillRect(x + 3, y + 4, 1, 1);
}
// Glitter vid plagget på mannekängen man står vid
function sparkle(ctx, d, t) {
  const k = d.it.slot, y = k === 'hat' ? d.y - 40 : k === 'bottom' ? d.y - 10 : d.y - 22;
  const ph = Math.floor(t * 5) % 4;
  const x = d.x - 10;
  ctx.fillStyle = '#fff6b0';
  ctx.fillRect(x, y - 1 - (ph === 1 ? 1 : 0), 1, 3 + (ph === 1 ? 2 : 0));
  ctx.fillRect(x - 1 - (ph === 1 ? 1 : 0), y, 3 + (ph === 1 ? 2 : 0), 1);
  ctx.fillStyle = '#ffffff'; ctx.fillRect(x, y, 1, 1);
  if (ph >= 2) { ctx.fillStyle = '#fff6b0'; ctx.fillRect(x + 1, y - 6, 1, 1); ctx.fillRect(x + 1, y - 4, 1, 1); ctx.fillRect(x, y - 5, 1, 1); ctx.fillRect(x + 2, y - 5, 1, 1); }
}
// Pulserande ram längs trappans fot när man står vid den
function stairGlow(ctx, e) {
  const x = e.lx - e.sx * 14, y = e.ly - 8;
  ctx.fillStyle = 'rgba(255,230,128,.35)';
  ctx.fillRect(Math.min(x, x + e.sx * 30), y, 30, 12);
}
// Skylt i skärmkanten mot det man inte ser just nu
function edgeSign(ctx, lbl, col, left, bottom = H) {
  const tw = textW(SMALL, lbl), w = tw + 13, x0 = left ? 3 : VW - w - 3, y0 = bottom - 14;
  ctx.fillStyle = col; ctx.fillRect(x0 - 1, y0 - 1, w + 2, 11);
  ctx.fillStyle = '#17151a'; ctx.fillRect(x0, y0, w, 9);
  ctxText(ctx, SMALL, lbl, left ? x0 + 9 : x0 + 3, y0 + 2, col);
  ctx.fillStyle = col;
  for (let i = 0; i < 3; i++) ctx.fillRect(left ? x0 + 3 + i : x0 + w - 4 - i, y0 + 4 - i, 1, 1 + 2 * i);
}
// Affischen till vänster om dörren: två figurer i höstens outfits
function drawPoster(ctx) {
  const fx = D.MID0 + 14;
  ctx.save();
  ctx.beginPath(); ctx.rect(fx, 33, 44, 29); ctx.clip();
  drawPerson(ctx, fx + 12, 70, POSTER[0], 'down', 0);
  drawPerson(ctx, fx + 32, 70, POSTER[1], 'down', 0);
  ctx.restore();
  const ny = 'NYTT!', nw = textW(SMALL, ny) + 6, x0 = fx + 50 - nw;
  ctx.fillStyle = '#17151a'; ctx.fillRect(x0 - 1, 57, nw + 2, 10);
  ctx.fillStyle = '#d9433b'; ctx.fillRect(x0, 58, nw, 8);
  ctx.fillStyle = '#ff7a6b'; ctx.fillRect(x0, 58, nw, 1);
  ctxText(ctx, SMALL, ny, x0 + 3, 60, '#ffffff');
}
function drawRea(ctx, t) {
  const on = Math.floor(t * 2) % 2 === 0;
  const lbl = 'REA -25%';
  const w = textW(BIG, lbl) + 10, x0 = (D.DESK.x + D.DESK.w / 2) - w / 2 | 0, y0 = 42;
  ctx.fillStyle = '#17151a'; ctx.fillRect(x0 - 1, y0 - 1, w + 2, 13);
  ctx.fillStyle = on ? '#d9433b' : '#b8323a'; ctx.fillRect(x0, y0, w, 11);
  ctxText(ctx, BIG, lbl, x0 + 5, y0 + 2, '#ffffff');
}
// Visselpipan i snöre runt tränarens hals
function whistle(ctx, x, y) {
  ctx.fillStyle = '#e8e8ee'; ctx.fillRect(x - 1, y - 20, 1, 3); ctx.fillRect(x + 1, y - 20, 1, 3);
  ctx.fillStyle = '#c9ccd6'; ctx.fillRect(x - 1, y - 17, 3, 2); ctx.fillStyle = '#6d717c'; ctx.fillRect(x + 1, y - 16, 1, 1);
}
function drawBall(ctx, b, hi, t) {
  const x = Math.round(b.x), y = Math.round(b.y), z = Math.round(b.z);
  ctx.fillStyle = 'rgba(20,12,30,.3)'; ctx.fillRect(x - 2, y + 1, 5, 1);
  if (hi && b.st === 'rest' && Math.floor(t * 3) % 2 === 0) { ctx.fillStyle = '#ffe070'; ctx.fillRect(x - 4, y - 7 - z, 9, 9); }
  const rows = ['.www.', 'wkwkw', 'wwkww', 'wkwkw', '.www.'];
  const roll = b.st !== 'rest' ? Math.floor(t * 12) % 2 : 0;
  rows.forEach((r, j) => { for (let i = 0; i < 5; i++) { const c = r[roll ? 4 - i : i]; if (c === '.') continue; ctx.fillStyle = c === 'k' ? '#26242c' : '#f4f1ea'; ctx.fillRect(x - 2 + i, y - 5 - z + j, 1, 1); } });
  ctx.fillStyle = '#1d1822'; ctx.fillRect(x - 1, y - 6 - z, 3, 1); ctx.fillRect(x - 1, y - z, 3, 1); ctx.fillRect(x - 3, y - 4 - z, 1, 3); ctx.fillRect(x + 3, y - 4 - z, 1, 3);
}

// Glasögon i dubbel storlek på ett eget ställ: f båge, l glas, w glans, d mörkt glas, s blänk
const GLASS = {
  round: ['..fff...fff..', '.fwllf.fwllf.', 'fflllffflllff', '.flllf.flllf.', '..fff...fff..'],
  square: ['.fffff.fffff.', '.fwllf.fwllf.', 'fflllffflllff', '.flllf.flllf.', '.fffff.fffff.'],
  sun: ['fffffffffffff', 'fsddddfsddddf', '.ddddd.ddddd.', '..ddd...ddd..'],
};
const GLASS_FRAME = { round: '#7a4520', square: '#1f1f26', sun: '#1f1f26' };
function drawGlassesStand(ctx, x, base, v) {
  ctx.fillStyle = '#5a5058'; ctx.fillRect(x - 5, base - 2, 11, 2);
  ctx.fillStyle = '#a8a0aa'; ctx.fillRect(x - 4, base - 2, 9, 1);
  ctx.fillStyle = '#c9ccd6'; ctx.fillRect(x, base - 14, 1, 12);
  ctx.fillStyle = '#8a8e9a'; ctx.fillRect(x + 1, base - 14, 1, 12);
  ctx.fillStyle = '#c9ccd6'; ctx.fillRect(x - 1, base - 15, 4, 1);
  const map = GLASS[v] || GLASS.square;
  const pal = { f: GLASS_FRAME[v] || '#1f1f26', l: '#d8eef8', w: '#ffffff', d: '#16161c', s: '#8fa0b8' };
  const x0 = x - 6, y0 = base - 20;
  map.forEach((row, j) => { for (let i = 0; i < row.length; i++) { const ch = row[i]; if (ch === '.') continue; ctx.fillStyle = pal[ch]; ctx.fillRect(x0 + i, y0 + j, 1, 1); } });
}
// Byst (huvud + axlar) på en liten fot – för hattar och hörlurar
function drawBust(ctx, x, base, look) {
  ctx.fillStyle = '#5a5058'; ctx.fillRect(x - 5, base - 2, 11, 2);
  ctx.fillStyle = '#8e8690'; ctx.fillRect(x - 4, base - 2, 9, 1);
  ctx.fillStyle = '#a8a0aa'; ctx.fillRect(x - 1, base - 5, 3, 3);
  ctx.fillStyle = '#6d6570'; ctx.fillRect(x + 1, base - 5, 1, 3);
  ctx.save();
  ctx.beginPath(); ctx.rect(x - 12, base - 26, 24, 21); ctx.clip();
  drawPerson(ctx, x, base - 26 + 39, look, 'down', 0);
  ctx.restore();
  ctx.fillStyle = '#4a4250'; ctx.fillRect(x - 6, base - 5, 13, 1);
}
// Väskor (pixelkartor): o kontur, h ljus, b bas, l skugga, d mörk, m metall, s rem
const BAGS = {
  backpack: ['....oooo....', '...o.dd.o...', '.oooooooooo.', 'ohhhhhhhhhbo', 'ohbbbbbbbblo', 'ohbbbbmbbblo', 'ohbbbbbbbblo', 'ohbddddddblo', 'ohdlllllldlo', 'ohdllmllldlo', 'ohdlllllldlo', 'ohbddddddblo', 'olllllllllll', '.oooooooooo.'],
  shoulder: ['...ssssss...', '..s......s..', '.s........s.', '.s........s.', 'oooooooooooo', 'ohhhhhhhhhbo', 'ohbbbbbbbblo', 'odddddmddddo', 'ohbbbbbbbblo', 'ohbbbbbbbblo', 'ollllllllllo', '.oooooooooo.'],
};
function drawBag(ctx, x, base, v, color) {
  const c = hex(color, 0x3a7bd5);
  const pal = { o: '#1d1822', h: css(mix(mul(c, 1.15), 0xfff4e0, 0.18)), b: css(c), l: css(mix(mul(c, 0.74), 0x2a1f3a, 0.12)), d: css(mix(mul(c, 0.5), 0x1a1426, 0.2)), m: '#e8d890', s: css(mix(mul(c, 0.55), 0x1a1426, 0.2)) };
  const map = BAGS[v] || BAGS.backpack;
  const x0 = Math.round(x - map[0].length / 2), y0 = base - map.length;
  ctx.fillStyle = 'rgba(20,12,30,.25)'; ctx.fillRect(x0 + 1, base - 1, map[0].length - 1, 1);
  map.forEach((row, j) => { for (let i = 0; i < row.length; i++) { const ch = row[i]; if (ch === '.') continue; ctx.fillStyle = pal[ch]; ctx.fillRect(x0 + i, y0 + j, 1, 1); } });
}
