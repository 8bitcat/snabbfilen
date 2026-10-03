// Funktionstest av appens uppdateringar (js/core/version-ui.js, grenen för iOS-appen Pixelcity):
// sidan körs med en låtsad Capacitor (isNativePlatform + CapacitorUpdater) och en låtsad version.json
// på webben, och vi kontrollerar att
//   1. spelet säger "paketet fungerar" (notifyAppReady) först när det är igång
//   2. en nyare version på webben → samma ruta som på webben → paketet hämtas från GitHub-releasen
//      och appen byter till det (download + set) i stället för att ladda om sidan
//   3. går nedladdningen fel försvinner rutan och nästa koll försöker igen; appen går aldrig bakåt
//   4. på webben (utan Capacitor) är allt som förut: version.json läses från sidan själv
//   node tools/app-uppdatering-test.mjs      (servern på 8788; annan port: SMOKE_PORT=8791 eller PORT=…)
import { createRequire } from 'module';
const require = createRequire('D:/Qisy/QISYFrontend/QISYFrontend-1/package.json');
const { chromium } = require('playwright');

const PORT = process.env.SMOKE_PORT || process.env.PORT || 8788;
let fails = 0;
const ok = (c, m) => { console.log(c ? `ok: ${m}` : `FEL: ${m}`); if (!c) fails++; };
const browser = await chromium.launch();

async function sida({ app, webbVersion, nedladdningFel = false }) {
  const ctx = await browser.newContext({ viewport: { width: 1100, height: 700 } });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  if (app) {
    await p.addInitScript((fel) => {
      window.__app = { ready: 0, download: [], set: [] };
      window.Capacitor = {
        isNativePlatform: () => true,
        Plugins: { CapacitorUpdater: {
          notifyAppReady: async () => { window.__app.ready++; window.__app.readyGame = !!window.SF?.game; return {}; },
          download: async (o) => { window.__app.download.push(o); if (window.__appFel ?? fel) throw new Error('404'); return { id: 'paket-' + o.version, version: o.version }; },
          set: async (o) => { window.__app.set.push(o); },
        } },
      };
    }, nedladdningFel);
  }
  // version.json på webben (appen läser den därifrån) – sidans egen version.json lämnas orörd
  const hamtade = [];
  await p.route('https://8bitcat.github.io/snabbfilen/version.json*', (r) => { hamtade.push(r.request().url()); r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ version: webbVersion, title: 'Provversionen', files: [] }) }); });
  await p.goto(`http://localhost:${PORT}/index.html?nomenu&world=appupd${Date.now().toString(36)}`);
  await p.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('snabbfilen_tips_hus', '1');
    localStorage.setItem('snabbfilen_avatar', JSON.stringify({ name: 'Appen', look: { skin: '#eec3a0', hair: '#6b4226', style: 'short', shirt: '#46a35a', pants: '#2d3a5c' }, color: '#46a35a' }));
    localStorage.setItem('snabbfilen_save1', JSON.stringify({ v: 1, day: 2, min: 600, money: 500, hunger: 80, energy: 90, home: 'rum', fridge: {}, jobs: {}, earned: 0 }));
  });
  await p.reload();
  await p.waitForFunction(() => !!window.SF?.game, null, { timeout: 20000 });
  await p.waitForTimeout(500);
  await p.evaluate(() => { const m = document.querySelector('#modal'); if (m && !m.classList.contains('hidden')) { m.classList.add('hidden'); m.innerHTML = ''; } });
  return { p, ctx, errs, hamtade };
}
const until = async (p, fn, ms = 20000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await p.evaluate(fn)) return true; await p.waitForTimeout(150); } return false; };

// ---------- 1 + 2: appen, nyare version på webben ----------
{
  const { p, ctx, errs, hamtade } = await sida({ app: true, webbVersion: '9.9.9' });
  ok(await until(p, () => window.__app.ready === 1, 6000), 'appen: notifyAppReady en gång');
  ok(await p.evaluate(() => window.__app.readyGame), 'notifyAppReady först när spelet är igång (SF.game finns)');
  await p.evaluate(() => window.dispatchEvent(new Event('focus')));
  ok(await until(p, () => /v9\.9\.9 har kommit/.test(document.querySelector('#sf-update')?.textContent || ''), 8000), 'nyare version på webben → samma ruta som på webben');
  ok(hamtade.length > 0, `version.json lästes från webben (${hamtade[0]?.slice(0, 60)}…)`);
  ok(await until(p, () => window.__app.set.length === 1, 20000), 'efter nedräkningen: appen byter paket (set)');
  const d = await p.evaluate(() => window.__app);
  ok(d.download[0]?.url === 'https://github.com/8bitcat/snabbfilen/releases/download/v9.9.9/pixelcity-9.9.9.zip' && d.download[0]?.version === '9.9.9', `paketet hämtas från GitHub-releasen (${d.download[0]?.url})`);
  ok(d.set[0]?.id === 'paket-9.9.9', 'set med det nedladdade paketets id');
  ok(!errs.length, `inga fel (${errs.slice(0, 2).join(' | ')})`);
  await ctx.close();
}
// ---------- 3: nedladdningen misslyckas → rutan försvinner, nästa koll försöker igen ----------
{
  const { p, ctx, errs } = await sida({ app: true, webbVersion: '9.9.9', nedladdningFel: true });
  await p.evaluate(() => window.dispatchEvent(new Event('focus')));
  ok(await until(p, () => window.__app.download.length === 1, 20000), 'nedladdningen provas');
  ok(await until(p, () => !document.querySelector('#sf-update'), 4000), 'misslyckad nedladdning → rutan försvinner');
  ok((await p.evaluate(() => window.__app.set.length)) === 0, 'inget paketbyte när nedladdningen misslyckas');
  await p.evaluate(() => { window.__appFel = false; window.dispatchEvent(new Event('focus')); });
  ok(await until(p, () => window.__app.set.length === 1, 20000), 'nästa koll: hämtas igen och byter');
  ok(!errs.length, `inga fel (${errs.slice(0, 2).join(' | ')})`);
  await ctx.close();
}
// ---------- appen går aldrig bakåt ----------
{
  const { p, ctx } = await sida({ app: true, webbVersion: '0.0.1' });
  await p.evaluate(() => window.dispatchEvent(new Event('focus')));
  await p.waitForTimeout(2500);
  ok(!(await p.evaluate(() => !!document.querySelector('#sf-update'))) && (await p.evaluate(() => window.__app.download.length)) === 0, 'äldre version på webben → ingen ruta, ingen nedladdning');
  await ctx.close();
}
// ---------- 4: webben som förut ----------
{
  const { p, ctx, hamtade } = await sida({ app: false, webbVersion: '9.9.9' });
  await p.evaluate(() => window.dispatchEvent(new Event('focus')));
  await p.waitForTimeout(2500);
  ok(hamtade.length === 0 && !(await p.evaluate(() => !!document.querySelector('#sf-update'))), 'webben: version.json läses från sidan själv, ingen ruta när versionen är samma');
  await ctx.close();
}
await browser.close();
console.log(fails ? `\n${fails} FEL` : '\nALLA OK');
process.exit(fails ? 1 : 0);
