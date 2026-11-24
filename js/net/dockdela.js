// 👫 LEKA IHOP I DOCKSKÅPET (v0.168, Carl 2026-11-22: "man ska kunna bjuda in sina kompisar i dockskåpsläget …
// kompisen ska också kunna trycka på allting, båda ska se animationerna när kompisen gör något").
// Ett tunt lager ovanpå jobbkanalen i js/net/world.js (sendJob/onJob: värden i världen reläar allt till alla,
// här filtreras på k = 'dock'). Den som bjuder in är VÄRD för sitt hus; gästen får hela huset skickat till sig och
// sedan varje ändring (möbler, figurer, saker, djur, teman, natt) och varje tryck (reaktionerna) från båda hållen.
// Inbjudan tas emot här – scenen (js/scenes/dockskap.js) laddas först när man går in, så den här modulen är alltid
// med (main.js dockDelaInit). Allt annat i protokollet sköter scenen via onDock.
//   { t: 'inv', to, namn }            värden → en spelare: kom och lek
//   { t: 'join', to }                 gästen → värden: jag är här, skicka huset
//   { t: 'state', to?, hus }          värden → gästen (och var 6:e s till alla gäster): hela huset
//   { t: 'act', a: { op, … } }        båda hållen: en ändring eller ett tryck (dockskap.js tillampa)
//   { t: 'leave' } / { t: 'stang' }   gästen gick / värden stängde
//
// 📲 Inbjudan med pushnotis (v0.178, Carl 2026-11-24: "när man bjuder in en kompis så skickas det en notis för dem som
// sedan tar dem rätt in i deras hus så kan de bygga tillsammans"): vänner som inte är inne får inbjudan via servern
// (js/net/vanpush.js vanDockBjud). Ett tryck på notisen öppnar appen, Dockskåpet och världen, och så fort värden syns
// i världen (spelaren med samma vän-id) går man in i värdens hus (dockVantaPaVard). Utan tryck – och på webben –
// visas inbjudan som en ruta nästa gång spelet tittar efter den (var 30:e sekund, och när man kommer tillbaka).
import { onJob, sendJob, worldInfo, playersList, ensureWorld } from './world.js';
import { openModal, closeModal, modalOpen, esc, toast } from '../core/ui.js';
import { play } from '../core/sound.js';
import { $t } from '../core/i18n.js';
import { arVan, vanLista } from './vanner.js';
import { vanDockHamta } from './vanpush.js';
import { pushPlugin } from './kbkpush.js';

export const DOCK_K = 'dock';
let A0 = null;
const hanterade = new Set();   // inbjudningar (id) som redan visats eller tryckts på
export function dockDelaInit(A) {
  A0 = A;
  const P = pushPlugin();
  // ett tryck på notisen – också när appen startas av trycket (pluginet sparar händelsen tills någon lyssnar)
  try { if (P) P.addListener('pushNotificationActionPerformed', (e) => {
    const d = e?.notification?.data || {};
    if (!/^[0-9a-f]{16}$/.test(String(d.dock || ''))) return;
    if (d.id) hanterade.add(String(d.id));
    setTimeout(() => dockVantaPaVard(A0, String(d.dock), String(d.namn || '').slice(0, 16)), 900);   // (kallstart: låt menyn hinna upp först)
  })?.catch?.(() => {}); } catch { /* ok */ }
  setTimeout(() => dockKollaInbjudningar(A), 6000);
  setInterval(() => { if (!document.hidden) dockKollaInbjudningar(A); }, 30000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) setTimeout(() => dockKollaInbjudningar(A), 1500); });
}
// inbjudningar som väntar på servern (vänner som bjöd in medan man inte tryckte på notisen)
let kollar = false;
export async function dockKollaInbjudningar(A) {
  if (kollar || !A?.avatar?.name || !vanLista(A.avatar).length || dockVantar) return;
  kollar = true;
  try {
    const nya = (await vanDockHamta(A)).filter((x) => x && !hanterade.has(String(x.id)));
    nya.forEach((x) => hanterade.add(String(x.id)));
    const x = nya.at(-1);   // (den senaste)
    if (!x || (A.sceneName === 'dockskap' && A.scene?.dockGast?.())) return;
    visaInbjudan(String(x.fran || '').slice(0, 16), () => dockVantaPaVard(A, String(x.fvid), String(x.fran || '').slice(0, 16)));
  } catch { /* offline */ } finally { kollar = false; }
}
function visaInbjudan(namn0, kom) {
  if (modalOpen()) closeModal();
  const namn = esc(namn0 || $t('En kompis'));
  play('knock');
  openModal($t('👫 Leka ihop?'), `<p style="font-size:var(--f2)">${$t`${namn} bjuder in dig till sitt hus – kom och lek ihop! Ni ser samma hus, och allt som den ena gör ser den andra.`}</p>`, [
    { label: $t('🧸 Kom!'), cls: 'btn-go', onClick: () => { closeModal(); kom(); } },
    { label: $t('Nej tack'), onClick: closeModal },
  ]);
}
// Till en väns dockhus: öppna Dockskåpet och världen, vänta tills vännen (samma vän-id) syns, gå sedan in.
let dockVantar = null;
export function dockVantaPaVard(A, vid, namn) {
  if (!A || !vid) return;
  if (dockVantar) clearInterval(dockVantar.timer);
  ensureWorld(A);
  if (A.sceneName !== 'dockskap') {
    if (modalOpen()) closeModal();
    import('../core/menu.js').then((m) => m.close?.()).catch(() => {}).finally(() => A.openDockskap?.());
  }
  toast($t`🧸 På väg hem till ${namn || $t('kompisen')} …`);
  const t0 = Date.now();
  const leta = () => {
    const p = playersList().find((x) => x.vi === vid);
    if (p) { clearInterval(dockVantar.timer); dockVantar = null; dockGaTill(A, p.id, namn || p.av?.name || ''); return; }
    if (Date.now() - t0 > 45000) { clearInterval(dockVantar.timer); dockVantar = null; toast($t`😕 ${namn || $t('Kompisen')} är inte kvar i dockhuset just nu – bjud in hen igen när ni båda är där.`, 'bad'); }
  };
  dockVantar = { vid, timer: setInterval(leta, 600) };
  leta();
}
export const dockVantarPa = () => dockVantar?.vid || null;
export const dockMyId = () => worldInfo().myId || null;
export const dockSend = (m) => sendJob({ k: DOCK_K, ...m });
// bjud in en spelare (id ur playersList) till mitt hus
export const dockBjudIn = (A, toId) => dockSend({ t: 'inv', to: toId, namn: String(A.avatar?.name || '').slice(0, 16) });
// alla i världen just nu, vännerna först
export function dockKandidater(A) {
  return playersList().map((p) => ({ id: p.id, vi: p.vi || '', namn: p.av?.name || '?', van: !!arVan(A.avatar, p), look: p.av?.look || null }))
    .sort((a, b) => (b.van - a.van) || a.namn.localeCompare(b.namn));
}
const lyss = new Set();
export const onDock = (cb) => { lyss.add(cb); return () => lyss.delete(cb); };
onJob(({ from, m }) => {
  if (!m || m.k !== DOCK_K) return;
  if (m.t === 'inv') { inbjudan(from, m); return; }
  for (const cb of lyss) { try { cb(m, from); } catch (e) { console.error('leka ihop:', e); } }
});
let senasteInv = null;   // (testerna: den senaste inbjudan)
export const dockSenasteInbjudan = () => senasteInv;
function inbjudan(from, m) {
  const A = A0;
  if (!A || m.to !== dockMyId()) return;
  senasteInv = { from, namn: String(m.namn || '').slice(0, 16), t: Date.now() };
  if (A.sceneName === 'dockskap' && A.scene?.dockGast?.()) return;   // (leker redan hos någon)
  if (modalOpen()) return;   // stör inte mitt i en dialog – kompisen kan bjuda igen
  const namn = esc(senasteInv.namn || $t('En kompis'));
  play('knock');
  openModal($t('👫 Leka ihop?'), `<p style="font-size:var(--f2)">${$t`${namn} bjuder in dig till sitt hus – kom och lek ihop! Ni ser samma hus, och allt som den ena gör ser den andra.`}</p>`, [
    { label: $t('🧸 Kom!'), cls: 'btn-go', onClick: () => { closeModal(); dockGaTill(A, from, senasteInv.namn); } },
    { label: $t('Nej tack'), onClick: closeModal },
  ]);
}
// gå till kompisens hus: står man redan i Dockskåpet byter scenen hus, annars öppnas det
export function dockGaTill(A, host, namn) {
  A.dockGast = { host, namn: String(namn || '').slice(0, 16) };
  if (A.sceneName === 'dockskap' && A.scene?.gaTill) { A.scene.gaTill(host, A.dockGast.namn); return; }
  A.openDockskap?.();
}
