// VILLAOMRÅDET (v5, Carl 2026-11-18: "villa området? gräsmattor, picket fence osv"): villorna – fristående hus
// på inhägnade tomter (map.js BUILDINGS_V). Samma målare för alla, med egen SPEC per hus: väggfärg (liggande
// träpanel med vita knutar och grå sockel), takform – sadeltak sett från gatan (tegelpannor eller falsad plåt,
// hängränna, stuprör, skorsten, ibland en kupa) eller gavel mot gatan (stående panel, vita vindskivor,
// vindsfönster) – fönster med spröjs, gardiner och fönsterbräda, blomlåda, ytterdörr med fönster och handtag,
// veranda med två trappsteg och skärmtak, lykta vid dörren (lyser om natten), husnummer, parabol, och på
// Äppelvägen 5 ett garage med vipport.
// Kontrakt (docs/STADEN.md): BUILDING_ART[kind] = { paint(b, night, opts) → canvas, glow(ctx, b, st) }.
// Bilden är b.w + 16 bred och står på b.base (artBox/artPos i map.js): canvas-x = världs-x − b.x + 8,
// canvas-y = världs-y − artBox(b).y. Fristående hus: bildens topp = base − d − h − 16, så huset fyller den
// nedre delen och gräsmattan bakom syns ovanför taket.
import { Pix, SMALL, text, textW, mix, mul, hash } from '../core/floor-pix.js';
import { ART_OVER, artBox, baseOf } from './map.js';

const O = ART_OVER, K = 0x1c1a20, WHITE = 0xffffff, TRIM = 0xf4f4ee, TRIM2 = 0xe2e2da, TRIM3 = 0xc4c4bc;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const rgba = (c, a) => `rgba(${(c >> 16) & 255},${(c >> 8) & 255},${c & 255},${clamp(a, 0, 1).toFixed(3)})`;
const seedOf = (id) => [...id].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) & 0xffff, 7);

// wall = panelens färg · roof 'tegel' | 'plat' (+ roofCol) · form 'sadel' | 'gavel' · kupa = takkupa · box = blomlåda
// curtain = gardinernas färg · door = dörrens färg · num = husnumret · chimney = skorstenens läge (0–1 av bredden)
const SPEC = {
  v_hus1: { wall: 0xc9a24a, roof: 'tegel', form: 'sadel', kupa: true, box: true, curtain: 0xd04848, door: 0x2f5a44, num: '2', chimney: 0.22 },
  v_hus2: { wall: 0x5a86b8, roof: 'plat', form: 'gavel', curtain: 0xf4f4ee, door: 0xf4f4ee, num: '4', chimney: 0.7, dish: true },
  v_villan: { wall: 0xdcc9a4, roof: 'tegel', form: 'sadel', kupa: true, box: true, curtain: 0xe8a0b8, door: 0x2a5aa8, num: '6', chimney: 0.2 },
  v_hus3: { wall: 0xb53a2e, roof: 'plat', roofCol: 0x3e4250, form: 'sadel', curtain: 0xf4f4ee, door: 0xf4f4ee, num: '8', chimney: 0.76, box: true },
  v_hus4: { wall: 0xf0d050, roof: 'tegel', form: 'gavel', curtain: 0x4a8ad0, door: 0x4a2a14, num: '10', chimney: 0.3, box: true },
  v_hus5: { wall: 0xb53a2e, roof: 'tegel', form: 'sadel', kupa: true, curtain: 0xf4f4ee, door: 0xf4f4ee, num: '1', chimney: 0.72 },
  v_hus6: { wall: 0xece4d4, roof: 'plat', roofCol: 0x4a5a56, form: 'sadel', curtain: 0x7ab06a, door: 0x2f5a44, num: '3', chimney: 0.3, box: true, dish: true },
  v_hus7: { wall: 0xf2f2ec, roof: 'tegel', form: 'sadel', garage: true, curtain: 0x8a9ab8, door: 0x1c1a20, num: '5', chimney: 0.25 },
  v_hus8: { wall: 0x6a9a5a, roof: 'plat', roofCol: 0x3e4250, form: 'gavel', curtain: 0xf4f4ee, door: 0x2a5aa8, num: '7', chimney: 0.7, box: true },
  v_hus9: { wall: 0xe8a0b8, roof: 'tegel', form: 'sadel', kupa: true, curtain: 0xf4f4ee, door: 0xf4f4ee, num: '9', chimney: 0.3, box: true },
};
const META = {};   // b.id → { lit: [[x, y, w, h] …], lamps: [[x, y] …] } i världskoordinater (glow)

// ---------- material ----------
// liggande träpanel: 4 px per bräda – ljus överkant, mörk skuggfog, lite brus
function boards(P, x, y, w, h, col, s) {
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const r = j % 4;
    let c = r === 0 ? mix(col, WHITE, 0.16) : r === 3 ? mul(col, 0.72) : r === 2 ? mul(col, 0.92) : col;
    const n = hash(x + i, y + j, s);
    if (n > 0.975) c = mul(c, 0.9); else if (n < 0.02) c = mix(c, WHITE, 0.08);
    P.px(x + i, y + j, c);
  }
}
// stående panel (gavelfältet)
const standing = (P, x, y, col, i) => P.px(x, y, i % 4 === 0 ? mix(col, WHITE, 0.14) : i % 4 === 3 ? mul(col, 0.78) : col);
// vita knutbrädor (3 px)
function knut(P, x, y, h) { P.vl(x, y, h, TRIM); P.vl(x + 1, y, h, TRIM2); P.vl(x + 2, y, h, TRIM3); }
// tegelpannor: rader om 3 px i förband, ljusare mot nocken
function tiles(P, x, y, w, h, col, s) {
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const row = Math.floor(j / 3), rj = j % 3, ii = i + (row & 1 ? 2 : 0);
    let c = rj === 0 ? mix(col, WHITE, 0.14) : rj === 2 ? mul(col, 0.68) : col;
    if (ii % 4 === 3) c = mul(c, 0.8);
    if (hash(x + i, y + j, s) > 0.965) c = mix(c, 0x6a6a5a, 0.3);
    P.px(x + i, y + j, mix(c, WHITE, ((h - j) / h) * 0.08));
  }
}
// falsad plåt: lodräta falsar var sjätte pixel
function seam(P, x, y, w, h, col, s) {
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const k = i % 6;
    let c = k === 0 ? mix(col, WHITE, 0.22) : k === 1 ? mul(col, 0.78) : col;
    if (hash(x + i, y + j, s) > 0.985) c = mix(c, WHITE, 0.15);
    P.px(x + i, y + j, mix(c, WHITE, ((h - j) / h) * 0.1));
  }
}
// fönster: mörk kontur, vit ram, glas (reflex om dagen, varmt ljus om natten), gardiner, spröjs, fönsterbräda
function win(P, x, y, w, h, o, lit) {
  P.box(x - 2, y - 2, w + 4, h + 4, K);
  P.box(x - 1, y - 1, w + 2, h + 2, TRIM);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const d = i + j - Math.floor((w + h) / 2) + 2;
    let c = o.night ? (j < 2 ? 0xffe8b0 : 0xffd080) : d < 0 ? 0x9cc4e0 : d === 0 ? 0xc8e4f4 : 0x7fa8c8;
    P.px(x + i, y + j, c);
  }
  if (o.curtain != null) for (let j = 0; j < h; j++) {
    P.px(x, y + j, o.curtain); P.px(x + 1, y + j, mul(o.curtain, 0.82));
    P.px(x + w - 1, y + j, o.curtain); P.px(x + w - 2, y + j, mul(o.curtain, 0.82));
  }
  if (o.cross) { P.vl(x + (w >> 1), y, h, TRIM); P.hl(x, y + (h >> 1), w, TRIM); }
  P.hl(x - 2, y + h + 1, w + 4, TRIM); P.hl(x - 2, y + h + 2, w + 4, 0x9a9a92);
  if (o.night) lit.push([x, y, w, h]);
}
// blomlådan under fönstret: brun låda, blommor i tre färger
function flowerBox(P, x, y, w, s) {
  P.rect(x, y, w, 4, 0x6a4a2a); P.hl(x, y, w, 0x8a6a3a); P.hl(x, y + 3, w, 0x4a2a14);
  for (let i = 1; i < w - 1; i += 2) { const c = [0xe04848, 0xf0d050, 0xffffff, 0xff8ac8][Math.floor(hash(i, s, 3) * 4)]; P.px(x + i, y - 1, c); if (hash(i, s, 4) > 0.5) P.px(x + i + 1, y - 2, c); P.px(x + i, y, 0x3e7a32); }
}
// ytterdörren: kontur, dörrblad med fönster upptill, speglar och handtag
function door(P, x, y, w, h, col, night) {
  P.box(x - 1, y - 1, w + 2, h + 2, K);
  P.rect(x, y, w, h, col);
  for (let j = 0; j < h; j++) { P.px(x, y + j, mix(col, WHITE, 0.15)); P.px(x + w - 1, y + j, mul(col, 0.7)); }
  P.box(x + 2, y + 2, w - 4, 6, mul(col, 0.6));
  P.rect(x + 3, y + 3, w - 6, 4, night ? 0xffd080 : 0x8fb6d6);
  P.hl(x + 3, y + 10, w - 6, mul(col, 0.7)); P.hl(x + 3, y + 14, w - 6, mul(col, 0.7));
  P.px(x + w - 4, y + (h >> 1) + 1, 0xf0d050); P.px(x + w - 3, y + (h >> 1) + 1, 0xa08020);
}
// verandan: två trappsteg i granit (ljus ovansida) och skärmtaket över dörren på två vita konsoler
function porch(P, cx, baseY, w) {
  P.rect(cx - (w >> 1) - 2, baseY - 4, w + 4, 2, 0xa8a498); P.hl(cx - (w >> 1) - 2, baseY - 4, w + 4, 0xd8d4c8);
  P.rect(cx - (w >> 1) - 4, baseY - 2, w + 8, 2, 0x9a968a); P.hl(cx - (w >> 1) - 4, baseY - 2, w + 8, 0xccc8bc);
}
function canopy(P, cx, y, w, col) {
  const x0 = cx - (w >> 1);
  P.hl(x0, y - 1, w, mix(col, WHITE, 0.25)); P.hl(x0, y, w, col); P.hl(x0, y + 1, w, mul(col, 0.65));
  P.px(x0 - 1, y, K); P.px(x0 + w, y, K);
  P.px(x0 + 1, y + 2, TRIM); P.px(x0 + 2, y + 3, TRIM); P.px(x0 + w - 2, y + 2, TRIM); P.px(x0 + w - 3, y + 3, TRIM);
}
// lyktan vid dörren: svart lykta på konsol, glaset lyser om natten
function lantern(P, x, y, night, lit, lamps) {
  P.hl(x - 2, y - 2, 3, 0x2a2a30); P.px(x, y - 3, 0x2a2a30);
  P.rect(x - 1, y - 1, 3, 4, 0x2a2a30);
  P.px(x, y, night ? 0xffe8a0 : 0xd8e8f0); P.px(x, y + 1, night ? 0xffd060 : 0xb8c8d8);
  P.px(x, y + 3, 0x2a2a30);
  if (night) { lit.push([x, y, 1, 2]); lamps.push([x, y]); }
}
function numberPlate(P, x, y, num) {
  const w = textW(SMALL, num) + 4;
  P.rect(x, y, w, 7, TRIM); P.box(x, y, w, 7, 0x4a4a44);
  text(P, SMALL, num, x + 2, y + 1, K);
}
// skorstenen: tegel i förband med en krona i betong
function chimney(P, x, y, h, s) {
  P.rect(x - 1, y, 8, 2, 0x8a8a84); P.hl(x - 1, y, 8, 0xb8b8b0);
  for (let j = 0; j < h; j++) for (let i = 0; i < 6; i++) {
    const row = j >> 1;
    P.px(x + i, y + 2 + j, (j & 1) ? mul(0x9a4a3a, 0.72) : ((i + (row & 1 ? 2 : 0)) % 3 === 2 ? 0xc8a088 : hash(i, j, s) > 0.8 ? 0x7a3a2a : 0x9a4a3a));
  }
  P.vl(x + 5, y + 2, h, mul(0x9a4a3a, 0.6));
}
// takkupan: liten gavel i takfallet med ett fönster
function dormer(P, cx, rt, rh, spec, roofCol, night, lit, s) {
  const w = 18, y0 = rt + 6, y1 = rt + rh - 1;
  boards(P, cx - (w >> 1), y0, w, y1 - y0, spec.wall, s + 3);
  knut(P, cx - (w >> 1), y0, y1 - y0); knut(P, cx + (w >> 1) - 3, y0, y1 - y0);
  win(P, cx - 4, y0 + 3, 8, 7, { night, curtain: spec.curtain, cross: true }, lit);
  for (let k = 0; k < 6; k++) { const hw = (w >> 1) + 2 - k * 2; if (hw < 1) break; P.hl(cx - hw, y0 - 1 - k, hw * 2 + 1, k === 5 ? mix(roofCol, WHITE, 0.3) : k === 0 ? mul(roofCol, 0.55) : mul(roofCol, 0.85)); }
  P.px(cx - (w >> 1) - 3, y0 - 1, K); P.px(cx + (w >> 1) + 2, y0 - 1, K);
}
// parabolen: grå skål på en arm vid takfoten
function dish(P, x, y) {
  for (let j = 0; j < 5; j++) { const hw = j === 0 || j === 4 ? 1 : 2; for (let i = -hw; i <= hw; i++) P.px(x + i, y + j, i < 0 ? 0xd8dce0 : 0xa8b0b8); }
  P.px(x + 3, y + 2, 0x5a6068); P.px(x + 4, y + 3, 0x5a6068); P.px(x + 2, y + 2, 0x2a2a30);
}
// garaget (Äppelvägen 5): lägre längd med egen takbit och vipport med fönsterremsa
function garage(P, x, baseY, gw, roofCol, spec, s) {
  const wh = 24, wt = baseY - wh, rh = 10;
  boards(P, x, wt, gw, wh - 3, spec.wall, s + 5);
  P.rect(x, baseY - 3, gw, 3, 0x8a8a84);
  knut(P, x + gw - 3, wt, wh - 3);
  (spec.roof === 'tegel' ? tiles : seam)(P, x - 2, wt - rh, gw + 6, rh, roofCol, s + 6);
  P.hl(x - 2, wt - rh, gw + 6, mix(roofCol, WHITE, 0.3)); P.px(x + gw + 4, wt - rh, K);
  P.hl(x - 3, wt - 1, gw + 8, 0xd8d8d0); P.hl(x - 3, wt, gw + 8, 0x8a8a84);
  const px = x + 6, pw = gw - 12, py = baseY - 19;
  P.box(px - 1, py - 1, pw + 2, 20, K);
  for (let j = 0; j < 19; j++) for (let i = 0; i < pw; i++) P.px(px + i, py + j, j % 5 === 4 ? 0xa8a8a0 : j % 5 === 0 ? WHITE : 0xe8e8e0);
  P.hl(px + 2, py + 8, pw - 4, 0x8fb6d6); P.hl(px + 2, py + 9, pw - 4, 0x7fa8c8);
  P.hl(px + (pw >> 1) - 1, py + 15, 3, 0x4a4a44);
}
// mörk kontur runt hela silhuetten (som resten av stadens hus)
function outline(P) {
  const w = P.w, h = P.h, d = P.img.data, a = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : d[(y * w + x) * 4 + 3]);
  const edge = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (!a(x, y) && (a(x - 1, y) || a(x + 1, y) || a(x, y - 1) || a(x, y + 1))) edge.push(x, y);
  for (let i = 0; i < edge.length; i += 2) P.px(edge[i], edge[i + 1], K, 0.9);
}

function paintVilla(b, night, opts = {}) {
  const spec = SPEC[b.id] || SPEC.v_hus1, box = artBox(b), top = box.y, base = baseOf(b);
  const CW = b.w + 2 * O, CH = base + 4 - top, P = new Pix(CW, CH), s = seedOf(b.id);
  const baseY = base - top, L = O, W = b.w;
  const lit = [], lamps = [];
  const gw = spec.garage ? 40 : 0, hw = W - gw;                 // huset (utan garaget) till vänster
  const wh = 34, rh = spec.form === 'gavel' ? 26 : 22, wallTop = baseY - wh;
  const roofCol = spec.roofCol || (spec.roof === 'tegel' ? 0xb4553c : 0x3e4250);
  // ---- panelen, sockeln, knutarna ----
  boards(P, L, wallTop, hw, wh - 4, spec.wall, s);
  P.rect(L, baseY - 4, hw, 4, 0x8a8a84);
  for (let i = 0; i < hw; i++) if (hash(i, 1, s) > 0.8) P.px(L + i, baseY - 3 + ((hash(i, 2, s) * 3) | 0), 0x6e6e68);
  knut(P, L, wallTop, wh - 4); knut(P, L + hw - 3, wallTop, wh - 4);
  // ---- taket ----
  const cx = L + (hw >> 1);
  if (spec.form === 'gavel') {
    const ridge = wallTop - rh;
    for (let y = wallTop - 1; y >= ridge; y--) {
      const t = (wallTop - 1 - y) / (rh - 1), half = Math.round(((hw >> 1) + 3) * (1 - t));
      for (let x = cx - half; x <= cx + half; x++) {
        if (x <= cx - half + 1 || x >= cx + half - 1) P.px(x, y, x < cx ? TRIM : TRIM2);   // vindskivorna
        else standing(P, x, y, spec.wall, x - L);
      }
      P.px(cx - half - 1, y, K); P.px(cx + half + 1, y, K);
    }
    P.hl(cx - 1, ridge - 1, 3, TRIM);
    P.hl(L - 2, wallTop - 1, hw + 4, mul(spec.wall, 0.6), 0.5);                                   // skugga under gavelns takfot
    win(P, cx - 4, wallTop - 14, 8, 7, { night, curtain: null, cross: true }, lit);
    chimney(P, cx + 8, ridge + 6, 8, s);
  } else {
    const rt = wallTop - rh;
    (spec.roof === 'tegel' ? tiles : seam)(P, L - 4, rt, hw + 8, rh, roofCol, s);
    P.hl(L - 4, rt, hw + 8, mix(roofCol, WHITE, 0.3)); P.hl(L - 4, rt + 1, hw + 8, mul(roofCol, 0.6));   // nocken
    P.px(L - 5, rt, K); P.px(L + hw + 4, rt, K);
    P.hl(L - 5, wallTop - 1, hw + 10, 0xd8d8d0); P.hl(L - 5, wallTop, hw + 10, 0x8a8a84);                 // hängrännan
    P.hl(L, wallTop + 1, hw, mul(spec.wall, 0.6), 0.55);                                                     // skuggan under takfoten
    chimney(P, L + Math.round(hw * spec.chimney), rt - 8, 10, s);
    if (spec.kupa) dormer(P, cx + (spec.garage ? 0 : 16), rt, rh, spec, roofCol, night, lit, s);
    if (opts.snow) for (let i = -4; i < hw + 4; i++) { P.px(L + i, rt, 0xf6f8ff); P.px(L + i, rt + 1, 0xe6ecfa); if (hash(i, 9, s) > 0.5) P.px(L + i, rt + 2, 0xf6f8ff); }
  }
  // stupröret vid högra knuten
  P.vl(L + hw + 2, wallTop + 1, wh - 1, 0xb8b8b0); P.vl(L + hw + 3, wallTop + 1, wh - 1, 0x7a7a74); P.hl(L + hw, wallTop, 4, 0xb8b8b0);
  // ---- fönster, dörr, veranda ----
  const dc = Math.round((b.door.x0 + b.door.x1) / 2 - b.x + O), dw = 14, dh = 18;
  const wl = dc - (dw >> 1) - 22, wr = dc + (dw >> 1) + 10;
  if (wl - 4 > L + 3) { win(P, wl, wallTop + 9, 12, 11, { night, curtain: spec.curtain, cross: true }, lit); if (spec.box) flowerBox(P, wl - 1, wallTop + 23, 14, s); }
  if (wr + 16 < L + hw - 3) win(P, wr, wallTop + 9, 12, 11, { night, curtain: spec.curtain, cross: true }, lit);
  door(P, dc - (dw >> 1), baseY - dh, dw, dh, spec.door, night);
  porch(P, dc, baseY, dw);
  canopy(P, dc, baseY - dh - 4, dw + 10, roofCol);
  lantern(P, dc + (dw >> 1) + 4, baseY - dh + 4, night, lit, lamps);
  numberPlate(P, dc - (dw >> 1) - 4 - textW(SMALL, spec.num), baseY - dh + 2, spec.num);
  if (gw) garage(P, L + hw, baseY, gw, roofCol, spec, s);
  if (spec.dish) dish(P, L + hw - 12, wallTop - 6);
  outline(P);
  // kontaktskuggan på gräset
  P.hl(L - 2, baseY, hw + gw + 4, 0x1a2a14, 0.3); P.hl(L - 1, baseY + 1, hw + gw + 2, 0x1a2a14, 0.15);
  META[b.id] = { lit: lit.map(([x, y, w, h]) => [x + b.x - O, y + top, w, h]), lamps: lamps.map(([x, y]) => [x + b.x - O, y + top]) };
  return P.flush();
}
function glow(ctx, b, st) {
  const m = META[b.id], k = clamp((st.env?.dark ?? (st.night ? 0.5 : 0)) / 0.5, 0, 1);
  if (!m || k <= 0 || !m.lit.length) return;
  ctx.globalCompositeOperation = 'lighter';
  for (const [x, y, w, h] of m.lit) {
    ctx.fillStyle = rgba(0xffc870, 0.34 * k); ctx.fillRect(x, y, w, h);
    ctx.fillStyle = rgba(0xff9a40, 0.1 * k); ctx.fillRect(x - 2, y - 1, w + 4, h + 4);
  }
  for (const [x, y] of m.lamps) { ctx.fillStyle = rgba(0xffd080, 0.22 * k); ctx.fillRect(x - 6, y - 4, 13, 11); ctx.fillStyle = rgba(0xffe8a0, 0.5 * k); ctx.fillRect(x - 1, y - 1, 3, 4); }
  ctx.globalCompositeOperation = 'source-over';
}

const art = { paint: paintVilla, glow };
export const BUILDING_ART = Object.fromEntries(Object.keys(SPEC).map((k) => [k, art]));
export const _SPEC = SPEC;
export const _meta = (id) => META[id] || null;   // (för testerna)
