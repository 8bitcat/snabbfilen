// Klädkatalogen: överdelar. Se js/data/wardrobe.js för postformatet och
// docs/PEOPLE-ARKITEKTUR.md för hur ett nytt plagg läggs till.
//
// look = de modellfält plagget sätter (top + ev. topPrint). Färgerna väljer spelaren
// själv; colors = förslag som visas på mannekängen/i butiken och sätts när man köper.
// legacy = nyckeln i gamla sparfiler ('kind:v') – ändra aldrig på de gamla.
export const WARDROBE_TOPS = [
  // ---- gratis basplagg ----
  { id: 'top-tee', slot: 'top', look: { top: 'tee' }, name: 'T-shirt', price: 60, dept: 'unisex', free: true, icon: '👕', legacy: 'top:tee' },
  { id: 'top-stripes', slot: 'top', look: { top: 'stripes' }, name: 'Randig tröja', price: 80, dept: 'unisex', free: true, icon: '👕', legacy: 'top:stripes' },
  // ---- från klädaffärens första sortiment ----
  { id: 'top-vest', slot: 'top', look: { top: 'vest' }, name: 'Linne', price: 100, dept: 'tjej', icon: '🎽', legacy: 'top:vest' },
  { id: 'top-hoodie', slot: 'top', look: { top: 'hoodie' }, name: 'Huvtröja', price: 250, dept: 'unisex', icon: '🧥', legacy: 'top:hoodie' },
  { id: 'top-hawaii', slot: 'top', look: { top: 'hawaii' }, name: 'Hawaiiskjorta', price: 280, dept: 'kille', icon: '🌺', legacy: 'top:hawaii' },
  { id: 'top-sweater', slot: 'top', look: { top: 'sweater' }, name: 'Stickad tröja', price: 300, dept: 'unisex', icon: '🧶', legacy: 'top:sweater' },
  { id: 'top-shirt', slot: 'top', look: { top: 'shirt' }, name: 'Skjorta', price: 400, dept: 'kille', icon: '👔', legacy: 'top:shirt' },
  { id: 'top-jacket', slot: 'top', look: { top: 'jacket' }, name: 'Jacka', price: 450, dept: 'unisex', icon: '🧥', legacy: 'top:jacket' },
  { id: 'top-suit', slot: 'top', look: { top: 'suit' }, name: 'Kavaj med slips', price: 1500, dept: 'kille', icon: '🤵', legacy: 'top:suit' },
];
