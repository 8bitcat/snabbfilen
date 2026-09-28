// Burgarbaren – servera rätt mat till rätt kund! Kunder kommer in, sätter sig
// på en stol bakom ett bord och visar en pratbubbla med vad de vill ha.
// Tallrikar med mat dyker upp på disken (på fasta platser, med egen bubbla) –
// plocka en tallrik, gå till kunden med samma önskan och servera. Fel kund blir
// sur, långsam service gör att kunder tröttnar och går. Bord och stolar är
// spelets riktiga möbelsprites; maten är små pixelsprites i skala 1 på vita
// tallrikar (cachade canvasar).
import { drawPerson, makeLook } from '../core/people.js';
import { Pix, SMALL, ctxText, textW, text, mix, mul, css, hash, bayer } from '../core/floor-pix.js';
import { createWalker, selfDrawable, folkDrawables, WALK_SEQ } from '../scenes/walkable.js';
import { SHIFT_SECONDS, drawShiftHud, drawTimeUp, makePops, abortShift } from './shift.js';
import { play } from '../core/sound.js';
import { FRAMES } from '../data/frames.js';
import { ATLAS } from '../scenes/room.js';

const FW = 384, FH = 216;
const COUNTER = { x0: 20, x1: 200, top: 58, base: 84 };
// disken: sex fasta platser med 28 px mellanrum (bubblorna är 20 px breda)
const SLOTS = [38, 66, 94, 122, 150, 178];
const SLOT_TIP = 45;            // pratbubblornas spets över disken (lådan börjar vid y 26)
const LAMPS = [52, 108, 164];   // pendellampor i glappen mellan bubblorna

// ---------- maträtterna: pixelkartor i skala 1 ----------
// Varje rätt får automatiskt en mörk kontur (tonad efter grannfärgen) och ritas
// på en liten vit tallrik med kant och skugga.
const DISHES = [
  { id: 'burgare', name: 'BURGARE',
    pal: { a: 0xffe2aa, b: 0xf2aa4c, c: 0xd4822c, d: 0x9c5622, s: 0xfff6dc, G: 0x3f9e34, g: 0x8edc4c, y: 0xffd23f, Y: 0xe09a1a, m: 0x8a4a2c, M: 0x5a2c1a },
    map: [
      '...abbbbb...',
      '..absbbbsb..',
      '.abbbbbbsbc.',
      '.bsbbbsbbbc.',
      '.dccccccccd.',
      'GgGgGGgGgGgG',
      '.yyyyyyyyyY.',
      '.mymmmmmmYm.',
      '.MMMMMMMMMM.',
      '.cbbbbbbbbc.',
      '..dddddddd..',
    ],
    crumbs: [0xd4822c, 0x8edc4c] },
  { id: 'pommes', name: 'POMMES',
    pal: { Y: 0xffe36a, y: 0xf5c03a, o: 0xcf8f1c, R: 0xe0342c, H: 0xff7060, r: 0xa82320, W: 0xfff4e6, S: 0xffd23f },
    map: [
      '...Y..Y.Y...',
      '.Y.yY.YyY.Y.',
      '.yYyYyYyYyY.',
      '.oyYoyYoyYo.',
      'HRRRyYoyRRRr',
      'HRRRRRRRRRRr',
      '.HRRRRRRRRr.',
      '.HSSSSSSSSr.',
      '..HRRRRRRr..',
      '..HRRRRRRr..',
      '...rrrrrr...',
    ],
    crumbs: [0xf5c03a, 0xe0342c] },
  { id: 'lask', name: 'LÄSK',
    pal: { S: 0xe8443a, s: 0xfff4ea, L: 0xf2f5f8, l: 0xb4bfcc, C: 0x3a7bd5, c: 0x25539e, h: 0x8ec0ff, W: 0xf4f1ea, r: 0xe8443a },
    map: [
      '.......sS.',
      '......S...',
      '......s...',
      '..LLLLSL..',
      'LLLLLLLLLl',
      '.llllllll.',
      '.hCCCCCCc.',
      '.hWWrrWWc.',
      '.hWrWWrWc.',
      '..hCCCCc..',
      '..hCCCCc..',
      '..cccccc..',
    ],
    crumbs: [0x8ec0ff, 0xe8443a] },
  { id: 'glass', name: 'GLASS',
    pal: { R: 0xc8202c, r: 0xff6a6a, q: 0xffd0e4, P: 0xff88bb, p: 0xd9548e, n: 0xd4fae6, G: 0x7fdcae, g: 0x3fae7a, K: 0xecb466, k: 0xb8742c },
    map: [
      '....Rr....',
      '...qPPP...',
      '..qPPPPp..',
      '..pPPPpp..',
      '.nGGGGGGg.',
      '.GGGGGGgg.',
      '.gGgGGgGg.',
      '..KkKkKk..',
      '..kKkKkK..',
      '...KkKk...',
      '....kK....',
      '....K.....',
    ],
    crumbs: [0xff88bb, 0xecb466] },
];

const newCanvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
function pixelsToCanvas(grid, w, h) {
  const c = newCanvas(w, h), x2 = c.getContext('2d');
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const v = grid[y * w + x];
    if (v === -1) continue;
    x2.fillStyle = typeof v === 'string' ? v : css(v);
    x2.fillRect(x, y, 1, 1);
  }
  return c;
}
// pixelkarta → canvas med 1 px "sel-out"-kontur (mörkare ton av grannpixeln)
function mapSprite(map, pal) {
  const w = Math.max(...map.map((r) => r.length)) + 2, h = map.length + 2;
  const g = new Array(w * h).fill(-1);
  map.forEach((row, y) => { for (let x = 0; x < row.length; x++) if (pal[row[x]] !== undefined) g[(y + 1) * w + x + 1] = pal[row[x]]; });
  const src = g.slice();
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (src[y * w + x] !== -1) continue;
    for (const [dx, dy] of [[0, 1], [0, -1], [-1, 0], [1, 0]]) {
      const xx = x + dx, yy = y + dy;
      if (xx < 0 || yy < 0 || xx >= w || yy >= h || src[yy * w + xx] === -1) continue;
      g[y * w + x] = mix(mul(src[yy * w + xx], 0.42), 0x1c1418, 0.4);
      break;
    }
  }
  return pixelsToCanvas(g, w, h);
}
// tallriken: 20×7 (sista raden = skugga)
const PLATE_MAP = [
  '..oooooooooooooooo..',
  '.orrwwwwwwwwwwwwrro.',
  'orwwwwwwwwwwwwwwwwro',
  '.orrrrrrrrrrrrrrrro.',
  '..ouuuuuuuuuuuuuuo..',
  '...oooooooooooooo...',
  '....ssssssssssss....',
];
const PLATE_PAL = { o: 0x6e7684, r: 0xd6dce4, w: 0xfdfcf8, u: 0xaeb6c2, s: 'rgba(30,18,34,0.32)' };
const PW = 20, PH = PLATE_MAP.length;

const SPR = { food: [], plated: [], rest: [] };
// maten ensam (för bubblor och menytavlan)
function foodSprite(d) { return (SPR.food[d] ||= mapSprite(DISHES[d].map, DISHES[d].pal)); }
function drawPlateOn(x2, px, py) {
  PLATE_MAP.forEach((row, y) => { for (let x = 0; x < row.length; x++) { const v = PLATE_PAL[row[x]]; if (v === undefined) continue; x2.fillStyle = typeof v === 'string' ? v : css(v); x2.fillRect(px + x, py + y, 1, 1); } });
}
// maten på sin tallrik; matens nedersta rad vilar på tallrikens rad 2
function platedSprite(d) {
  if (SPR.plated[d]) return SPR.plated[d];
  const f = foodSprite(d), plateY = f.height - 3, c = newCanvas(PW, plateY + PH), x2 = c.getContext('2d');
  drawPlateOn(x2, 0, plateY);
  x2.drawImage(f, (PW - f.width) >> 1, 0);
  return (SPR.plated[d] = c);
}
// uppäten tallrik: smulor + en skrynklig servett
function restSprite(d) {
  if (SPR.rest[d]) return SPR.rest[d];
  const c = newCanvas(PW, PH + 2), x2 = c.getContext('2d');
  drawPlateOn(x2, 0, 2);
  const [a, b] = DISHES[d].crumbs, px = (x, y, v) => { x2.fillStyle = css(v); x2.fillRect(x, y, 1, 1); };
  px(5, 4, a); px(8, 3, b); px(10, 5, a); px(7, 5, mul(a, 0.7)); px(12, 4, b);
  // servett
  px(13, 1, 0xf4f1ea); px(14, 1, 0xdcd6ca); px(12, 2, 0xf4f1ea); px(13, 2, 0xffffff); px(14, 2, 0xf4f1ea); px(15, 2, 0xb8b0a0);
  px(13, 3, 0xdcd6ca); px(14, 3, 0xb8b0a0);
  return (SPR.rest[d] = c);
}
// Pratbubbla med rundade hörn och spets nedåt i (cx, tip). Innerytan är iw×ih;
// returnerar innerytans övre vänstra hörn.
function bubble(ctx, cx, tip, iw, ih, hot = false) {
  const w = iw + 2, h = ih + 2, x0 = cx - (w >> 1), y0 = tip - 2 - h;
  const edge = hot ? '#e8b230' : '#17151a';
  ctx.fillStyle = edge;
  ctx.fillRect(x0 + 1, y0, w - 2, h); ctx.fillRect(x0, y0 + 1, w, h - 2);
  ctx.fillRect(cx - 1, tip - 2, 3, 2); ctx.fillRect(cx, tip, 1, 1);
  ctx.fillStyle = '#f4f1ea';
  ctx.fillRect(x0 + 1, y0 + 1, w - 2, h - 2);
  ctx.fillRect(cx, tip - 2, 1, 2);
  ctx.fillStyle = '#ffffff'; ctx.fillRect(x0 + 2, y0 + 1, w - 5, 1);    // glans
  ctx.fillStyle = '#d9d0bc'; ctx.fillRect(x0 + 1, y0 + h - 2, w - 2, 1); // skugga
  if (hot) { ctx.fillStyle = '#ffe07a'; ctx.fillRect(x0 + 1, y0 + 1, 1, h - 3); }
  return [x0 + 1, y0 + 1];
}
function bubbleFood(ctx, d, ix, iy, iw, ih) {
  const f = foodSprite(d);
  ctx.drawImage(f, ix + ((iw - f.width) >> 1), iy + ((ih - f.height) >> 1));
}

// fyra bord (spelets runda bord) med en stol bakom – kunden sitter på stolen,
// vänd mot oss, och får maten på bordet framför sig. Nedre bordet står
// förskjutet så att ingen pratbubbla hamnar över ett annat bord.
const TABLES = [
  { x: 48, y: 146 }, { x: 158, y: 146 }, { x: 268, y: 146 }, { x: 213, y: 200 },
].map((tb) => ({ ...tb, sx: tb.x + 11, sy: tb.y - 8 }));
const TABLE_F = 'bordR2', CHAIR_F = 'stol2', CHAIR_LIFT = 7;
// stolsspriten (13×21): armstöden är kolumn 0–2 och 10–12 på rad 9–16
function drawChair(ctx, tb, armsOnly) {
  const f = FRAMES[CHAIR_F], x = tb.sx - (f[2] >> 1), y = tb.sy + 1 - CHAIR_LIFT - f[3];
  if (!armsOnly) { ctx.drawImage(ATLAS, f[0], f[1], f[2], f[3], x, y, f[2], f[3]); return; }
  ctx.drawImage(ATLAS, f[0], f[1] + 9, 3, 8, x, y + 9, 3, 8);
  ctx.drawImage(ATLAS, f[0] + 10, f[1] + 9, 3, 8, x + 10, y + 9, 3, 8);
}
const PLANT = { x: 356, y: 104 };
const ENTRY_Y = 160;   // kunderna går in i gången mellan bordsraderna

export function makeJobbBurgare(A, { onDone }) {
  const stats = { ok: 0, fel: 0, miss: 0 };
  const walker = createWalker({ top: COUNTER.base + 6, bottom: FH - 6, spawn: [240, 110] });
  walker.setObstacles([
    ...TABLES.map((tb) => [tb.x - 4, tb.y - 16, tb.x + 26, tb.y + 2]),
    [PLANT.x - 2, PLANT.y - 8, PLANT.x + 24, PLANT.y + 1],
  ]);
  const pops = makePops();
  let customers = [], plates = [], t = 0, seq = 0, custIn = 1.5, plateIn = 2.5, carry = null;
  let done = false, doneT = 0, reported = false;
  const bgCache = {};
  const bg = () => (bgCache.x ||= paintDiner());

  function freeTable() { return TABLES.find((tb) => !customers.some((k) => k.table === tb)); }
  // ledig plats på disken – ALDRIG någon annans: är det fullt får rätten vänta i köket.
  // reservedSlot = platsen spelaren är på väg till med sin tallrik (köket rör den inte).
  let reservedSlot = -1;
  function freeSlot() {
    const i = SLOTS.findIndex((_, s) => s !== reservedSlot && !plates.some((p) => p.slot === s));
    return i >= 0 ? i : -1;
  }
  function addPlate(d) { const slot = freeSlot(); if (slot < 0) return false; plates.push({ d, slot, x: SLOTS[slot] }); return true; }
  function leave(k) {
    k.state = 'leave';
    k.path = [[k.table.x - 8, k.table.sy], [k.table.x - 12, k.table.y + 8]];
  }

  return {
    _debug: {
      forceCustomer() { const tb = freeTable(); if (!tb) return null; const k = { look: makeLook(), table: tb, x: tb.sx, y: tb.sy, state: 'sit', wish: (Math.random() * 4) | 0, patience: 30, pmax: 30, eat: 0, path: [], dir: 'down', id: seq++ }; customers.push(k); return k.wish; },
      forcePlate(wish) { addPlate(wish ?? (Math.random() * 4) | 0); return plates.length - 1; },
      pickPlate(i = 0) { const p = plates[i]; if (!p) return null; carry = { d: p.d }; plates.splice(i, 1); return carry; },
      // klick på diskplats i (skärmkoordinater) – för test av byt/ställ ner
      counterSpot(i = 0) { return { x: SLOTS[i], y: COUNTER.base + 4 }; },
      plates: () => plates.map((p) => ({ d: p.d, slot: p.slot })),
      carrying: () => (carry ? carry.d : null),
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
        // in från vänster framför borden, upp på bordets vänstra sida och in på stolen
        if (tb) customers.push({ look: makeLook(), table: tb, x: -12, y: ENTRY_Y, state: 'walk', wish: (Math.random() * 4) | 0, patience: 26, pmax: 26, eat: 0, id: seq++, dir: 'right', path: [[tb.x - 12, ENTRY_Y], [tb.x - 8, tb.sy], [tb.sx, tb.sy]] });
      }
      for (const k of customers) {
        if (k.state === 'walk' || k.state === 'leave') {
          const sp = (k.state === 'walk' ? 34 : 40) * dt, wp = k.path[0];
          if (wp) {
            const dx = wp[0] - k.x, dy = wp[1] - k.y, d = Math.hypot(dx, dy);
            k.dir = Math.abs(dx) >= Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : dy < 0 ? 'up' : 'down';
            if (d <= sp) { k.x = wp[0]; k.y = wp[1]; k.path.shift(); if (!k.path.length && k.state === 'walk') { k.state = 'sit'; k.dir = 'down'; } }
            else { k.x += dx / d * sp; k.y += dy / d * sp; }
          } else if (k.state === 'leave') { k.x -= sp; k.dir = 'left'; }
          else k.state = 'sit';
        } else if (k.state === 'sit') {
          k.patience -= dt;
          if (k.patience <= 0) { leave(k); stats.miss++; play('miss'); pops.add(k.x, k.y - 62, 'GICK HEM…', '#d8d2c0'); }
        } else if (k.state === 'eat') {
          k.eat -= dt;
          if (k.eat <= 0) leave(k);
        }
      }
      customers = customers.filter((k) => k.x > -16);
      // nya tallrikar på disken (bara rätter som någon väntar på + lite slump)
      plateIn -= dt;
      if (plateIn <= 0 && plates.length < SLOTS.length) {
        plateIn = 3.4 - 1.2 * Math.min(1, t / SHIFT_SECONDS);
        const waiting = customers.filter((k) => k.state === 'sit').map((k) => k.wish);
        const d = waiting.length && Math.random() < 0.75 ? waiting[(Math.random() * waiting.length) | 0] : (Math.random() * 4) | 0;
        addPlate(d);
      } else if (plateIn <= 0) {
        plateIn = 0.8; // fullt på disken – köket tittar igen strax
      }
    },
    down(x, y) {
      if (done) return;
      reservedSlot = -1; // en ny order avbryter en pågående nedställningsreservation
      // disken (tallriken eller dess bubbla): plocka upp, byta mot det man bär,
      // eller ställa ner det man bär på en tom plats
      if (y >= SLOT_TIP - 22 && y < COUNTER.base + 14) {
        let best = null, bd = 1e9;
        for (const p of plates) { const d = Math.abs(p.x - x); if (d < 14 && d < bd) { best = p; bd = d; } }
        if (best) {
          walker.walkTo(best.x, COUNTER.base + 12, () => {
            const i = plates.indexOf(best);
            if (i < 0) return;
            if (carry) { plates[i] = { ...best, d: carry.d }; carry = { d: best.d }; play('click'); }
            else { plates.splice(i, 1); carry = { d: best.d }; play('ok'); }
          });
          return;
        }
        if (carry) {
          // närmaste LEDIGA plats, oavsett var på disken man klickar – aldrig någon annans
          let s = -1, sd = 1e9;
          SLOTS.forEach((sx, si) => { const dd = Math.abs(sx - x); if (dd < sd && !plates.some((p) => p.slot === si)) { s = si; sd = dd; } });
          if (s >= 0) {
            reservedSlot = s; // håll platsen åt spelaren tills hen är framme
            walker.walkTo(SLOTS[s], COUNTER.base + 12, () => {
              reservedSlot = -1;
              if (!carry) return;
              // hann platsen tas under gången? ta närmaste andra lediga i stället
              let s2 = plates.some((p) => p.slot === s) ? -1 : s;
              if (s2 < 0) { let bd = 1e9; SLOTS.forEach((sx2, si) => { const dd2 = Math.abs(sx2 - SLOTS[s]); if (dd2 < bd && !plates.some((p) => p.slot === si)) { s2 = si; bd = dd2; } }); }
              if (s2 < 0) { play('miss'); pops.add(SLOTS[s], SLOT_TIP + 10, 'FULLT PÅ DISKEN!', '#ff6a6a'); return; }
              plates.push({ d: carry.d, slot: s2, x: SLOTS[s2] }); carry = null; play('click');
            });
          } else {
            play('miss');
            pops.add(x, SLOT_TIP + 10, 'FULLT PÅ DISKEN!', '#ff6a6a');
          }
          return;
        }
      }
      // servera en kund (klick på bubblan, kunden eller bordet)
      const k = customers.find((c) => c.state === 'sit' && Math.abs(c.x - x) < 16 && y > c.y - 60 && y < c.table.y + 4);
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
      drawSteam(ctx, t);
      // tallrikarna på disken (bubblorna ritas sist, ovanpå allt)
      for (const p of plates) { const s = platedSprite(p.d); ctx.drawImage(s, p.x - (PW >> 1), COUNTER.top + 6 - s.height); }
      const atlasOk = ATLAS && ATLAS.complete && ATLAS.naturalWidth > 0;
      const drawables = [...folkDrawables(A, t), selfDrawable(A, walker, t, { carry: !!carry })];
      // det jag bär: tallriken i händerna (bakom kroppen när jag går uppåt)
      if (carry) {
        const s = platedSprite(carry.d), dir = walker.dir;
        const ox = dir === 'left' ? -7 : dir === 'right' ? 7 : 0;
        const x = Math.round(walker.px) + ox - (PW >> 1), y = Math.round(walker.py) - 12 - (s.height - 1);
        drawables.push({ fy: walker.py + (dir === 'up' ? -0.01 : 0.01), draw: () => ctx.drawImage(s, 0, 0, s.width, s.height - 1, x, y, s.width, s.height - 1) });
      }
      for (const tb of TABLES) {
        const k = customers.find((c) => c.table === tb);
        // stolen: ryggen bakom kunden, armstöden framför (så att stolen syns runt hen)
        if (atlasOk) {
          drawables.push({ fy: tb.sy - 0.5, draw: () => drawChair(ctx, tb, false) });
          drawables.push({ fy: tb.sy + 0.25, draw: () => drawChair(ctx, tb, true) });
        }
        drawables.push({
          fy: tb.y,
          draw: () => {
            if (atlasOk) { const f = FRAMES[TABLE_F]; ctx.drawImage(ATLAS, f[0], f[1], f[2], f[3], tb.x, tb.y - f[3], f[2], f[3]); }
            drawCondiments(ctx, tb.x + 16, tb.y - 15);
            if (k && k.state === 'eat') {
              const s = k.eat > 2 ? platedSprite(k.wish) : restSprite(k.wish);
              ctx.drawImage(s, tb.sx - (PW >> 1), tb.y - 7 - s.height);
            }
          },
        });
      }
      if (atlasOk) drawables.push({ fy: PLANT.y, draw: () => { const f = FRAMES.vaxtS0; ctx.drawImage(ATLAS, f[0], f[1], f[2], f[3], PLANT.x, PLANT.y - f[3], f[2], f[3]); } });
      for (const k of customers) drawables.push({
        fy: k.y,
        draw: () => {
          const moving = k.state === 'walk' || k.state === 'leave';
          const frame = moving ? WALK_SEQ[Math.floor(t * 8.5 + k.id * 0.37) % 4] : k.state === 'eat' ? 6 : 5;
          drawPerson(ctx, k.x, k.y, k.look, moving ? k.dir : 'down', frame);
        },
      });
      drawables.sort((a, b) => a.fy - b.fy).forEach((d) => d.draw(ctx));
      // pratbubblor: disken (fasta platser) + sittande kunder – aldrig ovanpå varandra
      for (const p of plates) {
        const [ix, iy] = bubble(ctx, p.x, SLOT_TIP, 18, 16);
        bubbleFood(ctx, p.d, ix, iy, 18, 16);
      }
      for (const k of customers) {
        if (k.state !== 'sit') continue;
        const hot = !!carry && carry.d === k.wish;
        const cx = Math.round(k.x), tip = Math.round(k.y) - 36 - (hot && (t * 4 | 0) % 2 ? 1 : 0);
        const [ix, iy] = bubble(ctx, cx, tip, 18, 19, hot);
        bubbleFood(ctx, k.wish, ix, iy, 18, 16);
        // tålamodsmätare
        const left = Math.max(0, Math.min(1, k.patience / (k.pmax || 26)));
        ctx.fillStyle = '#cfc6b2'; ctx.fillRect(ix + 2, iy + 16, 14, 2);
        ctx.fillStyle = left > 0.5 ? '#45b964' : left > 0.27 ? '#f0b429' : '#d9433b';
        ctx.fillRect(ix + 2, iy + 16, Math.max(1, Math.round(14 * left)), 2);
        if (k.patience < 8 && Math.sin(t * 6) > 0) {
          ctx.fillStyle = '#17151a'; ctx.fillRect(ix + 17, iy - 4, 5, 10);
          ctx.fillStyle = '#d9433b'; ctx.fillRect(ix + 18, iy - 3, 3, 5); ctx.fillRect(ix + 18, iy + 3, 3, 2);
        }
      }
      pops.draw(ctx);
      drawShiftHud(ctx, { W: FW }, { t, dur: SHIFT_SECONDS, ok: stats.ok, fel: stats.fel, title: 'BURGARBAREN' });
      if (done) drawTimeUp(ctx, { W: FW, H: FH });
    },
  };

  function serveTo(k) {
    if (carry.d === k.wish) {
      stats.ok++;
      play('coin');
      pops.add(k.x, k.y - 62, '+10 TACK!', '#8ee03c');
      k.state = 'eat'; k.eat = 4;
    } else {
      stats.fel++;
      play('fel');
      pops.add(k.x, k.y - 62, 'FEL RÄTT!', '#ff6a6a');
    }
    carry = null;
  }
}

// ketchup och senap på varje bord
function drawCondiments(ctx, x, y) {
  ctx.fillStyle = '#5a1414'; ctx.fillRect(x, y - 5, 3, 6);
  ctx.fillStyle = '#d9302a'; ctx.fillRect(x, y - 4, 2, 4);
  ctx.fillStyle = '#ff7a6a'; ctx.fillRect(x, y - 4, 1, 2);
  ctx.fillStyle = '#f4f1ea'; ctx.fillRect(x + 1, y - 6, 1, 1);
  ctx.fillStyle = '#6a5010'; ctx.fillRect(x + 3, y - 5, 3, 6);
  ctx.fillStyle = '#f0c428'; ctx.fillRect(x + 3, y - 4, 2, 4);
  ctx.fillStyle = '#fff09a'; ctx.fillRect(x + 3, y - 4, 1, 2);
  ctx.fillStyle = '#d83a2a'; ctx.fillRect(x + 4, y - 6, 1, 1);
}

// ånga som stiger från grillen i köket
function drawSteam(ctx, t) {
  for (let i = 0; i < 6; i++) {
    const ph = (t * 0.7 + i * 0.29) % 1, bx = 214 + (i % 3) * 13;
    const x = bx + Math.round(Math.sin(t * 2.3 + i * 1.7) * 1.5), y = 55 - Math.round(ph * 14);
    ctx.fillStyle = `rgba(255,255,255,${(0.45 * (1 - ph)).toFixed(2)})`;
    ctx.fillRect(x, y, 1 + (ph > 0.5 ? 1 : 0), 1);
  }
}

function paintDiner() {
  const P = new Pix(FW, FH);
  const B = COUNTER.base;
  // ---------- väggen ----------
  for (let y = 0; y < B; y++) for (let x = 0; x < FW; x++) {
    let c;
    if (y < 20) c = mix(0x2a2230, 0x3a2e3c, y / 20);                                      // tak (under rubriken)
    else if (y < 22) c = y === 20 ? 0xe8eef2 : 0x8e98a4;                                   // kromlist
    else if (y < 44) c = mix(0x8ad6c6, 0x62b2a3, (y - 22) / 22 + (bayer(x, y) - 0.5) * 0.22); // mintgrön vägg
    else if (y < 46) c = y === 44 ? 0xeef3f6 : 0x98a2ae;
    else if (y < 52) c = (((x >> 2) + (((y - 46) / 3) | 0)) & 1) ? 0xf4f1ea : 0x17151a; // schackbård
    else if (y < 54) c = y === 52 ? 0xeef3f6 : 0x98a2ae;
    else {                                                                                  // röd bröstpanel
      c = mix(0xb8323a, 0x962630, (y - 54) / 26 + (bayer(x, y) - 0.5) * 0.2);
      if (x % 24 === 0) c = mul(c, 0.78); else if (x % 24 === 1) c = mix(c, 0xffffff, 0.14);
      if (y >= 80) c = y === 80 ? 0xe8eef2 : y === 81 ? 0x8e98a4 : 0x3a2230;              // golvlist
    }
    P.px(x, y, c);
  }
  // ---------- pendellampor med varmt ljus ----------
  for (const lx of LAMPS) {
    P.ell(lx + 0.5, 36, 13, 9, 0xfff0b8, 0.3);
    P.vl(lx, 20, 6, 0x2a2430);
    P.rect(lx - 1, 26, 3, 1, 0x7a1a22);
    P.rect(lx - 2, 27, 5, 1, 0xc8323a); P.px(lx - 1, 27, 0xff6a6a);
    P.rect(lx - 3, 28, 7, 2, 0xc8323a); P.px(lx - 3, 28, 0xff6a6a); P.px(lx - 2, 28, 0xff8a8a); P.hl(lx - 3, 29, 7, 0x9a2028);
    P.rect(lx - 1, 30, 3, 1, 0xfff2b0); P.px(lx, 31, 0xffe07a);
  }
  // ---------- köket (höger om disken) ----------
  const KX = 206, KW = 76;
  for (let y = 22; y < 58; y++) for (let x = KX; x < KX + KW; x++) {                    // kakel
    const gl = (x - KX) % 5 === 4 || (y - 22) % 4 === 3;
    P.px(x, y, gl ? 0xc4cac8 : mix(0xf4f6f2, 0xe2e6e2, hash(x >> 2, y >> 2, 9) * 0.6));
  }
  P.box(KX - 1, 21, KW + 2, 38, 0x5a646e);
  // köksfläkt
  for (let y = 22; y < 31; y++) { const ins = Math.max(0, 30 - y - 4); P.hl(KX + 2 + ins, y, KW - 4 - ins * 2, y === 22 ? 0xe8eef2 : mix(0xc4ccd4, 0x8e98a4, (y - 22) / 9)); }
  P.hl(KX + 2, 31, KW - 4, 0x5a646e);
  P.rect(KX + KW / 2 - 10, 24, 21, 7, 0x17151a);
  text(P, SMALL, 'KÖK', KX + KW / 2 - 5, 25, 0xffd23f);
  // orderlist med lappar
  P.hl(KX + 4, 35, KW - 8, 0x98a2ae); P.hl(KX + 4, 34, KW - 8, 0xeef3f6);
  for (const [lx, lh] of [[KX + 8, 7], [KX + 18, 6], [KX + 44, 8], [KX + 60, 6]]) {
    P.rect(lx, 36, 7, lh, 0xfffdf4); P.hl(lx, 36 + lh, 7, 0xc8c2b2);
    for (let r = 38; r < 35 + lh; r += 2) P.hl(lx + 1, r, 3 + ((r + lx) % 3), 0x8a8478);
  }
  // grillen (plattan) och fritösen
  P.rect(KX + 2, 52, 44, 6, 0x4a4e56); P.hl(KX + 2, 52, 44, 0x7a808a); P.hl(KX + 2, 57, 44, 0x2a2d33);
  for (let i = 0; i < 3; i++) { const px = KX + 6 + i * 13; P.rect(px, 53, 8, 3, 0x6a3a22); P.hl(px + 1, 53, 6, 0x8e5230); P.px(px, 55, 0x4a2414); P.px(px + 7, 55, 0x4a2414); }
  P.rect(KX + 50, 50, 24, 8, 0x8e98a4); P.box(KX + 50, 50, 24, 8, 0x5a646e);
  P.rect(KX + 52, 52, 20, 3, 0xe0a030); P.hl(KX + 52, 52, 20, 0xffd060);
  for (const bx of [KX + 54, KX + 63]) { P.rect(bx, 46, 1, 6, 0x2a2d33); P.rect(bx - 1, 45, 3, 1, 0x17151a); P.rect(bx + 1, 51, 5, 2, 0xc8c8c8); }
  // skåpen under
  for (let y = 58; y < B; y++) for (let x = KX - 1; x < KX + KW + 1; x++) {
    let c = y < 60 ? (y === 58 ? 0xeef3f6 : 0x8e98a4) : mix(0xc4ccd4, 0x9aa4ae, (y - 60) / 24 + (bayer(x, y) - 0.5) * 0.15);
    if (y >= 60 && ((x - KX) % 25 === 0)) c = 0x6a747e;
    if (y >= 81) c = y === 81 ? 0x6a747e : 0x2a2d33;
    P.px(x, y, c);
  }
  for (let i = 0; i < 3; i++) { P.rect(KX + 10 + i * 25, 66, 5, 2, 0x5a646e); P.hl(KX + 10 + i * 25, 66, 5, 0xeef3f6); }
  // ---------- menytavlan ----------
  const MX = 288, MY = 22, MW = 92, MH = 35;
  P.rect(MX, MY, MW, MH, 0x5a3a20); P.box(MX, MY, MW, MH, 0x3a2414); P.hl(MX + 1, MY + 1, MW - 2, 0x8a5a30);
  for (let y = MY + 2; y < MY + MH - 2; y++) for (let x = MX + 2; x < MX + MW - 2; x++) P.px(x, y, mix(0x1e2a24, 0x26342c, hash(x, y, 5) * 0.8));
  text(P, SMALL, 'MENY', MX + (MW >> 1) - (textW(SMALL, 'MENY') >> 1), MY + 4, 0xffd23f);
  for (let x = MX + 8; x < MX + MW - 8; x += 2) P.px(x, MY + 11, 0x5a6a60);
  // ---------- disken ----------
  const { x0, x1, top } = COUNTER;
  for (let y = top; y < B; y++) for (let x = x0; x < x1; x++) {
    let c;
    if (y === top) c = 0xfffaf0;
    else if (y < top + 5) c = mix(0xf0e8d8, 0xe2d8c4, (y - top) / 5 + (hash(x, y, 2) - 0.5) * 0.3);   // laminat
    else if (y === top + 5) c = 0xeef3f6;
    else if (y === top + 6) c = 0x8e98a4;
    else if (y >= B - 3) c = y === B - 3 ? 0xd8b24a : y === B - 2 ? 0x7a5a24 : 0x2a1a1e;              // sparklist
    else {
      c = mix(0xc0262e, 0x8e1a22, (y - top - 7) / 17);                                                // rödplisserad front
      const k = (x - x0) % 6;
      if (k === 0) c = mul(c, 0.7); else if (k === 1) c = mix(c, 0xffffff, 0.16);
      if (y === top + 13 || y === top + 14) c = y === top + 13 ? 0xeef3f6 : 0x98a2ae;                 // kromband
    }
    if (x === x0 || x === x1 - 1) c = mul(c, 0.75);
    P.px(x, y, c);
  }
  for (const lx of LAMPS) P.ell(lx + 0.5, top + 3, 16, 3, 0xffd890, 0.35);   // lampskenet på disken
  // ---------- schackrutigt golv ----------
  for (let y = B; y < FH; y++) for (let x = 0; x < FW; x++) {
    const cx2 = ((x / 16) | 0) + (((y - B) / 12) | 0);
    let c = cx2 % 2 ? 0xd8d2c6 : 0xb8302e;
    c = mul(c, 0.95 + hash(x, y, 4) * 0.08);
    if (y < B + 4) c = mul(c, 0.78 + (y - B) * 0.055);   // skugga under väggen
    P.px(x, y, c);
  }
  P.box(0, 0, FW, FH, 0x0e0d12);
  const cv = P.flush(), c2 = cv.getContext('2d');
  // rätterna på menytavlan (samma sprites som på tallrikarna)
  for (let d = 0; d < DISHES.length; d++) {
    const f = foodSprite(d), cx = MX + 13 + d * 22;
    c2.drawImage(f, cx - (f.width >> 1), MY + 26 - f.height);
    ctxText(c2, SMALL, '10:-', cx - (textW(SMALL, '10:-') >> 1), MY + 28, '#f4f1ea');
  }
  return cv;
}

// borden ritas ovanpå bg varje frame (sprites) – exporteras för ev. andra vyer
export function drawTables(ctx) {
  if (!ATLAS || !ATLAS.complete) return;
  for (const tb of TABLES) {
    const f = FRAMES[TABLE_F];
    drawChair(ctx, tb, false);
    ctx.drawImage(ATLAS, f[0], f[1], f[2], f[3], tb.x, tb.y - f[3], f[2], f[3]);
  }
}

// Menyn utåt: Burgarbarens fasad i staden (js/city/buildings-work.js) visar samma
// rätter och priser som menytavlan här inne. sprite = rätten med kontur (samma
// canvas som på tavlan och i pratbubblorna), map/pal = pixelkartan för egna
// varianter. Priset är det som paintDiner skriver på tavlan ('10:-') – ändras
// det där ska det ändras här också.
export function burgarMeny() {
  return {
    title: 'MENY',
    dishes: DISHES.map((d, i) => ({ id: d.id, name: d.name, price: 10, label: '10:-', sprite: foodSprite(i), map: d.map, pal: d.pal })),
  };
}
