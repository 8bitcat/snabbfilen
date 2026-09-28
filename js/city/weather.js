// Vädret i Pixelstaden. Deterministiskt ur speldagen: samma dag och klockslag
// ger samma väder för alla spelare (ingen slump per klient). En årstid varar
// 7 speldagar (vår → sommar → höst → vinter → vår …) och vädret kan slå om
// två gånger per dygn (kl 11 och 17) med en mjuk övergång på ~45 minuter.
// Dagshändelsen 'regn' (ösregn) ger regn hela dagen.
//
// Kontrakt (se docs/STADEN.md):
//   createWeather(env) → { update(dt), drawBack(ctx, view), drawFront(ctx, view), glow(ctx, view) }
//     update sätter env.weather = { kind, intensity, wind, snowCover, wet, season, temp, dayIndex }
//     och env.rain (v1-fältet) = kind === 'regn'.
//     drawBack  – efter marken, före husen/folket (snötäcke, våt glans)
//     drawFront – efter allt y-sorterat, före mörkret (regn, snöfall, dimma, blåst, molnljus)
//     glow      – efter mörkret (här: inget ännu)
//   env.forceWeather = { kind?, intensity?, snow?, season?, temp? } tvingar vädret (förhandsvisning/test).
//   weatherAt(day, hour, eventId) – det rena vädret (för tester och andra moduler).
//   weatherLabel(w) → 'Sol, 18° · sommar'   drawWeatherBadge(ctx, x, y, w) – liten pixelskylt.
import { hash, SMALL, ctxText, textW } from '../core/floor-pix.js';
import { ROADS } from './map.js';

export const SEASONS = ['vår', 'sommar', 'höst', 'vinter'];
export const KINDS = ['sol', 'moln', 'regn', 'snö', 'dimma', 'blåst'];
export const seasonOf = (day) => SEASONS[Math.floor((Math.max(1, day | 0) - 1) / 7) % 4];

// hur ofta varje väder dyker upp per årstid (vikter)
const TABLE = {
  vår: [['sol', 4], ['moln', 3], ['regn', 2], ['blåst', 1], ['dimma', 1]],
  sommar: [['sol', 7], ['moln', 2], ['regn', 1], ['blåst', 1]],
  höst: [['moln', 3], ['regn', 3], ['blåst', 2], ['dimma', 2], ['sol', 2]],
  vinter: [['snö', 4], ['moln', 3], ['sol', 2], ['dimma', 1], ['blåst', 1]],
};
const BASE_TEMP = { vår: 8, sommar: 21, höst: 9, vinter: -5 };
const KIND_TEMP = { sol: 3, moln: 0, regn: -2, snö: -2, dimma: -1, blåst: -3 };
const SEG = [0, 11, 17, 24]; // tre väderpass per dygn

function pick(season, day, seg) {
  const t = TABLE[season], sum = t.reduce((a, [, w]) => a + w, 0);
  let r = hash(day, seg, 7701) * sum;
  for (const [k, w] of t) { r -= w; if (r < 0) return k; }
  return t[0][0];
}
const segOf = (h) => (h < SEG[1] ? 0 : h < SEG[2] ? 1 : 2);
const kindAt = (day, seg, season, ev) => (ev === 'regn' ? 'regn' : pick(season, day, seg));
const smooth = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));

// Det rena vädret en viss dag och timme.
export function weatherAt(day, hour, eventId = null) {
  day = Math.max(1, day | 0);
  const season = seasonOf(day), seg = segOf(hour);
  const kind = kindAt(day, seg, season, eventId);
  // övergång: första 45 min av ett pass tonar upp ur förra passets väder
  const prev = seg > 0 ? kindAt(day, seg - 1, season, eventId) : kindAt(day - 1, 2, seasonOf(day - 1), null);
  const ramp = prev === kind ? 1 : smooth((hour - SEG[seg]) / 0.75);
  const base = kind === 'regn' && eventId === 'regn' ? 0.85 + hash(day, 3, 7702) * 0.15 : 0.45 + hash(day, seg, 7703) * 0.55;
  const intensity = +(base * ramp).toFixed(3);
  // vind (px/s, + = österut)
  const sign = hash(day, 9, 7704) > 0.5 ? 1 : -1;
  const wind = Math.round(sign * (kind === 'blåst' ? 55 + 35 * intensity : kind === 'regn' ? 16 + 12 * intensity : kind === 'snö' ? 8 + 10 * intensity : 3 + 9 * hash(day, seg, 7705)));
  // snötäcke: vinter = ligger kvar, växer medan det snöar; första vårdagarna smälter det
  const dIn = (day - 1) % 7;
  let snowCover = 0;
  if (season === 'vinter') {
    let snowed = 0;
    for (let s = 0; s <= seg; s++) if (kindAt(day, s, season, eventId) === 'snö') snowed += s === seg ? Math.min(1, (hour - SEG[s]) / (SEG[s + 1] - SEG[s])) : 1;
    snowCover = Math.min(1, (dIn === 0 ? 0.25 : 0.55) + 0.45 * Math.min(1, snowed));
  } else if (season === 'vår' && dIn < 2 && day > 7) snowCover = Math.max(0, (dIn === 0 ? 0.5 : 0.18) - hour / 24 * 0.25);
  // blöt mark: regnar nu, eller regnade förra passet (torkar på ~4 h), eller snösmältning
  let wet = kind === 'regn' ? 0.55 + 0.45 * intensity : 0;
  if (!wet && seg > 0 && kindAt(day, seg - 1, season, eventId) === 'regn') wet = Math.max(0, 0.8 - (hour - SEG[seg]) * 0.2);
  if (snowCover > 0 && season === 'vår') wet = Math.max(wet, 0.5);
  const temp = Math.round(BASE_TEMP[season] + 4 * Math.sin(((hour - 9) / 24) * Math.PI * 2) + KIND_TEMP[kind] + (hash(day, 4, 7706) - 0.5) * 6);
  return { kind, intensity, wind, snowCover: +snowCover.toFixed(3), wet: +wet.toFixed(3), season, temp, dayIndex: dIn };
}

const LABEL = { sol: 'Sol', moln: 'Molnigt', regn: 'Regn', snö: 'Snöfall', dimma: 'Dimma', blåst: 'Blåsigt' };
export const weatherLabel = (w) => (w ? `${LABEL[w.kind] || w.kind}, ${w.temp}° · ${w.season}` : '');

// ---------------------------------------------------------------------
// Liten pixelskylt (ikon + "SOL 18°" + årstid), ritas i skärmrymden.
// ---------------------------------------------------------------------
const ICON = {
  sol: ['..y.y..', 'y.yyy.y', '.yYYYy.', 'yyYYYyy', '.yYYYy.', 'y.yyy.y', '..y.y..'],
  moln: ['.......', '..www..', '.wwWww.', 'wwWWWww', 'wwwwwww', '.ggggg.', '.......'],
  regn: ['..www..', '.wwWww.', 'wwwwwww', '.ggggg.', 'b.b.b..', '.b.b.b.', 'b.b.b..'],
  snö: ['..w....', 'w.w.w..', '.www...', 'wwWww.w', '.www.w.', 'w.w.w.w', '..w..w.'],
  dimma: ['.......', 'gggg...', '.......', '..ggggg', '.......', 'ggggg..', '.......'],
  blåst: ['.......', 'wwwww..', '.....w.', 'wwwwww.', '.......', 'wwww.w.', '....w..'],
};
const ICOL = { y: '#ffd23f', Y: '#fff1a0', w: '#e8eef6', W: '#ffffff', g: '#9aa4b2', b: '#6fb2ff' };
export function drawWeatherBadge(ctx, x, y, w) {
  if (!w) return;
  const t = `${LABEL[w.kind] || w.kind} ${w.temp}`.toUpperCase(), s = w.season.toUpperCase();
  const tw = textW(SMALL, t) + 4, sw = textW(SMALL, s);
  const bw = 7 + 3 + Math.max(tw, sw) + 5, bh = 17;
  x = Math.round(x - bw); y = Math.round(y);
  ctx.fillStyle = 'rgba(16,18,30,0.72)'; ctx.fillRect(x, y, bw, bh);
  ctx.fillStyle = 'rgba(255,255,255,0.14)'; ctx.fillRect(x, y, bw, 1);
  const ic = ICON[w.kind] || ICON.sol;
  ic.forEach((row, j) => { for (let i = 0; i < row.length; i++) if (row[i] !== '.') { ctx.fillStyle = ICOL[row[i]]; ctx.fillRect(x + 3 + i, y + 5 + j, 1, 1); } });
  ctxText(ctx, SMALL, t, x + 13, y + 3, '#f4f1ea');
  // gradtecken: en liten ring
  const gx = x + 13 + textW(SMALL, t) + 1;
  ctx.fillStyle = '#f4f1ea'; ctx.fillRect(gx, y + 3, 2, 1); ctx.fillRect(gx, y + 5, 2, 1); ctx.fillRect(gx - 1, y + 4, 1, 1); ctx.fillRect(gx + 2, y + 4, 1, 1);
  ctxText(ctx, SMALL, s, x + 13, y + 10, '#a9b4c8');
}

// ---------------------------------------------------------------------
// Snötäckets struktur: en förmålad ruta (64×64) per täckningsnivå, lagd i
// världskoordinater så att den inte simmar när kameran rör sig.
// ---------------------------------------------------------------------
const TILE = 64;
const snowTiles = new Map();
function snowTile(level) {
  const q = Math.round(level * 10);
  if (snowTiles.has(q)) return snowTiles.get(q);
  const c = document.createElement('canvas'); c.width = TILE; c.height = TILE;
  const x = c.getContext('2d'), img = x.createImageData(TILE, TILE), d = img.data;
  const thr = 1 - q / 10;
  for (let j = 0; j < TILE; j++) for (let i = 0; i < TILE; i++) {
    const n = (hash(i >> 2, j >> 2, 881) * 0.6 + hash(i >> 1, j >> 1, 882) * 0.25 + hash(i, j, 883) * 0.15);
    if (n < thr) continue;
    const k = (j * TILE + i) * 4, hi = hash(i, j, 884);
    const v = hi > 0.97 ? [255, 255, 255] : hi < 0.12 ? [206, 216, 232] : hi < 0.4 ? [226, 232, 244] : [240, 244, 250];
    d[k] = v[0]; d[k + 1] = v[1]; d[k + 2] = v[2]; d[k + 3] = 255;
  }
  x.putImageData(img, 0, 0);
  snowTiles.set(q, c);
  return c;
}

export function createWeather(env) {
  let flakes = null;
  const W = () => env.weather;
  return {
    update() {
      const f = env.forceWeather;
      let w = weatherAt(env.day || 1, env.hour ?? 12, env.eventId || null);
      if (f) {
        const kind = f.kind || w.kind, season = f.season || w.season;
        w = { ...w, kind, season, intensity: f.intensity ?? (f.kind ? 0.8 : w.intensity) };
        if (f.snow !== undefined) w.snowCover = +f.snow;
        else if (f.kind === 'snö') w.snowCover = Math.max(w.snowCover, 0.8);
        if (f.kind === 'regn') w.wet = Math.max(w.wet, 0.8);
        if (f.temp !== undefined) w.temp = f.temp;
        else if (f.season || f.kind) w.temp = Math.round(BASE_TEMP[season] + KIND_TEMP[kind]);
        if (f.kind === 'blåst') w.wind = 70;
      }
      env.weather = w;
      env.rain = w.kind === 'regn';
    },
    drawBack(ctx, view) {
      const w = W();
      if (!w || w.snowCover <= 0.02) return;
      const tile = snowTile(Math.min(1, w.snowCover));
      const x0 = Math.floor(view.x / TILE) * TILE, y0 = Math.floor(view.y / TILE) * TILE;
      ctx.save();
      ctx.globalAlpha = 0.92;
      for (let y = y0; y < view.y + view.h; y += TILE) for (let x = x0; x < view.x + view.w; x += TILE) ctx.drawImage(tile, x, y);
      // vägarna är plogade/uppkörda: grå slask i stället för vit snö
      ctx.globalAlpha = 1;
      ctx.fillStyle = 'rgba(92,90,96,0.55)';
      for (const r of ROADS) {
        const a = [Math.max(r.x0, view.x), Math.max(r.y0 + 2, view.y), Math.min(r.x1, view.x + view.w), Math.min(r.y1 - 2, view.y + view.h)];
        if (a[2] > a[0] && a[3] > a[1]) ctx.fillRect(a[0], a[1], a[2] - a[0], a[3] - a[1]);
      }
      ctx.restore();
    },
    drawFront(ctx, view) {
      const w = W();
      if (!w) return;
      const k = w.intensity, t = env.t, vx = view.x, vy = view.y, vw = view.w, vh = view.h;
      const cnt = (n) => Math.round(n * (vw * vh) / (384 * 216));
      ctx.save();
      if (w.kind === 'moln' || w.kind === 'regn' || w.kind === 'snö') {
        ctx.fillStyle = `rgba(40,48,70,${(0.06 + 0.1 * k).toFixed(3)})`; ctx.fillRect(vx, vy, vw, vh);
      }
      if (w.kind === 'sol' && !env.night) {
        ctx.fillStyle = `rgba(255,214,140,${(0.04 * k).toFixed(3)})`; ctx.fillRect(vx, vy, vw, vh);
      }
      if (w.kind === 'regn') {
        ctx.fillStyle = 'rgba(170,195,235,0.5)';
        const n = cnt(40 + 90 * k), slant = Math.max(-3, Math.min(3, Math.round(w.wind / 12)));
        for (let i = 0; i < n; i++) {
          const rx = vx + (((i * 97.3 + t * (30 + w.wind)) % vw) + vw) % vw;
          const ry = vy + ((i * 53.7 + t * (130 + (i % 7) * 12)) % vh);
          const x = rx | 0, y = ry | 0;
          ctx.fillRect(x, y, 1, 2); ctx.fillRect(x + (slant > 0 ? 1 : slant < 0 ? -1 : 0), y + 2, 1, 2);
        }
      }
      if (w.kind === 'snö') {
        if (!flakes) flakes = Array.from({ length: 260 }, (_, i) => ({ a: hash(i, 1, 55) * 1000, b: hash(i, 2, 55) * 1000, s: 12 + hash(i, 3, 55) * 22, z: hash(i, 4, 55) }));
        const n = Math.min(flakes.length, cnt(50 + 110 * k));
        for (let i = 0; i < n; i++) {
          const f = flakes[i];
          const fx = vx + ((((f.a + t * (w.wind * 0.6) + Math.sin(t * 1.3 + f.b) * 6) % vw) + vw) % vw);
          const fy = vy + ((f.b + t * f.s) % vh);
          ctx.fillStyle = f.z > 0.7 ? 'rgba(255,255,255,0.95)' : 'rgba(236,242,250,0.75)';
          ctx.fillRect(fx | 0, fy | 0, f.z > 0.85 ? 2 : 1, f.z > 0.85 ? 2 : 1);
        }
      }
      if (w.kind === 'dimma') {
        for (let b = 0; b < 5; b++) {
          const by = vy + ((b * 61 + t * 3) % vh), bh = 26 + b * 7;
          ctx.fillStyle = `rgba(214,220,228,${(0.07 + 0.05 * k).toFixed(3)})`;
          ctx.fillRect(vx, by | 0, vw, bh);
        }
        ctx.fillStyle = `rgba(200,208,218,${(0.12 + 0.14 * k).toFixed(3)})`; ctx.fillRect(vx, vy, vw, vh);
      }
      if (w.kind === 'blåst') {
        ctx.fillStyle = 'rgba(236,236,226,0.35)';
        const n = cnt(10 + 18 * k), dir = w.wind >= 0 ? 1 : -1;
        for (let i = 0; i < n; i++) {
          const sx = vx + ((((i * 131.7 + t * w.wind * 2.2) % (vw + 40)) + vw + 40) % (vw + 40)) - 20;
          const sy = vy + ((i * 71.3 + Math.sin(t * 2 + i) * 4) % vh);
          ctx.fillRect(sx | 0, sy | 0, 6 + (i % 4) * 2, 1);
        }
        // löv som far förbi (höst) eller skräp (resten av året)
        const leaf = w.season === 'höst' ? ['#d9822b', '#b8461f', '#e8b230'] : ['#c8c2b0', '#8fae5a'];
        for (let i = 0; i < cnt(8); i++) {
          const lx = vx + ((((i * 211.9 + t * w.wind * 1.6) % (vw + 20)) + vw + 20) % (vw + 20)) - 10;
          const ly = vy + ((i * 97.1 + t * 9 + Math.sin(t * 5 + i) * 6) % vh);
          ctx.fillStyle = leaf[i % leaf.length];
          ctx.fillRect(lx | 0, ly | 0, 2, 1); ctx.fillRect((lx | 0) + (dir > 0 ? 1 : 0), (ly | 0) + 1, 1, 1);
        }
      }
      // blöt mark ger en svag kall ton även när det slutat regna
      if (w.wet > 0.2 && w.kind !== 'regn') { ctx.fillStyle = `rgba(30,44,70,${(0.05 * w.wet).toFixed(3)})`; ctx.fillRect(vx, vy, vw, vh); }
      ctx.restore();
    },
    glow() {},
  };
}
