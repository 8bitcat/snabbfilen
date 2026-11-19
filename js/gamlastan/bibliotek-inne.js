// 📚 BIBLIOTEKET I GAMLA STAN inifrån (Carl 2026-11-18: "bibliotek … läsa sig klokare, med poäng till livsmålet
// Utbildning"). Rummet är 640 px brett och rullar med figuren. Väggen (y < 72): dörren UT under TYST-skylten,
// grundarens porträtt över kortkatalogen, den stora BOKVÄGGEN med fem ämnen och stegen på rälsen, anslagstavlan och
// stadskartan bakom Gretas disk, VALVFÖNSTRET med glasmålningen (stadens fyra årstider), golvuret med pendeln,
// SAGOHYLLAN där katten Dewey sover högst upp och den öppna spisen i hörnet. Två ljuskronor hänger i taket.
// Golvet: fiskbensparkett, den stora persiska mattan vid läsborden, barnhörnans runda matta, dörrmattan och
// solstrimman från fönstret. Allt stillastående målas EN gång per dag/natt (paintBibBg); det som rör sig (ljusen,
// elden, pendeln och visarna, dammet i solstrimman, banklampornas sken) ritas av ritaBibLiv varje bildruta.
// Möblerna på golvet (läsborden, fåtöljerna, jordgloben, bokvagnen, tidningsstället, barnhörnans saker) ritas
// y-sorterade av scenen (js/scenes/bibliotek.js) med ritarna längst ner.
import { Pix, SMALL, text, textW, mix, mul, hash, bayer } from '../core/floor-pix.js';
import { PENNOR, FARGER } from '../tassbacken/hus.js';
import { BOK, bokrad, tavla, anslagstavla, dorrmatta, rundmatta } from '../tassbacken/inne-kit.js';
import { $t } from '../core/i18n.js';

const { tone, fyll, spr } = PENNOR;
const { VIT, MASS, JARN, ZINK, STEN, TRA, RODT, SAND, BLAD } = FARGER;
const GRON = [0x14301c, 0x1e4228, 0x285434, 0x336640, 0x42784e];     // väggfärgen: djup biblioteksgrön
const MAHOG = [0x2a1410, 0x4a2418, 0x6a3420, 0x8a4a2c, 0xa8643a];    // mahogny: bokväggen, uret, disken
const PARK = [0x5a3a1e, 0x7a5028, 0x9a6a36, 0xb08046, 0xc89a5c];     // parketten
const LADER = [0x4a1414, 0x6e1e1a, 0x8e2c24, 0xa8402e, 0xc05a40];    // rött läder: fåtöljerna, stolsdynorna
const GLASG = [0x0e3a24, 0x186a3c, 0x249a56, 0x48c47a, 0x8ae0a8];    // banklampornas gröna glas
const GLASM = [0x9a1a24, 0xd89a20, 0x2a8a4a, 0x2a4ab0, 0xd89a20, 0x9a1a24, 0x2a8a4a];   // glasmålningens fält
const MATTA = { falt: 0x8a2a2a, kant: 0xd8b070, motiv: 0x2a4a8a, ljus: 0xf0d8a0 };

export const BIB = {
  W: 640, H: 216, WALL_Y: 72,
  DOOR: { x0: 14, x1: 46 },
  KATALOG: { x0: 58, x1: 104 },                       // kortkatalogen med lådor (under porträttet)
  HYLLOR: { x0: 112, x1: 302, n: 5 },                 // den stora bokväggen: fem ämnen, 38 px var
  STEGE: { x: 232 },                                  // stegen på rälsen
  DISK: { x: 310, y: 84, w: 70, h: 24 },              // Gretas disk (golv)
  FONSTER: { x0: 394, x1: 466, y0: 8, y1: 66, cx: 430, cy: 42, r: 34 },   // valvfönstret
  KLOCKA: { x0: 478, x1: 502, cx: 490, cy: 20 },      // golvuret mot väggen
  HYLLA2: { x0: 512, x1: 598 },                       // sagohyllan – katten sover högst upp
  ELD: { x0: 604, x1: 638, y: 100 },                  // öppna spisen i hörnet
  BORD: [{ x: 184, y: 152 }, { x: 262, y: 194 }, { x: 396, y: 150 }, { x: 452, y: 196 }],   // läsborden
  FATOLJ: [{ x: 566, y: 146 }, { x: 604, y: 192 }],   // läsfåtöljerna framför elden
  BARN: { x0: 56, x1: 148, y0: 150, y1: 210, cx: 102, cy: 184 },        // barnhörnan
  GLOB: { x: 168, y: 118 },
  TIDNING: { x: 70, y: 120 },                         // tidningsstället
  VAGN: { x: 338, y: 128 },                           // bokvagnen med återlämnade böcker
  VAXT: { x: 498, y: 116 },
  KRONOR: [240, 430],                                 // taklamporna ovanför bilden (bara skenet syns, om natten)
  KATT: { x: 556, y: 14 },                            // Dewey på sagohyllan
  SOL: { x0: 380, x1: 486 },                          // solstrimman på golvet
};
const { W, H, WALL_Y, DOOR, KATALOG, HYLLOR, STEGE, FONSTER, KLOCKA, HYLLA2, ELD, BORD, BARN, KRONOR, SOL } = BIB;

// ämnena och böckerna: id, titel och det man lär sig (visas som tanke när boken är utläst)
export const AMNEN = [
  { id: 'historia', namn: $t('HISTORIA'), ik: '🏛️' }, { id: 'natur', namn: $t('NATUR'), ik: '🌿' }, { id: 'teknik', namn: $t('TEKNIK'), ik: '⚙️' },
  { id: 'konst', namn: $t('KONST'), ik: '🎨' }, { id: 'sagor', namn: $t('SAGOR'), ik: '🧚' },
];
export const BOCKER = {
  historia: [
    { id: 'hist1', titel: $t('Pixelstaden – från fiskeläge till storstad'), fakta: $t('Visste du att Pixelstaden började som tre fiskestugor vid Sjöboden?') },
    { id: 'hist2', titel: $t('Stadsporten 1699'), fakta: $t('Klockan i Stadsporten har aldrig stått still. Nyckeln förvaras här på Biblioteket.') },
    { id: 'hist3', titel: $t('Gamla stans gränder'), fakta: $t('Den smalaste gränden är bara 90 centimeter bred. Två katter får knappt plats i bredd.') },
  ],
  natur: [
    { id: 'nat1', titel: $t('Fåglarna på Pixelberg'), fakta: $t('Korpen på Pixelberg kan härma berg-och-dalbanans tjut. Den gör det varje morgon.') },
    { id: 'nat2', titel: $t('Skärgårdens fiskar'), fakta: $t('Abborren vid Solön känner igen den som matar den. Fiskarna kallar honom Bosse.') },
    { id: 'nat3', titel: $t('Den stora trädgårdsboken'), fakta: $t('Tomater vill ha sol och vatten – men inte för mycket av något. Precis som vi.') },
  ],
  teknik: [
    { id: 'tek1', titel: $t('Så funkar en dator'), fakta: $t('En dator kan bara räkna till ett. Men den gör det väldigt, väldigt snabbt.') },
    { id: 'tek2', titel: $t('Rymdraketer för nybörjare'), fakta: $t('En raket flyger inte för att den trycker mot luften – utan för att den kastar bränsle bakåt.') },
    { id: 'tek3', titel: $t('Bygg din egen radio'), fakta: $t('Radiovågor går rakt genom väggar. Därför hörs Pixelradion även inne i husvagnen.') },
  ],
  konst: [
    { id: 'kon1', titel: $t('Konstens historia i bilder'), fakta: $t('Den äldsta målningen i staden är en katt på Stadsportens vägg – från 1699.') },
    { id: 'kon2', titel: $t('Måla med pixlar'), fakta: $t('Allt i Pixelstaden är gjort av små rutor. Titta riktigt nära – då ser du dem.') },
    { id: 'kon3', titel: $t('Teaterns mästare'), fakta: $t('Teatern har en lönnlucka i scengolvet. Bara Regissör Rut vet var den är.') },
  ],
  sagor: [
    { id: 'sag1', titel: $t('Tummelisa'), fakta: $t('Tummelisa var inte större än en tumme – men hon vågade mer än de flesta.') },
    { id: 'sag2', titel: $t('Husvagnen som ville bli villa'), fakta: $t('Husvagnen fick aldrig något staket. Men den fick hjul, och det var bättre.') },
    { id: 'sag3', titel: $t('Spöket på Pixelberg'), fakta: $t('Spöket var rädd för mörkret – tills någon gav det en lykta från Lyktmakaren.') },
  ],
};
export const bokAv = (id) => Object.values(BOCKER).flat().find((b) => b.id === id) || null;

const qm = (a, b, t, x, y) => mix(a, b, Math.floor(Math.max(0, Math.min(1, t)) * 4 + bayer(x, y)) / 4);
const KEY = (P, x, y) => { for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1], [-1, -2], [1, -3], [3, -2], [-2, 0], [3, 0]]) P.px(x + dx, y + dy, MASS[3]); };

// ================= bakgrunden (en per dag/natt) =================
const BGS = {};
export function paintBibBg(natt = false) {
  const k = natt ? 'n' : 'd';
  if (BGS[k]) return BGS[k];
  const P = new Pix(W, H);
  // väggen: djupgrön färg med en svag struktur, bröstpanel i mahogny nertill, taklist och tavellist
  for (let y = 0; y < WALL_Y; y++) for (let x = 0; x < W; x++) P.px(x, y, tone(GRON, 0.58 + (hash(x >> 2, y >> 2, 3) - 0.5) * 0.08 - y * 0.0015, x, y));
  for (let x = 0; x < W; x++) for (let y = WALL_Y - 18; y < WALL_Y; y++) P.px(x, y, y === WALL_Y - 18 ? MAHOG[4] : y === WALL_Y - 17 ? MAHOG[3] : y >= WALL_Y - 2 ? MAHOG[0] : ((x % 14) === 0 ? MAHOG[1] : tone(MAHOG, 0.52 + (hash(x >> 2, y, 3) - 0.5) * 0.12 + ((x % 14) === 1 ? 0.1 : 0), x, y)));
  P.rect(0, 0, W, 3, MAHOG[1]); P.hl(0, 3, W, MAHOG[4]); P.hl(0, 4, W, MAHOG[2]);
  P.hl(0, 9, W, MAHOG[3], 0.6);   // tavellisten
  // dörren UT: valvbåge, mörk ek, litet fönster med UT-skylt, mässingshandtag och TYST-skylten ovanför
  fyll(P, DOOR.x0 - 4, 10, DOOR.x1 + 3, WALL_Y, (X, Y) => { const cx = (DOOR.x0 + DOOR.x1) / 2, r = (DOOR.x1 - DOOR.x0) / 2 + 4; if (Y < 10 + r && Math.hypot(X + 0.5 - cx, Y - 10 - r) > r) return null; return STEN[2]; });
  fyll(P, DOOR.x0 - 1, 13, DOOR.x1, WALL_Y, (X, Y) => { const cx = (DOOR.x0 + DOOR.x1) / 2, r = (DOOR.x1 - DOOR.x0) / 2 + 1; if (Y < 13 + r && Math.hypot(X + 0.5 - cx, Y - 13 - r) > r) return null; return tone(MAHOG, 0.42 + (((X - DOOR.x0) % 8 === 0) ? -0.15 : 0) + (hash(X >> 2, Y, 3) - 0.5) * 0.1, X, Y); });
  P.rect(DOOR.x0 + 7, 26, 18, 14, 0xb8e4f4); P.box(DOOR.x0 + 7, 26, 18, 14, MASS[2]); P.line(DOOR.x0 + 9, 28, DOOR.x0 + 16, 36, 0xffffff, 0.3);
  P.rect(DOOR.x0 + 6, 43, 20, 9, 0x1d2b1f); text(P, SMALL, $t('UT'), DOOR.x0 + 12, 45, 0x6fe08a);
  P.px(DOOR.x1 - 5, 46, MASS[3]); P.px(DOOR.x1 - 5, 47, MASS[2]); P.rect(DOOR.x0 + 2, 55, 3, 1, MASS[2]); P.rect(DOOR.x0 + 2, 32, 3, 1, MASS[2]);   // handtag, beslag
  { const s = $t('TYST'), tw = textW(SMALL, s); P.rect(30 - (tw >> 1) - 3, 1, tw + 6, 9, MASS[2]); P.box(30 - (tw >> 1) - 3, 1, tw + 6, 9, MASS[4]); text(P, SMALL, s, 30 - (tw >> 1), 3, 0x2a1a0c); }
  // grundarens porträtt i oval guldram över kortkatalogen
  fyll(P, 66, 12, 96, 40, (X, Y) => { const d = Math.hypot((X + 0.5 - 81) / 15.5, (Y + 0.5 - 26) / 14.5); return d > 1 ? null : d > 0.86 ? tone(MASS, X < 81 ? 0.85 : 0.45, X, Y) : tone([0x2a2418, 0x3a3020, 0x4a3c28, 0x5a4830, 0x6a5438], 0.55 + (Y - 12) * 0.01, X, Y); });
  spr(P, 76, 18, ['.hhhhh.', 'hhhhhhh', 'hsssssh', 'hskskshs', '.sssss.', '..sms..', '.kkkkk.', 'kkwwwkk', 'kkwwwkk'], { h: 0xd8d8d0, s: 0xe8c0a0, k: 0x2a2a30, m: 0xb07060, w: 0xf4f1ea });
  P.rect(74, 38, 14, 2, MASS[3]); P.hl(76, 38, 10, MASS[4]);   // namnplåten
  // kortkatalogen: lådor i tre rader med mässingsgrepp och lappar
  fyll(P, KATALOG.x0, 44, KATALOG.x1, WALL_Y + 2, (X, Y) => (X === KATALOG.x0 || X === KATALOG.x1 || Y === 44) ? MAHOG[1] : tone(MAHOG, 0.5, X, Y));
  for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) { const lx = KATALOG.x0 + 3 + c * 11, ly = 47 + r * 8; P.rect(lx, ly, 9, 6, MAHOG[3]); P.hl(lx, ly, 9, MAHOG[4]); P.rect(lx + 3, ly + 1, 3, 2, 0xf4ecd8); P.px(lx + 4, ly + 4, MASS[3]); }
  // den stora bokväggen: mahognyram, fem sektioner med namnplåtar och fem hyllplan fulla av böcker
  fyll(P, HYLLOR.x0 - 3, 6, HYLLOR.x1 + 3, WALL_Y + 3, (X, Y) => (X <= HYLLOR.x0 - 2 || X >= HYLLOR.x1 + 2 || Y <= 7) ? MAHOG[1] : tone(MAHOG, 0.36 - (Y - 8) * 0.002, X, Y));
  P.hl(HYLLOR.x0 - 3, 6, HYLLOR.x1 - HYLLOR.x0 + 7, MAHOG[4]); P.hl(HYLLOR.x0 - 3, 5, HYLLOR.x1 - HYLLOR.x0 + 7, MASS[2]);   // rälsen för stegen
  const sw = (HYLLOR.x1 - HYLLOR.x0) / HYLLOR.n;
  for (let s = 0; s <= HYLLOR.n; s++) { const sx = Math.round(HYLLOR.x0 + s * sw); P.vl(sx - 1, 8, WALL_Y - 6, MAHOG[1]); P.vl(sx, 8, WALL_Y - 6, MAHOG[3]); }
  for (let s = 0; s < HYLLOR.n; s++) {
    const sx = Math.round(HYLLOR.x0 + s * sw) + 2, ex = Math.round(HYLLOR.x0 + (s + 1) * sw) - 2;
    for (const hy of [20, 32, 44, 56, 68]) { P.hl(sx, hy, ex - sx, MAHOG[4]); P.hl(sx, hy + 1, ex - sx, MAHOG[2]); P.hl(sx, hy + 2, ex - sx, 0x000000, 0.2); bokrad(P, sx + 1, hy, ex - sx - 1, s * 7 + hy); }
    const nm = AMNEN[s].namn, tw = Math.min(textW(SMALL, nm), ex - sx - 4);
    P.rect(sx + 1, 10, ex - sx - 2, 8, MASS[2]); P.hl(sx + 1, 10, ex - sx - 2, MASS[4]); P.hl(sx + 1, 17, ex - sx - 2, MASS[0]);
    P.clip(sx + 2, 10, ex - 2, 18); text(P, SMALL, nm, Math.round((sx + ex) / 2 - tw / 2), 12, 0x2a1a0c); P.clip();
  }
  // stegen på rälsen (rälsen sitter under namnplåtarna så att ämnena syns): två ekstänger och sju pinnar, lutad mot hyllan
  P.hl(HYLLOR.x0 - 1, 19, HYLLOR.x1 - HYLLOR.x0 + 2, MASS[2]); P.hl(HYLLOR.x0 - 1, 18, HYLLOR.x1 - HYLLOR.x0 + 2, MASS[4], 0.6);
  for (let j = 0; j < 52; j++) { const lx = STEGE.x + Math.round(j * 0.14); P.px(lx, 20 + j, TRA[3]); P.px(lx + 7, 20 + j, TRA[3]); P.px(lx + 1, 20 + j, TRA[1], 0.6); P.px(lx + 8, 20 + j, TRA[1], 0.6); }
  for (let r = 0; r < 7; r++) { const ry = 25 + r * 7, lx = STEGE.x + Math.round((ry - 20) * 0.14); P.hl(lx + 1, ry, 7, TRA[4]); P.hl(lx + 1, ry + 1, 7, TRA[1], 0.5); }
  P.rect(STEGE.x - 1, 17, 10, 3, MASS[3]); P.px(STEGE.x, 18, MASS[4]); P.px(STEGE.x + 7, 18, MASS[4]);   // hjulhuset på rälsen
  // bakom disken: anslagstavlan med lappar och stadskartan i ram
  anslagstavla(P, 306, 14, 40, 30, 5);
  tavla(P, 350, 14, 30, 24, 'karta', 0xe8dcc0, MAHOG);
  for (const [dx, dy, w, h, c] of [[4, 5, 6, 4, 0x9ad860], [12, 4, 8, 5, 0xe07a5a], [5, 12, 9, 5, 0x8ab4d8], [16, 11, 7, 6, 0xf0c030], [4, 18, 20, 2, 0x5890e8]]) P.rect(350 + dx, 14 + dy, w, h, c);
  P.px(363, 24, RODT[2]); P.px(364, 24, RODT[2]); P.px(363, 25, RODT[2]);   // "här är du"
  // valvfönstret: stenomfattning med slutsten, glasmålning i bågen (stadens fyra årstider), glas med utsikt nertill
  const F = FONSTER, half = (Y) => (Y < F.cy ? Math.sqrt(Math.max(0, F.r * F.r - (F.cy - Y) * (F.cy - Y))) : F.r);
  fyll(P, F.x0 - 4, F.y0 - 4, F.x1 + 4, F.y1 + 4, (X, Y) => { const dx = Math.abs(X + 0.5 - F.cx), hw = Y < F.cy ? Math.sqrt(Math.max(0, (F.r + 4) ** 2 - (F.cy - Y) ** 2)) : F.r + 4; return dx > hw ? null : tone(STEN, 0.62 + (((X + Y) % 9 === 0) ? -0.15 : 0) + (hash(X >> 1, Y >> 2, 5) - 0.5) * 0.1, X, Y); });
  fyll(P, F.x0, F.y0, F.x1, F.y1, (X, Y) => {
    const dx = X + 0.5 - F.cx, hw = half(Y);
    if (Math.abs(dx) > hw) return null;
    if (Y < F.cy) {   // glasmålningen: sju fält i bågen, en gul sol i mitten, blyinfattning
      const d = Math.hypot(dx, F.cy - Y), a = Math.atan2(F.cy - Y, dx);
      if (d < 11) return d > 9.5 ? 0x2a2a30 : d < 4 ? 0xfff0a0 : (((Math.round(a * 4) + Math.round(d)) % 3) ? 0xf0c030 : 0xf8e070);
      const sek = Math.min(6, Math.floor(a / (Math.PI / 7))), kant = Math.abs((a / (Math.PI / 7)) % 1 - 0.5) > 0.46 || Math.abs(d - 22) < 0.7;
      if (kant) return 0x2a2a30;
      const c = GLASM[sek];
      return natt ? mul(c, 0.5) : qm(mix(c, 0xffffff, 0.3), c, (hash(X >> 1, Y >> 1, 7)), X, Y);
    }
    if (natt) return qm(0x0e1626, 0x22324e, (Y - F.cy) / 24, X, Y);
    return qm(0xb8e0f8, 0x7ab8e0, (Y - F.cy) / 24, X, Y);
  });
  if (!natt) for (let x = F.x0 + 2; x < F.x1 - 2; x += 18) { const hh = 7 + ((hash(x, 1, 3) * 5) | 0), c = [0xe07a5a, 0xf0c030, 0xc87a5a, 0xb8a080][((x / 18) | 0) % 4]; fyll(P, x, F.y1 - 9 - hh, x + 12, F.y1 - 9, (X, Y) => tone([mul(c, 0.6), mul(c, 0.8), c, mix(c, 0xffffff, 0.25), mix(c, 0xffffff, 0.5)], 0.6 + (Y === F.y1 - 9 - hh ? 0.2 : 0), X, Y)); for (let j = 0; j < 4; j++) P.hl(x - 1 + j, F.y1 - 10 - hh - 4 + j, 14 - j * 2, 0x6a3a30); for (let i = 0; i < 2; i++) P.rect(x + 2 + i * 5, F.y1 - 7 - hh, 2, 2, 0xd8f0ff); }   // gaveltaken på andra sidan torget
  else { P.px(F.cx + 14, F.cy + 6, 0xfff6d0); P.px(F.cx - 10, F.cy + 10, 0xfff6d0); P.px(F.cx + 4, F.cy + 16, 0xffffff, 0.7); for (let x = F.x0 + 6; x < F.x1 - 6; x += 16) P.rect(x + 3, F.y1 - 8, 2, 2, 0xffd880); }   // stjärnor och tända fönster
  for (let x = F.x0; x < F.x1; x++) { const th = 5 + Math.round(Math.sin(x / 5) * 1.5); for (let y = F.y1 - th; y < F.y1; y++) P.px(x, y, tone(BLAD, (natt ? 0.25 : 0.5) + (hash(x >> 1, y >> 1, 5) - 0.5) * 0.3, x, y)); }   // trädkronorna
  P.vl(F.cx, F.cy, F.y1 - F.cy, 0x2a2a30); P.hl(F.x0, F.cy, F.x1 - F.x0, 0x2a2a30); P.hl(F.x0, F.cy + 12, F.x1 - F.x0, 0x2a2a30, 0.7);   // spröjs
  if (!natt) for (let k = 0; k < 3; k++) P.line(F.x0 + 8 + k * 20, F.cy + 3, F.x0 + 16 + k * 20, F.cy + 16, 0xffffff, 0.25);
  P.rect(F.cx - 3, F.y0 - 6, 6, 5, STEN[3]); P.hl(F.cx - 3, F.y0 - 6, 6, STEN[4]);   // slutstenen
  P.hl(F.x0 - 6, F.y1 + 4, F.x1 - F.x0 + 12, STEN[4]); P.hl(F.x0 - 6, F.y1 + 5, F.x1 - F.x0 + 12, STEN[1]);   // fönsterbänken i sten
  for (const [bx, c] of [[F.x0 + 6, 0xe04848], [F.x1 - 14, 0x8a5ad0]]) { PENNOR.kruka(P, bx, F.y1 + 3, c); }
  // golvuret: sockel, midja med glasdörr (pendeln ritas i ritaBibLiv), huv med urtavla och spira
  const K = KLOCKA;
  fyll(P, K.x0, 58, K.x1, WALL_Y + 6, (X, Y) => (X === K.x0 || X === K.x1 || Y === 58) ? MAHOG[1] : tone(MAHOG, 0.55 - (X - K.x0) * 0.008, X, Y));
  P.hl(K.x0 - 1, 57, K.x1 - K.x0 + 3, MAHOG[4]); P.hl(K.x0 - 1, WALL_Y + 6, K.x1 - K.x0 + 3, MAHOG[0]);
  fyll(P, K.x0 + 3, 34, K.x1 - 3, 58, (X, Y) => (X === K.x0 + 3 || X === K.x1 - 3) ? MAHOG[1] : (X > K.x0 + 5 && X < K.x1 - 5 && Y > 36 && Y < 56) ? 0x0c0a10 : tone(MAHOG, 0.5, X, Y));
  P.box(K.x0 + 6, 37, K.x1 - K.x0 - 11, 19, MASS[2]); P.line(K.x0 + 7, 38, K.x0 + 9, 46, 0xffffff, 0.25);
  fyll(P, K.x0 - 2, 8, K.x1 + 2, 34, (X, Y) => (X === K.x0 - 2 || X === K.x1 + 2 || Y === 8) ? MAHOG[1] : tone(MAHOG, 0.56 - (X - K.x0) * 0.006, X, Y));
  for (let j = 0; j < 4; j++) P.hl(K.x0 - 2 + j * 2, 7 - j, K.x1 - K.x0 + 5 - j * 4, j === 3 ? MASS[3] : MAHOG[3]);   // krönet
  P.rect(K.cx - 1, 1, 2, 3, MASS[3]); P.px(K.cx, 0, MASS[4]);   // spiran
  fyll(P, K.cx - 9, K.cy - 9, K.cx + 9, K.cy + 9, (X, Y) => { const d = Math.hypot(X + 0.5 - K.cx, Y + 0.5 - K.cy); return d > 9.5 ? null : d > 8 ? tone(MASS, X < K.cx ? 0.85 : 0.45, X, Y) : 0xfaf6ea; });
  for (const [dx, dy] of [[0, -6], [0, 6], [-6, 0], [6, 0], [4, -4], [-4, -4], [4, 4], [-4, 4]]) P.px(K.cx + dx, K.cy + dy, 0x3a3a42);
  P.px(K.x0 + 1, 10, MASS[3]); P.px(K.x1 - 1, 10, MASS[3]);
  // sagohyllan: två sektioner, bilderböcker (tjocka, låga) nertill, en nalle och en lykta, katten sover högst upp (scenen)
  fyll(P, HYLLA2.x0 - 3, 8, HYLLA2.x1 + 3, WALL_Y + 3, (X, Y) => (X <= HYLLA2.x0 - 2 || X >= HYLLA2.x1 + 2 || Y <= 9) ? MAHOG[1] : tone(MAHOG, 0.36 - (Y - 8) * 0.002, X, Y));
  P.hl(HYLLA2.x0 - 3, 8, HYLLA2.x1 - HYLLA2.x0 + 7, MAHOG[4]); P.vl(555, 10, WALL_Y - 8, MAHOG[1]); P.vl(556, 10, WALL_Y - 8, MAHOG[3]);
  for (const hy of [30, 44, 58, 70]) { P.hl(HYLLA2.x0, hy, HYLLA2.x1 - HYLLA2.x0, MAHOG[4]); P.hl(HYLLA2.x0, hy + 1, HYLLA2.x1 - HYLLA2.x0, MAHOG[2]); P.hl(HYLLA2.x0, hy + 2, HYLLA2.x1 - HYLLA2.x0, 0x000000, 0.2); }
  bokrad(P, HYLLA2.x0 + 2, 30, 40, 31); bokrad(P, 558, 30, 38, 32);
  for (const [bx, hy, n, s] of [[HYLLA2.x0 + 2, 44, 7, 3], [558, 44, 6, 4], [HYLLA2.x0 + 2, 58, 6, 5], [566, 58, 5, 6]]) for (let i = 0; i < n; i++) { const c = BOK[(i + s) % BOK.length], bw = 5, bh = 7 + (i % 2); fyll(P, bx + i * 6, hy - bh, bx + i * 6 + bw - 1, hy - 1, (X) => (X === bx + i * 6 ? mix(c, 0xffffff, 0.3) : X === bx + i * 6 + bw - 1 ? mul(c, 0.7) : c)); P.px(bx + i * 6 + 2, hy - bh + 2, mix(c, 0xffffff, 0.6)); }
  spr(P, 560, 50, ['.n.n.', 'nnnnn', 'nknkn', 'nnnnn', '.nnn.', 'nnnnn', 'n.n.n'], { n: 0xb07a40, k: 0x1a1414 });   // nallen
  P.hl(HYLLA2.x0 + 2, 70, 30, 0x000000, 0.1); P.rect(HYLLA2.x0 + 26, 62, 4, 7, MASS[2]); P.rect(HYLLA2.x0 + 27, 63, 2, 5, natt ? 0xffe8a0 : 0xd8e8f0);   // lyktan
  P.hl(HYLLA2.x0 - 2, 10, HYLLA2.x1 - HYLLA2.x0 + 5, MAHOG[4]); P.hl(HYLLA2.x0 - 2, 11, HYLLA2.x1 - HYLLA2.x0 + 5, MAHOG[2]);   // översta hyllplanet (Dewey)
  // öppna spisen i hörnet: stenomfattning, spiselkrans med ljusstakar och en vas, svart eldstad (elden i ritaBibLiv), härden
  fyll(P, ELD.x0, 22, ELD.x1 + 1, WALL_Y + 6, (X, Y) => tone(STEN, 0.5 + (((X + Y * 3) % 11 === 0) ? -0.18 : 0) + (hash(X >> 2, Y >> 2, 8) - 0.5) * 0.14, X, Y));
  P.rect(ELD.x0 - 2, 20, ELD.x1 - ELD.x0 + 5, 4, MAHOG[3]); P.hl(ELD.x0 - 2, 20, ELD.x1 - ELD.x0 + 5, MAHOG[4]); P.hl(ELD.x0 - 2, 23, ELD.x1 - ELD.x0 + 5, MAHOG[1]);
  fyll(P, ELD.x0 + 6, 40, ELD.x1 - 6, WALL_Y + 2, (X, Y) => { const cx = (ELD.x0 + ELD.x1) / 2, r = (ELD.x1 - ELD.x0) / 2 - 6; if (Y < 40 + r && Math.hypot(X + 0.5 - cx, Y - 40 - r) > r) return null; return 0x0a0608; });
  for (const [vx, h] of [[ELD.x0 + 4, 6], [ELD.x0 + 9, 8], [ELD.x1 - 8, 7]]) { P.rect(vx, 20 - h, 2, h, 0xf4f1ea); P.rect(vx - 1, 20 - h - 1, 4, 1, MASS[3]); P.rect(vx - 1, 19, 4, 1, MASS[2]); }   // ljusen
  fyll(P, ELD.x1 - 20, 10, ELD.x1 - 13, 20, (X, Y) => (Y === 10 || Y === 11 ? 0x2a4a8a : Math.abs(X + 0.5 - (ELD.x1 - 16.5)) > 2.5 + Math.sin((Y - 10) / 3) ? null : 0x3a7bd5)); P.px(ELD.x1 - 17, 8, 0xe0383c); P.px(ELD.x1 - 15, 7, 0xf06aa0);   // vasen
  P.rect(ELD.x0 + 8, WALL_Y - 6, ELD.x1 - ELD.x0 - 16, 2, 0x3a2214); P.rect(ELD.x0 + 10, WALL_Y - 4, ELD.x1 - ELD.x0 - 20, 2, 0x5a3a1e);   // vedträna
  malaGolv(P, natt);
  if (natt) P.darken(0, 0, W, H, 0.74);
  P.box(0, 0, W, H, 0x0e0d12);
  BGS[k] = P.flush();
  return BGS[k];
}
// golvet: fiskbensparkett, den persiska mattan, barnhörnans runda matta, dörrmattan, solstrimman och härden
function malaGolv(P, natt) {
  for (let y = WALL_Y; y < H; y++) for (let x = 0; x < W; x++) {
    const a = Math.floor((x + y) / 6), b = Math.floor((x - y + 600) / 6), k = (a + b) & 1;
    let c = tone(PARK, (k ? 0.58 : 0.46) + (hash(k ? a : b, k ? b : a, 9) - 0.5) * 0.12, x, y);
    if ((x + y) % 6 === 0 || (x - y + 600) % 6 === 0) c = mul(c, 0.82);
    P.px(x, y, c);
  }
  for (let i = 0; i < 5; i++) P.darken(0, WALL_Y + i, W, 1, 0.78 + i * 0.045);
  // härden framför spisen (stenplattor)
  fyll(P, ELD.x0 - 4, WALL_Y + 6, ELD.x1 + 1, WALL_Y + 14, (X, Y) => tone(STEN, 0.55 + (((X >> 3) + (Y >> 2)) & 1 ? 0.08 : 0), X, Y));
  // den persiska mattan vid läsborden: rött fält, krämig bård med mönster, medaljong i mitten, små motiv
  { const x0 = 334, x1 = 486, y0 = 122, y1 = 208, cx = 410, cy = 165;
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      const e = Math.min(x - x0, x1 - 1 - x, y - y0, y1 - 1 - y);
      let c = e < 2 ? MATTA.kant : e < 7 ? ((((x + y) >> 1) & 1) ? MATTA.motiv : MATTA.kant) : e < 8 ? MATTA.kant : MATTA.falt;
      if (e >= 8) { const d = Math.abs(x - cx) / 36 + Math.abs(y - cy) / 20; if (d < 1 && d > 0.88) c = MATTA.kant; else if (d <= 0.88 && d > 0.5) c = ((x + y) & 3) === 0 ? MATTA.ljus : MATTA.motiv; else if (d <= 0.5 && d > 0.42) c = MATTA.kant; else if (d <= 0.42) c = (x + y) & 1 ? MATTA.falt : MATTA.motiv; else if (((x - x0) % 24 === 12 || (x - x0) % 24 === 13) && ((y - y0) % 16 === 8 || (y - y0) % 16 === 9)) c = MATTA.ljus; }
      P.px(x, y, mix(c, mul(c, 0.9), hash(x >> 2, y, 6) * 0.5));
    }
    for (let x = x0; x < x1; x += 3) { P.px(x, y0 - 1, MATTA.kant); P.px(x + 1, y1, MATTA.kant); }   // fransarna
  }
  rundmatta(P, BARN.cx, BARN.cy, 44, 22, 0x3a7bd5, 0xf0c030);
  for (let y = 78; y < 90; y++) for (let x = DOOR.x0 - 4; x < DOOR.x1 + 4; x++) P.px(x, y, (x + y) % 2 ? 0x6a4424 : 0x4a2c18);   // dörrmattan
  KEY(P, 29, 83);
  if (!natt) for (let y = WALL_Y + 6; y < WALL_Y + 52; y++) for (let x = SOL.x0 - 10; x < SOL.x1 + 10; x++) { const k = (x - SOL.x0) - (y - WALL_Y) * 0.5; if (k > 0 && k < SOL.x1 - SOL.x0) P.px(x, y, 0xfff4c8, 0.14); }   // solstrimman
}

// ================= det som rör sig (varje bildruta) =================
// klockMin = spelets klocka i minuter sedan midnatt (visarna på golvuret)
export function ritaBibLiv(ctx, t, natt, klockMin = 0) {
  const R = (c, x, y, w = 1, h = 1) => { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), w, h); };
  // det varma skenet från taklamporna ovanför bilden (själva lamporna hänger utanför rutan)
  if (natt) for (const kx of KRONOR) { const g = ctx.createRadialGradient(kx, -6, 2, kx, -6, 70); g.addColorStop(0, 'rgba(255,214,120,.3)'); g.addColorStop(1, 'rgba(255,214,120,0)'); ctx.fillStyle = g; ctx.fillRect(kx - 70, -10, 140, 80); }
  // elden i spisen: flammor, glöd, gnistor och skenet över härden
  const ux = (ELD.x0 + ELD.x1) >> 1, uy = WALL_Y - 7;
  for (let k = 0; k < 7; k++) { const ph = t * 7 + k * 1.3, h = 5 + Math.round(Math.sin(ph) * 2.5 + Math.sin(ph * 2.3) * 1.5), x = ux - 7 + k * 2; for (let j = 0; j < h; j++) R(j < h - 3 ? '#ffe060' : j < h - 1 ? '#ff8a20' : '#d83a1a', x, uy - j, 2, 1); }
  R('#ff6a20', ux - 8, uy + 1, 16, 1); if (Math.floor(t * 9) % 4 === 0) R('#fff0a0', ux - 3 + (Math.floor(t * 5) % 5), uy - 12 - (Math.floor(t * 3) % 4), 1, 1);
  const g2 = ctx.createRadialGradient(ux, uy - 4, 1, ux, uy - 4, 40); g2.addColorStop(0, `rgba(255,150,60,${natt ? 0.5 : 0.35})`); g2.addColorStop(1, 'rgba(255,150,60,0)'); ctx.fillStyle = g2; ctx.fillRect(ux - 40, uy - 44, 80, 80);
  // golvuret: pendeln svänger, visarna går efter spelets klocka
  const K = KLOCKA, a = Math.sin(t * Math.PI) * 0.3;
  for (let j = 0; j < 16; j++) R(j === 15 ? '#e6be4c' : '#c0922c', K.cx + Math.sin(a) * j, 38 + Math.cos(a) * j, 1, 1);
  R('#e6be4c', K.cx + Math.sin(a) * 16 - 1, 38 + Math.cos(a) * 16 - 1, 3, 3); R('#fff0a0', K.cx + Math.sin(a) * 16 - 1, 38 + Math.cos(a) * 16 - 1, 1, 1);
  const hh = ((klockMin / 60) % 12) / 12 * Math.PI * 2, mm = (klockMin % 60) / 60 * Math.PI * 2;
  for (let j = 0; j < 4; j++) R('#1c1a20', K.cx + Math.sin(hh) * j, K.cy - Math.cos(hh) * j, 1, 1);
  for (let j = 0; j < 6; j++) R('#1c1a20', K.cx + Math.sin(mm) * j, K.cy - Math.cos(mm) * j, 1, 1);
  R('#d8343c', K.cx, K.cy, 1, 1);
  // dammet som dansar i solstrimman (bara på dagen)
  if (!natt) for (let k = 0; k < 14; k++) { const u = (t * 0.05 + hash(k, 2, 9)) % 1, x = SOL.x0 + 6 + hash(k, 1, 9) * (SOL.x1 - SOL.x0 - 12) - u * 20, y = WALL_Y + 8 + u * 40 + Math.sin(t * 1.3 + k) * 2; if (x - SOL.x0 - (y - WALL_Y) * 0.5 > 0) R(`rgba(255,246,210,${(0.35 + Math.sin(t * 2 + k) * 0.2).toFixed(2)})`, x, y, 1, 1); }
}

// ================= golvsaker (cachade bilder, origo = foten) =================
const S = new Map();
function bild(key, w, h, ax, ay, fn) { if (S.has(key)) return S.get(key); const P = new Pix(w, h, -ax, -ay); fn(P); const s = { img: P.flush(), ax, ay }; S.set(key, s); return s; }
const put = (ctx, s, x, y) => ctx.drawImage(s.img, Math.round(x) - s.ax, Math.round(y) - s.ay);
const skugga = (ctx, x, y, w) => { ctx.fillStyle = 'rgba(20,12,30,.24)'; ctx.fillRect(Math.round(x - w / 2), Math.round(y) - 1, Math.round(w), 3); };

// 🪑 läsbordet: ekbord med banklampa (grönt glas, mässing), en bokstapel, två stolar med röda dynor.
// o.lampa = tänd (natt), o.bok = en bok ligger uppslagen på bordet, o.progress 0–1 ritar läsmätaren ovanför
export function ritaBord(ctx, B, o = {}) {
  skugga(ctx, B.x, B.y, 40);
  for (const s of [-1, 1]) put(ctx, bild('stol|' + s, 12, 20, 6, 18, (P) => {
    fyll(P, -4, -17, 3, -9, (X, Y) => (Y === -17 ? MAHOG[4] : X === -4 || X === 3 ? MAHOG[1] : (Y % 3 === 0 ? MAHOG[1] : MAHOG[3])));   // ryggen
    P.rect(-4, -9, 8, 2, LADER[3]); P.hl(-4, -9, 8, LADER[4]); P.rect(-4, -7, 8, 1, MAHOG[2]);
    P.vl(-4, -6, 6, MAHOG[1]); P.vl(3, -6, 6, MAHOG[1]); P.px(-4, -6, MAHOG[3]); P.px(3, -6, MAHOG[3]);
  }), B.x + s * 16, B.y + 2);
  put(ctx, bild('bord', 44, 30, 22, 28, (P) => {
    P.rect(-2, -14, 4, 14, MAHOG[1]); P.rect(-8, -2, 16, 2, MAHOG[0]); P.vl(-1, -14, 14, MAHOG[3]);   // foten
    fyll(P, -18, -18, 17, -14, (X, Y) => (Y === -18 ? MAHOG[4] : Y === -17 ? MAHOG[3] : Y === -14 ? MAHOG[0] : tone(MAHOG, 0.5 + (hash(X >> 2, 1, 3) - 0.5) * 0.1, X, Y)));
    P.hl(-16, -17, 30, MAHOG[4], 0.5);
    // banklampan: mässingsfot och stång, grön glasskärm med ljus undersida
    P.rect(8, -21, 5, 3, MASS[2]); P.hl(8, -21, 5, MASS[4]); P.vl(10, -28, 7, MASS[3]);
    for (let j = 0; j < 4; j++) P.hl(10 - 6 - j, -31 + j, 12 + j * 2, j === 3 ? GLASG[1] : tone(GLASG, 0.6 - j * 0.06, j, j));
    P.hl(3, -32, 14, GLASG[4]); P.hl(4, -27, 12, 0xfff6c0);
    // bokstapeln och en penna
    P.rect(-15, -21, 9, 3, 0xd84a6a); P.hl(-15, -21, 9, 0xf07ab8); P.rect(-14, -24, 8, 3, 0x3a7bd5); P.hl(-14, -24, 8, 0x8ab4e8); P.rect(-15, -26, 7, 2, 0x46a35a);
    P.hl(-4, -19, 6, 0xf0c030); P.px(2, -19, 0x2a2a30);
  }), B.x, B.y);
  if (o.bok) { ctx.fillStyle = '#f8f4e8'; ctx.fillRect(B.x - 6, B.y - 21, 12, 5); ctx.fillStyle = '#5a3a28'; ctx.fillRect(B.x - 7, B.y - 21, 1, 5); ctx.fillRect(B.x + 6, B.y - 21, 1, 5); ctx.fillStyle = '#9a9a8a'; ctx.fillRect(B.x - 4, B.y - 20, 3, 1); ctx.fillRect(B.x + 1, B.y - 20, 3, 1); ctx.fillRect(B.x - 4, B.y - 18, 3, 1); ctx.fillRect(B.x + 1, B.y - 18, 3, 1); }
  if (o.lampa) { const g = ctx.createRadialGradient(B.x + 10, B.y - 26, 1, B.x + 10, B.y - 26, 30); g.addColorStop(0, 'rgba(255,236,160,.45)'); g.addColorStop(1, 'rgba(255,236,160,0)'); ctx.fillStyle = g; ctx.fillRect(B.x - 20, B.y - 56, 60, 60); }
  if (o.progress != null) { const w = 34, x = B.x - 17, y = B.y - 44; ctx.fillStyle = 'rgba(20,12,30,.8)'; ctx.fillRect(x - 1, y - 1, w + 2, 6); ctx.fillStyle = '#5a3a28'; ctx.fillRect(x, y, w, 4); ctx.fillStyle = '#f0c030'; ctx.fillRect(x, y, Math.round(w * Math.max(0, Math.min(1, o.progress))), 4); ctx.fillStyle = '#fff6d0'; ctx.fillRect(x, y, Math.round(w * Math.max(0, Math.min(1, o.progress))), 1); }
}
// 📖 en uppslagen bok i händerna på den som sitter och läser (bladen vänds)
export function ritaBokIHand(ctx, x, y, t, dir = 'right') {
  const X = Math.round(x) + (dir === 'left' ? -9 : 1), Y = Math.round(y) - 15, flip = Math.floor(t * 1.5) % 4 === 0;
  ctx.fillStyle = '#5a3a28'; ctx.fillRect(X - 1, Y, 10, 6); ctx.fillStyle = '#f8f4e8'; ctx.fillRect(X, Y, 4, 5); ctx.fillRect(X + 5, Y, 4, 5);
  ctx.fillStyle = '#9a9a8a'; ctx.fillRect(X + 1, Y + 1, 2, 1); ctx.fillRect(X + 6, Y + 1, 2, 1); ctx.fillRect(X + 1, Y + 3, 2, 1); ctx.fillRect(X + 6, Y + 3, 2, 1);
  if (flip) { ctx.fillStyle = '#ffffff'; ctx.fillRect(X + 4, Y - 2, 1, 6); ctx.fillRect(X + 5, Y - 3, 2, 1); }
}
// 🛋️ läsfåtöljen i rött läder med mässingsnitar, sedd framifrån (ryggen bakåt), ett litet sidobord med kopp
export function ritaFatolj(ctx, F, natt) {
  skugga(ctx, F.x, F.y, 30);
  put(ctx, bild('fatolj', 40, 34, 20, 32, (P) => {
    fyll(P, -13, -30, 12, -12, (X, Y) => (Y === -30 ? LADER[4] : X === -13 || X === 12 ? LADER[1] : tone(LADER, 0.55 + (hash(X >> 2, Y >> 2, 4) - 0.5) * 0.1 - (Y + 30) * 0.004, X, Y)));   // ryggen
    for (let i = -11; i <= 10; i += 3) P.px(i, -29, MASS[3]);
    fyll(P, -16, -14, -11, -2, (X, Y) => (Y === -14 ? LADER[4] : X === -16 ? LADER[1] : LADER[3]));   // armstöden
    fyll(P, 10, -14, 15, -2, (X, Y) => (Y === -14 ? LADER[4] : X === 15 ? LADER[1] : LADER[3]));
    fyll(P, -11, -12, 10, -4, (X, Y) => (Y === -12 ? LADER[4] : tone(LADER, 0.6 - (Y + 12) * 0.02, X, Y)));   // sittdynan
    P.rect(-11, -4, 22, 3, LADER[1]); P.rect(-14, -1, 4, 2, MAHOG[1]); P.rect(10, -1, 4, 2, MAHOG[1]);
    P.rect(-9, -24, 6, 5, 0xf0c030); P.hl(-9, -24, 6, 0xf8e080);   // en kudde
  }), F.x, F.y);
  // sidobordet med kopp och en bok
  put(ctx, bild('sidobord', 16, 24, 8, 22, (P) => { P.rect(-1, -14, 2, 14, MAHOG[1]); P.rect(-5, -1, 10, 1, MAHOG[0]); fyll(P, -7, -17, 6, -14, (X, Y) => (Y === -17 ? MAHOG[4] : MAHOG[2])); P.rect(-5, -20, 3, 3, 0xf4f1ea); P.px(-2, -19, 0xf4f1ea); P.rect(0, -20, 6, 3, 0x3a7bd5); P.hl(0, -20, 6, 0x8ab4e8); }), F.x + 24, F.y + 2);
  if (natt) { ctx.fillStyle = 'rgba(255,200,120,.12)'; ctx.fillRect(F.x - 16, F.y - 30, 34, 30); }
}
// 🌍 jordgloben på sitt stativ (snurrar sakta – fortare när man snurrat på den)
export function ritaGlob(ctx, G, t, fart = 1) {
  skugga(ctx, G.x, G.y, 14);
  put(ctx, bild('globstativ', 18, 36, 9, 34, (P) => { P.rect(-1, -16, 2, 14, MAHOG[1]); P.rect(-6, -2, 12, 2, MAHOG[2]); P.hl(-6, -2, 12, MAHOG[4]); for (let j = 0; j < 14; j++) { const r = Math.round(10 * Math.sqrt(Math.max(0, 1 - ((j - 7) / 7.5) ** 2))); P.px(-r - 1, -26 + j, MASS[2]); P.px(r, -26 + j, MASS[2]); } P.rect(-1, -31, 2, 4, MASS[3]); }), G.x, G.y);
  const cx = G.x, cy = G.y - 19, rot = t * 0.4 * fart;
  for (let j = -8; j <= 8; j++) { const r = Math.sqrt(Math.max(0, 64 - j * j)); for (let i = -r; i <= r; i++) { const X = Math.round(cx + i), Y = cy + j, lon = Math.asin(Math.max(-1, Math.min(1, i / (r || 1)))) + rot, land = Math.sin(lon * 2.1 + j * 0.5) + Math.cos(lon * 1.3 - j * 0.3) > 0.6; ctx.fillStyle = land ? (j > 5 || j < -6 ? '#f4f1ea' : '#4a9a4a') : '#2a6ab8'; if (i > r - 2.5) ctx.fillStyle = land ? '#2e6a2e' : '#1a4a8a'; if (i < -r + 1.5) ctx.fillStyle = land ? '#8ad88a' : '#6aa8e8'; ctx.fillRect(X, Y, 1, 1); } }
  ctx.fillStyle = '#ffffff'; ctx.fillRect(cx - 4, cy - 6, 1, 1); ctx.fillRect(cx - 5, cy - 5, 1, 1);
}
// 📰 tidningsstället: en ställning i trä med dagens tidningar
export function ritaTidningar(ctx, T) {
  skugga(ctx, T.x, T.y, 16);
  put(ctx, bild('tidningar', 22, 30, 11, 28, (P) => { P.vl(-8, -26, 26, MAHOG[1]); P.vl(7, -26, 26, MAHOG[1]); P.rect(-8, -1, 16, 1, MAHOG[0]); for (let r = 0; r < 3; r++) { const ry = -22 + r * 8; P.hl(-8, ry, 16, MAHOG[3]); fyll(P, -7, ry - 6, 6, ry - 1, (X, Y) => (Y === ry - 6 ? 0xffffff : X === -7 ? 0xd8d8d0 : 0xf4f1ea)); P.hl(-5, ry - 5, 10, 0x2a2a30); P.hl(-5, ry - 3, 7, 0x8a8a94); P.hl(-5, ry - 2, 9, 0x8a8a94); if (r === 1) P.rect(0, ry - 5, 5, 3, 0xd84a6a); } }), T.x, T.y);
}
// 🛒 bokvagnen med återlämnade böcker
export function ritaVagn(ctx, V) {
  skugga(ctx, V.x, V.y, 22);
  put(ctx, bild('vagn', 28, 28, 14, 26, (P) => { P.rect(-12, -14, 24, 2, ZINK[2]); P.hl(-12, -14, 24, ZINK[4]); P.rect(-12, -6, 24, 2, ZINK[2]); P.hl(-12, -6, 24, ZINK[4]); P.vl(-12, -22, 22, ZINK[2]); P.vl(11, -22, 22, ZINK[2]); P.rect(-12, -23, 24, 1, ZINK[3]); for (const wx of [-10, 9]) { P.rect(wx, -1, 3, 2, 0x1c1a20); P.px(wx + 1, -1, 0x646e7a); } for (let i = 0; i < 6; i++) { const c = BOK[(i + 2) % BOK.length], h = 6 + (i % 3); fyll(P, -10 + i * 3, -14 - h, -8 + i * 3, -15, (X) => (X === -10 + i * 3 ? mix(c, 0xffffff, 0.3) : c)); } P.rect(-9, -12, 12, 5, 0xd84a6a); P.rect(-7, -11, 8, 4, 0x3a7bd5); }), V.x, V.y);
}
// 🧸 barnhörnans saker: två små stolar, ett lågt bord med kritor, bilderböcker på golvet, en bönsäck och en nalle
export function ritaBarnmobler(ctx, Bh) {
  const { cx, cy } = Bh;
  put(ctx, bild('litetbord', 24, 14, 12, 12, (P) => { fyll(P, -10, -10, 9, -7, (X, Y) => (Y === -10 ? 0xf8e080 : Y === -7 ? 0xc89a20 : 0xf0c030)); P.vl(-8, -7, 7, MAHOG[2]); P.vl(7, -7, 7, MAHOG[2]); P.rect(-4, -12, 2, 2, 0xd8343c); P.rect(-1, -12, 2, 2, 0x3a7bd5); P.rect(2, -12, 2, 2, 0x46a35a); }), cx, cy - 4);
  for (const [sx, c] of [[cx - 22, 0xd84a6a], [cx + 22, 0x3a7bd5]]) put(ctx, bild('litenstol|' + c, 10, 14, 5, 12, (P) => { fyll(P, -3, -12, 2, -7, (X, Y) => (Y === -12 ? mix(c, 0xffffff, 0.4) : c)); P.rect(-3, -6, 6, 2, mul(c, 0.8)); P.vl(-3, -4, 4, mul(c, 0.6)); P.vl(2, -4, 4, mul(c, 0.6)); }), sx, cy + 2);
  put(ctx, bild('bonsack', 22, 14, 11, 12, (P) => { for (let j = 0; j < 12; j++) { const r = Math.round(10 * Math.sqrt(Math.max(0, 1 - ((j - 8) / 9) ** 2))); P.hl(-r, -12 + j, r * 2 + 1, j < 3 ? 0xa8d8a0 : j > 9 ? 0x3e8a42 : 0x62b858); } P.hl(-4, -10, 6, 0xc8f0c0); }), cx - 30, cy + 20);
  put(ctx, bild('nalle', 12, 14, 6, 12, (P) => { spr(P, -4, -12, ['.n...n.', 'nnnnnnn', 'nknnnkn', 'nnnmnnn', '.nnnnn.', 'nnnnnnn', 'nnrrrnn', 'nnnnnnn', 'n.n.n.n'], { n: 0xb07a40, k: 0x1a1414, m: 0x5a3a1e, r: 0xd8343c }); }), cx + 34, cy + 16);
  for (const [bx, by, c] of [[cx - 8, cy + 18, 0xd84a6a], [cx + 6, cy + 22, 0xf0c030], [cx + 14, cy + 12, 0x8a5ad0]]) { ctx.fillStyle = '#' + c.toString(16).padStart(6, '0'); ctx.fillRect(bx, by, 9, 6); ctx.fillStyle = '#f8f4e8'; ctx.fillRect(bx + 1, by + 1, 7, 1); ctx.fillStyle = '#ffffff'; ctx.fillRect(bx + 2, by + 3, 3, 2); }
}
// 🪧 golvskylten LÅNA · LÄS · LÄMNA vid disken
export function ritaDiskSkylt(ctx, x, y) {
  skugga(ctx, x, y, 14);
  for (let j = 0; j < 20; j++) { const half = 5 + Math.round(j * 0.2); ctx.fillStyle = '#1e2a1e'; ctx.fillRect(x - half, y - 20 + j, half * 2, 1); ctx.fillStyle = '#86562e'; ctx.fillRect(x - half - 1, y - 20 + j, 1, 1); ctx.fillRect(x + half, y - 20 + j, 1, 1); }
  ctx.fillStyle = '#ae7640'; ctx.fillRect(x - 6, y - 21, 12, 1);
  for (const [dy, w] of [[-17, 8], [-14, 6], [-11, 9], [-7, 7]]) { ctx.fillStyle = '#e8e4dc'; ctx.fillRect(x - 4, y + dy, w, 1); }
  ctx.fillStyle = '#f0c030'; ctx.fillRect(x - 3, y - 4, 2, 1); ctx.fillStyle = '#6fe08a'; ctx.fillRect(x + 1, y - 4, 3, 1);
}
