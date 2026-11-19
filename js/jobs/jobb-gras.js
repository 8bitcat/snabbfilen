// 🌿 GRÄSKLIPPNING I VILLAOMRÅDET – sommarjobbet hos Vivi på Äppelvägen 5 (Carl 2026-11-18: "jobb/minispel klippa gräs").
// Ett minispel sett uppifrån: en gräsmatta i rutor om 8 px, gräsklipparen klipper där den kör (ljusa ränder), och
// man styr med klick (klipparen kör rakt dit) eller pilarna/WASD (kör åt det hållet tills kanten). Trädgårdstomtar,
// rabatter, träd och stenar står i vägen – kör man på dem välter tomten, klipparen stannar och det blir ett avdrag.
// Var fjärdedel av mattan ger lön, hela mattan KLIPPT ger nästa trädgård (nya hinder, nytt hus), tre trädgårdar utan
// en skråma = TRÄDGÅRDSMÄSTARE (bonus). Vivi står på verandan och hejar. Passets längd från planOf (shift.js).
import { drawPerson } from '../core/people.js';
import { Pix, SMALL, BIG, ctxText, textW, hash, mix, mul } from '../core/floor-pix.js';
import { planOf, drawShiftHud, drawTimeUp, makePops, abortShift } from './shift.js';
import { play } from '../core/sound.js';
import { $t } from '../core/i18n.js';

const FW = 384, FH = 216;
export const LAWN = { x0: 80, y0: 48, x1: 304, y1: 160, cell: 8 };
const COLS = (LAWN.x1 - LAWN.x0) / LAWN.cell, ROWS = (LAWN.y1 - LAWN.y0) / LAWN.cell;
const FART = 72, SVEP = 9;
// trädgårdarna: husets färg, hindren (i gräsmattans px, från LAWN.x0/y0)
const TRADGARDAR = [
  { hus: 0xf4f1ea, tak: 0x8a3a2a, hinder: [{ t: 'tomte', x: 40, y: 30 }, { t: 'rabatt', x: 120, y: 20, w: 40, h: 18 }, { t: 'trad', x: 180, y: 70 }, { t: 'sten', x: 60, y: 88 }] },
  { hus: 0xf0c030, tak: 0x3a3a42, hinder: [{ t: 'tomte', x: 170, y: 24 }, { t: 'tomte', x: 60, y: 76 }, { t: 'rabatt', x: 20, y: 24, w: 36, h: 16 }, { t: 'spridare', x: 120, y: 60 }, { t: 'sten', x: 190, y: 90 }] },
  { hus: 0x8ab4d8, tak: 0x5a3a20, hinder: [{ t: 'trad', x: 40, y: 40 }, { t: 'rabatt', x: 90, y: 80, w: 50, h: 18 }, { t: 'tomte', x: 150, y: 30 }, { t: 'tomte', x: 196, y: 60 }, { t: 'sten', x: 110, y: 20 }] },
  { hus: 0xe0a0b0, tak: 0x4a4a52, hinder: [{ t: 'rabatt', x: 30, y: 60, w: 30, h: 30 }, { t: 'trad', x: 120, y: 30 }, { t: 'tomte', x: 100, y: 90 }, { t: 'spridare', x: 190, y: 40 }, { t: 'sten', x: 170, y: 92 }] },
];
const RUTA = (h) => h.t === 'tomte' ? [h.x - 4, h.y - 10, h.x + 4, h.y + 1] : h.t === 'trad' ? [h.x - 6, h.y - 6, h.x + 6, h.y + 3] : h.t === 'sten' ? [h.x - 7, h.y - 4, h.x + 7, h.y + 3] : h.t === 'spridare' ? [h.x - 3, h.y - 3, h.x + 3, h.y + 2] : [h.x, h.y, h.x + h.w, h.y + h.h];
const VIVI_SAY = [$t('Fint! Glöm inte hörnen!'), $t('Akta tomten Gösta – han är ömtålig.'), $t('Raka ränder, så som pappa klippte.'), $t('Lemonad på verandan när du är klar!')];

export function makeJobbGras(A, { onDone } = {}) {
  const g = A.game, P = planOf(A), DUR = P.seconds;
  const stats = { ok: 0, fel: 0, miss: 0, boxes: 0 };
  const pops = makePops();
  let t = 0, done = false, doneT = 0, reported = false;
  const wage = 14;
  let seed = ((g?.day || 1) * 7919 + 31337) % 233280;
  const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
  const VIVI = { x: 44, y: 44, look: { skin: '#f1c7a3', hair: '#d8a040', style: 'bun', top: 'tee', shirt: '#46a35a', bottom: 'skirt', pants: '#f4f1ea', hat: 'straw', glasses: false, kid: false } };
  let lawnNr = 0, cells = null, klippta = 0, total = 0, kvart = 0, ren = true, rena = 0, hinder = [], saying = null, sayT = 0, nextSay = 4, klipp = [], hitT = 0, bytT = 0;
  let BG = null;   // bakgrunden målas om för varje trädgård (nyTradgard nollar den)
  const mower = { x: LAWN.x0 + 12, y: LAWN.y1 - 12, dir: 'right', mal: null, kor: null, rull: 0 };
  function nyTradgard() {
    const T = TRADGARDAR[lawnNr % TRADGARDAR.length];
    hinder = T.hinder.map((h) => ({ ...h, x: h.x + LAWN.x0, y: h.y + LAWN.y0, valt: false }));
    cells = new Uint8Array(COLS * ROWS); klippta = 0; total = 0; kvart = 0; ren = true; BG = null;
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      const cx = LAWN.x0 + c * 8 + 4, cy = LAWN.y0 + r * 8 + 4;
      const block = hinder.some((h) => { const R = RUTA(h); return cx > R[0] - 2 && cx < R[2] + 2 && cy > R[1] - 2 && cy < R[3] + 2; });
      cells[r * COLS + c] = block ? 2 : 0; if (!block) total++;
    }
    mower.x = LAWN.x0 + 12; mower.y = LAWN.y1 - 12; mower.dir = 'right'; mower.mal = null; mower.kor = null;
  }
  nyTradgard();
  const procent = () => (total ? klippta / total : 0);
  function blockerad(x, y) {
    if (x < LAWN.x0 + 6 || x > LAWN.x1 - 6 || y < LAWN.y0 + 6 || y > LAWN.y1 - 4) return 'kant';
    for (const h of hinder) { const R = RUTA(h); if (x + 7 > R[0] && x - 7 < R[2] && y + 5 > R[1] && y - 5 < R[3]) return h; }
    return null;
  }
  function smell(h) {
    if (hitT > 0) return;
    hitT = 1; stats.fel++; ren = false; mower.mal = null; mower.kor = null;
    if (h.t === 'tomte') { h.valt = true; pops.add(mower.x, mower.y - 20, $t('OJ! TOMTEN!'), '#ff6a6a'); }
    else if (h.t === 'rabatt') pops.add(mower.x, mower.y - 20, $t('INTE RABATTEN!'), '#ff6a6a');
    else pops.add(mower.x, mower.y - 20, $t('KLONK!'), '#ff6a6a');
    play('miss');
  }
  function klippHar() {
    const c0 = Math.floor((mower.x - SVEP - LAWN.x0) / 8), c1 = Math.floor((mower.x + SVEP - LAWN.x0) / 8), r0 = Math.floor((mower.y - 8 - LAWN.y0) / 8), r1 = Math.floor((mower.y + 8 - LAWN.y0) / 8);
    for (let r = Math.max(0, r0); r <= Math.min(ROWS - 1, r1); r++) for (let c = Math.max(0, c0); c <= Math.min(COLS - 1, c1); c++) {
      const i = r * COLS + c; if (cells[i] !== 0) continue;
      const cx = LAWN.x0 + c * 8 + 4, cy = LAWN.y0 + r * 8 + 4;
      // (två rutor på höjden – klipparen är 16 px bred)
      if (Math.abs(cx - mower.x) <= SVEP && Math.abs(cy - mower.y) <= 8) { cells[i] = 1; klippta++; if (rnd() < 0.5) klipp.push({ x: cx + (rnd() - 0.5) * 6, y: cy + (rnd() - 0.5) * 6, t: 0, vx: (rnd() - 0.5) * 30, vy: -20 - rnd() * 20 }); }
    }
    const p = procent();
    while (kvart < 3 && p >= (kvart + 1) * 0.25) { kvart++; stats.ok++; pops.add(mower.x, mower.y - 22, `+${wage} kr`, '#ffd23f'); play('ok'); }
    if (p >= 0.97 && kvart === 3) { kvart = 4; stats.ok++; klar(); }
  }
  function klar() {
    pops.add(FW / 2, 100, $t('KLIPPT!'), '#8ae08a'); play('fanfare');
    if (ren) { rena++; if (rena % 3 === 0) { stats.boxes++; pops.add(FW / 2, 84, $t('TRÄDGÅRDSMÄSTARE!'), '#ff8ac8'); } } else rena = 0;
    bytT = 1.4; mower.mal = null; mower.kor = null;
  }
  function styr(dir) { if (done || bytT > 0) return; mower.kor = dir; mower.mal = null; mower.dir = dir; }
  function dit(x, y) { if (done || bytT > 0) return; mower.mal = { x: Math.max(LAWN.x0 + 6, Math.min(LAWN.x1 - 6, x)), y: Math.max(LAWN.y0 + 6, Math.min(LAWN.y1 - 4, y)) }; mower.kor = null; }
  function update(dt) {
    pops.update(dt);
    for (const k of klipp) { k.t += dt; k.x += k.vx * dt; k.y += k.vy * dt; k.vy += 80 * dt; }
    while (klipp.length && klipp[0].t > 0.7) klipp.shift();
    if (klipp.length > 80) klipp.splice(0, klipp.length - 80);
    if (hitT > 0) hitT -= dt;
    if (sayT > 0) { sayT -= dt; if (sayT <= 0) saying = null; }
    if (done) { doneT += dt; if (doneT > 1.2 && !reported) { reported = true; onDone?.({ ...stats }); } return; }
    t += dt;
    if (t >= DUR) { done = true; play('fanfare'); return; }
    if ((nextSay -= dt) <= 0) { saying = VIVI_SAY[(rnd() * VIVI_SAY.length) | 0]; sayT = 3.2; nextSay = 9 + rnd() * 8; }
    if (bytT > 0) { bytT -= dt; if (bytT <= 0) { lawnNr++; nyTradgard(); play('click'); } return; }
    if (hitT > 0) return;
    let vx = 0, vy = 0;
    if (mower.mal) { const dx = mower.mal.x - mower.x, dy = mower.mal.y - mower.y, d = Math.hypot(dx, dy); if (d < 2) { mower.mal = null; } else { vx = dx / d; vy = dy / d; mower.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'); } }
    else if (mower.kor) { vx = mower.kor === 'right' ? 1 : mower.kor === 'left' ? -1 : 0; vy = mower.kor === 'down' ? 1 : mower.kor === 'up' ? -1 : 0; }
    if (!vx && !vy) return;
    const nx = mower.x + vx * FART * dt, ny = mower.y + vy * FART * dt;
    const b = blockerad(nx, ny);
    if (b === 'kant') { mower.kor = null; mower.mal = null; return; }
    if (b) { smell(b); return; }
    mower.x = nx; mower.y = ny; mower.rull += dt * 10;
    klippHar();
  }

  // ---------- bilden ----------
  function paintBg() {
    if (BG) return BG;
    const T = TRADGARDAR[lawnNr % TRADGARDAR.length], Pz = new Pix(FW, FH);
    // huset överst: panel, fönster, dörr, verandan med räcke
    for (let y = 0; y < 40; y++) for (let x = 0; x < FW; x++) Pz.px(x, y, mix(T.hus, mul(T.hus, 0.85), ((y % 6) === 5 ? 1 : 0) * 0.5 + (hash(x >> 3, y >> 3, 3) - 0.5) * 0.08));
    for (let x = 0; x < FW; x++) for (let j = 0; j < 8; j++) Pz.px(x, j, mix(T.tak, mul(T.tak, 0.7), (j % 3 === 2) ? 0.8 : 0));
    for (const wx of [110, 200, 290]) { Pz.rect(wx - 1, 13, 22, 18, 0xf4f1ea); Pz.rect(wx, 14, 20, 16, 0x8ab4d8); Pz.vl(wx + 10, 14, 16, 0xf4f1ea); Pz.hl(wx, 22, 20, 0xf4f1ea); Pz.px(wx + 1, 15, 0xc8e4f8); Pz.rect(wx - 2, 31, 24, 3, 0xd8343c); for (let k = 0; k < 4; k++) Pz.px(wx + 1 + k * 6, 30, [0xf0c030, 0xffffff, 0xe060a0, 0xf0c030][k]); }   // fönster med blomlåda
    Pz.rect(20, 10, 56, 30, mul(T.hus, 0.8)); Pz.rect(40, 16, 14, 24, 0x5a3a20); Pz.px(51, 29, 0xf0c030);   // verandan + dörren
    for (let x = 18; x < 78; x += 4) Pz.rect(x, 34, 2, 6, 0xf4f1ea); Pz.hl(18, 33, 60, 0xf4f1ea);
    Pz.rect(0, 40, FW, 8, 0x8a8a80); Pz.hl(0, 40, FW, 0xa8a8a0); Pz.hl(0, 47, FW, 0x6a6a62);   // sockeln/trappsteget
    // runt gräsmattan: rabatter med blommor till vänster och höger, grusgången nederst, spjälstaketet
    for (let y = 48; y < FH; y++) for (let x = 0; x < FW; x++) { if (x >= LAWN.x0 && x < LAWN.x1 && y < LAWN.y1) continue; Pz.px(x, y, y >= LAWN.y1 ? mix(0xc8b890, 0xb8a880, hash(x, y, 4) * 0.6) : mix(0x4a3a2a, 0x5a4a34, hash(x >> 1, y >> 1, 5) * 0.6)); }
    for (let k = 0; k < 60; k++) { const sx = hash(k, 1, 6) < 0.5 ? 6 + hash(k, 2, 6) * 60 : LAWN.x1 + 14 + hash(k, 2, 6) * 60, sy = 54 + hash(k, 3, 6) * 100; Pz.rect(sx | 0, sy | 0, 2, 2, [0xd8343c, 0xf0c030, 0xe060a0, 0xffffff, 0x3a7bd5][k % 5]); Pz.px(sx | 0, (sy | 0) + 2, 0x3e8a3a); }
    for (const fx of [LAWN.x0 - 8, LAWN.x1 + 6]) for (let y = 50; y < LAWN.y1; y += 7) { Pz.rect(fx, y, 3, 6, 0xf4f1ea); Pz.px(fx + 1, y - 1, 0xffffff); }
    for (const fx of [LAWN.x0 - 8, LAWN.x1 + 6]) { Pz.vl(fx + 1, 50, LAWN.y1 - 50, 0xe8e4dc); }
    // gräsmattan: oklippt – mörkare, tuvor och små blommor
    for (let y = LAWN.y0; y < LAWN.y1; y++) for (let x = LAWN.x0; x < LAWN.x1; x++) { const h = hash(x, y, 7); Pz.px(x, y, mix(0x2e7a2e, 0x3e9a3a, hash(x >> 1, y >> 1, 8) * 0.7 + (h - 0.5) * 0.2)); if (h > 0.96) Pz.px(x, y, 0x58b050); if (h < 0.006) Pz.px(x, y, [0xffffff, 0xf0c030][(x + y) & 1]); }
    // hindren som ligger i marken (rabatt och spridarens cirkel), träd/tomtar/stenar ritas levande
    for (const h of hinder) {
      if (h.t === 'rabatt') { for (let y = h.y; y < h.y + h.h; y++) for (let x = h.x; x < h.x + h.w; x++) Pz.px(x, y, mix(0x4a3020, 0x5a3a28, hash(x, y, 9) * 0.5)); Pz.box(h.x - 1, h.y - 1, h.w + 2, h.h + 2, 0xa8a090); for (let k = 0; k < h.w * h.h / 24; k++) { const fx = h.x + 2 + ((hash(k, 1, 10) * (h.w - 4)) | 0), fy = h.y + 2 + ((hash(k, 2, 10) * (h.h - 4)) | 0); Pz.rect(fx, fy, 2, 2, [0xd8343c, 0xf0c030, 0xe060a0, 0xffffff][k % 4]); Pz.px(fx, fy + 2, 0x3e8a3a); } }
    }
    // HUD-remsan nederst
    for (let y = 176; y < FH; y++) Pz.hl(0, y, FW, 0x17151a);
    BG = Pz.flush(); return BG;
  }
  let SPR = null;
  function sprites() {
    if (SPR) return SPR;
    const mk = (w, h, fn) => { const Pz = new Pix(w, h); fn(Pz); return Pz.flush(); };
    SPR = {
      sida: mk(18, 12, (Pz) => { Pz.rect(2, 3, 13, 6, 0xd8343c); Pz.hl(2, 3, 13, 0xf07a7a); Pz.rect(10, 1, 6, 3, 0x3a3a42); Pz.rect(1, 8, 4, 4, 0x1a1414); Pz.rect(12, 8, 4, 4, 0x1a1414); Pz.px(2, 9, 0x6a6a72); Pz.px(13, 9, 0x6a6a72); Pz.rect(0, 5, 2, 2, 0x8a8a94); }),
      fram: mk(14, 12, (Pz) => { Pz.rect(1, 2, 12, 7, 0xd8343c); Pz.hl(1, 2, 12, 0xf07a7a); Pz.rect(4, 0, 6, 2, 0x3a3a42); Pz.rect(0, 8, 3, 4, 0x1a1414); Pz.rect(11, 8, 3, 4, 0x1a1414); Pz.rect(5, 9, 4, 2, 0x1a1414); }),
      tomte: mk(10, 13, (Pz) => { Pz.rect(3, 0, 4, 5, 0xd8343c); Pz.px(4, 0, 0xf07a7a); Pz.rect(2, 5, 6, 3, 0xf1c7a3); Pz.rect(2, 8, 6, 4, 0x3a7bd5); Pz.rect(1, 7, 8, 2, 0xf4f1ea); Pz.rect(3, 12, 4, 1, 0x1a1414); }),
      tomteValt: mk(14, 8, (Pz) => { Pz.rect(0, 2, 5, 4, 0xd8343c); Pz.rect(5, 1, 3, 6, 0xf1c7a3); Pz.rect(8, 2, 4, 6, 0x3a7bd5); Pz.rect(7, 1, 2, 7, 0xf4f1ea); Pz.rect(12, 3, 1, 4, 0x1a1414); }),
      sten: mk(16, 9, (Pz) => { for (let y = 0; y < 9; y++) { const w = Math.round(8 * Math.sqrt(1 - ((y - 5) / 6) ** 2)); Pz.hl(8 - w, y, w * 2, y < 3 ? 0xa8a8b0 : y < 6 ? 0x8a8a94 : 0x5a5a66); } }),
      trad: mk(30, 34, (Pz) => { Pz.rect(13, 22, 4, 10, 0x5a3a20); Pz.vl(13, 22, 10, 0x8a6a40); for (let y = 0; y < 24; y++) { const w = Math.round(14 * Math.sqrt(1 - ((y - 11) / 12) ** 2)); for (let x = 15 - w; x < 15 + w; x++) Pz.px(x, y, mix(0x2a6e2e, 0x58b050, hash(x, y, 11) * 0.8 + (x < 12 ? 0.15 : 0))); } for (let k = 0; k < 6; k++) Pz.rect(6 + ((hash(k, 1, 12) * 18) | 0), 4 + ((hash(k, 2, 12) * 14) | 0), 2, 2, 0xd8343c); }),
      spridare: mk(8, 7, (Pz) => { Pz.rect(3, 2, 2, 4, 0x3a3a42); Pz.rect(1, 0, 6, 3, 0x8a8a94); Pz.px(3, 0, 0xc8c8d0); Pz.rect(0, 6, 8, 1, 0x2a6e2e); }),
    };
    return SPR;
  }
  function drawLawn(ctx) {
    // klippta rutor: ljusare med ränder efter radens riktning
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      if (cells[r * COLS + c] !== 1) continue;
      ctx.fillStyle = (r & 1) ? '#5cb858' : '#52ac4e'; ctx.fillRect(LAWN.x0 + c * 8, LAWN.y0 + r * 8, 8, 8);
      ctx.fillStyle = (r & 1) ? '#66c460' : '#4aa046'; ctx.fillRect(LAWN.x0 + c * 8, LAWN.y0 + r * 8 + ((c + r) & 1) * 4, 8, 1);
    }
    for (const k of klipp) { ctx.fillStyle = k.t < 0.4 ? '#8ae08a' : '#58b050'; ctx.fillRect(Math.round(k.x), Math.round(k.y), 1, 1); }
  }
  function drawHinder(ctx) {
    const S = sprites();
    const items = hinder.filter((h) => h.t !== 'rabatt').map((h) => ({ fy: h.y, draw: () => {
      if (h.t === 'tomte') { ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(h.x - 4, h.y, 9, 2); if (h.valt) ctx.drawImage(S.tomteValt, h.x - 6, h.y - 6); else ctx.drawImage(S.tomte, h.x - 5, h.y - 12); }
      else if (h.t === 'sten') ctx.drawImage(S.sten, h.x - 8, h.y - 6);
      else if (h.t === 'trad') { ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(h.x - 8, h.y + 1, 17, 2); ctx.drawImage(S.trad, h.x - 15, h.y - 31); }
      else if (h.t === 'spridare') { ctx.drawImage(S.spridare, h.x - 4, h.y - 5); const a = t * 2.4; for (let k = 0; k < 8; k++) { const u = (k / 8 + t * 0.5) % 1, r = 6 + u * 18; ctx.fillStyle = `rgba(200,230,255,${(0.9 - u * 0.8).toFixed(2)})`; ctx.fillRect(Math.round(h.x + Math.cos(a) * r), Math.round(h.y - 3 + Math.sin(a) * r * 0.5 - Math.sin(u * Math.PI) * 6), 1, 1); } }
    } }));
    return items;
  }
  function drawMower(ctx) {
    const S = sprites(), sida = mower.dir === 'left' || mower.dir === 'right';
    const px = mower.dir === 'left' ? mower.x + 10 : mower.dir === 'right' ? mower.x - 10 : mower.x, py = mower.dir === 'up' ? mower.y + 12 : mower.dir === 'down' ? mower.y - 10 : mower.y + 3;
    const rorlig = (mower.mal || mower.kor) && hitT <= 0 && bytT <= 0, frame = rorlig ? [1, 3, 2, 3][Math.floor(t * 7) % 4] : 0;
    const look = A.avatar?.look || VIVI.look;
    if (mower.dir === 'up') { ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(mower.x - 6, mower.y + 1, 13, 2); ctx.drawImage(S.fram, mower.x - 7, mower.y - 8); drawPerson(ctx, px, py, look, 'up', frame); }
    else { drawPerson(ctx, px, py, look, mower.dir, frame); ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(mower.x - 7, mower.y + 1, 15, 2); if (sida) { ctx.save(); if (mower.dir === 'left') { ctx.translate(mower.x + 9, 0); ctx.scale(-1, 1); ctx.drawImage(S.sida, 0, mower.y - 8); } else ctx.drawImage(S.sida, mower.x - 9, mower.y - 8); ctx.restore(); } else ctx.drawImage(S.fram, mower.x - 7, mower.y - 8); }
    if (hitT > 0 && (Math.floor(t * 10) & 1)) { ctxText(ctx, SMALL, '!', mower.x + 10, mower.y - 22, '#ff6a6a'); }
  }
  function drawVivi(ctx) {
    drawPerson(ctx, VIVI.x, VIVI.y, VIVI.look, 'down', saying ? 11 : (Math.sin(t * 1.5) > 0.9 ? 4 : 0));
    if (!saying) return;
    const w = textW(SMALL, saying) + 10, x = Math.min(FW - w - 2, VIVI.x + 14), y = 20;   // bubblan till höger om Vivi, under passets rubrik
    ctx.fillStyle = '#f4f1ea'; ctx.fillRect(x, y, w, 12); ctx.fillStyle = '#1c1a20'; ctx.fillRect(x - 1, y + 1, 1, 10); ctx.fillRect(x + w, y + 1, 1, 10); ctx.fillRect(x + 1, y - 1, w - 2, 1); ctx.fillRect(x + 1, y + 12, w - 2, 1);
    ctx.fillStyle = '#f4f1ea'; ctx.fillRect(x - 2, y + 8, 2, 2); ctx.fillRect(x - 4, y + 10, 2, 2);
    ctxText(ctx, SMALL, saying, x + 5, y + 3, '#1c1a20');
  }
  function drawStrip(ctx) {
    const p = Math.round(procent() * 100), s = $t`TRÄDGÅRD ${lawnNr + 1} · ${p} % KLIPPT`;
    ctxText(ctx, SMALL, s, 8, 182, '#f4f1ea');
    ctx.fillStyle = '#2a2430'; ctx.fillRect(8, 192, 180, 6); ctx.fillStyle = p >= 97 ? '#8ae08a' : '#58b050'; ctx.fillRect(8, 192, Math.round(180 * procent()), 6);
    for (let k = 1; k < 4; k++) { ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.fillRect(8 + 45 * k, 192, 1, 6); }
    const h = $t('KLICKA DÄR DU VILL KLIPPA · PILARNA STYR'); ctxText(ctx, SMALL, h, FW - textW(SMALL, h) - 8, 182, '#8a8a92');
    if (rena > 0) { const r = $t`${rena} UTAN SKRÅMA`; ctxText(ctx, SMALL, r, FW - textW(SMALL, r) - 8, 194, '#ffd23f'); }
    if (bytT > 0) { const n = $t('NÄSTA TRÄDGÅRD …'); ctxText(ctx, BIG, n, (FW - textW(BIG, n)) >> 1, 100, '#ffd23f'); }
  }

  return {
    get worldX() { return mower.x; }, get worldY() { return mower.y; },
    update,
    down(x, y) { if (done) return; if (y >= LAWN.y0 - 8 && y <= LAWN.y1 + 8 && x >= LAWN.x0 - 8 && x <= LAWN.x1 + 8) dit(x, y); },
    key(k) {
      if (k === 'Escape' && !done) { abortShift(A); return; }
      const d = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down', a: 'left', d: 'right', w: 'up', s: 'down', A: 'left', D: 'right', W: 'up', S: 'down' }[k];
      if (d) styr(d);
    },
    draw(ctx) {
      ctx.setTransform(A.pxs, 0, 0, A.pxs, 0, 0);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(paintBg(), 0, 0);
      drawLawn(ctx);
      const items = drawHinder(ctx);
      items.push({ fy: mower.y + 0.5, draw: () => drawMower(ctx) });
      items.sort((a, b) => a.fy - b.fy).forEach((d) => d.draw());
      drawVivi(ctx);
      drawStrip(ctx);
      pops.draw(ctx);
      drawShiftHud(ctx, A, { t, dur: DUR, ok: stats.ok, fel: stats.fel + stats.miss, title: $t('GRÄSKLIPPNING') });
      if (done) { ctx.fillStyle = 'rgba(30,80,30,.5)'; ctx.fillRect(0, 0, FW, Math.min(FH, doneT * 300)); drawTimeUp(ctx, A); }
    },
    _debug: {
      stats,
      state: () => ({ t: +t.toFixed(2), done, stats: { ...stats }, lawn: lawnNr, procent: +procent().toFixed(3), kvart, ren, rena, mower: { x: Math.round(mower.x), y: Math.round(mower.y), dir: mower.dir, mal: mower.mal, kor: mower.kor }, hinder: hinder.map((h) => ({ t: h.t, x: h.x, y: h.y, valt: h.valt })) }),
      dit: (x, y) => dit(x, y),
      styr: (d) => styr(d),
      flytta: (x, y) => { mower.x = x; mower.y = y; mower.mal = null; mower.kor = null; },
      klipp: (andel) => { for (let i = 0; i < cells.length && procent() < andel; i++) if (cells[i] === 0) { cells[i] = 1; klippta++; } const p = procent(); while (kvart < 3 && p >= (kvart + 1) * 0.25) { kvart++; stats.ok++; } if (p >= 0.97 && kvart === 3) { kvart = 4; stats.ok++; klar(); } return procent(); },
      tick: (sec) => { for (let k = 0; k < sec * 30; k++) update(1 / 30); },
      finish: () => { t = DUR - 0.01; update(0.02); for (let k = 0; k < 60; k++) update(0.05); },
      time: () => t,
    },
  };
}
