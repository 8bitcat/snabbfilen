// Bostadsbyrån: välj var du bor. Större bostad = insats + högre hyra,
// men bättre sömn. Första gången väljer man här var man ska bo.
import { openModal, closeModal, toast } from '../core/ui.js';
import { HOMES, FURNITURE, fmt } from '../game.js';
import { play } from '../core/sound.js';

export function openHousing(A, { firstTime = false, onDone } = {}) {
  const g = A.game;
  const body = `<p style="font-size:19px;margin-top:0">${firstTime
    ? 'Var vill du bo? Lilla rummet är gratis att flytta in i – resten får du spara till.'
    : `💰 <b>${fmt(g.money)}</b> · Hyran dras varje måndag morgon.`}</p>
    <div class="plist">${HOMES.map((h) => {
      const here = g.home === h.id, afford = g.money >= h.deposit;
      return `<div class="prow shoprow ${here ? 'here' : ''}">
        <span style="font-size:28px;text-align:center">${h.icon}</span>
        <span class="nm">${h.name}${here ? ' <small class="ok">← du bor här</small>' : ''}<br>
          <small class="sp">${h.desc}</small><br>
          <small class="sp">Insats <b>${h.deposit ? fmt(h.deposit) : 'gratis'}</b> · hyra ${fmt(h.rent)}/vecka${h.restBonus ? ` · 😴 +${h.restBonus} energi` : ''}</small></span>
        <button class="btn btn-small ${afford && !here ? 'btn-go' : ''}" data-move="${h.id}" ${here || !afford ? 'disabled' : ''}>${here ? 'Hemma' : 'Flytta hit'}</button>
      </div>`;
    }).join('')}</div>`;
  const dlg = openModal('🔑 Bostadsbyrån', body,
    firstTime ? [] : [{ label: '🛋️ Möbelhörnan', onClick: () => { closeModal(); openFurniture(A); } }, { label: 'Stäng', onClick: closeModal }],
    { closable: !firstTime });
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

// Möbelhörnan: köpta möbler ritas i rummet oavsett bostad (i Villan ingår de flesta).
export function openFurniture(A) {
  const g = A.game;
  const body = `<p style="font-size:19px;margin-top:0">💰 <b>${fmt(g.money)}</b> · Möblerna följer med när du flyttar.</p>
    <div class="plist">${FURNITURE.map((f) => {
      const owned = g.furniture.includes(f.id);
      return `<div class="prow ${owned ? 'here' : ''}">
        <span style="font-size:26px;text-align:center">${f.icon}</span>
        <span class="nm">${f.name}${owned ? ' <small class="ok">✓ din</small>' : ''}<br><small class="sp">${f.desc} · ${fmt(f.price)}</small></span>
        <button class="btn btn-small ${!owned && g.money >= f.price ? 'btn-go' : ''}" data-furn="${f.id}" ${owned || g.money < f.price ? 'disabled' : ''}>${owned ? 'Har' : 'Köp'}</button>
      </div>`;
    }).join('')}</div>`;
  const dlg = openModal('🛋️ Möbelhörnan', body, [
    { label: '🔑 Bostäder', onClick: () => { closeModal(); openHousing(A); } },
    { label: 'Klar', cls: 'btn-go', onClick: closeModal },
  ]);
  dlg.querySelectorAll('[data-furn]').forEach((b) => (b.onclick = () => {
    const r = A.game.buyFurniture(b.dataset.furn);
    if (!r.ok) { toast(r.msg, 'bad'); play('fel'); return; }
    play('buy');
    toast(`${r.item.icon} ${r.item.name} står hemma nu!`, 'good');
    openFurniture(A);
  }));
}
