// 🔥 Brasan och marshmallows (julvåningen, Carl 2026-10-06: "en eld att ha, så man kan grilla
// marshmallows"). Alla spisar hemma har en brasa man kan tända och släcka (d.lit sparas på
// möbeln i g.deco – lågorna ritas av room.js), och vid en tänd brasa – eller vid brasan på
// klädaffärens julvåning – grillar man marshmallows i ett litet spel:
//   håll marshmallowen i elden → den går från vit till gyllene, gyllenbrun, mörk … och fattar
//   eld om man väntar för länge (då blåser man ut den). Ät när den är som godast!
// Gyllenbrun ger mest lycka (högst 10 om dagen från marshmallows) och lite mättnad.
import { openModal, closeModal, toast } from './ui.js';
import { play } from './sound.js';

// ---------- brasan hemma ----------
// d = spisen i g.deco (samma objekt som rummet ritar), onChange = rita om / spara
export function openBrasa(A, d, { onChange } = {}) {
  const g = A.game;
  const set = (lit) => { d.lit = lit || undefined; if (!lit) delete d.lit; g.save(); onChange?.(); };
  if (!d.lit) {
    openModal('🔥 Brasan', '<p style="font-size:var(--f2);margin-top:0">Ska du tända en brasa? Det blir varmt och mysigt – och vid brasan kan du grilla marshmallows.</p>', [
      { label: 'Stäng', onClick: closeModal },
      { label: '🔥 Tänd brasan', cls: 'btn-go', onClick: () => {
        closeModal(); set(true); play('ok');
        const d2 = g.glad(2, '', 'brasa', 2);
        toast(`🔥 Det sprakar i brasan!${d2 ? ' Mysigt: +' + d2 + ' lycka' : ''}`, 'good');
      } },
    ]);
    return;
  }
  openModal('🔥 Brasan brinner', '<p style="font-size:var(--f2);margin-top:0">Det sprakar och är varmt. Vill du grilla marshmallows?</p>', [
    { label: '💨 Släck brasan', onClick: () => { closeModal(); set(false); play('slide'); toast('💨 Brasan är släckt.'); } },
    { label: 'Stäng', onClick: closeModal },
    { label: '🍡 Grilla marshmallows', cls: 'btn-go', onClick: () => openMarshmallow(A) },
  ]);
}

// ---------- marshmallowspelet ----------
const W = 128, H = 80;
const FIRE = { x: 64, y: 70 };            // brasans mitt vid veden
const IN = [62, 40], OUT = [96, 24];      // marshmallowens plats i elden / uttagen
// rostningen: 0 vit … 0,6–0,85 gyllenbrun (perfekt) … 1 mörk – över 1 fattar den eld
const STEG = [
  [0.25, 'Vit och kall', '#f4f1ea', '#d2cfc6'],
  [0.6, 'Ljust gyllene', '#f8dfa0', '#d8b070'],
  [0.85, 'GYLLENBRUN!', '#d8963c', '#9a5a1e'],
  [1.0, 'Mörkbrun', '#8a4a1e', '#5a2a10'],
  [9, 'Bränd', '#2a1a14', '#140c0a'],
];
const stegOf = (lv) => STEG.find((s) => lv < s[0]) || STEG[STEG.length - 1];
export const BETYG = (lv, brann) => {
  if (brann || lv >= 1.0) return { txt: 'Bränd … 😬 Den smakade kol – men lite god ändå.', glad: 1, ljud: 'fel' };
  if (lv >= 0.85) return { txt: 'Mörk och knaprig – gott! 😋', glad: 3, ljud: 'ok' };
  if (lv >= 0.6) return { txt: 'PERFEKT gyllenbrun! 🤩 Krispig utanpå, kladdig inuti.', glad: 5, ljud: 'fanfare' };
  if (lv >= 0.25) return { txt: 'Ljust gyllene – mums! 😊', glad: 3, ljud: 'ok' };
  return { txt: 'Inte varm än … men god ändå! 🙂', glad: 1, ljud: 'click' };
};

export function openMarshmallow(A, { title = '🍡 Grilla marshmallows' } = {}) {
  const g = A.game;
  const st = { lv: 0, inFire: false, burning: false, burnT: 0, x: OUT[0], y: OUT[1], t: 0, eaten: 0, perfect: 0, gladSum: 0, done: false };
  const dlg = openModal(title, `
    <div class="mm">
      <canvas class="mm-cv" width="${W}" height="${H}" style="width:100%;max-width:512px;aspect-ratio:${W}/${H};image-rendering:pixelated;display:block;margin:0 auto;background:#120c16;border:3px solid #17151a"></canvas>
      <p class="mm-status" style="font-size:var(--f2);margin:8px 0 0;text-align:center"></p>
      <p class="mm-tips" style="font-size:var(--f1);margin:4px 0 0;text-align:center;opacity:.8">Håll marshmallowen i elden tills den är gyllenbrun – men akta så den inte fattar eld!</p>
    </div>`, [
    { label: '🔥 Håll i elden', cls: 'btn-gold mm-hold', onClick: () => toggle() },
    { label: '💨 Blås!', cls: 'btn-red mm-blow', onClick: () => blow() },
    { label: '😋 Ät!', cls: 'btn-go mm-eat', onClick: () => eat() },
    { label: 'Klar', cls: 'mm-klar', onClick: () => stop() },
  ]);
  const cv = dlg.querySelector('.mm-cv'), ctx = cv.getContext('2d');
  const status = dlg.querySelector('.mm-status');
  const holdB = dlg.querySelector('.mm-hold'), blowB = dlg.querySelector('.mm-blow'), eatB = dlg.querySelector('.mm-eat');
  const xBtn = dlg.querySelector('[data-close]');
  if (xBtn) xBtn.onclick = () => stop();
  function toggle() {
    if (st.burning) { blow(); return; }
    st.inFire = !st.inFire; play('click');
  }
  function blow() {
    if (!st.burning) return;
    st.burning = false; st.inFire = false; play('slide');
    toast('💨 Pust! Elden är släckt.');
  }
  function eat() {
    if (st.burning) { toast('🔥 Den brinner! Blås först!', 'bad'); play('fel'); return; }
    const b = BETYG(st.lv, st.lv >= 1.0);
    const d = g.glad(b.glad, '', 'marshmallow', 10);
    g.hunger = Math.min(100, (g.hunger || 0) + 3);
    st.eaten++; st.gladSum += d; if (st.lv >= 0.6 && st.lv < 0.85) st.perfect++;
    play(b.ljud);
    toast(`🍡 ${b.txt}${d ? ` +${d} lycka` : ''}`, b.glad >= 3 ? 'good' : '');
    g.save();
    // en ny vit marshmallow på pinnen
    st.lv = 0; st.inFire = false; st.burnT = 0;
  }
  function stop() {
    st.done = true;
    if (A.marshmallow === api) A.marshmallow = null;
    closeModal();
    if (st.eaten) toast(`🍡 Du åt ${st.eaten} marshmallow${st.eaten === 1 ? '' : 's'}${st.perfect ? ` – ${st.perfect} perfekt gyllenbrun${st.perfect === 1 ? '' : 'a'}!` : '.'}`, 'good');
  }
  // testerna (och felsökningen) når spelet via A.marshmallow
  const api = { get lv() { return st.lv; }, set lv(v) { st.lv = v; }, get burning() { return st.burning; }, get inFire() { return st.inFire; }, get eaten() { return st.eaten; }, get perfect() { return st.perfect; }, toggle, blow, eat, stop };
  A.marshmallow = api;

  let last = performance.now();
  function frame(now) {
    if (st.done || !cv.isConnected) { if (A.marshmallow === api) A.marshmallow = null; return; }
    const dt = Math.min(0.1, (now - last) / 1000); last = now;
    st.t += dt;
    // marshmallowen glider in i / ut ur elden
    const [tx, ty] = st.inFire || st.burning ? IN : OUT;
    st.x += (tx - st.x) * Math.min(1, dt * 7); st.y += (ty - st.y) * Math.min(1, dt * 7);
    const deep = Math.hypot(st.x - IN[0], st.y - IN[1]) < 4;
    if (deep) st.lv += dt * 0.2;
    if (st.burning) { st.lv += dt * 0.35; st.burnT += dt; }
    else if (st.lv >= 1.0 && deep && !st.burning && st.lv < 1.35) { st.burning = true; st.burnT = 0; play('fel'); }
    if (st.burning && st.lv >= 1.4) { st.burning = false; st.inFire = false; } // brann ut av sig själv
    draw();
    const s = stegOf(st.lv);
    status.textContent = st.burning ? '🔥 DEN BRINNER! Blås!' : `${s[1]}${st.inFire ? ' – i elden …' : ''}`;
    status.style.color = st.burning ? '#d9433b' : st.lv >= 0.6 && st.lv < 0.85 ? '#2f8f46' : '';
    holdB.innerHTML = st.inFire ? '↩ Ta ut ur elden' : '🔥 Håll i elden';
    blowB.style.display = st.burning ? '' : 'none';
    eatB.disabled = st.burning;
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // ---- ritningen: natt, brasan med lågor och gnistor, pinnen och marshmallowen ----
  const R = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(x | 0, y | 0, w, h); };
  function halo(cx, cy, rx, ry, c, a) {
    ctx.globalAlpha = a; ctx.fillStyle = c;
    for (let y = -ry; y <= ry; y++) { const w = Math.round(rx * Math.sqrt(1 - (y / ry) ** 2)); ctx.fillRect(cx - w, cy + y, w * 2, 1); }
    ctx.globalAlpha = 1;
  }
  function draw() {
    const t = st.t;
    // himlen och marken
    for (let y = 0; y < H; y++) R(0, y, W, 1, y < 58 ? (y % 2 ? '#1a1228' : '#1c1430') : '#2a1e1a');
    for (const [sx, sy] of [[10, 8], [30, 16], [52, 6], [88, 12], [110, 7], [120, 20], [20, 30], [100, 34]]) R(sx, sy, 1, 1, Math.sin(t * 2 + sx) > 0.3 ? '#f4f1ea' : '#8a8aa8');
    R(0, 58, W, 1, '#3a2a22');
    halo(FIRE.x, FIRE.y - 8, 46, 22, '#ff9d0e', 0.08);
    halo(FIRE.x, FIRE.y - 6, 28, 14, '#ffc71b', 0.1);
    // stenarna runt elden och veden
    for (let i = 0; i < 9; i++) { const x = FIRE.x - 26 + i * 6; R(x, FIRE.y + 2, 6, 4, '#1c0a18'); R(x + 1, FIRE.y + 2, 4, 3, i % 2 ? '#7a7680' : '#8e8a94'); R(x + 1, FIRE.y + 2, 4, 1, '#b8b4be'); }
    R(FIRE.x - 16, FIRE.y - 2, 32, 5, '#1c0a18'); R(FIRE.x - 15, FIRE.y - 1, 30, 3, '#8a4a22'); R(FIRE.x - 15, FIRE.y - 1, 30, 1, '#b8703a');
    R(FIRE.x - 10, FIRE.y - 5, 22, 4, '#1c0a18'); R(FIRE.x - 9, FIRE.y - 4, 20, 2, '#6a3618'); R(FIRE.x - 9, FIRE.y - 4, 20, 1, '#9a5a2a');
    // lågorna: kolumner som fladdrar (yttre röd, orange, gul, ljus kärna)
    for (let i = -14; i <= 14; i++) {
      const base = FIRE.y - 4;
      const hgt = Math.max(2, (22 - Math.abs(i) * 1.25) * (0.72 + 0.28 * Math.sin(t * 9 + i * 1.7) * Math.sin(t * 5.3 + i * 0.6)));
      const x = FIRE.x + i;
      R(x, base - hgt, 1, hgt, '#c41b24');
      if (hgt > 4) R(x, base - hgt * 0.8, 1, hgt * 0.8, '#ff9d0e');
      if (hgt > 7) R(x, base - hgt * 0.55, 1, hgt * 0.55, '#ffc71b');
      if (hgt > 11 && Math.abs(i) < 6) R(x, base - hgt * 0.3, 1, hgt * 0.3, '#ffeb47');
    }
    // gnistor
    for (let k = 0; k < 6; k++) { const u = (t * 0.7 + k / 6) % 1; R(FIRE.x - 10 + ((k * 37) % 22) + Math.sin(u * 9 + k) * 3, FIRE.y - 20 - u * 34, 1, 1, u < 0.6 ? '#ffeb47' : '#ff9d0e'); }
    // pinnen (från högerkanten till marshmallowen)
    const mx = Math.round(st.x), my = Math.round(st.y);
    const x1 = W + 4, y1 = my + 30;
    const n = Math.max(Math.abs(x1 - mx), Math.abs(y1 - my));
    for (let i = 0; i <= n; i++) { const x = mx + 3 + (x1 - mx - 3) * i / n, y = my + 4 + (y1 - my - 4) * i / n; R(x, y, 1, 2, i % 9 === 0 ? '#5a3418' : '#8a5a2a'); R(x, y + 2, 1, 1, '#1c0a18'); }
    // marshmallowen: liten cylinder 7×8 med kontur, toppglans och rostfärgen
    const s = stegOf(st.lv);
    R(mx - 4, my - 3, 9, 7, '#1c0a18'); R(mx - 3, my - 4, 7, 9, '#1c0a18');   // rundade hörn
    R(mx - 3, my - 3, 7, 7, s[2]);
    R(mx - 3, my + 2, 7, 1, s[3]); R(mx + 2, my - 3, 1, 5, s[3]);
    if (st.lv < 1.0) R(mx - 2, my - 3, 3, 1, st.lv < 0.25 ? '#ffffff' : '#fff4c8');
    // brinner den: små lågor på marshmallowen
    if (st.burning) for (let i = -3; i <= 3; i++) { const h = 3 + Math.round(3 * Math.abs(Math.sin(t * 14 + i))); R(mx + i, my - 4 - h, 1, h, i % 2 ? '#ff9d0e' : '#ffc71b'); }
    // rostmätaren: en list upptill med det perfekta fältet markerat
    R(8, 3, 112, 4, '#1c0a18');
    R(9, 4, 110 * 0.6, 2, '#d8cfbe'); R(9 + 110 * 0.6, 4, 110 * 0.25, 2, '#46a35a'); R(9 + 110 * 0.85, 4, 110 * 0.15, 2, '#9a5a1e');
    const mk = 9 + Math.min(1, st.lv) * 110;
    R(mk - 1, 1, 3, 8, st.burning ? '#d9433b' : '#ffffff');
  }
  return api;
}
