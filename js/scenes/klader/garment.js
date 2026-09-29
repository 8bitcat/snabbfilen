// KLÄDER – plaggen på galgarna och lagets skyltdockor.
//
// Ett plagg på en galge ritas ur samma figurmotor som allt annat (people.js): dockan ritas
// två gånger med plaggets färger respektive helt andra färger, och de pixlar som skiljer är
// plagget. De klipps ut, får en egen kontur och hänger sedan på stången – precis som de ser ut
// på en figur, i alla katalogens 200+ modeller utan en enda handritad bild.
//
// Lagets skyltdockor (Kungsladugård och de kända lagen) får strumpor över smalbenen och –
// sedda bakifrån – nummer och förnamn på ryggen, ritade ovanpå figuren i samma pixelkorn.
import { drawPerson, entryOf } from '../../core/people.js';
import { lookForItem } from '../../data/wardrobe.js';
import { SMALL, BIG, textW, eachTextPixel, mix, mul, hex, css } from '../../core/floor-pix.js';

const SW = 24, SH = 41, FX = 12, FY = 39;
const INK = [29, 24, 34];

function render(look, dir = 'down') {
  const c = document.createElement('canvas'); c.width = SW; c.height = SH;
  const x = c.getContext('2d', { willReadFrequently: true });
  drawPerson(x, FX, FY, look, dir, 0);
  return { c, x, d: x.getImageData(0, 0, SW, SH).data };
}
// pixlar som skiljer mellan två renderingar
function diffMask(a, b) {
  const m = new Uint8Array(SW * SH);
  for (let i = 0; i < SW * SH; i++) {
    const k = i * 4;
    if (a[k] !== b[k] || a[k + 1] !== b[k + 1] || a[k + 2] !== b[k + 2] || a[k + 3] !== b[k + 3]) m[i] = 1;
  }
  return m;
}
const rgb = (h) => { const n = parseInt(String(h).slice(1), 16) || 0; return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const lum = (r, g, b) => 0.299 * r + 0.587 * g + 0.114 * b;

// ---------------- plagg på galge ----------------
// Neutral docka: skallig, grå hud – plagget ger färgerna. Plagg utan färgförslag får en färg
// ur en fast palett (samma plagg = samma färg varje gång).
const DOLL = { skin: '#ece6ee', style: 'bald', hair: '#ecd489', beard: false, glasses: false, phones: false, bag: null, hat: null, top: 'tank', shirt: '#f4f1ea', accent: '#f4f1ea', bottom: 'jeans', pants: '#3f5f8f', pants2: '#f4f1ea', shoes: '#1c1c1c', shoeType: 'normal', build: 5 };
const PAL = ['#d9433b', '#3a7bd5', '#46a35a', '#f0b429', '#8e5bd1', '#2aa39a', '#e07a2e', '#b83d7a', '#5f7f99', '#f28bb3'];
const pick = (id, k) => { let h = 7; for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) | 0; return PAL[Math.abs(h + k * 3) % PAL.length]; };
// plagg som färgas med tröjfärgen fast de är underdelar (klänningar, jumpsuits)
export const isDressLike = (it) => it.slot === 'bottom' && entryOf('bottom', it.look.bottom)?.colorField === 'shirt';

// Plaggets färger: förslagen i katalogen, annars ur paletten (colors = egna, t.ex. ett lags)
export function garmentColors(it, colors = null) {
  const c = { ...(it.colors || {}), ...(colors || {}) };
  if (it.slot === 'top') { c.shirt ||= pick(it.id, 0); c.accent ||= '#f4f1ea'; c.print2 ||= '#f4f1ea'; }
  else if (it.slot === 'bottom') {
    if (isDressLike(it)) { c.shirt ||= pick(it.id, 1); c.pants2 ||= '#f4f1ea'; }
    else { c.pants ||= pick(it.id, 2); c.pants2 ||= '#f4f1ea'; }
  }
  // skor, hattar, väskor …: bara katalogens (eller lagets) egna färger – aldrig tröj- eller
  // byxfärgen. Förr fick skorna byxfärger här, och i ett matchställ skrev de över shortsen.
  return c;
}

const cache = new Map();
// → { img, ox, oy, w, h, bottom } | null: ox/oy = bildens hörn relativt galgens krok (x = plaggets mitt)
export function garmentImg(it, colors = null) {
  const key = it.id + '|' + (colors ? JSON.stringify(colors) : '');
  if (cache.has(key)) return cache.get(key);
  const col = garmentColors(it, colors);
  const dress = isDressLike(it);
  const base = { ...DOLL, ...(it.slot === 'bottom' ? { top: dress ? 'tube' : 'tank', shirt: DOLL.shirt } : {}) };
  const look = lookForItem(it, base);
  Object.assign(look, it.slot === 'top' ? { shirt: col.shirt, accent: col.accent, print2: col.print2 }
    : dress ? { shirt: col.shirt, pants2: col.pants2, accent: col.accent || DOLL.accent } : { pants: col.pants, pants2: col.pants2 });
  const alt = it.slot === 'top' ? { shirt: '#01fe03', accent: '#fe02fd', print2: '#03fdfe' }
    : dress ? { shirt: '#01fe03', pants2: '#03fdfe', accent: '#fe02fd', pants: '#fd03fe' } : { pants: '#01fe03', pants2: '#03fdfe' };
  // trycket bort i jämförelsen: mönster i fasta färger (regnbåge, flagga …) räknas också till plagget
  const A = render(look), B = render({ ...look, ...alt, ...(it.slot === 'top' ? { topPrint: 'none' } : { bottomPrint: 'none' }) });
  const m = diffMask(A.d, B.d);
  // bara bål/ben – inte t.ex. en hätta som bara syns som en kant runt huvudet
  let x0 = SW, y0 = SH, x1 = -1, y1 = -1;
  for (let y = 0; y < SH; y++) for (let x = 0; x < SW; x++) if (m[y * SW + x]) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  if (x1 < 0) { cache.set(key, null); return null; }
  x0 = Math.max(0, x0 - 1); y0 = Math.max(0, y0 - 1); x1 = Math.min(SW - 1, x1 + 1); y1 = Math.min(SH - 1, y1 + 1);
  const w = x1 - x0 + 1, h = y1 - y0 + 1;
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const cx = c.getContext('2d');
  const out = cx.createImageData(w, h), o = out.data;
  const inM = (x, y) => x >= 0 && y >= 0 && x < SW && y < SH && m[y * SW + x];
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const k = (y * SW + x) * 4, j = ((y - y0) * w + (x - x0)) * 4;
    if (m[y * SW + x]) { o[j] = A.d[k]; o[j + 1] = A.d[k + 1]; o[j + 2] = A.d[k + 2]; o[j + 3] = 255; continue; }
    // egen kontur runt plagget (där det gränsade mot hud/huvud står nu en mörk kant)
    if (inM(x - 1, y) || inM(x + 1, y) || inM(x, y - 1) || inM(x, y + 1)) {
      const dark = A.d[k + 3] > 200 && lum(A.d[k], A.d[k + 1], A.d[k + 2]) < 70;
      o[j] = dark ? A.d[k] : INK[0]; o[j + 1] = dark ? A.d[k + 1] : INK[1]; o[j + 2] = dark ? A.d[k + 2] : INK[2]; o[j + 3] = 255;
    }
  }
  cx.putImageData(out, 0, 0);
  // överdelar/klänningar hänger i axlarna, byxor/kjolar i linningen
  const hangY = y0; // översta raden
  const g = { img: c, ox: x0 - FX, oy: 0, w, h, top: hangY, waist: it.slot === 'bottom' && !dress };
  cache.set(key, g);
  return g;
}

// Ritar ett plagg som hänger i en krok på stången (cx = krokens x, ry = stångens y)
export function drawHanging(ctx, it, cx, ry, colors = null) {
  const g = garmentImg(it, colors);
  if (!g) return 0;
  const top = ry + 3;
  // galge: krok + axelbåge (överdelar) eller klämgalge (byxor/kjolar)
  ctx.fillStyle = '#8a8e9a';
  ctx.fillRect(cx, ry - 1, 1, 1); ctx.fillRect(cx - 1, ry - 2, 2, 1); ctx.fillRect(cx, ry + 1, 1, 2);
  ctx.drawImage(g.img, cx + g.ox, top);
  if (g.waist) {
    ctx.fillStyle = '#6d717c'; ctx.fillRect(cx - 5, top - 1, 11, 1);
    ctx.fillStyle = '#c9ccd6'; ctx.fillRect(cx - 5, top - 1, 1, 2); ctx.fillRect(cx + 5, top - 1, 1, 2);
  } else {
    ctx.fillStyle = '#b8bcc6'; ctx.fillRect(cx - 4, top, 9, 1);
  }
  return g.h;
}

// ---------------- lagets skyltdockor ----------------
const DIG = (d) => SMALL[d].rows;
const dollCache = new Map();
// opts: { socks, stripe, number, name } – nummer och namn ritas bara bakifrån ('up')
export function teamDoll(look, dir = 'down', opts = {}) {
  const key = JSON.stringify([look, dir, opts]);
  if (dollCache.has(key)) return dollCache.get(key);
  const A = render(look, dir);
  const d = A.d;
  // hud på smalbenen → strumpor (skillnad mot samma docka med annan hud)
  if (opts.socks) {
    const S = render({ ...look, skin: '#01fe03' }, dir);
    const sk = diffMask(d, S.d);
    const skin = rgb(look.skin || '#ece6ee'), sl = lum(...skin) || 1;
    const sc = rgb(opts.socks), st = rgb(opts.stripe || opts.socks);
    let first = -1;
    for (let y = 29; y < 37; y++) for (let x = 0; x < SW; x++) if (sk[y * SW + x]) { if (first < 0 || y < first) first = y; }
    if (first >= 0) {
      const from = Math.max(first, 31);
      for (let y = from; y < 37; y++) for (let x = 0; x < SW; x++) {
        const i = y * SW + x;
        if (!sk[i]) continue;
        const k = i * 4, f = Math.max(0.55, Math.min(1.15, lum(d[k], d[k + 1], d[k + 2]) / sl));
        const r = y - from === 1 || y - from === 3 ? st : sc;
        d[k] = Math.min(255, r[0] * f + (r === sc ? 10 : 0)); d[k + 1] = Math.min(255, r[1] * f + (r === sc ? 8 : 0)); d[k + 2] = Math.min(255, r[2] * f + (r === sc ? 12 : 0));
      }
    }
  }
  // ryggen: förnamnet som en rad vita prickar under kragen, numret (3×5-siffror) under
  if (dir === 'up' && opts.number != null) {
    const shirt = rgb(look.shirt || '#7a1f2e'), shl = lum(...shirt) || 1;
    const tw = look.build === 4 ? 4 : look.build === 6 ? 6 : 5;
    const tx0 = 12 - tw, tx1 = 11 + tw;
    const onShirt = (x, y) => { const k = (y * SW + x) * 4; return d[k + 3] > 200 && Math.abs(d[k] - shirt[0]) + Math.abs(d[k + 1] - shirt[1]) + Math.abs(d[k + 2] - shirt[2]) < 120; };
    const white = (x, y) => {
      if (x < tx0 || x > tx1 || !onShirt(x, y)) return;
      const k = (y * SW + x) * 4, sh = lum(d[k], d[k + 1], d[k + 2]) < shl * 0.85;
      d[k] = sh ? 206 : 244; d[k + 1] = sh ? 200 : 241; d[k + 2] = sh ? 192 : 234;
    };
    const s = String(opts.number), digits = [...s].map(DIG);
    const w = digits.reduce((a, g) => a + g[0].length, 0) + digits.length - 1;
    let x = 12 - Math.ceil(w / 2);
    const y0 = 21;
    for (const g of digits) { g.forEach((row, j) => { for (let i = 0; i < row.length; i++) if (row[i] === '#') white(x + i, y0 + j); }); x += g[0].length + 1; }
    if (opts.name) {
      // namnet är för långt för 1× – en rad bokstavsprickar i namnets längd (två tända, en släckt)
      const n = String(opts.name), len = Math.min(tw * 2 - 2, Math.max(3, Math.round(n.length * 0.9)));
      const nx = 12 - Math.ceil(len / 2);
      for (let i = 0; i < len; i++) if (i % 3 !== 2 || i === len - 1) white(nx + i, 19);
    }
  }
  A.x.putImageData(new ImageData(d, SW, SH), 0, 0);
  dollCache.set(key, A.c);
  return A.c;
}
// Ritar en lagdocka med fötterna i (x, y) – samma skugga och placering som drawPerson
export function drawTeamDoll(ctx, x, y, look, dir, opts) {
  ctx.drawImage(teamDoll(look, dir, opts), Math.round(x) - FX, Math.round(y) - FY);
}

// ---------------- matchtröjan bakifrån (köpdialogen) ----------------
// På skyltdockan får förnamnet bara plats som en rad prickar; här ritas ryggen stor: FÖRNAMNET
// i spelets lilla typsnitt och NUMRET i det stora (dubbel storlek), vitt på lagets tröja med
// ljusare ärmslut. kit = { shirt, accent }. → canvas JB_W × JB_H i 1×.
export const JB_W = 58, JB_H = 50;
export function jerseyBack(number, name, kit) {
  const c = document.createElement('canvas'); c.width = JB_W; c.height = JB_H;
  const x = c.getContext('2d');
  const base = hex(kit.shirt, 0x7a1f2e), acc = hex(kit.accent, 0xd9434b);
  const hi = mix(base, 0xffffff, 0.16), lo = mul(base, 0.74), deep = mul(base, 0.58);
  const accLo = mul(acc, 0.78), ink = 0x1d1822, white = 0xf4f1ea, whiteLo = 0xd8cfc6;
  // silhuetten: bål, axelok, ärmar (vänster ärm speglas till höger)
  const M = JB_W - 1;
  const sleeve = (px, py) => px >= 2 && px <= 12 && py >= 5 + (12 - px) * 0.55 && py <= 20 - (12 - px) * 0.28;
  const inside = (px, py) => {
    if (px < 0 || py < 0 || px > M || py >= JB_H) return false;
    if (py >= 5 && py <= 47 && px >= 12 && px <= M - 12) return true;                     // bålen
    if (py >= 1 && py < 5 && px >= 20 - (py - 1) * 2 && px <= M - 20 + (py - 1) * 2) return true; // axlarna
    return sleeve(px, py) || sleeve(M - px, py);
  };
  const put = (px, py, col) => { x.fillStyle = css(col); x.fillRect(px, py, 1, 1); };
  for (let py = 0; py < JB_H; py++) for (let px = 0; px < JB_W; px++) {
    if (!inside(px, py)) {
      // kontur runt tröjan
      if (inside(px - 1, py) || inside(px + 1, py) || inside(px, py - 1) || inside(px, py + 1)) put(px, py, ink);
      continue;
    }
    const sx = Math.min(px, M - px);                  // avstånd från närmaste kant (ärmarna spegelvända)
    let col = (px + 2 * py) % 4 === 0 ? mix(base, 0xffffff, 0.06) : base; // nätstrukturen i tyget
    if (sx < 12 && py > 4) {
      // ärmarna: ljusare ovansida, mörkare undersida, ärmslut i detaljfärgen
      const top = 5 + (12 - sx) * 0.55, bot = 20 - (12 - sx) * 0.28;
      if (sx <= 4) col = py >= bot - 1 ? accLo : acc;
      else if (py < top + 1.2) col = px < JB_W / 2 ? hi : base;
      else if (py > bot - 1.5) col = lo;
    }
    if (py === 1) col = acc;                                                            // kragen (ribbad kant)
    else if (py === 2 && sx >= 20) col = accLo;
    else if ((py === 3 || py === 4) && sx >= 18) col = mix(col, 0x000000, 0.08);       // skugga under kragen
    if (px === 12 && py > 4 && py < 46) col = hi;                                     // ljuset från vänster
    if (px === M - 12 && py > 4 && py < 46) col = lo;
    if (px === M - 13 && py > 18 && py < 46) col = mix(col, lo, 0.5);
    if (py >= 46) col = py === 47 ? deep : lo;                                         // fållen
    // veck vid ärmhålen och nertill
    if ((py - 21 === px - 14 && px >= 14 && px <= 16) || (py - 21 === M - 14 - px && px <= M - 14 && px >= M - 16)) col = lo;
    if ((px === 17 && py >= 38 && py <= 44) || (px === M - 19 && py >= 36 && py <= 43)) col = mix(col, lo, 0.7);
    put(px, py, col);
  }
  // halsringningen syns som en mörk båge innanför kragen
  for (let px = 22; px <= M - 22; px++) put(px, 0, ink);
  // FÖRNAMNET (lilla typsnittet) och NUMRET (stora typsnittet, dubbel storlek) i vitt
  const nm = String(name || '').toUpperCase(), num = String(number);
  const lit = new Set();
  const text = (F, s, tx, tyy, scale) => eachTextPixel(F, s, tx, tyy, scale, (qx, qy) => { if (inside(qx, qy)) lit.add(qy * JB_W + qx); });
  if (nm) text(SMALL, nm, Math.round(JB_W / 2 - textW(SMALL, nm) / 2), 9, 1);
  text(BIG, num, Math.round(JB_W / 2 - textW(BIG, num, 2) / 2), 18, 2);
  for (const k of lit) {
    const qx = k % JB_W, qy = (k / JB_W) | 0;
    put(qx, qy, white);
    // trycket ligger på tyget: en matt rad under varje bokstav/siffra
    if (!lit.has(k + JB_W) && inside(qx, qy + 1)) put(qx, qy + 1, mix(base, whiteLo, 0.3));
  }
  return c;
}
