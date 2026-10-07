// 🎯 LIVSMÅLEN (Carl 2026-10-01): valet av hur högt man siktar, översikten med hur långt man har
// kommit och firandet när alla fyra är nådda. Målen och lyckan räknas i game.js (MAL, malStatus,
// glad) – här är bara rutorna. Öppnas från 🎯 i HUD:en, från dagboken och vid första starten.
//   openGoals(A, { pick, first, onDone })  pick = välj nivåer (annars översikten)
//   goalsMini(g)                           kompakt rad till veckorutan
//   gladNattHtml(g)                        vad som ändrade lyckan i natt (veckorutan på morgonen)
//   celebrateGoals(A)                      den stora gratulationen
import { openModal, closeModal, esc } from './ui.js';
import { MAL, MAL_NIVAER, malTarget, malText, malNiva } from '../game.js';
import { play } from './sound.js';
import { $t } from './i18n.js';

const bar = (k, done) => `<span class="lm-bar ${done ? 'done' : ''}"><i style="width:${Math.round(Math.max(0, Math.min(1, k)) * 100)}%"></i></span>`;
const status = (s) => (s.key === 'karr' ? `${malText('karr', s.have)} / ${malText('karr', s.need)}` : s.key === 'rik' ? `${malText('rik', s.have)} / ${malText('rik', s.need)}` : `${s.have} / ${malText(s.key, s.need)}`);

export function openGoals(A, { pick = false, first = false, onDone = null } = {}) {
  const g = A.game;
  if (pick || !g.mal) return pickGoals(A, { first, onDone });
  const S = g.malStatus();
  const done = S.filter((s) => s.done).length;
  const rows = S.map((s) => `<div class="lm-row ${s.done ? 'ok' : ''}">
      <span class="lm-name">${s.icon} <b>${esc(s.name)}</b><small>${esc(MAL[s.key].blurb)}</small></span>
      <span class="lm-prog">${bar(s.k, s.done)}<b>${s.done ? '✓ ' : ''}${esc(status(s))}</b><small>${malNiva(s.niva).icon} ${malNiva(s.niva).name}</small></span>
    </div>`).join('');
  const head = g.malKlar ? `<p class="wk-ok" style="margin-top:0">${$t`🏆 Alla livsmål nådda dag ${g.malKlar}! Sikta högre om du vill – eller njut av livet i Pixelstaden.`}</p>`
    : `<p style="font-size:var(--f2);margin-top:0">${$t`<b>${done} av 4</b> mål nådda just nu. Du har klarat livet i Pixelstaden när <b>alla fyra</b> är nådda samtidigt.`}</p>`;
  const tips = gladTips(g);
  const dlg = openModal($t('🎯 Dina livsmål'), `<div class="lm">${head}${rows}${tips}</div>`, [
    { label: $t('✏️ Ändra nivåerna'), onClick: () => { closeModal(); pickGoals(A, { onDone }); } },
    { label: $t('Stäng'), cls: 'btn-go', onClick: () => { closeModal(); onDone?.(); } },
  ]);
  dlg.classList.add('dlg-goals');
  return dlg;
}

// vad man kan göra för att bli gladare (bara när lyckan behöver det)
function gladTips(g) {
  const l = Math.round(g.lycka);
  if (l >= 75) return `<p class="lm-tip">${$t`😊 Du är på strålande humör (${l})!`}</p>`;
  return `<p class="lm-tip">${$t`😊 Lyckan är <b>${l}</b>. Gladare blir du av bion, att klappa och leka med djuren, kompisar, nya kläder, en ledig dag och ett fint hem. Många pass i rad och husvagnen gör dig nere.`}</p>`;
}

function pickGoals(A, { first = false, onDone = null } = {}) {
  const g = A.game;
  const val = { ...(g.mal || { rik: 'normal', lycka: 'normal', utb: 'normal', karr: 'normal' }) };
  const rows = Object.values(MAL).map((M) => `<div class="lm-row lm-pick">
      <span class="lm-name">${M.icon} <b>${esc(M.name)}</b><small>${esc(M.blurb)}</small></span>
      <span class="lm-chips">${MAL_NIVAER.map((n) => `<button class="lm-chip" data-mal="${M.id}" data-niva="${n.id}">${n.icon} ${esc(malText(M.id, malTarget(M.id, n.id)))}</button>`).join('')}</span>
    </div>`).join('');
  const intro = first
    ? `<p style="font-size:var(--f2);margin-top:0">${$t('Hur högt siktar du? Välj ett mål för <b>rikedom, lycka, utbildning och karriär</b>. Du har klarat livet i Pixelstaden när alla fyra är nådda samtidigt – du kan ändra nivåerna senare med 🎯.')}</p>`
    : `<p style="font-size:var(--f2);margin-top:0">${$t('Välj hur högt du siktar i varje mål. Du har klarat livet i Pixelstaden när alla fyra är nådda samtidigt.')}</p>`;
  const presets = `<div class="lm-presets">${MAL_NIVAER.map((n) => `<button class="btn btn-small" data-alla="${n.id}">${n.icon} ${$t`Allt ${n.name.toLowerCase()}`}</button>`).join('')}</div>`;
  const dlg = openModal(first ? $t('🎯 Välj dina livsmål') : $t('🎯 Ändra livsmålen'), `<div class="lm">${intro}${presets}${rows}</div>`, [
    ...(first ? [] : [{ label: $t('Avbryt'), onClick: () => { closeModal(); onDone?.(); } }]),
    { label: $t('🎯 Det här siktar jag på!'), cls: 'btn-go', onClick: () => { g.setMal(val); play('ok'); closeModal(); onDone?.(); } },
  ], { closable: !first });
  dlg.classList.add('dlg-goals');
  const paint = () => dlg.querySelectorAll('.lm-chip').forEach((b) => b.classList.toggle('on', val[b.dataset.mal] === b.dataset.niva));
  dlg.querySelectorAll('.lm-chip').forEach((b) => (b.onclick = () => { val[b.dataset.mal] = b.dataset.niva; play('click'); paint(); }));
  dlg.querySelectorAll('[data-alla]').forEach((b) => (b.onclick = () => { for (const k of Object.keys(MAL)) val[k] = b.dataset.alla; play('click'); paint(); }));
  paint();
  return dlg;
}

// kompakt rad till veckorutan: fyra mål med en liten mätare var
export function goalsMini(g) {
  const S = g.malStatus();
  if (!S.length) return '';
  return `<div class="lm-mini">${S.map((s) => `<span class="${s.done ? 'ok' : ''}" title="${esc(s.name)}">${s.icon} ${bar(s.k, s.done)}<b>${s.done ? '✓' : esc(status(s))}</b></span>`).join('')}</div>`;
}

// vad som ändrade lyckan i natt (g.gladNatt, skrivs av Game.sleep)
export function gladNattHtml(g) {
  const L = (g.gladNatt || []).filter((x) => x.n);
  if (!L.length) return '';
  const sum = L.reduce((a, x) => a + x.n, 0);
  const parts = L.map((x) => `${esc(x.t)} <b class="${x.n > 0 ? 'up' : 'down'}">${x.n > 0 ? '+' : ''}${x.n}</b>`).join(' · ');
  return `<p class="lm-natt">${$t`😊 Lyckan i natt: ${parts} → <b>${Math.round(g.lycka)}</b>`}${sum ? '' : ''}</p>`;
}

export function celebrateGoals(A) {
  const g = A.game;
  play('fanfare');
  const rows = g.malStatus().map((s) => `<div class="lm-row ok"><span class="lm-name">${s.icon} <b>${esc(s.name)}</b></span><span class="lm-prog"><b>✓ ${esc(status(s))}</b><small>${malNiva(s.niva).icon} ${malNiva(s.niva).name}</small></span></div>`).join('');
  const jobbat = Object.values(g.jobs).reduce((a, b) => a + b, 0);
  const dlg = openModal($t('🏆 Du har klarat livet i Pixelstaden!'), `<div class="lm">
      <p style="font-size:var(--f2);margin-top:0">${$t`Alla fyra livsmålen på <b>${g.day} dagar</b> – från en rostig husvagn till ett riktigt liv!`}</p>
      ${rows}
      <p style="font-size:var(--f2)">${$t`🔨 Jobbade pass: <b>${jobbat}</b> · 🏠 ${esc(g.homeInfo.icon)} ${esc($t(g.homeInfo.name))}`}</p>
      <p style="font-size:var(--f2);margin-bottom:0">${$t('Staden är din – spela vidare, sikta högre med 🎯 eller bjud hem kompisarna! 🎉')}</p></div>`,
    [{ label: $t('🎉 Tack!'), cls: 'btn-go', onClick: closeModal }]);
  dlg.classList.add('dlg-goals');
  return dlg;
}
