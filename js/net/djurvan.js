// 🐾 djurNET MELLAN VÄNNER – annonserna på pushservern (server/kbk-push, adresserna /djur/…). Spelets djurNET
// (js/pets/djurnet.js, js/core/djurnetapp.js) lägger ut ens annonser här också när man har vänner, så att vänner åt
// BÅDA hållen ser dem under 🛒 Köp och kan köpa djuret. Säljaren hämtar beskedet (/djur/salda) och får pengarna.
// Samma vän-id och hemlighet som vännerna (js/net/vanner.js); testrobotarna pratar aldrig med den riktiga servern
// (?kbkpush=<adress> pekar dem mot en låtsasserver). Inget svar (offline) = null.
import { vanEgen, vanLista } from './vanner.js';
import { pushPost } from './kbkpush.js';

const auth = (A) => { const e = vanEgen(A?.avatar); return e ? { vid: e.vid, hemlig: e.hemlig, namn: String(A.avatar.name || '?').slice(0, 16) } : null; };
export const djurVanKan = (A) => !!auth(A) && vanLista(A?.avatar).length > 0;
async function anrop(A, vag, data = {}) {
  const a = auth(A);
  if (!a) return null;
  try { const r = await pushPost(vag, { ...a, ...data }); return r && typeof r === 'object' ? r : null; } catch { return null; }
}
export const djurVanAnnonsera = (A, id, pris, snap) => anrop(A, '/djur/annons', { id, pris, snap });
export const djurVanTaBort = (A, id) => anrop(A, '/djur/tabort', { id });
export async function djurVanLista(A) { const r = await anrop(A, '/djur/lista'); return r?.ok && Array.isArray(r.vanner) ? r.vanner : null; }
export const djurVanKop = (A, saljare, id, pris) => anrop(A, '/djur/kop', { saljare, id, pris });
export async function djurVanSalda(A) { const r = await anrop(A, '/djur/salda'); return r?.ok && Array.isArray(r.salda) ? r.salda : null; }
export const djurVanKvittera = (A, ids) => anrop(A, '/djur/kvittera', { ids });
