// LYCKOSKRAP – skraplotterna som säljs vid närbutikens disk (js/scenes/shop-narbutik.js).
// En lott kostar LOTT_PRIS. Sex rutor är täckta med silver; man skrapar med musen eller
// fingret. Tre lika belopp = man vinner beloppet (100, 500 eller 1 000 kr – liten chans).
//
// RÄTTVIS SLUMP MED SEED PER DAG: varje sparfil får ett eget salt första gången man köper en
// lott. Lott nummer n (0, 1, 2 …) dag d har ett förutbestämt utfall ur mix32(salt, d, n) –
// hur man skrapar, när man köper eller om man laddar om spelet ändrar ingenting. Räknaren n
// sparas vid köpet, så ett nytt försök efter omladdning ger nästa lott i dagens följd.
// Högst LOTT_PER_DAG lotter per dag (rullen tar slut).
//
// Tillståndet g.lott = { salt, dag, n, open, kopt, vunnit } sparas med spelet (game.js-patchen
// tar med fältet vid laddning; utan patchen hämtas det ur g._keep.top – som banken gör).
// open = { dag, n, prize, fields, skrap } är en köpt lott som inte är färdigskrapad: den finns
// kvar tills man skrapat klart (eller går ut – då skrapas den klart i farten och betalas ut).
import { Pix, SMALL, BIG, text, textW, ctxText, mix, mul, hash, bayer } from '../core/floor-pix.js';

export const LOTT_PRIS = 25, LOTT_PER_DAG = 10;
// vinstplanen: sannolikhet per lott (resten = ingen vinst). Förväntat värde ≈ 18,6 kr av 25.
export const LOTT_VINSTER = [{ kr: 1000, p: 1 / 250 }, { kr: 500, p: 1 / 80 }, { kr: 100, p: 1 / 12 }];
const FILLERS = [25, 50, 100, 250, 500, 1000];

// 32-bitars blandning (tydlig och snabb, samma i alla webbläsare)
export function mix32(...vals) {
  let h = 0x811c9dc5;
  for (const v of vals) {
    h ^= v >>> 0; h = Math.imul(h, 0x01000193);
    h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d);
    h ^= h >>> 12; h = Math.imul(h, 0x297a2d39);
    h ^= h >>> 15;
  }
  return h >>> 0;
}
const unit = (...v) => mix32(...v) / 4294967296;
// dagens frö ur sparfilens salt
export const daySeed = (salt, day) => mix32(salt >>> 0, day | 0, 0x10771);
// vinsten för lott n dag d (0 = ingen vinst)
export function lottPrize(salt, day, n) {
  const u = unit(daySeed(salt, day), n | 0, 1);
  let acc = 0;
  for (const v of LOTT_VINSTER) { acc += v.p; if (u < acc) return v.kr; }
  return 0;
}
// de sex rutornas belopp: vinst = exakt tre rutor med vinstbeloppet, aldrig tre lika av något annat
export function lottFields(salt, day, n, prize = lottPrize(salt, day, n)) {
  const s = daySeed(salt, day), out = new Array(6).fill(0), count = new Map();
  if (prize) {
    const idx = [0, 1, 2, 3, 4, 5].sort((a, b) => unit(s, n, 10 + a) - unit(s, n, 10 + b)).slice(0, 3);
    for (const i of idx) out[i] = prize;
    count.set(prize, 3);
  }
  for (let i = 0; i < 6; i++) {
    if (out[i]) continue;
    const pool = FILLERS.filter((v) => v !== prize && (count.get(v) || 0) < 2);
    const v = pool[Math.floor(unit(s, n, 30 + i) * pool.length) % pool.length];
    out[i] = v; count.set(v, (count.get(v) || 0) + 1);
  }
  return out;
}
// vinnande belopp i en rad rutor (tre eller fler lika), annars 0
export const winOf = (fields) => { const c = new Map(); for (const v of fields) c.set(v, (c.get(v) || 0) + 1); for (const [v, k] of c) if (k >= 3) return v; return 0; };

// ---------- tillståndet i sparfilen ----------
function clean(raw) {
  const r = raw && typeof raw === 'object' ? raw : {};
  const o = {
    salt: Number.isInteger(r.salt) && r.salt > 0 ? r.salt >>> 0 : 0,
    dag: Math.max(0, r.dag | 0), n: Math.max(0, r.n | 0), kopt: Math.max(0, r.kopt | 0), vunnit: Math.max(0, Math.round(+r.vunnit || 0)), open: null,
  };
  const p = r.open;
  if (p && typeof p === 'object' && (p.dag | 0) > 0) o.open = { dag: p.dag | 0, n: Math.max(0, p.n | 0), prize: Math.max(0, p.prize | 0), fields: Array.isArray(p.fields) && p.fields.length === 6 ? p.fields.map((v) => v | 0) : null };
  return o;
}
// g.lott, alltid giltigt (skapas vid första lotten)
export function lottOf(g) {
  if (!g.lott || typeof g.lott !== 'object' || g.lott.__ok !== LOTT_PRIS) {
    const raw = g.lott ?? g._keep?.top?.lott ?? null; // utan game.js-patchen ligger fältet i _keep
    const o = clean(raw);
    Object.defineProperty(o, '__ok', { value: LOTT_PRIS, enumerable: false });
    g.lott = o;
  }
  const L = g.lott;
  if (!L.salt) L.salt = (Math.floor(Math.random() * 0x7ffffffe) + 1) >>> 0;
  if (L.dag !== g.day) { L.dag = g.day; L.n = 0; } // ny dag: ny rulle
  if (L.open && !L.open.fields) L.open.fields = lottFields(L.salt, L.open.dag, L.open.n, L.open.prize);
  return L;
}
export const lottLeft = (g) => Math.max(0, LOTT_PER_DAG - lottOf(g).n);
// köp en lott: pengarna dras, lotten sparas som öppen (inte skrapad)
export function buyLott(g) {
  const L = lottOf(g);
  if (L.open) return { ok: false, msg: 'Skrapa klart lotten du har först!', open: L.open };
  if (L.n >= LOTT_PER_DAG) return { ok: false, msg: `Rullen är slut för i dag – högst ${LOTT_PER_DAG} lotter per dag.` };
  if (g.money < LOTT_PRIS) return { ok: false, msg: `En lott kostar ${LOTT_PRIS} kr – du har inte råd.` };
  const n = L.n, prize = lottPrize(L.salt, g.day, n);
  g.money -= LOTT_PRIS;
  L.n = n + 1; L.kopt += 1;
  L.open = { dag: g.day, n, prize, fields: lottFields(L.salt, g.day, n, prize) };
  g.save?.();
  return { ok: true, ticket: L.open };
}
// lotten är färdigskrapad: vinsten betalas ut
export function settleLott(g) {
  const L = lottOf(g), o = L.open;
  if (!o) return { ok: false, prize: 0 };
  const prize = winOf(o.fields) === o.prize ? o.prize : 0; // rutorna och vinsten hör alltid ihop
  L.open = null;
  if (prize) { g.money += prize; L.vunnit += prize; }
  g.save?.();
  return { ok: true, prize, n: o.n, dag: o.dag };
}

// ================= själva lotten på skärmen =================
const TW = 172, TH = 110;
const FW = 46, FH = 24;                      // en ruta
const FX = (i) => 9 + (i % 3) * 52, FY = (i) => 31 + Math.floor(i / 3) * 29;
const OUT = 0x17151a;
const GOLD = [0x6a4a0a, 0x9a7414, 0xd0a42a, 0xf4d050, 0xfff4b0];
const GREEN = [0x0a3a22, 0x125a34, 0x1e7a4a, 0x3aa86a, 0x7ad89a];
const SILVER = [0x5a5e68, 0x8a8e98, 0xb4b8c2, 0xd4d8e0, 0xf0f2f6];
const tone = (pal, v, x, y) => { const f = Math.max(0, Math.min(0.999, v)) * (pal.length - 1); let i = Math.floor(f); if (f - i > 0.25 + bayer(x, y) * 0.5) i++; return pal[Math.min(pal.length - 1, i)]; };
const hexs = (c) => '#' + (c & 0xffffff).toString(16).padStart(6, '0');
// fyrklöver: fyra hjärtformade blad och en stjälk
function clover(P, cx, cy, s, c0, c1) {
  for (let y = -s * 2; y <= s * 2; y++) for (let x = -s * 2; x <= s * 2; x++) {
    const inLeaf = [[-1, -1], [1, -1], [-1, 1], [1, 1]].some(([dx, dy]) => Math.hypot(x - dx * s * 0.9, y - dy * s * 0.9) < s * 0.95);
    if (inLeaf) P.px(cx + x, cy + y, (x + y) < 0 ? c1 : c0);
  }
  for (let k = 0; k <= s * 1.6; k++) P.px(cx + Math.round(k * 0.5), cy + s + k, c0);
  P.px(cx, cy, mix(c1, 0xffffff, 0.4));
}
// text i guld: ljus överdel, mörkare underdel (BIG, en pixel per pixel)
function eachGold(P, s, x, y) {
  let cx = x;
  for (const ch of s) {
    text(P, BIG, ch, cx, y, GOLD[2]);
    // ljusa överkanten: rita om de översta raderna i ljusare guld
    const tmp = new Pix(8, 9);
    text(tmp, BIG, ch, 0, 0, 0xffffff);
    for (let j = 0; j < 3; j++) for (let i = 0; i < 8; i++) if (tmp.d[(j * 8 + i) * 4 + 3]) P.px(cx + i, y + j, j === 0 ? GOLD[4] : GOLD[3]);
    cx += textW(BIG, ch) + 1;
  }
}
let TICKET_BG = null;
function ticketBg() {
  if (TICKET_BG) return TICKET_BG;
  const P = new Pix(TW, TH);
  for (let y = 0; y < TH; y++) for (let x = 0; x < TW; x++) {
    const e = Math.min(x, y, TW - 1 - x, TH - 1 - y);
    let c;
    if (e === 0) c = OUT;
    else if (e < 3) c = tone(GOLD, 0.85 - (x + y) / (TW + TH) * 0.6, x, y);
    else if (e === 3) c = GOLD[0];
    else {
      c = tone(GREEN, 0.62 - y / TH * 0.35 + (((x >> 2) + (y >> 2)) % 2 ? 0.04 : 0), x, y);
      if ((x * 7 + y * 3) % 29 === 0) c = mix(c, 0xffffff, 0.25); // små glittrande prickar
    }
    P.px(x, y, c);
  }
  // hörnen: stansade halvcirklar (som en riktig lott)
  for (const [cx, cy] of [[0, 0], [TW - 1, 0], [0, TH - 1], [TW - 1, TH - 1]]) for (let y = -3; y <= 3; y++) for (let x = -3; x <= 3; x++) if (Math.hypot(x, y) < 3.2) { const X = cx + x, Y = cy + y; if (X >= 0 && Y >= 0 && X < TW && Y < TH) P.d[(Y * TW + X) * 4 + 3] = 0; }
  // rubriken LYCKOSKRAP i guld med skugga, klöver på båda sidor
  // guldbokstäver med mörk kontur runt om och en ljusare överkant
  const T = 'LYCKOSKRAP', tw = textW(BIG, T), tx = (TW - tw) >> 1, ty = 8;
  for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [1, 1], [2, 2], [1, 2]]) text(P, BIG, T, tx + ox, ty + oy, 0x06200f);
  eachGold(P, T, tx, ty);
  // en guldbåge (banderoll) under rubriken
  for (let x = tx - 6; x < tx + tw + 6; x++) { const y = ty + 10 + Math.round(Math.sin((x - tx + 6) / (tw + 12) * Math.PI) * 2); P.px(x, y, GOLD[3]); P.px(x, y + 1, GOLD[1]); }
  clover(P, 13, 12, 3, 0x2a9a4a, 0x7ae08a); clover(P, TW - 15, 12, 3, 0x2a9a4a, 0x7ae08a);
  for (const [sx, sy] of [[30, 7], [TW - 32, 9], [24, 19], [TW - 26, 18]]) { P.px(sx, sy, 0xfff4b0); P.px(sx - 1, sy, GOLD[3]); P.px(sx + 1, sy, GOLD[3]); P.px(sx, sy - 1, GOLD[3]); P.px(sx, sy + 1, GOLD[3]); }
  const sub = '3 LIKA BELOPP = VINST!', sw = textW(SMALL, sub);
  text(P, SMALL, sub, ((TW - sw) >> 1) + 1, 24, 0x06200f);
  text(P, SMALL, sub, ((TW - sw) >> 1), 23, 0xf4f0e0);
  // rutornas ramar
  for (let i = 0; i < 6; i++) { const x = FX(i), y = FY(i); P.rect(x - 1, y - 1, FW + 2, FH + 2, OUT); P.hl(x - 1, y + FH + 1, FW + 2, GREEN[0]); }
  // det finstilta: vinstplanen och att lotten är avgjord redan när den köps
  const fine = 'VINSTER 100 - 500 - 1000 KR', fw = textW(SMALL, fine);
  text(P, SMALL, fine, ((TW - fw) >> 1) + 1, 90, 0x06200f); text(P, SMALL, fine, (TW - fw) >> 1, 89, GOLD[3]);
  const fine2 = 'VINSTEN AVGÖRS NÄR LOTTEN KÖPS', f2 = textW(SMALL, fine2);
  text(P, SMALL, fine2, (TW - f2) >> 1, 98, GREEN[4]);
  TICKET_BG = P.flush();
  return TICKET_BG;
}
// rutans innehåll (beloppet) och silverlagret
function fieldArt(v, i) {
  const P = new Pix(FW, FH);
  for (let y = 0; y < FH; y++) for (let x = 0; x < FW; x++) P.px(x, y, mix(0xfbf4dc, 0xeadcb0, y / FH));
  // ett guldmynt i hörnet
  for (let y = -3; y <= 3; y++) for (let x = -3; x <= 3; x++) if (Math.hypot(x, y) < 3.3) P.px(5 + x, 6 + y, tone(GOLD, 0.8 - (x + y) / 10, x, y));
  const s = String(v), big = v >= 100, w = textW(BIG, s);
  const col = v >= 500 ? 0xc8141a : v >= 100 ? 0x1a4ab0 : 0x3a3a44;
  const tx = ((FW - w) >> 1) + 2, ty = 6;
  text(P, BIG, s, tx + 1, ty + 1, 0xd8c890);
  text(P, BIG, s, tx, ty, col);
  text(P, SMALL, 'KR', ((FW - textW(SMALL, 'KR')) >> 1) + 2, FH - 7, big ? col : 0x5a5a62);
  if (v >= 500) for (const [sx, sy] of [[FW - 6, 5], [FW - 9, 3]]) { P.px(sx, sy, 0xf4d050); P.px(sx - 1, sy, 0xf4d050); P.px(sx + 1, sy, 0xf4d050); P.px(sx, sy - 1, 0xf4d050); P.px(sx, sy + 1, 0xf4d050); }
  return P.flush();
}
function coatingCanvas(i) {
  const c = document.createElement('canvas'); c.width = FW; c.height = FH;
  const P = new Pix(FW, FH);
  for (let y = 0; y < FH; y++) for (let x = 0; x < FW; x++) {
    let v = 0.62 - y / FH * 0.2 + ((x + y + i * 3) % 17 < 2 ? 0.28 : 0);
    const lx = (x + (y >> 3) * 4) % 8, ly = y % 8;
    if ((lx === 3 || lx === 4) && (ly === 3 || ly === 4)) v -= 0.18; // präglade små klöverprickar
    if (hash(x, y, 900 + i) > 0.93) v += 0.12;
    P.px(x, y, tone(SILVER, v, x, y));
  }
  text(P, SMALL, 'SKRAPA', ((FW - textW(SMALL, 'SKRAPA')) >> 1), 9, SILVER[1]);
  c.getContext('2d').drawImage(P.flush(), 0, 0);
  return c;
}

// Lotten som överlägg. opts: { onScratch(), onDone(result), canMore(), onMore(), onClose() }.
// Koordinater in/ut i vyns spelpixlar (samma som scenens down/move/up).
export function createTicket(ticket, opts = {}) {
  const fields = ticket.fields;
  const art = fields.map((v, i) => fieldArt(v, i));
  const coat = fields.map((_, i) => coatingCanvas(i));
  const mask = fields.map(() => new Uint8Array(FW * FH));
  const done = fields.map(() => false);
  let x0 = 0, y0 = 0, pressed = false, last = null, result = null, resultT = 0, scratchT = -9, t = 0, buttons = [];
  const coverage = (i) => { let n = 0; for (const b of mask[i]) n += b; return n / mask[i].length; };
  function clearPx(i, x, y) {
    if (x < 0 || y < 0 || x >= FW || y >= FH) return false;
    const k = y * FW + x;
    if (mask[i][k]) return false;
    mask[i][k] = 1;
    coat[i].getContext('2d').clearRect(x, y, 1, 1);
    return true;
  }
  function revealField(i) {
    if (done[i]) return;
    done[i] = true;
    for (let y = 0; y < FH; y++) for (let x = 0; x < FW; x++) mask[i][y * FW + x] = 1;
    coat[i].getContext('2d').clearRect(0, 0, FW, FH);
    checkDone();
  }
  function checkDone() {
    if (result || !done.every(Boolean)) return;
    result = opts.onDone?.() || { prize: 0 };
    resultT = t;
  }
  // skrapa med en rund "mynt"-pensel mellan två punkter
  function brush(px, py) {
    let hit = false;
    for (let i = 0; i < 6; i++) {
      if (done[i]) continue;
      const fx = px - x0 - FX(i), fy = py - y0 - FY(i);
      if (fx < -4 || fy < -4 || fx > FW + 4 || fy > FH + 4) continue;
      for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) if (dx * dx + dy * dy <= 10) hit = clearPx(i, Math.round(fx + dx), Math.round(fy + dy)) || hit;
      if (coverage(i) >= 0.55) revealField(i); // tillräckligt skrapat: resten flagnar av
    }
    if (hit && t - scratchT > 0.06) { scratchT = t; opts.onScratch?.(); }
    return hit;
  }
  function stroke(ax, ay, bx, by) {
    const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / 2));
    for (let k = 0; k <= n; k++) brush(ax + (bx - ax) * k / n, ay + (by - ay) * k / n);
  }
  const hitBtn = (x, y) => buttons.find((b) => x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h);
  function button(ctx, x, y, label, col, act, blink = false) {
    const w = textW(SMALL, label) + 10, h = 11;
    ctx.fillStyle = hexs(OUT); ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
    ctx.fillStyle = blink && Math.floor(t * 2) % 2 ? '#fff4b0' : col; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.fillRect(x, y, w, 1);
    ctxText(ctx, SMALL, label, x + 5, y + 3, '#17151a');
    buttons.push({ x, y, w, h, act });
    return w;
  }
  const api = {
    get result() { return result; },
    get open() { return true; },
    rects() { return fields.map((_, i) => ({ x: x0 + FX(i), y: y0 + FY(i), w: FW, h: FH, done: done[i], cover: +coverage(i).toFixed(2) })); },
    revealAll() { for (let i = 0; i < 6; i++) revealField(i); return result; },
    update(dt) { t += dt; },
    // safe = den synliga rutan { x0, y0, x1, y1 } (mobilfyllningen beskär kanterna) – lotten centreras i den
    draw(ctx, vw, vh, safe = null) {
      const sx0 = Math.max(0, safe?.x0 | 0), sx1 = Math.min(vw, safe?.x1 ?? vw), sy0 = Math.max(0, safe?.y0 | 0), sy1 = Math.min(vh, safe?.y1 ?? vh);
      x0 = Math.round((sx0 + sx1 - TW) / 2); y0 = Math.round(Math.max(sy0 + 4, (sy0 + sy1 - TH - 16) / 2));
      buttons = [];
      // mörk kant runt lotten (heltäckande, ingen genomskinlig ruta)
      ctx.fillStyle = '#0e0d12'; ctx.fillRect(x0 - 3, y0 - 3, TW + 6, TH + 6 + 16);
      ctx.drawImage(ticketBg(), x0, y0);
      for (let i = 0; i < 6; i++) {
        const fx = x0 + FX(i), fy = y0 + FY(i);
        ctx.drawImage(art[i], fx, fy);
        if (!done[i]) ctx.drawImage(coat[i], fx, fy);
        else if (result?.prize && fields[i] === result.prize && Math.floor((t - resultT) * 4) % 2 === 0) { // vinstrutorna blinkar
          ctx.fillStyle = '#f4d050'; ctx.fillRect(fx - 1, fy - 1, FW + 2, 1); ctx.fillRect(fx - 1, fy + FH, FW + 2, 1); ctx.fillRect(fx - 1, fy, 1, FH); ctx.fillRect(fx + FW, fy, 1, FH);
        }
      }
      // foten: lottens nummer och knapparna
      const fy = y0 + TH + 2;
      ctx.fillStyle = '#17151a'; ctx.fillRect(x0 - 3, fy - 1, TW + 6, 15);
      ctxText(ctx, SMALL, `LOTT ${ticket.n + 1} - DAG ${ticket.dag}`, x0 + 1, fy + 4, '#9a94a8');
      if (!result) {
        button(ctx, x0 + TW - 58, fy + 1, 'SKRAPA ALLT', '#c8ccd4', () => api.revealAll());
      } else {
        const okW = textW(SMALL, 'OK') + 10;
        button(ctx, x0 + TW - okW - 1, fy + 1, 'OK', '#8ae08a', () => opts.onClose?.(), true);
        if (opts.canMore?.()) { const lbl = `EN TILL ${LOTT_PRIS} KR`; button(ctx, x0 + TW - okW - textW(SMALL, lbl) - 16, fy + 1, lbl, '#f0c848', () => opts.onMore?.()); }
        // resultatet: en skylt över rubriken (rutorna syns hela tiden)
        const win = result.prize > 0, msg = win ? `VINST ${result.prize} KR!` : 'INGEN VINST', sub = win ? 'GRATTIS!' : 'BÄTTRE LYCKA NÄSTA GÅNG';
        const mw = Math.max(textW(BIG, msg), textW(SMALL, sub)) + 16, mh = 23, mx = x0 + ((TW - mw) >> 1), my = y0 + 5;
        if (t - resultT > 0.5) {
          ctx.fillStyle = '#17151a'; ctx.fillRect(mx - 2, my - 2, mw + 4, mh + 4);
          ctx.fillStyle = win ? (Math.floor(t * 4) % 2 ? '#f4d050' : '#d0a42a') : '#8a8e98'; ctx.fillRect(mx - 1, my - 1, mw + 2, mh + 2);
          ctx.fillStyle = win ? '#c8141a' : '#2a2a32'; ctx.fillRect(mx, my, mw, mh);
          ctxText(ctx, BIG, msg, mx + ((mw - textW(BIG, msg)) >> 1), my + 4, win ? '#fff4b0' : '#e8e4f0');
          ctxText(ctx, SMALL, sub, mx + ((mw - textW(SMALL, sub)) >> 1), my + mh - 8, win ? '#ffe070' : '#b8b4c4');
          if (win) for (let s = 0; s < 10; s++) { const a = s / 10 * Math.PI * 2 + t * 1.5, r = 30 + Math.sin(t * 5 + s) * 6; ctx.fillStyle = s % 2 ? '#fff4b0' : '#f4d050'; ctx.fillRect(Math.round(mx + mw / 2 + Math.cos(a) * r * 1.9), Math.round(my + mh / 2 + Math.sin(a) * r * 0.9), 2, 2); }
        }
      }
    },
    // true = lotten tog emot pekningen (scenen ska inte göra något mer)
    down(x, y) {
      const b = hitBtn(x, y);
      if (b) { b.act(); return true; }
      pressed = true; last = [x, y];
      if (!result) brush(x, y);
      return true;
    },
    move(x, y) {
      if (!pressed || result) return true;
      if (last) stroke(last[0], last[1], x, y);
      last = [x, y];
      return true;
    },
    up() { pressed = false; last = null; return true; },
  };
  return api;
}
