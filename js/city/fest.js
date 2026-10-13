// 🎉 LÖRDAGSFESTEN och 🗽 STATYN I PARKEN – i stadsparken runt torget med fontänen (Carl 2026-10-12:
// "lördagsfest kl. 18 + statyn i parken, veckans vinnare").
//
// STATYN: söder om torget står en guldstaty av veckans SNÄLLASTE – den som skickade flest vänskapspresenter
// förra veckan (servern räknar, server/kbk-push GET /staty). Statyn har vinnarens figur (utseendet följer med
// presenterna) och en mässingsskylt med namnet. Klicka: vem det är, hur många presenter och vem som leder den
// här veckan. Har ingen vunnit än (eller är man offline) står Pixelstadens grundare där.
//
// FESTEN: varje lördag kl. 18–20 (telefonens klocka) är det fest på torget: en scen med DJ, högtalare och
// discoljus, vimplar över torget, konfetti och folk som dansar. Den som är på torget en stund får en FESTPRESENT
// (en stor present i 🎁 Presenter, en gång i veckan) och blir glad. Morgonnotiserna (presenter.js) får sällskap
// av en notis på lördagen kl. 17.45 (notiser.js setExtraNotiser 'fest').
//
// Kontrakt (som odling.js): createFest(env, { game, me }) → { items(), obstacles, update(dt), statyAt(x, y),
//   klickStaty(), _debug }   game() = spelet, me() = { x, y } (figuren i staden)
import { drawPerson, makeLook } from '../core/people.js';
import { SMALL, ctxText, textW, hash, mix } from '../core/floor-pix.js';
import { PARK_LAYOUT } from './map.js';
import { pushGet } from '../net/kbkpush.js';
import { $t } from '../core/i18n.js';

const PL = PARK_LAYOUT.plaza;                                   // { cx 934, cy 366, r 42 }
export const STATY = { x: PL.cx - 50, y: PL.cy + 64 };          // på gräset söder om torget, vid gången mot kyrkan (foodtruckens plats i parken ligger väster om torget)
export const SCEN = { x: PL.cx + 52, y: PL.cy - 30 };           // DJ-scenen nordost om fontänen, på promenaden
// festtiden: lördag 18–20 (testerna sätter window.__festNu)
export const festNu = () => (typeof window !== 'undefined' && window.__festNu ? new Date(window.__festNu) : new Date());
export const arFest = (d = festNu()) => d.getDay() === 6 && d.getHours() >= 18 && d.getHours() < 20;
export function festVecka(d = festNu()) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())), dag = (t.getUTCDay() + 6) % 7;
  t.setUTCDate(t.getUTCDate() - dag + 3);
  const forsta = new Date(Date.UTC(t.getUTCFullYear(), 0, 4));
  return `${t.getUTCFullYear()}-W${String(1 + Math.round(((t - forsta) / 864e5 - 3 + ((forsta.getUTCDay() + 6) % 7)) / 7)).padStart(2, '0')}`;
}
// notiserna: de fyra närmaste lördagarna kl. 17.45 (id 110–113)
export function festNotiser(nu = new Date()) {
  const ut = [];
  const d = new Date(nu); d.setHours(17, 45, 0, 0);
  d.setDate(d.getDate() + ((6 - d.getDay() + 7) % 7));
  if (d <= nu) d.setDate(d.getDate() + 7);
  for (let i = 0; i < 4; i++) { const at = new Date(d); at.setDate(d.getDate() + i * 7); ut.push({ id: 110 + i, title: $t('🎉 Lördagsfest!'), body: $t('Kl. 18 är det fest i stadsparken i Pixelstaden – kom och dansa! Alla som kommer får en festpresent.'), schedule: { at } }); }
  return ut;
}
// grundaren (när ingen har vunnit än)
const GRUNDARE = { skin: '#e0a97f', hair: '#b9b3ab', style: 'side', beard: 'full', glasses: 'round', top: 'jacket', shirt: '#2f3440', accent: '#c9a44a', bottom: 'pants', pants: '#2b2b30', shoes: '#1c1c1c', hat: 'tophat', cap: '#2f3440', phones: false, bag: null, blush: false, build: 5, kid: false };
const DJ = { skin: '#a06a43', hair: '#1d1714', style: 'afro', top: 'hoodie', shirt: '#8e5bd1', accent: '#f0b429', bottom: 'jeans', pants: '#2d3a5c', shoes: '#f2f2f2', glasses: 'sun', beard: false, phones: true, bag: null, hat: null, build: 5, blush: false, kid: false };

// guld: figuren ritas på en egen duk och färgas om efter ljusheten (skugga → mörkt guld, ljus → blankt)
const GULD = [0x5a3e12, 0x8a6420, 0xb88a2e, 0xd8ae48, 0xf4d878, 0xfff2c0];
function guldfigur(look) {
  const c = document.createElement('canvas'); c.width = 24; c.height = 40;
  const g = c.getContext('2d');
  drawPerson(g, 12, 39, look, 'down', 0);
  const im = g.getImageData(0, 0, 24, 40), d = im.data;
  for (let i = 0; i < d.length; i += 4) {
    if (!d[i + 3]) continue;
    const L = (d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11) / 255, x = (i / 4) % 24;
    const k = Math.max(0, Math.min(5, Math.round(L * 4.2 + (x < 11 ? 0.6 : -0.2))));   // ljuset från vänster
    const col = GULD[k];
    d[i] = (col >> 16) & 255; d[i + 1] = (col >> 8) & 255; d[i + 2] = col & 255; d[i + 3] = 255;
  }
  g.putImageData(im, 0, 0);
  return c;
}

export function createFest(env, { game, me } = {}) {
  let t = 0, staty = null, statyBild = null, data = null, ladd = false, paTorget = 0, festTid = 0;
  const dansare = Array.from({ length: 8 }, (_, i) => {
    const a = (i / 8) * Math.PI * 2 + 0.3, r = 30 + (i % 2) * 10;
    return { look: makeLook(() => hash(i, 17, 9)), x: PL.cx + Math.cos(a) * r * 1.3, y: PL.cy + 20 + Math.sin(a) * r * 0.5, fas: hash(i, 3, 3) * 6 };
  });
  const konfetti = Array.from({ length: 40 }, (_, i) => ({ x: PL.cx - 60 + hash(i, 1, 4) * 120, y: PL.cy - 70 + hash(i, 2, 4) * 60, v: 8 + hash(i, 3, 4) * 10, c: ['#d8343c', '#f0b429', '#3a7bd5', '#46a35a', '#e060b0', '#ffffff'][i % 6] }));
  // statyn: hämtas en gång per start (sparas i webbläsaren per vecka så att den syns även offline)
  async function hamta() {
    if (ladd) return; ladd = true;
    const nyckel = 'snabbfilen_staty', v = festVecka();
    try { const c = JSON.parse(localStorage.getItem(nyckel) || 'null'); if (c?.v === v) { data = c.d; } } catch { /* ok */ }
    const r = await pushGet('/staty');
    if (r?.ok) { data = { forra: r.forra || null, nu: r.nu || null }; try { localStorage.setItem(nyckel, JSON.stringify({ v, d: data })); } catch { /* ok */ } }
    staty = data?.forra || null; statyBild = null;
  }
  hamta();
  const statyLook = () => (staty?.look && Object.keys(staty.look).length ? staty.look : GRUNDARE);
  const namn = () => (staty ? String(staty.namn || '?').toUpperCase() : $t('PIXELSTADENS GRUNDARE'));
  function drawStaty(ctx) {
    const { x, y } = STATY;
    if (!statyBild) { try { statyBild = guldfigur(statyLook()); } catch { statyBild = null; } }
    // sockeln: granit i tre steg med mässingsskylt
    ctx.fillStyle = 'rgba(20,12,30,.28)'; ctx.fillRect(x - 13, y - 1, 26, 4);
    ctx.fillStyle = '#7a7a82'; ctx.fillRect(x - 12, y - 4, 24, 4); ctx.fillStyle = '#9a9aa2'; ctx.fillRect(x - 12, y - 4, 24, 1);
    ctx.fillStyle = '#8a8a92'; ctx.fillRect(x - 9, y - 16, 18, 12); ctx.fillStyle = '#b0b0b8'; ctx.fillRect(x - 9, y - 16, 18, 2); ctx.fillStyle = '#6a6a72'; ctx.fillRect(x + 6, y - 14, 3, 10);
    ctx.fillStyle = '#9a9aa2'; ctx.fillRect(x - 10, y - 19, 20, 3); ctx.fillStyle = '#c8c8d0'; ctx.fillRect(x - 10, y - 19, 20, 1);
    ctx.fillStyle = '#c8a040'; ctx.fillRect(x - 6, y - 12, 12, 5); ctx.fillStyle = '#e8c860'; ctx.fillRect(x - 6, y - 12, 12, 1); ctx.fillStyle = '#8a6a20'; ctx.fillRect(x - 4, y - 10, 8, 1);
    if (statyBild) ctx.drawImage(statyBild, x - 12, y - 19 - 39);
    // glimten som vandrar över guldet
    const gl = Math.floor(t * 0.7) % 7;
    if (gl < 3) { ctx.fillStyle = 'rgba(255,255,240,.8)'; ctx.fillRect(x - 4 + gl * 3, y - 50 + gl * 9, 1, 2); }
  }
  // skylten på en stolpe till vänster om statyn: VECKANS SNÄLLASTE + namnet
  const SX = -28;
  function drawSkylt(ctx) {
    const { x, y } = STATY, s1 = $t('VECKANS SNÄLLASTE'), s2 = namn(), w = Math.max(textW(SMALL, s1), textW(SMALL, s2)) + 8, cx = x + SX;
    ctx.fillStyle = 'rgba(20,12,30,.25)'; ctx.fillRect(cx - 2, y + 2, 5, 2);
    ctx.fillStyle = '#5a5e66'; ctx.fillRect(cx, y - 10, 1, 14);
    ctx.fillStyle = '#1e1a24'; ctx.fillRect(Math.round(cx - w / 2) - 1, y - 25, w + 2, 15); ctx.fillStyle = '#2a4a3a'; ctx.fillRect(Math.round(cx - w / 2), y - 24, w, 13); ctx.fillStyle = '#c8a040'; ctx.fillRect(Math.round(cx - w / 2), y - 24, w, 1);
    ctxText(ctx, SMALL, s1, Math.round(cx - textW(SMALL, s1) / 2), y - 22, '#f8d860');
    ctxText(ctx, SMALL, s2, Math.round(cx - textW(SMALL, s2) / 2), y - 16, '#f4f1ea');
  }
  // festen: scenen med DJ, högtalare och ljus, vimplarna, dansarna och konfettin
  function drawScen(ctx) {
    const { x, y } = SCEN;
    ctx.fillStyle = 'rgba(20,12,30,.28)'; ctx.fillRect(x - 24, y - 1, 48, 4);
    ctx.fillStyle = '#3a2a4a'; ctx.fillRect(x - 22, y - 8, 44, 8); ctx.fillStyle = '#5a4a6a'; ctx.fillRect(x - 22, y - 8, 44, 1);
    // DJ-bordet med skivspelare och DJ:n bakom (huvudet guppar i takt)
    const takt = Math.floor(t * 4) % 2;
    drawPerson(ctx, x, y - 6 - takt, DJ, 'down', takt ? 10 : 9);
    ctx.fillStyle = '#1e1a24'; ctx.fillRect(x - 14, y - 16, 28, 9); ctx.fillStyle = '#3a3a42'; ctx.fillRect(x - 14, y - 16, 28, 2);
    for (const dx of [-8, 6]) { ctx.fillStyle = '#26242c'; ctx.fillRect(x + dx - 3, y - 15, 7, 2); ctx.fillStyle = (Math.floor(t * 6) % 2) ? '#d8343c' : '#f0b429'; ctx.fillRect(x + dx, y - 15, 1, 1); }
    // högtalarna som pumpar
    for (const sx of [x - 30, x + 26]) { const p = Math.floor(t * 4) % 2; ctx.fillStyle = '#1e1a24'; ctx.fillRect(sx, y - 22, 9, 22); ctx.fillStyle = '#3a3a42'; ctx.fillRect(sx + 2, y - 19 - p, 5, 5 + p); ctx.fillRect(sx + 2, y - 10, 5, 5); ctx.fillStyle = '#5a5a62'; ctx.fillRect(sx + 3, y - 18, 3, 3); }
    // ljusramen med lampor
    ctx.fillStyle = '#5a5e66'; ctx.fillRect(x - 24, y - 40, 2, 32); ctx.fillRect(x + 22, y - 40, 2, 32); ctx.fillRect(x - 24, y - 40, 48, 2);
    for (let k = 0; k < 5; k++) { const on = (Math.floor(t * 5) + k) % 3; ctx.fillStyle = ['#d8343c', '#3a7bd5', '#f0b429', '#46c85a', '#e060b0'][(k + Math.floor(t * 2)) % 5]; if (on) ctx.fillRect(x - 18 + k * 9, y - 38, 4, 3); }
    // banderollen
    const s = $t('LÖRDAGSFEST!'), w = textW(SMALL, s) + 8; ctx.fillStyle = '#d8343c'; ctx.fillRect(x - w / 2, y - 50, w, 9); ctxText(ctx, SMALL, s, Math.round(x - w / 2 + 4), y - 48, '#f4f1ea');
  }
  function drawVimplar(ctx) {
    const FL = ['#d8343c', '#f4f1ea', '#3a7bd5', '#f0b429', '#46a35a', '#e060b0'];
    for (const [ax, ay, bx, by] of [[PL.cx - 70, PL.cy - 40, PL.cx + 70, PL.cy - 40], [PL.cx - 60, PL.cy - 28, PL.cx + 64, PL.cy - 52]]) {
      for (let i = 0; i <= 28; i++) {
        const u = i / 28, x = Math.round(ax + (bx - ax) * u), y = Math.round(ay + (by - ay) * u + Math.sin(u * Math.PI) * 10);
        ctx.fillStyle = '#5a5e66'; ctx.fillRect(x, y, 1, 1);
        if (i % 2 === 0 && i < 28) { ctx.fillStyle = FL[(i / 2) % FL.length]; ctx.fillRect(x, y + 1, 3, 2); ctx.fillRect(x + 1, y + 3, 1, 1); }
      }
    }
  }
  function drawLjus(ctx) {
    if (!(env.dark > 0.15)) return;
    // färgade strålkastarkäglor från scenen, som sveper över torget
    const cols = ['rgba(216,52,60,', 'rgba(58,123,213,', 'rgba(240,180,41,', 'rgba(224,96,176,'];
    for (let k = 0; k < 4; k++) {
      const a = Math.sin(t * 0.9 + k * 1.7) * 0.9, sx = SCEN.x - 18 + k * 12, sy = SCEN.y - 38;
      for (let s = 0; s < 70; s += 2) { const x = sx - 30 + Math.sin(a) * s * 0.9 - s * 0.6, y = sy + s * 0.75, w = 2 + s * 0.12; ctx.fillStyle = cols[k] + (0.16 * (1 - s / 70)).toFixed(3) + ')'; ctx.fillRect(Math.round(x - w / 2), Math.round(y), Math.round(w), 2); }
    }
  }
  const items = () => {
    const L = [{ x: STATY.x, y: STATY.y, kind: 'staty', draw: (ctx) => drawStaty(ctx) }, { x: STATY.x + SX, y: STATY.y + 4, kind: 'statyskylt', draw: (ctx) => drawSkylt(ctx) }];
    if (arFest()) {
      L.push({ x: SCEN.x, y: SCEN.y, kind: 'festscen', draw: (ctx) => drawScen(ctx) });
      for (const d of dansare) { const f = Math.floor(t * 3 + d.fas); L.push({ x: d.x, y: d.y, kind: 'dansare', draw: (ctx) => drawPerson(ctx, d.x + ((f % 4) === 1 ? 1 : 0), d.y, d.look, ['down', 'left', 'down', 'right'][f % 4], [10, 0, 11, 4][f % 4]) }); }
      L.push({ x: PL.cx, y: 1e5, kind: 'vimplar', draw: (ctx) => { drawVimplar(ctx); for (const k of konfetti) { ctx.fillStyle = k.c; ctx.fillRect(Math.round(k.x + Math.sin(t * 2 + k.v) * 3), Math.round(k.y), 2, 1); } } });
    }
    return L;
  };
  const obstacles = [[STATY.x - 12, STATY.y - 5, STATY.x + 12, STATY.y + 1], [STATY.x + SX - 2, STATY.y + 1, STATY.x + SX + 2, STATY.y + 4]];
  return {
    items, obstacles,
    // ljuset efter kvällsmörkret (city.js glow-passet): strålkastarna från scenen och lamporna i ramen
    glow(ctx) {
      // statyn i strålkastarljus när det är mörkt (guldet lyser upp igen ovanpå kvällsmörkret)
      if (env.dark > 0.15) { ctx.fillStyle = 'rgba(255,220,140,.14)'; ctx.fillRect(STATY.x - 16, STATY.y - 64, 32, 68); ctx.globalAlpha = Math.min(0.8, env.dark); drawStaty(ctx); ctx.globalAlpha = 1; }
      if (!arFest()) return;
      drawLjus(ctx); for (let k = 0; k < 5; k++) { if (!((Math.floor(t * 5) + k) % 3)) continue; ctx.fillStyle = 'rgba(255,240,200,.35)'; ctx.fillRect(SCEN.x - 19 + k * 9, SCEN.y - 39, 6, 5); } },
    // scenen står bara där under festen (gånghindret läggs inte till – man kan gå runt/igenom vid sidan)
    update(dt) {
      t += dt;
      if (arFest()) for (const k of konfetti) { k.y += k.v * dt; if (k.y > PL.cy + 40) k.y = PL.cy - 70; }
      // festpresenten: en stund på torget under festen (en gång i veckan)
      const g = game?.(), m = me?.();
      if (!g || !m || !arFest()) { paTorget = 0; return; }
      festTid += dt;
      const nara = Math.hypot((m.x - PL.cx) / 1.4, m.y - PL.cy) < 90;
      paTorget = nara ? paTorget + dt : 0;
      if (paTorget > 12 && g.festVecka !== festVecka()) {
        g.festVecka = festVecka();
        g.presenter ||= { dag: '', antal: 0, ko: [] };
        g.presenter.ko.push({ typ: 'stor', id: 'fest-' + festVecka() });
        const h = g.glad?.(6, $t('Lördagsfesten'), 'fest', 6) || 0;
        g.save();
        env.festPresent = { t: performance.now(), glad: h };   // (staden visar toasten och spelar fanfaren)
      }
    },
    statyAt: (x, y) => Math.abs(x - STATY.x) < 13 && y < STATY.y + 3 && y > STATY.y - 60,
    statyText() {
      const nu = data?.nu;
      const a = staty ? $t`🗽 Statyn föreställer ${staty.namn} – förra veckans snällaste, som skickade ${staty.n} vänskapspresenter!` : $t('🗽 Pixelstadens grundare. Varje vecka får den som skickar flest vänskapspresenter en egen guldstaty här.');
      const b = nu ? $t` Den här veckan leder ${nu.namn} med ${nu.n} presenter.` : $t(' Skicka presenter till dina vänner – nästa vecka kan det vara du!');
      return a + b;
    },
    _debug: { staty: () => (staty ? { namn: staty.namn, n: staty.n } : null), data: () => data, fest: () => arFest(), paTorget: () => paTorget, ladda: () => { ladd = false; return hamta(); } },
  };
}
