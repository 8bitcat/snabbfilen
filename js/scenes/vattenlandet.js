// 🌊 VATTENLANDET – stadsdel 7 i stadsdelsplanen (Carl 2026-11-18: "Vattenlandet: rutschkanor, vågpool, badvakt"). En egen
// plats som Djurparken: vattenbussen går hit från stadens hållplatser (city.js, raden VATTENLANDET). Utanför staketet:
// hållplatsen och ENTRÉHUSET – man betalar i kassan (ENTRE.PRIS, öppet 10–19) och vändkorset snurrar. Innanför:
//   • OMKLÄDNINGSRUMMET: byt om till badkläder (gratis) – krävs i vattnet. Figuren ritas i baddräkt tills man byter tillbaka.
//   • VÅGPOOLEN: trappan i sydväst tar en ner i vattnet (lage 'vag'): man simmar långsamt dit man klickar, guppar med
//     vågorna; var LUGN+VAGOR:e sekund tjuter sirenen och VÅGORNA KOMMER – då guppar allt, och den som är i vattnet får
//     extra lycka (en gång om dagen). Upp via trappan igen.
//   • RUTSCHTORNET: tre kanor (gul, blå virveln, röda tornadon) – man klättrar upp, åker längs banan (kanaPos) och
//     plaskar ner i landningspoolen; lycka efter kanans längd (en gång per kana och dag).
//   • BARNPOOLEN med svampfontänen (plaska), SOLSTOLARNA (ligg sex sekunder → energi + lycka), DUSCHEN (svalka),
//     KIOSKEN (glass, pommes, melon), BADVAKTEN i tornet (visslar om man klickar i vattnet utan att gå via trappan).
// Badgäster på promenaden, simmare som guppar, barn som hoppar i barnpoolen, någon som åker kana med jämna mellanrum,
// badvakten som vinkar; natten blånar, poolerna lyser underifrån och kiosken stänger. _debug-API för tools/vattenlandet-test.mjs.
import { createCityWalker } from '../city/walk.js';
import { selfDrawable, folkDrawables, folkTapAt, createSpeech, WALK_SEQ, synligRuta } from './walkable.js';
import { openSpelarkort } from '../core/vannerapp.js';
import { worldFolksHere } from '../net/world.js';
import { openModal, closeModal, toast, esc } from '../core/ui.js';
import { play } from '../core/sound.js';
import { SMALL, BIG, ctxText, textW } from '../core/floor-pix.js';
import { busStopById, BUS_STOPS } from '../city/map.js';
import { fmt } from '../game.js';
import { drawPerson, makeLook } from '../core/people.js';
import { skyCanvas } from '../landet/karta.js';
import { TW, TH, G, STAKET, VANDKORS, HALLPLATS, ENTRE, KASSA, OMKLADNING, KIOSK, TORN, BARNPOOL, SVAMP, VAGPOOL, LANDNING, BADVAKT, SOLSTOLAR, PARASOLLER, DUSCH, PALMER, BANKAR, PAPPERSKORGAR, SKYLT, BLOMMOR, KANOR, VAG, GLASS_PRIS, POMMES_PRIS, MELON_PRIS, iVagpool, iLandning, iBarnpool, hinder, kullCanvas, paintGround } from '../vattenlandet/karta.js';
import { ritaHus, ritaTorn, ritaKana, ritaKanaStolpar, kanaPos, ritaStaketbit, ritaVandkors, ritaSvamp, ritaBadvaktstorn, ritaDusch, ritaSolstol, ritaParasoll, ritaPalm, ritaBank, ritaPapperskorg, ritaBlommor, ritaBadring, ritaPlask, ritaVagor, ritaGlitter, ritaSkylt, ritaHallplats } from '../vattenlandet/deko.js';
import { $t } from '../core/i18n.js';

const BUSS = 10, GANG = 62, SIM = 34, SOLTID = 6, KLATTER = 1.6;
const PRAT = [
  $t('Röda tornadon snurrar två varv – jag skrek hela vägen!'), $t('Vågorna kommer snart. Hör du sirenen?'), $t('Pommesen här är krispigast i stan.'),
  $t('Badvakten Bosse visslade på mig för att jag sprang.'), $t('Barnpoolen är ljummen som ett badkar.'), $t('Jag har solat i två timmar. Glömde solkrämen.'),
];
const BADVAKT_SAY = [$t('Badvakten Bosse: "Gå lugnt på kanten – det är halt!"'), $t('Badvakten Bosse: "Vågorna kommer var minut. Håll i badringen!"'), $t('Badvakten Bosse: "Röda tornadon är för den som vågar."')];
const MENY = [
  { id: 'glass', icon: '🍦', namn: $t('Mjukglass med strössel'), pris: GLASS_PRIS, hunger: 8, glad: 1 },
  { id: 'pommes', icon: '🍟', namn: $t('Pommes med ketchup'), pris: POMMES_PRIS, hunger: 22, glad: 1 },
  { id: 'melon', icon: '🍉', namn: $t('Vattenmelon i skivor'), pris: MELON_PRIS, hunger: 10, energi: 6, glad: 1 },
];
const BADFARGER = ['#e04848', '#3a7bd5', '#f0c030', '#46a35a', '#e060a0', '#f07e24'];

export function makeVattenlandet(A) {
  const g = A.game;
  let VW = Math.max(384, Math.min(A.W || 384, TW)), VH = Math.max(160, Math.min(A.H || 216, TH));
  const from = A.vattenFran || null; A.vattenFran = null;
  let betalt = !!from?.betalt, lage = 'torr';   // torr | vag | kana | sol
  let bad = false;                                // i badkläder
  const walker = createCityWalker({ W: TW, H: TH, left: 2, right: TW - 2, top: G.TOP, bottom: G.BOTTOM, spawn: from?.badvakt ? [BADVAKT.x + 18, BADVAKT.y + 8] : [HALLPLATS.x + 16, HALLPLATS.y - 10] });
  walker.speed = GANG;
  walker.setObstacles(hinder('torr', betalt));
  walker.snapFree();
  const talk = createSpeech();
  let t = 0, hover = null, banner = 0, kana = null, sol = null, plask = [], vagT = 0, dusch = 0, sista = null, siren = 0;
  const fade = { a: 1, phase: 2, cb: null };
  const cam = { x: 0, y: 0 };
  const pos = () => (kana ? kanaXY() : { x: walker.px, y: walker.py });
  const camTarget = () => { const Sr = synligRuta(VH), P = pos(), u = Math.max(0, Math.min(1, (P.y - 180) / 300)), k = 0.5 + u * 0.4; return { x: Math.max(0, Math.min(TW - VW, P.x - VW / 2)), y: Math.max(0, Math.min(Math.max(0, TH - Sr.y1), P.y - Sr.y0 - Sr.h * k)) }; };
  Object.assign(cam, camTarget());
  const hour = () => g.min / 60;
  const night = () => hour() >= 21 || hour() < 5.5;
  const dusk = () => (hour() >= 19 && hour() < 21) || (hour() >= 5.5 && hour() < 7);
  const oppet = () => hour() >= ENTRE.OPPET[0] && hour() < ENTRE.OPPET[1];
  const rnd = (a, b) => a + Math.random() * (b - a);
  const vagor = () => (vagT % (VAG.LUGN + VAG.VAGOR)) >= VAG.LUGN;                       // vågorna går just nu
  const vagStyrka = () => { if (!vagor()) return 0; const u = ((vagT % (VAG.LUGN + VAG.VAGOR)) - VAG.LUGN) / VAG.VAGOR; return Math.sin(u * Math.PI); };
  const badLook = { ...A.avatar.look, top: 'tee', shirt: BADFARGER[(A.avatar.look.shirt || '').length % BADFARGER.length], bottom: 'shorts', pants: BADFARGER[((A.avatar.look.shirt || '').length + 2) % BADFARGER.length], hat: null, bag: null, phones: false, apron: false, shoes: A.avatar.look.skin || '#e0a97f' };
  if (!A.attract) { const h = g.glad?.(2, '', 'vattenlandet', 2); if (h) setTimeout(() => toast($t`🌊 Vattenlandet – kanor, vågor och sol! +${h} 😊`, 'good'), 900); }

  // ---------- folket ----------
  const folk = [0, 1, 2, 3].map((i) => ({ look: { ...makeLook(), kid: i === 2, hat: i === 0 ? 'cap' : null, top: 'tee', bottom: 'shorts', shirt: BADFARGER[i], pants: BADFARGER[(i + 3) % 6] }, x: 300 + i * 300, y: 400 + (i % 2) * 60, dir: i % 2 ? 'left' : 'right', fart: rnd(14, 22), vila: 0, rad: PRAT[i % PRAT.length] }));
  const simmare = [0, 1, 2].map((i) => ({ look: { ...makeLook(), top: 'tee', bottom: 'shorts', shirt: BADFARGER[(i + 1) % 6], hat: null }, x: VAGPOOL.x0 + 80 + i * 130, y: VAGPOOL.y0 + 60 + (i % 2) * 70, ring: i !== 1 ? [0xf0c030, 0xe04848, 0x46a35a][i] : null, f: i * 2 }));
  const barn = [0, 1].map((i) => ({ look: { ...makeLook(), kid: true, top: 'tee', bottom: 'shorts', shirt: BADFARGER[(i + 4) % 6], hat: null }, x: BARNPOOL.x - 40 + i * 70, y: BARNPOOL.y + 6 + i * 10, f: i * 1.7 }));
  const bosse = { look: { ...makeLook(), kid: false, top: 'tee', shirt: '#d8343c', bottom: 'shorts', pants: '#f4f1ea', hat: 'cap', cap: '#f4f1ea', glasses: true }, x: BADVAKT.x, y: BADVAKT.y - 62 };
  const kiosk = { look: { ...makeLook(), hat: 'cap', cap: '#d8343c', apron: true }, x: KIOSK.x + KIOSK.w + 12, y: KIOSK.y + 6 };   // kioskbiträdet står bredvid luckan
  const akare = { look: { ...makeLook(), kid: true, top: 'tee', bottom: 'shorts', shirt: '#46a35a' }, kana: 1, t: -4 };
  function updLiv(dt) {
    vagT += dt;
    const cyk = vagT % (VAG.LUGN + VAG.VAGOR);
    if (cyk >= VAG.LUGN && cyk < VAG.LUGN + dt + 0.001 && siren <= 0) { siren = 3; play('pling'); if (lage === 'vag') toast($t('🌊 VÅGORNA KOMMER! Håll i dig!'), 'good'); }
    if (siren > 0) siren -= dt;
    for (const o of folk) { if (o.vila > 0) { o.vila -= dt; continue; } o.x += (o.dir === 'right' ? 1 : -1) * o.fart * dt; if (o.x > 1420) { o.dir = 'left'; o.vila = rnd(1, 3); } if (o.x < STAKET + 40) { o.dir = 'right'; o.vila = rnd(1, 3); } if (Math.random() < dt * 0.04) o.vila = rnd(2, 6); }
    for (const s of simmare) { s.x += Math.sin(vagT * 0.3 + s.f) * 6 * dt; s.y += Math.cos(vagT * 0.2 + s.f) * 4 * dt; s.x = Math.max(VAGPOOL.x0 + 20, Math.min(VAGPOOL.x1 - 20, s.x)); s.y = Math.max(VAGPOOL.y0 + 30, Math.min(VAGPOOL.y1 - 20, s.y)); }
    akare.t += dt;
    if (akare.t > KANOR[akare.kana].tid + 1.2) { akare.t = -rnd(5, 10); akare.kana = (akare.kana + 1) % 3; }
    if (akare.t > KANOR[akare.kana].tid && akare.t - dt <= KANOR[akare.kana].tid) { const e = KANOR[akare.kana].bana.at(-1); plask.push({ x: e[0], y: e[1] + 6, t: 0 }); }
    for (const p of plask) p.t += dt; plask = plask.filter((p) => p.t < 0.8);
    if (dusch > 0) dusch -= dt;
    if (kana) { kana.t += dt; if (kana.t >= KLATTER + kana.K.tid) kanaKlar(); }
    if (sol) { sol.t += dt; if (sol.t >= SOLTID) solKlar(); }
    if (lage === 'vag') { const s = vagStyrka(); if (s > 0.2 && !walker.path.length && Math.random() < dt * 2) { walker.py = Math.max(VAGPOOL.y0 + 12, Math.min(VAGPOOL.y1 - 8, walker.py + (Math.random() - 0.5) * 4 * s)); } }
  }

  // ---------- entrén och omklädningen ----------
  function biljett() {
    if (betalt) { toast($t('🎟️ Du har redan betalat – vändkorset är öppet!')); return; }
    if (!oppet()) { toast($t`🌊 Vattenlandet har öppet ${ENTRE.OPPET[0]}–${ENTRE.OPPET[1]}. Kassan är stängd.`, 'bad'); return; }
    play('click');
    openModal($t('🎟️ Kassan'), `<p style="font-size:var(--f2);margin-top:0">${$t`Entré till Vattenlandet hela dagen: <b>${fmt(ENTRE.PRIS)}</b>. Kanorna, vågpoolen och solstolarna ingår. Du har ${fmt(g.money)}.`}</p>`, [
      { label: $t`🎟️ Betala ${fmt(ENTRE.PRIS)}`, cls: 'btn-go', onClick: () => { closeModal(); if (g.money < ENTRE.PRIS) { toast($t('Du har inte råd med entrén.'), 'bad'); return; } g.money -= ENTRE.PRIS; g.save(); play('coin'); slappIn(); toast($t('🎟️ Välkommen! Vändkorset snurrar – byt om i omklädningsrummet först.'), 'good'); } },
      { label: $t('Inte nu'), onClick: closeModal },
    ]);
  }
  function slappIn() { betalt = true; walker.setObstacles(hinder('torr', true)); }
  function vandkorset() { if (betalt) { walker.walkTo(STAKET + 16, (VANDKORS.y0 + VANDKORS.y1) / 2); return; } biljett(); }
  function omkladning() {
    play('door');
    bad = !bad; A.badklader = bad;
    toast(bad ? $t('🩱 Ombytt! Nu får du gå i vattnet – handduken ligger i skåpet.') : $t('👕 Ombytt till vanliga kläder igen.'), 'good');
  }
  // ---------- vågpoolen ----------
  function iVattnet() {
    if (!bad) { toast($t('🩱 Byt om i omklädningsrummet först!'), 'bad'); return; }
    lage = 'vag'; walker.stop(); walker.setObstacles(hinder('vag')); walker.px = (VAGPOOL.trappa.x0 + VAGPOOL.trappa.x1) / 2; walker.py = VAGPOOL.y1 - 18; walker.snapFree(); walker.speed = SIM;
    play('slide'); toast($t('🏊 Svalt och skönt! Klicka i poolen så simmar du dit – upp via trappan.'));
    const h = g.glad?.(1, $t('Dopp i vågpoolen'), 'vagpool', 2) || 0; if (h) setTimeout(() => toast($t`😊 Dopp i vågpoolen +${h}`, 'good'), 600);
  }
  function urVattnet() {
    lage = 'torr'; walker.stop(); walker.setObstacles(hinder('torr', betalt)); walker.px = (VAGPOOL.trappa.x0 + VAGPOOL.trappa.x1) / 2; walker.py = VAGPOOL.y1 + 12; walker.snapFree(); walker.speed = GANG;
    toast($t('🏊 Upp ur vattnet – det droppar om dig.'));
  }
  // ---------- kanorna ----------
  function valjKana() {
    if (!bad) { toast($t('🩱 Byt om i omklädningsrummet först!'), 'bad'); return; }
    play('click');
    const rader = KANOR.map((K) => `<div class="prow" style="grid-template-columns:auto 1fr auto"><span style="display:inline-block;width:18px;height:18px;border-radius:9px;background:#${K.c.toString(16).padStart(6, '0')}"></span><span class="nm">${esc(K.namn)}<br><small class="sp">${K.id === 'gul' ? $t('Kort och snäll') : K.id === 'bla' ? $t('En virvel på vägen') : $t('Lång, brant och två varv')}</small></span><button class="btn btn-small btn-go" data-kana="${K.id}">${$t('Åk')}</button></div>`).join('');
    const dlg = openModal($t('🛝 Rutschtornet'), `<p style="font-size:var(--f2);margin-top:0">${$t('Välj kana. Trapporna upp är branta – håll i räcket.')}</p><div class="plist">${rader}</div>`, [{ label: $t('Stäng'), onClick: closeModal }]);
    dlg.querySelectorAll('[data-kana]').forEach((b) => (b.onclick = () => { closeModal(); startKana(KANOR.find((K) => K.id === b.dataset.kana)); }));
  }
  function startKana(K) { lage = 'kana'; walker.stop(); kana = { K, t: 0 }; play('slide'); toast($t`🛝 ${K.namn}! Upp för trapporna …`); }
  const kanaXY = () => { if (!kana) return { x: TORN.x + 60, y: TORN.y }; if (kana.t < KLATTER) { const u = kana.t / KLATTER; return { x: TORN.x + 40 + u * 20, y: TORN.y - u * kana.K.hojd, klattrar: true }; } const p = kanaPos(kana.K, Math.min(1, (kana.t - KLATTER) / kana.K.tid)); return { x: p.x, y: p.y - 6, dx: p.dx }; };
  function kanaKlar() {
    const K = kana.K; kana = null; lage = 'torr';
    const e = K.bana.at(-1); plask.push({ x: e[0], y: e[1] + 6, t: 0 }); play('ok');
    walker.setObstacles(hinder('torr', betalt)); walker.px = (LANDNING.trappa.x0 + LANDNING.trappa.x1) / 2; walker.py = LANDNING.y1 + 12; walker.snapFree();
    const h = g.glad?.(K.glad, K.namn, 'kana-' + K.id, 1) || 0;
    sista = { typ: 'kana', kana: K.id };
    toast((K.id === 'rod' ? $t('🌪️ TVÅ VARV OCH PLASK! Hjärtat bultar.') : K.id === 'bla' ? $t('🌀 Virveln snurrade dig runt – plask!') : $t('🛝 Plask! Det kittlade i magen.')) + (h ? ` +${h} 😊` : ''), 'good');
  }
  // ---------- solstolen, barnpoolen, duschen, kiosken ----------
  function solstolen(i) {
    const [x, y] = SOLSTOLAR[i]; lage = 'sol'; walker.stop(); sol = { i, t: 0, x, y }; play('click'); toast($t('🌞 Du sträcker ut dig i solstolen. Ögonen går ihop …'));
  }
  function solKlar() {
    sol = null; lage = 'torr'; g.energy = Math.min(100, (g.energy || 0) + 8);
    const h = g.glad?.(1, $t('Sol på soldäcket'), 'soldack', 2) || 0; g.save();
    toast($t('🌞 Utvilad och varm om axlarna. +8 ⚡') + (h ? ` +${h} 😊` : ''), 'good');
  }
  function plaska() { plask.push({ x: BARNPOOL.x - 20, y: BARNPOOL.y + 20, t: 0 }); play('pling'); const h = g.glad?.(1, $t('Plask i barnpoolen'), 'barnpool', 1) || 0; toast($t('💦 Du plaskar med fötterna i barnpoolen – ljummet som ett bad.') + (h ? ` +${h} 😊` : ''), 'good'); }
  function duschen() { dusch = 3; play('slide'); g.energy = Math.min(100, (g.energy || 0) + 2); toast($t('🚿 Svalkande! Sanden rinner av. +2 ⚡'), 'good'); }
  function kiosken() {
    if (!oppet()) { toast($t('🍦 Kiosken är stängd för dagen.'), 'bad'); return; }
    play('click');
    const rader = MENY.map((v) => `<div class="prow" style="grid-template-columns:auto 1fr auto"><span style="font-size:22px">${v.icon}</span><span class="nm">${esc(v.namn)}<br><small class="sp">${fmt(v.pris)}</small></span><button class="btn btn-small btn-go" data-vara="${v.id}" ${g.money < v.pris ? 'disabled' : ''}>${$t('Köp')}</button></div>`).join('');
    const dlg = openModal($t('🍦 Kiosken'), `<p style="font-size:var(--f2);margin-top:0">${$t('Glass som droppar, pommes i strut och vattenmelon på fat.')}</p><div class="plist">${rader}</div>`, [{ label: $t('Stäng'), onClick: closeModal }]);
    dlg.querySelectorAll('[data-vara]').forEach((b) => (b.onclick = () => { const v = MENY.find((q) => q.id === b.dataset.vara); if (!v || g.money < v.pris) return; g.money -= v.pris; g.hunger = Math.min(100, (g.hunger || 0) + v.hunger); if (v.energi) g.energy = Math.min(100, (g.energy || 0) + v.energi); const h = g.glad?.(v.glad, $t('Kiosken i Vattenlandet'), 'vattenkiosk', 3) || 0; g.save(); closeModal(); play('coin'); toast($t`${v.icon} ${v.namn}!` + (h ? ` +${h} 😊` : ''), 'good'); }));
  }
  function badvakten() {
    play('knock');
    const prata = () => { const s = BADVAKT_SAY[Math.floor(Math.random() * BADVAKT_SAY.length)]; talk.say(s, () => ({ x: bosse.x, y: bosse.y - 34 }), 5, { voice: bosse.look }); };
    if (!A.jobReady?.('badvakt')) { prata(); return; }
    // 🛟 badvaktsjobbet (js/jobs/jobb-badvakt.js): Bosse tar rast och man sitter i tornet ett pass
    openModal($t('🛟 Badvaktstornet'), `<p style="font-size:var(--f2);margin-top:0">${$t('Bosse har suttit i tornet sedan morgonen och behöver en rast. Vill du ta ett pass? Livbojen till den som viftar, visslan åt den som springer.')}</p>`, [
      { label: $t('💼 Jobba ett pass'), cls: 'btn-go', onClick: () => { closeModal(); A.vattenFran = { betalt: true, badvakt: true, buss: from?.buss || '' }; play('door'); A.startJob('badvakt'); } },
      { label: $t('Bara prata'), onClick: () => { closeModal(); prata(); } },
    ]);
  }
  function vissla() { play('miss'); talk.say($t('Badvakten Bosse: "SPRING INTE – och i via trappan, tack!"'), () => ({ x: bosse.x, y: bosse.y - 34 }), 3, { voice: bosse.look }); }
  function bussen() {
    const hem = busStopById(from?.buss) || BUS_STOPS[0];
    openModal($t('🚌 Vattenbussen'), `<p style="font-size:var(--f2);margin-top:0">${$t`Bussen går tillbaka till <b>${$t(hem.name)}</b>. Biljetten kostar ${fmt(BUSS)}.`}</p>`, [
      { label: $t('🚌 Åk till stan'), cls: 'btn-go', onClick: () => { closeModal(); if (g.money < BUSS) { toast($t('Du har inte råd med bussen.'), 'bad'); return; } g.money -= BUSS; g.passTime(15); g.save(); play('door'); go(() => { A.cityPos = [hem.x + 6, hem.y - 2]; A.go('city'); }); } },
      { label: $t('Stanna kvar'), onClick: closeModal },
    ]);
  }
  function go(cb) { if (fade.phase === 1) return; fade.phase = 1; fade.cb = cb; }

  // ---------- platserna ----------
  const dorr = (H) => ({ r: [H.door.x0 - 4, H.y - 40, H.door.x1 + 4, H.y], go: [(H.door.x0 + H.door.x1) / 2, H.y + 8] });
  const spots = () => lage === 'vag' ? [
    { id: 'upp', r: [VAGPOOL.trappa.x0 - 6, VAGPOOL.y1 - 30, VAGPOOL.trappa.x1 + 6, VAGPOOL.y1 + 10], go: [(VAGPOOL.trappa.x0 + VAGPOOL.trappa.x1) / 2, VAGPOOL.y1 - 14], label: $t('TRAPPAN UPP'), act: urVattnet },
  ] : lage === 'torr' ? [
    { id: 'buss', r: [HALLPLATS.x - 12, HALLPLATS.y - 38, HALLPLATS.x + 14, HALLPLATS.y + 2], go: [HALLPLATS.x + 10, HALLPLATS.y - 8], label: $t('VATTENBUSSEN TILL STAN'), act: bussen },
    { id: 'kassa', r: [KASSA.lucka.x0 - 6, KASSA.y - 56, KASSA.lucka.x1 + 6, KASSA.y], go: [(KASSA.lucka.x0 + KASSA.lucka.x1) / 2, KASSA.y + 10], label: betalt ? $t('KASSAN') : $t`ENTRÉ · ${fmt(ENTRE.PRIS)}`, act: biljett },
    { id: 'vandkors', r: [STAKET - 12, VANDKORS.y0 - 34, STAKET + 12, VANDKORS.y1 + 6], go: [STAKET - 16, (VANDKORS.y0 + VANDKORS.y1) / 2], label: betalt ? $t('IN GENOM VÄNDKORSET') : $t('VÄNDKORSET – BETALA I KASSAN'), act: vandkorset },
    { id: 'skylt', r: [SKYLT.x - 50, SKYLT.y - 44, SKYLT.x + 50, SKYLT.y], go: [SKYLT.x + 10, SKYLT.y + 6], label: $t('VATTENLANDET'), act: () => toast($t('🌊 VATTENLANDET – betala i kassan, byt om, och sedan: kanorna, vågpoolen, barnpoolen, soldäcket och kiosken. Bussen hem står här.')) },
    ...(betalt ? [
      { id: 'omkladning', ...dorr(OMKLADNING), label: bad ? $t('OMKLÄDNINGSRUMMET – BYT TILLBAKA') : $t('OMKLÄDNINGSRUMMET – BYT OM'), act: omkladning },
      { id: 'trappa', r: [VAGPOOL.trappa.x0 - 8, VAGPOOL.y1 - 26, VAGPOOL.trappa.x1 + 8, VAGPOOL.y1 + 10], go: [(VAGPOOL.trappa.x0 + VAGPOOL.trappa.x1) / 2, VAGPOOL.y1 + 12], label: $t('VÅGPOOLEN – TRAPPAN NER'), act: iVattnet },
      { id: 'torn', r: [TORN.x + 20, TORN.y - TORN.h - 30, TORN.x + TORN.w - 10, TORN.y], go: [TORN.x + 50, TORN.y + 10], label: $t('RUTSCHTORNET – TRE KANOR'), act: valjKana },
      { id: 'barnpool', r: [BARNPOOL.x - BARNPOOL.rx, BARNPOOL.y - BARNPOOL.ry - 30, BARNPOOL.x + BARNPOOL.rx, BARNPOOL.y + BARNPOOL.ry], go: [BARNPOOL.x - 30, BARNPOOL.y + BARNPOOL.ry + 10], label: $t('BARNPOOLEN – PLASKA'), act: plaska },
      ...SOLSTOLAR.map(([x, y], i) => ({ id: 'sol' + i, r: [x - 16, y - 28, x + 16, y + 2], go: [x, y + 10], label: $t('SOLSTOLEN – VILA EN STUND'), act: () => solstolen(i) })),
      { id: 'dusch', r: [DUSCH.x - 18, DUSCH.y - 62, DUSCH.x + 8, DUSCH.y], go: [DUSCH.x - 8, DUSCH.y + 8], label: $t('DUSCHEN'), act: duschen },
      { id: 'kiosk', r: [KIOSK.lucka.x0 - 6, KIOSK.y - 50, KIOSK.lucka.x1 + 6, KIOSK.y], go: [(KIOSK.lucka.x0 + KIOSK.lucka.x1) / 2, KIOSK.y + 10], label: $t('KIOSKEN – GLASS OCH POMMES'), act: kiosken },
      { id: 'badvakt', r: [BADVAKT.x - 16, BADVAKT.y - 100, BADVAKT.x + 16, BADVAKT.y + 2], go: [BADVAKT.x + 18, BADVAKT.y + 6], label: $t('BADVAKTEN BOSSE'), act: badvakten },
    ] : []),
  ] : [];
  const spotAt = (x, y) => spots().find((s) => x >= s.r[0] && x <= s.r[2] && y >= s.r[1] && y <= s.r[3]);
  const folkAt = (x, y) => (lage === 'torr' ? folk.find((o) => Math.abs(o.x - x) < 7 && y < o.y + 2 && y > o.y - 30) : null);

  // ---------- ritning ----------
  const sken = (ctx, x, y, r, col) => { const gr = ctx.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, col); gr.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = gr; ctx.fillRect(x - r, y - r, r * 2, r * 2); };
  const gupp = (f) => Math.round(Math.sin(vagT * (2 + vagStyrka() * 3) + f) * (1 + vagStyrka() * 3));
  function ritaSjalvIVatten(ctx) {
    const L = bad ? badLook : A.avatar.look, dy = gupp(0);
    ctx.save(); ctx.beginPath(); ctx.rect(walker.px - 20, walker.py - 60, 40, 60 - 10 + dy); ctx.clip();
    drawPerson(ctx, walker.px, walker.py + 10 + dy, L, walker.dir, walker.path.length ? WALK_SEQ[Math.floor(t * 5) % 4] : 0);
    ctx.restore();
    ritaBadring(ctx, walker.px, walker.py + dy + 2, 0xf0c030);
  }

  return {
    viewMax: { w: TW, h: TH },
    get worldX() { return pos().x; }, get worldY() { return pos().y; },
    update(dt) {
      t += dt; banner += dt;
      VW = Math.max(384, Math.min(A.W || 384, TW)); VH = Math.max(160, Math.min(A.H || 216, TH));
      if (fade.phase === 1) { fade.a = Math.min(1, fade.a + dt * 2.6); if (fade.a >= 1) { fade.phase = 0; const cb = fade.cb; fade.cb = null; cb?.(); return; } }
      else if (fade.phase === 2) { fade.a = Math.max(0, fade.a - dt * 1.8); if (fade.a <= 0) fade.phase = 0; }
      if (lage === 'torr' || lage === 'vag') walker.update(dt);
      updLiv(dt);
      const c = camTarget(); cam.x += (c.x - cam.x) * Math.min(1, dt * 8); cam.y += (c.y - cam.y) * Math.min(1, dt * 8);
    },
    draw(ctx) {
      ctx.setTransform(A.pxs, 0, 0, A.pxs, 0, 0);
      ctx.imageSmoothingEnabled = false;
      const N = night(), D = dusk(), st = vagStyrka();
      const cx = Math.round(cam.x), cy = Math.round(cam.y);
      ctx.drawImage(skyCanvas(VW, N, D), 0, Math.min(0, -cy * 0.3));
      const bk = kullCanvas(N), off = -Math.round(cx * 0.5) % bk.width, by = Math.round(G.BASE - 20 - bk.height + 10 - cy * 0.9);
      for (let x = off; x < VW; x += bk.width) ctx.drawImage(bk, x, by);
      ctx.drawImage(ground(), -cx, -cy);
      ctx.save(); ctx.translate(-cx, -cy);
      ritaVagor(ctx, vagT, st);
      ritaGlitter(ctx, LANDNING.x0, LANDNING.y0, LANDNING.x1, LANDNING.y1, t);
      for (const K of KANOR) ritaKanaStolpar(ctx, K);
      const items = [];
      const syns = (x, m = 80) => x > cx - m && x < cx + VW + m;
      items.push({ fy: KASSA.y - 1, draw: () => ritaHus(ctx, KASSA, 'kassa', N) }, { fy: OMKLADNING.y - 1, draw: () => ritaHus(ctx, OMKLADNING, 'omkladning', N) }, { fy: KIOSK.y - 1, draw: () => ritaHus(ctx, KIOSK, 'kiosk', N) });
      items.push({ fy: TORN.y - 1, draw: () => ritaTorn(ctx, N) });
      items.push({ fy: kiosk.y, draw: () => drawPerson(ctx, kiosk.x, kiosk.y, kiosk.look, 'left', Math.sin(t * 2) > 0.9 ? 4 : 0) });
      for (let y = G.BASE; y < TH - 10; y += 24) if (y + 24 <= VANDKORS.y0 || y >= VANDKORS.y1) items.push({ fy: y + 24, draw: () => ritaStaketbit(ctx, y + 2, y + 24) });
      items.push({ fy: VANDKORS.y1 + 1, draw: () => ritaVandkors(ctx, betalt, t) });
      for (const K of KANOR) items.push({ fy: LANDNING.y1 - 1 + (K.id === 'rod' ? 0.2 : K.id === 'bla' ? 0.1 : 0), draw: () => ritaKana(ctx, K, N) });
      items.push({ fy: SVAMP.y, draw: () => ritaSvamp(ctx, t) }, { fy: BADVAKT.y, draw: () => { ritaBadvaktstorn(ctx, N); drawPerson(ctx, bosse.x, bosse.y, bosse.look, 'down', Math.sin(t * 1.2) > 0.85 ? 10 : 5); } });
      items.push({ fy: DUSCH.y, draw: () => ritaDusch(ctx, dusch > 0, t) });
      SOLSTOLAR.forEach(([x, y], i) => items.push({ fy: y, draw: () => ritaSolstol(ctx, x, y, i) }));
      PARASOLLER.forEach(([x, y], i) => items.push({ fy: y + 14, draw: () => ritaParasoll(ctx, x, y, i, t) }));
      for (const [x, y] of PALMER) if (syns(x)) items.push({ fy: y, draw: () => ritaPalm(ctx, x, y, y < 300 ? 0.9 : 1.1, t) });
      for (const [x, y] of BANKAR) items.push({ fy: y, draw: () => ritaBank(ctx, x, y) });
      for (const [x, y] of PAPPERSKORGAR) items.push({ fy: y, draw: () => ritaPapperskorg(ctx, x, y) });
      for (const [x, y] of BLOMMOR) items.push({ fy: y, draw: () => ritaBlommor(ctx, x, y) });
      items.push({ fy: SKYLT.y, draw: () => ritaSkylt(ctx) }, { fy: HALLPLATS.y, draw: () => ritaHallplats(ctx) });
      for (const s of simmare) items.push({ fy: s.y, draw: () => { const dy = gupp(s.f); ctx.save(); ctx.beginPath(); ctx.rect(s.x - 20, s.y - 60, 40, 50 + dy); ctx.clip(); drawPerson(ctx, s.x, s.y + 10 + dy, s.look, 'down', 0); ctx.restore(); if (s.ring) ritaBadring(ctx, s.x, s.y + dy + 2, s.ring); } });
      for (const b of barn) items.push({ fy: b.y, draw: () => { const hop = Math.max(0, Math.sin(t * 4 + b.f)) * 6; ctx.save(); ctx.beginPath(); ctx.rect(b.x - 20, b.y - 60, 40, 54); ctx.clip(); drawPerson(ctx, b.x, b.y + 6 - hop, b.look, 'down', hop > 4 ? 10 : 0); ctx.restore(); } });
      if (akare.t >= 0 && akare.t <= KANOR[akare.kana].tid) { const p = kanaPos(KANOR[akare.kana], akare.t / KANOR[akare.kana].tid); items.push({ fy: LANDNING.y1 + 0.5, draw: () => drawPerson(ctx, p.x, p.y - 6, akare.look, p.dx < 0 ? 'left' : 'right', 5) }); }
      for (const o of folk) if (syns(o.x)) items.push({ fy: o.y, draw: () => drawPerson(ctx, o.x, o.y, o.look, o.dir, o.vila <= 0 ? WALK_SEQ[Math.floor(t * 8.5 + o.x) % 4] : 0) });
      items.push(...folkDrawables(A, t));
      if (lage === 'torr') { const L0 = A.avatar.look; if (bad) A.avatar.look = badLook; const me = selfDrawable(A, walker, t, { folksHere: worldFolksHere(A).length }); A.avatar.look = L0; items.push({ fy: me.fy, draw: () => { if (bad) A.avatar.look = badLook; me.draw(ctx); A.avatar.look = L0; } }); }
      else if (lage === 'vag') items.push({ fy: walker.py + 0.1, draw: () => ritaSjalvIVatten(ctx) });
      else if (lage === 'sol' && sol) items.push({ fy: sol.y + 0.5, draw: () => drawPerson(ctx, sol.x - 2, sol.y - 6, bad ? badLook : A.avatar.look, 'right', 5) });
      else if (lage === 'kana' && kana) { const p = kanaXY(); items.push({ fy: p.klattrar ? TORN.y - 0.5 : LANDNING.y1 + 0.6, draw: () => drawPerson(ctx, p.x, p.y, bad ? badLook : A.avatar.look, p.klattrar ? 'up' : (p.dx < 0 ? 'left' : 'right'), p.klattrar ? WALK_SEQ[Math.floor(t * 6) % 4] : 5) }); }
      for (const p of plask) items.push({ fy: p.y + 1, draw: () => ritaPlask(ctx, p.x, p.y, p.t / 0.8) });
      items.sort((a, b) => a.fy - b.fy).forEach((d) => d.draw(ctx));
      ctx.restore();
      if (N || D) {
        ctx.fillStyle = N ? 'rgba(14,20,60,0.5)' : 'rgba(120,70,120,0.18)'; ctx.fillRect(0, 0, VW, VH);
        if (D) { ctx.fillStyle = 'rgba(255,150,90,0.14)'; ctx.fillRect(0, 0, VW, VH); }
        ctx.save(); ctx.translate(-cx, -cy); ctx.globalCompositeOperation = 'lighter';
        for (const H of [KASSA, OMKLADNING, KIOSK]) sken(ctx, H.x + H.w / 2, H.y - 26, 50, `rgba(255,210,130,${N ? 0.28 : 0.12})`);
        sken(ctx, (VAGPOOL.x0 + VAGPOOL.x1) / 2, (VAGPOOL.y0 + VAGPOOL.y1) / 2, 200, `rgba(90,180,255,${N ? 0.26 : 0.08})`);
        sken(ctx, (LANDNING.x0 + LANDNING.x1) / 2, (LANDNING.y0 + LANDNING.y1) / 2, 120, `rgba(90,180,255,${N ? 0.26 : 0.08})`);
        sken(ctx, BARNPOOL.x, BARNPOOL.y, 90, `rgba(120,200,255,${N ? 0.24 : 0.08})`);
        for (const K of KANOR) for (const [x, y] of K.bana) sken(ctx, x, y - 4, 16, `rgba(255,230,160,${N ? 0.2 : 0.05})`);
        ctx.globalCompositeOperation = 'source-over'; ctx.restore();
      }
      ctx.save(); ctx.translate(-cx, -cy); talk.draw(ctx, { x0: cx, x1: cx + VW }); ctx.restore();
      if (siren > 0 && (Math.floor(t * 4) % 2 === 0)) { const s = $t('VÅGORNA KOMMER!'); const w = textW(BIG, s) + 14; ctx.fillStyle = 'rgba(20,60,120,.85)'; ctx.fillRect((VW - w) >> 1, 22, w, 16); ctxText(ctx, BIG, s, (VW - textW(BIG, s)) >> 1, 26, '#ffffff'); }
      if (kana) { const s = kana.t < KLATTER ? $t('KLÄTTRAR …') : $t`${kana.K.namn.toUpperCase()} · ${Math.max(0, kana.K.tid - (kana.t - KLATTER)).toFixed(1)} s`; ctx.fillStyle = 'rgba(20,18,26,.85)'; ctx.fillRect(8, 20, textW(SMALL, s) + 10, 11); ctxText(ctx, SMALL, s, 13, 23, '#f4f1ea'); }
      if (sol) { const s = $t('ZZZ … SOLAR'); ctx.fillStyle = 'rgba(20,18,26,.85)'; ctx.fillRect(8, 20, textW(SMALL, s) + 10, 11); ctxText(ctx, SMALL, s, 13, 23, '#ffd23f'); }
      if (banner < 4) { const a = banner < 0.4 ? banner / 0.4 : banner > 3.4 ? (4 - banner) / 0.6 : 1; ctx.globalAlpha = Math.max(0, a); const s = $t('VATTENLANDET'), s2 = $t('KANOR, VÅGPOOL, SOLDÄCK OCH GLASS'), w = Math.max(textW(BIG, s, 2), textW(SMALL, s2)) + 20; ctx.fillStyle = 'rgba(20,18,26,.85)'; ctx.fillRect((VW - w) >> 1, 26, w, 30); ctxText(ctx, BIG, s, (VW - textW(BIG, s, 2)) >> 1, 30, '#7ad0ff', 2); ctxText(ctx, SMALL, s2, (VW - textW(SMALL, s2)) >> 1, 48, '#f4f1ea'); ctx.globalAlpha = 1; }
      const s = hover && spotAt(hover.x + cx, hover.y + cy);
      if (s) { const w = textW(SMALL, s.label) + 10, x = Math.round(Math.max(2, Math.min(VW - w - 2, hover.x - w / 2))), y = Math.max(2, hover.y - 22); ctx.fillStyle = 'rgba(20,18,26,.9)'; ctx.fillRect(x, y, w, 11); ctxText(ctx, SMALL, s.label, x + 5, y + 3, '#ffd23f'); }
      if (fade.a > 0) { ctx.fillStyle = `rgba(10,10,16,${fade.a.toFixed(2)})`; ctx.fillRect(0, 0, VW, VH); }
    },
    down(sx, sy) {
      if (fade.phase === 1 || kana || sol) return;
      hover = { x: sx, y: sy };
      const x = sx + cam.x, y = sy + cam.y;
      if (lage === 'torr') {
        const fk = folkTapAt(A, x, y); if (fk) { openSpelarkort(A, fk); return; }
        const o = folkAt(x, y); if (o) { walker.walkTo(o.x + (walker.px < o.x ? -14 : 14), o.y + 2, () => { o.vila = Math.max(o.vila, 4); talk.say(o.rad, () => ({ x: o.x, y: o.y - 34 }), 3.5, { voice: o.look }); }); return; }
      }
      const s = spotAt(x, y);
      if (s) { walker.walkTo(s.go[0], s.go[1], s.act); return; }
      if (lage === 'torr' && betalt && (iVagpool(x, y) || iLandning(x, y) || iBarnpool(x, y))) { vissla(); return; }
      walker.walkTo(x, y);
    },
    move(sx, sy) { hover = { x: sx, y: sy }; },
    exit() { talk.clear(); },
    _debug: {
      pos: () => pos(),
      cam: () => ({ ...cam }),
      teleport: (x, y) => { walker.px = x; walker.py = y; walker.stop(); walker.snapFree(); Object.assign(cam, camTarget()); },
      walkable: (x, y) => walker.walkable(x, y),
      spots: () => spots().map((s) => s.id),
      act: (id) => { const s = spots().find((q) => q.id === id); if (!s) return false; s.act(); return true; },
      prat: () => talk.text(),
      fade: () => fade.phase,
      lage: () => lage,
      betalt: () => betalt,
      bad: () => bad,
      oppet: () => oppet(),
      kana: () => (kana ? { id: kana.K.id, t: +kana.t.toFixed(1) } : null),
      sol: () => (sol ? { i: sol.i, t: +sol.t.toFixed(1) } : null),
      vagor: () => vagor(),
      vagT: (s) => { if (s != null) vagT = s; return vagT; },
      plask: () => plask.length,
      tick: (sec) => { for (let k = 0; k < sec * 30; k++) updLiv(1 / 30); },
      sista: () => sista,
      akare: () => ({ kana: akare.kana, t: +akare.t.toFixed(1) }),
    },
  };
}
// marken målas en gång
let GROUND = null;
const ground = () => (GROUND ||= paintGround());
