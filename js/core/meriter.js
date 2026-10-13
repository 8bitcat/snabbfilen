// 🏆 MERITERNA och TROFÉSKÅPET ("bygg allting" 2026-10-12: troféhylla) – spelet minns vad man har vunnit:
//   • en merit = pokal/rosett/medalj från utställningen (katt, hund), kaninhoppningen, agilitycupen och Best in Show
//     (js/scenes/utstallning.js belona), hinderbanan i landet (game.js hoppResultat), en komplett pixelkortsserie
//     (js/core/pixelkort.js) och det lösta mysteriet (js/core/mysterium.js). Sparas i g.meriter
//     [{ typ, plats, klass, vem, dag, t }] (game.js merit, högst 150).
//   • den första meriten ger ett troféskåp gratis (möbeln 'trofeskap'). Skåpet visar de tolv senaste bakom glas –
//     pokaler, rosetter och medaljer i guld, silver och brons (js/core/visning.js ritar det i möbelarkets extra rad).
//   • ett tryck på skåpet hemma (room.js, funktionen 'meriter') öppnar "Mina meriter": allt man har vunnit.
import { $t } from './i18n.js';
import { openModal, closeModal, esc } from './ui.js';
import { HOPPKLASSER } from '../game.js';
import { SERIER } from './pixelkort.js';

export const MERIT = {
  katt: { icon: '🐈', namn: $t('Kattutställning'), form: 'pokal' },
  hund: { icon: '🐕', namn: $t('Hundutställning'), form: 'pokal' },
  kanin: { icon: '🐇', namn: $t('Kaninhoppning'), form: 'rosett' },
  agility: { icon: '🐕', namn: $t('Agilitycupen'), form: 'medalj' },
  bis: { icon: '✨', namn: $t('Best in Show'), form: 'stjarna' },
  hopp: { icon: '🏇', namn: $t('Hinderbanan'), form: 'rosett' },
  kort: { icon: '🃏', namn: $t('Pixelkort – komplett serie'), form: 'stjarna' },
  mysterium: { icon: '🕵️', namn: $t('Mästerdetektiv – Kattstatyns krona'), form: 'medalj' },
  fiske: { icon: '🎣', namn: $t('Fiskemästare – alla arter på Solön'), form: 'pokal' },
  uppfodare: { icon: '🐾', namn: $t('Uppfödare – fem djur sålda på djurNET'), form: 'stjarna' },
};
const MEDALJ = ['🥇', '🥈', '🥉'];
const klassNamn = (m) => (m.typ === 'hopp' ? HOPPKLASSER.find((k) => k.id === m.klass)?.namn
  : m.typ === 'kort' ? SERIER.find((s) => s.id === m.klass)?.namn
    : m.typ === 'bis' ? MERIT[m.klass]?.namn : '') || '';

export function openMeriter(A) {
  const lista = (Array.isArray(A.game?.meriter) ? A.game.meriter : []).slice().reverse();
  const n = [1, 2, 3].map((p) => lista.filter((m) => m.plats === p).length);
  const rad = (m) => {
    const M = MERIT[m.typ] || { icon: '🏆', namn: m.typ }, k = klassNamn(m);
    return `<div class="prow mer-rad"><span class="mer-medalj">${MEDALJ[m.plats - 1] || '🏅'}</span>
      <span class="nm">${M.icon} ${esc(M.namn)}${k ? ` <small>· ${esc(k)}</small>` : ''}<br><small class="sp">${m.vem ? `${esc(m.vem)} · ` : ''}${esc($t`dag ${m.dag}`)}</small></span><span></span></div>`;
  };
  openModal($t('🏆 Mina meriter'), lista.length
    ? `<p style="font-size:var(--f2);margin-top:0">🥇 ${n[0]} · 🥈 ${n[1]} · 🥉 ${n[2]} — ${$t`${lista.length} meriter i troféskåpet.`}</p><div class="plist">${lista.map(rad).join('')}</div>`
    : `<p style="font-size:var(--f2);margin-top:0">${$t('Troféskåpet är tomt än.')}</p><p style="font-size:var(--f2)">${$t('Tävla på utställningen och i agility i Tassbacken, i kaninhoppning eller på hinderbanan i landet – eller samla en hel serie pixelkort. Allt du vinner hamnar här.')}</p>`,
  [{ label: $t('Stäng'), cls: 'btn-go', onClick: closeModal }]);
}
