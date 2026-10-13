// Regressionstest för 🎣 FISKET PÅ SOLÖN (js/solon/fiske.js, js/scenes/solon.js):
//   • utan metspö: "Du behöver ett metspö"; kiosken säljer ett (120 kr)
//   • fiskespelet: kasta → vänta (för tidigt = fisken simmar iväg) → NAPP → kampen (tre träffar i det gröna) → fångad
//   • fångsten: i fångstboken, matfisk ger fiskfilé i skafferiet
//   • alla sex arterna → meriten Fiskemästare i troféskåpet
// Kör: node tools/fiske-test.mjs   (servern på 8788, eller SMOKE_PORT / PORT) · SHOTS=1 sparar bilder i tools/out/
import { createRequire } from 'module';
import fs from 'node:fs';
const require = createRequire('D:/Qisy/QISYFrontend/QISYFrontend-1/package.json');
const { chromium } = require('playwright');

const PORT = process.env.SMOKE_PORT || process.env.PORT || 8788, SHOTS = !!process.env.SHOTS;
let fails = 0;
const ok = (c, m) => { console.log((c ? 'ok: ' : 'FEL: ') + m); if (!c) fails++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await chromium.launch();
const errs = [];
const p = await (await browser.newContext({ viewport: { width: 1200, height: 760 } })).newPage();
p.on('pageerror', (e) => errs.push(e.message));
await p.addInitScript(() => { window.__toasts = []; new MutationObserver((ms) => { for (const m of ms) for (const n of m.addedNodes) if (n.classList?.contains('toast')) window.__toasts.push(n.textContent); }).observe(document, { childList: true, subtree: true }); });
await p.goto(`http://localhost:${PORT}/index.html?nomenu&world=fisk${Date.now().toString(36)}`);
await p.evaluate(() => {
  localStorage.clear(); localStorage.setItem('snabbfilen_tips_hus', '1'); localStorage.setItem('snabbfilen_startguide_erbjuden', '1');
  localStorage.setItem('snabbfilen_avatar', JSON.stringify({ id: 'id-fisk', name: 'Fiskis', look: { skin: '#e0a97f' }, color: '#ffd23f' }));
  localStorage.setItem('snabbfilen_save1', JSON.stringify({ v: 1, day: 4, min: 13 * 60, money: 500, hunger: 70, energy: 90, home: 'husvagn', fridge: {}, jobs: {}, earned: 0, mal: { id: 'rik', niva: 'latt' }, presenter: { dag: '2999-01-01-k', antal: 0, ko: [] }, mysterium: { kap: 7, steg: 0, klar: '2000-01-01', hittat: [] } }));
});
await p.reload().catch(() => {});
await p.waitForFunction(() => !!window.SF?.game, null, { timeout: 30000 });
await sleep(1000);
const D = (fn, a) => p.evaluate(fn, a);
const stang = () => D(() => { const m = document.querySelector('#modal'); m.classList.add('hidden'); m.innerHTML = ''; });
const rubrik = () => D(() => document.querySelector('#modal:not(.hidden) .dlg-head h2')?.textContent || '');
await stang();
await D(() => { SF.solonFran = null; SF.go('solon'); }); await sleep(1200); await stang();

// ---- utan spö ----
await D(() => SF.scene._debug.act('fiska-brygga')); await sleep(300);
ok(/behöver ett metspö/.test(await D(() => window.__toasts.join(' | '))), 'utan metspö: "Du behöver ett metspö"');
await D(() => SF.scene._debug.act('kiosk')); await sleep(300);
const m0 = await D(() => SF.game.money);
ok(await D(() => !!document.querySelector('#modal [data-spo]')), 'kiosken säljer ett metspö');
await D(() => document.querySelector('#modal [data-spo]').click()); await sleep(300);
ok(await D(() => SF.game.fiske.spo) && (await D(() => SF.game.money)) === m0 - 120, 'metspöet köpt (120 kr)');
await stang();

// ---- fiskespelet ----
const starta = (art) => D(async (art) => {
  const m = await import('/js/solon/fiske.js');
  if (art) { const r = Math.random; const a = m.ARTER.find((x) => x.id === art); window.__ratt = a; }
  window.__fi = m.openFiske(SF, { plats: 'brygga' });
}, art);
const fas = () => D(() => window.__fi._test());
const klick = () => D(() => document.querySelector('#modal .fi-cv').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })));
// en hel fångst: kasta, vänta på napp, kampen (tryck när nålen är i det gröna)
async function fanga({ forTidigt = false } = {}) {
  await klick(); await sleep(800);
  if (forTidigt) { await klick(); await sleep(200); return (await D(() => document.querySelector('#modal .fi-text')?.textContent || '')); }
  for (let i = 0; i < 100 && (await fas()).fas !== 'napp'; i++) await sleep(100);
  await klick(); await sleep(50);
  for (let traff = 0; traff < 3;) {
    const f = await fas();
    if (f.fas !== 'kamp') break;
    const i = f.nal * 120;
    if (i >= f.zon + 2 && i <= f.zon + f.zonW - 2) { await klick(); traff += 1; await sleep(60); } else await sleep(8);
  }
  await sleep(500);
  return rubrik();
}
await starta();
await sleep(300);
ok(/Fiska/.test(await rubrik()) && await D(() => !!document.querySelector('#modal .fi-cv')), 'fiskespelet öppnas');
if (SHOTS) await p.screenshot({ path: 'tools/out/fiske-spel.png' });
const tidigt = await fanga({ forTidigt: true });
ok(/För tidigt/.test(tidigt), `för tidigt: "${tidigt}"`);
await sleep(1600);
// styr fångsten: slumpen väljer en riktig fisk (inte skräp) för provet
await D(() => { window.__fiskeArt = 'makrill'; });
const r1 = await fanga();
ok(/Fångad|Hoppsan/.test(r1), `kampen: tre träffar → "${r1}"`);
if (SHOTS) await p.screenshot({ path: 'tools/out/fiske-fangst.png' });
const efter = await D(() => ({ arter: JSON.parse(JSON.stringify(SF.game.fiske.arter)), fisk: SF.game.skafferi?.fisk | 0 }));
const fangad = Object.keys(efter.arter);
ok(fangad.length === 1 && efter.arter[fangad[0]].n === 1, `fångsten i fångstboken (${JSON.stringify(efter.arter)})`);
ok(efter.fisk > 0 || ['hummer', 'stovel', 'tang', 'flaskpost'].includes(fangad[0]), `matfisk → fiskfilé i skafferiet (${efter.fisk})`);
await stang();
// ---- alla arter → Fiskemästare ----
await D(() => { SF.game.fiske.arter = { stromming: { n: 1, rekord: 0.1 }, makrill: { n: 1, rekord: 0.5 }, torsk: { n: 1, rekord: 1 }, rodspatta: { n: 1, rekord: 0.5 }, havsoring: { n: 1, rekord: 2 } }; });
await D(() => { window.__fiskeArt = 'hummer'; });
await starta(); await sleep(200);
const r2 = await fanga();
await D(() => { window.__fiskeArt = null; });
const sist = await D(() => ({ hummer: SF.game.fiske.arter.hummer?.n | 0, merit: (SF.game.meriter || []).some((m) => m.typ === 'fiske'), txt: document.querySelector('#modal')?.innerText || '' }));
ok(sist.hummer === 1 && sist.merit && /Fiskemästare/.test(sist.txt), `alla sex arterna → meriten Fiskemästare (${r2}, hummer ${sist.hummer})`);
await stang();
// ---- fångstboken + bilder av alla fiskar ----
await D(async () => (await import('/js/solon/fiske.js')).openFangstbok(SF)); await sleep(300);
ok(/Fångstboken/.test(await rubrik()) && await D(() => document.querySelectorAll('#modal .fi-bok-rad').length === 9), 'fångstboken: sex arter + tre roliga fynd');
if (SHOTS) {
  await p.screenshot({ path: 'tools/out/fiske-bok.png' });
  const ark = await D(async () => { const m = await import('/js/solon/fiske.js'); const c = document.createElement('canvas'); c.width = 16 * 8 * 3 + 20; c.height = 9 * 8 * 3 + 20; const x = c.getContext('2d'); x.fillStyle = '#5aa8d8'; x.fillRect(0, 0, c.width, c.height); let i = 0; for (const a of m.ARTER) { const img = new Image(); img.src = m.fiskURL(a.id, 8); await img.decode(); x.drawImage(img, 4 + (i % 3) * 136, 4 + Math.floor(i / 3) * 76); i++; } return c.toDataURL(); });
  fs.writeFileSync('tools/out/fiske-arter.png', Buffer.from(ark.split(',')[1], 'base64'));
}

await browser.close();
ok(!errs.length, `inga fel i sidan${errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''}`);
console.log(fails ? `\n✗ ${fails} FEL` : '\nALLT GRÖNT');
process.exit(fails ? 1 : 0);
