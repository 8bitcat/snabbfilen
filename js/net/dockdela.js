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
import { onJob, sendJob, worldInfo, playersList } from './world.js';
import { openModal, closeModal, modalOpen, esc } from '../core/ui.js';
import { play } from '../core/sound.js';
import { $t } from '../core/i18n.js';
import { arVan } from './vanner.js';

export const DOCK_K = 'dock';
let A0 = null;
export function dockDelaInit(A) { A0 = A; }
export const dockMyId = () => worldInfo().myId || null;
export const dockSend = (m) => sendJob({ k: DOCK_K, ...m });
// bjud in en spelare (id ur playersList) till mitt hus
export const dockBjudIn = (A, toId) => dockSend({ t: 'inv', to: toId, namn: String(A.avatar?.name || '').slice(0, 16) });
// alla i världen just nu, vännerna först
export function dockKandidater(A) {
  return playersList().map((p) => ({ id: p.id, namn: p.av?.name || '?', van: !!arVan(A.avatar, p), look: p.av?.look || null }))
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
