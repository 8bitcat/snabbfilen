// Pixelstaden – gåbar precis som hemma: fasadrad med dörrar upptill, torg och
// gata att promenera på, folk som strosar. Två stadsdelar: CENTRUM (hem,
// bostadsbyrå, mat, kläder, möbler) och ARBETSOMRÅDET (flygplatsen, frukt-
// fabriken, burgarbaren) – gå ut i kanten för att byta del. Man ser andra
// spelare som är i samma stadsdel.
import { drawPerson, makeLook } from '../core/people.js';
import { Pix, SMALL, BIG, ctxText, textW, text, mix, mul, css, hash, bayer } from '../core/floor-pix.js';
import { toast } from '../core/ui.js';
import { play } from '../core/sound.js';
import { createWalker, selfDrawable, folkDrawables, WALK_SEQ } from './walkable.js';
import { worldFolksHere } from '../net/world.js';

const FW = 384, FH = 216;
const WALL_Y = 96; // fasadernas fot / trottoarkanten

// Stadsdelarnas byggnader: dörr [x0,x1] + tema. act körs efter promenad+dörrtid.
const DISTRICTS = [
  {
    name: 'CENTRUM',
    buildings: [
      { id: 'hem', sign: 'HEM', x0: 16, x1: 72, c: 0x8a6a4a, door: [34, 56] },
      { id: 'bostad', sign: 'BOSTAD', x0: 78, x1: 134, c: 0x5a6e8c, door: [96, 118], open: [8, 18] },
      { id: 'mat', sign: 'MAT', x0: 140, x1: 200, c: 0x2f8f46, door: [158, 182], open: [8, 21], awning: true },
      { id: 'klader', sign: 'KLÄDER', x0: 206, x1: 266, c: 0xb83d7a, door: [224, 248], open: [8, 20], display: 'shirt' },
      { id: 'mobler', sign: 'MÖBLER', x0: 272, x1: 344, c: 0x2c6fb7, door: [294, 322], open: [8, 20], display: 'sofa' },
    ],
    exit: { side: 'right', label: 'ARBETSOMRÅDET' },
  },
  {
    name: 'ARBETSOMRÅDET',
    buildings: [
      { id: 'flyg', sign: 'FLYGPLATSEN', x0: 14, x1: 118, c: 0x6d7480, door: [50, 82], open: [8, 20], hangar: true },
      { id: 'frukt', sign: 'FRUKTFABRIKEN', x0: 130, x1: 234, c: 0xc06a2a, door: [166, 198], open: [8, 20], chimney: true },
      { id: 'burgare', sign: 'BURGARBAREN', x0: 246, x1: 340, c: 0xc9323a, door: [278, 308], open: [8, 22], awning: true, burger: true },
    ],
    exit: { side: 'left', label: 'CENTRUM' },
  },
];

export function makeCity(A) {
  const g = A.game;
  const sub = Math.max(0, Math.min(1, A.citySub | 0));
  A.citySub = sub;
  const D = DISTRICTS[sub];
  const walker = createWalker({ top: WALL_Y + 4, bottom: FH - 6, left: 4, right: FW - 4, spawn: A.cityPos?.[sub] || [sub ? FW - 40 : 100, 140] });
  walker.speed = 95;
  let t = 0;

  // strosande stadsbor (bara kosmetik)
  const folk = Array.from({ length: 3 }, (_, i) => ({
    look: makeLook(), x: 60 + i * 110 + hash(i, 7) * 40, y: 130 + i * 25,
    tx: 0, ty: 0, wait: hash(i, 9) * 3,
  }));
  const bgCache = {};
  const bg = (night) => {
    const key = night ? 'n' : 'd';
    if (!bgCache[key]) bgCache[key] = paintCity(D, night, sub);
    return bgCache[key];
  };

  const hotRects = D.buildings.map((b) => ({
    id: b.id, b,
    r: [b.door[0], 46, b.door[1], WALL_Y + 8],
    go: [(b.door[0] + b.door[1]) / 2, WALL_Y + 12],
  }));
  const exitRect = D.exit.side === 'right'
    ? { r: [FW - 14, WALL_Y, FW, FH], go: [FW - 18, 150] }
    : { r: [0, WALL_Y, 14, FH], go: [18, 150] };

  function enter(b) {
    const hour = g.min / 60;
    if (b.open && (hour < b.open[0] || hour >= b.open[1])) {
      toast(`🔒 ${b.sign} har stängt (öppet ${b.open[0]}–${b.open[1]}).`, 'bad');
      return;
    }
    g.passTime(g.eventIs('regn') ? 40 : 20);
    g.save();
    if (g.collapsed) return;
    play('door');
    if (b.id === 'hem') { A.roomSub = 0; A.go('room'); }
    else if (b.id === 'bostad') A.openHousing();
    else if (b.id === 'mat') A.openFoodShop();
    else if (b.id === 'klader') A.go('klader');
    else if (b.id === 'mobler') A.go('mobler');
    else A.startJob(b.id === 'flyg' ? 'flygplats' : b.id);
  }

  return {
    get worldX() { return walker.px; },
    get worldY() { return walker.py; },
    _debug: {
      spot: (id) => { const h = hotRects.find((h) => h.id === id); return h ? { x: (h.r[0] + h.r[2]) / 2, y: (h.r[1] + h.r[3]) / 2 } : null; },
      tile: (a, b) => ({ x: 30 + a * 40, y: Math.min(FH - 10, WALL_Y + 15 + b * 14) }),
    },

    update(dt) {
      t += dt;
      walker.update(dt);
      A.cityPos = A.cityPos || {};
      A.cityPos[sub] = [walker.px, walker.py];
      for (const f of folk) { // strosarna väljer nya mål då och då
        if (f.wait > 0) { f.wait -= dt; continue; }
        if (!f.tx) { f.tx = 30 + hash(f.x | 0, t | 0) * (FW - 60); f.ty = WALL_Y + 12 + hash(f.y | 0, t | 0) * 90; }
        const dx = f.tx - f.x, dy = f.ty - f.y, d = Math.hypot(dx, dy);
        if (d < 2) { f.tx = 0; f.wait = 1.5 + hash(f.x | 0, 3) * 4; continue; }
        f.x += dx / d * 26 * dt; f.y += dy / d * 26 * dt;
      }
    },

    down(x, y) {
      for (const h of hotRects) {
        if (x >= h.r[0] && x <= h.r[2] && y >= h.r[1] && y <= h.r[3]) {
          walker.walkTo(h.go[0], h.go[1], () => enter(h.b));
          return;
        }
      }
      if (x >= exitRect.r[0] && x <= exitRect.r[2] && y >= exitRect.r[1]) {
        walker.walkTo(exitRect.go[0], exitRect.go[1], () => {
          A.citySub = sub ? 0 : 1;
          A.cityPos[A.citySub] = [A.citySub ? 24 : FW - 24, walker.py];
          A.go('city');
        });
        return;
      }
      if (y > WALL_Y) walker.walkTo(x, y);
    },

    draw(ctx) {
      ctx.setTransform(A.pxs, 0, 0, A.pxs, 0, 0);
      const hour = g.min / 60, night = hour >= 19.5 || hour < 6.5;
      ctx.drawImage(bg(night), 0, 0);

      const drawables = [];
      if (!night) for (const f of folk) drawables.push({
        fy: f.y,
        draw: () => drawPerson(ctx, f.x, f.y, f.look, f.tx && Math.abs(f.tx - f.x) > Math.abs(f.ty - f.y) ? (f.tx < f.x ? 'left' : 'right') : 'down', f.tx ? WALK_SEQ[Math.floor(t * 7 + f.x) % 4] : 0),
      });
      drawables.push(...folkDrawables(A, t));
      drawables.push(selfDrawable(A, walker, t, { folksHere: worldFolksHere(A).length }));
      drawables.sort((a, b) => a.fy - b.fy).forEach((d) => d.draw(ctx));

      // regnet
      if (g.eventIs('regn') && !night) {
        ctx.fillStyle = 'rgba(160,190,230,0.5)';
        for (let i = 0; i < 60; i++) {
          const rx = (hash(i, 51) * FW + t * 30) % FW;
          const ry = (hash(i, 53) * FH + t * (110 + hash(i, 54) * 60)) % FH;
          ctx.fillRect(rx | 0, ry | 0, 1, 4);
        }
      }
      if (night) { ctx.fillStyle = 'rgba(10,12,40,0.30)'; ctx.fillRect(0, 0, FW, FH); }
    },
  };
}

// ---------- stadsbilden (Pix, per stadsdel + dag/natt) ----------
function paintCity(D, night, sub) {
  const P = new Pix(FW, FH);
  const skyTop = night ? 0x0b1026 : 0x7ec8e8, skyBot = night ? 0x1c2140 : 0xbfe6f2;
  // himmel + bakre siluett
  for (let y = 0; y < 46; y++) for (let x = 0; x < FW; x++) P.px(x, y, mix(skyTop, skyBot, y / 46 + (bayer(x, y) - 0.5) * 0.06));
  if (night) for (let i = 0; i < 40; i++) P.px((hash(i, 1) * FW) | 0, (hash(i, 2) * 40) | 0, 0xe8ecff, hash(i, 3) > 0.4 ? 1 : 0.5);
  else { P.ell(320, 14, 8, 8, 0xfff3b8, 1, 4); P.ell(320, 14, 5, 5, 0xfff9dc, 1, 3); }
  for (let i = 0; i < 12; i++) {
    const bw = 20 + hash(i, 11) * 26, bx = i * 34 - 6, bh = 14 + hash(i, 12) * 22;
    for (let y = 46 - bh; y < 46; y++) for (let x = bx; x < bx + bw; x++) P.px(x, y, night ? 0x141828 : 0x9ab0be);
  }

  // gränderna mellan husen
  for (let y = 46; y < WALL_Y; y++) for (let x = 0; x < FW; x++) {
    let c = mix(night ? 0x10121c : 0x3a3f4a, night ? 0x181a26 : 0x2c3038, (y - 46) / 50 + (bayer(x, y) - 0.5) * 0.15);
    if ((y - 46) % 9 === 0) c = mul(c, 0.85);
    P.px(x, y, c);
  }
  // fasaderna
  for (const b of D.buildings) {
    const c = b.c;
    for (let y = 8, y1 = WALL_Y; y < y1; y++) for (let x = b.x0; x < b.x1; x++) {
      let k = mix(c, mul(c, 0.8), (bayer(x, y) - 0.5) * 0.3 + 0.5 + (y - 8) / 240);
      if (x === b.x0) k = mix(c, 0xffffff, 0.18);
      if (x === b.x1 - 1) k = mul(c, 0.55);
      if (b.hangar && (x + y) % 14 === 0) k = mul(k, 0.85); // plåtväggens skarvar
      P.px(x, y, k);
    }
    P.hl(b.x0 - 1, 6, b.x1 - b.x0 + 2, mul(c, 0.5)); P.hl(b.x0 - 1, 7, b.x1 - b.x0 + 2, mix(c, 0xffffff, 0.2));
    // fönsterrad
    if (!b.hangar) for (let wx = b.x0 + 6; wx + 12 < b.x1 - 4; wx += 18) {
      const lit = night && hash(wx, 5) > 0.4;
      P.rect(wx, 18, 12, 14, lit ? 0xffd97a : night ? 0x18202e : 0x35405c);
      P.box(wx, 18, 12, 14, mul(c, 0.5));
      P.vl(wx + 6, 19, 12, mul(c, 0.5)); P.hl(wx + 1, 24, 10, mul(c, 0.5));
    } else { // hangarens stora port + rand
      P.rect(b.x0 + 8, 30, b.x1 - b.x0 - 16, 8, 0xd8b24a); for (let x = b.x0 + 8; x < b.x1 - 8; x += 6) P.rect(x, 30, 3, 8, 0x2a2d33);
    }
    if (b.chimney) { P.rect(b.x1 - 22, 0, 10, 10, 0x5a4632); P.rect(b.x1 - 21, 0, 3, 10, 0x7a5c42); }
    // skylt
    const F = textW(BIG, b.sign) + 10 < b.x1 - b.x0 ? BIG : SMALL;
    const tw = textW(F, b.sign), sx = Math.round((b.x0 + b.x1) / 2 - tw / 2);
    P.rect(sx - 4, 38, tw + 8, F.h + 4, 0x17151a); P.box(sx - 4, 38, tw + 8, F.h + 4, night ? 0x7ee8fa : 0x000000);
    text(P, F, b.sign, sx, 40, night ? 0x7ee8fa : 0xf4f1ea);
    if (b.burger) { P.ell((b.x0 + b.x1) / 2, 34, 5, 3, 0xe8b230, 1, 3); P.hl((b.x0 + b.x1) / 2 - 4, 34, 8, 0xc9323a); }
    // markis
    if (b.awning) for (let i = 0; i < b.x1 - b.x0 - 12; i++) {
      P.px(b.x0 + 6 + i, 52 + (i % 3 === 2 ? 1 : 0), (i >> 2) % 2 ? 0xe8e3d6 : (b.burger ? 0xc9323a : 0x2f8f46));
      P.px(b.x0 + 6 + i, 53, mul((i >> 2) % 2 ? 0xe8e3d6 : 0xc9323a, 0.7));
    }
    // skyltfönster
    if (b.display) {
      const dx0 = b.x0 + 8, dx1 = b.door[0] - 4;
      if (dx1 - dx0 > 16) {
        P.rect(dx0, 56, dx1 - dx0, 30, night ? 0x223048 : 0xd8ecf4); P.box(dx0, 56, dx1 - dx0, 30, mul(b.c, 0.5));
        const mx = (dx0 + dx1) >> 1;
        if (b.display === 'shirt') { P.rect(mx - 5, 64, 10, 9, 0x3fc4ff); P.rect(mx - 8, 64, 3, 4, 0x3fc4ff); P.rect(mx + 5, 64, 3, 4, 0x3fc4ff); }
        else { P.rect(mx - 8, 68, 16, 6, 0xc9323a); P.rect(mx - 8, 64, 3, 6, 0xc9323a); P.rect(mx + 5, 64, 3, 6, 0xc9323a); }
      }
    }
    // dörren
    P.rect(b.door[0], 58, b.door[1] - b.door[0], WALL_Y - 58, 0x2e2418);
    P.rect(b.door[0] + 1, 59, b.door[1] - b.door[0] - 2, WALL_Y - 59, 0x5a4632);
    P.px(b.door[1] - 4, 76, 0xd8b24a);
    if (night) P.dith(b.door[0], WALL_Y, b.door[1] - b.door[0], 6, 0xffd97a, 0.5, 0.25);
  }

  // trottoar + gata/torg
  for (let y = WALL_Y; y < FH; y++) for (let x = 0; x < FW; x++) {
    let c;
    if (y < WALL_Y + 26) { // trottoarplattor
      c = mix(0x9a9284, 0xb5ac9c, hash((x / 24) | 0, (y / 13) | 0, 6) * 0.5);
      if (x % 24 === 0 || (y - WALL_Y) % 13 === 0) c = mul(c, 0.8);
    } else { // gatan/torget
      c = mix(0x4c4e56, 0x3a3c44, (bayer(x, y) - 0.5) * 0.4 + 0.5 + hash(x, y, 8) * 0.1);
      if (sub === 0 && ((x + ((y / 6) | 0) * 3) % 48 < 20) && y > WALL_Y + 40 && y < WALL_Y + 70) c = mix(c, 0xd8d2c0, 0.5); // övergångsställe
    }
    P.px(x, y, c);
  }
  P.hl(0, WALL_Y + 26, FW, 0x2a2c32);
  // lyktstolpar + träd (bara dekor – ritas i bg, blockerar inte)
  for (const lx of sub === 0 ? [110, 250] : [130, 230]) {
    P.rect(lx, WALL_Y + 30, 2, 26, 0x2a2d33);
    P.rect(lx - 2, WALL_Y + 28, 6, 4, night ? 0xffd97a : 0x8a8f9a);
    if (night) P.ell(lx + 1, WALL_Y + 44, 16, 9, 0xffd97a, 0.12, 3);
  }
  // riktningsskylt mot andra stadsdelen
  const ex = D.exit.side === 'right' ? FW - 12 : 2;
  P.rect(ex, WALL_Y + 6, 10, 40, 0x2a2d33);
  const label = D.exit.label;
  for (let i = 0; i < label.length && i < 13; i++) text(P, SMALL, label[i], ex + 2, WALL_Y + 8 + i * 6, 0xffd23f);

  P.box(0, 0, FW, FH, 0x0e0d12);
  return P.flush();
}
