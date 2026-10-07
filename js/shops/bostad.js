// Bostadsbyrån: välj var du bor. Större bostad = insats + högre hyra,
// men bättre sömn. Första gången väljer man här var man ska bo.
import { openModal, closeModal, toast } from '../core/ui.js';
import { HOMES, fmt } from '../game.js';
import { play } from '../core/sound.js';
import { posterImage } from '../scenes/shop-bostad.js';
import { renderHomePreview } from '../scenes/room.js';
import { $t } from '../core/i18n.js';

const insats = (h) => (h.deposit ? fmt(h.deposit) : $t('gratis'));   // "Insats <b>…</b>" (nyckeln ska inte ha $t inuti mallen)

export function openHousing(A, { firstTime = false, onDone } = {}) {
  const g = A.game;
  const body = `<p style="font-size:var(--f2);margin-top:0">${firstTime
    ? $t('Var vill du bo? Lilla rummet är gratis att flytta in i – resten får du spara till.')
    : `💰 <b>${fmt(g.money)}</b> · ${$t('Hyran dras varje måndag morgon.')}`}</p>
    <div class="plist">${HOMES.map((h) => {
      const here = g.home === h.id, afford = g.money >= h.deposit;
      return `<div class="prow shoprow homerow ${here ? 'here' : ''}">
        <span class="homepic-wrap"><span data-pic="${h.id}" style="font-size:28px;text-align:center">${h.icon}</span>
          <button class="btn btn-small homelook" data-look="${h.id}" title="${$t('Se hur det ser ut inne')}">${$t('👁 Titta in')}</button></span>
        <span class="nm">${$t(h.name)}${here ? ` <small class="ok">${$t('← du bor här')}</small>` : ''}<br>
          <small class="sp">${h.desc}</small><br>
          <small class="sp">${$t`Insats <b>${insats(h)}</b> · hyra ${fmt(h.rent)}/vecka`}${h.restBonus > 0 ? ` · 😴 ${$t`+${h.restBonus} energi`}` : ''}${h.restBonus < 0 ? ` · <span class="bad">🥶 ${$t`−${Math.abs(h.restBonus)} energi`}</span>` : ''}</small></span>
        <button class="btn btn-small ${afford && !here ? 'btn-go' : ''}" data-move="${h.id}" ${here || !afford ? 'disabled' : ''}>${here ? $t('Hemma') : $t('Flytta hit')}</button>
      </div>`;
    }).join('')}</div>`;
  const dlg = openModal($t('🔑 Bostadsbyrån'), body,
    firstTime ? [] : [{ label: $t('Stäng'), onClick: closeModal }],
    { closable: !firstTime });
  // annonsbilderna: samma planscher som hänger på mäklarkontorets vägg, i pixelskala
  dlg.querySelectorAll('[data-pic]').forEach((el) => {
    try {
      const c = posterImage(el.dataset.pic);
      if (!c) return;
      c.className = 'homepic';
      const hn = $t(HOMES.find((h) => h.id === el.dataset.pic)?.name) || $t('bostaden');
      c.title = $t`Titta in i ${hn}`;
      c.style.cursor = 'pointer';
      c.onclick = () => lookInside(A, el.dataset.pic, { firstTime, onDone });
      el.replaceWith(c);
    } catch { /* bilden är bara pynt */ }
  });
  dlg.querySelectorAll('[data-look]').forEach((b) => (b.onclick = () => lookInside(A, b.dataset.look, { firstTime, onDone })));
  dlg.querySelectorAll('[data-move]').forEach((b) => (b.onclick = () => moveHome(A, b.dataset.move, onDone)));
  // första gången: husvagnen (startbostaden) är alltid valbar även utan pengar
  if (firstTime) {
    const first = dlg.querySelector('[data-move="husvagn"]');
    if (first) { first.disabled = false; first.classList.add('btn-go'); first.onclick = () => { g.home = 'husvagn'; g.save(); closeModal(); toast($t('🔑 Välkommen hem till husvagnen!'), 'good'); onDone?.(); }; }
  }
  return dlg;
}

// Skylten vid ett bostadshus man inte bor i (Carl: "det är väl bara hos mäklaren vi kan flytta"):
// vilken bostad det är, vad den kostar och att den hyrs ut via Bostadsbyrån. 👁 Titta in visar
// den inifrån (utan flyttknapp), 🔑 Till Bostadsbyrån går dit (toAgent från staden).
export function openHouseSign(A, b, { toAgent } = {}) {
  const g = A.game;
  const homes = (b?.homes || []).map((id) => HOMES.find((h) => h.id === id)).filter(Boolean);
  const reopen = () => openHouseSign(A, b, { toAgent });
  const rows = homes.map((h) => `<div class="prow shoprow homerow">
      <span class="homepic-wrap"><span data-pic="${h.id}" style="font-size:28px;text-align:center">${h.icon}</span>
        <button class="btn btn-small homelook" data-look="${h.id}" title="${$t('Se hur det ser ut inne')}">${$t('👁 Titta in')}</button></span>
      <span class="nm">${$t(h.name)}<br><small class="sp">${h.desc}</small><br>
        <small class="sp">${$t`Insats <b>${insats(h)}</b> · hyra ${fmt(h.rent)}/vecka`}${h.restBonus > 0 ? ` · 😴 ${$t`+${h.restBonus} energi`}` : ''}${h.restBonus < 0 ? ` · <span class="bad">🥶 ${$t`−${Math.abs(h.restBonus)} energi`}</span>` : ''}</small></span>
    </div>`).join('');
  const dlg = openModal(`${b?.icon || '🏠'} ${b?.sign || $t('Bostadshuset')}`, `
    <p style="font-size:var(--f2);margin-top:0">${homes.length ? $t('Här bor du inte – men här finns:') : $t('Här bor du inte.')}</p>
    ${rows ? `<div class="plist">${rows}</div>` : ''}
    <p style="font-size:var(--f2);margin-bottom:0">${$t('🔑 Vill du flytta hit? Det ordnar mäklaren på <b>Bostadsbyrån</b>.')}</p>`, [
    { label: $t('Okej'), onClick: closeModal },
    ...(toAgent ? [{ label: $t('🔑 Till Bostadsbyrån'), cls: 'btn-go', onClick: () => { closeModal(); toAgent(); } }] : []),
  ]);
  dlg.querySelectorAll('[data-pic]').forEach((el) => {
    try {
      const c = posterImage(el.dataset.pic);
      if (!c) return;
      c.className = 'homepic'; c.style.cursor = 'pointer';
      c.onclick = () => lookInside(A, el.dataset.pic, { back: reopen, noMove: true });
      el.replaceWith(c);
    } catch { /* bilden är bara pynt */ }
  });
  dlg.querySelectorAll('[data-look]').forEach((x) => (x.onclick = () => lookInside(A, x.dataset.look, { back: reopen, noMove: true })));
  return dlg;
}

function moveHome(A, id, onDone) {
  const g = A.game;
  const r = g.moveTo(id);
  if (!r.ok) { toast(r.msg, 'bad'); return; }
  closeModal();
  toast($t`🔑 Välkommen hem till ${$t(g.homeInfo.name)}!`, 'good');
  g.save();
  if (onDone) onDone();
  else A.go('room');
}

// 👁 Titta in: bilder inifrån bostaden som den ser ut när man flyttar in – varje delrum,
// dag eller kväll (room.js ritar dem med startmöbleringen). Tillbaka → listan igen.
function lookInside(A, id, opts) {
  const g = A.game, h = HOMES.find((x) => x.id === id);
  if (!h) return;
  play('click');
  let sub = 0, night = false;
  const here = g.home === id, afford = g.money >= h.deposit;
  const dlg = openModal(`👁 ${h.icon} ${$t(h.name)}`, `
    <p style="font-size:var(--f2);margin-top:0">${$t('Så här ser det ut när du flyttar in.')}</p>
    <div class="look-tabs" data-tabs></div>
    <div class="homelook-pic" data-view></div>
    <p class="sp" style="font-size:var(--f2);margin:6px 0 0">${$t`Insats <b>${insats(h)}</b> · hyra ${fmt(h.rent)}/vecka`}</p>`, [
    { label: opts.back ? $t('← Tillbaka') : $t('← Alla bostäder'), onClick: () => { closeModal(); if (opts.back) opts.back(); else openHousing(A, opts); } },
    ...(here || opts.noMove ? [] : [{ label: afford ? $t('🔑 Flytta hit') : $t`Insats ${fmt(h.deposit)}`, cls: afford ? 'btn-go' : '', onClick: () => { if (!afford) { toast($t`Du behöver ${fmt(h.deposit)} i insats.`, 'bad'); return; } moveHome(A, id, opts.onDone); } }]),
  ]);
  const view = dlg.querySelector('[data-view]'), tabs = dlg.querySelector('[data-tabs]');
  function draw() {
    let res = null;
    try { res = renderHomePreview(A, id, sub, { night }); } catch (e) { console.error('förhandsbilden:', e); }
    view.innerHTML = '';
    if (!res) { view.textContent = $t('Bilden gick inte att visa.'); return; }
    res.canvas.className = 'homelook-canvas';
    view.append(res.canvas);
    tabs.innerHTML = '';
    res.rooms.forEach((namn, i) => {
      const b = document.createElement('button');
      b.className = 'btn btn-small' + (i === sub ? ' btn-go' : '');
      b.textContent = $t(namn);   // delrummets namn (room.js PLANS, $n)
      b.onclick = () => { sub = i; play('click'); draw(); };
      tabs.append(b);
    });
    const dn = document.createElement('button');
    dn.className = 'btn btn-small';
    dn.textContent = night ? $t('☀️ Dag') : $t('🌙 Kväll');
    dn.onclick = () => { night = !night; play('click'); draw(); };
    tabs.append(dn);
  }
  draw();
}

