// 🎭 TEATERN – skådespelarjobbet i Gamla stan (Carl 2026-11-18: "teater med skådespelarjobb"). Ett stillastående
// klickspel som Finanshuset: man står mitt på scenen i strålkastarljuset, Regissör Rut ropar en pose från kulissen –
// BUGA, VINKA, JUBLA eller SNURRA – och man trycker på rätt knapp (eller 1–4) innan hennes tålamod tar slut. Rätt =
// publiken klappar och lönen tickar; fel eller för sent = BUUU och en tomat från salongen. Tio rätt i rad = STÅENDE
// OVATIONER (bonus). Takten följer vanan (planOf → P.pace). Passet slutar när ridån går ner (shift.js sköter lönen).
import { drawPerson } from '../core/people.js';
import { Pix, SMALL, BIG, ctxText, textW, hash, mix, mul } from '../core/floor-pix.js';
import { planOf, drawShiftHud, drawTimeUp, makePops, abortShift } from './shift.js';
import { play } from '../core/sound.js';
import { $t } from '../core/i18n.js';

const FW = 384, FH = 216;
const POSER = [
  { id: 'buga', namn: $t('BUGA'), cues: [$t('Buga för publiken!'), $t('En djup bugning!')], ikon: ['..kkk..', '.kkkkk.', '..kkk..', 'kkkkkkk', '.kkkk..', '..kk...', '.k..k..'] },
  { id: 'vinka', namn: $t('VINKA'), cues: [$t('Vinka till kungen!'), $t('Vinka hej då!')], ikon: ['.....k.', '..kkkk.', '.kkkkk.', '..kkk..', '.kkkkk.', '..k.k..', '..k.k..'] },
  { id: 'jubla', namn: $t('JUBLA'), cues: [$t('Jubla – ni vann!'), $t('Hurra! Armarna upp!')], ikon: ['k.....k', 'k.kkk.k', 'kkkkkkk', '.kkkkk.', '..kkk..', '..k.k..', '..k.k..'] },
  { id: 'snurra', namn: $t('SNURRA'), cues: [$t('Snurra runt, runt!'), $t('En piruett!')], ikon: ['..kkk..', '.k...k.', 'k.....k', 'k..k..k', 'k.....k', '.k...k.', '..kkk..'] },
];
const BTN = (i) => ({ x: 8 + i * 94, y: 194, w: 86, h: 20 });

export function makeJobbTeater(A, { onDone } = {}) {
  const g = A.game, P = planOf(A), DUR = P.seconds;
  const stats = { ok: 0, fel: 0, miss: 0, boxes: 0 };
  const pops = makePops();
  let t = 0, done = false, doneT = 0, reported = false;
  let seed = ((g?.day || 1) * 7919 + 104729) % 233280;
  const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
  const wage = 12;
  const ACTOR = { x: 192, y: 158 };
  const RUT = { x: 46, y: 160, look: { skin: '#f1c7a3', hair: '#1a1a1a', style: 'bun', shirt: '#1a1a2a', pants: '#2d2d3a', glasses: true } };
  let cue = null, nextT = 1.6, streak = 0, pose = null, claps = 0, boo = 0, ovation = 0, lastSaid = -1;
  const tomater = [], splats = [];
  const cueDur = () => Math.max(1.3, 3.0 / (P.pace || 1));
  const gap = () => 0.5 + (0.9 + rnd() * 0.6) / (P.pace || 1);
  function nyCue() {
    let k = (rnd() * POSER.length) | 0;
    if (k === lastSaid && rnd() < 0.7) k = (k + 1) % POSER.length;
    lastSaid = k;
    const pz = POSER[k];
    cue = { pose: pz.id, text: pz.cues[(rnd() * pz.cues.length) | 0], t: cueDur(), dur: cueDur() };
    play('click');
  }
  function tomat() {
    const fx = 60 + rnd() * 260;
    tomater.push({ x: fx, y: 206, t: 0, dur: 0.7, fromX: fx, toX: ACTOR.x + (rnd() - 0.5) * 20, toY: ACTOR.y - 10 - rnd() * 16 });
  }
  function press(id) {
    if (done) return;
    if (!cue) { pose = { id, t: 0.6 }; return; }   // utan uppmaning: man övar bara
    if (cue.pose === id) {
      stats.ok++; streak++; pose = { id, t: 0.9 }; claps = 1.3; cue = null; nextT = gap();
      pops.add(ACTOR.x, ACTOR.y - 52, `+${wage} kr`, '#ffd23f'); play('ok');
      if (streak % 10 === 0) { stats.boxes++; ovation = 2.6; pops.add(FW / 2, 96, $t('STÅENDE OVATIONER!'), '#ff8ac8'); play('fanfare'); }
    } else {
      stats.fel++; streak = 0; cue = null; nextT = gap() + 0.4; boo = 1.4; tomat(); play('miss');
      pops.add(ACTOR.x, ACTOR.y - 52, $t('FEL POSE!'), '#ff6a6a');
    }
  }
  function update(dt) {
    pops.update(dt);
    for (const tm of tomater) tm.t += dt;
    for (let i = tomater.length - 1; i >= 0; i--) if (tomater[i].t >= tomater[i].dur) { const tm = tomater.splice(i, 1)[0]; splats.push({ x: tm.toX, y: tm.toY, t: 0 }); }
    for (const s of splats) s.t += dt;
    while (splats.length && splats[0].t > 1.6) splats.shift();
    if (pose && (pose.t -= dt) <= 0) pose = null;
    if (claps > 0) claps -= dt;
    if (boo > 0) boo -= dt;
    if (ovation > 0) ovation -= dt;
    if (done) { doneT += dt; if (doneT > 1.2 && !reported) { reported = true; onDone?.({ ...stats }); } return; }
    t += dt;
    if (t >= DUR) { done = true; cue = null; play('fanfare'); return; }
    if (cue) {
      cue.t -= dt;
      if (cue.t <= 0) { stats.miss++; streak = 0; cue = null; nextT = gap() + 0.4; boo = 1.4; tomat(); play('miss'); pops.add(ACTOR.x, ACTOR.y - 52, $t('FÖR SENT!'), '#ff6a6a'); }
    } else if ((nextT -= dt) <= 0) nyCue();
  }

  // ---------- bilden ----------
  const css = (c) => '#' + (c & 0xffffff).toString(16).padStart(6, '0');
  let BG = null;
  function paintBg() {
    if (BG) return BG;
    const Pz = new Pix(FW, FH);
    // salongen: mörkblått, scengolvet: brädor, fondmålningen: slott i månsken, ridåerna: röd sammet med guldfrans
    Pz.rect(0, 0, FW, FH, 0x0e0e1a);
    for (let y = 20; y < 118; y++) for (let x = 44; x < 340; x++) { const u = (y - 20) / 98; Pz.px(x, y, mix(0x1a2450, 0x3a4a86, u + (hash(x, y, 3) - 0.5) * 0.06)); }
    for (let k = 0; k < 40; k++) Pz.px(50 + ((hash(k, 1, 4) * 288) | 0), 22 + ((hash(k, 2, 4) * 50) | 0), hash(k, 3, 4) > 0.7 ? 0xffffff : 0xa8b8e8);
    for (let j = -9; j <= 9; j++) { const w = Math.round(9 * Math.sqrt(Math.max(0, 1 - (j / 9.5) ** 2))); Pz.hl(290 - w, 44 + j, w * 2, j < -5 ? 0xfff6d0 : 0xf4e8b0); }
    // slottet
    for (const [bx, bw, bh] of [[120, 30, 46], [150, 60, 34], [210, 30, 50], [240, 40, 30]]) { for (let y = 118 - bh; y < 118; y++) for (let x = bx; x < bx + bw; x++) Pz.px(x, y, mix(0x2a2a44, 0x3e3e5c, hash(x >> 1, y >> 1, 5) * 0.6)); for (let x = bx; x < bx + bw; x += 4) Pz.rect(x, 118 - bh - 3, 2, 3, 0x2a2a44); for (let k = 0; k < 3; k++) Pz.rect(bx + 6 + k * 8, 118 - bh + 10, 3, 4, hash(bx, k, 6) > 0.4 ? 0xffd880 : 0x1a1a2a); }
    for (let x = 44; x < 340; x++) { const h = 6 + Math.round(Math.sin(x * 0.2) * 3 + Math.sin(x * 0.07) * 4); for (let y = 118 - h; y < 118; y++) Pz.px(x, y, mix(0x16321e, 0x244a2a, hash(x, y, 7))); }   // skogsbrynet
    // scengolvet: brädor
    for (let y = 118; y < 170; y++) for (let x = 0; x < FW; x++) { const r = Math.floor(y / 6), xx = x + (r & 1) * 17, c = Math.floor(xx / 34); Pz.px(x, y, (y % 6 === 5) ? 0x4a3018 : (xx % 34 === 33) ? 0x5a3c20 : mix(0x8a5a30, 0xa8743e, hash(c, r, 8) * 0.6 + (hash(x, y, 9) - 0.5) * 0.1)); }
    Pz.hl(0, 118, FW, 0x3a2410); Pz.hl(0, 119, FW, 0x6a4420);
    // sidoridåerna och övre draperiet (sammet med veck), guldfrans
    const RID = [0x4a0c14, 0x7a1620, 0xa8222c, 0xc8343a];
    for (const [x0, x1] of [[0, 46], [338, FW]]) for (let y = 0; y < 172; y++) for (let x = x0; x < x1; x++) { const f = Math.sin(x * 0.9 + (x0 ? 1 : 0)) * 0.5 + 0.5; Pz.px(x, y, RID[Math.min(3, Math.max(0, Math.round(f * 2.4 + (hash(x, y, 10) - 0.5) * 0.6 + (y > 150 ? -0.6 : 0))))]); }
    for (let y = 0; y < 22; y++) for (let x = 0; x < FW; x++) { const f = Math.sin(x * 0.5) * 0.5 + 0.5; Pz.px(x, y, RID[Math.min(3, Math.round(f * 2.4 + (y > 16 ? -0.8 : 0)))]); }
    for (let x = 0; x < FW; x += 3) { Pz.rect(x, 22, 2, 4 + (x % 6 === 0 ? 2 : 0), 0xe8c050); Pz.px(x, 22, 0xfff0a0); }
    for (const x0 of [44, 334]) for (let y = 22; y < 118; y++) { Pz.px(x0, y, 0xe8c050); Pz.px(x0 + (x0 < 100 ? 1 : -1), y, 0x8a6a10); }
    Pz.hl(44, 20, 296, 0xe8c050); Pz.hl(44, 21, 296, 0x8a6a10);
    // rampljusen och orkesterdiket
    Pz.rect(0, 170, FW, 8, 0x14141e);
    for (let x = 12; x < FW; x += 24) { Pz.rect(x - 2, 167, 5, 3, 0x2a2a30); Pz.rect(x - 1, 166, 3, 1, 0xfff0a0); }
    // publikens rader: mörk salong (huvudena ritas levande)
    for (let y = 178; y < FH; y++) Pz.hl(0, y, FW, mix(0x12122a, 0x0a0a16, (y - 178) / 38));
    BG = Pz.flush(); return BG;
  }
  const HEADS = Array.from({ length: 46 }, (_, i) => ({ x: 6 + (i % 23) * 16 + ((i / 23 | 0) ? 8 : 0), y: 185 + (i / 23 | 0) * 9, c: [0x2a2438, 0x332a40, 0x3a3048, 0x2e2a3c][i % 4], h: [0x1c1826, 0x4a3a30, 0x6a4a3a, 0x3a2a2a][(i * 7) % 4] }));
  function drawAudience(ctx) {
    const up = ovation > 0 ? 5 : 0;
    for (const h of HEADS) {
      const cl = claps > 0 && (h.x * 3 + Math.floor(t * 9)) % 3 !== 0;
      ctx.fillStyle = css(h.c); ctx.fillRect(h.x - 4, h.y - 6 - up, 9, 8); ctx.fillStyle = css(h.h); ctx.fillRect(h.x - 4, h.y - 8 - up, 9, 3);
      ctx.fillStyle = css(h.c); ctx.fillRect(h.x - 6, h.y + 1 - up, 13, 5);
      if (cl) { ctx.fillStyle = '#d8c8b0'; ctx.fillRect(h.x - 7, h.y - 10 - up, 2, 4); ctx.fillRect(h.x + 6, h.y - 10 - up, 2, 4); }
      if (boo > 0 && (h.x * 5) % 3 === 0) { ctx.fillStyle = '#f0f0f0'; ctxText(ctx, SMALL, 'O', h.x - 1, h.y - 14, '#f0f0f0'); }
    }
    if (claps > 0 || ovation > 0) for (let k = 0; k < 10; k++) { const sx = 20 + ((k * 37 + Math.floor(t * 4) * 11) % 340), sy = 172 + ((k * 13 + Math.floor(t * 6)) % 10); ctx.fillStyle = k % 2 ? '#ffe8a0' : '#ffffff'; ctx.fillRect(sx, sy, 1, 1); }
    if (boo > 0) { const s = $t('BUUU!'); ctxText(ctx, BIG, s, (FW - textW(BIG, s)) >> 1, 170, '#ff6a6a'); }
    if (ovation > 0) { const s = $t('STÅENDE OVATIONER!'); ctx.fillStyle = 'rgba(20,18,26,.8)'; ctx.fillRect((FW - textW(BIG, s)) / 2 - 6, 60, textW(BIG, s) + 12, 14); ctxText(ctx, BIG, s, (FW - textW(BIG, s)) >> 1, 63, '#ff8ac8'); }
  }
  function drawActor(ctx) {
    // strålkastaren
    ctx.globalCompositeOperation = 'lighter';
    const gr = ctx.createRadialGradient(ACTOR.x, ACTOR.y - 20, 4, ACTOR.x, ACTOR.y - 20, 48 + Math.sin(t * 1.3) * 2);
    gr.addColorStop(0, 'rgba(255,240,200,0.35)'); gr.addColorStop(1, 'rgba(255,240,200,0)'); ctx.fillStyle = gr; ctx.fillRect(ACTOR.x - 60, ACTOR.y - 80, 120, 100);
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(ACTOR.x - 7, ACTOR.y - 1, 14, 3);
    const look = A.avatar?.look || RUT.look;
    let dir = 'down', frame = 0, dy = 0;
    if (pose) {
      const u = 1 - pose.t / 0.9;
      if (pose.id === 'buga') { dy = Math.round(Math.sin(u * Math.PI) * 5); frame = 0; }
      else if (pose.id === 'vinka') { frame = 11; }
      else if (pose.id === 'jubla') { frame = 10; dy = -Math.round(Math.abs(Math.sin(u * Math.PI * 2)) * 4); }
      else { dir = ['left', 'up', 'right', 'down'][Math.floor(t * 8) % 4]; frame = 1; }
    } else if (Math.sin(t * 2) > 0.92) frame = 4;
    drawPerson(ctx, ACTOR.x, ACTOR.y + dy, look, dir, frame);
    for (const s of splats) { ctx.fillStyle = `rgba(216,40,40,${Math.max(0, 1 - s.t / 1.6).toFixed(2)})`; ctx.fillRect(s.x - 3, s.y - 2, 6, 4); ctx.fillRect(s.x - 1, s.y - 4, 2, 2); ctx.fillRect(s.x - 5, s.y, 2, 2); ctx.fillRect(s.x + 3, s.y - 1, 2, 2); }
    for (const tm of tomater) { const u = tm.t / tm.dur, x = tm.fromX + (tm.toX - tm.fromX) * u, y = 206 + (tm.toY - 206) * u - Math.sin(u * Math.PI) * 40; ctx.fillStyle = '#d82828'; ctx.fillRect(Math.round(x) - 2, Math.round(y) - 2, 5, 4); ctx.fillStyle = '#3e7e2a'; ctx.fillRect(Math.round(x), Math.round(y) - 3, 1, 1); }
  }
  function drawRut(ctx) {
    drawPerson(ctx, RUT.x, RUT.y, RUT.look, 'right', cue ? 11 : 0);
    ctx.fillStyle = '#e8c050'; ctx.fillRect(RUT.x + 6, RUT.y - 24, 6, 4); ctx.fillStyle = '#1c1a20'; ctx.fillRect(RUT.x + 4, RUT.y - 23, 2, 2);   // megafonen
    if (!cue) return;
    const pz = POSER.find((q) => q.id === cue.pose), txt = cue.text, w = textW(SMALL, txt) + 22, x = RUT.x + 14, y = RUT.y - 60;
    ctx.fillStyle = '#f4f1ea'; ctx.fillRect(x, y, w, 18); ctx.fillStyle = '#1c1a20'; ctx.fillRect(x - 1, y + 1, 1, 16); ctx.fillRect(x + w, y + 1, 1, 16); ctx.fillRect(x + 1, y - 1, w - 2, 1); ctx.fillRect(x + 1, y + 18, w - 2, 1);
    ctx.fillStyle = '#f4f1ea'; ctx.fillRect(x - 2, y + 12, 2, 2); ctx.fillRect(x - 4, y + 14, 2, 2);
    pz.ikon.forEach((r, j) => { for (let i = 0; i < 7; i++) if (r[i] === 'k') { ctx.fillStyle = '#1c1a20'; ctx.fillRect(x + 4 + i, y + 3 + j, 1, 1); } });
    ctxText(ctx, SMALL, txt, x + 15, y + 4, '#1c1a20');
    // tålamodet: grön → röd
    const k = Math.max(0, cue.t / cue.dur);
    ctx.fillStyle = '#2a2430'; ctx.fillRect(x, y + 19, w, 3); ctx.fillStyle = k > 0.5 ? '#46a35a' : k > 0.25 ? '#f0c030' : '#e04848'; ctx.fillRect(x, y + 19, Math.round(w * k), 3);
  }
  function drawButtons(ctx) {
    POSER.forEach((pz, i) => {
      const B = BTN(i), het = pose && pose.id === pz.id && pose.t > 0.5;
      ctx.fillStyle = het ? '#f0c030' : '#2a2436'; ctx.fillRect(B.x, B.y, B.w, B.h);
      ctx.fillStyle = het ? '#fff0a0' : '#e8c050'; ctx.fillRect(B.x, B.y, B.w, 1); ctx.fillRect(B.x, B.y + B.h - 1, B.w, 1); ctx.fillRect(B.x, B.y, 1, B.h); ctx.fillRect(B.x + B.w - 1, B.y, 1, B.h);
      pz.ikon.forEach((r, j) => { for (let k = 0; k < 7; k++) if (r[k] === 'k') { ctx.fillStyle = het ? '#1c1a20' : '#f4f1ea'; ctx.fillRect(B.x + 8 + k * 2, B.y + 3 + j * 2, 2, 2); } });
      ctxText(ctx, BIG, pz.namn, B.x + 28, B.y + 6, het ? '#1c1a20' : '#f4f1ea');
      ctxText(ctx, SMALL, String(i + 1), B.x + B.w - 8, B.y + 2, het ? '#1c1a20' : '#8a8a92');
    });
    if (streak >= 2) { const s = $t`${streak} I RAD`; ctxText(ctx, SMALL, s, FW - textW(SMALL, s) - 8, 124, '#ffd23f'); }
  }

  return {
    get worldX() { return ACTOR.x; }, get worldY() { return ACTOR.y; },
    update,
    down(x, y) {
      if (done) return;
      for (let i = 0; i < POSER.length; i++) { const B = BTN(i); if (x >= B.x - 1 && x <= B.x + B.w + 1 && y >= B.y - 1 && y <= B.y + B.h + 1) { press(POSER[i].id); return; } }
    },
    key(k) {
      if (k === 'Escape' && !done) { abortShift(A); return; }
      const i = ['1', '2', '3', '4'].indexOf(k); if (i >= 0) press(POSER[i].id);
    },
    draw(ctx) {
      ctx.setTransform(A.pxs, 0, 0, A.pxs, 0, 0);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(paintBg(), 0, 0);
      drawRut(ctx);
      drawActor(ctx);
      drawAudience(ctx);
      drawButtons(ctx);
      pops.draw(ctx);
      drawShiftHud(ctx, A, { t, dur: DUR, ok: stats.ok, fel: stats.fel + stats.miss, title: $t('TEATERN') });
      if (done) { ctx.fillStyle = 'rgba(120,20,30,.55)'; ctx.fillRect(0, 0, FW, Math.min(FH, doneT * 300)); drawTimeUp(ctx, A); }
    },
    _debug: {
      stats,
      state: () => ({ t: +t.toFixed(2), done, stats: { ...stats }, streak, cue: cue ? { pose: cue.pose, t: +cue.t.toFixed(2) } : null }),
      cue: () => (cue ? cue.pose : null),
      press: (id) => { press(id); return { ...stats }; },
      spot: (i) => { const B = BTN(i); return { x: B.x + (B.w >> 1), y: B.y + (B.h >> 1) }; },
      force: (id) => { const pz = POSER.find((q) => q.id === id) || POSER[0]; cue = { pose: pz.id, text: pz.cues[0], t: cueDur(), dur: cueDur() }; return cue.pose; },
      tick: (sec) => { for (let k = 0; k < sec * 30; k++) update(1 / 30); },
      finish: () => { t = DUR - 0.01; update(0.02); for (let k = 0; k < 60; k++) update(0.05); },
      time: () => t,
    },
  };
}
