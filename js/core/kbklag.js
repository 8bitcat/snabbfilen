// ⚽ KBK-APPEN i mobilen – Carl 2026-10-11: "kan man få en kbk-ikon i mobilen med en pixlad logga. För att
// verifiera sig själv får man skriva sitt förnamn och nummer, då vet spelet vem du är i laget."
//   • inte avstämd: förnamn + nummer stäms av mot laget (js/data/kbk.js, bara förnamn som i klädaffären)
//   • avstämd: "Du är Julia 34", lagkompisarna som är i Pixelstaden just nu och hela laget (grön prick = inne)
//   • hälsningen när en lagkompis hoppar in står i js/net/kbk.js (kbkKomIn)
//   • appen syns för den som spelar på svenska och för den som redan är avstämd – Pixelcity finns i hela
//     världen, och en KBK-ikon säger inget för andra
import { KUNGS_PLAYERS } from '../data/kbk.js';
import { kbkNr, kbkStammer, kbkSpara, kbkTaBort, kbkEtikett, kbkFragaNotiser } from '../net/kbk.js';
import { playersList } from '../net/world.js';
import { openModal, closeModal, toast, esc } from './ui.js';
import { $t, LANG } from './i18n.js';
import { play } from './sound.js';
import { ikonURL } from './pixikon.js';

export const kbkAppSyns = (av) => LANG === 'sv' || !!kbkNr(av);
// lagkompisarna i Pixelstaden just nu (andra spelare vars figur är avstämd)
export const lagInne = () => playersList().filter((p) => KUNGS_PLAYERS.some(([n]) => n === p.kb));

let stil = false;
function injectStyle() {
  if (stil || typeof document === 'undefined') return;
  stil = true;
  const st = document.createElement('style');
  st.textContent = `
.kb-head { display: flex; gap: 14px; align-items: center; margin-bottom: 10px; }
.kb-logga { width: 64px; height: 64px; image-rendering: pixelated; flex: none; }
.kb-head p { margin: 0; font-size: var(--f2); line-height: 1.15; }
.kb-du { font: var(--f3) var(--head); line-height: 1; margin: 0 0 4px; }
.kb-rub { font: var(--f2) var(--head); margin: 12px 0 6px; }
.kb-inne { display: grid; gap: 4px; margin: 0; padding: 0; list-style: none; font-size: var(--f2); }
.kb-inne li::before { content: ""; display: inline-block; width: 10px; height: 10px; margin-right: 8px; background: var(--green2); border: 2px solid var(--ink); vertical-align: 0; }
.kb-tom { font-size: var(--f2); color: var(--muted); margin: 0; }
.kb-laget { display: flex; flex-wrap: wrap; gap: 6px; }
.kb-spel { font: var(--f2) var(--font); line-height: 1; padding: 5px 8px 4px; background: #fff; border: 2px solid var(--ink); display: inline-flex; gap: 6px; align-items: center; }
.kb-spel b { font-weight: 400; color: #7a1f2e; }
.kb-spel.inne { background: #dff5e3; }
.kb-spel.inne::after { content: ""; width: 8px; height: 8px; background: var(--green2); border: 2px solid var(--ink); }
.kb-spel.jag { background: #fff4c7; }
.kb-not { font-size: var(--f2); color: var(--muted); margin: 12px 0 0; }
html.desk-mobil .kb-spel, html.desk-mobil .kb-inne { font-size: var(--f15); }`;
  document.head.appendChild(st);
}
const logga = () => `<img class="kb-logga" src="${ikonURL('kbk')}" alt="KBK">`;

export function openKbkApp(A, { av = A?.avatar, efter = null } = {}) {
  injectStyle();
  const nr = kbkNr(av);
  if (!nr) return stamAv(A, av, efter);
  const inne = lagInne(), inneNr = new Set(inne.map((p) => p.kb));
  const body = `<div class="kb-head">${logga()}<div><p class="kb-du">${esc($t`Du är ${kbkEtikett(nr)}`)}</p><p>${$t('Kungsladugård i Pixelstaden')}</p></div></div>
    <div class="kb-rub">${$t('Inne i Pixelstaden nu')}</div>
    ${inne.length ? `<ul class="kb-inne">${inne.map((p) => `<li>${esc(kbkEtikett(p.kb))}${p.av?.name ? ` <small style="color:var(--muted)">(${esc(p.av.name)})</small>` : ''}</li>`).join('')}</ul>`
      : `<p class="kb-tom">${$t('Ingen lagkompis är inne just nu.')}</p>`}
    <div class="kb-rub">${$t('Laget')}</div>
    <div class="kb-laget">${KUNGS_PLAYERS.map(([n, namn]) => `<span class="kb-spel${n === nr ? ' jag' : ''}${inneNr.has(n) ? ' inne' : ''}"><b>${n}</b>${esc(namn)}</span>`).join('')}</div>
    <p class="kb-not">${$t('🔔 Du får en hälsning när en lagkompis hoppar in i Pixelstaden.')}</p>`;
  const dlg = openModal($t('⚽ KBK'), body, [
    { label: $t('Inte jag – ta bort'), onClick: () => { kbkTaBort(av); closeModal(); toast($t('⚽ Borttagen från laget i spelet.')); efter?.(); } },
    { label: $t('Stäng'), cls: 'btn-go', onClick: () => { closeModal(); efter?.(); } },
  ]);
  dlg.classList.add('dlg-kbk');
  return dlg;
}

// förnamn + nummer → stäms av mot laget
function stamAv(A, av, efter) {
  const dlg = openModal($t('⚽ Spelar du i KBK?'), `<div class="kb-head">${logga()}<p>${$t('Skriv ditt förnamn och ditt nummer i laget. Då får du en notis när en lagkompis kommer in i Pixelstaden.')}</p></div>
    <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:end">
      <label style="display:grid;gap:4px;font-size:var(--f2);flex:1 1 200px">${$t('Förnamn')}<input id="kbk-namn" type="text" maxlength="16" autocomplete="off" spellcheck="false" style="font:var(--f2) var(--font);padding:6px 8px;border:3px solid var(--ink)"></label>
      <label style="display:grid;gap:4px;font-size:var(--f2);flex:0 1 120px">${$t('Nummer')}<input id="kbk-nr" type="text" inputmode="numeric" maxlength="2" autocomplete="off" style="font:var(--f2) var(--font);padding:6px 8px;border:3px solid var(--ink)"></label>
    </div>
    <p class="kbk-fel" aria-live="polite" style="font-size:var(--f2);color:var(--red2);min-height:1em;margin-bottom:0"></p>`, [
    { label: $t('Avbryt'), onClick: () => { closeModal(); efter?.(); } },
    { label: $t('⚽ Stäm av'), cls: 'btn-go', onClick: () => klar() },
  ]);
  dlg.classList.add('dlg-kbk');
  const namn = dlg.querySelector('#kbk-namn'), nr = dlg.querySelector('#kbk-nr'), fel = dlg.querySelector('.kbk-fel');
  for (const i of [namn, nr]) { i.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') { e.preventDefault(); klar(); } }); i.addEventListener('keyup', (e) => e.stopPropagation()); }
  setTimeout(() => namn.focus(), 30);
  async function klar() {
    const p = kbkStammer(namn.value, nr.value);
    if (!p) { play('fel'); fel.textContent = $t('Det stämmer inte med laget. Kolla stavningen och numret på din tröja.'); return; }
    kbkSpara(av, p[0]);
    closeModal();
    play('ok');
    toast($t`⚽ Klart! Du är med som ${p[1]} ${p[0]} – du får en notis när en lagkompis kommer in.`, 'good');
    efter?.();
    await kbkFragaNotiser();
  }
  return dlg;
}
