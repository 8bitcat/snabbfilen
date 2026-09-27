// Matbutiken: köp hem till kylskåpet eller ät på stället (5 kr dyrare).
// Billig mat mättar lite, dyr mättar mycket – precis som i Jones.
import { openModal, closeModal, toast } from '../core/ui.js';
import { FOOD, fmt } from '../game.js';

export function openFoodShop(A) {
  const g = A.game;
  const body = `<p style="font-size:19px;margin-top:0">💰 <b>${fmt(g.money)}</b> · Mätthet: <b>${Math.round(g.hunger)}/100</b></p>
    <div class="plist">${FOOD.map((f) => `<div class="prow shoprow">
      <span style="font-size:28px;text-align:center">${f.icon}</span>
      <span class="nm">${f.name}<br><small class="sp">+${f.fill} mätthet · ${fmt(f.price)}</small></span>
      <button class="btn btn-small" data-buy="${f.id}" ${g.money < f.price ? 'disabled' : ''}>🛒 Köp hem</button>
      <button class="btn btn-small btn-go" data-eat="${f.id}" ${g.money < f.price + 5 ? 'disabled' : ''}>😋 Ät här +5</button>
    </div>`).join('')}</div>`;
  const dlg = openModal('🛒 Matbutiken', body, [{ label: 'Klar', cls: 'btn-go', onClick: closeModal }]);
  dlg.querySelectorAll('[data-buy]').forEach((b) => (b.onclick = () => {
    const r = g.buyFood(b.dataset.buy);
    if (r.ok) { toast('🛒 I kassen! Ligger i kylskåpet där hemma.', 'good'); openFoodShop(A); }
    else toast(r.msg, 'bad');
  }));
  dlg.querySelectorAll('[data-eat]').forEach((b) => (b.onclick = () => {
    const r = g.buyFood(b.dataset.eat, { eatNow: true });
    if (r.ok) { toast('😋 Mums!', 'good'); openFoodShop(A); }
    else toast(r.msg, 'bad');
  }));
}
