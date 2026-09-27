// Den öppna världen. Ingen kod, inga rum att skapa: alla som startar spelet
// ansluter automatiskt till samma värld. Första spelaren tar det fasta
// PeerJS-id:t och blir världsvärd (navet som vidarebefordrar allt, som i
// Drömgården); försvinner värden slumpar de kvarvarande om vem som tar över.
//
// Varje spelare publicerar { av, scene, x, home, furniture }. scene är
// 'city' (gatan), 'home:<id>' (hemma hos den spelaren – ägare och gäster får
// samma nyckel och ser därmed varandra) eller 'away' (jobb m.m., osynlig).
//
//   klient→värd  {t:'hi', p}  {t:'up', p}  {t:'emote', e}
//   värd→klient  {t:'world', you, players:[[id,p]]}  {t:'join', id, p}
//                {t:'up', id, p}  {t:'emote', id, e}  {t:'leave', id}
import { toast } from '../core/ui.js';
import { cleanAvatar } from '../core/avatar.js';
import { play } from '../core/sound.js';

const WORLD_VERSION = 'v2';
// ?world=xyz ger en egen liten värld (används av testerna, funkar för privata också)
const worldId = () => 'snabbfilen-' + WORLD_VERSION + '-' +
  (new URLSearchParams(location.search).get('world') || 'varlden').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 24);

const EMOTE_MS = 2600;
const MAX_PLAYERS = 24;
let W = null;
let retryTimer = null;

export const worldInfo = () => ({ role: W?.role || 'off', myId: W?.myId || null, online: W ? W.players.size + 1 : 1, open: !!W?.open });

// ---------- start & värdbyte ----------
export function startWorld(A) {
  if (!window.Peer) { scheduleRetry(A, 8000); return; }
  tryHost(A);
}
function scheduleRetry(A, ms) {
  clearTimeout(retryTimer);
  retryTimer = setTimeout(() => { if (!W) startWorld(A); }, ms + Math.random() * 2000);
}
function baseState(A) {
  return { role: null, peer: null, myId: null, conns: new Map(), conn: null, players: new Map(), open: false, myEmote: null, lastSent: 0, lastX: -1, lastMeta: '' };
}
function tryHost(A) {
  let peer;
  try { peer = new window.Peer(worldId(), { debug: 0 }); } catch { scheduleRetry(A, 8000); return; }
  const w = baseState(A);
  w.role = 'host'; w.peer = peer; w.myId = worldId();
  peer.on('open', () => { W = w; W.open = true; });
  peer.on('error', (e) => {
    if (e.type === 'unavailable-id') { try { peer.destroy(); } catch { /* ok */ } joinAsClient(A); } // någon är redan värd
    else if (!W || W.peer === peer) { W = null; scheduleRetry(A, 6000); }
  });
  peer.on('connection', (conn) => {
    conn.on('data', (d) => hostData(A, conn, d));
    conn.on('close', () => hostDrop(A, conn));
  });
  peer.on('disconnected', () => { try { peer.reconnect(); } catch { /* ok */ } });
}
function joinAsClient(A) {
  let peer;
  try { peer = new window.Peer(undefined, { debug: 0 }); } catch { scheduleRetry(A, 8000); return; }
  const w = baseState(A);
  w.role = 'client'; w.peer = peer;
  peer.on('error', (e) => { if (e.type === 'peer-unavailable') { teardown(); scheduleRetry(A, 500); } });
  peer.on('open', (id) => {
    w.myId = id;
    const conn = peer.connect(worldId(), { reliable: true });
    w.conn = conn;
    conn.on('open', () => conn.send({ t: 'hi', p: myState(A) }));
    conn.on('data', (d) => clientData(A, d, w));
    conn.on('close', () => { const wasOpen = W?.open; teardown(); if (wasOpen) scheduleRetry(A, 300); }); // värden försvann: kanske min tur
  });
  const bootTimer = setTimeout(() => { if (!w.open) { teardown(); scheduleRetry(A, 6000); } }, 10000);
  const oldOpen = () => clearTimeout(bootTimer);
  w._welcomed = oldOpen;
  W = w;
  function teardown() { try { peer.destroy(); } catch { /* ok */ } if (W === w) W = null; }
}

// ---------- min publicerade state ----------
function myState(A) {
  return { av: { name: A.avatar.name, look: A.avatar.look, color: A.avatar.color }, scene: myScene(A), x: A.scene?.worldX ?? 190, y: A.scene?.worldY ?? 174, home: A.game.home, deco: A.game.deco };
}
function myScene(A) {
  if (A.sceneName === 'city') return 'city';
  if (A.sceneName === 'room') return 'home:' + (W?.myId || 'me') + ':' + (A.roomSub | 0);
  if (A.sceneName === 'visit') return 'home:' + (A.visitTarget?.id || 'me') + ':' + (A.roomSub | 0);
  return 'away';
}
const cleanScene = (s) => (s === 'city' || s === 'away' || /^home:[\w-]{1,64}:\d$/.test(String(s)) ? String(s) : 'away');
function cleanP(p, old = {}) {
  const out = { ...old };
  if (p && typeof p === 'object') {
    if (p.av) out.av = cleanAvatar(p.av);
    if (p.scene !== undefined) out.scene = cleanScene(p.scene);
    if (p.x !== undefined) { out.tx = Math.max(0, Math.min(4000, +p.x || 190)); if (out.x === undefined) out.x = out.tx; }
    if (p.y !== undefined) { out.ty2 = Math.max(0, Math.min(2000, +p.y || 174)); if (out.y === undefined) out.y = out.ty2; }
    if (p.home !== undefined) out.home = String(p.home).slice(0, 16);
    if (p.deco !== undefined && p.deco && typeof p.deco === 'object') {
      out.deco = {};
      for (const [key, list] of Object.entries(p.deco).slice(0, 12)) {
        if (!/^[a-z]+:\d$/.test(key) || !Array.isArray(list)) continue;
        out.deco[key] = list.slice(0, 40).map((d) => ({ k: String(d?.k || '').slice(0, 12), v: Math.max(0, d?.v | 0), x: +d?.x || 0, y: +d?.y || 0, ...(d?.fx ? { fx: 1 } : {}) }));
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
  if (d.t === 'hi') {
    if (W.players.size >= MAX_PLAYERS) { conn.close(); return; }
    const p = cleanP(d.p);
    W.conns.set(id, conn);
    W.players.set(id, p);
    conn.send({ t: 'world', you: id, players: [[W.myId, myState(A)], ...[...W.players].filter(([pid]) => pid !== id)] });
    hostBroadcast({ t: 'join', id, p }, id);
    play('knock');
    toast(`👋 ${p.av.name || 'Någon'} är i Pixelstaden!`, 'good');
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
  }
}
function hostDrop(A, conn) {
  if (!W || W.role !== 'host') return;
  const id = conn.peer, p = W.players.get(id);
  if (!p) return;
  W.conns.delete(id);
  W.players.delete(id);
  hostBroadcast({ t: 'leave', id });
  toast(`👋 ${p.av.name || 'Någon'} loggade ut.`);
}

// ---------- klientsidan ----------
function clientData(A, d, w) {
  if (W !== w || !d || typeof d !== 'object') return;
  if (d.t === 'world') {
    w.open = true;
    w._welcomed?.();
    for (const [id, p] of d.players || []) if (id !== w.myId) w.players.set(id, cleanP(p));
    toast(`🌆 Du är med i Pixelstaden – ${w.players.size + 1} online!`, 'good');
  } else if (d.t === 'join') {
    w.players.set(d.id, cleanP(d.p));
    play('knock');
    toast(`👋 ${w.players.get(d.id).av.name || 'Någon'} är i Pixelstaden!`, 'good');
  } else if (d.t === 'up') {
    const old = w.players.get(d.id);
    if (old) w.players.set(d.id, cleanP(d.p, old));
  } else if (d.t === 'emote') {
    const p = w.players.get(d.id);
    if (p) p.emote = { e: String(d.e).slice(0, 4), until: Date.now() + EMOTE_MS };
  } else if (d.t === 'leave') {
    const p = w.players.get(d.id);
    w.players.delete(d.id);
    if (p) toast(`👋 ${p.av.name || 'Någon'} loggade ut.`);
  }
}

// ---------- varje bildruta ----------
// Skickar min position/state throttlat (hela paketet bara när något mer än x
// ändrats) och glider alla andras figurer mot sina mål.
export function worldTick(A, myX, dt) {
  if (!W || !W.open) return;
  const now = performance.now();
  const myY = A.scene?.worldY ?? null;
  const meta = JSON.stringify([A.avatar.look, A.avatar.name, myScene(A), A.game.home, A.game.deco]);
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

// Alla som är på samma plats som jag: [{id, av, x, walking, emote}]
export function worldFolksHere(A) {
  if (!W || !W.open) return [];
  const here = myScene(A);
  if (here === 'away') return [];
  const out = [];
  for (const [id, p] of W.players) {
    if (p.scene !== here) continue;
    out.push({ id, av: p.av, x: p.x, y: p.y, walking: Math.hypot((p.tx ?? p.x) - p.x, (p.ty2 ?? p.y) - p.y) > 1, emote: p.emote && p.emote.until > Date.now() ? p.emote.e : null });
  }
  return out;
}
export const worldMyEmote = () => (W?.myEmote && W.myEmote.until > Date.now() ? W.myEmote.e : null);

export function sendEmote(A, e) {
  if (!W || !W.open) return;
  W.myEmote = { e, until: Date.now() + EMOTE_MS };
  if (W.role === 'client' && W.conn?.open) W.conn.send({ t: 'emote', e });
  if (W.role === 'host') hostBroadcast({ t: 'emote', id: W.myId, e });
  play('click');
}

// ---------- besök ----------
export function playersList() {
  if (!W || !W.open) return [];
  return [...W.players].map(([id, p]) => ({ id, av: p.av, scene: p.scene, home: p.home }));
}
export function visitPlayer(A, id) {
  const p = W?.players.get(id);
  if (!p) { toast('Hen loggade visst ut.', 'bad'); return false; }
  A.game.passTime(20); // resan dit
  A.game.save();
  if (A.game.collapsed) return false;
  A.visitTarget = { id, name: p.av.name, home: p.home || 'rum', deco: p.deco || {} };
  play('door');
  toast(`🏠 Du är hemma hos ${p.av.name || 'en kompis'}!`, 'good');
  A.go('visit');
  return true;
}
