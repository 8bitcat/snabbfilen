// Regressionstest för KBK-PUSH i spelet (js/net/kbkpush.js) – mot en låtsasserver (?kbkpush=…) och en låtsad app:
//   • appen (låtsas-Capacitor med PushNotifications), avstämd som Julia 34: vid start säger spelet "inne"
//     ({nr: 34, namn: Julia}), telefonen frågas om lov och pushkoden registreras ({token, nr, namn, lang})
//   • "Inte jag – ta bort" i KBK-appen avregistrerar telefonen
//   • webben (ingen app), avstämd: "inne" men ingen registrering
//   • inte avstämd: ingenting skickas
//   • utan ?kbkpush pratar testrobotarna aldrig med den riktiga servern
// Kör: node tools/kbkpush-test.mjs   (servern på 8788, eller SMOKE_PORT / PORT)
import { createRequire } from 'module';
import http from 'node:http';
const require = createRequire('D:/Qisy/QISYFrontend/QISYFrontend-1/package.json');
const { chromium } = require('playwright');

const PORT = process.env.SMOKE_PORT || process.env.PORT || 8788, MOCK = 8798;
let fails = 0;
const ok = (c, m) => { console.log((c ? 'ok: ' : 'FEL: ') + m); if (!c) fails++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// låtsasservern: sparar varje anrop
const anrop = [];
const server = http.createServer((req, res) => {
  const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'content-type', 'access-control-allow-methods': 'POST, OPTIONS' };
  if (req.method === 'OPTIONS') { res.writeHead(204, cors); res.end(); return; }
  let body = ''; req.on('data', (c) => (body += c)); req.on('end', () => {
    anrop.push({ path: req.url, data: JSON.parse(body || '{}') });
    res.writeHead(200, { 'content-type': 'application/json', ...cors }); res.end(JSON.stringify({ ok: true }));
  });
}).listen(MOCK);
const browser = await chromium.launch();
const errs = [];
const TOKEN = 'ab'.repeat(32);
async function spel({ app = false, kbk = true, push = true } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 760 } });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errs.push(e.message));
  if (app) await p.addInitScript((TOKEN) => {   // låtsas-iPhone-appen: bara pushmodulen
    let reg = null;
    window.__fragade = 0;
    window.Capacitor = { isNativePlatform: () => true, Plugins: { PushNotifications: {
      checkPermissions: async () => ({ receive: 'prompt' }),
      requestPermissions: async () => { window.__fragade++; return { receive: 'granted' }; },
      addListener: async (ev, cb) => { if (ev === 'registration') reg = cb; return { remove() {} }; },
      register: async () => { setTimeout(() => reg?.({ value: TOKEN }), 50); },
    } } };
  }, TOKEN);
  await p.goto(`http://localhost:${PORT}/index.html?nomenu${push ? `&kbkpush=http://127.0.0.1:${MOCK}` : ''}&world=kp${Date.now().toString(36)}`);
  await p.evaluate((kbk) => {
    localStorage.clear(); localStorage.setItem('snabbfilen_tips_hus', '1'); localStorage.setItem('snabbfilen_startguide_erbjuden', '1');
    localStorage.setItem('snabbfilen_avatar', JSON.stringify({ id: 'id-julia', name: 'Pixeljulia', look: { skin: '#e0a97f' }, color: '#ffd23f' }));
    localStorage.setItem('snabbfilen_save1', JSON.stringify({ v: 1, day: 3, min: 13 * 60, money: 900, hunger: 70, energy: 80, home: 'husvagn', fridge: {}, jobs: {}, earned: 0, mal: { id: 'rik', niva: 'latt' } }));
    if (kbk) localStorage.setItem('snabbfilen_kbk', JSON.stringify({ 'id-julia': 34 }));
  }, kbk);
  await p.reload();
  await p.waitForFunction(() => !!window.SF?.game, null, { timeout: 30000 });
  return { ctx, p };
}
const vanta = async (fn, ms = 9000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (fn()) return true; await sleep(200); } return false; };

// ---- appen, avstämd ----
let { ctx, p } = await spel({ app: true });
ok(await vanta(() => anrop.some((a) => a.path === '/inne')), 'appen: vid start säger spelet "inne" till servern');
const inne = anrop.find((a) => a.path === '/inne')?.data || {};
ok(inne.nr === 34 && inne.namn === 'Julia', `…med numret och lagets förnamn (${inne.nr} ${inne.namn})`);
ok(await vanta(() => anrop.some((a) => a.path === '/registrera')), 'appen: pushkoden registreras');
const reg = anrop.find((a) => a.path === '/registrera')?.data || {};
ok(reg.token === TOKEN && reg.nr === 34 && reg.namn === 'Julia' && reg.lang === 'sv', `…med pushkod, nummer, förnamn och språk (${reg.nr} ${reg.namn} ${reg.lang})`);
ok(await p.evaluate(() => window.__fragade === 1), 'telefonen frågade om lov en gång');
ok(await p.evaluate((T) => JSON.parse(localStorage.getItem('snabbfilen_kbk_push') || '{}').token === T, TOKEN), 'pushkoden sparas i telefonen');
ok(anrop.filter((a) => a.path === '/inne').length === 1, 'bara ett "inne" per start');
// Inte jag – ta bort
await p.evaluate(() => { const m = document.querySelector('#modal'); m.classList.add('hidden'); m.innerHTML = ''; });
await p.click('#hud-mobil'); await p.waitForTimeout(300); await p.click('#mobilen [data-app="kbk"]'); await p.waitForTimeout(400);
await p.evaluate(() => [...document.querySelectorAll('#modal .dlg-foot .btn')].find((b) => /Inte jag/.test(b.textContent))?.click());
ok(await vanta(() => anrop.some((a) => a.path === '/avregistrera' && a.data.token === TOKEN)), '"Inte jag – ta bort" avregistrerar telefonen');
await ctx.close();

// ---- webben, avstämd ----
anrop.length = 0;
({ ctx, p } = await spel());
ok(await vanta(() => anrop.some((a) => a.path === '/inne')), 'webben: "inne" skickas');
await sleep(1500);
ok(!anrop.some((a) => a.path === '/registrera'), 'webben: ingen registrering (bara appen får pushnotiser)');
await ctx.close();

// ---- inte avstämd ----
anrop.length = 0;
({ ctx, p } = await spel({ app: true, kbk: false }));
await sleep(6000);
ok(!anrop.length, 'inte avstämd: inget skickas');
await ctx.close();

// ---- utan ?kbkpush: robotarna når aldrig den riktiga servern ----
const ut = [];
({ ctx, p } = await spel({ push: false }));
p.on('request', (r) => { if (/kbk\.8bitcat\.io/.test(r.url())) ut.push(r.url()); });
await sleep(6000);
ok(!ut.length, 'testroboten pratar inte med kbk.8bitcat.io');
await ctx.close();

ok(!errs.length, `inga fel${errs.length ? ' – ' + [...new Set(errs)].slice(0, 3).join(' | ') : ''}`);
await browser.close(); server.close();
console.log(fails ? `\n${fails} FEL` : '\nALLT GRÖNT');
process.exit(fails ? 1 : 0);
