// Multiplayertest över riktiga PeerJS-molnet i en egen privat värld (?world=mp… &nettest=1
// = korta tider). Tre spelare: ser varandra, dubblettflik ersätter den gamla, spöken städas
// bort, platsen syns i listan, pil i kanten mot den som är utanför bild, dold värd lämnar
// över och värden som försvinner tas över av någon annan.
//   node tools/mp-test.mjs            (servern på 8788; annan port: SMOKE_PORT=8791)
import { createRequire } from 'module';
const require = createRequire('D:/Qisy/QISYFrontend/QISYFrontend-1/package.json');
const { chromium } = require('playwright');

const PORT = process.env.SMOKE_PORT || '8788';
const WORLD = 'mp' + Date.now().toString(36);
const URL = `http://localhost:${PORT}/index.html?world=${WORLD}&nettest=1`;
let fails = 0;
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fails++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const errors = [];
const browser = await chromium.launch();
// spelarna "rör musen" hela tiden så att de inte loggas ut som inaktiva (utom när vi testar just det)
const active = new Set();
const activity = setInterval(() => { for (const p of active) p.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Shift' }))).catch(() => {}); }, 1500);

async function player(name, color, ctx = null) {
  const context = ctx || await browser.newContext({ viewport: { width: 900, height: 560 } });
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(`[${name}] ${String(e.stack || e.message).split(String.fromCharCode(10)).slice(0, 4).join(' | ')}`));
  page.on('console', (m) => m.type() === 'error' && !/peer|webrtc|ice|Could not connect/i.test(m.text()) && errors.push(`[${name}] ${m.text()}`));
  await page.goto(URL);
  if (!ctx) {
    await page.evaluate(([n, c]) => {
      localStorage.clear();
      localStorage.setItem('snabbfilen_avatar', JSON.stringify({ name: n, look: { skin: '#eabf98', shirt: c }, color: c }));
      localStorage.setItem('snabbfilen_save1', JSON.stringify({ v: 1, day: 1, min: 600, money: 100, hunger: 80, energy: 80, home: 'rum', fridge: {}, jobs: { flygplats: 0, frukt: 0, burgare: 0 }, earned: 0, wardrobe: [], storage: [], deco: {}, won: false }));
    }, [name, color]);
    await page.reload();
  }
  await page.waitForFunction(() => !!window.SF?.worldInfo, null, { timeout: 15000 });
  active.add(page);
  return { name, context, page };
}
const info = (p) => p.page.evaluate(() => window.SF?.worldInfo?.() || {}).catch(() => ({}));
const names = (p) => p.page.evaluate(() => (window.SF?.playersList?.() || []).map((x) => x.av.name).sort().join(',')).catch(() => '');
async function until(fn, ms = 15000, step = 250) {
  const end = Date.now() + ms;
  for (;;) { let v = false; try { v = await fn(); } catch { v = false; } if (v || Date.now() > end) return v; await sleep(step); }
}
const toCity = (p, x) => p.page.evaluate((xx) => { window.SF.go('city'); if (xx !== undefined) setTimeout(() => window.SF.scene._debug.teleport(xx, 200), 50); }, x);

// 1. tre spelare ansluter och ser varandra i staden
const A = await player('Anna', '#e04848');
ok(await until(async () => (await info(A)).open), 'Anna är i världen');
const B = await player('Bosse', '#3a78d8');
const C = await player('Cilla', '#38b060');
ok(await until(async () => (await info(B)).open && (await info(C)).open), 'Bosse och Cilla ansluter');
for (const p of [A, B, C]) await toCity(p, 300);
ok(await until(async () => (await A.page.evaluate(() => window.SF.worldFolksHere().length)) === 2), 'Anna ser båda i staden');
ok((await names(C)) === 'Anna,Bosse', `Cilla ser Anna och Bosse (${await names(C)})`);

// 1b. chatten: det Anna säger syns som bubbla hos Bosse
await A.page.evaluate(() => window.SF.sendSay('Hej Bosse, kom hit!'));
ok(await until(async () => (await B.page.evaluate(() => (window.SF.worldFolksHere().find((f) => f.av.name === 'Anna') || {}).say)) === 'Hej Bosse, kom hit!'), 'chatten når fram som pratbubbla');
await A.page.screenshot({ path: 'tools/out/mp-chat.png' });

// 2. platsen syns i listan
await B.page.evaluate(() => window.SF.go('mat'));
ok(await until(async () => (await A.page.evaluate(() => window.SF.playersList().find((p) => p.av.name === 'Bosse')?.scene)) === 'away:mat'), 'listan vet att Bosse är i mataffären');
await A.page.evaluate(() => window.SF.openFriends());
await sleep(300);
const listText = await A.page.evaluate(() => document.querySelector('.plist')?.innerText || '');
ok(/mataffären/.test(listText) && /i staden/.test(listText), `👥-listan visar var de är (${listText.replace(/\s+/g, ' ').slice(0, 90)})`);
await A.page.screenshot({ path: 'tools/out/mp-lista.png' });
await A.page.evaluate(() => document.querySelector('#modal [data-close]')?.click());

// 3. pil i kanten mot en spelare utanför bild, och "Gå dit" via listan
await toCity(B, 1500);
await sleep(1500);
const marks = await A.page.evaluate(() => window.SF.scene._debug.markers?.() || []);
ok(marks.length >= 1, `pil i skärmkanten mot Bosse långt bort (${marks.length} st)`);
await A.page.screenshot({ path: 'tools/out/mp-pil.png' });
const before = await A.page.evaluate(() => window.SF.scene.worldX);
await A.page.evaluate(() => { const id = window.SF.playersList().find((p) => p.av.name === 'Bosse').id; window.SF.followPlayer = id; });
await sleep(2500);
const after = await A.page.evaluate(() => window.SF.scene.worldX);
ok(after > before + 40, `"Gå dit" går mot Bosse (x ${Math.round(before)} → ${Math.round(after)})`);

// 4. samma spelare i en ny flik (samma webbläsare) → ersätter den gamla, blir inte två
const C2 = await player('Cilla', '#38b060', C.context);
ok(await until(async () => (await info(C2)).open), 'Cillas nya flik ansluter');
await sleep(1500);
const annaSees = await A.page.evaluate(() => window.SF.playersList().filter((p) => p.av.name === 'Cilla').length);
ok(annaSees === 1, `Cilla syns en gång, inte två (${annaSees})`);
await C.page.close();

// 5. spöke: Bosses sida fryser (som en mobil i fickan) utan att anslutningen stängs → städas bort
const cdp = await B.context.newCDPSession(B.page);
await cdp.send('Debugger.enable');
await cdp.send('Debugger.pause');
ok(await until(async () => !(await names(A)).includes('Bosse'), 20000), `Bosses spöke städades bort (${await names(A)})`);
await cdp.send('Debugger.resume');
await cdp.send('Debugger.disable');
ok(await until(async () => (await names(A)).includes('Bosse'), 30000), 'Bosse kom tillbaka när sidan vaknade');

// 6. värden göms (mobilen i fickan) → lämnar över, alla ser fortfarande varandra
const hostOf = async () => { for (const p of [A, B, C2]) if ((await info(p)).role === 'host') return p; return null; };
const h1 = await hostOf();
ok(!!h1, `någon är värd (${h1?.name})`);
await h1.page.evaluate(() => { Object.defineProperty(document, 'hidden', { value: true, configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });
ok(await until(async () => { const h = await hostOf(); return h && h !== h1; }, 25000), 'den dolda värden lämnade över till en synlig spelare');
ok(await until(async () => (await info(h1)).role === 'client' && (await info(h1)).open, 20000), 'den dolda fliken är kvar som vanlig spelare');
for (const p of [A, B, C2]) await toCity(p, 300);
ok(await until(async () => { for (const p of [A, B, C2]) if ((await p.page.evaluate(() => window.SF.playersList().length)) !== 2) return false; return true; }, 25000), 'alla tre ser varandra efter värdbytet');

// 7. inaktiv i "5 minuter" (6 s i testläget) → ut ur världen, tillbaka vid första rörelsen
const idler = [A, B, C2].find(async (p) => true) && (await (async () => { for (const p of [A, B, C2]) if ((await info(p)).role === 'client') return p; })());
active.delete(idler.page);
const others = [A, B, C2].filter((p) => p !== idler);
ok(await until(async () => (await info(idler)).idle === true, 20000), `${idler.name} loggades ut efter att ha varit inaktiv`);
ok(await until(async () => !(await names(others[0])).includes(idler.name), 15000), `de andra ser inte längre ${idler.name}`);
await idler.page.evaluate(() => window.dispatchEvent(new Event('pointerdown')));
active.add(idler.page);
ok(await until(async () => (await info(idler)).open && (await names(others[0])).includes(idler.name), 30000), `${idler.name} är tillbaka efter första rörelsen`);

// 8. värden stängs helt → någon annan tar över, de två kvar ser varandra
const h2 = await hostOf();
const rest = [A, B, C2].filter((p) => p !== h2);
await h2.context.close();
const healed = await until(async () => { for (const p of rest) if ((await p.page.evaluate(() => window.SF.playersList().length)) !== 1) return false; return (await Promise.all(rest.map(info))).some((i) => i.role === 'host'); }, 60000);
if (!healed) for (const p of rest) console.log(`   ${p.name}:`, JSON.stringify(await info(p)), await names(p), await p.page.evaluate(() => document.hidden));
ok(healed, `värden (${h2.name}) stängde – de två kvar hittade varandra igen`);

console.log(errors.length ? '\nKONSOLFEL:\n' + errors.join('\n') : '\nInga konsolfel.');
ok(errors.length === 0, 'inga pageerror/console.error');
clearInterval(activity);
await browser.close();
console.log(fails ? `\n${fails} FEL` : '\nALLT GRÖNT');
process.exit(fails ? 1 : 0);
