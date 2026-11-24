// 📲 BJUD IN TILL DOCKHUSET MED NOTIS (v0.178, js/net/dockdela.js + vanpush.js vanDockBjud/vanDockHamta + dockskap.js
// menyVanner) – Carl 2026-11-24: "jag kunde inte bjuda in mina kompisar i dockskåpet, jag vill att när man bjuder in en
// kompis så skickas det en notis för dem som sedan tar dem rätt in i deras hus så kan de bygga tillsammans".
// Över riktiga PeerJS-molnet i en egen värld, mot en låtsasserver (som server/kbk-push: vänlistor + inbjudningar).
//   1. Mira, Leo och Ella står i HUVUDMENYN (inget spel startat). Mira öppnar Dockskåpet därifrån → hon kopplas upp
//      mot världen ändå. Hon ställer ut ett piano.
//   2. 👫: Leo och Ella står i listan "📲 Dina vänner" (de är inte i Pixelstaden). Mira trycker 📲 Leo → servern får
//      /van/dock till Leo, Mira får "📲 Inbjudan skickad".
//   3. Leo (fortfarande i menyn) tittar efter inbjudningar → rutan "👫 Leka ihop?" med Miras namn → Kom! → menyn
//      stängs, Dockskåpet öppnas, Leo kommer in i världen och rätt in i Miras hus: han ser pianot, Mira ser gästen.
//   4. Ella trycker på notisen (samma väg som appens notistryck: dockVantaPaVard med Miras vän-id) → också hos Mira.
//   5. Leo bygger: han ställer in en soffa → den syns hos Mira (de bygger tillsammans).
//   node tools/dockskap-bjud-test.mjs          (servern på 8788; annan port: SMOKE_PORT=8791)
import { createRequire } from 'module';
import http from 'node:http';
const require = createRequire('D:/Qisy/QISYFrontend/QISYFrontend-1/package.json');
const { chromium } = require('playwright');
const PORT = process.env.SMOKE_PORT || process.env.PORT || '8788', MOCK = 8797;
const WORLD = 'db' + Date.now().toString(36);
let fails = 0;
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fails++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// ---- låtsasservern ----
const listor = {}, ladan = {}, anrop = [];
const server = http.createServer((req, res) => {
  const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'content-type', 'access-control-allow-methods': 'POST, OPTIONS' };
  if (req.method === 'OPTIONS') { res.writeHead(204, cors); res.end(); return; }
  let body = ''; req.on('data', (c) => (body += c)); req.on('end', () => {
    const d = JSON.parse(body || '{}'), svar = (o, st = 200) => { res.writeHead(st, { 'content-type': 'application/json', ...cors }); res.end(JSON.stringify(o)); };
    anrop.push({ path: req.url, data: d, t: Date.now() });
    if (req.url === '/van/vanner') { listor[d.vid] = d.vanner || []; return svar({ ok: true }); }
    if (req.url === '/van/dock') {
      if (!(listor[d.vid] || []).includes(d.till) || !(listor[d.till] || []).includes(d.vid)) return svar({ ok: false, fel: 'inte vänner' }, 403);
      const id = 'd' + anrop.length;
      ladan[d.till] = [...(ladan[d.till] || []).filter((x) => x.fvid !== d.vid), { id, fran: d.namn, fvid: d.vid, t: Date.now() }];
      return svar({ ok: true, id, skickade: 1 });
    }
    if (req.url === '/van/dock/hamta') { const l = ladan[d.vid] || []; ladan[d.vid] = []; return svar({ ok: true, inbjudningar: l }); }
    if (req.url === '/van/sms/hamta') return svar({ ok: true, sms: [] });
    if (req.url === '/van/hamta') return svar({ ok: true, presenter: [] });
    return svar({ ok: true });
  });
}).listen(MOCK);

const browser = await chromium.launch();
const errors = [];
const active = new Set();
const activity = setInterval(() => { for (const p of active) p.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Shift' }))).catch(() => {}); }, 1500);
const V = { Mira: { vid: '1a'.repeat(8), hemlig: 'a1'.repeat(16) }, Leo: { vid: '2b'.repeat(8), hemlig: 'b2'.repeat(16) }, Ella: { vid: '3c'.repeat(8), hemlig: 'c3'.repeat(16) } };
const VANNER = { Mira: ['Leo', 'Ella'], Leo: ['Mira'], Ella: ['Mira'] };
async function iMenyn(namn, color) {
  const context = await browser.newContext({ viewport: { width: 1000, height: 620 } });
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(`[${namn}] ${String(e.stack || e.message).split('\n').slice(0, 3).join(' | ')}`));
  page.on('console', (m) => m.type() === 'error' && !/peer|webrtc|ice|Could not connect|Failed to load|ERR_/i.test(m.text()) && errors.push(`[${namn}] ${m.text()}`));
  await page.addInitScript(() => { window.__toasts = []; new MutationObserver((ms) => { for (const m of ms) for (const n of m.addedNodes) if (n.classList?.contains('toast')) window.__toasts.push(n.textContent); }).observe(document, { childList: true, subtree: true }); });
  await page.goto(`http://localhost:${PORT}/index.html?menu&world=${WORLD}&nettest=1&kbkpush=http://127.0.0.1:${MOCK}`);
  await page.evaluate(([namn, color, V, VANNER]) => {
    const id = 'av-' + namn.toLowerCase();
    localStorage.clear(); localStorage.setItem('snabbfilen_tips_hus', '1'); localStorage.setItem('snabbfilen_startguide_erbjuden', '1');
    localStorage.setItem('snabbfilen_avatar', JSON.stringify({ id, name: namn, look: { skin: '#eabf98', shirt: color }, color }));
    localStorage.setItem('snabbfilen_vanner', JSON.stringify({ [id]: { ...V[namn], lista: VANNER[namn].map((n) => ({ vid: V[n].vid, key: 'nyckel-' + n, namn: n, look: { skin: '#c68a5e' }, sedan: '2026-11-20', sett: Date.now() })) } }));
  }, [namn, color, V, VANNER]);
  await page.reload();
  await page.waitForFunction(() => !!window.SF?.openDockskap && !document.querySelector('.menu')?.classList.contains('hidden'), null, { timeout: 20000 }).catch(() => {});
  await sleep(800);
  // (vänlistan till låtsasservern – i spelet sker det vid start och när listan ändras)
  await page.evaluate(async () => { const m = await import('/js/net/vanpush.js'); await m.vanPushSynka(window.SF); });
  active.add(page);
  return { namn, context, page };
}
async function until(fn, ms = 20000, step = 250) {
  const end = Date.now() + ms;
  for (;;) { let v = false; try { v = await fn(); } catch { v = false; } if (v || Date.now() > end) return v; await sleep(step); }
}
const E = (p, fn, arg) => p.page.evaluate(fn, arg);
const dbg = (p, expr) => p.page.evaluate(`(() => { const d = window.SF.scene._debug; return (${expr}); })()`);
const modalText = (p) => E(p, () => (document.getElementById('modal').classList.contains('hidden') ? '' : document.getElementById('modal').textContent || ''));

try {
  const M = await iMenyn('Mira', '#e04848'), L = await iMenyn('Leo', '#2d7ff9'), El = await iMenyn('Ella', '#3fb950');
  ok(await E(M, () => window.SF.attract === true && window.SF.worldInfo().role === 'off'), 'Mira står i huvudmenyn (spelet inte startat) och är inte uppkopplad');

  // ---------- 1. Dockskåpet från huvudmenyn kopplar upp ----------
  await E(M, () => document.querySelector('[data-dockskap]').click());
  await M.page.waitForFunction(() => window.SF?.sceneName === 'dockskap' && !!window.SF.scene?._debug?.rooms, null, { timeout: 15000 });
  ok(await until(() => dbg(M, 'd.myId()'), 30000), 'Dockskåpet från huvudmenyn: Mira kommer ut i världen (har ett spelar-id)');
  await dbg(M, "d.setLage('bygga')");
  ok(await dbg(M, "d.place('piano', 0, 300, 200)"), 'Mira ställer ut ett piano');

  // ---------- 2. 👫 → 📲 Leo ----------
  await M.page.click('#dock-lage [data-vanner]');
  await sleep(400);
  const knappar = await E(M, () => [...document.querySelectorAll('#modal [data-push]')].map((b) => b.textContent.trim()));
  ok(knappar.some((t) => /Leo/.test(t)) && knappar.some((t) => /Ella/.test(t)), `👫: "📲 Dina vänner" visar Leo och Ella fast de inte är inne (${knappar.join(', ')})`);
  await E(M, () => [...document.querySelectorAll('#modal [data-push]')].find((b) => /Leo/.test(b.textContent)).click());
  ok(await until(() => anrop.some((a) => a.path === '/van/dock' && a.data.vid === V.Mira.vid && a.data.till === V.Leo.vid), 5000), 'servern får inbjudan från Mira till Leo (/van/dock) – den blir en pushnotis i Leos telefon');
  ok(await until(() => E(M, () => window.__toasts.some((t) => /Inbjudan skickad till Leo/.test(t))), 4000), 'Mira får "📲 Inbjudan skickad till Leo …"');

  // ---------- 3. Leo i menyn: rutan → Kom! → rätt in i Miras hus ----------
  await E(L, async () => { const m = await import('/js/net/dockdela.js'); await m.dockKollaInbjudningar(window.SF); });
  ok(await until(async () => /Leka ihop/.test(await modalText(L)) && /Mira/.test(await modalText(L)), 6000), 'Leo (i huvudmenyn) får rutan "👫 Leka ihop?" med Miras namn');
  await L.page.click('#modal .dlg-foot .btn:has-text("Kom!")');
  ok(await until(() => E(L, () => window.SF.sceneName === 'dockskap' && document.querySelector('.menu')?.classList.contains('hidden') !== false), 8000), 'Leo: menyn stängs och Dockskåpet öppnas');
  const gast = await until(async () => { const nv = await dbg(L, 'd.natv()'); return nv?.roll === 'gast' && nv.hus === true; }, 45000);
  ok(gast, 'Leo kommer ut i världen och rätt in i Miras hus');
  ok(await until(() => dbg(L, "d.deco(0).some((d) => d.k === 'piano')"), 6000), 'Leo ser Miras piano');
  ok(await until(async () => (await dbg(M, 'd.natv()'))?.gaster?.length === 1, 8000), 'Mira ser att Leo kom');

  // ---------- 4. Ella trycker på notisen ----------
  await E(M, () => [...document.querySelectorAll('#modal [data-push]')].find((b) => /Ella/.test(b.textContent))?.click());
  await dbg(M, 'd.bjudInPush && d.bjudInPush(' + JSON.stringify(V.Ella.vid) + ", 'Ella')");
  ok(await until(() => anrop.some((a) => a.path === '/van/dock' && a.data.till === V.Ella.vid), 5000), 'Mira bjuder in Ella också (/van/dock)');
  await E(El, (vid) => import('/js/net/dockdela.js').then((m) => m.dockVantaPaVard(window.SF, vid, 'Mira')), V.Mira.vid);
  ok(await until(async () => { const nv = await dbg(El, 'd.natv()'); return nv?.roll === 'gast' && nv.hus === true; }, 45000), 'Ella trycker på notisen → rätt in i Miras hus');
  ok(await until(async () => (await dbg(M, 'd.natv()'))?.gaster?.length === 2, 8000), 'Mira har två gäster');

  // ---------- 5. de bygger tillsammans ----------
  await dbg(L, "d.setLage('bygga')");
  ok(await dbg(L, "d.place('soffa', 0, 150, 210)") && await until(() => dbg(M, "d.deco(0).some((d) => d.k === 'soffa')"), 6000), 'Leo ställer in en soffa – den står i Miras hus (de bygger tillsammans)');
  ok(await until(() => dbg(El, "d.deco(0).some((d) => d.k === 'soffa')"), 6000), 'Ella ser Leos soffa också');
} catch (e) {
  ok(false, String(e.stack || e.message || e).split('\n').slice(0, 3).join(' | '));
}
const egna = errors.filter((e) => !/peer|unavailable-id|Lost connection/i.test(e));
ok(!egna.length, `inga fel i sidorna${egna.length ? ' – ' + egna.slice(0, 3).join(' || ') : ''}`);
clearInterval(activity);
await browser.close();
server.close();
console.log(fails ? `\n${fails} FEL` : '\nALLT GRÖNT');
process.exit(fails ? 1 : 0);
