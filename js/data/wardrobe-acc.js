// Klädkatalogen: accessoarer – huvudbonader, glasögon, väskor, hals, smycken,
// hårspännen och hörlurar. Se js/data/wardrobe.js för postformatet.
// legacy = nyckeln i gamla sparfiler ('kind:v') – ändra aldrig på de gamla.
export const WARDROBE_ACC = [
  // ---- huvudbonader ----
  { id: 'hat-cap', slot: 'hat', look: { hat: 'cap' }, name: 'Keps', price: 90, dept: 'unisex', icon: '🧢', legacy: 'hat:cap' },
  { id: 'hat-headband', slot: 'hat', look: { hat: 'headband' }, name: 'Hårband', price: 120, dept: 'tjej', icon: '🎽', legacy: 'hat:headband' },
  { id: 'hat-bucket', slot: 'hat', look: { hat: 'bucket' }, name: 'Fiskehatt', price: 130, dept: 'kille', icon: '👒', legacy: 'hat:bucket' },
  { id: 'hat-beanie', slot: 'hat', look: { hat: 'beanie' }, name: 'Mössa', price: 150, dept: 'unisex', icon: '🧣', legacy: 'hat:beanie' },
  { id: 'hat-bow', slot: 'hat', look: { hat: 'bow' }, name: 'Rosett', price: 180, dept: 'tjej', icon: '🎀', legacy: 'hat:bow' },
  { id: 'hat-tophat', slot: 'hat', look: { hat: 'tophat' }, name: 'Hög hatt', price: 1800, dept: 'kille', icon: '🎩', legacy: 'hat:tophat' },
  { id: 'hat-crown', slot: 'hat', look: { hat: 'crown' }, name: 'Krona', price: 2500, dept: 'tjej', icon: '👑', legacy: 'hat:crown', colors: { cap: '#f0b429' } },
  // ---- glasögon ----
  { id: 'glasses-round', slot: 'glasses', look: { glasses: 'round' }, name: 'Runda glasögon', price: 150, dept: 'unisex', icon: '👓', legacy: 'glasses:round' },
  { id: 'glasses-square', slot: 'glasses', look: { glasses: 'square' }, name: 'Fyrkantiga glasögon', price: 150, dept: 'unisex', icon: '👓', legacy: 'glasses:square' },
  { id: 'glasses-sun', slot: 'glasses', look: { glasses: 'sun' }, name: 'Solglasögon', price: 220, dept: 'unisex', icon: '🕶️', legacy: 'glasses:sun' },
  // ---- väskor ----
  { id: 'bag-backpack', slot: 'bag', look: { bag: 'backpack' }, name: 'Ryggsäck', price: 350, dept: 'unisex', icon: '🎒', legacy: 'bag:backpack' },
  { id: 'bag-shoulder', slot: 'bag', look: { bag: 'shoulder' }, name: 'Axelväska', price: 420, dept: 'unisex', icon: '👜', legacy: 'bag:shoulder' },
  // ---- hörlurar ----
  { id: 'phones-over', slot: 'phones', look: { phones: true }, name: 'Hörlurar', price: 500, dept: 'unisex', icon: '🎧', legacy: 'phones:true' },
  // ---- hals, smycken, hårspännen: fylls på av innehållsspecialisterna ----
];
