// Pixelstadens karta – KONTRAKTET som alla stadsmoduler delar (v2).
// Allt i världskoordinater, samma pixelkorn som resten av spelet
// (1 enhet = 1 spelpixel; en figur är ~24×40). Kameran visar 384×216.
// Fullständig beskrivning för modulförfattare: docs/STADEN.md.
//
// Världen är 4000 × 820. Den gamla stadskärnan (v1, x 0–1700, y 0–420)
// ligger kvar EXAKT där den låg – all befintlig konst passar. v2 lade till
// djup söderut (SÖDER) och en förort österut (FÖRORTEN). v3 ("staden på
// längden", Carl 2026-09-29) lägger DOWNTOWN direkt öster om Infarten,
// sedan FLODEN med STORA BRON (Pixelgatan) och JÄRNBRON (Södergatan), och
// flyttar hela förorten oförändrad SUB_DX = 1280 px österut – förorten
// sitter inte längre ihop med centrum.
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
//   1752–2400  DOWNTOWN: finanskvarteret – skyskrapor, banken, elektronik,
//              frisör, skor, accessoarer; FINANSTORGET i mellanbandet
//   2400–3032  FLODEN: kajer (2400–2420, 3012–3032), vatten 2424–3008 från
//              y 0 till 820 utom där broarna går: STORA BRON (y 186–306,
//              hängbro à la Brooklyn Bridge) och JÄRNBRON (y 640–760)
//  −1200–0     LINNÉSTADEN (v4, 2026-10-07): den mysiga stadsdelen väster om centrum –
//              landshövdingehus, små butiker, Marknadstorget mitt emellan gatorna, kajen
//              (x < 0: CITY.X0 är världens västra kant – centrum står kvar där det stod)
//   3032–4000  FÖRORTEN (v2-förorten + SUB_DX): höghus, närbutik, pantbank,
//              kebab, övergivet hus, parkering, lekplats, bilverkstad, tvätteri …
// Den södra raden är ritad som en kopia av den norra, DY_S = 454 px längre
// ner: husbilden för ett södervänt hus är 190 px hög precis som en norrbild,
// och bildens rad r motsvarar världens y = r + DY_S (se artBox).

import { $t, $n } from '../core/i18n.js';

export const CITY = {
  X0: -1200,                   // (v4) världens västra kant: Linnéstaden ligger i x −1200–0, väster om centrum
  W: 4000, H: 960,            // (v4: 820 → 960 – vattnet nedanför kajen är djupare: piren och Sjöboden i Linnéstaden)
              // OBS: net/world.js klämmer spelarnas x till X0–4000 – bredare kräver ny klämning där
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
  INFARTEN: [1700, 1752],      // den lodräta vägen mellan centrum och downtown
  // --- v3: staden på längden ---
  X_DT: 1752,                  // DOWNTOWN börjar här (finanskvarteret)
  RIVER: [2400, 3032],         // FLODEN: västra kajen + vattnet + östra kajen (se RIVER/BRIDGES)
  X_SUB: 3032,                 // förorten börjar här (var 1752 i v2)
  SUB_DX: 1280,                // så långt österut förorten flyttades i v3 (v2-x + SUB_DX = v3-x)
  DY_S: 454,                   // BASE_S − BASE = ROAD_S[0] − ROAD[0]
  BACK_S: [462, 490],          // parkgången bakom de södra husen
  FOOT_TOP_S: 494,             // den södra husradens fotavtryck börjar här
  BASE_S: 640,                 // de södra fasaderna står här
  SIDEWALK_SN: [640, 672],     // trottoaren framför de södra husen
  ROAD_S: [672, 730],          // Södergatan
  SIDEWALK_SS: [730, 760],     // bortre trottoaren
  QUAY: [760, 776],            // kajen (räcket står på y 772–774)
  CANAL: [776, 960],           // kanalen (v4: djupare – piren går ut i den)
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
// FLODEN (v3). Flodrummet x 2400–3032 över hela höjden: en gåbar kaj på
// varje strand (stenremsa med räcke mot vattnet), vattnet emellan. Floden
// kommer norrifrån (utanför världen), går under STORA BRON och JÄRNBRON och
// mynnar i kanalen längst söderut. Allt i flodrummet ritas av js/city/bridge.js
// (vattnet, kajerna, broarna, tornen, kablarna, båtarna) – ground.js målar
// bara en platshållare under.
//   quayW/quayE  kajerna (gåbara: x 2400–2420 och 3012–3032, y 8–774)
//   rails        kajräckena längs vattnet (hinder, 4 px)
//   water        vattenytorna (hinder; is på vintern) – allt vatten utom under broarna
// ---------------------------------------------------------------------
const RX0 = CITY.RIVER[0], RX1 = CITY.RIVER[1], QW = 20, RAIL = 4;   // kajbredd, räckets bredd
const WX0 = RX0 + QW + RAIL, WX1 = RX1 - QW - RAIL;                  // vattnet: 2424–3008
// Broarnas däck (gåbart, samma y-band som gatan på land) och räcken (hinder).
// Vattnet är allt i x WX0–WX1 som inte är däck eller räcke.
const DECK_N = [CITY.SIDEWALK_N[0], CITY.SIDEWALK_S[1]];             // 186–306: Pixelgatan med trottoarer
const DECK_S = [CITY.SIDEWALK_SN[0], CITY.SIDEWALK_SS[1]];           // 640–760: Södergatan med trottoarer
export const BRIDGES = [
  {
    id: 'storabron', name: $n('STORA BRON'), kind: 'hangbro', road: 'pixelgatan',
    x0: WX0, x1: WX1,
    walk: [WX0, DECK_N[0], WX1, DECK_N[1]],                           // gåbart: norra trottoaren, körbanan, södra trottoaren
    rails: [[WX0, DECK_N[0] - 5, WX1, DECK_N[0]], [WX0, DECK_N[1], WX1, DECK_N[1] + 5]],
    // två stentorn med gotiska spetsbågar (à la Brooklyn Bridge) som däcket går igenom.
    // legs = tornbenen utanför räckena (i vattnet), pier = mittpelaren mellan körfälten
    // (mellan de två valven). Tornen får inte nå över världs-y 0 (kameran visar aldrig y < 0).
    towers: [
      { x0: 2556, x1: 2604, legs: [[2556, 163, 2604, 181], [2556, 311, 2604, 329]], pier: [2556, 246, 2604, 250] },
      { x0: 2828, x1: 2876, legs: [[2828, 163, 2876, 181], [2828, 311, 2876, 329]], pier: [2828, 246, 2876, 250] },
    ],
  },
  {
    id: 'jarnbron', name: $n('JÄRNBRON'), kind: 'fackverk', road: 'sodergatan',
    x0: WX0, x1: WX1,
    walk: [WX0, DECK_S[0], WX1, DECK_S[1]],
    rails: [[WX0, DECK_S[0] - 5, WX1, DECK_S[0]], [WX0, DECK_S[1], WX1, DECK_S[1] + 5]],
    towers: [],
  },
];
export const RIVER = {
  x0: RX0, x1: RX1,                                                  // hela flodrummet
  wx0: WX0, wx1: WX1,                                                // vattnet
  quayW: [RX0, CITY.BACK[0], RX0 + QW, CITY.WALK_BOTTOM + 2],        // västra kajen (downtown-sidan)
  quayE: [RX1 - QW, CITY.BACK[0], RX1, CITY.WALK_BOTTOM + 2],        // östra kajen (förortssidan)
  // vattenytorna: norr om Stora bron, mellan broarna, söder om Järnbron (mynnar i kanalen)
  water: [
    [WX0, 0, WX1, DECK_N[0] - 5],
    [WX0, DECK_N[1] + 5, WX1, DECK_S[0] - 5],
    [WX0, DECK_S[1] + 5, WX1, CITY.H],
  ],
  // kajräckena mot vattnet (öppna där broarna ansluter)
  rails: [
    [RX0 + QW, 0, WX0, DECK_N[0] - 5], [RX0 + QW, DECK_N[1] + 5, WX0, DECK_S[0] - 5], [RX0 + QW, DECK_S[1] + 5, WX0, CITY.H],
    [WX1, 0, RX1 - QW, DECK_N[0] - 5], [WX1, DECK_N[1] + 5, RX1 - QW, DECK_S[0] - 5], [WX1, DECK_S[1] + 5, RX1 - QW, CITY.H],
  ],
};
export const inRiver = (x, y) => x >= RX0 && x < RX1 && y >= 0 && y < CITY.H;

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
//   door          – { x0, x1, type } i världs-x; type (DOOR_TYPES): 'swing' (slagdörr),
//                   'slide' (skjutdörr), 'open' (öppen portal), 'roll' (rullport),
//                   'boarded' (igenspikad), 'revolve' (karuselldörr – kontorstornen)
//   row           – 'n' (norra raden), 's' (södra raden), 'f' (fristående)
//   face          – 'south': fasaden med dörren vetter söderut (mot kameran). Alla hus i v2.
//   district      – 'CENTRUM' | 'PARKEN' | 'SÖDER' | 'DOWNTOWN' | 'FÖRORTEN' (se DISTRICTS)
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
  B('hem', 16, 120, 132, { x0: 64, x1: 88, type: 'swing' }, { sign: $t('PIXELGATAN 1'), icon: '🏠', enter: 'hem', homes: ['lagenhet', 'villa'] }),
  B('bostad', 164, 96, 100, { x0: 200, x1: 224, type: 'swing' }, { sign: $t('BOSTADSBYRÅN'), icon: '🔑', enter: 'bostad', open: [7, 20] }),
  B('mat', 312, 196, 104, { x0: 388, x1: 432, type: 'slide' }, { sign: $t('STORMARKNAD'), icon: '🛒', enter: 'mat', open: [7, 23] }),
  B('klader', 536, 124, 112, { x0: 586, x1: 610, type: 'swing' }, { sign: $t('KLÄDER'), icon: '👕', enter: 'klader', open: [7, 21] }),
  B('mobler', 688, 220, 116, { x0: 776, x1: 820, type: 'slide' }, { sign: $t('MÖBELJÄTTEN'), icon: '🛋️', enter: 'mobler', open: [7, 21] }),
  B('kafe', 960, 92, 92, { x0: 994, x1: 1018, type: 'swing' }, { sign: $t('KAFÉ'), icon: '☕', enter: 'kafe', open: [7, 21] }),
  B('burgare', 1080, 132, 100, { x0: 1134, x1: 1158, type: 'swing' }, { sign: $t('BURGARBAREN'), icon: '🍔', enter: 'burgare', open: [7, 23] }),
  B('frukt', 1264, 160, 118, { x0: 1330, x1: 1356, type: 'swing' }, { sign: $t('FRUKTFABRIKEN'), icon: '🍎', enter: 'frukt', open: [7, 21] }),
  B('flyg', 1452, 228, 124, { x0: 1544, x1: 1592, type: 'slide' }, { sign: $t('FLYGPLATSEN'), icon: '✈️', enter: 'flyg' }),
];

// Den södra raden (SÖDER): fasaderna med dörrarna vetter mot Södergatan,
// taken syns från parken. Gränder och gågator emellan leder från parkgången
// ner till trottoaren. Två hus är indragna (base < BASE_S) med gåbar gård framför.
const S = (id, x, w, h, door, extra) => mk('s', 'SÖDER', id, x, w, h, door, extra);
export const BUILDINGS_S = [
  S('radhus', 16, 132, 76, { x0: 74, x1: 90, type: 'swing' }, {
    sign: $t('RADHUSEN'), icon: '🏡', enter: 'bostad:radhus', homes: ['radhus'], base: 616,
    yard: { kind: 'garden', rect: [16, 616, 148, 640] },
    blocks: [[58, 618, 62, 638], [102, 618, 106, 638]], // häckarna mellan de tre trädgårdarna
  }),
  S('pizzeria', 172, 88, 100, { x0: 204, x1: 228, type: 'swing' }, { sign: $t('PIZZERIA NAPOLI'), icon: '🍕', enter: 'jobb:pizzeria', open: [11, 23] }),
  S('posten', 312, 92, 96, { x0: 346, x1: 370, type: 'swing' }, { sign: $t('POSTEN'), icon: '📮', enter: 'jobb:posten', open: [8, 18] }),
  S('djuraffar', 432, 180, 116, { x0: 508, x1: 536, type: 'swing' }, { sign: $t('DJURAFFÄREN'), icon: '🐾', enter: 'djur', open: [9, 19] }),
  S('bio', 640, 176, 120, { x0: 710, x1: 746, type: 'slide' }, { sign: $t('BIO PIXEL'), icon: '🎬', open: [12, 24], enter: 'bio', soon: $t('Kvällens film börjar 19:00 – biljettluckan öppnar snart!') }), // foajén och salongen (js/scenes/shop-bio.js)
  S('kyrka', 868, 132, 104, { x0: 922, x1: 946, type: 'swing' }, {
    sign: $t('SÖDERKYRKAN'), icon: '⛪', tower: { x0: 914, x1: 954, h: 212 },
    soon: $t('Kyrkan är tyst och sval. Gudstjänst på söndag klockan 11.'),
  }),
  S('leksaker', 1100, 112, 116, { x0: 1180, x1: 1204, type: 'swing' }, { sign: $t('LEKSAKSLÅDAN'), icon: '🧸', enter: 'leksaker', open: [9, 19] }), // leksaksaffären (js/city/buildings-leksaker.js + js/scenes/shop-leksaker.js)
  S('vardcentral', 1264, 156, 124, { x0: 1326, x1: 1358, type: 'slide' }, { sign: $t('VÅRDCENTRALEN'), icon: '🏥', enter: 'jobb:vard', open: [8, 17] }),
  S('tornhuset', 1448, 128, 172, { x0: 1500, x1: 1524, type: 'swing' }, { sign: $t('TORNHUSET'), icon: '🏙️', enter: 'bostad:takvaning', homes: ['takvaning'] }),
  S('bensinmack', 1600, 100, 64, { x0: 1636, x1: 1660, type: 'slide' }, {
    sign: $t('PIXELMACKEN'), icon: '⛽', enter: 'jobb:bensinmack', open: [6, 23], base: 596,
    yard: { kind: 'forecourt', rect: [1600, 596, 1700, 640] }, frontY: 640,
    // (pumpöarna: BUILDING_ART.bensinmack.obstacles)
  }),
];

// DOWNTOWN (v3): finanskvarteret mellan Infarten och floden. Höga hus i båda
// raderna – skyskrapor med karuselldörrar, banken, elektronikbutiken, frisören,
// skobutiken och accessoarbutiken. BANKGATAN (x 2080–2128) är tvärgatan i båda
// raderna, i linje med FINANSTORGET mitt i mellanbandet. enter = scenen man går in i
// (main.js laddar scenerna tåligt – saknas en visar dörren sin soon-text, se city.js
// SCENE_DOORS). PIXEL TOWER rymmer Pixelhögskolan, FINANSHUSET finansjobbet och
// GLASTORNET Pixel Data (datorjobbet) – båda jobben kräver examen från högskolan.
// Höjder: norra raden högst ~176 (bilden börjar på y 0), södra raden får vara högre
// (den syns över torget) men helst ≤ 220 så att torget inte försvinner bakom.
export const DOOR_TYPES = ['swing', 'slide', 'open', 'roll', 'boarded', 'revolve'];
const DN = (id, x, w, h, door, extra) => mk('n', 'DOWNTOWN', id, x, w, h, door, extra);
const DS = (id, x, w, h, door, extra) => mk('s', 'DOWNTOWN', id, x, w, h, door, extra);
export const BUILDINGS_D = [
  DN('kontor1', 1768, 128, 170, { x0: 1816, x1: 1848, type: 'revolve' }, { sign: $t('FINANSHUSET'), icon: '📈', open: [7, 19], enter: 'jobb:finans',
    soon: $t('Finanshuset anställer bara folk med examen i Ekonomi från Pixelhögskolan. Kavaj och slips, tack!') }),
  DN('bank', 1920, 160, 136, { x0: 1984, x1: 2016, type: 'swing' }, { sign: $t('PIXELBANKEN'), icon: '🏦', open: [9, 17], enter: 'bank',
    soon: $t('Banken öppnar snart – här ska du kunna sätta in lönen, spara och låna.') }),
  DN('elektronik', 2128, 152, 124, { x0: 2188, x1: 2220, type: 'slide' }, { sign: $t('ELEKTRONIK'), icon: '📱', open: [10, 20], enter: 'elektronik',
    soon: $t('Elektronikbutiken öppnar snart – telefoner, surfplattor, datorer och tv-apparater!') }),
  DN('kontor2', 2304, 80, 174, { x0: 2328, x1: 2356, type: 'revolve' }, { sign: $t('BÖRSHUSET'), icon: '📊', open: [8, 18],
    soon: $t('Öppnar snart – börsen. Här köps och säljs aktier från morgon till kväll.') }),
  DS('kontor3', 1768, 120, 200, { x0: 1812, x1: 1844, type: 'revolve' }, { sign: $t('PIXELHÖGSKOLAN'), icon: '🎓', open: [8, 20], enter: 'universitet',
    soon: $t('Pixelhögskolan i Pixel Tower öppnar snart – kurser, föreläsningar och tentor.') }),
  DS('skor', 1912, 96, 100, { x0: 1948, x1: 1972, type: 'swing' }, { sign: $t('SKOBUTIKEN'), icon: '👟', open: [10, 19], enter: 'skor',
    soon: $t('Skobutiken öppnar snart – sneakers, kängor, stövlar och finskor.') }),
  DS('frisor', 2008, 72, 92, { x0: 2032, x1: 2056, type: 'swing' }, { sign: $t('FRISÖR'), icon: '💈', open: [9, 18], enter: 'frisor',
    soon: $t('Frisören öppnar snart – klippning, färgning och nya frisyrer.') }),
  DS('accessoarer', 2128, 96, 96, { x0: 2164, x1: 2188, type: 'swing' }, { sign: $t('ACCESSOARER'), icon: '👜', open: [10, 19], enter: 'accessoarer',
    soon: $t('Accessoarbutiken öppnar snart – väskor, smycken, klockor och solglasögon.') }),
  DS('kontor4', 2248, 136, 216, { x0: 2300, x1: 2332, type: 'revolve' }, { sign: $t('GLASTORNET'), icon: '🖥️', open: [7, 19], enter: 'jobb:datorbygge',
    soon: $t('Pixel Data på tolfte våningen anställer bara folk med examen i Datorteknik. Hissen går bara för anställda.') }),
];

// Förorten (FÖRORTEN): en norra rad längs Pixelgatan och en södra rad längs
// Södergatan, samma geometri som i centrum. Här är allt slitet (district.worn = 1).
// v3: koordinaterna nedan är v2:s (förorten låg då i x 1752–2720) – hela förorten
// flyttas oförändrad SUB_DX österut här (hus, dörrar, tomter, hållplats, zebra …).
const SX = CITY.SUB_DX;
const subDoor = (d) => ({ ...d, x0: d.x0 + SX, x1: d.x1 + SX });
const XN = (id, x, w, h, door, extra) => mk('n', 'FÖRORTEN', id, x + SX, w, h, subDoor(door), extra);
const XS = (id, x, w, h, door, extra) => mk('s', 'FÖRORTEN', id, x + SX, w, h, subDoor(door), extra);
export const BUILDINGS_X = [
  XN('hoghus', 1768, 168, 168, { x0: 1840, x1: 1864, type: 'swing' }, { sign: $t('BETONGVÄGEN 1'), icon: '🏢', enter: 'bostad:hoghus', homes: ['rum', 'hoghus'] }), // Lilla rummet (startbostaden) ligger i förorten
  XN('narbutik', 1964, 108, 104, { x0: 2004, x1: 2028, type: 'swing' }, { sign: $t('NÄRBUTIK 24/7'), icon: '🏪', enter: 'narbutik' }),
  XN('pantbank', 2072, 76, 104, { x0: 2098, x1: 2122, type: 'swing' }, { sign: $t('PANTBANKEN'), icon: '💍', open: [10, 18], enter: 'pantbank', soon: $t('Pantbanken: "Vi köper ditt guld!" – kom tillbaka när du har något att pantsätta.') }), // js/scenes/shop-pantbank.js
  XN('kebab', 2148, 88, 104, { x0: 2180, x1: 2204, type: 'swing' }, { sign: $t('KEBAB GRILL'), icon: '🥙', open: [11, 24], enter: 'kebab', soon: $t('Grillen är trasig igen. "ÖPPET IGEN!" står det på lappen – kom tillbaka en annan dag.') }), // js/scenes/shop-kebab.js
  XN('maskerad', 2288, 104, 96, { x0: 2328, x1: 2352, type: 'swing' }, { sign: $t('MASKERAD'), icon: '🎃', open: [10, 22], enter: 'maskerad', soon: $t('Maskeradbutiken har stängt för i kväll – spöket i fönstret vaktar. Öppet 10–22.') }), // js/scenes/shop-maskerad.js (det gamla övergivna huset)
  XN('hoghus2', 2420, 184, 170, { x0: 2500, x1: 2524, type: 'swing' }, { sign: $t('BETONGVÄGEN 5'), icon: '🏢', soon: $t('Kodlåset är sönderslaget – men du bor inte här.') }),
  XS('bilverkstad', 1768, 160, 88, { x0: 1792, x1: 1840, type: 'roll' }, { sign: $t('BILVERKSTAN'), icon: '🔧', enter: 'jobb:bilverkstad', open: [7, 18] }),
  XS('tvatteri', 1956, 100, 100, { x0: 1992, x1: 2016, type: 'swing' }, { sign: $t('TVÄTTERI'), icon: '🧺', enter: 'jobb:tvatteri', open: [8, 20] }),
  XS('garage', 2084, 152, 52, { x0: 2140, x1: 2176, type: 'roll' }, { sign: $t('GARAGEN'), icon: '🛵', open: [9, 19], enter: 'fordon', soon: $t('Garaget: cyklar, elsparkcyklar och mopeder – Kenta skruvar på en moppe där inne.') }), // js/scenes/shop-fordon.js
  XS('lagerhall', 2408, 192, 92, { x0: 2488, x1: 2536, type: 'roll' }, { sign: $t('LAGER 3'), icon: '🏭', soon: $t('Övergiven lagerhall. Någon har sprejat "PIXEL 4 EVER" på porten.') }),
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
  F('PARKEN', 'kiosk', 392, 40, 452, 24, 34, { x0: 404, x1: 420, type: 'swing' }, { sign: $t('GLASS'), icon: '🍦', open: [10, 21], enter: 'glass' }), // glasståndet (props.js ritar det öppna ståndet på kioskens plats)
  F('PARKEN', 'toalett', 762, 36, 452, 24, 30, { x0: 772, x1: 786, type: 'swing' }, { sign: $t('WC'), icon: '🚻', soon: $t('Upptaget! Försök igen om en stund.') }),
  F('PARKEN', 'lekforrad', 1150, 32, 452, 22, 28, { x0: 1158, x1: 1174, type: 'swing' }, { sign: $t('LEKFÖRRÅD'), icon: '🧸', soon: $t('Låst – nyckeln har parkvakten.') }),
  F('PARKEN', 'paviljong', 1296, 88, 444, 36, 44, { x0: 1328, x1: 1352, type: 'open' }, { sign: $t('MUSIKPAVILJONGEN'), icon: '🎺', soon: $t('Ingen konsert just nu – kom tillbaka en annan dag!') }),
  // förorten (v2-koordinater + SUB_DX)
  F('FÖRORTEN', 'lamell', 2200 + SX, 200, 452, 40, 84, subDoor({ x0: 2288, x1: 2312, type: 'swing' }), { sign: $t('BETONGVÄGEN 7'), icon: '🏢', soon: $t('Porten är låst och kodlåset är sönderslaget. Du bor inte här.') }),
  F('FÖRORTEN', 'husvagn', 2646 + SX, 48, 628, 22, 28, subDoor({ x0: 2656, x1: 2668, type: 'swing' }), { sign: $t('HUSVAGNEN'), icon: '🚐', enter: 'bostad:husvagn', homes: ['husvagn'], lot: 'vagnsplatsen' }),
  // (v4) Linnéstaden: SJÖBODEN – fiskrestaurangen på pålar ute i vattnet, vid pirens slut (water: står i kanalen)
  F('LINNÉSTADEN', 'sjoboden', -548, 108, 898, 44, 58, { x0: -508, x1: -484, type: 'swing' }, { sign: $t('SJÖBODEN'), icon: '🐟', open: [11, 23], enter: 'fiskkrog', water: true }),
];

// LINNÉSTADEN (v4): båda raderna väster om centrum (x −1200–0). Landshövdingehus och små
// butiker tätt ihop, MARKNADSGATAN (norra raden) och KAJGATAN/TRÄDGÅRDSGATAN (södra) leder till
// Marknadstorget mitt emellan gatorna. Husen ritas av js/city/buildings-linne.js.
const LN = (id, x, w, h, door, extra) => mk('n', 'LINNÉSTADEN', id, x, w, h, door, extra);
const LS = (id, x, w, h, door, extra) => mk('s', 'LINNÉSTADEN', id, x, w, h, door, extra);
const sw = (c) => ({ x0: c - 12, x1: c + 12, type: 'swing' });
export const BUILDINGS_L = [
  LN('l_hus1', -1192, 104, 124, sw(-1150), { sign: $t('LINNÉGATAN 3'), icon: '🏡', soon: $t('Ett gammalt landshövdingehus – stenvåning nertill och två våningar trä ovanpå. Här bor andra.') }),
  LN('l_kafe', -1072, 92, 104, sw(-1026), { sign: $t('KAFÉ LINDEN'), icon: '🧁', soon: $t('Kafé Linden öppnar snart – det luktar kanelbullar ända ut på gatan.') }),
  LN('l_gardsbutik', -964, 112, 108, sw(-908), { sign: $t('GÅRDSBUTIKEN'), icon: '🧺', soon: $t('Gårdsbutiken öppnar snart: ost, honung, bröd och grönsaker direkt från gårdarna.') }),
  LN('l_dekor', -796, 116, 112, sw(-738), { sign: $t('PYNT & TING'), icon: '🕯️', soon: $t('Pynt & Ting öppnar snart – kuddar, ljus, lampor och krimskrams till hemmet.') }),
  LN('l_bageri', -664, 88, 100, sw(-620), { sign: $t('BAGERIET'), icon: '🥖', soon: $t('Bageriet har sålt slut för i dag. Kom tillbaka i morgon bitti!') }),
  LN('l_hus2', -560, 112, 132, sw(-504), { sign: $t('LINNÉGATAN 11'), icon: '🏡', soon: $t('Ett landshövdingehus med blomlådor i varje fönster. Här bor andra.') }),
  LN('l_blommor', -432, 84, 96, sw(-390), { sign: $t('BLOMSTER'), icon: '💐', soon: $t('Blomsteraffären är full av höstblommor – men kassan är stängd just nu.') }),
  LN('l_hus3', -332, 120, 136, sw(-272), { sign: $t('LINNÉGATAN 17'), icon: '🏡', soon: $t('Huset med den stora väggmålningen. Här bor andra.') }),
  LN('l_antik', -196, 96, 104, sw(-148), { sign: $t('ANTIKVARIAT'), icon: '📚', soon: $t('Antikvariatet: gamla böcker från golv till tak. Ägaren läser och vill inte bli störd.') }),
  LN('l_hus4', -84, 84, 120, sw(-42), { sign: $t('LINNÉGATAN 23'), icon: '🏡', soon: $t('Ett smalt hus med en grön dörr. Här bor andra.') }),
  LS('ls_hus1', -1192, 112, 112, sw(-1136), { sign: $t('KAJGATAN 2'), icon: '🏡', soon: $t('Ett hus vid kajen med båtar utanför. Här bor andra.') }),
  LS('ls_glass', -1064, 80, 88, sw(-1000), { sign: $t('GLASSKIOSKEN'), icon: '🍦', soon: $t('Glasskiosken har stängt för säsongen – vi ses i vår!') }),
  LS('ls_loppis', -930, 100, 96, sw(-880), { sign: $t('LOPPISEN'), icon: '🧸', soon: $t('Loppisen öppnar på lördag – fynd i varenda låda.') }),
  LS('ls_hus2', -814, 120, 120, sw(-754), { sign: $t('KAJGATAN 8'), icon: '🏡', soon: $t('Ett landshövdingehus med cyklar på gården. Här bor andra.') }),
  LS('ls_cykel', -678, 80, 92, sw(-638), { sign: $t('CYKELVERKSTAN'), icon: '🚲', soon: $t('Cykelverkstan: "Tillbaka om fem minuter" står det på lappen.') }),
  LS('ls_hus3', -582, 120, 124, sw(-522), { sign: $t('KAJGATAN 14'), icon: '🏡', soon: $t('Ett hus med balkonger fulla av växter. Här bor andra.') }),
  LS('ls_hus4', -446, 100, 112, sw(-396), { sign: $t('KAJGATAN 18'), icon: '🏡', soon: $t('Ett gult hus med vita knutar. Här bor andra.') }),
  LS('ls_hus5', -292, 116, 120, sw(-234), { sign: $t('KAJGATAN 24'), icon: '🏡', soon: $t('Ett rött trähus med en katt i fönstret. Här bor andra.') }),
  LS('ls_hus6', -160, 120, 112, sw(-100), { sign: $t('KAJGATAN 30'), icon: '🏡', soon: $t('Ett hus med en liten trädgård bakom. Här bor andra.') }),
];
export const ALL_BUILDINGS = [...BUILDINGS, ...BUILDINGS_S, ...BUILDINGS_D, ...BUILDINGS_X, ...FREESTANDING, ...BUILDINGS_L];
export const buildingById = (id) => ALL_BUILDINGS.find((b) => b.id === id) || null;

// ---------------------------------------------------------------------
// Tomter: öppna, gåbara ytor. Marken målas av ground.js, staket/grejer
// (med hinder och grindar där gates anger) av props.js. row 'm' = mellanbandet.
// ---------------------------------------------------------------------
// förortens tomter anges i v2-koordinater och flyttas SUB_DX österut (rect, grindar, infart)
const subLot = (l) => ({
  ...l, rect: [l.rect[0] + SX, l.rect[1], l.rect[2] + SX, l.rect[3]],
  ...(l.gates ? { gates: l.gates.map((g) => (g.x0 !== undefined ? { ...g, x0: g.x0 + SX, x1: g.x1 + SX } : g)) } : {}),
  ...(l.drive ? { drive: [l.drive[0] + SX, l.drive[1] + SX] } : {}),
});
export const LOTS = [
  { id: 'kyrkogard', kind: 'kyrkogard', name: $n('KYRKOGÅRDEN'), district: 'SÖDER', row: 's', rect: [1000, CITY.FOOT_TOP_S, 1100, CITY.BASE_S], fence: true, // (krympt: Leksakslådan står på östra delen)
    gates: [{ side: 'n', x0: 1060, x1: 1080 }, { side: 's', x0: 1040, x1: 1060 }] },
  ...[
    { id: 'parkering', kind: 'parkering', name: $n('PARKERINGEN'), district: 'FÖRORTEN', row: 'm', rect: [1768, 318, 2000, 452], fence: false,
      drive: [1790, 1822] }, // infarten från Pixelgatan (bilar korsar trottoaren här)
    { id: 'lekplats_x', kind: 'lekplats_x', name: $n('LEKPLATSEN'), district: 'FÖRORTEN', row: 'm', rect: [2030, 334, 2170, 452], fence: true,
      gates: [{ side: 'n', x0: 2090, x1: 2106 }, { side: 's', x0: 2120, x1: 2136 }] },
    { id: 'grusplan', kind: 'grusplan', name: $n('GRUSPLANEN'), district: 'FÖRORTEN', row: 'm', rect: [2430, 318, 2704, 452], fence: true,
      gates: [{ side: 'n', x0: 2560, x1: 2576 }, { side: 's', x0: 2450, x1: 2466 }, { side: 'w', y0: 380, y1: 396 }] }, // w = hål i stängslet
    { id: 'tomten', kind: 'tomten', name: $n('TOMTEN'), district: 'FÖRORTEN', row: 'n', rect: [2632, CITY.FOOT_TOP, 2712, CITY.BASE], fence: true,
      gates: [{ side: 's', x0: 2660, x1: 2680 }] },
    { id: 'atervinning', kind: 'atervinning', name: $n('ÅTERVINNINGEN'), district: 'FÖRORTEN', row: 's', rect: [2288, CITY.FOOT_TOP_S, 2380, CITY.BASE_S], fence: false },
    { id: 'vagnsplatsen', kind: 'vagnsplatsen', name: $n('VAGNSPLATSEN'), district: 'FÖRORTEN', row: 's', rect: [2628, CITY.FOOT_TOP_S, 2712, CITY.BASE_S], fence: false },
  ].map(subLot),
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
  const NAMES = [$n('PARKGATAN'), $n('TORGGATAN'), $n('FABRIKSGATAN')];
  let n = 0;
  edges.forEach(([x0, x1], i) => {
    const edge = (i === 0 && !(CITY.X0 < 0)) || i === edges.length - 1;   // (v4: väster om x 0 ligger Linnéstaden)
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
  { 260: $n('POSTGATAN'), 816: $n('KYRKOGATAN'), 1212: $n('VÅRDGATAN') }, !(CITY.X0 < 0), false);
// Linnéstaden (v4): båda raderna väster om centrum – världens kant längst västerut.
export const STREETS_L = [
  ...gapsOf('n', CITY.X0, 0, BUILDINGS_L.filter((b) => b.row === 'n'), { [-852]: $n('MARKNADSGATAN') }, true, false),
  ...gapsOf('s', CITY.X0, 0, BUILDINGS_L.filter((b) => b.row === 's'), { [-984]: $n('KAJGATAN'), [-346]: $n('TRÄDGÅRDSGATAN') }, true, false),
];
// Downtown (v3): båda raderna mellan Infarten och floden. BANKGATAN i båda raderna
// (norra: tvärgata, södra: gågata); den sista luckan (2384–2400) leder ner till kajen.
export const STREETS_D = [
  ...gapsOf('n', CITY.X_DT, RX0, BUILDINGS_D.filter((b) => b.row === 'n'), { 2080: $n('BANKGATAN') }, false, false),
  ...gapsOf('s', CITY.X_DT, RX0, BUILDINGS_D.filter((b) => b.row === 's'), { 2080: $n('BANKGATAN') }, false, false),
];
// Förorten: båda raderna öster om floden, plus Infarten själv i båda raderna.
export const STREETS_X = [
  { x0: CITY.INFARTEN[0], x1: CITY.INFARTEN[1], y0: CITY.BACK[1], y1: CITY.BASE, kind: 'street', name: $n('INFARTEN'), row: 'n', road: 'infarten' },
  ...gapsOf('n', CITY.X_SUB, CITY.W, [...BUILDINGS_X.filter((b) => b.row === 'n'), ...LOTS.filter((l) => l.row === 'n')], { [2236 + SX]: $n('BETONGGATAN') }, false, true),
  { x0: CITY.INFARTEN[0], x1: CITY.INFARTEN[1], y0: CITY.BACK_S[1], y1: CITY.BASE_S, kind: 'road', name: $n('INFARTEN'), row: 's', road: 'infarten' },
  ...gapsOf('s', CITY.X_SUB, CITY.W, [...BUILDINGS_X.filter((b) => b.row === 's'), ...LOTS.filter((l) => l.row === 's' && l.district === 'FÖRORTEN')], { [2236 + SX]: $n('BETONGGATAN') }, false, true),
];
export const STREETS_ALL = [...STREETS, ...STREETS_S, ...STREETS_D, ...STREETS_X, ...STREETS_L];

// ---------------------------------------------------------------------
// Övergångsställen. i är unikt över ALLA: CROSSWALKS_ALL[i].i === i.
// road = vägen som korsas; x0..x1 × y0..y1 = zebraytan; lights = trafikljus;
// broken = ljusen blinkar gult (förorten). stop = stopplinjen per körriktning
// (x för vågräta vägar, y för Infarten).
// ---------------------------------------------------------------------
const cwX = (i, x0, x1, name, road, y0, y1, extra) => ({ i, x0, x1, name, road, y0, y1, lights: true, stop: { 1: x0 - 3, '-1': x1 + 3 }, ...extra });
// Pixelgatan (v1: i 0–2 oförändrade; v2 lägger till Infarten och Betonggatan; v3 Bankgatan).
// Nya övergångsställen får NÄSTA lediga i (trafiken slår upp Infartens zebror som i 8 och 9)
// och läggs SIST i sin väglista (props.js läser CROSSWALKS_S[0] och [1] på index).
export const CROSSWALKS = [
  ...STREETS.filter((s) => s.kind === 'street').map((s, i) => cwX(i, s.x0, s.x1, s.name, 'pixelgatan', CITY.ROAD[0], CITY.ROAD[1])),
  cwX(3, CITY.INFARTEN[0], CITY.INFARTEN[1], $n('INFARTEN'), 'pixelgatan', CITY.ROAD[0], CITY.ROAD[1]),
  cwX(4, 2236 + SX, 2288 + SX, $n('BETONGGATAN'), 'pixelgatan', CITY.ROAD[0], CITY.ROAD[1], { broken: true }),
  cwX(10, 2080, 2128, $n('BANKGATAN'), 'pixelgatan', CITY.ROAD[0], CITY.ROAD[1]),
  cwX(12, -852, -796, $n('MARKNADSGATAN'), 'pixelgatan', CITY.ROAD[0], CITY.ROAD[1]),   // (v4) Linnéstaden: över till torget
];
// Södergatan.
export const CROSSWALKS_S = [
  cwX(5, 260, 312, $n('POSTGATAN'), 'sodergatan', CITY.ROAD_S[0], CITY.ROAD_S[1]),
  cwX(6, 816, 868, $n('KYRKOGATAN'), 'sodergatan', CITY.ROAD_S[0], CITY.ROAD_S[1]),
  cwX(7, CITY.INFARTEN[0], CITY.INFARTEN[1], $n('INFARTEN'), 'sodergatan', CITY.ROAD_S[0], CITY.ROAD_S[1]),
  cwX(11, 2080, 2128, $n('BANKGATAN'), 'sodergatan', CITY.ROAD_S[0], CITY.ROAD_S[1]),
  cwX(13, -984, -930, $n('KAJGATAN'), 'sodergatan', CITY.ROAD_S[0], CITY.ROAD_S[1]),    // (v4) Linnéstaden: ner till kajen
];
// Infarten: zebror där trottoarerna korsar vägen (inga ljus – bilarna väjer).
export const CROSSWALKS_I = [
  { i: 8, x0: CITY.INFARTEN[0], x1: CITY.INFARTEN[1], y0: 282, y1: 302, name: $n('INFARTEN'), road: 'infarten', lights: false, stop: { 1: 279, '-1': 305 } },
  { i: 9, x0: CITY.INFARTEN[0], x1: CITY.INFARTEN[1], y0: 646, y1: 666, name: $n('INFARTEN'), road: 'infarten', lights: false, stop: { 1: 643, '-1': 669 } },
];
export const CROSSWALKS_ALL = [...CROSSWALKS, ...CROSSWALKS_S, ...CROSSWALKS_I].sort((a, b) => a.i - b.i);

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
// Nya hållplatser läggs SIST (props.js ritar kurerna på index: BUS_STOPS[1], [2], [3], [4] …).
export const BUS_STOPS = [
  stop('pixeltorget', $n('PIXELTORGET'), 'CENTRUM', 610, CITY.SIDEWALK_S[1] - 3, 'pixelgatan', 1),
  stop('flygplatsen', $n('FLYGPLATSEN'), 'CENTRUM', 1626, CITY.SIDEWALK_S[1] - 3, 'pixelgatan', 1),
  stop('soderkyrkan', $n('SÖDERKYRKAN'), 'SÖDER', 1106, CITY.SIDEWALK_SS[1] - 3, 'sodergatan', 1),
  stop('betongtorget', $n('BETONGTORGET'), 'FÖRORTEN', 2010 + SX, CITY.SIDEWALK_S[1] - 3, 'pixelgatan', 1, { broken: true }),
  stop('finanstorget', $n('FINANSTORGET'), 'DOWNTOWN', 2232, CITY.SIDEWALK_S[1] - 3, 'pixelgatan', 1),
  stop('marknadstorget', $n('MARKNADSTORGET'), 'LINNÉSTADEN', -560, CITY.SIDEWALK_S[1] - 3, 'pixelgatan', 1),   // (v4)
];
// v1: busshållplatsen i centrum (samma objektform som förut).
export const BUS_STOP = { x: BUS_STOPS[0].x, y: BUS_STOPS[0].y };
export const busStopById = (id) => BUS_STOPS.find((s) => s.id === id || s.name === id) || null;

// ---------------------------------------------------------------------
// Vägarna – trafiken använder ROADS. axis 'x' = vågrät väg (lanes: { dir, y }),
// axis 'y' = lodrät väg (lanes: { dir, x }). traffic: 'full' | 'light'.
// ---------------------------------------------------------------------
export const ROADS = [
  { id: 'pixelgatan', name: $n('PIXELGATAN'), axis: 'x', x0: CITY.X0, x1: CITY.W, y0: CITY.ROAD[0], y1: CITY.ROAD[1], lanes: LANES, traffic: 'full',
    crosswalks: CROSSWALKS, lights: LIGHTS, stops: BUS_STOPS.filter((s) => s.road === 'pixelgatan') },
  { id: 'sodergatan', name: $n('SÖDERGATAN'), axis: 'x', x0: CITY.X0, x1: CITY.W, y0: CITY.ROAD_S[0], y1: CITY.ROAD_S[1], lanes: LANES_S, traffic: 'full',
    crosswalks: CROSSWALKS_S, lights: LIGHTS_S, stops: BUS_STOPS.filter((s) => s.road === 'sodergatan') },
  { id: 'infarten', name: $n('INFARTEN'), axis: 'y', x0: CITY.INFARTEN[0], x1: CITY.INFARTEN[1], y0: CITY.ROAD[1], y1: CITY.ROAD_S[0], lanes: LANES_I, traffic: 'light',
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
  paths: [[2004 + SX, CITY.SIDEWALK_S[1], 2026 + SX, CITY.BACK_S[0]]],
};
// Downtowns mellanband (v3): FINANSTORGET – ett stenlagt torg från Infartens trottoar
// till kajen, gåbart överallt. Rekvisitan (props.js) ställer statyn, fontänerna,
// träden i planteringslådor, bänkarna, flaggstängerna och lyktorna här; livet
// (life.js) lägger gånglinjer/noder över torget. axis = Bankgatans mittlinje.
// back = bakgatan bakom den södra raden (leveranser, soptunnor, cyklar).
// behind = ytor bakom de två höga tornen i södra raden (PIXEL TOWER och GLASTORNET): tornens
// bilder reser sig över torgets södra kant och bakgatan, så en figur där syns inte (eller bara
// med huvudet). Ytorna är hinder – man går fram till tornet men aldrig in bakom det.
//   PIXEL TOWER: glaspyramiden (spets y 428 mitt på tornet, 1,45 px bredare per rad, full bredd
//   från y 468) – trappat i 4-px-rader så att fötterna aldrig hamnar mer än ~6 px bakom glaset.
//   GLASTORNET: krönet ligger på y ≈ 422 över hela bredden.
const behindPyramid = (x0, x1, apexY, fullY) => {
  const cx = (x0 + x1) >> 1, out = [];
  for (let y = apexY + 8; y < fullY + 6; y += 4) {
    const hw = Math.round(2 + (y - 6 - apexY) * 1.45);
    out.push([Math.max(x0, cx - hw), y, Math.min(x1, cx + hw), y + 4]);
  }
  out.push([x0, fullY + 6, x1, CITY.FOOT_TOP_S]);
  return out;
};
export const DOWNTOWN_LAYOUT = {
  plaza: [1766, CITY.PARK[0], RX0, CITY.BACK_S[0]],
  axis: 2104,
  statue: { x: 2104, y: 392 },                                 // TJUREN (bronsstatyn) mitt på torget
  fountains: [{ x: 1936, y: 396 }, { x: 2272, y: 396 }],       // två fontäner symmetriskt kring axeln
  back: [1766, CITY.BACK_S[0], RX0, CITY.BACK_S[1]],
  behind: [
    ...behindPyramid(1768, 1888, 428, 468),                    // PIXEL TOWER (kontor3)
    [2248, 428, 2384, CITY.FOOT_TOP_S],                        // GLASTORNET (kontor4)
  ],
};
// Linnéstadens mellanband (v4): MARKNADSTORGET i mitten (stenlagt, gåbart överallt – marknaden
// ställer sina stånd här), STADSODLINGEN i väster (pallkragar = hinder, barkgångar) och
// LINDPARKEN i öster (gräsmatta, rabatter, musikpaviljongen) som möter centrums park vid x 0.
// back = parkgången bakom den södra raden (grus, fortsätter centrums parkgång).
const LB = (i, j) => [-1180 + i * 48, 330 + j * 30, -1144 + i * 48, 344 + j * 30];
export const LINNE_LAYOUT = {
  torg: [-1024, CITY.PARK[0], -464, CITY.BACK_S[0]],
  well: { x: -744, y: 384 },                                   // brunnen mitt på torget
  odling: [-1196, 318, -1036, 452],
  beds: [0, 1, 2].flatMap((i) => [0, 1, 2].map((j) => LB(i, j))),      // pallkragarna (3 × 3; nedanför: boden, tunnan, solrosorna)
  shed: [-1196, 318, -1176, 326],                              // (redskapsboden står i rekvisitan)
  green: [-464, CITY.PARK[0], 0, CITY.BACK_S[0]],
  promenade: [-464, 334, 0, 346],                              // grusgången in mot centrums promenad
  walks: [[-330, 346, -308, CITY.BACK_S[0]], [-1036, 346, -1024, 358]],
  pavilion: { x: -168, y: 400, rx: 34, ry: 18 },               // musikpaviljongen (gruscirkel)
  beds2: [[-440, 356, -380, 366], [-286, 356, -218, 366], [-120, 356, -40, 366], [-440, 432, -360, 444], [-110, 432, -24, 444]], // rabatterna
  back: [CITY.X0, CITY.BACK_S[0], 0, CITY.BACK_S[1]],
};
// (v4) PIREN i Linnéstaden: en träpir från kajen rakt ut i vattnet ner till bryggan (uteserveringen)
// framför SJÖBODEN. gap = öppningen i kajräcket. Bryggan och piren är gåbara; vattnet runt om är hinder.
// (v0.93: bryggan går längre ut åt väster – en utsiktsplats med bänkar, däckstolar och kikare)
export const PIER = {
  walk: [-424, CITY.QUAY[0] + 6, -392, 944],
  deck: [-760, 898, -392, 944],
  gap: [-424, CITY.QUAY[0], -392, CITY.QUAY[0] + 14],
};
// Trottoarerna längs Infarten genom mellanbandet (väster: bara till parkgången – där står macken).
const INFART_WALKS = [[1686, CITY.SIDEWALK_S[1], 1700, CITY.BACK_S[1]], [1752, CITY.SIDEWALK_S[1], 1766, CITY.BASE_S]];

// Alla gångar med ytans slag (för marken/livet/vädret). PATH_RECTS = bara rektanglarna.
// kind: 'grus' | 'asfalt' | 'trottoar' | 'torg' (stenlagt torg – rekvisita FÅR stå där) | 'kaj'
export const PATHS = [
  { rect: PARK_LAYOUT.promenade, kind: 'grus', district: 'PARKEN' },
  ...PARK_LAYOUT.paths.map((r) => ({ rect: r, kind: 'grus', district: 'PARKEN' })),
  ...PARK_LAYOUT.walks.map((r) => ({ rect: r, kind: 'grus', district: 'PARKEN' })),
  { rect: PARK_LAYOUT.back, kind: 'grus', district: 'PARKEN' },
  { rect: SUB_LAYOUT.back, kind: 'asfalt', district: 'FÖRORTEN' },
  ...SUB_LAYOUT.paths.map((r) => ({ rect: r, kind: 'asfalt', district: 'FÖRORTEN' })),
  { rect: INFART_WALKS[0], kind: 'trottoar', district: 'CENTRUM' },
  { rect: INFART_WALKS[1], kind: 'trottoar', district: 'DOWNTOWN' },
  { rect: DOWNTOWN_LAYOUT.plaza, kind: 'torg', district: 'DOWNTOWN' },
  { rect: DOWNTOWN_LAYOUT.back, kind: 'asfalt', district: 'DOWNTOWN' },
  { rect: LINNE_LAYOUT.torg, kind: 'torg', district: 'LINNÉSTADEN' },
  { rect: LINNE_LAYOUT.promenade, kind: 'grus', district: 'LINNÉSTADEN' },
  ...LINNE_LAYOUT.walks.map((r) => ({ rect: r, kind: 'grus', district: 'LINNÉSTADEN' })),
  { rect: LINNE_LAYOUT.back, kind: 'grus', district: 'LINNÉSTADEN' },
  { rect: PIER.walk, kind: 'brygga', district: 'LINNÉSTADEN' },
  { rect: PIER.deck, kind: 'brygga', district: 'LINNÉSTADEN' },
  // kajerna – delade vid Pixelgatan och Södergatan (körbanorna är väg, inte gång; man korsar dem på broarnas trottoarer)
  ...[RIVER.quayW, RIVER.quayE].flatMap((q) => [[q[1], CITY.ROAD[0]], [CITY.ROAD[1], CITY.ROAD_S[0]], [CITY.ROAD_S[1], q[3]]]
    .map(([y0, y1]) => ({ rect: [q[0], y0, q[2], y1], kind: 'kaj', district: 'FLODEN' }))),
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
export const CANAL_RECT = [CITY.X0 || 0, CITY.WALK_BOTTOM + 2, CITY.W, CITY.H];

// ---------------------------------------------------------------------
// Stadsdelarna. rects = ytor (första träffen vinner), worn 0–1 = hur slitet
// allt ska ritas, tag = undertext på områdesskylten, spawn = bra plats att stå på.
// ---------------------------------------------------------------------
const XM = (CITY.INFARTEN[0] + CITY.INFARTEN[1]) / 2; // gränsen går mitt i Infarten
const YB = (CITY.BACK_S[0] + CITY.BACK_S[1]) >> 1;      // floden: Stora bron norr om parkgången, Järnbron söder om den
export const DISTRICTS = [
  { id: 'centrum', name: $n('CENTRUM'), tag: $t('BUTIKER OCH JOBB PÅ PIXELGATAN'), rects: [[0, 0, XM, CITY.PARK[0]]], worn: 0, spawn: { x: 640, y: 296 } },
  { id: 'parken', name: $n('PARKEN'), tag: $t('FONTÄNEN, DAMMEN OCH LEKPLATSEN'), rects: [[0, CITY.PARK[0], XM, CITY.BACK_S[1]]], worn: 0, spawn: { x: 934, y: 420 } },
  { id: 'soder', name: $n('SÖDER'), tag: $t('KYRKAN, BION OCH BIBLIOTEKET'), rects: [[0, CITY.BACK_S[1], XM, CITY.H]], worn: 0, spawn: { x: 934, y: 660 } },
  { id: 'downtown', name: $n('DOWNTOWN'), tag: $t('HÖGA HUS, BANKER OCH KOSTYMER'), rects: [[XM, 0, RX0, CITY.H]], worn: 0, spawn: { x: 2104, y: 296 } },
  { id: 'bron', name: $n('STORA BRON'), tag: $t('HÄNGBRON ÖVER PIXELFLODEN'), rects: [[RX0, 0, RX1, YB]], worn: 0, spawn: { x: 2716, y: 291 } },
  { id: 'jarnbron', name: $n('JÄRNBRON'), tag: $t('SÖDERGATAN ÖVER PIXELFLODEN'), rects: [[RX0, YB, RX1, CITY.H]], worn: 0, spawn: { x: 2716, y: 745 } },
  { id: 'fororten', name: $n('FÖRORTEN'), tag: $t('BETONG, GRAFFITI OCH BILLIGA HYROR'), rects: [[RX1, 0, CITY.W, CITY.H]], worn: 1, spawn: { x: 2040 + SX, y: 296 } },
  { id: 'linne', name: $n('LINNÉSTADEN'), tag: $t('TORGET, MARKNADEN OCH SMÅ BUTIKER'), rects: [[CITY.X0, 0, 0, CITY.H]], worn: 0, spawn: { x: -560, y: 296 } },
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
// dammen, kanalen och (v3) floden: vattnet, kajräckena, broräckena och tornens ben/mittpelare.
// Scenen lägger till modulernas hinder (props, trafik, liv, bron).
// (v4) vattnet som hinder: kanalen utom piren, bryggan och Sjöbodens fotavtryck
function subtractRects(base, cuts) {
  let rs = [base];
  for (const c of cuts) {
    const out = [];
    for (const r of rs) {
      if (!(c[0] < r[2] && c[2] > r[0] && c[1] < r[3] && c[3] > r[1])) { out.push(r); continue; }
      if (r[1] < c[1]) out.push([r[0], r[1], r[2], c[1]]);
      if (c[3] < r[3]) out.push([r[0], c[3], r[2], r[3]]);
      const y0 = Math.max(r[1], c[1]), y1 = Math.min(r[3], c[3]);
      if (r[0] < c[0]) out.push([r[0], y0, c[0], y1]);
      if (c[2] < r[2]) out.push([c[2], y0, r[2], y1]);
    }
    rs = out;
  }
  return rs;
}
export const CANAL_WATER = subtractRects(CANAL_RECT, [PIER.walk, PIER.deck, ...ALL_BUILDINGS.filter((b) => b.water).map(footprint)]);
export const BRIDGE_OBSTACLES = BRIDGES.flatMap((b) => [...b.rails, ...b.towers.flatMap((t) => [...t.legs, ...(t.pier ? [t.pier] : [])])]);
export const MAP_OBSTACLES = [
  ...ALL_BUILDINGS.map(footprint),
  ...ALL_BUILDINGS.flatMap((b) => b.blocks || []),
  ...WATER,
  ...CANAL_WATER,
  ...RIVER.water,
  ...RIVER.rails,
  ...BRIDGE_OBSTACLES,
  ...DOWNTOWN_LAYOUT.behind,                                  // bakom downtowns höga torn (syns inte där)
  ...LINNE_LAYOUT.beds,                                       // (v4) stadsodlingens pallkragar
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
  [CITY.X0, CITY.ROAD[0], CITY.W, CITY.ROAD[1]],                             // Pixelgatan
  ...BUILDINGS.map(doorFront),                                               // framför dörrarna
  ...CROSSWALKS.map((c) => [c.x0 - 6, CITY.SIDEWALK_N[0], c.x1 + 6, CITY.SIDEWALK_N[1]]),
  ...CROSSWALKS.map((c) => [c.x0 - 6, CITY.SIDEWALK_S[0], c.x1 + 6, CITY.SIDEWALK_S[1]]),
  ...LIGHTS.map((l) => [l.x - 6, l.y - 8, l.x + 6, l.y + 3]),
  ...PATHS.filter((p) => p.kind !== 'torg').map((p) => p.rect),              // gångarna (torget får möbleras)
  // --- v2 ---
  [CITY.X0, CITY.ROAD_S[0], CITY.W, CITY.ROAD_S[1]],                         // Södergatan
  [1100, CITY.SIDEWALK_SN[0], 1212, CITY.SIDEWALK_SN[0] + 24],                // Leksakslådans skyltfönster och dörr
  [622, CITY.BASE, 660, CITY.BASE + 14],                                     // KLÄDERS trottoarskylt (JULEN · PLAN 3)
  [CITY.INFARTEN[0], CITY.ROAD[0], CITY.INFARTEN[1], CITY.ROAD_S[1]],        // Infarten
  ...[...BUILDINGS_S, ...BUILDINGS_D, ...BUILDINGS_X, ...FREESTANDING].flatMap((b) => [footprint(b), doorFront(b), ...(b.blocks || []), ...(b.yard ? [b.yard.rect] : [])]),
  // --- v3 ---
  [RX0, 0, RX1, CITY.H],                                                     // hela flodrummet: bara bridge.js ställer saker där
  ...DOWNTOWN_LAYOUT.behind,                                                 // bakom de höga tornen (skyms ändå)
  ...CROSSWALKS_S.flatMap((c) => sidewalkEnds(c, CITY.SIDEWALK_SN, CITY.SIDEWALK_SS)),
  ...LIGHTS_S.map((l) => [l.x - 6, l.y - 8, l.x + 6, l.y + 3]),
  ...LOTS.flatMap((l) => (l.gates || []).map((g) => gateRect(l, g))),
  ...LOTS.filter((l) => l.drive).map((l) => [l.drive[0], CITY.SIDEWALK_S[0], l.drive[1], l.rect[1]]),
  ...BUS_STOPS.slice(1).map((s) => [s.x - 24, s.y - 18, s.x + 24, s.y + 3]),  // skjulen (v1-skjulet sköter rekvisitan själv)
  [PARK_LAYOUT.pond.cx - PARK_LAYOUT.pond.rx - 2, PARK_LAYOUT.pond.cy - PARK_LAYOUT.pond.ry - 2,
    PARK_LAYOUT.pond.cx + PARK_LAYOUT.pond.rx + 2, PARK_LAYOUT.pond.cy + PARK_LAYOUT.pond.ry + 2],
  [PARK_LAYOUT.dogGate[0], PARK_LAYOUT.dogPark[1] - 6, PARK_LAYOUT.dogGate[1], PARK_LAYOUT.dogPark[1] + 6],
  [CITY.X0, CITY.QUAY[0] + 8, CITY.W, CITY.H],                               // räcket och kanalen
  // --- v4: Linnéstaden ---
  ...BUILDINGS_L.flatMap((b) => [footprint(b), doorFront(b)]),
  ...LINNE_LAYOUT.beds.map((r) => [r[0] - 3, r[1] - 3, r[2] + 3, r[3] + 3]),
  [LINNE_LAYOUT.well.x - 20, LINNE_LAYOUT.well.y - 12, LINNE_LAYOUT.well.x + 20, LINNE_LAYOUT.well.y + 8],
  ...LINNE_LAYOUT.walks, LINNE_LAYOUT.promenade,
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

// Alla enter-värden som scenen (city.js enter()) känner. Scennamnen i andra raden leder in i en egen
// scen (city.js SCENE_DOORS → main.js): butikerna i downtown, Pixelhögskolan, bion, kebaben, pantbanken och garaget.
export const ENTER_RE = new RegExp('^(hem|bostad|mat|klader|mobler|kafe|djur|burgare|frukt|flyg|glass|narbutik|leksaker'
  + '|bank|elektronik|frisor|skor|accessoarer|universitet|bio|kebab|pantbank|fordon|maskerad|fiskkrog'
  + '|jobb:[a-z]+|bostad:[a-z]+)$');

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
  const river = [RX0, 0, RX1, CITY.H], wet = [...RIVER.water, ...CANAL_WATER];
  for (const b of ALL_BUILDINGS) {
    const fp = footprint(b), df = doorFront(b);
    if (b.door.x0 < b.x || b.door.x1 > b.x + b.w) out.push(`${b.id}: dörren ligger utanför fasaden`);
    for (const [id, r] of roads) if (hit(fp, r)) out.push(`${b.id} står på vägen ${id}`);
    for (const r of PATH_RECTS) if (hit(fp, r)) out.push(`${b.id} står på en gång ${r.join(',')}`);
    if (hit(fp, pond)) out.push(`${b.id} står i dammen`);
    for (const [id, o] of fps) if (id !== b.id && hit(df, o)) out.push(`dörren till ${b.id} blockeras av ${id}`);
    for (const o of blocks) if (hit(df, o)) out.push(`dörren till ${b.id} blockeras av ett block`);
    if (fp[0] < (CITY.X0 || 0) || fp[2] > CITY.W || fp[1] < CITY.BACK[1] || (fp[3] >= CITY.QUAY[0] && !b.water) || fp[3] >= CITY.H) out.push(`${b.id} sticker ut ur världen`);
    if (!DISTRICTS.some((d) => d.name === b.district)) out.push(`${b.id}: okänd stadsdel ${b.district}`);
    if (b.row === 's' && (b.top !== CITY.FOOT_TOP_S || b.base > CITY.BASE_S || b.base < CITY.FOOT_TOP_S + 60)) out.push(`${b.id}: fel base/top för södra raden`);
    if (b.row === 'n' && (b.top !== CITY.FOOT_TOP || b.base !== CITY.BASE)) out.push(`${b.id}: fel base/top för norra raden`);
    if (b.enter && !ENTER_RE.test(b.enter)) out.push(`${b.id}: okänd enter ${b.enter}`);
    if (!DOOR_TYPES.includes(b.door.type)) out.push(`${b.id}: okänd dörrtyp ${b.door.type}`);
    if (!b.enter && !b.soon && !b.sign) out.push(`${b.id}: varken enter, soon eller skylt – klicket säger ingenting`);
    // v3: ingenting står i flodrummet, och ingen dörr öppnas mot vattnet
    if (hit(fp, river)) out.push(`${b.id} står i floden`);
    for (const r of wet) if (hit(df, r)) out.push(`dörren till ${b.id} öppnas mot vattnet`);
  }
  for (const l of LOTS) for (const b of ALL_BUILDINGS) if (b.lot !== l.id && hit(l.rect, footprint(b))) out.push(`tomten ${l.id} överlappar ${b.id}`);
  for (const l of LOTS) if (hit(l.rect, river)) out.push(`tomten ${l.id} ligger i floden`);
  const ids = new Set();
  for (const b of ALL_BUILDINGS) { if (ids.has(b.id)) out.push(`dubbelt id ${b.id}`); ids.add(b.id); }
  CROSSWALKS_ALL.forEach((c, k) => { if (c.i !== k) out.push(`övergångsställe ${k} har i=${c.i}`); });
  for (const c of CROSSWALKS_ALL) if (hit([c.x0, c.y0, c.x1, c.y1], river)) out.push(`övergångsstället ${c.name} ligger på en bro`);
  for (const l of LIGHTS_ALL) for (const [id, fp] of fps) if (hit([l.x - 2, l.y - 2, l.x + 2, l.y + 1], fp)) out.push(`trafikljuset vid övergångsställe ${l.crosswalk} står i ${id}`);
  for (const s of BUS_STOPS) {
    for (const [id, fp] of fps) if (hit([s.x - 24, s.y - 14, s.x + 24, s.y + 2], fp)) out.push(`busshållplatsen ${s.id} står i ${id}`);
    for (const [id, r] of roads) if (hit([s.x - 24, s.y - 1, s.x + 24, s.y + 1], r)) out.push(`busshållplatsen ${s.id} står på vägen ${id}`);
    if (hit([s.x - 60, s.y - 14, s.x + 90, s.y + 2], river)) out.push(`busshållplatsen ${s.id} (eller bussens stoppyta) ligger på en bro`);
    if (!DISTRICTS.some((d) => d.name === s.district)) out.push(`busshållplatsen ${s.id}: okänd stadsdel ${s.district}`);
  }
  // floden: varje vågrät väg som korsar floden har en bro vars gåbara däck täcker vägen + trottoarerna,
  // däcken ligger aldrig i vattnet, och vattnet + räckena + däcken täcker hela vattenbredden
  for (const r of ROADS) {
    if (r.axis !== 'x' || r.x1 <= RX0 || r.x0 >= RX1) continue;
    const br = BRIDGES.find((b) => b.road === r.id);
    if (!br) out.push(`vägen ${r.id} korsar floden utan bro`);
    else if (br.walk[1] > r.y0 || br.walk[3] < r.y1) out.push(`bron ${br.id} täcker inte vägen ${r.id}`);
  }
  for (const b of BRIDGES) {
    for (const r of RIVER.water) if (hit(b.walk, r)) out.push(`bron ${b.id}: däcket ligger i vattnet`);
    for (const t of b.towers) if (t.legs.some((l) => hit(l, b.walk))) out.push(`bron ${b.id}: ett tornben står på däcket`);
  }
  for (let y = 0; y < CITY.H; y += 2) {
    const n = [...RIVER.water, ...BRIDGES.flatMap((b) => [b.walk, ...b.rails])].filter((r) => y >= r[1] && y < r[3] && r[0] <= RIVER.wx0 && r[2] >= RIVER.wx1).length;
    if (n !== 1) { out.push(`floden vid y ${y}: ${n ? 'dubbelt' : 'hål'} (vatten/däck/räcke ska täcka vattenbredden exakt en gång)`); break; }
  }
  // gångarna (PATHS) går aldrig över en körbana – där korsar man på övergångsställen och broarnas trottoarer
  for (const p of PATHS) for (const [id, r] of roads) if (hit(p.rect, r)) out.push(`gången ${p.kind} ${p.rect.join(',')} korsar vägen ${id}`);
  // ytorna bakom downtowns torn: inga dörrar, hållplatser eller gångar där
  for (const r of DOWNTOWN_LAYOUT.behind) {
    for (const b of ALL_BUILDINGS) if (hit(r, doorFront(b))) out.push(`dörren till ${b.id} ligger bakom ett torn`);
    for (const p of PATHS) if (p.kind !== 'torg' && p.kind !== 'asfalt' && hit(r, p.rect)) out.push(`gången ${p.rect.join(',')} ligger bakom ett torn`);
  }
  if (CITY.W > 4000 || (CITY.X0 || 0) < -1200) out.push(`världen är ${CITY.X0}–${CITY.W} – net/world.js klämmer spelarnas x till −1200–4000`);
  if (CITY.X_SUB !== RX1) out.push('X_SUB ska vara flodens östra kant (CITY.RIVER[1])');
  for (let y = 0; y < CITY.H; y += 20) for (let x = CITY.X0 || 0; x < CITY.W; x += 20) if (!DISTRICTS.some((d) => d.rects.some((r) => inRect(x, y, r)))) { out.push(`(${x},${y}) hör inte till någon stadsdel`); break; }
  return out;
}
