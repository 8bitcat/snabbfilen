// 💼 JOBBEN och 🏠 HEM i mobilen – Carl 2026-10-11: "lägg till en ikon i mobilen som visar vart alla jobb
// ligger och en ikon som visar vägen hem. Gör så att guiden använder den när man ska lära sig spelet."
//   • Jobb-appen: alla jobb i Pixelstaden, närmast först – var de ligger (område, öppettider, avstånd),
//     ens nivå och lönen. 🧭 Visa vägen sätter samma gula pil som kartan (A.guideTo, js/scenes/city.js),
//     🚕 tar en taxi dit (A.taxiTo). Jobb som kräver en examen står kvar, med kursen utskriven.
//   • Hem-appen: pilen visar vägen till ens bostad (homeBuilding). Gården ligger på landet, öster om stan.
//   • Startguiden (js/core/startguide.js, guidePeka) får mobilknappen, appen och Burgarbarens rad att pulsera
//     första dagen, och lägger det jobb den lär ut överst i listan.
import { JOBS, JOB_TITLES, levelOf, COURSES, fmt } from '../game.js';
import { buildingById } from '../city/map.js';
import { homeBuilding, whereAmI, taxiQuote, openNow, hhmm, districtName } from '../city/citymap.js';
import { openModal, closeModal, toast, esc } from './ui.js';
import { play } from './sound.js';
import { $t } from './i18n.js';
import { guidePeka } from './startguide.js';

// jobbet → huset där man jobbar (husen i js/city/map.js och buildings-*.js)
export const JOBB_HUS = {
  burgare: 'burgare', kok: 'burgare', kafe: 'kafe', frukt: 'frukt', flygplats: 'flyg', incheckning: 'flyg',
  pizzeria: 'pizzeria', posten: 'posten', vard: 'vardcentral', bensinmack: 'bensinmack',
  bilverkstad: 'bilverkstad', tvatteri: 'tvatteri', datorbygge: 'kontor4', finans: 'kontor1',
};

let stil = false;
function injectStyle() {
  if (stil || typeof document === 'undefined') return;
  stil = true;
  const st = document.createElement('style');
  st.textContent = `
.jl-lista { display: grid; gap: 6px; margin: 0; padding: 0; list-style: none; }
.jl-rad { display: grid; grid-template-columns: auto minmax(0, 1fr) auto auto; gap: 10px; align-items: center; padding: 6px 8px; background: #fff; border: 2px solid var(--ink); }
.jl-rad.pil { background: #fff4c7; }
.jl-ik { font-size: var(--f3); line-height: 1; width: 1.3em; text-align: center; }
.jl-txt { display: grid; gap: 2px; min-width: 0; }
.jl-txt b { font: var(--f2) var(--head); font-weight: 400; line-height: 1; }
.jl-txt small { font: var(--f1) var(--font); color: var(--muted); line-height: 1.15; }
.jl-txt .stangt { color: var(--red2); }
.jl-rad .btn { white-space: nowrap; }
html.desk-mobil .jl-txt small { font-size: var(--f15); }`;
  document.head.appendChild(st);
}

export function openJobben(A) {
  injectStyle();
  const g = A.game, me = whereAmI(A), peka = guidePeka();
  const inJob = /^jobb/.test(A.sceneName || '');
  const rader = Object.keys(JOBS).map((id) => {
    const job = JOBS[id], b = buildingById(JOBB_HUS[id]);
    if (!b) return null;
    const q = taxiQuote(me, b), here = me.inside?.id === b.id;
    return { id, job, b, q, here, m: here ? 0 : q.m };
  }).filter(Boolean).sort((a, b) => (peka?.jobb === b.id) - (peka?.jobb === a.id) || a.m - b.m);
  const body = `<p style="font-size:var(--f2);margin-top:0">${$t('Alla jobb i Pixelstaden – närmast först. 🧭 Visa vägen så pekar en pil dit.')}</p>
    <ul class="jl-lista">${rader.map(({ id, job, b, q, here }) => {
      const lvl = levelOf(g.jobs[id] | 0), krav = job.kraver && !g.edu?.[job.kraver]?.klar ? COURSES[job.kraver] : null;
      const oppet = openNow(b, g);
      const tider = b.open ? $t`öppet ${hhmm(b.open[0])}–${hhmm(b.open[1])}` : $t('öppet dygnet runt');
      const pilNu = A.guide?.id === b.id;
      const puls = peka?.jobb === id ? ' sg-pulse' : '';
      return `<li class="jl-rad${pilNu ? ' pil' : ''}" data-jobb="${id}">
        <span class="jl-ik" aria-hidden="true">${job.icon}</span>
        <span class="jl-txt"><b>${esc(job.name)}</b>
          <small>${esc(districtName(b))} · ${esc(String(b.sign || ''))} · ${here ? $t('du är här') : $t`${q.m} m bort`}</small>
          <small>${tider}${oppet ? '' : ` · <span class="stangt">${$t('stängt nu')}</span>`} · ${JOB_TITLES[lvl - 1]} · ${$t`${fmt(job.wage)} per rätt`}</small>
          ${krav ? `<small class="stangt">${$t`🎓 kräver examen i ${krav.name}`}</small>` : ''}</span>
        <button type="button" class="btn btn-small btn-go${puls}" data-visa="${id}" ${here ? 'disabled' : ''}>${$t('🧭 Visa vägen')}</button>
        <button type="button" class="btn btn-small" data-taxi="${id}" ${here || inJob || g.money < q.kr ? 'disabled' : ''} title="${esc($t`ca ${q.min} minuter`)}">🚕 ${fmt(q.kr)}</button>
      </li>`;
    }).join('')}</ul>`;
  const dlg = openModal($t('💼 Jobben'), body, [{ label: $t('Stäng'), onClick: closeModal }]);
  dlg.classList.add('dlg-jobben');
  dlg.querySelectorAll('[data-visa]').forEach((btn) => (btn.onclick = () => { play('click'); closeModal(); A.guideTo?.(JOBB_HUS[btn.dataset.visa]); }));
  dlg.querySelectorAll('[data-taxi]').forEach((btn) => (btn.onclick = () => { play('click'); closeModal(); A.taxiTo?.(JOBB_HUS[btn.dataset.taxi]); }));
  return dlg;
}

// 🏠 vägen hem
export function visaHem(A) {
  const g = A.game, b = homeBuilding(g);
  if (A.sceneName === 'room' && !A.visitTarget) { play('click'); toast($t('🏠 Du är redan hemma.'), 'good'); return; }
  if (!b) {
    play('click');
    toast(g.home === 'gard' ? $t('🚜 Gården ligger på landet – gå österut längs Pixelgatan, förbi förorten.') : $t('🏠 Du har inget hem i staden än – fråga på bostadsbyrån.'), 'wrap');
    return;
  }
  play('click');
  A.guideTo?.(b.id);
}
