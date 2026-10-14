// Tvåspelartest av 💛 VÄNNER (js/net/vanner.js, js/core/vannerapp.js, js/net/vanpush.js, world.js vi, main.js 👥-rutan,
// mobilens app) över riktiga PeerJS-molnet i en egen värld, med en låtsas-pushserver (?kbkpush=…). Carl 2026-10-12:
// "så man kan bli vänner och att man får en ikon i mobilen … och att man får notiser när en vän spelar".
//   1. Mira (appen, låtsas-Capacitor med push) och Leo (webben) är i världen. I 👥 står 💛 Bli vänner vid den andra.
//   2. Mira frågar → Leo får "💛 Bli vänner?" → Ja → båda har varandra i listan (vän-id:t vi), Mira får "Leo sa ja".
//   3. servern får båda vänlistorna (/van/vanner); Miras telefon frågar om lov och registreras (/van/registrera)
//   4. 💛 Vänner i mobilen: Leo står där, 🟢 i Pixelstaden nu, med Gå dit / Åk hem till; siffran på appen = 1.
//      👥-rutan visar 💛 vid Leo och ingen Bli vänner-knapp längre.
//   5. Leo laddar om → Mira får "💛 Din vän Leo har precis hoppat in i Pixelstaden!", Leo får "Dina vänner i
//      Pixelstaden: Mira", och Leos start säger "inne" till servern (/van/inne)
//   6. Mira tar bort Leo (💔) → borta hos båda, servern får Miras tomma lista
//   7. Leo frågar igen och Mira säger Nej tack → Leo får veta det, ingen blir vän
//   node tools/vanner-test.mjs        (servern på 8788; annan port: SMOKE_PORT=8791)
import { createRequire } from 'module';
import http from 'node:http';
const require = createRequire('D:/Qisy/QISYFrontend/QISYFrontend-1/package.json');
const { chromium } = require('playwright');

const PORT = process.env.SMOKE_PORT || process.env.PORT || '8788', MOCK = 8799;
const WORLD = 'vn' + Date.now().toString(36);
const URL = `http://localhost:${PORT}/index.html?nomenu&world=${WORLD}&nettest=1&kbkpush=http://127.0.0.1:${MOCK}`;
let fails = 0;
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fails++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const errors = [];
// låtsas-pushservern: sparar varje anrop
const anrop = [];
const server = http.createServer((req, res) => {
  const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'content-type', 'access-control-allow-methods': 'POST, OPTIONS' };
  if (req.method === 'OPTIONS') { res.writeHead(204, cors); res.end(); return; }
  let body = ''; req.on('data', (c) => (body += c)); req.on('end', () => {
    try { anrop.push({ path: req.url, data: JSON.parse(body || '{}') }); } catch { /* ok */ }
    res.writeHead(200, { 'content-type': 'application/json', ...cors }); res.end(JSON.stringify({ ok: true }));
  });
}).listen(MOCK);
const browser = await chromium.launch();
const active = new Set();
const activity = setInterval(() => { for (const p of active) p.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Shift' }))).catch(() => {}); }, 1500);
const TOKEN = 'cd'.repeat(32);
const SAVE = { v: 1, day: 3, min: 600, money: 3000, hunger: 80, energy: 80, home: 'husvagn', fridge: {}, jobs: {}, earned: 0, mal: { id: 'rik', niva: 'latt' } };

async function player(name, id, color, app) {
  const context = await browser.newContext({ viewport: { width: 1100, height: 640 } });
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(`[${name}] ${String(e.stack || e.message).split(String.fromCharCode(10)).slice(0, 4).join(' | ')}`));
  page.on('console', (m) => m.type() === 'error' && !/peer|webrtc|ice|Could not connect|Failed to load|ERR_/i.test(m.text()) && errors.push(`[${name}] ${m.text()}`));
  if (app) await page.addInitScript((TOKEN) => {   // låtsas-iPhone-appen: bara pushmodulen
    let reg = [];
    window.__fragade = 0;
    window.Capacitor = { isNativePlatform: () => true, Plugins: { PushNotifications: {
      checkPermissions: async () => ({ receive: window.__fragade ? 'granted' : 'prompt' }),
      requestPermissions: async () => { window.__fragade++; return { receive: 'granted' }; },
      addListener: async (ev, cb) => { if (ev === 'registration') reg.push(cb); return { remove() {} }; },
      register: async () => { setTimeout(() => reg.forEach((cb) => cb({ value: TOKEN })), 50); },
    } } };
  }, TOKEN);
  // hälsningarna (toasts) samlas i window.__toasts
  await page.addInitScript(() => {
    window.__toasts = [];
    new MutationObserver((ms) => { for (const m of ms) for (const n of m.addedNodes) if (n.classList?.contains('toast')) window.__toasts.push(n.textContent); })
      .observe(document, { childList: true, subtree: true });
  });
  await page.goto(URL);
  await page.evaluate(([n, id, c, s]) => {
    localStorage.clear(); localStorage.setItem('snabbfilen_tips_hus', '1'); localStorage.setItem('snabbfilen_startguide_erbjuden', '1');
    localStorage.setItem('snabbfilen_avatar', JSON.stringify({ id, name: n, look: { skin: '#eabf98', shirt: c }, color: c }));
    localStorage.setItem('snabbfilen_save1', JSON.stringify(s));
  }, [name, id, color, SAVE]);
  await page.reload();
  await page.waitForFunction(() => !!window.SF?.worldInfo, null, { timeout: 15000 });
  await page.evaluate(() => { const m = document.querySelector('#modal'); m.classList.add('hidden'); m.innerHTML = ''; });
  active.add(page);
  return { name, context, page };
}
async function until(fn, ms = 20000, step = 250) {
  const end = Date.now() + ms;
  for (;;) { let v = false; try { v = await fn(); } catch { v = false; } if (v || Date.now() > end) return v; await sleep(step); }
}
const E = (p, fn, arg) => p.page.evaluate(fn, arg);
const SHOTS = process.env.SHOTS;   // (SHOTS=<mapp> sparar skärmbilder av rutorna)
const bild = async (p, namn) => { if (SHOTS) await p.page.screenshot({ path: `${SHOTS}/van-${namn}.png` }); };
const lista = (p) => E(p, async () => { const m = await import('/js/net/vanner.js'); return { mina: m.vanEgen(SF.avatar).vid, vanner: m.vanLista(SF.avatar).map((v) => ({ vid: v.vid, namn: v.namn })) }; });
const stang = (p) => E(p, () => { const m = document.querySelector('#modal'); m.classList.add('hidden'); m.innerHTML = ''; });
const toasts = (p) => E(p, () => window.__toasts.join(' | '));

try {
  // ---------- 1. i världen ----------
  const M = await player('Mira', 'id-mira', '#e04848', true);
  const L = await player('Leo', 'id-leo', '#3a78d8', false);
  ok(await until(async () => (await E(M, () => SF.playersList().length)) === 1 && (await E(L, () => SF.playersList().length)) === 1, 30000), 'Mira och Leo är i världen');
  await E(M, () => SF.go('city')); await E(L, () => SF.go('city'));   // (🚶 Gå dit finns när vännen är i staden)
  ok(await until(async () => (await E(M, () => SF.playersList()[0]?.scene)) === 'city'), 'båda står i staden');
  const vi = await E(M, () => SF.playersList()[0].vi);
  ok(/^[0-9a-f]{16}$/.test(vi || ''), `spelarlistan har Leos vän-id (vi ${vi})`);
  // 💛 spelarkortet (v0.136, Carl 2026-10-14: "jag stod bredvid någon men jag vet inte hur man blir vän"):
  // Leo ställer sig bredvid Mira, låser kameran så att Mira står på (100, 80) i rutan och trycker på henne
  const mp = await E(M, () => SF.scene._debug.pos());
  await E(L, ([x, y]) => SF.scene._debug.teleport(x + 20, y), [mp.x, mp.y]);
  const kort = await until(async () => {
    // (Leo trycker där han själv ser Mira: hennes plats i hans spelarlista minus kameran)
    await E(L, () => { const p = SF.playersList().find((q) => q.av?.name === 'Mira'), c = SF.scene._debug.cam(); if (p) SF.scene.down(Math.round(p.x - c.x), Math.round(p.y - 2 - c.y)); });
    return E(L, () => /Bli vänner/.test([...document.querySelectorAll('#modal:not(.hidden) .btn')].map((b) => b.textContent).join(' ')) && /Mira/.test(document.querySelector('#modal:not(.hidden) .dlg-head h2')?.textContent || ''));
  });
  if (!kort) console.log('   (Leo ser:', await E(L, () => JSON.stringify({ cam: SF.scene._debug.cam(), jag: SF.scene._debug.pos(), spelare: SF.playersList().map((p) => [p.av?.name, p.scene, p.x, p.y, p.vi]), modal: document.querySelector('#modal')?.className, text: document.querySelector('#modal')?.innerText?.slice(0, 120) })), 'Mira står på', JSON.stringify(mp) + ')');
  ok(kort, 'ett tryck på Mira i stan: spelarkortet med 💛 Bli vänner');
  await bild(L, '0-spelarkort');
  await stang(L);
  // 👥 kompisknappen vid emote-raden (Carl 2026-10-14): lyser med "1" när Mira står nära, och öppnar kortet
  ok(await until(() => E(L, () => document.querySelector('#emote-kompis')?.classList.contains('nara') && document.querySelector('#emote-kompis .mob-badge')?.textContent === '1')), 'kompisknappen vid emote-raden lyser: 1 spelare nära');
  await E(L, () => document.querySelector('#emote-kompis').click());
  ok(await until(() => E(L, () => /Bli vänner/.test([...document.querySelectorAll('#modal:not(.hidden) .btn')].map((b) => b.textContent).join(' ')) && /Mira/.test(document.querySelector('#modal:not(.hidden) .dlg-head h2')?.textContent || ''))), 'kompisknappen öppnar spelarkortet för Mira');
  await bild(L, '0-kompisknapp');
  await stang(L);
  await E(M, () => document.getElementById('hud-friends').click());
  ok(await until(() => E(M, () => !!document.querySelector('#modal [data-van]'))), '👥-rutan: 💛 Bli vänner vid Leo');
  await bild(M, '1-kompisar');

  // ---------- 2. frågan och svaret ----------
  await E(M, () => document.querySelector('#modal [data-van]').click());
  ok(/frågat Leo om ni ska bli vänner/.test(await toasts(M)), 'Mira: "Du har frågat Leo om ni ska bli vänner"');
  ok(await until(() => E(L, () => /Bli vänner\?/.test(document.querySelector('#modal:not(.hidden) .dlg-head h2')?.textContent || ''))), 'Leo får frågan: 💛 Bli vänner?');
  ok(/Mira/.test(await E(L, () => document.querySelector('#modal').innerText)), '…med Miras namn');
  await bild(L, '2-fragan');
  await E(L, () => [...document.querySelectorAll('#modal button')].find((b) => /Ja, vi blir vänner/.test(b.textContent)).click());
  ok(await until(async () => (await lista(M)).vanner.length === 1 && (await lista(L)).vanner.length === 1), 'båda har en vän');
  const lm = await lista(M), ll = await lista(L);
  ok(lm.vanner[0].vid === ll.mina && ll.vanner[0].vid === lm.mina && lm.vanner[0].namn === 'Leo' && ll.vanner[0].namn === 'Mira', 'Mira har Leo och Leo har Mira (rätt vän-id och namn)');
  ok(await until(async () => /Leo sa ja – ni är vänner nu/.test(await toasts(M))), 'Mira: "Leo sa ja – ni är vänner nu!"');
  ok(/Du och Mira är vänner nu/.test(await toasts(L)), 'Leo: "Du och Mira är vänner nu!"');

  // ---------- 3. servern ----------
  ok(await until(() => anrop.some((a) => a.path === '/van/vanner' && a.data.vid === lm.mina && a.data.vanner?.includes(ll.mina)) && anrop.some((a) => a.path === '/van/vanner' && a.data.vid === ll.mina && a.data.vanner?.includes(lm.mina))), 'servern får båda vänlistorna (/van/vanner)');
  const vv = anrop.find((a) => a.path === '/van/vanner' && a.data.vid === lm.mina)?.data || {};
  ok(/^[0-9a-f]{32}$/.test(vv.hemlig || '') && vv.namn === 'Mira', 'med figurens hemliga nyckel och namn');
  ok(await until(() => anrop.some((a) => a.path === '/van/registrera' && a.data.vid === lm.mina && a.data.token === TOKEN)), 'Miras telefon registreras för vännerna (/van/registrera med pushkoden)');
  ok(await E(M, () => window.__fragade === 1), 'Miras telefon frågade om lov att visa notiser');
  ok(!anrop.some((a) => a.path === '/van/registrera' && a.data.vid === ll.mina), 'Leo på webben registrerar ingen telefon');

  // ---------- 4. appen i mobilen ----------
  await stang(M);
  await E(M, () => document.getElementById('hud-mobil').click());
  await sleep(500);
  ok(await E(M, () => !!document.querySelector('#mobilen [data-app="vanner"] img')), 'mobilen har appen 💛 Vänner med pixelikonen');
  await sleep(800); await bild(M, '3-mobilen');
  ok(await until(() => E(M, () => document.querySelector('#mobilen [data-badge="vanner"]')?.textContent === '1')), 'siffran på appen: 1 vän i stan');
  await E(M, () => document.querySelector('#mobilen [data-app="vanner"]').click());
  ok(await until(() => E(M, () => document.querySelector('#modal:not(.hidden) .dlg-head h2')?.textContent === '💛 Vänner')), 'appen öppnar 💛 Vänner');
  const app = await E(M, () => ({ txt: document.querySelector('#modal').innerText, rader: document.querySelectorAll('#modal .prow').length, ga: !!document.querySelector('#modal [data-vgoto]'), ak: !!document.querySelector('#modal [data-vvisit]') }));
  ok(app.rader === 1 && /Leo/.test(app.txt) && /🟢/.test(app.txt), 'Leo står i listan, 🟢 i Pixelstaden nu');
  await bild(M, '4-vanner');
  ok(app.ga && app.ak, '…med 🚶 Gå dit och 🚗 Åk hem till');
  ok(/Notiserna är på/.test(app.txt), 'appen säger att notiserna är på');
  await stang(M);
  await E(M, () => document.getElementById('hud-friends').click());
  ok(await until(() => E(M, () => /💛 Leo/.test(document.querySelector('#modal').innerText) && !document.querySelector('#modal [data-van]'))), '👥-rutan: 💛 vid Leo och ingen Bli vänner-knapp längre');
  await stang(M);

  // ---------- 5. Leo laddar om ----------
  await E(M, () => { window.__toasts = []; });
  const fore = anrop.length;
  await L.page.reload();
  await L.page.waitForFunction(() => !!window.SF?.worldInfo, null, { timeout: 15000 });
  await stang(L); await E(L, () => SF.go('city'));
  ok(await until(async () => /💛 Din vän Leo har precis hoppat in i Pixelstaden!/.test(await toasts(M)), 30000), 'Mira: "💛 Din vän Leo har precis hoppat in i Pixelstaden!"');
  await bild(M, '5-halsning');
  ok(!/👋 Leo är i Pixelstaden/.test(await toasts(M)), '…i stället för den vanliga hälsningen');
  ok(await until(async () => /Dina vänner i Pixelstaden: Mira/.test(await toasts(L)), 15000), 'Leo: "💛 Dina vänner i Pixelstaden: Mira"');
  ok(await until(() => anrop.slice(fore).some((a) => a.path === '/van/inne' && a.data.vid === ll.mina && a.data.namn === 'Leo'), 15000), 'Leos start säger "inne" till servern (/van/inne)');

  // ---------- 6. ta bort ----------
  await E(M, () => document.getElementById('hud-mobil').click());
  await sleep(400);
  await E(M, () => document.querySelector('#mobilen [data-app="vanner"]').click());
  await until(() => E(M, () => !!document.querySelector('#modal [data-vbort]')));
  await E(M, () => document.querySelector('#modal [data-vbort]').click());
  await sleep(300);
  await E(M, () => [...document.querySelectorAll('#modal button')].find((b) => /Ja, ta bort/.test(b.textContent)).click());
  ok(await until(async () => (await lista(M)).vanner.length === 0 && (await lista(L)).vanner.length === 0), '💔 Mira tar bort Leo – borta hos båda');
  ok(await until(() => anrop.some((a) => a.path === '/van/vanner' && a.data.vid === lm.mina && Array.isArray(a.data.vanner) && a.data.vanner.length === 0)), 'servern får Miras tomma lista');

  // ---------- 7. Nej tack ----------
  await stang(M); await stang(L);
  await E(L, () => document.getElementById('hud-friends').click());
  await until(() => E(L, () => !!document.querySelector('#modal [data-van]')));
  await E(L, () => document.querySelector('#modal [data-van]').click());
  ok(await until(() => E(M, () => /Bli vänner\?/.test(document.querySelector('#modal:not(.hidden) .dlg-head h2')?.textContent || ''))), 'Leo frågar igen – Mira får frågan');
  await E(M, () => [...document.querySelectorAll('#modal button')].find((b) => /Nej tack/.test(b.textContent)).click());
  ok(await until(async () => /Mira vill inte bli vänner just nu/.test(await toasts(L))), 'Mira säger Nej tack – Leo får veta det');
  ok((await lista(M)).vanner.length === 0 && (await lista(L)).vanner.length === 0, '…och ingen blir vän');
} catch (e) {
  ok(false, 'kraschade: ' + String(e.message || e).split('\n')[0]);
} finally {
  clearInterval(activity);
  await browser.close();
  server.close();
}
ok(!errors.length, `inga fel i sidan${errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''}`);
console.log(fails ? `\n✗ ${fails} FEL` : '\nALLT GRÖNT');
process.exit(fails ? 1 : 0);
