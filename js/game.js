// Speltillståndet för Snabbfilen: klockan, behoven, pengarna, kylskåpet, jobben
// och bostaden. Ingen rendering här – scenerna läser och kommandona ändrar.
import { toast } from './core/ui.js';
import { play } from './core/sound.js';

export const SAVE_KEY = 'snabbfilen_save1';
// Fält som gamla versioner sparade men som load() redan har flyttat in på nytt ställe
// (furniture → förrådet) – de ska inte följa med tillbaka som okänd data.
const LEGACY_FIELDS = ['furniture'];
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
  // de nya arbetsplatserna (löner satta efter provspel: ungefär samma lön per pass som Burgarbaren)
  pizzeria: { id: 'pizzeria', icon: '🍕', name: 'Pizzerian', verb: 'Baka rätt pizza och servera rätt kund', wage: 20, oops: 8 },
  posten: { id: 'posten', icon: '📮', name: 'Posten', verb: 'Sortera paketen till rätt rullbur', wage: 10, oops: 5 },
  bensinmack: { id: 'bensinmack', icon: '⛽', name: 'Pixelmacken', verb: 'Tanka bilarna och sälj korv i kiosken', wage: 10, oops: 5 },
  bilverkstad: { id: 'bilverkstad', icon: '🔧', name: 'Bilverkstan', verb: 'Hämta rätt del och laga bilarna', wage: 12, oops: 5 },
  tvatteri: { id: 'tvatteri', icon: '🧺', name: 'Tvätteriet', verb: 'Tvätta, torka, vik och lämna rätt påse', wage: 16, oops: 6 },
  kafe: { id: 'kafe', icon: '☕', name: 'Kaféet', verb: 'Gör rätt dryck och servera rätt gäst', wage: 14, oops: 6 },
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

// Möbelkatalogen (köps på MÖBELJÄTTEN, hamnar i förrådet och placeras hemma
// med Möblera-läget). Fälten:
//   vars      antal färg-/modellvarianter i spriteatlasen (nyckel = kind + index)
//   room      avdelningen i varuhuset: VARDAGSRUM/SOVRUM/KÖK/BADRUM/BARNRUM/KONTOR/HALL/ÖVRIGT
//   wall      hänger på bakväggen (ingen hinderyta, ritas bakom allt på golvet)
//   overWindow väggsak som får hänga över fönstren (gardiner) – andra väggsaker får det inte
//   function  vad man kan göra vid möbeln hemma: sova, garderob, ata (öppna kylskåpet),
//             toalett, tvatta, tv – funktionen följer möbeln vart den än står
//   views     vyerna som möbeln roterar igenom (🔄 i Möblera-läget): [sort, varianttabell?]
//             per vy – [fram], [höger sida], [bak]; vänster sida = höger sida speglad.
//             Två vyer = fram/sida (+ speglade). Utan views speglas möbeln bara (r 0 ↔ 1).
//             Varianttabellen översätter möbelns färgindex till vyns index så att samma
//             färg följer med runt.
const SOFFA_V = [0, 1, 4, 5, 7, 9, 2, 3, 6, 8], FATOLJ_V = [5, 0, 2, 4, 1, 3];
const SANG_V = [0, 0, 1, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
export const KATALOG = [
  // ---- de ursprungliga sorterna (nycklarna får inte byta ordning – sparfiler pekar på dem) ----
  { kind: 'stol', icon: '🪑', name: 'Gamingstol', price: 150, vars: 4, room: 'KONTOR' }, // stol på hjul ur Chairs.png – hör ihop med gamingriggen (tv0)
  { kind: 'bordR', icon: '🟤', name: 'Runt bord', price: 250, vars: 4, room: 'VARDAGSRUM' },
  { kind: 'matta', icon: '🟥', name: 'Matta', price: 250, vars: 2, room: 'VARDAGSRUM' },
  { kind: 'lampa', icon: '💡', name: 'Lampa', price: 300, vars: 2, room: 'VARDAGSRUM' },
  { kind: 'spegel', icon: '🪞', name: 'Spegel', price: 350, vars: 3, room: 'HALL' },
  { kind: 'vaxtS', icon: '🪴', name: 'Krukväxt', price: 350, vars: 1, room: 'VARDAGSRUM' },
  { kind: 'fatolj', icon: '🛋️', name: 'Fåtölj', price: 450, vars: 6, room: 'VARDAGSRUM', views: [['fatolj'], ['sidofatolj', FATOLJ_V], ['bakfatolj', FATOLJ_V]] },
  { kind: 'byra', icon: '🗄️', name: 'Byrå', price: 500, vars: 4, room: 'SOVRUM' },
  { kind: 'bokhylla', icon: '📚', name: 'Bokhylla', price: 600, vars: 3, room: 'VARDAGSRUM' },
  { kind: 'bordM', icon: '🍽️', name: 'Matbord', price: 600, vars: 4, room: 'KÖK' },
  { kind: 'soffa', icon: '🛋️', name: 'Soffa', price: 800, vars: 10, room: 'VARDAGSRUM', views: [['soffa'], ['sidosoffa', SOFFA_V], ['baksoffa', SOFFA_V]] },
  { kind: 'tv', icon: '🖥️', name: 'TV / dator', price: 1200, vars: 5, room: 'VARDAGSRUM', function: 'tv' },
  { kind: 'spis', icon: '🔥', name: 'Öppen spis', price: 1500, vars: 3, room: 'VARDAGSRUM' },
  // startmöblerna (sang/garderob) säljs nu också – i alla färger arken har
  { kind: 'sang', icon: '🛏️', name: 'Dubbelsäng', price: 1800, vars: 14, room: 'SOVRUM', function: 'sova', views: [['sang'], ['tvardubbel', SANG_V]] },
  { kind: 'garderob', icon: '👔', name: 'Garderob', price: 1300, vars: 12, room: 'SOVRUM', function: 'garderob' },
  // ---- VARDAGSRUM ----
  { kind: 'matstol', icon: '🪑', name: 'Matstol med dyna', price: 180, vars: 6, room: 'KÖK' },
  { kind: 'sidobord', icon: '🟫', name: 'Sidobord med duk', price: 280, vars: 6, room: 'VARDAGSRUM' },
  { kind: 'pelarbord', icon: '🍵', name: 'Runt pelarbord', price: 300, vars: 6, room: 'VARDAGSRUM' },
  { kind: 'laghylla', icon: '📚', name: 'Låg bokhylla', price: 350, vars: 2, room: 'VARDAGSRUM' },
  { kind: 'skivor', icon: '💿', name: 'Skivsamling', price: 400, vars: 2, room: 'VARDAGSRUM' },
  { kind: 'smalhylla', icon: '📚', name: 'Smal bokhylla', price: 400, vars: 2, room: 'VARDAGSRUM' },
  { kind: 'soffbord', icon: '☕', name: 'Soffbord', price: 400, vars: 4, room: 'VARDAGSRUM' },
  { kind: 'mellanhylla', icon: '📚', name: 'Bokhylla med två hyllplan', price: 450, vars: 2, room: 'VARDAGSRUM' },
  { kind: 'glasbord', icon: '🥂', name: 'Glasbord', price: 550, vars: 1, room: 'VARDAGSRUM' },
  { kind: 'tvbank', icon: '📺', name: 'TV-bänk', price: 600, vars: 7, room: 'VARDAGSRUM' },
  { kind: 'hoghylla', icon: '📚', name: 'Hög bokhylla', price: 650, vars: 2, room: 'VARDAGSRUM' },
  { kind: 'kuddsoffa', icon: '🛋️', name: 'Soffa med kuddar', price: 950, vars: 3, room: 'VARDAGSRUM' },
  { kind: 'blomtavla', icon: '🌷', name: 'Stor blomstertavla', price: 1100, vars: 1, room: 'VARDAGSRUM', wall: true },
  { kind: 'bredhylla', icon: '📚', name: 'Bred bokhylla', price: 1100, vars: 3, room: 'VARDAGSRUM' },
  { kind: 'eldstad', icon: '🔥', name: 'Eldstad med sims', price: 1400, vars: 4, room: 'VARDAGSRUM' },
  { kind: 'stormatta', icon: '🟥', name: 'Stor matta', price: 1400, vars: 4, room: 'VARDAGSRUM' },
  { kind: 'vaggsvard', icon: '⚔️', name: 'Svärd på vägg', price: 1500, vars: 3, room: 'VARDAGSRUM', wall: true },
  { kind: 'tegelspis', icon: '🧱', name: 'Tegelspis', price: 1600, vars: 4, room: 'VARDAGSRUM' },
  { kind: 'murspis', icon: '🔥', name: 'Murad spis med skorsten', price: 2200, vars: 2, room: 'VARDAGSRUM' },
  { kind: 'moraklocka', icon: '🕰️', name: 'Moraklocka', price: 3500, vars: 1, room: 'VARDAGSRUM' },
  { kind: 'piano', icon: '🎹', name: 'Piano', price: 3500, vars: 3, room: 'VARDAGSRUM' },
  // ---- SOVRUM ----
  { kind: 'nattduksbord', icon: '🗄️', name: 'Nattduksbord', price: 250, vars: 4, room: 'SOVRUM' },
  { kind: 'kista', icon: '🧰', name: 'Förvaringskista', price: 400, vars: 1, room: 'SOVRUM' },
  { kind: 'lagbyra', icon: '🗃️', name: 'Låg byrå', price: 450, vars: 7, room: 'SOVRUM' },
  { kind: 'kladskap', icon: '🚪', name: 'Klädskåp', price: 700, vars: 10, room: 'SOVRUM', function: 'garderob' },
  { kind: 'linneskap', icon: '🧺', name: 'Linneskåp med hyllor', price: 850, vars: 10, room: 'SOVRUM', function: 'garderob' },
  { kind: 'enkelsang', icon: '🛏️', name: 'Enkelsäng', price: 900, vars: 10, room: 'SOVRUM', function: 'sova', views: [['enkelsang'], ['tvarsang']] },
  // ---- KÖK ----
  { kind: 'soptunna', icon: '🗑️', name: 'Soptunna', price: 80, vars: 2, room: 'KÖK' },
  { kind: 'brodrost', icon: '🍞', name: 'Brödrost', price: 150, vars: 1, room: 'KÖK' },
  { kind: 'fruktskal', icon: '🍎', name: 'Fruktskål', price: 150, vars: 1, room: 'KÖK' },
  { kind: 'kaffebryggare', icon: '☕', name: 'Kaffebryggare', price: 250, vars: 1, room: 'KÖK' },
  { kind: 'kryddhylla', icon: '🧂', name: 'Kryddhylla', price: 250, vars: 4, room: 'KÖK', wall: true },
  { kind: 'tarta', icon: '🎂', name: 'Tårta', price: 250, vars: 4, room: 'KÖK' },
  { kind: 'flaskhylla', icon: '🍾', name: 'Flaskhylla', price: 300, vars: 2, room: 'KÖK', wall: true },
  { kind: 'rullbord', icon: '🛒', name: 'Rullbord', price: 300, vars: 1, room: 'KÖK' },
  { kind: 'mikro', icon: '♨️', name: 'Mikrovågsugn', price: 400, vars: 1, room: 'KÖK', function: 'ata' },
  { kind: 'koksbord', icon: '🪑', name: 'Köksbord', price: 450, vars: 6, room: 'KÖK' },
  { kind: 'overskap', icon: '🚪', name: 'Överskåp', price: 450, vars: 4, room: 'KÖK', wall: true },
  { kind: 'porslinsskap', icon: '🍽️', name: 'Porslinsskåp', price: 500, vars: 4, room: 'KÖK', wall: true },
  { kind: 'flakt', icon: '💨', name: 'Köksfläkt', price: 600, vars: 2, room: 'KÖK', wall: true },
  { kind: 'bankskap', icon: '🗄️', name: 'Köksbänk', price: 700, vars: 8, room: 'KÖK' },
  { kind: 'diskbank', icon: '🚰', name: 'Diskbänk', price: 1400, vars: 4, room: 'KÖK' },
  { kind: 'koksspis', icon: '🍳', name: 'Köksspis', price: 1600, vars: 2, room: 'KÖK', function: 'ata' },
  { kind: 'kyl', icon: '🧊', name: 'Kylskåp', price: 1800, vars: 6, room: 'KÖK', function: 'ata' },
  { kind: 'dryckeskyl', icon: '🥤', name: 'Dryckeskyl', price: 2200, vars: 1, room: 'KÖK' },
  { kind: 'kokso', icon: '🥘', name: 'Köksö med ugn', price: 2400, vars: 4, room: 'KÖK' },
  // ---- BADRUM ----
  { kind: 'strykbrada', icon: '👔', name: 'Strykbräda', price: 200, vars: 3, room: 'BADRUM' },
  { kind: 'kattlada', icon: '📦', name: 'Kattlåda', price: 250, vars: 4, room: 'BADRUM' },
  { kind: 'medicinskap', icon: '💊', name: 'Medicinskåp', price: 300, vars: 1, room: 'BADRUM', wall: true },
  { kind: 'badhylla', icon: '🧴', name: 'Badrumshylla', price: 350, vars: 4, room: 'BADRUM' },
  { kind: 'tvattstall', icon: '🧼', name: 'Tvättställ', price: 400, vars: 2, room: 'BADRUM', wall: true, function: 'tvatta' },
  { kind: 'handfat', icon: '🪥', name: 'Handfat', price: 500, vars: 2, room: 'BADRUM', function: 'tvatta' },
  { kind: 'badbank', icon: '🧽', name: 'Badrumsbänk', price: 600, vars: 2, room: 'BADRUM' },
  { kind: 'toalett', icon: '🚽', name: 'Toalett', price: 900, vars: 6, room: 'BADRUM', function: 'toalett' },
  { kind: 'torktumlare', icon: '🌀', name: 'Torktumlare', price: 1600, vars: 1, room: 'BADRUM' },
  { kind: 'tvattmaskin', icon: '🫧', name: 'Tvättmaskin', price: 2000, vars: 1, room: 'BADRUM', function: 'tvatta' },
  { kind: 'dusch', icon: '🚿', name: 'Dusch', price: 2200, vars: 8, room: 'BADRUM', function: 'tvatta' },
  { kind: 'badkar', icon: '🛁', name: 'Badkar', price: 2800, vars: 2, room: 'BADRUM', function: 'tvatta' },
  { kind: 'tvattpelare', icon: '🧺', name: 'Tvättpelare', price: 3500, vars: 1, room: 'BADRUM', function: 'tvatta' },
  // ---- BARNRUM ----
  { kind: 'byggklossar', icon: '🧱', name: 'Byggklossar', price: 120, vars: 2, room: 'BARNRUM' },
  { kind: 'basketboll', icon: '🏀', name: 'Basketboll', price: 150, vars: 1, room: 'BARNRUM' },
  { kind: 'palett', icon: '🎨', name: 'Målarpalett', price: 150, vars: 1, room: 'BARNRUM' },
  { kind: 'barntavla', icon: '🖼️', name: 'Barntavla', price: 160, vars: 3, room: 'BARNRUM', wall: true },
  { kind: 'abcplansch', icon: '🔤', name: 'ABC-plansch', price: 180, vars: 1, room: 'BARNRUM', wall: true },
  { kind: 'golvkudde', icon: '🟪', name: 'Golvkudde', price: 180, vars: 6, room: 'BARNRUM' },
  { kind: 'gosedjur', icon: '🧸', name: 'Gosedjur', price: 200, vars: 3, room: 'BARNRUM' },
  { kind: 'skolstol', icon: '🪑', name: 'Skolstol', price: 200, vars: 1, room: 'BARNRUM' },
  { kind: 'gosegroda', icon: '🐸', name: 'Gosegroda', price: 220, vars: 1, room: 'BARNRUM' },
  { kind: 'molnkudde', icon: '☁️', name: 'Molnkudde', price: 250, vars: 1, room: 'BARNRUM' },
  { kind: 'nattlampa', icon: '🍄', name: 'Nattlampa', price: 250, vars: 2, room: 'BARNRUM' },
  { kind: 'ryggsack', icon: '🎒', name: 'Ryggsäck', price: 250, vars: 4, room: 'BARNRUM' },
  { kind: 'stjarnkudde', icon: '🌟', name: 'Stjärnkudde', price: 250, vars: 1, room: 'BARNRUM' },
  { kind: 'vaggmane', icon: '🌙', name: 'Vägg-måne', price: 280, vars: 1, room: 'BARNRUM', wall: true },
  { kind: 'barnstol', icon: '⭐', name: 'Stjärnstol', price: 300, vars: 5, room: 'BARNRUM' },
  { kind: 'backar', icon: '🧺', name: 'Förvaringsbackar', price: 350, vars: 3, room: 'BARNRUM' },
  { kind: 'barnbord', icon: '🟫', name: 'Barnbord', price: 350, vars: 1, room: 'BARNRUM' },
  { kind: 'leksakslada', icon: '📦', name: 'Leksakskista', price: 450, vars: 4, room: 'BARNRUM' },
  { kind: 'skolbank', icon: '✏️', name: 'Skolbänk', price: 500, vars: 1, room: 'BARNRUM' },
  { kind: 'jattenalle', icon: '🐻', name: 'Jättenalle', price: 600, vars: 1, room: 'BARNRUM' },
  { kind: 'platskap', icon: '🔒', name: 'Plåtskåp', price: 650, vars: 1, room: 'BARNRUM' },
  { kind: 'basketkorg', icon: '🥅', name: 'Basketkorg', price: 800, vars: 1, room: 'BARNRUM', wall: true },
  { kind: 'retrotv', icon: '📺', name: 'Gammal TV', price: 900, vars: 1, room: 'BARNRUM', function: 'tv' },
  { kind: 'fiol', icon: '🎻', name: 'Fiol', price: 1200, vars: 1, room: 'BARNRUM' },
  { kind: 'spelkonsol', icon: '🎮', name: 'Spelkonsol', price: 1600, vars: 3, room: 'BARNRUM', function: 'tv' },
  // ---- KONTOR ----
  { kind: 'papperskorg', icon: '🗑️', name: 'Papperskorg', price: 80, vars: 1, room: 'KONTOR' },
  { kind: 'parmar', icon: '📂', name: 'Pärmar', price: 120, vars: 1, room: 'KONTOR' },
  { kind: 'vaggkalender', icon: '📅', name: 'Väggkalender', price: 120, vars: 1, room: 'KONTOR', wall: true },
  { kind: 'bokstapel', icon: '📚', name: 'Bokstapel', price: 150, vars: 2, room: 'KONTOR' },
  { kind: 'skolplansch', icon: '🫀', name: 'Kroppsplansch', price: 220, vars: 1, room: 'KONTOR', wall: true },
  { kind: 'anslagstavla', icon: '📌', name: 'Anslagstavla', price: 300, vars: 2, room: 'KONTOR', wall: true },
  { kind: 'telefon', icon: '☎️', name: 'Telefon', price: 350, vars: 3, room: 'KONTOR' },
  { kind: 'kontorsstol', icon: '💺', name: 'Kontorsstol', price: 450, vars: 3, room: 'KONTOR' },
  { kind: 'skrivbord', icon: '📝', name: 'Skrivbord', price: 700, vars: 7, room: 'KONTOR' },
  { kind: 'laspulpet', icon: '📖', name: 'Läspulpet', price: 750, vars: 2, room: 'KONTOR' },
  { kind: 'arbetsbank', icon: '🗃️', name: 'Arbetsbänk med lådor', price: 900, vars: 1, room: 'KONTOR' },
  { kind: 'skoltavla', icon: '🟩', name: 'Skoltavla', price: 900, vars: 2, room: 'KONTOR', wall: true },
  { kind: 'datortorn', icon: '💾', name: 'Datortorn', price: 1000, vars: 4, room: 'KONTOR' },
  { kind: 'dator', icon: '🖥️', name: 'Dator', price: 1400, vars: 4, room: 'KONTOR', function: 'tv' },
  { kind: 'laptop', icon: '💻', name: 'Bärbar dator', price: 1800, vars: 2, room: 'KONTOR', function: 'tv' },
  // ---- HALL ----
  { kind: 'pall', icon: '🪑', name: 'Pall', price: 90, vars: 1, room: 'HALL' },
  { kind: 'dorrmatta', icon: '🟧', name: 'Dörrmatta', price: 120, vars: 4, room: 'HALL' },
  { kind: 'sittbank', icon: '🪵', name: 'Sittbänk', price: 350, vars: 1, room: 'HALL' },
  { kind: 'transportbur', icon: '🧳', name: 'Transportbur', price: 350, vars: 4, room: 'HALL' },
  { kind: 'skobank', icon: '👟', name: 'Skobänk', price: 400, vars: 7, room: 'HALL' },
  { kind: 'rundspegel', icon: '🪞', name: 'Rund spegel', price: 450, vars: 4, room: 'HALL', wall: true },
  { kind: 'hallbank', icon: '🪵', name: 'Hallbänk med ryggstöd', price: 550, vars: 2, room: 'HALL' },
  { kind: 'rustning', icon: '🛡️', name: 'Riddarrustning', price: 3000, vars: 2, room: 'HALL' },
  // ---- ÖVRIGT (dekor för alla rum, växter, husdjursgrejer, jul) ----
  { kind: 'ljus', icon: '🕯️', name: 'Stearinljus', price: 80, vars: 3, room: 'ÖVRIGT' },
  { kind: 'matskal', icon: '🥣', name: 'Matskål till husdjur', price: 80, vars: 4, room: 'ÖVRIGT' },
  { kind: 'julstrumpa', icon: '🧦', name: 'Julstrumpa', price: 90, vars: 8, room: 'ÖVRIGT', wall: true },
  { kind: 'lillblomma', icon: '🌱', name: 'Liten krukväxt', price: 90, vars: 6, room: 'ÖVRIGT' },
  { kind: 'julfigur', icon: '🎅', name: 'Julfigur', price: 120, vars: 4, room: 'ÖVRIGT' },
  { kind: 'polkagris', icon: '🍭', name: 'Jättepolkagris', price: 120, vars: 2, room: 'ÖVRIGT' },
  { kind: 'julklapp', icon: '🎁', name: 'Julklapp', price: 150, vars: 12, room: 'ÖVRIGT' },
  { kind: 'julklocka', icon: '🔔', name: 'Julklocka', price: 150, vars: 1, room: 'ÖVRIGT', wall: true },
  { kind: 'julsack', icon: '🛍️', name: 'Julsäck', price: 150, vars: 3, room: 'ÖVRIGT' },
  { kind: 'smatavla', icon: '🖼️', name: 'Liten tavla', price: 150, vars: 3, room: 'ÖVRIGT', wall: true },
  { kind: 'blomkruka', icon: '🌹', name: 'Blomkruka', price: 180, vars: 4, room: 'ÖVRIGT' },
  { kind: 'ljusgrupp', icon: '🕯️', name: 'Ljusgrupp', price: 180, vars: 3, room: 'ÖVRIGT' },
  { kind: 'girlang', icon: '🎀', name: 'Julgirlang', price: 200, vars: 2, room: 'ÖVRIGT', wall: true },
  { kind: 'julljus', icon: '🕯️', name: 'Julljus med järnek', price: 200, vars: 1, room: 'ÖVRIGT' },
  { kind: 'portratt', icon: '🖼️', name: 'Litet porträtt', price: 200, vars: 3, room: 'ÖVRIGT', wall: true },
  { kind: 'kragetavla', icon: '🌼', name: 'Prästkragetavla', price: 250, vars: 1, room: 'ÖVRIGT', wall: true },
  { kind: 'minigran', icon: '🌲', name: 'Liten julgran', price: 250, vars: 3, room: 'ÖVRIGT' },
  { kind: 'djurbadd', icon: '🐾', name: 'Husdjursbädd', price: 300, vars: 8, room: 'ÖVRIGT' },
  { kind: 'lillmatta', icon: '🧶', name: 'Liten matta', price: 300, vars: 10, room: 'ÖVRIGT' },
  { kind: 'ramtavla', icon: '🖼️', name: 'Tavla i ram', price: 300, vars: 2, room: 'ÖVRIGT', wall: true },
  { kind: 'bordslampa', icon: '💡', name: 'Bordslampa', price: 350, vars: 5, room: 'ÖVRIGT' },
  { kind: 'bredtavla', icon: '🖼️', name: 'Tavla på bredden', price: 350, vars: 2, room: 'ÖVRIGT', wall: true },
  { kind: 'klockblomma', icon: '🪻', name: 'Klockranka', price: 400, vars: 3, room: 'ÖVRIGT' },
  { kind: 'rundmatta', icon: '⭕', name: 'Rund matta', price: 400, vars: 6, room: 'ÖVRIGT' },
  { kind: 'vaggklocka', icon: '🕰️', name: 'Väggklocka', price: 400, vars: 1, room: 'ÖVRIGT', wall: true },
  { kind: 'fredslilja', icon: '🪴', name: 'Fredslilja', price: 450, vars: 2, room: 'ÖVRIGT' },
  { kind: 'kattkoja', icon: '⛺', name: 'Kattkoja', price: 450, vars: 8, room: 'ÖVRIGT' },
  { kind: 'rutmatta', icon: '🧺', name: 'Rutig matta', price: 450, vars: 4, room: 'ÖVRIGT' },
  { kind: 'draperi', icon: '🪟', name: 'Fördragna gardiner', price: 500, vars: 10, room: 'ÖVRIGT', wall: true, overWindow: true },
  { kind: 'gardin', icon: '🪟', name: 'Gardiner', price: 500, vars: 10, room: 'ÖVRIGT', wall: true, overWindow: true },
  { kind: 'gummitrad', icon: '🌿', name: 'Gummiträd', price: 550, vars: 1, room: 'ÖVRIGT' },
  { kind: 'golvlampa', icon: '💡', name: 'Golvlampa med skärm', price: 600, vars: 4, room: 'ÖVRIGT' },
  { kind: 'staffli', icon: '🎨', name: 'Staffli med målning', price: 600, vars: 1, room: 'ÖVRIGT' },
  { kind: 'lovkoja', icon: '🌿', name: 'Lummig kattkoja', price: 650, vars: 4, room: 'ÖVRIGT' },
  { kind: 'julgran', icon: '🎄', name: 'Julgran', price: 800, vars: 2, room: 'ÖVRIGT' },
  { kind: 'katthus', icon: '🐱', name: 'Katthus', price: 800, vars: 4, room: 'ÖVRIGT' },
  { kind: 'landskap', icon: '🏞️', name: 'Landskapsmålning', price: 900, vars: 1, room: 'ÖVRIGT', wall: true },
  { kind: 'kattrad', icon: '🐈', name: 'Klösträd', price: 1200, vars: 4, room: 'ÖVRIGT' },
];
const KAT_BY_KIND = new Map(KATALOG.map((k) => [k.kind, k]));
export const katalogOf = (kind) => KAT_BY_KIND.get(kind);
// Möbler som bara finns som startmöblering (inte i katalogen) och vad man gör vid dem.
// kylskap/vaxt är de gamla startmöblerna, dass är Lilla rummets usla toalett.
export const FX_KINDS = { kylskap: 'ata', dass: 'toalett', vaxt: null };
export const knownKind = (k) => !!(katalogOf(k) || k in FX_KINDS);
// Vad man kan göra vid en möbel (null = inget) – följer sorten, alltså möbeln vart den än står.
export const functionOf = (k) => katalogOf(k)?.function || FX_KINDS[k] || null;
// Rotationsvyn för möbeln k (variant v) i läge r (0–3): { k, v, flip } – vilken ruta i atlasen
// som ska ritas och om den ska speglas. Utan views (och för väggsaker) finns bara 0 och 1.
export function viewOf(k, v, r = 0) {
  const kat = katalogOf(k);
  const views = kat && !kat.wall ? kat.views : null;
  r = (r | 0) & 3;
  if (!views || views.length < 2) return { k, v: v | 0, flip: (r & 1) === 1 };
  const i = views.length === 2 ? r & 1 : r === 3 ? 1 : r;
  const [vk, map] = views[i];
  const vv = map ? (map[v | 0] ?? 0) : v | 0;
  return { k: vk, v: vv, flip: views.length === 2 ? r >= 2 : r === 3 };
}
// Antal rotationslägen (2 = bara spegling)
export const rotStates = (k) => { const kat = katalogOf(k); return kat && !kat.wall && kat.views?.length >= 2 ? 4 : 2; };
// Möbelns egen färg: bara giltig '#rrggbb' (gemener) räknas, annars null = originalfärgen.
export const cleanHex = (c) => (typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c) ? c.toLowerCase() : null);
const withColor = (o, c) => { const h = cleanHex(c); if (h) o.c = h; else delete o.c; return o; };
// Rotation (r) och funktionsflaggan (fx = startmöbel, kan inte säljas) följer med i alla flyttar
const withFlags = (o, src) => { if (src?.fx) o.fx = 1; else delete o.fx; const r = (src?.r | 0) & 3; if (r) o.r = r; else delete o.r; return o; };
// Taken gäller det som läggs till (köp, ställa ut, lägga i förrådet) – aldrig det som
// redan finns i sparfilen: load() kapar ingenting, så inget kan försvinna.
export const MAX_STORAGE = 80, MAX_PER_ROOM = 80;
const DECO_KEY = /^[a-z][a-z0-9]*:\d{1,2}$/;
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
    this.jobs = Object.fromEntries(Object.keys(JOBS).map((k) => [k, 0])); // antal jobbade pass per jobb
    this.earned = 0;                      // totalt intjänat
    this.wardrobe = [];                   // upplåsta plagg, "kind:v"
    this.storage = [];                    // möbler i förrådet, { k, v, c?, r?, fx? } (c = egen färg '#rrggbb', r = rotation 0–3)
    this.deco = {};                       // placerade möbler per rum: "hem:sub" -> [{ k, v, c?, x, y, r?, fx? }]
    this.won = false;                     // slutmålet nått
    this.event = null;                    // dagens händelse { id, job? }
    this.best = Object.fromEntries(Object.keys(JOBS).map((k) => [k, { ok: 0, pay: 0 }])); // rekord per jobb
    this.collapsed = false;               // somnade utmattad i natt (sätts av passTime)
  }

  eventIs(id) { return this.event?.id === id; }

  get dayName() { return DAY_NAMES[(this.day - 1) % 7]; }
  get homeInfo() { return homeOf(this.home); }

  // ---------- spara/ladda ----------
  // Sparfilen får aldrig tappa data mellan versioner: det som den här versionen inte
  // förstår (fält, plagg, möbler, jobb, mat från en nyare version) ligger kvar i _keep
  // och skrivs tillbaka orört, så att en äldre flik aldrig raderar något nyare.
  save() {
    try {
      const { _saveIn, collapsed, ...data } = this;
      const k = this._keep;
      const out = { ...(k?.top || {}), v: 1, ...data };
      if (k) {
        out.jobs = { ...k.jobs, ...data.jobs };
        out.best = { ...k.best, ...data.best };
        out.fridge = { ...k.fridge, ...data.fridge };
        out.wardrobe = [...data.wardrobe, ...k.wardrobe.filter((w) => !data.wardrobe.includes(w))];
        out.storage = [...data.storage, ...k.storage];
        out.deco = { ...data.deco };
        for (const [key, list] of Object.entries(k.deco)) out.deco[key] = [...(data.deco[key] || []), ...list];
      }
      localStorage.setItem(SAVE_KEY, JSON.stringify(out));
    } catch { /* full/blockerad */ }
  }
  static load() {
    const g = new Game();
    let rawText = null;
    try {
      rawText = localStorage.getItem(SAVE_KEY);
      const p = JSON.parse(rawText || 'null');
      if (p && p.v !== 1) throw new Error('okänd sparversion ' + p.v);
      if (p && p.v === 1) {
        const keep = { top: {}, jobs: {}, best: {}, fridge: {}, wardrobe: [], storage: [], deco: {} };
        Object.defineProperty(g, '_keep', { value: keep, writable: true, enumerable: false });
        for (const [key, val] of Object.entries(p)) if (!(key in g) && !LEGACY_FIELDS.includes(key)) keep.top[key] = val;
        g.day = Math.max(1, p.day | 0); g.min = Math.min(DAY - 1, Math.max(0, +p.min || 0));
        g.money = Math.round(+p.money || 0); g.hunger = clamp(p.hunger); g.energy = clamp(p.energy);
        g.home = homeOf(p.home).id;
        g.fridge = {}; for (const [k, v] of Object.entries(p.fridge || {})) { if (!foodOf(k)) keep.fridge[k] = v; else if (v > 0) g.fridge[k] = Math.min(20, v | 0); }
        for (const k of Object.keys(g.jobs)) g.jobs[k] = Math.max(0, p.jobs?.[k] | 0);
        for (const [k, v] of Object.entries(p.jobs || {})) if (!(k in g.jobs)) keep.jobs[k] = v;
        for (const [k, v] of Object.entries(p.best || {})) if (!(k in g.best)) keep.best[k] = v;
        g.earned = Math.max(0, +p.earned || 0);
        const knownClothes = (k) => SORTIMENT.some((s) => clothesKey(s.kind, s.v) === k);
        g.wardrobe = (Array.isArray(p.wardrobe) ? p.wardrobe : []).filter(knownClothes);
        keep.wardrobe = (Array.isArray(p.wardrobe) ? p.wardrobe : []).filter((k) => typeof k === 'string' && !knownClothes(k));
        // fält som en nyare version lagt på en möbel följer med orörda; rotation (r) och
        // startmöbelflaggan (fx) tolkas – de kan ligga både hemma och i förrådet
        const extra = (it) => { const { k, v, x, y, fx, c, r, ...rest } = it; return rest; };
        const maxV = (k) => (katalogOf(k)?.vars || 1) - 1;
        const cleanItem = (it) => it && typeof it === 'object' && knownKind(it.k)
          ? withFlags(withColor({ ...extra(it), k: it.k, v: Math.max(0, Math.min(maxV(it.k), it.v | 0)) }, it.c), it) : null;
        g.storage = (Array.isArray(p.storage) ? p.storage : []).map(cleanItem).filter(Boolean);
        keep.storage = (Array.isArray(p.storage) ? p.storage : []).filter((it) => it && typeof it === 'object' && !knownKind(it.k));
        const knownFurn = (d) => d && typeof d === 'object' && knownKind(d.k);
        if (p.deco && typeof p.deco === 'object') for (const [key, list] of Object.entries(p.deco)) {
          if (!DECO_KEY.test(key) || !Array.isArray(list)) { keep.deco[key] = list; continue; }
          const unknown = list.filter((d) => d && typeof d === 'object' && !knownFurn(d));
          if (unknown.length) keep.deco[key] = unknown;
          g.deco[key] = list.filter(knownFurn)
            .map((d) => withFlags(withColor({ ...extra(d), k: d.k, v: Math.max(0, Math.min(maxV(d.k), d.v | 0)), x: Math.max(0, Math.min(384, +d.x || 0)), y: Math.max(0, Math.min(216, +d.y || 0)) }, d.c), d));
        }
        // gamla sparfiler: köpta möbler (id-lista) flyttas till förrådet
        if (Array.isArray(p.furniture)) for (const id of p.furniture) if (OLD_FURN[id]) g.storage.push({ k: OLD_FURN[id], v: 0 });
        g.won = !!p.won;
        if (p.event && EVENTS.some((e) => e.id === p.event.id)) g.event = { id: p.event.id, job: JOBS[p.event.job] ? p.event.job : undefined };
        for (const k of Object.keys(g.best)) g.best[k] = { ok: Math.max(0, p.best?.[k]?.ok | 0), pay: Math.max(0, p.best?.[k]?.pay | 0) };
      }
    } catch (err) {
      // Trasig eller för ny sparfil: lägg undan den orörd innan spelet börjar om, så att
      // nästa save() aldrig skriver över det enda exemplaret.
      try { if (rawText) localStorage.setItem(`${SAVE_KEY}_undanlagd_${Date.now()}`, rawText); } catch { /* full */ }
      console.warn('Sparfilen kunde inte läsas och lades undan:', err?.message);
    }
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
    if (this.storage.length >= MAX_STORAGE) return { ok: false, msg: 'Förrådet är fullt – möblera hemma först!' };
    this.money -= f.price;
    this.storage.push(withColor({ k: kind, v: Math.max(0, Math.min(f.vars - 1, v | 0)) }, c));
    this.save();
    return { ok: true, item: f };
  }
  // ---------- möblering (rummet sköter kollision, det här är bara bokföring) ----------
  // Allt går att flytta – även startmöblerna (fx) – både inom rummet och via förrådet
  // till ett annat delrum. Funktionen (sova, garderob, äta, toalett …) sitter på sorten,
  // så den följer med. fx-möbler kan inte säljas (då blev man av med sin enda säng).
  // (Om en säng står ute någonstans hemma avgör rummet – homeHasFunction i room.js –
  // eftersom delrum man inte besökt än räknas med sin startmöblering.)
  decoKey(sub) { return `${this.home}:${sub | 0}`; }
  decoRoom(sub) { return this.deco[this.decoKey(sub)] || null; }
  placeFromStorage(idx, sub, x, y) {
    const it = this.storage[idx];
    if (!it) return false;
    const list = (this.deco[this.decoKey(sub)] ||= []);
    if (list.length >= MAX_PER_ROOM) return false;
    this.storage.splice(idx, 1);
    list.push(withFlags(withColor({ k: it.k, v: it.v, x: Math.round(x), y: Math.round(y) }, it.c), it));
    this.save();
    return true;
  }
  moveDeco(sub, i, x, y) {
    const d = this.decoRoom(sub)?.[i];
    if (!d) return false;
    d.x = Math.round(x); d.y = Math.round(y); // färgen (d.c), rotationen (d.r) och fx följer med
    this.save();
    return true;
  }
  // Rotera (🔄): r = 0–3, 0 sparas inte (gamla sparfiler saknar fältet = 0)
  rotateDeco(sub, i, r) {
    const d = this.decoRoom(sub)?.[i];
    if (!d) return false;
    withFlags(d, { fx: d.fx, r });
    this.save();
    return true;
  }
  rotateStorage(idx, r) {
    const it = this.storage[idx];
    if (!it) return false;
    withFlags(it, { fx: it.fx, r });
    this.save();
    return true;
  }
  decoToStorage(sub, i) {
    const list = this.decoRoom(sub);
    const d = list?.[i];
    if (!d || !knownKind(d.k) || this.storage.length >= MAX_STORAGE) return false;
    list.splice(i, 1);
    this.storage.push(withFlags(withColor({ k: d.k, v: d.v }, d.c), d));
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
  // Säljbar = köpt ur katalogen (inte startmöbel)
  sellable(it) { return !!it && !it.fx && !!katalogOf(it.k); }
  sellDeco(sub, i) {
    const list = this.decoRoom(sub);
    const d = list?.[i];
    if (!this.sellable(d)) return false;
    list.splice(i, 1);
    this.money += Math.round(katalogOf(d.k).price / 2);
    this.save();
    return true;
  }
  sellStorage(idx) {
    const it = this.storage[idx];
    if (!this.sellable(it)) return false;
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
