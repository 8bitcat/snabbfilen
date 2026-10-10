// 📱 MOBILEN – Carl 2026-10-10 valde förslag A ur "Pixelstadens nya meny" (artefakten ES3Fk9MpgCJSxZpbAMncEn):
// "nu är det för många knappar högst uppe … kanske gömda bakom en knapp … ljud och sånt hör ju till
// inställningarna". I stället för 12–15 knappar i raden överst samlas allt i figurens mobil nere till höger.
//
//   • Raden överst visar bara mätarna. De gamla knapparna (#hud .hud-btns) finns kvar men är dolda – de är
//     mobilens "motor": varje app trycker på sin gamla knapp, så karta, taxi, kompisar, chatt, röst,
//     livsmål, veckan, dagboken och nyheterna fungerar precis som förut.
//   • Inställningar öppnar spelmenyn med inställningarna utfällda (ljud, musik, zoom, språk, mätare,
//     notiser, startguiden). Där finns också Nytt spel, figurerna och versionen.
//   • Knapparna som bara gäller där man är – 🚲 åka/gå, 🎉 fest, 🎭 dräktens rörelse – står som
//     snabbknappar ovanför mobilen (#hud-snabb) och syns när de passar, som förut.
//   • En grön siffra på mobilen = kompisar i Pixelstaden, en röd prick = en ny version eller nyheter.
//   • Esc eller ett tryck utanför stänger mobilen.
import { $t } from './i18n.js';
import { play } from './sound.js';
import { ikonURL } from './pixikon.js';
import { openMenu, isMenuOpen } from './menu.js';
import { modalOpen } from './ui.js';
import { clock } from '../game.js';

const APPAR = [
  { id: 'karta', src: 'hud-map', ik: 'karta', namn: $t('Karta') },
  { id: 'taxi', src: 'hud-taxi', ik: 'taxi', namn: $t('Taxi') },
  { id: 'kompisar', src: 'hud-friends', ik: 'kompisar', namn: $t('Kompisar') },
  { id: 'chatt', src: 'hud-chat', ik: 'chatt', namn: $t('Chatt') },
  { id: 'rost', src: 'hud-voice', ik: 'rost', namn: $t('Röst') },
  { id: 'mal', src: 'hud-goals', ik: 'mal', namn: $t('Livsmål') },
  { id: 'vecka', src: 'hud-week', ik: 'vecka', namn: $t('Veckan') },
  { id: 'dagbok', src: 'hud-diary', ik: 'dagbok', namn: $t('Dagboken') },
  { id: 'nyheter', src: 'hud-version', ik: 'nyheter', namn: $t('Nyheter') },
  { id: 'installningar', ik: 'kugge', namn: $t('Inställningar') },
];
const SNABB = ['hud-fordon', 'hud-fest', 'hud-drakt'];   // knapparna som byts efter platsen

let A = null, knapp = null, panel = null, skugga = null, snabb = null, oppen = false;

export const mobilOppen = () => oppen;
export function openMobil() { if (!panel || oppen) return; oppen = true; play('click'); uppdatera(); panel.classList.remove('hidden'); skugga.classList.remove('hidden'); knapp.classList.add('on'); }
export function closeMobil() { if (!oppen) return; oppen = false; panel.classList.add('hidden'); skugga.classList.add('hidden'); knapp.classList.remove('on'); }

function app(a) {
  closeMobil();
  if (a.id === 'installningar') { openMenu(A, { pause: true, settings: true, onStart: () => {} }); return; }
  document.getElementById(a.src)?.click();
}

export function mountMobilen(app0) {
  A = app0;
  if (knapp || typeof document === 'undefined') return;
  knapp = document.createElement('button');
  knapp.id = 'hud-mobil'; knapp.className = 'btn'; knapp.type = 'button';
  knapp.title = $t('Mobilen: karta, taxi, kompisar, chatt, livsmål och inställningar');
  knapp.innerHTML = `<img class="pix-ik" src="${ikonURL('telefon')}" alt=""><span class="mob-badge kompis hidden"></span><span class="mob-badge ny hidden">!</span>`;
  knapp.onclick = () => (oppen ? closeMobil() : openMobil());
  skugga = document.createElement('div');
  skugga.id = 'mobilen-skugga'; skugga.className = 'hidden';
  skugga.onclick = closeMobil;
  panel = document.createElement('div');
  panel.id = 'mobilen'; panel.className = 'hidden';
  panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-label', $t('Mobilen'));
  panel.innerHTML = `<div class="mob-topp"><span>${$t('PIXELFON')}</span><span class="mob-prick">●●●</span></div>
    <div class="mob-skarm"><div class="mob-status"><span data-mob="klocka"></span><span data-mob="dag"></span><span>▮▮▮</span></div>
    <div class="mob-appar">${APPAR.map((a) => `<button type="button" class="mob-app" data-app="${a.id}"><span class="mob-ruta"><img class="pix-ik" src="${ikonURL(a.ik)}" alt=""><span class="mob-badge hidden" data-badge="${a.id}"></span></span><span class="mob-namn">${a.namn}</span></button>`).join('')}</div></div>
    <div class="mob-hem"></div>`;
  panel.querySelectorAll('[data-app]').forEach((b) => (b.onclick = () => app(APPAR.find((a) => a.id === b.dataset.app))));
  snabb = document.createElement('div');
  snabb.id = 'hud-snabb';
  document.body.append(skugga, panel, snabb, knapp);
  window.addEventListener('keydown', (e) => { if (oppen && e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeMobil(); } }, true);
  setInterval(uppdatera, 400);
  uppdatera();
}

// var fjärde tiondels sekund: snabbknapparna på plats, siffrorna, klockan – och stäng när något annat öppnas
function uppdatera() {
  if (!knapp) return;
  for (const id of SNABB) { const b = document.getElementById(id); if (b && b.parentElement !== snabb) snabb.append(b); }
  if (oppen && (modalOpen() || isMenuOpen() || A?.attract)) closeMobil();
  // kompisar: #hud-friends visar "👥 N" (N = alla online, en själv inräknad)
  const n = Math.max(0, (parseInt((document.getElementById('hud-friends')?.textContent || '').replace(/\D+/g, ''), 10) || 1) - 1);
  const ny = !!document.getElementById('hud-version')?.classList.contains('ny');
  const rost = document.getElementById('hud-voice');
  const rostPa = !!rost && (rost.classList.contains('voice-on') || rost.classList.contains('voice-muted'));
  const sk = knapp.querySelector('.kompis');
  sk.classList.toggle('hidden', !n); if (n && sk.textContent !== String(n)) sk.textContent = String(n);
  knapp.querySelector('.ny').classList.toggle('hidden', !ny);
  if (!oppen) return;
  const badge = (id, txt) => { const el = panel.querySelector(`[data-badge="${id}"]`); if (!el) return; el.classList.toggle('hidden', !txt); if (txt && el.textContent !== txt) el.textContent = txt; };
  badge('kompisar', n ? String(n) : '');
  badge('nyheter', ny ? $t('NY') : '');
  badge('rost', rostPa ? $t('PÅ') : '');
  const g = A?.game;
  if (g) {
    panel.querySelector('[data-mob="klocka"]').textContent = clock(g.min);
    panel.querySelector('[data-mob="dag"]').textContent = $t`${g.dayName} · dag ${g.day}`;
  }
}
