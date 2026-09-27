// Fruktfabriken – nu jobbar man med kroppen: frukter åker förbi på rullbandet,
// klicka på en frukt så springer figuren dit och plockar den, bär den (riktiga
// bär-frames) till lådan och släpper. Ordersedeln visar vad lådan behöver –
// fel frukt i lådan ger avdrag. Full låda = bonus och ny order.
import { Pix, SMALL, ctxText, textW, text, mix, mul, css, hash, bayer } from '../core/floor-pix.js';
import { createWalker, selfDrawable, folkDrawables } from '../scenes/walkable.js';
import { SHIFT_SECONDS, drawShiftHud, drawTimeUp, makePops, abortShift } from './shift.js';
import { play } from '../core/sound.js';

const FW = 384, FH = 216;
const BELT_Y = 74;             // bandets mitt
const BOX = { x: 290, y: 176, w: 56, h: 26 };

const PAL = { R: '#d9433b', W: '#f2a09a', G: '#2f8f46', Y: '#f0d048', B: '#6a5030', O: '#f08a2a', P: '#9fd356', V: '#8e5bd1' };
export const FRUITS = [
  { id: 'apple', name: 'ÄPPLE', map: ['...GG...', '....G...', '..RRRR..', '.RWRRRR.', '.RRRRRR.', '.RRRRRR.', '.RRRRR..', '..RRR...'] },
  { id: 'banan', name: 'BANAN', map: ['.....B..', '....YY..', '...YYY..', '..YYY...', '.YYY....', '.YYY....', '.YY.....', '.B......'] },
  { id: 'apelsin', name: 'APELSIN', map: ['...G....', '..OOOO..', '.OOOOOO.', '.OWOOOO.', '.OOOOOO.', '.OOOOOO.', '..OOOO..', '........'] },
  { id: 'paron', name: 'PÄRON', map: ['....G...', '...GG...', '...PP...', '..PPPP..', '..PPPP..', '.PPPPPP.', '.PPPPPP.', '..PPPP..'] },
  { id: 'druvor', name: 'DRUVOR', map: ['....G...', '...GG...', '..V.V...', '.VVVVV..', '.VVVVV..', '..VVV...', '..VVV...', '...V....'] },
];
export function drawFruit(ctx, f, x, y, scale = 1) {
  const m = FRUITS[f].map;
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
    const ch = m[r][c];
    if (ch === '.') continue;
    ctx.fillStyle = PAL[ch];
    ctx.fillRect(x - 4 * scale + c * scale | 0, y - 4 * scale + r * scale | 0, scale, scale);
  }
}
function newOrder(seq) {
  const kinds = [...FRUITS.keys()].sort(() => Math.random() - 0.5).slice(0, 2 + ((hash(seq, 41) * 2) | 0));
  return { need: kinds.map((k) => ({ f: k, n: 1 + ((Math.random() * 3) | 0), got: 0 })) };
}

export function makeJobbFrukt(A, { onDone }) {
  const stats = { ok: 0, fel: 0, miss: 0, boxes: 0 };
  const walker = createWalker({ top: BELT_Y + 14, bottom: FH - 6, spawn: [120, 140] });
  walker.setObstacles([[BOX.x - 2, BOX.y - 10, BOX.x + BOX.w + 2, BOX.y + BOX.h]]);
  const pops = makePops();
  let items = [], t = 0, seq = 0, spawnIn = 0.8, carry = null, done = false, doneT = 0, reported = false;
  let order = newOrder(seq++), boxFlash = 0;
  const speed = () => 22 + 12 * Math.min(1, t / SHIFT_SECONDS);

  const bgCache = {};
  const bg = () => (bgCache.x ||= paintFactory());

  return {
    _debug: {
      forcePick() { const it = items[0]; if (!it) return null; carry = { f: it.f }; items.shift(); return carry; },
      forceDrop() { if (!carry) return null; dropInBox(); return stats; },
      needFruit() { const slot = order.need.find((n) => n.got < n.n); return slot ? slot.f : -1; },
      setCarry(f) { carry = { f }; },
      stats,
    },
    get worldX() { return walker.px; },
    get worldY() { return walker.py; },
    update(dt) {
      pops.update(dt);
      boxFlash = Math.max(0, boxFlash - dt);
      if (done) { doneT += dt; if (doneT > 1.2 && !reported) { reported = true; onDone(stats); } return; }
      t += dt;
      if (t >= SHIFT_SECONDS) { done = true; return; }
      walker.update(dt);
      spawnIn -= dt;
      if (spawnIn <= 0) {
        spawnIn = 1.6 - 0.5 * Math.min(1, t / SHIFT_SECONDS) + hash(seq, 43) * 0.4;
        const wanted = order.need.filter((n) => n.got < n.n).map((n) => n.f);
        const f = Math.random() < 0.6 && wanted.length ? wanted[(Math.random() * wanted.length) | 0] : (Math.random() * FRUITS.length) | 0;
        items.push({ f, x: -8 });
        seq++;
      }
      for (const it of items) it.x += speed() * dt;
      for (let i = items.length - 1; i >= 0; i--) if (items[i].x > FW + 8) { items.splice(i, 1); stats.miss++; }
    },
    down(x, y) {
      if (done) return;
      // klick på en frukt på bandet → gå dit och plocka
      if (y < BELT_Y + 16 && !carry) {
        let best = null, bd = 1e9;
        for (const it of items) { const d = Math.abs(it.x - x); if (d < 16 && d < bd) { best = it; bd = d; } }
        if (best) {
          const target = best;
          walker.walkTo(Math.max(12, Math.min(FW - 12, target.x + speed() * 0.9)), BELT_Y + 18, () => {
            const i = items.indexOf(target);
            if (i >= 0 && Math.abs(target.x - walker.px) < 16) { items.splice(i, 1); carry = { f: target.f }; play('ok'); }
            else { play('miss'); pops.add(walker.px, walker.py - 30, 'MISSADE!', '#d8d2c0'); }
          });
          return;
        }
      }
      // klick på lådan → bär dit och släpp
      if (x > BOX.x - 8 && x < BOX.x + BOX.w + 8 && y > BOX.y - 20) {
        walker.walkTo(BOX.x - 8, BOX.y + 8, () => { if (carry) dropInBox(); });
        return;
      }
      walker.walkTo(x, y);
    },
    key(k) { if (k === 'Escape' && !done) abortShift(A); },
    draw(ctx) {
      ctx.setTransform(A.pxs, 0, 0, A.pxs, 0, 0);
      ctx.drawImage(bg(), 0, 0);
      // frukterna på bandet
      for (const it of items) drawFruit(ctx, it.f, it.x, BELT_Y, 1.6);
      // ordersedeln
      const ow = 20 + order.need.length * 30;
      ctx.fillStyle = '#f4f1ea'; ctx.fillRect(6, 24, ow, 22);
      ctx.fillStyle = '#17151a'; ctx.fillRect(6, 24, ow, 1); ctx.fillRect(6, 45, ow, 1);
      ctxText(ctx, SMALL, 'PACKA:', 9, 27, '#9e1b22');
      order.need.forEach((n, i) => {
        const nx = 18 + i * 30;
        drawFruit(ctx, n.f, nx, 39, 1.4);
        ctxText(ctx, SMALL, `${n.got}/${n.n}`, nx + 7, 35, n.got >= n.n ? '#2f8f46' : '#17151a');
      });
      // lådan
      ctx.fillStyle = boxFlash > 0 ? '#e8b230' : '#8a6a42';
      ctx.fillRect(BOX.x, BOX.y - 8, BOX.w, BOX.h);
      ctx.fillStyle = css(mix(0x8a6a42, 0x000000, 0.35));
      ctx.fillRect(BOX.x, BOX.y - 8, BOX.w, 4); ctx.fillRect(BOX.x, BOX.y - 8, 4, BOX.h); ctx.fillRect(BOX.x + BOX.w - 4, BOX.y - 8, 4, BOX.h);
      ctxText(ctx, SMALL, 'LÅDA', BOX.x + BOX.w / 2 - textW(SMALL, 'LÅDA') / 2 | 0, BOX.y + 2, '#f4e8d0');

      const drawables = [...folkDrawables(A, t), selfDrawable(A, walker, t, { carry: !!carry })];
      drawables.sort((a, b) => a.fy - b.fy).forEach((d) => d.draw(ctx));
      if (carry) drawFruit(ctx, carry.f, walker.px, walker.py - 44, 1.6); // frukten över huvudet

      pops.draw(ctx);
      drawShiftHud(ctx, { W: FW }, { t, dur: SHIFT_SECONDS, ok: stats.ok, fel: stats.fel, title: 'FRUKTFABRIKEN' });
      if (done) drawTimeUp(ctx, { W: FW, H: FH });
    },
  };

  function dropInBox() {
    const slot = order.need.find((n) => n.f === carry.f && n.got < n.n);
    if (slot) {
      slot.got++; stats.ok++;
      play('ok'); pops.add(BOX.x + BOX.w / 2, BOX.y - 16, '+' + 4, '#8ee03c');
      if (order.need.every((n) => n.got >= n.n)) {
        stats.boxes++; boxFlash = 0.8;
        play('box'); pops.add(BOX.x + BOX.w / 2, BOX.y - 24, 'LÅDA KLAR! +20', '#ffd23f');
        order = newOrder(seq++);
      }
    } else { stats.fel++; play('fel'); pops.add(BOX.x + BOX.w / 2, BOX.y - 16, 'FEL FRUKT!', '#ff6a6a'); }
    carry = null;
  }
}

function paintFactory() {
  const P = new Pix(FW, FH);
  for (let y = 0; y < 62; y++) for (let x = 0; x < FW; x++) {
    let c = mix(0x5a6e5c, 0x4c5e4e, (bayer(x, y) - 0.5) * 0.3 + 0.5);
    if (x % 20 === 0) c = mul(c, 0.85);
    P.px(x, y, c);
  }
  P.rect(6, 6, textW(SMALL, 'FRUKTFABRIKEN AB') + 8, 11, 0x17151a);
  text(P, SMALL, 'FRUKTFABRIKEN AB', 10, 9, 0x9fd356);
  for (let i = 0; i < 4; i++) { P.rect(240 + (i % 2) * 40, 20 + ((i / 2) | 0) * 16, 36, 14, 0x7a5c40); P.rect(240 + (i % 2) * 40, 30 + ((i / 2) | 0) * 16, 36, 4, 0x5a4028); }
  // rullbandet
  for (let y = BELT_Y - 9; y < BELT_Y + 11; y++) for (let x = 0; x < FW; x++) P.px(x, y, mix(0x22262e, 0x2a2e38, (bayer(x, y) - 0.5) * 0.4 + 0.5));
  P.hl(0, BELT_Y + 9, FW, 0x12151a); P.hl(0, BELT_Y - 9, FW, 0x3a4048);
  for (let x = 0; x < FW; x += 16) P.vl(x, BELT_Y - 7, 16, 0x3a4048);
  for (let x = 8; x < FW; x += 32) { P.rect(x, BELT_Y + 11, 4, 4, 0x1a1d24); }
  // fabriksgolvet
  for (let y = BELT_Y + 13; y < FH; y++) for (let x = 0; x < FW; x++) {
    let c = mix(0x6a655c, 0x5c574e, hash((x / 24) | 0, (y / 16) | 0, 3) * 0.5 + (bayer(x, y) - 0.5) * 0.1);
    if (x % 24 === 0 || (y - BELT_Y - 13) % 16 === 0) c = mul(c, 0.85);
    P.px(x, y, c);
  }
  // varningsränder vid lådan
  for (let i = 0; i < 30; i++) P.px(BOX.x - 6 + (i % 2), BOX.y - 12 + i / 2, (i >> 1) % 2 ? 0xe8b230 : 0x17151a);
  P.box(0, 0, FW, FH, 0x0e0d12);
  return P.flush();
}
