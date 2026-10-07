// FEST HEMMA (Carl 2026-10-01: "bjuda in till party"). 🎉-knappen hemma (main.js #fest-btn):
// välj hur många grannar och kompisar från Pixelstaden som kommer (bostadens storlek sätter taket),
// vad du bjuder på (chips och dricka / pizza / pizza och tårta) och vilka kompisar online som ska
// få en inbjudan. Festen pågår i tre timmar spelklocka (eller tills du avslutar den):
//   · gästerna kommer in genom dörren en och en, dansar, pratar, äter vid festbordet och går hem
//   · girlanger, ballonger, discokula med färgade ljusprickar, konfetti – och jukeboxlåten på högt
//   · du blir gladare var halvtimme (högst +12 om dagen); maten mättar dig
//   · kompisar online får "🎉 Fest hos …! Åk dit?" och ser pyntet när de kommer (world.js fe)
// Efteråt ligger det skräp på golvet – muggar, chipspåsar och konfetti – klicka för att städa.
// En fest om dagen, och den ska vara slut senast 23 (grannarna).
//
// Staten: A.fest = { home, sub, slut, n, mat, gaster: [...], mess: [] } (sparas inte – en omladdning
// mitt i festen = alla gick hem). Skräpet A.festMess[home:sub] ligger kvar tills man städat (sparas inte).
// Rummet (room.js) skapar createFestRoom(A, geo) och ritar/klickar via den.
import { drawPerson, makeLookRich } from './people.js';
import { openModal, closeModal, toast, esc } from './ui.js';
import { play } from './sound.js';
import { fmt } from '../game.js';
import { sendJob, onJob, worldMyId, playersList, worldPlayer, visitPlayer } from '../net/world.js';
import { createSpeech, WALK_SEQ } from '../scenes/walkable.js';
import { stopHemMusik } from './hemmusik.js';
import { $t } from './i18n.js';

export const FEST_LANGD = 180;      // minuter spelklocka
export const FEST_SENAST = 20 * 60;  // sista starttid (slut 23:00)
export const FEST_MAX = { husvagn: 3, rum: 3, hoghus: 4, lagenhet: 6, radhus: 8, villa: 10, takvaning: 12 };
export const FEST_MAT = [
  { id: 'chips', icon: '🥤', namn: $t('Chips och dricka'), per: 20, mat: 10 },
  { id: 'pizza', icon: '🍕', namn: $t('Pizza och dricka'), per: 45, mat: 25 },
  { id: 'tarta', icon: '🎂', namn: $t('Pizza, dricka och tårta'), per: 70, mat: 30, glad: 2 },
];
const STORLEK = [[3, $t('Liten fest')], [5, $t('Fest')], [8, $t('Storfest')], [12, $t('Jättefest')]];
const NAMN = [$t('Alva'), $t('Leo'), $t('Saga'), $t('Elias'), $t('Wilma'), $t('Hugo'), $t('Maja'), $t('Noah'), $t('Ebba'), $t('Liam'), $t('Freja'), $t('Oscar'), $t('Ella'), $t('Viggo'), $t('Astrid'), $t('Malte'), $t('Signe'), $t('Melvin')];
const PRAT = [$t('Vilken fest! 🎉'), $t('Snyggt här!'), $t('Bästa låten!'), $t('Mer chips, tack!'), $t('Kom och dansa!'), $t('Woho! 🕺'), $t('Älskar den här låten!'), $t('Mysigt hem du har!'), $t('Skål! 🥤'), $t('Ska vi dansa? 💃'), $t('Pizzan är grym! 🍕'), $t('Vi måste göra om det här!')];
const abs = (g) => g.day * 1440 + g.min;

// ---------------------------------------------------------------- start / slut
export function canFest(A) {
  const g = A.game;
  if (A.sceneName !== 'room' || A.visitTarget) return $t('Fest har man hemma!');
  if (A.fest) return null;
  if ((g.festDag | 0) === g.day) return $t('Du har redan haft fest i dag – vila lite!');
  if (g.min > FEST_SENAST) return $t('Det är för sent för fest – grannarna ska sova. Fest kan du ha till kl 20.');
  if (g.min < 9 * 60) return $t('Lite tidigt för fest, eller hur? Vänta till efter frukost.');
  return null;
}
export function startFest(A, { n = 3, mat = 'chips', bjud = [] } = {}) {
  const g = A.game, M = FEST_MAT.find((x) => x.id === mat) || FEST_MAT[0];
  const why = canFest(A);
  if (why) return { ok: false, msg: why };
  n = Math.max(1, Math.min(FEST_MAX[g.home] || 3, n | 0));
  const kost = n * M.per;
  if (g.money < kost) return { ok: false, msg: $t`Festen kostar ${fmt(kost)} – du har inte råd.` };
  g.money -= kost;
  g.festDag = g.day;
  g.fester = (g.fester | 0) + 1;
  g.hunger = Math.min(100, g.hunger + M.mat);
  const glad = g.glad(2 + (M.glad || 0), '', 'fest', 12);
  g.save();
  const rng = Math.random;
  const namn = [...NAMN].sort(() => rng() - 0.5);
  A.fest = { home: g.home, sub: A.roomSub | 0, slut: abs(g) + FEST_LANGD, n, mat: M.id, nastaGlad: abs(g) + 30,
    gaster: Array.from({ length: n }, (_, i) => ({ look: makeLookRich(rng), namn: namn[i % namn.length], in: i * 1.3, state: 'vantar', x: 0, y: 0, path: [], dir: 'down', t: 0, wait: 0 })),
    konfetti: 2.5 };
  A.hemMusik = { id: 'jukebox', dev: 'fest', sub: A.roomSub | 0, k: null, decoIdx: null };   // festlåten på högt
  // inbjudningar till kompisar online
  const me = String(A.avatar?.name || '').slice(0, 16);
  for (const id of bjud) sendJob({ k: 'fest', to: String(id), namn: me });
  return { ok: true, kost, glad, mat: M };
}
export function endFest(A, why = 'slut') {
  const F = A.fest;
  if (!F) return;
  A.fest = null;
  if (A.hemMusik?.dev === 'fest') stopHemMusik(A);
  // skräpet stannar där festen var
  A.festMess ||= {};
  const key = `${F.home}:${F.sub}`;
  A.festMess[key] = [...(A.festMess[key] || []), ...(F.mess || [])].slice(0, 30);
  const n = F.gaster.filter((q) => q.state !== 'vantar').length;
  if (why === 'ut') toast($t`🎉 Gästerna gick hem när du gick ut. Festen är slut!`);
  else if (why === 'sova') { /* tyst – man somnar */ }
  else toast(`${n === 1 ? $t`🎉 Festen är slut! ${n} gäst hade jättekul.` : $t`🎉 Festen är slut! ${n} gäster hade jättekul.`}${F.mess?.length ? ` ${$t('Städa upp skräpet på golvet! 🧹')}` : ''}`, 'good');
}

// varje bildruta (main.js): festen tar slut när tiden är ute, när man går hemifrån eller somnar;
// besökare på en fest blir glada
const besok = new Set();
export function festTick(A) {
  const g = A.game, F = A.fest;
  if (F) {
    if (A.sceneName !== 'room' || A.visitTarget || g.home !== F.home) { endFest(A, A.sceneName === 'room' ? 'flytt' : 'ut'); return; }
    if (A.scene?.asleep) { endFest(A, 'sova'); return; }
    if (abs(g) >= F.nastaGlad) {   // (hoppar klockan – en sak som tar tid – räknas alla halvtimmar på en gång)
      const k = Math.floor((abs(g) - F.nastaGlad) / 30) + 1;
      F.nastaGlad += 30 * k;
      const h = g.glad(2 * k, '', 'fest', 12);
      if (h) toast($t`🎉 Festen! +${h} 😊`);
    }
  }
  if (A.sceneName === 'visit' && A.visitTarget && worldPlayer(A.visitTarget.id)?.fe) {
    const k = `${g.day}:${A.visitTarget.id}`;
    if (!besok.has(k)) { besok.add(k); const h = g.glad(4, '', 'festbesok', 8); const vem = A.visitTarget.name || $t('en kompis'); toast(`${$t`🎉 Fest hos ${vem}!`}${h ? ` +${h} 😊` : ''}`, 'good'); }
  }
}
export const festOn = (A) => !!A.fest;
// syns pyntet i det här rummet? (eget hem: min fest i just det rummet; besök: värden har fest)
export function festHere(A, { visit, home, sub }) {
  if (visit) return !!(A.visitTarget && worldPlayer(A.visitTarget.id)?.fe);
  return !!A.fest && A.fest.home === home && A.fest.sub === sub;
}

// ---------------------------------------------------------------- dialogen
export function openFest(A) {
  const g = A.game;
  if (A.fest) {
    openModal($t('🎉 Festen pågår'), `<p style="font-size:var(--f2);margin-top:0">${$t`Festen håller på till ${clockOf(A.fest.slut)}. Vill du avsluta den nu?`}</p>`, [
      { label: $t('🎉 Fortsätt festa'), cls: 'btn-go', onClick: closeModal },
      { label: $t('👋 Avsluta festen'), onClick: () => { closeModal(); A.fest.slut = abs(g); } },
    ]);
    return;
  }
  const why = canFest(A);
  if (why) { toast(`🎉 ${why}`, 'bad'); return; }
  const max = FEST_MAX[g.home] || 3;
  const st = { n: STORLEK.find(([n]) => n <= max)?.[0] || 3, mat: 'pizza', bjud: new Set() };
  const vanner = playersList().filter((p) => p.id !== worldMyId());
  const draw = () => {
    const M = FEST_MAT.find((x) => x.id === st.mat), kost = st.n * M.per;
    const size = STORLEK.filter(([n]) => n <= max).map(([n, namn]) => `<button class="btn btn-small ${st.n === n ? 'btn-gold' : ''}" data-n="${n}">${namn} · ${$t`${n} gäster`}</button>`).join(' ');
    const mat = FEST_MAT.map((x) => `<button class="btn btn-small ${st.mat === x.id ? 'btn-gold' : ''}" data-m="${x.id}">${x.icon} ${esc(x.namn)} · ${$t`${fmt(x.per)}/gäst`}</button>`).join(' ');
    const vl = vanner.length ? vanner.map((p) => `<label style="display:block;font-size:var(--f2)"><input type="checkbox" data-v="${esc(p.id)}" ${st.bjud.has(p.id) ? 'checked' : ''}> 💌 ${esc(p.av?.name || $t('Kompis'))}</label>`).join('') : `<p class="sp" style="margin:0">${$t('Ingen annan är online just nu – grannarna kommer ändå!')}</p>`;
    const dlg = openModal($t('🎉 Ha fest hemma!'), `<p style="font-size:var(--f2);margin-top:0">${$t('Bjud hem grannar och kompisar från Pixelstaden! Festen pågår i tre timmar – musik, dans och mat.')} ${max < 12 ? `<span class="sp">${$t`(Det får plats ${max} gäster i ${esc($t(g.homeInfo.name).toLowerCase())}.)`}</span>` : ''}</p>
      <p class="fb-lbl" style="margin:6px 0 2px">${$t('Hur stor fest?')}</p><div>${size}</div>
      <p class="fb-lbl" style="margin:8px 0 2px">${$t('Vad bjuder du på?')}</p><div>${mat}</div>
      <p class="fb-lbl" style="margin:8px 0 2px">${$t('Bjud in kompisar online')}</p>${vl}
      <p style="font-size:var(--f2);margin:8px 0 0">${$t`💰 Du har <b>${fmt(g.money)}</b> · festen kostar <b>${fmt(kost)}</b>`}</p>`, [
      { label: $t`🎉 Starta festen · ${fmt(kost)}`, cls: 'btn-go', onClick: () => {
        const r = startFest(A, { n: st.n, mat: st.mat, bjud: [...st.bjud] });
        if (!r.ok) { toast(r.msg, 'bad'); play('fel'); return; }
        closeModal(); play('fanfare');
        toast(`${!st.bjud.size ? $t`🎉 Festen har börjat! ${st.n} gäster är på väg.` : st.bjud.size === 1 ? $t`🎉 Festen har börjat! ${st.n} gäster är på väg och ${st.bjud.size} kompis har fått en inbjudan.` : $t`🎉 Festen har börjat! ${st.n} gäster är på väg och ${st.bjud.size} kompisar har fått en inbjudan.`}${r.glad ? ` +${r.glad} 😊` : ''}`, 'good');
      } },
      { label: $t('Inte nu'), onClick: closeModal },
    ]);
    dlg.querySelectorAll('[data-n]').forEach((b) => (b.onclick = () => { st.n = +b.dataset.n; play('click'); draw(); }));
    dlg.querySelectorAll('[data-m]').forEach((b) => (b.onclick = () => { st.mat = b.dataset.m; play('click'); draw(); }));
    dlg.querySelectorAll('[data-v]').forEach((b) => (b.onchange = () => { if (b.checked) st.bjud.add(b.dataset.v); else st.bjud.delete(b.dataset.v); }));
  };
  draw();
}
const clockOf = (m) => { const mm = ((m % 1440) + 1440) % 1440; return `${String(Math.floor(mm / 60)).padStart(2, '0')}:${String(mm % 60).padStart(2, '0')}`; };

// inbjudan från en kompis: åk dit (besöket i world.js)
let festA = null;
export function festInvites(A) { festA = A; }
onJob((ev) => {
  const m = ev?.m, A = festA;
  if (!A || m?.k !== 'fest' || m.to !== worldMyId()) return;
  const namn = esc(String(m.namn || $t('En kompis')).slice(0, 16));
  if (A.sceneName.startsWith('jobb')) { toast($t`🎉 ${namn} har fest – men du jobbar. Åk dit efter passet!`); return; }
  play('knock');
  openModal($t('🎉 Fest!'), `<p style="font-size:var(--f2);margin-top:0">${$t`<b>${namn}</b> har fest hemma och bjuder in dig! Musik, dans och mat – häng med?`}</p>`, [
    { label: $t('🎉 Åk dit!'), cls: 'btn-go', onClick: () => { closeModal(); visitPlayer(A, ev.from); } },
    { label: $t('Inte nu'), onClick: closeModal },
  ]);
});

// ---------------------------------------------------------------- i rummet
// geo = { sub, home, right, wallY, bottom, door: { x0, x1 }, walkable(x, y), findPath(sx, sy, tx, ty), visit }
export function createFestRoom(A, geo) {
  const talk = createSpeech();
  let pratT = 3, t = 0;
  const key = `${geo.home}:${geo.sub}`;
  const mine = () => (!geo.visit && A.fest && A.fest.home === geo.home && A.fest.sub === geo.sub ? A.fest : null);
  const doorPt = () => ({ x: Math.round((geo.door.x0 + geo.door.x1) / 2), y: geo.wallY + 10 });
  // festbordet: en ledig plats en bit in från bakväggen
  let table = null;
  const findTable = () => {
    for (const dy of [22, 34, 46]) for (let x = Math.round(geo.right * 0.55); x < geo.right - 30; x += 8) if (geo.walkable(x, geo.wallY + dy) && geo.walkable(x + 16, geo.wallY + dy) && geo.walkable(x - 16, geo.wallY + dy)) return { x, y: geo.wallY + dy };
    for (let x = 40; x < geo.right - 30; x += 8) if (geo.walkable(x, geo.wallY + 30)) return { x, y: geo.wallY + 30 };
    return { x: Math.round(geo.right / 2), y: geo.wallY + 30 };
  };
  const spot = (F, self) => {
    for (let k = 0; k < 40; k++) {
      const x = 16 + Math.random() * (geo.right - 32), y = geo.wallY + 14 + Math.random() * (geo.bottom - geo.wallY - 24);
      if (!geo.walkable(x, y)) continue;
      if (F.gaster.some((q) => q !== self && q.state !== 'vantar' && Math.hypot(q.tx - x, q.ty - y) < 16)) continue;
      return [Math.round(x), Math.round(y)];
    }
    return [self.x, self.y];
  };
  const go = (q, x, y) => { q.tx = x; q.ty = y; q.path = geo.findPath(q.x, q.y, x, y); if (!q.path.length) q.path = [[x, y]]; };

  function update(dt) {
    t += dt;
    const F = mine();
    if (!F) return;
    table ||= findTable();
    if (F.konfetti > 0) F.konfetti -= dt;
    const tAbs = abs(A.game), over = tAbs >= F.slut;
    for (const q of F.gaster) {
      q.t += dt;
      if (q.state === 'vantar') {
        if (over) continue;
        if (t >= q.in) { const d = doorPt(); q.x = d.x; q.y = d.y; q.state = 'kommer'; const [x, y] = spot(F, q); go(q, x, y); play('door'); }
        continue;
      }
      if (q.state === 'borta') continue;
      if (over && q.state !== 'gar') {
        q.state = 'gar'; const d = doorPt(); go(q, d.x, d.y);
        // något blir kvar på golvet
        if (Math.random() < 0.85) F.mess = [...(F.mess || []), { x: Math.round(q.x + (Math.random() - 0.5) * 10), y: Math.round(q.y + 2), k: ['mugg', 'pase', 'konfetti', 'tallrik'][Math.floor(Math.random() * 4)] }];
      }
      // gå längs vägen
      if (q.path.length) {
        const [gx, gy] = q.path[0], dx = gx - q.x, dy = gy - q.y, dist = Math.hypot(dx, dy), step = 42 * dt;
        q.dir = Math.abs(dx) > Math.abs(dy) * 1.2 ? (dx < 0 ? 'left' : 'right') : dy < 0 ? 'up' : 'down';
        if (dist <= step) { q.x = gx; q.y = gy; q.path.shift(); } else { q.x += dx / dist * step; q.y += dy / dist * step; }
        if (!q.path.length) {
          if (q.state === 'gar') { q.state = 'borta'; play('door'); continue; }
          if (q.state === 'mat') { q.wait = 2.5 + Math.random() * 2; q.dir = 'up'; }
          else { q.state = 'dans'; q.wait = 6 + Math.random() * 8; }
        }
        continue;
      }
      q.wait -= dt;
      if (q.wait <= 0 && q.state !== 'gar') {
        if (Math.random() < 0.3 && table) { q.state = 'mat'; go(q, table.x + (Math.random() < 0.5 ? -10 : 10), table.y + 8); }
        else { q.state = 'dans'; const [x, y] = spot(F, q); go(q, x, y); }
      }
    }
    // någon säger något då och då
    pratT -= dt;
    if (pratT <= 0) {
      pratT = 3.5 + Math.random() * 4;
      const here = F.gaster.filter((q) => q.state === 'dans' && !q.path.length);
      const q = here[Math.floor(Math.random() * here.length)];
      if (q) talk.say(PRAT[Math.floor(Math.random() * PRAT.length)], () => ({ x: q.x, y: q.y - 44 }), 2.6, { voice: q.look });
    }
    if (over && F.gaster.every((q) => q.state === 'borta' || q.state === 'vantar')) endFest(A);
  }

  // ---- ritning
  const beat = () => Math.floor(t / 0.47);
  function guestDrawables() {
    const F = mine();
    const out = [];
    if (F) {
      for (const q of F.gaster) {
        if (q.state === 'vantar' || q.state === 'borta') continue;
        out.push({ fy: q.y, draw: (ctx) => {
          if (q.path.length) { drawPerson(ctx, q.x, q.y, q.look, q.dir, WALK_SEQ[Math.floor(q.t * 8.5) % 4]); return; }
          if (q.state === 'mat') { drawPerson(ctx, q.x, q.y, q.look, 'up', 0); return; }
          // dansen: i takt med låten (128 bpm), åt olika håll och med armarna (gångstegen)
          const b = beat() + (q.namn.length % 4);
          const dir = ['left', 'down', 'right', 'down'][b % 4];
          drawPerson(ctx, q.x, q.y - (b % 2), q.look, dir, [1, 3, 2, 4][b % 4]);
        } });
      }
      if (table) out.push({ fy: table.y, draw: (ctx) => drawTable(ctx, table.x, table.y, F.mat) });
    }
    for (const m of A.festMess?.[key] || []) out.push({ fy: m.y - 2, draw: (ctx) => drawMess(ctx, m) });
    for (const m of F?.mess || []) out.push({ fy: m.y - 2, draw: (ctx) => drawMess(ctx, m) });
    return out;
  }
  // pyntet på väggen (ritas bakom möblerna)
  function drawWall(ctx) {
    const R = geo.right;
    // girlanden: hänger i bågar mellan spikarna, vimplar i färg
    const COL = ['#d9433b', '#f0b429', '#46a35a', '#3a7bd5', '#c65fa0', '#2aa39a'];
    for (let x0 = 4, k = 0; x0 < R - 8; x0 += 56) {
      const x1 = Math.min(R - 4, x0 + 56);
      for (let x = x0; x <= x1; x++) {
        const u = (x - x0) / (x1 - x0), y = Math.round(8 + Math.sin(u * Math.PI) * 7);
        ctx.fillStyle = '#5a4a3a'; ctx.fillRect(x, y, 1, 1);
        if ((x - x0) % 7 === 3) { ctx.fillStyle = COL[k++ % COL.length]; for (let j = 0; j < 5; j++) ctx.fillRect(x - 2 + Math.floor(j / 2), y + 1 + j, 5 - Math.floor(j / 2) * 2, 1); }
      }
    }
    // ballongerna i hörnen (de gungar lite)
    for (const [bx, cols] of [[12, ['#d9433b', '#f0b429', '#3a7bd5']], [R - 16, ['#c65fa0', '#46a35a', '#f0b429']]]) {
      cols.forEach((c, i) => {
        const x = bx + (i - 1) * 6, y = 34 + (i === 1 ? -6 : 0) + Math.round(Math.sin(t * 1.4 + i) * 1.2);
        ctx.fillStyle = '#e8e4da'; for (let j = 0; j < 18; j++) ctx.fillRect(x + 2 + Math.round(Math.sin(j / 3 + i) * 0.8), y + 8 + j, 1, 1);
        ctx.fillStyle = c; ctx.fillRect(x, y + 1, 6, 6); ctx.fillRect(x + 1, y, 4, 8);
        ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.fillRect(x + 1, y + 1, 2, 2);
        ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(x + 4, y + 5, 2, 2);
      });
    }
    // discokulan i taket
    const cx = Math.round(R / 2);
    ctx.fillStyle = '#5a5a62'; ctx.fillRect(cx, 0, 1, 10);
    for (let j = -4; j <= 4; j++) for (let i = -4; i <= 4; i++) {
      if (i * i + j * j > 18) continue;
      const lit = ((i + j + beat()) & 3) === 0;
      ctx.fillStyle = lit ? '#ffffff' : ((i + j) & 1 ? '#b8bcc6' : '#8a8e98');
      ctx.fillRect(cx + i, 14 + j, 1, 1);
    }
  }
  // ljusprickarna från discokulan och konfettin (ritas ovanpå allt)
  function drawLight(ctx, night) {
    const R = geo.right, cx = R / 2, F = mine();
    const a = night ? 0.5 : 0.22;
    const COL = ['255,80,80', '255,210,60', '80,220,120', '90,150,255', '230,110,220'];
    for (let k = 0; k < 14; k++) {
      const ang = t * 0.9 + k * 0.45, r = 30 + (k % 5) * 26;
      const x = Math.round(cx + Math.cos(ang) * r * 1.4), y = Math.round(geo.wallY * 0.6 + Math.sin(ang) * r * 0.55 + (k % 3) * 22);
      if (x < 0 || x > R) continue;
      ctx.fillStyle = `rgba(${COL[k % COL.length]},${a})`;
      ctx.fillRect(x - 3, y - 1, 7, 3); ctx.fillRect(x - 2, y - 2, 5, 5); ctx.fillRect(x - 1, y - 3, 3, 7);
    }
    if (F && F.konfetti > 0) {
      for (let k = 0; k < 40; k++) {
        const x = (k * 37 + Math.floor(t * 20) * (k % 3 + 1)) % R, y = ((k * 53) % 60) + (2.5 - F.konfetti) * 70;
        ctx.fillStyle = ['#d9433b', '#f0b429', '#46a35a', '#3a7bd5', '#c65fa0'][k % 5];
        ctx.fillRect(Math.round(x), Math.round(y), 2, 1);
      }
    }
  }
  // klick: städa skräp (gå dit) eller prata med en gäst
  function down(x, y) {
    const list = A.festMess?.[key] || [];
    const m = list.find((q) => Math.abs(q.x - x) <= 6 && Math.abs(q.y - 2 - y) <= 6);
    if (m && !geo.visit) return { go: [m.x, m.y + 4], act: () => {
      const L = A.festMess[key], i = L.indexOf(m);
      if (i < 0) return;
      L.splice(i, 1); A.game.passTime(1); play('click');
      if (!L.length) { delete A.festMess[key]; const h = A.game.glad(1, '', 'stada', 2); toast(`${$t('✨ Rent och fint igen!')}${h ? ` +${h} 😊` : ''}`, 'good'); }
    } };
    const F = mine();
    const q = F?.gaster.find((g2) => (g2.state === 'dans' || g2.state === 'mat') && Math.abs(g2.x - x) <= 8 && y >= g2.y - 34 && y <= g2.y + 2);
    if (q) return { go: [q.x + (q.x > x ? -14 : 14), q.y + 2], act: () => { talk.say(`${$t`Hej! Jag heter ${q.namn}.`} ${PRAT[Math.floor(Math.random() * PRAT.length)]}`, () => ({ x: q.x, y: q.y - 44 }), 3, { voice: q.look }); const h = A.game.glad(1, '', 'festprat', 3); if (h) toast(`😊 +${h}`); } };
    return null;
  }
  return {
    update, drawables: guestDrawables, drawWall, drawLight, down,
    drawTalk: (ctx) => talk.draw(ctx),
    debug: () => { const F = mine(); return { on: !!F, gaster: F ? F.gaster.map((q) => q.state) : [], mess: (A.festMess?.[key] || []).length + (F?.mess?.length || 0), table: table ? { ...table } : null }; },
    messAt: () => (A.festMess?.[key] || []).map((m) => ({ x: m.x, y: m.y })),
    exit: () => talk.clear(),
  };
}

// festbordet: duk, festmaten (chips/pizza/tårta) och muggar
function drawTable(ctx, x, y, mat) {
  ctx.fillStyle = 'rgba(20,12,28,.22)'; ctx.fillRect(x - 15, y - 1, 30, 3);
  ctx.fillStyle = '#6a4424'; ctx.fillRect(x - 13, y - 9, 2, 9); ctx.fillRect(x + 11, y - 9, 2, 9);
  ctx.fillStyle = '#f4f1ea'; ctx.fillRect(x - 15, y - 12, 30, 5);
  ctx.fillStyle = '#d9433b'; for (let i = -15; i < 15; i += 4) ctx.fillRect(x + i, y - 8, 2, 1);
  ctx.fillStyle = '#e8e4da'; ctx.fillRect(x - 15, y - 12, 30, 1);
  // muggarna
  ['#3a7bd5', '#d9433b', '#f0b429'].forEach((c, i) => { ctx.fillStyle = c; ctx.fillRect(x - 13 + i * 4, y - 16, 3, 4); ctx.fillStyle = '#ffffff'; ctx.fillRect(x - 13 + i * 4, y - 16, 3, 1); });
  // skålen med chips
  ctx.fillStyle = '#c83a32'; ctx.fillRect(x - 1, y - 15, 8, 3); ctx.fillStyle = '#f0c040'; ctx.fillRect(x, y - 17, 6, 2); ctx.fillRect(x + 2, y - 18, 2, 1);
  if (mat !== 'chips') { ctx.fillStyle = '#e8b060'; ctx.fillRect(x + 8, y - 15, 7, 3); ctx.fillStyle = '#d84a3a'; ctx.fillRect(x + 9, y - 15, 2, 1); ctx.fillRect(x + 12, y - 14, 2, 1); ctx.fillStyle = '#f4e0a0'; ctx.fillRect(x + 10, y - 14, 1, 1); }
  if (mat === 'tarta') { ctx.fillStyle = '#f4d0e0'; ctx.fillRect(x - 6, y - 21, 9, 5); ctx.fillStyle = '#c65fa0'; ctx.fillRect(x - 6, y - 21, 9, 1); ctx.fillStyle = '#ffd23f'; ctx.fillRect(x - 3, y - 24, 1, 3); ctx.fillRect(x + 1, y - 24, 1, 3); ctx.fillStyle = '#ff8a3a'; ctx.fillRect(x - 3, y - 25, 1, 1); ctx.fillRect(x + 1, y - 25, 1, 1); }
}
// skräpet på golvet (med mörk kontur så att det syns och går att klicka på)
const MESS = {
  mugg: ['.##.', '#rr#', '#rw#', '#rr#', '.##.'],
  pase: ['.####.', '#yyyy#', '#ybby#', '#yyyy#', '.####.'],
  tallrik: ['.######.', '#wwwwww#', '#wrwwow#', '.######.'],
  konfetti: ['r..y.g...', '..b...r.y', 'g..p.b...', '..y...g.p'],
};
const MESS_COL = { '#': '#2a2430', r: '#d9433b', w: '#f4f1ea', y: '#f0b429', b: '#3a7bd5', g: '#46a35a', p: '#c65fa0', o: '#e8a040' };
function drawMess(ctx, m) {
  const rows = MESS[m.k] || MESS.konfetti, h = rows.length, w = rows[0].length;
  const x0 = Math.round(m.x - w / 2), y0 = Math.round(m.y - h);
  rows.forEach((row, j) => { for (let i = 0; i < row.length; i++) { const c = MESS_COL[row[i]]; if (!c) continue; ctx.fillStyle = c; ctx.fillRect(x0 + i, y0 + j, 1, 1); } });
}
