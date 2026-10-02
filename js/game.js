// Speltillståndet för Snabbfilen: klockan, behoven, pengarna, kylskåpet, jobben
// och bostaden. Ingen rendering här – scenerna läser och kommandona ändrar.
import { toast } from './core/ui.js';
import { play } from './core/sound.js';
import { WARDROBE, itemById, legacyKeyToId } from './data/wardrobe.js';

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

// RÅVAROR (Carl 2026-10-01: "laga mat hemma, köpa frukten inne på affären, lära sig recept i en
// bok"): köps i mataffären (fruktlådorna, mejerikylarna, bageriet, hyllorna och frysen – platserna
// står i shop-mat.js) och hamnar i skafferiet hemma (g.skafferi). raw = mätthet om man äter den
// som den är (0 = går inte att äta rå). id:n får aldrig byta namn (sparfilen).
export const RAVAROR = [
  // frukt och grönt (fruktlådorna)
  { id: 'applR', icon: '🍎', name: 'Rött äpple', price: 6, raw: 8 }, { id: 'applG', icon: '🍏', name: 'Grönt äpple', price: 6, raw: 8 },
  { id: 'apels', icon: '🍊', name: 'Apelsin', price: 7, raw: 8 }, { id: 'banan', icon: '🍌', name: 'Banan', price: 5, raw: 10 },
  { id: 'citron', icon: '🍋', name: 'Citron', price: 6, raw: 0 }, { id: 'druva', icon: '🍇', name: 'Vindruvor', price: 15, raw: 10 },
  { id: 'paron', icon: '🍐', name: 'Päron', price: 7, raw: 8 }, { id: 'kiwi', icon: '🥝', name: 'Kiwi', price: 6, raw: 6 },
  { id: 'avokado', icon: '🥑', name: 'Avokado', price: 14, raw: 0 }, { id: 'tomat', icon: '🍅', name: 'Tomat', price: 5, raw: 4 },
  { id: 'paprika', icon: '🫑', name: 'Paprika', price: 10, raw: 4 }, { id: 'lime', icon: '🍋', name: 'Lime', price: 6, raw: 0 },
  { id: 'melon', icon: '🍈', name: 'Melon', price: 25, raw: 15 }, { id: 'vmelon', icon: '🍉', name: 'Vattenmelon', price: 35, raw: 20 },
  { id: 'ananas', icon: '🍍', name: 'Ananas', price: 25, raw: 15 }, { id: 'potatis', icon: '🥔', name: 'Potatis', price: 4, raw: 0 },
  { id: 'lok', icon: '🧅', name: 'Gul lök', price: 4, raw: 0 }, { id: 'morot', icon: '🥕', name: 'Morot', price: 4, raw: 5 },
  { id: 'plommon', icon: '🍑', name: 'Plommon', price: 6, raw: 6 }, { id: 'persika', icon: '🍑', name: 'Persika', price: 8, raw: 8 },
  { id: 'granat', icon: '🍎', name: 'Granatäpple', price: 18, raw: 8 }, { id: 'champ', icon: '🍄', name: 'Champinjoner', price: 12, raw: 0 },
  { id: 'aubergine', icon: '🍆', name: 'Aubergine', price: 12, raw: 0 }, { id: 'rodlok', icon: '🧅', name: 'Rödlök', price: 5, raw: 0 },
  // mejeri (kylarna), bageri, hyllorna och frysen
  { id: 'agg', icon: '🥚', name: 'Ägg', price: 28, raw: 0 }, { id: 'mjolk', icon: '🥛', name: 'Mjölk', price: 14, raw: 6 },
  { id: 'ost', icon: '🧀', name: 'Ost', price: 35, raw: 8 }, { id: 'smor', icon: '🧈', name: 'Smör', price: 30, raw: 0 },
  { id: 'yoghurt', icon: '🥣', name: 'Yoghurt', price: 18, raw: 14 },
  { id: 'brod', icon: '🍞', name: 'Limpa', price: 25, raw: 12 }, { id: 'tortilla', icon: '🫓', name: 'Tortillabröd', price: 22, raw: 6 },
  { id: 'pasta', icon: '🍝', name: 'Pasta', price: 15, raw: 0 }, { id: 'ris', icon: '🍚', name: 'Ris', price: 18, raw: 0 },
  { id: 'mjol', icon: '🌾', name: 'Vetemjöl', price: 12, raw: 0 }, { id: 'havre', icon: '🥣', name: 'Havregryn', price: 15, raw: 0 },
  { id: 'krossade', icon: '🥫', name: 'Krossade tomater', price: 10, raw: 0 }, { id: 'bonor', icon: '🫘', name: 'Bönor', price: 12, raw: 0 },
  { id: 'fisk', icon: '🐟', name: 'Fiskfilé', price: 45, raw: 0 }, { id: 'bar', icon: '🫐', name: 'Frysta bär', price: 25, raw: 6 },
  // kött och kyckling (Carl 2026-10-01: "glöm inte kyckling och kött") – i frysen
  { id: 'kyckling', icon: '🍗', name: 'Kycklingfilé', price: 55, raw: 0 }, { id: 'kottfars', icon: '🥩', name: 'Köttfärs', price: 50, raw: 0 },
  { id: 'bacon', icon: '🥓', name: 'Bacon', price: 30, raw: 0 },
];
export const ravaraOf = (id) => RAVAROR.find((r) => r.id === id) || null;
// en vara i mataffären: färdigmat (FOOD) eller råvara (RAVAROR)
export const varaOf = (id) => foodOf(id) || ravaraOf(id);

// RECEPTEN i receptboken som ligger vid spisen från början (Pixelstadens kokbok). Man lär sig
// ett recept genom att läsa det i boken (en kvart); KLASSIKER kan man redan. min = speltid vid
// spisen, fill = mätthet, glad = lycka (högst +10 om dagen från maten), energi = ork.
// Kockvanan: lagar man samma rätt flera gånger blir den godare (KOCK_STEG: 3 och 6 gånger → +10 %
// och +20 % mätthet, och en extra lyckopoäng på varje steg).
export const RECEPT = [
  { id: 'fruktsallad', icon: '🥗', name: 'Fruktsallad', ing: ['applR', 'banan', 'apels'], min: 15, fill: 28, glad: 2, energi: 2, blurb: 'Skär frukten i bitar och blanda i en skål. Snabbt och fräscht!' },
  { id: 'omelett', icon: '🍳', name: 'Omelett', ing: ['agg', 'ost', 'tomat'], min: 15, fill: 38, glad: 1, energi: 0, blurb: 'Vispa äggen, häll i stekpannan och strö över ost och tomat.' },
  { id: 'ostmacka', icon: '🥪', name: 'Lyxig ostmacka', ing: ['brod', 'smor', 'ost', 'paprika'], min: 10, fill: 32, glad: 1, energi: 0, blurb: 'Tjocka skivor limpa, smör, ost och knaprig paprika.' },
  { id: 'pannkakor', icon: '🥞', name: 'Pannkakor med bär', ing: ['mjol', 'agg', 'mjolk', 'bar'], min: 30, fill: 50, glad: 3, energi: 0, blurb: 'Vispa smeten, stek tunna pannkakor och toppa med bär.' },
  { id: 'grot', icon: '🥣', name: 'Havregrynsgröt', ing: ['havre', 'mjolk', 'applR'], min: 10, fill: 35, glad: 1, energi: 5, blurb: 'Koka gryn och mjölk, riv i ett äpple. Bästa frukosten.' },
  { id: 'smoothie', icon: '🥤', name: 'Bärsmoothie', ing: ['banan', 'bar', 'yoghurt'], min: 5, fill: 22, glad: 2, energi: 6, blurb: 'Allt i mixern – brrrr – och i ett stort glas.' },
  { id: 'pastapomodoro', icon: '🍝', name: 'Pasta pomodoro', ing: ['pasta', 'krossade', 'lok', 'ost'], min: 30, fill: 60, glad: 2, energi: 0, blurb: 'Fräs löken, häll i tomaterna, koka pastan och riv ost över.' },
  { id: 'potatissoppa', icon: '🍲', name: 'Potatissoppa', ing: ['potatis', 'lok', 'morot', 'smor'], min: 40, fill: 55, glad: 2, energi: 2, blurb: 'Koka grönsakerna mjuka och mixa till en len soppa.' },
  { id: 'tacos', icon: '🌮', name: 'Tacos', ing: ['tortilla', 'kottfars', 'tomat', 'ost'], min: 30, fill: 66, glad: 4, energi: 0, blurb: 'Stek köttfärsen med kryddor, fyll tortillan med tomat och ost. Fredagsmys!' },
  { id: 'kottbullar', icon: '🍖', name: 'Köttbullar med potatis', ing: ['kottfars', 'agg', 'potatis', 'smor'], min: 45, fill: 72, glad: 4, energi: 2, blurb: 'Rulla små bullar, stek dem gyllene och koka potatis. Mormors favorit.' },
  { id: 'kottfarssas', icon: '🍝', name: 'Spaghetti och köttfärssås', ing: ['pasta', 'kottfars', 'krossade', 'lok'], min: 40, fill: 72, glad: 3, energi: 2, blurb: 'Bryn färsen med löken, låt såsen puttra och koka pastan.' },
  { id: 'chili', icon: '🌶️', name: 'Chili con carne', ing: ['kottfars', 'bonor', 'krossade', 'lok'], min: 45, fill: 68, glad: 2, energi: 3, blurb: 'Färs, bönor och tomat som puttrar länge. Lite starkt!' },
  { id: 'kycklingris', icon: '🍗', name: 'Kyckling med ris', ing: ['kyckling', 'ris', 'paprika'], min: 30, fill: 66, glad: 3, energi: 3, blurb: 'Stek kycklingen med paprika och servera med ris.' },
  { id: 'ugnskyckling', icon: '🍗', name: 'Ugnskyckling med potatis', ing: ['kyckling', 'potatis', 'citron', 'smor'], min: 50, fill: 74, glad: 4, energi: 3, blurb: 'Kyckling och potatisklyftor i ugnen med citron och smör.' },
  { id: 'kycklingwrap', icon: '🌯', name: 'Kycklingwrap', ing: ['kyckling', 'tortilla', 'tomat', 'ost'], min: 20, fill: 55, glad: 3, energi: 0, blurb: 'Stekt kyckling, tomat och ost i en rullad tortilla.' },
  { id: 'carbonara', icon: '🍝', name: 'Pasta carbonara', ing: ['pasta', 'bacon', 'agg', 'ost'], min: 25, fill: 68, glad: 4, energi: 0, blurb: 'Knaprig bacon, äggula och ost blandas med den varma pastan.' },
  { id: 'bonchili', icon: '🫘', name: 'Bönchili', ing: ['bonor', 'krossade', 'paprika', 'lok'], min: 35, fill: 54, glad: 2, energi: 2, blurb: 'Chili utan kött – bönor, paprika och tomat.' },
  { id: 'hempizza', icon: '🍕', name: 'Hemgjord pizza', ing: ['mjol', 'krossade', 'ost', 'champ'], min: 50, fill: 72, glad: 4, energi: 0, blurb: 'Kavla degen, bred på tomat, ost och svamp – in i ugnen!' },
  { id: 'fiskpotatis', icon: '🐟', name: 'Ugnsfisk med potatis', ing: ['fisk', 'potatis', 'citron', 'smor'], min: 45, fill: 68, glad: 3, energi: 3, blurb: 'Fisken i ugnen med citron och smör, kokt potatis bredvid.' },
  { id: 'svamprisotto', icon: '🍚', name: 'Svamprisotto', ing: ['ris', 'champ', 'lok', 'ost'], min: 40, fill: 62, glad: 3, energi: 0, blurb: 'Rör i riset tills det är krämigt, stek svampen gyllene.' },
  { id: 'wok', icon: '🥘', name: 'Grönsakswok', ing: ['ris', 'paprika', 'morot', 'aubergine'], min: 30, fill: 56, glad: 2, energi: 3, blurb: 'Het panna, snabba tag – grönsakerna ska knastra.' },
  { id: 'guacamole', icon: '🥑', name: 'Guacamole med chips', ing: ['avokado', 'lime', 'tomat', 'rodlok', 'tortilla'], min: 15, fill: 30, glad: 3, energi: 0, blurb: 'Mosa avokadon med lime, tomat och rödlök. Ugnsrosta tortillan till chips.' },
  { id: 'appelkaka', icon: '🥧', name: 'Äppelkaka', ing: ['applG', 'mjol', 'smor', 'agg'], min: 50, fill: 34, glad: 6, energi: 0, blurb: 'Smuldeg, äppelklyftor och in i ugnen. Det doftar i hela huset!' },
  { id: 'tropisk', icon: '🍍', name: 'Tropisk fruktskål', ing: ['ananas', 'melon', 'kiwi', 'granat'], min: 15, fill: 40, glad: 4, energi: 3, blurb: 'Ananas, melon, kiwi och granatäppelkärnor – som semester.' },
];
export const KLASSIKER = ['fruktsallad', 'omelett', 'ostmacka'];
export const RECEPT_LAS_MIN = 15;
// Kockvanan per rätt: så många lagade portioner av den ger ★★ och ★★★ (+10 % / +20 % mätthet)
export const KOCK_STEG = [5, 15];
export const receptOf = (id) => RECEPT.find((r) => r.id === id) || null;
export const kockStjarnor = (n) => 1 + KOCK_STEG.filter((s) => (n | 0) >= s).length;   // 1–3 stjärnor
// Kocknivån (Carl 2026-10-01: "ju mer man lagat mat desto mer mättnad och bättre blir man som
// kock"): alla lagade portioner tillsammans (g.kockPortioner) → titel och +5 % mätthet per nivå
export const KOCK_TITLAR = ['Nybörjarkock', 'Hemmakock', 'Kökschef', 'Mästerkock', 'Stjärnkock'];
export const KOCK_NIVA_P = [0, 10, 30, 70, 150];
export const kockNiva = (p) => KOCK_NIVA_P.filter((x) => (p | 0) >= x).length;           // 1–5
// Portionerna (Carl: "storkok som är 5X portioner på en gång och megakok som är 10X – då ska man
// också ha råvarorna för det"): råvarorna × n och lite längre tid vid spisen (tid). En portion
// äter man direkt, resten blir matlådor i kylskåpet (g.matlador, högst MAX_MATLADOR).
export const PORTIONER = [
  { id: 'vanlig', n: 1, icon: '🍽️', name: 'Vanlig', tid: 1 },
  { id: 'storkok', n: 5, icon: '🍲', name: 'Storkok', tid: 1.5 },
  { id: 'megakok', n: 10, icon: '🏭', name: 'Megakok', tid: 2 },
];
export const portionOf = (n) => PORTIONER.find((p) => p.n === (n | 0) || p.id === n) || PORTIONER[0];
export const MAX_MATLADOR = 30;
export const MAX_RAVA = 40;               // högst så många av varje råvara i skafferiet (räcker till ett megakok)

// TRÄDGÅRDEN (Carl 2026-10-01: "vi fixar odla i trädgården"): bostäder med en uteplats har
// odlingsbäddar – husvagnen pallkragar på tomten, radhuset och villan i trädgården, takvåningen
// krukor på terrassen (js/scenes/tradgard.js). Så (fröpåsen kostar fro), vattna varje dag, skörda
// när det är moget – skörden hamnar i skafferiet och lagas till mat vid spisen. En bädd växer en dag
// per natt om den vattnades under dagen; två torra dygn i rad och den vissnar. Regniga dagar vattnar
// allt. Villans äppelträd ger äpplen var TRAD_DAGAR:e dag.
export const GRODOR = [
  { id: 'potatis', name: 'Potatis', icon: '🥔', dagar: 4, skord: [4, 6], fro: 15 },
  { id: 'morot', name: 'Morötter', icon: '🥕', dagar: 3, skord: [4, 6], fro: 10 },
  { id: 'lok', name: 'Gul lök', icon: '🧅', dagar: 3, skord: [3, 5], fro: 8 },
  { id: 'rodlok', name: 'Rödlök', icon: '🧅', dagar: 3, skord: [3, 5], fro: 8 },
  { id: 'tomat', name: 'Tomater', icon: '🍅', dagar: 5, skord: [3, 6], fro: 12 },
  { id: 'paprika', name: 'Paprika', icon: '🫑', dagar: 5, skord: [2, 4], fro: 14 },
];
export const grodaOf = (id) => GRODOR.find((x) => x.id === id) || null;
export const TRADGARD = {
  husvagn: { beds: 3, namn: 'Tomten', icon: '🚐' },
  radhus: { beds: 6, namn: 'Trädgården', icon: '🏡' },
  villa: { beds: 8, namn: 'Trädgården', icon: '🏡', trad: true },
  takvaning: { beds: 4, namn: 'Terrassen', icon: '🏙️' },
};
export const tradgardOf = (home) => TRADGARD[home] || null;
export const TRAD_DAGAR = 3;

// Jobben. wage = kr per rätt, oops = avdrag per fel, bonus = kr per färdig låda (packjobb).
// nattoppet = passen går även efter 20 (flygplatsen stänger aldrig), back = scenen man
// står kvar i efter passet (annars staden).
export const JOBS = {
  flygplats: { id: 'flygplats', icon: '✈️', name: 'Flygplatsen', verb: 'Bär väskorna till rätt vagn', wage: 7, oops: 4, nattoppet: true, back: 'terminal' },
  incheckning: { id: 'incheckning', icon: '🛄', name: 'Incheckningen', verb: 'Checka in resenärerna vid disk 3', wage: 18, oops: 5, nattoppet: true, back: 'terminal' },
  frukt: { id: 'frukt', icon: '🍊', name: 'Fruktfabriken', verb: 'Plocka frukt från bandet till lådan', wage: 4, oops: 3, bonus: 20 },
  burgare: { id: 'burgare', icon: '🍔', name: 'Burgarbaren', verb: 'Servera rätt mat till rätt kund', wage: 10, oops: 5 },
  pizzeria: { id: 'pizzeria', icon: '🍕', name: 'Pizzerian', verb: 'Baka rätt pizza och servera rätt kund', wage: 20, oops: 8 },
  posten: { id: 'posten', icon: '📮', name: 'Posten', verb: 'Sortera paketen till rätt rullbur', wage: 10, oops: 5 },
  bensinmack: { id: 'bensinmack', icon: '⛽', name: 'Pixelmacken', verb: 'Tanka bilarna och sälj korv i kiosken', wage: 10, oops: 5 },
  bilverkstad: { id: 'bilverkstad', icon: '🔧', name: 'Bilverkstan', verb: 'Byt däck steg för steg och laga bilarna', wage: 12, oops: 5 },
  tvatteri: { id: 'tvatteri', icon: '🧺', name: 'Tvätteriet', verb: 'Tvätta, torka, vik och lämna rätt påse', wage: 16, oops: 6 },
  kafe: { id: 'kafe', icon: '☕', name: 'Kaféet', verb: 'Gör rätt dryck och servera rätt gäst', wage: 14, oops: 6 },
  // Vårdcentralen (Söder, öppet 08–17 enligt huset i map.js): receptionen. bonus = kr per
  // akutfall som tas emot FÖRST (stats.boxes); bonusPer/boxLabel är raderna i passdialogerna.
  // En patient som tröttnar och går hem räknas som missad (stats.miss, egen rad) men kostar inget
  // (Carl 2026-09-29: missad = 0 kr) – shift.js kan fortfarande dra missOops om ett jobb vill.
  vard: { id: 'vard', icon: '🏥', name: 'Vårdcentralen', verb: 'Ta emot patienterna och skicka dem rätt', wage: 13, oops: 5, bonus: 10, bonusPer: 'akutfall först', boxLabel: '🚑 Akutfall först' },
  kok: { id: 'kok', icon: '🍳', name: 'Burgarköket', verb: 'Bygg rätterna som beställs i köket', wage: 11, oops: 5 },
  // de utbildade jobben i downtown: kraver = kursen på Pixelhögskolan som måste vara klar
  datorbygge: { id: 'datorbygge', icon: '🖥️', name: 'Pixel Data', verb: 'Bygg datorerna precis som beställningen säger', wage: 12, oops: 6, bonus: 25, bonusPer: 'färdig dator', boxLabel: '🖥️ Färdiga datorer', kraver: 'datorteknik' },
  finans: { id: 'finans', icon: '📈', name: 'Finanshuset', verb: 'Köp och sälj aktierna åt kunderna i rätt läge', wage: 26, oops: 12, kraver: 'ekonomi' },
};
// Pixelhögskolan (universitetet i downtown). En kurs = terminsavgift → föreläsningar
// (2 timmar var, högst en per kurs och dag) → tenta i biblioteket (minst 2 rätt av 3).
// Examen öppnar det utbildade jobbet (job). Underkänd = omtenta tidigast nästa dag.
export const COURSES = {
  datorteknik: { id: 'datorteknik', icon: '💻', name: 'Datorteknik', fee: 600, lectures: 4, job: 'datorbygge',
    blurb: 'Processorer, minnen, grafikkort och nätaggregat – lär dig bygga datorer som ett proffs.' },
  ekonomi: { id: 'ekonomi', icon: '📊', name: 'Ekonomi', fee: 900, lectures: 4, job: 'finans',
    blurb: 'Aktier, kurser och budget – köp billigt, sälj dyrt och håll koll på kunderna.' },
  // (inget eget jobb: examen krävs för att bli biträdande chef och chef – ROLLER nedan)
  ledarskap: { id: 'ledarskap', icon: '🧭', name: 'Ledarskap', fee: 800, lectures: 3, job: null,
    blurb: 'Leda ett lag, lägga schema, ta hand om kunderna och hålla budgeten – för dig som vill bli chef.' },
};
export const courseOf = (id) => COURSES[id] || null;
export const JOB_TITLES = ['Nybörjare', 'Van', 'Proffs', 'Mästare', 'Legendar'];
export const levelOf = (shifts) => Math.min(5, 1 + Math.floor(shifts / 3));
export const payMult = (level) => 1 + 0.15 * (level - 1);
// KARRIÄRSTEGARNA (djupförslaget, Carl 2026-10-02 "fortsätt med allt"): på varje arbetsplats kan man
// söka sig uppåt – Medarbetare → Skiftledare → Biträdande chef → Chef. Varje steg kräver vana (titeln
// på jobbet, JOB_TITLES), de två översta examen i Ledarskap på Pixelhögskolan, chefen dessutom några
// pass som biträdande chef – och rätt kläder när man söker (klädkoden, kollas på intervjun i
// js/core/karriar.js). Rollen ger lönelyft (lon), ett eget beslut inför passet (js/jobs/shift.js:
// skiftledare väljer fokus, chefen även priserna) och för de två översta en veckolön på måndagen –
// om man jobbat minst CHEF_PASS pass där veckan som gick. g.roller[jobb] = rollens index.
export const ROLLER = [
  { id: 'medarb', namn: 'Medarbetare', icon: '👕', lon: 1 },
  { id: 'skift', namn: 'Skiftledare', icon: '📋', lon: 1.2, niva: 3, klader: 'prydlig' },
  { id: 'bitr', namn: 'Biträdande chef', icon: '🗂️', lon: 1.4, niva: 4, kurs: 'ledarskap', klader: 'skjorta', veckolon: 150 },
  { id: 'chef', namn: 'Chef', icon: '👔', lon: 1.7, niva: 5, kurs: 'ledarskap', passIRoll: 3, klader: 'kavaj', veckolon: 400 },
];
export const CHEF_PASS = 2;
// klädkoderna (look.top – plaggen i js/core/people/tops.js, säljs i klädaffären)
const SLAPPT = ['tank', 'crop', 'tube', 'vest', 'pyjamas', 'bathrobe', 'robe', 'vampire', 'pirate', 'santa', 'armor', 'astronaut', 'hero', 'lucia'];
const SKJORTA = ['shirt', 'oxford', 'blouse', 'polo', 'flannel', 'western', 'bowling', 'workshirt', 'waistcoat', 'slipover', 'vsweater', 'turtleneck', 'cardigan', 'peplum', 'wrap', 'blazer', 'suit', 'tuxedo', 'chef', 'doctor', 'nurse', 'pilot', 'police'];
const KAVAJ = ['suit', 'blazer', 'waistcoat', 'tuxedo'];
export const KLADKOD = {
  prydlig: { namn: 'prydliga kläder', tips: 'inget linne, ingen magtröja, inga pyjamas eller maskeradkläder', ok: (top) => !SLAPPT.includes(top || 'tee') },
  skjorta: { namn: 'skjorta eller blus', tips: 'skjorta, blus, piké, kofta, stickad väst – eller arbetskläder som kockrock', ok: (top) => SKJORTA.includes(top) },
  kavaj: { namn: 'kavaj eller kostym', tips: 'kavaj med slips, blazer, kostymväst eller smoking', ok: (top) => KAVAJ.includes(top) },
};
export const rollOf = (g, jobId) => ROLLER[Math.max(0, Math.min(ROLLER.length - 1, g.roller?.[jobId] | 0))];
// PASSET EFTER VANAN (Carl 2026-09-30: "allteftersom man har jobbat ska fler kunder komma och
// tiden bli lite längre … fler stolar, kunderna ska ha samma timer"). Nivån (levelOf) styr:
//   seconds  passets längd i verkliga sekunder: 60 s som nybörjare, +8 % per nivå (Legendar 79 s)
//   pace     gånger väntetiden mellan nya kunder – 1 som nybörjare, Legendar 0,58 (72 % fler);
//            kundernas tålamod är detsamma (scenerna räknar det mot passets andel, t / seconds)
//   extra    extra platser (bord, stolar, fack …) som öppnas: nivå − 1, var scen tar vad den har
// En van (nivå 2+) väljer vid passets början VANLIGT eller LÄNGRE pass (1,5 × tiden: 6 timmar
// speltid, mer ork går åt). Jobbar man ihop bestämmer den som bjöd in – nivån och längden
// följer med inbjudan, så en van kan ta med en nybörjare på ett långt pass.
export const LONG_SHIFT = 1.5;
export const canLongShift = (level) => level >= 2;
export function shiftPlan(level = 1, len = 'vanligt') {
  const lvl = Math.max(1, Math.min(5, level | 0 || 1)), long = len === 'langt';
  const k = long ? LONG_SHIFT : 1;
  return {
    lvl, len: long ? 'langt' : 'vanligt',
    seconds: Math.round(60 * (1 + 0.08 * (lvl - 1)) * k),
    gameMin: Math.round(240 * k),
    pace: 1 / (1 + 0.18 * (lvl - 1)),
    extra: lvl - 1,
    energy: Math.round(35 * k),
  };
}

// Klädaffärens FÖRSTA sortiment (före klädkatalogen): de 23 plaggen med gamla nycklar
// 'kind:v' (kind/v = look-fälten i people.js). Allt som säljs i dag står i klädkatalogen
// js/data/wardrobe.js, där de här plaggen har samma pris och nyckeln i `legacy`. Listan finns
// kvar för gamla sparfiler och för kod som fortfarande frågar med 'kind:v' (clothesLocked,
// buyClothes – t.ex. hörlurarna i elektronikbutiken).
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
const isSortimentKey = (k) => SORTIMENT.some((s) => clothesKey(s.kind, s.v) === k);

// Garderoben (g.wardrobe) sparar klädkatalogens id ('top-hoodie-camo'). Ett plagg ur det
// första sortimentet står dessutom kvar med sin gamla nyckel som alias ('top-hoodie' +
// 'top:hoodie'), så att en äldre version av spelet – och kod som frågar efter 'kind:v' –
// fortfarande känner igen det. Gamla sparfiler migreras vid laddning: 'hat:cap' ⇒ + 'hat-cap'.
// Katalog-id för en nyckel (katalog-id eller gammal 'kind:v'), annars null
const wardrobeIdOf = (k) => (typeof k !== 'string' ? null : itemById(k) ? k : legacyKeyToId(k));
function wardrobeKeys(list) {
  const out = new Set();
  for (const k of list) {
    const id = wardrobeIdOf(k);
    if (id) { out.add(id); const old = itemById(id).legacy; if (old) out.add(old); }
    else if (isSortimentKey(k)) out.add(k); // gammal nyckel utan katalogpost (finns inga i dag)
  }
  return [...out];
}

// Möbelkatalogen (köps på MÖBELJÄTTEN, hamnar i förrådet och placeras hemma
// med Möblera-läget). Fälten:
//   vars      antal färg-/modellvarianter i spriteatlasen (nyckel = kind + index)
//   room      avdelningen i varuhuset: VARDAGSRUM/SOVRUM/KÖK/BADRUM/BARNRUM/KONTOR/HALL/ÖVRIGT
//   wall      hänger på bakväggen (ingen hinderyta, ritas bakom allt på golvet)
//   overWindow väggsak som får hänga över fönstren (gardiner) – andra väggsaker får det inte
//   function  vad man kan göra vid möbeln hemma: sova, garderob, ata (öppna kylskåpet),
//             laga (spisen: laga mat ur receptboken), toalett, tvatta, tv (titta eller musik),
//             musik (skivsamlingen: sätt på en låt, js/core/hemmusik.js) – funktionen följer
//             möbeln vart den än står
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
  { kind: 'skivor', icon: '💿', name: 'Skivsamling', price: 400, vars: 2, room: 'VARDAGSRUM', function: 'musik' },
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
  { kind: 'koksspis', icon: '🍳', name: 'Köksspis', price: 1600, vars: 2, room: 'KÖK', function: 'laga' },
  { kind: 'kyl', icon: '🧊', name: 'Kylskåp', price: 1800, vars: 6, room: 'KÖK', function: 'ata' },
  { kind: 'dryckeskyl', icon: '🥤', name: 'Dryckeskyl', price: 2200, vars: 1, room: 'KÖK' },
  { kind: 'kokso', icon: '🥘', name: 'Köksö med ugn', price: 2400, vars: 4, room: 'KÖK', function: 'laga' },
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
// receptbok = Pixelstadens kokbok på sitt ställ vid spisen (laga mat hemma, Carl 2026-10-01)
export const FX_KINDS = { kylskap: 'ata', dass: 'toalett', vaxt: null, receptbok: 'recept' };
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

// Prylarna i elektronikbutiken BLIXT (js/scenes/shop-elektronik.js): telefoner och
// surfplattor. De ställs inte ut hemma som möbler – man bär dem med sig (g.gadgets = lista
// med id, varje modell en gång). Nyttan (bonus) följer modellen – dyrare pryl, mer nytta:
//   mobil  – väckarklockan: +bonus energi när man vaknar i sin säng
//   platta – kvällsserien: +bonus energi om man lägger sig efter 20:00
// Har man flera av samma sort räknas den bästa (gadgetBonus). (Datorsakerna – TV, dator,
// laptop, konsol … – är vanliga möbler i KATALOG som säljs där, se ELEKTRONIK i
// js/scenes/ikea/kat.js.)
export const GADGETS = [
  { id: 'fonmini', kind: 'mobil', icon: '📱', name: 'Blixtfon Mini', price: 900, bonus: 3 },
  { id: 'fon12', kind: 'mobil', icon: '📱', name: 'Blixtfon 12', price: 1900, bonus: 5 },
  { id: 'paronfon', kind: 'mobil', icon: '📱', name: 'Päronfon 16 Pro', price: 4500, bonus: 8 },
  { id: 'platta', kind: 'platta', icon: '📲', name: 'Blixtplatta', price: 1500, bonus: 4 },
  { id: 'paronplatta', kind: 'platta', icon: '📲', name: 'Päronplatta Pro', price: 3900, bonus: 7 },
];
export const gadgetOf = (id) => GADGETS.find((x) => x.id === id) || null;

// FORDONEN (Carl 2026-10-01: "köpa cykel, elsparkcykel och moppe"): säljs i GARAGET i förorten
// (js/scenes/shop-fordon.js), ritas av js/core/fordon-art.js. I staden åker man med 🚲-knappen och
// kommer fram fortare: fart × gångfarten (klockan går lika fort, så resan tar mindre speltid).
// g.fordon = [{ id, c }] (en av varje modell, c = färgen), g.akerMed = id som man åker på | null.
// Påhittade modeller – inga riktiga märken. Hjälmen till moppen ingår.
export const FORDON = [
  { id: 'begcykel', typ: 'cykel', icon: '🚲', name: 'Begagnad herrcykel', den: 'herrcykeln', price: 450, fart: 1.5, colors: ['#7a8a6a', '#5a5a7a', '#8a5a4a'], blurb: 'Lite rost och gnisslar i kurvorna – men den rullar!' },
  { id: 'stadscykel', typ: 'cykel', icon: '🚲', name: 'Stadscykel med korg', den: 'stadscykeln', price: 1600, fart: 1.7, colors: ['#3a7bd5', '#d9433b', '#46a35a', '#f4f1ea', '#c65fa0'], blurb: 'Korg, pakethållare, lampa och stänkskärmar. Perfekt till mataffären.' },
  { id: 'elspark', typ: 'spark', icon: '🛴', name: 'Elsparkcykel', den: 'elsparkcykeln', price: 2900, fart: 1.9, colors: ['#2f3440', '#e8e3d6', '#2aa39a'], blurb: 'Stå på och glid tyst genom stan – inga pedaler, bara gasreglaget.' },
  { id: 'racer', typ: 'racer', icon: '🚴', name: 'Racercykel', den: 'racercykeln', price: 3800, fart: 2.1, colors: ['#d9433b', '#1d1714', '#f0b429', '#2aa39a'], blurb: 'Lätt som en fjäder, med böjt styre. Snabbast utan motor.' },
  { id: 'moppe', typ: 'moppe', icon: '🛵', name: 'Moppe', den: 'moppen', price: 8900, fart: 2.6, colors: ['#e0a02a', '#d9433b', '#3a7bd5', '#46a35a', '#1d1714'], blurb: 'Klassisk moped med blank tank, krom och backspegel. Hjälmen ingår. Brum brum!' },
];
export const fordonOf = (id) => FORDON.find((x) => x.id === id) || null;
export const OMLACK = 150;   // måla om ett fordon man redan har

// EGET FÖRETAG: FOODTRUCKEN (djupförslaget steg 3, Carl 2026-10-02 "fortsätt med allt"). Köps i GARAGET
// (shop-fordon.js), står på en av TRUCK_PLATSER i staden (city.js ritar den, klick → js/core/foretag.js).
// Man jobbar själv i luckan (minispelet js/scenes/jobb-truck.js: kunder beställer, man lagar och
// serverar – försäljningen går direkt till en) och anställer personal som håller öppet varje dag
// (truckDag i sleep: kunder × snittpris × marginal − löner). Ryktet (0–5 ★) växer med bra service och
// sjunker med missnöjda kunder och för höga priser. Platshyran dras på måndagen.
export const TRUCK_PRIS = 14900;
export const TRUCK_PLATSER = [
  { id: 'parken', namn: 'Parken vid fontänen', icon: '⛲', x: 862, y: 378, bas: 10, tol: 1, hyra: 300, blurb: 'Familjer, hundägare och joggare – lagom med folk hela dagen.' },
  { id: 'downtown', namn: 'Tjurtorget i downtown', icon: '🐂', x: 1948, y: 360, bas: 15, tol: 1.2, hyra: 650, blurb: 'Kontorsfolk med fickorna fulla – högst hyra men flest kunder.' },
  { id: 'fororten', namn: 'Parkeringen i förorten', icon: '🏚️', x: 3070, y: 376, bas: 7, tol: 0.85, hyra: 150, blurb: 'Billigast hyra – men folk har inte så mycket pengar.' },
];
export const truckPlatsOf = (id) => TRUCK_PLATSER.find((x) => x.id === id) || TRUCK_PLATSER[0];
// menyn: pris = vanligt pris (kr), kost = råvarorna per portion, kraver = uppgraderingen som behövs
export const TRUCK_MENY = [
  { id: 'korv', namn: 'Korv med bröd', icon: '🌭', pris: 25, kost: 7, tid: 1.4 },
  { id: 'dricka', namn: 'Dricka', icon: '🥤', pris: 15, kost: 3, tid: 0 },
  { id: 'burgare', namn: 'Hamburgare', icon: '🍔', pris: 55, kost: 16, tid: 2.6, kraver: 'grill' },
  { id: 'taco', namn: 'Taco', icon: '🌮', pris: 40, kost: 11, tid: 1, kraver: 'tacobar' },
  { id: 'glass', namn: 'Glass', icon: '🍦', pris: 25, kost: 6, tid: 0, kraver: 'frys' },
];
export const truckRattOf = (id) => TRUCK_MENY.find((x) => x.id === id) || null;
export const TRUCK_UPPG = [
  { id: 'grill', namn: 'Stor grill', icon: '🔥', pris: 2500, blurb: 'Hamburgare på menyn – dyrast och godast.' },
  { id: 'tacobar', namn: 'Tacobar', icon: '🌮', pris: 1800, blurb: 'Tacos på menyn – snabba att göra.' },
  { id: 'frys', namn: 'Glassfrys', icon: '🍦', pris: 1500, blurb: 'Glass på menyn – barnen älskar det.' },
  { id: 'markis', namn: 'Randig markis och ljusslinga', icon: '🎪', pris: 1200, blurb: 'Syns på långt håll: 10 % fler kunder.' },
];
export const TRUCK_PRISER = { lag: { namn: 'Låga', mult: 0.8, kunder: 1.25 }, vanlig: { namn: 'Vanliga', mult: 1, kunder: 1 }, hog: { namn: 'Höga', mult: 1.3, kunder: 0.75 } };
export const TRUCK_MAX_PERSONAL = 2;
const TRUCK_NAMN = ['Sanna', 'Omar', 'Lisa', 'Kalle', 'Fatima', 'Jonte', 'Elin', 'Ali', 'Greta', 'Nils', 'Mira', 'Pelle'];
// dagens sökande (samma hela dagen): skicklighet 1–3, dagslön efter skicklighet
export function truckSokande(day) {
  const out = [];
  for (let i = 0; i < 3; i++) {
    const h = Math.abs(Math.sin(day * 12.9898 + i * 78.233) * 43758.5453) % 1;
    const skill = 1 + Math.floor(h * 3);
    out.push({ id: `s${day}-${i}`, namn: TRUCK_NAMN[Math.floor(h * 997 + i * 5) % TRUCK_NAMN.length], skill, lon: [0, 180, 260, 360][skill] });
  }
  return out;
}

// Det gamla slutmålet (före livsmålen): Villan med rejält på fickan. Bara för sparfiler som
// redan klarade det (g.won) – i dag vinner man med livsmålen nedan.
export const WIN_MONEY = 10000;

// LIVSMÅLEN (Carl 2026-10-01, "fortsätt" på förslaget om mer djup): som i Jones in the Fast Lane
// väljer man i början hur högt man siktar i fyra mål – och man har klarat livet i Pixelstaden när
// ALLA fyra är nådda samtidigt. Varje mål har tre nivåer (lätt/normal/svår); g.mal = { rik, lycka,
// utb, karr } med nivåns id. Vad som räknas (malStatus):
//   rik    pengar på fickan + sparkontot
//   lycka  lyckomätaren (g.lycka) just då
//   utb    utbildningspoäng: 1 per föreläsning på Pixelhögskolan, 2 till per examen (två kurser = 12)
//   karr   bästa titeln på något jobb (2 = Van, 3 = Proffs, 5 = Legendar – JOB_TITLES)
export const MAL_NIVAER = [
  { id: 'latt', icon: '🌱', name: 'Lätt' },
  { id: 'normal', icon: '⭐', name: 'Normal' },
  { id: 'svar', icon: '🔥', name: 'Svår' },
];
export const MAL = {
  rik: { id: 'rik', icon: '💰', name: 'Rikedom', latt: 3000, normal: 10000, svar: 25000, blurb: 'Pengar på fickan och på banken.' },
  lycka: { id: 'lycka', icon: '😊', name: 'Lycka', latt: 60, normal: 75, svar: 90, blurb: 'Lyckomätaren – bio, djur, kompisar, ett fint hem och lediga dagar.' },
  utb: { id: 'utb', icon: '🎓', name: 'Utbildning', latt: 4, normal: 6, svar: 12, blurb: 'Pixelhögskolan: 1 poäng per föreläsning, 2 till för en examen.' },
  karr: { id: 'karr', icon: '💼', name: 'Karriär', latt: 2, normal: 3, svar: 5, blurb: 'Bästa titeln på något jobb – jobba många pass på samma ställe.' },
};
export const malNiva = (id) => MAL_NIVAER.find((n) => n.id === id) || MAL_NIVAER[1];
export const malTarget = (key, niva) => MAL[key]?.[malNiva(niva).id] ?? 0;
// hur målet visas: 3 000 kr · 75 · 6 poäng · Proffs
export const malText = (key, v) => (key === 'rik' ? fmt(v) : key === 'karr' ? JOB_TITLES[Math.max(0, Math.min(4, v - 1))] : key === 'utb' ? `${v} poäng` : String(v));
const cleanMal = (m) => (m && typeof m === 'object' ? Object.fromEntries(Object.keys(MAL).map((k) => [k, malNiva(m[k]).id])) : null);

// LYCKAN (g.lycka 0–100, börjar på LYCKA_START): den tredje mätaren bredvid mat och sömn.
//   upp:  bion, husdjuren (klappa/leka, köpa ett djur), kompisar (vara nära, hälsa på), nya kläder
//         och leksaker, TV:n hemma, en ledig dag, ett fint hem och möbler, djur hemma (på morgonen)
//   ner:  vardagen (−3 per natt), varje pass, för många pass samma dag, husvagnen och
//         Förortsettan, att svälta, att somna utmattad och skulder
// Mycket glad (≥ GLAD_HOG) = 5 % dricks på passen och bättre sömn; nere (< GLAD_LAG) = sämre sömn
// och (< GLAD_LON) 10 % lägre lön. Däremellan märks inget – därför börjar man på 60.
export const LYCKA_START = 60, GLAD_HOG = 80, GLAD_LAG = 30, GLAD_LON = 25;
export const gladPayMult = (l) => (l >= GLAD_HOG ? 1.05 : l < GLAD_LON ? 0.9 : 1);
export const gladSleep = (l) => (l >= GLAD_HOG ? 5 : l < GLAD_LAG ? -5 : 0);
// husdjuren hemma (petStore i pets/sim.js) – main.js kopplar in räknaren, game.js importerar inte djuren
let petCount = () => 0;
export const setPetCounter = (fn) => { petCount = typeof fn === 'function' ? fn : () => 0; };

// Pantbanken (js/scenes/shop-pantbank.js): lån mot pant. Pantlånaren lånar ut PANT_RATE av
// katalogpriset mot en möbel ur förrådet. Lånet + PANT_INTEREST ska betalas tillbaka senast
// PANT_DAYS dagar efter lånedagen (till och med den dagen) – annars behåller pantbanken möbeln.
// Att sälja rakt av ger mer (halva katalogpriset, sellStorage) men då är möbeln borta för gott.
// Panterna ligger i g.pant: [{ nr, k, v, c?, r?, lan, skuld, dag, sista }], g.pantNr = senaste kvittonumret.
export const PANT_RATE = 0.4, PANT_INTEREST = 0.2, PANT_DAYS = 7, MAX_PANT = 4;
export const pantLoanOf = (kind) => { const f = katalogOf(kind); return f ? Math.max(1, Math.round(f.price * PANT_RATE)) : 0; };
export const pantDebtOf = (lan) => Math.ceil((Math.round(lan) * (100 + PANT_INTEREST * 100)) / 100 - 1e-9); // heltal, inga flyttalsfel

// Banken (Pixelbanken i finanskvarteret, js/scenes/shop-bank.js): ett sparkonto med ränta
// som betalas ut varje måndag morgon. Pengarna på kontot är trygga – de rörs bara av en
// sak: hyran, och bara när handkassan inte räcker (autogiro), så att man inte hamnar i
// skuld så länge det finns pengar på banken.
// Räntan räknas på det som legat på kontot HELA veckan (veckans lägsta saldo, g.bankMin)
// och på högst BANK_CAP kr – att sätta in på söndagen och ta ut på måndagen ger ingenting.
export const BANK_RATE = 0.02;   // 2 % i veckan, avrundat till hel krona
export const BANK_CAP = 20000;   // räntan räknas på högst så mycket (= högst 400 kr i veckan)
export const BANK_LOG_MAX = 12;  // kontoutdraget: så många händelser sparas (nyast sist)
export const bankInterest = (saldo) => Math.round(Math.min(BANK_CAP, Math.max(0, +saldo || 0)) * BANK_RATE);

// Dagshändelser: slumpas fram på morgonen och gäller hela dagen. Hälften av
// dagarna händer inget alls – då känns händelserna som något speciellt.
export const EVENTS = [
  { id: 'rea', icon: '🏷️', text: 'REA i klädaffären – 25 % på allt i dag!' },
  { id: 'dubbel', icon: '💰', text: 'Extrapass på {job} – dubbel lön i dag!' },
  { id: 'middag', icon: '🍲', text: 'Grannen bjöd på middag i går kväll – mätt och glad!' },
  { id: 'tjuga', icon: '💵', text: 'Du hittade 20 kr på trottoaren!' },
  { id: 'regn', icon: '🌧️', text: 'Ösregn i Pixelstaden – allt tar längre tid ute i dag.' },
];

// Bostäderna: större bostad = insats + högre hyra men bättre sömn (restBonus kan vara
// negativ – husvagnen är kall och Förortsettan högljudd). Ordningen (hyran, billigast först)
// är den som bostadsbyrån och planschväggen visar. Nya spel börjar i husvagnen. Planlösningarna ligger i
// js/scenes/room.js (PLANS/SEEDS), husen i staden i js/city/places.js.
// glad = lyckan varje morgon av att bo där (husvagnen är kall och trång, takvåningen en dröm).
export const HOMES = [
  { id: 'husvagn', icon: '🚐', name: 'Husvagnen', deposit: 0, rent: 150, restBonus: -10, glad: -4, desc: 'En rostig husvagn på tomten i förorten. Billigast i stan – om du tål kylan.' },
  { id: 'hoghus', icon: '🏢', name: 'Förortsettan', deposit: 500, rent: 250, restBonus: -5, glad: -2, desc: 'Ett rum och kök på sjunde våningen i Betongvägen 1. Hissen går ibland.' },
  { id: 'rum', icon: '🛏️', name: 'Lilla rummet', deposit: 0, rent: 350, restBonus: 0, glad: 0, desc: 'En säng, ett kylskåp och en garderob. Men det är ditt.' },
  { id: 'lagenhet', icon: '🏢', name: 'Lägenheten', deposit: 1500, rent: 600, restBonus: 10, glad: 1, desc: 'Riktigt kök, soffa och utsikt över Pixelstaden.' },
  { id: 'radhus', icon: '🏡', name: 'Radhuset', deposit: 4000, rent: 800, restBonus: 15, glad: 2, desc: 'Eget radhus på Söder med en liten trädgård. Grannarna grillar på lördagar.' },
  { id: 'villa', icon: '🏡', name: 'Villan', deposit: 8000, rent: 1000, restBonus: 20, glad: 3, desc: 'Eget hus med trädgård. Hit kan kompisarna komma.' },
  { id: 'takvaning', icon: '🏙️', name: 'Takvåningen', deposit: 20000, rent: 2000, restBonus: 25, glad: 4, desc: 'Högst upp i Tornhuset – terrass med utsikt över hela Pixelstaden.' },
];
// Okänd bostad (t.ex. i en sparfil från en annan version) → Lilla rummet, aldrig husvagnen.
export const homeOf = (id) => HOMES.find((h) => h.id === id) || HOMES.find((h) => h.id === 'rum') || HOMES[0];

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
    this.home = 'husvagn';                // alla börjar i husvagnen (Carl 2026-09-28)
    this.fridge = { nudlar: 1 };          // itemId -> antal
    this.skafferi = {};                   // råvaror hemma (RAVAROR-id -> antal)
    this.recept = [...KLASSIKER];         // recepten man kan (lärda ur receptboken)
    this.kockat = {};                     // lagade portioner per rätt (kockvanan, ★)
    this.kockPortioner = 0;               // alla lagade portioner (kocknivån)
    this.matlador = {};                   // matlådor i kylskåpet: recept-id -> antal (storkok/megakok)
    this.odling = {};                     // trädgårdarna per bostad: { beds: [null | { g, dag, v, vat, torr, vissen }], trad: { skord } }
    this.toys = {};                       // köpta leksaker (Leksakslådan): id -> antal
    this.edu = {};                        // Pixelhögskolan: kurs-id -> { lect, day, tenta, tentaDay, klar }
    this.jobs = Object.fromEntries(Object.keys(JOBS).map((k) => [k, 0])); // antal jobbade pass per jobb
    this.earned = 0;                      // totalt intjänat
    this.wardrobe = [];                   // köpta plagg: katalog-id (+ gamla 'kind:v' som alias, se wardrobeKeys)
    this.storage = [];                    // möbler i förrådet, { k, v, c?, r?, fx? } (c = egen färg '#rrggbb', r = rotation 0–3)
    this.deco = {};                       // placerade möbler per rum: "hem:sub" -> [{ k, v, c?, x, y, r?, fx? }]
    this.gadgets = [];                    // prylar från elektronikbutiken (GADGETS-id), t.ex. ['fon12']
    this.fordon = [];                     // fordonen från garaget: [{ id, c }] (FORDON-id, färg '#rrggbb')
    this.akerMed = null;                  // fordonet man åker på i staden (id) – null = går
    this.festDag = 0;                     // dagen för senaste festen hemma (en om dagen, js/core/fest.js)
    this.fester = 0;                      // fester man har haft
    this.sambo = null;                    // bor ihop (js/net/sambo.js): { key, namn, hem, roll: 'vard'|'inflyttad', hu, sedan, ver, stamp, egen }
    this.roller = {};                     // karriärstegarna: jobb-id → rollens index i ROLLER (0 = medarbetare)
    this.rollPass = {};                   // pass i nuvarande roll per jobb (chefen kräver några som biträdande chef)
    this.veckoPass = {};                  // pass per jobb sedan måndag (veckolönen kräver CHEF_PASS)
    this.sokt = {};                       // dagen man senast sökte befordran per jobb (en intervju om dagen)
    this.truck = null;                    // eget företag: { plats, priser, uppg: [], personal: [{ id, namn, skill, lon }], rykte, kopt, sald, logg: [] }
    this.won = false;                     // slutmålet nått
    this.event = null;                    // dagens händelse { id, job? }
    this.best = Object.fromEntries(Object.keys(JOBS).map((k) => [k, { ok: 0, pay: 0 }])); // rekord per jobb
    this.collapsed = false;               // somnade utmattad i natt (sätts av passTime)
    this.pant = [];                       // möbler som står i pantbanken mot ett lån (se PANT_*)
    this.pantNr = 0;                      // senaste pantkvittots nummer
    this.lott = null;                     // skraplotterna i närbutiken: { salt, dag, n, open, kopt, vunnit } (shop-narbutik.js)
    this.bank = 0;                        // sparkontot på banken (kr) – ränta varje måndag
    this.bankMin = 0;                     // veckans lägsta saldo sedan måndag morgon – räntan räknas på det
    this.bankLog = [];                    // kontoutdraget: { d: dag, m: minut, t: 'in'|'ut'|'atm'|'ranta'|'hyra', n: kr }
    this.lycka = LYCKA_START;             // lyckomätaren 0–100 (se glad)
    this.mal = null;                      // livsmålen { rik, lycka, utb, karr } (nivåernas id) – null = inte valda än
    this.malKlar = 0;                     // dagen då alla livsmål nåddes (0 = inte än)
    this.passIdag = 0;                    // pass jobbade i dag (för många i rad tär på lyckan)
    this.sistaPass = 0;                   // dagen för senaste passet – ingen i dag = ledig dag (+ lycka på natten)
    this.gladNatt = [];                   // vad som ändrade lyckan i natt: [{ t, n }] – visas i veckorutan på morgonen
    Object.defineProperty(this, '_gladDag', { value: { day: 0 }, writable: true, enumerable: false });   // dagens tak per källa (sparas inte)
    Object.defineProperty(this, '_sadMin', { value: 0, writable: true, enumerable: false });             // hungriga minuter mot nästa −1
    Object.defineProperty(this, '_kompisMin', { value: 0, writable: true, enumerable: false });
    Object.defineProperty(this, '_samboSig', { value: null, writable: true, enumerable: false });        // det delade hemmet senast det sparades (bor ihop)          // minuter nära kompisar mot nästa +1
  }

  eventIs(id) { return this.event?.id === id; }

  get dayName() { return DAY_NAMES[(this.day - 1) % 7]; }
  get homeInfo() { return homeOf(this.home); }
  // veckohyran man själv betalar: bor man ihop delas den på två (avrundat uppåt)
  get hyra() { const r = this.homeInfo.rent; return this.sambo && this.sambo.hem === this.home ? Math.ceil(r / 2) : r; }

  // ---------- spara/ladda ----------
  // Sparfilen får aldrig tappa data mellan versioner: det som den här versionen inte
  // förstår (fält, plagg, möbler, jobb, mat från en nyare version) ligger kvar i _keep
  // och skrivs tillbaka orört, så att en äldre flik aldrig raderar något nyare.
  save() {
    try {
      if (this.sambo) this.samboTouch();   // bor ihop: ändrades det delade hemmet? → ny version att synka
      const { _saveIn, collapsed, ...data } = this;
      const k = this._keep;
      const out = { ...(k?.top || {}), v: 1, ...data };
      if (k) {
        out.jobs = { ...k.jobs, ...data.jobs };
        out.best = { ...k.best, ...data.best };
        out.fridge = { ...k.fridge, ...data.fridge };
        out.skafferi = { ...k.skafferi, ...data.skafferi };
        out.wardrobe = [...data.wardrobe, ...k.wardrobe.filter((w) => !data.wardrobe.includes(w))];
        out.storage = [...data.storage, ...k.storage];
        out.gadgets = [...data.gadgets, ...k.gadgets.filter((id) => !data.gadgets.includes(id))];
        out.deco = { ...data.deco };
        for (const [key, list] of Object.entries(k.deco)) out.deco[key] = [...(data.deco[key] || []), ...list];
        if (k.pant?.length) out.pant = [...data.pant, ...k.pant];
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
        const keep = { top: {}, jobs: {}, best: {}, fridge: {}, skafferi: {}, wardrobe: [], storage: [], deco: {}, gadgets: [] };
        Object.defineProperty(g, '_keep', { value: keep, writable: true, enumerable: false });
        for (const [key, val] of Object.entries(p)) if (!(key in g) && !LEGACY_FIELDS.includes(key)) keep.top[key] = val;
        g.day = Math.max(1, p.day | 0); g.min = Math.min(DAY - 1, Math.max(0, +p.min || 0));
        g.money = Math.round(+p.money || 0); g.hunger = clamp(p.hunger); g.energy = clamp(p.energy);
        g.home = homeOf(p.home).id;
        g.toys = {}; for (const [k, v] of Object.entries(p.toys && typeof p.toys === 'object' ? p.toys : {})) if ((v | 0) > 0) g.toys[k] = Math.min(999, v | 0);
        g.edu = {};
        for (const [k, e] of Object.entries(p.edu && typeof p.edu === 'object' ? p.edu : {})) {
          if (!e || typeof e !== 'object') continue;
          const c = COURSES[k];
          if (!c) { g.edu[k] = e; continue; }   // kurs från en nyare version: följer med orörd
          g.edu[k] = { ...e, lect: Math.max(0, Math.min(c.lectures, e.lect | 0)), day: e.day | 0, tenta: Math.max(0, e.tenta | 0), tentaDay: e.tentaDay | 0, klar: !!e.klar };
        }
        g.fridge = {}; for (const [k, v] of Object.entries(p.fridge || {})) { if (!foodOf(k)) keep.fridge[k] = v; else if (v > 0) g.fridge[k] = Math.min(20, v | 0); }
        // köket: råvarorna, recepten man kan och kockvanan (okända id från en nyare version följer med orörda)
        g.skafferi = {};
        for (const [k, v] of Object.entries(p.skafferi && typeof p.skafferi === 'object' ? p.skafferi : {})) { if (!ravaraOf(k)) keep.skafferi[k] = v; else if ((v | 0) > 0) g.skafferi[k] = Math.min(MAX_RAVA, v | 0); }
        if (Array.isArray(p.recept)) g.recept = [...new Set([...KLASSIKER, ...p.recept.filter((id) => typeof id === 'string')])];
        g.kockat = {}; for (const [k, v] of Object.entries(p.kockat && typeof p.kockat === 'object' ? p.kockat : {})) if ((v | 0) > 0) g.kockat[k] = Math.min(9999, v | 0);
        g.kockPortioner = Math.max(0, p.kockPortioner | 0);
        g.matlador = {}; for (const [k, v] of Object.entries(p.matlador && typeof p.matlador === 'object' ? p.matlador : {})) if ((v | 0) > 0) g.matlador[k] = Math.min(MAX_MATLADOR, v | 0);
        // trädgårdarna: bäddar med okänd gröda (från en nyare version) följer med orörda
        g.odling = {};
        for (const [home, gd] of Object.entries(p.odling && typeof p.odling === 'object' ? p.odling : {})) {
          if (!gd || typeof gd !== 'object') continue;
          const beds = (Array.isArray(gd.beds) ? gd.beds : []).slice(0, 12).map((b) => (b && typeof b === 'object' && typeof b.g === 'string'
            ? { ...b, dag: b.dag | 0, v: Math.max(0, b.v | 0), vat: b.vat | 0, torr: Math.max(0, b.torr | 0), vissen: !!b.vissen } : null));
          g.odling[home] = { ...gd, beds, trad: { skord: gd.trad?.skord | 0 } };
        }
        // fordonen: okända modeller (från en nyare version) följer med orörda
        g.fordon = [];
        for (const f of Array.isArray(p.fordon) ? p.fordon : []) {
          if (!f || typeof f !== 'object' || typeof f.id !== 'string' || g.fordon.some((x) => x.id === f.id)) continue;
          const F = fordonOf(f.id);
          g.fordon.push(F ? { ...f, c: /^#[0-9a-f]{6}$/i.test(f.c) ? f.c.toLowerCase() : F.colors[0] } : f);
        }
        g.festDag = Math.max(0, p.festDag | 0); g.fester = Math.max(0, p.fester | 0);
        g.sambo = cleanSambo(p.sambo);
        // karriärstegarna: okända jobb (från en nyare version) följer med orörda
        const counts = (o, max) => Object.fromEntries(Object.entries(o && typeof o === 'object' ? o : {}).filter(([, v]) => (v | 0) > 0).map(([k, v]) => [k, Math.min(max, v | 0)]));
        g.roller = counts(p.roller, ROLLER.length - 1); g.rollPass = counts(p.rollPass, 9999); g.veckoPass = counts(p.veckoPass, 99); g.sokt = counts(p.sokt, 1e7);
        g.truck = cleanTruck(p.truck);
        g.akerMed = typeof p.akerMed === 'string' && fordonOf(p.akerMed) && g.fordon.some((x) => x.id === p.akerMed) ? p.akerMed : null;
        for (const k of Object.keys(g.jobs)) g.jobs[k] = Math.max(0, p.jobs?.[k] | 0);
        for (const [k, v] of Object.entries(p.jobs || {})) if (!(k in g.jobs)) keep.jobs[k] = v;
        for (const [k, v] of Object.entries(p.best || {})) if (!(k in g.best)) keep.best[k] = v;
        g.earned = Math.max(0, +p.earned || 0);
        // plaggen: katalog-id och gamla 'kind:v' (migreras till katalog-id, aliaset står kvar);
        // okända id (plagg från en nyare version) ligger kvar i _keep
        const knownClothes = (k) => !!wardrobeIdOf(k) || isSortimentKey(k);
        const clothes = Array.isArray(p.wardrobe) ? p.wardrobe : [];
        g.wardrobe = wardrobeKeys(clothes);
        keep.wardrobe = clothes.filter((k) => typeof k === 'string' && !knownClothes(k));
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
        // prylarna: kända id (en gång var), okända (från en nyare version) följer med orörda
        const gl = Array.isArray(p.gadgets) ? p.gadgets : [];
        g.gadgets = [...new Set(gl.filter((id) => typeof id === 'string' && gadgetOf(id)))];
        keep.gadgets = gl.filter((id) => !(typeof id === 'string' && gadgetOf(id)));
        // pantbanken: panter med okänd möbel (från en nyare version) följer med orörda
        const okPant = (it) => it && typeof it === 'object' && (it.nr | 0) > 0 && (it.sista | 0) > 0;
        g.pant = (Array.isArray(p.pant) ? p.pant : []).filter((it) => okPant(it) && knownKind(it.k))
          .map((it) => ({ ...cleanItem(it), nr: it.nr | 0, lan: Math.max(0, Math.round(+it.lan || 0)), skuld: Math.max(0, Math.round(+it.skuld || 0)), dag: Math.max(1, it.dag | 0), sista: it.sista | 0 }));
        keep.pant = (Array.isArray(p.pant) ? p.pant : []).filter((it) => okPant(it) && !knownKind(it.k));
        g.pantNr = Math.max(0, p.pantNr | 0, ...g.pant.map((it) => it.nr), ...keep.pant.map((it) => it.nr | 0)); // kvittonumren upprepas aldrig
        if (p.lott && typeof p.lott === 'object') g.lott = p.lott; // skraplotterna tolkas i närbutiken
        g.won = !!p.won;
        g.bank = Math.max(0, Math.round(+p.bank || 0));
        g.bankMin = p.bankMin == null ? g.bank : Math.max(0, Math.min(g.bank, Math.round(+p.bankMin || 0)));
        g.bankLog = (Array.isArray(p.bankLog) ? p.bankLog : []).filter((e) => e && typeof e === 'object').slice(-BANK_LOG_MAX)
          .map((e) => ({ ...e, d: Math.max(1, e.d | 0), m: Math.max(0, Math.min(DAY - 1, e.m | 0)), t: String(e.t || ''), n: Math.max(0, Math.round(+e.n || 0)) }));
        if (p.event && EVENTS.some((e) => e.id === p.event.id)) g.event = { id: p.event.id, job: JOBS[p.event.job] ? p.event.job : undefined };
        // livsmålen och lyckan (sparfiler före livsmålen: lyckan börjar på LYCKA_START, målen väljs)
        g.lycka = p.lycka == null ? LYCKA_START : clamp(p.lycka);
        g.mal = cleanMal(p.mal);
        g.malKlar = Math.max(0, p.malKlar | 0);
        g.sistaPass = Math.max(0, p.sistaPass | 0);
        g.passIdag = g.sistaPass === g.day ? Math.max(0, p.passIdag | 0) : 0;
        g.gladNatt = (Array.isArray(p.gladNatt) ? p.gladNatt : []).filter((x) => x && typeof x === 'object').slice(0, 12)
          .map((x) => ({ t: String(x.t || '').slice(0, 40), n: Math.round(+x.n || 0) }));
        for (const k of Object.keys(g.best)) g.best[k] = { ok: Math.max(0, p.best?.[k]?.ok | 0), pay: Math.max(0, p.best?.[k]?.pay | 0) };
      }
    } catch (err) {
      // Trasig eller för ny sparfil: lägg undan den orörd innan spelet börjar om, så att
      // nästa save() aldrig skriver över det enda exemplaret.
      try { if (rawText) localStorage.setItem(`${SAVE_KEY}_undanlagd_${Date.now()}`, rawText); } catch { /* full */ }
      console.warn('Sparfilen kunde inte läsas och lades undan:', err?.message);
    }
    if (g.sambo) g._samboSig = JSON.stringify(g.samboSnap());   // (att ladda räknas inte som en ändring)
    return g;
  }

  // ---------- tid ----------
  // Låter klockan gå. Mättheten sjunker med tiden; tom mage tär på orken i stället.
  passTime(minutes) {
    this.min += minutes;
    const eaten = Math.min(this.hunger, minutes * HUNGER_PER_MIN);
    this.hunger -= eaten;
    if (this.hunger <= 0) {
      this.energy = Math.max(0, this.energy - (minutes * HUNGER_PER_MIN - eaten) * 0.6);
      // svälta gör en ledsen: −1 lycka per hungrig timme
      this._sadMin += minutes;
      if (this._sadMin >= 60) { const n = Math.floor(this._sadMin / 60); this._sadMin -= n * 60; this.lycka = clamp(this.lycka - n); }
    }
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
    // prylarna: mobilens väckarklocka (sover man i sin säng) och kvällsserien på surfplattan
    // (lägger man sig efter 20:00) – somnar man på gatan (quality < 1) hjälper ingen av dem
    const inBed = quality >= 1, lateEvening = inBed && this.min >= 20 * 60;
    const gadgetBonus = (inBed ? this.gadgetBonus('mobil') : 0) + (lateEvening ? this.gadgetBonus('platta') : 0);
    const igar = this.day;                                                                   // dagen som tar slut (trädgården)
    // lyckan i natt: dagen som gick (ledig eller inte, hungrig, utmattad) och hemmet man vaknar i
    const natt = [];
    const glad = (n, t) => { if (n) natt.push({ t, n }); };
    glad(-3, 'Vardagen');
    if (this.sistaPass !== this.day) glad(6, 'Ledig dag');
    if (quality < 1) glad(-8, 'Somnade utmattad');
    else if (this.hunger <= 10) glad(-3, 'Hungrig i sängen');
    const sleepGlad = gladSleep(this.lycka);                                                // lyckan påverkar sömnen
    this.day += 1;
    this.min = 7 * 60;
    this.passIdag = 0;
    const rested = (55 + 45 * Math.min(1, this.hunger / 50)) * quality + this.homeInfo.restBonus + sleepGlad;
    this.energy = clamp(Math.max(this.energy, Math.round(rested)) + gadgetBonus);
    this.hunger = clamp(this.hunger - 15);
    glad(this.homeInfo.glad || 0, this.homeInfo.name);
    const mobler = this.placedFurniture();
    glad(mobler >= 30 ? 3 : mobler >= 15 ? 2 : mobler >= 5 ? 1 : 0, 'Fint möblerat');
    let pets = 0; try { pets = petCount(this.home) | 0; } catch { pets = 0; }
    glad(Math.min(4, pets * 2), pets === 1 ? 'Djuret hemma' : 'Djuren hemma');
    let rent = 0, interest = 0, rentFromBank = 0, chefslon = [];
    if ((this.day - 1) % 7 === 0 && this.day > 1) { // måndag morgon: räntan på sparkontot, sedan hyran
      interest = bankInterest(Math.min(this.bank, this.bankMin));  // det som legat kvar hela veckan
      if (interest > 0) { this.bank += interest; this.logBank('ranta', interest); }
      chefslon = this.betalaChefslon();                       // veckolönen (karriärstegarna) före hyran
      if (this.truck) { const h = truckPlatsOf(this.truck.plats).hyra; this.money -= h; this.truck.platshyra = h; }   // foodtruckens platshyra
      rent = this.hyra;                                       // (bor man ihop betalar man halva)
      const before = this.money;
      this.money -= rent;
      // Hyran dras först från handkassan. Räcker den inte tar banken resten av HYRAN från
      // sparkontot (autogiro) – skuld blir det bara om kontot också är tomt. En gammal skuld
      // betalas inte automatiskt; den tar man själv hand om (ta ut på banken).
      const short = rent - Math.max(0, before);
      if (short > 0 && this.bank > 0) {
        rentFromBank = Math.min(this.bank, short);
        this.bank -= rentFromBank;
        this.money += rentFromBank;
        this.logBank('hyra', rentFromBank);
      }
      this.bankMin = this.bank;           // en ny räntevecka börjar
    }
    if (this.money < 0) glad(-4, 'Skulder');
    this.lycka = clamp(this.lycka + natt.reduce((a, x) => a + x.n, 0));
    this.gladNatt = natt;
    const odlat = this.growGarden(igar);                                                    // trädgården växer (eller torkar)
    const truckDag = this.truckDag(igar);                                                   // foodtrucken: personalens dag
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
      if (ev.id === 'middag') { this.hunger = clamp(this.hunger + 35); this.lycka = clamp(this.lycka + 3); }
      if (ev.id === 'tjuga') this.money += 20;
      eventText = `${ev.icon} ${ev.text.replace('{job}', JOBS[this.event.job]?.name || '')}`;
    }
    if (this.eventIs('regn')) this.waterGarden(-1, true);                                   // regnet vattnar trädgården
    this.pantMorning();
    this.save();
    return { rent, eventText, gadgetBonus, interest, rentFromBank, odlat, chefslon, truckDag };
  }

  // ---------- eget företag: foodtrucken ----------
  buyTruck() {
    if (this.truck) return { ok: false, msg: 'Du har redan en foodtruck!' };
    if (this.money < TRUCK_PRIS) return { ok: false, msg: `Foodtrucken kostar ${fmt(TRUCK_PRIS)} – du har inte råd än.` };
    this.money -= TRUCK_PRIS;
    this.truck = { plats: 'parken', priser: 'vanlig', uppg: [], personal: [], rykte: 2, kopt: this.day, sald: 0, logg: [] };
    this.glad(6, '', 'truckkop', 6);
    this.save();
    return { ok: true };
  }
  truckMeny() { const T = this.truck; return T ? TRUCK_MENY.filter((m) => !m.kraver || T.uppg.includes(m.kraver)) : []; }
  flyttaTruck(plats) {
    const T = this.truck, P = TRUCK_PLATSER.find((x) => x.id === plats);
    if (!T || !P || T.plats === plats) return false;
    T.plats = plats; this.passTime(30); this.save();
    return true;
  }
  truckPriser(niva) { if (this.truck && TRUCK_PRISER[niva]) { this.truck.priser = niva; this.save(); } }
  buyTruckUppg(id) {
    const T = this.truck, U = TRUCK_UPPG.find((x) => x.id === id);
    if (!T || !U) return { ok: false, msg: 'Finns inte.' };
    if (T.uppg.includes(id)) return { ok: false, msg: 'Den har du redan.' };
    if (this.money < U.pris) return { ok: false, msg: `${U.namn} kostar ${fmt(U.pris)} – du har inte råd.` };
    this.money -= U.pris; T.uppg.push(id); this.save();
    return { ok: true, uppg: U };
  }
  anstall(sokande) {
    const T = this.truck;
    if (!T || !sokande) return { ok: false, msg: 'Ingen att anställa.' };
    if (T.personal.length >= TRUCK_MAX_PERSONAL) return { ok: false, msg: `Det får bara plats ${TRUCK_MAX_PERSONAL} i trucken.` };
    if (T.personal.some((x) => x.id === sokande.id)) return { ok: false, msg: 'Hen jobbar redan hos dig.' };
    T.personal.push({ id: sokande.id, namn: sokande.namn, skill: sokande.skill | 0, lon: sokande.lon | 0 });
    this.save();
    return { ok: true };
  }
  avskeda(id) { const T = this.truck; if (!T) return; T.personal = T.personal.filter((x) => x.id !== id); this.save(); }
  // snittpriset en kund betalar (en rätt + ibland dricka) och marginalen
  truckSnitt() {
    const T = this.truck, M = this.truckMeny().filter((m) => m.id !== 'dricka'), P = TRUCK_PRISER[T?.priser] || TRUCK_PRISER.vanlig;
    if (!T || !M.length) return { pris: 0, kost: 0 };
    const pris = M.reduce((a, m) => a + m.pris, 0) / M.length + 15 * 0.5, kost = M.reduce((a, m) => a + m.kost, 0) / M.length + 3 * 0.5;
    return { pris: pris * P.mult, kost };
  }
  // personalens dag (sleep: dagen som gick). Utan personal är trucken stängd när man inte jobbar själv.
  truckDag(dag) {
    const T = this.truck;
    if (!T || !T.personal.length) return null;
    const P = truckPlatsOf(T.plats), pr = TRUCK_PRISER[T.priser] || TRUCK_PRISER.vanlig;
    const staff = T.personal.reduce((a, x) => a + [0, 0.8, 1, 1.2][x.skill | 0], 0) * (T.personal.length > 1 ? 0.9 : 1);
    // priserna: höga priser skrämmer bort folk där plånböckerna är tunna (tol), låga lockar fler
    const prisK = pr.kunder * (T.priser === 'hog' ? Math.min(1.15, P.tol) : 1);
    const vader = this.eventIs('regn') ? 0.6 : 1;
    const kunder = Math.round(P.bas * (1 + 0.12 * T.rykte) * staff * prisK * (T.uppg.includes('markis') ? 1.1 : 1) * vader);
    const { pris, kost } = this.truckSnitt();
    const intakt = Math.round(kunder * pris), varor = Math.round(kunder * kost), loner = T.personal.reduce((a, x) => a + x.lon, 0);
    const vinst = intakt - varor - loner;
    this.money += vinst; if (vinst > 0) this.earned += vinst;
    T.sald += kunder;
    // ryktet: duktig personal lyfter det långsamt, höga priser sänker det
    const skillSnitt = T.personal.reduce((a, x) => a + (x.skill | 0), 0) / T.personal.length;
    T.rykte = Math.max(0, Math.min(5, T.rykte + (skillSnitt - 1.8) * 0.08 - (T.priser === 'hog' ? 0.06 : 0) + (T.priser === 'lag' ? 0.03 : 0)));
    const rad = { dag, kunder, intakt, varor, loner, vinst, plats: P.id, regn: vader < 1 };
    T.logg = [rad, ...(T.logg || [])].slice(0, 14);
    return rad;
  }
  // ett eget pass i luckan (js/scenes/jobb-truck.js): sald = [rätt-id …] som serverats, arga = missnöjda kunder
  truckPass({ sald = [], fel = 0, arga = 0 } = {}) {
    const T = this.truck;
    if (!T) return null;
    const pr = TRUCK_PRISER[T.priser] || TRUCK_PRISER.vanlig;
    let intakt = 0, varor = 0;
    for (const id of sald) { const m = truckRattOf(id); if (!m) continue; intakt += Math.round(m.pris * pr.mult); varor += m.kost; }
    const vinst = intakt - varor;
    this.money += vinst; if (vinst > 0) this.earned += vinst;
    T.sald += sald.length;
    const fore = T.rykte;
    T.rykte = Math.max(0, Math.min(5, T.rykte + Math.min(0.4, sald.length * 0.025) - (fel + arga) * 0.08));
    this.energy = clamp(this.energy - 30);
    this.passTime(240);
    const glad = this.glad(sald.length >= 8 ? 3 : 1, '', 'truck', 4);
    this.save();
    return { intakt, varor, vinst, rykte: T.rykte, rykteFore: fore, glad };
  }
  saljTruck() {
    if (!this.truck) return 0;
    const kr = Math.round(TRUCK_PRIS * 0.55 + this.truck.uppg.reduce((a, id) => a + (TRUCK_UPPG.find((u) => u.id === id)?.pris || 0) * 0.4, 0));
    this.money += kr; this.truck = null; this.save();
    return kr;
  }

  // ---------- karriärstegarna ----------
  // nästa steg på jobbet och vad som fattas (kläderna kollas på intervjun):
  // { roll, nasta, ok, saknas: [text], soktIdag }
  befordran(jobId) {
    const i = this.roller[jobId] | 0, nasta = ROLLER[i + 1] || null, roll = ROLLER[i];
    if (!nasta) return { roll, nasta: null, ok: false, saknas: [], soktIdag: false };
    const saknas = [];
    const niva = levelOf(this.jobs[jobId] | 0);
    if (niva < nasta.niva) { const kvar = (nasta.niva - 1) * 3 - (this.jobs[jobId] | 0); saknas.push(`titeln ${JOB_TITLES[nasta.niva - 1]} (${kvar} pass till)`); }
    if (nasta.kurs && !this.edu[nasta.kurs]?.klar) saknas.push(`examen i ${COURSES[nasta.kurs]?.name || nasta.kurs} på Pixelhögskolan`);
    if (nasta.passIRoll && (this.rollPass[jobId] | 0) < nasta.passIRoll) saknas.push(`${nasta.passIRoll - (this.rollPass[jobId] | 0)} pass till som ${roll.namn.toLowerCase()}`);
    return { roll, nasta, ok: !saknas.length, saknas, soktIdag: (this.sokt[jobId] | 0) === this.day };
  }
  befordra(jobId) {
    const b = this.befordran(jobId);
    if (!b.ok) return null;
    this.roller[jobId] = (this.roller[jobId] | 0) + 1;
    this.rollPass[jobId] = 0;
    this.glad(6, '', 'befordran', 6);
    this.save();
    return b.nasta;
  }
  // måndag morgon: veckolönen för jobb där man är biträdande chef/chef och jobbat minst CHEF_PASS pass
  betalaChefslon() {
    const out = [];
    for (const [jobId, i] of Object.entries(this.roller)) {
      const R = ROLLER[i | 0];
      if (!R?.veckolon || !JOBS[jobId]) continue;
      const ok = (this.veckoPass[jobId] | 0) >= CHEF_PASS;
      if (ok) { this.money += R.veckolon; this.earned += R.veckolon; }
      out.push({ job: jobId, roll: R.namn, kr: ok ? R.veckolon : 0, pass: this.veckoPass[jobId] | 0 });
    }
    this.veckoPass = {};
    return out;
  }

  // ---------- trädgården ----------
  // trädgården i bostaden (null utan uteplats) – bäddarna skapas tomma första gången
  garden(home = this.home) {
    const T = tradgardOf(home);
    if (!T) return null;
    const gd = (this.odling[home] ||= { beds: [], trad: { skord: 0 } });
    while (gd.beds.length < T.beds) gd.beds.push(null);
    gd.trad ||= { skord: 0 };
    return gd;
  }
  bedState(b) {
    if (!b) return 'tom';
    if (b.vissen) return 'vissen';
    const G = grodaOf(b.g);
    if (G && b.v >= G.dagar) return 'mogen';
    return b.vat === this.day ? 'vattnad' : 'torr';
  }
  plant(idx, gId) {
    const gd = this.garden(), G = grodaOf(gId);
    if (!gd || !G) return { ok: false, msg: 'Här går det inte att odla.' };
    if (gd.beds[idx]) return { ok: false, msg: 'Det växer redan något där.' };
    if (this.money < G.fro) return { ok: false, msg: `Fröpåsen kostar ${fmt(G.fro)} – du har inte råd.` };
    this.money -= G.fro;
    gd.beds[idx] = { g: gId, dag: this.day, v: 0, vat: this.day, torr: 0, vissen: false };   // (man vattnar när man sår)
    this.passTime(10);
    const glad = this.glad(2, '', 'tradgard', 8);
    this.save();
    return { ok: true, groda: G, glad };
  }
  // vattna en bädd (idx) eller alla (idx < 0); regn = utan tid och lycka. Svaret: antal vattnade.
  waterGarden(idx = -1, regn = false) {
    const gd = this.garden();
    if (!gd) return 0;
    let n = 0;
    gd.beds.forEach((b, i) => { if ((idx < 0 || i === idx) && b && !b.vissen && this.bedState(b) !== 'mogen' && b.vat !== this.day) { b.vat = this.day; n++; } });
    if (n && !regn) { this.passTime(Math.min(15, 3 * n)); this.glad(1, '', 'tradgard', 8); this.save(); }
    return n;
  }
  harvest(idx) {
    const gd = this.garden(), b = gd?.beds[idx];
    if (!b || this.bedState(b) !== 'mogen') return { ok: false, msg: 'Det är inte moget än.' };
    const G = grodaOf(b.g), n = G.skord[0] + Math.floor(Math.random() * (G.skord[1] - G.skord[0] + 1));
    const fick = Math.max(0, Math.min(n, MAX_RAVA - (this.skafferi[G.id] | 0)));
    if (fick) this.skafferi[G.id] = (this.skafferi[G.id] | 0) + fick;
    gd.beds[idx] = null;
    this.passTime(10);
    const glad = this.glad(3, '', 'tradgard', 8);
    this.save();
    return { ok: true, groda: G, n: fick, glad };
  }
  clearBed(idx) { const gd = this.garden(); if (!gd || !gd.beds[idx]?.vissen) return false; gd.beds[idx] = null; this.passTime(5); this.save(); return true; }
  // villans äppelträd: moget var TRAD_DAGAR:e dag
  treeReady() { const T = tradgardOf(this.home), gd = this.garden(); return !!(T?.trad && gd && this.day - (gd.trad.skord | 0) >= TRAD_DAGAR); }
  harvestTree() {
    if (!this.treeReady()) return { ok: false, msg: 'Äpplena är inte mogna än.' };
    const gd = this.garden(), n = Math.min(3 + Math.floor(Math.random() * 3), MAX_RAVA - (this.skafferi.applR | 0));
    if (n > 0) this.skafferi.applR = (this.skafferi.applR | 0) + n;
    gd.trad.skord = this.day;
    this.passTime(10);
    const glad = this.glad(2, '', 'tradgard', 8);
    this.save();
    return { ok: true, n: Math.max(0, n), glad };
  }
  // på natten (Game.sleep): vattnad under dagen = en dag till; två torra dygn = vissen
  growGarden(igar) {
    const gd = this.odling[this.home];
    if (!gd) return null;
    let vaxte = 0, vissnade = 0, mogna = 0;
    for (const b of gd.beds) {
      if (!b || b.vissen) continue;
      const G = grodaOf(b.g);
      if (!G || b.v >= G.dagar) continue;
      if (b.vat === igar) { b.v++; b.torr = 0; vaxte++; if (b.v >= G.dagar) mogna++; }
      else if (++b.torr >= 2) { b.vissen = true; vissnade++; }
    }
    return { vaxte, vissnade, mogna };
  }

  // ---------- lyckan och livsmålen ----------
  // Ändra lyckan med n. key + cap = högst cap per dag från den källan (bion, djuren, kompisar …),
  // så att man inte kan klappa katten till 100. why = en toast med skälet (tomt = tyst – t.ex. när
  // stället redan visar en egen toast). Svaret är hur mycket lyckan faktiskt ändrades.
  glad(n, why = '', key = null, cap = Infinity) {
    n = Math.round(+n || 0);
    if (!n) return 0;
    if (key && n > 0) {
      if (this._gladDag.day !== this.day) this._gladDag = { day: this.day };
      const used = this._gladDag[key] || 0;
      n = Math.max(0, Math.min(n, cap - used));
      if (!n) return 0;
      this._gladDag[key] = used + n;
    }
    const before = this.lycka;
    this.lycka = clamp(this.lycka + n);
    const d = this.lycka - before;
    if (why && d) toast(`${d > 0 ? '😊' : '😞'} ${why}: ${d > 0 ? '+' : ''}${d} lycka`, d > 0 ? 'good' : 'bad');
    return d;
  }
  // Nära kompisar (världen, main.js): +1 lycka per 15 minuter tillsammans, högst 8 om dagen
  kompisTid(minutes) {
    this._kompisMin += Math.max(0, +minutes || 0);
    if (this._kompisMin < 15) return 0;
    const n = Math.floor(this._kompisMin / 15);
    this._kompisMin -= n * 15;
    return this.glad(n, '', 'kompis', 8);
  }
  // möbler man själv har ställt ut hemma (inte startmöblerna)
  placedFurniture() {
    let n = 0;
    for (const [key, list] of Object.entries(this.deco)) if (key.startsWith(this.home + ':') && Array.isArray(list)) n += list.filter((d) => d && !d.fx).length;
    return n;
  }
  utbPoang() {
    let p = 0;
    for (const [id, e] of Object.entries(this.edu || {})) if (COURSES[id] && e) p += Math.min(COURSES[id].lectures, e.lect | 0) + (e.klar ? 2 : 0);
    return p;
  }
  bestLevel() { return Math.max(1, ...Object.values(this.jobs).map((n) => levelOf(n | 0))); }
  // Var står man i livsmålen? [{ key, icon, name, have, need, done, k (0–1) }] – tom lista utan mål
  malStatus() {
    if (!this.mal) return [];
    const have = { rik: Math.round(this.money + (this.bank || 0)), lycka: Math.round(this.lycka), utb: this.utbPoang(), karr: this.bestLevel() };
    return Object.values(MAL).map((M) => {
      const need = malTarget(M.id, this.mal[M.id]), h = have[M.id];
      const k = M.id === 'karr' ? Math.max(0, Math.min(1, (h - 1) / Math.max(1, need - 1))) : Math.max(0, Math.min(1, h / Math.max(1, need)));
      return { key: M.id, icon: M.icon, name: M.name, niva: this.mal[M.id], have: h, need, done: h >= need, k };
    });
  }
  setMal(m) { this.mal = cleanMal(m); this.save(); return this.mal; }

  // ---------- prylar (elektronikbutiken) ----------
  hasGadget(kind) { return this.gadgets.some((id) => gadgetOf(id)?.kind === kind); }
  // nyttan av den bästa prylen av en sort (0 om man inte har någon)
  gadgetBonus(kind) { return this.gadgets.reduce((b, id) => { const x = gadgetOf(id); return x?.kind === kind ? Math.max(b, x.bonus | 0) : b; }, 0); }
  buyGadget(id) {
    const x = gadgetOf(id);
    if (!x) return { ok: false, msg: 'Finns inte i butiken.' };
    if (this.gadgets.includes(id)) return { ok: false, msg: 'Den har du redan!' };
    if (this.money < x.price) return { ok: false, msg: 'Du har inte råd!' };
    this.money -= x.price;
    this.gadgets.push(id);
    this.save();
    return { ok: true, item: x };
  }

  // ---------- fordonen (garaget) ----------
  hasFordon(id) { return this.fordon.some((x) => x.id === id); }
  fordonFarg(id) { return this.fordon.find((x) => x.id === id)?.c || fordonOf(id)?.colors[0] || '#3a7bd5'; }
  ownedFordon() { return this.fordon.filter((x) => fordonOf(x.id)).map((x) => ({ ...fordonOf(x.id), c: x.c })); }
  // fordonet man åker på just nu (med färgen) – null = går
  get aker() { const F = this.akerMed && fordonOf(this.akerMed); return F && this.hasFordon(F.id) ? { ...F, c: this.fordonFarg(F.id) } : null; }
  buyFordon(id, c) {
    const F = fordonOf(id);
    if (!F) return { ok: false, msg: 'Finns inte i garaget.' };
    if (this.hasFordon(id)) return { ok: false, msg: 'Den har du redan!' };
    if (this.money < F.price) return { ok: false, msg: `Den kostar ${fmt(F.price)} – du har inte råd.` };
    const col = F.colors.includes(c) ? c : F.colors[0];
    this.money -= F.price;
    this.fordon.push({ id, c: col });
    this.akerMed = id;                                    // man åker iväg på den direkt
    const glad = this.glad(5, '', 'fordonkop', 5);
    this.save();
    return { ok: true, fordon: F, glad };
  }
  paintFordon(id, c) {
    const F = fordonOf(id), f = this.fordon.find((x) => x.id === id);
    if (!F || !f) return { ok: false, msg: 'Den har du inte.' };
    if (!F.colors.includes(c) || f.c === c) return { ok: false, msg: 'Den har redan den färgen.' };
    if (this.money < OMLACK) return { ok: false, msg: `Att måla om kostar ${fmt(OMLACK)} – du har inte råd.` };
    this.money -= OMLACK;
    f.c = c;
    this.save();
    return { ok: true };
  }
  setAker(id) {
    this.akerMed = id && this.hasFordon(id) && fordonOf(id) ? id : null;
    this.save();
    return this.akerMed;
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
  // ---------- köket: råvaror, receptboken och spisen ----------
  // Köp en vara i mataffären: färdigmat → kylskåpet (buyFood), råvara → skafferiet
  buyVara(id) {
    if (foodOf(id)) return this.buyFood(id);
    const r = ravaraOf(id);
    if (!r) return { ok: false, msg: 'Den varan finns inte.' };
    if (this.money < r.price) return { ok: false, msg: 'Du har inte råd!' };
    if ((this.skafferi[id] | 0) >= MAX_RAVA) return { ok: false, msg: `Skafferiet är fullt av ${r.name.toLowerCase()}.` };
    this.money -= r.price;
    this.skafferi[id] = (this.skafferi[id] | 0) + 1;
    this.save();
    return { ok: true };
  }
  // ät en råvara som den är (ett äpple, en banan …): 5 minuter
  eatRaw(id) {
    const r = ravaraOf(id);
    if (!r || !r.raw || !(this.skafferi[id] > 0)) return false;
    this.useRava(id);
    this.hunger = clamp(this.hunger + r.raw);
    this.passTime(5);
    this.save();
    return true;
  }
  useRava(id, n = 1) { this.skafferi[id] = (this.skafferi[id] | 0) - n; if (this.skafferi[id] <= 0) delete this.skafferi[id]; }
  knowsRecipe(id) { return this.recept.includes(id); }
  // läs ett recept i receptboken – en kvart, sen kan man laga rätten
  learnRecipe(id) {
    const r = receptOf(id);
    if (!r) return { ok: false, msg: 'Det receptet finns inte i boken.' };
    if (this.knowsRecipe(id)) return { ok: false, msg: `Du kan redan ${r.name.toLowerCase()}.` };
    this.recept.push(id);
    this.passTime(RECEPT_LAS_MIN);
    this.save();
    return { ok: true, recipe: r };
  }
  // vad saknas för att laga rätten i n portioner? (tom lista = allt finns hemma)
  missingFor(id, n = 1) { return (receptOf(id)?.ing || []).filter((x) => (this.skafferi[x] | 0) < n); }
  canCook(id, n = 1) {
    const r = receptOf(id);
    if (!r) return { ok: false, msg: 'Det receptet finns inte.' };
    if (!this.knowsRecipe(id)) return { ok: false, msg: `Läs receptet på ${r.name.toLowerCase()} i receptboken först.` };
    const miss = this.missingFor(id, n);
    if (miss.length) return { ok: false, missing: miss, msg: `Det fattas ${miss.map((x) => ravaraOf(x)?.name.toLowerCase() || x).join(', ')}${n > 1 ? ` (${n} av varje till ${portionOf(n).name.toLowerCase()})` : ''} – handla i mataffären.` };
    return { ok: true };
  }
  get kockNiva() { return kockNiva(this.kockPortioner); }
  // hur mycket en portion av rätten mättar just nu: grundvärdet + rättens stjärnor + kocknivån
  portionFill(id) {
    const r = receptOf(id);
    if (!r) return 0;
    return Math.round(r.fill * (1 + 0.1 * (kockStjarnor(this.kockat[id]) - 1)) * (1 + 0.05 * (this.kockNiva - 1)));
  }
  matladorAntal() { return Object.values(this.matlador).reduce((a, b) => a + (b | 0), 0); }
  // Laga rätten (köket, js/scenes/koket.js): råvarorna × n går åt, klockan går (längre för storkok),
  // en portion äts direkt (mätthet + lycka + ork), resten blir matlådor. Kockvanan per rätt och
  // kocknivån gör maten godare.
  cook(id, n = 1) {
    n = portionOf(n).n;
    const chk = this.canCook(id, n);
    if (!chk.ok) return chk;
    const r = receptOf(id);
    for (const x of r.ing) this.useRava(x, n);
    const starsBefore = kockStjarnor(this.kockat[id]), nivaBefore = this.kockNiva;
    this.kockat[id] = (this.kockat[id] | 0) + n;
    this.kockPortioner = (this.kockPortioner | 0) + n;
    const stars = kockStjarnor(this.kockat[id]), niva = this.kockNiva;
    const fill = this.portionFill(id);
    this.passTime(Math.round(r.min * portionOf(n).tid));
    this.hunger = clamp(this.hunger + fill);
    this.energy = clamp(this.energy + (r.energi | 0));
    const glad = this.glad((r.glad | 0) + (stars - 1), '', 'mat', 10);
    const room = Math.max(0, MAX_MATLADOR - this.matladorAntal()), lador = Math.min(n - 1, room);
    if (lador) this.matlador[id] = (this.matlador[id] | 0) + lador;
    this.save();
    return { ok: true, recipe: r, n, fill, glad, energi: r.energi | 0, stars, betterNow: stars > starsBefore, niva, nyNiva: niva > nivaBefore, lador, overflow: n - 1 - lador };
  }
  // en matlåda ur kylskåpet: värm och ät (10 minuter)
  eatMatlada(id) {
    if (!(this.matlador[id] > 0)) return null;
    this.matlador[id] -= 1;
    if (!this.matlador[id]) delete this.matlador[id];
    const r = receptOf(id), fill = this.portionFill(id);
    this.hunger = clamp(this.hunger + fill);
    this.passTime(10);
    const glad = this.glad(1, '', 'mat', 10);
    this.save();
    return { recipe: r, fill, glad };
  }

  // ---------- jobb ----------
  canWork(jobId) {
    const need = JOBS[jobId]?.kraver;
    if (need && !this.edu?.[need]?.klar) return { ok: false, msg: `Här krävs en examen i ${COURSES[need]?.name || need} från Pixelhögskolan.` };
    if (this.energy < 20) return { ok: false, msg: 'Du är för trött för att jobba – gå hem och sov.' };
    // flygplatsen går dygnet runt – men sista nattpasset börjar 23:00
    if (JOBS[jobId]?.nattoppet) return this.min > 23 * 60 ? { ok: false, msg: 'Sista nattpasset har redan gått – nästa pass börjar 07:00.' } : { ok: true };
    if (this.min > 20 * 60) return { ok: false, msg: 'För sent att börja ett pass – jobben öppnar 07:00 igen.' };
    if (this.min < 7 * 60) return { ok: false, msg: 'Jobbet öppnar 07:00.', waitTo: 7 * 60 };
    return { ok: true };
  }
  // ---------- Pixelhögskolan ----------
  hasDegree(id) { return !!this.edu[id]?.klar; }
  enroll(id) {
    const c = COURSES[id];
    if (!c) return { ok: false, msg: 'Den kursen finns inte.' };
    if (this.edu[id]) return { ok: false, msg: `Du är redan antagen till ${c.name}.` };
    if (this.money < c.fee) return { ok: false, msg: `Terminsavgiften är ${fmt(c.fee)} – pengarna räcker inte.` };
    this.money -= c.fee;
    this.edu[id] = { lect: 0, day: 0, tenta: 0, tentaDay: 0, klar: false };
    this.save();
    return { ok: true };
  }
  // får jag gå på en föreläsning nu? (salen själv har öppettiderna)
  canLecture(id) {
    const e = this.edu[id], c = COURSES[id];
    if (!c) return { ok: false, msg: 'Den kursen finns inte.' };
    if (!e) return { ok: false, msg: `Anmäl dig till ${c.name} i expeditionen först.` };
    if (e.klar) return { ok: false, msg: `Du har redan examen i ${c.name}!` };
    if (e.lect >= c.lectures) return { ok: false, msg: 'Alla föreläsningar är klara – skriv tentan i biblioteket!' };
    if (e.day === this.day) return { ok: false, msg: 'Dagens föreläsning är redan gjord – nästa är i morgon.' };
    if (this.energy < 15) return { ok: false, msg: 'Du är för trött för att hänga med – sov först.' };
    return { ok: true };
  }
  // en föreläsning: 2 timmar och lite ork
  attendLecture(id) {
    const chk = this.canLecture(id);
    if (!chk.ok) return chk;
    const e = this.edu[id];
    e.lect += 1; e.day = this.day;
    this.energy = clamp(this.energy - 10);
    this.passTime(2 * 60);
    this.save();
    return { ok: true, lect: e.lect, of: COURSES[id].lectures };
  }
  canExam(id) {
    const e = this.edu[id], c = COURSES[id];
    if (!c || !e) return { ok: false, msg: 'Du går inte den kursen.' };
    if (e.klar) return { ok: false, msg: `Du har redan examen i ${c.name}!` };
    if (e.lect < c.lectures) return { ok: false, msg: `Tentan kommer efter alla ${c.lectures} föreläsningar (du har gått ${e.lect}).` };
    if (e.tentaDay === this.day) return { ok: false, msg: 'Du har redan skrivit en tenta i dag – omtentan är i morgon.' };
    return { ok: true };
  }
  // tentan: right av of rätt, minst två tredjedelar = godkänd → examen (en timme)
  takeExam(id, right, of = 3) {
    const chk = this.canExam(id);
    if (!chk.ok) return chk;
    const e = this.edu[id];
    right = Math.max(0, Math.min(of, right | 0));
    const pass = right >= Math.ceil((of * 2) / 3);
    e.tentaDay = this.day; e.tenta += 1;
    if (pass) e.klar = true;
    this.passTime(60);
    this.save();
    return { ok: true, pass, right, of };
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
  // Ett pass = 4 timmar speltid (längre pass 6, se shiftPlan). Lönen räknas ut av minispelet;
  // yr av hunger = halv lön, extrapass-dagar = dubbel lön. Rekord (flest rätt, bästa lön) sparas.
  endShift(jobId, pay, stats = {}, plan = shiftPlan(levelOf(this.jobs[jobId]))) {
    const starving = this.hunger <= 0;
    const doubled = this.eventIs('dubbel') && this.event.job === jobId;
    const gladMult = gladPayMult(this.lycka);                                               // glad = dricks, nere = sämre lön
    let finalPay = Math.max(0, Math.round((starving ? pay / 2 : pay) * gladMult));
    if (doubled) finalPay *= 2;
    const before = levelOf(this.jobs[jobId]);
    this.jobs[jobId] += 1;
    this.rollPass[jobId] = (this.rollPass[jobId] | 0) + 1;     // karriärstegarna: pass i rollen och i veckan
    this.veckoPass[jobId] = (this.veckoPass[jobId] | 0) + 1;
    // passet tär på lyckan – mer om det är långt eller det tredje i dag
    this.passIdag = this.sistaPass === this.day ? this.passIdag + 1 : 1;
    this.sistaPass = this.day;
    const gladPass = this.glad(-3 - (plan.len === 'langt' ? 2 : 0) - (this.passIdag >= 3 ? 4 : 0));
    this.money += finalPay;
    this.earned += finalPay;
    this.energy = clamp(this.energy - plan.energy);
    // ett nattpass slutar vid midnatt (nightEnd): man tar nattbussen hem och sover i stället
    // för att somna där man står (även ett långt pass som började sent – t.ex. när en kompis
    // bjöd in på kvällen)
    const left = DAY - 1 - this.min;
    const nightEnd = (!!JOBS[jobId]?.nattoppet || plan.len === 'langt') && left < plan.gameMin;
    this.passTime(nightEnd ? Math.max(0, left) : plan.gameMin);
    const b = this.best[jobId];
    const newRecord = (stats.ok || 0) > b.ok;
    b.ok = Math.max(b.ok, stats.ok || 0);
    b.pay = Math.max(b.pay, finalPay);
    this.save();
    const after = levelOf(this.jobs[jobId]);
    if (after > before) { play('fanfare'); toast(`⭐ Befordran på ${JOBS[jobId].name}! Du är nu ${JOB_TITLES[after - 1]}.`, 'good'); }
    return { finalPay, starving, doubled, newRecord, promoted: after > before, nightEnd, gladMult, gladPass, passIdag: this.passIdag };
  }

  // ---------- kläder (klädkatalogen js/data/wardrobe.js) ----------
  // Äger man plagget? id = katalog-id (en gammal 'kind:v' går också). Basplaggen äger alla.
  ownsWardrobe(id) {
    const it = itemById(wardrobeIdOf(id));
    if (!it) return false;
    return !!it.free || this.wardrobe.includes(it.id) || (!!it.legacy && this.wardrobe.includes(it.legacy));
  }
  // Alla ägda katalog-id, basplaggen inräknade – avatarredigeraren (setAvatarWardrobe i main.js)
  ownedWardrobeIds() {
    const out = new Set();
    for (const it of WARDROBE) if (it.free) out.add(it.id);
    for (const k of this.wardrobe) { const id = wardrobeIdOf(k); if (id) out.add(id); }
    return [...out];
  }
  // Dagboken: köpta plagg av alla som säljs (basplaggen räknas inte)
  wardrobeCount() {
    const sold = WARDROBE.filter((it) => !it.free);
    return { owned: sold.filter((it) => this.ownsWardrobe(it.id)).length, of: sold.length };
  }
  // REA-dagar ger 25 % rabatt på alla kläder, skor och accessoarer.
  clothesPrice(s) { return Math.round(s.price * (this.eventIs('rea') ? 0.75 : 1)); }
  // Köp ett plagg ur katalogen: { ok, msg?, item?, price? }
  buyWardrobe(id) {
    const it = itemById(wardrobeIdOf(id));
    if (!it || it.free) return { ok: false, msg: 'Det plagget säljs inte här.' };
    if (this.ownsWardrobe(it.id)) return { ok: false, msg: 'Den har du redan!' };
    const price = this.clothesPrice(it);
    if (this.money < price) return { ok: false, msg: 'Du har inte råd – dags att jobba ett pass!' };
    this.money -= price;
    for (const k of wardrobeKeys([it.id])) if (!this.wardrobe.includes(k)) this.wardrobe.push(k);
    this.glad(4, '', 'nytt', 10);                                                           // nya kläder gör en glad (högst +10 om dagen)
    this.save();
    return { ok: true, item: it, price };
  }
  // Samma sak under namnen sko- och accessoarbutikerna använder (shop-skor.js, shop-accessoarer.js)
  ownsItem(id) { return this.ownsWardrobe(id); }
  buyItem(id) { return this.buyWardrobe(id); }
  itemPrice(item) { const it = typeof item === 'string' ? itemById(wardrobeIdOf(item)) : item; return it ? this.clothesPrice(it) : 0; }
  ownedItemIds() { return this.ownedWardrobeIds(); }
  // Gamla anropen med sortimentsnycklar (kind, v), t.ex. ('phones', true) i elektronikbutiken.
  // Låst = finns i det första sortimentet men är inte köpt.
  clothesLocked(kind, v) {
    const s = SORTIMENT.find((s) => s.kind === kind && s.v === v);
    if (!s) return null;
    const key = clothesKey(kind, v), id = legacyKeyToId(key);
    return (id ? this.ownsWardrobe(id) : this.wardrobe.includes(key)) ? null : s;
  }
  buyClothes(kind, v) {
    const s = this.clothesLocked(kind, v);
    if (!s) return { ok: false, msg: 'Den har du redan!' };
    const id = legacyKeyToId(clothesKey(kind, v));
    if (id) { const r = this.buyWardrobe(id); return r.ok ? { ...r, item: s } : r; }
    const price = this.clothesPrice(s);
    if (this.money < price) return { ok: false, msg: 'Du har inte råd – dags att jobba ett pass!' };
    this.money -= price;
    this.wardrobe.push(clothesKey(kind, v));
    this.save();
    return { ok: true, item: s, price };
  }

  // ---------- möbler ----------
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

  // ---------- banken (sparkontot) ----------
  // Sätta in från handkassan och ta ut till den – i kassan eller i bankomaten (via: 'atm').
  // Hela kronor; allt eller inget. Svaret { ok, kr } eller { ok: false, msg }.
  bankDeposit(kr) {
    kr = Math.floor(+kr || 0);
    if (kr <= 0) return { ok: false, msg: 'Välj hur mycket du vill sätta in.' };
    if (kr > this.money) return { ok: false, msg: `Du har bara ${fmt(Math.max(0, this.money))} på fickan.` };
    this.money -= kr;
    this.bank += kr;
    this.logBank('in', kr);
    this.save();
    return { ok: true, kr };
  }
  bankWithdraw(kr, { via = 'kassa' } = {}) {
    kr = Math.floor(+kr || 0);
    if (kr <= 0) return { ok: false, msg: 'Välj hur mycket du vill ta ut.' };
    if (kr > this.bank) return { ok: false, msg: `Det finns bara ${fmt(this.bank)} på sparkontot.` };
    this.bank -= kr;
    this.bankMin = Math.min(this.bankMin, this.bank);   // uttag sänker veckans lägsta saldo (insättningar räknas från nästa vecka)
    this.money += kr;
    this.logBank(via === 'atm' ? 'atm' : 'ut', kr);
    this.save();
    return { ok: true, kr };
  }
  // räntan som betalas nästa måndag om inget mer tas ut (på det som legat kvar hela veckan)
  bankNextInterest() { return bankInterest(Math.min(this.bank, this.bankMin)); }
  // en rad i kontoutdraget (de senaste BANK_LOG_MAX sparas)
  logBank(t, n) {
    this.bankLog.push({ d: this.day, m: Math.floor(this.min), t, n: Math.round(n) });
    if (this.bankLog.length > BANK_LOG_MAX) this.bankLog.splice(0, this.bankLog.length - BANK_LOG_MAX);
  }

  // ---------- pantbanken ----------
  // Pantsätt möbel nr idx i förrådet: pengarna direkt, möbeln står i pantbanken tills lånet
  // + räntan är betalt (lösas ut senast dag `sista`). Startmöbler (fx) tas inte emot.
  pawnStorage(idx) {
    const it = this.storage[idx];
    if (!this.sellable(it)) return { ok: false, msg: 'Den tar pantlånaren inte emot.' };
    if (this.pant.length >= MAX_PANT) return { ok: false, msg: `Högst ${MAX_PANT} panter åt gången – lös ut något först.` };
    const lan = pantLoanOf(it.k), skuld = pantDebtOf(lan);
    this.storage.splice(idx, 1);
    const p = { ...it, nr: ++this.pantNr, lan, skuld, dag: this.day, sista: this.day + PANT_DAYS };
    delete p.fx;
    this.pant.push(p);
    this.money += lan;
    this.save();
    return { ok: true, pant: p, lan, skuld, sista: p.sista };
  }
  // dagar kvar att lösa ut panten (0 = i dag är sista dagen, < 0 = förfallen)
  pantDaysLeft(p) { return (p?.sista | 0) - this.day; }
  // Lös ut pant nr: skulden betalas och möbeln kommer tillbaka till förrådet
  redeemPant(nr) {
    const i = this.pant.findIndex((p) => p.nr === nr);
    const p = this.pant[i];
    if (!p) return { ok: false, msg: 'Den panten finns inte.' };
    if (this.pantDaysLeft(p) < 0) return { ok: false, msg: 'För sent – lånet har förfallit och möbeln är pantbankens.' };
    if (this.money < p.skuld) return { ok: false, msg: `Du har inte råd – det kostar ${fmt(p.skuld)} att lösa ut den.` };
    if (this.storage.length >= MAX_STORAGE) return { ok: false, msg: 'Förrådet är fullt – möblera hemma först!' };
    this.pant.splice(i, 1);
    this.money -= p.skuld;
    const { nr: _nr, lan, skuld, dag, sista, ...item } = p;
    this.storage.push(item);
    this.save();
    return { ok: true, item, skuld };
  }
  // Varje morgon (sleep): förfallna lån – pantbanken behåller möbeln. Sista dagen = påminnelse.
  pantMorning() {
    const lost = this.pant.filter((p) => this.pantDaysLeft(p) < 0);
    if (lost.length) {
      this.pant = this.pant.filter((p) => this.pantDaysLeft(p) >= 0);
      toast(`💍 Pantbanken behöll ${lost.map((p) => katalogOf(p.k)?.name || 'möbeln').join(', ')} – lånet förföll.`, 'bad');
    }
    const last = this.pant.filter((p) => this.pantDaysLeft(p) === 0);
    if (last.length) toast(`💍 Sista dagen i dag att lösa ut ${last.map((p) => katalogOf(p.k)?.name || 'panten').join(', ')} i pantbanken!`);
    return lost;
  }

  // ---------- bo ihop (Carl 2026-10-02, alternativ A; nätet i js/net/sambo.js) ----------
  // Värden bjuder in, den andra flyttar in i värdens bostad. Båda sparfilerna har en kopia av det
  // delade hemmet: möblerna i alla rum (deco 'hem:rum') och trädgården (odling[hem]). Varje ändring
  // ger en ny version (ver, stamp) – när båda är online tar den äldre kopian över den nyare.
  // Den inflyttade sparar sitt gamla hem (egen) och får tillbaka det om ni flyttar isär.
  samboSnap(hem = this.sambo?.hem) {
    const deco = {};
    for (const [k, v] of Object.entries(this.deco)) if (k.startsWith(hem + ':')) deco[k] = v;
    return { deco, odling: this.odling[hem] || null };
  }
  samboTouch() {
    const sig = JSON.stringify(this.samboSnap());
    if (this._samboSig !== null && sig !== this._samboSig) { this.sambo.ver = (this.sambo.ver | 0) + 1; this.sambo.stamp = Date.now(); }
    this._samboSig = sig;
  }
  // ta över den andras (nyare) kopia av det delade hemmet
  samboAdopt(snap, ver, stamp) {
    const S = this.sambo;
    if (!S || !snap || typeof snap !== 'object') return false;
    for (const k of Object.keys(this.deco)) if (k.startsWith(S.hem + ':')) delete this.deco[k];
    for (const [k, v] of Object.entries(snap.deco || {})) if (k.startsWith(S.hem + ':') && Array.isArray(v)) this.deco[k] = v.filter((d) => d && typeof d === 'object' && typeof d.k === 'string').slice(0, MAX_PER_ROOM);
    if (snap.odling && typeof snap.odling === 'object') this.odling[S.hem] = snap.odling; else delete this.odling[S.hem];
    S.ver = ver | 0; S.stamp = +stamp || Date.now();
    this._samboSig = JSON.stringify(this.samboSnap());
    this.save();
    return true;
  }
  // flytta ihop: vard = den andra flyttar in hos mig; inflyttad = jag flyttar in (snap = värdens hem)
  flyttaIhop({ key, namn, hem, roll, hu, snap = null }) {
    hem = homeOf(hem).id;
    const S = { key: String(key).slice(0, 64), namn: String(namn || '').slice(0, 16), hem, roll: roll === 'inflyttad' ? 'inflyttad' : 'vard', hu: String(hu || '').slice(0, 16), sedan: this.day, ver: 1, stamp: Date.now(), egen: null };
    if (S.roll === 'inflyttad') {
      const egen = this.samboSnap(hem);   // (hade jag samma sorts bostad förut får jag tillbaka mina möbler där)
      S.egen = { home: this.home, deco: egen.deco, odling: egen.odling };
      this.home = hem;
    }
    this.sambo = S;
    this._samboSig = null;
    if (snap) { this.samboAdopt(snap, 1, S.stamp); }
    this._samboSig = JSON.stringify(this.samboSnap());
    this.glad(5, '', 'sambo', 5);
    this.save();
    return S;
  }
  // flytta isär: den inflyttade får tillbaka sitt gamla hem (och sina möbler där), värden bor kvar
  flyttaIsar() {
    const S = this.sambo;
    if (!S) return null;
    if (S.roll === 'inflyttad') {
      for (const k of Object.keys(this.deco)) if (k.startsWith(S.hem + ':')) delete this.deco[k];
      Object.assign(this.deco, S.egen?.deco || {});
      if (S.egen?.odling) this.odling[S.hem] = S.egen.odling; else delete this.odling[S.hem];
      this.home = homeOf(S.egen?.home || 'husvagn').id;
    }
    this.sambo = null;
    this._samboSig = null;
    this.save();
    return S;
  }

  // ---------- bostad ----------
  moveTo(homeId) {
    const h = homeOf(homeId);
    if (h.id === this.home) return { ok: false, msg: 'Du bor redan här.' };
    if (this.sambo) return { ok: false, msg: `Du bor ihop med ${this.sambo.namn || 'en kompis'} – flytta isär först (👥 i menyraden).` };
    if (this.money < h.deposit) return { ok: false, msg: `Insatsen är ${fmt(h.deposit)} – du har inte råd än.` };
    this.money -= h.deposit;
    this.home = h.id;
    this.save();
    return { ok: true };
  }
}

const clamp = (v) => Math.max(0, Math.min(100, Math.round(+v || 0)));
// foodtrucken: bara kända platser/priser/uppgraderingar
function cleanTruck(t) {
  if (!t || typeof t !== 'object') return null;
  return {
    ...t,
    plats: TRUCK_PLATSER.some((x) => x.id === t.plats) ? t.plats : 'parken',
    priser: TRUCK_PRISER[t.priser] ? t.priser : 'vanlig',
    uppg: (Array.isArray(t.uppg) ? t.uppg : []).filter((id) => TRUCK_UPPG.some((u) => u.id === id)),
    personal: (Array.isArray(t.personal) ? t.personal : []).filter((x) => x && typeof x === 'object').slice(0, TRUCK_MAX_PERSONAL)
      .map((x) => ({ id: String(x.id || '').slice(0, 20), namn: String(x.namn || '?').slice(0, 16), skill: Math.max(1, Math.min(3, x.skill | 0)), lon: Math.max(0, x.lon | 0) })),
    rykte: Math.max(0, Math.min(5, +t.rykte || 0)), kopt: t.kopt | 0, sald: Math.max(0, t.sald | 0),
    logg: (Array.isArray(t.logg) ? t.logg : []).slice(0, 14),
  };
}
// bo ihop: bara giltiga poster följer med (okänd bostad → ingen sambo)
function cleanSambo(s) {
  if (!s || typeof s !== 'object' || typeof s.key !== 'string' || !s.key || !HOMES.some((h) => h.id === s.hem)) return null;
  const egen = s.egen && typeof s.egen === 'object' ? { home: homeOf(s.egen.home).id, deco: s.egen.deco && typeof s.egen.deco === 'object' ? s.egen.deco : {}, odling: s.egen.odling && typeof s.egen.odling === 'object' ? s.egen.odling : null } : null;
  return { ...s, key: s.key.slice(0, 64), namn: String(s.namn || '').slice(0, 16), roll: s.roll === 'inflyttad' ? 'inflyttad' : 'vard', hu: /^sb-[a-z0-9]{1,12}$/.test(String(s.hu)) ? s.hu : '', sedan: Math.max(0, s.sedan | 0), ver: Math.max(0, s.ver | 0), stamp: +s.stamp || 0, egen };
}
