// 🎡 PIXELBERG – tivolit på berget (kartan, marken och byggnaderna: js/pixelberg/karta.js). Hit kommer man med
// BERGBUSSEN från vilken busshållplats som helst i staden (city.js: raden "🎡 PIXELBERG" i hållplatsdialogen) och
// hem igen från bergbussens hållplats här uppe.
//
//   • 🎟️ BILJETTLUCKAN: åkband för hela dagen (100 kr) – annars kostar varje tur en kupong (20 kr)
//   • 🎠 KARUSELLEN: hästarna snurrar och guppar; man sitter själv på en häst två varv
//   • 🎡 PARISERHJULET: ett varv i en gondol – kameran följer med upp, och högst upp syns hela Pixelstaden
//   • 🍭 SOCKERVADD & POPCORN och 🎰 LYCKOHJULET (vinster: kortpaket, pengar, godis – eller en nitlott)
//   • 🎢 BERG-OCH-DALBANAN (Carl 2026-10-13: "man ska kunna åka berg-och-dalbanan med en kompis"): tåget går på
//     KLOCKAN – var 32:a sekund, 10 s vid stationen och 21 s ute på banan – så alla spelare ser samma tåg på samma
//     ställe. Man kliver på vid stationen (är tåget ute ställer man sig först i kön till nästa); kliver en kompis på
//     samma tåg sitter ni ihop (världen skickar 'bana:<avgång>:<plats>', js/net/world.js) – ni ser varandra i
//     vagnarna med namnlapp, armarna åker upp i nedförsbackarna. Tre vagnar × två platser; lediga platser fylls av
//     besökare. Radiobilarna och spökhuset kommer i nästa steg.
// Besökare med ballonger, björnmaskoten Pixel-Nalle som vinkar, och på kvällen tänds glödlamporna överallt.
import { createCityWalker } from '../city/walk.js';
import { selfDrawable, folkDrawables, createSpeech, WALK_SEQ, nameTag } from './walkable.js';
import { worldFolksHere } from '../net/world.js';
import { openModal, closeModal, toast, esc } from '../core/ui.js';
import { play } from '../core/sound.js';
import { SMALL, BIG, ctxText, textW, hash } from '../core/floor-pix.js';
import { fmt } from '../game.js';
import { drawPerson, makeLook } from '../core/people.js';
import { createPetWalk } from '../pets/outdoors.js';
import { skyCanvas } from '../landet/karta.js';
import { propKit } from '../city/props.js';
import { BUS_STOPS } from '../city/map.js';
import { laggTill, draPaket } from '../core/pixelkort.js';
import { TW, TH, P, HALLPLATS, PORT, BILJETT, KARUSELL, HJUL, STAND, BANA, BANKAR, LYKTOR, BUSKAR, SPAR, hinder, paintGround, utsiktCanvas, biljettBild, standBild, stationBild, banaBild, portBild } from '../pixelberg/karta.js';
import { $t } from '../core/i18n.js';

const GANG = 100, KUPONG = 20, BAND = 100, HJULVARV = 26, KARUSELLVARV = 9;
const GONDOLER = 10, HASTAR = 8;
// 🎢 berg-och-dalbanan går på klockan (samma för alla spelare): CYKEL s per avgång, PASTIG s vid stationen, TUR s ute
const CYKEL = 32, PASTIG = 10, TUR = 21, PLATSER = 6, START = 15, VAGNAVSTAND = 6;
const nuS = () => (globalThis.__tivoliNu ?? Date.now()) / 1000;   // (testerna styr klockan)
// tidtabellen längs spåret: kedjan drar sakta upp för första backen, sedan går det fortare ju lägre tåget är
const TID = (() => {
  const n = SPAR.length, t = [0];
  for (let k = 1; k <= n; k++) {
    const a = SPAR[(START + k - 1) % n], b = SPAR[(START + k) % n], ds = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const kedja = b[1] < a[1] - 0.3 && a[0] < 1380;
    t.push(t[k - 1] + ds / (kedja ? 14 : 30 + Math.max(0, b[1] - 96) * 1.4));
  }
  return t.map((x) => x / t[n] * TUR);
})();
const indexVid = (tau) => {
  if (tau <= 0) return 0;
  if (tau >= TUR) return SPAR.length;
  let lo = 0, hi = SPAR.length;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (TID[m] <= tau) lo = m; else hi = m; }
  return lo + (tau - TID[lo]) / Math.max(1e-6, TID[hi] - TID[lo]);
};
export function banLage() { const s = nuS(), n = Math.floor(s / CYKEL), u = s - n * CYKEL; return { n, u, station: u < PASTIG, tau: Math.max(0, u - PASTIG), kvar: PASTIG - u }; }
// vagn c (0 = den främsta): punkten på spåret och om den åker nedför
function vagn(c, L) {
  const n = SPAR.length, i = (START + (L.station ? 0 : indexVid(L.tau)) - c * VAGNAVSTAND + n * 4) % n;
  const i0 = Math.floor(i), u = i - i0, a = SPAR[i0], b = SPAR[(i0 + 1) % n];
  return { x: a[0] + (b[0] - a[0]) * u, y: a[1] + (b[1] - a[1]) * u, ner: !L.station && b[1] > a[1] + 0.25 };
}
const AKTUR = /^bana:(\d+):([0-5])$/;
const PRAT = [
  $t('Pariserhjulet är bäst – man ser ända bort till bron!'), $t('Jag har åkt karusell fem gånger i dag!'), $t('Sockervadden här är rosa OCH blå!'),
  $t('Vågar du åka berg-och-dalbanan när den öppnar?'), $t('Jag vann ett kortpaket på lyckohjulet!'), $t('På kvällen lyser hela tivolit.'),
];
const GODIS = [
  { id: 'sockervadd', namn: $t('🍭 Sockervadd'), pris: 20, hunger: 8, glad: 3 },
  { id: 'popcorn', namn: $t('🍿 Popcorn'), pris: 25, hunger: 12, glad: 2 },
  { id: 'klubba', namn: $t('🍬 Tivoliklubba'), pris: 15, hunger: 3, glad: 2 },
];
// lyckohjulets åtta fält (samma ordning som färgerna på hjulet)
const LYCKA = [
  { id: 'paket', namn: $t('🃏 Ett kortpaket!') }, { id: 'niete', namn: $t('Nitlott – försök igen!') }, { id: 'p50', namn: $t('💰 50 kr!') }, { id: 'niete', namn: $t('Nitlott – försök igen!') },
  { id: 'godis', namn: $t('🍬 En tivoliklubba!') }, { id: 'niete', namn: $t('Nitlott – försök igen!') }, { id: 'p20', namn: $t('💰 20 kr!') }, { id: 'godis', namn: $t('🍭 En sockervadd!') },
];
const LYCKA_FARG = ['#e04848', '#f4f1ea', '#3a7bd5', '#f4f1ea', '#46a35a', '#f4f1ea', '#d060a0', '#f4f1ea'];

export function makePixelberg(A) {
  const g = A.game;
  let VW = Math.max(384, Math.min(A.W || 384, TW)), VH = Math.max(160, Math.min(A.H || 216, TH));
  const from = A.pixelbergFran || null; A.pixelbergFran = null;
  const walker = createCityWalker({ W: TW, H: TH, left: 2, right: TW - 2, top: P.TOP, bottom: P.BOTTOM, spawn: [HALLPLATS.x + 14, HALLPLATS.y + 4] });
  walker.speed = GANG;
  walker.setObstacles(hinder());
  walker.snapFree();
  walker.dir = 'right';
  const talk = createSpeech();
  let t = 0, hover = null, banner = 0;
  const fade = { a: 1, phase: 2, cb: null };
  const cam = { x: 0, y: 0 };
  let aka = null;   // pågående åktur: { typ: 'hjul' | 'karusell', t, i (gondolen/hästen) } eller { typ: 'bana', n (avgången), plats }
  const sitterIBana = () => aka?.typ === 'bana' && banLage().n === aka.n;
  const jagPos = () => { if (!aka || (aka.typ === 'bana' && !sitterIBana())) return { x: walker.px, y: walker.py }; if (aka.typ === 'bana') { const v = vagn(Math.floor(aka.plats / 2), banLage()); return { x: v.x, y: v.y - 14 }; } if (aka.typ === 'hjul') { const p = gondol(aka.i); return { x: p.x, y: p.y + 8 }; } const h = hast(aka.i); return { x: h.x, y: h.y }; };
  const camTarget = () => { const p = jagPos(); return { x: Math.max(0, Math.min(TW - VW, p.x - VW / 2)), y: Math.max(0, Math.min(TH - VH, p.y - VH * (aka?.typ === 'hjul' || sitterIBana() ? 0.5 : 0.8))) }; };
  Object.assign(cam, camTarget());
  if (!A.attract && from) { const h = g.glad?.(3, '', 'pixelberg', 3); setTimeout(() => toast(h ? $t`🎡 Välkommen till Pixelbergs tivoli! +${h} 😊` : $t('🎡 Välkommen till Pixelbergs tivoli!'), 'good'), 900); }
  let pets = null;
  try { pets = createPetWalk(A); } catch (e) { console.error('husdjuren på Pixelberg startade inte:', e); }

  // ---------- biljetterna ----------
  const harBand = () => g.tivoli?.band === g.day;
  function betala(vad) {
    if (harBand()) return true;
    if (g.money < KUPONG) { toast($t`🎟️ En åkkupong kostar ${fmt(KUPONG)} – du har inte råd. (Eller köp ett åkband i biljettluckan.)`, 'bad'); return false; }
    g.money -= KUPONG; g.save(); play('coin'); toast($t`🎟️ ${vad}: en kupong, ${fmt(KUPONG)}.`);
    return true;
  }

  // ---------- pariserhjulet och karusellen ----------
  const hjulVinkel = () => t * (Math.PI * 2 / HJULVARV);
  const gondol = (i) => { const v = hjulVinkel() + i * (Math.PI * 2 / GONDOLER); return { x: HJUL.x + Math.cos(v) * HJUL.r, y: HJUL.y + Math.sin(v) * HJUL.r + 12, v }; };
  const karVinkel = () => t * (Math.PI * 2 / KARUSELLVARV);
  const hast = (i) => { const v = karVinkel() + i * (Math.PI * 2 / HASTAR); return { x: KARUSELL.x + Math.cos(v) * (KARUSELL.rx - 16), y: KARUSELL.y + Math.sin(v) * (KARUSELL.ry - 6), v, upp: Math.round(Math.sin(t * 3 + i * 1.7) * 2), dir: Math.sin(v) > 0 ? 'left' : 'right' }; };
  // NPC:er i några gondoler och på några hästar
  const gondolFolk = new Map([[1, makeLook()], [4, makeLook()], [7, makeLook()]]);
  const hastFolk = new Map([[0, { ...makeLook(), kid: true }], [3, makeLook()], [5, { ...makeLook(), kid: true }]]);
  function akHjul() {
    if (aka || !betala($t('Pariserhjulet'))) return;
    // närmaste lediga gondol längst ner
    let basta = 0, bastY = -1e9;
    for (let i = 0; i < GONDOLER; i++) { if (gondolFolk.has(i)) continue; const p = gondol(i); if (p.y > bastY) { bastY = p.y; basta = i; } }
    aka = { typ: 'hjul', t: 0, i: basta, toppen: false };
    walker.stop(); play('door');
    toast($t('🎡 Du kliver in i gondolen – håll i dig!'));
  }
  function akKarusell() {
    if (aka || !betala($t('Karusellen'))) return;
    let ledig = 0; for (let i = 0; i < HASTAR; i++) if (!hastFolk.has(i)) { ledig = i; break; }
    aka = { typ: 'karusell', t: 0, i: ledig };
    walker.stop(); play('fanfare');
  }
  // 🎢 vem sitter var i tåget för avgången L.n: jag, kompisarna (world.js ak) och påhittade besökare på några lediga platser
  const NPC_BANA = [0, 1, 2, 3, 4, 5, 6, 7].map(() => makeLook());
  function aakare(L) {
    const p = new Array(PLATSER).fill(null);
    if (aka?.typ === 'bana' && aka.n === L.n) p[aka.plats] = { jag: true, look: A.avatar.look, namn: A.avatar.name };
    for (const f of worldFolksHere(A)) { const m = AKTUR.exec(f.ak || ''); if (m && +m[1] === L.n && !p[+m[2]]) p[+m[2]] = { look: f.av.look, namn: f.av.name, av: f.av }; }
    for (let i = 0; i < PLATSER; i++) if (!p[i] && hash(L.n, i, 61) < 0.4) p[i] = { look: NPC_BANA[(L.n + i) % NPC_BANA.length], npc: true };
    return p;
  }
  // kliv på vid stationen (står tåget inne – är det ute ställer man sig i kön till nästa)
  function akBana() {
    if (aka) return;
    const L = banLage(), n = L.station && L.u < PASTIG - 1.5 ? L.n : L.n + 1;
    if (!betala($t('Berg-och-dalbanan'))) return;
    const tagna = new Set(worldFolksHere(A).map((f) => AKTUR.exec(f.ak || '')).filter((m) => m && +m[1] === n).map((m) => +m[2]));
    let plats = 0; while (plats < PLATSER - 1 && tagna.has(plats)) plats += 1;
    aka = { typ: 'bana', n, plats, ihop: new Set(), skrek: false };
    walker.stop(); walker.px = BANA.station.x + 40; walker.py = BANA.station.y + 10; walker.dir = 'up';
    if (n === L.n) { play('door'); toast($t`🎢 Du sätter dig i vagn ${Math.floor(plats / 2) + 1} – tåget går om ${Math.max(1, Math.ceil(L.kvar))} sekunder!`, 'good'); }
    else toast($t`🎢 Tåget är ute på banan – du ställer dig först i kön. Nästa tåg går om ${Math.max(1, Math.ceil(CYKEL - L.u))} sekunder.`, 'good');
  }
  function avAka() {
    const typ = aka.typ;
    aka = null;
    if (typ === 'hjul') { walker.px = HJUL.x; walker.py = HJUL.fot + 12; const h = g.glad?.(4, '', 'pariserhjul', 4) || 0; toast(h ? $t`🎡 Vilken utsikt! +${h} 😊` : $t('🎡 Vilken utsikt!'), 'good'); }
    else if (typ === 'bana') { walker.px = BANA.station.x + 70; walker.py = BANA.station.y + 12; const h = g.glad?.(5, '', 'bana', 5) || 0; toast(h ? $t`🎢 Wow, vilken fart! +${h} 😊` : $t('🎢 Wow, vilken fart!'), 'good'); }
    else { walker.px = KARUSELL.x; walker.py = KARUSELL.y + KARUSELL.ry + 10; const h = g.glad?.(3, '', 'karusell', 3) || 0; toast(h ? $t`🎠 Wiii! +${h} 😊` : $t('🎠 Wiii!'), 'good'); }
    walker.stop(); walker.snapFree(); walker.dir = 'down';
    g.passTime?.(10); g.save();
  }

  // ---------- besökarna och maskoten ----------
  const rnd = (a, b) => a + Math.random() * (b - a);
  const mal = () => ({ x: rnd(260, TW - 360), y: rnd(P.TORG[0] + 30, P.BOTTOM - 8) });
  const BALLONG = ['#e04848', '#3a7bd5', '#f0c030', '#46a35a', '#d060a0'];
  const besok = [0, 1, 2, 3, 4, 5, 6].map((i) => { const m = mal(); return { look: i % 3 === 0 ? { ...makeLook(), kid: true } : makeLook(), x: m.x, y: m.y, tx: m.x, ty: m.y, dir: 'right', vila: rnd(0, 3), ballong: i % 2 === 0 ? BALLONG[i % BALLONG.length] : null, rad: PRAT[i % PRAT.length] }; });
  const nalle = { x: 700, y: 400, tx: 700, ty: 400, dir: 'right', vila: 2, vinkar: 0 };
  function updLiv(dt) {
    for (const o of [...besok, nalle]) {
      if (o.vila > 0) { o.vila -= dt; continue; }
      const dx = o.tx - o.x, dy = o.ty - o.y, d = Math.hypot(dx, dy), step = 22 * dt;
      if (d <= step) { o.x = o.tx; o.y = o.ty; o.vila = rnd(2, 6); const m = mal(); o.tx = m.x; o.ty = m.y; if (o === nalle) nalle.vinkar = 2; continue; }
      o.x += dx / d * step; o.y += dy / d * step; o.dir = dx < 0 ? 'left' : 'right';
    }
    if (nalle.vinkar > 0) nalle.vinkar -= dt;
  }

  // ---------- platserna ----------
  const spots = () => [
    { id: 'hjul', r: [HJUL.x - 40, HJUL.fot - 40, HJUL.x + 40, HJUL.fot + 4], go: [HJUL.x, HJUL.fot + 10], label: $t('PARISERHJULET – ETT VARV MED UTSIKT'), act: akHjul },
    { id: 'karusell', r: [KARUSELL.x - KARUSELL.rx, KARUSELL.y - 80, KARUSELL.x + KARUSELL.rx, KARUSELL.y + KARUSELL.ry], go: [KARUSELL.x, KARUSELL.y + KARUSELL.ry + 10], label: $t('KARUSELLEN'), act: akKarusell },
    { id: 'biljett', r: [BILJETT.x, BILJETT.y - 64, BILJETT.x + BILJETT.w, BILJETT.y], go: [BILJETT.x + BILJETT.w / 2, BILJETT.y + 8], label: $t('BILJETTER – ÅKBAND OCH KUPONGER'), act: biljetter },
    { id: 'godis', r: [STAND[0].x, STAND[0].y - 66, STAND[0].x + STAND[0].w, STAND[0].y], go: [STAND[0].x + STAND[0].w / 2, STAND[0].y + 8], label: STAND[0].namn, act: godisStand },
    { id: 'lycka', r: [STAND[1].x, STAND[1].y - 66, STAND[1].x + STAND[1].w, STAND[1].y], go: [STAND[1].x + STAND[1].w / 2, STAND[1].y + 8], label: STAND[1].namn, act: lyckohjulet },
    { id: 'bana', r: [BANA.station.x, BANA.station.y - 50, BANA.station.x + BANA.station.w, BANA.station.y], go: [BANA.station.x + BANA.station.w / 2, BANA.station.y + 8], label: $t('BERG-OCH-DALBANAN – ÅK MED EN KOMPIS!'), act: akBana },
    { id: 'buss', r: [HALLPLATS.x - 12, HALLPLATS.y - 34, HALLPLATS.x + 14, HALLPLATS.y + 2], go: [HALLPLATS.x + 8, HALLPLATS.y + 6], label: $t('BERGBUSSEN NER TILL STAN'), act: bussen },
  ];
  function biljetter() {
    play('click');
    openModal($t('🎟️ Biljetter'), `<p style="font-size:var(--f2);margin-top:0">${harBand() ? $t('Du har åkband i dag – åk hur mycket du vill! 🎉') : $t`Varje åktur kostar en kupong (${fmt(KUPONG)}). Med ett åkband åker du hur mycket du vill hela dagen.`}</p>`, [
      { label: $t`🎟️ Åkband · ${fmt(BAND)}`, cls: 'btn-go', hidden: harBand(), disabled: g.money < BAND, onClick: () => { if (g.money < BAND) return; g.money -= BAND; g.tivoli = { ...(g.tivoli || {}), band: g.day }; g.save(); closeModal(); play('buy'); toast($t('🎟️ Åkbandet sitter på handleden – åk hur mycket du vill i dag!'), 'good'); } },
      { label: $t('Stäng'), onClick: closeModal },
    ]);
  }
  function godisStand() {
    play('click');
    const rad = (m) => `<div class="prow" style="grid-template-columns:1fr auto"><span class="nm">${esc(m.namn)}</span><button class="btn btn-small btn-go" data-godis="${m.id}" ${g.money < m.pris ? 'disabled' : ''}>${esc(fmt(m.pris))}</button></div>`;
    const dlg = openModal($t('🍭 Sockervadd & popcorn'), `<div class="plist">${GODIS.map(rad).join('')}</div>`, [{ label: $t('Inget, tack'), onClick: closeModal }]);
    dlg.querySelectorAll('[data-godis]').forEach((b) => (b.onclick = () => {
      const m = GODIS.find((x) => x.id === b.dataset.godis); if (!m || g.money < m.pris) return;
      g.money -= m.pris; g.hunger = Math.min(100, (g.hunger || 0) + m.hunger);
      const h = g.glad?.(m.glad, '', `tivoli-${m.id}`, m.glad) || 0;
      g.save(); closeModal(); play('buy'); toast(`${m.namn.split(' ')[0]} ${h ? $t`Mums! +${h} 😊` : $t('Mums!')}`, 'good');
    }));
  }
  // 🎰 lyckohjulet: 10 kr, hjulet snurrar och stannar på ett fält
  function lyckohjulet() {
    play('click');
    const dlg = openModal($t('🎰 Lyckohjulet'), `<canvas class="pb-lycka" width="96" height="96"></canvas><p class="pb-lycka-text">${$t`Ett snurr kostar ${fmt(10)}. Vinster: kortpaket, pengar och godis!`}</p>`, [
      { label: $t`🎰 Snurra · ${fmt(10)}`, cls: 'btn-go', disabled: g.money < 10, onClick: () => snurra() },
      { label: $t('Stäng'), onClick: closeModal },
    ]);
    const cv = dlg.querySelector('.pb-lycka'), x = cv.getContext('2d'), txt = dlg.querySelector('.pb-lycka-text');
    let vinkel = 0, snurrar = false;
    const rita = () => {
      x.clearRect(0, 0, 96, 96);
      const cx = 48, cy = 50, r = 40;
      for (let yy = -r; yy <= r; yy++) for (let xx = -r; xx <= r; xx++) {
        const d = Math.hypot(xx, yy); if (d > r) continue;
        const seg = Math.floor((((Math.atan2(yy, xx) - vinkel) % (Math.PI * 2) + Math.PI * 4) % (Math.PI * 2)) / (Math.PI / 4));
        x.fillStyle = d > r - 3 ? '#f0c030' : d > r - 4 ? '#8a6a1a' : LYCKA_FARG[seg]; x.fillRect(cx + xx, cy + yy, 1, 1);
      }
      x.fillStyle = '#f0c030'; x.fillRect(cx - 3, cy - 3, 7, 7); x.fillStyle = '#8a6a1a'; x.fillRect(cx - 1, cy - 1, 3, 3);
      x.fillStyle = '#1e1a24'; x.fillRect(cx - 4, 2, 9, 3); x.fillRect(cx - 2, 5, 5, 3); x.fillRect(cx - 1, 8, 3, 2);   // pilen
    };
    rita();
    function snurra() {
      if (snurrar || g.money < 10) return;
      g.money -= 10; g.save(); snurrar = true; play('click');
      const vinst = Math.floor(Math.random() * 8), mal0 = vinkel + Math.PI * 2 * (4 + Math.random()) ;
      // pilen pekar uppåt (-90°): fältet under pilen ska bli 'vinst' när hjulet stannar
      const slut = -Math.PI / 2 - (vinst + 0.5) * (Math.PI / 4), varv = Math.ceil((mal0 - slut) / (Math.PI * 2));
      const malV = slut + varv * Math.PI * 2, start = vinkel, t0 = performance.now(), T = 3200;
      const steg = (nu) => {
        if (!document.body.contains(cv)) return;
        const u = Math.min(1, (nu - t0) / T), e = 1 - Math.pow(1 - u, 3);
        const fore = vinkel; vinkel = start + (malV - start) * e;
        if (Math.floor(fore / (Math.PI / 4)) !== Math.floor(vinkel / (Math.PI / 4))) play('click');
        rita();
        if (u < 1) { requestAnimationFrame(steg); return; }
        snurrar = false;
        const V = LYCKA[vinst];
        if (V.id === 'paket') { const ids = draPaket(3); laggTill(g, ids); play('fanfare'); }
        else if (V.id === 'p50') { g.money += 50; play('coin'); }
        else if (V.id === 'p20') { g.money += 20; play('coin'); }
        else if (V.id === 'godis') { g.glad?.(2, '', 'tivoli-lycka', 2); play('ok'); }
        else play('miss');
        g.save();
        txt.textContent = V.namn;
      };
      requestAnimationFrame(steg);
    }
  }
  function bussen() {
    const rad = (s) => `<div class="prow shoprow"><span style="font-size:28px;text-align:center">🚌</span><span class="nm">${esc($t(s.name))}<br><small class="sp">${esc($t(s.district))}</small></span><button class="btn btn-small btn-go" data-bb="${s.id}" ${g.money < 10 ? 'disabled' : ''}>${$t('Åk hit')}</button></div>`;
    const dlg = openModal($t('🚌 Bergbussen'), `<p style="font-size:var(--f2);margin-top:0">${$t`Bergbussen går ner till stan. Biljetten kostar ${fmt(10)}.`}</p><div class="plist">${BUS_STOPS.filter((s) => !s.broken).map(rad).join('')}</div>`, [{ label: $t('Stanna kvar'), onClick: closeModal }]);
    dlg.querySelectorAll('[data-bb]').forEach((b) => (b.onclick = () => {
      const s = BUS_STOPS.find((q) => q.id === b.dataset.bb); if (!s || g.money < 10) return;
      g.money -= 10; g.passTime(15); g.save(); closeModal(); play('door');
      go(() => { A.cityPos = [s.x + 6, s.y + 8]; A.go('city'); });
    }));
  }
  function go(cb) { if (fade.phase === 1) return; fade.phase = 1; fade.cb = cb; }
  const spotAt = (x, y) => spots().find((s) => x >= s.r[0] && x <= s.r[2] && y >= s.r[1] && y <= s.r[3]);
  const folkAt = (x, y) => besok.find((o) => Math.abs(o.x - x) < 8 && y < o.y + 2 && y > o.y - 34);
  const nalleAt = (x, y) => Math.abs(nalle.x - x) < 10 && y < nalle.y + 2 && y > nalle.y - 32;

  // ---------- ritning ----------
  const KIT = propKit();
  const hex = (n) => '#' + n.toString(16).padStart(6, '0');
  // pariserhjulet: A-ställningen, fälgen med ekrar, gondolerna (färgade, med folk), glödlampor på kvällen
  const GFARG = [0xe04848, 0xf0c030, 0x3a7bd5, 0x46a35a, 0xd060a0, 0xf08a2a, 0x9a6ad8, 0x2ab8c8, 0xe04848, 0xf0c030];
  function ritaHjul(ctx, N, framfor) {
    const { x: cx, y: cy, r } = HJUL, v0 = hjulVinkel();
    if (!framfor) {
      ctx.fillStyle = '#8a8a98'; for (const sx of [-34, 34]) for (let k = 0; k <= 40; k++) { const u = k / 40; ctx.fillRect(Math.round(cx + sx * u), Math.round(cy + (HJUL.fot - cy) * u), 3, 1); }
      ctx.fillStyle = '#c8c8d4'; for (let k = 0; k <= 40; k++) { const u = k / 40; ctx.fillRect(Math.round(cx - 34 * u), Math.round(cy + (HJUL.fot - cy) * u), 1, 1); }
      for (let k = 0; k < 16; k++) { const v = v0 + k * Math.PI / 8; ctx.fillStyle = 'rgba(200,200,212,.9)'; for (let j = 4; j < r; j += 2) ctx.fillRect(Math.round(cx + Math.cos(v) * j), Math.round(cy + Math.sin(v) * j), 1, 1); }   // ekrarna
      for (let k = 0; k < 220; k++) { const v = k / 220 * Math.PI * 2; ctx.fillStyle = k % 2 ? '#e8e8f0' : '#b8b8c8'; ctx.fillRect(Math.round(cx + Math.cos(v) * r), Math.round(cy + Math.sin(v) * r), 2, 2); }   // fälgen
      if (N) for (let k = 0; k < 40; k++) { const v = v0 * 0.5 + k / 40 * Math.PI * 2; ctx.fillStyle = ['#ff5858', '#ffe060', '#58b0ff', '#78f078'][k % 4]; ctx.fillRect(Math.round(cx + Math.cos(v) * (r + 1)), Math.round(cy + Math.sin(v) * (r + 1)), 2, 2); }
      ctx.fillStyle = '#f0c030'; ctx.fillRect(cx - 4, cy - 4, 9, 9); ctx.fillStyle = '#8a6a1a'; ctx.fillRect(cx - 1, cy - 1, 3, 3);
      ctx.fillStyle = '#5a5a66'; ctx.fillRect(cx - 50, HJUL.fot - 4, 100, 5); ctx.fillStyle = '#8a8a98'; ctx.fillRect(cx - 50, HJUL.fot - 5, 100, 1);   // plattformen
      return;
    }
    for (let i = 0; i < GONDOLER; i++) {
      const p = gondol(i), gx = Math.round(p.x), gy = Math.round(p.y);
      ctx.fillStyle = '#5a5a66'; ctx.fillRect(gx, gy - 12, 1, 6);
      const f = GFARG[i];
      ctx.fillStyle = hex(f); ctx.fillRect(gx - 7, gy - 7, 15, 3);   // taket
      const folk = aka?.typ === 'hjul' && aka.i === i ? A.avatar.look : gondolFolk.get(i);
      if (folk) { ctx.save(); ctx.beginPath(); ctx.rect(gx - 7, gy - 30, 15, 31); ctx.clip(); drawPerson(ctx, gx, gy + 18, folk, 'down', 5); ctx.restore(); }
      ctx.fillStyle = hex(f); ctx.fillRect(gx - 7, gy, 15, 7); ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(gx - 7, gy, 15, 1); ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(gx - 7, gy + 6, 15, 1);
      ctx.fillStyle = '#5a5a66'; ctx.fillRect(gx - 7, gy - 4, 1, 4); ctx.fillRect(gx + 7, gy - 4, 1, 4);
    }
  }
  // karusellen: plattformen, hästarna på stänger (de bakre före mittstången), taket med bården och lampor
  const HAST = ['..kkk.......', '.kwwwk......', 'kwkwwwkkkkk.', '.kwwwwwwwwwk', '...kwwwwwwwk', '...kw.k..kwk', '...kk.....kk'];
  function ritaHast(ctx, x, y, dir, farg) {
    const s = dir === 'left' ? 1 : -1;
    HAST.forEach((rad, j) => { for (let i = 0; i < rad.length; i++) { const ch = rad[i]; if (ch === '.') continue; ctx.fillStyle = ch === 'k' ? '#3a2a3a' : farg; ctx.fillRect(Math.round(x + (i - 6) * s), Math.round(y - 12 + j), 1, 1); } });
    ctx.fillStyle = '#e04848'; ctx.fillRect(Math.round(x - 1), Math.round(y - 10), 3, 1);   // sadeln
  }
  function ritaKarusell(ctx, N, del) {
    const { x: cx, y: cy, rx, ry } = KARUSELL;
    if (del === 'golv') {
      for (let j = -ry; j <= ry; j++) { const w = Math.round(rx * Math.sqrt(1 - (j / ry) ** 2)); ctx.fillStyle = j > ry - 4 ? '#7a4a2a' : '#c8945a'; ctx.fillRect(cx - w, cy + j, w * 2, 1); }
      ctx.fillStyle = '#a8703e'; for (let j = -ry + 2; j < ry - 3; j += 4) { const w = Math.round(rx * Math.sqrt(1 - (j / ry) ** 2)); ctx.fillRect(cx - w + 2, cy + j, w * 2 - 4, 1); }
      return;
    }
    if (del === 'tak') {
      ctx.fillStyle = '#f0c030'; ctx.fillRect(cx - 2, cy - 74, 5, 74);   // mittstången
      for (let j = 0; j < 30; j++) { const w = Math.round(6 + j * (rx - 2) / 30); for (let i = -w; i <= w; i++) { const seg = Math.floor((i + w) / 7 + j / 30) % 2; ctx.fillStyle = seg ? '#e04848' : '#f4f1ea'; ctx.fillRect(cx + i, cy - 104 + j, 1, 1); } }   // det randiga taket
      for (let i = -rx; i <= rx; i++) { const bå = Math.floor((i + rx) / 6) % 2 ? 2 : 4; ctx.fillStyle = '#2a5aa8'; ctx.fillRect(cx + i, cy - 74, 1, bå + 2); }   // bården
      ctx.fillStyle = '#f0c030'; ctx.fillRect(cx - 1, cy - 112, 3, 8); ctx.fillStyle = '#e04848'; ctx.fillRect(cx + 1, cy - 112, 6, 4);   // flaggan
      if (N) for (let i = -rx + 3; i <= rx; i += 6) { ctx.fillStyle = ['#ffe060', '#ff8888', '#88ccff'][(i + rx) % 3]; ctx.fillRect(cx + i, cy - 70, 2, 2); }
    }
  }
  const drawHast = (ctx, i) => {
    const h = hast(i), y = h.y - 8 + h.upp;
    ctx.fillStyle = '#f0c030'; ctx.fillRect(Math.round(h.x), KARUSELL.y - 74, 1, Math.round(y - (KARUSELL.y - 74)));   // stången
    ritaHast(ctx, h.x, y, h.dir, ['#f4f1ea', '#c8905a', '#f8c8d8', '#a8d4ff'][i % 4]);
    const ryttare = aka?.typ === 'karusell' && aka.i === i ? A.avatar.look : hastFolk.get(i);
    if (ryttare) { ctx.save(); ctx.beginPath(); ctx.rect(h.x - 12, y - 60, 24, 49); ctx.clip(); drawPerson(ctx, h.x, y + 1, ryttare, h.dir, 5); ctx.restore(); }
  };
  // berg-och-dalbanans tåg: tre vagnar längs spåret (på klockan) med de åkande – två i varje vagn; i nedförsbackarna
  // åker armarna upp. Kompisar har sin namnlapp. Vid stationen: hur länge det är kvar tills tåget går.
  function ritaTag(ctx) {
    const L = banLage(), sitt = aakare(L);
    for (let c = 2; c >= 0; c--) {
      const v = vagn(c, L), x = Math.round(v.x), y = Math.round(v.y);
      for (let s = 0; s < 2; s++) {
        const r = sitt[c * 2 + s]; if (!r) continue;
        const px = x + (s ? 3 : -3);
        ctx.save(); ctx.beginPath(); ctx.rect(px - 9, y - 44, 18, 41); ctx.clip();
        drawPerson(ctx, px, y + 14, r.look, 'down', v.ner ? 10 : 5);
        ctx.restore();
      }
      const farg = ['#f0c030', '#e04848', '#3a7bd5'][c];
      ctx.fillStyle = farg; ctx.fillRect(x - 8, y - 6, 17, 6); ctx.fillStyle = 'rgba(255,255,255,.45)'; ctx.fillRect(x - 8, y - 6, 17, 1); ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(x - 8, y - 2, 17, 1);
      ctx.fillStyle = '#1e1a24'; ctx.fillRect(x - 8, y, 17, 1); ctx.fillRect(x - 6, y + 1, 3, 1); ctx.fillRect(x + 4, y + 1, 3, 1);
      if (c === 0) { ctx.fillStyle = '#f4f1ea'; ctx.fillRect(x + 8, y - 5, 2, 2); }   // strålkastaren längst fram
    }
    for (let c = 0; c < 3; c++) { const v = vagn(c, L); for (let s = 0; s < 2; s++) { const r = sitt[c * 2 + s]; if (r?.av) nameTag(ctx, Math.round(v.x) + (s ? 3 : -3), Math.round(v.y) - 36, r.av); } }
    if (L.station) { const s = $t`TÅGET GÅR OM ${Math.max(1, Math.ceil(L.kvar))}`, w = textW(SMALL, s) + 8, sx = BANA.station.x + (BANA.station.w >> 1); ctx.fillStyle = 'rgba(20,18,26,.85)'; ctx.fillRect(sx - (w >> 1), BANA.station.y - 66, w, 10); ctxText(ctx, SMALL, s, sx - (w >> 1) + 4, BANA.station.y - 64, '#ffd23f'); }
  }
  // kompisar som står i kön till nästa tåg (deras ak är en senare avgång) – de ritas här, inte av walkable
  const koande = () => { const L = banLage(); return worldFolksHere(A).filter((f) => { const m = AKTUR.exec(f.ak || ''); return m && +m[1] > L.n; }); };
  // björnmaskoten Pixel-Nalle (brun dräkt, stort huvud, vinkar)
  const NALLE = ['..kk......kk..', '.kbbk....kbbk.', '.kbbbkkkkbbbk.', '..kbbbbbbbbk..', '.kbbwkbbkwbbk.', '.kbbbbbbbbbbk.', '.kbbbbppbbbbk.', '..kbbbkkbbbk..', '...kkkkkkkk...', '..kbbbbbbbbk..', '.kbbbbwwbbbbk.', '.kbbbwwwwbbbk.', 'kbbkbwwwwbkbbk', 'kbk.bbwwbb.kbk', '....bbbbbb....', '....bb..bb....', '...kbb..bbk...', '...kkk..kkk...'];
  function ritaNalle(ctx) {
    const x0 = Math.round(nalle.x) - 7, y0 = Math.round(nalle.y) - 18, vink = nalle.vinkar > 0 && Math.floor(t * 6) % 2;
    ctx.fillStyle = 'rgba(30,20,20,.2)'; ctx.fillRect(x0 + 1, y0 + 17, 12, 2);
    NALLE.forEach((rad, j) => { for (let i = 0; i < rad.length; i++) { const ch = rad[i]; if (ch === '.') continue; if (vink && j >= 12 && j <= 13 && i >= 11) continue; ctx.fillStyle = ch === 'k' ? '#3a2418' : ch === 'w' ? '#e8c8a0' : ch === 'p' ? '#2a1a14' : '#a8703e'; ctx.fillRect(x0 + i, y0 + j, 1, 1); } });
    if (vink) { ctx.fillStyle = '#a8703e'; ctx.fillRect(x0 + 13, y0 + 9, 2, 4); ctx.fillStyle = '#3a2418'; ctx.fillRect(x0 + 15, y0 + 9, 1, 4); }
  };
  const drawBallong = (ctx, o) => { const bx = Math.round(o.x) + (o.dir === 'left' ? -5 : 5), by = Math.round(o.y) - 44 + Math.round(Math.sin(t * 2 + o.x) * 1); ctx.fillStyle = 'rgba(240,240,240,.7)'; for (let y = by + 6; y < o.y - 22; y++) ctx.fillRect(bx + (y % 4 === 0 ? 1 : 0), y, 1, 1); ctx.fillStyle = o.ballong; ctx.fillRect(bx - 3, by - 3, 7, 8); ctx.fillRect(bx - 2, by - 4, 5, 10); ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.fillRect(bx - 1, by - 2, 2, 2); };
  const drawHallplats = (ctx) => { const { x, y } = HALLPLATS; ctx.fillStyle = '#5a5e66'; ctx.fillRect(x, y - 30, 2, 30); ctx.fillStyle = '#f0c030'; ctx.fillRect(x - 6, y - 34, 14, 10); ctx.fillStyle = '#1e1a24'; ctx.fillRect(x - 6, y - 34, 14, 1); ctxText(ctx, SMALL, $t('BUSS'), x - 5, y - 32, '#1e1a24'); };
  // glödlampsslingor mellan lyktstolparna (tänds på kvällen)
  function ritaSlingor(ctx, N) {
    for (let k = 0; k < LYKTOR.length - 1; k++) {
      const a = LYKTOR[k], b = LYKTOR[k + 1], n = Math.round((b.x - a.x) / 6);
      for (let i = 1; i < n; i++) { const u = i / n, x = a.x + (b.x - a.x) * u, y = a.y - 30 + Math.sin(u * Math.PI) * 10; ctx.fillStyle = N ? ['#ff6868', '#ffe068', '#68b8ff', '#78f078'][(i + k) % 4] : '#8a8a98'; ctx.fillRect(Math.round(x), Math.round(y), N ? 2 : 1, N ? 2 : 1); }
    }
  }

  function night() { const h = g.min / 60; return h >= 20 || h < 5.5; }
  function dusk() { const h = g.min / 60; return (h >= 18 && h < 20) || (h >= 5.5 && h < 7); }

  return {
    viewMax: { w: TW, h: TH },
    get worldX() { return walker.px; }, get worldY() { return walker.py; },
    get worldRide() { return null; },
    get worldAka() { return aka?.typ === 'bana' ? `bana:${aka.n}:${aka.plats}` : ''; },   // (js/net/world.js)
    update(dt) {
      t += dt; banner += dt;
      VW = Math.max(384, Math.min(A.W || 384, TW)); VH = Math.max(160, Math.min(A.H || 216, TH));
      if (fade.phase === 1) { fade.a = Math.min(1, fade.a + dt * 2.6); if (fade.a >= 1) { fade.phase = 0; const cb = fade.cb; fade.cb = null; cb?.(); return; } }
      else if (fade.phase === 2) { fade.a = Math.max(0, fade.a - dt * 1.8); if (fade.a <= 0) fade.phase = 0; if (!aka) walker.update(dt); }
      else if (!aka) walker.update(dt);
      if (aka) {
        aka.t += dt;
        if (aka.typ === 'hjul') {
          const p = gondol(aka.i);
          if (!aka.toppen && p.y < HJUL.y - HJUL.r + 20) { aka.toppen = true; toast($t('🎡 Högst upp! Där nere ligger hela Pixelstaden – floden, bron och alla husen.'), 'good wrap'); }
          if (aka.t >= HJULVARV) avAka();
        } else if (aka.typ === 'karusell' && aka.t >= KARUSELLVARV * 2) avAka();
        else if (aka.typ === 'bana') {
          const L = banLage();
          if (L.n > aka.n) avAka();   // nästa avgång har börjat – tåget är inne: kliv av
          else if (L.n === aka.n) {
            for (const p of aakare(L)) if (p && !p.jag && !p.npc && !aka.ihop.has(p.namn)) { aka.ihop.add(p.namn); play('ok'); toast($t`🎢 Du och ${p.namn} åker tillsammans!`, 'good'); }
            const v = vagn(Math.floor(aka.plats / 2), L);
            if (v.ner && !aka.skrek && L.tau > 2) { aka.skrek = true; talk.say($t('AAAAH! 😱'), () => { const q = vagn(Math.floor(aka?.plats / 2) || 0, banLage()); return { x: q.x, y: q.y - 38 }; }, 1.6, { silent: true }); }
            if (!v.ner) aka.skrek = false;
          }
        }
      }
      updLiv(dt);
      if (pets && !aka) try { pets.update(dt, walker.px, walker.py, (x, y) => walker.walkable(x, y)); } catch (e) { console.error('husdjuren på Pixelberg:', e); pets = null; }
      const c = camTarget(); cam.x += (c.x - cam.x) * Math.min(1, dt * 6); cam.y += (c.y - cam.y) * Math.min(1, dt * 6);
    },
    draw(ctx) {
      ctx.setTransform(A.pxs, 0, 0, A.pxs, 0, 0);
      ctx.imageSmoothingEnabled = false;
      const N = night(), D = dusk();
      const cx = Math.round(cam.x), cy = Math.round(cam.y);
      // himlen ovanför och utsikten ner över staden precis bakom bergets kant (hjulet och banan står mot himlen)
      const ut = utsiktCanvas(N), utY = P.HIMMEL + 6 - cy - ut.height, sky = skyCanvas(VW, N, D);
      ctx.fillStyle = N ? '#141c3a' : D ? '#4a5a98' : '#5aa0e0'; ctx.fillRect(0, 0, VW, Math.max(0, utY + 50));
      ctx.drawImage(sky, 0, utY + 60 - sky.height);
      const off = -Math.round(cx * 0.4) % ut.width;
      for (let x = off; x < VW; x += ut.width) ctx.drawImage(ut, x, utY);
      ctx.drawImage(ground(), -cx, -cy);
      ctx.save(); ctx.translate(-cx, -cy);
      ctx.drawImage(banaBild(), 0, 0);
      ritaTag(ctx);
      const items = [];
      items.push({ fy: HJUL.fot - 6, draw: () => ritaHjul(ctx, N, false) });   // ställningen (gondolerna strax efter)
      const syns = (x, m = 80) => x > cx - m && x < cx + VW + m;
      items.push({ fy: HJUL.fot - 5, draw: () => ritaHjul(ctx, N, true) });
      items.push({ fy: KARUSELL.y - KARUSELL.ry - 1, draw: () => ritaKarusell(ctx, N, 'golv') });
      for (let i = 0; i < HASTAR; i++) { const h = hast(i); items.push({ fy: h.y, draw: () => drawHast(ctx, i) }); }
      items.push({ fy: KARUSELL.y + 0.5, draw: () => ritaKarusell(ctx, N, 'tak') });
      items.push({ fy: BILJETT.y, draw: () => ctx.drawImage(biljettBild(N), BILJETT.x, BILJETT.y - 64) });
      for (const s of STAND) if (syns(s.x)) items.push({ fy: s.y, draw: () => ctx.drawImage(standBild(s, N), s.x, s.y - 66) });
      items.push({ fy: BANA.station.y, draw: () => ctx.drawImage(stationBild(N), BANA.station.x, BANA.station.y - 50) });
      items.push({ fy: PORT.y, draw: () => ctx.drawImage(portBild(N), PORT.x - PORT.w / 2, PORT.y - PORT.h) });
      items.push({ fy: HALLPLATS.y, draw: () => drawHallplats(ctx) });
      for (const b of BANKAR) if (syns(b.x)) items.push({ fy: b.y, draw: () => KIT.bench(ctx, b.x, b.y) });
      for (const l of LYKTOR) if (syns(l.x)) items.push({ fy: l.y, draw: () => KIT.lamp(ctx, l.x, l.y, 1) });
      for (const b of BUSKAR) if (syns(b.x)) items.push({ fy: b.y, draw: () => KIT.tree(ctx, 'lind', b.x, b.y, { vind: Math.round(Math.sin(t + b.x) * 0.5) }) });
      for (const o of besok) if (syns(o.x)) items.push({ fy: o.y, draw: () => { drawPerson(ctx, o.x, o.y, o.look, o.dir, o.vila <= 0 ? WALK_SEQ[Math.floor(t * 8 + o.x) % 4] : 0); if (o.ballong) drawBallong(ctx, o); } });
      items.push({ fy: nalle.y, draw: () => ritaNalle(ctx) });
      items.push(...folkDrawables(A, t));
      if (pets && !aka) for (const d of pets.drawables()) items.push({ fy: d.fy ?? d.y, draw: () => d.draw(ctx) });
      if (!aka || (aka.typ === 'bana' && !sitterIBana())) items.push(selfDrawable(A, walker, t, { folksHere: worldFolksHere(A).length, ride: null }));
      for (const f of koande()) items.push({ fy: f.y, draw: () => { drawPerson(ctx, f.x, f.y, f.av.look, 'up', 0); nameTag(ctx, f.x, f.y - 50, f.av); } });
      items.sort((a, b) => a.fy - b.fy).forEach((d) => d.draw(ctx));
      ritaSlingor(ctx, N || D);
      ctx.restore();
      if (N || D) {
        ctx.fillStyle = N ? 'rgba(12,16,48,0.5)' : 'rgba(60,40,90,0.18)'; ctx.fillRect(0, 0, VW, VH);
        ctx.save(); ctx.translate(-cx, -cy); for (const l of LYKTOR) if (l.x > cx - 40 && l.x < cx + VW + 40) KIT.lampGlow(ctx, l.x, l.y, N ? 1 : 0.5); ctx.restore();
        if (N) {
          // tivolits sken: hjulet, karusellen och stånden lyser genom mörkret
          ctx.save(); ctx.translate(-cx, -cy); ctx.globalCompositeOperation = 'lighter';
          const sken = (x, y, r, c) => { const gr = ctx.createRadialGradient(x, y, 2, x, y, r); gr.addColorStop(0, c); gr.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = gr; ctx.fillRect(x - r, y - r, r * 2, r * 2); };
          sken(HJUL.x, HJUL.y, HJUL.r + 30, 'rgba(255,170,90,.28)'); sken(KARUSELL.x, KARUSELL.y - 60, 80, 'rgba(255,210,120,.3)');
          for (const s of STAND) sken(s.x + s.w / 2, s.y - 30, 50, 'rgba(255,200,120,.22)');
          sken(PORT.x, PORT.y - PORT.h + 10, 60, 'rgba(255,230,140,.25)');
          for (const l of LYKTOR) sken(l.x, l.y - 30, 34, 'rgba(255,200,140,.18)');
          ctx.restore();
        }
      }
      ctx.save(); ctx.translate(-cx, -cy); talk.draw(ctx, { x0: cx, x1: cx + VW }); ctx.restore();
      if (banner < 4) { const a = banner < 0.4 ? banner / 0.4 : banner > 3.4 ? (4 - banner) / 0.6 : 1; ctx.globalAlpha = Math.max(0, a); const s = $t('PIXELBERG'), s2 = $t('TIVOLIT PÅ BERGET'), w = Math.max(textW(BIG, s, 2), textW(SMALL, s2)) + 20; ctx.fillStyle = 'rgba(20,18,26,.85)'; ctx.fillRect((VW - w) >> 1, 26, w, 30); ctxText(ctx, BIG, s, (VW - textW(BIG, s, 2)) >> 1, 30, '#ff8ac8', 2); ctxText(ctx, SMALL, s2, (VW - textW(SMALL, s2)) >> 1, 48, '#f4f1ea'); ctx.globalAlpha = 1; }
      const s = !aka && hover && spotAt(hover.x + cx, hover.y + cy);
      if (s) { const w = textW(SMALL, s.label) + 10, x = Math.round(Math.max(2, Math.min(VW - w - 2, hover.x - w / 2))), y = Math.max(2, hover.y - 22); ctx.fillStyle = 'rgba(20,18,26,.9)'; ctx.fillRect(x, y, w, 11); ctxText(ctx, SMALL, s.label, x + 5, y + 3, '#ffd23f'); }
      if (fade.a > 0) { ctx.fillStyle = `rgba(10,10,16,${fade.a.toFixed(2)})`; ctx.fillRect(0, 0, VW, VH); }
    },
    down(sx, sy) {
      // i kön till nästa tåg: ett tryck någon annanstans = lämna kön (kupongen tillbaka)
      if (aka?.typ === 'bana' && !sitterIBana()) { aka = null; if (!harBand()) { g.money += KUPONG; g.save(); } toast($t('🎢 Du lämnade kön.')); return; }
      if (fade.phase === 1 || aka) return;
      hover = { x: sx, y: sy };
      const x = sx + cam.x, y = sy + cam.y;
      if (nalleAt(x, y)) { walker.walkTo(nalle.x + (walker.px < nalle.x ? -14 : 14), nalle.y + 2, () => { nalle.vinkar = 2.5; nalle.vila = 3; talk.say($t('*Pixel-Nalle vinkar och gör en high five!*'), () => ({ x: nalle.x, y: nalle.y - 30 }), 3, { silent: true }); const h = g.glad?.(1, '', 'pixelnalle', 1); if (h) toast(`🐻 +${h} 😊`); }); return; }
      const o = folkAt(x, y);
      if (o) { walker.walkTo(o.x + (walker.px < o.x ? -14 : 14), o.y + 2, () => talk.say(o.rad, () => ({ x: o.x, y: o.y - 34 }), 3.5, { voice: o.look })); return; }
      const s = spotAt(x, y);
      if (s) { walker.walkTo(s.go[0], s.go[1], s.act); return; }
      walker.walkTo(x, y);
    },
    move(sx, sy) { hover = { x: sx, y: sy }; },
    exit() { talk.clear(); },
    _debug: {
      pos: () => ({ x: walker.px, y: walker.py }),
      teleport: (x, y) => { walker.px = x; walker.py = y; walker.stop(); walker.snapFree(); Object.assign(cam, camTarget()); },
      walkTo: (x, y) => { walker.walkTo(x, y); return walker.path.length; },
      act: (id) => { const s = spots().find((q) => q.id === id); if (!s) return false; s.act(); return true; },
      aka: () => (aka ? { typ: aka.typ, t: aka.t, i: aka.i, toppen: !!aka.toppen } : null),
      snabba: (sek) => { t += sek; if (aka) aka.t += sek; },   // (testerna: spola fram åkturen)
      band: () => harBand(),
      bana: () => { const L = banLage(); return { n: L.n, station: L.station, tau: L.tau, aka: aka?.typ === 'bana' ? { n: aka.n, plats: aka.plats } : null, platser: aakare(L).map((p) => (p ? (p.jag ? 'jag' : p.npc ? 'npc' : p.namn) : null)) }; },
      akBana: () => akBana(),
      prat: () => talk.text(),
    },
  };
}
let GROUND = null;
const ground = () => (GROUND ||= paintGround());
