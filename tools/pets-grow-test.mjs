// TILLVÄXT AV OMSORG – husdjuren växer (unge → ung → vuxen) av tid OCH omsorg: mat, lek,
// leksaker hemma och rätt toalett (hunden ute på promenad, katten i kattlådan, kaninen i buren).
//   node tools/pets-grow-test.mjs            (servern: SMOKE_PORT || PORT || 8788)
// Del 1 (node, js/pets/sim.js):
//   1. en omskött valp växer till ung (dag 3) och vuxen (dag 7) – händelser med rätt text
//   2. en försummad valp växer inte; en halvt omskött växer långsammare
//   2b. DAGENS KRAV: utan lek eller utan leksak växer djuret inte alls (poängen väntar och
//      brinner inne vid midnatt); Leka-knappen går inte att fuska med (femton klick = en lekstund)
//   3. hundens bajs UTE räknas, inne drar; en promenad ger inte dubbla toalettpoäng; koppel på
//      inne skyddar inte mot olyckor
//   4. kattens låda räknas (ren låda), smutsig låda ger inget, ingen låda drar
//   5. leksak hemma räknas (klösträd, tuggben, kaninens gnagmorot – inte buren) – och en
//      kastad boll (toyPlay)
//   6. minsta tiden gäller även med massor av poäng
//   7. gamla sparfiler behåller stadiet (startpoäng efter stadium, inga gamla fält ändras)
//   8. djurmenyns rad: growth() – "Växer inte än i dag – behöver lek, leksak, promenad",
//      "Fullvuxen."; seenNews() sparar direkt
// Del 2 (Playwright, det riktiga hemmet):
//   9. djurmenyn har TILLVÄXT-raden (skärmbild), valpen växer → toast "🐕 Bamse har vuxit! Nu är
//      han ung.", pratbubbla och större bild (skärmbilder före/efter), vuxen → "Fullvuxen"
//  10. katten växte medan man var i stan → toasten och bubblan kommer när man kommer hem
//  11. en kastad boll räknas som lek för djuret som springer efter
//  12. två djur växer samtidigt tätt ihop → bubblorna krockar inte (skärmbild)
//  13. djuret växer i ett annat rum → toasten direkt, bubblan (utan ny toast) när man går in
//  14. kaninen och gnagmoroten (skärmbild)
// Bilder: tools/out/djur-vaxer/*.png. Utskrift 'ok: …' / 'FEL: …', exit 1 vid fel.
import { createPetStore, seededRng, GROW_AT, CARE_CAP, CARE, DAY_NEED } from '../js/pets/sim.js';
import fs from 'fs';

let fails = 0, passes = 0;
const ok = (cond, msg) => { if (cond) { passes++; console.log('ok: ' + msg); } else { fails++; console.log('FEL: ' + msg); } };
const section = (s) => console.log('\n# ' + s);
const memStorage = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), _m: m }; };
const mk = (seed = 1) => createPetStore({ storage: memStorage(), rng: seededRng(seed) });
const HOME = 'lagenhet';
const OUT = 'D:/GamesProjects/snabbfilen/tools/out/djur-vaxer/';
fs.mkdirSync(OUT, { recursive: true });

// Spelklocka som i spelet (spelaren hemma om inget annat sägs)
function clock(S, { day = 1, min = 7 * 60 } = {}) {
  const c = { day, min };
  S.syncTo(c.day, c.min, { home: HOME, playerHome: HOME, playerRoom: 0 });
  c.adv = (m, ctx = {}) => {
    c.min += m;
    while (c.min >= 24 * 60) { c.min -= 24 * 60; c.day++; }
    S.syncTo(c.day, c.min, { home: HOME, playerHome: HOME, playerRoom: 0, ...ctx });
  };
  c.to = (h, ctx) => { let m = h * 60 - c.min; if (m < 0) m += 24 * 60; c.adv(m, ctx); };
  return c;
}
const refill = (S) => { for (const b of S.items.filter((i) => i.k === 'matskal' && i.food < 0.3)) S.fillBowl(b.id); };
const cleanUp = (S) => { for (const b of S.items.filter((i) => 'dirt' in i)) S.cleanLitter(b.id); };
// En dag: fyra pass (08, 12, 17, 21) – mat, städning, promenader, klappa + leka – sedan sömn till 07.
// spam = så många snabba Leka-klick i rad klockan 12 (fusket granskaren hittade)
function day(S, c, { walks = true, play = true, clean = true, spam = 0 } = {}) {
  for (const h of [8, 12, 17, 21]) {
    refill(S); if (clean) cleanUp(S);
    c.to(h);
    if (walks) {
      const dogs = S.pets.filter((p) => p.species === 'hund');
      for (const p of dogs) S.walkStart(p.id);
      if (dogs.length) { c.adv(25, { playerHome: null, outdoors: true }); S.walkEnd(); }
    }
    if (play) for (const p of S.pets) { S.pet(p.id); S.play(p.id); }
    if (spam && h === 12) for (let i = 0; i < spam; i++) for (const p of S.pets) S.play(p.id);
  }
  c.to(7);
}
const near = (a, b) => Math.abs(a - b) < 1e-9;
const pup = (S, name = 'Bamse', sex = 'hane') => S.adopt('hund', 'labrador', sex, name, HOME, { room: 0, x: 100, y: 150 });

// ---------------------------------------------------------------------------
section('1. Omskött valp: ung och vuxen');
{
  const S = mk(101);
  const c = clock(S, { day: 10 });
  const events = [];
  S.listen((e) => { if (e.type === 'vaxte') events.push({ ...e, at: c.day }); });
  const p = pup(S);
  S.buyItem('sack-hund', 8); S.placeItem('matskal', HOME, 0, 120, 160);
  S.buyItem('leksak-boll'); S.placeItem('leksak-boll', HOME, 0, 200, 180);
  const stages = [];
  for (let d = 0; d < 10; d++) { stages.push(p.stage); day(S, c); }
  ok(stages.slice(0, 3).every((s) => s === 'unge'), `valp de tre första dagarna (${stages.join(',')})`);
  ok(stages[3] === 'ung', 'ung dag 3 (tidigast – minsta tiden)');
  ok(stages[6] === 'ung' && stages[7] === 'vuxen', 'vuxen dag 7 (fyra dagar som ung)');
  ok(events.length === 2 && events[0].stage === 'ung' && events[1].stage === 'vuxen' && events.every((e) => e.species === 'hund' && e.petId === p.id),
    `två händelser 'vaxte' (${events.map((e) => `dag ${e.at}: ${e.stage}`).join(', ')})`);
  ok(events[0]?.text === 'Bamse har vuxit! Nu är han ung.', `texten: "${events[0]?.text}"`);
  ok(events[1]?.text === 'Bamse har vuxit! Nu är han vuxen.', `texten: "${events[1]?.text}"`);
  ok(events.every((e) => e.seen === false), 'händelserna är markerade som ej visade (lagret visar dem när man kommer hem)');
  ok(S.messes.length === 0, 'inga olyckor inne med fyra promenader om dagen');
  const g = S.growth(p);
  ok(g.stage === 'vuxen' && g.next === null && g.pct === 1 && g.text === 'Fullvuxen.', `growth() för en vuxen: "${g.text}"`);
}

// ---------------------------------------------------------------------------
section('2. Försummad och halvt omskött valp');
const cared = { ungDay: null, vuxenDay: null };
{
  // referens: full omsorg
  const run = (opts, days = 14) => {
    const S = mk(102);
    const c = clock(S, { day: 10 });
    const p = pup(S);
    S.buyItem('sack-hund', 9); S.placeItem('matskal', HOME, 0, 120, 160);
    if (opts.toy) { S.buyItem('leksak-boll'); S.placeItem('leksak-boll', HOME, 0, 200, 180); }
    const res = { ung: null, vuxen: null, grow: [], S, p };
    for (let d = 0; d < days; d++) {
      day(S, c, opts);
      res.grow.push(Math.round(p.grow));
      if (p.stage === 'ung' && res.ung == null) res.ung = c.day - 10;
      if (p.stage === 'vuxen' && res.vuxen == null) { res.vuxen = c.day - 10; if (res.ung == null) res.ung = res.vuxen; }
    }
    return res;
  };
  const full = run({ toy: true, walks: true, play: true });
  const half = run({ toy: true, walks: false, play: true });
  const none = run({ toy: false, walks: false, play: false });
  cared.ungDay = full.ung; cared.vuxenDay = full.vuxen;
  ok(full.ung === 3 && full.vuxen === 7, `full omsorg: ung dag ${full.ung}, vuxen dag ${full.vuxen}`);
  ok(none.p.stage === 'unge' && none.p.grow < 20, `försummad (bara mat – ingen lek, leksak eller promenad): fortfarande valp efter 14 dagar (${Math.round(none.p.grow)} poäng, ${none.S.messes.length} olyckor inne)`);
  ok(half.ung != null && half.ung > full.ung && (half.vuxen == null || half.vuxen >= full.vuxen + 4),
    `halvt omskött (lek + leksak men inga promenader – bajsar inne) växer långsammare: ung dag ${half.ung} (full: ${full.ung}), vuxen ${half.vuxen == null ? 'inte på 14 dagar' : 'dag ' + half.vuxen} (full: ${full.vuxen})`);
  ok(half.grow[5] < full.grow[5] && none.grow[5] < half.grow[5], `poäng efter 6 dagar: full ${full.grow[5]} > halv ${half.grow[5]} > försummad ${none.grow[5]}`);
  // ensam och hungrig: drar lite, men aldrig under stadiets golv
  const S = mk(103);
  const c = clock(S, { day: 10 });
  const p = pup(S);
  p.grow = 60;
  for (let d = 0; d < 3; d++) c.adv(24 * 60, { playerHome: null });
  ok(p.grow < 60 && p.grow >= GROW_AT.unge && p.stage === 'unge', `ensam och utan mat i tre dagar: poängen sjönk (${60} → ${Math.round(p.grow)}), aldrig under golvet`);
  const q = S.adopt('hund', 'tax', 'hona', 'Stor', HOME, { day: c.day - 20 });
  for (let d = 0; d < 3; d++) c.adv(24 * 60, { playerHome: null });
  ok(q.stage === 'vuxen' && q.grow === GROW_AT.vuxen, `en vuxen krymper aldrig (${q.stage}, ${q.grow} poäng)`);
}

// ---------------------------------------------------------------------------
section('2b. Dagens krav: lek och leksak krävs');
{
  // katten: mat, ren kattlåda och (oftast) ett klösträd – med och utan lek
  const kitten = (opts, { toy = 'kattklostrad', days = 12, seed = 113 } = {}) => {
    const S = mk(seed);
    const c = clock(S, { day: 10 });
    const k = S.adopt('katt', 'rodkatt', 'hona', 'Misse', HOME, { room: 0, x: 100, y: 150 });
    S.buyItem('sack-katt', 8); S.placeItem('matskal', HOME, 0, 120, 160);
    S.buyItem('kattlada'); S.placeItem('kattlada', HOME, 0, 60, 170);
    if (toy) { S.buyItem(toy); S.placeItem(toy, HOME, 0, 250, 150); }
    const res = { ung: null, vuxen: null, S, k };
    for (let d = 0; d < days; d++) {
      day(S, c, { walks: false, ...opts });
      if (k.stage !== 'unge' && res.ung == null) res.ung = c.day - 10;
      if (k.stage === 'vuxen' && res.vuxen == null) res.vuxen = c.day - 10;
    }
    return res;
  };
  const lek = kitten({ play: true }), utanLek = kitten({ play: false }), utanLeksak = kitten({ play: true }, { toy: null });
  const spam = kitten({ play: false, spam: 15 });
  ok(lek.ung === 3 && lek.vuxen === 7, `katt med mat, ren låda, klösträd och lek: ung dag ${lek.ung}, vuxen dag ${lek.vuxen}`);
  ok(utanLek.k.stage === 'unge' && utanLek.k.grow === 0, `samma katt utan lek: fortfarande kattunge efter 12 dagar (${Math.round(utanLek.k.grow)} poäng)`);
  ok(utanLeksak.k.stage === 'unge' && utanLeksak.k.grow === 0, `med lek men utan leksak: fortfarande kattunge efter 12 dagar (${Math.round(utanLeksak.k.grow)} poäng)`);
  ok(spam.vuxen == null || spam.vuxen > lek.vuxen, `femton snabba Leka-klick en gång om dagen (+ mat, klösträd, låda): vuxen ${spam.vuxen == null ? 'inte på 12 dagar' : 'dag ' + spam.vuxen} – långsammare än riktig lek (dag ${lek.vuxen})`);

  // poängen väntar tills man leker – och räknas då in på en gång
  const S = mk(114);
  const c = clock(S, { day: 10, min: 7 * 60 });
  const k = S.adopt('katt', 'vit', 'hona', 'Vänta', HOME, { room: 0, x: 100, y: 150 });
  S.buyItem('sack-katt'); const b = S.placeItem('matskal', HOME, 0, 120, 160); S.fillBowl(b.id);
  S.buyItem('kattklostrad'); S.placeItem('kattklostrad', HOME, 0, 250, 150);
  c.to(15);
  const held = k.care.held, g = S.growth(k);
  ok(held > 3 && k.grow === 0 && g.waiting && near(g.held, held) && g.pctHeld > 0,
    `utan lek väntar dagens poäng: ${held.toFixed(1)} väntar, ${k.grow} räknade – "${g.text}"`);
  S.play(k.id);
  ok(near(k.grow, held + CARE.lek) && k.care.held === 0 && !S.growth(k).waiting, `en lekstund: allt som väntat räknas in (${k.grow.toFixed(1)} poäng)`);
  // ingen lek på hela dagen: dagens poäng brinner inne vid midnatt
  const T = mk(115);
  const t = clock(T, { day: 10, min: 7 * 60 });
  const q = T.adopt('katt', 'vit', 'hane', 'Glömd', HOME, { room: 0, x: 100, y: 150 });
  T.buyItem('sack-katt'); const tb = T.placeItem('matskal', HOME, 0, 120, 160); T.fillBowl(tb.id);
  T.buyItem('kattklostrad'); T.placeItem('kattklostrad', HOME, 0, 250, 150);
  t.to(23.5);
  const lost = q.care.held;
  t.to(7);
  ok(lost > 5 && q.grow === 0 && q.care.day === 11 && q.care.held < lost, `ingen lek på hela dagen: dagens ${lost.toFixed(1)} poäng räknades aldrig (${q.grow} poäng nästa morgon)`);

  // Leka-knappen: bara en lekstund i taget räknas
  const U = mk(117);
  const u = clock(U, { day: 10, min: 12 * 60 });
  const m = U.adopt('katt', 'svart', 'hona', 'Klick', HOME, { room: 0, x: 100, y: 150 });
  for (let i = 0; i < 15; i++) U.play(m.id);
  ok(m.care.lek === CARE.lek, `femton snabba Leka-klick = en lekstund (${m.care.lek} lekpoäng, inte ${CARE_CAP.lek})`);
  u.adv(31); U.play(m.id);
  ok(m.care.lek === 2 * CARE.lek, `en ny lekstund efter en halvtimme räknas (${m.care.lek})`);
  u.to(23.9); U.play(m.id);
  const l23 = m.care.lek;
  u.adv(10); U.play(m.id); U.pet(m.id); U.pet(m.id);
  ok(l23 === 3 * CARE.lek && m.care.day === 11 && m.care.lek === CARE.klapp, `midnattsknepet: Leka 23:54 och 00:04 blir bara en lekstund (dag 11: ${m.care.lek} lekpoäng – bara klappen)`);

  // kaninen: buren är toalett, gnagmoroten leksak
  const bunny = (toy) => {
    const B = mk(116);
    const bc = clock(B, { day: 10 });
    const r = B.adopt('kanin', 'vit', 'hona', 'Klöver', HOME, { room: 0, x: 100, y: 150 });
    B.buyItem('sack-kanin', 4); B.placeItem('matskal', HOME, 0, 120, 160);
    B.buyItem('kaninbur'); B.placeItem('kaninbur', HOME, 0, 60, 190);
    if (toy) { B.buyItem('leksak-morot'); B.placeItem('leksak-morot', HOME, 0, 250, 170); }
    for (let d = 0; d < 5; d++) day(B, bc, { walks: false });
    return r;
  };
  const med = bunny(true), utan = bunny(false);
  ok(med.stage === 'ung' && utan.stage === 'unge' && utan.grow === 0,
    `kanin med bur, gnagmorot och lek: ${med.stage} efter 5 dagar; med bara bur: ${utan.stage} (${utan.grow} poäng – buren är toaletten, inte en leksak)`);
}

// ---------------------------------------------------------------------------
section('3. Hunden: bajs ute räknas, inne drar');
{
  const S = mk(104);
  const c = clock(S, { day: 10, min: 9 * 60 });
  const a = pup(S, 'Ute'), b = pup(S, 'Inne', 'hona');
  S.buyItem('leksak-ben'); S.placeItem('leksak-ben', HOME, 0, 220, 180);
  S.play(a.id); S.play(b.id); c.adv(10); // dagens krav: lek och en leksak hemma
  ok(a.care.held === 0 && b.care.held === 0 && S.growth(a).today.ok, 'dagens krav uppfyllda (lek och tuggben) – poängen räknas direkt');
  a.grow = 30; b.grow = 30; a.toilet = 60; b.toilet = 60;
  ok(S.walkStart(a.id).ok, 'koppel på Ute');
  c.adv(15, { playerHome: null, outdoors: true });
  S.walkEnd();
  ok(a.care.toa === CARE.uteToa && a.care.inne === 0, `Ute gjorde sitt ute: toalettpoäng ${a.care.toa} (+${CARE.uteToa}), ${a.care.inne} olyckor`);
  ok(a.grow >= 30 + CARE.uteToa, `Utes tillväxt steg (30 → ${a.grow.toFixed(1)}; promenaden gav också lek ${a.care.lek.toFixed(1)})`);
  b.toilet = 100;
  const g0 = b.grow;
  c.adv(20, { playerHome: HOME });
  ok(S.messes.some((m) => m.by === 'hund') && b.care.inne === 1 && b.care.toa === 0, `Inne bajsade/kissade inne: ${b.care.inne} olycka, inga toalettpoäng`);
  ok(b.grow < g0 - 6, `…och tillväxten drog (${g0.toFixed(1)} → ${b.grow.toFixed(1)})`);
  // lagrets väg: petToilet på golvet drar också, promenaden via staden (outdoorBusiness) räknas
  const g1 = a.grow;
  S.petToilet(a.id, { x: 100, y: 150 });
  ok(a.grow < g1 && a.care.inne === 1, `petToilet() på golvet (lagret) drar (${g1.toFixed(1)} → ${a.grow.toFixed(1)})`);
  a.toilet = 50; S.walkStart(a.id);
  const t0 = a.care.toa;
  ok(S.outdoorBusiness(a.id) && a.care.toa === Math.min(CARE_CAP.toa, t0 + CARE.uteToa), `outdoorBusiness() (följaren i staden) räknas: toalettpoäng ${t0} → ${a.care.toa}`);
  S.walkEnd();
  const t1 = a.care.toa;
  a.toilet = 50; S.walkStart(a.id); S.outdoorBusiness(a.id); S.walkEnd();
  ok(a.care.toa === CARE_CAP.toa && t1 === CARE_CAP.toa, `taket per dag: högst ${CARE_CAP.toa} toalettpoäng (${a.care.toa})`);
  // tillväxtraden: hunden som bajsat inne behöver promenad
  ok(S.growth(b).missing.includes('promenad'), `growth(): Inne "${S.growth(b).text}"`);

  // en lång promenad: följaren låter hunden göra sitt – hemkomsten ger inga poäng till
  const D = mk(118);
  const d = clock(D, { day: 10, min: 9 * 60 });
  const h = pup(D, 'Långben');
  D.buyItem('leksak-ben'); D.placeItem('leksak-ben', HOME, 0, 220, 180); D.play(h.id); d.adv(10);
  const utes = [];
  D.listen((e) => { if (e.type === 'ute') utes.push(e); });
  h.toilet = 60; D.walkStart(h.id);
  d.adv(5, { playerHome: null, outdoors: true, followerHandlesBusiness: true });
  ok(D.outdoorBusiness(h.id), 'följaren: hunden gör sitt på trottoaren');
  d.adv(40, { playerHome: null, outdoors: true, followerHandlesBusiness: true });
  const t40 = h.toilet;
  D.walkEnd();
  ok(h.care.toa === CARE.uteToa && utes.length === 1 && h.toilet === 0,
    `45 minuters promenad: en gång "gjorde sitt ute", ${h.care.toa} toalettpoäng (inte ${2 * CARE.uteToa}); kissade lite till vid hemkomsten (${t40.toFixed(1)} → 0)`);

  // koppel på men kvar inne: hunden kan inte hålla sig för evigt
  const K = mk(119);
  const k = clock(K, { day: 10, min: 9 * 60 });
  const dog = pup(K, 'Koppel');
  dog.toilet = 50; K.walkStart(dog.id);
  k.adv(5 * 60, { playerHome: HOME, playerRoom: 0 });
  const mess = K.messes.find((m) => m.by === 'hund');
  ok(!!mess && dog.care.inne === 1 && dog.out && mess.room === 0 && dog.toilet < 30,
    `koppel på inne i fem timmar: olycka inne (${dog.care.inne}) i rummet där spelaren är (rum ${mess?.room}), fortfarande i koppel`);
}

// ---------------------------------------------------------------------------
section('4. Katten: kattlådan räknas (ren låda)');
{
  const S = mk(105);
  const c = clock(S, { day: 10, min: 10 * 60 });
  const k = S.adopt('katt', 'rodkatt', 'hona', 'Misse', HOME, { room: 0, x: 100, y: 150 });
  ok(S.growth(k).missing.includes('kattlåda'), `utan kattlåda: "${S.growth(k).text}"`);
  S.buyItem('kattklostrad'); S.placeItem('kattklostrad', HOME, 0, 250, 150); S.play(k.id); c.adv(10); // dagens krav
  S.buyItem('kattlada'); const box = S.placeItem('kattlada', HOME, 0, 60, 170);
  k.grow = 20; k.toilet = 100;
  c.adv(20, { playerHome: null });
  ok(box.dirt > 0 && k.care.toa === CARE.ladaToa && k.grow >= 20 + CARE.ladaToa, `ren låda: katten gjorde sitt där (+${k.care.toa} toalettpoäng, ${k.grow.toFixed(1)} poäng)`);
  box.dirt = 0.8; k.toilet = 100;
  const t0 = k.care.toa;
  c.adv(20, { playerHome: null });
  ok(k.care.toa === t0 && k.toilet < 10 && S.messes.length === 0, `smutsig låda (80 %): används men ger inga poäng (${k.care.toa})`);
  ok(S.growth(k).missing.includes('tömd kattlåda'), `growth(): "${S.growth(k).text}"`);
  S.cleanLitter(box.id);
  // lagrets väg: katten går till lådan (petToilet med itemId)
  k.toilet = 100;
  const t1 = k.care.toa;
  S.petToilet(k.id, { itemId: box.id });
  ok(k.care.toa === t1 + CARE.ladaToa, `petToilet() i den tömda lådan (lagret) räknas (${t1} → ${k.care.toa})`);
  // utan låda: på golvet
  S.pickItem(box.id);
  k.toilet = 100;
  const g = k.grow;
  c.adv(20, { playerHome: null });
  ok(S.messes.some((m) => m.by === 'katt') && k.grow < g, `utan låda: på golvet och tillväxten drar (${g.toFixed(1)} → ${k.grow.toFixed(1)})`);
  // över flera dagar: katten med låda växer, katten utan växer långsammare (båda har klösträd och lek)
  const run = (withBox) => {
    const T = mk(106);
    const t = clock(T, { day: 10 });
    const q = T.adopt('katt', 'svart', 'hane', 'Sotis', HOME, { room: 0, x: 100, y: 150 });
    T.buyItem('sack-katt', 8); T.placeItem('matskal', HOME, 0, 120, 160);
    T.buyItem('kattklostrad'); T.placeItem('kattklostrad', HOME, 0, 250, 150);
    if (withBox) { T.buyItem('kattlada'); T.placeItem('kattlada', HOME, 0, 60, 170); }
    let ung = null;
    for (let d = 0; d < 5; d++) { day(T, t, { walks: false }); if (ung == null && q.stage !== 'unge') ung = t.day - 10; }
    return { q, ung, messes: T.messes.length };
  };
  const med = run(true), utan = run(false);
  ok(med.q.grow > utan.q.grow + 30 && med.ung === 3 && (utan.ung == null || utan.ung > 3),
    `fem dagar: med kattlåda ung dag ${med.ung} (${Math.round(med.q.grow)} p), utan ${utan.ung == null ? 'fortfarande kattunge' : 'ung först dag ' + utan.ung} (${Math.round(utan.q.grow)} p, ${utan.messes} olyckor)`);
}

// ---------------------------------------------------------------------------
section('5. Leksak hemma räknas (klösträd, ben, gnagmorot) och en kastad boll');
{
  const run = (item, species = 'katt') => {
    const S = mk(107);
    const c = clock(S, { day: 10 });
    const p = S.adopt(species, '', 'hona', 'Tuss', HOME, { room: 0, x: 100, y: 150 });
    if (item) { S.buyItem(item); S.placeItem(item, HOME, 0, 250, 170); }
    S.play(p.id); // dagens lek – så att leksaken är det enda som skiljer
    c.adv(12 * 60);
    return { S, p };
  };
  const klos = run('kattklostrad'), ingen = run(null);
  ok(klos.p.care.leksak > 3 && ingen.p.care.leksak === 0, `katt med klösträd: leksakspoäng ${klos.p.care.leksak.toFixed(1)}, utan: ${ingen.p.care.leksak}`);
  ok(klos.p.grow > 4 && ingen.p.grow === 0, `…och växer (${klos.p.grow.toFixed(1)} poäng) – utan leksak växer den inte alls (${ingen.p.grow} poäng, ${ingen.p.care.held.toFixed(1)} väntar)`);
  ok(!klos.S.growth(klos.p).missing.includes('leksak') && ingen.S.growth(ingen.p).missing.includes('leksak'), `growth(): utan leksak "${ingen.S.growth(ingen.p).text}"`);
  const ben = run('leksak-ben', 'hund');
  ok(ben.p.care.leksak > 3 && ben.p.grow > 4, `hund med tuggben: leksakspoäng ${ben.p.care.leksak.toFixed(1)}, växer (${ben.p.grow.toFixed(1)} p)`);
  const kmorot = run('leksak-morot', 'kanin'), kbur = run('kaninbur', 'kanin'), kboll = run('leksak-boll', 'kanin');
  ok(kmorot.p.care.leksak > 3 && kmorot.p.grow > 4 && kbur.p.care.leksak === 0 && kboll.p.care.leksak === 0,
    `kaninens leksak är gnagmoroten: ${kmorot.p.care.leksak.toFixed(1)} (buren: ${kbur.p.care.leksak} – den är toaletten; bollen: ${kboll.p.care.leksak})`);
  ok(kbur.S.growth(kbur.p).missing.includes('leksak') && kmorot.S.growth(kmorot.p).missing.includes('en bur'),
    `growth(): kanin med bara bur "${kbur.S.growth(kbur.p).text}", med bara gnagmorot "${kmorot.S.growth(kmorot.p).text}"`);
  const capped = run('kattklostrad');
  capped.S.syncTo(10, 23 * 60, { home: HOME, playerHome: HOME, playerRoom: 0 });
  ok(capped.p.care.leksak <= CARE_CAP.leksak, `taket per dag: ${capped.p.care.leksak.toFixed(1)} ≤ ${CARE_CAP.leksak}`);
  // kastad boll (lagret anropar toyPlay när djuret hinner fram)
  const { S, p } = run('leksak-boll', 'hund');
  const l0 = p.care.lek;
  ok(S.toyPlay(p.id) && p.care.lek === l0 + CARE.boll, `toyPlay(): bollen räknas som lek (${l0} → ${p.care.lek})`);
  ok(!S.toyPlay(p.id), 'toyPlay() igen direkt räknas inte (10 speldminuter emellan)');
}

// ---------------------------------------------------------------------------
section('6. Minsta tiden gäller');
{
  const S = mk(108);
  const c = clock(S, { day: 10 });
  const p = pup(S);
  p.grow = 1000; // mer än nog för vuxen – ändå krävs tid
  const seq = [];
  const g11 = [];
  for (let d = 0; d < 8; d++) { c.adv(24 * 60); seq.push(`${c.day}:${p.stage}`); if (c.day === 11) g11.push(S.growth(p)); }
  ok(seq.join(' ') === '11:unge 12:unge 13:ung 14:ung 15:ung 16:ung 17:vuxen 18:vuxen', `stadier dag för dag: ${seq.join(' ')}`);
  ok(g11[0]?.ready && g11[0]?.daysLeft === 2 && /om 2 dagar/.test(g11[0]?.text), `growth() dag 11: "${g11[0]?.text}"`);
  // ett djur som köps äldre har vuxit upp hos uppfödaren
  const q = S.adopt('katt', 'vit', 'hona', 'Äldre', HOME, { day: c.day - 9 });
  ok(q.stage === 'vuxen' && q.grow === GROW_AT.vuxen && q.homeDay === c.day, `adopterad nio dagar gammal: vuxen direkt (${q.grow} poäng, hemma sedan dag ${q.homeDay})`);
  const r = S.adopt('katt', 'vit', 'hane', 'Tonåring', HOME, { day: c.day - 4 });
  ok(r.stage === 'ung' && r.grow === GROW_AT.ung && r.stageDay === c.day - 1, `adopterad fyra dagar gammal: ung (ung sedan dag ${r.stageDay})`);
  // butiken vet inte vilken dag det är (ingen klocka, aldrig tickad): hemkomstdagen avgörs vid första synken
  const V = mk(112);
  const v = V.adopt('hund', 'tax', 'hane', 'Okänd', HOME, { day: 0 });
  const w = V.adopt('katt', 'vit', 'hona', 'Nyköpt', HOME, { day: 9 });
  ok(v.homeDay === null && w.homeDay === null, 'utan klocka: homeDay okänd (null) tills första synken');
  V.syncTo(9, 10 * 60, { home: HOME });
  ok(v.stage === 'vuxen' && v.homeDay === 9 && v.grow === GROW_AT.vuxen, `…nio dagar gammal vid första synken dag 9: vuxen (${v.stage}, ${v.grow} p)`);
  ok(w.stage === 'unge' && w.homeDay === 9, `…född samma dag: unge (${w.stage})`);
}

// ---------------------------------------------------------------------------
section('7. Gamla sparfiler');
{
  // Sparfil i det gamla formatet (gjord med sim.js före tillväxt av omsorg, se
  // tools/out/djur-vaxer/gammal-sparfil.mjs): kattunge, ung tax och vuxen kanin på dag 20.
  const OLD = {"v":1,"pets":[{"id":"p1","name":"Gammelmisse","species":"katt","breed":"rodkatt","sex":"hona","bornDay":19,"stage":"unge","hunger":69.25,"happy":87.41666666666674,"toilet":37.59999999999997,"home":"lagenhet","room":0,"x":100,"y":150,"following":false,"out":false,"lover":null,"pregnantUntil":null,"seed":425601},{"id":"p2","name":"Gammelbamse","species":"hund","breed":"tax","sex":"hane","bornDay":15,"stage":"ung","hunger":68.49999999999991,"happy":87.3333333333334,"toilet":43.00000000000001,"home":"lagenhet","room":0,"x":140,"y":160,"following":false,"out":false,"lover":null,"pregnantUntil":null,"seed":42219},{"id":"p3","name":"Gammelklöver","species":"kanin","breed":"vit","sex":"hona","bornDay":2,"stage":"vuxen","hunger":68.49999999999991,"happy":82.8333333333334,"toilet":40,"home":"lagenhet","room":0,"x":180,"y":170,"following":false,"out":false,"lover":null,"pregnantUntil":null,"seed":696006}],"items":[{"id":"i4","k":"matskal","home":"lagenhet","room":0,"x":120,"y":160,"food":0,"foodKind":null}],"inventory":{"koppel":1,"sack-hund":1},"messes":[],"opened":{},"gifts":{"skal":true,"koppel":true},"log":[],"nextId":5,"clockAbs":28080,"day":20};
  const st = memStorage();
  st.setItem('snabbfilen_pets1', JSON.stringify(OLD));
  const S = createPetStore({ storage: st, rng: seededRng(109) });
  S.load();
  const [m, b, k] = ['p1', 'p2', 'p3'].map((id) => S.petById(id));
  ok(m.stage === 'unge' && b.stage === 'ung' && k.stage === 'vuxen', `stadierna behålls (${m.stage}, ${b.stage}, ${k.stage})`);
  ok(m.grow === GROW_AT.unge && b.grow === GROW_AT.ung && k.grow === GROW_AT.vuxen, `startpoäng efter stadium (${m.grow}, ${b.grow}, ${k.grow})`);
  ok(m.stageDay === 19 && b.stageDay === 18 && k.stageDay === 9, `minsta tiden räknas från när stadiet nåddes med de gamla reglerna (${m.stageDay}, ${b.stageDay}, ${k.stageDay})`);
  ok([m, b, k].every((p) => p.homeDay === p.bornDay), 'homeDay = födelsedagen (inget växer längre av ålder)');
  const saved = S.toJSON().pets;
  const same = OLD.pets.every((o) => { const n = saved.find((q) => q.id === o.id); return Object.keys(o).every((key) => JSON.stringify(n[key]) === JSON.stringify(o[key])); });
  ok(same, 'alla gamla fält är orörda efter load() → toJSON() (bara nya fält: grow, stageDay, homeDay, care)');
  const extra = Object.keys(saved[0]).filter((key) => !(key in OLD.pets[0]));
  ok(extra.sort().join(',') === 'care,grow,homeDay,stageDay', `nya fält: ${extra.join(', ')}`);
  // försummelse i fem dagar: ingen krymper, kattungen växer inte av ålder
  const c = { day: 20, min: 12 * 60 };
  S.syncTo(c.day, c.min, { home: HOME });
  for (let d = 0; d < 5; d++) { c.day++; S.syncTo(c.day, c.min, { home: HOME, playerHome: null }); }
  ok(m.stage === 'unge' && b.stage === 'ung' && k.stage === 'vuxen', `fem dagar utan omsorg: ${m.stage}, ${b.stage}, ${k.stage} – ingen krympte, ingen växte av ålder`);
  ok(m.grow >= GROW_AT.unge && b.grow >= GROW_AT.ung && k.grow >= GROW_AT.vuxen, 'poängen under golvet aldrig');
  // en kattunge i en gammal fil som enligt åldern "borde" vara vuxen hoppar inte upp
  const OLD2 = JSON.parse(JSON.stringify(OLD));
  OLD2.pets[0].bornDay = 5;
  const T = createPetStore({ storage: null, rng: seededRng(110) });
  T.load(OLD2);
  T.syncTo(21, 8 * 60, { home: HOME });
  ok(T.pets[0].stage === 'unge', `gammal kattunge född dag 5 (15 dagar) är fortfarande unge dagen efter (${T.pets[0].stage}) – den växer av omsorg nu`);
  // ny sparfil → ladda → samma
  S.save();
  const U = createPetStore({ storage: st, rng: seededRng(109) });
  U.load();
  ok(JSON.stringify(U.toJSON()) === JSON.stringify(S.toJSON()), 'nytt format: laddat = sparat (grow, stageDay, homeDay, care)');
}

// ---------------------------------------------------------------------------
section('8. Djurmenyns rad (growth())');
{
  const S = mk(111);
  const c = clock(S, { day: 10, min: 7 * 60 });
  const p = pup(S);
  S.buyItem('sack-hund'); const bowl = S.placeItem('matskal', HOME, 0, 120, 160); S.fillBowl(bowl.id);
  let g = S.growth(p);
  ok(g.text === 'Växer inte än i dag – behöver lek, leksak, promenad.' && g.waiting, `ny valp på morgonen: "${g.text}"`);
  ok(g.next === 'ung' && g.pct === 0 && g.need === GROW_AT.ung && g.daysLeft === 3, `nästa: ung, 0 %, ${g.daysLeft} dagar kvar som minst`);
  S.buyItem('leksak-boll'); S.placeItem('leksak-boll', HOME, 0, 200, 180);
  S.play(p.id); c.adv(40); S.play(p.id); S.pet(p.id);
  p.toilet = 60; S.walkStart(p.id); c.adv(25, { playerHome: null, outdoors: true }); S.walkEnd();
  g = S.growth(p);
  ok(g.missing.length === 0 && g.text === 'Växer så det knakar – allt är bra!', `efter lek, boll och promenad: "${g.text}" (${Math.round(g.pct * 100)} %)`);
  p.hunger = 20;
  ok(S.growth(p).missing[0] === 'mat', `hungrig: "${S.growth(p).text}"`);
  ok(DAY_NEED.lek <= CARE.lek && DAY_NEED.lek <= 2 * CARE.klapp, `dagens krav: ${DAY_NEED.lek} lekpoäng = en lekstund eller två klappar`);

  // seenNews: toasten och bubblan markeras var för sig och sparas direkt
  const st = memStorage();
  const V = createPetStore({ storage: st, rng: seededRng(120) });
  const vc = clock(V, { day: 10 });
  const v = pup(V, 'Sparis');
  v.grow = 150; v.stageDay = 7; vc.adv(20);
  const ev = V.growthNews()[0];
  ok(v.stage === 'ung' && ev && ev.told === false && ev.seen === false, `växte: "${ev?.text}" – varken toast eller bubbla visad än`);
  const savedEv = () => JSON.parse(st.getItem('snabbfilen_pets1')).log.find((e) => e.type === 'vaxte');
  V.seenNews(ev, { toast: true, bubble: false });
  ok(savedEv().told === true && savedEv().seen === false && V.growthNews().length === 1, 'toasten visad (sparat direkt) – bubblan väntar tills man går in till djuret');
  V.seenNews(ev);
  ok(savedEv().seen === true && V.growthNews().length === 0, 'bubblan visad – sparat direkt (visas inte igen om fliken stängs)');
}

// ===========================================================================
//  Del 2: i webbläsaren (det riktiga hemmet)
// ===========================================================================
const PORT = process.env.SMOKE_PORT || process.env.PORT || '8788';
let chromium = null;
try {
  const { createRequire } = await import('module');
  const require = createRequire('D:/Qisy/QISYFrontend/QISYFrontend-1/package.json');
  ({ chromium } = require('playwright'));
} catch (e) { fails++; console.log('FEL: playwright saknas – ' + e.message); }

if (chromium) await browserPart();

console.log(`\n${passes} ok, ${fails} fel`);
process.exit(fails ? 1 : 0);

async function browserPart() {
  section(`9–11. I hemmet (port ${PORT})`);
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1180, height: 720 } });
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  page.on('console', (m) => m.type() === 'error' && !/peer|webrtc|ice|Could not connect|Failed to load resource/i.test(m.text()) && errs.push(m.text()));
  try {
    await page.goto(`http://localhost:${PORT}/index.html?world=gr${Date.now().toString(36)}`);
    await page.evaluate(() => {
      localStorage.clear();
      localStorage.setItem('snabbfilen_avatar', JSON.stringify({ name: 'Djurvän', look: { skin: '#e0a97f', hair: '#3b2619', style: 'long', shirt: '#3a7bd5', pants: '#2d3a5c' }, color: '#ffd23f' }));
      localStorage.setItem('snabbfilen_save1', JSON.stringify({ v: 1, day: 9, min: 11 * 60, money: 20000, hunger: 90, energy: 90, home: 'lagenhet', fridge: {}, jobs: {}, earned: 0, wardrobe: [], storage: [], deco: {}, won: false }));
    });
    await page.reload();
    await page.waitForFunction(() => !!window.SF?.game && window.SF.sceneName === 'room', null, { timeout: 20000 });
    await page.waitForTimeout(600);
    const ev = (fn, arg) => page.evaluate(fn, arg);
    const wait = (ms) => page.waitForTimeout(ms);
    const until = async (fn, arg, ms = 8000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await ev(fn, arg)) return true; await wait(120); } return false; };
    const closeModal = () => ev(() => { if (!document.getElementById('modal').classList.contains('hidden')) (document.querySelector('#modal [data-close]') || [...document.querySelectorAll('#modal .dlg-foot .btn')].pop())?.click(); });
    async function clickAt(x, y) {
      const b = await page.locator('#scene').boundingBox();
      await page.mouse.click(b.x + (x + 0.5) * b.width / 384, b.y + (y + 0.5) * b.height / 216);
    }
    const spot = (id) => ev((id) => window.SF.scene._debug.layer()._debug.spot(id), id);
    // canvasens logiska pixlar → png (hela rummet, eller en ruta runt (cx, cy)), skala s
    const shot = async (name, { cx = null, cy = null, w = 384, h = 216, s = 3 } = {}) => {
      const url = await ev(({ cx, cy, w, h, s }) => {
        const c = document.querySelector('#scene');
        const full = document.createElement('canvas'); full.width = 384; full.height = 216;
        const f = full.getContext('2d'); f.imageSmoothingEnabled = false; f.drawImage(c, 0, 0, 384, 216);
        const x0 = cx == null ? 0 : Math.max(0, Math.min(384 - w, Math.round(cx - w / 2))), y0 = cy == null ? 0 : Math.max(0, Math.min(216 - h, Math.round(cy - h / 2)));
        const o = document.createElement('canvas'); o.width = w * s; o.height = h * s;
        const x = o.getContext('2d'); x.imageSmoothingEnabled = false;
        x.drawImage(full, x0, y0, w, h, 0, 0, w * s, h * s);
        return o.toDataURL('image/png');
      }, { cx, cy, w, h, s });
      fs.writeFileSync(OUT + name + '.png', Buffer.from(url.split(',')[1], 'base64'));
      console.log('   → tools/out/djur-vaxer/' + name + '.png');
    };
    async function openMenu(id, name) {
      for (let k = 0; k < 5; k++) {
        await closeModal();
        const s = await spot(id);
        if (!s) return false;
        await clickAt(s.x, s.y);
        if (await until((n) => !document.getElementById('modal').classList.contains('hidden') && document.querySelector('#modal').textContent.includes(n), name, 6000)) return true;
      }
      return false;
    }
    const toastHas = (re) => ev((src) => [...document.querySelectorAll('#toasts .toast')].some((t) => new RegExp(src).test(t.textContent)), re.source);
    const petSize = (id) => ev(async (id) => { const SP = await import('/js/pets/sprites.js'); const p = window.__pets.petById(id); return SP.petSize(p); }, id);
    // "växer vid nästa steg": poäng och minsta tid uppfyllda, klockan går fram lite
    const growNow = (id, pts, days) => ev(({ id, pts, days }) => { const s = window.__pets, p = s.petById(id), g = window.SF.game; p.grow = pts; p.stageDay = g.day - days; g.min += 11; }, { id, pts, days });

    // ---------- 9. valpen: menyn, växa till ung och vuxen ----------
    const ids = await ev(async () => {
      const { petStore } = await import('/js/pets/sim.js');
      const s = petStore(), g = window.SF.game;
      s.reset();
      const hund = s.adopt('hund', 'labrador', 'hane', 'Bamse', g.home, { day: g.day });
      const katt = s.adopt('katt', 'rodkatt', 'hona', 'Misse', g.home, { day: g.day });
      for (const k of ['matskal', 'sack-hund', 'sack-katt', 'leksak-boll']) s.buyItem(k, 1);
      window.__pets = s;
      window.SF.go('city'); window.SF.go('room');
      return { hund: hund.id, katt: katt.id };
    });
    await wait(1400);
    const st0 = await ev((id) => window.__pets.petById(id).stage, ids.hund);
    ok(st0 === 'unge', `Bamse är en valp när han kommer hem (${st0})`);
    const size0 = await petSize(ids.hund);
    let s = await spot(ids.hund);
    await shot('1-valp-fore', { cx: s.x, cy: s.y - 6, w: 96, h: 64, s: 5 });
    ok(await openMenu(ids.hund, 'Bamse'), 'klick på Bamse → djurmenyn');
    const row = await ev(() => { const r = document.querySelector('#modal [data-grow]'); return r ? r.textContent.replace(/\s+/g, ' ').trim() : null; });
    // valpen har inte lekt än i dag: dagens poäng väntar ("Växer inte än i dag – behöver lek, …")
    ok(!!row && /Tillväxt/.test(row) && /Nästa: unghund/.test(row) && /Växer inte än i dag – behöver .*lek/.test(row), `TILLVÄXT-raden: "${row}"`);
    await page.screenshot({ path: OUT + '2-meny-valp.png' });
    console.log('   → tools/out/djur-vaxer/2-meny-valp.png');
    await closeModal();
    await wait(300);

    await growNow(ids.hund, 150, 3);
    ok(await until((id) => window.__pets.petById(id).stage === 'ung', ids.hund, 6000), 'Bamse växte till ung (poäng + tre dagar)');
    ok(await until(() => [...document.querySelectorAll('#toasts .toast')].some((t) => t.textContent.includes('🐕 Bamse har vuxit! Nu är han ung.')), null, 3000),
      'toast: "🐕 Bamse har vuxit! Nu är han ung."');
    const grew = await ev((id) => window.SF.scene._debug.layer()._debug.grew(id), ids.hund);
    ok(grew && grew.t > 0 && grew.stage === 'ung', `pratbubblan "JAG HAR VUXIT!" visas över Bamse (${grew?.t.toFixed(1)} s kvar)`);
    await wait(250);
    s = await spot(ids.hund);
    await shot('3-vaxte-ung-bubbla', { cx: s.x, cy: s.y - 14, w: 96, h: 64, s: 5 });
    await shot('3-vaxte-ung-rummet');
    const size1 = await petSize(ids.hund);
    ok(size1.h > size0.h && size1.w > size0.w, `Bamse ritas större (${size0.w}×${size0.h} → ${size1.w}×${size1.h})`);
    ok(await ev(() => window.__pets.growthNews().length === 0), 'händelsen är markerad som visad');
    await wait(3600);
    s = await spot(ids.hund);
    await shot('4-ung-efter', { cx: s.x, cy: s.y - 6, w: 96, h: 64, s: 5 });

    ok(await openMenu(ids.hund, 'Bamse'), 'djurmenyn igen');
    const row2 = await ev(() => document.querySelector('#modal [data-grow]')?.textContent.replace(/\s+/g, ' ').trim());
    ok(/Nästa: hund/.test(row2 || ''), `som unghund: "${row2}"`);
    await closeModal();
    await wait(300);
    await growNow(ids.hund, 320, 4);
    ok(await until((id) => window.__pets.petById(id).stage === 'vuxen', ids.hund, 6000), 'Bamse växte till vuxen');
    ok(await until(() => [...document.querySelectorAll('#toasts .toast')].some((t) => t.textContent.includes('🐕 Bamse har vuxit! Nu är han vuxen.')), null, 3000), 'toast: "🐕 Bamse har vuxit! Nu är han vuxen."');
    await wait(250);
    s = await spot(ids.hund);
    await shot('5-vaxte-vuxen-bubbla', { cx: s.x, cy: s.y - 16, w: 96, h: 64, s: 5 });
    const size2 = await petSize(ids.hund);
    ok(size2.h >= size1.h && size2.w > size1.w, `vuxen: ännu större (${size1.w}×${size1.h} → ${size2.w}×${size2.h})`);
    const speed = await ev((id) => window.SF.scene._debug.layer()._debug.grew(id).walkSp, ids.hund);
    ok(speed > 0, `gångfarten räknades om för det nya stadiet (${speed.toFixed(1)} px/s)`);
    await wait(3600);
    ok(await openMenu(ids.hund, 'Bamse'), 'djurmenyn som vuxen');
    const row3 = await ev(() => document.querySelector('#modal [data-grow]')?.textContent.replace(/\s+/g, ' ').trim());
    ok(/Fullvuxen/.test(row3 || '') && /✔/.test(row3 || ''), `vuxen: "${row3}"`);
    await page.screenshot({ path: OUT + '6-meny-vuxen.png' });
    console.log('   → tools/out/djur-vaxer/6-meny-vuxen.png');
    await closeModal();

    // ---------- 10. katten växer medan man är i stan ----------
    await ev(() => window.SF.go('city'));
    await wait(700);
    await ev((id) => { const p = window.__pets.petById(id), g = window.SF.game; p.grow = 150; p.stageDay = g.day - 3; g.passTime ? g.passTime(15) : (g.min += 15); }, ids.katt);
    await wait(800);
    const inCity = await ev((id) => ({ stage: window.__pets.petById(id).stage, news: window.__pets.growthNews().map((e) => e.text) }), ids.katt);
    ok(inCity.stage === 'ung' && inCity.news.length === 1, `Misse växte medan du var i stan – väntar på att visas (${inCity.news.join(' | ')})`);
    ok(!(await toastHas(/Misse har vuxit/)), 'ingen toast i stan för ett djur som är hemma');
    await ev(() => window.SF.go('room'));
    ok(await until(() => [...document.querySelectorAll('#toasts .toast')].some((t) => t.textContent.includes('🐈 Misse har vuxit! Nu är hon ung.')), null, 4000), 'hemma: toast "🐈 Misse har vuxit! Nu är hon ung."');
    const g2 = await ev((id) => window.SF.scene._debug.layer()._debug.grew(id), ids.katt);
    ok(g2 && g2.t > 0, 'och pratbubblan över Misse');
    await wait(250);
    s = await spot(ids.katt);
    await shot('7-misse-hemkomst', { cx: s.x, cy: s.y - 14, w: 96, h: 64, s: 5 });

    // ---------- 11. kastad boll räknas som lek ----------
    await wait(3000);
    let counted = false;
    for (let k = 0; k < 5 && !counted; k++) {
      const before = await ev((ids) => [ids.hund, ids.katt].map((id) => window.__pets.petById(id).care?.lek || 0), ids);
      await ev(() => { window.SF.game.min += 12; }); // förra bollkastet räknas inte två gånger på tio speldminuter
      await closeModal();
      // bollen till en ledig golvplats en bit från djuren (står ett djur på bollen öppnas dess meny i stället)
      await ev(() => {
        const L = window.SF.scene._debug.layer(), pets = L._debug.pets(), ball = L._debug.items().find((i) => i.k === 'leksak-boll');
        const far = ([x, y]) => Math.min(...pets.map((p) => Math.hypot(p.x - x, p.y - y)));
        const best = [[230, 150], [200, 140], [260, 130], [150, 150], [300, 120]].sort((a, b) => far(b) - far(a))[0];
        if (ball) window.__pets.moveItem(ball.id, best[0], best[1]);
      });
      await wait(100);
      const b = await spot('leksak-boll');
      if (!b) break;
      await clickAt(b.x, b.y);
      // figuren går först fram till bollen och kastar, sedan springer djuren efter (kan ta en stund)
      counted = await until((arg) => [arg.ids.hund, arg.ids.katt].some((id, i) => (window.__pets.petById(id).care?.lek || 0) > arg.before[i]), { ids, before }, 12000);
    }
    ok(counted, 'en kastad boll som djuret springer efter räknas som lek (toyPlay)');
    await shot('8-bollen');

    // ---------- 12. två djur växer samtidigt tätt ihop: bubblorna krockar inte ----------
    section('12. Två syskon växer samma stund, tätt ihop');
    await closeModal();
    await wait(3000); // Misses bubbla från hemkomsten är borta
    const tw = await ev(() => {
      const s = window.__pets, g = window.SF.game;
      const a = s.adopt('hund', 'labrador', 'hane', 'Kurre', g.home, { day: g.day, room: 0, x: 176, y: 172 });
      const b = s.adopt('hund', 'labrador', 'hona', 'Tassa', g.home, { day: g.day, room: 0, x: 184, y: 173 });
      return [a.id, b.id];
    });
    ok(await until((ids) => ids.every((id) => window.SF.scene._debug.layer()._debug.actors.has(id)), tw, 4000), 'Kurre och Tassa syns i rummet');
    // sida vid sida (8 px isär) och stilla – utan glidning skulle bubblorna (≈ 80 px breda) täcka varandra
    await ev((ids) => { const D = window.SF.scene._debug.layer()._debug; ids.forEach((id, i) => { const a = D.actors.get(id); a.x = 176 + i * 8; a.y = 172 + i; a.path = []; D.goTo(id, a.x, a.y); }); }, tw);
    await wait(200);
    await ev((ids) => { const s = window.__pets, g = window.SF.game; for (const id of ids) { const p = s.petById(id); p.grow = 150; p.stageDay = g.day - 3; } g.min += 11; }, tw);
    ok(await until((ids) => ids.every((id) => window.__pets.petById(id).stage === 'ung'), tw, 6000), 'båda växte till ung samma stund');
    ok(await until(() => ['Kurre', 'Tassa'].every((n) => [...document.querySelectorAll('#toasts .toast')].some((t) => t.textContent.includes(`${n} har vuxit!`))), null, 3000),
      'två toasts: Kurre och Tassa har vuxit');
    await wait(450); // bubblorna har glidit på plats
    const bub = await ev((ids) => window.SF.scene._debug.layer()._debug.bubbles().filter((b) => ids.includes(b.id)), tw);
    const over = (p, q) => p.x0 < q.x0 + q.w && q.x0 < p.x0 + p.w && p.y0 < q.y0 + q.h + 3 && q.y0 < p.y0 + p.h + 3; // + spetsen
    const [b1, b2] = bub;
    ok(bub.length === 2 && Math.abs(b1.petX - b2.petX) < Math.min(b1.w, b2.w),
      `två bubblor över djur som står ${bub.length === 2 ? Math.abs(b1.petX - b2.petX) : '?'} px isär (bubblorna är ${b1?.w} px breda)`);
    ok(bub.length === 2 && !over(b1, b2), `bubblorna täcker inte varandra (${bub.map((b) => `${b.name} ${b.x0},${b.y0} ${b.w}×${b.h}`).join(' | ')})`);
    ok(bub.every((b) => b.petX >= b.x0 - 1 && b.petX <= b.x0 + b.w + 1), 'varje bubblas spets pekar på sitt djur (djuret står under bubblan)');
    await shot('9-tva-bubblor', { cx: (b1?.petX ?? 180) + 4, cy: Math.min(b1?.y0 ?? 130, b2?.y0 ?? 130) + 28, w: 120, h: 76, s: 5 });

    // ---------- 13. djuret växer i ett annat rum ----------
    section('13. Djuret växer i sovrummet medan du är i vardagsrummet');
    const sov = await ev(() => {
      const s = window.__pets, g = window.SF.game;
      const k = s.adopt('katt', 'svart', 'hane', 'Sovis', g.home, { day: g.day, room: 1 });
      window.__sovisToasts = 0;
      new MutationObserver((ms) => { for (const m of ms) for (const n of m.addedNodes) if ((n.textContent || '').includes('Sovis har vuxit')) window.__sovisToasts++; })
        .observe(document.getElementById('toasts'), { childList: true, subtree: true });
      return k.id;
    });
    await growNow(sov, 150, 3);
    ok(await until((id) => window.__pets.petById(id).stage === 'ung', sov, 6000), 'Sovis (i sovrummet) växte till ung');
    ok(await until(() => window.__sovisToasts === 1, null, 3000), 'toasten kommer direkt, fast Sovis är i ett annat rum');
    const n13 = await ev((id) => ({ here: !!window.SF.scene._debug.layer()._debug.grew(id), news: window.__pets.growthNews().map((e) => ({ told: e.told, seen: e.seen })) }), sov);
    ok(!n13.here && n13.news.length === 1 && n13.news[0].told === true && n13.news[0].seen === false, 'bubblan väntar tills du går in till Sovis (toasten markerad som visad)');
    await ev(() => { window.SF.roomSub = 1; window.SF.go('room'); });
    ok(await until((id) => window.SF.roomSub === 1 && !!window.SF.scene._debug.layer?.() && (window.SF.scene._debug.layer()._debug.grew(id)?.t || 0) > 0, sov, 6000),
      'i sovrummet: pratbubblan över Sovis');
    await wait(400);
    ok(await ev(() => window.__sovisToasts === 1 && window.__pets.growthNews().length === 0), 'ingen ny toast när du går in – bara bubblan, och nu är allt visat');
    s = await spot(sov);
    await shot('10-sovis-annat-rum', { cx: s.x, cy: s.y - 14, w: 96, h: 64, s: 5 });

    // ---------- 14. kaninen och gnagmoroten ----------
    section('14. Kaninen och gnagmoroten');
    await wait(3600);
    const st = await ev(() => {
      const s = window.__pets, g = window.SF.game;
      const r = s.adopt('kanin', 'vit', 'hane', 'Stampe', g.home, { day: g.day, room: 1 });
      for (const k of ['kaninbur', 'leksak-morot', 'sack-kanin']) s.buyItem(k, 1); // som från djuraffären
      window.SF.go('room'); // lagret ställer ut det nya (autoPlace) när man kommer in
      return r.id;
    });
    ok(await until(() => { const L = window.SF.scene._debug.layer?.(); return !!L && ['leksak-morot', 'kaninbur'].every((k) => L._debug.items().some((i) => i.k === k)); }, null, 6000),
      'gnagmoroten och buren står i sovrummet');
    await wait(500);
    await ev((id) => window.SF.scene._debug.layer()._debug.setMode(id, 'play'), st);
    const gnaw = await until((id) => { const L = window.SF.scene._debug.layer()._debug; const a = L.pets().find((p) => p.id === id), m = L.items().find((i) => i.k === 'leksak-morot'); return a && m && a.pose === 'eat' && Math.hypot(a.x - m.x, a.y - m.y) < 12; }, st, 25000); // står moroten bakom sängen tar det en stund
    ok(gnaw, 'Stampe hoppar fram till gnagmoroten och gnager på den');
    const m14 = await ev(() => { const m = window.SF.scene._debug.layer()._debug.items().find((i) => i.k === 'leksak-morot'); return m ? { x: m.x, y: m.y } : null; });
    await shot('11-kanin-gnagmorot', { cx: m14?.x ?? 150, cy: (m14?.y ?? 170) - 8, w: 80, h: 48, s: 6 });
    await ev(() => { window.SF.game.min += 30; });
    ok(await until((id) => (window.__pets.petById(id).care?.leksak || 0) > 0, st, 5000), 'gnagmoroten räknas som kaninens leksak (leksakspoäng)');
    const miss = await ev((id) => window.__pets.growth(id).missing, st);
    ok(!miss.includes('leksak') && !miss.includes('en bur'), `Stampe saknar varken leksak eller bur (saknas: ${miss.join(', ') || 'inget'})`);
    await shot('12-sovrummet');
  } catch (e) {
    fails++; console.log('FEL: webbläsardelen kraschade – ' + (e?.stack || e));
  }
  ok(errs.length === 0, errs.length ? 'konsolfel:\n' + errs.join('\n') : 'inga konsolfel');
  await browser.close();
}
