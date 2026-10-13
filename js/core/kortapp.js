// 🃏 PIXELKORT-ALBUMET i mobilen (js/core/mobilen.js, appen 'kort'). En flik per serie: korten man har (×antal)
// och tomma platser för dem man saknar, hur långt man kommit och belöningen för en komplett serie. Klick på ett
// kort → stort kort med namn, sällsynthet och antal; dubbletter kan skickas till en vän (💛 Vänner → 🎁).
import { openModal, closeModal, esc } from './ui.js';
import { play } from './sound.js';
import { fmt } from '../game.js';
import { SERIER, RARITET, KORT, serieKort, kortById, kortBild, antalUnika, SERIE_PRIS, PAKET_PRIS } from './pixelkort.js';
import { $t } from './i18n.js';

let flik = SERIER[0].id;
export async function openKortApp(A) {
  const G = A.game, har = G.kort || {};
  play('click');
  const S = SERIER.find((s) => s.id === flik) || SERIER[0], lista = serieKort(S.id), n = lista.filter((k) => (har[k.id] | 0) > 0).length, klar = (G.kortSerier || []).includes(S.id);
  const flikar = SERIER.map((s) => { const m = serieKort(s.id), h = m.filter((k) => (har[k.id] | 0) > 0).length; return `<button class="btn btn-small ${s.id === S.id ? 'btn-gold' : ''}" data-flik="${s.id}">${s.icon} ${h}/${m.length}</button>`; }).join('');
  const rutor = lista.map((k) => `<div class="kt-ruta${(har[k.id] | 0) > 0 ? '' : ' kt-saknas'}" data-kort="${k.id}"><span class="kt-bild"></span>${(har[k.id] | 0) > 1 ? `<b class="kt-antal">×${har[k.id]}</b>` : ''}</div>`).join('');
  const dlg = openModal($t('🃏 Pixelkort'), `<div class="kt-flikar">${flikar}</div>
    <p style="font-size:var(--f2);margin:6px 0">${S.icon} <b>${esc(S.namn)}</b> · ${$t`${n} av ${lista.length}`}${klar ? ` · ${$t('✅ komplett!')}` : ` · ${$t`komplett serie = ${fmt(SERIE_PRIS)} + guldpokal`}`}</p>
    <div class="kt-grid">${rutor}</div>
    <p class="sp" style="font-size:var(--f2);margin-bottom:0">${$t`Totalt ${antalUnika(G)} av ${KORT.length} kort. Nya kort kommer i presenterna och i kortpaket (${fmt(PAKET_PRIS)}) vid kassan i leksaksaffären. Dubbletter kan du skicka till dina vänner.`}</p>`,
  [{ label: $t('Stäng'), cls: 'btn-go', onClick: closeModal }]);
  dlg.querySelectorAll('[data-flik]').forEach((b) => (b.onclick = () => { flik = b.dataset.flik; openKortApp(A); }));
  for (const el of dlg.querySelectorAll('[data-kort]')) {
    const id = el.dataset.kort, finns = (har[id] | 0) > 0;
    const c = await kortBild(id, { saknas: !finns });
    c.className = 'kt-cv'; el.querySelector('.kt-bild').append(c);
    if (finns) el.onclick = () => visaKort(A, id);
  }
}
async function visaKort(A, id) {
  const G = A.game, K = kortById(id), R = RARITET[K.rar], n = G.kort?.[id] | 0, S = SERIER.find((s) => s.id === K.serie);
  play('click');
  const dlg = openModal(`🃏 ${esc(K.namn)}`, `<div class="kt-stor"></div>
    <p style="font-size:var(--f2);text-align:center;margin:6px 0">${S.icon} ${esc(S.namn)} · <b style="color:${R.ram[1]}">${esc(R.namn)}</b> · ${$t`Du har ${n}`}</p>
    ${n > 1 ? `<p class="sp" style="font-size:var(--f2);text-align:center;margin:0">${$t('Dubbletter kan du ge bort: 💛 Vänner → 🎁 vid vännen → välj kortet.')}</p>` : ''}`,
  [{ label: $t('⬅️ Albumet'), onClick: () => openKortApp(A) }, { label: $t('Stäng'), cls: 'btn-go', onClick: closeModal }]);
  const c = await kortBild(id), o = document.createElement('canvas'); o.width = c.width * 5; o.height = c.height * 5;
  const g = o.getContext('2d'); g.imageSmoothingEnabled = false; g.drawImage(c, 0, 0, o.width, o.height);
  o.className = 'kt-storcv'; dlg.querySelector('.kt-stor').append(o);
}
