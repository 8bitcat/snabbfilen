// Klädkatalogen: underdelar (byxor, shorts, kjolar, klänningar, overaller) och skor.
// Se js/data/wardrobe.js för postformatet och docs/PEOPLE-ARKITEKTUR.md.
// legacy = nyckeln i gamla sparfiler ('kind:v') – ändra aldrig på de gamla.
export const WARDROBE_BOTTOMS = [
  // ---- gratis basplagg ----
  { id: 'bottom-jeans', slot: 'bottom', look: { bottom: 'jeans' }, name: 'Jeans', price: 60, dept: 'unisex', free: true, icon: '👖', legacy: 'bottom:jeans' },
  { id: 'bottom-pants', slot: 'bottom', look: { bottom: 'pants' }, name: 'Byxor', price: 60, dept: 'unisex', free: true, icon: '👖', legacy: 'bottom:pants' },
  // ---- från klädaffärens första sortiment ----
  { id: 'bottom-shorts', slot: 'bottom', look: { bottom: 'shorts' }, name: 'Shorts', price: 120, dept: 'unisex', icon: '🩳', legacy: 'bottom:shorts' },
  { id: 'bottom-skirt', slot: 'bottom', look: { bottom: 'skirt' }, name: 'Kjol', price: 200, dept: 'tjej', icon: '👗', legacy: 'bottom:skirt' },
  { id: 'bottom-dress', slot: 'bottom', look: { bottom: 'dress' }, name: 'Klänning', price: 380, dept: 'tjej', icon: '👗', legacy: 'bottom:dress' },
];

export const WARDROBE_SHOES = [
  { id: 'shoes-normal', slot: 'shoes', look: { shoeType: 'normal' }, name: 'Vanliga skor', price: 60, dept: 'unisex', free: true, icon: '👟' },
];
