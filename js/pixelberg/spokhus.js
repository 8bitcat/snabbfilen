// 👻 SPÖKHUSET på Pixelberg: spöktåget och det man ser där inne (scenen: js/scenes/pixelberg.js, huset: karta.js).
//
// Vagnen går på KLOCKAN, precis som berg-och-dalbanan – var 30:e sekund – så alla ser samma vagn på samma ställe och
// den som åker med en kompis ser samma spöken i samma ögonblick:
//   0–7 s   vagnen står vid perrongen (man kliver på; två platser)
//   7–9 s   den rullar till ingången – munnen – och in i huset
//   9–27 s  INNE: en lång mörk korridor som glider förbi (fladdermöss, garderoben där spöket hoppar fram – BU!,
//           skelettet som dansar, spindeln som firar sig ner, spegelsalen där man blir bred och lång, spökkungen
//           som vinkar hej då) – ritas över hela skärmen för den som sitter i vagnen
//   27–30 s vagnen kommer ut genom utgången och rullar tillbaka till perrongen; då kliver man av
// Snällt läskigt – barnen spelar också.
import { drawPerson } from '../core/people.js';
import { SMALL, BIG, ctxText, textW } from '../core/floor-pix.js';
import { SPOK_SPAR } from './karta.js';
import { $t } from '../core/i18n.js';

export const SPOK_CYKEL = 30, SPOK_PASTIG = 7, SPOK_IN = 9, SPOK_UT = 27, SPOK_INNE = SPOK_UT - SPOK_IN;
export function spokLage(nuS) {
  const n = Math.floor(nuS / SPOK_CYKEL), u = nuS - n * SPOK_CYKEL;
  return { n, u, station: u < SPOK_PASTIG, inne: u >= SPOK_IN && u < SPOK_UT, i: u - SPOK_IN, kvar: SPOK_PASTIG - u };
}
// vagnens plats utanför huset (synlig = inte inne i huset)
const ease = (u) => (1 - Math.cos(Math.max(0, Math.min(1, u)) * Math.PI)) / 2;
function langs(pts, u) {   // en punkt längs en bruten linje, u 0–1 efter längden
  const L = []; let tot = 0;
  for (let k = 1; k < pts.length; k++) { const d = Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]); L.push(d); tot += d; }
  let s = u * tot;
  for (let k = 0; k < L.length; k++) { if (s <= L[k] || k === L.length - 1) { const f = L[k] ? Math.min(1, s / L[k]) : 0; return [pts[k][0] + (pts[k + 1][0] - pts[k][0]) * f, pts[k][1] + (pts[k + 1][1] - pts[k][1]) * f]; } s -= L[k]; }
  return pts[pts.length - 1];
}
export function spokVagn(L) {
  const { x0, x1, y0, y1, cx } = SPOK_SPAR;
  if (L.u < SPOK_PASTIG) return { x: cx, y: y1, synlig: true };
  if (L.u < SPOK_IN) { const [x, y] = langs([[cx, y1], [x0, y1], [x0, y0]], ease((L.u - SPOK_PASTIG) / (SPOK_IN - SPOK_PASTIG))); return { x, y, synlig: y > y0 + 2 }; }
  if (L.u < SPOK_UT) return { x: x0, y: y0, synlig: false };
  const [x, y] = langs([[x1, y0], [x1, y1], [cx, y1]], ease((L.u - SPOK_UT) / (SPOK_CYKEL - SPOK_UT)));
  return { x, y, synlig: y > y0 + 2 };
}

// spökvagnen: svart med lila list och en pumplykta längst fram; två åkande sida vid sida (vända mot oss)
export function ritaSpokVagn(ctx, x, y, sitt, t, rad = false) {
  x = Math.round(x); y = Math.round(y);
  for (let s = 0; s < 2; s++) {
    const r = sitt[s]; if (!r) continue;
    const px = x + (s ? 5 : -4), kid = !!r.look?.kid;
    ctx.save(); ctx.beginPath(); ctx.rect(px - 9, y - 46, 18, 41); ctx.clip();
    drawPerson(ctx, px, y + (kid ? 9 : 14), r.look, 'down', rad ? 10 : 5);
    ctx.restore();
  }
  ctx.fillStyle = 'rgba(10,8,16,.35)'; ctx.fillRect(x - 12, y + 4, 25, 2);
  ctx.fillStyle = '#1e1a24'; ctx.fillRect(x - 12, y - 7, 25, 9);
  ctx.fillStyle = '#8a4ad8'; ctx.fillRect(x - 12, y - 7, 25, 1); ctx.fillStyle = '#5a2a98'; ctx.fillRect(x - 12, y - 1, 25, 1);
  ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.fillRect(x - 11, y - 6, 23, 1);
  // pumplyktan fram (till vänster – vagnen åker åt vänster in i huset)
  ctx.fillStyle = '#e87a20'; ctx.fillRect(x - 17, y - 7, 7, 7); ctx.fillRect(x - 18, y - 6, 9, 5); ctx.fillStyle = '#c85a10'; ctx.fillRect(x - 14, y - 7, 1, 7);
  ctx.fillStyle = Math.sin(t * 9) > -0.6 ? '#fff070' : '#c8a030'; ctx.fillRect(x - 16, y - 5, 1, 1); ctx.fillRect(x - 12, y - 5, 1, 1); ctx.fillRect(x - 16, y - 2, 5, 1);
  ctx.fillStyle = '#4a7a2a'; ctx.fillRect(x - 14, y - 9, 2, 2);
  for (const hx of [x - 8, x + 8]) { ctx.fillStyle = '#2a2830'; ctx.fillRect(hx - 2, y + 1, 5, 4); ctx.fillStyle = '#8a8a98'; ctx.fillRect(hx, y + 2, 1, 2); }
}

// ---------- inne i huset ----------
const FART = 36;   // korridoren glider förbi så här många px/s
// vad som händer när (sekunder inne): ljuden spelas av scenen när tiden passerar
export const SPOK_LJUD = [[0.4, 'spok'], [2.2, 'chirp'], [6.0, 'bu'], [9.0, 'pling'], [11.9, 'spok'], [16.6, 'fanfare']];
const SKRAMD = [[6.0, 7.3], [11.9, 13.0]];   // då åker armarna upp
export const spokRadd = (i) => SKRAMD.some(([a, b]) => i >= a && i < b);

const SPOKE = ['...wwwww...', '..wwwwwww..', '.wwwwwwwww.', '.wwkkwkkww.', '.wwkkwkkww.', 'wwwwwwwwwww', 'wwwwkkkwwww', 'wwwwkkkwwww', 'wwwwwwwwwww', 'wwwwwwwwwww', 'ww.www.www.', 'w...w...w..'];
const SKELETT = ['...www...', '..wwwww..', '..wkwkw..', '..wwwww..', '...wkw...', '....w....', '..wwwww..', '.w.www.w.', '.w..w..w.', '...www...', '....w....', '...www...', '..w...w..', '..w...w..', '..w...w..', '.ww...ww.'];
const FLADDER = [['w.......w', 'ww.kkk.ww', '.wwkkkww.', '...kkk...'], ['.........', '...kkk...', '.wwkkkww.', 'ww.....ww']];
function sprite(ctx, rader, x, y, farg, skala = 1) {
  rader.forEach((rad, j) => { for (let i = 0; i < rad.length; i++) { const c = rad[i]; if (c === '.') continue; ctx.fillStyle = farg[c] || '#ffffff'; ctx.fillRect(Math.round(x + i * skala), Math.round(y + j * skala), skala, skala); } });
}
// speglingen: åkarna ritas i en liten bild som spegelsalen töjer ut
let spegelCv = null;
function spegelbild(sitt) {
  spegelCv ||= document.createElement('canvas'); spegelCv.width = 40; spegelCv.height = 44;
  const c = spegelCv.getContext('2d'); c.clearRect(0, 0, 40, 44);
  sitt.forEach((r, s) => { if (r) drawPerson(c, 13 + s * 14, 40, r.look, 'down', 0); });
  return spegelCv;
}

// hela skärmen: korridoren, det som händer, vagnen med åkarna, mörkret runt lyktan
export function ritaSpokInne(ctx, VW, VH, i, sitt, t) {
  const CX = Math.round(VW * 0.36), golv = Math.round(VH * 0.74), tak = Math.round(VH * 0.14), sx = (X) => Math.round(X - i * FART + CX);
  ctx.fillStyle = '#0c0812'; ctx.fillRect(0, 0, VW, VH);
  // tapeten, boaseringen, golvet och spåret
  for (let x = 0; x < VW; x++) {
    const w = x + Math.round(i * FART);
    ctx.fillStyle = w % 12 < 2 ? '#341e44' : '#2a1838'; ctx.fillRect(x, tak, 1, golv - tak - 14);
    ctx.fillStyle = w % 30 === 0 ? '#1e120c' : '#3a2418'; ctx.fillRect(x, golv - 14, 1, 14);
    ctx.fillStyle = w % 16 === 0 ? '#120a10' : '#1e1218'; ctx.fillRect(x, golv, 1, VH - golv);
    if (w % 8 < 3) { ctx.fillStyle = '#3a2a22'; ctx.fillRect(x, VH - 21, 1, 9); }
  }
  ctx.fillStyle = '#6a6a78'; ctx.fillRect(0, VH - 20, VW, 1); ctx.fillRect(0, VH - 14, VW, 1);
  ctx.fillStyle = '#4a3a2e'; ctx.fillRect(0, golv - 15, VW, 1);
  ctx.fillStyle = '#05030a'; ctx.fillRect(0, 0, VW, tak);
  for (let k = 0; k < 6; k++) { const x = ((k * 97 - Math.round(i * FART * 0.9)) % (VW + 60) + VW + 60) % (VW + 60) - 30; ctx.fillStyle = 'rgba(210,210,230,.35)'; for (let j = 0; j < 12; j++) { ctx.fillRect(x + j, tak + Math.round(Math.sin(j / 3) * 2) + 2, 1, 1); ctx.fillRect(x + 6, tak + j, 1, 1); } }   // spindelväv i taket
  // kandelabrar och porträtt med ögon som följer vagnen
  for (let k = -1; k < 12; k++) {
    const kx = sx(k * 150 + 40); if (kx < -30 || kx > VW + 30) continue;
    const ky = tak + Math.round((golv - tak) * 0.38);
    ctx.fillStyle = '#c8a040'; ctx.fillRect(kx - 7, ky, 15, 2); ctx.fillRect(kx, ky, 1, 8); ctx.fillRect(kx - 3, ky + 8, 7, 1);
    for (const lx of [-7, 0, 7]) { ctx.fillStyle = '#f0ead8'; ctx.fillRect(kx + lx, ky - 5, 1, 5); const fl = Math.sin(t * 14 + lx + k) > 0 ? 1 : 0; ctx.fillStyle = '#ffd860'; ctx.fillRect(kx + lx, ky - 8 + fl, 1, 2); ctx.fillStyle = '#fff6c0'; ctx.fillRect(kx + lx, ky - 7 + fl, 1, 1); }
    const px = sx(k * 150 + 115); if (px < -30 || px > VW + 30) continue;
    const py = tak + 8;
    ctx.fillStyle = '#c8a040'; ctx.fillRect(px - 10, py, 21, 26); ctx.fillStyle = '#2a2030'; ctx.fillRect(px - 8, py + 2, 17, 22);
    ctx.fillStyle = k % 2 ? '#8a7a68' : '#7a6a8a'; ctx.fillRect(px - 4, py + 6, 9, 10); ctx.fillStyle = '#3a2a2a'; ctx.fillRect(px - 5, py + 4, 11, 4); ctx.fillRect(px - 6, py + 16, 13, 8);
    const ox = CX > px + 20 ? 1 : CX < px - 20 ? -1 : 0;
    ctx.fillStyle = '#f4f1ea'; ctx.fillRect(px - 3, py + 9, 2, 2); ctx.fillRect(px + 2, py + 9, 2, 2); ctx.fillStyle = '#1e1a24'; ctx.fillRect(px - 3 + (ox > 0 ? 1 : 0), py + 10, 1, 1); ctx.fillRect(px + 2 + (ox > 0 ? 1 : 0), py + 10, 1, 1);
  }
  // 1) skylten VÄLKOMMEN IN! hänger från taket
  { const x = sx(1.2 * FART + 30), s = $t('VÄLKOMMEN IN!'), w = textW(SMALL, s) + 10; if (x > -w && x < VW + w) { const sw = Math.round(Math.sin(t * 2) * 2); ctx.fillStyle = '#5a5a66'; ctx.fillRect(x - (w >> 2), tak, 1, 18); ctx.fillRect(x + (w >> 2), tak, 1, 18); ctx.fillStyle = '#6a4a2a'; ctx.fillRect(x - (w >> 1) + sw, tak + 18, w, 11); ctxText(ctx, SMALL, s, x - (w >> 1) + 5 + sw, tak + 21, '#a8ff78'); } }
  // 2) fladdermössen sveper förbi
  if (i > 1.8 && i < 5.8) for (let k = 0; k < 7; k++) { const x = VW + 20 - (i - 1.8) * 170 + k * 26 + (k % 3) * 11, y = tak + 12 + (k % 4) * 12 + Math.sin(t * 8 + k) * 5; sprite(ctx, FLADDER[Math.floor(t * 10 + k) % 2], x, y, { w: '#6a5a82', k: '#241a30' }, 2); ctx.fillStyle = '#ff6060'; ctx.fillRect(Math.round(x + 7), Math.round(y + 2), 1, 1); ctx.fillRect(Math.round(x + 10), Math.round(y + 2), 1, 1); }
  // 3) garderoben – spöket hoppar fram: BU!
  { const gx = sx(6.2 * FART), gy = golv - 14; if (gx > -40 && gx < VW + 40) {
    ctx.fillStyle = '#4a2e1c'; ctx.fillRect(gx - 12, gy - 44, 25, 44); ctx.fillStyle = '#3a2214'; ctx.fillRect(gx - 12, gy - 44, 25, 3); ctx.fillStyle = '#5a3a24'; ctx.fillRect(gx - 11, gy - 40, 11, 38);
    const oppen = i >= 6.0; if (!oppen) { ctx.fillRect(gx + 1, gy - 40, 11, 38); ctx.fillStyle = '#c8a040'; ctx.fillRect(gx - 1, gy - 22, 1, 2); ctx.fillRect(gx + 2, gy - 22, 1, 2); } else { ctx.fillStyle = '#0e0a14'; ctx.fillRect(gx + 1, gy - 40, 11, 38); ctx.fillStyle = '#5a3a24'; ctx.fillRect(gx + 13, gy - 41, 4, 40); }
    if (i >= 6.0 && i < 7.6) { const u = Math.min(1, (i - 6) / 0.35), sk = 1 + Math.round(u * 2), bx = gx + 6 - (11 * sk) / 2 + u * 10, by = gy - 34 - u * 22 + Math.sin(t * 7) * 2; sprite(ctx, SPOKE, bx, by, { w: '#f4f1ea', k: '#1e1a24' }, sk); if (i < 7.2) { const s = $t('BU!'); ctxText(ctx, BIG, s, Math.round(bx + 11 * sk + 4), Math.round(by - 4), '#1e1a24', 2); ctxText(ctx, BIG, s, Math.round(bx + 11 * sk + 3), Math.round(by - 5), '#ffe060', 2); } }
  } }
  // 4) skelettet dansar på en liten scen
  { const x = sx(9.5 * FART), y = golv - 6; if (x > -40 && x < VW + 40) {
    ctx.fillStyle = '#5a2a3a'; ctx.fillRect(x - 18, y - 2, 37, 6); ctx.fillStyle = '#7a3a4a'; ctx.fillRect(x - 18, y - 2, 37, 1);
    ctx.fillStyle = 'rgba(255,240,180,.12)'; for (let j = 0; j < 40; j++) ctx.fillRect(x - 4 - j / 3, tak + j * ((y - tak) / 40), 9 + j * 0.66, (y - tak) / 40 + 1);
    const hopp = Math.abs(Math.sin(t * 6)) * 3, arm = Math.floor(t * 4) % 2;
    sprite(ctx, SKELETT, x - 4, y - 18 - hopp, { w: '#f0ece0', k: '#1e1a24' }, 1);
    ctx.fillStyle = '#f0ece0'; if (arm) { ctx.fillRect(x - 5, y - 15 - hopp, 1, 3); ctx.fillRect(x + 5, y - 14 - hopp, 1, 3); } else { ctx.fillRect(x - 6, y - 12 - hopp, 1, 3); ctx.fillRect(x + 6, y - 15 - hopp, 1, 3); }
    for (let k = 0; k < 3; k++) { const nx = x + 10 + k * 7, ny = y - 30 - ((t * 12 + k * 9) % 20); ctx.fillStyle = '#ffe060'; ctx.fillRect(Math.round(nx), Math.round(ny), 2, 2); ctx.fillRect(Math.round(nx) + 1, Math.round(ny) - 4, 1, 4); }
  } }
  // 5) spindeln firar sig ner framför vagnen
  if (i > 11.6 && i < 13.6) {
    const u = (i - 11.6) / 2, ner = u < 0.25 ? u / 0.25 : u < 0.7 ? 1 - Math.sin((u - 0.25) * 14) * 0.05 * (1 - u) : 1 - (u - 0.7) / 0.3;
    const x = CX + 22, y = tak + Math.round(ner * (golv - tak) * 0.52);
    ctx.fillStyle = 'rgba(230,230,240,.7)'; ctx.fillRect(x, tak, 1, y - tak);
    ctx.fillStyle = '#1e1a24';
    for (let k = 0; k < 4; k++) { const v = Math.sin(t * 10 + k) > 0 ? 1 : 0; ctx.fillRect(x - 10 + k, y + 2 + k * 2 - v, 4, 1); ctx.fillRect(x + 7 - k, y + 2 + k * 2 - v, 4, 1); ctx.fillRect(x - 10 + k, y + 3 + k * 2, 1, 2); ctx.fillRect(x + 10 - k, y + 3 + k * 2, 1, 2); }
    ctx.fillRect(x - 5, y, 11, 10); ctx.fillRect(x - 4, y - 1, 9, 12);
    ctx.fillStyle = '#f4f1ea'; ctx.fillRect(x - 3, y + 2, 3, 3); ctx.fillRect(x + 1, y + 2, 3, 3); ctx.fillStyle = '#1e1a24'; ctx.fillRect(x - 2, y + 3, 1, 1); ctx.fillRect(x + 2, y + 3, 1, 1);
    ctx.fillStyle = '#d06080'; ctx.fillRect(x - 1, y + 7, 3, 1);
  }
  // 6) spegelsalen: man blir bred, lång och vågig
  if (sitt.some(Boolean)) {
    const bild = spegelbild(sitt);
    [[13.7, 1.9, 0.7], [15.0, 0.7, 1.5], [16.3, 1.2, 1.2]].forEach(([T, ax, ay], k) => {
      const x = sx(T * FART + 20), w = 34, h = 40, y = tak + 8; if (x < -w || x > VW + w) return;
      ctx.fillStyle = '#c8a040'; ctx.fillRect(x - (w >> 1) - 2, y - 2, w + 4, h + 4); ctx.fillStyle = '#9ab8c8'; ctx.fillRect(x - (w >> 1), y, w, h);
      ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.fillRect(x - (w >> 1) + 3, y + 2, 2, h - 6);
      ctx.save(); ctx.beginPath(); ctx.rect(x - (w >> 1), y, w, h); ctx.clip();
      if (k === 2) for (let r = 0; r < 44; r += 2) ctx.drawImage(bild, 0, r, 40, 2, Math.round(x - 20 + Math.sin(t * 6 + r / 5) * 3), Math.round(y + h - 44 * ay + r * ay), 40, Math.ceil(2 * ay));
      else ctx.drawImage(bild, Math.round(x - 20 * ax), Math.round(y + h - 44 * ay), Math.round(40 * ax), Math.round(44 * ay));
      ctx.restore();
    });
  }
  // 7) spökkungen vinkar hej då – och ljuset i slutet av tunneln
  if (i > 15.8) {
    const x = sx(17.4 * FART), y = tak + 6 + Math.sin(t * 3) * 3;
    sprite(ctx, SPOKE, x - 11, y, { w: '#e8f0ff', k: '#2a2a48' }, 2);
    ctx.fillStyle = '#f0c030'; ctx.fillRect(x - 7, y - 5, 15, 5); for (const k of [-7, -2, 3, 7]) ctx.fillRect(x + k, y - 8, 1, 3);
    ctx.fillStyle = '#e04848'; ctx.fillRect(x - 1, y - 4, 2, 2);
    if (i > 16.4) { const s = $t('HEJ DÅ – KOM SNART IGEN!'), w = textW(SMALL, s) + 8; ctx.fillStyle = 'rgba(20,18,26,.85)'; ctx.fillRect(x - (w >> 1), y + 28, w, 10); ctxText(ctx, SMALL, s, x - (w >> 1) + 4, y + 30, '#e8f0ff'); }
  }
  // vagnen i förgrunden
  ritaSpokVagn(ctx, CX, VH - 18 + (Math.sin(t * 11) > 0.6 ? 1 : 0), sitt, t, spokRadd(i));
  // mörkret runt pumplyktan; ljuset i slutet
  const g = ctx.createRadialGradient(CX, VH - 30, 24, CX, VH - 30, VW * 0.62), fl = Math.sin(t * 13) > 0.85 ? 0.06 : 0;
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.55, `rgba(0,0,0,${(0.45 + fl).toFixed(2)})`); g.addColorStop(1, `rgba(0,0,0,${(0.86 + fl).toFixed(2)})`);
  ctx.fillStyle = g; ctx.fillRect(0, 0, VW, VH);
  if (i < 0.6) { ctx.fillStyle = `rgba(0,0,0,${(1 - i / 0.6).toFixed(2)})`; ctx.fillRect(0, 0, VW, VH); }
  if (i > 17.2) { ctx.fillStyle = `rgba(255,250,235,${Math.min(1, (i - 17.2) / 0.8).toFixed(2)})`; ctx.fillRect(0, 0, VW, VH); }
}

// utanför: spöket som tittar ut genom vindsfönstret då och då, och fladdermössen runt tornet
export function ritaSpoktitt(ctx, x, y, t) {
  const fas = (t * 0.45) % 6; if (fas > 2.2) return;
  const upp = fas < 0.4 ? fas / 0.4 : fas > 1.8 ? (2.2 - fas) / 0.4 : 1, yy = Math.round(y + 6 - upp * 7);
  ctx.save(); ctx.beginPath(); ctx.arc(x, y, 6.5, 0, Math.PI * 2); ctx.clip();
  sprite(ctx, SPOKE.slice(0, 8), x - 5, yy, { w: '#f4f1ea', k: '#1e1a24' }, 1);
  ctx.restore();
}
export function ritaFladdermus(ctx, x, y, t, k) {
  sprite(ctx, FLADDER[Math.floor(t * 9 + k) % 2], x - 4, y - 2, { w: '#3a2a4a', k: '#1a1222' });
}
