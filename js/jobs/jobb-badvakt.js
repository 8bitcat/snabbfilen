// 🛟 BADVAKTEN – jobbet i Vattenlandets badvaktstorn (Carl 2026-11-18: "Vattenlandet: … badvakt"). Man sitter i tornet
// med vågpoolen framför sig och ser badgästerna guppa. Då och då får någon kramp och viftar med armarna (HJÄLP!) – klicka
// på den så kastar du livbojen (rätt, lönen tickar). Klickar man på någon som bara simmar blir det FALSKT ALARM (avdrag),
// och väntar man för länge får Bosse hoppa i själv (missad). Barn som springer längs kanten ska visslas åt – klicka på
// dem innan de hunnit runt. När VÅGORNA kommer guppar alla mer och ropen hörs sämre. Sex räddningar i rad = GULDVISSLAN
// (bonus). Takten följer vanan (planOf → P.pace).
import { drawPerson, makeLook } from '../core/people.js';
import { Pix, SMALL, BIG, ctxText, textW, hash, mix } from '../core/floor-pix.js';
import { planOf, drawShiftHud, drawTimeUp, makePops, abortShift } from './shift.js';
import { ritaBadring, ritaPlask } from '../vattenlandet/deko.js';
import { play } from '../core/sound.js';
import { $t } from '../core/i18n.js';

const FW = 384, FH = 216;
const POOL = { x0: 24, y0: 42, x1: 360, y1: 172 };
const TORN = { x: 192, y: 206 };
const N_SIM = 8;
const BADFARGER = [0xe04848, 0x3a7bd5, 0xf0c030, 0x46a35a, 0xe060a0, 0xf07e24];

export function makeJobbBadvakt(A, { onDone } = {}) {
  const g = A.game, P = planOf(A), DUR = P.seconds;
  const stats = { ok: 0, fel: 0, miss: 0, boxes: 0 };
  const pops = makePops();
  let t = 0, done = false, doneT = 0, reported = false;
  let seed = ((g?.day || 1) * 2741 + 9001) % 233280;
  const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
  const wage = 12;
  const simmare = Array.from({ length: N_SIM }, (_, i) => ({ look: { ...makeLook(), kid: i % 3 === 0, hat: null, top: 'tee', shirt: '#' + BADFARGER[i % 6].toString(16).padStart(6, '0'), bottom: 'shorts' }, x: POOL.x0 + 30 + ((i % 4) * 80) + (rnd() - 0.5) * 20, y: POOL.y0 + 30 + Math.floor(i / 4) * 60 + (rnd() - 0.5) * 20, f: i * 1.3, ring: i % 2 ? BADFARGER[(i + 2) % 6] : null, st: 'lugn', t: 0, dur: 0 }));   // st: lugn | nod | raddad | sjunker
  let streak = 0, nextT = 2.5, auto = true, boj = null, vagT = 20, visselT = 0, lopare = null, plask = [];
  const patience = () => Math.max(3.2, 6 / (P.pace || 1));
  const gap = () => (2.2 + rnd() * 2.2) / (P.pace || 1);
  const vagor = () => (vagT % 60) >= 42;
  const vagStyrka = () => { if (!vagor()) return 0; const u = ((vagT % 60) - 42) / 18; return Math.sin(u * Math.PI); };
  function nod(i = -1) {
    const lediga = simmare.map((s, k) => (s.st === 'lugn' ? k : -1)).filter((k) => k >= 0);
    if (!lediga.length) return -1;
    if (i < 0 || simmare[i]?.st !== 'lugn') i = lediga[(rnd() * lediga.length) | 0];
    simmare[i].st = 'nod'; simmare[i].t = patience(); simmare[i].dur = patience();
    return i;
  }
  function spring() { if (lopare) return false; lopare = { x: POOL.x0 - 10, y: POOL.y1 + 10, v: 70 / (P.pace || 1) * 1.1, look: { ...makeLook(), kid: true, hat: null, top: 'tee', bottom: 'shorts' } }; return true; }
  function radda(i) {
    if (done || boj) return null;
    const s = simmare[i]; if (!s) return null;
    if (s.st === 'nod') { boj = { i, t: 0, x0: TORN.x, y0: TORN.y - 30, x1: s.x, y1: s.y }; play('slide'); return 'boj'; }
    if (s.st === 'lugn') { stats.fel++; streak = 0; play('miss'); pops.add(s.x, s.y - 30, $t('FALSKT ALARM!'), '#ff6a6a'); return 'fel'; }
    return null;
  }
  function bojFram() {
    const s = simmare[boj.i]; boj = null;
    if (!s || s.st !== 'nod') return;
    s.st = 'raddad'; s.t = 1.6; stats.ok++; streak++;
    pops.add(s.x, s.y - 30, $t('RÄDDAD!'), '#8ae08a'); pops.add(s.x, s.y - 42, `+${wage} kr`, '#ffd23f'); play('ok');
    plask.push({ x: s.x, y: s.y + 2, t: 0 });
    if (streak % 6 === 0) { stats.boxes++; pops.add(FW / 2, 28, $t('GULDVISSLAN!'), '#ffd23f'); play('fanfare'); }
  }
  function vissla() {
    if (done) return false;
    visselT = 0.6; play('pling');
    if (lopare) { stats.ok++; streak++; pops.add(lopare.x, lopare.y - 30, $t('SPRING INTE!'), '#8ae08a'); pops.add(lopare.x, lopare.y - 42, `+${wage} kr`, '#ffd23f'); lopare = null; if (streak % 6 === 0) { stats.boxes++; pops.add(FW / 2, 28, $t('GULDVISSLAN!'), '#ffd23f'); play('fanfare'); } return true; }
    return false;
  }
  function update(dt) {
    pops.update(dt); vagT += dt;
    if (visselT > 0) visselT -= dt;
    for (const p of plask) p.t += dt; plask = plask.filter((p) => p.t < 0.8);
    const st = vagStyrka();
    for (const s of simmare) {
      if (s.st === 'lugn' || s.st === 'nod') { s.x += Math.sin(t * 0.4 + s.f) * (3 + st * 6) * dt; s.y += Math.cos(t * 0.3 + s.f) * (2 + st * 4) * dt; s.x = Math.max(POOL.x0 + 16, Math.min(POOL.x1 - 16, s.x)); s.y = Math.max(POOL.y0 + 18, Math.min(POOL.y1 - 10, s.y)); }
      if (s.st === 'nod' && !done) { s.t -= dt; if (s.t <= 0) { s.st = 'sjunker'; s.t = 1.4; stats.miss++; streak = 0; play('miss'); pops.add(s.x, s.y - 30, $t('BOSSE FICK HOPPA I …'), '#ff6a6a'); if (boj && boj.i === simmare.indexOf(s)) boj = null; } }
      else if (s.st === 'raddad' || s.st === 'sjunker') { s.t -= dt; if (s.t <= 0) s.st = 'lugn'; }
    }
    if (boj) { boj.t += dt; if (boj.t >= 0.5) bojFram(); }
    if (lopare) { lopare.x += lopare.v * dt; if (lopare.x > POOL.x1 + 10) { lopare = null; if (!done) { stats.miss++; streak = 0; play('miss'); pops.add(POOL.x1, POOL.y1 - 10, $t('HALKADE – AJ!'), '#ff6a6a'); } } }
    if (done) { doneT += dt; if (doneT > 1.2 && !reported) { reported = true; onDone?.({ ...stats }); } return; }
    t += dt;
    if (t >= DUR) { done = true; boj = null; play('fanfare'); return; }
    if (auto && (nextT -= dt) <= 0) { if (rnd() < 0.25) spring(); else nod(); nextT = gap(); }
  }

  // ---------- bilden ----------
  let BG = null;
  function paintBg() {
    if (BG) return BG;
    const Pz = new Pix(FW, FH);
    // promenaden runt poolen (plattor), kaklet, vattnet med djup mot vågmaskinen överst, trappan nere till vänster
    for (let y = 0; y < FH; y++) for (let x = 0; x < FW; x++) { const fx = ((x + (((y / 16) | 0) & 1) * 16) % 32) === 31, fy = (y % 16) === 15; let c = mix(0xe8dcc0, 0xd8ccb0, hash(x >> 2, y >> 2, 3) * 0.6); if (fx || fy) c = mix(c, 0x000000, 0.18); Pz.px(x, y, c); }
    for (let y = POOL.y0 - 6; y <= POOL.y1 + 6; y++) for (let x = POOL.x0 - 6; x <= POOL.x1 + 6; x++) {
      const inne = x >= POOL.x0 && x <= POOL.x1 && y >= POOL.y0 && y <= POOL.y1;
      if (!inne) { Pz.px(x, y, ((x + y) & 2) ? 0xf4f1ea : 0x7ab0d8); continue; }
      const d = Math.min(x - POOL.x0, POOL.x1 - x, y - POOL.y0, POOL.y1 - y);
      if (d < 4) { Pz.px(x, y, 0x5a9ad0); continue; }
      const u = (y - POOL.y0) / (POOL.y1 - POOL.y0);
      let c = mix(0x5ab0e0, 0x1a5aa0, Math.min(1, (1 - u) * 1.3) + (hash(x >> 2, y >> 2, 4) - 0.5) * 0.2);
      if (hash(x >> 2, y, 5) > 0.94 && (x + y) % 3 === 0) c = mix(c, 0xffffff, 0.3);
      Pz.px(x, y, c);
    }
    for (let x = POOL.x0; x <= POOL.x1; x++) for (let y = POOL.y0 - 14; y < POOL.y0 - 6; y++) Pz.px(x, y, (y === POOL.y0 - 14) ? 0x8a8a94 : (x % 12 < 6 ? 0x5a5a66 : 0x6a6a78));   // vågmaskinen
    for (let y = POOL.y1 - 18; y <= POOL.y1; y++) for (let x = POOL.x0 + 4; x <= POOL.x0 + 36; x++) Pz.px(x, y, ((POOL.y1 - y) % 6 < 3) ? 0xcfe4f4 : 0x9ac4e8);   // trappan
    // tornets plattform och räcke nederst
    Pz.rect(TORN.x - 40, FH - 26, 80, 26, 0xf4f1ea); Pz.rect(TORN.x - 40, FH - 26, 80, 3, 0xd8343c); for (let x = TORN.x - 38; x < TORN.x + 40; x += 8) Pz.rect(x, FH - 22, 2, 8, 0xd8d4cc);
    Pz.rect(TORN.x - 44, FH - 28, 88, 2, 0xd8343c);
    BG = Pz.flush(); return BG;
  }
  function ritaVagor(ctx, st) {
    ctx.save(); ctx.beginPath(); ctx.rect(POOL.x0 + 4, POOL.y0 + 4, POOL.x1 - POOL.x0 - 8, POOL.y1 - POOL.y0 - 8); ctx.clip();
    const n = 8;
    for (let k = 0; k < n; k++) {
      const u = ((vagT * (0.08 + st * 0.12) + k / n) % 1), y = POOL.y0 + 8 + u * (POOL.y1 - POOL.y0 - 16), a = (0.12 + st * 0.45) * (1 - Math.abs(u - 0.5) * 0.6);
      ctx.strokeStyle = `rgba(255,255,255,${a.toFixed(2)})`; ctx.lineWidth = 1 + st * 2; ctx.beginPath();
      for (let x = POOL.x0; x <= POOL.x1; x += 4) ctx.lineTo(x, y + Math.sin(x / 18 + vagT * 2 + k) * (1.5 + st * 3)); ctx.stroke();
    }
    ctx.restore();
  }
  const gupp = (f) => Math.round(Math.sin(vagT * (2 + vagStyrka() * 3) + f) * (1 + vagStyrka() * 3));
  function ritaSimmare(ctx, s, i) {
    const dy = gupp(s.f);
    if (s.st === 'sjunker') { const u = 1 - s.t / 1.4; ctx.save(); ctx.beginPath(); ctx.rect(s.x - 20, s.y - 60, 40, 50 + dy - u * 14); ctx.clip(); drawPerson(ctx, s.x, s.y + 10 + dy + u * 14, s.look, 'down', 10); ctx.restore(); for (let k = 0; k < 3; k++) { ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.fillRect(s.x - 6 + k * 5, s.y - 4 - ((vagT * 20 + k * 7) % 12), 2, 2); } return; }
    ctx.save(); ctx.beginPath(); ctx.rect(s.x - 20, s.y - 60, 40, (s.look.kid ? 56 : 50) + dy); ctx.clip();   // vattenlinjen vid midjan (barnen är kortare)
    const frame = s.st === 'nod' ? ((Math.floor(t * 8) & 1) ? 10 : 11) : s.st === 'raddad' ? 10 : 0;
    drawPerson(ctx, s.x, s.y + 10 + dy, s.look, 'down', frame);
    ctx.restore();
    if (s.ring || s.st === 'raddad') ritaBadring(ctx, s.x, s.y + dy + 2, s.st === 'raddad' ? 0xd8343c : s.ring);
    if (s.st === 'nod') {
      const st = vagStyrka(), hjalp = s.dur - s.t > 0.5 - st * 0.3;
      if (hjalp) { const txt = $t('HJÄLP!'), w = textW(SMALL, txt) + 8, x = s.x - (w >> 1), y = s.y - 50 + dy; ctx.fillStyle = '#f4f1ea'; ctx.fillRect(x, y, w, 11); ctx.fillStyle = '#1c1a20'; ctx.fillRect(x - 1, y + 1, 1, 9); ctx.fillRect(x + w, y + 1, 1, 9); ctx.fillRect(x + 1, y - 1, w - 2, 1); ctx.fillRect(x + 1, y + 11, w - 2, 1); ctxText(ctx, SMALL, txt, x + 4, y + 3, '#d8343c'); }
      const k = Math.max(0, s.t / s.dur); ctx.fillStyle = '#2a2430'; ctx.fillRect(s.x - 10, s.y - 36 + dy, 20, 3); ctx.fillStyle = k > 0.5 ? '#46a35a' : k > 0.25 ? '#f0c030' : '#e04848'; ctx.fillRect(s.x - 10, s.y - 36 + dy, Math.round(20 * k), 3);
      for (let k2 = 0; k2 < 4; k2++) { ctx.fillStyle = 'rgba(255,255,255,.8)'; ctx.fillRect(Math.round(s.x - 12 + k2 * 8 + Math.sin(t * 9 + k2) * 2), Math.round(s.y - 2 + dy + Math.cos(t * 7 + k2) * 2), 2, 1); }   // plaskande
    }
    void i;
  }
  function ritaBoj(ctx) {
    if (!boj) return;
    const u = boj.t / 0.5, x = boj.x0 + (boj.x1 - boj.x0) * u, y = boj.y0 + (boj.y1 - boj.y0) * u - Math.sin(u * Math.PI) * 30;
    ctx.strokeStyle = '#f4f1ea'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(TORN.x, TORN.y - 28); ctx.lineTo(x, y); ctx.stroke();
    ritaBadring(ctx, x, y + 6, 0xd8343c);
  }
  function ritaLopare(ctx) {
    if (!lopare) return;
    drawPerson(ctx, lopare.x, lopare.y, lopare.look, 'right', [1, 3, 2, 3][Math.floor(t * 10) % 4]);
    for (let k = 0; k < 3; k++) { ctx.fillStyle = 'rgba(120,160,200,.6)'; ctx.fillRect(Math.round(lopare.x - 8 - k * 5), lopare.y - 1, 2, 1); }
  }
  function ritaTorn(ctx) {
    const look = A.avatar?.look || makeLook();
    drawPerson(ctx, TORN.x, TORN.y, { ...look, hat: 'cap', cap: '#f4f1ea', top: 'tee', shirt: '#d8343c' }, 'up', visselT > 0 ? 10 : 0);
    ctx.fillStyle = '#f4f1ea'; ctx.fillRect(TORN.x - 6, TORN.y - 30, 12, 3); ctx.fillStyle = '#d8343c'; ctx.fillRect(TORN.x - 4, TORN.y - 30, 2, 3); ctx.fillRect(TORN.x + 1, TORN.y - 30, 2, 3);
    if (visselT > 0) { ctxText(ctx, BIG, $t('PRRRIIIT!'), TORN.x + 14, TORN.y - 44, '#ffd23f'); }
    const h = $t('KLICKA PÅ DEN SOM BEHÖVER HJÄLP · VISSLA ÅT DEN SOM SPRINGER'); ctxText(ctx, SMALL, h, (FW - textW(SMALL, h)) >> 1, FH - 10, '#8a8a92');
  }

  return {
    get worldX() { return TORN.x; }, get worldY() { return TORN.y; },
    update,
    down(x, y) {
      if (done) return;
      if (lopare && Math.abs(x - lopare.x) < 14 && y > lopare.y - 34 && y < lopare.y + 6) { vissla(); return; }
      let best = -1, bd = 1e9;
      simmare.forEach((s, i) => { const d = Math.hypot(x - s.x, y - (s.y - 10)); if (d < 16 && d < bd) { bd = d; best = i; } });
      if (best >= 0) { radda(best); return; }
      if (y >= POOL.y1 + 2) vissla();
    },
    key(k) {
      if (k === 'Escape' && !done) { abortShift(A); return; }
      if (k === ' ' || k === 'Enter') vissla();
    },
    draw(ctx) {
      ctx.setTransform(A.pxs, 0, 0, A.pxs, 0, 0);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(paintBg(), 0, 0);
      const st = vagStyrka();
      ritaVagor(ctx, st);
      const items = simmare.map((s, i) => ({ fy: s.y, draw: () => ritaSimmare(ctx, s, i) }));
      for (const p of plask) items.push({ fy: p.y + 1, draw: () => ritaPlask(ctx, p.x, p.y, p.t / 0.8) });
      items.sort((a, b) => a.fy - b.fy).forEach((d) => d.draw());
      ritaLopare(ctx);
      ritaBoj(ctx);
      ritaTorn(ctx);
      if (st > 0.2) { const s = $t('VÅGORNA ÄR IGÅNG'); ctx.fillStyle = 'rgba(20,60,120,.8)'; ctx.fillRect((FW - textW(SMALL, s)) / 2 - 5, 22, textW(SMALL, s) + 10, 11); ctxText(ctx, SMALL, s, (FW - textW(SMALL, s)) >> 1, 25, '#ffffff'); }
      if (streak >= 2) { const s = $t`${streak} I RAD`; ctxText(ctx, SMALL, s, FW - textW(SMALL, s) - 8, 34, '#ffd23f'); }
      pops.draw(ctx);
      drawShiftHud(ctx, A, { t, dur: DUR, ok: stats.ok, fel: stats.fel + stats.miss, title: $t('BADVAKTEN') });
      if (done) { ctx.fillStyle = 'rgba(20,60,120,.5)'; ctx.fillRect(0, 0, FW, Math.min(FH, doneT * 300)); drawTimeUp(ctx, A); }
    },
    _debug: {
      stats,
      state: () => ({ t: +t.toFixed(2), done, stats: { ...stats }, streak, boj: !!boj, lopare: lopare ? { x: Math.round(lopare.x) } : null, vagor: vagor(), simmare: simmare.map((s) => ({ st: s.st, x: Math.round(s.x), y: Math.round(s.y), t: +s.t.toFixed(1) })) }),
      auto: (on) => { auto = !!on; },
      nod: (i) => nod(i),
      spring: () => spring(),
      radda: (i) => radda(i),
      vissla: () => vissla(),
      simSpot: (i) => ({ x: simmare[i].x, y: simmare[i].y - 10 }),
      loparSpot: () => (lopare ? { x: lopare.x, y: lopare.y - 14 } : null),
      vagT: (v) => { if (v != null) vagT = v; return vagT; },
      tick: (sec) => { for (let k = 0; k < sec * 30; k++) update(1 / 30); },
      finish: () => { t = DUR - 0.01; update(0.02); for (let k = 0; k < 60; k++) update(0.05); },
      time: () => t,
    },
  };
}
