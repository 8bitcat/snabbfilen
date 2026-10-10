// Regressionstest för FIGURSKAPAREN STEG FÖR STEG (js/core/figursteg.js) – en ny spelare skapar sin figur:
//   • första start utan figur → figurskaparen med elva steg (namn, hud, frisyr … klar) och figuren till vänster
//   • namnet syns på namnskylten, Tillbaka är nedtonad på första steget
//   • frisyren: alla 151 frisyrer finns i sidorna, bläddringspilarna är gula på mörk list (Carl: "hon såg
//     inte dem"), FLER-pilen hoppar tills man bläddrat, → på tangentbordet bläddrar, grupperna hoppar
//   • ett klick på en ruta väljer (bocken flyttar), tärningen byter, Barn i Storlek, randig tröja + färg
//   • Fler detaljer → den stora redigeraren med figuren, Avbryt där → tillbaka till sista steget
//   • Spela utan namn → tillbaka till namnet med ett besked; Spela → figuren sparas och välkomstrutan visas
//   • telefonen liggande (iPhone 13 mini): allt ryms, frisyrerna visas i två rader
//   • inga fel i konsolen
// Kör: node tools/figursteg-test.mjs   (servern på 8788, eller SMOKE_PORT / PORT)
import { createRequire } from 'module';
const require = createRequire('D:/Qisy/QISYFrontend/QISYFrontend-1/package.json');
const { chromium } = require('playwright');

const PORT = process.env.SMOKE_PORT || process.env.PORT || 8788;
let fails = 0;
const ok = (c, m) => { console.log((c ? 'ok: ' : 'FEL: ') + m); if (!c) fails++; };
const browser = await chromium.launch();
const errs = [];
async function boot(opts = {}) {
  const ctx = await browser.newContext({ viewport: opts.vp || { width: 1280, height: 720 }, ...(opts.mob ? { screen: opts.vp, deviceScaleFactor: 3, isMobile: true, hasTouch: true } : {}) });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errs.push(e.message));
  p.on('console', (m) => m.type() === 'error' && !/favicon|peer|ERR_|Failed to load resource|Could not connect|Lost connection/i.test(m.text()) && errs.push(m.text()));
  await p.goto(`http://localhost:${PORT}/index.html?nomenu&world=fs${Date.now().toString(36)}`);
  await p.evaluate(() => localStorage.clear());
  await p.reload();
  await p.waitForFunction(() => !!document.querySelector('.dlg-steg'), null, { timeout: 30000 });
  await p.waitForTimeout(500);
  return { ctx, p };
}
const D = (p, fn, a) => p.evaluate(fn, a);
const steg = (p, id) => p.click(`.fs-steg[data-steg="${id}"]`).then(() => p.waitForTimeout(200));
const vald = (p) => D(p, () => document.querySelector('.fs-ruta.vald')?.title || '');

// ---- datorn ----
const { ctx, p } = await boot();
ok(await D(p, () => document.querySelectorAll('.fs-steg').length === 11 && !!document.querySelector('.fs-stall canvas')), 'första start: figurskaparen med elva steg och figuren till vänster');
ok(await D(p, () => document.querySelector('[data-b="tillbaka"]').disabled && document.querySelector('.fs-steg.nu')?.dataset.steg === 'namn'), 'första steget är namnet, Tillbaka är nedtonad');
await p.fill('#fs-namn', 'Lily');
ok(await D(p, () => document.querySelector('.fs-skylt').textContent === 'Lily'), 'namnet syns på namnskylten');
await p.click('[data-b="nasta"]'); await p.waitForTimeout(200);
ok(await D(p, () => document.querySelector('.fs-steg.nu')?.dataset.steg === 'skin' && document.querySelectorAll('.fs-ruta').length >= 9), 'Nästa → Hudton med rutor');

await steg(p, 'style');
const pil = await D(p, () => {
  const b = document.querySelector('.fs-pil[data-p="1"]'), l = document.querySelector('.fs-list');
  const bg = getComputedStyle(b).backgroundColor, lbg = getComputedStyle(l).backgroundColor;
  return { finns: !!b, bg, lbg, lockar: b.classList.contains('lockar'), text: b.textContent.trim(), sidor: document.querySelector('.fs-sidnr')?.textContent || '' };
});
const [, sid, av] = pil.sidor.match(/(\d+)\/(\d+)/) || [];
ok(pil.finns && /232, 178, 48|255, 210/.test(pil.bg) && /23, 21, 26/.test(pil.lbg), `bläddringspilarna är gula på en mörk list (${pil.bg} på ${pil.lbg})`);
ok(pil.lockar && /FLER/.test(pil.text), 'FLER-pilen hoppar innan man har bläddrat');
const fore = await vald(p);
await p.click('.fs-pil[data-p="1"]', { force: true }); await p.waitForTimeout(200); // (pilen hoppar med flit)
ok(await D(p, (s) => document.querySelector('.fs-sidnr').textContent.startsWith(String(+s + 1) + '/') && !document.querySelector('.fs-pil.lockar'), sid), 'FLER bläddrar en sida och slutar hoppa');
await p.keyboard.press('ArrowRight'); await p.waitForTimeout(200);
ok(await D(p, (s) => document.querySelector('.fs-sidnr').textContent.startsWith(String(+s + 2) + '/'), sid), '→ på tangentbordet bläddrar');
const grupp = await D(p, () => { const g = [...document.querySelectorAll('.fs-grupp')].find((x) => /Flätor|Braids/.test(x.textContent)); g?.click(); return !!g; });
await p.waitForTimeout(200);
ok(grupp && await D(p, () => /Flätor|Braids/.test(document.querySelector('.fs-grupp.nu')?.textContent || '')), 'gruppknappen Flätor hoppar till flätorna');
await p.click('.fs-ruta:not(.vald) >> nth=1'); await p.waitForTimeout(200);
const efter = await vald(p);
ok(efter && efter !== fore, `ett klick väljer en frisyr (${fore} → ${efter})`);
// alla frisyrer: första gruppen, sedan FLER tills pilen tar slut – rutorna räknas ihop
const antal = await D(p, async () => { const P = await import('./js/core/people.js'); return Object.keys(P.LOOK_FIELDS.style.reg).length; });
await p.click('.fs-grupp >> nth=0'); await p.waitForTimeout(150);
let summa = 0, sidor = 0;
for (let n = 0; n < 60; n++) {
  summa += await D(p, () => document.querySelectorAll('.fs-ruta').length); sidor++;
  if (await D(p, () => document.querySelector('.fs-pil[data-p="1"]')?.disabled !== false)) break;
  await p.click('.fs-pil[data-p="1"]', { force: true }); await p.waitForTimeout(120);
}
ok(summa === antal, `alla ${antal} frisyrer finns i sidorna (${summa} rutor på ${sidor} sidor, ${av} enligt räknaren)`);
await steg(p, 'eyes');
const ogon = await vald(p);
await p.click('[data-b="slump"]'); await p.waitForTimeout(200);
ok((await vald(p)) !== ogon, `tärningen byter ögonen (${ogon} → ${await vald(p)})`);
await steg(p, 'kropp');
await p.click('.fs-ruta[title="Barn"]'); await p.waitForTimeout(200);
ok((await vald(p)) === 'Barn', 'Storlek: Barn väljs');
await steg(p, 'top');
await p.click('.fs-ruta[title="Randig tröja"]'); await p.waitForTimeout(200);
await p.click('.fs-farg[data-c="#3a7bd5"], .fs-farg >> nth=1'); await p.waitForTimeout(200);
ok((await vald(p)) === 'Randig tröja' && await D(p, () => !!document.querySelector('.fs-farg.vald')), 'Överdel: randig tröja och en färg');
// Fler detaljer → stora redigeraren → Avbryt → tillbaka
await steg(p, 'klart');
ok(await D(p, () => /Lily/.test(document.querySelector('.fs-klart h3')?.textContent || '')), 'sista steget säger Snyggt, Lily!');
await p.click('[data-b="mer"]'); await p.waitForTimeout(400);
ok(await D(p, () => !!document.querySelector('.dlg-avatar') && document.querySelector('#av-name')?.value === 'Lily'), 'Fler detaljer öppnar den stora redigeraren med figuren');
await p.click('.dlg-avatar .dlg-foot .av-cancel'); await p.waitForTimeout(400);
ok(await D(p, () => !!document.querySelector('.dlg-steg') && document.querySelector('.fs-steg.nu')?.dataset.steg === 'klart' && document.querySelector('.fs-skylt').textContent === 'Lily'), 'Avbryt där → tillbaka till sista steget, figuren kvar');
// Spela utan namn → tillbaka till namnet
await steg(p, 'namn'); await p.fill('#fs-namn', ''); await steg(p, 'klart');
await p.click('.fs-spela'); await p.waitForTimeout(300);
ok(await D(p, () => document.querySelector('.fs-steg.nu')?.dataset.steg === 'namn' && !!document.querySelector('.fs-namnfalt.fel')), 'Spela utan namn → tillbaka till namnet med ett besked');
await p.fill('#fs-namn', 'Lily'); await steg(p, 'klart');
await p.click('.fs-spela'); await p.waitForTimeout(800);
const sparad = await D(p, () => JSON.parse(localStorage.getItem('snabbfilen_avatar') || '{}'));
ok(sparad.name === 'Lily' && sparad.look?.kid === true && sparad.look?.top === 'stripes', `Spela! sparar figuren (${sparad.name}, barn: ${sparad.look?.kid}, tröja: ${sparad.look?.top})`);
ok(await D(p, () => !document.querySelector('.dlg-steg') && /Välkommen|Welcome/.test(document.querySelector('#modal:not(.hidden) .dlg-head h2')?.textContent || '')), 'figurskaparen stängs och välkomstrutan visas');
await ctx.close();

// ---- telefonen i liggande läge ----
const M = await boot({ mob: true, vp: { width: 812, height: 375 } });
await steg(M.p, 'style');
const fit = await D(M.p, () => {
  const W = innerWidth, H = innerHeight, sk = 812 / W;
  const synlig = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.left >= 0 && r.top >= 0 && r.right <= W + 1 && r.bottom <= H + 1; };
  const knappar = [...document.querySelectorAll('.fs-steg, .fs-pil, [data-b], .fs-x')];
  const rader = new Set([...document.querySelectorAll('.fs-ruta')].map((r) => Math.round(r.getBoundingClientRect().top))).size;
  const minPt = Math.min(...knappar.map((b) => b.getBoundingClientRect().height * sk));
  return { alla: knappar.every(synlig), rader, minPt: Math.round(minPt), W, H };
});
ok(fit.alla, `telefonen: alla knappar ryms på skärmen (${fit.W}×${fit.H})`);
ok(fit.rader >= 2, `telefonen: frisyrerna visas i ${fit.rader} rader`);
ok(fit.minPt >= 28, `telefonen: knapparna är minst ${fit.minPt} pt höga`);
await M.p.screenshot({ path: 'tools/out/figursteg-telefon.png' });
await M.ctx.close();

ok(!errs.length, `inga fel${errs.length ? ' – ' + [...new Set(errs)].slice(0, 3).join(' | ') : ''}`);
await browser.close();
console.log(fails ? `\n${fails} FEL` : '\nALLT GRÖNT');
process.exit(fails ? 1 : 0);
