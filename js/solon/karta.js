// ⛴️ SOLÖN – kartan, marken och byggnaderna ("bygg allting inklusive stadsdelarna" 2026-10-12: färja, strand, fiske,
// båt, sommarstuga). Ön ligger ute i havet; färjan går från bryggan vid Sjöboden i Linnéstaden (js/city/pir.js).
// Ett pixelkorn, ljuset från sydväst, samma palett som staden.
//
// Från norr (överst) till söder: HIMLEN med fastlandet långt borta (Pixelstadens siluett vid horisonten) → HAVET med
// vågor och FÄRJELÄGET (en träbrygga ut i vattnet där färjan ligger förtöjd) → det GRUNDA vattnet där man kan vada och
// bada → strandkanten med skum → SANDSTRANDEN (parasoller, handdukar, sandslott, livräddartornet, beachvolleynätet och
// SOLÖ-KIOSKEN) → DYNERNA med strandråg och två spänger → ängen med tre SOMMARSTUGOR (röd, gul, blå) och grusvägen
// framför dem. Längst i öster: KLIPPORNA ut i vattnet med FYREN och en fiskare.
//
// Scenen (js/scenes/solon.js) ritar: himlen (skyCanvas) → marken (paintGround, en gång; genomskinlig ovanför
// horisonten) → byggnader, parasoller och folk y-sorterade → kvällsljuset och fyrens sken.
import { Pix, SMALL, BIG, text, textW, mix, mul, hash, bayer } from '../core/floor-pix.js';
import { $t } from '../core/i18n.js';

export const TW = 1440, TH = 440;
export const S = {
  HORISONT: 24,           // ovanför: himmel (genomskinligt i marken)
  HAV: 40,                // fjärran hav 24–40, havet 40–112
  GRUNT: [112, 138],      // det grunda vattnet – man kan vada ut och bada
  KANT: [138, 150],       // våt sand och skum
  STRAND: [150, 300],     // sandstranden
  DYN: [300, 332],        // dynerna med strandråg
  BASE: 380,              // sommarstugornas fasader står här (ängen 332–380 bakom dem)
  VAG: [380, 432],        // grusvägen och ängen framför stugorna
  TOP: 113, BOTTOM: 432,
};
export const BRYGGA = { x0: 70, x1: 100, y0: 46, y1: 150 };        // färjeläget (träbrygga ut i havet)
export const FARJA = { x: 104, y: 52, w: 100, h: 42 };              // färjan förtöjd öster om bryggans yttersta del
export const KLIPPOR = { x0: 1236, y0: 26, y1: 304 };               // klipporna i öster (fyren och fiskaren)
export const FYR = { x: 1372, y: 150 };                             // fyrens fot (mitten)
export const FISKARE = { x: 1268, y: 132 };
export const KIOSK = { x: 470, y: 298, w: 72 };                     // Solö-kiosken (fasaden står på y, längst bak på stranden)
export const TORN = { x: 830, y: 214 };                             // livräddartornet (fötterna)
export const NAT = { x0: 1030, x1: 1112, y: 252 };                  // beachvolleynätet
export const SLOTT = { x: 646, y: 246 };                            // sandslottet
export const STUGOR = [
  { id: 'rod', x: 600, w: 112, h: 54, vagg: 0xa8382a, dorr: 0x5a2a1e, namn: $t('RÖDA STUGAN') },
  { id: 'gul', x: 770, w: 104, h: 50, vagg: 0xe8c060, dorr: 0x3a6aa8, namn: $t('GULA STUGAN') },
  { id: 'bla', x: 932, w: 108, h: 52, vagg: 0x8ab8d8, dorr: 0xa8382a, namn: $t('BLÅA STUGAN') },
];
export const SPANG = [[300, 326], [1184, 1210]];                    // spängerna över dynerna (x0, x1)
export const PARASOLLER = [
  { x: 214, y: 210, f: [0xe04848, 0xf4f1ea] }, { x: 330, y: 244, f: [0x3a7bd5, 0xf4f1ea] }, { x: 560, y: 196, f: [0xf0b429, 0xe04848] },
  { x: 726, y: 268, f: [0x46a35a, 0xf4f1ea] }, { x: 952, y: 204, f: [0xd060a0, 0xf4f1ea] }, { x: 1176, y: 236, f: [0x3a7bd5, 0xf0b429] },
];
export const HANDDUKAR = [
  { x: 226, y: 222, f: [0xe04848, 0xf4f1ea] }, { x: 344, y: 256, f: [0x3a9ad5, 0xf0e070] }, { x: 572, y: 208, f: [0xf0a030, 0xf4f1ea] },
  { x: 740, y: 280, f: [0x9a6ad8, 0xf4f1ea] }, { x: 966, y: 216, f: [0x46a35a, 0xf0e070] }, { x: 1150, y: 262, f: [0xe04848, 0x3a7bd5] },
  { x: 430, y: 180, f: [0xf0e070, 0x46a35a] },
];
export const SKYLT = { x: 128, y: 166 };                            // ortsskylten SOLÖN vid bryggans fot
export const BANKAR = [{ x: 520, y: 412 }, { x: 1100, y: 412 }];

const SAND = [0xf6e6bc, 0xecd8a8, 0xdcc490, 0xc8ae78];
const sand = (x, y, k = 0) => SAND[Math.min(3, Math.max(0, Math.round(1 + (hash(x >> 1, y >> 1, 21) - 0.5) * 1.6 + k + (bayer(x, y) - 0.5) * 0.9)))];
const GRAS = [0x9ac860, 0x7aa84a, 0x5e8c3a, 0x4a7430];
const gras = (x, y, k = 0) => GRAS[Math.min(3, Math.max(0, Math.round(1.4 + (hash(x >> 1, y >> 1, 23) - 0.5) * 2 + k + (bayer(x, y) - 0.5))))];

// klippornas form: vänsterkanten för varje rad (ojämn, rundad)
export const klippKant = (y) => KLIPPOR.x0 + 30 - Math.round(Math.sin(y / 23) * 14 + Math.sin(y / 7) * 4) + (y < 90 ? Math.round((90 - y) * 0.6) : 0) + (y > 250 ? Math.round((y - 250) * 1.1) : 0);

// ---------- hindren (rektanglar [x0, y0, x1, y1]) ----------
export function hinder() {
  const o = [];
  o.push([0, 0, BRYGGA.x0, S.GRUNT[0]], [BRYGGA.x1, 0, TW, S.GRUNT[0]]);            // havet (bryggan går att gå på)
  for (let y = KLIPPOR.y0; y < KLIPPOR.y1; y += 4) o.push([klippKant(y), y, TW, y + 4]);   // klipporna
  o.push([KIOSK.x, KIOSK.y - 26, KIOSK.x + KIOSK.w, KIOSK.y - 1]);
  o.push([TORN.x - 11, TORN.y - 4, TORN.x + 12, TORN.y + 1]);
  o.push([NAT.x0 - 2, NAT.y - 3, NAT.x0 + 2, NAT.y + 1], [NAT.x1 - 2, NAT.y - 3, NAT.x1 + 2, NAT.y + 1]);
  o.push([SLOTT.x - 10, SLOTT.y - 5, SLOTT.x + 11, SLOTT.y + 1]);
  for (const st of STUGOR) o.push([st.x, S.BASE - 40, st.x + st.w, S.BASE - 1]);
  for (const p of PARASOLLER) o.push([p.x - 1, p.y - 2, p.x + 2, p.y + 1]);
  for (const b of BANKAR) o.push([b.x - 15, b.y - 4, b.x + 16, b.y + 1]);
  o.push([SKYLT.x - 2, SKYLT.y - 2, SKYLT.x + 3, SKYLT.y + 1]);
  return o;
}

// ---------- marken (en gång) ----------
export function paintGround() {
  const P = new Pix(TW, TH);
  // fastlandet långt borta: Pixelstadens siluett vid horisonten (hus, höghus, kyrktornet, bron)
  for (let x = 260; x < 1120; x++) {
    const hus = Math.floor(x / 9), h = 3 + Math.floor(hash(hus, 1, 31) * 9) + (hash(hus, 2, 31) > 0.86 ? 8 : 0) + (x > 640 && x < 652 ? 12 : 0);
    for (let y = S.HORISONT - h; y < S.HORISONT; y++) P.px(x, y, (x % 9 === 0) ? 0x7088a8 : mix(0x8aa0bc, 0x7890b0, (S.HORISONT - y) / 20));
    if (x % 3 === 1 && h > 6 && hash(x, 7, 31) > 0.6) P.px(x, S.HORISONT - 3 - Math.floor(hash(x, 8, 31) * (h - 4)), 0xa8bcd4);
  }
  for (let x = 860; x < 980; x++) { P.px(x, S.HORISONT - 6 - Math.round(Math.sin((x - 860) / 120 * Math.PI) * 5), 0x7088a8); if (x % 12 === 0) for (let y = S.HORISONT - 10; y < S.HORISONT; y++) P.px(x, y, 0x7088a8); }   // hängbron
  // havet: disigt långt bort, mörkare blått, ljusare och turkos mot stranden; vågtoppar i rader
  for (let y = S.HORISONT; y < S.GRUNT[0]; y++) {
    const u = (y - S.HORISONT) / (S.GRUNT[0] - S.HORISONT);
    const bas = y < S.HAV ? mix(0xb4d8ec, 0x8ac4e2, (y - S.HORISONT) / 16) : mix(0x3a86b8, 0x56aed2, u);
    for (let x = 0; x < TW; x++) {
      let c = bas;
      const vag = hash(Math.floor((x + Math.sin(y * 0.9) * 6) / (4 + u * 10)), y, 33);
      if (y >= S.HAV && vag > 0.9) c = mix(c, 0xd8f0fa, 0.65);
      else if (y >= S.HAV && vag < 0.08) c = mul(c, 0.86);
      P.px(x, y, c);
    }
  }
  // det grunda vattnet: turkos med sanden som skymtar under, ljusa krusningar
  for (let y = S.GRUNT[0]; y < S.GRUNT[1]; y++) for (let x = 0; x < TW; x++) {
    const u = (y - S.GRUNT[0]) / (S.GRUNT[1] - S.GRUNT[0]);
    let c = mix(0x5ec2d4, 0xa4dccc, u);
    if (bayer(x, y) < u * 0.5) c = mix(c, 0xd8c898, 0.4);
    if (hash(x >> 2, y, 34) > 0.94) c = mix(c, 0xf0fcff, 0.6);
    P.px(x, y, c);
  }
  // våt sand och sandstranden (snäckor, småsten och fotspår)
  for (let y = S.KANT[0]; y < S.DYN[1]; y++) for (let x = 0; x < TW; x++) {
    const vat = y < S.KANT[1] ? 1 - (y - S.KANT[0]) / (S.KANT[1] - S.KANT[0]) : 0;
    let c = sand(x, y, y > S.DYN[0] ? 0.4 : 0);
    if (vat > 0) c = mix(c, 0xb09868, vat * 0.7);
    P.px(x, y, c);
  }
  for (let k = 0; k < 160; k++) {
    const x = Math.floor(hash(k, 1, 35) * TW), y = S.KANT[1] + 4 + Math.floor(hash(k, 2, 35) * (S.STRAND[1] - S.KANT[1] - 8)), s = hash(k, 3, 35);
    if (s > 0.8) { P.px(x, y, 0xf8d8d8); P.px(x + 1, y, 0xe8b0b0); P.px(x, y + 1, 0xd89898); }        // en rosa snäcka
    else if (s > 0.55) { P.px(x, y, 0xb8b0a0); P.px(x + 1, y, 0x8a8478); }                               // en sten
    else if (s > 0.4) P.px(x, y, 0xffffff);                                                             // ett skal
  }
  for (let k = 0; k < 40; k++) { const x = 140 + k * 26 + Math.round(Math.sin(k) * 6), y = 186 + Math.round(Math.sin(k * 0.7) * 20); P.px(x, y, 0xd2b884); P.px(x + 1, y + 1, 0xd2b884); P.px(x + 4, y + 3, 0xd2b884); P.px(x + 5, y + 4, 0xd2b884); }   // fotspår
  // dynerna: strandråg (grågröna strån i tuvor) och sand som blåser upp
  for (let k = 0; k < 520; k++) {
    const x = Math.floor(hash(k, 4, 36) * TW), y = S.DYN[0] + 4 + Math.floor(hash(k, 5, 36) * (S.DYN[1] - S.DYN[0] + 40));
    if (SPANG.some(([a, b]) => x > a - 3 && x < b + 3)) continue;
    const h = 3 + Math.floor(hash(k, 6, 36) * 5), c = [0x9ab878, 0x7a9a5a, 0xb8c890][k % 3];
    for (let j = 0; j < h; j++) P.px(x + (j > h - 2 ? (k & 1 ? 1 : -1) : 0), y - j, c);
    P.px(x + 2, y - 1, c); P.px(x - 2, y - 2, mul(c, 0.85));
  }
  // ängen bakom och framför stugorna, och grusvägen
  for (let y = S.DYN[1]; y < TH; y++) for (let x = 0; x < TW; x++) {
    if (y < S.DYN[1] + 6 && bayer(x, y) > (y - S.DYN[1]) / 6) continue;   // sanden går över i gräs
    P.px(x, y, gras(x, y, y < S.BASE ? 0.2 : -0.1));
  }
  for (let y = S.VAG[0] + 10; y < S.VAG[0] + 30; y++) for (let x = 0; x < TW; x++) {
    const kant = y === S.VAG[0] + 10 || y === S.VAG[0] + 29;
    P.px(x, y, kant ? 0x9a9078 : mix(0xd8ccae, 0xb8ac90, hash(x >> 1, y >> 1, 37) * 0.8 + (bayer(x, y) - 0.5) * 0.3));
  }
  for (let k = 0; k < 180; k++) {   // blommor i ängen
    const x = Math.floor(hash(k, 7, 38) * TW), y = S.VAG[0] + (hash(k, 8, 38) > 0.5 ? 2 + Math.floor(hash(k, 9, 38) * 7) : 32 + Math.floor(hash(k, 9, 38) * 18));
    const c = [0xf4f1ea, 0xf0d040, 0xd060a0, 0x6a8ad8][k % 4];
    P.px(x, y, c); P.px(x, y + 1, 0x4a7430);
  }
  // spängerna över dynerna (brädor tvärs, ljus kant)
  for (const [a, b] of SPANG) for (let y = S.STRAND[1] - 6; y < S.VAG[0] + 12; y++) for (let x = a; x < b; x++) {
    const bord = Math.floor((y - S.STRAND[1]) / 4), fog = (y - S.STRAND[1] + 400) % 4 === 3;
    P.px(x, y, fog ? 0x6a4a2c : x === a || x === b - 1 ? 0x8a6038 : mix(0xc8945a, 0xa87a48, hash(bord, x >> 3, 39)));
  }
  // klipporna: rundade granithällar med lavar, tång vid vattnet
  for (let y = KLIPPOR.y0; y < KLIPPOR.y1; y++) {
    const x0 = klippKant(y);
    for (let x = x0; x < TW; x++) {
      const kant = x - x0, block = hash(Math.floor(x / 22), Math.floor(y / 16), 40);
      let c = mix(0x9a9aa2, 0x7a7a84, block);
      if (kant < 2) c = 0x5a5a64;
      else if (kant < 5) c = mix(c, 0xc8c8d0, 0.35);
      if ((x + y * 3) % 22 === 0 || (y % 16 === 0 && hash(x >> 2, y, 41) > 0.5)) c = mul(c, 0.78);          // springor
      if (hash(x >> 1, y >> 1, 42) > 0.955) c = 0xc8b040;                                                     // lavar
      if (y < S.GRUNT[0] + 6 && kant < 6 && hash(x, y, 43) > 0.5) c = 0x4a6a3a;                               // tång
      P.px(x, y, c);
    }
  }
  // färjeläget: en träbrygga på pålar ut i havet, med skuggan på vattnet
  for (let y = BRYGGA.y0; y < BRYGGA.y1; y++) {
    for (let x = BRYGGA.x0; x < BRYGGA.x1; x++) {
      const bord = Math.floor((x - BRYGGA.x0) / 6), fog = (x - BRYGGA.x0) % 6 === 5;
      P.px(x, y, fog ? 0x5a3c24 : y === BRYGGA.y0 ? 0xd4a874 : mix(0xb88a58, 0x9a6e44, hash(bord, y >> 3, 44)));
    }
    if (y < S.GRUNT[1]) { P.px(BRYGGA.x1, y + 2, 0x2a6a98, 0.6); P.px(BRYGGA.x1 + 1, y + 3, 0x2a6a98, 0.4); }
  }
  for (const py of [52, 74, 96, 118, 140]) for (const px of [BRYGGA.x0 - 1, BRYGGA.x1 - 2]) { P.rect(px, py - 2, 3, 5, 0x5a3c24); P.px(px, py - 2, 0x9a6e44); }   // pålarna
  return P.flush();
}

// ---------- byggnaderna (cachade bilder, ritade med fasaden på y = h) ----------
const CACHE = new Map();
function bild(nyckel, w, h, fn) { if (CACHE.has(nyckel)) return CACHE.get(nyckel); const P = new Pix(w, h); fn(P); const c = P.flush(); CACHE.set(nyckel, c); return c; }

// sommarstugan: brädfodrad i röd/gul/blå med vita knutar, sadeltak i tegel, dörr med trappsteg, två fönster med blomlådor
export function stugaBild(st, natt) {
  return bild(`stuga${st.id}${natt}`, st.w, st.h + 26, (P) => {
    const W = st.w, H = st.h, Y0 = 26, tak = 0x5a4a4a, takL = 0x7a6a6a, vit = 0xf4f1ea;
    for (let y = 0; y < 26; y++) { const ind = Math.round((26 - y) * 1.6); for (let x = ind; x < W - ind; x++) P.px(x, y, (y + x) % 5 === 0 ? mul(tak, 0.8) : y % 4 === 0 ? takL : tak); }   // taket
    P.hl(Math.round(26 * 1.6) - 2, 0, W - Math.round(26 * 1.6) * 2 + 4, takL);
    P.rect(W - 30, 2, 8, 14, 0x8a3a2a); P.hl(W - 31, 2, 10, 0x6a2a20);                                                       // skorstenen
    for (let y = Y0; y < Y0 + H; y++) for (let x = 0; x < W; x++) {
      const bord = x % 6 === 0, c = bord ? mul(st.vagg, 0.78) : (y - Y0) < 2 ? mul(st.vagg, 0.7) : st.vagg;
      P.px(x, y, x < 4 || x >= W - 4 ? vit : c);                                                                               // knutarna
    }
    P.hl(0, Y0, W, vit); P.hl(0, Y0 + 1, W, mul(st.vagg, 0.6));
    const dx = (W >> 1) - 8;                                                                                                   // dörren
    P.rect(dx - 2, Y0 + H - 34, 20, 34, vit); P.rect(dx, Y0 + H - 32, 16, 32, st.dorr); P.vl(dx + 8, Y0 + H - 30, 28, mul(st.dorr, 0.7));
    P.px(dx + 12, Y0 + H - 16, 0xe8c060); P.rect(dx + 3, Y0 + H - 28, 3, 6, natt ? 0xffd890 : 0xa8d4ff);
    P.rect(dx - 6, Y0 + H - 3, 28, 3, 0x8a8478); P.hl(dx - 6, Y0 + H - 3, 28, 0xb8b0a4);                                        // trappsteget
    for (const fx of [10, W - 32]) {                                                                                           // fönstren
      P.rect(fx - 2, Y0 + 12, 26, 22, vit);
      for (let y = 0; y < 18; y++) for (let x = 0; x < 22; x++) P.px(fx + x, Y0 + 14 + y, natt ? (x + y) % 7 ? 0xf0c868 : 0xffe0a0 : mix(0x5a8ab8, 0xa8d4ff, (x + 18 - y) / 40));
      P.vl(fx + 10, Y0 + 14, 18, vit); P.hl(fx, Y0 + 22, 22, vit);
      P.rect(fx - 3, Y0 + 34, 28, 4, 0x8a5a30); for (let k = 0; k < 7; k++) { P.px(fx - 1 + k * 4, Y0 + 33, [0xe04848, 0xf0d040, 0xd060a0][k % 3]); P.px(fx + k * 4, Y0 + 32, 0x46a35a); }
    }
  });
}
// Solö-kiosken: blåvitrandig träkiosk med markis, glassförsäljare i luckan och en stor glasstrut på taket
export function kioskBild(natt) {
  const W = KIOSK.w, H = 44;
  return bild(`kiosk${natt}`, W, H + 22, (P) => {
    const Y0 = 22;
    // glasstruten på taket
    for (let y = 0; y < 12; y++) { const w = Math.max(1, 6 - (y >> 1)); for (let x = -w; x <= w; x++) P.px(36 + x, 9 + y, (x + y) % 3 ? 0xd8a058 : 0xb07a38); }
    for (const [cx, cy, c] of [[33, 6, 0xf8c8d8], [39, 6, 0xf4f1ea], [36, 2, 0x8a5a3a]]) for (let y = -3; y <= 3; y++) for (let x = -3; x <= 3; x++) if (x * x + y * y <= 9) P.px(cx + x, cy + y, x + y < -2 ? 0xffffff : c);
    P.px(36, -1 + 2, 0xe04848);
    for (let y = Y0; y < Y0 + H; y++) for (let x = 0; x < W; x++) P.px(x, y, Math.floor(x / 6) % 2 ? 0x3a7bd5 : 0xf4f1ea);   // väggen: blå och vita brädor
    P.rect(0, Y0 + H - 4, W, 4, 0x2a5aa8);
    P.rect(10, Y0 + 10, W - 20, 20, natt ? 0xf0c868 : 0x2a2830);                                                            // luckan
    P.rect(10, Y0 + 28, W - 20, 4, 0xd4a874); P.hl(10, Y0 + 28, W - 20, 0xf0d0a0);                                           // disken
    // glassförsäljaren i luckan (huvud och axlar)
    P.rect(30, Y0 + 14, 12, 14, 0xf4f1ea); P.rect(32, Y0 + 8, 8, 8, 0xe0a97f); P.rect(31, Y0 + 6, 10, 3, 0xe04848); P.px(34, Y0 + 11, 0x1e1a24); P.px(37, Y0 + 11, 0x1e1a24);
    for (let x = 0; x < 3; x++) { P.rect(14 + x * 5, Y0 + 24, 3, 4, [0xf8c8d8, 0xf0e0a0, 0x8a5a3a][x]); }                    // glasslådorna
    for (let k = 0; k < W + 6; k++) { const x = k - 3, rand = Math.floor(k / 6) % 2; for (let y = 0; y < 8; y++) P.px(x, Y0 - 2 + y, rand ? 0xe04848 : 0xf4f1ea); if (k % 6 === 3) P.px(x, Y0 + 6, rand ? 0xe04848 : 0xf4f1ea); }   // markisen
    P.hl(-3, Y0 - 3, W + 6, 0x9e2a2e);
    const s = $t('GLASS'), sw = textW(BIG, s);
    P.rect((W - sw >> 1) - 3, Y0 + 32, sw + 6, 10, 0xfff8e0); text(P, BIG, s, (W - sw) >> 1, Y0 + 34, 0xe04848);
  });
}
// fyren: vit med röda band, räcke runt lanterninen, gult ljus, röd kupol; ett litet vaktarhus vid foten
export function fyrBild(natt) {
  return bild(`fyr${natt}`, 40, 120, (P) => {
    const cx = 20, fot = 118, topp = 22;
    for (let y = topp; y < fot; y++) {
      const u = (y - topp) / (fot - topp), hw = Math.round(6 + u * 4);
      const band = Math.floor((y - topp) / 16) % 2 === 1;
      for (let x = -hw; x <= hw; x++) {
        let c = band ? 0xd8343c : 0xf4f1ea;
        if (x <= -hw + 1) c = mix(c, 0xffffff, 0.3); else if (x >= hw - 2) c = mul(c, 0.78);
        P.px(cx + x, y, c);
      }
    }
    for (const fy of [48, 76, 100]) { P.rect(cx - 2, fy, 4, 6, natt ? 0xf0c868 : 0x2a3a5a); P.px(cx - 2, fy, 0xa8a8b0); }        // små fönster
    P.rect(cx - 3, fot - 10, 6, 10, 0x5a3a2a); P.px(cx + 1, fot - 5, 0xe8c060);                                             // dörren
    P.rect(cx - 9, topp - 2, 18, 3, 0x3a3a42); P.hl(cx - 9, topp - 2, 18, 0x6a6a72);                                        // balkongen
    for (let x = -9; x <= 9; x += 3) P.vl(cx + x, topp - 7, 5, 0x3a3a42); P.hl(cx - 9, topp - 7, 19, 0x3a3a42);                // räcket
    P.rect(cx - 5, topp - 14, 10, 10, natt ? 0xfff0a0 : 0xd8e8f0); P.rect(cx - 2, topp - 12, 4, 6, natt ? 0xffffff : 0xf0d060);   // lanterninen
    P.vl(cx - 5, topp - 14, 10, 0x3a3a42); P.vl(cx + 4, topp - 14, 10, 0x3a3a42);
    for (let y = 0; y < 6; y++) { const w = 6 - y; P.hl(cx - w, topp - 15 - y, w * 2, y === 0 ? 0xa8282e : 0xd8343c); }       // kupolen
    P.vl(cx, topp - 23, 3, 0x3a3a42);
  });
}
// färjan SOLÖ-FÄRJAN: vit med blå rand, röd vattenlinje, styrhytt, lejdare och en flagga
export function farjaBild() {
  return bild('farja', FARJA.w, FARJA.h, (P) => {
    const W = FARJA.w, H = FARJA.h;
    for (let y = 18; y < H; y++) { const ind = y > H - 8 ? (y - (H - 8)) * 2 : 0; for (let x = ind; x < W - ind - (y > 30 ? (y - 30) : 0); x++) P.px(x, y, y > H - 6 ? 0xa8282e : y > 30 && y < 34 ? 0x2a5aa8 : x < 3 ? 0xffffff : 0xe8ecf0); }   // skrovet
    P.hl(0, 18, W, 0xc8ccd4);
    text(P, SMALL, $t('SOLÖ-FÄRJAN'), 8, 23, 0x2a5aa8);
    P.rect(30, 6, 40, 12, 0xf4f1ea); P.rect(30, 6, 40, 2, 0x8a929c);                                                         // hytten
    for (let k = 0; k < 6; k++) P.rect(33 + k * 6, 9, 4, 5, 0x5a8ab8);
    P.rect(58, 0, 12, 7, 0xf4f1ea); P.rect(60, 2, 8, 3, 0x2a3a5a);                                                           // styrhytten
    P.vl(20, -1 + 4, 14, 0x5a5e66); P.rect(21, 4, 8, 5, 0x3a7bd5); P.hl(21, 6, 8, 0xf0d040); P.vl(23, 4, 5, 0xf0d040);         // flaggan
    for (let k = 0; k < 4; k++) P.rect(8 + k * 22, 15, 2, 3, 0xe04848);                                                      // livbojarna
  });
}
