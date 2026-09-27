// Pixelstaden – en stor stad (CITY.W × CITY.H) där kameran följer figuren.
// Scenen sköter kamera, gång, dörrar, ljussättning och vad som händer när man
// går in; konsten och livet kommer från modulerna i js/city/ (se map.js för
// kontraktet). Modulerna laddas var för sig – kraschar en, lever resten.
import { CITY, BUILDINGS, footprint, doorCenter, artPos, isNightHour } from '../city/map.js';
import { createWalker, selfDrawable, folkDrawables } from './walkable.js';
import { openModal, closeModal, toast } from '../core/ui.js';
import { play } from '../core/sound.js';
import { worldFolksHere } from '../net/world.js';
import { clock } from '../game.js';

const MODS = {};
await Promise.all(['buildings-shops', 'buildings-work', 'ground', 'props', 'traffic', 'life'].map((n) =>
  import(`../city/${n}.js`).then((m) => { MODS[n] = m; }).catch((e) => console.error(`stadsmodulen ${n} kunde inte laddas:`, e))));

const VW = CITY.VIEW_W, VH = CITY.VIEW_H;

// Delad miljö som modulerna läser (muteras varje bildruta av scenen).
// obstacles = alla hinder för gång (husens fotavtryck + rekvisita + trafikljusstolpar).
export const env = { t: 0, dt: 0, hour: 12, night: false, dark: 0, rain: false, player: { x: 0, y: 0 }, people: [], obstacles: [], play };

// ---------- simuleringen lever kvar mellan besöken i staden ----------
let SIM = null;
function sim() {
  if (SIM) return SIM;
  const safe = (name, make, fallback) => { try { return make() || fallback; } catch (e) { console.error(`stadsmodulen ${name} startade inte:`, e); return fallback; } };
  const none = { items: () => [], obstacles: [], update() {}, glow() {}, positions: () => [], pedGreen: () => true };
  const props = safe('props', () => MODS.props?.createProps(env), none);
  const traffic = safe('traffic', () => MODS.traffic?.createTraffic(env), none);
  env.obstacles = [...BUILDINGS.map(footprint), ...(props.obstacles || []), ...(traffic.obstacles || [])];
  const life = safe('life', () => MODS.life?.createLife(env, traffic), none);
  SIM = { props, traffic, life };
  return SIM;
}

// ---------- bildcache (mark + hus, per dag/natt) ----------
const CACHE = {};
const ART = () => ({ ...(MODS['buildings-shops']?.BUILDING_ART || {}), ...(MODS['buildings-work']?.BUILDING_ART || {}) });
function groundImg(night) {
  const k = 'ground:' + night;
  if (!CACHE[k]) {
    try { CACHE[k] = MODS.ground.paintGround(night); } catch (e) {
      console.error('marken kunde inte målas:', e);
      const c = document.createElement('canvas'); c.width = CITY.W; c.height = CITY.H;
      const x = c.getContext('2d'); x.fillStyle = '#6a6258'; x.fillRect(0, 0, CITY.W, CITY.H);
      CACHE[k] = c;
    }
  }
  return CACHE[k];
}
function buildingImg(b, night) {
  const k = 'b:' + b.id + ':' + night;
  if (!CACHE[k]) {
    try { CACHE[k] = ART()[b.kind].paint(b, night); } catch (e) {
      console.error(`huset ${b.id} kunde inte målas:`, e);
      const c = document.createElement('canvas'); c.width = b.w + 16; c.height = b.h + 20;
      const x = c.getContext('2d'); x.fillStyle = '#777'; x.fillRect(8, 0, b.w, b.h + 16);
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

export function makeCity(A) {
  const g = A.game;
  const S = sim();
  const start = A.cityPos || [doorCenter(BUILDINGS[0]).x, doorCenter(BUILDINGS[0]).y];
  const walker = createWalker({ W: CITY.W, H: CITY.H, left: 4, right: CITY.W - 4, top: CITY.BACK[0], bottom: CITY.H - 4, spawn: start });
  walker.speed = 110;
  env.obstacles = [...BUILDINGS.map(footprint), ...(S.props.obstacles || []), ...(S.traffic.obstacles || []), ...(S.life.obstacles || [])];
  walker.setObstacles(env.obstacles);
  walker.snapFree();

  const doorOpen = Object.fromEntries(BUILDINGS.map((b) => [b.id, 0]));
  const doorWasOpen = {};
  let t = 0, lockedCam = null;
  const cam = { x: 0, y: 0 };
  const camTarget = () => lockedCam || {
    x: Math.max(0, Math.min(CITY.W - VW, walker.px - VW / 2)),
    y: Math.max(0, Math.min(CITY.H - VH, walker.py - VH * 0.62)),
  };
  Object.assign(cam, camTarget());

  function updateEnv(dt) {
    env.t += dt; env.dt = dt;
    env.hour = g.min / 60;
    env.night = isNightHour(env.hour);
    env.dark = darkness(env.hour);
    env.rain = g.eventIs('regn');
    env.player = { x: walker.px, y: walker.py };
    const folks = worldFolksHere(A).map((f) => ({ x: f.x, y: f.y }));
    let npcs = [];
    try { npcs = S.life.positions?.() || []; } catch { /* modulfel loggas vid ritning */ }
    env.people = [env.player, ...folks, ...npcs];
  }
  updateEnv(0);

  // ---------- gå in ----------
  function enter(b) {
    if (!b.enter) { toast(`☕ ${b.sign} öppnar snart – håll utkik!`); return; }
    const hour = g.min / 60;
    if (b.open && (hour < b.open[0] || hour >= b.open[1])) {
      if (hour < b.open[0]) {
        openModal(`🔒 ${b.sign}`, `<p style="font-size:20px;margin-top:0">Stängt just nu – öppnar ${clock(b.open[0] * 60)}.</p>`, [
          { label: 'Gå därifrån', onClick: closeModal },
          { label: '⏩ Vänta tills det öppnar', cls: 'btn-go', onClick: () => { closeModal(); g.waitUntil(b.open[0] * 60); enter(b); } },
        ]);
      } else toast(`🔒 ${b.sign} har stängt för i dag – öppnar ${clock(b.open[0] * 60)} i morgon.`, 'bad');
      return;
    }
    g.passTime(g.eventIs('regn') ? 10 : 5);
    g.save();
    if (g.collapsed) return;
    play('door');
    const dc = doorCenter(b);
    A.cityPos = [dc.x, dc.y + 4];
    if (b.enter === 'hem') { A.roomSub = 0; A.go('room'); }
    else if (b.enter === 'bostad') A.openHousing();
    else if (b.enter === 'mat') A.openFoodShop();
    else if (b.enter === 'klader') A.go('klader');
    else if (b.enter === 'mobler') A.go('mobler');
    else A.startJob(b.enter === 'flyg' ? 'flygplats' : b.enter);
  }

  // ---------- ritning av hela världen (även för panorama) ----------
  function drawWorld(ctx, cx, cy, vw, vh) {
    const night = env.night;
    ctx.drawImage(groundImg(night), cx, cy, vw, vh, cx, cy, vw, vh);
    guard('ground.groundLive', () => MODS.ground?.groundLive?.(ctx, env, { x: cx, y: cy, w: vw, h: vh }));

    const items = [];
    const art = ART();
    for (const b of BUILDINGS) {
      if (b.x + b.w + 40 < cx || b.x - 40 > cx + vw) continue;
      items.push({ y: CITY.BASE, draw: () => {
        const img = buildingImg(b, night), p = artPos(b, img);
        ctx.drawImage(img, p.x, p.y);
        guard(`${b.kind}.live`, () => art[b.kind]?.live?.(ctx, b, { t: env.t, night, hour: env.hour, doorOpen: doorOpen[b.id], env }));
      } });
    }
    const add = (name, list) => {
      let arr = [];
      guard(name + '.items', () => { arr = list() || []; });
      for (const it of arr) {
        if (it.x !== undefined && (it.x < cx - 140 || it.x > cx + vw + 140)) continue;
        items.push(it);
      }
    };
    add('props', () => S.props.items());
    add('traffic', () => S.traffic.items());
    add('life', () => S.life.items());
    for (const d of folkDrawables(A, t)) items.push({ y: d.fy, draw: () => d.draw(ctx) });
    const me = selfDrawable(A, walker, t, { folksHere: worldFolksHere(A).length });
    items.push({ y: me.fy + 0.01, draw: () => me.draw(ctx) });
    items.sort((a, b) => a.y - b.y);
    for (const it of items) guard('item', () => it.draw(ctx));

    // ljussättningen: mörker först, sedan allt som lyser
    if (env.dark > 0) {
      ctx.fillStyle = `rgba(14,16,44,${env.dark})`;
      ctx.fillRect(cx, cy, vw, vh);
      for (const b of BUILDINGS) {
        if (b.x + b.w + 40 < cx || b.x - 40 > cx + vw) continue;
        guard(`${b.kind}.glow`, () => { ctx.save(); art[b.kind]?.glow?.(ctx, b, { t: env.t, night, hour: env.hour, doorOpen: doorOpen[b.id], env }); ctx.restore(); });
      }
      for (const [name, m] of [['props', S.props], ['traffic', S.traffic], ['life', S.life]]) guard(name + '.glow', () => { ctx.save(); m.glow?.(ctx); ctx.restore(); });
    }
    if (env.rain) {
      ctx.fillStyle = 'rgba(40,50,80,0.14)'; ctx.fillRect(cx, cy, vw, vh);
      ctx.fillStyle = 'rgba(170,195,235,0.5)';
      for (let i = 0; i < 90; i++) {
        const rx = cx + ((i * 97.3 + env.t * 30) % vw);
        const ry = cy + ((i * 53.7 + env.t * (130 + (i % 7) * 12)) % vh);
        ctx.fillRect(rx | 0, ry | 0, 1, 4);
      }
    }
  }

  return {
    get worldX() { return walker.px; },
    get worldY() { return walker.py; },
    _debug: {
      spot: (id) => { const b = BUILDINGS.find((x) => x.id === id); if (!b) return null; const dc = doorCenter(b); return { x: dc.x - cam.x, y: CITY.BASE - 12 - cam.y }; },
      tile: (a, bb) => ({ x: 60 + a * 40 - cam.x, y: CITY.SIDEWALK_N[0] + 8 + bb * 10 - cam.y }),
      lockCam: (x, y) => { lockedCam = x === null || x === undefined ? null : { x: Math.max(0, Math.min(CITY.W - VW, x)), y: Math.max(0, Math.min(CITY.H - VH, y)) }; if (lockedCam) Object.assign(cam, lockedCam); },
      teleport: (x, y) => { walker.px = x; walker.py = y; walker.stop(); walker.snapFree(); Object.assign(cam, camTarget()); },
      panorama: () => {
        const c = document.createElement('canvas'); c.width = CITY.W; c.height = CITY.H;
        const x = c.getContext('2d'); x.imageSmoothingEnabled = false;
        drawWorld(x, 0, 0, CITY.W, CITY.H);
        return c.toDataURL('image/png');
      },
      sim: () => S,
      cam: () => ({ ...cam }),
    },

    update(dt) {
      t += dt;
      walker.update(dt);
      A.cityPos = [walker.px, walker.py];
      updateEnv(dt);
      for (const [name, m] of [['props', S.props], ['traffic', S.traffic], ['life', S.life]]) guard(name + '.update', () => m.update?.(dt));
      // dörrarna öppnas när någon är nära
      for (const b of BUILDINGS) {
        const dc = doorCenter(b), half = (b.door.x1 - b.door.x0) / 2 + 14;
        const near = env.people.some((p) => Math.abs(p.x - dc.x) < half && p.y > CITY.BASE - 6 && p.y < CITY.BASE + 30);
        doorOpen[b.id] += ((near ? 1 : 0) - doorOpen[b.id]) * Math.min(1, dt * (b.door.type === 'slide' ? 5 : 8));
        if (near && !doorWasOpen[b.id] && b.door.type === 'slide' && Math.abs(walker.px - dc.x) < half + 20) play('slide');
        doorWasOpen[b.id] = near;
      }
      // kameran glider efter figuren
      const tg = camTarget(), k = lockedCam ? 1 : Math.min(1, dt * 6);
      cam.x += (tg.x - cam.x) * k; cam.y += (tg.y - cam.y) * k;
    },

    down(sx, sy) {
      const x = sx + cam.x, y = sy + cam.y;
      // klick på ett hus (fasad eller dörr) → gå till dörren och gå in
      for (const b of BUILDINGS) {
        const onFacade = x >= b.x && x < b.x + b.w && y >= CITY.BASE - b.h - 16 && y < CITY.BASE;
        const onDoorFront = x >= b.door.x0 - 8 && x < b.door.x1 + 8 && y >= CITY.BASE && y < CITY.BASE + 16;
        if (onFacade || onDoorFront) {
          const dc = doorCenter(b);
          walker.walkTo(dc.x, dc.y, () => enter(b));
          return;
        }
      }
      walker.walkTo(x, y);
    },

    draw(ctx) {
      const cx = Math.round(cam.x), cy = Math.round(cam.y);
      ctx.setTransform(A.pxs, 0, 0, A.pxs, -cx * A.pxs, -cy * A.pxs);
      drawWorld(ctx, cx, cy, VW, VH);
    },
  };
}
