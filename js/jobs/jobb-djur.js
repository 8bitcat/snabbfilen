// 🦁 FODERKÖKET – djurskötarjobbet i Djurparken (Carl 2026-11-18: "djurskötarjobb med matning"). Man står vid
// foderdisken i personalhusets kök. I väggen finns fem LUCKOR ut mot hagarna – djuren kommer till luckorna och visar
// vad de vill ha (en bubbla med maten). Välj rätt mat i lådorna på disken (klick eller 1–6) och klicka på luckan:
// rätt mat = djuret mumsar och lönen tickar, fel mat = djuret skakar på huvudet (avdrag), för sent = djuret går
// hungrigt (missad). Åtta rätt i rad = MATRUNDA UTAN MISS (bonus). Takten följer vanan (planOf → P.pace).
// Lejonet vill ha KÖTT, elefanten HÖ, giraffen LÖV, apan BANANER, pingvinen FISK och björnen BLÅBÄR.
import { drawPerson } from '../core/people.js';
import { Pix, SMALL, BIG, ctxText, textW, hash, mix, mul } from '../core/floor-pix.js';
import { planOf, drawShiftHud, drawTimeUp, makePops, abortShift } from './shift.js';
import { ritaDjur } from '../djurparken/djur.js';
import { play } from '../core/sound.js';
import { $t } from '../core/i18n.js';

const FW = 384, FH = 216;
// maten: id, namn, djuret som vill ha den, ikonen 7×7 (bokstav → färg), lådans färg
const MAT = [
  { id: 'kott', namn: $t('KÖTT'), djur: 'lejon', pal: { k: 0xd8343c, l: 0xf07a7a, b: 0xf4f1ea }, ikon: ['..kkk..', '.kkkkk.', 'kklkkkk', 'kkkkkkb', '.kkkkbb', '..kkbb.', '....b..'], farg: 0xa84a3a },
  { id: 'ho', namn: $t('HÖ'), djur: 'elefant', pal: { k: 0xe0b838, l: 0xf8e080, m: 0xa88020 }, ikon: ['.......', 'kkkkkkk', 'klkmkkk', 'kkkkklk', 'kmkkkkk', 'kkklkmk', 'kkkkkkk'], farg: 0xc8a040 },
  { id: 'lov', namn: $t('LÖV'), djur: 'giraff', pal: { k: 0x3e8a34, l: 0x6ab84a, s: 0x6a4a2a }, ikon: ['......k', '...kkkl', '..kklk.', '.klkk..', 'kkks...', '.ks....', 'ss.....'], farg: 0x3e7e2a },
  { id: 'banan', namn: $t('BANANER'), djur: 'apa', pal: { k: 0xf0c030, l: 0xf8e080, s: 0x6a4a2a }, ikon: ['s......', 'kk.....', '.kkk...', '..kkkk.', '...lkkk', '.....kk', '......k'], farg: 0xd8a830 },
  { id: 'fisk', namn: $t('FISK'), djur: 'pingvin', pal: { k: 0x3a7bd5, l: 0x8ab4e8, v: 0xf4f1ea }, ikon: ['.......', 'k..kkk.', 'kk.kkkk', 'kkkkvkk', 'kk.kkkk', 'k..kkk.', '.......'], farg: 0x2a5aa8 },
  { id: 'bar', namn: $t('BLÅBÄR'), djur: 'bjorn', pal: { k: 0x3a3a8a, l: 0x7a7ad8, g: 0x3e8a34 }, ikon: ['...g...', '..g.g..', '.kk.kk.', 'klk.klk', '.kkkkk.', '.klkkk.', '..kkk..'], farg: 0x5a4a9a },
];
const LUCKA = (i) => ({ x: 14 + i * 74, y: 34, w: 60, h: 50 });
const LADA = (i) => ({ x: 6 + i * 63, y: 174, w: 58, h: 24 });
// var djuret står i luckan (fötternas y relativt luckans nederkant) så att huvudet syns i fönstret
const FOT = { lejon: -3, elefant: 10, giraff: 32, apa: -3, pingvin: -3, bjorn: 2 };
const MAT_AV = Object.fromEntries(MAT.map((m) => [m.djur, m.id]));

export function makeJobbDjur(A, { onDone } = {}) {
  const g = A.game, P = planOf(A), DUR = P.seconds;
  const stats = { ok: 0, fel: 0, miss: 0, boxes: 0 };
  const pops = makePops();
  let t = 0, done = false, doneT = 0, reported = false;
  let seed = ((g?.day || 1) * 6367 + 31337) % 233280;
  const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
  const wage = 11;
  const luckor = [null, null, null, null, null];   // { art, t, dur, st: 'in' | 'vantar' | 'ater' | 'nej' | 'ut', k (animation) }
  let hall = null, streak = 0, nextT = 1.2, lastArt = null, auto = true;   // auto = djuren kommer av sig själva (provet stänger av)
  const keeper = { x: 192, tx: 192 };
  const patience = () => Math.max(3.5, 6.5 / (P.pace || 1));
  const gap = () => (1.3 + rnd() * 1.0) / (P.pace || 1);
  function nyttDjur(art = null) {
    const lediga = luckor.map((l, i) => (l ? -1 : i)).filter((i) => i >= 0);
    if (!lediga.length) return -1;
    const har = new Set(luckor.filter(Boolean).map((l) => l.art));
    let val = MAT.map((m) => m.djur).filter((a) => !har.has(a));
    if (!val.length) return -1;
    if (!art) { if (val.length > 1 && lastArt) val = val.filter((a) => a !== lastArt); art = val[(rnd() * val.length) | 0]; }
    lastArt = art;
    const i = lediga[(rnd() * lediga.length) | 0];
    luckor[i] = { art, t: patience(), dur: patience(), st: 'in', k: 0 };
    play('click');
    return i;
  }
  function servera(i) {
    if (done) return;
    const L = luckor[i];
    keeper.tx = LUCKA(i).x + 30;
    if (!L || L.st === 'ater' || L.st === 'nej' || L.st === 'ut') return;
    if (!hall) { pops.add(LUCKA(i).x + 30, 100, $t('VÄLJ MAT FÖRST'), '#f4f1ea'); return; }
    if (MAT_AV[L.art] === hall) {
      stats.ok++; streak++; L.st = 'ater'; L.k = 1.3; hall = null;
      pops.add(LUCKA(i).x + 30, 96, `+${wage} kr`, '#ffd23f'); play('ok');
      if (streak % 8 === 0) { stats.boxes++; pops.add(FW / 2, 120, $t('MATRUNDA UTAN MISS!'), '#8ae08a'); play('fanfare'); }
    } else {
      stats.fel++; streak = 0; L.st = 'nej'; L.k = 1.1; play('miss');
      pops.add(LUCKA(i).x + 30, 96, $t('FEL MAT!'), '#ff6a6a');
    }
  }
  function valj(id) { if (done) return; hall = hall === id ? null : id; play('click'); }
  function update(dt) {
    pops.update(dt);
    keeper.x += (keeper.tx - keeper.x) * Math.min(1, dt * 8);
    for (let i = 0; i < luckor.length; i++) {
      const L = luckor[i]; if (!L) continue;
      if (L.st === 'in') { L.k += dt * 2.2; if (L.k >= 1) { L.k = 1; L.st = 'vantar'; } continue; }
      if (L.st === 'ater' || L.st === 'nej') { L.k -= dt; if (L.k <= 0) { L.st = 'ut'; L.k = 1; } continue; }
      if (L.st === 'ut') { L.k -= dt * 2.4; if (L.k <= 0) luckor[i] = null; continue; }
      if (done) continue;
      L.t -= dt;
      if (L.t <= 0) { stats.miss++; streak = 0; L.st = 'ut'; L.k = 1; play('miss'); pops.add(LUCKA(i).x + 30, 96, $t('HUNGRIG …'), '#ff6a6a'); }
    }
    if (done) { doneT += dt; if (doneT > 1.2 && !reported) { reported = true; onDone?.({ ...stats }); } return; }
    t += dt;
    if (t >= DUR) { done = true; play('fanfare'); return; }
    if (auto && (nextT -= dt) <= 0) { nyttDjur(); nextT = gap(); }
  }

  // ---------- bilden ----------
  const css = (c) => '#' + (c & 0xffffff).toString(16).padStart(6, '0');
  const ikon = (ctx, m, x, y, s = 1) => { m.ikon.forEach((r, j) => { for (let i = 0; i < 7; i++) { const c = m.pal[r[i]]; if (c != null) { ctx.fillStyle = css(c); ctx.fillRect(x + i * s, y + j * s, s, s); } } }); };
  let BG = null;
  function paintBg() {
    if (BG) return BG;
    const Pz = new Pix(FW, FH);
    // väggen: liggande plank, en hylla med hinkar och säckar, skylten FODERKÖKET, en lampa
    for (let y = 0; y < 150; y++) for (let x = 0; x < FW; x++) Pz.px(x, y, mix(0x8a6236, 0x6e4a28, ((y / 9) | 0) % 2 ? 0.25 : 0) + 0 && mix(y % 9 === 8 ? 0x4a3020 : 0x8a6236, 0x6e4a28, (hash(x >> 3, y >> 3, 3)) * 0.35));
    for (let y = 0; y < 150; y += 9) Pz.hl(0, y, FW, 0x4a3020, 0.6);
    Pz.rect(0, 148, FW, 4, 0x5a3a20); Pz.hl(0, 148, FW, 0xa87848);
    // luckorna: öppning ut mot hagen (himmel, gräs, staket), karm och uppslagna luckor
    for (let i = 0; i < 5; i++) {
      const L = LUCKA(i);
      for (let y = L.y; y < L.y + L.h; y++) for (let x = L.x; x < L.x + L.w; x++) { const u = (y - L.y) / L.h; Pz.px(x, y, u < 0.55 ? mix(0x8ad0f8, 0xb8e4fc, u / 0.55) : u < 0.62 ? 0x4a8a3a : mix(0x58a842, 0x3e8a32, (u - 0.62) / 0.38 + (hash(x >> 1, y >> 1, 4) - 0.5) * 0.3)); }
      for (let x = L.x + 4; x < L.x + L.w - 4; x += 8) Pz.rect(x, L.y + 22, 2, 8, 0x6e4a28); Pz.hl(L.x, L.y + 24, L.w, 0x8a6236); Pz.hl(L.x, L.y + 28, L.w, 0x8a6236);
      for (let k = 0; k < 3; k++) { const cx = L.x + 10 + k * 20, cy = L.y + 8 + (k % 2) * 4; Pz.rect(cx, cy, 8, 3, 0xffffff, 0.8); Pz.rect(cx + 2, cy - 1, 4, 1, 0xffffff, 0.8); }   // moln
      Pz.box(L.x - 2, L.y - 2, L.w + 4, L.h + 4, 0x4a3020); Pz.box(L.x - 1, L.y - 1, L.w + 2, L.h + 2, 0xa87848);
      for (const [sx, s] of [[L.x - 9, 1], [L.x + L.w + 2, -1]]) { for (let y = L.y - 1; y < L.y + L.h + 1; y++) for (let k = 0; k < 7; k++) Pz.px(sx + k, y, (y - L.y) % 10 === 9 ? 0x4a3020 : k === (s > 0 ? 0 : 6) ? 0x5a3a20 : 0x7a5a32); }   // luckorna uppslagna
      Pz.rect(L.x + L.w / 2 - 4, L.y + L.h + 3, 8, 2, 0x4a3020);   // kroken
    }
    // hyllan med hinkar, fodersäckarna i hörnen (skylten FODERKÖKET sitter på diskens framkant)
    Pz.rect(0, 104, FW, 3, 0xa87848); Pz.hl(0, 104, FW, 0xd29a5c);
    for (let k = 0; k < 9; k++) { const bx = 20 + k * 42, c = [0x6a727c, 0xd8343c, 0x3a7bd5, 0x6a727c, 0xf0c030][k % 5]; Pz.rect(bx, 94, 10, 10, c); Pz.hl(bx, 94, 10, mix(c, 0xffffff, 0.3)); Pz.hl(bx - 1, 93, 12, 0x3a3a42); for (let j = 0; j < 4; j++) Pz.px(bx + 2 + j, 90 + (j === 0 || j === 3 ? 1 : 0), 0x3a3a42); }
    for (const [sx, c, lbl] of [[2, 0xd8c8a0, 0x8a6236], [358, 0xc8a870, 0x3a7bd5]]) {
      for (let j = 0; j < 28; j++) { const w = j < 5 ? 10 + j * 2 : j > 24 ? 20 - (j - 24) : 20; Pz.hl(sx + 12 - (w >> 1), 150 - j, w, mix(c, mul(c, 0.78), hash(sx, j, 5) * 0.4 + (j < 5 ? 0.3 : 0))); }
      Pz.rect(sx + 9, 120, 6, 3, 0x6a4a2a); Pz.rect(sx + 5, 132, 14, 8, lbl); Pz.hl(sx + 7, 135, 10, 0xf4f1ea, 0.7); Pz.hl(sx + 7, 137, 7, 0xf4f1ea, 0.7);   // snöret och etiketten
    }
    // golvet: betong med en brunn, disken i trä med lådorna
    for (let y = 152; y < FH; y++) for (let x = 0; x < FW; x++) Pz.px(x, y, mix(0x8a8a84, 0x76766e, hash(x >> 2, y >> 2, 6) * 0.5));
    for (let a = 0; a < 24; a++) { const an = a / 24 * Math.PI * 2; Pz.px(Math.round(320 + Math.cos(an) * 8), Math.round(162 + Math.sin(an) * 3), 0x4a4a44); } for (let x = 314; x < 327; x += 3) Pz.vl(x, 161, 2, 0x5a5a54);
    Pz.rect(0, 170, FW, 3, 0xd29a5c); Pz.rect(0, 173, FW, 30, 0x8a6236); for (let x = 0; x < FW; x += 14) Pz.vl(x, 173, 30, 0x6e4a28);
    Pz.rect(0, 203, FW, 2, 0x4a3020);
    { const s = $t('FODERKÖKET'), tw = textW(SMALL, s); Pz.rect(FW / 2 - tw / 2 - 5, 205, tw + 10, 9, 0x2e5a2a); Pz.box(FW / 2 - tw / 2 - 5, 205, tw + 10, 9, 0xe6be4c); }
    MAT.forEach((m, i) => { const B = LADA(i); Pz.rect(B.x, B.y, B.w, B.h, 0xa87848); Pz.box(B.x, B.y, B.w, B.h, 0x5a3a20); Pz.hl(B.x + 1, B.y + 1, B.w - 2, 0xd29a5c); Pz.rect(B.x + 3, B.y + 3, B.w - 6, B.h - 6, m.farg); for (let k = 0; k < 10; k++) Pz.px(B.x + 4 + ((hash(k, i, 7) * (B.w - 8)) | 0), B.y + 4 + ((hash(k, i + 9, 7) * (B.h - 8)) | 0), mix(m.farg, 0xffffff, 0.35)); });
    BG = Pz.flush();
    return BG;
  }
  function drawLuckor(ctx) {
    for (let i = 0; i < 5; i++) {
      const L = LUCKA(i), D = luckor[i];
      if (!D) continue;
      ctx.save(); ctx.beginPath(); ctx.rect(L.x, L.y, L.w, L.h); ctx.clip();
      const slide = D.st === 'in' ? (1 - D.k) * 40 : D.st === 'ut' ? (1 - D.k) * 40 : 0;
      const st = D.st === 'ater' ? 'ata' : D.st === 'nej' ? 'idle' : D.art === 'bjorn' ? 'sitt' : 'idle';
      const wob = D.st === 'nej' ? Math.round(Math.sin(D.k * 30) * 2) : 0;
      ritaDjur(ctx, D.art, L.x + L.w / 2 + slide + wob, L.y + L.h + FOT[D.art], { st: D.art === 'lejon' && D.st === 'nej' ? 'ryt' : st, f: Math.floor(t * 4) % 2, dir: 'left', skugga: false });
      ctx.restore();
      if (D.st === 'vantar' || D.st === 'in') {   // bubblan med maten och tålamodet
        const m = MAT.find((q) => q.djur === D.art), bx = L.x + L.w / 2 - 10, by = L.y - 16;
        ctx.fillStyle = '#f4f1ea'; ctx.fillRect(bx, by, 20, 14); ctx.fillStyle = '#1c1a20'; ctx.fillRect(bx, by - 1, 20, 1); ctx.fillRect(bx, by + 14, 20, 1); ctx.fillRect(bx - 1, by, 1, 14); ctx.fillRect(bx + 20, by, 1, 14); ctx.fillStyle = '#f4f1ea'; ctx.fillRect(bx + 8, by + 14, 4, 2); ctx.fillRect(bx + 9, by + 16, 2, 1);
        ikon(ctx, m, bx + 3, by + 3, 2);
        const k = Math.max(0, D.t / D.dur);
        ctx.fillStyle = '#2a2430'; ctx.fillRect(L.x, L.y + L.h + 7, L.w, 3); ctx.fillStyle = k > 0.5 ? '#46a35a' : k > 0.25 ? '#f0c030' : '#e04848'; ctx.fillRect(L.x, L.y + L.h + 7, Math.round(L.w * k), 3);
      }
      if (D.st === 'ater') { ctxText(ctx, SMALL, $t('MUMS'), L.x + L.w / 2 - 10, L.y - 10, '#8ae08a'); }
      if (D.st === 'nej') { ctxText(ctx, SMALL, $t('NEJ!'), L.x + L.w / 2 - 8, L.y - 10, '#ff6a6a'); }
    }
  }
  function drawKeeper(ctx) {
    drawPerson(ctx, keeper.x, 170, A.avatar.look, 'up', Math.abs(keeper.tx - keeper.x) > 1 ? [1, 3, 2, 3][Math.floor(t * 8) % 4] : 0);
    if (hall) { const m = MAT.find((q) => q.id === hall); ctx.fillStyle = '#6a727c'; ctx.fillRect(keeper.x + 7, 156, 9, 8); ctx.fillStyle = '#8e98a2'; ctx.fillRect(keeper.x + 7, 156, 9, 1); ctx.fillStyle = '#3a3a42'; ctx.fillRect(keeper.x + 8, 153, 7, 1); ctx.fillRect(keeper.x + 7, 154, 1, 2); ctx.fillRect(keeper.x + 15, 154, 1, 2); ikon(ctx, m, keeper.x + 8, 154, 1); }
  }
  function drawLador(ctx) {
    MAT.forEach((m, i) => {
      const B = LADA(i), het = hall === m.id;
      if (het) { ctx.fillStyle = 'rgba(255,220,100,.35)'; ctx.fillRect(B.x - 2, B.y - 2, B.w + 4, B.h + 4); ctx.fillStyle = '#ffd23f'; ctx.fillRect(B.x - 2, B.y - 2, B.w + 4, 1); ctx.fillRect(B.x - 2, B.y + B.h + 1, B.w + 4, 1); ctx.fillRect(B.x - 2, B.y - 2, 1, B.h + 4); ctx.fillRect(B.x + B.w + 1, B.y - 2, 1, B.h + 4); }
      ikon(ctx, m, B.x + 5, B.y + 5, 2);
      ctxText(ctx, SMALL, m.namn, B.x + 22, B.y + 4, het ? '#fff0a0' : '#f4f1ea');
      ctxText(ctx, SMALL, String(i + 1), B.x + B.w - 7, B.y + 14, het ? '#fff0a0' : '#e8d8a0');
    });
    if (streak >= 2) { const s = $t`${streak} I RAD`; ctxText(ctx, SMALL, s, FW - textW(SMALL, s) - 8, 124, '#ffd23f'); }
    if (!hall && t < 6) { const s = $t('VÄLJ MAT I LÅDAN – KLICKA SEDAN PÅ LUCKAN'); ctxText(ctx, SMALL, s, (FW - textW(SMALL, s)) >> 1, 112, '#f4f1ea'); }
  }

  return {
    get worldX() { return keeper.x; }, get worldY() { return 170; },
    update,
    down(x, y) {
      if (done) return;
      for (let i = 0; i < MAT.length; i++) { const B = LADA(i); if (x >= B.x - 2 && x <= B.x + B.w + 2 && y >= B.y - 4 && y <= B.y + B.h + 4) { valj(MAT[i].id); return; } }
      for (let i = 0; i < 5; i++) { const L = LUCKA(i); if (x >= L.x - 6 && x <= L.x + L.w + 6 && y >= L.y - 20 && y <= L.y + L.h + 14) { servera(i); return; } }
    },
    key(k) {
      if (k === 'Escape' && !done) { abortShift(A); return; }
      const i = ['1', '2', '3', '4', '5', '6'].indexOf(k); if (i >= 0) valj(MAT[i].id);
    },
    draw(ctx) {
      ctx.setTransform(A.pxs, 0, 0, A.pxs, 0, 0);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(paintBg(), 0, 0);
      const s = $t('FODERKÖKET'); ctxText(ctx, SMALL, s, (FW - textW(SMALL, s)) >> 1, 207, '#f8e080');
      drawLuckor(ctx);
      drawKeeper(ctx);
      drawLador(ctx);
      pops.draw(ctx);
      drawShiftHud(ctx, A, { t, dur: DUR, ok: stats.ok, fel: stats.fel + stats.miss, title: $t('DJURPARKEN') });
      if (done) { ctx.fillStyle = 'rgba(20,60,30,.55)'; ctx.fillRect(0, 0, FW, Math.min(FH, doneT * 300)); drawTimeUp(ctx, A); }
    },
    _debug: {
      stats,
      state: () => ({ t: +t.toFixed(2), done, stats: { ...stats }, streak, hall, luckor: luckor.map((L) => (L ? { art: L.art, st: L.st, t: +L.t.toFixed(2) } : null)) }),
      force: (art) => { const i = nyttDjur(art); if (i >= 0) { luckor[i].st = 'vantar'; luckor[i].k = 1; } return i; },
      auto: (on) => { auto = !!on; return auto; },
      valj: (id) => { valj(id); return hall; },
      servera: (i) => { servera(i); return { ...stats }; },
      ladaSpot: (i) => { const B = LADA(i); return { x: B.x + (B.w >> 1), y: B.y + (B.h >> 1) }; },
      luckSpot: (i) => { const L = LUCKA(i); return { x: L.x + (L.w >> 1), y: L.y + (L.h >> 1) }; },
      tick: (sec) => { for (let k = 0; k < sec * 30; k++) update(1 / 30); },
      finish: () => { t = DUR - 0.01; update(0.02); for (let k = 0; k < 60; k++) update(0.05); },
      time: () => t,
    },
  };
}
