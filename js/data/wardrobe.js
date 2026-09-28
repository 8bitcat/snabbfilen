// Klädkatalogen: allt man kan äga och ha på sig. Samlar wardrobe-tops.js,
// wardrobe-bottoms.js och wardrobe-acc.js och ger hjälpfunktioner åt
// avatarredigeraren, klädaffären och sparfilerna.
//
// Post: {
//   id:     unikt, 'slot-modell[-variant]', t.ex. 'top-hoodie-camo' (ändra aldrig ett id som släppts)
//   slot:   'top' | 'bottom' | 'shoes' | 'hat' | 'glasses' | 'bag' | 'neck' | 'jewel' | 'hairAcc' | 'phones'
//   look:   modellfälten plagget sätter, t.ex. { top: 'hoodie', topPrint: 'camo' }. Fält i
//           platsen som inte nämns återställs till grundvärdet (SLOT_FIELDS) när man tar på plagget.
//   name:   svenskt namn i butiken ('Kamouflagehuvtröja')
//   price:  kr, 60–2500 (basplagg ~60–150, vardag 150–600, märkes/fest 600–2500)
//   dept:   'tjej' | 'kille' | 'unisex' – avdelningen i klädaffären
//   free:   true = basplagg som alla äger från start (säljs inte)
//   icon?:  emoji i listor, colors?: föreslagna färger { shirt, accent, print2, pants, … },
//   legacy?: gamla sparfilers nyckel 'kind:v' (bara det första sortimentet)
//   group?: underrubrik i redigeraren (annars registerpostens group)
//   tile?:  utsnitt i redigerarens ruta (TILE_VIEWS; annars registerpostens tile, annars flikens)
// }
import { WARDROBE_TOPS } from './wardrobe-tops.js';
import { WARDROBE_BOTTOMS, WARDROBE_SHOES } from './wardrobe-bottoms.js';
import { WARDROBE_ACC } from './wardrobe-acc.js';
import { LOOK_FIELDS, LOOK_COLORS, idOf, isValid, entryOf } from '../core/people.js';

export const SLOTS = ['top', 'bottom', 'shoes', 'hat', 'glasses', 'bag', 'neck', 'jewel', 'hairAcc', 'phones'];

// Modellfälten varje plats äger, med grundvärdet när platsen är tom/bas
export const SLOT_FIELDS = {
  top: { top: 'tee', topPrint: 'none' },
  bottom: { bottom: 'jeans', bottomPrint: 'none' },
  shoes: { shoeType: 'normal' },
  hat: { hat: null },
  glasses: { glasses: false },
  bag: { bag: null },
  neck: { neck: 'none' },
  jewel: { jewel: 'none' },
  hairAcc: { hairAcc: 'none' },
  phones: { phones: false },
};
export const SLOT_LABELS = {
  top: 'Överdel', bottom: 'Underdel', shoes: 'Skor', hat: 'Huvudbonad', glasses: 'Glasögon', bag: 'Väska',
  neck: 'Hals', jewel: 'Smycken', hairAcc: 'I håret', phones: 'Hörlurar',
};
// Utsnitten redigerarens rutor kan visa (`tile` på ett plagg eller en registerpost)
export const TILE_VIEWS = ['head', 'face', 'neck', 'torso', 'legs', 'side', 'full'];
// Platser som kan vara tomma ("Ingen"). Överdel, underdel och skor har man alltid.
export const SLOT_CAN_BE_EMPTY = { hat: true, glasses: true, bag: true, neck: true, jewel: true, hairAcc: true, phones: true };

export const WARDROBE = [...WARDROBE_TOPS, ...WARDROBE_BOTTOMS, ...WARDROBE_SHOES, ...WARDROBE_ACC];

const BY_ID = new Map();
const LEGACY = new Map();
for (const it of WARDROBE) {
  if (BY_ID.has(it.id)) console.warn(`[wardrobe] dubblett-id: ${it.id}`);
  BY_ID.set(it.id, it);
  if (it.legacy) LEGACY.set(it.legacy, it.id);
}

export const itemById = (id) => BY_ID.get(id) || null;
export const itemsForSlot = (slot) => WARDROBE.filter((it) => it.slot === slot);
export const freeItemIds = () => WARDROBE.filter((it) => it.free).map((it) => it.id);
// Gamla sparfilers garderobsnyckel 'kind:v' (t.ex. 'hat:cap', 'phones:true') → nytt id
export const legacyKeyToId = (key) => LEGACY.get(String(key)) || null;
// Nytt id → gamla nyckeln (för kod som fortfarande använder 'kind:v'), eller null
export const idToLegacyKey = (id) => itemById(id)?.legacy || null;

// Plaggets fält i platsen: grundvärden + plaggets egna
const slotLook = (it) => ({ ...SLOT_FIELDS[it.slot], ...it.look });

// Looken med plagget påtaget. base = nuvarande look (färger m.m. behålls).
// { colors: true } lägger även på plaggets föreslagna färger.
export function lookForItem(item, base = {}, { colors = false } = {}) {
  const it = typeof item === 'string' ? itemById(item) : item;
  if (!it) return { ...base };
  return { ...base, ...slotLook(it), ...(colors && it.colors ? it.colors : {}) };
}
// Looken med platsen tömd/återställd till bas (t.ex. ingen hatt)
export const lookWithoutSlot = (slot, base = {}) => ({ ...base, ...SLOT_FIELDS[slot] });

// Har looken just det här plagget på sig? (alla platsens fält lika, tomma värden normaliseras)
export function isWorn(item, look) {
  const it = typeof item === 'string' ? itemById(item) : item;
  if (!it || !look) return false;
  const want = slotLook(it);
  for (const f in want) {
    if (!LOOK_FIELDS[f]) { if (look[f] !== want[f]) return false; continue; }
    if (idOf(f, cur(look, f)) !== idOf(f, want[f])) return false;
  }
  return true;
}
// fältets värde som det ritas (saknat fält ⇒ motorns standard)
const cur = (look, f) => (look[f] === undefined ? LOOK_FIELDS[f].def : look[f]);
// Vilket katalogplagg har looken på sig i platsen? null = platsen tom eller en kombination
// som inte finns i katalogen.
export function wornItem(look, slot) {
  for (const it of WARDROBE) if (it.slot === slot && isWorn(it, look)) return it;
  return null;
}
// Är platsen tom (t.ex. ingen hatt)?
export function slotIsEmpty(look, slot) {
  return Object.keys(SLOT_FIELDS[slot]).every((f) => idOf(f, cur(look || {}, f)) === idOf(f, SLOT_FIELDS[slot][f]));
}

// Kontroll för verktyg/granskare: returnerar en lista med problem (tom = allt ok)
export function checkWardrobe() {
  const out = [], seen = new Set(), combos = new Map();
  for (const it of WARDROBE) {
    const where = it.id || JSON.stringify(it).slice(0, 40);
    if (!it.id || typeof it.id !== 'string') out.push(`${where}: saknar id`);
    if (seen.has(it.id)) out.push(`${where}: dubblett-id`);
    seen.add(it.id);
    if (!SLOTS.includes(it.slot)) out.push(`${where}: okänd slot '${it.slot}'`);
    if (!it.name) out.push(`${where}: saknar name`);
    if (!it.free && !(it.price >= 60 && it.price <= 2500)) out.push(`${where}: pris ${it.price} utanför 60–2500`);
    if (!['tjej', 'kille', 'unisex'].includes(it.dept)) out.push(`${where}: okänd dept '${it.dept}'`);
    if (!it.look || typeof it.look !== 'object') { out.push(`${where}: saknar look`); continue; }
    for (const [f, v] of Object.entries(it.look)) {
      if (LOOK_FIELDS[f]) { if (!isValid(f, v)) out.push(`${where}: look.${f} = ${JSON.stringify(v)} finns inte i registret`); }
      else out.push(`${where}: look.${f} är inget modellfält (färger hör hemma i colors)`);
      if (SLOT_FIELDS[it.slot] && !(f in SLOT_FIELDS[it.slot])) out.push(`${where}: look.${f} hör inte till platsen ${it.slot}`);
    }
    if (it.tile != null && !TILE_VIEWS.includes(it.tile)) out.push(`${where}: tile '${it.tile}' finns inte (${TILE_VIEWS.join('/')})`);
    for (const [f, v] of Object.entries(it.colors || {})) {
      if (!(f in LOOK_COLORS)) out.push(`${where}: colors.${f} är inget färgfält`);
      else if (!/^#[0-9a-f]{6}$/i.test(v)) out.push(`${where}: colors.${f} = ${v} är ingen #rrggbb`);
    }
    if (SLOT_FIELDS[it.slot]) {
      const key = it.slot + '|' + JSON.stringify(Object.keys(SLOT_FIELDS[it.slot]).map((f) => idOf(f, slotLook(it)[f])));
      if (combos.has(key)) out.push(`${where}: samma modell som ${combos.get(key)} (två plagg kan inte se likadana ut)`);
      else combos.set(key, it.id);
    }
  }
  return out;
}

// Registerpostens underrubrik för ett plagg (för gruppering i redigeraren/butiken)
export function groupOf(it) {
  if (it.group) return it.group;
  const main = Object.keys(SLOT_FIELDS[it.slot] || {})[0];
  return (main && entryOf(main, it.look[main])?.group) || '';
}
