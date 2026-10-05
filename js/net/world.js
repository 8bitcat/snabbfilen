// Den öppna världen. Ingen kod, inga rum att skapa: alla som startar spelet
// ansluter automatiskt till samma värld. Första spelaren tar det fasta
// PeerJS-id:t och blir världsvärd (navet som vidarebefordrar allt, som i
// Drömgården); försvinner värden slumpar de kvarvarande om vem som tar över.
//
// Varje spelare publicerar { av, scene, x, home, furniture }. scene är
// 'city' (gatan), 'home:<id>' (hemma hos den spelaren – ägare och gäster får
// samma nyckel och ser därmed varandra) eller 'away' (jobb m.m., osynlig).
//
//   klient→värd  {t:'hi', p}  {t:'up', p}  {t:'emote', e}  {t:'say', text}  {t:'ping'}
//   värd→klient  {t:'world', you, players:[[id,p]]}  {t:'join', id, p}
//                {t:'up', id, p}  {t:'emote', id, e}  {t:'say', id, text}  {t:'leave', id}  {t:'pong'}
//
// Protokollet ändras bara bakåtkompatibelt (nya fält/meddelanden ignoreras av äldre
// versioner) – byt aldrig WORLD_VERSION, då hamnar gamla flikar i en annan värld.
// Hjärtslag: klienten pingar var 5:e s och värden svarar direkt (händelsestyrt, så det
// fungerar även när värdens flik ligger i bakgrunden). Tystnad → spöket städas bort.
import { toast } from '../core/ui.js';
import { cleanAvatar } from '../core/avatar.js';
import { play } from '../core/sound.js';
import { VERSION } from '../version.js';
import { isBlockedKey, tvatta, loggaSay } from './skydd.js';

const WORLD_VERSION = 'v2';
// ?world=xyz ger en egen liten värld (används av testerna, funkar för privata också).
// Körs spelet lokalt (utvecklingsserver, testrobotar) hamnar man ALDRIG i den riktiga
// världen utan att be om det med ?world=varlden – annars kan en testrobot bli värd för
// de riktiga spelarna och sedan försvinna. Appen (Capacitor, capacitor://localhost) är
// INTE lokal: där spelar familjen i samma värld som på webben.
const LOCAL = location.protocol !== 'capacitor:' && (/^(localhost|127\.|\[?::1\]?$|10\.|192\.168\.|0\.0\.0\.0)/.test(location.hostname) || location.protocol === 'file:');
const worldName = () => new URLSearchParams(location.search).get('world') || (LOCAL ? 'lokal' : 'varlden');
const worldId = () => 'snabbfilen-' + WORLD_VERSION + '-' + worldName().toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 24);

const EMOTE_MS = 2600;
const SAY_MS = 7000;
const SAY_MAX = 80;
const cleanSay = (t) => String(t ?? '').replace(/[\u0000-\u001f]/g, '').trim().slice(0, SAY_MAX);
const MAX_PLAYERS = 24;
// ?nettest=1 kortar alla tider så att testerna hinner se spöken städas och värdbyten
const FAST = typeof location !== 'undefined' && /[?&]nettest=1/.test(location.search);
const PING_MS = FAST ? 700 : 5000;             // klienten pingar värden
const HOST_SILENT_MS = FAST ? 3500 : 20000;    // klienten: inget från värden så länge → anslut om
const CLIENT_SILENT_MS = FAST ? 5000 : 90000;  // värden: tyst klient (som kan pinga) → spöke, ta bort
const SWEEP_MS = FAST ? 1000 : 10000;
const RESIGN_MS = FAST ? 2500 : 20000;         // dold värd med spelare lämnar över
// Inaktiv (ingen mus/tangent/touch) i 5 minuter → ut ur världen tills man rör sig igen.
// Värden rensar dessutom bort den som inte gjort något på 6 minuter (även äldre versioner).
const IDLE_MS = FAST ? 6000 : 5 * 60 * 1000;
const HOST_IDLE_MS = FAST ? 9000 : 6 * 60 * 1000;

// En fast nyckel per webbläsare: kommer samma spelare in igen (ny flik, omladdning,
// tappad uppkoppling) ersätter den nya anslutningen den gamla i stället för att bli två.
const NET_KEY = (() => {
  try {
    let k = localStorage.getItem('snabbfilen_netkey');
    if (!k) { k = Math.random().toString(36).slice(2, 12) + Date.now().toString(36); localStorage.setItem('snabbfilen_netkey', k); }
    return k;
  } catch { return Math.random().toString(36).slice(2, 12); }
})();
// Spelarnyckeln = webbläsarens nyckel + figurens id: samma figur igen (ny flik, omladdning,
// tappad uppkoppling) ersätter den gamla anslutningen, men två figurer i samma webbläsare
// (syskon i var sin flik) är två spelare – förr hade de samma nyckel och knuffade ut varandra.
const myKey = () => { const id = typeof window !== 'undefined' ? window.SF?.avatar?.id : null; return id ? (NET_KEY + ':' + String(id)).slice(0, 64) : NET_KEY; };

// Hur spelarna hittar varandra genom routrar och brandväggar (WebRTC/ICE). STUN räcker när två
// enheter kan prata direkt; annars behövs en relästation (TURN) – utan den kommer den som sitter
// på ett strikt nät (många mobilnät, skol- och gästnät) aldrig in i världen. PeerJS egna TURN
// (eu-0/us-0.turn.peerjs.com) finns inte längre (ingen DNS-post 2026-09-29) och Open Relays fria
// inloggning svarar inte, så i dag finns bara STUN. En fungerande relästation läggs in i TURN
// nedan (tjänstens adresser + användarnamn/lösenord) – då gäller den för alla spelare direkt.
const TURN = [];
const ICE = { iceServers: [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'] }, ...TURN] };
const peerOpts = () => ({ debug: 0, config: ICE });

let W = null;
let retryTimer = null;
// Diagnos till 👥-dialogen: hur många försök i rad som klient som inte kom fram till värden
let failedJoins = 0;
let idle = false;            // utloggad för att man varit inaktiv
let lastActive = Date.now();

export const worldInfo = () => ({ idle, dbg: FAST && W ? { hb: !!W.hb, heard: Date.now() - (W.lastHeard || 0), connOpen: !!W.conn?.open, timers: W.timers?.length, dead: !!W.dead, peerOpen: !!W.peer?.open, peerDestroyed: !!W.peer?.destroyed, players: [...W.players.keys()].map((k) => k.slice(0, 6)) } : undefined, role: W?.role || 'off', myId: W?.myId || null, online: W ? W.players.size + 1 : 1, open: !!W?.open, world: worldName(), local: LOCAL, version: VERSION, tries: failedJoins, relay: TURN.length > 0 });

// ---------- start & värdbyte ----------
export function startWorld(A) {
  if (idle) return;
  if (!window.Peer) { scheduleRetry(A, 8000); return; }
  // en dold flik ska inte bli värd om någon annan kan: försök först som klient
  if (typeof document !== 'undefined' && document.hidden) joinAsClient(A, { hostIfEmpty: true });
  else tryHost(A);
}
function scheduleRetry(A, ms) {
  clearTimeout(retryTimer);
  retryTimer = setTimeout(() => { if (!W) startWorld(A); }, ms + Math.random() * 2000);
}
function baseState(A) {
  return { role: null, peer: null, myId: null, conns: new Map(), conn: null, players: new Map(), open: false, myEmote: null, lastSent: 0, lastX: -1, lastMeta: '', timers: [] };
}
function stopTimers(w) { for (const t of w?.timers || []) clearInterval(t); if (w) w.timers = []; }
function killPeer(w) { w.dead = true; stopTimers(w); try { w.peer?.destroy(); } catch { /* ok */ } }
function tryHost(A) {
  let peer;
  try { peer = new window.Peer(worldId(), peerOpts()); } catch { scheduleRetry(A, 8000); return; }
  const w = baseState(A);
  w.role = 'host'; w.peer = peer; w.myId = worldId();
  peer.on('open', () => {
    W = w; W.open = true; failedJoins = 0;
    w.timers.push(setInterval(() => hostSweep(A, w), SWEEP_MS));
  });
  peer.on('error', (e) => {
    if (e.type === 'unavailable-id') { killPeer(w); if (W === w) W = null; joinAsClient(A); } // någon är redan värd
    else if (!W || W.peer === peer) { stopTimers(w); W = null; scheduleRetry(A, 6000); }
  });
  peer.on('call', callIn); // röstchatten (js/net/voice.js)
  peer.on('connection', (conn) => {
    conn.on('data', (d) => hostData(A, conn, d));
    conn.on('close', () => hostDrop(A, conn));
  });
  // tappad kontakt med signalservern → återanslut, men ALDRIG om vi själva stänger värden:
  // destroy() skickar 'disconnected' först, och en reconnect då registrerar om värd-id:t
  // på en död anslutning så att ingen annan kan bli värd.
  peer.on('disconnected', () => { if (w.dead) return; try { peer.reconnect(); } catch { /* ok */ } });
}
function joinAsClient(A, { hostIfEmpty = false } = {}) {
  let peer;
  try { peer = new window.Peer(undefined, peerOpts()); } catch { scheduleRetry(A, 8000); return; }
  const w = baseState(A);
  w.role = 'client'; w.peer = peer;
  peer.on('call', callIn); // röstchatten (js/net/voice.js)
  peer.on('error', (e) => {
    if (e.type !== 'peer-unavailable') return;
    teardown();
    if (hostIfEmpty && !idle) tryHost(A); // ingen värd finns – då får den dolda fliken ta det
    else scheduleRetry(A, 500);
  });
  peer.on('open', (id) => {
    w.myId = id;
    const conn = peer.connect(worldId(), { reliable: true });
    w.conn = conn;
    conn.on('open', () => {
      conn.send({ t: 'hi', p: myState(A) });
      w.lastHeard = Date.now();
      w.timers.push(setInterval(() => clientPulse(A, w), PING_MS));
    });
    conn.on('data', (d) => { w.lastHeard = Date.now(); clientData(A, d, w); });
    conn.on('close', () => { const wasOpen = W?.open; teardown(); if (wasOpen && !w.replaced) scheduleRetry(A, 300); }); // värden försvann: kanske min tur
  });
  // kom vi inte fram till värden på 10 s (oftast ett nät som stoppar direktkontakt – se ICE ovan)
  const bootTimer = setTimeout(() => { if (!w.open) { failedJoins++; teardown(); scheduleRetry(A, 6000); } }, 10000);
  const oldOpen = () => clearTimeout(bootTimer);
  w._welcomed = oldOpen;
  W = w;
  function teardown() { killPeer(w); if (W === w) W = null; }
  w.teardown = teardown;
}

const rtcDead = (conn) => { const st = conn?.peerConnection?.connectionState; return st === 'failed' || st === 'disconnected' || st === 'closed'; };
// Klientens puls: pinga värden, och har en värd som kan svara (pong) varit tyst för
// länge är anslutningen död fast ingen 'close' kom (mobil som somnat, bytt nät …).
function clientPulse(A, w) {
  if (W !== w) return;
  const dead = () => { w.teardown?.(); scheduleRetry(A, 300); };
  // kanalen stängd utan att 'close' kom (händer när fliken på andra sidan bara försvinner),
  // eller WebRTC-förbindelsen själv rapporterar att motparten är borta (oavsett version)
  if (w.open && (!w.conn?.open || w.peer?.destroyed || w.peer?.disconnected || rtcDead(w.conn))) { dead(); return; }
  if (!w.conn?.open) return;
  // a = spelaren har rört mus/tangent sedan förra pingen (står man still i en meny räknas det ändå)
  try { w.conn.send({ t: 'ping', a: lastActive > (w.lastPing || 0) ? 1 : 0 }); } catch { dead(); return; }
  w.lastPing = Date.now();
  if (w.hb && Date.now() - (w.lastHeard || 0) > HOST_SILENT_MS) dead();
}
// Flikbyten:
// - klient som blir synlig igen: kolla värden direkt i stället för att vänta på nästa puls.
// - värd vars flik göms (mobilen i fickan fryser sidan): lämna över efter en stund så att
//   de andra inte tappar varandra. En synlig klient tar värdskapet, den dolda fliken
//   kommer tillbaka som vanlig klient.
let resignTimer = null;
if (typeof document !== 'undefined') document.addEventListener('visibilitychange', () => {
  clearTimeout(resignTimer);
  if (!W) return;
  if (!document.hidden && W.role === 'client') {
    if (W.hb && Date.now() - (W.lastHeard || 0) > HOST_SILENT_MS) { W.teardown?.(); scheduleRetry(window.SF, 300); }
    return;
  }
  if (document.hidden && W.role === 'host' && W.players.size) {
    const w = W;
    resignTimer = setTimeout(() => {
      if (W !== w || !document.hidden || !w.players.size) return;
      killPeer(w);
      W = null;
      clearTimeout(retryTimer);
      retryTimer = setTimeout(() => { if (!W) joinAsClient(window.SF); }, 4000);
    }, RESIGN_MS);
  }
});

// ---------- inaktivitet ----------
// Rör man inte mus, tangentbord eller skärm på IDLE_MS lämnar man världen (värden lämnar
// över till någon annan). Första rörelsen efteråt tar en tillbaka.
function markActive() {
  lastActive = Date.now();
  if (!idle) return;
  idle = false;
  toast('🌆 Tillbaka i Pixelstaden!', 'good');
  if (window.SF && !W) startWorld(window.SF);
}
function goIdle() {
  if (idle || !W) return;
  idle = true;
  clearTimeout(retryTimer);
  const w = W;
  W = null;
  killPeer(w);
  toast('💤 Du har varit borta en stund – utloggad ur världen. Rör dig så är du tillbaka!', 'wrap');
}
if (typeof window !== 'undefined') {
  for (const ev of ['pointerdown', 'keydown', 'touchstart', 'wheel']) window.addEventListener(ev, markActive, { capture: true, passive: true });
  setInterval(() => { if (!idle && W && Date.now() - lastActive > IDLE_MS) goIdle(); }, FAST ? 1000 : 5000);
}
export const worldMarkActive = markActive;

// ---------- min publicerade state ----------
function myState(A) {
  return { av: { name: A.avatar.name, look: A.avatar.look, color: A.avatar.color }, scene: myScene(A), x: A.scene?.worldX ?? 190, y: A.scene?.worldY ?? 174, home: A.game.home, deco: A.game.deco, key: myKey(), ver: VERSION, vo: voiceFlag() ? 1 : 0, si: mySit(A), fd: myRide(A), fe: A.fest ? 1 : 0, hu: myHu(A) };
}
// Bor jag ihop med någon (js/net/sambo.js)? Hushållets id – då är vi hemma i SAMMA rum (myScene)
// och den som hälsar på hamnar hos oss båda.
function myHu(A) { const S = A.game?.sambo; return S && S.hu && S.hem === A.game.home ? S.hu : ''; }
// Åker jag på något (cykel, elsparkcykel, moppe – city.js worldRide = { id, c })? Skickas som
// 'id:#färg' så att andra ritar mig på samma fordon (js/core/fordon-art.js).
function myRide(A) {
  let r = null;
  try { r = A.scene?.worldRide ?? null; } catch { r = null; }
  return r && /^[a-z]{2,16}$/.test(String(r.id)) && /^#[0-9a-f]{6}$/i.test(String(r.c)) ? `${r.id}:${String(r.c).toLowerCase()}` : '';
}
// Sitter jag? Scenen svarar med getter worldSit: null, 'down'/'up'/'left'/'right' eller
// { dir, eat } (eat = maten står framför mig och jag tuggar). Skickas som 'd', 'u', 'l', 'r'
// + 'e' när jag äter – andra ritar mig då sittande på samma plats (worldX/worldY = platsen).
const SIT_CODE = { down: 'd', up: 'u', left: 'l', right: 'r' };
const SIT_DIR = { d: 'down', u: 'up', l: 'left', r: 'right' };
function mySit(A) {
  let s = null;
  try { s = A.scene?.worldSit ?? null; } catch { s = null; }
  const c = SIT_CODE[typeof s === 'string' ? s : s?.dir];
  return c ? c + (s?.eat ? 'e' : '') : '';
}
function myScene(A, sub = A.roomSub) {
  if (A.sceneName === 'city') return 'city';
  if (A.sceneName === 'room') return 'home:' + (myHu(A) || W?.myId || 'me') + ':' + (sub | 0);
  if (A.sceneName === 'visit') return 'home:' + (A.visitTarget?.hu || A.visitTarget?.id || 'me') + ':' + (sub | 0);
  // butiker och jobb: osynlig för andra, men de ser VAR man är (äldre versioner läser det som 'away')
  const where = String(A.sceneName || '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 24);
  // jobbar man ihop (💼-inbjudan, js/jobs/shift.js) bär platsen passets id: bara de i SAMMA
  // pass ser varandra – andra som råkar jobba på samma ställe har sina egna pass
  if (where && A.coop?.sid && A.coop.scene === A.sceneName) return 'away:' + where + '.' + A.coop.sid;
  return where ? 'away:' + where : 'away';
}
const isAway = (s) => String(s).startsWith('away');
const cleanScene = (s) => (s === 'city' || /^away(:[a-z0-9]{1,24}(\.[a-z0-9]{1,12})?)?$/.test(String(s)) || /^home:[\w-]{1,64}:\d$/.test(String(s)) ? String(s) : 'away');
function cleanP(p, old = {}) {
  const out = { ...old };
  if (p && typeof p === 'object') {
    if (p.av) { out.av = cleanAvatar(p.av); out.av.name = tvatta(out.av.name); }   // fula ord i namnet → *** (skydd.js)
    if (p.scene !== undefined) out.scene = cleanScene(p.scene);
    if (p.x !== undefined) { out.tx = Math.max(0, Math.min(4000, +p.x || 190)); if (out.x === undefined) out.x = out.tx; }
    if (p.y !== undefined) { out.ty2 = Math.max(0, Math.min(2000, +p.y || 174)); if (out.y === undefined) out.y = out.ty2; }
    if (p.home !== undefined) out.home = String(p.home).slice(0, 16);
    if (typeof p.key === 'string') out.key = p.key.slice(0, 64);
    if (typeof p.ver === 'string') out.ver = p.ver.slice(0, 16);
    if (p.vo !== undefined) out.vo = p.vo ? 1 : 0;
    if (p.si !== undefined) out.si = /^[dulr]e?$/.test(String(p.si)) ? String(p.si) : '';
    if (p.hu !== undefined) out.hu = /^sb-[a-z0-9]{1,12}$/.test(String(p.hu)) ? String(p.hu) : '';   // 🏠 hushållet (bor ihop)
    if (p.fe !== undefined) out.fe = p.fe ? 1 : 0;   // 🎉 fest hemma (besökare ser pyntet)
    if (p.fd !== undefined) out.fd = /^[a-z]{2,16}:#[0-9a-f]{6}$/i.test(String(p.fd)) ? String(p.fd).toLowerCase() : '';
    if (p.deco !== undefined && p.deco && typeof p.deco === 'object') {
      out.deco = {};
      // upp till 24 delrum med 80 möbler var (de nya bostäderna har fler rum och mer bohag)
      for (const [key, list] of Object.entries(p.deco).slice(0, 24)) {
        if (!/^[a-z][a-z0-9]*:\d{1,2}$/.test(key) || !Array.isArray(list)) continue;
        // c = möbelns egna färg – bara giltig #rrggbb följer med (besökare ser färgen),
        // r = rotationen (0–3, 0 skickas inte), sortnamn upp till 24 tecken
        out.deco[key] = list.slice(0, 80).map((d) => ({ k: String(d?.k || '').slice(0, 24), v: Math.max(0, d?.v | 0), x: +d?.x || 0, y: +d?.y || 0, ...(d?.fx ? { fx: 1 } : {}),
          ...((d?.r | 0) & 3 ? { r: (d.r | 0) & 3 } : {}),
          ...(+d?.up > 0 && +d.up < 64 ? { up: Math.round(+d.up) } : {}), // småsaken står på ett bord (room.js)
          ...(typeof d?.c === 'string' && /^#[0-9a-f]{6}$/i.test(d.c) ? { c: d.c.toLowerCase() } : {}) }));
      }
    }
  }
  out.av = out.av || cleanAvatar({});
  out.scene = out.scene || 'away';
  if (out.x === undefined) { out.x = 190; out.tx = 190; }
  if (out.y === undefined) { out.y = 174; out.ty2 = 174; }
  return out;
}

// ---------- värdsidan ----------
function hostBroadcast(msg, except = null) {
  for (const [id, conn] of W.conns) if (id !== except && conn.open) conn.send(msg);
}
function hostData(A, conn, d) {
  if (!W || W.role !== 'host' || !d || typeof d !== 'object') return;
  const id = conn.peer;
  const known = W.players.get(id);
  if (known) known.seen = Date.now();
  if (d.t === 'ping') {
    if (known) { known.hb = true; if (d.a) known.active = Date.now(); }
    try { conn.send({ t: 'pong' }); } catch { /* stängd */ }
    return;
  }
  if (known && (d.t === 'up' || d.t === 'emote' || d.t === 'say')) known.active = Date.now();
  if (d.t === 'hi') {
    const p = cleanP(d.p);
    // samma spelare igen (ny flik/omladdning/tappad uppkoppling) → ta bort den gamla
    if (p.key) for (const [oid, op] of [...W.players]) if (oid !== id && op.key === p.key) { try { W.conns.get(oid)?.send({ t: 'replaced' }); } catch { /* stängd */ } dropPlayer(oid, true, 600); }
    if (W.players.size >= MAX_PLAYERS) { conn.close(); return; }
    p.seen = p.active = Date.now();
    W.conns.set(id, conn);
    W.players.set(id, p);
    conn.send({ t: 'world', you: id, players: [[W.myId, myState(A)], ...[...W.players].filter(([pid]) => pid !== id)] });
    hostBroadcast({ t: 'join', id, p }, id);
    if (!isBlockedKey(p.key)) { play('knock'); toast(`👋 ${p.av.name || 'Någon'} är i Pixelstaden!`, 'good'); }
  } else if (d.t === 'up') {
    const old = W.players.get(id);
    if (!old) return;
    W.players.set(id, cleanP(d.p, old));
    hostBroadcast({ t: 'up', id, p: d.p }, id);
  } else if (d.t === 'emote') {
    const p = W.players.get(id);
    if (!p) return;
    p.emote = { e: String(d.e).slice(0, 4), until: Date.now() + EMOTE_MS };
    hostBroadcast({ t: 'emote', id, e: p.emote.e }, id);
  } else if (d.t === 'say') {
    const p = W.players.get(id), text = cleanSay(d.text);
    if (!p || !text) return;
    loggaSay(p.key, text);
    p.say = { text: tvatta(text), until: Date.now() + SAY_MS };
    hostBroadcast({ t: 'say', id, text }, id);
  } else if (d.t === 'job') {
    if (!known || !d.m || typeof d.m !== 'object') return;
    hostBroadcast({ t: 'job', id, m: d.m }, id);
    jobIn({ from: id, m: d.m });
  }
}
function hostDrop(A, conn) {
  if (!W || W.role !== 'host') return;
  if (W.conns.get(conn.peer) !== conn) return; // redan ersatt av en nyare anslutning
  const p = W.players.get(conn.peer);
  if (p && dropPlayer(conn.peer, false) && !isBlockedKey(p.key)) toast(`👋 ${p.av.name || 'Någon'} loggade ut.`);
}
// closeMs: stäng anslutningen lite senare (så att ett sista meddelande hinner fram, t.ex. 'replaced')
function dropPlayer(id, quiet, closeMs = 0) {
  const p = W.players.get(id), conn = W.conns.get(id);
  if (!p) return false;
  W.conns.delete(id);
  W.players.delete(id);
  const close = () => { try { conn?.close(); } catch { /* ok */ } };
  if (closeMs) setTimeout(close, closeMs); else close();
  hostBroadcast({ t: 'leave', id, ...(quiet ? { quiet: 1 } : {}) });
  return true;
}
// Klienter som kan pinga men tystnat är spöken (mobilen somnade, nätet bröts utan 'close').
function hostSweep(A, w) {
  if (W !== w || W.role !== 'host') return;
  const now = Date.now();
  for (const [id, p] of [...W.players]) {
    if (rtcDead(W.conns.get(id))) dropPlayer(id, true);
    else if (p.hb && now - (p.seen || 0) > CLIENT_SILENT_MS) dropPlayer(id, true);
    else if (now - (p.active || p.seen || 0) > HOST_IDLE_MS) { if (dropPlayer(id, false)) toast(`💤 ${p.av.name || 'Någon'} var borta en stund och loggades ut.`); }
    else if (!W.conns.get(id)?.open && now - (p.seen || 0) > 15000) dropPlayer(id, true);
  }
}

// ---------- klientsidan ----------
function clientData(A, d, w) {
  if (W !== w || !d || typeof d !== 'object') return;
  if (d.t === 'pong') { w.hb = true; return; }
  if (d.t === 'world') {
    w.open = true; failedJoins = 0;
    w._welcomed?.();
    for (const [id, p] of d.players || []) if (id !== w.myId) w.players.set(id, cleanP(p));
    toast(`🌆 Du är med i Pixelstaden – ${w.players.size + 1} online!`, 'good');
  } else if (d.t === 'join') {
    w.players.set(d.id, cleanP(d.p));
    if (!isBlockedKey(w.players.get(d.id).key)) { play('knock'); toast(`👋 ${w.players.get(d.id).av.name || 'Någon'} är i Pixelstaden!`, 'good'); }
  } else if (d.t === 'up') {
    const old = w.players.get(d.id);
    if (old) w.players.set(d.id, cleanP(d.p, old));
  } else if (d.t === 'emote') {
    const p = w.players.get(d.id);
    if (p) p.emote = { e: String(d.e).slice(0, 4), until: Date.now() + EMOTE_MS };
  } else if (d.t === 'say') {
    const p = w.players.get(d.id), text = cleanSay(d.text);
    if (p && text) { loggaSay(p.key, text); p.say = { text: tvatta(text), until: Date.now() + SAY_MS }; }
  } else if (d.t === 'replaced') {
    // samma figur spelar i en annan flik – den här pausar tills man rör den igen (markActive)
    w.replaced = true;
    idle = true;
    clearTimeout(retryTimer);
    toast('🗂️ Du spelar med samma figur i en annan flik – den här fliken är pausad. Rör den så tar den över igen.', 'wrap');
  } else if (d.t === 'leave') {
    const p = w.players.get(d.id);
    w.players.delete(d.id);
    if (p && !d.quiet && !isBlockedKey(p.key)) toast(`👋 ${p.av.name || 'Någon'} loggade ut.`);
  } else if (d.t === 'job') {
    if (d.m && typeof d.m === 'object') jobIn({ from: d.id, m: d.m });
  }
}

// ---------- varje bildruta ----------
// Skickar min position/state throttlat (hela paketet bara när något mer än x
// ändrats) och glider alla andras figurer mot sina mål.
export function worldTick(A, myX, dt) {
  if (!W || !W.open) return;
  const now = performance.now();
  const myY = A.scene?.worldY ?? null;
  const meta = JSON.stringify([A.avatar.look, A.avatar.name, myScene(A), A.game.home, A.game.deco, voiceFlag() ? 1 : 0, mySit(A), myRide(A), A.fest ? 1 : 0, myHu(A)]);
  const metaChanged = meta !== W.lastMeta;
  const posChanged = myX !== null && (Math.abs(myX - W.lastX) > 0.5 || Math.abs((myY ?? 0) - (W.lastY ?? 0)) > 0.5);
  if ((metaChanged || posChanged) && now - W.lastSent > 90) {
    W.lastSent = now;
    if (myX !== null) { W.lastX = myX; W.lastY = myY; }
    const p = metaChanged ? myState(A) : { x: myX, y: myY ?? undefined };
    W.lastMeta = meta;
    if (W.role === 'client' && W.conn?.open) W.conn.send({ t: 'up', p });
    if (W.role === 'host') hostBroadcast({ t: 'up', id: W.myId, p });
  }
  for (const p of W.players.values()) {
    const dx = (p.tx ?? p.x) - p.x, dy = (p.ty2 ?? p.y) - p.y;
    const dist = Math.hypot(dx, dy), step = Math.max(62, dist * 3) * dt;
    if (dist <= step) { p.x = p.tx ?? p.x; p.y = p.ty2 ?? p.y; }
    else { p.x += dx / dist * step; p.y += dy / dist * step; }
  }
}

// Alla som är på samma plats som jag: [{id, av, x, y, tx, ty, walking, emote}] – x/y glider mot
// målet tx/ty (senaste positionen från nätet); en scen med våningar (klädaffären) ritar på målet
// när hoppet är stort, så att ingen glider genom golvet mellan våningarna
// sub: ett annat rum i samma bostad (den löpande lägenheten visar grannrummen också)
export function worldFolksHere(A, sub) {
  if (!W || !W.open) return [];
  const here = myScene(A, sub ?? A.roomSub);
  // I butikerna ser man alla som är där. I ett JOBB bara dem man jobbar ihop med (samma pass-id
  // i nyckeln, se myScene) – jobbar man ensam är man ensam, även om en kompis har ett eget pass
  // på samma ställe (Carl 2026-09-30: "man ska bara dyka upp ihop om man väljer att börja jobba ihop")
  if (/^away:jobb[a-z0-9]*$/.test(here)) return [];
  const out = [];
  for (const [id, p] of W.players) {
    if (p.scene !== here || isBlockedKey(p.key)) continue;   // blockerade finns inte för en (skydd.js)
    out.push({ id, av: p.av, x: p.x, y: p.y, tx: p.tx ?? p.x, ty: p.ty2 ?? p.y, vo: p.vo | 0, walking: Math.hypot((p.tx ?? p.x) - p.x, (p.ty2 ?? p.y) - p.y) > 1, sit: p.si ? SIT_DIR[p.si[0]] : null, eat: p.si?.[1] === 'e', ride: p.fd ? { id: p.fd.split(':')[0], c: p.fd.split(':')[1] } : null, emote: (p.emote && p.emote.until > Date.now() ? p.emote.e : null) || (talkSrc(id) ? TALK_EMOTE : null), say: p.say && p.say.until > Date.now() ? p.say.text : null });
  }
  return out;
}
// Stolar där en annan spelare sitter blir upptagna ({ state: 'remote' }) så att varken jag
// eller ställets folk sätter sig i knät på dem; platsen släpps när de reser sig eller går.
// seats = scenens platser med x, y och occ (kaféet, Burgarbaren). Anropas varje bildruta.
export function worldSeatsTaken(A, seats, tol = 4) {
  const sitting = worldFolksHere(A).filter((f) => f.sit && !f.walking);
  for (const s of seats) {
    const who = sitting.find((f) => Math.abs(f.x - s.x) <= tol && Math.abs(f.y - s.y) <= tol);
    if (who && !s.occ) s.occ = { state: 'remote', id: who.id };
    else if (!who && s.occ?.state === 'remote') s.occ = null;
  }
}
export const worldMyEmote = () => (W?.myEmote && W.myEmote.until > Date.now() ? W.myEmote.e : null) || (talkSrc('self') ? TALK_EMOTE : null);
let mySay = null;
export const worldMySay = () => (mySay && mySay.until > Date.now() ? mySay.text : null);
// Säg något: bubblan visas alltid ovanför en själv, och skickas till alla i världen
export function sendSay(A, text) {
  const t = cleanSay(tvatta(text));
  if (!t) return;
  mySay = { text: t, until: Date.now() + SAY_MS };
  markActive();
  if (!W || !W.open) return;
  if (W.role === 'client' && W.conn?.open) W.conn.send({ t: 'say', text: t });
  if (W.role === 'host') hostBroadcast({ t: 'say', id: W.myId, text: t });
}

export function sendEmote(A, e) {
  if (!W || !W.open) return;
  W.myEmote = { e, until: Date.now() + EMOTE_MS };
  if (W.role === 'client' && W.conn?.open) W.conn.send({ t: 'emote', e });
  if (W.role === 'host') hostBroadcast({ t: 'emote', id: W.myId, e });
  play('click');
}

// ---------- jobbkanalen: delade arbetspass (jobba tillsammans) ----------
// Små spelmeddelanden mellan spelare på SAMMA ställe: värden reläar rakt av till
// alla andra, och js/net/coop.js filtrerar på plats-nyckeln. Datakanalen är
// reliable, så ordningen är garanterad.
const jobCbs = new Set(); // coop.js (jobba ihop) och voice.js (röstchatten)
export const onJob = (cb) => { jobCbs.add(cb); };
const jobIn = (ev) => { if (isBlockedKey(W?.players.get(ev.from)?.key)) return; for (const cb of jobCbs) { try { cb(ev); } catch (e) { console.error('jobbkanalen:', e); } } };
export const worldMyId = () => (W?.open ? W.myId : null);
export function sendJob(m) {
  if (!W || !W.open || !m || typeof m !== 'object') return false;
  if (W.role === 'host') { hostBroadcast({ t: 'job', id: W.myId, m }); return true; }
  if (W.conn?.open) { try { W.conn.send({ t: 'job', m }); return true; } catch { return false; } }
  return false;
}

// ---------- röstchatten (krokar – själva ljudet ligger i js/net/voice.js) ----------
// Inkommande mediasamtal går till voice.js, som bara svarar på samtal man själv sagt ja
// till (närhet med röst PÅ, eller en grupp man gått med i) – allt annat stängs direkt.
let callCb = null;
export const onCall = (cb) => { callCb = cb; };
function callIn(mc) {
  if (!callCb) { try { mc.close(); } catch { /* ok */ } return; }
  try { callCb(mc); } catch (e) { console.error('röstchatten:', e); try { mc.close(); } catch { /* ok */ } }
}
export const worldPeer = () => (W?.open && W.peer && !W.peer.destroyed ? W.peer : null);
let voiceFlag = () => false;   // har jag rösten på? (publiceras som vo)
let talkSrc = () => false;     // pratar id (eller 'self') just nu? → 🗣️ över figuren
const TALK_EMOTE = '🗣️';
export const setVoiceHooks = ({ on, talking } = {}) => { if (on) voiceFlag = on; if (talking) talkSrc = talking; };
export const worldPlayer = (id) => (W?.players.get(id) || null);
export const worldMyKey = () => myKey(); // fast per webbläsare och figur – röstgrupperna följer nyckeln, inte spelar-id:t

// ---------- besök ----------
export function playersList() {
  if (!W || !W.open) return [];
  return [...W.players].filter(([, p]) => !isBlockedKey(p.key)).map(([id, p]) => ({ id, av: p.av, scene: p.scene, home: p.home, x: p.x, y: p.y, ver: p.ver || null, key: p.key || null, hu: p.hu || '' }));
}
// Namnet på den som har ett visst spelar-id (för "hemma hos …")
export function playerName(id) {
  if (!W) return null;
  if (id === W.myId) return null;
  return W.players.get(id)?.av?.name || null;
}
export function visitPlayer(A, id) {
  const p = W?.players.get(id);
  if (!p) { toast('Hen loggade visst ut.', 'bad'); return false; }
  A.game.passTime(20); // resan dit
  A.game.save();
  if (A.game.collapsed) return false;
  A.visitTarget = { id, name: p.av.name, home: p.home || 'rum', deco: p.deco || {}, hu: p.hu || '' };
  play('door');
  const h = A.game.glad ? A.game.glad(4, '', 'besok', 8) : 0;                              // att hälsa på gör en glad (högst +8 om dagen)
  toast(`🏠 Du är hemma hos ${p.av.name || 'en kompis'}!${h ? ` +${h} 😊` : ''}`, 'good');
  A.go('visit');
  return true;
}
