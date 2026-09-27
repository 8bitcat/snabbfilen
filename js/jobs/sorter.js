// Sorteringsjobbet: saker glider förbi på ett band – dra varje sak till rätt
// korg innan den åker förbi. Två skins: flygplatsens bagage (titta på TAGGEN,
// inte väskan!) och klädaffärens plagg (rätt plagg på rätt hylla).
import { SMALL, BIG, ctxText, textW, mix, css, hash } from '../core/floor-pix.js';
import { SHIFT_SECONDS, drawShiftHud, drawTimeUp, makePops, abortShift } from './shift.js';
import { play } from '../core/sound.js';

const BELT_Y = 82;      // sakernas mittpunkt på bandet
const BINS_Y = 148;     // ovanför = bandet, nedanför = korgarna
const V = { W: 384, H: 216 }; // ritas i halva upplösningen, skalas 2×

export function makeSorter(A, skin, { onDone }) {
  const stats = { ok: 0, fel: 0, miss: 0 };
  const items = [];
  const pops = makePops();
  const binW = V.W / skin.bins.length;
  let t = 0, spawnIn = 1.0, held = null, done = false, doneT = 0, reported = false;
  let hotBin = -1, seq = 0;

  const speed = () => 26 + 20 * Math.min(1, t / SHIFT_SECONDS);

  return {
    pxScale: 2,
    _items: items, _stats: stats, // för tools/smoke.mjs
    update(dt) {
      pops.update(dt);
      if (done) {
        doneT += dt;
        if (doneT > 1.4 && !reported) { reported = true; onDone(stats); }
        return;
      }
      t += dt;
      if (t >= SHIFT_SECONDS) { done = true; held = null; return; }
      spawnIn -= dt;
      if (spawnIn <= 0) {
        spawnIn = 2.3 - 1.1 * Math.min(1, t / SHIFT_SECONDS) + hash(seq, 9) * 0.4;
        items.push({ cat: (Math.random() * skin.bins.length) | 0, x: V.W + 20, y: BELT_Y, held: false, ...skin.newItem(seq++) });
      }
      for (const it of items) if (!it.held) it.x -= speed() * dt;
      for (let i = items.length - 1; i >= 0; i--) {
        if (items[i].x < -24 && !items[i].held) {
          items.splice(i, 1);
          stats.miss++;
          play('miss');
          pops.add(20, BELT_Y - 20, 'MISS!', '#d8d2c0');
        }
      }
    },

    down(x, y) {
      if (done) return;
      // närmaste sak vid pekaren
      let best = null, bd = 1e9;
      for (const it of items) {
        const d = Math.abs(it.x - x) + Math.abs(it.y - y);
        if (Math.abs(it.x - x) < 17 && Math.abs(it.y - y) < 16 && d < bd) { best = it; bd = d; }
      }
      if (best) { held = best; held.held = true; held.x = x; held.y = y; }
    },
    move(x, y) {
      if (!held) return;
      held.x = x; held.y = y;
      hotBin = y > BINS_Y - 8 ? Math.max(0, Math.min(skin.bins.length - 1, (x / binW) | 0)) : -1;
    },
    up(x, y) {
      if (!held) return;
      if (y > BINS_Y - 8) {
        const bin = Math.max(0, Math.min(skin.bins.length - 1, (x / binW) | 0));
        items.splice(items.indexOf(held), 1);
        if (bin === held.cat) { stats.ok++; play('ok'); pops.add(x, BINS_Y - 14, `+${skin.wage}`, '#8ee03c'); }
        else { stats.fel++; play('fel'); pops.add(x, BINS_Y - 14, 'FEL!', '#ff6a6a'); }
      } else { held.y = BELT_Y; held.held = false; } // tillbaka på bandet
      held = null; hotBin = -1;
    },
    key(k) { if (k === 'Escape' && !done) abortShift(A); },

    draw(ctx) {
      ctx.save();
      ctx.setTransform(2, 0, 0, 2, 0, 0);
      skin.bg(ctx, V, t);
      skin.drawBins(ctx, V, binW, hotBin);
      for (const it of items) if (!it.held) skin.drawItem(ctx, it);
      if (held) skin.drawItem(ctx, held); // den man håller ritas överst
      pops.draw(ctx);
      drawShiftHud(ctx, V, { t, dur: SHIFT_SECONDS, ok: stats.ok, fel: stats.fel, title: skin.title });
      if (done) drawTimeUp(ctx, V);
      ctx.restore();
    },
  };
}

// ============================== FLYGPLATSEN ==============================
const TAG = [
  { ch: 'A', c: '#d9433b' }, { ch: 'B', c: '#2c6fb7' },
  { ch: 'C', c: '#2f8f46' }, { ch: 'D', c: '#e8b230' },
];
const CASE_COLORS = [0x6a5030, 0x4a4a52, 0x2aa39a, 0x8e5bd1, 0x9a3a4a, 0x3a5a7c];

function airportBg(ctx, A, t) {
  // vägg + fönsterband med moln och ett plan då och då
  ctx.fillStyle = '#3c4454'; ctx.fillRect(0, 0, A.W, A.H);
  ctx.fillStyle = '#8ed0ea'; ctx.fillRect(0, 24, A.W, 26);
  ctx.fillStyle = '#e8f4fa';
  for (let i = 0; i < 5; i++) {
    const cx = (hash(i, 21) * 500 + t * (6 + i)) % (A.W + 60) - 30;
    ctx.fillRect(cx | 0, 30 + i * 3, 22, 4); ctx.fillRect((cx | 0) + 4, 28 + i * 3, 12, 8);
  }
  const plane = (t * 34) % (A.W * 2.5) - 60;
  if (plane < A.W + 30) {
    ctx.fillStyle = '#f4f1ea'; ctx.fillRect(plane | 0, 33, 26, 5);
    ctx.fillRect((plane | 0) + 8, 30, 7, 11); ctx.fillRect((plane | 0) + 22, 30, 4, 4);
  }
  ctx.fillStyle = '#2c3240'; for (let x = 0; x < A.W; x += 48) ctx.fillRect(x, 24, 3, 26);
  // skylt
  ctx.fillStyle = '#17151a'; ctx.fillRect(6, 54, textW(SMALL, 'GATE 7 - BAGAGE') + 8, 11);
  ctxText(ctx, SMALL, 'GATE 7 - BAGAGE', 10, 57, '#ffd23f');
  // bandet med rullande streck
  ctx.fillStyle = '#22262e'; ctx.fillRect(0, BELT_Y - 14, A.W, 30);
  ctx.fillStyle = '#12151a'; ctx.fillRect(0, BELT_Y + 12, A.W, 5);
  ctx.fillStyle = '#3a4048';
  const off = (t * 34) % 24;
  for (let x = -24; x < A.W; x += 24) ctx.fillRect(x - off + 24 | 0, BELT_Y - 12, 3, 26);
  // golv
  ctx.fillStyle = '#4c4840'; ctx.fillRect(0, BELT_Y + 17, A.W, A.H - BELT_Y - 17);
}

function drawCase(ctx, it) {
  const x = it.x - 12 | 0, y = it.y - 9 | 0, c = it.body;
  ctx.fillStyle = css(mix(c, 0x000000, 0.4)); ctx.fillRect(x + 8, y - 3, 8, 3);       // handtag
  ctx.fillStyle = css(c); ctx.fillRect(x, y, 24, 17);
  ctx.fillStyle = css(mix(c, 0xffffff, 0.25)); ctx.fillRect(x, y, 24, 2);
  ctx.fillStyle = css(mix(c, 0x000000, 0.3)); ctx.fillRect(x, y + 14, 24, 3);
  ctx.fillStyle = css(mix(c, 0x000000, 0.22)); ctx.fillRect(x + 4, y, 3, 17); ctx.fillRect(x + 17, y, 3, 17); // remmar
  const tag = TAG[it.cat]; // taggen är det som räknas!
  ctx.fillStyle = '#17151a'; ctx.fillRect(x + 15, y + 3, 11, 11);
  ctx.fillStyle = tag.c; ctx.fillRect(x + 16, y + 4, 9, 9);
  ctxText(ctx, SMALL, tag.ch, x + 19, y + 6, '#fff');
}

function airportBins(ctx, A, binW, hot) {
  for (let i = 0; i < TAG.length; i++) {
    const bx = i * binW, tag = TAG[i];
    // bagagevagn
    ctx.fillStyle = hot === i ? '#f4f1ea' : '#17151a';
    ctx.fillRect(bx + 8, BINS_Y + 8, binW - 16, 44);
    ctx.fillStyle = tag.c; ctx.fillRect(bx + 11, BINS_Y + 11, binW - 22, 38);
    ctx.fillStyle = css(mix(parseInt(tag.c.slice(1), 16), 0x000000, 0.35));
    ctx.fillRect(bx + 11, BINS_Y + 11, binW - 22, 6);
    ctx.fillStyle = '#17151a';
    ctx.fillRect(bx + 16, BINS_Y + 52, 8, 8); ctx.fillRect(bx + binW - 24, BINS_Y + 52, 8, 8);
    ctxText(ctx, BIG, tag.ch, bx + binW / 2 - textW(BIG, tag.ch, 2) / 2 | 0, BINS_Y + 22, '#fff', 2);
  }
}

// ============================== KLÄDAFFÄREN ==============================
const RACK = [
  { label: 'TRÖJOR' }, { label: 'BYXOR' }, { label: 'HATTAR' }, { label: 'SKOR' },
];
const CLOTH_COLORS = [0xd9433b, 0x3a7bd5, 0x8ee03c, 0xf0b429, 0xf28bb3, 0x8e5bd1, 0x2aa39a, 0x1d1d22];

function shopBg(ctx, A, t) {
  ctx.fillStyle = '#a88a94'; ctx.fillRect(0, 0, A.W, A.H);
  ctx.fillStyle = '#987a84'; for (let x = 0; x < A.W; x += 14) ctx.fillRect(x, 0, 2, A.H);
  ctx.fillStyle = '#17151a'; ctx.fillRect(6, 30, textW(SMALL, 'NYTT - FRÄSCHT!') + 8, 11);
  ctxText(ctx, SMALL, 'NYTT - FRÄSCHT!', 10, 33, '#f28bb3');
  // klädräls som plaggen hänger på
  ctx.fillStyle = '#4a4038'; ctx.fillRect(0, BELT_Y - 24, A.W, 4);
  ctx.fillStyle = '#6a5c50'; ctx.fillRect(0, BELT_Y - 24, A.W, 1);
  // golv
  ctx.fillStyle = '#8a6a4a'; ctx.fillRect(0, BELT_Y + 22, A.W, A.H - BELT_Y - 22);
  ctx.fillStyle = '#7a5c40'; for (let x = 0; x < A.W; x += 26) ctx.fillRect(x, BELT_Y + 22, 1, A.H);
}

function drawGarment(ctx, it) {
  const x = it.x | 0, y = it.y | 0, c = it.body, dk = css(mix(c, 0x000000, 0.3)), lt = css(mix(c, 0xffffff, 0.25));
  if (!it.held) { // galgen den hänger i
    ctx.fillStyle = '#c8c4bc'; ctx.fillRect(x, y - 20, 1, 6); ctx.fillRect(x - 5, y - 15, 11, 1);
  }
  ctx.fillStyle = css(c);
  if (it.cat === 0) {        // tröja
    ctx.fillRect(x - 6, y - 12, 13, 16);
    ctx.fillRect(x - 10, y - 12, 4, 7); ctx.fillRect(x + 7, y - 12, 4, 7);
    ctx.fillStyle = dk; ctx.fillRect(x - 2, y - 12, 5, 2);
    ctx.fillStyle = lt; ctx.fillRect(x - 6, y + 2, 13, 2);
  } else if (it.cat === 1) { // byxor
    ctx.fillRect(x - 6, y - 12, 13, 5);
    ctx.fillRect(x - 6, y - 7, 5, 16); ctx.fillRect(x + 2, y - 7, 5, 16);
    ctx.fillStyle = dk; ctx.fillRect(x - 6, y - 12, 13, 2);
  } else if (it.cat === 2) { // keps
    ctx.fillRect(x - 6, y - 8, 13, 7);
    ctx.fillRect(x - 4, y - 11, 9, 4);
    ctx.fillStyle = dk; ctx.fillRect(x - 10, y - 2, 12, 3);
  } else {                   // sko
    ctx.fillRect(x - 8, y - 6, 10, 8);
    ctx.fillRect(x - 2, y - 2, 10, 4);
    ctx.fillStyle = '#f4f1ea'; ctx.fillRect(x - 8, y + 2, 18, 3);
    ctx.fillStyle = dk; ctx.fillRect(x - 8, y - 6, 10, 2);
  }
}

function shopBins(ctx, A, binW, hot) {
  for (let i = 0; i < RACK.length; i++) {
    const bx = i * binW;
    ctx.fillStyle = hot === i ? '#fff4c7' : '#5a4632';
    ctx.fillRect(bx + 6, BINS_Y + 6, binW - 12, 50);
    ctx.fillStyle = '#3a2a18'; ctx.fillRect(bx + 6, BINS_Y + 6, binW - 12, 3);
    ctx.fillStyle = '#3a2a18'; ctx.fillRect(bx + 6, BINS_Y + 30, binW - 12, 3);
    // ikonen: ett litet exempel-plagg på hyllan
    drawGarment(ctx, { x: bx + binW / 2, y: BINS_Y + 24, cat: i, body: 0xe8e3d6, held: true });
    const lw = textW(SMALL, RACK[i].label);
    ctx.fillStyle = '#17151a'; ctx.fillRect(bx + binW / 2 - lw / 2 - 3 | 0, BINS_Y + 40, lw + 6, 11);
    ctxText(ctx, SMALL, RACK[i].label, bx + binW / 2 - lw / 2 | 0, BINS_Y + 43, '#f4f1ea');
  }
}

export const SORTER_SKINS = {
  flygplats: {
    title: 'FLYGPLATSEN', wage: 7,
    bins: TAG, bg: airportBg, drawBins: airportBins, drawItem: drawCase,
    newItem: (i) => ({ body: CASE_COLORS[(hash(i, 31) * CASE_COLORS.length) | 0] }),
  },
  klader: {
    title: 'KLÄDAFFÄREN', wage: 8,
    bins: RACK, bg: shopBg, drawBins: shopBins, drawItem: drawGarment,
    newItem: (i) => ({ body: CLOTH_COLORS[(hash(i, 33) * CLOTH_COLORS.length) | 0] }),
  },
};
