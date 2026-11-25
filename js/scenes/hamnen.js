// ⚓ FISKEHAMNEN – stadsdel 4 i stadsdelsplanen (Carl 2026-11-18: "Hamnen + skärgården: pir, fiskmarknad, färja, båt
// att köpa, sommarstuga på ön"). En egen plats som Djurparken: hamnbussen går hit från stadens hållplatser (city.js,
// raden HAMNEN). Längs kajen: HAMNKONTORET, MAGASINET med kranen, FISKMARKNADEN (färsk fisk till skafferiet, rökt
// fisk och räkor), FISK & CHIPS-vagnen, BÅTAFFÄREN (köp en roddbåt eller motorbåt – eller hyr en tur vid båtrampen),
// SKEPPSHANDELN (metspö), RÖKERIET och FÄRJETERMINALEN där SOLÖ-FÄRJAN går ut till Solön. Piren går ut till fyren –
// där kan man fiska. Fiskebåtarna guppar vid kajen, måsarna sitter på pollarna, sälen tittar upp vid piren.
// BÅTTUREN: vid rampen lägger man ut med sin båt (eller hyr en för HYRA_PRIS) och styr runt i hamnbassängen bland
// bojarna – klicka i vattnet så åker båten dit; lägg till vid rampen igen. Första turen om dagen ger lycka.
//
// _debug-API för tools/hamnen-test.mjs.
import { createCityWalker } from '../city/walk.js';
import { selfDrawable, folkDrawables, folkTapAt, createSpeech, WALK_SEQ, synligRuta } from './walkable.js';
import { openSpelarkort } from '../core/vannerapp.js';
import { worldFolksHere } from '../net/world.js';
import { openModal, closeModal, toast, esc } from '../core/ui.js';
import { play } from '../core/sound.js';
import { SMALL, BIG, ctxText, textW, hash } from '../core/floor-pix.js';
import { busStopById, BUS_STOPS } from '../city/map.js';
import { fmt, ravaraOf, MAX_RAVA } from '../game.js';
import { drawPerson, makeLook } from '../core/people.js';
import { createPetWalk } from '../pets/outdoors.js';
import { skyCanvas } from '../landet/karta.js';
import { propKit } from '../city/props.js';
import { fyrBild, farjaBild } from '../solon/karta.js';
import { openFiske, kopSpo, fiskeOf, SPO_PRIS } from '../solon/fiske.js';
import { TW, TH, H, HALLPLATS, ANKARE, HUS, HUSLISTA, STAND, FISKBIL, TRAILERS, KRAN, PIR, PIRHUVUD, FYR, FARJA, RAMP, BATAR, POLLARE, LYKTOR, LADOR, TINOR, NATSTALL, TUNNOR, BANKAR, REP, SKYLT, MAS, SAL, FARJA_PRIS, HYRA_PRIS, BATTYPER, hinder, vattenHinder, takCanvas, paintGround } from '../hamnen/karta.js';
import { ritaHus, ritaStand, ritaFiskbil, ritaTrailer, ritaKran, ritaAnkare, ritaPollare, ritaHamnlykta, ritaLada, ritaTina, ritaNatstall, ritaTunna, ritaRep, ritaPirstolpe, ritaKatting, ritaBoj, ritaSkylt, ritaHallplats, ritaBat, ritaMas, ritaSal, ritaRok } from '../hamnen/deko.js';
import { $t } from '../core/i18n.js';
import { agerEvig } from '../core/kop.js';

const BUSS = 10, GANG = 62, FISKPRIS = 30;
const HAMNPRAT = [
  $t('ELSA kom in med full last i morse – torsk och sill.'), $t('Färjan går var tjugonde minut. Nästan.'), $t('Sälen heter Sigge. Han tigger fisk vid piren.'),
  $t('Fisk & chips-vagnen har stans bästa pommes.'), $t('Jag har sparat till en motorbåt i tre år.'), $t('Måsarna snor allt. Håll i smörgåsen!'),
  $t('Fyren har lyst varje natt sedan 1890.'), $t('Rökeriet röker makrill på fredagar – det doftar över hela hamnen.'),
];
const FISKBIL_MENY = [
  { id: 'fc', icon: '🍟', namn: $t('Fisk & chips'), pris: 40, hunger: 30, glad: 2 },
  { id: 'skagen', icon: '🥪', namn: $t('Skagenröra på bröd'), pris: 45, hunger: 24, glad: 2 },
  { id: 'saft', icon: '🥤', namn: $t('Fläderblomssaft'), pris: 10, hunger: 4, energi: 6, glad: 0 },
];
const MARKNAD = {
  rokt: { icon: '🐟', namn: $t('Rökt makrill'), pris: 25, hunger: 20, glad: 1, rad: $t('Varm ur rökeriet. Händerna doftar hela dagen.') },
  rakor: { icon: '🦐', namn: $t('Räkmacka'), pris: 35, hunger: 22, glad: 2, rad: $t('Ett berg av räkor på en skiva bröd. Måsarna tittar avundsjukt.') },
};

export function makeHamnen(A) {
  const g = A.game;
  if (agerEvig('motorbat') && g.bat !== 'motor') { g.bat = 'motor'; g.save(); }   // 🔑 köpt motorbåt (js/core/kop.js): ligger vid rampen i varje spel
  let VW = Math.max(384, Math.min(A.W || 384, TW)), VH = Math.max(160, Math.min(A.H || 216, TH));
  const from = A.hamnFran || null; A.hamnFran = null;
  const walker = createCityWalker({ W: TW, H: TH, left: 2, right: TW - 2, top: H.TOP, bottom: H.BOTTOM, spawn: from?.marknad ? [(HUS.marknad.door.x0 + HUS.marknad.door.x1) / 2, H.BASE + 30] : [HALLPLATS.x + 16, HALLPLATS.y - 8] });
  let tur = null;   // båtturen: { typ, hyrd, t } när man är ute på vattnet
  const fordon = () => g.aker;
  const applyRide = () => { if (tur) return; const F = fordon(); walker.speed = GANG * (F ? F.fart : 1); };
  applyRide();
  walker.setObstacles(hinder());
  walker.snapFree();
  const talk = createSpeech();
  let t = 0, hover = null, banner = 0, salK = 0, salT = 6, rok = true;
  const fade = { a: 1, phase: 2, cb: null };
  const cam = { x: 0, y: 0 };
  // kameran: vid husen står figuren nära nederkanten (husen syns), vid kajkanten och på piren ligger vattnet i bild
  const camTarget = () => { const S = synligRuta(VH), py = walker.py, u = Math.max(0, Math.min(1, (py - 244) / 44)), k = 0.94 - u * 0.44; return { x: Math.max(0, Math.min(TW - VW, walker.px - VW / 2)), y: Math.max(0, Math.min(Math.max(0, TH - S.y1), py - S.y0 - S.h * k)) }; };
  Object.assign(cam, camTarget());
  let pets = null;
  try { pets = createPetWalk(A); } catch (e) { console.error('husdjuren i Fiskehamnen startade inte:', e); }
  const hour = () => g.min / 60;
  const night = () => hour() >= 20 || hour() < 5.5;
  const dusk = () => (hour() >= 18 && hour() < 20) || (hour() >= 5.5 && hour() < 7);
  const rnd = (a, b) => a + Math.random() * (b - a);
  if (!A.attract) { const h = g.glad?.(2, '', 'hamnen', 2); if (h) setTimeout(() => toast($t`⚓ Fiskehamnen – salt, måsar och tjära! +${h} 😊`, 'good'), 900); }

  // ---------- folket och djuren ----------
  const folk = [0, 1, 2, 3, 4, 5].map((i) => ({ look: { ...makeLook(), kid: i === 4 }, x: 200 + i * 260, y: i % 2 ? 300 : 236 + (i % 3) * 8, dir: i % 2 ? 'left' : 'right', fart: rnd(16, 26), vila: 0, rad: HAMNPRAT[i % HAMNPRAT.length] }));
  const fiskare = [{ look: { ...makeLook(), hat: 'cap', shirt: '#f0c030', apron: false }, x: BATAR[1].x + 50, y: H.KANT - 6, dir: 'left' }, { look: { ...makeLook(), hat: 'cap', shirt: '#2a5aa8' }, x: BATAR[1].x + 70, y: H.KANT - 10, dir: 'left' }];
  const masar = MAS.map(([x, y], i) => ({ x, y, hx: x, hy: y, flyg: 0, borta: 0, dir: i % 2 ? 'left' : 'right' }));
  const vagor = Array.from({ length: 60 }, (_, k) => ({ x: hash(k, 1, 44) * TW, y: H.KANT + 8 + hash(k, 2, 44) * (TH - H.KANT - 16), f: hash(k, 3, 44) * 6.28, v: 6 + hash(k, 4, 44) * 10 }));
  function updLiv(dt) {
    for (const o of folk) {
      if (o.vila > 0) { o.vila -= dt; continue; }
      o.x += (o.dir === 'right' ? 1 : -1) * o.fart * dt;
      if (o.x > TW - 60) { o.dir = 'left'; o.vila = rnd(1, 3); }
      if (o.x < 60) { o.dir = 'right'; o.vila = rnd(1, 3); }
      if (Math.random() < dt * 0.04) o.vila = rnd(2, 6);
    }
    for (const m of masar) {
      if (m.borta > 0) { m.borta -= dt; if (m.borta <= 0) { m.x = m.hx; m.y = m.hy; m.flyg = 0; } continue; }
      if (m.flyg > 0) { m.flyg += dt; m.x += (m.dir === 'left' ? -1 : 1) * 50 * dt; m.y -= 30 * dt; if (m.flyg > 2) m.borta = rnd(5, 12); continue; }
      const px = tur ? walker.px : walker.px, py = walker.py;
      if (Math.hypot(px - m.x, py - m.y) < 24) { m.flyg = 0.01; play('chirp'); }
    }
    salT -= dt;
    if (salT <= 0) { salK = Math.min(1, salK + dt * 2); if (salT < -5) { salT = rnd(8, 18); } } else salK = Math.max(0, salK - dt * 2);
    for (const v of vagor) { v.x += v.v * dt; if (v.x > TW) v.x -= TW; }
  }

  // ---------- marknaden, vagnen, affärerna ----------
  // 🐟 marknadshallens dörr: bakom disken jobbar man som fiskhandlare (js/jobs/jobb-fisk.js, JOBS.fiskhandel)
  function marknadshallen() {
    play('knock');
    openModal($t('🐟 Marknadshallen'), `<p style="font-size:var(--f2);margin-top:0">${$t('Stånden utanför säljer dagens fångst. Bakom disken står Britta med islådorna och vågen – hon behöver någon som väger upp åt kunderna.')}</p>`, [
      { label: $t('💼 Jobba ett pass'), cls: 'btn-go', onClick: () => { closeModal(); if (!A.jobReady?.('fiskhandel')) { toast($t('🐟 Fiskmarknaden anställer snart!')); return; } A.hamnFran = { marknad: true, buss: from?.buss || '' }; play('door'); A.startJob('fiskhandel'); } },
      { label: $t('Bara titta'), onClick: closeModal },
    ]);
  }
  function marknad(id) {
    play('click');
    if (id === 'fisk') {
      const r = ravaraOf('fisk'), har = g.skafferi?.fisk | 0, full = har >= MAX_RAVA;
      openModal($t('🐟 Färsk fisk'), `<p style="font-size:var(--f2);margin-top:0">${$t`Dagens fångst, rensad och klar: <b>${r.name}</b> för ${fmt(FISKPRIS)} styck – till skafferiet hemma (laga fisksoppa eller fish and chips i köket).`}</p><p style="font-size:var(--f2)">${$t`I skafferiet: ${har} av ${MAX_RAVA}`} · 💰 <b>${fmt(g.money)}</b></p>`, [
        { label: $t`Köp en · ${fmt(FISKPRIS)}`, cls: g.money >= FISKPRIS && !full ? 'btn-go' : '', disabled: g.money < FISKPRIS || full, onClick: () => { if (g.money < FISKPRIS || full) return; g.money -= FISKPRIS; g.skafferi.fisk = (g.skafferi.fisk | 0) + 1; g.save(); play('coin'); closeModal(); toast($t`🐟 ${r.name} i väskan – ${(g.skafferi.fisk | 0)} i skafferiet.`, 'good'); } },
        { label: $t('Nej tack'), onClick: closeModal },
      ]);
      return;
    }
    const v = MARKNAD[id];
    openModal(`${v.icon} ${esc(v.namn)}`, `<p style="font-size:var(--f2);margin-top:0">${v.rad}</p><p style="font-size:var(--f2)">💰 <b>${fmt(g.money)}</b></p>`, [
      { label: $t`Köp · ${fmt(v.pris)}`, cls: g.money >= v.pris ? 'btn-go' : '', disabled: g.money < v.pris, onClick: () => { closeModal(); if (g.money < v.pris) return; g.money -= v.pris; g.hunger = Math.min(100, (g.hunger || 0) + v.hunger); const h = g.glad?.(v.glad, $t('Fika i hamnen'), 'hamnmat', 3) || 0; g.save(); play('coin'); toast(`${v.icon} ${v.namn}! ` + (h ? `+${h} 😊` : ''), 'good'); } },
      { label: $t('Nej tack'), onClick: closeModal },
    ]);
  }
  function fiskbilen() {
    play('click');
    const rader = FISKBIL_MENY.map((v) => `<div class="prow" style="grid-template-columns:auto 1fr auto"><span style="font-size:22px">${v.icon}</span><span class="nm">${esc(v.namn)}<br><small class="sp">${fmt(v.pris)}</small></span><button class="btn btn-small btn-go" data-vara="${v.id}" ${g.money < v.pris ? 'disabled' : ''}>${$t('Köp')}</button></div>`).join('');
    const dlg = openModal($t('🍟 Fisk & chips'), `<p style="font-size:var(--f2);margin-top:0">${$t('Nyfriterad torsk, pommes och remoulad. Ät på kajkanten – men akta måsarna.')}</p><div class="plist">${rader}</div>`, [{ label: $t('Stäng'), onClick: closeModal }]);
    dlg.querySelectorAll('[data-vara]').forEach((b) => (b.onclick = () => { const v = FISKBIL_MENY.find((q) => q.id === b.dataset.vara); if (!v || g.money < v.pris) return; g.money -= v.pris; g.hunger = Math.min(100, (g.hunger || 0) + v.hunger); if (v.energi) g.energy = Math.min(100, (g.energy || 0) + v.energi); const h = v.glad ? g.glad?.(v.glad, $t('Fisk & chips i hamnen'), 'hamnmat', 3) || 0 : 0; g.save(); closeModal(); play('coin'); toast($t`${v.icon} ${v.namn}! Mums.` + (h ? ` +${h} 😊` : ''), 'good'); }));
  }
  function bataffaren() {
    play('click');
    const rader = Object.entries(BATTYPER).map(([id, b]) => `<div class="prow" style="grid-template-columns:auto 1fr auto"><span style="font-size:22px">${id === 'motor' ? '🚤' : '🚣'}</span><span class="nm">${esc(b.namn)}<br><small class="sp">${g.bat === id ? $t('Din båt – ligger vid rampen') : fmt(b.pris)}</small></span><button class="btn btn-small ${g.bat === id ? '' : 'btn-go'}" data-bat="${id}" ${g.bat === id || g.money < b.pris ? 'disabled' : ''}>${g.bat === id ? $t('Har') : $t('Köp')}</button></div>`).join('');
    const dlg = openModal($t('⛵ Båtaffären'), `<p style="font-size:var(--f2);margin-top:0">${$t('En egen båt! Den ligger vid båtrampen – lägg ut och styr runt i hamnen när du vill, utan att hyra. Motorbåten är dubbelt så snabb.')}</p><div class="plist">${rader}</div><p style="font-size:var(--f2)">💰 <b>${fmt(g.money)}</b></p>`, [{ label: $t('Stäng'), onClick: closeModal }]);
    dlg.querySelectorAll('[data-bat]').forEach((b) => (b.onclick = () => { const id = b.dataset.bat, B = BATTYPER[id]; if (!B || g.money < B.pris || g.bat === id) return; g.money -= B.pris; g.bat = id; g.save(); closeModal(); play('fanfare'); toast($t`⛵ Grattis – ${B.namn.toLowerCase()}en är din! Den ligger vid båtrampen.`, 'good'); const h = g.glad?.(3, $t('En egen båt'), 'egenbat', 3); if (h) setTimeout(() => toast(`😊 +${h}`), 800); }));
  }
  function skeppshandeln() {
    play('click');
    const F = fiskeOf(g);
    openModal($t('⚓ Skeppshandeln'), `<p style="font-size:var(--f2);margin-top:0">${$t('Rep, lyktor, sjökort och metspön. Det doftar tjära och kaffe.')}</p><p style="font-size:var(--f2)">${F.spo ? $t('🎣 Du har redan ett metspö – fiska längst ut på piren!') : $t`🎣 Ett metspö kostar ${fmt(SPO_PRIS)} – sedan kan du fiska från piren här och på Solön.`}</p>`, [
      ...(F.spo ? [] : [{ label: $t`🎣 Köp metspö · ${fmt(SPO_PRIS)}`, cls: 'btn-go', disabled: g.money < SPO_PRIS, onClick: () => { closeModal(); kopSpo(A); } }]),
      { label: $t('Stäng'), onClick: closeModal },
    ]);
  }
  function farjan() {
    play('click');
    openModal($t('⛴️ Solö-färjan'), `<p style="font-size:var(--f2);margin-top:0">${$t('Färjan går härifrån ut till <b>Solön</b>: sandstrand, bad, glass och fyren. Tillbaka går den till Sjöboden i stan.')}</p><p style="font-size:var(--f2)">💰 <b>${fmt(g.money)}</b></p>`, [
      { label: $t`⛴️ Åk till Solön · ${fmt(FARJA_PRIS)}`, cls: g.money >= FARJA_PRIS ? 'btn-go' : '', disabled: g.money < FARJA_PRIS, onClick: () => { closeModal(); if (g.money < FARJA_PRIS) { toast($t('Du har inte råd med färjan.'), 'bad'); return; } g.money -= FARJA_PRIS; g.passTime(20); g.save(); play('honk'); go(() => { A.solonFran = { farja: true }; A.go('solon'); }); } },
      { label: $t('Inte nu'), onClick: closeModal },
    ]);
  }
  // ---------- båtturen ----------
  function laggUt() {
    if (tur) { landa(); return; }
    const egen = g.bat;
    const start = (typ, hyrd) => { tur = { typ, hyrd, t: 0 }; walker.stop(); walker.setObstacles(vattenHinder()); walker.px = RAMP.x; walker.py = RAMP.y + 26; walker.snapFree(); walker.speed = BATTYPER[typ].fart; play('slide'); toast(hyrd ? $t('🚣 Du lägger ut med hyrbåten. Klicka i vattnet – lägg till vid rampen när du är klar.') : $t`${typ === 'motor' ? '🚤' : '🚣'} Du lägger ut med din ${BATTYPER[typ].namn.toLowerCase()}. Klicka i vattnet – lägg till vid rampen när du är klar.`, 'good'); };
    if (egen) { start(egen, false); return; }
    openModal($t('🚣 Båtrampen'), `<p style="font-size:var(--f2);margin-top:0">${$t`Ingen egen båt än? Hyr en roddbåt för <b>${fmt(HYRA_PRIS)}</b> och ro en tur i hamnen. (Båtaffären säljer egna båtar – då är turerna gratis.)`}</p><p style="font-size:var(--f2)">💰 <b>${fmt(g.money)}</b></p>`, [
      { label: $t`🚣 Hyr roddbåt · ${fmt(HYRA_PRIS)}`, cls: g.money >= HYRA_PRIS ? 'btn-go' : '', disabled: g.money < HYRA_PRIS, onClick: () => { closeModal(); if (g.money < HYRA_PRIS) { toast($t('Du har inte råd att hyra båten.'), 'bad'); return; } g.money -= HYRA_PRIS; g.save(); play('coin'); start('rodd', true); } },
      { label: $t('Inte nu'), onClick: closeModal },
    ]);
  }
  function landa() {
    if (!tur) return;
    const T = tur; tur = null;
    walker.stop(); walker.setObstacles(hinder()); walker.px = RAMP.x; walker.py = RAMP.y - 10; walker.snapFree(); applyRide();
    const h = g.glad?.(2, $t('En båttur i hamnen'), 'battur', 2) || 0;
    toast($t`⚓ Du lägger till vid rampen efter ${Math.round(T.t)} sekunder på vattnet.` + (h ? ` +${h} 😊` : ''), 'good');
  }
  function bussen() {
    const hem = busStopById(from?.buss) || BUS_STOPS[0];
    openModal($t('🚌 Hamnbussen'), `<p style="font-size:var(--f2);margin-top:0">${$t`Bussen går tillbaka till <b>${$t(hem.name)}</b>. Biljetten kostar ${fmt(BUSS)}.`}</p>`, [
      { label: $t('🚌 Åk till stan'), cls: 'btn-go', onClick: () => { closeModal(); if (g.money < BUSS) { toast($t('Du har inte råd med bussen.'), 'bad'); return; } g.money -= BUSS; g.passTime(15); g.save(); play('door'); go(() => { A.cityPos = [hem.x + 6, hem.y - 2]; A.go('city'); }); } },
      { label: $t('Stanna kvar'), onClick: closeModal },
    ]);
  }
  function go(cb) { if (fade.phase === 1) return; fade.phase = 1; fade.cb = cb; }

  // ---------- platserna ----------
  const dorr = (id) => { const h = HUS[id]; return { r: [h.door.x0 - 4, H.BASE - 40, h.door.x1 + 4, H.BASE], go: [(h.door.x0 + h.door.x1) / 2, H.BASE + 8] }; };
  const spots = () => tur ? [
    { id: 'ramp', r: [RAMP.x - 24, RAMP.y - 10, RAMP.x + 24, RAMP.y + 40], go: [RAMP.x, RAMP.y + 26], label: $t('LÄGG TILL VID RAMPEN'), act: landa },
  ] : [
    { id: 'buss', r: [HALLPLATS.x - 12, HALLPLATS.y - 36, HALLPLATS.x + 14, HALLPLATS.y + 2], go: [HALLPLATS.x + 10, HALLPLATS.y - 8], label: $t('HAMNBUSSEN TILL STAN'), act: bussen },
    { id: 'kontor', ...dorr('kontor'), label: HUS.kontor.namn, act: () => { play('knock'); talk.say($t('Hamnkaptenen: "Välkommen till Fiskehamnen! Färjan går från piren, fisken säljs i hallen – och håll i mössan, det blåser."'), () => ({ x: HUS.kontor.x + 104, y: H.BASE - 50 }), 5, { silent: true }); } },
    { id: 'magasin', ...dorr('magasin'), label: HUS.magasin.namn, act: () => toast($t('📦 Magasin 3: lådor med torkad fisk, rep och tunnor ända upp i taket. Kranen lyfter containrar hela dagen.')) },
    { id: 'marknad', ...dorr('marknad'), label: $t('MARKNADSHALLEN – JOBBA SOM FISKHANDLARE'), act: marknadshallen },
    ...STAND.map((s) => ({ id: 'stand-' + s.id, r: [s.x - 22, s.y - 44, s.x + 22, s.y + 2], go: [s.x, s.y + 12], label: s.id === 'fisk' ? $t`FÄRSK FISK · ${fmt(FISKPRIS)}` : s.id === 'rokt' ? $t`RÖKT MAKRILL · ${fmt(MARKNAD.rokt.pris)}` : $t`RÄKMACKA · ${fmt(MARKNAD.rakor.pris)}`, act: () => marknad(s.id) })),
    { id: 'fiskbil', r: [FISKBIL.x - 30, FISKBIL.y - 46, FISKBIL.x + 30, FISKBIL.y + 2], go: [FISKBIL.x, FISKBIL.y + 12], label: $t('FISK & CHIPS'), act: fiskbilen },
    { id: 'bataffar', ...dorr('bataffar'), label: $t('BÅTAFFÄREN – KÖP EN BÅT'), act: bataffaren },
    ...TRAILERS.map((T) => ({ id: 'trailer-' + T.typ, r: [T.x - 26, T.y - 36, T.x + 26, T.y + 2], go: [T.x, T.y + 12], label: `${BATTYPER[T.typ].namn.toUpperCase()} · ${fmt(BATTYPER[T.typ].pris)}`, act: bataffaren })),
    { id: 'skeppshandel', ...dorr('skeppshandel'), label: HUS.skeppshandel.namn, act: skeppshandeln },
    { id: 'rokeri', ...dorr('rokeri'), label: HUS.rokeri.namn, act: () => { play('knock'); toast($t('🔥 Rökeriet: makrillen hänger över alspånen. Den rökta fisken säljs i marknadshallen.')); } },
    { id: 'terminal', ...dorr('terminal'), label: $t('FÄRJAN TILL SOLÖN'), act: farjan },
    { id: 'farja', r: [FARJA.x, FARJA.y - 40, FARJA.x + FARJA.w, FARJA.y + 6], go: [PIR.x1 - 8, FARJA.y - 6], label: $t('SOLÖ-FÄRJAN'), act: farjan },
    { id: 'fyr', r: [FYR.x - 14, FYR.y - 120, FYR.x + 14, FYR.y], go: [FYR.x - 20, PIRHUVUD.y0 + 10], label: $t('FYREN'), act: () => toast($t('🗼 Fyren har lyst varje natt sedan 1890. Fyrvaktaren hette Hulda och bodde här med fjorton katter.')) },
    { id: 'fiska', r: [PIRHUVUD.x0, PIRHUVUD.y0 - 6, FYR.x - 16, PIRHUVUD.y1], go: [PIRHUVUD.x0 + 14, PIRHUVUD.y0 + 14], label: $t('FISKA FRÅN PIREN'), act: () => openFiske(A, { plats: 'brygga' }) },
    { id: 'ramp', r: [RAMP.x - 24, RAMP.y - 20, RAMP.x + 24, RAMP.y + 24], go: [RAMP.x, RAMP.y - 10], label: g.bat ? $t('BÅTRAMPEN – LÄGG UT MED DIN BÅT') : $t`BÅTRAMPEN – HYR BÅT · ${fmt(HYRA_PRIS)}`, act: laggUt },
    { id: 'kran', r: [KRAN.x - 20, KRAN.y - 108, KRAN.x + 80, KRAN.y], go: [KRAN.x + 20, KRAN.y + 10], label: $t('HAMNKRANEN'), act: () => toast($t('🏗️ Hamnkranen lyfter 20 ton. Kranföraren Berit har lyft 11 000 containrar och tappat noll.')) },
    { id: 'ankare', r: [ANKARE.x - 16, ANKARE.y - 48, ANKARE.x + 16, ANKARE.y], go: [ANKARE.x + 20, ANKARE.y + 6], label: $t('ANKARET'), act: () => toast($t('⚓ Ankaret kommer från skonaren Hoppet som förliste 1902. Alla ombord räddades – av Hulda i fyren.')) },
    ...BATAR.filter((b) => b.namn).map((b) => ({ id: 'bat-' + b.id, r: [b.x - 36, b.y - 50, b.x + 36, b.y + 4], go: [b.x, H.KANT - 8], label: b.namn, act: () => toast(b.id === 'elsa' ? $t('🐟 ELSA lossar nattens fångst – lådor med torsk och sill bärs i land.') : $t`⛵ ${b.namn} ligger och väntar på bättre väder. Skepparen sover.`) })),
    { id: 'skylt', r: [SKYLT.x - 24, SKYLT.y - 40, SKYLT.x + 24, SKYLT.y], go: [SKYLT.x + 12, SKYLT.y + 6], label: $t('FISKEHAMNEN'), act: () => toast($t('⚓ FISKEHAMNEN – fiskmarknad, båtaffär, färja till Solön och pir med fyr. Bussen hem står på hamnplanen.')) },
  ];
  const spotAt = (x, y) => spots().find((s) => x >= s.r[0] && x <= s.r[2] && y >= s.r[1] && y <= s.r[3]);
  const folkAt = (x, y) => folk.find((o) => Math.abs(o.x - x) < 7 && y < o.y + 2 && y > o.y - 30);

  // ---------- ritning ----------
  const KIT = propKit();
  const sken = (ctx, x, y, r, col) => { const gr = ctx.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, col); gr.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = gr; ctx.fillRect(x - r, y - r, r * 2, r * 2); };
  // den egna båten med spelaren i (roddbåt med åror som rör sig, motorbåt med svall)
  function ritaEgenBat(ctx) {
    const x = Math.round(walker.px), y = Math.round(walker.py), bob = Math.round(Math.sin(t * 1.6) * 1), moving = walker.path.length > 0, motor = tur.typ === 'motor', s = walker.dir === 'left' ? -1 : 1;
    ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.fillRect(x - 16, y + 3, 32, 1);
    if (moving) for (let k = 0; k < 4; k++) ctx.fillRect(x - s * (18 + k * 6), y + 2 + (k % 2), 4, 1);
    const Y = y + bob, L = 24;
    for (let i = -L; i <= L; i++) { const d = Math.pow(Math.abs(i) / L, 2.2), top = -10 - (i * s > 16 ? Math.round((i * s - 16) / 3) : 0), bot = 2 - Math.round(d * 5); for (let yy = top; yy <= bot; yy++) { ctx.fillStyle = yy === top ? (motor ? '#ffffff' : '#d29a5c') : yy === bot ? (motor ? '#2a5ad0' : '#3a2214') : yy > bot - 2 ? (motor ? '#c8ccd4' : '#5e3a20') : (motor ? '#f4f4f6' : '#86562e'); ctx.fillRect(x + i, Y + yy, 1, 1); } }
    ctx.fillStyle = motor ? '#2a5ad0' : '#ae7640'; ctx.fillRect(x - L + 2, Y - 6, L * 2 - 4, 1);
    if (motor) { ctx.fillStyle = '#f4f4f6'; ctx.fillRect(x + s * 8 - 7, Y - 20, 14, 10); ctx.fillStyle = '#ffffff'; ctx.fillRect(x + s * 8 - 7, Y - 21, 14, 1); ctx.fillStyle = '#6a8ab0'; ctx.fillRect(x + s * 8 - 5, Y - 18, 10, 4); ctx.fillStyle = '#2a2a30'; ctx.fillRect(x - s * L - 2, Y - 12, 4, 9); ctx.fillStyle = '#d8343c'; ctx.fillRect(x - s * L - 1, Y - 11, 2, 1); }
    else { const sw = moving ? Math.sin(t * 6) * 4 : 0; ctx.fillStyle = '#d29a5c'; ctx.fillRect(x - 16, Y - 11 + Math.round(sw), 13, 1); ctx.fillRect(x + 3, Y - 11 - Math.round(sw), 13, 1); ctx.fillStyle = '#ae7640'; ctx.fillRect(x - 10, Y - 9, 7, 1); ctx.fillRect(x + 3, Y - 9, 7, 1); }
    drawPerson(ctx, x - s * 4, Y - 3, A.avatar.look, walker.dir, 5);
  }
  const ritaFiskare = (ctx, f, i) => { drawPerson(ctx, f.x, f.y, f.look, f.dir, Math.sin(t * 1.4 + i * 2) > 0.3 ? 9 : 7); };
  const ritaVagor = (ctx, cx, N) => { for (const v of vagor) { if (v.x < cx - 10 || v.x > cx + VW + 10) continue; const a = 0.35 + Math.sin(t * 2 + v.f) * 0.3; if (a < 0.2) continue; ctx.fillStyle = `rgba(${N ? '180,200,230' : '220,240,250'},${a.toFixed(2)})`; ctx.fillRect(Math.round(v.x), Math.round(v.y), 4 + Math.round(a * 4), 1); } };

  return {
    viewMax: { w: TW, h: TH },
    get worldX() { return walker.px; }, get worldY() { return walker.py; },
    get worldRide() { const F = fordon(); return F && !tur ? { id: F.id, c: F.c } : null; },
    rideChanged: applyRide,
    update(dt) {
      t += dt; banner += dt;
      VW = Math.max(384, Math.min(A.W || 384, TW)); VH = Math.max(160, Math.min(A.H || 216, TH));
      if (fade.phase === 1) { fade.a = Math.min(1, fade.a + dt * 2.6); if (fade.a >= 1) { fade.phase = 0; const cb = fade.cb; fade.cb = null; cb?.(); return; } }
      else if (fade.phase === 2) { fade.a = Math.max(0, fade.a - dt * 1.8); if (fade.a <= 0) fade.phase = 0; walker.update(dt); }
      else walker.update(dt);
      if (tur) tur.t += dt;
      updLiv(dt);
      if (pets && !tur) try { pets.update(dt, walker.px, walker.py, (x, y) => walker.walkable(x, y)); } catch (e) { console.error('husdjuren i hamnen:', e); pets = null; }
      const c = camTarget(); cam.x += (c.x - cam.x) * Math.min(1, dt * 8); cam.y += (c.y - cam.y) * Math.min(1, dt * 8);
    },
    draw(ctx) {
      ctx.setTransform(A.pxs, 0, 0, A.pxs, 0, 0);
      ctx.imageSmoothingEnabled = false;
      const N = night(), D = dusk();
      const cx = Math.round(cam.x), cy = Math.round(cam.y);
      ctx.drawImage(skyCanvas(VW, N, D), 0, Math.min(0, -cy * 0.3));
      const bk = takCanvas(N), off = -Math.round(cx * 0.6) % bk.width, by = Math.round(H.BASE - 60 - bk.height + 20 - cy * 0.92);
      for (let x = off; x < VW; x += bk.width) ctx.drawImage(bk, x, by);
      ctx.drawImage(ground(), -cx, -cy);
      ctx.save(); ctx.translate(-cx, -cy);
      ritaVagor(ctx, cx, N);
      const items = [];
      const syns = (x, m = 80) => x > cx - m && x < cx + VW + m;
      for (const id of HUSLISTA) { const Hs = HUS[id]; if (Hs.x > cx + VW + 20 || Hs.x + Hs.w + 20 < cx) continue; items.push({ fy: H.BASE - 1, draw: () => ritaHus(ctx, id, N, H.BASE) }); }
      if (rok) items.push({ fy: H.BASE - 0.5, draw: () => ritaRok(ctx, HUS.rokeri.x + HUS.rokeri.w - 25, H.BASE - HUS.rokeri.h - 30, t) });
      for (const s of STAND) items.push({ fy: s.y, draw: () => ritaStand(ctx, s, N) });
      items.push({ fy: FISKBIL.y, draw: () => ritaFiskbil(ctx, N) }, { fy: KRAN.y, draw: () => ritaKran(ctx) }, { fy: ANKARE.y, draw: () => ritaAnkare(ctx) });
      for (const T of TRAILERS) items.push({ fy: T.y, draw: () => ritaTrailer(ctx, T, N) });
      for (const p of POLLARE) if (syns(p.x)) items.push({ fy: p.y, draw: () => ritaPollare(ctx, p.x, p.y) });
      for (const l of LYKTOR) if (syns(l.x)) items.push({ fy: l.y, draw: () => ritaHamnlykta(ctx, l.x, l.y, N) });
      LADOR.forEach(([x, y], i) => items.push({ fy: y, draw: () => ritaLada(ctx, x, y, i) }));
      for (const [x, y] of TINOR) items.push({ fy: y, draw: () => ritaTina(ctx, x, y) });
      for (const [x, y] of NATSTALL) items.push({ fy: y, draw: () => ritaNatstall(ctx, x, y) });
      for (const [x, y] of TUNNOR) items.push({ fy: y, draw: () => ritaTunna(ctx, x, y) });
      for (const [x, y] of REP) items.push({ fy: y, draw: () => ritaRep(ctx, x, y) });
      for (const [x, y] of BANKAR) items.push({ fy: y, draw: () => KIT.bench(ctx, x, y) });
      items.push({ fy: SKYLT.y, draw: () => ritaSkylt(ctx) }, { fy: HALLPLATS.y, draw: () => ritaHallplats(ctx, HALLPLATS.x, HALLPLATS.y) });
      // piren: stolpar med kätting längs båda sidorna, fyren längst ut, färjan, bojarna
      for (let y = H.KANT + 10; y < PIRHUVUD.y0; y += 24) items.push({ fy: y, draw: () => { ritaPirstolpe(ctx, PIR.x0 + 1, y); ritaPirstolpe(ctx, PIR.x1 - 1, y); ritaKatting(ctx, PIR.x0 + 2, PIR.x1 - 1, y - 2); } });
      items.push({ fy: FYR.y, draw: () => ctx.drawImage(fyrBild(N), FYR.x - 20, FYR.y - 118) });
      items.push({ fy: FARJA.y + 6, draw: () => ctx.drawImage(farjaBild(), FARJA.x, FARJA.y - FARJA.h + 8 + Math.round(Math.sin(t * 0.9) * 1.5)) });
      for (const [bx, byy, c] of [[1150, 420, '#d8343c'], [700, 440, '#f0c030'], [300, 430, '#d8343c'], [1700, 440, '#46a35a']]) items.push({ fy: byy, draw: () => ritaBoj(ctx, bx, byy, c, t) });
      for (const b of BATAR) if (syns(b.x)) items.push({ fy: b.y + 2, draw: () => ritaBat(ctx, b, t, N) });
      fiskare.forEach((f, i) => items.push({ fy: f.y, draw: () => ritaFiskare(ctx, f, i) }));
      items.push({ fy: SAL.y, draw: () => { if (salK > 0) ritaSal(ctx, SAL.x, SAL.y, salK); } });
      for (const m of masar) if (m.borta <= 0) items.push({ fy: m.y + (m.flyg > 0 ? 100 : 0), draw: () => ritaMas(ctx, m.x, m.y, t, m.flyg > 0) });
      for (const o of folk) if (syns(o.x)) items.push({ fy: o.y, draw: () => drawPerson(ctx, o.x, o.y, o.look, o.dir, o.vila <= 0 ? WALK_SEQ[Math.floor(t * 8.5 + o.x) % 4] : 0) });
      items.push(...folkDrawables(A, t));
      if (pets && !tur) for (const d of pets.drawables()) items.push({ fy: d.fy ?? d.y, draw: () => d.draw(ctx) });
      if (tur) items.push({ fy: walker.py + 1, draw: () => ritaEgenBat(ctx) });
      else { const F = fordon(); items.push(selfDrawable(A, walker, t, { folksHere: worldFolksHere(A).length, ride: F ? { id: F.id, c: F.c } : null })); }
      items.sort((a, b) => a.fy - b.fy).forEach((d) => d.draw(ctx));
      ctx.restore();
      if (N || D) {
        ctx.fillStyle = N ? 'rgba(12,16,48,0.55)' : 'rgba(60,40,90,0.2)'; ctx.fillRect(0, 0, VW, VH);
        if (D) { ctx.fillStyle = 'rgba(255,140,80,0.10)'; ctx.fillRect(0, 0, VW, VH); }
        ctx.save(); ctx.translate(-cx, -cy); ctx.globalCompositeOperation = 'lighter';
        for (const l of LYKTOR) if (syns(l.x)) sken(ctx, l.x, l.y - 38, 36, `rgba(255,200,110,${N ? 0.45 : 0.22})`);
        if (N) { const a = (t * 0.8) % (Math.PI * 2); ctx.fillStyle = 'rgba(255,240,180,.18)'; ctx.beginPath(); ctx.moveTo(FYR.x, FYR.y - 108); ctx.lineTo(FYR.x + Math.cos(a) * 160 - Math.sin(a) * 18, FYR.y - 108 + Math.sin(a) * 60 - Math.cos(a) * 6); ctx.lineTo(FYR.x + Math.cos(a) * 160 + Math.sin(a) * 18, FYR.y - 108 + Math.sin(a) * 60 + Math.cos(a) * 6); ctx.closePath(); ctx.fill(); sken(ctx, FYR.x, FYR.y - 108, 30, 'rgba(255,240,180,.5)'); }
        for (const b of BATAR) if (N && syns(b.x)) sken(ctx, b.x, b.y - 20, 16, 'rgba(255,200,120,.25)');
        ctx.globalCompositeOperation = 'source-over'; ctx.restore();
      }
      ctx.save(); ctx.translate(-cx, -cy); talk.draw(ctx, { x0: cx, x1: cx + VW }); ctx.restore();
      if (banner < 4) { const a = banner < 0.4 ? banner / 0.4 : banner > 3.4 ? (4 - banner) / 0.6 : 1; ctx.globalAlpha = Math.max(0, a); const s = $t('FISKEHAMNEN'), s2 = $t('BÅTAR, FISK OCH EN FÄRJA TILL SOLÖN'), w = Math.max(textW(BIG, s, 2), textW(SMALL, s2)) + 20; ctx.fillStyle = 'rgba(20,18,26,.85)'; ctx.fillRect((VW - w) >> 1, 26, w, 30); ctxText(ctx, BIG, s, (VW - textW(BIG, s, 2)) >> 1, 30, '#8ab4e8', 2); ctxText(ctx, SMALL, s2, (VW - textW(SMALL, s2)) >> 1, 48, '#f4f1ea'); ctx.globalAlpha = 1; }
      const s = hover && spotAt(hover.x + cx, hover.y + cy);
      if (s) { const w = textW(SMALL, s.label) + 10, x = Math.round(Math.max(2, Math.min(VW - w - 2, hover.x - w / 2))), y = Math.max(2, hover.y - 22); ctx.fillStyle = 'rgba(20,18,26,.9)'; ctx.fillRect(x, y, w, 11); ctxText(ctx, SMALL, s.label, x + 5, y + 3, '#ffd23f'); }
      if (fade.a > 0) { ctx.fillStyle = `rgba(10,10,16,${fade.a.toFixed(2)})`; ctx.fillRect(0, 0, VW, VH); }
    },
    down(sx, sy) {
      if (fade.phase === 1) return;
      hover = { x: sx, y: sy };
      const x = sx + cam.x, y = sy + cam.y;
      if (!tur) { const fk = folkTapAt(A, x, y); if (fk) { openSpelarkort(A, fk); return; } const o = folkAt(x, y); if (o) { walker.walkTo(o.x + (walker.px < o.x ? -14 : 14), o.y + 2, () => { o.vila = Math.max(o.vila, 4); talk.say(o.rad, () => ({ x: o.x, y: o.y - 34 }), 3.5, { voice: o.look }); }); return; } }
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
      tur: () => (tur ? { typ: tur.typ, hyrd: tur.hyrd, t: +tur.t.toFixed(1) } : null),
      landa: () => { landa(); return !tur; },
      sal: () => salK > 0,
      masar: () => masar.map((m) => ({ x: Math.round(m.x), y: Math.round(m.y), flyg: m.flyg > 0, borta: m.borta > 0 })),
      folk: () => folk.map((o) => ({ x: Math.round(o.x), y: Math.round(o.y) })),
    },
  };
}
// marken målas en gång
let GROUND = null;
const ground = () => (GROUND ||= paintGround());
