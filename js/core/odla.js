// 🌱 ODLA – det som händer när man klickar på en bädd eller en kruka: så (fröpåsen), vattna, hur långt
// det har kommit, skörda och rensa – och kannan som vattnar allt. Används av trädgårdsscenen
// (js/scenes/tradgard.js) och husvagnens odling i staden (js/city/odling.js). Odlingen räknas i game.js
// (GRODOR, plant/waterGarden/harvest/clearBed/growGarden).
// fx.water() spelar upp vattnandet (kannan i handen och dropparna) i den scen man står i.
import { openModal, closeModal, toast, esc } from './ui.js';
import { GRODOR, grodaOf, fmt } from '../game.js';
import { play } from './sound.js';
import { $t } from './i18n.js';

export function bedAction(A, i, fx = {}) {
  const g = A.game, b = g.garden().beds[i], st = g.bedState(b);
  if (st === 'tom') return sow(A, i, fx);
  if (st === 'torr') { if (g.waterGarden(i)) { fx.water?.(); toast($t`💧 Vattnat! ${grodaOf(b.g).name} växer i natt.`, 'good'); } return; }
  if (st === 'vattnad') { const G = grodaOf(b.g); toast(G.dagar - b.v === 1 ? $t`🌱 ${G.name}: dag ${b.v} av ${G.dagar}. Vattnad i dag – mogen om ${G.dagar - b.v} natt.` : $t`🌱 ${G.name}: dag ${b.v} av ${G.dagar}. Vattnad i dag – mogen om ${G.dagar - b.v} nätter.`); play('click'); return; }
  if (st === 'mogen') { const r = g.harvest(i); if (r.ok) { play('ok'); toast($t`🧺 ${r.n} ${r.groda.name.toLowerCase()} till skafferiet!${r.glad ? ` +${r.glad} 😊` : ''}`, 'good'); } return; }
  if (st === 'vissen') { g.clearBed(i); play('click'); toast($t('🥀 Den vissnade – två dagar utan vatten. Bädden är rensad, så något nytt!'), 'bad'); }
}

export function sow(A, i, fx = {}) {
  const g = A.game;
  const rows = GRODOR.map((G) => `<div class="prow"><span style="font-size:28px;text-align:center">${G.icon}</span>
    <span class="nm">${esc(G.name)}<br><small class="sp">${$t`mogen efter ${G.dagar} nätter · ${G.skord[0]}–${G.skord[1]} st · vattna varje dag`}</small></span>
    <button class="btn btn-small btn-go" data-gr="${G.id}" ${g.money < G.fro ? 'disabled' : ''}>${$t`Så · ${fmt(G.fro)}`}</button></div>`).join('');
  const dlg = openModal($t('🌱 Så i bädden'), `<p style="font-size:var(--f2);margin-top:0">${$t('Välj en fröpåse. Vattna bädden varje dag – två dagar utan vatten och plantorna vissnar. Skörden hamnar i skafferiet.')}</p><div class="plist">${rows}</div>`, [{ label: $t('Inte nu'), onClick: closeModal }]);
  dlg.querySelectorAll('[data-gr]').forEach((btn) => (btn.onclick = () => {
    const r = g.plant(i, btn.dataset.gr);
    closeModal();
    if (!r.ok) { toast(r.msg, 'bad'); play('fel'); return; }
    play('ok'); fx.water?.();
    toast($t`🌱 Sådde ${r.groda.name.toLowerCase()} – vattnat och klart. Kom tillbaka i morgon!`, 'good');
  }));
}

// kannan: vattna allt som behöver vatten i dag
export function waterAll(A, fx = {}) {
  const n = A.game.waterGarden(-1);
  if (n) { fx.water?.(); toast(n === 1 ? $t`💧 Du vattnade ${n} bädd med kannan.` : $t`💧 Du vattnade ${n} bäddar med kannan.`, 'good'); }
  else toast($t('💧 Allt som behöver vatten är redan vattnat i dag.'));
  return n;
}
