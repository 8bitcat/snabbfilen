// Fruktfabriken: en ordersedel visar vad lådan ska innehålla. Klicka rätt
// frukter på bandet så flyger de ner i lådan – fel frukt ger avdrag. Full
// låda ger bonus och en ny order.
import { SMALL, BIG, ctxText, textW, mix, css, hash } from '../core/floor-pix.js';
import { SHIFT_SECONDS, drawShiftHud, drawTimeUp, makePops, abortShift } from './shift.js';
import { play } from '../core/sound.js';

const BELT_Y = 88;
const BOX = { x: 150, y: 156, w: 84, h: 42 };

// Frukterna som 8×8-kartor (ritas i skala 2). Bokstav = färg i pal.
const PAL = { R: '#d9433b', W: '#f2a09a', G: '#2f8f46', Y: '#f0d048', B: '#6a5030', O: '#f08a2a', P: '#9fd356', V: '#8e5bd1' };
const FRUITS = [
  { id: 'apple', name: 'ÄPPLE', map: ['...GG...', '....G...', '..RRRR..', '.RWRRRR.', '.RRRRRR.', '.RRRRRR.', '.RRRRR..', '..RRR...'] },
  { id: 'banan', name: 'BANAN', map: ['.....B..', '....YY..', '...YYY..', '..YYY...', '.YYY....', '.YYY....', '.YY.....', '.B......'] },
  { id: 'apelsin', name: 'APELSIN', map: ['...G....', '..OOOO..', '.OOOOOO.', '.OWOOOO.', '.OOOOOO.', '.OOOOOO.', '..OOOO..', '........'] },
  { id: 'paron', name: 'PÄRON', map: ['....G...', '...GG...', '...PP...', '..PPPP..', '..PPPP..', '.PPPPPP.', '.PPPPPP.', '..PPPP..'] },
  { id: 'druvor', name: 'DRUVOR', map: ['....G...', '...GG...', '..V.V...', '.VVVVV..', '.VVVVV..', '..VVV...', '..VVV...', '...V....'] },
];

function drawFruit(ctx, f, x, y, scale = 2) {
  const m = FRUITS[f].map;
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
    const ch = m[r][c];
    if (ch === '.') continue;
    ctx.fillStyle = PAL[ch];
    ctx.fillRect(x - 8 + c * scale | 0, y - 8 + r * scale | 0, scale, scale);
  }
}

// Slumpa en ordersedel: 2–3 sorter, 1–3 av varje.
function newOrder(seq) {
  const kinds = [...FRUITS.keys()].sort(() => Math.random() - 0.5).slice(0, 2 + ((hash(seq, 41) * 2) | 0));
  return { need: kinds.map((k) => ({ f: k, n: 1 + ((Math.random() * 3) | 0), got: 0 })) };
}

export function makePacker(A, { onDone }) {
  const stats = { ok: 0, fel: 0, boxes: 0 };
  const items = [], flying = [], pops = makePops();
  let t = 0, spawnIn = 0.6, seq = 0, done = false, doneT = 0, reported = false;
  let order = newOrder(seq++), boxFlash = 0;

  const speed = () => 30 + 16 * Math.min(1, t / SHIFT_SECONDS);

  return {
    _items: items, _stats: stats, _order: () => order, // för tools/smoke.mjs
    update(dt) {
      pops.update(dt);
      boxFlash = Math.max(0, boxFlash - dt);
      for (const fl of flying) {
        fl.t += dt * 3;
        fl.x += (BOX.x + BOX.w / 2 - fl.x) * Math.min(1, dt * 8);
        fl.y += (BOX.y - fl.y) * Math.min(1, dt * 8);
      }
      for (let i = flying.length - 1; i >= 0; i--) if (flying[i].t > 1) flying.splice(i, 1);
      if (done) {
        doneT += dt;
        if (doneT > 1.4 && !reported) { reported = true; onDone(stats); }
        return;
      }
      t += dt;
      if (t >= SHIFT_SECONDS) { done = true; return; }
      spawnIn -= dt;
      if (spawnIn <= 0) {
        spawnIn = 1.5 - 0.55 * Math.min(1, t / SHIFT_SECONDS) + hash(seq, 43) * 0.3;
        // väg spawnen mot det ordern behöver, annars blir det för glest
        const wanted = order.need.filter((n) => n.got < n.n).map((n) => n.f);
        const f = Math.random() < 0.55 && wanted.length ? wanted[(Math.random() * wanted.length) | 0] : (Math.random() * FRUITS.length) | 0;
        items.push({ f, x: A.W + 12, y: BELT_Y + (hash(seq, 44) * 8 - 4) });
        seq++;
      }
      for (const it of items) it.x -= speed() * dt;
      for (let i = items.length - 1; i >= 0; i--) if (items[i].x < -12) items.splice(i, 1);
    },

    down(x, y) {
      if (done) return;
      let best = null, bd = 1e9;
      for (const it of items) {
        const d = Math.abs(it.x - x) + Math.abs(it.y - y);
        if (Math.abs(it.x - x) < 12 && Math.abs(it.y - y) < 12 && d < bd) { best = it; bd = d; }
      }
      if (!best) return;
      const slot = order.need.find((n) => n.f === best.f && n.got < n.n);
      if (slot) {
        slot.got++;
        stats.ok++;
        items.splice(items.indexOf(best), 1);
        flying.push({ f: best.f, x: best.x, y: best.y, t: 0 });
        pops.add(best.x, best.y - 14, '+3', '#8ee03c');
        if (order.need.every((n) => n.got >= n.n)) {
          stats.boxes++;
          boxFlash = 0.8;
          play('box');
          pops.add(BOX.x + BOX.w / 2, BOX.y - 12, 'LÅDA KLAR! +20', '#ffd23f');
          order = newOrder(seq++);
        } else play('ok');
      } else {
        stats.fel++;
        play('fel');
        pops.add(best.x, best.y - 14, 'FEL!', '#ff6a6a');
      }
    },
    key(k) { if (k === 'Escape' && !done) abortShift(A); },

    draw(ctx) {
      const { W, H } = A;
      // fabrikslokal
      ctx.fillStyle = '#5a6e5c'; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#4c5e4e'; for (let x = 0; x < W; x += 20) ctx.fillRect(x, 0, 2, H);
      ctx.fillStyle = '#17151a'; ctx.fillRect(6, 26, textW(SMALL, 'FRUKTFABRIKEN AB') + 8, 11);
      ctxText(ctx, SMALL, 'FRUKTFABRIKEN AB', 10, 29, '#9fd356');
      // staplade backar i bakgrunden
      for (let i = 0; i < 4; i++) {
        ctx.fillStyle = '#7a5c40'; ctx.fillRect(300 + (i % 2) * 40, 40 + ((i / 2) | 0) * 16, 36, 14);
        ctx.fillStyle = '#5a4028'; ctx.fillRect(300 + (i % 2) * 40, 50 + ((i / 2) | 0) * 16, 36, 4);
      }
      // bandet
      ctx.fillStyle = '#22262e'; ctx.fillRect(0, BELT_Y - 12, W, 26);
      ctx.fillStyle = '#12151a'; ctx.fillRect(0, BELT_Y + 10, W, 4);
      ctx.fillStyle = '#3a4048';
      const off = (t * speed()) % 20;
      for (let x = -20; x < W; x += 20) ctx.fillRect(x - off + 20 | 0, BELT_Y - 10, 2, 22);
      // golv
      ctx.fillStyle = '#6a655c'; ctx.fillRect(0, BELT_Y + 14, W, H - BELT_Y - 14);

      // ordersedeln
      const ow = 26 + order.need.length * 44;
      ctx.fillStyle = '#f4f1ea'; ctx.fillRect(6, 42, ow, 30);
      ctx.fillStyle = '#17151a'; ctx.fillRect(6, 42, ow, 2); ctx.fillRect(6, 70, ow, 2);
      ctxText(ctx, SMALL, 'PACKA:', 10, 46, '#9e1b22');
      order.need.forEach((n, i) => {
        const nx = 22 + i * 44;
        drawFruit(ctx, n.f, nx + 8, 62, 2);
        const okC = n.got >= n.n ? '#2f8f46' : '#17151a';
        ctxText(ctx, SMALL, `${n.got}/${n.n}`, nx + 18, 58, okC);
      });

      // lådan
      ctx.fillStyle = boxFlash > 0 ? '#e8b230' : '#8a6a42';
      ctx.fillRect(BOX.x, BOX.y, BOX.w, BOX.h);
      ctx.fillStyle = css(mix(0x8a6a42, 0x000000, 0.35));
      ctx.fillRect(BOX.x, BOX.y, BOX.w, 6); ctx.fillRect(BOX.x, BOX.y, 6, BOX.h); ctx.fillRect(BOX.x + BOX.w - 6, BOX.y, 6, BOX.h);
      ctx.fillStyle = css(mix(0x8a6a42, 0x000000, 0.2)); ctx.fillRect(BOX.x - 8, BOX.y, 10, 5); ctx.fillRect(BOX.x + BOX.w - 2, BOX.y, 10, 5); // flikar
      ctxText(ctx, SMALL, 'LÅDA', BOX.x + BOX.w / 2 - textW(SMALL, 'LÅDA') / 2 | 0, BOX.y + BOX.h - 14, '#f4e8d0');

      // frukterna
      for (const it of items) drawFruit(ctx, it.f, it.x, it.y);
      for (const fl of flying) drawFruit(ctx, fl.f, fl.x, fl.y);

      pops.draw(ctx);
      drawShiftHud(ctx, A, { t, dur: SHIFT_SECONDS, ok: stats.ok, fel: stats.fel, title: 'FRUKTFABRIKEN' });
      if (done) drawTimeUp(ctx, A);
    },
  };
}
