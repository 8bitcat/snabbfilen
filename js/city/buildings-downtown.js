// DOWNTOWN (v3): fasadkonst för finanskvarterets nio hus mellan Infarten och floden.
//   norra raden (Pixelgatan):  kontor1 FINANSHUSET, bank PIXELBANKEN, elektronik ELEKTRONIK, kontor2 BÖRSHUSET
//   södra raden (Södergatan):  kontor3 PIXEL TOWER, skor SKOBUTIKEN, frisor FRISÖR, accessoarer ACCESSOARER, kontor4 GLASTORNET
// Husen och deras mått står i js/city/map.js (BUILDINGS_D) – id/kind, door och artBox är låsta.
//
// Kontraktet (docs/STADEN.md avsnitt 4 och 8.2): BUILDING_ART[kind] = { paint(b, night, opts) → canvas,
// live(ctx, b, st), glow(ctx, b, st) }. paint cachas av scenen per (hus, natt, snö); allt som rör
// sig ritas i live (karuselldörrar, tv-väggar, börstickern, barberarstolpen, flaggor, folk i
// lobbyerna, flyghinderljus) och glow ritar ljuset efter mörkret (kontorsfönster som släcks
// sent, skyltfönster, skärmar, skyltarnas neon).
//
// Bildens koordinater: bredd b.w + 16 (8 px överhäng), höjd = artBox(b).h. Canvas-x = världs-x − b.x + 8,
// canvas-y = världs-y − artBox(b).y (0 för norra raden, 400–454 för den södra). Markytan (b.base)
// ligger på bildens rad höjd − 4. Ett pixelkorn, ljuset snett från sydväst (vänsterkanter ljusa,
// högerkanter och undersidor i skugga), skyltar bara med spelets pixeltypsnitt (floor-pix.js).
import { Pix, SMALL, BIG, text, textW, eachTextPixel, mix, mul, hash, bayer } from '../core/floor-pix.js';
import { artBox, baseOf } from './map.js';

// Figurerna (portier, folk i lobbyerna) – laddas för sig så att ett fel där aldrig fäller husen.
let drawPersonFn = null;
import('../core/people.js').then((m) => { if (typeof m.drawPerson === 'function') drawPersonFn = m.drawPerson; }).catch(() => {});

// ================= grundverktyg =================
const WHITE = 0xffffff;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const rgba = (c, a) => `rgba(${(c >> 16) & 255},${(c >> 8) & 255},${c & 255},${clamp(a, 0, 1).toFixed(3)})`;
const rgb = (c) => '#' + (c & 0xffffff).toString(16).padStart(6, '0');
// kvantiserad toning (n steg + bayer-dither) – aldrig mjuka övergångar
const q = (t, x, y, n = 4) => clamp(Math.round(clamp(t, 0, 1) * n + bayer(x, y) - 0.5), 0, n) / n;
function area(P, x, y, w, h, fn) {
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const c = fn(x + i, y + j, i, j); if (c !== null && c !== undefined) P.px(x + i, y + j, c); }
}
function vgrad(P, x, y, w, h, c0, c1, n = 4) {
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) P.px(x + i, y + j, mix(c0, c1, q(h > 1 ? j / (h - 1) : 0, x + i, y + j, n)));
}
// färg med lätt brus → levande ytor
function jit(c, x, y, s = 0, amt = 0.08) {
  const n = (hash(x, y, s) - 0.5) * amt + (bayer(x, y) - 0.5) * amt * 0.4;
  return n >= 0 ? mix(c, WHITE, n) : mix(c, 0, -n);
}
// värdebrus 0–1 (bilinjärt, mjukt) – moln i speglingarna, marmorådring
function noise(x, y, s = 0) {
  const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi;
  const a = hash(xi, yi, s), b = hash(xi + 1, yi, s), c = hash(xi, yi + 1, s), d = hash(xi + 1, yi + 1, s);
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
// text med tonad fyllning (ljus överkant, mörk nederkant), skugga och kontur
function signText(P, F, s, x, y, c, o = {}) {
  const sc = o.sc || 1, hgt = F.h * sc;
  if (o.shadow !== undefined) eachTextPixel(F, s, x + 1, y + 1, sc, (px, py) => P.px(px, py, o.shadow, o.shadowA ?? 1));
  if (o.outline !== undefined) for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) eachTextPixel(F, s, x + dx, y + dy, sc, (px, py) => P.px(px, py, o.outline));
  eachTextPixel(F, s, x, y, sc, (px, py) => {
    const t = (py - y) / hgt;
    P.px(px, py, t < 0.3 && o.hi !== undefined ? o.hi : t > 0.7 && o.lo !== undefined ? o.lo : c);
  });
}
const centerX = (F, s, cx, sc = 1) => Math.round(cx - textW(F, s, sc) / 2);
// glödbild av en text (kärna + halo) → [canvas, x, y] i världskoordinater; ritas med 'lighter' i glow
// halo = false: bara bokstäverna tänds (skyltar av bakbelysta bokstäver på ljus sten – ingen dimma runt)
function textGlow(F, s, sc, c, x, y, halo = true) {
  const up = 2 * sc, w = textW(F, s, sc) + 4, h = F.h * sc + up + 4, on = new Uint8Array(w * h);
  eachTextPixel(F, s, 2, up + 2, sc, (px, py) => { if (px >= 0 && py >= 0 && px < w && py < h) on[py * w + px] = 1; });
  const G = new Pix(w, h), core = mix(c, WHITE, 0.35);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    if (on[j * w + i]) { G.px(i, j, core, 0.85); continue; }
    if (!halo) continue;
    let n = 0;
    for (const [a, bb] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const ii = i + a, jj = j + bb; if (ii >= 0 && jj >= 0 && ii < w && jj < h && on[jj * w + ii]) n++; }
    if (n) G.px(i, j, c, 0.2 + n * 0.08);
  }
  return [G.flush(), x - 2, y - up - 2];
}
// text i live/glow: färdiga små bilder per (typsnitt, text, färg) – en drawImage i stället för
// en fillRect per pixel (börskurserna, bankomaten, ÖPPET-skylten ritas varje bildruta)
const TXT = new Map();
function ctxTxt(ctx, F, s, x, y, c) {
  const key = (F === BIG ? 'B' : 'S') + c + s;
  let cv = TXT.get(key);
  if (!cv) {
    if (TXT.size > 400) TXT.clear();
    const up = 3, T = new Pix(textW(F, s) + 2, F.h + up + 3), col = parseInt(c.slice(1), 16);
    eachTextPixel(F, s, 0, up, 1, (px, py) => T.px(px, py, col));
    cv = T.flush(); cv.up = up;
    TXT.set(key, cv);
  }
  ctx.drawImage(cv, x, y - cv.up);
}

// ================= ytor =================
// kalksten i kvaderförband: skift om `course` px, block ~`block` px, fog i skugga, belyst överkant
function ashlar(P, x, y, w, h, c, o = {}) {
  const ch = o.course ?? 6, bw = o.block ?? 14, seed = o.seed ?? 3, y0 = o.y0 ?? y, deep = o.rustic ? 1 : 0;
  for (let j = 0; j < h; j++) {
    const Y = y + j, row = Math.floor((Y - y0) / ch), ry = (Y - y0) - row * ch;
    const off = Math.floor(hash(row, 7, seed) * bw);
    for (let i = 0; i < w; i++) {
      const X = x + i, col = Math.floor((X + off) / bw), rx = (X + off) - col * bw;
      let k;
      if (ry === ch - 1 || (!o.noVert && rx === bw - 1)) k = mul(c, deep ? 0.62 : 0.8);
      else if (deep && ry === ch - 2) k = mul(c, 0.86);
      else {
        const v = hash(col, row, seed);
        k = v > 0.66 ? mix(c, WHITE, 0.08) : v < 0.22 ? mul(c, 0.94) : c;
        if (ry === 0) k = mix(k, WHITE, deep ? 0.28 : 0.16);
        if (rx === 0) k = mix(k, WHITE, 0.07);
        const n = hash(X, Y, seed + 9);
        if (n > 0.95) k = mul(k, 0.9); else if (n < 0.03) k = mix(k, WHITE, 0.12);
      }
      P.px(X, Y, k);
    }
  }
}
// polerad granit: prickig sten med en blank diagonal glans
function granite(P, x, y, w, h, c, seed = 5, sheen = 0.14) {
  area(P, x, y, w, h, (X, Y) => {
    const n = hash(X, Y, seed);
    let k = n > 0.9 ? mix(c, WHITE, 0.22) : n < 0.12 ? mul(c, 0.7) : n > 0.8 ? mix(c, 0xb8a898, 0.14) : c;
    const d = ((X + Y) % 23 + 23) % 23;
    if (d < 3) k = mix(k, WHITE, sheen * (d === 1 ? 1.4 : 0.8));
    return k;
  });
}
// grus/takpapp på platta tak
function roofFelt(P, x, y, w, h, c, seed = 11) {
  area(P, x, y, w, h, (X, Y) => {
    const n = hash(X, Y, seed);
    return n > 0.9 ? mix(c, WHITE, 0.16) : n < 0.1 ? mul(c, 0.82) : jit(c, X, Y, seed + 1, 0.05);
  });
}

// ================= takdetaljer =================
// fläktaggregat (sett snett uppifrån: topp med fläktar + front med galler)
function hvac(P, x, y, w, d, hg, o = {}) {
  const c = o.c ?? 0xb8bcc2;
  P.darken(x + w, y + 1, 2, d + hg, 0.72);                          // skugga österut
  P.rect(x, y, w, d, mix(c, WHITE, 0.12)); P.hl(x, y, w, mix(c, WHITE, 0.4));
  for (let k = 0; k < (o.fans ?? 1); k++) {
    const fx = x + 2 + k * 6, fy = y + 1;
    if (fx + 4 > x + w) break;
    P.rect(fx, fy, 5, Math.max(1, d - 2), 0x3a3e46); P.px(fx + 2, fy + ((d - 2) >> 1), 0x9aa0a8);
    P.px(fx + 1, fy, 0x5a5e66);
  }
  P.rect(x, y + d, w, hg, c);
  for (let i = x + 1; i < x + w - 1; i += 2) P.vl(i, y + d + 1, hg - 2, mul(c, 0.78));  // galler
  P.vl(x, y, d + hg, mix(c, WHITE, 0.3)); P.vl(x + w - 1, y, d + hg, mul(c, 0.7));
  P.hl(x, y + d + hg - 1, w, mul(c, 0.6));
}
// ventilationsrör med huv
function ventPipe(P, x, y, hg, c = 0xa8aeb8) {
  P.darken(x + 3, y, 2, hg, 0.75);
  P.rect(x, y, 3, hg, c); P.vl(x, y, hg, mix(c, WHITE, 0.3)); P.vl(x + 2, y, hg, mul(c, 0.7));
  P.rect(x - 1, y - 2, 5, 2, mix(c, WHITE, 0.15)); P.hl(x - 1, y - 2, 5, mix(c, WHITE, 0.45));
}
// takräcke (lodräta pinnar + ledstång)
function railing(P, x, w, y, hg = 5, c = 0x9aa0aa) {
  P.hl(x, y, w, mix(c, WHITE, 0.3)); P.hl(x, y + 1, w, mul(c, 0.7));
  for (let i = x; i < x + w; i += 3) P.vl(i, y + 2, hg - 2, mul(c, 0.85));
  P.hl(x, y + hg - 1, w, mul(c, 0.6));
}
// antennmast med stag; returnerar flyghinderljusets position (canvas)
function mast(P, x, top, bot, o = {}) {
  const c = o.c ?? 0x8a9098;
  P.vl(x, top, bot - top, mix(c, WHITE, 0.25)); P.vl(x + 1, top + 1, bot - top - 1, mul(c, 0.6));
  for (let y = top + 3; y < bot - 1; y += 3) { P.px(x - 1, y, mul(c, 0.8)); P.px(x + 2, y + 1, mul(c, 0.55)); }
  if (o.dish) { P.px(x - 2, top + 5, 0xe8ecf0); P.vl(x - 3, top + 4, 3, 0xd0d4da); }
  P.rect(x - 1, top - 1, 3, 2, 0x8a1a1a);
  return [x, top - 1];
}
// fönsterputsarkranen (BMU) på räls
function bmu(P, x, y, o = {}) {
  const Y = 0xe8b830, arm = o.arm ?? 16;
  P.hl(x - 6, y + 6, 26, 0x6a6e76); P.hl(x - 6, y + 7, 26, 0x3a3e46);               // rälsen
  P.darken(x + 9, y + 1, 3, 7, 0.7);
  P.rect(x, y + 1, 9, 6, Y); P.hl(x, y + 1, 9, 0xffe070); P.vl(x + 8, y + 1, 6, 0xa87a18);
  P.rect(x + 2, y + 3, 5, 2, 0x3a3e46); P.px(x + 3, y + 3, 0x9adcf0);              // hytten
  P.hl(x + 4, y - 1, arm, 0xd8a820); P.hl(x + 4, y, arm, 0x8a6a10);                // armen
  P.vl(x + 3 + arm, y, 4, 0x4a4e56);                                               // vajern
  P.rect(x + 1 + arm, y + 4, 5, 2, 0xd8dce2);                                      // korgen
}
// takterrass: trätrall, parasoll och krukväxter
function terrace(P, x, y, w, d, seed, o = {}) {
  area(P, x, y, w, d, (X, Y) => { const p = (Y - y) % 3; return p === 2 ? 0x7a5230 : jit((X >> 3) & 1 ? 0xb08050 : 0xa47444, X, Y, seed, 0.1); });
  for (let k = 0; k < (o.pots ?? 3); k++) {
    const px = x + 2 + Math.floor(hash(k, seed, 3) * Math.max(1, w - 6)), py = y + d - 3;
    P.rect(px, py, 4, 3, 0x9a5a36); P.hl(px, py, 4, 0xc07a4a);
    for (let i = 0; i < 5; i++) P.px(px - 1 + i, py - 1 - ((i * 7 + k) % 3), i % 2 ? 0x3a7a34 : 0x5aa044);
    P.px(px + 1, py - 3, 0x2e6a2a);
  }
  if (o.umbrella) {
    const ux = x + (w >> 1), uy = y - 3;
    P.vl(ux, uy, d + 2, 0x5a4a3a);
    for (let r = 0; r < 4; r++) P.hl(ux - 1 - r * 2, uy - 3 + r, 3 + r * 4, r === 3 ? mul(o.umbrella, 0.75) : (r & 1 ? mix(o.umbrella, WHITE, 0.3) : o.umbrella));
    P.darken(ux + 3, uy + 2, 5, 3, 0.8);
  }
}

// ================= glasfasader =================
// En skyline som speglas i de nedre våningarna (husen tvärs över gatan).
const skylineAt = (X, seed) => { const blk = Math.floor((X + seed * 13) / 17); return 0.5 + hash(blk, 1, seed) * 0.34; };
// Glasets färg på dagen: himmel upptill, motstående hus nedtill (med sina fönster), moln,
// en bred solglans snett över fasaden och tunna snedstrimmor.
function glassDay(X, Y, t, u, g, seed, o = {}) {
  let c = mix(g[0], g[1], q(t * 0.85 + u * 0.42, X, Y, 4));
  if (o.skyline !== false && t > skylineAt(X, seed)) {
    c = mix(c, g[2], 0.66);
    if ((X & 3) === 1 && (Y % 5) === 2 && hash(X >> 2, Y >> 2, seed + 7) > 0.45) c = mix(c, g[0], 0.35);   // fönstren i husen mitt emot
  }
  const n = noise((X + seed * 31) / 15, Y / 6, 5 + seed);
  if (n > 0.58 && t < 0.66) c = mix(c, WHITE, q((n - 0.58) * 2.4, X, Y, 3) * 0.6);
  const band = ((X + Y * 2 + seed * 17) % 150 + 150) % 150;
  if (band < 16) c = mix(c, WHITE, band < 2 || band > 13 ? 0.1 : 0.2);                               // solglansen
  const d = ((X + Y * 2 + seed * 7) % 43 + 43) % 43;
  if (d < 2) c = mix(c, WHITE, d === 1 ? 0.3 : 0.16);
  else if (d === 4) c = mix(c, WHITE, 0.07);
  if (u === 0) c = mix(c, WHITE, 0.1);
  return c;
}
// Glaset på natten: släckta kontor, svag spegling av stadens ljus.
function glassNight(X, Y, t, u, seed) {
  let c = mix(0x222c46, 0x10162a, q(u * 0.6 + t * 0.4, X, Y, 3));
  if (hash(X, Y, seed + 40) > 0.992 && t > 0.4) c = 0x8a6a3a;           // gatljusens reflexer
  const d = ((X + Y * 2 + seed * 7) % 43 + 43) % 43;
  if (d < 2) c = mix(c, 0x6a7aa0, 0.25);
  return c;
}
// persienner (neddragna till en viss höjd) bakom glaset
function blindsAt(P, x, y, w, h, frac, night, tint) {
  const hh = Math.max(1, Math.round(h * frac));
  for (let j = 0; j < hh; j++) for (let i = 0; i < w; i++) {
    const s = j % 2 ? (night ? 0x2a2c38 : 0xc8c2b2) : (night ? 0x3a3c48 : 0xece6d8);
    P.px(x + i, y + j, mix(s, tint, 0.42));
  }
  if (hh < h) P.hl(x, y + hh, w, night ? 0x1a1a24 : 0x8a8474);
}
// GLASFASAD (curtain wall): våningsband (bröstning + glas) mellan lodräta profiler.
//   o: { fh, cw, sp: bröstningens höjd, g: [ljus, mellan, mörk], mull, span, fin: var n:te profil är en fena,
//        blinds: andel rutor med persienner, kind }
// Varje glasruta läggs i K.offices (canvas-koordinater) – glow tänder dem efter klockan.
function curtainWall(K, x, y, w, h, o) {
  const P = K.P, night = K.night, seed = K.seed + (o.seed || 0);
  const fh = o.fh, cw = o.cw, sp = o.sp ?? 3, floors = Math.floor(h / fh), cols = Math.floor(w / cw);
  const mull = o.mull ?? 0x8a98a8, span = o.span ?? 0x4a5462, finC = o.finC ?? 0xd8e0e8;
  for (let f = 0; f < floors; f++) {
    const fy = y + f * fh, gy = fy + sp, gh = fh - sp;
    for (let j = 0; j < sp; j++) P.hl(x, fy + j, cols * cw + 1, j === 0 ? mix(span, WHITE, 0.32) : j === sp - 1 ? mul(span, 0.62) : span);
    for (let k = 0; k < cols; k++) {
      const cx = x + k * cw, gx = cx + 1, gw = cw - 1, pv = hash(k, f, seed + 5);
      for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) {
        const X = gx + i, Y = gy + j, t = (Y - y) / h, u = j / gh;
        let c = night ? glassNight(X + K.box.x, Y, t, u, seed) : glassDay(X + K.box.x, Y, t, u, o.g, seed, o);
        if (pv > 0.82) c = mix(c, WHITE, 0.07); else if (pv < 0.16) c = mul(c, 0.9);   // rutorna skiftar lite
        c = mul(c, 1 - 0.1 * (X - x) / w);                              // ljuset från sydväst: östra delen mörkare
        if (j === 0) c = mul(c, 0.78);                                  // bjälklagets skugga
        if (i === 0) c = mul(c, 0.9);                                   // profilens skugga österut
        P.px(X, Y, c);
      }
      const hv = hash(k, f, seed + 3), bl = hv < (o.blinds ?? 0.2);
      if (bl) blindsAt(P, gx, gy + 1, gw, gh - 1, 0.25 + hash(k, f, seed + 4) * 0.6, night, night ? 0x1a2238 : o.g[1]);
      else if (!night && hv > 0.97 && gh > 5) { P.rect(gx + 1, gy + gh - 3, 2, 2, 0x3a6a34); P.px(gx + 1, gy + gh - 4, 0x5a9a44); } // krukväxt
      K.offices.push([gx, gy, gw, gh, (o.seed || 0) * 1000 + f * 50 + k, bl]);
    }
    for (let k = 0; k <= cols; k++) {
      const cx = x + k * cw, fin = o.fin && k % o.fin === 0;
      P.vl(cx, fy, fh, fin ? finC : mull);
      if (fin && k < cols) { P.vl(cx + 1, fy, fh, mul(finC, 0.7)); P.vl(cx + 2, fy + sp, fh - sp, 0x000000, 0.18); }
    }
  }
  return { floors, cols, bottom: y + floors * fh };
}

// ================= kontorsljus =================
// Tänt eller släckt ett visst klockslag: folk går hem 17–23:45, kommer 5:30–8, ~7 % lyser hela natten.
function officeOn(hour, r1, r2) {
  if (r1 > 0.93) return true;
  if (hour >= 12) return hour < 17 + r1 * 6.8;
  return hour >= 5.5 + r2 * 2.6;
}
// Ett tänt kontor bakom rutan (målat helt – täcker den mörka rutan)
function paintLitOffice(P, x, y, w, h, i, blinds) {
  const warm = hash(i, 5, 71) > 0.55;
  const top = warm ? 0xfff0c0 : 0xf2f6e4, bot = warm ? 0xf0b860 : 0xc8d4b8;
  vgrad(P, x, y, w, h, top, bot, 3);
  if (h >= 5) for (let k = 1; k < w - 1; k += 3) P.px(x + k, y, 0xffffff);          // lysrören i taket
  if (blinds) { for (let j = 0; j < Math.max(2, h >> 1); j += 2) P.hl(x, y + j, w, warm ? 0xe8b060 : 0xd0d8c0); return; }
  const dy = y + h - Math.max(2, Math.round(h * 0.34));
  P.hl(x, dy, w, mul(bot, 0.62));
  for (let k = 0; k < w; k++) if (hash(i, k, 72) > 0.7) P.px(x + k, dy - 1, hash(i, k, 73) > 0.5 ? 0x6ab4ff : 0x3a4458);
  if (hash(i, 9, 74) > 0.72 && w >= 5 && h >= 7) { const px = x + 1 + Math.floor(hash(i, 9, 75) * (w - 3)); P.rect(px, dy - 3, 2, 2, 0x3a2a30); P.hl(px - 1, dy - 1, 4, 0x2a2a3a); }
  if (hash(i, 8, 76) > 0.8) P.px(x + w - 2, dy - 2, 0x3a8a3a);
}
// Bostäderna ovanför butikerna: tänt på kvällen till 21:30–24, en nattuggla, tänt en stund på morgonen.
function homeOn(hour, r1, r2) {
  if (r1 > 0.95) return true;
  if (hour >= 15) return hour < 21.5 + r1 * 2.6;
  return hour >= 6 + r2 * 1.2 && hour < 8.5;
}
function paintLitHome(P, x, y, w, h, i) {
  const tv = hash(i, 3, 61) > 0.8, c0 = tv ? 0xb8d8ff : 0xffe6a8, c1 = tv ? 0x5a78c8 : 0xf0a850;
  vgrad(P, x, y, w, h, c0, c1, 3);
  if (h > 4 && hash(i, 4, 62) > 0.5) { P.px(x + (w >> 1), y, 0x5a4a3a); P.px(x + (w >> 1), y + 1, 0xfff4d0); }   // taklampan
  if (hash(i, 5, 63) > 0.7 && h > 5) P.rect(x + ((hash(i, 6, 64) * Math.max(1, w - 2)) | 0), y + h - 3, 2, 3, 0x5a3a2a);   // någon hemma
}
// Lagret med tända kontor för ett visst klockslag (cachas per hus och kvart)
const LIT = new Map();
function litLayer(b, m, hour) {
  const key = Math.floor(hour * 4);
  const hit = LIT.get(b.id);
  if (hit && hit.key === key && hit.m === m) return hit.cv;
  const P = new Pix(m.box.w, m.box.h);
  m.offices.forEach(([x, y, w, h, gid, blinds, kind]) => {
    const r1 = hash(gid, 1, m.seed + 91), r2 = hash(gid, 2, m.seed + 92);
    if (kind === 'home') { if (homeOn(hour, r1, r2)) paintLitHome(P, x, y, w, h, gid + m.seed); return; }
    if (!officeOn(hour, r1, r2)) return;
    paintLitOffice(P, x, y, w, h, gid + m.seed, blinds);
  });
  const cv = P.flush();
  LIT.set(b.id, { key, m, cv });
  return cv;
}

// ================= flaggor =================
const FLAGS = {};
function flagFrames(kind) {
  if (FLAGS[kind]) return FLAGS[kind];
  const out = [];
  for (let f = 0; f < 4; f++) {
    const F = new Pix(13, 10);
    for (let x = 0; x < 12; x++) {
      const dy = Math.round(Math.sin(x * 0.7 - f * 1.57) * (x / 12) * 1.6);
      const shade = Math.sin(x * 0.7 - f * 1.57 + 0.8) > 0.3 ? 0.82 : 1;
      for (let y = 0; y < 7; y++) {
        let c;
        if (kind === 'se') c = x === 3 || x === 4 || y === 3 ? 0xf8cc1a : 0x1f5fb0;
        else if (kind === 'bank') { const r = (x - 6) ** 2 + (y - 3) ** 2; c = r <= 5 ? (r <= 1 ? 0x1e4a34 : 0xe8c050) : 0x1e4a34; }
        else c = y === 2 || y === 4 ? 0xe8c050 : y === 3 ? 0xf4f1ea : 0x1a2a4a;          // 'dt': finanskvarterets blå
        F.px(x, y + dy + 1, mul(c, shade));
      }
    }
    out.push(F.flush());
  }
  return (FLAGS[kind] = out);
}
function drawFlag(ctx, x, top, kind, t, ph = 0, h = 20) {
  ctx.fillStyle = '#d8dce4'; ctx.fillRect(x, top, 1, h); ctx.fillStyle = '#6a707c'; ctx.fillRect(x + 1, top, 1, h);
  ctx.fillStyle = '#e8c050'; ctx.fillRect(x, top - 1, 2, 1);
  ctx.drawImage(flagFrames(kind)[Math.floor(t * 5 + ph) & 3], x + 2, top);
}

// ================= karuselldörren =================
// Glastrumma med fyra vingar kring en mittaxel. Lobbyn syns bakom; vingarna ritas i live efter
// vinkeln (per hus), trummans ram och baldakin ovanpå. Snurrar sakta under öppettid, fortare
// när någon går igenom (st.doorOpen).
const KITS = new Map();
const REV = new Map();
function revolveKit(b, night, o) {
  const w = b.door.x1 - b.door.x0, h = o.h ?? 34;
  const wall0 = night ? 0xffe6b0 : o.wall0 ?? 0xe8e0d0, wall1 = night ? 0xd8a860 : o.wall1 ?? 0xb8ab94, floor = o.floor ?? 0x6a6660;
  // lobbyn bakom trumman
  const I = new Pix(w, h);
  vgrad(I, 0, 0, w, h - 9, wall0, wall1, 3);
  for (let k = 3; k < w - 2; k += 7) I.vl(k, 2, h - 12, mul(wall1, 0.9));             // väggpaneler
  for (let y = h - 9; y < h; y++) for (let x = 0; x < w; x++) {
    const tile = ((x + ((y - h + 9) >> 1)) >> 2) + (y >> 1);
    let c = tile & 1 ? floor : mul(floor, 0.86);
    if (((x - y) % 9 + 9) % 9 === 0) c = mix(c, WHITE, 0.25);                          // blankt golv
    if (night) c = mix(c, 0xd8a860, 0.25);
    I.px(x, y, c);
  }
  I.hl(0, h - 9, w, mul(wall1, 0.6));
  I.rect((w >> 1) - 4, 1, 9, 2, night ? 0xffffff : 0xfff8e0);                          // taklampan
  if (night) I.darken(0, 0, w, h, NIGHT_WIN);                                          // halv styrka – live lyser upp den (boost)
  // trummans ram: baldakin (tak) ovanpå, tröskel, de böjda sidoglasen
  const S = new Pix(w + 6, h + 5);
  const X0 = 3, T = 5, steel = o.steel ?? 0xb8c0c8;
  S.rect(0, 0, w + 6, 5, mul(steel, 0.82)); S.hl(0, 0, w + 6, mix(steel, WHITE, 0.5)); S.hl(0, 1, w + 6, mix(steel, WHITE, 0.2));
  S.hl(0, 4, w + 6, mul(steel, 0.5));
  if (o.trim !== undefined) S.hl(0, 2, w + 6, o.trim);
  for (let x = 2; x < w + 4; x += 4) S.px(x, 3, night ? 0xffe8a8 : 0xe8eef4);          // spotlights i undersidan
  for (const side of [0, 1]) {
    const sx = side ? X0 + w - 6 : X0, sw = 6;
    for (let y = T; y < T + h - 2; y++) for (let i = 0; i < sw; i++) {
      const edge = side ? i : sw - 1 - i;                                                  // 0 = mot mitten
      S.px(sx + i, y, night ? 0xffd890 : 0xa8d0ea, 0.26 + edge * 0.05);
      if (edge === 3 && (y + side * 4) % 11 < 7) S.px(sx + i, y, WHITE, 0.4);
    }
    S.vl(side ? X0 + w - 1 : X0, T, h - 2, side ? mul(steel, 0.6) : mix(steel, WHITE, 0.3));
    S.vl(side ? X0 + w - 6 : X0 + 5, T, h - 2, mul(steel, 0.85));
  }
  S.rect(X0 - 1, T + h - 2, w + 2, 2, mul(steel, 0.7)); S.hl(X0 - 1, T + h - 2, w + 2, mix(steel, WHITE, 0.3)); // tröskeln
  return { w, h, inside: I.flush(), shell: S.flush() };
}
function drawRevolve(ctx, b, st, kit, afterInside) {
  const base = baseOf(b), x0 = b.door.x0, top = base - kit.h, w = kit.w;
  let s = REV.get(b.id);
  if (!s) { s = { a: hash(x0, 1, 3) * 6, t: st.t || 0 }; REV.set(b.id, s); }
  const dt = clamp((st.t || 0) - s.t, 0, 0.1); s.t = st.t || 0;
  const open = !b.open || (st.hour >= b.open[0] && st.hour < b.open[1]);
  s.a += dt * ((open ? 0.55 : 0) + clamp(st.doorOpen || 0, 0, 1) * 2.4);
  ctx.drawImage(kit.inside, x0, top);
  afterInside?.(x0, top);
  const cx = x0 + (w >> 1), r = (w >> 1) - 3;
  const wings = [0, 1, 2, 3].map((k) => { const a = s.a + k * Math.PI / 2; return { sn: Math.sin(a), cs: Math.cos(a) }; }).sort((p, p2) => p.cs - p2.cs);
  const wing = (g) => {
    const ex = Math.round(cx + g.sn * r), a0 = Math.min(cx, ex), a1 = Math.max(cx, ex), front = g.cs > 0;
    ctx.fillStyle = front ? 'rgba(200,232,250,0.34)' : 'rgba(120,160,190,0.22)';
    ctx.fillRect(a0, top + 3, a1 - a0 + 1, kit.h - 6);
    ctx.fillStyle = front ? '#a8b0ba' : '#6a727c';
    ctx.fillRect(a0, top + 3, a1 - a0 + 1, 1); ctx.fillRect(a0, top + kit.h - 4, a1 - a0 + 1, 2);
    ctx.fillStyle = front ? '#e4eaf0' : '#7a828c'; ctx.fillRect(ex, top + 3, 1, kit.h - 5);
    if (front && a1 - a0 > 4) { ctx.fillStyle = '#e8c870'; ctx.fillRect(a0 + 1, top + (kit.h >> 1) + 1, a1 - a0 - 1, 1); }
    if (front && a1 - a0 > 6) { ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(a0 + 2, top + 6, 1, kit.h - 16); }
  };
  wings.filter((g) => g.cs <= 0).forEach(wing);
  ctx.fillStyle = '#8a929c'; ctx.fillRect(cx, top + 2, 1, kit.h - 3); ctx.fillStyle = '#d8dee6'; ctx.fillRect(cx - 1, top + 2, 1, kit.h - 3);
  wings.filter((g) => g.cs > 0).forEach(wing);
  ctx.drawImage(kit.shell, x0 - 3, top - 5);
}

// ================= folk i lobbyn =================
const SUIT_LOOKS = [
  { skin: '#e0a97f', hair: '#3b2619', style: 'side', top: 'suit', shirt: '#2f3440', accent: '#c9323a', bottom: 'pants', pants: '#2b2b30', shoes: '#1c1c1c', build: 5 },
  { skin: '#a06a43', hair: '#1d1714', style: 'bun', top: 'suit', shirt: '#5f7f99', accent: '#f4f1ea', bottom: 'skirt', pants: '#2d3a5c', shoes: '#1c1c1c', build: 4 },
  { skin: '#f6d7bf', hair: '#d9a95c', style: 'bob', top: 'suit', shirt: '#7a2e3e', accent: '#e8e3d6', bottom: 'pants', pants: '#2b2b30', shoes: '#6b3e1e', build: 5 },
  { skin: '#c68a5c', hair: '#1d1714', style: 'short', top: 'suit', shirt: '#26605a', accent: '#f0b429', bottom: 'pants', pants: '#2f2f36', shoes: '#1c1c1c', glasses: 'square', build: 6 },
  { skin: '#eec3a0', hair: '#b9b3ab', style: 'short', top: 'suit', shirt: '#2f3440', accent: '#3a7bd5', bottom: 'pants', pants: '#2b2b30', shoes: '#1c1c1c', beard: 'mustache', build: 5 },
];
const DOORMAN = { skin: '#c68a5c', hair: '#1d1714', style: 'short', hat: 'cap', cap: '#7a2e3e', top: 'suit', shirt: '#7a2e3e', accent: '#e0b24a', bottom: 'pants', pants: '#2b2b30', shoes: '#1c1c1c', build: 5 };
const GUARD = { skin: '#e0a97f', hair: '#3b2619', style: 'buzz', hat: 'cap', cap: '#2d3a5c', top: 'jacket', shirt: '#2d3a5c', accent: '#f0b429', bottom: 'pants', pants: '#2d3a5c', shoes: '#1c1c1c', build: 6 };
// Figurer som går fram och tillbaka bakom lobbyglaset (klippta till rutorna), med glasets glans ovanpå.
function lobbyFolk(ctx, b, st, m) {
  const L = m.lobby;
  if (!drawPersonFn || !L) return;
  const t = st.t || 0, open = !b.open || (st.hour >= b.open[0] && st.hour < b.open[1]);
  ctx.save();
  ctx.beginPath();
  for (const [px, py, pw, ph] of L.panes) ctx.rect(px, py, pw, ph);
  ctx.clip();
  if (open) {
    for (let i = 0; i < L.n; i++) {
      const span = L.x1 - L.x0, per = 16 + i * 5 + (m.seed % 5), ph = (t / per + i * 0.37 + (m.seed % 7) * 0.1) % 1;
      const seg = ph < 0.4 ? ph / 0.4 : ph < 0.5 ? 1 : ph < 0.9 ? 1 - (ph - 0.5) / 0.4 : 0;
      const moving = ph < 0.4 || (ph >= 0.5 && ph < 0.9);
      const x = Math.round(L.x0 + seg * span), dir = !moving ? 'down' : ph < 0.5 ? 'right' : 'left';
      const fr = moving ? [1, 3, 2, 3][Math.floor(t * 7 + i * 2) & 3] : (Math.floor(t * 0.7 + i) & 1 ? 4 : 0);
      drawPersonFn(ctx, x, L.y - i * 2, SUIT_LOOKS[(m.seed + i) % SUIT_LOOKS.length], dir, fr);
    }
  } else if (L.guard !== undefined) {
    drawPersonFn(ctx, L.guard, L.y - 3, GUARD, 'down', Math.floor(t * 0.6) & 1 ? 4 : 0);
  }
  ctx.restore();
  if (L.sheen) ctx.drawImage(L.sheen, L.sheen.x, L.sheen.y);
}
// glasets glans (snedstrimmor) som ligger över folk bakom glas
function sheenCanvas(panes, night, ox, oy) {
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const [x, y, w, h] of panes) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x + w); y1 = Math.max(y1, y + h); }
  const P = new Pix(x1 - x0, y1 - y0);
  for (const [x, y, w, h] of panes) for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const X = x + i, Y = y + j, d = ((X + Y * 2) % 29 + 29) % 29;
    if (d < 2) P.px(X - x0, Y - y0, WHITE, night ? 0.1 : 0.32);
    else if (d === 3 || d === 4) P.px(X - x0, Y - y0, WHITE, night ? 0.04 : 0.12);
  }
  const cv = P.flush();
  cv.x = x0 + ox; cv.y = y0 + oy;
  return cv;
}

// ================= gemensam målarram =================
function begin(b, night, opts) {
  const box = artBox(b), P = new Pix(box.w, box.h);
  const L = 8, R = 8 + b.w, baseY = box.h - 4;
  return {
    b, box, P, L, R, W: b.w, baseY, ftop: baseY - b.h, night: !!night, snow: !!opts?.snow, season: opts?.season,
    dx0: b.door.x0 - b.x + 8, dx1: b.door.x1 - b.x + 8,
    seed: [...b.id].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) & 0xffff, 7),
    offices: [], glows: [], texts: [], lamps: [], ledges: [], flags: [], lit: [], noGlow: [],
    wx: (x) => x + box.x, wy: (y) => y + box.y,
  };
}
// snö på lister, tak och markiser (ledges: [x, y, w, tjocklek] – snön lägger sig på raden y och uppåt)
function snowPass(K) {
  if (!K.snow) return;
  const P = K.P;
  for (const [x, y, w, d] of K.ledges) for (let i = 0; i < w; i++) {
    const hgt = (d ?? 1) + (hash(x + i, y, 81) > 0.7 ? 1 : 0);
    for (let j = 0; j < hgt; j++) P.px(x + i, y - j, j === hgt - 1 ? 0xffffff : 0xe4ecf6);
    if (hash(x + i, y, 82) > 0.93) P.px(x + i, y + 1, 0xd8e4f0);                        // istapp/droppe
  }
}
function snowRoof(K, x, y, w, h) {
  if (!K.snow) return;
  area(K.P, x, y, w, h, (X, Y) => { const n = hash(X, Y, 83); return n > 0.93 ? 0xc8d4e4 : n > 0.3 ? 0xf2f6fc : 0xe2eaf4; });
}
// Husets mått och ljuspunkter per (hus, natt, snö) – samma nycklar som scenens bildcache
// (snö = snowCover > 0.5 som i city.js), så att tända fönster ritas ur rätt bild.
const META = {};
const snowOf = (st) => ((st?.env?.weather?.snowCover || 0) > 0.5 ? 1 : 0);
function metaOf(b, night, st) {
  const s = snowOf(st), n = !!night;
  return META[`${b.id}:${n}:${s}`] || META[`${b.id}:${n}:${1 - s}`] || META[`${b.id}:${!n}:${s}`] || META[`${b.id}:${!n}:${1 - s}`];
}
// Nattbilden: de tända fönstren målas med halv styrka – live() lägger dem en gång till ('lighter',
// se boostLit) och efter scenens mörker har de då exakt sina egna färger (inget klipps mot vitt),
// och glow() ger den varma tonen ovanpå.
const NIGHT_WIN = 0.54;
function finish(K, extra = {}) {
  snowPass(K);
  if (K.night) for (const [x, y, w, h] of K.lit) K.P.darken(x, y, w, h, NIGHT_WIN);
  const m = {
    box: K.box, seed: K.seed, offices: K.offices,
    glows: K.glows.map(([x, y, w, h, c, a]) => [K.wx(x), K.wy(y), w, h, c, a]),
    texts: K.texts, lamps: K.lamps.map(([x, y, c, ph]) => [K.wx(x), K.wy(y), c, ph]),
    flags: K.flags.map(([x, y, kind, ph, h]) => [K.wx(x), K.wy(y), kind, ph, h]), lit: K.lit,
    noGlow: K.noGlow.map(([x, y, w, h]) => [K.wx(x), K.wy(y), K.wx(x) + w, K.wy(y) + h]), ...extra,
  };
  META[`${K.b.id}:${K.night}:${K.snow ? 1 : 0}`] = m;
  m.cv = K.P.flush();
  return m.cv;
}
// fotskugga ute på trottoaren
function footShadow(K, x, w) {
  const P = K.P, y = K.baseY;
  P.hl(x, y, w, 0x1a1422, 0.34); P.hl(x, y + 1, w, 0x1a1422, 0.18); P.hl(x + 1, y + 2, w - 2, 0x1a1422, 0.08);
}

// ================= gemensam glow och live =================
// NATTLJUSET – två steg, så att det som står FRAMFÖR huset (folk, träd, lyktor, krukor, cyklar)
// aldrig målas över:
//  1. live (ritas i husets plats i y-ordningen, före mörkret): skyltfönster, lobbyer och de låga
//     skärmarna ritas en gång till med 'lighter' och styrkan mörker / (1 − mörker). Efter mörkret
//     har de då kvar sina egna färger (ljusa färger upp till ungefär halva styrkan) – träd och folk
//     som ritas efter huset täcker dem som vanligt.
//  2. glow (efter mörkret): en svag varm ton över fönstren – aldrig över skyltarnas text
//     (noGlow-rutorna) och aldrig över figurerna på trottoaren – plus husets ljuspunkter,
//     glödtext, flyghinderljus och de HÖGA skärmarna (reklamskärmen, tickern, Glastornets skärm),
//     som inget på gatan når upp till.
const boostA = (st) => { const d = clamp(st.env?.dark ?? 0, 0, 0.6); return d < 0.005 ? 0 : Math.min(1, d / (1 - d)); };
function boost(ctx, st, fn, f = 1) {
  const a = boostA(st) * f;
  if (a <= 0.005) return;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = a;
  try { fn(); } finally { ctx.restore(); }
}
// butikernas skyltfönster lyser till 22:30, sedan bara nattbelysning; lobbyer lyser hela natten
const shopLights = (st) => { const h = st.hour ?? 12; return h >= 6 && h < 22.5; };
function boostLit(ctx, b, st, m) {
  if (!m?.lit?.length || !m.cv) return;
  const on = shopLights(st);
  for (const [x, y, w, h, , always] of m.lit) boost(ctx, st, () => ctx.drawImage(m.cv, x, y, w, h, m.box.x + x, m.box.y + y, w, h), always || on ? 1 : 0.45);
}
// Rektangeln [X0, Y0, X1, Y1] minus rutorna cut → fria rektanglar [x0, y0, x1, y1] (svepband: y-band × x-intervall)
function freeRects(X0, Y0, X1, Y1, boxes) {
  const cut = [];
  for (const [a0, c0, b0, d0] of boxes) {
    const a = Math.max(X0, a0), b2 = Math.min(X1, b0), c = Math.max(Y0, c0), d = Math.min(Y1, d0);
    if (a < b2 && c < d) cut.push([a, c, b2, d]);
  }
  if (!cut.length) return [[X0, Y0, X1, Y1]];
  const out = [], ys = [...new Set([Y0, Y1, ...cut.flatMap((r) => [r[1], r[3]])])].sort((p, q2) => p - q2);
  for (let i = 0; i < ys.length - 1; i++) {
    const ya = ys[i], yb = ys[i + 1];
    const iv = cut.filter((r) => r[1] <= ya && r[3] >= yb).map((r) => [r[0], r[2]]).sort((p, q2) => p[0] - q2[0]);
    let xa = X0;
    for (const [c0, c1] of iv) { if (c0 > xa) out.push([xa, ya, c0, yb]); xa = Math.max(xa, c1); }
    if (xa < X1) out.push([xa, ya, X1, yb]);
  }
  return out;
}
// figurerna som står FRAMFÖR huset (på trottoaren, och portiern) som rutor – husets ljus efter
// mörkret får aldrig måla över dem
function frontBoxes(b, st, m) {
  const base = baseOf(b), out = [];
  for (const p of st.env?.people || []) if (p && p.y > base - 4) out.push([Math.round(p.x) - 6, Math.round(p.y) - 33, Math.round(p.x) + 6, Math.round(p.y) + 2]);
  if (m?.lobby?.doorman !== undefined && isOpen(b, st)) out.push([m.lobby.doorman - 6, base - 34, m.lobby.doorman + 6, base + 1]);
  return out;
}
const isOpen = (b, st) => !b.open || (st.hour >= b.open[0] && st.hour < b.open[1]);
// klipp till husets fasad utom där figurer står framför (för skärmar som ritas om efter mörkret);
// anroparen gör ctx.restore() efteråt
function frontClip(ctx, b, st, m) {
  ctx.save();
  ctx.beginPath();
  for (const [x0, y0, x1, y1] of freeRects(m.box.x, m.box.y, m.box.x + m.box.w, baseOf(b), frontBoxes(b, st, m))) ctx.rect(x0, y0, x1 - x0, y1 - y0);
  ctx.clip();
}
// ordning: varm ton över fönstren → tända kontor (lagret för klockslaget) → ljuspunkter ('lighter',
// aldrig över text) → skyltarnas glödtext → flyghinderljus → husets höga skärmar.
function glowBase(ctx, b, st, extra) {
  const k = clamp((st.env?.dark ?? (st.night ? 0.5 : 0)) / 0.5, 0, 1);
  if (k <= 0.01) return;
  const m = metaOf(b, st.night, st);
  if (!m) return;
  if (m.lit?.length) {
    const on = shopLights(st), holes = [...frontBoxes(b, st, m), ...(m.noGlow || [])];
    ctx.globalCompositeOperation = 'lighter';
    for (const [x, y, w, h, fill, always] of m.lit) {
      if (!fill) continue;
      ctx.fillStyle = rgba(0xffd8a0, fill * k * (always || on ? 1 : 0.4));
      const X0 = m.box.x + x, Y0 = m.box.y + y;
      for (const [xa, ya, xb, yb] of freeRects(X0, Y0, X0 + w, Y0 + h, holes)) ctx.fillRect(xa, ya, xb - xa, yb - ya);
    }
    ctx.globalCompositeOperation = 'source-over';
  }
  if (m.offices.length) { frontClip(ctx, b, st, m); ctx.globalAlpha = k; ctx.drawImage(litLayer(b, m, st.hour ?? 12), m.box.x, m.box.y); ctx.restore(); }
  ctx.globalCompositeOperation = 'lighter';
  // husets alla ljuspunkter som en färdig bild (byggs en gång, ritas med mörkrets styrka)
  if (m.glows.length) {
    if (!m.glowCv) {
      const cv = document.createElement('canvas'); cv.width = m.box.w + 2; cv.height = m.box.h + 2;
      const g = cv.getContext('2d'); g.globalCompositeOperation = 'lighter';
      for (const [x, y, w, h, c, a] of m.glows) {
        const X = x - m.box.x + 1, Y = y - m.box.y + 1;
        g.fillStyle = rgba(c, a * 0.4); g.fillRect(X - 1, Y - 1, w + 2, h + 2);
        g.fillStyle = rgba(c, a); g.fillRect(X, Y, w, h);
      }
      m.glowCv = cv;
    }
    ctx.globalAlpha = k; ctx.drawImage(m.glowCv, m.box.x - 1, m.box.y - 1); ctx.globalAlpha = 1;
  }
  for (const [img, x, y, a] of m.texts) { ctx.globalAlpha = clamp((a ?? 1) * k, 0, 1); ctx.drawImage(img, x, y); }
  ctx.globalAlpha = 1;
  const t = st.t || 0;
  for (const [x, y, c, ph] of m.lamps) {
    if (((t + ph) % 1.6) > 0.8) continue;
    ctx.fillStyle = rgba(c ?? 0xff3020, 0.5 * k); ctx.fillRect(x - 2, y - 1, 5, 3); ctx.fillRect(x - 1, y - 2, 3, 5);
    ctx.fillStyle = rgba(c ?? 0xff3020, 0.9 * k); ctx.fillRect(x, y, 1, 1);
  }
  extra?.(ctx, m, k);
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
}
function liveCommon(ctx, b, st, m) {
  const t = st.t || 0;
  for (const [x, y, kind, ph, h] of m.flags) drawFlag(ctx, x, y, kind, t, ph, h);
  for (const [x, y, c, ph] of m.lamps) {
    const on = ((t + ph) % 1.6) <= 0.8;
    ctx.fillStyle = on ? rgb(c ?? 0xff3020) : '#5a1a1a'; ctx.fillRect(x, y, 1, 1);
  }
}

// =====================================================================
// KONTOR1 – FINANSHUSET: blågrönt glastorn med fenor, indragen krona med
// lysande kant, granitsockel med en hög glaslobby och karuselldörr, portier.
// =====================================================================
function paintKontor1(b, night, opts) {
  const K = begin(b, night, opts), P = K.P, { L, R, baseY } = K;
  const G = [0xa8d8e8, 0x5a98b8, 0x2a5270];
  const podTop = 130, wallTop = 34, crownL = L + 16, crownR = R - 16;
  // ---- taket: kronans tak (y 4–16) och hörntaken bredvid kronan (y 20–34) ----
  roofFelt(P, crownL, 5, crownR - crownL, 11, 0x8a8c90, 11);
  P.hl(crownL, 4, crownR - crownL, 0xb8bcc2);
  snowRoof(K, crownL, 5, crownR - crownL, 11);
  for (const [x0, x1] of [[L, crownL], [crownR, R]]) {
    roofFelt(P, x0, 20, x1 - x0, 12, 0x7e8086, 12);
    P.hl(x0, 20, x1 - x0, 0xa8acb2);
    snowRoof(K, x0, 21, x1 - x0, 11);
  }
  terrace(P, L + 1, 24, crownL - L - 2, 7, 5, { pots: 2 });
  railing(P, L, crownL - L, 27, 5, 0xc8ccd2);
  hvac(P, crownR + 2, 23, 11, 4, 4, { fans: 1 });
  P.rect(L, 32, b.w, 2, 0xd8dce2); P.hl(L, 32, b.w, 0xf4f6f8); P.hl(L, 33, b.w, 0x8a9098);
  K.ledges.push([L, 31, b.w, 1]);
  // ---- kronan (indragen, glas bakom lameller, lysande kant) ----
  const cT = 16, cB = 32;
  for (let y = cT; y < cB; y++) for (let x = crownL; x < crownR; x++) {
    const i = x - crownL, j = y - cT;
    let c = night ? mix(0x1c2438, 0x0e1424, j / 16) : glassDay(x + K.box.x, y, 0.08 + j / 60, j / 16, G, K.seed, { skyline: false });
    // diagrid: stålfackverk i diagonaler över glaset (den ena diagonalen belyst, den andra i skugga)
    if ((((i + j) % 8) + 8) % 8 === 0) c = night ? 0x4a5468 : 0xeef2f6;
    else if ((((i - j) % 8) + 8) % 8 === 0) c = night ? 0x2a3040 : 0x8a949e;
    if (x === crownL) c = mix(c, WHITE, 0.3); else if (x === crownR - 1) c = mul(c, 0.7);
    P.px(x, y, c);
  }
  P.darken(crownL, cB - 2, crownR - crownL, 2, 0.8);
  P.rect(crownL - 1, cT - 2, crownR - crownL + 2, 3, 0xd8dce2); P.hl(crownL - 1, cT - 2, crownR - crownL + 2, 0xffffff); P.hl(crownL - 1, cT, crownR - crownL + 2, 0x7a8088);
  K.ledges.push([crownL - 1, cT - 3, crownR - crownL + 2, 1]);
  K.glows.push([crownL, cT - 1, crownR - crownL, 1, 0x8ae8ff, 0.8]);
  // logotypen: guldromb med ett F
  const lx = (L + R) >> 1, ly = 24;
  for (let r = 0; r < 6; r++) { P.hl(lx - r, ly - 5 + r, r * 2 + 1, r === 5 ? 0xa8801a : 0xe8c050); P.hl(lx - r, ly + 5 - r, r * 2 + 1, r === 0 ? 0xa8801a : 0xd0a838); }
  P.hl(lx - 1, ly - 2, 3, 0x1a2a3a); P.vl(lx - 1, ly - 2, 5, 0x1a2a3a); P.hl(lx - 1, ly, 2, 0x1a2a3a);
  // (ingen ljusruta över bokstaven – romben lyses upp av kronans kantljus på natten)
  K.glows.push([lx - 6, ly + 6, 13, 1, 0xffd070, 0.5]);
  // kronans tak: fönsterputsarkranen, antennmasten, fläktarna
  bmu(P, crownL + 4, 5, { arm: 14 });
  hvac(P, crownR - 26, 7, 12, 3, 4, { fans: 2 });
  const [mx, my] = mast(P, crownR - 8, 1, 14, { dish: true });
  K.lamps.push([mx, my, 0xff3020, 0]);
  K.ledges.push([crownL, 4, crownR - crownL, 1]);
  K.flags.push([L + 3, 8, 'se', 0, 22], [R - 5, 8, 'dt', 1.3, 22]);
  // ---- tornet: hörnpelare + glasfasad med fenor ----
  const pier = (x, w, lit) => {
    area(P, x, wallTop, w, podTop - wallTop, (X, Y, i) => {
      let c = jit(0xd4d8dc, X, Y, 21, 0.05);
      if ((Y - wallTop) % 12 === 11) c = mul(c, 0.84);
      if (lit ? i === 0 : i === w - 1) c = lit ? mix(c, WHITE, 0.4) : mul(c, 0.66);
      else if (!lit && i === w - 2) c = mul(c, 0.82);
      return c;
    });
  };
  pier(L, 4, true); pier(R - 4, 4, false);
  curtainWall(K, L + 4, wallTop, b.w - 8, podTop - wallTop, { fh: 12, cw: 8, sp: 3, g: G, mull: 0x7a8c9c, finC: 0xdce4ea, span: 0x3e5a6c, fin: 3, blinds: 0.14 });
  // ---- sockeln: granitband med namnet, hög glaslobby, karuselldörr ----
  granite(P, L, podTop, b.w, 12, 0x34363c, 5);
  P.hl(L, podTop, b.w, 0x8a8e96); P.hl(L, podTop + 1, b.w, 0x4a4e56); P.hl(L, podTop + 11, b.w, 0x1a1c22);
  P.darken(L, podTop + 12, b.w, 1, 0.7);
  K.ledges.push([L, podTop - 1, b.w, 1]);
  const name = 'FINANSHUSET', nx = centerX(BIG, name, (L + R) / 2);
  signText(P, BIG, name, nx, podTop + 3, 0xd8dee6, { shadow: 0x0a0a10, hi: 0xffffff, lo: 0x9aa4b0 });
  K.texts.push([...textGlow(BIG, name, 1, 0xcfe8ff, K.wx(nx), K.wy(podTop + 3)), 0.55]);
  const lT = podTop + 12, lB = baseY, dx0 = K.dx0, dx1 = K.dx1;
  const panesC = [[L + 6, lT + 2, dx0 - 6 - (L + 6), lB - lT - 4], [dx1 + 6, lT + 2, R - 6 - (dx1 + 6), lB - lT - 4]];
  for (const [x, w] of [[L, 6], [dx0 - 6, 6], [dx1, 6], [R - 6, 6]]) granite(P, x, lT, w, lB - lT, 0x2e3036, 6, 0.2);
  P.vl(L, lT, lB - lT, 0x6a6e76); P.vl(R - 1, lT, lB - lT, 0x16181c);
  P.rect(L + 6, lT, R - L - 12, 2, 0x22242a);
  panesC.forEach(([x, y, w, h], i) => paintLobby(P, x, y, w, h, night, K.seed + x, { wall: 0xe8e2d4, art: i === 0 }));
  for (const [x, y, w, h] of panesC) {
    for (let k = x; k <= x + w; k += 9) P.vl(Math.min(k, x + w - 1), y, h, 0x9aa2ac);
    P.hl(x, y + 10, w, 0x9aa2ac); P.hl(x, y - 1, w, 0xc8d0d8); P.hl(x, y + h, w, 0x5a5e66);
  }
  // planteringslådor i granit framför glaset (inne i fasadlinjen)
  for (const [x, , w] of panesC) {
    granite(P, x + 1, lB - 7, w - 2, 6, 0x3a3c42, 8);
    P.hl(x + 1, lB - 7, w - 2, 0x8a8e96);
    for (let i = x + 2; i < x + w - 2; i++) for (let j = 0; j < 4; j++) if (hash(i, j, 9) > 0.35 - j * 0.1) P.px(i, lB - 8 - j, j > 2 ? 0x5aa044 : (i + j) % 3 ? 0x2e6a2a : 0x3f8a36);
    K.ledges.push([x + 1, lB - 12, w - 2, 1]);
  }
  // baldakinen över dörren
  P.rect(dx0 - 8, lT + 2, dx1 - dx0 + 16, 3, 0x2a2c32); P.hl(dx0 - 8, lT + 2, dx1 - dx0 + 16, 0xa8b0ba); P.hl(dx0 - 8, lT + 4, dx1 - dx0 + 16, 0x0e0e12);
  P.darken(dx0 - 8, lT + 5, dx1 - dx0 + 16, 2, 0.7);
  K.ledges.push([dx0 - 8, lT + 1, dx1 - dx0 + 16, 1]);
  for (let x = dx0 - 6; x < dx1 + 6; x += 6) K.glows.push([x, lT + 5, 2, 1, 0xfff0c0, 0.9]);
  P.rect(dx1 + 1, lT + 12, 4, 7, 0xc8a040); P.hl(dx1 + 1, lT + 12, 4, 0xf0d070); text(P, SMALL, '1', dx1 + 2, lT + 13, 0x3a2a10);
  P.rect(dx0 - 5, lT + 16, 3, 5, 0x1a1c22); P.px(dx0 - 4, lT + 17, 0x40d860);
  P.rect(dx0 - 4, baseY, dx1 - dx0 + 8, 2, 0x8a8e96); P.hl(dx0 - 4, baseY, dx1 - dx0 + 8, 0xc8ccd2);
  footShadow(K, L, dx0 - 4 - L); footShadow(K, dx1 + 4, R - dx1 - 4);
  for (const [x, y, w, h] of panesC) K.lit.push([x, y, w, h, 0.13, true]);
  const lobby = lobbyOf(K, panesC, { doorman: dx1 + 12 });
  return finish(K, { lobby, doorKit: { steel: 0xc0c8d0, trim: 0xe8c050, wall0: 0xece6da, wall1: 0xbfb4a0, floor: 0x5a5c62 } });
}
// lobbyinteriören bakom glaset: marmorvägg, konst, disk, taklampor, blankt stengolv
function paintLobby(P, x, y, w, h, night, seed, o = {}) {
  const wall = night ? 0xf0d8a8 : o.wall ?? 0xe8e2d4;
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const X = x + i, Y = y + j, fl = j >= h - 9;
    let c;
    if (fl) {
      c = mix(0x6a6a70, 0x3a3a40, q((j - h + 9) / 9, X, Y, 3));
      if (((X - Y) % 11 + 11) % 11 === 0) c = mix(c, WHITE, 0.2);
      if (night) c = mix(c, 0xd8a860, 0.3);
    } else {
      const n = noise(X / 7, Y / 3, seed);
      c = mix(wall, mul(wall, 0.86), q(j / (h - 9), X, Y, 3) * 0.6);
      if (n > 0.68) c = mul(c, 0.92);                                                   // marmorådring
    }
    P.px(X, Y, c);
  }
  P.hl(x, y + h - 9, w, mul(wall, 0.55));
  for (let k = x + 4; k < x + w - 2; k += 10) { P.vl(k, y, 3, 0x3a3a40); P.rect(k - 1, y + 3, 3, 2, night ? 0xffffff : 0xfff4d0); }
  if (o.art && w > 18) {
    const ax = x + 4, ay = y + 6, aw = Math.min(16, w - 8), ah = 10;
    P.rect(ax - 1, ay - 1, aw + 2, ah + 2, 0x2a2a30);
    area(P, ax, ay, aw, ah, (X, Y, i, j) => (i < aw * 0.4 ? (j < 5 ? 0xd83a3a : 0xf0c030) : i < aw * 0.7 ? 0x2a5ab0 : j > 6 ? 0x2a2a30 : 0xf4f1ea));
  } else if (w > 18) {
    const rx = x + w - 20, ry = y + h - 15;
    P.rect(rx, ry, 16, 7, 0x3a3440); P.hl(rx, ry, 16, 0xd8d0c0); P.hl(rx, ry + 1, 16, 0x5a5460);
    P.rect(rx + 6, ry + 3, 4, 2, 0xe8c050);
    P.rect(rx + 12, ry - 3, 3, 3, 0x2a2a30); P.px(rx + 13, ry - 2, 0x6ab4ff);
    const px = x + 3;
    P.rect(px, y + h - 13, 5, 4, 0x3a3a40); P.hl(px, y + h - 13, 5, 0x8a8a90);
    for (let k = 0; k < 7; k++) P.line(px + 2, y + h - 14, px + 2 + Math.round(Math.cos(k * 0.9) * 4), y + h - 18 - Math.round(Math.abs(Math.sin(k * 0.9)) * 3), k % 2 ? 0x3a8a3a : 0x2a6a2a);
  }
}
// lobbyns rutor (världskoordinater) + figurernas gångsträcka för lobbyFolk
function lobbyOf(K, panes, o = {}) {
  const wp = panes.map(([x, y, w, h]) => [K.wx(x), K.wy(y), w, h]);
  const x0 = wp[0][0] + 6, x1 = wp[wp.length - 1][0] + wp[wp.length - 1][2] - 6;
  return { panes: wp, x0, x1, y: K.wy(K.baseY) - 6, sheen: sheenCanvas(panes, K.night, K.box.x, K.box.y), n: o.n ?? 2,
    guard: K.wx(panes[panes.length - 1][0] + 10), doorman: o.doorman !== undefined ? K.wx(o.doorman) : undefined };
}

// =====================================================================
// KONTOR2 – BÖRSHUSET: art déco-torn i kalksten och brons, trappstegskrona med
// spira, börstickern som rullar över fasaden, indexskärmar vid entrén.
// =====================================================================
function paintKontor2(b, night, opts) {
  const K = begin(b, night, opts), P = K.P, { L, R, baseY } = K;
  const STONE = 0xe2d6bc, BRONZE = 0x6a4a2a, GOLD = 0xe0b850;
  const bodyTop = 46;
  // ---- trappstegskronan ----
  const steps = [[L + 5, R - 5, 34, bodyTop], [L + 13, R - 13, 22, 34], [L + 22, R - 22, 12, 22]];
  steps.forEach(([x0, x1, t, bt]) => {
    area(P, x0, t, x1 - x0, bt - t, (X, Y, i) => {
      const col = (X - x0) % 6;
      let c = col < 3 ? jit(STONE, X, Y, 31, 0.05) : night ? 0x1a2236 : mix(0x6a8aa8, 0x2a3a58, (Y - t) / (bt - t));
      if (col === 0) c = mix(c, WHITE, 0.2); if (col === 2) c = mul(c, 0.84);
      if (i === 0) c = mix(c, WHITE, 0.3); if (X === x1 - 1) c = mul(c, 0.68);
      return c;
    });
    for (let x = x0; x < x1; x++) { P.px(x, t, mix(STONE, WHITE, 0.4)); P.px(x, t + 1, ((x - x0) % 4) < 2 ? GOLD : BRONZE); P.px(x, t + 2, ((x - x0 + 2) % 4) < 2 ? GOLD : mul(BRONZE, 0.7)); }
    P.hl(x0, bt - 1, x1 - x0, mul(STONE, 0.7));
    K.ledges.push([x0, t - 1, x1 - x0, 1]);
  });
  // stommens tak syns som en list på var sida om första steget
  for (const [x0, x1] of [[L, L + 5], [R - 5, R]]) { roofFelt(P, x0, 40, x1 - x0, 6, 0x8a8680); P.hl(x0, 40, x1 - x0, 0xb0aca4); }
  // spiran med flyghinderljus
  const sx = (L + R) >> 1;
  for (let y = 1; y < 12; y++) { const hw = y < 4 ? 0 : y < 8 ? 1 : 2; P.hl(sx - hw, y, hw * 2 + 1, y % 3 ? mix(STONE, WHITE, 0.2) : GOLD); if (hw) P.px(sx + hw, y, mul(STONE, 0.7)); }
  K.lamps.push([sx, 0, 0xff3020, 0.4]);
  // solfjäder i guld på mellansteget
  const fy = 33;
  for (let r = 2; r < 7; r++) for (let a = 0; a < 9; a++) {
    const ang = Math.PI * (a / 8), x = Math.round(sx + Math.cos(ang) * r), y = Math.round(fy - Math.sin(ang) * r * 0.9);
    P.px(x, y, a % 2 ? GOLD : mix(GOLD, WHITE, 0.3));
  }
  K.glows.push([sx - 6, fy - 6, 13, 6, 0xffd070, 0.25]);
  // ---- stommen: kalkstenspelare, fönster, bronsbröstningar med sicksack ----
  const fh = 14, floors = 5, top = bodyTop, colW = 10;
  area(P, L, top, b.w, floors * fh, (X, Y) => jit(STONE, X, Y, 33, 0.05));
  const cols = Math.floor((b.w - 4) / colW), ox = L + ((b.w - cols * colW) >> 1) + 3;
  for (let f = 0; f < floors; f++) for (let k = 0; k < cols; k++) {
    const x = ox + k * colW, y = top + f * fh + 2, w = 6, h = fh - 6;
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const X = x + i, Y = y + j;
      let c = night ? glassNight(X + K.box.x, Y, (Y - top) / 80, j / h, K.seed) : glassDay(X + K.box.x, Y, (Y - top) / 90, j / h, [0x9ac0dc, 0x4a6a8c, 0x2a3a50], K.seed);
      if (i === 0 || j === 0) c = mul(c, 0.78);
      P.px(X, Y, c);
    }
    P.vl(x + 3, y, h, 0x3a3020);
    const hv = hash(k, f, K.seed + 3);
    if (hv < 0.25) blindsAt(P, x, y + 1, w, h - 1, 0.3 + hash(k, f, 9) * 0.5, night, night ? 0x1a2238 : 0x4a6a8c);
    K.offices.push([x, y + 1, 3, h - 1, f * 50 + k, hv < 0.25], [x + 4, y + 1, 2, h - 1, f * 50 + k, hv < 0.25]);
    const sy = y + h;
    for (let i = 0; i < w; i++) for (let j = 0; j < 4; j++) {
      const z = ((i + (j & 1 ? 2 : 0)) % 4) < 2;
      P.px(x + i, sy + j, j === 0 ? mul(BRONZE, 0.6) : z ? GOLD : BRONZE);
    }
    P.vl(x - 1, y, h + 4, mix(STONE, WHITE, 0.3)); P.vl(x + w, y, h + 4, mul(STONE, 0.72));
  }
  P.vl(L, top, floors * fh, mix(STONE, WHITE, 0.35)); P.vl(R - 1, top, floors * fh, mul(STONE, 0.66));
  // ---- tickern: LED-band över hela fasaden ----
  const tkY = top + floors * fh;
  P.rect(L - 2, tkY, b.w + 4, 11, 0x2a2016); P.hl(L - 2, tkY, b.w + 4, GOLD); P.hl(L - 2, tkY + 10, b.w + 4, mul(BRONZE, 0.6));
  P.rect(L, tkY + 2, b.w, 7, 0x0c0a0e);
  K.ledges.push([L - 2, tkY - 1, b.w + 4, 1]);
  // ---- namnet i guld på bronspanel ----
  const nY = tkY + 11;
  P.rect(L, nY, b.w, 12, BRONZE);
  for (let x = L; x < R; x++) { P.px(x, nY, mix(BRONZE, WHITE, 0.3)); P.px(x, nY + 11, mul(BRONZE, 0.5)); if ((x - L) % 4 === 0) P.px(x, nY + 1, GOLD); }
  const name = 'BÖRSHUSET', nx = centerX(BIG, name, (L + R) / 2);
  signText(P, BIG, name, nx, nY + 3, GOLD, { shadow: 0x2a1a0a, hi: 0xfff0b0, lo: 0xb08a30 });
  K.texts.push([...textGlow(BIG, name, 1, 0xffd070, K.wx(nx), K.wy(nY + 3)), 0.5]);
  // ---- bottenvåningen: portal med solfjäder, skärmar på var sida ----
  const gT = nY + 12, dx0 = K.dx0, dx1 = K.dx1;
  ashlar(P, L, gT, b.w, baseY - gT, 0xd8ccb0, { course: 7, block: 12, seed: 34, rustic: true });
  const pT = baseY - 34 - 12;
  P.rect(dx0 - 4, pT, dx1 - dx0 + 8, baseY - pT, BRONZE);
  P.vl(dx0 - 4, pT, baseY - pT, mix(BRONZE, WHITE, 0.3)); P.vl(dx1 + 3, pT, baseY - pT, mul(BRONZE, 0.5));
  const fcx = (dx0 + dx1) / 2, fcy = baseY - 34;
  for (let y = pT + 1; y < fcy; y++) for (let x = dx0 - 2; x < dx1 + 2; x++) {
    const ddx = (x + 0.5 - fcx) / ((dx1 - dx0) / 2 + 2), ddy = (y + 0.5 - fcy) / 11;
    if (ddx * ddx + ddy * ddy > 1) continue;
    const ang = Math.atan2(-ddy, ddx) / Math.PI * 10, ray = Math.abs(ang - Math.round(ang)) < 0.22;
    P.px(x, y, ray ? GOLD : night ? 0xffd890 : mix(0xb0d0e8, 0x4a6a8a, (y - pT) / 12));
  }
  if (night) K.glows.push([dx0, pT + 2, dx1 - dx0, 9, 0xffd080, 0.3]);
  const scW = dx0 - 4 - L - 6, scY = baseY - 30;
  const screens = [[L + 3, scY, scW, 16, 'chart'], [dx1 + 7, scY, R - 3 - (dx1 + 7), 16, 'quotes']];
  for (const [x, y, w, h] of screens) {
    P.rect(x - 2, y - 2, w + 4, h + 4, 0x2a2016); P.hl(x - 2, y - 2, w + 4, GOLD); P.hl(x - 2, y + h + 1, w + 4, 0x120c08);
    P.rect(x, y, w, h, 0x08100c);
    P.rect(x + 2, y + h + 4, w - 4, 3, 0xc8a040); P.hl(x + 2, y + h + 4, w - 4, 0xf0d070);     // mässingsplakett
  }
  K.ledges.push([L, gT - 1, b.w, 1]);
  P.rect(dx0 - 4, baseY, dx1 - dx0 + 8, 2, 0xb8ac94); P.hl(dx0 - 4, baseY, dx1 - dx0 + 8, 0xe0d4bc);
  footShadow(K, L, dx0 - 4 - L); footShadow(K, dx1 + 4, R - dx1 - 4);
  const wsc = screens.map(([x, y, w, h, kind]) => [K.wx(x), K.wy(y), w, h, kind]);
  return finish(K, { doorKit: { steel: 0x9a7a4a, trim: GOLD, wall0: 0xe8dcc0, wall1: 0xb89a70, floor: 0x4a3a2a }, ticker: [K.wx(L), K.wy(tkY + 2), b.w, 7], screens: wsc });
}

// ---------- börsen: kurser som ändras varje speldag ----------
const STOCKS = ['PIXB', 'BURG', 'MÖBL', 'FLYG', 'FRUKT', 'KAFÉ', 'SNAB', 'BETG', 'BROX', 'ELEK'];
function quotesFor(day) {
  return STOCKS.map((s, i) => {
    const base = 40 + Math.floor(hash(i, 1, 5) * 400);
    const ch = Math.round((hash(i, day, 6) - 0.47) * 80) / 10;
    const px = Math.round(base * (1 + ch / 100) * 10) / 10;
    return { s, px, ch };
  });
}
const fmt = (v, d = 1) => v.toFixed(d).replace('.', ',');
let TICK = null;
function tickerStrip(day) {
  if (TICK && TICK.day === day) return TICK.cv;
  const parts = quotesFor(day).map((it) => [it.s, `${fmt(it.px)}`, `${it.ch >= 0 ? '+' : ''}${fmt(it.ch)}%`, it.ch >= 0]);
  let w = 0;
  for (const [a, bb, c] of parts) w += textW(SMALL, a) + textW(SMALL, bb) + textW(SMALL, c) + 26;
  const P = new Pix(w, 7);
  let x = 0;
  for (const [a, bb, c, up] of parts) {
    text(P, SMALL, a, x, 1, 0xffd070); x += textW(SMALL, a) + 4;
    text(P, SMALL, bb, x, 1, 0xe8ecf0); x += textW(SMALL, bb) + 4;
    const col = up ? 0x40e070 : 0xff4040;
    for (let r = 0; r < 3; r++) P.hl(x + 2 - r, up ? 2 + r : 4 - r, r * 2 + 1, col);
    x += 7;
    text(P, SMALL, c, x, 1, col); x += textW(SMALL, c) + 11;
    P.px(x - 6, 3, 0x5a5a60);
  }
  TICK = { day, cv: P.flush() };
  return TICK.cv;
}
function drawTicker(ctx, m, st) {
  if (!m.ticker) return;
  const [x, y, w, h] = m.ticker, strip = tickerStrip(st.env?.day || 1);
  const off = Math.floor((st.t || 0) * 14) % strip.width;
  const first = Math.min(w, strip.width - off);
  ctx.drawImage(strip, off, 0, first, h, x, y, first, h);
  if (first < w) ctx.drawImage(strip, 0, 0, w - first, h, x + first, y, w - first, h);
}
// indexkurvan: punkter som vandrar (ny punkt varannan sekund)
// (bilden byggs om när kurvan tar ett steg, annars ritas den färdiga)
const CHARTS = new Map();
function drawIndexChart(ctx, x, y, w, h, st, trend) {
  const t = st.t || 0, step = Math.floor(t / 2), day = st.env?.day || 1, key = w + 'x' + h;
  let c = CHARTS.get(key);
  if (!c || c.step !== step || c.day !== day) {
    if (trend === undefined) { const it = quotesFor(day); trend = it.reduce((s2, q2) => s2 + q2.ch, 0) / it.length; }
    const tr = clamp(trend / 3, -1, 1) * 0.5, up = tr >= 0;
    const C = new Pix(w, h);
    C.rect(0, 0, w, h, 0x08100c);
    for (let gy = 4; gy < h; gy += 4) C.hl(0, gy, w, 0x12281a);
    for (let i = 0; i < w; i++) {
      const n = step + i, v = clamp(0.5 + (noise(n / 6, day, 3) - 0.5) * 0.9 + (hash(n, day, 4) - 0.5) * 0.14 + tr * (i / w - 0.5) * 2, 0.08, 0.92);
      const py = 7 + Math.round((1 - v) * (h - 9));
      C.vl(i, py + 1, h - py - 1, up ? 0x1c4a2a : 0x4a1c1c); C.px(i, py, up ? 0x50f080 : 0xff5050);
    }
    text(C, SMALL, 'PIX', 1, 1, 0xe8ecf0);
    c = { step, day, cv: C.flush() };
    CHARTS.set(key, c);
  }
  ctx.drawImage(c.cv, x, y);
}
function drawQuotes(ctx, x, y, w, h, st) {
  const items = quotesFor(st.env?.day || 1), t = st.t || 0, i0 = Math.floor(t / 2.5) % items.length;
  ctx.fillStyle = '#08100c'; ctx.fillRect(x, y, w, h);
  for (let r = 0; r < 2; r++) {
    const it = items[(i0 + r) % items.length], yy = y + 1 + r * 8;
    ctxTxt(ctx, SMALL, it.s, x + 1, yy + 1, '#ffd070');
    ctx.fillStyle = it.ch >= 0 ? '#50f080' : '#ff5050';
    const ax = x + w - 4, ay = yy + 2;
    for (let k = 0; k < 3; k++) ctx.fillRect(ax + 1 - k, it.ch >= 0 ? ay + k : ay + 2 - k, k * 2 + 1, 1);
  }
}

// ---------- live/glow för kontorshusen ----------
function kitFor(b, st, m) {
  const k = 'rev:' + b.id + ':' + !!st.night;
  let kit = KITS.get(k);
  if (!kit) { kit = revolveKit(b, st.night, m.doorKit || {}); KITS.set(k, kit); }
  return kit;
}
function liveOffice(ctx, b, st) {
  const m = metaOf(b, st.night, st);
  if (!m) return;
  boostLit(ctx, b, st, m);                                                        // lobbyn lyser
  lobbyFolk(ctx, b, st, m);
  boost(ctx, st, () => lobbyFolk(ctx, b, st, m));
  const kit = kitFor(b, st, m);
  drawRevolve(ctx, b, st, kit, (x0, top) => boost(ctx, st, () => ctx.drawImage(kit.inside, x0, top)));   // lobbyn bakom trumman lyser
  if (isOpen(b, st) && drawPersonFn && m.lobby?.doorman !== undefined) drawPersonFn(ctx, m.lobby.doorman, baseOf(b) - 1, DOORMAN, 'down', Math.floor((st.t || 0) * 0.5) & 1 ? 4 : 0);
  if (m.ticker) drawTicker(ctx, m, st);
  // de låga skärmarna vid entrén lyser på kvällen i husets plats i y-ordningen (träd framför täcker dem)
  const screens = () => { for (const [x, y, w, h, kind] of m.screens || []) (kind === 'chart' ? drawIndexChart : drawQuotes)(ctx, x, y, w, h, st); };
  screens();
  boost(ctx, st, screens);
  liveCommon(ctx, b, st, m);
}
function glowOffice(ctx, b, st) {
  glowBase(ctx, b, st, (c, m, k) => {
    // tickern högt upp på fasaden lyser igenom mörkret med full styrka (inte över folk framför)
    if (m.ticker) {
      frontClip(c, b, st, m);
      c.globalCompositeOperation = 'source-over';
      c.globalAlpha = k;
      drawTicker(c, m, st);
      c.restore();
    }
    // ljuspöl på trottoaren framför karuselldörren
    const x0 = b.door.x0, dw = b.door.x1 - b.door.x0, base = baseOf(b);
    for (let r = 0; r < 10; r++) { const sp = Math.round(r * 0.6); c.fillStyle = rgba(0xffe0a0, 0.16 * k * (1 - r / 10)); c.fillRect(x0 - sp, base + r, dw + sp * 2, 1); }
  });
}

// ================= slagdörrar och skjutdörrar =================
// Slagdörr: bladen svänger inåt (förkortade i fem lägen, som Pixelgatans dörrar). double = två blad.
const SWING_STEPS = 5;
function leafSteps(L, w, h) {
  const out = [L.canvas];
  for (let k = 1; k < SWING_STEPS; k++) {
    const S = new Pix(w, h), a = (k / (SWING_STEPS - 1)) * 1.35, pw = Math.max(2, Math.round(w * Math.cos(a))), f = 1 - k * 0.1;
    for (let x = 0; x < pw; x++) {
      const sx = Math.min(w - 1, Math.floor(x * w / pw)), cut = Math.round((x / pw) * k * 0.7);
      for (let y = cut; y < h - Math.round(cut * 0.3); y++) {
        const i = (y * w + sx) * 4, al = L.d[i + 3] / 255;
        if (al > 0) S.px(x, y, mul((L.d[i] << 16) | (L.d[i + 1] << 8) | L.d[i + 2], f), al);
      }
    }
    S.vl(pw, Math.round(k * 0.7), h - Math.round(k * 0.7) - Math.round(k * 0.21), 0xd8cbb4);
    out.push(S.flush());
  }
  return out;
}
const canvasOf = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
function mirrorCanvas(c) { const m = canvasOf(c.width, c.height), x = m.getContext('2d'); x.translate(c.width, 0); x.scale(-1, 1); x.drawImage(c, 0, 0); return m; }
// spegelvänd Pix (högerbladet har gångjärnet till höger)
function mirrorPix(P) {
  const M = new Pix(P.w, P.h);
  for (let y = 0; y < P.h; y++) for (let x = 0; x < P.w; x++) {
    const i = (y * P.w + x) * 4, a = P.d[i + 3] / 255;
    if (a > 0) M.px(P.w - 1 - x, y, (P.d[i] << 16) | (P.d[i + 1] << 8) | P.d[i + 2], a);
  }
  return M;
}
function swingKit(w, h, paintIn, paintLeaf, double) {
  const I = new Pix(w, h); paintIn(I, w, h);
  const lw = double ? w >> 1 : w;
  const L = new Pix(lw, h); paintLeaf(L, lw, h, 0); L.flush();
  const left = leafSteps(L, lw, h);
  let right = null;
  if (double) { const R = new Pix(w - lw, h); paintLeaf(R, w - lw, h, 1); const M = mirrorPix(R); M.flush(); right = leafSteps(M, w - lw, h).map(mirrorCanvas); }
  return { type: 'swing', w, h, lw, inside: I.flush(), left, right };
}
function slideKit(w, h, paintIn, paintPanel) {
  const I = new Pix(w, h); paintIn(I, w, h);
  const half = w >> 1;
  const A = new Pix(half, h); paintPanel(A, half, h, 0);
  const B2 = new Pix(w - half, h); paintPanel(B2, w - half, h, 1);
  return { type: 'slide', w, h, half, inside: I.flush(), pl: A.flush(), pr: B2.flush() };
}
function drawDoorKit(ctx, x0, top, kit, open, afterInside) {
  open = clamp(open || 0, 0, 1);
  ctx.drawImage(kit.inside, x0, top);
  afterInside?.(x0, top);
  if (kit.type === 'slide') {
    const g = Math.round(kit.half * 0.94 * open), lw = kit.half - g, rw = kit.w - kit.half - g;
    if (lw > 0) ctx.drawImage(kit.pl, g, 0, lw, kit.h, x0, top, lw, kit.h);
    if (rw > 0) ctx.drawImage(kit.pr, 0, 0, rw, kit.h, x0 + kit.half + g, top, rw, kit.h);
    return;
  }
  const k = clamp(Math.round(open * (SWING_STEPS - 1)), 0, SWING_STEPS - 1);
  ctx.drawImage(kit.left[k], x0, top);
  if (kit.right) ctx.drawImage(kit.right[k], x0 + kit.lw, top);
}
// interiör bakom en dörr: vägg, golv i perspektiv, taklampa
function paintInside(P, w, h, o) {
  vgrad(P, 0, 0, w, h - 9, o.wall0, o.wall1, 4);
  for (let y = h - 9; y < h; y++) for (let x = 0; x < w; x++) {
    const tile = ((x + Math.floor((y - (h - 9)) * 0.5)) >> 2) + (y >> 1);
    P.px(x, y, mix(tile % 2 ? o.floor : mul(o.floor, 0.88), WHITE, (y - (h - 9)) / 30));
  }
  P.hl(0, h - 9, w, mul(o.wall1, 0.7));
  P.hl(2, 1, w - 4, WHITE); P.hl(3, 2, w - 6, 0xfff8e0, 0.5);
}
const kitOf = (key, make) => { let k = KITS.get(key); if (!k) { k = make(); KITS.set(key, k); } return k; };

// =====================================================================
// BANK – PIXELBANKEN: kalkstenstempel med gavelfält (bikupan i guld),
// fyra joniska kolonner, trappa, bronsdörrar, klocka som går, kopparklätt tak,
// balustrad, lyktor och en bankomat i högra flygeln.
// =====================================================================
function paintBank(b, night, opts) {
  const K = begin(b, night, opts), P = K.P, { L, R, baseY } = K;
  const STONE = 0xe8dec8, SHADE = 0xb0a28a, GOLD = 0xe8c060, BRONZE = 0x7a4e24, COPPER = 0x5aa08a;
  const cx = (L + R) >> 1, dx0 = K.dx0, dx1 = K.dx1;
  const pL = 34, pR = R - 26, corn = 50, stylo = baseY - 6, doorTop = stylo - 34;
  // ---- kopparklätt tak (ärggrönt med falsar) ----
  for (let y = 30; y < corn - 6; y++) for (let x = L; x < R; x++) {
    const n = noise(x / 9, y / 4, 13);
    let c = mix(COPPER, 0x3a7a68, q((y - 30) / 16, x, y, 3) * 0.6);
    if (n > 0.7) c = mix(c, 0x8a6a3a, 0.25);                                  // brunare fläckar
    if ((x - L) % 5 === 0) c = mix(c, WHITE, 0.22); else if ((x - L) % 5 === 4) c = mul(c, 0.84);   // falsarna
    if (y === 30) c = mix(COPPER, WHITE, 0.4);
    P.px(x, y, c);
  }
  snowRoof(K, L, 31, b.w, corn - 37);
  // oxögon (runda takkupor) på flyglarna
  for (const ox of [L + 13, R - 14]) {
    for (let y = -4; y <= 4; y++) for (let x = -5; x <= 5; x++) {
      const d = (x / 5.5) ** 2 + (y / 4.5) ** 2;
      if (d > 1) continue;
      P.px(ox + x, 37 + y, d > 0.55 ? (x < 0 ? mix(STONE, WHITE, 0.2) : mul(STONE, 0.8)) : night ? 0x1c2438 : mix(0x9ac0dc, 0x3a5a7a, (y + 4) / 8));
    }
    P.vl(ox, 34, 7, mul(STONE, 0.8)); P.hl(ox - 3, 37, 7, mul(STONE, 0.8));
    K.ledges.push([ox - 4, 32, 9, 1]);
  }
  // ---- balustraden på flyglarna ----
  for (const [x0, x1] of [[L, pL], [pR, R]]) {
    P.rect(x0, corn - 7, x1 - x0, 2, STONE); P.hl(x0, corn - 7, x1 - x0, mix(STONE, WHITE, 0.4));
    for (let x = x0 + 1; x < x1 - 1; x += 4) {
      P.px(x + 1, corn - 5, STONE); P.hl(x, corn - 4, 3, STONE); P.px(x + 1, corn - 3, mul(STONE, 0.85)); P.hl(x, corn - 2, 3, STONE);
      P.px(x + 2, corn - 4, mul(STONE, 0.75)); P.px(x + 2, corn - 2, mul(STONE, 0.75));
    }
    P.rect(x0, corn - 1, x1 - x0, 1, mul(STONE, 0.8));
    K.ledges.push([x0, corn - 8, x1 - x0, 1]);
  }
  // takfotsgesims med tandsnitt
  const cornice = (x0, x1, y) => {
    P.rect(x0, y, x1 - x0, 6, STONE);
    P.hl(x0, y, x1 - x0, mix(STONE, WHITE, 0.5)); P.hl(x0, y + 1, x1 - x0, mix(STONE, WHITE, 0.2));
    for (let x = x0; x < x1; x++) { P.px(x, y + 3, (x & 1) ? mul(STONE, 0.7) : STONE); P.px(x, y + 4, (x & 1) ? mul(STONE, 0.62) : mul(STONE, 0.92)); }
    P.hl(x0, y + 5, x1 - x0, mul(STONE, 0.7));
    P.darken(x0, y + 6, x1 - x0, 2, 0.8);
  };
  // ---- flyglarna: övervåning med fönster, bottenvåning i rustik ----
  for (const [x0, x1, side] of [[L, pL, 0], [pR, R, 1]]) {
    ashlar(P, x0, corn, x1 - x0, 70, STONE, { course: 7, block: 13, seed: 41 + side });
    ashlar(P, x0, corn + 70, x1 - x0, baseY - corn - 76, mix(STONE, SHADE, 0.12), { course: 6, block: 12, seed: 43 + side, rustic: true });
    P.hl(x0, corn + 69, x1 - x0, mix(STONE, WHITE, 0.4)); P.hl(x0, corn + 70, x1 - x0, STONE); P.hl(x0, corn + 71, x1 - x0, mul(STONE, 0.7));
    K.ledges.push([x0, corn + 68, x1 - x0, 1]);
    const wcx = (x0 + x1) >> 1;
    // övervåningens fönster med fronton och balusterbröstning
    const wy = corn + 20, wh = 24;
    for (let j = 0; j < wh; j++) for (let i = 0; i < 10; i++) {
      const X = wcx - 5 + i, Y = wy + j;
      P.px(X, Y, night ? glassNight(X, Y, 0.5, j / wh, 7) : glassDay(X + K.box.x, Y, 0.3, j / wh, [0xb0d0e8, 0x5a7a9a, 0x3a4a60], 9, { skyline: false }));
    }
    P.box(wcx - 6, wy - 1, 12, wh + 2, mul(STONE, 0.6)); P.vl(wcx, wy, wh, 0xe8e0d0); P.hl(wcx - 5, wy + 8, 10, 0xe8e0d0);
    K.offices.push([wcx - 5, wy, 5, 8, 9000 + side, false], [wcx + 1, wy, 4, 8, 9000 + side, false], [wcx - 5, wy + 9, 5, wh - 9, 9002 + side, false], [wcx + 1, wy + 9, 4, wh - 9, 9002 + side, false]);
    for (let r = 0; r < 5; r++) P.hl(wcx - 2 - r, wy - 7 + r, 5 + r * 2, r === 4 ? mul(STONE, 0.7) : mix(STONE, WHITE, 0.2 - r * 0.03));   // fronton
    P.hl(wcx - 7, wy - 2, 14, mul(STONE, 0.75));
    K.ledges.push([wcx - 2, wy - 8, 5, 1]);
    P.rect(wcx - 7, wy + wh + 1, 14, 2, mix(STONE, WHITE, 0.3)); P.hl(wcx - 7, wy + wh + 3, 14, mul(STONE, 0.7));
    for (let x = wcx - 6; x < wcx + 7; x += 3) { P.vl(x, wy + wh + 4, 4, STONE); P.px(x + 1, wy + wh + 5, mul(STONE, 0.78)); }
    K.ledges.push([wcx - 7, wy + wh, 14, 1]);
    // girlang (relief) under gesimsen
    for (let i = -8; i <= 8; i++) P.px(wcx + i, corn + 9 + Math.round((1 - (i / 8) ** 2) * 3), mix(STONE, SHADE, 0.5));
    P.px(wcx - 8, corn + 8, mix(STONE, SHADE, 0.6)); P.px(wcx + 8, corn + 8, mix(STONE, SHADE, 0.6));
    const gy = corn + 78;
    if (side === 1) {
      // valvfönster med smidesgaller
      const aw = 14, ah = 34, ax = wcx - 7;
      for (let j = 0; j < ah; j++) for (let i = 0; i < aw; i++) {
        const dy = j - 7, dxx = i - 6.5;
        if (j < 7 && dxx * dxx + dy * dy > 49) continue;
        const X = ax + i, Y = gy + j;
        P.px(X, Y, night ? mix(0x2a2c40, 0x141628, j / ah) : glassDay(X + K.box.x, Y, 0.35 + j / 90, j / ah, [0xa8c8e0, 0x4a6a88, 0x2a3a50], 3, { skyline: false }));
      }
      for (let i = 1; i < aw; i += 3) for (let j = 2; j < ah; j++) { const dy = j - 7, dxx = i - 6.5; if (j >= 7 || dxx * dxx + dy * dy <= 49) P.px(ax + i, gy + j, 0x1a1a20); }
      for (let j = 10; j < ah; j += 8) P.hl(ax, gy + j, aw, 0x1a1a20);
      for (let a = 0; a < 16; a++) { const an = Math.PI * a / 15; P.px(Math.round(ax + 6.5 + Math.cos(an) * 8), Math.round(gy + 7 - Math.sin(an) * 8), mul(STONE, 0.66)); }
      P.rect(ax + 5, gy - 3, 4, 4, mix(STONE, WHITE, 0.3)); P.vl(ax + 8, gy - 3, 4, mul(STONE, 0.7));        // slutsten
      P.rect(ax - 2, gy + ah, aw + 4, 2, mix(STONE, WHITE, 0.3)); P.hl(ax - 2, gy + ah + 2, aw + 4, mul(STONE, 0.6));
      K.ledges.push([ax - 2, gy + ah - 1, aw + 4, 1]);
      K.offices.push([ax + 2, gy + 11, 2, ah - 12, 9100, false], [ax + 5, gy + 11, 2, ah - 12, 9100, false], [ax + 8, gy + 11, 2, ah - 12, 9100, false], [ax + 11, gy + 11, 2, ah - 12, 9100, false]);
    } else {
      // BANKOMAT: grön skylt UTTAG, skärm (i live), knappsats, kortläsare, sedelutmatning
      const ax = wcx - 10, ay = gy + 4;
      P.rect(ax - 1, ay - 1, 22, 34, 0x5a5650); P.rect(ax, ay, 20, 32, 0x8a8a90);
      P.hl(ax, ay, 20, 0xc8ccd2); P.vl(ax, ay, 32, 0xb0b4ba); P.vl(ax + 19, ay, 32, 0x4a4a52);
      P.rect(ax + 1, ay + 1, 18, 7, 0x1e7a3a); P.hl(ax + 1, ay + 1, 18, 0x3aa85a);
      text(P, SMALL, 'UTTAG', ax + 1 + ((18 - textW(SMALL, 'UTTAG')) >> 1), ay + 2, 0xffffff);
      P.rect(ax + 3, ay + 10, 14, 9, 0x1a2a3a);
      for (let r = 0; r < 3; r++) for (let c2 = 0; c2 < 3; c2++) P.rect(ax + 4 + c2 * 3, ay + 21 + r * 3, 2, 2, r === 2 && c2 === 2 ? 0x3ac05a : 0xd8dce2);
      P.rect(ax + 14, ay + 21, 3, 2, 0x2a2a30); P.px(ax + 15, ay + 21, 0x40ff60);
      P.rect(ax + 13, ay + 26, 5, 2, 0x1a1a20);
      P.rect(ax - 2, ay + 32, 24, 2, 0x6a6660); P.hl(ax - 2, ay + 32, 24, 0x9a968e);
      K.atm = [ax + 4, ay + 11, 12, 7];
    }
    P.vl(x0, corn, baseY - corn, side ? STONE : mix(STONE, WHITE, 0.35));
    if (side) P.vl(x1 - 1, corn, baseY - corn, mul(STONE, 0.66));
    granite(P, x0, baseY - 6, x1 - x0, 6, 0x6a6660, 44);
    P.hl(x0, baseY - 6, x1 - x0, 0xa8a49c);
  }
  cornice(L, R, corn);
  K.ledges.push([L, corn - 1, b.w, 1]);
  // ---- portiken: bakvägg i skugga, dörr, överljus, klocka, lyktor ----
  ashlar(P, pL, corn + 26, pR - pL, stylo - corn - 26, SHADE, { course: 7, block: 16, seed: 47 });
  P.darken(pL, corn + 26, pR - pL, 4, 0.72);
  P.rect(dx0 - 3, doorTop - 14, dx1 - dx0 + 6, stylo - doorTop + 14, mix(SHADE, STONE, 0.6));
  P.vl(dx0 - 3, doorTop - 14, stylo - doorTop + 14, mix(STONE, WHITE, 0.3)); P.vl(dx1 + 2, doorTop - 14, stylo - doorTop + 14, mul(SHADE, 0.7));
  const fcx = (dx0 + dx1) / 2;
  for (let y = doorTop - 12; y < doorTop; y++) for (let x = dx0; x < dx1; x++) {
    const ang = Math.atan2(doorTop - y, x + 0.5 - fcx) / Math.PI * 9, ray = Math.abs(ang - Math.round(ang)) < 0.2;
    const inside = ((x + 0.5 - fcx) / 16) ** 2 + ((doorTop - y) / 12) ** 2 <= 1;
    P.px(x, y, !inside ? mix(SHADE, STONE, 0.6) : ray ? BRONZE : night ? 0xffd890 : mix(0xb8d0e0, 0x5a7890, (y - doorTop + 12) / 12));
  }
  P.hl(dx0, doorTop - 1, dx1 - dx0, BRONZE);
  if (night) K.glows.push([dx0 + 4, doorTop - 9, dx1 - dx0 - 8, 8, 0xffd080, 0.3]);
  P.rect(dx0 - 1, doorTop - 1, dx1 - dx0 + 2, 35, 0x2a1a0e);
  // klockan (visarna i live) i en stenkartusch, årtalet ovanför
  const clx = cx, cly = doorTop - 22;
  P.rect(clx - 9, cly - 8, 18, 16, mix(STONE, SHADE, 0.4)); P.box(clx - 9, cly - 8, 18, 16, mul(SHADE, 0.7));
  for (let y = -6; y <= 6; y++) for (let x = -6; x <= 6; x++) {
    const d = Math.hypot(x, y);
    if (d > 6.4) continue;
    P.px(clx + x, cly + y, d > 5.4 ? GOLD : d > 4.8 ? mul(GOLD, 0.7) : 0xf4eee0);
  }
  for (let hm = 0; hm < 12; hm++) { const a = hm / 12 * Math.PI * 2; P.px(Math.round(clx + Math.sin(a) * 4), Math.round(cly - Math.cos(a) * 4), 0x3a3020); }
  K.glows.push([clx - 4, cly - 4, 9, 9, 0xfff0c0, 0.22]);
  text(P, SMALL, '1897', clx - 7, cly - 15, mul(SHADE, 0.55)); text(P, SMALL, '1897', clx - 8, cly - 16, mix(STONE, WHITE, 0.2));
  // lyktor i brons på bakväggen
  for (const lx of [pL + 20, pR - 25]) {
    P.vl(lx + 2, doorTop + 4, 3, 0x2a1a0e); P.rect(lx, doorTop + 7, 5, 8, BRONZE); P.rect(lx + 1, doorTop + 8, 3, 6, night ? 0xffe8a0 : 0xe8e0c8);
    P.px(lx + 1, doorTop + 8, WHITE); P.hl(lx - 1, doorTop + 7, 7, mix(BRONZE, WHITE, 0.3)); P.hl(lx, doorTop + 15, 5, 0x2a1a0e); P.px(lx + 2, doorTop + 16, 0x2a1a0e);
    K.glows.push([lx + 1, doorTop + 8, 3, 6, 0xffd890, 0.7]);
  }
  // ---- gavelfältet (fronton) med bikupan i guld ----
  const pedL = pL - 2, pedR = pR + 2, pedTop = 26, pedBase = corn;
  const half = (pedR - pedL) / 2, pcx = (pedL + pedR) / 2;
  for (let y = pedTop; y < pedBase; y++) {
    const hw = Math.round(half * (y - pedTop + 1) / (pedBase - pedTop));
    for (let x = Math.round(pcx - hw); x < Math.round(pcx + hw); x++) {
      const edge = Math.min(x - (pcx - hw), pcx + hw - 1 - x);
      let c = edge < 3 ? (edge < 1 ? mix(STONE, WHITE, 0.45) : edge < 2 ? STONE : mul(STONE, 0.8)) : jit(mix(STONE, SHADE, 0.35), x, y, 51, 0.05);
      if (x > pcx && edge < 3) c = mul(c, 0.9);
      P.px(x, y, c);
    }
    if ((y - pedTop) % 2 === 0) { K.ledges.push([Math.round(pcx - hw), y, 2, 1], [Math.round(pcx + hw) - 2, y, 2, 1]); }
  }
  const hx = Math.round(pcx), hy = 39;
  const rows = [[3, 1], [5, 2], [7, 2], [9, 2], [9, 2]];
  let yy = hy - 5;
  rows.forEach(([w2, h2], r) => { for (let j = 0; j < h2; j++) { P.hl(hx - (w2 >> 1), yy, w2, j === 0 ? mix(GOLD, WHITE, 0.3) : r % 2 ? GOLD : mul(GOLD, 0.8)); P.px(hx + (w2 >> 1), yy, mul(GOLD, 0.6)); yy++; } });
  P.rect(hx - 1, yy - 3, 3, 3, 0x3a2a14);
  for (let k = 0; k < 8; k++) { P.px(hx - 7 - k, hy + 4 - (k >> 1), k % 2 ? 0x8a9a3a : GOLD); P.px(hx + 7 + k, hy + 4 - (k >> 1), k % 2 ? 0x8a9a3a : GOLD); }
  K.glows.push([hx - 5, hy - 5, 11, 10, 0xffd070, 0.18]);
  K.flags.push([hx - 1, 4, 'se', 0.6, 22]);
  // ---- entablementet: frisen med PIXELBANKEN i mässing, arkitraven ----
  cornice(pL - 2, pR + 2, corn);
  const fT = corn + 6;
  area(P, pL, fT, pR - pL, 14, (X, Y) => jit(STONE, X, Y, 52, 0.05));
  P.hl(pL, fT + 13, pR - pL, mul(STONE, 0.72));
  const name = 'PIXELBANKEN', nx = centerX(BIG, name, cx), tw = textW(BIG, name);
  // infälld tavla i mörkare sten bakom mässingsbokstäverna (skuggad överkant = försänkt)
  area(P, nx - 5, fT + 1, tw + 10, 11, (X, Y) => jit(mix(STONE, SHADE, 0.5), X, Y, 54, 0.04));
  P.hl(nx - 5, fT + 1, tw + 10, mul(SHADE, 0.72)); P.vl(nx - 5, fT + 1, 11, mul(SHADE, 0.8));
  P.hl(nx - 5, fT + 11, tw + 10, mix(STONE, WHITE, 0.3)); P.vl(nx + tw + 4, fT + 1, 11, mix(STONE, WHITE, 0.2));
  for (const rx of [nx - 3, nx + tw + 2]) { P.px(rx, fT + 6, GOLD); P.px(rx, fT + 5, mul(GOLD, 0.7)); }         // mässingsnitar
  signText(P, BIG, name, nx, fT + 3, GOLD, { shadow: 0x4a3010, hi: 0xfff0b8, lo: 0xb88a30 });
  K.texts.push([...textGlow(BIG, name, 1, 0xffd070, K.wx(nx), K.wy(fT + 3)), 0.55]);
  const arch = fT + 14;
  P.hl(pL, arch, pR - pL, mix(STONE, WHITE, 0.3)); P.hl(pL, arch + 1, pR - pL, STONE); P.hl(pL, arch + 2, pR - pL, mul(STONE, 0.88)); P.hl(pL, arch + 3, pR - pL, mul(STONE, 0.66));
  // ---- kolonnerna (joniska, räfflade) + pilastrarna i hörnen ----
  const colTop = arch + 4, colBot = stylo;
  const column = (ccx, w, pilaster) => {
    const hw = w >> 1;
    if (!pilaster) P.darken(ccx + hw + 1, colTop + 4, 3, colBot - colTop - 4, 0.72);   // slagskugga på bakväggen
    for (let y = colTop + 4; y < colBot - 3; y++) for (let x = ccx - hw; x <= ccx + hw; x++) {
      const lx = x - ccx;
      let c = lx <= -hw + 1 ? mix(STONE, WHITE, 0.45) : lx >= hw - 1 ? mul(STONE, 0.7) : lx > hw / 3 ? mul(STONE, 0.86) : STONE;
      if (!pilaster && (lx + hw) % 2 === 1 && Math.abs(lx) < hw - 1) c = mul(c, 0.9);   // räfflor
      P.px(x, y, jit(c, x, y, 53, 0.03));
    }
    P.rect(ccx - hw - 2, colTop, w + 4, 2, mix(STONE, WHITE, 0.35)); P.hl(ccx - hw - 2, colTop + 2, w + 4, STONE); P.hl(ccx - hw - 1, colTop + 3, w + 2, mul(STONE, 0.75));
    if (!pilaster) for (const s2 of [-1, 1]) { const vx = ccx + s2 * (hw + 1); P.px(vx, colTop + 2, mul(STONE, 0.6)); P.px(vx, colTop + 3, mix(STONE, WHITE, 0.2)); P.px(vx + s2, colTop + 3, mul(STONE, 0.55)); }
    P.rect(ccx - hw - 1, colBot - 3, w + 2, 2, STONE); P.hl(ccx - hw - 1, colBot - 3, w + 2, mix(STONE, WHITE, 0.4));
    P.rect(ccx - hw - 2, colBot - 1, w + 4, 1, mul(STONE, 0.8));
  };
  column(pL + 2, 5, true); column(pR - 3, 5, true);
  for (const c2 of [pL + 14, pL + 30, pR - 31, pR - 15]) column(c2, 10, false);
  // ---- stylobaten och trappan ut mot trottoaren ----
  for (let s2 = 0; s2 < 3; s2++) {
    const y = stylo + s2 * 2, x0 = pL - 2 - s2 * 2, w2 = pR - pL + 4 + s2 * 4;
    P.rect(x0, y, w2, 2, mix(STONE, SHADE, 0.2 + s2 * 0.1)); P.hl(x0, y, w2, mix(STONE, WHITE, 0.35 - s2 * 0.08));
    K.ledges.push([x0, y, w2, 1]);
  }
  footShadow(K, L, pL - 6 - L); footShadow(K, pR + 6, R - pR - 6);
  return finish(K, { clock: [K.wx(clx), K.wy(cly)], atm: K.atm && [K.wx(K.atm[0]), K.wy(K.atm[1]), K.atm[2], K.atm[3]], doorTop: K.wy(doorTop),
    spots: [pL + 14, pL + 30, pR - 31, pR - 15].map((x) => K.wx(x)) });
}
function bankKit(b, night) {
  const w = b.door.x1 - b.door.x0;
  return swingKit(w, 34, (I) => {
    paintInside(I, w, 34, { wall0: night ? 0xffe8b8 : 0xf0e6cc, wall1: night ? 0xd8a860 : 0xc8b490, floor: 0x8a7a64 });
    // kassadiskarna med galler och en grön lampa
    I.rect(2, 20, w - 4, 6, 0x6a4a2a); I.hl(2, 20, w - 4, 0xc8a060);
    for (let x = 3; x < w - 3; x += 2) I.vl(x, 12, 8, 0xb89a50);
    I.hl(2, 12, w - 4, 0xd8b060);
    I.rect((w >> 1) - 2, 16, 4, 3, 0x3aa85a); I.px((w >> 1) - 1, 16, 0xa8ffc0);
    if (night) I.darken(0, 0, w, 34, NIGHT_WIN);
  }, (P, lw, h, side) => {
    const c = 0x7a4e24;
    vgrad(P, 0, 0, lw, h, mix(c, WHITE, 0.12), mul(c, 0.72), 3);
    P.box(0, 0, lw, h, 0x2a1a0e); P.vl(side ? lw - 2 : 1, 1, h - 2, mix(c, WHITE, 0.3));
    P.box(2, 2, lw - 4, 11, mul(c, 0.55)); P.rect(3, 3, lw - 6, 9, 0x9ac0d8); P.hl(3, 3, lw - 6, 0xd8ecf8);
    for (let x = 4; x < lw - 3; x += 3) P.vl(x, 3, 9, 0x6a4a24);
    P.box(2, 15, lw - 4, 8, 0xd8b060); P.box(3, 16, lw - 6, 6, mul(c, 0.8));
    P.box(2, 25, lw - 4, 7, 0xd8b060);
    P.rect(side ? 1 : lw - 3, 17, 2, 4, 0xf0d070); P.px(side ? 1 : lw - 3, 21, 0x8a6a20);    // handtaget
  }, true);
}
// klockans visare efter spelklockan
function drawClock(ctx, c, hour) {
  if (!c) return;
  const [x, y] = c, hA = ((hour % 12) / 12) * Math.PI * 2, mA = (hour % 1) * Math.PI * 2;
  ctx.fillStyle = '#2a2016';
  for (let r = 0; r <= 3; r++) ctx.fillRect(Math.round(x + Math.sin(hA) * r), Math.round(y - Math.cos(hA) * r), 1, 1);
  ctx.fillStyle = '#1a1410';
  for (let r = 0; r <= 4; r++) ctx.fillRect(Math.round(x + Math.sin(mA) * r), Math.round(y - Math.cos(mA) * r), 1, 1);
  ctx.fillStyle = '#c8a040'; ctx.fillRect(x, y, 1, 1);
}
// bankomatens skärm: KORT → KOD → KR och en blinkande markör
function drawAtm(ctx, a, st) {
  const [x, y, w, h] = a, t = st.t || 0;
  ctx.fillStyle = '#1e5a8a'; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = '#3a8ac8'; ctx.fillRect(x, y, w, 1);
  const ph = Math.floor(t / 2.5) % 3;
  ctxTxt(ctx, SMALL, ['KORT', 'KOD', 'KR'][ph], x + 1, y + 1, '#ffffff');
  if (Math.floor(t * 2) & 1) { ctx.fillStyle = '#ffffff'; ctx.fillRect(x + w - 3, y + h - 1, 2, 1); }
}
function liveBank(ctx, b, st) {
  const m = metaOf(b, st.night, st);
  if (!m) return;
  const kit = kitOf('bank:' + b.id + ':' + !!st.night, () => bankKit(b, st.night));
  drawDoorKit(ctx, b.door.x0, m.doorTop, kit, st.doorOpen, (x0, top) => boost(ctx, st, () => ctx.drawImage(kit.inside, x0, top), isOpen(b, st) ? 1 : 0.3));
  drawClock(ctx, m.clock, st.hour ?? 12);
  if (m.atm) { drawAtm(ctx, m.atm, st); boost(ctx, st, () => drawAtm(ctx, m.atm, st)); }   // bankomatens skärm lyser
  liveCommon(ctx, b, st, m);
}
let BEAM = null;                                                                          // strålkastarkäglan (byggs en gång)
function glowBank(ctx, b, st) {
  glowBase(ctx, b, st, (c, m, k) => {
    // strålkastare som lyser upp kolonnerna nerifrån, ljuspölen vid dörren
    const base = baseOf(b), x0 = b.door.x0, dw = b.door.x1 - b.door.x0;
    if (!BEAM) { const B = new Pix(9, 96); for (let r = 0; r < 24; r++) B.rect(0, 92 - r * 4, 9, 4, 0xffe0b0, 0.1 * (1 - r / 24)); BEAM = B.flush(); }
    c.globalAlpha = k;
    for (const sx of m.spots) c.drawImage(BEAM, sx - 4, base - 102);
    c.globalAlpha = 1;
    for (let r = 0; r < 10; r++) { const sp = Math.round(r * 0.6); c.fillStyle = rgba(0xffd890, 0.12 * k * (1 - r / 10)); c.fillRect(x0 - sp, base + r, dw + sp * 2, 1); }
  });
}

// =====================================================================
// ELEKTRONIK: grafitgrå butik med en stor LED-skärm (reklam som växlar), kanalbokstäver
// i cyan, skyltfönster med telefoner och surfplattor (vänster) och en tv-vägg med
// datorer (höger) – alla skärmar lever i live() och lyser i mörkret.
// =====================================================================
// ---------- tv-kanaler: färdiga bildrutor per (kanal, storlek) ----------
const CH = new Map();
function channelFrames(kind, w, h) {
  const key = kind + w + 'x' + h;
  if (CH.has(key)) return CH.get(key);
  const n = 8, out = [];
  for (let f = 0; f < n; f++) {
    const P = new Pix(w, h), ph = f / n;
    if (kind === 'fotboll') {
      area(P, 0, 0, w, h, (X, Y) => (((X >> 2) & 1) ? 0x3a9a44 : 0x46a852));
      P.vl(w >> 1, 0, h, 0xe8f4e8); P.hl(0, 0, w, 0xe8f4e8); P.hl(0, h - 1, w, 0xe8f4e8);
      for (let a = 0; a < 12; a++) P.px(Math.round((w >> 1) + Math.cos(a / 12 * 6.28) * 3), Math.round((h >> 1) + Math.sin(a / 12 * 6.28) * 2), 0xe8f4e8);
      const bx = Math.round(w * 0.5 + Math.sin(ph * 6.28) * w * 0.34), by = Math.round(h * 0.5 + Math.sin(ph * 12.56 + 1) * h * 0.28);
      for (let p = 0; p < 4; p++) {
        const px = Math.round(bx + Math.cos(p * 1.7 + ph * 6.28) * (4 + p * 2)), py = Math.round(by + Math.sin(p * 2.3 + ph * 6.28) * 3);
        P.px(px, py, p & 1 ? 0xe83a3a : 0x3a5ae8); P.px(px, py - 1, 0xf0c8a0);
      }
      P.px(bx, by, WHITE);
      if (w >= 20) { P.rect(1, 1, 11, 7, 0x1a1a2a); text(P, SMALL, '2-1', 1, 2, WHITE); }
    } else if (kind === 'natur') {
      area(P, 0, 0, w, h, (X, Y) => mix(0xff9a40, 0x6a3a8a, q(Y / h * 1.3, X, Y, 3)));
      const sx = Math.round(w * 0.7), sy = Math.round(h * 0.45);
      for (let y = -3; y <= 3; y++) for (let x = -3; x <= 3; x++) if (x * x + y * y <= 9) P.px(sx + x, sy + y, 0xffe890);
      for (let x = 0; x < w; x++) { const m2 = Math.round(h * 0.62 - Math.abs(Math.sin(x * 0.35)) * h * 0.2 - Math.sin(x * 0.11) * 2); for (let y = m2; y < h; y++) P.px(x, y, y > h * 0.8 ? 0x1a2a3a : 0x2a3a5a); }
      const bx = Math.round(ph * (w + 6)) - 3, by = Math.round(h * 0.25 + Math.sin(ph * 12.56));
      P.px(bx, by, 0x1a1420); P.px(bx - 1, by - (f & 1), 0x1a1420); P.px(bx + 1, by - (f & 1), 0x1a1420);
    } else if (kind === 'tecknat') {
      area(P, 0, 0, w, h, (X, Y) => (Y > h * 0.7 ? 0x5ac04a : mix(0x6ac8ff, 0xb8e8ff, Y / h)));
      P.ell(Math.round(w * 0.2), Math.round(h * 0.25), 4, 2, WHITE, 1, 2);
      const cx = Math.round(w * 0.3 + ph * w * 0.4), cy = Math.round(h * 0.62 - Math.abs(Math.sin(ph * 6.28 * 2)) * h * 0.35);
      for (let y = -3; y <= 3; y++) for (let x = -3; x <= 3; x++) if (x * x + y * y <= 10) P.px(cx + x, cy + y, x * x + y * y > 7 ? 0xc89a10 : 0xffd23f);
      P.px(cx - 1, cy - 1, 0x1a1420); P.px(cx + 1, cy - 1, 0x1a1420); P.hl(cx - 1, cy + 1, 3, 0xc83a3a);
    } else if (kind === 'nyheter') {
      area(P, 0, 0, w, h, (X, Y) => mix(0x1a4a8a, 0x0a2a5a, q(Y / h, X, Y, 3)));
      for (let y = 0; y < h - 3; y++) P.px((y * 3 + f) % w, y, 0x2a6ab0);
      const ax = w >> 1;
      P.rect(ax - 3, h - 8, 7, 5, 0x2a2a3a); P.rect(ax - 2, h - 12, 5, 4, 0xe0a97f); P.hl(ax - 2, h - 12, 5, 0x3b2619); P.px(ax, h - 6, 0xc83a3a);
      P.rect(0, h - 3, w, 3, 0xc83a3a); P.hl(0, h - 3, w, 0xe86a6a);
      for (let x = 0; x < w; x += 3) if (((x + f * 2) % 9) < 5) P.px(x, h - 2, WHITE);
    } else if (kind === 'musik') {
      area(P, 0, 0, w, h, () => 0x0a0a14);
      const cols = [0xff4a6a, 0xffa040, 0xffe050, 0x5aff8a, 0x40c8ff, 0xa06aff];
      for (let x = 0; x < w; x += 2) {
        const bh = Math.max(1, Math.round((0.3 + 0.7 * Math.abs(Math.sin(x * 0.7 + ph * 6.28 * 2 + Math.sin(x * 0.3)))) * (h - 2)));
        for (let y = 0; y < bh; y++) P.px(x, h - 1 - y, cols[Math.floor(y / h * cols.length)]);
      }
    } else if (kind === 'skrivbord') {
      area(P, 0, 0, w, h, (X, Y) => mix(0x3a7ad0, 0x1a4a9a, Y / h));
      P.rect(1, 1, Math.max(2, w - 4), Math.max(2, h - 3), 0xe8ecf0); P.hl(1, 1, Math.max(2, w - 4), 0x2a5ab0);
      if (f % 4 < 2) P.px(2 + (f % 3), 3, 0x1a1a2a);
      P.hl(0, h - 1, w, 0x1a2a4a);
    } else if (kind === 'spel') {
      area(P, 0, 0, w, h, (X, Y) => (Y > h * 0.6 ? 0x2a1a3a : 0x0a0a1a));
      for (let x = 0; x < w; x++) if (((x + f) % 5) === 0) P.px(x, Math.round(h * 0.6), 0x40ff80);
      P.rect(2 + (f % 3), Math.round(h * 0.6) - 2, 2, 2, 0xff4ad0);
    }
    out.push(P.flush());
  }
  CH.set(key, out);
  return out;
}
// telefonernas och surfplattornas bakgrundsbilder
const WALLS_PH = [[0xff6a8a, 0x6a3ad0], [0x40c8ff, 0x2a5ad0], [0xffc040, 0xe0402a], [0x5ae08a, 0x1a7a8a], [0xf0f0f8, 0x9aa0c0], [0x1a1a2a, 0x4a3a8a]];
const SCR = new Map();
function drawScreen(ctx, x, y, w, h, wall, t, seed) {
  const key = wall[0] + ':' + wall[1] + ':' + w + 'x' + h;
  let cv = SCR.get(key);
  if (!cv) {
    const S = new Pix(w, h);
    for (let j = 0; j < h; j++) S.hl(0, j, w, mix(wall[0], wall[1], j / Math.max(1, h - 1)));
    for (let j = 0; j < Math.max(1, h >> 1); j++) S.px(0, j, WHITE, 0.35);                   // glaset blänker i kanten
    if (h >= 6) { S.px(w >> 1, 0, 0x1a1a22); S.hl(1, h - 2, w - 2, WHITE, 0.25); }         // kameran, apprad
    cv = S.flush(); SCR.set(key, cv);
  }
  ctx.drawImage(cv, x, y);
  if (((t * 0.4 + seed * 0.37) % 1) < 0.14) { ctx.fillStyle = '#ffffff'; ctx.fillRect(x, y + 1, w, 1); }       // en notis
}
// ---------- reklamskärmen: fyra annonser som byts var femte sekund ----------
let ADS = null;
function adFrames(w, h) {
  if (ADS && ADS.w === w) return ADS.list;
  const mk = (bg0, bg1, paint) => { const P = new Pix(w, h); vgrad(P, 0, 0, w, h, bg0, bg1, 4); paint(P); for (let j = 3; j < h; j += 4) P.darken(0, j, w, 1, 0.88); return P.flush(); };
  const phone = (P, x, y) => { P.rect(x, y, 13, 26, 0x1a1a22); P.box(x, y, 13, 26, 0x5a5a66); vgrad(P, x + 1, y + 3, 11, 20, 0xff6a8a, 0x6a3ad0, 3); P.hl(x + 5, y + 1, 3, 0x4a4a52); P.hl(x + 4, y + 24, 5, 0x4a4a52); };
  const list = [
    mk(0x2a1a5a, 0x0a0a2a, (P) => {
      phone(P, 6, 5);
      text(P, BIG, 'PIXELFON', 24, 6, WHITE); eachTextPixel(BIG, '15', 24, 17, 2, (px, py) => P.px(px, py, 0xffd23f));
      text(P, SMALL, 'FRÅN', 51, 18, 0x9ae0ff); text(P, BIG, '7990:-', 51, 25, 0x9ae0ff);
    }),
    mk(0xd82a3a, 0x8a1020, (P) => {
      text(P, BIG, 'TV-REA', 5, 5, WHITE);
      eachTextPixel(BIG, '-30%', 5, 17, 2, (px, py) => P.px(px, py, 0xffe040));
      P.rect(w - 30, 7, 26, 17, 0x1a1a22); vgrad(P, w - 29, 8, 24, 14, 0x40c8ff, 0x2a5ad0, 3); P.rect(w - 19, 24, 4, 3, 0x2a2a30); P.hl(w - 23, 27, 12, 0x2a2a30);
    }),
    mk(0x1a8a8a, 0x0a4a5a, (P) => {
      // (plattan smalare och texten fyra pixlar in – SURFPLATTA är 59 px bred och fick inte luft mot ramen)
      P.rect(4, 6, 17, 26, 0xe8ecf0); vgrad(P, 6, 8, 13, 21, 0x5ae08a, 0x1a7a8a, 3); P.px(12, 30, 0x9aa0a8);
      const tx = Math.max(25, w - 5 - textW(BIG, 'SURFPLATTA'));
      text(P, BIG, 'SURFPLATTA', tx, 7, WHITE); text(P, SMALL, 'FRÅN', tx, 19, 0x9af0e0); text(P, BIG, '2990:-', tx, 26, 0xffe040);
    }),
    mk(0x0a0a14, 0x1a0a2a, (P) => {
      P.rect(6, 20, 24, 3, 0x9aa0a8); P.rect(9, 7, 18, 13, 0x2a2a30); vgrad(P, 10, 8, 16, 11, 0xff4ad0, 0x40ff80, 3);
      text(P, BIG, 'DATORER', 36, 7, 0x40ff80); text(P, SMALL, 'SPELA MER!', 36, 20, 0xff9ae8); text(P, SMALL, 'FRÅN 5990:-', 36, 27, WHITE);
    }),
  ];
  ADS = { w, list };
  return list;
}
function drawAd(ctx, x, y, w, h, t) {
  const list = adFrames(w, h), per = 5, i = Math.floor(t / per) % list.length, ph = (t % per) / per;
  ctx.drawImage(list[i], x, y);
  if (ph > 0.9) {                                                                    // bytet: nästa annons sveper in från höger
    const nx = Math.round(w * (1 - (ph - 0.9) / 0.1)), nxt = list[(i + 1) % list.length];
    ctx.drawImage(nxt, 0, 0, w - nx, h, x + nx, y, w - nx, h);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(x + nx, y, 1, h);
  }
}
function paintElektronik(b, night, opts) {
  const K = begin(b, night, opts), P = K.P, { L, R, baseY } = K;
  const GRAPH = 0x2e323a, ALU = 0xa8b0bc, CYAN = 0x40d8ff;
  const dx0 = K.dx0, dx1 = K.dx1, top = K.ftop;
  // ---- taket: parabolantenner, mobilmast, aggregat ----
  roofFelt(P, L, 38, b.w, top - 38, 0x6a6c72, 21);
  P.hl(L, 38, b.w, 0x9a9ca2);
  snowRoof(K, L, 39, b.w, top - 42);
  hvac(P, L + 8, 44, 18, 5, 6, { fans: 3 });
  hvac(P, R - 34, 42, 12, 4, 5, { fans: 2 });
  ventPipe(P, L + 36, 48, 8); ventPipe(P, R - 16, 47, 9);
  for (const [x, y] of [[L + 52, 44], [L + 70, 48], [R - 50, 45]]) {                 // paraboler
    P.vl(x + 3, y + 5, 6, 0x5a5e66);
    for (let j = -3; j <= 3; j++) for (let i = -4; i <= 4; i++) { const d = (i / 4.4) ** 2 + (j / 3.4) ** 2; if (d <= 1) P.px(x + 3 + i, y + 3 + j, d > 0.7 ? 0xb8bcc4 : i < 0 ? 0xf0f2f6 : 0xd8dce2); }
    P.px(x + 5, y + 1, 0x3a3e46); P.px(x + 6, y, 0x3a3e46);
  }
  const [mx, my] = mast(P, L + 96, 26, 56, { dish: true });
  K.lamps.push([mx, my, 0xff3020, 0.9]);
  P.rect(L, top - 4, b.w, 4, ALU); P.hl(L, top - 4, b.w, 0xe8ecf2); P.hl(L, top - 1, b.w, 0x5a606a);
  K.ledges.push([L, top - 5, b.w, 1]);
  // ---- fasaden: grafitkassetter med fogar ----
  area(P, L, top, b.w, baseY - top, (X, Y) => {
    const px = (X - L) % 19, py = (Y - top) % 13;
    let c = jit(GRAPH, X, Y, 22, 0.05);
    if (px === 18 || py === 12) c = mul(GRAPH, 0.7); else if (px === 0 || py === 0) c = mix(GRAPH, WHITE, 0.1);
    return c;
  });
  P.vl(L, top, baseY - top, mix(GRAPH, WHITE, 0.25)); P.vl(R - 1, top, baseY - top, mul(GRAPH, 0.6));
  // ---- LED-skärmen (annonserna ritas i live) ----
  const sx = L + 32, sy = top + 6, sw = 88, sh = 36;
  P.rect(sx - 3, sy - 3, sw + 6, sh + 6, 0x14161c); P.box(sx - 3, sy - 3, sw + 6, sh + 6, ALU); P.hl(sx - 3, sy - 3, sw + 6, 0xe8ecf2);
  P.rect(sx, sy, sw, sh, 0x0a0a10);
  P.darken(sx - 2, sy + sh + 3, sw + 4, 2, 0.7);
  // ---- övervåningens fönsterband: spelavdelningen (vänster) och hörlurarna (höger) ----
  const ribbon = (x, w, kind) => {
    const y = sy, h = sh;
    P.rect(x - 2, y - 2, w + 4, h + 4, 0x14161c); P.box(x - 2, y - 2, w + 4, h + 4, ALU);
    vgrad(P, x, y, w, h, night ? 0xfff0d0 : 0xf4f6f8, night ? 0xd8c0a0 : 0xc8ccd4, 3);
    P.hl(x, y + 1, w, WHITE);
    if (kind === 'spel') {
      for (let k = 0; k < 3; k++) { const sy2 = y + 8 + k * 9; P.hl(x, sy2 + 6, w, 0x8a8e96); for (let i = 1; i < w - 2; i += 5) { const c = [0x3a7ad0, 0xe83a3a, 0x40c060, 0xffd23f, 0x2a2a30][(i + k * 2) % 5]; P.rect(x + i, sy2, 4, 6, c); P.hl(x + i, sy2, 4, mix(c, WHITE, 0.3)); } }
      P.rect(x + w - 9, y + h - 12, 7, 10, 0x2a2a30); P.rect(x + w - 8, y + h - 16, 5, 5, 0xe83a3a); P.px(x + w - 6, y + h - 2, 0x5a5a60);   // spelstol
    } else {
      for (let r = 0; r < 3; r++) for (let i = 2; i < w - 3; i += 6) {
        const c = [0x1a1a22, 0xf0f0f4, 0xe83a3a, 0x3a7ad0, 0xffd23f][(i + r * 3) % 5], y2 = y + 6 + r * 10;
        P.px(x + i + 2, y2 - 1, 0x5a5e66);
        P.hl(x + i + 1, y2, 3, c); P.px(x + i, y2 + 1, c); P.px(x + i + 4, y2 + 1, c); P.rect(x + i, y2 + 2, 2, 3, c); P.rect(x + i + 3, y2 + 2, 2, 3, c);
      }
    }
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const d = ((i + j * 2 + x) % 23 + 23) % 23; if (d < 2) P.px(x + i, y + j, WHITE, night ? 0.08 : 0.3); }
    K.lit.push([x, y, w, h, 0.16]);
  };
  ribbon(L + 4, 21, 'spel'); ribbon(R - 25, 21, 'lurar');
  // ---- skylten: blixt + ELEKTRONIK i kanalbokstäver (dubbel storlek) ----
  const sgY = sy + sh + 8, name = 'ELEKTRONIK', tw = textW(BIG, name, 2), nx = Math.round((L + R) / 2 - (tw + 14) / 2) + 14;
  P.rect(L + 4, sgY - 3, b.w - 8, 20, 0x14161c); P.hl(L + 4, sgY - 3, b.w - 8, 0x3a3e48); P.hl(L + 4, sgY + 16, b.w - 8, 0x0a0a0e);
  eachTextPixel(BIG, name, nx + 1, sgY + 1, 2, (px, py) => P.px(px, py, 0x0e5a78));   // bokstävernas sidor
  eachTextPixel(BIG, name, nx, sgY, 2, (px, py) => P.px(px, py, (py - sgY) < 3 ? 0xf0fcff : (py - sgY) > 10 ? 0x8ae8ff : 0xc8f4ff));
  K.texts.push([...textGlow(BIG, name, 2, CYAN, K.wx(nx), K.wy(sgY)), 0.9]);
  const bx = nx - 13, by = sgY - 1;                                                    // blixten
  const bolt = ['...####', '..####.', '.####..', '#######', '..####.', '.####..', '####...', '###....', '##.....'];
  bolt.forEach((row, j) => { for (let i = 0; i < row.length; i++) if (row[i] === '#') P.px(bx + i, by + j * 2, 0xffd23f), P.px(bx + i, by + j * 2 + 1, j > 5 ? 0xe0a010 : 0xffe060); });
  K.glows.push([bx, by, 7, 18, 0xffd23f, 0.35]);
  // ---- bottenvåningen: baldakin, skyltfönster, dörr, pelare med LED-list ----
  const gT = sgY + 19;
  P.rect(L, gT, b.w, 4, ALU); P.hl(L, gT, b.w, 0xf0f4f8); P.hl(L, gT + 3, b.w, 0x5a606a);
  for (let x = L + 2; x < R - 2; x += 3) K.glows.push([x, gT + 4, 1, 1, 0xe8f8ff, 0.9]);
  K.ledges.push([L, gT - 1, b.w, 1]);
  const wY = gT + 6, wH = baseY - 6 - wY;
  const winL = [L + 4, wY, dx0 - 6 - (L + 4), wH], winR = [dx1 + 6, wY, R - 4 - (dx1 + 6), wH];
  // vänster: telefoner och surfplattor
  {
    const [x, y, w, h] = winL;
    vgrad(P, x, y, w, h, night ? 0xfff4e0 : 0xf4f6fa, night ? 0xe0d0b8 : 0xd8dce4, 3);
    P.rect(x + 3, y + 2, 34, 9, 0x1a2a6a); P.hl(x + 3, y + 2, 34, 0x3a5aaa); text(P, SMALL, 'PIXELFON', x + 4, y + 4, WHITE);
    P.rect(x + w - 11, y + 2, 9, 9, 0xe83a3a); text(P, SMALL, 'NY', x + w - 10, y + 4, WHITE);
    K.noGlow.push([x + 3, y + 2, 34, 9], [x + w - 11, y + 2, 9, 9]);                  // skyltarna: ingen ljuston över texten
    P.hl(x, y + 22, w, 0xb8bcc4); P.hl(x, y + 23, w, 0x8a8e96);                       // hyllan
    P.rect(x, y + h - 8, w, 8, 0xf8f8fc); P.hl(x, y + h - 8, w, WHITE); P.hl(x, y + h - 1, w, 0xa8acb4);   // disken
  }
  // höger: tv-väggen och datorerna
  {
    const [x, y, w, h] = winR;
    vgrad(P, x, y, w, h, night ? 0x3a3440 : 0x3a3e4a, 0x22242c, 3);
    P.rect(x, y + h - 8, w, 8, 0xe8eaf0); P.hl(x, y + h - 8, w, WHITE); P.hl(x, y + h - 1, w, 0x9aa0a8);
    P.rect(x + 2, y + 1, 34, 22, 0x0a0a0e);                                            // videoväggens ram
    K.noGlow.push([x + 2, y + 1, 34, 22], [x + 38, y + 2, 11, 20], [x + 2, y + h - 19, w - 4, 11]);   // skärmarna lyser själva
    P.rect(x + 38, y + 2, 11, 9, 0x0a0a0e); P.rect(x + 38, y + 13, 11, 9, 0x0a0a0e);
    P.rect(x + 42, y + 11, 3, 2, 0x5a5e66);
    for (const lx of [x + 2, x + 14]) { P.rect(lx, y + h - 10, 11, 2, 0xb8bcc4); P.rect(lx + 1, y + h - 18, 9, 8, 0x1a1a22); }  // laptopar
    P.rect(x + 27, y + h - 17, 11, 8, 0x1a1a22); P.rect(x + 31, y + h - 9, 3, 1, 0x5a5e66);                              // skärm
    P.rect(x + w - 7, y + h - 19, 6, 11, 0x1a1a22); P.box(x + w - 7, y + h - 19, 6, 11, 0x3a3e46);                         // datorlådan
  }
  const glassO = (x, y, w, h) => {
    P.box(x - 2, y - 2, w + 4, h + 4, ALU); P.box(x - 1, y - 1, w + 2, h + 2, 0x5a606a);
    P.hl(x - 2, y - 2, w + 4, 0xf0f4f8);
  };
  glassO(...winL); glassO(...winR);
  // dörrens överljus med ÖPPET-skylt (tänds i live)
  P.rect(dx0 - 2, wY - 2, dx1 - dx0 + 4, baseY - 34 - wY + 2, ALU); P.hl(dx0 - 2, wY - 2, dx1 - dx0 + 4, 0xf0f4f8);
  P.rect(dx0, wY, dx1 - dx0, baseY - 34 - wY - 2, 0x14161c);
  K.open = [dx0 + ((dx1 - dx0 - textW(SMALL, 'ÖPPET')) >> 1), wY + 3];
  // pelarna med lodrät LED-list
  for (const x of [L, dx0 - 5, dx1 + 1, R - 4]) {
    P.rect(x, gT + 4, 4, baseY - gT - 4, 0x1a1c22); P.vl(x + 1, gT + 6, baseY - gT - 10, night ? 0x9af0ff : 0x5a7a88);
    K.glows.push([x + 1, gT + 6, 1, baseY - gT - 10, CYAN, 0.8]);
  }
  granite(P, L, baseY - 6, b.w, 6, 0x2a2c32, 23, 0.2); P.hl(L, baseY - 6, b.w, 0x6a6e76);
  P.rect(dx0 - 2, baseY, dx1 - dx0 + 4, 2, 0x8a8e96); P.hl(dx0 - 2, baseY, dx1 - dx0 + 4, 0xc8ccd2);
  footShadow(K, L, dx0 - 2 - L); footShadow(K, dx1 + 2, R - dx1 - 2);
  // skyltfönstrens ljus ut på trottoaren (glow) och glasglansen över skärmarna (live)
  for (const [x, y, w, h] of [winL, winR]) { K.lit.push([x, y, w, h, 0.2]); K.glows.push([x, baseY, w, 4, 0xffe8c0, 0.12]); }
  const W = (r) => [K.wx(r[0]), K.wy(r[1]), r[2], r[3]];
  return finish(K, {
    ad: [K.wx(sx), K.wy(sy), sw, sh], winL: W(winL), winR: W(winR), open: [K.wx(K.open[0]), K.wy(K.open[1])],
    sheen: sheenCanvas([winL, winR], K.night, K.box.x, K.box.y),
  });
}
function elektronikKit(b, night) {
  const w = b.door.x1 - b.door.x0;
  return slideKit(w, 34, (I) => {
    paintInside(I, w, 34, { wall0: night ? 0xfff4e0 : 0xf8fafc, wall1: night ? 0xe0d0b0 : 0xd8dce4, floor: 0xc8ccd4 });
    for (let k = 0; k < 3; k++) { I.hl(1, 9 + k * 5, w - 2, 0x9aa0a8); for (let x = 2; x < w - 2; x += 3) I.rect(x, 6 + k * 5, 2, 3, [0x1a1a22, 0x3a7ad0, 0xe83a3a, 0xf0f0f4][(x + k) % 4]); }
    I.rect(3, 22, w - 6, 4, 0x2a2e36); I.hl(3, 22, w - 6, 0x40d8ff);                 // kassadisk
    if (night) I.darken(0, 0, w, 34, NIGHT_WIN);
  }, (P, pw, h, side) => {
    for (let y = 0; y < h; y++) for (let x = 0; x < pw; x++) { const d = (x + y + side * 5) % 13; P.px(x, y, d < 2 ? WHITE : 0xd8ecf8, d < 2 ? 0.5 : 0.2); }
    P.rect(0, 0, pw, 2, 0x5a606a); P.rect(0, h - 3, pw, 3, 0x5a606a); P.hl(0, h - 3, pw, 0xa8b0bc);
    P.vl(side ? pw - 1 : 0, 0, h, 0x5a606a);
    P.hl(side ? 2 : pw - 8, 16, 6, 0x40d8ff);
  });
}
function drawElekScreens(ctx, b, st, m, withAd = true) {
  const t = st.t || 0, fr = Math.floor(t * 6) & 7;
  // LED-skärmen
  if (withAd) drawAd(ctx, m.ad[0], m.ad[1], m.ad[2], m.ad[3], t);
  // vänster fönster: surfplattor på hyllan, telefoner på disken
  const [lx, ly, lw, lh] = m.winL;
  for (let k = 0; k < 3; k++) {
    const x = lx + 6 + k * 15, y = ly + 11;
    ctx.fillStyle = '#1a1a22'; ctx.fillRect(x, y, 11, 11);
    drawScreen(ctx, x + 1, y + 1, 9, 9, WALLS_PH[(k + 2) % WALLS_PH.length], t, k + 7);
    ctx.fillStyle = '#9aa0a8'; ctx.fillRect(x + 4, y + 11, 3, 1);
  }
  for (let k = 0; k < 6; k++) {
    const x = lx + 3 + k * 8, y = ly + lh - 16;
    ctx.fillStyle = k % 3 === 1 ? '#e8e8ec' : '#1a1a22'; ctx.fillRect(x, y, 5, 8);
    drawScreen(ctx, x + 1, y + 1, 3, 6, WALLS_PH[k % WALLS_PH.length], t, k);
    ctx.fillStyle = '#b8c0c8'; ctx.fillRect(x + 1, y + 8, 3, 1);                     // ställningen
    ctx.fillStyle = '#ffd23f'; ctx.fillRect(x + 1, y + 10, 3, 2);                     // prislappen
  }
  // höger fönster: videoväggen (en kanal över fyra paneler), två tv-apparater, datorerna
  const [rx, ry, rw, rh] = m.winR;
  const big = channelFrames(['fotboll', 'natur', 'tecknat'][Math.floor(t / 8) % 3], 32, 20)[fr];
  ctx.drawImage(big, rx + 3, ry + 2);
  ctx.fillStyle = '#0a0a0e'; ctx.fillRect(rx + 18, ry + 2, 1, 20); ctx.fillRect(rx + 3, ry + 11, 32, 1);
  ctx.drawImage(channelFrames('nyheter', 9, 7)[fr], rx + 39, ry + 3);
  ctx.drawImage(channelFrames('musik', 9, 7)[fr], rx + 39, ry + 14);
  ctx.drawImage(channelFrames('skrivbord', 7, 6)[fr >> 1], rx + 3, ry + rh - 17);
  ctx.drawImage(channelFrames('spel', 7, 6)[fr], rx + 15, ry + rh - 17);
  ctx.drawImage(channelFrames('natur', 9, 6)[fr], rx + 28, ry + rh - 16);
  // datorlådans regnbågsfläkt
  const cols = ['#ff4a6a', '#ffa040', '#5aff8a', '#40c8ff', '#a06aff'];
  ctx.fillStyle = cols[Math.floor(t * 3) % cols.length]; ctx.fillRect(rx + rw - 6, ry + rh - 17, 4, 1); ctx.fillRect(rx + rw - 6, ry + rh - 13, 4, 1);
  ctx.fillStyle = cols[(Math.floor(t * 3) + 2) % cols.length]; ctx.fillRect(rx + rw - 5, ry + rh - 16, 2, 3);
}
function liveElektronik(ctx, b, st) {
  const m = metaOf(b, st.night, st);
  if (!m) return;
  const kit = kitOf('elek:' + b.id + ':' + !!st.night, () => elektronikKit(b, st.night));
  drawDoorKit(ctx, b.door.x0, baseOf(b) - 34, kit, st.doorOpen, (x0, top) => boost(ctx, st, () => ctx.drawImage(kit.inside, x0, top), isOpen(b, st) ? 1 : 0.3));
  boostLit(ctx, b, st, m);                                                         // skyltfönstren lyser
  drawElekScreens(ctx, b, st, m);
  boost(ctx, st, () => drawElekScreens(ctx, b, st, m, false));                    // … och skärmarna i dem
  if (m.sheen) ctx.drawImage(m.sheen, m.sheen.x, m.sheen.y);
  const open = !b.open || (st.hour >= b.open[0] && st.hour < b.open[1]);
  ctxTxt(ctx, SMALL, 'ÖPPET', m.open[0], m.open[1], open ? '#ff4a3a' : '#3a1a1a');
  liveCommon(ctx, b, st, m);
}
function glowElektronik(ctx, b, st) {
  glowBase(ctx, b, st, (c, m, k) => {
    frontClip(c, b, st, m);
    c.globalCompositeOperation = 'source-over';
    c.globalAlpha = k;
    drawAd(c, m.ad[0], m.ad[1], m.ad[2], m.ad[3], st.t || 0);                     // den höga reklamskärmen
    const open = !b.open || (st.hour >= b.open[0] && st.hour < b.open[1]);
    if (open) ctxTxt(c, SMALL, 'ÖPPET', m.open[0], m.open[1], '#ff6a50');
    c.restore();
    // skärmens sken ut på trottoaren (under fasaden, aldrig över text)
    const [x, , w] = m.ad, base = baseOf(b);
    for (let r = 0; r < 8; r++) { c.fillStyle = rgba(0x8ad8ff, 0.07 * k * (1 - r / 8)); c.fillRect(x - r, base + 1 + r, w + r * 2, 1); }
  });
}

// ---------- lobbyvåningen för tornen i södra raden (stenpelare, glas, lobby, baldakin) ----------
// y0 = lobbyns överkant (canvas). o: { stone, stoneFn(P,x,y,w,h), wall, planters, lamps }
function lobbyFloor(K, y0, o) {
  const P = K.P, { L, R, baseY, dx0, dx1 } = K;
  const panes = [[L + 6, y0 + 2, dx0 - 6 - (L + 6), baseY - y0 - 4], [dx1 + 6, y0 + 2, R - 6 - (dx1 + 6), baseY - y0 - 4]];
  for (const [x, w] of [[L, 6], [dx0 - 6, 6], [dx1, 6], [R - 6, 6]]) o.stoneFn(P, x, y0, w, baseY - y0);
  P.vl(L, y0, baseY - y0, mix(o.stone, WHITE, 0.3)); P.vl(R - 1, y0, baseY - y0, mul(o.stone, 0.6));
  P.rect(L + 6, y0, R - L - 12, 2, mul(o.stone, 0.45));
  panes.forEach(([x, y, w, h], i) => paintLobby(P, x, y, w, h, K.night, K.seed + x, { wall: o.wall, art: i === 0 }));
  for (const [x, y, w, h] of panes) {
    for (let k = x; k <= x + w; k += 8) P.vl(Math.min(k, x + w - 1), y, h, 0x8a929c);
    P.hl(x, y + 11, w, 0x8a929c); P.hl(x, y - 1, w, 0xc8d0d8); P.hl(x, y + h, w, 0x4a4e56);
    if (o.planters) {
      o.stoneFn(P, x + 1, baseY - 7, w - 2, 6); P.hl(x + 1, baseY - 7, w - 2, mix(o.stone, WHITE, 0.3));
      for (let i = x + 2; i < x + w - 2; i++) for (let j = 0; j < 4; j++) if (hash(i, j, 19) > 0.35 - j * 0.1) P.px(i, baseY - 8 - j, j > 2 ? 0x5aa044 : (i + j) % 3 ? 0x2e6a2a : 0x3f8a36);
      K.ledges.push([x + 1, baseY - 12, w - 2, 1]);
    }
    K.lit.push([x, y, w, h, 0.13, true]);
  }
  P.rect(dx0 - 4, baseY, dx1 - dx0 + 8, 2, mul(o.stone, 0.7)); P.hl(dx0 - 4, baseY, dx1 - dx0 + 8, mix(o.stone, WHITE, 0.2));
  footShadow(K, L, dx0 - 4 - L); footShadow(K, dx1 + 4, R - dx1 - 4);
  return panes;
}
// travertin: ljus kalksten med vågräta porband
function travertine(P, x, y, w, h, c = 0xe8e2d4, seed = 61) {
  area(P, x, y, w, h, (X, Y) => {
    let k = jit(c, X, Y, seed, 0.05);
    if (Y % 9 === 8) k = mul(c, 0.86); else if (Y % 9 === 0) k = mix(c, WHITE, 0.12);
    if (hash(X >> 1, Y, seed + 1) > 0.93) k = mul(k, 0.9);                              // porer
    return k;
  });
}

// =====================================================================
// KONTOR3 – PIXEL TOWER: stadens högsta hus. Rökblått glas med vita fenor, indragna
// hörn, en glaspyramid med diamantgaller (kanterna lyser på natten) och en spira,
// namnet i LED högst upp och i stål över lobbyn.
// =====================================================================
function paintKontor3(b, night, opts) {
  const K = begin(b, night, opts), P = K.P, { L, R, baseY } = K;
  const G = [0xb8c0e0, 0x5a6490, 0x2a2e4c];
  const cx = (L + R) >> 1, apex = 12, pyrBase = 52, bandB = 60, shaftB = 168;
  // ---- spiran ----
  for (let y = 0; y < apex + 2; y++) { P.px(cx, y, y % 4 === 0 ? 0xffffff : 0xc8ccd4); if (y > 5) P.px(cx + 1, y, 0x7a808a); if (y > 9) P.px(cx - 1, y, 0xe8ecf0); }
  K.lamps.push([cx, 0, 0xff3020, 0.2]);
  // ---- glaspyramiden med diamantgaller ----
  const hwAt = (y) => Math.round(2 + (y - apex) * ((b.w / 2 - 2) / (pyrBase - apex)));
  for (let y = apex; y < pyrBase; y++) {
    const hw = hwAt(y);
    for (let x = cx - hw; x < cx + hw; x++) {
      const i = x - cx, j = y - apex, edge = Math.min(x - (cx - hw), cx + hw - 1 - x);
      let c = night ? mix(0x1a2036, 0x0c1020, j / 40) : glassDay(x + K.box.x, y, 0.05 + j / 120, j / 40, G, K.seed, { skyline: false });
      if (i > 0) c = mul(c, 0.88);                                                     // östra halvan i skugga
      if (((i + j * 2) % 12 + 12) % 12 === 0 || ((i - j * 2) % 12 + 12) % 12 === 0) c = night ? 0x3a4258 : mix(c, WHITE, 0.45);   // diamantgallret
      if (edge < 1) c = night ? 0x5a6a88 : 0xf4f6f8; else if (edge < 2) c = night ? 0x2a3040 : 0x9aa2b0;
      P.px(x, y, c);
    }
    if ((y - apex) % 3 === 0) { K.ledges.push([cx - hw, y, 2, 1], [cx + hw - 2, y, 2, 1]); }
  }
  // kantljusen längs pyramidens sidor (glow)
  for (let y = apex + 1; y < pyrBase; y += 2) { const hw = hwAt(y); K.glows.push([cx - hw, y, 1, 2, 0x9ae8ff, 0.8], [cx + hw - 1, y, 1, 2, 0x9ae8ff, 0.8]); }
  // ---- kronbandet med namnet i LED ----
  P.rect(L, pyrBase, b.w, bandB - pyrBase, 0x14161e); P.hl(L, pyrBase, b.w, 0xe8ecf0); P.hl(L, bandB - 1, b.w, 0x5a606a);
  K.ledges.push([L, pyrBase - 1, b.w, 1]);
  const led = 'PIXEL TOWER', lx = centerX(SMALL, led, cx);
  text(P, SMALL, led, lx, pyrBase + 2, night ? 0xc8f4ff : 0x5a8aa0);
  K.texts.push([...textGlow(SMALL, led, 1, 0x8ae8ff, K.wx(lx), K.wy(pyrBase + 2)), 0.95]);
  // ---- skaftet: indragna hörn + glasfasad med vita fenor ----
  const notch = (x, lit) => {
    area(P, x, bandB, 6, shaftB - bandB, (X, Y, i) => {
      const f = (Y - bandB) % 12;
      let c = night ? 0x141828 : mix(G[2], G[1], (Y - bandB) / 200);
      if (f === 0) c = 0xd8dce4; else if (f === 1) c = 0x8a909a;                        // bjälklagens kanter
      if (lit ? i === 0 : i === 5) c = lit ? 0xf0f2f6 : 0x3a3e48;
      return c;
    });
  };
  notch(L, true); notch(R - 6, false);
  curtainWall(K, L + 6, bandB, b.w - 12, shaftB - bandB, { fh: 12, cw: 9, sp: 3, g: G, mull: 0x4a5064, finC: 0xf0f2f6, span: 0x2a2e40, fin: 2, blinds: 0.16, seed: 1 });
  // ---- sockeln i travertin med namnet i stål ----
  travertine(P, L, shaftB, b.w, 14);
  P.hl(L, shaftB, b.w, 0xf8f6f0); P.darken(L, shaftB + 14, b.w, 1, 0.7);
  K.ledges.push([L, shaftB - 1, b.w, 1]);
  const name = String(b.sign || 'PIXEL TOWER').toUpperCase(), nx = centerX(BIG, name, cx); // (husets skylt – PIXELHÖGSKOLAN; LED-kronan säger PIXEL TOWER)
  signText(P, BIG, name, nx, shaftB + 4, 0x5a626e, { shadow: 0xb8b2a4, hi: 0x8a929e, lo: 0x3a404a });
  K.texts.push([...textGlow(BIG, name, 1, 0x7ad0ff, K.wx(nx), K.wy(shaftB + 4), false), 0.95]);
  const panes = lobbyFloor(K, shaftB + 14, { stone: 0xe8e2d4, stoneFn: (Q, x, y, w, h) => travertine(Q, x, y, w, h), wall: 0xe0e4ea, planters: true });
  K.flags.push([L + 2, shaftB - 24, 'dt', 0.2, 24], [R - 4, shaftB - 24, 'se', 1.1, 24]);
  return finish(K, { lobby: lobbyOf(K, panes, { n: 2 }), doorKit: { steel: 0xd0d4dc, wall0: 0xe8ecf0, wall1: 0xb8bec8, floor: 0x6a6e78 },
    gondola: [K.wx(L + 8), K.wx(R - 8 - 15), K.wy(bandB), K.wy(bandB + 4), K.wy(shaftB - 10)] });
}

// =====================================================================
// KONTOR4 – GLASTORNET: turkosgrönt glas i band med vita bjälklag, ett snett
// avskuret krön med fenor, en himmelsträdgård mitt på tornet och en stor LED-skärm
// med börskurser och reklam över entrén.
// =====================================================================
function paintKontor4(b, night, opts) {
  const K = begin(b, night, opts), P = K.P, { L, R, baseY } = K;
  const G = [0xc8f0ec, 0x6ab8c0, 0x2a6470];
  const cx = (L + R) >> 1, topAt = (x) => Math.round(24 + (x - L) * 30 / b.w), shaftB = 158;
  // ---- det sneda krönet: fenor som sticker upp, taket bakom ----
  for (let x = L; x < R; x++) {
    const t0 = topAt(x);
    // takets snedyta (ljusare mot söder), fönsterputsarens räls
    for (let y = t0 - 5; y < t0; y++) P.px(x, y, y === t0 - 5 ? 0xe8ecf0 : night ? 0x3a4050 : 0x9aa4ae);
  }
  for (let x = L + 4; x < R - 2; x += 12) {
    const t0 = topAt(x);
    for (let y = 22; y < t0 - 5; y++) { P.px(x, y, night ? 0x8a94a8 : 0xf4f6f8); P.px(x + 1, y, night ? 0x4a5060 : 0xa8b0bc); }
    K.glows.push([x, 22, 1, t0 - 27, 0x9af0ff, 0.5]);
    K.ledges.push([x, 21, 2, 1]);
  }
  P.hl(L + 4, 22, R - L - 8, night ? 0x8a94a8 : 0xf4f6f8);                            // fenornas överliggare
  K.ledges.push([L + 4, 21, R - L - 8, 1]);
  const [mx, my] = mast(P, R - 16, 8, topAt(R - 16) - 5);
  K.lamps.push([mx, my, 0xff3020, 0.7]);
  // ---- fasaden: glasband med vita bjälklag, tunna profiler ----
  const fh = 13, sp = 4, firstF = 21;
  for (let x = L; x < R; x++) {
    const t0 = topAt(x);
    for (let y = t0; y < shaftB; y++) {
      const f = y < firstF ? -1 : Math.floor((y - firstF) / fh), fy = y < firstF ? y - t0 : (y - firstF) % fh;
      const u = y < firstF ? (y - t0) / Math.max(1, firstF - t0) : (fy - sp) / (fh - sp);
      let c;
      if (y >= firstF && fy < sp) c = fy === 0 ? 0xffffff : fy === sp - 1 ? 0x9aa4ac : 0xe8ecf0;          // bjälklaget
      else {
        c = night ? glassNight(x + K.box.x, y, (y - 24) / 140, u, K.seed) : glassDay(x + K.box.x, y, (y - 24) / 150, u, G, K.seed);
        if ((x - L) % 17 === 0) c = night ? 0x3a4050 : 0xb8c8cc;                                         // profil
        if (y >= firstF && fy === sp) c = mul(c, 0.8);
      }
      if (x === L) c = mix(c, WHITE, 0.3); else if (x === R - 1) c = mul(c, 0.65);
      P.px(x, y, c);
    }
    P.px(x, t0, 0xf4f6f8); P.px(x, t0 + 1, 0xb8c0c8);
    if ((x & 1) === 0) K.ledges.push([x, t0 - 5, 1, 1]);
  }
  // kontoren (per fack mellan profilerna) – tänds efter klockan
  for (let f = 0; firstF + f * fh + fh <= shaftB; f++) for (let x0 = L + 1; x0 < R - 1; x0 += 17) {
    const w = Math.min(16, R - 1 - x0), y = firstF + f * fh + sp;
    if (f >= 7 && f <= 8) continue;                                                     // himmelsträdgården
    const yt = Math.max(y + 1, topAt(x0 + w) + 3);                                      // under det sneda krönet
    if (y + fh - sp - yt >= 3) K.offices.push([x0, yt, w, y + fh - sp - yt, 2000 + f * 20 + (x0 >> 4), false]);
  }
  // ---- himmelsträdgården (två våningar indragna) ----
  const gy = firstF + 7 * fh, gh = fh * 2;
  for (let y = gy; y < gy + gh; y++) for (let x = L + 3; x < R - 3; x++) {
    const j = y - gy;
    let c = night ? mix(0x3a2a20, 0x1a1418, j / gh) : mix(0x5a6a70, 0x2a3438, j / gh);
    if (j < 2) c = 0x1a1c20;
    P.px(x, y, c);
  }
  for (let k = 0; k < 7; k++) {                                                          // träd i planteringar
    const tx = L + 10 + k * 18 + ((hash(k, 3, 7) * 5) | 0), ty = gy + gh - 7;
    P.rect(tx - 3, ty, 7, 4, 0x8a8a90); P.hl(tx - 3, ty, 7, 0xc8c8d0);
    P.vl(tx, ty - 5, 5, 0x5a3a24);
    for (let y = -6; y <= 2; y++) for (let x = -5; x <= 5; x++) { const d = (x / 5.2) ** 2 + (y / 5) ** 2; if (d <= 1 && hash(tx + x, ty + y, 5) > 0.12) P.px(tx + x, ty - 8 + y, d < 0.4 && x < 1 ? 0x6ac050 : x > 1 ? 0x2a6a2a : 0x3f8a36); }
    if (night) K.glows.push([tx - 2, ty - 1, 5, 2, 0xffd890, 0.5]);
  }
  for (let x = L + 3; x < R - 3; x++) { P.px(x, gy + gh - 2, 0xd8ecf0, 0.7); P.px(x, gy + gh - 1, 0x8aa0a8); }       // glasräcket
  P.hl(L + 3, gy + gh - 4, R - L - 6, 0xe8f4f8, 0.5);
  P.darken(L + 3, gy + 2, R - L - 6, 2, 0.7);
  if (night) K.glows.push([L + 3, gy + 2, R - L - 6, gh - 4, 0xffd8a0, 0.12]);
  // ---- sockeln: LED-skärmen, namnet, lobbyn ----
  travertine(P, L, shaftB, b.w, 44, 0xeae8e2, 63);
  P.hl(L, shaftB, b.w, 0xffffff); P.darken(L, shaftB + 1, b.w, 1, 0.8);
  K.ledges.push([L, shaftB - 1, b.w, 1]);
  const scX = L + 20, scY = shaftB + 5, scW = b.w - 40, scH = 24;
  P.rect(scX - 3, scY - 3, scW + 6, scH + 6, 0x14161c); P.box(scX - 3, scY - 3, scW + 6, scH + 6, 0xa8b0bc); P.hl(scX - 3, scY - 3, scW + 6, 0xf0f4f8);
  P.rect(scX, scY, scW, scH, 0x06080c);
  P.darken(scX - 2, scY + scH + 3, scW + 4, 2, 0.75);
  const name = 'GLASTORNET', nY = scY + scH + 6, nx = centerX(BIG, name, cx);
  signText(P, BIG, name, nx, nY, 0x2a6a74, { shadow: 0xb8c0c0, hi: 0x4a9aa4, lo: 0x1a4a54 });
  K.texts.push([...textGlow(BIG, name, 1, 0x5ae8e0, K.wx(nx), K.wy(nY), false), 0.95]);
  const panes = lobbyFloor(K, shaftB + 44, { stone: 0xeae8e2, stoneFn: (Q, x, y, w, h) => travertine(Q, x, y, w, h, 0xeae8e2, 63), wall: 0xe4eeec, planters: false });
  // cykelställ-fri lobby: två stora krukor med oliver vid pelarna
  for (const px of [K.dx0 - 13, K.dx1 + 7]) {
    P.rect(px, baseY - 8, 6, 7, 0x3a3c42); P.hl(px, baseY - 8, 6, 0x8a8e96);
    for (let y = -5; y <= 1; y++) for (let x = -4; x <= 4; x++) if ((x / 4.4) ** 2 + (y / 4) ** 2 <= 1 && hash(px + x, y, 3) > 0.15) P.px(px + 3 + x, baseY - 13 + y, x < 0 ? 0x8aa060 : 0x5a7040);
  }
  return finish(K, { lobby: lobbyOf(K, panes, { n: 2 }), doorKit: { steel: 0xc8d0d8, wall0: 0xe8f2f0, wall1: 0xb0c4c4, floor: 0x5a6a6c }, bigScreen: [K.wx(scX), K.wy(scY), scW, scH] });
}
// Glastornets skärm: börsindex (live-kurva) → Pixelbankens reklam → börslistan → bion
let GT_ADS = null;
function gtAds(w, h) {
  if (GT_ADS && GT_ADS.w === w) return GT_ADS.list;
  const mk = (bg0, bg1, paint) => { const P = new Pix(w, h); vgrad(P, 0, 0, w, h, bg0, bg1, 4); paint(P); for (let j = 3; j < h; j += 4) P.darken(0, j, w, 1, 0.88); return P.flush(); };
  const list = [
    mk(0x1e5a3a, 0x0a2a1a, (P) => {
      const hx = 12, hy = 6;
      [[3, 1], [5, 2], [7, 2], [9, 2], [9, 2]].reduce((y, [w2, h2], r) => { for (let j = 0; j < h2; j++) P.hl(hx - (w2 >> 1), y + j, w2, r % 2 ? 0xe8c050 : 0xc8a030); return y + h2; }, hy);
      P.rect(hx - 1, hy + 6, 3, 3, 0x0a2a1a);
      text(P, BIG, 'PIXELBANKEN', 24, 5, 0xffe8a0); text(P, SMALL, 'SPARA SMART', 24, 15, WHITE);
    }),
    mk(0x3a0a2a, 0x10060e, (P) => {
      text(P, BIG, 'BIO PIXEL', 6, 5, 0xffd23f); text(P, SMALL, 'KVÄLLENS FILM 19:00', 6, 15, WHITE);
      // filmremsan bara bredvid rubriken – textraden under (74 px) räcker nästan ut till kanten
      for (let k = 0; k < 5; k++) P.rect(w - 20 + k * 3, 3, 2, 10, k % 2 ? 0x1a1a1a : 0xe8e8e8);
    }),
  ];
  GT_ADS = { w, list };
  return list;
}
function drawGtScreen(ctx, m, st) {
  const [x, y, w, h] = m.bigScreen, t = st.t || 0, per = 6, slot = Math.floor(t / per) % 4;
  if (slot === 0 || slot === 2) {
    ctx.fillStyle = '#06080c'; ctx.fillRect(x, y, w, h);
    if (slot === 0) {
      // PIX30: indexvärdet och dagens kurva
      const items = quotesFor(st.env?.day || 1), avg = items.reduce((s, it) => s + it.ch, 0) / items.length;
      const val = 1000 + Math.round(hash(st.env?.day || 1, 3, 9) * 800) + Math.round(avg * 12);
      ctxTxt(ctx, BIG, 'PIX30', x + 3, y + 3, '#ffd070');
      ctxTxt(ctx, BIG, String(val), x + 3, y + 13, '#e8ecf0');
      const up = avg >= 0, c = up ? '#50f080' : '#ff5050';
      ctxTxt(ctx, SMALL, `${up ? '+' : ''}${fmt(avg)}%`, x + 31, y + 15, c);
      ctx.fillStyle = c;
      for (let k = 0; k < 3; k++) ctx.fillRect(x + 34 + 1 - k, up ? y + 5 + k : y + 7 - k, k * 2 + 1, 1);
      drawIndexChart(ctx, x + 56, y + 2, w - 58, h - 4, st);
    } else {
      // kurslistan: tre rader som rullar
      const items = quotesFor(st.env?.day || 1), i0 = Math.floor(t / 1.2) % items.length;
      for (let r = 0; r < 3; r++) {
        const it = items[(i0 + r) % items.length], yy = y + 2 + r * 7, c = it.ch >= 0 ? '#50f080' : '#ff5050';
        ctxTxt(ctx, SMALL, it.s, x + 3, yy, '#ffd070');
        ctxTxt(ctx, SMALL, fmt(it.px), x + 26, yy, '#e8ecf0');
        ctxTxt(ctx, SMALL, `${it.ch >= 0 ? '+' : ''}${fmt(it.ch)}%`, x + 52, yy, c);
      }
    }
  } else ctx.drawImage(gtAds(w, h)[slot === 1 ? 0 : 1], x, y);
}
// Fönsterputsarna: en korg som hänger i två vajrar från krönet, åker sakta upp och ner längs
// glasfasaden och flyttar till en ny fönsterrad varje varv (bara dagtid, inte i snöväder).
function drawGondola(ctx, g, st) {
  const h = st.hour ?? 12, w = st.env?.weather;
  if (h < 8 || h >= 16.5 || (w && (w.kind === 'snö' || w.kind === 'regn') && (w.intensity ?? 1) > 0.3)) return;
  const [xMin, xMax, yTop, yMin, yMax] = g, t = st.t || 0, per = 140;
  const lap = Math.floor(t / per), ph = (t % per) / per;
  const x = Math.round(xMin + hash(lap, 3, 77) * (xMax - xMin));
  const gy = Math.round(yMin + (yMax - yMin) * (0.5 - 0.5 * Math.cos(ph * Math.PI * 2)));
  ctx.fillStyle = 'rgba(10,14,24,0.22)'; ctx.fillRect(x + 2, gy + 2, 15, 2);                      // korgens skugga på glaset
  ctx.fillStyle = '#2a2e36'; ctx.fillRect(x + 1, yTop, 1, gy - 4 - yTop); ctx.fillRect(x + 13, yTop, 1, gy - 4 - yTop);   // vajrarna
  // putsarna (hjälm, ansikte, orange overall) med skrapan som går fram och tillbaka
  const sw = Math.round(Math.sin(t * 2.6) * 2);
  for (const [px, ph2] of [[x + 4, 0], [x + 9, 1.7]]) {
    const up = Math.round(Math.sin(t * 2.6 + ph2) * 1.5);
    ctx.fillStyle = '#f4f4f4'; ctx.fillRect(px, gy - 9, 2, 1);
    ctx.fillStyle = '#e0a97f'; ctx.fillRect(px, gy - 8, 2, 1);
    ctx.fillStyle = '#f08a24'; ctx.fillRect(px, gy - 7, 2, 4); ctx.fillStyle = '#c86a14'; ctx.fillRect(px + 1, gy - 7, 1, 4);
    ctx.fillStyle = '#f08a24'; ctx.fillRect(px + 2, gy - 9 + up, 1, 3);                          // armen
    ctx.fillStyle = '#3a3e46'; ctx.fillRect(px + 2 + (ph2 ? -sw : sw), gy - 10 + up, 3, 1);     // skrapan
  }
  ctx.fillStyle = '#c89a20'; ctx.fillRect(x, gy - 4, 1, 4); ctx.fillRect(x + 14, gy - 4, 1, 4);
  ctx.fillStyle = '#e8b830'; ctx.fillRect(x, gy - 4, 15, 1);                                     // räcket
  ctx.fillStyle = '#d8dce2'; ctx.fillRect(x, gy - 2, 15, 3);
  ctx.fillStyle = '#f4f6f8'; ctx.fillRect(x, gy - 2, 15, 1);
  ctx.fillStyle = '#6a6e76'; ctx.fillRect(x, gy + 1, 15, 1);
  ctx.fillStyle = '#e8b830'; ctx.fillRect(x + 3, gy - 1, 9, 1);                                  // gula varningsranden
  // blött glas under skrapan: några blanka pixlar som rinner
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  for (let i = 0; i < 4; i++) ctx.fillRect(x + 3 + i * 3, gy + 3 + ((Math.floor(t * 3) + i * 2) % 5), 1, 1);
}
function liveTower(ctx, b, st) {
  const m = metaOf(b, st.night, st);
  if (!m) return;
  boostLit(ctx, b, st, m);                                                        // lobbyn lyser
  lobbyFolk(ctx, b, st, m);
  boost(ctx, st, () => lobbyFolk(ctx, b, st, m));
  const kit = kitFor(b, st, m);
  drawRevolve(ctx, b, st, kit, (x0, top) => boost(ctx, st, () => ctx.drawImage(kit.inside, x0, top)));   // lobbyn bakom trumman lyser
  if (m.bigScreen) drawGtScreen(ctx, m, st);
  if (m.gondola) drawGondola(ctx, m.gondola, st);
  liveCommon(ctx, b, st, m);
}
function glowTower(ctx, b, st) {
  glowBase(ctx, b, st, (c, m, k) => {
    if (m.bigScreen) { frontClip(c, b, st, m); c.globalCompositeOperation = 'source-over'; c.globalAlpha = k; drawGtScreen(c, m, st); c.restore(); }
    const x0 = b.door.x0, dw = b.door.x1 - b.door.x0, base = baseOf(b);
    for (let r = 0; r < 10; r++) { const sp = Math.round(r * 0.6); c.fillStyle = rgba(0xffe0a0, 0.16 * k * (1 - r / 10)); c.fillRect(x0 - sp, base + r, dw + sp * 2, 1); }
  });
}

// =====================================================================
// BUTIKERNA I SÖDRA RADEN – gemensamma penslar
// =====================================================================
const CURTAINS = [0xd8544a, 0xe8d8a8, 0x6a8ac8, 0xf0ece0, 0x8ac07a, 0xd89ac0, 0xe0b040];
const FLOWERS = [0xe83a4a, 0xf05a8a, 0xf8d040, 0xffffff, 0xb05ae0];
// puts med lätt struktur
function plaster(P, x, y, w, h, c, seed = 71) {
  area(P, x, y, w, h, (X, Y) => { const n = hash(X >> 1, Y >> 1, seed); return jit(n > 0.93 ? mul(c, 0.95) : n < 0.05 ? mix(c, WHITE, 0.08) : c, X, Y, seed, 0.045); });
}
// takfotslist med tandsnitt och skugga under
function corniceBand(P, K, x, y, w, c) {
  P.rect(x - 2, y, w + 4, 5, c);
  P.hl(x - 2, y, w + 4, mix(c, WHITE, 0.5)); P.hl(x - 2, y + 1, w + 4, mix(c, WHITE, 0.2));
  for (let i = x - 2; i < x + w + 2; i++) P.px(i, y + 3, (i & 1) ? mul(c, 0.7) : c);
  P.hl(x - 2, y + 4, w + 4, mul(c, 0.66));
  P.darken(x, y + 5, w, 2, 0.8);
  K.ledges.push([x - 2, y - 1, w + 4, 2]);
}
// bostadsfönster på övervåningarna: karm, spröjs, gardiner, bänk eller blomlåda; tänds som 'home'
function upperWindow(K, x, y, w, h, o = {}) {
  const P = K.P, night = K.night, fr = o.frame ?? 0xf0ece4, seed = o.seed ?? 0;
  P.rect(x - 1, y - 1, w + 2, h + 2, mul(fr, 0.45));
  for (let j = 0; j < h - 2; j++) for (let i = 0; i < w - 2; i++) {
    const X = x + 1 + i, Y = y + 1 + j;
    P.px(X, Y, night ? mix(0x28324a, 0x141a2a, q(j / h, X, Y, 3)) : glassDay(X + K.box.x, Y + K.box.y, 0.25 + j / (h * 3), j / h, [0xb8d4ea, 0x5a7a9a, 0x3a4a60], 5 + seed, { skyline: false }));
  }
  const cc = CURTAINS[(seed * 3 + 1) % CURTAINS.length];
  for (let j = 1; j < h - 1; j++) { P.px(x + 1, y + j, night ? mul(cc, 0.5) : cc); P.px(x + w - 2, y + j, night ? mul(cc, 0.4) : mul(cc, 0.85)); if (j < h * 0.5) { P.px(x + 2, y + j, night ? mul(cc, 0.45) : mul(cc, 0.9)); P.px(x + w - 3, y + j, night ? mul(cc, 0.4) : mul(cc, 0.8)); } }
  P.box(x, y, w, h, fr); P.hl(x, y, w, mix(fr, WHITE, 0.5)); P.vl(x + w - 1, y + 1, h - 1, mul(fr, 0.72));
  const mx = x + (w >> 1), ty = y + Math.round(h * 0.32);
  P.vl(mx, y + 1, h - 2, fr); P.hl(x + 1, ty, w - 2, fr);
  const half = (w - 3) >> 1, gid = 5000 + (o.gid ?? seed);
  K.offices.push([x + 1, y + 1, mx - x - 1, ty - y - 1, gid, false, 'home'], [mx + 1, y + 1, x + w - 2 - mx, ty - y - 1, gid, false, 'home'],
    [x + 1, ty + 1, mx - x - 1, y + h - 2 - ty, gid, false, 'home'], [mx + 1, ty + 1, x + w - 2 - mx, y + h - 2 - ty, gid, false, 'home']);
  if (o.flowers) {
    const by = y + h + 1;
    for (let i = 0; i < w + 4; i++) {
      const hg = 2 + Math.floor(hash(x + i, seed, 41) * 3);
      for (let j = 1; j <= hg; j++) P.px(x - 2 + i, by - j, (i + j) % 3 ? 0x3f7a34 : 0x5a9a3e);
      if (hash(x + i, seed, 42) > 0.5) P.px(x - 2 + i, by - hg, FLOWERS[Math.floor(hash(x + i, seed, 43) * FLOWERS.length)]);
    }
    P.rect(x - 2, by, w + 4, 3, 0x8a5a36); P.hl(x - 2, by, w + 4, 0xb07a4a); P.hl(x - 2, by + 2, w + 4, 0x5a3a24);
    P.darken(x - 1, by + 3, w + 2, 2, 0.75);
    K.ledges.push([x - 2, by - 3, w + 4, 1]);
  } else if (o.juliet) {
    const by = y + h - 7;
    P.hl(x - 2, by, w + 4, 0x1a1a1e); P.hl(x - 2, y + h, w + 4, 0x1a1a1e);
    for (let i = x - 2; i < x + w + 2; i += 2) P.vl(i, by + 1, h - (by - y) - 1, 0x2a2a30);
    for (let i = x; i < x + w; i += 4) { P.px(i, by + 2, 0x1a1a1e); P.px(i + 1, by + 3, 0x1a1a1e); P.px(i, by + 4, 0x1a1a1e); }
    K.ledges.push([x - 2, by - 1, w + 4, 1]);
  } else {
    P.hl(x - 2, y + h + 1, w + 4, mix(o.sill ?? 0xe8e0d0, WHITE, 0.3)); P.hl(x - 2, y + h + 2, w + 4, mul(o.sill ?? 0xe8e0d0, 0.7));
    P.darken(x - 1, y + h + 3, w + 2, 1, 0.72);
    K.ledges.push([x - 2, y + h, w + 4, 1]);
  }
}
// markis (ränder, tandad kant) över ett skyltfönster
function awning(P, K, x, y, w, h, c1, c2, o = {}) {
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const st = Math.floor(i / (o.stripe ?? 4)) & 1;
    let c = st ? c1 : c2;
    if (j === 0) c = mix(c, WHITE, 0.25); else if (j === h - 1) c = mul(c, 0.75); else if (j >= h - 3) c = mul(c, 0.9);
    P.px(x + i, y + j, c);
  }
  for (let i = 0; i < w; i += 4) { P.px(x + i + 1, y + h, st2(i) ? c1 : c2); P.px(x + i + 2, y + h, st2(i) ? mul(c1, 0.8) : mul(c2, 0.8)); }
  function st2(i) { return Math.floor(i / (o.stripe ?? 4)) & 1; }
  P.darken(x, y + h + 1, w, 2, 0.72);
  K.ledges.push([x, y - 1, w, 2]);
}
// skyltfönster: ram + bakgrund + innehåll (callback) + glasglans; läggs i glows som skyltljus
function showWindow(K, x, y, w, h, o) {
  const P = K.P, night = K.night;
  P.rect(x - 2, y - 2, w + 4, h + 4, o.frame); P.hl(x - 2, y - 2, w + 4, mix(o.frame, WHITE, 0.3)); P.hl(x - 2, y + h + 1, w + 4, mul(o.frame, 0.6));
  if (o.pin !== undefined) P.box(x - 1, y - 1, w + 2, h + 2, o.pin);
  vgrad(P, x, y, w, h, night ? mix(o.back[0], 0xffe0a0, 0.25) : o.back[0], night ? mix(o.back[1], 0xd8a060, 0.25) : o.back[1], 3);
  for (let i = x + 3; i < x + w - 2; i += 7) { P.px(i, y, 0xfff4d0); P.px(i, y + 1, 0xfff0c0, 0.6); }               // spotlights
  o.paint(P, x, y, w, h);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const d = ((x + i + (y + j) * 2) % 27 + 27) % 27; if (d < 2) P.px(x + i, y + j, WHITE, night ? 0.08 : 0.28); else if (d === 3) P.px(x + i, y + j, WHITE, night ? 0.03 : 0.1); }
  P.vl(x + (o.mid ?? -1), y, h, o.frame, o.mid !== undefined ? 1 : 0);
  K.lit.push([x, y, w, h, 0.2]);
  K.glows.push([x, K.baseY, w, 4, 0xffe8c0, 0.1]);
}
// en enkel butiksdörr (slagdörr) med glas, handtag och skylt.
// open = butiken har öppet: vändskylten visar ÖPPET. Stängt: rullgardinen är nere bakom glaset och
// skylten är vänd – öppettiderna i rött ("10-19"; STÄNGT får inte plats på ett 24 px dörrblad).
function shopDoorKit(b, night, o, open = true) {
  const w = b.door.x1 - b.door.x0, h = o.h ?? 28;
  return swingKit(w, h, (I) => { paintInside(I, w, h, o.inside(night)); o.insideExtra?.(I, w, h); if (night) I.darken(0, 0, w, h, NIGHT_WIN); }, (P, lw, hh) => {
    const c = o.col;
    vgrad(P, 0, 0, lw, hh, mix(c, WHITE, 0.14), mul(c, 0.78), 3);
    P.box(0, 0, lw, hh, mul(c, 0.4)); P.vl(1, 1, hh - 2, mix(c, WHITE, 0.3));
    const gw = lw - 6, gh = hh - 12;
    if (open) {
      P.rect(3, 3, gw, gh, 0x9ac0d8); P.hl(3, 3, gw, 0xd8ecf8);
      for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) if (((i + j * 2) % 11) < 2) P.px(3 + i, 3 + j, WHITE, 0.4);
    } else {
      // rullgardinen: tygvåder i butikens färg med veck var tredje rad, list och dragring längst ner
      const cl = mix(c, 0xe8e0d0, 0.55);
      for (let j = 0; j < gh; j++) P.hl(3, 3 + j, gw, j % 3 === 2 ? mul(cl, 0.86) : j % 3 === 0 ? mix(cl, WHITE, 0.12) : cl);
      P.hl(3, 3, gw, mul(cl, 0.7));
      P.hl(3, 2 + gh, gw, mul(c, 0.7)); P.px(3 + (gw >> 1), 1 + gh, mul(c, 0.5));
      for (let j = 0; j < gh; j++) if ((j % 7) < 2) P.px(3 + gw - 2 - (j >> 2), 3 + j, WHITE, 0.25);   // glaset blänker ändå
    }
    P.box(2, 2, lw - 4, hh - 10, o.trim ?? mul(c, 0.6));
    P.bevel(3, hh - 7, lw - 6, 5, mix(c, WHITE, 0.2), mul(c, 0.55));
    P.rect(lw - 4, (hh >> 1) - 1, 2, 5, o.handle ?? 0xe8c060);
    const sign = open ? o.sign : (b.open ? `${b.open[0]}-${b.open[1] % 24}` : '');
    if (sign) {
      const sw = textW(SMALL, sign) + 4, sx = (lw - sw) >> 1;
      P.vl(sx + 2, 4, 2, 0x2a2a30); P.vl(sx + sw - 3, 4, 2, 0x2a2a30);
      P.rect(sx, 6, sw, 8, 0xf4f1ea); P.box(sx, 6, sw, 8, 0x2a2a30);
      text(P, SMALL, sign, sx + 2, 7, open ? (o.signCol ?? 0x2a7a3a) : 0xc8282a);
    }
  }, false);
}
// liten skosilhuett (skyltfönstren) – u = ovandel, s = sula, l = detalj, h = klack
const SHOES = {
  sneaker: ['..uu.', 'uuulu', 'sssss'],
  boot: ['uu..', 'uu..', 'uuul', 'ssss'],
  pump: ['u....', 'uuuuu', 'h..ss'],
  loafer: ['.uuu.', 'uuluu', 'sssss'],
};
function shoe(P, x, y, kind, c, sole = 0xf4f4f4) {
  const rows = SHOES[kind];
  rows.forEach((row, j) => { for (let i = 0; i < row.length; i++) {
    const ch = row[i];
    if (ch === '.') continue;
    P.px(x + i, y + j, ch === 'u' ? (j === 0 ? mix(c, WHITE, 0.25) : c) : ch === 's' ? sole : ch === 'l' ? WHITE : mul(c, 0.6));
  } });
  P.hl(x, y + rows.length, rows[0].length, 0x000000, 0.18);
}

// =====================================================================
// SKOR – SKOBUTIKEN: ljus putsfasad, svart butiksfront med guldlist, hyllor med
// skor i fönstren och en stor röd sneaker som takskylt.
// =====================================================================
function paintSkor(b, night, opts) {
  const K = begin(b, night, opts), P = K.P, { L, R, baseY } = K, top = K.ftop;
  const WALL = 0xf0e8da, BLACK = 0x1c1c20, GOLD = 0xd8b060, dx0 = K.dx0, dx1 = K.dx1;
  // ---- taket: grus, takfönster, aggregat, jättesneakern ----
  roofFelt(P, L, 42, b.w, top - 46, 0x7a7872, 31);
  P.hl(L, 42, b.w, 0xb0aca4); P.hl(L, 43, b.w, 0x8a8680);
  P.vl(L, 42, top - 44, 0xa8a49c); P.vl(R - 1, 42, top - 44, 0x6a6660);
  snowRoof(K, L + 1, 44, b.w - 2, top - 50);
  for (const sx of [L + 6, L + 20]) {                                                    // takfönster
    P.rect(sx - 1, 47, 10, 8, 0x4a4a50);
    area(P, sx, 48, 8, 6, (X, Y, i, j) => (night ? 0x1c2438 : mix(0xc8e0f4, 0x5a7a9a, j / 6)));
    P.line(sx, 53, sx + 7, 48, WHITE, 0.35); P.hl(sx, 48, 8, WHITE, 0.4);
    K.ledges.push([sx - 1, 46, 10, 1]);
  }
  hvac(P, R - 22, 47, 14, 4, 5, { fans: 2 });
  ventPipe(P, R - 30, 50, 6);
  // jättesneakern på stålben (sidovy som skylt)
  const sx = L + 34, sy = top - 26;
  P.vl(sx + 10, sy + 18, top - 4 - (sy + 18), 0x5a5e66); P.vl(sx + 30, sy + 18, top - 4 - (sy + 18), 0x5a5e66);
  P.vl(sx + 11, sy + 18, top - 4 - (sy + 18), 0x3a3e46); P.vl(sx + 31, sy + 18, top - 4 - (sy + 18), 0x3a3e46);
  const topLine = (x) => (x <= 12 ? 2 : x <= 34 ? 3 + (x - 12) * 7 / 22 : 10 + (x - 34) * 4 / 6);
  const inShoe = (x, y) => x >= 0 && x <= 40 && y >= topLine(x) && y < 18 && !(x > 38 && y < 12 + (x - 38));
  for (let y = 0; y < 18; y++) for (let x = 0; x <= 40; x++) {
    if (!inShoe(x, y)) { if (inShoe(x - 1, y) || inShoe(x + 1, y) || inShoe(x, y - 1) || inShoe(x, y + 1)) P.px(sx + x, sy + y, 0x2a1414); continue; }
    let c;
    if (y >= 14) c = y === 14 ? 0xd8d8dc : y === 17 ? 0x3a3a40 : 0xf4f4f6;                  // sulan
    else if (x > 31 && y > 9) c = 0xf0f0f2;                                               // tåhättan
    else if (Math.abs(y - (12 - (x - 6) * 4 / 24)) < 1 && x > 5 && x < 31) c = WHITE;     // ränderna
    else { c = y < topLine(x) + 2 ? 0xf05a4a : x < 14 ? 0xc83030 : 0xd83a3a; }
    if (x <= 2 && y >= 3 && y <= 9) c = BLACK;                                           // hälfliken
    P.px(sx + x, sy + y, c);
  }
  for (let x = 14; x < 31; x += 3) { const y = Math.round(topLine(x)) + 1; P.px(sx + x, sy + y, WHITE); P.px(sx + x + 1, sy + y + 1, 0xe0e0e4); }  // snörningen
  K.glows.push([sx, sy + 2, 40, 12, 0xff8a70, 0.18]);
  K.ledges.push([sx + 3, sy + 1, 9, 1], [sx + 13, sy + 3, 20, 1]);
  // ---- fasaden ----
  plaster(P, L, top, b.w, baseY - top, WALL, 72);
  P.vl(L, top, baseY - top, mix(WALL, WHITE, 0.35)); P.vl(R - 1, top, baseY - top, mul(WALL, 0.7));
  corniceBand(P, K, L, top, b.w, 0xf8f4ec);
  // två våningar bostäder
  [0, 1].forEach((f) => [0, 1, 2].forEach((k) => upperWindow(K, L + 11 + k * 30, top + 10 + f * 26, 12, 17, { seed: f * 3 + k + 1, flowers: f === 0 && k !== 1, juliet: f === 1, gid: f * 3 + k })));
  P.hl(L, top + 55, b.w, mix(WALL, WHITE, 0.4)); P.hl(L, top + 56, b.w, mul(WALL, 0.8));
  // skyltbandet
  const sgY = top + 58;
  P.rect(L, sgY, b.w, 12, BLACK); P.hl(L, sgY, b.w, 0x4a4a52); P.hl(L, sgY + 1, b.w, GOLD); P.hl(L, sgY + 10, b.w, GOLD); P.hl(L, sgY + 11, b.w, 0x0a0a0c);
  const name = 'SKOBUTIKEN', nx = centerX(BIG, name, (L + R) / 2);
  signText(P, BIG, name, nx, sgY + 3, 0xf4f1ea, { shadow: 0x5a4a2a, hi: WHITE, lo: 0xd8d0c0 });
  K.texts.push([...textGlow(BIG, name, 1, 0xfff0d0, K.wx(nx), K.wy(sgY + 3)), 0.5]);
  shoe(P, L + 3, sgY + 4, 'sneaker', 0xd83a3a); shoe(P, R - 8, sgY + 4, 'pump', 0xd83a3a, 0x2a2a2a);
  // butiksfronten: svarta ramar med guldlist, markiser, fönster, dörr
  const fT = sgY + 12;
  area(P, L, fT, b.w, baseY - fT, (X, Y) => jit(BLACK, X, Y, 73, 0.06));
  P.vl(L, fT, baseY - fT, 0x4a4a52);
  const winY = fT + 7, winH = baseY - 5 - winY;
  const wins = [[L + 4, dx0 - 4 - (L + 4)], [dx1 + 4, R - 4 - (dx1 + 4)]];
  for (const [x, w] of wins) {
    awning(P, K, x - 2, fT, w + 4, 5, BLACK, 0xf4f1ea, { stripe: 3 });
    showWindow(K, x, winY, w, winH, { frame: BLACK, pin: GOLD, back: [0xf8f0e4, 0xe0d4c0], paint: (Q, wx0, wy0, ww, wh) => {
      // tre glashyllor med skor
      for (let r = 0; r < 3; r++) {
        const hy = wy0 + 5 + r * 6;
        Q.hl(wx0 + 1, hy, ww - 2, 0xc8e0e8); Q.hl(wx0 + 1, hy + 1, ww - 2, 0x9ab0b8);
        for (let k = 0; k < Math.floor((ww - 2) / 7); k++) {
          const kinds = ['sneaker', 'boot', 'pump', 'loafer'], kind = kinds[(k + r * 2 + wx0) % 4];
          const col = [0xd83a3a, 0x3a6ad8, 0x6a4028, 0x2a2a2e, 0xf0f0f0, 0x3aa85a, 0xe8b830][(k * 3 + r + wx0) % 7];
          shoe(Q, wx0 + 2 + k * 7, hy - SHOES[kind].length, kind, col, kind === 'pump' ? 0x2a2a2a : kind === 'boot' ? 0x3a2a1a : 0xf4f4f4);
          if ((k + r) % 3 === 0) { Q.rect(wx0 + 3 + k * 7, hy + 2, 3, 2, WHITE); Q.px(wx0 + 4 + k * 7, hy + 2, 0xd83a3a); }   // prislapp
        }
      }
    } });
  }
  P.rect(dx0 - 3, fT, dx1 - dx0 + 6, baseY - fT, 0x2a2a30); P.box(dx0 - 3, fT, dx1 - dx0 + 6, baseY - fT + 1, GOLD);
  granite(P, L, baseY - 4, b.w, 4, 0x3a3a40, 74); P.hl(L, baseY - 4, b.w, 0x6a6a72);
  P.rect(dx0 - 2, baseY, dx1 - dx0 + 4, 2, 0x8a8680); P.hl(dx0 - 2, baseY, dx1 - dx0 + 4, 0xc8c4bc);
  footShadow(K, L, dx0 - 2 - L); footShadow(K, dx1 + 2, R - dx1 - 2);
  return finish(K, { doorTop: K.wy(baseY - 28) });
}

// =====================================================================
// FRISOR – FRISÖR: mintgrön puts, marinblå front, skylt med sax och kam, randig
// markis, en barberarstolpe som snurrar, frisyrbilder och en frisörstol i fönstret,
// handdukar på tork uppe på taket.
// =====================================================================
function paintFrisor(b, night, opts) {
  const K = begin(b, night, opts), P = K.P, { L, R, baseY } = K, top = K.ftop;
  const WALL = 0xd4eadc, NAVY = 0x1c2a4a, RED = 0xc9323a, BLUE = 0x2a5ab0, dx0 = K.dx0, dx1 = K.dx1;
  // ---- taket: takpapp, skorsten, takfönster, handdukar på tork ----
  roofFelt(P, L, 42, b.w, top - 46, 0x55565c, 33);
  P.hl(L, 42, b.w, 0x8a8a90); P.hl(L, 43, b.w, 0x6a6a70);
  P.vl(L, 42, top - 44, 0x7a7a80);
  snowRoof(K, L + 1, 44, b.w - 2, top - 50);
  // skorstenen (tegel) med plåthuv
  const chx = R - 16, chT = 50;
  P.darken(chx + 7, chT + 4, 3, 16, 0.7);
  area(P, chx, chT + 2, 7, 18, (X, Y, i, j) => { let k = jit(0x9a4a38, X, Y, 44, 0.1); if ((j % 3) === 2) k = mul(k, 0.7); if (i === 0) k = mix(k, WHITE, 0.2); if (i === 6) k = mul(k, 0.7); return k; });
  P.rect(chx - 1, chT, 9, 2, 0xa8a8b0); P.hl(chx - 1, chT, 9, 0xd8d8e0); P.hl(chx - 1, chT + 1, 9, 0x6a6a72);
  K.ledges.push([chx - 1, chT - 1, 9, 1]);
  K.smoke = [K.wx(chx + 3), K.wy(chT - 1)];
  P.rect(L + 5, 48, 9, 7, 0x3a3a40); area(P, L + 6, 49, 7, 5, (X, Y, i, j) => (night ? 0x1c2438 : mix(0xc8e0f4, 0x5a7a9a, j / 5))); P.hl(L + 6, 49, 7, WHITE, 0.4);
  // torklinan med handdukar (vit, röd-randig, blå)
  const ly = top - 22;
  P.vl(L + 16, ly, 20, 0x6a6e76); P.vl(L + 44, ly, 20, 0x6a6e76);
  P.line(L + 16, ly, L + 44, ly + 1, 0xd8d8dc);
  [[L + 19, WHITE], [L + 26, RED], [L + 33, BLUE], [L + 39, WHITE]].forEach(([x, c], i) => {
    for (let j = 0; j < 7; j++) for (let k = 0; k < 5; k++) P.px(x + k, ly + 1 + j, (c === WHITE && i === 3 && j % 3 === 1) ? RED : j === 6 ? mul(c, 0.8) : k === 4 ? mul(c, 0.86) : c);
  });
  K.towels = [K.wx(L + 19), K.wy(ly + 1)];
  // ---- fasaden ----
  plaster(P, L, top, b.w, baseY - top, WALL, 74);
  P.vl(L, top, baseY - top, mul(WALL, 0.85));                                            // grannväggen (skobutiken) skuggar lite
  P.vl(R - 1, top, baseY - top, mul(WALL, 0.7));
  corniceBand(P, K, L, top, b.w, 0xf4f4ee);
  [0, 1].forEach((f) => [0, 1].forEach((k) => upperWindow(K, L + 12 + k * 34, top + 8 + f * 21, 12, 14, { seed: 11 + f * 2 + k, flowers: f === 0, gid: 20 + f * 2 + k, frame: 0xf8f8f4 })));
  P.hl(L, top + 45, b.w, mix(WALL, WHITE, 0.4)); P.hl(L, top + 46, b.w, mul(WALL, 0.8));
  // skyltbandet: sax, FRISÖR, kam
  const sgY = top + 47;
  P.rect(L, sgY, b.w, 11, NAVY); P.hl(L, sgY, b.w, 0x3a4a6a); P.hl(L, sgY + 1, b.w, 0xd8b060); P.hl(L, sgY + 9, b.w, 0xd8b060); P.hl(L, sgY + 10, b.w, 0x0a0e18);
  const name = 'FRISÖR', nx = centerX(BIG, name, (L + R) / 2);
  signText(P, BIG, name, nx, sgY + 3, WHITE, { shadow: 0xd8b060, lo: 0xe0e4f0 });
  K.texts.push([...textGlow(BIG, name, 1, 0xe8f0ff, K.wx(nx), K.wy(sgY + 3)), 0.55]);
  // sax (vänster)
  const scx = L + 5, scy = sgY + 2;
  P.px(scx, scy, 0xe8ecf0); P.px(scx + 1, scy + 1, 0xe8ecf0); P.px(scx + 2, scy + 2, 0xe8ecf0); P.px(scx + 4, scy, 0xe8ecf0); P.px(scx + 3, scy + 1, 0xe8ecf0);
  P.px(scx + 1, scy + 4, RED); P.px(scx + 3, scy + 4, RED); P.px(scx, scy + 5, RED); P.px(scx + 4, scy + 5, RED); P.px(scx + 1, scy + 6, RED); P.px(scx + 3, scy + 6, RED); P.px(scx + 2, scy + 3, 0x9aa0a8);
  // kam (höger)
  const kx = R - 11; P.hl(kx, sgY + 3, 7, 0xe8ecf0); for (let i = 0; i < 7; i += 1) if (i % 2 === 0) P.vl(kx + i, sgY + 4, 3, 0xc8ccd4);
  // markisen i barberarfärger
  const fT = sgY + 11;
  area(P, L, fT, b.w, baseY - fT, (X, Y) => jit(NAVY, X, Y, 75, 0.06));
  for (let j = 0; j < 5; j++) for (let i = 0; i < b.w + 4; i++) {
    const st = Math.floor((i + j) / 3) % 3, c0 = [RED, WHITE, BLUE][st];
    P.px(L - 2 + i, fT + j, j === 0 ? mix(c0, WHITE, 0.25) : j === 4 ? mul(c0, 0.75) : c0);
  }
  for (let i = 0; i < b.w + 4; i += 3) P.px(L - 1 + i, fT + 5, [RED, WHITE, BLUE][Math.floor(i / 3) % 3]);
  P.darken(L, fT + 6, b.w, 2, 0.72);
  K.ledges.push([L - 2, fT - 1, b.w + 4, 2]);
  const winY = fT + 7, winH = baseY - 5 - winY;
  // vänster fönster: frisörstolen framför spegeln, flaskor på hyllan
  showWindow(K, L + 3, winY, dx0 - 10 - (L + 3), winH, { frame: NAVY, pin: 0xd8b060, back: [0xe8f0ec, 0xc8d8d0], paint: (Q, x, y, w, h) => {
    Q.rect(x + 2, y + 2, w - 4, 10, 0xd8e8f0); Q.box(x + 1, y + 1, w - 2, 12, 0xe8c060);                  // spegeln
    Q.line(x + 2, y + 9, x + 5, y + 3, WHITE, 0.6); Q.line(x + 5, y + 9, x + 8, y + 3, WHITE, 0.4);
    Q.hl(x + 1, y + 14, w - 2, 0x8a6a4a);
    for (let i = 0; i < w - 3; i += 3) Q.rect(x + 2 + i, y + 12 - 3, 2, 3, [0x3aa85a, 0xe8b830, 0x8a3ac9, 0x3a8ad8][i % 4]);          // flaskor
    const cx = x + (w >> 1);
    Q.rect(cx - 4, y + h - 10, 9, 4, RED); Q.hl(cx - 4, y + h - 10, 9, 0xe85a5a); Q.rect(cx - 3, y + h - 14, 7, 4, RED); Q.hl(cx - 3, y + h - 14, 7, 0xe85a5a);   // stolen
    Q.vl(cx - 5, y + h - 11, 4, 0xc8ccd4); Q.vl(cx + 5, y + h - 11, 4, 0xc8ccd4);
    Q.vl(cx, y + h - 6, 4, 0xc8ccd4); Q.hl(cx - 3, y + h - 2, 7, 0x9aa0a8);
  } });
  // höger fönster: frisyrbilderna
  showWindow(K, dx1 + 3, winY, R - 3 - (dx1 + 3), winH, { frame: NAVY, pin: 0xd8b060, back: [0xf4f0ec, 0xdcd4cc], paint: (Q, x, y, w, h) => {
    const styles = [[0x3b2619, 'lång'], [0xd9a95c, 'page'], [0xb7392b, 'lockar'], [0x1d1714, 'kort']];
    for (let k = 0; k < 4; k++) {
      const px = x + 1 + (k & 1) * ((w >> 1)), py = y + 2 + (k >> 1) * 10, pw = (w >> 1) - 2, [hc, st] = styles[k];
      Q.rect(px, py, pw, 9, 0xfaf6f0); Q.box(px, py, pw, 9, 0xb8b0a8);
      const fx = px + (pw >> 1);
      Q.rect(fx - 2, py + 3, 4, 4, 0xeec3a0); Q.px(fx - 1, py + 4, 0x2a1a1a); Q.px(fx + 1, py + 4, 0x2a1a1a);    // ansiktet
      if (st === 'lång') { Q.hl(fx - 2, py + 2, 4, hc); Q.vl(fx - 3, py + 2, 6, hc); Q.vl(fx + 2, py + 2, 6, hc); }
      else if (st === 'page') { Q.hl(fx - 3, py + 2, 6, hc); Q.px(fx - 3, py + 3, hc); Q.px(fx + 2, py + 3, hc); Q.px(fx - 3, py + 4, hc); Q.px(fx + 2, py + 4, hc); }
      else if (st === 'lockar') { for (let i = -3; i <= 2; i++) { Q.px(fx + i, py + 1 + (i & 1), hc); Q.px(fx + i, py + 2, hc); } Q.px(fx - 3, py + 4, hc); Q.px(fx + 2, py + 4, hc); Q.px(fx - 3, py + 6, hc); Q.px(fx + 2, py + 6, hc); }
      else { Q.hl(fx - 2, py + 2, 4, hc); Q.px(fx + 1, py + 1, hc); }
      Q.hl(fx - 2, py + 7, 4, [RED, BLUE, 0x3aa85a, 0x8a3ac9][k]);
    }
  } });
  // barberarstolpen mellan fönstret och dörren: förkromade huvar, guldknopp, glascylinder
  // (spiralen snurrar i live), fäste i väggen
  const px = dx0 - 7, CH = 0xc8ccd4;
  P.px(px + 2, winY - 7, 0xf0d070); P.px(px + 2, winY - 6, 0xb08a30);                     // guldknoppen
  P.hl(px + 1, winY - 5, 3, 0xf4f6f8); P.hl(px, winY - 4, 5, CH); P.px(px, winY - 4, 0xffffff); P.hl(px, winY - 3, 5, 0x8a9098);
  P.hl(px, winY + 20, 5, CH); P.px(px, winY + 20, 0xffffff); P.hl(px, winY + 21, 5, 0x8a9098); P.hl(px + 1, winY + 22, 3, 0x5a5e66);
  P.px(px + 2, winY + 23, 0x3a3e46);
  P.rect(px, winY - 2, 5, 22, WHITE);
  K.pole = [K.wx(px), K.wy(winY - 2), 5, 22];
  K.glows.push([px, winY - 2, 5, 22, 0xffffff, 0.12]);
  granite(P, L, baseY - 4, b.w, 4, 0x3a3e48, 76); P.hl(L, baseY - 4, b.w, 0x6a6e78);
  P.rect(dx0 - 2, baseY, dx1 - dx0 + 4, 2, 0x8a8680); P.hl(dx0 - 2, baseY, dx1 - dx0 + 4, 0xc8c4bc);
  footShadow(K, L, dx0 - 2 - L); footShadow(K, dx1 + 2, R - dx1 - 2);
  return finish(K, { doorTop: K.wy(baseY - 28), pole: K.pole, smoke: K.smoke });
}

// =====================================================================
// ACCESSOARER: mansardtak i zink med takkupor, kalkstensfasad med franska balkonger,
// auberginefärgad butiksfront med guldlister, montrar med väskor, hattar,
// smycken, klockor och solglasögon.
// =====================================================================
function paintAccessoarer(b, night, opts) {
  const K = begin(b, night, opts), P = K.P, { L, R, baseY } = K, top = K.ftop;
  const STONE = 0xece2cc, PLUM = 0x4a1e3e, GOLD = 0xd8b060, ZINC = 0x6a7888, dx0 = K.dx0, dx1 = K.dx1;
  // ---- mansardtaket ----
  const flatT = 44, brk = 54;
  roofFelt(P, L + 2, flatT, b.w - 4, brk - flatT, 0x8a96a4, 35);
  P.hl(L + 2, flatT, b.w - 4, 0xb8c4d0);
  for (let y = brk; y < top - 4; y++) for (let x = L; x < R; x++) {
    let c = mix(ZINC, 0x4a5868, q((y - brk) / (top - 4 - brk), x, y, 3) * 0.5);
    if ((x - L) % 4 === 0) c = mix(c, WHITE, 0.25); else if ((x - L) % 4 === 3) c = mul(c, 0.85);     // falsarna
    P.px(x, y, c);
  }
  snowRoof(K, L + 2, flatT + 1, b.w - 4, brk - flatT - 1);
  // snö på det branta zinktaket: en kam under brytlinjen, snöstrimmor i falsarnas skåror
  // (längre upptill där taket är flackare) och en vulst i rännan nertill
  if (K.snow) {
    const hh = top - 4 - brk;
    for (let x = L; x < R; x++) {
      const cap = 2 + (hash(x, 5, 92) > 0.6 ? 1 : 0);
      for (let j = 0; j < cap; j++) P.px(x, brk + 1 + j, j === 0 ? 0xffffff : 0xe4ecf6);
      const g = (x - L) % 4;
      if (g === 1 || g === 2) {
        const len = Math.round(hh * (0.25 + hash(x >> 2, 9, 93) * 0.45));
        for (let j = cap; j < len; j++) P.px(x, brk + 1 + j, g === 1 ? 0xf2f6fc : 0xd8e2ee);
      }
      P.px(x, top - 5, 0xf4f8fc); if (hash(x, 7, 94) > 0.4) P.px(x, top - 6, 0xe4ecf6);
    }
  }
  // krön i smide längs brytlinjen
  P.hl(L, brk, b.w, 0x2a2a30);
  for (let x = L + 1; x < R - 1; x += 3) { P.px(x, brk - 1, 0x2a2a30); P.px(x + 1, brk - 2, 0x2a2a30); }
  // skorstenar
  for (const cxx of [L + 6, R - 12]) {
    area(P, cxx, flatT - 8, 6, 12, (X, Y, i, j) => { let k = jit(0xb8ac98, X, Y, 45, 0.08); if (j % 4 === 3) k = mul(k, 0.8); if (i === 0) k = mix(k, WHITE, 0.2); if (i === 5) k = mul(k, 0.7); return k; });
    P.rect(cxx - 1, flatT - 9, 8, 2, 0x8a8680); P.hl(cxx - 1, flatT - 9, 8, 0xc8c4bc);
    for (let k = 0; k < 3; k++) P.rect(cxx + k * 2, flatT - 12, 1, 3, 0xa8583a);
    K.ledges.push([cxx - 1, flatT - 10, 8, 1]);
  }
  // takkupor med rundade tak
  for (const dxc of [L + 22, R - 22]) {
    const dw = 12, dy0 = brk + 6, dh = top - 6 - dy0;
    P.darken(dxc + (dw >> 1) + 1, dy0 - 2, 3, dh + 2, 0.7);
    area(P, dxc - (dw >> 1), dy0, dw, dh, (X, Y, i) => jit(i === 0 ? mix(STONE, WHITE, 0.3) : i === dw - 1 ? mul(STONE, 0.8) : STONE, X, Y, 46, 0.04));
    for (let j = 0; j < 5; j++) { const hw = Math.round(Math.sqrt(Math.max(0, 1 - ((4 - j) / 4.5) ** 2)) * (dw / 2 + 1)); P.hl(dxc - hw, dy0 - 5 + j, hw * 2, j === 0 ? 0xa8b4c0 : ZINC); }
    K.ledges.push([dxc - 4, dy0 - 6, 8, 1]);
    upperWindow(K, dxc - 4, dy0 + 3, 8, dh - 6, { seed: 30 + dxc, gid: 40 + dxc, frame: 0xf4f0e8 });
  }
  // ---- fasaden i kalksten med pilastrar ----
  corniceBand(P, K, L, top - 4, b.w, 0xf4ecdc);
  P.hl(L - 2, top - 2, b.w + 4, GOLD);
  ashlar(P, L, top + 1, b.w, 55, STONE, { course: 6, block: 16, seed: 47 });
  for (const px of [L, L + 32, L + 64, R - 4]) {
    area(P, px, top + 1, 4, 55, (X, Y, i) => jit(i === 0 ? mix(STONE, WHITE, 0.35) : i === 3 ? mul(STONE, 0.78) : mix(STONE, WHITE, 0.1), X, Y, 48, 0.03));
    P.rect(px - 1, top + 1, 6, 2, mix(STONE, WHITE, 0.3));
  }
  [0, 1, 2].forEach((k) => {
    const wx = L + 11 + k * 32, wy = top + 9;
    P.rect(wx + 4, wy - 4, 4, 3, mix(STONE, WHITE, 0.25)); P.vl(wx + 7, wy - 4, 3, mul(STONE, 0.7));        // slutsten
    upperWindow(K, wx, wy, 12, 30, { seed: 51 + k, juliet: true, gid: 60 + k, frame: 0xf8f4ec });
  });
  P.hl(L, top + 55, b.w, mix(STONE, WHITE, 0.4)); P.hl(L, top + 56, b.w, mul(STONE, 0.75));
  // skyltbandet
  const sgY = top + 56;
  P.rect(L, sgY, b.w, 12, PLUM); P.box(L + 1, sgY + 1, b.w - 2, 10, GOLD); P.hl(L, sgY + 11, b.w, 0x1a0a16);
  const name = 'ACCESSOARER', nx = centerX(BIG, name, (L + R) / 2);
  signText(P, BIG, name, nx, sgY + 3, GOLD, { shadow: 0x1a0a16, hi: 0xfff0b8, lo: 0xb08a30 });
  K.texts.push([...textGlow(BIG, name, 1, 0xffd890, K.wx(nx), K.wy(sgY + 3)), 0.55]);
  // butiksfronten i aubergine med guldlister
  const fT = sgY + 12;
  area(P, L, fT, b.w, baseY - fT, (X, Y) => jit(PLUM, X, Y, 77, 0.06));
  for (const x of [L + 1, dx0 - 3, dx1 + 2, R - 2]) P.vl(x, fT + 2, baseY - fT - 6, GOLD);
  const winY = fT + 3, winH = baseY - 6 - winY;
  showWindow(K, L + 5, winY, dx0 - 5 - (L + 5) - 1, winH, { frame: PLUM, pin: GOLD, back: [0xf4ecf0, 0xdcc8d4], paint: (Q, x, y, w, h) => {
    // väskor på vita sockler, hatt på ställ
    const plinth = (px, pw, ph) => { Q.rect(px, y + h - ph, pw, ph, 0xf8f6f4); Q.hl(px, y + h - ph, pw, WHITE); Q.vl(px + pw - 1, y + h - ph, ph, 0xc8c0c4); };
    plinth(x + 2, 8, 5); plinth(x + 12, 7, 9); plinth(x + 21, 8, 3);
    const bag = (bx, by, bw, bh, c, handle) => { Q.rect(bx, by, bw, bh, c); Q.hl(bx, by, bw, mix(c, WHITE, 0.3)); Q.vl(bx + bw - 1, by, bh, mul(c, 0.7)); if (handle) { Q.px(bx + 1, by - 1, mul(c, 0.7)); Q.hl(bx + 2, by - 2, bw - 4, mul(c, 0.7)); Q.px(bx + bw - 2, by - 1, mul(c, 0.7)); } Q.px(bx + (bw >> 1), by + 1, GOLD); };
    bag(x + 3, y + h - 11, 6, 6, 0xb8783a, true); bag(x + 13, y + h - 14, 5, 5, 0xd8323a, true); bag(x + 22, y + h - 6, 6, 3, 0x2a2a30, false);
    // hattstället med en solhatt
    Q.vl(x + w - 4, y + 6, h - 7, 0x8a6a4a); Q.hl(x + w - 6, y + h - 2, 5, 0x6a4a2a);
    Q.hl(x + w - 8, y + 6, 9, 0xe8d08a); Q.rect(x + w - 6, y + 3, 5, 3, 0xe8d08a); Q.hl(x + w - 6, y + 5, 5, 0x2a2a30);
    // NY-lappen en bit in i fönstret (gatlyktan i Bankgatans hörn står framför fönstrets vänstra kant)
    Q.rect(x + 8, y + 2, 10, 3, 0xf8f6f4); text(Q, SMALL, 'NY', x + 9, y + 1, PLUM);
    K.noGlow.push([x + 8, y, 11, 7]);
  } });
  showWindow(K, dx1 + 6, winY, R - 5 - (dx1 + 6), winH, { frame: PLUM, pin: GOLD, back: [0x7a4a6a, 0x4e2a46], paint: (Q, x, y, w, h) => {
    // smyckesbysten i svart sammet med guldhalsband
    const bx = x + 5;
    Q.rect(bx - 1, y + 4, 3, 3, 0x1a1418); Q.rect(bx - 4, y + 7, 9, 8, 0x1a1418); Q.hl(bx - 3, y + 7, 7, 0x2a2228);
    for (let i = -3; i <= 3; i++) Q.px(bx + i, y + 9 + ((i * i) >> 2), GOLD); Q.px(bx, y + 12, 0xe83a6a);
    Q.rect(bx - 3, y + 15, 7, 2, 0xd8c0a0);
    // klockorna på en kudde
    Q.rect(x + 11, y + h - 6, 12, 3, 0xf0e8f0); Q.hl(x + 11, y + h - 6, 12, WHITE);
    for (let k = 0; k < 3; k++) { const kx = x + 12 + k * 4; Q.vl(kx + 1, y + h - 9, 5, [0x2a2a30, 0x8a5a2a, 0xc8c8d0][k]); Q.rect(kx, y + h - 8, 3, 3, GOLD); Q.px(kx + 1, y + h - 7, WHITE); }
    // solglasögon på ett ställ
    const sx = x + w - 9;
    Q.vl(sx + 4, y + 3, h - 4, 0xc8c8d0);
    for (let k = 0; k < 3; k++) { const gy = y + 4 + k * 5, c = [0x1a1a1e, 0x8a3a1a, 0x2a4a8a][k]; Q.rect(sx, gy, 3, 2, c); Q.rect(sx + 5, gy, 3, 2, c); Q.hl(sx + 2, gy, 4, GOLD); Q.px(sx, gy, mix(c, WHITE, 0.4)); }
    // sidenscarf
    for (let j = 0; j < 6; j++) Q.hl(x + 11 + (j & 1), y + 3 + j, 9, [0xe83a6a, 0xf8d040, 0x3a8ad8][j % 3]);
  } });
  granite(P, L, baseY - 4, b.w, 4, 0x2a1a24, 78); P.hl(L, baseY - 4, b.w, 0x5a3a4a);
  P.rect(dx0 - 2, baseY, dx1 - dx0 + 4, 2, 0x8a8680); P.hl(dx0 - 2, baseY, dx1 - dx0 + 4, 0xc8c4bc);
  footShadow(K, L, dx0 - 2 - L); footShadow(K, dx1 + 2, R - dx1 - 2);
  // små mässingslyktor vid dörren
  for (const lx of [dx0 - 6, dx1 + 3]) { P.rect(lx, fT + 6, 3, 5, 0x8a6a2a); P.rect(lx + 1, fT + 7, 1, 3, night ? 0xffe8a0 : 0xf0e8d0); K.glows.push([lx + 1, fT + 7, 1, 3, 0xffd890, 0.8]); }
  return finish(K, { doorTop: K.wy(baseY - 28) });
}

// ---------- live/glow för butikerna ----------
const SHOP_DOORS = {
  skor: { col: 0x1c1c20, trim: 0xd8b060, sign: 'ÖPPET', inside: (n) => ({ wall0: n ? 0xfff0d0 : 0xf8f0e4, wall1: n ? 0xd8b080 : 0xe0d4c0, floor: 0xa89070 }),
    insideExtra: (I, w, h) => { for (let r = 0; r < 3; r++) { I.hl(1, 8 + r * 6, w - 2, 0xc8b8a0); for (let x = 2; x < w - 3; x += 5) shoe(I, x, 5 + r * 6, ['sneaker', 'boot', 'pump', 'loafer'][(x + r) % 4], [0xd83a3a, 0x3a6ad8, 0x6a4028, 0x2a2a2e][(x + r * 3) % 4]); } } },
  frisor: { col: 0x1c2a4a, trim: 0xd8b060, sign: 'ÖPPET', inside: (n) => ({ wall0: n ? 0xfff0d8 : 0xeef4f0, wall1: n ? 0xd8b890 : 0xc8d8d0, floor: 0x3a3a40 }),
    insideExtra: (I, w, h) => { for (let x = 0; x < w; x++) for (let y = h - 9; y < h; y++) if (((x >> 1) + (y >> 1)) & 1) I.px(x, y, 0xe8e8e8); I.rect(3, 6, w - 6, 8, 0xd8e8f0); I.box(2, 5, w - 4, 10, 0xe8c060); } },
  accessoarer: { col: 0x4a1e3e, trim: 0xd8b060, handle: 0xf0d070, sign: 'ÖPPET', signCol: 0x4a1e3e, inside: (n) => ({ wall0: n ? 0xfff0e0 : 0xf8eef4, wall1: n ? 0xd8a890 : 0xdcc8d4, floor: 0x6a4a3a }),
    insideExtra: (I, w, h) => { I.rect(3, h - 15, w - 6, 5, 0xf8f6f4); I.hl(3, h - 15, w - 6, GOLDC); for (let x = 5; x < w - 5; x += 4) I.rect(x, h - 18, 2, 3, [0xd8323a, 0xb8783a, 0x2a2a30][x % 3]); } },
};
const GOLDC = 0xd8b060;
function liveShop(ctx, b, st) {
  const m = metaOf(b, st.night, st);
  if (!m) return;
  const open = isOpen(b, st);                                                       // vändskylten: ÖPPET eller öppettiderna
  const o = SHOP_DOORS[b.kind], kit = kitOf('shop:' + b.id + ':' + !!st.night + ':' + open, () => shopDoorKit(b, st.night, o, open));
  drawDoorKit(ctx, b.door.x0, m.doorTop, kit, st.doorOpen, (x0, top) => boost(ctx, st, () => ctx.drawImage(kit.inside, x0, top), open ? 1 : 0.3));
  boostLit(ctx, b, st, m);                                                         // skyltfönstren lyser
  const t = st.t || 0;
  if (m.pole) { drawPole(ctx, m.pole, t); boost(ctx, st, () => drawPole(ctx, m.pole, t)); }
  if (m.smoke) for (let i = 0; i < 4; i++) {                                         // rök ur frisörens skorsten
    const ph = (t * 0.25 + i / 4) % 1, sz = 2 + Math.round(ph * 3);
    ctx.fillStyle = rgba(st.night ? 0x8a8ea0 : 0xe8e8ec, 0.4 * (1 - ph));
    ctx.fillRect(Math.round(m.smoke[0] + ph * 8 + Math.sin(t * 1.3 + i * 2) * 1.5) - 1, Math.round(m.smoke[1] - ph * 16), sz, sz - 1);
  }
  liveCommon(ctx, b, st, m);
}
// barberarstolpen: röd-vit-blå spiral som vandrar uppåt
// (nio färdiga bildrutor – spiralen upprepar sig efter nio steg)
const POLE = new Map();
function drawPole(ctx, p, t) {
  const [x, y, w, h] = p, off = ((Math.floor(t * 6) % 9) + 9) % 9, key = w + 'x' + h;
  let fr = POLE.get(key);
  if (!fr) {
    fr = [];
    for (let o = 0; o < 9; o++) {
      const S = new Pix(w, h);
      for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
        const k = (j + i * 2 + o) % 9;
        let c = k < 3 ? 0xd8323a : k < 6 ? 0xf4f1ea : 0x2a5ab0;
        if (i === w - 1) c = mul(c, 0.62); else if (i === w - 2 && w > 3) c = mul(c, 0.82);   // cylinderns skuggsida
        S.px(i, h - 1 - j, c);
      }
      for (let j = 0; j < h; j++) { S.px(0, j, WHITE, 0.45); if (w > 3) S.px(1, j, WHITE, 0.18); }   // glasets blänk
      fr.push(S.flush());
    }
    POLE.set(key, fr);
  }
  ctx.drawImage(fr[off], x, y);
}
function glowShop(ctx, b, st) {
  glowBase(ctx, b, st, (c, m, k) => {
    const open = !b.open || (st.hour >= b.open[0] && st.hour < b.open[1]);
    const x0 = b.door.x0, dw = b.door.x1 - b.door.x0, base = baseOf(b);
    if (open) for (let r = 0; r < 8; r++) { const sp = Math.round(r * 0.6); c.fillStyle = rgba(0xffe0b0, 0.14 * k * (1 - r / 8)); c.fillRect(x0 - sp, base + r, dw + sp * 2, 1); }
  });
}

// ================= registret =================
export const BUILDING_ART = {
  kontor1: { paint: paintKontor1, live: liveOffice, glow: glowOffice },
  kontor2: { paint: paintKontor2, live: liveOffice, glow: glowOffice },
  kontor3: { paint: paintKontor3, live: liveTower, glow: glowTower },
  kontor4: { paint: paintKontor4, live: liveTower, glow: glowTower },
  bank: { paint: paintBank, live: liveBank, glow: glowBank },
  elektronik: { paint: paintElektronik, live: liveElektronik, glow: glowElektronik },
  skor: { paint: paintSkor, live: liveShop, glow: glowShop },
  frisor: { paint: paintFrisor, live: liveShop, glow: glowShop },
  accessoarer: { paint: paintAccessoarer, live: liveShop, glow: glowShop },
};
