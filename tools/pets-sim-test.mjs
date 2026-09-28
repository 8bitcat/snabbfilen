// Regeltester för husdjurssimuleringen (js/pets/sim.js) – körs i node:
//   node tools/pets-sim-test.mjs
// Simulerar många speldagar och kontrollerar hunger, att djur äter ur skålen,
// kattlådan, hundens toalett med/utan promenader, växande, kärlek → ungar,
// max 12 djur, sparning/laddning och determinism (injicerbar slump).
import { createPetStore, seededRng, MAX_PETS, PET_RULES } from '../js/pets/sim.js';
import { PET_ITEMS } from '../js/pets/items.js';

let fails = 0, passes = 0;
const ok = (cond, msg) => { if (cond) { passes++; console.log('  ok  ' + msg); } else { fails++; console.log('  FEL ' + msg); } };
const section = (s) => console.log('\n# ' + s);
const memStorage = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), _m: m }; };
const mk = (seed = 1) => createPetStore({ storage: memStorage(), rng: seededRng(seed) });
const HOME = 'lagenhet';

// Spelklocka som i spelet: dagen 07–23, sömn 23→07. Returnerar funktioner för att gå framåt.
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
// en omtänksam spelare fyller alla tomma skålar
const refill = (S) => { for (const b of S.items.filter((i) => i.k === 'matskal' && i.food < 0.3)) S.fillBowl(b.id); };

// ---------------------------------------------------------------------------
section('Katalogen');
for (const k of ['matskal', 'vattenskal', 'kattlada', 'hundkorg', 'kattkorg', 'kaninbur', 'kattklostrad', 'leksak-boll', 'leksak-ben', 'sack-katt', 'sack-hund', 'sack-kanin', 'koppel'])
  ok(PET_ITEMS[k] && PET_ITEMS[k].namn && PET_ITEMS[k].pris > 0 && PET_ITEMS[k].w > 0 && Array.isArray(PET_ITEMS[k].forArt), `PET_ITEMS.${k} finns (${PET_ITEMS[k]?.namn}, ${PET_ITEMS[k]?.pris} kr)`);

// ---------------------------------------------------------------------------
section('Adoption och gåvor');
{
  const S = mk();
  const c = clock(S, { day: 5 });
  const cat = S.adopt('katt', 'tigrerad', 'hona', 'Misse', HOME);
  ok(cat && cat.id && cat.stage === 'unge' && cat.bornDay === 5, 'kattungen börjar som unge, född i dag');
  ok(cat.ok === true && !JSON.stringify(cat).includes('"ok"'), 'returvärdet har .ok utan att det sparas');
  ok(S.inventory.matskal === 1, 'första djuret ger en gratis matskål');
  ok(!S.inventory.koppel, 'katt ger inget koppel');
  const dog = S.adopt('hund', 'tax', 'hane', '', HOME);
  ok(dog && dog.name.length > 0, `hunden fick ett namn automatiskt (${dog.name})`);
  ok(S.inventory.koppel === 1 && S.inventory.matskal === 1, 'första hunden ger ett koppel (men ingen extra skål)');
  const bad = S.adopt('drake', 'x', 'hane', 'Puff', HOME);
  ok(bad === null && S.lastError, 'okänd art nekas: ' + S.lastError);
  c.adv(1);
}

// ---------------------------------------------------------------------------
section('Hunger och skålen');
{
  const S = mk(2);
  const c = clock(S);
  const cat = S.adopt('katt', 'svart', 'hane', 'Sotis', HOME, { room: 0, x: 100, y: 150 });
  const h0 = cat.hunger;
  c.adv(6 * 60, { playerHome: null });
  ok(cat.hunger < h0 - 20, `hungern sjunker utan mat (${h0} → ${Math.round(cat.hunger)})`);
  const bowl = S.placeItem('matskal', HOME, 0, 120, 160);
  ok(bowl && bowl.food === 0, 'matskålen ställs ut tom');
  let r = S.fillBowl(bowl.id);
  ok(r === false && S.lastReason === 'ingen-sack', 'fylla utan säck går inte (false): ' + S.lastError);
  S.buyItem('sack-katt', 1);
  r = S.fillBowl(bowl.id);
  const sack = S.items.find((i) => i.k === 'sack-katt');
  ok(r.ok && bowl.food === 1 && bowl.foodKind === 'katt', 'säck ur förrådet → skålen full med kattmat');
  ok(sack && sack.left === PET_ITEMS['sack-katt'].portioner - 1 && !S.inventory['sack-katt'], `säcken ställdes ut bredvid skålen (${sack?.left} portioner kvar)`);
  const hBefore = cat.hunger;
  c.adv(3 * 60, { playerHome: null });
  ok(cat.hunger > hBefore && bowl.food < 1, `katten åt själv ur skålen (mätt ${Math.round(hBefore)} → ${Math.round(cat.hunger)}, skål ${bowl.food.toFixed(2)})`);
  ok(cat.x != null && Math.abs(cat.x - bowl.x) <= 8, 'katten flyttade sig till skålen');
  r = S.fillBowl(bowl.id, { sackId: sack.id });
  ok(r.ok && sack.left === PET_ITEMS['sack-katt'].portioner - 2, 'fylla ur den utplacerade säcken drar en portion');
  // tom säck försvinner
  sack.left = 1; bowl.food = 0;
  r = S.fillBowl(bowl.id, { sackId: sack.id });
  ok(r.ok && r.emptied && !S.itemById(sack.id), 'sista portionen – tomma säcken slängs');
  // vattenskål
  const w = S.placeItem('vattenskal', HOME, 0, 140, 160);
  ok(!w, 'vattenskål kan inte ställas ut utan att vara köpt');
  S.buyItem('vattenskal');
  const w2 = S.placeItem('vattenskal', HOME, 0, 140, 160);
  c.adv(12 * 60, { playerHome: null });
  ok(w2.water < 1, `vattnet tar slut långsamt (${w2.water.toFixed(2)})`);
  ok(S.fillBowl(w2.id).ok && w2.water === 1, 'vattenskålen fylls från kranen (ingen säck behövs)');
  // plocka upp påbörjad säck
  S.buyItem('sack-katt');
  const s2 = S.placeItem('sack-katt', HOME, 0, 200, 170);
  s2.left = 4;
  ok(S.pickItem(s2.id) && S.opened['sack-katt'] === 4 && !S.inventory['sack-katt'], 'påbörjad säck minns sina portioner i förrådet');
  const s3 = S.placeItem('sack-katt', HOME, 0, 200, 170);
  ok(s3 && s3.left === 4, 'och ställs ut igen med samma innehåll');
}

// ---------------------------------------------------------------------------
section('Kattlådan');
{
  const S = mk(3);
  const c = clock(S);
  const cat = S.adopt('katt', 'rodkatt', 'hane', 'Findus', HOME, { room: 0, x: 100, y: 150 });
  S.buyItem('sack-katt', 3);
  const bowl = S.placeItem('matskal', HOME, 0, 120, 160);
  S.buyItem('kattlada');
  const box = S.placeItem('kattlada', HOME, 0, 60, 170);
  for (let d = 0; d < 3; d++) { refill(S); c.to(12); refill(S); c.to(19); refill(S); c.to(23); c.to(7); }
  ok(box.dirt > 0.2, `lådan fylls när katten gör sina behov (smuts ${box.dirt.toFixed(2)})`);
  ok(S.messes.length === 0, 'inga olyckor på golvet när lådan finns');
  ok(S.cleanLitter(box.id) && box.dirt === 0, 'tömma lådan nollar smutsen');
  // full låda → katten gör på golvet
  box.dirt = 1;
  for (let d = 0; d < 2; d++) { refill(S); c.to(12); refill(S); c.to(23); c.to(7); }
  ok(S.messes.some((m) => m.by === 'katt'), 'överfull låda → katten gör på golvet');
  ok(cat.happy < 90, 'smutsig låda gör katten mindre glad');
  const m = S.messes[0];
  ok(S.cleanMess(m.id) && !S.messes.includes(m), 'städa bort en olycka');
}

// ---------------------------------------------------------------------------
section('Hunden: bajsar inne utan promenad, men inte med');
{
  const run = (walks) => {
    const S = mk(4);
    const c = clock(S);
    const dog = S.adopt('hund', 'labrador', 'hane', 'Bamse', HOME, { room: 0, x: 100, y: 150 });
    S.buyItem('sack-hund', 5);
    S.placeItem('matskal', HOME, 0, 120, 160);
    let maxToilet = 0;
    for (let d = 0; d < 5; d++) {
      refill(S);
      for (const [h0, h1] of [[8, 9], [12, 13], [17, 18], [22, 23]]) {
        c.to(h0);
        if (walks) {
          const r = S.walkStart(dog.id);
          if (!r) throw new Error(S.lastError);
          c.adv(25, { playerHome: null, outdoors: true });
          S.walkEnd();
        }
        maxToilet = Math.max(maxToilet, dog.toilet);
        c.to(h1);
        refill(S);
      }
      c.to(7); // sover över natten
    }
    return { S, dog, maxToilet };
  };
  const lazy = run(false);
  ok(lazy.S.messes.filter((m) => m.by === 'hund').length >= 3, `utan promenader: ${lazy.S.messes.length} olyckor inne på 5 dagar`);
  ok(lazy.S.messes.some((m) => m.kind === 'kiss') && lazy.S.messes.some((m) => m.kind === 'bajs'), 'både bajs och kiss');
  const good = run(true);
  ok(good.S.messes.length === 0, `med fyra promenader om dagen: ${good.S.messes.length} olyckor`);
  ok(good.dog.happy > lazy.dog.happy, `promenader gör hunden gladare (${Math.round(good.dog.happy)} mot ${Math.round(lazy.dog.happy)})`);
  // walkStart/walkEnd-detaljer
  const S = mk(5);
  const c = clock(S);
  const dog = S.adopt('hund', 'mops', 'hona', 'Bella', HOME, { room: 0, x: 100, y: 150 });
  delete S.inventory.koppel;
  ok(S.walkStart(dog.id) === false && /koppel/.test(S.lastError), 'utan koppel går det inte att gå ut med hunden (false): ' + S.lastError);
  S.buyItem('koppel');
  dog.toilet = 70;
  ok(S.walkStart(dog.id).ok && dog.out, 'koppel på');
  ok(!S.petsIn(HOME, 0).includes(dog), 'hunden på promenad räknas inte som hemma i rummet');
  c.adv(3, { playerHome: null, outdoors: true });
  ok(dog.toilet > 60, 'kort promenad räcker inte');
  c.adv(10, { playerHome: null, outdoors: true });
  ok(dog.toilet < 5, 'efter en stund ute har hunden gjort sitt (toaletten nollad)');
  S.walkEnd();
  ok(!dog.out && dog.room === null, 'hemma igen – rummet väljs av nästa lager');
  // följaren kan själv trigga
  dog.toilet = 60;
  S.walkStart(dog.id);
  ok(S.outdoorBusiness(dog.id) && dog.toilet === 0, 'outdoorBusiness() (följaren i staden) nollar toaletten');
  ok(!S.outdoorBusiness(dog.id), '…bara en gång per promenad');
  S.walkEnd(dog.id);
}

// ---------------------------------------------------------------------------
section('Kaninen och buren');
{
  const S = mk(6);
  const c = clock(S);
  const r = S.adopt('kanin', 'dvargvadur', 'hona', 'Klöver', HOME, { room: 0, x: 100, y: 150 });
  S.buyItem('sack-kanin', 2);
  S.placeItem('matskal', HOME, 0, 120, 160);
  for (let d = 0; d < 2; d++) { refill(S); c.to(15); refill(S); c.to(23); c.to(7); }
  ok(S.messes.some((m) => m.by === 'kanin'), 'utan bur lämnar kaninen bajs på golvet');
  S.messes = [];
  S.buyItem('kaninbur');
  const cage = S.placeItem('kaninbur', HOME, 0, 200, 170);
  for (let d = 0; d < 2; d++) { refill(S); c.to(15); refill(S); c.to(23); c.to(7); }
  ok(S.messes.length === 0 && cage.dirt > 0, `med bur hamnar allt i halmen (smuts ${cage.dirt.toFixed(2)})`);
  ok(S.cleanLitter(cage.id) && cage.dirt === 0, 'byta halm i buren');
  ok(r.hunger > 30, `kaninen är mätt (${Math.round(r.hunger)})`);
}

// ---------------------------------------------------------------------------
section('Växa');
{
  const S = mk(7);
  const c = clock(S, { day: 10 });
  const p = S.adopt('hund', 'pudel', 'hona', 'Stella', HOME);
  S.buyItem('sack-hund', 3); S.placeItem('matskal', HOME, 0, 120, 160);
  const stages = [];
  for (let d = 0; d < 9; d++) { stages.push(p.stage); refill(S); c.to(23); c.to(7); }
  ok(stages[0] === 'unge' && stages[2] === 'unge', 'unge de första dagarna');
  ok(stages[3] === 'ung', `ung efter 3 dagar (${stages.join(',')})`);
  ok(stages[7] === 'vuxen' && p.stage === 'vuxen', 'vuxen efter 7 dagar');
  ok(S.log.some((e) => e.type === 'vaxte'), 'händelse när djuret växer');
}

// ---------------------------------------------------------------------------
section('Kärlek → ungar');
{
  const S = mk(8);
  const c = clock(S, { day: 20 });
  const a = S.adopt('katt', 'siames', 'hona', 'Luna', HOME, { day: 1, room: 0, x: 100, y: 150 });
  const b = S.adopt('katt', 'norsk', 'hane', 'Måns', HOME, { day: 1, room: 0, x: 130, y: 160 });
  const events = [];
  const unsub = S.listen((e) => events.push(e));
  S.buyItem('sack-katt', 9); S.buyItem('matskal'); S.buyItem('kattlada'); S.buyItem('kattklostrad'); S.buyItem('leksak-boll');
  S.placeItem('matskal', HOME, 0, 120, 160); S.placeItem('matskal', HOME, 0, 150, 160);
  S.placeItem('kattlada', HOME, 0, 60, 170); S.placeItem('kattklostrad', HOME, 0, 250, 150); S.placeItem('leksak-boll', HOME, 0, 200, 190);
  c.adv(10);
  ok(a.stage === 'vuxen' && b.stage === 'vuxen', 'båda vuxna');
  let loveDay = null, birthDay = null;
  for (let d = 0; d < 6 && birthDay == null; d++) {
    for (const h of [10, 13, 16, 19, 22]) { refill(S); for (const box of S.items.filter((i) => i.k === 'kattlada')) S.cleanLitter(box.id); c.to(h); S.pet(a.id); S.pet(b.id); }
    if (loveDay == null && a.lover) loveDay = c.day;
    if (birthDay == null && S.pets.length > 2) birthDay = c.day;
    c.to(7);
    if (loveDay == null && a.lover) loveDay = c.day;
    if (birthDay == null && S.pets.length > 2) birthDay = c.day;
  }
  ok(a.lover === b.id && b.lover === a.id, 'hona + hane, glada och mätta → kära');
  ok(events.some((e) => e.type === 'kar'), 'händelse: kära');
  const kids = S.pets.filter((p) => p.parents?.[0] === a.id);
  ok(kids.length >= 1 && kids.length <= 3, `${kids.length} kattungar föddes`);
  ok(birthDay != null && loveDay != null && birthDay - loveDay >= 2 && birthDay - loveDay <= 3, `ungarna kom 2 dagar efter kärleken (dag ${loveDay} → ${birthDay})`);
  ok(kids.every((k) => k.stage === 'unge' && k.species === 'katt' && ['siames', 'norsk'].includes(k.breed)), 'ungarna är kattungar av föräldrarnas raser');
  ok(kids.every((k) => k.mix && k.mix.includes('siames')), 'blandras-info sparas (mix)');
  ok(new Set(S.pets.map((p) => p.name)).size === S.pets.length, 'alla har unika namn');
  unsub();
  // samma kön → inga ungar
  const T = mk(9);
  const t = clock(T, { day: 20 });
  T.adopt('hund', 'tax', 'hane', 'A', HOME, { day: 1 }); T.adopt('hund', 'tax', 'hane', 'B', HOME, { day: 1 });
  T.buyItem('sack-hund', 9); T.placeItem('matskal', HOME, 0, 120, 160);
  for (let d = 0; d < 5; d++) { for (const h of [10, 14, 18, 22]) { refill(T); t.to(h); for (const p of T.pets) { T.pet(p.id); T.play(p.id); } } t.to(7); }
  ok(T.pets.length === 2 && T.pets.every((p) => !p.lover), 'två hanar blir inte föräldrar');
  // olika arter → inga ungar
  const U = mk(10);
  const u = clock(U, { day: 20 });
  U.adopt('hund', 'tax', 'hane', 'A', HOME, { day: 1 }); U.adopt('katt', 'vit', 'hona', 'B', HOME, { day: 1 });
  U.buyItem('sack-hund', 9); U.buyItem('sack-katt', 9); U.buyItem('matskal'); U.placeItem('matskal', HOME, 0, 120, 160); U.placeItem('matskal', HOME, 0, 160, 160);
  for (let d = 0; d < 4; d++) { for (const h of [10, 14, 18, 22]) { refill(U); u.to(h); for (const p of U.pets) U.pet(p.id); } u.to(7); }
  ok(U.pets.length === 2, 'hund + katt blir inte föräldrar');
}

// ---------------------------------------------------------------------------
section('Max 12 djur');
{
  const S = mk(11);
  const c = clock(S, { day: 30 });
  for (let i = 0; i < 3; i++) { S.adopt('kanin', 'vit', 'hona', 'H' + i, HOME, { day: 1 }); S.adopt('kanin', 'brun', 'hane', 'K' + i, HOME, { day: 1 }); }
  S.buyItem('sack-kanin', 40); S.buyItem('matskal', 5); S.buyItem('kaninbur', 2);
  for (let i = 0; i < 6; i++) S.placeItem('matskal', HOME, 0, 60 + i * 20, 160);
  S.placeItem('kaninbur', HOME, 0, 60, 190); S.placeItem('kaninbur', HOME, 0, 250, 190);
  let peak = 0;
  for (let d = 0; d < 30; d++) {
    for (const h of [9, 12, 15, 18, 21]) { refill(S); for (const b of S.items.filter((i) => i.k === 'kaninbur')) S.cleanLitter(b.id); c.to(h); for (const p of S.pets) S.pet(p.id); peak = Math.max(peak, S.pets.length); }
    c.to(7);
    peak = Math.max(peak, S.pets.length);
  }
  ok(peak <= MAX_PETS && S.pets.length === MAX_PETS, `kaninerna förökade sig upp till taket (${S.pets.length}, högst ${peak})`);
  ok(S.adopt('katt', 'vit', 'hane', 'X', HOME) === null && /12/.test(S.lastError), 'adopt nekas vid 12: ' + S.lastError);
  ok(S.pets.every((p) => p.pregnantUntil == null || S.pets.length < MAX_PETS), 'ingen blir dräktig när det är fullt');
}

// ---------------------------------------------------------------------------
section('Glädje och ensamhet');
{
  const mkDog = (playerHome) => {
    const S = mk(12);
    const c = clock(S);
    const d = S.adopt('hund', 'golden', 'hane', 'Hugo', HOME, { day: -10, room: 0, x: 100, y: 150 });
    S.buyItem('sack-hund', 3); S.placeItem('matskal', HOME, 0, 120, 160);
    d.happy = 70;
    refill(S);
    c.adv(8 * 60, { playerHome, playerRoom: 0 });
    return d.happy;
  };
  const alone = mkDog(null), together = mkDog(HOME);
  ok(alone < 70 && together > alone + 10, `ensam hund blir ledsen (${Math.round(alone)}), med husse hemma gladare (${Math.round(together)})`);
  const S = mk(13);
  const c = clock(S);
  const p = S.adopt('katt', 'vit', 'hona', 'Snöa', HOME);
  p.happy = 40;
  const h1 = S.pet(p.id);
  ok(h1 === 52, 'klappa ger +12 glädje');
  ok(S.pet(p.id) === 56, 'klappa igen direkt ger mindre');
  c.adv(30);
  ok(S.play(p.id) > 56, 'leka ger mer glädje');
}

// ---------------------------------------------------------------------------
section('Flytt och live-läge');
{
  const S = mk(14);
  const c = clock(S);
  const p = S.adopt('katt', 'vit', 'hona', 'Snöa', 'rum', { room: 0, x: 100, y: 150 });
  S.buyItem('kattlada'); S.placeItem('kattlada', 'rum', 0, 50, 170);
  c.adv(5, { home: 'villa' });
  ok(p.home === 'villa' && p.room === null && S.items.every((i) => i.home === 'villa'), 'spelaren flyttade → djur och prylar följer med (rum väljs om)');
  // live: lagret styr ätandet
  const q = S.adopt('katt', 'svart', 'hane', 'Nisse', 'villa', { room: 1, x: 100, y: 150 });
  S.buyItem('sack-katt'); const b = S.placeItem('matskal', 'villa', 1, 120, 160); S.fillBowl(b.id);
  q.hunger = 40;
  for (let i = 0; i < 20; i++) { S.setLive('villa', 1); c.adv(1, { home: 'villa' }); }
  ok(b.food === 1 && q.hunger < 40, 'i live-rummet äter djuret inte "osynligt" (lagret sköter det)');
  ok(S.feedDirect(q.id, b.id) > 0 && q.hunger > 90 && b.food < 1, 'feedDirect(): lagrets djur äter ur skålen');
  q.toilet = 99.9;
  for (let i = 0; i < 5; i++) { S.setLive('villa', 1); c.adv(1, { home: 'villa' }); }
  ok(q.urge && S.messes.length === 0, 'toalettbehov i live-rummet → urge-flagga (lagret leder katten till lådan)');
  const res = S.petToilet(q.id, { itemId: S.items.find((i) => i.k === 'kattlada').id });
  ok(res.inBox && q.toilet === 0 && !q.urge, 'petToilet() i lådan');
  S.clearLive();
  q.hunger = 40;
  c.adv(20, { home: 'villa' });
  ok(q.hunger > 40, 'utan live äter simuleringen själv igen');
}

// ---------------------------------------------------------------------------
section('Sparning och laddning');
{
  const store = memStorage();
  const S = createPetStore({ storage: store, rng: seededRng(15) });
  const c = clock(S, { day: 3 });
  S.adopt('hund', 'schafer', 'hona', 'Ronja', HOME, { room: 0, x: 90, y: 150 });
  S.adopt('katt', 'skoldpadd', 'hona', 'Sussi', HOME, { room: 0, x: 60, y: 170 });
  S.buyItem('sack-hund', 2); S.buyItem('kattlada');
  const b = S.placeItem('matskal', HOME, 0, 120, 160); S.fillBowl(b.id);
  S.placeItem('kattlada', HOME, 0, 40, 180);
  c.adv(9 * 60, { playerHome: null });
  S.save();
  const json = store.getItem('snabbfilen_pets1');
  ok(json && JSON.parse(json).v === 1, 'sparat under nyckeln snabbfilen_pets1');
  const T = createPetStore({ storage: store, rng: seededRng(15) });
  T.load();
  ok(JSON.stringify(T.toJSON()) === JSON.stringify(S.toJSON()), 'laddat = sparat (pets, items, inventory, messes, klocka)');
  const t2 = T.adopt('kanin', 'lejonhuvud', 'hane', 'Pompe', HOME);
  ok(!S.pets.some((p) => p.id === t2.id), 'nya id:n krockar inte efter laddning');
  const U = createPetStore({ storage: { getItem: () => '{trasig', setItem() {} } });
  U.load();
  ok(U.pets.length === 0, 'trasig sparfil → tom butik utan krasch');
  const V = createPetStore({ storage: null });
  V.load(); V.adopt('katt', 'vit', 'hane', 'Y', HOME);
  ok(V.save() === false && V.pets.length === 1, 'utan lagring fungerar allt ändå');
}

// ---------------------------------------------------------------------------
section('Determinism och långkörning');
{
  const runLong = (seed) => {
    const S = mk(seed);
    const c = clock(S, { day: 1 });
    S.adopt('katt', 'tigrerad', 'hona', 'A', HOME, { room: 0, x: 80, y: 150 });
    S.adopt('katt', 'svart', 'hane', 'B', HOME, { room: 0, x: 120, y: 150 });
    S.adopt('hund', 'husky', 'hona', 'C', HOME, { room: 0, x: 160, y: 150 });
    S.adopt('hund', 'tax', 'hane', 'D', HOME, { room: 0, x: 200, y: 150 });
    S.buyItem('sack-katt', 30); S.buyItem('sack-hund', 30); S.buyItem('matskal', 3); S.buyItem('kattlada');
    for (let i = 0; i < 4; i++) S.placeItem('matskal', HOME, 0, 60 + i * 30, 160);
    S.placeItem('kattlada', HOME, 0, 40, 190);
    for (let d = 0; d < 40; d++) {
      for (const h of [9, 13, 17, 21]) {
        refill(S);
        for (const m of [...S.messes]) S.cleanMess(m.id);
        for (const box of S.items.filter((i) => i.k === 'kattlada')) S.cleanLitter(box.id);
        c.to(h);
        for (const p of S.pets.filter((p) => p.species === 'hund')) S.walkStart(p.id);
        c.adv(20, { playerHome: null, outdoors: true });
        S.walkEnd();
        for (const p of S.pets) S.pet(p.id);
      }
      c.to(7);
    }
    return S;
  };
  const A = runLong(42), B = runLong(42), C = runLong(43);
  ok(JSON.stringify(A.toJSON()) === JSON.stringify(B.toJSON()), 'samma frö → exakt samma värld efter 40 dagar');
  ok(A.pets.length <= MAX_PETS, `40 dagar: ${A.pets.length} djur (${A.summary().lines[0]})`);
  const bad = A.pets.filter((p) => !(p.hunger >= 0 && p.hunger <= 100 && p.happy >= 0 && p.happy <= 100 && p.toilet >= 0));
  ok(bad.length === 0, 'alla värden inom 0–100 efter långkörning');
  ok(A.pets.every((p) => p.hunger > 20), 'väl omskötta djur är mätta hela tiden');
  ok(typeof C.pets.length === 'number', `annat frö ger annan kull (${C.pets.length} djur)`);
  console.log('  sammanfattning:', A.summary().lines.join(' | '));
}

// ---------------------------------------------------------------------------
section('Sammanfattning');
{
  const S = mk(20);
  const c = clock(S);
  ok(S.summary().count === 0 && /Inga husdjur/.test(S.summary().lines[0]), 'tom: "Inga husdjur än"');
  const d = S.adopt('hund', 'jackrussell', 'hane', 'Kurre', HOME, { room: 0, x: 100, y: 100 });
  d.toilet = 85; d.hunger = 20;
  const s = S.summary();
  ok(s.needWalk.includes('Kurre') && s.hungry.includes('Kurre'), 'summary(): hungrig + behöver gå ut');
  ok(S.needs(d).critical === false || S.needs(d).critical === true, 'needs() svarar');
  c.adv(1);
}

console.log(`\n${passes} ok, ${fails} fel`);
process.exit(fails ? 1 : 0);
