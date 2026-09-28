// SÖDER: fasadkonst för den södra husraden (radhus, pizzeria, posten,
// djuraffären, bion, kyrkan, vårdcentralen, Tornhuset, bensinmacken) och de
// fristående husen i parken (kiosk, toalett, glasskiosk, lekförråd,
// musikpaviljong). Husen byggs på fasadlådan (facade-kit.js: tak, väggytor,
// våningar, dörr som öppnas, skylt, snö på taket) och får sedan egna detaljer
// i extra(): brevlådor, akvarium, klocktorn med visare, ambulansintag,
// pumpar, prisskylt, affischer, vedugnsglöd, rök ur skorstenarna …
//
// Kontrakt (docs/STADEN.md): BUILDING_ART[kind] = { paint(b, night, opts) → canvas,
// live(ctx, b, st), glow(ctx, b, st), front?(ctx, b, st), items?(b, st) → [{ y, draw(ctx) }] }.
// Bilden placeras med artPos (står på b.base); artBox(b) ger rekommenderad storlek.
// Södervända hus: bildens rad r = världens y r + artBox(b).y (454 för en vanlig södra rad).
// extra(P, K) ritar i canvas-koordinater; allt live()/glow() behöver läggs i K.out
// i VÄRLDSKOORDINATER (K.box.x / K.box.y är förskjutningen).
import { Pix, mix, mul, hash, bayer, SMALL, BIG, text, textW } from '../core/floor-pix.js';
import { makeArt, jit, qmix, windowAt, WHITE, rgba } from './facade-kit.js';

const rgb = (c) => `rgb(${(c >> 16) & 255},${(c >> 8) & 255},${c & 255})`;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
// yta med funktion per pixel (null = hoppa över)
function area(P, x, y, w, h, fn) {
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const c = fn(x + i, y + j, i, j); if (c !== null && c !== undefined) P.px(x + i, y + j, c); }
}
// text med kontur och skugga (skyltar)
function label(P, F, s, x, y, fg, outline, shadow) {
  if (shadow !== undefined) text(P, F, s, x + 1, y + 1, shadow, 0.7);
  if (outline !== undefined) for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) text(P, F, s, x + dx, y + dy, outline);
  text(P, F, s, x, y, fg);
}
// tegelskorsten med plåthuv (x = vänster kant, top/bot i canvas-y)
function chimney(P, x, top, bot, c = 0x9a4a38) {
  P.darken(x + 7, top + 4, 3, bot - top - 4, 0.7);
  area(P, x, top + 2, 7, bot - top - 2, (X, Y, i, j) => { let k = jit(c, X, Y, 44, 0.1); if ((j % 3) === 2) k = mul(k, 0.7); if (i === 0) k = mix(k, WHITE, 0.2); if (i === 6) k = mul(k, 0.7); return k; });
  P.rect(x - 1, top, 9, 2, 0xa8a8b0); P.hl(x - 1, top, 9, 0xd8d8e0); P.hl(x - 1, top + 1, 9, 0x6a6a72);
  P.rect(x + 1, top - 3, 2, 3, 0x2a2a30); P.rect(x + 4, top - 3, 2, 3, 0x2a2a30);
}
// takfönster (ligger i takfallet)
function skylight(P, x, y, w, h, night) {
  P.rect(x - 1, y - 1, w + 2, h + 2, 0x3a3a40);
  area(P, x, y, w, h, (X, Y, i, j) => (night ? qmix(0x1c2a44, 0x0e1628, j / h, X, Y, 2) : qmix(0xc8e0f4, 0x5a7a9a, j / h, X, Y, 3)));
  P.line(x, y + h - 1, x + w - 1, y, WHITE, 0.35);
  P.hl(x, y, w, WHITE, 0.4);
}
// ventilationshuv på platt tak
function vent(P, x, y) { P.rect(x, y, 5, 4, 0xb4b0a8); P.hl(x, y, 5, 0xd8d4cc); P.hl(x, y + 3, 5, 0x6a6660); P.px(x + 2, y - 1, 0x8a8a90); }
// liten rökpuff (live)
function puffs(ctx, cx, cy, t, o = {}) {
  const n = o.n || 5, rate = o.rate || 0.25, rise = o.rise || 18, drift = o.drift || 8, tone = o.tone || 0xe8e8ec, a0 = o.alpha || 0.45;
  for (let i = 0; i < n; i++) {
    const ph = (t * rate + i / n) % 1, sz = 2 + Math.round(ph * 3);
    const x = Math.round(cx + ph * drift + Math.sin(t * 1.3 + i * 2) * 1.5), y = Math.round(cy - ph * rise);
    ctx.fillStyle = rgba(tone, (a0 * (1 - ph)).toFixed(3));
    ctx.fillRect(x - (sz >> 1), y - (sz >> 1), sz, sz - 1);
  }
}
const FLOWERS = [0xe83a4a, 0xf05a8a, 0xf8d040, 0xffffff, 0xb05ae0];
// fasadlådans fönsterrutnät (samma formel som paintBuilding) → [x, y, w, h] i canvas-koordinater
function winGrid(K, spec) {
  const b = K.b, gh = spec.groundH ?? 30, fh = spec.floorH ?? 22, ww = spec.winW ?? 10, sp = spec.winSp ?? 18, wh = spec.winH ?? 13;
  const upTop = K.ftop + 6, upBot = K.baseY - gh - 13, floors = Math.max(0, Math.floor((upBot - upTop) / fh));
  const cols = Math.max(1, Math.floor((b.w - 10) / sp)), wx0 = K.fx0 + Math.round((b.w - (cols * sp - (sp - ww))) / 2), off = upBot - floors * fh;
  const out = [];
  for (let f = 0; f < floors; f++) for (let k = 0; k < cols; k++) out.push([wx0 + k * sp, off + f * fh + ((fh - wh) >> 1), ww, wh, k, f]);
  return out;
}
// lövklump (buske/krona)
function bush(P, cx, cy, rx, ry, seed, dark = 0x2e6a2a, midc = 0x4f9a3a, light = 0x7fc85a) {
  for (let y = Math.floor(cy - ry); y <= cy + ry; y++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
    const d = Math.hypot((x + 0.5 - cx) / rx, (y + 0.5 - cy) / ry);
    if (d > 1 || (d > 0.72 && hash(x, y, seed) > 0.55)) continue;
    const l = ((cx - x) / rx + (cy - y) / ry) * 0.45 + (hash(x, y, seed) - 0.5) * 0.9;
    P.px(x, y, l > 0.35 ? light : l > -0.25 ? midc : dark);
  }
}

// ---------------------------------------------------------------------
// Specarna. Fälten är fasadlådans (wall, wallKind, roof, ground, …) plus
// extra(P, K), live(ctx, b, st, m), glow(ctx, b, st, k, m) och items(b, st).
// ---------------------------------------------------------------------
const SPECS = {
  // ================= RADHUSEN =================
  radhus: {
    wall: 0xe4d49c, wallKind: 'plaster', roof: 'gable', roofCol: 0x8a3a2a, ground: 'house', frame: 0xf4f1ea, signBg: 0x4a6a3a, signFg: 0xf4f1ea, doorCol: 0x3a5a8a, groundH: 30, floorH: 24,
    extra(P, K) {
      const tints = [0xe4d49c, 0xc8d8c0, 0xe8c0a8], doors = [0x8a3a2a, 0x3a5a8a, 0x2a6a4a];
      // tre radhus i olika färger, brandväggar emellan, takkupor och skorstenar
      for (let u = 0; u < 3; u++) {
        const x0 = K.fx0 + u * 44, x1 = x0 + 44;
        if (u !== 0) for (let y = K.ftop + 4; y < K.baseY - 5; y++) for (let x = x0 + 1; x < x1 - 1; x++) { const c = P.get(x, y); if (c) P.px(x, y, mix(c, tints[u], 0.35)); }
        if (u < 2) { P.vl(x1 - 1, K.rtop + 2, K.baseY - K.rtop - 2, 0x6a5a48); P.vl(x1 - 2, K.rtop + 2, K.ftop - K.rtop - 2, 0x8a7a68); }
        // takkupa
        const kx = x0 + 15, ky = K.rtop + 8;
        P.rect(kx, ky, 14, 12, mix(tints[u], WHITE, 0.2)); P.vl(kx, ky, 12, 0xfff8ea); P.vl(kx + 13, ky, 12, mul(tints[u], 0.7));
        for (let r = 0; r < 5; r++) P.hl(kx - 1 + (4 - r), ky - 5 + r, 16 - 2 * (4 - r), r === 0 ? 0xf4ecdc : 0x7a3226);
        windowAt(P, kx + 3, ky + 3, 8, 7, { night: K.night, lit: K.night && hash(u, 3, K.seed) > 0.4, frame: 0xf4f1ea, sill: 0xd8d0c0 });
        if (K.night && hash(u, 3, K.seed) > 0.4) K.lit.push([kx + 3 + K.box.x, ky + 3 + K.box.y, 8, 7]);
        chimney(P, x0 + 32, K.rtop - 4, K.rtop + 10);
        if (u !== 1) {
          const dx = x0 + 14;                                       // grannarnas dörrar (stängda)
          P.rect(dx - 2, K.baseY - 30, 20, 2, 0x6a5a48);
          P.rect(dx, K.baseY - 28, 16, 28, doors[u]); P.box(dx, K.baseY - 28, 16, 28, mul(doors[u], 0.6));
          P.rect(dx + 3, K.baseY - 24, 10, 6, K.night ? 0xffd88a : 0x9fc3e0); P.box(dx + 3, K.baseY - 24, 10, 6, mul(doors[u], 0.7));
          P.box(dx + 3, K.baseY - 14, 10, 9, mul(doors[u], 0.75));
          P.px(dx + 12, K.baseY - 12, 0xe8d070);
          if (K.night) K.lit.push([dx + 3 + K.box.x, K.baseY - 24 + K.box.y, 10, 6]);
        }
        // husnummer och utelampa
        P.rect(x0 + 5, K.baseY - 24, 7, 8, 0x1f4f9a); P.box(x0 + 5, K.baseY - 24, 7, 8, 0xeef2f8); text(P, SMALL, String(1 + u * 2), x0 + 7, K.baseY - 22, WHITE);
        const lx = x0 + 32;
        P.rect(lx, K.baseY - 27, 4, 5, 0x2a2a30); P.rect(lx + 1, K.baseY - 26, 2, 3, K.night ? 0xffe8a0 : 0xd8e0e0); P.hl(lx - 1, K.baseY - 28, 6, 0x3a3a44);
        if (K.night) K.lit.push([lx + 1 + K.box.x, K.baseY - 26 + K.box.y, 2, 3]);
        // brevlåda på väggen
        P.rect(x0 + 36, K.baseY - 16, 6, 4, 0x2a2a2a); P.hl(x0 + 36, K.baseY - 16, 6, 0x6a6a6a); P.px(x0 + 38, K.baseY - 15, 0xe8d070);
      }
      K.out.smoke = [0, 1, 2].map((u) => [K.fx0 + u * 44 + 35 + K.box.x, K.rtop - 5 + K.box.y]);
    },
    live(ctx, b, st, m) {
      if (!m.smoke) return;
      m.smoke.forEach(([x, y], i) => { if (i === 1 || st.hour < 6 || st.hour > 22) return; puffs(ctx, x, y, st.t + i * 3, { n: 4, rate: 0.22, rise: 16, drift: 6 + (st.env?.weather?.wind || 0) * 0.5, tone: st.night ? 0x8a8ea0 : 0xe8e8ec, alpha: 0.4 }); });
    },
    // trädgårdarna framför: gräsmatta, plattgångar till dörrarna, rabatter och häckarna (y-sorterade skivor)
    items(b, st) {
      const out = [];
      if (!b.yard) return out;
      const [x0, y0, x1, y1] = b.yard.rect;
      if (!SPECS.radhus._yard) {
        const P = new Pix(x1 - x0, y1 - y0);
        area(P, 0, 0, x1 - x0, y1 - y0, (X, Y) => { const n = hash(X, Y, 301); return n > 0.9 ? 0x6fae4a : n < 0.08 ? 0x3f7a34 : jit(0x5a9a3e, X, Y, 302, 0.08); });
        for (let u = 0; u < 3; u++) {
          const px = u * 44 + 14 + (u === 1 ? 2 : 0), pw = u === 1 ? 16 : 16;
          area(P, px, 0, pw, y1 - y0, (X, Y, i, j) => (((i >> 2) + (j >> 2)) & 1 ? 0xc8c0b0 : 0xb8b0a0));
          for (let k = 0; k < 6; k++) { const fx = u * 44 + 3 + ((hash(k, u, 303) * 9) | 0), fy = 3 + ((hash(k, u, 304) * 16) | 0); P.px(fx, fy, FLOWERS[k % FLOWERS.length]); P.px(fx, fy + 1, 0x3f7a34); }
          for (let k = 0; k < 5; k++) { const fx = u * 44 + 33 + ((hash(k, u, 305) * 9) | 0), fy = 3 + ((hash(k, u, 306) * 16) | 0); P.px(fx, fy, FLOWERS[(k + 2) % FLOWERS.length]); P.px(fx, fy + 1, 0x3f7a34); }
        }
        P.hl(0, y1 - y0 - 1, x1 - x0, 0x8a8478, 0.5);
        SPECS.radhus._yard = P.flush();
      }
      out.push({ y: y0 + 0.02, draw: (ctx) => ctx.drawImage(SPECS.radhus._yard, x0, y0) });
      for (const [hx0, hy0, hx1, hy1] of b.blocks || []) for (let y = hy0; y < hy1; y += 4) {
        const yy = y, hh = Math.min(4, hy1 - y);
        out.push({ y: yy + hh, draw: (ctx) => {
          for (let j = 0; j < hh; j++) for (let i = -1; i <= hx1 - hx0; i++) { const n = hash(hx0 + i, yy + j, 307); ctx.fillStyle = rgb(n > 0.8 ? 0x7fc85a : n < 0.2 ? 0x2e6a2a : 0x4f9a3a); ctx.fillRect(hx0 + i, yy + j - 6, 1, 1); }
        } });
      }
      return out;
    },
  },
  // ================= PIZZERIA NAPOLI =================
  pizzeria: {
    wall: 0xe8c89a, wallKind: 'plaster', roof: 'gable', roofCol: 0x9a4a32, ground: 'shop', awning: 0x2a8a3a, signBg: 0xf4f1ea, signFg: 0xc8342a, signBorder: 0x2a8a3a, neon: 0xff6040, frame: 0x5a3a2a, floorH: 24,
    extra(P, K) {
      // markisen i grönt-vitt-rött
      for (let y = K.gtop - 1; y < K.gtop + 6; y++) for (let x = K.fx0 - 2; x < K.fx1 + 2; x++) { const s = Math.floor((x - K.fx0) / 5) % 3; if (s === 2) P.px(x, y, mul(0xd83a2a, y === K.gtop + 5 ? 0.75 : 1)); }
      // gröna fönsterluckor i trä på båda sidor om övervåningarnas fönster + blomlådor
      for (const [wx, wy, ww, wh, k, f] of winGrid(K, SPECS.pizzeria)) {
        for (const sx of [wx - 5, wx + ww + 2]) { for (let j = 0; j < wh + 2; j++) P.hl(sx, wy - 1 + j, 3, (j % 3) === 2 ? 0x2e5a2e : 0x3a7a3a); P.vl(sx, wy - 1, wh + 2, 0x4a8a4a); }
        if ((k + f) & 1) { P.rect(wx - 1, wy + wh + 3, ww + 2, 2, 0x8a5a36); P.hl(wx - 1, wy + wh + 3, ww + 2, 0xb07a4a); for (let i = 0; i < ww + 2; i += 2) { P.px(wx - 1 + i, wy + wh + 2, 0x4f9a3a); if (i & 2) P.px(wx + i, wy + wh + 1, FLOWERS[(i + k) % FLOWERS.length]); } }
      }
      // vedugnens skorsten (bred, med sotig topp) + pizzabagare-skylt
      chimney(P, K.fx1 - 18, K.rtop - 6, K.rtop + 12, 0x7a6a60);
      P.hl(K.fx1 - 19, K.rtop - 4, 9, 0x2a2420, 0.6);
      K.out.smoke = [K.fx1 - 15 + K.box.x, K.rtop - 8 + K.box.y];
      // menytavla vid dörren
      const mx = K.dx + K.dw + 5, my = K.baseY - 26;
      P.rect(mx, my, 12, 18, 0x3a2a1a); P.box(mx, my, 12, 18, 0x8a6a3a);
      for (let j = 0; j < 4; j++) { P.hl(mx + 2, my + 3 + j * 4, 5 + (j & 1) * 2, 0xf4ecdc, 0.85); P.px(mx + 9, my + 3 + j * 4, 0xffd23f); }
      P.hl(mx - 1, my + 18, 14, 0x000000, 0.25);
      // hängande skylt: pizza
      const hx = K.fx0 - 6, hy = K.gtop - 30;
      P.hl(hx, hy, 8, 0x2a2420); P.vl(hx + 3, hy + 1, 2, 0x5a5048);
      P.ell(hx + 3.5, hy + 8, 5, 5, 0xe8b860, 1, 1); P.ell(hx + 3.5, hy + 8, 4, 4, 0xd83a2a, 1, 1); P.ell(hx + 3.5, hy + 8, 3, 3, 0xf4e0a0, 1, 1);
      P.px(hx + 2, hy + 7, 0xd83a2a); P.px(hx + 5, hy + 9, 0xd83a2a); P.px(hx + 4, hy + 6, 0x4a8a3a);
      K.out.oven = K.shop[0] ? [K.shop[0][0], K.shop[0][1], K.shop[0][2], K.shop[0][3]] : null;
    },
    live(ctx, b, st, m) {
      // ugnens sken i skyltfönstret och rök ur skorstenen när det är öppet
      if (m.oven) {
        const [x, y, w, h] = m.oven, f = 0.5 + 0.5 * Math.sin(st.t * 3.1) * Math.sin(st.t * 1.7);
        ctx.fillStyle = `rgba(255,${120 + (f * 60) | 0},40,${(0.25 + 0.2 * f).toFixed(3)})`;
        ctx.fillRect(x + 2, y + h - 7, Math.min(10, w - 4), 5);
      }
      if (m.smoke && st.hour >= 10 && st.hour < 23) puffs(ctx, m.smoke[0], m.smoke[1], st.t, { n: 6, rate: 0.3, rise: 22, drift: 8 + (st.env?.weather?.wind || 0) * 0.6, tone: st.night ? 0x7a7a88 : 0xd8d4d0, alpha: 0.5 });
    },
    glow(ctx, b, st, k, m) {
      if (!m.oven) return;
      const [x, y, w, h] = m.oven, f = 0.5 + 0.5 * Math.sin(st.t * 3.1);
      ctx.fillStyle = rgba(0xff8030, (0.25 * k * (0.6 + 0.4 * f)).toFixed(3)); ctx.fillRect(x, y + h - 9, Math.min(14, w), 9);
    },
  },
  // ================= POSTEN =================
  posten: {
    wall: 0xe8dcc0, wallKind: 'plaster', roof: 'flat', ground: 'shop', signBg: 0xffd23f, signFg: 0x1a3a8a, signBorder: 0x1a3a8a, frame: 0x1a3a8a, floorH: 24,
    extra(P, K) {
      // posthornet över skylten
      const cx = K.fx1 - 12, cy = K.gtop - 8;
      P.ell(cx, cy, 5, 5, 0xffd23f, 1, 2); P.ell(cx, cy, 3, 3, 0x1a3a8a, 1, 2); P.px(cx, cy, 0xffd23f); P.px(cx + 4, cy - 4, 0xffd23f);
      // gul brevlåda (riks) och blå (lokal) till vänster om dörren
      const bx = K.dx - 20, by = K.baseY - 22;
      for (const [x, c, hi] of [[bx, 0xffd23f, 0xfff0a0], [bx + 10, 0x2a5ad0, 0x7a9af0]]) {
        P.rect(x, by, 8, 14, c); P.hl(x, by, 8, hi); P.vl(x + 7, by, 14, mul(c, 0.6)); P.hl(x, by + 13, 8, mul(c, 0.6));
        P.rect(x + 1, by + 3, 6, 1, 0x1a1a1a); P.rect(x + 1, by + 6, 6, 3, mul(c, 0.8)); P.box(x + 1, by + 6, 6, 3, mul(c, 0.55));
        P.rect(x + 1, by + 14, 6, 8, 0x4a4a52); P.vl(x + 1, by + 14, 8, 0x6a6a72);
        P.hl(x - 1, by + 22, 10, 0x000000, 0.3);
      }
      text(P, SMALL, 'POST', bx + 1, by + 9, 0x1a3a8a);
      // klocka och öppettider
      const kx = K.dx + K.dw + 8, ky = K.baseY - 34;
      P.ell(kx + 4, ky + 4, 5, 5, 0x1a3a8a, 1, 2); P.ell(kx + 4, ky + 4, 4, 4, 0xf4f1ea, 1, 2);
      K.out.clock = { x: kx + 4 + K.box.x, y: ky + 4 + K.box.y, r: 3 };
      P.rect(kx - 2, ky + 12, 20, 8, 0xf4f1ea); P.box(kx - 2, ky + 12, 20, 8, 0x1a3a8a); text(P, SMALL, '8-18', kx, ky + 14, 0x1a3a8a);
      // paketluckor i sidoväggen och en flaggstång på taket
      for (let j = 0; j < 3; j++) for (let i = 0; i < 2; i++) { const x = K.fx1 - 22 + i * 8, y = K.gtop + 8 + j * 6; P.rect(x, y, 7, 5, 0xb8b8c0); P.hl(x, y, 7, 0xe0e0e8); P.px(x + 5, y + 2, 0x1a3a8a); }
      const fx = K.fx0 + 10; P.vl(fx, K.rtop - 20, K.ftop - K.rtop + 20, 0xd8d8e0); P.px(fx, K.rtop - 21, 0xffd23f);
      P.rect(fx + 1, K.rtop - 19, 8, 5, 0x1a5ab0); P.hl(fx + 1, K.rtop - 17, 8, 0xffd23f); P.vl(fx + 3, K.rtop - 19, 5, 0xffd23f);
      K.out.flag = { x: fx + 1 + K.box.x, y: K.rtop - 19 + K.box.y };
      vent(P, K.fx1 - 30, K.rtop + 6); vent(P, K.fx0 + 30, K.rtop + 12);
    },
    live(ctx, b, st, m) {
      if (m.clock) {
        const h = st.hour % 12, a1 = h / 12 * Math.PI * 2, a2 = (st.hour % 1) * Math.PI * 2;
        ctx.fillStyle = '#1a3a8a';
        for (let r = 0; r <= 2; r++) ctx.fillRect(Math.round(m.clock.x + Math.sin(a1) * r), Math.round(m.clock.y - Math.cos(a1) * r), 1, 1);
        for (let r = 0; r <= 3; r++) ctx.fillRect(Math.round(m.clock.x + Math.sin(a2) * r), Math.round(m.clock.y - Math.cos(a2) * r), 1, 1);
      }
      if (m.flag) { // flaggan vajar i vinden
        const w = clamp((st.env?.weather?.wind || 3) / 20, 0.1, 1), ph = Math.sin(st.t * 6) * w;
        ctx.fillStyle = '#1a5ab0'; for (let i = 0; i < 8; i++) ctx.fillRect(m.flag.x + i, m.flag.y + Math.round(Math.sin(i * 0.9 + st.t * 7) * ph), 1, 5);
        ctx.fillStyle = '#ffd23f'; for (let i = 0; i < 8; i++) ctx.fillRect(m.flag.x + i, m.flag.y + 2 + Math.round(Math.sin(i * 0.9 + st.t * 7) * ph), 1, 1);
        ctx.fillRect(m.flag.x + 2, m.flag.y, 1, 5);
      }
    },
  },
  // ================= DJURAFFÄREN =================
  djuraffar: {
    wall: 0xd8e4c8, wallKind: 'plaster', roof: 'flat', roofCol: 0x7a7670, ground: 'shop', groundH: 34, floorH: 24, winW: 12, winSp: 20, signBg: 0x2a7a4a, signFg: 0xffe070, signBorder: 0xffe070, neon: 0x60ff90, frame: 0x3a5a3a, doorCol: 0x3a5a3a,
    extra(P, K) {
      // vänstra skyltfönstret: akvarium. högra: kattkorg, fågelbur och foderpåsar
      const [L, R] = K.shop.map((s) => [s[0] - K.box.x, s[1] - K.box.y, s[2], s[3]]);
      if (L) {
        const [x, y, w, h] = L;
        area(P, x + 1, y + 1, w - 2, h - 2, (X, Y, i, j) => qmix(0x3ab0d8, 0x1a4a8a, j / h, X, Y, 4));
        for (let i = 2; i < w - 4; i += 5) { const hh = 4 + ((hash(i, 1, K.seed) * 6) | 0); for (let j = 0; j < hh; j++) P.px(x + 1 + i + (j & 1), y + h - 3 - j, j > hh - 3 ? 0x6fdc4c : 0x2e8a3a); }
        for (let i = 1; i < w - 1; i += 2) P.px(x + i, y + h - 2, hash(i, 2, K.seed) > 0.5 ? 0xd8c8a0 : 0x8a7a5a);
        P.hl(x + 1, y + 1, w - 2, 0xa8e8ff, 0.7);
        K.out.aqua = [x + 1 + K.box.x, y + 1 + K.box.y, w - 2, h - 2];
      }
      if (R) {
        const [x, y, w, h] = R;
        // hylla med foderpåsar
        P.hl(x + 1, y + h - 12, w - 2, 0x8a6a3a);
        for (let i = 2; i < w - 6; i += 6) { const c = [0xd83a2a, 0x2a5ad0, 0xffd23f, 0x2a8a3a][((i / 6) | 0) % 4]; P.rect(x + i, y + h - 20, 5, 8, c); P.hl(x + i, y + h - 20, 5, mix(c, WHITE, 0.4)); P.px(x + i + 2, y + h - 16, WHITE); }
        // katt i korg
        const kx = x + 4, ky = y + h - 8;
        P.ell(kx + 6, ky + 3, 7, 3, 0xb08a5a, 1, 1); P.hl(kx, ky + 1, 13, 0xd8b078);
        P.rect(kx + 3, ky - 3, 7, 4, 0x4a4a52); P.px(kx + 3, ky - 4, 0x4a4a52); P.px(kx + 9, ky - 4, 0x4a4a52); P.px(kx + 5, ky - 2, 0x6fdc4c); P.px(kx + 8, ky - 2, 0x6fdc4c);
        // fågelbur
        const bx = x + w - 14, by = y + 4;
        P.rect(bx, by, 10, 14, 0xf4f1ea, 0.3); for (let i = 0; i < 10; i += 2) P.vl(bx + i, by, 14, 0xd8d8e0); P.hl(bx - 1, by, 12, 0xd8d8e0); P.hl(bx - 1, by + 13, 12, 0xd8d8e0); P.px(bx + 4, by - 1, 0xd8d8e0);
        P.rect(bx + 3, by + 6, 4, 3, 0xffd23f); P.px(bx + 7, by + 6, 0xff8030); P.px(bx + 2, by + 8, 0x2a8a3a);
        // valp som tittar ut
        const vx = x + w - 30, vy = y + h - 9;
        P.rect(vx, vy, 8, 6, 0xc89a5a); P.rect(vx - 1, vy - 2, 5, 5, 0xd8a868); P.px(vx - 2, vy - 2, 0x8a5a2a); P.px(vx + 3, vy - 2, 0x8a5a2a); P.px(vx, vy, 0x1a1a1a); P.px(vx + 2, vy, 0x1a1a1a); P.px(vx + 1, vy + 1, 0x2a1a1a);
        P.px(vx + 8, vy - 1, 0xc89a5a);
      }
      // tassavtryck på skylten och en stor tass som neonskylt
      const cx = K.fx1 - 16, cy = K.ftop + 14;
      P.ell(cx, cy + 4, 4, 3, 0x2a7a4a, 1, 1); for (const [ox, oy] of [[-4, -2], [-1.5, -4], [1.5, -4], [4, -2]]) P.ell(cx + ox, cy + oy, 1.6, 1.6, 0x2a7a4a, 1, 1);
      K.out.paw = { x: cx + K.box.x, y: cy + K.box.y };
      // takfönster och ventilation
      skylight(P, K.fx0 + 30, K.rtop + 6, 18, 10, K.night); vent(P, K.fx1 - 40, K.rtop + 8); vent(P, K.fx1 - 30, K.rtop + 8);
      // "ÖPPET" i dörren och tidsskylt
      P.rect(K.dx + K.dw + 4, K.baseY - 34, 22, 8, 0xf4f1ea); P.box(K.dx + K.dw + 4, K.baseY - 34, 22, 8, 0x2a7a4a); text(P, SMALL, '9-19', K.dx + K.dw + 8, K.baseY - 32, 0x2a7a4a);
    },
    live(ctx, b, st, m) {
      if (!m.aqua) return;
      const [x, y, w, h] = m.aqua, t = st.t;
      // fiskar som simmar fram och tillbaka + bubblor
      for (let i = 0; i < 5; i++) {
        const sp = 6 + i * 2, ph = ((t * sp) / (w - 6) + i * 0.37) % 2, dir = ph < 1 ? 1 : -1, u = ph < 1 ? ph : 2 - ph;
        const fx = Math.round(x + 2 + u * (w - 8)), fy = Math.round(y + 4 + i * ((h - 8) / 5) + Math.sin(t * 2 + i) * 1.5);
        ctx.fillStyle = rgb([0xff8030, 0xffd23f, 0xf05a8a, 0x60d0ff, 0xff4a3a][i]);
        ctx.fillRect(fx, fy, 3, 2); ctx.fillRect(fx + (dir > 0 ? -1 : 3), fy, 1, 1); ctx.fillRect(fx + (dir > 0 ? -1 : 3), fy + 1, 1, 1);
      }
      ctx.fillStyle = 'rgba(220,245,255,0.7)';
      for (let i = 0; i < 3; i++) { const ph = (t * 0.6 + i / 3) % 1; ctx.fillRect(x + w - 6 + i, Math.round(y + h - 2 - ph * (h - 4)), 1, 1); }
    },
    glow(ctx, b, st, k, m) {
      if (m.aqua) { const [x, y, w, h] = m.aqua; ctx.fillStyle = rgba(0x40c0ff, (0.28 * k).toFixed(3)); ctx.fillRect(x, y, w, h); ctx.fillStyle = rgba(0x40a0ff, (0.1 * k).toFixed(3)); ctx.fillRect(x - 3, y + h, w + 6, 8); }
      if (m.paw) { const on = Math.floor(st.t * 1.5) % 4 !== 3; ctx.fillStyle = rgba(0x60ff90, ((on ? 0.6 : 0.15) * k).toFixed(3)); ctx.fillRect(m.paw.x - 6, m.paw.y - 6, 12, 12); }
    },
  },
  bibliotek: { // (reserv – biblioteket blev djuraffären, men kartan kan peka hit igen)
    wall: 0xd8d0c0, wallKind: 'plaster', roof: 'flat', roofCol: 0x5a9a88, ground: 'house', winW: 12, winSp: 20, winH: 16, floorH: 26, frame: 0xf0ece0, signBg: 0x3a2a1a, signFg: 0xf0d890, doorCol: 0x5a3a20,
    extra(P, K) { for (let x = K.fx0 + 3; x < K.fx1 - 3; x += 20) for (let y = K.ftop + 4; y < K.baseY - 5; y++) { P.px(x, y, mix(K.wall, WHITE, 0.25)); P.px(x + 2, y, mul(K.wall, 0.86)); } },
  },
  // ================= BIO PIXEL =================
  bio: {
    wall: 0x8a2a3a, wallKind: 'plaster', roof: 'flat', ground: 'shop', groundH: 36, floorH: 24, signBg: 0x111111, signFg: 0xffe070, neon: 0xffd040, frame: 0x2a1a1a,
    extra(P, K) {
      // art déco-lisener och en lodrät neonskylt "BIO"
      for (let x = K.fx0 + 6; x < K.fx1 - 6; x += 24) for (let y = K.ftop + 4; y < K.gtop - 2; y++) { P.px(x, y, mix(K.wall, WHITE, 0.3)); P.px(x + 1, y, mix(K.wall, WHITE, 0.12)); P.px(x + 2, y, mul(K.wall, 0.8)); }
      const vx = K.fx0 + 12, vy = K.ftop + 8;
      P.rect(vx - 3, vy - 2, 13, 34, 0x111111); P.box(vx - 3, vy - 2, 13, 34, 0xffe070);
      'BIO'.split('').forEach((ch, i) => text(P, BIG, ch, vx, vy + 1 + i * 10, 0xffd040));
      K.out.vneon = [vx - 3 + K.box.x, vy - 2 + K.box.y, 13, 34];
      // baldakin (marquee) med glödlampor och kvällens film
      const my = K.gtop - 4, mx0 = K.fx0 - 4, mw = K.fx1 - K.fx0 + 8;
      P.rect(mx0, my - 9, mw, 9, 0x2a1a1a); P.hl(mx0, my - 9, mw, 0x6a4a4a); P.hl(mx0, my - 1, mw, 0x0a0a0a);
      P.rect(mx0 + 3, my - 7, mw - 6, 5, 0xf4f1ea);
      const film = 'IKVÄLL: PIXLARNAS HÄMND 19:00', tw = textW(SMALL, film);
      P.clip(mx0 + 3, my - 7, mx0 + mw - 3, my - 2); text(P, SMALL, film, K.fx0 + ((K.fx1 - K.fx0 - tw) >> 1), my - 7, 0x8a2a3a); P.clip();
      K.out.marquee = [mx0 + K.box.x, my - 9 + K.box.y, mw, 9];
      P.hl(mx0 - 1, my, mw + 2, 0x000000, 0.3);
      // affischer i glasmontrar med filmnamn
      const titles = [['PIXLARNAS', 'HÄMND'], ['KÄRLEK I', 'FÖRORTEN']], pal = [[0x3a6aa8, 0xffd23f], [0xa83a5a, 0xf4f1ea]];
      [K.fx0 + 8, K.fx1 - 26].forEach((px, k) => {
        const py = K.gtop + 4;
        P.rect(px - 1, py - 1, 20, 26, 0x1a1a1a);
        area(P, px, py, 18, 24, (X, Y, i, j) => jit(j < 14 ? pal[k][0] : 0x1a1a24, X, Y, 9 + k, 0.3));
        P.ell(px + 9, py + 7, 5, 5, pal[k][1], 1, 2);
        text(P, SMALL, titles[k][0], px + 1, py + 15, 0xffe070); text(P, SMALL, titles[k][1], px + 1, py + 21, 0xffe070);
        P.hl(px, py, 18, WHITE, 0.3);
        K.shop.splice(K.shop.findIndex((s) => Math.abs(s[0] - K.box.x - px) < 14), 1);
      });
      // biljettluckan till vänster om dörren
      const tx = K.dx - 18, ty = K.baseY - 30;
      P.rect(tx, ty, 14, 20, 0x2a1a1a); P.rect(tx + 2, ty + 2, 10, 10, K.night ? 0xffe0a0 : 0xa8c8e4); P.box(tx + 2, ty + 2, 10, 10, 0x8a6a2a);
      P.rect(tx + 4, ty + 12, 6, 2, 0x1a1a1a); text(P, SMALL, 'KASSA', tx - 1, ty + 15, 0xffe070);
      if (K.night) K.lit.push([tx + 2 + K.box.x, ty + 2 + K.box.y, 10, 10]);
      // projektorrum och ventilation på taket
      P.rect(K.fx0 + 60, K.rtop + 4, 40, 14, 0x6a5a5a); P.hl(K.fx0 + 60, K.rtop + 4, 40, 0x9a8a8a); P.vl(K.fx0 + 99, K.rtop + 4, 14, 0x3a2a2a);
      vent(P, K.fx0 + 66, K.rtop + 7); vent(P, K.fx0 + 86, K.rtop + 7); vent(P, K.fx1 - 20, K.rtop + 8);
    },
    live(ctx, b, st, m) {
      // glödlampor som jagar runt skylten och baldakinen
      const n = Math.floor(st.t * 8);
      for (const r of [m.sign, m.marquee]) {
        if (!r) continue;
        const [x, y, w, h] = r;
        for (let i = 0; i < w; i += 3) {
          ctx.fillStyle = (i / 3 + n) % 4 === 0 ? '#fff6c0' : '#8a6a20'; ctx.fillRect(x + i, y - 2, 1, 1);
          ctx.fillStyle = (i / 3 + n) % 4 === 2 ? '#fff6c0' : '#8a6a20'; ctx.fillRect(x + i, y + h + 1, 1, 1);
        }
      }
    },
    glow(ctx, b, st, k, m) {
      if (m.vneon) { const [x, y, w, h] = m.vneon, f = 0.8 + 0.2 * Math.sin(st.t * 9); ctx.fillStyle = rgba(0xffd040, (0.4 * k * f).toFixed(3)); ctx.fillRect(x - 2, y - 2, w + 4, h + 4); }
      if (m.marquee) { const [x, y, w, h] = m.marquee; ctx.fillStyle = rgba(0xfff0c0, (0.3 * k).toFixed(3)); ctx.fillRect(x, y, w, h); ctx.fillStyle = rgba(0xffe0a0, (0.12 * k).toFixed(3)); ctx.fillRect(x - 4, y + h, w + 8, 30); }
    },
  },
  // ================= SÖDERKYRKAN =================
  kyrka: {
    wall: 0xece6d8, wallKind: 'plaster', roof: 'gable', roofCol: 0x44444e, ground: 'plain', floorH: 60, winW: 8, winSp: 26, winH: 30, frame: 0x8a8070, noSign: true, doorCol: 0x5a3018,
    extra(P, K) {
      const b = K.b;
      // tornet: vit kropp med hörnkedjor, klockvåning, kopparspira med kors
      const tx0 = K.X(b.tower.x0), tx1 = K.X(b.tower.x1), ttop = K.baseY - b.tower.h, tw = tx1 - tx0;
      const spire = ttop + 44;
      for (let y = spire; y < K.baseY; y++) for (let x = tx0; x < tx1; x++) {
        let c = jit(0xf2ece0, x, y, 31, 0.05);
        if (x === tx0) c = mix(c, WHITE, 0.3); else if (x >= tx1 - 3) c = mul(c, 0.8);
        if ((x < tx0 + 3 || x >= tx1 - 5) && ((y >> 3) & 1)) c = mul(c, 0.92);
        P.px(x, y, c);
      }
      for (let y = ttop; y < spire; y++) {
        const t = (y - ttop) / (spire - ttop), hw = Math.max(1, Math.round(t * (tw / 2 + 2)));
        for (let x = -hw; x < hw; x++) P.px(tx0 + tw / 2 + x, y, jit(x < -hw / 2 ? 0x7ac0a8 : x < 0 ? 0x6ab09a : 0x3a7a68, x, y, 32, 0.08));
      }
      P.vl(tx0 + tw / 2, ttop - 10, 10, 0xe8c040); P.hl(tx0 + tw / 2 - 3, ttop - 7, 7, 0xe8c040); P.px(tx0 + tw / 2, ttop - 11, 0xfff0a0);
      P.hl(tx0 - 2, spire, tw + 4, 0x3a7a68); P.hl(tx0 - 2, spire + 1, tw + 4, 0x2a5a4a); P.hl(tx0 - 2, spire + 2, tw + 4, 0x000000, 0.25);
      // klockvåningen: ljudluckor med klockan skymtande, urtavla med visare (live)
      for (const lx of [tx0 + 6, tx1 - 12]) { P.rect(lx, spire + 8, 6, 14, 0x2a2a30); for (let j = 0; j < 14; j += 3) P.hl(lx, spire + 8 + j, 6, 0x5a5a60); P.rect(lx - 1, spire + 6, 8, 2, 0x8a8070); }
      P.rect(tx0 + tw / 2 - 3, spire + 9, 6, 12, 0x1a1a20); P.ell(tx0 + tw / 2, spire + 16, 2.5, 3, 0xb08a3a, 1, 1); P.px(tx0 + tw / 2, spire + 19, 0x6a4a1a);
      const ck = { x: tx0 + tw / 2, y: spire + 34 };
      K.out.clock = { x: ck.x + K.box.x, y: ck.y + K.box.y };
      P.ell(ck.x, ck.y, 9, 9, 0x2a2a30, 1, 2); P.ell(ck.x, ck.y, 8, 8, 0xe8c040, 1, 2); P.ell(ck.x, ck.y, 7, 7, 0xf4f1ea, 1, 2);
      for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2; P.px(Math.round(ck.x + Math.sin(a) * 5.5), Math.round(ck.y - Math.cos(a) * 5.5), k % 3 ? 0x5a5a60 : 0x2a2a30); }
      // spetsbågiga glasmålningar på fasaden
      for (let x = K.fx0 + 10; x < K.fx1 - 12; x += 26) {
        if (x + 8 > tx0 - 2 && x < tx1 + 2) continue;
        P.rect(x - 1, K.ftop + 15, 10, 42, 0x8a8070); P.rect(x, K.ftop + 16, 8, 40, 0x6a6050);
        for (let j = 0; j < 38; j++) for (let i = 0; i < 6; i++) { if (j < 3 && (i === 0 || i === 5)) continue; if (j < 1 && (i === 1 || i === 4)) continue; P.px(x + 1 + i, K.ftop + 17 + j, K.night ? ((i + j) % 5 ? 0xe8a850 : 0xc84a3a) : ((i * 3 + j) % 7 === 0 ? 0xc84a5a : (i + j) % 4 ? 0x3a5a9a : 0xe8c050)); }
        P.vl(x + 4, K.ftop + 20, 34, 0x2a2a30, 0.6); P.hl(x + 1, K.ftop + 36, 6, 0x2a2a30, 0.6);
        if (K.night) K.lit.push([x + 1 + K.box.x, K.ftop + 17 + K.box.y, 6, 38]);
      }
      // portalen: rundbåge i sten med dubbeldörr och lyktor
      P.rect(K.dx - 6, K.baseY - 40, K.dw + 12, 12, 0xd8d0c0); P.hl(K.dx - 6, K.baseY - 40, K.dw + 12, 0xf0ece0);
      for (let i = 0; i < K.dw + 12; i++) { const t = Math.abs(i - (K.dw + 12) / 2) / ((K.dw + 12) / 2); P.rect(K.dx - 6 + i, K.baseY - 40 - Math.round((1 - t * t) * 6), 1, Math.round((1 - t * t) * 6), 0xd8d0c0); }
      P.vl(K.dx - 6, K.baseY - 28, 28, 0xc8c0b0); P.vl(K.dx + K.dw + 5, K.baseY - 28, 28, 0xa89e8c);
      for (const lx of [K.dx - 12, K.dx + K.dw + 9]) { P.rect(lx, K.baseY - 30, 4, 6, 0x2a2a30); P.rect(lx + 1, K.baseY - 29, 2, 4, K.night ? 0xffe8a0 : 0xd8e0e0); P.px(lx + 1, K.baseY - 31, 0x3a3a44); if (K.night) K.lit.push([lx + 1 + K.box.x, K.baseY - 29 + K.box.y, 2, 4]); }
      // skiffertak med takryttare, anslagstavla med gudstjänsttider
      P.rect(K.fx0 + 10, K.baseY - 22, 16, 12, 0x3a2a1a); P.rect(K.fx0 + 11, K.baseY - 21, 14, 10, 0xf4ecdc); for (let j = 0; j < 4; j++) P.hl(K.fx0 + 12, K.baseY - 19 + j * 2, 8 + (j & 1) * 3, 0x5a5a60, 0.7);
      P.rect(tx0 - 3, spire + 4, tw + 6, 1, 0x000000, 0.2);
    },
    live(ctx, b, st, m) {
      if (!m.clock) return;
      const h = st.hour % 12, a1 = h / 12 * Math.PI * 2, a2 = (st.hour % 1) * Math.PI * 2;
      ctx.fillStyle = '#2a2a30';
      for (let r = 0; r <= 3; r++) ctx.fillRect(Math.round(m.clock.x + Math.sin(a1) * r), Math.round(m.clock.y - Math.cos(a1) * r), 1, 1);
      for (let r = 0; r <= 5; r++) ctx.fillRect(Math.round(m.clock.x + Math.sin(a2) * r), Math.round(m.clock.y - Math.cos(a2) * r), 1, 1);
      ctx.fillRect(m.clock.x, m.clock.y, 1, 1);
    },
    glow(ctx, b, st, k, m) {
      if (m.clock) { ctx.fillStyle = rgba(0xfff0c0, (0.3 * k).toFixed(3)); ctx.fillRect(m.clock.x - 8, m.clock.y - 8, 17, 17); }
    },
  },
  // ================= VÅRDCENTRALEN =================
  vardcentral: {
    wall: 0xe4e8ec, wallKind: 'concrete', roof: 'flat', ground: 'shop', groundH: 34, signBg: 0xf4f7fa, signFg: 0x2a7a3a, signBorder: 0x2a7a3a, frame: 0x8a9aa8, winW: 14, winSp: 20, floorH: 24,
    extra(P, K) {
      // grönt kors (lyser på natten)
      const cx = K.fx0 + 12, cy = K.ftop + 12;
      P.rect(cx - 2, cy - 6, 5, 13, 0x2aa84a); P.rect(cx - 6, cy - 2, 13, 5, 0x2aa84a); P.rect(cx - 1, cy - 5, 3, 11, 0x5ad07a); P.rect(cx - 5, cy - 1, 11, 3, 0x5ad07a);
      K.out.cross = { x: cx + K.box.x, y: cy + K.box.y };
      // ambulansintaget: högra skyltfönstret blir en bred port med röd rand och blåljus
      const R = K.shop[1];
      if (R) {
        const x = R[0] - K.box.x, y = R[1] - K.box.y, w = R[2], h = R[3];
        K.shop.splice(1, 1);
        P.rect(x - 2, y - 2, w + 4, h + K.baseY - (y + h) + 2, 0x6a7078);
        area(P, x, y, w, K.baseY - y - 2, (X, Y, i, j) => ((j % 4) === 3 ? 0x8a9098 : jit(0xc8ccd2, X, Y, 12, 0.05)));
        P.rect(x, y + 10, w, 3, 0xd8342c); P.hl(x, y + 10, w, 0xff6a5a);
        label(P, SMALL, 'AMBULANS', x + ((w - textW(SMALL, 'AMBULANS')) >> 1), y + 16, 0xd8342c, undefined, 0x8a9098);
        P.rect(x + (w >> 1) - 4, y - 8, 8, 5, 0x2a2a30); P.rect(x + (w >> 1) - 3, y - 7, 6, 3, 0x2a6ad8);
        K.out.blue = { x: x + (w >> 1) - 3 + K.box.x, y: y - 7 + K.box.y };
        P.rect(x + w - 6, y + h - 2, 5, 2, 0x1a1a1a); P.rect(x + w - 5, y + h - 1, 3, 1, 0xd8342c); // stopplyktor på porten
      }
      // entrétak i glas över skjutdörren
      P.rect(K.dx - 8, K.baseY - 42, K.dw + 16, 3, 0x8a9aa8); P.hl(K.dx - 8, K.baseY - 42, K.dw + 16, 0xd8e0e8); P.hl(K.dx - 9, K.baseY - 39, K.dw + 18, 0x000000, 0.25);
      P.vl(K.dx - 7, K.baseY - 39, 6, 0x6a7078); P.vl(K.dx + K.dw + 6, K.baseY - 39, 6, 0x6a7078);
      // persienner i vartannat fönster, en rullstolsramp med räcke
      for (const [wx, wy, ww, wh, k, f] of winGrid(K, SPECS.vardcentral)) if (hash(k, f, K.seed + 9) > 0.45) { const n = 3 + ((hash(k, f, K.seed + 8) * (wh - 4)) | 0); for (let j = 1; j < n; j += 2) P.hl(wx + 1, wy + j, ww - 2, 0xd8dce0, 0.75); P.hl(wx + 1, wy + n, ww - 2, 0x8a9aa8, 0.6); }
      P.rect(K.fx0 + 2, K.baseY - 6, K.dx - K.fx0 - 8, 6, 0xb8bcc4); P.hl(K.fx0 + 2, K.baseY - 6, K.dx - K.fx0 - 8, 0xe0e4e8);
      for (let x = K.fx0 + 3; x < K.dx - 6; x += 5) P.vl(x, K.baseY - 12, 6, 0x6a7078); P.hl(K.fx0 + 3, K.baseY - 12, K.dx - K.fx0 - 9, 0x8a9098);
      // taket: ventilationsaggregat, helikopter-H och parabol
      P.rect(K.fx0 + 20, K.rtop + 6, 26, 10, 0xb8bcc4); P.hl(K.fx0 + 20, K.rtop + 6, 26, 0xe0e4e8); P.vl(K.fx0 + 45, K.rtop + 6, 10, 0x6a7078); for (let i = 0; i < 3; i++) P.ell(K.fx0 + 25 + i * 8, K.rtop + 11, 2.5, 2, 0x3a3e48, 1, 1);
      P.ell(K.fx1 - 30, K.rtop + 12, 12, 8, 0xd8342c, 1, 1); P.ell(K.fx1 - 30, K.rtop + 12, 10, 6, 0x7a7670, 1, 1); text(P, BIG, 'H', K.fx1 - 32, K.rtop + 9, 0xf4f1ea);
      vent(P, K.fx0 + 60, K.rtop + 12); vent(P, K.fx0 + 70, K.rtop + 12);
    },
    glow(ctx, b, st, k, m) {
      if (m.cross) { const f = 0.85 + 0.15 * Math.sin(st.t * 4); ctx.fillStyle = rgba(0x40ff70, (0.45 * k * f).toFixed(3)); ctx.fillRect(m.cross.x - 8, m.cross.y - 8, 17, 17); }
      if (m.blue && Math.floor(st.t * 3) % 2 === 0 && st.hour >= 22) { ctx.fillStyle = rgba(0x3a8aff, (0.5 * k).toFixed(3)); ctx.fillRect(m.blue.x - 6, m.blue.y - 4, 18, 10); }
    },
  },
  // ================= TORNHUSET =================
  tornhuset: {
    wall: 0x9a5a44, wallKind: 'brick', roof: 'flat', ground: 'house', balcony: true, floorH: 20, frame: 0xf0ece0, signBg: 0x2a2a2a, signFg: 0xe8e0d0, dish: true,
    extra(P, K) {
      // takvåningen: glasat burspråk med terrass, plank och krukväxter
      const y = K.ftop - 6, x0 = K.fx0 + 20, x1 = K.fx1 - 20;
      for (let j = 0; j < 12; j++) for (let i = x0; i < x1; i++) P.px(i, y - 6 + j, K.night ? qmix(0xffd88a, 0xe0a050, j / 12, i, j, 3) : mix(0x9fc3e0, 0x4e6e96, j / 12));
      P.box(x0, y - 6, x1 - x0, 12, 0x3a3a40);
      for (let i = x0; i < x1; i += 8) P.vl(i, y - 6, 12, 0x3a3a40);
      if (K.night) K.lit.push([x0 + 1 + K.box.x, y - 5 + K.box.y, x1 - x0 - 2, 10]);
      P.rect(x0 - 2, y - 8, x1 - x0 + 4, 2, 0x5a5a60); P.hl(x0 - 2, y - 8, x1 - x0 + 4, 0x8a8a90);
      area(P, K.fx0 + 4, y + 2, x1 - x0 + 32, 4, (X, Y, i) => ((i % 4) === 3 ? 0x8a6a4a : jit(0xc8a070, X, Y, 15, 0.08)));   // trätrall
      for (let i = K.fx0 + 6; i < K.fx1 - 6; i += 6) P.vl(i, y - 2, 4, 0x9a9aa0); P.hl(K.fx0 + 4, y - 2, K.fx1 - K.fx0 - 8, 0xd8d4cc);   // räcke
      for (const px of [K.fx0 + 8, K.fx1 - 14]) { P.rect(px, y - 2, 5, 4, 0xb8643a); bush(P, px + 2, y - 5, 3.5, 3, px, 0x2e6a2a, 0x4f9a3a, 0x7fc85a); }
      P.rect(K.fx0 + 26, y - 2, 8, 4, 0xd8342c); P.hl(K.fx0 + 26, y - 2, 8, 0xff8a7a); // solstol
      // hissmaskinrum, antennmast med flygvarningsljus
      P.rect(K.fx0 + 8, K.rtop + 2, 24, 10, 0x8a8a90); P.hl(K.fx0 + 8, K.rtop + 2, 24, 0xb8b8c0); P.vl(K.fx0 + 31, K.rtop + 2, 10, 0x5a5a60);
      const ax = K.fx1 - 24; P.vl(ax, K.rtop - 30, K.rtop + 4 - (K.rtop - 30), 0x9a9aa0); P.vl(ax + 1, K.rtop - 30, 34, 0x5a5a60);
      for (let j = 0; j < 30; j += 6) { P.hl(ax - 2, K.rtop - 28 + j, 5, 0x7a7a80); }
      P.rect(ax - 1, K.rtop - 33, 3, 3, 0xff3a2a);
      K.out.beacon = { x: ax + K.box.x, y: K.rtop - 32 + K.box.y };
      // entré med baldakin, porttelefon och husnummer
      P.rect(K.dx - 6, K.baseY - 36, K.dw + 12, 3, 0x3a3a40); P.hl(K.dx - 6, K.baseY - 36, K.dw + 12, 0x8a8a90); P.hl(K.dx - 7, K.baseY - 33, K.dw + 14, 0x000000, 0.3);
      P.rect(K.dx + K.dw + 4, K.baseY - 24, 6, 10, 0xb4b8c2); P.px(K.dx + K.dw + 6, K.baseY - 22, 0x3ac05a); for (let j = 0; j < 3; j++) P.hl(K.dx + K.dw + 5, K.baseY - 19 + j * 2, 3, 0x2a2e38);
      P.rect(K.dx - 14, K.baseY - 30, 8, 9, 0x1f4f9a); P.box(K.dx - 14, K.baseY - 30, 8, 9, 0xeef2f8); text(P, SMALL, '9', K.dx - 11, K.baseY - 28, WHITE);
    },
    glow(ctx, b, st, k, m) {
      if (!m.beacon) return;
      const on = Math.floor(st.t * 1.2) % 2 === 0;
      ctx.fillStyle = rgba(0xff3a2a, ((on ? 0.7 : 0.15) * k).toFixed(3)); ctx.fillRect(m.beacon.x - 3, m.beacon.y - 3, 7, 7);
      ctx.fillStyle = rgba(0xff3a2a, (on ? 1 : 0.3).toFixed(2)); ctx.fillRect(m.beacon.x, m.beacon.y, 1, 1);
    },
  },
  // ================= PIXELMACKEN =================
  bensinmack: {
    wall: 0xe8e8ec, wallKind: 'metal', roof: 'flat', ground: 'shop', signBg: 0xd8342c, signFg: 0xffffff, groundH: 30, frame: 0x5a5a60,
    extra(P, K) {
      // prisskylten (pylon) på taket
      const px = K.fx1 - 30, py = K.rtop - 34;
      P.vl(px + 9, py + 26, K.ftop - py - 26, 0x5a5a60); P.vl(px + 10, py + 26, K.ftop - py - 26, 0x9a9aa0);
      P.rect(px, py, 20, 26, 0xf4f1ea); P.box(px, py, 20, 26, 0xd8342c); P.rect(px, py, 20, 7, 0xd8342c); text(P, SMALL, 'PIX', px + 4, py + 1, WHITE);
      text(P, SMALL, '95', px + 2, py + 9, 0x1a1a1a); text(P, SMALL, '1849', px + 2, py + 15, 0x1a1a1a);
      text(P, SMALL, 'D', px + 2, py + 21, 0x1a1a1a); text(P, SMALL, '1929', px + 6, py + 21, 0x1a1a1a);
      K.out.pylon = [px + K.box.x, py + K.box.y, 20, 26];
      // kaffe- och korvskylt i fönstret, öppettider, luftpump och däckstapel vid husväggen
      P.rect(K.fx0 + 6, K.gtop + 6, 18, 8, 0x3a2a1a); text(P, SMALL, 'KAFFE', K.fx0 + 7, K.gtop + 8, 0xffe070);
      P.rect(K.dx + K.dw + 4, K.baseY - 34, 24, 8, 0xf4f1ea); P.box(K.dx + K.dw + 4, K.baseY - 34, 24, 8, 0xd8342c); text(P, SMALL, '6-23', K.dx + K.dw + 9, K.baseY - 32, 0xd8342c);
      const ax = K.fx1 - 10; P.rect(ax, K.baseY - 16, 5, 14, 0x2a5ad0); P.hl(ax, K.baseY - 16, 5, 0x7a9af0); P.rect(ax + 1, K.baseY - 14, 3, 3, 0xf4f1ea); P.vl(ax + 5, K.baseY - 10, 8, 0x1a1a1a);
      for (let j = 0; j < 3; j++) { P.rect(K.fx0 - 4, K.baseY - 4 - j * 4, 10, 4, 0x2a2a2e); P.hl(K.fx0 - 4, K.baseY - 4 - j * 4, 10, 0x4a4a50); P.rect(K.fx0 - 1, K.baseY - 3 - j * 4, 4, 2, 0x5a5a60); }
      vent(P, K.fx0 + 12, K.rtop + 6);
    },
    glow(ctx, b, st, k, m) {
      if (m.pylon) { const [x, y, w, h] = m.pylon; ctx.fillStyle = rgba(0xfff0e0, (0.35 * k).toFixed(3)); ctx.fillRect(x, y, w, h); }
    },
  },
  // ================= PARKEN =================
  kiosk: {
    wall: 0x3a6a4a, wallKind: 'wood', roof: 'flat', roofCol: 0x5a5a5a, ground: 'plain', groundH: 24, signBg: 0xf4f1ea, signFg: 0x2a4a3a, doorCol: 0x2a4a3a,
    extra(P, K) {
      // lucka med godis och tidningar, löpsedlar på väggen
      const lx = K.fx0 + 3, ly = K.baseY - 24;
      P.rect(lx, ly, 12, 12, 0x1a1a20); area(P, lx + 1, ly + 1, 10, 10, (X, Y, i, j) => (K.night ? 0xffd88a : qmix(0xa8c8e4, 0x3e5a80, j / 10, X, Y, 3)));
      for (let i = 0; i < 4; i++) P.rect(lx + 2 + i * 2, ly + 7, 1, 3, [0xd83a2a, 0xffd23f, 0x2a5ad0, 0xf05a8a][i]);
      P.rect(lx - 1, ly - 3, 14, 3, 0xd83a2a); P.hl(lx - 1, ly - 3, 14, 0xff8a7a);
      if (K.night) K.lit.push([lx + 1 + K.box.x, ly + 1 + K.box.y, 10, 10]);
      P.rect(K.fx1 - 12, ly - 2, 9, 12, 0xf4f1ea); P.box(K.fx1 - 12, ly - 2, 9, 12, 0x1a1a1a); text(P, SMALL, 'EX', K.fx1 - 11, ly, 0xd83a2a); P.hl(K.fx1 - 10, ly + 6, 5, 0x1a1a1a); P.hl(K.fx1 - 10, ly + 8, 5, 0x1a1a1a);
      P.rect(K.fx1 - 12, K.baseY - 8, 9, 8, 0x8a6a3a); for (let j = 0; j < 3; j++) P.hl(K.fx1 - 11, K.baseY - 7 + j * 2, 7, 0xf4ecdc);  // tidningsställ
      P.vl(K.fx0 + 2, K.rtop - 8, 8, 0x9a9aa0); P.rect(K.fx0 + 3, K.rtop - 8, 5, 3, 0xffd23f);
    },
  },
  toalett: {
    wall: 0x4a7a5a, wallKind: 'metal', roof: 'flat', roofCol: 0x5a6a60, ground: 'plain', groundH: 20, signBg: 0x1a3a8a, signFg: 0xffffff, doorCol: 0x3a5a4a,
    extra(P, K) {
      // piktogram, upptaget-lampa, ventilationsgaller
      const px = K.fx0 + 4, py = K.baseY - 22;
      P.rect(px, py, 6, 8, 0xf4f1ea); P.px(px + 2, py + 1, 0x1a3a8a); P.px(px + 3, py + 1, 0x1a3a8a); P.rect(px + 1, py + 3, 4, 3, 0x1a3a8a); P.px(px + 2, py + 6, 0x1a3a8a); P.px(px + 3, py + 6, 0x1a3a8a);
      P.rect(K.fx1 - 10, py, 6, 8, 0xf4f1ea); P.px(K.fx1 - 8, py + 1, 0xd83a5a); P.px(K.fx1 - 7, py + 1, 0xd83a5a); P.rect(K.fx1 - 9, py + 3, 4, 2, 0xd83a5a); P.hl(K.fx1 - 10, py + 5, 6, 0xd83a5a); P.px(K.fx1 - 8, py + 6, 0xd83a5a); P.px(K.fx1 - 7, py + 6, 0xd83a5a);
      P.px(K.dx + K.dw + 2, K.baseY - 16, 0xd83a2a); K.out.busy = { x: K.dx + K.dw + 2 + K.box.x, y: K.baseY - 16 + K.box.y };
      for (let j = 0; j < 3; j++) P.hl(K.fx0 + 4, K.ftop + 6 + j * 2, K.b.w - 8, 0x2a4a3a, 0.7);
    },
    glow(ctx, b, st, k, m) { if (m.busy) { ctx.fillStyle = rgba(0xff4a3a, (0.6 * k).toFixed(3)); ctx.fillRect(m.busy.x - 1, m.busy.y - 1, 3, 3); } },
  },
  glasskiosk: {
    wall: 0xf2b8c8, wallKind: 'plaster', roof: 'flat', roofCol: 0xe86a9a, ground: 'plain', groundH: 20, awning: 0xe86a9a, signBg: 0xffffff, signFg: 0xe8446a,
    extra(P, K) {
      // jättestrut på taket, glasslucka, prislista
      const cx = K.fx0 + (K.b.w >> 1), cy = K.rtop - 4;
      for (let j = 0; j < 8; j++) P.hl(cx - 3 + (j >> 1), cy + j, 7 - ((j >> 1) << 1), (j & 1) ? 0xd8a860 : 0xe8c078);
      P.ell(cx - 2, cy - 3, 3, 3, 0xf05a8a, 1, 1); P.ell(cx + 2, cy - 3, 3, 3, 0xf4ecdc, 1, 1); P.ell(cx, cy - 6, 3, 3, 0x7a4424, 1, 1); P.px(cx, cy - 8, 0xd8303a);
      const lx = K.dx + K.dw + 2, ly = K.baseY - 22;
      if (lx + 10 < K.fx1) { P.rect(lx, ly, 8, 10, 0x1a1a20); area(P, lx + 1, ly + 1, 6, 8, (X, Y, i, j) => (K.night ? 0xffd88a : qmix(0xa8c8e4, 0x3e5a80, j / 8, X, Y, 3))); if (K.night) K.lit.push([lx + 1 + K.box.x, ly + 1 + K.box.y, 6, 8]); }
      P.rect(K.fx0 + 2, K.baseY - 14, 10, 12, 0xf4f1ea); P.box(K.fx0 + 2, K.baseY - 14, 10, 12, 0xe8446a); for (let j = 0; j < 3; j++) { P.px(K.fx0 + 4, K.baseY - 12 + j * 3, [0xf05a8a, 0x7a4424, 0xffd23f][j]); P.hl(K.fx0 + 6, K.baseY - 12 + j * 3, 4, 0xe8446a, 0.7); }
    },
  },
  lekforrad: {
    wall: 0xa8743a, wallKind: 'wood', roof: 'gable', roofCol: 0x6a3a2a, ground: 'plain', groundH: 18, signBg: 0xffd23f, signFg: 0x3a2a1a, doorCol: 0x7a4a2a,
    extra(P, K) {
      // hänglås, boll och hink vid väggen, skateboard som lutar
      P.rect(K.dx + K.dw - 6, K.baseY - 12, 4, 4, 0xe8c040); P.px(K.dx + K.dw - 5, K.baseY - 13, 0x8a8a90); P.px(K.dx + K.dw - 4, K.baseY - 13, 0x8a8a90); P.px(K.dx + K.dw - 4, K.baseY - 11, 0x1a1a1a);
      P.ell(K.fx0 + 4, K.baseY - 3, 3, 3, 0xd83a2a, 1, 1); P.px(K.fx0 + 3, K.baseY - 4, 0xf4f1ea); P.px(K.fx0 + 5, K.baseY - 2, 0xf4f1ea);
      P.rect(K.fx1 - 8, K.baseY - 6, 5, 6, 0x2a8ad8); P.hl(K.fx1 - 9, K.baseY - 7, 7, 0x60b0f0);
      P.line(K.fx1 - 4, K.baseY - 1, K.fx1 + 2, K.baseY - 16, 0xd8a040); P.px(K.fx1 - 3, K.baseY - 3, 0x2a2a2a); P.px(K.fx1, K.baseY - 12, 0x2a2a2a);
    },
  },
  paviljong: {
    wall: 0xf4f1ea, wallKind: 'wood', roof: 'gable', roofCol: 0x3a7a68, ground: 'plain', groundH: 30, signBg: 0x3a7a68, signFg: 0xf4f1ea,
    extra(P, K) {
      // öppen paviljong: vita kolonner, räcke, scen med notställ och vimplar
      const w = K.b.w;
      for (let x = K.fx0 + 4; x < K.fx1 - 4; x += 16) { P.rect(x, K.ftop + 4, 4, K.baseY - K.ftop - 6, 0xf4f1ea); P.vl(x, K.ftop + 4, K.baseY - K.ftop - 6, WHITE); P.vl(x + 3, K.ftop + 4, K.baseY - K.ftop - 6, 0xb8b0a0); P.rect(x - 1, K.ftop + 4, 6, 2, 0xe8e0d0); P.rect(x - 1, K.baseY - 4, 6, 2, 0xd8d0c0); }
      for (let x = K.fx0 + 8; x < K.fx1 - 8; x++) { if (x >= K.dx - 2 && x < K.dx + K.dw + 2) continue; P.px(x, K.baseY - 12, 0xf4f1ea); if ((x & 3) === 0) P.vl(x, K.baseY - 11, 8, 0xe8e0d0); P.px(x, K.baseY - 3, 0xd8d0c0); }
      for (let i = 0; i < 3; i++) { const nx = K.fx0 + 14 + i * 22; if (Math.abs(nx - (K.dx + K.dw / 2)) < 16) continue; P.vl(nx, K.baseY - 22, 10, 0x2a2a30); P.rect(nx - 3, K.baseY - 25, 7, 4, 0x2a2a30); P.hl(nx - 2, K.baseY - 24, 5, 0xf4f1ea, 0.6); }
      P.px(K.fx0 + (w >> 1), K.rtop - 6, 0xe8c040); P.vl(K.fx0 + (w >> 1), K.rtop - 5, 5, 0xe8c040);
      K.out.bunting = { x0: K.fx0 - 2 + K.box.x, x1: K.fx1 + 2 + K.box.x, y: K.ftop + 2 + K.box.y };
      P.rect(K.fx0 + 6, K.rtop + 4, 5, 5, 0x1a1a20); P.rect(K.fx0 + 7, K.rtop + 5, 3, 3, K.night ? 0xffe8a0 : 0xd8e0e0);
    },
    live(ctx, b, st, m) {
      if (!m.bunting) return;
      const { x0, x1, y } = m.bunting, wnd = clamp((st.env?.weather?.wind || 3) / 25, 0.15, 1);
      for (let x = x0, i = 0; x < x1; x += 5, i++) {
        const dy = Math.round(Math.sin(st.t * 5 + i * 0.8) * 1.5 * wnd) + Math.round(Math.sin((x - x0) / (x1 - x0) * Math.PI) * 2);
        ctx.fillStyle = rgb([0xe8443a, 0x3a9bff, 0xffd23f, 0x6fdc4c, 0xf4f1ea][i % 5]);
        ctx.fillRect(x, y + dy, 3, 2); ctx.fillRect(x + 1, y + dy + 2, 1, 1);
      }
      ctx.fillStyle = '#5a5048'; ctx.fillRect(x0, y - 1, x1 - x0, 1);
    },
  },
};

// ---------------------------------------------------------------------
// Bensinmacken: pumparna och taket ritas som egna y-sorterade föremål så att
// man kan gå in under taket och mellan pumparna. Taket cachas per snö.
// ---------------------------------------------------------------------
const MACK = { pump: null, roof: {} };
function pumpImg() {
  if (MACK.pump) return MACK.pump;
  const P = new Pix(18, 30);
  P.rect(2, 26, 14, 4, 0x6a6a70); P.hl(2, 26, 14, 0x9a9aa0); P.hl(2, 29, 14, 0x3a3a40);              // pumpön
  P.rect(3, 4, 12, 22, 0xd8342c); P.vl(3, 4, 22, 0xff7a6a); P.vl(14, 4, 22, 0x8a1a14); P.hl(3, 4, 12, 0xff8a7a);
  P.rect(5, 7, 8, 6, 0xf4f1ea); P.box(5, 7, 8, 6, 0x1a1a1a); P.rect(6, 8, 6, 1, 0x1a1a1a); P.rect(6, 10, 4, 1, 0x1a1a1a);
  P.rect(5, 15, 8, 3, 0x2a2a2a); P.px(6, 16, 0x6fdc4c); P.px(8, 16, 0xffd23f);
  P.rect(15, 10, 2, 8, 0x2a2a2a); P.vl(16, 18, 6, 0x1a1a1a); P.rect(15, 23, 3, 2, 0x4a4a50);           // slang och munstycke
  P.rect(1, 12, 2, 8, 0x2a2a2a); P.vl(1, 20, 5, 0x1a1a1a);
  P.hl(3, 25, 12, 0x000000, 0.3);
  return (MACK.pump = P.flush());
}
function roofImg(b, snow) {
  const k = snow ? 's' : 'n';
  if (MACK.roof[k]) return MACK.roof[k];
  const w = b.w + 8, P = new Pix(w, 14);
  area(P, 0, 0, w, 8, (X, Y, i, j) => jit(j === 0 ? 0xf4f4f8 : 0xe8e8ee, X, Y, 61, 0.05));
  P.rect(0, 8, w, 5, 0xd8342c); P.hl(0, 8, w, WHITE); P.hl(0, 12, w, 0x8a1a14);
  const s = 'PIXELMACKEN', tw = textW(SMALL, s); text(P, SMALL, s, (w - tw) >> 1, 8, WHITE);
  for (let i = 6; i < w - 6; i += 12) P.rect(i, 13, 3, 1, 0xfff0c0);                                 // lampor under taket
  if (snow) area(P, 0, 0, w, 7, (X, Y, i, j) => (hash(X, Y, 91) > 0.12 ? (hash(X, Y, 92) > 0.8 ? WHITE : 0xe8eef6) : null));
  return (MACK.roof[k] = P.flush());
}
function mackItems(b, st) {
  const out = [], pump = pumpImg();
  for (const [x0, , x1, y1] of b.blocks) out.push({ y: y1, draw: (ctx) => ctx.drawImage(pump, x0 + ((x1 - x0 - 18) >> 1), y1 - 30) });
  out.push({ y: b.frontY, draw: (ctx) => {
    const snow = (st.env?.weather?.snowCover || 0) > 0.5, img = roofImg(b, snow), y = b.base - 50;
    ctx.fillStyle = '#b8b8c0'; ctx.fillRect(b.x + 10, y + 12, 2, 58); ctx.fillRect(b.x + b.w - 12, y + 12, 2, 58);   // pelare
    ctx.fillStyle = '#7a7a84'; ctx.fillRect(b.x + 11, y + 12, 1, 58); ctx.fillRect(b.x + b.w - 11, y + 12, 1, 58);
    ctx.drawImage(img, b.x - 4, y);
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(b.x - 4, y + 14, img.width, 1);
  } });
  return out;
}
function mackGlow(ctx, b, st) {
  const k = clamp((st.env?.dark ?? 0) / 0.5, 0, 1);
  if (k <= 0) return;
  ctx.globalCompositeOperation = 'lighter';
  const y = b.base - 50 + 13;
  for (let i = 6; i < b.w + 2; i += 12) { ctx.fillStyle = rgba(0xfff0c0, (0.5 * k).toFixed(3)); ctx.fillRect(b.x - 4 + i - 1, y - 1, 5, 3); ctx.fillStyle = rgba(0xffe8b0, (0.08 * k).toFixed(3)); ctx.fillRect(b.x - 4 + i - 8, y + 2, 19, 40); }
  ctx.fillStyle = rgba(0xffe8c0, (0.12 * k).toFixed(3)); ctx.fillRect(b.x, b.base + 4, b.w, 36);   // ljus över hela förgården
  ctx.globalCompositeOperation = 'source-over';
}

export const BUILDING_ART = Object.fromEntries(Object.entries(SPECS).map(([k, spec]) => {
  const art = makeArt(spec);
  if (k === 'bensinmack') { art.items = (b, st) => mackItems(b, st); const g = art.glow; art.glow = (ctx, b, st) => { g(ctx, b, st); mackGlow(ctx, b, st); }; }
  if (spec.items) art.items = (b, st) => spec.items(b, st);
  return [k, art];
}));
