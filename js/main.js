// Snabbfilen – bootstrap. En canvas (384×216 logiska pixlar, CSS-skalad),
// scener för staden/rummet/jobben, DOM-HUD överst och en vanlig rAF-loop.
import { loadAvatar, openAvatarPicker, avatarPortrait, setAvatarLocks } from './core/avatar.js';
import { openModal, closeModal, toast, modalOpen, esc } from './core/ui.js';
import { Game, SAVE_KEY, WIN_MONEY, JOBS, JOB_TITLES, SORTIMENT, levelOf, fmt, clock } from './game.js';
import { makeCity } from './scenes/city.js';
import { makeRoom } from './scenes/room.js';
import { makeShopMobler } from './scenes/shop-mobler.js';
import { makeShopIkea } from './scenes/shop-ikea.js';
import { makeShopMat } from './scenes/shop-mat.js';
import { makeShopBostad } from './scenes/shop-bostad.js';
import { makeShopKafe } from './scenes/shop-kafe.js';
import { makeShopKlader } from './scenes/shop-klader.js';
import { makeJobbFlyg } from './jobs/jobb-flyg.js';
import { makeJobbFrukt } from './jobs/jobb-frukt.js';
import { makeJobbBurgare } from './jobs/jobb-burgare.js';
import { startJobFlow } from './jobs/shift.js';
import { openFoodShop } from './shops/matbutik.js';
import { openHousing } from './shops/bostad.js';
import { startWorld, worldTick, worldInfo, playersList, visitPlayer, sendEmote, worldFolksHere, playerName } from './net/world.js';
import { openMenu, mountMenuButton, isMenuOpen, shouldShowMenuAtBoot } from './core/menu.js';
import { drawPixHud, isPixHud, apply as applyHud } from './core/hud-pix.js';
import { musicTick } from './core/music.js';
import { play, unlockAudio, toggleMute, isMuted } from './core/sound.js';

const $ = (s) => document.querySelector(s);
const cv = $('#scene'), ctx = cv.getContext('2d');

// Appkontexten som alla scener får: tillstånd + navigering.
const A = {
  W: 384, H: 216, pxs: 2, // spelets logiska rymd; pxs = device-pixlar per spelpixel (sätts i fit)
  roomSub: 0,             // vilket delrum i bostaden man är i
  game: null, avatar: null,
  scene: null, sceneName: '',
  go(name, opts) {
    A.scene?.exit?.();
    A.sceneName = name;
    A.scene = SCENES[name](A, opts);
    A.scene.enter?.();
  },
  openFoodShop: () => A.go('mat'), // stormarknaden man går runt i (js/scenes/shop-mat.js)
  openHousing: (opts) => openHousing(A, opts),
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
  mobler: (a, o) => makeShopIkea(a, o),
  mat: (a, o) => makeShopMat(a, o),
  bostad: (a, o) => makeShopBostad(a, o),
  kafe: (a, o) => makeShopKafe(a, o),
  moblerGammal: (a, o) => makeShopMobler(a, o),
  klader: (a, o) => makeShopKlader(a, o),
  jobbflyg: (a, o) => makeJobbFlyg(a, o),
  jobbfrukt: (a, o) => makeJobbFrukt(a, o),
  jobbburgare: (a, o) => makeJobbBurgare(a, o),
};
const ENGINES = { flygplats: 'jobbflyg', frukt: 'jobbfrukt', burgare: 'jobbburgare' };

// ---------- skala canvasen till fönstret ----------
// Knivskarpt på alla skärmar: canvasen får exakt ett heltal device-pixlar per
// spelpixel (384×216-rymden), oavsett fönsterstorlek och Windows-skalning.
function fit() {
  const dpr = window.devicePixelRatio || 1;
  const w = window.innerWidth, h = window.innerHeight - $('#hud').offsetHeight - 4;
  // bakom huvudmenyn täcker hela staden fönstret (kanterna klipps), annars får hela spelbilden plats
  const s = Math.max(2, A.attract ? Math.ceil(Math.max(w * dpr / A.W, h * dpr / A.H)) : Math.floor(Math.min(w * dpr / A.W, h * dpr / A.H)));
  A.pxs = s;
  cv.width = A.W * s;
  cv.height = A.H * s;
  cv.style.width = (A.W * s / dpr) + 'px';
  cv.style.height = (A.H * s / dpr) + 'px';
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
  if (modalOpen() || isMenuOpen() || e.ctrlKey || e.altKey || e.metaKey) return;
  A.scene?.key?.(e.key);
});

// ---------- HUD (DOM) ----------
let hudKey = '';
function renderHud() {
  const g = A.game;
  const online = worldInfo().online;
  const nearby = worldFolksHere(A).length;
  $('#emotes').classList.toggle('hidden', nearby === 0);
  $('#decor-btn').classList.toggle('hidden', A.sceneName !== 'room');
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

// 👥 Onlinelistan: alla i världen, var de är just nu, "Gå dit" (i staden) och "Åk dit"
// (hem till dem). Ingen kod – öppen värld.
const PLACE_AWAY = {
  jobbflyg: '✈️ jobbar på flygplatsen', jobbfrukt: '🍊 jobbar på fruktfabriken', jobbburgare: '🍔 jobbar på Burgarbaren',
  jobbpizzeria: '🍕 jobbar på pizzerian', jobbposten: '📦 jobbar på Posten', jobbbensin: '⛽ jobbar på macken',
  jobbverkstad: '🔧 jobbar på bilverkstaden', jobbtvatt: '🧺 jobbar på tvätteriet', jobbkafe: '☕ jobbar på kaféet',
  mat: '🛒 i mataffären', klader: '👕 i klädaffären', mobler: '🛋️ på MÖBELJÄTTEN', moblergammal: '🛋️ på MÖBELJÄTTEN',
  bostad: '🔑 på bostadsbyrån', kafe: '☕ på kaféet', djur: '🐾 i djuraffären',
};
function placeOf(p, info) {
  const s = String(p.scene || 'away');
  if (s === 'city') return '🏙️ i staden';
  if (s.startsWith('home:')) {
    const owner = s.split(':')[1];
    if (owner === p.id) return '🏠 hemma';
    if (owner === info.myId) return '🏠 hemma hos dig!';
    return `🏠 hos ${playerName(owner) || 'en kompis'}`;
  }
  return PLACE_AWAY[s.slice(5)] || '💼 upptagen';
}
function openWorldDialog() {
  const info = worldInfo();
  const list = playersList();
  const inJob = A.sceneName.startsWith('jobb');
  const verTag = (v) => (v === info.version ? '' : ` <span class="old">${v ? 'v' + esc(v) : 'gammal version'}</span>`);
  const rows = list.map((p, i) => `<div class="prow">
      <span data-face="${i}"></span>
      <span class="nm">${esc(p.av.name || '?')}${verTag(p.ver)}<br><small class="sp">${placeOf(p, info)}</small></span>
      ${p.scene === 'city' && !inJob ? `<button class="btn btn-small" data-goto="${esc(p.id)}">🚶 Gå dit</button>` : ''}
      <button class="btn btn-small btn-go" data-visit="${esc(p.id)}">🚗 Åk hem till</button>
    </div>`).join('');
  const role = info.role === 'host' ? 'du håller i världen' : info.role === 'client' ? 'ansluten' : 'kopplar upp';
  const dlg = openModal('👥 Pixelstaden online', `
    <p style="font-size:19px;margin-top:0">${info.open ? `<b>${info.online}</b> ${info.online === 1 ? 'spelare (bara du) i världen just nu.' : 'spelare i världen just nu.'}` : '📡 Kopplar upp mot världen…'}</p>
    ${list.length ? `<div class="plist">${rows}</div>` : info.open ? '<p style="font-size:18px">Du är ensam i stan – tipsa någon om länken så ses ni här!</p>' : ''}
    <p class="world-diag">Du ser bara dem som är på samma ställe som du. v${esc(info.version)} · ${role}${info.world !== 'varlden' ? ` · värld: ${esc(info.world)}` : ''}</p>`,
  [
    ...(A.sceneName === 'visit' ? [{ label: '🚗 Åk hem', cls: 'btn-red', onClick: () => { closeModal(); A.visitTarget = null; A.game.passTime(20); A.game.save(); A.go('city'); } }] : []),
    { label: 'Stäng', cls: 'btn-go', onClick: closeModal },
  ]);
  dlg.querySelectorAll('[data-face]').forEach((el) => {
    const p = list[+el.dataset.face];
    el.replaceWith(avatarPortrait({ name: p.av.name, look: p.av.look, color: p.av.color }, 40));
  });
  dlg.querySelectorAll('[data-visit]').forEach((b) => (b.onclick = () => { closeModal(); visitPlayer(A, b.dataset.visit); }));
  dlg.querySelectorAll('[data-goto]').forEach((b) => (b.onclick = () => {
    closeModal();
    A.followPlayer = b.dataset.goto;
    if (A.sceneName !== 'city') { A.visitTarget = null; A.go('city'); }
  }));
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
    ${line('🏠 Bostad', `${g.homeInfo.icon} ${g.homeInfo.name}`)}
    ${line('🛋️ Möbler', `${Object.values(g.deco).flat().filter((d) => !d.fx).length} placerade · ${g.storage.length} i förrådet`)}
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
  mute.onclick = () => { mute.textContent = toggleMute() ? '🔇' : '🔊'; musicTick(); };
  $('#hud-friends').onclick = () => A.openFriends();
  $('#hud-diary').onclick = () => openDiary();
  $('#decor-btn').onclick = () => A.scene?.toggleDecor?.();
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

  const start = () => {
    A.attract = false;
    fit();
    if (!A.avatar.name) {
      openAvatarPicker({
        title: '🧑 Vem är du?', text: 'Skapa din figur – du kan byta kläder hemma i garderoben när du vill.',
        onPick: (av) => { A.avatar = av; begin(); },
        onCancel: () => { A.avatar = loadAvatar(); begin(); },
      });
    } else begin();
  };
  mountMenuButton(A);
  applyHud();
  // huvudmenyn: staden lever bakom panelen tills man väljer figur och trycker Fortsätt
  if (shouldShowMenuAtBoot()) { A.attract = true; fit(); A.go('city'); openMenu(A, { onStart: start }); }
  else start();

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
    if (!modalOpen() && !isMenuOpen() && !A.sceneName.startsWith('jobb')) A.game.tickReal(dt);
    A.scene.update?.(dt);
    worldTick(A, A.scene.worldX ?? null, dt);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#14121a';
    ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.imageSmoothingEnabled = false;
    A.scene.draw(ctx);
    if (isPixHud() && !A.attract) drawPixHud(ctx, A);
  }
  renderHud();
  checkCollapse();
  if (!modalOpen()) checkWin();
  requestAnimationFrame(tick);
}

boot();
window.SF = A; // för tester i konsolen
