// KLÄDER – butiken man går runt i: varje köpbart plagg visas på en mannekäng
// på podium (riktiga figurmotorn i grått med plagget på!), accessoarerna
// ligger på hyllan. Gå fram till en mannekäng för att köpa plagget – ägda
// plagg får en grön bock på podiet.
import { drawPerson } from '../core/people.js';
import { Pix, SMALL, BIG, ctxText, textW, text, mix, mul, hash, bayer } from '../core/floor-pix.js';
import { openModal, closeModal, toast } from '../core/ui.js';
import { SORTIMENT, clothesKey, fmt } from '../game.js';
import { play } from '../core/sound.js';
import { createWalker, selfDrawable, folkDrawables } from './walkable.js';

const FW = 384, FH = 216;
const WALL_Y = 60;
const DOOR = { x0: 20, x1: 52 };

// mannekänger för bärbara plagg, hyllan för resten
const WEARABLE = SORTIMENT.filter((s) => ['top', 'bottom', 'hat'].includes(s.kind));
const SHELFED = SORTIMENT.filter((s) => !['top', 'bottom', 'hat'].includes(s.kind));
const DUMMIES = WEARABLE.map((s, i) => ({
  s,
  x: 34 + (i % 9) * 40,
  y: i < 9 ? 104 : 154,
  look: {
    skin: '#cfcfd4', hair: '#8a8a92', style: 'bald', beard: false, glasses: false, phones: false, bag: null, blush: false, build: 5,
    top: s.kind === 'top' ? s.v : 'tee', shirt: s.kind === 'top' ? '#3a7bd5' : '#b8b8c0',
    bottom: s.kind === 'bottom' ? s.v : 'pants', pants: '#4a4a55', accent: '#f4f1ea',
    hat: s.kind === 'hat' ? s.v : null, cap: '#c9323a', shoes: '#2a2a30',
  },
}));
const SHELF = { x: 150, y: 214, w: 84 };

export function makeShopKlader(A) {
  const g = A.game;
  const walker = createWalker({ top: WALL_Y + 4, bottom: FH - 6, spawn: [36, 100] });
  walker.setObstacles([
    ...DUMMIES.map((d) => [d.x - 8, d.y - 8, d.x + 8, d.y + 4]),
    [SHELF.x - 2, SHELF.y - 12, SHELF.x + SHELF.w + 2, SHELF.y + 2],
  ]);
  let t = 0;
  const bgCache = {};
  const bg = () => (bgCache.x ||= paintBoutique());
  const shelfImg = paintShelf();

  const hotRects = [
    { id: 'dorr', r: [DOOR.x0, 26, DOOR.x1, WALL_Y + 8], go: [(DOOR.x0 + DOOR.x1) / 2, WALL_Y + 12], act: () => { play('door'); A.go('city'); } },
    ...DUMMIES.map((d, i) => ({ id: 'dummy' + i, r: [d.x - 11, d.y - 46, d.x + 11, d.y + 8], go: [d.x, d.y + 14], act: () => openBuyClothes(A, d.s) })),
    { id: 'hylla', r: [SHELF.x - 4, SHELF.y - 44, SHELF.x + SHELF.w + 4, SHELF.y + 4], go: [SHELF.x - 8, SHELF.y - 4], act: () => openShelf(A) },
  ];

  return {
    get worldX() { return walker.px; },
    get worldY() { return walker.py; },
    _debug: { spot: (id) => { const h = hotRects.find((h) => h.id === id); return h ? { x: (h.r[0] + h.r[2]) / 2, y: (h.r[1] + h.r[3]) / 2 } : null; }, dummies: DUMMIES.map((d) => clothesKey(d.s.kind, d.s.v)) },
    update(dt) { t += dt; walker.update(dt); },
    down(x, y) {
      for (const h of hotRects) if (x >= h.r[0] && x <= h.r[2] && y >= h.r[1] && y <= h.r[3]) { walker.walkTo(h.go[0], h.go[1], h.act); return; }
      if (y > WALL_Y) walker.walkTo(x, y);
    },
    draw(ctx) {
      ctx.setTransform(A.pxs, 0, 0, A.pxs, 0, 0);
      ctx.drawImage(bg(), 0, 0);
      const drawables = [...folkDrawables(A, t), selfDrawable(A, walker, t, {})];
      for (const d of DUMMIES) drawables.push({
        fy: d.y,
        draw: () => {
          // podium
          ctx.fillStyle = '#b8b2a4'; ctx.fillRect(d.x - 10, d.y - 2, 20, 5);
          ctx.fillStyle = '#8a8478'; ctx.fillRect(d.x - 10, d.y + 3, 20, 2);
          drawPerson(ctx, d.x, d.y, d.look, 'down', 0);
          const owned = g.wardrobe.includes(clothesKey(d.s.kind, d.s.v));
          const lbl = owned ? 'DIN' : String(d.s.price);
          const w = textW(SMALL, lbl) + 4;
          ctx.fillStyle = owned ? '#45b964' : '#f0d048';
          ctx.fillRect(d.x - w / 2 | 0, d.y + 6, w, 8);
          ctxText(ctx, SMALL, lbl, (d.x - w / 2 | 0) + 2, d.y + 7, owned ? '#fff' : '#3a2a10');
        },
      });
      drawables.push({ fy: SHELF.y, draw: () => ctx.drawImage(shelfImg, SHELF.x, SHELF.y - 42) });
      drawables.sort((a, b) => a.fy - b.fy).forEach((d) => d.draw(ctx));
    },
  };
}

// hyllan med accessoarer (fristående ställ, y-sorteras som en möbel)
function paintShelf() {
  const P = new Pix(SHELF.w, 44);
  P.rect(0, 0, SHELF.w, 42, 0x5a4632);
  P.box(0, 0, SHELF.w, 42, 0x3a2c1e);
  for (let i = 0; i < 3; i++) {
    P.rect(3, 12 + i * 12, SHELF.w - 6, 2, 0xc9a36b);
    for (let k = 0; k < 5; k++) {
      const c = [0x3fc4ff, 0xe8b230, 0x8e5bd1, 0x45b964, 0xd9433b][(i * 5 + k) % 5];
      P.rect(6 + k * 15, 5 + i * 12, 10, 6, c); P.hl(6 + k * 15, 5 + i * 12, 10, mix(c, 0xffffff, 0.4));
    }
  }
  const hw = textW(SMALL, 'HYLLAN') + 6;
  P.rect(SHELF.w / 2 - hw / 2, 36, hw, 8, 0xf0d048);
  text(P, SMALL, 'HYLLAN', SHELF.w / 2 - hw / 2 + 3, 37, 0x3a2a10);
  return P.flush();
}

function openBuyClothes(A, s) {
  const g = A.game;
  const owned = g.wardrobe.includes(clothesKey(s.kind, s.v));
  const price = g.clothesPrice(s);
  openModal(`${s.icon} ${s.name}`, `
    <p style="font-size:19px;margin-top:0">💰 <b>${fmt(g.money)}</b>${g.eventIs('rea') ? ' · 🏷️ <b class="ok">REA −25 %!</b>' : ''}</p>
    <p style="font-size:20px">${owned ? 'Den här har du redan – snyggt val! ✓' : `Pris: <b>${price !== s.price ? `<s>${fmt(s.price)}</s> ` : ''}${fmt(price)}</b>`}</p>
    <p style="font-size:17px" class="sp">Köpta plagg finns i garderoben där hemma.</p>`, [
    { label: 'Stäng', onClick: closeModal },
    ...(owned ? [] : [{ label: `🛍️ Köp (${fmt(price)})`, cls: 'btn-go', onClick: () => {
      const r = g.buyClothes(s.kind, s.v);
      if (!r.ok) { toast(r.msg, 'bad'); play('fel'); return; }
      play('buy');
      toast(`${s.icon} ${s.name} är din!`, 'good');
      closeModal();
    } }]),
  ]);
}

function openShelf(A) {
  const g = A.game;
  const body = `<p style="font-size:19px;margin-top:0">💰 <b>${fmt(g.money)}</b> · Accessoarer på hyllan:</p>
    <div class="plist">${SHELFED.map((s, i) => {
      const owned = g.wardrobe.includes(clothesKey(s.kind, s.v));
      const price = g.clothesPrice(s);
      return `<div class="prow ${owned ? 'here' : ''}">
        <span style="font-size:24px;text-align:center">${s.icon}</span>
        <span class="nm">${s.name}${owned ? ' <small class="ok">✓ din</small>' : ''}<br><small class="sp">${fmt(price)}</small></span>
        <button class="btn btn-small ${!owned && g.money >= price ? 'btn-go' : ''}" data-shelf="${i}" ${owned || g.money < price ? 'disabled' : ''}>${owned ? 'Har' : 'Köp'}</button>
      </div>`;
    }).join('')}</div>`;
  const dlg = openModal('🧢 Hyllan', body, [{ label: 'Klar', cls: 'btn-go', onClick: closeModal }]);
  dlg.querySelectorAll('[data-shelf]').forEach((b) => (b.onclick = () => {
    const s = SHELFED[+b.dataset.shelf];
    const r = A.game.buyClothes(s.kind, s.v);
    if (!r.ok) { toast(r.msg, 'bad'); play('fel'); return; }
    play('buy');
    toast(`${s.icon} ${s.name} är din!`, 'good');
    openShelf(A);
  }));
}

function paintBoutique() {
  const P = new Pix(FW, FH);
  for (let y = 5; y < WALL_Y; y++) for (let x = 4; x < FW - 4; x++) {
    let c = mix(0xa8586e, 0x94485e, (bayer(x, y) - 0.5) * 0.25 + 0.5);
    if (x % 22 === 0) c = mul(c, 0.9);
    P.px(x, y, c);
  }
  const title = 'KLÄDER';
  const tw = textW(BIG, title, 2);
  P.rect(FW / 2 - tw / 2 - 10, 12, tw + 20, 22, 0x17151a);
  P.box(FW / 2 - tw / 2 - 10, 12, tw + 20, 22, 0xf28bb3);
  text(P, BIG, title, FW / 2 - tw / 2, 16, 0xf28bb3, 1, 2);
  P.rect(DOOR.x0, 26, DOOR.x1 - DOOR.x0, WALL_Y - 26, 0x2e2418);
  P.rect(DOOR.x0 + 1, 27, DOOR.x1 - DOOR.x0 - 2, WALL_Y - 27, 0x5a4632);
  const uw = textW(SMALL, 'UT') + 8;
  P.rect(DOOR.x0 + 6, 18, uw, 9, 0x1d2b1f); text(P, SMALL, 'UT', DOOR.x0 + 10, 20, 0x6fe08a);
  // rosa boutiquegolv
  for (let y = WALL_Y; y < FH; y++) for (let x = 0; x < FW; x++) {
    let c = mix(0xe6d4d8, 0xd6c0c6, hash((x / 24) | 0, (y / 16) | 0, 5) * 0.5 + (bayer(x, y) - 0.5) * 0.08);
    if (x % 24 === 0 || (y - WALL_Y) % 16 === 0) c = mul(c, 0.9);
    P.px(x, y, c);
  }
  // röd matta i mitten
  for (let y = 118; y < 132; y++) for (let x = 14; x < FW - 14; x++) {
    let c = mix(0x9e2a3a, 0x8a2432, (bayer(x, y) - 0.5) * 0.3 + 0.5);
    if (y === 118 || y === 131) c = 0xd8b24a;
    P.px(x, y, c);
  }
  P.box(0, 0, FW, FH, 0x0e0d12);
  return P.flush();
}
