// MÖBLER – varuhuset man går runt i som ett IKEA: alla möbler står utställda
// på golvet med prislappar. Gå fram till en möbel så öppnas köpdialogen där
// man väljer modell och färg (fritt, med stor förhandsvisning) och köper –
// möbeln hamnar i förrådet och placeras hemma med Möblera.
import { Pix, SMALL, BIG, ctxText, textW, text, mix, mul, css, hash, bayer } from '../core/floor-pix.js';
import { openModal, closeModal, toast } from '../core/ui.js';
import { KATALOG, katalogOf, fmt } from '../game.js';
import { play } from '../core/sound.js';
import { createWalker, selfDrawable, folkDrawables } from './walkable.js';
import { FRAMES } from '../data/frames.js';
import { ATLAS, furnArt, furnBaseColor } from './room.js';
import { isHex } from '../core/recolor.js';
import { isElektronik } from './ikea/kat.js';

const FW = 384, FH = 216;
const WALL_Y = 60;
const DOOR = { x0: 20, x1: 52 };

// utställningen: två rader med jämna mellanrum (mattan visas som liten ruta)
const SPOTS = [];
{
  // tre rader, jämnt fördelade – rad 1 börjar efter dörren
  const ROWS_Y = [106, 158, 206];
  // (datorsakerna säljs på BLIXT ELEKTRONIK i Downtown – inte här, se ELEKTRONIK i ikea/kat.js)
  const items = KATALOG.filter((k) => !isElektronik(k) && k.shop !== 'jul').map((k) => ({ kind: k.kind, w: (k.kind === 'matta' ? [0, 0, 30, 16] : FRAMES[k.kind + '0'])[2] }));
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

// ---------- köp-/måladialogen ----------
// Stor förhandsvisning (heltalsskala på ljus rutig botten) som uppdateras
// direkt, modellrutor och en rad färgrutor: Original, färdiga kulörer och
// "Egen färg" (fri färgväljare). Samma dialog används hemma i Möblera-läget
// för att måla om en möbel – det är gratis.
export const FURN_COLORS = [
  ['#d8343c', 'Röd'], ['#ee7d2a', 'Orange'], ['#f2c230', 'Gul'], ['#2f9a4c', 'Grön'], ['#1fb5a8', 'Turkos'],
  ['#4aa8e8', 'Himmelsblå'], ['#2c5fc0', 'Blå'], ['#7e4bc0', 'Lila'], ['#f07aa8', 'Rosa'], ['#8a5230', 'Brun'],
  ['#8e8c94', 'Grå'], ['#2b2a33', 'Svart'], ['#f2efe8', 'Vit'],
];
const FX_NAMES = { sang: '🛏️ Säng', garderob: '🚪 Garderob', kylskap: '🧊 Kylskåp', dass: '🚽 Dasset' }; // startmöbler utanför katalogen
const colorName = (hex) => FURN_COLORS.find(([h]) => h === hex)?.[1] || `Egen färg ${hex.toUpperCase()}`;

export function openBuy(A, kind) {
  if (!katalogOf(kind)) return;
  furnDialog(A, { kind, v: 0, c: null, mode: 'buy' });
}
// Måla om en möbel man äger (Möblera-läget). onPick(hex | null) – null = original.
export function openRecolor(A, { kind, v = 0, c = null, onPick }) {
  furnDialog(A, { kind, v, c, mode: 'paint', onPick });
}

function furnDialog(A, o) {
  const g = A.game;
  const kind = o.kind, kat = katalogOf(kind), buy = o.mode === 'buy';
  const title = buy ? `${kat.icon} ${kat.name}` : `🎨 Måla om: ${kat ? `${kat.icon} ${kat.name}` : FX_NAMES[kind] || kind}`;
  const st = { v: o.v | 0, c: isHex(o.c) ? o.c.toLowerCase() : null };
  const models = buy && kat.vars > 1 ? Array.from({ length: kat.vars }, (_, i) => i) : []; // hemma byter man färg, inte modell
  const info = buy
    ? `💰 <b>${fmt(g.money)}</b> · Pris: <b>${fmt(kat.price)}</b> · 📦 I förrådet: ${g.storage.filter((s) => s.k === kind).length}<br><span class="sp">Möbeln hamnar i förrådet – möblera hemma med 🛋️-knappen. Färgen kan du ändra gratis hemma.</span>`
    : '<span class="sp">Att måla om hemma är gratis – välj färg och tryck Måla.</span>';
  const dlg = openModal(title, `
    <div class="fb">
      <div class="fb-top${models.length ? '' : ' solo'}">
        <div class="fb-stage"><canvas class="fb-big"></canvas></div>
        ${models.length ? `<div class="fb-side"><span class="fb-lbl">Modell</span>
          <div class="fb-models">${models.map((i) => `<button class="fb-model" data-v="${i}" title="Modell ${i + 1}"><canvas></canvas></button>`).join('')}</div></div>` : ''}
      </div>
      <div class="fb-colhead"><span class="fb-lbl">Färg</span><span class="fb-now"><i class="fb-chip"></i><b></b></span></div>
      <div class="av-sws fb-sws">
        <button class="av-sw fb-orig" data-col="" title="Original – som den ser ut i butiken"><b>↺</b></button>
        ${FURN_COLORS.map(([hex, nm]) => `<button class="av-sw" data-col="${hex}" style="--c:${hex}" title="${nm}"></button>`).join('')}
        <label class="av-sw av-own" title="Egen färg – välj precis vilken du vill"><input type="color" aria-label="Egen färg"><b>+</b></label>
      </div>
      <p class="fb-info">${info}</p>
    </div>`, buy ? [
    { label: 'Stäng', onClick: closeModal },
    { label: `🛒 Köp (${fmt(kat.price)})`, cls: 'btn-go', onClick: () => {
      const r = g.buyFurniture(kind, st.v, st.c);
      if (!r.ok) { toast(r.msg, 'bad'); play('fel'); return; }
      play('buy');
      toast(`${kat.icon} ${kat.name}${st.c ? ` (${colorName(st.c)})` : ''} ligger i förrådet!`, 'good');
      closeModal();
    } },
  ] : [
    { label: 'Avbryt', onClick: closeModal },
    { label: '🎨 Måla (gratis)', cls: 'btn-go', onClick: () => { closeModal(); o.onPick?.(st.c); } },
  ]);
  dlg.classList.add('dlg-furn');

  const big = dlg.querySelector('.fb-big');
  const tiles = [...dlg.querySelectorAll('.fb-model')];
  const sws = [...dlg.querySelectorAll('.fb-sws [data-col]')];
  const own = dlg.querySelector('.av-own'), ownIn = own.querySelector('input');
  const now = dlg.querySelector('.fb-now');

  // en möbel i heltalsskala s på en canvas (med golvskugga, utom för mattor)
  const paint = (cv, art, s) => {
    cv.width = art.sw * s; cv.height = (art.sh + 2) * s;
    const x = cv.getContext('2d');
    x.imageSmoothingEnabled = false;
    if (kind !== 'matta') {
      x.fillStyle = 'rgba(20,12,28,0.2)';
      x.fillRect(s, (art.sh - 1) * s, (art.sw - 2) * s, 2 * s);
      x.fillRect(3 * s, (art.sh + 1) * s, (art.sw - 6) * s, s);
    }
    x.drawImage(art.img, art.sx, art.sy, art.sw, art.sh, 0, 0, art.sw * s, art.sh * s);
  };
  const intScale = (v, hi) => Math.max(1, Math.min(hi, Math.floor(v)));
  function render() {
    const art = furnArt(kind, st.v, st.c);
    if (art) paint(big, art, intScale(Math.min(236 / art.sw, 170 / (art.sh + 2)), 6));
    if (tiles.length) {
      const dims = models.map((i) => furnArt(kind, i, null)).filter(Boolean);
      const ts = dims.length ? intScale(Math.min(104 / Math.max(...dims.map((a) => a.sw)), 84 / Math.max(...dims.map((a) => a.sh + 2))), 3) : 1;
      for (const b of tiles) {
        const i = +b.dataset.v, a = furnArt(kind, i, st.c);
        if (a) paint(b.querySelector('canvas'), a, ts);
        b.classList.toggle('on', i === st.v);
      }
    }
    const base = furnBaseColor(kind, st.v) || '#c8c0b0';
    dlg.querySelector('.fb-orig').style.setProperty('--c', base);
    for (const b of sws) b.classList.toggle('on', (b.dataset.col || null) === st.c);
    const isOwn = !!st.c && !FURN_COLORS.some(([h]) => h === st.c);
    own.classList.toggle('on', isOwn);
    own.style.setProperty('--c', isOwn ? st.c : '#ffffff');
    own.querySelector('b').textContent = isOwn ? '' : '+';
    now.querySelector('.fb-chip').style.setProperty('--c', st.c || base);
    now.querySelector('b').textContent = st.c ? colorName(st.c) : 'Original';
  }
  for (const b of tiles) b.onclick = () => { st.v = +b.dataset.v; play('click'); render(); };
  for (const b of sws) b.onclick = () => { st.c = b.dataset.col || null; play('click'); render(); };
  const fromPicker = () => { if (isHex(ownIn.value)) { st.c = ownIn.value.toLowerCase(); render(); } };
  ownIn.addEventListener('input', fromPicker);
  ownIn.addEventListener('change', fromPicker);
  const start = () => { ownIn.value = st.c || furnBaseColor(kind, st.v) || '#d8343c'; render(); };
  if (ATLAS.complete) start(); else ATLAS.addEventListener('load', start, { once: true });
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
