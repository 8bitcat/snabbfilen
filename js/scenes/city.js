// Pixelstaden – en stor stad (CITY.W × CITY.H) där kameran följer figuren.
// Scenen sköter kamera, gång, dörrar, ljussättning, väder, bussen och vad som
// händer när man går in; konsten och livet kommer från modulerna i js/city/
// (kontraktet: js/city/map.js + docs/STADEN.md). Modulerna laddas var för sig –
// kraschar en, lever resten.
import { openHouseSign } from '../shops/bostad.js';
import { CITY, BUILDINGS, ALL_BUILDINGS, doorCenter, artPos, artBox, baseOf, isNightHour, BUS_STOPS, busStopById,
  DISTRICTS, districtAt, districtByName, MAP_OBSTACLES, RIVER, buildingById } from '../city/map.js';
import { taxiQuote, metersBetween } from '../city/citymap.js'; // 🗺️ kartan: taxipriset och avstånden
import { createWalker, selfDrawable, folkDrawables, nameTag, sayBubble } from './walkable.js';
import { drawPerson } from '../core/people.js';
import { openModal, closeModal, toast, esc } from '../core/ui.js';
import { play } from '../core/sound.js';
import { SMALL, BIG, ctxText, textW } from '../core/floor-pix.js';
import { worldFolksHere } from '../net/world.js';
import { clock, JOBS, HOMES } from '../game.js';
import * as GAME from '../game.js'; // (namnrymd: COURSES finns bara när Pixelhögskolan är inkopplad i game.js)
import { WORKPLACES, NEW_HOMES } from '../city/places.js';
import { createPetWalk } from '../pets/outdoors.js'; // husdjuren på promenad (hunden i koppel)
import { drawTruck, TRUCK_RECT } from '../core/truck-art.js';               // 🚚 foodtrucken (eget företag)
import { openTruck, truckOppen, truckNamn } from '../core/foretag.js';
import { makeLookRich } from '../core/people.js';

// Stadsmodulerna. buildings-* ger BUILDING_ART, ground/props/traffic/life livet,
// weather vädret, walk gångmotorn och fallback-v2 platshållare för allt som
// modulerna inte täcker ännu (marken/skjulen/staketen i v2-områdena).
// v3: buildings-downtown (finanskvarterets hus) och bridge (floden, Stora bron, Järnbron).
const MODS = {};
await Promise.all(['buildings-shops', 'buildings-work', 'buildings-south', 'buildings-suburb', 'buildings-leksaker', 'buildings-downtown', 'buildings-linne', 'marknad', 'pir', 'ground', 'props', 'traffic', 'life', 'weather', 'walk', 'fallback-v2', 'bridge'].map((n) =>
  import(`../city/${n}.js`).then((m) => { MODS[n] = m; }).catch((e) => console.error(`stadsmodulen ${n} kunde inte laddas:`, e))));

let VW = CITY.VIEW_W, VH = CITY.VIEW_H; // mobilfyllning: vyn följer skärmen, klampad till världen
// (telefonen: vyn kan vara lägre än 216 – staden visas närmare, se PHONE_VIEW_H i main.js)
const syncView = (A) => { VW = Math.max(160, Math.min(A.W || CITY.VIEW_W, CITY.W)); VH = Math.max(120, Math.min(A.H || CITY.VIEW_H, CITY.H)); };
const phoneView = () => typeof document !== 'undefined' && document.documentElement.classList.contains('desk-mobil');
export const BUS_FARE = 10, BUS_MINUTES = 15;

// Spelare i staden som inte syns i bild får en pil med namnet i skärmkanten, så att man
// alltid vet att de är här och åt vilket håll. Klick på pilen = gå dit.
let markers = [];
const MARK_INK = '#17151a';
function drawFolkMarkers(ctx, cx, cy) {
  markers = [];
  for (const f of worldFolksHere(window.SF)) {
    const sx = Math.round(f.x - cx), sy = Math.round(f.y - 14 - cy);
    if (sx >= -4 && sx < VW + 4 && sy >= -30 && sy < VH + 10) continue; // syns redan
    const mx = Math.max(30, Math.min(VW - 30, sx)), my = Math.max(24, Math.min(VH - 14, sy));
    const dx = sx < 0 ? -1 : sx >= VW ? 1 : 0, dy = sy < 0 ? -1 : sy >= VH ? 1 : 0;
    // pilen: en liten triangel i spelarens färg som pekar mot dem
    const ax = dx < 0 ? 4 : dx > 0 ? VW - 5 : mx, ay = dy < 0 ? 14 : dy > 0 ? VH - 5 : my;
    for (let i = 0; i < 5; i++) {
      const len = 9 - i * 2;
      ctx.fillStyle = MARK_INK;
      if (dx) ctx.fillRect(ax - dx * i - (dx < 0 ? 0 : 1), ay - (len >> 1) - 1, 1, len + 2);
      else ctx.fillRect(ax - (len >> 1) - 1, ay - dy * i - (dy < 0 ? 0 : 1), len + 2, 1);
      ctx.fillStyle = f.av.color || '#f4c542';
      if (dx) ctx.fillRect(ax - dx * i - (dx < 0 ? 0 : 1), ay - (len >> 1), 1, len);
      else ctx.fillRect(ax - (len >> 1), ay - dy * i - (dy < 0 ? 0 : 1), len, 1);
    }
    const tx = dx < 0 ? 34 : dx > 0 ? VW - 34 : mx, ty = dy < 0 ? 20 : dy > 0 ? VH - 22 : my - 5;
    nameTag(ctx, tx, ty, f.av);
    markers.push({ x: Math.min(ax, tx) - 30, y: Math.min(ay, ty) - 6, w: Math.abs(tx - ax) + 60, h: Math.abs(ty - ay) + 20, fx: f.x, fy: f.y });
  }
}

// Delad miljö som modulerna läser (muteras varje bildruta av scenen). Se docs/STADEN.md.
// obstacles = alla hinder för gång (kartans hinder + rekvisita + trafikljus + liv + platshållare).
export const env = {
  t: 0, dt: 0, hour: 12, day: 1, eventId: null, night: false, dark: 0, rain: false,
  weather: null, forceWeather: null,                       // sätts av weather.js (forceWeather: förhandsvisning/test)
  player: { x: 0, y: 0 }, people: [], obstacles: [],
  district: DISTRICTS[0], view: { x: 0, y: 0, w: VW, h: VH }, // var spelaren är och vad kameran ser
  play,
};

// ---------- simuleringen lever kvar mellan besöken i staden ----------
let SIM = null;
const NONE = { items: () => [], obstacles: [], update() {}, glow() {}, positions: () => [], pedGreen: () => true };
const NO_WEATHER = { update() {}, drawBack() {}, drawFront() {}, glow() {} };
function sim() {
  if (SIM) return SIM;
  const safe = (name, make, fallback) => { try { return make() || fallback; } catch (e) { console.error(`stadsmodulen ${name} startade inte:`, e); return fallback; } };
  const props = safe('props', () => MODS.props?.createProps(env), NONE);
  const traffic = safe('traffic', () => MODS.traffic?.createTraffic(env), NONE);
  // platshållarna tar bara de delar som den riktiga modulen inte har förklarat sig klar med (export const V2 = true)
  const fallback = safe('fallback-v2', () => MODS['fallback-v2']?.createFallback(env, {
    ground: !MODS.ground?.V2, props: !MODS.props?.V2, traffic: !MODS.traffic?.V2,
  }), NONE);
  const bridge = safe('bridge', () => MODS.bridge?.createBridge?.(env), NONE);   // floden och broarna (v3)
  const market = safe('marknad', () => MODS.marknad?.createMarket?.(env), NONE);  // marknaden på Marknadstorget (v4, Linnéstaden)
  const pier = safe('pir', () => MODS.pir?.createPier?.(env), NONE);                // piren, båtarna, fiskarna och bryggan vid Sjöboden
  const allSeats = props.seats?.();                                                  // bryggans stolar och bänkar: samma lista som parkbänkarna
  if (Array.isArray(allSeats) && pier.seats?.length) allSeats.push(...pier.seats);
  env.obstacles = [...MAP_OBSTACLES, ...artObstacles(), ...(props.obstacles || []), ...(traffic.obstacles || []), ...(fallback.obstacles || []), ...(bridge.obstacles || []), ...(market.obstacles || []), ...(pier.obstacles || [])];
  const life = safe('life', () => MODS.life?.createLife(env, traffic, props), NONE); // props ger livet riktiga sittplatser (props.seats())
  const weather = safe('weather', () => MODS.weather?.createWeather(env), NO_WEATHER);
  SIM = { props, traffic, life, fallback, weather, bridge, market, pier };
  return SIM;
}

// ---------- bildcache (mark + hus, per dag/natt/snö) ----------
const CACHE = {};
// husens egna hinder (t.ex. Burgarbarens menypelare på trottoaren)
function artObstacles() {
  const art = ART(), out = [];
  for (const b of ALL_BUILDINGS) { const o = art[b.kind]?.obstacles?.(b); if (o) out.push(...o); }
  return out;
}
const ART = () => ({
  ...(MODS['buildings-shops']?.BUILDING_ART || {}), ...(MODS['buildings-work']?.BUILDING_ART || {}),
  ...(MODS['buildings-south']?.BUILDING_ART || {}), ...(MODS['buildings-suburb']?.BUILDING_ART || {}), ...(MODS['buildings-leksaker']?.BUILDING_ART || {}),
  ...(MODS['buildings-downtown']?.BUILDING_ART || {}), ...(MODS['buildings-linne']?.BUILDING_ART || {}),
});
// (v4) världen börjar i X0 (Linnéstaden väster om centrum): markduken är W − X0 bred, duk-x = världs-x − X0
const WX0 = CITY.X0 || 0;
function groundImg(night) {
  const k = 'ground:' + night;
  if (!CACHE[k]) {
    let c;
    try { c = MODS.ground.paintGround(night); } catch (e) {
      console.error('marken kunde inte målas:', e);
      c = document.createElement('canvas'); c.width = CITY.W - WX0; c.height = CITY.H;
      const x = c.getContext('2d'); x.fillStyle = '#6a6258'; x.fillRect(0, 0, CITY.W - WX0, CITY.H);
    }
    // v2-områdena (Södergatan, kanalen, Infarten, förorten) tills ground.js målar dem själv
    if (!MODS.ground?.V2) { try { SIM?.fallback?.paintGround?.(c, night); } catch (e) { console.error('platshållarmarken kunde inte målas:', e); } }
    // floden och broarnas däck (v3): bridge.js målar flodrummet, läggs ovanpå marken vid RIVER.x0
    try { const r = MODS.bridge?.paintRiver?.(night); if (r) c.getContext('2d').drawImage(r, RIVER.x0 - WX0, 0); } catch (e) { console.error('floden kunde inte målas:', e); }
    CACHE[k] = c;
  }
  return CACHE[k];
}
// Förmålning: marken (4000 × 820, ~1 s på en dator, flera på en telefon) målas i förväg ett steg i
// taget när webbläsaren har tid över – sedan flodbilden och dagens/nattens färdiga markbild – så att
// första gången ut i staden inte fryser. Går man ut innan den är klar gör paintGround resten direkt.
{
  const ric = globalThis.requestIdleCallback || ((f) => setTimeout(() => f({ timeRemaining: () => 10 }), 50));
  let stage = 0;
  const tick = (dl) => {
    try {
      const budget = Math.max(6, Math.min(40, dl?.timeRemaining?.() ?? 10));
      if (stage === 0) { if (!MODS.ground?.prewarmGround || MODS.ground.prewarmGround(budget)) stage = 1; }
      else {
        const night = isNightHour((globalThis.SF?.game?.min ?? 720) / 60);
        if (!CACHE['ground:' + night]) groundImg(night);
        stage = 2;
      }
    } catch (e) { console.error('förmålningen av staden:', e); stage = 2; }
    if (stage < 2) ric(tick);
  };
  ric(tick);
}
function buildingImg(b, night, snow) {
  const k = 'b:' + b.id + ':' + night + ':' + snow;
  if (!CACHE[k]) {
    try {
      const d = districtByName(b.district);
      CACHE[k] = ART()[b.kind].paint(b, night, { worn: d?.worn ?? 0, snow, season: env.weather?.season });
    } catch (e) {
      console.error(`huset ${b.id} kunde inte målas:`, e);
      const box = artBox(b), c = document.createElement('canvas'); c.width = box.w; c.height = box.h;
      const x = c.getContext('2d'); x.fillStyle = '#777'; x.fillRect(8, box.h - 4 - b.h, b.w, b.h);
      x.fillStyle = '#444'; x.fillRect(8, box.h - 4 - b.h - 12, b.w, 12);
      CACHE[k] = c;
    }
  }
  return CACHE[k];
}

// Mörker över dygnet: 0 = dag, ~0.5 = natt, med skymning och gryning.
function darkness(hour) {
  if (hour >= 7.5 && hour < 17.5) return 0;
  if (hour >= 17.5 && hour < 20.5) return (hour - 17.5) / 3 * 0.5;
  if (hour >= 5.5 && hour < 7.5) return (7.5 - hour) / 2 * 0.5;
  return 0.5;
}

// Visa ett fel bara en gång per källa, men låt aldrig en modul stoppa loopen.
const warned = new Set();
function guard(name, fn) {
  try { fn(); } catch (e) { if (!warned.has(name)) { warned.add(name); console.error(`ritfel i ${name}:`, e); } }
}

// Var man klickar för att gå in: fasaden (från taklisten ner till marken) eller ytan framför dörren.
function facadeHit(b, x, y) {
  const base = baseOf(b), top = b.row === 'f' ? base - b.d - b.h - 8 : base - b.h - 16;
  const onFacade = x >= b.x && x < b.x + b.w && y >= top && y < base;
  const onDoorFront = x >= b.door.x0 - 8 && x < b.door.x1 + 8 && y >= base && y < base + 16;
  return onFacade || onDoorFront;
}
const busStopHit = (x, y) => BUS_STOPS.find((s) => x >= s.x - 30 && x < s.x + 30 && y >= s.y - 42 && y < s.y + 8) || null;

// Dörrar som leder in i en egen scen: enter i map.js → scenens namn i main.js (samma namn).
// main.js laddar de här scenerna tåligt (A.hasScene) – saknas en visar dörren husets soon-text
// i stället för att krascha. Nytt ställe: lägg namnet här, i map.js ENTER_RE och i main.js DOOR_SCENES.
const SCENE_DOORS = {
  bank: 'bank', elektronik: 'elektronik', frisor: 'frisor', skor: 'skor', accessoarer: 'accessoarer', // downtown
  universitet: 'universitet',                                                                        // Pixelhögskolan (PIXEL TOWER)
  bio: 'bio', kebab: 'kebab', pantbank: 'pantbank',                                                  // Söder och förorten
  fordon: 'fordon',                                                                                  // GARAGET i förorten (cyklar och mopeder)
  maskerad: 'maskerad',                                                                              // MASKERADBUTIKEN i förorten (Halloween)
};
// Kameran på STORA BRON: på däcket lyfts kameran så att tornens spetsbågar, krönen och kablarnas
// båge kommer med (mjukt in och ut vid brofästena) – figuren hålls ändå minst BRIDGE_FOOT px ovanför
// den synliga rutans nederkant.
const BRIDGE_TOP = 18, BRIDGE_FOOT = 26, BRIDGE_RAMP = 110;
function bridgeLift(x, y) {
  if (y > CITY.SIDEWALK_S[1] + 8 || y < CITY.BASE - 30) return 0;
  const inW = (x - (RIVER.x0 - 30)) / BRIDGE_RAMP, inE = ((RIVER.x1 + 30) - x) / BRIDGE_RAMP;
  return Math.max(0, Math.min(1, inW, inE));
}

let lastDistrictId = null; // områdesskylten visas bara när man kommer till ett nytt område
// vägskylten vid stadsgränsen: grön vägvisare LANDET med en pil och en ko
function drawLandetSkylt(ctx, x, y) {
  ctx.fillStyle = 'rgba(20,12,30,.25)'; ctx.fillRect(x - 3, y - 1, 8, 2);
  ctx.fillStyle = '#5a5e66'; ctx.fillRect(x, y - 26, 2, 26);
  ctx.fillStyle = '#1e1a24'; ctx.fillRect(x - 17, y - 38, 36, 14);
  ctx.fillStyle = '#2a7a3a'; ctx.fillRect(x - 16, y - 37, 31, 12); ctx.fillRect(x + 15, y - 35, 2, 8); ctx.fillRect(x + 17, y - 33, 1, 4);
  ctx.fillStyle = '#f4f1ea'; ctx.fillRect(x - 16, y - 37, 31, 1);
  ctxText(ctx, SMALL, 'LANDET', x - 13, y - 34, '#f4f1ea');
  ctx.fillStyle = '#f4f1ea'; ctx.fillRect(x - 14, y - 28, 6, 2); ctx.fillStyle = '#1e1a1c'; ctx.fillRect(x - 12, y - 28, 2, 1);
}

export function makeCity(A) {
  const g = A.game;
  const S = sim();
  // Ut genom den egna ytterdörren: man kliver alltid ut ur sitt eget hus (husvagnen,
  // höghuset …) – även första gången och efter en omladdning, då ingen stadsposition finns
  // sparad (förr hamnade man då vid första huset i centrum). Menyns bakgrundsstad rörs inte.
  const homeB = !A.attract && ALL_BUILDINGS.find((b) => (b.homes || []).includes(g.home));
  if (homeB && (A.leftHome || !A.cityPos)) { const dc = doorCenter(homeB); A.cityPos = [dc.x, dc.y + 4]; }
  A.leftHome = false;
  const start = A.cityPos || [doorCenter(BUILDINGS[0]).x, doorCenter(BUILDINGS[0]).y];
  // (v4) längst ner: vattnet (CANAL_WATER) är hinder – då går det att gå ut på piren i Linnéstaden
  const bounds = { X0: WX0, W: CITY.W, H: CITY.H, left: WX0 + 4, right: CITY.W - 4, top: CITY.BACK[0], bottom: CITY.H - 4, spawn: start };
  let walker;
  try { walker = MODS.walk.createCityWalker(bounds); } catch (e) { console.error('gångmotorn walk.js startade inte – använder den enkla:', e); walker = createWalker(bounds); }
  walker.speed = 110;
  // 🚲 fordonet man åker på (game.js FORDON, 🚲-knappen i HUD:en): fortare genom stan
  const GANG = 110;
  const fordon = () => (A.attract ? null : g.aker);
  const applyRide = () => { const F = fordon(); walker.speed = GANG * (F ? F.fart : 1); };
  applyRide();
  let rullar = false;
  env.obstacles = [...MAP_OBSTACLES, ...artObstacles(), ...(S.props.obstacles || []), ...(S.traffic.obstacles || []), ...(S.fallback.obstacles || []), ...(S.bridge.obstacles || []), ...(S.life.obstacles || []), ...(S.market?.obstacles || []), ...(S.pier?.obstacles || [])];
  // 🚚 foodtrucken (eget företag, js/core/foretag.js) står på sin plats och är ett hinder
  const truckPos = () => { const T = !A.attract && g.truck; return T ? GAME.truckPlatsOf(T.plats) : null; };
  const setObst = () => { const TP = truckPos(); walker.setObstacles(TP ? [...env.obstacles, [TP.x + TRUCK_RECT.x0, TP.y + TRUCK_RECT.y0, TP.x + TRUCK_RECT.x1, TP.y + TRUCK_RECT.y1]] : env.obstacles); };
  setObst();
  walker.snapFree();
  // personalens och kundens utseende (samma person hela tiden: slumpen sås med id:t)
  const seeded = (str) => { let h = 2166136261; for (const ch of String(str)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return () => { h = Math.imul(h ^ (h >>> 15), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); h ^= h >>> 16; return (h >>> 0) / 4294967296; }; };
  const looks = new Map();
  const lookOf = (id) => { if (!looks.has(id)) looks.set(id, makeLookRich(seeded(id))); return looks.get(id); };
  // första gången i staden: hur man tar sig in någonstans (Carl: "man förstår inte vad man ska göra")
  if (!A.attract) {
    let seen = false;
    try { seen = localStorage.getItem('snabbfilen_tips_hus') === '1'; localStorage.setItem('snabbfilen_tips_hus', '1'); } catch { /* ok */ }
    if (!seen) setTimeout(() => toast('👆 Tryck på ett hus – eller på husnamnet överst – så går du dit och in.', 'good'), 1200);
  }
  // husdjuren som är ute (js/pets/outdoors.js): följer figuren, promenaden räknas med spelklockan
  let pets = null;
  try { pets = createPetWalk(A); } catch (e) { console.error('husdjuren i staden startade inte:', e); }

  const doorOpen = Object.fromEntries(ALL_BUILDINGS.map((b) => [b.id, 0]));
  const doorWasOpen = {};
  let t = 0, lockedCam = null;
  const cam = { x: 0, y: 0 };
  const attractCam = () => {
    const span = Math.max(1, CITY.W - VW), u = (t * 9) % (2 * span);
    return { x: Math.round(u < span ? u : 2 * span - u), y: Math.max(0, Math.min(CITY.H - VH, CITY.BASE - VH * 0.55)) };
  };
  // var figuren står i höjdled: 62 % ner i bilden – men när NÄRA-läget beskär överkanten
  // (mobilen) räknas det i den SYNLIGA rutan och längre ner (74 %), så att mer av husfasaderna
  // med skyltarna syns ovanför figuren
  // (telefonen: figuren mitt i bild – då finns det alltid yta under den att trycka på när man vill gå nedåt)
  const camAnchorY = () => { if (phoneView()) return VH * 0.5; const s = globalThis.SF?.view?.safe; if (!s || !(s.y0 > 0)) return VH * 0.62; const y1 = Math.min(VH, s.y1 || VH); return s.y0 + (y1 - s.y0) * 0.74; };
  const camY = () => {
    let y = walker.py - camAnchorY();
    const f = bridgeLift(walker.px, walker.py);
    if (f > 0) {
      // den synliga rutan (NÄRA-läget på mobilen beskär över- och nederkanten)
      const s = globalThis.SF?.view?.safe, y0 = s && s.y0 > 0 ? s.y0 : 0, y1 = s ? Math.min(VH, s.y1 || VH) : VH;
      const lifted = Math.min(y, Math.max(walker.py - y1 + BRIDGE_FOOT, BRIDGE_TOP - y0));
      y += (lifted - y) * f;
    }
    return Math.max(0, Math.min(CITY.H - VH, y));
  };
  const camTarget = () => lockedCam || (A.attract ? attractCam() : {
    x: Math.max(WX0, Math.min(CITY.W - VW, walker.px - VW / 2)),
    y: camY(),
  });
  Object.assign(cam, camTarget());

  // områdesskylten och busstoningen (ritas i skärmrymden)
  let banner = null;                       // { d, t }
  const fade = { a: 0, phase: 0, cb: null }; // 0 = av, 1 = tonar ner, 2 = tonar upp
  function checkDistrict(force) {
    const d = districtAt(walker.px, walker.py);
    env.district = d;
    if (d.id !== lastDistrictId) { if (!A.attract && (force || lastDistrictId !== null)) banner = { d, t: 0 }; lastDistrictId = d.id; }
  }
  checkDistrict(false);

  function updateEnv(dt) {
    env.t += dt; env.dt = dt;
    env.hour = g.min / 60;
    env.day = g.day || 1;
    env.eventId = g.event?.id || null;
    env.night = isNightHour(env.hour);
    env.dark = darkness(env.hour);
    env.rain = g.eventIs('regn');          // weather.js skriver över med dagens väder
    guard('weather.update', () => S.weather.update?.(dt));
    env.player = { x: walker.px, y: walker.py };
    const folks = worldFolksHere(A).map((f) => ({ x: f.x, y: f.y }));
    let npcs = [];
    try { npcs = S.life.positions?.() || []; } catch { /* modulfel loggas vid ritning */ }
    env.people = [...(A.attract ? [] : [env.player]), ...folks, ...npcs];
    env.view = { x: Math.round(cam.x), y: Math.round(cam.y), w: VW, h: VH };
  }
  updateEnv(0);

  // ---------- gå in ----------
  // 🍦 Glasståndet i parken (förr kiosken): samma priser som på ståndets meny
  const GLASS_MENY = [
    { id: 'kula', icon: '🍨', namn: 'Kulglass, en kula', pris: 12, matt: 4, orka: 2 },
    { id: 'tva', icon: '🍦', namn: 'Två kulor i våffelstrut', pris: 20, matt: 7, orka: 3 },
    { id: 'mjuk', icon: '🍦', namn: 'Mjukglass med strössel', pris: 10, matt: 3, orka: 2 },
  ];
  function openGlass() {
    const rows = GLASS_MENY.map((m) => `<div class="prow shoprow">
        <span style="font-size:28px;text-align:center">${m.icon}</span>
        <span class="nm">${esc(m.namn)}<br><small class="sp">+${m.matt} mätthet · +${m.orka} ork</small></span>
        <button class="btn btn-small ${g.money >= m.pris ? 'btn-go' : ''}" data-glass="${m.id}" ${g.money >= m.pris ? '' : 'disabled'}>${m.pris} kr</button>
      </div>`).join('');
    const dlg = openModal('🍦 Glasståndet', `<p style="font-size:var(--f2);margin-top:0">Vilken smak? Slå dig sedan ner vid borden och njut!<br>💰 <b>${g.money} kr</b></p><div class="plist">${rows}</div>`,
      [{ label: 'Inte nu', onClick: closeModal }]);
    dlg.querySelectorAll('[data-glass]').forEach((btn) => (btn.onclick = () => {
      const m = GLASS_MENY.find((x) => x.id === btn.dataset.glass);
      if (!m || g.money < m.pris) { play('fel'); toast('💸 Du har inte råd med den.', 'bad'); return; }
      g.money -= m.pris;
      g.hunger = Math.min(100, g.hunger + m.matt);
      g.energy = Math.min(100, g.energy + m.orka);
      g.passTime(10);
      g.save();
      closeModal();
      play('coin');
      toast(`${m.icon} Mums! ${m.namn} – slå dig ner vid borden.`, 'good');
    }));
  }
  const homeHere = (b) => (b.homes || []).includes(g.home);
  // finns scenen/jobbet i main.js? (utan A.hasScene/A.jobReady – en äldre main.js – gäller det gamla beteendet)
  const sceneReady = (n) => (typeof A.hasScene === 'function' ? A.hasScene(n) : false);
  const jobReady = (id) => !!JOBS[id] && (typeof A.jobReady === 'function' ? A.jobReady(id) : true);
  const soonOf = (b) => { let besked = null; try { besked = ART()[b.kind]?.besked?.(env, g.min / 60) || null; } catch { besked = null; } return besked ? `${b.icon || '🚪'} ${besked}` : b.soon ? `${b.icon || '🚪'} ${b.soon}` : `☕ ${b.sign} öppnar snart – håll utkik!`; };
  function enter(b) {
    // huset kan ha ett eget besked (paviljongen: spelar musikkåren just nu?), annars soon-texten
    if (!b.enter) { toast(soonOf(b)); return; }
    // en dörr till en egen scen som inte har laddats (modulen saknas eller kraschade) → soon-texten
    if (SCENE_DOORS[b.enter] && !sceneReady(SCENE_DOORS[b.enter])) { toast(soonOf(b)); return; }
    const hour = g.min / 60;
    if (b.open && (hour < b.open[0] || hour >= b.open[1])) {
      if (hour < b.open[0]) {
        openModal(`🔒 ${esc(b.sign)}`, `<p style="font-size:var(--f2);margin-top:0">Stängt just nu – öppnar ${clock(b.open[0] * 60)}.</p>`, [
          { label: 'Gå därifrån', onClick: closeModal },
          { label: '⏩ Vänta tills det öppnar', cls: 'btn-go', onClick: () => { closeModal(); g.waitUntil(b.open[0] * 60); enter(b); } },
        ]);
      } else toast(`🔒 ${b.sign} har stängt för i dag – öppnar ${clock(b.open[0] * 60)} i morgon.`, 'bad');
      return;
    }
    // nya jobb och bostäder som inte är inkopplade i game.js ännu kostar ingen tid
    const [kind, id] = b.enter.split(':');
    if (kind === 'jobb' && !jobReady(id)) {
      // jobbet finns inte (eller saknar jobbscen i main.js ENGINES) – "anställer snart", med kravet om det finns ett
      const w = WORKPLACES.find((x) => x.id === id) || JOBS[id], need = JOBS[id]?.kraver, course = need && GAME.COURSES?.[need];
      toast(`${w?.icon || b.icon || '💼'} ${b.sign} anställer snart!${w ? ` "${w.verb}" – ${w.wage} kr per rätt.` : ''}${need ? ` Kräver examen i ${course?.name || need} från Pixelhögskolan.` : ''}`);
      return;
    }
    if (kind === 'bostad' && id && !homeHere(b) && !HOMES.some((h) => h.id === id)) {
      const h = NEW_HOMES.find((x) => x.id === id);
      toast(`${b.icon || '🔑'} ${b.sign}: ${h ? `${h.name} hyrs snart ut – ${h.rent} kr/vecka. ` : ''}Fråga på Bostadsbyrån!`);
      return;
    }
    // ett bostadshus man inte bor i: skylten (flytta gör man hos mäklaren på Bostadsbyrån)
    if ((b.enter === 'hem' || kind === 'bostad' && id) && !homeHere(b)) {
      play('click');
      openHouseSign(A, b, { toAgent: () => { const ag = ALL_BUILDINGS.find((x) => x.enter === 'bostad'); if (!ag) return; const dc = doorCenter(ag); walker.walkTo(dc.x, dc.y, () => enter(ag)); } });
      return;
    }
    g.passTime(g.eventIs('regn') ? 10 : 5);
    g.save();
    if (g.collapsed) return;
    if (A.guide?.id === b.id) A.guide = null; // 🧭 framme – pilen har gjort sitt
    play('door');
    const dc = doorCenter(b);
    A.cityPos = [dc.x, dc.y + 4];
    if (b.enter === 'hem' || kind === 'bostad' && id) {
      if (homeHere(b)) { A.roomSub = 0; A.go('room'); }
      else A.openHousing();
    } else if (b.enter === 'bostad') A.go('bostad'); // mäklarkontoret man går runt i (js/scenes/shop-bostad.js)
    else if (b.enter === 'mat') A.openFoodShop();
    else if (b.enter === 'klader') A.go('klader');
    else if (b.enter === 'mobler') A.go('mobler');
    else if (b.enter === 'kafe') {
      // kaféet är både fik och arbetsplats
      openModal('☕ Kaféet', '<p style="font-size:var(--f2);margin-top:0">Vill du fika, eller jobba ett pass bakom disken som barista?</p>', [
        { label: '☕ Fika', cls: 'btn-go', onClick: () => { closeModal(); A.go('kafe'); } },
        { label: '💼 Jobba ett pass', onClick: () => { closeModal(); A.startJob('kafe'); } },
      ]);
    } else if (b.enter === 'djur') A.go('djur');
    else if (b.enter === 'burgare') A.go('burgarbar'); // in i dinern – jobba gör man vid disken därinne
    else if (b.enter === 'glass') openGlass(); // glasståndet i parken
    else if (b.enter === 'fiskkrog') MODS.pir?.openKrog?.(A); // (v4) Sjöboden på piren i Linnéstaden
    else if (b.enter === 'leksaker') A.go('leksaker'); // Leksakslådan (js/scenes/shop-leksaker.js)
    else if (b.enter === 'narbutik') A.go('narbutik'); // förortens närbutik 24/7 (js/scenes/shop-narbutik.js)
    else if (SCENE_DOORS[b.enter]) A.go(SCENE_DOORS[b.enter]); // downtowns butiker, Pixelhögskolan, bion, kebaben, pantbanken
    else if (kind === 'jobb') A.startJob(id);
    else if (b.enter === 'flyg') A.go('terminal'); // flygterminalen: bagagechefen och incheckningen erbjuder passen
    else A.startJob(b.enter);
  }

  // ---------- bussen ----------
  function rideBus(to, { free = false } = {}) {
    if (!to) return false;
    if (!free && g.money < BUS_FARE) { toast(`🚌 Bussen kostar ${BUS_FARE} kr – du har inte råd.`, 'bad'); return false; }
    walker.stop();
    fade.phase = 1; fade.cb = () => {
      if (!free) g.money -= BUS_FARE;
      g.passTime(BUS_MINUTES);
      g.save();
      walker.px = to.wait.x; walker.py = to.wait.y; walker.dir = 'down'; walker.snapFree();
      A.cityPos = [walker.px, walker.py];
      Object.assign(cam, camTarget());
      checkDistrict(true);
      toast(to.broken ? `🚌 ${to.name}: hållplatsen är sönder, men du kom fram. ${BUS_FARE} kr och en kvart senare.` : `🚌 Framme vid ${to.name} – ${BUS_FARE} kr, ${BUS_MINUTES} minuter.`);
    };
    play('door');
    return true;
  }
  function openBusDialog(from) {
    const others = BUS_STOPS.filter((s) => s.id !== from.id);
    const intro = from.broken
      ? 'Kuren är krossad, bänken saknas och tidtabellen är översprejad. Men bussen kommer ändå – antagligen.'
      : `Vart vill du åka? Bussen kostar <b>${BUS_FARE} kr</b> och tar en kvart.`;
    const body = `<p style="font-size:var(--f2);margin-top:0">${intro}</p><div class="plist">${others.map((s) => `
      <div class="prow shoprow"><span style="font-size:28px;text-align:center">${s.broken ? '🚏' : '🚌'}</span>
        <span class="nm">${esc(s.name)}<br><small class="sp">${esc(s.district)}${s.broken ? ' · hållplatsen är trasig' : ''}</small></span>
        <button class="btn btn-small ${g.money >= BUS_FARE ? 'btn-go' : ''}" data-bus="${s.id}" ${g.money >= BUS_FARE ? '' : 'disabled'}>Åk hit</button></div>`).join('')}</div>`;
    const dlg = openModal(`🚌 ${esc(from.name)}${from.broken ? ' (trasig hållplats)' : ''}`, body, [{ label: 'Stanna kvar', onClick: closeModal }]);
    dlg.querySelectorAll('[data-bus]').forEach((el) => { el.onclick = () => { closeModal(); rideBus(busStopById(el.dataset.bus)); }; });
  }

  // ---------- bussen på riktigt (receptet i traffic.js filhuvud) ----------
  // Klick på en buss som står vid en hållplats → håll den, gå till framdörren och välj resmål.
  // Under resan sitter figuren i bussfönstret (trafiken ritar den), kameran följer bussen
  // och vid målet kliver man av med alight(). Klick under resan hoppar fram (skipRide).
  let riding = false;   // spelaren sitter i bussen (traffic.ride() ≠ null)
  let sitting = null;
  // en annan spelare sitter redan på platsen (world.js si) – sätt dig inte i knät på hen
  const remoteSat = (s) => worldFolksHere(A).some((f) => f.sit && !f.walking && Math.abs(f.x - s.x) < 4 && Math.abs(f.y - s.y) < 4);   // spelaren sitter på en bänk: { seat } från props.seats()
  function boardNow(from, toId) {
    if (g.money < BUS_FARE) { toast(`🚌 Bussen kostar ${BUS_FARE} kr – du har inte råd.`, 'bad'); S.traffic.release?.(from.id); return; }
    const ok = S.traffic.board?.(from.id, toId, { look: A.avatar.look, dir: 'down' });
    if (!ok) { rideBus(busStopById(toId)); return; } // bussen hann gå – skyltdialogens resa tar en dit (den betalar själv)
    g.money -= BUS_FARE;
    g.passTime(BUS_MINUTES);
    g.save();
    walker.stop();
    play('door');
  }
  function openBoardDialog(from) {
    const bi = S.traffic.busAt?.(from.id);
    if (!bi) { openBusDialog(from); return; } // bussen hann gå medan man gick fram – vanliga dialogen
    S.traffic.hold?.(from.id);
    const dests = (S.traffic.destinations?.(from.id) || []).filter((s) => s.id !== from.id);
    const body = `<p style="font-size:var(--f2);margin-top:0">Dörrarna står öppna${from.broken ? ' – kuren är sönder men bussen går' : ''}. Resan kostar <b>${BUS_FARE} kr</b>.</p><div class="plist">${dests.map((s) => `
      <div class="prow shoprow"><span style="font-size:28px;text-align:center">${s.broken ? '🚏' : '🚌'}</span>
        <span class="nm">${esc(s.name)}<br><small class="sp">${esc(s.district)} · ${s.stops} hållplats${s.stops === 1 ? '' : 'er'} bort</small></span>
        <button class="btn btn-small ${g.money >= BUS_FARE ? 'btn-go' : ''}" data-bus="${s.id}" ${g.money >= BUS_FARE ? '' : 'disabled'}>Kliv på</button></div>`).join('')}</div>`;
    const dlg = openModal(`🚌 Linje 4 vid ${esc(from.name)}`, body, [{ label: 'Kliv inte på', onClick: () => { S.traffic.release?.(from.id); closeModal(); } }]);
    dlg.querySelectorAll('[data-bus]').forEach((el) => { el.onclick = () => { closeModal(); boardNow(from, el.dataset.bus); }; });
  }
  // Kliv av bussen: ställ figuren vid dörren och väck kameran/området.
  function finishRide() {
    const p = S.traffic.alight?.();
    riding = false;
    if (!p) { walker.snapFree(); return; }
    walker.px = p.x; walker.py = p.y; walker.dir = 'down'; walker.stop(); walker.snapFree();
    A.cityPos = [walker.px, walker.py];
    Object.assign(cam, camTarget());
    checkDistrict(true);
    toast(p.stop?.broken ? `🚌 ${p.stop.name}: hållplatsen är sönder, men du kom fram.` : `🚌 Framme vid ${p.stop?.name || 'hållplatsen'}.`);
  }
  // Res dig från bänken (tillbaka till gångpunkten framför/bakom sitsen).
  function standUp() {
    if (!sitting) return;
    const s = sitting.seat;
    sitting = null;
    walker.px = s.walk.x; walker.py = s.walk.y; walker.stop(); walker.snapFree();
  }

  // ---------- ritning av hela världen (även för panorama) ----------
  function drawWorld(ctx, cx, cy, vw, vh) {
    const night = env.night, snow = (env.weather?.snowCover || 0) > 0.5 ? 1 : 0;
    const view = { x: cx, y: cy, w: vw, h: vh };
    ctx.drawImage(groundImg(night), cx - WX0, cy, vw, vh, cx, cy, vw, vh);
    guard('ground.groundLive', () => MODS.ground?.groundLive?.(ctx, env, view));
    guard('bridge.riverLive', () => MODS.bridge?.riverLive?.(ctx, env, view)); // vattnet i floden (före vädret: isen lägger sig ovanpå)
    guard('weather.drawBack', () => S.weather.drawBack?.(ctx, view));
    guard('ground.groundOver', () => MODS.ground?.groundOver?.(ctx, env, view)); // fotspår m.m. skarpt OVANPÅ snötäcket

    const items = [];
    const art = ART();
    const stOf = (b) => ({ t: env.t, night, hour: env.hour, doorOpen: doorOpen[b.id], env, worn: districtByName(b.district)?.worn ?? 0 });
    for (const b of ALL_BUILDINGS) {
      if (b.x + b.w + 40 < cx || b.x - 40 > cx + vw) continue;
      const base = baseOf(b), box = artBox(b);
      if (Math.max(base, b.frontY ?? base) + 4 < cy || box.y > cy + vh) continue; // (macken når ner till frontY)
      items.push({ y: base, draw: () => {
        const img = buildingImg(b, night, snow), p = artPos(b, img);
        ctx.drawImage(img, p.x, p.y);
        guard(`${b.kind}.live`, () => art[b.kind]?.live?.(ctx, b, stOf(b)));
      } });
      const a = art[b.kind];
      if (a?.items) guard(`${b.kind}.items`, () => { for (const it of a.items(b, stOf(b)) || []) items.push(it); });
      if (a?.front && b.frontY !== undefined) items.push({ y: b.frontY, draw: () => guard(`${b.kind}.front`, () => a.front(ctx, b, stOf(b))) });
    }
    const add = (name, list) => {
      let arr = [];
      guard(name + '.items', () => { arr = list() || []; });
      for (const it of arr) {
        if (it.x !== undefined && (it.x < cx - 140 || it.x > cx + vw + 140)) continue;
        if (it.y < 1e5 && (it.y < cy - 6 || it.y > cy + vh + 130)) continue; // fotlinjen långt utanför bild (y ≥ 1e5 = "alltid överst")
        items.push(it);
      }
    };
    add('fallback', () => S.fallback.items());
    add('bridge', () => S.bridge.items());
    add('props', () => S.props.items());
    add('traffic', () => S.traffic.items());
    add('life', () => S.life.items());
    add('marknad', () => S.market.items());
    add('pir', () => S.pier.items());
    for (const d of folkDrawables(A, t)) items.push({ y: d.fy, draw: () => d.draw(ctx) });
    // 🌾 vägskylten LANDET → vid stadsgränsen (södra trottoaren längst österut)
    if (cx + vw > CITY.W - 80) items.push({ y: CITY.SIDEWALK_S[1] - 4, draw: () => drawLandetSkylt(ctx, CITY.W - 22, CITY.SIDEWALK_S[1] - 4) });
    const TP = truckPos();
    if (TP && TP.x > cx - 80 && TP.x < cx + vw + 80) {
      const T = g.truck, open = truckOppen(g);
      items.push({ y: TP.y, draw: () => drawTruck(ctx, TP.x, TP.y, { open, markis: T.uppg.includes('markis'), namn: truckNamn(A), meny: g.truckMeny().map((m) => m.id), staff: T.personal.map((x) => lookOf(x.id)), t, night: env.dark > 0.25 }) });
      // en kund vid luckan när den är öppen (byts då och då)
      if (open) { const k = Math.floor(t / 14); items.push({ y: TP.y + 10, draw: () => drawPerson(ctx, TP.x - 10, TP.y + 10, lookOf(`kund${k}`), 'up', Math.sin(t * 2) > 0.9 ? 4 : 0) }); }
    }
    if (!A.attract) {
      if (riding) { /* figuren sitter i bussfönstret – trafiken ritar den (ride.look) */ }
      else if (sitting) {
        const s = sitting.seat;
        items.push({ y: s.y + 0.01, draw: () => {
          drawPerson(ctx, s.x, s.y, A.avatar.look, s.dir || 'down', 5);
          if (worldFolksHere(A).length) nameTag(ctx, s.x, s.y - 46, A.avatar);
        } });
      } else {
        const F = fordon();
        const me = selfDrawable(A, walker, t, { folksHere: worldFolksHere(A).length, ride: F ? { id: F.id, c: F.c } : null });
        items.push({ y: me.fy + 0.01, draw: () => me.draw(ctx) });
      }
      if (pets && !riding) guard('husdjuren', () => { for (const d of pets.drawables()) items.push({ y: d.fy, draw: () => d.draw(ctx) }); });
    }
    items.sort((a, b) => a.y - b.y);
    for (const it of items) guard('item', () => it.draw(ctx));

    guard('weather.drawFront', () => S.weather.drawFront?.(ctx, view));

    // ljussättningen: mörker först, sedan allt som lyser
    if (env.dark > 0) {
      ctx.fillStyle = `rgba(14,16,44,${env.dark})`;
      ctx.fillRect(cx, cy, vw, vh);
      for (const b of ALL_BUILDINGS) {
        if (b.x + b.w + 40 < cx || b.x - 40 > cx + vw) continue;
        const base = baseOf(b);
        if (Math.max(base, b.frontY ?? base) + 4 < cy || artBox(b).y > cy + vh) continue;
        guard(`${b.kind}.glow`, () => { ctx.save(); art[b.kind]?.glow?.(ctx, b, stOf(b)); ctx.restore(); });
      }
      for (const [name, m] of [['fallback', S.fallback], ['bridge', S.bridge], ['props', S.props], ['traffic', S.traffic], ['life', S.life], ['marknad', S.market], ['pir', S.pier]]) guard(name + '.glow', () => { ctx.save(); m.glow?.(ctx, view); ctx.restore(); });
      guard('weather.glow', () => { ctx.save(); S.weather.glow?.(ctx, view); ctx.restore(); });
    }
  }

  // ---------- skärmlagret: husnamn, områdesskylt, väder, busstoning ----------
  // den SYNLIGA rutan i vyns spelpixlar (fyll/NÄRA-läget beskär kanterna – main.js v.safe)
  const safeBox = () => { const s = globalThis.SF?.view?.safe; return s ? { x0: s.x0 | 0, y0: s.y0 | 0, x1: Math.min(VW, s.x1 | 0 || VW), y1: Math.min(VH, s.y1 | 0 || VH) } : { x0: 0, y0: 0, x1: VW, y1: VH }; };
  // HUSNAMN: hus vars övre fasad (där skylten sitter) ligger ovanför den synliga rutan får sitt
  // namn i överkanten, rakt ovanför dörren, med en liten pil ner. Klickbara (se down).
  let signChips = [];
  function drawSignChips(ctx, cx, cy) {
    signChips = [];
    if (A.attract || riding) return;
    const sb = safeBox(), visTop = cy + sb.y0, visBot = cy + sb.y1;
    const rows = [[], [], []];
    // väderbrickan i högra hörnet (drawOverlay: högerkant sb.x1 − 3, överkant sb.y0 + 3) – namnen håller sig
    // undan hela brickan ("SOL OCH MOLN 14°" är mycket bredare än förr; downtown har många skyltar tätt)
    let bw = 46, bh = 17;
    try { const s = env.weather && MODS.weather?.weatherBadgeSize?.(env.weather); if (s?.w) { bw = s.w; bh = s.h; } } catch { /* standardmåtten */ }
    const badgeX0 = sb.x1 - 3 - bw - 3, badgeY1 = sb.y0 + 3 + bh + 2;
    const cand = [];
    for (const b of ALL_BUILDINGS) {
      const label = String(b.sign || '').trim();
      if (!label || !(b.enter || b.soon)) continue;
      const dc = doorCenter(b), sx = Math.round(dc.x - cx);
      if (sx < sb.x0 + 4 || sx > sb.x1 - 4) continue;
      const top = b.row === 'f' ? b.base - (b.d || 0) - b.h : b.base - b.h;
      if (top > visBot) continue;                        // hela huset ligger nedanför bilden
      if (top + 14 >= visTop) continue;                  // fasaden (och skylten) syns redan
      cand.push({ b, label: label.toUpperCase(), sx, near: Math.abs(dc.x - walker.px) });
    }
    cand.sort((p, q) => p.near - q.near);                // närmast figuren först – de får plats först
    for (const c of cand) {
      const w = textW(SMALL, c.label) + 8, h = 11;
      let x = Math.round(c.sx - w / 2);
      x = Math.max(sb.x0 + 2, Math.min(x, sb.x1 - w - 2));
      const underBadge = x + w > badgeX0;
      for (let r = 0; r < 3; r++) {
        const y = sb.y0 + 3 + r * 14;
        if (underBadge && y < badgeY1) continue;         // väderbrickan i högra hörnet
        if (r === 2 && !underBadge) break;               // tredje raden bara för namnen som brickan knuffar ner
        if (rows[r].some((o) => x < o.x + o.w + 3 && x + w + 3 > o.x)) continue;
        rows[r].push({ x, w });
        signChips.push({ b: c.b, x, y, w, h, sx: c.sx, label: c.label });
        break;
      }
    }
    for (const c of signChips) {
      ctx.fillStyle = 'rgba(16,18,30,0.86)'; ctx.fillRect(c.x, c.y, c.w, c.h);
      ctx.fillStyle = '#e8b230'; ctx.fillRect(c.x, c.y, c.w, 1);
      ctx.fillStyle = '#000000'; ctx.fillRect(c.x, c.y + c.h, c.w, 1);
      ctxText(ctx, SMALL, c.label, c.x + 4, c.y + 3, '#f4f1ea');
      // pilen ner mot huset
      const px = Math.max(c.x + 2, Math.min(c.sx, c.x + c.w - 3));
      ctx.fillStyle = 'rgba(16,18,30,0.86)'; ctx.fillRect(px - 2, c.y + c.h, 5, 1); ctx.fillRect(px - 1, c.y + c.h + 1, 3, 1); ctx.fillRect(px, c.y + c.h + 2, 1, 1);
    }
  }
  function drawBanner(ctx) {
    if (!banner) return;
    const { d, t: bt } = banner, dur = 3.4;
    if (bt > dur) { banner = null; return; }
    const k = bt < 0.35 ? bt / 0.35 : bt > dur - 0.6 ? (dur - bt) / 0.6 : 1;
    const name = d.name, tag = d.tag || '';
    const sb = safeBox();
    const w = Math.max(textW(BIG, name, 2), textW(SMALL, tag)) + 24, h = tag ? 44 : 30;
    const x = Math.round((sb.x0 + sb.x1 - w) / 2), y = Math.round(sb.y0 + 22 - (1 - k) * 12);
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, k));
    ctx.fillStyle = 'rgba(16,18,30,0.82)'; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#ffd23f'; ctx.fillRect(x, y, w, 2); ctx.fillRect(x, y + h - 2, w, 2);
    ctxText(ctx, BIG, name, x + Math.round((w - textW(BIG, name, 2)) / 2) + 1, y + 8, '#000000', 2);
    ctxText(ctx, BIG, name, x + Math.round((w - textW(BIG, name, 2)) / 2), y + 7, '#f4f1ea', 2);
    if (tag) ctxText(ctx, SMALL, tag, x + Math.round((w - textW(SMALL, tag)) / 2), y + 30, '#a9b4c8');
    ctx.restore();
  }
  function drawOverlay(ctx) {
    drawBanner(ctx);
    if (!A.attract) { const sb = safeBox(); guard('weather.badge', () => MODS.weather?.drawWeatherBadge?.(ctx, sb.x1 - 3, sb.y0 + 3, env.weather)); }
    const a = Math.max(fade.a, riding ? S.traffic.ride?.()?.fade || 0 : 0); // busstoningen (långa resor) delar rutan med skyltresans toning
    if (a > 0) { ctx.fillStyle = `rgba(4,4,10,${a.toFixed(3)})`; ctx.fillRect(0, 0, VW, VH); }
  }

  // ---------- 🧭 vägvisaren (kartan: A.guideTo) ----------
  // En pil på marken framför figuren pekar längs gångvägen mot dörren (A*: walker.findPath,
  // räknas om två gånger i sekunden), en nål svävar över dörren och syns den inte står en skylt
  // i bildkanten. Nere till vänster en lapp: "TILL <STÄLLET> · 240 M ×" – tryck på lappen (eller
  // skylten) så går figuren dit själv, × tar bort pilen. Framme eller in genom dörren → borta.
  let guidePath = null, guideT = 0, guideRects = [];
  const guideB = () => (A.guide && !A.attract ? buildingById(A.guide.id) : null);
  function updGuide(dt) {
    const b = guideB();
    if (!b) { guidePath = null; return; }
    const dc = doorCenter(b);
    if (Math.hypot(walker.px - dc.x, walker.py - dc.y) < 30) {
      A.guide = null; guidePath = null;
      if (!taxi) { toast(`🧭 Framme vid ${b.icon || ''} ${b.sign || ''}!`, 'good'); play('ok'); }
      return;
    }
    if ((guideT -= dt) <= 0 || !guidePath) {
      guideT = 0.5;
      guidePath = typeof walker.findPath === 'function' ? walker.findPath(walker.px, walker.py, dc.x, dc.y) : [[dc.x, dc.y]];
    }
  }
  const walkToGuide = () => { const b = guideB(); if (!b) return; if (sitting) standUp(); const dc = doorCenter(b); walker.walkTo(dc.x, dc.y); };
  // pilen: en polygon rastrerad i 16 riktningar (samma pixelkorn som staden), guld med mörk kant
  const ARROWS = new Map();
  function arrowImg(ang) {
    const q = ((Math.round(ang / (Math.PI / 8)) % 16) + 16) % 16;
    if (ARROWS.has(q)) return ARROWS.get(q);
    const a = q * Math.PI / 8, N = 21, H = 10, ca = Math.cos(a), sa = Math.sin(a);
    const poly = [[-7, -2.3], [1.5, -2.3], [1.5, -6.6], [8.6, 0], [1.5, 6.6], [1.5, 2.3], [-7, 2.3]];
    const inside = (px, py) => { // punkten vriden tillbaka till pilens egen riktning (→)
      const lx = px * ca + py * sa, ly = -px * sa + py * ca;
      let inn = false;
      for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, yi] = poly[i], [xj, yj] = poly[j]; if ((yi > ly) !== (yj > ly) && lx < (xj - xi) * (ly - yi) / (yj - yi) + xi) inn = !inn; }
      return inn ? ly : null;
    };
    const m = [];
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) m.push(inside(x - H + 0.5, y - H + 0.5));
    const c = document.createElement('canvas'); c.width = N; c.height = N;
    const g2 = c.getContext('2d');
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const v = m[y * N + x];
      if (v !== null) { g2.fillStyle = v < -0.8 ? '#ffe680' : v < 1.2 ? '#ffd23f' : '#d99a18'; g2.fillRect(x, y, 1, 1); continue; }
      const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => { const X = x + dx, Y = y + dy; return X >= 0 && Y >= 0 && X < N && Y < N && m[Y * N + X] !== null; });
      if (nb) { g2.fillStyle = '#17151a'; g2.fillRect(x, y, 1, 1); }
    }
    ARROWS.set(q, c);
    return c;
  }
  // nålen över dörren
  const PIN = ['...###...', '..#rrr#..', '.#rrrrr#.', '#rrwwrrr#', '#rrwwrrr#', '#rrrrrrd#', '.#rrrrd#.', '..#rrd#..', '...#d#...', '....#....'];
  const PIN_C = { '#': '#17151a', r: '#e0402a', w: '#fff2c0', d: '#a02a1e' };
  function drawPin(ctx, x, y) {
    PIN.forEach((row, j) => { for (let i = 0; i < row.length; i++) { const c = PIN_C[row[i]]; if (c) { ctx.fillStyle = c; ctx.fillRect(x - 4 + i, y + j, 1, 1); } } });
  }
  // i världen: nålen och pilen (efter drawWorld – vägvisningen ligger ovanpå allt)
  function drawGuide(ctx) {
    const b = guideB();
    if (!b || riding || fade.phase) return;
    const dc = doorCenter(b), bob = Math.round(Math.sin(t * 4) * 2);
    ctx.fillStyle = 'rgba(20,12,28,0.35)'; ctx.fillRect(Math.round(dc.x) - 3, baseOf(b) + 1, 7, 2);
    drawPin(ctx, Math.round(dc.x), baseOf(b) - 34 + bob);
    const wp = (guidePath || []).find(([x, y]) => Math.hypot(x - walker.px, y - walker.py) > 14) || [dc.x, dc.y];
    const ang = Math.atan2(wp[1] - walker.py, wp[0] - walker.px);
    const r = 17 + Math.round(Math.sin(t * 6) * 2);
    const img = arrowImg(ang);
    ctx.drawImage(img, Math.round(walker.px + Math.cos(ang) * r) - 10, Math.round(walker.py - 4 + Math.sin(ang) * r * 0.7) - 10);
  }
  // i skärmrymden: skylten i bildkanten (när dörren inte syns) och lappen nere till vänster
  function drawGuideHud(ctx, cx, cy) {
    guideRects = [];
    const b = guideB();
    if (!b || riding || fade.phase) return;
    const sb = safeBox(), dc = doorCenter(b), m = metersBetween({ x: walker.px, y: walker.py }, dc);
    const chip = (x, y, text, fg, bg) => { const w = textW(SMALL, text) + 8; ctx.fillStyle = '#17151a'; ctx.fillRect(x - 1, y - 1, w + 2, 11); ctx.fillStyle = bg; ctx.fillRect(x, y, w, 9); ctxText(ctx, SMALL, text, x + 4, y + 2, fg); return w; };
    const name = String(b.sign || b.id).toUpperCase();
    // skylten i kanten
    const sx = dc.x - cx, sy = baseOf(b) - 20 - cy;
    if (sx < sb.x0 || sx > sb.x1 || sy < sb.y0 || sy > sb.y1) {
      const mx = (sb.x0 + sb.x1) / 2, my = (sb.y0 + sb.y1) / 2, ang = Math.atan2(sy - my, sx - mx);
      const ex = Math.max(sb.x0 + 14, Math.min(sb.x1 - 14, sx)), ey = Math.max(sb.y0 + 24, Math.min(sb.y1 - 34, sy));
      const img = arrowImg(ang);
      ctx.drawImage(img, Math.round(ex) - 10, Math.round(ey) - 10);
      const text = `${name} ${m} M`, w = textW(SMALL, text) + 8;
      const lx = Math.round(Math.max(sb.x0 + 2, Math.min(sb.x1 - w - 2, ex - w / 2))), ly = Math.round(ey + (ang > 0 ? -22 : 12));
      chip(lx, ly, text, '#ffd23f', '#2a2430');
      guideRects.push({ kind: 'go', r: [Math.min(lx, ex - 12), Math.min(ly, ey - 12), Math.max(lx + w, ex + 12), Math.max(ly + 10, ey + 12)] });
    }
    // lappen: TILL … · 240 M  ×
    const text = `TILL ${name} - ${m} M`, x = sb.x0 + 4, y = sb.y1 - 15;
    const w = chip(x, y, text, '#f4f1ea', '#2a2430');
    const xx = x + w + 3; chip(xx, y, '×', '#ffd23f', '#6a2a30');
    guideRects.push({ kind: 'cancel', r: [xx - 3, y - 4, xx + 14, y + 13] }, { kind: 'go', r: [x - 2, y - 4, x + w + 2, y + 13] });
  }

  // ---------- 🚕 taxin (A.taxiTo / kartan) ----------
  // Beställningen: taxin (traffic.callTaxi) kör fram i gatans fil närmast figuren och stannar vid
  // trottoarkanten mitt för hen – figuren går till kanten och väntar. När taxin står där kliver man
  // in (bakom toningen: betala, tiden går) och kliver ur vid trottoarkanten närmast målets dörr,
  // där en taxi står och släpper av; sista biten går man (pilen visar dörren). Står man inte vid
  // bilen på 45 s kör chauffören vidare (gratis). Klick på taxin = gå dit.
  let taxi = null; // { dest, kr, min, m, road, lane, curb, wait, boarded }
  // gatan och trottoarkanten närmast punkten: norr/söder om Pixelgatan (parken hör dit) eller Södergatan
  const pickupFor = (x, y) => {
    const cx = Math.max(WX0 + 70, Math.min(CITY.W - 70, x));
    if (y < (CITY.ROAD[0] + CITY.ROAD[1]) / 2) return { road: 'pixelgatan', lane: 0, curb: { x: cx, y: CITY.ROAD[0] - 5 } };
    if (y < CITY.BACK_S[1]) return { road: 'pixelgatan', lane: 1, curb: { x: cx, y: CITY.ROAD[1] + 5 } };
    if (y < (CITY.ROAD_S[0] + CITY.ROAD_S[1]) / 2) return { road: 'sodergatan', lane: 0, curb: { x: cx, y: CITY.ROAD_S[0] - 5 } };
    return { road: 'sodergatan', lane: 1, curb: { x: cx, y: CITY.ROAD_S[1] + 5 } };
  };
  function callTaxi(id) {
    const b = buildingById(id);
    if (!b) return false;
    if (taxi) { toast('🚕 Din taxi är redan på väg – vänta vid trottoarkanten.'); return false; }
    const q = taxiQuote({ x: walker.px, y: walker.py }, b);
    if (g.money < q.kr) { toast(`🚕 Taxin till ${b.sign} kostar ${q.kr} kr – du har inte råd.`, 'bad'); play('fel'); return false; }
    if (riding) { toast('🚕 Kliv av bussen först.'); return false; }
    const p = pickupFor(walker.px, walker.py);
    if (!S.traffic.callTaxi?.({ road: p.road, lane: p.lane, x: p.curb.x })) { toast('🚕 Ingen taxi svarar just nu – försök igen om en stund.', 'bad'); return false; }
    taxi = { dest: b, ...q, ...p, wait: 0, boarded: false };
    if (sitting) standUp();
    walker.walkTo(p.curb.x, p.curb.y);
    play('click');
    toast(`🚕 Taxin är på väg! ${q.kr} kr till ${b.icon || ''} ${b.sign || ''} – vänta vid trottoarkanten.`, 'good');
    return true;
  }
  function cancelTaxi(msg) {
    if (!taxi) return;
    S.traffic.cancelTaxi?.();
    taxi = null;
    if (msg) toast(msg, 'bad');
  }
  function updTaxi(dt) {
    if (!taxi || taxi.boarded) return;
    const tx = S.traffic.taxi?.();
    if (!tx) { taxi = null; return; }
    if (tx.state !== 'framme') return;
    taxi.wait += dt;
    const near = Math.abs(walker.px - tx.x) < 26 && Math.abs(walker.py - tx.curbY) < 14;
    if (near && !walker.path.length && fade.phase === 0 && taxi.wait > 0.5) boardTaxi(tx);
    else if (taxi.wait > 45) cancelTaxi('🚕 Chauffören tröttnade på att vänta och körde vidare. Beställ igen med 🚕.');
  }
  function boardTaxi(tx) {
    taxi.boarded = true;
    walker.stop();
    walker.dir = tx.curbY < tx.y ? 'down' : 'up';
    play('door');
    fade.phase = 1; fade.cb = () => {
      const T0 = taxi; taxi = null;
      S.traffic.taxiBoard?.();
      const b = T0.dest, dc = doorCenter(b), drop = pickupFor(dc.x, baseOf(b) + 8);
      g.money -= T0.kr; g.passTime(T0.min); g.save();
      S.traffic.taxiDrop?.({ road: drop.road, lane: drop.lane, x: drop.curb.x });
      walker.px = drop.curb.x; walker.py = drop.curb.y; walker.stop(); walker.snapFree();
      A.cityPos = [walker.px, walker.py];
      Object.assign(cam, camTarget());
      checkDistrict(true);
      // sista biten till dörren går man själv (pilen visar vägen om den är lång)
      if (Math.hypot(dc.x - walker.px, dc.y - walker.py) > 70) A.guide = { id: b.id };
      walker.walkTo(dc.x, dc.y);
      play('coin');
      toast(`🚕 Framme vid ${b.icon || ''} ${b.sign || ''} – ${T0.kr} kr, ${T0.min} minuter.`, 'good');
    };
  }
  function taxiMenu() {
    if (!taxi) return;
    const tx = S.traffic.taxi?.();
    openModal('🚕 Din taxi', `<p style="font-size:var(--f2);margin-top:0">${tx?.state === 'framme' ? 'Taxin står och väntar vid trottoarkanten' : 'Taxin är på väg'} – till <b>${esc(taxi.dest.icon || '')} ${esc(taxi.dest.sign || '')}</b> för <b>${taxi.kr} kr</b>.</p>`, [
      { label: '❌ Avbeställ', onClick: () => { closeModal(); cancelTaxi(); toast('🚕 Taxin är avbeställd.'); } },
      { label: '🚶 Gå till taxin', cls: 'btn-go', onClick: () => { closeModal(); const c = tx || { x: taxi.curb.x, curbY: taxi.curb.y }; walker.walkTo(c.x, c.curbY); } },
    ]);
  }

  const spotOf = (b) => { const dc = doorCenter(b); return { x: dc.x - cam.x, y: baseOf(b) + 12 - cam.y }; };
  return {
    // 🚕/🧭 för main.js (A.taxiTo, 🚕-knappen)
    callTaxi, taxiBusy: () => !!taxi, taxiMenu,
    exit() { cancelTaxi(); }, // går man in någonstans kör den beställda taxin vidare
    get worldX() { return walker.px; },
    get worldY() { return walker.py; },
    get worldSit() { return sitting ? { dir: sitting.seat.dir || 'down' } : null; }, // andra ser mig sitta på bänken
    get worldRide() { const F = fordon(); return F && !riding && !sitting ? { id: F.id, c: F.c } : null; }, // andra ser mig cykla
    rideChanged: applyRide,   // 🚲-knappen bytte fordon (eller till att gå)
    truckChanged: () => { setObst(); walker.snapFree(); },   // 🚚 trucken flyttad, köpt eller såld
    _debug: {
      spot: (id) => { const b = ALL_BUILDINGS.find((x) => x.id === id); return b ? spotOf(b) : null; },
      tile: (a, bb) => ({ x: 60 + a * 40 - cam.x, y: CITY.SIDEWALK_N[0] + 8 + bb * 10 - cam.y }),
      lockCam: (x, y) => { lockedCam = x === null || x === undefined ? null : { x: Math.max(WX0, Math.min(CITY.W - VW, x)), y: Math.max(0, Math.min(CITY.H - VH, y)) }; if (lockedCam) Object.assign(cam, lockedCam); },
      teleport: (x, y) => { walker.px = x; walker.py = y; walker.stop(); walker.snapFree(); Object.assign(cam, camTarget()); checkDistrict(false); },
      panorama: () => {
        const c = document.createElement('canvas'); c.width = CITY.W - WX0; c.height = CITY.H;
        const x = c.getContext('2d'); x.imageSmoothingEnabled = false;
        x.translate(-WX0, 0);
        drawWorld(x, WX0, 0, CITY.W - WX0, CITY.H);
        return c.toDataURL('image/png');
      },
      // v2
      busTo: (name) => rideBus(busStopById(name), { free: true }),
      busStop: (name) => { const s = busStopById(name); return s ? { x: s.x - cam.x, y: s.y - 20 - cam.y } : null; },
      district: (name) => { const d = districtByName(name); if (!d) return null; walker.px = d.spawn.x; walker.py = d.spawn.y; walker.stop(); walker.snapFree(); Object.assign(cam, camTarget()); checkDistrict(true); return d; },
      districtNow: () => districtAt(walker.px, walker.py).name,
      weather: (f) => { env.forceWeather = f || null; for (const k in CACHE) if (k.startsWith('b:')) delete CACHE[k]; updateEnv(0); return env.weather; },
      walkTo: (x, y) => { walker.walkTo(x, y); return walker.path.length; },
      arrived: () => walker.path.length === 0 && fade.phase === 0,
      pos: () => ({ x: walker.px, y: walker.py }),
      enter: (id) => { const b = ALL_BUILDINGS.find((x) => x.id === id); if (!b) return false; const dc = doorCenter(b); walker.walkTo(dc.x, dc.y, () => enter(b)); return true; },
      buildings: ALL_BUILDINGS,
      env,
      sim: () => S,
      // bussen på riktigt + bänkarna (för röktestet)
      ride: () => (S.traffic.ride?.() || null),
      sitting: () => (sitting ? sitting.seat.id : null),
      standUp,
      cam: () => ({ ...cam }),
      markers: () => markers.map((m) => ({ ...m })),
      chips: () => signChips.map((c) => ({ label: c.label, x: c.x, y: c.y, w: c.w, h: c.h, id: c.b.id })), // husnamnen i överkanten (tools/mobil-stad-test.mjs)
      pets: () => (pets ? pets._debug.followers() : []), // husdjuren på promenad (tools/pets-walk-test.mjs)
      // 🧭/🚕 (tools/karta-taxi-test.mjs)
      guide: () => { const b = guideB(); if (!b) return null; const wp = (guidePath || []).find(([x, y]) => Math.hypot(x - walker.px, y - walker.py) > 14); return { id: b.id, path: (guidePath || []).length, next: wp || null, rects: guideRects.map((q) => ({ kind: q.kind, r: [...q.r] })) }; },
      taxi: () => (taxi ? { dest: taxi.dest.id, kr: taxi.kr, min: taxi.min, curb: { ...taxi.curb }, road: taxi.road, lane: taxi.lane, wait: taxi.wait, car: S.traffic.taxi?.() || null } : null),
      pickupFor,
      // 🚲 fordonet (tools/fordon-test.mjs)
      fordon: () => ({ id: fordon()?.id || null, speed: walker.speed, dir: walker.dir }),
      walkable: (x, y) => walker.walkable(x, y),
      truck: () => { const TP = truckPos(); return TP ? { x: TP.x - cam.x, y: TP.y - 20 - cam.y, plats: g.truck.plats, open: truckOppen(g) } : null; },
    },

    update(dt) {
      t += dt;
      if (A.followPlayer) {
        const f = worldFolksHere(A).find((p) => p.id === A.followPlayer);
        A.followPlayer = null;
        if (f) walker.walkTo(f.x, f.y + 4);
        else toast('Hen är inte i staden längre.', 'bad');
      }
      if (fade.phase === 1) { fade.a = Math.min(1, fade.a + dt * 2.6); if (fade.a >= 1) { fade.phase = 2; const cb = fade.cb; fade.cb = null; cb?.(); } }
      else if (fade.phase === 2) { fade.a = Math.max(0, fade.a - dt * 1.8); if (fade.a <= 0) fade.phase = 0; }
      else walker.update(dt);
      // bussresan på riktigt: figuren sitter i bussen, kameran (walker-punkten) följer den
      const r = S.traffic.ride?.();
      if (r) {
        riding = true;
        walker.stop();
        walker.px = r.pos.x; walker.py = r.pos.y;
        if (r.phase === 'framme') finishRide();
      } else if (riding) { riding = false; walker.snapFree(); } // bussen försvann – stå kvar där man är
      A.cityPos = [walker.px, walker.py];
      // 🌾 österut förbi stadsgränsen på Pixelgatan: ut på LANDET (js/scenes/landet.js)
      if (!A.attract && fade.phase === 0 && !riding && walker.px >= CITY.W - 8 && walker.py >= CITY.SIDEWALK_N[0] && walker.py <= CITY.SIDEWALK_S[1]) {
        walker.stop(); fade.phase = 1; fade.a = 0;
        fade.cb = () => { A.landetFran = { y: walker.py }; A.go('landet'); };
      }
      // första turen för dagen på cykeln/moppen gör en glad (vinden i håret)
      const mv = walker.path.length > 0 && !riding;
      if (mv && !rullar && fordon()) g.glad?.(1, '', 'fordon', 2);
      rullar = mv;
      // 🚕 en taxi beställd inifrån (A.taxiTo) – nu när man står på trottoaren; 🧭 pilen; taxin
      if (A.pendingTaxi && !A.attract && fade.phase === 0) { const id = A.pendingTaxi; A.pendingTaxi = null; callTaxi(id); }
      updGuide(dt);
      updTaxi(dt);
      if (pets) guard('husdjuren.update', () => pets.update(dt, walker.px, walker.py, (x, y) => walker.walkable(x, y), { hidden: riding }));
      updateEnv(dt);
      if (banner) banner.t += dt;
      if (fade.phase === 0) checkDistrict(false);
      for (const [name, m] of [['fallback', S.fallback], ['bridge', S.bridge], ['props', S.props], ['traffic', S.traffic], ['life', S.life], ['marknad', S.market], ['pir', S.pier]]) guard(name + '.update', () => m.update?.(dt));
      // 🐬 spelaren såg delfinen vid piren: lyckan går upp och folk runt omkring jublar och kramas
      const lk = S.pier?.takeLuck?.();
      if (lk && !A.attract) {
        const fick = g.glad?.(5, 'En delfin vid piren', 'delfin', 10) || 0;
        guard('life.cheer', () => S.life.cheer?.(lk.x, lk.y, 260, MODS.pir?.LUCK_LINES));
        play('morning');
        toast(`🐬 En delfin! Alla runt omkring jublar – det ger tur!${fick ? ` 😊 +${fick}` : ''}`, 'good');
      }
      // dörrarna öppnas när någon är nära
      for (const b of ALL_BUILDINGS) {
        const dc = doorCenter(b), base = baseOf(b), half = (b.door.x1 - b.door.x0) / 2 + 14;
        const near = env.people.some((p) => Math.abs(p.x - dc.x) < half && p.y > base - 6 && p.y < base + 30);
        doorOpen[b.id] += ((near ? 1 : 0) - doorOpen[b.id]) * Math.min(1, dt * (b.door.type === 'slide' ? 5 : 8));
        if (near && !doorWasOpen[b.id] && b.door.type === 'slide' && Math.abs(walker.px - dc.x) < half + 20) play('slide');
        doorWasOpen[b.id] = near;
      }
      // kameran glider efter figuren
      const tg = camTarget(), k = lockedCam ? 1 : Math.min(1, dt * (A.attract ? 1.5 : 6));
      cam.x += (tg.x - cam.x) * k; cam.y += (tg.y - cam.y) * k;
    },

    down(sx, sy) {
      if (A.attract || fade.phase) return;
      // klick under bussresan → hoppa fram till målet (toningen)
      if (riding) { S.traffic.skipRide?.(); return; }
      // 🧭 vägvisarens lapp och skylt: × tar bort pilen, annars går figuren dit själv
      const gr = guideRects.find((q) => sx >= q.r[0] && sx < q.r[2] && sy >= q.r[1] && sy < q.r[3]);
      if (gr) { if (gr.kind === 'cancel') { A.guide = null; guidePath = null; play('click'); toast('🧭 Pilen är borta.'); } else walkToGuide(); return; }
      // klick på en kompis-pil i kanten → gå mot den spelaren
      const m = markers.find((mk) => sx >= mk.x && sx < mk.x + mk.w && sy >= mk.y && sy < mk.y + mk.h);
      if (m) { standUp(); walker.walkTo(m.fx, m.fy + 4); return; }
      // klick på ett husnamn i överkanten → gå till dörren och gå in
      const chip = signChips.find((c) => sx >= c.x - 2 && sx < c.x + c.w + 2 && sy >= c.y - 2 && sy < c.y + c.h + 4);
      if (chip) { if (sitting) standUp(); const dc = doorCenter(chip.b); walker.walkTo(dc.x, dc.y, () => enter(chip.b)); return; }
      const x = sx + cam.x, y = sy + cam.y;
      // 🌾 skylten LANDET → (eller längst ut på gatan): gå österut ut på landet
      if (x >= CITY.W - 40 && y >= CITY.SIDEWALK_N[0] && y <= CITY.SIDEWALK_S[1] + 4) { if (sitting) standUp(); walker.walkTo(CITY.W - 5, Math.max(CITY.SIDEWALK_N[0] + 4, Math.min(CITY.SIDEWALK_S[1] - 4, y))); return; }
      // 🚚 foodtrucken: gå fram till luckan och öppna truckrutan
      const TP = truckPos();
      if (TP && x >= TP.x - 36 && x <= TP.x + 36 && y >= TP.y - 52 && y <= TP.y + 4) { if (sitting) standUp(); walker.walkTo(TP.x - 8, TP.y + 14, () => openTruck(A)); return; }
      // klick på en fotgängare → hen stannar, vänder sig mot en och säger något med sin egen röst.
      // Nära: direkt (man sitter kvar på bänken). Längre bort: hen väntar medan man går fram.
      // Den som står BAKOM en buss, taxi eller ledig bänk (längre bort i bild) tar inte klicket – det
      // som står framför ska gå att kliva på / sätta sig på (annars fångade en väntande resenär klicket
      // på bussdörren och en förbipasserande klicket på bänken).
      // 🎪 marknaden: ett stånd, karusellen, ballongerna, lyckohjulet → gå fram och handla
      const fs = S.pier?.fisherAt?.(x, y);
      if (fs) { if (sitting) standUp(); walker.walkTo(fs.walk.x, fs.walk.y, () => MODS.pir?.talkFisher?.(A, fs)); return; }
      const kk = S.pier?.kikareAt?.(x, y);   // 🔭 myntkikaren på bryggan
      if (kk) { if (sitting) standUp(); walker.walkTo(kk.walk.x, kk.walk.y, () => { walker.dir = 'up'; MODS.pir?.useKikare?.(A, S.pier); }); return; }
      const ms = S.market?.stallAt?.(x, y);
      if (ms) { if (sitting) standUp(); walker.walkTo(ms.walk.x, ms.walk.y, () => { walker.dir = 'up'; MODS.marknad?.openStall?.(A, ms, S.market); }); return; }
      let who = S.life.personAt?.(x, y);
      if (who) {
        const car = S.traffic.busDoorHit?.(x, y) || (taxi && S.traffic.taxiHit?.(x, y) ? S.traffic.taxi?.() : null);
        const bench = S.props.seatAt?.(x, y, (s) => !S.life.seatBusy?.(s.id) && !remoteSat(s));
        const front = Math.max(car ? car.y : -1e9, bench ? bench.y : -1e9);
        if (who.y + (who.oy || 0) < front) who = null;
        // en dörr (och ytan framför den) går före folk som råkar gå förbi – man ska komma in
        else if (ALL_BUILDINGS.some((b) => x >= b.door.x0 - 8 && x < b.door.x1 + 8 && facadeHit(b, x, y))) who = null;
      }
      if (who) {
        const turn = () => { if (!sitting) { const dx = who.x - walker.px, dy = who.y - walker.py; walker.dir = Math.abs(dx) > Math.abs(dy) * 1.6 ? (dx < 0 ? 'left' : 'right') : dy < 0 ? 'up' : 'down'; } };
        const d = Math.hypot(who.x - walker.px, who.y - walker.py);
        if (d < 64) { S.life.talkTo(who, walker.px, walker.py); turn(); return; }
        if (sitting) standUp();
        S.life.holdFor(who, Math.min(6, d / 40 + 1), walker.px, walker.py);
        walker.walkTo(who.x + (walker.px < who.x ? -14 : 14), who.y + 2, () => {
          if (who.gone || who.hidden || Math.hypot(who.x - walker.px, who.y - walker.py) > 60) return;
          S.life.talkTo(who, walker.px, walker.py); turn();
        });
        return;
      }
      if (sitting) standUp(); // res dig först – klicket fortsätter som vanligt
      // klick på en buss som står vid en hållplats → håll den, gå till framdörren och kliv på
      // klick på den beställda taxin → gå till trottoarkanten vid den (man kliver in när den står still)
      if (taxi && S.traffic.taxiHit?.(x, y)) { const tx = S.traffic.taxi?.(); if (tx) { if (sitting) standUp(); walker.walkTo(tx.x, tx.curbY); } return; }
      const bi = S.traffic.busDoorHit?.(x, y);
      if (bi) { S.traffic.hold?.(bi.stop.id); walker.walkTo(bi.board.x, bi.board.y, () => openBoardDialog(bi.stop)); return; }
      // klick på en busshållplats → gå dit och välj resmål
      const stop = busStopHit(x, y);
      if (stop) { walker.walkTo(stop.wait.x, stop.wait.y, () => openBusDialog(stop)); return; }
      // klick på en ledig bänkplats → gå dit och sätt dig
      const seat = S.props.seatAt?.(x, y, (s) => !S.life.seatBusy?.(s.id) && !remoteSat(s));
      if (seat) {
        walker.walkTo(seat.walk.x, seat.walk.y, () => {
          if (S.life.seatBusy?.(seat.id) || remoteSat(seat)) { toast('🪑 Upptaget – någon hann före.'); return; }
          sitting = { seat };
          walker.stop();
          walker.px = seat.x; walker.py = seat.y; walker.dir = seat.dir || 'down'; // fotpunkten på sitsen (env.player håller platsen åt en)
        });
        return;
      }
      // klick på ett hus (fasad eller dörr) → gå till dörren och gå in
      for (const b of ALL_BUILDINGS) {
        if (facadeHit(b, x, y)) {
          const dc = doorCenter(b);
          walker.walkTo(dc.x, dc.y, () => enter(b));
          return;
        }
      }
      walker.walkTo(x, y);
    },

    draw(ctx) {
      syncView(A); // skärmen kan ha ändrat storlek – vyn följer med
      const cx = Math.round(cam.x), cy = Math.round(cam.y);
      ctx.setTransform(A.pxs, 0, 0, A.pxs, -cx * A.pxs, -cy * A.pxs);
      drawWorld(ctx, cx, cy, VW, VH);
      // fotgängarnas repliker (klick på folk) – överst i världen, med personens egen röst
      guard('pratet', () => { for (const b of S.life.talks?.() || []) sayBubble(ctx, b.x, b.y, b.text, { voice: b.voice, x0: cx, x1: cx + VW }); });
      guard('pir.talks', () => { for (const b of S.pier?.talks?.() || []) sayBubble(ctx, b.x, b.y, b.text, { voice: false, x0: cx, x1: cx + VW }); });
      guard('vägvisaren', () => drawGuide(ctx));
      ctx.setTransform(A.pxs, 0, 0, A.pxs, 0, 0);
      drawFolkMarkers(ctx, cx, cy);
      guard('husnamnen', () => drawSignChips(ctx, cx, cy));
      guard('vägvisarlappen', () => drawGuideHud(ctx, cx, cy));
      drawOverlay(ctx);
    },
  };
}
