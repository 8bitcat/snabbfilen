// AGILITY i hundparken i Tassbacken (Carl 2026-10-12: "bygg allting inklusive stadsdelarna"). Sidovy som
// kaninhoppningen: hunden springer banan av sig själv, och man styr den vid hindren:
//   🟥 HINDER och 🛞 DÄCK  – tryck precis före för att hoppa (för sent/tidigt = rivning, 5 fel)
//   🟦 TUNNEL               – tryck INTE (hoppar hunden över tunneln blir det 5 fel)
//   🟨 SLALOM               – tryck så snabbt du kan medan hunden vävar mellan pinnarna (annars går det långsamt)
//   🟩 VIPPBRÄDA            – vänta! Hunden måste stanna på brädan tills den tippat (trycker man = 5 fel)
// Varje lopp tränar hunden (pet.agil, upp till 20): en vältränad hund springer fortare.
//   makeAgility(A, { petId, onDone(res) })   res = { fel, tid }
import { Pix, SMALL, BIG, ctxText, textW, mix, mul, hash, bayer } from '../core/floor-pix.js';
import { drawPerson, makeLook } from '../core/people.js';
import { play } from '../core/sound.js';
import { drawPet } from '../pets/sprites.js';
import { petStore } from '../pets/sim.js';
import { $t } from '../core/i18n.js';

const FW = 384, FH = 216, GY = 168;
const DX = 104;                               // hundens plats på skärmen
const V = 150, G = 640;                       // hoppet: topp ≈ 17 px efter 0,23 s
export const AGIL_TOPP_S = V / G;
const BANA = ['hopp', 'tunnel', 'hopp', 'slalom', 'dack', 'vipp', 'hopp', 'tunnel', 'dack', 'hopp'];

let BG = null;
function paintBg() {
  const P = new Pix(FW * 2, FH);
  for (let y = 0; y < 80; y++) for (let x = 0; x < FW * 2; x++) P.px(x, y, mix(0x7ab8e8, 0xd8eef8, y / 80));
  for (let c = 0; c < 7; c++) { const cx = c * 113 + 40, cy = 16 + (c % 3) * 9; for (let j = -5; j <= 5; j++) for (let i = -20; i <= 20; i++) if ((i / 20) ** 2 + (j / 5) ** 2 < 1) P.px(cx + i, cy + j, j > 1 ? 0xe8eef6 : 0xffffff); }
  // backen med husen i fjärran och parkens träd
  for (let x = 0; x < FW * 2; x++) { const h = 30 + Math.sin(x / 50) * 8; for (let y = Math.round(100 - h); y < 100; y++) P.px(x, y, mix(0x5a9a46, 0x4a8a3a, hash(x >> 1, y >> 1, 3))); }
  for (let x = 20; x < FW * 2; x += 70) { const c = [0xf4c8d0, 0xf8e4a0, 0xb8e0d0, 0xc8d4f4][(x / 70 | 0) % 4]; P.rect(x, 74 - (x % 3) * 4, 16, 10, c); for (let j = 0; j < 5; j++) P.hl(x - 2 + j, 73 - (x % 3) * 4 - j, 20 - j * 2, 0xb84a3a); }
  for (let x = 0; x < FW * 2; x += 48) for (let j = 0; j < 30; j++) for (let i = -12; i <= 12; i++) if ((i / 12) ** 2 + ((j - 14) / 14) ** 2 < 1) P.px(x + 24 + i, 94 + j - 20, hash(i, j, x) > 0.6 ? 0x2e6a26 : 0x3e8a32);
  // det vita staketet och gräset (trampat där banan går)
  for (let y = 100; y < FH; y++) for (let x = 0; x < FW * 2; x++) { let c = mix(0x4a9a3a, 0x58a842, hash(x >> 1, y >> 1, 9)); if (y > GY - 6 && y < GY + 10) c = mix(c, 0xc8b488, 0.55 + hash(x, y, 4) * 0.2); if (bayer(x, y) < 0.05) c = mul(c, 0.9); P.px(x, y, c); }
  for (let x = 0; x < FW * 2; x++) { if (x % 4 < 3) P.vl(x, 112, 10, 0xf4f1ea); P.px(x, 114, 0xc8c4b8); P.px(x, 118, 0xc8c4b8); }
  BG = P.flush();
  return BG;
}

export function makeAgility(A, { petId, onDone } = {}) {
  if (!BG) paintBg();
  const S = petStore(), pet = S.petById(petId) || { id: 'hund', species: 'hund', breed: 'collie', stage: 'vuxen' };
  const agil = Math.max(0, Math.min(20, pet.agil | 0)), FART = 82 + agil * 1.5;
  const hinder = [];
  let x = 280;
  for (let i = 0; i < BANA.length; i++) {
    const typ = BANA[i], len = typ === 'slalom' ? 90 : typ === 'vipp' ? 60 : typ === 'tunnel' ? 40 : 0;
    hinder.push({ typ, x, len, h: typ === 'dack' ? 14 : 10, nr: i + 1, klar: false, fel: false, fall: 0, tryck: 0 });
    x += len + 120 + ((i * 31) % 40);
  }
  const mal = x + 20;
  const st = { fel: 0, tid: 0 };
  let t = 0, dist = 0, hoppT = -1, hojd = 0, start = 2.4, slut = false, slutT = 0, reported = false, puff = null, vippStopp = 0;
  const publik = Array.from({ length: 3 }, (_, i) => makeLook(() => hash(i, 11, 7)));
  const pop = (txt, c) => { puff = { txt, c, t: 0 }; };
  const inne = (typ) => hinder.find((h) => h.typ === typ && dist >= h.x && dist < h.x + h.len);
  function tryck() {
    if (start > 0 || slut) return;
    const sl = inne('slalom');
    if (sl) { sl.tryck++; play('click'); return; }                 // slalom: varje tryck = snabbare vävning
    const vp = inne('vipp');
    if (vp && !vp.fel) { vp.fel = true; st.fel += 5; pop($t('HOPPADE AV! +5'), '#ff6a5a'); play('fel'); return; }
    if (hoppT >= 0) return;
    hoppT = 0; play('slide');
  }
  return {
    update(dt) {
      dt = Math.min(0.1, Math.max(0, dt));
      t += dt;
      if (puff) { puff.t += dt; if (puff.t > 1.1) puff = null; }
      for (const h of hinder) if (h.fel && h.fall < 1) h.fall = Math.min(1, h.fall + dt * 3);
      if (start > 0) { start -= dt; if (start <= 0) play('fanfare'); return; }
      if (slut) { slutT += dt; if (slutT > 1.4 && !reported) { reported = true; pet.agil = Math.min(20, (pet.agil | 0) + 1); S.save(); onDone?.({ fel: st.fel, tid: Math.round(st.tid * 10) / 10 }); } return; }
      st.tid += dt;
      // farten: slalom går långsamt om man inte trycker, vippbrädan stannar en stund
      const sl = inne('slalom'), vp = inne('vipp');
      let f = FART;
      if (sl) f = 26 + Math.min(1, sl.tryck / ((dist - sl.x) / 10 + 1)) * 70;
      if (vp) { const u = (dist - vp.x) / vp.len; if (u > 0.45 && vippStopp < 0.9) { vippStopp += dt; f = 0; } else f = FART * 0.6; } else vippStopp = 0;
      dist += f * dt;
      if (hoppT >= 0) { hoppT += dt; hojd = Math.max(0, V * hoppT - G * hoppT * hoppT / 2); if (hoppT > 2 * V / G) { hoppT = -1; hojd = 0; } }
      for (const h of hinder) {
        if (h.klar) continue;
        if ((h.typ === 'hopp' || h.typ === 'dack') && dist >= h.x) {
          h.klar = true;
          if (hojd < h.h - 2) { h.fel = true; st.fel += 5; pop($t('RIV! +5'), '#ff6a5a'); play('fel'); }
          else { pop(hojd - h.h > 5 ? $t('PERFEKT!') : $t('BRA!'), '#7ee07e'); play('ok'); }
        } else if (h.typ === 'tunnel' && dist >= h.x) {
          h.klar = true;
          if (hojd > 3) { h.fel = true; st.fel += 5; pop($t('MISSADE TUNNELN! +5'), '#ff6a5a'); play('fel'); }
          else pop($t('GENOM TUNNELN!'), '#7ee07e');
        } else if ((h.typ === 'slalom' || h.typ === 'vipp') && dist >= h.x + h.len) {
          h.klar = true;
          if (!h.fel) { pop(h.typ === 'slalom' ? $t('SNABB SLALOM!') : $t('SNYGGT VÄNTAT!'), '#7ee07e'); play('ok'); }
        }
      }
      if (dist >= mal) { slut = true; play('coin'); }
    },
    down() { tryck(); },
    key(k) { if (k === ' ' || k === 'Enter' || k === 'ArrowUp') tryck(); },
    draw(ctx) {
      ctx.setTransform(A.pxs, 0, 0, A.pxs, 0, 0);
      ctx.imageSmoothingEnabled = false;
      const off = -Math.round(dist * 0.5) % FW;
      ctx.drawImage(BG, off, 0); ctx.drawImage(BG, off + FW * 2, 0);
      for (const h of hinder) {
        const sx = Math.round(DX + h.x - dist);
        if (sx + h.len < -40 || sx > FW + 40) continue;
        ctx.fillStyle = 'rgba(20,12,30,.2)'; ctx.fillRect(sx - 8, GY - 1, 16 + h.len, 3);
        if (h.typ === 'hopp') {
          const top = GY - h.h, fall = h.fel ? h.fall : 0, yy = Math.round(top + (GY - 2 - top) * fall);
          for (const px of [sx - 7, sx + 6]) { ctx.fillStyle = '#f4f1ea'; ctx.fillRect(px, top - 6, 2, h.h + 6); }
          for (let i = -6; i < 7; i += 3) { ctx.fillStyle = ((i + 6) / 3) & 1 ? '#d8343c' : '#f4f1ea'; ctx.fillRect(sx + i, yy, 3, 2); }
        } else if (h.typ === 'dack') {
          ctx.fillStyle = '#f4f1ea'; ctx.fillRect(sx - 10, GY - 30, 2, 30); ctx.fillRect(sx + 9, GY - 30, 2, 30); ctx.fillRect(sx - 10, GY - 30, 21, 2);
          for (let k = 0; k < 20; k++) { const an = k / 20 * Math.PI * 2; ctx.fillStyle = k % 4 < 2 ? '#26242c' : '#f0b429'; ctx.fillRect(Math.round(sx + Math.cos(an) * 6), Math.round(GY - 14 - 6 + Math.sin(an) * 7), 2, 2); }
        } else if (h.typ === 'tunnel') {
          for (let i = 0; i < h.len; i++) { const hh = 14; ctx.fillStyle = (i % 6) < 3 ? '#3a7bd5' : '#2a5aa8'; ctx.fillRect(sx + i, GY - hh, 1, hh); }
          ctx.fillStyle = '#14182a'; ctx.fillRect(sx, GY - 11, 2, 10); ctx.fillRect(sx + h.len - 2, GY - 11, 2, 10);
        } else if (h.typ === 'slalom') {
          for (let i = 0; i < 6; i++) { const px = sx + 6 + i * 16; ctx.fillStyle = i % 2 ? '#f0b429' : '#f4f1ea'; ctx.fillRect(px, GY - 22, 2, 22); ctx.fillStyle = '#3a3a3e'; ctx.fillRect(px - 1, GY, 4, 1); }
        } else if (h.typ === 'vipp') {
          const u = Math.max(0, Math.min(1, (dist - h.x) / h.len)), tilt = u > 0.5 ? 6 : u > 0.45 ? Math.round((1 - Math.max(0, 0.9 - vippStopp) / 0.9) * 6) : -6;
          ctx.fillStyle = '#5a5e66'; ctx.fillRect(sx + h.len / 2 - 3, GY - 6, 6, 6);
          for (let i = 0; i <= h.len; i++) { const yy = GY - 6 + Math.round(((i - h.len / 2) / (h.len / 2)) * tilt * -1); ctx.fillStyle = i < 10 || i > h.len - 10 ? '#f0b429' : '#46a35a'; ctx.fillRect(sx + i, yy - 2, 1, 2); }
        }
        ctxText(ctx, SMALL, String(h.nr), sx - 2, GY - 44, '#1e1a24');
      }
      const mx = Math.round(DX + mal - dist);
      if (mx < FW + 30) { for (const fx of [mx - 2, mx + 2]) { ctx.fillStyle = '#5a5e66'; ctx.fillRect(fx, GY - 26, 1, 26); } ctx.fillStyle = '#d8343c'; ctx.fillRect(mx - 9, GY - 26, 7, 5); ctx.fillStyle = '#f4f1ea'; ctx.fillRect(mx + 3, GY - 26, 7, 5); ctxText(ctx, SMALL, $t('MÅL'), mx - 6, GY - 36, '#1e1a24'); }
      // hunden: på vippbrädan och i tunneln syns den (i tunneln bara svagt)
      const iTunnel = hinder.some((h) => h.typ === 'tunnel' && dist > h.x + 4 && dist < h.x + h.len - 4 && hojd < 3);
      const vp = inne('vipp'), lyft = vp ? Math.round(Math.max(0, 6 - Math.abs((dist - vp.x) - vp.len / 2) / (vp.len / 12))) : 0;
      const anim = start > 0 ? 'idle' : slut ? 'happy' : (vp && vippStopp > 0 && vippStopp < 0.9) ? 'idle' : 'run';
      ctx.globalAlpha = iTunnel ? 0.25 : 1;
      drawPet(ctx, DX, GY - Math.round(hojd) - lyft, pet, anim, t, 'right');
      ctx.globalAlpha = 1;
      // föraren springer bredvid (figuren)
      drawPerson(ctx, DX - 26, GY + 14, A.avatar?.look || {}, 'right', start > 0 || slut ? 0 : [1, 3, 2, 3][Math.floor(t * 9) % 4]);
      publik.forEach((L, i) => drawPerson(ctx, 280 + i * 24 - ((dist * 0.5) % 40), 112, L, 'down', Math.floor(t * 3 + i) % 2 ? 10 : 0));
      if (puff) { const w = textW(BIG, puff.txt) + 10, y = 64 - Math.round(puff.t * 10); ctx.globalAlpha = Math.max(0, 1 - puff.t / 1.1); ctx.fillStyle = 'rgba(20,18,26,.85)'; ctx.fillRect(DX - w / 2 | 0, y, w, 13); ctxText(ctx, BIG, puff.txt, (DX - w / 2 | 0) + 5, y + 3, puff.c); ctx.globalAlpha = 1; }
      // tips vid slalom och vippbräda
      const tip = inne('slalom') ? $t('TRYCK SNABBT!') : inne('vipp') ? $t('VÄNTA …') : '';
      if (tip) { const w = textW(BIG, tip) + 10; ctx.fillStyle = 'rgba(20,18,26,.85)'; ctx.fillRect(FW / 2 - w / 2 | 0, 90, w, 13); ctxText(ctx, BIG, tip, (FW / 2 - w / 2 | 0) + 5, 93, '#ffd23f'); }
      ctx.fillStyle = 'rgba(23,21,26,0.85)'; ctx.fillRect(0, 0, FW, 18);
      ctxText(ctx, BIG, `${$t('AGILITY')} - ${String(pet.name || '').toUpperCase()}`, 4, 5, '#f4f1ea');
      const s = $t`TID ${st.tid.toFixed(1).replace('.', ',')}  FEL ${st.fel}`;
      ctxText(ctx, BIG, s, FW - textW(BIG, s) - 6, 5, st.fel ? '#ff9a7a' : '#7ee07e');
      if (start > 0) {
        const n = Math.ceil(start - 0.6), txt = n > 0 ? String(n) : $t('KÖR!'), w = textW(BIG, txt, 3);
        ctx.fillStyle = 'rgba(20,18,26,.8)'; ctx.fillRect((FW - w) / 2 - 10 | 0, 56, w + 20, 34); ctxText(ctx, BIG, txt, (FW - w) / 2 | 0, 62, '#ffd23f', 3);
        const tp = $t('HOPPA ÖVER HINDREN - INTE ÖVER TUNNELN!'), tw = textW(SMALL, tp) + 10;
        ctx.fillRect((FW - tw) / 2 | 0, 96, tw, 11); ctxText(ctx, SMALL, tp, (FW - tw) / 2 + 5 | 0, 99, '#f4f1ea');
      }
      if (slut) { const txt = st.fel ? $t`${st.fel} FEL` : $t('FELFRITT!'), w = textW(BIG, txt, 3); ctx.fillStyle = 'rgba(20,18,26,.85)'; ctx.fillRect((FW - w) / 2 - 10 | 0, 56, w + 20, 34); ctxText(ctx, BIG, txt, (FW - w) / 2 | 0, 62, st.fel ? '#ff9a7a' : '#7ee07e', 3); }
    },
    exit() {},
    _debug: {
      st: () => ({ ...st, dist: Math.round(dist), start, slut }),
      nasta: () => { const h = hinder.find((q) => !q.klar); return h ? { typ: h.typ, rel: h.x - dist, len: h.len } : null; },
      tryck: () => tryck(),
      skipStart: () => { start = 0.01; },
      fart: () => FART,
    },
  };
}

// ---------------------------------------------------------------- tävlingen (agilitycupen i hundparken)
// De andra hundarna i cupen (samma för alla en viss dag): fel och tid mot ens eget lopp.
const CUPHUNDAR = [['Rex', 'schafer'], ['Bella', 'golden'], ['Flash', 'collie'], ['Kaxe', 'jack'], ['Majken', 'corgi']];
export function agilityPlacering(day, fel, tid) {
  const andra = CUPHUNDAR.map(([namn], i) => ({ namn, fel: hash(i, day, 15) < 0.4 ? 5 : 0, tid: 24 + Math.round(hash(i, day, 16) * 80) / 10 }));
  const alla = [...andra, { namn: $t('Du'), fel, tid, du: true }].sort((a, b) => a.fel - b.fel || a.tid - b.tid);
  return { plats: alla.findIndex((x) => x.du) + 1, alla };
}
