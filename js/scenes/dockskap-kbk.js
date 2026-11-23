// ⚽🏆 KBK-HÖRNAN OCH PRISERNA – Dockskåpets egna saker för laget (v0.174, Carl 2026-11-23: "uppdatera dockhuset med
// KBK: hänga upp en KBK-tröja med sitt namn på väggen eller ställa ut den på en mannekäng på golvet … fler olika
// medaljer och pokaler … ett vitrinskåp där man ställer pokaler, lagbilden och en bild på sig själv … planscher med
// laget och ens egna namn och nummer"). Förlagorna är lagets egna bilder: den vinröda tröjan med förnamn och nummer
// i vitt på ryggen, silverpokalen med lagerkrans och svart sockel, guldmedaljerna i regnbågsband, lagfotot med
// "KUNGSLADUGÅRDS BK F2017". Allt ritas i kod (Pix) som trädgårdens och slottets saker (dockskap-ute.js, -slott.js).
//   • PRISER (🏆, alla): pokaler i silver, guld och brons, bollpokalen, stjärnpokalen, Årets spelare, plaketten,
//     diplomet, medaljer i guld, silver och brons, medaljhängaren och VITRINSKÅPET: tre hyllor (hyllor.rader = hur
//     högt över fotlinjen sakerna står) som pokalerna, lagbilden, porträttet och bollen (pa: true) ställs på – dra
//     saken till den hylla du vill, eller ställ den på ett bord.
//   • KBK (⚽, den som spelar på svenska eller har stämt av sig i ⚽ KBK-appen): matchtröjan på galge (ryggen ur
//     klädaffären, jerseyBack), skyltdockan (teamDoll – vrids: ryggen med nummer och namn, eller framsidan),
//     lagplanschen, MIN PLANSCH (ens egen figur i matchställ med numret stort), lagbilden, mitt porträtt, halsduken,
//     vimpeln, klubbmärket och matchbollen.
//   • Namn och nummer (d.sp = { n, namn }) bärs av tröjan, skyltdockan och min plansch: den som stämt av sig får sitt
//     eget, andra sin figurs förnamn och nummer 10 – byts i Bygga-menyn (👕 Namn och nummer: laget eller eget).
//     Porträttet och min plansch ritar figurens utseende (kbkKontext).
import { Pix, mix, hash, SMALL, BIG, text, textW } from '../core/floor-pix.js';
import { $t } from '../core/i18n.js';
import { KUNGS_KIT, CLEATS } from './klader/data.js';
import { teamDoll, jerseyBack, JB_W, JB_H } from './klader/garment.js';
import { portrait } from '../core/people.js';

const R1 = 0x7a1f2e, R2 = 0xd9434b, R0 = 0x4a1018, K = 0x1d1d22, W = 0xf4f1ea;   // lagets färger: vinrött, ljusrött, svart, vitt
const G1 = 0xd8a830, G2 = 0xf4d060, G3 = 0x8a6a20;                              // guld
const S1 = 0xc8d0da, S2 = 0xffffff, S3 = 0x8a929c;                              // silver
const B1 = 0xc8823a, B2 = 0xf0b070, B3 = 0x8a5420;                              // brons
const T1 = 0x6e4426, T2 = 0x9a6a3a, T3 = 0x3a2414;                              // trä
const P1 = 0x2a2a30, P2 = 0x4a4a52;                                             // svart sockel

// figurens utseende (porträttet, min plansch) – scenen sätter det när huset öppnas
const KTX = { look: {}, sig: '' };
const CACHE = new Map();
export function kbkKontext({ look } = {}) { KTX.look = look && typeof look === 'object' ? look : {}; KTX.sig = JSON.stringify(KTX.look); CACHE.clear(); }
// { n: 1–99, namn: ≤ 12 tecken } eller null
export const tvattaSp = (sp) => {
  if (!sp || typeof sp !== 'object') return null;
  const n = Math.max(0, Math.min(99, parseInt(String(sp.n ?? '').replace(/\D+/g, ''), 10) || 0)), namn = String(sp.namn ?? '').trim().slice(0, 12);
  return n && namn ? { n, namn } : null;
};
const spAv = (d) => tvattaSp(d?.sp) || { n: 10, namn: 'KBK' };
function cached(key, fn) {
  let c = CACHE.get(key);
  if (!c) { if (CACHE.size > 300) CACHE.clear(); c = fn(); CACHE.set(key, c); }
  return c;
}
// en stillbild ritad med Pix (samma för alla)
const pix = (k, w, h, fn) => () => [cached(k, () => { const P = new Pix(w, h); fn(P); return P.flush(); })];

// ---------- pokalerna ----------
function ritaSilverpokal(P) {
  // lagerkransen högst upp (som på cupens pokal): guldring runt en mörk platta
  P.rect(6, 0, 4, 1, G1); P.rect(5, 1, 6, 3, G1); P.rect(6, 4, 4, 1, G1); P.rect(6, 1, 4, 3, P1); P.px(7, 2, G2); P.px(8, 2, G2);
  // skålen: bred upptill, smalnar – ljus vänsterkant, mörk höger, blank rand
  const rows = [[2, 13], [2, 13], [3, 12], [3, 12], [4, 11], [5, 10], [6, 9]];
  rows.forEach(([a, b], j) => { for (let x = a; x <= b; x++) P.px(x, 5 + j, x <= a + 1 ? S2 : x === b ? S3 : x >= b - 1 ? mix(S1, S3, 0.5) : S1); });
  P.hl(2, 5, 12, S2);
  // handtagen
  for (const [x, y, c] of [[1, 6, S1], [0, 7, S1], [0, 8, S1], [1, 9, S1], [2, 9, S1], [3, 9, S1], [14, 6, S3], [15, 7, S3], [15, 8, S3], [14, 9, S3], [13, 9, S3], [12, 9, S3]]) P.px(x, y, c);
  // räfflad stam, kula och ring
  P.rect(7, 12, 2, 3, S1); P.px(8, 13, S3); P.rect(6, 15, 4, 2, S1); P.px(7, 15, S2); P.px(9, 16, S3);
  P.rect(5, 17, 6, 1, S2);
  // svart sockel med plakett
  P.rect(3, 18, 10, 4, P1); P.hl(3, 18, 10, P2); P.rect(6, 19, 4, 2, G1); P.px(7, 19, G2);
}
function ritaGuldpokal(P) {
  const rows = [[1, 12], [1, 12], [2, 11], [2, 11], [3, 10], [4, 9], [5, 8]];
  rows.forEach(([a, b], j) => { for (let x = a; x <= b; x++) P.px(x, 1 + j, x <= a + 1 ? G2 : x >= b - 1 ? G3 : G1); });
  P.hl(1, 0, 12, G2); P.px(3, 3, 0xfff8d0);
  for (const [x, y, c] of [[0, 2, G2], [0, 3, G2], [0, 4, G2], [1, 5, G2], [2, 5, G2], [13, 2, G3], [13, 3, G3], [13, 4, G3], [12, 5, G3], [11, 5, G3]]) P.px(x, y, c);
  P.rect(6, 8, 2, 4, G1); P.px(7, 9, G3); P.rect(4, 12, 6, 2, G1); P.hl(4, 12, 6, G2);
  P.rect(2, 14, 10, 6, T1); P.hl(2, 14, 10, T2); P.hl(2, 19, 10, T3); P.rect(5, 16, 4, 2, G1); P.px(6, 16, G2);
}
function ritaBronspokal(P) {
  const rows = [[1, 10], [1, 10], [2, 9], [3, 8], [4, 7]];
  rows.forEach(([a, b], j) => { for (let x = a; x <= b; x++) P.px(x, 1 + j, x === a ? B2 : x === b ? B3 : B1); });
  P.hl(1, 0, 10, B2);
  for (const [x, y, c] of [[0, 2, B2], [0, 3, B2], [2, 4, B2], [11, 2, B3], [11, 3, B3], [9, 4, B3]]) P.px(x, y, c);
  P.rect(5, 6, 2, 3, B1); P.rect(3, 9, 6, 1, B2);
  P.rect(2, 10, 8, 6, P1); P.hl(2, 10, 8, P2); P.rect(4, 12, 4, 2, B1);
}
function ritaBollpokal(P) {
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { const dx = x - 3.5, dy = y - 3.5; if (dx * dx + dy * dy > 16) continue; P.px(2 + x, y, dx + dy < -3 ? G2 : dx + dy > 3 ? G3 : G1); }
  for (const [x, y] of [[5, 2], [6, 2], [5, 3], [6, 3], [3, 5], [8, 5], [5, 6], [6, 6]]) P.px(x, y, G3);   // femhörningarna
  P.px(4, 1, 0xfff8d0);
  P.rect(4, 8, 4, 1, S1); P.rect(5, 9, 2, 3, S1); P.px(6, 10, S3);                                      // hållaren och stammen
  P.rect(2, 12, 8, 6, 0xe8e4dc); P.hl(2, 12, 8, 0xffffff); P.hl(2, 17, 8, 0xa8a49c); P.px(4, 14, 0xc8c4bc); P.px(7, 15, 0xc8c4bc); P.rect(4, 15, 4, 1, G1);   // marmorsockeln
}
const STJARNA = ['......#......', '.....###.....', '.....###.....', '#############', '.###########.', '..#########..', '...#######...', '...##...##...', '..##.....##..'];
function ritaStjarnpokal(P) {
  STJARNA.forEach((r, j) => [...r].forEach((ch, i) => { if (ch === '#') P.px(i, j, j < 3 || (i < 4 && j < 6) ? G2 : i > 8 ? G3 : G1); }));
  P.rect(5, 9, 4, 6, S1); P.vl(8, 9, 6, S3); P.vl(5, 9, 6, S2);
  P.rect(2, 15, 10, 5, P1); P.hl(2, 15, 10, P2); P.rect(5, 17, 4, 2, G1);
}
function ritaSpelarpokal(P) {
  P.rect(5, 0, 3, 3, G1); P.px(5, 0, G2);                                                  // huvudet
  P.rect(4, 3, 5, 5, G1); P.px(4, 3, G2); P.px(8, 7, G3);                                   // kroppen
  P.px(3, 4, G1); P.px(2, 5, G1); P.px(9, 4, G1); P.px(10, 3, G1);                          // armarna
  P.rect(4, 8, 2, 3, G1); P.px(4, 11, G3);                                                  // stödbenet
  P.px(7, 8, G1); P.px(8, 9, G1); P.px(9, 10, G1); P.px(10, 10, G3);                        // sparkbenet
  P.rect(11, 9, 2, 2, G2); P.px(12, 10, G3);                                                // bollen
  P.rect(3, 12, 8, 2, G1); P.hl(3, 12, 8, G2);                                              // plattan
  P.rect(2, 14, 10, 8, T1); P.hl(2, 14, 10, T2); P.hl(2, 21, 10, T3); P.rect(4, 16, 6, 3, G1); P.hl(4, 16, 6, G2); P.px(5, 17, G3); P.px(7, 17, G3);   // sockeln med plakett
}
function ritaPlakett(P) {
  for (let y = 0; y < 17; y++) { const w = y < 11 ? 14 : 14 - (y - 10) * 2, x0 = (14 - w) >> 1; for (let x = x0; x < x0 + w; x++) P.px(x, y, x === x0 || x === x0 + w - 1 || y === 0 || y === 16 ? T3 : x === x0 + 1 || y === 1 ? T2 : T1); }
  P.rect(3, 3, 8, 6, G1); P.hl(3, 3, 8, G2); P.vl(3, 3, 6, G2); P.hl(4, 8, 7, G3); P.vl(10, 4, 5, G3);
  P.hl(5, 5, 4, G3); P.hl(5, 7, 3, G3);   // graverade rader
  P.rect(6, 11, 2, 2, G1); P.px(6, 11, G2);
}
function ritaDiplom(P) {
  P.rect(0, 0, 22, 18, T1); P.hl(0, 0, 22, T2); P.vl(0, 0, 18, T2); P.hl(0, 17, 22, T3); P.vl(21, 0, 18, T3);
  P.rect(2, 2, 18, 14, 0xf8f4e6); P.hl(2, 2, 18, 0xffffff);
  P.hl(6, 4, 10, 0x6a6a74); P.hl(4, 6, 14, 0xa8a8b0); P.hl(4, 8, 14, 0xa8a8b0); P.hl(4, 10, 9, 0xa8a8b0);
  P.hl(4, 13, 6, 0x6a6a74);                                                                                  // namnteckningen
  P.rect(14, 11, 4, 4, G1); P.hl(14, 11, 4, G2); P.px(17, 14, G3); P.px(14, 15, R2); P.px(17, 15, R2);   // sigillet med band
  P.px(3, 3, 0xffffff, 0.5); P.px(4, 4, 0xffffff, 0.5);
}
// en medalj i band: bandL/bandR = de tre ränderna i vardera skänkeln, metall = [färg, ljus, mörk]
function ritaMedalj(P, bandL, bandR, [c, hi, lo]) {
  for (let y = 0; y < 13; y++) {
    const sh = y < 6 ? 0 : Math.round((y - 5) / 7 * 2);
    for (let i = 0; i < 3; i++) { P.px(1 + sh + i, y, bandL[i]); P.px(8 - sh - i, y, bandR[i]); }
  }
  P.rect(3, 13, 4, 1, lo);
  const rows = [[2, 7], [1, 8], [1, 8], [1, 8], [1, 8], [2, 7], [3, 6]];
  rows.forEach(([a, b], j) => { for (let x = a; x <= b; x++) P.px(x, 14 + j, (x - a) + j < 2 ? hi : (b - x) + (6 - j) < 2 ? lo : c); });
  P.px(4, 16, lo); P.px(5, 16, lo); P.px(4, 17, lo); P.px(5, 17, lo); P.px(4, 16, hi);   // präglingen
}
const REGNBAGE_L = [0xe03a3a, 0xf08a2a, 0xf0d030], REGNBAGE_R = [0x8a4ad0, 0x3a7ad8, 0x3a9a4a];
const BLAGUL = [0x2a5ad8, 0xf0d030, 0x2a5ad8], VINROTT = [R2, R1, R2];
function ritaMedaljhangare(P) {
  P.rect(0, 0, 44, 7, P1); P.hl(0, 0, 44, P2); P.hl(0, 6, 44, 0x0a0a10);
  const s = 'MEDALJER'; text(P, SMALL, s, Math.round(22 - textW(SMALL, s) / 2), 1, G2);
  const METALL = [[G1, G2, G3], [S1, S2, S3], [B1, B2, B3], [G1, G2, G3], [S1, S2, S3]];
  const BAND = [[0xe03a3a, 0xf0d030, 0x3a7ad8], BLAGUL, VINROTT, [0x3a9a4a, 0xf0d030, 0x3a9a4a], [0xe03a3a, 0xffffff, 0xe03a3a]];
  for (let m = 0; m < 5; m++) {
    const x0 = 1 + m * 9, [c, hi, lo] = METALL[m], b = BAND[m];
    for (let y = 7; y < 13; y++) { const sh = Math.round((y - 7) / 5 * 2); P.px(x0 + 1 + sh, y, b[sh === 2 ? 1 : 0]); P.px(x0 + 5 - sh, y, b[2]); }
    P.hl(x0 + 2, 13, 3, lo);
    const rows = [[1, 5], [0, 6], [0, 6], [0, 6], [0, 6], [1, 5], [2, 4]];
    rows.forEach(([a, bb], j) => { for (let x = a; x <= bb; x++) P.px(x0 + x, 14 + j, (x - a) + j < 2 ? hi : (bb - x) + (6 - j) < 2 ? lo : c); });
    P.px(x0 + 3, 17, lo);
  }
}
// vitrinskåpet: mörkt trä, ljus insida, tre hyllplan under fotlinjerna (rad 72, 48 och 24 = hyllor.rader 5, 29, 53),
// två glasdörrar med mittpost, handtag och glans, en lampa under krönet och en sockel
function ritaVitrinskap(P) {
  const B = 54;
  P.rect(0, 0, B, 4, T1); P.hl(0, 0, B, T2); P.hl(1, 3, B - 2, T3); P.rect(23, 0, 8, 2, G1); P.hl(23, 0, 8, G2);
  P.rect(4, 4, B - 8, 70, 0xece4d2); P.rect(4, 4, B - 8, 2, 0xd4c8b0);
  for (let y = 6; y < 73; y += 2) P.px(4 + (y * 7) % 46, y, 0xe0d6c2);
  P.rect(0, 4, 4, 71, T1); P.rect(B - 4, 4, 4, 71, T1); P.vl(0, 4, 71, T2); P.vl(3, 4, 71, T3); P.vl(B - 4, 4, 71, T2); P.vl(B - 1, 4, 71, T3);
  P.hl(5, 4, B - 10, 0xfff6c8);
  for (const y of [25, 49, 73]) { P.hl(4, y, B - 8, T2); P.hl(4, y + 1, B - 8, T3); }
  P.vl(26, 4, 70, T1); P.vl(27, 4, 70, T3); P.px(24, 40, G1); P.px(29, 40, G1);
  for (let k = 0; k < 24; k++) { P.px(7 + (k >> 1), 70 - k * 2, 0xffffff, 0.3); P.px(32 + (k >> 1), 66 - k * 2, 0xffffff, 0.25); }
  P.vl(6, 6, 66, 0xffffff, 0.18); P.vl(29, 6, 66, 0xffffff, 0.18);
  P.rect(0, 75, B, 3, T1); P.hl(0, 75, B, T2); P.hl(0, 77, B, T3);
}
const GNISTA = (n, extra = {}) => ({ slag: 'gnista', n, o: { col: ['#fff6c8', '#f4d060', '#ffffff'], upp: 8, fart: 12, g: 0, dur: 0.7, ...extra } });
const POKAL_RE = { anim: 'hopp', dur: 0.5, ljud: 'pling', fx: GNISTA(5, { hojd: 8 }) };
const MEDALJ_RE = { anim: 'sway', dur: 1, ljud: 'ding', fx: GNISTA(4, { dy: 14 }) };

export const PRISER = {
  'pokal-silver': { icon: '🏆', name: $t('Silverpokalen'), w: 16, h: 22, pa: true, solidH: 4, re: POKAL_RE, bilder: pix('pokal-silver', 16, 22, ritaSilverpokal) },
  'pokal-guld': { icon: '🏆', name: $t('Guldpokalen'), w: 14, h: 20, pa: true, solidH: 4, re: POKAL_RE, bilder: pix('pokal-guld', 14, 20, ritaGuldpokal) },
  'pokal-brons': { icon: '🏆', name: $t('Bronspokalen'), w: 12, h: 16, pa: true, solidH: 4, re: POKAL_RE, bilder: pix('pokal-brons', 12, 16, ritaBronspokal) },
  'pokal-boll': { icon: '⚽', name: $t('Bollpokalen'), w: 12, h: 18, pa: true, solidH: 4, re: { ...POKAL_RE, anim: 'studs', dur: 0.6, ljud: 'boing' }, bilder: pix('pokal-boll', 12, 18, ritaBollpokal) },
  'pokal-stjarna': { icon: '⭐', name: $t('Stjärnpokalen'), w: 13, h: 20, pa: true, solidH: 4, re: POKAL_RE, bilder: pix('pokal-stjarna', 13, 20, ritaStjarnpokal) },
  'pokal-spelare': { icon: '🥇', name: $t('Årets spelare'), w: 14, h: 22, pa: true, solidH: 4, re: { ...POKAL_RE, ljud: 'fanfare' }, bilder: pix('pokal-spelare', 14, 22, ritaSpelarpokal) },
  plakett: { icon: '🛡️', name: $t('Plaketten'), w: 14, h: 17, wall: true, re: { anim: 'sway', dur: 0.6, ljud: 'knock' }, bilder: pix('plakett', 14, 17, ritaPlakett) },
  diplom: { icon: '📜', name: $t('Diplomet'), w: 22, h: 18, wall: true, re: { anim: 'sway', dur: 0.6, ljud: 'knock' }, bilder: pix('diplom', 22, 18, ritaDiplom) },
  'medalj-guld': { icon: '🥇', name: $t('Guldmedaljen'), w: 10, h: 21, wall: true, re: MEDALJ_RE, bilder: pix('medalj-guld', 10, 21, (P) => ritaMedalj(P, REGNBAGE_L, REGNBAGE_R, [G1, G2, G3])) },
  'medalj-silver': { icon: '🥈', name: $t('Silvermedaljen'), w: 10, h: 21, wall: true, re: MEDALJ_RE, bilder: pix('medalj-silver', 10, 21, (P) => ritaMedalj(P, BLAGUL, BLAGUL, [S1, S2, S3])) },
  'medalj-brons': { icon: '🥉', name: $t('Bronsmedaljen'), w: 10, h: 21, wall: true, re: MEDALJ_RE, bilder: pix('medalj-brons', 10, 21, (P) => ritaMedalj(P, VINROTT, VINROTT, [B1, B2, B3])) },
  medaljhangare: { icon: '🎖️', name: $t('Medaljhängaren'), w: 44, h: 21, wall: true, re: { anim: 'sway', dur: 0.9, ljud: 'shake', fx: GNISTA(6, { bredd: 36, dy: 16 }) }, bilder: pix('medaljhangare', 44, 21, ritaMedaljhangare) },
  vitrinskap: { icon: '🗄️', name: $t('Vitrinskåpet'), w: 54, h: 78, solidH: 10, hyllor: { x0: 5, x1: 49, rader: [5, 29, 53] }, re: { anim: 'wiggle', dur: 0.5, ljud: 'pling', fx: GNISTA(8, { bredd: 40, hojd: 50, dy: 36 }) }, bilder: pix('vitrinskap', 54, 78, ritaVitrinskap) },
};

// ---------- KBK ----------
// matchtröjan bakifrån på en galge: förnamnet och numret i vitt (klädaffärens jerseyBack)
function ritaTroja(d) {
  const sp = spAv(d), P = new Pix(JB_W, 8), g = 0x8a8e9a, gl = 0xc9ccd6;
  for (const [x, y] of [[28, 0], [29, 0], [27, 1], [30, 1], [27, 2], [30, 2], [28, 3], [29, 3], [28, 4], [29, 4]]) P.px(x, y, g);   // kroken
  P.line(29, 5, 14, 7, g); P.line(29, 5, 44, 7, g); P.hl(14, 7, 31, gl);                                                         // galgen
  const c = document.createElement('canvas'); c.width = JB_W; c.height = JB_H + 8;
  const x = c.getContext('2d'); x.drawImage(P.flush(), 0, 0); x.drawImage(jerseyBack(sp.n, sp.namn, KUNGS_KIT), 0, 8);
  return c;
}
// skyltdockan: neutral docka i matchställ på en rund sockel – ryggen (nummer, namn) eller framsidan (d.r)
const DOCKA = { skin: '#e9e2ea', style: 'bald', hair: '#ecd489', beard: false, glasses: false, phones: false, bag: null, blush: false, hat: null, build: 5,
  top: 'football', shirt: KUNGS_KIT.shirt, accent: KUNGS_KIT.accent, bottom: 'sportShorts', pants: KUNGS_KIT.pants, pants2: KUNGS_KIT.pants2, shoeType: 'cleats', shoes: CLEATS[3].shoes, shoes2: CLEATS[3].shoes2 };
const STRUMPOR = { socks: KUNGS_KIT.socks, stripe: KUNGS_KIT.sockStripe };
function ritaMannekang(d) {
  const sp = spAv(d), bak = !(d?.r | 0);
  const c = document.createElement('canvas'); c.width = 24; c.height = 44;
  const x = c.getContext('2d');
  x.fillStyle = '#4a4a52'; x.fillRect(5, 41, 14, 2); x.fillStyle = '#7a7a86'; x.fillRect(6, 41, 12, 1); x.fillStyle = '#2a2a30'; x.fillRect(7, 43, 10, 1);
  x.drawImage(teamDoll(DOCKA, bak ? 'up' : 'down', { ...STRUMPOR, number: sp.n, name: sp.namn }), 0, 1);
  return c;
}
// lagplanschen: laget i två rader på konstgräset med målet och träden bakom, "KUNGSLADUGÅRD" i bandet, F2017 i hörnet
function ritaLagplansch(P) {
  P.rect(0, 0, 72, 48, R0); P.box(1, 1, 70, 46, G1);
  const ix = 2, iy = 2, iw = 68;
  for (let y = 0; y < 12; y++) P.hl(ix, iy + y, iw, mix(0x9cc8e8, 0xd8ecf4, y / 12));
  for (let i = 0; i < 7; i++) { const tx = ix + 3 + i * 10 + ((hash(i, 2, 7) * 4) | 0), ty = iy + 7 + ((hash(i, 3, 7) * 2) | 0); P.rect(tx, ty, 6, 5, i % 2 ? 0x2f6a34 : 0x3a7a3e); P.rect(tx + 1, ty - 1, 4, 1, 0x3a7a3e); P.rect(tx + 1, ty + 1, 2, 2, 0x4f9150); }
  for (let y = 12; y < 36; y++) P.hl(ix, iy + y, iw, mix(((y >> 1) & 1) ? 0x3f9a4a : 0x49a655, 0x2f7a3a, (y - 12) / 24 * 0.3));
  P.hl(ix, iy + 12, iw, 0x2a5a30);
  const gx0 = ix + 20, gx1 = ix + 48, gy0 = iy + 7, gy1 = iy + 18;
  for (let y = gy0 + 1; y < gy1; y++) for (let x = gx0 + 1; x < gx1; x++) if ((x - gx0) % 3 === 0 || (y - gy0) % 3 === 0) P.px(x, y, 0xe8ecef, 0.5);
  P.hl(gx0, gy0, gx1 - gx0 + 1, 0xffffff); P.vl(gx0, gy0, gy1 - gy0, 0xffffff); P.vl(gx1, gy0, gy1 - gy0, 0xffffff);
  P.rect(ix + 6, iy + 28, iw - 12, 2, 0x9a6a3a); P.hl(ix + 6, iy + 28, iw - 12, 0xc08a50);
  const SK = [0xf6d7bf, 0xeec3a0, 0xe0a97f, 0xc68a5c, 0xa06a43, 0x744a2d], HR = [0x3b2619, 0xd9a95c, 0x1d1714, 0x6b4226, 0xecd489, 0xa5692f];
  const kid = (cx, top, sit, i) => {
    const sk = SK[(hash(i, 1, 13) * SK.length) | 0], hr = HR[(hash(i, 2, 13) * HR.length) | 0];
    P.rect(cx - 1, top, 3, 1, hr); P.rect(cx - 1, top + 1, 3, 2, sk); P.px(cx - 1, top + 1, hr); P.px(cx + 1, top + 1, hr);
    P.rect(cx - 2, top + 3, 5, 4, R1); P.px(cx - 2, top + 5, R2); P.px(cx + 2, top + 5, R2);
    P.rect(cx - 2, top + 7, 5, sit ? 1 : 2, K);
    if (sit) { P.px(cx - 1, top + 8, sk); P.px(cx + 1, top + 8, sk); P.px(cx - 1, top + 9, K); P.px(cx + 1, top + 9, K); P.px(cx - 1, top + 10, W); P.px(cx + 1, top + 10, W); }
    else { P.px(cx - 1, top + 9, sk); P.px(cx + 1, top + 9, sk); }
  };
  for (let i = 0; i < 10; i++) kid(ix + 7 + i * 6, iy + 13, false, i);
  for (let i = 0; i < 9; i++) kid(ix + 10 + i * 6, iy + 21, true, i + 20);
  P.rect(ix + iw / 2 - 1, iy + 33, 3, 3, W); P.px(ix + iw / 2, iy + 34, K);
  P.rect(ix, iy + 36, iw, 8, 0x2a0a12);
  const s = 'KUNGSLADUGÅRD'; text(P, SMALL, s, Math.round(ix + iw / 2 - textW(SMALL, s) / 2), iy + 37, W);
  const f = 'F2017', fw = textW(SMALL, f); P.rect(ix + iw - fw - 4, iy + 1, fw + 3, 7, 0x2a0a12, 0.6); text(P, SMALL, f, ix + iw - fw - 2, iy + 2, G2);
  for (let i = 0; i < 8; i++) P.px(ix + 2 + i, iy + 2 + i, 0xffffff, 0.2);
}
// min plansch: ens egen figur i matchställ, numret stort siffra för siffra till höger, förnamnet i bandet nertill
function ritaSpelarplansch(d) {
  const sp = spAv(d), P = new Pix(36, 62);
  P.rect(0, 0, 36, 62, R1); P.box(0, 0, 36, 62, G1); P.box(1, 1, 34, 60, R0);
  for (let y = 2; y < 60; y++) for (let x = 2; x < 34; x++) if ((x + 2 * y) % 5 === 0) P.px(x, y, mix(R1, 0xffffff, 0.05));
  text(P, SMALL, 'KBK', 3, 3, G2);
  [...String(sp.n)].forEach((ch, j) => text(P, BIG, ch, 28, 11 + j * 10, W));
  let nm = sp.namn.toUpperCase(); while (nm.length > 2 && textW(SMALL, nm) > 30) nm = nm.slice(0, -1);
  P.rect(2, 52, 32, 8, R0); text(P, SMALL, nm, Math.round(18 - textW(SMALL, nm) / 2), 54, W);
  const c = P.flush(), x = c.getContext('2d');
  x.drawImage(teamDoll({ ...KTX.look, hat: null, bag: null, phones: false, top: 'football', shirt: KUNGS_KIT.shirt, accent: KUNGS_KIT.accent, bottom: 'sportShorts', pants: KUNGS_KIT.pants, pants2: KUNGS_KIT.pants2, shoeType: 'cleats', shoes: CLEATS[0].shoes, shoes2: CLEATS[0].shoes2 }, 'down', STRUMPOR), 2, 10);
  return c;
}
function ritaLagbild(P) {
  P.rect(0, 0, 22, 16, T3); P.box(1, 1, 20, 14, G1);
  P.rect(2, 2, 18, 5, 0xa8d0ec); P.rect(2, 7, 18, 7, 0x4a9a52); P.hl(2, 7, 18, 0x2a5a30);
  for (let i = 0; i < 7; i++) { const x = 3 + i * 2 + (i > 2 ? 1 : 0); P.px(x, 6, 0x3b2619); P.px(x, 7, R1); P.px(x, 8, R1); }
  for (let i = 0; i < 6; i++) { const x = 4 + i * 2 + (i > 2 ? 1 : 0); P.px(x, 9, 0x6b4226); P.px(x, 10, R1); P.px(x, 11, K); }
  P.px(3, 3, 0xffffff, 0.4); P.px(4, 4, 0xffffff, 0.4);
}
// mitt porträtt: figurens huvud ur people.js portrait (4× → 1×) i en guldram
function ritaPortratt() {
  const P = new Pix(20, 18);
  P.rect(0, 0, 20, 18, G3); P.box(0, 0, 20, 18, G1); P.hl(1, 1, 18, G2); P.vl(1, 1, 16, G2);
  const c = P.flush(), x = c.getContext('2d'); x.imageSmoothingEnabled = false;
  x.drawImage(portrait(KTX.look, '#d8cdb8'), 8, 0, 64, 56, 2, 2, 16, 14);
  return c;
}
function ritaHalsduk(P) {
  P.rect(3, 2, 38, 10, R1); P.hl(3, 2, 38, mix(R1, 0xffffff, 0.15)); P.hl(3, 11, 38, R0);
  for (const x of [8, 32]) { P.rect(x, 2, 4, 10, K); P.hl(x, 2, 4, 0x3a3a44); }
  text(P, SMALL, 'KBK', Math.round(22 - textW(SMALL, 'KBK') / 2), 4, W);
  for (let y = 3; y < 11; y += 2) { P.hl(0, y, 3, 0xd8d0c8); P.hl(41, y, 3, 0xd8d0c8); }   // fransarna
  P.px(5, 6, R2); P.px(37, 7, R2);
}
function ritaVimpel(P) {
  P.rect(0, 0, 14, 2, T1); P.hl(0, 0, 14, T2);
  for (let y = 2; y < 28; y++) { const w = Math.max(1, Math.round(14 - (y - 2) * 13 / 25)), x0 = (14 - w) >> 1; for (let x = x0; x < x0 + w; x++) P.px(x, y, x === x0 || x === x0 + w - 1 || y === 2 ? K : R1); }
  text(P, SMALL, 'K', 6, 5, G2); P.px(6, 12, G2); P.px(7, 12, G2);
}
// klubbmärket: gul sköld med rött band och KBK i vitt
function ritaSkold(P) {
  for (let y = 0; y < 20; y++) { const w = y < 13 ? 16 : 16 - (y - 12) * 2, x0 = (16 - w) >> 1; if (w <= 0) continue; for (let x = x0; x < x0 + w; x++) { const kant = x === x0 || x === x0 + w - 1 || y === 0 || y === 19; P.px(x, y, kant ? K : y < 4 || y > 12 ? (x < 8 ? 0xf0c830 : 0xd8ac20) : 0xd02c30); } }
  text(P, SMALL, 'KBK', Math.round(8 - textW(SMALL, 'KBK') / 2), 6, W);
  P.px(2, 2, 0xfff0a0);
}
function ritaMatchboll(P) {
  for (let y = 0; y < 9; y++) for (let x = 0; x < 9; x++) { const dx = x - 4, dy = y - 4; if (dx * dx + dy * dy > 20) continue; P.px(x, y, dx + dy > 4 ? 0xc8c8c4 : W); }
  for (const [x, y] of [[4, 2], [2, 4], [6, 4], [3, 6], [5, 6]]) { P.px(x, y, K); P.px(x + 1, y, K); }
  P.px(0, 4, K, 0.6); P.px(8, 4, K, 0.6); P.px(4, 0, K, 0.6); P.px(4, 8, K, 0.6); P.px(2, 2, 0xffffff);
  P.rect(2, 9, 6, 3, G1); P.hl(2, 9, 6, G2); P.hl(2, 11, 6, G3);
}
const spKey = (k, d) => { const sp = spAv(d); return `${k}|${sp.n}|${sp.namn}|${d?.r | 0}|${KTX.sig}`; };
const HEJA = { anim: 'sway', dur: 1, ljud: 'fanfare', fx: GNISTA(6, { col: ['#f4f1ea', '#d9434b', '#f4d060'], upp: 10, fart: 16, bredd: 20, dy: 10 }) };
export const KBK = {
  'kbk-troja': { icon: '👕', name: $t('Matchtröjan'), w: JB_W, h: JB_H + 8, wall: true, sp: true, re: { anim: 'sway', dur: 1, ljud: 'shake' }, bilder: (d) => [cached(spKey('kbk-troja', d), () => ritaTroja(d))] },
  'kbk-mannekang': { icon: '🧍', name: $t('Skyltdockan'), w: 24, h: 44, solidH: 5, sp: true, rot: 2, re: { anim: 'wiggle', dur: 0.5, ljud: 'knock' }, bilder: (d) => [cached(spKey('kbk-mannekang', d), () => ritaMannekang(d))] },
  'kbk-plansch': { icon: '🖼️', name: $t('Lagplanschen'), w: 72, h: 48, wall: true, re: HEJA, bilder: pix('kbk-plansch', 72, 48, ritaLagplansch) },
  'kbk-spelarplansch': { icon: '🌟', name: $t('Min plansch'), w: 36, h: 62, wall: true, sp: true, re: { ...HEJA, fx: { slag: 'hjarta', n: 3, o: { upp: 10, fart: 8, g: 0, dur: 1, dy: 10 } } }, bilder: (d) => [cached(spKey('kbk-spelarplansch', d), () => ritaSpelarplansch(d))] },
  'kbk-lagbild': { icon: '📷', name: $t('Lagbilden'), w: 22, h: 16, pa: true, solidH: 3, re: { anim: 'hopp', dur: 0.4, ljud: 'pop' }, bilder: pix('kbk-lagbild', 22, 16, ritaLagbild) },
  'kbk-portratt': { icon: '🪞', name: $t('Mitt porträtt'), w: 20, h: 18, pa: true, solidH: 3, re: { anim: 'hopp', dur: 0.4, ljud: 'pling', fx: { slag: 'hjarta', n: 2, o: { upp: 10, fart: 6, g: 0, dur: 1 } } }, bilder: () => [cached('kbk-portratt|' + KTX.sig, ritaPortratt)] },
  'kbk-halsduk': { icon: '🧣', name: $t('Halsduken'), w: 44, h: 14, wall: true, re: HEJA, bilder: pix('kbk-halsduk', 44, 14, ritaHalsduk) },
  'kbk-vimpel': { icon: '🚩', name: $t('Vimpeln'), w: 14, h: 28, wall: true, re: { anim: 'sway', dur: 0.8, ljud: 'shake' }, bilder: pix('kbk-vimpel', 14, 28, ritaVimpel) },
  'kbk-skold': { icon: '🛡️', name: $t('Klubbmärket'), w: 16, h: 20, wall: true, re: { anim: 'wiggle', dur: 0.5, ljud: 'coin', fx: GNISTA(4, { dy: 10 }) }, bilder: pix('kbk-skold', 16, 20, ritaSkold) },
  'kbk-boll': { icon: '⚽', name: $t('Matchbollen'), w: 10, h: 12, pa: true, solidH: 3, re: { anim: 'studs', dur: 0.7, ljud: 'boing' }, bilder: pix('kbk-boll', 10, 12, ritaMatchboll) },
};
// bilden för saken k (bildruta f) som den ser ut med just det här exemplarets namn, nummer och vridning (d)
export const kbkBild = (k, f = 0, d = null) => { const a = (PRISER[k] || KBK[k])?.bilder(d); return a ? a[Math.min(f, a.length - 1)] : null; };
