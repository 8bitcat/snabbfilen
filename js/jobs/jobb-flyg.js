// Flygplatsen – bagagejobbet med kroppen: väskor med färgade destinations-
// taggar rullar in på bandet. Klicka på en väska så hämtar figuren den och
// bär den till rätt vagn (A/B/C/D). Fel vagn ger avdrag, väskor som rullar
// förbi räknas som missade.
import { Pix, SMALL, BIG, ctxText, textW, text, mix, mul, css, hash, bayer } from '../core/floor-pix.js';
import { createWalker, selfDrawable, folkDrawables } from '../scenes/walkable.js';
import { SHIFT_SECONDS, drawShiftHud, drawTimeUp, makePops, abortShift } from './shift.js';
import { play } from '../core/sound.js';

const FW = 384, FH = 216;
const BELT_Y = 72;
const TAG = [
  { ch: 'A', c: '#d9433b', ci: 0xd9433b }, { ch: 'B', c: '#2c6fb7', ci: 0x2c6fb7 },
  { ch: 'C', c: '#2f8f46', ci: 0x2f8f46 }, { ch: 'D', c: '#e8b230', ci: 0xe8b230 },
];
const CARTS = TAG.map((t, i) => ({ ...t, x: 26 + i * 92, y: 186, w: 60 }));
const CASE_COLORS = [0x6a5030, 0x4a4a52, 0x2aa39a, 0x8e5bd1, 0x9a3a4a, 0x3a5a7c];

export function drawCase(ctx, it, x, y) {
  const c = it.body;
  ctx.fillStyle = css(mul(c, 0.6)); ctx.fillRect(x - 4 | 0, y - 11, 8, 3);
  ctx.fillStyle = css(c); ctx.fillRect(x - 10 | 0, y - 8, 20, 14);
  ctx.fillStyle = css(mix(c, 0xffffff, 0.25)); ctx.fillRect(x - 10 | 0, y - 8, 20, 2);
  ctx.fillStyle = css(mul(c, 0.7)); ctx.fillRect(x - 10 | 0, y + 4, 20, 2);
  ctx.fillStyle = css(mul(c, 0.78)); ctx.fillRect(x - 7 | 0, y - 8, 2, 14); ctx.fillRect(x + 5 | 0, y - 8, 2, 14);
  const tag = TAG[it.cat];
  ctx.fillStyle = '#17151a'; ctx.fillRect(x + 2 | 0, y - 6, 9, 9);
  ctx.fillStyle = tag.c; ctx.fillRect(x + 3 | 0, y - 5, 7, 7);
  ctxText(ctx, SMALL, tag.ch, x + 5 | 0, y - 4, '#fff');
}

export function makeJobbFlyg(A, { onDone }) {
  const stats = { ok: 0, fel: 0, miss: 0 };
  const walker = createWalker({ top: BELT_Y + 16, bottom: FH - 26, spawn: [190, 130] });
  const pops = makePops();
  let items = [], t = 0, seq = 0, spawnIn = 1.0, carry = null, done = false, doneT = 0, reported = false;
  const speed = () => 20 + 14 * Math.min(1, t / SHIFT_SECONDS);
  const bgCache = {};
  const bg = () => (bgCache.x ||= paintAirport());

  return {
    _debug: {
      forcePick() { const it = items[0]; if (!it) return null; carry = { cat: it.cat, body: it.body }; items.shift(); return carry; },
      forceDrop(right = true) { if (!carry) return null; dropAtCart(right ? carry.cat : (carry.cat + 1) % 4); return stats; },
      stats,
    },
    get worldX() { return walker.px; },
    get worldY() { return walker.py; },
    update(dt) {
      pops.update(dt);
      if (done) { doneT += dt; if (doneT > 1.2 && !reported) { reported = true; onDone(stats); } return; }
      t += dt;
      if (t >= SHIFT_SECONDS) { done = true; return; }
      walker.update(dt);
      spawnIn -= dt;
      if (spawnIn <= 0) {
        spawnIn = 2.4 - 1.0 * Math.min(1, t / SHIFT_SECONDS) + hash(seq, 9) * 0.5;
        items.push({ cat: (Math.random() * 4) | 0, body: CASE_COLORS[(hash(seq, 31) * CASE_COLORS.length) | 0], x: -12 });
        seq++;
      }
      for (const it of items) it.x += speed() * dt;
      for (let i = items.length - 1; i >= 0; i--) if (items[i].x > FW + 12) {
        items.splice(i, 1);
        stats.miss++;
        play('miss');
        pops.add(FW - 20, BELT_Y + 10, 'MISS!', '#d8d2c0');
      }
    },
    down(x, y) {
      if (done) return;
      if (y < BELT_Y + 18 && !carry) {
        let best = null, bd = 1e9;
        for (const it of items) { const d = Math.abs(it.x - x); if (d < 18 && d < bd) { best = it; bd = d; } }
        if (best) {
          const target = best;
          walker.walkTo(Math.max(12, Math.min(FW - 12, target.x + speed() * 0.9)), BELT_Y + 20, () => {
            const i = items.indexOf(target);
            if (i >= 0 && Math.abs(target.x - walker.px) < 18) { items.splice(i, 1); carry = { cat: target.cat, body: target.body }; play('ok'); }
            else { play('miss'); pops.add(walker.px, walker.py - 30, 'MISSADE!', '#d8d2c0'); }
          });
          return;
        }
      }
      const cart = CARTS.find((cVagn) => x > cVagn.x - 6 && x < cVagn.x + cVagn.w + 6 && y > cVagn.y - 30);
      if (cart) {
        walker.walkTo(cart.x + cart.w / 2, cart.y - 20, () => { if (carry) dropAtCart(CARTS.indexOf(cart)); });
        return;
      }
      walker.walkTo(x, y);
    },
    key(k) { if (k === 'Escape' && !done) abortShift(A); },
    draw(ctx) {
      ctx.setTransform(A.pxs, 0, 0, A.pxs, 0, 0);
      ctx.drawImage(bg(), 0, 0);
      for (const it of items) drawCase(ctx, it, it.x, BELT_Y);
      const drawables = [...folkDrawables(A, t), selfDrawable(A, walker, t, { carry: !!carry })];
      drawables.sort((a, b) => a.fy - b.fy).forEach((d) => d.draw(ctx));
      if (carry) drawCase(ctx, carry, walker.px, walker.py - 46);
      pops.draw(ctx);
      drawShiftHud(ctx, { W: FW }, { t, dur: SHIFT_SECONDS, ok: stats.ok, fel: stats.fel, title: 'FLYGPLATSEN' });
      if (done) drawTimeUp(ctx, { W: FW, H: FH });
    },
  };

  function dropAtCart(idx) {
    if (idx === carry.cat) { stats.ok++; play('ok'); pops.add(CARTS[idx].x + 30, CARTS[idx].y - 34, '+7', '#8ee03c'); }
    else { stats.fel++; play('fel'); pops.add(CARTS[idx].x + 30, CARTS[idx].y - 34, 'FEL VAGN!', '#ff6a6a'); }
    carry = null;
  }
}

function paintAirport() {
  const P = new Pix(FW, FH);
  // vägg + fönsterband med rullbana
  for (let y = 0; y < BELT_Y - 10; y++) for (let x = 0; x < FW; x++) P.px(x, y, mix(0x3c4454, 0x343a48, (bayer(x, y) - 0.5) * 0.3 + 0.5) - (y > 44 && (x % 32 === 0) ? 0x080808 : 0));
  for (let y = 20; y < 40; y++) for (let x = 6; x < FW - 6; x++) {
    let c = mix(0x8ed0ea, 0xbfe6f2, (y - 20) / 20);
    if (hash(x >> 3, y >> 2, 21) > 0.92) c = 0xe8f4fa;
    P.px(x, y, c);
  }
  P.rect(120, 34, 40, 3, 0x6a7484); P.rect(150, 30, 18, 4, 0xd8dee8); P.rect(164, 28, 5, 3, 0xd8dee8); // ett plan
  for (let x = 6; x < FW; x += 48) P.vl(x, 20, 20, 0x2c3240);
  P.rect(6, 46, textW(SMALL, 'GATE 7 - BAGAGE') + 8, 11, 0x17151a);
  text(P, SMALL, 'GATE 7 - BAGAGE', 10, 49, 0xffd23f);
  // bandet
  for (let y = BELT_Y - 10; y < BELT_Y + 12, y < BELT_Y + 12; y++) for (let x = 0; x < FW; x++) P.px(x, y, mix(0x22262e, 0x2a2e38, (bayer(x, y) - 0.5) * 0.4 + 0.5));
  P.hl(0, BELT_Y + 10, FW, 0x12151a); P.hl(0, BELT_Y - 10, FW, 0x3a4048);
  for (let x = 0; x < FW; x += 16) P.vl(x, BELT_Y - 8, 18, 0x3a4048);
  // golvet
  for (let y = BELT_Y + 14; y < FH; y++) for (let x = 0; x < FW; x++) {
    let c = mix(0x4c4840, 0x423e36, hash((x / 28) | 0, (y / 18) | 0, 3) * 0.5 + (bayer(x, y) - 0.5) * 0.1);
    if (x % 28 === 0 || (y - BELT_Y - 14) % 18 === 0) c = mul(c, 0.85);
    P.px(x, y, c);
  }
  // vagnarna
  for (const cart of CARTS) {
    P.rect(cart.x - 2, cart.y - 26, cart.w + 4, 30, 0x17151a);
    P.rect(cart.x, cart.y - 24, cart.w, 26, cart.ci);
    P.rect(cart.x, cart.y - 24, cart.w, 5, mul(cart.ci, 0.6));
    P.rect(cart.x + 6, cart.y + 4, 7, 6, 0x17151a); P.rect(cart.x + cart.w - 13, cart.y + 4, 7, 6, 0x17151a);
    const tw = textW(BIG, cart.ch);
    text(P, BIG, cart.ch, cart.x + cart.w / 2 - tw / 2, cart.y - 16, 0xffffff);
  }
  P.box(0, 0, FW, FH, 0x0e0d12);
  return P.flush();
}
