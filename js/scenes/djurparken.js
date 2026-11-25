// 🦁 DJURPARKEN – stadsdel 3 i stadsdelsplanen (Carl 2026-11-18: "Djurparken: inhägnader, djurskötarjobb med matning,
// ponnyridning, souvenirkiosk, entré"). En egen plats som Pixelberg och Gamla stan: djurbussen går hit från stadens
// hållplatser (city.js, raden DJURPARKEN) och man kliver av utanför grinden. Entrén kostar ENTRE.PRIS, öppet 9–18.
// Innanför: huvudgången med lyktor och bänkar, inhägnaderna med djuren som går, äter, sover och gör sitt (lejonet
// ryter, elefanten sprutar, pingvinerna simmar, flamingorna doppar, aporna hänger, påfågeln slår ut stjärten),
// KLAPPZOO där man går in och klappar getterna (och köper getfoder för 5 kr så att de kommer), PONNYRIDNINGEN
// (15 kr för ett varv på Pricken), glasskiosken, souvenirkiosken med ballonger, picknickängen, ankdammen med bron
// och personalhuset där djurskötarjobbet öppnar i nästa steg. Besökare med ballonger, barn, djurskötaren med
// skottkärran. Skyltarna vid hagarna berättar om djuren. Kvällen mörknar, lyktorna tänds och djuren sover.
//
// _debug-API för tools/djurparken-test.mjs.
import { createCityWalker } from '../city/walk.js';
import { selfDrawable, folkDrawables, folkTapAt, createSpeech, WALK_SEQ, synligRuta } from './walkable.js';
import { openSpelarkort } from '../core/vannerapp.js';
import { worldFolksHere } from '../net/world.js';
import { openModal, closeModal, toast, esc } from '../core/ui.js';
import { play } from '../core/sound.js';
import { SMALL, BIG, ctxText, textW, hash } from '../core/floor-pix.js';
import { busStopById, BUS_STOPS } from '../city/map.js';
import { fmt } from '../game.js';
import { drawPerson, makeLook } from '../core/people.js';
import { createPetWalk } from '../pets/outdoors.js';
import { skyCanvas } from '../landet/karta.js';
import { propKit } from '../city/props.js';
import { drawPet } from '../pets/sprites.js';
import { TW, TH, G, ENTRE, HALLPLATS, KASSA, HAGN, HAGNLISTA, PICKNICK, GLASSKIOSK, SOUVENIR, PERSONALHUS, FODER, LADA, KLATTER, GROTTA, AKACIOR, LEJONKLIPPA, LERPOL, BASSANG, RING, BRO, BANKAR, PAPPERSKORGAR, LYKTOR, TRAD, PAFAGELPLATS, hinder, kullCanvas, paintGround, OPPETTEXT } from '../djurparken/karta.js';
import { ritaDjur, SADEL, DJURFAKTA } from '../djurparken/djur.js';
import { ritaGrindstolpe, ritaGrind, ritaKassa, ritaParkskylt, ritaHallplats, ritaStaketFram, ritaSkylt, ritaKiosk, ritaLada, ritaKlatter, ritaGrotta, ritaKlippa, ritaAkacia, ritaFoder, ritaPersonalhus, ritaPicknickbord, ritaVass, ritaSkottkarra, ritaBallong, ritaTrag } from '../djurparken/deko.js';
import { $t } from '../core/i18n.js';
import { agerEvig } from '../core/kop.js';   // 🎟️ köpt årskort: fri entré och fri ponnyridning

const BUSS = 10, GANG = 62, PONNY_PRIS = 15, FODER_PRIS = 5, RIDTUR = 14;
const FOLKRAD = [
  $t('Lejonet röt så att jag tappade glassen!'), $t('Elefanten sprutade vatten på pappa. Han blev jätteblöt.'), $t('Getterna åt upp min karta. Hela.'),
  $t('Påfågeln slog ut stjärten – den är större än jag!'), $t('Vi har ridit på Pricken tre gånger i dag.'), $t('Pingvinerna ser ut som små farbröder i frack.'),
  $t('Giraffen har blå tunga. Blå!'), $t('Björnungen heter Nalle. Så klart.'),
];
const GLASS = [
  { id: 'strut', icon: '🍦', namn: $t('Mjukglass i strut'), pris: 15, hunger: 12, glad: 1 },
  { id: 'popcorn', icon: '🍿', namn: $t('Popcorn'), pris: 12, hunger: 8, glad: 1 },
  { id: 'saft', icon: '🧃', namn: $t('Jordgubbssaft'), pris: 8, hunger: 4, energi: 6, glad: 0 },
];
const SOUVENIRER = [
  { id: 'ballong', icon: '🎈', namn: $t('Ballong med lejon på'), pris: 10, glad: 1, rad: $t('Ballongen svävar ovanför dig resten av besöket.') },
  { id: 'keps', icon: '🧢', namn: $t('Djurparkskeps'), pris: 40, glad: 1, rad: $t('Kepsen sitter som gjuten. Nu ser du ut som en djurskötare.') },
  { id: 'nalle', icon: '🧸', namn: $t('Lejonnalle'), pris: 60, glad: 2, rad: $t('Lejonnallen följer med hem i väskan. Den heter Rut.') },
];

export function makeDjurparken(A) {
  const g = A.game;
  let VW = Math.max(384, Math.min(A.W || 384, TW)), VH = Math.max(160, Math.min(A.H || 216, TH));
  const from = A.djurparkFran || null; A.djurparkFran = null;
  let betalt = !!from?.betalt;
  const walker = createCityWalker({ W: TW, H: TH, left: 2, right: TW - 2, top: G.TOP, bottom: G.BOTTOM, spawn: from?.personal ? [PERSONALHUS.x, PERSONALHUS.y + 10] : from?.inne ? [ENTRE.X + 30, 286] : [HALLPLATS.x + 16, HALLPLATS.y - 10] });
  const fordon = () => g.aker;
  const applyRide = () => { const F = fordon(); walker.speed = GANG * (F ? F.fart : 1); };
  applyRide();
  walker.setObstacles(hinder(betalt));
  walker.snapFree();
  const talk = createSpeech();
  let t = 0, hover = null, banner = from?.personal ? 9 : 0, ballong = null, mat = 0, rider = null, snurr = 0;
  const fade = { a: 1, phase: 2, cb: null };
  const cam = { x: 0, y: 0 };
  // kameran: på gången och norrut står figuren nära nederkanten så att hela inhägnaden (y 70–222) syns; söder om
  // gången (y > 340) ligger figuren mitt i bild så att de södra hagarna syns
  const camTarget = () => { const S = synligRuta(VH), px = rider ? ponny.x : walker.px, py = rider ? ponny.y : walker.py, k = py > 340 ? 0.5 : 0.94; return { x: Math.max(0, Math.min(TW - VW, px - VW / 2)), y: Math.max(0, Math.min(Math.max(0, TH - S.y1), py - S.y0 - S.h * k)) }; };
  Object.assign(cam, camTarget());
  let pets = null;
  try { pets = createPetWalk(A); } catch (e) { console.error('husdjuren i Djurparken startade inte:', e); }
  const hour = () => g.min / 60;
  const oppet = () => hour() >= ENTRE.OPPET[0] && hour() < ENTRE.OPPET[1];
  const night = () => hour() >= 20 || hour() < 5.5;
  const dusk = () => (hour() >= 18 && hour() < 20) || (hour() >= 5.5 && hour() < 7);
  const rnd = (a, b) => a + Math.random() * (b - a);
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const inset = (H, m = 14) => [H.r[0] + m, H.r[1] + m + 6, H.r[2] - m, H.r[3] - 6];
  const inEll = (x, y, e) => ((x - e.x) / e.rx) ** 2 + ((y - e.y) / e.ry) ** 2 <= 1;
  const dammE = (id) => { const [x0, y0, x1, y1] = HAGN[id].r; return id === 'damm' ? { x: (x0 + x1) / 2, y: (y0 + y1) / 2 + 4, rx: (x1 - x0) / 2 - 8, ry: (y1 - y0) / 2 - 10 } : { x: (x0 + x1) / 2, y: (y0 + y1) / 2 + 6, rx: (x1 - x0) / 2 - 12, ry: (y1 - y0) / 2 - 14 }; };

  // ---------- djuren ----------
  // varje djur: { art, hagn, x, y, dir, st, tm, fart, tx, ty, special } – wander inom hagen (eller dammen), specialare per art
  const djur = [];
  const nytt = (art, hagn, x, y, extra = {}) => { const d = { art, hagn, x, y, dir: Math.random() < 0.5 ? 'left' : 'right', st: 'idle', tm: rnd(1, 4), fart: 10, spec: 0, ...extra }; djur.push(d); return d; };
  const KL = inset(HAGN.klapp, 16);
  nytt('get', 'klapp', 260, 170, { fart: 12, namn: 'Majsan' }); nytt('getbrun', 'klapp', 340, 190, { fart: 12, namn: 'Bosse' }); nytt('get', 'klapp', 390, 150, { fart: 12, namn: 'Lilla My' });
  const kaniner = [{ x: 300, y: 128 }, { x: 410, y: 200 }].map((p, i) => ({ ...p, pet: { id: 'zoo-kanin' + i, name: 'Kanin', species: 'kanin', breed: i ? 'hermelin' : 'vit', sex: 'hona', stage: 'vuxen', seed: 'zk' + i }, dir: 'left', tm: rnd(1, 3), anim: 'idle' }));
  nytt('apa', 'apor', KLATTER.x - 24, KLATTER.y - 26, { fast: true, st: 'hang', fart: 0 }); nytt('apa', 'apor', 520, 190, { fart: 22 }); nytt('apa', 'apor', 660, 160, { fart: 22 }); nytt('apa', 'apor', 600, 205, { fart: 22, st: 'idle' });
  nytt('lejon', 'lejon', LEJONKLIPPA.x, LEJONKLIPPA.y - 28, { fast: true, st: 'ligg', fart: 0, fy: LEJONKLIPPA.y + 0.5 }); nytt('lejon', 'lejon', 800, 180, { fart: 9 });
  nytt('elefant', 'elefant', 1100, 200, { fart: 6 }); nytt('elefant', 'elefant', 1280, 150, { fart: 6, spruta: true });
  nytt('giraff', 'giraff', AKACIOR[0][0] - 26, AKACIOR[0][1] + 6, { fart: 7 }); nytt('giraff', 'giraff', 1560, 190, { fart: 7 });
  nytt('bjorn', 'bjorn', 1740, 190, { fart: 7 }); nytt('bjornunge', 'bjorn', 1860, 200, { fart: 11 });
  for (let i = 0; i < 6; i++) nytt('pingvin', 'pingvin', 240 + i * 36, 380 + (i % 3) * 30, { fart: 9, sim: i < 2 });
  for (let i = 0; i < 6; i++) nytt('flamingo', 'flamingo', 540 + i * 36, 400 + (i % 2) * 40, { fart: 4, st: 'idle' });
  const ponny = { x: RING.x + RING.rx, y: RING.y, ang: 0, dir: 'left', f: 0 };
  const ankor = Array.from({ length: 5 }, (_, i) => nytt('anka', 'damm', 1640 + i * 50, 400 + (i % 3) * 25, { fart: 8, sim: true }));
  const pafagel = nytt('pafagel', null, 180, 390, { fart: 8, fri: true });
  function wanderRect(d, R) { d.tx = rnd(R[0], R[2]); d.ty = rnd(R[1], R[3]); }
  function updDjur(dt) {
    const N = night();
    for (const d of djur) {
      d.tm -= dt; if (d.spec > 0) d.spec -= dt;
      if (d.fast) { if (d.art === 'lejon') d.st = d.spec > 0 ? 'ryt' : N ? 'sov' : 'ligg'; continue; }
      if (d.art === 'pafagel') { if (Math.hypot(walker.px - d.x, walker.py - d.y) < 44 || d.spec > 0) { d.st = 'fan'; d.dir = walker.px < d.x ? 'left' : 'right'; continue; } }
      if (N && !d.sim && d.art !== 'flamingo' && d.art !== 'anka') { d.st = 'sov'; continue; }
      if (d.spec > 0 && d.spStat) { d.st = d.spStat; continue; }
      if (d.st === 'walk') {
        const dx = d.tx - d.x, dy = d.ty - d.y, dist = Math.hypot(dx, dy), step = d.fart * dt;
        if (Math.abs(dx) > 0.5) d.dir = dx < 0 ? 'left' : 'right';
        if (dist <= step) { d.x = d.tx; d.y = d.ty; d.st = d.sim ? (Math.random() < 0.3 ? 'dyk' : 'sim') : Math.random() < (d.art === 'get' || d.art === 'getbrun' || d.art === 'giraff' ? 0.5 : 0.25) ? 'ata' : 'idle'; if (d.art === 'pingvin' && d.sim) d.st = 'sim'; d.tm = rnd(1.5, 5); }
        else { d.x += dx / dist * step; d.y += dy / dist * step; }
        continue;
      }
      if (d.tm <= 0) {
        // getterna går till den som har foder
        if (mat > 0 && (d.art === 'get' || d.art === 'getbrun') && Math.hypot(walker.px - d.x, walker.py - d.y) > 18) { d.tx = walker.px + (d.x < walker.px ? -12 : 12); d.ty = walker.py + rnd(-4, 4); d.st = 'walk'; continue; }
        if (mat > 0 && (d.art === 'get' || d.art === 'getbrun')) { d.st = 'ata'; d.tm = 1; d.dir = walker.px < d.x ? 'left' : 'right'; continue; }
        d.st = 'walk';
        if (d.art === 'pafagel') wanderRect(d, [PAFAGELPLATS.x0, PAFAGELPLATS.y0, PAFAGELPLATS.x1, PAFAGELPLATS.y1]);
        else if (d.sim) { const E = d.art === 'anka' ? dammE('damm') : BASSANG; let k = 0; do { d.tx = rnd(E.x - E.rx, E.x + E.rx); d.ty = rnd(E.y - E.ry, E.y + E.ry); } while (!inEll(d.tx, d.ty, E) && k++ < 20); d.st = 'walk'; }
        else if (d.art === 'flamingo') { const E = dammE('flamingo'); let k = 0; do { d.tx = rnd(E.x - E.rx + 10, E.x + E.rx - 10); d.ty = rnd(E.y - E.ry + 8, E.y + E.ry - 4); } while (!inEll(d.tx, d.ty, E) && k++ < 20); }
        else if (d.art === 'pingvin') { const R = inset(HAGN.pingvin, 10); let k = 0; do { d.tx = rnd(R[0], R[2]); d.ty = rnd(R[1], R[3]); } while (inEll(d.tx, d.ty, BASSANG) && k++ < 20); }
        else wanderRect(d, d.hagn === 'klapp' ? KL : inset(HAGN[d.hagn]));
        if (d.art === 'elefant' && d.spruta && Math.random() < 0.35) { d.st = 'spray'; d.tm = 2.5; }
        if (d.art === 'bjorn' && Math.random() < 0.2) { d.st = 'sitt'; d.tm = 3; }
        if (d.art === 'flamingo' && Math.random() < 0.3) { d.st = 'dipp'; d.tm = 2; }
      }
    }
    for (const k of kaniner) { k.tm -= dt; if (k.tm <= 0) { k.tm = rnd(1, 4); k.anim = pick(['idle', 'idle', 'eat', 'walk']); if (k.anim === 'walk') { k.tx = rnd(KL[0], KL[2]); k.ty = rnd(KL[1], KL[3]); } } if (k.anim === 'walk' && k.tx != null) { const dx = k.tx - k.x, dy = k.ty - k.y, dd = Math.hypot(dx, dy), s = 14 * dt; if (Math.abs(dx) > 0.5) k.dir = dx < 0 ? 'left' : 'right'; if (dd <= s) { k.x = k.tx; k.y = k.ty; k.anim = 'idle'; } else { k.x += dx / dd * s; k.y += dy / dd * s; } } }
    // ponnyn går runt ringen (fortare med ryttare)
    const w = (rider ? 0.55 : 0.32) * dt; ponny.ang += w;
    const nx = RING.x + Math.cos(ponny.ang) * RING.rx, ny = RING.y + Math.sin(ponny.ang) * RING.ry;
    ponny.dir = nx < ponny.x ? 'left' : 'right'; ponny.x = nx; ponny.y = ny; ponny.f = Math.floor(t * 6) % 2;
    if (rider) { rider.t += dt; if (rider.t >= RIDTUR) ridKlar(); }
    if (mat > 0) mat -= dt;
    if (snurr > 0) snurr -= dt;
  }
  // skyltarnas reaktioner: djuren gör sitt när man läser om dem
  function reagera(id) {
    for (const d of djur) if (d.hagn === id) {
      if (d.art === 'lejon') { d.spec = 2.2; d.spStat = 'ryt'; if (d.fast) talk.say($t('RRRAAAWR!'), () => ({ x: d.x, y: d.y - 30 }), 2, { silent: true }); }
      else if (d.art === 'elefant') { d.spec = 2.5; d.spStat = 'spray'; }
      else if (d.art === 'giraff') { d.spec = 3; d.spStat = 'ata'; }
      else if (d.art === 'bjorn') { d.spec = 3; d.spStat = 'sitt'; }
      else if (d.art === 'flamingo') { d.spec = 2; d.spStat = 'dipp'; }
      else if (d.art === 'anka') { d.spec = 1.5; d.spStat = 'dyk'; }
      else if (d.art === 'apa' && !d.fast) { d.st = 'walk'; wanderRect(d, inset(HAGN.apor)); d.fart = 40; setTimeout(() => (d.fart = 22), 3000); }
      else if (d.art === 'pingvin' && !d.sim) { d.st = 'walk'; d.tx = BASSANG.x - 60; d.ty = BASSANG.y; }
    }
    if (id === 'lejon') play('bu');
  }

  // ---------- folket ----------
  const folk = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => ({ look: { ...makeLook(), kid: i % 3 === 2 }, x: 200 + i * 220, y: i % 2 ? 300 : 254 + (i % 3) * 10, dir: i % 2 ? 'left' : 'right', fart: rnd(16, 26), vila: 0, rad: FOLKRAD[i % FOLKRAD.length], ballong: i % 4 === 1 ? ['#d8343c', '#f0c030', '#3a7bd5', '#46a35a'][i % 4] : null }));
  const skotare = { look: { ...makeLook(), hat: 'cap', shirt: '#3e7e2a', apron: false }, x: 1200, y: 288, dir: 'left', fart: 18, vila: 0 };
  function updLiv(dt) {
    for (const o of folk) {
      if (o.vila > 0) { o.vila -= dt; continue; }
      o.x += (o.dir === 'right' ? 1 : -1) * o.fart * dt;
      if (o.x > TW - 40) { o.dir = 'left'; o.vila = rnd(1, 3); }
      if (o.x < ENTRE.X + 30) { o.dir = 'right'; o.vila = rnd(1, 3); }
      if (Math.random() < dt * 0.04) o.vila = rnd(2, 6);
    }
    if (skotare.vila > 0) skotare.vila -= dt;
    else { skotare.x += (skotare.dir === 'right' ? 1 : -1) * skotare.fart * dt; if (skotare.x > 1930) { skotare.dir = 'left'; skotare.vila = 3; } if (skotare.x < 200) { skotare.dir = 'right'; skotare.vila = 3; } if (Math.random() < dt * 0.05) skotare.vila = rnd(3, 6); }
  }

  // ---------- entrén, kioskerna, ridningen ----------
  function slappIn() { betalt = true; walker.setObstacles(hinder(true)); }
  function biljett() {
    if (!oppet()) { toast($t`🦁 Djurparken är stängd. ${OPPETTEXT()}.`, 'bad'); return; }
    if (betalt) { toast($t('🎟️ Du har redan betalat – grinden är öppen!')); return; }
    if (agerEvig('arskort')) { play('ok'); slappIn(); toast($t('🎟️ Årskortet blippar – välkommen in!'), 'good'); walker.walkTo(ENTRE.X + 30, 286); const h = g.glad?.(2, '', 'djurpark', 2); if (h) setTimeout(() => toast($t`🦁 Djurparken! +${h} 😊`, 'good'), 900); return; }
    openModal($t('🎟️ Djurparken – entré'), `<p style="font-size:var(--f2);margin-top:0">${$t`Välkommen! Entrén kostar <b>${fmt(ENTRE.PRIS)}</b> och gäller hela dagen. Lejonen, elefanterna, girafferna, pingvinerna, klappzoo och ponnyridningen väntar där inne.`}</p><p style="font-size:var(--f2)">💰 <b>${fmt(g.money)}</b></p>`, [
      { label: $t`Betala · ${fmt(ENTRE.PRIS)}`, cls: g.money >= ENTRE.PRIS ? 'btn-go' : '', disabled: g.money < ENTRE.PRIS, onClick: () => { closeModal(); if (g.money < ENTRE.PRIS) { toast($t('Du har inte råd med entrén.'), 'bad'); return; } g.money -= ENTRE.PRIS; g.save(); play('coin'); slappIn(); toast($t('🎟️ Varsågod! Grinden är öppen – följ gången.'), 'good'); walker.walkTo(ENTRE.X + 30, 286); const h = g.glad?.(2, '', 'djurpark', 2); if (h) setTimeout(() => toast($t`🦁 Djurparken! +${h} 😊`, 'good'), 900); } },
      { label: $t('Nej tack'), onClick: closeModal },
    ]);
  }
  function grinden() { if (betalt) { walker.walkTo(ENTRE.X + 30, 286); return; } biljett(); }
  function kiosk(typ) {
    play('click');
    const varor = typ === 'glass' ? GLASS : SOUVENIRER;
    const rader = varor.map((v) => `<div class="prow" style="grid-template-columns:auto 1fr auto"><span style="font-size:22px">${v.icon}</span><span class="nm">${esc(v.namn)}<br><small class="sp">${fmt(v.pris)}</small></span><button class="btn btn-small btn-go" data-vara="${v.id}" ${g.money < v.pris || (v.id === 'ballong' && ballong) ? 'disabled' : ''}>${v.id === 'ballong' && ballong ? $t('Har en') : $t('Köp')}</button></div>`).join('');
    const dlg = openModal(typ === 'glass' ? $t('🍦 Glasskiosken') : $t('🎈 Souvenirkiosken'), `<p style="font-size:var(--f2);margin-top:0">${typ === 'glass' ? $t('Mjukglass, popcorn och saft – det bästa med en dag i djurparken.') : $t('Ballonger, kepsar och lejonnallar. Något att minnas dagen med.')}</p><div class="plist">${rader}</div>`, [{ label: $t('Stäng'), onClick: closeModal }]);
    dlg.querySelectorAll('[data-vara]').forEach((b) => (b.onclick = () => {
      const v = varor.find((q) => q.id === b.dataset.vara); if (!v || g.money < v.pris) return;
      g.money -= v.pris; closeModal(); play('coin');
      if (typ === 'glass') { g.hunger = Math.min(100, (g.hunger || 0) + v.hunger); if (v.energi) g.energy = Math.min(100, (g.energy || 0) + v.energi); const h = v.glad ? g.glad?.(v.glad, $t('Glass i djurparken'), 'zooglass', 2) || 0 : 0; toast($t`${v.icon} ${v.namn}! Mums.` + (h ? ` +${h} 😊` : ''), 'good'); }
      else { if (v.id === 'ballong') ballong = ['#d8343c', '#f0c030', '#3a7bd5'][Math.floor(Math.random() * 3)]; const h = g.glad?.(v.glad, $t('Souvenir från djurparken'), 'zoosouv', 3) || 0; toast(`${v.icon} ${v.rad}` + (h ? ` +${h} 😊` : ''), 'good'); }
      g.save();
    }));
  }
  function rida() {
    if (rider) return;
    if (!oppet()) { toast($t('🐴 Pricken har gått och lagt sig. Ponnyridningen är öppen när parken är det.'), 'bad'); return; }
    if (agerEvig('arskort')) { play('ok'); walker.stop(); rider = { t: 0 }; toast($t('🎟️ Årskortet gäller – upp i sadeln! Pricken går ett varv.'), 'good'); return; }
    openModal($t('🐴 Ponnyridningen'), `<p style="font-size:var(--f2);margin-top:0">${$t`Ett varv på ponnyn Pricken kostar <b>${fmt(PONNY_PRIS)}</b>. Han går lugnt – håll i sadeln!`}</p><p style="font-size:var(--f2)">💰 <b>${fmt(g.money)}</b></p>`, [
      { label: $t`Rid ett varv · ${fmt(PONNY_PRIS)}`, cls: g.money >= PONNY_PRIS ? 'btn-go' : '', disabled: g.money < PONNY_PRIS, onClick: () => { closeModal(); if (g.money < PONNY_PRIS) { toast($t('Du har inte råd just nu.'), 'bad'); return; } g.money -= PONNY_PRIS; g.save(); play('coin'); walker.stop(); rider = { t: 0 }; toast($t('🐴 Upp i sadeln! Pricken går ett varv.'), 'good'); } },
      { label: $t('Inte nu'), onClick: closeModal },
    ]);
  }
  function ridKlar() {
    rider = null;
    walker.px = (HAGN.ponny.grind[0] + HAGN.ponny.grind[1]) / 2; walker.py = HAGN.ponny.r[1] - 8; walker.stop(); walker.snapFree();
    const h = g.glad?.(2, $t('Ett varv på Pricken'), 'ponny', 4) || 0;
    toast($t('🐴 Pricken stannar vid grinden och får en morot. Tack för turen!') + (h ? ` +${h} 😊` : ''), 'good');
  }
  function foder() {
    if (g.money < FODER_PRIS) { toast($t('Du har inte fem kronor till fodret.'), 'bad'); return; }
    g.money -= FODER_PRIS; g.save(); play('coin'); mat = 14;
    toast($t('🌾 En näve getfoder! Stå still, så kommer getterna.'), 'good');
    for (const d of djur) if (d.hagn === 'klapp') d.tm = 0;
  }
  function klappa(d) {
    d.spec = 2; d.spStat = 'idle'; d.dir = walker.px < d.x ? 'left' : 'right';
    talk.say(pick([$t('Bääää! ❤️'), $t('Mäh! 😊'), $t('Bä bä … 🌾')]), () => ({ x: d.x, y: d.y - 20 }), 2, { animal: true, silent: true });
    play('click');
    const h = g.glad?.(1, $t('Klappzoo'), 'klappzoo', 3); if (h) toast(`😊 +${h}`);
  }
  function bussen() {
    const hem = busStopById(from?.buss) || BUS_STOPS[0];
    openModal($t('🚌 Djurbussen'), `<p style="font-size:var(--f2);margin-top:0">${$t`Bussen går tillbaka till <b>${$t(hem.name)}</b>. Biljetten kostar ${fmt(BUSS)}.`}</p>`, [
      { label: $t('🚌 Åk till stan'), cls: 'btn-go', onClick: () => { closeModal(); if (g.money < BUSS) { toast($t('Du har inte råd med bussen.'), 'bad'); return; } g.money -= BUSS; g.passTime(15); g.save(); play('door'); go(() => { A.cityPos = [hem.x + 6, hem.y - 2]; A.go('city'); }); } },
      { label: $t('Stanna kvar'), onClick: closeModal },
    ]);
  }
  function go(cb) { if (fade.phase === 1) return; fade.phase = 1; fade.cb = cb; }
  // 🦁 djurskötarjobbet (js/jobs/jobb-djur.js): efter passet står man vid personalhuset igen, entrén är betald
  function jobbet() {
    if (!A.jobReady?.('djurskotare')) { toast($t('🧹 Djurskötarjobbet öppnar snart – då får du mata djuren varje morgon.')); return; }
    A.djurparkFran = { betalt: true, personal: true, buss: from?.buss || '' }; play('door'); A.startJob('djurskotare');
  }

  // ---------- platserna ----------
  const spots = () => [
    { id: 'buss', r: [HALLPLATS.x - 12, HALLPLATS.y - 36, HALLPLATS.x + 14, HALLPLATS.y + 2], go: [HALLPLATS.x + 10, HALLPLATS.y - 8], label: $t('DJURBUSSEN TILL STAN'), act: bussen },
    { id: 'kassa', r: [KASSA.x - 18, KASSA.y - 50, KASSA.x + 18, KASSA.y + 2], go: [KASSA.x, KASSA.y + 10], label: betalt ? $t('BILJETTKASSAN') : agerEvig('arskort') ? $t('ENTRÉ · ÅRSKORT') : $t`ENTRÉ · ${fmt(ENTRE.PRIS)}`, act: biljett },
    { id: 'grind', r: [ENTRE.X - 10, ENTRE.GRIND[0] - 70, ENTRE.X + 10, ENTRE.GRIND[1] + 2], go: [ENTRE.X - 14, 286], label: betalt ? $t('IN I PARKEN') : $t('GRINDEN – BETALA I KASSAN'), act: grinden },
    { id: 'parkskylt', r: [PARK.x - 20, PARK.y - 46, PARK.x + 20, PARK.y], go: [PARK.x + 16, PARK.y + 2], label: $t('ÖPPETTIDER'), act: () => toast(`🦁 ${OPPETTEXT()}`) },
    ...HAGNLISTA.map((id) => { const H = HAGN[id], [sx, sy] = H.skylt; return { id: 'skylt-' + id, r: [sx - 24, sy - 32, sx + 24, sy + 2], go: [sx + (H.norr ? 0 : 0), sy + (H.norr ? 10 : -10)], label: DJURFAKTA[id].namn, act: () => { toast(`${DJURFAKTA[id].namn}: ${DJURFAKTA[id].rad}`); reagera(id); } }; }),
    { id: 'klappgrind', r: [HAGN.klapp.grind[0] - 6, HAGN.klapp.r[3] - 14, HAGN.klapp.grind[1] + 6, HAGN.klapp.r[3] + 4], go: [(HAGN.klapp.grind[0] + HAGN.klapp.grind[1]) / 2, HAGN.klapp.r[3] - 14], label: $t('KLAPPZOO – GÅ IN'), act: () => toast($t('🐐 Klicka på en get för att klappa den. Getfodret står till vänster.')) },
    { id: 'foder', r: [FODER.x - 8, FODER.y - 28, FODER.x + 8, FODER.y + 2], go: [FODER.x + 12, FODER.y + 2], label: $t`GETFODER · ${fmt(FODER_PRIS)}`, act: foder },
    { id: 'ponnygrind', r: [HAGN.ponny.grind[0] - 8, HAGN.ponny.r[1] - 14, HAGN.ponny.grind[1] + 8, HAGN.ponny.r[1] + 6], go: [(HAGN.ponny.grind[0] + HAGN.ponny.grind[1]) / 2, HAGN.ponny.r[1] - 8], label: agerEvig('arskort') ? $t('RID PÅ PRICKEN · ÅRSKORT') : $t`RID PÅ PRICKEN · ${fmt(PONNY_PRIS)}`, act: rida },
    { id: 'glass', r: [GLASSKIOSK.x - 24, GLASSKIOSK.y - 62, GLASSKIOSK.x + 24, GLASSKIOSK.y], go: [GLASSKIOSK.x, GLASSKIOSK.y + 10], label: $t('GLASSKIOSKEN'), act: () => kiosk('glass') },
    { id: 'souvenir', r: [SOUVENIR.x - 24, SOUVENIR.y - 62, SOUVENIR.x + 24, SOUVENIR.y], go: [SOUVENIR.x, SOUVENIR.y + 10], label: $t('SOUVENIRKIOSKEN'), act: () => kiosk('souvenir') },
    { id: 'personal', r: [PERSONALHUS.x - 24, PERSONALHUS.y - 48, PERSONALHUS.x + 24, PERSONALHUS.y], go: [PERSONALHUS.x, PERSONALHUS.y + 8], label: $t('PERSONALHUSET – DJURSKÖTARJOBBET'), act: jobbet },
    { id: 'bro', r: [BRO.x - 12, HAGN.damm.r[1], BRO.x + 12, HAGN.damm.r[3]], go: [BRO.x, HAGN.damm.r[1] - 8], label: $t('BRON ÖVER DAMMEN'), act: () => { toast($t('🦆 Änderna samlas under bron och väntar på ärtor. Du har inga – de simmar vidare.')); reagera('damm'); } },
    { id: 'pafagel', r: [pafagel.x - 14, pafagel.y - 30, pafagel.x + 14, pafagel.y + 2], go: [pafagel.x + (walker.px < pafagel.x ? -20 : 20), pafagel.y + 4], label: $t('PÅFÅGELN'), act: () => { pafagel.spec = 4; toast($t('🦚 Påfågeln slår ut stjärten – hundra ögon tittar på dig.')); const h = g.glad?.(1, '', 'pafagel', 1); if (h) toast(`😊 +${h}`); } },
  ];
  const PARK = { x: 60, y: 300 };
  const spotAt = (x, y) => spots().find((s) => x >= s.r[0] && x <= s.r[2] && y >= s.r[1] && y <= s.r[3]);
  const folkAt = (x, y) => folk.find((o) => Math.abs(o.x - x) < 7 && y < o.y + 2 && y > o.y - 30);
  const getAt = (x, y) => djur.find((d) => d.hagn === 'klapp' && Math.abs(d.x - x) < 10 && y < d.y + 3 && y > d.y - 16);

  // ---------- rekvisitan ----------
  const KIT = propKit();
  const sken = (ctx, x, y, r, col) => { const gr = ctx.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, col); gr.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = gr; ctx.fillRect(x - r, y - r, r * 2, r * 2); };
  const vind = (x) => Math.round(Math.sin(t * 0.9 + x * 0.01) * 0.6);
  const ritaFolk = (ctx, o) => { drawPerson(ctx, o.x, o.y, o.look, o.dir, o.vila <= 0 ? WALK_SEQ[Math.floor(t * 8.5 + o.x) % 4] : 0); if (o.ballong) ritaBallong(ctx, o.x + (o.dir === 'left' ? 6 : -6), o.y - 30, t + o.x, o.ballong); };

  return {
    viewMax: { w: TW, h: TH },
    get worldX() { return rider ? ponny.x : walker.px; }, get worldY() { return rider ? ponny.y : walker.py; },
    get worldRide() { const F = fordon(); return F ? { id: F.id, c: F.c } : null; },
    rideChanged: applyRide,
    update(dt) {
      t += dt; banner += dt;
      VW = Math.max(384, Math.min(A.W || 384, TW)); VH = Math.max(160, Math.min(A.H || 216, TH));
      if (fade.phase === 1) { fade.a = Math.min(1, fade.a + dt * 2.6); if (fade.a >= 1) { fade.phase = 0; const cb = fade.cb; fade.cb = null; cb?.(); return; } }
      else if (fade.phase === 2) { fade.a = Math.max(0, fade.a - dt * 1.8); if (fade.a <= 0) fade.phase = 0; if (!rider) walker.update(dt); }
      else if (!rider) walker.update(dt);
      updDjur(dt); updLiv(dt);
      if (pets) try { pets.update(dt, walker.px, walker.py, (x, y) => walker.walkable(x, y)); } catch (e) { console.error('husdjuren i Djurparken:', e); pets = null; }
      const c = camTarget(); cam.x += (c.x - cam.x) * Math.min(1, dt * 8); cam.y += (c.y - cam.y) * Math.min(1, dt * 8);
    },
    draw(ctx) {
      ctx.setTransform(A.pxs, 0, 0, A.pxs, 0, 0);
      ctx.imageSmoothingEnabled = false;
      const N = night(), D = dusk();
      const cx = Math.round(cam.x), cy = Math.round(cam.y);
      ctx.drawImage(skyCanvas(VW, N, D), 0, Math.min(0, -cy * 0.3));
      const bk = kullCanvas(N), off = -Math.round(cx * 0.5) % bk.width, by = Math.round(G.TOP + 4 - bk.height - cy * 0.9);
      for (let x = off; x < VW; x += bk.width) ctx.drawImage(bk, x, by);
      ctx.drawImage(ground(), -cx, -cy);
      ctx.save(); ctx.translate(-cx, -cy);
      const items = [];
      const syns = (x, m = 80) => x > cx - m && x < cx + VW + m;
      for (const tr of TRAD) if (syns(tr.x)) items.push({ fy: tr.y, draw: () => KIT.tree(ctx, tr.kind, tr.x, tr.y, { vind: vind(tr.x) }) });
      for (const id of HAGNLISTA) { const H = HAGN[id]; if (!syns((H.r[0] + H.r[2]) / 2, (H.r[2] - H.r[0]) / 2 + 40)) continue; items.push({ fy: H.norr ? H.r[3] + 0.6 : H.r[1] + 0.6, draw: () => ritaStaketFram(ctx, H, N) }, { fy: H.skylt[1], draw: () => ritaSkylt(ctx, H.skylt[0], H.skylt[1], DJURFAKTA[id].namn) }); }
      items.push({ fy: LADA.y, draw: () => ritaLada(ctx, N) }, { fy: FODER.y, draw: () => ritaFoder(ctx) }, { fy: KLATTER.y, draw: () => ritaKlatter(ctx, t) }, { fy: LEJONKLIPPA.y, draw: () => ritaKlippa(ctx) }, { fy: GROTTA.y, draw: () => ritaGrotta(ctx) });
      for (const [ax, ay] of AKACIOR) items.push({ fy: ay, draw: () => ritaAkacia(ctx, ax, ay, vind(ax)) });
      items.push({ fy: LERPOL.y + LERPOL.ry + 6, draw: () => ritaTrag(ctx, 1330, 212) });
      for (const [bx, byy] of PICKNICK.bord) items.push({ fy: byy, draw: () => ritaPicknickbord(ctx, bx, byy) });
      items.push({ fy: GLASSKIOSK.y, draw: () => ritaKiosk(ctx, 'glass', N) }, { fy: SOUVENIR.y, draw: () => ritaKiosk(ctx, 'souvenir', N) }, { fy: PERSONALHUS.y, draw: () => ritaPersonalhus(ctx, N) }, { fy: KASSA.y, draw: () => ritaKassa(ctx, N) });
      items.push({ fy: ENTRE.GRIND[0], draw: () => ritaGrindstolpe(ctx, ENTRE.X, ENTRE.GRIND[0], { skylt: true, natt: N }) }, { fy: ENTRE.GRIND[1] + 2, draw: () => ritaGrindstolpe(ctx, ENTRE.X, ENTRE.GRIND[1] + 2, { natt: N }) }, { fy: ENTRE.GRIND[1] + 1, draw: () => ritaGrind(ctx, betalt) });
      items.push({ fy: HALLPLATS.y, draw: () => ritaHallplats(ctx) }, { fy: PARK.y, draw: () => ritaParkskylt(ctx) });
      for (const [bx, byy] of BANKAR) if (syns(bx)) items.push({ fy: byy, draw: () => KIT.bench(ctx, bx, byy) });
      for (const [bx, byy] of PAPPERSKORGAR) if (syns(bx)) items.push({ fy: byy, draw: () => KIT.bin(ctx, bx, byy) });
      for (const l of LYKTOR) if (syns(l.x)) items.push({ fy: l.y, draw: () => KIT.lamp(ctx, l.x, l.y) });
      for (const [vx, vy] of [[520, 486], [740, 488], [1590, 490], [1930, 492], [1700, 370], [250, 352]]) if (syns(vx)) items.push({ fy: vy, draw: () => ritaVass(ctx, vx, vy) });
      for (const d of djur) if (syns(d.x)) items.push({ fy: d.fy ?? d.y, draw: () => ritaDjur(ctx, d.art, d.x, d.y, { st: d.st, f: d.st === 'walk' ? Math.floor(t * 6 + d.x) % 2 : (d.art === 'flamingo' && d.st === 'idle' ? (hash(d.x | 0, 1, 2) > 0.5 ? 1 : 0) : 0), dir: d.dir, natt: N }) });
      for (const k of kaniner) items.push({ fy: k.y, draw: () => drawPet(ctx, k.x, k.y, k.pet, k.anim, t, k.dir) });
      items.push({ fy: ponny.y, draw: () => { ritaDjur(ctx, 'ponny', ponny.x, ponny.y, { st: 'walk', f: ponny.f, dir: ponny.dir, natt: N }); if (rider) drawPerson(ctx, ponny.x + SADEL.dx, ponny.y + SADEL.dy + 8, A.avatar.look, ponny.dir, 5); else if (oppet()) drawPerson(ctx, ponny.x + SADEL.dx, ponny.y + SADEL.dy + 8, KID, ponny.dir, 5); } });
      items.push({ fy: skotare.y, draw: () => { drawPerson(ctx, skotare.x, skotare.y, skotare.look, skotare.dir, skotare.vila <= 0 ? [7, 9, 8, 9][Math.floor(t * 8.5) % 4] : 9); ritaSkottkarra(ctx, skotare.x + (skotare.dir === 'left' ? -12 : 12), skotare.y + 1, skotare.dir); } });
      for (const o of folk) if (syns(o.x)) items.push({ fy: o.y, draw: () => ritaFolk(ctx, o) });
      items.push(...folkDrawables(A, t));
      if (pets) for (const d of pets.drawables()) items.push({ fy: d.fy ?? d.y, draw: () => d.draw(ctx) });
      if (!rider) { const F = fordon(); const me = selfDrawable(A, walker, t, { folksHere: worldFolksHere(A).length, ride: F ? { id: F.id, c: F.c } : null }); items.push({ fy: me.fy, draw: () => { me.draw(ctx); if (ballong) ritaBallong(ctx, walker.px + (walker.dir === 'left' ? 6 : -6), walker.py - 30, t, ballong); } }); }
      items.sort((a, b) => a.fy - b.fy).forEach((d) => d.draw(ctx));
      ctx.restore();
      if (N || D) {
        ctx.fillStyle = N ? 'rgba(12,16,48,0.5)' : 'rgba(60,40,90,0.2)'; ctx.fillRect(0, 0, VW, VH);
        if (D) { ctx.fillStyle = 'rgba(255,140,80,0.10)'; ctx.fillRect(0, 0, VW, VH); }
        ctx.save(); ctx.translate(-cx, -cy);
        for (const l of LYKTOR) if (syns(l.x)) KIT.lampGlow(ctx, l.x, l.y, N ? 1 : 0.5);
        ctx.globalCompositeOperation = 'lighter';
        for (const k of [GLASSKIOSK, SOUVENIR, KASSA]) if (syns(k.x)) sken(ctx, k.x, k.y - 22, 30, `rgba(255,200,120,${N ? 0.3 : 0.15})`);
        ctx.globalCompositeOperation = 'source-over';
        ctx.restore();
      }
      ctx.save(); ctx.translate(-cx, -cy); talk.draw(ctx, { x0: cx, x1: cx + VW }); ctx.restore();
      if (rider) { const w = 60, x = (VW - w) >> 1, y = 8; ctx.fillStyle = 'rgba(20,18,26,.85)'; ctx.fillRect(x - 1, y - 1, w + 2, 6); ctx.fillStyle = '#5a3a28'; ctx.fillRect(x, y, w, 4); ctx.fillStyle = '#f0c030'; ctx.fillRect(x, y, Math.round(w * rider.t / RIDTUR), 4); }
      if (banner < 4) { const a = banner < 0.4 ? banner / 0.4 : banner > 3.4 ? (4 - banner) / 0.6 : 1; ctx.globalAlpha = Math.max(0, a); const s = $t('DJURPARKEN'), s2 = $t('LEJON, ELEFANTER OCH EN PONNY SOM HETER PRICKEN'), w = Math.max(textW(BIG, s, 2), textW(SMALL, s2)) + 20; ctx.fillStyle = 'rgba(20,18,26,.85)'; ctx.fillRect((VW - w) >> 1, 26, w, 30); ctxText(ctx, BIG, s, (VW - textW(BIG, s, 2)) >> 1, 30, '#f8e080', 2); ctxText(ctx, SMALL, s2, (VW - textW(SMALL, s2)) >> 1, 48, '#f4f1ea'); ctx.globalAlpha = 1; }
      const s = hover && spotAt(hover.x + cx, hover.y + cy);
      if (s) { const w = textW(SMALL, s.label) + 10, x = Math.round(Math.max(2, Math.min(VW - w - 2, hover.x - w / 2))), y = Math.max(2, hover.y - 22); ctx.fillStyle = 'rgba(20,18,26,.9)'; ctx.fillRect(x, y, w, 11); ctxText(ctx, SMALL, s.label, x + 5, y + 3, '#ffd23f'); }
      if (fade.a > 0) { ctx.fillStyle = `rgba(10,10,16,${fade.a.toFixed(2)})`; ctx.fillRect(0, 0, VW, VH); }
    },
    down(sx, sy) {
      if (fade.phase === 1 || rider) return;
      hover = { x: sx, y: sy };
      const x = sx + cam.x, y = sy + cam.y;
      const fk = folkTapAt(A, x, y);
      if (fk) { openSpelarkort(A, fk); return; }
      const o = folkAt(x, y);
      if (o) { walker.walkTo(o.x + (walker.px < o.x ? -14 : 14), o.y + 2, () => { o.vila = Math.max(o.vila, 4); talk.say(o.rad, () => ({ x: o.x, y: o.y - 34 }), 3.5, { voice: o.look }); }); return; }
      const d = getAt(x, y);
      if (d) { walker.walkTo(d.x + (walker.px < d.x ? -14 : 14), d.y + 2, () => klappa(d)); return; }
      const s = spotAt(x, y);
      if (s) { walker.walkTo(s.go[0], s.go[1], s.act); return; }
      walker.walkTo(x, y);
    },
    move(sx, sy) { hover = { x: sx, y: sy }; },
    exit() { talk.clear(); },
    _debug: {
      pos: () => ({ x: walker.px, y: walker.py }),
      cam: () => ({ ...cam }),
      teleport: (x, y) => { walker.px = x; walker.py = y; walker.stop(); walker.snapFree(); Object.assign(cam, camTarget()); },
      walkable: (x, y) => walker.walkable(x, y),
      spots: () => spots().map((s) => s.id),
      act: (id) => { const s = spots().find((q) => q.id === id); if (!s) return false; s.act(); return true; },
      prat: () => talk.text(),
      fade: () => fade.phase,
      betalt: () => betalt,
      oppet: () => oppet(),
      djur: (hagn) => djur.filter((d) => !hagn || d.hagn === hagn).map((d) => ({ art: d.art, x: Math.round(d.x), y: Math.round(d.y), st: d.st, dir: d.dir })),
      ponny: () => ({ x: Math.round(ponny.x), y: Math.round(ponny.y), dir: ponny.dir, rider: rider ? +rider.t.toFixed(1) : null }),
      ridKlar: () => { if (!rider) return false; rider.t = RIDTUR; return true; },
      mat: () => mat > 0,
      ballong: () => ballong,
      klappa: (i = 0) => { const d = djur.filter((q) => q.hagn === 'klapp')[i]; if (!d) return false; klappa(d); return true; },
      pafagel: () => ({ x: Math.round(pafagel.x), y: Math.round(pafagel.y), st: pafagel.st }),
    },
  };
}
const KID = { skin: '#f0cfae', hair: '#e0a040', style: 'ponytail', top: 'tee', shirt: '#f06aa0', accent: '#f4f1ea', bottom: 'pants', pants: '#3a7bd5', shoes: '#f4f1ea', glasses: null, beard: false, phones: false, bag: null, hat: null, apron: false, build: 2, blush: true, kid: true };
// marken målas en gång
let GROUND = null;
const ground = () => (GROUND ||= paintGround());
