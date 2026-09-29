// Klädkatalogen: underdelar (byxor, shorts, kjolar, klänningar, overaller) och skor.
// Se js/data/wardrobe.js för postformatet och docs/PEOPLE-ARKITEKTUR.md.
// legacy = nyckeln i gamla sparfiler ('kind:v') – ändra aldrig på de gamla.
// Ordningen = ordningen i redigeraren och butiken (underrubrikerna i första förekomstens ordning).
// Långa namn har mjuka bindestreck (\u00ad) så att de bryts snyggt i rutorna.
// Modellerna ritas i js/core/people/bottoms.js (BOTTOM_REG, BOTTOM_PRINT_REG, SHOE_REG).
// colors är förslag (mannekäng + när man köper): klänningar/jumpsuits färgas med shirt,
// allt annat med pants; mönstret (bottomPrint) och detaljer med pants2; skor shoes/shoes2.
export const WARDROBE_BOTTOMS = [
  // ---- långbyxor (jeans och byxor är gratis basplagg) ----
  { id: 'bottom-jeans', slot: 'bottom', look: { bottom: 'jeans' }, name: 'Jeans', price: 60, dept: 'unisex', free: true, icon: '👖', legacy: 'bottom:jeans' },
  { id: 'bottom-pants', slot: 'bottom', look: { bottom: 'pants' }, name: 'Byxor', price: 60, dept: 'unisex', free: true, icon: '👖', legacy: 'bottom:pants' },
  { id: 'bottom-jeansRipped', slot: 'bottom', look: { bottom: 'jeansRipped' }, name: 'Slitna jeans', price: 449, dept: 'unisex', icon: '👖', colors: { pants: '#4f79ad' } },
  { id: 'bottom-jeansCuffed', slot: 'bottom', look: { bottom: 'jeansCuffed' }, name: 'Uppvikta jeans', price: 399, dept: 'unisex', icon: '👖', colors: { pants: '#3f5f8f' } },
  { id: 'bottom-jeansFlare', slot: 'bottom', look: { bottom: 'jeansFlare' }, name: 'Ut\u00adsvängda jeans', price: 499, dept: 'tjej', icon: '👖', colors: { pants: '#5a82b8' } },
  { id: 'bottom-jeansBaggy', slot: 'bottom', look: { bottom: 'jeansBaggy' }, name: 'Baggy jeans', price: 549, dept: 'kille', icon: '👖', colors: { pants: '#35507a' } },
  { id: 'bottom-jeansHigh', slot: 'bottom', look: { bottom: 'jeansHigh' }, name: 'Hög\u00admidjade jeans', price: 529, dept: 'tjej', icon: '👖', colors: { pants: '#6a8fc4' } },
  { id: 'bottom-jeansPatched', slot: 'bottom', look: { bottom: 'jeansPatched' }, name: 'Lappade jeans', price: 429, dept: 'unisex', icon: '👖', colors: { pants: '#3f5f8f', pants2: '#c9323a' } },
  { id: 'bottom-jeans-stonewash', slot: 'bottom', look: { bottom: 'jeans', bottomPrint: 'stonewash' }, name: 'Stent\u00advättade jeans', price: 449, dept: 'unisex', icon: '👖', colors: { pants: '#4a6a9c' } },
  { id: 'bottom-jeans-splatter', slot: 'bottom', look: { bottom: 'jeans', bottomPrint: 'splatter' }, name: 'Färg\u00adstänkta jeans', price: 479, dept: 'unisex', icon: '👖', colors: { pants: '#4f79ad', pants2: '#46a35a' } },
  { id: 'bottom-cargo', slot: 'bottom', look: { bottom: 'cargo' }, name: 'Cargo\u00adbyxor', price: 449, dept: 'unisex', icon: '👖', colors: { pants: '#6b6a4a' } },
  { id: 'bottom-cargo-camo', slot: 'bottom', look: { bottom: 'cargo', bottomPrint: 'camo' }, name: 'Kamouflage\u00adbyxor', price: 529, dept: 'kille', icon: '👖', colors: { pants: '#6b7a4a', pants2: '#3f4a2c' } },
  { id: 'bottom-chinos', slot: 'bottom', look: { bottom: 'chinos' }, name: 'Chinos', price: 399, dept: 'kille', icon: '👖', colors: { pants: '#b8a47a' } },
  { id: 'bottom-suitPants', slot: 'bottom', look: { bottom: 'suitPants' }, name: 'Kostym\u00adbyxor', price: 699, dept: 'kille', icon: '👖', colors: { pants: '#2f3440' } },
  { id: 'bottom-suitPants-pinstripe', slot: 'bottom', look: { bottom: 'suitPants', bottomPrint: 'pinstripe' }, name: 'Kritstrecks\u00adbyxor', price: 849, dept: 'kille', icon: '👖', colors: { pants: '#2b2b30', pants2: '#6f7078' } },
  { id: 'bottom-corduroy', slot: 'bottom', look: { bottom: 'corduroy' }, name: 'Manchester\u00adbyxor', price: 479, dept: 'unisex', icon: '👖', colors: { pants: '#8a5a32' } },
  { id: 'bottom-leather', slot: 'bottom', look: { bottom: 'leather' }, name: 'Skinn\u00adbyxor', price: 1290, dept: 'unisex', icon: '👖', colors: { pants: '#26222a' } },
  { id: 'bottom-wide', slot: 'bottom', look: { bottom: 'wide' }, name: 'Vida byxor', price: 549, dept: 'tjej', icon: '👖', colors: { pants: '#e8e3d6' } },
  { id: 'bottom-wide-zebra', slot: 'bottom', look: { bottom: 'wide', bottomPrint: 'zebra' }, name: 'Zebra\u00adbyxor', price: 649, dept: 'tjej', icon: '🦓', colors: { pants: '#f4f1ea', pants2: '#1c1c1c' } },
  { id: 'bottom-capri', slot: 'bottom', look: { bottom: 'capri' }, name: 'Capri\u00adbyxor', price: 299, dept: 'tjej', icon: '👖', colors: { pants: '#e0a02a' } },
  { id: 'bottom-pants-tartan', slot: 'bottom', look: { bottom: 'pants', bottomPrint: 'tartan' }, name: 'Rutiga byxor', price: 429, dept: 'unisex', icon: '👖', colors: { pants: '#b83d3d', pants2: '#26605a' } },
  { id: 'bottom-jodhpurs', slot: 'bottom', look: { bottom: 'jodhpurs' }, name: 'Rid\u00adbyxor', price: 749, dept: 'tjej', icon: '🏇', colors: { pants: '#e3d6b8' } },
  { id: 'bottom-knickers', slot: 'bottom', look: { bottom: 'knickers' }, name: 'Knickers', price: 549, dept: 'kille', icon: '⛳', colors: { pants: '#7a6a4f', pants2: '#2f6a4a' } },
  { id: 'bottom-knickers-checks', slot: 'bottom', look: { bottom: 'knickers', bottomPrint: 'checks' }, name: 'Rutiga golf\u00adbyxor', price: 599, dept: 'kille', icon: '⛳', colors: { pants: '#b8a47a', pants2: '#8e2f3e' } },
  { id: 'bottom-culottes', slot: 'bottom', look: { bottom: 'culottes' }, name: 'Byxkjol', price: 449, dept: 'tjej', icon: '👖', colors: { pants: '#b5773a' } },

  // ---- mjukis & träning ----
  { id: 'bottom-joggers', slot: 'bottom', look: { bottom: 'joggers' }, name: 'Joggers', price: 299, dept: 'unisex', icon: '👖', colors: { pants: '#5f6670' } },
  { id: 'bottom-sweatpants', slot: 'bottom', look: { bottom: 'sweatpants' }, name: 'Mjukis\u00adbyxor', price: 199, dept: 'unisex', icon: '👖', colors: { pants: '#8a8f98' } },
  { id: 'bottom-sweatpants-tiedye', slot: 'bottom', look: { bottom: 'sweatpants', bottomPrint: 'tiedye' }, name: 'Batik\u00admjukis', price: 299, dept: 'unisex', icon: '🌀', colors: { pants: '#8e5bd1', pants2: '#2aa39a' } },
  { id: 'bottom-trackPants', slot: 'bottom', look: { bottom: 'trackPants' }, name: 'Tränings\u00adbyxor', price: 349, dept: 'unisex', icon: '🏃', colors: { pants: '#1f2a44', pants2: '#f4f1ea' } },
  { id: 'bottom-leggings', slot: 'bottom', look: { bottom: 'leggings' }, name: 'Leggings', price: 179, dept: 'tjej', icon: '🧘', colors: { pants: '#2b2b30' } },
  { id: 'bottom-leggings-leopard', slot: 'bottom', look: { bottom: 'leggings', bottomPrint: 'leopard' }, name: 'Leopard\u00adleggings', price: 249, dept: 'tjej', icon: '🐆', colors: { pants: '#d9a95c', pants2: '#3b2619' } },
  { id: 'bottom-leggings-stars', slot: 'bottom', look: { bottom: 'leggings', bottomPrint: 'stars' }, name: 'Stjärn\u00adleggings', price: 229, dept: 'tjej', icon: '⭐', colors: { pants: '#3f4fa8', pants2: '#f0e070' } },
  { id: 'bottom-leggings-stripesH', slot: 'bottom', look: { bottom: 'leggings', bottomPrint: 'stripesH' }, name: 'Randiga leggings', price: 219, dept: 'unisex', icon: '🧦', colors: { pants: '#f4f1ea', pants2: '#c9323a' } },
  { id: 'bottom-pajamas', slot: 'bottom', look: { bottom: 'pajamas' }, name: 'Pyjamas\u00adbyxor', price: 229, dept: 'unisex', icon: '😴', colors: { pants: '#8fb3d9', pants2: '#f4f1ea' } },
  { id: 'bottom-pajamas-checks', slot: 'bottom', look: { bottom: 'pajamas', bottomPrint: 'checks' }, name: 'Rutiga pyjamas\u00adbyxor', price: 279, dept: 'unisex', icon: '😴', colors: { pants: '#3a7bd5', pants2: '#f4f1ea' } },
  { id: 'bottom-pajamas-hearts', slot: 'bottom', look: { bottom: 'pajamas', bottomPrint: 'hearts' }, name: 'Hjärt\u00adpyjamas', price: 259, dept: 'unisex', icon: '💗', colors: { pants: '#f2b8c9', pants2: '#c9323a' } },
  { id: 'bottom-harem', slot: 'bottom', look: { bottom: 'harem' }, name: 'Harems\u00adbyxor', price: 329, dept: 'unisex', icon: '🧘', colors: { pants: '#7a4fa8' } },
  { id: 'bottom-harem-flowers', slot: 'bottom', look: { bottom: 'harem', bottomPrint: 'flowers' }, name: 'Blommiga harems\u00adbyxor', price: 379, dept: 'unisex', icon: '🌺', colors: { pants: '#5a2e5a', pants2: '#f0b429' } },

  // ---- shorts (shorts är från klädaffärens första sortiment) ----
  { id: 'bottom-shorts', slot: 'bottom', look: { bottom: 'shorts' }, name: 'Shorts', price: 120, dept: 'unisex', icon: '🩳', legacy: 'bottom:shorts' },
  { id: 'bottom-bermuda', slot: 'bottom', look: { bottom: 'bermuda' }, name: 'Bermuda\u00adshorts', price: 279, dept: 'kille', icon: '🩳', colors: { pants: '#b8a47a' } },
  { id: 'bottom-cargoShorts', slot: 'bottom', look: { bottom: 'cargoShorts' }, name: 'Cargo\u00adshorts', price: 299, dept: 'kille', icon: '🩳', colors: { pants: '#6b6a4a' } },
  { id: 'bottom-cargoShorts-camo', slot: 'bottom', look: { bottom: 'cargoShorts', bottomPrint: 'camo' }, name: 'Kamouflage\u00adshorts', price: 349, dept: 'kille', icon: '🩳', colors: { pants: '#6b7a4a', pants2: '#3f4a2c' } },
  { id: 'bottom-denimShorts', slot: 'bottom', look: { bottom: 'denimShorts' }, name: 'Jeans\u00adshorts', price: 279, dept: 'tjej', icon: '🩳', colors: { pants: '#6a8fc4' } },
  { id: 'bottom-swimTrunks', slot: 'bottom', look: { bottom: 'swimTrunks' }, name: 'Badbyxor', price: 199, dept: 'kille', icon: '🩱', colors: { pants: '#2aa39a' } },
  { id: 'bottom-swimTrunks-flowers', slot: 'bottom', look: { bottom: 'swimTrunks', bottomPrint: 'flowers' }, name: 'Hawaii\u00adbadbyxor', price: 249, dept: 'kille', icon: '🌺', colors: { pants: '#e07a2e', pants2: '#f4f1ea' } },
  { id: 'bottom-bikeShorts', slot: 'bottom', look: { bottom: 'bikeShorts' }, name: 'Cykel\u00adbyxor', price: 249, dept: 'unisex', icon: '🚴', colors: { pants: '#1c1c22' } },
  { id: 'bottom-sportShorts', slot: 'bottom', look: { bottom: 'sportShorts' }, name: 'Tränings\u00adshorts', price: 229, dept: 'unisex', icon: '🩳', colors: { pants: '#2f3440', pants2: '#f0b429' } },
  { id: 'bottom-shorts-rainbow', slot: 'bottom', look: { bottom: 'shorts', bottomPrint: 'rainbow' }, name: 'Regnbågs\u00adshorts', price: 249, dept: 'unisex', icon: '🌈' },

  // ---- kjolar ----
  { id: 'bottom-skirt', slot: 'bottom', look: { bottom: 'skirt' }, name: 'Kjol', price: 200, dept: 'tjej', icon: '👗', legacy: 'bottom:skirt' },
  { id: 'bottom-miniSkirt', slot: 'bottom', look: { bottom: 'miniSkirt' }, name: 'Minikjol', price: 249, dept: 'tjej', icon: '👗', colors: { pants: '#2b2b30' } },
  { id: 'bottom-miniSkirt-sequins', slot: 'bottom', look: { bottom: 'miniSkirt', bottomPrint: 'sequins' }, name: 'Glitter\u00adkjol', price: 449, dept: 'tjej', icon: '✨', colors: { pants: '#b83d7a' } },
  { id: 'bottom-pleated', slot: 'bottom', look: { bottom: 'pleated' }, name: 'Plisserad kjol', price: 399, dept: 'tjej', icon: '👗', colors: { pants: '#2d3a5c' } },
  { id: 'bottom-pleated-tartan', slot: 'bottom', look: { bottom: 'pleated', bottomPrint: 'tartan' }, name: 'Skotskrutig kjol', price: 449, dept: 'tjej', icon: '👗', colors: { pants: '#b7392b', pants2: '#26605a' } },
  { id: 'bottom-tutu', slot: 'bottom', look: { bottom: 'tutu' }, name: 'Tyllkjol', price: 349, dept: 'tjej', icon: '🩰', colors: { pants: '#f28bb3' } },
  { id: 'bottom-tutu-rainbow', slot: 'bottom', look: { bottom: 'tutu', bottomPrint: 'rainbow' }, name: 'Regnbågs\u00adtutu', price: 399, dept: 'tjej', icon: '🌈', colors: { pants: '#f4f1ea' } },
  { id: 'bottom-denimSkirt', slot: 'bottom', look: { bottom: 'denimSkirt' }, name: 'Jeanskjol', price: 329, dept: 'tjej', icon: '👗', colors: { pants: '#4f79ad' } },
  { id: 'bottom-longSkirt', slot: 'bottom', look: { bottom: 'longSkirt' }, name: 'Lång kjol', price: 449, dept: 'tjej', icon: '👗', colors: { pants: '#7a2e3e' } },
  { id: 'bottom-longSkirt-flowers', slot: 'bottom', look: { bottom: 'longSkirt', bottomPrint: 'flowers' }, name: 'Blommig lång\u00adkjol', price: 499, dept: 'tjej', icon: '🌸', colors: { pants: '#26605a', pants2: '#f28bb3' } },
  { id: 'bottom-pencil', slot: 'bottom', look: { bottom: 'pencil' }, name: 'Pennkjol', price: 499, dept: 'tjej', icon: '👗', colors: { pants: '#2f3440' } },
  { id: 'bottom-ruffle', slot: 'bottom', look: { bottom: 'ruffle' }, name: 'Volangkjol', price: 429, dept: 'tjej', icon: '👗', colors: { pants: '#f0b429' } },
  { id: 'bottom-skirt-dots', slot: 'bottom', look: { bottom: 'skirt', bottomPrint: 'dots' }, name: 'Prickig kjol', price: 279, dept: 'tjej', icon: '👗', colors: { pants: '#c9323a', pants2: '#f4f1ea' } },
  { id: 'bottom-wrapSkirt', slot: 'bottom', look: { bottom: 'wrapSkirt' }, name: 'Omlott\u00adkjol', price: 429, dept: 'tjej', icon: '👗', colors: { pants: '#c46a3a', pants2: '#f4f1ea' } },
  { id: 'bottom-wrapSkirt-flowers', slot: 'bottom', look: { bottom: 'wrapSkirt', bottomPrint: 'flowers' }, name: 'Blommig omlott\u00adkjol', price: 479, dept: 'tjej', icon: '🌺', colors: { pants: '#2d3a5c', pants2: '#f28bb3' } },
  { id: 'bottom-tennisSkirt', slot: 'bottom', look: { bottom: 'tennisSkirt' }, name: 'Tennis\u00adkjol', price: 329, dept: 'tjej', icon: '🎾', colors: { pants: '#f4f1ea', pants2: '#2d3a5c' } },
  { id: 'bottom-kilt', slot: 'bottom', look: { bottom: 'kilt' }, name: 'Kilt', price: 649, dept: 'kille', icon: '🏴', colors: { pants: '#55604a' } },
  { id: 'bottom-kilt-tartan', slot: 'bottom', look: { bottom: 'kilt', bottomPrint: 'tartan' }, name: 'Skotsk kilt', price: 899, dept: 'kille', icon: '🏴', colors: { pants: '#2e7358', pants2: '#1f2a44' } },
  // folkdräktskjolen hör ihop med folkdräktslivet (top-folk i wardrobe-tops.js): samma röda som livets snörning
  { id: 'bottom-folkdrakt', slot: 'bottom', look: { bottom: 'folkdrakt' }, name: 'Folk\u00addräkts\u00adkjol', price: 1290, dept: 'tjej', icon: '🌼', colors: { pants: '#2b2b30', pants2: '#c9323a' } },

  // ---- klänningar (färgen är överdelens) ----
  { id: 'bottom-dress', slot: 'bottom', look: { bottom: 'dress' }, name: 'Klänning', price: 380, dept: 'tjej', icon: '👗', legacy: 'bottom:dress' },
  { id: 'bottom-sundress', slot: 'bottom', look: { bottom: 'sundress' }, name: 'Sommar\u00adklänning', price: 499, dept: 'tjej', icon: '👗', colors: { shirt: '#f2d680', pants2: '#f4f1ea' } },
  { id: 'bottom-sundress-flowers', slot: 'bottom', look: { bottom: 'sundress', bottomPrint: 'flowers' }, name: 'Blommig sommar\u00adklänning', price: 549, dept: 'tjej', icon: '🌼', colors: { shirt: '#8fc4e8', pants2: '#f4f1ea' } },
  { id: 'bottom-sundress-checks', slot: 'bottom', look: { bottom: 'sundress', bottomPrint: 'checks' }, name: 'Rutig sommar\u00adklänning', price: 529, dept: 'tjej', icon: '👗', colors: { shirt: '#f4f1ea', pants2: '#c9323a' } },
  { id: 'bottom-dress-dots', slot: 'bottom', look: { bottom: 'dress', bottomPrint: 'dots' }, name: 'Prickig klän\u00adning', price: 449, dept: 'tjej', icon: '👗', colors: { shirt: '#2d3a5c', pants2: '#f4f1ea' } },
  { id: 'bottom-gown', slot: 'bottom', look: { bottom: 'gown' }, name: 'Bal\u00adklänning', price: 1890, dept: 'tjej', icon: '👗', colors: { shirt: '#3a2a6a', pants2: '#f0b429' } },
  { id: 'bottom-princess', slot: 'bottom', look: { bottom: 'princess' }, name: 'Prinsess\u00adklänning', price: 1290, dept: 'tjej', icon: '👸', colors: { shirt: '#f28bb3', pants2: '#f0b429' } },
  { id: 'bottom-maxiDress', slot: 'bottom', look: { bottom: 'maxiDress' }, name: 'Maxi\u00adklänning', price: 649, dept: 'tjej', icon: '👗', colors: { shirt: '#2aa39a' } },
  { id: 'bottom-shirtDress', slot: 'bottom', look: { bottom: 'shirtDress' }, name: 'Skjort\u00adklänning', price: 549, dept: 'tjej', icon: '👗', colors: { shirt: '#9ab6d0', accent: '#f4f1ea' } },
  { id: 'bottom-partyDress', slot: 'bottom', look: { bottom: 'partyDress' }, name: 'Fest\u00adklänning', price: 899, dept: 'tjej', icon: '🎉', colors: { shirt: '#b83d7a' } },
  { id: 'bottom-sweaterDress', slot: 'bottom', look: { bottom: 'sweaterDress' }, name: 'Tröj\u00adklänning', price: 449, dept: 'tjej', icon: '🧶', colors: { shirt: '#b9b3ab' } },
  { id: 'bottom-lucia', slot: 'bottom', look: { bottom: 'lucia' }, name: 'Lucia\u00adklänning', price: 399, dept: 'unisex', icon: '🕯️', colors: { shirt: '#f6f3ec', pants2: '#c9323a' } },
  { id: 'bottom-weddingDress', slot: 'bottom', look: { bottom: 'weddingDress' }, name: 'Brud\u00adklänning', price: 2490, dept: 'tjej', icon: '💍', colors: { shirt: '#f6f3ec' } },

  // ---- overaller & hängsel ----
  { id: 'bottom-jumpsuit', slot: 'bottom', look: { bottom: 'jumpsuit' }, name: 'Jumpsuit', price: 749, dept: 'tjej', icon: '👗', colors: { shirt: '#2f3440' } },
  { id: 'bottom-playsuit', slot: 'bottom', look: { bottom: 'playsuit' }, name: 'Byxdress', price: 549, dept: 'tjej', icon: '👗', colors: { shirt: '#f28bb3' } },
  { id: 'bottom-dungarees', slot: 'bottom', look: { bottom: 'dungarees' }, name: 'Snickar\u00adbyxor', price: 549, dept: 'unisex', icon: '🔨', colors: { pants: '#4f79ad' } },
  { id: 'bottom-dungareeShorts', slot: 'bottom', look: { bottom: 'dungareeShorts' }, name: 'Snickar\u00adshorts', price: 399, dept: 'unisex', icon: '🩳', colors: { pants: '#6a8fc4' } },
  { id: 'bottom-pinafore', slot: 'bottom', look: { bottom: 'pinafore' }, name: 'Hängsel\u00adkjol', price: 449, dept: 'tjej', icon: '👗', colors: { pants: '#7a2e3e' } },
  { id: 'bottom-suspenders', slot: 'bottom', look: { bottom: 'suspenders' }, name: 'Hängsel\u00adbyxor', price: 499, dept: 'kille', icon: '👖', colors: { pants: '#5a4632', pants2: '#c9323a' } },
  { id: 'bottom-rainPants', slot: 'bottom', look: { bottom: 'rainPants' }, name: 'Regnbyxor', price: 349, dept: 'unisex', icon: '☔', colors: { pants: '#f0b429' } },
  { id: 'bottom-skiPants', slot: 'bottom', look: { bottom: 'skiPants' }, name: 'Täckbyxor', price: 599, dept: 'unisex', icon: '⛷️', colors: { pants: '#2d3a5c' } },
  { id: 'bottom-coverall', slot: 'bottom', look: { bottom: 'coverall' }, name: 'Overall', price: 699, dept: 'unisex', icon: '🔧', colors: { pants: '#e07a2e' } },
  { id: 'bottom-snowsuit', slot: 'bottom', look: { bottom: 'snowsuit' }, name: 'Vinter\u00adoverall', price: 899, dept: 'unisex', icon: '❄️', colors: { pants: '#c9323a' } },
];

export const WARDROBE_SHOES = [
  // ---- vardag (vanliga skor är gratis) ----
  { id: 'shoes-normal', slot: 'shoes', look: { shoeType: 'normal' }, name: 'Vanliga skor', price: 60, dept: 'unisex', free: true, icon: '👟' },

  // ---- sneakers ----
  { id: 'shoes-sneakers', slot: 'shoes', look: { shoeType: 'sneakers' }, name: 'Sneakers', price: 499, dept: 'unisex', icon: '👟', colors: { shoes: '#3a7bd5', shoes2: '#f4f1ea' } },
  { id: 'shoes-highTops', slot: 'shoes', look: { shoeType: 'highTops' }, name: 'Höga sneakers', price: 549, dept: 'unisex', icon: '👟', colors: { shoes: '#c9323a', shoes2: '#f4f1ea' } },
  { id: 'shoes-slipOn', slot: 'shoes', look: { shoeType: 'slipOn' }, name: 'Rutiga tyg\u00adskor', price: 399, dept: 'unisex', icon: '👟', colors: { shoes: '#2b2b30', shoes2: '#f4f1ea' } },
  { id: 'shoes-lightUp', slot: 'shoes', look: { shoeType: 'lightUp' }, name: 'Blinkskor', price: 449, dept: 'unisex', icon: '💡', colors: { shoes: '#f28bb3', shoes2: '#f4f1ea' } },
  { id: 'shoes-velcro', slot: 'shoes', look: { shoeType: 'velcro' }, name: 'Kardborre\u00adskor', price: 299, dept: 'unisex', icon: '👟', colors: { shoes: '#3a7bd5', shoes2: '#f0b429' } },

  // ---- kängor & stövlar ----
  { id: 'shoes-boots', slot: 'shoes', look: { shoeType: 'boots' }, name: 'Kängor', price: 899, dept: 'unisex', icon: '🥾', colors: { shoes: '#6b3e1e' } },
  { id: 'shoes-rubberBoots', slot: 'shoes', look: { shoeType: 'rubberBoots' }, name: 'Gummi\u00adstövlar', price: 349, dept: 'unisex', icon: '🥾', colors: { shoes: '#3f7a3a' } },
  { id: 'shoes-ridingBoots', slot: 'shoes', look: { shoeType: 'ridingBoots' }, name: 'Rid\u00adstövlar', price: 1190, dept: 'tjej', icon: '👢', colors: { shoes: '#3b2619' } },
  { id: 'shoes-cowboyBoots', slot: 'shoes', look: { shoeType: 'cowboyBoots' }, name: 'Cowboy\u00adstövlar', price: 1290, dept: 'unisex', icon: '🤠', colors: { shoes: '#a86b32' } },
  { id: 'shoes-winterBoots', slot: 'shoes', look: { shoeType: 'winterBoots' }, name: 'Vinter\u00adkängor', price: 799, dept: 'unisex', icon: '🥾', colors: { shoes: '#2f3440' } },
  { id: 'shoes-ankleBoots', slot: 'shoes', look: { shoeType: 'ankleBoots' }, name: 'Stöv\u00adletter', price: 899, dept: 'tjej', icon: '👢', colors: { shoes: '#2b2b30' } },

  // ---- fina skor ----
  { id: 'shoes-dressShoes', slot: 'shoes', look: { shoeType: 'dressShoes' }, name: 'Finskor', price: 999, dept: 'kille', icon: '👞', colors: { shoes: '#2b2b30' } },
  { id: 'shoes-ballerina', slot: 'shoes', look: { shoeType: 'ballerina' }, name: 'Ballerina\u00adskor', price: 399, dept: 'tjej', icon: '🥿', colors: { shoes: '#c9323a', shoes2: '#f4f1ea' } },
  { id: 'shoes-heels', slot: 'shoes', look: { shoeType: 'heels' }, name: 'Klackskor', price: 799, dept: 'tjej', icon: '👠', colors: { shoes: '#c9323a' } },
  { id: 'shoes-clogs', slot: 'shoes', look: { shoeType: 'clogs' }, name: 'Träskor', price: 599, dept: 'unisex', icon: '🪵', colors: { shoes: '#7a2e2e' } },

  // ---- sommar (barfota är gratis) ----
  { id: 'shoes-sandals', slot: 'shoes', look: { shoeType: 'sandals' }, name: 'Sandaler', price: 349, dept: 'unisex', icon: '👡', colors: { shoes: '#6b3e1e' } },
  { id: 'shoes-flipflops', slot: 'shoes', look: { shoeType: 'flipflops' }, name: 'Flipflops', price: 99, dept: 'unisex', icon: '🩴', colors: { shoes: '#2aa39a' } },
  { id: 'shoes-barefoot', slot: 'shoes', look: { shoeType: 'barefoot' }, name: 'Barfota', price: 60, dept: 'unisex', free: true, icon: '🦶' },

  // ---- hemma ----
  { id: 'shoes-slippers', slot: 'shoes', look: { shoeType: 'slippers' }, name: 'Tofflor', price: 199, dept: 'unisex', icon: '🥿', colors: { shoes: '#f28bb3' } },
  { id: 'shoes-animalSlippers', slot: 'shoes', look: { shoeType: 'animalSlippers' }, name: 'Djur\u00adtofflor', price: 249, dept: 'unisex', icon: '🐻', colors: { shoes: '#b98a5e', shoes2: '#f28bb3' } },
  { id: 'shoes-woolSocks', slot: 'shoes', look: { shoeType: 'woolSocks' }, name: 'Ragg\u00adsockor', price: 149, dept: 'unisex', icon: '🧦', colors: { shoes: '#b9b3ab', shoes2: '#f4f1ea' } },

  // ---- sport ----
  { id: 'shoes-cleats', slot: 'shoes', look: { shoeType: 'cleats' }, name: 'Fotbolls\u00adskor', price: 699, dept: 'unisex', icon: '⚽', colors: { shoes: '#2b2b30', shoes2: '#f0b429' } },
  { id: 'shoes-rollerSkates', slot: 'shoes', look: { shoeType: 'rollerSkates' }, name: 'Rull\u00adskridskor', price: 899, dept: 'unisex', icon: '🛼', colors: { shoes: '#f4f1ea', shoes2: '#f28bb3' } },
  { id: 'shoes-iceSkates', slot: 'shoes', look: { shoeType: 'iceSkates' }, name: 'Skridskor', price: 799, dept: 'unisex', icon: '⛸️', colors: { shoes: '#f4f1ea' } },
  { id: 'shoes-flippers', slot: 'shoes', look: { shoeType: 'flippers' }, name: 'Simfötter', price: 249, dept: 'unisex', icon: '🤿', colors: { shoes: '#f0b429' } },

  // ---- kul ----
  { id: 'shoes-platforms', slot: 'shoes', look: { shoeType: 'platforms' }, name: 'Platå\u00adskor', price: 699, dept: 'tjej', icon: '👟', colors: { shoes: '#2b2b30', shoes2: '#f4f1ea' } },
  { id: 'shoes-clownShoes', slot: 'shoes', look: { shoeType: 'clownShoes' }, name: 'Clownskor', price: 349, dept: 'unisex', icon: '🤡', colors: { shoes: '#c9323a', shoes2: '#f0b429' } },
];
