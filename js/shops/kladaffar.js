// Klädaffären har två sidor: jobbet (sortera plagg) och butiken. Köpta plagg
// låses upp som val i garderoben där hemma – kläder är progression.
import { openModal, closeModal, toast } from '../core/ui.js';
import { SORTIMENT, clothesKey, fmt } from '../game.js';
import { play } from '../core/sound.js';

export function openKladaffar(A) {
  const g = A.game;
  openModal('👕 Klädaffären', `<p style="font-size:20px;margin-top:0">Välkommen! Vill du jobba ett pass eller fynda något snyggt?</p>
    <p style="font-size:18px" class="sp">Det du köper dyker upp som nya val i garderoben hemma.</p>`, [
    { label: 'Stäng', onClick: closeModal },
    { label: '🛍️ Handla kläder', onClick: () => { closeModal(); openKladShop(A); } },
    { label: '🔨 Jobba ett pass', cls: 'btn-go', onClick: () => { closeModal(); A.startJob('klader'); } },
  ]);
}

export function openKladShop(A) {
  const g = A.game;
  const body = `<p style="font-size:19px;margin-top:0">💰 <b>${fmt(g.money)}</b></p>
    <div class="plist">${SORTIMENT.map((s, i) => {
      const owned = g.wardrobe.includes(clothesKey(s.kind, s.v));
      return `<div class="prow ${owned ? 'here' : ''}">
        <span style="font-size:26px;text-align:center">${s.icon}</span>
        <span class="nm">${s.name}${owned ? ' <small class="ok">✓ din</small>' : ''}<br><small class="sp">${fmt(s.price)}</small></span>
        <button class="btn btn-small ${!owned && g.money >= s.price ? 'btn-go' : ''}" data-shop="${i}" ${owned || g.money < s.price ? 'disabled' : ''}>${owned ? 'Har' : 'Köp'}</button>
      </div>`;
    }).join('')}</div>`;
  const dlg = openModal('🛍️ Klädaffären', body, [{ label: 'Klar', cls: 'btn-go', onClick: closeModal }]);
  dlg.querySelectorAll('[data-shop]').forEach((b) => (b.onclick = () => {
    const s = SORTIMENT[+b.dataset.shop];
    const r = A.game.buyClothes(s.kind, s.v);
    if (!r.ok) { toast(r.msg, 'bad'); play('fel'); return; }
    play('buy');
    toast(`${s.icon} ${s.name} är din! Finns i garderoben nu.`, 'good');
    openKladShop(A);
  }));
}
