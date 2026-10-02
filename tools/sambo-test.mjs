// Tvåspelartest av BO IHOP (js/net/sambo.js, game.js flyttaIhop/flyttaIsar/samboAdopt/hyra,
// world.js hushållet hu, main.js 👥-rutan) över riktiga PeerJS-molnet i en egen värld:
//   1. Anna (radhuset) bjuder in Bosse (husvagnen) via 👥 → Bosse säger ja → flyttar in
//   2. samma möbler, hyran delas (400 kr var), samma hushåll – hemma ser de varandra i samma rum
//   3. Anna möblerar → Bosse får det; Bosse möblerar → Anna får det; trädgården följer med
//   4. Bosse offline medan Anna möblerar → när han kommer tillbaka har han Annas nyaste
//   5. flytta till en annan bostad går inte när man bor ihop
//   6. Bosse flyttar isär → tillbaka till husvagnen med sina gamla möbler; Anna betalar hela hyran
//   7. flyttar man isär medan den andra är offline får hen veta det när ni ses igen
//   node tools/sambo-test.mjs        (servern på 8788; annan port: SMOKE_PORT=8791)
import { createRequire } from 'module';
const require = createRequire('D:/Qisy/QISYFrontend/QISYFrontend-1/package.json');
const { chromium } = require('playwright');

const PORT = process.env.SMOKE_PORT || '8788';
const WORLD = 'sb' + Date.now().toString(36);
const URL = `http://localhost:${PORT}/index.html?nomenu&world=${WORLD}&nettest=1`;
let fails = 0;
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fails++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const errors = [];
const browser = await chromium.launch();
const active = new Set();
const activity = setInterval(() => { for (const p of active) p.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Shift' }))).catch(() => {}); }, 1500);
const SAVE = (home, deco) => ({ v: 1, day: 3, min: 600, money: 3000, hunger: 80, energy: 80, home, fridge: {}, jobs: {}, earned: 0, wardrobe: [], storage: [], deco, won: false });

async function player(name, color, home, deco) {
  const context = await browser.newContext({ viewport: { width: 900, height: 560 } });
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(`[${name}] ${String(e.stack || e.message).split(String.fromCharCode(10)).slice(0, 4).join(' | ')}`));
  page.on('console', (m) => m.type() === 'error' && !/peer|webrtc|ice|Could not connect|Failed to load/i.test(m.text()) && errors.push(`[${name}] ${m.text()}`));
  await page.goto(URL);
  await page.evaluate(([n, c, s]) => {
    localStorage.clear();
    localStorage.setItem('snabbfilen_avatar', JSON.stringify({ name: n, look: { skin: '#eabf98', shirt: c }, color: c }));
    localStorage.setItem('snabbfilen_save1', JSON.stringify(s));
  }, [name, color, SAVE(home, deco)]);
  await page.reload();
  await page.waitForFunction(() => !!window.SF?.worldInfo, null, { timeout: 15000 });
  active.add(page);
  return { name, context, page };
}
async function until(fn, ms = 20000, step = 250) {
  const end = Date.now() + ms;
  for (;;) { let v = false; try { v = await fn(); } catch { v = false; } if (v || Date.now() > end) return v; await sleep(step); }
}
const E = (p, fn, arg) => p.page.evaluate(fn, arg);
const decoOf = (p, hem) => E(p, (hem) => JSON.stringify(Object.fromEntries(Object.entries(SF.game.deco).filter(([k]) => k.startsWith(hem + ':')).sort())), hem);
const lampa = { k: 'lampa', v: 0, x: 200, y: 150 };

// ---------- 1. flytta ihop ----------
const A = await player('Anna', '#e04848', 'radhus', { 'radhus:0': [{ k: 'soffa', v: 2, x: 120, y: 170 }] });
const B = await player('Bosse', '#3a78d8', 'husvagn', { 'husvagn:0': [{ k: 'bordR', v: 1, x: 150, y: 150 }] });
ok(await until(async () => (await E(A, () => SF.playersList().length)) === 1 && (await E(B, () => SF.playersList().length)) === 1), 'Anna och Bosse är i världen');
ok(await E(A, () => !!SF.playersList()[0].key), 'spelarlistan har nyckeln');
await E(A, () => document.getElementById('hud-friends').click());
ok(await until(() => E(A, () => !!document.querySelector('#modal [data-sambo]'))), '👥-rutan: 🏠 Flytta ihop vid Bosse');
await E(A, () => document.querySelector('#modal [data-sambo]').click());
ok(await until(() => E(B, () => /Flytta ihop/.test(document.querySelector('#modal:not(.hidden) .dlg-head h2')?.textContent || ''))), 'Bosse får frågan: Flytta ihop?');
ok(/400\s*kr/.test(await E(B, () => document.querySelector('#modal').innerText)), 'frågan säger att hyran blir 400 kr var');
await E(B, () => [...document.querySelectorAll('#modal button')].find((b) => /Flytta in/.test(b.textContent)).click());
ok(await until(async () => (await E(B, () => !!SF.game.sambo)) && (await E(A, () => !!SF.game.sambo))), 'båda bor ihop');
const sa = await E(A, () => SF.game.sambo), sb = await E(B, () => SF.game.sambo);
ok(sa.roll === 'vard' && sb.roll === 'inflyttad' && sa.hem === 'radhus' && sb.hem === 'radhus', 'Anna är värd, Bosse inflyttad – i radhuset');
ok(sa.hu && sa.hu === sb.hu, `samma hushåll (${sa.hu})`);
ok((await E(B, () => SF.game.home)) === 'radhus', 'Bosse bor i radhuset nu');
ok((await decoOf(A, 'radhus')) === (await decoOf(B, 'radhus')), 'Bosse har Annas möbler');
ok((await E(A, () => SF.game.hyra)) === 400 && (await E(B, () => SF.game.hyra)) === 400, 'hyran delas: 400 kr var i veckan');
ok(sb.egen?.home === 'husvagn', 'Bosses gamla hem är sparat');
// ---------- 2. hemma i samma rum ----------
await E(A, () => { SF.roomSub = 0; SF.go('room'); }); await E(B, () => { SF.roomSub = 0; SF.go('room'); });
ok(await until(async () => (await E(A, () => SF.worldFolksHere().map((f) => f.av.name).join(','))) === 'Bosse' && (await E(B, () => SF.worldFolksHere().map((f) => f.av.name).join(','))) === 'Anna'), 'hemma ser de varandra i samma rum');
ok(/hemma hos er/.test(await E(A, () => { document.getElementById('hud-friends').click(); return document.querySelector('#modal').innerText; })), '👥-rutan: Bosse är "hemma hos er" och det står att ni bor ihop');
ok(await E(A, () => /bor ihop med Bosse/.test(document.querySelector('#modal').innerText)), '👥-rutan: "Du bor ihop med Bosse"');
await E(A, () => { const m = document.querySelector('#modal'); m.classList.add('hidden'); m.innerHTML = ''; });
// ---------- 3. synk åt båda håll ----------
await E(A, (l) => { SF.game.deco['radhus:0'].push(l); SF.game.save(); }, lampa);
ok(await until(async () => (await decoOf(B, 'radhus')).includes('"lampa"')), 'Anna ställer ut en lampa → Bosse får den');
await E(B, () => { SF.game.deco['radhus:0'].push({ k: 'vaxtS', v: 0, x: 260, y: 160 }); SF.game.save(); });
ok(await until(async () => (await decoOf(A, 'radhus')).includes('"vaxtS"')), 'Bosse ställer ut en krukväxt → Anna får den');
await E(A, () => { SF.game.money += 100; SF.game.plant(0, 'potatis'); });
ok(await until(() => E(B, () => SF.game.odling?.radhus?.beds?.[0]?.g === 'potatis')), 'trädgården följer med: Annas potatis syns hos Bosse');
ok((await decoOf(A, 'radhus')) === (await decoOf(B, 'radhus')), 'samma möbler hos båda');
// ---------- 4. offline ----------
const bVer = await E(B, () => SF.game.sambo.ver);
active.delete(B.page); await B.page.close();
ok(await until(async () => (await E(A, () => SF.playersList().length)) === 0), 'Bosse loggar ut');
await E(A, () => { SF.game.deco['radhus:0'].push({ k: 'matta', v: 1, x: 60, y: 190 }); SF.game.save(); });
B.page = await B.context.newPage();
B.page.on('pageerror', (e) => errors.push(`[Bosse] ${e.message}`));
await B.page.goto(URL); await B.page.waitForFunction(() => !!window.SF?.worldInfo, null, { timeout: 15000 }); active.add(B.page);
ok((await E(B, () => SF.game.sambo?.ver)) === bVer && (await E(B, () => SF.game.home)) === 'radhus', 'Bosse kommer tillbaka – fortfarande sambo i radhuset');
ok(await until(async () => (await decoOf(B, 'radhus')).includes('"matta"'), 30000), 'det Anna ändrade medan Bosse var borta har kommit fram');
// ---------- 5. ingen flytt ----------
const mv = await E(B, () => SF.game.moveTo('villa'));
ok(!mv.ok && /flytta isär först/.test(mv.msg), 'man kan inte flytta till en annan bostad medan man bor ihop');
// ---------- 6. flytta isär ----------
await E(B, () => document.getElementById('hud-friends').click());
ok(await until(() => E(B, () => [...document.querySelectorAll('#modal button')].some((b) => /Flytta isär/.test(b.textContent)))), '👥-rutan: Flytta isär');
await E(B, () => [...document.querySelectorAll('#modal button')].find((b) => /Flytta isär/.test(b.textContent)).click());
await until(() => E(B, () => [...document.querySelectorAll('#modal button')].some((b) => /Ja, flytta isär/.test(b.textContent))));
await E(B, () => [...document.querySelectorAll('#modal button')].find((b) => /Ja, flytta isär/.test(b.textContent)).click());
ok(await until(() => E(A, () => !SF.game.sambo)) && !(await E(B, () => SF.game.sambo)), 'båda har flyttat isär');
ok((await E(B, () => SF.game.home)) === 'husvagn' && (await decoOf(B, 'husvagn')).includes('"bordR"'), 'Bosse är tillbaka i husvagnen med sitt gamla bord');
ok((await E(B, () => Object.keys(SF.game.deco).some((k) => k.startsWith('radhus:')))) === false, 'Bosse har inga radhusmöbler kvar');
ok((await E(A, () => SF.game.hyra)) === 800 && (await E(A, () => SF.game.home)) === 'radhus', 'Anna bor kvar och betalar hela hyran (800 kr)');
// ---------- 7. isär medan den andra är offline ----------
await E(A, () => document.getElementById('hud-friends').click());
await until(() => E(A, () => !!document.querySelector('#modal [data-sambo]')));
await E(A, () => document.querySelector('#modal [data-sambo]').click());
await until(() => E(B, () => [...document.querySelectorAll('#modal button')].some((b) => /Flytta in/.test(b.textContent))));
await E(B, () => [...document.querySelectorAll('#modal button')].find((b) => /Flytta in/.test(b.textContent)).click());
ok(await until(async () => (await E(B, () => !!SF.game.sambo)) && (await E(A, () => !!SF.game.sambo))), 'de flyttar ihop igen');
active.delete(A.page); await A.page.close();
ok(await until(async () => (await E(B, () => SF.playersList().length)) === 0), 'Anna loggar ut');
await E(B, async () => { const s = await import('./js/net/sambo.js'); s.splitSambo(); });
ok(!(await E(B, () => SF.game.sambo)), 'Bosse flyttar isär medan Anna är borta');
A.page = await A.context.newPage();
await A.page.goto(URL); await A.page.waitForFunction(() => !!window.SF?.worldInfo, null, { timeout: 15000 }); active.add(A.page);
ok(await until(() => E(A, () => !SF.game.sambo), 30000), 'när Anna kommer tillbaka får hon veta det – hon bor själv igen');

clearInterval(activity);
ok(!errors.length, errors.length ? 'fel:\n' + errors.slice(0, 6).join('\n') : 'inga fel i konsolen');
await browser.close();
console.log(fails ? `\n${fails} FEL` : '\nALLA OK');
process.exit(fails ? 1 : 0);
