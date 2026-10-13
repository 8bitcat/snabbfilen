// 🎡 PIXELBERG – tivolit på berget ovanför staden ("bygg allting inklusive stadsdelarna" 2026-10-12; Carl 2026-10-13:
// "denna bygger du"). Kartan, marken, utsikten och de stillastående byggnaderna; allt som rör sig ritas av scenen
// (js/scenes/pixelberg.js). Ett pixelkorn, ljuset från sydväst, samma palett som staden.
//
// Från väster: BERGBUSSENS hållplats → entréporten PIXELBERGS TIVOLI → BILJETTLUCKAN → KARUSELLEN → det stora
// PARISERHJULET → stånden (SOCKERVADD & POPCORN, LYCKOHJULET) → BERG-OCH-DALBANAN med stationen → RADIOBILARNA
// (v0.126: tivolit växte österut, TW 1600 → 2440) → kast- och skjutstånden → SPÖKHUSET med spöktåget. Bakom allt:
// utsikten ner över Pixelstaden, floden och kullarna (parallax). Torget är stenlagt med en mosaik av färgade cirklar.
import { Pix, SMALL, BIG, text, textW, mix, mul, hash, bayer } from '../core/floor-pix.js';
import { $t } from '../core/i18n.js';

export const TW = 2440, TH = 480;
export const P = {
  HIMMEL: 200,             // ovanför: himmel och utsikten (genomskinligt i marken) – hjulet och banan reser sig mot himlen
  BAK: [200, 228],         // bakom torget: bergets kant med gräs och häcken (inte gåbart)
  TORG: [228, 470],        // tivolitorget
  TOP: 236, BOTTOM: 468,
};
export const HALLPLATS = { x: 48, y: 340 };
export const PORT = { x: 160, y: 390, w: 104, h: 112 };              // entréporten (framifrån): två pelare och skylten över vägen
export const BILJETT = { x: 244, y: 262, w: 62 };                      // biljettluckan (fasaden står på y)
export const KARUSELL = { x: 450, y: 344, rx: 66, ry: 22 };            // karusellens mittpunkt (golvet) – en ellips
export const HJUL = { x: 830, y: 232, r: 74, fot: 330 };               // pariserhjulet: navet, radien, fötterna
export const STAND = [
  { id: 'godis', x: 996, y: 262, w: 88, namn: $t('SOCKERVADD & POPCORN'), f: [0xf890b4, 0xf4f1ea] },
  { id: 'lycka', x: 1110, y: 262, w: 88, namn: $t('LYCKOHJULET'), f: [0x3a7bd5, 0xf0c030] },
];
export const BANA = { x0: 1240, x1: 1590, station: { x: 1330, y: 270, w: 120 } };   // berg-och-dalbanan
// 🚗 radiobilarna: stålgolvet (x, y = bakkanten, w × h), bakväggen med skylten står längs y – bilarna kör inne på golvet
export const RADIO = { x: 1660, y: 300, w: 250, h: 118 };
// 👻 spökhuset: fasaden står på y (x … x + w); spöktåget går ut genom ingången till vänster, in i huset och ut genom
// utgången till höger, och tillbaka längs spåret framför huset till perrongen i mitten (js/pixelberg/spokhus.js)
export const SPOK = { x: 2180, y: 318, w: 200 };
export const SPOK_SPAR = { x0: SPOK.x + 48, x1: SPOK.x + 152, y0: SPOK.y - 4, y1: SPOK.y + 22, cx: SPOK.x + 100 };
export const BANKAR = [{ x: 620, y: 452 }, { x: 980, y: 452 }, { x: 1230, y: 420 }, { x: 1990, y: 452 }];
export const LYKTOR = [110, 330, 590, 700, 960, 1210, 1470, 1630, 1940, 2150, 2420].map((x) => ({ x, y: P.TORG[0] + 10 }));
export const BUSKAR = [[300, 250], [560, 248], [1200, 250], [1520, 440], [260, 462], [700, 466], [1612, 300], [2400, 252], [2160, 462]].map(([x, y]) => ({ x, y }));

// berg-och-dalbanans spår som en sluten kurva (x, y) i världen – tåget följer den (scenen)
export const SPAR = (() => {
  const pts = [];
  const k = [[1290, 214], [1340, 214], [1376, 120], [1410, 96], [1440, 150], [1468, 206], [1500, 160], [1530, 112], [1560, 140], [1572, 196], [1540, 214], [1470, 222], [1400, 222], [1330, 222], [1290, 214]];
  for (let i = 0; i < k.length - 1; i++) { const [ax, ay] = k[i], [bx, by] = k[i + 1], n = Math.ceil(Math.hypot(bx - ax, by - ay) / 3); for (let j = 0; j < n; j++) { const u = j / n, s = (1 - Math.cos(u * Math.PI)) / 2; pts.push([ax + (bx - ax) * u, ay + (by - ay) * s]); } }
  return pts;
})();

export function hinder() {
  const o = [];
  o.push([0, 0, TW, P.TOP - 2]);                                                           // bakom torget
  o.push([PORT.x - 52, PORT.y - 4, PORT.x - 38, PORT.y + 1], [PORT.x + 38, PORT.y - 4, PORT.x + 52, PORT.y + 1]);   // portens pelare
  o.push([BILJETT.x, BILJETT.y - 20, BILJETT.x + BILJETT.w, BILJETT.y - 1]);
  for (let y = KARUSELL.y - KARUSELL.ry; y < KARUSELL.y + KARUSELL.ry; y += 3) {             // karusellen (ellipsen)
    const w = KARUSELL.rx * Math.sqrt(Math.max(0, 1 - ((y + 1.5 - KARUSELL.y) / KARUSELL.ry) ** 2));
    if (w > 2) o.push([KARUSELL.x - w, y, KARUSELL.x + w, y + 3]);
  }
  o.push([HJUL.x - 50, HJUL.fot - 6, HJUL.x + 50, HJUL.fot + 4]);                           // hjulets fot och plattform
  for (const s of STAND) o.push([s.x, s.y - 20, s.x + s.w, s.y - 1]);
  o.push([BANA.station.x, BANA.station.y - 18, BANA.station.x + BANA.station.w, BANA.station.y - 1]);
  o.push([RADIO.x - 4, P.TOP - 2, RADIO.x + RADIO.w + 4, RADIO.y + RADIO.h + 2]);                // radiobilarnas bana (man åker, går inte)
  o.push([SPOK.x, P.TOP - 2, SPOK.x + SPOK.w, SPOK.y + 1]);                                       // spökhuset
  o.push([SPOK_SPAR.x0 - 6, SPOK.y, SPOK_SPAR.x1 + 7, SPOK_SPAR.y1 + 5]);                         // spöktågets spår (perrongen framför går man på)
  for (const b of BANKAR) o.push([b.x - 15, b.y - 4, b.x + 16, b.y + 1]);
  for (const l of LYKTOR) o.push([l.x - 2, l.y - 2, l.x + 3, l.y + 1]);
  for (const b of BUSKAR) o.push([b.x - 9, b.y - 4, b.x + 10, b.y + 1]);
  o.push([HALLPLATS.x - 2, HALLPLATS.y - 3, HALLPLATS.x + 4, HALLPLATS.y + 1]);
  return o;
}

// ---------- utsikten (parallax): kullar, floden och Pixelstaden långt där nere ----------
const UTSIKT = new Map();
export function utsiktCanvas(natt) {
  const key = String(natt);
  if (UTSIKT.has(key)) return UTSIKT.get(key);
  const W = 1200, H = 96, X = new Pix(W, H);
  for (let x = 0; x < W; x++) {
    const h1 = 50 + Math.sin(x / 90) * 10 + Math.sin(x / 31) * 4;                              // blå kullar långt bort
    for (let y = Math.round(H - h1); y < H; y++) X.px(x, y, natt ? 0x2a3a5a : mix(0x8aa4c4, 0x7a94b4, (y - (H - h1)) / 40));
    const h2 = 30 + Math.sin(x / 60 + 2) * 6;                                                   // gröna åsar
    for (let y = Math.round(H - h2); y < H; y++) X.px(x, y, natt ? 0x1e3424 : mix(0x6a9a5a, 0x4a7a3a, (y - (H - h2)) / 30));
  }
  for (let x = 0; x < W; x++) {                                                                  // floden som slingrar sig
    const fy = Math.round(H - 14 + Math.sin(x / 70) * 4);
    for (let y = fy; y < fy + 3; y++) X.px(x, y, natt ? 0x2a4a7a : (x + y) % 9 === 0 ? 0xd8f0fa : 0x7cc0e0);
  }
  for (let k = 0; k < 90; k++) {                                                                 // husen i staden: små klossar med fönster
    const x = 140 + Math.floor(hash(k, 1, 51) * 900), w = 4 + Math.floor(hash(k, 2, 51) * 7), h = 5 + Math.floor(hash(k, 3, 51) * (hash(k, 4, 51) > 0.85 ? 22 : 10));
    const c = [0xd8c8a8, 0xc8b8a0, 0xb8c8d8, 0xe8d0c0, 0xa8b0c0][k % 5], y0 = H - 8 - h - Math.round(Math.sin(x / 70) * 3);
    for (let y = y0; y < y0 + h; y++) for (let i = 0; i < w; i++) {
      let col = natt ? 0x2a2e44 : i === 0 ? mix(c, 0xffffff, 0.25) : i === w - 1 ? mul(c, 0.8) : c;
      if ((y - y0) % 3 === 1 && i % 2 === 1 && i < w - 1) col = natt ? (hash(x + i, y, 52) > 0.45 ? 0xffd870 : 0x2a2e44) : 0x5a6a8a;
      X.px(x + i, y, col);
    }
    if (h > 14) X.px(x + (w >> 1), y0 - 1, natt ? 0xff4848 : 0x8a8a9a);
  }
  const cv = X.flush(); UTSIKT.set(key, cv); return cv;
}

// ---------- marken (en gång) ----------
const GRAS = [0x9ac860, 0x7aa84a, 0x5e8c3a, 0x4a7430];
const gras = (x, y, k = 0) => GRAS[Math.min(3, Math.max(0, Math.round(1.4 + (hash(x >> 1, y >> 1, 53) - 0.5) * 2 + k + (bayer(x, y) - 0.5))))];
export function paintGround() {
  const X = new Pix(TW, TH);
  // bergets topp: gräs bakom torget, en klippkant mot utsikten
  for (let y = P.HIMMEL; y < P.TORG[0]; y++) for (let x = 0; x < TW; x++) {
    const kant = P.HIMMEL + 6 + Math.round(Math.sin(x / 37) * 3 + Math.sin(x / 11) * 1.5);
    if (y < kant) { if (y >= kant - 4) X.px(x, y, mix(0x8a8478, 0x6a645c, hash(x >> 1, y, 54))); continue; }
    X.px(x, y, gras(x, y, 0.2));
  }
  for (let x = 0; x < TW; x++) for (let y = P.TORG[0] - 10; y < P.TORG[0]; y++) {                // en låg häck längs torgets bakkant
    const top = P.TORG[0] - 10 + Math.round(Math.sin(x / 5) * 1.2);
    if (y >= top) X.px(x, y, y === top ? 0x7ab858 : (x + y) % 7 === 0 ? 0x2e5a26 : 0x3f8a3a);
  }
  // torget: ljusa stenplattor med en mosaik av färgade cirklar, ljusare gångstråk
  const MOS = [0xe04848, 0xf0c030, 0x3a7bd5, 0x46a35a, 0xd060a0];
  for (let y = P.TORG[0]; y < TH; y++) for (let x = 0; x < TW; x++) {
    const rx = x % 12, ry = (y + (Math.floor(x / 12) % 2) * 6) % 12;
    let c = rx === 0 || ry === 0 ? 0xb8b0a0 : mix(0xe0d8c8, 0xd0c8b4, hash(Math.floor(x / 12), Math.floor((y + (Math.floor(x / 12) % 2) * 6) / 12), 55));
    if (y > TH - 4) c = mix(c, 0x8a8478, 0.5);
    X.px(x, y, c);
  }
  for (const [cx, cy, r] of [[300, 400, 26], [680, 410, 30], [1040, 400, 26], [1400, 400, 30], [600, 300, 18], [2080, 400, 28], [2330, 410, 24]]) {
    for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) {
      const d = Math.hypot(x, y * 1.6); if (d > r) continue;
      const ring = Math.floor(d / 6), c = d > r - 2 ? 0x8a8478 : MOS[(ring + (cx >> 4)) % MOS.length];
      X.px(cx + x, cy + Math.round(y / 1.6 * 1.6) / 1.6 | 0, mix(c, 0xffffff, 0.12));
    }
  }
  // vägen in från bergbussen (asfalt i väster) och skuggorna under portens båge
  for (let y = 300; y < 380; y++) for (let x = 0; x < 140; x++) X.px(x, y, (x + y) % 23 === 0 ? 0x6a6a72 : mix(0x5a5a64, 0x64646e, hash(x >> 1, y >> 1, 56)));
  for (let x = 0; x < 140; x += 14) X.rect(x, 339, 7, 1, 0xf0e8d0);
  // radiobilarnas golv: stålplattor med nitar och en blank strimma – bilarna lämnar inga spår
  for (let y = RADIO.y; y < RADIO.y + RADIO.h; y++) for (let x = RADIO.x; x < RADIO.x + RADIO.w; x++) {
    const lx = x - RADIO.x, ly = y - RADIO.y, px = lx % 25, py = ly % 17;
    let c = mix(0x50545e, 0x484c56, hash(Math.floor(lx / 25), Math.floor(ly / 17), 58));
    if (px === 0 || py === 0) c = 0x363a44; else if (px === 1 || py === 1) c = 0x62666f;
    if ((px === 3 || px === 22) && (py === 3 || py === 14)) c = 0x7a7e88;
    if (Math.abs((lx - ly * 1.6) % 90) < 2) c = mix(c, 0xb8c0d0, 0.25);
    X.px(x, y, c);
  }
  // spöktågets spår (en U-sväng framför spökhuset) och perrongen av gamla plankor
  const { x0, x1, y1, cx } = SPOK_SPAR;
  const sliper = (x, y, ligg) => { if (ligg) X.rect(x - 4, y, 9, 2, 0x5a4a3a); else X.rect(x, y - 4, 2, 9, 0x5a4a3a); };
  for (let y = SPOK.y; y <= y1; y += 4) { sliper(x0 - 1, y, true); sliper(x1 - 1, y, true); }
  for (let x = x0; x <= x1; x += 4) sliper(x, y1 - 1, false);
  for (const [ax, ay, bx, by] of [[x0, SPOK.y, x0, y1], [x1, SPOK.y, x1, y1], [x0, y1, x1, y1]]) {
    if (ax === bx) for (let y = ay; y <= by + 3; y++) { X.px(ax - 3, y, 0x8a8a98); X.px(ax + 3, y, 0x8a8a98); X.px(ax - 3, y - 1, 0xb8b8c4, 0.5); }
    else for (let x = ax - 3; x <= bx + 3; x++) { X.px(x, ay - 3, 0x8a8a98); X.px(x, ay + 3, 0x8a8a98); X.px(x, ay - 4, 0xb8b8c4, 0.6); }
  }
  for (let y = y1 + 6; y < y1 + 14; y++) for (let x = cx - 26; x < cx + 26; x++) {
    const p = (x - cx + 26) % 9;
    X.px(x, y, y === y1 + 6 ? 0xc89a68 : p === 0 ? 0x6a4a2a : mix(0xa87a48, 0x98683a, hash(Math.floor((x - cx) / 9), y >> 2, 60)));
  }
  return X.flush();
}

// ---------- byggnaderna (cachade bilder) ----------
const CACHE = new Map();
function bild(nyckel, w, h, fn) { if (CACHE.has(nyckel)) return CACHE.get(nyckel); const X = new Pix(w, h); fn(X); const c = X.flush(); CACHE.set(nyckel, c); return c; }
// biljettluckan: rödvitrandig kiosk med kupoltak, luckan och skylten BILJETTER
export function biljettBild(natt) {
  const W = BILJETT.w, H = 46;
  return bild(`biljett${natt}`, W, H + 18, (X) => {
    const Y0 = 18;
    for (let y = 0; y < 18; y++) { const w = Math.round(Math.sqrt(Math.max(0, 1 - ((17 - y) / 18) ** 2)) * (W / 2)); for (let x = -w; x < w; x++) X.px((W >> 1) + x, y, (Math.floor((x + 40) / 5) % 2) ? 0xe04848 : 0xf4f1ea); }
    X.vl(W >> 1, 0, 3, 0xf0c030); X.px(W >> 1, 0, 0xffe080);
    for (let y = Y0; y < Y0 + H; y++) for (let x = 0; x < W; x++) X.px(x, y, Math.floor(x / 6) % 2 ? 0xd8343c : 0xf4f1ea);
    X.rect(10, Y0 + 12, W - 20, 18, natt ? 0xf0c868 : 0x2a2830); X.rect(10, Y0 + 28, W - 20, 3, 0xd4a874);
    X.rect(26, Y0 + 15, 10, 13, 0xf4f1ea); X.rect(27, Y0 + 9, 8, 7, 0xd89a72); X.rect(26, Y0 + 7, 10, 3, 0x3a7bd5); X.px(29, Y0 + 12, 0x1e1a24); X.px(32, Y0 + 12, 0x1e1a24);
    const s = $t('BILJETTER'), sw = textW(SMALL, s);
    X.rect((W - sw >> 1) - 3, Y0 + 2, sw + 6, 9, 0xfff8e0); text(X, SMALL, s, (W - sw) >> 1, Y0 + 4, 0xd8343c);
    X.rect(0, Y0 + H - 4, W, 4, 0x8a2a2e);
  });
}
// ett stånd: randig markis, disken och skylten
export function standBild(s, natt) {
  const W = s.w, H = 40;
  return bild(`stand${s.id}${natt}`, W, H + 26, (X) => {
    const Y0 = 26, [a, b] = s.f;
    for (let y = Y0; y < Y0 + H; y++) for (let x = 0; x < W; x++) X.px(x, y, mix(0xc89a68, 0xa87a48, hash(x >> 2, y >> 3, 57)));
    X.rect(6, Y0 + 6, W - 12, 20, natt ? 0xf0c868 : 0x2a2830);
    if (s.id === 'godis') {   // sockervadd i påsar och popcornmaskinen
      for (let k = 0; k < 4; k++) { const cx = 14 + k * 9; for (let y = -4; y <= 4; y++) for (let x = -4; x <= 4; x++) if (x * x + y * y <= 16) X.px(cx + x, Y0 + 14 + y, k % 2 ? 0xf8c8d8 : 0xc8d8f8); X.vl(cx, Y0 + 18, 6, 0xf4f1ea); }
      X.rect(W - 26, Y0 + 9, 16, 16, 0xe04848); X.rect(W - 24, Y0 + 11, 12, 10, 0xfff8d0); for (let k = 0; k < 10; k++) X.px(W - 23 + (k * 5) % 11, Y0 + 13 + (k * 3) % 7, 0xffffff);
    } else {                  // lyckohjulet på bakväggen och gosedjuren på hyllan
      const cx = W >> 1, cy = Y0 + 4, r = 11;
      for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) { const d = Math.hypot(x, y); if (d > r) continue; const seg = Math.floor(((Math.atan2(y, x) + Math.PI) / (Math.PI * 2)) * 8); X.px(cx + x, cy + y, d > r - 1.5 ? 0xf0c030 : [0xe04848, 0xf4f1ea, 0x3a7bd5, 0xf4f1ea, 0x46a35a, 0xf4f1ea, 0xd060a0, 0xf4f1ea][seg]); }
      X.rect(cx - 1, cy - 1, 3, 3, 0xf0c030); X.px(cx, cy - r - 2, 0x1e1a24); X.px(cx, cy - r - 1, 0x1e1a24);
      for (let k = 0; k < 5; k++) { const x = 9 + k * 15; X.rect(x, Y0 + 18, 8, 7, [0xc8905a, 0xf8c8d8, 0xf4f1ea, 0x9ad8f8, 0xf0d070][k]); X.px(x + 1, Y0 + 17, [0xc8905a, 0xf8c8d8, 0xf4f1ea, 0x9ad8f8, 0xf0d070][k]); X.px(x + 6, Y0 + 17, [0xc8905a, 0xf8c8d8, 0xf4f1ea, 0x9ad8f8, 0xf0d070][k]); X.px(x + 2, Y0 + 20, 0x1e1a24); X.px(x + 5, Y0 + 20, 0x1e1a24); }
    }
    X.rect(0, Y0 + 26, W, 6, 0xf4ece0); X.hl(0, Y0 + 26, W, 0xffffff); X.rect(0, Y0 + 32, W, H - 32, mul(a, 0.8));
    for (let k = 0; k < W + 6; k++) { const x = k - 3, r = Math.floor(k / 7) % 2; for (let y = 0; y < 9; y++) X.px(x, Y0 - 4 + y, r ? a : b); if (k % 7 === 3) X.px(x, Y0 + 5, r ? a : b); }   // markisen
    const t = s.namn, tw = textW(SMALL, t);
    X.rect((W - tw >> 1) - 3, 6, tw + 6, 10, 0x1e1a24); X.rect((W - tw >> 1) - 2, 7, tw + 4, 8, 0xfff8e0); text(X, SMALL, t, (W - tw) >> 1, 9, 0xd8343c);
    X.vl(4, 15, 8, 0x5a5e66); X.vl(W - 5, 15, 8, 0x5a5e66);
  });
}
// berg-och-dalbanans station med skylten
export function stationBild(natt) {
  const W = BANA.station.w, H = 34;
  return bild(`station${natt}`, W, H + 16, (X) => {
    const Y0 = 16;
    for (let y = 0; y < 16; y++) { const ind = Math.round((16 - y) * 1.2); X.hl(ind, y, W - ind * 2, y % 3 ? 0x3a3a46 : 0x5a5a66); }
    for (let y = Y0; y < Y0 + H; y++) for (let x = 0; x < W; x++) X.px(x, y, x % 10 < 2 ? 0x8a2a2e : 0xd8343c);
    X.rect(8, Y0 + 8, W - 16, 16, natt ? 0xf0c868 : 0x2a2830);
    const s = $t('BERG-OCH-DALBANAN'), sw = textW(SMALL, s);
    X.rect((W - sw >> 1) - 3, Y0 + 1, sw + 6, 9, 0xfff8e0); text(X, SMALL, s, (W - sw) >> 1, Y0 + 3, 0xd8343c);
    X.rect(0, Y0 + H - 3, W, 3, 0x5a2a2e);
  });
}
// berg-och-dalbanans ställning och spår (stillastående – tåget ritas av scenen)
export function banaBild() {
  return bild('bana', TW, TH, (X) => {
    for (let i = 0; i < SPAR.length; i += 9) {                                                     // stolparna ner till marken
      const [x, y] = SPAR[i]; if (y > 214) continue;
      for (let yy = Math.round(y) + 3; yy < 226; yy++) { X.px(Math.round(x), yy, 0xa8a8b4); X.px(Math.round(x) + 1, yy, 0x7a7a88); }
      if (i % 27 === 0) for (let yy = Math.round(y) + 8; yy < 226; yy += 10) X.hl(Math.round(x) - 4, yy, 9, 0x8a8a98);
    }
    for (let i = 0; i < SPAR.length; i++) {                                                        // rälsen
      const [x, y] = SPAR[i]; X.px(x, y, 0xe04848); X.px(x, y + 1, 0xb8343c); X.px(x, y + 2, 0x7a7a88);
    }
  });
}
// entréporten framifrån: två randiga pelare, en välvd skylt PIXELBERGS TIVOLI med glödlampor (natt = de lyser)
export function portBild(natt) {
  const W = PORT.w, H = PORT.h;
  return bild(`port${natt}`, W, H, (X) => {
    for (const px of [0, W - 14]) {
      for (let y = 30; y < H; y++) for (let x = 0; x < 14; x++) X.px(px + x, y, x < 2 ? 0xf8a0a0 : x > 11 ? 0x8a2a2e : Math.floor((y - x * 0.5) / 6) % 2 ? 0xd8343c : 0xf4f1ea);
      X.rect(px - 1, H - 4, 16, 4, 0x6a645c); X.rect(px - 1, 26, 16, 5, 0xf0c030); X.hl(px - 1, 26, 16, 0xffe080);
      X.rect(px + 3, 18, 8, 8, 0xf0c030); X.px(px + 6, 15, 0xe04848); X.rect(px + 5, 16, 4, 2, 0xe04848);
    }
    for (let x = 0; x < W; x++) {   // skylten: en båge
      const top = 4 + Math.round(Math.pow((x - W / 2) / (W / 2), 2) * 10);
      for (let y = top; y < top + 16; y++) X.px(x, y, y === top ? 0xffe080 : y === top + 15 ? 0x8a6a1a : 0x2a5aa8);
      if (x % 6 === 3) X.px(x, top + 1, natt ? 0xfff6c0 : 0xf0c030);
    }
    const s = $t('PIXELBERGS TIVOLI'), sw = textW(SMALL, s);
    text(X, SMALL, s, (W - sw) >> 1, 13, 0xffe080);
  });
}
// 👻 spökhuset framifrån: ett gammalt lila trähus med två torn, brant skiffertak, sned skorsten, välvda fönster
// (gröngula på kvällen), en sned skylt SPÖKHUSET, spindelväv i hörnen, pumpor vid dörrarna; ingången till vänster
// är en gapande mun med tänder och ögon ovanför, utgången till höger. Spöket i vindsfönstret och fladdermössen ritas av scenen.
export const SPOK_H = 136;
export const SPOK_VINDSFONSTER = { x: 100, y: 34 };   // (i bilden – spöket tittar ut här)
export function spokBild(natt) {
  const W = SPOK.w, H = SPOK_H;
  return bild(`spok${natt}`, W, H, (X) => {
    const vagg = (x, y) => { const p = Math.floor(x / 6); const c = (x % 6 === 0) ? 0x2a2038 : mix(0x4a3a5e, 0x3e3050, hash(p, y >> 3, 61)); return x % 6 === 1 ? mix(c, 0xffffff, 0.08) : c; };
    const tak = (x, y, kant) => (kant ? 0x1e1828 : ((y >> 2) % 2 ? mix(0x3a3050, 0x2e2640, hash(x >> 2, y >> 2, 62)) : mix(0x2e2640, 0x262034, hash((x + 2) >> 2, y >> 2, 62))));
    // tornen: kropp + spetsigt tak
    for (const [tx, tw, ty, spets] of [[4, 32, 40, 6], [164, 32, 50, 18]]) {
      for (let y = ty; y < H; y++) for (let x = tx; x < tx + tw; x++) X.px(x, y, vagg(x, y));
      const mx = tx + (tw >> 1);
      for (let y = spets; y < ty + 2; y++) { const half = Math.round((y - spets) / (ty + 2 - spets) * (tw / 2 + 4)); for (let x = mx - half; x <= mx + half; x++) X.px(x, y, tak(x, y, x === mx - half || x === mx + half)); }
      X.vl(mx, spets - 6, 6, 0x5a5a66); X.px(mx + 1, spets - 6, 0x5a5a66); X.px(mx + 2, spets - 5, 0x5a5a66);   // flöjeln
    }
    // huvudhuset och gaveltaket
    for (let y = 54; y < H; y++) for (let x = 30; x < 170; x++) X.px(x, y, vagg(x, y));
    for (let y = 14; y < 56; y++) { const half = Math.round((y - 14) / 42 * 78); for (let x = 100 - half; x <= 100 + half; x++) { if (x < 22 || x > 178) continue; const kant = Math.abs(x - 100) >= half - 1; if (kant && hash(x, y, 63) > 0.7) continue; X.px(x, y, tak(x, y, kant)); } }
    for (let y = 52; y < 56; y++) for (let x = 22; x < 179; x++) X.px(x, y, y === 52 ? 0x4a4060 : 0x1e1828);   // takfoten
    for (let y = 16; y < 40; y++) { const l = Math.floor((40 - y) / 10); for (let x = 128 + l; x < 138 + l; x++) X.px(x, y, (x + y) % 5 === 0 ? 0x3a2a2a : mix(0x5a3a3a, 0x4a2e2e, hash(x, y >> 1, 64))); }   // skorstenen (sned)
    X.rect(126 + 2, 14, 14, 3, 0x2a1e1e);
    // fönstren
    const ljus = natt ? 0xd8f070 : 0x5a4a7a, ljus2 = natt ? 0xa8c850 : 0x4a3a68;
    const fonster = (fx, fy, fw, fh) => {
      for (let y = fy - 2; y < fy + fh + 2; y++) for (let x = fx - 2; x < fx + fw + 2; x++) { const top = fy + Math.round(Math.pow((x - fx - fw / 2) / (fw / 2 + 2), 2) * 4); if (y >= top - 2) X.px(x, y, 0x1e1828); }
      for (let y = fy; y < fy + fh; y++) for (let x = fx; x < fx + fw; x++) { const top = fy + Math.round(Math.pow((x - fx - fw / 2) / (fw / 2), 2) * 4); if (y < top) continue; X.px(x, y, (x - fx === (fw >> 1) || y - fy === (fh >> 1)) ? 0x1e1828 : (y - fy) < 3 ? ljus2 : ljus); }
    };
    fonster(50, 62, 16, 20); fonster(134, 62, 16, 20); fonster(14, 54, 12, 16); fonster(174, 62, 12, 16);
    for (let y = -8; y <= 8; y++) for (let x = -8; x <= 8; x++) { const d = Math.hypot(x, y); if (d <= 8) X.px(100 + x, 34 + y, d > 6.5 ? 0x1e1828 : ljus); }   // vindsfönstret (runt)
    for (let k = 0; k < 14; k++) X.px(146 + Math.round(k * 0.5), 60 + k, 0x2a1e30), X.px(147 + Math.round(k * 0.5), 60 + k, 0x5a3a5e);   // en lucka som hänger snett
    // skylten SPÖKHUSET – ett snett bräde
    const s = $t('SPÖKHUSET'), sw = textW(BIG, s), bw = Math.min(W - 70, Math.max(70, sw + 14)), bx = (W - bw) >> 1;
    for (let x = bx; x < bx + bw; x++) { const o = Math.round((x - bx) / bw * 3); for (let y = 86 + o; y < 100 + o; y++) X.px(x, y, y === 86 + o ? 0xb88a58 : (x - bx) % 23 === 0 ? 0x5a3a1e : mix(0x8a5a2e, 0x7a4e26, hash(x >> 3, y, 65))); }
    text(X, BIG, s, (W - sw) >> 1, 91, 0x1e3a1e); text(X, BIG, s, (W - sw) >> 1, 90, natt ? 0xa8ff78 : 0x78d850);
    for (const dx of [bx + 3, bx + bw - 4]) X.px(dx, 89 + Math.round((dx - bx) / bw * 3), 0xd8d8e0);
    for (let k = 0; k < 3; k++) { const dx = (W >> 1) - 18 + k * 17; X.vl(dx, 98, 2 + k % 2 * 2, natt ? 0xa8ff78 : 0x78d850); }   // färgen som rinner
    // dörrarna: ingången (munnen) och utgången
    for (const [dx, mun] of [[36, true], [140, false]]) {
      for (let y = H - 34; y < H; y++) for (let x = dx - 3; x < dx + 27; x++) { const top = H - 34 + Math.round(Math.pow((x - dx - 12) / 15, 2) * 8); if (y >= top) X.px(x, y, (x < dx || x >= dx + 24 || y < top + 2) ? 0x6a4a3a : 0x0e0a14); }
      if (mun) {
        for (let k = 0; k < 6; k++) { const tx = dx + 1 + k * 4; for (let j = 0; j < 4 - Math.abs(k % 2); j++) for (let i = j; i < 4 - j; i++) X.px(tx + i, H - 30 + j + Math.round(Math.pow((tx + 2 - dx - 12) / 15, 2) * 8), 0xf4f1ea); }
        for (const ex of [dx + 5, dx + 16]) { X.rect(ex, H - 46, 5, 5, natt ? 0xfff070 : 0xf0c030); X.rect(ex + 2, H - 44, 2, 2, 0x1e1a24); X.px(ex, H - 46, 0x3e3050); X.px(ex + 4, H - 46, 0x3e3050); }
      } else { X.rect(dx + 6, H - 46, 12, 7, 0x8a5a2e); X.hl(dx + 6, H - 46, 12, 0xb88a58); text(X, SMALL, $t('UT'), dx + 12 - (textW(SMALL, $t('UT')) >> 1), H - 45, 0xf4f1ea); }
    }
    // spindelväv i hörnen under takfoten
    for (const [wx, sx] of [[31, 1], [169, -1]]) for (let k = 0; k < 4; k++) { const v = k * Math.PI / 8; for (let j = 0; j < 14; j++) X.px(wx + Math.round(Math.cos(v) * j) * sx, 56 + Math.round(Math.sin(v) * j), 0xd8d8e8, 0.7); for (const r of [5, 10]) for (let j = 0; j <= 6; j++) { const u = j / 6 * Math.PI / 2; X.px(wx + Math.round(Math.cos(u) * r) * sx, 56 + Math.round(Math.sin(u) * r), 0xd8d8e8, 0.6); } }
    // pumporna vid dörrarna
    for (const px of [70, 124]) {
      for (let y = -5; y <= 5; y++) for (let x = -7; x <= 7; x++) if ((x / 7) ** 2 + (y / 5) ** 2 <= 1) X.px(px + x, H - 6 + y, Math.abs(x) % 4 === 0 ? 0xc85a10 : x < -2 ? 0xf8a040 : 0xe87a20);
      X.rect(px - 1, H - 13, 2, 3, 0x4a7a2a);
      const o = natt ? 0xfff070 : 0x3a1e0a; X.px(px - 3, H - 8, o); X.px(px - 2, H - 8, o); X.px(px + 2, H - 8, o); X.px(px + 3, H - 8, o); X.hl(px - 3, H - 4, 7, o); X.px(px - 1, H - 5, o); X.px(px + 1, H - 5, o);
    }
  });
}
// 🚗 radiobilarnas bakvägg: två randiga stolpar med strömnätet emellan, den stora skylten RADIOBILAR med glödlampor,
// en mörkblå vägg med blixtar och ett rutigt racingband, och den stoppade gummikanten nederst (står på RADIO.y)
export const RADIO_H = 78;
export function radioBild(natt) {
  const W = RADIO.w, H = RADIO_H;
  return bild(`radio${natt}`, W, H, (X) => {
    const V0 = 32;
    for (let y = V0; y < H - 6; y++) for (let x = 6; x < W - 6; x++) {
      let c = (x - 6) % 30 === 0 ? 0x1a2244 : y === V0 ? 0x3a4888 : mix(0x26325e, 0x202a52, hash(Math.floor(x / 30), y >> 2, 59));
      if (y >= V0 + 4 && y < V0 + 8) c = ((x >> 2) + ((y - V0 - 4) >> 1)) % 2 ? 0xf4f1ea : 0x1e1a24;   // racingbandet
      X.px(x, y, c);
    }
    for (let k = 0; k < 5; k++) {   // blixtarna
      const bx = 24 + k * 50, by = V0 + 14;
      const B = ['..###', '.###.', '####.', '..##.', '.##..', '##...', '#....'];
      B.forEach((r, j) => { for (let i = 0; i < r.length; i++) if (r[i] === '#') X.px(bx + i, by + j * 2, natt ? 0xfff070 : 0xf0c030), X.px(bx + i, by + j * 2 + 1, natt ? 0xffe050 : 0xd8a820); });
    }
    for (const px of [0, W - 6]) {   // stolparna
      for (let y = 6; y < H - 2; y++) for (let x = 0; x < 6; x++) X.px(px + x, y, x === 0 ? 0xf8a0a0 : x === 5 ? 0x8a2a2e : Math.floor((y - x * 0.5) / 5) % 2 ? 0xd8343c : 0xf4f1ea);
      X.rect(px - 1, 2, 8, 5, 0xf0c030); X.hl(px - 1, 2, 8, 0xffe080);
    }
    X.hl(6, 4, W - 12, 0x8a8a98); X.hl(6, 5, W - 12, 0x5a5a66);   // strömnätet (taket man inte ser)
    const s = $t('RADIOBILAR'), sw = textW(BIG, s), bw = Math.min(W - 24, Math.max(96, sw + 20)), bx = (W - bw) >> 1;
    X.rect(bx, 9, bw, 22, 0xf0c030); X.rect(bx + 2, 11, bw - 4, 18, 0xd8343c); X.hl(bx + 2, 11, bw - 4, 0xe85860);
    text(X, BIG, s, (W - sw) >> 1, 17, 0x8a1a1e); text(X, BIG, s, (W - sw) >> 1, 16, 0xfff6c0);
    for (let x = bx + 3; x < bx + bw - 2; x += 5) { X.px(x, 10, natt ? 0xfff6c0 : 0xc89a20); X.px(x, 29, natt ? 0xfff6c0 : 0xc89a20); }
    for (let y = 14; y < 28; y += 5) { X.px(bx + 1, y, natt ? 0xfff6c0 : 0xc89a20); X.px(bx + bw - 2, y, natt ? 0xfff6c0 : 0xc89a20); }
    for (let x = 0; x < W; x++) {   // gummikanten
      const r = Math.floor(x / 10) % 2;
      X.px(x, H - 6, r ? 0xf8a0a0 : 0xffffff); X.px(x, H - 5, r ? 0xd8343c : 0xf4f1ea); X.px(x, H - 4, r ? 0xd8343c : 0xf4f1ea); X.px(x, H - 3, r ? 0xb02a30 : 0xd8d4c8); X.px(x, H - 2, 0x2a2830); X.px(x, H - 1, 0x2a2830);
    }
  });
}
