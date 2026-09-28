// Sparfilstest: ingen spelare får tappa något när spelet uppdateras.
//  1. Varje fixtur i tools/saves/ (riktiga sparningar gjorda med äldre versioner) laddas
//     med den nuvarande koden: pengar, dag, bostad, plagg, möbler (med färg), förråd, kyl,
//     jobb, rekord och avatar ska finnas kvar, och en säkerhetskopia ska ha tagits.
//  2. Framåt: en sparning med saker från en påhittad NYARE version (okända fält, plagg,
//     möbler, rum, jobb, mat, möbelrotation) ska överleva ett varv ladda → spara orörd.
//  3. En sparfil som inte går att läsa (okänt format) ska läggas undan, inte skrivas över.
//   node tools/save-compat.mjs         (servern på 8788; annan port: SMOKE_PORT=8791)
import { createRequire } from 'module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const require = createRequire('D:/Qisy/QISYFrontend/QISYFrontend-1/package.json');
const { chromium } = require('playwright');

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = process.env.SMOKE_PORT || '8788';
const URL = `http://localhost:${PORT}/index.html?world=sc${Date.now().toString(36)}`;
let fails = 0;
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fails++; };
const errors = [];
const browser = await chromium.launch();

async function boot(storage) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && !/peer|webrtc|ice|Could not connect/i.test(m.text()) && errors.push(m.text()));
  await page.goto(URL);
  await page.evaluate((s) => { localStorage.clear(); for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v); }, storage);
  await page.reload();
  await page.waitForFunction(() => !!window.SF?.game, null, { timeout: 20000 });
  await page.waitForTimeout(800);
  return { ctx, page };
}
const stored = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('snabbfilen_save1') || 'null'));
const resave = (page) => page.evaluate(() => { window.SF.game.save(); return JSON.parse(localStorage.getItem('snabbfilen_save1')); });
const decoCount = (d) => Object.fromEntries(Object.entries(d || {}).map(([k, v]) => [k, (v || []).length]));

const fixtures = fs.readdirSync(path.join(ROOT, 'tools/saves')).filter((f) => f.endsWith('.json')).sort();
ok(fixtures.length > 0, `fixturer: ${fixtures.join(', ')}`);

for (const f of fixtures) {
  const fx = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools/saves', f), 'utf8'));
  const old = JSON.parse(fx.localStorage.snabbfilen_save1);
  console.log(`\n${f} (gjord med v${fx.version}):`);
  // spelaren såg senast en äldre version → versionsbyte → säkerhetskopia ska tas
  const { ctx, page } = await boot({ ...fx.localStorage, snabbfilen_seen_version: '0.0.1' });
  const g = await page.evaluate(() => { const g = window.SF.game; return { money: g.money, day: g.day, home: g.home, wardrobe: g.wardrobe, storage: g.storage, deco: g.deco, fridge: g.fridge, jobs: g.jobs, best: g.best, earned: g.earned, name: window.SF.avatar.name }; });
  ok(g.money === old.money && g.day === old.day && g.home === old.home, `pengar ${g.money}, dag ${g.day}, bostad ${g.home}`);
  ok(old.wardrobe.every((w) => g.wardrobe.includes(w)), `alla ${old.wardrobe.length} plagg kvar`);
  const oc = decoCount(old.deco), nc = decoCount(g.deco);
  ok(Object.entries(oc).every(([k, n]) => (nc[k] || 0) >= n), `alla möbler kvar i alla rum (${JSON.stringify(nc)})`);
  const colored = Object.values(old.deco).flat().filter((d) => d.c);
  ok(colored.every((d) => Object.values(g.deco).flat().some((e) => e.k === d.k && e.c === d.c && e.x === d.x && e.y === d.y)), `egna möbelfärger kvar (${colored.length} st)`);
  ok(g.storage.length >= old.storage.length, `förrådet kvar (${g.storage.length})`);
  ok(JSON.stringify(g.fridge) === JSON.stringify(old.fridge), 'kylskåpet kvar');
  ok(Object.entries(old.jobs).every(([k, v]) => g.jobs[k] === v) && g.earned === old.earned, 'jobb och intjänat kvar');
  ok(Object.entries(old.best || {}).every(([k, v]) => g.best[k]?.ok === v.ok && g.best[k]?.pay === v.pay), 'rekorden kvar');
  ok(g.name === JSON.parse(fx.localStorage.snabbfilen_avatar).name, `avataren kvar (${g.name})`);
  const again = await resave(page);
  ok(Object.keys(old).every((k) => k in again), 'sparad igen: alla fält från den gamla filen finns kvar');
  const backups = await page.evaluate(() => JSON.parse(localStorage.getItem('snabbfilen_backups') || '[]'));
  const bdata = backups.length ? await page.evaluate((k) => JSON.parse(localStorage.getItem(k) || '{}'), backups[backups.length - 1].key) : {};
  ok(backups.length >= 1 && bdata.snabbfilen_save1 === fx.localStorage.snabbfilen_save1, `säkerhetskopia tagen före laddningen (${backups.map((b) => b.label).join(', ')})`);
  await ctx.close();

  // 2. framåt: data från en nyare version ska överleva
  const future = structuredClone(old);
  future.husdjur = [{ namn: 'Misse', art: 'katt' }];
  future.wardrobe = [...future.wardrobe, 'top-framtidsjacka'];
  future.storage = [...future.storage, { k: 'framtidsmobel', v: 2 }];
  const room = Object.keys(future.deco)[0];
  future.deco[room] = [...future.deco[room], { k: 'framtidsbord', v: 0, x: 50, y: 150 }];
  future.deco[room][0] = { ...future.deco[room][0], r: 2 };
  future.deco['takvaning:0'] = [{ k: 'soffa', v: 0, x: 60, y: 160 }, { k: 'framtidssang', v: 1, x: 90, y: 150 }];
  future.jobs = { ...future.jobs, pizzeria: 3 };
  future.best = { ...future.best, pizzeria: { ok: 5, pay: 80 } };
  future.fridge = { ...future.fridge, kebab: 2 };
  const fut = await boot({ ...fx.localStorage, snabbfilen_save1: JSON.stringify(future) });
  const back = await resave(fut.page);
  ok(JSON.stringify(back.husdjur) === JSON.stringify(future.husdjur), 'okänt fält (husdjur) kvar');
  ok(back.wardrobe.includes('top-framtidsjacka'), 'okänt plagg kvar');
  ok(back.storage.some((s) => s.k === 'framtidsmobel' && s.v === 2), 'okänd möbel i förrådet kvar');
  ok(back.deco[room].some((d) => d.k === 'framtidsbord') && back.deco[room].some((d) => d.r === 2), 'okänd möbel och möbelrotation kvar i rummet');
  ok((back.deco['takvaning:0'] || []).length === 2, 'rum i en okänd bostad kvar');
  ok(back.jobs.pizzeria === 3 && back.best.pizzeria?.ok === 5, 'okänt jobb och rekord kvar');
  ok(back.fridge.kebab === 2, 'okänd mat i kylen kvar');
  await fut.ctx.close();
}

// 3. oläslig/för ny sparfil läggs undan
const broken = await boot({ snabbfilen_save1: JSON.stringify({ v: 2, allt: 'nytt format' }), snabbfilen_avatar: JSON.stringify({ name: 'Trasig' }) });
const aside = await broken.page.evaluate(() => Object.keys(localStorage).filter((k) => k.includes('_undanlagd_')).map((k) => localStorage.getItem(k)));
ok(aside.some((v) => v.includes('nytt format')), 'sparfil i okänt format lades undan orörd');
await broken.ctx.close();

// 4. Fullt förråd + möbler som inte får plats i (det mindre) Lilla rummet: varken fitRoom
//    (hemma) eller load() får tappa något – summan är densamma efter två omladdningar,
//    färgerna följer med och förrådet växer inte förbi taket.
{
  console.log('\nfullt förråd + möbler utanför lokalen:');
  const fx = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools/saves', fixtures[0]), 'utf8'));
  const old = JSON.parse(fx.localStorage.snabbfilen_save1);
  const shelves = Array.from({ length: 40 }, (_, i) => ({ k: 'bredhylla', v: i % 3, x: 200 + (i % 4) * 30, y: 100 + ((i / 4) | 0) * 12, c: '#aa00' + String(i).padStart(2, '0') }));
  const full = { ...old, home: 'rum', storage: Array.from({ length: 80 }, (_, i) => ({ k: 'stol', v: i % 4 })), deco: { 'rum:0': [{ k: 'sang', v: 0, x: 14, y: 133, fx: 1 }, ...shelves] } };
  const total = (s) => (s.storage || []).length + Object.values(s.deco || {}).flat().filter((d) => d.k !== 'dass').length;
  const enterRoom = async (page) => { await page.evaluate(() => { window.SF.roomSub = 0; window.SF.go('room'); }); await page.waitForTimeout(400); };
  const { ctx, page } = await boot({ ...fx.localStorage, snabbfilen_save1: JSON.stringify(full) });
  await enterRoom(page);
  const s1 = await stored(page);
  ok(total(s1) === 121 && s1.storage.length === 80, `hemma: ${total(s1)} möbler kvar av 121, förrådet ${s1.storage.length} (taket är 80)`);
  for (let i = 0; i < 2; i++) { await page.reload(); await page.waitForFunction(() => !!window.SF?.game, null, { timeout: 20000 }); await enterRoom(page); }
  const s2 = await stored(page);
  ok(total(s2) === 121 && s2.storage.length === 80, `efter två omladdningar: ${total(s2)} möbler, förrådet ${s2.storage.length}`);
  const all = [...s2.storage, ...Object.values(s2.deco).flat()];
  ok(shelves.every((sh) => all.some((d) => d.k === 'bredhylla' && d.c === sh.c)), 'alla 40 färgade hyllor kvar med sin färg');
  ok(all.filter((d) => d.k === 'stol').length === 80 && all.some((d) => d.k === 'sang' && d.fx), '80 stolar och sängen kvar');
  await ctx.close();
}

console.log(errors.length ? '\nKONSOLFEL:\n' + errors.join('\n') : '\nInga konsolfel.');
ok(errors.filter((e) => !/Sparfilen kunde inte läsas/.test(e)).length === 0, 'inga pageerror/console.error');
await browser.close();
console.log(fails ? `\n${fails} FEL` : '\nALLT GRÖNT');
process.exit(fails ? 1 : 0);
