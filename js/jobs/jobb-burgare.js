// Burgarbaren – servera rätt mat till rätt kund! Kunder kommer in, sätter sig
// vid borden och visar en pratbubbla med vad de vill ha. Tallrikar med mat
// dyker upp på disken (med egen bubbla) – plocka en tallrik, gå till kunden
// med samma önskan och servera. Fel kund blir sur, långsam service gör att
// kunder tröttnar och går. Borden är spelets riktiga bordssprites.
import { drawPerson, makeLook } from '../core/people.js';
import { Pix, SMALL, ctxText, textW, text, mix, mul, css, hash, bayer } from '../core/floor-pix.js';
import { createWalker, selfDrawable, folkDrawables, iconBubble, WALK_SEQ } from '../scenes/walkable.js';
import { SHIFT_SECONDS, drawShiftHud, drawTimeUp, makePops, abortShift } from './shift.js';
import { play } from '../core/sound.js';
import { FRAMES } from '../data/frames.js';
import { ATLAS } from '../scenes/room.js';

const FW = 384, FH = 216;
const COUNTER = { x0: 20, x1: 200, top: 58, base: 84 };
// maträtterna som 8×8-pixelkartor
const PAL = { B: '#c98a4a', K: '#8a5a2a', G: '#45b964', R: '#d9433b', Y: '#f0d048', W: '#f4f1ea', P: '#e85aa0', L: '#3a7bd5', O: '#f08a2a' };
const DISHES = [
  { id: 'burgare', map: ['........', '.BBBBBB.', 'B......B', '.GGGGGG.', '.RRRRRR.', 'B......B', '.KKKKKK.', '........'] },
  { id: 'pommes', map: ['..Y.Y...', '.YYYYY..', '.YYYYY..', 'RRRRRRR.', 'R.....R.', 'R.....R.', '.RRRRR..', '........'] },
  { id: 'lask', map: ['...L....', '...L....', '.WWWWW..', '.WLLLW..', '.WLLLW..', '.WLLLW..', '.WWWWW..', '........'] },
  { id: 'glass', map: ['...PP...', '..PPPP..', '..WWWW..', '..YYYY..', '...YY...', '...YY...', '....Y...', '........'] },
];
function drawDish(ctx, d, x, y, scale = 1) {
  const m = DISHES[d].map;
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
    const ch = m[r][c];
    if (ch === '.') continue;
    ctx.fillStyle = PAL[ch];
    ctx.fillRect(x - 4 * scale + c * scale | 0, y - 4 * scale + r * scale | 0, scale, scale);
  }
}
// fyra bord med två sittplatser (kunder sitter på vänstra platsen)
const TABLES = [
  { x: 60, y: 140 }, { x: 170, y: 140 }, { x: 280, y: 140 }, { x: 170, y: 190 },
];

export function makeJobbBurgare(A, { onDone }) {
  const stats = { ok: 0, fel: 0, miss: 0 };
  const walker = createWalker({ top: COUNTER.base + 6, bottom: FH - 6, spawn: [240, 110] });
  walker.setObstacles(TABLES.map((tb) => [tb.x - 4, tb.y - 12, tb.x + 26, tb.y + 2]));
  const pops = makePops();
  let customers = [], plates = [], t = 0, seq = 0, custIn = 1.5, plateIn = 2.5, carry = null;
  let done = false, doneT = 0, reported = false;
  const bgCache = {};
  const bg = () => (bgCache.x ||= paintDiner());

  function freeTable() { return TABLES.find((tb) => !customers.some((k) => k.table === tb)); }

  return {
    _debug: {
      forceCustomer() { const tb = freeTable(); if (!tb) return null; const k = { look: makeLook(), table: tb, x: tb.x - 10, y: tb.y - 2, state: 'sit', wish: (Math.random() * 4) | 0, patience: 30, eat: 0 }; customers.push(k); return k.wish; },
      forcePlate(wish) { plates.push({ d: wish ?? (Math.random() * 4) | 0, x: COUNTER.x0 + 20 + plates.length * 24 }); return plates.length - 1; },
      pickPlate(i = 0) { const p = plates[i]; if (!p) return null; carry = { d: p.d }; plates.splice(i, 1); return carry; },
      serve(right = true) {
        if (!carry) return null;
        const k = customers.find((c) => c.state === 'sit' && (right ? c.wish === carry.d : c.wish !== carry.d)) || customers.find((c) => c.state === 'sit');
        if (!k) return null;
        serveTo(k);
        return stats;
      },
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
      // nya kunder
      custIn -= dt;
      if (custIn <= 0) {
        custIn = 6 - 2.5 * Math.min(1, t / SHIFT_SECONDS) + hash(seq, 3) * 2;
        const tb = freeTable();
        if (tb) customers.push({ look: makeLook(), table: tb, x: -12, y: 128, state: 'walk', wish: (Math.random() * 4) | 0, patience: 26, eat: 0, id: seq++ });
      }
      for (const k of customers) {
        if (k.state === 'walk') {
          const txp = k.table.x - 10, typ = k.table.y - 2;
          const dx = txp - k.x, dy = typ - k.y, d = Math.hypot(dx, dy);
          if (d < 2) { k.state = 'sit'; }
          else { k.x += dx / d * 34 * dt; k.y += dy / d * 34 * dt; }
        } else if (k.state === 'sit') {
          k.patience -= dt;
          if (k.patience <= 0) { k.state = 'leave'; stats.miss++; play('miss'); pops.add(k.x, k.y - 40, 'GICK HEM…', '#d8d2c0'); }
        } else if (k.state === 'eat') {
          k.eat -= dt;
          if (k.eat <= 0) k.state = 'leave';
        } else if (k.state === 'leave') {
          k.x -= 40 * dt;
        }
      }
      customers = customers.filter((k) => k.x > -16);
      // nya tallrikar på disken (bara rätter som någon väntar på + lite slump)
      plateIn -= dt;
      if (plateIn <= 0 && plates.length < 5) {
        plateIn = 3.4 - 1.2 * Math.min(1, t / SHIFT_SECONDS);
        const waiting = customers.filter((k) => k.state === 'sit').map((k) => k.wish);
        const d = waiting.length && Math.random() < 0.75 ? waiting[(Math.random() * waiting.length) | 0] : (Math.random() * 4) | 0;
        plates.push({ d, x: COUNTER.x0 + 20 + ((plates.length * 37) % (COUNTER.x1 - COUNTER.x0 - 40)) });
      }
    },
    down(x, y) {
      if (done) return;
      // plocka tallrik från disken
      if (!carry && y < COUNTER.base + 14) {
        let best = null, bd = 1e9;
        for (const p of plates) { const d = Math.abs(p.x - x); if (d < 20 && d < bd) { best = p; bd = d; } }
        if (best) {
          walker.walkTo(best.x, COUNTER.base + 12, () => {
            const i = plates.indexOf(best);
            if (i >= 0) { plates.splice(i, 1); carry = { d: best.d }; play('ok'); }
          });
          return;
        }
      }
      // servera en kund
      const k = customers.find((c) => c.state === 'sit' && Math.abs(c.x - x) < 16 && Math.abs(c.y - y) < 22);
      if (k) {
        walker.walkTo(k.table.x + 26, k.table.y + 2, () => { if (carry && k.state === 'sit') serveTo(k); });
        return;
      }
      walker.walkTo(x, y);
    },
    key(kk) { if (kk === 'Escape' && !done) abortShift(A); },
    draw(ctx) {
      ctx.setTransform(A.pxs, 0, 0, A.pxs, 0, 0);
      ctx.drawImage(bg(), 0, 0);
      // tallrikarna på disken med bubblor
      for (const p of plates) {
        ctx.fillStyle = '#f4f1ea'; ctx.fillRect(p.x - 7 | 0, COUNTER.base - 26, 14, 3);
        drawDish(ctx, p.d, p.x, COUNTER.base - 31, 1.4);
        iconBubble(ctx, p.x - 2, COUNTER.base - 40, (c, ix, iy) => drawDish(c, p.d, ix, iy, 1));
      }
      const drawables = [...folkDrawables(A, t), selfDrawable(A, walker, t, { carry: !!carry })];
      for (const tb of TABLES) drawables.push({
        fy: tb.y,
        draw: () => { if (ATLAS && ATLAS.complete) { const f = FRAMES.bordR0; ctx.drawImage(ATLAS, f[0], f[1], f[2], f[3], tb.x, tb.y - f[3], f[2], f[3]); } },
      });
      for (const k of customers) drawables.push({
        fy: k.y,
        draw: () => {
          const frame = k.state === 'walk' || k.state === 'leave' ? WALK_SEQ[Math.floor(t * 8.5) % 4] : k.state === 'eat' ? 6 : 5;
          drawPerson(ctx, k.x, k.y, k.look, k.state === 'leave' ? 'left' : k.state === 'walk' ? 'right' : 'down', frame);
          if (k.state === 'sit') {
            const hot = carry && carry.d === k.wish;
            iconBubble(ctx, k.x - 2, k.y - 46, (c, ix, iy) => drawDish(c, k.wish, ix, iy, 1), !!hot);
            if (k.patience < 8 && Math.sin(t * 6) > 0) { ctx.fillStyle = '#d9433b'; ctx.fillRect(k.x + 8, k.y - 52, 3, 6); ctx.fillRect(k.x + 8, k.y - 44, 3, 2); }
          }
        },
      });
      drawables.sort((a, b) => a.fy - b.fy).forEach((d) => d.draw(ctx));
      if (carry) { ctx.fillStyle = '#f4f1ea'; ctx.fillRect(walker.px - 7 | 0, walker.py - 46, 14, 3); drawDish(ctx, carry.d, walker.px, walker.py - 51, 1.4); }
      pops.draw(ctx);
      drawShiftHud(ctx, { W: FW }, { t, dur: SHIFT_SECONDS, ok: stats.ok, fel: stats.fel, title: 'BURGARBAREN' });
      if (done) drawTimeUp(ctx, { W: FW, H: FH });
    },
  };

  function serveTo(k) {
    if (carry.d === k.wish) {
      stats.ok++;
      play('coin');
      pops.add(k.x, k.y - 40, '+10 TACK!', '#8ee03c');
      k.state = 'eat'; k.eat = 4;
    } else {
      stats.fel++;
      play('fel');
      pops.add(k.x, k.y - 40, 'FEL RÄTT!', '#ff6a6a');
    }
    carry = null;
  }
}

function paintDiner() {
  const P = new Pix(FW, FH);
  // vägg med rutig bård
  for (let y = 0; y < COUNTER.base; y++) for (let x = 0; x < FW; x++) {
    let c = mix(0xb84a42, 0xa03e38, (bayer(x, y) - 0.5) * 0.3 + 0.5);
    if (y > 38 && y < 46) c = ((x >> 3) + ((y - 38) >> 2)) % 2 ? 0xf4f1ea : 0x17151a;
    if (y >= COUNTER.top) c = mix(0x7a2a28, 0x6a2422, (bayer(x, y) - 0.5) * 0.3 + 0.5); // bröstpanel
    P.px(x, y, c);
  }
  P.rect(8, 24, textW(SMALL, 'KÖK') + 8, 11, 0x17151a);
  text(P, SMALL, 'KÖK', 12, 27, 0xffd23f);
  // menytavla
  P.rect(290, 22, 86, 14, 0x17151a); P.box(290, 22, 86, 14, 0x5a4632);
  text(P, SMALL, 'MENY 10 KR/RÄTT', 295, 26, 0xf4f1ea);
  // disken
  for (let y = COUNTER.top, y1 = COUNTER.base; y < y1; y++) for (let x = COUNTER.x0; x < COUNTER.x1; x++) {
    let c = y < COUNTER.top + 6 ? mix(0xd9d2c3, 0xf1ece2, (y - COUNTER.top) / 6) : 0x9e1b22;
    const k = (x - COUNTER.x0) % 8;
    if (y >= COUNTER.top + 6) { if (k === 0) c = mul(0x9e1b22, 0.72); else if (k === 1) c = mix(0x9e1b22, 0xffffff, 0.14); }
    P.px(x, y, c);
  }
  P.hl(COUNTER.x0, COUNTER.base - 2, COUNTER.x1 - COUNTER.x0, 0xd8b24a);
  P.hl(COUNTER.x0, COUNTER.base - 1, COUNTER.x1 - COUNTER.x0, 0x7a5a24);
  // kök bakom disken
  P.rect(COUNTER.x1 + 12, 30, 60, 26, 0x8a8f9c); P.box(COUNTER.x1 + 12, 30, 60, 26, 0x5a5f6a);
  for (let i = 0; i < 4; i++) P.rect(COUNTER.x1 + 16 + i * 14, 34, 10, 4, 0x2a2d33);
  // schackrutigt golv
  for (let y = COUNTER.base; y < FH; y++) for (let x = 0; x < FW; x++) {
    const cx2 = ((x / 16) | 0) + ((y - COUNTER.base) / 12 | 0);
    let c = cx2 % 2 ? 0xd8d2c6 : 0xb8302e;
    c = mul(c, 0.95 + hash(x, y, 4) * 0.08);
    P.px(x, y, c);
  }
  // borden (spelets bordssprites är props i scenen? nej – vi målar in dem i bg med atlasen i draw i stället)
  P.box(0, 0, FW, FH, 0x0e0d12);
  return P.flush();
}

// borden ritas ovanpå bg varje frame (sprites + stolar) – exporteras för draw
export function drawTables(ctx) {
  for (const tb of TABLES) {
    if (ATLAS && ATLAS.complete) {
      const f = FRAMES.bordR0;
      ctx.drawImage(ATLAS, f[0], f[1], f[2], f[3], tb.x, tb.y - f[3], f[2], f[3]);
    }
  }
}
