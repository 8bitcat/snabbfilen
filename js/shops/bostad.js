// Bostadsbyrån: välj var du bor. Större bostad = insats + högre hyra,
// men bättre sömn. Första gången väljer man här var man ska bo.
import { openModal, closeModal, toast } from '../core/ui.js';
import { HOMES, fmt } from '../game.js';
import { play } from '../core/sound.js';
import { posterImage } from '../scenes/shop-bostad.js';
import { renderHomePreview } from '../scenes/room.js';

export function openHousing(A, { firstTime = false, onDone } = {}) {
  const g = A.game;
  const body = `<p style="font-size:19px;margin-top:0">${firstTime
    ? 'Var vill du bo? Lilla rummet är gratis att flytta in i – resten får du spara till.'
    : `💰 <b>${fmt(g.money)}</b> · Hyran dras varje måndag morgon.`}</p>
    <div class="plist">${HOMES.map((h) => {
      const here = g.home === h.id, afford = g.money >= h.deposit;
      return `<div class="prow shoprow homerow ${here ? 'here' : ''}">
        <span class="homepic-wrap"><span data-pic="${h.id}" style="font-size:28px;text-align:center">${h.icon}</span>
          <button class="btn btn-small homelook" data-look="${h.id}" title="Se hur det ser ut inne">👁 Titta in</button></span>
        <span class="nm">${h.name}${here ? ' <small class="ok">← du bor här</small>' : ''}<br>
          <small class="sp">${h.desc}</small><br>
          <small class="sp">Insats <b>${h.deposit ? fmt(h.deposit) : 'gratis'}</b> · hyra ${fmt(h.rent)}/vecka${h.restBonus > 0 ? ` · 😴 +${h.restBonus} energi` : ''}${h.restBonus < 0 ? ` · <span class="bad">🥶 −${Math.abs(h.restBonus)} energi</span>` : ''}</small></span>
        <button class="btn btn-small ${afford && !here ? 'btn-go' : ''}" data-move="${h.id}" ${here || !afford ? 'disabled' : ''}>${here ? 'Hemma' : 'Flytta hit'}</button>
      </div>`;
    }).join('')}</div>`;
  const dlg = openModal('🔑 Bostadsbyrån', body,
    firstTime ? [] : [{ label: 'Stäng', onClick: closeModal }],
    { closable: !firstTime });
  // annonsbilderna: samma planscher som hänger på mäklarkontorets vägg, i pixelskala
  dlg.querySelectorAll('[data-pic]').forEach((el) => {
    try {
      const c = posterImage(el.dataset.pic);
      if (!c) return;
      c.className = 'homepic';
      c.title = 'Titta in i ' + (HOMES.find((h) => h.id === el.dataset.pic)?.name || 'bostaden');
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
    if (first) { first.disabled = false; first.classList.add('btn-go'); first.onclick = () => { g.home = 'husvagn'; g.save(); closeModal(); toast('🔑 Välkommen hem till husvagnen!', 'good'); onDone?.(); }; }
  }
  return dlg;
}

function moveHome(A, id, onDone) {
  const g = A.game;
  const r = g.moveTo(id);
  if (!r.ok) { toast(r.msg, 'bad'); return; }
  closeModal();
  toast(`🔑 Välkommen hem till ${g.homeInfo.name}!`, 'good');
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
  const dlg = openModal(`👁 ${h.icon} ${h.name}`, `
    <p style="font-size:19px;margin-top:0">Så här ser det ut när du flyttar in.</p>
    <div class="look-tabs" data-tabs></div>
    <div class="homelook-pic" data-view></div>
    <p class="sp" style="font-size:17px;margin:6px 0 0">Insats <b>${h.deposit ? fmt(h.deposit) : 'gratis'}</b> · hyra ${fmt(h.rent)}/vecka</p>`, [
    { label: '← Alla bostäder', onClick: () => { closeModal(); openHousing(A, opts); } },
    ...(here ? [] : [{ label: afford ? '🔑 Flytta hit' : `Insats ${fmt(h.deposit)}`, cls: afford ? 'btn-go' : '', onClick: () => { if (!afford) { toast(`Du behöver ${fmt(h.deposit)} i insats.`, 'bad'); return; } moveHome(A, id, opts.onDone); } }]),
  ]);
  const view = dlg.querySelector('[data-view]'), tabs = dlg.querySelector('[data-tabs]');
  function draw() {
    let res = null;
    try { res = renderHomePreview(A, id, sub, { night }); } catch (e) { console.error('förhandsbilden:', e); }
    view.innerHTML = '';
    if (!res) { view.textContent = 'Bilden gick inte att visa.'; return; }
    res.canvas.className = 'homelook-canvas';
    view.append(res.canvas);
    tabs.innerHTML = '';
    res.rooms.forEach((namn, i) => {
      const b = document.createElement('button');
      b.className = 'btn btn-small' + (i === sub ? ' btn-go' : '');
      b.textContent = namn;
      b.onclick = () => { sub = i; play('click'); draw(); };
      tabs.append(b);
    });
    const dn = document.createElement('button');
    dn.className = 'btn btn-small';
    dn.textContent = night ? '☀️ Dag' : '🌙 Kväll';
    dn.onclick = () => { night = !night; play('click'); draw(); };
    tabs.append(dn);
  }
  draw();
}

