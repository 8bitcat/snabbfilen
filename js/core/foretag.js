// EGET FÖRETAG – foodtruckens dialoger (logiken i game.js: TRUCK_*, buyTruck, truckDag, truckPass …):
//   openTruckKop(A)   i GARAGET: köp en foodtruck (Kenta har en begagnad)
//   openTruck(A)      klick på trucken i staden: jobba i luckan, sköta företaget
//   openForetag(A)    sköta företaget: platsen, priserna, menyn och uppgraderingarna, personalen,
//                     bokföringen – och sälja trucken
//   startTruckPass(A) in i luckan (minispelet js/jobs/jobb-truck.js) → lönebeskedet
import { openModal, closeModal, toast, esc } from './ui.js';
import { play } from './sound.js';
import { TRUCK_PRIS, TRUCK_PLATSER, TRUCK_MENY, TRUCK_UPPG, TRUCK_PRISER, TRUCK_MAX_PERSONAL, truckPlatsOf, truckSokande, fmt } from '../game.js';
import { $t } from './i18n.js';

export const TRUCK_OPPET = [8, 21];   // när man kan jobba i luckan själv
const stars = (r) => '★'.repeat(Math.round(r)) + '☆'.repeat(5 - Math.round(r));
export const truckNamn = (A) => $t`${String(A.avatar?.name || 'Pixel').toUpperCase()}S KÖK`.slice(0, 14);
// är trucken öppen just nu (personal eller man jobbar själv)? – för bilden i staden
export const truckOppen = (g) => !!g.truck && g.truck.personal.length > 0 && g.min >= 9 * 60 && g.min < 20 * 60;

export function openTruckKop(A) {
  const g = A.game;
  if (g.truck) { toast($t`🚚 Du har redan en foodtruck – den står vid ${truckPlatsOf(g.truck.plats).namn}.`); return; }
  play('click');
  openModal($t('🚚 Foodtrucken'), `<p style="font-size:var(--f2);margin-top:0">${$t('"Den här har jag rustat upp själv!" säger Kenta. En begagnad foodtruck med korvgrill och dryckeskyl – <b>starta ditt eget företag</b>!')}</p>
    <p style="font-size:var(--f2)">${$t('🌭 Sälj korv och dricka från början – köp grill, tacobar och glassfrys för fler rätter.')}<br>${$t('📍 Ställ den i parken, på Tjurtorget i downtown eller på parkeringen i förorten.')}<br>${$t('🍳 Jobba i luckan själv – allt du säljer är ditt.')}<br>${$t('👥 Anställ personal som håller öppet varje dag medan du gör annat.')}</p>
    <p style="font-size:var(--f2)">${$t`💰 Du har <b>${fmt(g.money)}</b> · Pris <b>${fmt(TRUCK_PRIS)}</b>`}</p>`, [
    { label: $t`🛒 Köp · ${fmt(TRUCK_PRIS)}`, cls: 'btn-go', onClick: () => {
      const r = g.buyTruck();
      if (!r.ok) { toast(r.msg, 'bad'); play('fel'); return; }
      closeModal(); play('fanfare');
      toast($t`🚚 Grattis till ditt eget företag! Trucken står i ${truckPlatsOf('parken').namn.toLowerCase()} – gå dit och öppna luckan.`, 'good');
    } },
    { label: $t('Stäng'), onClick: closeModal },
  ]);
}

export function openTruck(A) {
  const g = A.game, T = g.truck;
  if (!T) return;
  play('click');
  const P = truckPlatsOf(T.plats), h = g.min / 60;
  const kanJobba = h >= TRUCK_OPPET[0] && h < TRUCK_OPPET[1];
  const pers = T.personal.length ? T.personal.map((x) => esc($t(x.namn))).join(` ${$t('och')} `) : $t('ingen');
  openModal(`🚚 ${esc(truckNamn(A))}`, `<p style="font-size:var(--f2);margin-top:0">${$t`${P.icon} ${esc(P.namn)} · ryktet <b>${stars(T.rykte)}</b> · personal: <b>${pers}</b>`}</p>
    <p style="font-size:var(--f2)">${kanJobba ? $t('🍳 Öppna luckan och sälj själv i 4 timmar – allt du säljer är ditt.') : $t`🌙 Luckan öppnar ${TRUCK_OPPET[0]}:00 – kom tillbaka då.`}${g.energy < 25 ? `<br>${$t('😪 Du är för trött för att stå i luckan.')}` : ''}</p>`, [
    ...(kanJobba && g.energy >= 25 ? [{ label: $t('🍳 Jobba i luckan'), cls: 'btn-go', onClick: () => { closeModal(); startTruckPass(A); } }] : []),
    { label: $t('📋 Sköta företaget'), cls: 'btn-gold', onClick: () => openForetag(A) },
    { label: $t('Stäng'), onClick: closeModal },
  ]);
}

export function startTruckPass(A) {
  const T = A.game.truck;
  if (!T) return;
  A.shiftJob = null;
  A.truckPass = true;
  A.go('jobbtruck', { onDone: (stats) => finishTruck(A, stats) });
}
function finishTruck(A, stats) {
  const g = A.game, r = g.truckPass(stats);
  A.truckPass = false;
  play('coin');
  const line = (l, v) => `<div style="display:flex;justify-content:space-between;font-size:var(--f2)"><span>${l}</span><b>${v}</b></div>`;
  const per = {};
  for (const id of stats.sald) per[id] = (per[id] || 0) + 1;
  openModal($t('🚚 Luckan stänger!'), `
    ${line($t('😊 Nöjda kunder'), stats.ok)}
    ${Object.entries(per).map(([id, n]) => line(`${TRUCK_MENY.find((m) => m.id === id)?.icon || ''} ${esc(TRUCK_MENY.find((m) => m.id === id)?.namn || id)}`, $t`${n} st`)).join('')}
    ${stats.fel ? line($t('❌ Fel till kunden'), stats.fel) : ''}
    ${stats.arga ? line($t('😤 Tröttnade och gick'), stats.arga) : ''}
    <div style="border-top:3px dashed var(--ink);margin:8px 0"></div>
    ${line($t('💵 Försäljning'), fmt(r.intakt))}
    ${line($t('🥫 Råvaror'), '−' + fmt(r.varor))}
    ${line($t('💰 Vinst'), fmt(r.vinst))}
    ${line($t('⭐ Ryktet'), `${stars(r.rykteFore)} → ${stars(r.rykte)}`)}`, [
    { label: $t('💰 Ta vinsten'), cls: 'btn-go', onClick: () => { closeModal(); const P = truckPlatsOf(g.truck?.plats); A.cityPos = [P.x, P.y + 12]; A.go('city'); } },
  ], { closable: false });
}

export function openForetag(A) {
  const g = A.game, T = g.truck;
  if (!T) return;
  const draw = () => {
    const P = truckPlatsOf(T.plats), meny = g.truckMeny(), snitt = g.truckSnitt();
    const sok = truckSokande(g.day).filter((s) => !T.personal.some((x) => x.id === s.id));
    const platser = TRUCK_PLATSER.map((q) => `<button class="btn btn-small ${q.id === T.plats ? 'btn-gold' : ''}" data-plats="${q.id}" title="${esc(q.blurb)}">${$t`${q.icon} ${esc(q.namn)} · hyra ${fmt(q.hyra)}/v`}</button>`).join(' ');
    const priser = Object.entries(TRUCK_PRISER).map(([k, v]) => `<button class="btn btn-small ${k === T.priser ? 'btn-gold' : ''}" data-pris="${k}">${esc(v.namn)}${k === 'lag' ? $t(' – fler kunder') : k === 'hog' ? $t(' – mer per rätt') : ''}</button>`).join(' ');
    const uppg = TRUCK_UPPG.map((u) => T.uppg.includes(u.id) ? `<span style="font-size:var(--f2)">✅ ${u.icon} ${esc(u.namn)}</span>` : `<button class="btn btn-small btn-go" data-uppg="${u.id}" ${g.money < u.pris ? 'disabled' : ''} title="${esc(u.blurb)}">${u.icon} ${esc(u.namn)} · ${fmt(u.pris)}</button>`).join(' ');
    const pers = T.personal.map((x) => `<div class="prow" style="grid-template-columns:1fr auto"><span class="nm">👤 ${esc($t(x.namn))} <small class="sp">${'⭐'.repeat(x.skill)} · ${$t`${fmt(x.lon)}/dag`}</small></span><button class="btn btn-small btn-red" data-avsked="${esc(x.id)}">${$t('Säg upp')}</button></div>`).join('');
    const sokRows = T.personal.length >= TRUCK_MAX_PERSONAL ? `<p class="sp" style="margin:0">${$t('Trucken är full – två får plats.')}</p>`
      : sok.map((s) => `<div class="prow" style="grid-template-columns:1fr auto"><span class="nm">🙋 ${esc($t(s.namn))} <small class="sp">${'⭐'.repeat(s.skill)} · ${$t`${fmt(s.lon)}/dag`}</small></span><button class="btn btn-small btn-go" data-anstall="${esc(s.id)}">${$t('Anställ')}</button></div>`).join('');
    const logg = (T.logg || []).slice(0, 7).map((l) => `<div style="display:flex;justify-content:space-between;font-size:var(--f1)"><span>${$t`Dag ${l.dag}`}${l.regn ? ' 🌧️' : ''} · ${$t`${l.kunder} kunder`}</span><b class="${l.vinst < 0 ? 'bad' : ''}">${l.vinst >= 0 ? '+' : ''}${fmt(l.vinst)}</b></div>`).join('') || `<p class="sp" style="margin:0">${$t('Ingen personal har jobbat än.')}</p>`;
    const dlg = openModal($t`📋 ${esc(truckNamn(A))} – företaget`, `
      <p style="font-size:var(--f2);margin-top:0">${$t`${P.icon} ${esc(P.namn)} · ryktet <b>${stars(T.rykte)}</b> · sålt totalt <b>${T.sald}</b> · snittkund ≈ <b>${fmt(Math.round(snitt.pris))}</b>`}</p>
      <p class="fb-lbl" style="margin:6px 0 2px">${$t('📍 Platsen (flytta = en halvtimme)')}</p><div>${platser}</div>
      <p class="fb-lbl" style="margin:8px 0 2px">${$t('🏷️ Priserna')}</p><div>${priser}</div>
      <p class="fb-lbl" style="margin:8px 0 2px">${$t`🍽️ Menyn: ${meny.map((m) => m.icon).join(' ')}`}</p><div>${uppg}</div>
      <p class="fb-lbl" style="margin:8px 0 2px">${$t('👥 Personalen (håller öppet 9–20 varje dag)')}</p>${pers || `<p class="sp" style="margin:0">${$t('Ingen anställd – trucken är bara öppen när du står i luckan.')}</p>`}
      <p class="fb-lbl" style="margin:8px 0 2px">${$t('🙋 Dagens sökande')}</p>${sokRows}
      <p class="fb-lbl" style="margin:8px 0 2px">${$t('📒 Bokföringen')}</p>${logg}`, [
      { label: $t('💸 Sälj trucken'), cls: 'btn-red', onClick: () => openModal($t('💸 Sälja trucken?'), `<p style="font-size:var(--f2);margin-top:0">${$t('Kenta köper tillbaka den för ungefär halva priset. Personalen slutar.')}</p>`, [
        { label: $t('Sälj'), cls: 'btn-red', onClick: () => { const kr = g.saljTruck(); closeModal(); play('coin'); toast($t`💸 Trucken såld för ${fmt(kr)}.`); A.scene?.truckChanged?.(); } },
        { label: $t('Nej'), onClick: () => draw() },
      ]) },
      { label: $t('Klar'), cls: 'btn-go', onClick: closeModal },
    ]);
    dlg.querySelectorAll('[data-plats]').forEach((b) => (b.onclick = () => { if (g.flyttaTruck(b.dataset.plats)) { play('door'); toast($t`🚚 Trucken står nu vid ${truckPlatsOf(b.dataset.plats).namn.toLowerCase()}.`, 'good'); A.scene?.truckChanged?.(); } draw(); }));
    dlg.querySelectorAll('[data-pris]').forEach((b) => (b.onclick = () => { g.truckPriser(b.dataset.pris); play('click'); draw(); }));
    dlg.querySelectorAll('[data-uppg]').forEach((b) => (b.onclick = () => { const r = g.buyTruckUppg(b.dataset.uppg); if (!r.ok) { toast(r.msg, 'bad'); return; } play('ok'); toast($t`${r.uppg.icon} ${r.uppg.namn} – klart!`, 'good'); A.scene?.truckChanged?.(); draw(); }));
    dlg.querySelectorAll('[data-anstall]').forEach((b) => (b.onclick = () => { const r = g.anstall(sok.find((s) => s.id === b.dataset.anstall)); if (!r.ok) { toast(r.msg, 'bad'); return; } play('ok'); A.scene?.truckChanged?.(); draw(); }));
    dlg.querySelectorAll('[data-avsked]').forEach((b) => (b.onclick = () => { g.avskeda(b.dataset.avsked); play('click'); A.scene?.truckChanged?.(); draw(); }));
  };
  draw();
}
export { TRUCK_PLATSER };
