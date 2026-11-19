// ⛷️ SKIDBACKEN – stadsdel 6 i stadsdelsplanen (Carl 2026-11-18: "Skidbacken: lift, slalom, pulka, värmestuga"). En egen
// plats som Djurparken: skidbussen går hit från stadens hållplatser (city.js, raden SKIDBACKEN). Nere i DALEN: hållplatsen,
// VÄRMESTUGAN (varm choklad och våfflor), SKIDUTHYRNINGEN (skidor SKID_HYRA, pulka PULKA_HYRA – gäller besöket), liftens
// dalstation, snögubben, eldstaden. LIFTEN (gratis) tar en upp till TOPPEN: toppstugan med skidpatrullen, utsiktsskylten
// och starterna:
//   • SLALOM: man åker nerför backen med skidorna på, styr med klick (vänster/höger om figuren), piltangenter eller A/D,
//     och ska passera mellan portarnas flaggor – nio portar, tiden tas. Kör man in i en flagga ramlar man och tappar fart.
//     Alla nio ger mest lycka. Nere i dalen står man igen.
//   • PULKA: man sätter sig på pulkan och susar ner – över guppen hoppar den (WIIIE!). Lycka i dalen.
//   • liften går också ner igen om man hellre vill det.
// Åkare på backen, barn på pulkor, liftstolar med folk, snökanoner som sprutar, rök ur värmestugans skorsten; kvällen
// blånar och stugorna tänds. _debug-API för tools/skidbacken-test.mjs.
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
import { skyCanvas } from '../landet/karta.js';
import { propKit } from '../city/props.js';
import { TW, TH, S, HALLPLATS, VARMESTUGA, UTHYRNING, TOPPSTUGA, LIFT, LIFTKO, SLALOM, PULKA, TOPPSKYLT, SNOGUBBE, ELD, BANKAR, SNOKANONER, GRANAR, STENAR, SKYLT, SKID_HYRA, PULKA_HYRA, hinder, fjallCanvas, paintGround } from '../skidbacken/karta.js';
import { ritaStuga, ritaRok, ritaLiftstation, ritaLiftstolpe, ritaLina, ritaStol, ritaPort, ritaSnogubbe, ritaEld, ritaSnokanon, ritaGran, ritaSten, ritaToppskylt, ritaSkylt, ritaHallplats, ritaSkidor, ritaPulka, ritaSnorok } from '../skidbacken/deko.js';
import { $t } from '../core/i18n.js';

const BUSS = 10, GANG = 62;
const DALPRAT = [
  $t('Liften är gratis i dag – tack vare KBK:s supporterklubb!'), $t('Min pulka är snabbast i hela backen.'), $t('Våfflorna i värmestugan har hjortronsylt.'),
  $t('Nio portar tog jag förra gången. Nästan.'), $t('Snökanonerna går hela natten när det är kallt.'), $t('Skidpatrullen uppe på toppen har varm saft.'),
];
const MENY = [
  { id: 'choklad', icon: '🍫', namn: $t('Varm choklad med grädde'), pris: 20, hunger: 8, energi: 10, glad: 1 },
  { id: 'vaffla', icon: '🧇', namn: $t('Våffla med hjortronsylt'), pris: 30, hunger: 22, glad: 2 },
  { id: 'korv', icon: '🌭', namn: $t('Grillad korv vid elden'), pris: 25, hunger: 24, glad: 1 },
];

export function makeSkidbacken(A) {
  const g = A.game;
  let VW = Math.max(384, Math.min(A.W || 384, TW)), VH = Math.max(160, Math.min(A.H || 216, TH));
  const from = A.skidFran || null; A.skidFran = null;
  let lage = 'dal';   // dal | lift | topp | slalom | pulka
  const walker = createCityWalker({ W: TW, H: TH, left: 2, right: TW - 2, top: S.TOP, bottom: S.BOTTOM, spawn: from?.lift ? [LIFTKO.x, LIFTKO.y] : [HALLPLATS.x + 16, HALLPLATS.y - 10] });
  walker.speed = GANG;
  walker.setObstacles(hinder('dal'));
  walker.snapFree();
  const talk = createSpeech();
  let t = 0, hover = null, banner = 0, lift = null, ski = null, pulka = null, styr = 0, styrT = 0, sista = null;
  const har = { skidor: !!g.egnaSkidor, pulka: !!g.egenPulka };   // egna från sportaffären på Arenatorget räknas som hyrda för alltid
  const fade = { a: 1, phase: 2, cb: null };
  const cam = { x: 0, y: 0 };
  const pos = () => (lage === 'lift' ? liftPos() : lage === 'slalom' ? { x: ski.x, y: ski.y } : lage === 'pulka' ? { x: pulka.x, y: pulka.y } : { x: walker.px, y: walker.py });
  const camTarget = () => { const Sr = synligRuta(VH), P = pos(), k = lage === 'dal' ? 0.86 : lage === 'topp' ? 0.75 : 0.45; return { x: Math.max(0, Math.min(TW - VW, P.x - VW / 2)), y: Math.max(0, Math.min(Math.max(0, TH - Sr.y1), P.y - Sr.y0 - Sr.h * k)) }; };
  Object.assign(cam, camTarget());
  const hour = () => g.min / 60;
  const night = () => hour() >= 20 || hour() < 5.5;
  const dusk = () => (hour() >= 18 && hour() < 20) || (hour() >= 5.5 && hour() < 7);
  const rnd = (a, b) => a + Math.random() * (b - a);
  if (!A.attract) { const h = g.glad?.(2, '', 'skidbacken', 2); if (h) setTimeout(() => toast($t`⛷️ Skidbacken – snö, lift och varm choklad! +${h} 😊`, 'good'), 900); }

  // ---------- folket ----------
  const folk = [0, 1, 2, 3].map((i) => ({ look: { ...makeLook(), kid: i === 1, hat: 'beanie' }, x: 300 + i * 320, y: 480 + (i % 2) * 24, dir: i % 2 ? 'left' : 'right', fart: rnd(14, 22), vila: 0, rad: DALPRAT[i % DALPRAT.length] }));
  const akare = [0, 1, 2].map((i) => ({ look: { ...makeLook(), hat: 'beanie' }, x: SLALOM.start.x + (i - 1) * 50, y: 160 + i * 90, v: rnd(50, 70), sv: rnd(0.8, 1.4), f: i }));
  const pulkabarn = [0, 1].map((i) => ({ look: { ...makeLook(), kid: true, hat: 'beanie' }, x: PULKA.x0 + 120 + i * 180, y: 200 + i * 100, v: rnd(60, 80) }));
  const patrull = { look: { ...makeLook(), shirt: '#d8343c', hat: 'beanie', kid: false }, x: TOPPSTUGA.x - 20, y: TOPPSTUGA.y + 8 };
  const stolar = Array.from({ length: LIFT.stolar }, (_, i) => ({ u: i / LIFT.stolar, upp: true, rider: i % 2 ? makeLook() : null }));
  const liftPos = () => { if (!lift) return { x: LIFT.x0, y: LIFT.y0 }; const u = lift.dir > 0 ? lift.t / LIFT.tid : 1 - lift.t / LIFT.tid; return { x: LIFT.x0 + (LIFT.x1 - LIFT.x0) * u, y: LIFT.y0 + (LIFT.y1 - LIFT.y0) * u }; };
  function updLiv(dt) {
    for (const o of folk) { if (o.vila > 0) { o.vila -= dt; continue; } o.x += (o.dir === 'right' ? 1 : -1) * o.fart * dt; if (o.x > 1460) { o.dir = 'left'; o.vila = rnd(1, 3); } if (o.x < 180) { o.dir = 'right'; o.vila = rnd(1, 3); } if (Math.random() < dt * 0.04) o.vila = rnd(2, 6); }
    for (const a of akare) { a.y += a.v * dt; a.x = SLALOM.start.x + Math.sin(a.y / 40 * a.sv + a.f) * 90; if (a.y > SLALOM.mal) { a.y = 150; a.v = rnd(50, 70); } }
    for (const b of pulkabarn) { b.y += b.v * dt; if (b.y > PULKA.mal) { b.y = 160; } }
    for (const s of stolar) { s.u += dt / (LIFT.tid * 2); if (s.u >= 1) s.u -= 1; }
    if (lift) { lift.t += dt; if (lift.t >= LIFT.tid) liftKlar(); }
    if (styrT > 0) { styrT -= dt; if (styrT <= 0) styr = 0; }
    if (ski) updSki(dt);
    if (pulka) updPulka(dt);
  }

  // ---------- liften ----------
  function liftUpp() { if (lift) return; lift = { t: 0, dir: 1 }; lage = 'lift'; walker.stop(); play('slide'); toast($t('🚡 Stolen svänger ut över backen. Håll i bygeln!')); }
  // 🚡 liftvärdsjobbet (js/jobs/jobb-lift.js): Lasse i luckan behöver rast – jobba ett pass eller åk upp
  function liften() {
    if (lift) return;
    if (!A.jobReady?.('liftvard')) { liftUpp(); return; }
    play('click');
    openModal($t('🚡 Liften'), `<p style="font-size:var(--f2);margin-top:0">${$t('Liftvärd Lasse behöver en rast i luckan. Vill du jobba ett pass – kolla liftkorten och hjälpa barnen upp i stolen – eller åka upp till toppen?')}</p>`, [
      { label: $t('🚡 Åk upp'), cls: 'btn-go', onClick: () => { closeModal(); liftUpp(); } },
      { label: $t('💼 Jobba ett pass'), onClick: () => { closeModal(); A.skidFran = { buss: from?.buss || '', lift: true }; play('door'); A.startJob('liftvard'); } },
    ]);
  }
  function liftNer() { if (lift) return; lift = { t: 0, dir: -1 }; lage = 'lift'; walker.stop(); play('slide'); }
  function liftKlar() {
    const dir = lift.dir; lift = null;
    if (dir > 0) { lage = 'topp'; walker.setObstacles(hinder('topp')); walker.px = LIFT.x1 - 30; walker.py = S.TOPP[1] - 10; walker.snapFree(); const h = g.glad?.(2, $t('Utsikten från toppen'), 'skidtopp', 2) || 0; toast($t('🏔️ Toppen! Hela Pixelstaden ligger där nere.') + (h ? ` +${h} 😊` : ''), 'good'); }
    else { lage = 'dal'; walker.setObstacles(hinder('dal')); walker.px = LIFTKO.x; walker.py = LIFTKO.y; walker.snapFree(); }
  }
  // ---------- slalom ----------
  function startSlalom() {
    if (!har.skidor) { toast($t('⛷️ Du behöver skidor – hyr i skiduthyrningen nere i dalen.'), 'bad'); return; }
    lage = 'slalom'; walker.stop(); styr = 0;
    ski = { x: SLALOM.start.x, y: SLALOM.start.y, v: 28, t: 0, portar: 0, miss: 0, nasta: 0, fall: 0, text: '', textT: 0, mal: null };
    play('slide'); toast($t('⛷️ Kör! Klicka dit du vill svänga (eller piltangenterna, A/D) – mellan flaggorna!'));
  }
  const SKI_FART = 56, SKI_SVANG = 120;   // px/s nerför som mest, px/s i sidled
  function updSki(dt) {
    const k = ski;
    k.t += dt; if (k.textT > 0) k.textT -= dt;
    if (k.fall > 0) { k.fall -= dt; k.v = Math.max(16, k.v - dt * 50); }
    else k.v = Math.min(SKI_FART, k.v + dt * 14);
    k.y += k.v * dt;
    if (styr) k.x += styr * SKI_SVANG * dt;                                                                     // tangent eller hållet klick
    else if (k.mal != null) { const d = k.mal - k.x, s = Math.min(Math.abs(d), SKI_SVANG * dt); k.x += Math.sign(d) * s; if (Math.abs(d) <= s) k.mal = null; }   // klicket: åk dit
    k.x = Math.max(SLALOM.x0 + 12, Math.min(SLALOM.x1 - 12, k.x));
    const port = SLALOM.portar[k.nasta];
    if (port && k.y >= port.y) {
      const dx = Math.abs(k.x - port.x);
      if (dx < 12) { k.portar++; k.text = $t('PORT!'); k.textT = 0.8; play('ok'); }
      else if (dx < 17) { k.miss++; k.fall = 1.0; k.text = $t('AJ!'); k.textT = 1; play('miss'); }
      else { k.miss++; k.text = $t('MISSAD'); k.textT = 0.8; play('miss'); }
      k.nasta++;
    }
    if (k.y >= SLALOM.mal) slalomKlar();
  }
  function slalomKlar() {
    const k = ski; ski = null; styr = 0;
    lage = 'dal'; walker.setObstacles(hinder('dal')); walker.px = SLALOM.start.x; walker.py = S.DAL[0] + 14; walker.snapFree();
    const tid = k.t.toFixed(1);
    const h = k.portar >= 9 ? g.glad?.(3, $t('Alla nio portarna'), 'slalom', 3) || 0 : k.portar >= 6 ? g.glad?.(2, $t('Slalom i Skidbacken'), 'slalom', 3) || 0 : g.glad?.(1, $t('Slalom i Skidbacken'), 'slalom', 3) || 0;
    sista = { typ: 'slalom', portar: k.portar, tid: +tid };
    toast((k.portar >= 9 ? $t`⛷️ ALLA NIO PORTARNA på ${tid} s! Skidpatrullen applåderar.` : $t`⛷️ ${k.portar} av 9 portar på ${tid} s.`) + (h ? ` +${h} 😊` : ''), k.portar >= 6 ? 'good' : '');
    play(k.portar >= 9 ? 'fanfare' : 'ok');
  }
  // ---------- pulkan ----------
  function startPulka() {
    if (!har.pulka) { toast($t('🛷 Du behöver en pulka – hyr i skiduthyrningen nere i dalen.'), 'bad'); return; }
    lage = 'pulka'; walker.stop();
    pulka = { x: PULKA.start.x, y: PULKA.start.y, v: 50, hopp: 0, text: '', textT: 0, gupp: 0 };
    play('slide'); toast($t('🛷 Håll i dig – pulkan går!'));
  }
  function updPulka(dt) {
    const p = pulka;
    p.v = Math.min(92, p.v + dt * 25); p.y += p.v * dt; p.x = PULKA.start.x + Math.sin(p.y / 50) * 30;
    if (p.textT > 0) p.textT -= dt;
    if (p.hopp > 0) p.hopp -= dt;
    const gy = PULKA.gupp[p.gupp];
    if (gy != null && p.y >= gy) { p.gupp++; p.hopp = 0.5; p.text = [$t('WIIIE!'), $t('HOPP!'), $t('OJ!'), $t('JAAA!')][p.gupp % 4]; p.textT = 0.7; play('pling'); }
    if (p.y >= PULKA.mal) pulkaKlar();
  }
  function pulkaKlar() {
    pulka = null; lage = 'dal'; walker.setObstacles(hinder('dal')); walker.px = PULKA.start.x; walker.py = S.DAL[0] + 14; walker.snapFree();
    const h = g.glad?.(2, $t('Pulkaåk'), 'pulka', 2) || 0;
    sista = { typ: 'pulka' };
    toast($t('🛷 Pulkan stannar i en snödriva. Snö i kragen – och du skrattar!') + (h ? ` +${h} 😊` : ''), 'good');
  }
  // ---------- stugorna ----------
  function uthyrningen() {
    play('click');
    const egna = (id) => (id === 'skidor' ? !!g.egnaSkidor : !!g.egenPulka);
    const rad = (id, ik, namn, pris, ok) => `<div class="prow" style="grid-template-columns:auto 1fr auto"><span style="font-size:22px">${ik}</span><span class="nm">${esc(namn)}<br><small class="sp">${egna(id) ? $t('Dina egna – gratis') : ok ? $t('Hyrda – gäller hela besöket') : fmt(pris)}</small></span><button class="btn btn-small ${ok ? '' : 'btn-go'}" data-hyr="${id}" ${ok || g.money < pris ? 'disabled' : ''}>${egna(id) ? $t('Egna') : ok ? $t('Har') : $t('Hyr')}</button></div>`;
    const dlg = openModal($t('🎿 Skiduthyrningen'), `<p style="font-size:var(--f2);margin-top:0">${$t('Skidor till slalombacken och pulkor till pulkabacken. Liften är gratis. Hyran gäller tills du åker hem.')}</p><div class="plist">${rad('skidor', '🎿', $t('Skidor och stavar'), SKID_HYRA, har.skidor)}${rad('pulka', '🛷', $t('Pulka'), PULKA_HYRA, har.pulka)}</div><p style="font-size:var(--f2)">💰 <b>${fmt(g.money)}</b></p>`, [{ label: $t('Stäng'), onClick: closeModal }]);
    dlg.querySelectorAll('[data-hyr]').forEach((b) => (b.onclick = () => { const id = b.dataset.hyr, pris = id === 'skidor' ? SKID_HYRA : PULKA_HYRA; if (har[id] || g.money < pris) return; g.money -= pris; har[id] = true; g.save(); closeModal(); play('coin'); toast(id === 'skidor' ? $t('🎿 Skidorna sitter! Ta liften upp och åk slalom.') : $t('🛷 Pulkan är din för dagen! Ta liften upp till pulkabacken.'), 'good'); }));
  }
  function varmestugan() {
    play('click');
    const rader = MENY.map((v) => `<div class="prow" style="grid-template-columns:auto 1fr auto"><span style="font-size:22px">${v.icon}</span><span class="nm">${esc(v.namn)}<br><small class="sp">${fmt(v.pris)}</small></span><button class="btn btn-small btn-go" data-vara="${v.id}" ${g.money < v.pris ? 'disabled' : ''}>${$t('Köp')}</button></div>`).join('');
    const dlg = openModal($t('🔥 Värmestugan'), `<p style="font-size:var(--f2);margin-top:0">${$t('Brasan sprakar, vantarna torkar på elementet. Varm choklad, våfflor och grillad korv.')}</p><div class="plist">${rader}</div>`, [{ label: $t('Stäng'), onClick: closeModal }]);
    dlg.querySelectorAll('[data-vara]').forEach((b) => (b.onclick = () => { const v = MENY.find((q) => q.id === b.dataset.vara); if (!v || g.money < v.pris) return; g.money -= v.pris; g.hunger = Math.min(100, (g.hunger || 0) + v.hunger); if (v.energi) g.energy = Math.min(100, (g.energy || 0) + v.energi); const h = g.glad?.(v.glad, $t('Fika i värmestugan'), 'varmestuga', 3) || 0; g.save(); closeModal(); play('coin'); toast($t`${v.icon} ${v.namn}! Värmen sprider sig.` + (h ? ` +${h} 😊` : ''), 'good'); }));
  }
  function bussen() {
    const hem = busStopById(from?.buss) || BUS_STOPS[0];
    openModal($t('🚌 Skidbussen'), `<p style="font-size:var(--f2);margin-top:0">${$t`Bussen går tillbaka till <b>${$t(hem.name)}</b>. Biljetten kostar ${fmt(BUSS)}.`}</p>`, [
      { label: $t('🚌 Åk till stan'), cls: 'btn-go', onClick: () => { closeModal(); if (g.money < BUSS) { toast($t('Du har inte råd med bussen.'), 'bad'); return; } g.money -= BUSS; g.passTime(15); g.save(); play('door'); go(() => { A.cityPos = [hem.x + 6, hem.y - 2]; A.go('city'); }); } },
      { label: $t('Stanna kvar'), onClick: closeModal },
    ]);
  }
  function go(cb) { if (fade.phase === 1) return; fade.phase = 1; fade.cb = cb; }

  // ---------- platserna ----------
  const dorr = (H) => ({ r: [H.door.x0 - 4, H.y - 40, H.door.x1 + 4, H.y], go: [(H.door.x0 + H.door.x1) / 2, H.y + 8] });
  const spots = () => lage === 'dal' ? [
    { id: 'buss', r: [HALLPLATS.x - 12, HALLPLATS.y - 38, HALLPLATS.x + 14, HALLPLATS.y + 2], go: [HALLPLATS.x + 10, HALLPLATS.y - 8], label: $t('SKIDBUSSEN TILL STAN'), act: bussen },
    { id: 'varmestuga', ...dorr(VARMESTUGA), label: $t('VÄRMESTUGAN – CHOKLAD OCH VÅFFLOR'), act: varmestugan },
    { id: 'uthyrning', ...dorr(UTHYRNING), label: $t('SKIDUTHYRNINGEN'), act: uthyrningen },
    { id: 'lift', r: [LIFT.x0 - 30, LIFT.y0 - 70, LIFT.x0 + 30, LIFT.y0 + 4], go: [LIFTKO.x, LIFTKO.y], label: $t('LIFTEN UPP TILL TOPPEN'), act: liften },
    { id: 'snogubbe', r: [SNOGUBBE.x - 14, SNOGUBBE.y - 50, SNOGUBBE.x + 14, SNOGUBBE.y + 2], go: [SNOGUBBE.x + 18, SNOGUBBE.y + 4], label: $t('SNÖGUBBEN'), act: () => toast($t('⛄ Snögubben Gösta har stått här sedan oktober. Moroten byts varje måndag.')) },
    { id: 'eld', r: [ELD.x - 14, ELD.y - 24, ELD.x + 14, ELD.y + 6], go: [ELD.x, ELD.y + 14], label: $t('ELDEN – VÄRM HÄNDERNA'), act: () => { const h = g.glad?.(1, $t('Värme vid elden'), 'skideld', 1) || 0; g.energy = Math.min(100, (g.energy || 0) + 4); toast($t('🔥 Du håller händerna över elden. Vantarna ångar. +4 ⚡') + (h ? ` +${h} 😊` : ''), 'good'); } },
    { id: 'skylt', r: [SKYLT.x - 30, SKYLT.y - 48, SKYLT.x + 30, SKYLT.y], go: [SKYLT.x + 14, SKYLT.y + 6], label: $t('SKIDBACKEN'), act: () => toast($t('⛷️ SKIDBACKEN – hyr skidor eller pulka, ta liften upp och åk ner. Värmestugan har choklad. Bussen hem står här.')) },
  ] : lage === 'topp' ? [
    { id: 'slalomstart', r: [SLALOM.start.x - 24, SLALOM.start.y - 40, SLALOM.start.x + 24, SLALOM.start.y + 2], go: [SLALOM.start.x, SLALOM.start.y - 8], label: har.skidor ? $t('SLALOMSTARTEN – KÖR!') : $t('SLALOMSTARTEN (SKIDOR KRÄVS)'), act: startSlalom },
    { id: 'pulkastart', r: [PULKA.start.x - 24, PULKA.start.y - 40, PULKA.start.x + 24, PULKA.start.y + 2], go: [PULKA.start.x, PULKA.start.y - 8], label: har.pulka ? $t('PULKABACKEN – ÅK!') : $t('PULKABACKEN (PULKA KRÄVS)'), act: startPulka },
    { id: 'liftner', r: [LIFT.x1 - 30, LIFT.y1 - 70, LIFT.x1 + 30, LIFT.y1 + 10], go: [LIFT.x1 - 30, S.TOPP[1] - 10], label: $t('LIFTEN NER IGEN'), act: liftNer },
    { id: 'toppstuga', ...dorr(TOPPSTUGA), label: $t('TOPPSTUGAN – SKIDPATRULLEN'), act: () => { play('knock'); talk.say($t('Skidpatrullen: "Portarna står rakt, snön är fin. Böj på knäna och titta framåt – inte på skidorna!"'), () => ({ x: patrull.x, y: patrull.y - 34 }), 5, { voice: patrull.look }); } },
    { id: 'utsikt', r: [TOPPSKYLT.x - 24, TOPPSKYLT.y - 40, TOPPSKYLT.x + 24, TOPPSKYLT.y + 2], go: [TOPPSKYLT.x + 14, TOPPSKYLT.y + 4], label: $t('UTSIKTEN'), act: () => toast($t('🏔️ Härifrån ser du Pixelstaden, havet och fyren på Solön. På riktigt klara dagar – Pixelberg.')) },
  ] : [];
  const spotAt = (x, y) => spots().find((s) => x >= s.r[0] && x <= s.r[2] && y >= s.r[1] && y <= s.r[3]);
  const folkAt = (x, y) => (lage === 'dal' ? folk.find((o) => Math.abs(o.x - x) < 7 && y < o.y + 2 && y > o.y - 30) : null);

  // ---------- ritning ----------
  const KIT = propKit();
  const sken = (ctx, x, y, r, col) => { const gr = ctx.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, col); gr.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = gr; ctx.fillRect(x - r, y - r, r * 2, r * 2); };
  const liftXY = (u) => ({ x: LIFT.x0 + (LIFT.x1 - LIFT.x0) * u, y: LIFT.y0 + (LIFT.y1 - LIFT.y0) * u });
  function ritaAkareSelf(ctx) {
    if (ski) { const k = ski, dir = styr < 0 ? 'left' : styr > 0 ? 'right' : 'down'; ritaSkidor(ctx, k.x, k.y, styr); if (k.v > 30) ritaSnorok(ctx, k.x, k.y, t); drawPerson(ctx, k.x, k.y, A.avatar.look, dir, k.fall > 0 ? 5 : 0); if (k.textT > 0) { ctx.globalAlpha = Math.min(1, k.textT * 2); ctxText(ctx, BIG, k.text, k.x - (textW(BIG, k.text) >> 1), k.y - 50, k.text === $t('PORT!') ? '#8ae08a' : '#ff8a8a'); ctx.globalAlpha = 1; } }
    else if (pulka) { const p = pulka, hy = p.hopp > 0 ? Math.round(Math.sin(p.hopp / 0.5 * Math.PI) * 10) : 0; ritaPulka(ctx, p.x, p.y - hy); ritaSnorok(ctx, p.x - 4, p.y, t); drawPerson(ctx, p.x, p.y - 4 - hy, A.avatar.look, 'down', 5); if (p.textT > 0) { ctxText(ctx, BIG, p.text, p.x - (textW(BIG, p.text) >> 1), p.y - 48, '#ffd23f'); } }
  }

  return {
    viewMax: { w: TW, h: TH },
    get worldX() { return pos().x; }, get worldY() { return pos().y; },
    update(dt) {
      t += dt; banner += dt;
      VW = Math.max(384, Math.min(A.W || 384, TW)); VH = Math.max(160, Math.min(A.H || 216, TH));
      if (fade.phase === 1) { fade.a = Math.min(1, fade.a + dt * 2.6); if (fade.a >= 1) { fade.phase = 0; const cb = fade.cb; fade.cb = null; cb?.(); return; } }
      else if (fade.phase === 2) { fade.a = Math.max(0, fade.a - dt * 1.8); if (fade.a <= 0) fade.phase = 0; }
      if (lage === 'dal' || lage === 'topp') walker.update(dt);
      updLiv(dt);
      const c = camTarget(); cam.x += (c.x - cam.x) * Math.min(1, dt * 8); cam.y += (c.y - cam.y) * Math.min(1, dt * 8);
    },
    draw(ctx) {
      ctx.setTransform(A.pxs, 0, 0, A.pxs, 0, 0);
      ctx.imageSmoothingEnabled = false;
      const N = night(), D = dusk();
      const cx = Math.round(cam.x), cy = Math.round(cam.y);
      ctx.drawImage(skyCanvas(VW, N, D), 0, Math.min(0, -cy * 0.3));
      const bk = fjallCanvas(N), off = -Math.round(cx * 0.5) % bk.width, by = Math.round(S.TOPP[0] - 20 - bk.height + 16 - cy * 0.9);
      for (let x = off; x < VW; x += bk.width) ctx.drawImage(bk, x, by);
      ctx.drawImage(ground(), -cx, -cy);
      ctx.save(); ctx.translate(-cx, -cy);
      const items = [];
      const syns = (x, m = 80) => x > cx - m && x < cx + VW + m;
      items.push({ fy: VARMESTUGA.y - 1, draw: () => ritaStuga(ctx, VARMESTUGA, 'varme', N) }, { fy: VARMESTUGA.y - 0.5, draw: () => ritaRok(ctx, VARMESTUGA.x + VARMESTUGA.w - 31, VARMESTUGA.y - VARMESTUGA.h - 34, t) });
      items.push({ fy: UTHYRNING.y - 1, draw: () => ritaStuga(ctx, UTHYRNING, 'uthyr', N) }, { fy: TOPPSTUGA.y - 1, draw: () => ritaStuga(ctx, TOPPSTUGA, 'topp', N) });
      items.push({ fy: LIFT.y0, draw: () => ritaLiftstation(ctx, LIFT.x0, LIFT.y0, false, N) }, { fy: LIFT.y1, draw: () => ritaLiftstation(ctx, LIFT.x1, LIFT.y1, true, N) });
      for (const u of [0.3, 0.6]) { const p = liftXY(u); items.push({ fy: p.y, draw: () => ritaLiftstolpe(ctx, p.x, p.y) }); }
      for (const po of SLALOM.portar) items.push({ fy: po.y, draw: () => ritaPort(ctx, po.x, po.y, po.rod) });
      items.push({ fy: SNOGUBBE.y, draw: () => ritaSnogubbe(ctx, t) }, { fy: ELD.y + 2, draw: () => ritaEld(ctx, t) });
      for (const [kx, ky] of SNOKANONER) items.push({ fy: ky, draw: () => ritaSnokanon(ctx, kx, ky, t) });
      for (const gr of GRANAR) if (syns(gr.x)) items.push({ fy: gr.y, draw: () => ritaGran(ctx, gr.x, gr.y, gr.y < 200 ? 0.8 : 1) });
      for (const [sx, sy] of STENAR) items.push({ fy: sy, draw: () => ritaSten(ctx, sx, sy) });
      for (const [bx, byy] of BANKAR) items.push({ fy: byy, draw: () => KIT.bench(ctx, bx, byy) });
      items.push({ fy: TOPPSKYLT.y, draw: () => ritaToppskylt(ctx) }, { fy: SKYLT.y, draw: () => ritaSkylt(ctx) }, { fy: HALLPLATS.y, draw: () => ritaHallplats(ctx) });
      items.push({ fy: patrull.y, draw: () => drawPerson(ctx, patrull.x, patrull.y, patrull.look, 'down', Math.sin(t * 1.5) > 0.8 ? 10 : 0) });
      for (const a of akare) items.push({ fy: a.y, draw: () => { ritaSkidor(ctx, a.x, a.y, Math.sign(Math.cos(a.y / 40 * a.sv + a.f))); drawPerson(ctx, a.x, a.y, a.look, 'down', 0); } });
      for (const b of pulkabarn) items.push({ fy: b.y, draw: () => { ritaPulka(ctx, b.x, b.y); drawPerson(ctx, b.x, b.y - 4, b.look, 'down', 5); } });
      for (const o of folk) if (syns(o.x)) items.push({ fy: o.y, draw: () => drawPerson(ctx, o.x, o.y, o.look, o.dir, o.vila <= 0 ? WALK_SEQ[Math.floor(t * 8.5 + o.x) % 4] : 0) });
      items.push(...folkDrawables(A, t));
      if (lage === 'dal' || lage === 'topp') { const me = selfDrawable(A, walker, t, { folksHere: worldFolksHere(A).length }); items.push({ fy: me.fy, draw: () => { me.draw(ctx); if (har.skidor) ritaSkidor(ctx, walker.px, walker.py, 0, true); else if (har.pulka) ritaPulka(ctx, walker.px, walker.py, true); } }); }
      if (lage === 'slalom' || lage === 'pulka') items.push({ fy: pos().y + 0.1, draw: () => ritaAkareSelf(ctx) });
      items.sort((a, b) => a.fy - b.fy).forEach((d) => d.draw(ctx));
      // liften: linan, stolarna och den egna stolen ritas över allt annat (de hänger i luften)
      ritaLina(ctx, LIFT.x0, LIFT.y0, LIFT.x1, LIFT.y1);
      for (const s of stolar) { const upp = s.u < 0.5, u = upp ? s.u * 2 : 1 - (s.u - 0.5) * 2, p = liftXY(u); const px = p.x + (upp ? 6 : -6); ritaStol(ctx, px, p.y, upp); if (s.rider) drawPerson(ctx, px, p.y - 40, s.rider, upp ? 'up' : 'down', 5); }
      if (lift) { const p = liftPos(); const px = p.x + (lift.dir > 0 ? 6 : -6); ritaStol(ctx, px, p.y, lift.dir > 0); drawPerson(ctx, px, p.y - 40, A.avatar.look, lift.dir > 0 ? 'up' : 'down', 5); if (har.skidor) ritaSkidor(ctx, px, p.y - 40, 0, false); }
      ctx.restore();
      if (N || D) {
        ctx.fillStyle = N ? 'rgba(14,20,60,0.5)' : 'rgba(90,60,120,0.18)'; ctx.fillRect(0, 0, VW, VH);
        if (D) { ctx.fillStyle = 'rgba(255,150,90,0.12)'; ctx.fillRect(0, 0, VW, VH); }
        ctx.save(); ctx.translate(-cx, -cy); ctx.globalCompositeOperation = 'lighter';
        for (const H of [VARMESTUGA, UTHYRNING, TOPPSTUGA]) sken(ctx, H.x + H.w / 2, H.y - 30, 50, `rgba(255,210,130,${N ? 0.3 : 0.14})`);
        for (const [lx, ly] of [[LIFT.x0, LIFT.y0 - 50], [LIFT.x1, LIFT.y1 - 50]]) sken(ctx, lx, ly, 46, `rgba(255,240,200,${N ? 0.32 : 0.12})`);
        sken(ctx, ELD.x, ELD.y - 6, 40, 'rgba(255,160,70,.3)');
        ctx.globalCompositeOperation = 'source-over'; ctx.restore();
      }
      ctx.save(); ctx.translate(-cx, -cy); talk.draw(ctx, { x0: cx, x1: cx + VW }); ctx.restore();
      if (ski) { const s = $t`PORTAR ${ski.portar} AV 9 · ${ski.t.toFixed(1)} s`; ctx.fillStyle = 'rgba(20,18,26,.85)'; ctx.fillRect(8, 20, textW(SMALL, s) + 10, 11); ctxText(ctx, SMALL, s, 13, 23, '#f4f1ea'); }
      if (lift) { const s = lift.dir > 0 ? $t('PÅ VÄG UPP …') : $t('PÅ VÄG NER …'); ctx.fillStyle = 'rgba(20,18,26,.85)'; ctx.fillRect(8, 20, textW(SMALL, s) + 10, 11); ctxText(ctx, SMALL, s, 13, 23, '#f4f1ea'); }
      if (banner < 4) { const a = banner < 0.4 ? banner / 0.4 : banner > 3.4 ? (4 - banner) / 0.6 : 1; ctx.globalAlpha = Math.max(0, a); const s = $t('SKIDBACKEN'), s2 = $t('LIFT, SLALOM, PULKA OCH VARM CHOKLAD'), w = Math.max(textW(BIG, s, 2), textW(SMALL, s2)) + 20; ctx.fillStyle = 'rgba(20,18,26,.85)'; ctx.fillRect((VW - w) >> 1, 26, w, 30); ctxText(ctx, BIG, s, (VW - textW(BIG, s, 2)) >> 1, 30, '#b8e0ff', 2); ctxText(ctx, SMALL, s2, (VW - textW(SMALL, s2)) >> 1, 48, '#f4f1ea'); ctx.globalAlpha = 1; }
      const s = hover && spotAt(hover.x + cx, hover.y + cy);
      if (s) { const w = textW(SMALL, s.label) + 10, x = Math.round(Math.max(2, Math.min(VW - w - 2, hover.x - w / 2))), y = Math.max(2, hover.y - 22); ctx.fillStyle = 'rgba(20,18,26,.9)'; ctx.fillRect(x, y, w, 11); ctxText(ctx, SMALL, s.label, x + 5, y + 3, '#ffd23f'); }
      if (fade.a > 0) { ctx.fillStyle = `rgba(10,10,16,${fade.a.toFixed(2)})`; ctx.fillRect(0, 0, VW, VH); }
    },
    down(sx, sy) {
      if (fade.phase === 1) return;
      if (ski) { ski.mal = Math.max(SLALOM.x0 + 12, Math.min(SLALOM.x1 - 12, sx + cam.x)); styr = 0; styrT = 0; return; }
      if (lift || pulka) return;
      hover = { x: sx, y: sy };
      const x = sx + cam.x, y = sy + cam.y;
      if (lage === 'dal') { const fk = folkTapAt(A, x, y); if (fk) { openSpelarkort(A, fk); return; } const o = folkAt(x, y); if (o) { walker.walkTo(o.x + (walker.px < o.x ? -14 : 14), o.y + 2, () => { o.vila = Math.max(o.vila, 4); talk.say(o.rad, () => ({ x: o.x, y: o.y - 34 }), 3.5, { voice: o.look }); }); return; } }
      const s = spotAt(x, y);
      if (s) { walker.walkTo(s.go[0], s.go[1], s.act); return; }
      walker.walkTo(x, y);
    },
    key(k) {
      if (!ski) return;
      if (k === 'ArrowLeft' || k === 'a' || k === 'A') { styr = -1; styrT = 0.35; ski.mal = null; }
      else if (k === 'ArrowRight' || k === 'd' || k === 'D') { styr = 1; styrT = 0.35; ski.mal = null; }
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
      har: () => ({ ...har }),
      hyr: (id) => { har[id] = true; },
      lift: () => (lift ? { t: +lift.t.toFixed(1), dir: lift.dir } : null),
      ski: () => (ski ? { x: Math.round(ski.x), y: Math.round(ski.y), portar: ski.portar, miss: ski.miss, nasta: ski.nasta, t: +ski.t.toFixed(1) } : null),
      pulka: () => (pulka ? { x: Math.round(pulka.x), y: Math.round(pulka.y), gupp: pulka.gupp } : null),
      styr: (d) => { styr = d; styrT = 99; if (ski) ski.mal = null; },
      sikta: () => { if (!ski) return false; const po = SLALOM.portar[ski.nasta]; if (!po) return false; ski.x = po.x; ski.mal = null; return true; },
      tick: (sec) => { for (let k = 0; k < sec * 30; k++) updLiv(1 / 30); },
      sista: () => sista,
    },
  };
}
// marken målas en gång
let GROUND = null;
const ground = () => (GROUND ||= paintGround());
