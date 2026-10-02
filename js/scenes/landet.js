// LANDET – scenen öster om förorten (kartan och marken: js/landet/karta.js, djuren: js/landet/djur.js).
// Man kommer hit genom att gå österut på Pixelgatan förbi ortsskylten (city.js) – landsvägen ligger på
// samma höjd – och tillbaka genom att gå västerut. Himlen och de bortre kullarna glider med parallax.
// Kossor, får, hästar och höns betar och går i sina hagar (klicka: de svarar); traktorn skördar
// vetefältet rad för rad och lämnar stubb efter sig. GÅRDEN och STALLET är till salu/öppnar snart
// (nästa steg: bli bonde och rida). Busshållplatsen LANDET tar en tillbaka till Betongtorget.
// Fordonen (cykel/moppe) går att åka här också.
import { createCityWalker } from '../city/walk.js';
import { selfDrawable, folkDrawables, createSpeech, nameTag } from './walkable.js';
import { worldFolksHere } from '../net/world.js';
import { openModal, closeModal, toast } from '../core/ui.js';
import { play } from '../core/sound.js';
import { SMALL, BIG, ctxText, textW } from '../core/floor-pix.js';
import { CITY, busStopById } from '../city/map.js';
import { fmt, homeOf, GARDSDJUR, GARD_PRIS } from '../game.js';
import { LW, LH, L, KOHAGE, FARHAGE, HONSGARD, VETE, HASTHAGE, RIDBANA, HUS, HINDER, HALLPLATS, ORTSSKYLT, SPANG, GRIND, landHinder, paintLand, skyCanvas, hillsCanvas, husBild, husPos } from '../landet/karta.js';
import { drawKo, drawFar, drawHast, drawHona, drawTraktor, drawTrad } from '../landet/djur.js';

const GANG = 110;
const BUTIK = { x: 660, y: 206 };   // gårdsbutiken vid vägen (norra renen, väster om gården)
// träden: lövträd längs vägen och i hagarna, granskogen i öster
const TRAD = [
  ...[[60, 176, 'lov'], [380, 108, 'lov'], [660, 112, 'lov'], [1230, 116, 'lov'], [1730, 110, 'lov'], [540, 316, 'lov'], [930, 330, 'lov'], [1040, 480, 'lov'], [1380, 506, 'lov']],
  ...Array.from({ length: 18 }, (_, i) => [1780 + (i % 6) * 30 + (i >> 1) % 3 * 7, 112 + Math.floor(i / 6) * 22 + (i % 2) * 6, 'gran']),
  ...Array.from({ length: 10 }, (_, i) => [2180 + (i % 5) * 38, 330 + Math.floor(i / 5) * 90 + (i % 2) * 20, 'gran']),
].map(([x, y, s]) => ({ x, y, s }));

export function makeLandet(A) {
  const g = A.game;
  let VW = Math.max(384, Math.min(A.W || 384, LW)), VH = Math.max(160, Math.min(A.H || 216, LH));
  const from = A.landetFran || null; A.landetFran = null;
  const spawnY = from?.y ? Math.max(L.VERGE_N[0] + 4, Math.min(L.VERGE_S[1] - 4, from.y)) : L.VERGE_S[0] + 10;
  const gardDorr = [(HUS.gard.door.x0 + HUS.gard.door.x1) / 2, HUS.gard.base + 10];
  const walker = createCityWalker({ W: LW, H: LH, left: 2, right: LW - 6, top: L.HORIZON + 10, bottom: L.BOTTOM, spawn: from?.gard ? gardDorr : from?.buss ? [HALLPLATS.x + 10, HALLPLATS.y + 6] : [14, spawnY] });
  const fordon = () => g.aker;
  const applyRide = () => { const F = fordon(); walker.speed = GANG * (F ? F.fart : 1); };
  applyRide();
  walker.setObstacles([...landHinder(), [BUTIK.x - 16, BUTIK.y - 6, BUTIK.x + 16, BUTIK.y + 1]]);
  walker.snapFree();
  const talk = createSpeech();
  let t = 0, hover = null, banner = 0;
  const fade = { a: 1, phase: 2, cb: null };    // tona in när man kommer
  const cam = { x: 0, y: 0 };
  const camTarget = () => ({ x: Math.max(0, Math.min(LW - VW, walker.px - VW / 2)), y: Math.max(0, Math.min(LH - VH, walker.py - VH * 0.66)) });
  Object.assign(cam, camTarget());
  if (!A.attract) { const h = g.glad?.(2, '', 'landet', 2); if (h) setTimeout(() => toast(`🌾 Frisk luft på landet! +${h} 😊`, 'good'), 900); }

  // ---------- djuren ----------
  const rnd = (a, b) => a + Math.random() * (b - a);
  const inPen = (pen, m = 10) => [rnd(pen[0] + m, pen[2] - m), rnd(pen[1] + m + 8, pen[3] - 4)];
  const djur = [];
  const add = (sort, pen, n, extra = {}) => { for (let i = 0; i < n; i++) { const [x, y] = inPen(pen); djur.push({ sort, pen, x, y, tx: x, ty: y, dir: Math.random() < 0.5 ? 'left' : 'right', state: 'beta', tm: rnd(1, 6), fr: 0, ...extra, flack: i % 3, farg: ['fux', 'svart', 'skimmel', 'brun'][i % 4] }); } };
  // äger man gården är djuren ens egna (antalet i g.bonde.djur), annars den gamle bondens
  const agd = () => g.bondeHar?.();
  const antal = (sort, def) => (agd() ? (g.bonde.djur[sort] | 0) : def);
  add('ko', KOHAGE, antal('ko', 6)); add('far', FARHAGE, antal('far', 9)); add('hona', HONSGARD, antal('hona', 6)); add('hast', HASTHAGE, 4);
  // nyköpta djur springer in i hagen
  function synkaDjur() {
    if (!agd()) return;
    for (const [sort, pen] of [['ko', KOHAGE], ['far', FARHAGE], ['hona', HONSGARD]]) {
      const har = djur.filter((d) => d.sort === sort).length, ska = g.bonde.djur[sort] | 0;
      if (ska > har) add(sort, pen, ska - har);
      // (köpte man gården här ute: den gamle bondens överblivna djur följer med honom)
      for (let k = har - ska; k > 0; k--) djur.splice(djur.map((d) => d.sort).lastIndexOf(sort), 1);
    }
  }
  const FART = { ko: 9, far: 11, hona: 14, hast: 16 };
  const LJUD = { ko: ['MUUU!', 'Muu …', 'MUUUU! 🐄'], far: ['BÄÄÄ!', 'Bä bä!', 'BÄÄ 🐑'], hona: ['KLUCK KLUCK!', 'Pip pip!', 'KUCKELIKU!'], hast: ['GNÄGG!', 'Prrrr …', 'GNÄGGG 🐴'] };
  function updDjur(dt) {
    for (const d of djur) {
      d.tm -= dt;
      if (d.state === 'ga') {
        const dx = d.tx - d.x, dy = d.ty - d.y, dist = Math.hypot(dx, dy), step = FART[d.sort] * dt * (d.sort === 'hast' && d.trav ? 2.2 : 1);
        if (Math.abs(dx) > 0.5) d.dir = dx < 0 ? 'left' : 'right';
        if (dist <= step) { d.x = d.tx; d.y = d.ty; d.state = 'beta'; d.tm = rnd(2, 7); } else { d.x += dx / dist * step; d.y += dy / dist * step; }
        d.fr = Math.floor(t * (d.sort === 'hona' ? 10 : 5) + d.x) % 2 ? 1 : 2;
      } else {
        d.fr = d.sort === 'hona' ? (Math.floor(t * 3 + d.x) % 3 === 0 ? 3 : 0) : (Math.floor(t * 0.7 + d.x) % 3 ? 3 : 0);
        if (d.tm <= 0) { [d.tx, d.ty] = inPen(d.pen); d.trav = d.sort === 'hast' && Math.random() < 0.3; d.state = 'ga'; }
      }
    }
  }
  // ---------- traktorn: skördar vetet rad för rad (stubben ligger kvar tills fältet är klart) ----------
  const RADER = []; for (let y = VETE[1] + 16; y < VETE[3] - 2; y += 12) RADER.push(y);
  const trak = { x: VETE[0] + 16, y: RADER[0], rad: 0, dir: 'right', klara: [], vanta: 0 };
  function updTraktor(dt) {
    if (trak.vanta > 0) { trak.vanta -= dt; return; }
    const mal = trak.dir === 'right' ? VETE[2] - 18 : VETE[0] + 18, step = 16 * dt;
    if (Math.abs(trak.y - RADER[trak.rad]) > 0.5) { trak.y += Math.sign(RADER[trak.rad] - trak.y) * Math.min(step, Math.abs(RADER[trak.rad] - trak.y)); return; }
    if (Math.abs(mal - trak.x) <= step) {
      trak.x = mal; trak.klara.push(trak.rad);
      trak.rad++;
      if (trak.rad >= RADER.length) { trak.rad = 0; trak.klara = []; trak.vanta = 6; }
      trak.dir = trak.dir === 'right' ? 'left' : 'right';
    } else trak.x += Math.sign(mal - trak.x) * step;
  }

  // ---------- platserna man kan klicka på ----------
  const busStop = busStopById('betongtorget');
  const spots = () => [
    { id: 'gard', r: [HUS.gard.door.x0 - 6, HUS.gard.base - 40, HUS.gard.door.x1 + 6, HUS.gard.base], go: gardDorr, label: g.home === 'gard' ? 'HEM' : 'GÅRDEN – TILL SALU', act: gardDorren },
    { id: 'lada', r: [HUS.lada.door.x0, HUS.lada.base - 42, HUS.lada.door.x1, HUS.lada.base], go: [(HUS.lada.door.x0 + HUS.lada.door.x1) / 2, HUS.lada.base + 8], label: 'LADUGÅRDEN', act: ladan },
    { id: 'butik', r: [BUTIK.x - 18, BUTIK.y - 30, BUTIK.x + 18, BUTIK.y + 2], go: [BUTIK.x, BUTIK.y + 8], label: 'GÅRDSBUTIKEN', act: butiken },
    { id: 'stall', r: [HUS.stall.door.x0 - 4, HUS.stall.base - 36, HUS.stall.door.x1 + 4, HUS.stall.base], go: [(HUS.stall.door.x0 + HUS.stall.door.x1) / 2, HUS.stall.base + 8], label: 'STALLET', act: () => { play('door'); toast('🐴 Stallet: snart kan du köpa en egen häst här – och rida på hinderbanan!'); } },
    { id: 'ridbana', r: [RIDBANA[0], RIDBANA[1], RIDBANA[2], RIDBANA[3]], go: [(GRIND.bana[0] + GRIND.bana[1]) / 2, RIDBANA[1] - 8], label: 'RIDBANAN', act: () => toast('🏇 Hinderbanan – med en egen häst kan du hoppa här (snart!).') },
    { id: 'buss', r: [HALLPLATS.x - 12, HALLPLATS.y - 34, HALLPLATS.x + 14, HALLPLATS.y + 2], go: [HALLPLATS.x + 2, HALLPLATS.y + 6], label: 'BUSS TILL STAN', act: bussen },
    { id: 'skylt', r: [ORTSSKYLT.x - 14, ORTSSKYLT.y - 30, ORTSSKYLT.x + 14, ORTSSKYLT.y + 2], go: [ORTSSKYLT.x, ORTSSKYLT.y + 8], label: 'TILLBAKA TILL STAN', act: tillStan },
  ];
  // ---------- gården: köpa, gå hem, ladugården, gårdsbutiken ----------
  function gardDorren() {
    if (g.home === 'gard') { play('door'); A.roomSub = 0; A.go('room'); return; }
    const H = homeOf('gard');
    play('knock');
    openModal('🏡 Gården till salu', `<p style="font-size:var(--f2);margin-top:0">Den gamle bonden ska flytta till stan och säljer Gården: falurött boningshus med lantkök, ladugård, silo, hönsgård och hagar – <b>djuren ingår</b> (6 höns, 2 kor och 4 får)!</p>
      <p style="font-size:var(--f2)">🔑 Insats <b>${fmt(H.deposit)}</b> · hyra <b>${fmt(H.rent)}</b> i veckan · 😴 +${H.restBonus} energi när du sover<br>🐔 Fodra djuren varje dag, samla ägg, mjölka korna och klipp fåren – sälj i gårdsbutiken vid vägen.</p>
      <p style="font-size:var(--f2)">💰 Du har <b>${fmt(g.money)}</b>${g.sambo ? '<br>🏠 Du bor ihop med någon – flytta isär först.' : ''}</p>`, [
      { label: `🔑 Köp gården · ${fmt(H.deposit)}`, cls: 'btn-go', onClick: () => {
        const r = g.moveTo('gard');
        if (!r.ok) { toast(r.msg, 'bad'); play('fel'); return; }
        closeModal(); play('fanfare'); synkaDjur();
        toast('🚜 Grattis – du är bonde! Gå in och titta på ditt nya hem, och glöm inte att fodra djuren i ladugården.', 'good');
      } },
      { label: 'Inte nu', onClick: closeModal },
    ]);
  }
  function ladan() {
    if (!agd()) { play('door'); toast('🐄 I ladugården luktar det hö. Det är den gamle bondens djur – köp Gården så blir de dina.'); return; }
    play('door');
    const draw = () => {
      const B = g.bonde, matta = g.djurMatta(), idag = (B.fodrad | 0) === g.day;
      const rader = Object.entries(GARDSDJUR).map(([k, D]) => `<div class="prow" style="grid-template-columns:auto 1fr auto"><span style="font-size:22px">${D.icon}</span><span class="nm">${D.fler}: <b>${B.djur[k] | 0}</b> av ${D.max}<br><small class="sp">${fmt(D.pris)} st · foder ${fmt(D.foder)}/dag</small></span><button class="btn btn-small btn-go" data-kop="${k}" ${(B.djur[k] | 0) >= D.max || g.money < D.pris ? 'disabled' : ''}>Köp</button></div>`).join('');
      const dlg = openModal('🐄 Ladugården', `<p style="font-size:var(--f2);margin-top:0">${idag ? '✅ Djuren har fått mat i dag.' : matta ? '🌾 Djuren åt i går – ge dem mat i dag också.' : '<span class="bad">😟 Djuren är hungriga! De ger inga ägg, ingen mjölk och ingen ull förrän de får mat.</span>'}</p>
        <div class="plist">${rader}</div>
        <p style="font-size:var(--f2)">🧶 Ull i ladugården: <b>${B.ull | 0} kg</b> · 💰 Du har <b>${fmt(g.money)}</b></p>`, [
        ...(!idag ? [{ label: `🌾 Fodra djuren · ${fmt(g.fodderKostnad())}`, cls: 'btn-go', onClick: () => { const r = g.fodra(); if (!r.ok) { toast(r.msg, 'bad'); return; } play('ok'); toast(`🌾 Alla djur har fått mat (${fmt(r.kr)}).${r.glad ? ` +${r.glad} 😊` : ''}`, 'good'); draw(); } }] : []),
        { label: 'Klar', onClick: closeModal },
      ]);
      dlg.querySelectorAll('[data-kop]').forEach((b) => (b.onclick = () => { const r = g.kopDjur(b.dataset.kop); if (!r.ok) { toast(r.msg, 'bad'); return; } play('ok'); synkaDjur(); toast(`${r.djur.icon} En ny ${r.djur.namn.toLowerCase()} springer ut i hagen!`, 'good'); draw(); }));
    };
    draw();
  }
  function butiken() {
    if (!agd()) { toast('🥚 Gårdsbutiken: "Ägg och mjölk – lägg pengarna i burken." Burken är tom och hyllorna med.'); return; }
    play('click');
    const draw = () => {
      const har = { agg: g.skafferi.agg | 0, mjolk: g.skafferi.mjolk | 0, ull: g.bonde.ull | 0 };
      const rad = (k, icon, namn, enh) => `<div class="prow" style="grid-template-columns:auto 1fr auto auto"><span style="font-size:22px">${icon}</span><span class="nm">${namn}: <b>${har[k]} ${enh}</b><br><small class="sp">${fmt(GARD_PRIS[k])} per ${enh}</small></span>
        <button class="btn btn-small" data-salj="${k}" data-n="1" ${har[k] < 1 ? 'disabled' : ''}>Sälj 1</button><button class="btn btn-small btn-go" data-salj="${k}" data-n="${har[k]}" ${har[k] < 1 ? 'disabled' : ''}>Sälj allt · ${fmt(har[k] * GARD_PRIS[k])}</button></div>`;
      const dlg = openModal('🧺 Gårdsbutiken', `<p style="font-size:var(--f2);margin-top:0">Förbipasserande köper allt du ställer ut. Ägg och mjölk tas ur skafferiet – spara det du vill laga mat av!</p>
        <div class="plist">${rad('agg', '🥚', 'Ägg', 'st')}${rad('mjolk', '🥛', 'Mjölk', 'l')}${rad('ull', '🧶', 'Ull', 'kg')}</div>`, [{ label: 'Klar', cls: 'btn-go', onClick: closeModal }]);
      dlg.querySelectorAll('[data-salj]').forEach((b) => (b.onclick = () => { const r = g.saljGard(b.dataset.salj, +b.dataset.n); if (!r.ok) { toast(r.msg, 'bad'); return; } play('coin'); toast(`🧺 Sålt för ${fmt(r.kr)}!`, 'good'); draw(); }));
    };
    draw();
  }
  // djuren på ens egen gård: hönsen → ägg, korna → mjölk, fåren → ull
  function sysslan(d) {
    const r = d.sort === 'hona' ? g.samlaAgg() : d.sort === 'ko' ? g.mjolka() : d.sort === 'far' ? g.klippa() : null;
    if (!r) return false;
    if (!r.ok) { toast(r.msg, 'bad'); play('fel'); return true; }
    play('ok');
    const txt = d.sort === 'hona' ? `🥚 ${r.n} ägg till skafferiet!${r.full ? ' (Skafferiet är fullt – sälj i gårdsbutiken.)' : ''}` : d.sort === 'ko' ? `🥛 ${r.n} liter mjölk till skafferiet!${r.full ? ' (Skafferiet är fullt – sälj i gårdsbutiken.)' : ''}` : `🧶 ${r.n} kg ull till ladugården – sälj den i gårdsbutiken!`;
    toast(txt + (r.glad ? ` +${r.glad} 😊` : ''), 'good');
    return true;
  }
  function bussen() {
    openModal('🚌 Busshållplats LANDET', `<p style="font-size:var(--f2);margin-top:0">Linje 4 går till <b>Betongtorget</b> i förorten. Biljetten kostar ${fmt(10)}.</p>`, [
      { label: '🚌 Åk till stan', cls: 'btn-go', onClick: () => { closeModal(); if (g.money < 10) { toast('Du har inte råd med bussen.', 'bad'); return; } g.money -= 10; g.passTime(15); g.save(); play('door'); toTown(busStop ? [busStop.x, busStop.y + 8] : [CITY.W - 40, 296]); } },
      { label: 'Gå', onClick: closeModal },
    ]);
  }
  // tillbaka in i staden vid stadsgränsen – på närmaste trottoar (inte mitt i körbanan)
  function tillStan() {
    let y = Math.max(CITY.SIDEWALK_N[0] + 4, Math.min(CITY.SIDEWALK_S[1] - 4, walker.py));
    if (y > CITY.ROAD[0] - 2 && y < CITY.ROAD[1] + 2) y = y < (CITY.ROAD[0] + CITY.ROAD[1]) / 2 ? CITY.SIDEWALK_N[0] + 16 : CITY.SIDEWALK_S[0] + 14;
    toTown([CITY.W - 24, y]);
  }
  function toTown(pos) {
    if (fade.phase === 1) return;
    fade.phase = 1; fade.cb = () => { A.cityPos = pos; A.go('city'); };
  }
  const spotAt = (x, y) => spots().find((s) => x >= s.r[0] && x <= s.r[2] && y >= s.r[1] && y <= s.r[3]);
  const djurAt = (x, y) => djur.find((d) => Math.abs(d.x - x) < (d.sort === 'hona' ? 6 : 13) && y < d.y + 2 && y > d.y - (d.sort === 'hast' ? 26 : d.sort === 'ko' ? 20 : 12));
  function prata(d) {
    const L2 = LJUD[d.sort];
    talk.say(L2[Math.floor(Math.random() * L2.length)], () => ({ x: d.x, y: d.y - (d.sort === 'hast' ? 30 : d.sort === 'ko' ? 24 : 16) }), 2.5, { animal: true, silent: true });
    play('click');
    d.state = 'beta'; d.tm = 3; d.dir = walker.px < d.x ? 'left' : 'right';
    const h = g.glad?.(1, '', 'landdjur', 3); if (h) toast(`😊 +${h}`);
  }

  // ---------- staketen (y-sorterade bitar) ----------
  function fenceDrawables(pen, color, gap = null, sten = false) {
    const [x0, y0, x1, y1] = pen, out = [];
    const rail = (ctx, ax, bx, y) => { ctx.fillStyle = color[0]; ctx.fillRect(ax, y - 9, bx - ax, 2); ctx.fillRect(ax, y - 5, bx - ax, 2); ctx.fillStyle = color[1]; ctx.fillRect(ax, y - 8, bx - ax, 1); ctx.fillRect(ax, y - 4, bx - ax, 1); for (let x = ax; x < bx; x += 12) { ctx.fillStyle = color[2]; ctx.fillRect(x, y - 11, 2, 11); ctx.fillStyle = color[0]; ctx.fillRect(x, y - 11, 1, 11); } };
    if (gap) out.push({ fy: y0, draw: (ctx) => { rail(ctx, x0, gap[0], y0); rail(ctx, gap[1], x1, y0); } }); else out.push({ fy: y0, draw: (ctx) => rail(ctx, x0, x1, y0) });
    if (!sten) out.push({ fy: y1, draw: (ctx) => rail(ctx, x0, x1, y1) });
    for (const sx of [x0, x1 - 2]) out.push({ fy: y1 - 0.5, draw: (ctx) => { ctx.fillStyle = color[2]; ctx.fillRect(sx, y0 - 11, 2, y1 - y0 + 11); for (let y = y0; y < y1; y += 10) { ctx.fillStyle = color[0]; ctx.fillRect(sx - 1, y - 2, 4, 2); } } });
    return out;
  }
  const TRA = ['#8a5a30', '#b07a48', '#5a3a1e'], VIT = ['#e8e4d8', '#ffffff', '#a8a49a'];
  // ridbanans hinder (färgade bommar på stöd)
  const drawHinder = (ctx, h) => {
    const c = '#' + h.c.toString(16).padStart(6, '0');
    for (const sx of [h.x - 12, h.x + 10]) { ctx.fillStyle = '#f4f1ea'; ctx.fillRect(sx, h.y - 16, 3, 16); ctx.fillStyle = c; ctx.fillRect(sx, h.y - 16, 3, 2); ctx.fillRect(sx, h.y - 10, 3, 2); }
    if (h.typ === 'mur') { for (let j = 0; j < 3; j++) for (let i = 0; i < 5; i++) { ctx.fillStyle = (i + j) % 2 ? '#b85a3a' : '#a04a2e'; ctx.fillRect(h.x - 9 + i * 4 + (j % 2) * 2, h.y - 9 + j * 3, 4, 3); } }
    else for (const yy of h.typ === 'oxer' ? [12, 7] : [11]) for (let x = h.x - 9; x < h.x + 10; x += 2) { ctx.fillStyle = ((x - h.x) >> 2) & 1 ? c : '#f4f1ea'; ctx.fillRect(x, h.y - yy, 2, 2); }
  };
  // skyltarna: ortsskylten och busshållplatsen
  const drawOrtsskylt = (ctx) => {
    const { x, y } = ORTSSKYLT;
    ctx.fillStyle = '#5a5e66'; ctx.fillRect(x - 1, y - 18, 2, 18);
    ctx.fillStyle = '#1e1a24'; ctx.fillRect(x - 15, y - 31, 30, 14); ctx.fillStyle = '#f4f1ea'; ctx.fillRect(x - 14, y - 30, 28, 12);
    ctxText(ctx, SMALL, 'PIXEL', x - 10, y - 28, '#1e1a24'); ctxText(ctx, SMALL, 'STADEN', x - 12, y - 23, '#1e1a24');
    ctx.fillStyle = '#d8343c'; for (let i = 0; i < 26; i++) ctx.fillRect(x - 13 + i, y - 19 - Math.round(i * 0.42), 2, 1);
  };
  const drawHallplats = (ctx) => {
    const { x, y } = HALLPLATS;
    ctx.fillStyle = '#5a5e66'; ctx.fillRect(x, y - 30, 2, 30);
    ctx.fillStyle = '#f0c030'; ctx.fillRect(x - 6, y - 34, 14, 10); ctx.fillStyle = '#1e1a24'; ctx.fillRect(x - 6, y - 34, 14, 1);
    ctxText(ctx, SMALL, 'BUSS', x - 5, y - 32, '#1e1a24');
    ctx.fillStyle = '#8a5a30'; ctx.fillRect(x + 6, y - 7, 18, 3); ctx.fillRect(x + 7, y - 4, 2, 4); ctx.fillRect(x + 21, y - 4, 2, 4);   // bänken
  };
  // gårdsbutiken: ett litet stånd med tak, lådor med ägg och mjölkflaskor och en skylt
  const drawButik = (ctx, oppen) => {
    const { x, y } = BUTIK;
    ctx.fillStyle = 'rgba(20,12,30,.25)'; ctx.fillRect(x - 17, y - 1, 34, 3);
    ctx.fillStyle = '#5a3a1e'; ctx.fillRect(x - 15, y - 22, 2, 22); ctx.fillRect(x + 13, y - 22, 2, 22);
    ctx.fillStyle = '#8a5a30'; ctx.fillRect(x - 16, y - 9, 32, 3); ctx.fillStyle = '#b07a48'; ctx.fillRect(x - 16, y - 9, 32, 1);
    for (let i = 0; i < 9; i++) { ctx.fillStyle = i % 2 ? '#d8343c' : '#f4f1ea'; ctx.fillRect(x - 18 + i * 4, y - 27, 4, 5); }
    ctx.fillStyle = '#1e1a24'; ctx.fillRect(x - 18, y - 22, 36, 1);
    if (oppen) {
      ctx.fillStyle = '#c8a870'; ctx.fillRect(x - 13, y - 13, 10, 4); for (let i = 0; i < 4; i++) { ctx.fillStyle = '#f4ead8'; ctx.fillRect(x - 12 + i * 2, y - 14, 2, 2); }
      for (let i = 0; i < 3; i++) { ctx.fillStyle = '#f4f4f0'; ctx.fillRect(x + 2 + i * 4, y - 15, 3, 6); ctx.fillStyle = '#3a7bd5'; ctx.fillRect(x + 2 + i * 4, y - 16, 3, 1); }
    }
    ctx.fillStyle = '#f4f1ea'; ctx.fillRect(x - 13, y - 21, 26, 7); ctxText(ctx, SMALL, 'ÄGG', x - 10, y - 20, '#5a3a1e');
  };
  const drawDomartorn = (ctx) => { const p = husPos('domartorn'); ctx.drawImage(husBild('domartorn', false), p.x, p.y); };
  const drawStubb = (ctx) => {
    for (const r of trak.klara) { const y = RADER[r]; ctx.fillStyle = '#c8b070'; ctx.fillRect(VETE[0] + 2, y - 7, VETE[2] - VETE[0] - 4, 9); ctx.fillStyle = '#a89050'; for (let x = VETE[0] + 2; x < VETE[2] - 2; x += 3) ctx.fillRect(x, y - 6 + (x % 2), 1, 1); }
    // den rad den håller på med: stubb bakom traktorn
    const y = RADER[trak.rad]; if (Math.abs(trak.y - y) < 1) { const a = trak.dir === 'right' ? VETE[0] + 2 : trak.x, b = trak.dir === 'right' ? trak.x : VETE[2] - 2; ctx.fillStyle = '#c8b070'; ctx.fillRect(Math.min(a, b), y - 7, Math.abs(b - a), 9); }
  };

  function night() { const h = g.min / 60; return h >= 20 || h < 5.5; }
  function dusk() { const h = g.min / 60; return (h >= 18 && h < 20) || (h >= 5.5 && h < 7); }

  return {
    get worldX() { return walker.px; }, get worldY() { return walker.py; },
    get worldRide() { const F = fordon(); return F ? { id: F.id, c: F.c } : null; },
    rideChanged: applyRide,
    update(dt) {
      t += dt; banner += dt;
      VW = Math.max(384, Math.min(A.W || 384, LW)); VH = Math.max(160, Math.min(A.H || 216, LH));
      if (fade.phase === 1) { fade.a = Math.min(1, fade.a + dt * 2.6); if (fade.a >= 1) { fade.phase = 0; const cb = fade.cb; fade.cb = null; cb?.(); return; } }
      else if (fade.phase === 2) { fade.a = Math.max(0, fade.a - dt * 1.8); if (fade.a <= 0) fade.phase = 0; walker.update(dt); }
      else walker.update(dt);
      // västra kanten = tillbaka in i staden
      if (fade.phase === 0 && walker.px <= 8 && walker.path.length) tillStan();
      updDjur(dt); updTraktor(dt);
      const c = camTarget(); cam.x += (c.x - cam.x) * Math.min(1, dt * 8); cam.y += (c.y - cam.y) * Math.min(1, dt * 8);
    },
    draw(ctx) {
      ctx.setTransform(A.pxs, 0, 0, A.pxs, 0, 0);
      ctx.imageSmoothingEnabled = false;
      const N = night(), D = dusk();
      const cx = Math.round(cam.x), cy = Math.round(cam.y);
      // himlen och kullarna (parallax)
      ctx.drawImage(skyCanvas(VW, N, D), 0, Math.min(0, -cy * 0.3));
      for (const [layer, k, yy] of [[0, 0.25, L.HORIZON - 58], [1, 0.5, L.HORIZON - 44]]) {
        const img = hillsCanvas(layer, N), off = -Math.round(cx * k) % img.width;
        for (let x = off; x < VW; x += img.width) ctx.drawImage(img, x, yy - cy);
      }
      ctx.drawImage(dayLand(), -cx, -cy);
      ctx.save(); ctx.translate(-cx, -cy);
      drawStubb(ctx);
      // allt som står på marken, y-sorterat
      const items = [];
      for (const id of ['gard', 'lada', 'silo', 'stall']) { const p = husPos(id); items.push({ fy: HUS[id].base, draw: () => ctx.drawImage(husBild(id, false), p.x, p.y) }); }
      items.push({ fy: HUS.domartorn.base, draw: () => drawDomartorn(ctx) });
      for (const tr of TRAD) if (tr.x > cx - 40 && tr.x < cx + VW + 40) items.push({ fy: tr.y, draw: () => drawTrad(ctx, tr.x, tr.y, tr.s, t) });
      for (const d of [...fenceDrawables(KOHAGE, TRA), ...fenceDrawables(FARHAGE, TRA, null, true), ...fenceDrawables(HONSGARD, VIT), ...fenceDrawables(HASTHAGE, VIT, GRIND.hage), ...fenceDrawables(RIDBANA, VIT, GRIND.bana)]) items.push({ fy: d.fy, draw: () => d.draw(ctx) });
      for (const h of HINDER) items.push({ fy: h.y, draw: () => drawHinder(ctx, h) });
      for (const d of djur) if (d.x > cx - 40 && d.x < cx + VW + 40) items.push({ fy: d.y, draw: () => { if (d.sort === 'ko') drawKo(ctx, d.x, d.y, d.dir, d.fr, d.flack); else if (d.sort === 'far') drawFar(ctx, d.x, d.y, d.dir, d.fr); else if (d.sort === 'hast') drawHast(ctx, d.x, d.y, d.dir, d.fr, d.farg); else drawHona(ctx, d.x, d.y, d.dir, d.fr); } });
      items.push({ fy: trak.y, draw: () => drawTraktor(ctx, trak.x, trak.y, trak.dir, t, trak.vanta <= 0) });
      items.push({ fy: ORTSSKYLT.y, draw: () => drawOrtsskylt(ctx) }, { fy: HALLPLATS.y, draw: () => drawHallplats(ctx) }, { fy: BUTIK.y, draw: () => drawButik(ctx, agd()) });
      items.push(...folkDrawables(A, t));
      const F = fordon();
      items.push(selfDrawable(A, walker, t, { folksHere: worldFolksHere(A).length, ride: F ? { id: F.id, c: F.c } : null }));
      items.sort((a, b) => a.fy - b.fy).forEach((d) => d.draw(ctx));
      // traktorns damm
      if (trak.vanta <= 0) for (let k = 0; k < 4; k++) { const u = (t * 1.6 + k / 4) % 1; ctx.fillStyle = `rgba(200,180,120,${(0.4 * (1 - u)).toFixed(2)})`; ctx.fillRect(Math.round(trak.x + (trak.dir === 'right' ? -26 : 26) * (1 + u * 0.4)), Math.round(trak.y - 6 - u * 10), 3 + Math.round(u * 3), 3); }
      ctx.restore();
      // kvällen och natten: mörker över allt, sedan lyser gårdens fönster och stallets lykta
      if (N || D) {
        ctx.fillStyle = N ? 'rgba(12,16,48,0.58)' : 'rgba(60,40,90,0.22)'; ctx.fillRect(0, 0, VW, VH);
        if (D) { ctx.fillStyle = 'rgba(255,140,80,0.10)'; ctx.fillRect(0, 0, VW, VH); }
        const gp = husPos('gard'), top = gp.y + (HUS.gard.h + 40) - 4 - HUS.gard.h;
        for (const wx of [20, 48, 104, 132]) for (const wy of [24, 44]) {
          const x = gp.x + wx - cx, y = top + wy - cy;
          if (x < -20 || x > VW + 20) continue;
          ctx.fillStyle = 'rgba(255,214,120,0.16)'; ctx.fillRect(x - 3, y - 3, 16, 18);
          ctx.fillStyle = '#f8d878'; ctx.fillRect(x, y, 10, 12); ctx.fillStyle = '#f4f1ea'; ctx.fillRect(x + 5, y, 1, 12); ctx.fillRect(x, y + 6, 10, 1);
        }
        const sp = { x: HUS.stall.door.x0 - 6 - cx, y: HUS.stall.base - 38 - cy };
        ctx.fillStyle = 'rgba(255,214,120,0.22)'; ctx.fillRect(sp.x - 5, sp.y - 5, 12, 12); ctx.fillStyle = '#ffe9a0'; ctx.fillRect(sp.x, sp.y, 3, 3);
      }
      ctx.save(); ctx.translate(-cx, -cy); talk.draw(ctx, { x0: cx, x1: cx + VW }); ctx.restore();
      // områdesskylten när man kommer
      if (banner < 4) { const a = banner < 0.4 ? banner / 0.4 : banner > 3.4 ? (4 - banner) / 0.6 : 1; ctx.globalAlpha = Math.max(0, a); const s = 'LANDET', s2 = 'KOR, FÅR OCH FRISK LUFT', w = Math.max(textW(BIG, s, 2), textW(SMALL, s2)) + 20; ctx.fillStyle = 'rgba(20,18,26,.85)'; ctx.fillRect((VW - w) >> 1, 26, w, 30); ctxText(ctx, BIG, s, (VW - textW(BIG, s, 2)) >> 1, 30, '#8edc4c', 2); ctxText(ctx, SMALL, s2, (VW - textW(SMALL, s2)) >> 1, 48, '#f4f1ea'); ctx.globalAlpha = 1; }
      // namnet på det man pekar på
      const s = hover && spotAt(hover.x + cx, hover.y + cy);
      if (s) { const w = textW(SMALL, s.label) + 10, x = Math.round(Math.max(2, Math.min(VW - w - 2, hover.x - w / 2))), y = Math.max(2, hover.y - 22); ctx.fillStyle = 'rgba(20,18,26,.9)'; ctx.fillRect(x, y, w, 11); ctxText(ctx, SMALL, s.label, x + 5, y + 3, '#ffd23f'); }
      if (fade.a > 0) { ctx.fillStyle = `rgba(10,10,16,${fade.a.toFixed(2)})`; ctx.fillRect(0, 0, VW, VH); }
    },
    down(sx, sy) {
      if (fade.phase === 1) return;
      hover = { x: sx, y: sy };
      const x = sx + cam.x, y = sy + cam.y;
      const s = spotAt(x, y);
      if (s && s.id !== 'ridbana') { walker.walkTo(s.go[0], s.go[1], s.act); return; }
      const d = djurAt(x, y);
      if (d) {
        // på den egna gården: man ställer sig vid hagens staket och sköter djuret
        const pen = d.pen, egen = agd() && d.sort !== 'hast';
        if (egen) { walker.walkTo(Math.max(pen[0] + 8, Math.min(pen[2] - 8, d.x)), pen[3] + 8, () => { prata(d); sysslan(d); }); return; }
        walker.walkTo(d.x + (walker.px < d.x ? -16 : 16), Math.min(L.BOTTOM - 2, d.y + 6), () => prata(d));
        return;
      }
      if (s) { walker.walkTo(s.go[0], s.go[1], s.act); return; }
      if (x < 10) { walker.walkTo(4, Math.max(L.VERGE_N[0] + 4, Math.min(L.VERGE_S[1] - 4, y)), tillStan); return; }
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
      djur: () => djur.map((d) => ({ sort: d.sort, x: Math.round(d.x), y: Math.round(d.y), state: d.state, pen: d.pen })),
      djurSkarm: (sort) => { const d = djur.find((q) => q.sort === sort); return d ? { x: Math.round(d.x - cam.x), y: Math.round(d.y - 8 - cam.y) } : null; },
      traktor: () => ({ x: Math.round(trak.x), y: Math.round(trak.y), rad: trak.rad, klara: trak.klara.length }),
      prat: () => talk.text(),
      fade: () => fade.phase,
    },
  };
}
// marken målas en gång (dag) – nattversionen är samma bild, mörkare och blåare
let DAY = null, NIGHT = null;
const dayLand = () => (DAY ||= paintLand());
function paintNightLand() {
  if (NIGHT) return NIGHT;
  const src = dayLand(), c = document.createElement('canvas'); c.width = src.width; c.height = src.height;
  const x = c.getContext('2d'); x.drawImage(src, 0, 0); x.globalCompositeOperation = 'source-atop'; x.fillStyle = 'rgba(14,18,52,0.55)'; x.fillRect(0, 0, c.width, c.height);
  NIGHT = c; return c;
}
