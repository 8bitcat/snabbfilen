// DJURAFFÄREN "TASSEN" – en gåbar djuraffär, dubbelt så bred som skärmen
// (kameran följer figuren). Från vänster till höger:
//   KATTER  – KATTRUMMET bakom glas i väggen (klätterträd, kattkorg, skålar)
//             med nio kattungar som leker, sover och kommer fram till glaset,
//             en podie med kattprylar (klösträd, kattkorg, kattlåda) och
//             KANINHAGEN med halm, kaninhus och sex kaninungar + kaninbur.
//   MITTEN  – foderhyllan (katt-, kanin- och hundmat), dörren, kassan med
//             kassören, akvarieväggen och fågelburen (dekor, ej till salu),
//             tillbehörshyllan (skålar, koppel, leksaker) och en pall med säckar.
//   HUNDAR  – fyra valphagar med tre valpar var som hoppar mot staketet när
//             man kommer nära, "så stor blir jag"-tavlor, hundkorgen och
//             valpleken där expediten släpper ner sin egen valp (Pluttan).
// Expediten (grönt förkläde) går runt: bär valpen, hämtar säckar ur pallen,
// fyller på foderhyllan och tillbehörshyllan.
//
// ============================== API ==============================
// makeShopDjur(A, opts) → scen (registrerad som 'djur' i js/main.js)
//   update(dt) · draw(ctx) · down(sx, sy) · move(sx, sy) · key(k)
//   worldX / worldY (figurens plats i butiken)
//   Klick på ett djur → gå dit → köpdialog (porträtt i stor skala, levande
//     förhandsvisning, art/ras/kön, namn, pris, startpaket) → A.game.money dras,
//     A.game.save() och petStore().adopt(art, ras, kön, namn, A.game.home, { day }).
//     Ett sålt djur är borta ur affären resten av speldagen.
//   Klick på en vara → köpdialog (antal) → petStore().buyItem(k, n) + pengar.
//   Klick på dörren → A.go('city').
//   _debug: spot(id) → { x, y } SKÄRMkoordinater (kameran tittar dit om platsen
//           ligger utanför bild; släpps vid nästa klick), id ∈ 'dorr', 'katt',
//           'hund', 'kanin', 'katt-<ras>', 'hund-<ras>', 'kanin-<ras>', varunycklar
//           ur PET_ITEMS ('sack-hund', 'kattlada', 'koppel' …), 'kassa', 'personal',
//           'akvarium', 'fagel', 'pall', 'kattrum', 'valplek'.
//           open(id) (öppnar dialogen direkt), bought() (köp i den här sessionen),
//           lockCam(x|null), teleport(x, y), hover(id), cam(), path(),
//           actors() (djuren: art, ras, x, y, anim, dir), clerk(), clerkStep(n)
//   Verktyg: tools/pets-shop-snap.mjs (bilder/sekvenser/dialoger), tools/pets-shop-test.mjs (klicktest),
//            tools/pets-shop-buy2.mjs (två köp i rad → en kvitto-toast per köp).
// ==================================================================
import { drawPerson } from '../core/people.js';
import { Pix, SMALL, BIG, ctxText, textW, text, mix, mul, hash, bayer } from '../core/floor-pix.js';
import { openModal, closeModal, toast, esc } from '../core/ui.js';
import { fmt } from '../game.js';
import { play } from '../core/sound.js';
import { createWalker, selfDrawable, folkDrawables, iconBubble, WALK_SEQ } from './walkable.js';
import { SPECIES, drawPet, drawPetIcon, petBox, breedOf, ICON_W, ICON_H } from '../pets/sprites.js';
import { PET_ITEMS, drawPetItem, drawItemIcon } from '../pets/items.js';
import { petStore, MAX_PETS } from '../pets/sim.js';

const VW = 384;                        // skärmens bredd i spelpixlar
const W = 768, H = 216, WALL_Y = 70;   // butikens storlek, väggens underkant
const MID0 = 204, MID1 = 536;          // zongränser: katter | mitten | hundar
const DOOR = { x0: 368, x1: 400 };
const WIN = { x0: 8, x1: 198, y0: 6, y1: 58 };            // kattrummets fönster (yttre ram)
const ROOM = { x0: 11, x1: 195, y0: 9, y1: 55, floor: 30 }; // insidan (klipps), golvet börjar vid floor
const CAT_AREA = { x0: 22, x1: 186, y0: 40, y1: 54 };    // där kattungarna går (fötterna)
const MULLION = 102;                                      // spröjsen mitt i glaset
const PERCH = { x: 43, y: 24 };                           // klätterträdets mellanhylla (vänster om KATTRUMMET-texten så zzz inte hamnar över den)
const ROOM_BOWL = { x: 140, y: 45 }, ROOM_WATER = { x: 126, y: 45 }, ROOM_BED = { x: 172, y: 47 };
const FODER = { x0: 208, x1: 352, top: 14, s1: 33, s2: 58 }; // foderhyllan (3 fack à 48), hyllplan
const BAYS = ['katt', 'kanin', 'hund'];
const DESK = { x: 414, y: 80, w: 62, h: 28 };
const AQUA = { x0: 480, x1: 532 };
const TANKS = [{ x0: 484, x1: 528, y0: 12, y1: 32 }, { x0: 484, x1: 528, y0: 37, y1: 56 }];
const CAGE = { x: 506, y: 132 };                          // fågelburens fot
const PODIUM = { x0: 14, x1: 152, y0: 100, y1: 128 };     // kattprylarnas podie
const HUTCH = { x0: 18, x1: 150, y0: 148, y1: 204 };      // kaninhagen
const RAB_AREA = { x0: 26, x1: 142, y0: 172, y1: 199 };
const HUTCH_BOWL = { x: 116, y: 176 };
const BURP = { x0: 164, x1: 208, y0: 170, y1: 204 };      // kaninburens podie
const PALLET = { x0: 230, x1: 268, y0: 118, y1: 138 };    // pall med säckar
const GOND = { x: 296, y: 144, w: 120, h: 54 };           // tillbehörshyllan
const PENS = [0, 1, 2, 3].map((i) => ({ i, x0: 544 + i * 56, x1: 596 + i * 56, y0: 76, y1: 124 }));
const KORGP = { x0: 552, x1: 606, y0: 160, y1: 188 };     // hundkorgens podie
const RUG = { x0: 628, x1: 752, y0: 150, y1: 204 };       // valpleken
const PLANTS = [[216, 104], [530, 208], [10, 138]];
const BOARD = { x: 344, y: 112 };                        // gatupratare vid dörren (NYA VALPAR!)

// ---------- djuren i affären ----------
const PEN_BREEDS = [['blandras', 'tax', 'jack'], ['labrador', 'golden', 'collie'], ['schafer', 'husky', 'pudel'], ['corgi', 'mops', 'chihuahua']];
const EMOJI = { katt: '🐱', hund: '🐶', kanin: '🐰' };
const ACCENT = { katt: '#f28bb3', hund: '#7fd08a', kanin: '#f0d048' };
const SHORTN = { golden: 'GOLDEN', collie: 'COLLIE', jack: 'JACK RUSS.', schafer: 'SCHÄFER', chihuahua: 'CHIHUAHUA', blandras: 'BLANDRAS', skogkatt: 'SKOGKATT', lejonhuvud: 'LEJONHUVUD', hollandare: 'HOLLÄNDARE', vadur: 'DVÄRGVÄDUR' };
const shortName = (sp, id) => SHORTN[id] || (SPECIES[sp].breeds.find((b) => b.id === id)?.namn || id).toUpperCase();

// ---------- varorna: var de står ----------
const ITEM_EMOJI = { matskal: '🥣', vattenskal: '💧', kattlada: '🧻', hundkorg: '🧺', kattkorg: '🛏️', kaninbur: '🏠', kattklostrad: '🌳', 'leksak-boll': '⚾', 'leksak-ben': '🦴', 'sack-katt': '🐟', 'sack-hund': '🍖', 'sack-kanin': '🥕', koppel: '🦮' };
const GTOP = GOND.y + 28, GBOT = GOND.y + 46;             // tillbehörshyllans hyllplan (varornas fötter)
const WARES = [
  { k: 'kattklostrad', x: 36, y: PODIUM.y1 - 9, stand: 'podium' },
  { k: 'kattkorg', x: 80, y: PODIUM.y1 - 9, stand: 'podium' },
  { k: 'kattlada', x: 124, y: PODIUM.y1 - 9, stand: 'podium' },
  { k: 'kaninbur', x: 186, y: BURP.y1 - 8, stand: 'burp' },
  { k: 'hundkorg', x: 579, y: KORGP.y1 - 9, stand: 'korgp' },
  { k: 'matskal', x: GOND.x + 22, y: GTOP, stand: 'gond' },
  { k: 'vattenskal', x: GOND.x + 60, y: GTOP, stand: 'gond' },
  { k: 'koppel', x: GOND.x + 98, y: GTOP, stand: 'gond' },
  { k: 'leksak-boll', x: GOND.x + 34, y: GBOT, stand: 'gond' },
  { k: 'leksak-ben', x: GOND.x + 84, y: GBOT, stand: 'gond' },
];

// ---------- personalen (grönt förkläde) ----------
const CLERK = { id: 'clerk', skin: '#eec3a0', hair: '#b7392b', style: 'ponytail', hat: null, cap: '#46a35a', top: 'tee', shirt: '#f4f1ea', accent: '#f4f1ea', bottom: 'pants', pants: '#2d3a5c', shoes: '#6b3e1e', glasses: false, beard: false, phones: false, bag: null, blush: true, build: 4, apron: true, kid: false };
const CASHIER = { id: 'cashier', skin: '#a06a43', hair: '#1d1714', style: 'short', hat: 'cap', cap: '#3f9a52', top: 'tee', shirt: '#f0b429', accent: '#f0b429', bottom: 'pants', pants: '#2b2b30', shoes: '#1c1c1c', glasses: 'round', beard: 'stubble', phones: false, bag: null, blush: false, build: 5, apron: true, kid: false };
const PUP = { species: 'hund', breed: 'golden', sex: 'hona', stage: 'unge', id: 'pluttan', seed: 7 };
const TIPS = [
  '💬 Katter behöver en kattlåda – och den måste tömmas ibland!',
  '💬 Hundar måste ut på promenad i koppel, annars blir det olyckor inne.',
  '💬 Maten: klicka på säcken hemma så bär du den, klicka sen på skålen så häller du upp.',
  '💬 Alla djur här är ungar. De blir unga efter 3 dagar och vuxna efter en vecka.',
  '💬 Har du en hane och en hona av samma art kan de bli kära – och få ungar!',
  '💬 Kaniner trivs bäst i en bur med halm. Byt halm ibland så blir de glada.',
  '💬 Djuren har en liten mätare ovanför sig: hjärtat är glädje och skålen är hunger.',
  '💬 Katter gillar att klättra – ett klösträd gör dem gladare.',
];

// ---------- sålt i dag (djuren kommer tillbaka nästa speldag) ----------
const SOLD = { day: -1, set: new Set() };
function soldToday(day) { if (SOLD.day !== day) { SOLD.day = day; SOLD.set = new Set(); } return SOLD.set; }

// ======================================================================
//  Rörelsemotorn för affärens djur: mjuk acceleration, hysteres mellan
//  stå/gå, riktningen hålls minst 0,3 s, inga teleporter.
// ======================================================================
const ACC = 80, MOVE_ON = 2, MOVE_OFF = 0.5, DIR_HOLD = 0.3;
const SPD = { katt: [11, 30], hund: [13, 34], kanin: [9, 24] };
const rnd = Math.random;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
function dirFrom(vx, vy, cur) {
  const ax = Math.abs(vx), ay = Math.abs(vy);
  const horizNow = cur === 'left' || cur === 'right';
  const horiz = horizNow ? !(ay > ax * 1.35) : ax > ay * 1.35;
  return horiz ? (vx < 0 ? 'left' : 'right') : (vy < 0 ? 'up' : 'down');
}
const toward = (a, b) => (Math.abs(b.x - a.x) >= Math.abs(b.y - a.y) * 0.8 ? (b.x < a.x ? 'left' : 'right') : (b.y < a.y ? 'up' : 'down'));

function makeActor(pet, area, o = {}) {
  const sp = SPD[pet.species] || SPD.katt;
  const k = pet.stage === 'unge' ? 1 : 1.2;
  return {
    pet, area, x: o.x ?? (area.x0 + area.x1) / 2, y: o.y ?? (area.y0 + area.y1) / 2,
    vx: 0, vy: 0, dir: o.dir || pick(['down', 'left', 'right']), face: null, dirAge: 1, want: null, wantT: 0,
    moving: false, running: false, phase: rnd() * 4, off: rnd() * 20,
    mode: 'rest', pose: o.pose || 'idle', modeT: o.modeT ?? 0.5 + rnd() * 3, tx: 0, ty: 0, fast: false, then: null,
    walkSp: sp[0] * k, runSp: sp[1] * k, perch: !!o.perch, plane: o.plane || 'floor', sale: o.sale !== false,
    slot: o.slot || 0, zone: o.zone || '', busy: false, z: 0, carried: false, idx: o.idx ?? 0,
  };
}
function moveActor(a, dt, dvx, dvy) {
  let ex = dvx - a.vx, ey = dvy - a.vy;
  const el = Math.hypot(ex, ey), lim = ACC * dt;
  if (el > lim) { ex = ex / el * lim; ey = ey / el * lim; }
  a.vx += ex; a.vy += ey;
  if (!dvx && !dvy && Math.hypot(a.vx, a.vy) < 0.3) { a.vx = 0; a.vy = 0; }
  const { x0, x1, y0, y1 } = a.area;
  const wx = a.x + a.vx * dt, wy = a.y + a.vy * dt;
  const nx = clamp(wx, x0, x1), ny = clamp(wy, y0, y1);
  if (nx !== wx) a.vx *= 0.4;
  if (ny !== wy) a.vy *= 0.4;
  a.x = nx; a.y = ny;
  const sp = Math.hypot(a.vx, a.vy);
  if (!a.moving && sp > MOVE_ON) a.moving = true;
  else if (a.moving && sp < MOVE_OFF) a.moving = false;
  a.running = a.moving && (a.running ? sp > a.walkSp * 1.25 : sp > a.walkSp * 1.6);
  a.dirAge += dt;
  if (a.moving && sp > 1.5) {
    const want = dirFrom(a.vx, a.vy, a.dir);
    if (want !== a.dir) {
      a.wantT = a.want === want ? a.wantT + dt : 0;
      a.want = want;
      if (a.dirAge >= DIR_HOLD && a.wantT >= 0.08) { a.dir = want; a.dirAge = 0; a.wantT = 0; }
    } else a.wantT = 0;
  } else if (!a.moving && a.face && a.face !== a.dir && a.dirAge >= DIR_HOLD) { a.dir = a.face; a.dirAge = 0; }
  a.phase += dt * (a.moving ? clamp(sp / (a.running ? a.runSp : a.walkSp), 0.5, 1.4) : 1);
}
function goTo(a, x, y, fast, then) {
  a.mode = 'go'; a.fast = !!fast; a.then = then || null; a.modeT = 9;
  a.tx = clamp(x, a.area.x0, a.area.x1); a.ty = clamp(y, a.area.y0, a.area.y1);
  if (a.pose === 'sleep' || a.pose === 'eat') a.pose = 'idle';
}
function rest(a, pose, dur, face = null) { a.mode = 'rest'; a.pose = pose; a.modeT = dur; a.face = face; }
function arrive(a) {
  const th = a.then || { pose: rnd() < 0.5 ? 'idle' : 'sit', dur: 1 + rnd() * 2 };
  a.then = null;
  rest(a, th.pose, th.dur, th.face === 'toBed' ? null : th.face || null);
  if (th.mate) {
    const m = th.mate;
    m.busy = false;
    if (Math.hypot(m.x - a.x, m.y - a.y) < 16 && m.mode === 'rest') {
      rest(m, 'play', th.dur, toward(m, a));
      a.face = toward(a, m);
    } else a.pose = 'idle';
  }
}
const WEIGHTS = {
  katt: [['wander', 30], ['play', 18], ['sleep', 12], ['sit', 16], ['eat', 8], ['happy', 5], ['idle', 11]],
  hund: [['wander', 32], ['play', 22], ['sleep', 9], ['sit', 12], ['eat', 8], ['happy', 10], ['idle', 7]],
  kanin: [['wander', 30], ['eat', 30], ['sit', 18], ['sleep', 8], ['play', 6], ['idle', 8]],
};
function roll(list) {
  let sum = 0; for (const [, w] of list) sum += w;
  let r = rnd() * sum;
  for (const [k, w] of list) { r -= w; if (r <= 0) return k; }
  return list[0][0];
}
function chooseNext(a, env) {
  const S = a.pet.species;
  if (a.perch) {
    if (a.pose === 'sleep') rest(a, rnd() < 0.5 ? 'sit' : 'idle', 3 + rnd() * 4, pick(['down', 'left', 'right']));
    else rest(a, 'sleep', 10 + rnd() * 12, a.dir);
    return;
  }
  if (env.near && rnd() < (S === 'hund' ? 0.85 : S === 'katt' ? 0.6 : 0.4)) {
    // fram till staketet/glaset där spelaren står
    const fx = env.near.x + ((a.idx % 5) - 2) * (S === 'hund' ? 9 : 12) + (rnd() - 0.5) * 4;
    const pose = S === 'hund' ? (rnd() < 0.5 ? 'beg' : 'happy') : S === 'katt' ? (rnd() < 0.35 ? 'play' : rnd() < 0.5 ? 'happy' : 'sit') : 'sit';
    const top = !!env.near.top; // spelaren står ovanför (bakom) hagen → fram till bakkanten
    goTo(a, fx, top ? a.area.y0 + rnd() * 2 : a.area.y1 - rnd() * 2, S === 'hund', { pose, dur: 1.8 + rnd() * 2.2, face: top ? 'up' : 'down' });
    return;
  }
  const what = roll(WEIGHTS[S] || WEIGHTS.katt);
  const { x0, x1, y0, y1 } = a.area;
  switch (what) {
    case 'wander': {
      const r = S === 'kanin' ? 22 : 48;
      goTo(a, clamp(a.x + (rnd() - 0.5) * 2 * r, x0, x1), y0 + rnd() * (y1 - y0), rnd() < (S === 'hund' ? 0.35 : S === 'kanin' ? 0.25 : 0.2), { pose: rnd() < 0.55 ? 'idle' : 'sit', dur: 1 + rnd() * 2.5 });
      break;
    }
    case 'play': {
      const mates = env.mates.filter((m) => m !== a && !m.perch && !m.busy && !m.carried && m.mode === 'rest' && m.pose !== 'sleep' && Math.hypot(m.x - a.x, m.y - a.y) < 70);
      if (!mates.length) { rest(a, 'play', 1.6 + rnd(), a.dir); break; }
      const m = pick(mates);
      const side = a.x < m.x ? -1 : 1;
      m.busy = true; rest(m, 'idle', 7, toward(m, a));
      goTo(a, m.x + side * 10, m.y + (rnd() - 0.5) * 2, true, { pose: 'play', dur: 2.2 + rnd() * 1.5, mate: m });
      break;
    }
    case 'sleep':
      if (env.bed && rnd() < 0.6 && !env.mates.some((m) => m !== a && Math.hypot(m.x - env.bed.x, m.y - env.bed.y) < 6)) goTo(a, env.bed.x, env.bed.y, false, { pose: 'sleep', dur: 7 + rnd() * 9, face: 'toBed' });
      else rest(a, 'sleep', 6 + rnd() * 8, a.dir);
      break;
    case 'eat':
      if (env.bowl && S !== 'kanin') goTo(a, env.bowl.x + (rnd() - 0.5) * 3, env.bowl.y + 4, false, { pose: 'eat', dur: 2.5 + rnd() * 2, face: 'up' });
      else if (env.bowl && rnd() < 0.4) goTo(a, env.bowl.x - 1, env.bowl.y + 4, false, { pose: 'eat', dur: 3 + rnd() * 2, face: 'up' });
      else rest(a, 'eat', 2.5 + rnd() * 3, a.dir); // kaninen knaprar halm där den står
      break;
    case 'sit': rest(a, 'sit', 2 + rnd() * 3, a.dir); break;
    case 'happy': rest(a, 'happy', 1.2 + rnd() * 1.2, 'down'); break;
    default: rest(a, 'idle', 1 + rnd() * 2, a.dir);
  }
}
function updateActor(a, dt, env) {
  if (a.carried) return;
  if (a.z > 0) a.z = Math.max(0, a.z - dt * 60);
  a.modeT -= dt;
  if (a.mode === 'rest') {
    if (a.modeT <= 0) { a.busy = false; chooseNext(a, env); }
    moveActor(a, dt, 0, 0);
    return;
  }
  // 'go'
  const dx = a.tx - a.x, dy = a.ty - a.y, d = Math.hypot(dx, dy);
  const spd = a.fast ? a.runSp : a.walkSp;
  let dvx = 0, dvy = 0;
  if (d > 0.9) { const s = Math.min(spd, Math.max(4, d * 2.5)); dvx = dx / d * s; dvy = dy / d * s; }
  moveActor(a, dt, dvx, dvy);
  if ((d <= 1.2 && Math.hypot(a.vx, a.vy) < 3) || a.modeT <= 0) arrive(a);
}
const animOf = (a) => (a.moving ? (a.running ? 'run' : 'walk') : a.pose);
function drawActor(ctx, a, t) {
  const anim = animOf(a);
  drawPet(ctx, Math.round(a.x), Math.round(a.y - a.z), a.pet, anim, a.moving ? a.phase : t + a.off, a.dir);
}

// ======================================================================
//  Personalen: förkläden färgas gröna (samma figurmotor som alla andra)
// ======================================================================
const APRON = new Map([[0xf2eee4, 0x3f9a52], [0xcfc8b8, 0x2b7440], [0xd8d1c1, 0x33834a], [0xe6e0d2, 0x38904c]]);
const staffCache = new Map();
function staffSprite(look, dir, frame) {
  const key = look.id + dir + frame;
  let c = staffCache.get(key);
  if (!c) {
    c = document.createElement('canvas'); c.width = 24; c.height = 42;
    const x = c.getContext('2d', { willReadFrequently: true });
    drawPerson(x, 12, 39, look, dir, frame);
    const im = x.getImageData(0, 0, 24, 42), d = im.data;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] !== 255) continue;
      const r = APRON.get((d[i] << 16) | (d[i + 1] << 8) | d[i + 2]);
      if (r !== undefined) { d[i] = r >> 16; d[i + 1] = (r >> 8) & 255; d[i + 2] = r & 255; }
    }
    x.putImageData(im, 0, 0);
    staffCache.set(key, c);
  }
  return c;
}
const drawStaff = (ctx, look, x, y, dir, frame) => ctx.drawImage(staffSprite(look, dir, frame), Math.round(x) - 12, Math.round(y) - 39);

// ======================================================================
//  Scenen
// ======================================================================
export function makeShopDjur(A, opts = {}) {
  const g = A.game;
  const store = petStore();
  const OBST = [
    [PODIUM.x0, PODIUM.y0 - 4, PODIUM.x1, PODIUM.y1 + 1],
    [HUTCH.x0 - 2, HUTCH.y0 - 3, HUTCH.x1 + 2, HUTCH.y1 + 2],
    [BURP.x0, BURP.y0 + 2, BURP.x1, BURP.y1 + 1],
    [PALLET.x0, PALLET.y0 - 2, PALLET.x1, PALLET.y1],
    [GOND.x - 4, GOND.y + 4, GOND.x + GOND.w + 4, GOND.y + GOND.h],
    [DESK.x, DESK.y, DESK.x + DESK.w, DESK.y + DESK.h],
    [CAGE.x - 10, CAGE.y - 12, CAGE.x + 10, CAGE.y + 1],
    [PENS[0].x0 - 2, PENS[0].y0 - 6, PENS[3].x1 + 2, PENS[0].y1 + 2],
    [KORGP.x0, KORGP.y0 + 2, KORGP.x1, KORGP.y1 + 1],
    ...PLANTS.map(([x, y]) => [x - 6, y - 4, x + 6, y + 2]),
    [BOARD.x - 13, BOARD.y - 5, BOARD.x + 13, BOARD.y + 1],
  ];
  const walker = createWalker({ W, H, top: WALL_Y + 4, bottom: H - 6, spawn: [(DOOR.x0 + DOOR.x1) / 2, WALL_Y + 12] });
  walker.setObstacles(OBST);
  walker.snapFree();
  let t = 0, lockedCam = null, peekCam = null, hoverId = null, hoverT = 0;
  const camTarget = () => lockedCam ?? peekCam ?? clamp(walker.px - VW / 2, 0, W - VW);
  const cam = { x: camTarget() };
  const bought = [];

  // ---------- förmålat ----------
  const bg = paintStore();
  const glassImg = paintGlass();
  const aquaGlass = paintAquaGlass();
  const penFront = paintPenFront();
  const hutchFront = paintHutchFront();
  const podiumImg = paintPodium(PODIUM.x1 - PODIUM.x0, PODIUM.y1 - PODIUM.y0, 0xf6f2ea, 0x3f9a52);
  const burpImg = paintPodium(BURP.x1 - BURP.x0, BURP.y1 - BURP.y0, 0xf6f2ea, 0xe8b230);
  const korgpImg = paintPodium(KORGP.x1 - KORGP.x0, KORGP.y1 - KORGP.y0, 0xf6f2ea, 0x3f9a52);
  const gondImg = paintGondola();
  const deskImg = paintDesk();
  const plantImg = paintPlant();
  const palletImg = paintPallet();
  const cageBack = paintCage(false), cageFront = paintCage(true);
  const boardImg = paintBoard();

  // ---------- djuren ----------
  const sold = soldToday(g.day);
  const actors = [];
  const sexOf = (i) => (i % 2 ? 'hona' : 'hane');
  SPECIES.katt.breeds.forEach((b, i) => {
    const key = 'katt:' + b.id;
    if (sold.has(key)) return;
    const pet = { species: 'katt', breed: b.id, sex: sexOf(i + 1), stage: 'unge', id: 'shop-' + key, seed: 31 * i + 5 };
    const perch = b.id === 'skogkatt';
    const n = SPECIES.katt.breeds.length;
    actors.push(makeActor(pet, perch ? { x0: PERCH.x, x1: PERCH.x, y0: PERCH.y, y1: PERCH.y } : CAT_AREA, perch
      ? { x: PERCH.x, y: PERCH.y, perch: true, plane: 'wall', pose: 'sleep', modeT: 8 + rnd() * 8, dir: 'right', zone: 'katt', idx: i }
      : { x: CAT_AREA.x0 + (i + 0.5) / n * (CAT_AREA.x1 - CAT_AREA.x0), y: CAT_AREA.y0 + rnd() * (CAT_AREA.y1 - CAT_AREA.y0), plane: 'wall', zone: 'katt', slot: i % 3, idx: i }));
  });
  PENS.forEach((pen, pi) => PEN_BREEDS[pi].forEach((id, j) => {
    const key = 'hund:' + id;
    if (sold.has(key)) return;
    const pet = { species: 'hund', breed: id, sex: sexOf(pi + j), stage: 'unge', id: 'shop-' + key, seed: 17 * (pi * 3 + j) + 3 };
    const area = { x0: pen.x0 + 8, x1: pen.x1 - 8, y0: pen.y0 + 13, y1: pen.y1 - 2 };
    actors.push(makeActor(pet, area, { x: area.x0 + (j + 0.5) / 3 * (area.x1 - area.x0), y: area.y0 + rnd() * (area.y1 - area.y0), zone: 'pen' + pi, slot: j, idx: pi * 3 + j }));
  }));
  SPECIES.kanin.breeds.forEach((b, i) => {
    const key = 'kanin:' + b.id;
    if (sold.has(key)) return;
    const pet = { species: 'kanin', breed: b.id, sex: sexOf(i), stage: 'unge', id: 'shop-' + key, seed: 13 * i + 11 };
    const n = SPECIES.kanin.breeds.length;
    actors.push(makeActor(pet, RAB_AREA, { x: RAB_AREA.x0 + (i + 0.5) / n * (RAB_AREA.x1 - RAB_AREA.x0), y: RAB_AREA.y0 + rnd() * (RAB_AREA.y1 - RAB_AREA.y0), zone: 'kanin', slot: i % 3, idx: i }));
  });
  const pup = makeActor(PUP, { x0: RUG.x0 + 10, x1: RUG.x1 - 10, y0: RUG.y0 + 10, y1: RUG.y1 - 5 }, { zone: 'rug', sale: false, x: 690, y: 180 });
  pup.carried = true;
  actors.push(pup);
  const ball = { x: 668, y: 182, vx: 0, vy: 0, rot: 0 };
  const zoneEnv = (z) => {
    const mates = actors.filter((m) => m.zone === z && !m.carried);
    if (z === 'katt') return { mates, bowl: ROOM_BOWL, bed: ROOM_BED };
    if (z === 'kanin') return { mates, bowl: HUTCH_BOWL };
    if (z.startsWith('pen')) { const p = PENS[+z.slice(3)]; return { mates, bowl: { x: p.x0 + 12, y: p.y0 + 16 } }; }
    return { mates };
  };
  // Står spelaren nära en inhägnad? → { x } där djuren samlas vid fronten
  const nearOf = (z) => {
    const px = walker.px, py = walker.py;
    if (z === 'katt') return py < WALL_Y + 30 && px > WIN.x0 - 6 && px < WIN.x1 + 6 ? { x: clamp(px, CAT_AREA.x0 + 10, CAT_AREA.x1 - 10) } : null;
    if (z === 'kanin') return px > HUTCH.x0 - 16 && px < HUTCH.x1 + 18 && py > HUTCH.y0 - 20 && py < H ? { x: clamp(px, RAB_AREA.x0 + 10, RAB_AREA.x1 - 10), top: py < HUTCH.y0 + 20 } : null;
    if (z.startsWith('pen')) { const p = PENS[+z.slice(3)]; return px > p.x0 - 12 && px < p.x1 + 12 && py > p.y1 && py < p.y1 + 34 ? { x: clamp(px, p.x0 + 12, p.x1 - 12) } : null; }
    return null;
  };

  // ---------- fiskarna, bubblorna och fåglarna ----------
  const FISHCOL = [[0x3a9ae0, 0xe04040], [0xf08a2a, 0xffd080], [0xf0d040, 0x3a7bd5], [0xe8e8f0, 0x2a2a30], [0xd9433b, 0xf4f1ea], [0x46c0a0, 0xf0f0a0]];
  const fish = [];
  TANKS.forEach((tk, ti) => { for (let i = 0; i < 5; i++) fish.push({ ti, x: tk.x0 + 6 + rnd() * (tk.x1 - tk.x0 - 12), y: tk.y0 + 5 + Math.floor(rnd() * (tk.y1 - tk.y0 - 11)), v: (4 + rnd() * 5) * (rnd() < 0.5 ? -1 : 1), c: FISHCOL[(ti * 5 + i) % FISHCOL.length], pause: 0, bob: rnd() * 6 }); });
  const bubbles = TANKS.flatMap((tk, ti) => [0, 1, 2, 3].map((k) => ({ ti, x: tk.x0 + 4 + (ti ? 34 : 0), y: tk.y1 - 3 - k * 4, s: 5 + rnd() * 3 })));
  const PERCHES = [{ x: CAGE.x - 5, y: CAGE.y - 38 }, { x: CAGE.x + 4, y: CAGE.y - 38 }, { x: CAGE.x - 2, y: CAGE.y - 28 }, { x: CAGE.x + 5, y: CAGE.y - 28 }, { x: CAGE.x - 4, y: CAGE.y - 20 }, { x: CAGE.x + 3, y: CAGE.y - 20 }];
  const birds = [
    { p: 0, hop: 0, T: 1, from: 0, c: [0x5cc040, 0xf0e060, 0x2d6a8a], face: 1 },
    { p: 3, hop: 0, T: 2.5, from: 3, c: [0x4a8ae8, 0xf4f4f0, 0x2a3a7a], face: -1 },
    { p: 4, hop: 0, T: 3.5, from: 4, c: [0xf0d040, 0xfff4b0, 0x8a7020], face: 1 },
  ];

  // ---------- expediten ----------
  const clerk = createWalker({ W, H, top: WALL_Y + 4, bottom: H - 6, spawn: [688, 176] });
  clerk.setObstacles(OBST);
  clerk.speed = 34;
  const PLAN = [
    { to: [688, 176], face: 'down', act: 'drop', wait: 1.6 },
    { to: [249, 146], face: 'up', wait: 1.1, act: 'takeSack' },
    { to: [280, WALL_Y + 12], face: 'up', wait: 3.4, after: 'dropSack' },
    { to: [356, 206], face: 'up', wait: 2.6 },
    { to: [598, 134], face: 'up', wait: 2.8 },
    { to: 'pup', act: 'pickup', wait: 0.7 },
    { to: [486, 132], face: 'down', wait: 2.6 },
  ];
  const C = { step: 0, phase: 'start', wait: 0, carry: 'pup', dir: 'down', talk: 0, bubble: 0 };
  const startStep = () => {
    const s = PLAN[C.step];
    C.phase = 'walk';
    if (s.to === 'pup') { clerk.walkTo(pup.x + 5, pup.y, () => { C.phase = 'arrived'; }); return; }
    clerk.walkTo(s.to[0], s.to[1], () => { C.phase = 'arrived'; });
  };
  function updateClerk(dt) {
    if (C.talk > 0) { // pratar med spelaren
      C.talk -= dt; C.dir = toward({ x: clerk.px, y: clerk.py }, { x: walker.px, y: walker.py });
      if (C.talk <= 0) startStep();
      return;
    }
    if (C.phase === 'start') { startStep(); return; }
    const s = PLAN[C.step];
    if (C.phase === 'walk') {
      clerk.update(dt);
      if (clerk.path.length) C.dir = clerk.dir;
      if (s.to === 'pup') {
        // valpen springer fram till expediten
        const d = Math.hypot(pup.x - clerk.px, pup.y - clerk.py);
        if (d < 26) { pup.mode = 'go'; pup.tx = clamp(clerk.px - 4, pup.area.x0, pup.area.x1); pup.ty = clamp(clerk.py + 2, pup.area.y0, pup.area.y1); pup.fast = true; pup.modeT = 2; pup.then = { pose: 'happy', dur: 3, face: 'up' }; }
        if (d < 8) { clerk.stop(); C.phase = 'arrived'; }
      }
      return;
    }
    if (C.phase === 'arrived') {
      if (s.face) C.dir = s.face;
      if (s.act === 'drop' && C.carry === 'pup') {
        C.carry = null; pup.carried = false; pup.x = clamp(clerk.px + 2, pup.area.x0, pup.area.x1); pup.y = clamp(clerk.py + 3, pup.area.y0, pup.area.y1); pup.z = 12;
        rest(pup, 'happy', 1.2, 'down'); pup.dir = 'down';
      }
      if (s.act === 'pickup') { C.carry = 'pup'; pup.carried = true; C.dir = 'down'; }
      if (s.act === 'takeSack') C.carry = 'sack';
      C.phase = 'wait'; C.wait = s.wait;
      return;
    }
    if (C.phase === 'wait') {
      C.wait -= dt;
      if (C.wait <= 0) {
        if (s.after === 'dropSack') C.carry = null;
        C.step = (C.step + 1) % PLAN.length; startStep();
      }
    }
  }

  // ---------- klickbara platser ----------
  const actorSpot = (a) => {
    const b = petBox(a.pet, animOf(a), a.dir);
    const x = Math.round(a.x), y = Math.round(a.y - a.z);
    const r = [x + b.x0 - 2, y + b.y0 - 2, x + b.x1 + 2, y + b.y1 + 2];
    let go;
    if (a.zone === 'katt') go = [clamp(a.x, WIN.x0 + 8, WIN.x1 - 8), WALL_Y + 20];
    else if (a.zone === 'kanin') go = [clamp(a.x, HUTCH.x0 + 6, HUTCH.x1 - 6), HUTCH.y0 - 8];
    else if (a.zone === 'rug') go = [clamp(a.x + 12, RUG.x0, RUG.x1), clamp(a.y, RUG.y0, H - 8)];
    else { const p = PENS[+a.zone.slice(3)]; go = [clamp(a.x, p.x0 + 6, p.x1 - 6), p.y1 + 12]; }
    return { r, go };
  };
  const petSpots = () => actors.filter((a) => !a.carried).map((a) => {
    const { r, go } = actorSpot(a);
    return { id: a.sale ? a.pet.species + '-' + a.pet.breed : 'valp', actor: a, r, go, act: () => (a.sale ? openPetBuy(a) : (play('click'), toast(`🐶 Det där är Pluttan, Kajsas egen valp – hon är inte till salu! Men titta i hagarna, där finns ${actors.filter((x) => x.sale && x.pet.species === 'hund').length} valpar.`))) };
  });
  const bayX = (i) => FODER.x0 + i * 48;
  const staticSpots = [
    { id: 'dorr', r: [DOOR.x0 - 2, 26, DOOR.x1 + 2, WALL_Y + 4], go: [(DOOR.x0 + DOOR.x1) / 2, WALL_Y + 10], act: () => { play('door'); A.go('city'); } },
    ...BAYS.map((sp, i) => ({ id: 'sack-' + sp, ware: 'sack-' + sp, bay: i, r: [bayX(i) + 1, FODER.top - 10, bayX(i) + 47, WALL_Y - 2], go: [bayX(i) + 24, WALL_Y + 12] })),
    ...WARES.map((w) => {
      const d = PET_ITEMS[w.k];
      const r = [w.x - Math.max(8, (d.w >> 1) + 3), w.y - d.h - 4, w.x + Math.max(8, (d.w >> 1) + 3), w.y + 7];
      const go = w.stand === 'podium' ? [w.x, PODIUM.y1 + 10] : w.stand === 'burp' ? [BURP.x1 + 10, BURP.y1 - 6] : w.stand === 'korgp' ? [w.x, KORGP.y1 + 10] : [w.x, GOND.y + GOND.h + 8];
      return { id: w.k, ware: w.k, w, r, go };
    }),
    { id: 'pall', ware: 'sack-hund', r: [PALLET.x0, PALLET.y0 - 22, PALLET.x1, PALLET.y1], go: [(PALLET.x0 + PALLET.x1) / 2, PALLET.y1 + 9] },
    { id: 'kassa', r: [DESK.x, DESK.y - 30, DESK.x + DESK.w, DESK.y + DESK.h], go: [DESK.x + DESK.w / 2, DESK.y + DESK.h + 10], act: () => { play('click'); toast(TIPS[Math.floor(t * 7) % TIPS.length]); } },
    { id: 'akvarium', r: [AQUA.x0, 8, AQUA.x1, WALL_Y - 4], go: [(AQUA.x0 + AQUA.x1) / 2, WALL_Y + 12], act: () => { play('click'); toast('🐠 Akvarierna är butikens egna – fiskarna är inte till salu. Titta gärna!'); } },
    { id: 'fagel', r: [CAGE.x - 13, CAGE.y - 52, CAGE.x + 13, CAGE.y], go: [CAGE.x, CAGE.y + 10], act: () => { play('chirp'); toast('🐦 Undulaterna Pip, Blå och Citron bor här i butiken. Kvitter kvitter!'); } },
    { id: 'kattrum', r: [WIN.x0, WIN.y0, WIN.x1, WIN.y1], go: [(WIN.x0 + WIN.x1) / 2, WALL_Y + 20], act: () => { play('click'); toast('🐱 Kattrummet! Klicka på en kattunge så får du hälsa på den.'); } },
    { id: 'skylt', r: [BOARD.x - 15, BOARD.y - 30, BOARD.x + 15, BOARD.y], go: [BOARD.x, BOARD.y + 10], act: () => { play('click'); toast('🐶 Nya valpar har kommit! Gå till hagarna längst till höger och hälsa på dem.'); } },
    { id: 'valplek', r: [RUG.x0, RUG.y0, RUG.x1, RUG.y1], go: [RUG.x0 + 20, RUG.y0 + 20], act: () => { play('click'); toast('🐾 Valpleken – här får Pluttan springa av sig.'); } },
  ];
  for (const s of staticSpots) if (s.ware) s.act = () => openItemBuy(s.ware);
  const clerkSpot = () => ({ id: 'personal', r: [clerk.px - 7, clerk.py - 28, clerk.px + 7, clerk.py + 2], go: [clerk.px + (walker.px < clerk.px ? -14 : 14), clerk.py + 2], act: talkToClerk });
  function talkToClerk() {
    play('click');
    clerk.stop(); C.talk = 3; C.bubble = 3;
    toast(TIPS[Math.floor(rnd() * TIPS.length)]);
  }
  // djuren först (de ligger ovanpå), främst den som står längst fram
  const allSpots = () => [...petSpots().sort((a, b) => b.actor.y - a.actor.y), clerkSpot(), ...staticSpots];
  const inR = (s, x, y) => x >= s.r[0] && x <= s.r[2] && y >= s.r[1] && y <= s.r[3];
  // överlappar flera djur väljs det vars mitt ligger närmast klicket
  const spotAt = (x, y) => {
    const list = allSpots().filter((s) => inR(s, x, y));
    const pets = list.filter((s) => s.actor);
    if (pets.length > 1) return pets.sort((a, b) => Math.hypot((a.r[0] + a.r[2]) / 2 - x, (a.r[1] + a.r[3]) / 2 - y) - Math.hypot((b.r[0] + b.r[2]) / 2 - x, (b.r[1] + b.r[3]) / 2 - y))[0];
    return list[0];
  };
  const spotById = (id) => {
    const list = allSpots();
    return list.find((s) => s.id === id) || (['katt', 'hund', 'kanin'].includes(id) ? list.find((s) => s.actor?.sale && s.actor.pet.species === id && !s.actor.perch) : null) || null;
  };
  const focusSpot = () => {
    if (hoverId && t - hoverT < 4) { const h = allSpots().find((s) => s.id === hoverId); if (h && (h.actor || h.ware)) return h; }
    if (walker.path.length) return null;
    // djuret man står vid (närmast), annars varan
    let best = null, bd = 1e9;
    for (const s of petSpots()) {
      if (!s.actor.sale) continue;
      const d = Math.hypot(walker.px - s.go[0], walker.py - s.go[1]);
      if (d < 10 && d < bd) { bd = d; best = s; }
    }
    return best || staticSpots.find((s) => s.ware && Math.abs(walker.px - s.go[0]) < 7 && Math.abs(walker.py - s.go[1]) < 7) || null;
  };

  // ---------- köpdialogerna ----------
  const record = (o) => { bought.push({ ...o, t: Math.round(t * 10) / 10 }); };
  function openPetBuy(a) {
    hoverId = null;
    openPetDialog(A, a.pet, {
      onBuy: (res) => {
        record({ type: 'pet', species: res.pet.species, breed: res.pet.breed, sex: res.pet.sex, name: res.pet.name, id: res.pet.id, price: res.price, extras: res.extras });
        // det köpta djuret följer med hem – borta ur affären resten av dagen
        const gone = actors.find((x) => x.sale && x.pet.species === res.pet.species && x.pet.breed === res.pet.breed);
        if (gone) {
          sold.add(gone.pet.species + ':' + gone.pet.breed);
          actors.splice(actors.indexOf(gone), 1);
        }
      },
    });
  }
  function openItemBuy(k) {
    hoverId = null;
    openItemDialog(A, k, { onBuy: (res) => record({ type: 'item', k, n: res.n, price: res.price }) });
  }

  // ---------- scenobjektet ----------
  return {
    get worldX() { return walker.px; },
    get worldY() { return walker.py; },
    _debug: {
      spot: (id) => {
        const h = spotById(id);
        if (!h) return null;
        const cx = (h.r[0] + h.r[2]) / 2, cy = (h.r[1] + h.r[3]) / 2;
        // utanför bild? titta dit (släpps vid nästa klick)
        if (lockedCam === null && (cx - cam.x < 8 || cx - cam.x > VW - 8)) { peekCam = clamp(cx - VW / 2, 0, W - VW); cam.x = peekCam; }
        return { x: cx - cam.x, y: cy };
      },
      open: (id) => spotById(id)?.act?.(),
      bought: () => bought.slice(),
      lockCam: (x) => { lockedCam = x === null || x === undefined ? null : clamp(x, 0, W - VW); peekCam = null; cam.x = camTarget(); },
      teleport: (x, y) => { walker.px = x; walker.py = y; walker.stop(); walker.snapFree(); peekCam = null; cam.x = camTarget(); },
      hover: (id) => { hoverId = id || null; hoverT = t; },
      cam: () => cam.x,
      path: () => walker.path.map(([x, y]) => [Math.round(x), Math.round(y)]),
      actors: () => actors.map((a) => ({ species: a.pet.species, breed: a.pet.breed, sex: a.pet.sex, zone: a.zone, x: Math.round(a.x), y: Math.round(a.y), anim: animOf(a), dir: a.dir, sale: a.sale, carried: a.carried })),
      clerk: () => ({ x: Math.round(clerk.px), y: Math.round(clerk.py), step: C.step, phase: C.phase, carry: C.carry }),
      // hoppa i expeditens runda: ställ henne vid förra stegets mål och starta steg n
      clerkStep: (n) => {
        const prev = PLAN[(n + PLAN.length - 1) % PLAN.length];
        const at = prev.to === 'pup' ? [pup.x + 5, pup.y] : prev.to;
        clerk.px = at[0]; clerk.py = at[1]; clerk.stop(); clerk.snapFree();
        if (n === 0 || n === 6) { C.carry = 'pup'; pup.carried = true; }
        else if (n === 3 || n === 2) C.carry = n === 2 ? 'sack' : null;
        else C.carry = null;
        if (n >= 1 && n <= 5) { pup.carried = false; }
        C.step = n; C.talk = 0; startStep();
      },
    },
    update(dt) {
      dt = Math.min(0.1, Math.max(0, dt));
      t += dt;
      walker.update(dt);
      const k = lockedCam !== null || peekCam !== null ? 1 : Math.min(1, dt * 6);
      cam.x += (camTarget() - cam.x) * k;
      // djuren
      const envs = {};
      for (const a of actors) {
        if (!envs[a.zone]) envs[a.zone] = { ...zoneEnv(a.zone), near: nearOf(a.zone) };
        updateActor(a, dt, envs[a.zone]);
      }
      updateClerk(dt);
      if (C.bubble > 0) C.bubble -= dt;
      // valpens boll rullar när valpen leker nära den
      if (!pup.carried && animOf(pup) === 'play' && Math.hypot(pup.x - ball.x, pup.y - ball.y) < 14 && Math.hypot(ball.vx, ball.vy) < 3) {
        const ang = rnd() * Math.PI * 2; ball.vx = Math.cos(ang) * 26; ball.vy = Math.sin(ang) * 14;
      }
      ball.x += ball.vx * dt; ball.y += ball.vy * dt; ball.rot += Math.hypot(ball.vx, ball.vy) * dt * 0.4;
      if (ball.x < RUG.x0 + 8 || ball.x > RUG.x1 - 8) { ball.vx *= -0.8; ball.x = clamp(ball.x, RUG.x0 + 8, RUG.x1 - 8); }
      if (ball.y < RUG.y0 + 8 || ball.y > RUG.y1 - 4) { ball.vy *= -0.8; ball.y = clamp(ball.y, RUG.y0 + 8, RUG.y1 - 4); }
      const fr = Math.pow(0.35, dt); ball.vx *= fr; ball.vy *= fr;
      // fiskar och bubblor
      for (const f of fish) {
        const tk = TANKS[f.ti];
        if (f.pause > 0) { f.pause -= dt; if (f.pause <= 0) f.v = -f.v; continue; }
        f.x += f.v * dt;
        if ((f.v < 0 && f.x < tk.x0 + 5) || (f.v > 0 && f.x > tk.x1 - 6)) { f.pause = 0.4 + rnd() * 0.8; f.x = clamp(f.x, tk.x0 + 5, tk.x1 - 6); }
        else if (rnd() < dt * 0.08) f.pause = 0.6 + rnd();
      }
      for (const b of bubbles) { b.y -= b.s * dt; if (b.y < TANKS[b.ti].y0 + 3) b.y = TANKS[b.ti].y1 - 3; }
      // fåglarna hoppar mellan pinnarna (kort båge, aldrig teleport)
      for (const b of birds) {
        if (b.hop > 0) { b.hop = Math.max(0, b.hop - dt / 0.28); continue; }
        b.T -= dt;
        if (b.T <= 0) {
          const taken = new Set(birds.map((o) => o.p));
          const free = PERCHES.map((_, i) => i).filter((i) => !taken.has(i) && Math.abs(PERCHES[i].y - PERCHES[b.p].y) <= 10);
          if (free.length) { b.from = b.p; b.p = pick(free); b.hop = 1; b.face = PERCHES[b.p].x >= PERCHES[b.from].x ? 1 : -1; }
          b.T = 1.2 + rnd() * 3;
        }
      }
    },
    down(sx, sy) {
      const x = sx + cam.x, y = sy;
      hoverId = null;
      peekCam = null;
      const h = spotAt(x, y);
      if (h) { walker.walkTo(h.go[0], h.go[1], h.act); return; }
      if (y > WALL_Y) walker.walkTo(x, y);
    },
    move(sx, sy) { hoverId = spotAt(sx + cam.x, sy)?.id || null; hoverT = t; },
    key(k) { if (k === 'Escape') walker.stop(); },
    draw(ctx) {
      const cx = Math.round(cam.x);
      ctx.setTransform(A.pxs, 0, 0, A.pxs, -cx * A.pxs, 0);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(bg, 0, 0);
      const focus = focusSpot();
      const fa = focus?.actor || null;

      // ===== väggen: kattrummet bakom glas =====
      ctx.save();
      ctx.beginPath(); ctx.rect(ROOM.x0, ROOM.y0, ROOM.x1 - ROOM.x0, ROOM.y1 - ROOM.y0); ctx.clip();
      drawPetItem(ctx, 'vattenskal', ROOM_WATER.x, ROOM_WATER.y, { water: 0.8, t });
      drawPetItem(ctx, 'matskal', ROOM_BOWL.x, ROOM_BOWL.y, { food: 0.6, foodKind: 'katt' });
      drawPetItem(ctx, 'leksak-boll', 88, 50, { rot: 0 });
      const cats = actors.filter((a) => a.zone === 'katt').sort((a, b) => a.y - b.y);
      for (const a of cats) drawActor(ctx, a, t);
      ctx.restore();
      ctx.drawImage(glassImg, WIN.x0, WIN.y0);
      plate(ctx, (WIN.x0 + WIN.x1) >> 1, WIN.y1 + 2, `KATTUNGAR FRÅN ${Math.min(...SPECIES.katt.breeds.map((b) => b.pris))}:-`, fa?.zone === 'katt' ? '#ffe070' : '#f6efe0');
      for (const a of cats) if (a === fa) marker(ctx, a, t);

      // ===== foderhyllan =====
      BAYS.forEach((sp, i) => {
        const x0 = bayX(i), on = focus?.bay === i;
        if (on) { ctx.fillStyle = 'rgba(255,224,112,.35)'; ctx.fillRect(x0 + 2, FODER.top - 1, 44, FODER.s2 - FODER.top + 1); }
        for (const yy of [FODER.s1, FODER.s2]) for (let j = 0; j < 3; j++) drawPetItem(ctx, 'sack-' + sp, x0 + 11 + j * 13, yy, { left: 10 });
        priceTag(ctx, x0 + 24, FODER.s2 + 3, PET_ITEMS['sack-' + sp].pris, on);
      });

      // ===== akvarierna =====
      for (const b of bubbles) { const tk = TANKS[b.ti]; ctx.fillStyle = 'rgba(230,248,255,0.8)'; ctx.fillRect(Math.round(b.x + Math.sin(b.y * 0.7 + b.ti) * 1.2), Math.round(b.y), 1, 1); if (b.y < tk.y0 + 5) { ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fillRect(Math.round(b.x), tk.y0 + 2, 1, 1); } }
      for (const f of fish) drawFish(ctx, Math.round(f.x), Math.round(f.y + Math.sin(t * 1.3 + f.bob)), f.v > 0 ? 1 : -1, f.c, t + f.bob);
      ctx.drawImage(aquaGlass, AQUA.x0, 8);

      // ===== "så stor blir jag"-tavlorna ovanför hagarna =====
      PENS.forEach((p, i) => {
        const ids = PEN_BREEDS[i], k = Math.floor((t + i * 1.3) / 4) % ids.length;
        const cxp = (p.x0 + p.x1) >> 1;
        ctx.save(); ctx.beginPath(); ctx.rect(cxp - 20, 25, 40, 25); ctx.clip();
        drawPet(ctx, cxp, 47, { species: 'hund', breed: ids[k], sex: 'hane', stage: 'vuxen', id: 'tavla' + i }, 'sit', t * 0.6 + i, 'right');
        ctx.restore();
        const nm = shortName('hund', ids[k]), nw = textW(SMALL, nm) + 4;
        ctx.fillStyle = '#2b2430'; ctx.fillRect(cxp - (nw >> 1) - 1, 52, nw + 2, 8);
        ctx.fillStyle = '#f6efe0'; ctx.fillRect(cxp - (nw >> 1), 53, nw, 6);
        ctxText(ctx, SMALL, nm, cxp - (nw >> 1) + 2, 53, '#3a2a10');
      });

      // ===== golvet: allt som sorteras på y =====
      const D = [...folkDrawables(A, t), selfDrawable(A, walker, t, { folksHere: A.worldFolksHere?.().length || 0 })];
      // valphagarna: djuren + staketet framför
      PENS.forEach((p, i) => {
        const on = fa && fa.zone === 'pen' + i;
        D.push({ fy: p.y0 + 10, draw: () => drawPetItem(ctx, 'matskal', p.x0 + 12, p.y0 + 16, { food: 0.5 + 0.1 * i, foodKind: 'hund' }) });
        D.push({ fy: p.y0 + 11, draw: () => drawPetItem(ctx, i % 2 ? 'leksak-ben' : 'leksak-boll', p.x0 + (i % 2 ? 30 : 34), p.y0 + 20, { rot: i }) });
        D.push({ fy: p.y1 + 0.5, draw: () => {
          ctx.drawImage(penFront, p.x0 - 1, p.y1 - 8);
          const lbl = `FRÅN ${Math.min(...PEN_BREEDS[i].map((id) => breedOf({ species: 'hund', breed: id }).pris))}:-`;
          plate(ctx, (p.x0 + p.x1) >> 1, p.y1 + 3, lbl, on ? '#ffe070' : '#f6efe0');
        } });
      });
      // kaninhagen
      D.push({ fy: HUTCH.y0 + 22, draw: () => drawPetItem(ctx, 'matskal', HUTCH_BOWL.x, HUTCH_BOWL.y, { food: 0.7, foodKind: 'kanin' }) });
      D.push({ fy: HUTCH.y1 + 0.5, draw: () => { ctx.drawImage(hutchFront, HUTCH.x0 - 2, HUTCH.y1 - 10); plate(ctx, (HUTCH.x0 + HUTCH.x1) >> 1, HUTCH.y1 - 3, `KANINUNGAR FRÅN ${Math.min(...SPECIES.kanin.breeds.map((b) => b.pris))}:-`, fa?.zone === 'kanin' ? '#ffe070' : '#f6efe0'); } });
      for (const a of actors) {
        if (a.zone === 'katt' || a.carried) continue;
        D.push({ fy: a.y, draw: () => { drawActor(ctx, a, t); if (a === fa) marker(ctx, a, t); } });
      }
      // valpens boll
      D.push({ fy: ball.y - 0.5, draw: () => drawPetItem(ctx, 'leksak-boll', ball.x, ball.y, { rot: ball.rot }) });
      // podierna med prylar
      const wareDraw = (w) => {
        const on = focus?.w === w;
        drawPetItem(ctx, w.k, w.x, w.y, { food: 0, dirt: 0, t, hover: on });
        priceTag(ctx, w.x, w.y + 3, PET_ITEMS[w.k].pris, on);
      };
      D.push({ fy: PODIUM.y1, draw: () => { ctx.drawImage(podiumImg, PODIUM.x0, PODIUM.y0); WARES.filter((w) => w.stand === 'podium').forEach(wareDraw); } });
      D.push({ fy: BURP.y1, draw: () => { ctx.drawImage(burpImg, BURP.x0, BURP.y0); WARES.filter((w) => w.stand === 'burp').forEach(wareDraw); } });
      D.push({ fy: KORGP.y1, draw: () => { ctx.drawImage(korgpImg, KORGP.x0, KORGP.y0); WARES.filter((w) => w.stand === 'korgp').forEach(wareDraw); } });
      D.push({ fy: GOND.y + GOND.h, draw: () => {
        ctx.drawImage(gondImg, GOND.x, GOND.y);
        for (const w of WARES.filter((x) => x.stand === 'gond')) {
          const on = focus?.w === w;
          if (on) { ctx.fillStyle = 'rgba(255,230,128,.45)'; ctx.fillRect(w.x - 15, w.y - 15, 30, 15); }
          // flera exemplar på hyllan (småsaker i en liten hög)
          if (w.k === 'leksak-boll') for (const [dx, dy] of [[-9, 0], [-5, -1], [-1, 0], [3, -1], [-7, -3], [-3, -3], [7, 0]]) drawPetItem(ctx, w.k, w.x + dx, w.y + dy, { rot: dx + dy, hover: on && dx === 7 });
          else if (w.k === 'leksak-ben') for (const [dx, dy] of [[-8, 0], [4, 0], [-2, -2], [-6, -4], [6, -3]]) drawPetItem(ctx, w.k, w.x + dx, w.y + dy, { hover: on && dx === 4 });
          else {
            drawPetItem(ctx, w.k, w.x - 7, w.y - 1, { food: 0, water: 0 });
            drawPetItem(ctx, w.k, w.x + 5, w.y, { food: 0, water: 0, hover: on });
          }
          priceTag(ctx, w.x, w.y + 2, PET_ITEMS[w.k].pris, on);
        }
      } });
      D.push({ fy: PALLET.y1, draw: () => {
        ctx.drawImage(palletImg, PALLET.x0, PALLET.y1 - 8);
        const on = focus?.id === 'pall';
        for (const [dx, dy] of [[9, 0], [22, 0], [15, -8], [29, -1], [22, -15]]) drawPetItem(ctx, 'sack-hund', PALLET.x0 + dx, PALLET.y1 - 6 + dy, { left: 10 });
        if (on) priceTag(ctx, (PALLET.x0 + PALLET.x1) >> 1, PALLET.y1 + 1, PET_ITEMS['sack-hund'].pris, true);
      } });
      // kassan
      D.push({ fy: DESK.y + DESK.h, draw: () => {
        drawStaff(ctx, CASHIER, DESK.x + 38, DESK.y + 12, 'down', Math.sin(t * 1.7) > 0.93 ? 4 : 0);
        ctx.drawImage(deskImg, DESK.x, DESK.y);
      } });
      // fågelburen
      D.push({ fy: CAGE.y, draw: () => {
        ctx.drawImage(cageBack, CAGE.x - 13, CAGE.y - 52);
        for (const b of birds) {
          const P1 = PERCHES[b.p], P0 = PERCHES[b.from];
          const k = 1 - b.hop, x = P0.x + (P1.x - P0.x) * k, y = P0.y + (P1.y - P0.y) * k - Math.sin(k * Math.PI) * 4;
          drawBird(ctx, Math.round(x), Math.round(y), b.c, b.face, b.hop > 0, t + b.p);
        }
        ctx.drawImage(cageFront, CAGE.x - 13, CAGE.y - 52);
      } });
      // expediten (med valpen eller en säck i famnen)
      D.push({ fy: clerk.py, draw: () => {
        const walking = clerk.path.length > 0 && C.talk <= 0;
        const carrying = !!C.carry;
        const frame = carrying ? (walking ? [7, 9, 8, 9][Math.floor(t * 7) % 4] : 9) : walking ? WALK_SEQ[Math.floor(t * 7) % 4] : (Math.sin(t * 2.1) > 0.92 ? 4 : 0);
        const dir = C.dir;
        const X = Math.round(clerk.px), Y = Math.round(clerk.py);
        const held = () => {
          if (C.carry === 'pup') {
            const ox = dir === 'left' ? -4 : dir === 'right' ? 4 : 0;
            drawPet(ctx, X + ox, Y - 10, PUP, walking ? 'idle' : 'happy', t, dir);
          } else if (C.carry === 'sack') drawPetItem(ctx, 'sack-hund', X + (dir === 'left' ? -4 : dir === 'right' ? 4 : 0), Y - 8, { left: 10 });
        };
        const lifting = C.carry === 'sack' && dir === 'up' && C.phase === 'wait';
        if (dir === 'up' && !lifting) held();
        drawStaff(ctx, CLERK, X, Y, dir, lifting ? 9 : frame);
        if (lifting) drawPetItem(ctx, 'sack-hund', X, Y - 22 - (Math.floor(t * 1.5) % 2), { left: 10 });
        else if (dir !== 'up') held();
        if (C.bubble > 0) iconBubble(ctx, X, Y - 30, (c, x, y) => pawIcon(c, x, y, '#3f9a52'));
        if (focus?.id === 'personal') marker(ctx, { x: X, y: Y - 16, pet: null }, t);
      } });
      for (const [x, y] of PLANTS) D.push({ fy: y, draw: () => ctx.drawImage(plantImg, x - 11, y - 31) });
      D.push({ fy: BOARD.y, draw: () => ctx.drawImage(boardImg, BOARD.x - 15, BOARD.y - 30) });
      D.sort((a, b) => a.fy - b.fy).forEach((d) => d.draw(ctx));

      // ===== skärmens överlägg =====
      ctx.setTransform(A.pxs, 0, 0, A.pxs, 0, 0);
      if (cx > 120) edgeSign(ctx, true, 'KATTER + KANINER', '#f28bb3');
      if (cx < W - VW - 120) edgeSign(ctx, false, 'HUNDAR', '#7fd08a');
      if (focus && (focus.actor || focus.ware)) bigLabel(ctx, focus, t, walker.py > H - 44);
    },
  };
}

// ======================================================================
//  Små ritfunktioner (live)
// ======================================================================
// Gul prislapp ("89:-") med mörk kant, centrerad på x
function priceTag(ctx, x, y, price, hi = false) {
  const lbl = `${price}:-`;
  const w = textW(SMALL, lbl) + 4, x0 = Math.round(x - w / 2);
  if (hi) { ctx.fillStyle = '#ffffff'; ctx.fillRect(x0 - 2, y - 2, w + 4, 11); }
  ctx.fillStyle = '#17151a'; ctx.fillRect(x0 - 1, y - 1, w + 2, 9);
  ctx.fillStyle = '#f0d048'; ctx.fillRect(x0, y, w, 7);
  ctx.fillStyle = '#fff2a0'; ctx.fillRect(x0, y, w, 1);
  ctxText(ctx, SMALL, lbl, x0 + 2, y + 1, '#3a2a10');
}
// Liten skylt fastskruvad på ett staket
function plate(ctx, x, y, lbl, col) {
  const w = textW(SMALL, lbl) + 6, x0 = Math.round(x - w / 2);
  ctx.fillStyle = '#17151a'; ctx.fillRect(x0 - 1, y - 1, w + 2, 9);
  ctx.fillStyle = col; ctx.fillRect(x0, y, w, 7);
  ctx.fillStyle = '#3f9a52'; ctx.fillRect(x0, y, w, 1);
  ctx.fillStyle = '#8a8e9a'; ctx.fillRect(x0 + 1, y + 3, 1, 1); ctx.fillRect(x0 + w - 2, y + 3, 1, 1);
  ctxText(ctx, SMALL, lbl, x0 + 3, y + 1, '#2a2418');
}
// Studsande gul pil ovanför djuret/personen man pekar på
function marker(ctx, a, t) {
  let top;
  if (a.pet) { const b = petBox(a.pet, animOf(a), a.dir); top = Math.round(a.y - a.z) + b.y0 - 3; } else top = a.y - 14;
  const x = Math.round(a.x), y = top - (Math.floor(t * 3) % 2);
  ctx.fillStyle = '#17151a';
  ctx.fillRect(x - 3, y - 4, 7, 1); ctx.fillRect(x - 3, y - 3, 1, 1); ctx.fillRect(x + 3, y - 3, 1, 1);
  ctx.fillRect(x - 2, y - 2, 1, 1); ctx.fillRect(x + 2, y - 2, 1, 1); ctx.fillRect(x - 1, y - 1, 1, 1); ctx.fillRect(x + 1, y - 1, 1, 1); ctx.fillRect(x, y, 1, 1);
  ctx.fillStyle = '#ffd23f';
  ctx.fillRect(x - 2, y - 3, 5, 1); ctx.fillRect(x - 1, y - 2, 3, 1); ctx.fillRect(x, y - 1, 1, 1);
}
function pawIcon(ctx, x, y, col) {
  ctx.fillStyle = col;
  ctx.fillRect(x - 3, y - 3, 1, 2); ctx.fillRect(x - 1, y - 4, 1, 2); ctx.fillRect(x + 1, y - 4, 1, 2); ctx.fillRect(x + 3, y - 3, 1, 2);
  ctx.fillRect(x - 2, y, 5, 2); ctx.fillRect(x - 1, y + 2, 3, 1); ctx.fillRect(x - 3, y + 1, 1, 1); ctx.fillRect(x + 3, y + 1, 1, 1);
}
const hexc = (c) => '#' + (c & 0xffffff).toString(16).padStart(6, '0');
// Fisk (5×3) åt höger (dir 1) eller vänster, stjärtfenan viftar
function drawFish(ctx, x, y, dir, [c, c2], t) {
  const px = (i, j, col) => { ctx.fillStyle = col; ctx.fillRect(dir > 0 ? x + i : x + 4 - i, y + j, 1, 1); };
  const hx = hexc(c), hx2 = hexc(c2);
  const wag = Math.floor(t * 6) % 2;
  px(0, wag ? 0 : 1, hx2); px(0, wag ? 2 : 1, hx2);
  px(1, 1, hx); px(2, 0, hx); px(3, 0, hx); px(2, 1, hx2); px(4, 1, hx); px(2, 2, hx); px(3, 2, hx2);
  px(3, 1, '#17151a');
}
// Undulat (5×6) på pinne; fladdrar med vingarna mitt i ett hopp
function drawBird(ctx, x, y, [body, head, tail], face, flying, t) {
  const P = flying
    ? ['..hh.', '.hhhk', 'wbbbw', '.bbb.', '..tt.', '..t..']
    : ['..hh.', '.hhhk', '.bbb.', '.bwb.', '.bbt.', '..t..'];
  const pal = { h: hexc(head), b: hexc(body), w: hexc(mul(body, 0.7)), t: hexc(tail), k: '#e8a040' };
  P.forEach((row, j) => { for (let i = 0; i < 5; i++) { const ch = row[i]; if (ch === '.') continue; ctx.fillStyle = pal[ch]; ctx.fillRect(face > 0 ? x - 2 + i : x + 2 - i, y - 6 + j, 1, 1); } });
  ctx.fillStyle = Math.sin(t * 2.3) > 0.96 ? hexc(head) : '#17151a';
  ctx.fillRect(face > 0 ? x + 1 : x - 1, y - 5, 1, 1);
}
// Skylt i skärmkanten mot den del av butiken man inte ser
function edgeSign(ctx, left, lbl, col) {
  const tw = textW(SMALL, lbl), w = tw + 13, x0 = left ? 3 : VW - w - 3, y0 = H - 14;
  ctx.fillStyle = col; ctx.fillRect(x0 - 1, y0 - 1, w + 2, 11);
  ctx.fillStyle = '#17151a'; ctx.fillRect(x0, y0, w, 9);
  ctxText(ctx, SMALL, lbl, left ? x0 + 9 : x0 + 3, y0 + 2, col);
  ctx.fillStyle = col;
  for (let i = 0; i < 3; i++) ctx.fillRect(left ? x0 + 3 + i : x0 + w - 4 - i, y0 + 4 - i, 1, 1 + 2 * i);
}
// Text som pixeltypsnittet kan rita: tankstreck → '-', "(säck)" → "- SÄCK", okända tecken bort
function pixSafe(F, str) {
  const s = String(str).replace(/[–—]/g, '-').replace(/\s*\(([^)]*)\)/g, ' - $1').toUpperCase();
  return [...s].filter((ch) => ch === ' ' || F[ch]).join('').replace(/\s+/g, ' ').trim();
}
// Namnskylt i skärmens nederkant för djuret/varan man står vid eller pekar på
function bigLabel(ctx, spot, t, atTop) {
  let name, price, hint, col, sub = '';
  if (spot.actor) {
    const p = spot.actor.pet, S = SPECIES[p.species], B = breedOf(p);
    name = pixSafe(BIG, `${B.namn} - ${S.unge}`);
    sub = p.sex === 'hona' ? 'HONA' : 'HANE';
    price = `${B.pris} KR`;
    hint = 'KLICKA SÅ FÅR DU HÄLSA PÅ';
    col = ACCENT[p.species];
  } else {
    const d = PET_ITEMS[spot.ware];
    name = pixSafe(BIG, d.namn);
    price = `${d.pris} KR`;
    hint = 'KLICKA FÖR ATT KÖPA';
    col = '#f0d048';
  }
  const nw = textW(BIG, name), pw = textW(BIG, price), hw = textW(SMALL, hint) + (sub ? textW(SMALL, sub) + 8 : 0);
  const w = Math.max(nw + pw + 26, hw + 26), h = 24;
  const safe = globalThis.SF?.view?.safe || { x0: 0, y0: 0, x1: VW, y1: H }; // synliga rutan (fyll-läget beskär)
  let x0 = Math.round((VW - w) / 2);
  x0 = Math.max(safe.x0 + 2, Math.min(x0, safe.x1 - w - 2));
  const y0 = atTop ? safe.y0 + 3 : Math.min(H, safe.y1) - h - 3;
  ctx.fillStyle = '#0e0d12'; ctx.fillRect(x0 - 2, y0 - 2, w + 4, h + 4);
  ctx.fillStyle = col; ctx.fillRect(x0 - 1, y0 - 1, w + 2, h + 2);
  ctx.fillStyle = '#17151a'; ctx.fillRect(x0, y0, w, h);
  pawIcon(ctx, x0 + 8, y0 + 7, col);
  ctxText(ctx, BIG, name, x0 + 16, y0 + 4, '#ffffff');
  ctxText(ctx, BIG, price, x0 + 22 + nw, y0 + 4, '#f0d048');
  const blink = Math.floor(t * 2) % 2 === 0;
  let hx = x0 + 16;
  if (sub) { ctxText(ctx, SMALL, sub, hx, y0 + 16, sub === 'HONA' ? '#ff9cc0' : '#8fc8ff'); hx += textW(SMALL, sub) + 8; }
  ctxText(ctx, SMALL, hint, hx, y0 + 16, blink ? col : '#c9c2d2');
}

// ======================================================================
//  Förmålade bilder
// ======================================================================
function disc(P, cx, cy, rx, ry, c, a = 1) {
  for (let y = Math.floor(cy - ry); y <= cy + ry; y++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
    if (((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1) P.px(x, y, c, a);
  }
}
function glowText(P, F, s, x, y, c, glow, scale = 1) {
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, 1], [1, -1], [-1, 1]]) text(P, F, s, x + dx, y + dy, glow, 0.35, scale);
  text(P, F, s, x, y, c, 1, scale);
}
const PAW = ['#.#.#', '.....', '.###.', '#####', '.###.'];
const BONE = ['##...##', '.#####.', '##...##'];
function stamp(P, rows, x, y, c, a = 1) { rows.forEach((r, j) => { for (let i = 0; i < r.length; i++) if (r[i] === '#') P.px(x + i, y + j, c, a); }); }
function plank(x, y, base, seed) {
  const ph = 7, row = ((y - WALL_Y) / ph) | 0, yy = (y - WALL_Y) % ph;
  const L = 34, off = (hash(row, 1, seed) * L) | 0;
  const px = x + off, pi = (px / L) | 0, pin = px % L;
  let c = mul(base, 0.93 + hash(pi, row, seed) * 0.12);
  if (yy === ph - 1) c = mul(c, 0.8);
  else if (pin === 0) c = mul(c, 0.84);
  else if (yy === 0) c = mix(c, 0xffffff, 0.1);
  else if (hash(px >> 3, y, seed + 1) > 0.9) c = mul(c, 0.96);
  return c;
}

// ---------- hela butiken ----------
function paintStore() {
  const P = new Pix(W, H);
  // ===== väggar =====
  for (let y = 0; y < WALL_Y; y++) for (let x = 0; x < W; x++) {
    let c;
    if (x < MID0) { // katter: persikorosa tapet med ränder
      c = ((x / 6) | 0) % 2 ? 0xf2d5c6 : 0xecc9b8;
      c = mix(c, 0xffffff, (bayer(x, y) - 0.5) * 0.05);
    } else if (x < MID1) { // mitten: varm puts
      c = mix(0xefe5d2, 0xe4d8c0, hash(x >> 1, y >> 1, 9) * 0.35 + (bayer(x, y) - 0.5) * 0.15);
    } else { // hundar: salviagrön panel
      const r = y % 8;
      c = r === 7 ? 0x6f9a7a : r === 0 ? 0xb4d4b8 : 0x9cc3a4;
      c = mix(c, 0x000000, (bayer(x, y) - 0.5) * 0.05 + (hash((x / 40) | 0, (y / 8) | 0, 5) - 0.5) * 0.05);
    }
    P.px(x, y, c);
  }
  for (let y = 10; y < 58; y += 12) for (let x = 2; x < MID0 - 6; x += 14) stamp(P, PAW, x + (((y / 12) | 0) % 2 ? 7 : 0), y, 0xfff4ec, 0.5);
  for (let y = 6; y < 58; y += 10) for (let x = MID1 + 4; x < W - 8; x += 18) stamp(P, BONE, x + (((y / 10) | 0) % 2 ? 9 : 0), y, 0xd8ecd8, 0.45);
  // bröstpanel
  for (let x = 0; x < W; x++) {
    const zone = x < MID0 ? 0 : x < MID1 ? 1 : 2;
    const base = [0xfaf2ec, 0xb98a5e, 0x3f7a58][zone], trim = [0xd99a8a, 0x8a6440, 0x2f5a42][zone];
    for (let y = WALL_Y - 12; y < WALL_Y; y++) {
      let c = base;
      if (y === WALL_Y - 12) c = trim;
      else if (y === WALL_Y - 11) c = mix(trim, 0xffffff, 0.35);
      else if (y >= WALL_Y - 2) c = mul(trim, 0.7);
      else if (x % 24 === 0) c = mul(base, 0.88);
      else if (x % 24 === 1) c = mix(base, 0xffffff, 0.25);
      P.px(x, y, c);
    }
  }
  // takskena med spotlights och ljuskäglor
  P.rect(0, 0, W, 3, 0x2a2430); P.hl(0, 2, W, 0x4a4450);
  for (let x = 30; x < W; x += 52) {
    if (x > DOOR.x0 - 20 && x < DOOR.x1 + 20) continue;
    P.ell(x, 22, 16, 26, 0xfff4dc, 0.2, 5);
    P.rect(x - 2, 3, 5, 3, 0x1d1822); P.hl(x - 1, 5, 3, 0xfff6c8);
  }
  // pelare mellan zonerna
  for (const px of [MID0, MID1]) {
    P.rect(px - 4, 0, 8, WALL_Y, 0xdcd4c8);
    P.vl(px - 4, 0, WALL_Y, 0xf2ece2); P.vl(px - 3, 0, WALL_Y, 0xe8e0d4);
    P.vl(px + 2, 0, WALL_Y, 0xb8ae9e); P.vl(px + 3, 0, WALL_Y, 0x8a8070);
    P.rect(px - 5, 3, 10, 3, 0xc9bfae); P.rect(px - 5, WALL_Y - 4, 10, 4, 0xa89e8c);
  }

  paintCatRoom(P);
  paintFoderShelf(P);
  // ===== dörren + skylten TASSEN =====
  const bw = 60, bx = 384 - bw / 2;
  P.ell(384, 14, 44, 16, 0x7fd08a, 0.18, 5);
  P.rect(bx, 4, bw, 21, 0x17221a); P.box(bx, 4, bw, 21, 0x3f9a52); P.box(bx + 1, 5, bw - 2, 19, 0x1f3a26);
  glowText(P, BIG, 'TASSEN', 384 - textW(BIG, 'TASSEN') / 2 + 4, 8, 0xc8f0a0, 0x3f9a52);
  stamp(P, PAW, bx + 5, 9, 0xf0d048);
  text(P, SMALL, 'DJURAFFÄR', 384 - textW(SMALL, 'DJURAFFÄR') / 2, 18, 0xf0d048);
  P.vl(bx + 6, 2, 2, 0x8a8e9a); P.vl(bx + bw - 7, 2, 2, 0x8a8e9a);
  P.rect(DOOR.x0 - 2, 28, DOOR.x1 - DOOR.x0 + 4, WALL_Y - 28, 0x2a2430);
  for (let i = 0; i < 2; i++) {
    const gx = DOOR.x0 + 1 + i * 16;
    for (let y = 30; y < WALL_Y - 1; y++) for (let x = gx; x < gx + 14; x++) {
      let c = mix(0xa8d4e6, 0x6f9fb8, (y - 30) / 40);
      if ((x - y + 400) % 17 < 2) c = mix(c, 0xffffff, 0.35);
      P.px(x, y, c);
    }
    P.rect(gx + 2, 50, 10, 2, 0xc9c9d4); P.hl(gx + 2, 50, 10, 0xf2f2f6);
  }
  stamp(P, PAW, DOOR.x0 + 5, 40, 0xffffff, 0.7); stamp(P, PAW, DOOR.x1 - 10, 40, 0xffffff, 0.7);
  P.rect(DOOR.x0 + 7, 30, 18, 7, 0x1d2b1f); text(P, SMALL, 'UT', DOOR.x0 + 12, 31, 0x6fe08a);
  P.rect(DOOR.x0 - 4, WALL_Y, DOOR.x1 - DOOR.x0 + 8, 10, 0x2f4a36);
  P.box(DOOR.x0 - 4, WALL_Y, DOOR.x1 - DOOR.x0 + 8, 10, 0x4f7a58);
  stamp(P, PAW, 382, WALL_Y + 3, 0x8ac89a);
  // ===== kassaväggen: skylt + godishylla =====
  const kw = textW(SMALL, 'KASSA') + 10, kx = Math.round(DESK.x + DESK.w / 2 - kw / 2);
  P.rect(kx, 28, kw, 10, 0x17151a); P.box(kx, 28, kw, 10, 0x3f9a52);
  text(P, SMALL, 'KASSA', kx + 5, 31, 0xc8f0a0);
  P.rect(DESK.x + 4, 52, DESK.w - 8, 2, 0xc9a06b); P.hl(DESK.x + 4, 52, DESK.w - 8, 0xe8c890); P.hl(DESK.x + 4, 54, DESK.w - 8, 0x7a5a38);
  const JARS = [0xd9433b, 0xf0b429, 0x46a35a, 0x8e5bd1, 0x3a7bd5, 0xe07a2e];
  JARS.forEach((c, i) => {
    const x = DESK.x + 6 + i * 9;
    P.rect(x, 44, 7, 8, 0xdfeef4); P.box(x, 44, 7, 8, 0x8aa0aa); P.rect(x + 1, 43, 5, 2, 0x3a3440);
    for (let k = 0; k < 6; k++) P.px(x + 1 + (k % 3) * 2, 47 + ((k / 3) | 0) * 2, mix(c, 0xffffff, (k % 2) * 0.3));
    P.px(x + 1, 45, 0xffffff);
  });
  // ===== akvarieväggen =====
  paintAquarium(P);
  // ===== hundväggen: skylt + tavelramar =====
  const hs = 'HUNDAR', hw = textW(BIG, hs, 2) + 30, hx = Math.round(650 - hw / 2);
  P.ell(650, 12, hw * 0.7, 18, 0x7fd08a, 0.2, 5);
  P.rect(hx, 3, hw, 20, 0x14241a); P.box(hx, 3, hw, 20, 0x2f5a42); P.box(hx + 1, 4, hw - 2, 18, 0x7fd08a);
  glowText(P, BIG, hs, hx + 15, 6, 0xd8ffc8, 0x3f9a52, 2);
  stamp(P, BONE, hx + 4, 11, 0xd8ffc8); stamp(P, BONE, hx + hw - 11, 11, 0xd8ffc8);
  for (const p of PENS) {
    const cxp = (p.x0 + p.x1) >> 1;
    P.rect(cxp - 22, 23, 44, 29, 0x6b4a33); P.box(cxp - 22, 23, 44, 29, 0x3a2418); P.hl(cxp - 21, 24, 42, 0x8a6446);
    for (let y = 25; y < 50; y++) for (let x = cxp - 20; x < cxp + 20; x++) P.px(x, y, mix(0xf4ecd8, 0xe0d0b0, (y - 25) / 25 + (bayer(x, y) - 0.5) * 0.1));
    P.rect(cxp - 20, 44, 40, 6, 0xc8dcc0);
  }
  // ===== golv =====
  for (let y = WALL_Y; y < H; y++) for (let x = 0; x < W; x++) {
    let c;
    if (x < MID0) c = plank(x, y, 0xd9b48a, 13);
    else if (x < MID1) {
      const tx = ((x - MID0) / 16) | 0, ty = ((y - WALL_Y) / 16) | 0;
      c = (tx + ty) % 2 ? 0xeee6d8 : 0xe0d5c2;
      c = mix(c, 0xd0c4ae, hash(x >> 2, y >> 2, 17) * 0.25);
      if ((x - MID0) % 16 === 0 || (y - WALL_Y) % 16 === 0) c = 0xc9bca4;
    } else {
      c = mix(0xc4cec0, 0xb4c0b0, hash(x >> 1, y >> 1, 23) * 0.5);
      if (hash(x, y, 29) > 0.93) c = mix(c, 0xffffff, 0.3);
      if (hash(x, y, 31) > 0.95) c = mul(c, 0.86);
      if ((x - MID1) % 24 === 0 || (y - WALL_Y) % 24 === 0) c = mul(c, 0.93);
    }
    P.px(x, y, c);
  }
  // lister mellan zonerna
  for (const px of [MID0, MID1]) { P.rect(px - 1, WALL_Y, 2, H - WALL_Y, 0xd8b24a); P.vl(px - 1, WALL_Y, H - WALL_Y, 0xf0d890); }
  // valpleken (matta med rundade hörn och tassar)
  for (let y = RUG.y0; y < RUG.y1; y++) for (let x = RUG.x0; x < RUG.x1; x++) {
    const ex = Math.min(x - RUG.x0, RUG.x1 - 1 - x), ey = Math.min(y - RUG.y0, RUG.y1 - 1 - y);
    const r = 10, cxr = Math.max(0, r - ex), cyr = Math.max(0, r - ey);
    const d = Math.hypot(cxr, cyr);
    if (d > r) continue;
    let c = 0x6fb8d8;
    if (d > r - 2.5 || ex < 2 || ey < 2) c = 0x2f7aa0;
    else if (d > r - 3.5 || ex < 3 || ey < 3) c = 0xe8f4f8;
    else if (((x + y) >> 2) % 2 === 0) c = 0x7cc4e0;
    P.px(x, y, mix(c, 0x000000, (bayer(x, y) - 0.5) * 0.06));
  }
  for (let k = 0; k < 9; k++) stamp(P, PAW, RUG.x0 + 16 + (k % 3) * 36 + ((k / 3) | 0) * 6, RUG.y0 + 10 + ((k / 3) | 0) * 14, 0xe8f4f8, 0.55);
  // tasspår från dörrmattan: ett spår till katterna och ett till hundarna
  for (let k = 0; k < 7; k++) {
    stamp(P, PAW, 372 - k * 17 - (k % 2) * 3, 88 + k * 5 + (k % 2) * 3, 0xb8a888, 0.5);
    stamp(P, PAW, 392 + k * 18 + (k % 2) * 3, 112 + k * 2 + (k % 2) * 3, 0xb8a888, 0.5);
  }
  // skugga längs väggen
  for (let i = 0; i < 5; i++) P.darken(0, WALL_Y + i, W, 1, 0.8 + i * 0.04);
  // valphagarna (golv + bakre staket + sidor) och kaninhagen
  for (const p of PENS) paintPenBack(P, p);
  paintHutchBack(P);
  // ljuspölar
  P.ell(84, 116, 70, 12, 0xfff6e0, 0.22, 4);
  P.ell(GOND.x + GOND.w / 2, GOND.y + GOND.h, 64, 10, 0xfff6e0, 0.2, 4);
  P.ell(579, 184, 30, 7, 0xfff6e0, 0.25, 4);
  P.box(0, 0, W, H, 0x0e0d12);
  return P.flush();
}

// Kattrummet: en nisch i väggen bakom glas – bakvägg, sidoväggar, heltäckningsmatta,
// klätterträd, kattkub, hyllor, en tavla och ett litet fönster. Kattungarna ritas live.
function paintCatRoom(P) {
  const { x0, x1, y0, y1 } = WIN;
  const R = ROOM, fl = R.floor, ins = 6;
  // ram (vitmålat trä med grön list)
  P.rect(x0, y0, x1 - x0, y1 - y0, 0xf4f1ea);
  P.box(x0, y0, x1 - x0, y1 - y0, 0x5a5048);
  P.hl(x0 + 1, y0 + 1, x1 - x0 - 2, 0xffffff); P.hl(x0 + 1, y1 - 2, x1 - x0 - 2, 0xc8c0b0);
  P.rect(x0 - 2, y1 - 1, x1 - x0 + 4, 3, 0x3f9a52); P.hl(x0 - 2, y1 - 1, x1 - x0 + 4, 0x7fd08a); P.hl(x0 - 2, y1 + 1, x1 - x0 + 4, 0x2b6a3a);
  // bakvägg (lila med tapetränder, mörkare uppåt)
  for (let y = R.y0; y < fl; y++) for (let x = R.x0; x < R.x1; x++) {
    let c = ((x / 5) | 0) % 2 ? 0xd4c0e4 : 0xcab4dc;
    c = mix(c, 0x6a4a8a, (1 - (y - R.y0) / (fl - R.y0)) * 0.18);
    P.px(x, y, c);
  }
  // golv: heltäckningsmatta med mönster, mörkare längst in
  for (let y = fl; y < R.y1; y++) for (let x = R.x0; x < R.x1; x++) {
    let c = 0xe9dcc0;
    if (((x + y * 2) % 9 === 0) || ((x - y * 2 + 900) % 9 === 0)) c = 0xdccaa8;
    c = mix(c, 0x6a5a40, (1 - (y - fl) / (R.y1 - fl)) * 0.22 + (bayer(x, y) - 0.5) * 0.06);
    P.px(x, y, c);
  }
  // sidoväggarna (perspektiv): smala kilar som går ihop mot bakväggen
  for (let y = R.y0; y < R.y1; y++) {
    const w = y < fl ? ins : Math.round(ins * (1 - (y - fl) / (R.y1 - fl)));
    for (let i = 0; i < w; i++) { P.px(R.x0 + i, y, mix(0xa890c0, 0x5a4870, i / ins * 0.4)); P.px(R.x1 - 1 - i, y, mix(0xa890c0, 0x5a4870, i / ins * 0.4)); }
  }
  P.hl(R.x0 + ins, fl, R.x1 - R.x0 - ins * 2, 0xf4f1ea); P.hl(R.x0 + ins, fl + 1, R.x1 - R.x0 - ins * 2, 0xa89880); // golvlist
  // litet fönster med himmel och gardiner
  P.rect(150, 12, 26, 14, 0xf4f1ea); P.rect(152, 14, 22, 10, 0x8fd0f0); P.rect(152, 20, 22, 4, 0xbfe6f8);
  P.rect(160, 18, 7, 3, 0xffffff); P.rect(158, 19, 3, 2, 0xffffff);
  P.vl(163, 14, 10, 0xf4f1ea); P.rect(150, 11, 26, 2, 0xe07a8a);
  for (let y = 13; y < 26; y++) { P.px(151, y, 0xf09aaa); P.px(174, y, 0xf09aaa); }
  // vägghyllor för katter (trä + konsoler)
  for (const [sx, sy, sw] of [[86, 19, 20], [112, 25, 16]]) {
    P.rect(sx, sy, sw, 2, 0xc9a06b); P.hl(sx, sy, sw, 0xe8c890); P.hl(sx, sy + 2, sw, 0x7a5a38);
    P.px(sx + 2, sy + 3, 0x7a5a38); P.px(sx + sw - 3, sy + 3, 0x7a5a38);
  }
  // tavla med en fisk
  P.rect(126, 12, 14, 9, 0xf0d048); P.rect(127, 13, 12, 7, 0xbfe6f8);
  for (const [fx, fy] of [[129, 16], [130, 15], [131, 15], [132, 16], [131, 17], [130, 17], [133, 15], [133, 17], [131, 16], [130, 16]]) P.px(fx, fy, 0xe07a2e);
  // kattkuben med runt hål
  P.rect(62, 22, 18, 13, 0xb8a4d0); P.rect(62, 22, 18, 2, 0xd4c4e8); P.vl(79, 24, 11, 0x8a74a8);
  disc(P, 70, 29, 4, 4, 0x3a2e48); P.hl(66, 34, 13, 0x6a5a88);
  // klätterträdet: bas, sisalstam, mellanhylla (katt sover här), topphylla, hängande boll
  P.rect(34, 31, 26, 5, 0xb8a890); P.hl(34, 31, 26, 0xd8c8b0); P.hl(34, 35, 26, 0x7a6a58);
  for (let y = 14; y < 31; y++) { const r = (y % 2) ? 0xd8c090 : 0xc0a470; P.rect(45, y, 4, 1, r); P.px(48, y, mul(r, 0.8)); }
  P.rect(35, 24, 24, 3, 0xd8c8b0); P.hl(35, 24, 24, 0xece0cc); P.hl(35, 27, 24, 0x8a7a64); P.rect(35, 26, 24, 1, 0xb8a890);
  P.rect(40, 12, 14, 3, 0xd8c8b0); P.hl(40, 12, 14, 0xece0cc); P.hl(40, 15, 14, 0x8a7a64);
  P.vl(52, 15, 5, 0xe8e0d0); P.rect(51, 20, 3, 3, 0xe04a7a); P.px(51, 20, 0xff9cc0);
  // kattsängen (rund kudde) och garnnystanet
  disc(P, ROOM_BED.x, ROOM_BED.y - 1, 10, 4.5, 0x7a4a8a); disc(P, ROOM_BED.x, ROOM_BED.y - 1, 8, 3, 0xe8c8e8);
  P.hl(ROOM_BED.x - 9, ROOM_BED.y + 2, 18, 0x4a2a5a);
  disc(P, 104, 50, 3, 2.5, 0x3a7bd5); P.px(103, 49, 0x8ab8f0); P.line(106, 51, 112, 53, 0x3a7bd5);
  // leksaksmus
  P.rect(70, 51, 4, 2, 0x9a9aa4); P.px(74, 51, 0xf0a0b0); P.line(69, 52, 66, 53, 0x9a9aa4); P.px(71, 50, 0xb4b4bc);
}
// Glaset framför kattrummet: reflexer, texten KATTRUMMET på rutan, klistermärken, spröjs
function paintGlass() {
  const w = WIN.x1 - WIN.x0, h = WIN.y1 - WIN.y0;
  const P = new Pix(w, h);
  const R = { x0: ROOM.x0 - WIN.x0, y0: ROOM.y0 - WIN.y0, x1: ROOM.x1 - WIN.x0, y1: ROOM.y1 - WIN.y0 };
  for (let y = R.y0; y < R.y1; y++) for (let x = R.x0; x < R.x1; x++) {
    const d = ((x - y * 0.9) % 58 + 58) % 58;
    if (d < 5) P.px(x, y, 0xffffff, 0.13);
    else if (d > 8 && d < 10) P.px(x, y, 0xffffff, 0.2);
    else P.px(x, y, 0xdff0ff, 0.05);
  }
  // spröjsen
  const m = MULLION - WIN.x0;
  P.rect(m, R.y0, 3, R.y1 - R.y0, 0xe8e4dc); P.vl(m, R.y0, R.y1 - R.y0, 0xffffff); P.vl(m + 2, R.y0, R.y1 - R.y0, 0xa8a090);
  // texten på glaset
  for (const half of [0]) {
    const cx = (R.x0 + m) / 2 + 25; // mellan klätterträdet (katten sover där, zzz driver åt höger) och spröjsen
    const s = 'KATTRUMMET', sw = textW(SMALL, s);
    text(P, SMALL, s, Math.round(cx - sw / 2) + 1, R.y0 + 4, 0x6a4a8a, 0.5);
    text(P, SMALL, s, Math.round(cx - sw / 2), R.y0 + 3, 0xffffff, 0.9);
  }
  // tassklistermärken i nederkanten
  for (const x of [R.x0 + 4, R.x1 - 10, m - 9, m + 6]) stamp(P, PAW, x, R.y1 - 7, 0xffffff, 0.55);
  return P.flush();
}

// Foderhyllan: tre fack med rubrik (KATTMAT/KANINMAT/HUNDMAT), två hyllplan. Säckarna ritas live.
function paintFoderShelf(P) {
  const { x0, x1, top, s1, s2 } = FODER;
  P.rect(x0, top - 10, x1 - x0, s2 + 3 - top + 10, 0x6b4a33);
  P.rect(x0 + 2, top, x1 - x0 - 4, s2 - top, 0xe8dcc4);
  for (let y = top + 2; y < s2; y += 4) for (let x = x0 + 4; x < x1 - 3; x += 4) P.px(x, y, 0xd4c4a4);
  BAYS.forEach((sp, i) => {
    const bx = x0 + i * 48;
    const lbl = { katt: 'KATTMAT', kanin: 'KANINMAT', hund: 'HUNDMAT' }[sp];
    const col = { katt: 0xf28bb3, kanin: 0xf0d048, hund: 0x7fd08a }[sp];
    P.rect(bx + 2, top - 9, 44, 8, 0x17151a); P.hl(bx + 2, top - 2, 44, col);
    text(P, SMALL, lbl, Math.round(bx + 24 - textW(SMALL, lbl) / 2), top - 8, col);
    if (i) { P.rect(bx - 1, top - 10, 2, s2 - top + 13, 0x4a3222); P.vl(bx - 1, top - 10, s2 - top + 13, 0x8a6446); }
  });
  for (const sy of [s1, s2]) {
    P.rect(x0, sy, x1 - x0, 2, 0xc9a06b); P.hl(x0, sy, x1 - x0, 0xe8c890);
    P.rect(x0, sy + 2, x1 - x0, 2, 0x8a6440); P.hl(x0 + 2, sy + 4, x1 - x0 - 4, 0xb8a888);
  }
  P.box(x0, top - 10, x1 - x0, s2 + 4 - top + 10, 0x2a1c14);
}

// Akvarieväggen: mörkt skåp med två inbyggda akvarier (grus, växter, ett litet slott)
function paintAquarium(P) {
  P.rect(AQUA.x0, 8, AQUA.x1 - AQUA.x0, WALL_Y - 14, 0x2a2430); P.box(AQUA.x0, 8, AQUA.x1 - AQUA.x0, WALL_Y - 14, 0x17151a);
  P.hl(AQUA.x0 + 1, 9, AQUA.x1 - AQUA.x0 - 2, 0x4a4450);
  TANKS.forEach((tk, ti) => {
    for (let y = tk.y0; y < tk.y1; y++) for (let x = tk.x0; x < tk.x1; x++) {
      let c = mix(0x7fd0e8, 0x2a6a9a, (y - tk.y0) / (tk.y1 - tk.y0));
      c = mix(c, 0xffffff, (bayer(x, y) - 0.5) * 0.06);
      P.px(x, y, c);
    }
    P.hl(tk.x0, tk.y0 + 1, tk.x1 - tk.x0, 0xc8f0ff); P.hl(tk.x0, tk.y0, tk.x1 - tk.x0, 0xf0ffff); // vattenyta + lampa
    for (let x = tk.x0; x < tk.x1; x++) for (let y = tk.y1 - 3; y < tk.y1; y++) P.px(x, y, [0xc8a878, 0xa88858, 0xe0c8a0, 0x8a7050][Math.floor(hash(x, y, 41 + ti) * 3.99)]);
    // växter (böljande blad)
    for (const [px, hgt, col] of [[tk.x0 + 3, 11, 0x3a9a48], [tk.x0 + 6, 8, 0x56b866], [tk.x1 - 5, 12, 0x2f7a3e], [tk.x1 - 8, 7, 0x46a35a], [tk.x0 + 22, 6, 0x56b866]]) {
      for (let j = 0; j < hgt; j++) P.px(px + Math.round(Math.sin(j * 0.8 + px)), tk.y1 - 3 - j, col);
    }
    if (ti === 0) { // slott
      P.rect(tk.x0 + 28, tk.y1 - 8, 7, 5, 0xa8a0b0);
      for (const dx of [0, 2, 4, 6]) P.px(tk.x0 + 28 + dx, tk.y1 - 9, 0xa8a0b0);
      P.rect(tk.x0 + 30, tk.y1 - 6, 2, 3, 0x2a2430);
    } else { // sten + snäcka
      disc(P, tk.x0 + 16, tk.y1 - 3, 3, 2, 0x8a8a94); P.rect(tk.x0 + 30, tk.y1 - 5, 4, 2, 0xf0c8a0); P.px(tk.x0 + 31, tk.y1 - 6, 0xf0c8a0);
    }
    P.box(tk.x0 - 1, tk.y0 - 1, tk.x1 - tk.x0 + 2, tk.y1 - tk.y0 + 2, 0x101014);
  });
  const lbl = 'TITTA!', lw = textW(SMALL, lbl);
  P.rect(506 - lw / 2 - 3, WALL_Y - 12, lw + 6, 7, 0x17151a);
  text(P, SMALL, lbl, 506 - lw / 2, WALL_Y - 11, 0x7fd0e8);
}
function paintAquaGlass() {
  const P = new Pix(AQUA.x1 - AQUA.x0, 52);
  for (const tk of TANKS) for (let y = tk.y0; y < tk.y1; y++) for (let x = tk.x0; x < tk.x1; x++) {
    const d = ((x - y * 1.1) % 40 + 40) % 40;
    if (d < 3) P.px(x - AQUA.x0, y - 8, 0xffffff, 0.16);
  }
  return P.flush();
}

// Valphage: golv av gummimatta, bakre staket mot väggen och sidostaket
function paintPenBack(P, p) {
  for (let y = p.y0 + 4; y < p.y1; y++) for (let x = p.x0; x < p.x1; x++) {
    let c = mix(0x8aa888, 0x7a9878, hash(x >> 1, y >> 1, p.i + 50) * 0.6);
    if (((x - p.x0) % 8 === 0) || ((y - p.y0) % 8 === 0)) c = mul(c, 0.94);
    if (hash(x, y, p.i + 60) > 0.985) c = 0xd8c890; // lite spån
    P.px(x, y, c);
  }
  // bakre staketet (mot väggen)
  for (let x = p.x0; x < p.x1; x++) {
    for (let y = p.y0 - 8; y < p.y0 + 4; y++) {
      let c = null;
      if (y <= p.y0 - 7) c = 0xe8e0d0; else if (y === p.y0 - 6) c = 0xa89880;
      else if ((x - p.x0) % 3 === 0) c = 0x9aa0a8;
      if (y >= p.y0 + 2) c = y === p.y0 + 2 ? 0xc9a06b : 0x8a6440;
      if (c !== null) P.px(x, y, c);
    }
  }
  // sidostaket (smala, i perspektiv)
  for (const sx of [p.x0, p.x1 - 2]) {
    for (let y = p.y0 - 8; y < p.y1 - 6; y++) { P.px(sx, y, 0xe8e0d0); P.px(sx + 1, y, 0xa89880); }
  }
  P.darken(p.x0 + 2, p.y0 + 4, p.x1 - p.x0 - 4, 3, 0.82);
  // en filt i ena hörnet
  for (let y = p.y0 + 30; y < p.y0 + 40; y++) for (let x = p.x1 - 20; x < p.x1 - 4; x++) P.px(x, y, ((x + y) >> 1) % 2 ? [0xd96a6a, 0x6a9ad9, 0xd9b04a, 0x9a6ad9][p.i] : 0xf4f1ea);
}
// Främre kanten till en valphage: låg plexiglasskiva (djuren syns igenom) mellan
// vita stolpar, med en liten grind och hasp
function paintPenFront() {
  const w = PENS[0].x1 - PENS[0].x0 + 2, h = 11;
  const P = new Pix(w, h);
  for (let x = 0; x < w; x++) {
    P.px(x, 0, 0xffffff); P.px(x, 1, 0xd8d0c0);
    for (let y = 2; y < h - 3; y++) {
      const d = ((x - y * 2) % 23 + 23) % 23;
      P.px(x, y, d < 3 ? 0xffffff : 0xcfe8f4, d < 3 ? 0.45 : 0.22);
    }
    P.px(x, h - 3, 0xe8e0d0); P.px(x, h - 2, 0xa89880); P.px(x, h - 1, 0x2a2430, 0.35);
  }
  for (const sx of [0, (w >> 1) - 1, w - 2]) { P.rect(sx, 0, 2, h - 1, 0xf4f1ea); P.vl(sx + 1, 1, h - 2, 0xb8b0a0); P.px(sx, 0, 0xffffff); }
  P.rect((w >> 1) + 3, 3, 3, 2, 0xd8b24a); P.px((w >> 1) + 3, 3, 0xfff0a0); // hasp
  return P.flush();
}
// Kaninhagen: halmgolv, lågt trästaket bak, kaninhus, höhäck och vattenflaska
function paintHutchBack(P) {
  const { x0, x1, y0, y1 } = HUTCH;
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    let c = mix(0xe8c870, 0xd0a850, hash(x >> 1, y, 71) * 0.8);
    if (hash(x, y, 73) > 0.8) c = mix(c, 0xfff0b0, 0.5);
    if (hash(x, y, 79) > 0.9) c = mul(c, 0.82);
    P.px(x, y, c);
  }
  // halmstrån
  for (let k = 0; k < 90; k++) {
    const x = x0 + 2 + Math.floor(hash(k, 1, 81) * (x1 - x0 - 6)), y = y0 + 4 + Math.floor(hash(k, 2, 81) * (y1 - y0 - 8));
    const dx = hash(k, 3, 81) < 0.5 ? 1 : -1;
    P.px(x, y, 0xfff0b0); P.px(x + dx, y + 1, 0xf0d890); P.px(x + dx * 2, y + 1, 0xc8a050);
  }
  // bakre staket
  for (let x = x0 - 2; x < x1 + 2; x++) {
    P.px(x, y0 - 3, 0xc9a06b); P.px(x, y0 - 2, 0x9a7448); P.px(x, y0 + 2, 0xc9a06b); P.px(x, y0 + 3, 0x7a5a38);
  }
  for (let x = x0; x < x1; x += 8) { P.rect(x, y0 - 6, 2, 10, 0xb08850); P.px(x, y0 - 6, 0xd8b890); P.vl(x + 1, y0 - 5, 9, 0x7a5a38); }
  // sidostaket
  for (const sx of [x0 - 2, x1]) for (let y = y0 - 3; y < y1 - 4; y++) { P.px(sx, y, 0xc9a06b); P.px(sx + 1, y, 0x8a6440); }
  // kaninhuset (trä med rött tak och runt hål)
  const hx = x1 - 40, hy = y0 + 4;
  P.rect(hx, hy + 6, 26, 12, 0xc9a06b);
  for (let x = hx; x < hx + 26; x += 4) P.vl(x, hy + 6, 12, 0xa88050);
  P.hl(hx, hy + 17, 26, 0x6b4a33);
  for (let j = 0; j < 7; j++) { P.hl(hx - 2 + j, hy + j, 30 - j * 2, j === 0 ? 0xe06050 : 0xc0443a); P.px(hx - 2 + j, hy + j, 0x8a2a24); }
  P.hl(hx - 2, hy + 6, 30, 0x8a2a24);
  disc(P, hx + 13, hy + 13, 4, 4, 0x3a2418); P.hl(hx + 9, hy + 17, 9, 0x2a1810);
  // höhäck på bakstaketet + vattenflaska
  P.rect(x0 + 10, y0 - 4, 18, 8, 0x8a8e9a); for (let x = x0 + 11; x < x0 + 28; x += 2) P.vl(x, y0 - 3, 6, 0x5a5e6a);
  for (let k = 0; k < 20; k++) P.px(x0 + 11 + Math.floor(hash(k, 5, 83) * 16), y0 - 3 + Math.floor(hash(k, 6, 83) * 4), 0xb8c860);
  P.rect(x0 + 40, y0 - 10, 4, 10, 0xc8e8f8); P.rect(x0 + 40, y0 - 6, 4, 4, 0x6ab0e0); P.rect(x0 + 40, y0 - 11, 4, 1, 0xd9433b); P.vl(x0 + 42, y0, 3, 0xa8a8b0);
  // morötter i halmen
  for (const [mx, my] of [[x0 + 20, y0 + 30], [x0 + 60, y0 + 24], [x0 + 34, y0 + 44]]) { P.hl(mx, my, 4, 0xe07a2e); P.px(mx + 4, my, 0xc05a1e); P.px(mx - 1, my - 1, 0x46a35a); P.px(mx - 2, my, 0x46a35a); }
  // skylt KANINER på bakstaketet
  const lbl = 'KANINER', lw = textW(SMALL, lbl) + 6, lx = x0 + 60;
  P.rect(lx, y0 - 12, lw, 8, 0x17151a); P.box(lx, y0 - 12, lw, 8, 0xf0d048); text(P, SMALL, lbl, lx + 3, y0 - 10, 0xf0d048);
}
function paintHutchFront() {
  const w = HUTCH.x1 - HUTCH.x0 + 4, h = 12;
  const P = new Pix(w, h);
  for (let x = 0; x < w; x++) {
    P.px(x, 2, 0xd8b890); P.px(x, 3, 0xb08850); P.px(x, 7, 0xd8b890); P.px(x, 8, 0x9a7448); P.px(x, h - 1, 0x2a2430, 0.3);
  }
  for (let x = 0; x < w; x += 8) { P.rect(x, 0, 2, h - 1, 0xc9a06b); P.px(x, 0, 0xe8d0a8); P.vl(x + 1, 1, h - 2, 0x8a6440); }
  return P.flush();
}

// Låg vit podie med färgad list (varor ställs ovanpå)
function paintPodium(w, h, top, trim) {
  const P = new Pix(w, h);
  const face = 6;
  P.rect(0, 0, w, h - face, top);
  for (let y = 1; y < h - face - 1; y++) for (let x = 1; x < w - 1; x++) if ((x + y) % 11 === 0) P.px(x, y, mul(top, 0.97));
  P.hl(0, 0, w, 0xffffff); P.hl(1, 1, w - 2, mix(top, 0xffffff, 0.5));
  P.rect(0, h - face, w, face, mul(top, 0.86)); P.hl(0, h - face, w, trim); P.hl(0, h - face + 1, w, mix(trim, 0xffffff, 0.3));
  P.hl(0, h - 1, w, mul(top, 0.6));
  P.box(0, 0, w, h, 0x4a4238);
  return P.flush();
}
// Tillbehörshyllan: skylt, bakstycke och två hyllplan (varorna ritas live)
function paintGondola() {
  const { w, h } = GOND;
  const P = new Pix(w, h);
  const ink = 0x1d1822, wood = 0xc9a06b, woodLo = 0x9a7448, back = 0xe6f0e0;
  P.rect(2, 9, w - 4, h - 17, back);
  for (let y = 12; y < h - 10; y += 4) for (let x = 5; x < w - 4; x += 4) P.px(x, y, 0xc8d8c0);
  P.box(1, 8, w - 2, h - 15, ink);
  P.rect(0, 0, w, 10, 0x17221a); P.hl(1, 1, w - 2, 0x2f4a36);
  const lbl = 'TILLBEHÖR';
  text(P, SMALL, lbl, Math.round(w / 2 - textW(SMALL, lbl) / 2), 3, 0xc8f0a0);
  stamp(P, PAW, 4, 3, 0xf0d048); stamp(P, PAW, w - 9, 3, 0xf0d048);
  for (const sy of [GTOP - GOND.y, GBOT - GOND.y]) {
    P.rect(1, sy, w - 2, 2, wood); P.hl(1, sy, w - 2, mix(wood, 0xffffff, 0.3));
    P.rect(1, sy + 2, w - 2, 2, woodLo);
    P.hl(1, sy + 4, w - 2, mul(back, 0.8));
  }
  P.rect(0, h - 7, w, 7, 0x2f4a36); P.hl(0, h - 7, w, 0x4f7a58); P.hl(0, h - 1, w, 0x17151a);
  P.vl(0, 8, h - 8, ink); P.vl(w - 1, 8, h - 8, ink);
  return P.flush();
}
function paintDesk() {
  const { w, h } = DESK;
  const P = new Pix(w, h);
  const ink = 0x1d1822;
  P.rect(0, 8, w, 6, 0xe9e1d2); P.hl(0, 8, w, 0xfaf6ee); P.hl(0, 13, w, 0xb8ad98);
  P.rect(1, 14, w - 2, h - 15, 0x3f9a52);
  for (let x = 3; x < w - 2; x += 6) P.vl(x, 15, h - 17, 0x33834a);
  P.rect(1, 18, w - 2, 3, 0xf0d048); P.hl(1, 18, w - 2, 0xfff0a0);
  stamp(P, PAW, (w >> 1) - 2, 22, 0xc8f0a0);
  P.hl(1, h - 2, w - 2, 0x1f4a2a);
  P.box(0, 8, w, h - 8, ink);
  // kassaapparat, kortläsare, en burk hundgodis och en påse
  P.rect(34, 0, 16, 9, 0x2a2a32); P.rect(35, 1, 14, 4, 0x6fe08a); P.hl(36, 2, 6, 0x1d5a2c); P.hl(36, 3, 9, 0x2f8f46);
  P.rect(33, 6, 18, 3, 0x3a3a44); P.hl(33, 6, 18, 0x5a5a64);
  P.rect(54, 4, 5, 5, 0x2a2a32); P.hl(55, 5, 3, 0x8fa0b8);
  P.rect(6, 1, 9, 8, 0x3f9a52); P.box(6, 1, 9, 8, 0x1f4a2a); P.hl(8, 0, 5, 0x1f4a2a); stamp(P, ['#.#', '###'], 9, 4, 0xc8f0a0);
  P.rect(18, 2, 7, 7, 0xdfeef4); P.box(18, 2, 7, 7, 0x8aa0aa); P.rect(19, 1, 5, 2, 0xd9433b);
  for (const [bx, by] of [[19, 5], [21, 6], [22, 4]]) stamp(P, ['#.#', '.#.'], bx, by, 0xc8a070);
  return P.flush();
}
function paintPlant() {
  const P = new Pix(22, 32);
  const leaves = [[11, 8, 6, 5, 0x2f7a3e], [6, 13, 5, 4, 0x3a8f48], [16, 13, 5, 4, 0x2f7a3e], [9, 17, 5, 4, 0x46a35a], [14, 18, 5, 3, 0x3a8f48], [11, 12, 4, 4, 0x56b866], [4, 19, 4, 3, 0x2f7a3e], [18, 19, 4, 3, 0x46a35a]];
  for (const [x, y, rx, ry] of leaves) disc(P, x, y, rx + 0.6, ry + 0.6, 0x173d22);
  for (const [x, y, rx, ry, c] of leaves) { disc(P, x, y, rx, ry, c); P.hl(x - rx + 2, y - ry + 1, Math.max(1, rx - 1), mix(c, 0xffffff, 0.3)); P.vl(x, y - ry + 1, ry * 2 - 1, mul(c, 0.8)); }
  P.vl(11, 18, 5, 0x2a5a2e); P.vl(9, 20, 3, 0x2a5a2e); P.vl(13, 20, 3, 0x2a5a2e);
  P.rect(6, 22, 10, 9, 0xf4f1ea); P.rect(5, 22, 12, 2, 0xffffff); P.vl(15, 24, 7, 0xcfc8b8); P.vl(6, 24, 7, 0xfbfaf6);
  P.box(5, 22, 12, 2, 0x5a5048); P.vl(5, 24, 7, 0x5a5048); P.vl(16, 24, 7, 0x5a5048); P.hl(6, 31, 10, 0x5a5048);
  P.hl(7, 26, 8, 0x3f9a52);
  return P.flush();
}
// Gatupratare (griffeltavla på ben): NYA VALPAR! med en liten ritad valp och hjärta
function paintBoard() {
  const w = 30, h = 31;
  const P = new Pix(w, h);
  // ben (bakre + främre)
  P.line(5, 22, 2, 30, 0x5a3a24); P.line(24, 22, 27, 30, 0x5a3a24); P.line(6, 22, 3, 30, 0x8a6446); P.line(23, 22, 26, 30, 0x8a6446);
  P.rect(1, 30, 30, 1, 0x2a2430, 0.3);
  // ram + tavla
  P.rect(2, 0, 26, 24, 0x8a6446); P.box(2, 0, 26, 24, 0x3a2418); P.hl(3, 1, 24, 0xb08858);
  for (let y = 3; y < 21; y++) for (let x = 5; x < 25; x++) P.px(x, y, mix(0x2f4a3a, 0x28402f, hash(x, y, 91) * 0.8));
  text(P, SMALL, 'NYA', 15 - Math.round(textW(SMALL, 'NYA') / 2), 4, 0xf4f1ea);
  text(P, SMALL, 'VALPAR', 15 - Math.round(textW(SMALL, 'VALPAR') / 2), 11, 0xf0d048);
  // liten kritvalp + hjärta
  stamp(P, ['#..#', '####', '.##.'], 7, 17, 0xf4f1ea, 0.85);
  stamp(P, ['#.#', '###', '.#.'], 19, 17, 0xff8fa8);
  P.hl(6, 21, 18, 0x6b4a33); P.px(12, 20, 0xffffff); P.px(14, 20, 0xe8e0d0); // kritlist
  return P.flush();
}

// Lastpall (trä) – säckarna ritas live ovanpå
function paintPallet() {
  const w = PALLET.x1 - PALLET.x0, h = 8;
  const P = new Pix(w, h);
  P.rect(0, 0, w, 3, 0xd8b890); P.hl(0, 0, w, 0xf0d8b0);
  for (let x = 0; x < w; x += 7) P.vl(x, 0, 3, 0xb08850);
  for (const bx of [0, (w >> 1) - 3, w - 6]) { P.rect(bx, 3, 6, 4, 0xb08850); P.hl(bx, 3, 6, 0xc9a06b); }
  P.rect(0, 7, w, 1, 0x2a2430, 0.3);
  P.box(0, 0, w, 3, 0x6b4a33);
  return P.flush();
}
// Fågelbur på fot: bakre gallret + pinnar (fåglarna ritas emellan), sedan främre gallret
function paintCage(front) {
  const P = new Pix(26, 53);
  const cx = 13, top = 6, bot = 38; // burens topp/botten i bilden (foten under)
  if (!front) {
    // fot + stång
    P.rect(cx - 6, 50, 13, 2, 0x5a5058); P.hl(cx - 5, 50, 11, 0x8e8690);
    P.rect(cx - 1, bot + 2, 3, 10, 0xc9ccd6); P.vl(cx + 1, bot + 2, 10, 0x8a8e9a);
    // bakre galler (tunnare, mörkare)
    for (let x = 2; x < 24; x += 3) for (let y = top + 4; y < bot; y++) P.px(x, y, 0x9a9eaa, 0.55);
    // pinnar + gunga + skålar
    for (const [px, py, pw] of [[cx - 9, bot - 24, 8], [cx + 1, bot - 24, 8], [cx - 6, bot - 14, 7], [cx + 1, bot - 14, 8], [cx - 8, bot - 6, 16]]) { P.hl(px, py, pw, 0xb08850); P.hl(px, py + 1, pw, 0x7a5a38); }
    P.vl(cx - 3, top + 1, 8, 0xc9ccd6); P.vl(cx + 3, top + 1, 8, 0xc9ccd6);
    P.rect(cx - 10, bot - 3, 5, 3, 0x3a7bd5); P.hl(cx - 10, bot - 3, 5, 0xf0d048);
    // bottenbricka med sand
    P.rect(1, bot, 24, 3, 0xe0c8a0); P.hl(1, bot, 24, 0xf0d8b0); P.rect(0, bot + 1, 26, 2, 0x3f9a52); P.hl(0, bot + 2, 26, 0x2b6a3a);
    return P.flush();
  }
  // främre galler (ljusa metallpinnar), kupol och ring högst upp
  for (let x = 1; x < 26; x += 3) for (let y = top + 2; y < bot; y++) P.px(x, y, 0xe8ecf4, 0.95);
  for (let y = 0; y <= 6; y++) {
    const r = Math.round(Math.sqrt(Math.max(0, 1 - ((6 - y) / 6) ** 2)) * 12);
    for (let x = cx - r; x <= cx + r; x += 3) P.px(x, top + y - 4, 0xe8ecf4);
    P.px(cx - r, top + y - 4, 0xc9ccd6); P.px(cx + r, top + y - 4, 0xc9ccd6);
  }
  P.hl(1, top + 2, 24, 0xc9ccd6); P.hl(1, bot - 1, 24, 0xc9ccd6); P.hl(1, (top + bot) >> 1, 24, 0xd8dce4);
  P.rect(cx - 1, 0, 3, 3, 0xd8b24a); P.px(cx, 1, 0x2a2430);
  return P.flush();
}

// ======================================================================
//  Köpdialogerna
// ======================================================================
// Knivskarp canvas: ritas i heltalsskala D = round(S × devicePixelRatio) device-pixlar
function crispCanvas(w, h, S) {
  const dpr = globalThis.devicePixelRatio || 1;
  const D = Math.max(1, Math.round(S * dpr));
  const c = document.createElement('canvas');
  c.width = w * D; c.height = h * D;
  c.style.width = (w * D / dpr) + 'px'; c.style.height = (h * D / dpr) + 'px';
  const x = c.getContext('2d'); x.imageSmoothingEnabled = false;
  return { c, x, D };
}
const DIALOG_CSS = `<style>
  .dj{display:flex;gap:14px;flex-wrap:wrap;align-items:flex-start}
  .dj-l{display:flex;flex-direction:column;gap:8px;align-items:center;flex:none}
  .dj-por{border:3px solid var(--ink);box-shadow:3px 3px 0 var(--ink);line-height:0}
  .dj canvas{display:block;image-rendering:pixelated;image-rendering:crisp-edges}
  .dj-stage{border:3px solid var(--ink);line-height:0;background:#e9dcc0}
  .dj-cap{font-size:15px;color:var(--muted)}
  .dj-r{flex:1;min-width:250px;display:flex;flex-direction:column;gap:6px}
  .dj-row{display:flex;gap:6px;align-items:center;flex-wrap:wrap}
  .dj-lbl{font-size:17px}
  .dj-desc{font-size:17px;line-height:1.15;margin:0}
  .dj-desc span{color:var(--muted);font-size:16px}
  .dj-price{font-size:24px;margin:2px 0 0;line-height:1}
  .dj-plus{font-size:18px}
  .dj-money{font-size:17px;margin:0;display:flex;flex-wrap:wrap;gap:0 14px}
  .dj-money span{white-space:nowrap}
  .dj-kit b,.dj-money b,.dj-price b,.dj-plus b{white-space:nowrap}
  .dj-hint{font-size:15px;line-height:1.15;color:var(--muted);margin:0}
  .dj-sex{font-size:17px;padding:3px 10px;border:3px solid var(--ink);background:#fff;cursor:pointer;box-shadow:2px 2px 0 var(--ink);font-family:inherit}
  .dj-sex.on{background:#ffd23f;transform:translate(-1px,-1px)}
  .dj-name{font-size:18px;padding:3px 8px;border:3px solid var(--ink);width:150px;font-family:inherit}
  .dj-kit{display:grid;grid-template-columns:1fr 1fr;gap:3px 10px}
  .dj-kit label{display:flex;gap:5px;align-items:center;font-size:15px;line-height:1.05;cursor:pointer}
  .dj-kit input{width:17px;height:17px;flex:none;margin:0}
  .dj-kit canvas{flex:none}
  .dj-kit em{font-style:normal;color:var(--muted)}
  .dj-kit .free{color:#2f8f46}
  .dj-gift{width:17px;text-align:center;flex:none}
  .dj-ico{border:3px solid var(--ink);box-shadow:3px 3px 0 var(--ink);background:#f3ecdf;padding:8px;line-height:0}
  .dj-qty{display:flex;gap:6px;align-items:center;font-size:20px}
  .dj-qty b{min-width:26px;text-align:center}
</style>`;

// Pengaraden: två delar som aldrig bryts mitt i ("12 944 / kr") – får de inte plats
// på en rad hamnar hela "kvar efter köpet: …" på nästa.
function moneyLine(money, tot) {
  const short = tot - money;
  return `<span>💰 Du har <b>${fmt(money)}</b></span>${short > 0 ? `<span class="bad">du saknar <b>${fmt(short)}</b></span>` : `<span>kvar efter köpet: <b>${fmt(money - tot)}</b></span>`}`;
}
// Namnet utan "(säck)" – i startpaketet och kvittot syns säcken som ikon ändå
const kitName = (k) => PET_ITEMS[k].namn.replace(/ \(säck\)/, '');
function haveItem(store, k) { return (store.inventory[k] | 0) > 0 || store.items.some((i) => i.k === k); }
function sackCount(store, sp) {
  const s = store.sacksFor(sp);
  return s.inventory + s.placed.length + (s.opened > 0 ? 1 : 0);
}
// Startpaketet: det djuret behöver (förbockat om man saknar det) + trevliga tillval
function kitFor(sp, store) {
  const out = [];
  const firstPet = !store.gifts?.skal;
  if (firstPet) out.push({ k: 'matskal', free: true });
  else if (!haveItem(store, 'matskal')) out.push({ k: 'matskal', on: true });
  const sacks = sackCount(store, sp);
  out.push({ k: 'sack-' + sp, on: sacks === 0, has: sacks });
  if (sp === 'katt') {
    out.push({ k: 'kattlada', on: !haveItem(store, 'kattlada'), has: haveItem(store, 'kattlada') ? 1 : 0 });
    out.push({ k: 'kattkorg', on: false, has: haveItem(store, 'kattkorg') ? 1 : 0 });
    out.push({ k: 'kattklostrad', on: false, has: haveItem(store, 'kattklostrad') ? 1 : 0 });
  } else if (sp === 'hund') {
    if (!store.gifts?.koppel && !store.hasLeash()) out.push({ k: 'koppel', free: true });
    else if (!store.hasLeash()) out.push({ k: 'koppel', on: true });
    out.push({ k: 'hundkorg', on: !haveItem(store, 'hundkorg'), has: haveItem(store, 'hundkorg') ? 1 : 0 });
    out.push({ k: 'leksak-ben', on: false, has: haveItem(store, 'leksak-ben') ? 1 : 0 });
  } else if (sp === 'kanin') {
    out.push({ k: 'kaninbur', on: !haveItem(store, 'kaninbur'), has: haveItem(store, 'kaninbur') ? 1 : 0 });
  }
  if (!haveItem(store, 'vattenskal')) out.push({ k: 'vattenskal', on: false });
  return out;
}
const CARE = {
  katt: 'Katten gör sina behov i kattlådan – töm den ibland, annars blir det sura miner (och bajs på golvet).',
  hund: 'Hunden måste ut och gå i koppel – annars kan den bajsa och kissa inne. Den kan följa med dig i staden!',
  kanin: 'Kaninen trivs i en bur med halm och vill ha mat i skålen varje dag. Byt halm ibland.',
};
// Porträttet: drawPetIcon (djuret sittande framifrån) i heltalsskala, beskuret kring
// djuret och centrerat i en kvadratisk ruta på ca 120×120 CSS-px med mönstrad bakgrund.
// Skalan väljs så att djuret fyller rutan (2 px luft på sidorna, 3 px ovanför): en
// kattunge (7×10) får skala 9, en vuxen schäfer (11×17) skala 6, en kaninunge skala 10.
const POR_W = 120, POR_H = 120;
function petPortrait(pet, bg) {
  const src = document.createElement('canvas'); src.width = ICON_W; src.height = ICON_H;
  const sx = src.getContext('2d', { willReadFrequently: true });
  drawPetIcon(sx, 0, 0, pet, 1);
  const d = sx.getImageData(0, 0, ICON_W, ICON_H).data;
  let x0 = ICON_W, y0 = ICON_H, x1 = -1, y1 = -1;
  for (let y = 0; y < ICON_H; y++) for (let x = 0; x < ICON_W; x++) if (d[(y * ICON_W + x) * 4 + 3] > 40) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  if (x1 < 0) { x0 = 0; y0 = 0; x1 = ICON_W - 1; y1 = ICON_H - 1; }
  const bw = x1 - x0 + 1, bh = y1 - y0 + 1;
  const S = clamp(Math.floor(Math.min(POR_W / (bw + 4), POR_H / (bh + 3))), 3, 12);
  const w = Math.floor(POR_W / S), h = Math.floor(POR_H / S);
  const { c, x, D } = crispCanvas(w, h, S);
  const base = parseInt(bg.slice(1), 16);
  x.fillStyle = bg; x.fillRect(0, 0, c.width, c.height);
  const dark = '#' + mul(base, 0.94).toString(16).padStart(6, '0'), light = '#' + mix(base, 0xffffff, 0.35).toString(16).padStart(6, '0');
  for (let yy = 0; yy < h; yy += 2) for (let xx = 0; xx < w; xx += 2) if (((xx + yy) >> 1) % 2 === 0) { x.fillStyle = dark; x.fillRect(xx * D, yy * D, 2 * D, 2 * D); }
  for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) {
    const q = Math.hypot((xx - w / 2 + 0.5) / (w * 0.42), (yy - h * 0.45) / (h * 0.5));
    if (q < 1 && ((xx + yy) % 2 === 0 || q < 0.7)) { x.fillStyle = light; x.fillRect(xx * D, yy * D, D, D); }
  }
  // djuret: fötterna nere i rutan, centrerat i sidled
  const ox = Math.round((w - bw) / 2) - x0, oy = h - 1 - bh - y0;
  drawPetIcon(x, ox * D, oy * D, pet, D);
  return c;
}
function itemIcon(k, S) {
  const d = PET_ITEMS[k];
  const w = Math.max(d.w, 11) + 4, h = d.h + 4;
  const { c, x, D } = crispCanvas(w, h, S);
  drawItemIcon(x, k, 0, 0, D, {});
  return c;
}

// Djurets köpdialog: stort porträtt + levande scen, art/ras/kön, namn, startpaket
function openPetDialog(A, basePet, { onBuy } = {}) {
  const g = A.game, store = petStore();
  const sp = basePet.species, S = SPECIES[sp];
  const breed = basePet.breed;
  let sex = basePet.sex;
  let typed = false;
  const suggest = () => (typeof store._freeName === 'function' ? store._freeName(sp, sex) : (sex === 'hona' ? 'Tussan' : 'Tussen'));
  let name = suggest();
  const kit = kitFor(sp, store);
  const checked = new Set(kit.filter((x) => x.on && !x.free).map((x) => x.k));
  const full = store.pets.length >= MAX_PETS;
  const homeName = g.homeInfo?.name || 'din bostad';
  const bgCol = { katt: '#f6dce8', hund: '#d6ecd6', kanin: '#f8ecc4' }[sp];
  const pet = () => ({ species: sp, breed, sex, stage: 'unge', id: 'dlg-' + breed, seed: basePet.seed || 1 });
  const B = breedOf(pet());
  const total = () => B.pris + [...checked].reduce((s, k) => s + PET_ITEMS[k].pris, 0);
  // räcker pengarna till djuret men inte till hela startpaketet: bocka ur prylar bakifrån
  for (const k of [...checked].reverse()) { if (total() <= g.money) break; checked.delete(k); }
  const kitRow = (it) => {
    const d = PET_ITEMS[it.k];
    if (it.free) return `<label class="free"><span class="dj-gift">🎁</span><i data-kico="${it.k}"></i><span>${esc(kitName(it.k))} <b>ingår!</b></span></label>`;
    return `<label><input type="checkbox" data-kit="${it.k}" ${checked.has(it.k) ? 'checked' : ''}><i data-kico="${it.k}"></i><span>${esc(kitName(it.k))} <b>${d.pris} kr</b>${it.has ? ' <em>(har)</em>' : ''}</span></label>`;
  };
  const body = `${DIALOG_CSS}
  <div class="dj">
    <div class="dj-l">
      <div class="dj-por" data-por></div>
      <div class="dj-stage" data-stage></div>
      <div class="dj-row"><span class="dj-cap" data-cap></span><button class="btn btn-small" data-adult></button></div>
    </div>
    <div class="dj-r">
      <p class="dj-desc"><b>${esc(B.namn)}</b> · ${esc(S.unge.toLowerCase())}<br><span>${esc(B.beskr || '')}</span></p>
      <div class="dj-row"><b class="dj-lbl">Kön:</b>
        <button class="dj-sex ${sex === 'hane' ? 'on' : ''}" data-sex="hane">♂ Hane</button>
        <button class="dj-sex ${sex === 'hona' ? 'on' : ''}" data-sex="hona">♀ Hona</button>
      </div>
      <div class="dj-row"><b class="dj-lbl">Namn:</b>
        <input class="dj-name" data-name maxlength="16" value="${esc(name)}" aria-label="Djurets namn">
        <button class="btn btn-small" data-roll title="Slumpa ett namn">Slumpa</button>
      </div>
      <b class="dj-lbl">Bra att ha hemma:</b>
      <div class="dj-kit">${kit.map(kitRow).join('')}</div>
      <p class="dj-hint">🏠 ${CARE[sp]} 🌱 Ungen växer: ung efter 3 dagar, vuxen efter en vecka – och en hane och en hona kan bli kära och få ungar!</p>
      <p class="dj-price" data-price></p>
      <p class="dj-money" data-money></p>
    </div>
  </div>`;
  const dlg = openModal(`${EMOJI[sp]} ${esc(S.unge)} – ${esc(B.namn)}`, body, [
    { label: 'Stäng', onClick: closeModal },
    { label: `🐾 Köp <span data-total>${fmt(total())}</span>`, cls: 'btn-go', disabled: full || total() > g.money, onClick: buy },
  ]);
  dlg.querySelectorAll('[data-kico]').forEach((el) => el.replaceWith(itemIcon(el.dataset.kico, 1)));
  // levande scen: ungen gör olika saker i en lugn slinga
  const ST = { w: 56, h: 26, S: 4 };
  const stage = crispCanvas(ST.w, ST.h, ST.S);
  dlg.querySelector('[data-stage]').append(stage.c);
  const src = document.createElement('canvas'); src.width = ST.w; src.height = ST.h;
  const sx = src.getContext('2d');
  const LOOP = [['happy', 'down', 2.2], ['idle', 'right', 1.6], ['play', 'right', 2.4], ['sit', 'down', 2], ['walk', 'left', 2.4], ['idle', 'left', 1.2], ['walk', 'right', 2.4], ['beg', 'down', 1.8], ['sleep', 'right', 3.2]];
  const t0 = performance.now();
  const loopLen = LOOP.reduce((s2, l) => s2 + l[2], 0);
  const L = 16, R = ST.w - 16;
  // var djuret står efter bit i (gå åt vänster → L, åt höger → R)
  const posAt = (i) => { let px = Math.round(ST.w / 2); for (let k = 0; k <= i; k++) if (LOOP[k][0] === 'walk') px = LOOP[k][1] === 'left' ? L : R; return px; };
  let adult = false;
  const frame = () => {
    if (!stage.c.isConnected) return;
    const tt = (performance.now() - t0) / 1000;
    let lt = tt % loopLen, cur = LOOP[0], ci = 0;
    for (const l of LOOP) { if (lt < l[2]) { cur = l; break; } lt -= l[2]; ci++; }
    sx.clearRect(0, 0, ST.w, ST.h);
    for (let y = 0; y < ST.h; y++) { sx.fillStyle = y < 9 ? '#efe4cc' : y === 9 ? '#c9b48c' : y === 10 ? '#b8a07a' : (y % 4 === 0 ? '#dcc8a0' : '#e6d4b0'); sx.fillRect(0, y, ST.w, 1); }
    const p = { ...pet(), stage: adult ? 'vuxen' : 'unge' };
    let x;
    if (cur[0] === 'walk') { const k = lt / cur[2], from = posAt(ci - 1); x = Math.round(from + ((cur[1] === 'left' ? L : R) - from) * k); }
    else x = posAt(ci);
    drawPet(sx, x, 22, p, cur[0], tt, cur[1]);
    stage.x.clearRect(0, 0, stage.c.width, stage.c.height);
    stage.x.drawImage(src, 0, 0, stage.c.width, stage.c.height);
    requestAnimationFrame(frame);
  };
  const adultBtn = dlg.querySelector('[data-adult]');
  const update = () => {
    dlg.querySelector('[data-por]').replaceChildren(petPortrait(pet(), bgCol));
    dlg.querySelector('[data-cap]').textContent = adult ? 'Som vuxen:' : 'Nu:';
    adultBtn.textContent = adult ? '🍼 Visa ungen' : '📏 Så stor blir den';
    dlg.querySelectorAll('[data-sex]').forEach((b) => b.classList.toggle('on', b.dataset.sex === sex));
    const tot = total();
    dlg.querySelector('[data-price]').innerHTML = `Pris: <b>${fmt(B.pris)}</b>${checked.size ? ` <span class="dj-plus">+ prylar = <b>${fmt(tot)}</b></span>` : ''}`;
    dlg.querySelector('[data-money]').innerHTML = full ? `<b class="bad">Du har redan ${store.pets.length} djur – max ${MAX_PETS}.</b>`
      : moneyLine(g.money, tot);
    const go = dlg.querySelector('.dlg-foot .btn-go');
    if (go) { go.disabled = full || tot > g.money; const s2 = go.querySelector('[data-total]'); if (s2) s2.textContent = fmt(tot); }
  };
  adultBtn.onclick = () => { adult = !adult; play('click'); update(); };
  dlg.querySelectorAll('[data-sex]').forEach((b) => (b.onclick = () => {
    sex = b.dataset.sex; play('click');
    if (!typed) { name = suggest(); dlg.querySelector('[data-name]').value = name; }
    update();
  }));
  dlg.querySelectorAll('[data-kit]').forEach((b) => (b.onchange = () => { if (b.checked) checked.add(b.dataset.kit); else checked.delete(b.dataset.kit); play('click'); update(); }));
  const nameEl = dlg.querySelector('[data-name]');
  nameEl.oninput = () => { name = nameEl.value; typed = true; };
  dlg.querySelector('[data-roll]').onclick = () => { name = suggest(); nameEl.value = name; typed = false; play('click'); };
  update();
  requestAnimationFrame(frame);

  function buy() {
    const tot = total();
    if (store.pets.length >= MAX_PETS) { toast(`Du kan ha högst ${MAX_PETS} djur.`, 'bad'); play('fel'); return; }
    if (g.money < tot) { toast('Du har inte råd – dags att jobba ett pass!', 'bad'); play('fel'); return; }
    const inv0 = { ...store.inventory };
    const p = store.adopt(sp, breed, sex, (name || '').trim(), g.home, { day: g.day });
    if (!p) { toast(store.lastError || 'Det gick inte att köpa djuret.', 'bad'); play('fel'); return; }
    const gifts = ['matskal', 'koppel'].filter((k) => (store.inventory[k] | 0) > (inv0[k] | 0));
    const extras = [...checked];
    for (const k of extras) store.buyItem(k);
    g.money -= tot;
    g.save();
    play('buy');
    // ett enda kvitto per köp (flera toasts staplas annars över nästa dialog)
    const han = p.sex === 'hona' ? 'Hon' : 'Han';
    const lower = (k) => kitName(k).toLowerCase();
    const rows = [`${EMOJI[sp]} ${p.name} är din! ${han} väntar hemma i ${homeName}.`];
    if (gifts.length) rows.push(`🎁 På köpet: ${gifts.map(lower).join(' och ')}.`);
    if (extras.length) rows.push(`🛍️ I förrådet: ${extras.map(lower).join(', ')}.`);
    toast(rows.join(' '), 'good wrap');
    onBuy?.({ pet: p, price: tot, extras });
    closeModal();
  }
}

// Varans köpdialog: stor bild, beskrivning, antal, vad du redan har
function openItemDialog(A, k, { onBuy } = {}) {
  const g = A.game, store = petStore();
  const d = PET_ITEMS[k];
  let n = 1;
  const inv = store.inventory[k] | 0, placed = store.items.filter((i) => i.k === k).length;
  const forWho = (d.forArt || []).map((a) => `${EMOJI[a]} ${a}`).join(' · ');
  const extra = d.typ === 'sack' ? `En säck räcker till ${d.portioner} skålar mat. Hemma: klicka på säcken så bär du den, klicka sen på skålen så häller du upp.`
    : d.typ === 'lada' ? 'Ställ den i ett hörn hemma. Katten går dit själv – töm den när den börjar lukta.'
      : d.typ === 'koppel' ? 'Med kopplet kan hunden följa med dig ut i staden och göra sina behov ute.'
        : d.typ === 'skal' ? 'Ställ ut skålen hemma och fyll den från en matsäck.'
          : 'Ställ ut den hemma med djurprylarna.';
  const body = `${DIALOG_CSS}
  <div class="dj">
    <div class="dj-l"><div class="dj-ico" data-ico></div></div>
    <div class="dj-r">
      <p class="dj-hint"><b>${esc(d.desc || '')}</b></p>
      <p class="dj-hint">Passar: ${forWho}</p>
      <p class="dj-hint">💡 ${extra}</p>
      <p class="dj-hint">📦 Hemma har du: <b>${inv}</b> i förrådet${placed ? ` · <b>${placed}</b> utställda` : ''}</p>
      <div class="dj-qty"><b style="font-size:18px">Antal:</b><button class="btn btn-small" data-q="-1">−</button><b data-n>1</b><button class="btn btn-small" data-q="1">+</button></div>
      <p class="dj-price" data-price></p>
      <p class="dj-money" data-money></p>
    </div>
  </div>`;
  const dlg = openModal(`${ITEM_EMOJI[k] || '🐾'} ${esc(d.namn)}`, body, [
    { label: 'Stäng', onClick: closeModal },
    { label: `🛒 Köp <span data-total>${fmt(d.pris)}</span>`, cls: 'btn-go', disabled: d.pris > g.money, onClick: buy },
  ]);
  dlg.querySelector('[data-ico]').append(itemIcon(k, 4));
  const update = () => {
    const tot = d.pris * n;
    dlg.querySelector('[data-n]').textContent = n;
    dlg.querySelector('[data-price]').innerHTML = `Pris: <b>${fmt(d.pris)}</b>${n > 1 ? ` × ${n} = <b>${fmt(tot)}</b>` : ''}`;
    dlg.querySelector('[data-money]').innerHTML = moneyLine(g.money, tot);
    const go = dlg.querySelector('.dlg-foot .btn-go');
    if (go) { go.disabled = tot > g.money; const s = go.querySelector('[data-total]'); if (s) s.textContent = fmt(tot); }
  };
  dlg.querySelectorAll('[data-q]').forEach((b) => (b.onclick = () => { n = clamp(n + +b.dataset.q, 1, 9); play('click'); update(); }));
  update();
  function buy() {
    const tot = d.pris * n;
    if (g.money < tot) { toast('Du har inte råd!', 'bad'); play('fel'); return; }
    if (!store.buyItem(k, n)) { toast(store.lastError || 'Det gick inte.', 'bad'); play('fel'); return; }
    g.money -= tot;
    g.save();
    play('buy');
    toast(`${ITEM_EMOJI[k] || '🐾'} ${n > 1 ? n + ' × ' : ''}${d.namn} ligger nu i ditt förråd hemma.`, 'good');
    onBuy?.({ n, price: tot });
    closeModal();
  }
}
