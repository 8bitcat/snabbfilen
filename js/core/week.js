// Veckosammanfattningen: det första man möts av när man kommer in i spelet och varje
// morgon när man vaknar (och med 📅 i HUD:en). Måndag–söndag som sju fönster ut mot
// Pixelstaden – varje dag med sin egen utsikt (hyreshuset, bussen, parkträdet, planet,
// fredagsljusen, pariserhjulet, kyrktornet). Avklarade dagar är grå och skymningsmörka,
// i dag lyser morgonsolen (eller regnet), och hyresdagen är tydligt utmärkt med belopp.
// Under fönstren: prognosen för hyran, en checklista och veckans läge. Läser bara
// spelets tillstånd – ändrar ingenting.
import { openModal, closeModal, esc } from './ui.js';
import { DAY_NAMES, HOMES, JOBS, EVENTS, fmt, levelOf, payMult, GLAD_LAG } from '../game.js';
import { goalsMini, gladNattHtml } from './livsmal.js';
import { $t } from './i18n.js';

const SHORT = [$t('MÅN'), $t('TIS'), $t('ONS'), $t('TOR'), $t('FRE'), $t('LÖR'), $t('SÖN')];
const weekday = (day) => (day - 1) % 7;            // 0 = måndag
const weekNo = (day) => Math.floor((day - 1) / 7) + 1;

// ungefärlig lön för ett pass: bästa passet hittills, annars ett normalt pass (≈ 12 rätt)
function payPerShift(g) {
  let best = 0;
  for (const b of Object.values(g.best || {})) if (b?.pay) best = Math.max(best, b.pay);
  if (best) return best;
  const j = JOBS.burgare || Object.values(JOBS)[0];
  return Math.round(j.wage * 12 * payMult(levelOf(g.jobs?.[j.id] || 0)));
}

export function weekInfo(g) {
  const wd = weekday(g.day);
  const rent = g.hyra ?? g.homeInfo.rent;   // (bor man ihop delas hyran)
  const daysToRent = 7 - wd;                         // hyran dras när man vaknar på måndagen
  const saved = Math.max(0, Math.round(+g.bank || 0)); // sparkontot: räcker inte fickan tar autogirot resten av hyran därifrån
  const need = Math.max(0, rent - g.money - saved);
  const perShift = payPerShift(g);
  const shifts = need ? Math.ceil(need / Math.max(1, perShift)) : 0;
  const fridge = Object.values(g.fridge || {}).reduce((a, n) => a + n, 0);
  const home = HOMES.find((h) => h.id === g.home) || g.homeInfo;
  return { wd, rent, daysToRent, need, perShift, shifts, fridge, home, saved };
}

// ---------- fönstren (pixelkonst, ritas i logiska pixlar och skalas i heltal) ----------
const WW = 64, WH = 82;                 // hela fönstret med karm och fönsterbräda
const GX0 = 6, GY0 = 6, GX1 = 58, GY1 = 66; // glaset (utsikten ritas här innanför)
const CURTAIN = ['#b8323c', '#3a6fc0', '#3f9a58', '#d88a2a', '#8a4ab8', '#d8577f', '#4a8a9a'];
const PLANT = ['tulpan', 'kaktus', 'basilika', 'pelargon', 'tulpan', 'solros', 'pelargon'];

const hexRgb = (c) => { const n = parseInt(c.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
const mix = (a, b, t) => { const A = hexRgb(a), B = hexRgb(b); return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join(''); };
function rng(seed) { let s = (seed * 2654435761) >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

function paintWindow(ctx, d, t) {
  const r = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), w, h); };
  const p = (x, y, c) => r(x, y, 1, 1, c);
  ctx.clearRect(0, 0, WW, WH);
  // tidpunkten i utsikten: avklarat = skymning, i dag = morgon, kommande = full dag
  const mood = d.past ? 'kvall' : d.today ? (d.rain ? 'regn' : 'morgon') : 'dag';
  const SKY = { kvall: ['#2c2f4f', '#c7766a'], morgon: ['#6fb6ee', '#ffd9a0'], dag: ['#4f9fe6', '#bfe6fb'], regn: ['#5e6876', '#a9b1ba'] }[mood];
  const lit = mood === 'kvall' || mood === 'regn';
  const R = rng(d.i * 97 + 13);

  ctx.save();
  ctx.beginPath(); ctx.rect(GX0, GY0, GX1 - GX0, GY1 - GY0); ctx.clip();
  // himmel i band (pixelkänsla i stället för mjuk gradient)
  for (let y = GY0; y < GY1; y += 3) r(GX0, y, GX1 - GX0, 3, mix(SKY[0], SKY[1], (y - GY0) / (GY1 - GY0)));
  // sol / måne
  if (mood === 'morgon') { for (let a = 0; a < 12; a++) { const ang = a / 12 * Math.PI * 2 + t * 0.2; p(46 + Math.cos(ang) * 8, 18 + Math.sin(ang) * 8, '#ffe89a'); } r(42, 14, 9, 9, '#ffd24a'); r(43, 13, 7, 11, '#ffd24a'); r(41, 15, 11, 7, '#ffd24a'); r(44, 15, 3, 2, '#fff3c4'); }
  if (mood === 'dag') { r(47, 12, 6, 6, '#fff0a0'); r(46, 13, 8, 4, '#fff0a0'); }
  if (mood === 'kvall') { r(14, 12, 5, 5, '#f4ecd0'); r(16, 12, 3, 4, SKY[0]); for (let s = 0; s < 9; s++) p(GX0 + 2 + R() * 48, GY0 + 2 + R() * 14, '#e8e4ff'); }
  // moln som driver
  if (mood !== 'kvall') {
    const cloud = (cx, cy, w, c) => { r(cx, cy, w, 3, c); r(cx + 2, cy - 2, w - 5, 2, c); r(cx + w - 6, cy - 3, 4, 3, c); };
    const cc = mood === 'regn' ? '#7d8794' : '#ffffff';
    cloud(GX0 + ((t * 3 + R() * 50) % 70) - 12, 16 + R() * 6, 14, cc);
    cloud(GX0 + ((t * 2 + 30 + R() * 40) % 76) - 16, 25 + R() * 5, 11, cc);
    if (mood === 'regn') cloud(GX0 + ((t * 4 + 10) % 70) - 10, 10, 18, '#6c7684');
  }
  // dagens egna saker i luften
  if (d.i === 3) { // TOR: flygplanet med kondensstrimma
    const px = GX0 + ((t * 9) % 80) - 14, py = 20;
    for (let k = 1; k < 14; k++) p(px - k, py + 1, k % 2 ? 'rgba(255,255,255,.75)' : 'rgba(255,255,255,.4)');
    r(px, py, 8, 2, '#f4f6fa'); r(px + 7, py, 2, 1, '#9ab4d8'); r(px, py - 2, 2, 2, '#2f5fb0'); r(px + 3, py + 2, 3, 1, '#c8d0dc'); p(px + 8, py + 1, '#f4f6fa');
  }
  if (d.i === 2 || d.i === 6) { // fåglar som flaxar
    for (let b = 0; b < 3; b++) { const bx = GX0 + ((t * (5 + b) + b * 17) % 60), by = 14 + b * 5 + Math.sin(t * 2 + b) * 1.5, up = Math.floor(t * 4 + b) % 2; p(bx, by, '#2a2a34'); p(bx - 1, by - up, '#2a2a34'); p(bx + 1, by - up, '#2a2a34'); }
  }
  if (d.i === 5) { // LÖR: luftballong och pariserhjulet
    const bx = 18 + Math.sin(t * 0.5) * 3, by = 14 + Math.sin(t * 0.8) * 1.5;
    r(bx, by, 7, 6, '#e8443a'); r(bx + 1, by - 1, 5, 8, '#e8443a'); r(bx + 3, by - 1, 1, 8, '#ffd24a'); r(bx + 2, by + 8, 3, 2, '#7a5228');
    const wx = 44, wy = 40, rad = 10;
    for (let a = 0; a < 40; a++) { const ang = a / 40 * Math.PI * 2; p(wx + Math.cos(ang) * rad, wy + Math.sin(ang) * rad, '#e8e0d0'); }
    for (let k = 0; k < 8; k++) { const ang = k / 8 * Math.PI * 2 + t * 0.3; for (let s = 2; s < rad; s += 2) p(wx + Math.cos(ang) * s, wy + Math.sin(ang) * s, '#b8b0a0'); r(wx + Math.cos(ang) * rad - 1, wy + Math.sin(ang) * rad - 1, 2, 2, CURTAIN[k % 7]); }
    r(wx - 1, wy, 2, 16, '#8a8478');
  }

  // stadssiluetten: bortre raden (disig), närmare raden med fönster
  const HOR = 48;
  let x = GX0 - 2;
  while (x < GX1) { const w = 5 + Math.floor(R() * 7), h = 8 + Math.floor(R() * 14); r(x, HOR - h, w, h + 20, mix(SKY[1], '#5a6478', mood === 'kvall' ? 0.7 : 0.45)); x += w + 1; }
  x = GX0 - 3;
  const front = mood === 'kvall' ? '#2e2c3c' : mood === 'regn' ? '#5a5e6c' : '#8a7a70';
  const fronts = [];
  while (x < GX1) { const w = 7 + Math.floor(R() * 8), h = 6 + Math.floor(R() * 12); fronts.push([x, w, h]); x += w + 2; }
  for (const [bx, w, h] of fronts) {
    const col = mix(front, CURTAIN[(bx + 40) % 7], 0.12);
    r(bx, HOR + 4 - h, w, h + 14, col);
    r(bx, HOR + 4 - h, w, 1, mix(col, '#ffffff', 0.25));
    for (let wy = HOR + 6 - h; wy < GY1 - 6; wy += 4) for (let wx = bx + 1; wx < bx + w - 1; wx += 3) {
      const on = lit ? R() < 0.55 : R() < 0.12;
      r(wx, wy, 2, 2, on ? (R() < 0.5 ? '#ffd36a' : '#ffe9a8') : mix(col, '#1a1824', 0.35));
    }
  }
  // gatan längst ner
  r(GX0, GY1 - 7, GX1 - GX0, 7, mood === 'kvall' ? '#3a3844' : '#6a6870');
  for (let k = 0; k < 7; k++) r(GX0 + 2 + k * 8 - (Math.floor(t * 6) % 8) * (d.i === 1 ? 1 : 0), GY1 - 4, 4, 1, '#d8d4c8');
  // dagens landmärke
  if (d.i === 0) { // MÅN: hyreshuset med nyckelskylten (hyresvärden)
    r(8, 22, 16, 38, '#b86a4a'); r(8, 22, 16, 1, '#d88a6a'); r(7, 21, 18, 2, '#7a3a2a');
    for (let wy = 26; wy < 54; wy += 5) for (let wx = 10; wx < 22; wx += 4) r(wx, wy, 2, 3, lit ? '#ffd36a' : '#5a7890');
    r(12, 54, 8, 6, '#4a2a1a'); r(15, 50, 2, 3, '#ffd24a'); r(14, 51, 1, 1, '#ffd24a'); r(17, 52, 2, 1, '#ffd24a');
  }
  if (d.i === 1) { // TIS: bussen som kör förbi
    const bx = GX0 + ((t * 12) % 90) - 30, by = GY1 - 13;
    r(bx, by, 22, 8, '#d8342c'); r(bx, by, 22, 1, '#f06a5a'); for (let k = 0; k < 5; k++) r(bx + 2 + k * 4, by + 2, 3, 3, lit ? '#ffe9a8' : '#bfe0f0');
    r(bx + 3, by + 8, 3, 2, '#1a1a1a'); r(bx + 16, by + 8, 3, 2, '#1a1a1a'); r(bx + 21, by + 5, 1, 2, '#ffe07a');
  }
  if (d.i === 2) { // ONS: parkens stora träd
    r(40, 44, 3, 16, '#6a4628');
    const leaf = mood === 'kvall' ? '#2a4a34' : '#3f8a3a', hi = mood === 'kvall' ? '#3a5a44' : '#62b04e';
    r(33, 32, 17, 13, leaf); r(35, 29, 13, 3, leaf); r(31, 36, 21, 6, leaf);
    for (let k = 0; k < 14; k++) p(34 + R() * 15, 31 + R() * 11, hi);
  }
  if (d.i === 4) { // FRE: ljusslingan och neonskylten
    for (let k = 0; k < 13; k++) { const lx = GX0 + 2 + k * 4, ly = 30 + Math.round(Math.sin(k / 12 * Math.PI) * 4); p(lx, ly - 1, '#3a3440'); const on = (Math.floor(t * 3) + k) % 3 !== 0; r(lx, ly, 2, 2, on ? CURTAIN[k % 7] : '#4a4450'); }
    r(12, 40, 16, 7, '#1c1424'); const neon = Math.floor(t * 2) % 5 ? '#ff5dc8' : '#8a3a70';
    r(13, 41, 14, 1, neon); r(13, 45, 14, 1, neon); r(13, 41, 1, 5, neon); r(26, 41, 1, 5, neon); r(16, 43, 8, 1, neon);
  }
  if (d.i === 6) { // SÖN: kyrktornet med klockan
    r(20, 18, 10, 42, '#c8c0b0'); r(20, 18, 1, 42, '#e4ddd0');
    for (let k = 0; k < 7; k++) r(25 - k * 0.7, 6 + k * 2, 1 + k * 1.4, 2, '#3a6a5a');
    p(25, 4, '#ffd24a'); r(25, 5, 1, 2, '#ffd24a');
    r(22, 24, 6, 6, '#f4f0e4'); p(25, 25, '#2a2a2a'); p(25, 26, '#2a2a2a'); p(26, 27, '#2a2a2a');
    r(23, 36, 4, 6, lit ? '#ffd36a' : '#4a5a6a'); r(22, 52, 6, 8, '#5a3a2a');
  }
  // regnet
  if (mood === 'regn') for (let k = 0; k < 26; k++) { const rx = GX0 + ((k * 7.3 + t * 4) % 54), ry = GY0 + ((k * 13.7 + t * 60) % 62); r(rx, ry, 1, 3, 'rgba(210,225,245,.65)'); }
  // glasets reflex
  ctx.fillStyle = 'rgba(255,255,255,.16)';
  for (let k = 0; k < 18; k++) { ctx.fillRect(GX0 + 3 + k, GY0 + 20 - k, 2, 1); ctx.fillRect(GX0 + 9 + k, GY0 + 22 - k, 1, 1); }
  ctx.restore();

  // karmen (vitmålat trä med skugga), spröjsen i kors
  const F = '#f1ece2', FS = '#bdb5a6', FD = '#2a2430';
  r(0, 0, WW, GY0, F); r(0, 0, GX0, GY1, F); r(GX1, 0, WW - GX1, GY1, F);
  r(0, 0, WW, 1, FD); r(0, 0, 1, GY1 + 2, FD); r(WW - 1, 0, 1, GY1 + 2, FD);
  r(GX0 - 1, GY0 - 1, GX1 - GX0 + 2, 1, FS); r(GX0 - 1, GY0 - 1, 1, GY1 - GY0 + 1, FS);
  r(31, GY0, 2, GY1 - GY0, F); r(33, GY0, 1, GY1 - GY0, FS);
  r(GX0, 28, GX1 - GX0, 2, F); r(GX0, 30, GX1 - GX0, 1, FS);
  // gardinerna (hålls öppna med en snodd, i dag lite mer öppna)
  const cc = CURTAIN[d.i], cs = mix(cc, '#000000', 0.3), ch = mix(cc, '#ffffff', 0.25);
  const open = d.today ? 3 : 6;
  for (let y = 1; y < GY1 + 1; y++) {
    const tie = 40, pinch = y < tie ? Math.round((y / tie) * 2) : Math.round(Math.max(0, 3 - (y - tie) / 6));
    const w = open + (y < tie ? 2 - pinch : 1 + (y > tie + 4 ? Math.min(3, (y - tie - 4) / 4) : 0));
    for (let k = 0; k < w; k++) { p(1 + k, y, k % 3 === 1 ? cs : k === 0 ? ch : cc); p(WW - 2 - k, y, k % 3 === 1 ? cs : k === 0 ? ch : cc); }
  }
  r(1, 40, open + 2, 1, '#e8c860'); r(WW - 3 - open, 40, open + 2, 1, '#e8c860');
  r(0, 0, WW, 3, cs); r(0, 3, WW, 1, cc); for (let k = 0; k < WW; k += 4) p(k, 3, ch); // gardinkappan
  // fönsterbrädan med en kruka
  r(0, GY1, WW, 3, '#d8d0c0'); r(0, GY1, WW, 1, '#fffaf0'); r(0, GY1 + 3, WW, 1, FD);
  r(2, GY1 + 4, WW - 4, WH - GY1 - 5, '#b9ae9c'); r(2, WH - 1, WW - 4, 1, FD);
  const px = 40, py = GY1 - 1;
  r(px, py - 5, 8, 6, '#b8603a'); r(px - 1, py - 6, 10, 2, '#d0784a');
  const pl = PLANT[d.i];
  if (pl === 'kaktus') { r(px + 3, py - 14, 3, 8, '#3f8a3a'); r(px + 1, py - 11, 2, 3, '#3f8a3a'); r(px + 6, py - 12, 2, 3, '#3f8a3a'); p(px + 4, py - 15, '#ff7aa8'); }
  else if (pl === 'solros') { r(px + 4, py - 14, 1, 8, '#3f8a3a'); r(px + 2, py - 18, 5, 5, '#f4c020'); r(px + 3, py - 17, 3, 3, '#6a3a1a'); }
  else if (pl === 'basilika') { for (let k = 0; k < 9; k++) r(px + (k % 4) * 2, py - 8 - Math.floor(k / 4) * 2, 2, 2, k % 2 ? '#4aa04a' : '#62b85a'); }
  else { const fl = pl === 'tulpan' ? '#e8443a' : '#ff5d8a'; r(px + 2, py - 12, 1, 6, '#3f8a3a'); r(px + 5, py - 13, 1, 7, '#3f8a3a'); r(px + 1, py - 15, 3, 3, fl); r(px + 4, py - 16, 3, 3, fl); p(px + 3, py - 9, '#62b04e'); p(px + 6, py - 10, '#62b04e'); }
  // hyresdagen: en lapp med hyran tejpad på rutan
  if (d.rent) {
    r(9, 9, 16, 12, '#fffbe8'); r(9, 9, 16, 1, '#e8e0c0'); r(14, 8, 6, 2, 'rgba(230,220,180,.9)');
    r(11, 12, 12, 1, '#c9323a'); r(11, 15, 9, 1, '#9a948a'); r(11, 17, 11, 1, '#9a948a');
    r(19, 14, 4, 4, '#e8b230'); p(20, 15, '#fff0a0');
  }
  // avklarade dagar: gråa och bleka
  if (d.past) {
    const img = ctx.getImageData(0, 0, WW, WH), a = img.data;
    for (let k = 0; k < a.length; k += 4) { const l = a[k] * 0.3 + a[k + 1] * 0.59 + a[k + 2] * 0.11; a[k] = l * 0.8 + a[k] * 0.2 - 10; a[k + 1] = l * 0.8 + a[k + 1] * 0.2 - 10; a[k + 2] = l * 0.8 + a[k + 2] * 0.2 - 4; }
    ctx.putImageData(img, 0, 0);
  }
}

export function openWeek(A, { morning = false, rentPaid = 0, eventText = '', odlat = null, chefslon = [], truckDag = null } = {}) {
  const g = A.game;
  const w = weekInfo(g);
  const firstWeek = g.day - w.wd === 1; // vecka 1: man flyttade in på måndagen, ingen hyra dragen
  const cells = SHORT.map((d, i) => {
    const past = i < w.wd, today = i === w.wd, isRent = i === 0;
    // måndagens hyra är redan dragen när man vaknat; söndagen påminner om nästa
    const rentTxt = isRent ? (firstWeek ? `<small class="wk-paid">${$t('🔑 inflyttning')}</small>` : `<small class="wk-paid">${$t`💸 HYRA ${fmt(rentPaid || w.rent)} betald`}</small>`)
      : i === 6 ? `<small class="wk-rent">${$t`💸 HYRA ${fmt(w.rent)} i morgon`}</small>` : '';
    const tag = today ? `<i class="wk-now">${$t('I DAG')}</i>` : past ? `<i class="wk-done">${$t('✓ KLAR')}</i>` : '<i class="wk-next"></i>';
    return `<div class="wk-day ${past ? 'past' : ''} ${today ? 'today' : ''} ${isRent ? 'rentday' : ''}">
      <b>${d}</b><span class="wk-n">${$t`dag ${g.day - w.wd + i}`}</span>
      <canvas class="wk-win" width="${WW}" height="${WH}" data-i="${i}" aria-hidden="true"></canvas>
      ${tag}${rentTxt}</div>`;
  }).join('');
  // nästa hyra
  const nextRent = w.daysToRent === 1 ? $t('i morgon bitti') : $t`på måndag – om ${w.daysToRent} dagar`;
  // räcker inte fickan tar autogirot resten av hyran från sparkontot (Game.sleep)
  const enough = g.money + w.saved >= w.rent;
  const fromBank = enough && g.money < w.rent ? w.rent - Math.max(0, g.money) : 0;
  const forecast = !enough
    ? `<p class="wk-bad">${w.saved ? $t`⚠️ Du har <b>${fmt(g.money)}</b> och <b>${fmt(w.saved)}</b> på banken men hyran är <b>${fmt(w.rent)}</b> ${nextRent}.` : $t`⚠️ Du har <b>${fmt(g.money)}</b> men hyran är <b>${fmt(w.rent)}</b> ${nextRent}.`} ${$t`Du behöver tjäna <b>${fmt(w.need)}</b> till – ungefär <b>${w.shifts} pass</b> (≈ ${fmt(w.perShift)} per pass).`}</p>`
    : fromBank
      ? `<p class="wk-ok">${g.money > 0 ? $t`✅ Fickan har <b>${fmt(g.money)}</b> – resten av hyran, <b>${fmt(fromBank)}</b>, tar banken från sparkontot ${nextRent}.` : $t`✅ Fickan är tom – hela hyran, <b>${fmt(w.rent)}</b>, tar banken från sparkontot ${nextRent}.`}</p>`
      : `<p class="wk-ok">${$t`✅ Du har <b>${fmt(g.money)}</b> – det räcker till hyran (${fmt(w.rent)}) ${nextRent}.`}</p>`;
  // i morse på banken: räntan och autogirot (läses ur kontoutdraget, så det syns hur man än somnade)
  const bankToday = (t) => (g.bankLog || []).filter((e) => e && e.d === g.day && e.t === t).pop();
  const ranta = morning && bankToday('ranta'), autogiro = morning && bankToday('hyra');
  // i natt i trädgården (Game.growGarden): vad som växte, mognade och vissnade
  const od = morning && odlat && (odlat.vaxte || odlat.vissnade) ? [odlat.mogna ? (odlat.mogna === 1 ? $t`<b>${odlat.mogna}</b> bädd är mogen att skörda` : $t`<b>${odlat.mogna}</b> bäddar är mogna att skörda`) : '', odlat.vaxte - (odlat.mogna | 0) > 0 ? $t`${odlat.vaxte - (odlat.mogna | 0)} växte en dag till` : '', odlat.vissnade ? $t`<b>${odlat.vissnade}</b> vissnade (två dagar utan vatten)` : ''].filter(Boolean).join(', ') : '';
  // måndag morgon: chefslönen (karriärstegarna, game.js betalaChefslon)
  const chefNews = morning && chefslon?.length ? chefslon.map((c) => c.kr
    ? `<p class="wk-ok" style="margin-top:0">${$t`💼 Chefslön från ${esc(JOBS[c.job]?.name || c.job)}: <b>+${fmt(c.kr)}</b> (${esc(c.roll.toLowerCase())}).`}</p>`
    : `<p class="wk-bad" style="margin-top:0">${$t`💼 Ingen chefslön från ${esc(JOBS[c.job]?.name || c.job)} – du jobbade bara ${c.pass} pass där förra veckan (minst 2).`}</p>`).join('') : '';
  // foodtrucken (eget företag): personalens dag i går och platshyran på måndagen
  const td = morning && truckDag;
  const truckNews = (td ? `<p class="${td.vinst >= 0 ? 'wk-ok' : 'wk-bad'}" style="margin-top:0">${td.regn ? $t`🚚 Foodtrucken i går: ${td.kunder} kunder (regn 🌧️) – försäljning ${fmt(td.intakt)}, råvaror och löner ${fmt(td.varor + td.loner)}: <b>${td.vinst >= 0 ? '+' : ''}${fmt(td.vinst)}</b>.` : $t`🚚 Foodtrucken i går: ${td.kunder} kunder – försäljning ${fmt(td.intakt)}, råvaror och löner ${fmt(td.varor + td.loner)}: <b>${td.vinst >= 0 ? '+' : ''}${fmt(td.vinst)}</b>.`}</p>` : '')
    + (morning && rentPaid && g.truck?.platshyra ? `<p class="wk-bad" style="margin-top:0">${$t`🚚 Platshyran för trucken: ${fmt(g.truck.platshyra)}.`}</p>` : '');
  const gardenNews = od ? `<p class="${odlat.vissnade && !odlat.mogna ? 'wk-bad' : 'wk-ok'}" style="margin-top:0">${$t`🌱 I natt i trädgården: ${od}.`}</p>` : '';
  const bankNews = (ranta ? `<p class="wk-ok" style="margin-top:0">${$t`📈 Räntan kom in: <b>+${fmt(ranta.n)}</b> på sparkontot.`}</p>` : '')
    + (autogiro ? `<p class="wk-bad" style="margin-top:0">${$t`🏦 Fickan räckte inte – <b>${fmt(autogiro.n)}</b> av hyran drogs från sparkontot (autogiro).`}</p>` : '');
  // checklista
  const todo = [];
  if (g.money < 0) todo.push([false, $t`Betala skulden: ${fmt(-g.money)}`]);
  todo.push([enough, enough ? $t('Hyran är täckt') : $t`Jobba ihop till hyran (${w.shifts} pass)`]);
  todo.push([g.hunger >= 50, g.hunger >= 50 ? $t('Du är mätt') : $t('Ät något – du är hungrig')]);
  todo.push([w.fridge > 0, w.fridge > 0 ? $t`Mat i kylen (${w.fridge} st)` : $t('Handla mat till kylen')]);
  todo.push([g.energy >= 40, g.energy >= 40 ? $t('Du är utvilad') : $t('Du är trött – sov i tid i kväll')]);
  // trädgården: torra bäddar att vattna och mogna att skörda
  const gd = g.garden?.();
  if (gd) {
    const torr = gd.beds.filter((b) => g.bedState(b) === 'torr').length, mogna = gd.beds.filter((b) => g.bedState(b) === 'mogen').length;
    if (gd.beds.some(Boolean)) todo.push([!torr, torr ? (torr === 1 ? $t`Vattna trädgården (${torr} bädd)` : $t`Vattna trädgården (${torr} bäddar)`) : $t('Trädgården är vattnad')]);
    if (mogna) todo.push([false, mogna === 1 ? $t`Skörda i trädgården – ${mogna} bädd är mogen` : $t`Skörda i trädgården – ${mogna} bäddar är mogna`]);
  }
  // bondgården: djuren ska ha mat varje dag, äggen samlas och korna mjölkas
  if (g.bondeHar?.()) {
    const B = g.bonde;
    todo.push([(B.fodrad | 0) === g.day, (B.fodrad | 0) === g.day ? $t('Djuren har fått mat') : $t('Fodra djuren i ladugården')]);
    if ((B.djur.hona | 0)) todo.push([(B.agg | 0) === g.day, (B.agg | 0) === g.day ? $t('Äggen är samlade') : $t('Samla äggen i hönsgården')]);
    if ((B.djur.ko | 0)) todo.push([(B.mjolkat | 0) === g.day, (B.mjolkat | 0) === g.day ? $t('Korna är mjölkade') : $t('Mjölka korna')]);
  }
  // hästen i stallet: mat och borste varje dag
  if (g.hast) {
    const H = g.hast;
    todo.push([(H.matad | 0) === g.day, (H.matad | 0) === g.day ? $t`${esc(H.namn)} har ätit` : $t`Mata ${esc(H.namn)} i stallet`]);
    todo.push([(H.borstad | 0) === g.day, (H.borstad | 0) === g.day ? $t`${esc(H.namn)} är borstad` : $t`Borsta ${esc(H.namn)}`]);
  }
  const glad = Math.round(g.lycka ?? 60);
  todo.push([glad >= 40, glad >= 40 ? $t('Du är på gott humör') : glad < GLAD_LAG ? $t('Gör något roligt – du är nere och sover sämre (bio, djuren, kompisar, en ledig dag)') : $t('Gör något roligt – du är nere (bio, djuren, kompisar, en ledig dag)')]);
  const ev = g.event?.id ? EVENTS.find((e) => e.id === g.event.id) : null;
  if (g.event?.id) todo.push([true, $t('I dag:') + ' ' + esc(eventText || (ev ? `${ev.icon} ${ev.text.replace('{job}', JOBS[g.event.job]?.name || $t('jobbet'))}` : g.event.id))]);
  const list = todo.map(([ok, t]) => `<li class="${ok ? 'ok' : ''}"><span>${ok ? '✓' : '☐'}</span>${t}</li>`).join('');
  // veckans läge
  const bar = (v, cls) => `<span class="wk-bar ${cls}"><i style="width:${Math.max(0, Math.min(100, Math.round(v)))}%"></i></span>`;
  const stats = `<div class="wk-stats">
    <div><span>${$t('💰 Pengar')}</span><b>${fmt(g.money)}</b></div>
    ${w.saved ? `<div><span>${$t('🏦 På banken')}</span><b>${fmt(w.saved)}</b></div>` : ''}
    <div><span>${$t('🏠 Bostad')}</span><b>${esc(w.home?.icon || '')} ${esc(w.home?.name ? $t(w.home.name) : '')}</b></div>
    <div><span>${$t('💸 Hyra per vecka')}</span><b>${fmt(w.rent)}</b></div>
    <div><span>${$t('📅 Nästa hyra')}</span><b>${w.daysToRent === 1 ? $t('i morgon') : $t`om ${w.daysToRent} dagar`}</b></div>
    <div><span>${$t('🍎 Mat i kylen')}</span><b>${$t`${w.fridge} st`}</b></div>
    <div><span>${$t('⚡ Energi')}</span>${bar(g.energy, 'en')}</div>
    <div><span>${$t('🍔 Mättnad')}</span>${bar(g.hunger, 'hu')}</div>
    <div><span>${$t('😊 Lycka')}</span>${bar(glad, 'gl')}</div>
  </div>`;
  const head = morning ? $t`☀️ God morgon! ${esc(DAY_NAMES[w.wd])}, dag ${g.day}` : $t`📅 Vecka ${weekNo(g.day)} – ${esc(DAY_NAMES[w.wd])}, dag ${g.day}`;
  const body = `<div class="wk">
    ${morning && rentPaid ? `<p class="wk-bad" style="margin-top:0">${$t`💸 Hyran för veckan är dragen: ${fmt(rentPaid)}.`}</p>` : ''}
    ${bankNews}${chefNews}${truckNews}${gardenNews}
    ${morning ? gladNattHtml(g) : ''}
    <div class="wk-grid">${cells}</div>
    ${forecast}
    <div class="wk-cols"><div><h3>${$t('Att göra i dag')}</h3><ul class="wk-todo">${list}</ul></div><div><h3>${$t('Veckans läge')}</h3>${stats}</div></div>
    ${goalsMini(g)}
    <p class="wk-tip">${$t('Tips: hyran dras varje måndag morgon – först från fickan, och räcker den inte tar banken resten från sparkontot. Räcker inte det heller blir du skyldig hyresvärden – jobba ett extra pass innan söndag.')}</p>
  </div>`;
  const dlg = openModal(head, body, [{ label: morning ? $t('☀️ Ut i dagen!') : $t('▶ Till dagen'), cls: 'btn-go', onClick: closeModal }]);
  dlg.classList.add('dlg-week');
  // fönstren: heltalsskala efter kolumnbredden, en lugn animation (moln, buss, plan, regn) så länge rutan är öppen
  const wins = [...dlg.querySelectorAll('.wk-win')];
  const days = wins.map((cv) => { const i = +cv.dataset.i; return { cv, ctx: cv.getContext('2d'), d: { i, past: i < w.wd, today: i === w.wd, rain: g.eventIs?.('regn'), rent: i === 0 && !firstWeek } }; });
  const scale = () => {
    const cw = wins[0]?.parentElement?.clientWidth || WW;
    const s = Math.max(1, Math.floor((cw - 6) / WW));
    for (const { cv } of days) { cv.style.width = WW * s + 'px'; cv.style.height = WH * s + 'px'; }
  };
  scale();
  const t0 = performance.now();
  let last = 0;
  const loop = (now) => {
    if (!dlg.isConnected || !wins[0]?.isConnected) { removeEventListener('resize', scale); return; }
    if (now - last > 110) { last = now; const t = (now - t0) / 1000; for (const x of days) if (!x.d.past) paintWindow(x.ctx, x.d, t); }
    requestAnimationFrame(loop);
  };
  for (const x of days) paintWindow(x.ctx, x.d, 0);
  addEventListener('resize', scale);
  requestAnimationFrame(loop);
  return dlg;
}
