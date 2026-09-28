// Pixelstaden – en stor stad (CITY.W × CITY.H) där kameran följer figuren.
// Scenen sköter kamera, gång, dörrar, ljussättning, väder, bussen och vad som
// händer när man går in; konsten och livet kommer från modulerna i js/city/
// (kontraktet: js/city/map.js + docs/STADEN.md). Modulerna laddas var för sig –
// kraschar en, lever resten.
import { CITY, BUILDINGS, ALL_BUILDINGS, doorCenter, artPos, artBox, baseOf, isNightHour, BUS_STOPS, busStopById,
  DISTRICTS, districtAt, districtByName, MAP_OBSTACLES } from '../city/map.js';
import { createWalker, selfDrawable, folkDrawables, nameTag } from './walkable.js';
import { drawPerson } from '../core/people.js';
import { openModal, closeModal, toast, esc } from '../core/ui.js';
import { play } from '../core/sound.js';
import { SMALL, BIG, ctxText, textW } from '../core/floor-pix.js';
import { worldFolksHere } from '../net/world.js';
import { clock, JOBS, HOMES } from '../game.js';
import { WORKPLACES, NEW_HOMES } from '../city/places.js';
import { createPetWalk } from '../pets/outdoors.js'; // husdjuren på promenad (hunden i koppel)

// Stadsmodulerna. buildings-* ger BUILDING_ART, ground/props/traffic/life livet,
// weather vädret, walk gångmotorn och fallback-v2 platshållare för allt som
// modulerna inte täcker ännu (marken/skjulen/staketen i v2-områdena).
const MODS = {};
await Promise.all(['buildings-shops', 'buildings-work', 'buildings-south', 'buildings-suburb', 'ground', 'props', 'traffic', 'life', 'weather', 'walk', 'fallback-v2'].map((n) =>
  import(`../city/${n}.js`).then((m) => { MODS[n] = m; }).catch((e) => console.error(`stadsmodulen ${n} kunde inte laddas:`, e))));

let VW = CITY.VIEW_W, VH = CITY.VIEW_H; // mobilfyllning: vyn följer skärmen, klampad till världen
const syncView = (A) => { VW = Math.max(CITY.VIEW_W, Math.min(A.W || CITY.VIEW_W, CITY.W)); VH = Math.max(CITY.VIEW_H, Math.min(A.H || CITY.VIEW_H, CITY.H)); };
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
  env.obstacles = [...MAP_OBSTACLES, ...artObstacles(), ...(props.obstacles || []), ...(traffic.obstacles || []), ...(fallback.obstacles || [])];
  const life = safe('life', () => MODS.life?.createLife(env, traffic, props), NONE); // props ger livet riktiga sittplatser (props.seats())
  const weather = safe('weather', () => MODS.weather?.createWeather(env), NO_WEATHER);
  SIM = { props, traffic, life, fallback, weather };
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
  ...(MODS['buildings-south']?.BUILDING_ART || {}), ...(MODS['buildings-suburb']?.BUILDING_ART || {}),
});
function groundImg(night) {
  const k = 'ground:' + night;
  if (!CACHE[k]) {
    let c;
    try { c = MODS.ground.paintGround(night); } catch (e) {
      console.error('marken kunde inte målas:', e);
      c = document.createElement('canvas'); c.width = CITY.W; c.height = CITY.H;
      const x = c.getContext('2d'); x.fillStyle = '#6a6258'; x.fillRect(0, 0, CITY.W, CITY.H);
    }
    // v2-områdena (Södergatan, kanalen, Infarten, förorten) tills ground.js målar dem själv
    if (!MODS.ground?.V2) { try { SIM?.fallback?.paintGround?.(c, night); } catch (e) { console.error('platshållarmarken kunde inte målas:', e); } }
    CACHE[k] = c;
  }
  return CACHE[k];
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

let lastDistrictId = null; // områdesskylten visas bara när man kommer till ett nytt område

export function makeCity(A) {
  const g = A.game;
  const S = sim();
  const start = A.cityPos || [doorCenter(BUILDINGS[0]).x, doorCenter(BUILDINGS[0]).y];
  const bounds = { W: CITY.W, H: CITY.H, left: 4, right: CITY.W - 4, top: CITY.BACK[0], bottom: CITY.WALK_BOTTOM ?? CITY.H - 4, spawn: start };
  let walker;
  try { walker = MODS.walk.createCityWalker(bounds); } catch (e) { console.error('gångmotorn walk.js startade inte – använder den enkla:', e); walker = createWalker(bounds); }
  walker.speed = 110;
  env.obstacles = [...MAP_OBSTACLES, ...artObstacles(), ...(S.props.obstacles || []), ...(S.traffic.obstacles || []), ...(S.fallback.obstacles || []), ...(S.life.obstacles || [])];
  walker.setObstacles(env.obstacles);
  walker.snapFree();
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
  const camTarget = () => lockedCam || (A.attract ? attractCam() : {
    x: Math.max(0, Math.min(CITY.W - VW, walker.px - VW / 2)),
    y: Math.max(0, Math.min(CITY.H - VH, walker.py - VH * 0.62)),
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
  const homeHere = (b) => (b.homes || []).includes(g.home);
  function enter(b) {
    if (!b.enter) { toast(b.soon ? `${b.icon || '🚪'} ${b.soon}` : `☕ ${b.sign} öppnar snart – håll utkik!`); return; }
    const hour = g.min / 60;
    if (b.open && (hour < b.open[0] || hour >= b.open[1])) {
      if (hour < b.open[0]) {
        openModal(`🔒 ${esc(b.sign)}`, `<p style="font-size:20px;margin-top:0">Stängt just nu – öppnar ${clock(b.open[0] * 60)}.</p>`, [
          { label: 'Gå därifrån', onClick: closeModal },
          { label: '⏩ Vänta tills det öppnar', cls: 'btn-go', onClick: () => { closeModal(); g.waitUntil(b.open[0] * 60); enter(b); } },
        ]);
      } else toast(`🔒 ${b.sign} har stängt för i dag – öppnar ${clock(b.open[0] * 60)} i morgon.`, 'bad');
      return;
    }
    // nya jobb och bostäder som inte är inkopplade i game.js ännu kostar ingen tid
    const [kind, id] = b.enter.split(':');
    if (kind === 'jobb' && !JOBS[id]) {
      const w = WORKPLACES.find((x) => x.id === id);
      toast(`${w?.icon || b.icon || '💼'} ${b.sign} anställer snart!${w ? ` "${w.verb}" – ${w.wage} kr per rätt.` : ''}`);
      return;
    }
    if (kind === 'bostad' && id && !homeHere(b) && !HOMES.some((h) => h.id === id)) {
      const h = NEW_HOMES.find((x) => x.id === id);
      toast(`${b.icon || '🔑'} ${b.sign}: ${h ? `${h.name} hyrs snart ut – ${h.rent} kr/vecka. ` : ''}Fråga på Bostadsbyrån!`);
      return;
    }
    g.passTime(g.eventIs('regn') ? 10 : 5);
    g.save();
    if (g.collapsed) return;
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
      openModal('☕ Kaféet', '<p style="font-size:20px;margin-top:0">Vill du fika, eller jobba ett pass bakom disken som barista?</p>', [
        { label: '☕ Fika', cls: 'btn-go', onClick: () => { closeModal(); A.go('kafe'); } },
        { label: '💼 Jobba ett pass', onClick: () => { closeModal(); A.startJob('kafe'); } },
      ]);
    } else if (b.enter === 'djur') A.go('djur');
    else if (b.enter === 'burgare') A.go('burgarbar'); // in i dinern – jobba gör man vid disken därinne
    else if (kind === 'jobb') A.startJob(id);
    else A.startJob(b.enter === 'flyg' ? 'flygplats' : b.enter);
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
    const body = `<p style="font-size:19px;margin-top:0">${intro}</p><div class="plist">${others.map((s) => `
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
  let sitting = null;   // spelaren sitter på en bänk: { seat } från props.seats()
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
    const body = `<p style="font-size:19px;margin-top:0">Dörrarna står öppna${from.broken ? ' – kuren är sönder men bussen går' : ''}. Resan kostar <b>${BUS_FARE} kr</b>.</p><div class="plist">${dests.map((s) => `
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
    ctx.drawImage(groundImg(night), cx, cy, vw, vh, cx, cy, vw, vh);
    guard('ground.groundLive', () => MODS.ground?.groundLive?.(ctx, env, view));
    guard('weather.drawBack', () => S.weather.drawBack?.(ctx, view));
    guard('ground.groundOver', () => MODS.ground?.groundOver?.(ctx, env, view)); // fotspår m.m. skarpt OVANPÅ snötäcket

    const items = [];
    const art = ART();
    const stOf = (b) => ({ t: env.t, night, hour: env.hour, doorOpen: doorOpen[b.id], env, worn: districtByName(b.district)?.worn ?? 0 });
    for (const b of ALL_BUILDINGS) {
      if (b.x + b.w + 40 < cx || b.x - 40 > cx + vw) continue;
      const base = baseOf(b), box = artBox(b);
      if (base + 4 < cy || box.y > cy + vh) continue;
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
    add('props', () => S.props.items());
    add('traffic', () => S.traffic.items());
    add('life', () => S.life.items());
    for (const d of folkDrawables(A, t)) items.push({ y: d.fy, draw: () => d.draw(ctx) });
    if (!A.attract) {
      if (riding) { /* figuren sitter i bussfönstret – trafiken ritar den (ride.look) */ }
      else if (sitting) {
        const s = sitting.seat;
        items.push({ y: s.y + 0.01, draw: () => {
          drawPerson(ctx, s.x, s.y, A.avatar.look, s.dir || 'down', 5);
          if (worldFolksHere(A).length) nameTag(ctx, s.x, s.y - 46, A.avatar);
        } });
      } else {
        const me = selfDrawable(A, walker, t, { folksHere: worldFolksHere(A).length });
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
        if (base + 4 < cy || artBox(b).y > cy + vh) continue;
        guard(`${b.kind}.glow`, () => { ctx.save(); art[b.kind]?.glow?.(ctx, b, stOf(b)); ctx.restore(); });
      }
      for (const [name, m] of [['fallback', S.fallback], ['props', S.props], ['traffic', S.traffic], ['life', S.life]]) guard(name + '.glow', () => { ctx.save(); m.glow?.(ctx, view); ctx.restore(); });
      guard('weather.glow', () => { ctx.save(); S.weather.glow?.(ctx, view); ctx.restore(); });
    }
  }

  // ---------- skärmlagret: områdesskylt, väder, busstoning ----------
  function drawBanner(ctx) {
    if (!banner) return;
    const { d, t: bt } = banner, dur = 3.4;
    if (bt > dur) { banner = null; return; }
    const k = bt < 0.35 ? bt / 0.35 : bt > dur - 0.6 ? (dur - bt) / 0.6 : 1;
    const name = d.name, tag = d.tag || '';
    const w = Math.max(textW(BIG, name, 2), textW(SMALL, tag)) + 24, h = tag ? 44 : 30;
    const x = Math.round((VW - w) / 2), y = Math.round(26 - (1 - k) * 12);
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
    if (!A.attract) guard('weather.badge', () => MODS.weather?.drawWeatherBadge?.(ctx, VW - 3, 3, env.weather));
    const a = Math.max(fade.a, riding ? S.traffic.ride?.()?.fade || 0 : 0); // busstoningen (långa resor) delar rutan med skyltresans toning
    if (a > 0) { ctx.fillStyle = `rgba(4,4,10,${a.toFixed(3)})`; ctx.fillRect(0, 0, VW, VH); }
  }

  const spotOf = (b) => { const dc = doorCenter(b); return { x: dc.x - cam.x, y: baseOf(b) + 12 - cam.y }; };
  return {
    get worldX() { return walker.px; },
    get worldY() { return walker.py; },
    _debug: {
      spot: (id) => { const b = ALL_BUILDINGS.find((x) => x.id === id); return b ? spotOf(b) : null; },
      tile: (a, bb) => ({ x: 60 + a * 40 - cam.x, y: CITY.SIDEWALK_N[0] + 8 + bb * 10 - cam.y }),
      lockCam: (x, y) => { lockedCam = x === null || x === undefined ? null : { x: Math.max(0, Math.min(CITY.W - VW, x)), y: Math.max(0, Math.min(CITY.H - VH, y)) }; if (lockedCam) Object.assign(cam, lockedCam); },
      teleport: (x, y) => { walker.px = x; walker.py = y; walker.stop(); walker.snapFree(); Object.assign(cam, camTarget()); checkDistrict(false); },
      panorama: () => {
        const c = document.createElement('canvas'); c.width = CITY.W; c.height = CITY.H;
        const x = c.getContext('2d'); x.imageSmoothingEnabled = false;
        drawWorld(x, 0, 0, CITY.W, CITY.H);
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
      pets: () => (pets ? pets._debug.followers() : []), // husdjuren på promenad (tools/pets-walk-test.mjs)
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
      if (pets) guard('husdjuren.update', () => pets.update(dt, walker.px, walker.py, (x, y) => walker.walkable(x, y), { hidden: riding }));
      updateEnv(dt);
      if (banner) banner.t += dt;
      if (fade.phase === 0) checkDistrict(false);
      for (const [name, m] of [['fallback', S.fallback], ['props', S.props], ['traffic', S.traffic], ['life', S.life]]) guard(name + '.update', () => m.update?.(dt));
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
      // klick på en kompis-pil i kanten → gå mot den spelaren
      const m = markers.find((mk) => sx >= mk.x && sx < mk.x + mk.w && sy >= mk.y && sy < mk.y + mk.h);
      if (m) { standUp(); walker.walkTo(m.fx, m.fy + 4); return; }
      const x = sx + cam.x, y = sy + cam.y;
      if (sitting) standUp(); // res dig först – klicket fortsätter som vanligt
      // klick på en buss som står vid en hållplats → håll den, gå till framdörren och kliv på
      const bi = S.traffic.busDoorHit?.(x, y);
      if (bi) { S.traffic.hold?.(bi.stop.id); walker.walkTo(bi.board.x, bi.board.y, () => openBoardDialog(bi.stop)); return; }
      // klick på en busshållplats → gå dit och välj resmål
      const stop = busStopHit(x, y);
      if (stop) { walker.walkTo(stop.wait.x, stop.wait.y, () => openBusDialog(stop)); return; }
      // klick på en ledig bänkplats → gå dit och sätt dig
      const seat = S.props.seatAt?.(x, y, (s) => !S.life.seatBusy?.(s.id));
      if (seat) {
        walker.walkTo(seat.walk.x, seat.walk.y, () => {
          if (S.life.seatBusy?.(seat.id)) { toast('🪑 Upptaget – någon hann före.'); return; }
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
      ctx.setTransform(A.pxs, 0, 0, A.pxs, 0, 0);
      drawFolkMarkers(ctx, cx, cy);
      drawOverlay(ctx);
    },
  };
}
