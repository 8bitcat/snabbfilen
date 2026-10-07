// Språken (js/core/i18n.js, js/i18n/<id>.js): för varje språk startas spelet med ?lang=xx och vi kollar att
//   • menyn, spelets namn och språkväljaren visas på språket (och valet sparas och laddar om sidan)
//   • pengar visas i språkets valuta (kr / $ / € / zł)
//   • staden, Linnéstaden, piren och några butiker och dialoger öppnas utan fel
//   • ingen text visas utan översättning (window.__i18nMiss) och ingen svensk text syns i rutorna
//     (å, eller svenska småord – ä/ö räknas inte, tyskan har dem)
//   • ordlistorna täcker alla texter i koden (tools/i18n-nycklar.mjs) – svenska är oförändrad
// Kör: node tools/sprak-test.mjs   (servern på 8788, eller SMOKE_PORT / PORT)
import { createRequire } from 'module';
import { execFileSync } from 'child_process';
const require = createRequire('D:/Qisy/QISYFrontend/QISYFrontend-1/package.json');
const { chromium } = require('playwright');

const PORT = process.env.SMOKE_PORT || process.env.PORT || 8788;
let fails = 0;
const ok = (c, m) => { console.log((c ? 'ok: ' : 'FEL: ') + m); if (!c) fails++; };
const cov = execFileSync('node', ['tools/i18n-nycklar.mjs'], { encoding: 'utf8' });
const full = [...cov.matchAll(/(\w\w): (\d+)\/(\d+)/g)];
ok(full.length === 7 && full.every((m) => m[2] === m[3]), `ordlistorna täcker alla texter i koden (${full.map((m) => `${m[1]} ${m[2]}/${m[3]}`).join(', ')})`);

const SV = /[åÅ]|(?<!\p{L})(och|inte|är|för|med|kronor|kr|tugga|tuggor|lycka|mättnad)(?!\p{L})/iu;
const LANGS = { en: { title: 'THE FAST LANE', cur: /\$1,500/ }, es: { title: 'VÍA RÁPIDA', cur: /1\.?500 €/ }, de: { title: 'ÜBERHOLSPUR', cur: /1\.500 €/ }, fr: { title: 'LA VOIE RAPIDE', cur: /1\s?500 €/ }, pl: { title: 'SZYBKI PAS', cur: /1\s?500 zł/ }, it: { title: 'CORSIA VELOCE', cur: /1\.?500 €/ }, pt: { title: 'VIA RÁPIDA', cur: /1\.?500 €/ } };
const browser = await chromium.launch();
for (const [lang, want] of Object.entries(LANGS)) {
  const p = await browser.newPage({ viewport: { width: 1152, height: 648 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  p.on('console', (m) => m.type() === 'error' && !/favicon|ERR_|peer|Could not connect|Lost connection/i.test(m.text()) && errs.push(m.text()));
  await p.goto(`http://localhost:${PORT}/index.html?menu&lang=${lang}&world=lang${lang}${Date.now().toString(36)}`);
  await p.evaluate(() => {
    localStorage.clear(); localStorage.setItem('snabbfilen_tips_hus', '1');
    localStorage.setItem('snabbfilen_avatar', JSON.stringify({ name: 'Test', look: { skin: '#e0a97f', hair: '#3b2619', style: 'long', shirt: '#3a7bd5', pants: '#2d3a5c' }, color: '#ffd23f' }));
    localStorage.setItem('snabbfilen_save1', JSON.stringify({ v: 1, day: 3, min: 13 * 60, money: 1500, hunger: 60, energy: 80, home: 'husvagn', fridge: {}, jobs: {}, earned: 0, mal: { id: 'rik', niva: 'latt' } }));
  });
  await p.reload();
  await p.waitForFunction(() => !!window.SF?.game, null, { timeout: 30000 });
  await p.waitForTimeout(1200);
  const menu = await p.evaluate(() => ({ title: document.querySelector('.menu-title span')?.textContent || '', lang: document.documentElement.lang, sum: document.querySelector('.menu-card small')?.textContent || '' }));
  ok(menu.title.toUpperCase() === want.title && menu.lang === lang, `${lang}: menyn heter ${menu.title} (html lang=${menu.lang})`);
  ok(want.cur.test(menu.sum), `${lang}: pengarna i språkets valuta ("${menu.sum}")`);
  await p.evaluate(() => { document.querySelector('[data-continue]')?.click(); });
  await p.waitForTimeout(1800);
  const D = (fn, a) => p.evaluate(fn, a);
  await D(() => { const m = document.querySelector('#modal'); if (m) { m.classList.add('hidden'); m.innerHTML = ''; } if (SF.sceneName !== 'city') SF.go('city'); });
  await p.waitForTimeout(1200);
  for (const [x, y] of [[600, 300], [-600, 330], [-560, 913], [3300, 296], [2100, 296]]) { await D(([x, y]) => SF.scene._debug.teleport(x, y), [x, y]); await p.waitForTimeout(500); }
  for (const sc of ['sjoboden', 'kebab', 'klader', 'bank', 'room']) { await D((s) => SF.go(s), sc); await p.waitForTimeout(1300); }
  await D(() => SF.go('sjoboden')); await p.waitForTimeout(1300); await D(() => SF.scene._debug.openMenu()); await p.waitForTimeout(400);
  const modal = await D(() => document.querySelector('#modal')?.innerText || '');
  const r = await D(() => ({ miss: [...(window.__i18nMiss || [])], lines: (document.body.innerText || '').split('\n') }));
  r.sv = [...new Set(r.lines.filter((l) => SV.test(l)))].slice(0, 5);
  ok(modal.length > 40 && !SV.test(modal), `${lang}: Sjöbodens meny är översatt`);
  ok(!r.miss.length, `${lang}: inga texter utan översättning visades${r.miss.length ? ' – ' + r.miss.slice(0, 5).join(' | ') : ''}`);
  ok(!r.sv.length, `${lang}: ingen svensk text i rutorna${r.sv.length ? ' – ' + r.sv.join(' | ') : ''}`);
  ok(!errs.length, `${lang}: inga fel${errs.length ? ' – ' + [...new Set(errs)].slice(0, 3).join(' | ') : ''}`);
  await p.close();
}
// språkväljaren i menyn: byta språk sparar valet och laddar om på det nya språket
{
  const p = await browser.newPage({ viewport: { width: 1152, height: 648 } });
  await p.goto(`http://localhost:${PORT}/index.html?menu&world=langsel${Date.now().toString(36)}`);
  await p.evaluate(() => { localStorage.clear(); localStorage.setItem('snabbfilen_avatar', JSON.stringify({ name: 'Test', look: { skin: '#e0a97f', hair: '#3b2619', style: 'long' }, color: '#ffd23f' })); });
  await p.reload(); await p.waitForFunction(() => !!window.SF?.game, null, { timeout: 30000 }); await p.waitForTimeout(800);
  ok(await p.evaluate(() => document.documentElement.lang) === 'sv', 'robotarna börjar på svenska');
  await p.evaluate(() => document.querySelector('[data-settings]')?.click());
  await p.waitForTimeout(200);
  await Promise.all([p.waitForNavigation({ timeout: 20000 }).catch(() => {}), p.selectOption('#menu-lang', 'de')]);
  await p.waitForFunction(() => !!window.SF?.game, null, { timeout: 30000 }); await p.waitForTimeout(800);
  ok(await p.evaluate(() => document.documentElement.lang === 'de' && localStorage.getItem('snabbfilen_lang') === 'de'), 'språkväljaren: tyska valt, sparat och sidan laddad om på tyska');
  await p.close();
}
await browser.close();
console.log(fails ? `\n${fails} FEL` : '\nALLT GRÖNT');
process.exit(fails ? 1 : 0);
