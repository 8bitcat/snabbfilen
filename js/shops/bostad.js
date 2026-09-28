// Bostadsbyrån: välj var du bor. Större bostad = insats + högre hyra,
// men bättre sömn. Första gången väljer man här var man ska bo.
import { openModal, closeModal, toast } from '../core/ui.js';
import { HOMES, fmt } from '../game.js';
import { play } from '../core/sound.js';
import { posterImage } from '../scenes/shop-bostad.js';

export function openHousing(A, { firstTime = false, onDone } = {}) {
  const g = A.game;
  const body = `<p style="font-size:19px;margin-top:0">${firstTime
    ? 'Var vill du bo? Lilla rummet är gratis att flytta in i – resten får du spara till.'
    : `💰 <b>${fmt(g.money)}</b> · Hyran dras varje måndag morgon.`}</p>
    <div class="plist">${HOMES.map((h) => {
      const here = g.home === h.id, afford = g.money >= h.deposit;
      return `<div class="prow shoprow homerow ${here ? 'here' : ''}">
        <span data-pic="${h.id}" style="font-size:28px;text-align:center">${h.icon}</span>
        <span class="nm">${h.name}${here ? ' <small class="ok">← du bor här</small>' : ''}<br>
          <small class="sp">${h.desc}</small><br>
          <small class="sp">Insats <b>${h.deposit ? fmt(h.deposit) : 'gratis'}</b> · hyra ${fmt(h.rent)}/vecka${h.restBonus > 0 ? ` · 😴 +${h.restBonus} energi` : ''}${h.restBonus < 0 ? ` · <span class="bad">🥶 −${Math.abs(h.restBonus)} energi</span>` : ''}</small></span>
        <button class="btn btn-small ${afford && !here ? 'btn-go' : ''}" data-move="${h.id}" ${here || !afford ? 'disabled' : ''}>${here ? 'Hemma' : 'Flytta hit'}</button>
      </div>`;
    }).join('')}</div>`;
  const dlg = openModal('🔑 Bostadsbyrån', body,
    firstTime ? [] : [{ label: 'Stäng', onClick: closeModal }],
    { closable: !firstTime });
  // annonsbilderna: samma planscher som hänger på mäklarkontorets vägg, i pixelskala
  dlg.querySelectorAll('[data-pic]').forEach((el) => {
    try {
      const c = posterImage(el.dataset.pic);
      if (!c) return;
      c.className = 'homepic';
      c.title = HOMES.find((h) => h.id === el.dataset.pic)?.name || '';
      el.replaceWith(c);
    } catch { /* bilden är bara pynt */ }
  });
  dlg.querySelectorAll('[data-move]').forEach((b) => (b.onclick = () => {
    const r = g.moveTo(b.dataset.move);
    if (!r.ok) { toast(r.msg, 'bad'); return; }
    closeModal();
    toast(`🔑 Välkommen hem till ${g.homeInfo.name}!`, 'good');
    g.save();
    if (onDone) onDone();
    else A.go('room');
  }));
  // första gången: rummet är alltid valbart även utan pengar
  if (firstTime) {
    const first = dlg.querySelector('[data-move="rum"]');
    if (first) { first.disabled = false; first.classList.add('btn-go'); first.onclick = () => { g.home = 'rum'; g.save(); closeModal(); toast('🔑 Välkommen hem till Lilla rummet!', 'good'); onDone?.(); }; }
  }
  return dlg;
}

