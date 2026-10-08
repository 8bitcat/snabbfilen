// 🧭 STARTGUIDEN – Carl 2026-10-08: "we need a tutorial so we can help people get to work".
// Upplägget Carl valde (av fem förslag): ATT GÖRA-LISTAN + DORIS + HANDEN.
//
//   • En liten lista uppe till vänster visar dagens nästa steg (och resten om man fäller ut den).
//   • I stan pekar den gula 🧭-pilen (A.guide, city.js) vägen till Burgarbaren och sedan hem.
//   • På Burgarbaren pratar Doris i en pratbubbla och handen pekar på JOBBA HÄR-skylten.
//   • I serveringsjobbet visar handen först hur man gör (ta maten → ge den till kunden), sedan
//     "DIN TUR!".
//
// Första dagen: gå ut ur husvagnen → till Burgarbaren → fråga Doris om jobb → servera första kunden
// → jobba klart passet (lönen) → ät något → gå hem och sov. Stegen bockas av när de HÄNDER (guiden
// läser spelets läge: scenen, intjänat, mättnaden, dagen) – i vilken ordning som helst, och även om
// man väljer ett annat jobb eller äter någon annanstans.
//
// Nya spelare får guiden direkt (main.js begin). Den går att hoppa över (× i listan) och att köra
// igen under ⚙ Inställningar. Testrobotarna (navigator.webdriver) slipper den, utom med ?guide.
// Scenerna frågar guideStep() och ritar handen själva med drawGuideHand (samma pixelkorn som scenen).
import { $t } from './i18n.js';
import { toast, openModal, closeModal, esc } from './ui.js';
import { play } from './sound.js';
import { SMALL, ctxText, textW } from './floor-pix.js';

const KEY = 'snabbfilen_startguide';
const STEPS = [
  { id: 'ut', text: $t('Gå ut ur husvagnen'), tip: $t('Gå till dörren där det står UT.') },
  { id: 'dit', text: $t('Gå till Burgarbaren'), tip: $t('Följ den gula pilen – eller tryck på lappen nere till vänster, så går du dit själv.') },
  { id: 'jobb', text: $t('Fråga Doris om jobb'), tip: $t('Tryck på skylten JOBBA HÄR på disken och välj Servera.') },
  { id: 'servera', text: $t('Servera din första kund'), tip: $t('Ta maten från disken och ge den till kunden som vill ha just den.') },
  { id: 'lon', text: $t('Jobba klart passet'), tip: $t('Lönen kommer direkt när passet är slut.') },
  { id: 'mat', text: $t('Ät något'), tip: $t('Köp mat vid disken och sätt dig vid ett bord – eller handla i närbutiken.') },
  { id: 'sov', text: $t('Gå hem och sov'), tip: $t('Följ pilen hem och lägg dig i sängen.') },
];
// stegen där pilen i stan visar vägen (byggnadens id i js/city/map.js)
const ARROW = { dit: () => 'burgare', sov: (g) => (g.home === 'husvagn' ? 'husvagn' : null) };

let S = null;          // { on, done: {id: true}, earned, day, open }
let A0 = null, el = null, pollT = 0, lastScene = '', lastH = null, ate = 0;
const load = () => { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { return null; } };
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch { /* privat läge */ } };
const robot = () => typeof navigator !== 'undefined' && navigator.webdriver && !new URLSearchParams(location.search).has('guide');

// det steg som står på tur (null = guiden är av eller klar)
export function guideStep() {
  if (!S?.on) return null;
  return STEPS.find((s) => !S.done[s.id])?.id || null;
}
export const guideOn = () => !!S?.on;

// Starta guiden från början (nya spelare, eller ⚙ Inställningar → Startguiden)
export function startGuide(A, { force = false } = {}) {
  A0 = A;
  if (!force && robot()) return;
  const g = A.game;
  S = { on: true, done: {}, earned: g.earned | 0, day: g.day | 0, open: false };
  lastH = g.hunger; ate = 0; lastScene = '';
  save();
  render();
}
// Vid start: fortsätt en påbörjad guide (sidan laddades om mitt i första dagen)
export function resumeGuide(A) {
  A0 = A;
  const s = load();
  if (s?.on && !robot()) { S = s; lastH = A.game.hunger; render(); }
}
export function stopGuide() {
  if (S) { S.on = false; save(); }
  render();
}

function complete(id) {
  if (!S?.on || S.done[id]) return;
  S.done[id] = true;
  save();
  const st = STEPS.find((s) => s.id === id);
  play('ok');
  toast(`✔ ${st.text}`, 'good');
  if (!guideStep()) finish();
  render();
}
function finish() {
  S.on = false; S.fin = true; save();
  play('coin');
  openModal($t('🎉 Bra jobbat!'), `<p style="font-size:var(--f2);margin-top:0">${$t('Nu kan du klara dig själv i Pixelstaden!')}</p>
    <p style="font-size:var(--f2)">${$t('Fler jobb hittar du på kartan 🗺️ – och under 🎯 Livsmålen ser du vad du sparar till. Ju mer du jobbar, desto bättre betalt.')}</p>`,
  [{ label: $t('Tack, Doris!'), cls: 'btn-go', onClick: closeModal }]);
}

// Varje bildruta från main.js (läser läget fyra gånger i sekunden)
export function guideTick(A, dt) {
  A0 = A;
  if (!S?.on) { if (el && !el.classList.contains('hidden')) render(); return; }
  if ((pollT -= dt) > 0) return;
  pollT = 0.25;
  const g = A.game, sc = A.sceneName || '';
  const inJob = sc.startsWith('jobb');
  if (sc === 'city') complete('ut');
  if (sc === 'burgarbar' || inJob) complete('dit');
  if (inJob) complete('jobb');
  if (sc === 'jobbburgare' && (A.scene?._debug?.stats?.ok | 0) >= 1) complete('servera');
  if ((g.earned | 0) > S.earned) { complete('servera'); complete('lon'); }
  // mättnaden stiger bara när man äter (sömnens middag räknas inte: dagen byts samtidigt)
  if (lastH !== null && g.hunger > lastH && g.day === S.dayNow) ate += g.hunger - lastH;
  lastH = g.hunger; S.dayNow = g.day;
  if (ate >= 3) complete('mat');
  if ((g.day | 0) > S.day) complete('sov');
  const step = guideStep();
  if (step === 'mat' && g.hunger >= 95) complete('mat'); // redan proppmätt – inget att äta nu
  // pilen i stan: när man kommer ut (eller när steget blir aktuellt därute) – tar man bort den
  // med × kommer den tillbaka först nästa gång man går ut
  const arrowFor = ARROW[step]?.(g);
  if (sc === 'city' && arrowFor && (lastScene !== 'city' || S.arrowStep !== step)) {
    S.arrowStep = step;
    if (A.guide?.id !== arrowFor) A.guide = { id: arrowFor };
  }
  lastScene = sc;
  render();
}

// ---------- listan (DOM, uppe till vänster under HUD:en) ----------
function render() {
  if (!el) {
    if (typeof document === 'undefined') return;
    el = document.createElement('div');
    el.id = 'startguide';
    el.className = 'hidden';
    document.body.appendChild(el);
    el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-sg]');
      if (!b || !S) return;
      if (b.dataset.sg === 'fold') { S.open = !S.open; save(); play('click'); render(); }
      if (b.dataset.sg === 'skip') skipAsk();
    });
  }
  const A = A0, sc = A?.sceneName || '';
  const step = guideStep();
  const hide = !step || !A || A.attract || sc.startsWith('jobb') || sc === 'koket';
  el.classList.toggle('hidden', hide);
  if (hide) return;
  // ovanför emoji-raden (nere till höger) när den syns
  const em = document.getElementById('emotes'), er = em && !em.classList.contains('hidden') ? em.getBoundingClientRect() : null;
  el.style.setProperty('--sg-bottom', `${er?.height ? Math.round(innerHeight - er.top + 6) : 10}px`);
  const n = STEPS.filter((s) => S.done[s.id]).length;
  const cur = STEPS.find((s) => s.id === step);
  const key = `${step}|${n}|${S.open}`;
  if (el.dataset.key === key) return;
  el.dataset.key = key;
  const row = (s) => `<li class="${S.done[s.id] ? 'ok' : s.id === step ? 'nu' : ''}"><i></i>${esc(s.text)}</li>`;
  el.innerHTML = `<div class="sg-head"><button data-sg="fold" class="sg-fold">${S.open ? '▾' : '▸'} ${esc($t('FÖRSTA DAGEN'))} ${n}/${STEPS.length}</button><button data-sg="skip" class="sg-x" title="${esc($t('Hoppa över guiden'))}">×</button></div>
    ${S.open ? `<ol>${STEPS.map(row).join('')}</ol>` : `<ol>${row(cur)}</ol>`}
    <p class="sg-tip">${esc(cur.tip)}</p>`;
}
function skipAsk() {
  play('click');
  openModal($t('🧭 Hoppa över guiden?'), `<p style="font-size:var(--f2);margin-top:0">${$t('Du kan starta den igen under ⚙ Inställningar.')}</p>`, [
    { label: $t('Fortsätt guiden'), onClick: closeModal },
    { label: $t('Hoppa över'), cls: 'btn-go', onClick: () => { closeModal(); stopGuide(); } },
  ]);
}

// ---------- handen: en vit pixelhandske som pekar NEDÅT på (x, y) och knackar ----------
// (spetsen på pekfingret hamnar på x, y; ringen pulserar runt målet)
const HAND = [
  '....##########..',
  '....#wwwwwwww#..',
  '....#wwwwwwww#..',
  '...#wwwwwwwwww#.',
  '...#wwwwwwwwww#.',
  '..#wwwwwwwwwwww#',
  '..#wwwwwwwwwwww#',
  '.#www#wwwwwwwww#',
  '.#ww##ww#ww#ww#.',
  '..##.#ww#ww#ww#.',
  '.....#ww#ww###..',
  '.....#ww###.....',
  '.....#ww#.......',
  '.....#ww#.......',
  '.....#ww#.......',
  '......##........',
];
const HC = { '#': '#17151a', w: '#fffaf0', s: '#d9cfbe' };
export function drawGuideHand(ctx, x, y, label = '', { below = false } = {}) {
  const t = performance.now() / 1000;
  const tap = Math.max(0, Math.sin(t * 5)) * 3 | 0;
  // ringen runt målet
  const r = 3 + ((t * 8) % 6 | 0);
  ctx.fillStyle = '#ffd23f';
  for (let a = 0; a < 24; a++) {
    const px = Math.round(x + Math.cos(a / 24 * Math.PI * 2) * r), py = Math.round(y + Math.sin(a / 24 * Math.PI * 2) * r * 0.6);
    ctx.fillRect(px, py, 1, 1);
  }
  // handen (spetsen = rad 15, kolumn 6–7)
  const ox = Math.round(x) - 7, oy = Math.round(y) - 16 - tap;
  ctx.fillStyle = 'rgba(20,12,28,0.35)';
  for (let j = 0; j < HAND.length; j++) for (let i = 0; i < HAND[j].length; i++) if (HAND[j][i] !== '.') ctx.fillRect(ox + i + 1, oy + j + 1, 1, 1);
  for (let j = 0; j < HAND.length; j++) for (let i = 0; i < HAND[j].length; i++) {
    const c = HC[HAND[j][i]];
    if (c) { ctx.fillStyle = (HAND[j][i] === 'w' && i >= 11) ? HC.s : c; ctx.fillRect(ox + i, oy + j, 1, 1); }
  }
  if (label) {
    const w = textW(SMALL, label) + 6, lx = Math.round(x - w / 2), ly = below ? Math.round(y) + 5 : oy - 12;
    ctx.fillStyle = '#17151a'; ctx.fillRect(lx - 1, ly - 1, w + 2, 11);
    ctx.fillStyle = '#ffd23f'; ctx.fillRect(lx, ly, w, 9);
    ctxText(ctx, SMALL, label, lx + 3, ly + 2, '#17151a');
  }
}
