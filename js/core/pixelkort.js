// 🃏 PIXELKORT – samlarkort med Pixelstadens djur, folk, fordon och saker (Carl 2026-10-12: "pixelkort och
// byteshandel" ur listan "om du hade fått gå helt loco").
//
// 46 kort i sex serier. Varje kort har en sällsynthet: VANLIG (vit ram), OVANLIG (blå), SÄLLSYNT (lila) och
// LEGENDARISK (guld med regnbågsglans). Bilderna ritas i kod med spelets egna figurer: husdjuren (drawPet),
// folket (drawPerson), fordonen (drawVehicle) och möblerna (furnArt) – samma pixlar som i spelet.
//   • Kort får man i presenterna (dagens present ibland, de STORA ofta ett helt paket) och som paket
//     i leksaksaffären (KORTSTÄLLET vid kassan, 3 kort för 25 kr).
//   • ALBUMET i mobilen (appen 🃏 Pixelkort): en sida per serie, korten man har och ×antal, tomma platser
//     för dem man saknar. Komplett serie → 500 kr och en guldpokal (en gång per serie).
//   • BYTESHANDEL: dubbletter kan skickas till vänner som vänskapspresent (vannerapp.js, gåvan { slag:'kort', id }).
// Sparas i g.kort = { id: antal }, g.kortSerier = [serier man fått belöningen för].
import { drawPerson } from './people.js';
import { $t } from './i18n.js';

export const PAKET_PRIS = 25;
export const SERIE_PRIS = 500;
export const RARITET = [
  { id: 0, namn: $t('Vanlig'), ram: ['#f4f1ea', '#c8c4b8', '#8a867c'], vikt: 66 },
  { id: 1, namn: $t('Ovanlig'), ram: ['#8ac8f4', '#3a7bd5', '#1e4a8a'], vikt: 24 },
  { id: 2, namn: $t('Sällsynt'), ram: ['#d8a8f4', '#8e5bd1', '#4a2a7a'], vikt: 8 },
  { id: 3, namn: $t('Legendarisk'), ram: ['#fff2a8', '#f0c040', '#a07010'], vikt: 2 },
];
export const SERIER = [
  { id: 'katter', icon: '🐈', namn: $t('Katter'), bg: '#f4e4d0' },
  { id: 'hundar', icon: '🐕', namn: $t('Hundar'), bg: '#e4ecd4' },
  { id: 'smadjur', icon: '🐇', namn: $t('Kaniner och frisyrer'), bg: '#f4dce8' },
  { id: 'folk', icon: '👥', namn: $t('Pixelborna'), bg: '#dce8f4' },
  { id: 'saker', icon: '🚲', namn: $t('Fordon och saker'), bg: '#ece4f4' },
  { id: 'rar', icon: '✨', namn: $t('Rariteter'), bg: '#2a2440' },
];
const P = (species, breed, extra = {}) => ({ typ: 'pet', pet: { id: `kort-${species}-${breed}`, species, breed, sex: 'hona', stage: 'vuxen', seed: 'kort' + breed, ...extra } });
const F = (look) => ({ typ: 'person', look: { beard: false, glasses: false, phones: false, bag: null, hat: null, blush: false, kid: false, build: 5, ...look } });
// korten: id, serie, namn, sällsynthet, bild
export const KORT = [
  ['tigrerad', 'katter', $t('Tigrerad katt'), 0, P('katt', 'tigrerad')], ['svart', 'katter', $t('Svart katt'), 0, P('katt', 'svart')],
  ['vit', 'katter', $t('Vit katt'), 0, P('katt', 'vit')], ['rodkatt', 'katter', $t('Rödkatt'), 0, P('katt', 'rodkatt')],
  ['skoldpadd', 'katter', $t('Sköldpaddskatt'), 1, P('katt', 'skoldpadd')], ['smoking', 'katter', $t('Smokingkatt'), 1, P('katt', 'smoking')],
  ['blagra', 'katter', $t('Blågrå katt'), 1, P('katt', 'blagra')], ['siames', 'katter', $t('Siames'), 2, P('katt', 'siames')],
  ['skogkatt', 'katter', $t('Norsk skogkatt'), 2, P('katt', 'skogkatt')],
  ['blandras', 'hundar', $t('Blandras'), 0, P('hund', 'blandras')], ['tax', 'hundar', $t('Tax'), 0, P('hund', 'tax')],
  ['labrador', 'hundar', $t('Labrador'), 0, P('hund', 'labrador')], ['jack', 'hundar', $t('Jack russell'), 0, P('hund', 'jack')],
  ['golden', 'hundar', $t('Golden retriever'), 1, P('hund', 'golden')], ['corgi', 'hundar', $t('Corgi'), 1, P('hund', 'corgi')],
  ['mops', 'hundar', $t('Mops'), 1, P('hund', 'mops')], ['husky', 'hundar', $t('Husky'), 2, P('hund', 'husky')],
  ['schafer', 'hundar', $t('Schäfer'), 2, P('hund', 'schafer')],
  ['kanin-brun', 'smadjur', $t('Vildkanin'), 0, P('kanin', 'brun')], ['kanin-vadur', 'smadjur', $t('Dvärgvädur'), 0, P('kanin', 'vadur')],
  ['kanin-lejon', 'smadjur', $t('Lejonhuvud'), 1, P('kanin', 'lejonhuvud')], ['kanin-prickig', 'smadjur', $t('Prickig kanin'), 1, P('kanin', 'prickig')],
  ['fris-lejon', 'smadjur', $t('Katt med lejonklipp'), 1, P('katt', 'rodkatt', { frisyr: { s: 'lejon', f: 'natur' } })],
  ['fris-pudel', 'smadjur', $t('Pudel med pompoms'), 2, P('hund', 'pudel', { frisyr: { s: 'pudel', f: 'rosa' } })],
  ['fris-tupp', 'smadjur', $t('Rockhund med tuppkam'), 2, P('hund', 'jack', { frisyr: { s: 'tupp', f: 'lila' } })],
  ['tova', 'folk', $t('Tova, trimmaren'), 0, F({ skin: '#eec3a0', hair: '#c65fa0', style: 'ponytail', top: 'tee', shirt: '#62c8a0', accent: '#62c8a0', bottom: 'pants', pants: '#2d3a5c', shoes: '#f2f2f2', apron: true, build: 4, blush: true })],
  ['kerstin', 'folk', $t('Kerstin på kattcaféet'), 0, F({ skin: '#f6d7bf', hair: '#d9a95c', style: 'bun', top: 'sweater', shirt: '#e0a030', accent: '#f4f1ea', bottom: 'pants', pants: '#5a4632', shoes: '#6b3e1e', glasses: 'round', apron: true, build: 4, blush: true })],
  ['vera', 'folk', $t('Veterinären Vera'), 0, F({ skin: '#e0a97f', hair: '#1d1714', style: 'ponytail', top: 'tee', shirt: '#7ab8e0', accent: '#7ab8e0', bottom: 'pants', pants: '#7ab8e0', shoes: '#f2f2f2', glasses: 'round', apron: true, build: 4 })],
  ['ingrid', 'folk', $t('Ingrid på djurhemmet'), 0, F({ skin: '#c68a5c', hair: '#3b2619', style: 'ponytail', top: 'hoodie', shirt: '#a8382a', accent: '#f4f1ea', bottom: 'jeans', pants: '#3f5f8f', shoes: '#6b3e1e', blush: true })],
  ['sami', 'folk', $t('Frisören Sami'), 1, F({ skin: '#a06a43', hair: '#1d1714', style: 'pompadour', top: 'shirt', shirt: '#1c2a4a', accent: '#d8b060', bottom: 'pants', pants: '#2b2b30', shoes: '#1c1c1c' })],
  ['kenta', 'folk', $t('Kenta i garaget'), 1, F({ skin: '#e0a97f', hair: '#6b4226', style: 'short', beard: 'stubble', hat: 'cap', cap: '#d9433b', top: 'workshirt', shirt: '#3a5a8a', accent: '#3a5a8a', bottom: 'pants', pants: '#2d3a5c', shoes: '#1c1c1c', build: 6 })],
  ['gunilla', 'folk', $t('Gunilla, utställningen'), 1, F({ skin: '#f6d7bf', hair: '#b9b3ab', style: 'bob', top: 'jacket', shirt: '#2a4a6a', accent: '#f0c040', bottom: 'skirt', pants: '#2a4a6a', shoes: '#1c1c1c', glasses: 'round', build: 4, blush: true })],
  ['hilda', 'folk', $t('Häxan Hilda'), 2, F({ skin: '#b8d8a0', hair: '#26242c', style: 'long', hat: 'witch', cap: '#26242c', accent: '#46a35a', top: 'robe', shirt: '#4a2a5a', bottom: 'skirt', pants: '#26242c', shoes: '#1c1c1c', glasses: 'round', build: 4 })],
  ['dj', 'folk', $t('DJ:n på lördagsfesten'), 2, F({ skin: '#a06a43', hair: '#1d1714', style: 'afro', top: 'hoodie', shirt: '#8e5bd1', accent: '#f0b429', bottom: 'jeans', pants: '#2d3a5c', shoes: '#f2f2f2', glasses: 'sun', phones: true })],
  ['begcykel', 'saker', $t('Herrcykeln'), 0, { typ: 'fordon', id: 'begcykel', c: '#7a8a6a' }], ['stadscykel', 'saker', $t('Stadscykeln'), 0, { typ: 'fordon', id: 'stadscykel', c: '#3a7bd5' }],
  ['elspark', 'saker', $t('Elsparkcykeln'), 1, { typ: 'fordon', id: 'elspark', c: '#2aa39a' }], ['racer', 'saker', $t('Racercykeln'), 1, { typ: 'fordon', id: 'racer', c: '#d9433b' }],
  ['moppe', 'saker', $t('Moppen'), 2, { typ: 'fordon', id: 'moppe', c: '#e0a02a' }],
  ['pumplykta', 'saker', $t('Pumplyktan'), 0, { typ: 'mobel', k: 'pumplykta', v: 1 }], ['pokal-brons', 'saker', $t('Bronspokalen'), 0, { typ: 'mobel', k: 'pokal', v: 2 }],
  ['pokal-silver', 'saker', $t('Silverpokalen'), 1, { typ: 'mobel', k: 'pokal', v: 1 }],
  ['pokal-guld', 'rar', $t('Guldpokalen'), 2, { typ: 'mobel', k: 'pokal', v: 0 }], ['bis', 'rar', $t('Best in Show'), 3, { typ: 'special', id: 'bis' }],
  ['delfin', 'rar', $t('Delfinen vid piren'), 3, { typ: 'special', id: 'delfin' }], ['guldstaty', 'rar', $t('Guldstatyn'), 3, { typ: 'special', id: 'staty' }],
].map(([id, serie, namn, rar, bild]) => ({ id, serie, namn, rar, bild }));
export const kortById = (id) => KORT.find((k) => k.id === id) || null;
export const serieKort = (s) => KORT.filter((k) => k.serie === s);

// ---------------------------------------------------------------- dragningen
// ett slumpat kort: först sällsyntheten (vikterna), sedan ett kort av den sällsyntheten (rng 0–1)
export function draKort(rng = Math.random) {
  const tot = RARITET.reduce((a, r) => a + r.vikt, 0);
  let x = rng() * tot, rar = 0;
  for (const r of RARITET) { if (x < r.vikt) { rar = r.id; break; } x -= r.vikt; }
  const pool = KORT.filter((k) => k.rar === rar);
  return pool[Math.floor(rng() * pool.length) % pool.length].id;
}
export const draPaket = (n = 3, rng = Math.random) => Array.from({ length: n }, () => draKort(rng));
// lägg korten i samlingen; svarar med de serier som just blev kompletta (belöningen ges av kortSerier)
export function laggTill(G, ids) {
  G.kort ||= {};
  G.kortSerier ||= [];
  for (const id of ids) if (kortById(id)) G.kort[id] = Math.min(99, (G.kort[id] | 0) + 1);
  const nya = [];
  for (const s of SERIER) {
    if (G.kortSerier.includes(s.id)) continue;
    if (serieKort(s.id).every((k) => (G.kort[k.id] | 0) > 0)) { G.kortSerier.push(s.id); G.money += SERIE_PRIS; G.storage.push({ k: 'pokal', v: 0 }); nya.push(s); }
  }
  return nya;
}
export const antalUnika = (G) => KORT.filter((k) => (G.kort?.[k.id] | 0) > 0).length;
export const dubbletter = (G) => KORT.filter((k) => (G.kort?.[k.id] | 0) > 1);
// sparfilen: bara kända kort, 1–99
export function rensaKort(o) {
  const ut = {};
  if (o && typeof o === 'object') for (const [id, n] of Object.entries(o)) if (kortById(id) && (n | 0) > 0) ut[id] = Math.min(99, n | 0);
  return ut;
}

// ---------------------------------------------------------------- bilden
export const KW = 32, KH = 44;
const CACHE = new Map();
// kortets bild (KW × KH px): ram efter sällsynthet, bakgrund efter serie, motivet och glansen
export async function kortBild(id, { saknas = false } = {}) {
  const key = id + (saknas ? '?' : '');
  if (CACHE.has(key)) return CACHE.get(key);
  const K = kortById(id), c = document.createElement('canvas'); c.width = KW; c.height = KH;
  const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
  const R = RARITET[K.rar], S = SERIER.find((s) => s.id === K.serie);
  // ramen: tre toner, rundade hörn
  g.fillStyle = '#1e1a24'; g.fillRect(1, 0, KW - 2, KH); g.fillRect(0, 1, KW, KH - 2);
  g.fillStyle = R.ram[1]; g.fillRect(1, 1, KW - 2, KH - 2);
  g.fillStyle = R.ram[0]; g.fillRect(1, 1, KW - 2, 1); g.fillRect(1, 1, 1, KH - 2);
  g.fillStyle = R.ram[2]; g.fillRect(1, KH - 2, KW - 2, 1); g.fillRect(KW - 2, 1, 1, KH - 2);
  // bildrutan
  g.fillStyle = saknas ? '#3a3442' : S.bg; g.fillRect(3, 3, KW - 6, 30);
  if (!saknas && K.serie === 'rar') for (let y = 3; y < 33; y++) for (let x = 3; x < KW - 3; x++) if (((x * 7 + y * 13) % 23) === 0) { g.fillStyle = '#f8f0c0'; g.fillRect(x, y, 1, 1); }   // stjärnor
  g.fillStyle = mixHex(S.bg, '#000000', 0.15); if (!saknas) g.fillRect(3, 28, KW - 6, 5);   // golvet
  if (!saknas) {
    g.save(); g.beginPath(); g.rect(3, 3, KW - 6, 30); g.clip();
    await rita(g, K);
    g.restore();
  } else { g.fillStyle = '#5a5464'; g.font = 'bold 12px monospace'; g.fillText('?', 12, 23); }
  // nederkanten: sällsynthetsprickar och seriens färg
  g.fillStyle = R.ram[2]; g.fillRect(3, 35, KW - 6, 6);
  for (let i = 0; i <= K.rar; i++) { g.fillStyle = R.ram[0]; g.fillRect(5 + i * 4, 37, 2, 2); }
  // legendariska: regnbågsglans snett över bilden
  if (K.rar === 3 && !saknas) for (let y = 3; y < 33; y++) for (let x = 3; x < KW - 3; x++) { const d = (x + y) % 18; if (d < 3) { g.fillStyle = ['rgba(255,120,160,.35)', 'rgba(255,240,120,.35)', 'rgba(120,220,255,.35)'][d]; g.fillRect(x, y, 1, 1); } }
  CACHE.set(key, c);
  return c;
}
function mixHex(a, b, t) { const p = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)); const A = p(a), B = p(b); return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join(''); }
async function rita(g, K) {
  const b = K.bild, cx = KW / 2;
  if (b.typ === 'pet') { const { drawPet } = await import('../pets/sprites.js'); drawPet(g, cx, 30, b.pet, b.pet.species === 'kanin' ? 'idle' : 'sit', 0.5, 'down'); return; }
  if (b.typ === 'person') { drawPerson(g, cx, 34, b.look, 'down', 0); return; }
  if (b.typ === 'fordon') { const { drawVehicle } = await import('./fordon-art.js'); drawVehicle(g, b.id, cx, 30, 'right', b.c, 0); return; }
  if (b.typ === 'mobel') {
    const { furnArt, drawArt } = await import('../scenes/room.js');
    const a = furnArt(b.k, b.v);
    if (a) drawArt(g, a, Math.round(cx - a.sw / 2), Math.round(30 - a.sh));
    return;
  }
  // specialkorten
  if (b.id === 'bis') {
    // Best in Show: en stor rosett i blått och guld
    g.fillStyle = '#f0c040'; for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2; g.fillRect(Math.round(cx + Math.cos(a) * 9) - 1, Math.round(15 + Math.sin(a) * 9) - 1, 3, 3); }
    g.fillStyle = '#3a7bd5'; g.beginPath(); g.arc(cx, 15, 7, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#f4f1ea'; g.beginPath(); g.arc(cx, 15, 3, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#3a7bd5'; g.fillRect(cx - 5, 22, 3, 9); g.fillRect(cx + 2, 22, 3, 9); g.fillStyle = '#f0c040'; g.fillRect(cx - 5, 30, 3, 1); g.fillRect(cx + 2, 30, 3, 1);
  } else if (b.id === 'delfin') {
    // delfinen i ett hopp över vågorna
    g.fillStyle = '#3a7ab8'; g.fillRect(3, 26, KW - 6, 7); g.fillStyle = '#8ad0f4'; for (let x = 3; x < KW - 3; x += 4) g.fillRect(x, 26 + (x % 8 ? 0 : 1), 3, 1);
    const D = ['......####...', '....#######..', '..##########.', '.#####@#####.', '##########...', '.#..#####....', '......##.....'];
    D.forEach((r, j) => { for (let i = 0; i < r.length; i++) { if (r[i] === '.') continue; g.fillStyle = r[i] === '@' ? '#1e1a24' : j > 3 ? '#c8d8e8' : '#6a8aa8'; g.fillRect(9 + i, 10 + j, 1, 1); } });
    g.fillStyle = '#ffffff'; g.fillRect(8, 23, 1, 1); g.fillRect(22, 24, 1, 1);
  } else if (b.id === 'staty') {
    // guldstatyn på sin sockel
    g.fillStyle = '#8a8a92'; g.fillRect(cx - 7, 24, 14, 7); g.fillStyle = '#b0b0b8'; g.fillRect(cx - 7, 24, 14, 1);
    const L = { skin: '#e0a97f', hair: '#b7392b', style: 'ponytail', top: 'hoodie', shirt: '#3a7bd5', bottom: 'jeans', pants: '#3f5f8f', hat: 'crown' };
    const t = document.createElement('canvas'); t.width = 24; t.height = 40; const tg = t.getContext('2d'); drawPerson(tg, 12, 39, L, 'down', 0);
    const im = tg.getImageData(0, 0, 24, 40), d = im.data, GULD = [[90, 62, 18], [138, 100, 32], [184, 138, 46], [216, 174, 72], [244, 216, 120]];
    for (let i = 0; i < d.length; i += 4) { if (!d[i + 3]) continue; const Lm = (d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11) / 255, c = GULD[Math.min(4, Math.round(Lm * 4.4))]; d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; }
    tg.putImageData(im, 0, 0); g.drawImage(t, cx - 12, 24 - 36);
  }
}
