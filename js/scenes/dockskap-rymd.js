// 🚀 RYMDSTATIONEN – Dockskåpets tredje köpbara rum (v0.181, Carl 2026-11-25: "gör alla förslagen" – Rymdstationen var
// idén till ett tredje rum). Ett rum i en rymdstation: väggar av metallplåt med nitar och lysande ljuslister, två runda
// fönster ut mot rymden (stjärnor, jorden i det vänstra och månen i det högra – stjärnorna blinkar), ett gallergolv med
// gul-svarta varningsränder vid väggen. Sakerna ritas här (Pix) som i slottet (dockskap-slott.js): raketen (ryker när
// den lyfter), kontrollbordet (lamporna blinkar), rymddräkten, roboten (piper), planetlampan (Saturnus i taket, lyser),
// sovkapseln (säte), teleskopet, odlingsröret (gröna plantor i ljus), utomjordingen (hoppar), satelliten (på väggen,
// snurrar), pilotstolen (säte) och månstenen. Låst (🔒) tills Rymdstationen är köpt (kop.js 'dock.rymd', 39 kr).
import { Pix, mix, mul, hash, bayer } from '../core/floor-pix.js';
import { $t, $n } from '../core/i18n.js';

export const FW = 384, FH = 216, WALL_Y = 86;
const tone = (pal, v, x, y) => { const t = Math.max(0, Math.min(0.999, v)) * (pal.length - 1), i = Math.floor(t); return pal[Math.min(pal.length - 1, i + (t - i > bayer(x, y) ? 1 : 0))]; };

export const RYMD_RUM = { id: 'rymd', ik: '🚀', name: $n('RYMDSTATIONEN'), ute: true, kop: 'rymd', wall: 0x9aa4b4, wallDk: 0x5a6474, floorA: 0x6a7484, floorB: 0x3a4250, windows: [], view: 'sky' };

// ---------- bakgrunden ----------
// ett runt fönster: plåtram med nitar, rymden med stjärnor och en himlakropp (jorden eller månen)
function fonster(P, cx, cy, r, kropp, night) {
  for (let y = -r - 4; y <= r + 4; y++) for (let x = -r - 4; x <= r + 4; x++) {
    const d = Math.sqrt(x * x + y * y);
    if (d > r + 4) continue;
    if (d > r) { P.px(cx + x, cy + y, d > r + 3 ? 0x3a4250 : y < 0 ? 0xc8d0dc : 0x8a94a4); continue; }   // ramen, ljus upptill
    let c = tone([0x04061a, 0x0a1030, 0x141c48], (y + r) / (2 * r) * 0.7, x, y);                       // rymden
    const s = hash(cx + x, cy + y, 31);
    if (s > 0.985) c = s > 0.995 ? 0xffffff : 0xa8b8e8;                                                  // stjärnorna
    P.px(cx + x, cy + y, c);
  }
  // himlakroppen nere till höger i fönstret
  const kx = cx + Math.round(r * 0.28), ky = cy + Math.round(r * 0.3), kr = Math.round(r * 0.48);
  for (let y = -kr; y <= kr; y++) for (let x = -kr; x <= kr; x++) {
    const d = (x * x + y * y) / (kr * kr);
    if (d > 1 || Math.hypot(kx + x - cx, ky + y - cy) > r - 1) continue;
    const ljus = Math.max(0, Math.min(1, 0.55 - (x + y) / (kr * 2.6)));
    let c;
    if (kropp === 'jorden') {
      const land = hash((kx + x) >> 2, (ky + y) >> 2, 37) > 0.6 || hash((kx + x) >> 3, (ky + y) >> 3, 41) > 0.72;
      c = land ? tone([0x2a5a2a, 0x3a8a3a, 0x6ab84a], ljus, x, y) : tone([0x0e2a6a, 0x1e4aa8, 0x3a7ad8], ljus, x, y);
      if (hash(x >> 1, (y + 3) >> 2, 43) > 0.86) c = mix(c, 0xffffff, 0.75);                          // molnen
    } else {
      c = tone([0x5a5a64, 0x8a8a94, 0xc8c8d0], ljus, x, y);
      if (hash((kx + x) >> 1, (ky + y) >> 1, 47) > 0.9) c = mul(c, 0.7);                               // kratrarna
    }
    if (d > 0.82) c = mix(c, kropp === 'jorden' ? 0x8ac8ff : 0xffffff, 0.35);                          // atmosfären / kanten
    P.px(kx + x, ky + y, c);
  }
  // nitarna runt ramen
  for (let k = 0; k < 12; k++) { const a = (k / 12) * Math.PI * 2; P.px(Math.round(cx + Math.cos(a) * (r + 2)), Math.round(cy + Math.sin(a) * (r + 2)), 0xe8ecf4); }
  if (night) P.ell(cx, cy, r, r, 0x000000, 0.2, 2);
}
export function rymdBg(_tema, night) {
  const P = new Pix(FW, FH);
  // väggen: plåtar om 48 × 28 med fogar och nitar, svagt borstad
  for (let y = 0; y < WALL_Y; y++) for (let x = 0; x < FW; x++) {
    const px = x % 48, py = y % 28, fog = px === 47 || py === 27, nit = (px === 3 || px === 44) && (py === 3 || py === 24);
    let c = fog ? 0x5a6474 : nit ? 0xd8dee8 : mix(0xa8b2c2, 0x8e98aa, hash(x >> 3, y, 13) * 0.6 + (py / 28) * 0.3);
    if (px === 0 && !fog) c = 0xc8d0dc;                                                                // ljus kant på plåten
    P.px(x, y, night ? mul(c, 0.62) : c);
  }
  // takets ljuslist (lyser blått) och väggens list ovanför golvet
  P.rect(0, 0, FW, 4, 0x3a4250); P.rect(0, 4, FW, 2, night ? 0x4ac0ff : 0x8ae0ff); P.hl(0, 6, FW, 0x2a8ac8);
  fonster(P, 110, 42, 26, 'jorden', night); fonster(P, 274, 42, 26, 'manen', night);
  // panelen till höger om månfönstret: tre lampor och en skärm
  P.rect(318, 26, 44, 30, 0x3a4250); P.rect(319, 27, 42, 28, 0x2a303c);
  for (const [i, c] of [[0, 0x46d36a], [1, 0xf0c030], [2, 0xe04848]]) { P.rect(324 + i * 12, 32, 8, 5, c); P.hl(324 + i * 12, 32, 8, 0xffffff); }
  for (let k = 0; k < 4; k++) P.hl(324, 42 + k * 3, 20 + (k * 7) % 12, 0x4ac0ff);
  // golvlisten med varningsränder
  for (let x = 0; x < FW; x++) for (let y = WALL_Y - 8; y < WALL_Y - 2; y++) P.px(x, y, ((x + y) >> 2) & 1 ? 0xf0c030 : 0x1e2228);
  P.rect(0, WALL_Y - 2, FW, 2, night ? 0x4ac0ff : 0x8ae0ff);
  // gallergolvet: plattor om 16 px med galler och nitar i perspektivband
  for (let y = WALL_Y; y < FH; y++) for (let x = 0; x < FW; x++) {
    const u = (x + (FH - y) * 0.35) & 15, v = (y - WALL_Y) & 15;
    let c = u === 15 || v === 15 ? 0x2a303a : (u % 4 === 1 && v % 4 === 1) ? 0x3a4250 : mix(0x6a7484, 0x5a6474, hash(x >> 4, y >> 4, 17) * 0.7);
    if ((u === 2 || u === 13) && (v === 2 || v === 13)) c = 0xb8c0cc;                                     // nitarna i hörnen
    P.px(x, y, night ? mul(c, 0.55) : c);
  }
  // en ljusgata av blått golvljus mitt i rummet
  for (let y = WALL_Y + 4; y < FH; y += 10) { P.rect(186, y, 12, 2, night ? 0x4ac0ff : 0x8ae0ff, 0.6); }
  if (night) { P.ell(110, WALL_Y + 22, 40, 12, 0x8ac8ff, 0.07, 4); P.ell(274, WALL_Y + 22, 40, 12, 0xc8d8ff, 0.06, 4); }
  return P.flush();
}

// ---------- sakerna ----------
const F = new Map();
const frames = (k, n, fn) => { let a = F.get(k); if (!a) { a = Array.from({ length: n }, (_, i) => { const P = new Pix(RYMD[k].w, RYMD[k].h); fn(P, i); return P.flush(); }); F.set(k, a); } return a; };
const M1 = 0xc8d0dc, M2 = 0x8a94a4, M3 = 0x4a5464, VIT = 0xf4f6fa, BLA = 0x4ac0ff, ROD = 0xe04848, GUL = 0xf0c030;
export const RYMD = {
  raket: { icon: '🚀', name: $t('Raketen'), w: 26, h: 50, solidH: 10, re: { anim: 'hopp', dur: 0.8, ljud: 'boing', fx: { slag: 'rok', n: 8, o: { col: ['#c8c8d0', '#ffffff', '#ff9d3a'], upp: -2, fart: 14, g: 4, glapp: 0.08, dur: 1, bredd: 10, dy: 44 } } }, bilder: () => frames('raket', 1, (P) => {
    for (let y = 2; y < 38; y++) { const w = y < 12 ? Math.round(2 + y * 0.9) : 12, x0 = 13 - (w >> 1); for (let x = x0; x < x0 + w; x++) P.px(x, y, x < 13 - (w >> 2) ? VIT : x > 13 + (w >> 2) ? M1 : 0xe8ecf4); }   // kroppen
    P.rect(12, 0, 2, 3, ROD);                                                                                                // spetsen
    P.ell(13, 18, 3, 3, BLA); P.ell(13, 18, 2, 2, 0x8ae0ff); P.px(12, 17, VIT);                                             // fönstret
    P.rect(7, 26, 12, 3, ROD); P.hl(7, 26, 12, 0xff7a7a);                                                                    // det röda bandet
    for (const s of [-1, 1]) for (let j = 0; j < 12; j++) P.rect(s < 0 ? 6 - Math.round(j * 0.45) : 19, 30 + j, s < 0 ? Math.round(1 + j * 0.45) : Math.round(1 + j * 0.45), 1, ROD);   // fenorna
    P.rect(9, 38, 8, 4, M3); P.rect(10, 42, 6, 2, 0x2a303a);                                                                // motorn
    P.rect(3, 44, 20, 4, M2); P.hl(3, 44, 20, M1); P.rect(5, 48, 3, 2, M3); P.rect(18, 48, 3, 2, M3);                       // ramplattan
  }) },
  kontrollbord: { icon: '🎛️', name: $t('Kontrollbordet'), w: 52, h: 32, solidH: 14, re: { anim: 'wiggle', dur: 0.4, ljud: 'pling', fx: { slag: 'gnista', n: 6, o: { col: ['#4ac0ff', '#46d36a', '#f0c030'], upp: 10, fart: 14, g: 0, dur: 0.7, hojd: 16 } } }, bilder: () => frames('kontrollbord', 2, (P, f) => {
    P.rect(2, 4, 48, 14, M3); P.rect(2, 4, 48, 1, M2);                                                                       // skärmlådan
    P.rect(5, 6, 20, 10, 0x0a1030); P.rect(28, 6, 19, 10, 0x0a1030);                                                         // två skärmar
    for (let k = 0; k < 5; k++) P.hl(6, 8 + k * 2, 4 + ((k * 7 + f * 3) % 14), 0x46d36a);                                   // text på skärmen
    for (let x = 0; x < 17; x++) P.px(29 + x, 11 + Math.round(Math.sin((x + f * 4) * 0.6) * 3), BLA);                        // kurvan
    P.rect(0, 18, 52, 8, M2); P.hl(0, 18, 52, M1);                                                                           // bordsskivan
    for (let k = 0; k < 8; k++) { const c = [ROD, GUL, 0x46d36a, BLA][(k + f * (k % 2 ? 1 : 2)) % 4]; P.rect(3 + k * 6, 20, 4, 3, c); P.hl(3 + k * 6, 20, 4, VIT); }   // knapparna blinkar
    P.rect(4, 26, 44, 6, M3); P.rect(8, 28, 6, 2, 0x2a303a); P.rect(38, 28, 6, 2, 0x2a303a);
  }) },
  rymddrakt: { icon: '👩‍🚀', name: $t('Rymddräkten'), w: 24, h: 48, solidH: 6, re: { anim: 'wiggle', dur: 0.5, ljud: 'knock' }, bilder: () => frames('rymddrakt', 1, (P) => {
    P.ell(12, 8, 8, 8, VIT); P.ell(12, 9, 6, 5, 0x2a3a6a); P.rect(9, 6, 3, 2, 0x8ae0ff);                                   // hjälmen och visiret
    P.rect(5, 16, 14, 16, VIT); P.rect(5, 16, 14, 1, 0xffffff); P.rect(8, 19, 8, 5, M1); P.px(9, 20, ROD); P.px(11, 20, BLA); P.px(13, 20, GUL);   // dräkten och panelen
    P.rect(1, 17, 4, 12, VIT); P.rect(19, 17, 4, 12, VIT); P.rect(1, 29, 4, 3, M2); P.rect(19, 29, 4, 3, M2);              // armarna, handskarna
    P.rect(6, 32, 5, 10, VIT); P.rect(13, 32, 5, 10, VIT); P.rect(5, 42, 6, 2, M2); P.rect(13, 42, 6, 2, M2);              // benen, kängorna
    P.rect(4, 44, 16, 4, M3); P.hl(4, 44, 16, M2);                                                                           // stället
    P.rect(18, 22, 1, 2, ROD); P.px(6, 24, BLA);                                                                             // märkena
  }) },
  robot: { icon: '🤖', name: $t('Roboten'), w: 20, h: 30, solidH: 6, re: { anim: 'hopp', dur: 0.5, ljud: 'pop', fx: { slag: 'hjarta', n: 3, o: { upp: 12, fart: 8, g: -2, dur: 1 } } }, bilder: () => frames('robot', 2, (P, f) => {
    P.vl(10, 0, 4, M2); P.ell(10, 0, 1.5, 1.5, f ? ROD : 0xff9a9a);                                                         // antennen
    P.rect(4, 4, 12, 9, M1); P.rect(4, 4, 12, 1, VIT); P.rect(6, 6, 3, 3, f ? BLA : 0x0a1030); P.rect(11, 6, 3, 3, f ? BLA : 0x0a1030); P.hl(7, 11, 6, M3);   // huvudet
    P.rect(3, 14, 14, 10, M2); P.rect(3, 14, 14, 1, M1); P.rect(6, 16, 8, 4, M3); P.px(7, 17, 0x46d36a); P.px(9, 17, GUL); P.px(11, 17, ROD);   // kroppen
    P.rect(0, 15, 3, 7, M1); P.rect(17, 15, 3, 7, M1);                                                                       // armarna
    P.rect(4, 24, 12, 4, M3); P.ell(6, 28, 2, 2, 0x2a303a); P.ell(14, 28, 2, 2, 0x2a303a);                                  // hjulen
  }) },
  planetlampa: { icon: '🪐', name: $t('Planetlampan'), w: 34, h: 30, wall: true, glow: true, re: { anim: 'sway', dur: 1, ljud: 'pling', fx: { slag: 'gnista', n: 6, o: { col: ['#f0c030', '#ffffff'], upp: 6, fart: 18, g: 2, dur: 0.9, hojd: 10, dy: 16 } } }, bilder: () => frames('planetlampa', 1, (P) => {
    P.vl(17, 0, 8, M3);
    for (let y = -8; y <= 8; y++) for (let x = -8; x <= 8; x++) if (x * x + y * y <= 64) P.px(17 + x, 18 + y, tone([0xc88a3a, 0xe8b058, 0xf8d88a], 0.6 - (x + y) / 24, x, y));   // planeten
    for (let x = -16; x <= 16; x++) { const y = Math.round(x * 0.18); if (Math.abs(x) > 6 || y > 0) { P.px(17 + x, 18 + y, 0xf8e8b8); P.px(17 + x, 19 + y, 0xc8a868); } }   // ringen
  }) },
  sovkapsel: { icon: '🛌', name: $t('Sovkapseln'), w: 56, h: 34, solidH: 14, seat: { up: 2 }, re: { anim: 'boing', dur: 0.6, ljud: 'boing', hopp: true }, bilder: () => frames('sovkapsel', 1, (P) => {
    for (let y = 0; y < 28; y++) for (let x = 0; x < 56; x++) { const dx = (x - 28) / 28, dy = (y - 18) / 14; if (dx * dx + dy * dy > 1 || y < 4) continue; P.px(x, y, y < 16 ? mix(0x8ae0ff, VIT, 0.3 + (x % 7 === 0 ? 0.3 : 0)) : VIT); }   // glaslocket och skalet
    P.rect(4, 18, 48, 6, 0x3a6ad0); P.hl(4, 18, 48, 0x6a9af0); P.rect(6, 16, 10, 4, VIT);                                // täcket och kudden
    P.rect(2, 26, 52, 4, M2); P.hl(2, 26, 52, M1); P.rect(6, 30, 4, 4, M3); P.rect(46, 30, 4, 4, M3);                     // sockeln
    P.rect(24, 27, 8, 2, BLA);                                                                                               // ljuset på sockeln
  }) },
  teleskop: { icon: '🔭', name: $t('Teleskopet'), w: 28, h: 40, solidH: 6, re: { anim: 'wiggle', dur: 0.5, ljud: 'ding', fx: { slag: 'gnista', n: 5, o: { col: ['#ffffff', '#a8b8e8'], upp: 18, fart: 10, g: 0, dur: 0.8, dy: -8 } } }, bilder: () => frames('teleskop', 1, (P) => {
    for (let k = 0; k < 22; k++) { const x = 4 + k, y = 18 - Math.round(k * 0.6); P.rect(x, y, 1, k < 5 ? 5 : 4, k < 3 ? M3 : k % 6 === 0 ? GUL : VIT); }   // tuben, snett uppåt
    P.rect(24, 2, 4, 6, M3); P.px(27, 3, 0x8ae0ff);                                                                         // objektivet
    P.rect(13, 14, 3, 3, M3);                                                                                                // fästet
    P.line(14, 17, 6, 38, M2); P.line(14, 17, 14, 38, M2); P.line(14, 17, 22, 38, M2);                                      // stativet
  }) },
  odlingsror: { icon: '🌱', name: $t('Odlingsröret'), w: 16, h: 44, solidH: 6, glow: true, re: { anim: 'sway', dur: 0.6, ljud: 'shake', fx: { slag: 'lov', n: 4, o: { upp: 12, fart: 8, g: 2, dur: 1 } } }, bilder: () => frames('odlingsror', 1, (P) => {
    P.rect(1, 0, 14, 3, M2); P.rect(1, 40, 14, 4, M2); P.hl(1, 40, 14, M1);                                                 // lock och fot
    for (let y = 3; y < 40; y++) for (let x = 2; x < 14; x++) P.px(x, y, x === 2 || x === 13 ? 0xc8f0ff : mix(0x1a3a3a, 0x2a6a5a, y / 40));   // glasröret
    for (let k = 0; k < 4; k++) { const y = 8 + k * 9; P.hl(4, y, 8, 0x8ae0ff); for (let j = 0; j < 3; j++) { P.px(5 + j * 3, y - 1, 0x6ad86a); P.px(5 + j * 3, y - 2, 0x46b84a); P.px(4 + j * 3, y - 3, 0x8af08a); P.px(6 + j * 3, y - 3, 0x8af08a); } }   // hyllorna med plantor
  }) },
  utomjording: { icon: '👽', name: $t('Utomjordingen'), w: 18, h: 22, solidH: 4, pa: true, re: { anim: 'hopp', dur: 0.5, ljud: 'pop', fx: { slag: 'hjarta', n: 3, o: { upp: 10, fart: 8, g: -2, dur: 1 } } }, bilder: () => frames('utomjording', 1, (P) => {
    const G = 0x6ad86a, L = 0x9af09a, D = 0x3a9a4a;
    P.vl(5, 0, 4, D); P.vl(12, 0, 4, D); P.px(5, 0, GUL); P.px(12, 0, GUL);                                                // antennerna
    P.ell(9, 8, 7, 5, G); P.rect(4, 4, 10, 2, L); P.ell(6, 8, 2, 2, 0x1a1a22); P.ell(12, 8, 2, 2, 0x1a1a22); P.px(6, 7, VIT); P.px(12, 7, VIT); P.hl(7, 11, 4, D);   // huvudet
    P.rect(5, 13, 8, 6, G); P.rect(5, 13, 8, 1, L); P.rect(2, 14, 3, 4, G); P.rect(13, 14, 3, 4, G); P.rect(5, 19, 3, 3, D); P.rect(10, 19, 3, 3, D);   // kroppen
  }) },
  satellit: { icon: '🛰️', name: $t('Satelliten'), w: 40, h: 22, wall: true, re: { anim: 'sway', dur: 0.8, ljud: 'ding' }, bilder: () => frames('satellit', 1, (P) => {
    for (const x0 of [0, 26]) { P.rect(x0, 6, 14, 10, 0x1e3a8a); for (let j = 0; j < 3; j++) P.vl(x0 + 4 + j * 4, 6, 10, 0x4a6ad8); P.hl(x0, 11, 14, 0x4a6ad8); P.rect(x0, 6, 14, 1, 0x6a8af0); }   // solpanelerna
    P.rect(14, 4, 12, 14, M1); P.rect(14, 4, 12, 1, VIT); P.rect(16, 8, 8, 5, GUL); P.hl(16, 8, 8, 0xf8e08a);                // kroppen
    P.line(20, 4, 24, 0, M2); P.ell(25, 0, 2, 1, VIT);                                                                     // antennen
  }) },
  pilotstol: { icon: '💺', name: $t('Pilotstolen'), w: 24, h: 34, solidH: 10, seat: { up: 6 }, re: { anim: 'boing', dur: 0.5, ljud: 'squeak' }, bilder: () => frames('pilotstol', 1, (P) => {
    P.rect(4, 0, 16, 20, M3); P.rect(6, 2, 12, 16, 0x2a3a6a); P.hl(6, 2, 12, 0x4a6ad8); P.rect(10, 4, 4, 3, VIT);            // ryggen och nackstödet
    P.rect(2, 18, 20, 6, M3); P.rect(4, 19, 16, 3, 0x2a3a6a);                                                                // sitsen
    P.rect(0, 14, 3, 8, M2); P.rect(21, 14, 3, 8, M2); P.px(1, 14, ROD); P.px(22, 14, 0x46d36a);                            // armstöden med knappar
    P.rect(10, 24, 4, 6, M2); P.rect(4, 30, 16, 3, M3); P.hl(4, 30, 16, M2);                                                // foten
  }) },
  manesten: { icon: '🌑', name: $t('Månstenen'), w: 16, h: 12, solidH: 4, pa: true, re: { anim: 'wiggle', dur: 0.4, ljud: 'knock', fx: { slag: 'gnista', n: 4, o: { col: ['#ffffff', '#c8c8d0'], upp: 8, fart: 8, g: 0, dur: 0.6 } } }, bilder: () => frames('manesten', 1, (P) => {
    P.rect(0, 8, 16, 4, 0x6a4a2a); P.hl(0, 8, 16, 0x8a6a3a);                                                               // trälådan
    for (let y = 0; y < 9; y++) for (let x = 2; x < 14; x++) { const dx = (x - 8) / 6, dy = (y - 5) / 5; if (dx * dx + dy * dy <= 1) P.px(x, y, hash(x, y, 53) > 0.8 ? 0x6a6a74 : tone([0x8a8a94, 0xb8b8c4, 0xe0e0e8], 0.7 - (x + y) / 26, x, y)); }
  }) },
};
export const RYMD_SEED = [{ k: 'kontrollbord', x: 166, y: 120 }, { k: 'pilotstol', x: 180, y: 150 }, { k: 'planetlampa', x: 175, y: 66 }, { k: 'raket', x: 40, y: 150 }, { k: 'rymddrakt', x: 330, y: 150 }, { k: 'sovkapsel', x: 286, y: 204 }, { k: 'robot', x: 120, y: 196 }, { k: 'satellit', x: 24, y: 40 }, { k: 'odlingsror', x: 246, y: 130 }, { k: 'teleskop', x: 76, y: 132 }];
export const rymdBild = (k, f = 0) => { const a = RYMD[k]?.bilder(); return a ? a[Math.min(f, a.length - 1)] : null; };
