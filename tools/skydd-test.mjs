// Tryggheten i den öppna världen (js/net/skydd.js, App Store-riktlinje 1.2) över riktiga PeerJS-molnet
// i en egen privat värld (?world=sk… &nettest=1). Anna och Bosse (med ett fult ord i namnet):
//   1. fula ord blir *** – i Bosses namn, i hans pratbubbla och i det Anna själv skriver
//   2. Anna blockerar Bosse i 👥-rutan: hans figur, bubblor och inbjudningar (jobbkanalen) finns inte
//      längre för henne; blockeringen står i 👥-rutan och överlever en omladdning
//   3. "Ta bort blockering" → Bosse syns igen
//   4. Anmäl: rutan, skälen, e-posten till hello@8bitcat.io med det han skrivit – och han blir blockerad
//   node tools/skydd-test.mjs            (servern på 8788; annan port: SMOKE_PORT=8791 eller PORT=…)
import { createRequire } from 'module';
const require = createRequire('D:/Qisy/QISYFrontend/QISYFrontend-1/package.json');
const { chromium } = require('playwright');

const PORT = process.env.SMOKE_PORT || process.env.PORT || '8788';
const WORLD = 'sk' + Date.now().toString(36);
const URL = `http://localhost:${PORT}/index.html?world=${WORLD}&nettest=1&nomenu`;
let fails = 0;
const ok = (c, m) => { console.log(c ? `ok: ${m}` : `FEL: ${m}`); if (!c) fails++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const errors = [];
const browser = await chromium.launch();
const active = new Set();
const activity = setInterval(() => { for (const p of active) p.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Shift' }))).catch(() => {}); }, 1500);

async function spelare(name, color) {
  const context = await browser.newContext({ viewport: { width: 1000, height: 640 } });
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(`[${name}] ${e.message}`));
  page.on('console', (m) => m.type() === 'error' && !/peer|webrtc|ice|Could not connect|Failed to load resource/i.test(m.text()) && errors.push(`[${name}] ${m.text()}`));
  await page.goto(URL);
  await page.evaluate(([n, c]) => {
    localStorage.clear();
    localStorage.setItem('snabbfilen_tips_hus', '1');
    localStorage.setItem('snabbfilen_avatar', JSON.stringify({ name: n, look: { skin: '#eabf98', shirt: c }, color: c }));
    localStorage.setItem('snabbfilen_save1', JSON.stringify({ v: 1, day: 2, min: 600, money: 100, hunger: 80, energy: 80, home: 'rum', fridge: {}, jobs: {}, earned: 0 }));
  }, [name, color]);
  await page.reload();
  await page.waitForFunction(() => !!window.SF?.worldInfo, null, { timeout: 15000 });
  active.add(page);
  return page;
}
async function until(fn, ms = 15000, step = 250) {
  const end = Date.now() + ms;
  for (;;) { let v = false; try { v = await fn(); } catch { v = false; } if (v || Date.now() > end) return v; await sleep(step); }
}
const iStan = (p) => p.evaluate(() => { const m = document.querySelector('#modal'); m.classList.add('hidden'); m.innerHTML = ''; window.SF.go('city'); setTimeout(() => window.SF.scene._debug.teleport(300, 200), 50); });
const folk = (p) => p.evaluate(() => window.SF.worldFolksHere().map((f) => ({ namn: f.av.name, say: f.say })));
const klicka = (p, sel) => p.evaluate((s) => { const b = document.querySelector(s); if (!b) return false; b.click(); return true; }, sel);

const A = await spelare('Anna', '#e04848');
ok(await until(async () => (await A.evaluate(() => window.SF.worldInfo().open))), 'Anna är i världen');
const B = await spelare('Jävlaben', '#3a78d8');
ok(await until(async () => (await B.evaluate(() => window.SF.worldInfo().open))), 'Bosse (Jävlaben) ansluter');
await iStan(A); await iStan(B);
ok(await until(async () => (await folk(A)).length === 1), 'Anna ser Bosse i staden');
// Annas inkommande jobbmeddelanden (inbjudningar m.m.) räknas
await A.evaluate(async () => { const W = await import('/js/net/world.js'); window.__jobb = []; W.onJob((ev) => { if (ev.m?.k === 'skyddstest') window.__jobb.push(ev.m.n); }); });

// ---------- 1. ordfiltret ----------
const namn = (await folk(A))[0]?.namn || '';
ok(!/jävla/i.test(namn) && /\*\*\*/.test(namn), `fula ord i namnet blir *** (${namn})`);
await B.evaluate(() => window.SF.sendSay('du är en jävla idiot'));
ok(await until(async () => /^du är en \*+ idiot$/.test((await folk(A))[0]?.say || '')), `pratbubblan tvättas (${(await folk(A))[0]?.say})`);
await A.evaluate(() => window.SF.sendSay('skit också, fuck'));
ok(/^\*+ också, \*+$/.test(await A.evaluate(async () => (await import('/js/net/world.js')).worldMySay())), 'det man själv skriver tvättas också');
ok((await A.evaluate(async () => { const S = await import('/js/net/skydd.js'); return [S.tvatta('Hej Fanny!'), S.tvatta('skitbra'), S.tvatta('Kukkonen')].join('|'); })) === 'Hej Fanny!|skitbra|Kukkonen', 'vanliga ord som bara liknar fula ord får vara kvar');
await B.evaluate(async () => (await import('/js/net/world.js')).sendJob({ k: 'skyddstest', n: 1 }));
ok(await until(async () => (await A.evaluate(() => window.__jobb.length)) === 1), 'innan blockeringen: Bosses meddelanden kommer fram');

// ---------- 2. blockera i 👥-rutan ----------
await A.evaluate(() => window.SF.openFriends());
ok(await klicka(A, '#modal [data-block]'), '👥-rutan: 🚫 Blockera vid Bosse');
ok(await until(async () => (await folk(A)).length === 0, 4000), 'blockerad: Bosse syns inte längre i staden');
ok((await A.evaluate(() => window.SF.playersList().length)) === 0, 'blockerad: inte heller i spelarlistan');
await B.evaluate(() => window.SF.sendSay('hallå där'));
await B.evaluate(async () => (await import('/js/net/world.js')).sendJob({ k: 'skyddstest', n: 2 }));
await sleep(2500);
ok((await A.evaluate(() => window.__jobb.length)) === 1, 'blockerad: inga inbjudningar eller meddelanden kommer fram');
ok(/Blockerade \(1\)/.test(await A.evaluate(() => document.querySelector('#modal')?.innerText || '')), '👥-rutan listar de blockerade');
await A.reload();
await A.waitForFunction(() => !!window.SF?.worldInfo, null, { timeout: 15000 });
ok(await until(async () => (await A.evaluate(() => window.SF.worldInfo().open))), 'Anna tillbaka i världen efter omladdning');
await iStan(A);
await sleep(3000);
ok((await folk(A)).length === 0 && (await A.evaluate(() => window.SF.worldInfo().online)) === 2, 'blockeringen gäller efter omladdning (Bosse online men osynlig)');

// ---------- 3. ta bort blockeringen ----------
await A.evaluate(() => window.SF.openFriends());
ok(await klicka(A, '#modal [data-unblock]'), '👥-rutan: Ta bort blockering');
ok(await until(async () => (await folk(A)).length === 1, 6000), 'blockeringen borttagen: Bosse syns igen');

// ---------- 4. anmäl ----------
await B.evaluate(() => window.SF.sendSay('jag ska förstöra ditt hus'));
ok(await until(async () => /förstöra/.test((await folk(A))[0]?.say || '')), 'Bosse skriver något mer');
await A.evaluate(() => { window.__mailto = null; window.__sfMailto = (u) => { window.__mailto = u; }; window.SF.openFriends(); });
ok(await klicka(A, '#modal [data-anmal]'), '👥-rutan: ⚑ Anmäl vid Bosse');
ok(/Anmäl/.test(await A.evaluate(() => document.querySelector('#modal .dlg-head h2')?.textContent || '')) && (await A.evaluate(() => document.querySelectorAll('#modal input[name="anmal-skal"]').length)) === 4, 'anmälningsrutan med fyra skäl');
await A.evaluate(() => { document.querySelector('#modal input[value="stor"]').checked = true; document.querySelector('#modal .anmal-text').value = 'Han följer efter mig hela tiden'; });
await A.evaluate(() => [...document.querySelectorAll('#modal button')].find((b) => /Anmäl och blockera/.test(b.textContent))?.click());
const mail = decodeURIComponent(await A.evaluate(() => window.__mailto || ''));
ok(mail.startsWith('mailto:hello@8bitcat.io?subject=Anmälan'), 'e-posten till hello@8bitcat.io öppnas');
ok(/följer efter/.test(mail) && /förstöra ditt hus/.test(mail) && /Spelarnyckel: \S+/.test(mail), 'med skälet, Annas text, det Bosse skrev och hans spelarnyckel');
ok(await until(async () => (await folk(A)).length === 0, 4000), 'anmäld = blockerad direkt');

ok(!errors.length, `inga fel i konsolen${errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''}`);
clearInterval(activity);
await browser.close();
console.log(fails ? `\n${fails} FEL` : '\nALLA OK');
process.exit(fails ? 1 : 0);
