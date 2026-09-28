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
onJob((ev) => { CUR?._recv(ev); });

export function makeShiftCoop(A, key) {
  const started = Date.now();
  const mates = new Map(); // id → { start } (bara de som hälsat räknas i ledarvalet)
  const handlers = {};
  let helloAt = 0;
  const c = {
    key,
    get myId() { return worldMyId(); },
    // kollegorna: alla på samma ställe enligt världen (syns även som figurer i scenen)
    peers() { return worldFolksHere(A); },
    get active() { return !!this.myId && this.peers().length > 0; },
    // stabilt ledarval: äldst i scenen leder; nykomlingar tar ALDRIG över ett pågående skift
    get leader() {
      if (!this.active) return true;
      for (const f of this.peers()) {
        const m = mates.get(f.id);
        if (!m) continue; // har inte hälsat än – räknas inte förrän vi vet starttiden
        if (m.start < started || (m.start === started && f.id < this.myId)) return false;
      }
      return true;
    },
    // nykomling: vänta in första hälsningen (max 2,5 s) innan egen simulering startas,
    // så att två inte kör var sin värld under anslutningsögonblicket
    get settled() { return mates.size > 0 || Date.now() - started > 2500; },
    on(t, cb) { handlers[t] = cb; },
    send(m) { return sendJob({ k: key, ...m }); },
    tick() {
      const now = Date.now();
      if (now - helloAt > 2000) { helloAt = now; this.send({ t: 'hej', start: started }); }
      const here = new Set(this.peers().map((f) => f.id));
      for (const id of [...mates.keys()]) if (!here.has(id)) mates.delete(id);
    },
    _recv({ from, m }) {
      if (!m || m.k !== key || !from) return;
      if (m.t === 'hej') {
        const old = mates.get(from);
        mates.set(from, { start: Math.min(+m.start || Date.now(), old ? old.start : Infinity) });
        if (!old) this.send({ t: 'hej', start: started }); // svara direkt så nya genast ser vem som leder
        return;
      }
      handlers[m.t]?.(m, from);
    },
    dispose() { if (CUR === c) CUR = null; },
  };
  CUR = c;
  return c;
}
