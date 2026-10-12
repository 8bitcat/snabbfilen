// Regressionstest för 🎁 VÄNSKAPSPRESENTERNA (js/core/vannerapp.js 🎁 per vän, js/net/vanpush.js skicka/hämta,
// js/core/presenter.js typ 'van') mot en låtsasserver som fungerar som den riktiga (vänlistor + brevlådor i minnet).
// Carl 2026-10-12: "vänskaps presenter … notiser om man skickar en vänskapspresent".
//   • Leo startar (servern får hans vänlista). Mira skickar en vänskapspresent med 100 kr och soffan ur förrådet →
//     det lämnar hennes plånbok och förråd, servern får presenten, "Presenten är på väg till Leo!"
//   • samma dag igen: den gratis vänskapspresenten går inte att skicka igen
//   • Ella har inte Mira som vän → presenten kommer inte fram och Mira får tillbaka pengarna
//   • Leo startar igen: "Mira har skickat en present till dig!", presenten står i 🎁 Presenter som "💛 Present från
//     Mira", och när han öppnar den får han 100 kr och soffan (+ en liten överraskning); brevlådan töms
// Kör: node tools/vanpresent-test.mjs   (servern på 8788, eller SMOKE_PORT / PORT)
import { createRequire } from 'module';
import http from 'node:http';
const require = createRequire('D:/Qisy/QISYFrontend/QISYFrontend-1/package.json');
const { chromium } = require('playwright');

const PORT = process.env.SMOKE_PORT || process.env.PORT || 8788, MOCK = 8789;
let fails = 0;
const ok = (c, m) => { console.log((c ? 'ok: ' : 'FEL: ') + m); if (!c) fails++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// ---- låtsasservern: vänlistor och brevlådor ----
const listor = {}, ladan = {}, anrop = [];
const server = http.createServer((req, res) => {
  const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'content-type', 'access-control-allow-methods': 'POST, OPTIONS' };
  if (req.method === 'OPTIONS') { res.writeHead(204, cors); res.end(); return; }
  let body = ''; req.on('data', (c) => (body += c)); req.on('end', () => {
    const d = JSON.parse(body || '{}'), svar = (o, st = 200) => { res.writeHead(st, { 'content-type': 'application/json', ...cors }); res.end(JSON.stringify(o)); };
    anrop.push({ path: req.url, data: d, t: Date.now() });
    if (req.url === '/van/vanner') { listor[d.vid] = d.vanner || []; return svar({ ok: true }); }
    if (req.url === '/van/present') {
      if (!(listor[d.vid] || []).includes(d.till) || !(listor[d.till] || []).includes(d.vid)) return svar({ ok: false, fel: 'inte vänner' }, 403);
      (ladan[d.till] ||= []).push({ id: 'p' + anrop.length, fran: d.namn, fvid: d.vid, fri: !!d.fri, gavor: d.gavor || [] });
      return svar({ ok: true });
    }
    if (req.url === '/van/hamta') return svar({ ok: true, presenter: ladan[d.vid] || [] });
    if (req.url === '/van/kvittera') { ladan[d.vid] = (ladan[d.vid] || []).filter((x) => !(d.ids || []).includes(x.id)); return svar({ ok: true }); }
    return svar({ ok: true });
  });
}).listen(MOCK);
const browser = await chromium.launch();
// dagens present är redan öppnad (samma nyckel som js/core/presenter.js dagNu: datumet kl. nu − 6 h)
const IDAG = (() => { const d = new Date(Date.now() - 6 * 3600000); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; })();
const errs = [];
const MIRA = { vid: '1a'.repeat(8), hemlig: 'a1'.repeat(16) }, LEO = { vid: '2b'.repeat(8), hemlig: 'b2'.repeat(16) }, ELLA = { vid: '3c'.repeat(8) };
async function spel(namn, jag, vanner, save) {
  const t0 = Date.now();
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 760 } });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errs.push(`[${namn}] ${e.message}`));
  await p.addInitScript(() => { window.__toasts = []; new MutationObserver((ms) => { for (const m of ms) for (const n of m.addedNodes) if (n.classList?.contains('toast')) window.__toasts.push(n.textContent); }).observe(document, { childList: true, subtree: true }); });
  await p.goto(`http://localhost:${PORT}/index.html?nomenu&kbkpush=http://127.0.0.1:${MOCK}&world=vp${Date.now().toString(36)}`);
  await p.evaluate(([namn, jag, vanner, save]) => {
    localStorage.clear(); localStorage.setItem('snabbfilen_tips_hus', '1'); localStorage.setItem('snabbfilen_startguide_erbjuden', '1');
    localStorage.setItem('snabbfilen_avatar', JSON.stringify({ id: 'id-' + namn.toLowerCase(), name: namn, look: { skin: '#e0a97f' }, color: '#ffd23f' }));
    localStorage.setItem('snabbfilen_vanner', JSON.stringify({ ['id-' + namn.toLowerCase()]: { ...jag, lista: vanner.map(([vid, n]) => ({ vid, key: '', namn: n, look: {}, sedan: '2026-10-12', sett: Date.now() })) } }));
    localStorage.setItem('snabbfilen_save1', JSON.stringify({ v: 1, day: 3, min: 600, hunger: 90, energy: 100, home: 'husvagn', jobs: {}, earned: 0, mal: { id: 'rik', niva: 'latt' }, ...save }));
  }, [namn, jag, vanner, { ...save, presenter: { dag: IDAG, antal: 0, ko: [] } }]);
  await p.reload();
  await p.waitForFunction(() => !!window.SF?.game, null, { timeout: 30000 });
  // (vanPushStart körs strax efter starten: vänta tills servern har fått figurens vänlista och brevlådan är kollad)
  for (let i = 0; i < 80 && !(anrop.some((a) => a.path === '/van/hamta' && a.data.vid === jag.vid && a.t > t0)); i++) await sleep(250);
  await sleep(600);
  await p.evaluate(() => { const m = document.querySelector('#modal'); m.classList.add('hidden'); m.innerHTML = ''; });
  return { ctx, p };
}
const oppnaVanner = async (p) => { await p.evaluate(() => { const m = document.querySelector('#modal'); m.classList.add('hidden'); m.innerHTML = ''; }); await p.click('#hud-mobil'); await sleep(300); await p.evaluate(() => document.querySelector('#mobilen [data-app="vanner"]').click()); await sleep(400); };

// ---- Leo startar (vänlistan till servern) ----
let L = await spel('Leo', LEO, [[MIRA.vid, 'Mira']], { money: 200, fridge: {}, storage: [] });
ok((listor[LEO.vid] || []).includes(MIRA.vid), 'Leos vänlista finns hos servern');
await L.ctx.close();

// ---- Mira skickar ----
const M = await spel('Mira', MIRA, [[LEO.vid, 'Leo'], [ELLA.vid, 'Ella']], { money: 1000, fridge: { pizza: 2 }, storage: [{ k: 'soffa', v: 0 }] });
await oppnaVanner(M.p);
const rad = await M.p.evaluate(() => [...document.querySelectorAll('#modal .prow')].findIndex((r) => /Leo/.test(r.innerText)));
await M.p.evaluate((i) => document.querySelectorAll('#modal [data-vpres]')[i].click(), rad); await sleep(400);
ok(await M.p.evaluate(() => /Present till Leo/.test(document.querySelector('#modal .dlg-head h2')?.textContent || '')), '🎁 vid Leo öppnar "Present till Leo"');
ok(await M.p.evaluate(() => document.querySelector('#modal [data-pfri]')?.classList.contains('btn-gold')), 'den gratis vänskapspresenten är vald');
await M.p.evaluate(() => document.querySelector('#modal [data-ppeng="100"]').click()); await sleep(200);
await M.p.evaluate(() => document.querySelector('#modal [data-pmob]').click()); await sleep(200);
await M.p.evaluate(() => [...document.querySelectorAll('#modal .btn-go')].find((b) => /Skicka present/.test(b.textContent)).click());
await sleep(1500);
const skickat = anrop.find((a) => a.path === '/van/present' && a.data.till === LEO.vid)?.data || {};
ok(skickat.fri === true && skickat.gavor?.some((g) => g.slag === 'pengar' && g.n === 100) && skickat.gavor?.some((g) => g.slag === 'mobel' && g.k === 'soffa'), `servern får presenten: gratis + 100 kr + soffan (${JSON.stringify(skickat.gavor)})`);
const mEfter = await M.p.evaluate(() => ({ money: SF.game.money, forrad: SF.game.storage.length, toasts: window.__toasts.join(' | ') }));
ok(mEfter.money === 900 && mEfter.forrad === 0, `det lämnade Miras plånbok och förråd (${mEfter.money} kr, ${mEfter.forrad} i förrådet)`);
ok(/Presenten är på väg till Leo/.test(mEfter.toasts), '"🎁 Presenten är på väg till Leo!"');
await oppnaVanner(M.p);
await M.p.evaluate((i) => document.querySelectorAll('#modal [data-vpres]')[i].click(), rad); await sleep(400);
ok(await M.p.evaluate(() => document.querySelector('#modal [data-pfri]')?.disabled && /redan skickad/.test(document.querySelector('#modal').innerText)), 'samma dag igen: den gratis vänskapspresenten är redan skickad');
// Ella har inte Mira som vän → tillbaka
await oppnaVanner(M.p);
const radE = await M.p.evaluate(() => [...document.querySelectorAll('#modal .prow')].findIndex((r) => /Ella/.test(r.innerText)));
await M.p.evaluate((i) => document.querySelectorAll('#modal [data-vpres]')[i].click(), radE); await sleep(400);
await M.p.evaluate(() => document.querySelector('#modal [data-ppeng="50"]').click()); await sleep(200);
await M.p.evaluate(() => [...document.querySelectorAll('#modal .btn-go')].find((b) => /Skicka present/.test(b.textContent)).click());
await sleep(1500);
const mE = await M.p.evaluate(() => ({ money: SF.game.money, toasts: window.__toasts.join(' | ') }));
ok(mE.money === 900 && /Ella måste ha dig som vän/.test(mE.toasts), `presenten till Ella kom inte fram – pengarna kom tillbaka (${mE.money} kr)`);
await M.ctx.close();

// ---- Leo startar igen: presenten ----
L = await spel('Leo', LEO, [[MIRA.vid, 'Mira']], { money: 200, fridge: {}, storage: [] });
const lv = await L.p.evaluate(() => ({ ko: JSON.parse(JSON.stringify(SF.game.presenter.ko)), toasts: window.__toasts.join(' | ') }));
ok(lv.ko.length === 1 && lv.ko[0].typ === 'van' && lv.ko[0].fran === 'Mira', 'Leo får presenten i 🎁 Presenter');
ok(/Mira har skickat en present till dig/.test(lv.toasts), '"🎁 Mira har skickat en present till dig! Öppna den i mobilen"');
ok(!(ladan[LEO.vid] || []).length, 'brevlådan hos servern är tömd');
await L.p.evaluate(async () => { const m = await import('/js/core/presenter.js'); m.oppna(SF, 0); }); await sleep(300);
ok(await L.p.evaluate(() => /Present från Mira/.test(document.querySelector('#modal .dlg-head h2')?.textContent || '')), 'uppackningen heter "💛 Present från Mira"');
await L.p.evaluate(() => document.querySelector('#modal .pr-cv').click());
await L.p.waitForFunction(() => !document.querySelector('#modal .pr-gavor')?.classList.contains('hidden'), null, { timeout: 6000 }).catch(() => {});
const lEfter = await L.p.evaluate(() => ({ money: SF.game.money, soffa: SF.game.storage.some((s) => s.k === 'soffa'), n: document.querySelectorAll('#modal .pr-gava').length }));
ok(lEfter.money >= 300 && lEfter.soffa && lEfter.n >= 3, `Leo fick 100 kr och soffan + en liten överraskning (${lEfter.money} kr, ${lEfter.n} saker)`);
await L.ctx.close();

await browser.close();
server.close();
ok(!errs.length, `inga fel i sidan${errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''}`);
console.log(fails ? `\n✗ ${fails} FEL` : '\nALLT GRÖNT');
process.exit(fails ? 1 : 0);
