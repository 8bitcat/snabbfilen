// 🎯 KAST- OCH SKJUTSTÅNDEN på Pixelberg (scenen: js/scenes/pixelberg.js). Två klassiska tivolistånd – vinsterna är
// riktiga leksaker ur Leksaksaffärens katalog (js/data/toys.js) och hamnar i leksakslådan hemma (addToy).
//
//   • 🥫 BURKTORNET (15 kr): tre bollar mot ett torn av sex burkar. Siktet glider runt – tryck (mellanslag/Enter
//     eller ett klick) när det ligger rätt. En burk som träffas ramlar, och de som stod på den ramlar med.
//     Alla sex ner = STORA vinsten, fyra–fem = en liten, annars en tröstklubba.
//   • 🎯 SKJUTBANAN (20 kr): korkgevär, tio korkar på 25 sekunder mot plåtfigurer i tre rader: ankor (10 p),
//     stjärnor (20 p) och små snabba spöken (30 p). Sikta med musen/fingret (eller piltangenterna) och tryck för
//     att skjuta. 160 p = STORA vinsten, 80 p = en liten.
import { openModal, closeModal, toast, esc } from '../core/ui.js';
import { play } from '../core/sound.js';
import { fmt } from '../game.js';
import { TOYS, addToy, toyOf, toyNamn, toyIconURL } from '../data/toys.js';
import { SMALL, ctxText, textW } from '../core/floor-pix.js';
import { $t } from '../core/i18n.js';

export const KAST_PRIS = 15, SKJUT_PRIS = 20;
const SKJUT_TID = 25, KORKAR = 10, SKJUT_STOR = 160, SKJUT_LITEN = 80;

// ---------- vinsterna ----------
const STORA = () => ['nalle-stor', ...TOYS.filter((t) => t.grupp === 'klamkompis' && t.kategori === 'plysch').map((t) => t.id)].filter((id) => toyOf(id));
const SMA = () => ['nalle-liten', 'nalle-mellan', 'badanka', 'boll-studs'].filter((id) => toyOf(id));
// niva 2 = stora, 1 = liten, 0 = tröstklubba. Svarar med html för resultatraden.
function vinst(g, niva, nyckel) {
  if (!niva) { const h = g.glad?.(1, '', `tivoli-${nyckel}`, 1) || 0; g.save(); return `<p class="pb-vinst-text">${esc($t('🍬 Ingen vinst den här gången – men du får en tröstklubba!'))}${h ? ` +${h} 😊` : ''}</p>`; }
  const lista = niva === 2 ? STORA() : SMA(), id = lista[Math.floor(Math.random() * lista.length)], T = toyOf(id);
  addToy(g, id, 1);
  const h = g.glad?.(niva === 2 ? 4 : 2, '', `tivoli-${nyckel}`, 4) || 0;
  g.save();
  play(niva === 2 ? 'fanfare' : 'buy');
  return `<div class="pb-vinst"><img src="${toyIconURL(id, 3)}" alt=""><p class="pb-vinst-text">${esc(niva === 2 ? $t`🏆 STORA VINSTEN: ${toyNamn(T)}!` : $t`🧸 Du vann: ${toyNamn(T)}!`)}${h ? ` +${h} 😊` : ''}<br><small>${esc($t('Vinsten ligger i leksakslådan hemma.'))}</small></p></div>`;
}

// gemensamt: en canvas i en dialog, en egen bildruteloop och tangenterna (mellanslag/Enter/pilar) medan den syns
function spelruta(titel, w, h, knappar) {
  const dlg = openModal(titel, `<canvas class="pb-spel" width="${w}" height="${h}"></canvas><div class="pb-spel-text"></div>`, knappar);
  const cv = dlg.querySelector('.pb-spel'), ctx = cv.getContext('2d'), info = dlg.querySelector('.pb-spel-text');
  ctx.imageSmoothingEnabled = false;
  const pos = (e) => { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width * w, y: (e.clientY - r.top) / r.height * h }; };
  return { dlg, cv, ctx, info, pos, finns: () => document.body.contains(cv) };
}

// ---------- 🥫 burktornet ----------
const BURK_W = 10, BURK_H = 13, HYLLA = 64;
const BURKAR0 = () => [[63, 0], [75, 0], [87, 0], [69, 1], [81, 1], [75, 2]].map(([x, rad], i) => ({ x, y: HYLLA - BURK_H * (rad + 1), rad, i, ner: false, vx: 0, vy: 0, v: 0, borta: false, farg: ['#e04848', '#3a7bd5', '#f0c030', '#46a35a', '#d060a0', '#f08a2a'][i] }));
const STOD = { 3: [0, 1], 4: [1, 2], 5: [3, 4] };   // vilka burkar varje burk står på
export function openKast(A) {
  const g = A.game;
  if (g.money < KAST_PRIS) { toast($t`🥫 En omgång kostar ${fmt(KAST_PRIS)} – du har inte råd.`, 'bad'); return; }
  g.money -= KAST_PRIS; g.save(); play('coin');
  const W = 160, H = 100;
  const S = spelruta($t('🥫 Burktornet'), W, H, [{ label: $t('Stäng'), onClick: closeModal }]);
  const burkar = BURKAR0();
  let bollar = 3, flyg = null, t = 0, klar = false, slutT = 0, sist = performance.now();
  S.info.textContent = $t('Tryck när siktet ligger rätt – tre bollar. Fäll alla sex burkar!');
  let tvang = null;   // (testerna: sikta exakt)
  const sikte = () => tvang || { x: 80 + Math.sin(t * 1.9) * 50, y: 44 + Math.sin(t * 2.7 + 1) * 18 };
  const fall = (b, dx) => { if (b.ner) return; b.ner = true; b.vx = dx * (20 + Math.random() * 25); b.vy = -30 - Math.random() * 20; b.v = (Math.random() - 0.5) * 14; };
  function kasta() {
    if (klar || flyg || bollar <= 0) return;
    const m = sikte(); bollar -= 1; flyg = { t: 0, x0: 80, y0: H - 6, x1: m.x, y1: m.y }; play('slide');
  }
  function landa(x, y) {
    let traff = null;
    for (const b of burkar) if (!b.ner && x >= b.x - 3 && x <= b.x + BURK_W + 2 && y >= b.y - 3 && y <= b.y + BURK_H + 2) { if (!traff || b.rad < traff.rad) traff = b; }
    if (!traff) { play('miss'); return; }
    play('knock'); fall(traff, x < traff.x + BURK_W / 2 ? 1 : -1);
    if (traff.rad === 0 && Math.random() < 0.45) { const gr = burkar.find((b) => b.rad === 0 && !b.ner && Math.abs(b.x - traff.x) === 12); if (gr) fall(gr, gr.x > traff.x ? 1 : -1); }
  }
  const rita = () => {
    const c = S.ctx;
    c.fillStyle = '#2a1e30'; c.fillRect(0, 0, W, H); for (let x = 0; x < W; x += 10) { c.fillStyle = '#32243a'; c.fillRect(x, 10, 5, 60); }
    for (let x = 0; x < W; x += 16) { c.fillStyle = (x / 16) % 2 ? '#d8343c' : '#f4f1ea'; c.fillRect(x, 0, 16, 10); }   // markisen
    c.fillStyle = '#8a5a2e'; c.fillRect(40, HYLLA, 80, 4); c.fillStyle = '#b88a58'; c.fillRect(40, HYLLA, 80, 1); c.fillStyle = '#5a3a1e'; c.fillRect(44, HYLLA + 4, 3, 16); c.fillRect(113, HYLLA + 4, 3, 16);
    for (const b of burkar) {
      if (b.borta) continue;
      c.save(); c.translate(Math.round(b.x + BURK_W / 2), Math.round(b.y + BURK_H / 2)); c.rotate(b.v ? b.vinkel || 0 : 0);
      c.fillStyle = '#c8c8d4'; c.fillRect(-5, -6, 10, 13); c.fillStyle = b.farg; c.fillRect(-5, -3, 10, 7); c.fillStyle = 'rgba(255,255,255,.55)'; c.fillRect(-4, -6, 1, 13); c.fillStyle = 'rgba(0,0,0,.25)'; c.fillRect(3, -6, 2, 13); c.fillStyle = '#8a8a98'; c.fillRect(-5, -7, 10, 1); c.fillRect(-5, 6, 10, 1);
      c.restore();
    }
    c.fillStyle = '#a87a48'; c.fillRect(0, H - 14, W, 14); c.fillStyle = '#c89a68'; c.fillRect(0, H - 14, W, 2); c.fillStyle = '#6a4a2a'; c.fillRect(0, H - 2, W, 2);   // disken
    for (let k = 0; k < bollar; k++) { const bx = 10 + k * 9, by = H - 10; c.fillStyle = '#f4f1ea'; c.fillRect(bx - 3, by - 2, 7, 5); c.fillRect(bx - 2, by - 3, 5, 7); c.fillStyle = '#e04848'; c.fillRect(bx - 2, by, 5, 1); }
    if (flyg) { const u = flyg.t / 0.4, x = flyg.x0 + (flyg.x1 - flyg.x0) * u, y = flyg.y0 + (flyg.y1 - flyg.y0) * u - Math.sin(u * Math.PI) * 18, r = Math.round(4 - u * 2); c.fillStyle = '#f4f1ea'; c.fillRect(Math.round(x - r), Math.round(y - r + 1), r * 2 + 1, r * 2 - 1); c.fillRect(Math.round(x - r + 1), Math.round(y - r), r * 2 - 1, r * 2 + 1); }
    if (!klar && bollar > 0 && !flyg) { const m = sikte(), x = Math.round(m.x), y = Math.round(m.y); c.fillStyle = '#ffe060'; c.fillRect(x - 6, y, 4, 1); c.fillRect(x + 3, y, 4, 1); c.fillRect(x, y - 6, 1, 4); c.fillRect(x, y + 3, 1, 4); c.fillStyle = '#e04848'; c.fillRect(x, y, 1, 1); }
    const nere = burkar.filter((b) => b.ner).length, s = $t`BURKAR NERE ${nere}/6`; ctxText(c, SMALL, s, W - textW(SMALL, s) - 4, H - 10, '#1e1a24');
  };
  const steg = (nu) => {
    if (!S.finns()) { removeEventListener('keydown', tangent, true); return; }
    const dt = Math.min(0.05, (nu - sist) / 1000); sist = nu; t += dt;
    if (flyg) { flyg.t += dt; if (flyg.t >= 0.4) { const f = flyg; flyg = null; landa(f.x1, f.y1); } }
    for (const b of burkar) if (!b.ner && STOD[b.i] && STOD[b.i].some((j) => burkar[j].ner)) fall(b, Math.random() < 0.5 ? -1 : 1);
    for (const b of burkar) if (b.ner && !b.borta) { b.vy += 260 * dt; b.x += b.vx * dt; b.y += b.vy * dt; b.vinkel = (b.vinkel || 0) + b.v * dt; if (b.y > H + 20) b.borta = true; }
    if (!klar && bollar <= 0 && !flyg) { slutT += dt; if (slutT > 1.2 || burkar.every((b) => b.borta || !b.ner)) slut(); }
    if (!klar && burkar.every((b) => b.ner) && !flyg) { slutT += dt; if (slutT > 0.8) slut(); }
    rita();
    requestAnimationFrame(steg);
  };
  function slut() {
    if (klar) return; klar = true;
    const nere = burkar.filter((b) => b.ner).length;
    S.info.innerHTML = `<p class="pb-vinst-text">${esc($t`Burkar nere: ${nere} av 6.`)}</p>` + vinst(g, nere === 6 ? 2 : nere >= 4 ? 1 : 0, 'kast');
    const foot = S.dlg.querySelector('.dlg-foot');
    if (foot && !foot.querySelector('[data-igen]')) { const b = document.createElement('button'); b.className = 'btn btn-go'; b.dataset.igen = '1'; b.textContent = $t`🥫 En omgång till · ${fmt(KAST_PRIS)}`; b.disabled = g.money < KAST_PRIS; b.onclick = () => { closeModal(); openKast(A); }; foot.prepend(b); }
  }
  const tangent = (e) => { if (!S.finns()) { removeEventListener('keydown', tangent, true); return; } if (e.key === ' ' || e.key === 'Enter') { if (klar) return; e.preventDefault(); e.stopImmediatePropagation(); kasta(); } };
  addEventListener('keydown', tangent, true);
  S.cv.addEventListener('pointerdown', (e) => { e.preventDefault(); kasta(); });
  globalThis.__burktornet = { kasta, burkar, sikte, sikta: (x, y) => { tvang = { x, y }; }, bollar: () => bollar, klar: () => klar };
  requestAnimationFrame(steg);
}

// ---------- 🎯 skjutbanan ----------
const RADER = [
  { y: 30, typ: 'stjarna', p: 20, fart: -24, steg: 34 },
  { y: 54, typ: 'spoke', p: 30, fart: 46, steg: 46 },
  { y: 80, typ: 'anka', p: 10, fart: -18, steg: 30 },
];
const FIG = {
  anka: { w: 12, h: 10, rad: ['...yy.......', '..yyyy......', '..yky.yo....', '..yyyyoo....', '...yy.......', '.yyyyyyyy...', 'yyyyyyyyyyy.', 'yyyyyyyyyy..', '.yyyyyyyy...', '..gggggg....'] },
  stjarna: { w: 11, h: 11, rad: ['.....s.....', '....sss....', '....sss....', 'sssssssssss', '.sssskssss.', '..sssssss..', '..sssssss..', '.sss...sss.', '.ss.....ss.', 'ss.......ss', '...ggggg...'] },
  spoke: { w: 9, h: 10, rad: ['..wwwww..', '.wwwwwww.', 'wwkwwwkww', 'wwkwwwkww', 'wwwwwwwww', 'wwwwkwwww', 'wwwwwwwww', 'wwwwwwwww', 'w.ww.ww.w', '..ggggg..'] },
};
const FIGF = { y: '#f0c030', o: '#f08a2a', k: '#1e1a24', s: '#ffe060', w: '#f4f1ea', g: '#5a5a66' };
export function openSkjut(A) {
  const g = A.game;
  if (g.money < SKJUT_PRIS) { toast($t`🎯 En omgång kostar ${fmt(SKJUT_PRIS)} – du har inte råd.`, 'bad'); return; }
  g.money -= SKJUT_PRIS; g.save(); play('coin');
  const W = 180, H = 104;
  const S = spelruta($t('🎯 Skjutbanan'), W, H, [{ label: $t('Stäng'), onClick: closeModal }]);
  S.cv.style.cursor = 'none';
  let t = 0, kvar = KORKAR, poang = 0, klar = false, sist = performance.now(), poff = [];
  const sikt = { x: W / 2, y: H / 2 }, pilar = new Set();
  const nere = new Map();   // figurens nyckel → tid kvar nere
  S.info.textContent = $t`Tio korkar, ${SKJUT_TID} sekunder. Anka 10 p · stjärna 20 p · spöke 30 p.`;
  const figurer = () => { const ut = []; RADER.forEach((r, ri) => { const span = W + r.steg * 2; for (let k = 0; k < Math.ceil(span / r.steg); k++) { const x = ((k * r.steg + t * r.fart) % span + span) % span - r.steg; ut.push({ key: `${ri}:${k}`, x, y: r.y, r, f: FIG[r.typ] }); } }); return ut; };
  function skjut() {
    if (klar || kvar <= 0) return;
    kvar -= 1; play('knock');
    poff.push({ x: sikt.x, y: sikt.y, t: 0 });
    const traff = figurer().filter((f) => !nere.has(f.key) && sikt.x >= f.x && sikt.x < f.x + f.f.w && sikt.y >= f.y - f.f.h && sikt.y < f.y).sort((a, b) => b.r.y - a.r.y)[0];
    if (traff) { nere.set(traff.key, 3); poang += traff.r.p; play('coin'); poff.at(-1).p = traff.r.p; }
    if (kvar <= 0) setTimeout(slut, 700);
  }
  const rita = () => {
    const c = S.ctx;
    c.fillStyle = '#1a2448'; c.fillRect(0, 0, W, H);
    for (let k = 0; k < 30; k++) { c.fillStyle = k % 3 ? '#3a4a88' : '#ffe060'; c.fillRect((k * 53) % W, (k * 29) % 70, 1, 1); }
    for (let x = 0; x < W; x += 18) { c.fillStyle = (x / 18) % 2 ? '#3a7bd5' : '#f4f1ea'; c.fillRect(x, 0, 18, 8); }
    for (const f of figurer()) {
      const ner = nere.has(f.key), x = Math.round(f.x), y = f.y;
      if (ner) { c.fillStyle = '#5a5a66'; c.fillRect(x, y - 3, f.f.w, 3); c.fillStyle = '#8a8a98'; c.fillRect(x, y - 3, f.f.w, 1); continue; }
      f.f.rad.forEach((rad, j) => { for (let i = 0; i < rad.length; i++) { const ch = rad[i]; if (ch === '.') continue; c.fillStyle = FIGF[ch]; c.fillRect(x + i, y - f.f.h + j, 1, 1); } });
    }
    for (const r of RADER) { c.fillStyle = '#5a3a1e'; c.fillRect(0, r.y, W, 3); c.fillStyle = '#8a5a2e'; c.fillRect(0, r.y, W, 1); }
    c.fillStyle = '#a87a48'; c.fillRect(0, H - 12, W, 12); c.fillStyle = '#c89a68'; c.fillRect(0, H - 12, W, 2);
    for (const p of poff) { c.fillStyle = `rgba(255,255,255,${(1 - p.t / 0.5).toFixed(2)})`; c.fillRect(Math.round(p.x) - 2, Math.round(p.y) - 2, 5, 5); if (p.p) ctxText(c, SMALL, `+${p.p}`, Math.round(p.x) + 4, Math.round(p.y) - 8 - Math.round(p.t * 10), '#ffe060'); }
    if (!klar) { const x = Math.round(sikt.x), y = Math.round(sikt.y); c.fillStyle = '#ff4848'; c.fillRect(x - 5, y, 3, 1); c.fillRect(x + 3, y, 3, 1); c.fillRect(x, y - 5, 1, 3); c.fillRect(x, y + 3, 1, 3); c.fillRect(x - 2, y - 2, 1, 1); c.fillRect(x + 2, y - 2, 1, 1); c.fillRect(x - 2, y + 2, 1, 1); c.fillRect(x + 2, y + 2, 1, 1); }
    const s = $t`POÄNG ${poang}   KORKAR ${kvar}   TID ${Math.max(0, Math.ceil(SKJUT_TID - t))}`; ctxText(c, SMALL, s, 4, H - 8, '#1e1a24');
  };
  const steg = (nu) => {
    if (!S.finns()) { removeEventListener('keydown', ner, true); removeEventListener('keyup', upp, true); return; }
    const dt = Math.min(0.05, (nu - sist) / 1000); sist = nu;
    if (!klar) t += dt;
    for (const [k, v] of [...nere]) { if (v - dt <= 0) nere.delete(k); else nere.set(k, v - dt); }
    for (const p of poff) p.t += dt; poff = poff.filter((p) => p.t < 0.5);
    const v = 90 * dt; if (pilar.has('v')) sikt.x -= v; if (pilar.has('h')) sikt.x += v; if (pilar.has('u')) sikt.y -= v; if (pilar.has('n')) sikt.y += v;
    sikt.x = Math.max(2, Math.min(W - 3, sikt.x)); sikt.y = Math.max(10, Math.min(H - 14, sikt.y));
    if (!klar && t >= SKJUT_TID) slut();
    rita();
    requestAnimationFrame(steg);
  };
  function slut() {
    if (klar) return; klar = true; S.cv.style.cursor = '';
    S.info.innerHTML = `<p class="pb-vinst-text">${esc($t`Poäng: ${poang}.`)}</p>` + vinst(g, poang >= SKJUT_STOR ? 2 : poang >= SKJUT_LITEN ? 1 : 0, 'skjut');
    const foot = S.dlg.querySelector('.dlg-foot');
    if (foot && !foot.querySelector('[data-igen]')) { const b = document.createElement('button'); b.className = 'btn btn-go'; b.dataset.igen = '1'; b.textContent = $t`🎯 En omgång till · ${fmt(SKJUT_PRIS)}`; b.disabled = g.money < SKJUT_PRIS; b.onclick = () => { closeModal(); openSkjut(A); }; foot.prepend(b); }
  }
  const PIL = { ArrowLeft: 'v', ArrowRight: 'h', ArrowUp: 'u', ArrowDown: 'n' };
  const ner = (e) => { if (!S.finns()) return; if (PIL[e.key]) { e.preventDefault(); e.stopImmediatePropagation(); pilar.add(PIL[e.key]); } else if ((e.key === ' ' || e.key === 'Enter') && !klar) { e.preventDefault(); e.stopImmediatePropagation(); skjut(); } };
  const upp = (e) => { if (PIL[e.key]) pilar.delete(PIL[e.key]); };
  addEventListener('keydown', ner, true); addEventListener('keyup', upp, true);
  S.cv.addEventListener('pointermove', (e) => { const p = S.pos(e); sikt.x = p.x; sikt.y = p.y; });
  S.cv.addEventListener('pointerdown', (e) => { e.preventDefault(); const p = S.pos(e); sikt.x = p.x; sikt.y = p.y; skjut(); });
  globalThis.__skjutbanan = { skjut, sikt, figurer, nere, poang: () => poang, kvar: () => kvar, klar: () => klar, spola: (s) => { t += s; } };
  requestAnimationFrame(steg);
}
