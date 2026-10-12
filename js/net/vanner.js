// 💛 VÄNNER – Carl 2026-10-12: "kan vi lägga till så man kan bli vänner och att man får en ikon i mobilen … och att
// man får notiser när en vän spelar".
//   • Bli vänner: i 👥 Kompisar (spelarna i Pixelstaden just nu) har varje spelare knappen 💛 Bli vänner. Den andra
//     får frågan och svarar Ja eller Nej tack (js/core/vannerapp.js, via jobbkanalen i world.js som "Flytta ihop").
//   • 💛 Vänner i mobilen (js/core/vannerapp.js): vännerna, om de är i Pixelstaden nu eller när de sågs senast.
//   • En vän hoppar in: "💛 Din vän Mira har precis hoppat in i Pixelstaden!" i stället för den vanliga hälsningen,
//     och kommer man själv in står vännerna som redan är där i hälsningen. Ligger spelet i bakgrunden: en notis.
//   • Appen stängd: pushnotis via servern (server/kbk-push, /van/…) – js/net/vanpush.js.
// Vänlistan gäller figuren (syskon på samma iPad har var sin) och sparas på enheten:
//   snabbfilen_vanner = { [figurens id]: { vid, hemlig, lista: [{ vid, key, namn, look, sedan, sett }], borttagna: [vid] } }
// (borttagna = vänner man själv tog bort när de inte var inne – nästa gång ni möts får den andra veta det, js/core/vannerapp.js)
// vid = figurens vän-id (16 hex, skickas med i Pixelstaden som fältet vi), hemlig = nyckeln mot pushservern (32 hex,
// lämnar aldrig enheten utom till servern, som bara sparar dess sha256). Modulen importerar inte world.js (den
// importerar oss) – förfrågningarna och appen ligger i js/core/vannerapp.js.
import { $t } from '../core/i18n.js';
import { toast } from '../core/ui.js';
import { play } from '../core/sound.js';
import { bakgrundsnotis } from './kbk.js';

const NYCKEL = 'snabbfilen_vanner';
export const MAX_VANNER = 50;
const OM_IGEN_MS = 30 * 60 * 1000;
export const VID_RE = /^[0-9a-f]{16}$/;
let minne = null;   // (världen frågar varje bildruta – läs lagringen en gång)
const ls = {
  get() { if (minne) return minne; try { const v = JSON.parse(localStorage.getItem(NYCKEL) || '{}'); minne = v && typeof v === 'object' ? v : {}; } catch { minne = {}; } return minne; },
  set(v) { minne = v; try { localStorage.setItem(NYCKEL, JSON.stringify(v)); } catch { /* ok */ } },
};
const hex = (n) => { const b = new Uint8Array(n); try { crypto.getRandomValues(b); } catch { for (let i = 0; i < n; i++) b[i] = Math.floor(Math.random() * 256); } return [...b].map((x) => x.toString(16).padStart(2, '0')).join(''); };

// figurens egen post (skapas första gången): { vid, hemlig, lista }
export function vanEgen(av) {
  if (!av?.id) return null;
  const alla = ls.get();
  let e = alla[av.id];
  if (!e || !VID_RE.test(e.vid || '') || !/^[0-9a-f]{32}$/.test(e.hemlig || '') || !Array.isArray(e.lista)) {
    e = { vid: hex(8), hemlig: hex(16), lista: Array.isArray(e?.lista) ? e.lista : [] };
    ls.set({ ...alla, [av.id]: e });
  }
  return e;
}
export const vanVid = (av) => vanEgen(av)?.vid || '';
export const vanLista = (av) => (av?.id ? ls.get()[av.id]?.lista || [] : []);
const spara = (av, lista) => { const e = vanEgen(av); if (!e) return; ls.set({ ...ls.get(), [av.id]: { ...e, lista } }); lyssnare.forEach((f) => { try { f(); } catch { /* ok */ } }); };
// (vanpush.js synkar listan med servern när den ändras)
const lyssnare = new Set();
export const vanOnAndrad = (f) => lyssnare.add(f);

// Är spelaren (närvaron ur world.js: p.vi, p.key) en vän? → vännens post eller null
export function arVan(av, p) {
  if (!p) return null;
  return vanLista(av).find((v) => (p.vi && v.vid === p.vi) || (p.key && v.key && v.key === p.key)) || null;
}
const kortLook = (look) => (look && typeof look === 'object' ? JSON.parse(JSON.stringify(look)) : {});
// Lägg till (eller uppdatera) en vän: { vid, key, namn, look }
export function vanLaggTill(av, v) {
  if (!VID_RE.test(v?.vid || '') || v.vid === vanVid(av)) return false;
  if (vanBorttagen(av, v.vid)) { const e = vanEgen(av); ls.set({ ...ls.get(), [av.id]: { ...e, borttagna: e.borttagna.filter((x) => x !== v.vid) } }); }
  const lista = vanLista(av).filter((x) => x.vid !== v.vid);
  if (lista.length >= MAX_VANNER) return false;
  const gammal = vanLista(av).find((x) => x.vid === v.vid);
  lista.push({ vid: v.vid, key: String(v.key || gammal?.key || '').slice(0, 64), namn: String(v.namn || gammal?.namn || '?').slice(0, 16), look: kortLook(v.look || gammal?.look), sedan: gammal?.sedan || new Date().toISOString().slice(0, 10), sett: Date.now() });
  spara(av, lista);
  return true;
}
// minEgen = jag tog bort vännen (inte hen mig) – då kommer jag ihåg det tills vi möts
export function vanTaBortLokalt(av, vid, minEgen = false) {
  const lista = vanLista(av), ny = lista.filter((x) => x.vid !== vid);
  if (minEgen && VID_RE.test(vid || '')) { const e = vanEgen(av); ls.set({ ...ls.get(), [av.id]: { ...e, borttagna: [...new Set([...(e.borttagna || []), vid])].slice(-MAX_VANNER) } }); }
  if (ny.length !== lista.length) spara(av, ny);
}
export const vanBorttagen = (av, vid) => !!(av?.id && (ls.get()[av.id]?.borttagna || []).includes(vid));
export function vanGlomBorttagen(av, vid) { const e = av?.id ? ls.get()[av.id] : null; if (e?.borttagna?.includes(vid)) ls.set({ ...ls.get(), [av.id]: { ...e, borttagna: e.borttagna.filter((x) => x !== vid) } }); }
// krok: en spelare dök upp i Pixelstaden (vannerapp.js säger till den man tagit bort) – (A, p, id)
export const vanKrokar = { kom: null };
// sågs nyss: namn, utseende och nyckel kan ha ändrats (sparas utan att räknas som en ändrad lista)
function sett(av, p) {
  const alla = ls.get(), e = av?.id ? alla[av.id] : null;
  if (!e) return;
  const v = e.lista.find((x) => (p.vi && x.vid === p.vi) || (p.key && x.key === p.key));
  if (!v) return;
  Object.assign(v, { sett: Date.now(), namn: String(p.av?.name || v.namn).slice(0, 16), look: p.av?.look ? kortLook(p.av.look) : v.look, key: p.key || v.key });
  ls.set({ ...alla });
}

// ---------- hälsningarna (anropas av world.js) ----------
const halsad = new Map();   // vid → senaste hälsningen
// En annan spelare kom in (id = spelar-id:t i världen). true = det var en vän och hälsningen är gjord.
export function vanKomIn(A, p, id) {
  try { vanKrokar.kom?.(A, p, id); } catch { /* ok */ }
  const v = arVan(A?.avatar, p);
  if (!v) return false;
  sett(A.avatar, p);
  const nu = Date.now();
  if (nu - (halsad.get(v.vid) || 0) < OM_IGEN_MS) return true;   // samma vän nyss (tappad uppkoppling, omladdning)
  halsad.set(v.vid, nu);
  const text = $t`💛 Din vän ${String(p.av?.name || v.namn)} har precis hoppat in i Pixelstaden!`;
  play('knock');
  toast(text, 'good');
  bakgrundsnotis(text, 'van');
  return true;
}
// Man kom själv in: vänner som redan är där (players = världens andra spelare, med id)
export function vanRedanHar(A, players) {
  const nu = Date.now(), namn = [];
  for (const p of players) {
    try { vanKrokar.kom?.(A, p, p.id); } catch { /* ok */ }
    const v = arVan(A?.avatar, p);
    if (!v) continue;
    sett(A.avatar, p);
    halsad.set(v.vid, nu);
    namn.push(String(p.av?.name || v.namn));
  }
  if (namn.length) setTimeout(() => toast($t`💛 Dina vänner i Pixelstaden: ${namn.join(', ')}`, 'good'), 2400);
}
// Vännerna som är i Pixelstaden just nu: [{ v, p }] (players = playersList() ur world.js)
export function vanInne(av, players) {
  const ut = [];
  for (const p of players || []) { const v = arVan(av, p); if (v && !ut.some((x) => x.v.vid === v.vid)) ut.push({ v, p }); }
  return ut;
}
