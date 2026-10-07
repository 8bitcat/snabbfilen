// Stadens nya ställen (kartkontrakt v2): arbetsplatserna och bostäderna som
// husen i map.js pekar på med enter 'jobb:<id>' och 'bostad:<homeId>'.
// Den här filen är DATA för huvudagenten/game.js – ingenting här är inkopplat
// av sig självt. Så länge ett jobb saknas i JOBS (game.js) visar staden
// "Anställer snart!" vid dörren, och så länge en bostad saknas i HOMES öppnar
// bostadshuset bara bostadsbyrån.
//
// WORKPLACES har samma fält som JOBS i game.js (id, icon, name, verb, wage,
// oops, bonus?) plus building (husets id i map.js), open (öppettider, samma
// som husets) och idea (förslag på minispel). NEW_HOMES har samma fält som
// HOMES i game.js (id, icon, name, deposit, rent, restBonus, desc) plus building.

import { $t } from '../core/i18n.js';

export const WORKPLACES = [
  { id: 'pizzeria', icon: '🍕', name: $t('Pizzerian'), verb: $t('Baka rätt pizza åt rätt kund'), wage: 9, oops: 5,
    building: 'pizzeria', district: 'SÖDER', open: [11, 23],
    idea: 'Beställningslappar på väggen; deg → tomatsås → ost → pålägg → in i stenugnen, ut när den är gyllene (burgarbarens kundmotor + en ugnstimer).' },
  { id: 'posten', icon: '📮', name: $t('Posten'), verb: $t('Sortera paketen till rätt fack'), wage: 6, oops: 3, bonus: 15,
    building: 'posten', district: 'SÖDER', open: [8, 18],
    idea: 'Paket med färgad postnummerlapp kommer på bandet – bär till facket med samma färg; full postsäck = bonus (fruktfabrikens motor).' },
  { id: 'vard', icon: '🏥', name: $t('Vårdcentralen'), verb: $t('Ge rätt patient rätt medicin'), wage: 11, oops: 6,
    building: 'vardcentral', district: 'SÖDER', open: [8, 17],
    idea: 'Patienter i väntrummet visar en symtombubbla; hämta rätt sak (plåster, termometer, medicin) från skåpet och gå till rätt patient.' },
  { id: 'bensinmack', icon: '⛽', name: $t('Pixelmacken'), verb: $t('Tanka bilarna och sälj korv'), wage: 8, oops: 4,
    building: 'bensinmack', district: 'SÖDER', open: [6, 23],
    idea: 'Bilar rullar in till pumparna med en bubbla (bensin/diesel/el); håll i munstycket tills mätaren är full. Mellan bilarna: korv med bröd i kassan.' },
  { id: 'bilverkstad', icon: '🔧', name: $t('Bilverkstan'), verb: $t('Byt däck och laga bilarna'), wage: 10, oops: 6,
    building: 'bilverkstad', district: 'FÖRORTEN', open: [7, 18],
    idea: 'Bil på lyften med en felbubbla (däck, lampa, avgasrör); hämta rätt reservdel från hyllan och skruva fast.' },
  { id: 'tvatteri', icon: '🧺', name: $t('Tvätteriet'), verb: $t('Tvätta, torka och lämna rätt påse till rätt kund'), wage: 7, oops: 4, bonus: 10,
    building: 'tvatteri', district: 'FÖRORTEN', open: [8, 20],
    idea: 'Smutspåsar med färgad lapp → tvättmaskin → torktumlare → vikbordet → kunden med samma lapp (bonus per färdig påse).' },
];

export const NEW_HOMES = [
  { id: 'husvagn', icon: '🚐', name: $t('Husvagnen'), deposit: 0, rent: 150, restBonus: -10, building: 'husvagn',
    desc: $t('En rostig husvagn på tomten i förorten. Billigast i stan – om du tål kylan.') },
  { id: 'hoghus', icon: '🏢', name: $t('Förortsettan'), deposit: 500, rent: 250, restBonus: -5, building: 'hoghus',
    desc: $t('Ett rum och kök på sjunde våningen i Betongvägen 1. Hissen går ibland.') },
  { id: 'radhus', icon: '🏡', name: $t('Radhuset'), deposit: 4000, rent: 800, restBonus: 15, building: 'radhus',
    desc: $t('Eget radhus på Söder med en liten trädgård. Grannarna grillar på lördagar.') },
  { id: 'takvaning', icon: '🏙️', name: $t('Takvåningen'), deposit: 20000, rent: 2000, restBonus: 25, building: 'tornhuset',
    desc: $t('Högst upp i Tornhuset – terrass med utsikt över hela Pixelstaden.') },
];

// Vilket hus varje bostad ligger i (v1-bostäderna ligger alla på Pixelgatan 1).
export const HOME_BUILDING = {
  rum: 'hoghus', lagenhet: 'hem', villa: 'hem', // Lilla rummet ligger i förortens höghus (Carl 2026-09-28)
  ...Object.fromEntries(NEW_HOMES.map((h) => [h.id, h.building])),
};
export const homeBuildingId = (homeId) => HOME_BUILDING[homeId] || 'hem';

// Butikerna och ställena utöver v1: vart dörren leder (map.js enter) och vad som finns där.
// Scenerna laddas tåligt av main.js (saknas en visar dörren husets soon-text – city.js SCENE_DOORS).
export const SHOPS_EXTRA = [
  { id: 'narbutik', building: 'narbutik', enter: 'narbutik', idea: 'Trång butik med galler, dyrare än Stormarknad men öppen dygnet runt – och skraplotterna.' },
  { id: 'pantbank', building: 'pantbank', enter: 'pantbank', idea: 'Sälj möbler ur förrådet för halva priset, låna pengar mot pant (js/scenes/shop-pantbank.js).' },
  { id: 'kebab', building: 'kebab', enter: 'kebab', idea: 'Kebab Grill: kebabrulle, falafel, pommes och läsk – ät sittande (js/scenes/shop-kebab.js).' },
  { id: 'kiosk', building: 'kiosk', enter: 'glass', idea: 'Glasståndet: kulglass, två kulor eller mjukglass – sätt dig vid borden.' },
  { id: 'bio', building: 'bio', enter: 'bio', idea: 'BIO PIXEL: biljett, popcorn och kvällens film i salongen (js/scenes/shop-bio.js).' },
  // DOWNTOWN (v3, finanskvarteret) – Carls beställning: bank, elektronik, frisör, skor och accessoarer
  { id: 'bank', building: 'bank', enter: 'bank', idea: 'PIXELBANKEN: sätt in lönen, spara med ränta, ta ut i bankomaten (js/scenes/shop-bank.js).' },
  { id: 'elektronik', building: 'elektronik', enter: 'elektronik', idea: 'Telefoner, surfplattor, datorer och tv-apparater (js/scenes/shop-elektronik.js).' },
  { id: 'frisor', building: 'frisor', enter: 'frisor', idea: 'Klippning och färgning i stolen framför spegeln (js/scenes/shop-frisor.js).' },
  { id: 'skor', building: 'skor', enter: 'skor', idea: 'Sneakers, kängor, stövlar och finskor – prova och köp (js/scenes/shop-skor.js).' },
  { id: 'accessoarer', building: 'accessoarer', enter: 'accessoarer', idea: 'Väskor, smycken, klockor, solglasögon och hattar (js/scenes/shop-accessoarer.js).' },
  { id: 'universitet', building: 'kontor3', enter: 'universitet', idea: 'Pixelhögskolan i Pixel Tower: kurser, föreläsningar och tentor (js/scenes/shop-universitet.js).' },
];
// Downtowns kontorstorn: FINANSHUSET (kontor1) = jobbet finans, GLASTORNET (kontor4) = Pixel Data
// (jobbet datorbygge) – båda kräver examen från Pixelhögskolan (JOBS[id].kraver i game.js).
// BÖRSHUSET (kontor2) har bara soon-text än.
