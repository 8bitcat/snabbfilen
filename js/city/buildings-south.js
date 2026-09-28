// SÖDER: fasadkonst för den södra husraden (radhus, pizzeria, posten,
// biblioteket, bion, kyrkan, vårdcentralen, Tornhuset, bensinmacken) och de
// fristående husen i parken (kiosk, toalett, glasskiosk, lekförråd,
// musikpaviljong). PLATSHÅLLARE från arkitekten: allt byggs på fasadlådan
// (facade-kit.js) med några egna detaljer per hus. Specialisten gör om husen
// med samma detaljrikedom som Pixelgatans norra rad.
//
// Kontrakt (docs/STADEN.md): BUILDING_ART[kind] = { paint(b, night, opts) → canvas,
// live(ctx, b, st), glow(ctx, b, st), front?(ctx, b, st), items?(b, st) → [{ y, draw(ctx) }] }.
// Bilden placeras med artPos (står på b.base); artBox(b) ger rekommenderad storlek.
// Södervända hus: bildens rad r = världens y r + artBox(b).y (454 för en vanlig södra rad).
import { mix, mul, hash, SMALL, BIG, text, textW } from '../core/floor-pix.js';
import { makeArt, jit, windowAt, WHITE } from './facade-kit.js';

const SPECS = {
  radhus: {
    wall: 0xe4d49c, wallKind: 'plaster', roof: 'gable', roofCol: 0x8a3a2a, ground: 'house', frame: 0xf4f1ea, signBg: 0x4a6a3a, signFg: 0xf4f1ea, doorCol: 0x3a5a8a,
    extra(P, K) {
      // tre radhus i olika färger med egna dörrar och brevlådor
      const tints = [0xe4d49c, 0xc8d8c0, 0xe8c0a8];
      for (let u = 0; u < 3; u++) {
        const x0 = K.fx0 + u * 44, x1 = x0 + 44;
        for (let y = K.ftop + 4; y < K.baseY - 5; y++) for (let x = x0 + 1; x < x1 - 1; x++) {
          const c = P.get(x, y), t = tints[u];
          if (c && u !== 0) P.px(x, y, mix(c, t, 0.35));
        }
        P.vl(x1 - 1, K.ftop, K.baseY - K.ftop, 0x6a5a48);
        if (u !== 1) {
          const dx = x0 + 14;
          P.rect(dx - 2, K.baseY - 28, 20, 2, 0x6a5a48);
          P.rect(dx, K.baseY - 26, 16, 26, [0x8a3a2a, 0x3a5a8a, 0x2a6a4a][u]);
          P.rect(dx + 3, K.baseY - 22, 10, 5, K.night ? 0xffd88a : 0x9fc3e0);
          P.px(dx + 12, K.baseY - 12, 0xe8d070);
        }
        P.rect(x0 + 34, K.baseY - 16, 5, 4, 0x2a2a2a); P.hl(x0 + 34, K.baseY - 16, 5, 0x5a5a5a); // brevlåda
      }
    },
  },
  pizzeria: {
    wall: 0xe8c89a, wallKind: 'plaster', roof: 'gable', roofCol: 0x9a4a32, ground: 'shop', awning: 0x2a8a3a, signBg: 0xf4f1ea, signFg: 0xc8342a, signBorder: 0x2a8a3a, neon: 0xff6040, frame: 0x5a3a2a,
    live(ctx, b, st, m) {
      // ugnens sken i skyltfönstret
      if (!m.shop[0]) return;
      const [x, y, w, h] = m.shop[0], f = 0.5 + 0.5 * Math.sin(st.t * 3.1) * Math.sin(st.t * 1.7);
      ctx.fillStyle = `rgba(255,${120 + (f * 60) | 0},40,${(0.25 + 0.2 * f).toFixed(3)})`;
      ctx.fillRect(x + 2, y + h - 7, Math.min(10, w - 4), 5);
    },
  },
  posten: {
    wall: 0xe8dcc0, wallKind: 'plaster', roof: 'flat', ground: 'shop', signBg: 0xffd23f, signFg: 0x1a3a8a, signBorder: 0x1a3a8a, frame: 0x1a3a8a,
    extra(P, K) {
      // posthornet
      const cx = K.fx1 - 12, cy = K.gtop - 8;
      P.ell(cx, cy, 5, 5, 0xffd23f, 1, 2); P.ell(cx, cy, 3, 3, 0x1a3a8a, 1, 2); P.px(cx, cy, 0xffd23f);
    },
  },
  bibliotek: {
    wall: 0xd8d0c0, wallKind: 'plaster', roof: 'flat', roofCol: 0x5a9a88, ground: 'house', winW: 12, winSp: 20, winH: 16, floorH: 26, frame: 0xf0ece0, signBg: 0x3a2a1a, signFg: 0xf0d890, doorCol: 0x5a3a20,
    extra(P, K) {
      // pilastrar och en trappa med räcke framför porten
      for (let x = K.fx0 + 3; x < K.fx1 - 3; x += 20) {
        for (let y = K.ftop + 4; y < K.baseY - 5; y++) { P.px(x, y, mix(K.wall, WHITE, 0.25)); P.px(x + 1, y, mix(K.wall, WHITE, 0.12)); P.px(x + 2, y, mul(K.wall, 0.86)); }
      }
      P.rect(K.dx - 8, K.baseY - 2, K.dw + 16, 2, 0xc8c0b0);
    },
  },
  bio: {
    wall: 0x8a2a3a, wallKind: 'plaster', roof: 'flat', ground: 'shop', signBg: 0x111111, signFg: 0xffe070, neon: 0xffd040, frame: 0x2a1a1a,
    extra(P, K) {
      // affischer i glasmontrar
      for (const px of [K.fx0 + 6, K.fx1 - 22]) {
        P.rect(px, K.ftop + 30, 16, 24, 0x1a1a1a);
        for (let j = 0; j < 22; j++) for (let i = 0; i < 14; i++) P.px(px + 1 + i, K.ftop + 31 + j, jit(hash(px, 1, 3) > 0.5 ? 0x3a6aa8 : 0xa83a5a, px + i, j, 9, 0.3));
        text(P, SMALL, 'NU', px + 3, K.ftop + 33, 0xffe070);
      }
    },
    live(ctx, b, st, m) {
      // glödlampor som jagar runt skylten
      if (!m.sign) return;
      const [x, y, w, h] = m.sign, n = Math.floor(st.t * 8);
      for (let i = 0; i < w; i += 3) {
        ctx.fillStyle = (i / 3 + n) % 4 === 0 ? '#fff6c0' : '#8a6a20'; ctx.fillRect(x + i, y - 2, 1, 1);
        ctx.fillStyle = (i / 3 + n) % 4 === 2 ? '#fff6c0' : '#8a6a20'; ctx.fillRect(x + i, y + h + 1, 1, 1);
      }
    },
  },
  kyrka: {
    wall: 0xece6d8, wallKind: 'plaster', roof: 'gable', roofCol: 0x44444e, ground: 'plain', floorH: 60, winW: 8, winSp: 26, winH: 30, frame: 0x8a8070, noSign: true, doorCol: 0x5a3018,
    extra(P, K) {
      const b = K.b;
      // tornet: vit kropp, klockvåning, kopparspira med kors
      const tx0 = K.X(b.tower.x0), tx1 = K.X(b.tower.x1), ttop = K.baseY - b.tower.h, tw = tx1 - tx0;
      const spire = ttop + 44;
      for (let y = spire; y < K.baseY; y++) for (let x = tx0; x < tx1; x++) {
        let c = jit(0xf2ece0, x, y, 31, 0.05);
        if (x === tx0) c = mix(c, WHITE, 0.3); else if (x >= tx1 - 3) c = mul(c, 0.8);
        P.px(x, y, c);
      }
      // spiran (koppar, ärgad)
      for (let y = ttop; y < spire; y++) {
        const t = (y - ttop) / (spire - ttop), hw = Math.max(1, Math.round(t * (tw / 2 + 2)));
        for (let x = -hw; x < hw; x++) P.px(tx0 + tw / 2 + x, y, jit(x < 0 ? 0x6ab09a : 0x3a7a68, x, y, 32, 0.08));
      }
      P.vl(tx0 + tw / 2, ttop - 9, 9, 0xe8c040); P.hl(tx0 + tw / 2 - 3, ttop - 6, 7, 0xe8c040);  // kors
      P.hl(tx0 - 2, spire, tw + 4, 0x3a7a68); P.hl(tx0 - 2, spire + 1, tw + 4, 0x2a5a4a);
      // klockvåningens ljudluckor och urtavlan
      for (const lx of [tx0 + 6, tx1 - 12]) { P.rect(lx, spire + 8, 6, 14, 0x2a2a30); for (let j = 0; j < 14; j += 3) P.hl(lx, spire + 8 + j, 6, 0x5a5a60); }
      const ck = { x: tx0 + tw / 2, y: spire + 34 };
      K.out.clock = { x: ck.x + K.box.x, y: ck.y + K.box.y };
      P.ell(ck.x, ck.y, 8, 8, 0x2a2a30, 1, 2); P.ell(ck.x, ck.y, 7, 7, 0xf4f1ea, 1, 2);
      for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2; P.px(Math.round(ck.x + Math.sin(a) * 5.5), Math.round(ck.y - Math.cos(a) * 5.5), 0x2a2a30); }
      // spetsbågiga fönster på fasaden
      for (let x = K.fx0 + 10; x < K.fx1 - 12; x += 26) {
        if (x + 8 > tx0 - 2 && x < tx1 + 2) continue;
        P.rect(x, K.ftop + 16, 8, 40, 0x6a6050);
        for (let j = 0; j < 38; j++) for (let i = 0; i < 6; i++) { if (j < 3 && (i === 0 || i === 5)) continue; P.px(x + 1 + i, K.ftop + 17 + j, K.night ? ((i + j) % 5 ? 0xe8a850 : 0xc84a3a) : ((i * 3 + j) % 7 === 0 ? 0xc84a5a : (i + j) % 4 ? 0x3a5a9a : 0xe8c050)); }
      }
      // portalen: bred rundbåge
      P.rect(K.dx - 4, K.baseY - 34, K.dw + 8, 6, 0xd8d0c0);
    },
    live(ctx, b, st, m) {
      if (!m.clock) return;
      const h = st.hour % 12, a1 = h / 12 * Math.PI * 2, a2 = (st.hour % 1) * Math.PI * 2;
      ctx.fillStyle = '#2a2a30';
      for (let r = 0; r <= 3; r++) ctx.fillRect(Math.round(m.clock.x + Math.sin(a1) * r), Math.round(m.clock.y - Math.cos(a1) * r), 1, 1);
      for (let r = 0; r <= 5; r++) ctx.fillRect(Math.round(m.clock.x + Math.sin(a2) * r), Math.round(m.clock.y - Math.cos(a2) * r), 1, 1);
    },
  },
  vardcentral: {
    wall: 0xe4e8ec, wallKind: 'concrete', roof: 'flat', ground: 'shop', signBg: 0xf4f7fa, signFg: 0x2a7a3a, signBorder: 0x2a7a3a, frame: 0x8a9aa8, winW: 14, winSp: 20,
    extra(P, K) {
      const cx = K.fx0 + 12, cy = K.ftop + 12;
      P.rect(cx - 2, cy - 6, 5, 13, 0x2aa84a); P.rect(cx - 6, cy - 2, 13, 5, 0x2aa84a); // grönt kors
    },
  },
  tornhuset: {
    wall: 0x9a5a44, wallKind: 'brick', roof: 'flat', ground: 'house', balcony: true, floorH: 20, frame: 0xf0ece0, signBg: 0x2a2a2a, signFg: 0xe8e0d0,
    extra(P, K) {
      // takvåningen: glasat burspråk och terrass längst upp
      const y = K.ftop - 6, x0 = K.fx0 + 20, x1 = K.fx1 - 20;
      for (let j = 0; j < 12; j++) for (let i = x0; i < x1; i++) P.px(i, y - 6 + j, K.night ? 0xffd88a : mix(0x9fc3e0, 0x4e6e96, j / 12));
      P.box(x0, y - 6, x1 - x0, 12, 0x3a3a40);
      for (let i = x0; i < x1; i += 8) P.vl(i, y - 6, 12, 0x3a3a40);
      P.hl(K.fx0 + 4, y + 6, K.fx1 - K.fx0 - 8, 0xd8d4cc);
    },
  },
  bensinmack: {
    wall: 0xe8e8ec, wallKind: 'metal', roof: 'flat', ground: 'shop', signBg: 0xd8342c, signFg: 0xffffff, groundH: 30, frame: 0x5a5a60,
  },
  // ---- parken ----
  kiosk: { wall: 0x3a6a4a, wallKind: 'wood', roof: 'flat', roofCol: 0x5a5a5a, ground: 'plain', groundH: 24, signBg: 0xf4f1ea, signFg: 0x2a4a3a, doorCol: 0x2a4a3a },
  toalett: { wall: 0x4a7a5a, wallKind: 'metal', roof: 'flat', roofCol: 0x5a6a60, ground: 'plain', groundH: 20, signBg: 0x1a3a8a, signFg: 0xffffff, doorCol: 0x3a5a4a },
  glasskiosk: { wall: 0xf2b8c8, wallKind: 'plaster', roof: 'flat', roofCol: 0xe86a9a, ground: 'plain', groundH: 20, awning: 0xe86a9a, signBg: 0xffffff, signFg: 0xe8446a },
  lekforrad: { wall: 0xa8743a, wallKind: 'wood', roof: 'gable', roofCol: 0x6a3a2a, ground: 'plain', groundH: 18, signBg: 0xffd23f, signFg: 0x3a2a1a, doorCol: 0x7a4a2a },
  paviljong: { wall: 0xf4f1ea, wallKind: 'wood', roof: 'gable', roofCol: 0x3a7a68, ground: 'plain', groundH: 30, signBg: 0x3a7a68, signFg: 0xf4f1ea },
};

// Bensinmacken: pumparna och taket ritas som egna y-sorterade föremål så att
// man kan gå in under taket och mellan pumparna.
function mackItems(b) {
  const out = [];
  for (const [x0, y0, x1, y1] of b.blocks) {
    out.push({ y: y1, draw: (ctx) => {
      const x = x0 + 2, w = x1 - x0 - 4, top = y1 - 24;
      ctx.fillStyle = '#6a6a70'; ctx.fillRect(x0, y1 - 3, x1 - x0, 3);          // pumpön
      ctx.fillStyle = '#d8342c'; ctx.fillRect(x, top, w, 20);
      ctx.fillStyle = '#f4f1ea'; ctx.fillRect(x + 2, top + 3, w - 4, 6);
      ctx.fillStyle = '#1a1a1a'; ctx.fillRect(x + 3, top + 4, w - 6, 2);
      ctx.fillStyle = '#8a1a14'; ctx.fillRect(x + w - 1, top, 1, 20);
      ctx.fillStyle = '#2a2a2a'; ctx.fillRect(x - 1, top + 10, 1, 8);         // slangen
    } });
  }
  out.push({ y: b.frontY, draw: (ctx) => {
    const x0 = b.x - 2, x1 = b.x + b.w + 2, y = b.base - 50;
    ctx.fillStyle = '#b8b8c0'; ctx.fillRect(b.x + 10, y + 12, 2, 58); ctx.fillRect(b.x + b.w - 12, y + 12, 2, 58); // pelare
    ctx.fillStyle = '#e8e8ee'; ctx.fillRect(x0, y, x1 - x0, 8);                 // taket ovanifrån
    ctx.fillStyle = '#d8342c'; ctx.fillRect(x0, y + 8, x1 - x0, 5);             // röda kanten
    ctx.fillStyle = '#ffffff'; ctx.fillRect(x0, y + 8, x1 - x0, 1);
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(x0, y + 13, x1 - x0, 1);
  } });
  return out;
}

export const BUILDING_ART = Object.fromEntries(Object.entries(SPECS).map(([k, spec]) => {
  const art = makeArt(spec);
  if (k === 'bensinmack') art.items = (b) => mackItems(b);
  return [k, art];
}));
