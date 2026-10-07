// 🗺️ KARTAN över Pixelstaden (Carl 2026-09-29): "en karta man kan ta fram – trycker man på
// något ska man få en pil som visar vägen". En pixelkarta ovanifrån (1 kartpixel = K världs-px)
// ritad ur kartkontraktet (map.js): gatorna, trottoarerna, parken, floden med broarna, kanalen,
// tomterna och husens tak – med ikonerna som knappar ovanpå. Tryck på ett ställe → namn,
// öppettider och avstånd, och två val:
//   🧭 Visa vägen  – A.guideTo(id): en pil i staden visar vägen dit (js/scenes/city.js)
//   🚕 Taxi dit    – A.taxiTo(id): en taxi hämtar en vid trottoarkanten och kör dit
// 🚕-knappen öppnar samma karta i taxiläget ("Vart ska taxin köra?").
// Kartan ritas en gång per session (husen står still) – "Du är här" ritas ovanpå varje gång.
import { CITY, ALL_BUILDINGS, DISTRICTS, RIVER, BRIDGES, PARK_LAYOUT, PATHS, LOTS, CROSSWALKS_ALL, BUS_STOPS, LINNE_LAYOUT,
  footprint, doorCenter, baseOf, buildingById } from './map.js';
import { openModal, closeModal, esc } from '../core/ui.js';
import { SMALL, ctxText, textW, hash } from '../core/floor-pix.js';
import { clock } from '../game.js';

export const MAP_K = 5;                                    // världens px per kartpixel
// (v4) kartan börjar vid världens västra kant CITY.X0 (Linnéstaden): kartpixel X ↔ världs-x (X + MX0) · K
const MX0 = Math.floor((CITY.X0 || 0) / MAP_K);
const MW = Math.ceil(CITY.W / MAP_K) - MX0, MH = Math.ceil(CITY.H / MAP_K);
const kx = (wx) => Math.floor(wx / MAP_K) - MX0;                 // världs-x → kartpixel

// ---------- taxin: pris och tid ----------
// 25 kr startavgift + 10 kr per 100 m (1 världs-px ≈ 0,25 m, vägen räknas i kvarter: |dx| + |dy|)
export const TAXI_START = 25;
export const metersBetween = (a, b) => Math.round((Math.abs(a.x - b.x) + Math.abs(a.y - b.y)) * 0.25 / 10) * 10;
export function taxiQuote(from, b) {
  const dc = doorCenter(b), m = metersBetween(from, dc);
  return { kr: TAXI_START + Math.round(m / 10), min: 3 + Math.round(m / 60), m };
}
// den egna bostadens hus (dit 🏠 Hem leder)
export const homeBuilding = (g) => ALL_BUILDINGS.find((b) => (b.homes || []).includes(g?.home)) || null;
// var man är i staden: figuren i staden, annars dörren man gick in genom (eller hemmets)
export function whereAmI(A) {
  if (A.sceneName === 'city' && A.scene && Number.isFinite(A.scene.worldX)) return { x: A.scene.worldX, y: A.scene.worldY, inside: null };
  const b = homeBuilding(A.game);
  if (A.sceneName === 'room' && b && !A.visitTarget) { const dc = doorCenter(b); return { x: dc.x, y: dc.y, inside: b }; }
  const p = A.cityPos;
  if (p) { const inside = ALL_BUILDINGS.find((q) => { const dc = doorCenter(q); return Math.abs(dc.x - p[0]) < 3 && Math.abs(dc.y + 4 - p[1]) < 3; }) || null; return { x: p[0], y: p[1], inside }; }
  if (b) { const dc = doorCenter(b); return { x: dc.x, y: dc.y, inside: null }; }
  return { x: 640, y: 296, inside: null };
}
const openNow = (b, g) => { if (!b.open) return true; const h = (g?.min ?? 720) / 60; return h >= b.open[0] && h < b.open[1]; };
const hhmm = (h) => clock(Math.round(h * 60) % (24 * 60));

// ---------- pixelkartan ----------
// ytorna (färgpar: bas + ton för mönstret)
const COL = {
  gras: [0x5f9a45, 0x6fae50], gras2: [0x578f40, 0x4d8238], ang: [0x6aa84c, 0xd8c84a], sand: [0xd8c28a, 0xc8b078],
  grus: [0xc9b48a, 0xb8a37a], asfalt: [0x55545c, 0x4c4b52], vag: [0x46454d, 0x3f3e46], trottoar: [0xb9b3a7, 0xaaa498],
  torg: [0xc2b8a4, 0xb0a690], kaj: [0x9c968a, 0x8c867a], gard: [0x8f897d, 0x848074], vatten: [0x3f7fb8, 0x5a9ad0],
  kyrkogard: [0x4f8a3e, 0x9a9a92], parkering: [0x5a5960, 0xd8d4c8], lekplats: [0xd8b87a, 0xe06040], tomten: [0x8a7a5a, 0x6f8a44],
  bro: [0x6a6258, 0x5c554c], torn: [0x8a8274, 0x6c6558], odling: [0x7a5a3a, 0x5f9a45],
};
const INK = 0x1c1a20;
const ROOFS = {
  CENTRUM: [0xb5553c, 0x9a4a3a, 0x7a8a96, 0x5f7f99, 0xc47a3a, 0x8a5a44, 0x6f8a5a],
  'SÖDER': [0xa8543a, 0x7e4a38, 0x6f7f8e, 0xb07040, 0x8a6a4a],
  PARKEN: [0x8a5a3a, 0x9a4a3a, 0x6f7f8e],
  DOWNTOWN: [0x5a6f86, 0x4a5a70, 0x7f93a8, 0x3f4a5c, 0x6a7a8a],
  'FÖRORTEN': [0x8c8a86, 0x75736e, 0x9a8f7e, 0x6a6660, 0x7a7a70],
  'LINNÉSTADEN': [0xb4553c, 0xa44a34, 0x6a4a40, 0x3e4250, 0x4a5a56, 0x9a4a34],
};
const SPECIAL_ROOF = { flyg: 0xc8ccd2, kyrka: 0x4a4e5a, mat: 0xd6d2c8, mobler: 0x3f6fb0, lagerhall: 0x7a7d80, garage: 0x6a6f74 };
const lighten = (c, f) => { const r = (c >> 16) & 255, g = (c >> 8) & 255, b = c & 255; const m = (v) => Math.max(0, Math.min(255, Math.round(f > 0 ? v + (255 - v) * f : v * (1 + f)))); return (m(r) << 16) | (m(g) << 8) | m(b); };

const inR = (x, y, r) => x >= r[0] && x < r[2] && y >= r[1] && y < r[3];
// vilken yta som ligger vid världspunkten (x, y) – första träffen vinner
function surfaceAt(x, y) {
  // floden: vatten, broar, tornens ben och kajerna
  if (x >= RIVER.x0 && x < RIVER.x1) {
    for (const br of BRIDGES) {
      for (const t of br.towers || []) for (const l of t.legs || []) if (inR(x, y, l)) return 'torn';
      if (inR(x, y, br.walk)) return y >= br.walk[1] + 32 && y < br.walk[3] - 30 ? 'vag' : 'bro';
    }
    if (RIVER.water.some((r) => inR(x, y, r))) return 'vatten';
    return 'kaj';
  }
  if (y >= CITY.CANAL[0]) return 'vatten';
  if (y >= CITY.QUAY[0]) return 'kaj';
  if ((y >= CITY.ROAD[0] && y < CITY.ROAD[1]) || (y >= CITY.ROAD_S[0] && y < CITY.ROAD_S[1])) return 'vag';
  if (x >= CITY.INFARTEN[0] && x < CITY.INFARTEN[1] && y >= CITY.ROAD[1] && y < CITY.ROAD_S[0]) return 'vag';
  if ((y >= CITY.SIDEWALK_N[0] && y < CITY.SIDEWALK_N[1]) || (y >= CITY.SIDEWALK_S[0] && y < CITY.SIDEWALK_S[1])
    || (y >= CITY.SIDEWALK_SN[0] && y < CITY.SIDEWALK_SN[1]) || (y >= CITY.SIDEWALK_SS[0] && y < CITY.SIDEWALK_SS[1])) return 'trottoar';
  const pd = PARK_LAYOUT.pond;
  if (((x - pd.cx) / pd.rx) ** 2 + ((y - pd.cy) / pd.ry) ** 2 < 1) return 'vatten';
  const pz = PARK_LAYOUT.plaza;
  if ((x - pz.cx) ** 2 + (y - pz.cy) ** 2 < pz.r * pz.r) return (x - pz.cx) ** 2 + (y - pz.cy) ** 2 < 100 ? 'vatten' : 'torg';
  if (LINNE_LAYOUT && inR(x, y, LINNE_LAYOUT.odling)) return 'odling';
  if (LINNE_LAYOUT) { const pv = LINNE_LAYOUT.pavilion; if (((x - pv.x) / pv.rx) ** 2 + ((y - pv.y) / pv.ry) ** 2 < 1) return 'grus'; }
  for (const l of LOTS) if (inR(x, y, l.rect)) return COL[l.kind] ? l.kind : l.kind === 'lekplats_x' ? 'lekplats' : l.kind === 'grusplan' || l.kind === 'vagnsplatsen' ? 'grus' : 'asfalt';
  if (inR(x, y, PARK_LAYOUT.playground)) return 'lekplats';
  if (inR(x, y, PARK_LAYOUT.meadow)) return 'ang';
  if (inR(x, y, PARK_LAYOUT.dogPark)) return 'gras2';
  for (const p of PATHS) if (inR(x, y, p.rect)) return p.kind === 'trottoar' ? 'trottoar' : p.kind;
  if (y < CITY.SIDEWALK_N[0] || (y >= CITY.BACK_S[0] && y < CITY.SIDEWALK_SN[0])) return 'gard';
  return 'gras';
}

let MAP = null; // { canvas } – ritas en gång
function drawRoof(u, b) {
  const f = footprint(b);
  const x0 = kx(f[0]), y0 = Math.floor(f[1] / MAP_K), x1 = Math.ceil(f[2] / MAP_K) - MX0, y1 = Math.ceil((baseOf(b)) / MAP_K);
  const pal = ROOFS[b.district] || ROOFS.CENTRUM;
  const base = SPECIAL_ROOF[b.id] ?? pal[Math.floor(hash(b.x, b.w, 7) * pal.length) % pal.length];
  const tall = b.h >= 150;
  // höga hus kastar en skugga österut
  if (tall) for (let y = y0 + 1; y < y1 + 1; y++) for (let x = x1; x < x1 + 2; x++) u.shade(x, y, -0.35);
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    let c = base;
    if (y === y0) c = lighten(base, 0.28);                                  // takfoten mot norr
    else if (y === y1 - 1) c = lighten(base, -0.35);                        // fasaden mot gatan
    else if (!tall && (y - y0) === Math.floor((y1 - y0) / 2)) c = lighten(base, -0.12); // nock
    else if (hash(x, y, 3) < 0.08) c = lighten(base, 0.1);
    u.put(x, y, c);
  }
  // kontur
  for (let x = x0 - 1; x <= x1; x++) { u.put(x, y0 - 1, INK); u.put(x, y1, INK); }
  for (let y = y0; y < y1; y++) { u.put(x0 - 1, y, INK); u.put(x1, y, INK); }
  // platta tak i downtown: ventilationsaggregat
  if (tall || b.district === 'DOWNTOWN') for (let k = 0; k < 3; k++) {
    const ax = x0 + 2 + Math.floor(hash(b.x, k, 11) * Math.max(1, x1 - x0 - 5)), ay = y0 + 2 + Math.floor(hash(b.w, k, 13) * Math.max(1, y1 - y0 - 5));
    u.put(ax, ay, 0xc8ccd0); u.put(ax + 1, ay, 0xc8ccd0); u.put(ax, ay + 1, 0x9aa0a8); u.put(ax + 1, ay + 1, 0x9aa0a8);
  }
  // kyrkans torn: ett kors på taket
  if (b.id === 'kyrka') { const cx = Math.round((x0 + x1) / 2), cy = Math.round((y0 + y1) / 2); for (let k = -2; k <= 2; k++) { u.put(cx + k, cy, 0xe8d8a0); u.put(cx, cy + k, 0xe8d8a0); } }
  // dörren: en ljus lucka i fasaden
  const d0 = kx(b.door.x0), d1 = Math.max(d0 + 1, Math.ceil(b.door.x1 / MAP_K) - MX0);
  for (let x = d0; x < d1; x++) u.put(x, y1 - 1, b.door.type === 'boarded' ? 0x6a4a2a : 0xf0d070);
}
export function renderCityMap() {
  if (MAP) return MAP;
  const c = document.createElement('canvas'); c.width = MW; c.height = MH;
  const x = c.getContext('2d');
  const img = x.createImageData(MW, MH), px = new Uint32Array(img.data.buffer);
  const abgr = (col) => 0xff000000 | ((col & 0xff) << 16) | (col & 0xff00) | ((col >> 16) & 0xff);
  const rgbAt = (i) => { const v = px[i]; return ((v & 0xff) << 16) | (v & 0xff00) | ((v >> 16) & 0xff); };
  const u = {
    put(X, Y, col) { if (X >= 0 && Y >= 0 && X < MW && Y < MH) px[Y * MW + X] = abgr(col); },
    shade(X, Y, f) { if (X >= 0 && Y >= 0 && X < MW && Y < MH) px[Y * MW + X] = abgr(lighten(rgbAt(Y * MW + X), f)); },
  };
  // marken, pixel för pixel (mitten av kartpixeln avgör ytan) med ett lugnt mönster
  const kinds = new Array(MW * MH);
  for (let Y = 0; Y < MH; Y++) for (let X = 0; X < MW; X++) {
    const k = surfaceAt((X + MX0) * MAP_K + MAP_K / 2, Y * MAP_K + MAP_K / 2), [a, b] = COL[k] || COL.gras;
    kinds[Y * MW + X] = k;
    const h = hash(X, Y, 1);
    let col = a;
    if (k === 'vatten') col = h < 0.07 ? b : a;                         // små vågtoppar
    else if (k === 'ang') col = h < 0.1 ? b : h < 0.4 ? lighten(a, -0.08) : a; // blommor i ängen
    else if (k === 'kyrkogard') col = (X % 3 === 0 && Y % 3 === 1) ? b : a; // gravstenarna i rader
    else if (k === 'parkering') col = (X % 5 === 0 && Y % 6 < 3) ? lighten(a, 0.3) : a; // p-rutorna
    else if (k === 'lekplats') col = h < 0.05 ? b : a;
    else col = h < 0.18 ? b : a;
    px[Y * MW + X] = abgr(col);
  }
  // träd i gräset (en mörk krona med ljus topp) – inte på gångar
  for (let Y = 1; Y < MH - 2; Y++) for (let X = 1; X < MW - 2; X++) {
    const k = kinds[Y * MW + X];
    if ((k !== 'gras' && k !== 'gras2') || hash(X, Y, 5) > 0.035) continue;
    if (['gras', 'gras2'].indexOf(kinds[(Y + 1) * MW + X + 1]) < 0) continue;
    u.put(X, Y, 0x2f6a2a); u.put(X + 1, Y, 0x2f6a2a); u.put(X, Y + 1, 0x2a5a24); u.put(X + 1, Y + 1, 0x24501f); u.put(X, Y, 0x4f8f3a);
  }
  // gatorna: streckad mittlinje och övergångsställen
  for (const yc of [(CITY.ROAD[0] + CITY.ROAD[1]) / 2, (CITY.ROAD_S[0] + CITY.ROAD_S[1]) / 2]) {
    const Y = Math.floor(yc / MAP_K);
    for (let X = 0; X < MW; X++) if ((X + MX0 + 6000) % 6 < 3 && kinds[Y * MW + X] === 'vag') u.put(X, Y, 0xd8c890);
  }
  { const X = kx((CITY.INFARTEN[0] + CITY.INFARTEN[1]) / 2);
    for (let Y = Math.ceil(CITY.ROAD[1] / MAP_K) + 1; Y < Math.floor(CITY.ROAD_S[0] / MAP_K) - 1; Y++) if (Y % 6 < 3) u.put(X, Y, 0xd8c890); }
  for (const cw of CROSSWALKS_ALL) {
    const r = [cw.x0, cw.y0, cw.x1, cw.y1];
    if (![0, 1, 2, 3].every((i) => Number.isFinite(r[i]))) continue;
    const horiz = r[2] - r[0] > r[3] - r[1];
    for (let Y = Math.floor(r[1] / MAP_K); Y < Math.ceil(r[3] / MAP_K); Y++) for (let X = kx(r[0]); X < Math.ceil(r[2] / MAP_K) - MX0; X++) {
      if (kinds[Y * MW + X] !== 'vag') continue;
      if ((horiz ? Y : X + MX0 + 6000) % 2 === 0) u.put(X, Y, 0xeae6da);
    }
  }
  // husen (taken) – de södra raderna först så att de norra ritas ovanpå vid kanten
  for (const b of [...ALL_BUILDINGS].sort((a, b) => baseOf(a) - baseOf(b))) drawRoof(u, b);
  // busshållplatserna: en liten blå skylt
  for (const s of BUS_STOPS) { const X = Math.round(s.x / MAP_K) - MX0, Y = Math.round((s.wait?.y ?? s.y) / MAP_K); u.put(X, Y - 1, 0xf4f1ea); u.put(X, Y, 0x2f6db5); u.put(X, Y + 1, 0x2f6db5); }
  x.putImageData(img, 0, 0);
  // namnen: stadsdelarna i gränderna och kanalen, gatorna på vägen
  const label = (t, cx, y, fg, bg) => {
    const w = textW(SMALL, t), X = Math.round(cx - MX0 - w / 2);
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, 1], [-1, 1], [1, -1]]) ctxText(x, SMALL, t, X + dx, y + dy, bg);
    ctxText(x, SMALL, t, X, y, fg);
  };
  const Y0 = 1;
  label('CENTRUM', 850 / MAP_K, Y0, '#fff2c0', '#2a2430');
  if (MX0 < 0) { label('LINNÉSTADEN', -600 / MAP_K, Y0, '#fff2c0', '#2a2430'); label('TORGET', -744 / MAP_K, Math.round(380 / MAP_K), '#fff2c0', '#4a3a2a'); }
  label('DOWNTOWN', 2080 / MAP_K, Y0, '#fff2c0', '#2a2430');
  label('FÖRORTEN', 3520 / MAP_K, Y0, '#fff2c0', '#2a2430');
  label('PARKEN', 600 / MAP_K, Math.round(386 / MAP_K), '#fff2c0', '#2a4a24');
  label('SÖDER', 850 / MAP_K, MH - 7, '#e8f4ff', '#1f4a70');
  label('PIXELFLODEN', ((RIVER.wx0 + RIVER.wx1) / 2) / MAP_K, Math.round(470 / MAP_K), '#e8f4ff', '#1f4a70');
  for (const xs of [MX0 < 0 ? -900 : 320, 320, 2080, 3300].filter((v, i, a) => a.indexOf(v) === i)) label('PIXELGATAN', xs / MAP_K, Math.round((CITY.ROAD[0] + 16) / MAP_K), '#e8e2d0', '#2a2830');
  for (const xs of [MX0 < 0 ? -900 : 320, 320, 3300].filter((v, i, a) => a.indexOf(v) === i)) label('SÖDERGATAN', xs / MAP_K, Math.round((CITY.ROAD_S[0] + 16) / MAP_K), '#e8e2d0', '#2a2830');
  MAP = { canvas: c };
  return MAP;
}

// ---------- dialogen ----------
const CSS = `
.cm-wrap{position:relative;overflow-x:auto;overflow-y:hidden;border:3px solid #17151a;background:#17151a;touch-action:pan-x;-webkit-overflow-scrolling:touch}
.cm-map{position:relative}
.cm-map canvas{display:block;image-rendering:pixelated}
.cm-ic{position:absolute;transform:translate(-50%,-100%);border:2px solid #17151a;background:#f4f1ea;padding:0;
  width:22px;height:22px;line-height:18px;font-size:var(--f1);text-align:center;cursor:pointer;box-shadow:0 2px 0 #17151a}
.cm-ic:hover,.cm-ic.on{background:#ffd23f;z-index:3}
.cm-ic.shut{filter:grayscale(.7);opacity:.8}
.cm-me{position:absolute;transform:translate(-50%,-100%);pointer-events:none;z-index:4;font:bold var(--f1)/1 var(--font);color:#17151a;
  background:#ffd23f;border:2px solid #17151a;padding:2px 4px;white-space:nowrap;animation:cmbob 1s ease-in-out infinite}
.cm-me::after{content:'';position:absolute;left:50%;bottom:-7px;margin-left:-5px;border:5px solid transparent;border-top-color:#17151a}
.cm-dot{position:absolute;width:10px;height:10px;margin:-5px 0 0 -5px;border:2px solid #17151a;border-radius:50%;pointer-events:none;z-index:4;animation:cmblink .8s steps(2) infinite}
@keyframes cmbob{50%{margin-top:-3px}}
@keyframes cmblink{50%{opacity:.35}}
.cm-info{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-top:8px;min-height:44px;font-size:var(--f2)}
.cm-info .cm-big{font-size:var(--f3)}
.cm-info b{font-size:var(--f2)}
.cm-info small{display:block;opacity:.8;font-size:var(--f1)}
.cm-info .grow{flex:1;min-width:160px}
.cm-hint{margin:0 0 6px;font-size:var(--f1);opacity:.85}
`;
// mode 'karta' | 'taxi'. A.guideTo(id) och A.taxiTo(id) gör jobbet (main.js / city.js).
export function openCityMap(A, { mode = 'karta', select = null } = {}) {
  const g = A.game, me = whereAmI(A), home = homeBuilding(g);
  const inJob = /^jobb/.test(A.sceneName || '');
  const { canvas } = renderCityMap();
  const taxiMode = mode === 'taxi';
  const body = `<style>${CSS}</style>
    <p class="cm-hint">${taxiMode ? '🚕 Tryck på stället dit taxin ska köra – den hämtar dig vid trottoarkanten.' : '🗺️ Tryck på ett ställe: 🧭 en pil visar vägen dit, eller 🚕 ta en taxi.'}</p>
    <div class="cm-wrap"><div class="cm-map"></div></div>
    <div class="cm-info" data-info></div>`;
  const dlg = openModal(taxiMode ? '🚕 Vart ska taxin köra?' : '🗺️ Kartan över Pixelstaden', body, [{ label: 'Stäng', onClick: closeModal }]);
  dlg.classList.add('cm-dlg');
  const wrap = dlg.querySelector('.cm-wrap'), holder = dlg.querySelector('.cm-map'), info = dlg.querySelector('[data-info]');
  // skala: heltal enhetspixlar per kartpixel, så hög som dialogen tillåter
  const dpr = window.devicePixelRatio || 1;
  const availH = Math.max(120, Math.min(window.innerHeight * 0.52, 400));
  const kd = Math.max(1, Math.floor(availH * dpr / MH)), css = kd / dpr;
  const cv = document.createElement('canvas'); cv.width = MW * kd; cv.height = MH * kd;
  const cx = cv.getContext('2d'); cx.imageSmoothingEnabled = false; cx.drawImage(canvas, 0, 0, cv.width, cv.height);
  cv.style.width = (MW * css) + 'px'; cv.style.height = (MH * css) + 'px';
  holder.style.width = (MW * css) + 'px'; holder.style.height = (MH * css) + 'px';
  holder.append(cv);
  const at = (wx, wy) => ({ left: (wx / MAP_K - MX0) * css + 'px', top: (wy / MAP_K) * css + 'px' });
  // ikonerna: en knapp vid varje dörr
  const btns = new Map();
  for (const b of ALL_BUILDINGS) {
    if (!b.icon) continue;
    const dc = doorCenter(b), el = document.createElement('button');
    el.className = 'cm-ic' + (b.enter && !openNow(b, g) ? ' shut' : '');
    el.type = 'button'; el.textContent = b.icon; el.title = b.sign || '';
    el.dataset.b = b.id;
    Object.assign(el.style, at(dc.x, baseOf(b) - 4));
    el.onclick = (e) => { e.stopPropagation(); pick(b); };
    holder.append(el);
    btns.set(b.id, el);
  }
  // du är här
  const meEl = document.createElement('div'); meEl.className = 'cm-me'; meEl.textContent = 'DU ÄR HÄR';
  Object.assign(meEl.style, at(me.x, me.y - 30));
  const dot = document.createElement('div'); dot.className = 'cm-dot'; dot.style.background = A.avatar?.color || '#ffd23f';
  Object.assign(dot.style, at(me.x, me.y));
  holder.append(meEl, dot);
  // börja med den egna platsen i mitten
  requestAnimationFrame(() => { wrap.scrollLeft = Math.max(0, (me.x / MAP_K - MX0) * css - wrap.clientWidth / 2); });

  function idle() {
    info.innerHTML = `<span class="grow">${taxiMode ? 'Vart vill du åka?' : 'Välj ett ställe på kartan.'}${me.inside ? ` <small>Du är i ${esc(me.inside.sign || '')}.</small>` : ''}</span>
      ${home ? `<button class="btn btn-small" data-home>🏠 Hem</button>` : ''}`;
    info.querySelector('[data-home]')?.addEventListener('click', () => pick(home));
  }
  function pick(b) {
    for (const [id, el] of btns) el.classList.toggle('on', id === b.id);
    const q = taxiQuote(me, b), open = openNow(b, g), here = me.inside && me.inside.id === b.id;
    const times = b.open ? `öppet ${hhmm(b.open[0])}–${hhmm(b.open[1])}${open ? '' : ' · <b style="color:#c9323a">stängt nu</b>'}` : b.enter ? 'öppet dygnet runt' : '';
    const dist = here ? 'du är här' : `${q.m} m bort`;
    const canTaxi = !inJob && !here && g.money >= q.kr;
    const taxiTxt = inJob ? '🚕 (efter passet)' : `🚕 Taxi dit – ${q.kr} kr`;
    info.innerHTML = `<span class="cm-big">${b.icon || '📍'}</span>
      <span class="grow"><b>${esc(b.sign || b.id.toUpperCase())}</b><small>${esc(districtName(b))}${times ? ' · ' + times : ''} · ${dist}</small></span>
      <button class="btn btn-small ${taxiMode ? '' : 'btn-go'}" data-guide ${here ? 'disabled' : ''}>🧭 Visa vägen</button>
      <button class="btn btn-small ${taxiMode ? 'btn-go' : ''}" data-taxi ${canTaxi ? '' : 'disabled'} title="${g.money < q.kr ? `Du har ${g.money} kr` : `ca ${q.min} minuter`}">${taxiTxt}</button>`;
    info.querySelector('[data-guide]').onclick = () => { closeModal(); A.guideTo?.(b.id); };
    info.querySelector('[data-taxi]').onclick = () => { closeModal(); A.taxiTo?.(b.id); };
  }
  if (select && buildingById(select)) pick(buildingById(select)); else idle();
  return dlg;
}
const districtName = (b) => { const d = DISTRICTS.find((x) => x.name === b.district); return d ? d.name.charAt(0) + d.name.slice(1).toLowerCase() : (b.district || ''); };
// för testerna: kartans storlek och en ytas namn
export const _mapInfo = () => ({ w: MW, h: MH, k: MAP_K, x0: MX0 * MAP_K, surfaceAt });
