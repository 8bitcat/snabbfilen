// 🎁 PRESENTER – Carl 2026-10-12: "presenter … notiser på morgonen som säger att man fått en present, så alla loggar
// in och tittar … större presenter".
//   • En present om dagen – riktiga dagar, ny dag från kl. 6 på morgonen. Var sjunde present är en STOR present
//     (tre saker, finare saker). Presenterna väntar i mobilens 🎁 Presenter tills man öppnar dem: missar man en dag
//     ligger presenten kvar, men högst tre dagspresenter väntar (inget att "ta igen" i all oändlighet).
//   • Uppackningen: paketet skakar, locket flyger, konfetti – och det man fick visas som en riktig bild (kläderna på
//     ens egen figur, möbeln ur möbelarket, djursaken, maten, pengarna). Kläder kan man ta på direkt.
//   • Innehållet: pengar, mat till kylskåpet, kläder och accessoarer man inte har, möbler till förrådet (Möblera) och –
//     har man djur – saker till djuren. Den stora presenten har en av varje (pengar + plagg + möbel) och dyrare saker.
//   • Appen: en notis kl. 7.30 de tre närmaste morgnarna (js/core/notiser.js, setExtraNotiser) – "En present väntar".
//   • Vänskapspresenter (v0.110) hamnar i samma kö (typ 'van').
// Sparas i spelet: g.presenter = { dag, antal, ko } (game.js). Testerna styr klockan med window.__presentNu (ms).
import { $t } from './i18n.js';
import { openModal, closeModal, toast, esc, modalOpen } from './ui.js';
import { play } from './sound.js';
import { saveAvatar } from './avatar.js';
import { WARDROBE, itemById, lookForItem } from '../data/wardrobe.js';
import { FOOD, KATALOG, katalogOf, fmt } from '../game.js';
import { PET_ITEMS } from '../pets/items.js';
import { petStore } from '../pets/sim.js';
import { Pix, mix, mul, hash } from './floor-pix.js';
import { setExtraNotiser, planera } from './notiser.js';

const STOR_VAR = 7, MAX_DAG = 3, NY_DAG_KL = 6;
const nu = () => (typeof window !== 'undefined' && window.__presentNu) || Date.now();
// dagens nyckel: datumet (lokal tid) för nu − 6 timmar – en ny dag börjar kl. 6
export function dagNu(t = nu()) {
  const d = new Date(t - NY_DAG_KL * 3600000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
const P = (G) => { if (!G.presenter || typeof G.presenter !== 'object') G.presenter = { dag: '', antal: 0, ko: [] }; return G.presenter; };
const dagliga = (G) => P(G).ko.filter((x) => x.typ === 'dag' || x.typ === 'stor').length;
// blir nästa dagspresent stor? (antal öppnade + de som väntar)
const blirStor = (G, extra = 0) => (P(G).antal + dagliga(G) + extra) % STOR_VAR === STOR_VAR - 1;
export const presenterVantar = (A) => (A?.game ? P(A.game).ko.length : 0);
// hur många presenter till nästa stora (1 = nästa är stor)
export const tillStor = (G) => { for (let i = 0; i < STOR_VAR; i++) if (blirStor(G, i)) return i + 1; return STOR_VAR; };

// Kollar om dagens present har kommit (vid start och varje minut). true = en ny present kom nu.
export function presenterKoll(A, { tyst = false } = {}) {
  const G = A?.game;
  if (!G || A.attract) return false;
  const p = P(G), idag = dagNu();
  if (p.dag === idag) return false;
  p.dag = idag;
  if (dagliga(G) >= MAX_DAG) { G.save(); return false; }
  const typ = blirStor(G) ? 'stor' : 'dag';
  p.ko.push({ typ });
  G.save();
  if (!tyst) setTimeout(() => { play('ok'); toast(typ === 'stor' ? $t('🎁 En STOR present väntar på dig! Öppna den i mobilen 📱') : $t('🎁 Du har fått en present! Öppna den i mobilen 📱'), 'good'); }, 2500);
  planera();   // (morgondagens notistext kan ha ändrats)
  return true;
}

// ---------- innehållet ----------
const rnd = (a) => a[Math.floor(Math.random() * a.length)];
const runda = (n) => Math.round(n / 10) * 10;
const harDjur = () => { try { return petStore().pets.length > 0; } catch { return false; } };
const djurArter = () => { try { return [...new Set(petStore().pets.map((p) => p.species))]; } catch { return []; } };
function plagg(G, max, min = 0) {
  const ok = WARDROBE.filter((it) => !it.free && !it.butik && !it.group && it.price <= max && it.price >= min && !G.ownsWardrobe(it.id));
  return ok.length ? { slag: 'plagg', id: rnd(ok).id } : null;
}
function mobel(max, min = 0) {
  const ok = KATALOG.filter((k) => !k.shop && k.price <= max && k.price >= min && k.kind !== 'matta');
  if (!ok.length) return null;
  const k = rnd(ok);
  return { slag: 'mobel', k: k.kind, v: Math.floor(Math.random() * Math.max(1, k.vars | 0)) };
}
function djursak(max) {
  const arter = djurArter();
  if (!arter.length) return null;
  const ok = Object.entries(PET_ITEMS).filter(([, it]) => it.pris <= max && it.forArt.some((a) => arter.includes(a)) && it.typ !== 'koppel');
  return ok.length ? { slag: 'djur', k: rnd(ok)[0] } : null;
}
const pengar = (min, max) => ({ slag: 'pengar', n: runda(min + Math.random() * (max - min)) });
const mat = () => { const f = rnd(FOOD.filter((x) => x.id !== 'nudlar')); return { slag: 'mat', id: f.id, n: f.price >= 60 ? 1 : 2 }; };
// 🏆 en pokal (Carl: "du kan också ge dem pokaler att ha hemma") – brons oftast, guld sällan
const pokal = () => ({ slag: 'mobel', k: 'pokal', v: Math.random() < 0.2 ? 0 : Math.random() < 0.5 ? 1 : 2 });
export function rulla(G, typ) {
  if (typ === 'stor') return [pengar(300, 600), plagg(G, 900, 150) || pengar(200, 300), Math.random() < 0.35 ? pokal() : mobel(1200, 300) || pengar(200, 300)];
  if (Math.random() < 0.05) return [{ slag: 'mobel', k: 'pokal', v: 2 }];
  const slag = rnd(['pengar', 'pengar', 'plagg', 'plagg', 'mat', 'mobel', ...(harDjur() ? ['djur', 'djur'] : [])]);
  const g = slag === 'plagg' ? plagg(G, 250) : slag === 'mobel' ? mobel(400) : slag === 'djur' ? djursak(200) : slag === 'mat' ? mat() : null;
  return [g || pengar(40, 150)];
}
// en gåva som går att ge (tvättar också vänskapspresenternas gåvor)
function giltig(g) {
  if (!g || typeof g !== 'object') return false;
  if (g.slag === 'pengar') return Number.isFinite(+g.n) && +g.n > 0 && +g.n <= 5000;
  if (g.slag === 'plagg') return !!itemById(g.id);
  if (g.slag === 'mobel') return !!katalogOf(g.k);
  if (g.slag === 'djur') return !!PET_ITEMS[g.k];
  if (g.slag === 'mat') return !!FOOD.find((f) => f.id === g.id) && +g.n > 0 && +g.n <= 10;
  return false;
}
function ge(A, g) {
  const G = A.game;
  if (g.slag === 'pengar') G.money += Math.round(+g.n);
  else if (g.slag === 'plagg') { if (!G.ownsWardrobe(g.id)) G.wardrobe.push(g.id); }
  else if (g.slag === 'mobel') G.storage.push({ k: g.k, v: g.v | 0 });
  else if (g.slag === 'djur') { try { petStore().buyItem(g.k); } catch { /* ok */ } }
  else if (g.slag === 'mat') G.fridge[g.id] = (G.fridge[g.id] || 0) + (g.n | 0);
}
function gavaNamn(g) {
  if (g.slag === 'pengar') return fmt(g.n);
  if (g.slag === 'plagg') return String(itemById(g.id)?.name || '').replace(/­/g, '');
  if (g.slag === 'mobel') return katalogOf(g.k)?.name || '';
  if (g.slag === 'djur') return PET_ITEMS[g.k]?.namn || '';
  if (g.slag === 'mat') return `${g.n > 1 ? g.n + ' × ' : ''}${FOOD.find((f) => f.id === g.id)?.name || ''}`;
  return '';
}
const gavaVart = (g) => (g.slag === 'pengar' ? $t('i plånboken') : g.slag === 'plagg' ? $t('i garderoben') : g.slag === 'mobel' ? $t('i förrådet – ställ ut den med 🛋️ Möblera hemma') : g.slag === 'djur' ? $t('hos djuren hemma') : $t('i kylskåpet'));

// ---------- bilderna ----------
// paketet (pixel för pixel): stor = guld med rött band och stjärnor, liten = rött med guldband och prickar
function paketBild(stor, lock = 0, skak = 0) {
  const W = 64, H = 60, P2 = new Pix(W, H);
  const bas = stor ? 0xe8b84a : 0xe04848, band = stor ? 0xd8394a : 0xffd23f, bw = stor ? 46 : 38, bh = stor ? 30 : 24;
  const x0 = Math.round((W - bw) / 2 + skak), y0 = H - bh - 2;
  for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) {   // lådan
    let c = x < 3 ? mix(bas, 0xffffff, 0.25) : x > bw - 4 ? mul(bas, 0.72) : bas;
    if (stor ? (x + y * 3) % 11 === 0 && hash(x, y, 3) > 0.4 : (x % 6 === 2 && y % 6 === 3)) c = mix(c, 0xffffff, 0.6);
    if (Math.abs(x - bw / 2 + 0.5) < 3) c = x - bw / 2 < 0 ? mix(band, 0xffffff, 0.25) : band;
    P2.px(x0 + x, y0 + y, c);
  }
  for (let x = 0; x < bw; x++) P2.px(x0 + x, y0 + bh - 1, mul(bas, 0.55));
  // locket (lyfts och lutar när det öppnas)
  const lw = bw + 6, lh = 7, ly = y0 - lh + 1 - Math.round(lock * 15), lx = Math.round((W - lw) / 2 + skak + lock * 12);   // (locket stannar i bild)
  for (let y = 0; y < lh; y++) for (let x = 0; x < lw; x++) {
    const dy = Math.round(lock * (x - lw / 2) * 0.25);
    let c = y === 0 ? mix(bas, 0xffffff, 0.35) : y === lh - 1 ? mul(bas, 0.6) : x < 3 ? mix(bas, 0xffffff, 0.2) : x > lw - 4 ? mul(bas, 0.75) : bas;
    if (Math.abs(x - lw / 2 + 0.5) < 3) c = band;
    P2.px(lx + x, ly + y + dy, c);
  }
  // rosetten på locket
  if (lock < 0.6) {
    const cx = lx + Math.floor(lw / 2), cy = ly - 1;
    for (const [dx, dy] of [[-6, -3], [-5, -4], [-4, -4], [-3, -3], [-2, -2], [-5, -2], [-4, -1], [-3, -1], [-6, -2], [6, -3], [5, -4], [4, -4], [3, -3], [2, -2], [5, -2], [4, -1], [3, -1], [6, -2], [-1, -1], [0, -1], [1, -1], [-1, 0], [0, 0], [1, 0]]) P2.px(cx + dx, cy + dy, dx === 0 ? mul(band, 0.75) : band);
    P2.px(cx - 4, cy - 3, mix(band, 0xffffff, 0.5)); P2.px(cx + 4, cy - 3, mix(band, 0xffffff, 0.5));
  }
  return P2.flush();
}
const KONFETTI = ['#ff5dc8', '#ffd23f', '#3fc4ff', '#46a35a', '#e04848', '#8e5bd1', '#ffffff'];
function mynt(n = 3) {   // en hög med guldmynt
  const P2 = new Pix(20, 16);
  for (let i = 0; i < n; i++) {
    const x = 3 + (i % 3) * 5 - (i > 2 ? 2 : 0), y = 10 - Math.floor(i / 3) * 3 - (i % 2);
    for (let yy = 0; yy < 3; yy++) for (let xx = 0; xx < 7; xx++) if (!((yy === 0 || yy === 2) && (xx === 0 || xx === 6))) P2.px(x + xx, y + yy, yy === 0 ? 0xfff0a0 : yy === 2 ? 0xb9862a : 0xf2c14e);
  }
  return P2.flush();
}
const stor = (cv, k) => { const o = document.createElement('canvas'); o.width = cv.width * k; o.height = cv.height * k; const g = o.getContext('2d'); g.imageSmoothingEnabled = false; g.drawImage(cv, 0, 0, o.width, o.height); o.style.width = o.width + 'px'; o.style.height = o.height + 'px'; return o; };
async function gavaBild(A, g) {
  try {
    if (g.slag === 'pengar') return stor(mynt(g.n >= 300 ? 6 : g.n >= 100 ? 4 : 2), 4);
    if (g.slag === 'plagg') { const { figure } = await import('../scenes/klader/buy.js'); const it = itemById(g.id); return figure(lookForItem(it, A.avatar.look, { colors: true }), it.slot === 'bag' ? 'right' : 'down', 3); }
    if (g.slag === 'mobel') {
      const { furnArt } = await import('../scenes/room.js');
      const a = furnArt(g.k, g.v);
      if (a) { const c = document.createElement('canvas'); c.width = a.sw; c.height = a.sh; const x = c.getContext('2d'); x.imageSmoothingEnabled = false; x.drawImage(a.img, a.sx, a.sy, a.sw, a.sh, 0, 0, a.sw, a.sh); return stor(c, Math.max(1, Math.min(4, Math.floor(72 / Math.max(a.sw, a.sh))))); }
    }
    if (g.slag === 'djur') { const { drawItemIcon } = await import('../pets/items.js'); const c = document.createElement('canvas'); c.width = 40; c.height = 40; const x = c.getContext('2d'); x.imageSmoothingEnabled = false; drawItemIcon(x, g.k, 2, 2, 1); return stor(c, 2); }
  } catch { /* faller tillbaka på symbolen */ }
  const span = document.createElement('span'); span.className = 'pr-emoji';
  span.textContent = g.slag === 'mat' ? FOOD.find((f) => f.id === g.id)?.icon || '🍽️' : g.slag === 'mobel' ? katalogOf(g.k)?.icon || '🛋️' : g.slag === 'djur' ? '🐾' : '🎁';
  return span;
}

// ---------- 🎁 Presenter i mobilen ----------
const rubrikFor = (x) => (x.typ === 'stor' ? $t('🎁 STOR present') : x.typ === 'van' ? $t`💛 Present från ${x.fran || '?'}` : $t('🎁 Dagens present'));
export function openPresenter(A) {
  presenterKoll(A, { tyst: true });
  const G = A.game, p = P(G), n = tillStor(G);
  const rader = p.ko.map((x, i) => `<div class="pr-rad${x.typ === 'stor' ? ' pr-stor' : ''}"><span class="pr-ik" data-pik="${i}"></span><span class="nm">${esc(rubrikFor(x))}</span><button class="btn btn-small btn-go" data-oppna="${i}">${$t('Öppna!')}</button></div>`).join('');
  const dlg = openModal($t('🎁 Presenter'), `${p.ko.length ? `<div class="pr-lista">${rader}</div>` : `<p style="font-size:var(--f2);margin-top:0">${$t('Inga presenter just nu. I morgon bitti kommer en ny! 🌅')}</p>`}
    <p class="sp" style="font-size:var(--f2)">${n === 1 ? $t('⭐ Nästa present blir en STOR present!') : $t`⭐ Var sjunde present är en STOR present – nästa om ${n} presenter.`}</p>`,
  [{ label: $t('Stäng'), cls: 'btn-go', onClick: closeModal }]);
  dlg.querySelectorAll('[data-pik]').forEach((el) => el.append(stor(paketBild(p.ko[+el.dataset.pik].typ === 'stor'), 1)));
  dlg.querySelectorAll('[data-oppna]').forEach((b) => (b.onclick = () => oppna(A, +b.dataset.oppna)));
}

// Uppackningen: tryck på paketet (eller Öppna) → skak, locket flyger, konfetti → det man fick
export function oppna(A, i) {
  const G = A.game, p = P(G), x = p.ko[i];
  if (!x) return;
  const storP = x.typ === 'stor';
  const dlg = openModal(rubrikFor(x), `<div class="pr-scen"><canvas class="pr-cv" width="256" height="240"></canvas><p class="pr-tips">${$t('Tryck på paketet!')}</p></div><div class="pr-gavor hidden"></div>`,
    [{ label: $t('🎁 Öppna!'), cls: 'btn-go', onClick: () => start() }]);
  dlg.classList.add('pr-dlg');
  const cv = dlg.querySelector('.pr-cv'), g = cv.getContext('2d'); g.imageSmoothingEnabled = false;
  let t0 = 0, fas = 'vila', raf = 0;
  const bitar = Array.from({ length: 70 }, (_, k) => ({ x: 128, y: 150, vx: (Math.random() - 0.5) * 7, vy: -4 - Math.random() * 6, c: KONFETTI[k % KONFETTI.length], s: 3 + (k % 3) * 2 }));
  const rita = (ts) => {
    if (!dlg.isConnected) return;
    const t = t0 ? (ts - t0) / 1000 : 0;
    g.clearRect(0, 0, 256, 240);
    let lock = 0, skak = 0;
    if (fas === 'vila') skak = Math.sin(ts / 260) > 0.92 ? Math.sin(ts / 30) * 1.2 : 0;
    if (fas === 'skak') { skak = Math.sin(t * 60) * (1 + t * 3); if (t > 0.7) { fas = 'upp'; t0 = ts; play('buy'); } }
    if (fas === 'upp') lock = Math.min(1, t * 2.2);
    if (lock > 0.2) {   // ljuset ur paketet
      g.globalAlpha = Math.min(0.5, lock * 0.5); g.fillStyle = storP ? '#fff0a0' : '#ffe8f4';
      for (let k = 0; k < 9; k++) { const a = -Math.PI / 2 + (k - 4) * 0.22; g.beginPath(); g.moveTo(128, 150); g.lineTo(128 + Math.cos(a - 0.06) * 200, 150 + Math.sin(a - 0.06) * 200); g.lineTo(128 + Math.cos(a + 0.06) * 200, 150 + Math.sin(a + 0.06) * 200); g.fill(); }
      g.globalAlpha = 1;
    }
    g.drawImage(paketBild(storP, lock, Math.round(skak)), 0, 0, 64, 60, 0, 0, 256, 240);
    if (fas === 'upp') {
      for (const b of bitar) { b.x += b.vx; b.y += b.vy; b.vy += 0.18; g.fillStyle = b.c; g.fillRect(Math.round(b.x), Math.round(b.y), b.s, b.s); }
      if (t > 0.9 && dlg.querySelector('.pr-gavor').classList.contains('hidden')) visa();
    }
    raf = requestAnimationFrame(rita);
  };
  raf = requestAnimationFrame(rita);
  let gavor = null;
  const start = () => {
    if (fas !== 'vila') return;
    fas = 'skak'; t0 = 0; requestAnimationFrame((ts) => { t0 = ts; }); play('click');
    // gåvorna bestäms och ges direkt (så att ingenting går förlorat om man stänger mitt i)
    // vänskapspresent: en liten dagspresent (om den är gratis) + det vännen själv lade i paketet
    const egna = Array.isArray(x.gavor) ? x.gavor.filter(giltig) : [];
    gavor = (x.typ === 'van' ? [...(x.fri || !egna.length ? rulla(G, 'dag') : []), ...egna] : rulla(G, x.typ)).filter(Boolean);
    if (!gavor.length) gavor = [pengar(50, 100)];
    for (const gv of gavor) ge(A, gv);
    p.ko.splice(p.ko.indexOf(x), 1);
    if (x.typ !== 'van') p.antal += 1;
    G.glad?.(4, '', 'present', 10);
    G.save();
    planera();
    const knapp = dlg.querySelector('.dlg-foot .btn-go'); if (knapp) knapp.disabled = true;
  };
  cv.onclick = start;
  async function visa() {
    const box = dlg.querySelector('.pr-gavor'); box.classList.remove('hidden');
    dlg.querySelector('.pr-scen').classList.add('pr-klar');   // (paketet krymper – gåvorna får plats)
    dlg.querySelector('.pr-tips').textContent = storP ? $t('✨ En STOR present!') : $t('✨ Titta vad du fick!');
    box.innerHTML = gavor.map((gv, k) => `<div class="pr-gava" data-g="${k}"><span class="pr-bild"></span><b>${esc(gavaNamn(gv))}</b><small>${esc(gavaVart(gv))}</small>${gv.slag === 'plagg' ? `<button class="btn btn-small btn-gold" data-tapa="${k}">${$t('👕 Ta på')}</button>` : ''}</div>`).join('');
    for (const [k, gv] of gavor.entries()) box.querySelector(`[data-g="${k}"] .pr-bild`).append(await gavaBild(A, gv));
    box.querySelectorAll('[data-tapa]').forEach((b) => (b.onclick = () => {
      const it = itemById(gavor[+b.dataset.tapa].id);
      A.avatar = saveAvatar({ ...A.avatar, look: lookForItem(it, A.avatar.look, { colors: true }) });
      play('ok'); b.disabled = true; b.textContent = $t('✓ På dig!');
    }));
    const fot = dlg.querySelector('.dlg-foot');
    if (fot) { fot.innerHTML = ''; const b = document.createElement('button'); b.className = 'btn btn-go'; b.textContent = P(G).ko.length ? $t('🎁 Fler presenter') : $t('Tack!'); b.onclick = () => { cancelAnimationFrame(raf); if (P(G).ko.length) openPresenter(A); else closeModal(); }; fot.append(b); }
  }
}

// ---------- start: kolla presenten, morgonnotiserna, och en koll varje minut ----------
let startad = false;
export function startPresenter(A) {
  if (startad) return;
  startad = true;
  // morgonnotiserna kl. 7.30 de tre närmaste morgnarna (appen)
  setExtraNotiser((d) => {
    if (!A.game) return [];
    const ut = [];
    for (let k = 1; k <= 3; k++) {
      const m = new Date(d); m.setDate(m.getDate() + k); m.setHours(7, 30, 0, 0);
      const storDag = blirStor(A.game, k - 1);
      ut.push({ id: 100 + k, title: 'Pixelcity', body: storDag ? $t('🎁 I dag väntar en STOR present på dig i Pixelstaden!') : $t('🎁 En present väntar på dig i Pixelstaden!'), schedule: { at: m } });
    }
    return ut;
  });
  setTimeout(() => presenterKoll(A), 3000);
  setInterval(() => { if (!modalOpen()) presenterKoll(A); }, 60000);
}
