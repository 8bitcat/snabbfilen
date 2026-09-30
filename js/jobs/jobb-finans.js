// FINANSHUSET – mäklardesken (jobbet 'finans', kräver examen i Ekonomi från Pixelhögskolan).
// Man sitter vid sin desk i handelssalen med fyra skärmar – en per aktie (PIXEL, SNABB, BURGR,
// MÖBEL) med levande kurs, graf och knapparna KÖP och SÄLJ. Uppe på väggen löper börstavlan,
// bakom skärmarna ropar kollegorna i telefon.
//
// Kunderna ringer in order som dyker upp som lappar under skärmen för sin aktie:
//   KÖP 100 SNABB – UNDER 52 KR   → tryck KÖP när kursen är under gränsen
//   SÄLJ 50 PIXEL – ÖVER 130 KR   → tryck SÄLJ när kursen är över gränsen
// Gränsen syns som en gul streckad linje i grafen, och knappen lyser när läget är rätt.
// Rätt = affären klar (+lön), för dyrt/för billigt eller fel knapp = fel, lappen som hinner
// gå ut = kunden lägger på (miss). Passet via shift.js (60 s för en nybörjare, längre och
// tätare order med vanan – planOf). Escape = avbryt.
//
// _debug: state(), stocks(), tickets(), force(i, typ, gräns) (lägg en order), setPrice(i, p),
//   trade(i, typ) (samma som knappen), spot(i, typ) → { x, y }, finish(), stats.
import { drawPerson, makeLook } from '../core/people.js';
import { Pix, SMALL, BIG, text, textW, ctxText, mix, mul, hash } from '../core/floor-pix.js';
import { createSpeech } from '../scenes/walkable.js';
import { planOf, drawShiftHud, drawTimeUp, makePops, abortShift } from './shift.js';
import { play } from '../core/sound.js';

const FW = 384, FH = 216;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const fmtKr = (v) => v.toFixed(1);   // (punkt: pixeltypsnittets komma liknar ett snedstreck i skärmstorlek)
const STOCKS = [
  { id: 'PIXEL', mean: 128, vol: 2.6, col: '#4ad8e8' },
  { id: 'SNABB', mean: 54, vol: 1.3, col: '#f0c850' },
  { id: 'BURGR', mean: 78, vol: 1.8, col: '#f08a4a' },
  { id: 'MÖBEL', mean: 215, vol: 3.6, col: '#b88ae8' },
];
const MON = STOCKS.map((_, i) => ({ x: 8 + i * 94, y: 96, w: 86, h: 56 }));
const BTN = (i, typ) => { const M = MON[i]; return typ === 'KÖP' ? { x: M.x + 4, y: M.y + M.h - 12, w: 38, h: 9 } : { x: M.x + M.w - 42, y: M.y + M.h - 12, w: 38, h: 9 }; };
const TICK = (i) => ({ x: MON[i].x + 2, y: 156, w: MON[i].w - 4, h: 22 });
const HIST = 64;

// ---------- bakgrunden: handelssalen ----------
let BG = null;
function paintBg() {
  if (BG) return BG;
  const P = new Pix(FW, FH);
  for (let y = 0; y < FH; y++) for (let x = 0; x < FW; x++) {
    let c = y < 92 ? mix(0x2a3040, 0x3a4254, y / 92) : mix(0x4a4e58, 0x3a3e48, (y - 92) / 124);
    if (y >= 92) c = mul(c, 1 + (hash(x >> 2, y >> 2, 3) - 0.5) * 0.05);        // heltäckningsmatta
    P.px(x, y, c);
  }
  // fönsterband mot downtown (skyskraporna och himlen)
  for (let y = 38; y < 84; y++) for (let x = 0; x < FW; x++) {
    let c = mix(0x8ab8e0, 0xc8dcf0, (y - 38) / 46);
    const col = Math.floor(x / 22), hgt = 38 + ((hash(col, 1, 7) * 26) | 0);
    if (y > hgt) { c = mul(mix(0x4a5a74, 0x6a7a94, hash(col, 2, 7)), 1); if ((x % 22) % 4 === 1 && (y - hgt) % 5 === 2) c = 0xc8e0f0; }
    if (x % 64 === 0 || x % 64 === 1) c = 0x1a1e28;                            // fönsterposterna
    P.px(x, y, c);
  }
  for (let x = 0; x < FW; x++) { P.px(x, 37, 0x1a1e28); P.px(x, 84, 0x1a1e28); P.px(x, 85, 0x5a6270); }
  // börstavlans ram (texten löper i draw)
  P.rect(0, 18, FW, 18, 0x0a0a10); P.hl(0, 18, FW, 0x3a3a44); P.hl(0, 35, FW, 0x3a3a44);
  // kollegornas skrivbord bakom (en rad)
  for (let i = 0; i < 4; i++) {
    const x = 20 + i * 96;
    P.rect(x, 86, 70, 5, 0x5a4a3a); P.hl(x, 86, 70, 0x8a7458);
    P.rect(x + 8, 74, 20, 12, 0x1a1a24); P.rect(x + 9, 75, 18, 9, 0x2a4a7a); P.rect(x + 36, 74, 20, 12, 0x1a1a24); P.rect(x + 37, 75, 18, 9, 0x2a5a4a);
  }
  // min desk: skivan under skärmarna och lappytan
  P.rect(0, 150, FW, 34, 0x3a2e24); P.hl(0, 150, FW, 0x6a5440); P.hl(0, 151, FW, 0x5a4634); P.hl(0, 183, FW, 0x1a140e);
  for (let x = 0; x < FW; x += 2) P.px(x, 152 + ((x >> 3) & 1), 0x4a3a2c);
  // skärmarnas fötter
  for (const M of MON) { P.rect(M.x + M.w / 2 - 4, M.y + M.h, 8, 3, 0x2a2a30); P.rect(M.x + M.w / 2 - 10, M.y + M.h + 2, 20, 2, 0x3a3a44); }
  // tangentbord, telefonen, kaffekoppen och skylten FINANSHUSET
  P.rect(150, 186, 84, 8, 0x2a2a30); for (let i = 0; i < 20; i++) P.rect(152 + i * 4, 188, 3, 2, 0x5a5a64);
  P.rect(250, 186, 22, 10, 0x1a1a20); P.rect(252, 184, 18, 3, 0x2a2a30); P.hl(254, 190, 14, 0x3a7bd5);
  P.rect(110, 186, 8, 8, 0xf4f1ea); P.rect(111, 187, 6, 3, 0x6a3a1a); P.vl(118, 188, 3, 0xf4f1ea);
  const s = 'FINANSHUSET', sw = textW(SMALL, s) + 10;
  P.rect(FW - sw - 6, 4, sw, 10, 0x1a2a4a); P.box(FW - sw - 6, 4, sw, 10, 0xc89a40); text(P, SMALL, s, FW - sw - 1, 7, 0xf0d070);
  BG = P.flush();
  return BG;
}

export function makeJobbFinans(A, { onDone } = {}) {
  let t = 0, done = false, doneT = 0, reported = false;
  const P = planOf(A);   // passets plan: längd (P.seconds) och ordertakt (P.pace) efter vanan
  const stats = { ok: 0, fel: 0, miss: 0 };
  const pops = makePops();
  // kurserna: slumpvandring som dras mot medelvärdet, ibland ett ryck
  let seed = ((A.game?.day || 1) * 9301 + 49297) % 233280;
  const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
  const S = STOCKS.map((s) => {
    const p = s.mean * (0.96 + rnd() * 0.08);
    return { ...s, p, hist: Array.from({ length: HIST }, () => p), vel: 0, old: p };
  });
  let histT = 0;
  function stepPrices(dt) {
    for (const s of S) {
      s.vel += ((s.mean - s.p) * 0.02 + (rnd() - 0.5) * s.vol * 2.2) * dt * 3;
      s.vel *= Math.pow(0.35, dt);
      if (rnd() < 0.004) s.vel += (rnd() - 0.5) * s.vol * 3;                  // nyhet!
      s.p = Math.max(1, s.p + s.vel * dt);
    }
    histT += dt;
    if (histT > 0.2) { histT = 0; for (const s of S) { s.hist.push(s.p); if (s.hist.length > HIST) s.hist.shift(); } }
  }
  // lapparna: en per aktie som mest
  const tickets = [null, null, null, null];
  let nextT = 1.2, custSeq = 0;
  const NAMES = ['FRU LIND', 'PENSIONSFONDEN', 'HERR ÖST', 'PIXELBANKEN', 'DORIS', 'KALLE', 'STIFTELSEN', 'FAMILJEN BERG'];
  function newTicket(i = null, typ = null, lim = null) {
    const free = [0, 1, 2, 3].filter((k) => !tickets[k]);
    if (!free.length) return null;
    i = i ?? free[(rnd() * free.length) | 0];
    if (tickets[i]) return null;
    const s = S[i];
    // oftast åt det håll kursen är på väg (över medel → den sjunker → köp under; under → sälj över)
    typ = typ || ((s.p > s.mean) === (rnd() < 0.7) ? 'KÖP' : 'SÄLJ');
    const off = s.vol * (0.25 + rnd() * 0.8) * (rnd() < 0.25 ? -1 : 1);      // ibland direkt uppfyllbar
    lim = lim ?? Math.round((typ === 'KÖP' ? s.p - off : s.p + off) * 10) / 10;
    const dur = 15 + rnd() * 6;
    tickets[i] = { i, typ, lim, n: [10, 25, 50, 100, 200][(rnd() * 5) | 0], who: NAMES[custSeq++ % NAMES.length], t: dur, dur, born: t };
    play('chirp');
    return tickets[i];
  }
  const good = (tk) => (tk.typ === 'KÖP' ? S[tk.i].p <= tk.lim : S[tk.i].p >= tk.lim);
  function trade(i, typ) {
    if (done) return;
    const tk = tickets[i], s = S[i], M = MON[i];
    if (!tk) { pops.add(M.x + M.w / 2, M.y - 2, 'INGEN ORDER', '#d8d2c0'); play('miss'); return; }
    if (tk.typ !== typ) { stats.fel++; play('fel'); pops.add(M.x + M.w / 2, M.y - 2, 'FEL KNAPP!', '#ff6a5a'); tickets[i] = null; return; }
    if (!good(tk)) { stats.fel++; play('fel'); pops.add(M.x + M.w / 2, M.y - 2, typ === 'KÖP' ? 'FÖR DYRT!' : 'FÖR BILLIGT!', '#ff6a5a'); tickets[i] = null; return; }
    stats.ok++; play('coin'); pops.add(M.x + M.w / 2, M.y - 2, 'AFFÄR KLAR!', '#8ee03c');
    s.vel += (typ === 'KÖP' ? 1 : -1) * s.vol * 0.3;                          // ordern flyttar kursen lite
    tickets[i] = null;
  }

  // kollegorna bakom skärmarna
  const mates = [0, 1, 2].map((k) => ({ look: { ...makeLook(() => [0.2, 0.55, 0.8][k]), kid: false, top: 'jacket', shirt: ['#2d3a5c', '#3c3c3c', '#5a4632'][k], hat: null, bag: null }, x: 64 + k * 128, y: 94, talk: createSpeech(), nextT: 3 + k * 4 }));
  const meLook = A.avatar?.look;

  function update(dt) {
    pops.update(dt);
    if (done) { doneT += dt; if (doneT > 1.2 && !reported) { reported = true; onDone?.({ ...stats }); } return; }
    t += dt;
    if (t >= P.seconds) { done = true; play('fanfare'); return; }
    stepPrices(dt);
    nextT -= dt;
    // (tätare mot slutet av passet; en van mäklare får fler order – P.pace, samma tid att hinna)
    if (nextT <= 0) { newTicket(); nextT = (3.2 + rnd() * 2.6 - 1.5 * Math.min(1, t / P.seconds)) * P.pace; }
    for (let i = 0; i < 4; i++) {
      const tk = tickets[i];
      if (!tk) continue;
      tk.t -= dt;
      if (tk.t <= 0) { stats.miss++; play('miss'); pops.add(MON[i].x + MON[i].w / 2, 150, 'KUNDEN LADE PÅ…', '#d8d2c0'); tickets[i] = null; }
    }
    for (const m of mates) {
      m.nextT -= dt;
      if (m.nextT <= 0) { m.nextT = 5 + rnd() * 6; m.talk.say(['KÖP! KÖP!', 'SÄLJ ALLT!', 'VILKEN DAG!', 'HALLÅ? JA, JAG HÖR!', 'SNABB RUSAR!', 'KAFFE, NÅGON?'][(rnd() * 6) | 0], { x: m.x, y: m.y - 44 }, 2); }
    }
  }

  // ---------- ritning ----------
  function drawTicker(ctx) {
    const line = S.map((s) => `${s.id} ${fmtKr(s.p)} ${s.p >= s.hist[Math.max(0, s.hist.length - 25)] ? '+' : '-'}`).join('   ') + '   ';
    const w = textW(SMALL, line), off = (t * 28) % w;
    ctx.save(); ctx.beginPath(); ctx.rect(0, 20, FW, 14); ctx.clip();
    for (let k = -1; k < Math.ceil(FW / w) + 1; k++) {
      let x = Math.round(k * w - off) + 4;
      for (const s of S) {
        const up = s.p >= s.hist[Math.max(0, s.hist.length - 25)];
        const part = `${s.id} ${fmtKr(s.p)} `;
        ctxText(ctx, SMALL, part, x, 24, '#f4d24a'); x += textW(SMALL, part) + 1;
        ctx.fillStyle = up ? '#4ae84a' : '#ff5a4a';
        if (up) { ctx.fillRect(x + 1, 24, 1, 1); ctx.fillRect(x, 25, 3, 1); ctx.fillRect(x - 1, 26, 5, 1); }
        else { ctx.fillRect(x - 1, 25, 5, 1); ctx.fillRect(x, 26, 3, 1); ctx.fillRect(x + 1, 27, 1, 1); }
        x += 16;
      }
    }
    ctx.restore();
  }
  function drawMonitor(ctx, i) {
    const M = MON[i], s = S[i], tk = tickets[i];
    ctx.fillStyle = '#16161c'; ctx.fillRect(M.x - 2, M.y - 2, M.w + 4, M.h + 4);
    ctx.fillStyle = '#0c1424'; ctx.fillRect(M.x, M.y, M.w, M.h);
    const up = s.p >= s.hist[Math.max(0, s.hist.length - 25)];
    ctxText(ctx, SMALL, s.id, M.x + 3, M.y + 3, s.col);
    const ps = fmtKr(s.p) + ' KR';
    ctxText(ctx, SMALL, ps, M.x + M.w - 3 - textW(SMALL, ps), M.y + 3, up ? '#6aee6a' : '#ff6a5a');
    // grafen
    const gx = M.x + 3, gy = M.y + 11, gw = M.w - 6, gh = 28;
    ctx.fillStyle = '#101c30'; ctx.fillRect(gx, gy, gw, gh);
    ctx.fillStyle = '#18263e'; for (let k = 1; k < 4; k++) ctx.fillRect(gx, gy + Math.round((gh * k) / 4), gw, 1);
    let lo = Math.min(...s.hist, tk ? tk.lim : Infinity), hi = Math.max(...s.hist, tk ? tk.lim : -Infinity);
    const pad = Math.max(0.5, (hi - lo) * 0.15); lo -= pad; hi += pad;
    const Y = (v) => gy + gh - 1 - Math.round(((v - lo) / (hi - lo)) * (gh - 2));
    if (tk) {                                                                  // kundens gräns
      const ly = Y(tk.lim), ok = good(tk);
      ctx.fillStyle = ok ? '#8ee03c' : '#f0c850';
      for (let x = gx; x < gx + gw; x += 3) ctx.fillRect(x, ly, 2, 1);
      // den gröna sidan av gränsen (där affären går)
      ctx.fillStyle = 'rgba(142,224,60,0.10)';
      if (tk.typ === 'KÖP') ctx.fillRect(gx, ly, gw, gy + gh - ly); else ctx.fillRect(gx, gy, gw, ly - gy);
    }
    ctx.fillStyle = up ? '#6aee6a' : '#ff6a5a';
    for (let k = 1; k < s.hist.length; k++) {
      const x0 = gx + Math.round(((k - 1) / (HIST - 1)) * (gw - 1)), x1 = gx + Math.round((k / (HIST - 1)) * (gw - 1));
      const y0 = Y(s.hist[k - 1]), y1 = Y(s.hist[k]);
      for (let x = x0; x <= x1; x++) { const yy = Math.round(y0 + ((y1 - y0) * (x - x0)) / Math.max(1, x1 - x0)); ctx.fillRect(x, Math.min(yy, y0, y1), 1, Math.max(1, Math.abs(y1 - y0) / Math.max(1, x1 - x0) + 1)); }
    }
    // knapparna
    for (const typ of ['KÖP', 'SÄLJ']) {
      const B = BTN(i, typ), lit = tk && tk.typ === typ && good(tk) && Math.floor(t * 4) % 2 === 0;
      ctx.fillStyle = typ === 'KÖP' ? (lit ? '#6aee6a' : '#2a7a3a') : (lit ? '#ff7a6a' : '#8a2a2a');
      ctx.fillRect(B.x, B.y, B.w, B.h);
      ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(B.x, B.y, B.w, 1);
      ctxText(ctx, SMALL, typ, B.x + ((B.w - textW(SMALL, typ)) >> 1), B.y + 2, '#f4f6fa');
    }
  }
  function drawTicket(ctx, i) {
    const tk = tickets[i]; if (!tk) return;
    const R = TICK(i), k = clamp(tk.t / tk.dur, 0, 1), fresh = t - tk.born < 0.4;
    const y = R.y + (fresh ? Math.round((1 - (t - tk.born) / 0.4) * -8) : 0);
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(R.x + 1, y + 1, R.w, R.h);
    ctx.fillStyle = tk.typ === 'KÖP' ? '#f8f0a0' : '#f8c8b8'; ctx.fillRect(R.x, y, R.w, R.h);
    ctx.fillStyle = tk.typ === 'KÖP' ? '#2a7a3a' : '#8a2a2a'; ctx.fillRect(R.x, y, 3, R.h);
    ctxText(ctx, SMALL, `${tk.typ} ${tk.n} ${S[i].id}`, R.x + 6, y + 2, '#1a1a24');
    ctxText(ctx, SMALL, `${tk.typ === 'KÖP' ? 'UNDER' : 'ÖVER'} ${fmtKr(tk.lim)} KR`, R.x + 6, y + 9, good(tk) ? '#1f7a2a' : '#6a2a2a');
    ctx.fillStyle = '#c8c0a0'; ctx.fillRect(R.x + 6, y + R.h - 4, R.w - 10, 2);
    ctx.fillStyle = k < 0.3 ? '#d83a3a' : '#3a6ad8'; ctx.fillRect(R.x + 6, y + R.h - 4, Math.round((R.w - 10) * k), 2);
  }

  return {
    get worldX() { return 192; },
    get worldY() { return 212; },
    update,
    down(x, y) {
      if (done) return;
      for (let i = 0; i < 4; i++) for (const typ of ['KÖP', 'SÄLJ']) {
        const B = BTN(i, typ);
        if (x >= B.x - 1 && x <= B.x + B.w + 1 && y >= B.y - 1 && y <= B.y + B.h + 1) { trade(i, typ); return; }
      }
    },
    key(k) { if (k === 'Escape' && !done) abortShift(A); },
    draw(ctx) {
      ctx.setTransform(A.pxs, 0, 0, A.pxs, 0, 0);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(paintBg(), 0, 0);
      drawTicker(ctx);
      for (const m of mates) drawPerson(ctx, m.x, m.y, m.look, 'down', Math.sin(t * 2 + m.x) > 0.8 ? 6 : 5);
      for (let i = 0; i < 4; i++) drawMonitor(ctx, i);
      for (let i = 0; i < 4; i++) drawTicket(ctx, i);
      // jag vid desken (ryggen mot oss) och stolen
      ctx.fillStyle = '#1a1a20'; ctx.fillRect(180, 190, 24, 18); ctx.fillStyle = '#2a2a34'; ctx.fillRect(181, 191, 22, 16);
      if (meLook) drawPerson(ctx, 192, 214, meLook, 'up', 5);
      for (const m of mates) m.talk.draw(ctx, { x0: 0, x1: FW });
      pops.draw(ctx);
      drawShiftHud(ctx, A, { t, dur: P.seconds, ok: stats.ok, fel: stats.fel, title: `FINANSHUSET - ${stats.ok} AFFÄRER` });
      if (done) drawTimeUp(ctx, A);
    },
    _debug: {
      stats,
      state: () => ({ t: +t.toFixed(2), done, stats: { ...stats }, tickets: tickets.map((k) => (k ? { typ: k.typ, lim: k.lim, t: +k.t.toFixed(1), good: good(k) } : null)), prices: S.map((s) => +s.p.toFixed(2)) }),
      stocks: () => S.map((s) => ({ id: s.id, p: +s.p.toFixed(2) })),
      tickets: () => tickets.map((k) => (k ? { i: k.i, typ: k.typ, lim: k.lim, good: good(k) } : null)),
      force: (i, typ, lim) => { tickets[i] = null; return newTicket(i, typ, lim); },
      setPrice: (i, p) => { S[i].p = p; S[i].vel = 0; },
      trade: (i, typ) => { trade(i, typ); return { ...stats }; },
      spot: (i, typ) => { const B = BTN(i, typ); return { x: B.x + (B.w >> 1), y: B.y + (B.h >> 1) }; },
      tick: (sec) => { for (let k = 0; k < sec * 30; k++) update(1 / 30); },
      finish: () => { t = P.seconds - 0.01; update(0.02); for (let k = 0; k < 60; k++) update(0.05); },
    },
  };
}
