// MÖBELJÄTTEN – rulltrappor och hiss.
//
// En rulltrappa beskrivs av sin påstigningsände (lx, ly = fötternas punkt på
// golvet, mitt i steget), riktningen sx (±1 i x från påstigningen mot bortre
// änden), sy (-1 = stiger upp mot taket på plan 1, +1 = sjunker ner i
// golvöppningen på plan 2), längden run och en klippgräns (clip): på plan 1
// syns bara det som är under takbjälken (y ≥ clip), på plan 2 bara det som är
// ovanför golvkanten framför öppningen (y < clip).
//
// Trappan målas i tre lager: bakre räcket, stegbandet (sex faser för
// animationen) och främre räcket/sargen. Åkande figurer ritas mellan steg och
// främre räcke.
import { Pix, SMALL, BIG, text, textW, mix, mul, hash, bayer } from '../../core/floor-pix.js';
import { arrowGlyph } from './art.js';

export const ESC_FLAT = 12, ESC_SLOPE = 0.58, ESC_PERIOD = 6;
const soft = (u) => (u <= 0 ? 0 : u < 8 ? (u * u) / 16 : u - 4);
export const escOff = (d) => ESC_SLOPE * soft(d - ESC_FLAT);
export function escPos(e, d) {
  return [e.lx + e.sx * d, e.ly + e.sy * escOff(Math.max(0, d))];
}
const visible = (e, y) => (e.sy < 0 ? y >= e.clip : y < e.clip);

// ---------- målningen ----------
export function escalatorArt(e) {
  // gränser
  const xs = [e.lx - e.sx * 18, e.lx + e.sx * (e.run + 2)];
  const x0 = Math.min(...xs) - 2, x1 = Math.max(...xs) + 2;
  const far = escPos(e, e.run);
  const yTop = Math.floor(Math.min(e.ly, far[1]) - 24), yBot = Math.ceil(Math.max(e.ly, far[1]) + 16);
  const W = x1 - x0, Hh = yBot - yTop;
  const mk = () => new Pix(W, Hh, x0, yTop);
  const back = mk(), front = mk();
  const treads = [];
  const put = (P, x, y, c, a = 1) => { if (visible(e, y)) P.px(x, y, c, a); };
  const floorLine = e.ly + 3;
  for (let d = -16; d <= e.run; d++) {
    const x = Math.round(e.lx + e.sx * d);
    const y = Math.round(e.ly + e.sy * escOff(Math.max(0, d)));
    if (d < -4) { // påstigningsplåten (kamplåt) + golvmarkering
      for (let yy = e.ly - 6; yy <= e.ly + 2; yy++) put(back, x, yy, (d & 1) ? 0x8a9098 : 0xb8bec6);
      put(back, x, e.ly - 7, 0x3a3e46); put(back, x, e.ly + 3, 0x3a3e46);
      if (d === -5) for (let yy = e.ly - 6; yy <= e.ly + 2; yy++) put(back, x, yy, 0xf2c230);
      continue;
    }
    // bakre räcket: glas + ledstång
    if (d >= 0) {
      for (let yy = y - 20; yy < y - 6; yy++) put(back, x, yy, 0xcfe8f0, 0.28);
      put(back, x, y - 21, 0x1a1a20); put(back, x, y - 20, 0x3a3a44);
      put(back, x, y - 7, 0xb8bec6);
    }
    // främre räcket: glas, ledstång, stålsarg, beklädnad
    if (d >= 0) {
      for (let yy = y - 11; yy < y + 2; yy++) put(front, x, yy, 0xd8eef6, 0.2);
      if ((d % 18) === 3) for (let yy = y - 11; yy < y + 2; yy++) put(front, x, yy, 0xffffff, 0.35);
      put(front, x, y - 13, 0x1a1a20); put(front, x, y - 12, 0x3a3a44);
      put(front, x, y + 2, 0xe0e4e8); put(front, x, y + 3, 0x9aa0a8);
      for (let yy = y + 4; yy < y + 11; yy++) put(front, x, yy, yy === y + 4 ? 0xc8ccd2 : mix(0xb8bcc2, 0x8a9098, (yy - y - 4) / 7));
      put(front, x, y + 11, 0x4a4e56);
      if (e.sy < 0) { // beklädnad under trappan ner till golvet
        for (let yy = y + 12; yy < floorLine; yy++) {
          let c = mix(0xe8e6e0, 0xd4d0c6, (yy - y) / 60 + (bayer(x, yy) - 0.5) * 0.1);
          if (((x - e.lx) % 24 + 24) % 24 === 0) c = mul(c, 0.9);
          put(front, x, yy, c);
        }
        put(front, x, floorLine, 0x000000, 0.25);
      }
    }
    // räckets rundade ände vid påstigningen
    if (d >= -4 && d < 0) {
      const k = -d; // 1..4
      for (let yy = y - 13 + k * 2; yy < y + 4; yy++) put(front, x, yy, 0xd8eef6, 0.22);
      put(front, x, y - 13 + k * 2, 0x1a1a20); put(front, x, y - 12 + k * 2, 0x3a3a44);
      for (let yy = y - 21 + k * 3; yy < y - 6; yy++) put(back, x, yy, 0xcfe8f0, 0.22);
      put(back, x, y - 21 + k * 3, 0x1a1a20);
      for (let yy = e.ly - 6; yy <= e.ly + 2; yy++) put(back, x, yy, 0x9aa0a8);
    }
  }
  // stegbandet i ESC_PERIOD faser
  for (let ph = 0; ph < ESC_PERIOD; ph++) {
    const P = mk();
    for (let d = 0; d <= e.run; d++) {
      const x = Math.round(e.lx + e.sx * d);
      const s = ((d - ph) % ESC_PERIOD + ESC_PERIOD) % ESC_PERIOD;
      const d0 = d - s; // stegets början: steget är plant
      const yq = Math.round(e.ly + e.sy * escOff(Math.max(0, d0)));
      const yNext = Math.round(e.ly + e.sy * escOff(Math.max(0, d0 + ESC_PERIOD)));
      for (let yy = yq - 6; yy <= yq + 2; yy++) {
        let c = s === 0 ? 0xe8b830 : ((yy - yq) & 1) ? 0x3a3c44 : 0x54565e;
        if (yy === yq - 6 || yy === yq + 2) c = 0xd8b030;
        put(P, x, yy, c);
      }
      // sättsteget (lodrät yta) när nästa steg ligger högre/lägre
      if (s === ESC_PERIOD - 1 && yNext !== yq) {
        const a = Math.min(yq, yNext), b = Math.max(yq, yNext);
        for (let yy = a - 6; yy < b - 6 + (e.sy < 0 ? 0 : 6); yy++) put(P, x, yy, 0x8a8c94);
      }
    }
    treads.push(P.flush());
  }
  return { x: x0, y: yTop, w: W, h: Hh, back: back.flush(), front: front.flush(), treads };
}

// Takbjälken på plan 1 (övervåningens golv) med räcke och skylt – målas på bakgrunden.
export function paintSlab(P, x0, x1, yBot, label) {
  const yTop = yBot - 10;
  // skugga på väggen under bjälken
  for (let y = yBot; y < yBot + 8; y++) for (let x = x0; x < x1; x++) if (bayer(x, y) < 1 - (y - yBot) / 8) P.px(x, y, 0x1a1426, 0.28);
  // räcket på övervåningen (glas + ledstång)
  for (let y = yTop - 13; y < yTop; y++) for (let x = x0 + 2; x < x1; x++) P.px(x, y, 0xcfe8f0, 0.3);
  P.hl(x0 + 2, yTop - 14, x1 - x0 - 2, 0x2a2a30); P.hl(x0 + 2, yTop - 13, x1 - x0 - 2, 0x6a6a72);
  for (let x = x0 + 4; x < x1; x += 22) P.vl(x, yTop - 13, 13, 0x9aa0a8);
  // bjälken
  for (let y = yTop; y < yBot; y++) for (let x = x0; x < x1; x++) {
    let c = y === yTop ? 0xf4f2ec : y === yBot - 1 ? 0x6a6660 : mix(0xe2ded6, 0xc8c2b8, (y - yTop) / 10);
    if (y >= yTop + 3 && y <= yTop + 7) c = y === yTop + 3 || y === yTop + 7 ? 0x0c2a5c : 0x1d51a0;
    P.px(x, y, c);
  }
  P.vl(x0, yTop, 10, 0x4a4650);
  if (label) {
    const tw = textW(SMALL, label);
    for (let x = x0 + 14; x + tw + 14 < x1; x += tw + 60) { text(P, SMALL, label, x, yTop + 4, 0xf6d02f); arrowGlyph(P, x + tw + 6, yTop + 5, 'U', 0xffffff); }
  }
}
// Golvöppningen på plan 2: schaktet (bakre väggen, djupet) och räcken på bakkant och vänsterkant.
export function paintPit(P, x0, x1, yb, yl) {
  for (let y = yb; y < yl; y++) for (let x = x0; x < x1; x++) {
    const t = (y - yb) / (yl - yb);
    let c = mix(0x8a8478, 0x2a2630, Math.min(1, t * 1.4));
    if (y < yb + 2) c = y === yb ? 0xf4f2ec : 0x6a6660; // kanten
    if (((x - x0) % 30) === 0 && y > yb + 2) c = mul(c, 0.85);
    // en glimt av golvet därnere (plan 1) längst ner
    if (t > 0.7) c = mix(c, hash(x >> 3, y >> 2, 77) > 0.5 ? 0x5a5650 : 0x4a4640, 0.5);
    P.px(x, y, c);
  }
  // räcke längs bakkanten (glas + ledstång)
  for (let y = yb - 12; y < yb; y++) for (let x = x0; x < x1; x++) P.px(x, y, 0xcfe8f0, 0.26);
  P.hl(x0, yb - 13, x1 - x0, 0x2a2a30); P.hl(x0, yb - 12, x1 - x0, 0x6a6a72);
  for (let x = x0; x < x1; x += 24) P.vl(x, yb - 12, 12, 0x9aa0a8);
  // vänsterkantens räcke (kortände)
  for (let y = yb - 12; y < yl; y++) P.px(x0 - 1, y, 0x9aa0a8);
  for (let y = yb; y < yl; y++) { P.px(x0, y, 0xd8d4cc); P.px(x0 + 1, y, 0xb8b4ac); }
}
// främre räcket vid öppningens framkant (ritas framför dem som åker ner)
export function pitFrontImg(w) {
  const P = new Pix(w, 16);
  for (let y = 1; y < 13; y++) for (let x = 0; x < w; x++) P.px(x, y, 0xd8eef6, 0.24);
  for (let x = 0; x < w; x += 24) P.vl(x, 1, 12, 0x9aa0a8);
  P.vl(w - 1, 1, 12, 0x9aa0a8);
  P.hl(0, 0, w, 0x1a1a20); P.hl(0, 1, w, 0x4a4a54);
  P.hl(0, 13, w, 0xf4f2ec); P.hl(0, 14, w, 0x9a968e); P.hl(0, 15, w, 0x000000, 0.2);
  return P.flush();
}

// ---------- hissen ----------
export const LIFT_W = 26, LIFT_H = 36;
// Hissens ram, skylt och knappanel på väggen (dörren = x..x+LIFT_W, golvet = fy)
export function paintLiftFrame(P, x, fy, n) {
  const y = fy - LIFT_H;
  // stålram
  P.rect(x - 4, y - 4, LIFT_W + 8, LIFT_H + 4, 0x9aa0a8);
  P.hl(x - 4, y - 4, LIFT_W + 8, 0xd8dce2); P.vl(x - 4, y - 4, LIFT_H + 4, 0xc8ccd2);
  P.vl(x + LIFT_W + 3, y - 4, LIFT_H + 4, 0x5a6068);
  P.rect(x - 1, y - 1, LIFT_W + 2, LIFT_H + 1, 0x3a3e46);
  // tröskel
  P.rect(x - 2, fy - 1, LIFT_W + 4, 2, 0xc8ccd2); P.hl(x - 2, fy + 1, LIFT_W + 4, 0x000000, 0.3);
  // skylt "HISS" + planvisaren (siffran ritas levande)
  P.rect(x - 4, y - 18, LIFT_W + 8, 11, 0x1d51a0); P.box(x - 4, y - 18, LIFT_W + 8, 11, 0x0c2a5c);
  text(P, SMALL, 'HISS', x + 1, y - 15, 0xf6d02f);
  P.rect(x + 18, y - 16, 8, 7, 0xf4f1ea); // liten barnvagn/rullstol-symbol
  P.rect(x + 19, y - 15, 5, 3, 0x1d51a0); P.px(x + 19, y - 11, 0x1d51a0); P.px(x + 23, y - 11, 0x1d51a0); P.vl(x + 24, y - 16, 3, 0x1d51a0);
  P.rect(x + 5, y - 6, 16, 1, 0x000000, 0.2);
  // knappanel till höger
  const px = x + LIFT_W + 6;
  P.rect(px, fy - 26, 7, 13, 0xc8ccd2); P.box(px, fy - 26, 7, 13, 0x6a7078);
  P.rect(px + 2, fy - 23, 3, 3, 0x3a3e46); P.rect(px + 2, fy - 18, 3, 3, 0x3a3e46);
  // plan-nummer bredvid
  P.rect(px - 1, fy - 42, 9, 11, 0xf6cf2a); P.box(px - 1, fy - 42, 9, 11, 0x9a7a10);
  text(P, SMALL, String(n), px + 2, fy - 39, 0x1d51a0);
}
// hisskorgen (syns när dörrarna är öppna)
export function liftCabImg() {
  const P = new Pix(LIFT_W, LIFT_H);
  for (let y = 0; y < LIFT_H; y++) for (let x = 0; x < LIFT_W; x++) {
    let c = mix(0xd8c49a, 0xb89a6a, y / LIFT_H);
    if (x % 9 === 0) c = mul(c, 0.86);
    if (y > LIFT_H - 7) c = mix(0x5a5650, 0x3a3630, (y - LIFT_H + 7) / 7); // golvet
    P.px(x, y, c);
  }
  // spegel + ledstång + taklampa
  P.rect(5, 6, 16, 14, 0xc8dce6); P.box(5, 6, 16, 14, 0x9aa0a8); for (let i = 0; i < 6; i++) P.px(8 + i, 8 + i, 0xffffff, 0.6);
  P.hl(2, 22, LIFT_W - 4, 0xd8dce2); P.hl(2, 23, LIFT_W - 4, 0x8a9098);
  P.rect(8, 0, 10, 2, 0xfff6d0); P.ell(13, 3, 12, 5, 0xfff6d0, 0.35, 3);
  return P.flush();
}
export function liftDoorImg() {
  const w = LIFT_W >> 1, P = new Pix(w, LIFT_H);
  for (let y = 0; y < LIFT_H; y++) for (let x = 0; x < w; x++) {
    let c = mix(0xd4d8de, 0xa4aab2, x / w * 0.6 + y / LIFT_H * 0.4 + (hash(x, y >> 2, 81) - 0.5) * 0.06);
    if (x === 0) c = 0xe8ecf0; if (x === w - 1) c = 0x7a8088;
    P.px(x, y, c);
  }
  P.hl(0, 0, w, 0x6a7078);
  return P.flush();
}
// planvisaren ovanför hissen (siffra + pil) – ritas levande
export function drawLiftIndicator(ctx, x, fy, n, arrow, lit) {
  const y = fy - LIFT_H - 7;
  ctx.fillStyle = '#16141a'; ctx.fillRect(x + 5, y, 16, 7);
  ctx.fillStyle = lit ? '#ff7a2a' : '#8a3a1a';
  const glyph = { 1: ['.#.', '##.', '.#.', '.#.', '###'], 2: ['##.', '..#', '.#.', '#..', '###'] }[n] || ['###', '#.#', '#.#', '#.#', '###'];
  glyph.forEach((row, j) => { for (let i = 0; i < 3; i++) if (row[i] === '#') ctx.fillRect(x + 8 + i, y + 1 + j, 1, 1); });
  if (arrow) {
    ctx.fillStyle = lit ? '#ffd23f' : '#6a5a1a';
    const ax = x + 15, ay = y + 3;
    if (arrow === 'U') { ctx.fillRect(ax, ay - 2, 1, 1); ctx.fillRect(ax - 1, ay - 1, 3, 1); ctx.fillRect(ax - 2, ay, 5, 1); ctx.fillRect(ax, ay + 1, 1, 2); }
    else { ctx.fillRect(ax, ay - 2, 1, 2); ctx.fillRect(ax - 2, ay, 5, 1); ctx.fillRect(ax - 1, ay + 1, 3, 1); ctx.fillRect(ax, ay + 2, 1, 1); }
  }
}
