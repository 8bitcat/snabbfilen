// BO IHOP (Carl 2026-10-02: "gör alternativ A") – två spelare flyttar ihop på riktigt: de delar
// hem, möbler och trädgård, båda sover där och hyran delas på två (game.js hyra). Det fungerar
// även när den andra inte är online – båda sparfilerna har en kopia av det delade hemmet
// (game.js samboSnap/samboAdopt) och när ni ses igen tar den äldre kopian över den nyare.
//
// Protokollet går över jobbkanalen i world.js ({ k: 'sambo', t, to, key, … }, to = mottagarens
// spelar-id, key = avsändarens fasta nyckel):
//   bjud  värden → den andra: "flytta in hos mig" (hem, hyran var)
//   ja    svaret (nej = tackade nej)
//   inflytt  värden → den inflyttade: välkommen – här är hemmet (snap)
//   synk  hemmets senaste version (ver, stamp, snap) – skickas när den andra syns online och
//         när min version ändras; mottagaren tar över om avsändarens är nyare, annars svarar den
//         med sin egen
//   ut    flytta isär (den inflyttade får tillbaka sitt gamla hem, värden bor kvar)
// Hushållets id (hu = 'sb-' + kort hash av de två nycklarna) gör att ni är i SAMMA rum hemma
// (world.js myScene) och att den som hälsar på hamnar hos er båda.
import { sendJob, onJob, worldMyId, worldMyKey, playersList } from './world.js';
import { openModal, closeModal, toast, esc } from '../core/ui.js';
import { play } from '../core/sound.js';
import { homeOf, fmt } from '../game.js';

export function hushOf(k1, k2) {
  const s = [String(k1), String(k2)].sort().join('|');
  let h1 = 0x811c9dc5, h2 = 0x1234567;
  for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); h1 = Math.imul(h1 ^ c, 16777619) >>> 0; h2 = Math.imul(h2 + c, 2654435761) >>> 0; }
  return 'sb-' + (h1.toString(36) + h2.toString(36)).slice(0, 10);
}
let A = null;
let pending = null;          // inbjudan jag skickat: { to, key, until }
let accepted = null;         // inbjudan jag tackat ja till och väntar på inflytt: { key, until }
let lastSent = { key: null, ver: -1, id: null };
const send = (m) => sendJob({ k: 'sambo', key: worldMyKey(), ...m });
const partner = () => { const S = A?.game?.sambo; return S ? playersList().find((p) => p.key === S.key) || null : null; };
export const samboPartnerOnline = () => !!partner();

// värden bjuder in någon i 👥-listan
export function inviteSambo(p) {
  const g = A.game;
  if (g.sambo) { toast(`🏠 Du bor redan ihop med ${g.sambo.namn}.`, 'bad'); return false; }
  if (!p?.key) { toast('🏠 Den spelaren har en för gammal version – be hen ladda om sidan.', 'bad'); return false; }
  pending = { to: p.id, key: p.key, until: Date.now() + 120000 };
  send({ t: 'bjud', to: p.id, namn: String(A.avatar?.name || '').slice(0, 16), hem: g.home, hyra: Math.ceil(g.homeInfo.rent / 2), full: g.homeInfo.rent });
  toast(`🏠 Du har frågat ${p.av?.name || 'kompisen'} om ni ska flytta ihop. Väntar på svar …`, 'good');
  return true;
}
// flytta isär (från 👥-rutan)
export function splitSambo() {
  const g = A.game, S = g.sambo;
  if (!S) return;
  const p = partner();
  if (p) send({ t: 'ut', to: p.id });
  const was = g.flyttaIsar();
  lastSent = { key: null, ver: -1, id: null };
  play('door');
  toast(was?.roll === 'inflyttad' ? `🏠 Du flyttade isär från ${was.namn} – välkommen hem till ${homeOf(g.home).name}!` : `🏠 Ni har flyttat isär. ${was?.namn || 'Kompisen'} flyttar ut – ${homeOf(g.home).name} är ditt igen.`, 'good');
  reloadHome();
}
// rummet ritas om när hemmet ändrats (inte mitt i Möblera eller sömnen)
function reloadHome() {
  if (!A || (A.sceneName !== 'room' && A.sceneName !== 'city')) return;
  if (A.sceneName === 'room' && (A.scene?.asleep || document.body.classList.contains('decor-on'))) return;
  if (A.sceneName === 'room') A.go('room');
}
function sendSynk(p) {
  const g = A.game, S = g.sambo;
  if (!S || !p) return;
  lastSent = { key: S.key, ver: S.ver, id: p.id };
  send({ t: 'synk', to: p.id, ver: S.ver, stamp: S.stamp, hem: S.hem, hu: S.hu, snap: g.samboSnap() });
}

onJob((ev) => {
  const m = ev?.m;
  if (!A || m?.k !== 'sambo' || m.to !== worldMyId()) return;
  const g = A.game, from = ev.from, S = g.sambo;
  const namn = esc(String(m.namn || 'En kompis').slice(0, 16));
  if (m.t === 'bjud') {
    if (S) { send({ t: 'nej', to: from, namn: A.avatar?.name, why: 'upptagen' }); return; }
    const H = homeOf(m.hem);
    play('knock');
    openModal('🏠 Flytta ihop?', `<p style="font-size:var(--f2);margin-top:0"><b>${namn}</b> vill att du flyttar in i ${esc(H.icon)} <b>${esc(H.name)}</b>!</p>
      <p style="font-size:var(--f2)">Ni delar hem, möbler och trädgård och kan sova där båda två. Hyran delas: <b>${fmt(m.hyra | 0)}</b> var i veckan (i stället för ${fmt(m.full | 0)}). Ditt eget hem sparas – flyttar ni isär får du tillbaka det.</p>`, [
      { label: '🏠 Flytta in!', cls: 'btn-go', onClick: () => { closeModal(); accepted = { key: m.key, until: Date.now() + 120000 }; send({ t: 'ja', to: from, namn: String(A.avatar?.name || '').slice(0, 16) }); toast(`🏠 Du flyttar in hos ${String(m.namn || 'kompisen')} …`, 'good'); } },
      { label: 'Nej tack', onClick: () => { closeModal(); send({ t: 'nej', to: from, namn: A.avatar?.name }); } },
    ]);
    return;
  }
  if (m.t === 'nej') {
    if (pending?.to === from) { pending = null; toast(m.why === 'upptagen' ? `🏠 ${namn} bor redan ihop med någon.` : `🏠 ${namn} vill inte flytta ihop just nu.`); }
    return;
  }
  if (m.t === 'ja') {
    if (!pending || pending.to !== from || pending.key !== m.key || Date.now() > pending.until || S) return;
    pending = null;
    const hu = hushOf(worldMyKey(), m.key);
    g.flyttaIhop({ key: m.key, namn: m.namn, hem: g.home, roll: 'vard', hu });
    send({ t: 'inflytt', to: from, namn: String(A.avatar?.name || '').slice(0, 16), hem: g.home, hu, snap: g.samboSnap() });
    lastSent = { key: m.key, ver: g.sambo.ver, id: from };
    play('fanfare');
    toast(`🏠 ${namn} flyttar in hos dig! Ni delar hem och hyra – ${fmt(g.hyra)} var i veckan.`, 'good');
    return;
  }
  if (m.t === 'inflytt') {
    if (!accepted || accepted.key !== m.key || Date.now() > accepted.until || S) return;
    accepted = null;
    g.flyttaIhop({ key: m.key, namn: m.namn, hem: m.hem, roll: 'inflyttad', hu: m.hu, snap: m.snap });
    lastSent = { key: m.key, ver: g.sambo.ver, id: from };
    play('fanfare');
    toast(`🏠 Välkommen hem till ${homeOf(g.home).name} – du bor nu ihop med ${String(m.namn || 'kompisen')}! Hyran: ${fmt(g.hyra)} i veckan.`, 'good');
    if (A.sceneName === 'room') { A.roomSub = 0; A.go('room'); }
    return;
  }
  if (m.t === 'synk') {
    // någon som tror att vi bor ihop – men det gör vi inte (längre): säg det
    if (!S || S.key !== m.key) { send({ t: 'ut', to: from }); return; }
    const newer = (m.ver | 0) > (S.ver | 0) || ((m.ver | 0) === (S.ver | 0) && (+m.stamp || 0) > (S.stamp || 0));
    if (newer) {
      g.samboAdopt(m.snap, m.ver, m.stamp);
      lastSent = { key: S.key, ver: S.ver, id: from };
      reloadHome();
    } else if ((m.ver | 0) < (S.ver | 0) || (+m.stamp || 0) < (S.stamp || 0)) sendSynk({ id: from });   // min är nyare
    return;
  }
  if (m.t === 'ut') {
    if (!S || S.key !== m.key) return;
    const was = g.flyttaIsar();
    lastSent = { key: null, ver: -1, id: null };
    toast(was?.roll === 'inflyttad' ? `🏠 ${namn || 'Din sambo'} och du har flyttat isär – du är tillbaka i ${homeOf(g.home).name}.` : `🏠 ${String(was?.namn || 'Din sambo')} har flyttat ut. ${homeOf(g.home).name} är ditt igen.`);
    reloadHome();
  }
});

// varannan sekund: syns min sambo online och har mitt hem ändrats sedan jag skickade det?
export function samboInit(a) {
  A = a;
  setInterval(() => {
    try {
      const S = A?.game?.sambo;
      if (!S) return;
      const p = partner();
      if (!p) { if (lastSent.id) lastSent = { key: S.key, ver: -1, id: null }; return; }
      if (lastSent.key !== S.key || lastSent.id !== p.id || lastSent.ver !== S.ver) sendSynk(p);
    } catch { /* nätet är aldrig ett krav */ }
  }, 2000);
}
