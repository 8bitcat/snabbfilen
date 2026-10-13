// TASSBACKEN – djurens stadsdel väster om Linnéstaden (kartan, marken och husen: js/tassbacken/karta.js).
// Man kommer hit genom att gå västerut på Pixelgatan förbi stadsgränsen (city.js) – Tassgatan ligger
// på samma höjd – och tillbaka genom att gå österut. Ens egna husdjur följer med (outdoors.js).
//
// Här lever djuren: folk rastar hundar längs trottoarerna (kopplet syns), hundarna leker i
// HUNDPARKEN, katterna sitter i kattcaféets fönster och solar på balkongen, änderna simmar i
// DAMMEN och kattstatyn på TASSTORGET sprutar vatten (släng en krona – det ger tur en gång om dagen).
// DJURTRIMMAREN Klipp & Klo är öppen (js/scenes/shop-trimmare.js – frisyrer åt ens djur). Kattcaféet,
// utställningshallen, djurhemmet, kliniken och agilitybanan öppnar i nästa steg (skyltar berättar).
// Busshållplatsen TASSBACKEN tar en till Marknadstorget i Linnéstaden.
import { createCityWalker } from '../city/walk.js';
import { selfDrawable, folkDrawables, createSpeech, WALK_SEQ } from './walkable.js';
import { worldFolksHere } from '../net/world.js';
import { openModal, closeModal, toast } from '../core/ui.js';
import { play } from '../core/sound.js';
import { SMALL, BIG, ctxText, textW, hash } from '../core/floor-pix.js';
import { CITY, busStopById } from '../city/map.js';
import { fmt } from '../game.js';
import { drawPerson, makeLook } from '../core/people.js';
import { drawPet, petNeck, SPECIES } from '../pets/sprites.js';
import { createPetWalk } from '../pets/outdoors.js';
import { skyCanvas } from '../landet/karta.js';
import { propKit } from '../city/props.js';   // stadens träd, lyktor, bänkar … (samma detaljnivå som staden)
import { TW, TH, T, HUS, HUSLISTA, RASTGARD, DAMM, PARK, GRIND, TORG, STATY, HALLPLATS, SKYLT, AGILITY, TRAD, GALLERTRAD, BANKAR, LYKTOR, SMATT, PARKLAMPOR, BUSKAR, PARKPRYL, RABATTER, hinder, backeCanvas, paintGround, husPos } from '../tassbacken/karta.js';
import { husBild, husLiv, husSken, ritaGatupratare, ritaPudelbuske } from '../tassbacken/hus.js';   // husen i full prakt (v0.133)
import { ritaKoja, ritaBurBak, ritaBurFram, ritaHallplats, ritaBuske, ritaParklykta, parklyktaSken, ritaParkPryl, ritaGrindskylt, ritaFjarilar } from '../tassbacken/park.js';   // södra sidan (v0.133)
import { petStore } from '../pets/sim.js';
import { belona, visaResultat } from './utstallning.js';
import { agilityPlacering } from './agility.js';
import { esc } from '../core/ui.js';
import { $t } from '../core/i18n.js';

const GANG = 110;
const AGIL = $t('🐕 Agilitybanan – här tävlar hundarna! Skaffa en hund i djuraffären eller på djurhemmet, så kan ni springa banan tillsammans.');
const LJUD = { hund: [$t('VOFF!'), $t('Voff voff!'), $t('VOFF! 🐕')], katt: [$t('Mjau!'), $t('Purrr …'), $t('MJAU! 🐈')], kanin: [$t('*nos-nos*'), $t('*skutt*')], and: [$t('KVACK!'), $t('Kvack kvack!')] };
const AGARE = [
  $t('Hon älskar Tassbacken – här får hon nosa på allt!'), $t('Har du varit i trimmaren? Min hund fick pompoms!'),
  $t('Snart blir det kattutställning i hallen, har jag hört!'), $t('Kattstatyn på torget ger tur om man slänger en krona.'),
  $t('Hundparken är bäst på morgonen.'), $t('Han är snäll, du får klappa honom!'),
];

export function makeTassbacken(A) {
  const g = A.game;
  let VW = Math.max(384, Math.min(A.W || 384, TW)), VH = Math.max(160, Math.min(A.H || 216, TH));
  const from = A.tassFran || null; A.tassFran = null;
  const spawnY = from?.y ? Math.max(T.SIDEWALK_N[0] + 4, Math.min(T.SIDEWALK_S[1] - 4, from.y)) : T.SIDEWALK_S[0] + 10;
  const trimDorr = [(HUS.trim.door.x0 + HUS.trim.door.x1) / 2, T.BASE + 8], hallDorr = [(HUS.hall.door.x0 + HUS.hall.door.x1) / 2, T.BASE + 8];
  const dorrVid = (id) => [(HUS[id].door.x0 + HUS[id].door.x1) / 2, T.BASE + 8];
  const walker = createCityWalker({ W: TW, H: TH, left: 2, right: TW - 2, top: T.TOP, bottom: T.BOTTOM, spawn: from?.park ? [(GRIND[0] + GRIND[1]) / 2, PARK[1] + 14] : from?.klinik ? dorrVid('klinik') : from?.trim ? trimDorr : from?.hall ? hallDorr : from?.kafe ? dorrVid('kafe') : from?.hem ? dorrVid('hem') : from?.buss ? [HALLPLATS.x - 10, HALLPLATS.y + 6] : [TW - 14, spawnY] });
  const fordon = () => g.aker;
  const applyRide = () => { const F = fordon(); walker.speed = GANG * (F ? F.fart : 1); };
  applyRide();
  walker.setObstacles(hinder());
  walker.snapFree();
  const talk = createSpeech();
  let t = 0, hover = null, banner = from?.park || from?.klinik || from?.trim || from?.hall || from?.kafe || from?.hem || from?.buss ? 4 : 0;
  const fade = { a: 1, phase: 2, cb: null };
  const cam = { x: 0, y: 0 };
  const camTarget = () => ({ x: Math.max(0, Math.min(TW - VW, walker.px - VW / 2)), y: Math.max(0, Math.min(TH - VH, walker.py - VH * 0.84)) });
  Object.assign(cam, camTarget());
  if (!A.attract && !from?.park && !from?.klinik && !from?.trim && !from?.hall && !from?.kafe && !from?.hem) { const h = g.glad?.(2, '', 'tassbacken', 2); if (h) setTimeout(() => toast($t`🐾 Tassbacken – djurens stadsdel! +${h} 😊`, 'good'), 900); }
  // ens egna djur på promenad följer med hit
  let pets = null;
  try { pets = createPetWalk(A); } catch (e) { console.error('husdjuren i Tassbacken startade inte:', e); }

  // ---------- djuren och folket ----------
  const rnd = (a, b) => a + Math.random() * (b - a);
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const breedsOf = (sp) => SPECIES[sp].breeds.map((b) => b.id);
  const mkPet = (sp, i, extra = {}) => ({ id: `tb-${sp}-${i}`, species: sp, breed: pick(breedsOf(sp)), sex: i % 2 ? 'hona' : 'hane', stage: 'vuxen', seed: `tb${sp}${i}`, ...extra });
  // hundägare som promenerar fram och tillbaka på trottoarerna med hunden före sig i koppel
  const agare = [0, 1, 2, 3].map((i) => {
    const y = i % 2 ? T.SIDEWALK_S[0] + 12 : T.SIDEWALK_N[0] + 21;   // (norra: utanför kaféborden, innanför lyktorna)
    const ras = ['pudel', 'tax', 'corgi', 'golden'][i];
    return { look: makeLook(), x: 120 + i * 380, y, dir: i % 2 ? 'left' : 'right', fart: rnd(22, 30), vila: 0, hund: mkPet('hund', i, { breed: ras, ...(i === 0 ? { frisyr: { s: 'pudel', f: 'rosa' } } : i === 3 ? { frisyr: { s: 'rosett', f: 'bla' } } : {}) }), rad: AGARE[i % AGARE.length] };
  });
  // hundarna i hundparken (springer, leker, nosar) och ägarna vid staketet
  const parkhund = [0, 1, 2, 3, 4].map((i) => { const x = rnd(PARK[0] + 20, PARK[2] - 20), y = rnd(PARK[1] + 16, PARK[3] - 8); return { p: mkPet('hund', 10 + i, i === 2 ? { frisyr: { s: 'lejon', f: 'natur' } } : {}), x, y, tx: x, ty: y, dir: 'right', state: 'sta', tm: rnd(0, 3), sort: 'hund' }; });
  const parkfolk = [{ look: makeLook(), x: PARK[0] + 60, y: PARK[1] + 22 }, { look: makeLook(), x: PARK[2] - 90, y: PARK[3] - 14 }];
  // djurhemmets rastgård: två hundar och kaninerna i buren
  const gardhund = [0, 1].map((i) => { const x = rnd(RASTGARD[0] + 30, RASTGARD[2] - 20), y = rnd(RASTGARD[1] + 30, RASTGARD[3] - 10); return { p: mkPet('hund', 20 + i), x, y, tx: x, ty: y, dir: 'left', state: 'sta', tm: rnd(0, 3), sort: 'hund', pen: RASTGARD }; });
  const kaniner = [0, 1, 2].map((i) => ({ p: mkPet('kanin', 30 + i), x: RASTGARD[0] + 36 + i * 14, y: RASTGARD[3] - 18 + (i % 2) * 4, dir: i % 2 ? 'left' : 'right', sort: 'kanin' }));
  // katterna: i kattcaféets fönster, på balkongen, på muren
  const katter = [
    { p: mkPet('katt', 40), x: HUS.kafe.x + 22, y: T.BASE - 9, dir: 'down', anim: 'sit', sort: 'katt' },
    { p: mkPet('katt', 41, { frisyr: { s: 'fluff', f: 'lila' } }), x: HUS.kafe.x + 44, y: T.BASE - 9, dir: 'down', anim: 'sleep', sort: 'katt' },
    { p: mkPet('katt', 42), x: HUS.kafe.x + 124, y: T.BASE - 9, dir: 'down', anim: 'sit', sort: 'katt' },
    { p: mkPet('katt', 43, { breed: 'rodkatt' }), x: HUS.bo1.x + 86, y: T.BASE - HUS.bo1.h + 30, dir: 'right', anim: 'sleep', sort: 'katt' },
    { p: mkPet('katt', 44, { breed: 'svart' }), x: 300, y: T.BASE - 9, dir: 'down', anim: 'sit', sort: 'katt' },
    { p: mkPet('katt', 45, { breed: 'smoking' }), x: TORG.x + 40, y: TORG.y + 30, dir: 'left', anim: 'sleep', sort: 'katt' },
  ];
  // änderna i dammen
  const ander = [0, 1, 2, 3].map((i) => ({ a: i * 1.6, r: 0.45 + (i % 3) * 0.16, v: 0.06 + i * 0.015, hona: i % 2 === 1 }));
  const andPos = (d) => ({ x: DAMM.x + Math.cos(d.a) * DAMM.rx * d.r, y: DAMM.y + Math.sin(d.a) * DAMM.ry * d.r });
  const vandra = (d, pen, dt) => {
    d.tm -= dt;
    if (d.state === 'ga') {
      const dx = d.tx - d.x, dy = d.ty - d.y, dist = Math.hypot(dx, dy), step = (d.spring ? 46 : 18) * dt;
      if (Math.abs(dx) > 0.5) d.dir = dx < 0 ? 'left' : 'right';
      if (dist <= step) { d.x = d.tx; d.y = d.ty; d.state = Math.random() < 0.3 ? 'lek' : 'sta'; d.tm = rnd(1.5, 5); } else { d.x += dx / dist * step; d.y += dy / dist * step; }
    } else if (d.tm <= 0) { d.tx = rnd(pen[0] + 16, pen[2] - 16); d.ty = rnd(pen[1] + 16, pen[3] - 8); d.spring = Math.random() < 0.5; d.state = 'ga'; }
  };
  function updLiv(dt) {
    for (const o of agare) {
      if (o.vila > 0) { o.vila -= dt; continue; }
      o.x += (o.dir === 'right' ? 1 : -1) * o.fart * dt;
      if (o.x > TW - 60) { o.dir = 'left'; o.vila = rnd(1, 3); }
      if (o.x < 40) { o.dir = 'right'; o.vila = rnd(1, 3); }
      if (Math.random() < dt * 0.04) o.vila = rnd(2, 4);   // hunden nosar en stund
    }
    for (const d of parkhund) vandra(d, PARK, dt);
    for (const d of gardhund) vandra(d, RASTGARD, dt);
    for (const d of ander) d.a += d.v * dt;
  }

  // ---------- platserna man kan klicka på ----------
  const busStop = busStopById('marknadstorget');
  const dorr = (id) => { const h = HUS[id]; return { r: [h.door.x0 - 4, T.BASE - 36, h.door.x1 + 4, T.BASE], go: [(h.door.x0 + h.door.x1) / 2, T.BASE + 8] }; };
  const spots = () => [
    { id: 'trim', ...dorr('trim'), label: $t('DJURTRIMMAREN KLIPP & KLO'), act: () => go(() => { play('door'); A.go('trimmaren'); }) },
    { id: 'hall', ...dorr('hall'), label: $t('UTSTÄLLNINGSHALLEN – KATTER, HUNDAR, KANINER'), act: () => go(() => { play('door'); A.go('utstallning'); }) },
    { id: 'kafe', ...dorr('kafe'), label: $t('KATTCAFÉ KURR – FIKA MED KATTERNA'), act: () => go(() => { play('door'); A.go('kattcafe'); }) },
    { id: 'hem', ...dorr('hem'), label: $t('TASSARNAS HEM – DJURHEMMET'), act: () => go(() => { play('door'); A.go('djurhem'); }) },
    { id: 'klinik', ...dorr('klinik'), label: $t('DJURKLINIKEN – VETERINÄREN VERA'), act: () => go(() => { play('door'); A.go('djurklinik'); }) },
    ...['bo1', 'bo2'].map((id) => ({ id, ...dorr(id), label: $t('BOSTADSHUS'), act: () => { play('knock'); toast($t('🐾 Här bor någon. Det låter som en hund bakom dörren …')); } })),
    { id: 'agility', r: [PARK[0] + 40, PARK[1] + 30, PARK[2] - 40, PARK[3] - 10], go: [(GRIND[0] + GRIND[1]) / 2, PARK[1] + 14], label: $t('AGILITYBANAN – TÄVLA MED DIN HUND'), act: agilityAnmalan },
    { id: 'staty', r: [STATY.x - 26, STATY.y - 34, STATY.x + 26, STATY.y + 10], go: [STATY.x, STATY.y + 18], label: $t('KATTSTATYN – SLÄNG EN KRONA'), act: statyn },
    { id: 'buss', r: [HALLPLATS.x - 12, HALLPLATS.y - 34, HALLPLATS.x + 14, HALLPLATS.y + 2], go: [HALLPLATS.x - 8, HALLPLATS.y + 6], label: $t('BUSS TILL MARKNADSTORGET'), act: bussen },
    { id: 'skylt', r: [SKYLT.x - 16, SKYLT.y - 36, SKYLT.x + 16, SKYLT.y + 2], go: [SKYLT.x, SKYLT.y + 8], label: $t('TILLBAKA TILL STAN'), act: tillStan },
  ];
  // 🐕 agilitycupen i hundparken: välj hund (en tävling per hund och dag, 50 kr) → js/scenes/agility.js
  function agilityAnmalan() {
    const S = petStore(), hundar = (S.pets || []).filter((p) => p.species === 'hund');
    if (!hundar.length) { toast(AGIL, 'wrap'); return; }
    play('click');
    const rader = hundar.map((p) => { const klar = p.utst?.agilityDag === g.day, r = p.utst?.agility || [0, 0, 0]; return `<div class="prow" style="grid-template-columns:auto 1fr auto"><span style="font-size:22px">🐕</span><span class="nm"><b>${esc(p.name)}</b><br><small class="sp">${$t`Träning ${Math.min(20, p.agil | 0)}/20`}${r.some(Boolean) ? ` · 🥇${r[0]} 🥈${r[1]} 🥉${r[2]}` : ''}</small></span><button class="btn btn-small btn-go" data-hund="${esc(p.id)}" ${klar || g.money < 50 ? 'disabled' : ''}>${klar ? $t('Tävlat i dag') : $t`Tävla · ${fmt(50)}`}</button></div>`; }).join('');
    const dlg = openModal($t('🐕 Agilitycupen'), `<p style="font-size:var(--f2);margin-top:0">${$t('Hoppa över hindren och däcket, spring genom tunneln (hoppa inte!), tryck snabbt i slalom och vänta på vippbrädan. Varje lopp tränar hunden – en vältränad hund springer fortare.')}</p><div class="plist">${rader}</div>`, [{ label: $t('Inte nu'), onClick: closeModal }]);
    dlg.querySelectorAll('[data-hund]').forEach((b) => (b.onclick = () => {
      const p = hundar.find((q) => q.id === b.dataset.hund); if (!p || g.money < 50) return;
      g.money -= 50; g.save(); closeModal(); play('coin');
      go(() => A.go('agility', { petId: p.id, onDone: (res) => efterAgility(A, p.id, res) }));
    }));
  }
  // 🪙 kattstatyn: en krona i fontänen ger tur (😊) en gång om dagen
  function statyn() {
    if (g.money < 1) { toast($t('Du har inte ens en krona …'), 'bad'); return; }
    g.money -= 1; g.save(); play('coin');
    const h = g.glad?.(3, $t('En krona i kattfontänen'), 'kattstaty', 3) || 0;
    talk.say($t('*plask*'), () => ({ x: STATY.x, y: STATY.y - 36 }), 1.6, { silent: true });
    toast(h ? $t`🪙 Plask! Kattstatyn blinkar åt dig – det ger tur! +${h} 😊` : $t('🪙 Plask! Kronan sjunker till botten bland de andra. (Turen kommer en gång om dagen.)'), h ? 'good' : '');
  }
  function bussen() {
    openModal($t('🚌 Busshållplats TASSBACKEN'), `<p style="font-size:var(--f2);margin-top:0">${$t`Bussen går till <b>Marknadstorget</b> i Linnéstaden. Biljetten kostar ${fmt(10)}.`}</p>`, [
      { label: $t('🚌 Åk till stan'), cls: 'btn-go', onClick: () => { closeModal(); if (g.money < 10) { toast($t('Du har inte råd med bussen.'), 'bad'); return; } g.money -= 10; g.passTime(10); g.save(); play('door'); toTown(busStop ? [busStop.x, busStop.y + 8] : [CITY.X0 + 600, T.SIDEWALK_S[0] + 10]); } },
      { label: $t('Gå'), onClick: closeModal },
    ]);
  }
  // tillbaka in i staden vid västra stadsgränsen – på närmaste trottoar
  function tillStan() {
    let y = Math.max(CITY.SIDEWALK_N[0] + 4, Math.min(CITY.SIDEWALK_S[1] - 4, walker.py));
    if (y > CITY.ROAD[0] - 2 && y < CITY.ROAD[1] + 2) y = y < (CITY.ROAD[0] + CITY.ROAD[1]) / 2 ? CITY.SIDEWALK_N[0] + 16 : CITY.SIDEWALK_S[0] + 14;
    toTown([CITY.X0 + 24, y]);
  }
  function go(cb) { if (fade.phase === 1) return; fade.phase = 1; fade.cb = cb; }
  function toTown(pos) { go(() => { A.cityPos = pos; A.go('city'); }); }
  const spotAt = (x, y) => spots().find((s) => x >= s.r[0] && x <= s.r[2] && y >= s.r[1] && y <= s.r[3]);
  // klickbara djur: hundar, katter, kaniner, änder (och hundägarna)
  const allaDjur = () => [
    ...agare.map((o) => ({ ...hundVid(o), sort: 'hund', agare: o })),
    ...parkhund, ...gardhund, ...kaniner, ...katter,
    ...ander.map((d) => ({ ...andPos(d), sort: 'and' })),
  ];
  const djurAt = (x, y) => allaDjur().find((d) => Math.abs(d.x - x) < (d.sort === 'and' ? 6 : 10) && y < d.y + 3 && y > d.y - (d.sort === 'hund' ? 18 : 12));
  const agareAt = (x, y) => agare.find((o) => Math.abs(o.x - x) < 7 && y < o.y + 2 && y > o.y - 30);
  function prata(d) {
    const L2 = LJUD[d.sort] || LJUD.katt;
    talk.say(L2[Math.floor(Math.random() * L2.length)], () => { const q = d.agare ? hundVid(d.agare) : d; return { x: q.x, y: q.y - (d.sort === 'hund' ? 22 : 16) }; }, 2.5, { animal: true, silent: true });
    play('click');
    if (d.state) { d.state = 'sta'; d.tm = 3; }
    const h = g.glad?.(1, '', 'tassdjur', 3); if (h) toast(`😊 +${h}`);
  }
  // hunden går en bit framför ägaren (kopplet)
  const hundVid = (o) => ({ x: o.x + (o.dir === 'right' ? 16 : -16), y: o.y + 2 });

  // ---------- ritning av rekvisitan ----------
  const fenceDrawables = (pen, color, gap = null) => {
    const [x0, y0, x1, y1] = pen, out = [];
    const rail = (ctx, ax, bx, y) => { for (let x = ax; x < bx; x += 4) { ctx.fillStyle = color[2]; ctx.fillRect(x, y - 10, 3, 10); ctx.fillStyle = color[0]; ctx.fillRect(x, y - 10, 2, 10); ctx.fillRect(x + 1, y - 11, 1, 1); } ctx.fillStyle = color[1]; ctx.fillRect(ax, y - 7, bx - ax, 1); ctx.fillRect(ax, y - 3, bx - ax, 1); };
    if (gap) out.push({ fy: y0, draw: (ctx) => { rail(ctx, x0, gap[0], y0); rail(ctx, gap[1], x1, y0); } }); else out.push({ fy: y0, draw: (ctx) => rail(ctx, x0, x1, y0) });
    out.push({ fy: y1, draw: (ctx) => rail(ctx, x0, x1, y1) });
    for (const sx of [x0, x1 - 2]) out.push({ fy: y1 - 0.5, draw: (ctx) => { for (let y = y0; y < y1; y += 4) { ctx.fillStyle = color[2]; ctx.fillRect(sx, y - 10, 2, 10); ctx.fillStyle = color[0]; ctx.fillRect(sx, y - 10, 1, 10); } } });
    return out;
  };
  const VIT = ['#f4f1ea', '#c8c4b8', '#8a867c'], TRA = ['#b07a48', '#8a5a30', '#5a3a1e'];
  const drawAgility = (ctx, a) => {
    const { x, y } = a;
    ctx.fillStyle = 'rgba(20,12,30,.22)'; ctx.fillRect(x - 12, y - 1, 24, 3);
    if (a.typ === 'hopp') { for (const sx of [x - 11, x + 9]) { ctx.fillStyle = '#f4f1ea'; ctx.fillRect(sx, y - 14, 2, 14); } for (let i = -9; i < 9; i += 3) { ctx.fillStyle = (i / 3) & 1 ? '#d8343c' : '#f4f1ea'; ctx.fillRect(x + i, y - 9, 3, 2); } }
    else if (a.typ === 'tunnel') { for (let i = -12; i < 12; i++) { const h = Math.round(Math.sqrt(Math.max(0, 1 - (i / 12) ** 2)) * 9); ctx.fillStyle = (i + 12) % 4 < 2 ? '#3a7bd5' : '#2a5aa8'; ctx.fillRect(x + i, y - h - 1, 1, h + 1); } ctx.fillStyle = '#1a1a2a'; ctx.fillRect(x + 10, y - 7, 2, 6); }
    else if (a.typ === 'slalom') { for (let i = 0; i < 6; i++) { ctx.fillStyle = i % 2 ? '#f0b429' : '#f4f1ea'; ctx.fillRect(x - 12 + i * 5, y - 12, 2, 12); ctx.fillStyle = '#3a3a3e'; ctx.fillRect(x - 12 + i * 5, y - 1, 2, 1); } }
    else if (a.typ === 'vipp') { const tilt = Math.round(Math.sin(t * 0.7 + a.x) * 2); ctx.fillStyle = '#5a5e66'; ctx.fillRect(x - 2, y - 4, 4, 4); for (let i = -14; i <= 14; i++) { ctx.fillStyle = Math.abs(i) > 10 ? '#f0b429' : '#46a35a'; ctx.fillRect(x + i, y - 6 - Math.round(i / 14 * tilt), 1, 2); } }
    else if (a.typ === 'ring') { ctx.fillStyle = '#f4f1ea'; ctx.fillRect(x - 11, y - 22, 2, 22); ctx.fillRect(x + 9, y - 22, 2, 22); ctx.fillRect(x - 11, y - 22, 22, 2); for (let k = 0; k < 20; k++) { const an = k / 20 * Math.PI * 2; ctx.fillStyle = k % 4 < 2 ? '#26242c' : '#d8343c'; ctx.fillRect(Math.round(x + Math.cos(an) * 6), Math.round(y - 12 + Math.sin(an) * 6), 2, 2); } }
  };
  // kattstatyn: en sittande katt i ärgad brons på en stensockel mitt i en rund bassäng; vattnet sprutar
  // ur munnen i en båge ner i bassängen (ljuset från vänster: vänstra sidan ljusare)
  const KATT = ['...#.......#...', '...##.....##...', '..###########..', '..#e##...##e#..', '..###########..', '...####n####...', '....#######....', '...#########...', '..###########..', '.#############.', '.##############', '###############', '#############.#', '.############.#', '.############.#', '..###########.#', '..####...####.#', '..####...####..'];
  const drawStaty = (ctx) => {
    const { x, y } = STATY;
    // bassängen: stenkant och vatten med glitter
    for (let j = -10; j <= 10; j++) { const w = Math.round(27 * Math.sqrt(Math.max(0, 1 - (j / 10.5) ** 2))); ctx.fillStyle = j > 6 ? '#6a645c' : '#9a948a'; ctx.fillRect(x - w, y + j, w * 2, 1); }
    for (let j = -8; j <= 7; j++) { const w = Math.round(24 * Math.sqrt(Math.max(0, 1 - (j / 8.5) ** 2))); ctx.fillStyle = j < -5 ? '#3a7aa8' : '#5aa8d8'; ctx.fillRect(x - w, y + j, w * 2, 1); }
    for (let k = 0; k < 5; k++) { const u = (t * 0.6 + k / 5) % 1; ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.fillRect(Math.round(x - 18 + ((k * 13) % 36)), y - 4 + ((k * 5) % 9), 3, 1); if (u < 0.3) ctx.fillRect(Math.round(x + 14 + u * 6), y + 1, 1, 1); }
    // sockeln med en liten mässingsskylt
    ctx.fillStyle = '#5a544c'; ctx.fillRect(x - 9, y - 12, 18, 14);
    ctx.fillStyle = '#b8b2a6'; ctx.fillRect(x - 9, y - 12, 14, 13); ctx.fillStyle = '#d8d2c6'; ctx.fillRect(x - 9, y - 12, 18, 2); ctx.fillStyle = '#8a847a'; ctx.fillRect(x + 5, y - 10, 4, 11);
    ctx.fillStyle = '#c8a040'; ctx.fillRect(x - 5, y - 6, 8, 3); ctx.fillStyle = '#e8c860'; ctx.fillRect(x - 5, y - 6, 8, 1);
    // katten (15 × 18) på sockeln
    const kx = x - 7, ky = y - 30;
    KATT.forEach((r, j) => { for (let i = 0; i < r.length; i++) { const ch = r[i]; if (ch === '.') continue; ctx.fillStyle = ch === 'e' ? '#1e2a26' : ch === 'n' ? '#3a5a4a' : i < 4 ? '#8ac8a8' : i > 10 ? '#3a6a58' : '#5a9a80'; ctx.fillRect(kx + i, ky + j, 1, 1); } });
    ctx.fillStyle = '#2a4a3e'; for (let j = 0; j < 18; j++) { const r = KATT[j]; const i0 = r.indexOf('#'), i1 = r.lastIndexOf('#'); if (i0 >= 0) { ctx.fillRect(kx + i0 - 1, ky + j, 1, 1); ctx.fillRect(kx + i1 + 1, ky + j, 1, 1); } }
    ctx.fillRect(kx + 2, ky - 1, 3, 1); ctx.fillRect(kx + 10, ky - 1, 3, 1);
    ctx.fillStyle = '#b8e8d0'; ctx.fillRect(kx + 4, ky + 9, 1, 3); ctx.fillRect(kx + 3, ky + 2, 1, 1);   // blanka ställen där folk har klappat
    // vattenstrålen ur munnen: en båge med droppar ner i bassängen
    for (let k = 0; k < 14; k++) { const u = ((t * 1.2 + k / 14) % 1), px = x + 2 + u * 18, py = y - 25 - Math.sin(u * Math.PI) * 8 + u * 26; ctx.fillStyle = k % 3 ? '#9ad8f8' : '#ffffff'; ctx.fillRect(Math.round(px), Math.round(py), 1, 2); }
    ctx.fillStyle = '#ffffff'; ctx.fillRect(x + 19 + (Math.floor(t * 6) % 2), y + 1, 2, 1); ctx.fillRect(x + 18, y, 1, 1);
  };
  const drawAnd = (ctx, d) => {
    const { x, y } = andPos(d), dirL = Math.sin(d.a) > 0, X = Math.round(x), Y = Math.round(y), s = dirL ? -1 : 1;
    ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(X - 5, Y + 1, 10, 1);
    ctx.fillStyle = d.hona ? '#9a7650' : '#e8e2d4'; ctx.fillRect(X - 4, Y - 3, 8, 3); ctx.fillStyle = d.hona ? '#7a5a3a' : '#8a7a68'; ctx.fillRect(X - 4 * s - (s < 0 ? 0 : 0), Y - 3, 1, 2);
    ctx.fillStyle = d.hona ? '#9a7650' : '#2a7a3a'; ctx.fillRect(X + 3 * s - (s < 0 ? 1 : 0), Y - 6, 2, 3);
    ctx.fillStyle = '#f0a030'; ctx.fillRect(X + 5 * s - (s < 0 ? 1 : 0), Y - 5, 1, 1);
    ctx.fillStyle = '#1a1a1e'; ctx.fillRect(X + 4 * s - (s < 0 ? 1 : 0), Y - 5, 1, 1);
  };
  const KIT = propKit();
  // vattenskålen för hundar utanför kattcaféet
  const drawSkal = (ctx, s) => { ctx.fillStyle = 'rgba(20,12,30,.25)'; ctx.fillRect(s.x - 5, s.y, 10, 2); ctx.fillStyle = '#3a7bd5'; ctx.fillRect(s.x - 5, s.y - 3, 10, 3); ctx.fillStyle = '#6aa8e8'; ctx.fillRect(s.x - 5, s.y - 3, 10, 1); ctx.fillStyle = '#9ad8f8'; ctx.fillRect(s.x - 3, s.y - 3, 6, 1); ctx.fillStyle = '#f4f1ea'; ctx.fillRect(s.x - 1, s.y - 2, 3, 1); };
  const drawSmatt = (ctx, s) => s.typ === 'brandpost' ? KIT.hydrant(ctx, s.x, s.y) : s.typ === 'korg' ? KIT.bin(ctx, s.x, s.y) : s.typ === 'kafebord' ? KIT.cafe(ctx, s.x, s.y, [0xe0a030, 0xf4ece0]) : s.typ === 'blomlada' ? KIT.flowerBox(ctx, s.x, s.y, s.w, s.cols) : s.typ === 'tavla' ? ritaGatupratare(ctx, s.x, s.y) : s.typ === 'pudel' ? ritaPudelbuske(ctx, s.x, s.y) : drawSkal(ctx, s);
  const vind = (x) => Math.round(Math.sin(t * 0.9 + x * 0.01) * 0.6);
  const drawSkylt = (ctx) => {
    const { x, y } = SKYLT, s = $t('TASSBACKEN'), w = textW(SMALL, s) + 14;
    ctx.fillStyle = '#5a5e66'; ctx.fillRect(x - 1, y - 22, 2, 22);
    ctx.fillStyle = '#1e1a24'; ctx.fillRect(x - (w >> 1) - 1, y - 37, w + 2, 16); ctx.fillStyle = '#f4f1ea'; ctx.fillRect(x - (w >> 1), y - 36, w, 14);
    ctxText(ctx, SMALL, s, x - (w >> 1) + 11, y - 33, '#1e1a24');
    ctx.fillStyle = '#d87a3a'; for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1], [-1, -2], [1, -3], [3, -2], [-2, 0], [3, 0]]) ctx.fillRect(x - (w >> 1) + 4 + dx, y - 29 + dy, 1, 1);
    // vägvisaren österut: PIXELSTADEN med en ritad pil
    const p = $t('PIXELSTADEN'), pw = textW(SMALL, p);
    ctx.fillStyle = 'rgba(20,18,26,.75)'; ctx.fillRect(x - (pw >> 1) - 4, y - 48, pw + 14, 9);
    ctxText(ctx, SMALL, p, x - (pw >> 1) - 2, y - 46, '#f4f1ea');
    ctx.fillStyle = '#f4f1ea'; ctx.fillRect(x + (pw >> 1) + 2, y - 44, 4, 1); ctx.fillRect(x + (pw >> 1) + 4, y - 45, 1, 3); ctx.fillRect(x + (pw >> 1) + 5, y - 44, 1, 1);
  };

  const FJARILAR = [...RABATTER.map((r) => [r.x, r.y]), ...BUSKAR.slice(0, 4).map((b) => [b.x, b.y - 4])];
  function night() { const h = g.min / 60; return h >= 20 || h < 5.5; }
  function dusk() { const h = g.min / 60; return (h >= 18 && h < 20) || (h >= 5.5 && h < 7); }

  return {
    viewMax: { w: TW, h: TH },   // fyll-läget: hela skärmen (som staden)
    get worldX() { return walker.px; }, get worldY() { return walker.py; },
    get worldRide() { const F = fordon(); return F ? { id: F.id, c: F.c } : null; },
    rideChanged: applyRide,
    update(dt) {
      t += dt; banner += dt;
      VW = Math.max(384, Math.min(A.W || 384, TW)); VH = Math.max(160, Math.min(A.H || 216, TH));
      if (fade.phase === 1) { fade.a = Math.min(1, fade.a + dt * 2.6); if (fade.a >= 1) { fade.phase = 0; const cb = fade.cb; fade.cb = null; cb?.(); return; } }
      else if (fade.phase === 2) { fade.a = Math.max(0, fade.a - dt * 1.8); if (fade.a <= 0) fade.phase = 0; walker.update(dt); }
      else walker.update(dt);
      // östra kanten = tillbaka in i staden
      if (fade.phase === 0 && walker.px >= TW - 6 && walker.path.length) tillStan();
      updLiv(dt);
      if (pets) try { pets.update(dt, walker.px, walker.py, (x, y) => walker.walkable(x, y)); } catch (e) { console.error('husdjuren i Tassbacken:', e); pets = null; }
      const c = camTarget(); cam.x += (c.x - cam.x) * Math.min(1, dt * 8); cam.y += (c.y - cam.y) * Math.min(1, dt * 8);
    },
    draw(ctx) {
      ctx.setTransform(A.pxs, 0, 0, A.pxs, 0, 0);
      ctx.imageSmoothingEnabled = false;
      const N = night(), D = dusk();
      const cx = Math.round(cam.x), cy = Math.round(cam.y);
      ctx.drawImage(skyCanvas(VW, N, D), 0, Math.min(0, -cy * 0.3));
      const bk = backeCanvas(N), off = -Math.round(cx * 0.5) % bk.width;
      for (let x = off; x < VW; x += bk.width) ctx.drawImage(bk, x, -10 - Math.round(cy * 0.7));
      ctx.drawImage(ground(), -cx, -cy);
      ctx.save(); ctx.translate(-cx, -cy);
      const items = [];
      for (const id of HUSLISTA) { const p = husPos(id); if (p.x > cx + VW + 20 || p.x + HUS[id].w + 20 < cx) continue; items.push({ fy: T.BASE - 1, draw: () => ctx.drawImage(husBild(id, N), p.x, p.y) }, { fy: T.BASE - 0.9, draw: () => husLiv(ctx, id, p.x, p.y, t, N) }); }
      for (const k of katter) items.push({ fy: k.y < T.BASE ? T.BASE - 0.2 : k.y, draw: () => drawPet(ctx, k.x, k.y, k.p, k.anim, t, k.dir) });
      const syns = (x, m = 50) => x > cx - m && x < cx + VW + m;
      for (const tr of TRAD) if (syns(tr.x)) items.push({ fy: tr.y, draw: () => KIT.tree(ctx, tr.kind, tr.x, tr.y, { vind: vind(tr.x) }) });
      for (const tr of GALLERTRAD) if (syns(tr.x)) items.push({ fy: tr.y, draw: () => KIT.tree(ctx, tr.kind, tr.x, tr.y, { grate: true, vind: vind(tr.x) }) });
      for (const b of BANKAR) if (syns(b.x)) items.push({ fy: b.y, draw: () => KIT.bench(ctx, b.x, b.y) });
      for (const l of LYKTOR) if (syns(l.x)) items.push({ fy: l.y, draw: () => KIT.lamp(ctx, l.x, l.y, 1) });
      for (const s of SMATT) if (syns(s.x)) items.push({ fy: s.y, draw: () => drawSmatt(ctx, s) });
      for (const d of [...fenceDrawables(PARK, VIT, GRIND), ...fenceDrawables(RASTGARD, TRA)]) items.push({ fy: d.fy, draw: () => d.draw(ctx) });
      for (const a of AGILITY) items.push({ fy: a.y, draw: () => drawAgility(ctx, a) });
      [[RASTGARD[0] + 150, RASTGARD[1] + 40], [RASTGARD[0] + 190, RASTGARD[1] + 40]].forEach(([kx, ky], i) => items.push({ fy: ky, draw: () => ritaKoja(ctx, kx, ky, i) }));
      const burX = RASTGARD[0] + 52, burY = RASTGARD[3] - 8;
      items.push({ fy: burY - 24, draw: () => ritaBurBak(ctx, burX, burY) }, { fy: burY + 0.5, draw: () => ritaBurFram(ctx, burX, burY) });
      for (const l of PARKLAMPOR) if (syns(l.x)) items.push({ fy: l.y, draw: () => ritaParklykta(ctx, l, N) });
      for (const b of BUSKAR) if (syns(b.x)) items.push({ fy: b.y, draw: () => ritaBuske(ctx, b) });
      for (const p of PARKPRYL) if (syns(p.x)) items.push({ fy: p.y, draw: () => ritaParkPryl(ctx, p, t) });
      if (syns(GRIND[0])) items.push({ fy: PARK[1] + 0.5, draw: () => ritaGrindskylt(ctx, GRIND[0], GRIND[1], PARK[1]) });
      items.push({ fy: 1e5, draw: () => ritaFjarilar(ctx, t, FJARILAR) });
      items.push({ fy: STATY.y + 10, draw: () => drawStaty(ctx) });
      for (const d of ander) { const p = andPos(d); items.push({ fy: p.y, draw: () => drawAnd(ctx, d) }); }
      for (const d of [...parkhund, ...gardhund]) items.push({ fy: d.y, draw: () => drawPet(ctx, d.x, d.y, d.p, d.state === 'ga' ? (d.spring ? 'run' : 'walk') : d.state === 'lek' ? 'play' : 'idle', t, d.dir) });
      for (const k of kaniner) items.push({ fy: k.y, draw: () => drawPet(ctx, k.x, k.y, k.p, 'idle', t, k.dir) });
      for (const p of parkfolk) items.push({ fy: p.y, draw: () => drawPerson(ctx, p.x, p.y, p.look, 'down', Math.sin(t * 2 + p.x) > 0.9 ? 4 : 0) });
      for (const o of agare) {
        const h = hundVid(o), ga = o.vila <= 0, anim = ga ? 'walk' : 'idle';
        items.push({ fy: o.y, draw: () => { drawPerson(ctx, o.x, o.y, o.look, o.dir, ga ? WALK_SEQ[Math.floor(t * 8.5 + o.x) % 4] : 0); } });
        items.push({ fy: h.y, draw: () => { drawPet(ctx, h.x, h.y, o.hund, anim, t, o.dir); const n = petNeck(o.hund, anim, t, o.dir); ctx.fillStyle = '#d8343c'; const hx = o.x + (o.dir === 'right' ? 3 : -3), hy = o.y - 13, ex = h.x + n.x, ey = h.y + n.y; for (let k = 0; k <= 8; k++) { const u = k / 8; ctx.fillRect(Math.round(hx + (ex - hx) * u), Math.round(hy + (ey - hy) * u + Math.sin(u * Math.PI) * 3), 1, 1); } } });
      }
      items.push({ fy: HALLPLATS.y, draw: () => ritaHallplats(ctx, HALLPLATS.x, HALLPLATS.y) }, { fy: SKYLT.y, draw: () => drawSkylt(ctx) });
      items.push(...folkDrawables(A, t));
      if (pets) for (const d of pets.drawables()) items.push({ fy: d.fy ?? d.y, draw: () => d.draw(ctx) });
      const F = fordon();
      items.push(selfDrawable(A, walker, t, { folksHere: worldFolksHere(A).length, ride: F ? { id: F.id, c: F.c } : null }));
      items.sort((a, b) => a.fy - b.fy).forEach((d) => d.draw(ctx));
      ctx.restore();
      // kvällen och natten: mörker, lyktornas sken
      if (N || D) {
        ctx.fillStyle = N ? 'rgba(12,16,48,0.55)' : 'rgba(60,40,90,0.2)'; ctx.fillRect(0, 0, VW, VH);
        if (D) { ctx.fillStyle = 'rgba(255,140,80,0.10)'; ctx.fillRect(0, 0, VW, VH); }
        ctx.save(); ctx.translate(-cx, -cy);
        for (const l of LYKTOR) if (l.x > cx - 40 && l.x < cx + VW + 40) KIT.lampGlow(ctx, l.x, l.y, N ? 1 : 0.5);
        if (N) for (const l of PARKLAMPOR) if (l.x > cx - 40 && l.x < cx + VW + 40) parklyktaSken(ctx, l);
        if (N) for (const id of HUSLISTA) { const p = husPos(id); if (p.x > cx + VW + 20 || p.x + HUS[id].w + 20 < cx) continue; husSken(ctx, id, p.x, p.y, t); }
        ctx.restore();
      }
      ctx.save(); ctx.translate(-cx, -cy); talk.draw(ctx, { x0: cx, x1: cx + VW }); ctx.restore();
      if (banner < 4) { const a = banner < 0.4 ? banner / 0.4 : banner > 3.4 ? (4 - banner) / 0.6 : 1; ctx.globalAlpha = Math.max(0, a); const s = $t('TASSBACKEN'), s2 = $t('DJURENS STADSDEL'), w = Math.max(textW(BIG, s, 2), textW(SMALL, s2)) + 20; ctx.fillStyle = 'rgba(20,18,26,.85)'; ctx.fillRect((VW - w) >> 1, 26, w, 30); ctxText(ctx, BIG, s, (VW - textW(BIG, s, 2)) >> 1, 30, '#f4a8c8', 2); ctxText(ctx, SMALL, s2, (VW - textW(SMALL, s2)) >> 1, 48, '#f4f1ea'); ctx.globalAlpha = 1; }
      const s = hover && spotAt(hover.x + cx, hover.y + cy);
      if (s) { const w = textW(SMALL, s.label) + 10, x = Math.round(Math.max(2, Math.min(VW - w - 2, hover.x - w / 2))), y = Math.max(2, hover.y - 22); ctx.fillStyle = 'rgba(20,18,26,.9)'; ctx.fillRect(x, y, w, 11); ctxText(ctx, SMALL, s.label, x + 5, y + 3, '#ffd23f'); }
      if (fade.a > 0) { ctx.fillStyle = `rgba(10,10,16,${fade.a.toFixed(2)})`; ctx.fillRect(0, 0, VW, VH); }
    },
    down(sx, sy) {
      if (fade.phase === 1) return;
      hover = { x: sx, y: sy };
      const x = sx + cam.x, y = sy + cam.y;
      const d = djurAt(x, y);
      if (d) {
        const inne = (pen) => pen && x > pen[0] && x < pen[2] && y > pen[1] && y < pen[3];
        // djuren bakom staket: man ställer sig vid staketet; änderna: vid strandkanten
        const mal = d.sort === 'and' ? [d.x, Math.min(T.BOTTOM - 2, DAMM.y + DAMM.ry + 8)] : inne(PARK) && !inne(RASTGARD) && d.y > PARK[1] ? [Math.max(PARK[0] + 8, Math.min(PARK[2] - 8, d.x)), d.y + 10] : inne(RASTGARD) ? [Math.max(RASTGARD[0] + 8, Math.min(RASTGARD[2] - 8, d.x)), RASTGARD[3] + 8] : d.y < T.BASE ? [d.x, T.BASE + 8] : [d.x + (walker.px < d.x ? -14 : 14), Math.min(T.BOTTOM - 2, d.y + 6)];
        walker.walkTo(mal[0], mal[1], () => { prata(d); if (d.agare) setTimeout(() => talk.say(d.agare.rad, () => ({ x: d.agare.x, y: d.agare.y - 34 }), 3.5, { voice: d.agare.look }), 900); });
        return;
      }
      const o = agareAt(x, y);
      if (o) { walker.walkTo(o.x + (walker.px < o.x ? -14 : 14), o.y + 2, () => talk.say(o.rad, () => ({ x: o.x, y: o.y - 34 }), 3.5, { voice: o.look })); return; }
      const s = spotAt(x, y);
      if (s) { walker.walkTo(s.go[0], s.go[1], s.act); return; }
      if (x > TW - 10) { walker.walkTo(TW - 3, Math.max(T.SIDEWALK_N[0] + 4, Math.min(T.SIDEWALK_S[1] - 4, y)), tillStan); return; }
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
      pets: () => pets?._debug?.followers?.() || [],
      djur: () => allaDjur().map((d) => ({ sort: d.sort, x: Math.round(d.x), y: Math.round(d.y) })),
      prat: () => talk.text(),
      fade: () => fade.phase,
    },
  };
}
// efter agilityloppet (js/scenes/agility.js): placeringen i cupen, rosetten och priset
function efterAgility(A, petId, res) {
  const g = A.game, S = petStore(), p = S.petById(petId);
  A.tassFran = { park: true };
  A.go('tassbacken');
  if (!p || !res) return;
  const { plats, alla } = agilityPlacering(g.day, res.fel, res.tid);
  const b = belona(g, S, p, 'agility', plats);
  p.utst.agilityDag = g.day; S.save();
  visaResultat(p.name, { icon: '🐕', namn: $t('Agilitycupen') }, plats, alla.map((x) => (x.du ? `<b>${esc(p.name)}</b>` : esc(x.namn))), alla.map((x) => $t`${x.fel} fel · ${x.tid.toFixed(1).replace('.', ',')} s`), b);
}
// marken målas en gång
let GROUND = null;
const ground = () => (GROUND ||= paintGround());
