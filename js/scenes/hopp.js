// HINDERBANAN – hoppning på ridbanan i landet (Carl 2026-10-02: "häst att rida med och hoppa runt med på
// en bana över hinder"). Sidovy: hästen galopperar av sig själv mot hindren (banan rullar förbi), man
// trycker (klick/mellanslag) för att hoppa. För tidigt eller för sent = hästen river bommen (4 fel).
// En häst som inte trivs (game.js hast.trivsel) vägrar ibland vid ett hinder (4 fel och tid). Klasserna
// (game.js HOPPKLASSER): lätt/medel/svår – högre hinder, fler hinder och snabbare galopp. Efter mållinjen
// räknar g.hoppResultat placeringen mot ridskolans ryttare, rosetten och priset.
//   makeHopp(A, { klass, onDone(res) })
import { Pix, SMALL, BIG, ctxText, textW, mix, mul, hash, bayer } from '../core/floor-pix.js';
import { drawPerson, makeLook } from '../core/people.js';
import { play } from '../core/sound.js';
import { HOPPKLASSER } from '../game.js';
import { drawHastRyttare } from '../landet/hast-art.js';

const FW = 384, FH = 216, GY = 176;      // marken (hästens hovar)
const HX = 104;                            // hästens plats på skärmen
const FARG = [0xd8343c, 0x3a7bd5, 0xf0b429, 0x46a35a, 0xc65fa0, 0xe87a2a];
// hoppets fysik: höjd h(t) = V·t − G·t²/2 (topp ≈ 30 px efter 0,33 s)
const V = 182, G = 552;

let BG = null;
function paintBg() {
  const P = new Pix(FW * 2, FH);
  for (let y = 0; y < 90; y++) for (let x = 0; x < FW * 2; x++) P.px(x, y, mix(0x6ab0e8, 0xd8eef8, y / 90));
  for (let c = 0; c < 8; c++) { const cx = c * 97 + 30, cy = 18 + (c % 3) * 10; for (let j = -5; j <= 5; j++) for (let i = -22; i <= 22; i++) if ((i / 22) ** 2 + (j / 5) ** 2 < 1) P.px(cx + i, cy + j, j > 1 ? 0xe8eef6 : 0xffffff); }
  // skogsbrynet bakom läktaren
  for (let x = 0; x < FW * 2; x++) { const h = 20 + Math.sin(x / 11) * 5 + Math.sin(x / 4) * 2; for (let y = Math.round(96 - h); y < 98; y++) P.px(x, y, mix(0x2e6a26, 0x4a8a3a, hash(x >> 1, y >> 1, 3))); }
  // läktaren med publik (färgade prickar) och flaggor
  for (let y = 98; y < 128; y++) for (let x = 0; x < FW * 2; x++) {
    const rad = (y - 98) >> 3, r = (y - 98) % 8;
    let c = r === 7 ? 0x8a8a92 : 0xb8b8c0;
    if (r < 5 && hash(x >> 2, rad, 7) > 0.35) { const f = hash(x >> 2, rad, 8); c = r < 2 ? [0xeec3a0, 0xc68a5c, 0x744a2d, 0xf6d7bf][Math.floor(f * 4)] : [0xd8343c, 0x3a7bd5, 0x46a35a, 0xf0b429, 0x8e5bd1, 0x2f3440][Math.floor(f * 6)]; }
    P.px(x, y, c);
  }
  for (let x = 20; x < FW * 2; x += 64) { P.vl(x, 74, 24, 0xd8d8d0); for (let j = 0; j < 7; j++) P.hl(x + 1, 74 + j, 9 - j, FARG[(x >> 6) % FARG.length]); }
  // det vita staketet runt banan och sanden
  for (let y = 128; y < FH; y++) for (let x = 0; x < FW * 2; x++) P.px(x, y, mix(0xd8c49a, 0xe8d4aa, hash(x >> 1, y >> 1, 9)) - (bayer(x, y) < 0.08 ? 0x0a0a08 : 0));
  for (let x = 0; x < FW * 2; x++) { P.px(x, 128, 0xf4f1ea); P.px(x, 129, 0xf4f1ea); P.px(x, 134, 0xf4f1ea); if (x % 16 === 0) P.rect(x, 126, 2, 14, 0xe8e4d8); }
  BG = P.flush();
  return BG;
}

export function makeHopp(A, { klass = 'latt', onDone } = {}) {
  const g = A.game, H = g.hast, K = HOPPKLASSER.find((k) => k.id === klass) || HOPPKLASSER[0];
  if (!BG) paintBg();
  const fart = { latt: 96, medel: 108, svar: 120 }[K.id];
  // banan: hindren (x längs banan, höjd, färg, typ) och mållinjen
  const hinder = [];
  let x = 360;
  for (let i = 0; i < K.hinder; i++) {
    const typ = i % 4 === 2 ? 'oxer' : i % 5 === 4 ? 'mur' : 'bom';
    hinder.push({ x, h: K.hojd + (i % 3) - 1 + (typ === 'oxer' ? 1 : 0), c: FARG[i % FARG.length], typ, nr: i + 1, rivit: false, klar: false, vagrat: false, fall: 0 });
    x += 190 + ((i * 37) % 70);
  }
  const mal = x + 40;
  const st = { fel: 0, tid: 0, rivna: 0, vagran: 0 };
  let t = 0, dist = 0, hoppT = -1, hojd = 0, start = 2.6, slut = false, slutT = 0, vagrar = 0, reported = false, puff = null;
  const trivsel = H?.trivsel ?? 70;
  const look = A.avatar?.look || {};
  const publik = Array.from({ length: 3 }, (_, i) => makeLook(() => hash(i, 7, 3)));
  const pop = (txt, c) => { puff = { txt, c, t: 0 }; };

  function hoppa() {
    if (start > 0 || slut || hoppT >= 0 || vagrar > 0) return;
    hoppT = 0; play('slide');
  }
  return {
    update(dt) {
      t += dt;
      if (puff) { puff.t += dt; if (puff.t > 1.1) puff = null; }
      for (const h of hinder) if (h.rivit && h.fall < 1) h.fall = Math.min(1, h.fall + dt * 3);
      if (start > 0) { start -= dt; if (start <= 0) play('fanfare'); return; }
      if (slut) { slutT += dt; if (slutT > 1.4 && !reported) { reported = true; onDone?.({ klass: K.id, fel: st.fel, tid: Math.round(st.tid * 10) / 10, rivna: st.rivna, vagran: st.vagran }); } return; }
      st.tid += dt;
      // vägran: hästen tvärstannar framför hindret
      if (vagrar > 0) { vagrar -= dt; return; }
      dist += fart * dt;
      if (hoppT >= 0) { hoppT += dt; hojd = Math.max(0, V * hoppT - G * hoppT * hoppT / 2); if (hoppT > 2 * V / G) { hoppT = -1; hojd = 0; } }
      // hindren: hästens mitt passerar → klar om hovarna är högre än bommen
      for (const h of hinder) {
        const rel = h.x - dist;           // hindrets x relativt hästen
        if (!h.klar && !h.vagrat && rel > 30 && rel < 48 && trivsel < 45) {
          h.vagrat = true;   // (avgörs en gång per hinder)
          if (hash(h.nr, H?.hopp | 0, 11) < (45 - trivsel) / 70) { h.vagrar = true; vagrar = 1.3; hoppT = -1; hojd = 0; st.fel += 4; st.vagran++; pop('VÄGRAR! +4', '#ff9a5a'); play('fel'); dist -= 14; return; }
        }
        if (!h.klar && rel <= 0) {
          h.klar = true;
          if (hojd < h.h - 2) { h.rivit = true; st.fel += 4; st.rivna++; pop('RIV! +4', '#ff6a5a'); play('fel'); }
          else { const marg = hojd - h.h; pop(marg > 9 ? 'PERFEKT!' : 'BRA!', '#7ee07e'); play('ok'); }
        }
      }
      if (dist >= mal) { slut = true; play('coin'); }
    },
    down() { hoppa(); },
    key(k) { if (k === ' ' || k === 'Enter' || k === 'ArrowUp') hoppa(); },
    draw(ctx) {
      ctx.setTransform(A.pxs, 0, 0, A.pxs, 0, 0);
      ctx.imageSmoothingEnabled = false;
      // bakgrunden rullar långsammare (läktaren) – sanden med banan
      const off = -Math.round(dist * 0.5) % FW;
      ctx.drawImage(BG, off, 0); ctx.drawImage(BG, off + FW * 2, 0);
      // spår i sanden
      ctx.fillStyle = 'rgba(160,130,90,.35)'; for (let i = 0; i < 26; i++) { const sx = ((i * 53 - dist) % (FW + 40) + FW + 40) % (FW + 40) - 20; ctx.fillRect(Math.round(sx), GY + 6 + (i % 3) * 7, 3, 1); }
      // hindren: stöd, bommar (randiga) eller mur; rivna bommar ligger på marken
      for (const h of hinder) {
        const sx = Math.round(HX + h.x - dist);
        if (sx < -40 || sx > FW + 40) continue;
        const c = '#' + h.c.toString(16).padStart(6, '0'), top = GY - h.h;
        for (const px of [sx - 10, sx + 8]) { ctx.fillStyle = '#f4f1ea'; ctx.fillRect(px, top - 6, 3, h.h + 6); ctx.fillStyle = c; ctx.fillRect(px, top - 6, 3, 2); ctx.fillRect(px, top + 2, 3, 2); ctx.fillStyle = '#1e1a24'; ctx.fillRect(px - 1, GY, 5, 1); }
        if (h.typ === 'mur') { for (let j = 0; j < Math.ceil(h.h / 3); j++) for (let i = 0; i < 4; i++) { ctx.fillStyle = (i + j) % 2 ? '#b85a3a' : '#a04a2e'; ctx.fillRect(sx - 7 + i * 4 + (j % 2) * 2, GY - 3 - j * 3, 4, 3); } }
        const bommar = h.typ === 'oxer' ? [top, top + 2] : [top];
        bommar.forEach((by, bi) => {
          const fall = h.rivit ? h.fall : 0, yy = Math.round(by + (GY - 2 - by) * fall), dx = bi * 3;
          for (let i = -7; i < 8; i += 2) { ctx.fillStyle = ((i + 7) >> 2) & 1 ? c : '#f4f1ea'; ctx.fillRect(sx + i + dx, yy, 2, 2); }
        });
        ctxText(ctx, SMALL, String(h.nr), sx - 2, top - 14, '#1e1a24');
      }
      // mållinjen (två flaggor) och domartornet
      const mx = Math.round(HX + mal - dist);
      if (mx < FW + 30) { for (const fx of [mx - 2, mx + 2]) { ctx.fillStyle = '#5a5e66'; ctx.fillRect(fx, GY - 30, 1, 30); } ctx.fillStyle = '#d8343c'; ctx.fillRect(mx - 9, GY - 30, 7, 5); ctx.fillStyle = '#f4f1ea'; ctx.fillRect(mx + 3, GY - 30, 7, 5); ctxText(ctx, SMALL, 'MÅL', mx - 6, GY - 40, '#1e1a24'); }
      // hästen och ryttaren
      const ga = start > 0 ? 'sta' : vagrar > 0 ? 'sta' : hojd > 3 ? 'hopp' : slut ? 'trav' : 'galopp';
      const fr = Math.floor(t * (ga === 'galopp' ? 11 : 6)) % 4;
      drawHastRyttare(ctx, HX, GY, 'right', ga, fr, H?.farg || 'fux', look, { hojd: Math.round(hojd) });
      // publiken vid staketet hejar
      publik.forEach((L, i) => drawPerson(ctx, 300 + i * 22 - ((dist * 0.5) % 40), 138, L, 'down', Math.floor(t * 3 + i) % 2 ? 4 : 0));
      // puffen (PERFEKT! / RIV!)
      if (puff) { const w = textW(BIG, puff.txt) + 10, y = 70 - Math.round(puff.t * 10); ctx.globalAlpha = Math.max(0, 1 - puff.t / 1.1); ctx.fillStyle = 'rgba(20,18,26,.85)'; ctx.fillRect(HX - w / 2 | 0, y, w, 13); ctxText(ctx, BIG, puff.txt, (HX - w / 2 | 0) + 5, y + 3, puff.c); ctx.globalAlpha = 1; }
      // tavlan: klassen, tiden och felen
      ctx.fillStyle = 'rgba(23,21,26,0.85)'; ctx.fillRect(0, 0, FW, 18);
      ctxText(ctx, BIG, `${K.namn.toUpperCase()} - ${H?.namn?.toUpperCase() || ''}`, 4, 5, '#f4f1ea');
      const s = `TID ${st.tid.toFixed(1).replace('.', ',')}  FEL ${st.fel}`;
      ctxText(ctx, BIG, s, FW - textW(BIG, s) - 6, 5, st.fel ? '#ff9a7a' : '#7ee07e');
      // nedräkningen och tipset
      if (start > 0) {
        const n = Math.ceil(start - 0.6), txt = n > 0 ? String(n) : 'KÖR!', w = textW(BIG, txt, 3);
        ctx.fillStyle = 'rgba(20,18,26,.8)'; ctx.fillRect((FW - w) / 2 - 10 | 0, 60, w + 20, 34); ctxText(ctx, BIG, txt, (FW - w) / 2 | 0, 66, '#ffd23f', 3);
        const tip = 'TRYCK FÖR ATT HOPPA - PRECIS FÖRE HINDRET!', tw = textW(SMALL, tip) + 10;
        ctx.fillRect((FW - tw) / 2 | 0, 100, tw, 11); ctxText(ctx, SMALL, tip, (FW - tw) / 2 + 5 | 0, 103, '#f4f1ea');
      }
      if (slut) { const txt = st.fel ? `${st.fel} FEL` : 'FELFRITT!', w = textW(BIG, txt, 3); ctx.fillStyle = 'rgba(20,18,26,.85)'; ctx.fillRect((FW - w) / 2 - 10 | 0, 60, w + 20, 34); ctxText(ctx, BIG, txt, (FW - w) / 2 | 0, 66, st.fel ? '#ff9a7a' : '#7ee07e', 3); }
    },
    exit() {},
    _debug: {
      st: () => ({ ...st, dist: Math.round(dist), start, slut, hojd: Math.round(hojd) }),
      hinder: () => hinder.map((h) => ({ x: h.x, h: h.h, klar: h.klar, rivit: h.rivit, vagrar: !!h.vagrar })),
      nasta: () => { const h = hinder.find((q) => !q.klar); return h ? h.x - dist : null; },
      hoppa: () => hoppa(),
      skipStart: () => { start = 0.01; },
      fart: () => fart,
    },
  };
}
// hopptider: när ska man trycka för ett felfritt hopp? (för testerna) – topphöjden nås efter V/G s
export const HOPP_TOPP_S = V / G;
