// Regressionstest för 🎉 LÖRDAGSFESTEN och 🗽 STATYN I PARKEN (js/city/fest.js, city.js, notiser.js).
// Carl 2026-10-12: "lördagsfest kl. 18 + statyn i parken, veckans vinnare".
//   • statyn: förra veckans snällaste hämtas från servern (en låtsasserver här, ?kbkpush=…) och står i guld
//     väster om fontänen; klick → skylten berättar vem det är och vem som leder den här veckan
//   • lördag kl. 18–20 (window.__festNu): scenen, DJ:n, dansarna; en stund på torget → en festpresent i 🎁
//     Presenter (en gång i veckan, sparas i g.festVecka), även efter omladdning ingen andra
//   • en tisdag: ingen fest; notiserna: de fyra närmaste lördagarna kl. 17.45 (id 110–113)
//   • en vänskapspresent skickar med figurens utseende (look) till servern (statyn)
// Kör: node tools/lordag-test.mjs   (servern på 8788, eller SMOKE_PORT / PORT). SHOTS=1 sparar bilder.
import { createRequire } from 'module';
import http from 'node:http';
const require = createRequire('D:/Qisy/QISYFrontend/QISYFrontend-1/package.json');
const { chromium } = require('playwright');

const PORT = process.env.SMOKE_PORT || process.env.PORT || 8788, MOCK = 8792;
let fails = 0;
const ok = (c, m) => { console.log((c ? 'ok: ' : 'FEL: ') + m); if (!c) fails++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// låtsasservern: GET /staty
let statyAnrop = 0;
const mock = http.createServer((req, res) => {
  res.setHeader('access-control-allow-origin', '*'); res.setHeader('access-control-allow-headers', 'content-type');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
  if (req.url === '/staty') { statyAnrop++; res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ ok: true, forra: { namn: 'Snällis', n: 12, vecka: '2026-W41', look: { skin: '#c68a5c', hair: '#b7392b', style: 'ponytail', top: 'hoodie', shirt: '#3a7bd5', bottom: 'jeans', pants: '#3f5f8f', hat: 'crown' } }, nu: { namn: 'Leo', n: 4 } })); return; }
  res.writeHead(404); res.end('{}');
}).listen(MOCK);

const browser = await chromium.launch();
const errs = [];
const p = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
p.on('pageerror', (e) => errs.push(e.message));
// lördagen den 17 oktober 2026 kl. 18.30 (telefonens klocka)
await p.addInitScript(() => { window.__festNu = '2026-10-17T18:30:00'; window.__toasts = []; new MutationObserver((ms) => { for (const m of ms) for (const n of m.addedNodes) if (n.classList?.contains('toast')) window.__toasts.push(n.textContent); }).observe(document, { childList: true, subtree: true }); });
await p.goto(`http://localhost:${PORT}/index.html?nomenu&world=fe${Date.now().toString(36)}&kbkpush=http://127.0.0.1:${MOCK}`);
await p.evaluate(() => {
  localStorage.clear(); localStorage.setItem('snabbfilen_tips_hus', '1'); localStorage.setItem('snabbfilen_startguide_erbjuden', '1');
  localStorage.setItem('snabbfilen_avatar', JSON.stringify({ id: 'id-fe', name: 'Festis', look: { skin: '#e0a97f' }, color: '#ffd23f' }));
  localStorage.setItem('snabbfilen_save1', JSON.stringify({ v: 1, day: 6, min: 19 * 60 + 30, money: 1000, hunger: 90, energy: 100, home: 'husvagn', fridge: {}, jobs: {}, earned: 0, mal: { id: 'rik', niva: 'latt' }, presenter: { dag: '2999-01-01', antal: 0, ko: [] } }));
});
await p.reload().catch(() => {});
await p.waitForFunction(() => !!window.SF?.game, null, { timeout: 30000 });
await sleep(1200);
const stang = () => p.evaluate(() => { const m = document.querySelector('#modal'); m.classList.add('hidden'); m.innerHTML = ''; });
await stang();
const shot = (n) => (process.env.SHOTS ? p.screenshot({ path: `tools/out/${n}.png` }).catch(() => {}) : null);
const festIds = () => p.evaluate(() => SF.game.presenter.ko.filter((x) => String(x.id).startsWith('fest-')).length);

// ---- statyn ----
await p.evaluate(() => SF.go('city')); await sleep(1500);
await p.waitForFunction(() => !!SF.scene?._debug?.lordag?.()?.staty?.(), null, { timeout: 8000 }).catch(() => {});
const st = await p.evaluate(() => SF.scene._debug.lordag().staty());
ok(st?.namn === 'Snällis' && st.n === 12, `statyn: förra veckans snällaste från servern (${JSON.stringify(st)})`);
ok(statyAnrop >= 1, 'GET /staty anropas');
await p.evaluate(() => SF.scene._debug.teleport(884, 446)); await sleep(800);
await shot('lordag-staty');
const STATY = await p.evaluate(async () => (await import('/js/city/fest.js')).STATY);
await p.evaluate(({ x, y }) => { const c = SF.scene._debug.cam(); SF.scene.down(x - c.x, y - 30 - c.y); }, STATY);
await p.waitForFunction(() => window.__toasts.some((s) => /Snällis/.test(s)), null, { timeout: 8000 }).catch(() => {});
const tx = await p.evaluate(() => window.__toasts.join(' | '));
ok(/Snällis.*12 vänskapspresenter/.test(tx) && /leder Leo med 4/.test(tx), 'skylten: "🗽 … Snällis … 12 vänskapspresenter! Den här veckan leder Leo med 4 presenter."');

// ---- festen ----
ok(await p.evaluate(() => SF.scene._debug.lordag().fest()), 'lördag kl. 18.30: det är fest');
await p.evaluate(() => SF.scene._debug.teleport(934, 404)); await sleep(1500);
await shot('lordag-torget');
await p.waitForFunction(() => window.__toasts.some((s) => /festpresent/.test(s)), null, { timeout: 20000 }).catch(() => {});
const f1 = await p.evaluate(() => ({ t: window.__toasts.join(' | '), ko: SF.game.presenter.ko.map((x) => x.id || x.typ), v: SF.game.festVecka }));
ok(/Lördagsfest! Du fick en festpresent/.test(f1.t), '"🎉 Lördagsfest! Du fick en festpresent …"');
ok(f1.ko.includes('fest-2026-W42') && f1.v === '2026-W42', `festpresenten ligger i 🎁 Presenter och veckan sparas (${JSON.stringify({ ko: f1.ko, v: f1.v })})`);
await sleep(14000);
ok((await festIds()) === 1, 'kvar på festen: ingen andra present samma vecka');
// efter omladdning: fortfarande bara en
await p.reload().catch(() => {});
await p.waitForFunction(() => !!window.SF?.game, null, { timeout: 30000 });
await sleep(800); await stang();
await p.evaluate(() => SF.go('city')); await sleep(1200);
await p.evaluate(() => SF.scene._debug.teleport(934, 404)); await sleep(14000);
const f2 = await p.evaluate(() => ({ n: SF.game.presenter.ko.filter((x) => String(x.id).startsWith('fest-')).length, v: SF.game.festVecka }));
ok(f2.n === 1 && f2.v === '2026-W42', `efter omladdning: festveckan finns kvar, ingen ny present (${JSON.stringify(f2)})`);
// kvällsljuset på festen
await p.evaluate(() => { SF.game.min = 20 * 60 + 30; }); await sleep(1500);
await shot('lordag-kvall');
// en tisdag: ingen fest
await p.evaluate(() => { window.__festNu = '2026-10-13T18:30:00'; });
ok(!(await p.evaluate(() => SF.scene._debug.lordag().fest())), 'tisdag kl. 18.30: ingen fest');
// notiserna
const no = await p.evaluate(async () => { const m = await import('/js/city/fest.js'); return m.festNotiser(new Date('2026-10-13T10:00:00')).map((n) => ({ id: n.id, at: n.schedule.at.toString() })); });
ok(no.length === 4 && no[0].id === 110 && /Sat Oct 17 2026 17:45/.test(no[0].at) && /Sat Nov 07 2026 17:45/.test(no[3].at), `notiserna: fyra lördagar kl. 17.45 (${no.map((n) => n.at.slice(0, 21)).join(' · ')})`);
// vänskapspresenten skickar med utseendet
const body = await p.evaluate(async () => {
  let fangat = null; const orig = window.fetch;
  window.fetch = async (u, o) => { if (String(u).includes('/van/present')) { fangat = JSON.parse(o.body); return new Response('{"ok":true}'); } if (String(u).includes('/van/')) return new Response('{"ok":true}'); return orig(u, o); };
  const { vanPresentSkicka } = await import('/js/net/vanpush.js');
  await vanPresentSkicka(SF, '0123456789abcdef', { fri: true });
  window.fetch = orig;
  return fangat;
});
ok(body && body.look && body.look.skin === '#e0a97f', `vänskapspresenten skickar med figurens utseende till statyn (${JSON.stringify(body?.look)})`);

await browser.close();
mock.close();
ok(!errs.length, `inga fel i sidan${errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''}`);
console.log(fails ? `\n✗ ${fails} FEL` : '\nALLT GRÖNT');
process.exit(fails ? 1 : 0);
