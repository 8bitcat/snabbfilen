// 🐟 FISKMARKNADEN – fiskhandlarjobbet i Fiskehamnen (Carl 2026-11-18: "Hamnen: fiskmarknad"). Man står bakom disken
// i marknadshallen med sex islådor framför sig: TORSK, LAX, SILL, RÄKOR, MAKRILL och KRABBA. Kunderna kommer fram till
// disken på tre platser och visar vad de vill ha (fisken + hur många hekto). Välj rätt låda (klick eller 1–6) och
// klicka på kunden – då står fisken på VÅGEN: visaren sveper fram och tillbaka, och man stoppar den (klick på vågen,
// mellanslag) så nära rätt vikt som möjligt. I det gröna = PÅ GRAMMET (lönen tickar, raden växer), lite utanför =
// kunden tar det ändå men raden bryts, långt utanför = fel. Fel fisk = kunden skakar på huvudet (avdrag), för sent =
// kunden går till fiskbilen i stället (missad). Sex PÅ GRAMMET i rad = BRITTAS GULDVÅG (bonus). Takten följer vanan.
import { drawPerson, makeLook } from '../core/people.js';
import { Pix, SMALL, BIG, ctxText, textW, hash, mix, mul } from '../core/floor-pix.js';
import { planOf, drawShiftHud, drawTimeUp, makePops, abortShift } from './shift.js';
import { play } from '../core/sound.js';
import { $t } from '../core/i18n.js';

const FW = 384, FH = 216;
export const FISKAR = [
  { id: 'torsk', namn: $t('TORSK'), pal: { k: 0x8a9a7a, l: 0xb8c4a8, m: 0x5a6a4a, o: 0x1a1a1a }, ikon: ['.......', 'kkkk..k', 'kklkkkk', 'kkkkokk', 'kmkkkkk', 'kkkk..k', '.......'], farg: 0x6a8a6a },
  { id: 'lax', namn: $t('LAX'), pal: { k: 0xe87a5a, l: 0xf8b090, m: 0xb85a3a, o: 0x1a1a1a }, ikon: ['.......', 'kkkk..k', 'kklkkkk', 'kkkkokk', 'kmkkkkk', 'kkkk..k', '.......'], farg: 0xd86a4a },
  { id: 'sill', namn: $t('SILL'), pal: { k: 0xa8b4c8, l: 0xe0e8f0, m: 0x5a6a80, o: 0x1a1a1a }, ikon: ['kkk..k.', 'kokkkk.', 'kkk..k.', '.......', '.kkk..k', '.kokkkk', '.kkk..k'], farg: 0x8a9ab0 },
  { id: 'rakor', namn: $t('RÄKOR'), pal: { k: 0xf08a7a, l: 0xffc0b0, m: 0xc05a4a, o: 0x1a1a1a }, ikon: ['.kkk...', 'kolkk..', 'k...kk.', '.....k.', '...kkk.', '..kolkk', '..k...k'], farg: 0xe07a6a },
  { id: 'makrill', namn: $t('MAKRILL'), pal: { k: 0x3a6ab0, l: 0x8ab4e8, m: 0x1a3a70, o: 0x1a1a1a }, ikon: ['.......', 'kkkk..k', 'kmlmkkk', 'kkkkokk', 'kmkmkkk', 'kkkk..k', '.......'], farg: 0x3a5a9a },
  { id: 'krabba', namn: $t('KRABBA'), pal: { k: 0xd85a3a, l: 0xf09070, m: 0x8a2a1a, o: 0x1a1a1a }, ikon: ['k.....k', 'kk...kk', '.kkkkk.', 'kokkkok', '.kkkkk.', 'k.k.k.k', 'k.....k'], farg: 0xc0502a },
];
const PLATS = (i) => ({ x: 60 + i * 112, y: 104 });          // kundernas fötter vid disken
const LADA = (i) => ({ x: 6 + i * 63, y: 176, w: 58, h: 22 });
const VAG = { x: 346, y: 152, r: 22 };                       // vågens tavla (mitten) står på diskens högra del
const TOL_GRON = 0.07, TOL_OK = 0.2;                         // visarens träff: inom 7 % av skalan = PÅ GRAMMET, inom 20 % = ok

export function makeJobbFisk(A, { onDone } = {}) {
  const g = A.game, P = planOf(A), DUR = P.seconds;
  const stats = { ok: 0, fel: 0, miss: 0, boxes: 0 };
  const pops = makePops();
  let t = 0, done = false, doneT = 0, reported = false;
  let seed = ((g?.day || 1) * 4241 + 7777) % 233280;
  const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
  const wage = 12;
  const kunder = [null, null, null];   // { look, fisk, hg, t, dur, st: 'in'|'vantar'|'nojd'|'arg'|'ut', k }
  let hall = null, streak = 0, nextT = 1.4, auto = true, vag = null;   // vag = { i, mal (0..1), pos, dir, t }
  const BRITTA = { x: 192, tx: 192 };
  const patience = () => Math.max(5, 9 / (P.pace || 1));
  const gap = () => (1.6 + rnd() * 1.4) / (P.pace || 1);
  function nyKund(fisk = null, hg = null) {
    const lediga = kunder.map((k, i) => (k ? -1 : i)).filter((i) => i >= 0);
    if (!lediga.length) return -1;
    const i = lediga[(rnd() * lediga.length) | 0];
    const f = fisk || FISKAR[(rnd() * FISKAR.length) | 0].id;
    kunder[i] = { look: { ...makeLook(), kid: rnd() < 0.2 }, fisk: f, hg: hg || 1 + ((rnd() * 4) | 0), t: patience(), dur: patience(), st: 'in', k: 0 };
    play('click');
    return i;
  }
  function servera(i) {
    if (done || vag) return;
    const K = kunder[i];
    BRITTA.tx = PLATS(i).x;
    if (!K || K.st !== 'vantar') return;
    if (!hall) { pops.add(PLATS(i).x, 60, $t('VÄLJ FISK FÖRST'), '#f4f1ea'); return; }
    if (hall !== K.fisk) { stats.fel++; streak = 0; K.st = 'arg'; K.k = 1.2; hall = null; play('miss'); pops.add(PLATS(i).x, 60, $t('FEL FISK!'), '#ff6a6a'); return; }
    // rätt fisk → på vågen: målet ligger där kundens hekto hamnar på skalan (1–4 hg över 0–5)
    vag = { i, mal: 0.1 + (K.hg / 5) * 0.8, pos: 0, dir: 1, t: 0, fart: 0.9 * (P.pace || 1) };
    K.t = Math.max(K.t, 4);
    play('click');
  }
  function stoppa() {
    if (done || !vag) return null;
    const V = vag, K = kunder[V.i], d = Math.abs(V.pos - V.mal);
    vag = null; hall = null;
    if (!K) return null;
    if (d <= TOL_GRON) { stats.ok++; streak++; K.st = 'nojd'; K.k = 1.3; pops.add(PLATS(V.i).x, 60, $t('PÅ GRAMMET!'), '#8ae08a'); pops.add(PLATS(V.i).x, 72, `+${wage} kr`, '#ffd23f'); play('ok'); if (streak % 6 === 0) { stats.boxes++; pops.add(FW / 2, 40, $t('BRITTAS GULDVÅG!'), '#ffd23f'); play('fanfare'); } return 'gron'; }
    if (d <= TOL_OK) { stats.ok++; streak = 0; K.st = 'nojd'; K.k = 1.3; pops.add(PLATS(V.i).x, 60, V.pos > V.mal ? $t('LITE ÖVER …') : $t('LITE UNDER …'), '#f4f1ea'); pops.add(PLATS(V.i).x, 72, `+${wage} kr`, '#ffd23f'); play('ok'); return 'ok'; }
    stats.fel++; streak = 0; K.st = 'arg'; K.k = 1.2; pops.add(PLATS(V.i).x, 60, V.pos > V.mal ? $t('ALLDELES FÖR MYCKET!') : $t('ALLDELES FÖR LITE!'), '#ff6a6a'); play('miss'); return 'fel';
  }
  function valj(id) { if (done || vag) return; hall = hall === id ? null : id; play('click'); }
  function update(dt) {
    pops.update(dt);
    BRITTA.x += (BRITTA.tx - BRITTA.x) * Math.min(1, dt * 8);
    if (vag) { vag.t += dt; vag.pos += vag.dir * vag.fart * dt; if (vag.pos >= 1) { vag.pos = 1; vag.dir = -1; } if (vag.pos <= 0) { vag.pos = 0; vag.dir = 1; } }
    for (let i = 0; i < kunder.length; i++) {
      const K = kunder[i]; if (!K) continue;
      if (K.st === 'in') { K.k += dt * 2; if (K.k >= 1) { K.k = 1; K.st = 'vantar'; } continue; }
      if (K.st === 'nojd' || K.st === 'arg') { K.k -= dt; if (K.k <= 0) { K.st = 'ut'; K.k = 1; } continue; }
      if (K.st === 'ut') { K.k -= dt * 2; if (K.k <= 0) kunder[i] = null; continue; }
      if (done) continue;
      K.t -= dt;
      if (K.t <= 0) { if (vag && vag.i === i) { vag = null; hall = null; } stats.miss++; streak = 0; K.st = 'ut'; K.k = 1; play('miss'); pops.add(PLATS(i).x, 60, $t('GICK TILL FISKBILEN …'), '#ff6a6a'); }
    }
    if (done) { doneT += dt; if (doneT > 1.2 && !reported) { reported = true; onDone?.({ ...stats }); } return; }
    t += dt;
    if (t >= DUR) { done = true; vag = null; play('fanfare'); return; }
    if (auto && (nextT -= dt) <= 0) { nyKund(); nextT = gap(); }
  }

  // ---------- bilden ----------
  const css = (c) => '#' + (c & 0xffffff).toString(16).padStart(6, '0');
  const ikon = (ctx, m, x, y, s = 1) => { m.ikon.forEach((r, j) => { for (let i = 0; i < 7; i++) { const c = m.pal[r[i]]; if (c != null) { ctx.fillStyle = css(c); ctx.fillRect(x + i * s, y + j * s, s, s); } } }); };
  let BG = null;
  function paintBg() {
    if (BG) return BG;
    const Pz = new Pix(FW, FH);
    // hallen: vitt kakel med blå bård, höga fönster med hamnen utanför, lampor i taket, krittavlan DAGENS FÅNGST
    for (let y = 0; y < 128; y++) for (let x = 0; x < FW; x++) { const fog = (x % 12 === 11) || (y % 12 === 11); Pz.px(x, y, fog ? 0xc8d0d8 : mix(0xeef2f4, 0xdce4ea, hash(x >> 2, y >> 2, 3) * 0.5)); }
    for (let x = 0; x < FW; x++) { Pz.px(x, 60, 0x2a5aa8); Pz.px(x, 61, 0x3a7bd5); Pz.px(x, 62, 0x2a5aa8); }
    for (const wx of [20, 300]) { Pz.rect(wx - 2, 8, 64, 44, 0x3a3a42); for (let y = 10; y < 50; y++) for (let x = wx; x < wx + 60; x++) { const u = (y - 10) / 40; Pz.px(x, y, u < 0.6 ? mix(0x8ad0f8, 0xb8e4fc, u / 0.6) : mix(0x2a6a9a, 0x1e4a70, (u - 0.6) / 0.4)); } Pz.vl(wx + 29, 10, 40, 0x3a3a42); Pz.hl(wx, 30, 60, 0x3a3a42); for (let k = 0; k < 3; k++) { const bx = wx + 6 + k * 18; Pz.rect(bx, 34, 10, 3, [0xd8343c, 0xf4f1ea, 0x3a7bd5][k]); Pz.vl(bx + 5, 26, 8, 0x3a3a42); } }   // fönster med båtar
    for (const lx of [120, 192, 264]) { Pz.vl(lx, 0, 10, 0x3a3a42); for (let j = 0; j < 7; j++) Pz.hl(lx - 3 - j, 10 + j, 7 + j * 2, j < 2 ? 0x8a8a94 : 0x5a5a66); Pz.hl(lx - 10, 17, 21, 0xfff0a0); }
    Pz.rect(148, 20, 88, 36, 0x2a2a30); Pz.box(148, 20, 88, 36, 0x8a6a40);   // krittavlan (texten ritas levande)
    // disken: kakel på framsidan, stålkant, islådorna ritas levande; vågen; golvet bakom disken
    for (let y = 128; y < 170; y++) for (let x = 0; x < FW; x++) Pz.px(x, y, mix(0xd8dce0, 0xb8c0c8, hash(x >> 2, y >> 2, 4) * 0.5 + ((y - 128) % 8 === 7 ? 0.5 : 0)));
    Pz.rect(0, 126, FW, 3, 0x8a8a94); Pz.hl(0, 126, FW, 0xc8c8d0);
    for (let y = 170; y < FH; y++) Pz.hl(0, y, FW, mix(0x6a7480, 0x4a5460, (y - 170) / 46));
    Pz.rect(0, 170, FW, 4, 0x3a3a42); Pz.hl(0, 170, FW, 0x8a8a94);
    for (let i = 0; i < 6; i++) { const L = LADA(i); Pz.rect(L.x, L.y, L.w, L.h, 0x8a8a94); Pz.rect(L.x + 1, L.y + 1, L.w - 2, L.h - 2, 0xd8e8f4); for (let k = 0; k < 40; k++) Pz.px(L.x + 2 + ((hash(k, i, 5) * (L.w - 4)) | 0), L.y + 2 + ((hash(k, i + 9, 5) * (L.h - 4)) | 0), 0xffffff); }   // islådorna
    // vågen: fot, tavla och skål
    Pz.rect(VAG.x - 12, VAG.y + 4, 24, 6, 0x3a3a42); Pz.rect(VAG.x - 3, VAG.y - 2, 6, 8, 0x5a5a66);
    for (let a = 0; a <= 64; a++) { const an = Math.PI + a / 64 * Math.PI; for (let rr = VAG.r - 2; rr <= VAG.r; rr++) Pz.px(Math.round(VAG.x + Math.cos(an) * rr), Math.round(VAG.y + Math.sin(an) * rr), rr === VAG.r ? 0x3a3a42 : 0xf4f1ea); }
    for (let y = VAG.y - VAG.r; y <= VAG.y; y++) for (let x = VAG.x - VAG.r; x <= VAG.x + VAG.r; x++) if (Math.hypot(x - VAG.x, y - VAG.y) < VAG.r - 2) Pz.px(x, y, 0xf8f6ee);
    Pz.rect(VAG.x - VAG.r - 2, VAG.y, VAG.r * 2 + 4, 3, 0x3a3a42);
    for (let k = 0; k <= 5; k++) { const an = Math.PI + k / 5 * Math.PI; Pz.px(Math.round(VAG.x + Math.cos(an) * (VAG.r - 5)), Math.round(VAG.y + Math.sin(an) * (VAG.r - 5)), 0x1a1a1a); Pz.px(Math.round(VAG.x + Math.cos(an) * (VAG.r - 6)), Math.round(VAG.y + Math.sin(an) * (VAG.r - 6)), 0x1a1a1a); }
    Pz.rect(VAG.x - 16, VAG.y + 4, 32, 4, 0x8a8a94); Pz.hl(VAG.x - 18, VAG.y + 3, 36, 0xc8c8d0);   // skålen
    BG = Pz.flush(); return BG;
  }
  function drawKund(ctx, i) {
    const K = kunder[i]; if (!K) return;
    const Pp = PLATS(i), dy = K.st === 'in' ? Math.round((1 - K.k) * 40) : K.st === 'ut' ? Math.round((1 - K.k) * 40) : 0;
    const frame = K.st === 'nojd' ? 10 : K.st === 'arg' ? 4 : K.st === 'vantar' && Math.sin(t * 2 + i) > 0.9 ? 4 : 0;
    drawPerson(ctx, Pp.x, Pp.y - dy, K.look, 'down', frame);
    if (K.st !== 'vantar') return;
    // bubblan: fisken + hekto, tålamodet under
    const f = FISKAR.find((q) => q.id === K.fisk), s = `${K.hg} hg`, w = 18 + textW(SMALL, s) + 8, x = Pp.x - (w >> 1), y = Pp.y - 62;
    ctx.fillStyle = '#f4f1ea'; ctx.fillRect(x, y, w, 16); ctx.fillStyle = '#1c1a20'; ctx.fillRect(x - 1, y + 1, 1, 14); ctx.fillRect(x + w, y + 1, 1, 14); ctx.fillRect(x + 1, y - 1, w - 2, 1); ctx.fillRect(x + 1, y + 16, w - 2, 1);
    ctx.fillStyle = '#f4f1ea'; ctx.fillRect(x + (w >> 1) - 2, y + 16, 4, 2); ctx.fillRect(x + (w >> 1) - 1, y + 18, 2, 2);
    ikon(ctx, f, x + 3, y + 2, 2); ctxText(ctx, SMALL, s, x + 20, y + 5, '#1c1a20');
    const k = Math.max(0, K.t / K.dur);
    ctx.fillStyle = '#2a2430'; ctx.fillRect(x, y + 20, w, 3); ctx.fillStyle = k > 0.5 ? '#46a35a' : k > 0.25 ? '#f0c030' : '#e04848'; ctx.fillRect(x, y + 20, Math.round(w * k), 3);
    if (vag && vag.i === i) { ctx.fillStyle = '#ffd23f'; ctx.fillRect(Pp.x - 10, Pp.y - 72, 20, 2); }
  }
  function drawVag(ctx) {
    if (vag) {
      // det gröna fältet runt målet, det gula runt om, visaren
      const band = (a0, a1, c) => { ctx.strokeStyle = c; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(VAG.x, VAG.y, VAG.r - 8, Math.PI + a0 * Math.PI, Math.PI + a1 * Math.PI); ctx.stroke(); };
      band(Math.max(0, vag.mal - TOL_OK), Math.min(1, vag.mal + TOL_OK), '#f0c030');
      band(Math.max(0, vag.mal - TOL_GRON), Math.min(1, vag.mal + TOL_GRON), '#46a35a');
      const an = Math.PI + vag.pos * Math.PI;
      ctx.strokeStyle = '#d8343c'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(VAG.x, VAG.y); ctx.lineTo(VAG.x + Math.cos(an) * (VAG.r - 4), VAG.y + Math.sin(an) * (VAG.r - 4)); ctx.stroke();
      const K = kunder[vag.i]; if (K) { const f = FISKAR.find((q) => q.id === K.fisk); ikon(ctx, f, VAG.x - 7, VAG.y - 4, 2); }
      const s = $t('STOPPA VISAREN I DET GRÖNA'); ctx.fillStyle = 'rgba(20,18,26,.8)'; ctx.fillRect(192 - (textW(SMALL, s) >> 1) - 4, 114, textW(SMALL, s) + 8, 11); ctxText(ctx, SMALL, s, 192 - (textW(SMALL, s) >> 1), 117, '#ffd23f');
    }
    ctx.fillStyle = '#1a1a1a'; ctx.fillRect(VAG.x - 1, VAG.y - 1, 3, 3);
  }
  function drawLador(ctx) {
    FISKAR.forEach((f, i) => {
      const L = LADA(i), het = hall === f.id;
      if (het) { ctx.fillStyle = '#ffd23f'; ctx.fillRect(L.x - 2, L.y - 2, L.w + 4, L.h + 4); ctx.fillStyle = '#d8e8f4'; ctx.fillRect(L.x, L.y, L.w, L.h); }
      for (let k = 0; k < 3; k++) ikon(ctx, f, L.x + 4 + k * 17, L.y + 2, 2);
      ctx.fillStyle = 'rgba(20,18,26,.75)'; ctx.fillRect(L.x, L.y + L.h - 8, L.w, 8);
      ctxText(ctx, SMALL, f.namn, L.x + 3, L.y + L.h - 6, het ? '#ffd23f' : '#f4f1ea');
      ctxText(ctx, SMALL, String(i + 1), L.x + L.w - 7, L.y + L.h - 6, '#8a8a92');
    });
    if (streak >= 2) { const s = $t`${streak} PÅ GRAMMET I RAD`; ctxText(ctx, SMALL, s, FW - textW(SMALL, s) - 8, 150, '#ffd23f'); }
    const rub = $t('DAGENS FÅNGST'); ctxText(ctx, SMALL, rub, 192 - (textW(SMALL, rub) >> 1), 24, '#f4f1ea');
    ctxText(ctx, SMALL, $t('TORSK 89 · LAX 149'), 154, 36, '#ffd23f'); ctxText(ctx, SMALL, $t('SILL 39 · RÄKOR 119'), 154, 46, '#ffd23f');
  }
  function drawBritta(ctx) {
    const look = A.avatar?.look || makeLook();
    drawPerson(ctx, BRITTA.x, 166, { ...look, apron: true }, 'up', hall ? 7 : 0);
    if (hall) { const f = FISKAR.find((q) => q.id === hall); ikon(ctx, f, BRITTA.x - 6, 142, 2); }
  }

  return {
    get worldX() { return BRITTA.x; }, get worldY() { return 166; },
    update,
    down(x, y) {
      if (done) return;
      if (vag) { if (Math.hypot(x - VAG.x, y - VAG.y) < VAG.r + 14 || y < 170) { stoppa(); return; } }
      for (let i = 0; i < FISKAR.length; i++) { const L = LADA(i); if (x >= L.x && x <= L.x + L.w && y >= L.y - 2 && y <= L.y + L.h + 2) { valj(FISKAR[i].id); return; } }
      for (let i = 0; i < kunder.length; i++) { const Pp = PLATS(i); if (kunder[i] && Math.abs(x - Pp.x) < 26 && y > Pp.y - 70 && y < Pp.y + 8) { servera(i); return; } }
    },
    key(k) {
      if (k === 'Escape' && !done) { abortShift(A); return; }
      if (k === ' ' || k === 'Enter') { stoppa(); return; }
      const i = ['1', '2', '3', '4', '5', '6'].indexOf(k); if (i >= 0) valj(FISKAR[i].id);
    },
    draw(ctx) {
      ctx.setTransform(A.pxs, 0, 0, A.pxs, 0, 0);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(paintBg(), 0, 0);
      for (let i = 0; i < kunder.length; i++) drawKund(ctx, i);
      drawVag(ctx);
      drawBritta(ctx);
      drawLador(ctx);
      pops.draw(ctx);
      drawShiftHud(ctx, A, { t, dur: DUR, ok: stats.ok, fel: stats.fel + stats.miss, title: $t('FISKMARKNADEN') });
      if (done) { ctx.fillStyle = 'rgba(20,60,120,.5)'; ctx.fillRect(0, 0, FW, Math.min(FH, doneT * 300)); drawTimeUp(ctx, A); }
    },
    _debug: {
      stats,
      state: () => ({ t: +t.toFixed(2), done, stats: { ...stats }, streak, hall, vag: vag ? { i: vag.i, mal: +vag.mal.toFixed(2), pos: +vag.pos.toFixed(2) } : null, kunder: kunder.map((K) => (K ? { fisk: K.fisk, hg: K.hg, st: K.st, t: +K.t.toFixed(1) } : null)) }),
      force: (fisk, hg) => { const i = nyKund(fisk, hg); if (i >= 0) { kunder[i].st = 'vantar'; kunder[i].k = 1; } return i; },
      auto: (on) => { auto = !!on; },
      valj: (id) => { valj(id); return hall; },
      servera: (i) => { servera(i); return vag ? { ...vag } : null; },
      stoppa: (exakt) => { if (!vag) return null; vag.pos = exakt === true ? vag.mal : exakt === 'nara' ? Math.min(1, vag.mal + TOL_OK * 0.7) : (vag.mal > 0.5 ? 0 : 1); return stoppa(); },
      ladaSpot: (i) => { const L = LADA(i); return { x: L.x + (L.w >> 1), y: L.y + (L.h >> 1) }; },
      kundSpot: (i) => { const Pp = PLATS(i); return { x: Pp.x, y: Pp.y - 20 }; },
      vagSpot: () => ({ x: VAG.x, y: VAG.y - 10 }),
      tick: (sec) => { for (let k = 0; k < sec * 30; k++) update(1 / 30); },
      finish: () => { t = DUR - 0.01; update(0.02); for (let k = 0; k < 60; k++) update(0.05); },
      time: () => t,
    },
  };
}
