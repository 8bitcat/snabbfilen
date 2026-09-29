// Husdjuren UTE: promenaden i staden (js/scenes/city.js). Djuren som är ute
// (petStore().walking() – hunden i koppel, katt/kanin som fått följa med) går bredvid
// figuren med createPetFollower, och simuleringen tickar med spelklockan medan man är
// ute (outdoors) – då räknas promenaden (outMin), hunden stannar och gör sitt på
// trottoaren (följaren anropar store.outdoorBusiness) och ett djur som glömts ute i
// över 6 speltimmar går hem självt. Hemma sköter lagret (layer.js) samma sak.
//
// const P = createPetWalk(A);                  // en gång när stadsscenen byggs
//   P.update(dt, ownerX, ownerY, isFree, { hidden })   – varje bildruta
//       isFree(x, y) = stadens gångbarhet (walker.walkable), hidden = figuren syns inte
//       (sitter på bussen) → djuren syns inte heller och gör inte sitt.
//   P.drawables()  → [{ x, y, fy, draw(ctx) }] i stadens världskoordinater (y = fy = fotlinjen)
//   P.count        – antal djur ute just nu
//
// Tiden man varit borta innan staden visas (butik, jobbpass, buss) tickas ikapp som
// "inte ute" när P skapas – annars skulle ett åtta timmars jobbpass räknas som promenad.
// Toasts (🌳 gjorde sitt ute, 🏠 gick hem själv) visas bara medan staden faktiskt visas.
// I huvudmenyns bakgrundsstad (A.attract) rörs inte butiken alls – den stadens klocka
// hör inte till spelarens spel och får aldrig nollställa djuren.
import { petStore } from './sim.js';
import { createPetFollower, SPECIES_EMO } from './layer.js';
import { toast } from '../core/ui.js';
import { play } from '../core/sound.js';

const JUMP = 48;          // figuren flyttades längre än så på en bildruta (buss, teleport) → djuret ställs om bakom den
const EMO = { ute: '🌳', hem: '🏠' };
let activeAt = -1e9;      // performance.now() när staden senast tickade djuren
const hooked = new WeakSet();

function hookToasts(S) {
  if (hooked.has(S)) return;
  hooked.add(S);
  S.listen((ev) => {
    if (performance.now() - activeAt > 600) return; // staden visas inte – hemma sköter lagret sina toasts
    // Djuret som går bredvid dig växte just (promenaden gav de sista tillväxtpoängen): visa det
    // här. Djur som är hemma får sin toast och pratbubbla när du kommer hem (lagret).
    if (ev.type === 'vaxte') {
      if (!S.petById(ev.petId)?.out) return;
      toast(`${SPECIES_EMO[ev.species] || '🌱'} ${ev.text}`, 'good');
      try { play('fanfare'); } catch { /* ljudet är aldrig ett krav */ }
      S.seenNews?.(ev);
      return;
    }
    if (!EMO[ev.type]) return;
    toast(`${EMO[ev.type]} ${ev.text}`, ev.type === 'ute' ? 'good' : '');
  });
}

export function createPetWalk(A, { store = null } = {}) {
  const off = !!A.attract || !A.game;
  const S = off ? null : store || petStore();
  const followers = new Map(); // petId → följaren
  let lastX = null, lastY = null, wasHidden = false;
  const clockCtx = (outdoors, followerHandlesBusiness) => ({ home: A.game.home, playerHome: null, playerRoom: null, outdoors, followerHandlesBusiness });
  if (S) {
    hookToasts(S);
    activeAt = performance.now();
    // tiden sedan senaste synk (butiken, jobbet, bussen): borta men inte på promenad
    try { S.syncTo(A.game.day, A.game.min, clockCtx(false, false)); } catch (e) { console.error('husdjuren: synken i staden', e); }
  }
  const P = {
    get count() { return followers.size; },
    update(dt, ownerX, ownerY, isFree, { hidden = false } = {}) {
      if (!S || A.attract) return;
      activeAt = performance.now();
      const walking = S.walking();
      // simuleringen: ute räknas som promenad (utom på bussen) – följaren sköter hundens ärende
      // när den syns, annars får simuleringen göra det själv
      try { S.syncTo(A.game.day, A.game.min, clockCtx(!hidden, !hidden && walking.length > 0)); } catch (e) { console.error('husdjuren: synken i staden', e); }
      const jumped = lastX != null && Math.hypot(ownerX - lastX, ownerY - lastY) > JUMP;
      lastX = ownerX; lastY = ownerY;
      const now = S.walking();
      const ids = new Set(now.map((p) => p.id));
      for (const id of [...followers.keys()]) if (!ids.has(id)) followers.delete(id); // gick hem självt / kopplet av
      if (hidden) { wasHidden = true; return; }
      for (const p of now) {
        const F = followers.get(p.id);
        // nytt djur ute, ett nytt djurobjekt (butiken laddades om) eller figuren hoppade → ställ djuret bakom figuren
        if (!F || F.pet !== p || jumped || wasHidden) followers.set(p.id, createPetFollower(A, p, { store: S }));
      }
      wasHidden = false;
      for (const F of followers.values()) F.update(dt, ownerX, ownerY, isFree);
    },
    drawables() {
      if (!S || wasHidden) return [];
      const out = [];
      for (const F of followers.values()) { if (F.x != null) out.push(F.drawable()); }
      return out;
    },
    _debug: { followers: () => [...followers.values()].map((F) => ({ id: F.pet.id, name: F.pet.name, x: F.x, y: F.y, anim: F.anim, dir: F.dir })) },
  };
  return P;
}
