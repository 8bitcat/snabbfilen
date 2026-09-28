// MÖBELJÄTTEN – restaurangen: bord för två, menyn (dialogen med brickan) och
// korvkiosken vid utgången. Själva ätandet (sätta sig, äta, mätthet) sköts av
// scenen – här finns bara bilder och dialoger.
import { Pix, hash, mix } from '../../core/floor-pix.js';
import { openModal, closeModal, toast } from '../../core/ui.js';
import { play } from '../../core/sound.js';
import * as GAME from '../../game.js';
import { MENU, menuOf, dishBig, chairImg } from './food.js';

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
      <span style="flex:1;font-size:19px"><b>${m.name}</b><br><small class="sp">+${m.fill} mätthet${m.energy ? ` · +${m.energy} energi` : ''}</small></span>
      <b style="font-size:20px;min-width:52px;text-align:right">${m.price} kr</b>
      <button class="btn btn-small" data-minus="${m.id}">−</button>
      <b data-q="${m.id}" style="font-size:20px;min-width:18px;text-align:center">0</b>
      <button class="btn btn-small" data-plus="${m.id}">+</button>
    </div>`).join('');
  const dlg = openModal('🍽️ Restaurangen – MENY', `
    <p style="font-size:18px;margin-top:0">Ta en bricka och välj – du betalar i kassan och sätter dig sedan vid ett ledigt bord.</p>
    ${rows}
    <p style="font-size:20px;margin-bottom:0" data-sum></p>`, [
    { label: 'Nej tack', onClick: () => { closeModal(); onCancel?.(); } },
    { label: '🧾 Till kassan', cls: 'btn-go', onClick: () => {
      const items = MENU.flatMap((m) => Array(qty[m.id]).fill(m.id));
      const sum = items.reduce((a, id) => a + menuOf(id).price, 0);
      if (!items.length) { toast('Brickan är tom – välj något gott först!'); play('fel'); return; }
      if (g.money < sum) { toast('Du har inte råd – dags att jobba ett pass!', 'bad'); play('fel'); return; }
      closeModal();
      onPay(items, sum);
    } },
  ]);
  dlg.classList.add('dlg-ikea-menu');
  dlg.querySelectorAll('[data-dish]').forEach((el) => { const c = dishBig(el.dataset.dish, 3); c.style.imageRendering = 'pixelated'; el.append(c); });
  const upd = () => {
    let n = 0, sum = 0;
    for (const m of MENU) { dlg.querySelector(`[data-q="${m.id}"]`).textContent = qty[m.id]; n += qty[m.id]; sum += qty[m.id] * m.price; }
    dlg.querySelector('[data-sum]').innerHTML = `🧾 Brickan: <b>${n} st</b> · Att betala: <b>${sum} kr</b> · Du har ${fmt(g.money)} · Mätthet ${Math.round(g.hunger)}/100`;
  };
  dlg.querySelectorAll('[data-plus]').forEach((b) => (b.onclick = () => { const id = b.dataset.plus; const tot = Object.values(qty).reduce((a, v) => a + v, 0); if (tot < 4) { qty[id]++; play('click'); } else toast('Brickan är full!'); upd(); }));
  dlg.querySelectorAll('[data-minus]').forEach((b) => (b.onclick = () => { const id = b.dataset.minus; if (qty[id] > 0) { qty[id]--; play('click'); } upd(); }));
  upd();
  return dlg;
}

// Korvkiosken: äts stående vid ståborden.
const KIOSK = [
  { id: 'korv', icon: '🌭', name: 'Korv med bröd', price: 10, fill: 15 },
  { id: 'glass', icon: '🍦', name: 'Mjukglass', price: 5, fill: 5 },
];
export function openKiosk(A, { onBuy }) {
  const g = A.game;
  openModal('🌭 Bistron vid utgången', `<p style="font-size:20px;margin-top:0">Korv med bröd – med senap och ketchup – eller en mjukglass för vägen?</p>
    <p class="sp">Du har ${fmt(g.money)} · Mätthet ${Math.round(g.hunger)}/100</p>`, [
    { label: 'Nej tack', onClick: closeModal },
    ...KIOSK.map((k) => ({ label: `${k.icon} ${k.name} (${k.price} kr)`, cls: k.id === 'korv' ? 'btn-go' : '', onClick: () => {
      if (g.money < k.price) { toast('Du har inte råd – dags att jobba ett pass!', 'bad'); play('fel'); return; }
      closeModal();
      onBuy(k);
    } })),
  ]);
}
export { MENU, menuOf };
