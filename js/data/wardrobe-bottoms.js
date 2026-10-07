// Klädkatalogen: underdelar (byxor, shorts, kjolar, klänningar, overaller) och skor.
// Se js/data/wardrobe.js för postformatet och docs/PEOPLE-ARKITEKTUR.md.
// legacy = nyckeln i gamla sparfiler ('kind:v') – ändra aldrig på de gamla.
// Ordningen = ordningen i redigeraren och butiken (underrubrikerna i första förekomstens ordning).
// Långa namn har mjuka bindestreck (\u00ad) så att de bryts snyggt i rutorna.
// Modellerna ritas i js/core/people/bottoms.js (BOTTOM_REG, BOTTOM_PRINT_REG, SHOE_REG).
// colors är förslag (mannekäng + när man köper): klänningar/jumpsuits färgas med shirt,
// allt annat med pants; mönstret (bottomPrint) och detaljer med pants2; skor shoes/shoes2.
import { $t } from '../core/i18n.js';
export const WARDROBE_BOTTOMS = [
  // ---- långbyxor (jeans och byxor är gratis basplagg) ----
  { id: 'bottom-jeans', slot: 'bottom', look: { bottom: 'jeans' }, name: $t('Jeans'), price: 60, dept: 'unisex', free: true, icon: '👖', legacy: 'bottom:jeans' },
  { id: 'bottom-pants', slot: 'bottom', look: { bottom: 'pants' }, name: $t('Byxor'), price: 60, dept: 'unisex', free: true, icon: '👖', legacy: 'bottom:pants' },
  { id: 'bottom-jeansRipped', slot: 'bottom', look: { bottom: 'jeansRipped' }, name: $t('Slitna jeans'), price: 449, dept: 'unisex', icon: '👖', colors: { pants: '#4f79ad' } },
  { id: 'bottom-jeansCuffed', slot: 'bottom', look: { bottom: 'jeansCuffed' }, name: $t('Uppvikta jeans'), price: 399, dept: 'unisex', icon: '👖', colors: { pants: '#3f5f8f' } },
  { id: 'bottom-jeansFlare', slot: 'bottom', look: { bottom: 'jeansFlare' }, name: $t('Ut\u00adsvängda jeans'), price: 499, dept: 'tjej', icon: '👖', colors: { pants: '#5a82b8' } },
  { id: 'bottom-jeansBaggy', slot: 'bottom', look: { bottom: 'jeansBaggy' }, name: $t('Baggy jeans'), price: 549, dept: 'kille', icon: '👖', colors: { pants: '#35507a' } },
  { id: 'bottom-jeansHigh', slot: 'bottom', look: { bottom: 'jeansHigh' }, name: $t('Hög\u00admidjade jeans'), price: 529, dept: 'tjej', icon: '👖', colors: { pants: '#6a8fc4' } },
  { id: 'bottom-jeansPatched', slot: 'bottom', look: { bottom: 'jeansPatched' }, name: $t('Lappade jeans'), price: 429, dept: 'unisex', icon: '👖', colors: { pants: '#3f5f8f', pants2: '#c9323a' } },
  { id: 'bottom-jeans-stonewash', slot: 'bottom', look: { bottom: 'jeans', bottomPrint: 'stonewash' }, name: $t('Stent\u00advättade jeans'), price: 449, dept: 'unisex', icon: '👖', colors: { pants: '#4a6a9c' } },
  { id: 'bottom-jeans-splatter', slot: 'bottom', look: { bottom: 'jeans', bottomPrint: 'splatter' }, name: $t('Färg\u00adstänkta jeans'), price: 479, dept: 'unisex', icon: '👖', colors: { pants: '#4f79ad', pants2: '#46a35a' } },
  { id: 'bottom-cargo', slot: 'bottom', look: { bottom: 'cargo' }, name: $t('Cargo\u00adbyxor'), price: 449, dept: 'unisex', icon: '👖', colors: { pants: '#6b6a4a' } },
  { id: 'bottom-cargo-camo', slot: 'bottom', look: { bottom: 'cargo', bottomPrint: 'camo' }, name: $t('Kamouflage\u00adbyxor'), price: 529, dept: 'kille', icon: '👖', colors: { pants: '#6b7a4a', pants2: '#3f4a2c' } },
  { id: 'bottom-chinos', slot: 'bottom', look: { bottom: 'chinos' }, name: $t('Chinos'), price: 399, dept: 'kille', icon: '👖', colors: { pants: '#b8a47a' } },
  { id: 'bottom-suitPants', slot: 'bottom', look: { bottom: 'suitPants' }, name: $t('Kostym\u00adbyxor'), price: 699, dept: 'kille', icon: '👖', colors: { pants: '#2f3440' } },
  { id: 'bottom-suitPants-pinstripe', slot: 'bottom', look: { bottom: 'suitPants', bottomPrint: 'pinstripe' }, name: $t('Kritstrecks\u00adbyxor'), price: 849, dept: 'kille', icon: '👖', colors: { pants: '#2b2b30', pants2: '#6f7078' } },
  { id: 'bottom-corduroy', slot: 'bottom', look: { bottom: 'corduroy' }, name: $t('Manchester\u00adbyxor'), price: 479, dept: 'unisex', icon: '👖', colors: { pants: '#8a5a32' } },
  { id: 'bottom-leather', slot: 'bottom', look: { bottom: 'leather' }, name: $t('Skinn\u00adbyxor'), price: 1290, dept: 'unisex', icon: '👖', colors: { pants: '#26222a' } },
  { id: 'bottom-wide', slot: 'bottom', look: { bottom: 'wide' }, name: $t('Vida byxor'), price: 549, dept: 'tjej', icon: '👖', colors: { pants: '#e8e3d6' } },
  { id: 'bottom-wide-zebra', slot: 'bottom', look: { bottom: 'wide', bottomPrint: 'zebra' }, name: $t('Zebra\u00adbyxor'), price: 649, dept: 'tjej', icon: '🦓', colors: { pants: '#f4f1ea', pants2: '#1c1c1c' } },
  { id: 'bottom-capri', slot: 'bottom', look: { bottom: 'capri' }, name: $t('Capri\u00adbyxor'), price: 299, dept: 'tjej', icon: '👖', colors: { pants: '#e0a02a' } },
  { id: 'bottom-pants-tartan', slot: 'bottom', look: { bottom: 'pants', bottomPrint: 'tartan' }, name: $t('Rutiga byxor'), price: 429, dept: 'unisex', icon: '👖', colors: { pants: '#b83d3d', pants2: '#26605a' } },
  { id: 'bottom-jodhpurs', slot: 'bottom', look: { bottom: 'jodhpurs' }, name: $t('Rid\u00adbyxor'), price: 749, dept: 'tjej', icon: '🏇', colors: { pants: '#e3d6b8' } },
  { id: 'bottom-knickers', slot: 'bottom', look: { bottom: 'knickers' }, name: $t('Knickers'), price: 549, dept: 'kille', icon: '⛳', colors: { pants: '#7a6a4f', pants2: '#2f6a4a' } },
  { id: 'bottom-knickers-checks', slot: 'bottom', look: { bottom: 'knickers', bottomPrint: 'checks' }, name: $t('Rutiga golf\u00adbyxor'), price: 599, dept: 'kille', icon: '⛳', colors: { pants: '#b8a47a', pants2: '#8e2f3e' } },
  { id: 'bottom-culottes', slot: 'bottom', look: { bottom: 'culottes' }, name: $t('Byxkjol'), price: 449, dept: 'tjej', icon: '👖', colors: { pants: '#b5773a' } },

  // ---- mjukis & träning ----
  { id: 'bottom-joggers', slot: 'bottom', look: { bottom: 'joggers' }, name: $t('Joggers'), price: 299, dept: 'unisex', icon: '👖', colors: { pants: '#5f6670' } },
  { id: 'bottom-sweatpants', slot: 'bottom', look: { bottom: 'sweatpants' }, name: $t('Mjukis\u00adbyxor'), price: 199, dept: 'unisex', icon: '👖', colors: { pants: '#8a8f98' } },
  { id: 'bottom-sweatpants-tiedye', slot: 'bottom', look: { bottom: 'sweatpants', bottomPrint: 'tiedye' }, name: $t('Batik\u00admjukis'), price: 299, dept: 'unisex', icon: '🌀', colors: { pants: '#8e5bd1', pants2: '#2aa39a' } },
  { id: 'bottom-trackPants', slot: 'bottom', look: { bottom: 'trackPants' }, name: $t('Tränings\u00adbyxor'), price: 349, dept: 'unisex', icon: '🏃', colors: { pants: '#1f2a44', pants2: '#f4f1ea' } },
  { id: 'bottom-leggings', slot: 'bottom', look: { bottom: 'leggings' }, name: $t('Leggings'), price: 179, dept: 'tjej', icon: '🧘', colors: { pants: '#2b2b30' } },
  { id: 'bottom-leggings-leopard', slot: 'bottom', look: { bottom: 'leggings', bottomPrint: 'leopard' }, name: $t('Leopard\u00adleggings'), price: 249, dept: 'tjej', icon: '🐆', colors: { pants: '#d9a95c', pants2: '#3b2619' } },
  { id: 'bottom-leggings-stars', slot: 'bottom', look: { bottom: 'leggings', bottomPrint: 'stars' }, name: $t('Stjärn\u00adleggings'), price: 229, dept: 'tjej', icon: '⭐', colors: { pants: '#3f4fa8', pants2: '#f0e070' } },
  { id: 'bottom-leggings-stripesH', slot: 'bottom', look: { bottom: 'leggings', bottomPrint: 'stripesH' }, name: $t('Randiga leggings'), price: 219, dept: 'unisex', icon: '🧦', colors: { pants: '#f4f1ea', pants2: '#c9323a' } },
  { id: 'bottom-leggings-skeleton', slot: 'bottom', look: { bottom: 'leggings', bottomPrint: 'skeleton' }, name: $t('Skelett­byxor'), price: 249, dept: 'unisex', icon: '💀', colors: { pants: '#1c1c22', pants2: '#f4f1ea' } },
  { id: 'bottom-pajamas', slot: 'bottom', look: { bottom: 'pajamas' }, name: $t('Pyjamas\u00adbyxor'), price: 229, dept: 'unisex', icon: '😴', colors: { pants: '#8fb3d9', pants2: '#f4f1ea' } },
  { id: 'bottom-pajamas-checks', slot: 'bottom', look: { bottom: 'pajamas', bottomPrint: 'checks' }, name: $t('Rutiga pyjamas\u00adbyxor'), price: 279, dept: 'unisex', icon: '😴', colors: { pants: '#3a7bd5', pants2: '#f4f1ea' } },
  { id: 'bottom-pajamas-hearts', slot: 'bottom', look: { bottom: 'pajamas', bottomPrint: 'hearts' }, name: $t('Hjärt\u00adpyjamas'), price: 259, dept: 'unisex', icon: '💗', colors: { pants: '#f2b8c9', pants2: '#c9323a' } },
  { id: 'bottom-harem', slot: 'bottom', look: { bottom: 'harem' }, name: $t('Harems\u00adbyxor'), price: 329, dept: 'unisex', icon: '🧘', colors: { pants: '#7a4fa8' } },
  { id: 'bottom-harem-flowers', slot: 'bottom', look: { bottom: 'harem', bottomPrint: 'flowers' }, name: $t('Blommiga harems\u00adbyxor'), price: 379, dept: 'unisex', icon: '🌺', colors: { pants: '#5a2e5a', pants2: '#f0b429' } },

  // ---- shorts (shorts är från klädaffärens första sortiment) ----
  { id: 'bottom-shorts', slot: 'bottom', look: { bottom: 'shorts' }, name: $t('Shorts'), price: 120, dept: 'unisex', icon: '🩳', legacy: 'bottom:shorts' },
  { id: 'bottom-bermuda', slot: 'bottom', look: { bottom: 'bermuda' }, name: $t('Bermuda\u00adshorts'), price: 279, dept: 'kille', icon: '🩳', colors: { pants: '#b8a47a' } },
  { id: 'bottom-cargoShorts', slot: 'bottom', look: { bottom: 'cargoShorts' }, name: $t('Cargo\u00adshorts'), price: 299, dept: 'kille', icon: '🩳', colors: { pants: '#6b6a4a' } },
  { id: 'bottom-cargoShorts-camo', slot: 'bottom', look: { bottom: 'cargoShorts', bottomPrint: 'camo' }, name: $t('Kamouflage\u00adshorts'), price: 349, dept: 'kille', icon: '🩳', colors: { pants: '#6b7a4a', pants2: '#3f4a2c' } },
  { id: 'bottom-denimShorts', slot: 'bottom', look: { bottom: 'denimShorts' }, name: $t('Jeans\u00adshorts'), price: 279, dept: 'tjej', icon: '🩳', colors: { pants: '#6a8fc4' } },
  { id: 'bottom-swimTrunks', slot: 'bottom', look: { bottom: 'swimTrunks' }, name: $t('Badbyxor'), price: 199, dept: 'kille', icon: '🩱', colors: { pants: '#2aa39a' } },
  { id: 'bottom-swimTrunks-flowers', slot: 'bottom', look: { bottom: 'swimTrunks', bottomPrint: 'flowers' }, name: $t('Hawaii\u00adbadbyxor'), price: 249, dept: 'kille', icon: '🌺', colors: { pants: '#e07a2e', pants2: '#f4f1ea' } },
  { id: 'bottom-bikeShorts', slot: 'bottom', look: { bottom: 'bikeShorts' }, name: $t('Cykel\u00adbyxor'), price: 249, dept: 'unisex', icon: '🚴', colors: { pants: '#1c1c22' } },
  { id: 'bottom-sportShorts', slot: 'bottom', look: { bottom: 'sportShorts' }, name: $t('Tränings\u00adshorts'), price: 229, dept: 'unisex', icon: '🩳', colors: { pants: '#2f3440', pants2: '#f0b429' } },
  { id: 'bottom-shorts-rainbow', slot: 'bottom', look: { bottom: 'shorts', bottomPrint: 'rainbow' }, name: $t('Regnbågs\u00adshorts'), price: 249, dept: 'unisex', icon: '🌈' },

  // ---- kjolar ----
  { id: 'bottom-skirt', slot: 'bottom', look: { bottom: 'skirt' }, name: $t('Kjol'), price: 200, dept: 'tjej', icon: '👗', legacy: 'bottom:skirt' },
  { id: 'bottom-miniSkirt', slot: 'bottom', look: { bottom: 'miniSkirt' }, name: $t('Minikjol'), price: 249, dept: 'tjej', icon: '👗', colors: { pants: '#2b2b30' } },
  { id: 'bottom-miniSkirt-sequins', slot: 'bottom', look: { bottom: 'miniSkirt', bottomPrint: 'sequins' }, name: $t('Glitter\u00adkjol'), price: 449, dept: 'tjej', icon: '✨', colors: { pants: '#b83d7a' } },
  { id: 'bottom-pleated', slot: 'bottom', look: { bottom: 'pleated' }, name: $t('Plisserad kjol'), price: 399, dept: 'tjej', icon: '👗', colors: { pants: '#2d3a5c' } },
  { id: 'bottom-pleated-tartan', slot: 'bottom', look: { bottom: 'pleated', bottomPrint: 'tartan' }, name: $t('Skotskrutig kjol'), price: 449, dept: 'tjej', icon: '👗', colors: { pants: '#b7392b', pants2: '#26605a' } },
  { id: 'bottom-tutu', slot: 'bottom', look: { bottom: 'tutu' }, name: $t('Tyllkjol'), price: 349, dept: 'tjej', icon: '🩰', colors: { pants: '#f28bb3' } },
  { id: 'bottom-tutu-rainbow', slot: 'bottom', look: { bottom: 'tutu', bottomPrint: 'rainbow' }, name: $t('Regnbågs\u00adtutu'), price: 399, dept: 'tjej', icon: '🌈', colors: { pants: '#f4f1ea' } },
  { id: 'bottom-denimSkirt', slot: 'bottom', look: { bottom: 'denimSkirt' }, name: $t('Jeanskjol'), price: 329, dept: 'tjej', icon: '👗', colors: { pants: '#4f79ad' } },
  { id: 'bottom-longSkirt', slot: 'bottom', look: { bottom: 'longSkirt' }, name: $t('Lång kjol'), price: 449, dept: 'tjej', icon: '👗', colors: { pants: '#7a2e3e' } },
  { id: 'bottom-longSkirt-flowers', slot: 'bottom', look: { bottom: 'longSkirt', bottomPrint: 'flowers' }, name: $t('Blommig lång\u00adkjol'), price: 499, dept: 'tjej', icon: '🌸', colors: { pants: '#26605a', pants2: '#f28bb3' } },
  { id: 'bottom-pencil', slot: 'bottom', look: { bottom: 'pencil' }, name: $t('Pennkjol'), price: 499, dept: 'tjej', icon: '👗', colors: { pants: '#2f3440' } },
  { id: 'bottom-ruffle', slot: 'bottom', look: { bottom: 'ruffle' }, name: $t('Volangkjol'), price: 429, dept: 'tjej', icon: '👗', colors: { pants: '#f0b429' } },
  { id: 'bottom-skirt-dots', slot: 'bottom', look: { bottom: 'skirt', bottomPrint: 'dots' }, name: $t('Prickig kjol'), price: 279, dept: 'tjej', icon: '👗', colors: { pants: '#c9323a', pants2: '#f4f1ea' } },
  { id: 'bottom-wrapSkirt', slot: 'bottom', look: { bottom: 'wrapSkirt' }, name: $t('Omlott\u00adkjol'), price: 429, dept: 'tjej', icon: '👗', colors: { pants: '#c46a3a', pants2: '#f4f1ea' } },
  { id: 'bottom-wrapSkirt-flowers', slot: 'bottom', look: { bottom: 'wrapSkirt', bottomPrint: 'flowers' }, name: $t('Blommig omlott\u00adkjol'), price: 479, dept: 'tjej', icon: '🌺', colors: { pants: '#2d3a5c', pants2: '#f28bb3' } },
  { id: 'bottom-tennisSkirt', slot: 'bottom', look: { bottom: 'tennisSkirt' }, name: $t('Tennis\u00adkjol'), price: 329, dept: 'tjej', icon: '🎾', colors: { pants: '#f4f1ea', pants2: '#2d3a5c' } },
  { id: 'bottom-kilt', slot: 'bottom', look: { bottom: 'kilt' }, name: $t('Kilt'), price: 649, dept: 'kille', icon: '🏴', colors: { pants: '#55604a' } },
  { id: 'bottom-kilt-tartan', slot: 'bottom', look: { bottom: 'kilt', bottomPrint: 'tartan' }, name: $t('Skotsk kilt'), price: 899, dept: 'kille', icon: '🏴', colors: { pants: '#2e7358', pants2: '#1f2a44' } },
  // folkdräktskjolen hör ihop med folkdräktslivet (top-folk i wardrobe-tops.js): samma röda som livets snörning
  { id: 'bottom-folkdrakt', slot: 'bottom', look: { bottom: 'folkdrakt' }, name: $t('Folk\u00addräkts\u00adkjol'), price: 1290, dept: 'tjej', icon: '🌼', colors: { pants: '#2b2b30', pants2: '#c9323a' } },

  // ---- klänningar (färgen är överdelens) ----
  { id: 'bottom-dress', slot: 'bottom', look: { bottom: 'dress' }, name: $t('Klänning'), price: 380, dept: 'tjej', icon: '👗', legacy: 'bottom:dress' },
  { id: 'bottom-sundress', slot: 'bottom', look: { bottom: 'sundress' }, name: $t('Sommar\u00adklänning'), price: 499, dept: 'tjej', icon: '👗', colors: { shirt: '#f2d680', pants2: '#f4f1ea' } },
  { id: 'bottom-sundress-flowers', slot: 'bottom', look: { bottom: 'sundress', bottomPrint: 'flowers' }, name: $t('Blommig sommar\u00adklänning'), price: 549, dept: 'tjej', icon: '🌼', colors: { shirt: '#8fc4e8', pants2: '#f4f1ea' } },
  { id: 'bottom-sundress-checks', slot: 'bottom', look: { bottom: 'sundress', bottomPrint: 'checks' }, name: $t('Rutig sommar\u00adklänning'), price: 529, dept: 'tjej', icon: '👗', colors: { shirt: '#f4f1ea', pants2: '#c9323a' } },
  { id: 'bottom-dress-dots', slot: 'bottom', look: { bottom: 'dress', bottomPrint: 'dots' }, name: $t('Prickig klän\u00adning'), price: 449, dept: 'tjej', icon: '👗', colors: { shirt: '#2d3a5c', pants2: '#f4f1ea' } },
  { id: 'bottom-gown', slot: 'bottom', look: { bottom: 'gown' }, name: $t('Bal\u00adklänning'), price: 1890, dept: 'tjej', icon: '👗', colors: { shirt: '#3a2a6a', pants2: '#f0b429' } },
  { id: 'bottom-princess', slot: 'bottom', look: { bottom: 'princess' }, name: $t('Prinsess\u00adklänning'), price: 1290, dept: 'tjej', icon: '👸', colors: { shirt: '#f28bb3', pants2: '#f0b429' } },
  { id: 'bottom-maxiDress', slot: 'bottom', look: { bottom: 'maxiDress' }, name: $t('Maxi\u00adklänning'), price: 649, dept: 'tjej', icon: '👗', colors: { shirt: '#2aa39a' } },
  { id: 'bottom-shirtDress', slot: 'bottom', look: { bottom: 'shirtDress' }, name: $t('Skjort\u00adklänning'), price: 549, dept: 'tjej', icon: '👗', colors: { shirt: '#9ab6d0', accent: '#f4f1ea' } },
  { id: 'bottom-partyDress', slot: 'bottom', look: { bottom: 'partyDress' }, name: $t('Fest\u00adklänning'), price: 899, dept: 'tjej', icon: '🎉', colors: { shirt: '#b83d7a' } },
  { id: 'bottom-sweaterDress', slot: 'bottom', look: { bottom: 'sweaterDress' }, name: $t('Tröj\u00adklänning'), price: 449, dept: 'tjej', icon: '🧶', colors: { shirt: '#b9b3ab' } },
  { id: 'bottom-lucia', slot: 'bottom', look: { bottom: 'lucia' }, name: $t('Lucia\u00adklänning'), price: 399, dept: 'unisex', icon: '🕯️', colors: { shirt: '#f6f3ec', pants2: '#c9323a' } },
  { id: 'bottom-weddingDress', slot: 'bottom', look: { bottom: 'weddingDress' }, name: $t('Brud\u00adklänning'), price: 2490, dept: 'tjej', icon: '💍', colors: { shirt: '#f6f3ec' } },

  // ---- overaller & hängsel ----
  { id: 'bottom-jumpsuit', slot: 'bottom', look: { bottom: 'jumpsuit' }, name: $t('Jumpsuit'), price: 749, dept: 'tjej', icon: '👗', colors: { shirt: '#2f3440' } },
  { id: 'bottom-playsuit', slot: 'bottom', look: { bottom: 'playsuit' }, name: $t('Byxdress'), price: 549, dept: 'tjej', icon: '👗', colors: { shirt: '#f28bb3' } },
  { id: 'bottom-dungarees', slot: 'bottom', look: { bottom: 'dungarees' }, name: $t('Snickar\u00adbyxor'), price: 549, dept: 'unisex', icon: '🔨', colors: { pants: '#4f79ad' } },
  { id: 'bottom-dungareeShorts', slot: 'bottom', look: { bottom: 'dungareeShorts' }, name: $t('Snickar\u00adshorts'), price: 399, dept: 'unisex', icon: '🩳', colors: { pants: '#6a8fc4' } },
  { id: 'bottom-pinafore', slot: 'bottom', look: { bottom: 'pinafore' }, name: $t('Hängsel\u00adkjol'), price: 449, dept: 'tjej', icon: '👗', colors: { pants: '#7a2e3e' } },
  { id: 'bottom-suspenders', slot: 'bottom', look: { bottom: 'suspenders' }, name: $t('Hängsel\u00adbyxor'), price: 499, dept: 'kille', icon: '👖', colors: { pants: '#5a4632', pants2: '#c9323a' } },
  { id: 'bottom-rainPants', slot: 'bottom', look: { bottom: 'rainPants' }, name: $t('Regnbyxor'), price: 349, dept: 'unisex', icon: '☔', colors: { pants: '#f0b429' } },
  { id: 'bottom-skiPants', slot: 'bottom', look: { bottom: 'skiPants' }, name: $t('Täckbyxor'), price: 599, dept: 'unisex', icon: '⛷️', colors: { pants: '#2d3a5c' } },
  { id: 'bottom-coverall', slot: 'bottom', look: { bottom: 'coverall' }, name: $t('Overall'), price: 699, dept: 'unisex', icon: '🔧', colors: { pants: '#e07a2e' } },
  { id: 'bottom-snowsuit', slot: 'bottom', look: { bottom: 'snowsuit' }, name: $t('Vinter\u00adoverall'), price: 899, dept: 'unisex', icon: '❄️', colors: { pants: '#c9323a' } },
];

export const WARDROBE_SHOES = [
  // ---- vardag (vanliga skor är gratis) ----
  { id: 'shoes-normal', slot: 'shoes', look: { shoeType: 'normal' }, name: $t('Vanliga skor'), price: 60, dept: 'unisex', free: true, icon: '👟' },

  // ---- sneakers ----
  { id: 'shoes-sneakers', slot: 'shoes', look: { shoeType: 'sneakers' }, name: $t('Sneakers'), price: 499, dept: 'unisex', icon: '👟', colors: { shoes: '#3a7bd5', shoes2: '#f4f1ea' } },
  { id: 'shoes-highTops', slot: 'shoes', look: { shoeType: 'highTops' }, name: $t('Höga sneakers'), price: 549, dept: 'unisex', icon: '👟', colors: { shoes: '#c9323a', shoes2: '#f4f1ea' } },
  { id: 'shoes-slipOn', slot: 'shoes', look: { shoeType: 'slipOn' }, name: $t('Rutiga tyg\u00adskor'), price: 399, dept: 'unisex', icon: '👟', colors: { shoes: '#2b2b30', shoes2: '#f4f1ea' } },
  { id: 'shoes-lightUp', slot: 'shoes', look: { shoeType: 'lightUp' }, name: $t('Blinkskor'), price: 449, dept: 'unisex', icon: '💡', colors: { shoes: '#f28bb3', shoes2: '#f4f1ea' } },
  { id: 'shoes-velcro', slot: 'shoes', look: { shoeType: 'velcro' }, name: $t('Kardborre\u00adskor'), price: 299, dept: 'unisex', icon: '👟', colors: { shoes: '#3a7bd5', shoes2: '#f0b429' } },

  // ---- kängor & stövlar ----
  { id: 'shoes-boots', slot: 'shoes', look: { shoeType: 'boots' }, name: $t('Kängor'), price: 899, dept: 'unisex', icon: '🥾', colors: { shoes: '#6b3e1e' } },
  { id: 'shoes-rubberBoots', slot: 'shoes', look: { shoeType: 'rubberBoots' }, name: $t('Gummi\u00adstövlar'), price: 349, dept: 'unisex', icon: '🥾', colors: { shoes: '#3f7a3a' } },
  { id: 'shoes-ridingBoots', slot: 'shoes', look: { shoeType: 'ridingBoots' }, name: $t('Rid\u00adstövlar'), price: 1190, dept: 'tjej', icon: '👢', colors: { shoes: '#3b2619' } },
  { id: 'shoes-cowboyBoots', slot: 'shoes', look: { shoeType: 'cowboyBoots' }, name: $t('Cowboy\u00adstövlar'), price: 1290, dept: 'unisex', icon: '🤠', colors: { shoes: '#a86b32' } },
  { id: 'shoes-winterBoots', slot: 'shoes', look: { shoeType: 'winterBoots' }, name: $t('Vinter\u00adkängor'), price: 799, dept: 'unisex', icon: '🥾', colors: { shoes: '#2f3440' } },
  { id: 'shoes-ankleBoots', slot: 'shoes', look: { shoeType: 'ankleBoots' }, name: $t('Stöv\u00adletter'), price: 899, dept: 'tjej', icon: '👢', colors: { shoes: '#2b2b30' } },

  // ---- fina skor ----
  { id: 'shoes-dressShoes', slot: 'shoes', look: { shoeType: 'dressShoes' }, name: $t('Finskor'), price: 999, dept: 'kille', icon: '👞', colors: { shoes: '#2b2b30' } },
  { id: 'shoes-ballerina', slot: 'shoes', look: { shoeType: 'ballerina' }, name: $t('Ballerina\u00adskor'), price: 399, dept: 'tjej', icon: '🥿', colors: { shoes: '#c9323a', shoes2: '#f4f1ea' } },
  { id: 'shoes-heels', slot: 'shoes', look: { shoeType: 'heels' }, name: $t('Klackskor'), price: 799, dept: 'tjej', icon: '👠', colors: { shoes: '#c9323a' } },
  { id: 'shoes-clogs', slot: 'shoes', look: { shoeType: 'clogs' }, name: $t('Träskor'), price: 599, dept: 'unisex', icon: '🪵', colors: { shoes: '#7a2e2e' } },

  // ---- sommar (barfota är gratis) ----
  { id: 'shoes-sandals', slot: 'shoes', look: { shoeType: 'sandals' }, name: $t('Sandaler'), price: 349, dept: 'unisex', icon: '👡', colors: { shoes: '#6b3e1e' } },
  { id: 'shoes-flipflops', slot: 'shoes', look: { shoeType: 'flipflops' }, name: $t('Flipflops'), price: 99, dept: 'unisex', icon: '🩴', colors: { shoes: '#2aa39a' } },
  { id: 'shoes-barefoot', slot: 'shoes', look: { shoeType: 'barefoot' }, name: $t('Barfota'), price: 60, dept: 'unisex', free: true, icon: '🦶' },

  // ---- hemma ----
  { id: 'shoes-slippers', slot: 'shoes', look: { shoeType: 'slippers' }, name: $t('Tofflor'), price: 199, dept: 'unisex', icon: '🥿', colors: { shoes: '#f28bb3' } },
  { id: 'shoes-animalSlippers', slot: 'shoes', look: { shoeType: 'animalSlippers' }, name: $t('Djur\u00adtofflor'), price: 249, dept: 'unisex', icon: '🐻', colors: { shoes: '#b98a5e', shoes2: '#f28bb3' } },
  { id: 'shoes-woolSocks', slot: 'shoes', look: { shoeType: 'woolSocks' }, name: $t('Ragg\u00adsockor'), price: 149, dept: 'unisex', icon: '🧦', colors: { shoes: '#b9b3ab', shoes2: '#f4f1ea' } },

  // ---- sport ----
  { id: 'shoes-cleats', slot: 'shoes', look: { shoeType: 'cleats' }, name: $t('Fotbolls\u00adskor'), price: 699, dept: 'unisex', icon: '⚽', colors: { shoes: '#2b2b30', shoes2: '#f0b429' } },
  { id: 'shoes-rollerSkates', slot: 'shoes', look: { shoeType: 'rollerSkates' }, name: $t('Rull\u00adskridskor'), price: 899, dept: 'unisex', icon: '🛼', colors: { shoes: '#f4f1ea', shoes2: '#f28bb3' } },
  { id: 'shoes-iceSkates', slot: 'shoes', look: { shoeType: 'iceSkates' }, name: $t('Skridskor'), price: 799, dept: 'unisex', icon: '⛸️', colors: { shoes: '#f4f1ea' } },
  { id: 'shoes-flippers', slot: 'shoes', look: { shoeType: 'flippers' }, name: $t('Simfötter'), price: 249, dept: 'unisex', icon: '🤿', colors: { shoes: '#f0b429' } },

  // ---- kul ----
  { id: 'shoes-platforms', slot: 'shoes', look: { shoeType: 'platforms' }, name: $t('Platå\u00adskor'), price: 699, dept: 'tjej', icon: '👟', colors: { shoes: '#2b2b30', shoes2: '#f4f1ea' } },
  { id: 'shoes-clownShoes', slot: 'shoes', look: { shoeType: 'clownShoes' }, name: $t('Clownskor'), price: 349, dept: 'unisex', icon: '🤡', colors: { shoes: '#c9323a', shoes2: '#f0b429' } },
];
