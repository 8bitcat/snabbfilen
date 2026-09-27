// Pixelstadens karta – KONTRAKTET som alla stadsmoduler delar.
// Allt i världskoordinater, samma pixelkorn som resten av spelet
// (1 enhet = 1 spelpixel; en figur är ~24×40). Kameran visar 384×216.
//
// Genomskärning uppifrån och ner (y):
//   8–36    bakgatan bakom husen (gåbar, syns i gränderna)
//   40–186  husraden: fasaderna står på y = BASE, taken sticker upp bakåt
//   186–218 norra trottoaren (dörrarna öppnas mot den)
//   218–276 bilvägen: övre körfältet västerut, undre österut
//   276–306 södra trottoaren
//   306–420 parken/torget
// Mellan husen går gränder (28 px) och tvärgator (52 px) från bakgatan ner
// till vägen. Vid tvärgatorna finns övergångsställen med trafikljus.

export const CITY = {
  W: 1700, H: 420,
  VIEW_W: 384, VIEW_H: 216,
  BACK: [8, 36],
  BASE: 186,
  SIDEWALK_N: [186, 218],
  ROAD: [218, 276],
  SIDEWALK_S: [276, 306],
  PARK: [306, 420],
  FOOT_TOP: 40, // husens fotavtryck börjar här (bakgatan är fri ovanför)
};

// Körfälten: y = hjulens markkontakt. dir −1 = västerut (bilen vänd åt vänster).
export const LANES = [
  { dir: -1, y: 244 },
  { dir: 1, y: 271 },
];

// Husen längs norra trottoaren. h = fasadens höjd ovanför BASE (taket
// kommer utöver det). door = dörröppningen i fasaden (x0..x1, världs-x),
// type 'slide' = skjutbara glasdörrar, 'swing' = vanlig dörr.
// enter = vad som händer när man går in (null = går inte att gå in).
const B = (id, x, w, h, door, extra) => ({ id, kind: id, x, w, h, door, ...extra });
export const BUILDINGS = [
  B('hem', 16, 120, 132, { x0: 64, x1: 88, type: 'swing' }, { sign: 'PIXELGATAN 1', enter: 'hem' }),
  B('bostad', 164, 96, 100, { x0: 200, x1: 224, type: 'swing' }, { sign: 'BOSTADSBYRÅN', enter: 'bostad', open: [7, 20] }),
  B('mat', 312, 196, 104, { x0: 388, x1: 432, type: 'slide' }, { sign: 'STORMARKNAD', enter: 'mat', open: [7, 23] }),
  B('klader', 536, 124, 112, { x0: 586, x1: 610, type: 'swing' }, { sign: 'KLÄDER', enter: 'klader', open: [7, 21] }),
  B('mobler', 688, 220, 116, { x0: 776, x1: 820, type: 'slide' }, { sign: 'MÖBELJÄTTEN', enter: 'mobler', open: [7, 21] }),
  B('kafe', 960, 92, 92, { x0: 994, x1: 1018, type: 'swing' }, { sign: 'KAFÉ', enter: null }),
  B('burgare', 1080, 132, 100, { x0: 1134, x1: 1158, type: 'swing' }, { sign: 'BURGARBAREN', enter: 'burgare', open: [7, 23] }),
  B('frukt', 1264, 160, 118, { x0: 1330, x1: 1356, type: 'swing' }, { sign: 'FRUKTFABRIKEN', enter: 'frukt', open: [7, 21] }),
  B('flyg', 1452, 228, 124, { x0: 1544, x1: 1592, type: 'slide' }, { sign: 'FLYGPLATSEN', enter: 'flyg', open: [7, 21] }),
];

// Luckorna mellan husen. 'street' = tvärgata med övergångsställe + trafikljus.
export const STREETS = [];
{
  const edges = [[0, BUILDINGS[0].x]];
  for (let i = 0; i + 1 < BUILDINGS.length; i++) edges.push([BUILDINGS[i].x + BUILDINGS[i].w, BUILDINGS[i + 1].x]);
  const last = BUILDINGS[BUILDINGS.length - 1];
  edges.push([last.x + last.w, CITY.W]);
  const NAMES = ['PARKGATAN', 'TORGGATAN', 'FABRIKSGATAN'];
  let n = 0;
  edges.forEach(([x0, x1], i) => {
    const edge = i === 0 || i === edges.length - 1;
    const street = !edge && x1 - x0 >= 48;
    STREETS.push({ x0, x1, kind: edge ? 'edge' : street ? 'street' : 'alley', name: street ? NAMES[n++] : null });
  });
}
export const CROSSWALKS = STREETS.filter((s) => s.kind === 'street').map((s, i) => ({ i, x0: s.x0, x1: s.x1, name: s.name }));

// Trafikljusens stolpar (fotpunkt). Varje övergångsställe har en på varje trottoar.
export const LIGHTS = CROSSWALKS.flatMap((c) => [
  { crosswalk: c.i, side: 'n', x: c.x0 - 7, y: CITY.SIDEWALK_N[1] - 3 },
  { crosswalk: c.i, side: 's', x: c.x1 + 7, y: CITY.SIDEWALK_S[1] - 3 },
]);

// Parken: markmodulen målar torget och gångarna, rekvisitan ställer fontänen
// mitt på torget och bänkar/rabatter vid sidan av gångarna (aldrig på dem).
export const PARK_LAYOUT = {
  plaza: { cx: 934, cy: 366, r: 42 },
  promenade: [20, 334, CITY.W - 20, 346],
  paths: CROSSWALKS.map((c) => [c.x0 + 12, CITY.SIDEWALK_S[1], c.x1 - 12, 334]),
};
export const PATH_RECTS = [PARK_LAYOUT.promenade, ...PARK_LAYOUT.paths];
// Busshållplatsen (mitt på södra trottoaren) – rekvisitan ritar skjulet, bussen stannar här.
export const BUS_STOP = { x: 610, y: CITY.SIDEWALK_S[1] - 3 };

// Husets fotavtryck (hinder för gång) och ytan framför dörren.
export const footprint = (b) => [b.x, CITY.FOOT_TOP, b.x + b.w, CITY.BASE - 1];
export const doorFront = (b) => [b.door.x0 - 10, CITY.BASE, b.door.x1 + 10, CITY.BASE + 22];
export const doorCenter = (b) => ({ x: (b.door.x0 + b.door.x1) / 2, y: CITY.BASE + 12 });

// Ytor där rekvisita (träd, bänkar, lyktor …) INTE får stå.
export const RESERVED = [
  [0, CITY.ROAD[0], CITY.W, CITY.ROAD[1]],                                   // vägen
  ...BUILDINGS.map(doorFront),                                               // framför dörrarna
  ...CROSSWALKS.map((c) => [c.x0 - 6, CITY.SIDEWALK_N[0], c.x1 + 6, CITY.SIDEWALK_N[1]]),
  ...CROSSWALKS.map((c) => [c.x0 - 6, CITY.SIDEWALK_S[0], c.x1 + 6, CITY.SIDEWALK_S[1]]),
  ...LIGHTS.map((l) => [l.x - 6, l.y - 8, l.x + 6, l.y + 3]),
  ...PATH_RECTS,
];

// Hur en husbild placeras: bredd b.w + 16 (8 px överhäng åt varje håll för
// markiser/skyltar), ritas med övre vänstra hörnet i (b.x − 8, BASE + 4 − höjd).
// Bildens rad (höjd − 4) motsvarar alltså markytan y = BASE.
export const ART_OVER = 8, ART_BELOW = 4;
export const artPos = (b, img) => ({ x: b.x - ART_OVER, y: CITY.BASE + ART_BELOW - img.height });

export const inRect = (x, y, r) => x >= r[0] && x < r[2] && y >= r[1] && y < r[3];
export const isNightHour = (h) => h >= 19.5 || h < 6.5;
