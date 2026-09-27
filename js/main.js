// Snabbfilen – bootstrap. En canvas (384×216 logiska pixlar, CSS-skalad),
// scener för staden/rummet/jobben, DOM-HUD överst och en vanlig rAF-loop.
import { loadAvatar, openAvatarPicker, avatarPortrait, setAvatarLocks } from './core/avatar.js';
import { openModal, closeModal, toast, modalOpen, esc } from './core/ui.js';
import { Game, SAVE_KEY, WIN_MONEY, JOBS, JOB_TITLES, SORTIMENT, FURNITURE, levelOf, fmt, clock } from './game.js';
import { makeCity } from './scenes/city.js';
import { makeRoom } from './scenes/room.js';
import { makeSorter, SORTER_SKINS } from './jobs/sorter.js';
import { makePacker } from './jobs/packer.js';
import { startJobFlow } from './jobs/shift.js';
import { openFoodShop } from './shops/matbutik.js';
import { openHousing } from './shops/bostad.js';
import { openKladaffar } from './shops/kladaffar.js';
import { startWorld, worldTick, worldInfo, playersList, visitPlayer, sendEmote, worldFolksHere } from './net/world.js';
import { play, unlockAudio, toggleMute, isMuted } from './core/sound.js';

const $ = (s) => document.querySelector(s);
const cv = $('#scene'), ctx = cv.getContext('2d');

// Appkontexten som alla scener får: tillstånd + navigering.
const A = {
  W: 384, H: 216,
  game: null, avatar: null,
  scene: null, sceneName: '',
  go(name, opts) {
    A.scene?.exit?.();
    A.sceneName = name;
    A.scene = SCENES[name](A, opts);
    A.scene.enter?.();
  },
  openFoodShop: () => openFoodShop(A),
  openHousing: (opts) => openHousing(A, opts),
  openKladaffar: () => openKladaffar(A),
  openFriends: () => openWorldDialog(),
  startJob: (jobId) => startJobFlow(A, jobId, ENGINES[jobId]),
  // världen (även för tools/smoke.mjs)
  visitTarget: null,
  worldInfo,
  playersList,
  visitPlayer: (id) => visitPlayer(A, id),
  sendEmote: (e) => sendEmote(A, e),
  worldFolksHere: () => worldFolksHere(A),
};

const SCENES = {
  city: (a, o) => makeCity(a, o),
  room: (a, o) => makeRoom(a, o),
  visit: (a) => makeRoom(a, { visit: true }),
  flygplats: (a, o) => makeSorter(a, SORTER_SKINS.flygplats, o),
  klader: (a, o) => makeSorter(a, SORTER_SKINS.klader, o),
  frukt: (a, o) => makePacker(a, o),
};
const ENGINES = { flygplats: 'flygplats', klader: 'klader', frukt: 'frukt' };

// ---------- skala canvasen till fönstret ----------
function fit() {
  const w = window.innerWidth, h = window.innerHeight - $('#hud').offsetHeight;
  let s = Math.min(w / A.W, h / A.H);
  if (s >= 2) s = Math.floor(s);
  cv.style.width = A.W * s + 'px';
  cv.style.height = A.H * s + 'px';
}
window.addEventListener('resize', fit);

// ---------- pekare: mus + touch till logiska pixlar ----------
function toLocal(e) {
  const r = cv.getBoundingClientRect();
  return { x: (e.clientX - r.left) / r.width * A.W, y: (e.clientY - r.top) / r.height * A.H };
}
cv.addEventListener('pointerdown', (e) => { if (modalOpen()) return; cv.setPointerCapture(e.pointerId); const p = toLocal(e); A.scene?.down?.(p.x, p.y); });
cv.addEventListener('pointermove', (e) => { if (modalOpen()) return; const p = toLocal(e); A.scene?.move?.(p.x, p.y); });
cv.addEventListener('pointerup', (e) => { if (modalOpen()) return; const p = toLocal(e); A.scene?.up?.(p.x, p.y); });
window.addEventListener('keydown', (e) => {
  if (modalOpen() || e.ctrlKey || e.altKey || e.metaKey) return;
  A.scene?.key?.(e.key);
});

// ---------- HUD (DOM) ----------
let hudKey = '';
function renderHud() {
  const g = A.game;
  const online = worldInfo().online;
  const nearby = worldFolksHere(A).length;
  $('#emotes').classList.toggle('hidden', nearby === 0);
  const key = `${g.day}|${Math.floor(g.min)}|${g.money}|${Math.round(g.hunger)}|${Math.round(g.energy)}|${A.avatar?.name}|${online}`;
  if (key === hudKey) return;
  hudKey = key;
  $('#hud-friends').textContent = online > 1 ? `👥 ${online}` : '👥';
  $('#hud-day').textContent = `📅 ${g.dayName} · dag ${g.day}`;
  $('#hud-clock').textContent = `🕒 ${clock(g.min)}`;
  const money = $('#hud-money');
  money.textContent = `💰 ${fmt(g.money)}`;
  money.classList.toggle('debt', g.money < 0);
  setBar('#bar-hunger', g.hunger);
  setBar('#bar-energy', g.energy);
  $('#hud-name').textContent = A.avatar?.name || '';
}
function setBar(sel, v) {
  const el = $(sel);
  el.style.width = Math.max(0, Math.min(100, v)) + '%';
  el.className = v <= 20 ? 'low' : v <= 45 ? 'mid' : '';
}

// Vaknade du på gatan i natt? (passTime satte flaggan)
function checkCollapse() {
  const g = A.game;
  if (!g.collapsed) return;
  g.collapsed = false;
  A.go('room');
  openModal('😵 Utmattad!', `<p style="font-size:20px">Du somnade där du stod och vaknar hemma – stel, hungrig och inte alls utvilad. Gå och lägg dig i tid nästa gång!</p>`,
    [{ label: 'Aj då', cls: 'btn-go', onClick: closeModal }]);
}

// ---------- sova / äta / hyra (öppnas från rummet) ----------
A.sleepFlow = () => {
  const g = A.game;
  const monday = g.day % 7 === 0; // i natt blir det måndag → hyra i morgon bitti
  openModal('😴 Sova', `<p style="font-size:20px">Sova till i morgon 07:00?</p>
    ${g.hunger < 30 ? '<p style="font-size:18px" class="bad">Du är hungrig – du sover dåligt på tom mage.</p>' : ''}
    ${monday ? `<p style="font-size:18px">💸 I morgon är det måndag: hyran ${fmt(g.homeInfo.rent)} dras.</p>` : ''}`, [
    { label: 'Inte än', onClick: closeModal },
    { label: '😴 Sov', cls: 'btn-go', onClick: () => {
      closeModal();
      play('sleep');
      const { rent, eventText } = g.sleep();
      setTimeout(() => play('morning'), 600);
      toast(`☀️ God morgon! ${g.dayName}, dag ${g.day}.`, 'good');
      if (rent) toast(`💸 Hyra betald: ${fmt(rent)}`, g.money < 0 ? 'bad' : '');
      if (g.money < 0) toast('⚠️ Du är skyldig hyresvärden pengar – jobba ihop dem!', 'bad');
      if (eventText) setTimeout(() => toast(eventText, 'good'), 900);
    } },
  ]);
};

// 👥 Onlinelistan: alla i världen, med "Åk dit"-knapp. Ingen kod – öppen värld.
function openWorldDialog() {
  const info = worldInfo();
  const list = playersList();
  const place = (s) => (s === 'city' ? '🏙️ i staden' : String(s).startsWith('home:') ? '🏠 hemma' : '💼 upptagen');
  const rows = list.map((p, i) => `<div class="prow">
      <span data-face="${i}"></span>
      <span class="nm">${esc(p.av.name || '?')}<br><small class="sp">${place(p.scene)}</small></span>
      <button class="btn btn-small btn-go" data-visit="${esc(p.id)}">🚗 Åk dit</button>
    </div>`).join('');
  const dlg = openModal('👥 Pixelstaden online', `
    <p style="font-size:19px;margin-top:0">${info.open ? `<b>${info.online}</b> ${info.online === 1 ? 'spelare (bara du) i världen just nu.' : 'spelare i världen just nu.'}` : '📡 Kopplar upp mot världen…'}</p>
    ${list.length ? `<div class="plist">${rows}</div>` : info.open ? '<p style="font-size:18px">Du är ensam i stan – tipsa någon om länken så ses ni här!</p>' : ''}`,
  [
    ...(A.sceneName === 'visit' ? [{ label: '🚗 Åk hem', cls: 'btn-red', onClick: () => { closeModal(); A.visitTarget = null; A.game.passTime(20); A.game.save(); A.go('city'); } }] : []),
    { label: 'Stäng', cls: 'btn-go', onClick: closeModal },
  ]);
  dlg.querySelectorAll('[data-face]').forEach((el) => {
    const p = list[+el.dataset.face];
    el.replaceWith(avatarPortrait({ name: p.av.name, look: p.av.look, color: p.av.color }, 40));
  });
  dlg.querySelectorAll('[data-visit]').forEach((b) => (b.onclick = () => { closeModal(); visitPlayer(A, b.dataset.visit); }));
}

// 📊 Dagboken: vad man har gjort i Pixelstaden hittills.
function openDiary() {
  const g = A.game;
  const line = (l, r) => `<div style="display:flex;justify-content:space-between;font-size:20px"><span>${l}</span><b>${r}</b></div>`;
  const jobRows = Object.values(JOBS).map((j) => {
    const n = g.jobs[j.id], b = g.best[j.id];
    return line(`${j.icon} ${j.name}`, n ? `${n} pass · ${JOB_TITLES[levelOf(n) - 1]}${b.ok ? ` · 🏅 ${b.ok} rätt / ${fmt(b.pay)}` : ''}` : 'aldrig jobbat');
  }).join('');
  openModal('📊 Din resa i Pixelstaden', `
    ${line('📅 Dag', `${g.day} (${g.dayName})`)}
    ${line('🏠 Bostad', `${g.homeInfo.icon} ${g.homeInfo.name}${g.furniture.length ? ` + ${g.furniture.map((id) => FURNITURE.find((f) => f.id === id)?.icon).join('')}` : ''}`)}
    ${line('💰 På fickan', fmt(g.money))}
    ${line('💵 Totalt intjänat', fmt(g.earned))}
    <div style="border-top:3px dashed var(--ink);margin:8px 0"></div>
    ${jobRows}
    <div style="border-top:3px dashed var(--ink);margin:8px 0"></div>
    ${line('👕 Köpta plagg', `${g.wardrobe.length} av ${SORTIMENT.length}`)}
    ${g.won ? line('🏆 Slutmålet', 'KLART!') : line('🏆 Målet', `Villan + ${fmt(WIN_MONEY)}`)}`,
  [{ label: 'Snyggt jobbat', cls: 'btn-go', onClick: closeModal }]);
}

// Slutmålet: Villan + rejält på fickan → en enda stor gratulation.
function checkWin() {
  const g = A.game;
  if (g.won || g.home !== 'villa' || g.money < WIN_MONEY) return;
  g.won = true;
  g.save();
  play('fanfare');
  openModal('🏆 Du har lyckats i Pixelstaden!', `<p style="font-size:22px;margin-top:0">Egen villa och <b>${fmt(g.money)}</b> på fickan – från ett litet rum till toppen på ${g.day} dagar!</p>
    <p style="font-size:19px">💰 Totalt intjänat: <b>${fmt(g.earned)}</b><br>🔨 Jobbade pass: <b>${Object.values(g.jobs).reduce((a, b) => a + b, 0)}</b></p>
    <p style="font-size:19px">Staden är din – spela vidare, bjud hem kompisarna och visa upp villan! 🎉</p>`,
    [{ label: '🎉 Tack!', cls: 'btn-go', onClick: closeModal }]);
}

// ---------- uppstart ----------
function boot() {
  A.game = Game.load();
  const firstRun = !localStorage.getItem(SAVE_KEY);
  A.avatar = loadAvatar();
  // garderoben visar 🔒 på plagg som inte är köpta i klädaffären än
  setAvatarLocks((kind, v) => A.game.clothesLocked(kind, v));
  // webbläsare släpper ljudet först efter en pekning
  document.addEventListener('pointerdown', unlockAudio, { capture: true });
  // HUD-knapparna: kompisar + ljud
  const mute = $('#hud-mute');
  mute.textContent = isMuted() ? '🔇' : '🔊';
  mute.onclick = () => { mute.textContent = toggleMute() ? '🔇' : '🔊'; };
  $('#hud-friends').onclick = () => A.openFriends();
  $('#hud-diary').onclick = () => openDiary();
  document.querySelectorAll('#emotes button').forEach((b) => (b.onclick = () => sendEmote(A, b.dataset.e)));
  fit();

  const begin = () => {
    startWorld(A); // den öppna världen: koppla upp tyst i bakgrunden
    if (firstRun) {
      openModal('🌆 Välkommen till Pixelstaden!', `<div class="who">${''}<div>
        <p style="font-size:20px;margin-top:0">Här börjar ditt nya liv, <b>${A.avatar.name}</b>! Du har <b>${fmt(A.game.money)}</b> på fickan.</p>
        <p style="font-size:19px">Tjäna pengar på stadens jobb, köp mat så du orkar, klä dig snyggt – och spara till en större bostad. Först: var vill du bo?</p></div></div>`,
        [{ label: '🔑 Välj bostad', cls: 'btn-go', onClick: () => { closeModal(); A.openHousing({ firstTime: true, onDone: () => A.go('room') }); } }],
        { closable: false });
    } else {
      A.go('room');
    }
  };

  if (!A.avatar.name) {
    openAvatarPicker({
      title: '🧑 Vem är du?', text: 'Skapa din figur – du kan byta kläder hemma i garderoben när du vill.',
      onPick: (av) => { A.avatar = av; begin(); },
      onCancel: () => { A.avatar = loadAvatar(); begin(); },
    });
  } else begin();

  // porträttet i HUD:en
  const face = $('#hud-face');
  let faceKey = '';
  setInterval(() => {
    const k = JSON.stringify(A.avatar?.look || 0);
    if (k === faceKey) return;
    faceKey = k;
    face.replaceChildren(avatarPortrait(A.avatar, 30));
  }, 800);

  requestAnimationFrame(tick);
}

// ---------- loopen ----------
let last = performance.now();
function tick(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (A.scene) {
    A.scene.update?.(dt);
    worldTick(A, A.scene.worldX ?? null, dt);
    ctx.imageSmoothingEnabled = false;
    A.scene.draw(ctx);
  }
  renderHud();
  checkCollapse();
  if (!modalOpen()) checkWin();
  requestAnimationFrame(tick);
}

boot();
window.SF = A; // för tester i konsolen
