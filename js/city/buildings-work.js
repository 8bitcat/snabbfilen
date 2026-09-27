// PLATSHÅLLARE – ersätts av den riktiga fasadkonsten (kafe, burgare, frukt, flyg).
// Kontrakt: BUILDING_ART[kind] = { paint(b, night) → canvas, live?(ctx, b, st), glow?(ctx, b, st) }
import { Pix, SMALL, BIG, text, textW, mul } from '../core/floor-pix.js';
import { CITY, ART_OVER, ART_BELOW } from './map.js';

const COLORS = { kafe: 0x9a6a4a, burgare: 0xc9323a, frukt: 0xc06a2a, flyg: 0x6d7480 };

function stubPaint(b, night) {
  const ROOF = 18, W = b.w + ART_OVER * 2, H = b.h + ROOF + ART_BELOW;
  const P = new Pix(W, H);
  const c = night ? mul(COLORS[b.kind] || 0x777777, 0.7) : COLORS[b.kind] || 0x777777;
  P.rect(ART_OVER, 0, b.w, ROOF, mul(c, 0.55));
  P.rect(ART_OVER, ROOF, b.w, b.h, c);
  const F = textW(BIG, b.sign) + 8 < b.w ? BIG : SMALL;
  const tw = textW(F, b.sign);
  P.rect(ART_OVER + b.w / 2 - tw / 2 - 3, ROOF + 10, tw + 6, F.h + 4, 0x17151a);
  text(P, F, b.sign, ART_OVER + b.w / 2 - tw / 2, ROOF + 12, 0xf4f1ea);
  return P.flush();
}
function stubLive(ctx, b, st) {
  const { x0, x1 } = b.door, top = CITY.BASE - 34;
  ctx.fillStyle = '#2e2418'; ctx.fillRect(x0, top, x1 - x0, 34);
  const gap = Math.round((x1 - x0) / 2 * st.doorOpen);
  ctx.fillStyle = b.door.type === 'slide' ? 'rgba(170,220,240,0.8)' : '#5a4632';
  ctx.fillRect(x0 + 1, top + 1, (x1 - x0) / 2 - 1 - gap, 33);
  ctx.fillRect((x0 + x1) / 2 + gap, top + 1, (x1 - x0) / 2 - 1 - gap, 33);
}

export const BUILDING_ART = Object.fromEntries(['kafe', 'burgare', 'frukt', 'flyg'].map((k) => [k, { paint: stubPaint, live: stubLive }]));
