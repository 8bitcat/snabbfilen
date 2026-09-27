// Speltillståndet för Snabbfilen: klockan, behoven, pengarna, kylskåpet, jobben
// och bostaden. Ingen rendering här – scenerna läser och kommandona ändrar.
import { toast } from './core/ui.js';
import { play } from './core/sound.js';

export const SAVE_KEY = 'snabbfilen_save1';
export const DAY_NAMES = ['Måndag', 'Tisdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lördag', 'Söndag'];
export const fmt = (n) => Math.round(n).toLocaleString('sv-SE') + ' kr';
export const clock = (min) => `${String(Math.floor(min / 60) % 24).padStart(2, '0')}:${String(Math.floor(min % 60)).padStart(2, '0')}`;

// Maten i matbutiken. fill = mätthet. Billig mat mättar lite – som i Jones.
export const FOOD = [
  { id: 'nudlar', icon: '🍜', name: 'Snabbnudlar', price: 12, fill: 18 },
  { id: 'macka', icon: '🥪', name: 'Ostmacka', price: 22, fill: 30 },
  { id: 'korv', icon: '🌭', name: 'Korv med bröd', price: 35, fill: 42 },
  { id: 'pizza', icon: '🍕', name: 'Pizza', price: 65, fill: 65 },
  { id: 'lyx', icon: '🍱', name: 'Lyxlåda', price: 120, fill: 95 },
];
export const foodOf = (id) => FOOD.find((f) => f.id === id);

// Jobben. wage = kr per rätt, oops = avdrag per fel, bonus = kr per färdig låda (packjobb).
export const JOBS = {
  flygplats: { id: 'flygplats', icon: '✈️', name: 'Flygplatsen', verb: 'Bär väskorna till rätt vagn', wage: 7, oops: 4 },
  frukt: { id: 'frukt', icon: '🍊', name: 'Fruktfabriken', verb: 'Plocka frukt från bandet till lådan', wage: 4, oops: 3, bonus: 20 },
  burgare: { id: 'burgare', icon: '🍔', name: 'Burgarbaren', verb: 'Servera rätt mat till rätt kund', wage: 10, oops: 5 },
};
export const JOB_TITLES = ['Nybörjare', 'Van', 'Proffs', 'Mästare', 'Legendar'];
export const levelOf = (shifts) => Math.min(5, 1 + Math.floor(shifts / 3));
export const payMult = (level) => 1 + 0.15 * (level - 1);

// Klädaffärens sortiment: plagg och accessoarer som låses upp i garderoben när
// man köpt dem. kind/v matchar look-fälten i people.js. Gratis från start är
// bara basgrejerna (t-shirt, randig tröja, jeans, byxor) – resten jobbar man
// ihop till, från kepsen för 90 kr hela vägen upp till kronan.
export const SORTIMENT = [
  { kind: 'hat', v: 'cap', icon: '🧢', name: 'Keps', price: 90 },
  { kind: 'top', v: 'vest', icon: '🎽', name: 'Linne', price: 100 },
  { kind: 'hat', v: 'bucket', icon: '👒', name: 'Fiskehatt', price: 130 },
  { kind: 'bottom', v: 'shorts', icon: '🩳', name: 'Shorts', price: 120 },
  { kind: 'hat', v: 'headband', icon: '🎽', name: 'Hårband', price: 120 },
  { kind: 'glasses', v: 'round', icon: '👓', name: 'Runda glasögon', price: 150 },
  { kind: 'glasses', v: 'square', icon: '👓', name: 'Fyrkantiga glasögon', price: 150 },
  { kind: 'hat', v: 'beanie', icon: '🧣', name: 'Mössa', price: 150 },
  { kind: 'hat', v: 'bow', icon: '🎀', name: 'Rosett', price: 180 },
  { kind: 'bottom', v: 'skirt', icon: '👗', name: 'Kjol', price: 200 },
  { kind: 'glasses', v: 'sun', icon: '🕶️', name: 'Solglasögon', price: 220 },
  { kind: 'top', v: 'hoodie', icon: '🧥', name: 'Huvtröja', price: 250 },
  { kind: 'top', v: 'hawaii', icon: '🌺', name: 'Hawaiiskjorta', price: 280 },
  { kind: 'top', v: 'sweater', icon: '🧶', name: 'Stickad tröja', price: 300 },
  { kind: 'bag', v: 'backpack', icon: '🎒', name: 'Ryggsäck', price: 350 },
  { kind: 'bottom', v: 'dress', icon: '👗', name: 'Klänning', price: 380 },
  { kind: 'top', v: 'shirt', icon: '👔', name: 'Skjorta', price: 400 },
  { kind: 'bag', v: 'shoulder', icon: '👜', name: 'Axelväska', price: 420 },
  { kind: 'top', v: 'jacket', icon: '🧥', name: 'Jacka', price: 450 },
  { kind: 'phones', v: true, icon: '🎧', name: 'Hörlurar', price: 500 },
  { kind: 'top', v: 'suit', icon: '🤵', name: 'Kavaj med slips', price: 1500 },
  { kind: 'hat', v: 'tophat', icon: '🎩', name: 'Hög hatt', price: 1800 },
  { kind: 'hat', v: 'crown', icon: '👑', name: 'Krona', price: 2500 },
];
export const clothesKey = (kind, v) => `${kind}:${v}`;

// Möbelkatalogen (köps i Möbelhörnan, hamnar i förrådet och placeras hemma
// med Möblera-läget). vars = antal färg-/modellvarianter i spriteatlasen.
export const KATALOG = [
  { kind: 'stol', icon: '🪑', name: 'Stol', price: 150, vars: 4 },
  { kind: 'bordR', icon: '🟤', name: 'Runt bord', price: 250, vars: 4 },
  { kind: 'matta', icon: '🟥', name: 'Matta', price: 250, vars: 2 },
  { kind: 'lampa', icon: '💡', name: 'Lampa', price: 300, vars: 2 },
  { kind: 'spegel', icon: '🪞', name: 'Spegel', price: 350, vars: 3 },
  { kind: 'vaxtS', icon: '🪴', name: 'Krukväxt', price: 350, vars: 1 },
  { kind: 'fatolj', icon: '🛋️', name: 'Fåtölj', price: 450, vars: 4 },
  { kind: 'byra', icon: '🗄️', name: 'Byrå', price: 500, vars: 4 },
  { kind: 'bokhylla', icon: '📚', name: 'Bokhylla', price: 600, vars: 3 },
  { kind: 'bordM', icon: '🍽️', name: 'Matbord', price: 600, vars: 4 },
  { kind: 'soffa', icon: '🛋️', name: 'Soffa', price: 800, vars: 6 },
  { kind: 'tv', icon: '🖥️', name: 'TV / dator', price: 1200, vars: 2 },
  { kind: 'spis', icon: '🔥', name: 'Öppen spis', price: 1500, vars: 3 },
];
export const katalogOf = (kind) => KATALOG.find((k) => k.kind === kind);
// Möbelns egen färg: bara giltig '#rrggbb' (gemener) räknas, annars null = originalfärgen.
export const cleanHex = (c) => (typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c) ? c.toLowerCase() : null);
const withColor = (o, c) => { const h = cleanHex(c); if (h) o.c = h; else delete o.c; return o; };
// gamla sparfiler köpte möbler per id – mappa till katalog-poster
const OLD_FURN = { matta: 'matta', lampa: 'lampa', vaxt: 'vaxtS', bokhylla: 'bokhylla', soffa: 'soffa', tv: 'tv', spis: 'spis' };

// Slutmålet: äg Villan med rejält på fickan.
export const WIN_MONEY = 10000;

// Dagshändelser: slumpas fram på morgonen och gäller hela dagen. Hälften av
// dagarna händer inget alls – då känns händelserna som något speciellt.
export const EVENTS = [
  { id: 'rea', icon: '🏷️', text: 'REA i klädaffären – 25 % på allt i dag!' },
  { id: 'dubbel', icon: '💰', text: 'Extrapass på {job} – dubbel lön i dag!' },
  { id: 'middag', icon: '🍲', text: 'Grannen bjöd på middag i går kväll – mätt och glad!' },
  { id: 'tjuga', icon: '💵', text: 'Du hittade 20 kr på trottoaren!' },
  { id: 'regn', icon: '🌧️', text: 'Ösregn i Pixelstaden – allt tar längre tid ute i dag.' },
];

// Bostäderna: större bostad = insats + högre hyra men bättre sömn.
export const HOMES = [
  { id: 'rum', icon: '🛏️', name: 'Lilla rummet', deposit: 0, rent: 350, restBonus: 0, desc: 'En säng, ett kylskåp och en garderob. Men det är ditt.' },
  { id: 'lagenhet', icon: '🏢', name: 'Lägenheten', deposit: 1500, rent: 600, restBonus: 10, desc: 'Riktigt kök, soffa och utsikt över Pixelstaden.' },
  { id: 'villa', icon: '🏡', name: 'Villan', deposit: 8000, rent: 1000, restBonus: 20, desc: 'Eget hus med trädgård. Hit kan kompisarna komma.' },
];
export const homeOf = (id) => HOMES.find((h) => h.id === id) || HOMES[0];

const DAY = 24 * 60;
export const REALTIME_RATE = 2;
const HUNGER_PER_MIN = 0.05; // 3 mätthet per timme

export class Game {
  constructor() {
    this.day = 1;
    this.min = 7 * 60 + 30;
    this.money = 250;
    this.hunger = 70;
    this.energy = 90;
    this.home = 'rum';
    this.fridge = { nudlar: 1 };          // itemId -> antal
    this.jobs = { flygplats: 0, frukt: 0, burgare: 0 }; // antal jobbade pass
    this.earned = 0;                      // totalt intjänat
    this.wardrobe = [];                   // upplåsta plagg, "kind:v"
    this.storage = [];                    // köpta möbler i förrådet, { k, v, c? } (c = egen färg '#rrggbb')
    this.deco = {};                       // placerade möbler per rum: "hem:sub" -> [{ k, v, c?, x, y, fx? }]
    this.won = false;                     // slutmålet nått
    this.event = null;                    // dagens händelse { id, job? }
    this.best = { flygplats: { ok: 0, pay: 0 }, frukt: { ok: 0, pay: 0 }, burgare: { ok: 0, pay: 0 } }; // rekord
    this.collapsed = false;               // somnade utmattad i natt (sätts av passTime)
  }

  eventIs(id) { return this.event?.id === id; }

  get dayName() { return DAY_NAMES[(this.day - 1) % 7]; }
  get homeInfo() { return homeOf(this.home); }

  // ---------- spara/ladda ----------
  save() {
    try { const { _saveIn, collapsed, ...data } = this; localStorage.setItem(SAVE_KEY, JSON.stringify({ v: 1, ...data })); } catch { /* full/blockerad */ }
  }
  static load() {
    const g = new Game();
    try {
      const p = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
      if (p && p.v === 1) {
        g.day = Math.max(1, p.day | 0); g.min = Math.min(DAY - 1, Math.max(0, +p.min || 0));
        g.money = Math.round(+p.money || 0); g.hunger = clamp(p.hunger); g.energy = clamp(p.energy);
        g.home = homeOf(p.home).id;
        g.fridge = {}; for (const [k, v] of Object.entries(p.fridge || {})) if (foodOf(k) && v > 0) g.fridge[k] = Math.min(20, v | 0);
        for (const k of Object.keys(g.jobs)) g.jobs[k] = Math.max(0, p.jobs?.[k] | 0);
        g.earned = Math.max(0, +p.earned || 0);
        g.wardrobe = (Array.isArray(p.wardrobe) ? p.wardrobe : []).filter((k) => SORTIMENT.some((s) => clothesKey(s.kind, s.v) === k));
        const cleanItem = (it) => it && katalogOf(it.k) ? withColor({ k: it.k, v: Math.max(0, Math.min(katalogOf(it.k).vars - 1, it.v | 0)) }, it.c) : null;
        g.storage = (Array.isArray(p.storage) ? p.storage : []).map(cleanItem).filter(Boolean).slice(0, 60);
        if (p.deco && typeof p.deco === 'object') for (const [key, list] of Object.entries(p.deco)) {
          if (!/^[a-z]+:\d$/.test(key) || !Array.isArray(list)) continue;
          g.deco[key] = list.filter((d) => d && (katalogOf(d.k) || ['sang', 'garderob', 'kylskap', 'vaxt'].includes(d.k)))
            .map((d) => withColor({ k: d.k, v: Math.max(0, d.v | 0), x: Math.max(0, Math.min(384, +d.x || 0)), y: Math.max(0, Math.min(216, +d.y || 0)), ...(d.fx ? { fx: 1 } : {}) }, d.c))
            .slice(0, 40);
        }
        // gamla sparfiler: köpta möbler (id-lista) flyttas till förrådet
        if (Array.isArray(p.furniture)) for (const id of p.furniture) if (OLD_FURN[id]) g.storage.push({ k: OLD_FURN[id], v: 0 });
        g.won = !!p.won;
        if (p.event && EVENTS.some((e) => e.id === p.event.id)) g.event = { id: p.event.id, job: JOBS[p.event.job] ? p.event.job : undefined };
        for (const k of Object.keys(g.best)) g.best[k] = { ok: Math.max(0, p.best?.[k]?.ok | 0), pay: Math.max(0, p.best?.[k]?.pay | 0) };
      }
    } catch { /* trasig – börja om */ }
    return g;
  }

  // ---------- tid ----------
  // Låter klockan gå. Mättheten sjunker med tiden; tom mage tär på orken i stället.
  passTime(minutes) {
    this.min += minutes;
    const eaten = Math.min(this.hunger, minutes * HUNGER_PER_MIN);
    this.hunger -= eaten;
    if (this.hunger <= 0) this.energy = Math.max(0, this.energy - (minutes * HUNGER_PER_MIN - eaten) * 0.6);
    if (this.min >= DAY) { // förbi midnatt: du somnar där du står
      this.min = DAY - 1;
      this.sleep(0.55);
      this.collapsed = true;
    }
  }

  // Sova till 07:00. quality < 1 = dålig sömn (t.ex. somnade på gatan).
  // Hungrig sömn ger sämre vila, större bostad ger bonus. Morgonen kan bjuda
  // på en dagshändelse – hälften av dagarna händer inget alls.
  sleep(quality = 1) {
    this.day += 1;
    this.min = 7 * 60;
    const rested = (55 + 45 * Math.min(1, this.hunger / 50)) * quality + this.homeInfo.restBonus;
    this.energy = clamp(Math.max(this.energy, Math.round(rested)));
    this.hunger = clamp(this.hunger - 15);
    let rent = 0;
    if ((this.day - 1) % 7 === 0 && this.day > 1) { // måndag morgon: hyra
      rent = this.homeInfo.rent;
      this.money -= rent;
    }
    // dagens händelse
    this.event = null;
    let eventText = null;
    if (Math.random() < 0.5) {
      const ev = EVENTS[(Math.random() * EVENTS.length) | 0];
      this.event = { id: ev.id };
      if (ev.id === 'dubbel') {
        const jobs = Object.keys(JOBS);
        this.event.job = jobs[(Math.random() * jobs.length) | 0];
      }
      if (ev.id === 'middag') this.hunger = clamp(this.hunger + 35);
      if (ev.id === 'tjuga') this.money += 20;
      eventText = `${ev.icon} ${ev.text.replace('{job}', JOBS[this.event.job]?.name || '')}`;
    }
    this.save();
    return { rent, eventText };
  }

  // ---------- mat ----------
  buyFood(id, { eatNow = false } = {}) {
    const f = foodOf(id);
    const price = f.price + (eatNow ? 5 : 0);
    if (this.money < price) return { ok: false, msg: 'Du har inte råd!' };
    this.money -= price;
    if (eatNow) this.hunger = clamp(this.hunger + f.fill);
    else this.fridge[id] = (this.fridge[id] || 0) + 1;
    this.save();
    return { ok: true };
  }
  eatFromFridge(id) {
    if (!(this.fridge[id] > 0)) return false;
    this.fridge[id] -= 1;
    if (!this.fridge[id]) delete this.fridge[id];
    this.hunger = clamp(this.hunger + foodOf(id).fill);
    this.passTime(15);
    this.save();
    return true;
  }

  // ---------- jobb ----------
  canWork() {
    if (this.energy < 20) return { ok: false, msg: 'Du är för trött för att jobba – gå hem och sov.' };
    if (this.min > 20 * 60) return { ok: false, msg: 'För sent att börja ett pass – jobben öppnar 07:00 igen.' };
    if (this.min < 7 * 60) return { ok: false, msg: 'Jobbet öppnar 07:00.', waitTo: 7 * 60 };
    return { ok: true };
  }
  // Snabbspola fram till en klockslag samma dag (t.ex. när en butik öppnar).
  waitUntil(targetMin) {
    if (targetMin > this.min) this.passTime(targetMin - this.min);
    this.save();
  }
  // Klockan går av sig själv medan man är ute och hemma: REALTIME_RATE
  // spelminuter per verklig sekund (ett helt dygn 07–24 ≈ 8½ minut).
  tickReal(dt) {
    this.passTime(dt * REALTIME_RATE);
    this._saveIn = (this._saveIn ?? 10) - dt;
    if (this._saveIn <= 0) { this._saveIn = 10; this.save(); }
  }
  // Ett pass = 4 timmar speltid. Lönen räknas ut av minispelet; yr av hunger =
  // halv lön, extrapass-dagar = dubbel lön. Rekord (flest rätt, bästa lön) sparas.
  endShift(jobId, pay, stats = {}) {
    const starving = this.hunger <= 0;
    const doubled = this.eventIs('dubbel') && this.event.job === jobId;
    let finalPay = Math.max(0, Math.round(starving ? pay / 2 : pay));
    if (doubled) finalPay *= 2;
    const before = levelOf(this.jobs[jobId]);
    this.jobs[jobId] += 1;
    this.money += finalPay;
    this.earned += finalPay;
    this.energy = clamp(this.energy - 35);
    this.passTime(4 * 60);
    const b = this.best[jobId];
    const newRecord = (stats.ok || 0) > b.ok;
    b.ok = Math.max(b.ok, stats.ok || 0);
    b.pay = Math.max(b.pay, finalPay);
    this.save();
    const after = levelOf(this.jobs[jobId]);
    if (after > before) { play('fanfare'); toast(`⭐ Befordran på ${JOBS[jobId].name}! Du är nu ${JOB_TITLES[after - 1]}.`, 'good'); }
    return { finalPay, starving, doubled, newRecord, promoted: after > before };
  }

  // ---------- kläder & möbler ----------
  // Låst = finns i sortimentet men är inte köpt. Allt annat är gratis från start.
  clothesLocked(kind, v) {
    const s = SORTIMENT.find((s) => s.kind === kind && s.v === v);
    return s && !this.wardrobe.includes(clothesKey(kind, v)) ? s : null;
  }
  // REA-dagar ger 25 % rabatt i klädaffären.
  clothesPrice(s) { return Math.round(s.price * (this.eventIs('rea') ? 0.75 : 1)); }
  buyClothes(kind, v) {
    const s = this.clothesLocked(kind, v);
    if (!s) return { ok: false, msg: 'Den har du redan!' };
    const price = this.clothesPrice(s);
    if (this.money < price) return { ok: false, msg: 'Du har inte råd – dags att jobba ett pass!' };
    this.money -= price;
    this.wardrobe.push(clothesKey(kind, v));
    this.save();
    return { ok: true, item: s, price };
  }
  // Köp en möbel (variant v, egen färg c = '#rrggbb' eller null) till förrådet –
  // placeras hemma med Möblera-läget.
  buyFurniture(kind, v = 0, c = null) {
    const f = katalogOf(kind);
    if (!f) return { ok: false, msg: 'Finns inte i katalogen.' };
    if (this.money < f.price) return { ok: false, msg: 'Du har inte råd!' };
    if (this.storage.length >= 40) return { ok: false, msg: 'Förrådet är fullt – möblera hemma först!' };
    this.money -= f.price;
    this.storage.push(withColor({ k: kind, v: Math.max(0, Math.min(f.vars - 1, v | 0)) }, c));
    this.save();
    return { ok: true, item: f };
  }
  // ---------- möblering (rummet sköter kollision, det här är bara bokföring) ----------
  decoKey(sub) { return `${this.home}:${sub | 0}`; }
  decoRoom(sub) { return this.deco[this.decoKey(sub)] || null; }
  placeFromStorage(idx, sub, x, y) {
    const it = this.storage[idx];
    if (!it) return false;
    this.storage.splice(idx, 1);
    (this.deco[this.decoKey(sub)] ||= []).push(withColor({ k: it.k, v: it.v, x: Math.round(x), y: Math.round(y) }, it.c));
    this.save();
    return true;
  }
  moveDeco(sub, i, x, y) {
    const d = this.decoRoom(sub)?.[i];
    if (!d) return false;
    d.x = Math.round(x); d.y = Math.round(y); // färgen (d.c) följer med
    this.save();
    return true;
  }
  decoToStorage(sub, i) {
    const list = this.decoRoom(sub);
    const d = list?.[i];
    if (!d || d.fx || !katalogOf(d.k)) return false;
    list.splice(i, 1);
    this.storage.push(withColor({ k: d.k, v: d.v }, d.c));
    this.save();
    return true;
  }
  // Måla om (gratis) – en möbel i förrådet eller en placerad. c = null ger originalfärgen.
  recolorStorage(idx, c) {
    const it = this.storage[idx];
    if (!it) return false;
    withColor(it, c);
    this.save();
    return true;
  }
  recolorDeco(sub, i, c) {
    const d = this.decoRoom(sub)?.[i];
    if (!d || d.k === 'vaxt') return false;
    withColor(d, c);
    this.save();
    return true;
  }
  sellDeco(sub, i) {
    const list = this.decoRoom(sub);
    const d = list?.[i];
    if (!d || d.fx || !katalogOf(d.k)) return false;
    list.splice(i, 1);
    this.money += Math.round(katalogOf(d.k).price / 2);
    this.save();
    return true;
  }
  sellStorage(idx) {
    const it = this.storage[idx];
    if (!it) return false;
    this.storage.splice(idx, 1);
    this.money += Math.round(katalogOf(it.k).price / 2);
    this.save();
    return true;
  }

  // ---------- bostad ----------
  moveTo(homeId) {
    const h = homeOf(homeId);
    if (h.id === this.home) return { ok: false, msg: 'Du bor redan här.' };
    if (this.money < h.deposit) return { ok: false, msg: `Insatsen är ${fmt(h.deposit)} – du har inte råd än.` };
    this.money -= h.deposit;
    this.home = h.id;
    this.save();
    return { ok: true };
  }
}

const clamp = (v) => Math.max(0, Math.min(100, Math.round(+v || 0)));
