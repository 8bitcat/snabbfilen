// KLÄDER – butikens data: mått för de tre våningarna, avdelningarna, klädställningarnas
// kategorier ur klädkatalogen (js/data/wardrobe.js), skyltdockorna, Kungsladugårds lag
// och de kända lagens matchställ. Ingen ritning här – bara siffror och listor.
import { WARDROBE, itemById, itemsForSlot, legacyKeyToId, groupOf } from '../../data/wardrobe.js';

export const H = 216, WALL_Y = 70;

// ================= plan 1: MODE (tjejer · mitten · killar) =================
export const W1 = 1280;
export const MID0 = 448, MID1 = 832;            // mitthallen (dörr, kassa, accessoarer, trappan)
export const DOOR = { x0: 520, x1: 552 };
export const DESK = { x: 556, y: 78, w: 64, h: 30 };     // kassadisken
export const GOND = { x: 476, y: 116, w: 120, h: 72 };   // accessoarhyllan (fristående)
export const HATS = { x: 648, y: 110, w: 116, h: 82 };   // hatthyllan framför trappan
export const PLANTS1 = [[458, 92], [456, 206], [620, 206], [806, 206]];
export const ROW_Y = [104, 166];                  // skyltdockornas fötter, bakre/främre raden
export const COLS = [36, 90, 144, 198, 252];      // tjejavdelningen – killarnas speglas (W1 − x)
export const MOD_X = [120, 200, 280, 360];        // väggmodulernas vänsterkant (tjejer; killarna speglas)
export const MOD_W = 76;
export const RACK_SLOTS = [[292, 120], [368, 120], [292, 184], [368, 184]]; // fristående ställningar [x0, fot-y]
export const RACK_W = 72;

// Trappan upp: foten vid (lx, ly), stiger åt höger och försvinner genom taket (klipps vid clip).
// FLAT = det plana första steget, STEP/RISE = stegets längd/höjd i pixlar.
export const STAIR = { FLAT: 8, STEP: 5, RISE: 3 };
export const STAIRS1 = { n: 1, to: 2, lx: 660, ly: 100, sx: 1, sy: -1, run: 122, clip: 44, top: 108, slab: [684, 827] };
// Plan 2: trappan kommer upp ur ett schakt i golvet; man kliver av åt höger vid avsatsen.
export const STAIRS2 = { n: 2, to: 1, lx: 780, ly: 112, sx: -1, sy: 1, run: 122, clip: 126, top: 108, pit: [676, 772, 96, 126] };
// Plan 2 → plan 3 (julvåningen): en egen trapphall längst till höger på plan 2 (x 1280–1440)
// med trappan upp, och schaktet längst till höger på plan 3 där den kommer upp
export const STAIRS2UP = { n: 2, to: 3, lx: 1300, ly: 100, sx: 1, sy: -1, run: 122, clip: 44, top: 108, slab: [1324, 1428], sign: 'jul' };
export const STAIRS3 = { n: 3, to: 2, lx: 1164, ly: 112, sx: -1, sy: 1, run: 122, clip: 126, top: 108, pit: [1060, 1156, 96, 126] };
// trapporna parvis: den man går upp/ner i på en våning ↔ den man kommer ut ur på den andra
export const STAIR_PAIRS = [[STAIRS1, STAIRS2], [STAIRS2UP, STAIRS3]];
export const stairPair = (e) => { for (const [a, b] of STAIR_PAIRS) { if (a === e) return b; if (b === e) return a; } return null; };

// ================= plan 2: SPORT & FOTBOLL =================
export const W2 = 1440;                          // (1280–1440 = trapphallen upp till julvåningen)
export const JULHALL_X0 = 1280;
export const KUNGS_X1 = 560, LAG_X0 = 840;       // Kungsladugård | trapphallen | kända lag
export const PHOTO = { x: 16, y: 6, w: 118, h: 51 };      // lagfotot (ram inräknad)
export const SHOEWALL = { x: 432, w: 120 };               // fotbollsskorna på väggen
export const KIT_DOLL = { x: 420, y: 166 };               // matchstället utan namn (säljs)
export const PITCH = { x0: 568, x1: 650, y0: 138, y1: 206 }; // lilla provplanen med målet
export const GOAL = { x: 609, y: 150 };                    // målets mitt vid stolparnas fot (mynningen mot betraktaren)
export const BALL0 = [609, 184];
export const COACH = { x: 662, y: 150 };
export const PLANTS2 = [[548, 206], [836, 206]];
export const SPORT_MOD_X = [1116, 1196];                  // sportens väggmoduler
export const SPORT_RACK = [1186, 184];                    // fotbollströjorna på en ställning

// ================= avdelningarna =================
export const DEPT = {
  tjej: { name: 'TJEJER', neon: 0xff8fd0, glow: 0xff4fb0, board: 0x2b1631, trim: 0xf28bb3, lbl: '#ff8fd0', tag: '#f28bb3', stage: ['#fbe3ef', '#f0c4d9', '#d98fb4'], title: 'Tjejavdelningen' },
  kille: { name: 'KILLAR', neon: 0x7fe0ff, glow: 0x2f9fe0, board: 0x0f1a2e, trim: 0x3fc4ff, lbl: '#7fe0ff', tag: '#3a7bd5', stage: ['#e0ebf8', '#c4d6ee', '#7f9cc4'], title: 'Killavdelningen' },
  mid: { name: '', neon: 0xf0d048, glow: 0xe8b230, board: 0x17151a, trim: 0xe8b230, lbl: '#f0d048', tag: '#e8b230', stage: ['#f3ecdf', '#e6dcc8', '#b99a70'], title: 'Accessoarerna' },
  kungs: { name: 'KUNGSLADUGÅRD', neon: 0xffd0d8, glow: 0xd9434b, board: 0x3a0d16, trim: 0xd9434b, lbl: '#ff9aa6', tag: '#d9434b', stage: ['#f6e3e6', '#e8c4ca', '#a3485a'], title: 'Kungsladugård' },
  lag: { name: 'KÄNDA LAG', neon: 0xb8f07a, glow: 0x46a35a, board: 0x10261a, trim: 0x6fd08a, lbl: '#9fe88a', tag: '#46a35a', stage: ['#e4f2e2', '#c4e0c2', '#5f9a64'], title: 'Kända lag' },
  jul: { name: 'JUL', neon: 0xfff0b0, glow: 0xd9433b, board: 0x173a24, trim: 0xd9433b, lbl: '#ffd23f', tag: '#c9323a', stage: ['#f3ecdf', '#e6dcc8', '#7a2a2e'], title: 'Julavdelningen' },
  sport: { name: 'SPORT', neon: 0xffd23f, glow: 0xe07a2e, board: 0x1a1a24, trim: 0xf0b429, lbl: '#ffd23f', tag: '#e07a2e', stage: ['#f3ecdf', '#e6dcc8', '#b99a70'], title: 'Sportavdelningen' },
};

// ================= klädställningarnas kategorier =================
// groups = katalogens underrubriker (groupOf) för platsen, ids = plagg som alltid ska med.
// Varje avdelning visar sina egna plagg först och sedan unisex. Sport och mjukis finns på plan 2.
const JUL_TOPS = ['top-college-xmas', 'top-santa', 'top-lucia'];   // julvåningens tröjvägg
const C = (id, dept, sign, name, slot, groups, extra = {}) => ({ id, dept, sign, name, slot, groups, ...extra });
export const CATS = [
  // tjejer: fyra väggmoduler + fyra fristående ställningar
  C('tjToppar', 'tjej', 'T-SHIRTS + TOPPAR', 'T-shirts & toppar', 'top', ['T-shirts & linnen', 'Toppar'], { icon: '👚' }),
  C('tjTryck', 'tjej', 'TRYCKTA TRÖJOR', 'Tryckta t-shirts', 'top', ['Tryckta t-shirts'], { icon: '⭐' }),
  C('tjTrojor', 'tjej', 'BLUSAR + TRÖJOR', 'Blusar, västar & tröjor', 'top', ['Skjortor', 'Västar', 'Tröjor'], { icon: '🧶' }),
  C('tjJackor', 'tjej', 'JACKOR + KAPPOR', 'Jackor & kappor', 'top', ['Jackor & kavajer', 'Rockar & kappor'], { icon: '🧥' }),
  C('tjByxor', 'tjej', 'BYXOR + SHORTS', 'Byxor & shorts', 'bottom', ['Långbyxor', 'Shorts'], { icon: '👖' }),
  C('tjKjolar', 'tjej', 'KJOLAR', 'Kjolar', 'bottom', ['Kjolar'], { icon: '👗' }),
  C('tjKlanning', 'tjej', 'KLÄNNINGAR', 'Klänningar & overaller', 'bottom', ['Klänningar', 'Overaller & hängsel'], { icon: '👗' }),
  C('tjFest', 'tjej', 'FEST + MASKERAD', 'Fest, maskerad & uniformer', 'top', ['Fest & maskerad', 'Uniformer & yrken'], { icon: '🎉' }),
  // killar
  C('kiTshirt', 'kille', 'T-SHIRTS', 'T-shirts & tryck', 'top', ['T-shirts & linnen', 'Toppar', 'Tryckta t-shirts'], { icon: '👕' }),
  C('kiSkjortor', 'kille', 'SKJORTOR + VÄSTAR', 'Skjortor & västar', 'top', ['Skjortor', 'Västar'], { icon: '👔' }),
  C('kiTrojor', 'kille', 'TRÖJOR', 'Tröjor', 'top', ['Tröjor'], { icon: '🧶' }),
  C('kiJackor', 'kille', 'JACKOR + ROCKAR', 'Jackor & rockar', 'top', ['Jackor & kavajer', 'Rockar & kappor'], { icon: '🧥' }),
  C('kiByxor', 'kille', 'BYXOR', 'Byxor', 'bottom', ['Långbyxor'], { icon: '👖' }),
  C('kiShorts', 'kille', 'SHORTS + KILTAR', 'Shorts & kiltar', 'bottom', ['Shorts', 'Kjolar'], { icon: '🩳' }),
  C('kiOveraller', 'kille', 'OVERALLER', 'Overaller & hängsel', 'bottom', ['Overaller & hängsel', 'Klänningar'], { icon: '🔧' }),
  C('kiFest', 'kille', 'FEST + MASKERAD', 'Fest, maskerad & uniformer', 'top', ['Fest & maskerad', 'Uniformer & yrken'], { icon: '🦸' }),
  // plan 2: sport (alla avdelningar)
  C('spTrojor', 'sport', 'SPORTTRÖJOR', 'Sporttröjor', 'top', ['Sport'], { icon: '🏅', all: true }),
  C('spMjukis', 'sport', 'MJUKIS + TRÄNING', 'Mjukis & träning', 'bottom', ['Mjukis & träning'], { icon: '🏃', all: true, ids: ['bottom-sportShorts', 'bottom-bikeShorts'] }),
  // plan 3: julkläderna (de finns också i fest- och tröjställningarna på plan 1)
  C('julKlader', 'jul', 'JULKLÄDER', 'Julkläder', 'top', [], { icon: '🎄', all: true, match: (it) => JUL_TOPS.includes(it.id) }),
  C('spFotboll', 'sport', 'FOTBOLLSTRÖJOR', 'Fotbollströjor', 'top', [], { icon: '⚽', all: true, match: (it) => it.look.top === 'football' }),
];
export const catById = (id) => CATS.find((c) => c.id === id) || null;
// Var kategorierna står: [katId, 'wall'|'rack', index] per avdelning (väggmodul 0–3 räknat
// från provhytten, ställningsplats 0–3 i RACK_SLOTS)
export const PLACES = {
  tjej: [['tjToppar', 'wall', 0], ['tjTryck', 'wall', 1], ['tjTrojor', 'wall', 2], ['tjJackor', 'wall', 3],
    ['tjByxor', 'rack', 0], ['tjKjolar', 'rack', 1], ['tjKlanning', 'rack', 2], ['tjFest', 'rack', 3]],
  kille: [['kiTshirt', 'wall', 0], ['kiSkjortor', 'wall', 1], ['kiTrojor', 'wall', 2], ['kiJackor', 'wall', 3],
    ['kiByxor', 'rack', 0], ['kiShorts', 'rack', 1], ['kiOveraller', 'rack', 2], ['kiFest', 'rack', 3]],
};

// Plaggen i en kategori (säljbara = inte gratis basplagg). Egna avdelningens först, sedan unisex.
const SPORT_GROUPS = { top: ['Sport'], bottom: ['Mjukis & träning'] };
const catCache = new Map();
export function catItems(cat) {
  const c = typeof cat === 'string' ? catById(cat) : cat;
  if (!c) return [];
  if (catCache.has(c.id)) return catCache.get(c.id);
  const inGroup = (it) => (c.match ? c.match(it) : c.groups.includes(groupOf(it))) || (c.ids || []).includes(it.id);
  const pool = itemsForSlot(c.slot).filter((it) => !it.free && inGroup(it));
  let out;
  if (c.all) out = pool;
  else {
    const own = pool.filter((it) => it.dept === c.dept && !(SPORT_GROUPS[c.slot] || []).includes(groupOf(it)));
    const uni = pool.filter((it) => it.dept === 'unisex' && !(SPORT_GROUPS[c.slot] || []).includes(groupOf(it)));
    out = [...own, ...uni];
  }
  catCache.set(c.id, out);
  return out;
}
// Alla säljbara över- och underdelar (för kontrollen att inget plagg saknar plats i butiken)
export const SELLABLE = WARDROBE.filter((it) => (it.slot === 'top' || it.slot === 'bottom') && !it.free);

// ================= skyltdockorna på plan 1 (hela outfits; plagget som säljs = nyckeln) =================
const MANNE = { skin: '#ece6ee', style: 'bald', hair: '#ecd489', beard: false, glasses: false, phones: false, bag: null, blush: false, hat: null, top: 'tee', shirt: '#f4f1ea', accent: '#f4f1ea', bottom: 'jeans', pants: '#3f5f8f', shoes: '#1c1c1c', cap: '#d9433b' };
export const girl = (o) => ({ ...MANNE, build: 4, blush: true, ...o });
export const boy = (o) => ({ ...MANNE, build: 5, ...o });
// [gammal nyckel eller katalog-id, kolumn (0 = längst från mitten för tjejer, närmast mitten för killar), rad,
//  outfit, kortnamn på lappen (högst ~11 tecken)]. Plagget som säljs har en stark färg som skiljer sig
// från håret/resten av dockan. Huvtröjan står kvar (röktestet går fram till den).
export const GIRLS = [
  ['bottom-princess', 0, 0, girl({ style: 'long', hair: '#3b2619', bottom: 'princess', shirt: '#f28bb3', pants2: '#f0b429', hat: 'crown', cap: '#f0b429', shoes: '#f2f2f2' }), 'PRINSESS'],
  ['top-offShoulder-flowers', 1, 0, girl({ style: 'wavy', hair: '#b7392b', top: 'offShoulder', topPrint: 'flowers', shirt: '#f4f1ea', print2: '#e0607a', bottom: 'skirt', pants: '#3a7bd5' }), 'BLOMTOPP'],
  ['bottom-sundress-flowers', 2, 0, girl({ style: 'bun', hair: '#1d1714', bottom: 'sundress', bottomPrint: 'flowers', shirt: '#8fc4e8', pants2: '#f4f1ea', shoes: '#f2f2f2' }), 'SOLKLÄNNING'],
  ['top-bomber-flowers', 3, 0, girl({ style: 'ponytail', hair: '#d9a95c', top: 'bomber', topPrint: 'flowers', shirt: '#2f3440', accent: '#f07aa8', print2: '#f07aa8', bottom: 'jeansHigh', pants: '#6a8fc4' }), 'BOMBER'],
  ['top:hoodie', 4, 0, girl({ style: 'long', hair: '#3b2619', top: 'hoodie', shirt: '#f28bb3', bottom: 'jeans', pants: '#3f5f8f', shoes: '#f2f2f2' })],
  ['top-cardigan', 0, 1, girl({ style: 'bob', hair: '#1d1714', top: 'cardigan', shirt: '#b89ad0', accent: '#f4f1ea', bottom: 'pleated', pants: '#2d3a5c' }), 'KOFTA'],
  ['bottom-tutu-rainbow', 1, 1, girl({ style: 'pigtails', hair: '#1d1714', top: 'tee', shirt: '#f4f1ea', accent: '#ff5fa8', bottom: 'tutu', bottomPrint: 'rainbow', pants: '#f4f1ea', hat: 'bow', cap: '#ff5fa8', shoes: '#f2f2f2' }), 'TUTU'],
  ['top-denim', 2, 1, girl({ style: 'long', hair: '#ecd489', top: 'denim', shirt: '#4a6fa5', accent: '#f4f1ea', bottom: 'leggings', pants: '#2b2b30' }), 'JEANSJACKA'],
  ['bottom-jumpsuit', 3, 1, girl({ style: 'braids', hair: '#6b4226', bottom: 'jumpsuit', shirt: '#e07a2e', shoes: '#f2f2f2' }), 'JUMPSUIT'],
  ['top-kimono-flowers', 4, 1, girl({ style: 'space', hair: '#c65fa0', top: 'kimono', topPrint: 'flowers', shirt: '#2f3440', accent: '#f07aa8', print2: '#f07aa8', bottom: 'wide', pants: '#e8e3d6' }), 'KIMONO'],
];
export const BOYS = [
  ['top:hoodie', 0, 0, boy({ style: 'fade', hair: '#1d1714', top: 'hoodie', shirt: '#46a35a', bottom: 'pants', pants: '#2b2b30', shoes: '#f2f2f2' })],
  ['top-varsity', 1, 0, boy({ style: 'short', hair: '#3b2619', top: 'varsity', shirt: '#7a2e3e', accent: '#f4f1ea', bottom: 'jeans', pants: '#2d3a5c', hat: 'cap', cap: '#f4f1ea', shoes: '#f2f2f2' }), 'COLLEGE'],
  ['top:hawaii', 2, 0, boy({ style: 'curtains', hair: '#d9a95c', top: 'hawaii', shirt: '#2aa39a', accent: '#f0b429', bottom: 'shorts', pants: '#e8e3d6', glasses: 'sun', shoes: '#6b3e1e', build: 6 })],
  ['top-flannel', 3, 0, boy({ style: 'messy', hair: '#6b4226', top: 'flannel', shirt: '#c9323a', accent: '#26242c', bottom: 'jeansRipped', pants: '#4f79ad', shoes: '#6b3e1e' }), 'FLANELL'],
  ['top-leather', 4, 0, boy({ style: 'spiky', hair: '#1d1714', top: 'leather', shirt: '#26242c', accent: '#f4f1ea', bottom: 'jeansBaggy', pants: '#35507a', glasses: 'sun' }), 'SKINNJACKA'],
  ['bottom-cargoShorts-camo', 0, 1, boy({ style: 'buzz', hair: '#3b2619', top: 'tee', shirt: '#f0b429', accent: '#3a7bd5', bottom: 'cargoShorts', bottomPrint: 'camo', pants: '#6b7a4a', pants2: '#3f4a2c', shoes: '#f2f2f2' }), 'KAMOSHORTS'],
  ['top-tee-skull', 1, 1, boy({ style: 'mohawk', hair: '#1d1714', top: 'tee', topPrint: 'skull', shirt: '#26242c', print2: '#f4f1ea', bottom: 'chinos', pants: '#b8a47a', build: 6 }), 'SKALLE'],
  ['top-puffer', 2, 1, boy({ style: 'short', hair: '#a5692f', top: 'puffer', shirt: '#c9323a', bottom: 'cargo', pants: '#6b6a4a', hat: 'beanie', cap: '#f0b429' }), 'DUNJACKA'],
  ['top:suit', 3, 1, boy({ style: 'side', hair: '#1d1714', top: 'suit', shirt: '#2d3a5c', accent: '#d9433b', bottom: 'pants', pants: '#2d3a5c', shoes: '#6b3e1e' })],
  ['top-tuxedo', 4, 1, boy({ style: 'side', hair: '#3b2619', top: 'tuxedo', shirt: '#1f1f26', accent: '#26242c', bottom: 'suitPants', pants: '#1f1f26', hat: 'tophat', cap: '#1d1d22' }), 'SMOKING'],
];
// nyckel ('kind:v' eller katalog-id) → katalogpost
export const itemOf = (k) => itemById(k) || itemById(legacyKeyToId(k)) || null;

// Hattarna på hatthyllan (byster) och accessoarhyllan i mitten
const BUST = { ...MANNE, skin: '#e9e2ea', top: 'tee', shirt: '#d9d0c8', accent: '#d9d0c8', build: 5 };
export const bust = (o) => ({ ...BUST, ...o });
export const HAT_BUSTS = [
  ['hat:cap', bust({ style: 'short', hair: '#3b2619', hat: 'cap', cap: '#3a7bd5' })],
  ['hat:bucket', bust({ style: 'short', hair: '#1d1714', hat: 'bucket', cap: '#f0b429' })],
  ['hat:beanie', bust({ style: 'long', hair: '#b7392b', hat: 'beanie', cap: '#2aa39a', blush: true, build: 4 })],
  ['hat:headband', bust({ style: 'bob', hair: '#ecd489', hat: 'headband', cap: '#8e5bd1', blush: true, build: 4 })],
  ['hat:bow', bust({ style: 'long', hair: '#1d1714', hat: 'bow', cap: '#ff5fa8', blush: true, build: 4 })],
  ['hat:tophat', bust({ style: 'short', hair: '#ecd489', hat: 'tophat', cap: '#1d1d22', accent: '#d9433b' })],
  ['hat:crown', bust({ style: 'wavy', hair: '#1d1714', hat: 'crown', cap: '#f0b429', blush: true, build: 4 })],
];

// ================= KUNGSLADUGÅRD (Carls data – bara förnamn i spelet) =================
export const KUNGS_PLAYERS = [
  [3, 'Klara'], [5, 'Saga'], [6, 'Valencia'], [7, 'Alice'], [8, 'Nina'], [9, 'Alice'], [10, 'Märta'],
  [11, 'Isabelle'], [12, 'Elisa'], [13, 'Natalia'], [14, 'Kajsa'], [15, 'Moa'], [16, 'Isabella'],
  [17, 'Edessa'], [18, 'Julie'], [19, 'Ellen'], [20, 'Lily'], [23, 'Noomi'], [34, 'Julia'],
];
// Matchstället: vinröd tröja med ljusare röda ärmslut, svarta shorts, svarta strumpor med vita ränder
export const KUNGS_KIT = { shirt: '#7a1f2e', accent: '#d9434b', pants: '#1d1d22', pants2: '#1d1d22', socks: '#1d1d22', sockStripe: '#f4f1ea' };
// Fotbollsskorna ur lagfotot
export const CLEATS = [
  { id: 'neon', name: 'Neongula', shoes: '#e4f22e', shoes2: '#1d1d22' },
  { id: 'gulgron', name: 'Gulgröna', shoes: '#b6e03a', shoes2: '#2f7a2e' },
  { id: 'rosa', name: 'Rosa', shoes: '#ff6fb5', shoes2: '#f4f1ea' },
  { id: 'svart', name: 'Svarta', shoes: '#26242c', shoes2: '#f4f1ea' },
  { id: 'vit', name: 'Vita', shoes: '#f4f1ea', shoes2: '#d9434b' },
];
// Frisyrer/hårfärger till lagets skyltdockor (neutrala peruker – inga porträtt)
const K_HAIR = ['#3b2619', '#d9a95c', '#1d1714', '#6b4226', '#ecd489', '#a5692f', '#b7392b', '#3b2619', '#1d1714', '#d9a95c'];
// bakifrån ska nummer och namn synas – inga långa hår eller hästsvansar ner över ryggen
const K_STYLE = ['bun', 'bob', 'space', 'messyBun', 'pixie', 'crownBraid', 'afroPuff', 'curlyBob', 'bun', 'bobBangs'];
export const kungsLook = (i) => girl({ build: 5,
  style: K_STYLE[i % K_STYLE.length], hair: K_HAIR[(i * 3) % K_HAIR.length],
  top: 'football', shirt: KUNGS_KIT.shirt, accent: KUNGS_KIT.accent,
  bottom: 'sportShorts', pants: KUNGS_KIT.pants, pants2: KUNGS_KIT.pants2,
  shoeType: 'cleats', shoes: CLEATS[i % CLEATS.length].shoes, shoes2: CLEATS[i % CLEATS.length].shoes2,
});
// Skyltdockornas platser: bakre raden 10, främre 9 (förskjuten en halv plats)
export const KUNGS_POS = KUNGS_PLAYERS.map((_, i) => (i < 10 ? { x: 30 + i * 38, y: 104 } : { x: 49 + (i - 10) * 38, y: 166 }));

// ================= KÄNDA LAG (bara stadsnamn – inga märken, inga sponsorer) =================
// item = katalogplagget (tröjan), colors = lagets färger på tröjan, pants/socks = shorts och strumpor
const T = (city, item, shirt, accent, print2, pants, socks, extra = {}) => ({ city, item, colors: { shirt, accent, ...(print2 ? { print2 } : {}) }, pants, socks, ...extra });
export const TEAMS = [
  T('GÖTEBORG', 'top-football-stripes', '#f4f1ea', '#1f4fa0', '#1f4fa0', '#1f4fa0', '#1f4fa0'),
  T('MALMÖ', 'top-football', '#8ec8ef', '#f4f1ea', null, '#f4f1ea', '#8ec8ef'),
  T('STOCKHOLM', 'top-football', '#1d1d22', '#f0c93a', null, '#1d1d22', '#1d1d22'),
  T('GLASGOW', 'top-football-hoops', '#f4f1ea', '#1f8a4c', '#1f8a4c', '#f4f1ea', '#f4f1ea'),
  T('BARCELONA', 'top-football-stripes', '#1f3f8f', '#f0c93a', '#a3173a', '#1f3f8f', '#1f3f8f'),
  T('MADRID', 'top-football', '#f4f1ea', '#c9a23a', null, '#f4f1ea', '#f4f1ea'),
  T('LIVERPOOL', 'top-football', '#c8102e', '#f4f1ea', null, '#c8102e', '#c8102e'),
  T('NEAPEL', 'top-football', '#3d8fd6', '#f4f1ea', null, '#f4f1ea', '#3d8fd6'),
  T('MILANO', 'top-football-stripes', '#c8102e', '#1d1d22', '#1d1d22', '#f4f1ea', '#1d1d22'),
  T('TURIN', 'top-football-stripes', '#f4f1ea', '#1d1d22', '#1d1d22', '#f4f1ea', '#f4f1ea'),
  T('PARIS', 'top-football', '#1b2a4a', '#d9433b', null, '#1b2a4a', '#1b2a4a'),
  T('DORTMUND', 'top-football', '#f5d10a', '#1d1d22', null, '#1d1d22', '#f5d10a'),
];
const T_HAIR = ['#1d1714', '#3b2619', '#d9a95c', '#6b4226', '#ecd489', '#1d1714'];
const T_STYLE = ['short', 'fade', 'ponytail', 'buzz', 'bun', 'side'];
export const teamLook = (tm, i) => {
  const b = i % 2 ? girl : boy;
  return b({ style: T_STYLE[i % T_STYLE.length], hair: T_HAIR[i % T_HAIR.length], top: 'football', topPrint: itemById(tm.item)?.look.topPrint || 'none',
    ...tm.colors, bottom: 'sportShorts', pants: tm.pants, pants2: tm.pants, shoeType: 'cleats', shoes: '#26242c', shoes2: '#f4f1ea' });
};
export const TEAM_POS = TEAMS.map((_, i) => (i < 6 ? { x: 872 + i * 44, y: 104 } : { x: 894 + (i - 6) * 44, y: 166 }));

// ================= PLAN 3 · JULVÅNINGEN (Carl 2026-10-06) =================
// JULKLÄDER till vänster (dockor, tröjväggen, tomteluvorna), JULTORGET i mitten (brasan där
// man grillar marshmallows, den stora granen, kassan), JULPYNTET till höger (väggen med
// stjärnor och girlanger, borden med småsaker, granarna) och trappan längst till höger.
export const W3 = 1184;
export const JUL_X1 = 344, TORG_X1 = 760;              // julkläder | jultorget | julpyntet
export const JUL_MOD = { x: 24, w: 76 };               // tröjväggen (väggmodul)
export const JUL_HATS = { x: 112, y: 24, w: 64 };      // tomteluvorna på väggen (byster på en hylla)
export const JUL_WIN = [[196, 18, 58, 44], [478, 14, 84, 48], [1000, 18, 48, 44]]; // fönstren (snön faller)
// dockorna: [katalog-id, x, y, outfit, kortnamn]
const julDoll = (o) => ({ ...MANNE, build: 5, ...o });
export const JUL_DOLLS = [
  ['top-santa', 44, 104, julDoll({ style: 'short', hair: '#f4f1ea', top: 'santa', shirt: '#c9323a', bottom: 'pants', pants: '#c9323a', shoes: '#1c1c1c', hat: 'santa', cap: '#c9323a', beard: 'santa', build: 6 }), 'TOMTE'],
  ['bottom-lucia', 104, 104, julDoll({ style: 'long', hair: '#ecd489', top: 'lucia', shirt: '#f6f3ec', accent: '#c9323a', bottom: 'lucia', pants2: '#c9323a', shoes: '#f2f2f2', blush: true, build: 4 }), 'LUCIA'],
  ['top-college-xmas', 164, 104, julDoll({ style: 'messy', hair: '#6b4226', top: 'college', topPrint: 'xmas', shirt: '#c9323a', print2: '#f4f1ea', bottom: 'jeans', pants: '#2d3a5c' }), 'JULTRÖJA'],
  ['top-lucia', 74, 166, julDoll({ style: 'bun', hair: '#3b2619', top: 'lucia', shirt: '#f4f1ea', accent: '#2f8f46', bottom: 'skirt', pants: '#f4f1ea', shoes: '#f2f2f2', blush: true, build: 4 }), 'TÄRNA'],
  ['hat-santa', 134, 166, julDoll({ style: 'pigtails', hair: '#d9a95c', top: 'hoodie', shirt: '#2f8f46', bottom: 'jeans', pants: '#3f5f8f', hat: 'santa', cap: '#c9323a', blush: true, build: 4 }), 'TOMTELUVA'],
  ['top-college-xmas', 254, 166, julDoll({ style: 'fade', hair: '#1d1714', top: 'college', topPrint: 'xmas', shirt: '#2f8f46', print2: '#f4f1ea', bottom: 'chinos', pants: '#b8a47a', hat: 'santa', cap: '#2f8f46' }), 'GRÖN JULTRÖJA'],
];
// jultorget
export const JUL_BRASA = { x: 402, base: 84 };         // den julpyntade spisen (julspis1) vid väggen
export const JUL_BENCH = [[392, 118], [446, 118]];     // sittstockar framför brasan [x, fot-y]
export const JUL_LYKTOR = [[486, 92], [652, 92]];      // lyktstolparna på torget [x, fot-y]
export const JUL_KALKE = { x: 500, base: 200 };        // kälken med julklappar
export const JUL_GRAN = { x: 580, base: 168 };         // stora granen mitt på torget (mitten, foten)
export const JUL_DESK = { x: 672, y: 78, w: 64, h: 30 };
// julpyntet: väggsakerna [sort, variant, x, underkant-y] i två rader på ribbväggen, och
// golvsakerna [sort, variant, x, fot-y] – småsakerna på tre bord, granarna och spisen på golvet
export const PYNT_WALL = [
  ['adventsstjarna', 0, 776, 38], ['adventsstjarna', 1, 800, 38], ['adventsstjarna', 2, 824, 38],
  ['julkalender', 0, 850, 38], ['julstrumpa', 0, 878, 38], ['julklocka', 0, 900, 38],
  ['girlang', 0, 772, 60], ['ljusgirlang', 0, 806, 60], ['adventsljus', 0, 840, 60], ['adventsljus', 1, 872, 60],
];
export const PYNT_TABLES = [[772, 124, 80], [862, 124, 80], [952, 124, 58]];  // borden [x, fot-y, bredd]
export const PYNT_FLOOR = [
  // på borden (y = bordsskivan)
  ['julfigur', 0, 778, 108], ['polkagris', 0, 806, 108], ['julljus', 0, 830, 108],
  ['julsack', 0, 868, 108], ['snogubbe', 0, 894, 108], ['pepparkakshus', 0, 916, 108],
  ['julklapp', 0, 958, 108], ['minigran', 0, 986, 108],
  // på golvet
  ['julbock', 0, 778, 182], ['julgran', 1, 802, 190], ['kulgran', 0, 846, 190], ['ljusgran', 0, 890, 190], ['julspis', 0, 936, 190],
];
export const JUL_PLANTS = [[336, 206], [756, 206], [1036, 206]];
