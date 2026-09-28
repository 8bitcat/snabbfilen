// KLÄDER – klädaffären man går runt i med sin egen figur. Butiken är dubbelt
// så bred som skärmen (kameran följer figuren) och har två avdelningar:
// TJEJER (rosa/lila, tapet och ljust trägolv) till vänster och KILLAR
// (blått/grönt, panelvägg och grått trägolv) till höger. I mitten: dörren,
// kassan och accessoarhyllan.
//
// Varje plagg bärs av en mannekäng i en hel, färgglad outfit, med en lapp
// (plaggets namn + pris, grön "DIN" när man äger det) och en liten gul
// hänglapp på just det plagg som säljs. Hattarna står även på byster på
// väggen och glasögon/hörlurar/väskor på hyllan i mitten. Står man vid en
// vara (eller pekar på den) visas en namnskylt längst ner på skärmen. Klick
// = köpdialogen, där man ser varan i stor skala på DIN figur och provar färger.
import { drawPerson } from '../core/people.js';
import { Pix, SMALL, BIG, ctxText, textW, text, mix, mul, hash, bayer, hex, css } from '../core/floor-pix.js';
import { openModal, closeModal, toast, esc } from '../core/ui.js';
import { SORTIMENT, clothesKey, fmt } from '../game.js';
import { play } from '../core/sound.js';
import { saveAvatar } from '../core/avatar.js';
import { createWalker, selfDrawable, folkDrawables, createSpeech } from './walkable.js';

const talk = createSpeech(); // repliker och beskrivningar som pratbubblor i scenen

const VW = 384;                        // skärmens bredd i spelpixlar
const W = 768, H = 216;                // butikens storlek
const WALL_Y = 70;
const MID0 = 296, MID1 = 472;          // mittdelen: dörr, kassa, accessoarer
const DOOR = { x0: 368, x1: 400 };
const ROW_Y = [104, 166];              // mannekängernas fötter, bakre/främre raden
const COLS = [36, 90, 144, 198, 252];  // tjejavdelningen – killarnas speglas (W − x)
const GOND = { x: 324, y: 116, w: 120, h: 72 }; // accessoarhyllan (fristående; gång mellan den och kassan)
const DESK = { x: 404, y: 78, w: 64, h: 30 };   // kassadisken
const sOf = (kind, v) => SORTIMENT.find((s) => s.kind === kind && s.v === v);
const keyOf = (k) => { const [kind, v] = k.split(':'); return sOf(kind, kind === 'phones' ? true : v); };

// ---------- avdelningarnas färger ----------
const DEPT = {
  tjej: { name: 'TJEJER', neon: 0xff8fd0, glow: 0xff4fb0, board: 0x2b1631, trim: 0xf28bb3, lbl: '#ff8fd0', stage: ['#fbe3ef', '#f0c4d9', '#d98fb4'] },
  kille: { name: 'KILLAR', neon: 0x7fe0ff, glow: 0x2f9fe0, board: 0x0f1a2e, trim: 0x3fc4ff, lbl: '#7fe0ff', stage: ['#e0ebf8', '#c4d6ee', '#7f9cc4'] },
  mid: { name: '', neon: 0xf0d048, glow: 0xe8b230, board: 0x17151a, trim: 0xe8b230, lbl: '#f0d048', stage: ['#f3ecdf', '#e6dcc8', '#b99a70'] },
};

// ---------- mannekängerna: hela outfits, plagget som säljs = k ----------
const MANNE = { skin: '#ece6ee', style: 'bald', hair: '#ecd489', beard: false, glasses: false, phones: false, bag: null, blush: false, hat: null, top: 'tee', shirt: '#f4f1ea', accent: '#f4f1ea', bottom: 'jeans', pants: '#3f5f8f', shoes: '#1c1c1c', cap: '#d9433b' };
const girl = (o) => ({ ...MANNE, build: 4, blush: true, ...o });
const boy = (o) => ({ ...MANNE, build: 5, ...o });
// [plagget, kolumn (0 = längst från mitten för tjejer, närmast mitten för killar), rad, outfit]
const GIRLS = [
  // plagget som säljs har en stark färg som skiljer sig från håret/resten av dockan
  ['hat:crown', 0, 0, girl({ style: 'long', hair: '#3b2619', hat: 'crown', cap: '#f0b429', bottom: 'dress', shirt: '#8e5bd1', shoes: '#f2f2f2' })],
  ['bottom:skirt', 1, 0, girl({ style: 'ponytail', hair: '#6b4226', top: 'stripes', shirt: '#f4f1ea', accent: '#b83d7a', bottom: 'skirt', pants: '#b83d7a' })],
  ['bottom:dress', 2, 0, girl({ style: 'bun', hair: '#1d1714', top: 'vest', bottom: 'dress', shirt: '#f0b429', shoes: '#f2f2f2' })],
  ['top:vest', 3, 0, girl({ style: 'wavy', hair: '#b7392b', top: 'vest', shirt: '#2aa39a', bottom: 'shorts', pants: '#f4f1ea', shoes: '#f28bb3' })],
  ['top:hoodie', 4, 0, girl({ style: 'long', hair: '#3b2619', top: 'hoodie', shirt: '#f28bb3', bottom: 'jeans', pants: '#3f5f8f', shoes: '#f2f2f2' })],
  ['top:sweater', 0, 1, girl({ style: 'bob', hair: '#1d1714', top: 'sweater', shirt: '#b9a3e8', bottom: 'skirt', pants: '#2f3440' })],
  ['hat:beanie', 1, 1, girl({ style: 'braids', hair: '#d9a95c', hat: 'beanie', cap: '#d9433b', top: 'jacket', shirt: '#f4f1ea', accent: '#d9433b', bottom: 'jeans', pants: '#2d3a5c' })],
  ['hat:bow', 2, 1, girl({ style: 'pigtails', hair: '#1d1714', hat: 'bow', cap: '#ff5fa8', top: 'tee', shirt: '#f0b429', accent: '#ff5fa8', bottom: 'skirt', pants: '#3a7bd5', shoes: '#f2f2f2' })],
  ['hat:headband', 3, 1, girl({ style: 'long', hair: '#ecd489', hat: 'headband', cap: '#b83d7a', top: 'tee', shirt: '#e07a2e', accent: '#f4f1ea', bottom: 'jeans', pants: '#3f5f8f' })],
  ['bottom:shorts', 4, 1, girl({ style: 'space', hair: '#c65fa0', top: 'tee', shirt: '#f4f1ea', accent: '#2aa39a', bottom: 'shorts', pants: '#2aa39a', shoes: '#f2f2f2' })],
];
const BOYS = [
  ['top:hoodie', 0, 0, boy({ style: 'fade', hair: '#1d1714', top: 'hoodie', shirt: '#46a35a', bottom: 'pants', pants: '#2b2b30', shoes: '#f2f2f2' })],
  ['hat:cap', 1, 0, boy({ style: 'short', hair: '#3b2619', hat: 'cap', cap: '#d9433b', top: 'tee', shirt: '#3a7bd5', accent: '#f4f1ea', bottom: 'jeans', pants: '#2d3a5c', shoes: '#f2f2f2' })],
  ['top:hawaii', 2, 0, boy({ style: 'curtains', hair: '#d9a95c', top: 'hawaii', shirt: '#2aa39a', accent: '#f0b429', bottom: 'shorts', pants: '#e8e3d6', glasses: 'sun', shoes: '#6b3e1e', build: 6 })],
  ['top:shirt', 3, 0, boy({ style: 'side', hair: '#6b4226', top: 'shirt', shirt: '#7fb8e8', accent: '#f4f1ea', bottom: 'pants', pants: '#9a8560', shoes: '#6b3e1e' })],
  ['top:jacket', 4, 0, boy({ style: 'spiky', hair: '#1d1714', top: 'jacket', shirt: '#e07a2e', accent: '#2f3440', bottom: 'pants', pants: '#2b2b30' })],
  ['bottom:shorts', 0, 1, boy({ style: 'buzz', hair: '#3b2619', top: 'tee', shirt: '#f0b429', accent: '#3a7bd5', bottom: 'shorts', pants: '#3a7bd5', shoes: '#f2f2f2' })],
  ['hat:bucket', 1, 1, boy({ style: 'short', hair: '#1d1714', hat: 'bucket', cap: '#9fd356', top: 'stripes', shirt: '#2d3a5c', accent: '#f4f1ea', bottom: 'pants', pants: '#9a8560', build: 6 })],
  ['hat:beanie', 2, 1, boy({ style: 'short', hair: '#a5692f', hat: 'beanie', cap: '#f0b429', top: 'sweater', shirt: '#26605a', bottom: 'jeans', pants: '#3f5f8f' })],
  ['top:suit', 3, 1, boy({ style: 'side', hair: '#1d1714', top: 'suit', shirt: '#2d3a5c', accent: '#d9433b', bottom: 'pants', pants: '#2d3a5c', shoes: '#6b3e1e' })],
  ['hat:tophat', 4, 1, boy({ style: 'short', hair: '#3b2619', hat: 'tophat', cap: '#1d1d22', top: 'suit', shirt: '#7a2e3e', accent: '#f0b429', bottom: 'pants', pants: '#1d1d22' })],
];
const DUMMIES = [
  ...GIRLS.map(([k, c, r, look]) => ({ s: keyOf(k), dept: 'tjej', x: COLS[c], y: ROW_Y[r], look })),
  // killarnas kolumn 0 står närmast mitten
  ...BOYS.map(([k, c, r, look]) => ({ s: keyOf(k), dept: 'kille', x: W - COLS[COLS.length - 1 - c], y: ROW_Y[r], look })),
];

// ---------- byster på väggen (hattar) och accessoarhyllan ----------
const BUST = { ...MANNE, skin: '#e9e2ea', top: 'tee', shirt: '#d9d0c8', accent: '#d9d0c8', build: 5 };
const bust = (o) => ({ ...BUST, ...o });
const HAT_Y = 56; // hyllplanets ovansida
// 24 px mellan bysterna så att prislapparna ("150:-") får plats bredvid varandra
const WALLS = [
  ['hat:bow', 'tjej', 202, bust({ style: 'long', hair: '#1d1714', hat: 'bow', cap: '#ff5fa8', blush: true, build: 4 })],
  ['hat:headband', 'tjej', 226, bust({ style: 'bob', hair: '#ecd489', hat: 'headband', cap: '#8e5bd1', blush: true, build: 4 })],
  ['hat:beanie', 'tjej', 250, bust({ style: 'long', hair: '#b7392b', hat: 'beanie', cap: '#2aa39a', blush: true, build: 4 })],
  ['hat:crown', 'tjej', 274, bust({ style: 'wavy', hair: '#1d1714', hat: 'crown', cap: '#f0b429', blush: true, build: 4 })],
  ['hat:cap', 'kille', W - 274, bust({ style: 'short', hair: '#3b2619', hat: 'cap', cap: '#3a7bd5' })],
  ['hat:bucket', 'kille', W - 250, bust({ style: 'short', hair: '#1d1714', hat: 'bucket', cap: '#f0b429' })],
  ['hat:beanie', 'kille', W - 226, bust({ style: 'buzz', hair: '#3b2619', hat: 'beanie', cap: '#d9433b' })],
  ['hat:tophat', 'kille', W - 202, bust({ style: 'short', hair: '#ecd489', hat: 'tophat', cap: '#1d1d22', accent: '#d9433b' })],
].map(([k, dept, x, look]) => ({ s: keyOf(k), dept, x, y: HAT_Y, look }));
const GTOP = GOND.y + 34, GBOT = GOND.y + 61; // hyllplanen i gondolen
// Glasögonen står i stor skala på egna ställ, hörlurarna på en byst, väskorna på nedre hyllan
const SHELF = [
  ['glasses:round', GOND.x + 18, GTOP, null],
  ['glasses:square', GOND.x + 46, GTOP, null],
  ['glasses:sun', GOND.x + 74, GTOP, null],
  ['phones:true', GOND.x + 102, GTOP, bust({ style: 'short', hair: '#3b2619', phones: true, phoneColor: '#d9433b' })],
  ['bag:backpack', GOND.x + 30, GBOT, { bagColor: '#3a7bd5' }],
  ['bag:shoulder', GOND.x + 90, GBOT, { bagColor: '#b83d7a' }],
].map(([k, x, y, look]) => ({ s: keyOf(k), dept: 'mid', x, y, look: look || {} }));

// kortnamn på mannekängernas lappar (lappen får vara högst ~48 px bred)
const SHORT = {
  'top:vest': 'LINNE', 'top:hoodie': 'HUVTRÖJA', 'top:hawaii': 'HAWAII', 'top:sweater': 'STICKAT', 'top:shirt': 'SKJORTA',
  'top:jacket': 'JACKA', 'top:suit': 'KAVAJ', 'bottom:shorts': 'SHORTS', 'bottom:skirt': 'KJOL', 'bottom:dress': 'KLÄNNING',
  'hat:cap': 'KEPS', 'hat:bucket': 'FISKEHATT', 'hat:headband': 'HÅRBAND', 'hat:beanie': 'MÖSSA', 'hat:bow': 'ROSETT',
  'hat:tophat': 'HÖG HATT', 'hat:crown': 'KRONA',
};
// egna ikoner i dialogrubriken där sortimentets ikon krockar med ett annat plagg
const ICON = { 'hat:headband': '💇' };
const iconOf = (s) => ICON[clothesKey(s.kind, s.v)] || s.icon;
// var på dockan (fötterna i 0,0, framifrån) plagget sitter – där hänger den gula lappen
const HANG_AT = { hat: [5, -36], top: [6, -23], bottom: [5, -11] };

const CLERK = { skin: '#c68a5c', hair: '#1d1714', style: 'bun', top: 'shirt', shirt: '#f4f1ea', accent: '#b83d7a', bottom: 'pants', pants: '#2d3a5c', shoes: '#1c1c1c', glasses: 'round', beard: false, phones: false, bag: null, hat: null, blush: true, build: 5 };
const POSTER = [
  girl({ skin: '#eec3a0', style: 'ponytail', hair: '#d9a95c', top: 'hoodie', shirt: '#f28bb3', bottom: 'skirt', pants: '#8e5bd1', hat: 'bow', cap: '#f0b429' }),
  boy({ skin: '#a06a43', style: 'fade', hair: '#1d1714', top: 'jacket', shirt: '#3a7bd5', accent: '#f0b429', bottom: 'jeans', pants: '#2d3a5c', hat: 'cap', cap: '#46a35a' }),
];
const PLANTS = [[306, 92], [304, 206], [464, 206]];
const RACKS = [[120, 'tjej'], [W - 190, 'kille']]; // klädstänger på väggen (bara att titta på)

export function makeShopKlader(A) {
  const g = A.game;
  const walker = createWalker({ W, H, top: WALL_Y + 4, bottom: H - 6, spawn: [(DOOR.x0 + DOOR.x1) / 2, WALL_Y + 14] });
  walker.setObstacles([
    ...DUMMIES.map((d) => [d.x - 12, d.y - 6, d.x + 12, d.y + 22]),
    // hela hyllans djup: man går runt den (framför eller i gången mot kassan), aldrig bakom
    [GOND.x - 5, GOND.y + 2, GOND.x + GOND.w + 5, GOND.y + GOND.h],
    [DESK.x, DESK.y, DESK.x + DESK.w, DESK.y + DESK.h],
    ...PLANTS.map(([x, y]) => [x - 6, y - 4, x + 6, y + 2]),
  ]);
  walker.snapFree();
  let t = 0, lockedCam = null, hoverId = null, hoverT = 0;
  const camTarget = () => lockedCam ?? Math.max(0, Math.min(W - VW, walker.px - VW / 2));
  const cam = { x: camTarget() };
  const bg = paintStore();
  const pod = { tjej: paintPodium('tjej'), kille: paintPodium('kille') };
  const gondImg = paintGondola();
  const deskImg = paintDesk();
  const plantImg = paintPlant();
  const glowImg = paintGlow();
  const owned = (s) => g.wardrobe.includes(clothesKey(s.kind, s.v));

  // alla klickbara saker (världskoordinater)
  const spots = [
    { id: 'dorr', r: [DOOR.x0 - 2, 26, DOOR.x1 + 2, WALL_Y + 4], go: [(DOOR.x0 + DOOR.x1) / 2, WALL_Y + 10], act: () => { play('door'); A.go('city'); } },
    ...WALLS.map((w, i) => ({ id: 'vagg' + i, item: w, r: [w.x - 11, 30, w.x + 11, WALL_Y - 2], go: [w.x, WALL_Y + 12] })),
    // man ställer sig BREDVID dockan (på mittgångens sida), så att figuren inte skymmer lappen
    ...DUMMIES.map((d, i) => ({ id: 'dummy' + i, item: d, r: [d.x - 12, d.y - 40, d.x + 12, d.y + 22], go: [d.x + (d.dept === 'tjej' ? 22 : -22), d.y + 3] })),
    ...SHELF.map((it, i) => ({
      id: 'hylla' + i, item: it,
      r: it.y === GTOP ? [it.x - 13, GOND.y + 10, it.x + 13, GTOP + 7] : [it.x - 20, GTOP + 8, it.x + 20, GOND.y + GOND.h],
      // väskorna står på nedre hyllan – ställ dig vid sidan av dem så att de syns
      go: [it.y === GTOP ? it.x : it.x < GOND.x + GOND.w / 2 ? it.x - 22 : it.x + 22, GOND.y + GOND.h + 12],
    })),
    { id: 'kassa', r: [DESK.x, DESK.y - 30, DESK.x + DESK.w, DESK.y + DESK.h], go: [DESK.x + DESK.w / 2, DESK.y + DESK.h + 10], act: () => { play('click'); talk.say('Hej! 👋 Gå fram till en docka eller en hylla så får du prova plagget på dig.', { x: DESK.x + DESK.w / 2, y: DESK.y - 30 }); } },
    ...[[8, 84], [W - 84, W - 8]].map(([a, b], i) => ({ id: 'prov' + i, r: [a, 18, b, WALL_Y], go: [(a + b) / 2, WALL_Y + 12], act: () => { play('click'); talk.say('🪞 Provhytten! Klickar jag på ett plagg ser jag det på mig innan jag köper.', () => ({ x: walker.px, y: walker.py - 44 })); } })),
    ...RACKS.map(([x0], i) => ({ id: 'stang' + i, r: [x0 - 2, 16, x0 + 72, WALL_Y - 2], go: [x0 + 35, WALL_Y + 12], act: () => { play('click'); talk.say('👗 Stången är bara för att titta – allt som säljs står på dockorna och hyllorna.', () => ({ x: walker.px, y: walker.py - 44 })); } })),
  ];
  for (const s of spots) if (s.item) s.act = () => { hoverId = null; openBuy(A, s.item); };
  const spotAt = (x, y) => spots.find((h) => x >= h.r[0] && x <= h.r[2] && y >= h.r[1] && y <= h.r[3]);
  // den vara man står vid (eller pekar på) får namnskylten nertill; musens pekning
  // glöms efter en stund utan rörelse (main.js säger inte till när musen lämnar spelet)
  const focusSpot = () => {
    const h = hoverId && t - hoverT < 4 && spots.find((s) => s.id === hoverId);
    if (h?.item) return h;
    if (walker.path.length) return null;
    return spots.find((s) => s.item && Math.abs(walker.px - s.go[0]) < 7 && Math.abs(walker.py - s.go[1]) < 7) || null;
  };

  return {
    get worldX() { return walker.px; },
    get worldY() { return walker.py; },
    _debug: {
      spot: (id) => { const h = spots.find((h) => h.id === id); return h ? { x: (h.r[0] + h.r[2]) / 2 - cam.x, y: (h.r[1] + h.r[3]) / 2 } : null; },
      dummies: DUMMIES.map((d) => clothesKey(d.s.kind, d.s.v)),
      depts: DUMMIES.map((d) => d.dept),
      lockCam: (x) => { lockedCam = x === null || x === undefined ? null : Math.max(0, Math.min(W - VW, x)); cam.x = camTarget(); },
      teleport: (x, y) => { walker.px = x; walker.py = y; walker.stop(); walker.snapFree(); cam.x = camTarget(); },
      hover: (id) => { hoverId = id || null; hoverT = t; },
      cam: () => cam.x,
      path: () => walker.path.map(([x, y]) => [Math.round(x), Math.round(y)]),
      open: (id) => spots.find((h) => h.id === id)?.act?.(),
    },
    update(dt) {
      t += dt;
      walker.update(dt);
      const k = lockedCam !== null ? 1 : Math.min(1, dt * 6);
      cam.x += (camTarget() - cam.x) * k;
    },
    down(sx, sy) {
      const x = sx + cam.x, y = sy;
      hoverId = null; // skylten följer figuren igen tills musen rör sig
      const h = spotAt(x, y);
      if (h) { walker.walkTo(h.go[0], h.go[1], h.act); return; }
      if (y > WALL_Y) walker.walkTo(x, y);
    },
    move(sx, sy) { hoverId = spotAt(sx + cam.x, sy)?.id || null; hoverT = t; },
    draw(ctx) {
      const cx = Math.round(cam.x);
      ctx.setTransform(A.pxs, 0, 0, A.pxs, -cx * A.pxs, 0);
      ctx.drawImage(bg, 0, 0);
      const focus = focusSpot();
      // väggen: affischen, REA-skylten, byster med hattar
      drawPoster(ctx);
      if (g.eventIs('rea')) drawRea(ctx, t);
      for (const w of WALLS) {
        drawBust(ctx, w.x, w.y, w.look);
        priceTag(ctx, w.x, w.y + 4, w.s, owned(w.s), g);
      }
      const drawables = [...folkDrawables(A, t), selfDrawable(A, walker, t, { folksHere: A.worldFolksHere?.().length || 0 })];
      for (const d of DUMMIES) drawables.push({
        fy: d.y,
        draw: () => {
          const on = focus?.item === d;
          if (on) ctx.drawImage(glowImg, d.x - 20, d.y - 7);
          ctx.drawImage(pod[d.dept], d.x - 12, d.y - 4);
          drawPerson(ctx, d.x, d.y, d.look, 'down', 0);
          const [hx, hy] = HANG_AT[d.s.kind] || HANG_AT.top;
          hangTag(ctx, d.x + hx, d.y + hy, owned(d.s), on && Math.floor(t * 4) % 2 === 0);
          dummyTag(ctx, d.x, d.y + 7, d.s, owned(d.s), g, d.dept);
          if (on) sparkle(ctx, d, t);
        },
      });
      drawables.push({
        fy: GOND.y + GOND.h,
        draw: () => {
          ctx.drawImage(gondImg, GOND.x, GOND.y);
          for (const it of SHELF) {
            const on = focus?.item === it;
            if (on) { ctx.fillStyle = 'rgba(255,230,128,.45)'; ctx.fillRect(it.x - 13, it.y - (it.y === GTOP ? 23 : 17), 26, it.y === GTOP ? 23 : 17); }
            if (it.s.kind === 'bag') drawBag(ctx, it.x, it.y, it.s.v, it.look.bagColor);
            else if (it.s.kind === 'glasses') drawGlassesStand(ctx, it.x, it.y, it.s.v);
            else drawBust(ctx, it.x, it.y, it.look);
            priceTag(ctx, it.x, it.y + 1, it.s, owned(it.s), g);
          }
        },
      });
      drawables.push({
        fy: DESK.y + DESK.h,
        draw: () => {
          drawPerson(ctx, DESK.x + 34, DESK.y + 14, CLERK, 'down', Math.sin(t * 1.7) > 0.93 ? 4 : 0);
          ctx.drawImage(deskImg, DESK.x, DESK.y);
        },
      });
      for (const [x, y] of PLANTS) drawables.push({ fy: y, draw: () => ctx.drawImage(plantImg, x - 11, y - 31) });
      drawables.sort((a, b) => a.fy - b.fy).forEach((d) => d.draw(ctx));
      // den valda dockans lapp överst (så att ingen som går förbi skymmer den), med ljus ram
      if (focus && DUMMIES.includes(focus.item)) {
        const d = focus.item;
        dummyTag(ctx, d.x, d.y + 7, d.s, owned(d.s), g, d.dept, true);
      }
      talk.draw(ctx, { x0: cx, x1: cx + VW });
      // pilar mot avdelningen man inte ser + namnskylten i skärmens nederkant
      ctx.setTransform(A.pxs, 0, 0, A.pxs, 0, 0);
      if (cx > 150) edgeSign(ctx, 'tjej');
      if (cx < W - VW - 150) edgeSign(ctx, 'kille');
      // står man längst ner (t.ex. framför accessoarhyllan) hamnar skylten överst i stället
      if (focus) bigLabel(ctx, focus, g, t, walker.py > H - 44);
    },
  };
}

// ---------- ritning av varor och lappar ----------

// Mannekängens lapp: namnet överst, priset under (grön "DIN"-lapp när den är din)
function dummyTag(ctx, x, y, s, isOwned, g, dept, hi = false) {
  const name = SHORT[clothesKey(s.kind, s.v)] || s.name.toUpperCase();
  const price = g.clothesPrice(s), rea = price !== s.price;
  const line2 = isOwned ? 'DIN' : `${price} KR`;
  const w = Math.max(textW(SMALL, name), textW(SMALL, line2)) + 6, h = 15;
  const x0 = Math.round(x - w / 2);
  if (hi) { ctx.fillStyle = '#ffe070'; ctx.fillRect(x0 - 2, y - 2, w + 4, h + 4); }
  ctx.fillStyle = '#17151a'; ctx.fillRect(x0 - 1, y - 1, w + 2, h + 2);
  ctx.fillStyle = isOwned ? '#45b964' : '#fbf6ea'; ctx.fillRect(x0, y, w, h);
  ctx.fillStyle = isOwned ? '#2f8f46' : dept === 'tjej' ? '#f28bb3' : '#3a7bd5'; ctx.fillRect(x0, y, w, 2);
  ctxText(ctx, SMALL, name, x0 + Math.round((w - textW(SMALL, name)) / 2), y + 3, isOwned ? '#ffffff' : '#17151a');
  ctxText(ctx, SMALL, line2, x0 + Math.round((w - textW(SMALL, line2)) / 2), y + 9, isOwned ? '#ffffff' : rea ? '#c9323a' : '#6d4a10');
}

// Liten prislapp under en vara på hyllan ("150:-" = 150 kronor)
function priceTag(ctx, x, y, s, isOwned, g) {
  const price = g.clothesPrice(s);
  const lbl = isOwned ? 'DIN' : `${price}:-`;
  const w = textW(SMALL, lbl) + 4, x0 = Math.round(x - w / 2);
  ctx.fillStyle = '#17151a'; ctx.fillRect(x0 - 1, y - 1, w + 2, 9);
  ctx.fillStyle = isOwned ? '#45b964' : price !== s.price ? '#ff8a80' : '#f0d048'; ctx.fillRect(x0, y, w, 7);
  ctxText(ctx, SMALL, lbl, x0 + 2, y + 1, isOwned ? '#ffffff' : '#3a2a10');
}

// Gul hänglapp (grön = din) som hänger i ett snöre från plagget som säljs
function hangTag(ctx, x, y, isOwned, blink) {
  ctx.fillStyle = '#3a3440'; ctx.fillRect(x - 1, y - 1, 1, 1); ctx.fillRect(x, y, 1, 1); ctx.fillRect(x + 1, y + 1, 1, 1); // snöret
  ctx.fillStyle = blink ? '#ffffff' : '#17151a'; ctx.fillRect(x + 1, y + 2, 6, 7);
  ctx.fillStyle = isOwned ? '#45b964' : '#f0d048'; ctx.fillRect(x + 2, y + 3, 4, 5);
  ctx.fillStyle = isOwned ? '#8fe0a2' : '#fff2a0'; ctx.fillRect(x + 2, y + 3, 4, 1);
  ctx.fillStyle = isOwned ? '#2f8f46' : '#c9982a'; ctx.fillRect(x + 2, y + 7, 4, 1);
  ctx.fillStyle = '#17151a'; ctx.fillRect(x + 3, y + 4, 1, 1); // hålet
}

// Glasögon i dubbel storlek på ett eget ställ: f båge, l glas, w glans, d mörkt glas, s blänk
const GLASS = {
  round: ['..fff...fff..', '.fwllf.fwllf.', 'fflllffflllff', '.flllf.flllf.', '..fff...fff..'],
  square: ['.fffff.fffff.', '.fwllf.fwllf.', 'fflllffflllff', '.flllf.flllf.', '.fffff.fffff.'],
  sun: ['fffffffffffff', 'fsddddfsddddf', '.ddddd.ddddd.', '..ddd...ddd..'],
};
const GLASS_FRAME = { round: '#7a4520', square: '#1f1f26', sun: '#1f1f26' };
function drawGlassesStand(ctx, x, base, v) {
  // fot + stång + näsbrygga i blank metall
  ctx.fillStyle = '#5a5058'; ctx.fillRect(x - 5, base - 2, 11, 2);
  ctx.fillStyle = '#a8a0aa'; ctx.fillRect(x - 4, base - 2, 9, 1);
  ctx.fillStyle = '#c9ccd6'; ctx.fillRect(x, base - 14, 1, 12);
  ctx.fillStyle = '#8a8e9a'; ctx.fillRect(x + 1, base - 14, 1, 12);
  ctx.fillStyle = '#c9ccd6'; ctx.fillRect(x - 1, base - 15, 4, 1);
  const map = GLASS[v] || GLASS.square;
  const pal = { f: GLASS_FRAME[v] || '#1f1f26', l: '#d8eef8', w: '#ffffff', d: '#16161c', s: '#8fa0b8' };
  const x0 = x - 6, y0 = base - 20;
  map.forEach((row, j) => { for (let i = 0; i < row.length; i++) { const ch = row[i]; if (ch === '.') continue; ctx.fillStyle = pal[ch]; ctx.fillRect(x0 + i, y0 + j, 1, 1); } });
}

// Byst (huvud + axlar) på en liten fot – för hattar, glasögon och hörlurar
function drawBust(ctx, x, base, look) {
  ctx.fillStyle = '#5a5058'; ctx.fillRect(x - 5, base - 2, 11, 2);
  ctx.fillStyle = '#8e8690'; ctx.fillRect(x - 4, base - 2, 9, 1);
  ctx.fillStyle = '#a8a0aa'; ctx.fillRect(x - 1, base - 5, 3, 3);
  ctx.fillStyle = '#6d6570'; ctx.fillRect(x + 1, base - 5, 1, 3);
  ctx.save();
  ctx.beginPath(); ctx.rect(x - 12, base - 26, 24, 21); ctx.clip();
  drawPerson(ctx, x, base - 26 + 39, look, 'down', 0);
  ctx.restore();
  ctx.fillStyle = '#4a4250'; ctx.fillRect(x - 6, base - 5, 13, 1);
}

// Väskor (pixelkartor): o kontur, h ljus, b bas, l skugga, d mörk, m metall, s rem
const BAGS = {
  backpack: [
    '....oooo....',
    '...o.dd.o...',
    '.oooooooooo.',
    'ohhhhhhhhhbo',
    'ohbbbbbbbblo',
    'ohbbbbmbbblo',
    'ohbbbbbbbblo',
    'ohbddddddblo',
    'ohdlllllldlo',
    'ohdllmllldlo',
    'ohdlllllldlo',
    'ohbddddddblo',
    'olllllllllll',
    '.oooooooooo.',
  ],
  shoulder: [
    '...ssssss...',
    '..s......s..',
    '.s........s.',
    '.s........s.',
    'oooooooooooo',
    'ohhhhhhhhhbo',
    'ohbbbbbbbblo',
    'odddddmddddo',
    'ohbbbbbbbblo',
    'ohbbbbbbbblo',
    'ollllllllllo',
    '.oooooooooo.',
  ],
};
function drawBag(ctx, x, base, v, color) {
  const c = hex(color, 0x3a7bd5);
  const pal = { o: '#1d1822', h: css(mix(mul(c, 1.15), 0xfff4e0, 0.18)), b: css(c), l: css(mix(mul(c, 0.74), 0x2a1f3a, 0.12)), d: css(mix(mul(c, 0.5), 0x1a1426, 0.2)), m: '#e8d890', s: css(mix(mul(c, 0.55), 0x1a1426, 0.2)) };
  const map = BAGS[v] || BAGS.backpack;
  const x0 = Math.round(x - map[0].length / 2), y0 = base - map.length;
  ctx.fillStyle = 'rgba(20,12,30,.25)'; ctx.fillRect(x0 + 1, base - 1, map[0].length - 1, 1);
  map.forEach((row, j) => { for (let i = 0; i < row.length; i++) { const ch = row[i]; if (ch === '.') continue; ctx.fillStyle = pal[ch]; ctx.fillRect(x0 + i, y0 + j, 1, 1); } });
}

// Glitter vid plagget på mannekängen man står vid
function sparkle(ctx, d, t) {
  const k = d.s.kind, y = k === 'hat' ? d.y - 40 : k === 'bottom' ? d.y - 10 : d.y - 22;
  const ph = Math.floor(t * 5) % 4;
  const x = d.x - 10; // vänster sida – hänglappen sitter till höger
  ctx.fillStyle = '#fff6b0';
  ctx.fillRect(x, y - 1 - (ph === 1 ? 1 : 0), 1, 3 + (ph === 1 ? 2 : 0));
  ctx.fillRect(x - 1 - (ph === 1 ? 1 : 0), y, 3 + (ph === 1 ? 2 : 0), 1);
  ctx.fillStyle = '#ffffff'; ctx.fillRect(x, y, 1, 1);
  if (ph >= 2) { ctx.fillStyle = '#fff6b0'; ctx.fillRect(x + 1, y - 6, 1, 1); ctx.fillRect(x + 1, y - 4, 1, 1); ctx.fillRect(x, y - 5, 1, 1); ctx.fillRect(x + 2, y - 5, 1, 1); }
}

// Namnskylt i skärmens nederkant för varan man står vid / pekar på (skymmer aldrig
// några andra lappar). Samma gula hänglapp som på plagget + "klicka för att prova".
function bigLabel(ctx, spot, g, t, atTop = false) {
  const s = spot.item.s;
  const isOwned = g.wardrobe.includes(clothesKey(s.kind, s.v));
  const name = s.name.toUpperCase(), price = isOwned ? 'DIN!' : `${g.clothesPrice(s)} KR`;
  const hint = isOwned ? 'KLICKA SÅ TAR DU PÅ DIG DEN' : 'KLICKA SÅ PROVAR DU DEN PÅ DIG';
  const nw = textW(BIG, name), pw = textW(BIG, price), hw = textW(SMALL, hint);
  const w = Math.max(nw + pw + 26, hw + 26), h = 22;
  const x0 = Math.round((VW - w) / 2), y0 = atTop ? 3 : H - h - 3;
  const th = DEPT[spot.item.dept];
  ctx.fillStyle = '#0e0d12'; ctx.fillRect(x0 - 2, y0 - 2, w + 4, h + 4);
  ctx.fillStyle = th.lbl; ctx.fillRect(x0 - 1, y0 - 1, w + 2, h + 2);
  ctx.fillStyle = '#17151a'; ctx.fillRect(x0, y0, w, h);
  hangTag(ctx, x0 + 4, y0 + 3, isOwned, false);
  ctxText(ctx, BIG, name, x0 + 16, y0 + 3, '#ffffff');
  ctxText(ctx, BIG, price, x0 + 22 + nw, y0 + 3, isOwned ? '#6fe08a' : '#f0d048');
  const blink = Math.floor(t * 2) % 2 === 0;
  ctxText(ctx, SMALL, hint, x0 + 16, y0 + 14, blink ? th.lbl : '#c9c2d2');
}

// Skylt i skärmkanten mot avdelningen man inte ser just nu
function edgeSign(ctx, dept) {
  const th = DEPT[dept], left = dept === 'tjej';
  const lbl = th.name, tw = textW(SMALL, lbl);
  const w = tw + 13, x0 = left ? 3 : VW - w - 3, y0 = H - 14;
  ctx.fillStyle = th.lbl; ctx.fillRect(x0 - 1, y0 - 1, w + 2, 11);
  ctx.fillStyle = '#17151a'; ctx.fillRect(x0, y0, w, 9);
  ctxText(ctx, SMALL, lbl, left ? x0 + 9 : x0 + 3, y0 + 2, th.lbl);
  // pilspets mot avdelningen
  ctx.fillStyle = th.lbl;
  for (let i = 0; i < 3; i++) ctx.fillRect(left ? x0 + 3 + i : x0 + w - 4 - i, y0 + 4 - i, 1, 1 + 2 * i);
}

// Affischen till vänster om dörren: två figurer i höstens outfits
function drawPoster(ctx) {
  ctx.save();
  ctx.beginPath(); ctx.rect(310, 33, 44, 29); ctx.clip();
  drawPerson(ctx, 322, 70, POSTER[0], 'down', 0);
  drawPerson(ctx, 342, 70, POSTER[1], 'down', 0);
  ctx.restore();
  // "NYTT!"-lappen klistrad ovanpå figurerna (annars skär byxorna av texten)
  const ny = 'NYTT!', nw = textW(SMALL, ny) + 6, x0 = 360 - nw;
  ctx.fillStyle = '#17151a'; ctx.fillRect(x0 - 1, 57, nw + 2, 10);
  ctx.fillStyle = '#d9433b'; ctx.fillRect(x0, 58, nw, 8);
  ctx.fillStyle = '#ff7a6b'; ctx.fillRect(x0, 58, nw, 1);
  ctxText(ctx, SMALL, ny, x0 + 3, 60, '#ffffff');
}

function drawRea(ctx, t) {
  const on = Math.floor(t * 2) % 2 === 0;
  const lbl = 'REA -25%';
  const w = textW(BIG, lbl) + 10, x0 = 436 - w / 2 | 0, y0 = 42;
  ctx.fillStyle = '#17151a'; ctx.fillRect(x0 - 1, y0 - 1, w + 2, 13);
  ctx.fillStyle = on ? '#d9433b' : '#b8323a'; ctx.fillRect(x0, y0, w, 11);
  ctxText(ctx, BIG, lbl, x0 + 5, y0 + 2, '#ffffff');
}

// ================= förmålade bilder =================

function disc(P, cx, cy, rx, ry, c) {
  for (let y = Math.floor(cy - ry); y <= cy + ry; y++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
    if (((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1) P.px(x, y, c);
  }
}

function paintPodium(dept) {
  const P = new Pix(24, 12);
  const top = dept === 'tjej' ? 0xf7eef3 : 0x4a5568, side = dept === 'tjej' ? 0xe7a9c8 : 0x2c3444, trim = dept === 'tjej' ? 0xc65fa0 : 0x3fc4ff;
  for (let x = 0; x < 24; x++) {
    const dx = (x + 0.5 - 12) / 11.5;
    if (Math.abs(dx) >= 1) continue;
    const e = Math.sqrt(1 - dx * dx) * 3.5;
    const y0 = Math.round(3.5 - e), y1 = Math.round(3.5 + e);
    for (let y = y0; y <= y1 + 5; y++) {
      let c;
      if (y <= y1) c = y === y0 ? mix(top, 0xffffff, 0.35) : top;
      else if (y === y1 + 1) c = trim;
      else c = mix(side, 0x000000, (y - y1) * 0.04 + (dx > 0.4 ? 0.12 : dx < -0.6 ? -0.05 : 0));
      if (y === y1 + 5) c = mul(side, 0.6);
      P.px(x, y, c);
    }
  }
  // glans på toppen
  P.hl(6, 2, 4, mix(top, 0xffffff, 0.6));
  return P.flush();
}

function paintGlow() {
  const P = new Pix(40, 16);
  P.ell(20, 8, 19, 7, 0xfff0a0, 0.8, 4);
  return P.flush();
}

function paintPlant() {
  const P = new Pix(22, 32);
  // blad (monstera-aktiga) i tre gröna toner
  const leaves = [[11, 8, 6, 5, 0x2f7a3e], [6, 13, 5, 4, 0x3a8f48], [16, 13, 5, 4, 0x2f7a3e], [9, 17, 5, 4, 0x46a35a], [14, 18, 5, 3, 0x3a8f48], [11, 12, 4, 4, 0x56b866], [4, 19, 4, 3, 0x2f7a3e], [18, 19, 4, 3, 0x46a35a]];
  for (const [x, y, rx, ry] of leaves) disc(P, x, y, rx + 0.6, ry + 0.6, 0x173d22);
  for (const [x, y, rx, ry, c] of leaves) { disc(P, x, y, rx, ry, c); P.hl(x - rx + 2, y - ry + 1, Math.max(1, rx - 1), mix(c, 0xffffff, 0.3)); P.vl(x, y - ry + 1, ry * 2 - 1, mul(c, 0.8)); }
  // stjälkar
  P.vl(11, 18, 5, 0x2a5a2e); P.vl(9, 20, 3, 0x2a5a2e); P.vl(13, 20, 3, 0x2a5a2e);
  // kruka
  P.rect(6, 22, 10, 9, 0xf4f1ea); P.rect(5, 22, 12, 2, 0xffffff); P.vl(15, 24, 7, 0xcfc8b8); P.vl(6, 24, 7, 0xfbfaf6);
  P.box(5, 22, 12, 2, 0x5a5048); P.vl(5, 24, 7, 0x5a5048); P.vl(16, 24, 7, 0x5a5048); P.hl(6, 31, 10, 0x5a5048);
  P.hl(7, 26, 8, 0xe8b230);
  return P.flush();
}

// Accessoarhyllan: skylt, två hyllplan, sockel. Varorna ritas ovanpå.
function paintGondola() {
  const { w, h } = GOND;
  const P = new Pix(w, h);
  const ink = 0x1d1822, wood = 0xc9a06b, woodLo = 0x9a7448, back = 0xefe6d6;
  // bakstycke (perforerad skiva)
  P.rect(2, 9, w - 4, h - 17, back);
  for (let y = 12; y < h - 10; y += 4) for (let x = 5; x < w - 4; x += 4) P.px(x, y, 0xd6cab4);
  P.box(1, 8, w - 2, h - 15, ink);
  // skylt
  P.rect(0, 0, w, 10, 0x17151a);
  P.hl(1, 1, w - 2, 0x3a3440);
  const lbl = 'ACCESSOARER';
  text(P, SMALL, lbl, Math.round(w / 2 - textW(SMALL, lbl) / 2), 3, 0xf0d048);
  P.rect(3, 3, 5, 5, 0xf28bb3); P.rect(w - 8, 3, 5, 5, 0x3fc4ff);
  // hyllplan
  for (const sy of [GTOP - GOND.y, GBOT - GOND.y]) {
    P.rect(1, sy, w - 2, 2, wood); P.hl(1, sy, w - 2, mix(wood, 0xffffff, 0.3));
    P.rect(1, sy + 2, w - 2, 2, woodLo);
    P.hl(1, sy + 4, w - 2, mul(back, 0.8));
  }
  // sockel
  P.rect(0, h - 7, w, 7, 0x3a3440); P.hl(0, h - 7, w, 0x5a5460); P.hl(0, h - 1, w, 0x17151a);
  P.vl(0, 8, h - 8, ink); P.vl(w - 1, 8, h - 8, ink);
  // liten skylt mellan väskorna
  const vw = textW(SMALL, 'VÄSKOR') + 4, vx = Math.round(w / 2 - vw / 2) + 1;
  P.rect(vx, 44, vw, 8, 0x17151a); text(P, SMALL, 'VÄSKOR', vx + 2, 46, 0xf28bb3);
  return P.flush();
}

function paintDesk() {
  const { w, h } = DESK;
  const P = new Pix(w, h);
  const ink = 0x1d1822;
  // bänkskiva
  P.rect(0, 8, w, 6, 0xe9e1d2); P.hl(0, 8, w, 0xfaf6ee); P.hl(0, 13, w, 0xb8ad98);
  // front
  P.rect(1, 14, w - 2, h - 15, 0xc9a06b);
  for (let x = 3; x < w - 2; x += 6) P.vl(x, 15, h - 17, 0xb08850);
  P.rect(1, 18, w - 2, 3, 0xf28bb3); P.rect(Math.round(w / 2), 18, Math.round(w / 2) - 1, 3, 0x3fc4ff);
  P.hl(1, h - 2, w - 2, 0x7a5a38);
  P.box(0, 8, w, h - 8, ink);
  // kassaapparat
  P.rect(34, 0, 16, 9, 0x2a2a32); P.rect(35, 1, 14, 4, 0x6fe08a); P.hl(36, 2, 6, 0x1d5a2c); P.hl(36, 3, 9, 0x2f8f46);
  P.rect(33, 6, 18, 3, 0x3a3a44); P.hl(33, 6, 18, 0x5a5a64);
  // påsar med logga + kortläsare
  P.rect(6, 1, 9, 8, 0xf28bb3); P.box(6, 1, 9, 8, 0x8a3a60); P.hl(8, 0, 5, 0x8a3a60);
  P.rect(16, 3, 8, 6, 0x3fc4ff); P.box(16, 3, 8, 6, 0x1f5a8a); P.hl(18, 2, 4, 0x1f5a8a);
  P.rect(54, 4, 5, 5, 0x2a2a32); P.hl(55, 5, 3, 0x8fa0b8);
  return P.flush();
}

// ---------- hela butiken (väggar, golv, inredning) ----------
function paintStore() {
  const P = new Pix(W, H);
  // ===== väggar =====
  // tjejer: rosa randig tapet med små hjärtan
  const HEART = ['.#.#.', '#####', '.###.', '..#..'];
  for (let y = 0; y < WALL_Y; y++) for (let x = 0; x < MID0; x++) {
    const stripe = ((x / 8) | 0) % 2;
    let c = stripe ? 0xeeb6d2 : 0xe3a0c4;
    c = mix(c, 0xffffff, (bayer(x, y) - 0.5) * 0.05);
    P.px(x, y, c);
  }
  for (let y = 8; y < 54; y += 12) for (let x = 2; x < MID0 - 6; x += 16) {
    const ox = x + (((y / 12) | 0) % 2 ? 8 : 0) + 1;
    HEART.forEach((row, j) => { for (let i = 0; i < 5; i++) if (row[i] === '#') P.px(ox + i, y + j, 0xfff0f7, 0.55); });
  }
  // killar: blå panelvägg (slatwall)
  for (let y = 0; y < WALL_Y; y++) for (let x = MID1; x < W; x++) {
    const r = y % 6;
    let c = r === 5 ? 0x1f3350 : r === 0 ? 0x4a70a2 : 0x3a5f8f;
    c = mix(c, 0x000000, (bayer(x, y) - 0.5) * 0.06 + (hash((x / 48) | 0, (y / 6) | 0, 3) - 0.5) * 0.06);
    P.px(x, y, c);
  }
  // mitten: varm puts
  for (let y = 0; y < WALL_Y; y++) for (let x = MID0; x < MID1; x++) {
    let c = mix(0xefe5d2, 0xe4d8c0, hash(x >> 1, y >> 1, 9) * 0.35 + (bayer(x, y) - 0.5) * 0.15);
    P.px(x, y, c);
  }
  // bröstpanel längst ner på väggen
  for (let x = 0; x < W; x++) {
    const zone = x < MID0 ? 0 : x < MID1 ? 1 : 2;
    const base = [0xf8eef3, 0xb98a5e, 0x2f6b58][zone], trim = [0xd98fb4, 0x8a6440, 0x4f9c82][zone];
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
  for (let x = 20; x < W; x += 44) {
    if (x > DOOR.x0 - 16 && x < DOOR.x1 + 16) continue;
    P.ell(x, 20, 16, 26, 0xfff4dc, 0.22, 5);
    P.rect(x - 2, 3, 5, 3, 0x1d1822); P.hl(x - 1, 5, 3, 0xfff6c8);
  }
  // pelare mellan avdelningarna
  for (const px of [MID0, MID1]) {
    P.rect(px - 5, 0, 10, WALL_Y, 0xdcd4c8);
    P.vl(px - 5, 0, WALL_Y, 0xf2ece2); P.vl(px - 4, 0, WALL_Y, 0xe8e0d4);
    P.vl(px + 3, 0, WALL_Y, 0xb8ae9e); P.vl(px + 4, 0, WALL_Y, 0x8a8070);
    P.rect(px - 6, 3, 12, 3, 0xc9bfae); P.rect(px - 6, WALL_Y - 4, 12, 4, 0xa89e8c);
  }

  // ===== dörren i mitten + skylten KLÄDER =====
  const lw = textW(BIG, 'KLÄDER', 2) + 16;
  P.rect(384 - lw / 2, 5, lw, 20, 0x17151a); P.box(384 - lw / 2, 5, lw, 20, 0xe8b230);
  P.box(384 - lw / 2 + 2, 7, lw - 4, 16, 0x5a4a20);
  glowText(P, BIG, 'KLÄDER', 384 - textW(BIG, 'KLÄDER', 2) / 2, 9, 0xffe070, 0xe8b230, 2);
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
  P.rect(DOOR.x0 + 5, 32, 22, 9, 0x1d2b1f); text(P, SMALL, 'UT', DOOR.x0 + 12, 34, 0x6fe08a);
  // dörrmatta
  P.rect(DOOR.x0 - 4, WALL_Y, DOOR.x1 - DOOR.x0 + 8, 10, 0x3a3640);
  P.box(DOOR.x0 - 4, WALL_Y, DOOR.x1 - DOOR.x0 + 8, 10, 0x5a5460);
  for (let x = DOOR.x0 - 2; x < DOOR.x1 + 2; x += 2) P.vl(x, WALL_Y + 2, 6, 0x2e2a34);

  // affischram vänster om dörren (figurerna ritas levande)
  P.rect(306, 29, 52, 37, 0x17151a);
  P.rect(308, 31, 48, 33, 0xfbe3ef); P.rect(332, 31, 24, 33, 0xe0ebf8);
  for (let y = 31; y < 64; y++) for (let x = 308; x < 356; x++) if ((x + y) % 7 === 0) P.px(x, y, 0xffffff, 0.5);
  // KASSA-skylt
  const kw = textW(SMALL, 'KASSA') + 10;
  P.rect(436 - kw / 2, 30, kw, 10, 0x17151a); P.box(436 - kw / 2, 30, kw, 10, 0xe8b230);
  text(P, SMALL, 'KASSA', 436 - kw / 2 + 5, 33, 0xf0d048);

  // ===== avdelningarnas skyltar =====
  deptSign(P, 'tjej', 241, 5);
  deptSign(P, 'kille', W - 241, 5);

  // ===== provhytter =====
  fittingRooms(P, 8, 0xc65fa0, 0x8a3a70, 0xf7eef3);
  fittingRooms(P, W - 84, 0x2d4a78, 0x1a2c4c, 0xdfe8f4);

  // ===== speglar =====
  mirror(P, 92, 0xd8b24a);
  mirror(P, W - 112, 0xc9ccd6);

  // ===== klädställning på väggen =====
  for (const [x, dept] of RACKS) rack(P, x, dept);

  // ===== hatthyllor (bysterna ritas levande) =====
  hatShelf(P, 190, 0xf7eef3, 0xd98fb4);
  hatShelf(P, W - 288, 0x3a4658, 0x3fc4ff);

  // ===== golv =====
  for (let y = WALL_Y; y < H; y++) for (let x = 0; x < W; x++) {
    let c;
    if (x < MID0) c = plank(x, y, 0xe2bcc6, 11);
    else if (x >= MID1) c = plank(x, y, 0x98a6b8, 23);
    else {
      const tx = ((x - MID0) / 16) | 0, ty = ((y - WALL_Y) / 16) | 0;
      c = (tx + ty) % 2 ? 0xeee6d8 : 0xe0d5c2;
      c = mix(c, 0xd0c4ae, hash(x >> 2, y >> 2, 17) * 0.25);
      if ((x - MID0) % 16 === 0 || (y - WALL_Y) % 16 === 0) c = 0xc9bca4;
      if (hash(x, y, 4) > 0.985) c = mul(c, 0.94);
    }
    P.px(x, y, c);
  }
  // mattor under mannekängerna
  rug(P, 10, 88, MID0 - 20, 108, 0xc9a0dc, 0xf28bb3, 0xfbe3ef, 31);
  rug(P, MID1 + 10, 88, MID0 - 20, 108, 0x34507a, 0x3fc4ff, 0x7fb8e8, 37);
  // mässingslist mellan avdelningarna
  for (const px of [MID0, MID1]) { P.rect(px - 1, WALL_Y, 2, H - WALL_Y, 0xd8b24a); P.vl(px - 1, WALL_Y, H - WALL_Y, 0xf0d890); }
  // skugga längs väggen
  for (let i = 0; i < 5; i++) P.darken(0, WALL_Y + i, W, 1, 0.8 + i * 0.04);
  // ljuspölar under mannekängerna och framför hyllorna
  for (const d of DUMMIES) P.ell(d.x, d.y + 1, 18, 7, 0xfff6e0, 0.28, 4);
  P.ell(GOND.x + GOND.w / 2, GOND.y + GOND.h, 64, 10, 0xfff6e0, 0.2, 4);

  P.box(0, 0, W, H, 0x0e0d12);
  return P.flush();
}

function plank(x, y, base, seed) {
  const ph = 7, row = ((y - WALL_Y) / ph) | 0, yy = (y - WALL_Y) % ph;
  const L = 36, off = (hash(row, 1, seed) * L) | 0;
  const px = x + off, pi = (px / L) | 0, pin = px % L;
  let c = mul(base, 0.93 + hash(pi, row, seed) * 0.12);
  if (yy === ph - 1) c = mul(c, 0.8);
  else if (pin === 0) c = mul(c, 0.84);
  else if (yy === 0) c = mix(c, 0xffffff, 0.1);
  else if (hash(px >> 3, y, seed + 1) > 0.9) c = mul(c, 0.96);
  return c;
}

function rug(P, x0, y0, w, h, base, border, dots, seed) {
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) {
    const ex = Math.min(x - x0, x0 + w - 1 - x), ey = Math.min(y - y0, y0 + h - 1 - y), e = Math.min(ex, ey);
    let c = base;
    if (e < 3) c = border;
    else if (e === 3) c = mix(border, 0xffffff, 0.3);
    else if (e === 6) c = mix(base, border, 0.5);
    else if ((x + y) % 12 === 0 || (x - y + 1200) % 12 === 0) c = mix(base, dots, 0.45);
    c = mix(c, 0x000000, (bayer(x, y) - 0.5) * 0.06 + (hash(x >> 1, y >> 1, seed) - 0.5) * 0.04);
    P.px(x, y, c);
  }
  // fransar
  for (let x = x0 + 2; x < x0 + w - 2; x += 2) { P.px(x, y0 - 1, mix(border, 0xffffff, 0.4)); P.px(x, y0 + h, mix(border, 0xffffff, 0.4)); }
}

function glowText(P, F, s, x, y, c, glow, scale = 1) {
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, 1], [1, -1], [-1, 1]]) text(P, F, s, x + dx, y + dy, glow, 0.35, scale);
  text(P, F, s, x, y, c, 1, scale);
}

function deptSign(P, dept, cx, y) {
  const th = DEPT[dept];
  const tw = textW(BIG, th.name, 2), w = tw + 30, x0 = Math.round(cx - w / 2), h = 22;
  P.ell(cx, y + h / 2, w * 0.7, h, th.glow, 0.2, 5);
  P.rect(x0, y, w, h, th.board);
  P.box(x0, y, w, h, mul(th.trim, 0.6));
  P.box(x0 + 1, y + 1, w - 2, h - 2, th.trim);
  // neontext
  glowText(P, BIG, th.name, x0 + 15, y + 4, th.neon, th.glow, 2);
  // ikoner på sidorna
  if (dept === 'tjej') {
    for (const ox of [x0 + 5, x0 + w - 10]) ['.#.#.', '#####', '#####', '.###.', '..#..'].forEach((row, j) => { for (let i = 0; i < 5; i++) if (row[i] === '#') P.px(ox + i, y + 8 + j, th.neon); });
  } else {
    for (const ox of [x0 + 5, x0 + w - 10]) ['..#..', '.###.', '#####', '..#..', '.#.#.'].forEach((row, j) => { for (let i = 0; i < 5; i++) if (row[i] === '#') P.px(ox + i, y + 8 + j, th.neon); });
  }
  // upphängning
  P.vl(x0 + 8, 2, y - 2, 0x8a8e9a); P.vl(x0 + w - 9, 2, y - 2, 0x8a8e9a);
}

function fittingRooms(P, x0, cur, curLo, frame) {
  const lbl = 'PROVHYTT';
  const lw = textW(SMALL, lbl) + 8;
  P.rect(x0 + 38 - lw / 2, 8, lw, 9, 0x17151a); text(P, SMALL, lbl, x0 + 38 - lw / 2 + 4, 10, 0xffffff);
  for (let k = 0; k < 2; k++) {
    const x = x0 + k * 40, w = 36, y = 20;
    // ram + inre
    P.rect(x, y, w, WALL_Y - y, frame);
    P.rect(x + 3, y + 4, w - 6, WALL_Y - y - 4, 0x3a2e3a);
    P.rect(x + 3, y + 4, w - 6, 2, 0x241c26);
    // spegel + krok inne i hytten
    P.rect(x + 22, y + 8, 7, 22, 0xb8d4e0); P.box(x + 21, y + 7, 9, 24, 0xd8b24a); P.px(x + 23, y + 10, 0xffffff); P.px(x + 24, y + 11, 0xffffff);
    P.rect(x + 22, WALL_Y - 8, 8, 6, 0x6b4a33); P.hl(x + 22, WALL_Y - 8, 8, 0x8a6446); // pall
    // stång + draperi (dras åt vänster, 3/5 av bredden)
    P.rect(x + 1, y + 3, w - 2, 1, 0xc9ccd6);
    const cw = k === 0 ? 20 : 26;
    for (let yy = y + 4; yy < WALL_Y - 1; yy++) for (let xx = x + 3; xx < x + 3 + cw; xx++) {
      const f = (xx - x) % 4;
      let c = f === 0 ? curLo : f === 1 ? mix(cur, 0xffffff, 0.18) : cur;
      if (yy === WALL_Y - 2 && (xx % 3 === 0)) c = curLo;
      P.px(xx, yy, c);
    }
    for (let xx = x + 3; xx < x + 3 + cw; xx += 3) P.px(xx, y + 4, 0xe8e8ee);
    P.box(x, y, w, WALL_Y - y, mul(frame, 0.7));
  }
}

function mirror(P, x, frame) {
  const y = 20, w = 20, h = WALL_Y - 22;
  P.rect(x, y, w, h, frame); P.box(x, y, w, h, mul(frame, 0.6));
  for (let yy = y + 2; yy < y + h - 2; yy++) for (let xx = x + 2; xx < x + w - 2; xx++) {
    let c = mix(0xd4e8f0, 0x9cbccc, (yy - y) / h);
    const d = (xx - x) + (yy - y) * 0.6;
    if (d % 22 < 2 || d % 22 > 20.5) c = mix(c, 0xffffff, 0.5);
    P.px(xx, yy, c);
  }
  P.hl(x + 1, y + 1, w - 2, mix(frame, 0xffffff, 0.4));
}

// Halvbredder per rad för plaggen på klädstången (hängande, sedda framifrån)
const HANG = {
  dress: [2, 2, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 4, 4, 4],
  tee: [2, 4, 4, 3, 3, 3, 3, 3, 3, 3, 3],
  blouse: [2, 4, 4, 4, 3, 3, 3, 3, 3, 3, 3, 3, 3],
  skirt: [3, 3, 3, 3, 4, 4, 4, 4, 4, 4],
  shirt: [3, 4, 4, 4, 4, 3, 3, 3, 3, 3, 3, 3, 3],
  jacket: [3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4],
};
function rack(P, x0, dept) {
  const tj = dept === 'tjej';
  const cols = tj ? [0xf28bb3, 0x8e5bd1, 0xff7a6b, 0xf0b429, 0x2aa39a, 0xb9a3e8, 0xd9433b] : [0x3a7bd5, 0x46a35a, 0x2d3a5c, 0xe07a2e, 0xd9433b, 0x5f7f99, 0xf0b429];
  const kinds = tj ? ['dress', 'blouse', 'dress', 'skirt', 'dress', 'tee', 'dress'] : ['shirt', 'jacket', 'tee', 'shirt', 'jacket', 'tee', 'jacket'];
  const y = 24;
  P.rect(x0, y, 70, 2, 0xc9ccd6); P.hl(x0, y, 70, 0xf2f2f6); P.hl(x0, y + 2, 70, 0x6d717c);
  P.rect(x0, y - 4, 2, 6, 0x8a8e9a); P.rect(x0 + 68, y - 4, 2, 6, 0x8a8e9a);
  cols.forEach((c, i) => {
    const cx = x0 + 7 + i * 9, kind = kinds[i], rows = HANG[kind];
    const lo = mix(mul(c, 0.72), 0x2a1f3a, 0.12), hi = mix(c, 0xffffff, 0.28), dk = mix(mul(c, 0.5), 0x1a1426, 0.2);
    P.px(cx, y - 1, 0x8a8e9a); P.px(cx + 1, y - 2, 0x8a8e9a); P.px(cx, y - 2, 0x8a8e9a); // krok
    P.hl(cx - 3, y + 2, 7, 0x8a8e9a); // galge
    const top = y + 3;
    rows.forEach((hw, j) => {
      for (let k = -hw; k <= hw; k++) P.px(cx + k, top + j, k === -hw ? hi : k === hw ? lo : c);
      P.px(cx - hw - 1, top + j, dk); P.px(cx + hw + 1, top + j, dk); // kontur
    });
    P.hl(cx - rows[rows.length - 1], top + rows.length, rows[rows.length - 1] * 2 + 1, dk);
    if (kind === 'dress') { P.hl(cx - 2, top + 5, 5, lo); P.px(cx - 1, top, 0xffffff, 0.4); }
    if (kind === 'skirt') { P.hl(cx - 3, top, 7, dk); for (let j = 2; j < rows.length; j += 2) P.px(cx, top + j, lo); }
    if (kind === 'shirt') { P.px(cx - 1, top, 0xf4f1ea); P.px(cx + 1, top, 0xf4f1ea); for (let j = 2; j < rows.length; j += 2) P.px(cx, top + j, 0xf4f1ea); }
    if (kind === 'jacket') { for (let j = 1; j < rows.length; j++) P.px(cx, top + j, dk); P.px(cx - 1, top, 0xf4f1ea); P.hl(cx - 3, top + 9, 2, lo); P.hl(cx + 2, top + 9, 2, lo); }
    if (kind === 'tee' || kind === 'blouse') { P.px(cx, top, dk); P.hl(cx - 1, top + 5, 3, tj ? 0xffffff : hi, 0.5); }
  });
  // vikta högar på låg hylla
  P.rect(x0, WALL_Y - 13, 70, 2, tj ? 0xd98fb4 : 0x4f9c82);
  for (let i = 0; i < 5; i++) {
    const x = x0 + 3 + i * 14;
    for (let j = 0; j < 3; j++) {
      const c = cols[(i * 2 + j) % cols.length];
      P.rect(x, WALL_Y - 16 - j * 3, 11, 3, c); P.hl(x, WALL_Y - 16 - j * 3, 11, mix(c, 0xffffff, 0.3)); P.px(x + 10, WALL_Y - 15 - j * 3, mul(c, 0.7));
    }
  }
}

function hatShelf(P, x0, top, trim) {
  const w = 98;
  P.rect(x0, HAT_Y, w, 2, top); P.hl(x0, HAT_Y, w, mix(top, 0xffffff, 0.4));
  P.rect(x0, HAT_Y + 2, w, 2, trim); P.hl(x0, HAT_Y + 4, w, mul(trim, 0.55));
  for (const bx of [x0 + 6, x0 + w - 8]) { P.rect(bx, HAT_Y + 4, 2, 5, 0x8a8e9a); P.px(bx + 2, HAT_Y + 4, 0x8a8e9a); }
}

// ================= köpdialogen: prova på DIN figur =================

const SWATCHES = ['#f28bb3', '#ff7a6b', '#d9433b', '#e07a2e', '#f0b429', '#9fd356', '#46a35a', '#2aa39a', '#7fb8e8', '#3a7bd5', '#2d3a5c', '#8e5bd1', '#b9a3e8', '#b83d7a', '#f4f1ea', '#1d1d22'];
const DETAILS = ['#f4f1ea', '#1d1d22', '#f0b429', '#d9433b', '#f28bb3', '#3a7bd5', '#46a35a', '#8e5bd1', '#2aa39a', '#e07a2e'];
const DIRS = ['down', 'left', 'up', 'right'];
const DIR_NAMES = ['Framifrån', 'Från sidan', 'Bakifrån', 'Från sidan'];
// Överdelar där detaljfärgen (look.accent) är en del av plagget. Andra plagg rör aldrig
// spelarens egen detaljfärg (den används t.ex. till ränderna på en randig tröja).
const ACCENT_PART = { jacket: 'dragkedjan', shirt: 'kragen och knapparna', hawaii: 'mönstret', suit: 'slipsen' };

const colorField = (s) => ({ top: 'shirt', bottom: s.v === 'dress' ? 'shirt' : 'pants', hat: 'cap', bag: 'bagColor', phones: 'phoneColor' })[s.kind] || null;
function patchFor(s, color, accent) {
  switch (s.kind) {
    case 'top': return { top: s.v, shirt: color, ...(accent && ACCENT_PART[s.v] ? { accent } : {}) };
    case 'bottom': return s.v === 'dress' ? { bottom: 'dress', shirt: color } : { bottom: s.v, pants: color };
    case 'hat': return { hat: s.v, cap: color }; // den höga hattens band får spelarens egen detaljfärg
    case 'glasses': return { glasses: s.v };
    case 'bag': return { bag: s.v, bagColor: color };
    case 'phones': return { phones: true, phoneColor: color };
    default: return {};
  }
}

// ---------- färger som syns: plagget ska inte smälta ihop med håret/tröjan ----------
const rgbOf = (h) => {
  const s = String(h || '').replace('#', '');
  const n = parseInt(s.length === 3 ? s.replace(/./g, '$&$&') : s.slice(0, 6), 16) || 0;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
// "redmean"-avstånd (0 … ~765), grovt hur olika två färger ser ut
function cdist(a, b) {
  const [r1, g1, b1] = rgbOf(a), [r2, g2, b2] = rgbOf(b), rm = (r1 + r2) / 2;
  const dr = r1 - r2, dg = g1 - g2, db = b1 - b2;
  return Math.sqrt((2 + rm / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rm) / 256) * db * db);
}
// Vad plagget ligger mot på figuren: [färg, minsta avstånd]
function avoidFor(s, L) {
  const hair = L.style === 'bald' ? null : L.hair;
  switch (s.kind) {
    case 'hat': case 'phones': return [[hair, 170], [L.skin, 90]];
    case 'bag': return s.v === 'backpack' ? [[L.shirt, 170], [hair, 110]] : [[L.shirt, 150], [L.pants, 150]];
    case 'top': return [[L.shirt, 130], [L.pants, 90], [L.skin, 60]];
    case 'bottom': return s.v === 'dress' ? [[L.shirt, 130], [L.pants, 90], [L.skin, 70]] : [[L.pants, 130], [L.shirt, 90], [L.skin, 70]];
    default: return [];
  }
}
// Första kandidaten som syns tillräckligt bra, annars den som syns bäst
function pickColor(cands, avoid) {
  const list = avoid.filter(([c]) => c);
  let best = cands[0], bestScore = -Infinity;
  for (const c of cands) {
    const score = Math.min(Infinity, ...list.map(([x, m]) => cdist(c, x) - m));
    if (score >= 0) return c;
    if (score > bestScore) { bestScore = score; best = c; }
  }
  return best;
}
const AGAINST = { hat: 'ditt hår', phones: 'ditt hår', bag: 'din tröja', top: 'det du har på dig', bottom: 'det du har på dig' };

// Från vilket håll syns plagget bäst på just DIN figur? Räknar pixlarna som skiljer
// "du nu" från "med plagget" i varje riktning (framifrån vinner vid ungefär lika).
// Ex: ryggsäcken → bakifrån, men från sidan om ett långt hår täcker ryggen.
function bestDir(now, withIt) {
  const px = (look, dir) => {
    const c = document.createElement('canvas'); c.width = 28; c.height = 44;
    const x = c.getContext('2d', { willReadFrequently: true });
    drawPerson(x, 14, 41, look, dir, 0);
    return x.getImageData(0, 0, 28, 44).data;
  };
  try {
    const score = DIRS.map((dir, i) => {
      const a = px(now, dir), b = px(withIt, dir);
      let n = 0;
      for (let k = 0; k < a.length; k += 4) if (a[k] !== b[k] || a[k + 1] !== b[k + 1] || a[k + 2] !== b[k + 2] || a[k + 3] !== b[k + 3]) n++;
      return n * (i === 0 ? 1.6 : 1);
    });
    return score.indexOf(Math.max(...score));
  } catch { return 0; }
}

// Figuren i heltalsskala (hela enhetspixlar) – aldrig suddig
function figure(look, dir, S) {
  const src = document.createElement('canvas'); src.width = 28; src.height = 44;
  drawPerson(src.getContext('2d'), 14, 41, look, dir, 0);
  const dpr = globalThis.devicePixelRatio || 1;
  const D = Math.max(1, Math.round(S * dpr));
  const c = document.createElement('canvas');
  c.width = 28 * D; c.height = 44 * D;
  c.style.width = (28 * D / dpr) + 'px'; c.style.height = (44 * D / dpr) + 'px';
  const x = c.getContext('2d'); x.imageSmoothingEnabled = false;
  x.drawImage(src, 0, 0, c.width, c.height);
  return c;
}

function openBuy(A, item) {
  const g = A.game, s = item.s, key = clothesKey(s.kind, s.v);
  const me = A.avatar.look;
  const field = colorField(s);
  const th = DEPT[item.dept];
  const dollColor = field ? (item.look[field] || '#3a7bd5') : null;
  const sw = field ? [...new Set([dollColor, ...SWATCHES])] : [];
  // förvald provfärg: dockans, om den syns mot spelarens hår/kläder – annars första som gör det
  let color = field ? pickColor(sw, avoidFor(s, me)) : null;
  const part = s.kind === 'top' ? ACCENT_PART[s.v] : null;
  const dollAccent = item.look.accent || '#f4f1ea';
  const dt = part ? [...new Set([dollAccent, ...DETAILS])] : [];
  const pickAccent = () => pickColor(dt, [[color, 150]]);
  let accent = part ? pickAccent() : undefined, accentPicked = false;
  // dialogen öppnar från det håll där plagget syns bäst (ryggsäcken t.ex. bakifrån)
  let dirI = bestDir(me, { ...me, ...patchFor(s, color, accent) });
  const turned = dirI !== 0;
  const isOwned = g.wardrobe.includes(key);
  const price = g.clothesPrice(s);
  const short = price - g.money;
  const deptName = item.dept === 'tjej' ? 'Tjejavdelningen' : item.dept === 'kille' ? 'Killavdelningen' : 'Accessoarhyllan';
  const [c1, c2, c3] = th.stage;
  const note = {
    glasses: 'Bågarna har en egen färg. På hyllan finns runda, fyrkantiga och solglasögon.',
    bottom: s.v === 'dress' ? 'Klänningen får samma färg som tröjan.' : '',
  }[s.kind] || '';
  const turnNote = turned ? `🔄 ${esc(s.name)} syns bäst ${DIR_NAMES[dirI].toLowerCase()} på dig – vrid figuren så ser du den från alla håll.` : '';
  const swBtn = (c, on, attr) => `<button class="klb-sw ${on ? 'on' : ''}" ${attr}="${c}" style="--c:${c}" aria-label="Färg ${c}"></button>`;
  const body = `<style>
    .klb{display:flex;gap:14px;flex-wrap:wrap;align-items:flex-start}
    .klb-l{display:flex;flex-direction:column;gap:6px;align-items:center;flex:none}
    .klb-stage{display:flex;align-items:flex-end;gap:6px;padding:10px 12px 0;border:3px solid var(--ink);box-shadow:3px 3px 0 var(--ink);
      background:linear-gradient(${c1} 0 72%, ${c3} 72% 73%, ${c2} 73% 100%)}
    .klb-fig{display:flex;flex-direction:column;align-items:center}
    .klb-fig canvas{display:block;image-rendering:pixelated;image-rendering:crisp-edges}
    .klb-fig small{font-size:16px;line-height:1;background:var(--ink);color:#fff;padding:2px 6px 1px;margin-bottom:6px;white-space:nowrap}
    .klb-arrow{font-size:22px;padding-bottom:40px;color:var(--ink)}
    .klb-turn{display:flex;gap:6px;align-items:center}
    .klb-view{font-size:17px;min-width:92px;text-align:center}
    .klb-r{flex:1;min-width:230px;display:flex;flex-direction:column;gap:8px}
    .klb-dept{font-size:16px;color:var(--muted);margin:0}
    .klb-price{font-size:28px;margin:0;line-height:1}
    .klb-money{font-size:19px;margin:0}
    .klb-sws{display:flex;flex-wrap:wrap;gap:6px}
    .klb-sw{width:30px;height:30px;padding:0;border:3px solid var(--ink);background:var(--c);cursor:pointer;box-shadow:2px 2px 0 var(--ink)}
    .klb-sws.small .klb-sw{width:24px;height:24px}
    .klb-sw.on{outline:3px solid #ffd23f;outline-offset:1px;transform:translate(-1px,-1px)}
    .klb-hint{font-size:17px;line-height:1.1;color:var(--muted);margin:0}
    .klb-wear{font-size:19px;display:flex;gap:8px;align-items:center;cursor:pointer}
    .klb-wear input{width:20px;height:20px}
  </style>
  <div class="klb">
    <div class="klb-l">
      <div class="klb-stage">
        <div class="klb-fig" data-fig="now"><i></i><small>Du nu</small></div>
        <div class="klb-arrow">➜</div>
        <div class="klb-fig" data-fig="new"><i></i><small>Med ${esc(s.name.toLowerCase())}</small></div>
      </div>
      <div class="klb-turn">
        <button class="btn btn-small" data-turn="-1" title="Vrid" aria-label="Vrid åt vänster">⟲ Vrid</button>
        <b class="klb-view" data-view>${DIR_NAMES[dirI]}</b>
        <button class="btn btn-small" data-turn="1" title="Vrid" aria-label="Vrid åt höger">Vrid ⟳</button>
      </div>
    </div>
    <div class="klb-r">
      <p class="klb-dept">${deptName}</p>
      <p class="klb-price">${isOwned ? '<b class="ok">✓ Den här är din!</b>' : `Pris: <b>${price !== s.price ? `<s>${fmt(s.price)}</s> ` : ''}${fmt(price)}</b>${price !== s.price ? ' <b class="bad">REA</b>' : ''}`}</p>
      <p class="klb-money">💰 Du har <b>${fmt(g.money)}</b>${isOwned ? '' : short > 0 ? ` · <b class="bad">du saknar ${fmt(short)}</b>` : ` · kvar efter köpet: <b>${fmt(g.money - price)}</b>`}</p>
      ${field ? `<div><b style="font-size:19px">Prova färg:</b></div>
      <div class="klb-sws" data-sws>${sw.map((c) => swBtn(c, c === color, 'data-c')).join('')}</div>
      ${color !== dollColor ? `<p class="klb-hint">👀 Första rutan är dockans färg – vi valde en som syns mot ${AGAINST[s.kind]}.</p>` : ''}` : ''}
      ${part ? `<div><b style="font-size:19px">Detaljfärg</b> <span class="klb-hint">(${part}):</span></div>
      <div class="klb-sws small" data-dts>${dt.map((c) => swBtn(c, c === accent, 'data-a')).join('')}</div>` : ''}
      ${field ? '<p class="klb-hint">🎨 Färgerna här är bara för att prova – när plagget är ditt väljer du fritt bland alla färger i garderoben där hemma.</p>' : ''}
      ${note ? `<p class="klb-hint">${note}</p>` : ''}
      ${turnNote ? `<p class="klb-hint">${turnNote}</p>` : ''}
      ${isOwned ? '' : `<label class="klb-wear"><input type="checkbox" data-wear checked> Ta på mig den direkt</label>`}
    </div>
  </div>`;
  const wear = () => {
    A.avatar = saveAvatar({ ...A.avatar, look: { ...A.avatar.look, ...patchFor(s, color, accent) } });
  };
  const icon = iconOf(s);
  const dlg = openModal(`${icon} ${s.name}`, body, [
    { label: 'Stäng', onClick: closeModal },
    isOwned
      ? { label: '👕 Ta på mig den', cls: 'btn-go', onClick: () => { wear(); play('ok'); toast(`${icon} Snyggt! Du har ${s.name.toLowerCase()} på dig.`, 'good'); closeModal(); } }
      : { label: `🛍️ Köp (${fmt(price)})`, cls: 'btn-go', disabled: short > 0, onClick: () => {
        const wearIt = dlg.querySelector('[data-wear]')?.checked;
        const r = g.buyClothes(s.kind, s.v);
        if (!r.ok) { toast(r.msg, 'bad'); play('fel'); return; }
        play('buy');
        if (wearIt) wear();
        toast(`${icon} ${s.name} är din!${wearIt ? ' Du har den på dig.' : ' Den hänger i garderoben där hemma.'}`, 'good');
        closeModal();
      } },
  ]);
  const big = window.innerHeight >= 620 && window.innerWidth >= 560 ? 5 : 4; // heltalsskala
  const render = () => {
    const dir = DIRS[dirI];
    const now = A.avatar.look;
    dlg.querySelector('[data-fig="now"] i').replaceChildren(figure(now, dir, 2));
    dlg.querySelector('[data-fig="new"] i').replaceChildren(figure({ ...now, ...patchFor(s, color, accent) }, dir, big));
    dlg.querySelector('[data-view]').textContent = DIR_NAMES[dirI];
    dlg.querySelectorAll('[data-a]').forEach((x) => x.classList.toggle('on', x.dataset.a === accent));
  };
  dlg.querySelectorAll('[data-turn]').forEach((b) => (b.onclick = () => { dirI = (dirI + +b.dataset.turn + 4) % 4; play('click'); render(); }));
  dlg.querySelectorAll('[data-c]').forEach((b) => (b.onclick = () => {
    color = b.dataset.c;
    dlg.querySelectorAll('[data-c]').forEach((x) => x.classList.toggle('on', x === b));
    // detaljen följer med så att slipsen/knapparna inte försvinner i den nya färgen
    if (part && !accentPicked) accent = pickAccent();
    play('click');
    render();
  }));
  dlg.querySelectorAll('[data-a]').forEach((b) => (b.onclick = () => {
    accent = b.dataset.a; accentPicked = true;
    play('click');
    render();
  }));
  render();
}
