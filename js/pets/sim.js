// Husdjuren i Snabbfilen – all logik (ingen ritning, ingen DOM). Helt
// fristående från js/game.js med egen sparnyckel 'snabbfilen_pets1'.
// Körs lika bra i node (tools/pets-sim-test.mjs) som i webbläsaren.
//
// ============================== API ==============================
// import { petStore, createPetStore, seededRng, PET_RULES, MAX_PETS } from '../pets/sim.js';
//
// petStore() → singleton (laddas ur localStorage första gången).
// createPetStore({ storage, rng, key }) → ny, fristående butik (tester).
//
// Data (allt sparas):
//   store.pets      [{ id, name, species:'katt'|'hund'|'kanin', breed, sex:'hane'|'hona',
//                      bornDay, stage:'unge'|'ung'|'vuxen', hunger 0–100 (100 = mätt),
//                      happy 0–100, toilet 0–100 (100 = måste NU; visas bara för hund),
//                      home, room (null = "hittas av nästa lager i hemmet"), x, y,
//                      following (följer spelaren runt hemma), out (är ute på promenad),
//                      lover: id|null, pregnantUntil: dag|null, seed (små individuella tecken),
//                      mix?: [rasA, rasB], breed2?: ras (blandras: pälsen från den andra föräldern) }]
//   store.items     [{ id, k, home, room, x, y, food 0–1 + foodKind (matskål),
//                      water 0–1 (vattenskål), dirt 0–1 (kattlåda/kaninbur), left (säck: portioner) }]
//   store.inventory { 'sack-katt': 2, matskal: 1, … }  – köpta men inte utplacerade saker
//   store.messes    [{ id, home, room, x, y, kind:'bajs'|'kiss', by:'hund'|'katt'|'kanin' }]
//
// Metoder:
//   adopt(species, breed, sex, name, home, { day, room, x, y }?) → pet | null (fullt: lastError)
//       Djuret börjar som unge. Första djuret ger en gratis matskål, första hunden ett koppel.
//       bornDay = opts.day, annars spelklockan (setClock), annars senast tickade dag.
//   setClock(() => ({ day, min })) – koppla spelklockan (lagret gör det själv; huvudsessionen kan
//       göra det en gång vid start: petStore().setClock(() => ({ day: A.game.day, min: A.game.min }))).
//       nowDay() → dagen enligt klockan.
//   reset() → tömmer allt (djur, prylar, förråd, olyckor) och sparar – anropa vid NYTT SPEL.
//       Butiken upptäcker också nytt spel själv: spelsparfilen (snabbfilen_save1) saknas när
//       petStore() skapas, eller spelklockan går tillbaka mer än två timmar (syncTo). Då läggs
//       det gamla undan under snabbfilen_pets1_undanlagd_<tid> och butiken börjar om
//       (store.restarted = skälet). opts.day i adopt() får därför gärna ligga bakåt i tiden
//       ("född för tio dagar sedan") – det tolkas aldrig som ett nytt spel.
//   buyItem(k, n = 1)                    → true (lägger i inventory; pengar sköter anroparen)
//   placeItem(k, home, room, x, y)       → item | null (tar ur inventory)
//   moveItem(id, x, y) · pickItem(id)    → true/false (pickItem: tillbaka till inventory)
//   fillBowl(itemId, { sackId, kind }?)  → { ok:true, kind, sackId, emptied } | false
//       Matskål: en portion ur utplacerad säck (sackId, annars rätt säck i hemmet), annars
//       ur inventory (säcken ställs då ut bredvid skålen). Vattenskål: fylls alltid.
//       false → skälet i store.lastError (svensk text) och store.lastReason
//       ('ingen-sack' | 'tom-sack' | 'full' | 'ingen-skal' | 'inte-skal').
//   cleanLitter(itemId) (kattlåda/kaninbur) · cleanMess(messId) → true/false
//   walkStart(petId) → { ok:true, msg } | false (lastError: 'Du behöver ett koppel …', 'för liten':
//       katt-/kaninungar får inte följa med ut; lastReason 'inget-koppel' | 'for-liten')
//       Hund kräver koppel (första hunden får ett gratis). Djuret får out = true: hemma följer
//       det spelaren (hund i koppel), i staden visar scenen det med createPetFollower.
//   walkEnd(petId?) → [djur som kom hem]  – anropa när spelaren kommer hem (eller tar av
//       kopplet), gärna även vid jobbstart och läggdags. Har hunden varit ute ≥ 4 min utan att
//       göra sitt räknas det som gjort. Ett djur som varit ute mer än 6 speltimmar går hem
//       självt (händelse 'hem').
//   outdoorBusiness(petId) → true om hunden fick göra sitt ute (anropas av följaren)
//   pet(petId) · play(petId) → nytt glädjevärde (klappa/leka)
//   rename(petId, namn) · setFollowing(petId, bool) · feedDirect(petId, bowlId) (lagret: djuret äter)
//   petToilet(petId, { itemId } | { x, y }) (lagret: djuret gör sitt i lådan/buren/på golvet)
//   tickMinutes(min, ctx) · syncTo(day, minOfDay, ctx)
//       ctx = { day, hour, playerHome, playerRoom, outdoors, home }
//       syncTo är enklast: anropa varje bildruta med spelklockan – den tickar skillnaden
//       sedan förra anropet (sömn, arbetspass och snabbspolning räknas då automatiskt).
//       ctx.home = spelarens nuvarande bostad → djur och prylar flyttar med vid flytt.
//   setLive(home, room) · clearLive()  (lagret: djuren i rummet styrs av lagret just nu)
//   petsIn(home, room) · itemsIn(home, room) · messesIn(home, room) · petById(id) · itemById(id)
//   hasLeash() · sacksFor(species) · needs(pet) → { hungry, sad, toilet, critical }
//   listen(fn) → avprenumerera;  händelser { type, text, petId?, home? } (typ: 'kar', 'ungar',
//       'vaxte', 'bajs', 'kiss', 'lada', 'hungrig', 'ute', 'hem')
//   save() · load() · summary() → { count, lines[], hungry[], needWalk[], messes, dirtyLitter }
//
// ------------------------- TILLVÄXT AV OMSORG -------------------------
// Djuren växer inte längre bara av ålder. De samlar tillväxtpoäng (p.grow, totalt) när de
// mår bra och blir omskötta, och växer ett steg (unge → ung → vuxen) när poängen räcker
// (GROW_AT) – men aldrig snabbare än en minsta tid i varje stadium (GROW_MIN_DAYS). Poängen
// kommer löpande i fyra slag, vart och ett med ett tak per speldag (CARE_CAP):
//   mat     – mätt (inte hungrig) och inte ledsen, poäng per timme
//   lek     – Klappa/Leka i djurmenyn (bara en lekstund i taget räknas: Klappa var 20:e,
//             Leka var 30:e speldminut), en kastad boll som djuret springer efter (toyPlay,
//             var 10:e minut), promenad ute (per minut)
//   leksak  – minst en leksak hemma: hund boll/tuggben, katt boll/klösträd, kanin gnagmoroten
//   toa     – toaletten sköts rätt: HUNDEN gör sitt UTE på promenad, KATTEN i en ren kattlåda,
//             KANINEN i en fräsch bur
// DAGENS KRAV: lek och leksak KRÄVS. Dagens poäng (alla slag) väntar i care.held och räknas in
// i tillväxten först när djuret har lekt (minst DAY_NEED.lek i dag – en lekstund, två klappar,
// en promenad) och har en leksak hemma. Blir det inte så före midnatt är dagens poäng borta.
// Försummelse ger inga poäng eller drar lite: svält, ledsen/ensam, bajs/kiss inne. Poängen
// sjunker aldrig under stadiets golv – ett djur krymper aldrig.
// Djur som var äldre när de kom hem (adopt med en födelsedag bakåt i tiden) har vuxit upp
// hos uppfödaren: de får stadium efter ålder (STAGE_DAYS) den dag de kommer hem (homeDay).
//   growth(p) → { stage, next, pct 0–1 (inom stadiet), held (dagens väntande poäng), pctHeld,
//                 grow, need, daysLeft, ready, waiting (dagens krav inte uppfyllda),
//                 today: { mat, lek, leksak, toa, inne, held, ok }, missing: ['lek','leksak',…],
//                 text: 'Växer inte än i dag – behöver lek, leksak, promenad.' } (djurmenyns rad)
//   toyPlay(petId) → true om leken räknades (lagret: djuret sprang efter bollen man kastade)
//   growthNews(home?) → händelser 'vaxte' vars pratbubbla ingen visat än (lagret visar dem när
//       man kommer in till djuret). seenNews(ev, { toast, bubble }) markerar toasten (ev.told)
//       och/eller bubblan (ev.seen) som visad och sparar direkt.
//   Nya fält per djur (bakåtkompatibelt – gamla sparfiler får dem vid load()):
//     grow (poäng), stageDay (dagen stadiet började), homeDay (dagen djuret kom hem, null =
//     okänt än), care { day, mat, lek, leksak, toa, inne, held } (dagens poäng per slag)
// ==================================================================
import { PET_ITEMS } from './items.js';

export const PETS_SAVE_KEY = 'snabbfilen_pets1';
const GAME_SAVE_KEY = 'snabbfilen_save1';   // spelets egen sparnyckel (js/game.js SAVE_KEY) – saknas den är spelet nytt
export const MAX_PETS = 12;
export const ARTER = ['katt', 'hund', 'kanin'];
// Ålder (dagar) då ett djur som vuxit upp hos uppfödaren är ungt resp. vuxet när det kommer hem.
export const STAGE_DAYS = { ung: 3, vuxen: 7 };
// Tillväxt av omsorg (se ovan). Full omsorg ≈ 50–56 poäng/dag → ung efter 3 dagar och vuxen 4 dagar
// senare – aldrig snabbare än de gamla åldersreglerna. Halv omsorg tar ungefär dubbelt så lång tid,
// och ett försummat djur växer inte alls.
export const GROW_AT = { unge: 0, ung: 100, vuxen: 300 };   // poäng (totalt) som krävs för stadiet
export const GROW_MIN_DAYS = { unge: 3, ung: 4 };            // minst så här många dagar i stadiet
export const CARE_CAP = { mat: 12, lek: 20, leksak: 8, toa: 16 }; // högst så här mycket per dag och slag
// Dagens krav: så mycket lek (i dag) innan dagens poäng räknas – och en leksak hemma
export const DAY_NEED = { lek: 6 };
export const CARE = {
  matH: 0.6, leksakH: 0.4,            // per timme: mätt, leksak hemma
  klapp: 3, lek: 6, lekIgen: 0,       // Klappa (första gången på en stund), Leka (första / tätt efter:
                                      // inget – annars fyller man dagens lek med femton snabba klick)
  boll: 3, promenadMin: 0.3,          // djuret springer efter en kastad boll; per minut ute på promenad
  uteToa: 8, ladaToa: 7,              // hunden gör sitt ute; katten/kaninen i ren låda/bur
  inne: -8, svaltH: -0.5, ledsenH: -0.25, // bajs/kiss inne; per timme svältande (<15) / ledsen (<25)
};
// Leksaker per art. Kaninens bur är dess toalett (och säng), inte dess leksak – kaninen har
// gnagmoroten (bollen jagar den inte).
export const TOYS_FOR = { hund: ['leksak-boll', 'leksak-ben'], katt: ['leksak-boll', 'kattklostrad'], kanin: ['leksak-morot'] };
const RANK = { unge: 0, ung: 1, vuxen: 2 };
const NEXT = { unge: 'ung', ung: 'vuxen', vuxen: null };
const DIRTY = { kattlada: 0.7, kaninbur: 0.8 }; // så här smutsig räknas lådan/buren inte som skött
const DAYMIN = 24 * 60;
const OUT_MAX_MIN = 6 * 60;      // så länge ett djur orkar vara ute innan det går hem självt
const URGE_GRACE_MIN = 90;       // speldminuter lagret får på sig att leda djuret till lådan
const RESTART_BACK_MIN = 120;    // klockan mer än så här bakåt = nytt spel

// Per art: hunger/timme, hur många mättnadspoäng en full skål ger, toalett/timme,
// ensamhet (glädjeförlust/timme utan sällskap), glädje/timme på promenad.
export const PET_RULES = {
  katt: { hungerH: 4.2, full: 140, toiletH: 8, lonely: 1.2, walkJoy: 3, eatBelow: 55 },
  hund: { hungerH: 5.0, full: 110, toiletH: 11, lonely: 2.6, walkJoy: 12, eatBelow: 55 },
  kanin: { hungerH: 5.5, full: 160, toiletH: 10, lonely: 1.8, walkJoy: 2, eatBelow: 60 },
};
export const ART_NAMN = { katt: 'katt', hund: 'hund', kanin: 'kanin' };

const NAMN = {
  katt: { hane: ['Findus', 'Måns', 'Pelle', 'Gustav', 'Sixten', 'Morris', 'Tiger', 'Ludde', 'Kasper', 'Sotis', 'Egon', 'Pricken'],
    hona: ['Misse', 'Molly', 'Nala', 'Smilla', 'Tussan', 'Luna', 'Sessan', 'Kisse', 'Doris', 'Vilma', 'Mirra', 'Sussi'] },
  hund: { hane: ['Bamse', 'Charlie', 'Rocky', 'Hugo', 'Max', 'Buster', 'Frasse', 'Loke', 'Otto', 'Sigge', 'Tassen', 'Kurre'],
    hona: ['Bella', 'Ronja', 'Stella', 'Tindra', 'Lady', 'Freja', 'Majken', 'Saga', 'Tassa', 'Elsa', 'Nellie', 'Molly'] },
  kanin: { hane: ['Stampe', 'Hoppsan', 'Morot', 'Klumpen', 'Pompe', 'Snöboll', 'Fluffe', 'Kalle', 'Nisse', 'Bosse'],
    hona: ['Nösnäsa', 'Mimmi', 'Lilla My', 'Tofsen', 'Pärla', 'Klöver', 'Bulla', 'Sessan', 'Dunet', 'Majros'] },
};

const stageOf = (age) => (age >= STAGE_DAYS.vuxen ? 'vuxen' : age >= STAGE_DAYS.ung ? 'ung' : 'unge');
const clamp = (v, a = 0, b = 100) => Math.max(a, Math.min(b, v));
const isNum = (v) => typeof v === 'number' && isFinite(v);
const hourOf = (abs) => (((abs % DAYMIN) + DAYMIN) % DAYMIN) / 60;
const dayOf = (abs) => Math.floor(abs / DAYMIN) + 1;
const isNightH = (h) => h >= 22 || h < 7;
const sameRoom = (a, b) => a === b || (a == null && b == null);

// Liten deterministisk slump (för tester och för reproducerbara kullar)
export function seededRng(seed = 1) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createPetStore({ storage = null, rng = Math.random, key = PETS_SAVE_KEY } = {}) {
  const S = {
    pets: [], items: [], inventory: {}, messes: [],
    opened: {},              // påbörjade säckar som plockats upp: { 'sack-katt': portioner }
    gifts: {},               // { skal: true, koppel: true } – gratisgrejer har delats ut
    log: [],                 // senaste händelserna (dagboken)
    nextId: 1,
    clockAbs: null,          // senast tickade speltid (minuter sedan dag 1 00:00)
    day: 1,
    clock: null,             // () => ({ day, min }) – spelklockan, om någon kopplat den (setClock)
    restarted: null,         // skälet om butiken började om (nytt spel upptäckt)
    live: null,              // { home, room, abs } – rummet som lagret styr just nu
    lastError: '', lastReason: '',
    rng, storage, key,
    _listeners: new Set(),
    _sinceSave: 0,

    // ------------------------------------------------------------------
    //  Klockan och nytt spel
    // ------------------------------------------------------------------
    setClock(fn) { S.clock = typeof fn === 'function' ? fn : null; return S; },
    nowDay() {
      if (S.clock) { try { const c = S.clock(); if (c && isNum(+c.day)) return Math.max(1, +c.day | 0); } catch { /* klockan får inte fälla butiken */ } }
      return S.day;
    },
    // Nytt spel: allt bort (sparas tomt). Förra spelets djur ska inte följa med in i nya bostaden.
    reset() {
      S.pets = []; S.items = []; S.inventory = {}; S.messes = []; S.opened = {}; S.gifts = {}; S.log = [];
      S.nextId = 1; S.clockAbs = null; S.day = 1; S.live = null; S.lastError = ''; S.lastReason = '';
      S.save();
      return S;
    },
    // Som reset(), men det gamla läggs undan (snabbfilen_pets1_undanlagd_<tid>) om det fanns något.
    _restart(why = 'nytt spel') {
      const had = S.pets.length > 0 || S.items.length > 0 || Object.keys(S.inventory).length > 0 || S.messes.length > 0;
      if (had && S.storage) { try { S.storage.setItem(`${S.key}_undanlagd_${Date.now()}`, JSON.stringify(S.toJSON())); } catch { /* full */ } }
      S.reset();
      if (had) S.restarted = why;
      return had;
    },

    // ------------------------------------------------------------------
    //  Uppslag
    // ------------------------------------------------------------------
    petById(id) { return S.pets.find((p) => p.id === id) || null; },
    itemById(id) { return S.items.find((i) => i.id === id) || null; },
    petsIn(home, room) { return S.pets.filter((p) => p.home === home && sameRoom(p.room, room) && !p.out); },
    itemsIn(home, room) { return S.items.filter((i) => i.home === home && sameRoom(i.room, room)); },
    messesIn(home, room) { return S.messes.filter((m) => m.home === home && sameRoom(m.room, room)); },
    petsHome(home) { return S.pets.filter((p) => p.home === home); },
    walking() { return S.pets.filter((p) => p.out); },
    hasLeash() { return (S.inventory.koppel | 0) > 0 || S.items.some((i) => i.k === 'koppel'); },
    sacksFor(species) {
      const k = 'sack-' + species;
      return { inventory: (S.inventory[k] | 0), placed: S.items.filter((i) => i.k === k), opened: S.opened[k] | 0 };
    },
    needs(p) {
      const hungry = p.hunger < 35, sad = p.happy < 30, toilet = p.species === 'hund' && p.toilet >= 80;
      return { hungry, sad, toilet, critical: p.hunger < 15 || p.happy < 15 || (p.species === 'hund' && p.toilet >= 92) };
    },

    // ------------------------------------------------------------------
    //  Händelser
    // ------------------------------------------------------------------
    listen(fn) { S._listeners.add(fn); return () => S._listeners.delete(fn); },
    _emit(type, text, extra = {}) {
      const ev = { type, text, day: S.day, ...extra };
      S.log.unshift(ev);
      if (S.log.length > 30) S.log.length = 30;
      for (const fn of S._listeners) { try { fn(ev); } catch { /* lyssnaren får inte stoppa simuleringen */ } }
      return ev;
    },

    // ------------------------------------------------------------------
    //  Köpa, adoptera, placera
    // ------------------------------------------------------------------
    adopt(species, breed, sex, name, home, opts = {}) {
      S.lastError = '';
      if (!ARTER.includes(species)) { S.lastError = 'Okänd djurart.'; return null; }
      if (S.pets.length >= MAX_PETS) { S.lastError = `Du kan ha högst ${MAX_PETS} djur.`; return null; }
      sex = sex === 'hona' ? 'hona' : 'hane';
      const day = isNum(opts.day) ? opts.day : S.nowDay();
      const p = S._newPet({
        species, breed: String(breed || ''), sex, name: cleanName(name) || S._freeName(species, sex),
        bornDay: day, home: home ?? null, room: opts.room ?? null,
        x: isNum(opts.x) ? opts.x : null, y: isNum(opts.y) ? opts.y : null,
      });
      // Hemkomstdagen: S.day kan ligga efter (nyss nollställd butik) – spelklockan vet bäst. Vet
      // butiken inte alls vilken dag det är (ingen klocka, aldrig tickad) avgörs den vid första synken.
      const today = Math.max(S.day, S.nowDay(), day);
      S._settleHome(p, today, !(S.clock || S.clockAbs != null));
      S.pets.push(p);
      if (!S.gifts.skal) { S.gifts.skal = true; S.inventory.matskal = (S.inventory.matskal | 0) + 1; }
      if (species === 'hund' && !S.gifts.koppel) { S.gifts.koppel = true; S.inventory.koppel = (S.inventory.koppel | 0) + 1; }
      S.save();
      return withOk(p);
    },
    _newPet(o) {
      return {
        id: 'p' + (S.nextId++), name: o.name, species: o.species, breed: o.breed, sex: o.sex,
        bornDay: o.bornDay, stage: 'unge', hunger: o.hunger ?? 85, happy: o.happy ?? 80, toilet: o.toilet ?? 10,
        home: o.home, room: o.room, x: o.x, y: o.y, following: false, out: false,
        lover: null, pregnantUntil: null, seed: Math.floor(S.rng() * 1e6),
        ...(o.mix ? { mix: o.mix } : {}), ...(o.breed2 ? { breed2: o.breed2 } : {}),
        grow: 0, stageDay: o.bornDay, homeDay: o.homeDay ?? o.bornDay, care: null,
      };
    },
    // Stadium utan händelse (uppvuxen hos uppfödaren, migrering): poängen minst stadiets golv.
    _setStage(p, st, stageDay) {
      if (!(st in RANK)) st = 'unge';
      p.stage = st;
      p.stageDay = isNum(stageDay) ? stageDay : p.bornDay;
      p.grow = Math.max(isNum(p.grow) ? p.grow : 0, GROW_AT[st]);
    },
    // Djuret kommer hem dag `day`: det som hunnit bli äldre hos uppfödaren får sitt stadium efter
    // ålder (aldrig yngre än det redan är). Därefter växer det bara av omsorg.
    // provisional: dagen är bara en gissning (ingen klocka än) – homeDay lämnas okänd (null)
    // och avgörs vid första synken.
    _settleHome(p, day, provisional = false) {
      const born = isNum(p.bornDay) ? Math.min(p.bornDay, day) : day;
      p.homeDay = provisional ? null : day;
      const st = stageOf(day - born);
      if ((RANK[st] ?? 0) > (RANK[p.stage] ?? 0)) S._setStage(p, st, Math.min(day, born + STAGE_DAYS[st]));
    },
    _freeName(species, sex) {
      const list = NAMN[species]?.[sex] || ['Tuss'];
      const used = new Set(S.pets.map((p) => p.name));
      const free = list.filter((n) => !used.has(n));
      if (free.length) return free[Math.floor(S.rng() * free.length)];
      return list[Math.floor(S.rng() * list.length)] + ' ' + (S.pets.length + 1);
    },
    buyItem(k, n = 1) {
      if (!PET_ITEMS[k]) { S.lastError = 'Okänd vara.'; return false; }
      S.inventory[k] = (S.inventory[k] | 0) + Math.max(1, n | 0);
      S.save();
      return true;
    },
    placeItem(k, home, room, x, y) {
      S.lastError = '';
      const def = PET_ITEMS[k];
      if (!def) { S.lastError = 'Okänd sak.'; return null; }
      const opened = def.typ === 'sack' ? (S.opened[k] | 0) : 0;
      if (!((S.inventory[k] | 0) > 0) && !(opened > 0)) { S.lastError = `Du har ingen ${def.namn.toLowerCase()} kvar att ställa ut.`; return null; }
      let take = 0;
      if (opened > 0) { // påbörjade säckar först
        take = Math.min(opened, def.portioner);
        if (opened - take > 0) S.opened[k] = opened - take; else delete S.opened[k];
      } else { S.inventory[k] -= 1; if (S.inventory[k] <= 0) delete S.inventory[k]; }
      const it = { id: 'i' + (S.nextId++), k, home: home ?? null, room: room ?? null, x: Math.round(+x || 0), y: Math.round(+y || 0) };
      if (def.typ === 'skal') { it.food = 0; it.foodKind = null; }
      if (def.typ === 'vatten') it.water = 1;
      if (def.typ === 'lada' || def.typ === 'bur') it.dirt = 0;
      if (def.typ === 'sack') it.left = take > 0 ? take : def.portioner;
      S.items.push(it);
      S.save();
      return it;
    },
    moveItem(id, x, y) {
      const it = S.itemById(id);
      if (!it) return false;
      it.x = Math.round(+x || 0); it.y = Math.round(+y || 0);
      S.save();
      return true;
    },
    // Tillbaka till inventory. En påbörjad säck minns sina portioner.
    pickItem(id) {
      const i = S.items.findIndex((it) => it.id === id);
      if (i < 0) return false;
      const it = S.items[i];
      S.items.splice(i, 1);
      const def = PET_ITEMS[it.k];
      if (def?.typ === 'sack' && it.left < def.portioner) {
        if (it.left > 0) S.opened[it.k] = (S.opened[it.k] | 0) + it.left;
      } else S.inventory[it.k] = (S.inventory[it.k] | 0) + 1;
      S.save();
      return true;
    },

    // ------------------------------------------------------------------
    //  Skötsel
    // ------------------------------------------------------------------
    // Fyll en matskål med en portion. Rätt säck: den man bär (sackId), annars den art
    // skålen redan har, annars arten som flest hungriga djur i hemmet har.
    fillBowl(itemId, { sackId = null, kind = null } = {}) {
      S.lastError = ''; S.lastReason = '';
      const bowl = S.itemById(itemId);
      if (!bowl) return fail('ingen-skal', 'Skålen finns inte.');
      const def = PET_ITEMS[bowl.k];
      if (def?.typ === 'vatten') {
        if (bowl.water >= 0.98) return fail('full', 'Vattenskålen är redan full.');
        bowl.water = 1;
        S.save();
        return { ok: true, kind: 'vatten', sackId: null };
      }
      if (def?.typ !== 'skal') return fail('inte-skal', 'Det där är ingen matskål.');
      if (bowl.food >= 0.95) return fail('full', 'Skålen är redan full.');
      let sack = sackId ? S.itemById(sackId) : null;
      if (sackId && (!sack || PET_ITEMS[sack.k]?.typ !== 'sack')) return fail('ingen-sack', 'Säcken finns inte längre.');
      if (!sack) {
        const want = kind || (bowl.food > 0.05 && bowl.foodKind) || S._wantedFood(bowl.home, bowl.room);
        const order = [want, ...ARTER.filter((a) => a !== want)];
        for (const a of order) {
          sack = S.items.find((i) => i.k === 'sack-' + a && i.home === bowl.home && i.left > 0);
          if (sack) break;
          if ((S.inventory['sack-' + a] | 0) > 0 || (S.opened['sack-' + a] | 0) > 0) {
            // ta fram en säck ur förrådet och ställ den bredvid skålen
            sack = S.placeItem('sack-' + a, bowl.home, bowl.room, bowl.x + 12, bowl.y - 1);
            if (sack) break;
          }
        }
        if (!sack) return fail('ingen-sack', 'Du har ingen matsäck – köp en i djuraffären.');
      }
      if (!(sack.left > 0)) return fail('tom-sack', 'Säcken är tom.');
      const fk = PET_ITEMS[sack.k].art;
      if (bowl.food > 0.05 && bowl.foodKind && bowl.foodKind !== fk) {
        // blanda inte maten – häll ut resten och fyll med det nya
        bowl.food = 0;
      }
      bowl.food = 1;
      bowl.foodKind = fk;
      sack.left -= 1;
      const emptied = sack.left <= 0;
      if (emptied) S.items = S.items.filter((i) => i !== sack);
      S.save();
      return { ok: true, kind: fk, sackId: sack.id, emptied };
    },
    _wantedFood(home, room) {
      const pets = S.pets.filter((p) => p.home === home);
      if (!pets.length) return 'katt';
      const score = {};
      for (const p of pets) score[p.species] = (score[p.species] || 0) + (100 - p.hunger) + (sameRoom(p.room, room) ? 20 : 0);
      return Object.entries(score).sort((a, b) => b[1] - a[1])[0][0];
    },
    cleanLitter(itemId) {
      const it = S.itemById(itemId);
      if (!it || !('dirt' in it)) return false;
      const was = it.dirt;
      it.dirt = 0;
      S.save();
      return was > 0;
    },
    cleanMess(messId) {
      const n = S.messes.length;
      S.messes = S.messes.filter((m) => m.id !== messId);
      if (S.messes.length !== n) { S.save(); return true; }
      return false;
    },
    walkStart(petId) {
      S.lastError = ''; S.lastReason = '';
      const p = S.petById(petId);
      if (!p) return fail('inget-djur', 'Djuret finns inte.');
      if (p.species === 'hund' && !S.hasLeash()) return fail('inget-koppel', 'Du behöver ett koppel – köp ett i djuraffären.');
      if (p.stage === 'unge' && p.species !== 'hund') return fail('for-liten', `${p.name} är för liten för att gå ut än.`);
      p.out = true; p.outMin = 0; p.outTot = 0; p.didBusiness = false; p.following = false;
      S.save();
      return { ok: true, msg: p.species === 'hund' ? `Koppel på! ${p.name} viftar på svansen.` : `${p.name} följer med ut.` };
    },
    walkEnd(petId = null) {
      const back = [];
      for (const p of S.pets) {
        if (!p.out || (petId && p.id !== petId)) continue;
        S._endWalk(p);
        back.push(p);
      }
      if (back.length) S.save();
      return back;
    },
    _endWalk(p) {
      // Har hunden varit ute en stund utan att göra sitt räknas det som gjort. Gjorde den sitt
      // redan på promenaden kissar den bara lite till – inga nya poäng och ingen ny toast.
      if (p.species === 'hund' && (p.outMin || 0) >= 4 && p.toilet > 5) {
        if (p.didBusiness) p.toilet = 0;
        else S._business(p);
      }
      p.out = false; p.outMin = 0; p.outTot = 0; p.didBusiness = false;
      p.room = null; p.x = null; p.y = null; // nästa lager i hemmet ställer djuret vid spelaren
    },
    // Ute för länge (jobbpass, sömn, glömt koppel): djuret går hem självt.
    _comeHome(p, atHome = false) {
      S._endWalk(p);
      const text = atHome ? `${p.name} tröttnade på att vänta och gick och la sig.`
        : p.species === 'hund' ? `${p.name} tröttnade på att vänta och gick hem själv.` : `${p.name} smet hem på egen hand.`;
      S._emit('hem', text, { petId: p.id, home: p.home });
    },
    outdoorBusiness(petId) {
      const p = S.petById(petId);
      if (!p || !p.out || p.didBusiness || p.toilet < 5) return false;
      S._business(p);
      p.didBusiness = true;
      S.save();
      return true;
    },
    _business(p) {
      p.toilet = 0;
      p.happy = clamp(p.happy + 8);
      S._gain(p, 'toa', CARE.uteToa); // tillväxt: toaletten sköttes rätt – ute
      S._emit('ute', `${p.name} fick göra sitt ute. Duktig!`, { petId: p.id, home: p.home });
    },
    // Klappa: mycket glädje första gången, mindre om man klappar oavbrutet.
    pet(petId) {
      const p = S.petById(petId);
      if (!p) return 0;
      const now = S.clockAbs ?? 0;
      const fresh = p.pattedAt == null || now - p.pattedAt > 20;
      p.happy = clamp(p.happy + (fresh ? 12 : 4));
      p.pattedAt = now;
      if (fresh) S._gain(p, 'lek', CARE.klapp);
      S.save();
      return p.happy;
    },
    play(petId) {
      const p = S.petById(petId);
      if (!p) return 0;
      const now = S.clockAbs ?? 0;
      const fresh = p.playedAt == null || now - p.playedAt > 30;
      p.happy = clamp(p.happy + (fresh ? 18 : 6));
      p.hunger = clamp(p.hunger - 3);
      if (p.species === 'hund') p.toilet = clamp(p.toilet + 3);
      p.playedAt = now;
      S._gain(p, 'lek', fresh ? CARE.lek : CARE.lekIgen);
      S.save();
      return p.happy;
    },
    // Lagret: djuret sprang efter bollen som spelaren kastade (en gång per 10 speldminuter räknas).
    toyPlay(petId) {
      const p = S.petById(petId);
      if (!p || p.out) return false;
      const now = S.clockAbs ?? 0;
      if (p.toyAt != null && now - p.toyAt < 10 && now >= p.toyAt) return false;
      p.toyAt = now;
      p.happy = clamp(p.happy + 4);
      S._gain(p, 'lek', CARE.boll);
      S.save();
      return true;
    },
    rename(petId, name) {
      const p = S.petById(petId);
      const n = cleanName(name);
      if (!p || !n) return false;
      p.name = n;
      S.save();
      return true;
    },
    setFollowing(petId, on) {
      const p = S.petById(petId);
      if (!p) return false;
      p.following = !!on;
      S.save();
      return true;
    },
    setPos(petId, x, y, room) {
      const p = S.petById(petId);
      if (!p) return false;
      p.x = x; p.y = y;
      if (room !== undefined) p.room = room;
      return true;
    },
    // Lagret: djuret har gått fram till skålen och äter. Ger mättnad direkt.
    feedDirect(petId, bowlId) {
      const p = S.petById(petId), b = S.itemById(bowlId);
      if (!p || !b || !(b.food > 0)) return 0;
      return S._eat(p, b);
    },
    _eat(p, b) {
      const R = PET_RULES[p.species];
      const own = !b.foodKind || b.foodKind === p.species;
      const eff = own ? 1 : 0.6;
      const need = 100 - p.hunger;
      const got = Math.min(need, b.food * R.full * eff);
      if (got <= 0) return 0;
      p.hunger = clamp(p.hunger + got);
      b.food = Math.max(0, b.food - got / (R.full * eff));
      if (b.food < 0.02) b.food = 0;
      p.happy = clamp(p.happy + (own ? 3 : 1));
      return got;
    },
    // Lagret: djuret gör sitt i lådan/buren (itemId) eller på golvet (x, y).
    petToilet(petId, where = {}) {
      const p = S.petById(petId);
      if (!p) return null;
      const box = where.itemId ? S.itemById(where.itemId) : null;
      if (box && 'dirt' in box && box.dirt < 1) {
        S._boxUsed(p, box);
        box.dirt = clamp(box.dirt + (box.k === 'kaninbur' ? 0.1 : 0.15), 0, 1);
        p.toilet = 0; p.urge = false; p.urgeMin = 0;
        S.save();
        return { inBox: true };
      }
      const m = S._mess(p, where.x ?? p.x, where.y ?? p.y);
      return { mess: m };
    },
    _mess(p, x, y) {
      const kind = p.species === 'kanin' ? 'bajs' : p.lastMess === 'bajs' ? 'kiss' : 'bajs';
      p.lastMess = kind;
      const m = {
        id: 'm' + (S.nextId++), home: p.home, room: p.room,
        x: Math.round(isNum(x) ? x : 60 + S.rng() * 200), y: Math.round(isNum(y) ? y : 150 + S.rng() * 40), kind, by: p.species,
      };
      S.messes.push(m);
      if (S.messes.length > 40) S.messes.shift();
      p.toilet = 0; p.urge = false; p.urgeMin = 0;
      p.happy = clamp(p.happy - 4);
      S._lose(p, -CARE.inne, true); // tillväxt: bajs/kiss inne drar lite
      const what = kind === 'kiss' ? 'kissat' : 'bajsat';
      S._emit(kind, p.species === 'hund' ? `${p.name} har ${what} inne! Gå ut med hunden oftare.`
        : p.species === 'katt' ? `${p.name} har ${what} på golvet – kattlådan behövs (och ska vara ren).`
          : `${p.name} har lämnat kaninbajs på golvet – en kaninbur hjälper.`, { petId: p.id, home: p.home, messId: m.id });
      S.save();
      return m;
    },

    // ------------------------------------------------------------------
    //  Tid
    // ------------------------------------------------------------------
    setLive(home, room) { S.live = { home, room, abs: S.clockAbs ?? 0 }; },
    clearLive() { S.live = null; },
    isLive(p, abs = S.clockAbs) {
      const L = S.live;
      return !!L && !p.out && p.home === L.home && sameRoom(p.room, L.room) && (abs ?? 0) - L.abs <= 3;
    },
    syncTo(day, minOfDay, ctx = {}) {
      const abs = (Math.max(1, day | 0) - 1) * DAYMIN + (+minOfDay || 0);
      // spelklockan går aldrig bakåt – gör den det har spelaren börjat om (eller lagt tillbaka
      // en äldre spelsparfil): förra spelets djur ska inte dyka upp i den nya bostaden
      if (S.clockAbs != null && abs < S.clockAbs - RESTART_BACK_MIN) S._restart('nytt spel (klockan gick tillbaka)');
      if (S.clockAbs == null || abs < S.clockAbs - 1) { S.clockAbs = abs; S.day = Math.max(1, day | 0); S._clampBorn(S.day); S._restage(S.day); S._migrate(ctx.home); return 0; }
      const d = abs - S.clockAbs;
      if (d <= 0) { S._migrate(ctx.home); return 0; }
      S._advance(S.clockAbs, abs, ctx);
      return d;
    },
    tickMinutes(min, ctx = {}) {
      min = Math.max(0, Math.min(3 * DAYMIN, +min || 0));
      let to;
      if (isNum(ctx.day) && isNum(ctx.hour)) to = (ctx.day - 1) * DAYMIN + ctx.hour * 60;
      else to = (S.clockAbs ?? 7 * 60) + min;
      const from = to - min;
      S._advance(from, to, ctx);
    },
    // född "i framtiden" (fel klocka när djuret köptes) → räknas från i dag (spelets riktiga
    // dag), annars fastnar djuret som unge i veckor (minsta tiden räknas från stageDay)
    _clampBorn(day) {
      for (const p of S.pets) {
        if (!isNum(p.bornDay) || p.bornDay > day) p.bornDay = day;
        if (!isNum(p.stageDay)) p.stageDay = p.bornDay;
        if (p.stageDay > day) p.stageDay = day;
        if (isNum(p.homeDay) && p.homeDay > day) p.homeDay = day;
      }
    },
    // Klockan sattes direkt (ny butik, liten bakåthoppning) utan dagsskifte: djur vars
    // hemkomstdag ännu inte var känd (adopterade innan butiken visste vilken dag det var,
    // t.ex. med en födelsedag bakåt i tiden) får sitt stadium efter ålder direkt i stället för
    // nästa morgon – de växte upp hos uppfödaren. Andra djur växer bara av omsorg (_checkGrow).
    // Bara framåt – ett djur blir aldrig yngre.
    _restage(day) {
      for (const p of S.pets) {
        if (p.homeDay == null) S._settleHome(p, day);
        S._checkGrow(p, day);
      }
    },
    _advance(from, to, ctx) {
      S._migrate(ctx.home);
      S._clampBorn(dayOf(to));
      for (const p of S.pets) if (p.homeDay == null) S._settleHome(p, dayOf(to));
      if (to - from > 3 * DAYMIN) from = to - 3 * DAYMIN;
      let t = from;
      while (t < to - 1e-9) {
        const m = Math.min(10, to - t);
        t += m;
        S.clockAbs = t;
        S._step(m, dayOf(t), hourOf(t), ctx);
      }
      S.clockAbs = to;
      S._sinceSave += to - from;
      if (S._sinceSave >= 30) { S._sinceSave = 0; S.save(); }
    },
    // spelaren har flyttat: djur och prylar följer med (rum null = placeras om)
    _migrate(home) {
      if (!home) return;
      let moved = false;
      for (const p of S.pets) if (p.home !== home) { p.home = home; p.room = null; p.x = null; p.y = null; moved = true; }
      for (const it of S.items) if (it.home !== home) { it.home = home; it.room = null; moved = true; }
      if (S.messes.some((m) => m.home !== home)) { S.messes = S.messes.filter((m) => m.home === home); moved = true; }
      if (moved) S.save();
    },

    _step(m, day, hour, ctx) {
      const h = m / 60, night = isNightH(hour);
      if (day !== S.day) S._newDay(day);
      const homes = new Map();
      for (const p of S.pets) {
        if (!homes.has(p.home)) homes.set(p.home, S._homeInfo(p.home));
      }
      for (const p of S.pets) {
        const R = PET_RULES[p.species];
        const H = homes.get(p.home);
        const live = S.isLive(p);
        const young = p.stage === 'unge' ? 1.25 : p.stage === 'ung' ? 1.1 : 1;
        const slow = night && !p.out ? 0.5 : 1;
        // ---- behov
        p.hunger = clamp(p.hunger - R.hungerH * h * young * slow);
        p.toilet = clamp(p.toilet + R.toiletH * h * slow * (p.stage === 'unge' ? 1.15 : 1));
        // ---- promenad
        if (p.out) {
          p.outTot = (p.outTot || 0) + m;
          if (ctx.outdoors) p.outMin = (p.outMin || 0) + m;
          if (p.species === 'hund' && ctx.outdoors && !p.didBusiness && p.outMin >= 6 && p.toilet >= 5 && !ctx.followerHandlesBusiness) {
            S._business(p); p.didBusiness = true;
          }
          if (p.outTot >= OUT_MAX_MIN) S._comeHome(p, ctx.playerHome != null && ctx.playerHome === p.home); // glömd (jobb, sömn) → går hem/lägger sig självt
        }
        // ---- äta ur skål (lagret sköter djuren i rummet det visar)
        if (!p.out && p.hunger < R.eatBelow && (!live || p.hunger < 8)) {
          const b = S._findBowl(p, p.hunger < 25);
          if (b) {
            S._eat(p, b);
            if (!live && b.room != null && !sameRoom(p.room, b.room)) { p.room = b.room; p.x = null; p.y = null; }
            if (!live && b.room != null) { p.x = b.x + (S.rng() < 0.5 ? -7 : 7); p.y = b.y + 2; }
          } else if (p.hunger < 20 && !p._hungryWarned) {
            p._hungryWarned = true;
            S._emit('hungrig', `${p.name} är jättehungrig och skålen är tom!`, { petId: p.id, home: p.home });
          }
        }
        if (p.hunger > 40) p._hungryWarned = false;
        // vatten
        if (!p.out && H.water.length) {
          const w = H.water.find((b) => b.water > 0);
          if (w) w.water = Math.max(0, w.water - 0.03 * h * (p.species === 'hund' ? 1.4 : 1));
        }
        // ---- toalett
        if (!p.out) S._toiletStep(p, live, H, m);
        else if (p.toilet >= 100 && !ctx.outdoors && ctx.playerHome != null && ctx.playerHome === p.home) {
          // koppel på men kvar inne (hemma hos spelaren): hunden kan inte hålla sig för evigt
          if (ctx.playerRoom !== undefined) p.room = ctx.playerRoom;
          S._mess(p, isNum(p.x) ? p.x + (S.rng() - 0.5) * 6 : null, isNum(p.y) ? p.y + 1 : null);
        }
        // ---- glädje
        let dh = -1.5;
        if (p.hunger < 30) dh -= 4; else if (p.hunger > 70) dh += 0.5;
        if (p.out) dh += R.walkJoy;
        else if (ctx.playerHome != null && ctx.playerHome === p.home) {
          dh += 2 + (sameRoom(ctx.playerRoom, p.room) ? 1 : 0);
        } else {
          const buddies = H.pets.length - 1;
          dh -= buddies > 0 ? R.lonely * 0.3 : R.lonely;
        }
        if (!p.out) {
          if (p.species === 'katt' && H.litter.length && H.litter.every((b) => b.dirt >= 0.7)) dh -= 3;
          if (H.messes) dh -= 0.7 * Math.min(3, H.messes);
          if (p.species === 'hund' && p.toilet >= 80) dh -= 3;
          if (H.toys) dh += p.species === 'kanin' && !H.toyFor.kanin ? 0.2 : 0.8;
          if (p.species === 'katt' && H.klos) dh += 0.8;
          if (p.species === 'kanin') dh += H.bur.length ? (H.bur.some((b) => b.dirt >= 0.8) ? -1.5 : 1) : -1.5;
          if (H.beds.some((b) => PET_ITEMS[b.k].sangFor === p.species)) dh += 0.5;
          if (H.water.length && H.water.every((b) => b.water <= 0)) dh -= 1;
          if (p.lover && H.pets.some((q) => q.id === p.lover)) dh += 1;
          if (H.pets.length > 1) dh += 0.5;
        }
        p.happy = clamp(p.happy + dh * h);
        // ---- tillväxt av omsorg
        S._careStep(p, m, day, H, ctx);
      }
      S._loveStep(day);
    },
    _homeInfo(home) {
      const its = S.items.filter((i) => i.home === home);
      const has = (k) => its.some((i) => i.k === k);
      return {
        pets: S.pets.filter((p) => p.home === home && !p.out),
        litter: its.filter((i) => i.k === 'kattlada'),
        bur: its.filter((i) => i.k === 'kaninbur'),
        beds: its.filter((i) => PET_ITEMS[i.k]?.sangFor),
        water: its.filter((i) => i.k === 'vattenskal'),
        toys: its.some((i) => PET_ITEMS[i.k]?.typ === 'leksak'),
        klos: has('kattklostrad'),
        toyFor: Object.fromEntries(ARTER.map((a) => [a, TOYS_FOR[a].some(has)])),
        messes: S.messes.filter((m) => m.home === home).length,
      };
    },

    // ------------------------------------------------------------------
    //  Tillväxt av omsorg
    // ------------------------------------------------------------------
    // Dagens omsorgspoäng (nollas vid midnatt – väntande poäng som aldrig räknades in är då borta)
    _care(p, day = S.day) {
      if (!p.care || typeof p.care !== 'object' || p.care.day !== day) p.care = { day, mat: 0, lek: 0, leksak: 0, toa: 0, inne: 0, held: 0 };
      return p.care;
    },
    // Dagens krav: djuret har lekt (minst DAY_NEED.lek i dag) och har haft en leksak hemma i dag.
    _dayOk(c) { return !!c && (c.lek || 0) >= DAY_NEED.lek && (c.leksak || 0) > 0; },
    // Poäng av ett slag, högst CARE_CAP per dag. Poängen väntar (care.held) tills dagens krav är
    // uppfyllda – då räknas allt som väntat in i tillväxten på en gång, och resten av dagen direkt.
    // Returnerar det som räknades i dagens slag.
    _gain(p, kind, pts, day = S.day) {
      if (!(pts > 0) || (isNum(p.homeDay) && day < p.homeDay)) return 0;
      const c = S._care(p, day);
      const got = Math.min(pts, Math.max(0, CARE_CAP[kind] - (c[kind] || 0)));
      if (got <= 0) return 0;
      c[kind] = (c[kind] || 0) + got;
      c.held = (c.held || 0) + got;
      if (S._dayOk(c)) {
        p.grow = (isNum(p.grow) ? p.grow : GROW_AT[p.stage] || 0) + c.held;
        c.held = 0;
      }
      return got;
    },
    // Försummelse drar lite – men aldrig under stadiets golv (ett djur krymper aldrig).
    _lose(p, pts, inne = false, day = S.day) {
      if (isNum(p.homeDay) && day < p.homeDay) return;
      if (inne) S._care(p, day).inne += 1;
      const floor = GROW_AT[p.stage] || 0;
      p.grow = Math.max(floor, (isNum(p.grow) ? p.grow : floor) - Math.max(0, pts));
    },
    // Katten/kaninen använde lådan/buren: räknas bara om den var någorlunda ren (tömd).
    _boxUsed(p, box) {
      if ((box.dirt || 0) < (DIRTY[box.k] ?? 0.7)) S._gain(p, 'toa', CARE.ladaToa);
    },
    // Löpande (varje steg i simuleringen): mätt och glad → mat, leksak hemma → leksak, promenad →
    // lek; svält och ledsamhet drar lite. Sedan: dags att växa?
    _careStep(p, m, day, H, ctx) {
      if (isNum(p.homeDay) && day < p.homeDay) return; // klockan tickar ikapp tid före hemkomsten
      const h = m / 60, ok = p.happy >= 25;
      S._care(p, day);
      if (p.hunger >= 35 && ok) S._gain(p, 'mat', CARE.matH * h, day);
      if (!p.out && ok && H.toyFor?.[p.species]) S._gain(p, 'leksak', CARE.leksakH * h, day);
      if (p.out && ctx.outdoors) S._gain(p, 'lek', CARE.promenadMin * m, day);
      const loss = (p.hunger < 15 ? -CARE.svaltH * h : 0) + (!ok ? -CARE.ledsenH * h : 0);
      if (loss > 0) S._lose(p, loss, false, day);
      if (p.stage === 'vuxen' && p.grow > GROW_AT.vuxen) p.grow = GROW_AT.vuxen; // färdigväxt
      S._checkGrow(p, day);
    },
    // Växer ett steg när poängen räcker och djuret varit i stadiet minst GROW_MIN_DAYS dagar.
    _checkGrow(p, day = S.day) {
      const next = NEXT[p.stage];
      if (!next) return false;
      if (!isNum(p.grow) || p.grow < GROW_AT[next]) return false;
      const since = isNum(p.stageDay) ? p.stageDay : isNum(p.bornDay) ? p.bornDay : day;
      if (day - since < GROW_MIN_DAYS[p.stage]) return false;
      p.stage = next;
      p.stageDay = day;
      const hen = p.sex === 'hona' ? 'hon' : 'han';
      // told = toasten visad, seen = pratbubblan över djuret visad (lagret/promenaden sätter dem)
      S._emit('vaxte', `${p.name} har vuxit! Nu är ${hen} ${next === 'vuxen' ? 'vuxen' : 'ung'}.`,
        { petId: p.id, home: p.home, species: p.species, stage: next, seen: false, told: false });
      S.save();
      return true;
    },
    // Djurmenyns TILLVÄXT-rad: hur långt i stadiet, vad som saknas i dag och om tiden räcker.
    growth(p) {
      if (typeof p === 'string') p = S.petById(p);
      if (!p) return null;
      const stage = p.stage in RANK ? p.stage : 'unge', next = NEXT[stage];
      const grow = isNum(p.grow) ? p.grow : GROW_AT[stage];
      const c = p.care && p.care.day === S.day ? p.care : { mat: 0, lek: 0, leksak: 0, toa: 0, inne: 0, held: 0 };
      const dayOk = S._dayOk(c), held = dayOk ? 0 : Math.max(0, c.held || 0);
      const today = { mat: c.mat / CARE_CAP.mat, lek: c.lek / CARE_CAP.lek, leksak: c.leksak / CARE_CAP.leksak, toa: c.toa / CARE_CAP.toa, inne: c.inne | 0, held, ok: dayOk };
      if (!next) return { stage, next: null, pct: 1, held: 0, pctHeld: 0, grow, need: GROW_AT[stage], daysLeft: 0, ready: false, waiting: false, today, missing: [], text: 'Fullvuxen.' };
      const lo = GROW_AT[stage], need = GROW_AT[next];
      const pct = Math.max(0, Math.min(1, (grow - lo) / (need - lo)));
      const pctHeld = Math.max(0, Math.min(1 - pct, held / (need - lo)));
      const since = isNum(p.stageDay) ? p.stageDay : isNum(p.bornDay) ? p.bornDay : S.day;
      const daysLeft = Math.max(0, GROW_MIN_DAYS[stage] - (S.nowDay() - since));
      const ready = grow >= need;
      // vad som saknas (i dag): mat, lek, leksak hemma, toaletten
      const H = S._homeInfo(p.home), missing = [];
      const toy = H.toyFor[p.species];
      if (p.hunger < 35) missing.push('mat');
      if (p.happy < 25) missing.push('sällskap');
      if (c.lek < CARE_CAP.lek * 0.5) missing.push('lek');
      if (!toy) missing.push('leksak');
      if (p.species === 'hund') { if (c.toa < CARE_CAP.toa / 2 || c.inne > 0) missing.push('promenad'); }
      else if (p.species === 'katt') {
        if (!H.litter.length) missing.push('kattlåda');
        else if (H.litter.every((b) => b.dirt >= DIRTY.kattlada)) missing.push('tömd kattlåda');
      } else if (!H.bur.length) missing.push('en bur');
      else if (H.bur.every((b) => b.dirt >= DIRTY.kaninbur)) missing.push('ny halm i buren');
      // dagens krav inte uppfyllda: ingen lek än i dag, ingen leksak (eller för ledsen för att leka
      // med den). En leksak som nyss ställts fram hos ett glatt djur räknas inom tio minuter.
      const waiting = !dayOk && ((c.lek || 0) < DAY_NEED.lek || (!((c.leksak || 0) > 0) && !(toy && p.happy >= 25)));
      const word = next === 'vuxen' ? 'vuxen' : 'ung';
      let text;
      if (ready && daysLeft > 0) text = `Stor nog snart – blir ${word} om ${daysLeft === 1 ? '1 dag' : daysLeft + ' dagar'}.`;
      else if (ready) text = `Blir ${word} vilken stund som helst!`;
      else if (waiting) text = `Växer inte än i dag – behöver ${(missing.length ? missing : ['lek']).join(', ')}.`;
      else if (missing.length) text = `Växer: behöver ${missing.join(', ')}.`;
      else text = 'Växer så det knakar – allt är bra!';
      return { stage, next, pct, held, pctHeld, grow, need, daysLeft, ready, waiting, today, missing, text };
    },
    // Tillväxthändelser vars pratbubbla ingen har visat än (spelaren var inte i rummet när det hände)
    growthNews(home = null) {
      return S.log.filter((e) => e.type === 'vaxte' && e.seen === false && (home == null || e.home == null || e.home === home));
    },
    // Visad: toasten (ev.told) och/eller pratbubblan över djuret (ev.seen). Sparas direkt – annars
    // kommer den igen om fliken stängs före nästa autosparning.
    seenNews(ev, { toast = true, bubble = true } = {}) {
      if (!ev) return;
      let changed = false;
      if (toast && ev.told !== true) { ev.told = true; changed = true; }
      if (bubble && ev.seen === false) { ev.seen = true; changed = true; }
      if (changed) S.save();
    },
    _findBowl(p, desperate) {
      const bowls = S.items.filter((i) => i.home === p.home && i.k === 'matskal' && i.food > 0.01);
      const own = bowls.filter((b) => !b.foodKind || b.foodKind === p.species);
      const pick = (list) => list.sort((a, b) => (sameRoom(b.room, p.room) - sameRoom(a.room, p.room)) || b.food - a.food)[0] || null;
      return pick(own) || (desperate ? pick(bowls) : null);
    },
    _toiletStep(p, live, H, m = 0) {
      if (p.toilet < 100) { if (p.urgeMin) p.urgeMin = 0; return; }
      // i rummet som visas leder lagret djuret till lådan (urge) – hinner det inte på
      // URGE_GRACE_MIN speldminuter tar simuleringen över
      if (live) { p.urge = true; p.urgeMin = (p.urgeMin || 0) + m; if (p.urgeMin < URGE_GRACE_MIN) return; }
      if (p.species === 'katt') {
        const box = H.litter.filter((b) => b.dirt < 1).sort((a, b) => (sameRoom(b.room, p.room) - sameRoom(a.room, p.room)) || a.dirt - b.dirt)[0];
        if (box) {
          S._boxUsed(p, box);
          box.dirt = clamp(box.dirt + 0.15, 0, 1);
          p.toilet = 0; p.urge = false; p.urgeMin = 0;
          if (box.dirt >= 0.99) S._emit('lada', `Kattlådan är full – ${p.name} vill ha den tömd!`, { petId: p.id, home: p.home, itemId: box.id });
          return;
        }
      } else if (p.species === 'kanin') {
        const cage = H.bur.find((b) => b.dirt < 1);
        if (cage) { S._boxUsed(p, cage); cage.dirt = clamp(cage.dirt + 0.1, 0, 1); p.toilet = 0; p.urge = false; p.urgeMin = 0; return; }
      }
      // på golvet – nära där djuret är (eller på en slumpad plats om det inte syns)
      const x = isNum(p.x) ? p.x + (S.rng() - 0.5) * 6 : null, y = isNum(p.y) ? p.y + 1 : null;
      S._mess(p, x, y);
    },
    _newDay(day) {
      S.day = day;
      // en ny dag: den minsta tiden i stadiet kan just ha gått – växer den som samlat nog
      for (const p of S.pets) S._checkGrow(p, day);
      // förlossningar
      for (const mom of [...S.pets]) {
        if (mom.pregnantUntil == null || day < mom.pregnantUntil) continue;
        mom.pregnantUntil = null;
        mom.nextLitterDay = day + 6;
        const dad = S.petById(mom.lover);
        const room = MAX_PETS - S.pets.length;
        const n = Math.min(room, 1 + Math.floor(S.rng() * 3));
        const kids = [];
        for (let i = 0; i < n; i++) {
          const sex = S.rng() < 0.5 ? 'hane' : 'hona';
          const breedA = mom.breed, breedB = dad ? dad.breed : mom.breed;
          const breed = S.rng() < 0.5 ? breedA : breedB;
          const kid = S._newPet({
            species: mom.species, breed, sex, name: S._freeName(mom.species, sex), bornDay: day,
            home: mom.home, room: mom.room,
            x: isNum(mom.x) ? mom.x + (i - (n - 1) / 2) * 8 : null, y: isNum(mom.y) ? mom.y + 4 : null,
            hunger: 80, happy: 85, toilet: 0, mix: breedA !== breedB ? [breedA, breedB] : null,
            breed2: breedA !== breedB ? (breed === breedA ? breedB : breedA) : null, // pälsen från den andra föräldern
          });
          kid.parents = [mom.id, dad ? dad.id : null];
          S.pets.push(kid);
          kids.push(kid);
        }
        if (kids.length) {
          const word = { katt: ['kattunge', 'kattungar'], hund: ['valp', 'valpar'], kanin: ['kaninunge', 'kaninungar'] }[mom.species];
          S._emit('ungar', `${mom.name}${dad ? ' och ' + dad.name : ''} har fått ${kids.length === 1 ? 'en ' + word[0] : kids.length + ' ' + word[1]}: ${kids.map((k) => k.name).join(', ')}!`,
            { petId: mom.id, home: mom.home, kids: kids.map((k) => k.id) });
        }
      }
      S.save();
    },
    _loveStep(day) {
      if (S.pets.length >= MAX_PETS) return;
      const ok = (p) => p.stage === 'vuxen' && !p.out && p.happy > 70 && p.hunger > 60;
      for (const a of S.pets) {
        if (a.sex !== 'hona' || !ok(a) || a.pregnantUntil != null) continue;
        if (a.nextLitterDay != null && day < a.nextLitterDay) continue;
        let b = a.lover ? S.petById(a.lover) : null;
        if (b && (b.home !== a.home || b.species !== a.species)) { a.lover = null; b = null; }
        if (!b) {
          b = S.pets.find((q) => q.sex === 'hane' && q.species === a.species && q.home === a.home && ok(q) && (!q.lover || !S.petById(q.lover)));
          if (!b) continue;
          a.lover = b.id; b.lover = a.id;
          S._emit('kar', `${a.name} och ${b.name} har blivit kära! ❤`, { petId: a.id, home: a.home });
        } else if (!ok(b)) continue;
        a.pregnantUntil = day + 2;
        S.save();
        return;
      }
    },

    // ------------------------------------------------------------------
    //  Spara / ladda / sammanfatta
    // ------------------------------------------------------------------
    toJSON() {
      const clean = (p) => { const { _hungryWarned, urge, urgeMin, ...rest } = p; return rest; };
      return { v: 1, pets: S.pets.map(clean), items: S.items, inventory: S.inventory, messes: S.messes, opened: S.opened,
        gifts: S.gifts, log: S.log.slice(0, 20), nextId: S.nextId, clockAbs: S.clockAbs, day: S.day };
    },
    save() {
      if (!S.storage) return false;
      try { S.storage.setItem(S.key, JSON.stringify(S.toJSON())); return true; } catch { return false; }
    },
    load(data) {
      let p = data;
      if (!p && S.storage) { try { p = JSON.parse(S.storage.getItem(S.key) || 'null'); } catch { p = null; } }
      if (typeof p === 'string') { try { p = JSON.parse(p); } catch { p = null; } }
      S.pets = []; S.items = []; S.inventory = {}; S.messes = []; S.opened = {}; S.gifts = {}; S.log = []; S.nextId = 1; S.clockAbs = null; S.day = 1;
      if (!p || p.v !== 1) return S;
      const num = (v, d = 0) => (isNum(+v) && v !== null && v !== '' ? +v : d);
      const savedDay = Math.max(1, num(p.day, 1) | 0);
      S.pets = (Array.isArray(p.pets) ? p.pets : []).filter((q) => q && ARTER.includes(q.species)).slice(0, MAX_PETS).map((q) => {
        const bornDay = Math.min(savedDay, num(q.bornDay, 1));
        const stage = ['unge', 'ung', 'vuxen'].includes(q.stage) ? q.stage : 'unge';
        return {
          ...q,
          id: String(q.id), name: cleanName(q.name) || 'Tuss', breed: String(q.breed || ''), sex: q.sex === 'hona' ? 'hona' : 'hane',
          bornDay, stage,
          hunger: clamp(num(q.hunger, 70)), happy: clamp(num(q.happy, 70)), toilet: clamp(num(q.toilet, 0)),
          x: isNum(q.x) ? q.x : null, y: isNum(q.y) ? q.y : null, following: !!q.following, out: !!q.out,
          lover: q.lover ? String(q.lover) : null, pregnantUntil: isNum(q.pregnantUntil) ? q.pregnantUntil : null,
          // Tillväxt av omsorg (nya fält – gamla sparfiler får dem här). Ett djur behåller alltid sitt
          // stadium och får startpoäng som motsvarar det; minsta tiden räknas från när det (med de
          // gamla åldersreglerna) nådde stadiet. homeDay = födelsedagen: inget växer längre av ålder.
          grow: Math.max(GROW_AT[stage], isNum(q.grow) ? q.grow : 0),
          stageDay: Math.min(savedDay, isNum(q.stageDay) ? q.stageDay : stage === 'unge' ? bornDay : bornDay + STAGE_DAYS[stage]),
          homeDay: isNum(q.homeDay) ? Math.min(savedDay, q.homeDay) : q.homeDay === null ? null : bornDay,
          care: q.care && typeof q.care === 'object' && isNum(q.care.day)
            ? { day: q.care.day, mat: num(q.care.mat), lek: num(q.care.lek), leksak: num(q.care.leksak), toa: num(q.care.toa), inne: num(q.care.inne) | 0, held: num(q.care.held) }
            : null,
        };
      });
      S.items = (Array.isArray(p.items) ? p.items : []).filter((i) => i && PET_ITEMS[i.k]).slice(0, 80).map((i) => {
        const it = { ...i, id: String(i.id), x: num(i.x), y: num(i.y) };
        if ('food' in it) it.food = clamp(num(it.food), 0, 1);
        if ('water' in it) it.water = clamp(num(it.water), 0, 1);
        if ('dirt' in it) it.dirt = clamp(num(it.dirt), 0, 1);
        if ('left' in it) it.left = Math.max(0, num(it.left) | 0);
        return it;
      });
      for (const [k, n] of Object.entries(p.inventory || {})) if (PET_ITEMS[k] && n > 0) S.inventory[k] = Math.min(99, n | 0);
      for (const [k, n] of Object.entries(p.opened || {})) if (PET_ITEMS[k] && n > 0) S.opened[k] = n | 0;
      S.messes = (Array.isArray(p.messes) ? p.messes : []).filter((m) => m && (m.kind === 'bajs' || m.kind === 'kiss')).slice(-40)
        .map((m) => ({ ...m, id: String(m.id), x: num(m.x), y: num(m.y) }));
      S.gifts = p.gifts && typeof p.gifts === 'object' ? { ...p.gifts } : {};
      S.log = Array.isArray(p.log) ? p.log.slice(0, 20) : [];
      S.nextId = Math.max(1, num(p.nextId, 1) | 0);
      S.clockAbs = isNum(p.clockAbs) ? p.clockAbs : null;
      S.day = savedDay;
      // säkerställ att nextId aldrig krockar
      const maxId = Math.max(0, ...[...S.pets, ...S.items, ...S.messes].map((o) => parseInt(String(o.id).slice(1), 10) || 0));
      if (S.nextId <= maxId) S.nextId = maxId + 1;
      return S;
    },
    summary() {
      const lines = [], hungry = [], needWalk = [], sad = [];
      for (const p of S.pets) {
        if (p.hunger < 35) hungry.push(p.name);
        if (p.species === 'hund' && p.toilet >= 70) needWalk.push(p.name);
        if (p.happy < 30) sad.push(p.name);
      }
      const count = S.pets.length;
      const by = {};
      for (const p of S.pets) by[p.species] = (by[p.species] || 0) + 1;
      const dirtyLitter = S.items.some((i) => i.k === 'kattlada' && i.dirt >= 0.7);
      const dirtyCage = S.items.some((i) => i.k === 'kaninbur' && i.dirt >= 0.7);
      const emptyBowls = S.items.filter((i) => i.k === 'matskal' && !(i.food > 0.02)).length;
      if (!count) lines.push('Inga husdjur än – djuraffären finns i staden.');
      else {
        const words = { katt: ['katt', 'katter'], hund: ['hund', 'hundar'], kanin: ['kanin', 'kaniner'] };
        lines.push(Object.entries(by).map(([a, n]) => `${n} ${n === 1 ? words[a][0] : words[a][1]}`).join(', '));
      }
      if (hungry.length) lines.push(`Hungriga: ${hungry.join(', ')}`);
      if (needWalk.length) lines.push(`Behöver gå ut: ${needWalk.join(', ')}`);
      if (sad.length) lines.push(`Ledsna: ${sad.join(', ')}`);
      if (dirtyLitter) lines.push('Kattlådan behöver tömmas.');
      if (dirtyCage) lines.push('Kaninburen behöver ny halm.');
      if (S.messes.length) lines.push(`${S.messes.length} ${S.messes.length === 1 ? 'olycka' : 'olyckor'} på golvet att städa.`);
      if (count && emptyBowls) lines.push(`${emptyBowls} ${emptyBowls === 1 ? 'tom matskål' : 'tomma matskålar'}.`);
      return { count, bySpecies: by, lines, hungry, needWalk, sad, messes: S.messes.length, dirtyLitter, dirtyCage, emptyBowls,
        pregnant: S.pets.filter((p) => p.pregnantUntil != null).map((p) => p.name) };
    },
  };
  return S;

  // Misslyckanden är falska (false) – skälet står i S.lastError (text) och S.lastReason (kod).
  function fail(reason, msg) { S.lastError = msg; S.lastReason = reason; return false; }
}

// Returnerat djur: vanligt objekt, men "res.ok" fungerar också för den som väntar sig { ok }.
function withOk(p) {
  Object.defineProperty(p, 'ok', { value: true, enumerable: false, configurable: true });
  Object.defineProperty(p, 'pet', { value: p, enumerable: false, configurable: true });
  return p;
}
const cleanName = (s) => String(s ?? '').replace(/[<>&"]/g, '').replace(/\s+/g, ' ').trim().slice(0, 16);

let _store = null;
export function petStore() {
  if (!_store) {
    let storage = null;
    try { storage = typeof localStorage !== 'undefined' ? localStorage : null; } catch { storage = null; }
    _store = createPetStore({ storage });
    _store.load();
    // Nytt spel? Spelet räknar sig som nytt när dess sparfil saknas (main.js: firstRun) – då
    // ska inte förra spelets djur och prylar följa med in i den nya bostaden.
    let gameSave = null;
    try { gameSave = storage ? storage.getItem(GAME_SAVE_KEY) : null; } catch { gameSave = null; }
    if (storage && !gameSave && _store._restart('nytt spel (ingen spelsparfil)')) console.info('Husdjuren från förra spelet lades undan.');
  }
  return _store;
}
