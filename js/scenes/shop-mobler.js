// MÖBLER – varuhuset man går runt i som ett IKEA: alla möbler står utställda
// på golvet med prislappar. Gå fram till en möbel så öppnas köpdialogen där
// man väljer färg och köper (hamnar i förrådet, placeras hemma med Möblera).
import { Pix, SMALL, BIG, ctxText, textW, text, mix, mul, css, hash, bayer } from '../core/floor-pix.js';
import { openModal, closeModal, toast } from '../core/ui.js';
import { KATALOG, katalogOf, fmt } from '../game.js';
import { play } from '../core/sound.js';
import { createWalker, selfDrawable, folkDrawables } from './walkable.js';
import { FRAMES } from '../data/frames.js';
import { ATLAS } from './room.js';

const FW = 384, FH = 216;
const WALL_Y = 60;
const DOOR = { x0: 20, x1: 52 };

// utställningen: två rader med jämna mellanrum (mattan visas som liten ruta)
const SPOTS = [];
{
  // tre rader, jämnt fördelade – rad 1 börjar efter dörren
  const ROWS_Y = [106, 158, 206];
  const items = KATALOG.map((k) => ({ kind: k.kind, w: (k.kind === 'matta' ? [0, 0, 30, 16] : FRAMES[k.kind + '0'])[2] }));
  const per = Math.ceil(items.length / ROWS_Y.length);
  ROWS_Y.forEach((y, row) => {
    const rowItems = items.slice(row * per, row * per + per);
    const x0 = row === 0 ? 76 : 20, span = FW - 16 - x0;
    const total = rowItems.reduce((a, it) => a + it.w, 0);
    const gap = (span - total) / (rowItems.length + 1);
    let x = x0 + gap;
    for (const it of rowItems) { SPOTS.push({ kind: it.kind, x: Math.round(x), y, w: it.w }); x += it.w + gap; }
  });
}

export function makeShopMobler(A) {
  const g = A.game;
  const walker = createWalker({ top: WALL_Y + 4, bottom: FH - 6, spawn: [36, 100] });
  walker.setObstacles(SPOTS.map((s) => [s.x - 2, s.y - 12, s.x + s.w + 2, s.y + 2]));
  let t = 0;
  const bgCache = {};
  const bg = () => (bgCache.x ||= paintStore());

  const hotRects = [
    { id: 'dorr', r: [DOOR.x0, 26, DOOR.x1, WALL_Y + 8], go: [(DOOR.x0 + DOOR.x1) / 2, WALL_Y + 12], act: () => { play('door'); A.go('city'); } },
    ...SPOTS.map((s) => ({ id: s.kind, r: [s.x - 6, s.y - 40, s.x + s.w + 6, s.y + 6], go: [s.x + s.w / 2, s.y + 10], act: () => openBuy(A, s.kind) })),
  ];

  return {
    get worldX() { return walker.px; },
    get worldY() { return walker.py; },
    _debug: { spot: (id) => { const h = hotRects.find((h) => h.id === id); return h ? { x: (h.r[0] + h.r[2]) / 2, y: (h.r[1] + h.r[3]) / 2 } : null; } },
    update(dt) { t += dt; walker.update(dt); },
    down(x, y) {
      for (const h of hotRects) if (x >= h.r[0] && x <= h.r[2] && y >= h.r[1] && y <= h.r[3]) { walker.walkTo(h.go[0], h.go[1], h.act); return; }
      if (y > WALL_Y) walker.walkTo(x, y);
    },
    draw(ctx) {
      ctx.setTransform(A.pxs, 0, 0, A.pxs, 0, 0);
      ctx.drawImage(bg(), 0, 0);
      const drawables = [...folkDrawables(A, t), selfDrawable(A, walker, t, {})];
      for (const s of SPOTS) drawables.push({
        fy: s.y,
        draw: () => {
          ctx.fillStyle = 'rgba(20,12,28,0.2)'; ctx.fillRect(s.x, s.y - 1, s.w, 2);
          if (s.kind === 'matta') { ctx.fillStyle = '#8a2a32'; ctx.fillRect(s.x, s.y - 14, 30, 14); ctx.fillStyle = '#d8b24a'; ctx.fillRect(s.x + 2, s.y - 12, 26, 1); ctx.fillRect(s.x + 2, s.y - 4, 26, 1); }
          else if (ATLAS && ATLAS.complete) { const f = FRAMES[s.kind + '0']; ctx.drawImage(ATLAS, f[0], f[1], f[2], f[3], s.x, s.y - f[3], f[2], f[3]); }
          // prislapp
          const kat = katalogOf(s.kind);
          const lbl = String(kat.price);
          const w = textW(SMALL, lbl) + 4;
          ctx.fillStyle = '#f0d048'; ctx.fillRect(s.x + s.w / 2 - w / 2 | 0, s.y + 3, w, 8);
          ctx.fillStyle = '#8a6a2a'; ctx.fillRect(s.x + s.w / 2 - w / 2 | 0, s.y + 3, w, 1);
          ctxText(ctx, SMALL, lbl, (s.x + s.w / 2 - w / 2 | 0) + 2, s.y + 4, '#3a2a10');
        },
      });
      drawables.sort((a, b) => a.fy - b.fy).forEach((d) => d.draw(ctx));
    },
  };
}

// köpdialogen med färgval (rutor ritade ur atlasen)
export function openBuy(A, kind) {
  const g = A.game;
  const kat = katalogOf(kind);
  if (!kat) return;
  let sel = 0;
  const dlg = openModal(`${kat.icon} ${kat.name}`, `
    <p style="font-size:19px;margin-top:0">💰 <b>${fmt(g.money)}</b> · Pris: <b>${fmt(kat.price)}</b> · 📦 I förrådet: ${g.storage.filter((s) => s.k === kind).length}</p>
    ${kat.vars > 1 ? `<p style="font-size:18px;margin:4px 0">Välj färg:</p><div class="av-sws">${Array.from({ length: kat.vars }, (_, i) => `<button class="av-sw fvar ${i === 0 ? 'on' : ''}" data-fvar="${i}" style="--c:#2a2430"><span data-thumb="${i}"></span></button>`).join('')}</div>` : ''}
    <p style="font-size:17px" class="sp">Möbeln hamnar i förrådet – möblera hemma med 🛋️-knappen.</p>`, [
    { label: 'Stäng', onClick: closeModal },
    { label: `🛒 Köp (${fmt(kat.price)})`, cls: 'btn-go', onClick: () => {
      const r = g.buyFurniture(kind, sel);
      if (!r.ok) { toast(r.msg, 'bad'); play('fel'); return; }
      play('buy');
      toast(`${kat.icon} ${kat.name} ligger i förrådet!`, 'good');
      closeModal();
    } },
  ]);
  dlg.querySelectorAll('[data-thumb]').forEach((el) => {
    const i = +el.dataset.thumb;
    const c = document.createElement('canvas');
    c.width = 26; c.height = 26;
    const x = c.getContext('2d');
    x.imageSmoothingEnabled = false;
    const draw = () => {
      if (kind === 'matta') { x.fillStyle = i ? '#3f5667' : '#8a2a32'; x.fillRect(2, 6, 22, 14); x.fillStyle = '#d8b24a'; x.fillRect(4, 8, 18, 1); return; }
      const f = FRAMES[kind + i] || FRAMES[kind + '0'];
      const s = Math.min(26 / f[2], 26 / f[3]);
      x.drawImage(ATLAS, f[0], f[1], f[2], f[3], (26 - f[2] * s) / 2, (26 - f[3] * s) / 2, f[2] * s, f[3] * s);
    };
    if (ATLAS.complete) draw(); else ATLAS.addEventListener('load', draw, { once: true });
    el.replaceWith(c);
    c.parentElement?.setAttribute('data-i', i);
  });
  dlg.querySelectorAll('.fvar').forEach((b) => (b.onclick = () => {
    sel = +b.dataset.i || +b.getAttribute('data-fvar') || [...dlg.querySelectorAll('.fvar')].indexOf(b);
    dlg.querySelectorAll('.fvar').forEach((o) => o.classList.toggle('on', o === b));
  }));
}

function paintStore() {
  const P = new Pix(FW, FH);
  // vägg: blågul varuhusstil
  for (let y = 5; y < WALL_Y; y++) for (let x = 4; x < FW - 4; x++) {
    let c = mix(0x2c5f9e, 0x24507f, (bayer(x, y) - 0.5) * 0.25 + 0.5);
    if (y > WALL_Y - 8) c = 0x17427a;
    P.px(x, y, c);
  }
  const title = 'MÖBLER';
  const tw = textW(BIG, title, 2);
  P.rect(FW / 2 - tw / 2 - 10, 12, tw + 20, 22, 0xf0d048);
  P.box(FW / 2 - tw / 2 - 10, 12, tw + 20, 22, 0x8a6a2a);
  text(P, BIG, title, FW / 2 - tw / 2, 16, 0x17427a, 1, 2);
  // dörren
  P.rect(DOOR.x0, 26, DOOR.x1 - DOOR.x0, WALL_Y - 26, 0x2e2418);
  P.rect(DOOR.x0 + 1, 27, DOOR.x1 - DOOR.x0 - 2, WALL_Y - 27, 0x5a4632);
  const uw = textW(SMALL, 'UT') + 8;
  P.rect(DOOR.x0 + 6, 18, uw, 9, 0x1d2b1f); text(P, SMALL, 'UT', DOOR.x0 + 10, 20, 0x6fe08a);
  // ljust utställningsgolv med gångstråk
  for (let y = WALL_Y; y < FH; y++) for (let x = 0; x < FW; x++) {
    let c = mix(0xe8e2d4, 0xd8d2c2, hash((x / 26) | 0, (y / 18) | 0, 5) * 0.5 + (bayer(x, y) - 0.5) * 0.08);
    if (x % 26 === 0 || (y - WALL_Y) % 18 === 0) c = mul(c, 0.88);
    P.px(x, y, c);
  }
  // gula gångstråk med pilar mellan raderna
  for (const sy of [114, 166]) {
    for (let y = sy; y < sy + 12; y++) for (let x = 8; x < FW - 8; x++) if (bayer(x, y) > 0.25) P.px(x, y, 0xf0d048, 0.22);
    for (let ax = 40; ax < FW - 20; ax += 56) for (let i = 0; i < 4; i++) P.vl(ax + i, sy + 2 + i, 8 - i * 2, 0xc8a24a);
  }
  P.box(0, 0, FW, FH, 0x0e0d12);
  return P.flush();
}
