// Regressionstest för 📸 FOTOLÄGET och 🖼️ BILDERNA (js/core/foto.js, fotolage.js, drakt.js POSER):
//   • 📷 Kamera i mobilen: knapparna och mätarna försvinner, förhandsvisningen (#foto-vy) ligger över den synliga delen
//   • filtren: Retro ger bara de fyra gröna tonerna · ramen Snabbfoto: vit underkant
//   • poserna: 👋 Vinka hålls kvar (myAction) tills kameran stängs
//   • 📸 knäpper: bilden hamnar i albumet (IndexedDB) i spelpixlar, med samma storlek som förhandsvisningen
//   • självutlösaren räknar 3-2-1 · Esc stänger kameran och knapparna kommer tillbaka
//   • 🖼️ Bilder: rutnätet, stor bild, ta bort
//   • fotoläget ritar inte möbelskyltarna hemma (fotolage.js foto.pa)
//   • telefonen liggande: fotobaren ryms på skärmen
// Kör: node tools/foto-test.mjs   (servern på 8788, eller SMOKE_PORT / PORT) · SHOTS=1 sparar bilder i tools/out/
import { createRequire } from 'module';
const require = createRequire('D:/Qisy/QISYFrontend/QISYFrontend-1/package.json');
const { chromium } = require('playwright');

const PORT = process.env.SMOKE_PORT || process.env.PORT || 8788, SHOTS = !!process.env.SHOTS;
let fails = 0;
const ok = (c, m) => { console.log((c ? 'ok: ' : 'FEL: ') + m); if (!c) fails++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await chromium.launch();
const errs = [];
async function boot(opts = {}) {
  const ctx = await browser.newContext({ viewport: opts.vp || { width: 1200, height: 760 }, ...(opts.mob ? { deviceScaleFactor: 3, isMobile: true, hasTouch: true } : {}) });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errs.push(e.message));
  await p.addInitScript(() => { window.__toasts = []; new MutationObserver((ms) => { for (const m of ms) for (const n of m.addedNodes) if (n.classList?.contains('toast')) window.__toasts.push(n.textContent); }).observe(document, { childList: true, subtree: true }); });
  await p.goto(`http://localhost:${PORT}/index.html?nomenu${opts.mob ? '&mobfill=1' : ''}&world=foto${Date.now().toString(36)}`);
  await p.evaluate(() => {
    localStorage.clear(); localStorage.setItem('snabbfilen_tips_hus', '1'); localStorage.setItem('snabbfilen_startguide_erbjuden', '1');
    localStorage.setItem('snabbfilen_avatar', JSON.stringify({ id: 'id-fotis', name: 'Fotis', look: { skin: '#e0a97f', hair: '#3b2619', style: 'long' }, color: '#ffd23f' }));
    localStorage.setItem('snabbfilen_save1', JSON.stringify({ v: 1, day: 3, min: 13 * 60, money: 900, hunger: 70, energy: 80, home: 'husvagn', fridge: {}, jobs: {}, earned: 0, mal: { id: 'rik', niva: 'latt' }, presenter: { dag: '2099-01-01-k', antal: 0, ko: [] } }));
    indexedDB.deleteDatabase('snabbfilen-foton');
  });
  await p.reload().catch(() => {});
  await p.waitForFunction(() => !!window.SF?.game, null, { timeout: 30000 });
  await sleep(900);
  await p.evaluate(() => { const m = document.querySelector('#modal'); m.classList.add('hidden'); m.innerHTML = ''; window.SF.go('city'); });
  await sleep(1200);
  return { ctx, p };
}
const D = (p, fn, a) => p.evaluate(fn, a);
const stang = (p) => D(p, () => { const m = document.querySelector('#modal'); m.classList.add('hidden'); m.innerHTML = ''; });
const fotoKnapp = (p, f) => D(p, (f) => document.querySelector(`#foto [data-f="${f}"]`).click(), f);
const antal = (p) => D(p, async () => (await (await import('/js/core/foto.js')).fotonFor(SF.avatar)).length);

const { ctx, p } = await boot();
// ---- kameran ----
await p.click('#hud-mobil'); await sleep(200);
ok(await D(p, () => !!document.querySelector('#mobilen [data-app="kamera"] img.pix-ik') && !!document.querySelector('#mobilen [data-app="bilder"] img.pix-ik')), 'mobilen har 📷 Kamera och 🖼️ Bilder');
await p.click('#mobilen [data-app="kamera"]'); await sleep(600);
const k0 = await D(p, () => {
  const vy = document.querySelector('#foto-vy'), r = vy?.getBoundingClientRect(), hud = document.querySelector('#hud-mobil');
  return { lage: document.documentElement.classList.contains('foto-lage'), syns: !document.querySelector('#foto').classList.contains('hidden'), w: vy?.width, h: vy?.height, cssW: r?.width, mobil: getComputedStyle(hud).visibility };
});
ok(k0.lage && k0.syns && k0.w > 200 && k0.h > 100 && k0.cssW > 400 && k0.mobil === 'hidden', `kameran är uppe: sökaren ${k0.w}×${k0.h} spelpixlar, mobilknappen dold (${JSON.stringify(k0)})`);
// Retro: bara fyra toner
for (let i = 0; i < 4; i++) await fotoKnapp(p, 'filter');
await sleep(300);
const gb = await D(p, () => {
  const vy = document.querySelector('#foto-vy'), d = vy.getContext('2d').getImageData(0, 0, vy.width, vy.height).data, set = new Set();
  for (let i = 0; i < d.length; i += 4 * 7) set.add(`${d[i]},${d[i + 1]},${d[i + 2]}`);
  return { filter: document.querySelector('#foto [data-f="filter"]').textContent, toner: [...set] };
});
ok(/Retro/.test(gb.filter) && gb.toner.length <= 4 && gb.toner.every((t) => ['15,56,15', '48,98,48', '139,172,15', '155,188,15'].includes(t)), `filtret Retro: bara de fyra gröna tonerna (${gb.toner.join(' | ')})`);
// ramen Snabbfoto: vit underkant
await fotoKnapp(p, 'ram'); await sleep(300);
const pol = await D(p, () => { const vy = document.querySelector('#foto-vy'), x = vy.getContext('2d'); const a = x.getImageData(2, vy.height - 3, 1, 1).data; return { ram: document.querySelector('#foto [data-f="ram"]').textContent, c: [...a].slice(0, 3).join(',') }; });
ok(/Snabbfoto/.test(pol.ram) && pol.c === '246,243,236', `ramen Snabbfoto: vit underkant (${pol.c})`);
if (SHOTS) await p.screenshot({ path: 'tools/out/foto-retro-snabbfoto.png' });
// pose
await fotoKnapp(p, 'pose'); await sleep(300);
ok(await D(p, async () => (await import('/js/core/drakt.js')).myAction()?.a?.fx === 'vinka' && /Vinka/.test(document.querySelector('#foto [data-f="pose"]').textContent)), 'posen 👋 Vinka');
await sleep(3000);
ok(await D(p, async () => (await import('/js/core/drakt.js')).myAction()?.a?.fx === 'vinka'), 'posen hålls kvar (efter 3 s)');
// knäpp
await fotoKnapp(p, 'knapp'); await sleep(900);
const b1 = await D(p, async () => { const f = (await (await import('/js/core/foto.js')).fotonFor(SF.avatar))[0]; const vy = document.querySelector('#foto-vy'); return { n: (await (await import('/js/core/foto.js')).fotonFor(SF.avatar)).length, w: f?.w, h: f?.h, vw: vy.width, vh: vy.height, png: /^data:image\/png/.test(f?.png || ''), filter: f?.filter, ram: f?.ram, toasts: window.__toasts.join(' | '), tumme: !!document.querySelector('#foto .foto-tumme img') }; });
ok(b1.n === 1 && b1.png && b1.w === b1.vw && b1.h === b1.vh && b1.filter === 'retro' && b1.ram === 'snabbfoto', `📸 knäpp: bilden i albumet, ${b1.w}×${b1.h} spelpixlar, Retro + Snabbfoto (${JSON.stringify({ ...b1, toasts: undefined })})`);
ok(/Klick! Bilden ligger i/.test(b1.toasts) && b1.tumme, '"📸 Klick!" och bilden som tumnagel i fotobaren');
// självutlösaren + Vykort i färg
for (let i = 0; i < 2; i++) await fotoKnapp(p, 'filter');   // retro → drom → normal
await fotoKnapp(p, 'ram'); await fotoKnapp(p, 'pose'); await fotoKnapp(p, 'timer');
await sleep(200);
await p.keyboard.press('Space'); await sleep(300);
ok(await D(p, () => { const r = document.querySelector('#foto .foto-rakna'); return !r.classList.contains('hidden') && r.textContent === '3'; }), 'självutlösaren: 3 …');
if (SHOTS) { await sleep(800); await p.screenshot({ path: 'tools/out/foto-vykort-jubla.png' }); }
await sleep(3400);
ok((await antal(p)) === 2, 'självutlösaren: … och knäpp (två bilder)');
// Esc stänger
await p.keyboard.press('Escape'); await sleep(300);
const k1 = await D(p, async () => ({ lage: document.documentElement.classList.contains('foto-lage'), mobil: getComputedStyle(document.querySelector('#hud-mobil')).visibility, pose: (await import('/js/core/drakt.js')).myAction(), pa: (await import('/js/core/fotolage.js')).foto.pa }));
ok(!k1.lage && k1.mobil === 'visible' && !k1.pose && !k1.pa, `Esc stänger kameran: knapparna tillbaka, posen borta (${JSON.stringify(k1)})`);

// ---- albumet ----
await p.click('#hud-mobil'); await sleep(200);
await p.click('#mobilen [data-app="bilder"]'); await sleep(600);
ok(await D(p, () => /Bilder/.test(document.querySelector('#modal .dlg-head h2')?.textContent || '') && document.querySelectorAll('#modal .fo-ruta img').length === 2), '🖼️ Bilder: två bilder i rutnätet');
if (SHOTS) await p.screenshot({ path: 'tools/out/foto-album.png' });
await D(p, () => document.querySelector('#modal [data-fo="0"]').click()); await sleep(400);
ok(await D(p, () => !!document.querySelector('#modal .fo-stor img') && /\(1\/2\)/.test(document.querySelector('#modal').innerText)), 'en bild stor (1/2)');
if (SHOTS) await p.screenshot({ path: 'tools/out/foto-stor.png' });
await D(p, () => [...document.querySelectorAll('#modal .dlg-foot .btn')].find((b) => /Ta bort/.test(b.textContent)).click()); await sleep(300);
await D(p, () => [...document.querySelectorAll('#modal .dlg-foot .btn')].find((b) => /Ja, ta bort/.test(b.textContent)).click()); await sleep(500);
ok((await antal(p)) === 1 && (await D(p, () => document.querySelectorAll('#modal .fo-ruta').length)) === 1, '🗑️ Ta bort: en bild kvar');
await stang(p);

// ---- fotoläget ritar inte möbelskyltarna hemma ----
await D(p, () => window.SF.go('room')); await sleep(1500);
const skyltar = async () => D(p, () => { const c = document.querySelector('#scene'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i] === 138 && d[i + 1] === 106 && d[i + 2] === 42) n++; return n; });
const utan = await skyltar();
await D(p, async () => { (await import('/js/core/fotolage.js')).foto.pa = true; }); await sleep(400);
const med = await skyltar();
await D(p, async () => { (await import('/js/core/fotolage.js')).foto.pa = false; });
ok(utan > 50 && med < utan / 10, `hemma: möbelskyltarna ritas inte i fotoläget (${utan} → ${med} skyltpixlar)`);
await ctx.close();

// ---- telefonen liggande ----
const M = await boot({ vp: { width: 844, height: 390 }, mob: true });
await D(M.p, async () => (await import('/js/core/foto.js')).openKamera(SF)); await sleep(600);
const mob = await D(M.p, () => { const b = document.querySelector('#foto .foto-bar').getBoundingClientRect(), v = document.querySelector('#foto-vy').getBoundingClientRect(); return { b: [b.left, b.right, b.bottom].map(Math.round), v: [v.left, v.top, v.right, v.bottom].map(Math.round), W: innerWidth, H: innerHeight }; });
ok(mob.b[0] >= 0 && mob.b[1] <= mob.W && mob.b[2] <= mob.H && mob.v[0] >= -1 && mob.v[2] <= mob.W + 1 && mob.v[3] <= mob.H + 1, `telefonen liggande: fotobaren och sökaren ryms (${JSON.stringify(mob)})`);
if (SHOTS) await M.p.screenshot({ path: 'tools/out/foto-telefon.png' });
await M.ctx.close();

await browser.close();
ok(!errs.length, `inga fel i sidan${errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''}`);
console.log(fails ? `\n✗ ${fails} FEL` : '\nALLT GRÖNT');
process.exit(fails ? 1 : 0);
