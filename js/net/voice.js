// RÖSTCHATT – öppen närhetsröst och röstgrupper (Carl 2026-09-28: "kan det vara en öppen
// röstchatt så det som är nära kan prata? och att man kan skapa en grupp att prata i").
//
// NÄRA  – slår man på 🎙️ Röst hörs man av, och hör, andra som OCKSÅ har rösten på och står
//         nära en på samma ställe (ljudet tonar bort med avståndet). Rösten är ALLTID av från
//         start: ingen mikrofon slås på utan att man själv bett om det, och den som inte slagit
//         på rösten hör ingenting.
// GRUPP – skapa en röstgrupp och bjud in kompisar (de måste tacka ja). Gruppen hörs överallt
//         i full volym, var man än är i stan.
//
// Varje par har högst EN förbindelse (ett PeerJS-mediasamtal via world.js) med ett eller två
// skäl att finnas (nära och/eller grupp). Den med lägst spelar-id ringer upp; mottagaren svarar
// bara om den själv vill ha förbindelsen – allt annat stängs direkt. Grupperna följer
// webbläsarnyckeln (key), inte spelar-id:t, så att de överlever värdbyten. Signaler via
// jobbkanalen (world.js reläar dem till alla, bara rätt mottagare bryr sig):
//   {k:'voice', t:'bjud', to, gid, namn}  inbjudan
//   {k:'voice', t:'ja'|'nej', to, gid}    svaret till den som bjöd
//   {k:'voice', t:'med', gid, keys}       gruppens medlemmar (tas bara emot från en medlem)
//   {k:'voice', t:'lamna', gid}           jag lämnar gruppen
import { onJob, sendJob, onCall, worldPeer, worldMyId, worldFolksHere, worldPlayer, worldMyKey, playersList, setVoiceHooks, worldMarkActive, playerName } from './world.js';
import { toast } from '../core/ui.js';
import { setDuck } from '../core/rec.js';

const NEAR_IN = 140, NEAR_OUT = 190, FULL = 40; // spelpixlar: kopplas in / ut, full volym inom
const TICK_MS = 150;         // nivåerna (vem pratar) – länkarna ses över varannan gång
const LINGER_MS = 2500;      // en förbindelse utan skäl stängs efter så lång tid
const DIAL_TIMEOUT = 15000;  // ett samtal som aldrig fick ljud ringer man om
const INVITE_MS = 30000;
const TALK_RMS = 0.03, TALK_HOLD = 450;
const MAX_LINKS = 8;         // mesh: fler än så blir för tungt för en telefon

const S = {
  A: null, nara: false, stream: null, micMuted: false, ac: null, selfMeter: null,
  group: null,               // { gid, keys: Set<nyckel> } – de andras nycklar
  sent: new Map(),           // spelar-id → { gid, until } – inbjudningar jag skickat
  links: new Map(),          // spelar-id → förbindelse
  hush: new Set(),           // nycklar jag tystat lokalt
  talkSelfUntil: 0, keepAt: 0, n: 0, lastInvite: new Map(),
  listeners: new Set(), inviteCb: null, timer: null,
};

const emit = () => { for (const f of S.listeners) { try { f(); } catch (e) { console.error('röstchatten:', e); } } };
export const onVoiceChange = (f) => { S.listeners.add(f); return () => S.listeners.delete(f); };
export const onVoiceInvite = (f) => { S.inviteCb = f; };
export const voiceSupported = () => typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia && typeof RTCPeerConnection !== 'undefined';
const nameOf = (id) => playerName(id) || worldPlayer(id)?.av?.name || 'Någon';
const keyOf = (id) => worldPlayer(id)?.key || null;

// ---------- ljudet ----------
// Egen AudioContext (spelets ljud-av-knapp gäller effekter och musik – rösten har egna knappar)
function audio() {
  if (!S.ac) {
    const C = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
    if (!C) return null;
    try { S.ac = new C(); } catch { return null; }
  }
  if (S.ac.state === 'suspended') S.ac.resume().catch(() => {});
  return S.ac;
}
function meterOf(stream, toSilentOut = false) {
  const ac = audio();
  if (!ac) return null;
  try {
    const src = ac.createMediaStreamSource(stream);
    const an = ac.createAnalyser(); an.fftSize = 512;
    src.connect(an);
    if (toSilentOut) { const z = ac.createGain(); z.gain.value = 0; an.connect(z); z.connect(ac.destination); } // annars räknar inte alla webbläsare
    return { src, an, buf: new Uint8Array(an.fftSize) };
  } catch { return null; }
}
function level(m) {
  if (!m) return 0;
  m.an.getByteTimeDomainData(m.buf);
  let s = 0;
  for (let i = 0; i < m.buf.length; i++) { const d = (m.buf[i] - 128) / 128; s += d * d; }
  return Math.sqrt(s / m.buf.length);
}
async function ensureMic() {
  if (S.stream) return true;
  if (!voiceSupported()) { toast('🎙️ Den här webbläsaren kan inte skicka röst 😕', 'bad'); return false; }
  audio(); // skapas medan klicket fortfarande gäller (iPhone)
  try {
    S.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: false });
  } catch (e) {
    toast(e?.name === 'NotAllowedError' ? '🎙️ Mikrofonen är blockerad – tillåt den för sidan i webbläsaren.' : '🎙️ Hittade ingen mikrofon.', 'bad');
    return false;
  }
  for (const t of S.stream.getAudioTracks()) t.enabled = !S.micMuted;
  S.selfMeter = meterOf(S.stream, true);
  return true;
}
function releaseMicIfUnused() {
  if (S.nara || S.group) return;
  for (const id of [...S.links.keys()]) dropLink(id);
  try { S.selfMeter?.src.disconnect(); } catch { /* ok */ }
  for (const t of S.stream?.getTracks() || []) { try { t.stop(); } catch { /* ok */ } }
  S.stream = null; S.selfMeter = null; S.talkSelfUntil = 0;
}

// ---------- vem ska jag vara kopplad till? ----------
function distTo(f) {
  const x = S.A?.scene?.worldX, y = S.A?.scene?.worldY;
  if (x == null) return 0; // scener utan position (små rum): alla på stället hörs
  return Math.hypot(f.x - x, y == null ? 0 : f.y - y);
}
function reasons(id, loose = false) {
  const r = { nara: false, grupp: false, vol: 0 };
  if (S.group) { const k = keyOf(id); if (k && S.group.keys.has(k)) r.grupp = true; }
  if (S.nara && S.A) {
    const f = worldFolksHere(S.A).find((p) => p.id === id);
    if (f && f.vo) {
      const d = distTo(f), lim = loose ? NEAR_OUT * 1.3 : S.links.has(id) ? NEAR_OUT : NEAR_IN;
      if (d < lim) { r.nara = true; r.vol = d <= FULL ? 1 : Math.pow(Math.max(0, 1 - (d - FULL) / (NEAR_OUT - FULL)), 1.5); }
    }
  }
  return r;
}

// ---------- förbindelserna ----------
function attach(id, mc) {
  const old = S.links.get(id);
  if (old && old.mc !== mc) dropLink(id);
  const L = { id, mc, key: keyOf(id), el: null, meter: null, gain: null, target: 0, why: { nara: false, grupp: false }, idleSince: 0, talkUntil: 0, got: false, born: Date.now() };
  S.links.set(id, L);
  mc.on('stream', (remote) => { if (L.got || S.links.get(id) !== L) return; L.got = true; playRemote(L, remote); emit(); });
  const gone = () => { if (S.links.get(id) === L) { dropLink(id); emit(); } };
  mc.on('close', gone);
  mc.on('error', gone);
  return L;
}
function playRemote(L, remote) {
  const el = new Audio();
  el.autoplay = true; el.setAttribute('playsinline', ''); el.srcObject = remote;
  const ac = audio();
  if (ac) {
    el.muted = true; // Chrome släpper bara in WebRTC-ljudet i Web Audio om ett element spelar strömmen
    L.meter = meterOf(remote);
    if (L.meter) { const g = ac.createGain(); g.gain.value = 0; L.meter.src.connect(g); g.connect(ac.destination); L.gain = g; }
    else el.muted = false;
  }
  if (!L.gain) el.volume = 0;
  el.play?.().catch(() => {});
  L.el = el;
}
function dropLink(id) {
  const L = S.links.get(id);
  if (!L) return;
  S.links.delete(id);
  try { L.mc.close(); } catch { /* ok */ }
  try { L.gain?.disconnect(); L.meter?.src.disconnect(); } catch { /* ok */ }
  if (L.el) { try { L.el.pause(); } catch { /* ok */ } L.el.srcObject = null; }
}
function dial(id, r) {
  const peer = worldPeer();
  if (!peer || !S.stream || S.links.size >= MAX_LINKS) return;
  let mc = null;
  try { mc = peer.call(id, S.stream, { metadata: { v: 1, why: r.grupp ? 'grupp' : 'nara', gid: S.group?.gid || null } }); } catch { return; }
  if (mc) attach(id, mc).why = r;
}
// inkommande: svara bara om JAG vill ha förbindelsen (röst på och nära, eller samma grupp)
onCall((mc) => {
  const id = mc.peer, r = reasons(id, true);
  if (!S.stream || !(r.nara || r.grupp) || S.links.size >= MAX_LINKS) { try { mc.close(); } catch { /* ok */ } return; }
  try { mc.answer(S.stream); } catch { try { mc.close(); } catch { /* ok */ } return; }
  attach(id, mc).why = r;
  emit();
});

// ---------- varje tick ----------
function tick() {
  const A = S.A;
  if (!A) return;
  const now = Date.now(), me = worldMyId();
  if (!(S.nara || S.group) || !me || !S.stream) {
    if (S.links.size) { for (const id of [...S.links.keys()]) dropLink(id); emit(); }
    levels(now);
    return;
  }
  if (S.n++ % 2 === 0) {
    let changed = false;
    const cand = new Set(S.links.keys());
    if (S.group) for (const p of playersList()) { const k = keyOf(p.id); if (k && S.group.keys.has(k)) cand.add(p.id); }
    if (S.nara) for (const f of worldFolksHere(A)) if (f.vo) cand.add(f.id);
    for (const id of cand) {
      const r = reasons(id), L = S.links.get(id);
      if (r.nara || r.grupp) {
        if (!L) { if (me < id) { dial(id, r); changed = true; } continue; }
        L.idleSince = 0; L.why = r;
        L.target = S.hush.has(L.key || id) ? 0 : r.grupp ? 1 : r.vol;
        if (!L.got && now - L.born > DIAL_TIMEOUT) { dropLink(id); changed = true; }
      } else if (L) {
        L.target = 0;
        if (!L.idleSince) L.idleSince = now;
        else if (now - L.idleSince > LINGER_MS) { dropLink(id); changed = true; }
      }
    }
    for (const [id, s] of [...S.sent]) if (now > s.until) { S.sent.delete(id); toast(`🎙️ ${nameOf(id)} svarade inte på inbjudan.`); changed = true; }
    // den som pratar i röstchatten står inte still: räkna det som aktivitet (annars loggas man ut)
    if (S.links.size && now - S.keepAt > 20000) { S.keepAt = now; try { worldMarkActive(); } catch { /* ok */ } }
    if (changed) emit();
  }
  levels(now);
}
function levels(now) {
  const ac = S.ac;
  for (const L of S.links.values()) {
    if (L.gain && ac) L.gain.gain.setTargetAtTime(L.target, ac.currentTime, 0.12);
    else if (L.el) L.el.volume = Math.max(0, Math.min(1, L.target));
    if (L.meter && L.target > 0.05 && level(L.meter) > TALK_RMS) L.talkUntil = now + TALK_HOLD;
  }
  if (S.selfMeter && !S.micMuted && level(S.selfMeter) > TALK_RMS) S.talkSelfUntil = now + TALK_HOLD;
  // pratar någon i röstchatten? – bakgrundsljudet och musiken viker undan
  try { setDuck([...S.links.values()].some((L) => L.talkUntil > now && !isHushed(L.id)) ? 1 : 0); } catch { /* ok */ }
}

// ---------- grupperna ----------
const newGid = () => String(worldMyId() || 'x').slice(-6) + '-' + Date.now().toString(36);
const broadcastMembers = () => { if (S.group) sendJob({ k: 'voice', t: 'med', gid: S.group.gid, keys: [worldMyKey(), ...S.group.keys].slice(0, 24) }); };
onJob((ev) => {
  const m = ev?.m;
  if (!m || m.k !== 'voice') return;
  const from = ev.from, me = worldMyId();
  if (!from || !me || from === me) return;
  const fromKey = keyOf(from), namn = String(m.namn || nameOf(from)).slice(0, 16), gid = String(m.gid || '').slice(0, 40);
  if (m.t === 'bjud') {
    if (m.to !== me || !gid || S.group?.gid === gid) return;
    if (Date.now() - (S.lastInvite.get(from) || 0) < 8000) return; // ingen inbjudningsspam
    S.lastInvite.set(from, Date.now());
    const decline = () => sendJob({ k: 'voice', t: 'nej', to: from, gid });
    if (!S.inviteCb) { decline(); return; }
    S.inviteCb({ from, namn, accept: () => joinGroup(from, gid), decline });
  } else if (m.t === 'ja') {
    if (m.to !== me || !S.group) return;
    const s = S.sent.get(from);
    if (!s || s.gid !== S.group.gid) return;
    S.sent.delete(from);
    if (fromKey) S.group.keys.add(fromKey);
    broadcastMembers();
    toast(`🎙️ ${namn} gick med i röstgruppen!`, 'good');
    emit();
  } else if (m.t === 'nej') {
    if (m.to !== me) return;
    if (S.sent.delete(from)) { toast(`🎙️ ${namn} tackade nej till röstgruppen.`); emit(); }
  } else if (m.t === 'med') {
    if (!S.group || gid !== S.group.gid || !fromKey || !S.group.keys.has(fromKey)) return; // bara från en medlem
    const mine = worldMyKey();
    for (const k of (Array.isArray(m.keys) ? m.keys : []).slice(0, 24)) if (typeof k === 'string' && k && k !== mine) S.group.keys.add(k.slice(0, 40));
    emit();
  } else if (m.t === 'lamna') {
    if (S.group && gid === S.group.gid && fromKey && S.group.keys.delete(fromKey)) { toast(`🎙️ ${namn} lämnade röstgruppen.`); emit(); }
  }
});
async function joinGroup(from, gid) {
  if (!(await ensureMic())) { sendJob({ k: 'voice', t: 'nej', to: from, gid }); return false; }
  if (S.group && S.group.gid !== gid) leaveGroup(true);
  const k = keyOf(from);
  S.group = { gid, keys: new Set(k ? [k] : []) };
  sendJob({ k: 'voice', t: 'ja', to: from, gid });
  toast('🎙️ Du är med i röstgruppen – ni hörs överallt i stan!', 'good');
  emit();
  return true;
}

// ---------- det gränssnittet (voice-ui.js) och testerna använder ----------
export async function setNara(on) {
  if (on) {
    if (!(await ensureMic())) return false;
    S.nara = true;
    toast('🎙️ Rösten är på – de som står nära och också har rösten på hör dig.', 'good');
  } else {
    S.nara = false;
    releaseMicIfUnused();
    toast('🎙️ Rösten i närheten är av.');
  }
  emit();
  return S.nara;
}
export async function createGroup() {
  if (!(await ensureMic())) return false;
  if (!S.group) { S.group = { gid: newGid(), keys: new Set() }; emit(); }
  return true;
}
export async function inviteToGroup(toId) {
  if (!worldPeer()) { toast('📡 Du är inte uppkopplad mot världen än – vänta en stund.', 'bad'); return false; }
  if (!(await createGroup())) return false;
  S.sent.set(toId, { gid: S.group.gid, until: Date.now() + INVITE_MS });
  sendJob({ k: 'voice', t: 'bjud', to: toId, gid: S.group.gid, namn: String(S.A?.avatar?.name || '').slice(0, 16) });
  toast(`🎙️ Inbjudan skickad till ${nameOf(toId)}.`, 'good');
  emit();
  return true;
}
export function leaveGroup(quiet = false) {
  if (!S.group) return;
  sendJob({ k: 'voice', t: 'lamna', gid: S.group.gid });
  S.group = null;
  S.sent.clear();
  releaseMicIfUnused();
  if (!quiet) toast('🎙️ Du lämnade röstgruppen.');
  emit();
}
export function toggleMic() {
  S.micMuted = !S.micMuted;
  for (const t of S.stream?.getAudioTracks() || []) t.enabled = !S.micMuted;
  if (S.micMuted) S.talkSelfUntil = 0;
  emit();
  return S.micMuted;
}
export const isHushed = (id) => S.hush.has(keyOf(id) || id);
export function toggleHush(id) {
  const k = keyOf(id) || id;
  if (S.hush.has(k)) S.hush.delete(k); else S.hush.add(k);
  emit();
}
export function voiceState() {
  const now = Date.now(), players = playersList();
  const byKey = new Map(players.map((p) => [keyOf(p.id), p]));
  return {
    supported: voiceSupported(), nara: S.nara, mic: !!S.stream, micMuted: S.micMuted,
    talkingSelf: !!S.stream && now < S.talkSelfUntil,
    group: S.group ? { gid: S.group.gid, members: [...S.group.keys].map((k) => { const p = byKey.get(k); return { key: k, id: p?.id || null, name: p?.av?.name || 'Borta', online: !!p }; }) } : null,
    sent: [...S.sent.keys()].map((id) => ({ id, name: nameOf(id) })),
    links: [...S.links.values()].map((L) => ({ id: L.id, name: nameOf(L.id), nara: !!L.why?.nara, grupp: !!L.why?.grupp, got: L.got, vol: +L.target.toFixed(2), talking: L.talkUntil > now, hushed: isHushed(L.id) })),
  };
}
export const isTalking = (id) => (id === 'self' ? !!S.stream && Date.now() < S.talkSelfUntil : (S.links.get(id)?.talkUntil || 0) > Date.now());

export function initVoice(A) {
  if (S.A) return;
  S.A = A;
  setVoiceHooks({ on: () => S.nara, talking: isTalking });
  S.timer = setInterval(tick, TICK_MS);
  // iPhone kan pausa ljudkontexten – varje tryck väcker den igen
  if (typeof window !== 'undefined') window.addEventListener('pointerdown', () => { if (S.ac?.state === 'suspended') S.ac.resume().catch(() => {}); }, { capture: true, passive: true });
}
