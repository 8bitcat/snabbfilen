// Gå-motorn: samma rutnäts-A* och figurstyrning som hemma, för alla gåbara
// miljöer (staden, butikerna, jobben). En scen skapar en walker, matar in
// hinder-rektanglar och får gång med utslätade vägar. Dessutom gemensam
// ritning av andra spelare (världen) och namnskyltar/pratbubblor.
import { drawPerson } from '../core/people.js';
import { drawRide, rideLift } from '../core/fordon-art.js';   // cykeln/moppen i staden
import { avatarTagColors } from '../core/avatar.js';
import { SMALL, ctxText, textW } from '../core/floor-pix.js';
import { worldFolksHere, worldMyEmote, worldMySay } from '../net/world.js';
import { speak, heardBubble, guessAnimal, selfTalkMode } from '../core/voices.js';

// Ljud när en pratbubbla dyker upp: heardBubble(text, x, y, voice, { pan, gain }) anropas
// varje bildruta bubblan syns – första gången hörs simspråks-babbel, sedan tystnad tills
// texten byts. voice = avatar/look/namn/'self' (utelämnad = gissning på text + läge).
// sayBubble gör det själv (se nedan), så det behövs bara för bubblor som ritas på annat sätt.
export { heardBubble } from '../core/voices.js';

export const WALK_SEQ = [1, 3, 2, 3];
const FW = 384, FH = 216;
let selfAt = null; // var den egna figuren stod senast (selfDrawable) – för rösten i createSpeech

// W/H = världens storlek (standard = en skärm; staden är större och rullar).
export function createWalker({ W: WW = FW, H: WH = FH, left = 8, right = WW - 8, top = 90, bottom = WH - 4, spawn }) {
  const CELL = 4, GW = Math.ceil(WW / CELL), GH = Math.ceil(WH / CELL);
  let freeGrid = new Uint8Array(GW * GH);
  let obstacles = [];
  function setObstacles(list) {
    obstacles = list;
    freeGrid = new Uint8Array(GW * GH);
    for (let gy = 0; gy < GH; gy++) for (let gx = 0; gx < GW; gx++) {
      const x = gx * CELL + 2, y = gy * CELL + 2;
      let ok = x > left && x < right && y > top && y < bottom;
      if (ok) for (const [x0, y0, x1, y1] of obstacles) if (x > x0 - 2 && x < x1 + 2 && y > y0 - 2 && y < y1 + 2) { ok = false; break; }
      freeGrid[gy * GW + gx] = ok ? 1 : 0;
    }
  }
  setObstacles([]);
  const walkable = (x, y) => !!freeGrid[Math.max(0, Math.min(GH - 1, (y / CELL) | 0)) * GW + Math.max(0, Math.min(GW - 1, (x / CELL) | 0))];
  function nearestFree(x, y) {
    if (walkable(x, y)) return [x, y];
    for (let r = 1; r < 50; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
      const nx = x + dx * CELL, ny = y + dy * CELL;
      if (nx > 0 && ny > 0 && nx < WW && ny < WH && walkable(nx, ny)) return [nx, ny];
    }
    return [x, y];
  }
  const los = (ax, ay, bx, by) => {
    const n = Math.ceil(Math.hypot(bx - ax, by - ay) / 2);
    for (let i = 1; i < n; i++) if (!walkable(ax + (bx - ax) * i / n, ay + (by - ay) * i / n)) return false;
    return true;
  };
  function findPath(sx, sy, tx, ty) {
    [tx, ty] = nearestFree(tx, ty);
    if (los(sx, sy, tx, ty)) return [[tx, ty]];
    const cellOf = (x, y) => [Math.max(0, Math.min(GW - 1, (x / CELL) | 0)), Math.max(0, Math.min(GH - 1, (y / CELL) | 0))];
    const [s0, s1] = cellOf(...nearestFree(sx, sy)), [t0, t1] = cellOf(tx, ty);
    const from = new Map([[s1 * GW + s0, -1]]);
    const q = [s1 * GW + s0];
    const goal = t1 * GW + t0;
    while (q.length) {
      const cur = q.shift();
      if (cur === goal) break;
      const cx = cur % GW, cy = (cur / GW) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        const nx = cx + dx, ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= GW || ny >= GH) continue;
        const ni = ny * GW + nx;
        if (!freeGrid[ni] || from.has(ni)) continue;
        if (dx && dy && (!freeGrid[cy * GW + nx] || !freeGrid[ny * GW + cx])) continue;
        from.set(ni, cur);
        q.push(ni);
      }
    }
    if (!from.has(goal)) return los(sx, sy, tx, ty) ? [[tx, ty]] : [];
    const cells = [];
    for (let i = goal; i !== -1; i = from.get(i)) cells.push([(i % GW) * CELL + 2, ((i / GW) | 0) * CELL + 2]);
    cells.reverse();
    cells[cells.length - 1] = [tx, ty];
    const out = [];
    let ax = sx, ay = sy, i = 0;
    while (i < cells.length) {
      let j = cells.length - 1;
      while (j > i && !los(ax, ay, cells[j][0], cells[j][1])) j--;
      out.push(cells[j]); [ax, ay] = cells[j]; i = j + 1;
    }
    return out;
  }

  const W = {
    px: spawn?.[0] ?? 100, py: spawn?.[1] ?? 150,
    dir: 'down', path: [], onArrive: null, speed: 62,
    setObstacles, walkable, nearestFree, findPath,
    snapFree() { [W.px, W.py] = nearestFree(W.px, W.py); },
    walkTo(x, y, cb) {
      W.path = findPath(W.px, W.py, x, y);
      W.onArrive = cb || null;
      if (!W.path.length) { const d = W.onArrive; W.onArrive = null; d?.(); }
    },
    stop() { W.path = []; W.onArrive = null; },
    update(dt) {
      if (!W.path.length) return false;
      const [gx, gy] = W.path[0];
      const dx = gx - W.px, dy = gy - W.py, dist = Math.hypot(dx, dy), step = W.speed * dt;
      W.dir = Math.abs(dx) > Math.abs(dy) * 1.2 ? (dx < 0 ? 'left' : 'right') : dy < 0 ? 'up' : 'down';
      if (dist <= step) {
        W.px = gx; W.py = gy;
        W.path.shift();
        if (!W.path.length) { W.dir = 'down'; const cb = W.onArrive; W.onArrive = null; cb?.(); }
      } else { W.px += dx / dist * step; W.py += dy / dist * step; }
      return true;
    },
  };
  W.snapFree();
  return W;
}

// Min figur som drawable (med namnskylt när andra är här, bär-frames vid carry).
// ride = { id, c }: figuren åker på ett fordon (game.js FORDON) – det står kvar åt det håll man
// åkte när man stannar (gående vänder sig mot kameran).
let rideDir = 'right';
export function selfDrawable(A, walker, t, { carry = false, folksHere = 0, ride = null } = {}) {
  if (ride) {
    selfAt = { x: walker.px, y: walker.py, scene: A?.sceneName ?? null };
    const moving = walker.path.length > 0;
    if (moving) rideDir = walker.dir;
    const lift = rideLift(ride.id);
    return {
      fy: walker.py,
      draw(ctx) {
        if (!drawRide(ctx, ride.id, walker.px, walker.py, rideDir, t, moving, A.avatar.look, ride.c)) drawPerson(ctx, walker.px, walker.py, A.avatar.look, walker.dir, 0);
        if (folksHere) nameTag(ctx, walker.px, walker.py - 50 - lift, A.avatar);
        const mine = worldMyEmote();
        if (mine) emoteBubble(ctx, walker.px, walker.py - 60 - lift, mine);
        const said = worldMySay();
        if (said) sayBubble(ctx, walker.px, walker.py - (mine ? 78 : 62) - lift, said, { voice: 'self' });
      },
    };
  }
  selfAt = { x: walker.px, y: walker.py, scene: A?.sceneName ?? null }; // repliker ovanför mig = min röst
  return {
    fy: walker.py,
    draw(ctx) {
      const walking = walker.path.length > 0;
      const frame = carry
        ? (walking ? [7, 9, 8, 9][Math.floor(t * 8.5) % 4] : 9)
        : walking ? WALK_SEQ[Math.floor(t * 8.5) % 4] : (Math.sin(t * 2) > 0.9 ? 4 : 0);
      drawPerson(ctx, walker.px, walker.py, A.avatar.look, walker.dir, frame);
      if (folksHere) nameTag(ctx, walker.px, walker.py - 50, A.avatar);
      const mine = worldMyEmote();
      if (mine) emoteBubble(ctx, walker.px, walker.py - 60, mine);
      const said = worldMySay();
      if (said) sayBubble(ctx, walker.px, walker.py - (mine ? 78 : 62), said, { voice: 'self' });
    },
  };
}
// Andra spelare på samma plats som drawables
const folkDir = new Map();   // andra spelares färdriktning på fordon (id → dir)
export function folkDrawables(A, t) {
  return worldFolksHere(A).map((f) => ({
    fy: f.y,
    draw(ctx) {
      // sitter spelaren (world.js si): sittande på platsen, tuggar då och då om maten står framme
      const seated = f.sit && !f.walking;
      // på cykel/moppe: åt det håll de rör sig (står de still: dit de senast åkte)
      if (f.ride && !seated) {
        const dx = f.tx - f.x, dy = f.ty - f.y;
        if (f.walking) folkDir.set(f.id, Math.abs(dx) > Math.abs(dy) * 1.2 ? (dx < 0 ? 'left' : 'right') : dy < 0 ? 'up' : 'down');
        if (drawRide(ctx, f.ride.id, f.x, f.y, folkDir.get(f.id) || 'right', t, f.walking, f.av.look, f.ride.c)) {
          const lift = rideLift(f.ride.id);
          nameTag(ctx, f.x, f.y - 50 - lift, f.av);
          if (f.emote) emoteBubble(ctx, f.x, f.y - 58 - lift, f.emote);
          if (f.say) sayBubble(ctx, f.x, f.y - (f.emote ? 76 : 60) - lift, f.say, { voice: f.av || f.id });
          return;
        }
      }
      const frame = seated ? (f.eat && Math.floor(t * 1.6 + f.x * 0.37) % 3 === 1 ? 6 : 5) : f.walking ? WALK_SEQ[Math.floor(t * 8.5) % 4] : (Math.sin(t * 2 + f.x) > 0.9 ? 4 : 0);
      drawPerson(ctx, f.x, f.y, f.av.look, seated ? f.sit : 'down', frame);
      nameTag(ctx, f.x, f.y - 50, f.av);
      if (f.emote) emoteBubble(ctx, f.x, f.y - 58, f.emote);
      if (f.say) sayBubble(ctx, f.x, f.y - (f.emote ? 76 : 60), f.say, { voice: f.av || f.id });
    },
  }));
}

// Pratbubbla med text (chatten och NPC-repliker): radbruten pixeltext, högst fyra rader,
// svans nedåt. Fonten har versaler A–Ö, siffror och lite skiljetecken; emoji ritas som små
// 9×9-pixelbilder (systemets emoji nedskalad med hårda kanter, samma pixelkorn som spelet).
const SAY_W = 76, SAY_OK = /[A-ZÅÄÖÉ0-9 \-+!.:,?/%'=]/;
const EMO = new Map();
const isEmoji = (g) => /\p{Extended_Pictographic}|\p{Regional_Indicator}/u.test(g);
const graphemes = (str) => (typeof Intl !== 'undefined' && Intl.Segmenter
  ? [...new Intl.Segmenter('sv', { granularity: 'grapheme' }).segment(str)].map((x) => x.segment) : Array.from(str));
function emojiImg(g) {
  let c = EMO.get(g);
  if (c) return c;
  const big = document.createElement('canvas'); big.width = big.height = 36;
  const bx = big.getContext('2d');
  bx.textAlign = 'center'; bx.textBaseline = 'middle';
  bx.font = '30px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif';
  bx.fillText(g, 18, 20);
  c = document.createElement('canvas'); c.width = c.height = 9;
  const x = c.getContext('2d');
  x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high';
  x.drawImage(big, 0, 0, 36, 36, 0, 0, 9, 9);
  const d = x.getImageData(0, 0, 9, 9);
  for (let i = 3; i < d.data.length; i += 4) d.data[i] = d.data[i] > 96 ? 255 : 0;
  x.putImageData(d, 0, 0);
  EMO.set(g, c);
  return c;
}
// text → rader av tecken: { g, emoji, w }
export function sayLines(text, maxW = SAY_W, maxLines = 4) {
  const clean = String(text).replace(/[–—]/g, '-').replace(/…/g, '...').replace(/[“”"«»]/g, '');
  const toks = [];
  for (const g of graphemes(clean)) {
    if (isEmoji(g)) toks.push({ g, emoji: true, w: 10 });
    else {
      const u = g.toUpperCase();
      if (u === ' ' || /\s/.test(u)) toks.push({ g: ' ', w: 3 });
      else if (SAY_OK.test(u)) toks.push({ g: u, w: textW(SMALL, u) + 1 });
    }
  }
  // ord = följd av icke-mellanslag
  const words = [];
  let cur = [];
  for (const t of toks) { if (t.g === ' ') { if (cur.length) words.push(cur); cur = []; } else cur.push(t); }
  if (cur.length) words.push(cur);
  const lines = [];
  let line = [], lw = 0;
  const wWidth = (w) => w.reduce((a, t) => a + t.w, 0);
  for (let w of words) {
    let ww = wWidth(w);
    if (line.length && lw + 3 + ww > maxW) { lines.push(line); line = []; lw = 0; if (lines.length >= maxLines) break; }
    while (ww > maxW) { // för långt ord: bryt det
      let k = w.length, acc = ww;
      while (k > 1 && acc > maxW - lw) { k--; acc -= w[k].w; }
      line.push(...w.slice(0, k)); lines.push(line); line = []; lw = 0;
      w = w.slice(k); ww = wWidth(w);
      if (lines.length >= maxLines) break;
    }
    if (lines.length >= maxLines) break;
    if (line.length) { line.push({ g: ' ', w: 3 }); lw += 3; }
    line.push(...w); lw += ww;
  }
  if (line.length && lines.length < maxLines) lines.push(line);
  return lines.slice(0, maxLines);
}
// Bubblan hörs också (heardBubble): första bildrutan en ny text syns babblar talaren, en gång.
// voice = avatar/look/namn/'self' (utelämnad = gissning på texten + var bubblan står, så en
// gäst på samma plats låter likadant), voice: false = tyst (ljudet sköts någon annanstans).
// Bubblor utanför bild hörs inte; i bild panoreras rösten lite åt det håll talaren står.
function bubbleHeard(ctx, x, y, text, voice) {
  if (voice === false) return;
  try {
    const m = ctx.getTransform(), cw = ctx.canvas?.width || 0, ch = ctx.canvas?.height || 0;
    const sx = m.a * x + m.c * y + m.e, sy = m.b * x + m.d * y + m.f;
    if (cw && (sx < -8 || sx > cw + 8 || sy < -20 || sy > ch + 80)) return; // utanför bild
    const pan = cw ? Math.max(-1, Math.min(1, sx / cw * 2 - 1)) * 0.45 : 0;
    heardBubble(text, x, y, voice, { pan });
  } catch { /* ljudet är aldrig ett krav */ }
}
export function sayBubble(ctx, x, y, text, { w: maxW = SAY_W, lines: maxLines = 4, x0 = null, x1 = null, voice } = {}) {
  const lines = sayLines(text, maxW, maxLines);
  if (!lines.length) return;
  bubbleHeard(ctx, x, y, text, voice);
  const lh = lines.map((l) => (l.some((t) => t.emoji) ? 10 : 7));
  const w = Math.max(...lines.map((l) => l.reduce((a, t) => a + t.w, 0))) + 7, h = lh.reduce((a, v) => a + v, 0) + 4;
  let bx = Math.round(x - w / 2);
  if (x0 !== null && x1 !== null) bx = Math.max(Math.round(x0) + 2, Math.min(Math.round(x1) - w - 2, bx)); // håll bubblan i bild
  const by = Math.round(y - h - 4);
  ctx.fillStyle = '#17151a'; ctx.fillRect(bx - 1, by - 1, w + 2, h + 2);
  ctx.fillStyle = '#f4f1ea'; ctx.fillRect(bx, by, w, h);
  const tx = Math.round(x);
  ctx.fillStyle = '#17151a'; ctx.fillRect(tx - 2, by + h, 5, 1); ctx.fillRect(tx - 1, by + h + 1, 3, 1); ctx.fillRect(tx, by + h + 2, 1, 1);
  ctx.fillStyle = '#f4f1ea'; ctx.fillRect(tx - 1, by + h, 3, 1);
  let yy = by + 3;
  lines.forEach((l, i) => {
    let xx = bx + 4;
    const emo = lh[i] === 10;
    for (const t of l) {
      if (t.emoji) ctx.drawImage(emojiImg(t.g), xx, yy - 1);
      else if (t.g !== ' ') ctxText(ctx, SMALL, t.g, xx, yy + (emo ? 2 : 0), '#17151a');
      xx += t.w;
    }
    yy += lh[i];
  });
}

export function nameTag(ctx, x, y, av) {
  const c = avatarTagColors(av);
  const w = textW(SMALL, av.name || '?') + 6;
  ctx.fillStyle = c.bg; ctx.fillRect(x - w / 2 | 0, y | 0, w, 9);
  ctxText(ctx, SMALL, av.name || '?', (x - w / 2 | 0) + 3, (y | 0) + 2, c.fg);
}

export function emoteBubble(ctx, x, y, e, k = 1) {
  ctx.fillStyle = '#17151a'; ctx.fillRect(x - 9 * k | 0, y - 15 * k, 18 * k, 16 * k);
  ctx.fillStyle = '#f4f1ea'; ctx.fillRect(x - 8 * k | 0, y - 14 * k, 16 * k, 14 * k);
  ctx.fillStyle = '#f4f1ea'; ctx.fillRect(x - k | 0, y, 3 * k, 3 * k);
  ctx.font = `${10 * k}px "Segoe UI Emoji", sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(e, x, y - 7 * k);
  ctx.textAlign = 'start'; ctx.textBaseline = 'alphabetic';
}

// Pratbubbla med en pixelritad ikon (8×8-karta) – för kunder och tallrikar
export function iconBubble(ctx, x, y, drawIcon, hot = false) {
  ctx.fillStyle = hot ? '#e8b230' : '#17151a'; ctx.fillRect(x - 8 | 0, y - 16, 20, 18);
  ctx.fillStyle = '#f4f1ea'; ctx.fillRect(x - 7 | 0, y - 15, 18, 16);
  ctx.fillStyle = '#f4f1ea'; ctx.fillRect(x - 1 | 0, y + 1, 3, 3);
  drawIcon(ctx, x + 2, y - 7);
}

// Ett pratbubbellager per scen: den senaste repliken visas ovanför en person, ett djur eller
// den egna figuren (at = {x, y} i världskoordinater, eller en funktion som ger läget varje
// bildruta). Ritas med scenens kameratransform; view = { x0, x1 } håller bubblan i bild.
// Repliken hörs också (js/core/voices.js): djuremoji först i texten = djurläte (🐶 skäll,
// 🐱 jam, "spinner" = spinn, 🐰 nos …), annars simspråks-babbel. Står bubblan ovanför den
// egna figuren (som selfDrawable ritade senast) är det min egen, mjukare röst. opts (frivillig
// fjärde parameter till say) = { voice, animal, mood, self, silent, key, max } – voice = look/avatar/
// namn/'self', animal = husdjuret eller 'hund'/'katt'/…, silent = ingen röst. Utan opts gissas
// talaren på texten och rösten hashas på var talaren står, så samma figur låter likadant.
// Egna figurens repliker är oftast tankar och tips ("Stången är bara för att titta …"), så de
// blir bara ett kort, mjukt mummel (högst SELF_MAX s), och samma tanke igen inom SELF_REPEAT s är
// tyst. createSpeech({ selfVoice }) ändrar det för en scen: 'kort' (standard, se setSelfTalk i
// voices.js), 'full' = hela babblet, 'av' eller false = den egna figuren är tyst i scenen.
const SELF_MAX = 1.1, SELF_GAIN = 0.8, SELF_REPEAT = 20;
const selfSaid = new Map(); // tankens text → när den hördes senast (delas av alla scener)
export function createSpeech(cfg = {}) {
  let cur = null, voiceH = null;
  const now = () => performance.now() / 1000;
  const hush = () => { try { voiceH?.stop(0.05); } catch { /* ok */ } voiceH = null; };
  // bubblan ovanför huvudet på den egna figuren: scenerna lägger den 44 px över fötterna
  // (walker.py - 44). Snävt fönster – kassörskan bakom disken står rakt ovanför en när man
  // beställer (ca 65 px upp) och ska inte låta som en själv. Sitter man (ingen selfDrawable)
  // gäller senaste läget i samma scen, nära stolen.
  const overMe = (pos) => {
    if (!pos || !selfAt) return false;
    const sc = globalThis.SF?.sceneName ?? null;
    if (selfAt.scene && sc && selfAt.scene !== sc) return false;
    const dy = pos.y - selfAt.y;
    return Math.abs(pos.x - selfAt.x) <= 12 && dy >= -58 && dy <= -32;
  };
  return {
    say(text, at, secs, opts) {
      const str = String(text || '').trim();
      if (!str || !at) return;
      cur = { text: str, at, until: now() + (secs ?? Math.max(3, Math.min(8, str.length / 12))) };
      hush();
      if (opts?.silent) return;
      try {
        const pos = typeof at === 'function' ? at() : at;
        const key = opts?.key ?? (pos ? '@' + Math.round(pos.x / 16) + ',' + Math.round(pos.y / 16) : undefined);
        const self = opts?.self ?? (opts?.voice === undefined && !opts?.animal && overMe(pos));
        heardBubble(str, pos?.x, pos?.y, false); // registrera bubblan – ljudet spelas här nedanför
        let extra = null, mine = false;
        // min egen röst (inte ett djurläte med djuremoji): kort mummel, samma tanke hörs inte om och om igen
        const animalish = opts?.animal ? true : opts?.animal !== false && !opts?.voice && !!guessAnimal(str);
        if ((self || opts?.voice === 'self') && !animalish) {
          const c = cfg?.selfVoice, mode = c === false ? 'av' : c === true ? 'full' : (c || selfTalkMode());
          if (mode === 'av') return;
          const last = selfSaid.get(str);
          if (last != null && now() - last < SELF_REPEAT) return;
          if (mode !== 'full') extra = { max: opts?.max ?? SELF_MAX, gain: (opts?.gain ?? 1) * SELF_GAIN };
          mine = true;
        }
        voiceH = speak(str, { ...opts, key, self, ...extra });
        if (mine && voiceH) { // bara det som faktiskt hördes räknas (ljud av = inget minne)
          const t = now();
          selfSaid.set(str, t);
          if (selfSaid.size > 40) for (const [k, v] of selfSaid) if (t - v > SELF_REPEAT) selfSaid.delete(k);
        }
      } catch { /* ljudet är aldrig ett krav */ }
    },
    clear() { cur = null; hush(); },
    active: () => !!cur && cur.until > now(),
    text: () => (cur && cur.until > now() ? cur.text : null),
    draw(ctx, view) {
      if (!cur || cur.until <= now()) return;
      const pos = typeof cur.at === 'function' ? cur.at() : cur.at;
      if (!pos) return;
      sayBubble(ctx, pos.x, pos.y, cur.text, { w: 124, lines: 5, x0: view?.x0 ?? null, x1: view?.x1 ?? null, voice: false });
    },
  };
}
