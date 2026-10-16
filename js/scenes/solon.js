// ⛴️ SOLÖN – badön ute i havet (kartan, marken och byggnaderna: js/solon/karta.js). Man kommer hit med SOLÖ-FÄRJAN
// från bryggan vid Sjöboden i Linnéstaden (js/city/pir.js, 20 kr tur och retur) och kliver i land på färjeläget.
//
// Här lever sommaren: folk promenerar längs vattnet, solar på handdukar under parasollerna, badar i det grunda
// vattnet och spelar beachvolley; två barn bygger sandslott, livräddaren sitter i sitt torn, fiskaren på klipporna
// får napp ibland, fiskmåsarna seglar över stranden och segelbåtarna glider förbi långt ute. Fyren lyser på natten.
//   • SOLÖ-KIOSKEN: glass, saft och korv (mättar och ger lycka)
//   • BADA: gå ut i det grunda vattnet – figuren simmar (bara huvud och axlar syns), första doppet om dagen ger lycka
//   • färjan tillbaka till stan står vid bryggan
//   • 🎣 FISKE (js/solon/fiske.js): metspö i kiosken, fiska längst ut på färjebryggan eller vid klipporna nära fyren
// Sommarstugorna och båtuthyrningen öppnar i nästa steg (skyltar och folk berättar).
import { createCityWalker } from '../city/walk.js';
import { selfDrawable, folkDrawables, folkTapAt, createSpeech, WALK_SEQ, synligRuta } from './walkable.js';
import { openSpelarkort } from '../core/vannerapp.js';   // 💛 spelarkortet: tryck på en spelare → bli vänner (v0.136)
import { worldFolksHere } from '../net/world.js';
import { openModal, closeModal, toast, esc } from '../core/ui.js';
import { play } from '../core/sound.js';
import { SMALL, BIG, ctxText, textW } from '../core/floor-pix.js';
import { fmt } from '../game.js';
import { drawPerson, makeLook } from '../core/people.js';
import { createPetWalk } from '../pets/outdoors.js';
import { skyCanvas } from '../landet/karta.js';
import { propKit } from '../city/props.js';
import { PIER } from '../city/map.js';
import { TW, TH, S, BRYGGA, FARJA, KLIPPOR, FYR, FISKARE, KIOSK, TORN, NAT, SLOTT, STUGOR, SPANG, PARASOLLER, HANDDUKAR, SKYLT, BANKAR, klippKant, hinder, paintGround, stugaBild, kioskBild, fyrBild, farjaBild } from '../solon/karta.js';
import { $t } from '../core/i18n.js';
import { openFiske, kopSpo, fiskeOf, SPO_PRIS, fiskURL } from '../solon/fiske.js';   // 🎣 fisket

const GANG = 100;
const STRANDPRAT = [
  $t('Vattnet är jättevarmt i dag!'), $t('Har du sett fyren? Den lyser hela natten.'), $t('Glassen i kiosken är den bästa i hela Pixelstaden.'),
  $t('Snart kan man hyra båt här, har jag hört!'), $t('Akta dig för fiskmåsarna – de snor glassen!'), $t('Jag kommer hit varje sommar.'),
];
const MENY = [
  { id: 'strut', namn: $t('🍦 Glasstrut'), pris: 25, hunger: 12, glad: 3 },
  { id: 'jordgubb', namn: $t('🍓 Jordgubbsglass'), pris: 30, hunger: 14, glad: 3 },
  { id: 'saft', namn: $t('🥤 Kall saft'), pris: 15, energy: 6, glad: 1 },
  { id: 'korv', namn: $t('🌭 Korv med bröd'), pris: 35, hunger: 28, glad: 1 },
];

export function makeSolon(A) {
  const g = A.game;
  let VW = Math.max(384, Math.min(A.W || 384, TW)), VH = Math.max(160, Math.min(A.H || 216, TH));
  const from = A.solonFran || null; A.solonFran = null;
  const walker = createCityWalker({ W: TW, H: TH, left: 2, right: TW - 2, top: BRYGGA.y0 + 4, bottom: S.BOTTOM, spawn: [(BRYGGA.x0 + BRYGGA.x1) / 2, BRYGGA.y0 + 14] });
  walker.speed = GANG;   // (inga fordon på ön – cykeln står kvar i stan)
  walker.setObstacles(hinder());
  walker.snapFree();
  walker.dir = 'down';
  const talk = createSpeech();
  let t = 0, hover = null, banner = 0, badat = false;
  const fade = { a: 1, phase: 2, cb: null };
  const cam = { x: 0, y: 0 };
  // (kameran räknar med den synliga rutan – telefonen beskär canvasen upptill/nedtill, se walkable.js synligRuta)
  const camTarget = () => { const S = synligRuta(VH); return { x: Math.max(0, Math.min(TW - VW, walker.px - VW / 2)), y: Math.max(0, Math.min(Math.max(0, TH - S.y1), walker.py - S.y0 - S.h * (S.h < VH - 8 ? 0.58 : 0.62))) }; };
  Object.assign(cam, camTarget());
  if (!A.attract && from?.farja) { const h = g.glad?.(3, '', 'solon', 3); setTimeout(() => toast(h ? $t`⛴️ Välkommen till Solön! Sol, bad och glass. +${h} 😊` : $t('⛴️ Välkommen till Solön! Sol, bad och glass.'), 'good'), 900); }
  let pets = null;
  try { pets = createPetWalk(A); } catch (e) { console.error('husdjuren på Solön startade inte:', e); }

  // ---------- folket ----------
  const rnd = (a, b) => a + Math.random() * (b - a);
  const flanor = [0, 1, 2, 3].map((i) => ({ look: makeLook(), x: 200 + i * 260, y: [168, 190, 282, 232][i], dir: i % 2 ? 'left' : 'right', fart: rnd(16, 24), vila: 0, rad: STRANDPRAT[i] }));
  const solare = HANDDUKAR.slice(0, 5).map((h, i) => ({ look: makeLook(), x: h.x + 2, y: h.y + 2, dir: i % 2 ? 'left' : 'right' }));
  const badare = [0, 1, 2].map((i) => ({ look: makeLook(), x: 300 + i * 330, y: 124 + (i % 2) * 8, fas: i * 2.1, plask: 0 }));
  const barn = [0, 1].map((i) => ({ look: { ...makeLook(), kid: true }, x: SLOTT.x + (i ? 13 : -13), y: SLOTT.y + 2, dir: i ? 'left' : 'right' }));
  const livraddare = { look: { ...makeLook(), shirt: '#e04848', top: 'tee', cap: '#f4f1ea', hat: null }, x: TORN.x, y: TORN.y - 20 };
  const volley = [{ look: makeLook(), x: NAT.x0 + 14, y: NAT.y + 4, dir: 'right' }, { look: makeLook(), x: NAT.x1 - 14, y: NAT.y - 2, dir: 'left' }];
  const fiskaren = { look: { ...makeLook(), cap: '#2a5aa8' }, x: FISKARE.x, y: FISKARE.y, napp: 0, nasta: rnd(8, 16) };
  const masar = [0, 1, 2].map((i) => ({ x: rnd(0, TW), y: rnd(20, 90), v: rnd(18, 30) * (i % 2 ? -1 : 1), fas: rnd(0, 6) }));
  const batar = [{ x: 300, y: 33, v: 4, f: 0xf4f1ea }, { x: 980, y: 36, v: -3, f: 0xe04848 }];
  function updLiv(dt) {
    for (const o of flanor) {
      if (o.vila > 0) { o.vila -= dt; continue; }
      o.x += (o.dir === 'right' ? 1 : -1) * o.fart * dt;
      if (o.x > KLIPPOR.x0 - 30) { o.dir = 'left'; o.vila = rnd(1, 3); }
      if (o.x < BRYGGA.x1 + 30) { o.dir = 'right'; o.vila = rnd(1, 3); }
      if (Math.random() < dt * 0.05) o.vila = rnd(2, 4);
    }
    for (const b of badare) { b.fas += dt; if (b.plask > 0) b.plask -= dt; else if (Math.random() < dt * 0.08) b.plask = 1.4; }
    for (const m of masar) { m.x += m.v * dt; m.fas += dt * 3; if (m.x > TW + 40) m.x = -40; if (m.x < -40) m.x = TW + 40; }
    for (const b of batar) { b.x += b.v * dt; if (b.x > TW + 40) b.x = -40; if (b.x < -40) b.x = TW + 40; }
    fiskaren.nasta -= dt; if (fiskaren.napp > 0) fiskaren.napp -= dt;
    if (fiskaren.nasta <= 0) { fiskaren.napp = 2.2; fiskaren.nasta = rnd(10, 20); }
  }

  // ---------- platserna ----------
  const stugSpot = (st) => ({ id: `stuga-${st.id}`, r: [st.x, S.BASE - st.h - 26, st.x + st.w, S.BASE], go: [st.x + (st.w >> 1), S.BASE + 8], label: st.namn, act: () => { play('knock'); toast($t('🏡 En sommarstuga med utsikt över dynerna. Snart kan man hyra – eller köpa – en stuga här!'), 'wrap'); } });
  const spots = () => [
    { id: 'kiosk', r: [KIOSK.x, KIOSK.y - 66, KIOSK.x + KIOSK.w, KIOSK.y], go: [KIOSK.x + (KIOSK.w >> 1), KIOSK.y + 8], label: $t('SOLÖ-KIOSKEN – GLASS, SAFT OCH KORV'), act: kiosken },
    { id: 'fiska-brygga', r: [BRYGGA.x0 - 6, BRYGGA.y0 - 6, BRYGGA.x1 + 2, BRYGGA.y0 + 10], go: [(BRYGGA.x0 + BRYGGA.x1) / 2, BRYGGA.y0 + 6], label: $t('FISKA HÄR'), act: () => { walker.dir = 'up'; openFiske(A, { plats: 'brygga' }); } },
    { id: 'fiska-klippa', r: [klippKant(150) - 18, 132, klippKant(150) + 6, 160], go: [klippKant(150) - 10, 150], label: $t('FISKA HÄR'), act: () => { walker.dir = 'right'; openFiske(A, { plats: 'klippa' }); } },
    { id: 'farja', r: [FARJA.x, FARJA.y - 6, FARJA.x + FARJA.w, FARJA.y + FARJA.h], go: [(BRYGGA.x0 + BRYGGA.x1) / 2, BRYGGA.y0 + 12], label: $t('FÄRJAN TILL PIXELSTADEN'), act: farjan },
    { id: 'fyr', r: [FYR.x - 14, FYR.y - 120, FYR.x + 14, FYR.y], go: [klippKant(FYR.y + 40) - 8, FYR.y + 40], label: $t('SOLÖNS FYR'), act: () => { play('click'); toast($t('🗼 Solöns fyr har lyst varje natt i över hundra år. Fyrvaktaren sägs ha en båt att hyra ut …'), 'wrap'); } },
    { id: 'torn', r: [TORN.x - 12, TORN.y - 44, TORN.x + 12, TORN.y], go: [TORN.x, TORN.y + 10], label: $t('LIVRÄDDARTORNET'), act: () => talk.say($t('Bada gärna – men håll dig där det är grunt!'), () => ({ x: livraddare.x, y: livraddare.y - 40 }), 3, { voice: livraddare.look }) },
    { id: 'slott', r: [SLOTT.x - 12, SLOTT.y - 16, SLOTT.x + 12, SLOTT.y + 2], go: [SLOTT.x, SLOTT.y + 12], label: $t('SANDSLOTTET'), act: sandslott },
    { id: 'nat', r: [NAT.x0, NAT.y - 26, NAT.x1, NAT.y + 2], go: [(NAT.x0 + NAT.x1) / 2, NAT.y + 14], label: $t('BEACHVOLLEY'), act: () => { play('click'); talk.say($t('Vi spelar till 15! Snart får du vara med.'), () => ({ x: volley[0].x, y: volley[0].y - 40 }), 3, { voice: volley[0].look }); } },
    { id: 'fiskare', r: [FISKARE.x - 8, FISKARE.y - 34, FISKARE.x + 8, FISKARE.y + 2], go: [klippKant(FISKARE.y + 20) - 8, FISKARE.y + 20], label: $t('FISKAREN PÅ KLIPPORNA'), act: () => talk.say(fiskaren.napp > 0 ? $t('Napp! En makrill!') : fiskeOf(g).spo ? $t('Prova vid klippkanten här – eller längst ut på färjebryggan!') : $t('Köp ett metspö i kiosken, så kan du fiska här du också!'), () => ({ x: fiskaren.x, y: fiskaren.y - 40 }), 3, { voice: fiskaren.look }) },
    { id: 'skylt', r: [SKYLT.x - 18, SKYLT.y - 38, SKYLT.x + 18, SKYLT.y + 2], go: [SKYLT.x + 10, SKYLT.y + 8], label: $t('SOLÖN'), act: () => { play('click'); toast($t('⛴️ SOLÖN – sandstrand, fyr och sommarstugor. Färjan till Pixelstaden går från bryggan.'), 'wrap'); } },
    ...STUGOR.map(stugSpot),
  ];
  function kiosken() {
    play('click');
    const rad = (m) => `<div class="prow" style="grid-template-columns:1fr auto"><span class="nm">${esc(m.namn)}</span><button class="btn btn-small btn-go" data-kiosk="${m.id}" ${g.money < m.pris ? 'disabled' : ''}>${esc(fmt(m.pris))}</button></div>`;
    const spo = !fiskeOf(g).spo ? `<div class="prow" style="grid-template-columns:1fr auto"><span class="nm">${esc($t('🎣 Metspö'))}<br><small class="sp">${esc($t('Fiska från bryggan och klipporna'))}</small></span><button class="btn btn-small btn-gold" data-spo ${g.money < SPO_PRIS ? 'disabled' : ''}>${esc(fmt(SPO_PRIS))}</button></div>` : '';
    const dlg = openModal($t('🍦 Solö-kiosken'), `<p style="font-size:var(--f2);margin-top:0">${$t('"Hej hej! Vad får det lov att vara? Glassen är hemgjord!"')}</p><div class="plist">${MENY.map(rad).join('')}${spo}</div>`, [{ label: $t('Inget, tack'), onClick: closeModal }]);
    dlg.querySelector('[data-spo]')?.addEventListener('click', () => { if (kopSpo(A)) closeModal(); });
    dlg.querySelectorAll('[data-kiosk]').forEach((b) => (b.onclick = () => {
      const m = MENY.find((x) => x.id === b.dataset.kiosk);
      if (!m || g.money < m.pris) return;
      g.money -= m.pris;
      if (m.hunger) g.hunger = Math.min(100, (g.hunger || 0) + m.hunger);
      if (m.energy) g.energy = Math.min(100, (g.energy || 0) + m.energy);
      const h = g.glad?.(m.glad, '', `kiosk-${m.id}`, m.glad) || 0;
      g.save(); closeModal(); play('buy');
      toast(`${m.namn.split(' ')[0]} ${h ? $t`Mums! +${h} 😊` : $t('Mums!')}`, 'good');
    }));
  }
  function sandslott() {
    play('click');
    const h = g.glad?.(1, '', 'sandslott', 1) || 0;
    talk.say($t('Titta, vi har byggt ett slott med vallgrav!'), () => ({ x: barn[0].x, y: barn[0].y - 30 }), 3, { voice: barn[0].look });
    if (h) toast(`🏰 +${h} 😊`);
  }
  function farjan() {
    openModal($t('⛴️ Solö-färjan'), `<p style="font-size:var(--f2);margin-top:0">${$t('Färjan går tillbaka till bryggan vid Sjöboden i Linnéstaden. Din biljett gäller tur och retur – resan tar 20 minuter.')}</p>`, [
      { label: $t('⛴️ Åk tillbaka till stan'), cls: 'btn-go', onClick: () => { closeModal(); g.passTime(20); g.save(); play('door'); go(() => { A.cityPos = [PIER.deck[0] + 12, PIER.deck[1] + 14]; A.go('city'); }); } },
      { label: $t('Stanna kvar'), onClick: closeModal },
    ]);
  }
  function go(cb) { if (fade.phase === 1) return; fade.phase = 1; fade.cb = cb; }
  const spotAt = (x, y) => spots().find((s) => x >= s.r[0] && x <= s.r[2] && y >= s.r[1] && y <= s.r[3]);
  const folkAt = (x, y) => [...flanor, ...solare, ...barn, ...volley].find((o) => Math.abs(o.x - x) < 8 && y < o.y + 2 && y > o.y - 34);
  const iVattnet = (x, y) => y < S.GRUNT[1] - 2 && !(x >= BRYGGA.x0 - 1 && x <= BRYGGA.x1 && y < BRYGGA.y1);   // (på bryggan är man torr)
  const djup = (y) => Math.round(Math.max(0, Math.min(1, (S.GRUNT[1] - 2 - y) / 22)) * 22) + 8;   // hur mycket av figuren som är under ytan

  // ---------- ritning ----------
  const KIT = propKit();
  const ringar = (ctx, x, y, w = 9) => { const k = Math.floor(t * 3) % 2; ctx.fillStyle = 'rgba(240,252,255,.75)'; ctx.fillRect(Math.round(x - w - k), Math.round(y), w * 2 + k * 2, 1); ctx.fillStyle = 'rgba(240,252,255,.4)'; ctx.fillRect(Math.round(x - w - 3 - k), Math.round(y + 2), 4, 1); ctx.fillRect(Math.round(x + w - 1 + k), Math.round(y + 2), 4, 1); };
  // en figur i vattnet: bara det som är ovanför ytan, och ringar runt
  const iVatten = (ctx, x, y, d, ritaFn) => { ctx.save(); ctx.beginPath(); ctx.rect(x - 30, y - 90, 60, 90 - d); ctx.clip(); ritaFn(); ctx.restore(); ringar(ctx, x, y - d); };
  const drawParasoll = (ctx, p) => {
    ctx.fillStyle = 'rgba(40,30,20,.18)'; for (let j = 0; j < 6; j++) { const w = Math.round(17 * Math.sqrt(1 - (j / 6) ** 2)); ctx.fillRect(p.x - w + 6, p.y + 4 + j, w * 2, 1); }   // skuggan
    ctx.fillStyle = '#e8e4dc'; ctx.fillRect(p.x, p.y - 30, 1, 30); ctx.fillStyle = '#9a948a'; ctx.fillRect(p.x + 1, p.y - 30, 1, 30);
    for (let j = 0; j < 9; j++) { const w = Math.round(16 * Math.sqrt(1 - ((8 - j) / 9) ** 2)); for (let i = -w; i <= w; i++) { const seg = Math.floor((i + 16) / 5) % 2; ctx.fillStyle = '#' + (seg ? p.f[1] : p.f[0]).toString(16).padStart(6, '0'); ctx.fillRect(p.x + i, p.y - 38 + j, 1, 1); } }
    ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.fillRect(p.x - 16, p.y - 30, 33, 1); ctx.fillStyle = '#3a3a42'; ctx.fillRect(p.x, p.y - 39, 1, 2);
  };
  const drawHandduk = (ctx, h) => { for (let j = 0; j < 9; j++) for (let i = 0; i < 20; i++) { ctx.fillStyle = '#' + ((Math.floor(i / 3) % 2) ? h.f[1] : h.f[0]).toString(16).padStart(6, '0'); ctx.fillRect(h.x - 10 + i, h.y - 6 + j, 1, 1); } ctx.fillStyle = 'rgba(0,0,0,.15)'; ctx.fillRect(h.x - 10, h.y + 3, 20, 1); };
  const drawSlott = (ctx) => {
    const { x, y } = SLOTT, s1 = '#e0c890', s2 = '#c8ae78', s3 = '#a88a58';
    for (let j = 0; j < 5; j++) { ctx.fillStyle = j < 2 ? '#7ab8c8' : s3; ctx.fillRect(x - 14 + j, y - 1 + j % 2, 28 - j * 2, 1); }   // vallgraven
    ctx.fillStyle = s2; ctx.fillRect(x - 9, y - 9, 18, 9); ctx.fillStyle = s1; ctx.fillRect(x - 9, y - 9, 18, 2);
    for (const tx of [-9, 5]) { ctx.fillStyle = s2; ctx.fillRect(x + tx, y - 15, 5, 7); ctx.fillStyle = s1; ctx.fillRect(x + tx, y - 15, 5, 1); for (let k = 0; k < 3; k += 2) ctx.fillRect(x + tx + k, y - 16, 1, 1); }
    ctx.fillStyle = s3; ctx.fillRect(x - 1, y - 5, 3, 5); ctx.fillStyle = '#5a5e66'; ctx.fillRect(x + 7, y - 22, 1, 7); ctx.fillStyle = '#e04848'; ctx.fillRect(x + 8, y - 22, 4, 3);
    ctx.fillStyle = '#f0b429'; ctx.fillRect(x + 14, y - 3, 4, 3); ctx.fillStyle = '#3a7bd5'; ctx.fillRect(x - 18, y - 2, 3, 2);   // hinken och spaden
  };
  const drawTorn = (ctx) => {
    const { x, y } = TORN;
    ctx.fillStyle = 'rgba(40,30,20,.2)'; ctx.fillRect(x - 12, y - 1, 26, 3);
    for (const lx of [-10, 9]) { ctx.fillStyle = '#9a6e44'; ctx.fillRect(x + lx, y - 26, 2, 26); }
    for (let k = 0; k < 4; k++) { ctx.fillStyle = '#7a5432'; ctx.fillRect(x - 9, y - 6 - k * 6, 18, 1); }
    ctx.fillStyle = '#f4f1ea'; ctx.fillRect(x - 12, y - 28, 25, 3); ctx.fillStyle = '#c8c4b8'; ctx.fillRect(x - 12, y - 26, 25, 1);
    ctx.fillStyle = '#e04848'; ctx.fillRect(x + 8, y - 44, 1, 16); ctx.fillRect(x + 9, y - 44, 7, 5); ctx.fillStyle = '#f4f1ea'; ctx.fillRect(x + 11, y - 43, 3, 3); ctx.fillStyle = '#e04848'; ctx.fillRect(x + 12, y - 43, 1, 3); ctx.fillRect(x + 11, y - 42, 3, 1);
  };
  const drawNat = (ctx) => {
    const { x0, x1, y } = NAT;
    for (const px of [x0, x1]) { ctx.fillStyle = '#e8e4dc'; ctx.fillRect(px, y - 24, 2, 24); }
    for (let k = 0; k < 4; k++) { ctx.fillStyle = 'rgba(30,26,36,.55)'; ctx.fillRect(x0 + 2, y - 22 + k * 2, x1 - x0 - 2, 1); }
    for (let i = x0 + 4; i < x1; i += 4) { ctx.fillStyle = 'rgba(30,26,36,.4)'; ctx.fillRect(i, y - 22, 1, 7); }
    ctx.fillStyle = '#f4f1ea'; ctx.fillRect(x0 + 2, y - 23, x1 - x0 - 2, 1);
  };
  // bollen flyger i en båge mellan spelarna (3 s per vända)
  const boll = () => { const u = (t % 3) / 3, fram = Math.floor(t / 3) % 2 === 0, a = fram ? volley[0] : volley[1], b = fram ? volley[1] : volley[0]; return { x: a.x + (b.x - a.x) * u, y: a.y - 30 + (b.y - a.y) * u - Math.sin(u * Math.PI) * 38, hopp: u > 0.85 ? b : u < 0.12 ? a : null }; };
  const drawMas = (ctx, m) => { const vinge = Math.sin(m.fas) > 0 ? -1 : 1, x = Math.round(m.x), y = Math.round(m.y + Math.sin(m.fas * 0.3) * 4); ctx.fillStyle = '#f4f1ea'; ctx.fillRect(x - 1, y, 3, 1); ctx.fillStyle = '#5a5e66'; ctx.fillRect(x - 4, y + vinge, 3, 1); ctx.fillRect(x + 2, y + vinge, 3, 1); ctx.fillRect(x - 2, y + (vinge < 0 ? 0 : 1), 1, 1); ctx.fillRect(x + 2, y + (vinge < 0 ? 0 : 1), 1, 1); };
  const drawBat = (ctx, b) => { const x = Math.round(b.x), y = b.y; ctx.fillStyle = '#5a5e66'; ctx.fillRect(x - 3, y, 7, 1); ctx.fillStyle = '#f4f1ea'; ctx.fillRect(x - 2, y - 1, 5, 1); ctx.fillStyle = '#' + b.f.toString(16).padStart(6, '0'); for (let j = 0; j < 5; j++) ctx.fillRect(x, y - 2 - j, Math.max(1, 3 - (j >> 1)), 1); ctx.fillStyle = '#5a5e66'; ctx.fillRect(x - 1, y - 7, 1, 6); };
  // skummet vid strandkanten: vågorna rullar in och drar sig tillbaka
  const drawSkum = (ctx, cx) => {
    const u = (Math.sin(t * 0.9) + 1) / 2, y = S.KANT[0] - 2 + Math.round(u * 6);
    for (let x = Math.max(0, cx - 4); x < Math.min(TW, cx + VW + 4); x++) {
      if (x >= klippKant(y)) break;
      const v = Math.sin(x * 0.09 + t * 1.3) * 1.5 + Math.sin(x * 0.031 - t * 0.7) * 1.2, yy = Math.round(y + v);
      ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.fillRect(x, yy, 1, 1);
      if ((x + Math.floor(t * 4)) % 5 === 0) { ctx.fillStyle = 'rgba(255,255,255,.45)'; ctx.fillRect(x, yy + 2, 1, 1); }
    }
  };
  const drawSkylt = (ctx) => {
    const { x, y } = SKYLT, s = $t('SOLÖN'), w = textW(SMALL, s) + 16;
    ctx.fillStyle = '#7a5432'; ctx.fillRect(x - 1, y - 22, 3, 22);
    ctx.fillStyle = '#1e1a24'; ctx.fillRect(x - (w >> 1) - 1, y - 37, w + 2, 16); ctx.fillStyle = '#f4f1ea'; ctx.fillRect(x - (w >> 1), y - 36, w, 14);
    ctxText(ctx, SMALL, s, x - (w >> 1) + 12, y - 33, '#2a5aa8');
    ctx.fillStyle = '#f0b429'; ctx.fillRect(x - (w >> 1) + 4, y - 32, 5, 5); ctx.fillStyle = '#ffd860'; ctx.fillRect(x - (w >> 1) + 5, y - 31, 2, 2);   // en liten sol
  };
  const drawFiskare = (ctx) => {
    const f = fiskaren, flx = f.x - 34, fly = f.y - 18 + (f.napp > 0 ? Math.round(Math.sin(t * 20)) + 2 : Math.round(Math.sin(t * 2)));
    drawPerson(ctx, f.x, f.y, f.look, 'left', 5);
    ctx.fillStyle = '#5a3a24'; for (let k = 0; k < 18; k++) ctx.fillRect(Math.round(f.x - 4 - k), Math.round(f.y - 22 - k * 0.8), 1, 1);   // spöet
    ctx.fillStyle = 'rgba(240,240,240,.7)'; for (let k = 0; k <= 10; k++) { const u = k / 10; ctx.fillRect(Math.round(f.x - 22 + (flx - (f.x - 22)) * u), Math.round(f.y - 36 + (fly - (f.y - 36)) * u + Math.sin(u * Math.PI) * 3), 1, 1); }
    ctx.fillStyle = '#e04848'; ctx.fillRect(flx, fly, 2, 1); ctx.fillStyle = '#f4f1ea'; ctx.fillRect(flx, fly + 1, 2, 1);
    if (f.napp > 0) { ctx.fillStyle = 'rgba(255,255,255,.8)'; ctx.fillRect(flx - 3, fly + 2, 8, 1); }
    ctx.fillStyle = '#8a5a30'; ctx.fillRect(f.x + 6, f.y - 5, 7, 5); ctx.fillStyle = '#b07a48'; ctx.fillRect(f.x + 6, f.y - 5, 7, 1);   // korgen
  };

  function night() { const h = g.min / 60; return h >= 20 || h < 5.5; }
  function dusk() { const h = g.min / 60; return (h >= 18 && h < 20) || (h >= 5.5 && h < 7); }

  return {
    viewMax: { w: TW, h: TH },
    get worldX() { return walker.px; }, get worldY() { return walker.py; },
    get worldRide() { return null; },
    update(dt) {
      t += dt; banner += dt;
      VW = Math.max(384, Math.min(A.W || 384, TW)); VH = Math.max(160, Math.min(A.H || 216, TH));
      if (fade.phase === 1) { fade.a = Math.min(1, fade.a + dt * 2.6); if (fade.a >= 1) { fade.phase = 0; const cb = fade.cb; fade.cb = null; cb?.(); return; } }
      else if (fade.phase === 2) { fade.a = Math.max(0, fade.a - dt * 1.8); if (fade.a <= 0) fade.phase = 0; walker.update(dt); }
      else walker.update(dt);
      // första doppet om dagen
      const iv = iVattnet(walker.px, walker.py);
      if (iv && !badat) { badat = true; play('slide'); const h = g.glad?.(4, '', 'solobad', 4) || 0; toast(h ? $t`🌊 Plask! Vattnet är härligt. +${h} 😊` : $t('🌊 Plask! Vattnet är härligt.'), h ? 'good' : ''); }
      updLiv(dt);
      if (pets) try { pets.update(dt, walker.px, walker.py, (x, y) => walker.walkable(x, y)); } catch (e) { console.error('husdjuren på Solön:', e); pets = null; }
      const c = camTarget(); cam.x += (c.x - cam.x) * Math.min(1, dt * 8); cam.y += (c.y - cam.y) * Math.min(1, dt * 8);
    },
    draw(ctx) {
      ctx.setTransform(A.pxs, 0, 0, A.pxs, 0, 0);
      ctx.imageSmoothingEnabled = false;
      const N = night(), D = dusk();
      const cx = Math.round(cam.x), cy = Math.round(cam.y);
      ctx.drawImage(skyCanvas(VW, N, D), 0, Math.min(0, -cy - 86));
      ctx.drawImage(ground(), -cx, -cy);
      ctx.save(); ctx.translate(-cx, -cy);
      const syns = (x, m = 60) => x > cx - m && x < cx + VW + m;
      for (const b of batar) if (syns(b.x)) drawBat(ctx, b);
      drawSkum(ctx, cx);
      const items = [];
      items.push({ fy: FARJA.y + FARJA.h, draw: () => { ctx.drawImage(farjaBild(), FARJA.x, FARJA.y + Math.round(Math.sin(t * 1.2))); ringar(ctx, FARJA.x + FARJA.w / 2, FARJA.y + FARJA.h + Math.round(Math.sin(t * 1.2)), 50); } });
      items.push({ fy: FYR.y, draw: () => ctx.drawImage(fyrBild(N), FYR.x - 20, FYR.y - 118) });
      items.push({ fy: KIOSK.y, draw: () => ctx.drawImage(kioskBild(N), KIOSK.x, KIOSK.y - 66) });
      for (const st of STUGOR) if (syns(st.x + st.w / 2, st.w)) items.push({ fy: S.BASE - 1, draw: () => ctx.drawImage(stugaBild(st, N), st.x, S.BASE - st.h - 26) });
      for (const h of HANDDUKAR) if (syns(h.x)) items.push({ fy: h.y - 8, draw: () => drawHandduk(ctx, h) });
      for (const p of PARASOLLER) if (syns(p.x)) items.push({ fy: p.y, draw: () => drawParasoll(ctx, p) });
      items.push({ fy: SLOTT.y, draw: () => drawSlott(ctx) }, { fy: TORN.y, draw: () => drawTorn(ctx) }, { fy: NAT.y, draw: () => drawNat(ctx) }, { fy: SKYLT.y, draw: () => drawSkylt(ctx) });
      for (const b of BANKAR) if (syns(b.x)) items.push({ fy: b.y, draw: () => KIT.bench(ctx, b.x, b.y) });
      for (const o of flanor) if (syns(o.x)) items.push({ fy: o.y, draw: () => drawPerson(ctx, o.x, o.y, o.look, o.dir, o.vila <= 0 ? WALK_SEQ[Math.floor(t * 8 + o.x) % 4] : 0) });
      // solbadarna sitter på handduken: sittbilden (gjord för stolar) sänks och benen under handduken klipps bort
      for (const o of solare) if (syns(o.x)) items.push({ fy: o.y, draw: () => { ctx.save(); ctx.beginPath(); ctx.rect(o.x - 20, o.y - 60, 40, 60); ctx.clip(); drawPerson(ctx, o.x, o.y + 9, o.look, o.dir, 5); ctx.restore(); } });
      for (const o of barn) items.push({ fy: o.y, draw: () => drawPerson(ctx, o.x, o.y, o.look, o.dir, Math.sin(t * 3 + o.x) > 0.6 ? 6 : 5) });
      items.push({ fy: TORN.y + 0.5, draw: () => drawPerson(ctx, livraddare.x, livraddare.y, livraddare.look, 'down', 5) });
      const bl = boll();
      for (const o of volley) items.push({ fy: o.y, draw: () => { const hopp = bl.hopp === o; drawPerson(ctx, o.x, o.y - (hopp ? 5 : 0), o.look, o.dir, hopp ? 10 : 0); } });
      items.push({ fy: NAT.y + 1, draw: () => { ctx.fillStyle = 'rgba(40,30,20,.2)'; ctx.fillRect(Math.round(bl.x) - 1, NAT.y + 2, 3, 1); ctx.fillStyle = '#f4f1ea'; ctx.fillRect(Math.round(bl.x) - 1, Math.round(bl.y) - 1, 3, 3); ctx.fillStyle = '#f0b429'; ctx.fillRect(Math.round(bl.x), Math.round(bl.y) - 1, 1, 3); } });
      for (const b of badare) if (syns(b.x)) items.push({ fy: b.y, draw: () => { const y = b.y + Math.round(Math.sin(b.fas * 2) * 1); iVatten(ctx, b.x, y, 24, () => drawPerson(ctx, b.x, y, b.look, 'down', b.plask > 0 ? 10 : 0)); if (b.plask > 0.6) { ctx.fillStyle = 'rgba(255,255,255,.8)'; for (let k = 0; k < 5; k++) ctx.fillRect(b.x - 8 + k * 4, y - 26 - ((k * 7 + Math.floor(t * 10)) % 6), 1, 2); } } });
      items.push({ fy: FISKARE.y, draw: () => drawFiskare(ctx) });
      items.push(...folkDrawables(A, t));
      if (pets) for (const d of pets.drawables()) items.push({ fy: d.fy ?? d.y, draw: () => d.draw(ctx) });
      const jag = selfDrawable(A, walker, t, { folksHere: worldFolksHere(A).length, ride: null });
      if (iVattnet(walker.px, walker.py)) { const d0 = jag.draw, dj = djup(walker.py); jag.draw = (c2) => iVatten(c2, walker.px, walker.py, dj, () => d0(c2)); }
      items.push(jag);
      items.sort((a, b) => a.fy - b.fy).forEach((d) => d.draw(ctx));
      for (const m of masar) if (syns(m.x)) drawMas(ctx, m);
      ctx.restore();
      if (N || D) {
        ctx.fillStyle = N ? 'rgba(12,16,48,0.55)' : 'rgba(60,40,90,0.2)'; ctx.fillRect(0, 0, VW, VH);
        if (D) { ctx.fillStyle = 'rgba(255,140,80,0.12)'; ctx.fillRect(0, 0, VW, VH); }
        if (N) {
          // fyrens sken: en ljuskägla som sveper runt och ett varmt sken runt lanterninen
          ctx.save(); ctx.translate(-cx, -cy);
          const lx = FYR.x, ly = FYR.y - 104, v = t * 0.8, rx = Math.cos(v), ry = Math.sin(v) * 0.35;
          const gr = ctx.createRadialGradient(lx, ly, 2, lx, ly, 30); gr.addColorStop(0, 'rgba(255,240,170,.75)'); gr.addColorStop(1, 'rgba(255,240,170,0)');
          ctx.fillStyle = gr; ctx.fillRect(lx - 30, ly - 30, 60, 60);
          ctx.fillStyle = 'rgba(255,240,170,.16)'; ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(lx + rx * 520 - ry * 60, ly + ry * 520 + rx * 18); ctx.lineTo(lx + rx * 520 + ry * 60, ly + ry * 520 - rx * 18); ctx.closePath(); ctx.fill();
          for (const st of STUGOR) { const g2 = ctx.createRadialGradient(st.x + st.w / 2, S.BASE - 30, 2, st.x + st.w / 2, S.BASE - 30, 50); g2.addColorStop(0, 'rgba(255,200,110,.25)'); g2.addColorStop(1, 'rgba(255,200,110,0)'); ctx.fillStyle = g2; ctx.fillRect(st.x - 20, S.BASE - 80, st.w + 40, 100); }
          ctx.restore();
        }
      }
      ctx.save(); ctx.translate(-cx, -cy); talk.draw(ctx, { x0: cx, x1: cx + VW }); ctx.restore();
      if (banner < 4) { const a = banner < 0.4 ? banner / 0.4 : banner > 3.4 ? (4 - banner) / 0.6 : 1; ctx.globalAlpha = Math.max(0, a); const s = $t('SOLÖN'), s2 = $t('SOL, BAD OCH GLASS'), w = Math.max(textW(BIG, s, 2), textW(SMALL, s2)) + 20; ctx.fillStyle = 'rgba(20,18,26,.85)'; ctx.fillRect((VW - w) >> 1, 26, w, 30); ctxText(ctx, BIG, s, (VW - textW(BIG, s, 2)) >> 1, 30, '#ffd23f', 2); ctxText(ctx, SMALL, s2, (VW - textW(SMALL, s2)) >> 1, 48, '#f4f1ea'); ctx.globalAlpha = 1; }
      const s = hover && spotAt(hover.x + cx, hover.y + cy);
      if (s) { const w = textW(SMALL, s.label) + 10, x = Math.round(Math.max(2, Math.min(VW - w - 2, hover.x - w / 2))), y = Math.max(2, hover.y - 22); ctx.fillStyle = 'rgba(20,18,26,.9)'; ctx.fillRect(x, y, w, 11); ctxText(ctx, SMALL, s.label, x + 5, y + 3, '#ffd23f'); }
      if (fade.a > 0) { ctx.fillStyle = `rgba(10,10,16,${fade.a.toFixed(2)})`; ctx.fillRect(0, 0, VW, VH); }
    },
    down(sx, sy) {
      if (fade.phase === 1) return;
      hover = { x: sx, y: sy };
      const x = sx + cam.x, y = sy + cam.y;
      const fk = folkTapAt(A, x, y);   // 💛 en annan spelare: spelarkortet (bli vänner, SMS)
      if (fk) { openSpelarkort(A, fk); return; }
      const o = folkAt(x, y);
      if (o?.rad) { walker.walkTo(o.x + (walker.px < o.x ? -14 : 14), o.y + 2, () => talk.say(o.rad, () => ({ x: o.x, y: o.y - 34 }), 3.5, { voice: o.look })); return; }
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
      walkTo: (x, y) => { walker.walkTo(x, y); return walker.path.length; },
      walkable: (x, y) => walker.walkable(x, y),
      spot: (id) => { const s = spots().find((q) => q.id === id); return s ? { x: Math.round((s.r[0] + s.r[2]) / 2 - cam.x), y: Math.round((s.r[1] + s.r[3]) / 2 - cam.y) } : null; },
      act: (id) => { const s = spots().find((q) => q.id === id); if (!s) return false; s.act(); return true; },
      badar: () => iVattnet(walker.px, walker.py),
      prat: () => talk.text(),
      fade: () => fade.phase,
    },
  };
}
let GROUND = null;
const ground = () => (GROUND ||= paintGround());
