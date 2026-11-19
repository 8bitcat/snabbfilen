// 🍋 LEMONADSTÅNDET – sommarjobbet vid grinden på Äppelvägen 1 i Villaområdet (Carl 2026-11-18: "jobb/minispel …
// lemonadstånd"). Barnen Berg har ställt upp ett bord med en kanna, glas, citroner, socker och is – och grannarna kommer
// i en strid ström. Varje kund visar sitt recept i en bubbla: hur många skedar SOCKER (1–3) och hur många ISBITAR (0–2).
// Man bygger glaset med knapparna (socker +, is +, töm) eller tangenterna 1/2/0 och serverar (klick på kunden eller
// mellanslag). Rätt recept = kunden strålar och lönen tickar; fel = "Blä!" (avdrag); för länge = kunden går till
// grannens stånd (missad). Fem rätt i rad på en solig dag = SOMMARENS LEMONAD (bonus). Takten följer vanan.
import { drawPerson, makeLook } from '../core/people.js';
import { Pix, SMALL, BIG, ctxText, textW, hash, mix, mul } from '../core/floor-pix.js';
import { planOf, drawShiftHud, drawTimeUp, makePops, abortShift } from './shift.js';
import { play } from '../core/sound.js';
import { $t } from '../core/i18n.js';

const FW = 384, FH = 216;
const PLATS = (i) => ({ x: 92 + i * 100, y: 112 });          // kundernas fötter framför bordet
const BORD = { x: 40, y: 128, w: 304, h: 30 };
const KNAPP = { socker: { x: 20, y: 184, w: 100, h: 22 }, is: { x: 142, y: 184, w: 100, h: 22 }, tom: { x: 264, y: 184, w: 100, h: 22 } };
const GLAS = { x: 192, y: 150 };
const MAX_S = 3, MAX_IS = 2;

export function makeJobbLemonad(A, { onDone } = {}) {
  const g = A.game, P = planOf(A), DUR = P.seconds;
  const stats = { ok: 0, fel: 0, miss: 0, boxes: 0 };
  const pops = makePops();
  let t = 0, done = false, doneT = 0, reported = false;
  let seed = ((g?.day || 1) * 5147 + 2024) % 233280;
  const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
  const wage = 11;
  const kunder = [null, null, null];   // { look, socker, is, t, dur, st: in|vantar|glad|sur|ut, k }
  let glas = { socker: 0, is: 0 }, streak = 0, nextT = 1.5, auto = true, skak = 0;
  const BARN = [{ look: { ...makeLook(), kid: true, hat: 'cap', cap: '#f0c030' }, x: 330, y: 160 }];
  const patience = () => Math.max(4, 7.5 / (P.pace || 1));
  const gap = () => (1.5 + rnd() * 1.4) / (P.pace || 1);
  function nyKund(socker = null, is = null) {
    const lediga = kunder.map((k, i) => (k ? -1 : i)).filter((i) => i >= 0);
    if (!lediga.length) return -1;
    const i = lediga[(rnd() * lediga.length) | 0];
    kunder[i] = { look: { ...makeLook(), kid: rnd() < 0.35 }, socker: socker ?? 1 + ((rnd() * MAX_S) | 0), is: is ?? ((rnd() * (MAX_IS + 1)) | 0), t: patience(), dur: patience(), st: 'in', k: 0 };
    play('click');
    return i;
  }
  function lagg(vad) { if (done) return; if (vad === 'socker' && glas.socker < MAX_S) { glas.socker++; play('click'); } else if (vad === 'is' && glas.is < MAX_IS) { glas.is++; play('click'); } else if (vad === 'tom') { glas = { socker: 0, is: 0 }; play('slide'); } skak = 0.3; }
  function servera(i) {
    if (done) return null;
    const K = kunder[i];
    if (!K || K.st !== 'vantar') return null;
    if (K.socker === glas.socker && K.is === glas.is) {
      stats.ok++; streak++; K.st = 'glad'; K.k = 1.3; glas = { socker: 0, is: 0 };
      pops.add(PLATS(i).x, 56, $t('MUMS!'), '#8ae08a'); pops.add(PLATS(i).x, 68, `+${wage} kr`, '#ffd23f'); play('ok');
      if (streak % 5 === 0) { stats.boxes++; pops.add(FW / 2, 36, $t('SOMMARENS LEMONAD!'), '#ffd23f'); play('fanfare'); }
      return 'ok';
    }
    stats.fel++; streak = 0; K.st = 'sur'; K.k = 1.2; glas = { socker: 0, is: 0 }; play('miss');
    pops.add(PLATS(i).x, 56, K.socker > glas.socker ? $t('FÖR SURT!') : $t('BLÄ – FEL!'), '#ff6a6a');
    return 'fel';
  }
  function serveraNasta() { const i = kunder.findIndex((K) => K && K.st === 'vantar'); return i >= 0 ? servera(i) : null; }
  function update(dt) {
    pops.update(dt);
    if (skak > 0) skak -= dt;
    for (let i = 0; i < kunder.length; i++) {
      const K = kunder[i]; if (!K) continue;
      if (K.st === 'in') { K.k += dt * 2; if (K.k >= 1) { K.k = 1; K.st = 'vantar'; } continue; }
      if (K.st === 'glad' || K.st === 'sur') { K.k -= dt; if (K.k <= 0) { K.st = 'ut'; K.k = 1; } continue; }
      if (K.st === 'ut') { K.k -= dt * 2; if (K.k <= 0) kunder[i] = null; continue; }
      if (done) continue;
      K.t -= dt;
      if (K.t <= 0) { stats.miss++; streak = 0; K.st = 'ut'; K.k = 1; play('miss'); pops.add(PLATS(i).x, 56, $t('GICK TILL GRANNENS STÅND …'), '#ff6a6a'); }
    }
    if (done) { doneT += dt; if (doneT > 1.2 && !reported) { reported = true; onDone?.({ ...stats }); } return; }
    t += dt;
    if (t >= DUR) { done = true; play('fanfare'); return; }
    if (auto && (nextT -= dt) <= 0) { nyKund(); nextT = gap(); }
  }

  // ---------- bilden ----------
  const css = (c) => '#' + (c & 0xffffff).toString(16).padStart(6, '0');
  let BG = null;
  function paintBg() {
    if (BG) return BG;
    const Pz = new Pix(FW, FH);
    // himlen, villan bakom med äppelträd, spjälstaketet och grinden, gräsmattan, trottoaren
    for (let y = 0; y < 60; y++) for (let x = 0; x < FW; x++) Pz.px(x, y, mix(0x7ab8e8, 0xd0e8f8, y / 60));
    for (const [cx, cy] of [[60, 14], [250, 20], [340, 10]]) { Pz.rect(cx, cy, 20, 5, 0xffffff); Pz.rect(cx + 4, cy - 2, 12, 2, 0xffffff); }
    for (let y = 28; y < 70; y++) for (let x = 120; x < 270; x++) Pz.px(x, y, mix(0xd8343c, 0xb82a30, ((y % 6) === 5 ? 0.8 : 0) + (hash(x >> 3, y >> 3, 3) - 0.5) * 0.1));   // röda huset
    for (let j = 0; j < 12; j++) Pz.hl(114 + j, 16 + j, 162 - j * 2, j % 3 === 2 ? 0x3a3a42 : 0x5a5a66);
    for (const wx of [136, 220]) { Pz.rect(wx - 1, 38, 22, 18, 0xf4f1ea); Pz.rect(wx, 39, 20, 16, 0x8ab4d8); Pz.vl(wx + 10, 39, 16, 0xf4f1ea); Pz.hl(wx, 47, 20, 0xf4f1ea); }
    Pz.rect(186, 44, 16, 26, 0x5a3a20); Pz.px(199, 58, 0xf0c030);
    for (const tx of [40, 320]) { Pz.rect(tx - 2, 40, 5, 30, 0x6a4a28); for (let y = 0; y < 26; y++) { const w = Math.round(16 * Math.sqrt(Math.max(0, 1 - ((y - 12) / 13) ** 2))); for (let x = tx - w; x <= tx + w; x++) Pz.px(x, 20 + y, mix(0x2e7a2e, 0x58b050, hash(x, y, 4) * 0.8)); } for (let k = 0; k < 6; k++) Pz.rect(tx - 10 + ((hash(k, 1, 5) * 20) | 0), 24 + ((hash(k, 2, 5) * 16) | 0), 2, 2, 0xd8343c); }   // äppelträden
    for (let y = 60; y < 100; y++) for (let x = 0; x < FW; x++) Pz.px(x, y, mix(0x4a8a3a, 0x6aa848, hash(x >> 1, y >> 1, 6) * 0.6));   // gräsmattan
    for (let x = 0; x < FW; x += 8) { Pz.rect(x, 74, 4, 22, 0xf4f1ea); Pz.px(x + 1, 73, 0xffffff); Pz.rect(x, 96, 4, 2, 0xd8d4cc); }   // spjälstaketet
    Pz.hl(0, 80, FW, 0xe8e4dc); Pz.hl(0, 90, FW, 0xe8e4dc);
    Pz.rect(176, 72, 32, 26, 0x4a8a3a); for (let x = 178; x < 208; x += 6) Pz.rect(x, 74, 3, 22, 0xd8d4cc); Pz.hl(176, 84, 32, 0xd8d4cc);   // grinden (öppen)
    for (let y = 100; y < FH; y++) for (let x = 0; x < FW; x++) { const fog = (x % 24 === 23) || ((y - 100) % 24 === 23); Pz.px(x, y, fog ? 0xa8a49c : mix(0xc8c4bc, 0xb8b4ac, hash(x >> 2, y >> 2, 7) * 0.6)); }   // trottoaren
    // bordet med duk, kannan, glasstapel, citroner, skylt
    Pz.rect(BORD.x, BORD.y, BORD.w, BORD.h, 0xf4f1ea); for (let y = BORD.y; y < BORD.y + BORD.h; y += 6) for (let x = BORD.x; x < BORD.x + BORD.w; x += 6) if (((x / 6 + y / 6) | 0) & 1) Pz.rect(x, y, 6, 6, 0xf0c030);
    Pz.rect(BORD.x - 2, BORD.y - 3, BORD.w + 4, 4, 0xa87848); Pz.rect(BORD.x + 4, BORD.y + BORD.h, 4, 14, 0x8a6236); Pz.rect(BORD.x + BORD.w - 8, BORD.y + BORD.h, 4, 14, 0x8a6236);
    Pz.rect(60, BORD.y - 24, 20, 24, 0xf8f0a0, 0.9); Pz.rect(60, BORD.y - 24, 20, 4, 0xf4f1ea); Pz.rect(80, BORD.y - 18, 4, 12, 0xf4f1ea); for (let k = 0; k < 4; k++) Pz.rect(63 + (k % 2) * 8, BORD.y - 20 + (k >> 1) * 8, 4, 4, 0xf0c030);   // kannan med citronskivor
    for (let k = 0; k < 4; k++) { Pz.rect(100 + k * 9, BORD.y - 14, 7, 14, 0xe8f4fc); Pz.hl(100 + k * 9, BORD.y - 14, 7, 0xffffff); }   // glasen
    for (let k = 0; k < 5; k++) { Pz.rect(240 + k * 12, BORD.y - 8, 8, 6, 0xf0c030); Pz.px(243 + k * 12, BORD.y - 9, 0x46a35a); }   // citronerna
    Pz.rect(286, BORD.y - 20, 22, 18, 0xf4f1ea); Pz.rect(288, BORD.y - 18, 18, 14, 0xe0f0f8); for (let k = 0; k < 6; k++) Pz.rect(289 + (k % 3) * 6, BORD.y - 16 + (k / 3 | 0) * 6, 4, 4, 0xc8e8f8);   // isbitarna
    Pz.rect(306, BORD.y - 22, 30, 20, 0xd8c8a0); Pz.rect(308, BORD.y - 20, 26, 16, 0xf4f1ea); Pz.rect(312, BORD.y - 10, 18, 6, 0xf4f1ea);   // sockerpåsen
    const s = $t('LEMONAD 5 KR'); Pz.rect(BORD.x + 100, 100, textW(SMALL, s) + 10, 12, 0xf4f1ea); Pz.box(BORD.x + 100, 100, textW(SMALL, s) + 10, 12, 0xd8343c);
    // HUD-remsan med knapparna nederst
    for (let y = 176; y < FH; y++) Pz.hl(0, y, FW, 0x17151a);
    BG = Pz.flush(); return BG;
  }
  function drawKund(ctx, i) {
    const K = kunder[i]; if (!K) return;
    const Pp = PLATS(i), dy = K.st === 'in' ? Math.round((1 - K.k) * 40) : K.st === 'ut' ? Math.round((1 - K.k) * 40) : 0;
    const frame = K.st === 'glad' ? 10 : K.st === 'sur' ? 4 : 0;
    drawPerson(ctx, Pp.x, Pp.y - dy, K.look, 'down', frame);
    if (K.st !== 'vantar') return;
    const w = 14 + K.socker * 7 + 10 + K.is * 7 + 10, x = Pp.x - (w >> 1), y = Pp.y - 62;
    ctx.fillStyle = '#f4f1ea'; ctx.fillRect(x, y, w, 16); ctx.fillStyle = '#1c1a20'; ctx.fillRect(x - 1, y + 1, 1, 14); ctx.fillRect(x + w, y + 1, 1, 14); ctx.fillRect(x + 1, y - 1, w - 2, 1); ctx.fillRect(x + 1, y + 16, w - 2, 1);
    ctx.fillStyle = '#f4f1ea'; ctx.fillRect(x + (w >> 1) - 2, y + 16, 4, 2); ctx.fillRect(x + (w >> 1) - 1, y + 18, 2, 2);
    for (let k = 0; k < K.socker; k++) { ctx.fillStyle = '#d8c8a0'; ctx.fillRect(x + 4 + k * 7, y + 5, 6, 6); ctx.fillStyle = '#ffffff'; ctx.fillRect(x + 4 + k * 7, y + 5, 5, 5); ctx.fillStyle = '#f0e8d0'; ctx.fillRect(x + 6 + k * 7, y + 7, 2, 2); }   // sockerbitar
    const ix = x + 6 + K.socker * 7 + 8;
    ctxText(ctx, SMALL, '+', ix - 8, y + 5, '#1c1a20');
    if (K.is === 0) ctxText(ctx, SMALL, $t('0 IS'), ix, y + 5, '#1c1a20');
    for (let k = 0; k < K.is; k++) { ctx.fillStyle = '#c8e8f8'; ctx.fillRect(ix + k * 7, y + 5, 5, 5); ctx.fillStyle = '#ffffff'; ctx.fillRect(ix + k * 7, y + 5, 2, 2); }
    const k = Math.max(0, K.t / K.dur);
    ctx.fillStyle = '#2a2430'; ctx.fillRect(x, y + 20, w, 3); ctx.fillStyle = k > 0.5 ? '#46a35a' : k > 0.25 ? '#f0c030' : '#e04848'; ctx.fillRect(x, y + 20, Math.round(w * k), 3);
  }
  function drawGlas(ctx) {
    const { x, y } = GLAS, sk = skak > 0 ? Math.round(Math.sin(t * 40) * 1) : 0;
    ctx.fillStyle = '#e8f4fc'; ctx.fillRect(x - 9 + sk, y - 26, 18, 26); ctx.fillStyle = '#ffffff'; ctx.fillRect(x - 9 + sk, y - 26, 18, 2);
    ctx.fillStyle = '#f8f0a0'; ctx.fillRect(x - 8 + sk, y - 18, 16, 17);
    for (let k = 0; k < glas.socker; k++) { ctx.fillStyle = '#ffffff'; ctx.fillRect(x - 6 + k * 5 + sk, y - 4 - k, 3, 2); }
    for (let k = 0; k < glas.is; k++) { ctx.fillStyle = '#c8e8f8'; ctx.fillRect(x - 5 + k * 7 + sk, y - 16 + (k % 2) * 3, 5, 5); ctx.fillStyle = '#ffffff'; ctx.fillRect(x - 5 + k * 7 + sk, y - 16 + (k % 2) * 3, 2, 2); }
    ctx.fillStyle = '#d8343c'; ctx.fillRect(x + 6 + sk, y - 30, 2, 14);   // sugröret
    const s = $t`SOCKER ${glas.socker} · IS ${glas.is}`; ctx.fillStyle = 'rgba(20,18,26,.8)'; ctx.fillRect(x - (textW(SMALL, s) >> 1) - 4, y + 2, textW(SMALL, s) + 8, 11); ctxText(ctx, SMALL, s, x - (textW(SMALL, s) >> 1), y + 5, '#ffd23f');
  }
  function drawKnappar(ctx) {
    const rita = (B, txt, nr, c) => { ctx.fillStyle = '#2a2436'; ctx.fillRect(B.x, B.y, B.w, B.h); ctx.fillStyle = c; ctx.fillRect(B.x, B.y, B.w, 1); ctx.fillRect(B.x, B.y + B.h - 1, B.w, 1); ctx.fillRect(B.x, B.y, 1, B.h); ctx.fillRect(B.x + B.w - 1, B.y, 1, B.h); ctxText(ctx, BIG, txt, B.x + 10, B.y + 7, '#f4f1ea'); ctxText(ctx, SMALL, nr, B.x + B.w - 8, B.y + 3, '#8a8a92'); };
    rita(KNAPP.socker, $t('+ SOCKER'), '1', '#f0c030'); rita(KNAPP.is, $t('+ IS'), '2', '#8ab4d8'); rita(KNAPP.tom, $t('TÖM'), '0', '#d8343c');
    if (streak >= 2) { const s = $t`${streak} I RAD`; ctxText(ctx, SMALL, s, FW - textW(SMALL, s) - 8, 104, '#ffd23f'); }
    const h = $t('BYGG GLASET · KLICKA PÅ KUNDEN ELLER MELLANSLAG'); ctxText(ctx, SMALL, h, (FW - textW(SMALL, h)) >> 1, 178, '#8a8a92');
  }
  function drawJag(ctx) {
    const look = A.avatar?.look || makeLook();
    drawPerson(ctx, 150, 170, { ...look, apron: true }, 'up', skak > 0 ? 7 : 0);
    drawPerson(ctx, BARN[0].x, BARN[0].y, BARN[0].look, 'up', Math.sin(t * 2) > 0.9 ? 10 : 0);
  }

  return {
    get worldX() { return 150; }, get worldY() { return 170; },
    update,
    down(x, y) {
      if (done) return;
      for (const [id, B] of Object.entries(KNAPP)) if (x >= B.x && x <= B.x + B.w && y >= B.y - 2 && y <= B.y + B.h + 2) { lagg(id); return; }
      for (let i = 0; i < kunder.length; i++) { const Pp = PLATS(i); if (kunder[i] && Math.abs(x - Pp.x) < 30 && y > Pp.y - 70 && y < Pp.y + 8) { servera(i); return; } }
    },
    key(k) {
      if (k === 'Escape' && !done) { abortShift(A); return; }
      if (k === '1') lagg('socker'); else if (k === '2') lagg('is'); else if (k === '0') lagg('tom'); else if (k === ' ' || k === 'Enter') serveraNasta();
    },
    draw(ctx) {
      ctx.setTransform(A.pxs, 0, 0, A.pxs, 0, 0);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(paintBg(), 0, 0);
      for (let i = 0; i < kunder.length; i++) drawKund(ctx, i);
      drawJag(ctx);
      drawGlas(ctx);
      drawKnappar(ctx);
      pops.draw(ctx);
      drawShiftHud(ctx, A, { t, dur: DUR, ok: stats.ok, fel: stats.fel + stats.miss, title: $t('LEMONADSTÅNDET') });
      if (done) { ctx.fillStyle = 'rgba(200,180,40,.45)'; ctx.fillRect(0, 0, FW, Math.min(FH, doneT * 300)); drawTimeUp(ctx, A); }
    },
    _debug: {
      stats,
      state: () => ({ t: +t.toFixed(2), done, stats: { ...stats }, streak, glas: { ...glas }, kunder: kunder.map((K) => (K ? { socker: K.socker, is: K.is, st: K.st, t: +K.t.toFixed(1) } : null)) }),
      force: (socker, is) => { const i = nyKund(socker, is); if (i >= 0) { kunder[i].st = 'vantar'; kunder[i].k = 1; } return i; },
      auto: (on) => { auto = !!on; },
      lagg: (vad) => { lagg(vad); return { ...glas }; },
      servera: (i) => servera(i),
      knapp: (id) => { const B = KNAPP[id]; return { x: B.x + (B.w >> 1), y: B.y + (B.h >> 1) }; },
      kundSpot: (i) => { const Pp = PLATS(i); return { x: Pp.x, y: Pp.y - 20 }; },
      tick: (sec) => { for (let k = 0; k < sec * 30; k++) update(1 / 30); },
      finish: () => { t = DUR - 0.01; update(0.02); for (let k = 0; k < 60; k++) update(0.05); },
      time: () => t,
    },
  };
}
