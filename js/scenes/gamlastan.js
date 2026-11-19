// 🏛️ GAMLA STAN – stadens äldsta kvarter (Carl 2026-11-18: "kan vi bygga gamla stan … kullersten, bibliotek, museum,
// teater med skådespelarjobb, antikaffär, kvällsmarknad"). Kartan, marken och takåsarna: js/gamlastan/karta.js, husen:
// js/gamlastan/hus.js. Man åker hit med den gamla bussen från vilken hållplats som helst i stan (city.js, raden
// "GAMLA STAN") och tillbaka från hållplatsen vid Stadsporten.
//
// Steg 1 (den här versionen): platsen. STORGATAN med de gamla husen vägg i vägg, STORTORGET med brunnen (släng en
// krona och önska), kvällsmarknaden 16–22 med bröd, blommor, honung, keramik och ljus, gatumusikanten med dragspelet,
// sagoberätterskan på bänken på kvällen, duvorna som lyfter när man kommer nära, guiden vid museet och folk som
// berättar om kvarteret. Husens dörrar berättar vad som öppnar i nästa steg (biblioteket, museet, teatern …).
import { createCityWalker } from '../city/walk.js';
import { selfDrawable, folkDrawables, folkTapAt, createSpeech, WALK_SEQ, synligRuta } from './walkable.js';
import { openSpelarkort } from '../core/vannerapp.js';
import { worldFolksHere } from '../net/world.js';
import { openModal, closeModal, toast, modalOpen } from '../core/ui.js';
import { play } from '../core/sound.js';
import { SMALL, BIG, ctxText, textW, hash } from '../core/floor-pix.js';
import { busStopById, BUS_STOPS } from '../city/map.js';
import { fmt } from '../game.js';
import { drawPerson, makeLook } from '../core/people.js';
import { createPetWalk } from '../pets/outdoors.js';
import { skyCanvas } from '../landet/karta.js';
import { propKit } from '../city/props.js';
import { TW, TH, G, HUS, HUSLISTA, TORG, BRUNN, STAND, MUSIKANT, SAGOBANK, BANKAR, LYKTOR, TORGLYKTOR, TRAD, HALLPLATS, SKYLT, KAFEBORD, BLOMLADOR, DUVOR, MARKNAD, hinder, takCanvas, paintGround } from '../gamlastan/karta.js';
import { ritaHus, husLiv, husSken } from '../gamlastan/hus.js';
import { $t } from '../core/i18n.js';

const GANG = 110, BUSS = 10;
const FOLKRAD = [
  $t('Visste du att Biblioteket är stans äldsta hus?'), $t('Kullerstenen är från 1600-talet, säger guiden.'), $t('Kvällsmarknaden öppnar klockan fyra!'),
  $t('Teatern spelar Tummelisa i helgen.'), $t('Jag köpte honung på torget – bästa i stan.'), $t('Hör du dragspelet? Han står där varje dag.'),
  $t('Titta upp – husen lutar lite, men de har stått i trehundra år.'), $t('På kvällen tänds alla lyktor. Då är det som finast här.'),
];
const GUIDE_RAD = [$t('Välkommen till Gamla stan! Huset bakom mig är från 1699 – titta på årtalet i gaveln.'), $t('Stadsporten var stadens enda ingång förr. Klockan har gått rätt sedan dess.'), $t('Brunnen på torget gav vatten åt hela staden. Släng i en krona och önska något!')];
const SAGOR = [$t('… och så hittade katten kronan högst upp i Tornhuset. Slut för i dag!'), $t('Det var en gång en liten husvagn som ville bli en villa …'), $t('Långt borta på Pixelberg bodde ett spöke som var rädd för mörkret …')];
const DORR_RAD = {
  bibliotek: $t('Biblioteket öppnar snart – här ska du kunna läsa dig klokare, med poäng till livsmålet Utbildning.'),
  museum: $t('Museet öppnar snart: Pixelstadens historia, från fiskeläge till storstad.'),
  antik: $t('Antikaffären öppnar snart – gamla möbler, tavlor och klockor till hemmet.'),
  kafe: $t('Gamla Kaféet öppnar snart. Det doftar kanel genom brevinkastet.'),
  teater: $t('Teatern öppnar snart – då får du stå på scenen själv!'),
  guldsmed: $t('Guldsmeden öppnar snart – ringar och halsband i äkta guld.'),
  lyktmakare: $t('Lyktmakaren öppnar snart – lyktor till trädgården och hemmet.'),
  valv: $t('Gränden leder upp till domkyrkan. Avspärrad i dag – de lagar trappan.'),
  port: $t('STADSPORTEN – här började staden. Klockan har gått rätt sedan 1699.'),
  bostad: [$t('Här bor någon. Det luktar nybakat bröd.'), $t('Dörren är låst. En katt tittar ner på dig från fönstret.'), $t('Någon spelar piano där inne.'), $t('"Varsågod och knacka", står det på en lapp. Men ingen öppnar.')],
};
const VAROR = {
  brod: { namn: $t('Kanelbulle'), pris: 8, rad: $t('Nybakade kanelbullar, åtta kronor! Varma ur ugnen.'), tack: $t('Mums! Varm och kladdig.'), eff: (g) => { g.hunger = Math.min(100, (g.hunger || 0) + 18); } },
  blommor: { namn: $t('En ros'), pris: 10, rad: $t('En ros till någon du tycker om? Tio kronor.'), tack: $t('Du håller rosen under näsan. Den doftar sommar.'), eff: (g) => g.glad?.(2, $t('En ros från torget'), 'gsros', 2) },
  honung: { namn: $t('Burk honung'), pris: 15, rad: $t('Honung från bikuporna på landet. Smaka!'), tack: $t('Sött och klibbigt. Du slickar skeden ren.'), eff: (g) => { g.hunger = Math.min(100, (g.hunger || 0) + 10); g.glad?.(1, '', 'gshonung', 2); } },
  keramik: { namn: $t('Liten skål'), pris: 20, rad: $t('Muggar och skålar, drejade här i kvarteret.'), tack: $t('En blå skål med vita prickar. Den får stå på köksbordet.'), eff: (g) => g.glad?.(2, $t('En skål från marknaden'), 'gsskal', 2) },
  ljus: { namn: $t('Doftljus'), pris: 12, rad: $t('Handstöpta ljus – de doftar lavendel.'), tack: $t('Lavendel! Nu doftar hela väskan.'), eff: (g) => g.glad?.(1, '', 'gsljus', 2) },
};

export function makeGamlastan(A) {
  const g = A.game;
  let VW = Math.max(384, Math.min(A.W || 384, TW)), VH = Math.max(160, Math.min(A.H || 216, TH));
  const from = A.gamlaFran || null; A.gamlaFran = null;
  const walker = createCityWalker({ W: TW, H: TH, left: 2, right: TW - 2, top: G.TOP, bottom: G.BOTTOM, spawn: [HALLPLATS.x - 26, HALLPLATS.y - 14] });
  const fordon = () => g.aker;
  const applyRide = () => { const F = fordon(); walker.speed = GANG * (F ? F.fart : 1); };
  applyRide();
  walker.setObstacles(hinder());
  walker.snapFree();
  const talk = createSpeech();
  let t = 0, hover = null, banner = 0;
  const fade = { a: 1, phase: 2, cb: null };
  const cam = { x: 0, y: 0 };
  const camTarget = () => { const S = synligRuta(VH); return { x: Math.max(0, Math.min(TW - VW, walker.px - VW / 2)), y: Math.max(0, Math.min(Math.max(0, TH - S.y1), walker.py - S.y0 - S.h * (S.h < VH - 8 ? 0.72 : 0.8))) }; };
  Object.assign(cam, camTarget());
  if (!A.attract) { const h = g.glad?.(2, '', 'gamlastan', 2); if (h) setTimeout(() => toast($t`🏛️ Gamla stan – kullersten och lyktor! +${h} 😊`, 'good'), 900); }
  let pets = null;
  try { pets = createPetWalk(A); } catch (e) { console.error('husdjuren i Gamla stan startade inte:', e); }
  const hour = () => g.min / 60;
  const marknad = () => hour() >= MARKNAD[0] && hour() < MARKNAD[1];
  const kvall = () => hour() >= 18 && hour() < 22;
  const night = () => hour() >= 20 || hour() < 5.5;
  const dusk = () => (hour() >= 18 && hour() < 20) || (hour() >= 5.5 && hour() < 7);

  // ---------- folket ----------
  const rnd = (a, b) => a + Math.random() * (b - a);
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const folk = [0, 1, 2, 3, 4, 5, 6].map((i) => ({ look: makeLook(), x: 120 + i * 230, y: i % 2 ? 286 : 216 + (i % 3) * 8, dir: i % 2 ? 'left' : 'right', fart: rnd(20, 30), vila: 0, rad: FOLKRAD[i % FOLKRAD.length] }));
  const guide = { look: { ...makeLook(), hat: 'cap', shirt: '#8a2a2a' }, x: HUS.museum.x + 30, y: G.BASE + 14, k: 0 };
  const musikant = { look: makeLook(), x: MUSIKANT.x, y: MUSIKANT.y, spelar: 0 };
  const saga = { look: { ...makeLook(), hair: '#d8d8d8', style: 'bun' }, x: SAGOBANK.x, y: SAGOBANK.y, barn: [{ look: { ...makeLook(), kid: true }, x: SAGOBANK.x - 18, y: SAGOBANK.y + 14 }, { look: { ...makeLook(), kid: true }, x: SAGOBANK.x + 14, y: SAGOBANK.y + 16 }], k: 0, sagaT: 0 };
  const saljare = STAND.map((s, i) => ({ look: { ...makeLook(), apron: true }, x: s.x + 6, y: s.y - 12, stand: s }));
  const duvor = DUVOR.map(([x, y], i) => ({ x, y, hx: x, hy: y, dir: i % 2 ? 'left' : 'right', pick: rnd(0, 2), flyg: 0, borta: 0 }));
  const noter = [];   // dragspelets toner
  function updLiv(dt) {
    for (const o of folk) {
      if (o.vila > 0) { o.vila -= dt; continue; }
      o.x += (o.dir === 'right' ? 1 : -1) * o.fart * dt;
      if (o.x > TW - 70) { o.dir = 'left'; o.vila = rnd(1, 3); }
      if (o.x < 70) { o.dir = 'right'; o.vila = rnd(1, 3); }
      if (Math.random() < dt * 0.03) o.vila = rnd(2, 5);
    }
    if (musikant.spelar > 0) { musikant.spelar -= dt; if (Math.random() < dt * 4) noter.push({ x: musikant.x + rnd(-6, 8), y: musikant.y - 30, t: 0, k: Math.random() < 0.5 ? '♪' : '♫' }); }
    for (const n of noter) n.t += dt;
    while (noter.length && noter[0].t > 2.2) noter.shift();
    // duvorna pickar, hoppar till och flyger upp när någon kommer nära
    for (const d of duvor) {
      if (d.borta > 0) { d.borta -= dt; if (d.borta <= 0) { d.x = d.hx; d.y = d.hy; d.flyg = 0; } continue; }
      if (d.flyg > 0) { d.flyg += dt; d.x += (d.dir === 'left' ? -1 : 1) * 60 * dt; d.y -= 40 * dt; if (d.flyg > 1.6) d.borta = rnd(6, 14); continue; }
      const nara = Math.hypot(walker.px - d.x, walker.py - d.y) < 26 || folk.some((o) => Math.hypot(o.x - d.x, o.y - d.y) < 14);
      if (nara) { d.flyg = 0.01; play('click'); continue; }
      d.pick -= dt;
      if (d.pick <= 0) { d.pick = rnd(0.8, 2.5); if (Math.random() < 0.4) { d.x += rnd(-4, 4); d.y += rnd(-2, 2); d.dir = Math.random() < 0.5 ? 'left' : 'right'; } }
    }
    if (kvall()) { saga.sagaT -= dt; if (saga.sagaT <= 0) { saga.sagaT = rnd(14, 26); if (Math.hypot(walker.px - saga.x, walker.py - saga.y) < 160) talk.say(SAGOR[saga.k++ % SAGOR.length], () => ({ x: saga.x, y: saga.y - 36 }), 4, { voice: saga.look }); } }
  }

  // ---------- platserna man kan klicka på ----------
  const dorr = (id) => { const h = HUS[id]; return { r: [h.door.x0 - 4, G.BASE - 40, h.door.x1 + 4, G.BASE], go: [(h.door.x0 + h.door.x1) / 2, G.BASE + 8] }; };
  const knacka = (id) => () => { const h = HUS[id]; play('knock'); const rad = DORR_RAD[h.typ === 'bostad' ? 'bostad' : id] || DORR_RAD.bostad; talk.say(Array.isArray(rad) ? rad[(h.x / 7 | 0) % rad.length] : rad, () => ({ x: (h.door.x0 + h.door.x1) / 2, y: G.BASE - 52 }), 4.5, { silent: true }); };
  const spots = () => [
    ...HUSLISTA.map((id) => ({ id, ...dorr(id), label: HUS[id].namn || $t('BOSTADSHUS'), act: knacka(id) })),
    { id: 'brunn', r: [BRUNN.x - 20, BRUNN.y - 44, BRUNN.x + 20, BRUNN.y + 8], go: [BRUNN.x, BRUNN.y + 16], label: $t('BRUNNEN – SLÄNG EN KRONA'), act: brunnen },
    { id: 'musikant', r: [MUSIKANT.x - 10, MUSIKANT.y - 34, MUSIKANT.x + 10, MUSIKANT.y + 2], go: [MUSIKANT.x - 16, MUSIKANT.y + 4], label: $t('GATUMUSIKANTEN – GE EN SLANT'), act: musiken },
    { id: 'guide', r: [guide.x - 8, guide.y - 34, guide.x + 8, guide.y + 2], go: [guide.x + 14, guide.y + 2], label: $t('STADSGUIDEN'), act: () => talk.say(GUIDE_RAD[guide.k++ % GUIDE_RAD.length], () => ({ x: guide.x, y: guide.y - 36 }), 4.5, { voice: guide.look }) },
    ...(kvall() ? [{ id: 'saga', r: [saga.x - 24, saga.y - 34, saga.x + 24, saga.y + 18], go: [saga.x + 30, saga.y + 10], label: $t('SAGOSTUNDEN'), act: () => { talk.say(SAGOR[saga.k++ % SAGOR.length], () => ({ x: saga.x, y: saga.y - 36 }), 4.5, { voice: saga.look }); const h = g.glad?.(2, $t('Sagostund på torget'), 'gssaga', 2); if (h) toast(`😊 +${h}`); } }] : []),
    ...STAND.map((s) => ({ id: s.id, r: [s.x - 22, s.y - 36, s.x + 22, s.y + 2], go: [s.x, s.y + 12], label: marknad() ? `${VAROR[s.typ].namn.toUpperCase()} · ${fmt(VAROR[s.typ].pris)}` : $t('KVÄLLSMARKNADEN ÖPPNAR 16'), act: () => standet(s) })),
    { id: 'buss', r: [HALLPLATS.x - 12, HALLPLATS.y - 36, HALLPLATS.x + 14, HALLPLATS.y + 2], go: [HALLPLATS.x - 8, HALLPLATS.y - 10], label: $t('GAMLA BUSSEN TILL STAN'), act: bussen },
  ];
  // 🪙 brunnen: en krona och en önskan ger tur (😊) en gång om dagen
  function brunnen() {
    if (g.money < 1) { toast($t('Du har inte ens en krona …'), 'bad'); return; }
    g.money -= 1; g.save(); play('coin');
    const h = g.glad?.(3, $t('En önskan i brunnen'), 'gsbrunn', 3) || 0;
    talk.say($t('*plums*'), () => ({ x: BRUNN.x, y: BRUNN.y - 44 }), 1.6, { silent: true });
    toast(h ? $t`🪙 Plums! Du blundar och önskar dig något – det ger tur! +${h} 😊` : $t('🪙 Plums! Kronan sjunker ner till de andra. (Turen kommer en gång om dagen.)'), h ? 'good' : '');
  }
  function musiken() {
    if (g.money < 2) { toast($t('Du har inga slantar att ge.'), 'bad'); return; }
    g.money -= 2; g.save(); play('coin');
    musikant.spelar = 8;
    talk.say($t('Tack! Den här är för dig.'), () => ({ x: musikant.x, y: musikant.y - 36 }), 2.5, { voice: musikant.look });
    const h = g.glad?.(2, $t('Dragspel på torget'), 'gsmusik', 2); if (h) setTimeout(() => toast(`🎵 +${h} 😊`), 1200);
  }
  function standet(s) {
    const v = VAROR[s.typ], sal = saljare.find((q) => q.stand === s);
    if (!marknad()) { talk.say($t`Stängt. Kvällsmarknaden öppnar klockan ${MARKNAD[0]}.`, () => ({ x: s.x, y: s.y - 40 }), 2.5, { silent: true }); return; }
    talk.say(v.rad, () => ({ x: sal.x, y: sal.y - 36 }), 3, { voice: sal.look });
    openModal(`🏮 ${v.namn}`, `<p style="font-size:var(--f2);margin-top:0">${v.rad}</p><p style="font-size:var(--f2)">💰 <b>${fmt(g.money)}</b></p>`, [
      { label: $t`Köp · ${fmt(v.pris)}`, cls: g.money >= v.pris ? 'btn-go' : '', disabled: g.money < v.pris, onClick: () => { closeModal(); if (g.money < v.pris) return; g.money -= v.pris; v.eff(g); g.save(); play('coin'); toast(`✨ ${v.tack}`, 'good'); } },
      { label: $t('Nej tack'), onClick: closeModal },
    ]);
  }
  function bussen() {
    const hem = busStopById(from?.buss) || BUS_STOPS[0];
    openModal($t('🚌 Gamla bussen'), `<p style="font-size:var(--f2);margin-top:0">${$t`Bussen går tillbaka till <b>${$t(hem.name)}</b>. Biljetten kostar ${fmt(BUSS)}.`}</p>`, [
      { label: $t('🚌 Åk till stan'), cls: 'btn-go', onClick: () => { closeModal(); if (g.money < BUSS) { toast($t('Du har inte råd med bussen.'), 'bad'); return; } g.money -= BUSS; g.passTime(15); g.save(); play('door'); go(() => { A.cityPos = [hem.x + 6, hem.y - 2]; A.go('city'); }); } },   // (på trottoaren vid kuren)
      { label: $t('Stanna kvar'), onClick: closeModal },
    ]);
  }
  function go(cb) { if (fade.phase === 1) return; fade.phase = 1; fade.cb = cb; }
  const spotAt = (x, y) => spots().find((s) => x >= s.r[0] && x <= s.r[2] && y >= s.r[1] && y <= s.r[3]);
  const folkAt = (x, y) => folk.find((o) => Math.abs(o.x - x) < 7 && y < o.y + 2 && y > o.y - 30);

  // ---------- rekvisitan ----------
  const KIT = propKit();
  const sken = (ctx, x, y, r, col) => { const gr = ctx.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, col); gr.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = gr; ctx.fillRect(x - r, y - r, r * 2, r * 2); };
  // gammal gatlykta i smide: stolpe, arm och en lykta med glas
  const ritaLykta = (ctx, x, y, natt) => {
    ctx.fillStyle = 'rgba(20,12,30,.25)'; ctx.fillRect(x - 3, y, 7, 2);
    ctx.fillStyle = '#1c2026'; ctx.fillRect(x - 1, y - 30, 3, 30); ctx.fillRect(x - 3, y - 2, 7, 2); ctx.fillRect(x - 2, y - 24, 5, 1);
    ctx.fillStyle = '#434b56'; ctx.fillRect(x, y - 30, 1, 28);
    ctx.fillStyle = '#1c2026'; ctx.fillRect(x - 3, y - 40, 7, 10); ctx.fillRect(x - 4, y - 41, 9, 1); ctx.fillRect(x - 1, y - 43, 3, 2);
    ctx.fillStyle = natt ? '#ffe8a0' : '#d8e8f0'; ctx.fillRect(x - 2, y - 39, 5, 8);
    ctx.fillStyle = natt ? '#fff6d0' : '#eef4f8'; ctx.fillRect(x - 1, y - 38, 1, 6);
    ctx.fillStyle = '#434b56'; ctx.fillRect(x, y - 39, 1, 8);
  };
  const lyktSken = (ctx, x, y, a) => { ctx.globalCompositeOperation = 'lighter'; sken(ctx, x, y - 35, 34, `rgba(255,200,110,${(0.45 * a).toFixed(2)})`); sken(ctx, x, y - 2, 22, `rgba(255,190,100,${(0.18 * a).toFixed(2)})`); ctx.globalCompositeOperation = 'source-over'; };
  // marknadsstånd: bord, randig baldakin på fyra stolpar, varorna per sort, lyktor i baldakinen (tända när öppet)
  const STANDFARG = { brod: ['#d8a050', '#f4ecd8'], blommor: ['#e05888', '#f4ecd8'], honung: ['#f0c030', '#8a5a2a'], keramik: ['#3a7bd5', '#f4ecd8'], ljus: ['#8a5ad8', '#f4ecd8'] };
  const ritaStand = (ctx, s, oppet, natt) => {
    const { x, y } = s, [A1, B1] = STANDFARG[s.typ];
    ctx.fillStyle = 'rgba(20,12,30,.25)'; ctx.fillRect(x - 21, y, 42, 2);
    for (const px of [x - 20, x + 18]) { ctx.fillStyle = '#5e3a20'; ctx.fillRect(px, y - 38, 2, 38); ctx.fillStyle = '#86562e'; ctx.fillRect(px, y - 38, 1, 38); }
    ctx.fillStyle = '#86562e'; ctx.fillRect(x - 21, y - 12, 42, 12); ctx.fillStyle = '#ae7640'; ctx.fillRect(x - 21, y - 12, 42, 2); ctx.fillStyle = '#5e3a20'; ctx.fillRect(x - 21, y - 1, 42, 1);
    for (let i = -23; i < 23; i++) { ctx.fillStyle = ((i + 23) / 5 | 0) % 2 ? B1 : A1; const drop = [2, 3, 3, 2, 1][((i + 23) % 5)]; ctx.fillRect(x + i, y - 44, 1, 7 + drop); }
    ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(x - 23, y - 36, 46, 1);
    ctx.fillStyle = '#f4ecd8'; ctx.fillRect(x - 23, y - 45, 46, 1);
    if (oppet) {
      if (s.typ === 'brod') { for (let i = 0; i < 6; i++) { ctx.fillStyle = i % 2 ? '#d8a050' : '#c8863a'; ctx.fillRect(x - 17 + i * 6, y - 17, 5, 4); ctx.fillStyle = '#f0d8a0'; ctx.fillRect(x - 16 + i * 6, y - 17, 2, 1); } ctx.fillStyle = '#8a5a2a'; ctx.fillRect(x - 18, y - 13, 36, 1); }
      else if (s.typ === 'blommor') { for (let i = 0; i < 7; i++) { ctx.fillStyle = '#3e7e2a'; ctx.fillRect(x - 17 + i * 5, y - 20, 1, 8); ctx.fillStyle = ['#e0383c', '#f06aa0', '#ffffff', '#f0c030', '#9a5ad8', '#e0383c', '#f06aa0'][i]; ctx.fillRect(x - 18 + i * 5, y - 23, 3, 3); } ctx.fillStyle = '#5a8a3a'; ctx.fillRect(x - 19, y - 13, 38, 1); }
      else if (s.typ === 'honung') { for (let i = 0; i < 5; i++) { ctx.fillStyle = '#e8a820'; ctx.fillRect(x - 15 + i * 7, y - 19, 5, 6); ctx.fillStyle = '#f8d060'; ctx.fillRect(x - 14 + i * 7, y - 18, 1, 4); ctx.fillStyle = '#8a5a2a'; ctx.fillRect(x - 15 + i * 7, y - 20, 5, 1); } }
      else if (s.typ === 'keramik') { for (let i = 0; i < 5; i++) { ctx.fillStyle = ['#3a7bd5', '#f4ecd8', '#d87a3a', '#3a7bd5', '#46a35a'][i]; ctx.fillRect(x - 16 + i * 7, y - 18, 5, 5); ctx.fillStyle = '#ffffff'; ctx.fillRect(x - 15 + i * 7, y - 17, 1, 1); ctx.fillRect(x - 13 + i * 7, y - 15, 1, 1); } }
      else { for (let i = 0; i < 7; i++) { ctx.fillStyle = ['#f4ecd8', '#c8a8e8', '#f4ecd8', '#f0a0b8', '#f4ecd8', '#a8d0f0', '#f4ecd8'][i]; ctx.fillRect(x - 17 + i * 5, y - 20 + (i % 2) * 2, 3, 7 - (i % 2) * 2); ctx.fillStyle = '#f0c030'; ctx.fillRect(x - 16 + i * 5, y - 21 + (i % 2) * 2, 1, 1); } }
      for (const lx of [x - 14, x, x + 14]) { ctx.fillStyle = '#1c2026'; ctx.fillRect(lx - 1, y - 36, 3, 1); ctx.fillRect(lx - 2, y - 35, 5, 6); ctx.fillStyle = natt || dusk() ? '#ffe8a0' : '#f0c870'; ctx.fillRect(lx - 1, y - 34, 3, 4); }
    } else { ctx.fillStyle = '#8a8478'; ctx.fillRect(x - 20, y - 16, 40, 5); ctx.fillStyle = '#a8a296'; ctx.fillRect(x - 20, y - 16, 40, 1); }
  };
  // brunnen: stenring, två stolpar med litet tak, vev och hink på repet
  const ritaBrunn = (ctx) => {
    const { x, y } = BRUNN;
    ctx.fillStyle = 'rgba(20,12,30,.25)'; ctx.fillRect(x - 17, y + 7, 34, 2);
    for (let j = -8; j <= 8; j++) { const w = Math.round(16 * Math.sqrt(Math.max(0, 1 - (j / 8.5) ** 2))); ctx.fillStyle = j > 4 ? '#5a544c' : j < -4 ? '#b4aea4' : '#8a847a'; ctx.fillRect(x - w, y + j, w * 2, 1); }
    for (let j = -6; j <= 2; j++) { const w = Math.round(12 * Math.sqrt(Math.max(0, 1 - (j / 6.5) ** 2))); ctx.fillStyle = j < -4 ? '#1a2a3a' : '#2a4a6a'; ctx.fillRect(x - w, y + j - 2, w * 2, 1); }
    ctx.fillStyle = '#9ad8f8'; ctx.fillRect(x - 5 + ((t * 4 | 0) % 7), y - 5, 3, 1);
    for (const px of [x - 14, x + 12]) { ctx.fillStyle = '#5e3a20'; ctx.fillRect(px, y - 38, 3, 36); ctx.fillStyle = '#86562e'; ctx.fillRect(px, y - 38, 1, 36); }
    for (let j = 0; j < 7; j++) { const hw = 20 - j * 2; ctx.fillStyle = j % 2 ? '#8a3a2a' : '#b04c34'; ctx.fillRect(x - hw, y - 40 - j, hw * 2 + 1, 1); }
    ctx.fillStyle = '#434b56'; ctx.fillRect(x - 12, y - 28, 24, 2); ctx.fillStyle = '#646e7a'; ctx.fillRect(x + 12, y - 30, 2, 6); ctx.fillRect(x + 14, y - 31 + Math.round(Math.sin(t) * 2), 3, 1);
    const hy = y - 22 + Math.round(Math.sin(t * 0.7) * 5);
    ctx.fillStyle = '#d8d4c8'; ctx.fillRect(x, y - 27, 1, hy - (y - 27));
    ctx.fillStyle = '#5e3a20'; ctx.fillRect(x - 3, hy, 7, 5); ctx.fillStyle = '#86562e'; ctx.fillRect(x - 3, hy, 7, 1); ctx.fillStyle = '#434b56'; ctx.fillRect(x - 3, hy - 1, 1, 1); ctx.fillRect(x + 3, hy - 1, 1, 1);
  };
  const ritaDuva = (ctx, d) => {
    const X = Math.round(d.x), Y = Math.round(d.y), s = d.dir === 'left' ? -1 : 1, flyg = d.flyg > 0;
    ctx.fillStyle = 'rgba(20,12,30,.2)'; if (!flyg) ctx.fillRect(X - 3, Y, 6, 1);
    ctx.fillStyle = '#8a8c96'; ctx.fillRect(X - 3, Y - 4, 6, 3); ctx.fillStyle = '#b4b6c0'; ctx.fillRect(X - 2, Y - 4, 3, 1);
    ctx.fillStyle = '#6a6c76'; ctx.fillRect(X + 3 * s - (s < 0 ? 1 : 0), Y - 6, 2, 3); ctx.fillStyle = '#3a8a6a'; ctx.fillRect(X + 2 * s, Y - 4, 1, 1);
    ctx.fillStyle = '#f0a030'; ctx.fillRect(X + 5 * s - (s < 0 ? 1 : 0), Y - 5 + (d.pick < 0.3 && !flyg ? 1 : 0), 1, 1);
    if (flyg) { const up = Math.sin(d.flyg * 30) > 0; ctx.fillStyle = '#a8aab4'; ctx.fillRect(X - 5, Y - (up ? 8 : 3), 4, 1); ctx.fillRect(X + 2, Y - (up ? 8 : 3), 4, 1); }
    else { ctx.fillStyle = '#f0a030'; ctx.fillRect(X - 2, Y - 1, 1, 1); ctx.fillRect(X + 1, Y - 1, 1, 1); }
  };
  const ritaDragspel = (ctx, m) => {
    const X = Math.round(m.x), Y = Math.round(m.y), oppet = m.spelar > 0 ? 3 + Math.round(Math.sin(t * 6) * 3) : 2;
    ctx.fillStyle = '#8a1a24'; ctx.fillRect(X - 7, Y - 22, 4, 10); ctx.fillRect(X + 3 + oppet, Y - 22, 4, 10);
    ctx.fillStyle = '#f4ecd8'; for (let i = -3; i < 3 + oppet; i++) ctx.fillRect(X + i, Y - 21 + (i & 1), 1, 8);
    ctx.fillStyle = '#1c1a20'; ctx.fillRect(X - 6, Y - 20, 1, 1); ctx.fillRect(X - 6, Y - 17, 1, 1); ctx.fillRect(X - 6, Y - 14, 1, 1); ctx.fillStyle = '#f0c030'; ctx.fillRect(X - 5, Y - 23, 2, 1);
  };
  const vind = (x) => Math.round(Math.sin(t * 0.9 + x * 0.01) * 0.6);
  const drawSkylt = (ctx) => {
    const { x, y } = SKYLT, s = $t('GAMLA STAN'), w = textW(SMALL, s) + 14;
    ctx.fillStyle = '#5a5e66'; ctx.fillRect(x - 1, y - 22, 2, 22);
    ctx.fillStyle = '#1e1a24'; ctx.fillRect(x - (w >> 1) - 1, y - 37, w + 2, 16); ctx.fillStyle = '#f4ecd8'; ctx.fillRect(x - (w >> 1), y - 36, w, 14);
    ctxText(ctx, SMALL, s, x - (w >> 1) + 11, y - 33, '#1e1a24');
    ctx.fillStyle = '#c8a040'; for (const [dx, dy] of [[0, 0], [1, 0], [2, 0], [0, 1], [2, 1], [0, 2], [1, 2], [2, 2], [1, -1]]) ctx.fillRect(x - (w >> 1) + 4 + dx, y - 30 + dy, 1, 1);
  };
  const ritaHallplats = (ctx) => {
    const { x, y } = HALLPLATS;
    ctx.fillStyle = '#1c2026'; ctx.fillRect(x, y - 26, 2, 26); ctx.fillStyle = '#2a5aa8'; ctx.fillRect(x - 6, y - 34, 14, 9); ctx.fillStyle = '#f4ecd8'; ctx.fillRect(x - 5, y - 33, 12, 7);
    ctx.fillStyle = '#2a5aa8'; ctx.fillRect(x - 3, y - 31, 8, 1); ctx.fillRect(x - 3, y - 29, 6, 1); ctx.fillRect(x - 3, y - 28, 8, 1);
  };

  return {
    viewMax: { w: TW, h: TH },
    get worldX() { return walker.px; }, get worldY() { return walker.py; },
    get worldRide() { const F = fordon(); return F ? { id: F.id, c: F.c } : null; },
    rideChanged: applyRide,
    update(dt) {
      t += dt; banner += dt;
      VW = Math.max(384, Math.min(A.W || 384, TW)); VH = Math.max(160, Math.min(A.H || 216, TH));
      if (fade.phase === 1) { fade.a = Math.min(1, fade.a + dt * 2.6); if (fade.a >= 1) { fade.phase = 0; const cb = fade.cb; fade.cb = null; cb?.(); return; } }
      else if (fade.phase === 2) { fade.a = Math.max(0, fade.a - dt * 1.8); if (fade.a <= 0) fade.phase = 0; walker.update(dt); }
      else walker.update(dt);
      updLiv(dt);
      if (pets) try { pets.update(dt, walker.px, walker.py, (x, y) => walker.walkable(x, y)); } catch (e) { console.error('husdjuren i Gamla stan:', e); pets = null; }
      const c = camTarget(); cam.x += (c.x - cam.x) * Math.min(1, dt * 8); cam.y += (c.y - cam.y) * Math.min(1, dt * 8);
    },
    draw(ctx) {
      ctx.setTransform(A.pxs, 0, 0, A.pxs, 0, 0);
      ctx.imageSmoothingEnabled = false;
      const N = night(), D = dusk(), M = marknad(), K = kvall();
      const cx = Math.round(cam.x), cy = Math.round(cam.y);
      ctx.drawImage(skyCanvas(VW, N, D), 0, Math.min(0, -cy * 0.3));
      // takåsarna står strax bakom husraden (nästan ingen parallax – de är grannkvarteret, inte ett berg)
      const bk = takCanvas(N), off = -Math.round(cx * 0.6) % bk.width, by = Math.round(132 - bk.height - cy * 0.92);   // taken sticker upp ovanför husraden
      for (let x = off; x < VW; x += bk.width) ctx.drawImage(bk, x, by);
      ctx.drawImage(ground(), -cx, -cy);
      ctx.save(); ctx.translate(-cx, -cy);
      const items = [];
      const syns = (x, m = 60) => x > cx - m && x < cx + VW + m;
      for (const id of HUSLISTA) { const H = HUS[id]; if (H.x > cx + VW + 20 || H.x + H.w + 20 < cx) continue; items.push({ fy: G.BASE - 1, draw: () => ritaHus(ctx, id, N) }, { fy: G.BASE - 0.9, draw: () => husLiv(ctx, id, t, N) }); }
      for (const tr of TRAD) if (syns(tr.x)) items.push({ fy: tr.y, draw: () => KIT.tree(ctx, tr.kind, tr.x, tr.y, { vind: vind(tr.x) }) });
      for (const b of BANKAR) if (syns(b.x)) items.push({ fy: b.y, draw: () => KIT.bench(ctx, b.x, b.y) });
      items.push({ fy: SAGOBANK.y, draw: () => KIT.bench(ctx, SAGOBANK.x, SAGOBANK.y) });
      for (const l of [...LYKTOR, ...TORGLYKTOR]) if (syns(l.x)) items.push({ fy: l.y, draw: () => ritaLykta(ctx, l.x, l.y, N || D) });
      for (const k of KAFEBORD) items.push({ fy: k.y, draw: () => KIT.cafe(ctx, k.x, k.y, [0x46a35a, 0xf4ece0]) });
      for (const b of BLOMLADOR) items.push({ fy: b.y, draw: () => KIT.flowerBox(ctx, b.x, b.y, 28, ['red', 'white', 'yellow']) });
      for (const s of STAND) if (syns(s.x)) items.push({ fy: s.y, draw: () => ritaStand(ctx, s, M, N) });
      if (M) for (const s of saljare) items.push({ fy: s.y, draw: () => drawPerson(ctx, s.x, s.y, s.look, 'down', Math.sin(t * 2 + s.x) > 0.92 ? 4 : 0) });
      items.push({ fy: BRUNN.y + 8, draw: () => ritaBrunn(ctx) });
      for (const d of duvor) if (d.borta <= 0) items.push({ fy: d.y, draw: () => ritaDuva(ctx, d) });
      items.push({ fy: guide.y, draw: () => drawPerson(ctx, guide.x, guide.y, guide.look, 'down', Math.sin(t * 1.5) > 0.8 ? 10 : 0) });
      items.push({ fy: musikant.y, draw: () => { drawPerson(ctx, musikant.x, musikant.y, musikant.look, 'down', musikant.spelar > 0 ? (Math.floor(t * 4) % 2 ? 4 : 0) : 0); ritaDragspel(ctx, musikant); } });
      if (K) { items.push({ fy: saga.y + 0.5, draw: () => drawPerson(ctx, saga.x, saga.y - 2, saga.look, 'down', 5) }); for (const b of saga.barn) items.push({ fy: b.y, draw: () => drawPerson(ctx, b.x, b.y, b.look, 'up', 5) }); }
      for (const o of folk) items.push({ fy: o.y, draw: () => drawPerson(ctx, o.x, o.y, o.look, o.dir, o.vila <= 0 ? WALK_SEQ[Math.floor(t * 8.5 + o.x) % 4] : 0) });
      items.push({ fy: HALLPLATS.y, draw: () => ritaHallplats(ctx) }, { fy: SKYLT.y, draw: () => drawSkylt(ctx) });
      items.push(...folkDrawables(A, t));
      if (pets) for (const d of pets.drawables()) items.push({ fy: d.fy ?? d.y, draw: () => d.draw(ctx) });
      const F = fordon();
      items.push(selfDrawable(A, walker, t, { folksHere: worldFolksHere(A).length, ride: F ? { id: F.id, c: F.c } : null }));
      items.sort((a, b) => a.fy - b.fy).forEach((d) => d.draw(ctx));
      // tonerna från dragspelet
      for (const n of noter) { ctx.globalAlpha = Math.max(0, 1 - n.t / 2.2); ctxText(ctx, SMALL, n.k, Math.round(n.x + Math.sin(n.t * 4) * 3), Math.round(n.y - n.t * 14), '#f4ecd8'); }
      ctx.globalAlpha = 1;
      ctx.restore();
      if (N || D) {
        ctx.fillStyle = N ? 'rgba(12,16,48,0.55)' : 'rgba(60,40,90,0.2)'; ctx.fillRect(0, 0, VW, VH);
        if (D) { ctx.fillStyle = 'rgba(255,140,80,0.10)'; ctx.fillRect(0, 0, VW, VH); }
        ctx.save(); ctx.translate(-cx, -cy);
        for (const l of [...LYKTOR, ...TORGLYKTOR]) if (syns(l.x)) lyktSken(ctx, l.x, l.y, N ? 1 : 0.5);
        if (M) { ctx.globalCompositeOperation = 'lighter'; for (const s of STAND) if (syns(s.x)) for (const lx of [s.x - 14, s.x, s.x + 14]) sken(ctx, lx, s.y - 32, 18, `rgba(255,190,100,${N ? 0.35 : 0.18})`); ctx.globalCompositeOperation = 'source-over'; }
        if (N) for (const id of HUSLISTA) { const H = HUS[id]; if (H.x > cx + VW + 20 || H.x + H.w + 20 < cx) continue; husSken(ctx, id, t); }
        ctx.restore();
      }
      ctx.save(); ctx.translate(-cx, -cy); talk.draw(ctx, { x0: cx, x1: cx + VW }); ctx.restore();
      if (banner < 4) { const a = banner < 0.4 ? banner / 0.4 : banner > 3.4 ? (4 - banner) / 0.6 : 1; ctx.globalAlpha = Math.max(0, a); const s = $t('GAMLA STAN'), s2 = $t('KULLERSTEN, LYKTOR OCH TREHUNDRA ÅR'), w = Math.max(textW(BIG, s, 2), textW(SMALL, s2)) + 20; ctx.fillStyle = 'rgba(20,18,26,.85)'; ctx.fillRect((VW - w) >> 1, 26, w, 30); ctxText(ctx, BIG, s, (VW - textW(BIG, s, 2)) >> 1, 30, '#f0c870', 2); ctxText(ctx, SMALL, s2, (VW - textW(SMALL, s2)) >> 1, 48, '#f4f1ea'); ctx.globalAlpha = 1; }
      const s = hover && spotAt(hover.x + cx, hover.y + cy);
      if (s) { const w = textW(SMALL, s.label) + 10, x = Math.round(Math.max(2, Math.min(VW - w - 2, hover.x - w / 2))), y = Math.max(2, hover.y - 22); ctx.fillStyle = 'rgba(20,18,26,.9)'; ctx.fillRect(x, y, w, 11); ctxText(ctx, SMALL, s.label, x + 5, y + 3, '#ffd23f'); }
      if (fade.a > 0) { ctx.fillStyle = `rgba(10,10,16,${fade.a.toFixed(2)})`; ctx.fillRect(0, 0, VW, VH); }
    },
    down(sx, sy) {
      if (fade.phase === 1) return;
      hover = { x: sx, y: sy };
      const x = sx + cam.x, y = sy + cam.y;
      const fk = folkTapAt(A, x, y);
      if (fk) { openSpelarkort(A, fk); return; }
      const o = folkAt(x, y);
      if (o) { walker.walkTo(o.x + (walker.px < o.x ? -14 : 14), o.y + 2, () => { o.vila = Math.max(o.vila, 4); talk.say(o.rad, () => ({ x: o.x, y: o.y - 34 }), 3.5, { voice: o.look }); }); return; }
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
      spots: () => spots().map((s) => s.id),
      spot: (id) => { const s = spots().find((q) => q.id === id); return s ? { x: Math.round((s.r[0] + s.r[2]) / 2 - cam.x), y: Math.round((s.r[1] + s.r[3]) / 2 - cam.y) } : null; },
      act: (id) => { const s = spots().find((q) => q.id === id); if (!s) return false; s.act(); return true; },
      prat: () => talk.text(),
      fade: () => fade.phase,
      marknad: () => marknad(),
      duvor: () => duvor.map((d) => ({ x: Math.round(d.x), y: Math.round(d.y), flyg: d.flyg > 0, borta: d.borta > 0 })),
      folk: () => folk.map((o) => ({ x: Math.round(o.x), y: Math.round(o.y) })),
      noter: () => noter.length,
    },
  };
}
// marken målas en gång
let GROUND = null;
const ground = () => (GROUND ||= paintGround());
