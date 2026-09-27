// Snabbfilen – bootstrap. En canvas (384×216 logiska pixlar, CSS-skalad),
// scener för staden/rummet/jobben, DOM-HUD överst och en vanlig rAF-loop.
import { loadAvatar, openAvatarPicker, avatarPortrait } from './core/avatar.js';
import { openModal, closeModal, toast, modalOpen } from './core/ui.js';
import { Game, SAVE_KEY, fmt, clock } from './game.js';
import { makeCity } from './scenes/city.js';
import { makeRoom } from './scenes/room.js';
import { makeSorter, SORTER_SKINS } from './jobs/sorter.js';
import { makePacker } from './jobs/packer.js';
import { startJobFlow } from './jobs/shift.js';
import { openFoodShop } from './shops/matbutik.js';
import { openHousing } from './shops/bostad.js';

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
  startJob: (jobId) => startJobFlow(A, jobId, ENGINES[jobId]),
};

const SCENES = {
  city: (a, o) => makeCity(a, o),
  room: (a, o) => makeRoom(a, o),
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
  const key = `${g.day}|${Math.floor(g.min)}|${g.money}|${Math.round(g.hunger)}|${Math.round(g.energy)}|${A.avatar?.name}`;
  if (key === hudKey) return;
  hudKey = key;
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
      const { rent } = g.sleep();
      toast(`☀️ God morgon! ${g.dayName}, dag ${g.day}.`, 'good');
      if (rent) toast(`💸 Hyra betald: ${fmt(rent)}`, g.money < 0 ? 'bad' : '');
      if (g.money < 0) toast('⚠️ Du är skyldig hyresvärden pengar – jobba ihop dem!', 'bad');
    } },
  ]);
};

// ---------- uppstart ----------
function boot() {
  A.game = Game.load();
  const firstRun = !localStorage.getItem(SAVE_KEY);
  A.avatar = loadAvatar();
  fit();

  const begin = () => {
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
    ctx.imageSmoothingEnabled = false;
    A.scene.draw(ctx);
  }
  renderHud();
  checkCollapse();
  requestAnimationFrame(tick);
}

boot();
window.SF = A; // för tester i konsolen
