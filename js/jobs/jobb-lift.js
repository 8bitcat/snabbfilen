// 🚡 LIFTVÄRDEN – jobbet i Skidbackens dalstation (Skidbacken steg 2; Carl 2026-11-18: "Skidbacken: lift, slalom, pulka,
// värmestuga"). Man står i luckan vid vändkorset och gästerna kommer i kö med skidorna på. Var och en håller upp sitt
// LIFTKORT: namn, foto, sort (DAGKORT, VECKOKORT eller SÄSONGSKORT) och vilken dag det gäller. Stämmer dagen och fotot
// (samma frisyr och hy som gästen) → SLÄPP IN, annars STOPP (gammalt kort, fel dag eller lånat kort). Rätt beslut =
// lönen tickar, fel = avdrag, för långsamt = gästen smiter förbi (missad). Vart tredje barn behöver hjälp upp i stolen:
// klicka HJÄLP UPP när stolen är i det gröna fältet. Åtta rätt i rad = GULDVANTEN (bonus). Takten följer vanan.
import { drawPerson, makeLook } from '../core/people.js';
import { Pix, SMALL, BIG, ctxText, textW, text, hash, mix, mul } from '../core/floor-pix.js';
import { planOf, drawShiftHud, drawTimeUp, makePops, abortShift } from './shift.js';
import { ritaStol, ritaSkidor } from '../skidbacken/deko.js';
import { play } from '../core/sound.js';
import { $t } from '../core/i18n.js';

const FW = 384, FH = 216;
const PLATS = { x: 96, y: 150 };                                   // gästen vid vändkorset (fötter)
const KO = [[40, 172], [14, 190], [-10, 206]];                     // kön bakom
const KORT = { x: 150, y: 44, w: 130, h: 70 };                     // liftkortet som hålls upp
const KNAPP = { in: { x: 20, y: 184, w: 108, h: 22 }, stopp: { x: 138, y: 184, w: 108, h: 22 }, hjalp: { x: 256, y: 184, w: 108, h: 22 } };
const LINA = { x0: 290, y0: 120, x1: 384, y1: 40 };                // linan upp mot toppen (höger del av bilden)
const SORTER = [{ id: 'dag', namn: $t('DAGKORT'), dagar: 1 }, { id: 'vecka', namn: $t('VECKOKORT'), dagar: 7 }, { id: 'sasong', namn: $t('SÄSONGSKORT'), dagar: 120 }];
const NAMN = ['Ebba', 'Vilgot', 'Signe', 'Hugo', 'Tove', 'Melvin', 'Juni', 'Alvar', 'Stina', 'Love', 'Märta', 'Otto'];

export function makeJobbLift(A, { onDone } = {}) {
  const g = A.game, P = planOf(A), DUR = P.seconds;
  const stats = { ok: 0, fel: 0, miss: 0, boxes: 0 };
  const pops = makePops();
  let t = 0, done = false, doneT = 0, reported = false;
  let seed = ((g?.day || 1) * 7873 + 1212) % 233280;
  const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
  const wage = 12, DAG = g?.day || 1;
  let gast = null, streak = 0, nextT = 1.6, auto = true, stolU = 0, hjalpFonster = null;
  const koLooks = [0, 1, 2].map(() => makeLook());
  const patience = () => Math.max(5, 9 / (P.pace || 1));
  const gap = () => (1.2 + rnd() * 1.2) / (P.pace || 1);
  // vilket problem har kortet? ok | gammal (dagen passerad) | framtid (gäller inte än) | lanat (annan persons foto)
  function nyGast(fel = null, barn = null) {
    if (gast) return null;
    const look = koLooks.shift() || makeLook(); koLooks.push(makeLook());
    const kid = barn ?? rnd() < 0.3; look.kid = kid;
    const sort = SORTER[(rnd() * SORTER.length) | 0];
    const problem = fel || (rnd() < 0.42 ? ['gammal', 'framtid', 'lanat'][(rnd() * 3) | 0] : 'ok');
    let start = DAG - ((rnd() * (sort.dagar - 1)) | 0);                  // giltigt i dag
    if (problem === 'gammal') start = DAG - sort.dagar - ((rnd() * 3) | 0);
    if (problem === 'framtid') start = DAG + 1 + ((rnd() * 3) | 0);
    const foto = problem === 'lanat' ? { ...makeLook(), kid } : { ...look };
    if (problem === 'lanat') { if (foto.hair === look.hair) foto.hair = look.hair === '#1a1a1a' ? '#d8a040' : '#1a1a1a'; foto.skin = look.skin === '#f1c7a3' ? '#8a5a3c' : '#f1c7a3'; }
    gast = { look, kid, namn: NAMN[(rnd() * NAMN.length) | 0], sort, start, slut: start + sort.dagar - 1, problem, foto, t: patience(), dur: patience(), st: 'in', k: 0, hjalp: false };
    play('click');
    return gast;
  }
  const giltigt = (G) => G.problem === 'ok';
  function beslut(slappIn) {
    if (done || !gast || gast.st !== 'vantar' || hjalpFonster) return null;
    const G = gast, ratt = slappIn === giltigt(G);
    if (ratt) {
      stats.ok++; streak++; pops.add(PLATS.x, 90, slappIn ? $t('VÄLKOMMEN UPP!') : $t('RÄTT – KORTET GÄLLER INTE'), '#8ae08a'); pops.add(PLATS.x, 102, `+${wage} kr`, '#ffd23f'); play('ok');
      if (streak % 8 === 0) { stats.boxes++; pops.add(FW / 2, 30, $t('GULDVANTEN!'), '#ffd23f'); play('fanfare'); }
      if (slappIn && G.kid && rnd() < 0.5) { G.st = 'stol'; G.k = 1; hjalpFonster = { u: 0, fart: 0.9 * (P.pace || 1), dir: 1, t: 0 }; pops.add(PLATS.x, 78, $t('BARNET BEHÖVER HJÄLP UPP!'), '#f4f1ea'); return 'hjalp'; }
      G.st = slappIn ? 'upp' : 'bort'; G.k = 1.2;
    } else {
      stats.fel++; streak = 0; G.st = 'bort'; G.k = 1.2; play('miss');
      pops.add(PLATS.x, 90, slappIn ? [$t('GAMMALT KORT!'), $t('FEL DAG!'), $t('LÅNAT KORT!')][['gammal', 'framtid', 'lanat'].indexOf(G.problem)] || $t('FEL!') : $t('KORTET GÄLLDE JU!'), '#ff6a6a');
    }
    return ratt ? 'ratt' : 'fel';
  }
  function hjalp() {
    if (done || !hjalpFonster || !gast) return null;
    const u = hjalpFonster.u; hjalpFonster = null;
    if (u >= 0.4 && u <= 0.6) { stats.ok++; streak++; gast.st = 'upp'; gast.k = 1.2; pops.add(PLATS.x, 78, $t('PERFEKT LYFT!'), '#8ae08a'); pops.add(PLATS.x, 90, `+${wage} kr`, '#ffd23f'); play('ok'); if (streak % 8 === 0) { stats.boxes++; pops.add(FW / 2, 30, $t('GULDVANTEN!'), '#ffd23f'); play('fanfare'); } return 'ratt'; }
    stats.fel++; streak = 0; gast.st = 'bort'; gast.k = 1.2; pops.add(PLATS.x, 78, u < 0.4 ? $t('FÖR TIDIGT – PLUMS!') : $t('FÖR SENT – STOLEN GICK!'), '#ff6a6a'); play('miss'); return 'fel';
  }
  function update(dt) {
    pops.update(dt); stolU = (stolU + dt / 9) % 1;
    if (hjalpFonster) { hjalpFonster.u += hjalpFonster.dir * hjalpFonster.fart * dt; if (hjalpFonster.u >= 1) { hjalpFonster.u = 1; hjalpFonster.dir = -1; } if (hjalpFonster.u <= 0) { hjalpFonster.u = 0; hjalpFonster.dir = 1; } hjalpFonster.t += dt; if (hjalpFonster.t > 6 && !done) { hjalpFonster = null; stats.miss++; streak = 0; if (gast) { gast.st = 'bort'; gast.k = 1.2; } pops.add(PLATS.x, 78, $t('BARNET GAV UPP …'), '#ff6a6a'); play('miss'); } }
    if (gast) {
      const G = gast;
      if (G.st === 'in') { G.k += dt * 2; if (G.k >= 1) { G.k = 1; G.st = 'vantar'; } }
      else if (G.st === 'upp' || G.st === 'bort') { G.k -= dt; if (G.k <= 0) { gast = null; nextT = gap(); } }
      else if (G.st === 'vantar' && !done) { G.t -= dt; if (G.t <= 0) { stats.miss++; streak = 0; G.st = 'upp'; G.k = 1.2; pops.add(PLATS.x, 90, $t('SMET FÖRBI …'), '#ff6a6a'); play('miss'); } }
    }
    if (done) { doneT += dt; if (doneT > 1.2 && !reported) { reported = true; onDone?.({ ...stats }); } return; }
    t += dt;
    if (t >= DUR) { done = true; hjalpFonster = null; play('fanfare'); return; }
    if (auto && !gast && (nextT -= dt) <= 0) nyGast();
  }

  // ---------- bilden ----------
  let BG = null;
  function paintBg() {
    if (BG) return BG;
    const Pz = new Pix(FW, FH);
    // vinterhimmel, fjäll, backen med granar, dalstationens hus med luckan, snön med spår, vändkorset
    for (let y = 0; y < 60; y++) for (let x = 0; x < FW; x++) Pz.px(x, y, mix(0x9ac0e8, 0xe0ecf8, y / 60));
    for (let x = 0; x < FW; x++) { const h = 30 + Math.round(Math.sin(x / 60) * 10 + Math.sin(x / 23 + 1) * 4); for (let y = 60 - h; y < 70; y++) Pz.px(x, y, mix(0xf4f8fc, 0xb8c8dc, (y - (60 - h)) / h)); }
    for (let y = 60; y < FH; y++) for (let x = 0; x < FW; x++) Pz.px(x, y, mix(0xe4eef8, 0xf8fbff, hash(x >> 2, y >> 2, 3) * 0.6 + ((y % 9) === 8 ? -0.2 : 0)));
    for (const [gx, gy, s] of [[20, 80, 0.7], [60, 70, 0.6], [340, 90, 0.8], [372, 110, 0.9]]) { Pz.rect(gx - 1, gy - 4, 3, 6, 0x5a3a20); for (let j = 0; j < 20 * s; j++) { const w = Math.round((j / (20 * s)) * 9 * s); Pz.hl(gx - w, gy - 24 * s + j, w * 2 + 1, j % 4 === 3 ? 0xf4f8fc : 0x2e6a3a); } }
    // stationshuset (vänster), luckan där man står, vändkorset
    for (let y = 70; y < 160; y++) for (let x = 0; x < 150; x++) Pz.px(x, y, ((y % 6) === 5) ? 0x5a3a1e : mix(0x9a6a36, 0xb88448, hash(x >> 3, y >> 3, 4) * 0.4));
    for (let j = 0; j < 12; j++) Pz.hl(-4 + j, 58 + j, 160 - j * 2, j % 3 === 2 ? 0x4a3020 : 0x6e4a28); for (let x = -4; x < 156; x++) { for (let k = 0; k < 4; k++) Pz.px(x, 58 - k, 0xf4f8fc); }
    Pz.rect(96, 92, 44, 36, 0x2a2a30); Pz.rect(98, 94, 40, 24, 0xa8d0f0); Pz.rect(96, 118, 44, 4, 0xd0a060);   // luckan med glas och disk
    const s = $t('LIFTKORT'); Pz.rect(118 - (textW(SMALL, s) >> 1) - 4, 78, textW(SMALL, s) + 8, 10, 0xd8343c); text(Pz, SMALL, s, 118 - (textW(SMALL, s) >> 1), 80, 0xf4f1ea);
    Pz.rect(150, 120, 4, 40, 0x3a3a42); Pz.rect(150, 118, 30, 3, 0x3a3a42); Pz.rect(176, 120, 4, 40, 0x3a3a42); for (let k = 0; k < 3; k++) Pz.rect(154 + k * 8, 134, 6, 2, 0xd8343c);   // vändkorset
    for (let x = 180; x < 300; x += 4) { Pz.px(x, 150, 0xc0d0e4); Pz.px(x + 1, 154, 0xc0d0e4); }   // spåren mot stolen
    // linan och stolparna (stolarna ritas levande)
    for (const d of [-4, 4]) { for (let i = 0; i <= 100; i++) { const u = i / 100; Pz.px(Math.round(LINA.x0 + (LINA.x1 - LINA.x0) * u) + d, Math.round(LINA.y0 + (LINA.y1 - LINA.y0) * u) - 50, 0x2a2a32); } }
    Pz.rect(LINA.x0 - 2, LINA.y0 - 50, 5, 60, 0x3a3a42); Pz.rect(LINA.x0 - 12, LINA.y0 - 52, 25, 3, 0x3a3a42); Pz.hl(LINA.x0 - 12, LINA.y0 - 53, 25, 0xf4f8fc);
    for (let y = 176; y < FH; y++) Pz.hl(0, y, FW, 0x17151a);
    BG = Pz.flush(); return BG;
  }
  function drawKort(ctx) {
    if (!gast || gast.st !== 'vantar') return;
    const G = gast, K = KORT;
    ctx.fillStyle = '#f4f1ea'; ctx.fillRect(K.x, K.y, K.w, K.h); ctx.fillStyle = G.sort.id === 'sasong' ? '#f0c030' : G.sort.id === 'vecka' ? '#3a7bd5' : '#46a35a'; ctx.fillRect(K.x, K.y, K.w, 12);
    ctx.fillStyle = '#1c1a20'; ctx.fillRect(K.x - 1, K.y - 1, K.w + 2, 1); ctx.fillRect(K.x - 1, K.y + K.h, K.w + 2, 1); ctx.fillRect(K.x - 1, K.y, 1, K.h); ctx.fillRect(K.x + K.w, K.y, 1, K.h);
    ctxText(ctx, SMALL, $t('SKIDBACKEN') + ' · ' + G.sort.namn, K.x + 4, K.y + 3, '#f4f1ea');
    // fotot: huvudet ur kortets look, i en ruta
    ctx.fillStyle = '#d8e4f0'; ctx.fillRect(K.x + 6, K.y + 18, 30, 40);
    ctx.save(); ctx.beginPath(); ctx.rect(K.x + 6, K.y + 18, 30, 40); ctx.clip(); drawPerson(ctx, K.x + 21, K.y + 70, G.foto, 'down', 0); ctx.restore();
    ctxText(ctx, SMALL, G.namn.toUpperCase(), K.x + 42, K.y + 20, '#1c1a20');
    ctxText(ctx, SMALL, G.sort.dagar === 1 ? $t`GÄLLER DAG ${G.start}` : $t`GÄLLER DAG ${G.start}–${G.slut}`, K.x + 42, K.y + 32, '#1c1a20');
    ctxText(ctx, SMALL, $t`I DAG: DAG ${DAG}`, K.x + 42, K.y + 44, '#d8343c');
    for (let k = 0; k < 8; k++) { ctx.fillStyle = k % 2 ? '#1c1a20' : '#f4f1ea'; ctx.fillRect(K.x + 42 + k * 4, K.y + 58, 3, 8); }
    const kk = Math.max(0, G.t / G.dur); ctx.fillStyle = '#2a2430'; ctx.fillRect(K.x, K.y + K.h + 4, K.w, 3); ctx.fillStyle = kk > 0.5 ? '#46a35a' : kk > 0.25 ? '#f0c030' : '#e04848'; ctx.fillRect(K.x, K.y + K.h + 4, Math.round(K.w * kk), 3);
  }
  function drawGaster(ctx) {
    KO.forEach(([x, y], i) => { if (x > -20) { ritaSkidor(ctx, x, y, 0, true); drawPerson(ctx, x, y, koLooks[i], 'right', 0); } });
    if (!gast) return;
    const G = gast;
    if (G.st === 'in') { const x = KO[0][0] + (PLATS.x - KO[0][0]) * G.k, y = KO[0][1] + (PLATS.y - KO[0][1]) * G.k; ritaSkidor(ctx, x, y, 0, true); drawPerson(ctx, x, y, G.look, 'right', [1, 3, 2, 3][Math.floor(t * 7) % 4]); return; }
    if (G.st === 'vantar' || G.st === 'stol') { ritaSkidor(ctx, PLATS.x, PLATS.y, 0, true); drawPerson(ctx, PLATS.x, PLATS.y, G.look, 'up', G.st === 'vantar' ? 11 : 0); return; }
    if (G.st === 'upp') { const u = 1 - G.k / 1.2, x = PLATS.x + 100 * u, y = PLATS.y - 10 * u; ritaSkidor(ctx, x, y, 0, true); drawPerson(ctx, x, y, G.look, 'right', [1, 3, 2, 3][Math.floor(t * 7) % 4]); return; }
    if (G.st === 'bort') { const u = 1 - G.k / 1.2, x = PLATS.x - 60 * u, y = PLATS.y + 30 * u; ritaSkidor(ctx, x, y, 0, true); drawPerson(ctx, x, y, G.look, 'left', [1, 3, 2, 3][Math.floor(t * 7) % 4]); }
  }
  function drawLift(ctx) {
    for (let k = 0; k < 3; k++) { const u = (stolU + k / 3) % 1, x = LINA.x0 + (LINA.x1 - LINA.x0) * u, y = LINA.y0 + (LINA.y1 - LINA.y0) * u + 12; ritaStol(ctx, x, y, true); }
    if (hjalpFonster) {
      const x = 256, y = 150, w = 108;
      ctx.fillStyle = '#2a2430'; ctx.fillRect(x, y, w, 8); ctx.fillStyle = '#46a35a'; ctx.fillRect(x + Math.round(w * 0.4), y, Math.round(w * 0.2), 8);
      ctx.fillStyle = '#ffd23f'; ctx.fillRect(x + Math.round(w * hjalpFonster.u) - 2, y - 3, 4, 14);
      const s = $t('STOLEN KOMMER – HJÄLP UPP I DET GRÖNA'); ctxText(ctx, SMALL, s, x + (w >> 1) - (textW(SMALL, s) >> 1), y - 14, '#ffd23f');
    }
  }
  function drawKnappar(ctx) {
    const aktiv = !!gast && gast.st === 'vantar' && !hjalpFonster, hj = !!hjalpFonster;
    const rita = (B, txt, nr, c, on) => { ctx.fillStyle = on ? '#2a2436' : '#1e1a26'; ctx.fillRect(B.x, B.y, B.w, B.h); ctx.fillStyle = on ? c : '#3a3a42'; ctx.fillRect(B.x, B.y, B.w, 1); ctx.fillRect(B.x, B.y + B.h - 1, B.w, 1); ctx.fillRect(B.x, B.y, 1, B.h); ctx.fillRect(B.x + B.w - 1, B.y, 1, B.h); ctxText(ctx, BIG, txt, B.x + 10, B.y + 7, on ? '#f4f1ea' : '#6a6a72'); ctxText(ctx, SMALL, nr, B.x + B.w - 8, B.y + 3, '#8a8a92'); };
    rita(KNAPP.in, $t('SLÄPP IN'), '1', '#46a35a', aktiv); rita(KNAPP.stopp, $t('STOPP'), '2', '#d8343c', aktiv); rita(KNAPP.hjalp, $t('HJÄLP UPP'), '3', '#f0c030', hj);
    if (streak >= 2) { const s = $t`${streak} I RAD`; ctxText(ctx, SMALL, s, FW - textW(SMALL, s) - 8, 164, '#ffd23f'); }
    const h = $t('STÄMMER DAGEN OCH FOTOT? SLÄPP IN – ANNARS STOPP'); ctxText(ctx, SMALL, h, (FW - textW(SMALL, h)) >> 1, 178, '#8a8a92');
  }
  function drawJag(ctx) { const look = A.avatar?.look || makeLook(); ctx.save(); ctx.beginPath(); ctx.rect(98, 94, 40, 24); ctx.clip(); drawPerson(ctx, 118, 130, { ...look, hat: 'beanie', cap: '#d8343c' }, 'down', 0); ctx.restore(); }

  return {
    get worldX() { return 118; }, get worldY() { return 130; },
    update,
    down(x, y) {
      if (done) return;
      for (const [id, B] of Object.entries(KNAPP)) if (x >= B.x && x <= B.x + B.w && y >= B.y - 2 && y <= B.y + B.h + 2) { if (id === 'in') beslut(true); else if (id === 'stopp') beslut(false); else hjalp(); return; }
      if (hjalpFonster && y < 176) hjalp();
    },
    key(k) {
      if (k === 'Escape' && !done) { abortShift(A); return; }
      if (k === '1') beslut(true); else if (k === '2') beslut(false); else if (k === '3' || k === ' ' || k === 'Enter') hjalp();
    },
    draw(ctx) {
      ctx.setTransform(A.pxs, 0, 0, A.pxs, 0, 0);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(paintBg(), 0, 0);
      drawLift(ctx);
      drawGaster(ctx);
      drawJag(ctx);
      drawKort(ctx);
      drawKnappar(ctx);
      pops.draw(ctx);
      drawShiftHud(ctx, A, { t, dur: DUR, ok: stats.ok, fel: stats.fel + stats.miss, title: $t('LIFTVÄRDEN') });
      if (done) { ctx.fillStyle = 'rgba(40,80,160,.45)'; ctx.fillRect(0, 0, FW, Math.min(FH, doneT * 300)); drawTimeUp(ctx, A); }
    },
    _debug: {
      stats,
      state: () => ({ t: +t.toFixed(2), done, stats: { ...stats }, streak, dag: DAG, hjalp: hjalpFonster ? { u: +hjalpFonster.u.toFixed(2) } : null, gast: gast ? { namn: gast.namn, sort: gast.sort.id, start: gast.start, slut: gast.slut, problem: gast.problem, kid: gast.kid, st: gast.st, t: +gast.t.toFixed(1) } : null }),
      force: (problem, barn) => { gast = null; hjalpFonster = null; nyGast(problem, barn); if (gast) { gast.st = 'vantar'; gast.k = 1; } return gast ? { problem: gast.problem, kid: gast.kid } : null; },
      auto: (on) => { auto = !!on; },
      beslut: (slappIn) => beslut(slappIn),
      hjalp: () => hjalp(),
      fonster: (u) => { if (hjalpFonster) hjalpFonster.u = u; return hjalpFonster ? hjalpFonster.u : null; },
      startHjalp: () => { hjalpFonster = { u: 0, fart: 0.9, dir: 1, t: 0 }; if (gast) gast.st = 'stol'; },
      knapp: (id) => { const B = KNAPP[id]; return { x: B.x + (B.w >> 1), y: B.y + (B.h >> 1) }; },
      tick: (sec) => { for (let k = 0; k < sec * 30; k++) update(1 / 30); },
      finish: () => { t = DUR - 0.01; update(0.02); for (let k = 0; k < 60; k++) update(0.05); },
      time: () => t,
    },
  };
}
