// Besöka varandras hus. Värden bjuder hem med en 4-teckenskod (PeerJS-rum,
// samma mönster som Drömgården/Lantliv: värden är nav och vidarebefordrar).
// Gästen kliver in i värdens rum och alla ser varandra gå omkring.
//
// Meddelanden:  gäst→värd  {t:'hi', av, x}  {t:'pos', x}
//               värd→gäst  {t:'welcome', home, furniture, host:{av,x}, folks:[[id,{av,x}]]}
//               värd→alla  {t:'join', id, av, x}  {t:'pos', id, x}  {t:'leave', id}
import { openModal, closeModal, toast, esc } from '../core/ui.js';
import { cleanAvatar } from '../core/avatar.js';
import { play } from '../core/sound.js';

const CODE_ALPHA = 'ABCDEFGHJKMNPQRSTUVXYZ23456789'; // inga lättförväxlade tecken
const PREFIX = 'snabbfilen-';
let S = null;

export const visitSession = () => S;
export const isHosting = () => S?.mode === 'host';
export const isVisiting = () => S?.mode === 'guest' && S.open;

const meAv = (A) => ({ name: A.avatar.name, look: A.avatar.look, color: A.avatar.color });
const newCode = () => Array.from({ length: 4 }, () => CODE_ALPHA[(Math.random() * CODE_ALPHA.length) | 0]).join('');

function makePeer(id) {
  if (!window.Peer) throw new Error('PeerJS saknas');
  return new window.Peer(id, { debug: 0 });
}

// ---------- värd ----------
export function startHost(A, onChange) {
  stopVisit(A, { silent: true });
  const code = newCode();
  const peer = makePeer(PREFIX + code);
  S = { mode: 'host', code, peer, conns: new Map(), folks: new Map(), open: false, myX: 190, lastX: -1, lastSent: 0 };
  peer.on('open', () => { S.open = true; onChange?.(); });
  peer.on('error', (e) => {
    if (e.type === 'unavailable-id') { peer.destroy(); startHost(A, onChange); return; } // koden upptagen: ta en ny
    toast('📡 Nätverksstrul: ' + e.type, 'bad');
  });
  peer.on('connection', (conn) => {
    conn.on('data', (d) => hostData(A, conn, d, onChange));
    conn.on('close', () => dropGuest(A, conn, onChange));
  });
}

function hostBroadcast(msg, except = null) {
  for (const [id, conn] of S.conns) if (id !== except && conn.open) conn.send(msg);
}

function hostData(A, conn, d, onChange) {
  if (!S || S.mode !== 'host' || !d || typeof d !== 'object') return;
  const id = conn.peer;
  if (d.t === 'hi') {
    if (S.conns.size >= 6) { conn.close(); return; } // fullt hus
    const av = cleanAvatar(d.av);
    S.conns.set(id, conn);
    S.folks.set(id, { av, x: +d.x || 330, tx: +d.x || 330 });
    conn.send({
      t: 'welcome', home: A.game.home, furniture: A.game.furniture,
      host: { av: meAv(A), x: S.myX },
      folks: [...S.folks].filter(([fid]) => fid !== id).map(([fid, f]) => [fid, { av: f.av, x: f.x }]),
    });
    hostBroadcast({ t: 'join', id, av, x: S.folks.get(id).x }, id);
    play('knock');
    toast(`👋 ${av.name || 'En kompis'} kom på besök!`, 'good');
    onChange?.();
  } else if (d.t === 'pos') {
    const f = S.folks.get(id);
    if (f) { f.tx = Math.max(20, Math.min(364, +d.x || f.tx)); hostBroadcast({ t: 'pos', id, x: f.tx }, id); }
  }
}

function dropGuest(A, conn, onChange) {
  if (!S || S.mode !== 'host') return;
  const id = conn.peer, f = S.folks.get(id);
  if (!f) return;
  S.conns.delete(id);
  S.folks.delete(id);
  hostBroadcast({ t: 'leave', id });
  toast(`👋 ${f.av.name || 'Kompisen'} åkte hem.`);
  onChange?.();
}

// ---------- gäst ----------
export function joinVisit(A, code, { onFail } = {}) {
  stopVisit(A, { silent: true });
  code = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);
  if (code.length !== 4) { onFail?.('Koden är fyra tecken.'); return; }
  let failed = false;
  const fail = (msg) => { if (failed) return; failed = true; stopVisit(A, { silent: true }); onFail?.(msg); };
  const peer = makePeer(undefined);
  S = { mode: 'guest', code, peer, conn: null, folks: new Map(), host: null, home: 'rum', furniture: [], open: false, myX: 330, lastX: -1, lastSent: 0 };
  const timer = setTimeout(() => fail('Ingen svarade – stämmer koden?'), 9000);
  peer.on('error', (e) => { clearTimeout(timer); fail(e.type === 'peer-unavailable' ? 'Hittade ingen med den koden.' : 'Nätverksstrul: ' + e.type); });
  peer.on('open', () => {
    const conn = peer.connect(PREFIX + code, { reliable: true });
    S.conn = conn;
    conn.on('open', () => conn.send({ t: 'hi', av: meAv(A), x: S.myX }));
    conn.on('data', (d) => guestData(A, d, () => clearTimeout(timer)));
    conn.on('close', () => { if (S?.open) { stopVisit(A, { silent: true }); toast('👋 Besöket tog slut.'); if (A.sceneName === 'visit') A.go('city'); } });
  });
}

function guestData(A, d, gotWelcome) {
  if (!S || S.mode !== 'guest' || !d || typeof d !== 'object') return;
  if (d.t === 'welcome') {
    gotWelcome();
    S.open = true;
    S.home = d.home;
    S.furniture = Array.isArray(d.furniture) ? d.furniture : [];
    S.host = { av: cleanAvatar(d.host?.av), x: +d.host?.x || 190, tx: +d.host?.x || 190 };
    for (const [id, f] of d.folks || []) S.folks.set(id, { av: cleanAvatar(f.av), x: +f.x || 190, tx: +f.x || 190 });
    A.game.passTime(20); // resan dit
    A.game.save();
    closeModal();
    play('door');
    toast(`🏠 Du är hemma hos ${S.host.av.name || 'kompisen'}!`, 'good');
    A.go('visit');
  } else if (d.t === 'pos') {
    if (d.id === 'host') { if (S.host) S.host.tx = +d.x || S.host.tx; }
    else { const f = S.folks.get(d.id); if (f) f.tx = +d.x || f.tx; }
  } else if (d.t === 'join') {
    S.folks.set(d.id, { av: cleanAvatar(d.av), x: +d.x || 190, tx: +d.x || 190 });
    play('knock');
    toast(`👋 ${cleanAvatar(d.av).name || 'En kompis till'} kom också!`, 'good');
  } else if (d.t === 'leave') {
    const f = S.folks.get(d.id);
    S.folks.delete(d.id);
    if (f) toast(`👋 ${f.av.name || 'Kompisen'} åkte hem.`);
  }
}

// ---------- gemensamt ----------
export function stopVisit(A, { silent = false } = {}) {
  if (!S) return;
  const was = S;
  S = null;
  try { was.peer?.destroy(); } catch { /* redan nere */ }
  if (!silent) {
    if (was.mode === 'host' && was.folks.size) toast('🔒 Du bjuder inte hem längre.');
    if (was.mode === 'guest' && was.open) { A.game.passTime(20); A.game.save(); }
  }
}

// Anropas varje bildruta av rumsscenen med egna positionen; skickar throttlat
// och glider alla andras figurer mot deras mål.
export function visitTick(A, myX, dt) {
  if (!S) return;
  S.myX = myX;
  const now = performance.now();
  if (Math.abs(myX - S.lastX) > 0.5 && now - S.lastSent > 90) {
    S.lastSent = now; S.lastX = myX;
    if (S.mode === 'guest' && S.conn?.open) S.conn.send({ t: 'pos', x: myX });
    if (S.mode === 'host') hostBroadcast({ t: 'pos', id: 'host', x: myX });
  }
  const glide = (f) => {
    const d = f.tx - f.x, step = 70 * dt;
    if (Math.abs(d) <= step) f.x = f.tx; else f.x += Math.sign(d) * step;
  };
  for (const f of S.folks.values()) glide(f);
  if (S.mode === 'guest' && S.host) glide(S.host);
}

// Alla figurer som ska ritas utöver en själv i rummet: [{av, x, walking}]
export function visitFolks() {
  if (!S) return [];
  const out = [];
  if (S.mode === 'guest' && S.host) out.push({ av: S.host.av, x: S.host.x, walking: Math.abs(S.host.tx - S.host.x) > 1 });
  for (const f of S.folks.values()) out.push({ av: f.av, x: f.x, walking: Math.abs(f.tx - f.x) > 1 });
  return out;
}

// ---------- kompis-dialogen (HUD-knappen 👥) ----------
export function openFriends(A) {
  if (isHosting()) {
    const names = [...S.folks.values()].map((f) => esc(f.av.name || '?')).join(', ');
    openModal('👥 Du bjuder hem', `<p style="font-size:20px;margin-top:0">Säg koden till kompisarna:</p>
      <p style="font-size:52px;font-family:var(--head);letter-spacing:8px;text-align:center;margin:6px 0;background:#fff;border:3px solid var(--ink);padding:6px">${S.code}</p>
      <p style="font-size:18px">${S.folks.size ? `🏠 På besök: <b>${names}</b>` : S.open ? 'Väntar på besök…' : 'Kopplar upp…'}</p>`, [
      { label: '🔒 Sluta bjuda hem', cls: 'btn-red', onClick: () => { stopVisit(A); closeModal(); } },
      { label: 'Stäng', cls: 'btn-go', onClick: closeModal },
    ]);
    return;
  }
  if (isVisiting()) {
    openModal('👥 På besök', `<p style="font-size:20px">Du är hemma hos <b>${esc(S.host?.av.name || '?')}</b>.</p>`, [
      { label: '🚗 Åk hem', cls: 'btn-red', onClick: () => { stopVisit(A); closeModal(); toast('🚗 Hemma igen.'); A.go('city'); } },
      { label: 'Stanna', cls: 'btn-go', onClick: closeModal },
    ]);
    return;
  }
  const dlg = openModal('👥 Kompisar', `<p style="font-size:20px;margin-top:0">Bjud hem kompisar till ditt hus, eller åk och hälsa på någon!</p>
    <div style="display:flex;gap:8px;align-items:center;margin-top:10px">
      <input id="visit-code" type="text" maxlength="4" placeholder="KOD" autocomplete="off" spellcheck="false"
        style="width:110px;font:26px var(--head);letter-spacing:4px;text-transform:uppercase;border:3px solid var(--ink);padding:4px 8px">
      <button class="btn" data-join>🚗 Åk på besök</button>
    </div><div class="av-err" data-err style="margin-top:6px"></div>`, [
    { label: '🏠 Bjud hem kompisar', cls: 'btn-go', onClick: () => {
      closeModal();
      // uppdatera dialogen bara om den fortfarande är öppen (annars räcker toasten)
      startHost(A, () => { if (isHosting() && document.querySelector('#modal .dlg')?.dataset.title === '👥 Du bjuder hem') openFriends(A); });
      openFriends(A);
    } },
    { label: 'Stäng', onClick: closeModal },
  ]);
  const input = dlg.querySelector('#visit-code'), err = dlg.querySelector('[data-err]');
  input.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') dlg.querySelector('[data-join]').click(); });
  input.addEventListener('keyup', (e) => e.stopPropagation());
  dlg.querySelector('[data-join]').onclick = () => {
    err.textContent = 'Åker…';
    joinVisit(A, input.value, { onFail: (msg) => { err.textContent = msg; } });
  };
}
