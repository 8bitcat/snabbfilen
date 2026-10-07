// MÖBELJÄTTEN – restaurangen: bord för två, menyn (dialogen med brickan),
// korvkiosken vid utgången och bistroborden bredvid den. Själva ätandet
// (bära maten, sätta sig, äta bit för bit, mätthet) sköts av scenen – här
// finns bilder, dialoger, sittplatserna vid kiosken och matsalarnas gränser.
//
// Regeln i alla matställen: maten man köper bärs i händerna tills man satt sig
// vid ett ledigt bord, man reser sig inte förrän allt är uppätet, och med maten
// i händerna kommer man inte ut ur matsalen (diningZone nedan).
import { Pix, hash, mix } from '../../core/floor-pix.js';
import { openModal, closeModal, toast } from '../../core/ui.js';
import { play } from '../../core/sound.js';
import * as GAME from '../../game.js';
import { MENU, menuOf, dishBig, chairImg } from './food.js';
import { H, FD } from './geo.js';
import { $t } from '../../core/i18n.js';

export { chairImg };
export const REST_TABLE_W = 60;
let TABLE = null;
// björkbord för två (60×18): skivan överst, fotlinjen längst ner
export function restTableImg() {
  if (TABLE) return TABLE;
  const w = REST_TABLE_W, P = new Pix(w, 18);
  for (let y = 0; y < 7; y++) for (let x = 0; x < w; x++) {
    let c = y === 0 ? 0xf6e6c4 : mix(0xecd6a8, 0xdcc08c, y / 7 + (hash(x >> 3, 0, 49) - 0.5) * 0.18);
    if (x === 0 || x === w - 1) c = 0xc8a870;
    if (y === 1 && (x & 7) === 3) c = 0xf6e6c4;
    P.px(x, y, c);
  }
  P.rect(0, 7, w, 2, 0xc8a870); P.hl(0, 8, w, 0xa8884e);
  for (const x of [3, w - 6]) { P.rect(x, 9, 3, 9, 0xd8b884); P.vl(x + 2, 9, 9, 0xa8884e); }
  P.rect(w / 2 - 4, 2, 8, 3, 0xf4f1ea); P.px(w / 2 - 2, 2, 0xd8231e); P.px(w / 2 + 1, 2, 0x2c9a4c); // servetthållare
  P.hl(3, 17, w - 6, 0x000000, 0.2);
  TABLE = P.flush();
  return TABLE;
}

const fmt = (n) => (GAME.fmt ? GAME.fmt(n) : Math.round(n) + ' kr');

// Menyn: välj vad som ska på brickan → onPay(items, pris). Allt i en dialog.
export function openMenu(A, { onPay, onCancel }) {
  const g = A.game;
  const qty = Object.fromEntries(MENU.map((m) => [m.id, m.id === 'kottbullar' ? 1 : 0]));
  const rows = MENU.map((m) => `<div class="ik-row" data-id="${m.id}" style="display:flex;align-items:center;gap:10px;margin:4px 0">
      <span data-dish="${m.id}" style="width:66px;display:inline-flex;justify-content:center"></span>
      <span style="flex:1;font-size:var(--f2)"><b>${m.name}</b><br><small class="sp">${m.energy ? $t`+${m.fill} mätthet · +${m.energy} energi` : $t`+${m.fill} mätthet`}</small></span>
      <b style="font-size:var(--f2);min-width:52px;text-align:right">${$t`${m.price} kr`}</b>
      <button class="btn btn-small" data-minus="${m.id}">−</button>
      <b data-q="${m.id}" style="font-size:var(--f2);min-width:18px;text-align:center">0</b>
      <button class="btn btn-small" data-plus="${m.id}">+</button>
    </div>`).join('');
  const dlg = openModal($t('🍽️ Restaurangen – MENY'), `
    <p style="font-size:var(--f2);margin-top:0">${$t('Ta en bricka och välj – du betalar i kassan och sätter dig sedan vid ett ledigt bord.')}</p>
    ${rows}
    <p style="font-size:var(--f2);margin-bottom:0" data-sum></p>`, [
    { label: $t('Nej tack'), onClick: () => { closeModal(); onCancel?.(); } },
    { label: $t('🧾 Till kassan'), cls: 'btn-go', onClick: () => {
      const items = MENU.flatMap((m) => Array(qty[m.id]).fill(m.id));
      const sum = items.reduce((a, id) => a + menuOf(id).price, 0);
      if (!items.length) { toast($t('Brickan är tom – välj något gott först!')); play('fel'); return; }
      if (g.money < sum) { toast($t('Du har inte råd – dags att jobba ett pass!'), 'bad'); play('fel'); return; }
      closeModal();
      onPay(items, sum);
    } },
  ]);
  dlg.classList.add('dlg-ikea-menu');
  dlg.querySelectorAll('[data-dish]').forEach((el) => { const c = dishBig(el.dataset.dish, 3); c.style.imageRendering = 'pixelated'; el.append(c); });
  const upd = () => {
    let n = 0, sum = 0;
    for (const m of MENU) { dlg.querySelector(`[data-q="${m.id}"]`).textContent = qty[m.id]; n += qty[m.id]; sum += qty[m.id] * m.price; }
    dlg.querySelector('[data-sum]').innerHTML = $t`🧾 Brickan: <b>${n} st</b> · Att betala: <b>${sum} kr</b> · Du har ${fmt(g.money)} · Mätthet ${Math.round(g.hunger)}/100`;
  };
  dlg.querySelectorAll('[data-plus]').forEach((b) => (b.onclick = () => { const id = b.dataset.plus; const tot = Object.values(qty).reduce((a, v) => a + v, 0); if (tot < 4) { qty[id]++; play('click'); } else toast($t('Brickan är full!')); upd(); }));
  dlg.querySelectorAll('[data-minus]').forEach((b) => (b.onclick = () => { const id = b.dataset.minus; if (qty[id] > 0) { qty[id]--; play('click'); } upd(); }));
  upd();
  return dlg;
}

// Korvkiosken: man får korven/glassen i handen och äter den sittande vid
// bistroborden bredvid kiosken.
export const KIOSK = [
  { id: 'korv', icon: '🌭', name: $t('Korv med bröd'), price: 10, fill: 15 },
  { id: 'glass', icon: '🍦', name: $t('Mjukglass'), price: 5, fill: 5 },
];
export function openKiosk(A, { onBuy }) {
  const g = A.game;
  openModal($t('🌭 Bistron vid utgången'), `<p style="font-size:var(--f2);margin-top:0">${$t('Korv med bröd – med senap och ketchup – eller en mjukglass?')}</p>
    <p style="font-size:var(--f2)">${$t('Du får den i handen och sätter dig vid bistroborden här bredvid – mättheten kommer medan du äter.')}</p>
    <p class="sp">${$t`Du har ${fmt(g.money)} · Mätthet ${Math.round(g.hunger)}/100`}</p>`, [
    { label: $t('Nej tack'), onClick: closeModal },
    ...KIOSK.map((k) => ({ label: $t`${k.icon} ${k.name} (${k.price} kr)`, cls: k.id === 'korv' ? 'btn-go' : '', onClick: () => {
      if (g.money < k.price) { toast($t('Du har inte råd – dags att jobba ett pass!'), 'bad'); play('fel'); return; }

      closeModal();
      onBuy(k);
    } })),
  ]);
}
export { MENU, menuOf };

// ================= bistroborden vid korvkiosken (plan 1) =================
// Två bord för två i den döda änden av gången till vänster om gula stigen, under
// kiosken: vit laminatskiva med blågul kantlist som kioskens parasoll, krompelare,
// ketchup och senap – stolarna i blått stål med gula sitsar. Samma mått som
// restaurangborden (skivan 18–13 px över fotlinjen, man sitter 10 px ovanför).
export const BISTRO_W = 44, BISTRO_H = 22;
let BT = null, BC = null;
export function bistroTableImg() {
  if (BT) return BT;
  const w = BISTRO_W, P = new Pix(w, BISTRO_H), mid = w / 2;
  // den runda skivan i perspektiv (ellips, rad 3–10) och kantlisten som följer
  // dess framkant: blå med en gul linje, skugga under
  const cy = 6.5, ry = 4, rx = mid - 0.5;
  const ell = (oy, fn) => {
    for (let y = 1; y < 14; y++) for (let x = 0; x < w; x++) {
      const dx = (x + 0.5 - mid) / rx, dy = (y + 0.5 - cy - oy) / ry, t = Math.hypot(dx, dy);
      if (t < 1) fn(x, y, t, dx, dy);
    }
  };
  // kanten = samma ellips två gånger lite lägre (gul linje underst, blå list), skivan överst
  ell(2, (x, y, t, dx) => P.px(x, y, dx < -0.75 ? 0xf6d95a : dx > 0.75 ? 0xc89a18 : 0xf2c230));
  ell(1, (x, y, t, dx) => P.px(x, y, dx < -0.7 ? 0x3f76c8 : dx > 0.7 ? 0x0c2a5c : 0x1d51a0));
  ell(0, (x, y, t, dx, dy) => {
    let c = t > 0.88 ? (dy < 0 ? 0xc8c4bc : 0xd8d4cc) : dy < -0.5 ? 0xffffff : mix(0xf8f6f0, 0xe6e2da, (dy + 1) / 2 + (hash(x >> 2, y, 71) - 0.5) * 0.1);
    if (t > 0.88 && dx < -0.55) c = 0xe4e0d8;
    P.px(x, y, c);
  });
  P.hl(4, 4, 7, 0xffffff, 0.8); P.hl(3, 5, 4, 0xffffff, 0.5); // glans
  P.hl(mid - 4, 13, 8, 0x2a2a30, 0.35); // fästplattan under skivan
  // krompelare och svart kryssfot
  P.vl(mid - 1, 13, 6, 0xd8dce2); P.vl(mid, 13, 6, 0x8a8a92); P.px(mid - 1, 13, 0x6a6a72); P.px(mid, 13, 0x5a5a62);
  P.hl(mid - 9, 19, 18, 0x4a4a52); P.hl(mid - 10, 20, 20, 0x2a2a30); P.px(mid - 10, 19, 0x2a2a30); P.px(mid + 9, 19, 0x2a2a30);
  P.hl(mid - 11, 21, 22, 0x000000, 0.2);
  // mitt på bordet: servetthållare, ketchup och senap (står på skivans bakkant)
  P.rect(mid - 3, 2, 6, 4, 0xc8ccd2); P.hl(mid - 3, 2, 6, 0xe8ecf0); P.rect(mid - 2, 1, 4, 2, 0xfaf8f2); P.px(mid - 2, 1, 0xffffff);
  P.vl(mid - 3, 3, 3, 0x8a9098);
  const bottle = (x, col, hi, lo) => { P.rect(x, 1, 2, 5, col); P.vl(x, 1, 5, hi); P.px(x + 1, 5, lo); P.px(x, 0, 0xf4f1ea); P.px(x + 1, 0, 0xd8d2c6); };
  bottle(mid - 7, 0xd8231e, 0xf05a4a, 0x8a1010);
  bottle(mid + 5, 0xf2c230, 0xf6d95a, 0xb8900e);
  BT = P.flush();
  return BT;
}
// bistrostol (12×24, samma form som restaurangstolen): blå stålram, gul sits och rygg
export function bistroChairImg() {
  if (BC) return BC;
  const P = new Pix(12, 24);
  P.hl(1, 0, 10, 0x3f76c8); P.hl(1, 1, 10, 0x1d51a0); P.px(1, 1, 0x3f76c8); P.px(10, 0, 0x1d51a0); P.px(10, 1, 0x0c2a5c);
  for (const [y, c] of [[3, 0xf6d95a], [4, 0xf2c230], [5, 0xc89a18], [7, 0xf6d95a], [8, 0xf2c230], [9, 0xc89a18]]) P.hl(2, y, 8, c);
  P.vl(1, 2, 11, 0x3f76c8); P.vl(10, 2, 11, 0x0c2a5c); P.vl(2, 10, 3, 0x1d51a0); P.vl(9, 10, 3, 0x1d51a0);
  P.hl(0, 13, 12, 0xf6d95a); P.hl(0, 14, 12, 0xf2c230); P.hl(0, 15, 12, 0xc89a18); P.px(0, 14, 0xf6d95a); P.px(11, 14, 0xc89a18);
  P.hl(1, 16, 10, 0x1d51a0);
  P.vl(1, 17, 6, 0x9aa0a8); P.vl(10, 17, 6, 0x6a7078); P.px(1, 23, 0x2a2a30); P.px(10, 23, 0x2a2a30);
  BC = P.flush();
  return BC;
}
// Lägger bistroborden på plan 1 (anropas efter furnish, innan gånghindren läses in):
// rekvisita (bord med sina brickor + stolar), hinder, sittplatser och klickytor.
export function addBistro(F) {
  if (F.n !== 1 || !F.exit || F.bistro) return;
  const xb = F.exit.x0, base = H - 9;
  const img = bistroTableImg(), ch = bistroChairImg();
  F.bistro = [];
  for (const dx of [10, 64]) {
    const tb = { x: xb + dx, base, bistro: true, top: base - BISTRO_H + 4 };
    F.props.push({ img, x: tb.x, y: base - img.height, fy: base, table: tb });
    F.obstacles.push([tb.x + 1, base - 7, tb.x + BISTRO_W - 1, base + 1]);
    for (const [k, sx] of [[0, 11], [1, 33]]) {
      const s = { id: F.seats.length, table: tb, x: tb.x + sx, y: base - 10, side: k, occ: null, bistro: true,
        approach: [k ? tb.x + BISTRO_W + 6 : tb.x - 6, base - 10] };
      F.seats.push(s);
      F.props.push({ img: ch, x: s.x - 6, y: s.y - 6 - ch.height, fy: s.y - 0.5, chair: s });
      F.obstacles.push([s.x - 6, s.y - 4, s.x + 6, s.y + 1]);
    }
    F.clicks.push({ id: 'bistrobord', kind: 'table', table: tb, hot: [tb.x - 2, base - 40, tb.x + BISTRO_W + 2, base + 2], go: [tb.x - 6, base - 10] });
    F.bistro.push(tb);
  }
}
// Matsalen man äter i: med maten i händerna går man inte utanför den (restaurangen
// på plan 2, utgångshallen med kiosken och bistroborden på plan 1).
export function diningZone(F) {
  if (F.n === 2 && F.rest) return { x0: F.rest.x0, x1: F.rest.x1, y0: F.rest.fy - 12, y1: F.rest.fy + FD };
  if (F.n === 1 && F.exit) return { x0: F.exit.x0, x1: F.exit.x1, y0: F.exit.fy - 12, y1: H };
  return null;
}
