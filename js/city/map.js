// Pixelstadens karta – KONTRAKTET som alla stadsmoduler delar (v2).
// Allt i världskoordinater, samma pixelkorn som resten av spelet
// (1 enhet = 1 spelpixel; en figur är ~24×40). Kameran visar 384×216.
// Fullständig beskrivning för modulförfattare: docs/STADEN.md.
//
// Världen är 2720 × 820. Den gamla stadskärnan (v1, x 0–1700, y 0–420)
// ligger kvar EXAKT där den låg – all befintlig konst passar. v2 lägger till
// djup söderut (SÖDER) och en förort österut (FÖRORTEN).
//
// Genomskärning uppifrån och ner (y) – gäller hela bredden:
//     8–36    bakgatan bakom den norra husraden (gåbar, syns i gränderna)
//    40–186   norra husraden: fasaderna står på y = BASE, taken sticker upp bakåt
//   186–218   norra trottoaren (dörrarna öppnas mot den)
//   218–276   PIXELGATAN: övre körfältet västerut, undre österut
//   276–306   södra trottoaren (busshållplatser)
//   306–462   parken (centrum) / parkering, lekplats, lamellhus, grusplan (förorten)
//   462–490   parkgången bakom den södra husraden (gåbar; taken syns härifrån)
//   494–640   södra husraden: fasaderna vänder sig söderut och står på y = BASE_S
//   640–672   trottoaren framför de södra husen (dörrarna öppnas mot den)
//   672–730   SÖDERGATAN: samma körfältsupplägg som Pixelgatan, DY_S = 454 px längre ner
//   730–760   bortre trottoaren (busshållplats, bänkar mot kanalen)
//   760–776   kajen (kantsten, räcke vid y 772 – längre söderut går man inte)
//   776–820   kanalen (vatten, is på vintern)
// Genomskärning i x:
//      0–1700  CENTRUM (norra raden), PARKEN och SÖDER (södra raden)
//   1700–1752  INFARTEN: en lodrät väg från bakgatan ner till Södergatan
//   1752–2720  FÖRORTEN: höghus, närbutik, pantbank, kebab, övergivet hus,
//              parkering, sliten lekplats, bilverkstad, tvätteri, garage …
// Den södra raden är ritad som en kopia av den norra, DY_S = 454 px längre
// ner: husbilden för ett södervänt hus är 190 px hög precis som en norrbild,
// och bildens rad r motsvarar världens y = r + DY_S (se artBox).

export const CITY = {
  W: 2720, H: 820,
  VIEW_W: 384, VIEW_H: 216,
  // --- norra halvan (v1, oförändrad; PARK växte söderut från [306, 420]) ---
  BACK: [8, 36],
  BASE: 186,
  SIDEWALK_N: [186, 218],
  ROAD: [218, 276],
  SIDEWALK_S: [276, 306],
  PARK: [306, 462],
  FOOT_TOP: 40,                // den norra husradens fotavtryck börjar här
  // --- v2 ---
  X_CITY: 1700,                // v1-stadens bredd: centrum, parken och söder ligger i x < 1700
  INFARTEN: [1700, 1752],      // den lodräta vägen mellan centrum och förorten
  X_SUB: 1752,                 // förorten börjar här
  DY_S: 454,                   // BASE_S − BASE = ROAD_S[0] − ROAD[0]
  BACK_S: [462, 490],          // parkgången bakom de södra husen
  FOOT_TOP_S: 494,             // den södra husradens fotavtryck börjar här
  BASE_S: 640,                 // de södra fasaderna står här
  SIDEWALK_SN: [640, 672],     // trottoaren framför de södra husen
  ROAD_S: [672, 730],          // Södergatan
  SIDEWALK_SS: [730, 760],     // bortre trottoaren
  QUAY: [760, 776],            // kajen (räcket står på y 772–774)
  CANAL: [776, 820],           // kanalen
  WALK_BOTTOM: 772,            // längst söderut man kan gå
};

// Husrader: allt som behövs för att rita/gå i en rad utan att bry sig om vilken.
export const ROWS = {
  n: { id: 'n', base: CITY.BASE, top: CITY.FOOT_TOP, back: CITY.BACK, sidewalk: CITY.SIDEWALK_N, road: 'pixelgatan' },
  s: { id: 's', base: CITY.BASE_S, top: CITY.FOOT_TOP_S, back: CITY.BACK_S, sidewalk: CITY.SIDEWALK_SN, road: 'sodergatan' },
};

// Körfälten: y = hjulens markkontakt. dir −1 = västerut (bilen vänd åt vänster).
export const LANES = [
  { dir: -1, y: 244 },
  { dir: 1, y: 271 },
];
// Södergatans körfält (samma som Pixelgatans, förskjutna DY_S).
export const LANES_S = LANES.map((l) => ({ dir: l.dir, y: l.y + CITY.DY_S }));
// Infartens körfält (lodräta): x = bilens mittlinje, dir +1 = söderut (högertrafik:
// söderut kör man på den västra halvan), −1 = norrut.
export const LANES_I = [
  { dir: 1, x: 1713 },
  { dir: -1, x: 1739 },
];

// ---------------------------------------------------------------------
// Husen. Alla hus (norra raden, södra raden, förorten, fristående) har samma fält:
//   id, kind      – kind väljer konsten i BUILDING_ART[kind] (samma som id)
//   x, w          – fotavtryckets västra kant och bredd
//   h             – fasadens höjd ovanför base (taket kommer utöver det)
//   base          – y där fasaden står på marken (dörren öppnas mot y > base)
//   top           – fotavtryckets norra kant (fotavtryck = [x, top, x+w, base−1])
//   foot          – (valfritt) eget fotavtryck [x0, y0, x1, y1] i stället för ovan
//   blocks        – (valfritt) fler hinder som hör till huset (pumpar, häckar …)
//   yard          – (valfritt) { kind: 'forecourt'|'garden', rect } – gåbar yta
//                   framför ett indraget hus; huskonsten/marken målar den
//   frontY        – (valfritt) y för husets främre lager: BUILDING_ART[kind].front()
//                   ritas som ett eget y-sorterat föremål (t.ex. mackens tak över pumparna)
//   door          – { x0, x1, type: 'swing'|'slide'|'open'|'roll'|'boarded' } i världs-x
//   row           – 'n' (norra raden), 's' (södra raden), 'f' (fristående)
//   face          – 'south': fasaden med dörren vetter söderut (mot kameran). Alla hus i v2.
//   district      – 'CENTRUM' | 'PARKEN' | 'SÖDER' | 'FÖRORTEN' (se DISTRICTS)
//   sign, icon    – namn på skylten och ikon i meddelanden
//   enter         – vad som händer när man går in:
//                     'hem'              spelarens bostad om hen bor här (homes), annars bostadsbyrån
//                     'bostad'           bostadsbyrån (v1)
//                     'mat' | 'klader' | 'mobler'   butikerna (v1)
//                     'burgare' | 'frukt' | 'flyg'  jobben (v1-namn)
//                     'jobb:<id>'        ett jobb i JOBS (game.js) – annars "Anställer snart!"
//                     'bostad:<homeId>'  ett bostadshus: hem om man bor där, annars bostadsbyrån
//                     null               "öppnar snart" (eller soon-texten)
//   homes         – (valfritt) vilka bostäder (HOMES-id) som ligger i huset
//   open          – [från, till] timmar då det är öppet (utelämnat = alltid)
//   soon          – egen text när enter är null (valfritt)
//   tower         – (kyrkan) { x0, x1, h } tornet reser sig h px över base
// ---------------------------------------------------------------------
const mk = (row, district, id, x, w, h, door, extra) => ({
  id, kind: id, x, w, h, door, row, face: 'south', district,
  base: ROWS[row].base, top: ROWS[row].top, enter: null, ...extra,
});
const B = (id, x, w, h, door, extra) => mk('n', 'CENTRUM', id, x, w, h, door, extra);
// Den norra raden i centrum (v1 – samma koordinater, samma enter).
export const BUILDINGS = [
  B('hem', 16, 120, 132, { x0: 64, x1: 88, type: 'swing' }, { sign: 'PIXELGATAN 1', icon: '🏠', enter: 'hem', homes: ['lagenhet', 'villa'] }),
  B('bostad', 164, 96, 100, { x0: 200, x1: 224, type: 'swing' }, { sign: 'BOSTADSBYRÅN', icon: '🔑', enter: 'bostad', open: [7, 20] }),
  B('mat', 312, 196, 104, { x0: 388, x1: 432, type: 'slide' }, { sign: 'STORMARKNAD', icon: '🛒', enter: 'mat', open: [7, 23] }),
  B('klader', 536, 124, 112, { x0: 586, x1: 610, type: 'swing' }, { sign: 'KLÄDER', icon: '👕', enter: 'klader', open: [7, 21] }),
  B('mobler', 688, 220, 116, { x0: 776, x1: 820, type: 'slide' }, { sign: 'MÖBELJÄTTEN', icon: '🛋️', enter: 'mobler', open: [7, 21] }),
  B('kafe', 960, 92, 92, { x0: 994, x1: 1018, type: 'swing' }, { sign: 'KAFÉ', icon: '☕', enter: 'kafe', open: [7, 21] }),
  B('burgare', 1080, 132, 100, { x0: 1134, x1: 1158, type: 'swing' }, { sign: 'BURGARBAREN', icon: '🍔', enter: 'burgare', open: [7, 23] }),
  B('frukt', 1264, 160, 118, { x0: 1330, x1: 1356, type: 'swing' }, { sign: 'FRUKTFABRIKEN', icon: '🍎', enter: 'frukt', open: [7, 21] }),
  B('flyg', 1452, 228, 124, { x0: 1544, x1: 1592, type: 'slide' }, { sign: 'FLYGPLATSEN', icon: '✈️', enter: 'flyg' }),
];

// Den södra raden (SÖDER): fasaderna med dörrarna vetter mot Södergatan,
// taken syns från parken. Gränder och gågator emellan leder från parkgången
// ner till trottoaren. Två hus är indragna (base < BASE_S) med gåbar gård framför.
const S = (id, x, w, h, door, extra) => mk('s', 'SÖDER', id, x, w, h, door, extra);
export const BUILDINGS_S = [
  S('radhus', 16, 132, 76, { x0: 74, x1: 90, type: 'swing' }, {
    sign: 'RADHUSEN', icon: '🏡', enter: 'bostad:radhus', homes: ['radhus'], base: 616,
    yard: { kind: 'garden', rect: [16, 616, 148, 640] },
    blocks: [[58, 618, 62, 638], [102, 618, 106, 638]], // häckarna mellan de tre trädgårdarna
  }),
  S('pizzeria', 172, 88, 100, { x0: 204, x1: 228, type: 'swing' }, { sign: 'PIZZERIA NAPOLI', icon: '🍕', enter: 'jobb:pizzeria', open: [11, 23] }),
  S('posten', 312, 92, 96, { x0: 346, x1: 370, type: 'swing' }, { sign: 'POSTEN', icon: '📮', enter: 'jobb:posten', open: [8, 18] }),
  S('djuraffar', 432, 180, 116, { x0: 508, x1: 536, type: 'swing' }, { sign: 'DJURAFFÄREN', icon: '🐾', enter: 'djur', open: [9, 19] }),
  S('bio', 640, 176, 120, { x0: 710, x1: 746, type: 'slide' }, { sign: 'BIO PIXEL', icon: '🎬', open: [12, 24], soon: 'Kvällens film börjar 19:00 – biljettluckan öppnar snart!' }),
  S('kyrka', 868, 132, 104, { x0: 922, x1: 946, type: 'swing' }, {
    sign: 'SÖDERKYRKAN', icon: '⛪', tower: { x0: 914, x1: 954, h: 212 },
    soon: 'Kyrkan är tyst och sval. Gudstjänst på söndag klockan 11.',
  }),
  S('leksaker', 1100, 112, 116, { x0: 1180, x1: 1204, type: 'swing' }, { sign: 'LEKSAKSLÅDAN', icon: '🧸', enter: 'leksaker', open: [9, 19] }), // leksaksaffären (js/city/buildings-leksaker.js + js/scenes/shop-leksaker.js)
  S('vardcentral', 1264, 156, 124, { x0: 1326, x1: 1358, type: 'slide' }, { sign: 'VÅRDCENTRALEN', icon: '🏥', enter: 'jobb:vard', open: [8, 17] }),
  S('tornhuset', 1448, 128, 172, { x0: 1500, x1: 1524, type: 'swing' }, { sign: 'TORNHUSET', icon: '🏙️', enter: 'bostad:takvaning', homes: ['takvaning'] }),
  S('bensinmack', 1600, 100, 64, { x0: 1636, x1: 1660, type: 'slide' }, {
    sign: 'PIXELMACKEN', icon: '⛽', enter: 'jobb:bensinmack', open: [6, 23], base: 596,
    yard: { kind: 'forecourt', rect: [1600, 596, 1700, 640] }, frontY: 640,
    blocks: [[1604, 616, 1618, 624], [1680, 616, 1694, 624]], // pumpöarna under taket
  }),
];

// Förorten (FÖRORTEN): en norra rad längs Pixelgatan och en södra rad längs
// Södergatan, samma geometri som i centrum. Här är allt slitet (district.worn = 1).
const XN = (id, x, w, h, door, extra) => mk('n', 'FÖRORTEN', id, x, w, h, door, extra);
const XS = (id, x, w, h, door, extra) => mk('s', 'FÖRORTEN', id, x, w, h, door, extra);
export const BUILDINGS_X = [
  XN('hoghus', 1768, 168, 168, { x0: 1840, x1: 1864, type: 'swing' }, { sign: 'BETONGVÄGEN 1', icon: '🏢', enter: 'bostad:hoghus', homes: ['rum', 'hoghus'] }), // Lilla rummet (startbostaden) ligger i förorten
  XN('narbutik', 1964, 108, 104, { x0: 2004, x1: 2028, type: 'swing' }, { sign: 'NÄRBUTIK 24/7', icon: '🏪', enter: 'narbutik' }),
  XN('pantbank', 2072, 76, 104, { x0: 2098, x1: 2122, type: 'swing' }, { sign: 'PANTBANKEN', icon: '💍', open: [10, 18], soon: 'Pantbanken: "Vi köper ditt guld!" – kom tillbaka när du har något att pantsätta.' }),
  XN('kebab', 2148, 88, 104, { x0: 2180, x1: 2204, type: 'swing' }, { sign: 'KEBAB GRILL', icon: '🥙', open: [11, 24], soon: 'Grillen är trasig. "ÖPPNAR SNART" står det på en lapp från i fjol.' }),
  XN('overgivet', 2288, 104, 96, { x0: 2328, x1: 2352, type: 'boarded' }, { sign: '', icon: '🏚️', soon: 'Igenspikat. Det luktar fukt och någon har sprejat ett hjärta på dörren.' }),
  XN('hoghus2', 2420, 184, 170, { x0: 2500, x1: 2524, type: 'swing' }, { sign: 'BETONGVÄGEN 5', icon: '🏢', soon: 'Kodlåset är sönderslaget – men du bor inte här.' }),
  XS('bilverkstad', 1768, 160, 88, { x0: 1792, x1: 1840, type: 'roll' }, { sign: 'BILVERKSTAN', icon: '🔧', enter: 'jobb:bilverkstad', open: [7, 18] }),
  XS('tvatteri', 1956, 100, 100, { x0: 1992, x1: 2016, type: 'swing' }, { sign: 'TVÄTTERI', icon: '🧺', enter: 'jobb:tvatteri', open: [8, 20] }),
  XS('garage', 2084, 152, 52, { x0: 2140, x1: 2176, type: 'roll' }, { sign: 'GARAGEN', icon: '🚗', soon: 'Garagelängan – någon skruvar på en moped där inne.' }),
  XS('lagerhall', 2408, 192, 92, { x0: 2488, x1: 2536, type: 'roll' }, { sign: 'LAGER 3', icon: '🏭', soon: 'Övergiven lagerhall. Någon har sprejat "PIXEL 4 EVER" på porten.' }),
];

// ---------------------------------------------------------------------
// Fristående hus – man går runt dem på alla sidor. d = fotavtryckets djup
// (fotavtryck = [x, base−d, x+w, base−1]). Dörren sitter på söderfasaden.
// ---------------------------------------------------------------------
const F = (district, id, x, w, base, d, h, door, extra) => ({
  id, kind: id, x, w, h, d, base, top: base - d, door, row: 'f', face: 'south', district, enter: null, ...extra,
});
export const FREESTANDING = [
  // parken
  F('PARKEN', 'kiosk', 392, 40, 452, 24, 34, { x0: 404, x1: 420, type: 'swing' }, { sign: 'GLASS', icon: '🍦', open: [10, 21], enter: 'glass' }), // glasståndet (props.js ritar det öppna ståndet på kioskens plats)
  F('PARKEN', 'toalett', 762, 36, 452, 24, 30, { x0: 772, x1: 786, type: 'swing' }, { sign: 'WC', icon: '🚻', soon: 'Upptaget! Försök igen om en stund.' }),
  F('PARKEN', 'lekforrad', 1150, 32, 452, 22, 28, { x0: 1158, x1: 1174, type: 'swing' }, { sign: 'LEKFÖRRÅD', icon: '🧸', soon: 'Låst – nyckeln har parkvakten.' }),
  F('PARKEN', 'paviljong', 1296, 88, 444, 36, 44, { x0: 1328, x1: 1352, type: 'open' }, { sign: 'MUSIKPAVILJONGEN', icon: '🎺', soon: 'Ingen konsert just nu – kom tillbaka en annan dag!' }),
  // förorten
  F('FÖRORTEN', 'lamell', 2200, 200, 452, 40, 84, { x0: 2288, x1: 2312, type: 'swing' }, { sign: 'BETONGVÄGEN 7', icon: '🏢', soon: 'Porten är låst och kodlåset är sönderslaget. Du bor inte här.' }),
  F('FÖRORTEN', 'husvagn', 2646, 48, 628, 22, 28, { x0: 2656, x1: 2668, type: 'swing' }, { sign: 'HUSVAGNEN', icon: '🚐', enter: 'bostad:husvagn', homes: ['husvagn'], lot: 'vagnsplatsen' }),
];

export const ALL_BUILDINGS = [...BUILDINGS, ...BUILDINGS_S, ...BUILDINGS_X, ...FREESTANDING];
export const buildingById = (id) => ALL_BUILDINGS.find((b) => b.id === id) || null;

// ---------------------------------------------------------------------
// Tomter: öppna, gåbara ytor. Marken målas av ground.js, staket/grejer
// (med hinder och grindar där gates anger) av props.js. row 'm' = mellanbandet.
// ---------------------------------------------------------------------
export const LOTS = [
  { id: 'kyrkogard', kind: 'kyrkogard', name: 'KYRKOGÅRDEN', district: 'SÖDER', row: 's', rect: [1000, CITY.FOOT_TOP_S, 1100, CITY.BASE_S], fence: true, // (krympt: Leksakslådan står på östra delen)
    gates: [{ side: 'n', x0: 1060, x1: 1080 }, { side: 's', x0: 1040, x1: 1060 }] },
  { id: 'parkering', kind: 'parkering', name: 'PARKERINGEN', district: 'FÖRORTEN', row: 'm', rect: [1768, 318, 2000, 452], fence: false,
    drive: [1790, 1822] }, // infarten från Pixelgatan (bilar korsar trottoaren här)
  { id: 'lekplats_x', kind: 'lekplats_x', name: 'LEKPLATSEN', district: 'FÖRORTEN', row: 'm', rect: [2030, 334, 2170, 452], fence: true,
    gates: [{ side: 'n', x0: 2090, x1: 2106 }, { side: 's', x0: 2120, x1: 2136 }] },
  { id: 'grusplan', kind: 'grusplan', name: 'GRUSPLANEN', district: 'FÖRORTEN', row: 'm', rect: [2430, 318, 2704, 452], fence: true,
    gates: [{ side: 'n', x0: 2560, x1: 2576 }, { side: 's', x0: 2450, x1: 2466 }, { side: 'w', y0: 380, y1: 396 }] }, // w = hål i stängslet
  { id: 'tomten', kind: 'tomten', name: 'TOMTEN', district: 'FÖRORTEN', row: 'n', rect: [2632, CITY.FOOT_TOP, 2712, CITY.BASE], fence: true,
    gates: [{ side: 's', x0: 2660, x1: 2680 }] },
  { id: 'atervinning', kind: 'atervinning', name: 'ÅTERVINNINGEN', district: 'FÖRORTEN', row: 's', rect: [2288, CITY.FOOT_TOP_S, 2380, CITY.BASE_S], fence: false },
  { id: 'vagnsplatsen', kind: 'vagnsplatsen', name: 'VAGNSPLATSEN', district: 'FÖRORTEN', row: 's', rect: [2628, CITY.FOOT_TOP_S, 2712, CITY.BASE_S], fence: false },
];

// ---------------------------------------------------------------------
// Luckorna mellan husen. kind: 'edge' (världens kant), 'alley' (gränd),
// 'street' (tvärgata; pedestrian = gågata utan bilar), 'road' (väg med trafik),
// 'lot' (tomt). y0..y1 = bandet luckan spänner (bakgata/parkgång → base).
// ---------------------------------------------------------------------
// v1: bara den norra raden i centrum (samma som förut – x 0–1700).
export const STREETS = [];
{
  const edges = [[0, BUILDINGS[0].x]];
  for (let i = 0; i + 1 < BUILDINGS.length; i++) edges.push([BUILDINGS[i].x + BUILDINGS[i].w, BUILDINGS[i + 1].x]);
  const last = BUILDINGS[BUILDINGS.length - 1];
  edges.push([last.x + last.w, CITY.X_CITY]);
  const NAMES = ['PARKGATAN', 'TORGGATAN', 'FABRIKSGATAN'];
  let n = 0;
  edges.forEach(([x0, x1], i) => {
    const edge = i === 0 || i === edges.length - 1;
    const street = !edge && x1 - x0 >= 48;
    STREETS.push({ x0, x1, kind: edge ? 'edge' : street ? 'street' : 'alley', name: street ? NAMES[n++] : null, row: 'n', y0: CITY.BACK[1], y1: CITY.BASE });
  });
}
// Luckor i en rad mellan x0 och x1: occ = hus och tomter i raden.
function gapsOf(row, x0, x1, occ, names, edgeL, edgeR) {
  const out = [], R = ROWS[row], y0 = R.back[1], y1 = R.base;
  const list = occ.map((o) => (o.rect ? { a: o.rect[0], b: o.rect[2], lot: o } : { a: o.x, b: o.x + o.w })).sort((p, q) => p.a - q.a);
  const gap = (a, b, edge) => {
    if (b <= a) return;
    const name = names[a] || null;
    const kind = edge ? 'edge' : name && b - a >= 48 ? 'street' : 'alley';
    out.push({ x0: a, x1: b, y0, y1, kind, name: kind === 'street' ? name : null, row, ...(kind === 'street' && row === 's' ? { pedestrian: true } : {}) });
  };
  let x = x0;
  list.forEach((o, k) => {
    gap(x, o.a, edgeL && k === 0);
    if (o.lot) out.push({ x0: o.a, x1: o.b, y0, y1, kind: 'lot', name: o.lot.name, lot: o.lot.id, row });
    x = o.b;
  });
  gap(x, x1, edgeR);
  return out;
}
// Söder: den södra raden i x 0–1700 (gågator mitt för Parkgatan, kyrkan och Fabriksgatan).
export const STREETS_S = gapsOf('s', 0, CITY.X_CITY, [...BUILDINGS_S, ...LOTS.filter((l) => l.row === 's' && l.district === 'SÖDER')],
  { 260: 'POSTGATAN', 816: 'KYRKOGATAN', 1212: 'VÅRDGATAN' }, true, false);
// Förorten: båda raderna öster om Infarten, plus Infarten själv i båda raderna.
export const STREETS_X = [
  { x0: CITY.INFARTEN[0], x1: CITY.INFARTEN[1], y0: CITY.BACK[1], y1: CITY.BASE, kind: 'street', name: 'INFARTEN', row: 'n', road: 'infarten' },
  ...gapsOf('n', CITY.X_SUB, CITY.W, [...BUILDINGS_X.filter((b) => b.row === 'n'), ...LOTS.filter((l) => l.row === 'n')], { 2236: 'BETONGGATAN' }, false, true),
  { x0: CITY.INFARTEN[0], x1: CITY.INFARTEN[1], y0: CITY.BACK_S[1], y1: CITY.BASE_S, kind: 'road', name: 'INFARTEN', row: 's', road: 'infarten' },
  ...gapsOf('s', CITY.X_SUB, CITY.W, [...BUILDINGS_X.filter((b) => b.row === 's'), ...LOTS.filter((l) => l.row === 's' && l.district === 'FÖRORTEN')], { 2236: 'BETONGGATAN' }, false, true),
];
export const STREETS_ALL = [...STREETS, ...STREETS_S, ...STREETS_X];

// ---------------------------------------------------------------------
// Övergångsställen. i är unikt över ALLA: CROSSWALKS_ALL[i].i === i.
// road = vägen som korsas; x0..x1 × y0..y1 = zebraytan; lights = trafikljus;
// broken = ljusen blinkar gult (förorten). stop = stopplinjen per körriktning
// (x för vågräta vägar, y för Infarten).
// ---------------------------------------------------------------------
const cwX = (i, x0, x1, name, road, y0, y1, extra) => ({ i, x0, x1, name, road, y0, y1, lights: true, stop: { 1: x0 - 3, '-1': x1 + 3 }, ...extra });
// Pixelgatan (v1: i 0–2 oförändrade; v2 lägger till Infarten och Betonggatan).
export const CROSSWALKS = [
  ...STREETS.filter((s) => s.kind === 'street').map((s, i) => cwX(i, s.x0, s.x1, s.name, 'pixelgatan', CITY.ROAD[0], CITY.ROAD[1])),
  cwX(3, CITY.INFARTEN[0], CITY.INFARTEN[1], 'INFARTEN', 'pixelgatan', CITY.ROAD[0], CITY.ROAD[1]),
  cwX(4, 2236, 2288, 'BETONGGATAN', 'pixelgatan', CITY.ROAD[0], CITY.ROAD[1], { broken: true }),
];
// Södergatan.
export const CROSSWALKS_S = [
  cwX(5, 260, 312, 'POSTGATAN', 'sodergatan', CITY.ROAD_S[0], CITY.ROAD_S[1]),
  cwX(6, 816, 868, 'KYRKOGATAN', 'sodergatan', CITY.ROAD_S[0], CITY.ROAD_S[1]),
  cwX(7, CITY.INFARTEN[0], CITY.INFARTEN[1], 'INFARTEN', 'sodergatan', CITY.ROAD_S[0], CITY.ROAD_S[1]),
];
// Infarten: zebror där trottoarerna korsar vägen (inga ljus – bilarna väjer).
export const CROSSWALKS_I = [
  { i: 8, x0: CITY.INFARTEN[0], x1: CITY.INFARTEN[1], y0: 282, y1: 302, name: 'INFARTEN', road: 'infarten', lights: false, stop: { 1: 279, '-1': 305 } },
  { i: 9, x0: CITY.INFARTEN[0], x1: CITY.INFARTEN[1], y0: 646, y1: 666, name: 'INFARTEN', road: 'infarten', lights: false, stop: { 1: 643, '-1': 669 } },
];
export const CROSSWALKS_ALL = [...CROSSWALKS, ...CROSSWALKS_S, ...CROSSWALKS_I];

// Trafikljusens stolpar (fotpunkt). En på varje trottoar vid varje övergångsställe med ljus.
const poles = (c, yN, yS) => [
  { crosswalk: c.i, road: c.road, side: 'n', x: c.x0 - 7, y: yN, ...(c.broken ? { broken: true } : {}) },
  { crosswalk: c.i, road: c.road, side: 's', x: c.x1 + 7, y: yS, ...(c.broken ? { broken: true } : {}) },
];
export const LIGHTS = CROSSWALKS.flatMap((c) => poles(c, CITY.SIDEWALK_N[1] - 3, CITY.SIDEWALK_S[1] - 3));
export const LIGHTS_S = CROSSWALKS_S.flatMap((c) => poles(c, CITY.SIDEWALK_SN[1] - 3, CITY.SIDEWALK_SS[1] - 3));
export const LIGHTS_ALL = [...LIGHTS, ...LIGHTS_S];

// ---------------------------------------------------------------------
// Busshållplatser. (x, y) = fotpunkt mitt på trottoaren där skjulet står (som
// v1:s BUS_STOP). road/lane = körfältet (index i road.lanes) bussen stannar i.
// wait = där spelaren hamnar när hen åker buss hit. broken = krossad kur och
// översprejad tidtabell.
// ---------------------------------------------------------------------
const stop = (id, name, district, x, y, road, lane, extra) => ({ id, name, district, x, y, road, lane, wait: { x: x + 30, y: y - 3 }, ...extra });
export const BUS_STOPS = [
  stop('pixeltorget', 'PIXELTORGET', 'CENTRUM', 610, CITY.SIDEWALK_S[1] - 3, 'pixelgatan', 1),
  stop('flygplatsen', 'FLYGPLATSEN', 'CENTRUM', 1626, CITY.SIDEWALK_S[1] - 3, 'pixelgatan', 1),
  stop('soderkyrkan', 'SÖDERKYRKAN', 'SÖDER', 1106, CITY.SIDEWALK_SS[1] - 3, 'sodergatan', 1),
  stop('betongtorget', 'BETONGTORGET', 'FÖRORTEN', 2010, CITY.SIDEWALK_S[1] - 3, 'pixelgatan', 1, { broken: true }),
];
// v1: busshållplatsen i centrum (samma objektform som förut).
export const BUS_STOP = { x: BUS_STOPS[0].x, y: BUS_STOPS[0].y };
export const busStopById = (id) => BUS_STOPS.find((s) => s.id === id || s.name === id) || null;

// ---------------------------------------------------------------------
// Vägarna – trafiken använder ROADS. axis 'x' = vågrät väg (lanes: { dir, y }),
// axis 'y' = lodrät väg (lanes: { dir, x }). traffic: 'full' | 'light'.
// ---------------------------------------------------------------------
export const ROADS = [
  { id: 'pixelgatan', name: 'PIXELGATAN', axis: 'x', x0: 0, x1: CITY.W, y0: CITY.ROAD[0], y1: CITY.ROAD[1], lanes: LANES, traffic: 'full',
    crosswalks: CROSSWALKS, lights: LIGHTS, stops: BUS_STOPS.filter((s) => s.road === 'pixelgatan') },
  { id: 'sodergatan', name: 'SÖDERGATAN', axis: 'x', x0: 0, x1: CITY.W, y0: CITY.ROAD_S[0], y1: CITY.ROAD_S[1], lanes: LANES_S, traffic: 'full',
    crosswalks: CROSSWALKS_S, lights: LIGHTS_S, stops: BUS_STOPS.filter((s) => s.road === 'sodergatan') },
  { id: 'infarten', name: 'INFARTEN', axis: 'y', x0: CITY.INFARTEN[0], x1: CITY.INFARTEN[1], y0: CITY.ROAD[1], y1: CITY.ROAD_S[0], lanes: LANES_I, traffic: 'light',
    crosswalks: CROSSWALKS_I, lights: [], stops: [], connects: ['pixelgatan', 'sodergatan'] },
];
export const roadById = (id) => ROADS.find((r) => r.id === id) || null;
// Korsningar (T = Infarten mynnar i en vågrät väg; norr om Pixelgatan är Infarten en tvärgata utan bilar).
export const JUNCTIONS = [
  { id: 'infarten-pixelgatan', x0: CITY.INFARTEN[0], x1: CITY.INFARTEN[1], y0: CITY.ROAD[0], y1: CITY.ROAD[1], roads: ['pixelgatan', 'infarten'], kind: 'T' },
  { id: 'infarten-sodergatan', x0: CITY.INFARTEN[0], x1: CITY.INFARTEN[1], y0: CITY.ROAD_S[0], y1: CITY.ROAD_S[1], roads: ['sodergatan', 'infarten'], kind: 'T' },
];

// ---------------------------------------------------------------------
// Parken (centrum, y 306–462). plaza/promenade/paths är v1. walks = grusgångar
// från promenaden ner till parkgången, i linje med gränderna i den södra raden.
// ---------------------------------------------------------------------
export const PARK_LAYOUT = {
  plaza: { cx: 934, cy: 366, r: 42 },
  promenade: [20, 334, CITY.X_CITY - 20, 346],
  paths: CROSSWALKS.filter((c) => c.i < 3).map((c) => [c.x0 + 12, CITY.SIDEWALK_S[1], c.x1 - 12, 334]),
  // (lagda mellan v1-rekvisitans träd, bänkar och rabatter – flytta inte utan att köra röktestet)
  walks: [
    [134, 346, 150, 462],    // → gränden radhusen/pizzerian
    [300, 346, 320, 462],    // Parkgatans axel → Postgatan
    [920, 408, 948, 462],    // torget → kyrkans baksida (kyrkaxeln: Torggatan – fontänen – tornet)
    [1206, 346, 1226, 462],  // Fabriksgatans axel → Vårdgatan
    [1398, 346, 1412, 462],  // → gränden vårdcentralen/tornhuset
  ],
  back: [0, CITY.BACK_S[0], CITY.X_CITY, CITY.BACK_S[1]],   // parkgången
  pond: { cx: 262, cy: 400, rx: 36, ry: 18 },               // dammen (änder, näckrosor, is på vintern)
  playground: [1030, 410, 1130, 458],                       // lekplatsen (sand, gungor, rutschkana)
  dogPark: [20, 358, 140, 452], dogGate: [74, 90],          // hundrastgården (staket, grind i norr)
  meadow: [1470, 356, 1680, 458],                           // ängen (vildblommor, buskar, fåglar)
};
// Förortens gångar (asfalt): gångvägen bakom den södra raden och stigen från hållplatsen.
export const SUB_LAYOUT = {
  back: [CITY.X_SUB, CITY.BACK_S[0], CITY.W, CITY.BACK_S[1]],
  paths: [[2004, CITY.SIDEWALK_S[1], 2026, CITY.BACK_S[0]]],
};
// Trottoarerna längs Infarten genom mellanbandet (väster: bara till parkgången – där står macken).
const INFART_WALKS = [[1686, CITY.SIDEWALK_S[1], 1700, CITY.BACK_S[1]], [1752, CITY.SIDEWALK_S[1], 1766, CITY.BASE_S]];

// Alla gångar med ytans slag (för marken/livet). PATH_RECTS = bara rektanglarna.
export const PATHS = [
  { rect: PARK_LAYOUT.promenade, kind: 'grus', district: 'PARKEN' },
  ...PARK_LAYOUT.paths.map((r) => ({ rect: r, kind: 'grus', district: 'PARKEN' })),
  ...PARK_LAYOUT.walks.map((r) => ({ rect: r, kind: 'grus', district: 'PARKEN' })),
  { rect: PARK_LAYOUT.back, kind: 'grus', district: 'PARKEN' },
  { rect: SUB_LAYOUT.back, kind: 'asfalt', district: 'FÖRORTEN' },
  ...SUB_LAYOUT.paths.map((r) => ({ rect: r, kind: 'asfalt', district: 'FÖRORTEN' })),
  ...INFART_WALKS.map((r) => ({ rect: r, kind: 'trottoar', district: 'FÖRORTEN' })),
];
export const PATH_RECTS = PATHS.map((p) => p.rect);

// Dammen som gånghinder: vågräta skivor (4 px) innanför strandkanten.
export const WATER = [];
{
  const { cx, cy, rx, ry } = PARK_LAYOUT.pond, ix = rx - 3, iy = ry - 3;
  for (let y = Math.ceil(cy - iy); y < cy + iy; y += 4) {
    const m = Math.min(Math.abs(y - cy), Math.abs(y + 4 - cy)), hw = Math.floor(ix * Math.sqrt(Math.max(0, 1 - (m / iy) ** 2)));
    if (hw > 2) WATER.push([cx - hw, y, cx + hw, Math.min(y + 4, Math.ceil(cy + iy))]);
  }
}
// Kanalen + räcket (hinder hela vägen längs världens södra kant).
export const CANAL_RECT = [0, CITY.WALK_BOTTOM + 2, CITY.W, CITY.H];

// ---------------------------------------------------------------------
// Stadsdelarna. rects = ytor (första träffen vinner), worn 0–1 = hur slitet
// allt ska ritas, tag = undertext på områdesskylten, spawn = bra plats att stå på.
// ---------------------------------------------------------------------
const XM = (CITY.INFARTEN[0] + CITY.INFARTEN[1]) / 2; // gränsen går mitt i Infarten
export const DISTRICTS = [
  { id: 'centrum', name: 'CENTRUM', tag: 'BUTIKER OCH JOBB PÅ PIXELGATAN', rects: [[0, 0, XM, CITY.PARK[0]]], worn: 0, spawn: { x: 640, y: 296 } },
  { id: 'parken', name: 'PARKEN', tag: 'FONTÄNEN, DAMMEN OCH LEKPLATSEN', rects: [[0, CITY.PARK[0], XM, CITY.BACK_S[1]]], worn: 0, spawn: { x: 934, y: 420 } },
  { id: 'soder', name: 'SÖDER', tag: 'KYRKAN, BION OCH BIBLIOTEKET', rects: [[0, CITY.BACK_S[1], XM, CITY.H]], worn: 0, spawn: { x: 934, y: 660 } },
  { id: 'fororten', name: 'FÖRORTEN', tag: 'BETONG, GRAFFITI OCH BILLIGA HYROR', rects: [[XM, 0, CITY.W, CITY.H]], worn: 1, spawn: { x: 2040, y: 296 } },
];
export const districtAt = (x, y) => DISTRICTS.find((d) => d.rects.some((r) => x >= r[0] && x < r[2] && y >= r[1] && y < r[3])) || DISTRICTS[0];
export const districtByName = (name) => DISTRICTS.find((d) => d.name === name || d.id === name) || null;

// ---------------------------------------------------------------------
// Geometri för hus (fungerar för alla rader).
// ---------------------------------------------------------------------
export const baseOf = (b) => b.base ?? CITY.BASE;
export const footprint = (b) => b.foot || [b.x, b.top ?? CITY.FOOT_TOP, b.x + b.w, baseOf(b) - 1];
export const doorFront = (b) => [b.door.x0 - 10, baseOf(b), b.door.x1 + 10, baseOf(b) + 22];
export const doorCenter = (b) => ({ x: (b.door.x0 + b.door.x1) / 2, y: baseOf(b) + 12 });

// Statiska hinder som kartan själv vet om: husens fotavtryck + deras blocks,
// dammen och kanalen. Scenen lägger till modulernas hinder (props, trafik, liv).
export const MAP_OBSTACLES = [
  ...ALL_BUILDINGS.map(footprint),
  ...ALL_BUILDINGS.flatMap((b) => b.blocks || []),
  ...WATER,
  CANAL_RECT,
];

// Grindens yta (för RESERVED och rekvisitans staket): 6 px in/ut från staketet.
export function gateRect(l, g) {
  const [x0, y0, x1, y1] = l.rect;
  if (g.side === 'n') return [g.x0, y0 - 6, g.x1, y0 + 6];
  if (g.side === 's') return [g.x0, y1 - 6, g.x1, y1 + 6];
  if (g.side === 'w') return [x0 - 6, g.y0, x0 + 6, g.y1];
  return [x1 - 6, g.y0, x1 + 6, g.y1];
}

// Ytor där rekvisita (träd, bänkar, lyktor …) INTE får stå.
const sidewalkEnds = (c, a, b) => [[c.x0 - 6, a[0], c.x1 + 6, a[1]], [c.x0 - 6, b[0], c.x1 + 6, b[1]]];
export const RESERVED = [
  [0, CITY.ROAD[0], CITY.W, CITY.ROAD[1]],                                   // Pixelgatan
  ...BUILDINGS.map(doorFront),                                               // framför dörrarna
  ...CROSSWALKS.map((c) => [c.x0 - 6, CITY.SIDEWALK_N[0], c.x1 + 6, CITY.SIDEWALK_N[1]]),
  ...CROSSWALKS.map((c) => [c.x0 - 6, CITY.SIDEWALK_S[0], c.x1 + 6, CITY.SIDEWALK_S[1]]),
  ...LIGHTS.map((l) => [l.x - 6, l.y - 8, l.x + 6, l.y + 3]),
  ...PATH_RECTS,
  // --- v2 ---
  [0, CITY.ROAD_S[0], CITY.W, CITY.ROAD_S[1]],                               // Södergatan
  [1100, CITY.SIDEWALK_SN[0], 1212, CITY.SIDEWALK_SN[0] + 24],                // Leksakslådans skyltfönster och dörr
  [CITY.INFARTEN[0], CITY.ROAD[0], CITY.INFARTEN[1], CITY.ROAD_S[1]],        // Infarten
  ...[...BUILDINGS_S, ...BUILDINGS_X, ...FREESTANDING].flatMap((b) => [footprint(b), doorFront(b), ...(b.blocks || []), ...(b.yard ? [b.yard.rect] : [])]),
  ...CROSSWALKS_S.flatMap((c) => sidewalkEnds(c, CITY.SIDEWALK_SN, CITY.SIDEWALK_SS)),
  ...LIGHTS_S.map((l) => [l.x - 6, l.y - 8, l.x + 6, l.y + 3]),
  ...LOTS.flatMap((l) => (l.gates || []).map((g) => gateRect(l, g))),
  ...LOTS.filter((l) => l.drive).map((l) => [l.drive[0], CITY.SIDEWALK_S[0], l.drive[1], l.rect[1]]),
  ...BUS_STOPS.slice(1).map((s) => [s.x - 24, s.y - 18, s.x + 24, s.y + 3]),  // skjulen (v1-skjulet sköter rekvisitan själv)
  [PARK_LAYOUT.pond.cx - PARK_LAYOUT.pond.rx - 2, PARK_LAYOUT.pond.cy - PARK_LAYOUT.pond.ry - 2,
    PARK_LAYOUT.pond.cx + PARK_LAYOUT.pond.rx + 2, PARK_LAYOUT.pond.cy + PARK_LAYOUT.pond.ry + 2],
  [PARK_LAYOUT.dogGate[0], PARK_LAYOUT.dogPark[1] - 6, PARK_LAYOUT.dogGate[1], PARK_LAYOUT.dogPark[1] + 6],
  [0, CITY.QUAY[0] + 8, CITY.W, CITY.H],                                     // räcket och kanalen
];

// ---------------------------------------------------------------------
// Husbilder. Bredd b.w + 16 (8 px överhäng åt varje håll för markiser/skyltar),
// ritas med övre vänstra hörnet i (b.x − 8, base + 4 − höjd). Bildens rad
// (höjd − 4) motsvarar alltså markytan y = base. Höjden är fri – artBox ger
// rekommenderad ruta: norra raden 190 hög (canvas-y = världs-y, som i v1),
// södra raden 190 hög (canvas-y = världs-y − 454; högre för torn/höga hus),
// fristående hus så höga som tak + fasad kräver.
// ---------------------------------------------------------------------
export const ART_OVER = 8, ART_BELOW = 4;
export const artPos = (b, img) => ({ x: b.x - ART_OVER, y: baseOf(b) + ART_BELOW - img.height });
export const artPosS = artPos; // samma formel – bilden står alltid på b.base
export const artPosX = artPos;
export function artBox(b) {
  const base = baseOf(b);
  let top;
  if (b.row === 'n') top = 0;
  else if (b.row === 'f') top = base - b.d - b.h - 16;
  else top = Math.min((b.top ?? CITY.FOOT_TOP_S) - 40, base - b.h - 24, b.tower ? base - b.tower.h - 20 : Infinity);
  return { x: b.x - ART_OVER, y: top, w: b.w + 2 * ART_OVER, h: base + ART_BELOW - top };
}

export const inRect = (x, y, r) => x >= r[0] && x < r[2] && y >= r[1] && y < r[3];
export const isNightHour = (h) => h >= 19.5 || h < 6.5;

// Kontroll av kontraktet: returnerar en lista med problem (tom = allt stämmer).
// Körs av röktestet – kör den själv om du flyttar något.
export function validateMap() {
  const out = [];
  const hit = (a, b) => a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1];
  const fps = ALL_BUILDINGS.map((b) => [b.id, footprint(b), b]);
  for (let i = 0; i < fps.length; i++) for (let j = i + 1; j < fps.length; j++) if (hit(fps[i][1], fps[j][1])) out.push(`fotavtrycken ${fps[i][0]} och ${fps[j][0]} överlappar`);
  const roads = ROADS.map((r) => [r.id, [r.x0, r.y0, r.x1, r.y1]]);
  const pond = [PARK_LAYOUT.pond.cx - PARK_LAYOUT.pond.rx, PARK_LAYOUT.pond.cy - PARK_LAYOUT.pond.ry, PARK_LAYOUT.pond.cx + PARK_LAYOUT.pond.rx, PARK_LAYOUT.pond.cy + PARK_LAYOUT.pond.ry];
  const blocks = ALL_BUILDINGS.flatMap((x) => x.blocks || []);
  for (const b of ALL_BUILDINGS) {
    const fp = footprint(b), df = doorFront(b);
    if (b.door.x0 < b.x || b.door.x1 > b.x + b.w) out.push(`${b.id}: dörren ligger utanför fasaden`);
    for (const [id, r] of roads) if (hit(fp, r)) out.push(`${b.id} står på vägen ${id}`);
    for (const r of PATH_RECTS) if (hit(fp, r)) out.push(`${b.id} står på en gång ${r.join(',')}`);
    if (hit(fp, pond)) out.push(`${b.id} står i dammen`);
    for (const [id, o] of fps) if (id !== b.id && hit(df, o)) out.push(`dörren till ${b.id} blockeras av ${id}`);
    for (const o of blocks) if (hit(df, o)) out.push(`dörren till ${b.id} blockeras av ett block`);
    if (fp[0] < 0 || fp[2] > CITY.W || fp[1] < CITY.BACK[1] || fp[3] >= CITY.QUAY[0]) out.push(`${b.id} sticker ut ur världen`);
    if (!DISTRICTS.some((d) => d.name === b.district)) out.push(`${b.id}: okänd stadsdel ${b.district}`);
    if (b.row === 's' && (b.top !== CITY.FOOT_TOP_S || b.base > CITY.BASE_S || b.base < CITY.FOOT_TOP_S + 60)) out.push(`${b.id}: fel base/top för södra raden`);
    if (b.row === 'n' && (b.top !== CITY.FOOT_TOP || b.base !== CITY.BASE)) out.push(`${b.id}: fel base/top för norra raden`);
    if (b.enter && !/^(hem|bostad|mat|klader|mobler|kafe|djur|burgare|frukt|flyg|glass|narbutik|leksaker|jobb:[a-z]+|bostad:[a-z]+)$/.test(b.enter)) out.push(`${b.id}: okänd enter ${b.enter}`);
  }
  for (const l of LOTS) for (const b of ALL_BUILDINGS) if (b.lot !== l.id && hit(l.rect, footprint(b))) out.push(`tomten ${l.id} överlappar ${b.id}`);
  const ids = new Set();
  for (const b of ALL_BUILDINGS) { if (ids.has(b.id)) out.push(`dubbelt id ${b.id}`); ids.add(b.id); }
  CROSSWALKS_ALL.forEach((c, k) => { if (c.i !== k) out.push(`övergångsställe ${k} har i=${c.i}`); });
  for (const l of LIGHTS_ALL) for (const [id, fp] of fps) if (hit([l.x - 2, l.y - 2, l.x + 2, l.y + 1], fp)) out.push(`trafikljuset vid övergångsställe ${l.crosswalk} står i ${id}`);
  for (const s of BUS_STOPS) {
    for (const [id, fp] of fps) if (hit([s.x - 24, s.y - 14, s.x + 24, s.y + 2], fp)) out.push(`busshållplatsen ${s.id} står i ${id}`);
    for (const [id, r] of roads) if (hit([s.x - 24, s.y - 1, s.x + 24, s.y + 1], r)) out.push(`busshållplatsen ${s.id} står på vägen ${id}`);
  }
  for (let y = 0; y < CITY.H; y += 20) for (let x = 0; x < CITY.W; x += 20) if (!DISTRICTS.some((d) => d.rects.some((r) => inRect(x, y, r)))) { out.push(`(${x},${y}) hör inte till någon stadsdel`); break; }
  return out;
}
