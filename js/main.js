// Snabbfilen – bootstrap. En canvas (384×216 logiska pixlar, CSS-skalad),
// scener för staden/rummet/jobben, DOM-HUD överst och en vanlig rAF-loop.
import { loadAvatar, openAvatarPicker, avatarPortrait, setAvatarWardrobe, setAvatarSalon } from './core/avatar.js';
import { openModal, closeModal, toast, modalOpen, esc } from './core/ui.js';
import { onInvite } from './net/coop.js';
import { Game, SAVE_KEY, WIN_MONEY, JOBS, JOB_TITLES, levelOf, fmt, clock, REALTIME_RATE, setPetCounter } from './game.js';
import { openGoals, celebrateGoals } from './core/livsmal.js'; // 🎯 livsmålen
import { petStore } from './pets/sim.js';
import { makeKoket } from './scenes/koket.js';
import { makeTradgard } from './scenes/tradgard.js';
import { makeCity } from './scenes/city.js';
import { makeApartment } from './scenes/apartment.js'; // hemmet: den löpande lägenheten (rummen i rad, room.js per rum)
import { makeShopMobler } from './scenes/shop-mobler.js';
import { makeShopIkea } from './scenes/shop-ikea.js';
import { makeShopMat } from './scenes/shop-mat.js';
import { makeShopBostad } from './scenes/shop-bostad.js';
import { makeShopKafe } from './scenes/shop-kafe.js';
import { makeShopKlader } from './scenes/shop-klader.js';
// garderobens butiker i downtown: statiskt importerade (inte i bakgrunden som de andra dörrscenerna)
// – då finns de direkt vid start, även för A.go('skor') i testerna och dörren första sekunden
import { makeShopSkor } from './scenes/shop-skor.js';
import { makeShopAccessoarer } from './scenes/shop-accessoarer.js';
import { makeShopFrisor } from './scenes/shop-frisor.js';
import { makeJobbFlyg } from './jobs/jobb-flyg.js';
import { makeJobbFrukt } from './jobs/jobb-frukt.js';
import { makeJobbBurgare } from './jobs/jobb-burgare.js';
import { makeJobbPizzeria } from './jobs/jobb-pizzeria.js';
import { makeJobbPosten } from './jobs/jobb-posten.js';
import { makeJobbBensin } from './jobs/jobb-bensin.js';
import { makeJobbVerkstad } from './jobs/jobb-verkstad.js';
import { makeJobbTvatt } from './jobs/jobb-tvatt.js';
import { makeJobbKafe } from './jobs/jobb-kafe.js';
import { makeJobbVard } from './jobs/jobb-vard.js';
import { makeShopBurgarbar } from './scenes/shop-burgarbar.js';
import { makeJobbKok } from './jobs/jobb-kok.js';
import { makeShopTerminal } from './scenes/shop-terminal.js';
import { makeJobbIncheck } from './jobs/jobb-incheck.js';
import { makeShopLeksaker } from './scenes/shop-leksaker.js';
import { makeShopDjur } from './scenes/shop-djur.js';
import { makeShopNarbutik } from './scenes/shop-narbutik.js';
import { startJobFlow, startShiftNow, inviteToShift, COOP_JOBS } from './jobs/shift.js';
import { openFoodShop } from './shops/matbutik.js';
import { openHousing } from './shops/bostad.js';
import { startWorld, worldTick, worldInfo, playersList, visitPlayer, sendEmote, sendSay, worldFolksHere, playerName } from './net/world.js';
import { openMenu, mountMenuButton, isMenuOpen, shouldShowMenuAtBoot } from './core/menu.js';
import { drawPixHud, isPixHud, apply as applyHud, stripHeight, layoutStrip } from './core/hud-pix.js';
import { musicTick } from './core/music.js';
import { recTick } from './core/rec.js';
import { openWeek } from './core/week.js';
import { mountChat, isChatOpen } from './core/chat.js';
import { initVoiceUI } from './net/voice-ui.js';
import { play, unlockAudio, toggleMute, isMuted } from './core/sound.js';
import { CITY, buildingById } from './city/map.js';
import { openCityMap } from './city/citymap.js'; // 🗺️ kartan och 🚕 taxin

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
  room: (a, o) => makeApartment(a, o),
  visit: (a) => makeApartment(a, { visit: true }),
  koket: (a) => makeKoket(a), // 🍳 matlagningen hemma (spisen → recept → steg för steg)
  tradgard: (a) => makeTradgard(a), // 🌱 trädgården bakom bostaden (dörren hemma)
  mobler: (a, o) => makeShopIkea(a, o),
  mat: (a, o) => makeShopMat(a, o),
  bostad: (a, o) => makeShopBostad(a, o),
  kafe: (a, o) => makeShopKafe(a, o),
  moblerGammal: (a, o) => makeShopMobler(a, o),
  klader: (a, o) => makeShopKlader(a, o), // plan 1 mode, plan 2 sport & fotboll
  skor: (a, o) => makeShopSkor(a, o), // 👟 SKOBUTIKEN i downtown
  accessoarer: (a, o) => makeShopAccessoarer(a, o), // 👜 ACCESSOARER i downtown
  frisor: (a, o) => makeShopFrisor(a, o), // 💈 FRISÖR i downtown
  jobbflyg: (a, o) => makeJobbFlyg(a, o),
  jobbfrukt: (a, o) => makeJobbFrukt(a, o),
  jobbburgare: (a, o) => makeJobbBurgare(a, o),
  jobbpizzeria: (a, o) => makeJobbPizzeria(a, o),
  jobbposten: (a, o) => makeJobbPosten(a, o),
  jobbbensin: (a, o) => makeJobbBensin(a, o),
  jobbverkstad: (a, o) => makeJobbVerkstad(a, o),
  jobbtvatt: (a, o) => makeJobbTvatt(a, o),
  jobbkafe: (a, o) => makeJobbKafe(a, o),
  jobbvard: (a, o) => makeJobbVard(a, o), // Vårdcentralens reception (js/jobs/jobb-vard.js)
  burgarbar: (a, o) => makeShopBurgarbar(a, o),
  jobbkok: (a, o) => makeJobbKok(a, o),
  terminal: (a, o) => makeShopTerminal(a, o),
  jobbincheck: (a, o) => makeJobbIncheck(a, o),
  leksaker: (a, o) => makeShopLeksaker(a, o), // Leksakslådan
  djur: (a, o) => makeShopDjur(a, o),
  narbutik: (a, o) => makeShopNarbutik(a, o), // förortens närbutik 24/7
};
const ENGINES = { flygplats: 'jobbflyg', frukt: 'jobbfrukt', burgare: 'jobbburgare', pizzeria: 'jobbpizzeria', posten: 'jobbposten', bensinmack: 'jobbbensin', bilverkstad: 'jobbverkstad', tvatteri: 'jobbtvatt', kafe: 'jobbkafe', kok: 'jobbkok', incheckning: 'jobbincheck' };

// Ställena som staden leder in i (map.js enter → city.js SCENE_DOORS): downtowns butiker, bion,
// kebaben, pantbanken, Pixelhögskolan och de utbildade jobben. De laddas i bakgrunden, var för
// sig och tåligt (spelet startar utan att vänta på dem): saknas en modul eller kraschar den vid
// laddningen visar dörren i staden husets soon-text i stället (A.hasScene). Går man in innan
// modulen hunnit laddas visas en tom ruta tills den är klar. Listan fylls på i takt med att
// scenerna släpps; en scen som redan finns i SCENES (statisk import) lämnas orörd.
const DOOR_SCENES = [
  ['bank', './scenes/shop-bank.js', 'makeShopBank'],
  ['elektronik', './scenes/shop-elektronik.js', 'makeShopElektronik'],
  ['bio', './scenes/shop-bio.js', 'makeShopBio'],
  ['kebab', './scenes/shop-kebab.js', 'makeShopKebab'],
  ['pantbank', './scenes/shop-pantbank.js', 'makePantbank'],
  ['universitet', './scenes/shop-universitet.js', 'makeShopUniversitet'],
  ['jobbdatorbygge', './jobs/jobb-datorbygge.js', 'makeJobbDatorbygge'],
  ['jobbfinans', './jobs/jobb-finans.js', 'makeJobbFinans'],
];
const DOOR_STATE = {};   // namn → 'laddar' | 'klar' | 'fel'
for (const [n, file, fn] of DOOR_SCENES) {
  if (SCENES[n]) continue;
  let make = null;
  DOOR_STATE[n] = 'laddar';
  import(file).then((m) => {
    if (typeof m[fn] !== 'function') throw new Error(`${fn} saknas i ${file}`);
    make = m[fn]; DOOR_STATE[n] = 'klar';
  }).catch((e) => { DOOR_STATE[n] = 'fel'; console.error(`scenen ${n} kunde inte laddas:`, e); });
  // modulen klar → scenen; annars en tom väntescen som byter till den riktiga när den laddats
  SCENES[n] = (a, o) => (make ? make(a, o) : {
    t: 0,
    update(dt) {
      this.t += dt;
      if (make) a.go(n, o);
      else if (DOOR_STATE[n] === 'fel' || this.t > 20) { a.go('city'); toast('🚪 Det gick inte att komma in just nu – försök igen om en stund.', 'bad'); }
    },
    draw() { /* bakgrunden (loopen fyller rutan) tills scenen är laddad */ },
  });
}
for (const [id, sc] of [['datorbygge', 'jobbdatorbygge'], ['finans', 'jobbfinans']]) if (!ENGINES[id] && SCENES[sc]) ENGINES[id] = sc;
Object.assign(A, {
  hasScene: (n) => typeof SCENES[n] === 'function' && DOOR_STATE[n] !== 'fel',
  jobReady: (id) => !!JOBS[id] && A.hasScene(ENGINES[id]), // jobbet finns OCH har en jobbscen
});

// Vårdcentralens reception (egen rad, eftersom ENGINES-raden ovan ändras av flera samtidigt)
ENGINES.vard = 'jobbvard';

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
  burgarbar: { w: 640, h: 216 }, // dinern man går in i
};
const fillMode = () => !A.attract && (!navigator.webdriver || new URLSearchParams(location.search).has('mobfill'));
// Zoomvalet för fasta scener: 'fyll' täcker skärmen (jämn förstoring, pixelated),
// 'ram' visar hela bilden i heltalsskala med pixelram. Pekskärm får fyll som standard.
// Mobilen i datorns upplösning (Carl 2026-09-29/30: "får vi samma upplösning som på datorn?"):
// en telefon i liggande läge (html.desk-mobil, se index.html) får VID som på datorn – samma
// pixelstorlek och lika mycket av staden. Den som stod på NÄRA sedan förr flyttas till VID en
// gång; därefter gäller ens eget val med 🔍 igen.
const deskMobil = () => document.documentElement.classList.contains('desk-mobil');
try {
  if (deskMobil() && !localStorage.getItem('snabbfilen_zoom_dator')) {
    if (localStorage.getItem('snabbfilen_zoom') === 'nara') localStorage.setItem('snabbfilen_zoom', 'vid');
    localStorage.setItem('snabbfilen_zoom_dator', '1');
  }
} catch { /* ok */ }
const zoomMode = () => {
  let z = null;
  try { z = localStorage.getItem('snabbfilen_zoom'); } catch { /* ok */ }
  if (z === 'ram' || z === 'vid' || z === 'nara') return z;
  // Standard: datorn och telefonen i liggande läge VID (ser lika mycket värld, samma pixelstorlek);
  // en liten pekskärm i stående läge NÄRA (stora pixlar). 🔍-knappen växlar nära → vid → ram.
  const liten = Math.min(window.screen.width, window.screen.height) < 700;
  return matchMedia('(pointer: coarse)').matches && liten && !deskMobil() ? 'nara' : 'vid';
};
A.view = { w: DESIGN_W, h: DESIGN_H, boxX: 0, boxY: 0, boxed: false, safe: { x0: 0, y0: 0, x1: DESIGN_W, y1: DESIGN_H } };
// Telefonen i liggande läge: EN skala i alla scener (Carl 2026-09-30: "utgå från Burgarbaren, gör
// en lite större än där och ha samma storlek i staden och inomhus"). Skalan (hela skärmpixlar per
// spelpixel) räknas på telefonens FYSISKA skärmhöjd – ~PHONE_VIEW_H spelpixlar på hela höjden – så
// att figuren inte byter storlek när Safaris adressfält visas/göms (iPhone 13 mini: 5, ~20 % större
// än i Burgarbaren förr). 🔍: NÄRA = en pixel större skala, RAM = en mindre. Staden visar precis
// skärmen; lokaler som är större beskärs (mest upptill), mindre får mörka kanter – inget förstoras.
const PHONE_VIEW_H = 200;
const phoneBaseScale = () => {
  const phys = Math.min(window.screen.width, window.screen.height) * (window.__baseDpr || window.devicePixelRatio || 1);
  return Math.round(phys / (PHONE_VIEW_H + stripHeight(A)));
};
const phoneScale = () => fillMode() && deskMobil();
function applySceneView() {
  const v = A.view;
  if (phoneScale()) {
    const cap = WIDE[A.sceneName] || (A.scene && A.scene.viewMax) || null;
    A.W = cap ? Math.max(Math.min(DESIGN_W, v.w), Math.min(v.w, cap.w)) : DESIGN_W;
    A.H = A.sceneName === 'city' ? v.h : cap ? Math.max(DESIGN_H, Math.min(v.h, cap.h)) : DESIGN_H;
    v.boxX = Math.max(0, (v.w - A.W) >> 1);
    v.boxY = Math.max(0, (v.h - A.H) >> 1);
    v.boxed = A.W !== v.w || A.H !== v.h;
    return;
  }
  const cap = fillMode() && zoomMode() !== 'nara' ? (WIDE[A.sceneName] || (A.scene && A.scene.viewMax) || null) : null; // NÄRA = klassiska vyn överallt; scenen kan ange viewMax
  A.W = Math.max(DESIGN_W, Math.min(v.w, cap ? cap.w : DESIGN_W));
  A.H = Math.max(DESIGN_H, Math.min(v.h, cap ? cap.h : DESIGN_H));
  v.boxX = Math.max(0, (v.w - A.W) >> 1);
  v.boxY = Math.max(0, (v.h - A.H) >> 1);
  v.boxed = v.boxX > 0 || v.boxY > 0;
}
function fit() {
  const dpr = window.devicePixelRatio || 1;
  const box = $('#app').getBoundingClientRect();
  // innehållsrutan: utan padding (Möblera-panelen reserverar plats till höger med padding-right)
  const cs = getComputedStyle($('#app')), pad = (k) => parseFloat(cs[k]) || 0;
  const w = Math.max(64, box.width - pad('paddingLeft') - pad('paddingRight')), h = Math.max(64, box.height - pad('paddingTop') - pad('paddingBottom'));
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
  const phone = phoneScale();
  const zoomStep = { nara: 1, vid: 0, ram: -1 }[zoomMode()] || 0;
  const s = phone
    ? Math.max(2, phoneBaseScale() + zoomStep)
    : Math.max(2, Math.floor(Math.min(w * dpr / DESIGN_W, h * dpr / (DESIGN_H + strip))));
  A.pxs = s;
  v.w = phone ? Math.floor(w * dpr / s) : Math.max(DESIGN_W, Math.floor(w * dpr / s));
  v.h = phone ? Math.floor(h * dpr / s) - strip : Math.max(DESIGN_H, Math.floor(h * dpr / s) - strip);
  applySceneView();
  const stripCss = strip ? strip * s / dpr : 0;
  const sEl = document.getElementById('hudpix');
  if (v.boxed && (phone || zoomMode() !== 'ram')) {
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
    // täck ytan; bara vid orimlig beskärning (stående) fylls ena leden · telefonen: samma skala
    // överallt (k = 1) – lokalen beskärs eller får mörka kanter i stället för att förstoras
    const k = phone ? 1 : kV <= kC * 1.6 ? kV : kC;
    const cw = bw * k, ch = bh * k;
    cv.style.width = cw + 'px'; cv.style.height = ch + 'px';
    cv.style.position = 'absolute';
    cv.style.left = ((w - cw) / 2) + 'px';
    // den SYNLIGA rutan i spelpixlar – skyltar och HUD i scenerna klämmer sig innanför
    // (höjdledet sätts av followCrop, som också flyttar bilden i höjdled)
    const cropL = Math.max(0, (cw - w) / 2);
    v.safe = { x0: Math.ceil(cropL / cw * A.W), x1: A.W - Math.ceil(cropL / cw * A.W), y0: 0, y1: A.H };
    v.crop = { ch, ah, stripCss, rows: cbh, oy: cby, f: null, scene: null, top: '' };
    followCrop(0);
    if (sEl) { sEl.style.position = 'absolute'; sEl.style.left = '0'; sEl.style.top = '0'; }
    layoutStrip(A, dpr, Math.max(DESIGN_W, Math.ceil(w * dpr / s)), w);
    return;
  }
  cv.style.position = ''; cv.style.left = ''; cv.style.top = '';
  if (sEl) { sEl.style.position = ''; sEl.style.left = ''; sEl.style.top = ''; }
  v.safe = { x0: 0, y0: 0, x1: A.W, y1: A.H }; // hela rutan syns i ram/vid-lägena
  v.crop = null;
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
  const key = `${g.day}|${Math.floor(g.min)}|${g.money}|${Math.round(g.hunger)}|${Math.round(g.energy)}|${Math.round(g.lycka)}|${A.avatar?.name}|${online}`;
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
  setBar('#bar-lycka', g.lycka);
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
  openModal('😵 Utmattad!', `<p style="font-size:var(--f2)">Du somnade där du stod och vaknar hemma – stel, hungrig och inte alls utvilad. Gå och lägg dig i tid nästa gång!</p>`,
    [{ label: 'Aj då', cls: 'btn-go', onClick: () => { closeModal(); openWeek(A, { morning: true }); } }]);
}

// ---------- sova / äta / hyra (öppnas från rummet) ----------
A.sleepFlow = () => {
  const g = A.game;
  const monday = g.day % 7 === 0; // i natt blir det måndag → hyra i morgon bitti
  // sparkontot: räntan i morgon bitti och det autogirot tar om fickan inte räcker till hyran
  const ranta = monday && g.bankNextInterest ? g.bankNextInterest() : 0;
  const autogiro = monday && g.bank > 0 ? Math.min(g.bank + ranta, Math.max(0, g.homeInfo.rent - Math.max(0, g.money))) : 0;
  openModal('😴 Sova', `<p style="font-size:var(--f2)">Sova till i morgon 07:00?</p>
    ${g.hunger < 30 ? '<p style="font-size:var(--f2)" class="bad">Du är hungrig – du sover dåligt på tom mage.</p>' : ''}
    ${monday ? `<p style="font-size:var(--f2)">💸 I morgon är det måndag: hyran ${fmt(g.homeInfo.rent)} dras.${autogiro ? ` Fickan räcker inte – banken tar ${fmt(autogiro)} från sparkontot.` : ''}</p>` : ''}
    ${ranta ? `<p style="font-size:var(--f2)">📈 Räntan på sparkontot kommer i morgon bitti: +${fmt(ranta)}.</p>` : ''}`, [
    { label: 'Inte än', onClick: closeModal },
    { label: '😴 Sov', cls: 'btn-go', onClick: () => {
      closeModal();
      // veckosammanfattningen är alltid det första man ser när man vaknat
      const wake = () => { const { rent, eventText, odlat } = g.sleep(); openWeek(A, { morning: true, rentPaid: rent, eventText, odlat }); };
      // klickade man på sängen lägger sig figuren under täcket först (room.js spelar natten)
      if (A.scene?.bedtime?.(wake)) return;
      play('sleep');
      wake();
      setTimeout(() => play('morning'), 600);
    } },
  ]);
};

// 👥 Onlinelistan: alla i världen, var de är just nu, "Gå dit" (i staden) och "Åk dit"
// (hem till dem). Ingen kod – öppen värld.
const PLACE_AWAY = {
  jobbflyg: '✈️ jobbar på flygplatsen', jobbfrukt: '🍊 jobbar på fruktfabriken', jobbburgare: '🍔 jobbar på Burgarbaren',
  jobbpizzeria: '🍕 jobbar på pizzerian', jobbposten: '📦 jobbar på Posten', jobbbensin: '⛽ jobbar på macken',
  jobbverkstad: '🔧 jobbar på bilverkstaden', jobbtvatt: '🧺 jobbar på tvätteriet', jobbkafe: '☕ jobbar på kaféet',
  jobbvard: '🏥 jobbar på vårdcentralen',
  mat: '🛒 i mataffären', klader: '👕 i klädaffären', mobler: '🛋️ på MÖBELJÄTTEN', moblergammal: '🛋️ på MÖBELJÄTTEN',
  bostad: '🔑 på bostadsbyrån', kafe: '☕ på kaféet', djur: '🐾 i djuraffären', narbutik: '🏪 i närbutiken', terminal: '✈️ på flygplatsen', jobbincheck: '🛄 jobbar i incheckningen', leksaker: '🧸 i leksaksaffären',
};
// ställena bakom stadens dörrar (DOOR_SCENES) – bara där ingen text redan finns
for (const [k, v] of Object.entries({ bank: '🏦 på banken', elektronik: '📱 i elektronikbutiken', frisor: '💈 hos frisören', skor: '👟 i skobutiken',
  accessoarer: '👜 i accessoarbutiken', bio: '🎬 på bion', kebab: '🥙 på kebaben', pantbank: '💍 på pantbanken', universitet: '🎓 på Pixelhögskolan',
  jobbdatorbygge: '🖥️ bygger datorer på Pixel Data', jobbfinans: '📈 handlar aktier på Finanshuset', koket: '🍳 lagar mat hemma', tradgard: '🌱 i trädgården' })) PLACE_AWAY[k] ??= v;
function placeOf(p, info) {
  const s = String(p.scene || 'away');
  if (s === 'city') return '🏙️ i staden';
  if (s.startsWith('home:')) {
    const owner = s.split(':')[1];
    if (owner === p.id) return '🏠 hemma';
    if (owner === info.myId) return '🏠 hemma hos dig!';
    return `🏠 hos ${playerName(owner) || 'en kompis'}`;
  }
  return PLACE_AWAY[s.slice(5).split('.')[0]] || '💼 upptagen';
}
// 💼 Jobbinbjudan: en kompis vill jobba ihop – fråga snällt och häng med. Man hamnar i
// kompisens pass (sid) med kompisens nivå och passlängd.
onInvite((m, from) => {
  const job = String(m?.job || '');
  if (!m || m.to !== worldInfo().myId || !COOP_JOBS.has(job) || !JOBS[job] || !ENGINES[job] || !m.sid) return;
  const namn = esc(String(m.namn || 'En kompis').slice(0, 16));
  if (A.shiftJob) { toast(`💼 ${namn} vill jobba ihop – men du är mitt i ett pass.`, 'bad'); return; }
  if (modalOpen()) return; // stör inte mitt i en dialog – kompisen kan bjuda igen
  play('knock');
  const lang = m.len === 'langt';
  openModal('💼 Jobba ihop?', `<p style="font-size:var(--f2)">${namn} jobbar på <b>${esc(JOBS[job].name)}</b> och bjuder in dig till ${lang ? 'ett <b>längre pass</b> (6 timmar)' : 'passet'} – häng med och jobba ihop!</p>
    ${(m.lvl | 0) > 1 ? `<p style="font-size:var(--f2)">⭐ Ni jobbar på ${namn}s nivå (${esc(JOB_TITLES[(m.lvl | 0) - 1] || '')}) – fler kunder!</p>` : ''}`, [
    { label: '💼 Häng med!', cls: 'btn-go', onClick: () => { if (leaveBlocked()) return; closeModal(); startShiftNow(A, job, ENGINES[job], { sid: m.sid, len: m.len, lvl: m.lvl, from }); } },
    { label: 'Inte nu', onClick: closeModal },
  ]);
});

// ätregeln: mitt i maten (eller med maten i handen) lämnar man inte stället via dialogerna
function leaveBlocked() {
  let why = null;
  try { why = A.scene?.leaveBlock?.() || null; } catch { why = null; }
  if (!why) return false;
  closeModal();
  toast(`😋 ${String(why)}`, 'bad');
  return true;
}
function openWorldDialog() {
  const info = worldInfo();
  const list = playersList();
  const inJob = A.sceneName.startsWith('jobb');
  const coopJob = inJob && COOP_JOBS.has(A.shiftJob) ? A.shiftJob : null; // passet man kan bjuda in till
  const verTag = (v) => (v === info.version ? '' : ` <span class="old">${v ? 'v' + esc(v) : 'gammal version'}</span>`);
  const rows = list.map((p, i) => `<div class="prow">
      <span data-face="${i}"></span>
      <span class="nm">${esc(p.av.name || '?')}${verTag(p.ver)}<br><small class="sp">${placeOf(p, info)}</small></span>
      ${coopJob ? `<button class="btn btn-small btn-gold" data-jobba="${esc(p.id)}">💼 Jobba ihop</button>` : ''}
      ${p.scene === 'city' && !inJob ? `<button class="btn btn-small" data-goto="${esc(p.id)}">🚶 Gå dit</button>` : ''}
      ${coopJob ? '' : `<button class="btn btn-small btn-go" data-visit="${esc(p.id)}">🚗 Åk hem till</button>`}
    </div>`).join('');
  const role = info.role === 'host' ? 'du håller i världen' : info.role === 'client' && info.open ? 'ansluten' : `kopplar upp${info.tries ? ` (försök ${info.tries + 1})` : ''}`;
  // kommer man inte fram till världen gång på gång stoppar nätet troligen direktkontakten (world.js ICE)
  const stuck = !info.open && info.tries >= 2
    ? `<p style="font-size:var(--f2);background:#fff1d6;border:2px solid #c9a24a;padding:6px 8px">📡 Du kommer inte fram till de andra – nätet du sitter på stoppar troligen spelets direktkontakt. Prova ett annat wifi eller mobilens nät, eller en annan webbläsare.</p>` : '';
  const dlg = openModal('👥 Pixelstaden online', `
    <p style="font-size:var(--f2);margin-top:0">${info.open ? `<b>${info.online}</b> ${info.online === 1 ? 'spelare (bara du) i världen just nu.' : 'spelare i världen just nu.'}` : '📡 Kopplar upp mot världen…'}</p>
    ${list.length ? `<div class="plist">${rows}</div>` : info.open ? '<p style="font-size:var(--f2)">Du är ensam i stan – tipsa någon om länken så ses ni här!</p>' : ''}${stuck}
    <p class="world-diag">Du ser bara dem som är på samma ställe som du. v${esc(info.version)} · ${role}${info.world !== 'varlden' ? ` · värld: ${esc(info.world)}` : ''}</p>`,
  [
    ...(A.sceneName === 'visit' ? [{ label: '🚗 Åk hem', cls: 'btn-red', onClick: () => { closeModal(); A.visitTarget = null; A.game.passTime(20); A.game.save(); A.go('city'); } }] : []),
    { label: 'Stäng', cls: 'btn-go', onClick: closeModal },
  ]);
  dlg.querySelectorAll('[data-face]').forEach((el) => {
    const p = list[+el.dataset.face];
    el.replaceWith(avatarPortrait({ name: p.av.name, look: p.av.look, color: p.av.color }, 40));
  });
  dlg.querySelectorAll('[data-visit]').forEach((b) => (b.onclick = () => { if (leaveBlocked()) return; closeModal(); visitPlayer(A, b.dataset.visit); }));
  dlg.querySelectorAll('[data-jobba]').forEach((b) => (b.onclick = () => {
    inviteToShift(A, b.dataset.jobba);
    toast('💼 Inbjudan skickad – häng kvar på passet så länge!', 'good');
    closeModal();
  }));
  dlg.querySelectorAll('[data-goto]').forEach((b) => (b.onclick = () => {
    if (leaveBlocked()) return;
    closeModal();
    A.followPlayer = b.dataset.goto;
    if (A.sceneName !== 'city') { A.visitTarget = null; A.go('city'); }
  }));
}

// 📊 Dagboken: vad man har gjort i Pixelstaden hittills.
function openDiary() {
  const g = A.game;
  const plagg = g.wardrobeCount();
  const line = (l, r) => `<div style="display:flex;justify-content:space-between;font-size:var(--f2)"><span>${l}</span><b>${r}</b></div>`;
  const jobRows = Object.values(JOBS).map((j) => {
    const n = g.jobs[j.id], b = g.best[j.id];
    return line(`${j.icon} ${j.name}`, n ? `${n} pass · ${JOB_TITLES[levelOf(n) - 1]}${b.ok ? ` · 🏅 ${b.ok} rätt / ${fmt(b.pay)}` : ''}` : 'aldrig jobbat');
  }).join('');
  openModal('📊 Din resa i Pixelstaden', `
    ${line('📅 Dag', `${g.day} (${g.dayName})`)}
    ${line('🏠 Bostad', `${g.homeInfo.icon} ${g.homeInfo.name}`)}
    ${line('🛋️ Möbler', `${Object.values(g.deco).flat().filter((d) => !d.fx).length} placerade · ${g.storage.length} i förrådet`)}
    ${line('💰 På fickan', fmt(g.money))}
    ${g.bank ? line('🏦 På banken', fmt(g.bank)) : ''}
    ${g.pant?.length ? line('💍 I pantbanken', g.pant.map((p) => `nr ${p.nr}: ${fmt(p.skuld)} senast dag ${p.sista}`).join(' · ')) : ''}
    ${line('💵 Totalt intjänat', fmt(g.earned))}
    <div style="border-top:3px dashed var(--ink);margin:8px 0"></div>
    ${jobRows}
    <div style="border-top:3px dashed var(--ink);margin:8px 0"></div>
    ${line('👕 Köpta plagg', `${plagg.owned} av ${plagg.of}`)}
    ${line('😊 Lycka', `${Math.round(g.lycka)} av 100`)}
    ${g.mal ? line('🎯 Livsmålen', g.malKlar ? `ALLA NÅDDA dag ${g.malKlar}! 🏆` : `${g.malStatus().filter((s) => s.done).length} av 4 nådda`) : line('🎯 Livsmålen', 'inte valda än')}
    ${g.won ? line('🏆 Gamla slutmålet', `Villan + ${fmt(WIN_MONEY)} – KLART!`) : ''}`,
  [
    { label: '🎯 Livsmålen', onClick: () => { closeModal(); openGoals(A); } },
    { label: 'Snyggt jobbat', cls: 'btn-go', onClick: closeModal },
  ]);
}

// Livsmålen: alla fyra nådda samtidigt → en enda stor gratulation (g.malKlar = dagen). Man spelar
// vidare; höjer man nivåerna efteråt firas det inte igen.
function checkWin() {
  const g = A.game;
  if (!g.mal || g.malKlar) return;
  const S = g.malStatus();
  if (!S.length || !S.every((s) => s.done)) return;
  g.malKlar = g.day;
  g.save();
  celebrateGoals(A);
}

// ---------- uppstart ----------
function boot() {
  A.game = Game.load();
  const firstRun = !localStorage.getItem(SAVE_KEY);
  // lyckan på morgonen räknar djuren hemma (game.js importerar inte djuren själv)
  setPetCounter((home) => petStore().petsHome(home).length);
  A.avatar = loadAvatar();
  // garderoben visar bara plagg man äger (klädkatalogens id; gamla 'kind:v' räknas) + basplaggen
  setAvatarWardrobe(() => A.game.ownedWardrobeIds());
  // frisyr och hårfärg byts hos 💈 Frisören i downtown (js/scenes/shop-frisor.js), inte gratis i
  // garderoben hemma – en ny figur väljer fortfarande fritt (setAvatarSalon i js/core/avatar.js)
  setAvatarSalon(true);
  // webbläsare släpper ljudet först efter en pekning
  document.addEventListener('pointerdown', unlockAudio, { capture: true });
  // HUD-knapparna: kompisar + ljud
  const mute = $('#hud-mute');
  mute.textContent = isMuted() ? '🔇' : '🔊';
  mute.onclick = () => { mute.textContent = toggleMute() ? '🔇' : '🔊'; musicTick(); };
  $('#hud-friends').onclick = () => A.openFriends();
  initVoiceUI(A); // 🎙️ röstchatten: röst i närheten + röstgrupper (js/net/voice.js)
  $('#hud-diary').onclick = () => openDiary();
  // 📅 veckan: samma sammanfattning som vid uppvaknandet
  if (!document.getElementById('hud-week')) {
    const wb = document.createElement('button');
    wb.id = 'hud-week'; wb.className = 'btn btn-small'; wb.title = 'Veckan: hyra, checklista och sparmål'; wb.textContent = '📅';
    wb.onclick = () => openWeek(A);
    $('#hud-diary').before(wb);
  }
  // 🎯 livsmålen: hur långt man har kommit (och ändra nivåerna)
  if (!document.getElementById('hud-goals')) {
    const gb = document.createElement('button');
    gb.id = 'hud-goals'; gb.className = 'btn btn-small'; gb.title = 'Livsmålen: rikedom, lycka, utbildning och karriär'; gb.textContent = '🎯';
    gb.onclick = () => openGoals(A);
    $('#hud-week').before(gb);
  }
  // 🗺️ kartan och 🚕 taxin (Carl 2026-09-29): tryck på ett ställe på kartan → 🧭 en pil i staden
  // visar vägen (A.guideTo) eller 🚕 en taxi hämtar en vid trottoarkanten (A.taxiTo, city.js)
  A.openMap = (mode = 'karta', select = null) => { play('click'); return openCityMap(A, { mode, select }); };
  A.guideTo = (id) => {
    const b = buildingById(id);
    if (!b) return;
    A.guide = { id: b.id };
    toast(A.sceneName === 'city' ? `🧭 Följ pilen till ${b.icon || ''} ${b.sign || ''}!` : `🧭 När du kommer ut i stan visar en pil vägen till ${b.icon || ''} ${b.sign || ''}.`, 'good');
  };
  A.taxiTo = (id) => {
    if (!buildingById(id)) return;
    if (/^jobb/.test(A.sceneName || '')) { toast('🚕 Du är mitt i ett pass – beställ taxin när du har slutat.', 'bad'); return; }
    if (A.sceneName === 'city' && A.scene?.callTaxi) { A.scene.callTaxi(id); return; }
    // inifrån: ut på trottoaren (hemma: genom ytterdörren), där beställs taxin (city.js)
    A.pendingTaxi = id;
    if (A.sceneName === 'room') { A.roomSub = 0; if (A.visitTarget) A.visitTarget = null; else A.leftHome = true; }
    play('door');
    A.go('city');
  };
  for (const [id, icon, title, fn] of [
    ['hud-map', '🗺️', 'Kartan – tryck på ett ställe så visar en pil vägen dit', () => A.openMap('karta')],
    ['hud-taxi', '🚕', 'Ring efter en taxi', () => (A.sceneName === 'city' && A.scene?.taxiBusy?.() ? A.scene.taxiMenu() : A.openMap('taxi'))],
  ]) {
    if (document.getElementById(id)) continue;
    const b = document.createElement('button');
    b.id = id; b.className = 'btn btn-small'; b.title = title; b.textContent = icon;
    b.onclick = fn;
    $('#hud-friends').before(b);
  }
  $('#decor-btn').onclick = () => A.scene?.toggleDecor?.();
  document.querySelectorAll('#emotes button').forEach((b) => (b.onclick = () => sendEmote(A, b.dataset.e)));
  fit();

  const begin = () => {
    startWorld(A); // den öppna världen: koppla upp tyst i bakgrunden
    if (firstRun) {
      openModal('🌆 Välkommen till Pixelstaden!', `<div class="who">${''}<div>
        <p style="font-size:var(--f2);margin-top:0">Här börjar ditt nya liv, <b>${A.avatar.name}</b>! Du har <b>${fmt(A.game.money)}</b> på fickan.</p>
        <p style="font-size:var(--f2)">Alla börjar i en rostig husvagn ute i förorten. Tjäna pengar på stadens jobb, köp mat så du orkar, klä dig snyggt – och spara ihop till en bättre bostad hos bostadsbyrån!</p></div></div>`,
        [{ label: '🚐 Till husvagnen', cls: 'btn-go', onClick: () => { closeModal(); A.game.home = 'husvagn'; A.game.save(); A.go('room'); goalsFirst(weekFirst); } }],
        { closable: false });
    } else {
      A.go('room');
      goalsFirst(weekFirst);
    }
  };
  // Livsmålen väljs innan veckan visas: nya spelare direkt efter välkomsten, sparfiler från före
  // livsmålen första gången de kommer in. (Testrobotar slipper rutan, utom med ?mal i adressen.)
  const goalsFirst = (then) => {
    const robot = navigator.webdriver && !new URLSearchParams(location.search).has('mal');
    if (A.game.mal || robot) { then(); return; }
    openGoals(A, { pick: true, first: true, onDone: then });
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

// Bilden i höjdled (fyll-läget): är den högre än skärmen beskärs den – mest upptill (väggkonst;
// golvet, disken och dörren nertill behålls). I hemmet och i jobben utan egen kamera i höjdled
// följer beskärningen i stället figuren: på telefonen (särskilt i NÄRA) syns då disken när man
// står vid den och borden när man går ner (Carl 2026-09-30, Burgarbaren: "sakerna på disken …
// fastnar bakom"). Butikerna, bion och vårdcentralen/incheckningen/verkstaden har egna kameror
// som läser A.view.safe – där står beskärningen still (annars följer två kameror samtidigt).
// Flyttas i hela device-pixlar – bilden förblir skarp.
const OWN_CAM_Y = new Set(['jobbvard', 'jobbincheck', 'jobbverkstad']);
const followsY = (n) => n === 'room' || n === 'visit' || (n.startsWith('jobb') && !OWN_CAM_Y.has(n));
function followCrop(dt) {
  const c = A.view.crop; if (!c) return;
  const extra = Math.max(0, c.ch - c.ah);
  const cap = WIDE[A.sceneName] || A.scene?.viewMax || null;
  const y = extra > 0.5 && A.scene && followsY(A.sceneName) && (!cap || cap.h <= DESIGN_H) ? A.scene.worldY : null;
  let f = 0.7;
  if (Number.isFinite(y)) {
    const vis = c.rows * c.ah / c.ch; // synliga rader
    f = Math.max(0, Math.min(1, (y - c.oy - 18 - vis / 2) / Math.max(1, c.rows - vis))); // (figurens mitt ≈ 18 px ovanför fötterna)
  }
  const snap = c.f == null || !dt || c.scene !== A.scene;
  c.scene = A.scene;
  c.f = snap ? f : c.f + (f - c.f) * Math.min(1, dt * 4);
  const dpr = window.devicePixelRatio || 1;
  const cropT = Math.round(extra * c.f * dpr) / dpr, cropB = extra - cropT;
  const top = (c.stripCss - cropT + Math.max(0, c.ah - c.ch) / 2) + 'px';
  if (top !== c.top) { c.top = top; cv.style.top = top; }
  A.view.safe.y0 = Math.ceil(cropT / c.ch * A.H); A.view.safe.y1 = A.H - Math.ceil(cropB / c.ch * A.H);
}

// ---------- loopen ----------
let last = performance.now();
function tick(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (A.scene) {
    if (!modalOpen() && !isMenuOpen() && !A.sceneName.startsWith('jobb') && A.sceneName !== 'koket') {   // (i köket räknar Game.cook tiden)
      A.game.tickReal(dt);
      if (worldFolksHere(A).length) A.game.kompisTid(dt * REALTIME_RATE);              // kompisar i närheten gör en glad
    }
    A.scene.update?.(dt);
    followCrop(dt);
    worldTick(A, A.scene.worldX ?? null, dt);
    recTick(A, dt); // bakgrundsljudet där man är + musiken (tyst före första klicket, vid mute och i dold flik)
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
