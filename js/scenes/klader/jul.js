// KLÄDER · PLAN 3 – JULVÅNINGEN (Carl 2026-10-06): målade bilder och det som rör sig – väggarna,
// golven, fönstren med snöfall, girlangen längs taket med blinkande ljus, den stora granen på
// torget (ljusen blinkar), sittstockarna vid brasan, julkassan och borden med julpyntet.
// Siffrorna ligger i data.js (JUL_*, PYNT_*), dockorna och varorna ritas levande av scenen.
import { Pix, SMALL, BIG, textW, text, mix, mul, hash, bayer } from '../../core/floor-pix.js';
import {
  H, WALL_Y, W3, JUL_X1, TORG_X1, JUL_MOD, JUL_HATS, JUL_WIN, JUL_BRASA, JUL_GRAN, JUL_DESK,
  STAIRS3, JUL_DOLLS,
} from './data.js';
import { glowText, plank, rug, sign, pillar, spots, wainscot, wallModule, paintPit, arrowDown, disc } from './paint.js';

const PYNT_X1 = 1040;                                  // julpyntet | trapphallen
const LIGHT_COLS = ['#d9433b', '#ffd23f', '#3a7bd5', '#46a35a', '#ff8fd0'];

// ================= bakgrunden =================
export function paintFloor3() {
  const W = W3, P = new Pix(W, H);
  // JULKLÄDER: röd tapet med vita snöflingor
  const FLAKE = ['..#..', '#.#.#', '.###.', '#.#.#', '..#..'];
  for (let y = 0; y < WALL_Y; y++) for (let x = 0; x < JUL_X1; x++) {
    const c = ((x / 10) | 0) % 2 ? 0xb8262e : 0xa82028;
    P.px(x, y, mix(c, 0x000000, (bayer(x, y) - 0.5) * 0.06));
  }
  for (let y = 6; y < 54; y += 14) for (let x = 4; x < JUL_X1 - 6; x += 20) {
    const ox = x + (((y / 14) | 0) % 2 ? 10 : 0);
    FLAKE.forEach((row, j) => { for (let i = 0; i < 5; i++) if (row[i] === '#') P.px(ox + i, y + j, 0xfff4f0, 0.5); });
  }
  // JULTORGET: timmerväggar (liggande stockar)
  for (let y = 0; y < WALL_Y; y++) for (let x = JUL_X1; x < TORG_X1; x++) {
    const r = y % 9, log = (y / 9) | 0;
    let c = mix(0x8a5a32, 0x7a4e2a, hash((x / 30) | 0, log, 7) * 0.6);
    if (r === 0) c = 0x4a2a14; else if (r === 1) c = mix(c, 0xd8a870, 0.3); else if (r === 8) c = mul(c, 0.7);
    if (hash(x >> 1, y, 13) > 0.94) c = mul(c, 0.9);
    if ((x + log * 37) % 61 === 0 && r > 1) c = 0x5a3418; // stockändar/kvistar
    P.px(x, y, c);
  }
  // JULPYNTET: mörkgrön vägg med guldstjärnor och en hylla av träribbor (väggsakerna hänger där)
  const STAR = ['..#..', '.###.', '#####', '.#.#.'];
  for (let y = 0; y < WALL_Y; y++) for (let x = TORG_X1; x < PYNT_X1; x++) P.px(x, y, mix(0x1e4a2e, 0x173d26, hash(x >> 2, y >> 2, 21) * 0.5 + (bayer(x, y) - 0.5) * 0.2));
  for (let y = 4; y < 58; y += 16) for (let x = TORG_X1 + 4; x < PYNT_X1 - 6; x += 22) {
    const ox = x + (((y / 16) | 0) % 2 ? 11 : 0);
    STAR.forEach((row, j) => { for (let i = 0; i < 5; i++) if (row[i] === '#') P.px(ox + i, y + j, 0xe8c25a, 0.35); });
  }
  P.rect(TORG_X1 + 8, 22, 196, 46, 0x6a4024); // ribbväggen bakom väggsakerna
  for (let x = TORG_X1 + 10; x < TORG_X1 + 202; x += 6) P.vl(x, 22, 46, 0x8a5a34);
  P.box(TORG_X1 + 8, 22, 196, 46, 0x3a2010); P.hl(TORG_X1 + 9, 23, 194, 0xa87048);
  // trapphallen: ljus puts
  for (let y = 0; y < WALL_Y; y++) for (let x = PYNT_X1; x < W; x++) {
    let c = mix(0xe8e0d0, 0xd8cfbc, hash(x >> 2, y >> 2, 31) * 0.5 + (bayer(x, y) - 0.5) * 0.2);
    if ((y % 22) === 21) c = mul(c, 0.92);
    P.px(x, y, c);
  }
  wainscot(P, [[0, JUL_X1, 0xf4ece6, 0x2f8f46], [JUL_X1, TORG_X1, 0x5a3418, 0x3a2010], [TORG_X1, PYNT_X1, 0x6a3a22, 0xc9a24a], [PYNT_X1, W, 0x8a8478, 0x5a5448]]);
  spots(P, 0, W, [[JUL_GRAN.x - 60, JUL_GRAN.x + 60], [STAIRS3.pit[0] - 10, STAIRS3.pit[1] + 10]]);
  for (const px of [JUL_X1, TORG_X1, PYNT_X1]) pillar(P, px);
  // fönstren med vinterkvällen (snön faller levande, se drawSnow)
  for (const [x, y, w, h] of JUL_WIN) paintWindow(P, x, y, w, h);
  // ===== skyltarna =====
  bigSign(P, 'JULKLÄDER', 290, 4, 0x173a24, 0xd9433b, 0xfff0b0);
  bigSign(P, 'JULTORGET', 680, 4, 0x5e0c0c, 0xe8c25a, 0xffe070);
  bigSign(P, 'JULPYNT', 960, 4, 0x5e0c0c, 0xe8c25a, 0xffe070);
  // tröjväggen och hyllan för tomteluvorna
  wallModule(P, JUL_MOD.x, 'jul', 'JULTRÖJOR');
  P.rect(JUL_HATS.x, JUL_HATS.y, JUL_HATS.w, 10, 0x17151a); P.box(JUL_HATS.x, JUL_HATS.y, JUL_HATS.w, 10, 0xd9433b);
  text(P, SMALL, 'TOMTELUVOR', JUL_HATS.x + Math.round((JUL_HATS.w - textW(SMALL, 'TOMTELUVOR')) / 2), JUL_HATS.y + 3, 0xfff0b0);
  P.rect(JUL_HATS.x, JUL_HATS.y + 36, JUL_HATS.w, 3, 0xf4f1ea); P.hl(JUL_HATS.x, JUL_HATS.y + 39, JUL_HATS.w, 0xb8b0a0);
  // BRASAN-skylten över spisen
  const bs = 'BRASAN', bw = textW(SMALL, bs) + 12, bx = JUL_BRASA.x + 16 - bw / 2;
  P.rect(bx, 17, bw, 11, 0x2a1a10); P.box(bx, 17, bw, 11, 0xe8c25a); text(P, SMALL, bs, bx + 6, 20, 0xffc76a);
  // KASSA
  const kx = JUL_DESK.x + JUL_DESK.w / 2, kw = textW(SMALL, 'KASSA') + 10;
  P.rect(kx - kw / 2, 30, kw, 10, 0x17151a); P.box(kx - kw / 2, 30, kw, 10, 0xd9433b); text(P, SMALL, 'KASSA', kx - kw / 2 + 5, 33, 0xffd23f);
  // trapphallen: PLAN 3 och TRAPPA NER
  const hc = (PYNT_X1 + W) / 2 - 8;
  P.rect(hc - 36, 8, 72, 18, 0x173a24); P.box(hc - 36, 8, 72, 18, 0xd9433b);
  glowText(P, BIG, 'PLAN 3', hc - textW(BIG, 'PLAN 3') / 2, 14, 0xffe070, 0xd9433b);
  const [ax0] = sign(P, (STAIRS3.pit[0] + STAIRS3.pit[1]) / 2, 36, 'TRAPPA NER', 0x17151a, 0x2f8f46, 0xffffff);
  arrowDown(P, ax0 - 5, 40, 0x46a35a);
  // girlangen längs hela taket (ljusen blinkar levande, GARLAND_LIGHTS)
  for (let x = 2; x < W - 2; x++) {
    if (x > STAIRS3.pit[0] - 8 && x < STAIRS3.pit[1] + 8) continue;
    const yy = garlandY(x);
    P.px(x, yy - 1, 0x1e5a32, 0.7); P.px(x, yy, 0x2f8f46); P.px(x, yy + 1, 0x1e5a32); if (hash(x, 3, 41) > 0.6) P.px(x, yy + 2, 0x173d26, 0.8);
  }
  // ===== golvet =====
  for (let y = WALL_Y; y < H; y++) for (let x = 0; x < W; x++) {
    let c;
    if (x < JUL_X1) c = plank(x, y, 0xc8946a, 101, 7, 40);
    else if (x < TORG_X1) {
      // torget: kullersten med lite snö mellan stenarna
      const row = ((y - WALL_Y) / 8) | 0, off = row % 2 ? 6 : 0, cx = ((x + off) / 12) | 0;
      const ex = (x + off) % 12, ey = (y - WALL_Y) % 8;
      c = mix(0x8a8478, 0x9a9488, hash(cx, row, 103) * 0.8);
      if (ex === 0 || ey === 0) c = hash(x, y, 105) > 0.55 ? 0xe8eef2 : 0x5a564e;
      else if (ey === 1) c = mix(c, 0xffffff, 0.15);
    } else if (x < PYNT_X1) c = plank(x, y, 0x7a4a2e, 107, 6, 44);
    else c = mix(0x9a968c, 0x8e8a80, hash(x >> 1, y >> 1, 109) * 0.5 + (bayer(x, y) - 0.5) * 0.15);
    P.px(x, y, c);
  }
  // mattor: framför brasan och under julklädesdockorna
  rug(P, JUL_BRASA.x - 22, 92, 92, 34, 0x8a1e26, 0xe8c25a, 0xd9433b, 111);
  rug(P, 14, 92, 262, 104, 0x2f6b40, 0xd9433b, 0x6fd08a, 113);
  // schaktet för trappan
  const [p0, p1, pb, pl] = STAIRS3.pit;
  paintPit(P, p0, p1, pb, pl);
  for (let i = 0; i < 5; i++) P.darken(0, WALL_Y + i, W, 1, 0.8 + i * 0.04);
  for (const d of JUL_DOLLS) P.ell(d[1], d[2] + 1, 16, 6, 0xfff6e0, 0.24, 4);
  P.ell(JUL_GRAN.x, JUL_GRAN.base + 2, 52, 10, 0xfff0c0, 0.2, 4);
  P.ell(JUL_BRASA.x + 16, JUL_BRASA.base + 8, 44, 10, 0xffb060, 0.22, 4); // brasans sken på golvet
  for (const px of [JUL_X1, TORG_X1, PYNT_X1]) { P.rect(px - 1, WALL_Y, 2, H - WALL_Y, 0xd8b24a); P.vl(px - 1, WALL_Y, H - WALL_Y, 0xf0d890); }
  P.box(0, 0, W, H, 0x0e0d12);
  return P.flush();
}
// girlangens bågar längs taket (samma kurva för målningen och ljusen)
export const garlandY = (x) => 5 + Math.round(Math.abs(Math.sin(x / 14)) * 4);
export const GARLAND_LIGHTS = [];
for (let x = 9; x < W3 - 4; x += 11) if (!(x > STAIRS3.pit[0] - 8 && x < STAIRS3.pit[1] + 8)) GARLAND_LIGHTS.push([x, garlandY(x) + 2]);

function bigSign(P, lbl, cx, y, board, trim, neon) {
  const tw = textW(BIG, lbl, 2), w = tw + 24, x0 = Math.round(cx - w / 2), h = 25;
  P.ell(cx, y + h / 2, w * 0.7, h, trim, 0.18, 5);
  P.rect(x0, y, w, h, board); P.box(x0, y, w, h, mul(trim, 0.6)); P.box(x0 + 1, y + 1, w - 2, h - 2, trim);
  glowText(P, BIG, lbl, x0 + 12, y + 7, neon, trim, 2);
  // små stjärnor i hörnen
  for (const ox of [x0 + 4, x0 + w - 9]) ['..#..', '.###.', '#####', '.#.#.'].forEach((r, j) => { for (let i = 0; i < 5; i++) if (r[i] === '#') P.px(ox + i, y + 9 + j, 0xffd23f); });
}
function paintWindow(P, x, y, w, h) {
  P.rect(x - 2, y - 2, w + 4, h + 4, 0xf4f1ea); P.box(x - 2, y - 2, w + 4, h + 4, 0x8a8478);
  for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) {
    let c = mix(0x2a3a6a, 0x6a7aa8, (yy - y) / h);
    if (yy > y + h - 9) c = mix(0xd8e4f0, 0xf4f8fc, hash(xx >> 1, yy, 61)); // snö på marken därute
    else if (yy > y + h - 16 && hash((xx / 5) | 0, 0, 63) > 0.4 && yy > y + h - 9 - Math.round(hash((xx / 5) | 0, 1, 65) * 8)) c = 0x1e2a3a; // husen därborta
    P.px(xx, yy, c);
  }
  // upplysta fönster i husen därute
  for (let xx = x + 3; xx < x + w - 3; xx += 7) if (hash(xx, 9, 67) > 0.5) P.rect(xx, y + h - 13, 2, 2, 0xffd890);
  P.vl(x + Math.round(w / 2), y, h, 0xf4f1ea); P.hl(x, y + Math.round(h / 2), w, 0xf4f1ea);
  // snö på fönsterblecket
  P.rect(x - 3, y + h + 2, w + 6, 3, 0xf4f8fc); P.hl(x - 3, y + h + 4, w + 6, 0xb8c4d0);
}
// ================= fristående bilder =================
// Stora granen på torget: ~44 × 96, foten (krukans underkant) på sista raden. Ljusen ritas levande.
export const GRAN_W = 64, GRAN_H = 100;
export const GRAN_LIGHTS = [];
export function granImg() {
  const P = new Pix(GRAN_W, GRAN_H), cx = GRAN_W / 2;
  // fyra våningar barr, varje lite bredare nedåt, med mörk kontur och ljusa toppar
  const tiers = [[10, 26, 10], [22, 44, 18], [36, 64, 25], [52, 84, 31]];
  for (const [y0, y1, half] of tiers) {
    for (let y = y0; y < y1; y++) {
      const t = (y - y0) / (y1 - y0), w = Math.round(3 + (half - 3) * t);
      for (let x = -w; x <= w; x++) {
        const edge = Math.abs(x) >= w - 1 || y === y1 - 1;
        let c = edge ? 0x07232e : x < 0 ? 0x058567 : 0x006655;
        if (!edge && hash(x + 40, y, 5) > 0.82) c = 0x08a67e;
        if (!edge && ((x + y * 2 + 80) % 7 === 0) && x < w - 3) c = 0x0f444d;
        // hängande grenspetsar längs underkanten
        if (y === y1 - 1 && (x + 64) % 4 === 0) c = 0x006655;
        P.px(cx + x, y, c);
      }
    }
    // spetsarna som hänger ner
    for (let x = -half; x <= half; x += 4) { P.px(cx + x, y1, 0x07232e); P.px(cx + x + 1, y1, 0x006655); }
  }
  // stjärnan i toppen
  ['....#....', '...###...', '#########', '.#######.', '..#####..', '.##...##.', '.#.....#.'].forEach((r, j) => {
    for (let i = 0; i < 9; i++) if (r[i] === '#') P.px(cx - 4 + i, 2 + j, j < 3 ? 0xffeb47 : 0xffc71b);
  });
  P.px(cx, 1, 0xfff4c8);
  // kulorna (fasta, röda och guld)
  const KUL = [[cx - 6, 20], [cx + 5, 24], [cx - 12, 38], [cx + 10, 36], [cx - 2, 46], [cx - 18, 56], [cx + 16, 58], [cx + 4, 62], [cx - 10, 70], [cx + 22, 76], [cx - 24, 78], [cx + 8, 78], [cx - 4, 82]];
  KUL.forEach(([x, y], i) => {
    const [d, m, h] = i % 2 ? [0x963e0c, 0xffc71b, 0xffeb47] : [0x5e0c0c, 0xc41b24, 0xf27e7b];
    P.rect(x, y, 3, 3, m); P.px(x, y, h); P.px(x + 2, y + 2, d); P.px(x + 1, y + 2, d); P.px(x + 1, y - 1, 0x1c0a18);
  });
  // stammen, krukan med röd duk och paketen
  P.rect(cx - 3, 84, 7, 6, 0x4a2a14); P.vl(cx + 2, 84, 6, 0x2a1a0e);
  P.rect(cx - 12, 88, 25, 11, 0xc41b24); P.hl(cx - 12, 88, 25, 0xeb262e); P.hl(cx - 12, 98, 25, 0x5e0c0c); P.box(cx - 12, 88, 25, 11, 0x1c0a18);
  P.hl(cx - 12, 92, 25, 0xffc71b);
  const PKT = [[cx - 30, 89, 12, 10, 0x286ed0, 0xffc71b], [cx + 15, 87, 14, 12, 0x2c8d20, 0xeb262e], [cx - 22, 92, 9, 7, 0xffb0dd, 0xffffff], [cx + 27, 93, 8, 6, 0xffc71b, 0xc41b24]];
  for (const [x, y, w, h, c, band] of PKT) {
    P.rect(x, y, w, h, c); P.box(x, y, w, h, 0x1c0a18); P.hl(x + 1, y + 1, w - 2, mix(c, 0xffffff, 0.35));
    P.vl(x + Math.round(w / 2), y + 1, h - 2, band); P.hl(x + 1, y + Math.round(h / 2), w - 2, band);
    P.px(x + Math.round(w / 2) - 1, y - 1, band); P.px(x + Math.round(w / 2) + 1, y - 1, band);
  }
  return P.flush();
}
// ljusslingan i granen: punkter längs fyra spiraler (blinkar i tur och ordning)
for (const [y0, y1, half] of [[14, 26, 9], [26, 44, 17], [40, 64, 24], [56, 84, 30]]) {
  for (let i = 0; i < 9; i++) {
    const u = i / 8, y = Math.round(y0 + (y1 - y0) * u), w = Math.round(3 + (half - 4) * u);
    const x = Math.round(GRAN_W / 2 + Math.sin(u * Math.PI * 2.4 + y0) * w);
    GRAN_LIGHTS.push([x, y]);
  }
}
export function drawGranLights(ctx, x0, y0, t) {
  GRAN_LIGHTS.forEach(([x, y], i) => {
    const on = Math.floor(t * 2.2 + i * 0.37) % 3 !== 0;
    ctx.fillStyle = on ? LIGHT_COLS[i % LIGHT_COLS.length] : '#3a2a20';
    ctx.fillRect(x0 + x, y0 + y, 1, 1);
    if (on && (i + Math.floor(t * 2)) % 4 === 0) { ctx.globalAlpha = 0.35; ctx.fillRect(x0 + x - 1, y0 + y, 3, 1); ctx.fillRect(x0 + x, y0 + y - 1, 1, 3); ctx.globalAlpha = 1; }
  });
}
export function drawGarlandLights(ctx, t, x0, x1) {
  GARLAND_LIGHTS.forEach(([x, y], i) => {
    if (x < x0 - 2 || x > x1 + 2) return;
    const on = (Math.floor(t * 1.6) + i) % 2 === 0;
    ctx.fillStyle = on ? LIGHT_COLS[i % LIGHT_COLS.length] : '#2a2a30';
    ctx.fillRect(x, y, 2, 2);
    if (on) { ctx.globalAlpha = 0.25; ctx.fillRect(x - 1, y - 1, 4, 4); ctx.globalAlpha = 1; }
  });
}
// snön som faller utanför fönstren
export function drawSnow(ctx, t) {
  ctx.fillStyle = '#f4f8fc';
  for (const [x, y, w, h] of JUL_WIN) {
    for (let k = 0; k < Math.round(w / 4); k++) {
      const sx = x + ((k * 37 + Math.floor(Math.sin(t * 0.8 + k) * 2)) % w + w) % w;
      const sy = y + ((t * (9 + (k % 4) * 3) + k * 13) % (h - 8));
      ctx.fillRect(Math.round(sx), Math.round(sy), 1, 1);
    }
  }
}
// Sittstock vid brasan: 20 × 11, ljus ändyta med årsringar ovanpå, barksidor, foten på sista raden
export function stoolImg() {
  const P = new Pix(20, 11), cx = 10;
  for (let x = -8; x <= 8; x++) {
    const e = Math.round(Math.sqrt(1 - (x / 8.5) ** 2) * 3);
    for (let y = 3 + e; y <= 9 + Math.round(e * 0.5); y++) P.px(cx + x, y, mix(0x6a4228, 0x3e2412, (y - 3) / 8 + (hash(x, y, 71) - 0.5) * 0.25 + (x > 3 ? 0.15 : 0)));
    P.px(cx + x, 3 + e, 0x2a160a);
    for (let y = 3 - e; y < 3 + e; y++) P.px(cx + x, y, 0xd8b078);
    P.px(cx + x, 3 - e, 0x8a5a32);
  }
  for (let x = -5; x <= 5; x++) { const e = Math.round(Math.sqrt(1 - (x / 5.5) ** 2) * 2); P.px(cx + x, 3 - e, 0xb88a52); P.px(cx + x, 3 + e - 1, 0xb88a52); }
  P.px(cx, 3, 0x8a5a32); P.px(cx + 1, 3, 0x8a5a32);
  P.hl(cx - 7, 10, 15, 0x000000, 0.25);
  return P.flush();
}
// Lyktstolpe på torget: 12 × 48, en svart stolpe med en lykta som lyser och en röd rosett
export function lyktaImg() {
  const P = new Pix(12, 48), ink = 0x17151a;
  P.rect(5, 12, 2, 34, 0x2a2a32); P.vl(6, 12, 34, 0x4a4a54);
  P.rect(3, 44, 6, 4, ink); P.hl(3, 44, 6, 0x4a4a54);
  P.rect(1, 2, 10, 2, ink); P.hl(2, 1, 8, ink); P.px(5, 0, ink); P.px(6, 0, ink);
  P.rect(2, 4, 8, 7, 0xffe7a0); P.box(2, 4, 8, 7, ink); P.vl(5, 4, 7, ink); P.vl(6, 4, 7, ink);
  P.px(3, 5, 0xfff8e0); P.px(8, 5, 0xfff8e0);
  P.rect(2, 11, 8, 2, ink);
  P.rect(4, 15, 4, 3, 0xd9433b); P.px(3, 16, 0xd9433b); P.px(8, 16, 0xd9433b); P.px(4, 18, 0x8a1e26); P.px(7, 18, 0x8a1e26); P.px(5, 16, 0xff7a6b);
  for (let x = 1; x < 11; x++) P.px(x, 1, 0xf4f8fc); // snö på taket
  return P.flush();
}
// Kälken med julklappar: 34 × 18, medarna på sista raden
export function kalkeImg() {
  const P = new Pix(34, 18), ink = 0x1c0a18;
  // medarna (röda, uppsvängda framtill)
  P.hl(2, 16, 28, 0xc41b24); P.hl(2, 17, 28, ink); P.px(30, 15, 0xc41b24); P.px(31, 14, 0xc41b24); P.px(31, 13, ink); P.px(32, 14, ink);
  for (const x of [6, 14, 22]) P.vl(x, 13, 3, 0x8a1e26);
  // sitsen (trä)
  P.rect(2, 11, 28, 3, 0xc89a60); P.hl(2, 11, 28, 0xe0b878); P.hl(2, 13, 28, 0x8a5a32); P.box(1, 10, 30, 5, ink);
  // paketen
  for (const [x, y, w, h, c, band] of [[4, 2, 10, 9, 0x286ed0, 0xffc71b], [14, 4, 9, 7, 0xffb0dd, 0xc41b24], [22, 0, 8, 11, 0x2c8d20, 0xffc71b]]) {
    P.rect(x, y, w, h, c); P.box(x, y, w, h, ink); P.hl(x + 1, y + 1, w - 2, mix(c, 0xffffff, 0.35));
    P.vl(x + (w >> 1), y + 1, h - 2, band); P.hl(x + 1, y + (h >> 1), w - 2, band);
  }
  return P.flush();
}
// Kassadisken i julfärger med en julklappshög, KASSA-skärm och en skål pepparkakor
export function julDeskImg() {
  const { w, h } = JUL_DESK, P = new Pix(w, h), ink = 0x1d1822;
  P.rect(0, 8, w, 6, 0xe9e1d2); P.hl(0, 8, w, 0xfaf6ee); P.hl(0, 13, w, 0xb8ad98);
  P.rect(1, 14, w - 2, h - 15, 0x7a2a2e);
  for (let x = 3; x < w - 2; x += 6) P.vl(x, 15, h - 17, 0x5e1a1e);
  P.rect(1, 18, w - 2, 3, 0x2f8f46); P.hl(1, 18, w - 2, 0x6fd08a);
  for (let x = 4; x < w - 3; x += 8) P.px(x, 19, [0xffd23f, 0xd9433b, 0x3a7bd5][(x / 8 | 0) % 3]);
  P.hl(1, h - 2, w - 2, 0x3a1014);
  P.box(0, 8, w, h - 8, ink);
  P.rect(34, 0, 16, 9, 0x2a2a32); P.rect(35, 1, 14, 4, 0x6fe08a); P.hl(36, 2, 6, 0x1d5a2c); P.hl(36, 3, 9, 0x2f8f46);
  P.rect(33, 6, 18, 3, 0x3a3a44); P.hl(33, 6, 18, 0x5a5a64);
  // pepparkaksskålen
  P.rect(6, 5, 12, 3, 0xf4f1ea); P.hl(6, 4, 12, 0x1d1822); P.box(6, 4, 12, 4, 0x1d1822);
  for (const px of [8, 11, 14]) { P.px(px, 3, 0xc8702a); P.px(px + 1, 3, 0x963e0c); }
  // ett paket
  P.rect(20, 2, 8, 7, 0xc41b24); P.box(20, 2, 8, 7, 0x1c0a18); P.vl(24, 3, 5, 0xffc71b); P.hl(21, 5, 6, 0xffc71b);
  return P.flush();
}
// Bord för julpyntet: w × 16, bordsskivan i rad 0–3, benen ner till sista raden
export function julTableImg(w) {
  const P = new Pix(w, 18);
  P.rect(0, 0, w, 4, 0xf4f1ea); P.hl(0, 0, w, 0xffffff); P.hl(0, 3, w, 0xc8c0b0);
  // röd duk som hänger över kanten med uddar
  for (let x = 0; x < w; x++) { const d = 3 + ((x % 6) < 3 ? (x % 6) : 6 - (x % 6)); P.vl(x, 4, d, (x % 6) === 0 ? 0x8a1e26 : 0xc9323a); P.px(x, 4 + d, 0x5e0c0c); }
  for (const x of [2, w - 5]) { P.rect(x, 9, 3, 9, 0x6a4228); P.vl(x + 2, 9, 9, 0x4a2a14); }
  P.hl(1, 17, w - 2, 0x000000, 0.25);
  return P.flush();
}
