// Simulerar ett släpp medan någon spelar: en kopia av spelet serveras på en egen port,
// version.json + js/version.js byts ut under tiden och vi kollar att spelet
//  - säger till (banderoll), men väntar med omladdningen medan man jobbar ett pass,
//  - sparar och laddar om när det passar, och att pengarna finns kvar efteråt,
//  - verkligen får den nya koden (service workern ger färska filer, inga gamla från cachen),
//  - tar en säkerhetskopia av sparningen vid versionsbytet,
//  - laddar om direkt även mitt i ett pass om släppet är markerat kritiskt.
//   node tools/update-test.mjs
import { createRequire } from 'module';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const require = createRequire('D:/Qisy/QISYFrontend/QISYFrontend-1/package.json');
const { chromium } = require('playwright');

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = process.env.UPDATE_PORT || '8793';
const DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'snabbfilen-upd-'));
for (const f of ['index.html', 'sw.js', 'version.json', 'CHANGELOG.md', 'js', 'css', 'assets']) fs.cpSync(path.join(ROOT, f), path.join(DIR, f), { recursive: true });
const listFiles = (d) => fs.readdirSync(path.join(DIR, d), { withFileTypes: true }).flatMap((e) => e.isDirectory() ? listFiles(path.join(d, e.name)) : [path.join(d, e.name).replace(/\\/g, '/')]);
const setVersion = (v, extra = {}) => {
  const files = ['index.html', 'sw.js', 'version.json', 'CHANGELOG.md', ...listFiles('js'), ...listFiles('css'), ...listFiles('assets')];
  fs.writeFileSync(path.join(DIR, 'version.json'), JSON.stringify({ version: v, date: '2026-09-28', title: 'Testversionen ' + v, files, ...extra }));
  const swp = path.join(DIR, 'sw.js');
  fs.writeFileSync(swp, fs.readFileSync(swp, 'utf8').replace(/const VERSION = '[^']*';/, `const VERSION = '${v}';`));
  fs.writeFileSync(path.join(DIR, 'js/version.js'), `export const VERSION = '${v}';\nexport const DATE = '2026-09-28';\nexport const TITLE = 'Testversionen ${v}';\n`);
};
const startV = JSON.parse(fs.readFileSync(path.join(DIR, 'version.json'), 'utf8')).version;

let fails = 0;
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fails++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, ms = 20000, step = 300) {
  const end = Date.now() + ms;
  for (;;) { let v = false; try { v = await fn(); } catch { v = false; } if (v || Date.now() > end) return v; await sleep(step); }
}

const server = spawn('python', ['-m', 'http.server', PORT, '--bind', '127.0.0.1'], { cwd: DIR, stdio: 'ignore' });
const browser = await chromium.launch();
const errors = [];
try {
  await sleep(800);
  const page = await browser.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  page.context().on('serviceworker', (w) => w.on('console', (m) => console.log('   [sw]', m.text())));
  page.on('console', (m) => { if (process.env.UPD_DEBUG && /\[sw\]|version/i.test(m.text())) console.log('   [sida]', m.text()); });
  await page.goto(`http://localhost:${PORT}/index.html?world=upd${Date.now().toString(36)}`);
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('snabbfilen_avatar', JSON.stringify({ name: 'Uppdatera', look: {}, color: '#e04848' }));
    localStorage.setItem('snabbfilen_save1', JSON.stringify({ v: 1, day: 1, min: 600, money: 100, hunger: 80, energy: 80, home: 'rum', fridge: {}, jobs: { flygplats: 0, frukt: 0, burgare: 0 }, earned: 0, wardrobe: [], storage: [], deco: {}, won: false }));
  });
  await page.reload();
  await page.waitForFunction(() => !!window.SF?.game);
  const swOk = await until(() => page.evaluate(() => !!navigator.serviceWorker?.controller));
  if (!swOk) console.log('   (sw-läge:', JSON.stringify(await page.evaluate(async () => { const r = await navigator.serviceWorker.getRegistration(); return { reg: !!r, active: r?.active?.state, inst: r?.installing?.state, wait: !!r?.waiting, url: location.href }; })), ')');
  ok(swOk, 'service workern styr sidan');
  ok(await page.evaluate(() => window.SF_VERSION) === startV, `startar på v${startV}`);

  // släpp 9.9.9 medan spelaren jobbar
  await page.evaluate(() => { window.__gammal = true; window.SF.go('jobbburgare', { onDone() {} }); });
  setVersion('9.9.9');
  await page.evaluate(() => window.SF_UPDATE.check());
  ok(await until(() => page.evaluate(() => /9\.9\.9/.test(document.querySelector('#sf-update')?.textContent || ''))), 'banderollen säger att v9.9.9 har kommit');
  ok(/passet är slut/.test(await page.evaluate(() => document.querySelector('#sf-update').textContent)), 'banderollen väntar tills passet är slut');
  await page.screenshot({ path: path.join(ROOT, 'tools/out/update-banner.png') });
  await sleep(13000);
  ok(await page.evaluate(() => window.__gammal === true && window.SF.sceneName === 'jobbburgare'), 'ingen omladdning mitt i passet');

  // passet slut → sparar och laddar om, pengarna kvar
  await page.evaluate(() => { window.SF.go('city'); window.SF.game.money = 777; });
  let reloaded = false;
  for (let i = 0; i < 70 && !reloaded; i++) {
    await sleep(1000);
    try {
      const st = await page.evaluate(async () => ({ v: window.SF_VERSION, gammal: window.__gammal, tries: sessionStorage.getItem('sf_upd_tries_9.9.9'), net: window.__fetchProbe ? (await (await fetch('js/version.js')).text()).match(/VERSION = '([^']+)'/)?.[1] : '-', ctrl: !!navigator.serviceWorker.controller, nav: performance.getEntriesByType('navigation')[0]?.type, caches: await caches.keys(), sw: await (async () => { const r = await navigator.serviceWorker.getRegistration(); return { i: !!r?.installing, w: !!r?.waiting, a: !!r?.active }; })(), banner: document.querySelector('#sf-update .txt')?.textContent?.slice(0, 40) }));
      if (process.env.UPD_DEBUG) console.log('   t+' + (i + 1), JSON.stringify(st));
      reloaded = st.gammal !== true && st.v === '9.9.9';
    } catch (e) { if (process.env.UPD_DEBUG) console.log('   t+' + (i + 1), 'navigerar'); }
  }
  if (!reloaded) console.log('   diagnos:', JSON.stringify(await page.evaluate(() => ({ banner: document.querySelector('#sf-update')?.textContent, pending: window.SF_UPDATE?.pending?.(), scene: window.SF?.sceneName, modal: !document.querySelector('#modal').classList.contains('hidden'), active: document.activeElement?.tagName, tries: sessionStorage.getItem('sf_upd_tries_9.9.9'), target: sessionStorage.getItem('sf_upd_target'), hidden: document.hidden }))));
  ok(reloaded, 'laddade om till v9.9.9 efter passet (färska filer, inte cachen)');
  await page.waitForFunction(() => !!window.SF?.game);
  ok(await page.evaluate(() => window.SF.game.money) === 777, 'pengarna sparades före omladdningen (777 kr)');
  ok(await until(() => page.evaluate(() => [...document.querySelectorAll('.toast')].some((t) => /Uppdaterat till v9\.9\.9/.test(t.textContent))), 6000, 150), 'toast: "Uppdaterat till v9.9.9! Allt du hade är kvar."');
  const backups = await page.evaluate(() => JSON.parse(localStorage.getItem('snabbfilen_backups') || '[]').map((b) => b.label));
  ok(backups.some((l) => l.includes(startV)), `säkerhetskopia vid versionsbytet (${backups.join(', ')})`);

  // kritiskt släpp laddar om även mitt i ett pass
  await page.evaluate(() => { window.__gammal = true; window.SF.go('jobbburgare', { onDone() {} }); });
  setVersion('9.9.10', { critical: true });
  await page.evaluate(() => window.SF_UPDATE.check());
  ok(await until(() => page.evaluate(() => window.__gammal !== true && window.SF_VERSION === '9.9.10'), 70000), 'kritiskt släpp laddade om trots pågående pass');

  // samma version igen → ingen loop
  await page.waitForFunction(() => !!window.SF?.game);
  await page.evaluate(() => { window.__stilla = true; });
  await page.evaluate(() => window.SF_UPDATE.check());
  await sleep(4000);
  ok(await page.evaluate(() => window.__stilla === true && !document.querySelector('#sf-update')), 'ingen ny omladdning när versionen redan stämmer');
} finally {
  await browser.close();
  server.kill();
  await sleep(300);
  fs.rmSync(DIR, { recursive: true, force: true });
}
console.log(errors.length ? '\nKONSOLFEL:\n' + errors.join('\n') : '\nInga konsolfel.');
ok(errors.length === 0, 'inga pageerror');
console.log(fails ? `\n${fails} FEL` : '\nALLT GRÖNT');
process.exit(fails ? 1 : 0);
