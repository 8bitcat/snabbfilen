// 🐾 djurNET – köpa och sälja djur (Carl 2026-10-13: "Ramona … vill kunna sälja sina katter" → "göra hela katt-
// uppgraderingen, man ska kunna köpa och sälja djur, appen ska heta djurNET"). Logiken – ingen DOM; appen och
// köparnas besök: js/core/djurnetapp.js. Tillståndet ligger i spelets sparfil (g.djurnet, game.js).
//
//   • VÄRDERINGEN (varde): rasens pris i djuraffären × åldern (ung bäst, vuxen −15 %) + utställningens rosetter och
//     Best in Show + agilityträningen + frisyren från Klipp & Klo + blandkull + glad och välmående. Ungar ('unge')
//     får inte flytta hemifrån än; ett ledset djur, ett som väntar ungar eller är ute på promenad säljs inte just nu.
//   • ANNONSERNA (högst 3): man väljer priset själv (50–200 % av värdet). Köpare hör av sig efter en stund på
//     spelklockan – ju lägre pris mot värdet, desto fortare. Budet är aldrig högre än priset; man kan tacka ja, pruta
//     en gång eller tacka nej. En försäljning om dagen. En speldag senare kommer en hälsning från den nya familjen.
//     Fem sålda djur = meriten Uppfödare i troféskåpet.
//   • KÖP: sex djur från uppfödare varje dag (samma för alla – dagen är froet): ungar, unga och vuxna, ibland med
//     rosetter, frisyr eller blandkull. Priset = värdet + 15 %. Djuret flyttar in direkt (petStore().importPet).
import { petStore, seededRng, NAMN, GROW_AT, MAX_PETS } from './sim.js';
import { SPECIES } from './sprite-data.js';
import { $t } from '../core/i18n.js';

export const MAX_ANNONSER = 3, MIN_PRIS = 0.5, MAX_PRIS = 2, SALJ_MERIT = 5, UTBUD_N = 6;
const PALAGG = 1.15;   // uppfödarnas pris mot värdet
export const FAMILJER = [
  $t('Familjen Berg'), $t('Familjen Lind'), $t('Familjen Holm'), $t('Familjen Ek'), $t('Familjen Nyström'), $t('Familjen Al-Sayed'),
  $t('Familjen Kowalski'), $t('Familjen Rossi'), $t('Familjen Öberg'), $t('Familjen Sandberg'), $t('Familjen Dahl'), $t('Familjen Novak'),
];
export const UPPFODARE = {   // (varje djurslag har sina egna uppfödare)
  katt: [$t('Kattgården i Tassbacken'), $t('Gun i Linnéstaden'), $t('Katthemmet Morrhåret')],
  hund: [$t('Hundkojan på landet'), $t('Kennel Pixelberg'), $t('Uppfödaren på Solön')],
  kanin: [$t('Kaninbacken'), $t('Lilla kaningården')],
};
// hälsningarna från den nya familjen (en speldag efter försäljningen) – {0} = djurets namn
const HALSNING = [
  $t('{0} mår jättebra och har redan hittat en egen fönsterplats!'), $t('{0} sov i vår säng första natten. Tack för allt!'),
  $t('Barnen leker med {0} hela dagarna – vi är så glada!'), $t('{0} har ätit upp hela matskålen och vill ha mer.'),
  $t('{0} har fått en ny leksak och en mjuk korg. Hälsningar!'), $t('Vi tog med {0} till parken i dag. Alla ville klappa!'),
];

const round10 = (v) => Math.max(10, Math.round(v / 10) * 10);
export const absMin = (g) => (g.day | 0) * 1440 + (g.min | 0);
export function dn(g) {
  if (!g.djurnet || typeof g.djurnet !== 'object') g.djurnet = {};
  const D = g.djurnet;
  if (!Array.isArray(D.annonser)) D.annonser = [];
  if (!Array.isArray(D.halsningar)) D.halsningar = [];
  if (!D.kopt || typeof D.kopt !== 'object') D.kopt = { dag: 0, ids: [] };
  D.salda |= 0; D.dagSalt |= 0;
  return D;
}
const breedOfSnap = (p) => { const S = SPECIES[p?.species] || SPECIES.katt; return S.breeds.find((b) => b.id === p?.breed) || S.breeds[0]; };

// ---------- värderingen ----------
// → { pris, rader: [[text, belopp]], saljbar, varfor } – raderna visas i appen
export function varde(p) {
  const B = breedOfSnap(p), rader = [];
  let v = B.pris;
  rader.push([$t`Ras: ${B.namn}`, B.pris]);
  if (p.stage === 'vuxen') { const d = -Math.round(v * 0.15); v += d; rader.push([$t('Vuxen (de unga är mest efterfrågade)'), d]); }
  else if (p.stage === 'ung') rader.push([$t('Ung – den bästa åldern att flytta'), 0]);
  const u = p.utst || {}, r = u[p.species] || [0, 0, 0], ag = u.agility || [0, 0, 0];
  const ros = Math.min(0.6, (r[0] | 0) * 0.12 + (r[1] | 0) * 0.06 + (r[2] | 0) * 0.03 + (ag[0] | 0) * 0.06 + (ag[1] | 0) * 0.03);
  if (ros > 0) { const d = Math.round(B.pris * ros); v += d; rader.push([$t`Rosetter från utställningen (${(r[0] | 0) + (r[1] | 0) + (r[2] | 0) + (ag[0] | 0) + (ag[1] | 0) + (ag[2] | 0)} st)`, d]); }
  if ((u.bis | 0) > 0) { const d = Math.round(B.pris * 0.5 * Math.min(2, u.bis | 0)); v += d; rader.push([$t('Best in Show'), d]); }
  if ((p.agil | 0) >= 5) { const d = Math.round(B.pris * 0.08); v += d; rader.push([$t('Tränad i agility'), d]); }
  if (p.frisyr) { v += 80; rader.push([$t('Frisyr från Klipp & Klo'), 80]); }
  if (p.breed2) { const d = Math.round(B.pris * 0.15); v += d; rader.push([$t('Blandkull – ovanlig päls'), d]); }
  if ((p.happy ?? 70) >= 80) { const d = Math.round(v * 0.1); v += d; rader.push([$t('Glad och välmående'), d]); }
  const pris = round10(v);
  let varfor = '';
  if (p.stage === 'unge') varfor = $t('Ungen är för liten för att flytta – vänta tills den har vuxit till ung.');
  else if ((p.happy ?? 70) < 40) varfor = $t('Djuret är ledset just nu – ingen vill köpa ett ledset djur. Lek och klappa först!');
  else if (p.pregnantUntil != null) varfor = $t('Djuret väntar ungar – vänta tills de är födda.');
  else if (p.out) varfor = $t('Djuret är ute på promenad – gå hem först.');
  return { pris, rader, saljbar: !varfor, varfor };
}

// ---------- annonserna ----------
export function annonsera(g, petId, pris, nu = absMin(g)) {
  const D = dn(g), p = petStore().petById(petId);
  if (!p) return { ok: false, fel: $t('Djuret finns inte.') };
  const V = varde(p);
  if (!V.saljbar) return { ok: false, fel: V.varfor };
  if (D.annonser.some((a) => a.pet === petId)) return { ok: false, fel: $t('Djuret har redan en annons.') };
  if (D.annonser.length >= MAX_ANNONSER) return { ok: false, fel: $t`Du kan ha högst ${MAX_ANNONSER} annonser samtidigt.` };
  const lagst = round10(V.pris * MIN_PRIS), hogst = round10(V.pris * MAX_PRIS);
  pris = Math.max(lagst, Math.min(hogst, round10(+pris || V.pris)));
  const a = { id: 'a' + nu.toString(36) + Math.floor(Math.random() * 1e4).toString(36), pet: petId, pris, sedan: nu, bud: null, nasta: 0 };
  D.annonser.push(a);
  return { ok: true, annons: a };
}
export function taBortAnnons(g, id) { const D = dn(g), n = D.annonser.length; D.annonser = D.annonser.filter((a) => a.id !== id); return D.annonser.length < n; }

// varje stund (appen kör den varannan sekund): köpare hör av sig, hälsningar kommer fram → [händelser]
export function djurnetTick(g, rng = Math.random, nu = absMin(g)) {
  const D = dn(g), store = petStore(), ev = [];
  D.annonser = D.annonser.filter((a) => store.petById(a.pet));
  for (const a of D.annonser) {
    if (a.bud || D.dagSalt === (g.day | 0)) continue;
    const p = store.petById(a.pet), V = varde(p);
    if (!V.saljbar) continue;
    const kvot = a.pris / Math.max(1, V.pris);
    if (!a.nasta) a.nasta = a.sedan + Math.round((20 + rng() * 70) * Math.max(0.6, kvot * kvot * 1.4));
    if (nu < a.nasta) continue;
    const belopp = kvot <= 1 ? a.pris : round10(Math.min(a.pris, V.pris * (0.95 + rng() * 0.15)));
    a.bud = { familj: FAMILJER[Math.floor(rng() * FAMILJER.length)], belopp, prutat: false, t: nu, fro: Math.floor(rng() * 1e6), ny: true };
    ev.push({ typ: 'bud', annons: a, pet: p });
  }
  for (const h of D.halsningar) if (!h.kom && (g.day | 0) >= h.dag) { h.kom = true; h.ny = true; ev.push({ typ: 'halsning', h }); }
  while (D.halsningar.length > 20) D.halsningar.shift();
  return ev;
}
// pruta en gång: mot = mitt emellan budet och priset. → { ok, mot, kvar (budet står kvar / höjt) }
export function pruta(g, id, rng = Math.random, nu = absMin(g)) {
  const D = dn(g), a = D.annonser.find((x) => x.id === id);
  if (!a?.bud || a.bud.prutat || a.bud.belopp >= a.pris) return { ok: false };
  const p = petStore().petById(a.pet), V = varde(p), mot = round10((a.bud.belopp + a.pris) / 2);
  a.bud.prutat = true;
  if (rng() < (mot <= V.pris * 1.1 ? 0.6 : 0.25)) { a.bud.belopp = mot; return { ok: true, mot, kvar: true }; }
  const familj = a.bud.familj;
  a.bud = null; a.nasta = nu + 40 + Math.floor(rng() * 80);
  return { ok: true, mot, kvar: false, familj };
}
export function tackaNej(g, id, rng = Math.random, nu = absMin(g)) {
  const a = dn(g).annonser.find((x) => x.id === id);
  if (!a?.bud) return false;
  a.bud = null; a.nasta = nu + 30 + Math.floor(rng() * 60);
  return true;
}
// tacka ja: djuret flyttar, pengarna kommer, en hälsning en speldag senare → { ok, pet, belopp, familj, fro, merit } | { ok:false, fel }
export function saljTill(g, id, rng = Math.random) {
  const D = dn(g), a = D.annonser.find((x) => x.id === id), store = petStore();
  if (!a?.bud) return { ok: false, fel: $t('Budet finns inte längre.') };
  if (D.dagSalt === (g.day | 0)) return { ok: false, fel: $t('Du har redan sålt ett djur i dag – djurNET tillåter en försäljning om dagen.') };
  const p = store.petById(a.pet);
  if (!p) { taBortAnnons(g, id); return { ok: false, fel: $t('Djuret finns inte.') }; }
  const V = varde(p);
  if (!V.saljbar) return { ok: false, fel: V.varfor };
  const snap = store.snapshot(p.id), { belopp, familj, fro } = a.bud;
  store.removePet(p.id);
  D.annonser = D.annonser.filter((x) => x.id !== id);
  g.money += belopp;
  D.salda += 1; D.dagSalt = g.day | 0;
  D.halsningar.push({ id: 'h' + Date.now().toString(36), namn: snap.name, familj, dag: (g.day | 0) + 1, snap, text: Math.floor(rng() * HALSNING.length), kom: false, ny: false });
  let merit = false;
  if (D.salda === SALJ_MERIT && g.merit) { g.merit('uppfodare', 1, { vem: snap.name }); merit = true; }
  return { ok: true, pet: snap, belopp, familj, fro, merit };
}
export const halsningText = (h) => (HALSNING[h.text] || HALSNING[0]).replace('{0}', h.namn);

// ---------- köp: uppfödarnas djur i dag (samma för alla) ----------
const STAGE_ALDER = { unge: [1, 3], ung: [4, 7], vuxen: [8, 40] };
export function utbud(g) {
  const dag = g.day | 0, r = seededRng(9173 + dag * 7919), ut = [];
  for (let i = 0; i < UTBUD_N; i++) {
    const x = r(), species = x < 0.45 ? 'katt' : x < 0.8 ? 'hund' : 'kanin';
    const S = SPECIES[species], B = S.breeds[Math.floor(r() * S.breeds.length)];
    const y = r(), stage = y < 0.3 ? 'unge' : y < 0.72 ? 'ung' : 'vuxen';
    const sex = B.id === 'skoldpadd' ? 'hona' : r() < 0.5 ? 'hane' : 'hona';
    const [a0, a1] = STAGE_ALDER[stage], alder = a0 + Math.floor(r() * (a1 - a0 + 1));
    const lista = NAMN[species][sex], name = lista[Math.floor(r() * lista.length)];
    const snap = { name, species, breed: B.id, sex, alder, stage, grow: GROW_AT[stage], happy: 85, seed: Math.floor(r() * 1e6) };
    if (stage !== 'unge' && r() < 0.18) snap.utst = { [species === 'hund' && r() < 0.4 ? 'agility' : species]: [1 + Math.floor(r() * 2), Math.floor(r() * 2), 0] };
    if (species !== 'kanin' && r() < 0.12) { const o = S.breeds[Math.floor(r() * S.breeds.length)]; if (o.id !== B.id) { snap.breed2 = o.id; snap.mix = [B.id, o.id]; } }
    const V = varde({ ...snap, happy: 70 });
    ut.push({ id: `${dag}-${i}`, snap, pris: round10(V.pris * PALAGG), saljare: UPPFODARE[species][Math.floor(r() * UPPFODARE[species].length)] });
  }
  const D = dn(g), kopta = D.kopt.dag === dag ? D.kopt.ids : [];
  return ut.filter((u) => !kopta.includes(u.id));
}
// köp ett av uppfödarnas djur → { ok, pet } | { ok:false, fel }
export function kopFranUppfodare(g, id) {
  const u = utbud(g).find((x) => x.id === id), store = petStore();
  if (!u) return { ok: false, fel: $t('Djuret är redan sålt.') };
  if (g.money < u.pris) return { ok: false, fel: $t('Du har inte råd.') };
  if (store.pets.length >= MAX_PETS) return { ok: false, fel: $t`Du kan ha högst ${MAX_PETS} djur.` };
  const p = store.importPet(u.snap, g.home, { day: g.day });
  if (!p) return { ok: false, fel: store.lastError || $t('Det gick inte.') };
  g.money -= u.pris;
  const D = dn(g);
  if (D.kopt.dag !== (g.day | 0)) D.kopt = { dag: g.day | 0, ids: [] };
  D.kopt.ids.push(u.id);
  return { ok: true, pet: p, pris: u.pris };
}
// spelets sparfil (game.js load): bara rimliga värden följer med
export function rensaDjurnet(o) {
  const D = { annonser: [], halsningar: [], kopt: { dag: 0, ids: [] }, salda: 0, dagSalt: 0 };
  if (!o || typeof o !== 'object') return D;
  const num = (v) => (Number.isFinite(+v) ? +v : 0), kr = (v) => Math.max(10, Math.min(100000, num(v) | 0));
  D.salda = Math.max(0, num(o.salda) | 0); D.dagSalt = Math.max(0, num(o.dagSalt) | 0);
  if (Array.isArray(o.annonser)) D.annonser = o.annonser.filter((a) => a && typeof a.pet === 'string').slice(0, MAX_ANNONSER).map((a) => ({
    id: String(a.id).slice(0, 24), pet: String(a.pet).slice(0, 24), pris: kr(a.pris), sedan: num(a.sedan), nasta: num(a.nasta),
    bud: a.bud && typeof a.bud === 'object' ? { familj: String(a.bud.familj || '').slice(0, 40), belopp: kr(a.bud.belopp), prutat: !!a.bud.prutat, t: num(a.bud.t), fro: num(a.bud.fro) | 0, ny: !!a.bud.ny } : null }));
  if (Array.isArray(o.halsningar)) D.halsningar = o.halsningar.filter((h) => h && h.snap && typeof h.snap === 'object').slice(-20).map((h) => ({
    id: String(h.id).slice(0, 24), namn: String(h.namn || '').slice(0, 16), familj: String(h.familj || '').slice(0, 40), dag: num(h.dag) | 0, snap: h.snap, text: num(h.text) | 0, kom: !!h.kom, ny: !!h.ny }));
  if (o.kopt && typeof o.kopt === 'object') D.kopt = { dag: num(o.kopt.dag) | 0, ids: Array.isArray(o.kopt.ids) ? o.kopt.ids.map(String).slice(0, 12) : [] };
  return D;
}
// siffran på appen: nya bud + nya hälsningar
export function djurnetNytt(g) { const D = dn(g); return D.annonser.filter((a) => a.bud?.ny).length + D.halsningar.filter((h) => h.ny).length; }
