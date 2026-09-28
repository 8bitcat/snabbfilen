// RÖSTCHATTEN med tre spelare i samma värld (Chromium med påhittad mikrofon – en ton):
//  1) ingen mikrofon och ingen förbindelse innan man själv slår på rösten
//  2) röst i närheten kräver att BÅDA har rösten på – sedan hörs de, med volym efter avstånd
//  3) den som står långt bort hörs inte; går man ifrån varandra kopplas det ner
//  4) 🗣️ syns över den som pratar
//  5) röstgrupp: inbjudan → "Gå med" → hörs överallt i full volym
//  6) ett påtvingat samtal (utan samtycke) stängs direkt
//  7) lämna gruppen kopplar ner, tysta mikrofonen stänger av spåret
// Kör: node tools/voice-test.mjs   (servern på 8788, eller SMOKE_PORT)
import { createRequire } from 'module';
const require = createRequire('D:/Qisy/QISYFrontend/QISYFrontend-1/package.json');
const { chromium } = require('playwright');
const PORT = process.env.SMOKE_PORT || process.env.PORT || 8788;
const WORLD = 'vt' + Date.now().toString(36);
const browser = await chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required'] });
let fails = 0;
const ok = (c, m) => { console.log((c ? 'ok: ' : 'FEL: ') + m); if (!c) fails++; };
const errs = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function player(name, x, y) {
  const ctx = await browser.newContext({ viewport: { width: 1100, height: 700 } });
  await ctx.grantPermissions(['microphone']);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errs.push(`${name}: ${e.message}`));
  page.on('console', (m) => m.type() === 'error' && !/peer|ERR_|Failed to load resource|Could not connect|Lost connection/i.test(m.text()) && errs.push(`${name}: ${m.text()}`));
  await page.goto(`http://localhost:${PORT}/index.html?world=${WORLD}`);
  await page.evaluate((n) => {
    localStorage.clear();
    localStorage.setItem('snabbfilen_avatar', JSON.stringify({ name: n, look: { skin: '#e0a97f', hair: '#3b2619', style: 'long', shirt: '#3a7bd5', pants: '#2d3a5c' }, color: '#ffd23f' }));
    localStorage.setItem('snabbfilen_save1', JSON.stringify({ v: 1, day: 3, min: 12 * 60, money: 500, hunger: 80, energy: 90, home: 'rum', fridge: {}, jobs: {}, earned: 0 }));
  }, name);
  await page.reload();
  await page.waitForFunction(() => window.SF?.worldInfo, null, { timeout: 20000 });
  await page.waitForTimeout(600);
  await page.evaluate(() => { document.querySelector('#modal:not(.hidden) .dlg-foot .btn')?.click(); });
  await page.evaluate(([px, py]) => { window.SF.game.min = 12 * 60; window.SF.go('city'); window.SF.scene._debug.teleport(px, py); }, [x, y]);
  return { name, page, ctx };
}
const V = (p, fn, arg) => p.page.evaluate(async ([src, a]) => { const v = await import('./js/net/voice.js'); const w = await import('./js/net/world.js'); return (0, eval)(src)(v, w, a); }, [fn.toString(), arg]);
const state = (p) => V(p, (v) => v.voiceState());
const myId = (p) => p.page.evaluate(() => window.SF.worldInfo().myId);
async function until(fn, ms = 12000, step = 300) { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await fn()) return true; await sleep(step); } return false; }
const moveTo = (p, x, y) => p.page.evaluate(([px, py]) => window.SF.scene._debug.teleport(px, py), [x, y]);
// håll figurerna "aktiva" och positionerna färska (worldTick skickar vid rörelse)
const nudge = async (p) => p.page.evaluate(() => { const s = window.SF.scene; s._debug.teleport(s.worldX + (Math.random() < 0.5 ? 1 : -1), s.worldY); });

const A = await player('Alva', 420, 470);
const B = await player('Bosse', 450, 470);
const C = await player('Cilla', 2600, 640);
ok(await until(async () => (await A.page.evaluate(() => window.SF.worldInfo().online)) === 3 && (await C.page.evaluate(() => window.SF.worldInfo().online)) === 3, 30000), 'alla tre är i samma värld');
const ids = { A: await myId(A), B: await myId(B), C: await myId(C) };
for (const p of [A, B, C]) await nudge(p);
await sleep(1200);

// 1) ingenting innan man själv slår på
const s0 = await state(A);
ok(!s0.mic && !s0.nara && !s0.links.length, 'ingen mikrofon och ingen förbindelse innan man slår på rösten');
ok(await A.page.locator('#hud-voice').count() === 1, '🎙️-knappen finns i verktygsraden');

// 2) bara A har rösten på → ingen förbindelse
await V(A, (v) => v.setNara(true));
await sleep(3500);
const s1 = await state(A);
ok(s1.mic && s1.nara && s1.links.filter((l) => l.got).length === 0, 'A har rösten på men hör ingen – B har inte slagit på sin');
// B slår på → A och B hörs
await V(B, (v) => v.setNara(true));
ok(await until(async () => { await nudge(A); await nudge(B); const a = await state(A), b = await state(B); return a.links.some((l) => l.id === ids.B && l.got) && b.links.some((l) => l.id === ids.A && l.got); }, 20000), 'A och B har rösten på och står nära – de hör varandra');
let near = null; // volymen sätts vid nästa översyn (var 0,3 s) efter att förbindelsen öppnats
await until(async () => { near = (await state(A)).links.find((l) => l.id === ids.B); return near && near.vol > 0.5; }, 5000);
ok(near && near.nara && near.vol > 0.5, `volymen är hög när man står nära (${near?.vol})`);

// 3) C har rösten på men står långt bort
await V(C, (v) => v.setNara(true));
await sleep(4000);
ok(!(await state(C)).links.some((l) => l.got) && !(await state(A)).links.some((l) => l.id === ids.C), 'C långt bort hörs inte och hör inte');

// 4) 🗣️ över den som pratar (den påhittade mikrofonen spelar en ton hela tiden)
ok(await until(async () => B.page.evaluate((a) => window.SF.worldFolksHere().some((f) => f.id === a && f.emote === '🗣️'), ids.A), 10000), 'B ser 🗣️ över A när A pratar');
ok(await until(async () => (await state(A)).talkingSelf, 6000), 'A ser att den egna mikrofonen tar upp ljud');

// B går långt bort → kopplas ner
await moveTo(B, 1400, 470);
ok(await until(async () => { await nudge(B); return !(await state(A)).links.some((l) => l.id === ids.B); }, 15000), 'B gick långt bort – förbindelsen kopplades ner');

// 5) röstgrupp: A bjuder in C (långt bort)
await V(A, (v, w, c) => v.inviteToGroup(c), ids.C);
ok(await until(async () => /Prata ihop/.test(await C.page.locator('#modal .dlg-head h2').textContent().catch(() => '')), 8000), 'C får en inbjudan till röstgruppen');
await C.page.click('#modal .dlg-foot .btn-go');
ok(await until(async () => { const a = await state(A); return a.links.some((l) => l.id === ids.C && l.got && l.grupp); }, 20000), 'A och C hörs i gruppen fast de står långt ifrån varandra');
let g = null;
await until(async () => { g = (await state(A)).links.find((l) => l.id === ids.C); return g && g.vol === 1; }, 5000);
ok(g && g.vol === 1, `gruppen hörs i full volym (${g?.vol})`);
ok(((await state(C)).group?.members || []).some((m) => m.id === ids.A), 'C ser A som medlem i gruppen');

// 6) påtvingat samtal: B (inte i gruppen, långt bort) ringer A direkt → stängs
const forced = await V(B, async (v, w, a) => {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const mc = w.worldPeer().call(a, stream, { metadata: { gid: 'forfalskad' } });
  let stream2 = false; mc.on('stream', () => { stream2 = true; });
  await new Promise((r) => setTimeout(r, 4000));
  return { got: stream2, open: mc.open };
}, ids.A);
ok(!forced.got && !(await state(A)).links.some((l) => l.id === ids.B), 'ett samtal utan samtycke stängs direkt – A hör inte B');

// 7) tysta mikrofonen, lämna gruppen
await V(A, (v) => v.toggleMic());
const tr = await V(A, async (v) => { const s = v.voiceState(); return s.micMuted; });
ok(tr === true, 'A tystade sin mikrofon');
await V(C, (v) => v.leaveGroup());
ok(await until(async () => !(await state(A)).links.some((l) => l.id === ids.C), 12000), 'C lämnade gruppen – förbindelsen kopplades ner');
await V(A, (v) => v.setNara(false));
await V(A, (v) => v.leaveGroup(true));
await sleep(600);
ok(!(await state(A)).mic, 'A stängde av rösten – mikrofonen släpptes');

// panelen öppnas
await B.page.click('#hud-voice');
await sleep(300);
ok(/Röst i närheten/.test(await B.page.locator('#modal').textContent()), 'röstpanelen öppnas från 🎙️-knappen');
await B.page.screenshot({ path: 'tools/out/voice-panel.png' });

ok(!errs.length, errs.length ? 'konsolfel:\n' + errs.join('\n') : 'inga konsolfel');
await browser.close();
console.log(fails ? `${fails} FEL` : 'ALLA OK');
process.exit(fails ? 1 : 0);
