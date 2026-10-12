// KANINHOPPNING i utställningshallen (js/scenes/utstallning.js). Sidovy som hinderbanan i landet: kaninen
// skuttar av sig själv längs banan och man trycker (klick/mellanslag) för att hoppa – precis före hindret.
// För tidigt eller för sent = bommen ramlar (4 fel). Tid och fel räknas mot de andra kaninerna
// (utstallning.js hoppPlacering).
//   makeKaninhopp(A, { petId, onDone(res) })   res = { fel, tid, rivna }
import { Pix, SMALL, BIG, ctxText, textW, mix, mul, hash, bayer } from '../core/floor-pix.js';
import { drawPerson, makeLook } from '../core/people.js';
import { play } from '../core/sound.js';
import { drawPet } from '../pets/sprites.js';
import { petStore } from '../pets/sim.js';
import { $t } from '../core/i18n.js';

const FW = 384, FH = 216, GY = 170;       // marken (kaninens tassar)
const RX = 110;                             // kaninens plats på skärmen
const FARG = [0xd8343c, 0x3a7bd5, 0xf0b429, 0x46a35a, 0xc65fa0, 0xe87a2a];
// hoppets fysik: höjd h(t) = V·t − G·t²/2 (topp ≈ 14 px efter 0,2 s)
const V = 140, G = 700;
export const KANIN_TOPP_S = V / G;
const FART = 74;

let BG = null;
function paintBg() {
  const P = new Pix(FW * 2, FH);
  // hallens tegelvägg med fönster och girlanger, läktaren med publik, banan av konstgräs
  for (let y = 0; y < 100; y++) for (let x = 0; x < FW * 2; x++) { const r = (y / 4) | 0, xx = x + (r & 1) * 4; P.px(x, y, (y % 4 === 3 || xx % 9 === 8) ? 0xd8c8b8 : mix(0xb86a4a, 0xa05a3e, hash((xx / 9) | 0, r, 2) * 0.6)); }
  for (let wx = 30; wx < FW * 2; wx += 150) { for (let j = 0; j < 36; j++) for (let i = 0; i < 22; i++) { if (j < 10 && Math.hypot(i - 10.5, j - 10) > 11) continue; P.px(wx + i, 14 + j, i === 0 || i === 21 ? 0xf4f1ea : mix(0xb8d4ec, 0x4e6e96, j / 36)); } P.vl(wx + 11, 16, 34, 0xf4f1ea); }
  const FL = [0xd8343c, 0xf4f1ea, 0x3a7bd5, 0xf0c040, 0x46a35a];
  for (let x = 0; x < FW * 2; x += 6) { const y = 6 + Math.round(Math.sin(x / 30) * 2 + 2); for (let j = 0; j < 4; j++) P.hl(x + j, y + j, Math.max(1, 5 - j * 2), FL[(x / 6) % FL.length | 0]); }
  for (let y = 100; y < 132; y++) for (let x = 0; x < FW * 2; x++) {
    const rad = (y - 100) >> 3, r = (y - 100) % 8;
    let c = r === 7 ? 0x5a3a28 : 0xb07a48;
    if (r < 5 && hash(x >> 2, rad, 7) > 0.3) { const f = hash(x >> 2, rad, 8); c = r < 2 ? [0xeec3a0, 0xc68a5c, 0x744a2d, 0xf6d7bf][Math.floor(f * 4)] : [0xd8343c, 0x3a7bd5, 0x46a35a, 0xf0b429, 0x8e5bd1, 0x2f3440][Math.floor(f * 6)]; }
    P.px(x, y, c);
  }
  for (let y = 132; y < FH; y++) for (let x = 0; x < FW * 2; x++) { let c = mix(0x3a9a4a, 0x46a858, hash(x >> 1, y >> 1, 9) * 0.6); if (((x >> 4) & 1) === 0) c = mul(c, 0.95); if (bayer(x, y) < 0.06) c = mul(c, 0.9); P.px(x, y, c); }
  for (let x = 0; x < FW * 2; x++) { P.px(x, 132, 0xf4f1ea); P.px(x, 133, 0xd8d4c8); if (x % 20 === 0) P.rect(x, 128, 2, 6, 0xf4f1ea); }
  BG = P.flush();
  return BG;
}

export function makeKaninhopp(A, { petId, onDone } = {}) {
  if (!BG) paintBg();
  const pet = petStore().petById(petId) || { id: 'kanin', species: 'kanin', breed: 'brun', stage: 'vuxen' };
  const hinder = [];
  let x = 300;
  for (let i = 0; i < 9; i++) { hinder.push({ x, h: 6 + (i % 3) * 2 + (i > 5 ? 1 : 0), c: FARG[i % FARG.length], nr: i + 1, rivit: false, klar: false, fall: 0 }); x += 112 + ((i * 29) % 46); }
  const mal = x + 30;
  const st = { fel: 0, tid: 0, rivna: 0 };
  let t = 0, dist = 0, hoppT = -1, hojd = 0, start = 2.4, slut = false, slutT = 0, reported = false, puff = null;
  const publik = Array.from({ length: 3 }, (_, i) => makeLook(() => hash(i, 9, 5)));
  const pop = (txt, c) => { puff = { txt, c, t: 0 }; };
  function hoppa() { if (start > 0 || slut || hoppT >= 0) return; hoppT = 0; play('slide'); }
  return {
    update(dt) {
      dt = Math.min(0.1, Math.max(0, dt));
      t += dt;
      if (puff) { puff.t += dt; if (puff.t > 1.1) puff = null; }
      for (const h of hinder) if (h.rivit && h.fall < 1) h.fall = Math.min(1, h.fall + dt * 3);
      if (start > 0) { start -= dt; if (start <= 0) play('fanfare'); return; }
      if (slut) { slutT += dt; if (slutT > 1.4 && !reported) { reported = true; onDone?.({ fel: st.fel, tid: Math.round(st.tid * 10) / 10, rivna: st.rivna }); } return; }
      st.tid += dt;
      dist += FART * dt;
      if (hoppT >= 0) { hoppT += dt; hojd = Math.max(0, V * hoppT - G * hoppT * hoppT / 2); if (hoppT > 2 * V / G) { hoppT = -1; hojd = 0; } }
      for (const h of hinder) {
        if (!h.klar && h.x - dist <= 0) {
          h.klar = true;
          if (hojd < h.h - 1) { h.rivit = true; st.fel += 4; st.rivna++; pop($t('RIV! +4'), '#ff6a5a'); play('fel'); }
          else { pop(hojd - h.h > 5 ? $t('PERFEKT!') : $t('BRA!'), '#7ee07e'); play('ok'); }
        }
      }
      if (dist >= mal) { slut = true; play('coin'); }
    },
    down() { hoppa(); },
    key(k) { if (k === ' ' || k === 'Enter' || k === 'ArrowUp') hoppa(); },
    draw(ctx) {
      ctx.setTransform(A.pxs, 0, 0, A.pxs, 0, 0);
      ctx.imageSmoothingEnabled = false;
      const off = -Math.round(dist * 0.5) % FW;
      ctx.drawImage(BG, off, 0); ctx.drawImage(BG, off + FW * 2, 0);
      for (const h of hinder) {
        const sx = Math.round(RX + h.x - dist);
        if (sx < -30 || sx > FW + 30) continue;
        const c = '#' + h.c.toString(16).padStart(6, '0'), top = GY - h.h;
        for (const px of [sx - 6, sx + 5]) { ctx.fillStyle = '#f4f1ea'; ctx.fillRect(px, top - 4, 2, h.h + 4); ctx.fillStyle = c; ctx.fillRect(px, top - 4, 2, 1); ctx.fillStyle = '#1e1a24'; ctx.fillRect(px - 1, GY, 4, 1); }
        const fall = h.rivit ? h.fall : 0, yy = Math.round(top + (GY - 1 - top) * fall);
        for (let i = -4; i < 5; i += 2) { ctx.fillStyle = ((i + 4) >> 1) & 1 ? c : '#f4f1ea'; ctx.fillRect(sx + i, yy, 2, 2); }
        ctxText(ctx, SMALL, String(h.nr), sx - 2, top - 12, '#1e1a24');
      }
      const mx = Math.round(RX + mal - dist);
      if (mx < FW + 30) { for (const fx of [mx - 2, mx + 2]) { ctx.fillStyle = '#5a5e66'; ctx.fillRect(fx, GY - 24, 1, 24); } ctx.fillStyle = '#d8343c'; ctx.fillRect(mx - 8, GY - 24, 6, 4); ctx.fillStyle = '#f4f1ea'; ctx.fillRect(mx + 3, GY - 24, 6, 4); ctxText(ctx, SMALL, $t('MÅL'), mx - 6, GY - 34, '#1e1a24'); }
      // kaninen: skuttar (run) på marken, i luften med lyft
      const anim = start > 0 ? 'idle' : slut ? 'happy' : 'run';
      ctx.fillStyle = 'rgba(20,12,30,.25)'; ctx.fillRect(RX - 6, GY - 1, 12, 2);
      drawPet(ctx, RX, GY - Math.round(hojd), pet, anim, t, 'right');
      publik.forEach((L, i) => drawPerson(ctx, 290 + i * 22 - ((dist * 0.5) % 40), 140, L, 'down', Math.floor(t * 3 + i) % 2 ? 10 : 0));
      if (puff) { const w = textW(BIG, puff.txt) + 10, y = 70 - Math.round(puff.t * 10); ctx.globalAlpha = Math.max(0, 1 - puff.t / 1.1); ctx.fillStyle = 'rgba(20,18,26,.85)'; ctx.fillRect(RX - w / 2 | 0, y, w, 13); ctxText(ctx, BIG, puff.txt, (RX - w / 2 | 0) + 5, y + 3, puff.c); ctx.globalAlpha = 1; }
      ctx.fillStyle = 'rgba(23,21,26,0.85)'; ctx.fillRect(0, 0, FW, 18);
      ctxText(ctx, BIG, `${$t('KANINHOPPNING')} - ${String(pet.name || '').toUpperCase()}`, 4, 5, '#f4f1ea');
      const s = $t`TID ${st.tid.toFixed(1).replace('.', ',')}  FEL ${st.fel}`;
      ctxText(ctx, BIG, s, FW - textW(BIG, s) - 6, 5, st.fel ? '#ff9a7a' : '#7ee07e');
      if (start > 0) {
        const n = Math.ceil(start - 0.6), txt = n > 0 ? String(n) : $t('KÖR!'), w = textW(BIG, txt, 3);
        ctx.fillStyle = 'rgba(20,18,26,.8)'; ctx.fillRect((FW - w) / 2 - 10 | 0, 60, w + 20, 34); ctxText(ctx, BIG, txt, (FW - w) / 2 | 0, 66, '#ffd23f', 3);
        const tip = $t('TRYCK FÖR ATT HOPPA - PRECIS FÖRE HINDRET!'), tw = textW(SMALL, tip) + 10;
        ctx.fillRect((FW - tw) / 2 | 0, 100, tw, 11); ctxText(ctx, SMALL, tip, (FW - tw) / 2 + 5 | 0, 103, '#f4f1ea');
      }
      if (slut) { const txt = st.fel ? $t`${st.fel} FEL` : $t('FELFRITT!'), w = textW(BIG, txt, 3); ctx.fillStyle = 'rgba(20,18,26,.85)'; ctx.fillRect((FW - w) / 2 - 10 | 0, 60, w + 20, 34); ctxText(ctx, BIG, txt, (FW - w) / 2 | 0, 66, st.fel ? '#ff9a7a' : '#7ee07e', 3); }
    },
    exit() {},
    _debug: {
      st: () => ({ ...st, dist: Math.round(dist), start, slut }),
      nasta: () => { const h = hinder.find((q) => !q.klar); return h ? h.x - dist : null; },
      hoppa: () => hoppa(),
      skipStart: () => { start = 0.01; },
      fart: () => FART,
    },
  };
}
