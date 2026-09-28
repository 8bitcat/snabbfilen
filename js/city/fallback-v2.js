// PLATSHÅLLARE för kartkontrakt v2 – det som de riktiga modulerna inte målar
// ännu. Scenen kopplar in varje del bara tills modulen exporterar
// `export const V2 = true` (se docs/STADEN.md):
//   ground:  marken i v2-zonerna (Infarten, Södergatan, kajen, kanalen, förortens
//            norra rad och tomter, gränderna i södra raden) läggs OVANPÅ ground.js
//            bild med paintGround(canvas, night).
//   props:   busskurer för de nya hållplatserna (inkl. den trasiga), staket och
//            grindar runt tomterna, gravstenar, containrar, hundrastgårdens staket.
//   traffic: trafikljusstolpar längs Södergatan (stillastående).
// Allt här är medvetet enkelt – specialisterna gör det rikt. Ta bort varje del
// ur den här filen när den riktiga modulen har satt V2 (då körs den inte ändå).
import { Pix, mix, mul, hash, bayer, SMALL, text } from '../core/floor-pix.js';
import { CITY, BUILDINGS_S, BUILDINGS_X, LOTS, STREETS_S, STREETS_X, CROSSWALKS_S, CROSSWALKS_I, LIGHTS_S, BUS_STOPS,
  LANES_I, PARK_LAYOUT, SUB_LAYOUT, footprint, gateRect } from './map.js';

const W = CITY.W, H = CITY.H;
const WHITE = 0xffffff;
const grain = (c, x, y, s, a = 0.06) => { const n = (hash(x, y, s) - 0.5) * a + (bayer(x, y) - 0.5) * a * 0.4; return n >= 0 ? mix(c, WHITE, n) : mix(c, 0, -n); };

// ---------- ytor ----------
const asphalt = (x, y, worn = 0) => {
  let c = grain(0x5c5a56, x, y, 201, 0.07);
  if (worn && hash(x >> 2, y >> 2, 202) > 1 - 0.08 * worn) c = mix(c, 0x3e3c38, 0.5);            // lagade fläckar
  if (worn && hash(x, y, 203) > 0.995) c = 0x8a8680;                                                // grus
  return c;
};
const paving = (x, y, worn = 0) => {
  const px = ((x % 8) + 8) % 8, py = ((y % 8) + 8) % 8, id = hash(x >> 3, y >> 3, 210);
  if (px === 7 || py === 7) return 0x8e8a82;
  let c = mix(0xbdb7ab, id > 0.5 ? 0xc8c2b6 : 0xb2ac9e, id);
  if (px === 0 || py === 0) c = mix(c, WHITE, 0.1);
  if (worn && id > 1 - 0.15 * worn) c = mul(c, 0.82);                                               // sprucken platta
  return grain(c, x, y, 211, 0.05);
};
const cobble = (x, y) => {
  const cx = Math.floor((x + (Math.floor(y / 5) & 1) * 3) / 6), cy = Math.floor(y / 5), rx = ((x + (cy & 1) * 3) % 6 + 6) % 6, ry = ((y % 5) + 5) % 5;
  if (rx === 5 || ry === 4) return 0x4e4a44;
  let c = mix(0x7a746a, 0x8e887c, hash(cx, cy, 220));
  if (ry === 0) c = mix(c, WHITE, 0.12); else if (ry === 3) c = mul(c, 0.86);
  return grain(c, x, y, 221, 0.05);
};
const dirt = (x, y) => { let c = grain(mix(0x7c705f, 0x8e826c, hash(x >> 2, y >> 2, 230)), x, y, 231, 0.08); if (hash(x, y, 232) > 0.94) c = 0x5e7a3c; return c; };
const gravel = (x, y) => { const h = hash(x, y, 240); return h > 0.9 ? 0xd0c8b8 : h < 0.08 ? 0x8a8478 : grain(0xb4ab9a, x, y, 241, 0.06); };
const sand = (x, y) => grain(hash(x >> 1, y >> 1, 250) > 0.85 ? 0xc8b890 : 0xdccca0, x, y, 251, 0.05);
const concrete = (x, y) => { const j = ((x % 24) + 24) % 24 === 23 || ((y % 16) + 16) % 16 === 15; return j ? 0x8a8884 : grain(0xa8a6a0, x, y, 260, 0.05); };
const water = (x, y, night) => {
  const d = (y - CITY.CANAL[0]) / (H - CITY.CANAL[0]);
  let c = mix(night ? 0x1a2e4a : 0x2e6090, night ? 0x0c1628 : 0x1c3c62, d);
  const w = hash(x >> 3, y, 270);
  if (w > 0.86 && (y & 1)) c = mix(c, night ? 0x6a86a8 : 0x9ac0e0, 0.5);                            // ljusglimtar på ytan
  return grain(c, x, y, 271, 0.04);
};
const grass = (x, y) => grain(mix(0x4f8a34, 0x5f9a3c, hash(x >> 1, y >> 1, 280)), x, y, 281, 0.07);

// ---------- marken ----------
function fill(P, r, fn) { for (let y = r[1]; y < r[3]; y++) for (let x = r[0]; x < r[2]; x++) P.px(x, y, fn(x, y)); }
function zebra(P, x0, x1, y0, y1, axis) {
  // vita ränder 4 px breda med 4 px mellanrum, tvärs över vägen
  if (axis === 'x') { for (let x = x0 + 3; x < x1 - 3; x += 8) for (let y = y0 + 3; y < y1 - 3; y++) for (let i = 0; i < 4; i++) P.px(x + i, y, grain(0xe4e0d4, x + i, y, 290, 0.06)); }
  else { for (let y = y0 + 3; y < y1 - 3; y += 8) for (let x = x0 + 3; x < x1 - 3; x++) for (let i = 0; i < 4; i++) P.px(x, y + i, grain(0xe4e0d4, x, y + i, 290, 0.06)); }
}
function roadX(P, y0, y1, worn) {
  fill(P, [0, y0, W, y1], (x, y) => asphalt(x, y, worn));
  for (let x = 0; x < W; x++) {
    P.px(x, y0 + 1, 0xd8d4c8, 0.6); P.px(x, y1 - 2, 0xd8d4c8, 0.6);                                 // kantlinjer
    if ((x % 24) < 14) { const my = (y0 + y1) >> 1; P.px(x, my - 1, 0xe8e4d8, 0.75); P.px(x, my, 0xe8e4d8, 0.75); } // mittlinje
  }
  // hjulspår: lite blankare band
  for (const ly of [y0 + 14, y0 + 22, y1 - 22, y1 - 14]) for (let x = 0; x < W; x++) if (hash(x, ly, 300) > 0.4) P.px(x, ly, 0x6a6864, 0.35);
}
function roadY(P, x0, x1, y0, y1) {
  fill(P, [x0, y0, x1, y1], (x, y) => asphalt(x, y, 0.4));
  for (let y = y0; y < y1; y++) {
    P.px(x0 + 1, y, 0xd8d4c8, 0.6); P.px(x1 - 2, y, 0xd8d4c8, 0.6);
    if ((y % 24) < 14) { const mx = (x0 + x1) >> 1; P.px(mx - 1, y, 0xe8e4d8, 0.75); P.px(mx, y, 0xe8e4d8, 0.75); }
  }
}
function sidewalk(P, y0, y1, worn, curbAtTop) {
  fill(P, [0, y0, W, y1], (x, y) => paving(x, y, worn));
  const cy = curbAtTop ? y0 : y1 - 2;
  for (let x = 0; x < W; x++) { P.px(x, cy, 0xd8d4c8); P.px(x, cy + 1, 0x6e6a62); }              // kantstenen
}
function fence(P, r, gates, lot, kind) {
  // staketet målas i marken (fram­sidan ritas som föremål av items så figuren kan stå framför)
  const [x0, y0, x1, y1] = r, open = (x, y) => gates.some((g) => { const gr = gateRect(lot, g); return x >= gr[0] && x < gr[2] && y >= gr[1] && y < gr[3]; });
  const post = kind === 'mur' ? 0x8a8478 : 0x4a4a48, wire = kind === 'mur' ? 0xa8a296 : 0x8a8a88;
  for (let x = x0; x < x1; x++) if (!open(x, y0)) { P.px(x, y0 - 1, wire, 0.9); P.px(x, y0 - 3, wire, 0.6); if (x % 12 === 0) for (let k = 0; k < 8; k++) P.px(x, y0 - 8 + k, post); }
  for (const x of [x0, x1 - 1]) for (let y = y0; y < y1; y++) if (!open(x, y)) { P.px(x, y, y % 12 === 0 ? post : wire, y % 3 === 1 ? 0.5 : 0.9); }
}

export function createFallback(env, need = { ground: true, props: true, traffic: true }) {
  const items = [], obstacles = [], glows = [];
  const spr = (w, h, ox, oy, paint) => { const P = new Pix(w, h); paint(P); return { cv: P.flush(), ox, oy }; };
  const put = (ctx, s, x, y) => ctx.drawImage(s.cv, x - s.ox, y - s.oy);
  const item = (x, y, s, obs = []) => { items.push({ x, y, draw: (ctx) => put(ctx, s, x, y) }); for (const o of obs) obstacles.push(o); };

  // =================== rekvisita ===================
  if (need.props) {
    // busskurer (v1-kuren vid Pixeltorget ritar props.js själv)
    for (const s of BUS_STOPS.slice(1)) {
      const br = !!s.broken, bx = s.x, by = s.y;
      const back = spr(72, 30, 36, 26, (P) => {
        // bakvägg: tre glasrutor mellan stolpar, tak­kant överst
        for (let k = 0; k < 3; k++) {
          const x = 4 + k * 22;
          for (let j = 0; j < 20; j++) for (let i = 0; i < 20; i++) {
            let c = mix(0xa8c8e0, 0x4e6e96, j / 20);
            if (((i * 2 - j * 3) % 26 + 26) % 26 < 3) c = mix(c, WHITE, 0.3);
            if (br && k === 1) { if (hash(i, j, 310) > 0.55) continue; c = mul(c, 0.8); }     // krossad ruta
            P.px(x + i, 4 + j, c, br && k === 1 ? 0.8 : 0.9);
          }
          if (br) for (let l = 0; l < 4; l++) P.line(x + 10, 12, x + 2 + l * 5, 4 + (l % 2) * 18, 0x0a0c12, 0.8);
        }
        for (const x of [2, 24, 46, 68]) for (let j = 0; j < 22; j++) P.px(x, 3 + j, j === 21 ? 0x2a2a2e : 0x6a6e78);
        P.rect(0, 0, 72, 3, br ? 0x5a5a58 : 0x3a5a7a); P.hl(0, 0, 72, mix(br ? 0x5a5a58 : 0x3a5a7a, WHITE, 0.3));
        if (br) { text(P, SMALL, 'BTG', 28, 8, 0xe8443a); text(P, SMALL, 'ZOK', 50, 14, 0x3a9bff); }
        // bänken
        if (!br) { P.rect(8, 20, 30, 3, 0x8a6a3a); P.hl(8, 20, 30, 0xb08a4a); P.vl(9, 23, 3, 0x3a3a3a); P.vl(36, 23, 3, 0x3a3a3a); }
        else { P.rect(8, 22, 12, 2, 0x8a6a3a); P.vl(9, 24, 2, 0x3a3a3a); }                   // bara en stump kvar
      });
      const roof = spr(76, 20, 38, 16, (P) => {
        const c = br ? 0x6a6a68 : 0x4a6a8a;
        P.rect(0, 0, 76, 6, c); P.hl(0, 0, 76, mix(c, WHITE, 0.3)); P.hl(0, 5, 76, mul(c, 0.6)); P.hl(0, 6, 76, 0x000000, 0.25);
        if (br) { P.erase(30, 0, 14, 6); P.rect(30, 0, 14, 1, 0x3a3a38); }                    // hål i taket
        for (const x of [1, 73]) for (let j = 0; j < 14; j++) P.px(x, 3 + j, j === 13 ? 0x2a2a2e : 0x6a6e78);
      });
      const sign = spr(12, 30, 6, 29, (P) => {
        P.vl(6, 6, 24, 0x4a4a48);
        if (br) { P.line(6, 6, 9, 0, 0x4a4a48); P.rect(4, 0, 8, 6, 0x9a9a98); P.line(4, 0, 11, 5, 0xe8443a); }
        else { P.rect(1, 0, 10, 8, 0x1a4a9a); P.box(1, 0, 10, 8, 0xf4f1ea); text(P, SMALL, 'B', 4, 2, 0xf4f1ea); }
      });
      item(bx, by - 17, back, [[bx - 32, by - 21, bx + 33, by - 17], ...(br ? [] : [[bx - 27, by - 16, bx + 4, by - 12]])]);
      item(bx, by - 4, roof, [[bx - 34, by - 7, bx - 30, by - 3], [bx + 30, by - 7, bx + 34, by - 3]]);
      item(bx + 46, by, sign, [[bx + 45, by - 2, bx + 48, by + 1]]);
      const glow = spr(60, 30, 30, 26, (P) => P.ell(30, 20, 28, 8, br ? 0xffb090 : 0xffe4b0, 0.35, 4));
      glows.push({ x: bx, y: by - 14, s: glow, broken: br });
    }
    // tomternas staket: framsidan (södra kanten) som föremål så att man kan stå framför
    for (const l of LOTS) {
      if (!l.fence) continue;
      const [x0, y0, x1, y1] = l.rect, gates = l.gates || [], mur = l.kind === 'kyrkogard';
      const openS = (x) => gates.some((g) => g.side === 's' && x >= g.x0 && x < g.x1);
      const front = spr(x1 - x0, 12, 0, 11, (P) => {
        for (let x = 0; x < x1 - x0; x++) {
          if (openS(x0 + x)) continue;
          if (mur) { for (let j = 0; j < 8; j++) P.px(x, 4 + j, grain(j === 0 ? 0xb0aa9e : ((x + j * 3) % 7 === 0 ? 0x6e6a62 : 0x8e8a80), x, j, 320, 0.08)); }
          else { P.px(x, 4, 0x8a8a88, 0.9); P.px(x, 7, 0x8a8a88, 0.7); P.px(x, 10, 0x8a8a88, 0.7); if (x % 12 === 0) for (let j = 0; j < 12; j++) P.px(x, j, j === 11 ? 0x2a2a2e : 0x4a4a48); }
        }
      });
      items.push({ x: (x0 + x1) / 2, y: y1, draw: (ctx) => put(ctx, front, x0, y1) });
      // hinder: alla fyra sidor utom grindarna
      const segs = [];
      const side = (a, b, vertical, fixed) => {
        let s = a;
        const holes = gates.filter((g) => (vertical ? (g.side === 'w' && fixed === x0) || (g.side === 'e' && fixed === x1 - 1) : (g.side === 'n' && fixed === y0) || (g.side === 's' && fixed === y1 - 1)))
          .map((g) => (vertical ? [g.y0, g.y1] : [g.x0, g.x1])).sort((p, q) => p[0] - q[0]);
        for (const [h0, h1] of holes) { if (h0 > s) segs.push(vertical ? [fixed, s, fixed + 1, h0] : [s, fixed, h0, fixed + 1]); s = Math.max(s, h1); }
        if (b > s) segs.push(vertical ? [fixed, s, fixed + 1, b] : [s, fixed, b, fixed + 1]);
      };
      side(x0, x1, false, y0); side(x0, x1, false, y1 - 1); side(y0, y1, true, x0); side(y0, y1, true, x1 - 1);
      for (const s of segs) obstacles.push(s);
    }
    // hundrastgårdens staket (grinden i norr)
    {
      const [x0, y0, x1, y1] = PARK_LAYOUT.dogPark, [g0, g1] = PARK_LAYOUT.dogGate;
      const front = spr(x1 - x0, 10, 0, 9, (P) => { for (let x = 0; x < x1 - x0; x++) { P.px(x, 3, 0x6a6a68, 0.9); P.px(x, 6, 0x6a6a68, 0.7); if (x % 10 === 0) for (let j = 0; j < 10; j++) P.px(x, j, 0x4a4a48); } });
      items.push({ x: (x0 + x1) / 2, y: y1, draw: (ctx) => put(ctx, front, x0, y1) });
      obstacles.push([x0, y0, g0, y0 + 1], [g1, y0, x1, y0 + 1], [x0, y1 - 1, x1, y1], [x0, y0, x0 + 1, y1], [x1 - 1, y0, x1, y1]);
    }
    // gravstenar på kyrkogården
    const ky = LOTS.find((l) => l.id === 'kyrkogard');
    if (ky) {
      const stone = spr(10, 14, 5, 13, (P) => { P.rect(1, 2, 8, 11, 0x8e8a82); P.hl(2, 1, 6, 0x8e8a82); P.hl(2, 2, 6, 0xb0aca4); P.vl(1, 3, 10, 0xa8a49c); P.vl(8, 3, 10, 0x5e5a54); P.rect(0, 12, 10, 2, 0x6a665e); P.px(4, 5, 0x5e5a54); P.px(5, 5, 0x5e5a54); P.px(4, 7, 0x5e5a54); P.px(5, 7, 0x5e5a54); });
      const [x0, y0, x1, y1] = ky.rect;
      for (let r = 0; r < 3; r++) for (let k = 0; k < 7; k++) {
        const x = x0 + 18 + k * 28 + ((hash(r, k, 330) * 6) | 0), y = y0 + 30 + r * 36 + ((hash(r, k, 331) * 6) | 0);
        if (Math.abs(x - 1106) < 12 || Math.abs(x - 1050) < 12 || x > x1 - 10 || y > y1 - 10) continue;      // inte på gångarna
        item(x, y, stone, [[x - 4, y - 3, x + 5, y + 1]]);
      }
    }
    // containrar på återvinningen
    const av = LOTS.find((l) => l.id === 'atervinning');
    if (av) {
      const cont = (col) => spr(30, 26, 15, 25, (P) => { P.rect(1, 6, 28, 19, col); P.hl(1, 6, 28, mix(col, WHITE, 0.3)); P.rect(1, 22, 28, 3, mul(col, 0.7)); P.rect(0, 25, 30, 1, 0x2a2a2a); for (let j = 8; j < 22; j += 4) P.hl(2, j, 26, mul(col, 0.85)); P.rect(10, 2, 10, 5, 0x1a1a1a); P.rect(11, 3, 8, 3, mul(col, 0.5)); P.rect(4, 12, 6, 6, 0xf4f1ea, 0.8); });
      const cols = [0x3a7a3a, 0x2a5a9a, 0xc8a02a];
      cols.forEach((c, k) => { const x = av.rect[0] + 18 + k * 32, y = av.rect[1] + 60; item(x, y, cont(c), [[x - 14, y - 12, x + 15, y]]); });
    }
    // lekplatsen i förorten: en gunga med bara en sits och en rutschkana
    const lk = LOTS.find((l) => l.id === 'lekplats_x');
    if (lk) {
      const [x0, y0] = lk.rect;
      const swing = spr(40, 30, 20, 29, (P) => { P.line(2, 28, 10, 2, 0x8a6a3a); P.line(38, 28, 30, 2, 0x8a6a3a); P.hl(9, 1, 22, 0x6a4a2a); P.hl(9, 2, 22, 0x8a6a3a); P.vl(15, 3, 18, 0x6a6a68); P.vl(19, 3, 18, 0x6a6a68); P.rect(13, 21, 8, 2, 0x3a3a3a); P.vl(26, 3, 6, 0x6a6a68); });
      const slide = spr(30, 30, 15, 29, (P) => { P.rect(20, 4, 8, 24, 0xc8442a); P.hl(20, 4, 8, 0xe86a4a); P.vl(20, 5, 23, 0x8a2a1a); for (let j = 0; j < 24; j += 3) P.hl(21, 5 + j, 6, 0xa83a22); P.line(2, 28, 20, 8, 0xb0b0b0); P.line(3, 28, 21, 8, 0xd8d8d8); P.line(2, 22, 8, 22, 0x6a6a68); });
      item(x0 + 40, y0 + 60, swing, [[x0 + 22, y0 + 56, x0 + 58, y0 + 61]]);
      item(x0 + 100, y0 + 70, slide, [[x0 + 88, y0 + 62, x0 + 114, y0 + 71]]);
    }
  }
  // =================== trafikljus på Södergatan (stillastående) ===================
  if (need.traffic) {
    const pole = spr(8, 34, 4, 33, (P) => { P.vl(3, 6, 28, 0x3a3a3e); P.vl(4, 6, 28, 0x2a2a2e); P.rect(1, 0, 6, 12, 0x1e1e22); P.rect(2, 1, 4, 3, 0xd83a2a); P.rect(2, 5, 4, 3, 0x6a5a1a); P.rect(2, 9, 4, 2, 0x2a6a2a); P.rect(0, 32, 8, 2, 0x3a3a3e); });
    for (const l of LIGHTS_S) item(l.x, l.y, pole, [[l.x - 3, l.y - 2, l.x + 4, l.y + 1]]);
  }

  return {
    obstacles,
    items: () => items,
    update() {},
    glow(ctx, view) {
      const k = Math.max(0, Math.min(1, (env.dark - 0.1) / 0.28));
      if (k <= 0) return;
      ctx.globalCompositeOperation = 'lighter';
      for (const g of glows) {
        if (view && (g.x < view.x - 60 || g.x > view.x + view.w + 60 || g.y < view.y - 60 || g.y > view.y + view.h + 60)) continue;
        const flick = g.broken ? (Math.sin(env.t * 11) + Math.sin(env.t * 4.3) > 0.4 ? 1 : 0.15) : 1;
        ctx.globalAlpha = 0.8 * k * flick; put(ctx, g.s, g.x, g.y);
      }
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    },
    // ---------- marken ----------
    paintGround(canvas, night) {
      if (!need.ground) return;
      const P = new Pix(W, H);
      const XC = CITY.X_CITY, [I0, I1] = CITY.INFARTEN, XS = CITY.X_SUB;
      // förortens norra rad: sliten asfalt bakom husen, packad jord under fotavtrycken, tomten
      fill(P, [XS, CITY.BACK[1], W, CITY.BASE], (x, y) => asphalt(x, y, 1));
      for (const b of BUILDINGS_X.filter((b) => b.row === 'n')) fill(P, footprint(b), (x, y) => mul(dirt(x, y), 0.72));
      for (const s of STREETS_X.filter((s) => s.row === 'n' && s.kind === 'alley')) fill(P, [s.x0, s.y0, s.x1, s.y1], (x, y) => (hash(x >> 1, y >> 1, 340) > 0.9 ? 0x3a3c40 : cobble(x, y)));
      // Infarten: gågata norr om Pixelgatan, väg söder om den
      fill(P, [I0, CITY.BACK[1], I1, CITY.BASE], (x, y) => paving(x, y, 0.3));
      roadY(P, I0, I1, CITY.ROAD[1], CITY.ROAD_S[0]);
      for (const c of CROSSWALKS_I) zebra(P, c.x0, c.x1, c.y0, c.y1, 'y');
      for (const l of LANES_I) for (let y = CITY.ROAD[1]; y < CITY.ROAD_S[0]; y++) if (hash(l.x, y, 341) > 0.5) P.px(l.x, y, 0x6a6864, 0.35);
      // förortens mellanband: parkering, lekplats, grusplan
      for (const l of LOTS) {
        const r = l.rect;
        if (l.kind === 'parkering') {
          fill(P, r, (x, y) => asphalt(x, y, 0.7));
          for (let x = r[0] + 12; x < r[2] - 12; x += 26) for (let y = r[1] + 6; y < r[1] + 44; y++) P.px(x, y, 0xd8d4c8, 0.6);
          for (let x = r[0] + 12; x < r[2] - 12; x += 26) for (let y = r[3] - 44; y < r[3] - 6; y++) P.px(x, y, 0xd8d4c8, 0.6);
          if (l.drive) fill(P, [l.drive[0], CITY.SIDEWALK_S[0], l.drive[1], r[1]], (x, y) => asphalt(x, y, 0.5));
        } else if (l.kind === 'lekplats_x') fill(P, r, (x, y) => (hash(x >> 3, y >> 3, 342) > 0.85 ? grass(x, y) : sand(x, y)));
        else if (l.kind === 'grusplan') {
          fill(P, r, gravel);
          const mx = (r[0] + r[2]) >> 1;
          for (let y = r[1] + 4; y < r[3] - 4; y++) { P.px(mx, y, 0xe8e4d8, 0.35); P.px(r[0] + 4, y, 0xe8e4d8, 0.35); P.px(r[2] - 5, y, 0xe8e4d8, 0.35); }
          for (let x = r[0] + 4; x < r[2] - 4; x++) { P.px(x, r[1] + 4, 0xe8e4d8, 0.35); P.px(x, r[3] - 5, 0xe8e4d8, 0.35); }
        } else if (l.kind === 'tomten') fill(P, r, dirt);
        else if (l.kind === 'atervinning') fill(P, r, (x, y) => asphalt(x, y, 0.8));
        else if (l.kind === 'vagnsplatsen') fill(P, r, gravel);
        else if (l.kind === 'kyrkogard') {
          fill(P, r, (x, y) => (hash(x >> 2, y >> 2, 343) > 0.93 ? mul(grass(x, y), 0.9) : grass(x, y)));
          const gx = 1096, gy = (r[1] + r[3]) >> 1;
          fill(P, [gx, r[1], gx + 20, r[3]], gravel); fill(P, [r[0] + 6, gy - 8, r[2] - 6, gy + 8], gravel); fill(P, [1040, gy, 1060, r[3]], gravel);
        }
        if (l.fence) fence(P, r, l.gates || [], l, l.kind === 'kyrkogard' ? 'mur' : 'stängsel');
      }
      // förortens gångvägar (asfalt i stället för parkens grus)
      fill(P, SUB_LAYOUT.back, (x, y) => asphalt(x, y, 0.5));
      for (const r of SUB_LAYOUT.paths) fill(P, r, (x, y) => asphalt(x, y, 0.5));
      fill(P, [I0, CITY.BACK_S[0], I1, CITY.BACK_S[1]], (x, y) => asphalt(x, y, 0.4));
      // södra raden: gränder, gågator, gårdar
      const gapsS = [...STREETS_S, ...STREETS_X.filter((s) => s.row === 's')];
      for (const s of gapsS) {
        if (s.kind === 'lot' || s.kind === 'road') continue;
        const worn = s.x0 >= XC ? 1 : 0.2;
        fill(P, [s.x0, s.y0, s.x1, s.y1], s.kind === 'street' ? (x, y) => paving(x, y, worn) : s.kind === 'edge' ? dirt : (x, y) => (hash(x >> 1, y >> 1, 344) > 0.92 && worn > 0.5 ? 0x3a3c40 : cobble(x, y)));
        if (s.kind === 'street') for (let y = s.y0 + 8; y < s.y1 - 8; y += 40) { P.rect(s.x0 + 6, y, 8, 8, 0x5a4a3a); P.rect(s.x0 + 7, y - 4, 6, 5, 0x3a7a3a); P.rect(s.x1 - 14, y + 20, 8, 8, 0x5a4a3a); P.rect(s.x1 - 13, y + 16, 6, 5, 0x3a7a3a); } // planteringslådor
      }
      for (const b of [...BUILDINGS_S, ...BUILDINGS_X.filter((b) => b.row === 's')]) {
        const fp = footprint(b);
        fill(P, [fp[0], fp[3] - 2, fp[2], fp[3] + 1], (x, y) => mul(dirt(x, y), 0.7));                 // husväggens fot
        if (b.yard?.kind === 'forecourt') fill(P, b.yard.rect, concrete);
        if (b.yard?.kind === 'garden') {
          fill(P, b.yard.rect, grass);
          for (const [x0, y0, x1, y1] of b.blocks || []) fill(P, [x0, y0, x1, y1], (x, y) => grain(0x2f6a2a, x, y, 345, 0.1)); // häckarna
          fill(P, [b.door.x0 + 2, b.yard.rect[1], b.door.x1 - 2, b.yard.rect[3]], (x, y) => paving(x, y, 0));   // gången till dörren
        }
      }
      // trottoaren framför de södra husen, Södergatan, bortre trottoaren
      sidewalk(P, CITY.SIDEWALK_SN[0], CITY.SIDEWALK_SN[1], 0.1, false);
      roadX(P, CITY.ROAD_S[0], CITY.ROAD_S[1], 0.2);
      for (const c of CROSSWALKS_S) {
        zebra(P, c.x0, c.x1, c.y0, c.y1, 'x');
        for (let y = c.y0 + 2; y < c.y1 - 2; y++) { P.px(c.stop[1], y, 0xe8e4d8, 0.7); P.px(c.stop[-1], y, 0xe8e4d8, 0.7); }  // stopplinjer
        for (const yy of [CITY.SIDEWALK_SN[1] - 8, CITY.SIDEWALK_SS[0] + 3]) for (let x = c.x0 + 3; x < c.x1 - 3; x += 2) for (let j = 0; j < 5; j += 2) P.px(x, yy + j, 0x8e8a82); // taktila plattor
      }
      // korsningen Infarten/Södergatan: ingen kantsten (zebran där är CROSSWALKS_S[2])
      fill(P, [I0, CITY.ROAD_S[0] - 2, I1, CITY.ROAD_S[0]], (x, y) => asphalt(x, y, 0.3));
      // dammen i parken: vatten med ljus strandkant, näckrosor och vass
      {
        const { cx, cy, rx, ry } = PARK_LAYOUT.pond;
        for (let y = Math.floor(cy - ry) - 1; y <= cy + ry + 1; y++) for (let x = Math.floor(cx - rx) - 1; x <= cx + rx + 1; x++) {
          const t = Math.hypot((x + 0.5 - cx) / rx, (y + 0.5 - cy) / ry);
          if (t >= 1.06) continue;
          if (t >= 0.94) { P.px(x, y, grain(t >= 1 ? 0x8a7a5a : 0xb8a880, x, y, 360, 0.08)); continue; }      // strandkanten
          P.px(x, y, water(x, y + 300, night));
        }
        for (let k = 0; k < 7; k++) {
          const lx = Math.round(cx + (hash(k, 1, 361) - 0.5) * rx * 1.5), ly = Math.round(cy + (hash(k, 2, 361) - 0.5) * ry * 1.4);
          P.rect(lx - 1, ly, 3, 2, 0x4a8a3a); P.px(lx, ly - 1, 0x5a9a4a); if (k % 3 === 0) P.px(lx, ly, 0xf4c4d8);          // näckrosor
        }
        for (const [vx, vy] of [[cx - rx + 4, cy + 2], [cx + rx - 6, cy - 3], [cx + rx - 3, cy + 5]]) for (let j = 0; j < 8; j++) { P.px(vx, vy - j, 0x6a7a3a); P.px(vx + 2, vy - j + 2, 0x7a8a4a); }  // vass
      }
      sidewalk(P, CITY.SIDEWALK_SS[0], CITY.SIDEWALK_SS[1], 0.1, true);
      for (const s of BUS_STOPS.filter((s) => s.road === 'sodergatan')) { // BUSS-fickan
        for (let x = s.x - 44; x < s.x + 44; x++) for (let y = CITY.ROAD_S[1] - 12; y < CITY.ROAD_S[1] - 2; y++) P.px(x, y, hash(x, y, 346) > 0.5 ? 0x6a6864 : 0x605e5a, 0.6);
        text(P, SMALL, 'BUSS', s.x - 10, CITY.ROAD_S[1] - 11, 0xe8e0c8);
      }
      // kajen med räcke, kanalen
      fill(P, [0, CITY.QUAY[0], W, CITY.QUAY[1]], (x, y) => { const j = ((x % 14) + 14) % 14 === 13; const c = j ? 0x6e6a62 : grain(0x9a968e, x, y, 350, 0.06); return y === CITY.QUAY[0] ? mix(c, WHITE, 0.25) : y === CITY.QUAY[1] - 1 ? mul(c, 0.7) : c; });
      for (let x = 0; x < W; x++) { P.px(x, 770, 0x2a2a2e); P.px(x, 771, 0x4a4a4e); if (x % 8 === 0) for (let j = 766; j < 776; j++) P.px(x, j, j === 766 ? 0x5a5a5e : 0x2a2a2e); }
      fill(P, [0, CITY.CANAL[0], W, H], (x, y) => water(x, y, night));
      for (let x = 0; x < W; x++) P.px(x, CITY.CANAL[0], night ? 0x3a5a7a : 0x7ab0d8, 0.6);         // vattenlinjen
      if (night) { const d = P.d; for (let i = 0; i < d.length; i += 4) if (d[i + 3]) { d[i] *= 0.86; d[i + 1] *= 0.9; d[i + 2] = Math.min(255, d[i + 2] * 0.97 + 8); } }
      canvas.getContext('2d').drawImage(P.flush(), 0, 0);
    },
  };
}
