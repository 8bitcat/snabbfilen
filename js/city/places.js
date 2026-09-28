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

export const WORKPLACES = [
  { id: 'pizzeria', icon: '🍕', name: 'Pizzerian', verb: 'Baka rätt pizza åt rätt kund', wage: 9, oops: 5,
    building: 'pizzeria', district: 'SÖDER', open: [11, 23],
    idea: 'Beställningslappar på väggen; deg → tomatsås → ost → pålägg → in i stenugnen, ut när den är gyllene (burgarbarens kundmotor + en ugnstimer).' },
  { id: 'posten', icon: '📮', name: 'Posten', verb: 'Sortera paketen till rätt fack', wage: 6, oops: 3, bonus: 15,
    building: 'posten', district: 'SÖDER', open: [8, 18],
    idea: 'Paket med färgad postnummerlapp kommer på bandet – bär till facket med samma färg; full postsäck = bonus (fruktfabrikens motor).' },
  { id: 'bibliotek', icon: '📚', name: 'Biblioteket', verb: 'Ställ tillbaka böckerna på rätt hylla', wage: 6, oops: 2,
    building: 'bibliotek', district: 'SÖDER', open: [9, 20],
    idea: 'Återlämnade böcker med färgad rygg och bokstav – till hyllan med samma bokstav. Spring inte: bibliotekarien hyssjar (fel om man springer).' },
  { id: 'vard', icon: '🏥', name: 'Vårdcentralen', verb: 'Ge rätt patient rätt medicin', wage: 11, oops: 6,
    building: 'vardcentral', district: 'SÖDER', open: [8, 17],
    idea: 'Patienter i väntrummet visar en symtombubbla; hämta rätt sak (plåster, termometer, medicin) från skåpet och gå till rätt patient.' },
  { id: 'bensinmack', icon: '⛽', name: 'Pixelmacken', verb: 'Tanka bilarna och sälj korv', wage: 8, oops: 4,
    building: 'bensinmack', district: 'SÖDER', open: [6, 23],
    idea: 'Bilar rullar in till pumparna med en bubbla (bensin/diesel/el); håll i munstycket tills mätaren är full. Mellan bilarna: korv med bröd i kassan.' },
  { id: 'bilverkstad', icon: '🔧', name: 'Bilverkstan', verb: 'Byt däck och laga bilarna', wage: 10, oops: 6,
    building: 'bilverkstad', district: 'FÖRORTEN', open: [7, 18],
    idea: 'Bil på lyften med en felbubbla (däck, lampa, avgasrör); hämta rätt reservdel från hyllan och skruva fast.' },
  { id: 'tvatteri', icon: '🧺', name: 'Tvätteriet', verb: 'Tvätta, torka och lämna rätt påse till rätt kund', wage: 7, oops: 4, bonus: 10,
    building: 'tvatteri', district: 'FÖRORTEN', open: [8, 20],
    idea: 'Smutspåsar med färgad lapp → tvättmaskin → torktumlare → vikbordet → kunden med samma lapp (bonus per färdig påse).' },
];

export const NEW_HOMES = [
  { id: 'husvagn', icon: '🚐', name: 'Husvagnen', deposit: 0, rent: 150, restBonus: -10, building: 'husvagn',
    desc: 'En rostig husvagn på tomten i förorten. Billigast i stan – om du tål kylan.' },
  { id: 'hoghus', icon: '🏢', name: 'Förortsettan', deposit: 500, rent: 250, restBonus: -5, building: 'hoghus',
    desc: 'Ett rum och kök på sjunde våningen i Betongvägen 1. Hissen går ibland.' },
  { id: 'radhus', icon: '🏡', name: 'Radhuset', deposit: 4000, rent: 800, restBonus: 15, building: 'radhus',
    desc: 'Eget radhus på Söder med en liten trädgård. Grannarna grillar på lördagar.' },
  { id: 'takvaning', icon: '🏙️', name: 'Takvåningen', deposit: 20000, rent: 2000, restBonus: 25, building: 'tornhuset',
    desc: 'Högst upp i Tornhuset – terrass med utsikt över hela Pixelstaden.' },
];

// Vilket hus varje bostad ligger i (v1-bostäderna ligger alla på Pixelgatan 1).
export const HOME_BUILDING = {
  rum: 'hem', lagenhet: 'hem', villa: 'hem',
  ...Object.fromEntries(NEW_HOMES.map((h) => [h.id, h.building])),
};
export const homeBuildingId = (homeId) => HOME_BUILDING[homeId] || 'hem';

// Butiker utan egen scen ännu: vart dörren leder i dag och ett förslag.
export const SHOPS_EXTRA = [
  { id: 'narbutik', building: 'narbutik', enter: 'mat', idea: 'Egen scen: trång butik med galler, dyrare än Stormarknad men öppen sent; allt kostar +20 %.' },
  { id: 'pantbank', building: 'pantbank', enter: null, idea: 'Sälj möbler ur förrådet för halva priset, låna pengar mot pant.' },
  { id: 'kebab', building: 'kebab', enter: null, idea: 'Ät direkt (som kaféet): kebabrulle 45 kr, mättar 55.' },
  { id: 'kiosk', building: 'kiosk', enter: null, idea: 'Lotter (skraplott 25 kr, liten chans på 500 kr) och kvällstidningen.' },
  { id: 'bio', building: 'bio', enter: null, idea: 'Se en film (80 kr, 2 h): +energi/humör, bara kvällar.' },
];
