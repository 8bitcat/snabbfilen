// Pixelstadens bostäder och butiker: fasadkonst för hem, bostad, mat, klader, mobler.
// Kontrakt (map.js): BUILDING_ART[kind] = { paint(b, night) → canvas, live(ctx, b, st), glow(ctx, b, st) }
// Bilden är b.w + 16 bred och BASE + 4 hög, så canvasens y = världens y och
// canvas-x = världs-x − b.x + 8. Fasaden står på rad BASE; ovanför den syns taket
// (husets djup) bak till ungefär bakgatan. Allt målas en gång med Pix och cachas av
// scenen; live() ritar bara dörrar, rök och små lampor med färdiga delbilder.
import { Pix, SMALL, BIG, text, textW, eachTextPixel, mix, mul, hash, bayer } from '../core/floor-pix.js';
import { CITY, ART_OVER } from './map.js';
import { drawPerson } from '../core/people.js';
import { FRAMES } from '../data/frames.js';

const BASE = CITY.BASE, IMG_H = BASE + 4, O = ART_OVER, DOOR_H = 34;
const OUT = 0x221a26; // mörk kontur

// Möbelatlasen (skyltfönstren i Möbeljätten ritas först när den laddat)
const ATLAS = typeof Image !== 'undefined' ? new Image() : null;
if (ATLAS) ATLAS.src = 'assets/interior.png';

// Sådant som live()/glow() behöver veta om den målade bilden (per hus och dag/natt)
const META = {};
const metaOf = (b, night) => META[b.id + ':' + !!night];
const rgba = (c, a) => `rgba(${(c >> 16) & 255},${(c >> 8) & 255},${c & 255},${Math.max(0, Math.min(1, a)).toFixed(3)})`;

// ================= målarverktyg =================
const q = (t, x, y, n = 4) => Math.max(0, Math.min(n, Math.round(t * n + bayer(x, y) - 0.5))) / n;
// lodrät toning i n dithrade steg
function vgrad(P, x, y, w, h, c0, c1, n = 4) {
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) P.px(x + i, y + j, mix(c0, c1, q(h > 1 ? j / (h - 1) : 0, x + i, y + j, n)));
}
// kornig yta: grundfärg med ljusa och mörka korn
function grain(P, x, y, w, h, c, amt = 0.1, seed = 1) {
  const lo = mix(mul(c, 0.86), 0x2a2040, 0.05), hi = mix(c, 0xfff4e0, 0.12);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const n = hash(x + i, y + j, seed);
    P.px(x + i, y + j, n < amt ? lo : n > 1 - amt ? hi : c);
  }
}
// tegel: 5×2-stenar i förband med fogar
function bricks(P, x, y, w, h, c, seed = 3) {
  const mort = mix(mul(c, 0.5), 0x9a9088, 0.5);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const X = x + i, Y = y + j, row = Math.floor(Y / 3), off = (row & 1) * 3, col = Math.floor((X + off) / 6);
    const bx = (X + off) % 6, by = Y % 3;
    if (by === 2 || bx === 5) { P.px(X, Y, hash(X, Y, seed) > 0.8 ? mul(mort, 0.9) : mort); continue; }
    const v = hash(col, row, seed);
    let k = mul(c, 0.84 + v * 0.3);
    if (hash(col, row, seed + 1) > 0.88) k = mix(k, 0x5a2a22, 0.35);
    if (hash(col, row, seed + 2) > 0.93) k = mix(k, 0xd89070, 0.3);
    if (by === 0) k = mix(k, 0xffe8d0, 0.14);
    if (bx === 4) k = mul(k, 0.9);
    P.px(X, Y, k);
  }
}
// takpannor: rader om 4 px, pannor 6 px breda, förskjutna varannan rad
function tiles(P, x, y, w, h, c, seed = 5, dark = 1) {
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const X = x + i, Y = y + j, row = Math.floor(j / 4), by = j % 4, off = (row & 1) * 3;
    const col = Math.floor((i + off) / 6), bx = (i + off) % 6;
    let k = mul(c, (0.86 + hash(col, row, seed) * 0.24) * dark);
    if (hash(col, row, seed + 1) > 0.92) k = mix(k, 0x6a7a44, 0.3); // lite mossa
    if (by === 3) k = mix(mul(c, 0.4 * dark), 0x24121a, 0.35);
    else if (by === 0) k = mix(k, 0xffe0c0, 0.22);
    else if (bx === 0) k = mix(k, 0xffe8d0, 0.12);
    else if (bx >= 4) k = mul(k, bx === 5 ? 0.74 : 0.88);
    P.px(X, Y, k);
  }
}
// glasruta: himmelsreflex på dagen, tänd/släckt på natten
function glassPane(P, x, y, w, h, o = {}) {
  const s = o.seed || 0;
  let c0, c1;
  if (o.lit === 'tv') { c0 = 0xb8d8ff; c1 = 0x5a78c8; }
  else if (o.lit) { c0 = o.lit === 'warm2' ? 0xffd08a : 0xffeaa8; c1 = o.lit === 'warm2' ? 0xe08a3a : 0xf0a648; }
  else if (o.night) { c0 = 0x28324a; c1 = 0x141a2a; }
  else { c0 = o.sky || 0xa8cce2; c1 = o.deep || 0x3a5270; }
  vgrad(P, x, y, w, h, c0, c1, 4);
  // snedställda reflexstrimmor
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const d = (i + j * 1 + s * 7) % (o.streak || 13);
    if (d === 0 || d === 1) P.px(x + i, y + j, 0xffffff, o.lit ? 0.12 : o.night ? 0.06 : 0.3);
    else if (d === 3) P.px(x + i, y + j, 0xffffff, o.lit ? 0.06 : 0.12);
  }
  if (!o.lit) P.hl(x, y, w, 0xffffff, o.night ? 0.08 : 0.35);
}
// bostadsfönster med karm, spröjs, gardiner, fönsterbänk eller blomlåda
function homeWindow(P, x, y, w, h, o = {}) {
  const fr = o.frame ?? 0xeee8dc, frLo = mix(mul(fr, 0.7), 0x3a3050, 0.1);
  if (o.surround) {
    const s = o.surround;
    P.rect(x - 3, y - 3, w + 6, h + 4, s);
    P.hl(x - 3, y - 3, w + 6, mix(s, 0xffffff, 0.35)); P.vl(x - 3, y - 2, h + 3, mix(s, 0xffffff, 0.15));
    P.vl(x + w + 2, y - 2, h + 3, mul(s, 0.72));
    P.rect(x + (w >> 1) - 2, y - 4, 4, 3, mix(s, 0xffffff, 0.2)); P.hl(x + (w >> 1) - 2, y - 2, 4, mul(s, 0.8)); // slutsten
  }
  P.box(x - 1, y - 1, w + 2, h + 2, OUT);
  glassPane(P, x + 1, y + 1, w - 2, h - 2, o);
  const gx = x + 1, gy = y + 1, gw = w - 2, gh = h - 2;
  // gardiner (bakom spröjsen)
  if (o.curtain !== undefined && o.curtain !== null) {
    const cc = o.lit ? mix(o.curtain, 0xffe0a0, 0.35) : o.night ? mul(o.curtain, 0.45) : o.curtain;
    const cw = Math.max(2, Math.round(gw * 0.22));
    for (let j = 0; j < gh; j++) for (let i = 0; i < cw; i++) {
      const tie = j > gh * 0.55 ? Math.round((j - gh * 0.55) * 0.25) : 0; // uppknuten nedtill
      const f = (i % 2 === 0) ? mix(cc, 0xffffff, 0.18) : mul(cc, 0.8);
      if (i < cw - tie) { P.px(gx + i, gy + j, f); P.px(gx + gw - 1 - i, gy + j, i % 2 === 0 ? mul(cc, 0.86) : mul(cc, 0.72)); }
    }
    P.hl(gx, gy, gw, mul(cc, 0.8)); P.hl(gx, gy + 1, gw, cc); // kappa
    for (let i = 0; i < gw; i += 3) P.px(gx + i + 1, gy + 2, cc);
  }
  // lite av rummet innanför: krukväxt i fönstret eller taklampa
  if (!o.lit && !o.night && o.seed !== undefined) {
    const v = (o.seed * 7) % 5;
    if (v === 0 || v === 3) { const px0 = v === 0 ? gx + 2 : gx + gw - 5; P.rect(px0, gy + gh - 3, 3, 3, 0xb0603a); P.hl(px0, gy + gh - 3, 3, 0xd08050); P.rect(px0 - 1, gy + gh - 7, 5, 4, 0x3a7a34); P.px(px0 + 1, gy + gh - 8, 0x5a9a44); P.px(px0 - 1, gy + gh - 5, 0x5a9a44); }
    else if (v === 1) { P.vl(gx + (gw >> 1) + 2, gy, 3, 0x3a3440, 0.7); P.rect(gx + (gw >> 1) + 1, gy + 3, 3, 2, 0xf0d8a0, 0.8); }
  }
  // karm och spröjs
  P.box(x, y, w, h, fr);
  P.hl(x, y, w, mix(fr, 0xffffff, 0.5)); P.vl(x + w - 1, y + 1, h - 1, frLo); P.hl(x + 1, y + h - 1, w - 1, frLo);
  const mx = x + (w >> 1);
  if (!o.single) { P.vl(mx, y + 1, h - 2, fr); P.vl(mx + (w % 2 ? 0 : -1) + 1, y + 1, h - 2, frLo, 0.6); }
  const ty = y + Math.round(h * (o.transom ?? 0.3));
  if (o.transom !== false) { P.hl(x + 1, ty, w - 2, fr); P.hl(x + 1, ty + 1, w - 2, frLo, 0.5); }
  // handtag
  P.px(mx - 1, ty + ((h - (ty - y)) >> 1), 0xc8a44a); P.px(mx + 1, ty + ((h - (ty - y)) >> 1), 0xc8a44a);
  // bänk eller blomlåda
  if (o.flowers) flowerBox(P, x - 2, y + h + 1, w + 4, o.flowers, o.seed || 0);
  else if (o.sill !== false) {
    const st = o.sillCol || 0xd8d0c0;
    P.hl(x - 2, y + h + 1, w + 4, mix(st, 0xffffff, 0.3)); P.hl(x - 2, y + h + 2, w + 4, mul(st, 0.7));
    P.darken(x - 1, y + h + 3, w + 2, 1, 0.72);
  }
}
// blomlåda med pelargoner/penséer som hänger över kanten
function flowerBox(P, x, y, w, pal, seed) {
  const box = 0x8a5a36;
  for (let i = 0; i < w; i++) {
    const hgt = 2 + Math.floor(hash(x + i, seed, 41) * 3);
    for (let j = 1; j <= hgt; j++) P.px(x + i, y - j, (i + j) % 3 ? 0x3f7a34 : 0x5a9a3e);
    if (hash(x + i, seed, 42) > 0.55) { const c = pal[Math.floor(hash(x + i, seed, 43) * pal.length)]; P.px(x + i, y - hgt, c); if (hash(x + i, seed, 44) > 0.5) P.px(x + i, y - hgt + 1, mul(c, 0.8)); }
  }
  P.rect(x, y, w, 3, box); P.hl(x, y, w, 0xb07a4a); P.hl(x, y + 2, w, 0x5a3a24);
  for (let i = 3; i < w - 1; i += 5) P.px(x + i, y + 1, 0x6a4428);
  P.darken(x + 1, y + 3, w - 1, 2, 0.75);
}
// ljus skugga/kontaktskugga längs husfoten ute på trottoaren
function footShadow(P, x, w) {
  P.hl(x, BASE, w, 0x1a1422, 0.34); P.hl(x, BASE + 1, w, 0x1a1422, 0.18); P.hl(x + 1, BASE + 2, w - 2, 0x1a1422, 0.08);
}
// text med tonad fyllning (ljus upptill) och skugga
function signText(P, F, s, x, y, c, sc = 1, shadow = null, hi = null) {
  const hgt = F.h * sc;
  if (shadow !== null) eachTextPixel(F, s, x + 1, y + 1, sc, (px, py) => P.px(px, py, shadow));
  eachTextPixel(F, s, x, y, sc, (px, py) => {
    const t = (py - y) / hgt;
    P.px(px, py, t < 0.25 && hi !== null ? hi : t > 0.7 ? mul(c, 0.84) : c);
  });
}
// stuprör med fästen
function downpipe(P, x, y0, y1) {
  P.vl(x, y0, y1 - y0, 0x9aa0aa); P.vl(x + 1, y0, y1 - y0, 0x5a606c);
  for (let y = y0 + 6; y < y1 - 2; y += 14) { P.hl(x - 1, y, 4, 0x3a3e48); }
  P.rect(x - 1, y1 - 2, 4, 2, 0x7a808c); P.hl(x - 1, y1 - 2, 4, 0xb0b6c0);
}

// ================= dörrar =================
// Varje dörr får en kit: interiören bakom öppningen + dörrbladen/glaspartierna.
// Bladen ritas som färdiga canvasar – en per öppningsläge (vridna blad) eller
// beskurna (skjutdörrar) – så varje bildruta blir bara några drawImage.
const KITS = {};
const SWING_STEPS = 5;
function makeSwingKit(w, h, paintInside, paintLeaf) {
  const I = new Pix(w, h); paintInside(I, w, h);
  const L = new Pix(w, h); paintLeaf(L, w, h);
  L.flush();
  const leaves = [];
  for (let k = 0; k < SWING_STEPS; k++) {
    if (k === 0) { leaves.push(L.canvas); continue; }
    const S = new Pix(w, h), a = (k / (SWING_STEPS - 1)) * 1.35, pw = Math.max(3, Math.round(w * Math.cos(a)));
    const f = 1 - k * 0.1;
    for (let x = 0; x < pw; x++) {
      const sx = Math.min(w - 1, Math.floor(x * w / pw)), cut = Math.round((x / pw) * k * 0.9);
      for (let y = cut; y < h - Math.round(cut * 0.3); y++) {
        const i = (y * w + sx) * 4, al = L.d[i + 3] / 255;
        if (al <= 0) continue;
        S.px(x, y, mul((L.d[i] << 16) | (L.d[i + 1] << 8) | L.d[i + 2], f), al);
      }
    }
    // dörrens tjocklek (ljus kant) och slagskugga på golvet innanför
    S.vl(pw, Math.round(k * 0.9), h - Math.round(k * 0.9) - Math.round(k * 0.27), 0xd8cbb4);
    for (let x = pw + 1; x < Math.min(w, pw + 1 + k * 2); x++) S.px(x, h - 2, 0x000000, 0.25);
    leaves.push(S.flush());
  }
  return { type: 'swing', w, h, inside: I.flush(), leaves };
}
function makeSlideKit(w, h, paintInside, paintPanel) {
  const I = new Pix(w, h); paintInside(I, w, h);
  const half = w >> 1;
  const L = new Pix(half, h); paintPanel(L, half, h, 0);
  const R = new Pix(w - half, h); paintPanel(R, w - half, h, 1);
  return { type: 'slide', w, h, half, inside: I.flush(), pl: L.flush(), pr: R.flush() };
}
function drawDoor(ctx, b, st, kit) {
  const x0 = b.door.x0, top = BASE - kit.h, open = Math.max(0, Math.min(1, st.doorOpen || 0));
  ctx.drawImage(kit.inside, x0, top);
  if (kit.type === 'slide') {
    const g = Math.round(kit.half * 0.94 * open), lw = kit.half - g, rw = kit.w - kit.half - g;
    if (lw > 0) ctx.drawImage(kit.pl, g, 0, lw, kit.h, x0, top, lw, kit.h);
    if (rw > 0) ctx.drawImage(kit.pr, 0, 0, rw, kit.h, x0 + kit.half + g, top, rw, kit.h);
  } else {
    const k = Math.max(0, Math.min(SWING_STEPS - 1, Math.round(open * (SWING_STEPS - 1))));
    ctx.drawImage(kit.leaves[k], x0, top);
  }
}
// ljus golv/interiör bakom dörren (golv i perspektiv + bakvägg)
function paintInterior(P, w, h, o) {
  vgrad(P, 0, 0, w, h - 10, o.wall0, o.wall1, 4);
  for (let y = h - 10; y < h; y++) for (let x = 0; x < w; x++) {
    const tile = ((x + Math.floor((y - (h - 10)) * 0.5)) >> 2) + (y >> 1);
    P.px(x, y, mix(tile % 2 ? o.floor : mul(o.floor, 0.9), 0xffffff, (y - (h - 10)) / 30));
  }
  P.hl(0, h - 10, w, mul(o.wall1, 0.7));
  if (o.light !== false) { P.hl(2, 1, w - 4, 0xffffff); P.hl(3, 2, w - 6, 0xfff8e0, 0.5); }
}

// ================= reservfasad (om ett hus saknar egen konst) =================
function stubPaint(b, night) {
  const P = new Pix(b.w + O * 2, IMG_H), yT = BASE - b.h;
  grain(P, O, yT, b.w, b.h, night ? 0x5a5a60 : 0x8a8a90, 0.1, 9);
  const tw = textW(SMALL, b.sign);
  P.rect(O + (b.w - tw) / 2 - 3, yT + 8, tw + 6, 9, 0x17151a);
  text(P, SMALL, b.sign, O + (b.w - tw) / 2, yT + 10, 0xf4f1ea);
  return P.flush();
}
function stubLive(ctx, b, st) {
  const { x0, x1 } = b.door, top = BASE - DOOR_H;
  ctx.fillStyle = '#2e2418'; ctx.fillRect(x0, top, x1 - x0, DOOR_H);
  const gap = Math.round((x1 - x0) / 2 * st.doorOpen);
  ctx.fillStyle = '#5a4632';
  ctx.fillRect(x0 + 1, top + 1, ((x1 - x0) >> 1) - 1 - gap, DOOR_H - 1);
  ctx.fillRect(((x0 + x1) >> 1) + gap, top + 1, ((x1 - x0) >> 1) - 1 - gap, DOOR_H - 1);
}

// ================= gemensam glöd =================
// META.glows = [x, y, w, h, färg, styrka] i världskoordinater; ljusen från fönster,
// skyltar och ljuspölar. Dörrens ljus beror på hur öppen den är.
function glowFor(ctx, b, st) {
  const k = Math.min(1, (st.env?.dark || 0) * 2);
  if (k <= 0.02) return;
  const m = metaOf(b, st.night);
  if (!m) return;
  ctx.globalCompositeOperation = 'lighter';
  for (const [x, y, w, h, c, a] of m.glows) {
    ctx.fillStyle = rgba(c, a * k * 0.45); ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
    ctx.fillStyle = rgba(c, a * k); ctx.fillRect(x, y, w, h);
  }
  for (const [img, x, y, a] of m.imgs || []) { ctx.globalAlpha = Math.min(1, a * k); ctx.drawImage(img, x, y); }
  ctx.globalAlpha = 1;
  // ljuspöl på trottoaren framför dörren
  const open = st.doorOpen || 0, dc = m.doorLight || 0xffe0a0;
  const x0 = b.door.x0, dw = b.door.x1 - b.door.x0;
  ctx.fillStyle = rgba(dc, (0.12 + open * 0.4) * k); ctx.fillRect(x0, BASE - DOOR_H, dw, DOOR_H);
  for (let r = 0; r < 12; r++) {
    const sp = Math.round(r * 0.6);
    ctx.fillStyle = rgba(dc, (0.1 + open * 0.3) * k * (1 - r / 12));
    ctx.fillRect(x0 - sp, BASE + r, dw + sp * 2, 1);
  }
  ctx.globalCompositeOperation = 'source-over';
}

// glödbild av en text: kärna + 1 px halo, ritas med 'lighter' i glow()
function textGlow(F, s, sc, c, x, y) {
  const up = 2 * sc, w = textW(F, s, sc) + 4, h = F.h * sc + up + 4, on = new Uint8Array(w * h);
  eachTextPixel(F, s, 2, up + 2, sc, (px, py) => { if (px >= 0 && py >= 0 && px < w && py < h) on[py * w + px] = 1; });
  const G = new Pix(w, h), core = mix(c, 0xffffff, 0.35);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    if (on[j * w + i]) { G.px(i, j, core, 0.9); continue; }
    let n = 0;
    for (const [a, bb] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const ii = i + a, jj = j + bb; if (ii >= 0 && jj >= 0 && ii < w && jj < h && on[jj * w + ii]) n++; }
    if (n) G.px(i, j, c, 0.22 + n * 0.08);
  }
  return [G.flush(), x - 2, y - up - 2];
}

// tänt/släckt/TV-sken per fönster (deterministiskt)
const litOf = (night, a, c) => (night && hash(a, c, 77) < 0.72 ? (hash(a, c, 78) < 0.16 ? 'tv' : hash(a, c, 79) < 0.45 ? 'warm2' : true) : false);
const litCol = (lit) => (lit === 'tv' ? 0x8ab4ff : lit === 'warm2' ? 0xffb060 : 0xffd080);
const CURTAINS = [0xd8544a, 0xe8d8a8, 0x6a8ac8, 0xf0ece0, 0x8ac07a, 0xd89ac0, 0xe0b040];
const FLOWERS = [0xe83a4a, 0xf05a8a, 0xf8d040, 0xffffff, 0xb05ae0];

// ================= HEM – "PIXELGATAN 1" =================
function paintHem(b, night) {
  const W = b.w + O * 2, P = new Pix(W, IMG_H), L = O, R = O + b.w, yT = BASE - b.h;
  const glows = [], wx = (x) => x + b.x - O;
  // ---- sadeltak med takpannor, nock, takkupor och skorstenar ----
  const ridge = 22;
  tiles(P, L + 1, ridge - 9, b.w - 2, 7, 0x9a4232, 7, 0.6); // bortre takfallet i skugga
  P.hl(L + 1, ridge - 10, b.w - 2, 0x3a1a1c);
  tiles(P, L, ridge, b.w, yT - ridge, 0xb4553c, 5);
  for (let y = ridge; y < ridge + 6; y++) P.darken(L, y, b.w, 1, 0.8 + (y - ridge) * 0.035); // ljuset faller mot takfoten
  P.hl(L, ridge - 3, b.w, OUT);
  for (let x = L; x < R; x++) {
    const seg = (x - L) % 8;
    P.px(x, ridge - 2, seg === 0 ? 0x5a2420 : seg < 3 ? 0xe89070 : 0xd07a5a);
    P.px(x, ridge - 1, seg === 0 ? 0x4a1c1a : 0xa4482e); P.px(x, ridge, 0x5a2420);
  }
  // vindskivor i gavlarna
  P.vl(L, ridge - 10, yT - ridge + 10, OUT); P.vl(L + 1, ridge - 9, yT - ridge + 9, 0xece4d4); P.vl(L + 2, ridge - 8, yT - ridge + 8, 0xa89c88);
  P.vl(R - 1, ridge - 10, yT - ridge + 10, OUT); P.vl(R - 2, ridge - 9, yT - ridge + 9, 0xb8ae9c);
  // snörasskydd strax ovanför takfoten
  P.hl(L + 3, yT - 8, b.w - 6, 0x3a3e48); P.hl(L + 3, yT - 7, b.w - 6, 0x8a909a);
  for (let x = L + 6; x < R - 4; x += 12) { P.vl(x, yT - 8, 4, 0x2a2e36); P.px(x + 1, yT - 5, 0x6a3024); }
  // takkupor
  const dormer = (lx, i) => {
    const x = L + lx, w = 20, top = 31, bot = yT - 4, cx = x + (w >> 1);
    P.darken(x + w, top, 4, bot - top + 2, 0.72); // skugga på taket
    grain(P, x, top + 4, w, bot - top - 4, 0xe8dfcf, 0.12, 20 + i);
    P.vl(x, top + 4, bot - top - 4, 0xfff8ea); P.vl(x + w - 1, top + 4, bot - top - 4, 0xa89e8c);
    P.hl(x, bot - 1, w, 0x8a8070); P.hl(x - 1, bot, w + 2, 0x5a4e46);
    const lit = litOf(night, 90 + i, 1);
    homeWindow(P, x + 5, top + 8, 10, bot - top - 12, { lit, night, curtain: CURTAINS[(i + 3) % CURTAINS.length], sill: false, transom: 0.35, seed: i + 30 });
    if (lit) glows.push([wx(x + 6), top + 9, 8, bot - top - 14, litCol(lit), 0.32]);
    for (let r = 0; r < 10; r++) {
      const y = top - 5 + r, hw = r + 1;
      for (let dx = -hw; dx <= hw; dx++) {
        const ad = Math.abs(dx), c = ad >= hw - 1 ? (ad === hw ? 0x7a3226 : 0xc4654a) : ad === hw - 2 ? 0xf4ecdc : ((dx + 20) % 3 === 0 ? 0xc8bca6 : 0xe0d6c2);
        P.px(cx + dx, y, c);
      }
    }
    P.hl(cx - 10, top + 5, 21, 0x6a2a20); P.px(cx, top - 6, 0x5a2420);
  };
  dormer(18, 0); dormer(82, 1);
  // skorstenar med plåthuv, antenn och slagskugga
  const chimney = (lx, top, bot) => {
    const x = L + lx;
    P.darken(x + 9, top + 6, 4, bot - top - 2, 0.7);
    bricks(P, x, top + 3, 9, bot - top - 3, 0xa84a38, 12);
    P.vl(x, top + 3, bot - top - 3, 0xc8664e); P.vl(x + 8, top + 3, bot - top - 3, 0x6a2a22);
    P.rect(x - 1, top, 11, 3, 0x9a9ca4); P.hl(x - 1, top, 11, 0xd8dae0); P.hl(x - 1, top + 2, 11, 0x5a5c64);
    P.rect(x + 2, top, 2, 1, 0x1a1418); P.rect(x + 5, top, 2, 1, 0x1a1418);
    P.hl(x, top + 3, 9, 0x3a2622, 0.5);
  };
  chimney(8, 3, 26); chimney(102, 6, 24);
  // antenn på vänstra skorstenen
  P.vl(L + 12, -1 + 0, 3, 0x3a3e48); P.hl(L + 7, 0, 11, 0x4a4e58); P.hl(L + 9, 2, 7, 0x4a4e58);
  // hängränna
  P.hl(L - 1, yT - 3, b.w + 2, 0xd0d6de); P.hl(L - 1, yT - 2, b.w + 2, 0x9aa0aa); P.hl(L - 1, yT - 1, b.w + 2, 0x5a606c);

  // ---- fasad: tegel ovanför, rusticerad puts i bottenvåningen ----
  const gT = 146;
  bricks(P, L, yT + 8, b.w, gT - yT - 8, 0xae5a42, 4);
  // takfotslist med tandsnitt
  const corn = [0x5a4a44, 0xf2eadc, 0xd8cfbe, -1, 0xb0a694, 0xe2dacb, 0xc8bea8, 0x6a5e54];
  corn.forEach((c, j) => { if (c >= 0) P.hl(L, yT + j, b.w, c); else for (let x = L; x < R; x++) P.px(x, yT + j, (x >> 1) % 2 ? 0x8a8070 : 0xece4d4); });
  P.darken(L, yT + 8, b.w, 2, 0.8);
  // hörnkedjor (ljusa stenar i hörnen)
  for (let y = yT + 10; y < gT - 2; y += 8) for (const x of [L, R - 6]) {
    const ww = (y >> 3) % 2 ? 6 : 4, xx = x === L ? L : R - ww;
    P.rect(xx, y, ww, 6, 0xd8ccb4); P.hl(xx, y, ww, 0xf0e6d2); P.hl(xx, y + 5, ww, 0x9a8e7a);
  }
  // mellanbandet mellan våningarna
  P.hl(L, 100, b.w, 0xe6dccb); P.hl(L, 101, b.w, 0xb4a894); P.darken(L, 102, b.w, 1, 0.75);
  const cols = [10, 34, 72, 96];
  // våning 3: fönster med blomlådor
  cols.forEach((lx, i) => {
    const lit = litOf(night, i, 3);
    homeWindow(P, L + lx, 70, 14, 22, { lit, night, curtain: CURTAINS[(i * 2 + 1) % CURTAINS.length], surround: 0xd8ccb4, flowers: i === 0 || i === 3 ? FLOWERS : null, seed: i + 3 });
    if (lit) glows.push([wx(L + lx + 1), 71, 12, 20, litCol(lit), 0.3]);
  });
  // våning 2: fönster ytterst, balkongdörrar i mitten
  cols.forEach((lx, i) => {
    const bal = i === 1 || i === 2, lit = litOf(night, i, 2);
    const y = bal ? 106 : 110, h = bal ? 28 : 22;
    homeWindow(P, L + lx, y, 14, h, { lit, night, curtain: CURTAINS[(i * 3 + 2) % CURTAINS.length], surround: 0xd8ccb4, sill: !bal, transom: bal ? 0.22 : 0.3, flowers: !bal && i === 3 ? FLOWERS : null, seed: i + 13 });
    if (lit) glows.push([wx(L + lx + 1), y + 1, 12, h - 2, litCol(lit), 0.3]);
    if (bal) {
      const x = L + lx, yB = 134;
      P.rect(x - 4, yB, 22, 2, 0xd0c8b8); P.hl(x - 4, yB, 22, 0xf0eadc); P.hl(x - 4, yB + 1, 22, 0x9a9284);
      P.darken(x - 3, yB + 2, 20, 3, 0.62);
      for (const kx of [x - 3, x + 15]) { P.rect(kx, yB + 2, 2, 3, 0xb8ae9c); P.px(kx, yB + 4, 0x7a7266); }
      P.hl(x - 4, yB - 9, 22, 0x1e1e26); P.hl(x - 4, yB - 8, 22, 0x5a5a66);
      for (let k = 0; k < 22; k += 2) P.vl(x - 4 + k, yB - 7, 7, 0x2a2a34);
      P.hl(x - 4, yB - 3, 22, 0x3a3a46);
      for (let k = 1; k < 21; k += 4) { P.px(x - 4 + k, yB - 5, 0x2a2a34); P.px(x - 3 + k, yB - 6, 0x2a2a34); } // krusiduller
      // blomkruka på räcket
      const px0 = x + (i === 1 ? -3 : 11);
      P.rect(px0, yB - 12, 6, 3, 0xc0643a); P.hl(px0, yB - 12, 6, 0xe08a5a); P.hl(px0, yB - 10, 6, 0x7a3a22);
      for (let k = 0; k < 6; k++) { P.px(px0 + k, yB - 13 - (k % 2), 0x4a8a3a); if (k % 2) P.px(px0 + k, yB - 15, FLOWERS[(k + i) % FLOWERS.length]); }
      P.px(px0 + 2, yB - 14, 0x3a7a30);
    }
  });
  // bandet ovanför bottenvåningen
  P.hl(L, 142, b.w, 0xf0e8d8); P.hl(L, 143, b.w, 0xd0c6b2); P.hl(L, 144, b.w, 0xa89c88); P.darken(L, 145, b.w, 1, 0.7);
  // rusticerad puts
  for (let y = gT; y < 178; y++) for (let x = L; x < R; x++) {
    const band = (y - gT) % 6, jt = (x - L + (((y - gT) / 6 | 0) % 2) * 8) % 16;
    let c = mix(0xdccfb2, 0xcfc0a0, hash(x, y, 31) * 0.5 + (bayer(x, y) - 0.5) * 0.25);
    if (band === 5) c = 0x8a7c66; else if (band === 0) c = mix(c, 0xfff6e4, 0.35); else if (jt === 0) c = 0x9a8c74; else if (jt === 1) c = mix(c, 0xffffff, 0.2);
    P.px(x, y, c);
  }
  // sockel i granit med källarfönster
  for (let y = 178; y < BASE; y++) for (let x = L; x < R; x++) P.px(x, y, mix(0x6e6c6a, 0x8e8a86, hash(x, y, 32) * 0.8 + (bayer(x, y) - 0.5) * 0.3));
  P.hl(L, 178, b.w, 0xb8b4ac); P.hl(L, 179, b.w, 0x5a5856);
  for (const lx of [11, 97]) {
    P.rect(L + lx, 180, 12, 5, 0x1a1a20); P.box(L + lx - 1, 179, 14, 7, 0x3a3a40);
    for (let k = 2; k < 12; k += 3) P.vl(L + lx + k, 180, 5, 0x4a4a52);
  }
  // bottenvåningens fönster
  [10, 96].forEach((lx, i) => {
    const lit = litOf(night, i, 1);
    homeWindow(P, L + lx, 157, 14, 18, { lit, night, curtain: CURTAINS[(i + 5) % CURTAINS.length], surround: 0xe6dccb, seed: i + 23, flowers: i === 1 ? FLOWERS : null });
    if (lit) glows.push([wx(L + lx + 1), 158, 12, 16, litCol(lit), 0.3]);
  });
  // gatuskylt (blå emalj)
  P.rect(L + 1, 147, 43, 9, 0x1f4f9a); P.box(L + 1, 147, 43, 9, 0xeef2f8); P.box(L, 146, 45, 11, 0x2a2a34);
  text(P, SMALL, 'PIXELGATAN', L + 3, 149, 0xffffff);
  // portalen i sten med överljus och slutsten
  const dx0 = b.door.x0 - b.x + O, dx1 = b.door.x1 - b.x + O, dT = BASE - DOOR_H;
  P.rect(dx0 - 4, 143, dx1 - dx0 + 8, BASE - 143, 0xd6cab2);
  for (let y = 143; y < BASE; y++) for (let x = dx0 - 4; x < dx1 + 4; x++) if (hash(x, y, 33) > 0.86) P.px(x, y, 0xc4b89e);
  P.vl(dx0 - 4, 143, BASE - 143, 0xf0e6d2); P.vl(dx1 + 3, 143, BASE - 143, 0x8a7e6a);
  for (let y = 149; y < BASE; y += 7) { P.hl(dx0 - 4, y, 4, 0x9a8e78); P.hl(dx1, y, 4, 0x9a8e78); }
  // överljus (halvcirkel med strålar)
  const fx = (dx0 + dx1) >> 1;
  P.rect(dx0, dT - 8, dx1 - dx0, 8, 0x2a2230);
  for (let y = dT - 7; y < dT - 1; y++) for (let x = dx0 + 1; x < dx1 - 1; x++) {
    const ddx = (x + 0.5 - fx) / 11, ddy = (y + 0.5 - (dT - 1)) / 7;
    if (ddx * ddx + ddy * ddy > 1) continue;
    const ray = Math.round(Math.atan2(-ddy, ddx) / Math.PI * 6);
    const onRay = Math.abs(Math.atan2(-ddy, ddx) / Math.PI * 6 - ray) < 0.18;
    P.px(x, y, onRay ? 0xe8e0d0 : night ? 0xffd88a : mix(0xb8d4e4, 0x5a7890, (y - dT + 7) / 7));
  }
  P.hl(dx0, dT - 1, dx1 - dx0, 0xe8e0d0);
  if (night) glows.push([wx(dx0 + 2), dT - 6, dx1 - dx0 - 4, 5, 0xffd080, 0.35]);
  P.rect(fx - 2, 141, 5, 6, 0xe8dcc4); P.hl(fx - 2, 141, 5, 0xfff6e6); P.vl(fx + 2, 142, 5, 0x9a8e78);
  // karmen runt dörröppningen
  P.rect(dx0 - 1, dT - 1, dx1 - dx0 + 2, DOOR_H + 1, OUT);
  // lykta vid porten
  const lx0 = dx0 - 9;
  P.hl(lx0 + 2, 160, 4, 0x2a2a30); P.px(lx0 + 5, 159, 0x2a2a30); P.px(lx0 + 5, 161, 0x2a2a30);
  P.rect(lx0, 162, 5, 7, 0x2a2a30); P.rect(lx0 + 1, 163, 3, 5, night ? 0xffe8a0 : 0xd8e0e0); P.px(lx0 + 1, 163, 0xffffff);
  P.hl(lx0 - 1, 162, 7, 0x3a3a44); P.hl(lx0, 161, 5, 0x4a4a54); P.px(lx0 + 2, 169, 0x2a2a30);
  glows.push([wx(lx0), 162, 5, 7, 0xffd890, 0.7]);
  // husnummer och porttelefon
  const nx = dx1 + 6;
  P.rect(nx, 150, 8, 9, 0x1f4f9a); P.box(nx, 150, 8, 9, 0xeef2f8); P.box(nx - 1, 149, 10, 11, 0x2a2a34);
  text(P, SMALL, '1', nx + 3, 152, 0xffffff);
  P.rect(nx, 163, 7, 12, 0xb4b8c2); P.bevel(nx, 163, 7, 12, 0xe8ecf2, 0x5a5e68);
  for (let k = 0; k < 3; k++) for (let m = 0; m < 2; m++) P.px(nx + 2 + m * 2, 165 + k, 0x3a3e48);
  for (let k = 0; k < 3; k++) { P.hl(nx + 2, 169 + k * 2, 3, 0x2a2e38); P.px(nx + 1, 169 + k * 2, 0xf0f4fa); }
  P.px(nx + 5, 164, 0x3ac05a);
  glows.push([wx(nx + 5), 164, 1, 1, 0x60ff80, 0.8]);
  // stuprör
  downpipe(P, R - 4, yT - 1, BASE);
  // trappsteg ut mot trottoaren
  P.rect(dx0 - 3, BASE - 1, dx1 - dx0 + 6, 1, 0x9a948a);
  P.rect(dx0 - 5, BASE, dx1 - dx0 + 10, 2, 0xcac4b8); P.hl(dx0 - 5, BASE, dx1 - dx0 + 10, 0xeae4d8);
  P.rect(dx0 - 5, BASE + 2, dx1 - dx0 + 10, 2, 0x86807a); P.hl(dx0 - 5, BASE + 3, dx1 - dx0 + 10, 0x5e5854);
  footShadow(P, L, dx0 - 5 - L); footShadow(P, dx1 + 5, R - dx1 - 5);
  META[b.id + ':' + !!night] = { glows, doorLight: 0xffd890 };
  return P.flush();
}
function hemKit(b) {
  const w = b.door.x1 - b.door.x0;
  return makeSwingKit(w, DOOR_H, (I) => {
    paintInterior(I, w, DOOR_H, { wall0: 0xf2e4c2, wall1: 0xd4bf94, floor: 0xa89070 });
    // trappan upp till höger + ledstång
    for (let s = 0; s < 7; s++) {
      const x = w - 3 - s * 3, y = DOOR_H - 11 - s * 3;
      I.rect(x - 8, y, 11, 3, 0xb89a74); I.hl(x - 8, y, 11, 0xe0c8a0); I.hl(x - 8, y + 2, 11, 0x7a6048);
    }
    I.line(w - 2, DOOR_H - 18, w - 22, DOOR_H - 34, 0x5a3a24);
    // postboxar
    for (let r = 0; r < 2; r++) for (let c = 0; c < 2; c++) { I.rect(2 + c * 5, 11 + r * 4, 4, 3, 0x8a8e98); I.hl(2 + c * 5, 11 + r * 4, 4, 0xc8ccd4); I.px(3 + c * 5, 12 + r * 4, 0x2a2e38); }
    I.rect((w >> 1) - 2, 3, 4, 2, 0xfff4c8);
  }, (P, w, h) => {
    const c = 0x2f5a44;
    vgrad(P, 0, 0, w, h, mix(c, 0xffffff, 0.1), mul(c, 0.78), 3);
    P.box(0, 0, w, h, OUT); P.vl(1, 1, h - 2, mix(c, 0xffffff, 0.3)); P.vl(w - 2, 1, h - 2, mul(c, 0.6));
    P.box(3, 3, w - 6, 12, mul(c, 0.5));
    glassPane(P, 4, 4, w - 8, 10, { sky: 0xe8dcb8, deep: 0x8a7a58, streak: 9 });
    P.vl(w >> 1, 4, 10, mul(c, 0.7)); P.hl(4, 9, w - 8, mul(c, 0.7));
    P.bevel(4, 18, w - 8, h - 25, mix(c, 0xffffff, 0.25), mul(c, 0.5));
    P.bevel(6, 20, w - 12, h - 29, mul(c, 0.55), mix(c, 0xffffff, 0.18));
    P.rect(w - 6, 16, 3, 1, 0xf0d070); P.px(w - 6, 17, 0x9a7a30); P.px(w - 5, 18, 0x2a1a10);
    P.rect(1, h - 4, w - 2, 3, 0xc8a44a); P.hl(1, h - 4, w - 2, 0xf4dc94); P.hl(1, h - 2, w - 2, 0x7a5a24);
  });
}
function liveHem(ctx, b, st) {
  const kit = KITS[b.id] || (KITS[b.id] = hemKit(b));
  drawDoor(ctx, b, st, kit);
  // rök ur skorstenarna
  const t = st.t || 0;
  for (const [cx, cy, s] of [[b.x + 10, 1, 0], [b.x + 104, 4, 3]]) for (let i = 0; i < 4; i++) {
    const ph = (t * 0.28 + i / 4 + s * 0.1) % 1, sz = 2 + Math.round(ph * 3);
    const x = Math.round(cx + ph * 9 + Math.sin(t * 1.3 + i * 2 + s) * 1.5), y = Math.round(cy - ph * 16);
    ctx.fillStyle = rgba(st.night ? 0x8a8ea0 : 0xe8e8ec, 0.4 * (1 - ph));
    ctx.fillRect(x, y, sz, sz - 1);
  }
}

// ================= platta tak och takdetaljer =================
// takpapp med grus och våder, sarg runt om, plåtavtäckt bröstning mot gatan
function flatRoof(P, x, w, top, eave, o = {}) {
  const c = o.col || 0x6e6a66;
  for (let y = top; y < eave; y++) for (let i = 0; i < w; i++) {
    const X = x + i, t = (y - top) / Math.max(1, eave - top);
    let k = mix(mul(c, 0.8), c, q(t, X, y, 3));
    const n = hash(X, y, 51);
    if (n > 0.9) k = mix(k, 0xd8d0c4, 0.3); else if (n < 0.08) k = mul(k, 0.76);
    if ((y - top) % 12 === 11) k = mul(k, 0.86);
    P.px(X, y, k);
  }
  P.hl(x, top, w, OUT); P.hl(x + 1, top + 1, w - 2, mix(c, 0xffffff, 0.35)); P.hl(x + 2, top + 2, w - 4, mul(c, 0.66));
  P.vl(x, top, eave - top, OUT); P.vl(x + 1, top + 1, eave - top - 1, mix(c, 0xffffff, 0.3)); P.vl(x + 2, top + 3, eave - top - 3, mul(c, 0.7));
  P.vl(x + w - 1, top, eave - top, OUT); P.vl(x + w - 2, top + 1, eave - top - 1, mul(c, 0.6));
  const pc = o.coping || 0xb8bcc4;
  P.darken(x + 2, eave - 6, w - 4, 3, 0.78);
  P.hl(x, eave - 3, w, OUT); P.hl(x, eave - 2, w, mix(pc, 0xffffff, 0.45)); P.hl(x, eave - 1, w, mul(pc, 0.72));
}
// räcke längs takkanten (y = räckets fot)
function railing(P, x, w, y, h = 6, c = 0x9aa0aa) {
  P.hl(x, y - h, w, mix(c, 0xffffff, 0.35)); P.hl(x, y - h + 1, w, mul(c, 0.55));
  P.hl(x, y - (h >> 1), w, mul(c, 0.8));
  for (let i = 0; i < w; i += 8) { P.vl(x + i, y - h, h, mul(c, 0.5)); P.vl(x + i + 1, y - h + 2, h - 2, mix(c, 0xffffff, 0.2)); }
  P.vl(x + w - 1, y - h, h, mul(c, 0.5));
}
// ventilationsaggregat: lådan syns uppifrån (d rader) och framifrån (hg rader)
function hvac(P, x, y, w, d, hg, o = {}) {
  const c = o.col || 0xc8ccd2;
  P.darken(x + w, y + 3, 3, d + hg - 2, 0.66); P.darken(x + 2, y + d + hg, w, 2, 0.62);
  for (let j = 0; j < d; j++) for (let i = 0; i < w; i++) P.px(x + i, y + j, mix(mix(c, 0xffffff, 0.3), c, q(j / d, x + i, y + j, 2)));
  for (let j = 0; j < hg; j++) for (let i = 0; i < w; i++) P.px(x + i, y + d + j, j % 2 ? mul(c, 0.62) : mul(c, 0.84));
  P.box(x, y, w, d + hg, OUT); P.hl(x + 1, y + d, w - 2, mix(c, 0xffffff, 0.5));
  P.vl(x + w - 2, y + d + 1, hg - 2, mul(c, 0.5));
  if (o.fans) for (let f = 0; f < o.fans; f++) {
    const cx = x + Math.round((f + 0.5) * w / o.fans), cy = y + (d >> 1), rx = Math.min(4, Math.floor(w / o.fans / 2) - 1), ry = Math.max(1, (d >> 1) - 1);
    for (let yy = -ry; yy <= ry; yy++) for (let xx = -rx; xx <= rx; xx++) {
      const e = (xx * xx) / (rx * rx) + (yy * yy) / (ry * ry);
      if (e <= 1) P.px(cx + xx, cy + yy, e > 0.6 ? 0x5a5e68 : (xx + yy) % 2 ? 0x2a2e36 : 0x4a4e58);
    }
    P.px(cx, cy, 0x9aa0aa);
  }
  if (o.pipe) { P.rect(x + w - 4, y - 5, 3, 6, mul(c, 0.8)); P.vl(x + w - 4, y - 5, 6, mix(c, 0xffffff, 0.4)); P.hl(x + w - 5, y - 6, 5, mul(c, 0.6)); }
}
// ventilationshuv/rör
function ventPipe(P, x, y, hg, c = 0xa8aeb8) {
  P.darken(x + 3, y + 2, 2, hg, 0.7);
  P.rect(x, y, 3, hg, c); P.vl(x, y, hg, mix(c, 0xffffff, 0.4)); P.vl(x + 2, y, hg, mul(c, 0.6));
  P.rect(x - 1, y - 2, 5, 2, mul(c, 0.8)); P.hl(x - 1, y - 2, 5, mix(c, 0xffffff, 0.5));
}
// takfönster (kupol) med reflex
function skylight(P, x, y, w, d) {
  P.darken(x + w, y + 2, 2, d, 0.7);
  P.rect(x, y, w, d, 0x8a8e98); P.box(x, y, w, d, OUT);
  for (let j = 1; j < d - 1; j++) for (let i = 1; i < w - 1; i++) {
    const t = Math.hypot((i - w / 2) / (w / 2), (j - d / 2) / (d / 2));
    P.px(x + i, y + j, mix(0xe8f4ff, 0x6a8aa8, Math.min(1, q(t, x + i, y + j, 3) + 0.1)));
  }
  P.px(x + 2, y + 1, 0xffffff); P.px(x + 3, y + 1, 0xffffff); P.px(x + 2, y + 2, 0xffffff);
}
// markis: randig duk som lutar ut mot gatan, våglist och armar
function awning(P, x, y, w, h, c1, c2, o = {}) {
  const sw = o.stripe || 4, drop = o.drop ?? 3, ext = o.ext ?? 2;
  P.darken(x + 1, y + h + drop, w - 2, 3, 0.66); P.darken(x + 2, y + h + drop + 3, w - 4, 2, 0.84);
  const stripeOf = (i) => ((Math.floor((i + 400) / sw) & 1) ? c2 : c1);
  for (let j = 0; j < h; j++) {
    const e = Math.round((j / h) * ext);
    for (let i = -e; i < w + e; i++) {
      const s = stripeOf(i), X = x + i, Y = y + j;
      let k = mix(mix(s, 0xfff8e8, 0.2), mul(s, 0.76), q(j / h, X, Y, 3));
      if (j === 0) k = mul(s, 0.55);
      if ((i + 400) % sw === 0 && j > 0) k = mul(k, 0.92);
      P.px(X, Y, k);
    }
  }
  for (let j = 0; j < drop; j++) for (let i = -ext; i < w + ext; i++) {
    const seg = (i + ext + 400) % sw;
    if (j === drop - 1 && (seg === 0 || seg === sw - 1)) continue;
    const s = stripeOf(i);
    P.px(x + i, y + h + j, j === 0 ? mix(s, 0xffffff, 0.1) : mul(s, 0.8 - j * 0.06));
  }
  P.hl(x - ext, y + h, w + ext * 2, 0x000000, 0.18);
  if (o.arms !== false) for (const ax of [x + 2, x + w - 3]) P.line(ax, y + h + drop + 5, ax + (ax < x + w / 2 ? -1 : 1), y + h - 1, 0x3a3a44);
  if (o.text) {
    const tw = textW(SMALL, o.text), tx = x + ((w - tw) >> 1);
    P.rect(tx - 2, y + h, tw + 4, drop, o.textBg ?? c1);
    text(P, SMALL, o.text, tx, y + h - 1 + Math.max(0, drop - 5), o.textCol ?? 0xffffff);
  }
}

// ================= BOSTAD – "BOSTADSBYRÅN" =================
// bostadsannons: kort med ett litet hus, pris och byråns färgrand
function adCard(P, x, y, i, night) {
  const W = 13, H = 14, paper = night ? 0xfff4d8 : 0xf8f6f0;
  P.rect(x, y, W, H, paper); P.box(x, y, W, H, 0xb8b4ac); P.hl(x + 1, y + H, W - 1, 0x000000, 0.25);
  const sky = [0x9ad0f0, 0xb8e0f8, 0xf0c890][i % 3], wall = [0xe8c050, 0xc84a3a, 0x6a9ad0, 0xf0ece0, 0x7ab070][i % 5], roof = [0x5a3a2a, 0x3a3a48, 0x8a2a24][i % 3];
  P.rect(x + 1, y + 1, W - 2, 7, sky);
  P.hl(x + 1, y + 7, W - 2, 0x5a9a4a);
  const hx = x + 3 + (i % 2), hy = y + 3;
  P.rect(hx, hy + 2, 6, 3, wall); P.hl(hx - 1, hy + 1, 8, roof); P.hl(hx, hy, 6, roof); P.hl(hx + 1, hy - 1, 4, roof);
  P.px(hx + 1, hy + 3, 0x2a3a5a); P.px(hx + 4, hy + 3, 0xfff0a0); P.px(hx + 3, hy + 4, 0x5a3a24);
  if (i % 3 === 1) P.rect(x + 10, y + 3, 1, 4, 0x3a7a3a), P.px(x + 10, y + 2, 0x5aaa4a), P.px(x + 9, y + 3, 0x5aaa4a);
  const price = ['2,4', '1,9', '3,6', '4,2', '995', '5,1', '2,8', '7,5'][i % 8];
  text(P, SMALL, price, x + 2, y + 8, 0x2a2a34);
  P.px(x + W - 2, y + 12, 0x2a2a34);
  P.hl(x + 1, y + H - 1, W - 2, 0x1f3a6a);
  if (i === 5) for (let k = 0; k < 5; k++) P.hl(x + W - 5 + k, y + k, 5 - k, 0xd8323a); // såld-hörn
}
function paintBostad(b, night) {
  const W = b.w + O * 2, P = new Pix(W, IMG_H), L = O, R = O + b.w, yT = BASE - b.h;
  const glows = [], wx = (x) => x + b.x - O;
  const navy = 0x1f2d48, gold = 0xd8b45a, stone = 0xe6dac4;
  // ---- platt tak med aggregat, takfönster och parabol ----
  flatRoof(P, L, b.w, 36, yT, { col: 0x6c6872 });
  hvac(P, L + 8, 46, 20, 9, 7, { fans: 2 });
  skylight(P, L + 48, 52, 16, 9);
  ventPipe(P, L + 36, 58, 7); ventPipe(P, L + 70, 44, 6);
  P.rect(L + 32, 42, 10, 7, 0x8a8690); P.box(L + 32, 42, 10, 7, OUT); P.hl(L + 33, 43, 8, 0xb8b4be); P.darken(L + 42, 44, 2, 6, 0.7); // takluckan
  // mast med parabol
  P.vl(L + 84, 38, 30, 0x5a5e68); P.vl(L + 85, 38, 30, 0x9aa0aa); P.darken(L + 86, 60, 3, 9, 0.7);
  for (let yy = -4; yy <= 4; yy++) for (let xx = -3; xx <= 3; xx++) if (xx * xx / 9 + yy * yy / 16 <= 1) P.px(L + 80 + xx, 48 + yy, xx < -1 ? 0xf0f0f4 : xx > 1 ? 0xa8acb4 : 0xd8dce2);
  P.line(L + 80, 48, L + 84, 46, 0x3a3e48); P.px(L + 84, 46, 0x2a2e36);
  // ---- fasad: ljus sten ovanför, marinblå butiksfront nedtill ----
  grain(P, L, yT, b.w, 128 - yT, stone, 0.1, 61);
  const corn = [0x6a5e54, 0xf6eee0, 0xdcd2c0, -1, 0xbcb09c, 0xece4d4, 0x8a7e6c];
  corn.forEach((c, j) => { if (c >= 0) P.hl(L, yT + j, b.w, c); else for (let x = L; x < R; x++) P.px(x, yT + j, (x >> 1) % 2 ? 0x9a8e7c : 0xf4ecdc); });
  P.darken(L, yT + 7, b.w, 2, 0.84);
  // pilastrar
  for (const px0 of [L, L + 30, L + 62, R - 4]) {
    P.rect(px0, yT + 8, 4, 128 - yT - 8, 0xf0e6d4); P.vl(px0, yT + 8, 128 - yT - 8, 0xfff8ec); P.vl(px0 + 3, yT + 8, 128 - yT - 8, 0xb8ac98);
    P.hl(px0 - 1, yT + 9, 6, 0xd8ccb8);
  }
  [[8, 0], [39, 1], [70, 2]].forEach(([lx, i]) => {
    const lit = litOf(night, i + 20, 4) || (night && i === 1 ? true : false);
    homeWindow(P, L + lx, 98, 18, 22, { lit, night, frame: 0xf4f0e8, surround: 0xd8ccb4, curtain: i === 1 ? 0xe8dcc0 : null, transom: 0.3, seed: i + 40, sill: false });
    if (lit) glows.push([wx(L + lx + 1), 99, 16, 20, litCol(lit), 0.28]);
    // fransk balkong
    const x = L + lx - 1, y = 116;
    P.hl(x, y, 20, 0x1e1e26); P.hl(x, y + 5, 20, 0x1e1e26);
    for (let k = 1; k < 20; k += 2) P.vl(x + k, y + 1, 4, 0x3a3a46);
    P.hl(x - 1, y + 6, 22, 0xcfc4b0); P.hl(x - 1, y + 7, 22, 0x8a806e);
  });
  // band + skyltfält
  P.hl(L, 124, b.w, 0xf6eee2); P.hl(L, 125, b.w, 0xc8bca8); P.hl(L, 126, b.w, 0x8a7e6c); P.darken(L, 127, b.w, 1, 0.7);
  for (let y = 128; y < 141; y++) for (let x = L; x < R; x++) P.px(x, y, mix(navy, 0x2c3e62, q((y - 128) / 12, x, y, 3)));
  P.hl(L, 128, b.w, gold); P.hl(L, 129, b.w, 0x8a6a2a); P.hl(L, 139, b.w, 0x8a6a2a); P.hl(L, 140, b.w, gold);
  const label = 'BOSTADSBYRÅN', tw = textW(BIG, label), kx = L + ((b.w - tw - 12) >> 1), tx = kx + 12;
  signText(P, BIG, label, tx, 131, gold, 1, 0x0e1424, 0xfff0b0);
  // nyckel-loggan
  const ky = 131;
  for (let yy = 0; yy < 7; yy++) for (let xx = 0; xx < 5; xx++) {
    const e = Math.hypot(xx - 2, yy - 3);
    if (e <= 2.6 && e >= 1.2) P.px(kx + xx, ky + yy, yy < 3 ? 0xfff0b0 : gold);
  }
  P.hl(kx + 5, ky + 3, 5, gold); P.hl(kx + 5, ky + 4, 5, 0x8a6a2a); P.vl(kx + 8, ky + 5, 2, gold); P.vl(kx + 6, ky + 5, 1, gold);
  const imgs = [[...textGlow(BIG, label, 1, 0xffc850, wx(tx), 131), 0.7]];
  // spotlampor över skylten
  for (const sx of [L + 16, L + 48, L + 80]) { P.hl(sx - 1, 126, 3, 0x2a2a30); P.px(sx, 127, 0x3a3a44); P.rect(sx - 1, 128, 3, 1, night ? 0xfff0c0 : 0x4a4a54); }
  // markis
  awning(P, L - 2, 141, b.w + 4, 6, 0x2a5a48, 0xefe6d2, { stripe: 3, drop: 3, ext: 2 });
  // butiksfronten
  for (let y = 150; y < BASE; y++) for (let x = L; x < R; x++) P.px(x, y, mix(navy, 0x2a3a5a, hash(x, y, 62) * 0.3 + (bayer(x, y) - 0.5) * 0.2));
  for (const px0 of [L, L + 32, L + 62, R - 3]) { P.vl(px0, 150, 36, 0x3a4c70); P.vl(px0 + 2, 150, 36, 0x121a2c); P.px(px0 + 1, 150, gold); P.px(px0 + 1, 151, gold); }
  // skyltfönstren med annonser på trådar
  let card = 0;
  for (const wx0 of [L + 3, L + 63]) {
    const wy = 151, ww = 29, wh = 29;
    P.rect(wx0 - 1, wy - 1, ww + 2, wh + 2, OUT);
    for (let y = wy; y < wy + wh; y++) for (let x = wx0; x < wx0 + ww; x++) P.px(x, y, night ? mix(0xfff0d0, 0xe8c890, (y - wy) / wh) : mix(0x5a6a84, 0x2a3448, q((y - wy) / wh, x, y, 3)));
    P.hl(wx0, wy, ww, night ? 0xffffff : 0x8a9ab4);
    for (let r = 0; r < 2; r++) {
      P.hl(wx0, wy + 1 + r * 14, ww, 0x9aa0aa, 0.7);
      for (let c = 0; c < 2; c++) adCard(P, wx0 + 1 + c * 14, wy + 2 + r * 14, card++, night);
    }
    for (let y = wy; y < wy + wh; y++) for (let x = wx0; x < wx0 + ww; x++) { const d = (x - wx0 + y) % 17; if (d < 2) P.px(x, y, 0xffffff, night ? 0.08 : 0.22); }
    P.box(wx0 - 1, wy - 1, ww + 2, wh + 2, gold); P.hl(wx0 - 1, wy + wh, ww + 2, 0x8a6a2a);
    glows.push([wx(wx0), wy, ww, wh, 0xfff0c8, 0.3]);
  }
  // bröstningspaneler
  for (const wx0 of [L + 3, L + 63]) { P.bevel(wx0, 181, 29, 4, 0x3a4c70, 0x0e1424); P.hl(wx0 + 2, 183, 25, 0x16203a); }
  P.hl(L, BASE - 1, b.w, 0x0e1220);
  // karm + trappsten vid dörren
  const dx0 = b.door.x0 - b.x + O, dx1 = b.door.x1 - b.x + O, dT = BASE - DOOR_H;
  P.rect(dx0 - 2, dT - 2, dx1 - dx0 + 4, DOOR_H + 2, gold); P.rect(dx0 - 1, dT - 1, dx1 - dx0 + 2, DOOR_H + 1, OUT);
  P.hl(dx0 - 2, dT - 2, dx1 - dx0 + 4, 0xfff0b0);
  P.rect(dx0 - 3, BASE, dx1 - dx0 + 6, 2, 0xb8b0a4); P.hl(dx0 - 3, BASE, dx1 - dx0 + 6, 0xe0dace); P.hl(dx0 - 3, BASE + 2, dx1 - dx0 + 6, 0x6a6460);
  // utstickande skylt med nyckel
  P.hl(R - 2, 104, 9, 0x2a2a30); P.px(R + 6, 105, 0x2a2a30);
  P.rect(R, 106, 8, 10, navy); P.box(R, 106, 8, 10, gold); P.px(R + 3, 108, gold); P.px(R + 4, 108, gold); P.px(R + 2, 109, gold); P.px(R + 5, 109, gold);
  P.px(R + 3, 110, gold); P.px(R + 4, 110, gold); P.vl(R + 4, 111, 3, gold); P.px(R + 5, 112, gold);
  footShadow(P, L, dx0 - 3 - L); footShadow(P, dx1 + 3, R - dx1 - 3);
  downpipe(P, L + 1, yT - 1, 128);
  META[b.id + ':' + !!night] = { glows, imgs, doorLight: 0xfff0d0 };
  return P.flush();
}
function bostadKit(b) {
  const w = b.door.x1 - b.door.x0;
  return makeSwingKit(w, DOOR_H, (I) => {
    paintInterior(I, w, DOOR_H, { wall0: 0xf6f0e4, wall1: 0xdcd2c0, floor: 0xb89868 });
    I.rect(3, 12, 8, 6, 0x6a8ab0); I.box(3, 12, 8, 6, 0x3a3228); I.rect(4, 13, 6, 2, 0xf0d080); // tavla
    I.rect(4, 20, w - 6, 3, 0x8a5a36); I.hl(4, 20, w - 6, 0xb07a4a); I.vl(5, 23, 5, 0x5a3a24); I.vl(w - 4, 23, 5, 0x5a3a24); // skrivbord
    I.rect(12, 15, 7, 5, 0x2a2e38); I.rect(13, 16, 5, 3, 0x8ac0f0); I.px(15, 20, 0x2a2e38);
    I.rect(w - 6, 13, 4, 7, 0x3a8a44); I.px(w - 5, 12, 0x5aaa5a); I.rect(w - 6, 20, 4, 2, 0xc06a3a);
  }, (P, w, h) => {
    P.rect(0, 0, w, h, 0x14161e); P.box(0, 0, w, h, OUT);
    P.vl(1, 1, h - 2, 0x3a3e4c); P.vl(w - 2, 1, h - 2, 0x0a0a10);
    for (let y = 3; y < h - 6; y++) for (let x = 3; x < w - 3; x++) {
      const d = (x + y) % 11;
      P.px(x, y, d < 2 ? 0xd8e4f0 : mix(0xb8cad8, 0x6a7a90, (y - 3) / (h - 9)), d < 2 ? 0.55 : 0.4);
    }
    P.box(2, 2, w - 4, h - 7, 0xc8a44a);
    P.vl(w - 6, 12, 10, 0xf0d070); P.vl(w - 5, 12, 10, 0x8a6a2a);
    P.rect(1, h - 4, w - 2, 3, 0x2a2e3a); P.hl(1, h - 4, w - 2, 0x4a4e5a);
    P.rect(4, 8, 7, 3, 0xc8a44a); P.hl(4, 8, 7, 0xf0d890);
  });
}

// ================= MAT – varor, hyllor, affischer =================
// varor på en hylla: y = hyllplanets överkant, varorna står på den
const PACK = [0xd8323a, 0xf0b429, 0x3a7bd5, 0x46a35a, 0xe07a2e, 0x8e5bd1, 0xf4f1ea, 0x2aa39a];
function goods(P, x, y, w, kind, seed = 0) {
  let i = 0;
  for (let cx = x; cx < x + w; i++) {
    const r = hash(i, seed, 71), c = PACK[Math.floor(r * PACK.length)];
    if (kind === 'boxes') { // flingpaket
      const bw = 4, bh = 5 + (i % 2);
      if (cx + bw > x + w) break;
      P.rect(cx, y - bh, bw, bh, c); P.vl(cx, y - bh, bh, mix(c, 0xffffff, 0.35)); P.vl(cx + bw - 1, y - bh, bh, mul(c, 0.65));
      P.hl(cx + 1, y - bh + 2, bw - 2, 0xf8f4e8); P.px(cx + 1, y - bh + 3, mul(c, 0.5));
      cx += bw + (hash(i, seed, 72) > 0.8 ? 1 : 0);
    } else if (kind === 'cans') { // konservburkar
      if (cx + 3 > x + w) break;
      P.rect(cx, y - 4, 3, 4, c); P.hl(cx, y - 4, 3, 0xe0e4ea); P.px(cx, y - 3, mix(c, 0xffffff, 0.4)); P.px(cx + 2, y - 2, mul(c, 0.6)); P.hl(cx, y - 2, 3, 0xf4f1ea, 0.7);
      if (i % 3 === 0 && cx + 4 <= x + w) { P.rect(cx + 1, y - 8, 3, 4, c); P.hl(cx + 1, y - 8, 3, 0xe0e4ea); P.px(cx + 3, y - 6, mul(c, 0.6)); }
      cx += 3;
    } else if (kind === 'bottles') { // flaskor: gröna, bruna, klara, röda
      if (cx + 2 > x + w) break;
      const bc = [0x2a7a3a, 0x7a4a1a, 0xb8e0e8, 0xd84a3a][Math.floor(r * 4)];
      P.rect(cx, y - 5, 2, 5, bc); P.px(cx, y - 5, mix(bc, 0xffffff, 0.5)); P.px(cx, y - 6, bc); P.px(cx, y - 7, mul(bc, 0.7));
      P.px(cx + 1, y - 3, 0xf4f1ea); P.px(cx + 1, y - 1, mul(bc, 0.6));
      cx += 3;
    } else if (kind === 'milk') { // mjölkpaket med gavel
      if (cx + 4 > x + w) break;
      const mc = [0x3a7bd5, 0xd8323a, 0x46a35a, 0xf0b429][Math.floor(r * 4)];
      P.rect(cx, y - 6, 4, 6, 0xf6f6f2); P.hl(cx + 1, y - 7, 2, 0xe6e6e0); P.hl(cx, y - 6, 4, mc); P.rect(cx + 1, y - 4, 2, 2, mc);
      P.vl(cx + 3, y - 6, 6, 0xc8c8c4); cx += 4;
    } else if (kind === 'bread') { // limpor och baguetter
      if (cx + 6 > x + w) break;
      const lc = [0xc8883a, 0xa8642a, 0xe0a858, 0x8a4a22][Math.floor(r * 4)];
      if (i % 3 === 2) { P.rect(cx, y - 7, 2, 7, lc); P.vl(cx, y - 7, 7, mix(lc, 0xffe0a0, 0.4)); for (let k = 1; k < 7; k += 2) P.px(cx + 1, y - k, 0xf0d098); cx += 3; }
      else { P.rect(cx, y - 3, 6, 3, lc); P.hl(cx + 1, y - 4, 4, lc); P.hl(cx + 1, y - 4, 3, mix(lc, 0xffe0a0, 0.45)); P.px(cx + 2, y - 3, mul(lc, 0.7)); P.px(cx + 4, y - 3, mul(lc, 0.7)); P.hl(cx, y - 1, 6, mul(lc, 0.7)); cx += 7; }
    } else if (kind === 'cheese') { // ostar: hjul och bitar
      if (cx + 6 > x + w) break;
      P.rect(cx, y - 4, 6, 4, 0xf0c848); P.hl(cx, y - 4, 6, 0xffe890); P.hl(cx, y - 1, 6, 0xc89a2a); P.px(cx + 2, y - 3, 0xd8a838); P.px(cx + 4, y - 2, 0xd8a838);
      if (i % 2) { P.rect(cx + 1, y - 7, 4, 3, 0xe8b838); P.hl(cx + 1, y - 7, 4, 0xfff0a8); P.px(cx + 3, y - 6, 0xc89a2a); }
      cx += 7;
    } else break;
  }
}
// hyllplan med prisremsa
function shelf(P, x, y, w) {
  P.hl(x, y, w, 0xe8ecf0); P.hl(x, y + 1, w, 0x8a909a);
  for (let i = 2; i < w; i += 6) { P.px(x + i, y + 1, 0xf8e040); P.px(x + i + 1, y + 1, 0xffffff); }
}
// fruktpyramid i en snedställd låda
function fruitCrate(P, x, y, w, c, kind) {
  if (kind === 'banana') {
    for (let k = 0; k < w - 1; k += 3) { P.hl(x + k, y - 3, 3, 0xf8d838); P.px(x + k, y - 2, 0xf8d838); P.px(x + k + 2, y - 4, 0x6a5a1a); P.px(x + k + 1, y - 3, 0xfff08a); P.hl(x + k + 1, y - 2, 2, 0xd8a820); }
    for (let k = 1; k < w - 2; k += 4) { P.hl(x + k, y - 6, 3, 0xf0cc30); P.px(x + k + 3, y - 7, 0x6a5a1a); P.px(x + k, y - 6, 0xfff08a); }
  } else if (kind === 'leaf') {
    for (let k = 0; k < w; k += 4) for (let yy = 0; yy < 5; yy++) for (let xx = 0; xx < 4; xx++) {
      const e = Math.hypot(xx - 1.5, yy - 2.5);
      if (e < 2.4 && x + k + xx < x + w) P.px(x + k + xx, y - 6 + yy, e < 1.2 ? 0xb8e070 : (xx + yy) % 2 ? 0x4a9a3a : 0x6ab84a);
    }
  } else {
    for (let row = 0; row < 3; row++) {
      const n = Math.floor((w - row * 2) / 3);
      for (let k = 0; k < n; k++) {
        const fx = x + row + k * 3, fy = y - 3 - row * 2;
        P.rect(fx, fy, 3, 3, c); P.px(fx, fy, mix(c, 0xffffff, 0.55)); P.px(fx + 2, fy + 2, mul(c, 0.6)); P.px(fx + 1, fy + 2, mul(c, 0.8));
        if (kind === 'apple' && (k + row) % 3 === 0) P.px(fx + 1, fy - 1, 0x4a8a2a);
      }
    }
  }
  P.rect(x - 1, y, w + 2, 4, 0xb07a44); P.hl(x - 1, y, w + 2, 0xd8a468); P.hl(x - 1, y + 2, w + 2, 0x7a4a24);
  P.vl(x - 1, y, 4, 0x8a5a30); P.vl(x + w, y, 4, 0x6a4020);
  P.rect(x + (w >> 1) - 2, y + 1, 5, 2, 0xfff6c0); P.px(x + (w >> 1), y + 1, 0xd8323a);
}
// kampanjaffisch på glaset
function poster(P, x, y, w, h, bg, fg, s, F = SMALL) {
  P.rect(x, y, w, h, bg); P.box(x, y, w, h, mul(bg, 0.6)); P.hl(x + 1, y + 1, w - 2, mix(bg, 0xffffff, 0.35));
  const tw = textW(F, s), tx = x + ((w - tw) >> 1), ty = y + ((h - F.h) >> 1);
  text(P, F, s, tx + 1, ty + 1, mul(bg, 0.45)); text(P, F, s, tx, ty, fg);
  P.px(x + 1, y + 1, 0xf0f0f0); P.px(x + w - 2, y + 1, 0xf0f0f0);
}
// prisstjärna
function starPrice(P, cx, cy, s, bg = 0xf8d838, fg = 0xd8202a) {
  const tw = textW(SMALL, s), r = (tw >> 1) + 4;
  for (let y = -6; y <= 6; y++) for (let x = -r; x <= r; x++) {
    const a = Math.atan2(y, x), rr = (x / r) ** 2 + (y / 6) ** 2, spike = 0.82 + 0.18 * Math.cos(a * 8);
    if (rr <= spike) P.px(cx + x, cy + y, rr > spike * 0.8 ? mul(bg, 0.8) : bg);
  }
  text(P, SMALL, s, cx - (tw >> 1), cy - 2, fg);
}
const BASKET = ['...######...', '..#......#..', '..#......#..', '############', '.#.#.#.#.#.#', '.##########.', '..#.#.#.#.#.', '..########..'];

// ================= MAT – "STORMARKNAD" =================
function paintMat(b, night) {
  const W = b.w + O * 2, P = new Pix(W, IMG_H), L = O, R = O + b.w, yT = BASE - b.h;
  const glows = [], wx = (x) => x + b.x - O;
  const green = 0x229a4a, dkGreen = 0x0e4a24;
  // ---- tak: takduk, räcke, aggregat, trumma, takfönster och reklamskylt ----
  flatRoof(P, L, b.w, 36, yT, { col: 0x8a8c94, coping: 0xe8eaee });
  hvac(P, L + 10, 44, 34, 12, 8, { fans: 3, pipe: true });
  for (let x = L + 44; x < L + 104; x++) {
    P.px(x, 60, 0xe0e4ea); P.px(x, 61, 0xc0c4cc); P.px(x, 62, 0xa0a6b0); P.px(x, 63, 0x7a808c);
    if ((x - L) % 10 === 0) P.vl(x, 60, 4, 0x6a707c);
  }
  P.darken(L + 44, 64, 60, 2, 0.7);
  P.rect(L + 102, 58, 6, 10, 0xb0b6c0); P.box(L + 102, 58, 6, 10, OUT); P.hl(L + 103, 59, 4, 0xe8ecf0);
  for (const sx of [56, 80]) skylight(P, L + sx, 44, 16, 8);
  ventPipe(P, L + 28, 70, 6); ventPipe(P, L + 118, 50, 8);
  const bx = L + 128, by = 38, bw = 58, bh = 22;
  P.darken(bx + 4, by + bh + 8, bw, 4, 0.66);
  for (const lx of [bx + 8, bx + bw - 10]) { P.rect(lx, by + bh, 2, 12, 0x4a4e58); P.vl(lx, by + bh, 12, 0x8a909a); P.line(lx + 1, by + bh + 2, lx + 6, by + bh + 11, 0x5a5e68); }
  P.box(bx - 1, by - 1, bw + 2, bh + 2, OUT); P.box(bx, by, bw, bh, 0xf4f1ea);
  vgrad(P, bx + 1, by + 1, bw - 2, bh - 2, 0x3ab85a, 0x1a7a38, 4);
  for (let yy = 0; yy < 11; yy++) for (let xx = 0; xx < 11; xx++) {
    const e = Math.hypot(xx - 5, (yy - 5.5) * 1.1);
    if (e < 5.2) P.px(bx + 4 + xx, by + 7 + yy, e < 2.2 && xx < 5 && yy < 5 ? 0xff9a9a : xx > 6 && yy > 5 ? 0xa01a22 : 0xe0303a);
  }
  P.vl(bx + 9, by + 4, 3, 0x5a3a1a); P.rect(bx + 10, by + 4, 3, 2, 0x5ad05a);
  signText(P, BIG, 'FÄRSKT', bx + 18, by + 4, 0xffffff, 1, dkGreen);
  text(P, SMALL, 'VARJE DAG', bx + 18, by + 14, 0xf8e040);
  for (const lx of [bx + 10, bx + bw - 12]) { P.rect(lx, by - 4, 3, 2, 0x2a2e36); P.vl(lx + 1, by - 2, 2, 0x2a2e36); P.hl(lx, by - 2, 3, night ? 0xfff0c0 : 0x5a5e68); }
  if (night) glows.push([wx(bx + 1), by + 1, bw - 2, bh - 2, 0x9aff9a, 0.22]);
  railing(P, L + 2, b.w - 4, yT - 3, 6, 0xb8bec8);
  // ---- fasad: vita fasadskivor med stor skylt ----
  for (let y = yT; y < 122; y++) for (let x = L; x < R; x++) {
    const px0 = (x - L) % 28, py0 = (y - yT) % 20;
    let c = mix(0xf2f4f2, 0xdcdedc, q((y - yT) / 40, x, y, 3) * 0.6 + hash(x, y, 81) * 0.12);
    if (px0 === 0 || py0 === 0) c = 0xb8bcbc; else if (px0 === 1 || py0 === 1) c = 0xffffff;
    P.px(x, y, c);
  }
  P.hl(L, yT, b.w, 0xffffff); P.hl(L, yT + 1, b.w, green); P.hl(L, yT + 2, b.w, green); P.hl(L, yT + 3, b.w, dkGreen); P.darken(L, yT + 4, b.w, 1, 0.85);
  P.hl(L, 116, b.w, 0x5ad07a); P.rect(L, 117, b.w, 4, green); P.hl(L, 121, b.w, dkGreen);
  const label = 'STORMARKNAD', tw = textW(BIG, label, 2), logoW = 20, sx0 = L + ((b.w - tw - logoW - 6) >> 1);
  const cx = sx0 + 9, cy = 102;
  for (let yy = -10; yy <= 10; yy++) for (let xx = -10; xx <= 10; xx++) {
    const e = Math.hypot(xx, yy);
    if (e <= 10.2) P.px(cx + xx, cy + yy, e > 9.2 ? 0x8a1a22 : e > 8.2 ? 0xffffff : mix(0xf04a50, 0xc0202a, q((yy + 8) / 16, cx + xx, cy + yy, 3)));
  }
  BASKET.forEach((row, j) => { for (let i = 0; i < row.length; i++) if (row[i] === '#') P.px(cx - 6 + i, cy - 4 + j, 0xffffff); });
  signText(P, BIG, label, sx0 + logoW + 6, 95, green, 2, dkGreen, 0x5ad07a);
  for (let lx = L + 22; lx < R - 10; lx += 38) { // svanhalslampor
    P.px(lx, yT + 5, 0x3a3e48); P.px(lx, yT + 6, 0x3a3e48); P.px(lx + 1, yT + 7, 0x3a3e48); P.hl(lx + 2, yT + 8, 2, 0x3a3e48);
    P.rect(lx + 3, yT + 9, 4, 2, 0x2a2e36); P.hl(lx + 3, yT + 9, 4, 0x5a5e68); P.hl(lx + 4, yT + 11, 2, night ? 0xfff4c8 : 0x8a909a);
    if (night) glows.push([wx(lx + 2), yT + 12, 6, 3, 0xfff0c0, 0.25]);
  }
  const imgs = [[...textGlow(BIG, label, 2, 0x7aff9a, wx(sx0 + logoW + 6), 95), 0.8]];
  glows.push([wx(cx - 8), cy - 8, 17, 17, 0xff8080, 0.3]);
  // skärmtak med öppettider
  P.rect(L - 3, 122, b.w + 6, 2, 0xe8ecf0); P.hl(L - 3, 122, b.w + 6, 0xffffff);
  P.rect(L - 3, 124, b.w + 6, 7, green); P.hl(L - 3, 124, b.w + 6, 0x5ad07a); P.hl(L - 3, 130, b.w + 6, dkGreen);
  const oh = 'ÖPPET ALLA DAGAR 7-23', ow = textW(SMALL, oh);
  text(P, SMALL, oh, L + ((b.w - ow) >> 1), 125, 0xffffff);
  P.darken(L, 131, b.w, 2, 0.72);
  // ---- glasfronten med butiken innanför ----
  const gy = 133, gb = 180, dx0 = b.door.x0 - b.x + O, dx1 = b.door.x1 - b.x + O, dT = BASE - DOOR_H;
  const wins = [[L + 2, dx0 - 2, 0], [dx1 + 2, R - 2, 1]];
  for (const [x0, x1, side] of wins) {
    const ww = x1 - x0;
    P.clip(x0, gy, x1, gb);
    vgrad(P, x0, gy, ww, gb - gy, 0xf6f4ec, 0xe0dccc, 3);
    P.rect(x0, gy, ww, 3, 0xd8dade); for (let x = x0 + 3; x < x1 - 6; x += 16) P.hl(x, gy + 1, 8, 0xffffff);
    const kinds = side === 0 ? [['boxes', 'cans'], ['cans', 'bottles'], ['boxes', 'boxes']] : [['milk', 'boxes'], ['cheese', 'bottles'], ['bottles', 'cans']];
    for (let lv = 0; lv < 3; lv++) {
      const sy = gy + 17 + lv * 9;
      let x = x0 + 1, k = 0;
      while (x < x1 - 4) { goods(P, x, sy, Math.min(18, x1 - x - 1), kinds[lv][k % 2], side * 10 + lv * 3 + k); x += 19; k++; }
      shelf(P, x0, sy, ww);
    }
    if (side === 1) { // kyldisk med glasdörrar
      const fx = x1 - 27;
      P.rect(fx, gy + 7, 26, 28, 0xe6eef6); P.box(fx, gy + 7, 26, 28, 0x5a6270);
      for (let s = 0; s < 3; s++) { shelf(P, fx + 1, gy + 16 + s * 9, 24); goods(P, fx + 1, gy + 16 + s * 9, 24, s === 1 ? 'cheese' : 'milk', 40 + s); }
      for (let k = 1; k < 3; k++) P.vl(fx + k * 9, gy + 7, 28, 0x8a94a4);
      P.hl(fx + 1, gy + 8, 24, 0xffffff);
    }
    const cats = side === 0 ? [['FRUKT', 0xd8323a, 12], ['GRÖNT', 0x3a9a4a, 61]] : [['BRÖD', 0xc8883a, 12], ['MJÖLK', 0x3a7bd5, 60]];
    cats.forEach(([s, c, mid]) => {
      const tw2 = textW(SMALL, s), sxp = x0 + mid - ((tw2 + 2) >> 1);
      P.vl(sxp + 2, gy + 3, 2, 0x5a5e68); P.vl(sxp + tw2 - 1, gy + 3, 2, 0x5a5e68);
      P.rect(sxp, gy + 5, tw2 + 2, 7, c); P.hl(sxp, gy + 5, tw2 + 2, mix(c, 0xffffff, 0.4)); P.hl(sxp, gy + 11, tw2 + 2, mul(c, 0.6));
      text(P, SMALL, s, sxp + 1, gy + 6, 0xffffff);
    });
    if (side === 0) {
      const fr = [[0xd8323a, 'apple'], [0xf08a1a, 'orange'], [0, 'banana'], [0, 'leaf'], [0xf8e040, 'lemon'], [0x8a3ab0, 'grape'], [0x6ac040, 'apple']];
      let x = x0 + 2;
      for (const [c, kind] of fr) { if (x + 9 > x1 - 1) break; fruitCrate(P, x, gb - 4, 9, c, kind); x += 11; }
    } else {
      let x = x0 + 2;
      for (let i = 0; x + 12 < x1 - 28; i++) {
        P.rect(x, gb - 5, 12, 5, 0x9a6a3a); for (let k = 0; k < 12; k += 2) P.vl(x + k, gb - 5, 5, 0xb88a4a); P.hl(x, gb - 5, 12, 0xd8a868);
        goods(P, x, gb - 5, 12, 'bread', 60 + i); x += 14;
      }
    }
    for (let y = gy; y < gb; y++) for (let x = x0; x < x1; x++) {
      const d = (x + y + side * 5) % 29;
      if (d < 2) P.px(x, y, 0xffffff, 0.35); else if (d === 4) P.px(x, y, 0xffffff, 0.15);
    }
    P.dith(x0, gy, ww, 6, 0xbad8f0, 0.5, 0.35);
    P.clip();
    glows.push([wx(x0), gy, ww, gb - gy, 0xe8f6ff, 0.34]);
  }
  poster(P, L + 6, 150, 21, 11, 0xd8202a, 0xf8e040, 'REA', BIG);
  starPrice(P, L + 42, 155, '-50%');
  poster(P, dx1 + 6, 152, 30, 9, green, 0xffffff, 'FÄRSKT');
  starPrice(P, R - 42, 158, '19:90');
  // aluminiumprofiler
  const mull = (x) => { P.vl(x, gy - 1, gb - gy + 2, 0x7a808c); P.vl(x + 1, gy - 1, gb - gy + 2, 0xd8dce4); };
  for (const [x0, x1] of wins) { mull(x0 - 2); mull(x1); for (let x = x0 + 24; x < x1 - 8; x += 24) mull(x); }
  P.hl(L, gy - 1, b.w, 0x7a808c); P.hl(L, gy - 2, b.w, 0xd8dce4);
  // dörrparti: överljus, sensor och karm
  P.rect(dx0 - 2, gy - 1, dx1 - dx0 + 4, dT - gy + 1, 0xc8ccd4);
  for (let y = gy; y < dT - 5; y++) for (let x = dx0; x < dx1; x++) P.px(x, y, mix(0xe8eef4, 0xb8c8d8, (y - gy) / 14));
  const inn = 'INGÅNG', iw = textW(SMALL, inn);
  text(P, SMALL, inn, ((dx0 + dx1) >> 1) - (iw >> 1), gy + 3, dkGreen);
  P.rect(dx0 - 2, dT - 5, dx1 - dx0 + 4, 5, 0x5a606c); P.hl(dx0 - 2, dT - 5, dx1 - dx0 + 4, 0xb8bec8);
  const sxc = (dx0 + dx1) >> 1;
  P.rect(sxc - 3, dT - 4, 6, 3, 0x2a2e36); P.hl(sxc - 3, dT - 4, 6, 0x4a4e58);
  P.rect(dx0 - 2, dT - 1, 2, DOOR_H + 1, 0x7a808c); P.rect(dx1, dT - 1, 2, DOOR_H + 1, 0x7a808c);
  P.vl(dx0 - 1, dT - 1, DOOR_H + 1, 0xd8dce4); P.vl(dx1 + 1, dT - 1, DOOR_H + 1, 0xd8dce4);
  // sockel + tröskel
  for (let y = gb; y < BASE; y++) for (let x = L; x < R; x++) if (x < dx0 - 2 || x >= dx1 + 2) P.px(x, y, mix(0x5a606c, 0x7a808c, hash(x, y, 82) * 0.4 + (y - gb) / 12));
  P.hl(L, gb, b.w, 0xb8bec8); P.hl(L, BASE - 1, b.w, 0x2a2e36);
  P.rect(dx0 - 2, BASE, dx1 - dx0 + 4, 2, 0x9aa0aa); P.hl(dx0 - 2, BASE, dx1 - dx0 + 4, 0xd8dce4);
  for (let x = dx0; x < dx1; x += 3) P.px(x, BASE + 1, 0x6a707c);
  for (const x of [L, R - 3]) { P.rect(x, 122, 3, BASE - 122, 0xe8eaec); P.vl(x, 122, BASE - 122, 0xffffff); P.vl(x + 2, 122, BASE - 122, 0x9aa0a8); }
  footShadow(P, L, dx0 - 2 - L); footShadow(P, dx1 + 2, R - dx1 - 2);
  META[b.id + ':' + !!night] = { glows, imgs, doorLight: 0xf0f8ff, sensor: [wx(sxc - 1), dT - 3] };
  return P.flush();
}
function matKit(b) {
  const w = b.door.x1 - b.door.x0;
  return makeSlideKit(w, DOOR_H, (I) => {
    paintInterior(I, w, DOOR_H, { wall0: 0xfaf8f0, wall1: 0xe4e0d0, floor: 0xd8d4c8 });
    for (let lv = 0; lv < 2; lv++) { shelf(I, 0, 12 + lv * 8, w); goods(I, 1, 12 + lv * 8, w - 2, lv ? 'cans' : 'boxes', 90 + lv); }
    I.rect(2, 22, 16, 6, 0x3a3e48); I.hl(2, 22, 16, 0x8a909a); I.rect(4, 18, 5, 4, 0x2a2e36); I.rect(5, 19, 3, 2, 0x5ad07a);
    for (let k = 0; k < 3; k++) { const x = w - 16 + k * 3; I.box(x, 22, 9, 6, 0x8a909a); I.hl(x, 25, 9, 0xb8bec8); I.px(x + 1, 29, 0x2a2e36); I.px(x + 7, 29, 0x2a2e36); }
  }, (P, w, h, side) => {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const d = (x + y + side * 4) % 13;
      P.px(x, y, d < 2 ? 0xffffff : 0xcfe6f4, d < 2 ? 0.5 : 0.22);
    }
    P.rect(0, 0, w, 2, 0xb8bec8); P.hl(0, 0, w, 0xe8ecf0); P.rect(0, h - 3, w, 3, 0x7a808c); P.hl(0, h - 3, w, 0xb8bec8);
    P.vl(side ? w - 2 : 0, 0, h, 0xb8bec8); P.vl(side ? w - 1 : 1, 0, h, 0x8a909a);
    P.vl(side ? 0 : w - 1, 0, h, 0x5a606c);
    for (let x = 2; x < w - 2; x += 3) P.px(x, 14, 0x229a4a);
    P.rect(side ? 2 : w - 7, 12, 5, 5, 0x229a4a); P.px(side ? 4 : w - 5, 14, 0xffffff);
  });
}
function liveMat(ctx, b, st) {
  const kit = KITS[b.id] || (KITS[b.id] = matKit(b));
  drawDoor(ctx, b, st, kit);
  const m = metaOf(b, st.night);
  if (m?.sensor) { ctx.fillStyle = (st.doorOpen || 0) > 0.08 ? '#4aff6a' : '#b8262a'; ctx.fillRect(m.sensor[0], m.sensor[1], 2, 1); }
}

// ================= KLÄDER – boutique med skyltdockor =================
const DOCKA = { skin: '#cfd2d8', hair: '#cfd2d8', style: 'bald', glasses: false, beard: false, build: 4 };
const DOCKOR = [
  { ...DOCKA, top: 'vest', shirt: '#e0407a', accent: '#f4f1ea', bottom: 'dress', pants: '#e0407a', shoes: '#f2f2f2', hat: 'bow', cap: '#f8d040' },
  { ...DOCKA, top: 'suit', shirt: '#2a3a6a', accent: '#d8323a', bottom: 'pants', pants: '#2a3a6a', shoes: '#1c1c1c' },
  { ...DOCKA, top: 'jacket', shirt: '#f0b429', accent: '#2f3440', bottom: 'skirt', pants: '#3a7bd5', shoes: '#c23b3b', hat: 'bucket', cap: '#e8e3d6' },
];
// neonbokstäver: rör i färgen med ljus kärna
function neonText(P, F, s, x, y, c, sc = 2) {
  eachTextPixel(F, s, x + 1, y + 1, sc, (px, py) => P.px(px, py, 0x000000, 0.5));
  eachTextPixel(F, s, x, y, sc, (px, py) => P.px(px, py, ((px - x) % sc === 0 && (py - y) % sc === 0) ? mix(c, 0xffffff, 0.7) : c));
}
function paintKlader(b, night) {
  const W = b.w + O * 2, P = new Pix(W, IMG_H), L = O, R = O + b.w, yT = BASE - b.h;
  const glows = [], wx = (x) => x + b.x - O;
  const rose = 0xe4aeb8, black = 0x16141a, gold = 0xd8b45a, neon = 0xff4aa0;
  // ---- tak: takterrass med trädäck, planteringar och parasoll ----
  flatRoof(P, L, b.w, 38, yT, { col: 0x7a7480 });
  for (let y = 46; y < yT - 8; y++) for (let x = L + 40; x < L + 96; x++) P.px(x, y, ((x - L) % 6 === 0) ? 0x8a6040 : mix(0xb8885a, 0xa07448, hash(x >> 1, y, 91)));
  P.box(L + 40, 46, 56, yT - 54, 0x5a3a24);
  for (const px0 of [L + 42, L + 78]) {
    P.rect(px0, 48, 16, 5, 0x6a6e78); P.hl(px0, 48, 16, 0xa8acb4); P.hl(px0, 52, 16, 0x3a3e48);
    for (let k = 0; k < 16; k += 3) for (let yy = 0; yy < 5; yy++) for (let xx = 0; xx < 4; xx++) if (Math.hypot(xx - 1.5, yy - 2.5) < 2.5) P.px(px0 + k + xx - 1, 43 + yy, (xx + yy + k) % 3 ? 0x3a8a3a : 0x6ab84a);
    P.px(px0 + 4, 44, 0xf05a8a); P.px(px0 + 10, 45, 0xf8d040);
  }
  for (let r = 0; r < 4; r++) P.hl(L + 62 - r * 2, 50 + r, r * 4 + 4, r % 2 ? 0xf05a8a : 0xffffff);
  P.vl(L + 63, 54, 6, 0x3a3a44);
  P.rect(L + 55, 58, 4, 4, 0xf4f1ea); P.rect(L + 68, 58, 4, 4, 0xf4f1ea); P.rect(L + 60, 59, 7, 2, 0xd8d4c8);
  hvac(P, L + 8, 44, 18, 8, 6, { fans: 1 });
  ventPipe(P, L + 104, 48, 7);
  railing(P, L + 2, b.w - 4, yT - 3, 6, 0x3a3a44);
  // ---- övervåningen i rosa puts ----
  grain(P, L, yT, b.w, 112 - yT, rose, 0.12, 92);
  const corn = [0x6a4a52, 0xfff6f4, 0xf0dcdc, -1, 0xd8b8bc, 0xfff0f0, 0x9a7a80];
  corn.forEach((c, j) => { if (c >= 0) P.hl(L, yT + j, b.w, c); else for (let x = L; x < R; x++) P.px(x, yT + j, (x >> 1) % 2 ? 0xb8989c : 0xfff4f4); });
  P.darken(L, yT + 7, b.w, 2, 0.84);
  [[12, 0], [55, 1], [98, 2]].forEach(([lx, i]) => {
    const lit = night ? (i === 1 ? true : 'warm2') : false;
    homeWindow(P, L + lx, 88, 14, 18, { lit, night, frame: 0xffffff, surround: 0xf8e8ea, curtain: 0xf8f0e8, transom: 0.3, seed: 50 + i, sill: false });
    if (lit) glows.push([wx(L + lx + 1), 89, 12, 16, litCol(lit), 0.3]);
    for (let r = 0; r < 4; r++) P.hl(L + lx + 5 - r * 3, 79 + r, r * 6 + 4, r === 0 ? 0xffffff : 0xf8e8ea);
    P.hl(L + lx - 4, 83, 22, 0xb8989c);
    P.hl(L + lx - 2, 102, 18, 0x1e1e26); P.hl(L + lx - 2, 107, 18, 0x1e1e26);
    for (let k = 0; k < 18; k += 2) P.vl(L + lx - 2 + k, 103, 4, 0x3a3a46);
    P.px(L + lx + 6, 104, gold); P.px(L + lx + 7, 105, gold);
  });
  P.hl(L, 108, b.w, 0xfff6f4); P.hl(L, 109, b.w, 0xd8b8bc); P.hl(L, 110, b.w, 0x8a6a70);
  // ---- svart skyltband med neonskylt ----
  for (let y = 111; y < 131; y++) for (let x = L; x < R; x++) P.px(x, y, mix(black, 0x2a2630, q((y - 111) / 19, x, y, 3)));
  P.hl(L, 111, b.w, gold); P.hl(L, 130, b.w, gold);
  const tw = textW(BIG, 'KLÄDER', 2), tx = L + ((b.w - tw) >> 1);
  neonText(P, BIG, 'KLÄDER', tx, 116, neon, 2);
  const hanger = (hx) => {
    const c = 0x5ae0f0;
    P.px(hx + 4, 117, c); P.px(hx + 5, 118, c); P.px(hx + 4, 119, c); P.px(hx + 4, 120, c);
    for (let k = 0; k < 5; k++) { P.px(hx + 4 - k, 121 + k, c); P.px(hx + 4 + k, 121 + k, c); }
    P.hl(hx - 1, 126, 11, c); P.hl(hx, 126, 9, 0xd8faff);
  };
  hanger(L + 5); hanger(R - 14);
  glows.push([wx(L + 5), 121, 9, 8, 0x5ae0f0, 0.25], [wx(R - 14), 121, 9, 8, 0x5ae0f0, 0.25]);
  awning(P, L - 2, 131, b.w + 4, 6, 0xf05a8a, 0xfff4f4, { stripe: 4, drop: 3, ext: 3 });
  // ---- butiksfront: svart lack med guldlister ----
  for (let y = 140; y < BASE; y++) for (let x = L; x < R; x++) P.px(x, y, mix(black, 0x24222a, hash(x, y, 93) * 0.4 + (bayer(x, y) - 0.5) * 0.2));
  const dx0 = b.door.x0 - b.x + O, dx1 = b.door.x1 - b.x + O, dT = BASE - DOOR_H;
  const wins = [[L + 3, dx0 - 4], [dx1 + 4, R - 3]];
  const G = new Pix(W, IMG_H); // glaslagret som läggs över dockorna
  for (const [x0, x1] of wins) {
    const ww = x1 - x0, y0 = 141, y1 = 183;
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) P.px(x, y, mix(((x - x0) >> 2) % 2 ? 0xf6e2e6 : 0xfaeef0, 0xd8b0b8, q((y - y0) / (y1 - y0), x, y, 3) * 0.7));
    for (let s = 0; s < 2; s++) {
      const sx = x0 + Math.round((s + 0.5) * ww / 2);
      for (let y = y0 + 1; y < y1 - 6; y++) { const hw = Math.round((y - y0) * 0.35); for (let x = Math.max(x0, sx - hw); x <= Math.min(x1 - 1, sx + hw); x++) if (bayer(x, y) < 0.5) P.px(x, y, 0xffffff, 0.22); }
      P.rect(sx - 1, y0, 3, 2, 0x2a2a30); P.px(sx, y0 + 2, 0xfff8e0);
    }
    P.rect(x0 + 2, y1 - 4, ww - 4, 4, 0xf4f1ea); P.hl(x0 + 2, y1 - 4, ww - 4, 0xffffff); P.hl(x0 + 2, y1 - 1, ww - 4, 0xb8b4ac);
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const d = (x + y) % 23; if (d < 2) G.px(x, y, 0xffffff, 0.3); else if (d === 3) G.px(x, y, 0xffffff, 0.12); }
    G.dith(x0, y0, ww, 4, 0xffffff, 0.5, 0.2);
    P.box(x0 - 1, y0 - 1, ww + 2, y1 - y0 + 2, gold); P.box(x0 - 2, y0 - 2, ww + 4, y1 - y0 + 4, OUT);
    glows.push([wx(x0), y0, ww, y1 - y0, 0xfff0e8, 0.32]);
  }
  // klädställning med plagg + väska i högra fönstret
  const [rx0, rx1] = wins[1];
  P.hl(rx1 - 20, 152, 17, 0xc8a44a); P.vl(rx1 - 20, 152, 27, 0x8a8e98); P.vl(rx1 - 4, 152, 27, 0x8a8e98); P.hl(rx1 - 22, 179, 21, 0x5a5e68);
  for (let k = 0; k < 5; k++) {
    const c = [0x3a7bd5, 0xf05a8a, 0x46a35a, 0xf4f1ea, 0x8e5bd1][k], gx = rx1 - 19 + k * 3, hh = 11 + (k % 2) * 3;
    P.px(gx + 1, 153, 0x8a8e98); P.rect(gx, 154, 3, hh, c); P.vl(gx, 154, hh, mix(c, 0xffffff, 0.3)); P.vl(gx + 2, 155, hh - 1, mul(c, 0.7));
  }
  P.rect(rx1 - 18, 172, 7, 5, 0xc0503a); P.hl(rx1 - 18, 172, 7, 0xe07a5a); P.px(rx1 - 16, 170, 0x6a2a1a); P.px(rx1 - 13, 170, 0x6a2a1a); P.hl(rx1 - 15, 169, 2, 0x6a2a1a); P.px(rx1 - 15, 174, gold);
  poster(P, rx1 - 21, 142, 17, 9, 0xd8202a, 0xffffff, '-30%');
  for (const x of [L, dx0 - 3, dx1 + 1, R - 2]) { P.vl(x, 140, BASE - 140, 0x3a3640); P.vl(x + 1, 140, BASE - 140, gold); }
  P.rect(dx0 - 1, dT - 1, dx1 - dx0 + 2, DOOR_H + 1, OUT);
  for (let y = 140; y < dT - 1; y++) for (let x = dx0; x < dx1; x++) P.px(x, y, (x + y) % 5 === 0 ? 0x3a3640 : black);
  P.hl(L, BASE - 1, b.w, 0x0a0a0e);
  P.rect(dx0 - 2, BASE, dx1 - dx0 + 4, 2, 0xd8d0c8); P.hl(dx0 - 2, BASE, dx1 - dx0 + 4, 0xf4ece4); P.hl(dx0 - 2, BASE + 2, dx1 - dx0 + 4, 0x6a6460);
  footShadow(P, L, dx0 - 2 - L); footShadow(P, dx1 + 2, R - dx1 - 2);
  downpipe(P, R - 3, yT - 1, 112);
  // dockorna ritas med figurmotorn och glaset läggs över
  const cv = P.flush(), ctx = cv.getContext('2d');
  const [lx0, lx1] = wins[0];
  for (const [fx, look] of [[lx0 + 12, DOCKOR[0]], [lx1 - 12, DOCKOR[1]], [rx0 + 13, DOCKOR[2]]]) {
    drawPerson(ctx, fx, 179, look, 'down', 0);
    // en skyltdocka har inget ansikte: måla över ögon, bryn och mun med "huden"
    const sx = fx - 12, sy = 179 - 39;
    ctx.fillStyle = DOCKA.skin;
    ctx.fillRect(sx + 8, sy + 10, 3, 1); ctx.fillRect(sx + 13, sy + 10, 3, 1);
    ctx.fillRect(sx + 9, sy + 12, 1, 2); ctx.fillRect(sx + 14, sy + 12, 1, 2); ctx.fillRect(sx + 11, sy + 17, 2, 1);
    ctx.fillStyle = '#e8eaee'; ctx.fillRect(sx + 9, sy + 8, 2, 1); // blank högdager
  }
  ctx.drawImage(G.flush(), 0, 0);
  META[b.id + ':' + !!night] = { glows, doorLight: 0xffe0e8, neon: textGlow(BIG, 'KLÄDER', 2, neon, wx(tx), 116) };
  return cv;
}
function kladerKit(b) {
  const w = b.door.x1 - b.door.x0;
  return makeSwingKit(w, DOOR_H, (I) => {
    paintInterior(I, w, DOOR_H, { wall0: 0xfaeef0, wall1: 0xe8c8d0, floor: 0xc8a880 });
    I.hl(1, 8, w - 2, 0xc8a44a);
    for (let k = 0; k < 7; k++) { const c = PACK[(k * 3) % PACK.length]; I.rect(2 + k * 3, 9, 3, 10 + (k % 3), c); I.vl(2 + k * 3, 9, 10, mix(c, 0xffffff, 0.3)); }
    I.rect(w - 7, 6, 5, 16, 0xd8e8f0); I.box(w - 7, 6, 5, 16, 0xc8a44a); I.px(w - 6, 7, 0xffffff);
  }, (P, w, h) => {
    P.rect(0, 0, w, h, 0x16141a); P.box(0, 0, w, h, OUT);
    for (let y = 2; y < h - 4; y++) for (let x = 2; x < w - 2; x++) { const d = (x + y) % 12; P.px(x, y, d < 2 ? 0xffffff : 0xf8d8e0, d < 2 ? 0.5 : 0.2); }
    P.vl(1, 1, h - 2, 0x3a3640); P.vl(w - 2, 1, h - 2, 0x0a0a0e);
    P.vl(w - 5, 9, 16, 0xf0d070); P.vl(w - 4, 9, 16, 0x8a6a2a); P.px(w - 5, 8, 0x8a6a2a); P.px(w - 5, 25, 0x8a6a2a);
    P.rect(1, h - 4, w - 2, 3, 0x2a2630); P.hl(1, h - 4, w - 2, 0xc8a44a);
  });
}
function glowKlader(ctx, b, st) {
  glowFor(ctx, b, st);
  const m = metaOf(b, st.night), k = Math.min(1, (st.env?.dark || 0) * 2);
  if (!m?.neon || k <= 0.02) return;
  const t = st.t || 0, flick = Math.sin(t * 23) > 0.93 && Math.sin(t * 0.7) > 0.6 ? 0.2 : 1; // neonen flimrar ibland
  const [img, x, y] = m.neon;
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = Math.min(1, 0.95 * k * flick); ctx.drawImage(img, x, y);
  ctx.globalAlpha = 0.07 * k * flick; ctx.fillStyle = '#ff4aa0'; ctx.fillRect(x - 2, y + 2, img.width + 4, img.height - 2);
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
}

// ================= MÖBELJÄTTEN – blå låda med inredda rum i fönstren =================
const SHOW_W = 78, SHOW_H = 66, SHOW_Y = 110;
// möbler: [atlasnyckel, x, fotens y] i fönstrets koordinater; prislappar: [text, x, y]
const ROOMS = [
  { wall: 0xeee4d2, stripe: 0xe2d6c0, floor: 0xc8965a, rug: 0x4a7ab8,
    items: [['bokhylla1', 3, 44], ['soffa4', 34, 50], ['lampa0', 64, 50], ['fatolj3', 2, 64], ['bordR0', 36, 62]],
    tags: [['1495', 38, 24], ['349', 20, 48], ['199', 62, 54]], banner: 'STOR REA' },
  { wall: 0xdde8ee, stripe: 0xcedde6, floor: 0xd8b888, rug: 0xe09aa6,
    items: [['garderob2', 41, 42], ['lampa1', 26, 40], ['sang1', 3, 62], ['vaxtS0', 56, 64]],
    tags: [['2995', 8, 22], ['995', 44, 50]], banner: 'NYHET' },
];
function paintShowroom(R, def, night) {
  const fy = 42; // golvlinjen
  for (let y = 0; y < fy; y++) for (let x = 0; x < SHOW_W; x++) R.px(x, y, mix(x % 6 < 3 ? def.wall : def.stripe, mul(def.wall, 0.86), q(y / fy, x, y, 3) * 0.6));
  R.rect(8, 8, 12, 9, 0x5a3a24); R.rect(9, 9, 10, 7, 0x8ac0e0); R.hl(9, 13, 10, 0x6aa04a); R.px(15, 10, 0xfff0a0); // tavla
  R.hl(0, fy - 2, SHOW_W, 0xffffff); R.hl(0, fy - 1, SHOW_W, 0xc8c0b0);
  for (let y = fy; y < SHOW_H; y++) for (let x = 0; x < SHOW_W; x++) {
    const row = (y - fy) >> 1, seam = (x + row * 13) % 22 === 0;
    let c = mix(mul(def.floor, 0.86), def.floor, q((y - fy) / (SHOW_H - fy), x, y, 3));
    if ((y - fy) % 2 === 1) c = mul(c, 0.94); if (seam) c = mul(c, 0.78);
    R.px(x, y, c);
  }
  for (let y = 54; y < 62; y++) for (let x = 20; x < 62; x++) R.px(x, y, (x + y) % 4 === 0 ? mix(def.rug, 0xffffff, 0.3) : (y === 54 || y === 61 ? mul(def.rug, 0.7) : def.rug));
  for (const sx of [18, 58]) { // spotlights med ljuskäglor
    R.rect(sx - 1, 0, 3, 2, 0x2a2a30); R.px(sx, 2, 0xfff8e0);
    for (let y = 3; y < fy + 8; y++) { const hw = Math.round(y * 0.3); for (let x = sx - hw; x <= sx + hw; x++) if (bayer(x, y) < 0.35) R.px(x, y, 0xffffff, 0.2); }
  }
  if (night) R.darken(0, 0, SHOW_W, SHOW_H, 0.98);
}
function paintShowGlass(G, def, side) {
  // prislappar på stativ
  for (const [s, x, y] of def.tags) {
    const tw = textW(SMALL, s);
    G.vl(x + (tw >> 1) + 1, y + 7, 5, 0x5a5e68);
    G.rect(x, y, tw + 3, 7, 0xf8d838); G.box(x, y, tw + 3, 7, 0xb8961a); G.hl(x + 1, y + 1, tw + 1, 0xfff4a0);
    text(G, SMALL, s, x + 2, y + 1, 0x1a1a22);
  }
  // banderoll
  const bw = textW(SMALL, def.banner) + 12, bx = (SHOW_W - bw) >> 1, by = 3;
  const bc = side === 0 ? 0xd8202a : 0xf8d838, fc = side === 0 ? 0xf8e040 : 0x1f5fb0;
  G.line(2, 0, bx, by + 2, 0x5a5e68); G.line(SHOW_W - 3, 0, bx + bw - 1, by + 2, 0x5a5e68);
  G.rect(bx, by, bw, 8, bc); G.hl(bx, by, bw, mix(bc, 0xffffff, 0.35)); G.hl(bx, by + 7, bw, mul(bc, 0.65));
  for (let k = 0; k < 4; k++) { G.px(bx - 1 - (k < 2 ? k : 3 - k), by + 2 + k, bc); G.px(bx + bw + (k < 2 ? k : 3 - k), by + 2 + k, bc); }
  text(G, SMALL, def.banner, bx + 6, by + 2, fc);
  // glasreflexer
  for (let y = 0; y < SHOW_H; y++) for (let x = 0; x < SHOW_W; x++) { const d = (x + y + side * 9) % 31; if (d < 2) G.px(x, y, 0xffffff, 0.28); else if (d === 3) G.px(x, y, 0xffffff, 0.12); }
  G.dith(0, 0, SHOW_W, 5, 0xd8ecff, 0.5, 0.25);
}
function paintMobler(b, night) {
  const W = b.w + O * 2, P = new Pix(W, IMG_H), L = O, R = O + b.w, yT = BASE - b.h;
  const glows = [], wx = (x) => x + b.x - O;
  const blue = 0x1f5fb0, dkBlue = 0x123e7a, yellow = 0xf8cc1a;
  // ---- tak: takduk, takfönster, aggregat ----
  flatRoof(P, L, b.w, 36, yT, { col: 0x6a6c74 });
  for (let k = 0; k < 5; k++) skylight(P, L + 70 + k * 22, 42, 14, 7);
  hvac(P, L + 10, 42, 40, 11, 8, { fans: 4, pipe: true });
  hvac(P, R - 42, 44, 28, 9, 7, { fans: 2, col: 0xb8bcc4 });
  for (const vx of [58, 180]) ventPipe(P, L + vx, 56, 6);
  // ---- fasad: blå, räfflad plåt ----
  for (let y = yT; y < BASE; y++) for (let x = L; x < R; x++) {
    const rib = (x - L) % 4;
    let c = rib === 0 ? 0x3a7ad0 : rib === 3 ? 0x14427e : blue;
    c = mix(c, mul(c, 0.84), q((y - yT) / (BASE - yT), x, y, 3) * 0.6);
    if (hash(x, y, 101) > 0.96) c = mix(c, 0x8ab0e0, 0.2);
    P.px(x, y, c);
  }
  P.hl(L, yT, b.w, 0x8ab4e8); P.hl(L, yT + 1, b.w, dkBlue); P.darken(L, yT + 2, b.w, 1, 0.8);
  // gult skyltband längs fasaden
  P.hl(L, 100, b.w, 0xfff0a0); P.rect(L, 101, b.w, 4, yellow); P.hl(L, 105, b.w, 0xb8920a); P.darken(L, 106, b.w, 1, 0.75);
  // loggan: gul oval med blå text i en blå ram
  const label = 'MÖBELJÄTTEN', tw = textW(BIG, label, 2), lw = tw + 24, lh = 26, lx = L + ((b.w - lw) >> 1), ly = 73;
  P.rect(lx - 3, ly - 3, lw + 6, lh + 6, dkBlue); P.box(lx - 3, ly - 3, lw + 6, lh + 6, 0x0a2450);
  for (let y = 0; y < lh; y++) for (let x = 0; x < lw; x++) {
    const ex = (x + 0.5 - lw / 2) / (lw / 2), ey = (y + 0.5 - lh / 2) / (lh / 2);
    const e = Math.pow(Math.abs(ex), 6) + Math.pow(Math.abs(ey), 2.2);
    if (e <= 1) P.px(lx + x, ly + y, e > 0.85 ? 0xd8a810 : mix(0xffe070, yellow, q(y / lh, lx + x, ly + y, 3)));
  }
  const tx = lx + 12, ty = ly + 8;
  signText(P, BIG, label, tx, ty, blue, 2, 0xb8920a, 0x3a7ad0);
  const imgs = [];
  glows.push([wx(lx + 6), ly + 3, lw - 12, lh - 6, 0xffd840, 0.14]);
  // ---- skyltfönstren med rum ----
  const dx0 = b.door.x0 - b.x + O, dx1 = b.door.x1 - b.x + O, dT = BASE - DOOR_H;
  const shows = [], wins = [L + 6, R - 6 - SHOW_W];
  wins.forEach((x0, side) => {
    const Rm = new Pix(SHOW_W, SHOW_H); paintShowroom(Rm, ROOMS[side], night);
    const G = new Pix(SHOW_W, SHOW_H); paintShowGlass(G, ROOMS[side], side);
    shows.push({ x0, x: wx(x0), y: SHOW_Y, room: Rm.flush(), glass: G.flush(), def: ROOMS[side] });
    P.rect(x0 - 3, SHOW_Y - 3, SHOW_W + 6, SHOW_H + 6, 0xe8ecf0); P.box(x0 - 3, SHOW_Y - 3, SHOW_W + 6, SHOW_H + 6, 0x0a2450);
    P.hl(x0 - 2, SHOW_Y - 2, SHOW_W + 4, 0xffffff); P.hl(x0 - 2, SHOW_Y + SHOW_H + 1, SHOW_W + 4, 0x8a909a);
    P.darken(x0 - 2, SHOW_Y + SHOW_H + 3, SHOW_W + 4, 2, 0.7);
    glows.push([wx(x0), SHOW_Y, SHOW_W, SHOW_H, 0xfff4dc, 0.3]);
  });
  // ---- entréportal i gult ----
  P.rect(dx0 - 8, 134, dx1 - dx0 + 16, BASE - 134, yellow);
  for (let y = 134; y < BASE; y++) for (let x = dx0 - 8; x < dx1 + 8; x++) if (hash(x, y, 102) > 0.9) P.px(x, y, 0xf0c010);
  P.hl(dx0 - 8, 134, dx1 - dx0 + 16, 0xfff0a0); P.vl(dx0 - 8, 134, BASE - 134, 0xffe880); P.vl(dx1 + 7, 134, BASE - 134, 0xb8920a);
  P.box(dx0 - 9, 133, dx1 - dx0 + 18, BASE - 133, 0x0a2450);
  const inn = 'INGÅNG', iw = textW(BIG, inn);
  signText(P, BIG, inn, ((dx0 + dx1) >> 1) - (iw >> 1), 139, blue, 1, 0xb8920a);
  // pil ner mot dörren
  for (let k = 0; k < 3; k++) P.hl(dx1 + 1 - k, 142 + k, 1 + k * 2, blue);
  for (let k = 0; k < 3; k++) P.hl(dx0 - 5 - k, 142 + k, 1 + k * 2, blue);
  P.rect(dx0 - 2, dT - 5, dx1 - dx0 + 4, 5, 0x3a3e48); P.hl(dx0 - 2, dT - 5, dx1 - dx0 + 4, 0x8a909a);
  const sxc = (dx0 + dx1) >> 1;
  P.rect(sxc - 3, dT - 4, 6, 3, 0x1a1e26);
  P.rect(dx0 - 2, dT - 1, 2, DOOR_H + 1, 0x0a2450); P.rect(dx1, dT - 1, 2, DOOR_H + 1, 0x0a2450);
  // sockel och kundvagnsskydd
  for (let y = 180; y < BASE; y++) for (let x = L; x < R; x++) if (x < dx0 - 8 || x >= dx1 + 8) P.px(x, y, mix(0x4a4e58, 0x6a6e78, hash(x, y, 103) * 0.5));
  P.hl(L, 180, b.w, 0x9aa0aa);
  for (let x = L + 4; x < R - 4; x += 1) if (x < dx0 - 10 || x >= dx1 + 10) { P.px(x, 182, 0xf8cc1a); P.px(x, 183, 0xb8920a); }
  P.rect(dx0 - 2, BASE, dx1 - dx0 + 4, 2, 0x9aa0aa); P.hl(dx0 - 2, BASE, dx1 - dx0 + 4, 0xd8dce4);
  footShadow(P, L, dx0 - 2 - L); footShadow(P, dx1 + 2, R - dx1 - 2);
  // rummen (utan möbler – de kommer i live när atlasen laddat) och glaset
  const cv = P.flush(), ctx = cv.getContext('2d');
  for (const s of shows) { ctx.drawImage(s.room, s.x0, SHOW_Y); ctx.drawImage(s.glass, s.x0, SHOW_Y); }
  META[b.id + ':' + !!night] = { glows, imgs, doorLight: 0xfff4dc, sensor: [wx(sxc - 1), dT - 3], shows };
  return cv;
}
// svenska flaggor på taket – fyra fladderlägen
function flagFrames() {
  const out = [];
  for (let f = 0; f < 4; f++) {
    const F = new Pix(13, 9);
    for (let x = 0; x < 12; x++) {
      const dy = Math.round(Math.sin(x * 0.7 - f * 1.57) * (x / 12) * 1.6);
      for (let y = 0; y < 7; y++) {
        const cross = x === 3 || x === 4 || y === 3;
        const shade = Math.sin(x * 0.7 - f * 1.57 + 0.8) > 0.3 ? 0.82 : 1;
        F.px(x, y + dy + 1, mul(cross ? 0xf8cc1a : 0x1f5fb0, shade));
      }
    }
    out.push(F.flush());
  }
  return out;
}
function moblerKit(b) {
  const w = b.door.x1 - b.door.x0;
  const kit = makeSlideKit(w, DOOR_H, (I) => {
    paintInterior(I, w, DOOR_H, { wall0: 0xf4f6f8, wall1: 0xd8dee6, floor: 0xc8ccd0 });
    I.rect(0, 4, w, 5, 0x1f5fb0); text(I, SMALL, 'KASSA', 3, 4, 0xf8cc1a);
    for (let k = 0; k < 3; k++) { const x = 6 + k * 12, y = DOOR_H - 7; I.hl(x, y, 3, 0xf8cc1a); I.hl(x + 1, y - 1, 3, 0xf8cc1a); I.hl(x + 1, y + 1, 3, 0xf8cc1a); I.px(x + 4, y, 0xf8cc1a); }
    for (let k = 0; k < 3; k++) { I.rect(w - 12, 14 + k * 3, 9, 3, 0x1f5fb0); I.hl(w - 12, 14 + k * 3, 9, 0x3a7ad0); I.px(w - 10, 13 + k * 3, 0x0a2450); I.px(w - 5, 13 + k * 3, 0x0a2450); }
  }, (P, pw, h, side) => {
    for (let y = 0; y < h; y++) for (let x = 0; x < pw; x++) { const d = (x + y + side * 5) % 13; P.px(x, y, d < 2 ? 0xffffff : 0xd8ecf8, d < 2 ? 0.5 : 0.22); }
    P.rect(0, 0, pw, 2, 0x0a2450); P.rect(0, h - 3, pw, 3, 0x0a2450); P.hl(0, h - 3, pw, 0x3a7ad0);
    P.vl(side ? pw - 2 : 0, 0, h, 0x1f5fb0); P.vl(side ? pw - 1 : 1, 0, h, 0x0a2450);
    for (let x = 2; x < pw - 2; x += 2) P.px(x, 14, 0xf8cc1a);
    P.rect(side ? 3 : pw - 9, 11, 6, 6, 0xf8cc1a); P.rect(side ? 4 : pw - 8, 12, 4, 4, 0x1f5fb0);
  });
  kit.flags = flagFrames();
  return kit;
}
function liveMobler(ctx, b, st) {
  const kit = KITS[b.id] || (KITS[b.id] = moblerKit(b));
  drawDoor(ctx, b, st, kit);
  const m = metaOf(b, st.night), t = st.t || 0;
  if (m?.sensor) { ctx.fillStyle = (st.doorOpen || 0) > 0.08 ? '#4aff6a' : '#b8262a'; ctx.fillRect(m.sensor[0], m.sensor[1], 2, 1); }
  // flaggstänger på takkanten
  const yT = BASE - b.h;
  [52, 110, 168].forEach((lx, i) => {
    const x = b.x + lx;
    ctx.fillStyle = '#d8dce4'; ctx.fillRect(x, yT - 30, 1, 28); ctx.fillStyle = '#6a707c'; ctx.fillRect(x + 1, yT - 30, 1, 28);
    ctx.fillStyle = '#f8cc1a'; ctx.fillRect(x, yT - 31, 2, 1);
    ctx.drawImage(kit.flags[Math.floor(t * 5 + i * 1.3) & 3], x + 2, yT - 31);
  });
  // möblerna i skyltfönstren när atlasen laddat (sätts ihop en gång)
  if (!m?.shows || !ATLAS || !ATLAS.complete || !ATLAS.naturalWidth) return;
  if (!m.comp) m.comp = m.shows.map((s) => {
    const c = document.createElement('canvas'); c.width = SHOW_W; c.height = SHOW_H;
    const x = c.getContext('2d');
    x.drawImage(s.room, 0, 0);
    for (const [k, fx, fy] of s.def.items) {
      const f = FRAMES[k];
      if (!f) continue;
      x.fillStyle = 'rgba(20,12,30,.22)'; x.fillRect(fx + 2, fy - 2, f[2] - 4, 2);
      x.drawImage(ATLAS, f[0], f[1], f[2], f[3], fx, fy - f[3], f[2], f[3]);
    }
    if (st.night) { x.fillStyle = 'rgba(255,236,190,.08)'; x.fillRect(0, 0, SHOW_W, SHOW_H); }
    x.drawImage(s.glass, 0, 0);
    return c;
  });
  m.shows.forEach((s, i) => ctx.drawImage(m.comp[i], s.x, s.y));
}

// ================= registret =================
const ART = {
  mobler: { paint: paintMobler, live: liveMobler, glow: glowFor },
  hem: { paint: paintHem, live: liveHem, glow: glowFor },
  mat: { paint: paintMat, live: liveMat, glow: glowFor },
  klader: { paint: paintKlader, live: (ctx, b, st) => drawDoor(ctx, b, st, KITS[b.id] || (KITS[b.id] = kladerKit(b))), glow: glowKlader },
  bostad: { paint: paintBostad, live: (ctx, b, st) => drawDoor(ctx, b, st, KITS[b.id] || (KITS[b.id] = bostadKit(b))), glow: glowFor },
};
export const BUILDING_ART = Object.fromEntries(['hem', 'bostad', 'mat', 'klader', 'mobler'].map((k) => [k, ART[k] || { paint: stubPaint, live: stubLive, glow: () => {} }]));
