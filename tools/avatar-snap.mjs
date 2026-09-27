// Provkör avatarredigeraren i riktiga spelet (Playwright): öppnar den, går igenom alla
// flikar, klickar på rutor, slumpar, provar båda låssystemen och sparar – och skriver ut
// alla konsolfel. Tar skärmdumpar av flikarna till tools/out/avatar-<flik>.png.
// Kontrollerar också att webbläsaren ritar figurerna bit för bit som baslinjen
// (tools/people-baseline.json, som skrivs i Node).
//   node tools/avatar-snap.mjs                 (servern: python -m http.server 8788)
//   node tools/avatar-snap.mjs --tabs hair,top --port 8788 --mobile
import { createRequire } from 'module';
import fs from 'fs';
const require = createRequire('D:/Qisy/QISYFrontend/QISYFrontend-1/package.json');
const { chromium } = require('playwright');

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : (process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : true); };
const port = arg('port', '8788');
const mobile = !!arg('mobile', false);
const onlyTabs = arg('tabs', null);
const outDir = 'tools/out';
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: mobile ? { width: 390, height: 760 } : { width: 1200, height: 800 } });
const errs = [];
page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
page.on('console', (m) => m.type() === 'error' && errs.push('console: ' + m.text()));
await page.goto(`http://localhost:${port}/index.html?world=avsnap${Date.now().toString(36)}`);
await page.evaluate(() => {
  localStorage.setItem('snabbfilen_avatar', JSON.stringify({ name: 'Snap', look: { skin: '#e0a97f', hair: '#3b2619', style: 'long', shirt: '#3a7bd5', pants: '#2d3a5c', blush: true }, color: '#ffd23f' }));
  localStorage.setItem('snabbfilen_save1', JSON.stringify({ v: 1, day: 3, min: 12 * 60, money: 500, hunger: 90, energy: 90, home: 'rum', fridge: {}, jobs: {}, earned: 0, wardrobe: ['hat:cap', 'top:hoodie'] }));
});
await page.reload();
await page.waitForTimeout(900);

const log = (...a) => console.log(...a);
const settle = () => page.waitForTimeout(350);

// ---------- 1. webbläsaren = baslinjen? ----------
const base = JSON.parse(fs.readFileSync('tools/people-baseline.json', 'utf8'));
const sample = base.looks.filter((_, i) => i % 7 === 0).slice(0, 110);
const hashes = await page.evaluate(async (looks) => {
  const P = await import('/js/core/people.js');
  const out = {};
  let cap = null;
  const ctx = { fillRect() {}, drawImage(s) { cap = s; }, set fillStyle(v) {} };
  for (const { id, look } of looks) {
    const L = JSON.parse(JSON.stringify(look));
    for (const dir of ['down', 'up', 'right', 'left']) for (let f = 0; f < 10; f++) {
      P.drawPerson(ctx, 12, 39, L, dir, f);
      const data = cap.getContext('2d').getImageData(0, 0, 24, 40).data;
      const h = await crypto.subtle.digest('SHA-1', data);
      out[`${id}|${dir}|${f}`] = [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 16);
    }
  }
  return out;
}, sample);
const bad = Object.entries(hashes).filter(([k, h]) => base.sprites[k] !== h).map(([k]) => k);
log(`Webbläsaren mot baslinjen: ${Object.keys(hashes).length} sprites, ${bad.length} skillnader${bad.length ? ': ' + bad.slice(0, 10).join(', ') : ' ✓'}`);

// ---------- 2. redigeraren med det gamla låssystemet (main.js: setAvatarLocks) ----------
await page.evaluate(async () => { const A = await import('/js/core/avatar.js'); window.__av = A; A.openAvatarEditor({}); });
await settle();
const tabIds = await page.$$eval('.av-tab', (bs) => bs.map((b) => b.dataset.tab));
log('Flikar:', tabIds.join(', '));
const stats = [];
for (const t of tabIds) {
  if (onlyTabs && !String(onlyTabs).split(',').includes(t)) continue;
  await page.click(`.av-tab[data-tab="${t}"]`);
  await settle();
  // rulla igenom panelen så att de lata rutorna ritas
  await page.evaluate(async () => { const p = document.querySelector('.av-panel'); for (let y = 0; y <= p.scrollHeight; y += 300) { p.scrollTop = y; await new Promise((r) => setTimeout(r, 60)); } p.scrollTop = 0; });
  await settle();
  const s = await page.evaluate(() => ({ tiles: document.querySelectorAll('.av-panel .av-tile').length, canvases: document.querySelectorAll('.av-panel .av-tile canvas').length, waiting: document.querySelectorAll('.av-panel i[data-c]').length, sw: document.querySelectorAll('.av-panel .av-sw').length, more: document.querySelector('.av-panel .av-more')?.textContent || '' }));
  stats.push({ t, ...s });
  await page.locator('.dlg-avatar').screenshot({ path: `${outDir}/avatar-${t}${mobile ? '-mobil' : ''}.png` });
}
for (const s of stats) log(`  ${s.t.padEnd(10)} rutor ${String(s.tiles).padStart(3)}  ritade ${String(s.canvases).padStart(3)}  väntar ${s.waiting}  färgrutor ${s.sw}  ${s.more}`);

// klicka runt: keps (ägd), huvtröja (ägd), klänning (ej ägd → ska inte finnas), färg, Std, slumpa
const clickLog = await page.evaluate(async () => {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const tab = async (id) => { document.querySelector(`.av-tab[data-tab="${id}"]`).click(); await wait(120); };
  const out = [];
  await tab('hat');
  const cap = document.querySelector('.av-panel [data-item="hat-cap"]');
  out.push('keps finns: ' + !!cap); cap?.click(); await wait(80);
  out.push('krona syns (ska inte): ' + !!document.querySelector('.av-panel [data-item="hat-crown"]'));
  await tab('top');
  document.querySelector('.av-panel [data-item="top-hoodie"]')?.click(); await wait(80);
  out.push('huvtröja på: ' + !!document.querySelector('.av-panel [data-item="top-hoodie"].on'));
  document.querySelector('.av-panel [data-k="shirt"][data-v=\'"#46a35a"\']')?.click(); await wait(80);
  await tab('eyes');
  document.querySelector('.av-panel [data-k="eyeColor"][data-v=\'"#3f6fb0"\']')?.click(); await wait(80);
  document.querySelector('.av-panel .av-std[data-k="eyeColor"]')?.click(); await wait(80);
  await tab('size');
  document.querySelector('.av-panel [data-k="kid"][data-v="true"]')?.click(); await wait(80);
  document.querySelector('.av-panel [data-k="kid"][data-v="false"]')?.click(); await wait(80);
  for (let i = 0; i < 25; i++) { document.querySelector('.av-rand').click(); await wait(20); }
  return out;
});
log('Klick:', clickLog.join(' · '));
await page.locator('.dlg-avatar').screenshot({ path: `${outDir}/avatar-slumpad${mobile ? '-mobil' : ''}.png` });
await page.click('.av-save');
await settle();
const savedLook = await page.evaluate(() => JSON.parse(localStorage.getItem('snabbfilen_avatar')).look);
log('Sparad look har', Object.keys(savedLook).length, 'fält; hatt =', savedLook.hat, '; topp =', savedLook.top);

// ---------- 3. nya systemet: setAvatarWardrobe ----------
const newSys = await page.evaluate(async () => {
  const A = window.__av;
  A.setAvatarWardrobe(() => ['hat-crown', 'glasses-sun']);
  A.openAvatarEditor({});
  await new Promise((r) => setTimeout(r, 200));
  document.querySelector('.av-tab[data-tab="hat"]').click();
  await new Promise((r) => setTimeout(r, 200));
  const hats = [...document.querySelectorAll('.av-panel .av-tile')].slice(0, 12).map((b) => b.dataset.item || b.dataset.empty || b.dataset.keep && 'nuvarande');
  const more = document.querySelector('.av-panel .av-more')?.textContent;
  document.querySelector('.av-tab[data-tab="glasses"]').click();
  await new Promise((r) => setTimeout(r, 200));
  const gl = [...document.querySelectorAll('.av-panel .av-tile')].map((b) => b.dataset.item || b.dataset.empty);
  document.querySelector('.av-cancel').click();
  return { hats, more, gl };
});
log('setAvatarWardrobe(krona, solglasögon): huvud =', newSys.hats.join(', '), '|', newSys.more, '| glasögon =', newSys.gl.join(', '));

// ---------- 4. cleanLook tål skräp ----------
const cl = await page.evaluate(() => {
  const A = window.__av;
  const a = A.cleanLook({ style: 'finns-inte', top: 42, hat: 'none', phones: 'over', glasses: true, beard: true, eyes: 'x', cheeks: 'blush', eyeColor: 'blå', neck: { a: 1 } });
  const b = A.cleanLook({ blush: true });
  const c = A.cleanLook(null);
  return { a, b: { cheeks: b.cheeks, blush: b.blush }, c: Object.keys(c).length };
});
log('cleanLook(skräp):', JSON.stringify({ style: cl.a.style, top: cl.a.top, hat: cl.a.hat, phones: cl.a.phones, glasses: cl.a.glasses, beard: cl.a.beard, eyes: cl.a.eyes, cheeks: cl.a.cheeks, eyeColor: cl.a.eyeColor, neck: cl.a.neck }), '| blush:true →', JSON.stringify(cl.b), '| null →', cl.c, 'fält');

// ---------- 5. lat ritning: tid för att öppna en flik ----------
const timing = await page.evaluate(async () => {
  const A = window.__av;
  const t0 = performance.now();
  A.openAvatarEditor({});
  document.querySelector('.av-tab[data-tab="hair"]').click();
  const t1 = performance.now();
  await new Promise((r) => setTimeout(r, 400));
  const n = document.querySelectorAll('.av-panel .av-tile canvas').length;
  document.querySelector('.av-cancel').click();
  return { open: Math.round(t1 - t0), canvases: n };
});
log(`Öppna redigeraren + byta till Hår: ${timing.open} ms (synkront), ${timing.canvases} rutor ritade efter 400 ms`);

log(errs.length ? 'KONSOLFEL:\n' + errs.join('\n') : 'Inga konsolfel.');
await browser.close();
