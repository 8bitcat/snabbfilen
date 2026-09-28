// Huvudmenyn (och pausmenyn via ☰): staden lever och rör sig bakom en pixelpanel med
// NYTT SPEL, FORTSÄTT, alla skapade figurer med porträtt och sammanfattning (pengar,
// bostad, dag), samt inställningar (ljud, musik, mätare). Varje figur har sin egen
// sparning: den aktiva ligger som vanligt i 'snabbfilen_save1', de andra parkeras under
// 'snabbfilen_save:<namn>'. Byte av figur = parkera nuvarande, hämta den andra, ladda om.
import { listAvatars, loadAvatar, saveAvatar, deleteAvatar, avatarPortrait, avatarColor, openAvatarEditor } from './avatar.js';
import { isMuted, toggleMute, play } from './sound.js';
import { isMusicOn, setMusic, musicTick } from './music.js';
import { hudMode, setHudMode } from './hud-pix.js';
import { openModal, closeModal, esc } from './ui.js';
import { HOMES, JOBS, fmt, SAVE_KEY } from '../game.js';
import { VERSION } from '../version.js';
import { openNews, makeBackup } from './version-ui.js';

const SKIP = 'sf_menu_skip';
const slug = (name) => String(name || '').toLowerCase().replace(/[^a-z0-9åäö]/g, '').slice(0, 24);
const saveKeyOf = (name) => 'snabbfilen_save:' + slug(name);
const ls = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* ok */ } },
  del(k) { try { localStorage.removeItem(k); } catch { /* ok */ } },
};

// Den aktiva figurens sparning speglas till dess egen nyckel, så att ett byte aldrig
// tappar något (spelet självt skriver bara till SAVE_KEY).
export function parkCurrentSave() {
  const av = loadAvatar();
  const raw = ls.get(SAVE_KEY);
  if (av.name && raw) ls.set(saveKeyOf(av.name), raw);
}
function summaryOf(name, isCurrent) {
  let raw = isCurrent ? ls.get(SAVE_KEY) : ls.get(saveKeyOf(name));
  if (!raw && isCurrent) raw = ls.get(saveKeyOf(name));
  if (!raw) return null;
  try {
    const p = JSON.parse(raw);
    const home = HOMES.find((h) => h.id === p.home);
    const shifts = Object.values(p.jobs || {}).reduce((a, b) => a + (b | 0), 0);
    return { money: Math.round(+p.money || 0), home: home ? `${home.icon} ${home.name}` : '🏠 ' + (p.home || '?'), day: p.day | 0, shifts, won: !!p.won };
  } catch { return null; }
}

let open = false, root = null, A = null, opts = {};
export const isMenuOpen = () => open;
export function shouldShowMenuAtBoot() {
  const q = new URLSearchParams(location.search);
  let skip = null;
  try { skip = sessionStorage.getItem(SKIP); sessionStorage.removeItem(SKIP); } catch { /* ok */ }
  if (skip) return false; // vi kommer från ett figurbyte/omstart i menyn – rakt in i spelet
  if (q.has('menu')) return true;
  if (q.has('nomenu')) return false;
  return !navigator.webdriver; // testrobotarna får det gamla flödet
}
function reloadInto() {
  try { sessionStorage.setItem(SKIP, '1'); } catch { /* ok */ }
  location.reload();
}

// ---------- byten ----------
function switchTo(av) {
  parkCurrentSave();
  const raw = ls.get(saveKeyOf(av.name));
  if (raw) ls.set(SAVE_KEY, raw); else ls.del(SAVE_KEY);
  saveAvatar(av);
  reloadInto();
}
function newGame() {
  openAvatarEditor({
    fresh: true,
    onDone: (av) => {
      parkCurrentSave();
      const existing = ls.get(saveKeyOf(av.name));
      const go = () => { ls.del(SAVE_KEY); ls.del(saveKeyOf(av.name)); saveAvatar(av); reloadInto(); };
      if (existing) {
        openModal('Börja om?', `<p>Det finns redan en figur som heter <b>${esc(av.name)}</b> med ett påbörjat spel. Vill du börja om från början med den?</p><p>Det gamla spelet läggs bland säkerhetskopiorna (versionsknappen) om du ångrar dig.</p>`, [
          { label: 'Avbryt', onClick: () => { closeModal(); render(); } },
          { label: 'Börja om', cls: 'btn-red', onClick: () => { makeBackup(`före omstart av ${av.name}`); closeModal(); go(); } },
        ]);
      } else go();
    },
    onCancel: () => render(),
  });
}
function restartCurrent(av) {
  openModal('🔄 Börja om från början?', `<p><b>${esc(av.name)}</b> börjar om i Lilla rummet med startpengarna. Pengar, kläder, möbler och allt annat försvinner.</p><p>En säkerhetskopia läggs under versionsknappen om du ångrar dig.</p>`, [
    { label: 'Avbryt', onClick: () => closeModal() },
    { label: '🔄 Börja om', cls: 'btn-red', onClick: () => { makeBackup(`före omstart av ${av.name}`); ls.del(SAVE_KEY); ls.del(saveKeyOf(av.name)); closeModal(); reloadInto(); } },
  ]);
}
function removeAvatar(av, isCurrent) {
  openModal('🗑 Ta bort figuren?', `<p><b>${esc(av.name)}</b> och hens spel tas bort helt.</p>`, [
    { label: 'Avbryt', onClick: () => closeModal() },
    { label: 'Ta bort', cls: 'btn-red', onClick: () => {
      makeBackup(`före borttagning av ${av.name}`);
      ls.del(saveKeyOf(av.name));
      if (isCurrent) ls.del(SAVE_KEY);
      deleteAvatar(av.name);
      closeModal();
      if (isCurrent) reloadInto(); else render();
    } },
  ]);
}

// ---------- rendering ----------
let selected = null, showSettings = false;
function render() {
  if (!root) return;
  const list = listAvatars();
  const cur = loadAvatar();
  const curName = cur.name || '';
  if (!selected || !list.some((a) => a.name === selected)) selected = curName || list[0]?.name || null;
  const sel = list.find((a) => a.name === selected) || null;
  const paused = !!opts.pause;
  const canContinue = !!sel;
  const contLabel = !sel ? '▶ Fortsätt' : paused && sel.name === curName ? '▶ Fortsätt spela' : `▶ Fortsätt som ${esc(sel.name)}`;
  const cards = list.map((a) => {
    const isCur = a.name === curName;
    const s = summaryOf(a.name, isCur);
    const sum = s ? `${fmt(s.money)} · ${s.home} · dag ${s.day}${s.shifts ? ` · ${s.shifts} pass` : ''}${s.won ? ' · 🏆' : ''}` : 'Nytt liv – inte börjat än';
    return `<div class="menu-card ${a.name === selected ? 'on' : ''}" data-pick="${esc(a.name)}" style="--pc:${esc(avatarColor(a))}">
      <span class="menu-face" data-face="${esc(a.name)}"></span>
      <span class="menu-card-txt"><b>${esc(a.name)}${isCur ? ' <i class="nu">spelar nu</i>' : ''}</b><small>${sum}</small></span>
      <span class="menu-card-tools">
        <button class="btn btn-small" data-edit="${esc(a.name)}" title="Ändra utseende">✏️</button>
        ${isCur ? `<button class="btn btn-small" data-restart="${esc(a.name)}" title="Börja om från början">🔄</button>` : ''}
        <button class="btn btn-small" data-del="${esc(a.name)}" title="Ta bort">🗑</button>
      </span>
    </div>`;
  }).join('');
  root.innerHTML = `<div class="menu-panel ${paused ? 'paused' : ''}">
    <div class="menu-title"><span>SNABBFILEN</span><small>${paused ? 'Paus' : 'Livet i Pixelstaden'}</small></div>
    <div class="menu-btns">
      <button class="btn btn-go menu-main" data-new>🆕 Nytt spel</button>
      <button class="btn menu-main ${canContinue ? 'btn-gold' : ''}" data-continue ${canContinue ? '' : 'disabled'}>${contLabel}</button>
      <button class="btn menu-main" data-settings>⚙ Inställningar${showSettings ? ' ▲' : ''}</button>
    </div>
    <div class="menu-settings ${showSettings ? '' : 'hidden'}">
      <div class="menu-row"><span>🔊 Ljud</span><button class="btn btn-small ${isMuted() ? '' : 'btn-go'}" data-sound>${isMuted() ? 'AV' : 'PÅ'}</button></div>
      <div class="menu-row"><span>🎵 Musik</span><button class="btn btn-small ${isMusicOn() ? 'btn-go' : ''}" data-music>${isMusicOn() ? 'PÅ' : 'AV'}</button></div>
      <div class="menu-row"><span>📊 Mätare</span><button class="btn btn-small" data-hud>${hudMode() === 'pix' ? 'PIXEL uppe till vänster' : 'RAD överst'}</button></div>
    </div>
    <div class="menu-sub">${list.length ? 'Vem spelar?' : 'Inga figurer än – tryck på Nytt spel!'}</div>
    <div class="menu-cards">${cards}</div>
    <div class="menu-foot"><button class="btn btn-small" data-news>v${esc(VERSION)} · Nyheter</button>${paused ? '<span class="menu-hint">Esc stänger</span>' : ''}</div>
  </div>`;
  root.querySelectorAll('[data-face]').forEach((el) => { const a = list.find((x) => x.name === el.dataset.face); if (a) el.replaceWith(avatarPortrait(a, 56)); });
  root.querySelectorAll('.menu-card').forEach((c) => (c.onclick = (e) => { if (e.target.closest('button')) return; play('click'); if (selected === c.dataset.pick) startWith(list.find((a) => a.name === selected)); else { selected = c.dataset.pick; render(); } }));
  root.querySelector('[data-new]').onclick = () => { play('click'); newGame(); };
  root.querySelector('[data-continue]').onclick = () => { if (sel) { play('click'); startWith(sel); } };
  root.querySelector('[data-settings]').onclick = () => { play('click'); showSettings = !showSettings; render(); };
  root.querySelector('[data-news]').onclick = () => openNews();
  root.querySelector('[data-sound]')?.addEventListener('click', () => { const m = toggleMute(); musicTick(); const b = document.getElementById('hud-mute'); if (b) b.textContent = m ? '🔇' : '🔊'; render(); });
  root.querySelector('[data-music]')?.addEventListener('click', () => { setMusic(!isMusicOn()); play('click'); render(); });
  root.querySelector('[data-hud]')?.addEventListener('click', () => { setHudMode(hudMode() === 'pix' ? 'rad' : 'pix'); play('click'); render(); });
  root.querySelectorAll('[data-edit]').forEach((b) => (b.onclick = () => {
    const a = list.find((x) => x.name === b.dataset.edit);
    if (a.name !== curName) { switchTo(a); return; } // bytet laddar om; redigera hemma i garderoben
    openAvatarEditor({ onDone: (av) => { A.avatar = av; render(); }, onCancel: () => render() });
  }));
  root.querySelectorAll('[data-restart]').forEach((b) => (b.onclick = () => restartCurrent(list.find((x) => x.name === b.dataset.restart))));
  root.querySelectorAll('[data-del]').forEach((b) => (b.onclick = () => removeAvatar(list.find((x) => x.name === b.dataset.del), b.dataset.del === curName)));
}
function startWith(av) {
  if (!av) return;
  const cur = loadAvatar();
  if (av.name !== cur.name) { switchTo(av); return; }
  close();
  opts.onStart?.();
}

// ---------- öppna/stänga ----------
export function openMenu(app, o = {}) {
  A = app; opts = o;
  if (!root) {
    root = document.createElement('div');
    root.id = 'menu';
    document.body.append(root);
    window.addEventListener('keydown', (e) => { if (open && opts.pause && e.key === 'Escape') { e.stopImmediatePropagation(); close(); opts.onStart?.(); } }, true);
  }
  open = true;
  showSettings = false;
  selected = loadAvatar().name || null;
  document.body.classList.add('menu-open');
  document.body.classList.toggle('menu-boot', !o.pause);
  root.classList.remove('hidden');
  render();
}
export function close() {
  open = false;
  document.body.classList.remove('menu-open', 'menu-boot');
  root?.classList.add('hidden');
}
export function mountMenuButton(app) {
  const host = document.querySelector('#hud .hud-btns');
  if (!host || document.getElementById('hud-menu')) return;
  const b = document.createElement('button');
  b.id = 'hud-menu'; b.className = 'btn btn-small'; b.title = 'Meny';
  b.textContent = '☰';
  b.onclick = () => { if (open) { close(); return; } openMenu(app, { pause: true, onStart: () => {} }); };
  host.prepend(b);
}
// spegla sparningen regelbundet och innan sidan lämnas
setInterval(parkCurrentSave, 15000);
window.addEventListener('pagehide', parkCurrentSave);
window.addEventListener('sf:before-reload', parkCurrentSave);
