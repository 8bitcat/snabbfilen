// Husdjurslagret: dina djur och deras prylar i ett rum (hemma), plus
// följaren som går bredvid dig ute i staden. Allt ritas i det logiska
// 384×216-rummet med heltalskoordinater. Rörelserna är mjuka och
// flimmerfria: acceleration, hysteres mellan stå/gå (börja > 2 px/s,
// stanna < 0,5 px/s) + minst 0,25 s i varje läge, riktningen hålls minst
// 0,3 s (0,6 s för att vända tillbaka), glidning längs hinder och aldrig
// någon teleport. Kontroll: tools/pets-room-snap.mjs --js "PV.audit(90)".
//
// ============================== API ==============================
// import { createPetLayer, createPetFollower } from '../pets/layer.js';
//
// const L = createPetLayer(A, { home, room, bounds:{left,right,top,bottom}, isFree(x,y), walker,
//                               onObstacles?(list), toasts = true, sync = true, store? });
//   home   = A.game.home (djurens hem-id; skapa bara lagret i spelarens EGET hem),
//   room   = delrummet (t.ex. A.roomSub eller rumsnamnet) – djur utan rum hamnar i det första rum som visas
//   walker = spelarens figur från createWalker: { px, py, dir, path, walkTo(x, y, cb), stop() }
//            (walkTo saknas → handlingen görs direkt). Scenen ritar själv figuren. När man
//            bär en matsäck är A.carrying = { k, itemId } → rita figuren med bär-bildrutor
//            (selfDrawable(A, walker, t, { carry: !!A.carrying })); lagret ritar en bubbla
//            med säcken ovanför huvudet.
//   isFree = scenens gångbarhet för djuren (möbler, väggar) UTAN husdjursprylarna – dem sköter
//            lagret självt (djuren ska kunna kliva in i korgen/buren/lådan).
//   onObstacles(list) = anropas när prylar ställs ut/flyttas → walker.setObstacles([...möbler, ...list])
//   L.update(dt)          – varje bildruta. Synkar också simuleringen mot A.game (syncTo) om sync.
//   L.drawables()         – [{ x, y, fy, draw(ctx) }] (y = fy = sorteringsnyckel) för djur, prylar,
//                           bajs/kiss och (överst, y ≥ 10000) mätare, bubblor och spöken.
//                           Blanda med scenens egna drawables och sortera på fy.
//   L.down(wx, wy)        – true om klicket hanterades (djur → meny Klappa/Leka/Koppel på|Ta med ut/
//                           Följ mig/Byt namn, säck → bär den, skål → häll i med säcken man bär,
//                           låda/bur → töm, bajs/kiss → städa, boll → kasta, korg/bur/träd →
//                           Flytta/Plocka upp). Annars false → scenen gör sitt (gå dit osv.).
//   L.hover(wx, wy)       – { kind:'pet'|'item'|'mess', id, label } | null (och tänder mätaren)
//   L.move(wx, wy)        – samma som hover (flyttar också spöket vid utplacering)
//   L.key(k)              – 'Escape' avbryter utplacering/bärande → true om det hanterades
//   L.obstacles()         – [[x0, y0, x1, y1], …] för korg/låda/bur/klösträd (för walkern)
//   L.openInventory()     – dialogen "Djurprylar": ställ ut, flytta, plocka upp (t.ex. från en knapp)
//   L.startPlacing(k) · L.startMoving(itemId) · L.cancel()
//   L.autoPlace()         – ställer ut köpta prylar som saknas i hemmet (görs automatiskt när lagret
//                           skapas om hemmet har djur; opts.autoPlace = false stänger av)
//   L.exit()              – när scenen lämnas (släpper live-läget, lyssnaren och A.carrying)
//   L.invalidate()        – scenens gångbarhet (isFree) har ändrats, t.ex. en möbel flyttades:
//                           djurens vägnät byggs om, och ett djur som nu står i en möbel
//                           kliver ut till närmaste lediga plats
//   L.placing             – true medan en pryl hålls i handen (spöket; nästa klick ställer den)
//   L.itemAt(wx, wy)      – { id, k } för prylen under pekaren (även med ett djur i den) | null
//   L.version             – räknas upp när prylarnas hinder ändras
//   L._debug              – { actors, spot(petId|itemId|k|'bajs') → {x,y} (logiska px), pets(), items(),
//                             meters() (skyltarnas lägen), think(id), goTo(id, x, y, run),
//                             setMode(id, 'sleep'|'eat'|'toilet'|…) }
//   Lagret kopplar också spelklockan till butiken (store.setClock) så att djuraffärens adopt()
//   alltid får rätt födelsedag, och visar butikens händelser som toasts ('kar', 'ungar', 'vaxte',
//   'bajs', 'kiss', 'lada', 'hungrig', 'ute', 'hem' = djuret gick hem självt efter 6 h ute).
//   Mätaren: hjärta (glad), skål (mätt) och för hund bajs (kissnödig) ovanför varje djur –
//   nedtonad på avstånd, tydlig nära/hover, blinkar röd ram vid kris. Skyltar som krockar
//   glider isär i sidled, högst en skylthöjd upp, annars under fötterna – aldrig i torn.
//
// const F = createPetFollower(A, pet);   // pet = ett djur ur petStore().walking()
//   F.update(dt, ownerX, ownerY, isFree?) · F.drawable() → { x, y, fy, draw(ctx) } · F.x · F.y
//   Hunden går i koppel (mjukt, hänger lite) snett framför ägaren på sidan närmast
//   betraktaren; katt/kanin trippar efter utan koppel. Hunden stannar av sig själv och gör
//   sitt ute (store.outdoorBusiness) – högen ligger kvar en stund.
//
// ---------------------------- Inkoppling ----------------------------
//  Hemmet (room.js har egna px/py/path/walkTo – skicka en adapter med getters):
//      const walker = { get px() { return px; }, get py() { return py; }, get dir() { return dir; },
//                       get path() { return path; }, walkTo, stop() { path = []; onArrive = null; } };
//      const L = createPetLayer(A, { home: A.game.home, room: <rum>, bounds: { left, right, top: WALL_Y + 2, bottom },
//          isFree: <möblerna, UTAN husdjursprylarna>, walker, onObstacles: (o) => <lägg o till rummets hinder> });
//      lägg L.obstacles() till rummets hinder; varje bildruta L.update(dt);
//      rita [...scenens, ...L.drawables()] sorterat på fy; pekare: if (L.down(x, y)) return;
//      mus: L.hover(x, y); tangent: if (L.key(e.key)) return; när scenen lämnas: L.exit().
//      Kommer man hem från staden: petStore().walkEnd() (tar av kopplet, räknar promenaden) –
//      gärna också vid jobbstart och läggdags (annars går djuret hem självt efter 6 speltimmar).
//  Nytt spel: petStore().reset() när spelaren börjar om. (Butiken upptäcker det också själv:
//      spelsparfilen saknas, eller spelklockan går tillbaka mer än två timmar → det gamla läggs
//      undan under snabbfilen_pets1_undanlagd_<tid>.)
//  Staden: för varje p i petStore().walking(): F = createPetFollower(A, p); varje bildruta
//      F.update(dt, walker.px, walker.py, (x, y) => walker.walkable(x, y)); rita F.drawable().
//  Klockan: petStore().syncTo(A.game.day, A.game.min, { home: A.game.home, playerHome: <hemma ? hem : null>,
//      playerRoom, outdoors: <i staden> }) gärna varje bildruta i huvudloopen – lagret gör det
//      själv hemma, och missade minuter tickas ikapp vid nästa anrop (högst 3 dygn).
// ==================================================================
import { petStore, PET_RULES } from './sim.js';
import { PET_ITEMS, drawPetItem, itemBox, itemSolid, itemSpot, drawItemIcon, splitItem } from './items.js';
import * as SP from './sprites.js';
import { openModal, closeModal, toast, esc, modalOpen } from '../core/ui.js';
import { play } from '../core/sound.js';

// Spritemodulen importeras som namnrymd: kontraktet (drawPet, drawPetIcon, petSize, drawPoop,
// drawPuddle, SPECIES) krävs, resten (petBox, petNeck, breedOf, ICON_W/H) används om de finns.
const { drawPet, drawPetIcon, drawPoop, drawPuddle, SPECIES } = SP;
const ICON_W = SP.ICON_W || 24, ICON_H = SP.ICON_H || 20;
function petBox(p, anim = 'idle', dir = 'down') {
  if (SP.petBox) return SP.petBox(p, anim, dir);
  const z = SP.petSize ? SP.petSize(p) : { w: 12, h: 10 };
  const w = dir === 'left' || dir === 'right' ? z.w : Math.max(6, Math.round(z.w * 0.6));
  return { x0: -(w >> 1), y0: -z.h, x1: w - (w >> 1), y1: 1 };
}
function petNeck(p, anim, t, dir = 'down') {
  if (SP.petNeck) return SP.petNeck(p, anim, t, dir);
  const b = petBox(p, anim, dir);
  return { x: dir === 'left' ? b.x0 + 3 : dir === 'right' ? b.x1 - 3 : 0, y: Math.round(b.y0 * 0.55) };
}
function breedOf(p) {
  if (SP.breedOf) return SP.breedOf(p);
  const S = SPECIES?.[p?.species];
  return S?.breeds?.find((b) => b.id === p?.breed) || S?.breeds?.[0] || null;
}

const TOP = 10000;              // sorteringsnyckel för saker som alltid ligger överst
const ACC = 95;                 // px/s² (mjuk start/stopp)
const MOVE_ON = 2, MOVE_OFF = 0.5;
const DIR_HOLD = 0.3;
const STATE_HOLD = 0.25;
const SPD = { katt: [15, 42], hund: [19, 50], kanin: [12, 30] };
const EMO = { kar: '❤️', ungar: '🍼', vaxte: '🌱', bajs: '💩', kiss: '💦', lada: '🧻', hungrig: '🍽️', ute: '🌳', hem: '🏠' };
const GOOD = new Set(['kar', 'ungar', 'vaxte', 'ute']);
const rnd = Math.random;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function dirFrom(vx, vy, cur) {
  const ax = Math.abs(vx), ay = Math.abs(vy);
  const horizNow = cur === 'left' || cur === 'right';
  const horiz = horizNow ? !(ay > ax * 1.35) : ax > ay * 1.35;
  return horiz ? (vx < 0 ? 'left' : 'right') : (vy < 0 ? 'up' : 'down');
}
const facing = (fx, fy, tx, ty) => dirFrom(tx - fx, (ty - fy) * 1.2, Math.abs(tx - fx) > Math.abs(ty - fy) ? 'left' : 'up');
const speciesWord = (p) => {
  const S = SPECIES[p.species];
  return p.stage === 'unge' ? S?.unge || p.species : p.stage === 'ung' ? S?.ung || p.species : S?.vuxen || p.species;
};
const sexSign = (p) => (p.sex === 'hona' ? '♀' : '♂');

// Gemensam rörelsemotor för djuren (rummet) och följaren (staden)
function stepMotion(a, dt, dvx, dvy, free, acc = ACC) {
  let ex = dvx - a.vx, ey = dvy - a.vy;
  const el = Math.hypot(ex, ey), lim = acc * dt;
  if (el > lim) { ex = ex / el * lim; ey = ey / el * lim; }
  a.vx += ex; a.vy += ey;
  if (!dvx && !dvy && Math.hypot(a.vx, a.vy) < 0.3) { a.vx = 0; a.vy = 0; }
  const nx = a.x + a.vx * dt, ny = a.y + a.vy * dt;
  let moved = true;
  if (free(nx, ny)) { a.x = nx; a.y = ny; }
  else if (Math.abs(a.vx) > 0.05 && free(nx, a.y)) { a.x = nx; a.vy *= 0.6; }
  else if (Math.abs(a.vy) > 0.05 && free(a.x, ny)) { a.y = ny; a.vx *= 0.6; }
  else { a.vx *= 0.3; a.vy *= 0.3; moved = false; }
  const sp = Math.hypot(a.vx, a.vy);
  // hysteres + minsta tid i varje läge: stå ↔ gå (och gå ↔ springa) växlar aldrig
  // tätare än STATE_HOLD – ett tydligt ryck igång (sp > 6) får starta lite tidigare
  a.stateAge = (a.stateAge ?? 1) + dt;
  a.runAge = (a.runAge ?? 1) + dt;
  if (!a.moving && sp > MOVE_ON && (a.stateAge >= STATE_HOLD || (sp > 6 && a.stateAge >= 0.18))) { a.moving = true; a.stateAge = 0; }
  else if (a.moving && sp < MOVE_OFF && a.stateAge >= STATE_HOLD) { a.moving = false; a.stateAge = 0; }
  const run = a.moving && (a.running ? sp > a.walkSp * 1.25 : sp > a.walkSp * 1.6);
  if (run !== !!a.running && (a.runAge >= STATE_HOLD || !a.moving)) { a.running = run; a.runAge = 0; }
  a.dirAge += dt;
  if (a.moving && sp > 1.5) {
    const want = dirFrom(a.vx, a.vy, a.dir);
    if (want !== a.dir) {
      a.wantT = a.want === want ? a.wantT + dt : 0;
      a.want = want;
      // tillbaka till riktningen man nyss hade? då krävs längre tid (inget fram-och-tillbaka)
      const back = want === a.prevDir && a.dirAge < 0.8;
      if (a.dirAge >= (back ? 0.6 : DIR_HOLD) && a.wantT >= (back ? 0.25 : 0.08)) { a.prevDir = a.dir; a.dir = want; a.dirAge = 0; a.wantT = 0; }
    } else a.wantT = 0;
  } else if (!a.moving && sp < 1 && a.face && a.face !== a.dir && a.dirAge >= DIR_HOLD) { a.prevDir = a.dir; a.dir = a.face; a.dirAge = 0; }
  a.phase += dt * (a.moving ? clamp(sp / (a.running ? a.runSp : a.walkSp), 0.5, 1.4) : 1);
  return moved;
}

// ======================================================================
//  Rummet
// ======================================================================
export function createPetLayer(A, opts = {}) {
  const store = opts.store || petStore();
  // spelklockan kopplas till butiken så att adopt() (butiken) alltid vet vilken dag det är,
  // även när lagret inte är igång
  if (opts.sync !== false && A.game && store.setClock) store.setClock(() => ({ day: A.game.day, min: A.game.min }));
  const home = opts.home ?? A.game?.home ?? null;
  const room = opts.room ?? null;
  const B = { left: 8, right: 376, top: 92, bottom: 212, ...(opts.bounds || {}) };
  const sceneFree = opts.isFree || (() => true);
  const walker = opts.walker || null;
  const actors = new Map();
  const fx = [];
  const ballV = new Map();
  let t = 0, version = 0, mouse = { x: -99, y: -99 }, hover = null;
  let placing = null, gridV = -1, grid = null, lastSync = 0, menuFor = null;
  let begToastAt = -99, wasWalking = false;
  const toastSeen = new Map();

  const G = { CELL: 4 };
  G.W = Math.ceil((opts.W || 384) / G.CELL); G.H = Math.ceil((opts.H || 216) / G.CELL);

  const hourNow = () => (A.game ? (A.game.min / 60) % 24 : opts.hour ?? 12);
  const isNight = () => { const h = hourNow(); return h >= 22 || h < 7; };
  const items = () => store.itemsIn(home, room);
  const messes = () => store.messesIn(home, room);
  const playerHere = () => !!walker && walker.px != null;
  const px = () => walker?.px ?? -999, py = () => walker?.py ?? -999;

  // ---------- gångbarhet ----------
  function itemRect(it, pad = 0) {
    const s = itemSolid(it.k);
    return s ? [it.x + s.x0 - pad, it.y + s.y0 - pad, it.x + s.x1 + pad, it.y + s.y1 + pad] : null;
  }
  function inRect(r, x, y) { return r && x >= r[0] && x < r[2] && y >= r[1] && y < r[3]; }
  // Djuren: scenens möbler + våra solida prylar (utom den prylen djuret är på väg in i/ligger i)
  function petFree(x, y, allow) {
    if (x < B.left || x > B.right || y < B.top || y > B.bottom) return false;
    for (const it of items()) {
      const r = itemRect(it);
      if (!r || !inRect(r, x, y)) continue;
      return it.id === allow;
    }
    return !!sceneFree(x, y);
  }
  function buildGrid() {
    grid = new Uint8Array(G.W * G.H);
    for (let gy = 0; gy < G.H; gy++) for (let gx = 0; gx < G.W; gx++) {
      const x = gx * G.CELL + 2, y = gy * G.CELL + 2;
      grid[gy * G.W + gx] = petFree(x, y, null) && petFree(x - 2, y, null) && petFree(x + 2, y, null) ? 1 : 0;
    }
    gridV = version;
  }
  const cellFree = (gx, gy) => gx >= 0 && gy >= 0 && gx < G.W && gy < G.H && grid[gy * G.W + gx] === 1;
  function los(ax, ay, bx, by, allow) {
    const n = Math.ceil(Math.hypot(bx - ax, by - ay) / 2);
    for (let i = 1; i < n; i++) if (!petFree(ax + (bx - ax) * i / n, ay + (by - ay) * i / n, allow)) return false;
    return true;
  }
  function nearestFreePt(x, y) {
    if (petFree(x, y, null)) return [x, y];
    for (let r = 1; r < 30; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
      const nx = x + dx * 3, ny = y + dy * 3;
      if (petFree(nx, ny, null)) return [nx, ny];
    }
    return [clamp(x, B.left + 4, B.right - 4), clamp(y, B.top + 4, B.bottom - 4)];
  }
  function findPath(sx, sy, tx, ty, allow) {
    if (gridV !== version || !grid) buildGrid();
    if (los(sx, sy, tx, ty, allow)) return [[tx, ty]];
    const C = G.CELL, cell = (x, y) => [clamp((x / C) | 0, 0, G.W - 1), clamp((y / C) | 0, 0, G.H - 1)];
    let [s0, s1] = cell(sx, sy);
    const [ex, ey] = allow ? nearestFreePt(tx, ty) : [tx, ty];
    let [t0, t1] = cell(...nearestFreePt(ex, ey));
    const start = s1 * G.W + s0, goal = t1 * G.W + t0;
    const from = new Map([[start, -1]]), q = [start];
    for (let qi = 0; qi < q.length; qi++) {
      const cur = q[qi];
      if (cur === goal) break;
      const cx = cur % G.W, cy = (cur / G.W) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        const nx = cx + dx, ny = cy + dy, ni = ny * G.W + nx;
        if (!cellFree(nx, ny) || from.has(ni)) continue;
        if (dx && dy && (!cellFree(nx, cy) || !cellFree(cx, ny))) continue;
        from.set(ni, cur); q.push(ni);
      }
    }
    if (!from.has(goal)) return [];
    const cells = [];
    for (let i = goal; i !== -1; i = from.get(i)) cells.push([(i % G.W) * C + 2, ((i / G.W) | 0) * C + 2]);
    cells.reverse();
    cells.push([tx, ty]);
    const out = [];
    let ax = sx, ay = sy, i = 0;
    while (i < cells.length) {
      let j = cells.length - 1;
      while (j > i && !los(ax, ay, cells[j][0], cells[j][1], allow)) j--;
      out.push(cells[j]); [ax, ay] = cells[j]; i = j + 1;
    }
    return out;
  }

  // ---------- aktörer ----------
  function makeActor(p) {
    const sp = SPD[p.species] || SPD.katt;
    const size = Math.abs(petBox(p, 'idle', 'down').y0 || 10);
    const k = (p.species === 'hund' ? clamp(size / 14, 0.75, 1.15) : 1) * (p.stage === 'unge' ? 0.8 : p.stage === 'ung' ? 0.92 : 1);
    let x = p.x, y = p.y;
    let inItem = null;
    if (x == null || y == null || !isFinite(x) || !isFinite(y)) {
      const bx = playerHere() ? px() + (rnd() - 0.5) * 30 : 60 + rnd() * (B.right - 120);
      const by = playerHere() ? py() + 6 + rnd() * 8 : B.top + 30 + rnd() * 50;
      [x, y] = nearestFreePt(bx, by);
    } else {
      inItem = items().find((it) => inRect(itemRect(it), x, y)) || null;
      if (!inItem && !petFree(x, y, null)) [x, y] = nearestFreePt(x, y);
    }
    const a = {
      id: p.id, pet: p, x, y, vx: 0, vy: 0, z: 0, dir: rnd() < 0.5 ? 'left' : 'right', face: null, dirAge: 1, want: null, wantT: 0,
      moving: false, running: false, phase: rnd() * 10, walkSp: sp[0] * k, runSp: sp[1] * k, speed: sp[0] * k,
      path: [], then: null, allow: inItem?.id || null, inItem: inItem?.id || null, mode: 'idle', pose: 'idle', modeT: 0.5 + rnd() * 2,
      onEnd: null, stuck: 0, walkT: 0, alpha: 0.45, follow: { on: false, t: 0 }, elev: null, tag: null, seenAt: t,
    };
    if (inItem && PET_ITEMS[inItem.k]?.sangFor === p.species && isNight()) { a.mode = 'sleep'; a.pose = 'sleep'; a.modeT = 5; }
    return a;
  }
  function syncActors() {
    const want = new Set();
    for (const p of store.pets) {
      if (p.home !== home) continue;
      if (p.out || p.room === room || p.room == null) {
        if (p.room == null && !p.out) { p.room = room; p.x = null; p.y = null; }
        want.add(p.id);
        if (!actors.has(p.id)) actors.set(p.id, makeActor(p));
        else actors.get(p.id).pet = p;
      }
    }
    for (const id of [...actors.keys()]) if (!want.has(id)) actors.delete(id);
  }

  function go(a, x, y, { run = false, allow = null, then = null, face = null } = {}) {
    a.allow = allow || (a.inItem && inRect(itemRect(store.itemById(a.inItem) || {}), a.x, a.y) ? a.inItem : null);
    a.path = findPath(a.x, a.y, x, y, a.allow);
    a.speed = run ? a.runSp : a.walkSp;
    a.then = then; a.face = face; a.mode = 'walk'; a.walkT = 0; a.stuck = 0;
    if (!a.path.length) { a.mode = 'idle'; a.pose = 'idle'; a.modeT = 1 + rnd(); a.then = null; return false; }
    return true;
  }
  function setPose(a, pose, dur, onEnd = null, face = null) {
    a.path = []; a.mode = 'pose'; a.pose = pose; a.modeT = dur; a.onEnd = onEnd; if (face) a.face = face;
  }
  const others = (a) => [...actors.values()].filter((b) => b !== a);

  // ---------- beslut ----------
  function pickBowl(a) {
    const p = a.pet, desperate = p.hunger < 25;
    const bowls = items().filter((i) => i.k === 'matskal' && i.food > 0.02 && (!i.foodKind || i.foodKind === p.species || desperate));
    bowls.sort((b1, b2) => Math.hypot(b1.x - a.x, b1.y - a.y) - Math.hypot(b2.x - a.x, b2.y - a.y));
    return bowls[0] || null;
  }
  function bowlSlot(a, b) {
    const slots = [[0, 5, 'up'], [-8, 1, 'right'], [8, 1, 'left']];
    const taken = others(a).filter((o) => o.tag === 'bowl:' + b.id).map((o) => o.slot);
    const i = slots.findIndex((s, k) => !taken.includes(k));
    if (i < 0) return null;
    const [dx, dy, face] = slots[i];
    return { x: b.x + dx, y: b.y + dy, face, i };
  }
  function goEat(a, b) {
    const s = bowlSlot(a, b);
    if (!s) return false;
    a.tag = 'bowl:' + b.id; a.slot = s.i;
    return go(a, s.x, s.y, { run: a.pet.hunger < 25, face: s.face, then: () => {
      setPose(a, 'eat', 3 + rnd() * 2, () => {
        const got = store.feedDirect(a.pet.id, b.id);
        a.tag = null;
        if (got > 0) spark(b.x, b.y - 6, 'crumbs');
      }, s.face);
    } });
  }
  function goToilet(a) {
    const p = a.pet;
    const box = p.species === 'katt' ? items().find((i) => i.k === 'kattlada' && i.dirt < 1)
      : p.species === 'kanin' ? items().find((i) => i.k === 'kaninbur' && i.dirt < 1) : null;
    const kind = p.species === 'hund' ? (p.lastMess === 'bajs' ? 'pee' : 'poop') : 'poop';
    const doIt = (it) => setPose(a, kind, 2.4, () => {
      const back = { left: 4, right: -4, up: 0, down: 0 }[a.dir] || 0;
      store.petToilet(p.id, it ? { itemId: it.id } : { x: a.x + back, y: a.y + (a.dir === 'up' ? 3 : a.dir === 'down' ? -2 : 0) });
      p.urge = false;
      if (!it && p.species === 'hund') a.guilty = 4; // hunden ser skamsen ut en stund
    }, a.dir);
    if (box) {
      const sp = itemSpot(box.k);
      return go(a, box.x + sp.dx, box.y + sp.dy, { allow: box.id, face: 'down', then: () => { a.inItem = box.id; doIt(box); } });
    }
    // på golvet: gå några steg till en "lagom undanskymd" plats först
    const [x, y] = nearestFreePt(a.x + (rnd() - 0.5) * 30, a.y + (rnd() - 0.5) * 14);
    return go(a, x, y, { then: () => doIt(null) }) || (doIt(null), true);
  }
  function goSleep(a, nap = false) {
    const p = a.pet;
    const beds = items().filter((i) => PET_ITEMS[i.k]?.sangFor === p.species);
    const tree = p.species === 'katt' ? items().find((i) => i.k === 'kattklostrad') : null;
    // upptagna/reserverade platser (claim sätts när djuret bestämmer sig, inte först när det är framme)
    const used = new Set(others(a).flatMap((o) => [o.inItem, o.claim, o.elev]).filter(Boolean));
    const bed = beds.find((b) => !used.has(b.id)) || beds.find(() => p.species === 'kanin' || p.stage === 'unge');
    const dur = nap ? 6 + rnd() * 10 : 8 + rnd() * 6;
    if (tree && !used.has(tree.id) && !(t < (a.treeCool || 0)) && (!bed || rnd() < 0.4)) {
      const sp = itemSpot(tree.k);
      a.claim = tree.id;
      return go(a, tree.x + sp.dx, tree.y + sp.dy, { face: 'up', then: () => jump(a, tree, true, () => setPose(a, 'sleep', dur, null)) });
    }
    if (bed) {
      const sp = itemSpot(bed.k);
      const shared = used.has(bed.id);
      const jig = p.species === 'kanin' ? (rnd() - 0.5) * 14 : shared ? (rnd() < 0.5 ? -4 : 4) : 0;
      const side = rnd() < 0.5 ? 'left' : 'right'; // hoprullad från sidan ser bäst ut i korgen
      a.claim = bed.id;
      return go(a, bed.x + sp.dx + jig, bed.y + sp.dy, { allow: bed.id, face: side, then: () => { a.inItem = bed.id; setPose(a, 'sleep', dur, null, side); } });
    }
    // ingen ledig säng: rulla ihop sig på golvet en bit bort från skålar och lådor
    const side = rnd() < 0.5 ? 'left' : 'right';
    for (let k = 0; k < 6; k++) {
      const [x, y] = nearestFreePt(a.x + (rnd() - 0.5) * 70, a.y + (rnd() - 0.5) * 30);
      if (items().some((i) => Math.abs(i.x - x) < 16 && Math.abs(i.y - y) < 10)) continue;
      if (go(a, x, y, { face: side, then: () => setPose(a, 'sleep', dur, null, side) })) return true;
    }
    setPose(a, 'sleep', dur, null, side);
    return true;
  }
  // klösträdet: hoppa upp i toppskålen / ner igen (höjd z, kontinuerligt)
  function jump(a, tree, up, then) {
    a.path = []; a.mode = 'jump';
    const fromZ = a.z, toZ = up ? 26 : 0;
    const fromX = a.x, fromY = a.y;
    const sp = itemSpot(tree.k);
    const toX = up ? tree.x + 3 : tree.x + sp.dx, toY = up ? tree.y - 3 : tree.y + sp.dy;
    a.jumpT = 0; a.inItem = tree.id; a.allow = tree.id;
    a.jump = { fromZ, toZ, fromX, fromY, toX, toY, dur: 0.45, then: () => { a.elev = up ? tree.id : null; if (!up) { a.inItem = null; } then?.(); } };
    a.pose = 'run'; a.face = up ? 'left' : 'down';
  }
  function tryPlay(a) {
    const p = a.pet;
    const ball = items().find((i) => i.k === 'leksak-boll');
    const bone = items().find((i) => i.k === 'leksak-ben');
    const tree = items().find((i) => i.k === 'kattklostrad');
    const buddies = others(a).filter((o) => o.pet.species === p.species && !o.pet.out && ['idle', 'walk'].includes(o.mode) && o.pose !== 'sleep');
    const opts2 = [];
    if (ball && p.species !== 'kanin') opts2.push(() => go(a, ball.x - 5, ball.y + 1, { run: true, then: () => { kick(a, ball); setPose(a, 'play', 1.4); } }));
    if (bone && p.species === 'hund') opts2.push(() => go(a, bone.x, bone.y + 3, { face: 'up', then: () => setPose(a, 'eat', 4 + rnd() * 3, null, 'up') }));
    if (tree && p.species === 'katt') opts2.push(() => go(a, tree.x + itemSpot(tree.k).dx, tree.y + itemSpot(tree.k).dy, { face: 'up', then: () => setPose(a, 'play', 2.5, null, 'up') }));
    if (buddies.length) opts2.push(() => chase(a, buddies[Math.floor(rnd() * buddies.length)]));
    if (!opts2.length) return false;
    return opts2[Math.floor(rnd() * opts2.length)]();
  }
  function chase(a, b) {
    // b springer iväg, a jagar – sedan leker de ansikte mot ansikte
    const ang = rnd() * Math.PI * 2;
    const [fx2, fy2] = nearestFreePt(b.x + Math.cos(ang) * 40, b.y + Math.sin(ang) * 18);
    if (!go(b, fx2, fy2, { run: true, then: () => setPose(b, 'play', 2 + rnd(), null) })) return false;
    b.speed = b.runSp * 0.8;
    a.mode = 'chase'; a.target = b; a.modeT = 3.5; a.path = []; a.speed = a.runSp; a.repath = 0;
    return true;
  }
  function kick(a, ball) {
    const d = { left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1] }[a.dir] || [1, 0];
    const s = 30 + rnd() * 30;
    ballV.set(ball.id, { vx: d[0] * s + (rnd() - 0.5) * 20, vy: d[1] * s * 0.6 + (rnd() - 0.5) * 12, rot: 0 });
  }
  function visitPlayer(a, pose = 'sit') {
    const side = a.x < px() ? -1 : 1;
    const [x, y] = nearestFreePt(px() + side * (9 + rnd() * 6), py() + 2 + rnd() * 4);
    return go(a, x, y, { then: () => {
      const f = facing(a.x, a.y, px(), py() - 4);
      if (a.pet.species === 'hund' && pose === 'sit') setPose(a, 'happy', 1.6, () => setPose(a, 'sit', 2 + rnd() * 3, null, f), f);
      else setPose(a, pose, pose === 'beg' ? 3 : 2.5 + rnd() * 3, null, f);
    } });
  }
  function wander(a) {
    for (let k = 0; k < 6; k++) {
      const ang = rnd() * Math.PI * 2, r = 25 + rnd() * 50;
      const x = clamp(a.x + Math.cos(ang) * r, B.left + 6, B.right - 6), y = clamp(a.y + Math.sin(ang) * r * 0.55, B.top + 4, B.bottom - 3);
      if (petFree(x, y, null) && go(a, x, y)) return true;
    }
    setPose(a, 'idle', 1.5 + rnd() * 2);
    return true;
  }
  function think(a) {
    const p = a.pet;
    a.then = null; a.onEnd = null; a.tag = null; a.face = null; a.claim = null;
    if (a.elev) { const tree = store.itemById(a.elev); a.treeCool = t + 25; if (tree) { jump(a, tree, false, () => { a.mode = 'idle'; a.pose = 'idle'; a.modeT = 0.6 + rnd() * 0.8; }); return; } a.elev = null; a.z = 0; }
    if (a.inItem && !a.path.length) a.allow = a.inItem; // kliv ur korgen/buren
    if (p.out) { a.mode = 'follow'; a.follow.on = false; return; }
    if (p.urge || p.toilet >= 100) { goToilet(a); return; }
    const R = PET_RULES[p.species];
    if (p.hunger < R.eatBelow) {
      const b = pickBowl(a);
      if (b && goEat(a, b)) return;
      if (p.hunger < 35 && playerHere() && t - (a.begAt ?? -99) > 6) {
        a.begAt = t;
        if (t - begToastAt > 25 && opts.toasts !== false) { begToastAt = t; toast(`🍽️ ${p.name} tigger mat – fyll skålen!`); }
        visitPlayer(a, 'beg'); return;
      }
    }
    if (isNight()) { goSleep(a); return; }
    if (p.following && playerHere()) { a.mode = 'follow'; a.follow.on = false; return; }
    const r = rnd();
    const lover = p.lover ? actors.get(p.lover) : null;
    const young = p.stage !== 'vuxen';
    if (lover && !lover.pet.out && r < 0.14 && lover.pose !== 'sleep') {
      const side = a.x < lover.x ? -8 : 8;
      if (go(a, lover.x + side, lover.y + 1, { then: () => {
        const f = a.x < lover.x ? 'right' : 'left';
        setPose(a, 'love', 3, null, f);
        if (['idle', 'pose'].includes(lover.mode) && lover.pose !== 'eat') setPose(lover, 'love', 3, null, f === 'right' ? 'left' : 'right');
      } })) return;
    }
    if (r < (young ? 0.42 : 0.26) && tryPlay(a)) return;
    if (r < 0.44 && playerHere() && Math.hypot(px() - a.x, py() - a.y) < 110 && rnd() < 0.5) { visitPlayer(a); return; }
    if (p.species === 'katt' && r < 0.6 && rnd() < 0.45) { goSleep(a, true); return; }
    if (p.species === 'kanin' && r < 0.55 && rnd() < 0.35) { goSleep(a, true); return; }
    if (r < 0.72) { setPose(a, rnd() < 0.55 ? 'sit' : 'idle', 2 + rnd() * 4); return; }
    wander(a);
  }

  // ---------- per bildruta ----------
  function updActor(a, dt) {
    const p = a.pet;
    a.seenAt = t;
    if (a.guilty > 0) a.guilty -= dt;
    // hopp (klösträdet)
    if (a.mode === 'jump') {
      const J = a.jump;
      a.jumpT += dt;
      const k = clamp(a.jumpT / J.dur, 0, 1), e = k * k * (3 - 2 * k);
      a.x = J.fromX + (J.toX - J.fromX) * e; a.y = J.fromY + (J.toY - J.fromY) * e;
      a.z = J.fromZ + (J.toZ - J.fromZ) * e + Math.sin(k * Math.PI) * 6;
      a.vx = 0; a.vy = 0; a.moving = false; a.phase += dt;
      if (k >= 1) { a.z = J.toZ; a.stateAge = 0; a.mode = 'idle'; a.pose = 'idle'; a.modeT = 0.4; const th = J.then; a.jump = null; th?.(); }
      return;
    }
    // behov som avbryter (inte mitt i ett toalettbesök/hopp)
    if ((p.urge || p.toilet >= 100) && !['toilet'].includes(a.tag) && !(a.mode === 'pose' && (a.pose === 'poop' || a.pose === 'pee')) && a.mode !== 'wait') {
      if (a.mode !== 'walk' || a.tag !== 'toilet') { a.tag = 'toilet'; if (a.elev) think(a); else goToilet(a); a.tag = 'toilet'; }
    }
    if (p.out && a.mode !== 'follow' && a.mode !== 'wait') { a.mode = 'follow'; a.follow.on = false; a.path = []; }

    let dvx = 0, dvy = 0;
    if (a.mode === 'walk') {
      a.walkT += dt;
      if (a.path.length) {
        const [tx, ty] = a.path[0];
        const dx = tx - a.x, dy = ty - a.y, d = Math.hypot(dx, dy), last = a.path.length === 1;
        if (d < (last ? 0.8 : 2.5)) {
          a.path.shift();
          if (!a.path.length) { const th = a.then; a.then = null; a.mode = 'idle'; a.pose = 'idle'; a.modeT = 0.8 + rnd(); if (th) th(); }
        } else {
          const sp = last ? Math.min(a.speed, Math.max(5, d * 2.4)) : a.speed;
          dvx = dx / d * sp; dvy = dy / d * sp;
        }
      }
      if (a.walkT > 14 || a.stuck > 1.4) { a.path = []; a.then = null; a.tag = null; a.mode = 'idle'; a.modeT = 0.5; }
    } else if (a.mode === 'follow') {
      const leash = p.out && p.species === 'hund';
      if (a.followT > 0) a.followT -= dt;
      if (!p.out && !p.following && !(a.followT > 0)) { a.followT = 0; a.mode = 'idle'; a.modeT = 0.5 + rnd(); }
      else {
        const idx = [...actors.keys()].indexOf(a.id);
        const side = idx % 2 ? 1 : -1;
        const tx = px() + side * (8 + (idx >> 1) * 5), ty = py() + 3;
        const d = Math.hypot(tx - a.x, ty - a.y);
        const on = leash ? 14 : 22, off = leash ? 7 : 10;
        if (!a.follow.on && d > on) { a.follow.on = true; a.follow.re = 0; }
        if (a.follow.on) {
          a.follow.re -= dt;
          if (a.follow.re <= 0 || !a.path.length) { a.path = findPath(a.x, a.y, tx, ty, a.allow); a.follow.re = 0.45; }
          const sp = d > 40 ? a.runSp : Math.max(a.walkSp, Math.min(a.runSp, d * 1.6));
          if (a.path.length) {
            const [wx, wy] = a.path[0], ddx = wx - a.x, ddy = wy - a.y, dd = Math.hypot(ddx, ddy);
            if (dd < 2 && a.path.length > 1) a.path.shift();
            else if (dd > 0.01) { dvx = ddx / dd * sp; dvy = ddy / dd * sp; }
          }
          if (d < off) { a.follow.on = false; a.path = []; a.follow.still = 0; }
        } else {
          a.follow.still = (a.follow.still || 0) + dt;
          a.face = facing(a.x, a.y, px(), py() - 4);
          a.pose = a.follow.still > 1.2 ? 'sit' : 'idle';
        }
        // kopplet: hunden dras med om husse går för långt
        if (leash) {
          const ox = px() - a.x, oy = py() - a.y, od = Math.hypot(ox, oy);
          if (od > 26) { const k = (od - 26) / od; a.x += ox * k; a.y += oy * k; }
        }
      }
    } else if (a.mode === 'chase') {
      const b = a.target;
      a.modeT -= dt; a.repath -= dt;
      if (!b || !actors.has(b.id) || a.modeT <= 0) { a.mode = 'idle'; a.modeT = 0.3; }
      else {
        const d = Math.hypot(b.x - a.x, b.y - a.y);
        if (d < 9) {
          const f = facing(a.x, a.y, b.x, b.y);
          setPose(a, 'play', 2 + rnd(), null, f);
          if (b.mode !== 'jump') setPose(b, 'play', 2 + rnd(), null, f === 'left' ? 'right' : f === 'right' ? 'left' : f === 'up' ? 'down' : 'up');
        } else {
          if (a.repath <= 0 || !a.path.length) { a.path = findPath(a.x, a.y, b.x, b.y, null); a.repath = 0.35; }
          if (a.path.length) {
            const [wx, wy] = a.path[0], ddx = wx - a.x, ddy = wy - a.y, dd = Math.hypot(ddx, ddy);
            if (dd < 2 && a.path.length > 1) a.path.shift(); else if (dd > 0.01) { dvx = ddx / dd * a.runSp; dvy = ddy / dd * a.runSp; }
          }
        }
      }
    } else if (a.mode === 'wait') {
      a.face = facing(a.x, a.y, px(), py() - 4);
      a.pose = 'idle';
      a.modeT -= dt;
      if (a.modeT <= 0 && menuFor !== a.id) { a.mode = 'idle'; a.modeT = 0.4; }
    } else {
      // 'idle' / 'pose'
      a.modeT -= dt;
      if (a.pose === 'sleep') {
        // sover till morgonen på natten (vaknar om man klappar)
        if (isNight() && a.modeT <= 0 && !(p.hunger < 20) && !p.urge) a.modeT = 4;
      }
      if (a.mode === 'idle' && a.pose !== 'sit' && a.pose !== 'idle' && a.pose !== 'sleep') a.pose = 'idle';
      if (a.modeT <= 0) { const cb = a.onEnd; a.onEnd = null; a.mode = 'idle'; if (cb) cb(); if (a.mode === 'idle' && a.modeT <= 0) think(a); }
    }
    const moved = stepMotion(a, dt, dvx, dvy, (x, y) => petFree(x, y, a.allow));
    if ((dvx || dvy) && !moved) a.stuck += dt; else a.stuck = 0;
    // lämnat prylen?
    if (a.inItem && a.mode !== 'pose' && !a.elev) {
      const it = store.itemById(a.inItem);
      if (!it || !inRect(itemRect(it, 1), a.x, a.y)) { a.inItem = null; if (a.mode !== 'walk' || !a.path.length) a.allow = null; }
    }
    if (a.mode === 'walk' && a.moving) a.pose = a.running ? 'run' : 'walk';
  }

  // bollen rullar med friktion och studsar mot hinder
  function updBalls(dt) {
    for (const [id, v] of ballV) {
      const b = store.itemById(id);
      if (!b) { ballV.delete(id); continue; }
      v.fx = (v.fx ?? b.x); v.fy = (v.fy ?? b.y);
      const nx = v.fx + v.vx * dt, ny = v.fy + v.vy * dt;
      if (petFree(nx, v.fy, null)) v.fx = nx; else v.vx *= -0.6;
      if (petFree(v.fx, ny, null)) v.fy = ny; else v.vy *= -0.6;
      const f = Math.pow(0.18, dt);
      v.vx *= f; v.vy *= f;
      v.rot += Math.hypot(v.vx, v.vy) * dt / 2.5;
      b.x = Math.round(v.fx); b.y = Math.round(v.fy);
      if (Math.hypot(v.vx, v.vy) < 1.5) { ballV.delete(id); store.moveItem(id, b.x, b.y); }
    }
  }

  // ---------- effekter ----------
  function spark(x, y, kind) { fx.push({ x, y, kind, t: 0, life: kind === 'pour' ? 0.7 : 0.9 }); }
  function drawFx(ctx) {
    for (const f of fx) {
      const k = f.t / f.life;
      if (f.kind === 'pour' || f.kind === 'crumbs') {
        const cols = ['#c8763a', '#e29a52', '#8a5028'];
        for (let i = 0; i < 5; i++) {
          const ph = (k * 1.6 + i * 0.21) % 1;
          ctx.fillStyle = cols[i % 3];
          ctx.fillRect(Math.round(f.x - 2 + i), Math.round(f.y - 10 + ph * 9), 1, 1);
        }
      } else if (f.kind === 'water') {
        ctx.fillStyle = 'rgba(140,210,245,0.9)';
        for (let i = 0; i < 4; i++) ctx.fillRect(Math.round(f.x - 3 + i * 2), Math.round(f.y - 9 + ((k * 1.8 + i * 0.3) % 1) * 8), 1, 2);
      } else if (f.kind === 'clean') {
        const r = Math.round(2 + k * 6);
        ctx.fillStyle = `rgba(255,255,230,${(1 - k).toFixed(2)})`;
        for (const [dx, dy] of [[r, 0], [-r, 0], [0, -r], [0, r]]) ctx.fillRect(Math.round(f.x + dx), Math.round(f.y - 4 + dy * 0.6), 1, 1);
        ctx.fillRect(Math.round(f.x), Math.round(f.y - 4), 1, 1);
      }
    }
  }

  // ---------- mätaren ----------
  const ICONS = {
    glad: { rows: ['.#.#.', '#####', '.###.', '..#..'], c: '#e8405a', hi: '#ffa0b4' },
    mat: { rows: ['..o..', '.ooo.', '#####', '.###.'], c: '#4a86d8', o: '#d8883a', hi: '#8cc0f4' },
    bajs: { rows: ['..#..', '.##..', '.###.', '#####'], c: '#8a5a2c', hi: '#c08a50' },
  };
  function drawIcon(ctx, key, x, y, flash) {
    const I = ICONS[key];
    I.rows.forEach((r, j) => { for (let i = 0; i < r.length; i++) {
      const ch = r[i];
      if (ch === '.') continue;
      ctx.fillStyle = flash ? '#ffffff' : ch === 'o' ? I.o : I.c;
      ctx.fillRect(x + i, y + j, 1, 1);
    } });
    if (!flash) { ctx.fillStyle = I.hi; ctx.fillRect(x + (key === 'glad' ? 1 : key === 'mat' ? 1 : 2), y + (key === 'mat' ? 2 : 1), 1, 1); }
  }
  // Mätaren: liten mörk skylt med hjärta (glädje), skål (mättnad) och – bara hund – bajs
  // (toalettbehov), var och en med en 5 px stapel. Nedtonad på avstånd, tydlig nära/hover,
  // blinkar rött vid kris. Skyltar som skulle krocka glider isär (mjukt, inga hopp): först i
  // sidled (högst 18 px), sedan högst EN skylthöjd uppåt – aldrig ett torn – och i en tät
  // klunga hellre under djurets fötter (spetsen pekar då uppåt). Får en skylt ändå ingen ren
  // plats ritas den svagare (den hovrade/närmaste vinner).
  const MH = 9, METER_UP = MH + 1, METER_SIDE = 18;
  const METER_CANDS = (() => {
    const c = [[0, 0]];
    for (let d = 2; d <= METER_SIDE; d += 2) c.push([d, 0], [-d, 0]);
    c.push([0, -METER_UP]);
    for (let d = 2; d <= METER_SIDE; d += 2) c.push([d, -METER_UP], [-d, -METER_UP]);
    return c;
  })();
  function meterBase(a) {
    const p = a.pet, n = p.species === 'hund' ? 3 : 2, w = n * 6 + 1;
    if (a.hTop == null || a.hTopStage !== p.stage) { a.hTop = Math.abs(petBox(p, 'idle', 'down').y0 || 10); a.hTopStage = p.stage; }
    return { w, x0: Math.round(a.x) - (w >> 1), y0: Math.round(a.y - a.z) - a.hTop - MH - 3 };
  }
  function layoutMeters(dt) {
    const list = [...actors.values()].map((a) => ({ a, ...meterBase(a) }));
    // den hovrade/öppnade först, sedan den som står närmast betraktaren – de får bästa platsen
    const prio = (m) => ((hover?.kind === 'pet' && hover.id === m.a.id) || menuFor === m.a.id ? 1e6 : 0) + m.a.y;
    list.sort((m1, m2) => prio(m2) - prio(m1));
    // andra djurs kroppar räknas också som hinder – en skylt ska inte täcka grannen
    const bodies = [...actors.values()].map((a) => {
      const b = petBox(a.pet, animOf(a), a.dir), X = Math.round(a.x), Y = Math.round(a.y - a.z);
      return { id: a.id, x0: X + b.x0, x1: X + b.x1, y0: Y + b.y0, y1: Y + b.y1 };
    });
    const placed = [];
    const k = Math.min(1, dt * 7);
    for (const m of list) {
      const a = m.a, ox = a.mOffX || 0, oy = a.mOffY || 0;
      const downDy = a.hTop + MH + 5; // skylten strax under fötterna
      let best = null, bestCost = Infinity;
      const tryCand = (dx, dy, base) => {
        const x0 = m.x0 + dx, y0 = m.y0 + dy;
        if (x0 < B.left - 2 || x0 + m.w > B.right + 2 || y0 + MH > B.bottom + 4) return;
        const hitQ = (q) => q.id !== a.id && x0 < q.x1 + 1 && x0 + m.w > q.x0 - 1 && y0 < q.y1 + 1 && y0 + MH > q.y0 - 1;
        if (placed.some(hitQ)) return;
        // billigast nära hemplatsen – och nära där skylten redan är (ingen växling hit och dit);
        // att skymma en granne kostar mycket men går före att inte få plats alls
        const cost = base + 0.5 * (Math.abs(dx - ox) + Math.abs(dy - oy)) + (bodies.some(hitQ) ? 60 : 0);
        if (cost < bestCost) { bestCost = cost; best = [dx, dy]; }
      };
      for (const [dx, dy] of METER_CANDS) tryCand(dx, dy, Math.abs(dx) + 1.3 * Math.abs(dy));
      tryCand(0, downDy, 16);
      for (let d = 2; d <= METER_SIDE; d += 2) { tryCand(d, downDy, 16 + d * 0.5); tryCand(-d, downDy, 16 + d * 0.5); }
      a.mDim = !best || bestCost >= 60; // ingen ren plats: svagare, så grannen syns igenom
      const [dx, dy] = best || [0, 0];
      placed.push({ id: 'm' + a.id, x0: m.x0 + dx, x1: m.x0 + dx + m.w, y0: m.y0 + dy, y1: m.y0 + dy + MH });
      a.mOffX = ox + (dx - ox) * k; a.mOffY = oy + (dy - oy) * k;
    }
  }
  function meterRect(a) {
    const b = meterBase(a);
    return { x0: b.x0 + Math.round(a.mOffX || 0), y0: b.y0 + Math.round(a.mOffY || 0), w: b.w, h: MH, baseX0: b.x0, baseY0: b.y0 };
  }
  function drawMeter(ctx, a) {
    const p = a.pet, dog = p.species === 'hund';
    const stats = [['glad', p.happy / 100, false], ['mat', p.hunger / 100, false]];
    if (dog) stats.push(['bajs', p.toilet / 100, true]);
    const { x0, y0, w: W, h: H } = meterRect(a);
    const blink = Math.floor(t * 3) % 2 === 0;
    const hov = (hover?.kind === 'pet' && hover.id === a.id) || menuFor === a.id;
    const alpha = a.alpha * (a.mDim && !hov ? 0.55 : 1);
    if (alpha < 0.03) return;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = 'rgba(23,21,26,0.82)';
    ctx.fillRect(x0 + 1, y0, W - 2, H); ctx.fillRect(x0, y0 + 1, W, H - 2);
    // liten spets mot djuret: nedåt (två pixlar när skylten lyfts), uppåt när skylten står under fötterna
    const sx = clamp(Math.round(a.x), x0 + 1, x0 + W - 2);
    if ((a.mOffY || 0) > 3) ctx.fillRect(sx, y0 - 1, 1, 1);
    else ctx.fillRect(sx, y0 + H, 1, (a.mOffY || 0) < -3 ? 2 : 1);
    ctx.fillStyle = 'rgba(255,255,255,0.10)'; ctx.fillRect(x0 + 1, y0, W - 2, 1); // glans i överkanten
    stats.forEach(([key, v, inv], i) => {
      const cx = x0 + 1 + i * 6;
      const bad = inv ? v >= 0.8 : v < 0.3, crit = inv ? v >= 0.92 : v < 0.15;
      drawIcon(ctx, key, cx, y0 + 1, crit && blink);
      const fill = Math.round(clamp(v, 0, 1) * 5);
      ctx.fillStyle = '#3a3440'; ctx.fillRect(cx, y0 + 6, 5, 2);
      ctx.fillStyle = bad ? (crit && blink ? '#ff8080' : '#e04848') : (inv ? v >= 0.5 : v < 0.6) ? '#e8c040' : '#58c46a';
      if (fill) ctx.fillRect(cx, y0 + 6, fill, 2);
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      if (fill) ctx.fillRect(cx, y0 + 6, fill, 1);
    });
    if (stats.some(([, v, inv]) => (inv ? v >= 0.92 : v < 0.15)) && blink) { // röd blinkram vid kris
      ctx.globalAlpha = Math.max(alpha, a.mDim && !hov ? 0.5 : 0.85);
      ctx.fillStyle = '#e04848';
      ctx.fillRect(x0 + 1, y0 - 1, W - 2, 1); ctx.fillRect(x0 + 1, y0 + H, W - 2, 1);
      ctx.fillRect(x0 - 1, y0 + 1, 1, H - 2); ctx.fillRect(x0 + W, y0 + 1, 1, H - 2);
    }
    ctx.globalAlpha = 1;
  }

  // ---------- ritning av ett djur ----------
  function animOf(a) {
    if (a.mode === 'jump') return 'run';
    if (a.moving) return a.running ? 'run' : 'walk';
    const pz = a.pose;
    if (pz === 'walk' || pz === 'run') return 'idle';
    return pz || 'idle';
  }
  function drawActor(ctx, a) {
    const p = a.pet;
    const anim = animOf(a);
    const tt = a.moving ? a.phase : t + (p.seed || 0) % 7;
    drawPet(ctx, Math.round(a.x), Math.round(a.y - a.z), p, anim, tt, a.dir);
    if (p.out && p.species === 'hund' && playerHere()) drawLeashTo(ctx, a, anim);
  }
  function drawLeashTo(ctx, a, anim) {
    const n = petNeck(a.pet, anim, a.phase, a.dir) || { x: 0, y: -8 };
    const wd = walker.dir || 'down';
    const hx = Math.round(px() + (wd === 'right' ? 1 : wd === 'left' ? -2 : -6)), hy = Math.round(py() - 14);
    leash(ctx, hx, hy, Math.round(a.x) + n.x, Math.round(a.y - a.z) + n.y);
  }

  // ---------- klick-träffar ----------
  function actorAt(x, y) {
    const list = [...actors.values()].sort((a, b) => b.y - a.y);
    for (const a of list) {
      const bx = petBox(a.pet, animOf(a), a.dir);
      const X = Math.round(a.x), Y = Math.round(a.y - a.z);
      if (x >= X + bx.x0 - 2 && x <= X + bx.x1 + 2 && y >= Y + bx.y0 - 2 && y <= Y + bx.y1 + 2) return a;
    }
    return null;
  }
  function itemAt(x, y) {
    return items().slice().sort((a, b) => b.y - a.y).find((it) => {
      const b = itemBox(it.k);
      return x >= it.x + b.x0 && x <= it.x + b.x1 && y >= it.y + b.y0 && y <= it.y + b.y1;
    }) || null;
  }
  function messAt(x, y) { return messes().find((m) => Math.abs(m.x - x) <= 6 && y >= m.y - 8 && y <= m.y + 3) || null; }
  // pekar man mitt på högen/pölen går den före djuret (hunden står ofta kvar ovanpå den)
  function messAtTight(x, y) { return messes().find((m) => Math.abs(m.x - x) <= 4 && y >= m.y - 5 && y <= m.y + 2) || null; }

  // Spelaren går fram (om det går) och gör sedan handlingen
  function walkThen(x, y, cb) {
    if (walker?.walkTo) walker.walkTo(x, y, cb);
    else cb();
  }
  const carrying = () => (A.carrying && store.itemById(A.carrying.itemId) ? A.carrying : null);
  function setCarry(it) {
    A.carrying = it ? { k: it.k, itemId: it.id } : null;
  }

  // ---------- handlingar ----------
  function clickPet(a) {
    play('click');
    a.path = []; a.then = null; a.mode = 'wait'; a.modeT = 8; a.follow.on = false;
    const side = px() < a.x ? -1 : 1;
    walkThen(a.x + side * 10, a.y + 2, () => { openPetMenu(a.pet.id); });
  }
  function clickItem(it) {
    const def = PET_ITEMS[it.k], sp = itemSpot(it.k);
    const c = carrying();
    if (def.typ === 'sack') {
      if (c && c.itemId === it.id) { setCarry(null); play('click'); toast('Du ställde tillbaka säcken.'); return; }
      walkThen(it.x, it.y + 5, () => { setCarry(it); play('click'); toast(`🛍️ Du bär ${def.namn.toLowerCase()} – klicka på en matskål för att hälla upp.`); });
      return;
    }
    if (def.typ === 'skal') {
      if (!c) {
        const sacks = items().filter((i) => PET_ITEMS[i.k].typ === 'sack');
        if (sacks.length) { play('fel'); toast('🛍️ Hämta en matsäck först – klicka på säcken, sedan på skålen.'); return; }
        const inv = ['katt', 'hund', 'kanin'].find((s) => (store.inventory['sack-' + s] | 0) > 0 || (store.opened['sack-' + s] | 0) > 0);
        if (!inv) { play('fel'); toast('🛒 Du har ingen djurmat – köp en säck i djuraffären.'); return; }
        const want = store._wantedFood(home, room);
        const k = 'sack-' + ((store.inventory['sack-' + want] | 0) > 0 || (store.opened['sack-' + want] | 0) > 0 ? want : inv);
        const [sx, sy] = nearestFreePt(it.x + 14, it.y);
        const s = store.placeItem(k, home, room, Math.round(sx), Math.round(sy));
        if (s) { version++; opts.onObstacles?.(obstacles()); play('click'); toast(`📦 Du ställde fram en ${PET_ITEMS[k].namn.toLowerCase()} – klicka på säcken och sedan på skålen.`); }
        return;
      }
      walkThen(it.x, it.y + 7, () => {
        const r = store.fillBowl(it.id, { sackId: c.itemId });
        if (!r) { play('fel'); toast(store.lastError); if (store.lastReason !== 'full') setCarry(null); return; }
        play('ok'); spark(it.x, it.y - 2, 'pour');
        setCarry(null);
        toast(r.emptied ? '🥣 Skålen är full – och säcken blev tom.' : '🥣 Skålen är full!', 'good');
      });
      return;
    }
    if (def.typ === 'vatten') {
      walkThen(it.x, it.y + 7, () => {
        const r = store.fillBowl(it.id);
        if (!r) { toast(store.lastError); return; }
        play('ok'); spark(it.x, it.y - 2, 'water'); toast('💧 Friskt vatten!', 'good');
      });
      return;
    }
    if (def.typ === 'lada' || (def.typ === 'bur' && it.dirt > 0.05)) {
      walkThen(it.x, it.y + 5, () => {
        if (store.cleanLitter(it.id)) { play('coin'); spark(it.x, it.y - 4, 'clean'); toast(def.typ === 'bur' ? '🌾 Ny halm i buren!' : '🧻 Kattlådan är tömd!', 'good'); }
        else { play('click'); toast(def.typ === 'bur' ? 'Buren är redan fräsch.' : 'Lådan är redan ren.'); }
      });
      return;
    }
    if (it.k === 'leksak-boll') {
      walkThen(it.x, it.y + 5, () => {
        const ang = rnd() * Math.PI * 2, s = 70 + rnd() * 40;
        ballV.set(it.id, { vx: Math.cos(ang) * s, vy: Math.sin(ang) * s * 0.5, rot: 0 });
        play('click');
        // hundar och katter som är vakna springer efter
        for (const a of actors.values()) {
          if (a.pet.species === 'kanin' || a.pose === 'sleep' || a.pet.out || a.mode === 'jump' || a.elev) continue;
          if (rnd() < 0.8) { a.mode = 'idle'; a.modeT = 0.25 + rnd() * 0.4; a.onEnd = () => { const b = store.itemById(it.id); if (b) go(a, b.x - 4, b.y + 1, { run: true, then: () => { kick(a, b); setPose(a, 'play', 1.5); } }); }; }
        }
      });
      return;
    }
    openItemMenu(it);
  }

  function statBar(label, v, inv = false) {
    const pct = Math.round(clamp(v, 0, 100));
    const bad = inv ? pct >= 80 : pct < 30, mid = inv ? pct >= 50 : pct < 60;
    const col = bad ? '#e04848' : mid ? '#e8c040' : '#58c46a';
    return `<div style="display:flex;align-items:center;gap:8px;font-size:17px;margin:2px 0"><span style="width:124px;white-space:nowrap">${label}</span>
      <span style="flex:1;height:12px;background:#3a3440;border:2px solid var(--ink);position:relative"><span style="position:absolute;left:0;top:0;bottom:0;width:${pct}%;background:${col}"></span></span>
      <b style="width:34px;text-align:right">${pct}</b></div>`;
  }
  function openPetMenu(petId) {
    const p = store.petById(petId);
    if (!p) return;
    menuFor = petId;
    const a = actors.get(petId);
    const br = breedOf(p);
    const br2 = p.breed2 ? breedOf({ ...p, breed: p.breed2 }) : null;
    const age = Math.max(0, (store.day || 1) - (p.bornDay || 1));
    const lover = p.lover ? store.petById(p.lover) : null;
    const status = [];
    if (p.out) status.push(p.species === 'hund' ? '🦮 Koppel på – följer med ut.' : '🚶 Följer med ut.');
    else if (p.following) status.push('🐾 Följer dig i rummet.');
    if (lover) status.push(`❤️ Kär i ${esc(lover.name)}.`);
    if (p.pregnantUntil != null) { const d = p.pregnantUntil - (store.day || 1); status.push(`🍼 Väntar ungar ${d <= 0 ? 'i natt' : d === 1 ? 'i morgon' : `om ${d} dagar`}!`); }
    if (p.hunger < 35) status.push('🍽️ Hungrig – fyll matskålen.');
    if (p.species === 'hund' && p.toilet >= 70) status.push('🌳 Måste ut och kissa!');
    const kind = speciesWord(p);
    const body = `<div style="display:flex;gap:14px;align-items:flex-start">
        <span data-portrait style="flex:none"></span>
        <div style="flex:1;min-width:0">
          <p style="font-size:24px;margin:0"><b>${esc(p.name)}</b> <span title="${p.sex}">${sexSign(p)}</span></p>
          <p style="font-size:17px;margin:2px 0 8px" class="sp">${esc(br?.namn || p.breed)}${br2 && br2.id !== br?.id ? ` × ${esc(br2.namn)}` : ''} · ${esc(kind.toLowerCase())} · ${p.sex} · ${age === 0 ? 'född i dag' : age === 1 ? '1 dag gammal' : `${age} dagar gammal`}</p>
          ${statBar('❤️ Glad', p.happy)}
          ${statBar('🥣 Mätt', p.hunger)}
          ${p.species === 'hund' ? statBar('💩 Kissnödig', p.toilet, true) : ''}
          ${status.length ? `<p style="font-size:17px;margin:8px 0 0">${status.join('<br>')}</p>` : ''}
        </div></div>`;
    const done = (fn) => () => { closeModal(); menuFor = null; if (a) { a.mode = 'idle'; a.modeT = 0.2; } fn?.(); };
    const tooSmall = !p.out && p.stage === 'unge' && p.species !== 'hund'; // walkStart nekar ('for-liten')
    const outBtn = p.species === 'hund'
      ? { label: p.out ? '🦮 Ta av kopplet' : '🦮 Koppel på', onClick: done(() => {
        if (p.out) { store.walkEnd(p.id); p.room = room; p.x = a?.x ?? p.x; p.y = a?.y ?? p.y; toast(`${p.name} är fri igen.`); }
        else { const r = store.walkStart(p.id); toast(r ? '🦮 ' + r.msg : store.lastError, r ? 'good' : 'bad'); play(r ? 'ok' : 'fel'); }
      }) }
      : tooSmall ? { label: '🚼 För liten att gå ut', disabled: true, onClick: () => {} }
        : { label: p.out ? '🏠 Stanna hemma' : '🚶 Ta med ut', onClick: done(() => {
          if (p.out) { store.walkEnd(p.id); p.room = room; p.x = a?.x ?? p.x; p.y = a?.y ?? p.y; }
          else { const r = store.walkStart(p.id); toast(r ? r.msg : store.lastError, r ? 'good' : 'bad'); }
        }) };
    const dlg = openModal(`🐾 ${esc(p.name)}`, body, [
      { label: '🤚 Klappa', cls: 'btn-go', onClick: done(() => doPat(p.id)) },
      { label: '🎾 Leka', onClick: done(() => doPlay(p.id)) },
      outBtn,
      { label: p.following ? '🛑 Stanna här' : '🐾 Följ mig', hidden: p.out, onClick: done(() => { store.setFollowing(p.id, !p.following); toast(p.following ? `${p.name} följer dig.` : `${p.name} stannar här.`); }) },
      { label: '✏️ Byt namn', onClick: () => renameDialog(p.id) },
    ]);
    const slot = dlg.querySelector('[data-portrait]');
    if (slot) slot.replaceWith(portraitCanvas(p, 4));
    const x = dlg.querySelector('[data-close]');
    if (x) x.addEventListener('click', () => { menuFor = null; });
  }
  function renameDialog(petId) {
    const p = store.petById(petId);
    if (!p) return;
    const dlg = openModal('✏️ Byt namn', `<p style="font-size:19px;margin-top:0">Vad ska ${esc(p.name)} heta?</p>
      <input id="pet-namn" maxlength="16" value="${esc(p.name)}" style="font:inherit;font-size:22px;width:100%;padding:6px;border:3px solid var(--ink)">`, [
      { label: 'Avbryt', onClick: () => { closeModal(); menuFor = null; } },
      { label: '✔ Spara', cls: 'btn-go', onClick: () => {
        const v = dlg.querySelector('#pet-namn')?.value || '';
        if (store.rename(petId, v)) { play('ok'); toast(`Hej ${store.petById(petId).name}!`, 'good'); }
        closeModal(); menuFor = null;
      } },
    ]);
    const inp = dlg.querySelector('#pet-namn');
    if (inp) { inp.focus(); inp.select(); inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') dlg.querySelector('.dlg-foot .btn-go')?.click(); }); }
  }
  function doPat(petId) {
    const p = store.petById(petId), a = actors.get(petId);
    if (!p) return;
    const before = p.happy;
    store.pet(petId);
    play('ok');
    if (a) {
      a.elev = a.elev || null;
      const f = facing(a.x, a.y, px(), py() - 4);
      setPose(a, p.species === 'katt' ? 'love' : 'happy', 2.2, null, f);
    }
    const word = { katt: 'spinner', hund: 'viftar på svansen', kanin: 'nosar glatt' }[p.species] || 'blir glad';
    toast(`🤚 ${p.name} ${word}! (glad ${Math.round(before)} → ${Math.round(p.happy)})`, 'good');
  }
  function doPlay(petId) {
    const p = store.petById(petId), a = actors.get(petId);
    if (!p) return;
    store.play(petId);
    play('click');
    if (a) {
      const f = facing(a.x, a.y, px(), py() - 4);
      setPose(a, 'play', 2.4, () => { if (rnd() < 0.7) { const [x, y] = nearestFreePt(a.x + (rnd() - 0.5) * 70, a.y + (rnd() - 0.5) * 24); go(a, x, y, { run: true, then: () => setPose(a, 'happy', 1.2, null, facing(a.x, a.y, px(), py())) }); } }, f);
    }
    toast(`🎾 ${p.name} leker!`, 'good');
  }
  function openItemMenu(it) {
    const def = PET_ITEMS[it.k];
    const extra = def.typ === 'bur' ? `<p style="font-size:17px">Halmen: ${it.dirt > 0.6 ? 'smutsig' : it.dirt > 0.2 ? 'helt okej' : 'fräsch'}.</p>` : '';
    const dlg = openModal(`${def.namn}`, `<div style="display:flex;gap:14px;align-items:center"><span data-icon></span><p style="font-size:19px;margin:0">${esc(def.desc || '')}</p></div>${extra}`, [
      { label: '↔️ Flytta', onClick: () => { closeModal(); startMoving(it.id); } },
      { label: '📦 Plocka upp', onClick: () => { closeModal(); if (carrying()?.itemId === it.id) setCarry(null); if (store.pickItem(it.id)) { version++; opts.onObstacles?.(obstacles()); play('click'); toast(`${def.namn} ligger i dina djurprylar.`); } } },
      { label: 'Stäng', cls: 'btn-go', onClick: closeModal },
    ]);
    const slot = dlg.querySelector('[data-icon]');
    if (slot) slot.replaceWith(itemCanvas(it.k, 3, it));
  }
  function openInventory() {
    const inv = Object.entries(store.inventory).filter(([k, n]) => n > 0 && PET_ITEMS[k]);
    const opened = Object.entries(store.opened).filter(([k, n]) => n > 0 && PET_ITEMS[k] && !(store.inventory[k] > 0));
    const placed = items();
    // förrådet: namn + beskrivning; rummet: kompakta rader (namn – status) i en lista som
    // rullar själv, så dialogen ryms på skärmen även med tolv prylar framme
    const rowInv = ([k, n]) => `<div class="prow"><span data-ic="${k}"></span><span class="nm">${esc(PET_ITEMS[k].namn)} ×${n}<br><small class="sp">${esc(PET_ITEMS[k].desc || '')}</small></span>
      <button class="btn btn-small btn-go" data-place="${k}">Ställ ut</button></div>`;
    const rowPlaced = (it) => `<div class="prow" style="padding:2px 6px 2px 3px;gap:6px"><span data-ic="${it.k}"></span><span class="nm" style="font-size:18px">${esc(PET_ITEMS[it.k].namn)} <small class="sp">– ${esc(itemStatus(it))}</small></span>
      <span style="display:flex;gap:4px"><button class="btn btn-small" data-move="${it.id}">Flytta</button><button class="btn btn-small" data-pick="${it.id}">Plocka upp</button></span></div>`;
    const dlg = openModal('🐾 Djurprylar', `
      ${inv.length || opened.length ? `<p style="font-size:18px;margin:0 0 6px"><b>I förrådet</b></p><div class="plist" style="max-height:32vh;overflow:auto;padding:2px">${[...inv, ...opened.map(([k, n]) => [k, `påbörjad (${n} kvar)`])].map(rowInv).join('')}</div>` : '<p style="font-size:18px;margin-top:0">Förrådet är tomt – köp prylar i djuraffären.</p>'}
      ${placed.length ? `<p style="font-size:18px;margin:10px 0 6px"><b>Här i rummet</b> <small class="sp">(${placed.length})</small></p><div class="plist" style="max-height:40vh;overflow:auto;padding:2px;gap:4px">${placed.map(rowPlaced).join('')}</div>` : ''}`,
    [{ label: 'Klar', cls: 'btn-go', onClick: closeModal }]);
    dlg.querySelectorAll('[data-ic]').forEach((el) => el.replaceWith(itemCanvas(el.dataset.ic, fitScale(el.dataset.ic))));
    dlg.querySelectorAll('[data-place]').forEach((b) => (b.onclick = () => { closeModal(); startPlacing(b.dataset.place); }));
    dlg.querySelectorAll('[data-move]').forEach((b) => (b.onclick = () => { closeModal(); startMoving(b.dataset.move); }));
    dlg.querySelectorAll('[data-pick]').forEach((b) => (b.onclick = () => {
      if (carrying()?.itemId === b.dataset.pick) setCarry(null);
      if (store.pickItem(b.dataset.pick)) { version++; opts.onObstacles?.(obstacles()); play('click'); openInventory(); }
    }));
  }
  function itemStatus(it) {
    const def = PET_ITEMS[it.k];
    if (def.typ === 'skal') return it.food > 0.02 ? `${Math.round(it.food * 100)} % ${it.foodKind ? it.foodKind + 'mat' : 'mat'}` : 'tom';
    if (def.typ === 'vatten') return it.water > 0.02 ? `${Math.round(it.water * 100)} % vatten` : 'tom';
    if (def.typ === 'lada') return it.dirt > 0.6 ? 'behöver tömmas!' : it.dirt > 0.2 ? 'lite använd' : 'ren';
    if (def.typ === 'bur') return it.dirt > 0.6 ? 'byt halm!' : 'fräsch halm';
    if (def.typ === 'sack') return `${it.left} portioner kvar`;
    // korg/klösträd: vem som ligger där just nu; leksaker och koppel: kort och gott
    const who = [...actors.values()].filter((a) => a.inItem === it.id || a.elev === it.id).map((a) => a.pet.name);
    if (def.typ === 'sang' || def.typ === 'klos') return who.length ? `${who.join(' och ')} ${def.typ === 'klos' ? 'är där uppe' : 'ligger här'}` : 'ledig';
    if (def.typ === 'leksak') return 'på golvet';
    return 'på plats';
  }
  // ikonskala som ryms i dialogradens 44 px-kolumn (breda/höga saker ritas i skala 1)
  function fitScale(k, max = 2) {
    const d = PET_ITEMS[k];
    return Math.max(1, Math.min(max, Math.floor(40 / (Math.max(d.w, 11) + 4)), Math.floor(40 / (d.h + 4))));
  }

  // ---------- utplacering ----------
  function startPlacing(k) {
    if (!PET_ITEMS[k]) return;
    placing = { k, itemId: null, x: mouse.x, y: mouse.y };
    toast(`Klicka på golvet där ${PET_ITEMS[k].namn.toLowerCase()} ska stå (Esc avbryter).`);
  }
  function startMoving(itemId) {
    const it = store.itemById(itemId);
    if (!it) return;
    placing = { k: it.k, itemId, x: it.x, y: it.y };
    toast(`Klicka där ${PET_ITEMS[it.k].namn.toLowerCase()} ska stå (Esc avbryter).`);
  }
  // fotavtryck på golvet (det saken står på) och synlig ruta (det man ser av den)
  function footprint(k) {
    const d = PET_ITEMS[k];
    return itemSolid(k) || { x0: -(d.w >> 1), y0: -Math.min(5, d.h), x1: d.w - (d.w >> 1), y1: 0 };
  }
  const hitR = (a, b, g = 0) => a.x0 < b.x1 + g && a.x1 > b.x0 - g && a.y0 < b.y1 + g && a.y1 > b.y0 - g;
  const at = (r, x, y) => ({ x0: x + r.x0, x1: x + r.x1, y0: y + r.y0, y1: y + r.y1 });
  function canPlace(k, x, y, ignoreId, gap = 1) {
    const d = PET_ITEMS[k];
    const x0 = x - (d.w >> 1), x1 = x0 + d.w;
    if (x0 < B.left || x1 > B.right || y - Math.min(d.h, 10) < B.top - 2 || y > B.bottom + 1) return false;
    const s = footprint(k);
    for (let yy = y + s.y0; yy <= y + s.y1; yy += 2) for (let xx = x + s.x0; xx <= x + s.x1; xx += 2) if (!sceneFree(xx, yy)) return false;
    const myFoot = at(s, x, y), myVis = at(itemBox(k), x, y);
    for (const it of items()) {
      if (it.id === ignoreId) continue;
      const foot = at(footprint(it.k), it.x, it.y), vis = at(itemBox(it.k), it.x, it.y);
      if (hitR(myFoot, foot, gap)) return false;
      // inte gömd bakom/uppe på en högre sak, och inte så att den gömmer en annan
      if (y < it.y && hitR(myFoot, vis)) return false;
      if (it.y < y && hitR(foot, myVis)) return false;
    }
    return true;
  }
  function commitPlace() {
    const P = placing, x = Math.round(P.x), y = Math.round(P.y);
    if (!canPlace(P.k, x, y, P.itemId)) { play('fel'); return; }
    if (P.itemId) store.moveItem(P.itemId, x, y);
    else if (!store.placeItem(P.k, home, room, x, y)) { play('fel'); toast(store.lastError || 'Det gick inte.'); placing = null; return; }
    play('ok');
    const moreLeft = !P.itemId && ((store.inventory[P.k] | 0) > 0);
    placing = moreLeft ? { ...P } : null;
    version++; opts.onObstacles?.(obstacles());
  }

  function obstacles() {
    return items().map((it) => itemRect(it)).filter(Boolean).map((r) => [r[0], r[1], r[2], r[3]]);
  }

  // ---------- händelser → toasts ----------
  const unsub = store.listen((ev) => {
    if (opts.toasts === false) return;
    if (ev.home != null && ev.home !== home) return;
    const key = ev.type + '|' + ev.petId;
    if (toastSeen.has(key) && t - toastSeen.get(key) < 20) return;
    toastSeen.set(key, t);
    toast(`${EMO[ev.type] || '🐾'} ${ev.text}`, GOOD.has(ev.type) ? 'good' : ev.type === 'vaxte' ? '' : 'bad');
    if (ev.type === 'ungar') play('fanfare');
    if (ev.type === 'bajs' || ev.type === 'kiss') version++;
  });

  // Nyköpta prylar som inte står framme någonstans i hemmet ställs ut automatiskt längs
  // bakväggen (matskål, säckar, låda, korg …) så att nya djurägare ser dem direkt.
  // Flyttas/plockas upp via L.openInventory(). Stäng av med opts.autoPlace = false.
  function findSpot(k) {
    const d = PET_ITEMS[k];
    const x0 = B.left + 10 + (d.w >> 1), x1 = B.right - 10 - (d.w >> 1);
    for (let y = B.top + Math.min(d.h, 14) + 4; y < B.bottom - 6; y += 5) {
      for (let x = x0; x <= x1; x += 5) {
        if (playerHere() && Math.abs(x - px()) < 16 && Math.abs(y - py()) < 12) continue;
        if (canPlace(k, x, y, null, 4)) return [x, y];
      }
    }
    return null;
  }
  function autoPlace() {
    const inHome = store.items.filter((i) => i.home === home);
    const order = ['kaninbur', 'hundkorg', 'kattkorg', 'kattlada', 'kattklostrad', 'matskal', 'vattenskal', 'sack-katt', 'sack-hund', 'sack-kanin', 'leksak-boll', 'leksak-ben'];
    const done = [];
    for (const k of order) {
      if (!((store.inventory[k] | 0) > 0) || inHome.some((i) => i.k === k)) continue;
      if (PET_ITEMS[k].typ === 'sack' && !store.pets.some((p) => p.home === home && p.species === PET_ITEMS[k].art)) continue;
      const sp = findSpot(k);
      const it = sp && store.placeItem(k, home, room, sp[0], sp[1]);
      if (it) { done.push(PET_ITEMS[k].namn.toLowerCase().replace(/ \(säck\)/, '')); inHome.push(it); }
    }
    if (done.length) {
      version++; opts.onObstacles?.(obstacles());
      if (opts.toasts !== false) toast(`📦 Framställt: ${done.join(', ')}. Flytta via Djurprylar.`);
    }
    return done;
  }
  // Efter en flytt (sim._migrate) har prylar och olyckor rum = null och koordinater från
  // den gamla bostaden: de hör hemma i det första rum lagret visar. Står en pryl då i en
  // möbel, i väggen eller utanför det här (kanske mindre) rummet flyttas den till en
  // ledig plats (annars ligger den kvar – den går att flytta via Djurprylar).
  function adoptLoose() {
    let n = 0;
    for (const it of store.items) {
      if (it.home !== home || it.room != null) continue;
      it.room = room; n++;
      if (!canPlace(it.k, it.x, it.y, it.id)) { const sp = findSpot(it.k); if (sp) { it.x = sp[0]; it.y = sp[1]; } }
    }
    for (const m of store.messes) {
      if (m.home !== home || m.room != null) continue;
      m.room = room; n++;
      if (!petFree(m.x, m.y, null)) [m.x, m.y] = nearestFreePt(clamp(m.x, B.left + 6, B.right - 6), clamp(m.y, B.top + 6, B.bottom - 3)).map(Math.round);
    }
    if (n) { version++; opts.onObstacles?.(obstacles()); store.save(); }
    return n;
  }
  adoptLoose();
  if (opts.autoPlace !== false && store.pets.some((p) => p.home === home)) autoPlace();

  syncActors();
  // hundar hälsar när man kommer in
  for (const a of actors.values()) if (a.pet.species === 'hund' && !isNight() && playerHere() && rnd() < 0.8 && !a.pet.out) {
    a.mode = 'idle'; a.modeT = 0.3 + rnd() * 0.5; a.onEnd = () => visitPlayer(a, 'sit');
  }

  const L = {
    get version() { return version; },
    update(dt) {
      dt = Math.min(0.1, Math.max(0, dt || 0));
      t += dt;
      if (opts.sync !== false && A.game) {
        store.syncTo(A.game.day, A.game.min, { home: A.game.home, playerHome: home, playerRoom: room, outdoors: false });
      }
      store.setLive(home, room);
      lastSync += dt;
      syncActors();
      // spelaren börjar gå en bit: lediga djur hänger ibland med en stund (hundar oftast)
      const walkingNow = !!walker?.path?.length;
      if (walkingNow && !wasWalking) {
        for (const a of actors.values()) {
          const busy = a.pet.out || a.pet.following || a.mode === 'follow' || a.mode === 'jump' || a.elev || a.pose === 'sleep' || a.pose === 'eat' || a.tag;
          const chance = { hund: 0.4, katt: 0.12, kanin: 0.06 }[a.pet.species] || 0;
          if (!busy && (a.mode === 'idle' || (a.mode === 'pose' && ['sit', 'idle', 'play'].includes(a.pose))) && rnd() < chance * (a.pet.happy > 40 ? 1 : 0.4)) {
            a.path = []; a.then = null; a.onEnd = null; a.mode = 'follow'; a.follow.on = false; a.followT = 5 + rnd() * 9;
          }
        }
      }
      wasWalking = walkingNow;
      for (const a of actors.values()) updActor(a, dt);
      updBalls(dt);
      for (const f of fx) f.t += dt;
      for (let i = fx.length - 1; i >= 0; i--) if (fx[i].t >= fx[i].life) fx.splice(i, 1);
      // mätarnas synlighet: tydlig nära spelaren/musen, annars nedtonad
      for (const a of actors.values()) {
        const near = playerHere() && Math.hypot(px() - a.x, py() - a.y) < 38;
        const hov = hover?.kind === 'pet' && hover.id === a.id;
        const n = store.needs(a.pet);
        const asleep = a.pose === 'sleep' && a.mode !== 'walk';
        const hearts = a.mode === 'pose' && a.pose === 'love'; // låt hjärtana synas
        const target = hov || menuFor === a.id ? 1 : hearts ? 0.12 : near ? 1 : n.critical ? 0.85 : asleep ? 0.28 : 0.5;
        a.alpha += (target - a.alpha) * Math.min(1, dt * 6);
      }
      layoutMeters(dt);
      // skriv tillbaka positioner (sparas med simuleringens egna tider)
      if (lastSync > 0.5) {
        lastSync = 0;
        for (const a of actors.values()) if (!a.pet.out) { a.pet.x = Math.round(a.x); a.pet.y = Math.round(a.y); a.pet.room = room; }
        adoptLoose();
      }
      if (carrying() && !store.itemById(A.carrying.itemId)) setCarry(null);
    },
    drawables() {
      const out = [];
      const push = (y, draw, x = 0) => out.push({ x, y, fy: y, draw });
      for (const m of messes()) {
        if (m.kind === 'kiss') push(m.y - 8, (ctx) => drawPuddle(ctx, m.x, m.y), m.x);
        else if (m.by === 'kanin') push(m.y - 1, (ctx) => drawPellets(ctx, m.x, m.y), m.x);
        else push(m.y, (ctx) => drawPoop(ctx, m.x, m.y, t), m.x);
      }
      const carriedId = carrying()?.itemId;
      for (const it of items()) {
        if (placing?.itemId === it.id) continue;
        const bv = ballV.get(it.id);
        const st = { food: it.food, foodKind: it.foodKind, water: it.water, dirt: it.dirt, left: it.left, t, rot: bv ? Math.floor(bv.rot) : 0,
          hover: hover?.kind === 'item' && hover.id === it.id, ghost: carriedId === it.id };
        if (splitItem(it.k)) { // bur/korg: bakdel, sedan djuret som ligger i den, sedan framkanten
          const back = it.k === 'kaninbur' ? -13 : (itemSolid(it.k)?.y0 ?? -8);
          push(it.y + back, (ctx) => drawPetItem(ctx, it.k, it.x, it.y, { ...st, layer: 'back' }), it.x);
          push(it.y + 0.2, (ctx) => drawPetItem(ctx, it.k, it.x, it.y, { ...st, layer: 'front' }), it.x);
        } else push(it.y, (ctx) => drawPetItem(ctx, it.k, it.x, it.y, st), it.x);
      }
      for (const a of actors.values()) {
        let fy = a.y;
        const inIt = a.inItem ? store.itemById(a.inItem) : null;
        if (inIt && inIt.k !== 'kaninbur' && inRect(itemRect(inIt, 2), a.x, a.y)) fy = inIt.y + (splitItem(inIt.k) ? -0.5 : 0.3);
        if (a.elev) { const tr = store.itemById(a.elev); if (tr) fy = tr.y + 0.3; }
        push(fy, (ctx) => drawActor(ctx, a), a.x);
        push(TOP + a.y, (ctx) => drawMeter(ctx, a), a.x);
      }
      push(TOP + 500, drawFx);
      const c = carrying();
      if (c && playerHere()) push(TOP + 900, (ctx) => carryBubble(ctx, px(), py() - 41, c.k), px());
      if (placing) push(TOP + 1000, (ctx) => {
        const x = Math.round(placing.x), y = Math.round(placing.y);
        const it = placing.itemId ? store.itemById(placing.itemId) : null;
        const ok = canPlace(placing.k, x, y, placing.itemId);
        drawPetItem(ctx, placing.k, x, y, { ...(it || { food: 0, water: 1, dirt: 0 }), ghost: true, bad: !ok, hover: ok, t });
      }, placing.x);
      return out;
    },
    down(wx, wy) {
      mouse = { x: wx, y: wy };
      if (placing) { placing.x = wx; placing.y = wy; commitPlace(); return true; }
      const tight = messAtTight(wx, wy);
      const a = tight ? null : actorAt(wx, wy);
      if (a) { clickPet(a); return true; }
      const m = tight || messAt(wx, wy);
      if (m) {
        walkThen(m.x, m.y + 5, () => { if (store.cleanMess(m.id)) { play('coin'); spark(m.x, m.y, 'clean'); toast(m.kind === 'kiss' ? '🧽 Torkat upp!' : '🧻 Städat bort!', 'good'); version++; } });
        return true;
      }
      const it = itemAt(wx, wy);
      if (it) { clickItem(it); return true; }
      return false;
    },
    hover(wx, wy) {
      mouse = { x: wx, y: wy };
      if (placing) { placing.x = wx; placing.y = wy; }
      const tight = messAtTight(wx, wy);
      const a = tight ? null : actorAt(wx, wy);
      if (a) { hover = { kind: 'pet', id: a.id, label: `${a.pet.name} (${speciesWord(a.pet).toLowerCase()})` }; return hover; }
      const m = tight || messAt(wx, wy);
      if (m) { hover = { kind: 'mess', id: m.id, label: m.kind === 'kiss' ? 'Kisspöl – torka upp' : 'Bajs – städa bort' }; return hover; }
      const it = itemAt(wx, wy);
      if (it) { hover = { kind: 'item', id: it.id, label: `${PET_ITEMS[it.k].namn} – ${itemStatus(it)}` }; return hover; }
      hover = null;
      return null;
    },
    move(wx, wy) { return L.hover(wx, wy); },
    key(k) {
      if (k === 'Escape') {
        if (placing) { placing = null; return true; }
        if (carrying()) { setCarry(null); return true; }
      }
      return false;
    },
    obstacles,
    openInventory, startPlacing, startMoving, autoPlace,
    get placing() { return !!placing; },
    // prylen under pekaren (även om ett djur ligger i den) – { id, k } | null (Möblera-läget)
    itemAt(wx, wy) { const it = itemAt(wx, wy); return it ? { id: it.id, k: it.k } : null; },
    invalidate() {
      gridV = -1; // findPath bygger om nätet vid nästa sökning
      for (const a of actors.values()) {
        if (a.elev || a.mode === 'jump' || a.pet.out || petFree(a.x, a.y, a.allow)) continue;
        // en möbel ställdes där djuret stod: kliv ut till närmaste lediga plats
        [a.x, a.y] = nearestFreePt(a.x, a.y);
        a.vx = 0; a.vy = 0; a.path = []; a.then = null; a.mode = 'idle'; a.modeT = 0.3;
      }
    },
    cancel() { placing = null; setCarry(null); },
    exit() {
      unsub();
      store.clearLive();
      for (const a of actors.values()) if (!a.pet.out) { a.pet.x = Math.round(a.x); a.pet.y = Math.round(a.y); a.pet.room = room; }
      setCarry(null);
      store.save();
    },
    _debug: {
      actors,
      pets: () => [...actors.values()].map((a) => ({ id: a.id, name: a.pet.name, x: a.x, y: a.y, mode: a.mode, pose: a.pose, anim: animOf(a), dir: a.dir })),
      items: () => items(),
      // mätarnas skyltar (logiska px): var de ritas, var hemplatsen är, och om de tonats ned
      meters: () => [...actors.values()].map((a) => ({ id: a.id, name: a.pet.name, ...meterRect(a), dim: !!a.mDim, petX: Math.round(a.x), petY: Math.round(a.y - a.z) })),
      // SKÄRMkoordinater (logiska) för klicktester: djur-id, pryl-id, prylnyckel (k) eller 'bajs'
      spot(id) {
        const a = actors.get(id);
        if (a) { const b = petBox(a.pet, animOf(a), a.dir); return { x: Math.round(a.x), y: Math.round(a.y - a.z + (b.y0 + b.y1) / 2) }; }
        const it = store.itemById(id) || items().find((i) => i.k === id);
        if (it) { const b = itemBox(it.k); return { x: it.x, y: Math.round(it.y + (b.y0 + b.y1) / 2) }; }
        const m = id === 'bajs' ? messes()[0] : messes().find((q) => q.id === id);
        if (m) return { x: m.x, y: m.y - 2 };
        return null;
      },
      think: (id) => { const a = actors.get(id); if (a) think(a); },
      goTo: (id, x, y, run = false) => { const a = actors.get(id); if (!a) return false; return go(a, x, y, { run, then: () => setPose(a, 'idle', 30) }); },
      setMode: (id, mode) => { const a = actors.get(id); if (!a) return; if (mode === 'sleep') goSleep(a); else if (mode === 'eat') { const b = pickBowl(a); if (b) goEat(a, b); } else if (mode === 'toilet') goToilet(a); else if (mode === 'play') tryPlay(a); else if (mode === 'wander') wander(a); else setPose(a, mode, 3); },
    },
  };
  return L;
}

// ---------- små ritfunktioner ----------
function leash(ctx, x0, y0, x1, y1) {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
  const sag = Math.min(4, n / 5);
  ctx.fillStyle = '#b8302e';
  let lx = null, ly = null;
  for (let i = 0; i <= n; i++) {
    const k = i / n, x = Math.round(x0 + (x1 - x0) * k), y = Math.round(y0 + (y1 - y0) * k + sag * 4 * k * (1 - k));
    if (x === lx && y === ly) continue;
    ctx.fillRect(x, y, 1, 1); lx = x; ly = y;
  }
}
function drawPellets(ctx, x, y) {
  x = Math.round(x); y = Math.round(y);
  const pts = [[-2, 0], [0, -1], [1, 1], [3, 0], [-1, 2]];
  for (const [dx, dy] of pts) { ctx.fillStyle = '#4a3018'; ctx.fillRect(x + dx, y + dy, 1, 1); ctx.fillStyle = '#6e4a28'; ctx.fillRect(x + dx, y + dy - 1, 1, 1); }
}
function carryBubble(ctx, x, y, k) {
  x = Math.round(x); y = Math.round(y);
  const d = PET_ITEMS[k] || { w: 11, h: 14 };
  const w = d.w + 6, h = d.h + 5;
  ctx.fillStyle = '#17151a'; ctx.fillRect(x - (w >> 1) - 1, y - h - 1, w + 2, h + 2);
  ctx.fillStyle = '#f4f1ea'; ctx.fillRect(x - (w >> 1), y - h, w, h);
  ctx.fillRect(x - 1, y + 1, 3, 2); ctx.fillStyle = '#17151a'; ctx.fillRect(x - 2, y + 1, 1, 2); ctx.fillRect(x + 2, y + 1, 1, 2); ctx.fillRect(x - 1, y + 3, 3, 1);
  drawPetItem(ctx, k, x, y - 2, {});
}
function portraitCanvas(p, scale) {
  const cv = document.createElement('canvas');
  const W = (ICON_W || 24) * scale, H = (ICON_H || 20) * scale;
  cv.width = W + 8; cv.height = H + 8;
  cv.style.cssText = `width:${(W + 8) / 1}px;height:${(H + 8) / 1}px;image-rendering:pixelated;border:3px solid var(--ink);background:#d8cdb8`;
  const c = cv.getContext('2d');
  c.imageSmoothingEnabled = false;
  c.fillStyle = '#e8dcc4'; c.fillRect(0, 0, cv.width, cv.height);
  drawPetIcon(c, 4, 4, p, scale);
  return cv;
}
function itemCanvas(k, scale, state = {}) {
  const d = PET_ITEMS[k];
  const W = (Math.max(d.w, 11) + 4) * scale, H = (d.h + 4) * scale;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  cv.style.cssText = `width:${W}px;height:${H}px;image-rendering:pixelated`;
  const c = cv.getContext('2d');
  c.imageSmoothingEnabled = false;
  drawItemIcon(c, k, 0, 0, scale, state);
  return cv;
}

// ======================================================================
//  Följaren – djuret går med dig ute i staden
// ======================================================================
export function createPetFollower(A, pet, { store = null } = {}) {
  const S = store || petStore();
  const sp = SPD[pet.species] || SPD.katt;
  const size = Math.abs(petBox(pet, 'idle', 'down').y0 || 10);
  const k = (pet.species === 'hund' ? clamp(size / 14, 0.75, 1.15) : 1) * (pet.stage === 'unge' ? 0.85 : 1);
  const a = {
    pet, x: null, y: null, vx: 0, vy: 0, z: 0, dir: 'down', face: null, dirAge: 1, want: null, wantT: 0,
    moving: false, running: false, phase: 0, walkSp: sp[0] * k, runSp: Math.max(sp[1] * k, 58), pose: 'idle',
  };
  const LEASH = 20;
  let t = 0, ox = null, oy = null, hvx = 0, hvy = 1, ownerMoving = false, still = 0, sniff = null;
  let outT = 0, business = null, drops = [], ownerDir = 'down';
  const leashed = pet.species === 'hund';

  const F = {
    get x() { return a.x; }, get y() { return a.y; }, pet,
    update(dt, ownerX, ownerY, isFree) {
      dt = Math.min(0.1, Math.max(0, dt || 0));
      t += dt; outT += dt;
      const free = isFree ? (x, y) => !!isFree(x, y) : () => true;
      if (a.x == null) { // första bilden: ställ djuret bakom ägaren
        a.x = ownerX - 8; a.y = ownerY + 2;
        if (!free(a.x, a.y)) { a.x = ownerX; a.y = ownerY + 1; }
      }
      // ägarens riktning (utjämnad)
      if (ox != null) {
        const vx = (ownerX - ox) / Math.max(dt, 1e-3), vy = (ownerY - oy) / Math.max(dt, 1e-3);
        const sp2 = Math.hypot(vx, vy);
        ownerMoving = ownerMoving ? sp2 > 4 : sp2 > 12;
        if (sp2 > 4) { hvx += (vx / sp2 - hvx) * Math.min(1, dt * 6); hvy += (vy / sp2 - hvy) * Math.min(1, dt * 6); }
        const hl = Math.hypot(hvx, hvy) || 1; hvx /= hl; hvy /= hl;
        if (ownerMoving) ownerDir = dirFrom(hvx, hvy, ownerDir);
      }
      ox = ownerX; oy = ownerY;
      // mål: hunden lite före på vänster sida, katt/kanin strax bakom
      let tx, ty, speedCap;
      if (business) {
        business.t -= dt;
        a.pose = business.kind;
        tx = a.x; ty = a.y;
        if (business.t <= 0) {
          if (S.outdoorBusiness(pet.id) && business.kind === 'poop') drops.push({ x: Math.round(a.x - (a.dir === 'right' ? 4 : a.dir === 'left' ? -4 : 0)), y: Math.round(a.y), t: 0 });
          business = null;
        }
      } else if (ownerMoving) {
        still = 0; sniff = null;
        // sidan närmast betraktaren (större y) så att djuret syns framför ägaren; går man
        // rakt upp/ned hamnar djuret på vänster sida
        let qx = hvy, qy = -hvx;
        if (qy < 0 || (Math.abs(qy) < 0.35 && qx > 0)) { qx = -qx; qy = -qy; }
        if (leashed) { tx = ownerX + hvx * 14 + qx * 7; ty = ownerY + hvy * 6 + qy * 7; }
        else { tx = ownerX - hvx * 12 + qx * 6; ty = ownerY - hvy * 7 + qy * 5; }
      } else {
        still += dt;
        if (!sniff || sniff.t <= 0) {
          const ang = Math.random() * Math.PI * 2, r = 6 + Math.random() * 7;
          sniff = { x: ownerX + Math.cos(ang) * r, y: ownerY + 2 + Math.sin(ang) * r * 0.5, t: 2 + Math.random() * 3 };
          if (!free(sniff.x, sniff.y)) { sniff.x = ownerX + 7; sniff.y = ownerY + 1; }
        }
        sniff.t -= dt;
        tx = sniff.x; ty = sniff.y;
      }
      // hunden gör sitt ute efter en stund (stannar – kopplet får sträckas lite)
      if (!business && leashed && pet.toilet >= 20 && !pet.didBusiness && outT > 7 && (!ownerMoving || Math.random() < dt * 0.25)) {
        business = { kind: pet.lastMess === 'bajs' ? 'pee' : 'poop', t: 2.2 };
        pet.lastMess = business.kind === 'poop' ? 'bajs' : 'kiss';
      }
      const dx = tx - a.x, dy = ty - a.y, d = Math.hypot(dx, dy);
      const od = Math.hypot(ownerX - a.x, ownerY - a.y);
      speedCap = od > 30 ? 90 : ownerMoving ? Math.max(a.walkSp, 66) : 14;
      let dvx = 0, dvy = 0;
      if (!business && d > (a.moving ? 0.8 : 3)) {
        const s = Math.min(speedCap, Math.max(4, d * 3));
        dvx = dx / d * s; dvy = dy / d * s;
      }
      stepMotion(a, dt, dvx, dvy, (x, y) => free(x, y) || od > 34, business ? ACC * 2 : ACC * 1.6);
      // kopplet håller hunden inom räckhåll (kontinuerligt – ingen teleport)
      const maxD = business ? LEASH + 8 : leashed ? LEASH : 44;
      const ex = ownerX - a.x, ey = ownerY - a.y, ed = Math.hypot(ex, ey);
      if (ed > maxD && !business) { const kk = (ed - maxD) / ed; a.x += ex * kk; a.y += ey * kk; }
      if (!a.moving && !business) a.face = facing(a.x, a.y, ownerX, ownerY - 4);
      if (!a.moving && !business) a.pose = still > 2.5 ? 'sit' : 'idle';
      for (const q of drops) q.t += dt;
      drops = drops.filter((q) => q.t < 25);
    },
    drawable() {
      const X = Math.round(a.x ?? 0), Y = Math.round(a.y ?? 0);
      const draw = (ctx) => {
        for (const q of drops) { ctx.globalAlpha = q.t > 20 ? (25 - q.t) / 5 : 1; drawPoop(ctx, q.x, q.y, t); ctx.globalAlpha = 1; }
        const anim = a.moving ? (a.running ? 'run' : 'walk') : a.pose || 'idle';
        drawPet(ctx, X, Y, pet, anim, a.moving ? a.phase : t + ((pet.seed || 0) % 7), a.dir);
        if (leashed && ox != null) {
          const n = petNeck(pet, anim, a.phase, a.dir) || { x: 0, y: -8 };
          const hx = Math.round(ox + (ownerDir === 'right' ? 1 : ownerDir === 'left' ? -2 : -6)), hy = Math.round(oy - 14);
          leash(ctx, hx, hy, X + n.x, Y + n.y);
        }
      };
      return { x: X, y: Y, fy: Y, draw };
    },
    get anim() { return a.moving ? (a.running ? 'run' : 'walk') : a.pose; },
    get dir() { return a.dir; },
  };
  return F;
}
