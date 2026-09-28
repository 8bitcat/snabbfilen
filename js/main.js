// Snabbfilen – bootstrap. En canvas (384×216 logiska pixlar, CSS-skalad),
// scener för staden/rummet/jobben, DOM-HUD överst och en vanlig rAF-loop.
import { loadAvatar, openAvatarPicker, avatarPortrait, setAvatarLocks } from './core/avatar.js';
import { openModal, closeModal, toast, modalOpen, esc } from './core/ui.js';
import { onInvite, sendInvite } from './net/coop.js';
import { Game, SAVE_KEY, WIN_MONEY, JOBS, JOB_TITLES, SORTIMENT, levelOf, fmt, clock } from './game.js';
import { makeCity } from './scenes/city.js';
import { makeRoom } from './scenes/room.js';
import { makeShopMobler } from './scenes/shop-mobler.js';
import { makeShopIkea } from './scenes/shop-ikea.js';
import { makeShopMat } from './scenes/shop-mat.js';
import { makeShopBostad } from './scenes/shop-bostad.js';
import { makeShopKafe } from './scenes/shop-kafe.js';
import { makeShopKlader } from './scenes/shop-klader.js';
import { makeJobbFlyg } from './jobs/jobb-flyg.js';
import { makeJobbFrukt } from './jobs/jobb-frukt.js';
import { makeJobbBurgare } from './jobs/jobb-burgare.js';
import { startJobFlow, startShiftNow } from './jobs/shift.js';
import { openFoodShop } from './shops/matbutik.js';
import { openHousing } from './shops/bostad.js';
import { startWorld, worldTick, worldInfo, playersList, visitPlayer, sendEmote, sendSay, worldFolksHere, playerName } from './net/world.js';
import { openMenu, mountMenuButton, isMenuOpen, shouldShowMenuAtBoot } from './core/menu.js';
import { drawPixHud, isPixHud, apply as applyHud, stripHeight, layoutStrip } from './core/hud-pix.js';
import { musicTick } from './core/music.js';
import { openWeek } from './core/week.js';
import { mountChat, isChatOpen } from './core/chat.js';
import { play, unlockAudio, toggleMute, isMuted } from './core/sound.js';
import { CITY } from './city/map.js';

const $ = (s) => document.querySelector(s);
const cv = $('#scene'), ctx = cv.getContext('2d');

// Appkontexten som alla scener får: tillstånd + navigering.
const A = {
  W: 384, H: 216, pxs: 2, // spelets logiska rymd; pxs = device-pixlar per spelpixel (sätts i fit)
  roomSub: 0,             // vilket delrum i bostaden man är i
  game: null, avatar: null,
  scene: null, sceneName: '',
  go(name, opts) {
    A.scene?.exit?.();
    A.scene = null; // gamla scenens viewMax får inte läcka in i nästa scens bygge
    A.sceneName = name;
    applySceneView(); // scenens vy (bred eller 384×216) innan den byggs
    A.scene = SCENES[name](A, opts);
    fit(); // canvasgeometrin kan bero på scenens contentBox (fyll/ram/bred)
    A.scene.enter?.();
  },
  openFoodShop: () => A.go('mat'), // stormarknaden man går runt i (js/scenes/shop-mat.js)
  openHousing: (opts) => openHousing(A, opts),
  openFriends: () => openWorldDialog(),
  startJob: (jobId) => startJobFlow(A, jobId, ENGINES[jobId]),
  // världen (även för tools/smoke.mjs)
  visitTarget: null,
  worldInfo,
  playersList,
  visitPlayer: (id) => visitPlayer(A, id),
  sendEmote: (e) => sendEmote(A, e),
  sendSay: (text) => sendSay(A, text),
  worldFolksHere: () => worldFolksHere(A),
};

const SCENES = {
  city: (a, o) => makeCity(a, o),
  room: (a, o) => makeRoom(a, o),
  visit: (a) => makeRoom(a, { visit: true }),
  mobler: (a, o) => makeShopIkea(a, o),
  mat: (a, o) => makeShopMat(a, o),
  bostad: (a, o) => makeShopBostad(a, o),
  kafe: (a, o) => makeShopKafe(a, o),
  moblerGammal: (a, o) => makeShopMobler(a, o),
  klader: (a, o) => makeShopKlader(a, o),
  jobbflyg: (a, o) => makeJobbFlyg(a, o),
  jobbfrukt: (a, o) => makeJobbFrukt(a, o),
  jobbburgare: (a, o) => makeJobbBurgare(a, o),
};
const ENGINES = { flygplats: 'jobbflyg', frukt: 'jobbfrukt', burgare: 'jobbburgare' };

// ---------- skala canvasen till fönstret ----------
// MOBILFYLLNING: spelet fyller HELA ytan under HUD-raden på alla enheter, med
// exakt samma pixelkorn som förut (heltal device-pixlar per spelpixel). I
// stället för svarta kanter växer den logiska vyn (A.W×A.H) med skärmen:
// breda scener (staden) visar mer värld åt alla håll, fasta scener (rum,
// butiker, jobb) ritas centrerade i sin 384×216-ruta med en mörk pixelram
// runt om – allt målas på canvasen, inga döda ytor. Testrobotar får exakt
// gamla 384×216-beteendet med marginaler, om de inte skickar ?mobfill=1.
const DESIGN_W = 384, DESIGN_H = 216;
const WIDE = {
  city: { get w() { return CITY.W; }, get h() { return CITY.H; } },
  mat: { w: 768, h: 400 }, // stormarknadens värld
  kafe: { w: 640, h: 216 }, // kaféets värld (fast höjd – resten fylls av zoomen)
};
const fillMode = () => !A.attract && (!navigator.webdriver || new URLSearchParams(location.search).has('mobfill'));
// Zoomvalet för fasta scener: 'fyll' täcker skärmen (jämn förstoring, pixelated),
// 'ram' visar hela bilden i heltalsskala med pixelram. Pekskärm får fyll som standard.
const zoomMode = () => {
  let z = null;
  try { z = localStorage.getItem('snabbfilen_zoom'); } catch { /* ok */ }
  if (z === 'ram' || z === 'vid' || z === 'nara') return z;
  // Standard: mobilen NÄRA (samma bild som på datorn – stora pixlar – och fyller
  // skärmen), datorn VID (ser mer värld). 🔍-knappen växlar nära → vid → ram.
  // NÄRA bara på små pekskärmar (mobiler) – paddor och datorer får VID (ser mer värld)
  const liten = Math.min(window.screen.width, window.screen.height) < 700;
  return matchMedia('(pointer: coarse)').matches && liten ? 'nara' : 'vid';
};
A.view = { w: DESIGN_W, h: DESIGN_H, boxX: 0, boxY: 0, boxed: false };
function applySceneView() {
  const v = A.view, cap = fillMode() && zoomMode() !== 'nara' ? (WIDE[A.sceneName] || (A.scene && A.scene.viewMax) || null) : null; // NÄRA = klassiska vyn överallt; scenen kan ange viewMax
  A.W = Math.max(DESIGN_W, Math.min(v.w, cap ? cap.w : DESIGN_W));
  A.H = Math.max(DESIGN_H, Math.min(v.h, cap ? cap.h : DESIGN_H));
  v.boxX = Math.max(0, (v.w - A.W) >> 1);
  v.boxY = Math.max(0, (v.h - A.H) >> 1);
  v.boxed = v.boxX > 0 || v.boxY > 0;
}
function fit() {
  const dpr = window.devicePixelRatio || 1;
  const box = $('#app').getBoundingClientRect();
  const w = Math.max(64, box.width), h = Math.max(64, box.height);
  const v = A.view;
  if (A.attract || !fillMode()) {
    // huvudmenyn: staden täcker fönstret (kanterna klipps) · testrobotar: gamla läget
    A.W = DESIGN_W; A.H = DESIGN_H;
    v.w = DESIGN_W; v.h = DESIGN_H; v.boxX = 0; v.boxY = 0; v.boxed = false;
    const s = Math.max(2, A.attract ? Math.ceil(Math.max(w * dpr / A.W, h * dpr / A.H)) : Math.floor(Math.min(w * dpr / A.W, h * dpr / (A.H + stripHeight(A)))));
    A.pxs = s;
    cv.width = A.W * s;
    cv.height = A.H * s;
    cv.style.width = (A.W * s / dpr) + 'px';
    cv.style.height = (A.H * s / dpr) + 'px';
    layoutStrip(A, dpr);
    return;
  }
  const strip = stripHeight(A);
  const s = Math.max(2, Math.floor(Math.min(w * dpr / DESIGN_W, h * dpr / (DESIGN_H + strip))));
  A.pxs = s;
  v.w = Math.max(DESIGN_W, Math.floor(w * dpr / s));
  v.h = Math.max(DESIGN_H, Math.floor(h * dpr / s) - strip);
  applySceneView();
  const stripCss = strip ? strip * s / dpr : 0;
  const sEl = document.getElementById('hudpix');
  if (v.boxed && zoomMode() !== 'ram') {
    // FYLL SKÄRMEN: canvasen är bara spelbilden (384×216 i heltalsskala) och
    // förstoras sedan jämnt tills ytan är täckt. Blir beskärningen orimlig
    // (stående läge) fylls bara bredden. Mätarremsan ligger kvar överst.
    // Scenen kan ange sin verkliga innehållsruta (t.ex. lokalens bredd i rummet):
    // då beskärs canvasen till den och DEN fyller skärmen – ingen död yta i bild.
    const cb = (A.scene && A.scene.contentBox) || null;
    const cbx = cb ? cb.x | 0 : 0, cby = cb ? cb.y | 0 : 0;
    const cbw = cb ? Math.max(64, Math.min(A.W, cb.w | 0)) : A.W;
    const cbh = cb ? Math.max(64, Math.min(A.H, cb.h | 0)) : A.H;
    v.boxX = -cbx; v.boxY = -cby; v.boxed = false; // vyn (v.w/v.h) lämnas orörd
    if (cv.width !== cbw * s) cv.width = cbw * s;
    if (cv.height !== cbh * s) cv.height = cbh * s;
    const bw = cbw * s / dpr, bh = cbh * s / dpr, ah = Math.max(1, h - stripCss);
    const kC = Math.min(w / bw, ah / bh), kV = Math.max(w / bw, ah / bh);
    const k = kV <= kC * 1.6 ? kV : kC; // täck ytan; bara vid orimlig beskärning (stående) fylls ena leden
    const cw = bw * k, ch = bh * k;
    cv.style.width = cw + 'px'; cv.style.height = ch + 'px';
    cv.style.position = 'absolute';
    cv.style.left = ((w - cw) / 2) + 'px';
    // beskärningen tas mest upptill (väggkonst) – golvet, disken och dörren nertill behålls
    cv.style.top = (stripCss + Math.min(0, ah - ch) * 0.7 + Math.max(0, ah - ch) / 2) + 'px';
    if (sEl) { sEl.style.position = 'absolute'; sEl.style.left = '0'; sEl.style.top = '0'; }
    layoutStrip(A, dpr, Math.max(DESIGN_W, Math.ceil(w * dpr / s)), w);
    return;
  }
  cv.style.position = ''; cv.style.left = ''; cv.style.top = '';
  if (sEl) { sEl.style.position = ''; sEl.style.left = ''; sEl.style.top = ''; }
  if (cv.width !== v.w * s) cv.width = v.w * s;
  if (cv.height !== v.h * s) cv.height = v.h * s;
  // de sista device-pixlarna (mindre än en spelpixel) fylls med en omärkbar sträckning
  cv.style.width = w + 'px';
  cv.style.height = Math.max(1, h - stripCss) + 'px';
  layoutStrip(A, dpr, v.w, w);
}
window.addEventListener('resize', fit);
window.visualViewport?.addEventListener('resize', fit);
window.addEventListener('orientationchange', fit);
if (window.ResizeObserver) new ResizeObserver(() => fit()).observe($('#app'));

// Vänd på mobilen: i stående läge på en liten pekskärm visas en vänlig skylt.
// Testrobotar ser den bara med ?rothint=1. "Spela stående ändå" gäller sessionen.
const rotEl = $('#rotate');
function rotateHint() {
  if (!rotEl) return;
  let off = false;
  try { off = !!sessionStorage.getItem('sf_rot_ok'); } catch { /* ok */ }
  const allowed = !navigator.webdriver || new URLSearchParams(location.search).has('rothint');
  const phone = matchMedia('(pointer: coarse)').matches && Math.min(window.innerWidth, window.innerHeight) < 560;
  const portrait = window.innerHeight > window.innerWidth * 1.2;
  rotEl.classList.toggle('hidden', off || !allowed || !phone || !portrait);
}
window.addEventListener('resize', rotateHint);
window.addEventListener('orientationchange', rotateHint);
$('#rotate-anyway')?.addEventListener('click', () => { try { sessionStorage.setItem('sf_rot_ok', '1'); } catch { /* ok */ } rotateHint(); });
rotateHint();

// 🔍-knappen i HUD-raden: växla zoom för rum/butiker/jobb (staden fyller alltid)
const zoomBtn = document.createElement('button');
zoomBtn.id = 'hud-zoom'; zoomBtn.className = 'btn btn-small';
const ZOOMS = {
  nara: { ikon: '🔍', txt: 'Zoom: NÄRA – samma bild som på datorn, fyller skärmen. Tryck för VID (se mer värld).' },
  vid: { ikon: '⛶', txt: 'Zoom: VID – ser mer av staden och butikerna. Tryck för RAM (hela bilden).' },
  ram: { ikon: '▣', txt: 'Zoom: RAM – hela bilden med pixelram. Tryck för NÄRA (fyller skärmen).' },
};
const zoomLabel = () => { const z = ZOOMS[zoomMode()]; zoomBtn.textContent = z.ikon; zoomBtn.title = z.txt; };
zoomLabel();
zoomBtn.addEventListener('click', () => {
  const next = { nara: 'vid', vid: 'ram', ram: 'nara' }[zoomMode()];
  try { localStorage.setItem('snabbfilen_zoom', next); } catch { /* ok */ }
  zoomLabel(); fit();
});
document.querySelector('#hud .hud-btns')?.insertBefore(zoomBtn, document.getElementById('hud-mute'));

// iOS: knip-zoom på själva sidan förstör spelytan – blockera i spelet, tillåt i dialoger
for (const ev of ['gesturestart', 'gesturechange', 'gestureend']) {
  document.addEventListener(ev, (e) => { if (!modalOpen()) e.preventDefault(); }, { passive: false });
}

// Fasta scener ritas i sin centrerade ruta: alla scener börjar med
// ctx.setTransform(A.pxs, 0, 0, A.pxs, ...), så rutans förskjutning läggs in i
// själva setTransform – scenernas egen kod behöver inte ändras.
const rawSetTransform = ctx.setTransform.bind(ctx);
ctx.setTransform = (a, b, c, d, e, f) => {
  if (typeof a === 'object') { rawSetTransform(a); return; }
  const v = A.view;
  rawSetTransform(a, b, c, d, (e || 0) + v.boxX * A.pxs, (f || 0) + v.boxY * A.pxs);
};
// pixelramen runt fasta scener: mörkt schackmönster + svart kant
let surPat = null, surKey = '';
function drawSurround() {
  const v = A.view, s = A.pxs;
  if (!surPat || surKey !== 'k' + s) {
    surKey = 'k' + s;
    const t = document.createElement('canvas');
    t.width = t.height = 8 * s;
    const g = t.getContext('2d');
    g.fillStyle = '#100e15'; g.fillRect(0, 0, t.width, t.height);
    g.fillStyle = '#151221'; g.fillRect(0, 0, 4 * s, 4 * s); g.fillRect(4 * s, 4 * s, 4 * s, 4 * s);
    surPat = ctx.createPattern(t, 'repeat');
  }
  rawSetTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = surPat;
  ctx.fillRect(0, 0, cv.width, cv.height);
  const bx = v.boxX * s, by = v.boxY * s, bw = A.W * s, bh = A.H * s, f = Math.max(2, s >> 1);
  ctx.fillStyle = '#000';
  ctx.fillRect(bx - f, by - f, bw + 2 * f, f);
  ctx.fillRect(bx - f, by + bh, bw + 2 * f, f);
  ctx.fillRect(bx - f, by, f, bh);
  ctx.fillRect(bx + bw, by, f, bh);
}

// ---------- pekare: mus + touch till logiska pixlar ----------
function toLocal(e) {
  const r = cv.getBoundingClientRect();
  const v = A.view;
  const lw = cv.width / A.pxs, lh = cv.height / A.pxs; // canvasens logiska mått, oavsett zoomläge
  return { x: (e.clientX - r.left) / r.width * lw - v.boxX, y: (e.clientY - r.top) / r.height * lh - v.boxY };
}
const inView = (p) => !A.view.boxed || (p.x >= 0 && p.y >= 0 && p.x <= A.W && p.y <= A.H);
cv.addEventListener('pointerdown', (e) => { if (modalOpen()) return; cv.setPointerCapture(e.pointerId); const p = toLocal(e); if (!inView(p)) return; A.scene?.down?.(p.x, p.y); });
cv.addEventListener('pointermove', (e) => { if (modalOpen()) return; const p = toLocal(e); if (!inView(p)) return; A.scene?.move?.(p.x, p.y); });
cv.addEventListener('pointerup', (e) => { if (modalOpen()) return; const p = toLocal(e); if (!inView(p)) return; A.scene?.up?.(p.x, p.y); });
window.addEventListener('keydown', (e) => {
  if (modalOpen() || isMenuOpen() || isChatOpen() || e.ctrlKey || e.altKey || e.metaKey) return;
  if (/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || '')) return; // man skriver i ett fält
  A.scene?.key?.(e.key);
});

// ---------- HUD (DOM) ----------
let hudKey = '';
function renderHud() {
  const g = A.game;
  const online = worldInfo().online;
  const nearby = worldFolksHere(A).length;
  $('#emotes').classList.toggle('hidden', nearby === 0);
  $('#decor-btn').classList.toggle('hidden', A.sceneName !== 'room');
  const key = `${g.day}|${Math.floor(g.min)}|${g.money}|${Math.round(g.hunger)}|${Math.round(g.energy)}|${A.avatar?.name}|${online}`;
  if (key === hudKey) return;
  hudKey = key;
  $('#hud-friends').textContent = online > 1 ? `👥 ${online}` : '👥';
  $('#hud-day').textContent = `📅 ${g.dayName} · dag ${g.day}`;
  $('#hud-clock').textContent = `🕒 ${clock(g.min)}`;
  const money = $('#hud-money');
  money.textContent = `💰 ${fmt(g.money)}`;
  money.classList.toggle('debt', g.money < 0);
  setBar('#bar-hunger', g.hunger);
  setBar('#bar-energy', g.energy);
  $('#hud-name').textContent = A.avatar?.name || '';
}
function setBar(sel, v) {
  const el = $(sel);
  el.style.width = Math.max(0, Math.min(100, v)) + '%';
  el.className = v <= 20 ? 'low' : v <= 45 ? 'mid' : '';
}

// Vaknade du på gatan i natt? (passTime satte flaggan)
function checkCollapse() {
  const g = A.game;
  if (!g.collapsed) return;
  g.collapsed = false;
  A.go('room');
  openModal('😵 Utmattad!', `<p style="font-size:20px">Du somnade där du stod och vaknar hemma – stel, hungrig och inte alls utvilad. Gå och lägg dig i tid nästa gång!</p>`,
    [{ label: 'Aj då', cls: 'btn-go', onClick: () => { closeModal(); openWeek(A, { morning: true }); } }]);
}

// ---------- sova / äta / hyra (öppnas från rummet) ----------
A.sleepFlow = () => {
  const g = A.game;
  const monday = g.day % 7 === 0; // i natt blir det måndag → hyra i morgon bitti
  openModal('😴 Sova', `<p style="font-size:20px">Sova till i morgon 07:00?</p>
    ${g.hunger < 30 ? '<p style="font-size:18px" class="bad">Du är hungrig – du sover dåligt på tom mage.</p>' : ''}
    ${monday ? `<p style="font-size:18px">💸 I morgon är det måndag: hyran ${fmt(g.homeInfo.rent)} dras.</p>` : ''}`, [
    { label: 'Inte än', onClick: closeModal },
    { label: '😴 Sov', cls: 'btn-go', onClick: () => {
      closeModal();
      play('sleep');
      const { rent, eventText } = g.sleep();
      setTimeout(() => play('morning'), 600);
      // veckosammanfattningen är alltid det första man ser när man vaknat
      openWeek(A, { morning: true, rentPaid: rent, eventText });
    } },
  ]);
};

// 👥 Onlinelistan: alla i världen, var de är just nu, "Gå dit" (i staden) och "Åk dit"
// (hem till dem). Ingen kod – öppen värld.
const PLACE_AWAY = {
  jobbflyg: '✈️ jobbar på flygplatsen', jobbfrukt: '🍊 jobbar på fruktfabriken', jobbburgare: '🍔 jobbar på Burgarbaren',
  jobbpizzeria: '🍕 jobbar på pizzerian', jobbposten: '📦 jobbar på Posten', jobbbensin: '⛽ jobbar på macken',
  jobbverkstad: '🔧 jobbar på bilverkstaden', jobbtvatt: '🧺 jobbar på tvätteriet', jobbkafe: '☕ jobbar på kaféet',
  mat: '🛒 i mataffären', klader: '👕 i klädaffären', mobler: '🛋️ på MÖBELJÄTTEN', moblergammal: '🛋️ på MÖBELJÄTTEN',
  bostad: '🔑 på bostadsbyrån', kafe: '☕ på kaféet', djur: '🐾 i djuraffären',
};
function placeOf(p, info) {
  const s = String(p.scene || 'away');
  if (s === 'city') return '🏙️ i staden';
  if (s.startsWith('home:')) {
    const owner = s.split(':')[1];
    if (owner === p.id) return '🏠 hemma';
    if (owner === info.myId) return '🏠 hemma hos dig!';
    return `🏠 hos ${playerName(owner) || 'en kompis'}`;
  }
  return PLACE_AWAY[s.slice(5)] || '💼 upptagen';
}
// 💼 Jobbinbjudan: en kompis vill jobba ihop – fråga snällt och häng med
onInvite((m) => {
  if (!m || m.to !== worldInfo().myId || String(m.job) !== 'burgare') return;
  if (modalOpen()) return; // stör inte mitt i en dialog – kompisen kan bjuda igen
  const namn = esc(String(m.namn || 'En kompis').slice(0, 16));
  play('knock');
  openModal('💼 Jobba ihop?', `<p style="font-size:20px">${namn} jobbar på <b>Burgarbaren</b> och bjuder in dig till passet – häng med och dela disken!</p>`, [
    { label: '💼 Häng med!', cls: 'btn-go', onClick: () => { closeModal(); startShiftNow(A, 'burgare', 'jobbburgare'); } },
    { label: 'Inte nu', onClick: closeModal },
  ]);
});

function openWorldDialog() {
  const info = worldInfo();
  const list = playersList();
  const inJob = A.sceneName.startsWith('jobb');
  const coopJob = A.sceneName === 'jobbburgare' ? 'burgare' : null; // jobb man kan bjuda in till (fler kommer)
  const verTag = (v) => (v === info.version ? '' : ` <span class="old">${v ? 'v' + esc(v) : 'gammal version'}</span>`);
  const rows = list.map((p, i) => `<div class="prow">
      <span data-face="${i}"></span>
      <span class="nm">${esc(p.av.name || '?')}${verTag(p.ver)}<br><small class="sp">${placeOf(p, info)}</small></span>
      ${coopJob ? `<button class="btn btn-small btn-gold" data-jobba="${esc(p.id)}">💼 Jobba ihop</button>` : ''}
      ${p.scene === 'city' && !inJob ? `<button class="btn btn-small" data-goto="${esc(p.id)}">🚶 Gå dit</button>` : ''}
      ${coopJob ? '' : `<button class="btn btn-small btn-go" data-visit="${esc(p.id)}">🚗 Åk hem till</button>`}
    </div>`).join('');
  const role = info.role === 'host' ? 'du håller i världen' : info.role === 'client' ? 'ansluten' : 'kopplar upp';
  const dlg = openModal('👥 Pixelstaden online', `
    <p style="font-size:19px;margin-top:0">${info.open ? `<b>${info.online}</b> ${info.online === 1 ? 'spelare (bara du) i världen just nu.' : 'spelare i världen just nu.'}` : '📡 Kopplar upp mot världen…'}</p>
    ${list.length ? `<div class="plist">${rows}</div>` : info.open ? '<p style="font-size:18px">Du är ensam i stan – tipsa någon om länken så ses ni här!</p>' : ''}
    <p class="world-diag">Du ser bara dem som är på samma ställe som du. v${esc(info.version)} · ${role}${info.world !== 'varlden' ? ` · värld: ${esc(info.world)}` : ''}</p>`,
  [
    ...(A.sceneName === 'visit' ? [{ label: '🚗 Åk hem', cls: 'btn-red', onClick: () => { closeModal(); A.visitTarget = null; A.game.passTime(20); A.game.save(); A.go('city'); } }] : []),
    { label: 'Stäng', cls: 'btn-go', onClick: closeModal },
  ]);
  dlg.querySelectorAll('[data-face]').forEach((el) => {
    const p = list[+el.dataset.face];
    el.replaceWith(avatarPortrait({ name: p.av.name, look: p.av.look, color: p.av.color }, 40));
  });
  dlg.querySelectorAll('[data-visit]').forEach((b) => (b.onclick = () => { closeModal(); visitPlayer(A, b.dataset.visit); }));
  dlg.querySelectorAll('[data-jobba]').forEach((b) => (b.onclick = () => {
    sendInvite(b.dataset.jobba, 'burgare', A.avatar?.name || '');
    toast('💼 Inbjudan skickad – häng kvar på passet så länge!', 'good');
    closeModal();
  }));
  dlg.querySelectorAll('[data-goto]').forEach((b) => (b.onclick = () => {
    closeModal();
    A.followPlayer = b.dataset.goto;
    if (A.sceneName !== 'city') { A.visitTarget = null; A.go('city'); }
  }));
}

// 📊 Dagboken: vad man har gjort i Pixelstaden hittills.
function openDiary() {
  const g = A.game;
  const line = (l, r) => `<div style="display:flex;justify-content:space-between;font-size:20px"><span>${l}</span><b>${r}</b></div>`;
  const jobRows = Object.values(JOBS).map((j) => {
    const n = g.jobs[j.id], b = g.best[j.id];
    return line(`${j.icon} ${j.name}`, n ? `${n} pass · ${JOB_TITLES[levelOf(n) - 1]}${b.ok ? ` · 🏅 ${b.ok} rätt / ${fmt(b.pay)}` : ''}` : 'aldrig jobbat');
  }).join('');
  openModal('📊 Din resa i Pixelstaden', `
    ${line('📅 Dag', `${g.day} (${g.dayName})`)}
    ${line('🏠 Bostad', `${g.homeInfo.icon} ${g.homeInfo.name}`)}
    ${line('🛋️ Möbler', `${Object.values(g.deco).flat().filter((d) => !d.fx).length} placerade · ${g.storage.length} i förrådet`)}
    ${line('💰 På fickan', fmt(g.money))}
    ${line('💵 Totalt intjänat', fmt(g.earned))}
    <div style="border-top:3px dashed var(--ink);margin:8px 0"></div>
    ${jobRows}
    <div style="border-top:3px dashed var(--ink);margin:8px 0"></div>
    ${line('👕 Köpta plagg', `${g.wardrobe.length} av ${SORTIMENT.length}`)}
    ${g.won ? line('🏆 Slutmålet', 'KLART!') : line('🏆 Målet', `Villan + ${fmt(WIN_MONEY)}`)}`,
  [{ label: 'Snyggt jobbat', cls: 'btn-go', onClick: closeModal }]);
}

// Slutmålet: Villan + rejält på fickan → en enda stor gratulation.
function checkWin() {
  const g = A.game;
  if (g.won || g.home !== 'villa' || g.money < WIN_MONEY) return;
  g.won = true;
  g.save();
  play('fanfare');
  openModal('🏆 Du har lyckats i Pixelstaden!', `<p style="font-size:22px;margin-top:0">Egen villa och <b>${fmt(g.money)}</b> på fickan – från ett litet rum till toppen på ${g.day} dagar!</p>
    <p style="font-size:19px">💰 Totalt intjänat: <b>${fmt(g.earned)}</b><br>🔨 Jobbade pass: <b>${Object.values(g.jobs).reduce((a, b) => a + b, 0)}</b></p>
    <p style="font-size:19px">Staden är din – spela vidare, bjud hem kompisarna och visa upp villan! 🎉</p>`,
    [{ label: '🎉 Tack!', cls: 'btn-go', onClick: closeModal }]);
}

// ---------- uppstart ----------
function boot() {
  A.game = Game.load();
  const firstRun = !localStorage.getItem(SAVE_KEY);
  A.avatar = loadAvatar();
  // garderoben visar 🔒 på plagg som inte är köpta i klädaffären än
  setAvatarLocks((kind, v) => A.game.clothesLocked(kind, v));
  // webbläsare släpper ljudet först efter en pekning
  document.addEventListener('pointerdown', unlockAudio, { capture: true });
  // HUD-knapparna: kompisar + ljud
  const mute = $('#hud-mute');
  mute.textContent = isMuted() ? '🔇' : '🔊';
  mute.onclick = () => { mute.textContent = toggleMute() ? '🔇' : '🔊'; musicTick(); };
  $('#hud-friends').onclick = () => A.openFriends();
  $('#hud-diary').onclick = () => openDiary();
  // 📅 veckan: samma sammanfattning som vid uppvaknandet
  if (!document.getElementById('hud-week')) {
    const wb = document.createElement('button');
    wb.id = 'hud-week'; wb.className = 'btn btn-small'; wb.title = 'Veckan: hyra, checklista och sparmål'; wb.textContent = '📅';
    wb.onclick = () => openWeek(A);
    $('#hud-diary').before(wb);
  }
  $('#decor-btn').onclick = () => A.scene?.toggleDecor?.();
  document.querySelectorAll('#emotes button').forEach((b) => (b.onclick = () => sendEmote(A, b.dataset.e)));
  fit();

  const begin = () => {
    startWorld(A); // den öppna världen: koppla upp tyst i bakgrunden
    if (firstRun) {
      openModal('🌆 Välkommen till Pixelstaden!', `<div class="who">${''}<div>
        <p style="font-size:20px;margin-top:0">Här börjar ditt nya liv, <b>${A.avatar.name}</b>! Du har <b>${fmt(A.game.money)}</b> på fickan.</p>
        <p style="font-size:19px">Tjäna pengar på stadens jobb, köp mat så du orkar, klä dig snyggt – och spara till en större bostad. Först: var vill du bo?</p></div></div>`,
        [{ label: '🔑 Välj bostad', cls: 'btn-go', onClick: () => { closeModal(); A.openHousing({ firstTime: true, onDone: () => { A.go('room'); weekFirst(); } }); } }],
        { closable: false });
    } else {
      A.go('room');
      weekFirst();
    }
  };
  // veckan är det första man möts av när man kommer in (men inte efter en uppdatering mitt i spelet)
  const weekFirst = () => {
    let quiet = false;
    try { quiet = !!sessionStorage.getItem('sf_quiet_start'); sessionStorage.removeItem('sf_quiet_start'); } catch { /* ok */ }
    if (quiet || (navigator.webdriver && !new URLSearchParams(location.search).has('week'))) return;
    openWeek(A);
  };

  const start = () => {
    A.attract = false;
    fit();
    if (!A.avatar.name) {
      openAvatarPicker({
        title: '🧑 Vem är du?', text: 'Skapa din figur – du kan byta kläder hemma i garderoben när du vill.',
        onPick: (av) => { A.avatar = av; begin(); },
        // utan namn kommer man aldrig in i spelet: Avbryt leder tillbaka till huvudmenyn
        onCancel: () => { A.avatar = loadAvatar(); if (A.avatar.name) begin(); else backToMenu(); },
      });
    } else begin();
  };
  const backToMenu = () => { A.attract = true; fit(); A.go('city'); openMenu(A, { onStart: start }); };
  mountMenuButton(A);
  mountChat(A);
  applyHud();
  // huvudmenyn: staden lever bakom panelen tills man väljer figur och trycker Fortsätt
  if (shouldShowMenuAtBoot()) { A.attract = true; fit(); A.go('city'); openMenu(A, { onStart: start }); }
  else start();

  // porträttet i HUD:en
  const face = $('#hud-face');
  let faceKey = '';
  setInterval(() => {
    const k = JSON.stringify(A.avatar?.look || 0);
    if (k === faceKey) return;
    faceKey = k;
    face.replaceChildren(avatarPortrait(A.avatar, 30));
  }, 800);

  requestAnimationFrame(tick);
}

// ---------- loopen ----------
let last = performance.now();
function tick(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (A.scene) {
    if (!modalOpen() && !isMenuOpen() && !A.sceneName.startsWith('jobb')) A.game.tickReal(dt);
    A.scene.update?.(dt);
    worldTick(A, A.scene.worldX ?? null, dt);
    rawSetTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#14121a';
    ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.imageSmoothingEnabled = false;
    if (A.view.boxed) {
      drawSurround();
      ctx.save();
      ctx.beginPath();
      ctx.rect(A.view.boxX * A.pxs, A.view.boxY * A.pxs, A.W * A.pxs, A.H * A.pxs);
      ctx.clip();
      A.scene.draw(ctx);
      ctx.restore();
    } else {
      A.scene.draw(ctx);
    }
    if (isPixHud() && !A.attract) drawPixHud(ctx, A);
  }
  renderHud();
  checkCollapse();
  if (!modalOpen()) checkWin();
  requestAnimationFrame(tick);
}

boot();
window.SF = A; // för tester i konsolen
