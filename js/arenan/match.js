// ⚽ MATCHDAGEN PÅ PIXEL ARENA – bilden (ritas av js/scenes/matchdag.js). Vyn från läktaren: himlen efter klockan,
// strålkastarmasterna, bortre läktaren full av folk med banderoller, storbildsskärmen med ställningen och klockan,
// planen i lätt perspektiv (bredare närmast), spelarna som små figurer i lagfärgerna, bollen, den närmaste läktaren
// med supportrarnas ryggar (halsdukar, klappande händer, VÅGEN), klackledaren Kjell med megafonen och knapparna.
// Ett pixelkorn, cachad bakgrund per dagsljus.
import { Pix, SMALL, BIG, ctxText, textW, text, hash, mix } from '../core/floor-pix.js';
import { drawPerson } from '../core/people.js';
import { KBK } from './karta.js';
import { $t } from '../core/i18n.js';

export const FW = 384, FH = 216;
export const PLAN = { y0: 46, y1: 120, cx: 192, topp: 96, botten: 150 };   // halva bredden överst/nederst (perspektiv)
export const LAKTARE = { y0: 128, rader: [136, 154, 172], n: 22 };          // de tre raderna närmast (y = fötter), supportrar per rad
export const BTN = (i) => ({ x: 8 + i * 94, y: 194, w: 86, h: 20 });
export const KJELL = { x: 36, y: 176 };
export const JAG = { x: 192, y: 178 };
const css = (c) => '#' + (c & 0xffffff).toString(16).padStart(6, '0');

export const halva = (y) => PLAN.topp + (PLAN.botten - PLAN.topp) * ((y - PLAN.y0) / (PLAN.y1 - PLAN.y0));
// planens normerade koordinater (px −1…1 i sidled, py 0…1 uppifrån) → skärmen
export function planXY(px, py) { const y = PLAN.y0 + py * (PLAN.y1 - PLAN.y0); return { x: PLAN.cx + px * halva(y), y }; }

// ---------- bakgrunden (cachad per ljus: 0 dag, 1 kväll, 2 natt) ----------
const BG = new Map();
export function paintMatchBg(ljus, motst) {
  const key = ljus + '|' + motst.kort;
  if (BG.has(key)) return BG.get(key);
  const P = new Pix(FW, FH);
  const SKY = ljus === 0 ? [0x6ab0e8, 0xa8d4f4] : ljus === 1 ? [0x3a3a7a, 0xf09060] : [0x0a1030, 0x1e2a5a];
  for (let y = 0; y < 46; y++) for (let x = 0; x < FW; x++) P.px(x, y, mix(SKY[0], SKY[1], y / 46 + (hash(x >> 2, y >> 1, 2) - 0.5) * 0.04));
  if (ljus === 2) for (let k = 0; k < 30; k++) P.px((hash(k, 1, 3) * FW) | 0, (hash(k, 2, 3) * 20) | 0, 0xffffff);
  // strålkastarmasterna i hörnen
  for (const mx of [20, 364]) { P.rect(mx - 1, 4, 3, 44, 0x3a3a42); P.vl(mx - 1, 4, 44, 0x6a6a72); P.rect(mx - 9, 0, 19, 6, 0x2a2a30); for (let i = 0; i < 4; i++) P.rect(mx - 8 + i * 5, 1, 3, 4, ljus ? 0xfff6c0 : 0xd8d8e0); }
  // bortre läktaren: taket, raderna med folk, banderollerna
  P.rect(40, 12, 304, 6, 0x5a5a66); P.hl(40, 12, 304, 0x8a8a94); P.hl(40, 18, 304, 0x3a3a42);
  for (let y = 19; y < 44; y++) for (let x = 42; x < 342; x++) { const rad = (y - 19) >> 2, h = hash(x >> 1, rad, 4); P.px(x, y, (y - 19) % 4 === 3 ? 0x2a2430 : h > 0.6 ? KBK.rod : h > 0.3 ? KBK.svart : h > 0.15 ? 0xf4f1ea : 0x3a2a40); if ((y - 19) % 4 === 0 && (x & 1)) P.px(x, y, mix(0xe0b090, 0x8a5a40, hash(x, rad, 5))); }
  for (const [bx, s, bg] of [[70, 'KBK', KBK.rod], [240, $t('HEJA'), KBK.svart]]) { const w = textW(SMALL, s) + 12; P.rect(bx, 30, w, 11, bg); P.box(bx, 30, w, 11, 0xf4f1ea); text(P, SMALL, s, bx + 6, 32, 0xf4f1ea); }
  // storbildsskärmen (ramen; siffrorna ritas levande)
  P.rect(142, 4, 100, 34, 0x1a1a22); P.box(142, 4, 100, 34, 0x8a8a94); P.rect(144, 6, 96, 30, 0x0a0a12);
  P.rect(188, 38, 8, 8, 0x3a3a42); P.rect(186, 44, 12, 2, 0x5a5a66);
  // planen: gräs i ränder (perspektiv), linjer, målen, sargen
  for (let y = PLAN.y0; y <= PLAN.y1; y++) { const h = halva(y), rand = Math.floor((y - PLAN.y0) / 7) & 1; for (let x = Math.round(PLAN.cx - h) - 6; x <= Math.round(PLAN.cx + h) + 6; x++) { const inne = Math.abs(x - PLAN.cx) <= h; P.px(x, y, inne ? mix(rand ? 0x3e8e3a : 0x48a042, 0x58b050, hash(x >> 1, y, 6) * 0.3) : 0xc8c0a8); } }
  const lin = 0xf4f1ea;
  for (let y = PLAN.y0; y <= PLAN.y1; y++) { const h = halva(y); P.px(Math.round(PLAN.cx - h), y, lin); P.px(Math.round(PLAN.cx + h), y, lin); P.px(PLAN.cx, y, lin); }
  for (let x = PLAN.cx - PLAN.topp; x <= PLAN.cx + PLAN.topp; x++) P.px(x, PLAN.y0, lin);
  for (let x = PLAN.cx - PLAN.botten; x <= PLAN.cx + PLAN.botten; x++) P.px(x, PLAN.y1, lin);
  for (let a = 0; a < 64; a++) { const an = a / 64 * Math.PI * 2; const y = (PLAN.y0 + PLAN.y1) / 2 + Math.sin(an) * 12; P.px(Math.round(PLAN.cx + Math.cos(an) * 26), Math.round(y), lin); }
  P.px(PLAN.cx, (PLAN.y0 + PLAN.y1) >> 1, lin);
  // straffområdena och målen (vänster = KBK försvarar, höger = bortalagets mål)
  for (const sida of [-1, 1]) {
    const q0 = planXY(sida * 0.72, 0.25), q1 = planXY(sida * 0.72, 0.75);
    for (let y = Math.round(q0.y); y <= Math.round(q1.y); y++) P.px(Math.round(PLAN.cx + sida * 0.72 * halva(y)), y, lin);
    for (const py of [0.25, 0.75]) { const a = planXY(sida * 0.72, py), b = planXY(sida, py); for (let x = Math.min(a.x, b.x); x <= Math.max(a.x, b.x); x++) P.px(Math.round(x), Math.round(a.y), lin); }
    const m0 = planXY(sida, 0.38), m1 = planXY(sida, 0.62);
    for (let y = Math.round(m0.y); y <= Math.round(m1.y); y++) { const x = Math.round(PLAN.cx + sida * halva(y)); P.px(x + sida * 4, y, 0xf4f1ea); if ((y + x) & 1) P.px(x + sida * 2, y, 0xd8d8e0); P.px(x + sida * 3, y, 0xd8d8e0); }
    P.hl(Math.min(m0.x, m0.x + sida * 4), Math.round(m0.y), 5, 0xf4f1ea); P.hl(Math.min(m1.x, m1.x + sida * 4), Math.round(m1.y), 5, 0xf4f1ea);
  }
  // reklamskyltarna längs bortre långsidan
  for (let x = PLAN.cx - PLAN.topp - 2, k = 0; x < PLAN.cx + PLAN.topp; x += 32, k++) { const c = [0x2a5aa8, 0xf0c030, 0xd8343c, 0x46a35a][k % 4]; P.rect(x, PLAN.y0 - 7, 30, 6, c); P.rect(x + 3, PLAN.y0 - 5, 24, 2, mix(c, 0xffffff, 0.6)); }
  // läktaren närmast: betongtrappor i tre steg, sedan räcket
  for (let y = 120; y < 128; y++) P.hl(0, y, FW, mix(0x8a8a94, 0x6a6a74, (y - 120) / 8));
  for (let y = 128; y < FH; y++) P.hl(0, y, FW, mix(0x4a4a56, 0x2a2a34, (y - 128) / 88));
  for (const ry of LAKTARE.rader) { P.hl(0, ry + 2, FW, 0x5a5a66); P.hl(0, ry + 3, FW, 0x3a3a44); }
  P.rect(0, 124, FW, 2, 0xd8d8e0); for (let x = 6; x < FW; x += 24) P.rect(x, 120, 2, 6, 0xd8d8e0);
  const cv = P.flush(); BG.set(key, cv); return cv;
}

// ---------- storbildsskärmen (levande) ----------
export function drawTavla(ctx, S, motst, minut, info) {
  const x = 144, y = 6;
  ctxText(ctx, SMALL, 'KBK', x + 6, y + 4, '#f4f1ea');
  ctxText(ctx, SMALL, motst.kort, x + 96 - 6 - textW(SMALL, motst.kort), y + 4, '#f4f1ea');
  const s = `${S.kbk} – ${S.gast}`; ctxText(ctx, BIG, s, x + 48 - (textW(BIG, s) >> 1), y + 3, '#ffd23f');
  const m = `${minut}'`; ctxText(ctx, SMALL, m, x + 48 - (textW(SMALL, m) >> 1), y + 16, '#8ae08a');
  if (info) { ctx.fillStyle = '#ffd23f'; const w = Math.min(92, textW(SMALL, info)); ctx.save(); ctx.beginPath(); ctx.rect(x + 2, y + 22, 92, 8); ctx.clip(); ctxText(ctx, SMALL, info, x + 48 - (w >> 1), y + 23, '#ffd23f'); ctx.restore(); }
}

// ---------- spelarna på planen ----------
export function drawSpelare(ctx, p, farg, skala = 1) {
  const { x, y } = planXY(p.x, p.y), s = 0.7 + p.y * 0.6;   // större ju närmare
  const h = Math.round(6 * s * skala), w = Math.max(2, Math.round(3 * s));
  ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(Math.round(x - w / 2) - 1, Math.round(y), w + 2, 1);
  ctx.fillStyle = css(farg.byxor); ctx.fillRect(Math.round(x - w / 2), Math.round(y - h * 0.4), w, Math.round(h * 0.4));
  ctx.fillStyle = css(farg.troja); ctx.fillRect(Math.round(x - w / 2), Math.round(y - h * 0.8), w, Math.round(h * 0.4) + 1);
  ctx.fillStyle = css(farg.hud); ctx.fillRect(Math.round(x - w / 2) + (w > 2 ? 1 : 0), Math.round(y - h), Math.max(1, w - (w > 2 ? 2 : 0)), Math.max(1, Math.round(h * 0.25)));
  if (p.jubel) { ctx.fillStyle = css(farg.hud); ctx.fillRect(Math.round(x - w / 2) - 1, Math.round(y - h - 2), 1, 2); ctx.fillRect(Math.round(x + w / 2), Math.round(y - h - 2), 1, 2); }
}
export function drawBoll(ctx, b) {
  const { x, y } = planXY(b.x, b.y), h = b.h || 0;
  ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.fillRect(Math.round(x) - 1, Math.round(y), 2, 1);
  ctx.fillStyle = '#ffffff'; ctx.fillRect(Math.round(x) - 1, Math.round(y - 2 - h), 2, 2); ctx.fillStyle = '#1a1414'; ctx.fillRect(Math.round(x), Math.round(y - 2 - h), 1, 1);
}

// ---------- läktaren närmast: supportrarnas ryggar ----------
const SUPP = Array.from({ length: LAKTARE.rader.length * LAKTARE.n }, (_, i) => {
  const rad = (i / LAKTARE.n) | 0, k = i % LAKTARE.n, h1 = hash(k, rad, 11), h2 = hash(k, rad, 12);
  return { rad, k, x: 4 + k * 17.6 + (rad % 2) * 8 + Math.round((h1 - 0.5) * 4), y: LAKTARE.rader[rad], hud: [0xf1c7a3, 0xe0a97f, 0xc68a5c, 0x8a5a3c][(h1 * 4) | 0], har: [0x2a1a14, 0x5a3a20, 0xd8a040, 0x1a1a1a, 0xb7392b][(h2 * 5) | 0], troja: h2 > 0.35 ? KBK.rod : h2 > 0.15 ? KBK.svart : 0xf4f1ea, halsduk: h1 > 0.4, kid: h2 < 0.2, mossa: h1 > 0.8 };
});
export function drawLaktare(ctx, { t, klapp, vag, jubel, suck, hoppa }) {
  for (const s of SUPP) {
    if (s.rad === 2 && Math.abs(s.x - JAG.x) < 14) continue;   // platsen där man själv står
    let upp = 0;
    if (vag != null) { const d = Math.abs(s.k / LAKTARE.n - vag); if (d < 0.14) upp = Math.round(Math.cos(d / 0.14 * Math.PI / 2) * 6); }
    if (jubel > 0) upp = Math.max(upp, ((Math.floor(t * 8) + s.k) & 1) ? 5 : 2);
    if (hoppa) upp = Math.max(upp, Math.round(Math.abs(Math.sin(t * 6 + s.k)) * 4));
    const y = s.y - upp, hh = s.kid ? 5 : 7, bw = s.kid ? 9 : 12, hw = s.kid ? 5 : 6;
    ctx.fillStyle = css(s.troja); ctx.fillRect(Math.round(s.x - bw / 2), y - 10 - hh + 4, bw, 10 + (s.kid ? 0 : 2));   // ryggen
    if (s.halsduk) { ctx.fillStyle = css(KBK.vit); ctx.fillRect(Math.round(s.x - bw / 2), y - 10 - hh + 4, bw, 2); ctx.fillStyle = css(KBK.rod); ctx.fillRect(Math.round(s.x - bw / 2) + 2, y - 10 - hh + 4, 2, 2); ctx.fillRect(Math.round(s.x - bw / 2) + 6, y - 10 - hh + 4, 2, 2); }
    ctx.fillStyle = css(s.hud); ctx.fillRect(Math.round(s.x - hw / 2), y - 10 - hh - 2, hw, hh);   // huvudet
    ctx.fillStyle = css(s.mossa ? KBK.rod : s.har); ctx.fillRect(Math.round(s.x - hw / 2), y - 10 - hh - 2, hw, s.mossa ? 4 : 3);
    if (s.mossa) { ctx.fillStyle = css(KBK.vit); ctx.fillRect(Math.round(s.x - hw / 2), y - 10 - hh + 1, hw, 1); }
    const klappar = klapp > 0 && ((s.k * 3 + Math.floor(t * 9)) % 3 !== 0);
    if (klappar || jubel > 0) { ctx.fillStyle = css(s.hud); const ay = y - 10 - hh - (jubel > 0 ? 6 : 1); ctx.fillRect(Math.round(s.x - bw / 2) - 2, ay, 2, 5); ctx.fillRect(Math.round(s.x + bw / 2), ay, 2, 5); }
    if (suck > 0 && (s.k % 4 === 0)) { ctx.fillStyle = css(s.hud); ctx.fillRect(Math.round(s.x - hw / 2) - 1, y - 10 - hh - 1, 2, 3); ctx.fillRect(Math.round(s.x + hw / 2) - 1, y - 10 - hh - 1, 2, 3); }   // händerna för ansiktet
  }
}
// man själv: ryggen mot kameran med KBK-halsduk, klappar/jublar/vågar
export function drawJag(ctx, look, { t, pose, vagUpp }) {
  let frame = 0, dy = 0;
  if (pose === 'klappa') frame = (Math.floor(t * 8) & 1) ? 10 : 0;
  else if (pose === 'heja') { frame = 10; dy = -Math.round(Math.abs(Math.sin(t * 10)) * 3); }
  else if (pose === 'vagen') { frame = 10; dy = -vagUpp; }
  else if (pose === 'sjung') { frame = 11; dy = -Math.round(Math.abs(Math.sin(t * 5)) * 2); }
  drawPerson(ctx, JAG.x, JAG.y + dy, look, 'up', frame);
  ctx.fillStyle = css(KBK.vit); ctx.fillRect(JAG.x - 6, JAG.y + dy - 30, 12, 3); ctx.fillStyle = css(KBK.rod); ctx.fillRect(JAG.x - 4, JAG.y + dy - 30, 2, 3); ctx.fillRect(JAG.x + 1, JAG.y + dy - 30, 2, 3);   // halsduken
}
export function drawKjell(ctx, look, cue, chants) {
  drawPerson(ctx, KJELL.x, KJELL.y, look, 'right', cue ? 11 : 0);
  ctx.fillStyle = '#e8c050'; ctx.fillRect(KJELL.x + 6, KJELL.y - 24, 6, 4); ctx.fillStyle = '#1c1a20'; ctx.fillRect(KJELL.x + 4, KJELL.y - 23, 2, 2);
  if (!cue) return;
  const ch = chants.find((q) => q.id === cue.id), txt = cue.text, w = textW(SMALL, txt) + 22, x = KJELL.x + 14, y = KJELL.y - 62;
  ctx.fillStyle = '#f4f1ea'; ctx.fillRect(x, y, w, 18); ctx.fillStyle = '#1c1a20'; ctx.fillRect(x - 1, y + 1, 1, 16); ctx.fillRect(x + w, y + 1, 1, 16); ctx.fillRect(x + 1, y - 1, w - 2, 1); ctx.fillRect(x + 1, y + 18, w - 2, 1);
  ctx.fillStyle = '#f4f1ea'; ctx.fillRect(x - 2, y + 12, 2, 2); ctx.fillRect(x - 4, y + 14, 2, 2);
  ch.ikon.forEach((r, j) => { for (let i = 0; i < 7; i++) if (r[i] === 'k') { ctx.fillStyle = '#1c1a20'; ctx.fillRect(x + 4 + i, y + 3 + j, 1, 1); } });
  ctxText(ctx, SMALL, txt, x + 15, y + 4, '#1c1a20');
  const k = Math.max(0, cue.t / cue.dur);
  ctx.fillStyle = '#2a2430'; ctx.fillRect(x, y + 19, w, 3); ctx.fillStyle = k > 0.5 ? '#46a35a' : k > 0.25 ? '#f0c030' : '#e04848'; ctx.fillRect(x, y + 19, Math.round(w * k), 3);
}
export function drawKnappar(ctx, chants, pose, streak) {
  chants.forEach((ch, i) => {
    const B = BTN(i), het = pose === ch.id;
    ctx.fillStyle = het ? '#f0c030' : '#2a2436'; ctx.fillRect(B.x, B.y, B.w, B.h);
    ctx.fillStyle = het ? '#fff0a0' : '#a8303e'; ctx.fillRect(B.x, B.y, B.w, 1); ctx.fillRect(B.x, B.y + B.h - 1, B.w, 1); ctx.fillRect(B.x, B.y, 1, B.h); ctx.fillRect(B.x + B.w - 1, B.y, 1, B.h);
    ch.ikon.forEach((r, j) => { for (let k = 0; k < 7; k++) if (r[k] === 'k') { ctx.fillStyle = het ? '#1c1a20' : '#f4f1ea'; ctx.fillRect(B.x + 8 + k * 2, B.y + 3 + j * 2, 2, 2); } });
    ctxText(ctx, BIG, ch.namn, B.x + 28, B.y + 6, het ? '#1c1a20' : '#f4f1ea');
    ctxText(ctx, SMALL, String(i + 1), B.x + B.w - 8, B.y + 2, het ? '#1c1a20' : '#8a8a92');
  });
  if (streak >= 2) { const s = $t`${streak} I RAD`; ctxText(ctx, SMALL, s, FW - textW(SMALL, s) - 8, 130, '#ffd23f'); }
}
// stämningsmätaren uppe till höger
export function drawStamning(ctx, v) {
  const x = FW - 96, y = 6, w = 88;
  ctx.fillStyle = 'rgba(20,18,26,.8)'; ctx.fillRect(x - 4, y - 2, w + 8, 20);
  ctxText(ctx, SMALL, $t('STÄMNING'), x, y, '#f4f1ea');
  ctx.fillStyle = '#2a2430'; ctx.fillRect(x, y + 10, w, 5);
  ctx.fillStyle = v > 66 ? '#46a35a' : v > 33 ? '#f0c030' : '#e04848'; ctx.fillRect(x, y + 10, Math.round(w * v / 100), 5);
  for (let k = 1; k < 4; k++) { ctx.fillStyle = 'rgba(0,0,0,.4)'; ctx.fillRect(x + Math.round(w * k / 4), y + 10, 1, 5); }
}
