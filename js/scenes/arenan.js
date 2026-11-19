// 🏟️ ARENAN – stadsdel 5 i stadsdelsplanen (Carl 2026-11-18: "Arenan: matchdag-minispel, simhall, sportaffär,
// skridskobana"). En egen plats som Djurparken: arenabussen går hit från stadens hållplatser (city.js, raden ARENAN).
// Steg 1 (den här filen): ARENATORGET med PIXEL ARENA (matchdagen öppnar i nästa steg), SPORTAFFÄREN (skridskor och
// KBK-halsduk), SIMHALLENS fasad (öppnar i nästa steg), FIKAT, varmkorvsgubben, statyn av KBK-legendaren, flaggorna –
// och söder om torget SKRIDSKOBANAN (egna skridskor eller hyr för HYRA_PRIS: glid runt på isen, spåren syns, första
// åket om dagen ger lycka) och KBK-PLANEN där barnen passar bollen och man skjuter STRAFFAR: fem skott mot målet, en
// markör sveper upp och ner, målvakten täcker en tredjedel – klicka när markören är i en fri del.
//
// _debug-API för tools/arenan-test.mjs.
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
import { KUNGS_PLAYERS } from '../data/kbk.js';
import { TW, TH, G, HALLPLATS, KBK, HUS, HUSLISTA, BILJETT, STATY, FIKAT, KORV, FLAGGOR, RINK, RINK_LJUS, CHOKLAD, PLAN, STRAFF, BANKAR, LYKTOR, PAPPERSKORGAR, TRAD, SKYLT, SKRIDSKO_PRIS, HYRA_PRIS, HALSDUK_PRIS, hinder, takCanvas, paintGround } from '../arenan/karta.js';
import { ritaHus, ritaBiljett, ritaStaty, ritaFikat, ritaChoklad, ritaKorvgubbe, ritaFlagga, ritaSarg, ritaStralkastare, ritaBur, ritaMal, ritaBoll, ritaSkridskor, ritaIsspar, ritaSkylt, ritaHallplats } from '../arenan/deko.js';
import { dagensMotstandare, BILJETT_PRIS } from './matchdag.js';
import { $t } from '../core/i18n.js';

const BUSS = 10, GANG = 62, IS_FART = 118, MATCH_TID = [12, 20];
const TORGPRAT = [
  $t('KBK vann med 2–1 i söndags. Hela torget sjöng!'), $t('Statyn är Gunvor – hon gjorde 200 mål för KBK.'), $t('Simhallen har en rutschkana med tre kurvor.'),
  $t('Isen är nyspolad. Perfekt för piruetter.'), $t('Varmkorven här är bäst efter matchen.'), $t('Jag har stått på läktaren i trettio år.'),
];
const FIKA = [
  { id: 'kaffe', icon: '☕', namn: $t('Kaffe'), pris: 20, hunger: 3, energi: 10, glad: 1 },
  { id: 'bulle', icon: '🥐', namn: $t('Kanelbulle'), pris: 20, hunger: 14, glad: 1 },
  { id: 'lask', icon: '🥤', namn: $t('Läsk'), pris: 15, hunger: 5, energi: 6, glad: 0 },
];
const ZONER = 3;   // målet delas i tre delar (överst, mitten, nederst)

export function makeArenan(A) {
  const g = A.game;
  let VW = Math.max(384, Math.min(A.W || 384, TW)), VH = Math.max(160, Math.min(A.H || 216, TH));
  const from = A.arenaFran || null; A.arenaFran = null;
  let lage = 'torg';   // torg | is | plan
  const walker = createCityWalker({ W: TW, H: TH, left: 2, right: TW - 2, top: G.TOP, bottom: G.BOTTOM, spawn: from?.arena ? [(HUS.arena.door.x0 + HUS.arena.door.x1) / 2, G.BASE + 10] : [HALLPLATS.x + 16, HALLPLATS.y - 8] });
  const fordon = () => g.aker;
  const applyRide = () => { if (lage === 'is') return; const F = fordon(); walker.speed = GANG * (F ? F.fart : 1); };
  applyRide();
  walker.setObstacles(hinder('torg'));
  walker.snapFree();
  const talk = createSpeech();
  let t = 0, hover = null, banner = 0, straff = null, isspar = [], spar = 0;
  const fade = { a: 1, phase: 2, cb: null };
  const cam = { x: 0, y: 0 };
  const camTarget = () => { const S = synligRuta(VH), py = walker.py, u = Math.max(0, Math.min(1, (py - 296) / 44)), k = 0.94 - u * 0.44; return { x: Math.max(0, Math.min(TW - VW, walker.px - VW / 2)), y: Math.max(0, Math.min(Math.max(0, TH - S.y1), py - S.y0 - S.h * k)) }; };
  Object.assign(cam, camTarget());
  let pets = null;
  try { pets = createPetWalk(A); } catch (e) { console.error('husdjuren på Arenan startade inte:', e); }
  const hour = () => g.min / 60;
  const night = () => hour() >= 20 || hour() < 5.5;
  const dusk = () => (hour() >= 18 && hour() < 20) || (hour() >= 5.5 && hour() < 7);
  const rnd = (a, b) => a + Math.random() * (b - a);
  if (!A.attract) { const h = g.glad?.(2, '', 'arenan', 2); if (h) setTimeout(() => toast($t`🏟️ Arenan! Här spelar KBK. +${h} 😊`, 'good'), 900); }

  // ---------- folket, skridskoåkarna, barnen på planen ----------
  const folk = [0, 1, 2, 3, 4, 5].map((i) => ({ look: { ...makeLook(), kid: i === 2 }, x: 200 + i * 260, y: i % 2 ? 300 : 236 + (i % 3) * 8, dir: i % 2 ? 'left' : 'right', fart: rnd(16, 26), vila: 0, rad: TORGPRAT[i % TORGPRAT.length], halsduk: i % 2 === 0 }));
  const akare = [0, 1, 2].map((i) => ({ look: { ...makeLook(), kid: i === 1 }, ang: i * 2.1, fart: rnd(0.5, 0.8), x: 0, y: 0, dir: 'right' }));
  const barn = [{ look: { ...makeLook(), kid: true, shirt: '#7a1a2a' }, x: 1120, y: 400, namn: KUNGS_PLAYERS[1][1] }, { look: { ...makeLook(), kid: true, shirt: '#7a1a2a' }, x: 1220, y: 460, namn: KUNGS_PLAYERS[11][1] }];
  const boll = { x: 1120, y: 400, fran: 0, u: 0, h: 0, r: 0 };
  function updLiv(dt) {
    for (const o of folk) {
      if (o.vila > 0) { o.vila -= dt; continue; }
      o.x += (o.dir === 'right' ? 1 : -1) * o.fart * dt;
      if (o.x > TW - 60) { o.dir = 'left'; o.vila = rnd(1, 3); }
      if (o.x < 60) { o.dir = 'right'; o.vila = rnd(1, 3); }
      if (Math.random() < dt * 0.04) o.vila = rnd(2, 6);
    }
    const cx = (RINK.x0 + RINK.x1) / 2, cy = (RINK.y0 + RINK.y1) / 2;
    for (const a of akare) { a.ang += a.fart * dt; const nx = cx + Math.cos(a.ang) * 200, ny = cy + Math.sin(a.ang) * 48; a.dir = nx < a.x ? 'left' : 'right'; a.x = nx; a.y = ny; if (Math.random() < dt * 6) isspar.push({ x: a.x, y: a.y, a: 1 }); }
    if (lage === 'is' && walker.path.length && Math.random() < dt * 10) isspar.push({ x: walker.px, y: walker.py, a: 1 });
    for (const s of isspar) s.a -= dt * 0.12;
    while (isspar.length && isspar[0].a <= 0) isspar.shift();
    if (isspar.length > 400) isspar.splice(0, isspar.length - 400);
    // barnen passar bollen fram och tillbaka (står stilla när man skjuter straffar)
    if (!straff) { boll.u += dt * 0.9; if (boll.u >= 1) { boll.u = 0; boll.fran = 1 - boll.fran; boll.r = 0; } const a = barn[boll.fran], b = barn[1 - boll.fran]; boll.x = a.x + (b.x - a.x) * boll.u + 6; boll.y = a.y + (b.y - a.y) * boll.u + 2; boll.h = Math.sin(boll.u * Math.PI) * 10; boll.r += dt * 8; }
  }

  // ---------- isen, planen, straffarna ----------
  function paIsen() {
    lage = 'is'; walker.stop(); walker.setObstacles(hinder('is')); walker.px = (RINK.grind[0] + RINK.grind[1]) / 2; walker.py = RINK.y0 + 16; walker.snapFree(); walker.speed = IS_FART; play('slide');
    toast(g.skridskor ? $t('⛸️ Dina egna skridskor! Klicka på isen så glider du dit – ut genom grinden när du är klar.') : $t('⛸️ Hyrskridskorna sitter. Klicka på isen så glider du dit – ut genom grinden när du är klar.'), 'good');
  }
  function avIsen() {
    lage = 'torg'; walker.stop(); walker.setObstacles(hinder('torg')); walker.px = (RINK.grind[0] + RINK.grind[1]) / 2; walker.py = RINK.y0 - 12; walker.snapFree(); applyRide();
    const h = g.glad?.(2, $t('Skridskor på Arenan'), 'skridsko', 2) || 0;
    toast($t('⛸️ Du kliver av isen med röda kinder.') + (h ? ` +${h} 😊` : ''), 'good');
  }
  function banan() {
    if (lage === 'is') { avIsen(); return; }
    if (g.skridskor) { paIsen(); return; }
    openModal($t('⛸️ Skridskobanan'), `<p style="font-size:var(--f2);margin-top:0">${$t`Hyr skridskor för <b>${fmt(HYRA_PRIS)}</b> och åk så länge du vill. (Sportaffären säljer egna – då är isen gratis.)`}</p><p style="font-size:var(--f2)">💰 <b>${fmt(g.money)}</b></p>`, [
      { label: $t`⛸️ Hyr skridskor · ${fmt(HYRA_PRIS)}`, cls: g.money >= HYRA_PRIS ? 'btn-go' : '', disabled: g.money < HYRA_PRIS, onClick: () => { closeModal(); if (g.money < HYRA_PRIS) { toast($t('Du har inte råd att hyra skridskor.'), 'bad'); return; } g.money -= HYRA_PRIS; g.save(); play('coin'); paIsen(); } },
      { label: $t('Inte nu'), onClick: closeModal },
    ]);
  }
  function paPlanen() { lage = 'plan'; walker.stop(); walker.setObstacles(hinder('plan')); walker.px = (PLAN.grind[0] + PLAN.grind[1]) / 2; walker.py = PLAN.y0 + 16; walker.snapFree(); play('click'); toast($t('⚽ KBK-planen! Gå till straffpunkten och skjut fem straffar.')); }
  function avPlanen() { lage = 'torg'; straff = null; walker.stop(); walker.setObstacles(hinder('torg')); walker.px = (PLAN.grind[0] + PLAN.grind[1]) / 2; walker.py = PLAN.y0 - 12; walker.snapFree(); applyRide(); }
  function startStraff() {
    if (straff) return;
    walker.stop(); walker.px = STRAFF.x; walker.py = STRAFF.y; walker.dir = 'right';
    straff = { skott: 0, mal: 0, fas: 'sikta', mv: Math.floor(Math.random() * ZONER), boll: null, text: '', textT: 0 };
    play('click');
  }
  const markorZon = () => { const u = (Math.sin(t * 2.6) + 1) / 2; return Math.min(ZONER - 1, Math.floor(u * ZONER)); };
  function skjut(zon = markorZon()) {
    if (!straff || straff.fas !== 'sikta') return null;
    const mal = zon !== straff.mv;
    straff.fas = 'skott'; straff.skott++; if (mal) straff.mal++;
    straff.boll = { t: 0, zon, mal };
    straff.text = mal ? $t('MÅL!') : $t('RÄDDNING!'); straff.textT = 1.4;
    play(mal ? 'ok' : 'miss');
    return mal;
  }
  function straffKlar() {
    const s = straff; straff = null;
    const h = s.mal >= 5 ? g.glad?.(3, $t('Fem av fem på straffar'), 'straff', 3) || 0 : s.mal >= 3 ? g.glad?.(2, $t('Straffar på KBK-planen'), 'straff', 3) || 0 : 0;
    toast((s.mal >= 5 ? $t('⚽ FEM AV FEM! Gunvor hade varit stolt.') : s.mal >= 3 ? $t`⚽ ${s.mal} av 5 mål – bra skjutet!` : $t`⚽ ${s.mal} av 5 mål. Målvakten var vass i dag – försök igen!`) + (h ? ` +${h} 😊` : ''), s.mal >= 3 ? 'good' : '');
  }
  function updStraff(dt) {
    if (!straff) return;
    if (straff.textT > 0) straff.textT -= dt;
    if (straff.fas === 'skott') { straff.boll.t += dt * 2.2; if (straff.boll.t >= 1.4) { straff.boll = null; straff.mv = Math.floor(Math.random() * ZONER); straff.fas = straff.skott >= 5 ? 'klar' : 'sikta'; if (straff.fas === 'klar') straffKlar(); } }
  }

  // ---------- affärerna ----------
  function sportaffaren() {
    play('click');
    const rader = [
      `<div class="prow" style="grid-template-columns:auto 1fr auto"><span style="font-size:22px">⛸️</span><span class="nm">${esc($t('Skridskor'))}<br><small class="sp">${g.skridskor ? $t('Dina – isen är gratis') : fmt(SKRIDSKO_PRIS)}</small></span><button class="btn btn-small ${g.skridskor ? '' : 'btn-go'}" data-vara="skridskor" ${g.skridskor || g.money < SKRIDSKO_PRIS ? 'disabled' : ''}>${g.skridskor ? $t('Har') : $t('Köp')}</button></div>`,
      `<div class="prow" style="grid-template-columns:auto 1fr auto"><span style="font-size:22px">🧣</span><span class="nm">${esc($t('KBK-halsduk'))}<br><small class="sp">${fmt(HALSDUK_PRIS)}</small></span><button class="btn btn-small btn-go" data-vara="halsduk" ${g.money < HALSDUK_PRIS ? 'disabled' : ''}>${$t('Köp')}</button></div>`,
    ].join('');
    const dlg = openModal($t('🏒 Sportaffären'), `<p style="font-size:var(--f2);margin-top:0">${$t('Bollar, klubbor, tröjor och skridskor i alla storlekar. Med egna skridskor är banan gratis.')}</p><div class="plist">${rader}</div><p style="font-size:var(--f2)">💰 <b>${fmt(g.money)}</b></p>`, [{ label: $t('Stäng'), onClick: closeModal }]);
    dlg.querySelectorAll('[data-vara]').forEach((b) => (b.onclick = () => {
      if (b.dataset.vara === 'skridskor') { if (g.skridskor || g.money < SKRIDSKO_PRIS) return; g.money -= SKRIDSKO_PRIS; g.skridskor = true; g.save(); closeModal(); play('fanfare'); toast($t('⛸️ Egna skridskor! Banan är gratis för dig från och med nu.'), 'good'); }
      else { if (g.money < HALSDUK_PRIS) return; g.money -= HALSDUK_PRIS; g.save(); closeModal(); play('coin'); const h = g.glad?.(2, $t('KBK-halsduk'), 'halsduk', 2) || 0; toast($t('🧣 Vinrött och svart runt halsen. Heja KBK!') + (h ? ` +${h} 😊` : ''), 'good'); }
    }));
  }
  function fikat() {
    play('click');
    const rader = FIKA.map((v) => `<div class="prow" style="grid-template-columns:auto 1fr auto"><span style="font-size:22px">${v.icon}</span><span class="nm">${esc(v.namn)}<br><small class="sp">${fmt(v.pris)}</small></span><button class="btn btn-small btn-go" data-vara="${v.id}" ${g.money < v.pris ? 'disabled' : ''}>${$t('Köp')}</button></div>`).join('');
    const dlg = openModal($t('☕ Fikat'), `<p style="font-size:var(--f2);margin-top:0">${$t('Kaffe, bullar och läsk – och matchresultaten på en krittavla.')}</p><div class="plist">${rader}</div>`, [{ label: $t('Stäng'), onClick: closeModal }]);
    dlg.querySelectorAll('[data-vara]').forEach((b) => (b.onclick = () => { const v = FIKA.find((q) => q.id === b.dataset.vara); if (!v || g.money < v.pris) return; g.money -= v.pris; g.hunger = Math.min(100, (g.hunger || 0) + v.hunger); if (v.energi) g.energy = Math.min(100, (g.energy || 0) + v.energi); const h = v.glad ? g.glad?.(v.glad, $t('Fika på Arenan'), 'arenafika', 2) || 0 : 0; g.save(); closeModal(); play('coin'); toast($t`${v.icon} ${v.namn}! Mums.` + (h ? ` +${h} 😊` : ''), 'good'); }));
  }
  function korven() { const pris = 25; if (g.money < pris) { toast($t('Du har inte råd med en korv.'), 'bad'); return; } g.money -= pris; g.hunger = Math.min(100, (g.hunger || 0) + 22); const h = g.glad?.(1, $t('Varmkorv på Arenan'), 'arenakorv', 2) || 0; g.save(); play('coin'); toast($t('🌭 En varmkorv med senap och ketchup – matchdagsmat!') + (h ? ` +${h} 😊` : ''), 'good'); }
  function chokladen() { const pris = 20; if (g.money < pris) { toast($t('Du har inte råd med chokladen.'), 'bad'); return; } g.money -= pris; g.hunger = Math.min(100, (g.hunger || 0) + 8); g.energy = Math.min(100, (g.energy || 0) + 8); const h = g.glad?.(1, $t('Varm choklad vid isen'), 'arenachoklad', 2) || 0; g.save(); play('coin'); toast($t('🍫 Varm choklad med grädde – händerna tinar. +8 ⚡') + (h ? ` +${h} 😊` : ''), 'good'); }
  function bussen() {
    const hem = busStopById(from?.buss) || BUS_STOPS[0];
    openModal($t('🚌 Arenabussen'), `<p style="font-size:var(--f2);margin-top:0">${$t`Bussen går tillbaka till <b>${$t(hem.name)}</b>. Biljetten kostar ${fmt(BUSS)}.`}</p>`, [
      { label: $t('🚌 Åk till stan'), cls: 'btn-go', onClick: () => { closeModal(); if (g.money < BUSS) { toast($t('Du har inte råd med bussen.'), 'bad'); return; } g.money -= BUSS; g.passTime(15); g.save(); play('door'); go(() => { A.cityPos = [hem.x + 6, hem.y - 2]; A.go('city'); }); } },
      { label: $t('Stanna kvar'), onClick: closeModal },
    ]);
  }
  function go(cb) { if (fade.phase === 1) return; fade.phase = 1; fade.cb = cb; }
  // ⚽ matchdagen (js/scenes/matchdag.js): biljetten i luckan, matcher 12–20, dagens motståndare
  function matchBiljett() {
    const h = hour();
    if (h < MATCH_TID[0] || h >= MATCH_TID[1]) { toast($t`🎟️ Matcherna spelas ${MATCH_TID[0]}–${MATCH_TID[1]}. Biljettluckan är stängd.`, 'bad'); return; }
    const m = dagensMotstandare(g.day);
    play('click');
    openModal($t('🎟️ Biljettluckan'), `<p style="font-size:var(--f2);margin-top:0">${$t`I dag: <b>KBK – ${m.namn}</b> på Pixel Arena. Ståplats på klacken bland supportrarna, avspark så fort du satt dig. Biljetten kostar <b>${fmt(BILJETT_PRIS)}</b>.`}</p><p style="font-size:var(--f2)">${$t('Kjell i klacken ropar vad ni ska göra – klappa, heja, vågen och sjunga. Ju bättre stämning, desto fler mål gör KBK.')}</p>`, [
      { label: $t`🎟️ Köp biljett · ${fmt(BILJETT_PRIS)}`, cls: 'btn-go', onClick: () => { closeModal(); if (g.money < BILJETT_PRIS) { toast($t('Du har inte råd med biljetten.'), 'bad'); return; } g.money -= BILJETT_PRIS; g.save(); play('coin'); A.matchFran = { buss: from?.buss || '' }; go(() => A.go('matchdag')); } },
      { label: $t('Inte nu'), onClick: closeModal },
    ]);
  }

  // ---------- platserna ----------
  const dorr = (id) => { const h = HUS[id]; return { r: [h.door.x0 - 4, G.BASE - 40, h.door.x1 + 4, G.BASE], go: [(h.door.x0 + h.door.x1) / 2, G.BASE + 8] }; };
  const spots = () => lage === 'is' ? [
    { id: 'grind-is', r: [RINK.grind[0] - 8, RINK.y0 - 14, RINK.grind[1] + 8, RINK.y0 + 24], go: [(RINK.grind[0] + RINK.grind[1]) / 2, RINK.y0 + 16], label: $t('UT GENOM GRINDEN'), act: avIsen },
  ] : lage === 'plan' ? [
    { id: 'grind-plan', r: [PLAN.grind[0] - 8, PLAN.y0 - 14, PLAN.grind[1] + 8, PLAN.y0 + 24], go: [(PLAN.grind[0] + PLAN.grind[1]) / 2, PLAN.y0 + 16], label: $t('UT GENOM GRINDEN'), act: avPlanen },
    { id: 'straff', r: [STRAFF.x - 16, STRAFF.y - 30, STRAFF.x + 16, STRAFF.y + 10], go: [STRAFF.x, STRAFF.y], label: $t('STRAFFPUNKTEN – SKJUT FEM STRAFFAR'), act: startStraff },
  ] : [
    { id: 'buss', r: [HALLPLATS.x - 12, HALLPLATS.y - 36, HALLPLATS.x + 14, HALLPLATS.y + 2], go: [HALLPLATS.x + 10, HALLPLATS.y - 8], label: $t('ARENABUSSEN TILL STAN'), act: bussen },
    { id: 'sport', ...dorr('sport'), label: $t('SPORTAFFÄREN – SKRIDSKOR OCH HALSDUKAR'), act: sportaffaren },
    { id: 'arena', ...dorr('arena'), label: $t('PIXEL ARENA – MATCHDAG'), act: matchBiljett },
    { id: 'biljett', r: [BILJETT.x - 18, BILJETT.y - 52, BILJETT.x + 18, BILJETT.y + 2], go: [BILJETT.x, BILJETT.y + 10], label: $t`BILJETTLUCKAN · MATCH ${fmt(BILJETT_PRIS)}`, act: matchBiljett },
    { id: 'simhall', ...dorr('simhall'), label: HUS.simhall.namn, act: () => { play('knock'); toast($t('🏊 Simhallen öppnar snart – bassäng, rutschkana och bubbelpool.')); } },
    { id: 'staty', r: [STATY.x - 16, STATY.y - 68, STATY.x + 16, STATY.y + 2], go: [STATY.x + 22, STATY.y + 6], label: $t('STATYN'), act: () => toast($t('🏆 Gunvor Pixelsson – 200 mål för KBK och ett bicycletamål i finalen 1987. Barnen gnuggar bollen för tur.')) },
    { id: 'fikat', r: [FIKAT.x - 24, FIKAT.y - 54, FIKAT.x + 24, FIKAT.y + 2], go: [FIKAT.x, FIKAT.y + 10], label: $t('FIKAT'), act: fikat },
    { id: 'korv', r: [KORV.x - 16, KORV.y - 40, KORV.x + 16, KORV.y + 2], go: [KORV.x + 20, KORV.y + 4], label: $t`VARMKORV · ${fmt(25)}`, act: korven },
    { id: 'choklad', r: [CHOKLAD.x - 24, CHOKLAD.y - 54, CHOKLAD.x + 24, CHOKLAD.y + 2], go: [CHOKLAD.x, CHOKLAD.y + 10], label: $t`VARM CHOKLAD · ${fmt(20)}`, act: chokladen },
    { id: 'bana', r: [RINK.grind[0] - 10, RINK.y0 - 30, RINK.grind[1] + 10, RINK.y0 + 4], go: [(RINK.grind[0] + RINK.grind[1]) / 2, RINK.y0 - 12], label: g.skridskor ? $t('SKRIDSKOBANAN – ÅK PÅ ISEN') : $t`SKRIDSKOBANAN – HYR SKRIDSKOR · ${fmt(HYRA_PRIS)}`, act: banan },
    { id: 'plan', r: [PLAN.grind[0] - 10, PLAN.y0 - 30, PLAN.grind[1] + 10, PLAN.y0 + 4], go: [(PLAN.grind[0] + PLAN.grind[1]) / 2, PLAN.y0 - 12], label: $t('KBK-PLANEN – SKJUT STRAFFAR'), act: paPlanen },
    ...FLAGGOR.map(([fx, fy], i) => ({ id: 'flagga' + i, r: [fx - 6, fy - 74, fx + 20, fy + 2], go: [fx + 12, fy + 4], label: $t('KBK-FLAGGAN'), act: () => toast($t('🚩 Vinrött och svart – KBK:s färger sedan 1921.')) })),
    { id: 'skylt', r: [SKYLT.x - 24, SKYLT.y - 40, SKYLT.x + 24, SKYLT.y], go: [SKYLT.x + 12, SKYLT.y + 6], label: $t('ARENATORGET'), act: () => toast($t('🏟️ ARENATORGET – Pixel Arena, sportaffären, simhallen, skridskobanan och KBK-planen. Bussen hem står här.')) },
  ];
  const spotAt = (x, y) => spots().find((s) => x >= s.r[0] && x <= s.r[2] && y >= s.r[1] && y <= s.r[3]);
  const folkAt = (x, y) => (lage === 'torg' ? folk.find((o) => Math.abs(o.x - x) < 7 && y < o.y + 2 && y > o.y - 30) : null);

  // ---------- ritning ----------
  const KIT = propKit();
  const sken = (ctx, x, y, r, col) => { const gr = ctx.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, col); gr.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = gr; ctx.fillRect(x - r, y - r, r * 2, r * 2); };
  const halsduk = (ctx, x, y) => { ctx.fillStyle = '#7a1a2a'; ctx.fillRect(x - 4, y - 24, 8, 2); ctx.fillStyle = '#1a1414'; ctx.fillRect(x - 4, y - 23, 8, 1); ctx.fillStyle = '#7a1a2a'; ctx.fillRect(x + 2, y - 22, 2, 5); ctx.fillStyle = '#1a1414'; ctx.fillRect(x + 2, y - 19, 2, 1); };
  function ritaStraff(ctx) {
    const S = straff; if (!S) return;
    const { x, y } = PLAN.mal, zh = 48 / ZONER;
    for (let z = 0; z < ZONER; z++) { ctx.fillStyle = z === S.mv ? 'rgba(220,60,60,.55)' : 'rgba(80,220,120,.5)'; ctx.fillRect(x + 2, y - 23 + z * zh, 8, zh - 1); }
    // målvakten står i sin del, markören sveper
    const mvy = y - 24 + S.mv * zh + zh / 2;
    drawPerson(ctx, x - 8, mvy + 14, { skin: '#f0cfae', hair: '#2a1a14', style: 'short', top: 'tee', shirt: '#f0c030', accent: '#1a1414', bottom: 'pants', pants: '#1a1414', shoes: '#f4f1ea', glasses: null, beard: false, phones: false, bag: null, hat: null, apron: false, build: 3, blush: false, kid: false }, 'left', Math.floor(t * 4) % 2 ? 10 : 0);
    if (S.fas === 'sikta') { const u = (Math.sin(t * 2.6) + 1) / 2, my = y - 24 + u * 47; ctx.fillStyle = '#ffd23f'; ctx.fillRect(x - 14, Math.round(my) - 1, 18, 3); ctx.fillStyle = '#1a1414'; ctx.fillRect(x - 14, Math.round(my), 18, 1); }
    if (S.boll) { const b = S.boll, u = Math.min(1, b.t), bx = STRAFF.x + (x - 4 - STRAFF.x) * u, by = STRAFF.y + ((y - 24 + b.zon * zh + zh / 2) - STRAFF.y) * u; ritaBoll(ctx, bx, by, Math.sin(u * Math.PI) * 14, b.t * 10); if (!b.mal && u > 0.9) { ctx.fillStyle = '#ffffff'; ctx.fillRect(bx - 2, by - 8, 5, 1); } }
    else ritaBoll(ctx, STRAFF.x + 6, STRAFF.y + 2, 0, 0);
    if (S.textT > 0) { ctx.globalAlpha = Math.min(1, S.textT); ctxText(ctx, BIG, S.text, x - 40 - (textW(BIG, S.text) >> 1), y - 50, S.text === $t('MÅL!') ? '#8ae08a' : '#ff8a8a'); ctx.globalAlpha = 1; }
    const hx = Math.round(cam.x) + 8, hy = Math.round(cam.y) + 20;   // (rutan sitter fast i bilden, inte på planen)
    const s = $t`SKOTT ${S.skott} AV 5 · MÅL ${S.mal}`; ctx.fillStyle = 'rgba(20,18,26,.85)'; ctx.fillRect(hx, hy, textW(SMALL, s) + 10, 11); ctxText(ctx, SMALL, s, hx + 5, hy + 3, '#f4f1ea');
    if (S.fas === 'sikta') { const s2 = $t('KLICKA NÄR MARKÖREN ÄR I EN GRÖN DEL'); ctx.fillStyle = 'rgba(20,18,26,.85)'; ctx.fillRect(hx, hy + 14, textW(SMALL, s2) + 10, 11); ctxText(ctx, SMALL, s2, hx + 5, hy + 17, '#ffd23f'); }
  }

  return {
    viewMax: { w: TW, h: TH },
    get worldX() { return walker.px; }, get worldY() { return walker.py; },
    get worldRide() { const F = fordon(); return F && lage === 'torg' ? { id: F.id, c: F.c } : null; },
    rideChanged: applyRide,
    update(dt) {
      t += dt; banner += dt;
      VW = Math.max(384, Math.min(A.W || 384, TW)); VH = Math.max(160, Math.min(A.H || 216, TH));
      if (fade.phase === 1) { fade.a = Math.min(1, fade.a + dt * 2.6); if (fade.a >= 1) { fade.phase = 0; const cb = fade.cb; fade.cb = null; cb?.(); return; } }
      else if (fade.phase === 2) { fade.a = Math.max(0, fade.a - dt * 1.8); if (fade.a <= 0) fade.phase = 0; if (!straff) walker.update(dt); }
      else if (!straff) walker.update(dt);
      updLiv(dt); updStraff(dt);
      if (pets && lage === 'torg') try { pets.update(dt, walker.px, walker.py, (x, y) => walker.walkable(x, y)); } catch (e) { console.error('husdjuren på Arenan:', e); pets = null; }
      const c = camTarget(); cam.x += (c.x - cam.x) * Math.min(1, dt * 8); cam.y += (c.y - cam.y) * Math.min(1, dt * 8);
    },
    draw(ctx) {
      ctx.setTransform(A.pxs, 0, 0, A.pxs, 0, 0);
      ctx.imageSmoothingEnabled = false;
      const N = night(), D = dusk();
      const cx = Math.round(cam.x), cy = Math.round(cam.y);
      ctx.drawImage(skyCanvas(VW, N, D), 0, Math.min(0, -cy * 0.3));
      const bk = takCanvas(N), off = -Math.round(cx * 0.6) % bk.width, by = Math.round(G.BASE - 50 - bk.height + 10 - cy * 0.92);
      for (let x = off; x < VW; x += bk.width) ctx.drawImage(bk, x, by);
      ctx.drawImage(ground(), -cx, -cy);
      ctx.save(); ctx.translate(-cx, -cy);
      ritaIsspar(ctx, isspar);
      const items = [];
      const syns = (x, m = 80) => x > cx - m && x < cx + VW + m;
      for (const id of HUSLISTA) { const Hs = HUS[id]; if (Hs.x > cx + VW + 20 || Hs.x + Hs.w + 20 < cx) continue; items.push({ fy: G.BASE - 1, draw: () => ritaHus(ctx, id, N, G.BASE) }); }
      items.push({ fy: BILJETT.y, draw: () => ritaBiljett(ctx, N) }, { fy: STATY.y, draw: () => ritaStaty(ctx) }, { fy: FIKAT.y, draw: () => ritaFikat(ctx, N) }, { fy: CHOKLAD.y, draw: () => ritaChoklad(ctx, N) }, { fy: KORV.y, draw: () => ritaKorvgubbe(ctx, t) });
      items.push({ fy: KORV.y + 0.5, draw: () => drawPerson(ctx, KORV.x - 16, KORV.y + 2, { ...folk[0].look, hat: 'cap', apron: true }, 'down', 0) });
      for (const [fx, fy] of FLAGGOR) items.push({ fy, draw: () => ritaFlagga(ctx, fx, fy, t) });
      items.push({ fy: RINK.y0 + 2, draw: () => ritaSarg(ctx, 'norr') }, { fy: RINK.y0 + 3, draw: () => ritaSarg(ctx, 'sidor') }, { fy: RINK.y1 + 2, draw: () => ritaSarg(ctx, 'soder') });
      for (const [lx, ly] of RINK_LJUS) items.push({ fy: ly, draw: () => ritaStralkastare(ctx, lx, ly, N) });
      items.push({ fy: PLAN.y0 + 2, draw: () => ritaBur(ctx, 'norr') }, { fy: PLAN.y0 + 3, draw: () => ritaBur(ctx, 'sidor') }, { fy: PLAN.y1 + 2, draw: () => ritaBur(ctx, 'soder') }, { fy: PLAN.mal.y + 22, draw: () => ritaMal(ctx) });
      for (const [bx, byy] of BANKAR) if (syns(bx)) items.push({ fy: byy, draw: () => KIT.bench(ctx, bx, byy) });
      for (const [bx, byy] of PAPPERSKORGAR) if (syns(bx)) items.push({ fy: byy, draw: () => KIT.bin(ctx, bx, byy) });
      for (const l of LYKTOR) if (syns(l.x)) items.push({ fy: l.y, draw: () => KIT.lamp(ctx, l.x, l.y) });
      for (const tr of TRAD) if (syns(tr.x)) items.push({ fy: tr.y, draw: () => KIT.tree(ctx, tr.kind, tr.x, tr.y, { vind: Math.round(Math.sin(t + tr.x) * 0.6) }) });
      items.push({ fy: SKYLT.y, draw: () => ritaSkylt(ctx) }, { fy: HALLPLATS.y, draw: () => ritaHallplats(ctx) });
      for (const a of akare) items.push({ fy: a.y, draw: () => { ritaSkridskor(ctx, a.x, a.y, a.dir); drawPerson(ctx, a.x, a.y, a.look, a.dir, WALK_SEQ[Math.floor(t * 5 + a.ang) % 4]); } });
      for (const b of barn) items.push({ fy: b.y, draw: () => drawPerson(ctx, b.x, b.y, b.look, boll.x < b.x ? 'left' : 'right', straff ? 0 : (Math.sin(t * 3 + b.x) > 0.6 ? 4 : 0)) });
      if (!straff) items.push({ fy: boll.y, draw: () => ritaBoll(ctx, boll.x, boll.y, boll.h, boll.r) });
      else items.push({ fy: PLAN.mal.y + 30, draw: () => ritaStraff(ctx) });
      for (const o of folk) if (syns(o.x)) items.push({ fy: o.y, draw: () => { drawPerson(ctx, o.x, o.y, o.look, o.dir, o.vila <= 0 ? WALK_SEQ[Math.floor(t * 8.5 + o.x) % 4] : 0); if (o.halsduk) halsduk(ctx, o.x, o.y); } });
      items.push(...folkDrawables(A, t));
      if (pets && lage === 'torg') for (const d of pets.drawables()) items.push({ fy: d.fy ?? d.y, draw: () => d.draw(ctx) });
      if (straff) items.push({ fy: walker.py + 0.1, draw: () => drawPerson(ctx, walker.px, walker.py, A.avatar.look, 'right', straff.boll && straff.boll.t < 0.5 ? 3 : 0) });
      else { const F = fordon(); const me = selfDrawable(A, walker, t, { folksHere: worldFolksHere(A).length, ride: F && lage === 'torg' ? { id: F.id, c: F.c } : null }); items.push({ fy: me.fy, draw: () => { if (lage === 'is') ritaSkridskor(ctx, walker.px, walker.py, walker.dir); me.draw(ctx); } }); }
      items.sort((a, b) => a.fy - b.fy).forEach((d) => d.draw(ctx));
      ctx.restore();
      if (N || D) {
        ctx.fillStyle = N ? 'rgba(12,16,48,0.5)' : 'rgba(60,40,90,0.2)'; ctx.fillRect(0, 0, VW, VH);
        if (D) { ctx.fillStyle = 'rgba(255,140,80,0.10)'; ctx.fillRect(0, 0, VW, VH); }
        ctx.save(); ctx.translate(-cx, -cy);
        for (const l of LYKTOR) if (syns(l.x)) KIT.lampGlow(ctx, l.x, l.y, N ? 1 : 0.5);
        ctx.globalCompositeOperation = 'lighter';
        if (N) { for (const [lx, ly] of RINK_LJUS) sken(ctx, lx, ly - 64, 90, 'rgba(255,240,200,.28)'); sken(ctx, HUS.arena.x + 380, G.BASE - 120, 120, 'rgba(120,180,255,.22)'); }
        for (const k of [FIKAT, CHOKLAD, BILJETT]) if (syns(k.x)) sken(ctx, k.x, k.y - 22, 30, `rgba(255,200,120,${N ? 0.3 : 0.15})`);
        ctx.globalCompositeOperation = 'source-over'; ctx.restore();
      }
      ctx.save(); ctx.translate(-cx, -cy); talk.draw(ctx, { x0: cx, x1: cx + VW }); ctx.restore();
      if (banner < 4) { const a = banner < 0.4 ? banner / 0.4 : banner > 3.4 ? (4 - banner) / 0.6 : 1; ctx.globalAlpha = Math.max(0, a); const s = $t('ARENAN'), s2 = $t('KBK, SKRIDSKOR OCH STRAFFAR PÅ KBK-PLANEN'), w = Math.max(textW(BIG, s, 2), textW(SMALL, s2)) + 20; ctx.fillStyle = 'rgba(20,18,26,.85)'; ctx.fillRect((VW - w) >> 1, 26, w, 30); ctxText(ctx, BIG, s, (VW - textW(BIG, s, 2)) >> 1, 30, '#e8a0b0', 2); ctxText(ctx, SMALL, s2, (VW - textW(SMALL, s2)) >> 1, 48, '#f4f1ea'); ctx.globalAlpha = 1; }
      const s = hover && spotAt(hover.x + cx, hover.y + cy);
      if (s && !straff) { const w = textW(SMALL, s.label) + 10, x = Math.round(Math.max(2, Math.min(VW - w - 2, hover.x - w / 2))), y = Math.max(2, hover.y - 22); ctx.fillStyle = 'rgba(20,18,26,.9)'; ctx.fillRect(x, y, w, 11); ctxText(ctx, SMALL, s.label, x + 5, y + 3, '#ffd23f'); }
      if (fade.a > 0) { ctx.fillStyle = `rgba(10,10,16,${fade.a.toFixed(2)})`; ctx.fillRect(0, 0, VW, VH); }
    },
    down(sx, sy) {
      if (fade.phase === 1) return;
      if (straff) { skjut(); return; }
      hover = { x: sx, y: sy };
      const x = sx + cam.x, y = sy + cam.y;
      if (lage === 'torg') { const fk = folkTapAt(A, x, y); if (fk) { openSpelarkort(A, fk); return; } const o = folkAt(x, y); if (o) { walker.walkTo(o.x + (walker.px < o.x ? -14 : 14), o.y + 2, () => { o.vila = Math.max(o.vila, 4); talk.say(o.rad, () => ({ x: o.x, y: o.y - 34 }), 3.5, { voice: o.look }); }); return; } }
      const s = spotAt(x, y);
      if (s) { walker.walkTo(s.go[0], s.go[1], s.act); return; }
      walker.walkTo(x, y);
    },
    key(k) { if (straff && (k === ' ' || k === 'Enter')) skjut(); },
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
      lage: () => lage,
      spar: () => isspar.length,
      straff: () => (straff ? { skott: straff.skott, mal: straff.mal, fas: straff.fas, mv: straff.mv } : null),
      skjut: (zon) => skjut(zon),
      tick: (sec) => { for (let k = 0; k < sec * 30; k++) { updStraff(1 / 30); t += 1 / 30; } },
      akare: () => akare.map((a) => ({ x: Math.round(a.x), y: Math.round(a.y) })),
    },
  };
}
// marken målas en gång
let GROUND = null;
const ground = () => (GROUND ||= paintGround());
