// FÖRORTEN: fasadkonst för förortens hus – höghusen på Betongvägen, närbutiken
// med galler, pantbanken, kebaben, det igenspikade huset, bilverkstan,
// tvätteriet, garagelängan, den övergivna lagerhallen, lamellhuset och
// husvagnen. Allt är slitet: klotter, sprickor, rostränder, trasiga fönster.
// PLATSHÅLLARE från arkitekten, byggd på fasadlådan (facade-kit.js) –
// specialisten gör om husen med full detaljrikedom (se docs/STADEN.md).
//
// Kontrakt: BUILDING_ART[kind] = { paint(b, night, opts) → canvas, live(ctx, b, st),
// glow(ctx, b, st), front?(ctx, b, st), items?(b, st) }. opts.worn = stadsdelens
// slitage (1 här). Bilden placeras med artPos; artBox(b) ger rekommenderad storlek.
import { mix, mul, hash, SMALL, text } from '../core/floor-pix.js';
import { makeArt, graffiti, jit, WHITE } from './facade-kit.js';

const SPECS = {
  hoghus: { wall: 0xb8b4a8, wallKind: 'concrete', roof: 'flat', roofCol: 0x66625c, ground: 'house', balcony: true, dish: true, floorH: 19, worn: 1, bars: true, signBg: 0x3a3a3a, signFg: 0xd8d4c8, doorCol: 0x5a6a7a },
  narbutik: { wall: 0xc8c0b0, wallKind: 'concrete', roof: 'flat', ground: 'shop', bars: true, dish: true, floorH: 20, worn: 1, signBg: 0xd8342c, signFg: 0xffffff, neon: 0xff5040, frame: 0x3a3a40 },
  pantbank: { wall: 0x9a8a6a, wallKind: 'plaster', roof: 'flat', ground: 'shop', bars: true, floorH: 20, worn: 1, signBg: 0x1a1a1a, signFg: 0xe8c040, frame: 0x2a2a2a },
  kebab: { wall: 0xd8b890, wallKind: 'plaster', roof: 'flat', ground: 'shop', awning: 0xc83a2a, floorH: 20, worn: 1, signBg: 0xffd23f, signFg: 0xc8342a, neon: 0xff4030, frame: 0x5a2a1a,
    live(ctx, b, st, m) {
      // trasig neon: blinkar ojämnt
      if (!m.sign || !(st.night || (st.env?.dark ?? 0) > 0.2)) return;
      const on = Math.sin(st.t * 13) + Math.sin(st.t * 7.3) > -0.4;
      if (!on) { const [x, y, w, h] = m.sign; ctx.fillStyle = 'rgba(20,10,10,0.55)'; ctx.fillRect(x + 1, y + 1, w - 2, h - 2); }
    } },
  overgivet: { wall: 0x8a5a44, wallKind: 'brick', roof: 'flat', roofCol: 0x5a5a50, ground: 'house', boarded: 0.85, worn: 1, noSign: true, doorCol: 0x6a4a2a,
    extra(P, K) { graffiti(P, K.fx0 + 2, K.fx1 - 2, K.ftop + 8, K.gtop - 4, K.seed + 99, 3); } },
  hoghus2: { wall: 0xc8b898, wallKind: 'concrete', roof: 'flat', roofCol: 0x6a665e, ground: 'house', balcony: true, dish: true, floorH: 19, worn: 1, signBg: 0x3a3a3a, signFg: 0xd8d4c8, doorCol: 0x7a5a3a },
  bilverkstad: { wall: 0x6a7a8a, wallKind: 'metal', roof: 'flat', ground: 'garage', worn: 0.8, signBg: 0x1a4a8a, signFg: 0xffffff, doorCol: 0x9aa4ae,
    extra(P, K) {
      // däckstapel och oljefläckar
      for (let s = 0; s < 3; s++) for (let t = 0; t < 4 - s; t++) {
        const x = K.fx1 - 30 + s * 9, y = K.baseY - 6 - t * 5;
        P.rect(x, y, 8, 5, 0x1e1e22); P.hl(x + 1, y, 6, 0x3a3a40); P.rect(x + 3, y + 1, 2, 2, 0x5a5a60);
      }
    } },
  tvatteri: { wall: 0xa8c8d8, wallKind: 'plaster', roof: 'flat', ground: 'shop', floorH: 20, worn: 0.8, signBg: 0x2a6aa8, signFg: 0xffffff, frame: 0x3a5a7a,
    live(ctx, b, st, m) {
      // tvättmaskinernas runda luckor snurrar i skyltfönstret
      for (const [x, y, w, h] of m.shop) for (let i = x + 4; i < x + w - 6; i += 9) {
        const a = st.t * 6 + i;
        ctx.fillStyle = '#d8e4ec'; ctx.fillRect(i, y + h - 9, 6, 6);
        ctx.fillStyle = ['#3a7bd5', '#e8443a', '#6fdc4c'][((i / 9) | 0) % 3];
        ctx.fillRect(i + 2 + Math.round(Math.cos(a)), y + h - 7 + Math.round(Math.sin(a)), 2, 2);
      }
    } },
  garage: { wall: 0x9a968c, wallKind: 'concrete', roof: 'flat', roofCol: 0x5a5a56, ground: 'plain', groundH: 36, worn: 1, signBg: 0x3a3a3a, signFg: 0xd8d4c8,
    extra(P, K) {
      // en rad rullportar med nummer och klotter
      for (let k = 0; k < 4; k++) {
        const x = K.fx0 + 6 + k * 36;
        if (x + 28 > K.fx1) break;
        const col = [0x8a9aa8, 0x6a7a5a, 0xa8584a, 0x8a8a8a][k];
        for (let j = 0; j < 30; j++) P.hl(x, K.baseY - 30 + j, 28, j % 3 === 2 ? mul(col, 0.7) : jit(col, x, j, 4, 0.06));
        P.box(x - 1, K.baseY - 31, 30, 31, 0x4a4a48);
        text(P, SMALL, String(k + 1), x + 12, K.baseY - 27, 0xf4f1ea);
      }
      graffiti(P, K.fx0 + 2, K.fx1 - 2, K.baseY - 28, K.baseY - 8, K.seed + 7, 3);
    } },
  lagerhall: { wall: 0x7a8a7a, wallKind: 'metal', roof: 'flat', roofCol: 0x5a605a, ground: 'garage', floorH: 30, winW: 14, winSp: 24, winH: 8, worn: 1, signBg: 0x2a2a2a, signFg: 0xb8b8b0, doorCol: 0x8a7a5a },
  lamell: { wall: 0xd0c8b4, wallKind: 'concrete', roof: 'flat', roofCol: 0x6a665e, ground: 'house', balcony: true, dish: true, groundH: 22, floorH: 18, worn: 0.8, signBg: 0x3a3a3a, signFg: 0xd8d4c8 },
  husvagn: { wall: 0xe8e4d8, wallKind: 'metal', roof: 'flat', roofCol: 0xd0ccc0, ground: 'plain', groundH: 18, worn: 0.7, noSign: true, doorCol: 0xc8c4b8,
    extra(P, K) {
      // rand, runda hörn, hjul och dragstång
      for (let x = K.fx0; x < K.fx1; x++) { P.px(x, K.ftop + 12, 0x3a7ab8); P.px(x, K.ftop + 13, 0x2a5a8a); }
      P.px(K.fx0, K.ftop, 0); P.px(K.fx1 - 1, K.ftop, 0);
      for (const wx of [K.fx0 + 12, K.fx1 - 14]) { P.rect(wx - 3, K.baseY - 4, 7, 6, 0x1a1a1e); P.rect(wx - 1, K.baseY - 2, 3, 2, 0x8a8a90); }
      P.hl(K.fx0 - 7, K.baseY - 3, 7, 0x4a4a50);
      P.rect(K.fx0 + 6, K.ftop + 4, 10, 6, K.night ? 0xffd88a : 0x9fc3e0); P.box(K.fx0 + 5, K.ftop + 3, 12, 8, 0x5a5a60);
      for (let r = 0; r < 6; r++) P.px(K.fx0 + 3 + ((hash(r, 1, 8) * (K.b.w - 6)) | 0), K.baseY - 8 + ((hash(r, 2, 8) * 5) | 0), 0x8a5a2a, 0.5); // rost
    } },
};

export const BUILDING_ART = Object.fromEntries(Object.entries(SPECS).map(([k, spec]) => [k, makeArt(spec)]));
// (mix/WHITE finns kvar för specialisten – används av de flesta målarknep)
void mix; void WHITE;
