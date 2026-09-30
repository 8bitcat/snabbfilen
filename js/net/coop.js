// JOBBA TILLSAMMANS – ett tunt lager ovanpå jobbkanalen i world.js.
// En delar ut arbetet: SKIFTLEDAREN är den som varit längst i scenen (senioritet;
// vid lika starttid vinner lägst id) och kör hela simuleringen. Alla andra är
// MEDARBETARE: de ser ledarens läge (snap-meddelanden) och skickar sina
// handlingar som önskemål (take/put/swap/serve) som ledaren avgör. Solo eller
// offline = alltid ledare, exakt som förut – noll skillnad utan sällskap.
//
// Protokollet (alla meddelanden får { k: platsnyckeln } av send()):
//   { t: 'hej', start }  – jag är här, började då; skickas var 2 s + som svar på nya
//   { t: 'snap', ... }   – ledarens läge (scenen definierar innehållet)
//   { t: '<önskemål>' }  – medarbetare → ledaren (scenen definierar)
//   { t: 'res', by, ... }– ledarens svar/utfall; 'by' = vems handling det gällde
import { sendJob, onJob, worldFolksHere, worldMyId } from './world.js';

let CUR = null;
let inviteCb = null;
onJob((ev) => {
  if (ev?.m?.k === 'invite') { inviteCb?.(ev.m, ev.from); return; }
  CUR?._recv(ev);
});

// 💼 Jobbinbjudningar: skickas till EN spelare (to), oavsett var hen är i staden. sid = det
// gemensamma passets id (bara de med samma sid ser varandra i jobbet), len/lvl = passets längd
// och nivå – den som bjuder in bestämmer.
export const onInvite = (cb) => { inviteCb = cb; };
export const sendInvite = (toId, job, namn, { sid = '', len = 'vanligt', lvl = 1 } = {}) => sendJob({
  k: 'invite', to: String(toId), job: String(job), namn: String(namn || '').slice(0, 16),
  sid: String(sid).replace(/[^a-z0-9]/g, '').slice(0, 12), len: len === 'langt' ? 'langt' : 'vanligt', lvl: Math.max(1, Math.min(5, lvl | 0 || 1)),
});

// base = jobbets nyckel ('away:jobbburgare'); passets id (A.coop.sid, js/jobs/shift.js) läggs
// till – två par som jobbar ihop på samma ställe samtidigt hör aldrig varandras meddelanden.
// (Id:t kan komma till mitt i passet: bjuder man in via 👥 blir ett ensamt pass gemensamt.)
export function makeShiftCoop(A, base) {
  const started = Date.now();
  const mates = new Map(); // id → { start, slut, seen } (bara de som hälsat räknas i ledarvalet)
  const handlers = {};
  let helloAt = 0;
  let resigned = false; // mitt pass är slut – jag leder aldrig mer i detta skift
  const lastSnap = { id: null, t: 0 }; // vem som senast KÖRDE världen (aktiv ledare har företräde)
  const c = {
    get key() { return base + (A.coop?.sid ? '.' + A.coop.sid : ''); },
    get myId() { return worldMyId(); },
    // kollegorna: alla på samma ställe enligt världen (syns även som figurer i scenen)
    peers() { return worldFolksHere(A); },
    get active() { return !!this.myId && this.peers().length > 0; },
    // Ledarval i tre steg: (1) en AKTIV ledare (färsk snap) har alltid företräde –
    // en väckt gammal ledare lägger sig direkt; (2) den vars pass är slut (resign)
    // leder aldrig mer; (3) annars senioritet – äldst i scenen, som tystnat < 6 s.
    get leader() {
      if (!this.active) return true;
      if (resigned) return false;
      const now = Date.now();
      if (lastSnap.id && lastSnap.id !== this.myId && now - lastSnap.t < 4000) return false;
      for (const f of this.peers()) {
        const m = mates.get(f.id);
        if (!m || m.slut) continue; // ohälsad eller färdigjobbad räknas inte
        if (now - m.seen > 6000) continue; // tystnad (somnad mobil?) räknas inte
        if (m.start < started || (m.start === started && f.id < this.myId)) return false;
      }
      return true;
    },
    // passet är slut för mig: lämna över ledningen omedelbart och berätta det
    resign() {
      if (resigned) return;
      resigned = true;
      this.send({ t: 'hej', start: started, slut: 1 });
    },
    // scenen märker varje snap jag skickar, så företrädet blir mitt
    sentSnap() { lastSnap.id = this.myId; lastSnap.t = Date.now(); },
    // nykomling: vänta in första hälsningen (max 2,5 s) innan egen simulering startas,
    // så att två inte kör var sin värld under anslutningsögonblicket
    get settled() { return mates.size > 0 || Date.now() - started > 2500; },
    on(t, cb) { handlers[t] = cb; },
    send(m) { return sendJob({ k: this.key, ...m }); },
    tick() {
      const now = Date.now();
      if (now - helloAt > 2000) { helloAt = now; this.send({ t: 'hej', start: started, slut: resigned ? 1 : 0 }); }
      const here = new Set(this.peers().map((f) => f.id));
      for (const id of [...mates.keys()]) if (!here.has(id)) mates.delete(id);
    },
    _recv({ from, m }) {
      if (!m || m.k !== this.key || !from) return;
      if (m.t === 'hej') {
        const old = mates.get(from);
        mates.set(from, { start: Math.min(+m.start || Date.now(), old ? old.start : Infinity), slut: m.slut ? 1 : old?.slut || 0, seen: Date.now() });
        if (!old) this.send({ t: 'hej', start: started, slut: resigned ? 1 : 0 }); // svara direkt så nya ser vem som leder
        return;
      }
      if (m.t === 'snap') { lastSnap.id = from; lastSnap.t = Date.now(); } // aktiv ledare noteras
      handlers[m.t]?.(m, from);
    },
    dispose() { if (CUR === c) CUR = null; },
  };
  CUR = c;
  return c;
}
