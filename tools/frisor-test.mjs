// Frisören (js/scenes/shop-frisor.js): gå in, sätt dig i en stol, välj frisyr + färg i väljaren,
// betala, se klippningen och gå ut med den nya frisyren (sparad i avataren). Dessutom: för lite
// pengar, frisyrboken, väntsoffan, dörren ut, salongens liv (kunder kommer och går) och flaggan
// som låter garderoben hemma sluta erbjuda frisyrer (setAvatarSalon i js/core/avatar.js).
// Kör: node tools/frisor-test.mjs   (servern på 8788, eller SMOKE_PORT/PORT)
// Bilder: tools/out/klad-frisor/test-*.png
import { createRequire } from 'module';
import fs from 'fs';
const require = createRequire('D:/Qisy/QISYFrontend/QISYFrontend-1/package.json');
const { chromium } = require('playwright');
const PORT = process.env.SMOKE_PORT || process.env.PORT || 8788;
const OUT = new URL('./out/klad-frisor/', import.meta.url);
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
let fails = 0;
const ok = (c, m) => { console.log((c ? 'ok: ' : 'FEL: ') + m); if (!c) fails++; };
const errs = [];
const watch = (page) => {
  page.on('pageerror', (e) => errs.push(e.message));
  page.on('console', (m) => m.type() === 'error' && !/peer|ERR_|Failed to load resource|WebSocket/i.test(m.text()) && errs.push(m.text()));
};
const LOOK = { skin: '#e0a97f', hair: '#6b4226', style: 'long', shirt: '#3a7bd5', pants: '#2d3a5c', top: 'hoodie', hat: 'beanie', cap: '#d9433b' };
async function boot(page, { money = 1000, query = '' } = {}) {
  await page.goto(`http://localhost:${PORT}/index.html?world=fr${Date.now().toString(36)}${query}`);
  await page.evaluate(([look, money]) => {
    localStorage.setItem('snabbfilen_avatar', JSON.stringify({ name: 'Klipp', look, color: '#ffd23f' }));
    localStorage.setItem('snabbfilen_save1', JSON.stringify({ v: 1, day: 4, min: 11 * 60, money, hunger: 90, energy: 90, home: 'rum', fridge: {}, jobs: {}, earned: 0 }));
  }, [LOOK, money]);
  await page.reload();
  await page.waitForFunction(() => window.SF?.game, null, { timeout: 20000 });
  await page.waitForTimeout(600);
  await page.evaluate(() => document.querySelector('#modal:not(.hidden) .dlg-foot .btn')?.click());
}
const st = (page) => page.evaluate(() => window.SF.scene._debug.state());
// klick i scenen på en klickbar sak (scenkoordinater → sidkoordinater)
async function clickSpot(page, id) {
  const p = await page.evaluate((id) => {
    const A = window.SF, s = A.scene._debug.spot(id), cv = document.querySelector('#scene'), r = cv.getBoundingClientRect();
    if (!s) return null;
    const lw = cv.width / A.pxs, lh = cv.height / A.pxs;
    return { x: r.left + (s.x + A.view.boxX) * r.width / lw, y: r.top + (s.y + A.view.boxY) * r.height / lh };
  }, id);
  if (!p) return false;
  await page.mouse.click(p.x, p.y);
  return true;
}
const until = async (page, fn, arg, ms = 8000) => { try { await page.waitForFunction(fn, arg, { timeout: ms }); return true; } catch { return false; } };

// ================= 1. in i salongen, sätt dig, välj, betala, klipp =================
const page = await browser.newPage({ viewport: { width: 1200, height: 760 } });
watch(page);
await boot(page);
await page.evaluate(() => window.SF.go('frisor'));
await page.waitForTimeout(700);
let s = await st(page);
ok(await page.evaluate(() => window.SF.sceneName === 'frisor'), 'scenen frisor öppnas');
ok(s.custs.length >= 1 && s.chairs[0] === 'kund' && s.fia.state === 'cut', `salongen lever: ${s.custs.length} kunder, Fia klipper i stol 1`);
const pano = await page.evaluate(() => window.SF.scene._debug.panorama(2));
fs.writeFileSync(new URL('test-salong.png', OUT), Buffer.from(pano.split(',')[1], 'base64'));

// gå fram till stol 2 genom att klicka på den
await page.evaluate(() => window.SF.scene._debug.teleport(200, 140));
ok(await clickSpot(page, 'stol1'), 'klick på frisörstol 2');
ok(await until(page, () => window.SF.scene._debug.state().me.state === 'chair', null, 10000), 'figuren går fram och sätter sig i stolen');
ok(await until(page, () => !!document.querySelector('.dlg-frisor'), null, 10000), 'Sami kommer fram och väljaren öppnas');
s = await st(page);
ok(s.sami.state === 'atChair', `Sami står vid stolen (${s.sami.state})`);
await page.waitForTimeout(400);
await page.screenshot({ path: new URL('test-valjare.png', OUT).pathname.replace(/^\/([A-Z]:)/, '$1') });

// alla frisyrer finns i väljaren (grupperade)
const counts = await page.evaluate(async () => {
  const { LOOK_FIELDS } = await import('./js/core/people.js');
  const chips = [...document.querySelectorAll('.fr-chip b')].map((b) => +b.textContent);
  return { reg: Object.keys(LOOK_FIELDS.style.reg).length, sum: chips.reduce((a, b) => a + b, 0), groups: chips.length };
});
ok(counts.sum === counts.reg && counts.groups >= 12, `väljaren har alla ${counts.reg} frisyrer i ${counts.groups} grupper`);
ok(counts.reg >= 150, `många fler frisyrer än förut (${counts.reg} ≥ 150)`);
let bill = '';
const goDisabled = await page.evaluate(() => document.querySelector('.fr-go')?.disabled);
ok(goDisabled === true, 'Klipp-knappen är avstängd tills man valt något nytt');
// den nya gruppen Kul: kattöron m.m. kostar som en uppsättning (200 kr)
await page.click('.fr-chip[data-g="Kul"]');
const kul = await page.evaluate(() => ({ n: document.querySelectorAll('.fr-tile[data-style]').length, price: document.querySelector('.fr-price')?.textContent || '' }));
ok(kul.n >= 6 && /200/.test(kul.price), `gruppen Kul: ${kul.n} frisyrer, ${kul.price.trim()}`);
await page.click('.fr-tile[data-style="catEars"]');
bill = await page.evaluate(() => document.querySelector('[data-bill]').innerText);
ok(/200 kr/.test(bill) && /Kattöron/.test(bill), `kvittot: kattöron 200 kr (${bill.split('\n')[0]})`);
await page.waitForTimeout(500);
await page.screenshot({ path: new URL('test-valjare-kul.png', OUT).pathname.replace(/^\/([A-Z]:)/, '$1') });
// några av de nya i andra grupper finns i väljaren (ritade rutor)
for (const [g, id] of [['Kort hår', 'edgar'], ['Långt hår', 'superLong'], ['Afro', 'bantu'], ['Flätor', 'braidsLong']]) {
  await page.click(`.fr-chip[data-g="${g}"]`);
  ok(await until(page, (id) => !!document.querySelector(`.fr-tile[data-style="${id}"] canvas`), id, 4000), `${g}: ${id} finns och har en ritad förhandsbild`);
}
await page.click('.fr-chip[data-g="Rakat"]');
await page.click('.fr-tile[data-style="mohawk"]');
bill = await page.evaluate(() => document.querySelector('[data-bill]').innerText);
ok(/100 kr/.test(bill) && /Tuppkam/.test(bill), `kvittot: tuppkam 100 kr (${bill.split('\n').slice(0, 2).join(' ')})`);
await page.click('.fr-tab[data-tab="farg"]');
await page.click('.fr-sw[data-hair="#3fc4ff"]');
bill = await page.evaluate(() => document.querySelector('[data-bill]').innerText);
ok(/Summa\s*350 kr/.test(bill), 'klippning + färgning = 350 kr');
const goTxt = await page.evaluate(() => ({ t: document.querySelector('.fr-go').textContent, d: document.querySelector('.fr-go').disabled }));
ok(!goTxt.d && /350/.test(goTxt.t), `knappen: ${goTxt.t.trim()}`);
const figs = await page.evaluate(() => document.querySelectorAll('.fr-fig canvas').length);
ok(figs === 2, 'förhandsbild: du nu + efter');
await page.click('.fr-go');
await page.waitForTimeout(200);
s = await st(page);
ok(!!s.seq && s.money === 650, `betalt och klippningen börjar (${s.money} kr, fas ${s.seq?.phase})`);
ok(await page.evaluate(() => !document.querySelector('.dlg-frisor')), 'väljaren stängs');
// sekvensen: sax i live, hårtussar
await page.evaluate(() => window.SF.scene._debug.seqAt(6.5));
await page.waitForTimeout(150);
s = await st(page);
ok(s.seq?.phase === 'klipp' && s.sami.tool === 'sax', `Sami klipper med saxen (${s.seq?.phase}, ${s.sami.tool})`);
ok(s.tufts[1] > 0, `hårtussar på golvet (${s.tufts[1]})`);
await page.screenshot({ path: new URL('test-klipp.png', OUT).pathname.replace(/^\/([A-Z]:)/, '$1') });
fs.writeFileSync(new URL('test-klipp-pano.png', OUT), Buffer.from((await page.evaluate(() => window.SF.scene._debug.panorama(3))).split(',')[1], 'base64'));
// klicka under klippningen: man sitter kvar
await page.evaluate(() => window.SF.scene._debug.teleport(100, 190));
s = await st(page);
ok(s.me.state === 'cut', 'man sitter still under klippningen');
const min0 = s.min;
await page.evaluate(() => window.SF.scene._debug.fast(8));
s = await st(page);
const look = await page.evaluate(() => window.SF.avatar.look);
ok(look.style === 'mohawk' && look.hair === '#3fc4ff', `ny frisyr i avataren: ${look.style} ${look.hair}`);
ok(look.hat === 'beanie', 'mössan är kvar efteråt');
ok(s.min - min0 >= 55, `klockan gick (${Math.round(s.min - min0)} min)`);
await page.evaluate(() => window.SF.scene._debug.fast(3));
s = await st(page);
ok(s.me.state === 'free', `man reser sig när det är klart (${s.me.state})`);
// omladdning: frisyren är kvar
await page.reload();
await page.waitForFunction(() => window.SF?.game, null, { timeout: 20000 });
const kvar = await page.evaluate(() => ({ style: window.SF.avatar.look.style, hair: window.SF.avatar.look.hair, money: window.SF.game.money }));
ok(kvar.style === 'mohawk' && kvar.hair === '#3fc4ff' && kvar.money === 650, `frisyren och pengarna finns kvar efter omladdning (${JSON.stringify(kvar)})`);

// ================= 2. för lite pengar, frisyrboken, soffan, dörren =================
await boot(page, { money: 50 });
await page.evaluate(() => window.SF.go('frisor'));
await page.waitForTimeout(300);
await page.evaluate(() => { const d = window.SF.scene._debug; d.sit(2); d.samiNow(); });
ok(await until(page, () => !!document.querySelector('.dlg-frisor')), 'väljaren öppnas (50 kr på fickan)');
await page.click('.fr-chip[data-g="Kort hår"]');
await page.click('.fr-tile[data-style="side"]');
const poor = await page.evaluate(() => ({ d: document.querySelector('.fr-go').disabled, bill: document.querySelector('[data-bill]').innerText }));
ok(poor.d && /saknar/.test(poor.bill), 'för lite pengar: knappen avstängd och "du saknar …"');
await page.evaluate(() => document.querySelector('#modal:not(.hidden) [data-close]')?.click());
const r = await page.evaluate(() => window.SF.scene._debug.buy({ style: 'side' }));
ok(r.ok === false && (await st(page)).money === 50, `ingen klippning utan pengar (${r.msg})`);
await page.evaluate(() => window.SF.scene._debug.stand());
// frisyrboken → "Till en stol" → man går dit och väljaren öppnas med valet kvar
await page.evaluate(() => window.SF.game.money = 500);
await page.evaluate(() => window.SF.scene._debug.openBook());
ok(await until(page, () => !!document.querySelector('.dlg-frisor')), 'frisyrboken öppnas');
await page.click('.fr-chip[data-g="Flätor"]');
await page.click('.fr-tile[data-style="braids"]');
await page.click('.fr-go');
ok(await until(page, () => window.SF.scene._debug.state().me.state === 'chair', null, 12000), 'från boken: man går till en ledig stol och sätter sig');
ok(await until(page, () => !!document.querySelector('.dlg-frisor .fr-tile.on[data-style="braids"]'), null, 10000), 'väljaren öppnas med flätorna förvalda');
const bookBill = await page.evaluate(() => document.querySelector('[data-bill]').innerText);
ok(/300 kr/.test(bookBill), 'flätor kostar 300 kr');
await page.evaluate(() => document.querySelector('#modal:not(.hidden) [data-close]')?.click());
await page.evaluate(() => window.SF.scene._debug.stand());
// soffan
s = await page.evaluate(() => { window.SF.scene._debug.sofa(2); return window.SF.scene._debug.state(); });
ok(s.me.state === 'sofa' || s.me.state === 'free', `väntsoffan (${s.me.state})`);
await page.evaluate(() => window.SF.scene._debug.stand());
// dörren ut
await page.evaluate(() => window.SF.scene._debug.teleport(112, 90));
await clickSpot(page, 'dorr');
ok(await until(page, () => window.SF.sceneName === 'city', null, 8000), 'dörren leder ut på gatan');

// ================= 3. salongens liv över tid =================
await page.evaluate(() => window.SF.go('frisor'));
await page.waitForTimeout(200);
const life = await page.evaluate(() => {
  const d = window.SF.scene._debug, seen = new Set(), styles = new Set();
  for (let i = 0; i < 12; i++) { d.fast(10); const s = d.state(); seen.add(s.fia.state); for (const c of s.custs) { seen.add('kund:' + c.state); styles.add(c.style); } }
  return { seen: [...seen], n: d.state().custs.length };
});
ok(life.seen.includes('washing') && life.seen.includes('cut') && life.seen.some((x) => /kund:(toPay|pay|out)/.test(x)), `kunder tvättas, klipps och betalar (${life.seen.join(', ')})`);
ok(life.n <= 4, `kunderna blir inte fler och fler (${life.n})`);

// ================= 4. garderoben hemma: frisyren byts hos frisören (flagga) =================
const flag = await page.evaluate(async () => {
  const av = await import('./js/core/avatar.js');
  if (!av.setAvatarSalon) return { missing: true };
  const out = {};
  av.setAvatarSalon(true);
  av.openAvatarEditor({});
  document.querySelector('[data-tab="hair"]').click();
  out.onStyleTiles = document.querySelectorAll('.av-panel [data-k="style"]').length;
  out.onSalonTile = !!document.querySelector('.av-panel [data-salon="style"]');
  document.querySelector('[data-tab="hairColor"]').click();
  out.onHairSw = document.querySelectorAll('.av-panel [data-k="hair"], .av-panel [data-k="hair2"], .av-panel [data-k="hairFx"]').length;
  document.querySelector('.dlg-foot .av-cancel')?.click();
  av.setAvatarSalon(false);
  av.openAvatarEditor({});
  document.querySelector('[data-tab="hair"]').click();
  out.offStyleTiles = document.querySelectorAll('.av-panel [data-k="style"]').length;
  document.querySelector('.dlg-foot .av-cancel')?.click();
  return out;
});
ok(!flag.missing, 'avatar.js har setAvatarSalon');
ok(flag.onStyleTiles === 0 && flag.onSalonTile && flag.onHairSw === 0, `flaggan på: inga frisyr-/färgval hemma, bara nuvarande frisyr (${JSON.stringify(flag)})`);
ok(flag.offStyleTiles > 0, `flaggan av: alla frisyrer i garderoben som förut (${flag.offStyleTiles})`);

// ================= 5. mobilen (fyll-läget) =================
const mob = await browser.newPage({ viewport: { width: 740, height: 360 }, deviceScaleFactor: 2 });
watch(mob);
await boot(mob, { query: '&mobfill=1' });
await mob.evaluate(() => window.SF.go('frisor'));
await mob.waitForTimeout(800);
await mob.screenshot({ path: new URL('test-mobil.png', OUT).pathname.replace(/^\/([A-Z]:)/, '$1') });
ok(await mob.evaluate(() => window.SF.sceneName === 'frisor' && window.SF.W >= 384), 'mobilen: salongen fyller skärmen');
await mob.close();

ok(!errs.length, errs.length ? 'konsolfel:\n' + errs.join('\n') : 'inga konsolfel');
await browser.close();
console.log(fails ? `${fails} FEL` : 'ALLA OK');
process.exit(fails ? 1 : 0);
