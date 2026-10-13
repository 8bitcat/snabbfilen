// Regressionstest för 🏆 MERITERNA och TROFÉSKÅPET (js/core/meriter.js, game.js merit, visning.js trofeskap):
//   • första meriten (utställningens belona) → troféskåpet i förrådet + "Din första merit!"; nästa merit ger inget nytt skåp
//   • Best in Show, hinderbanan (hoppResultat) och en komplett pixelkortsserie blir också meriter
//   • meriterna finns kvar efter omladdning
//   • skåpet ritas i möbelarkets extra rad (med meriterna) · hemma: ett tryck på skåpet öppnar "🏆 Mina meriter"
// Kör: node tools/meriter-test.mjs   (servern på 8788, eller SMOKE_PORT / PORT) · SHOTS=1 sparar bilder i tools/out/
import { createRequire } from 'module';
import fs from 'node:fs';
const require = createRequire('D:/Qisy/QISYFrontend/QISYFrontend-1/package.json');
const { chromium } = require('playwright');

const PORT = process.env.SMOKE_PORT || process.env.PORT || 8788, SHOTS = !!process.env.SHOTS;
let fails = 0;
const ok = (c, m) => { console.log((c ? 'ok: ' : 'FEL: ') + m); if (!c) fails++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await chromium.launch();
const errs = [];
const p = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
p.on('pageerror', (e) => errs.push(e.message));
await p.addInitScript(() => { window.__toasts = []; new MutationObserver((ms) => { for (const m of ms) for (const n of m.addedNodes) if (n.classList?.contains('toast')) window.__toasts.push(n.textContent); }).observe(document, { childList: true, subtree: true }); });
await p.goto(`http://localhost:${PORT}/index.html?nomenu&world=mer${Date.now().toString(36)}`);
await p.evaluate(() => {
  localStorage.clear(); localStorage.setItem('snabbfilen_tips_hus', '1'); localStorage.setItem('snabbfilen_startguide_erbjuden', '1');
  localStorage.setItem('snabbfilen_avatar', JSON.stringify({ id: 'id-mer', name: 'Vinnie', look: { skin: '#e0a97f' }, color: '#ffd23f' }));
  localStorage.setItem('snabbfilen_save1', JSON.stringify({ v: 1, day: 5, min: 12 * 60, money: 5000, hunger: 90, energy: 100, home: 'husvagn', fridge: {}, jobs: {}, earned: 0, mal: { id: 'rik', niva: 'latt' }, presenter: { dag: '2999-01-01-k', antal: 0, ko: [] } }));
});
await p.reload().catch(() => {});
await p.waitForFunction(() => !!window.SF?.game, null, { timeout: 30000 });
await sleep(1500);
const stang = () => p.evaluate(() => { const m = document.querySelector('#modal'); m.classList.add('hidden'); m.innerHTML = ''; });
await stang();

// ---- första meriten: kattutställningen, 1:a plats ----
const r1 = await p.evaluate(async () => {
  const { belona } = await import('/js/scenes/utstallning.js'), g = SF.game, S = { save() {} }, pet = { name: 'Misse' };
  belona(g, S, pet, 'katt', 1, 90);   // 90 poäng → även Best in Show
  return { meriter: JSON.parse(JSON.stringify(g.meriter)), skap: g.storage.filter((s) => s.k === 'trofeskap').length, pokaler: g.storage.filter((s) => s.k === 'pokal').length };
});
ok(r1.meriter.length === 2 && r1.meriter[0].typ === 'katt' && r1.meriter[0].plats === 1 && r1.meriter[0].vem === 'Misse' && r1.meriter[1].typ === 'bis' && r1.meriter[1].klass === 'katt', `utställningen: kattutställning 1:a + Best in Show (${JSON.stringify(r1.meriter.map((m) => m.typ + m.plats))})`);
ok(r1.skap === 1 && r1.pokaler === 1, `första meriten: troféskåpet i förrådet (och guldpokalen som förut) (${r1.skap} skåp, ${r1.pokaler} pokal)`);
await sleep(2800);
ok(/Din första merit!/.test(await p.evaluate(() => window.__toasts.join(' | '))), '"🏆 Din första merit! Du har fått ett troféskåp …"');
// ---- fler meriter: hundutställningen 2:a, hinderbanan, en hel pixelkortsserie ----
const r2 = await p.evaluate(async () => {
  const { belona } = await import('/js/scenes/utstallning.js'), g = SF.game;
  belona(g, { save() {} }, { name: 'Rex' }, 'hund', 2, 70);
  g.hast = { namn: 'Blixten', klass: 0, rosetter: {} };
  const h = g.hoppResultat('latt', 0, 20);
  const pk = await import('/js/core/pixelkort.js');
  pk.laggTill(g, pk.serieKort('katter').map((k) => k.id));
  return { meriter: g.meriter.map((m) => `${m.typ}${m.plats}${m.klass ? ':' + m.klass : ''}`), skap: g.storage.filter((s) => s.k === 'trofeskap').length, hopp: h?.plats };
});
ok(r2.skap === 1, `inget nytt skåp vid nästa merit (${r2.skap})`);
ok(r2.meriter.includes('hund2') && r2.meriter.includes(`hopp${r2.hopp}:latt`) && r2.meriter.includes('kort1:katter'), `hundutställningen, hinderbanan (plats ${r2.hopp}) och kortserien Katter är meriter (${r2.meriter.join(', ')})`);
// ---- sparfilen ----
await p.evaluate(() => SF.game.save());
await p.reload().catch(() => {});
await p.waitForFunction(() => !!window.SF?.game, null, { timeout: 30000 });
await sleep(1200); await stang();
const n5 = await p.evaluate(() => SF.game.meriter.length);
ok(n5 === r2.meriter.length, `meriterna finns kvar efter omladdning (${n5})`);

// ---- skåpet i möbelarket ----
const ark = await p.evaluate(async () => {
  SF.go('city'); await new Promise((r) => setTimeout(r, 500)); SF.roomSub = 0; SF.go('room'); await new Promise((r) => setTimeout(r, 1500));
  const { ATLAS } = await import('/js/scenes/room.js'), { FRAMES } = await import('/js/data/frames.js');
  for (let i = 0; i < 40 && !(ATLAS.complete && ATLAS.naturalHeight > 471); i++) await new Promise((r) => setTimeout(r, 100));
  const f = FRAMES.trofeskap0; if (!f) return null;
  const c = document.createElement('canvas'); c.width = f[2]; c.height = f[3]; const x = c.getContext('2d'); x.drawImage(ATLAS, f[0], f[1], f[2], f[3], 0, 0, f[2], f[3]);
  const d = x.getImageData(0, 0, f[2], f[3]).data; let guld = 0, n = 0; for (let i = 0; i < d.length; i += 4) { if (d[i + 3]) n++; if (d[i] === 0xf2 && d[i + 1] === 0xc1 && d[i + 2] === 0x4e) guld++; }
  const z = document.createElement('canvas'); z.width = f[2] * 8; z.height = f[3] * 8; const zx = z.getContext('2d'); zx.imageSmoothingEnabled = false; zx.drawImage(c, 0, 0, z.width, z.height);
  return { f, n, guld, h: ATLAS.naturalHeight, png: z.toDataURL('image/png') };
});
ok(ark && ark.n > 1200 && ark.guld > 5, `troféskåpet ritas i arkets extra rad med guld bakom glaset (${ark?.n} pixlar, ${ark?.guld} guldpixlar, arket ${ark?.h} högt)`);
if (SHOTS && ark?.png) fs.writeFileSync('tools/out/meriter-skap.png', Buffer.from(ark.png.split(',')[1], 'base64'));

// ---- hemma: ställ ut skåpet och tryck på det ----
const key = await p.evaluate(() => {
  const g = SF.game, i = g.storage.findIndex((s) => s.k === 'trofeskap');
  const key = Object.keys(g.deco).find((k) => k.startsWith('husvagn')) || 'husvagn:0';
  const [it] = g.storage.splice(i, 1); (g.deco[key] ||= []).push({ ...it, x: 150, y: 70 }); g.save();
  return key;
});
await p.evaluate(() => { SF.go('city'); }); await sleep(500);
await p.evaluate(() => { SF.roomSub = 0; SF.go('room'); }); await sleep(1500);
const prop = await p.evaluate(() => SF.scene._debug.props().find((q) => q.k === 'trofeskap') || null);
ok(!!prop && prop.fn === 'meriter', `skåpet står hemma som en funktionsmöbel (${JSON.stringify(prop)})`);
if (SHOTS) await p.screenshot({ path: 'tools/out/meriter-hemma.png' });
// (skåpet har ingen egen klickruta – tryck mitt på bilden, en bit ovanför fotytan)
const sol = prop?.solid || [130, 120, 170, 135], hx = (sol[0] + sol[2]) / 2, hy = sol[1] - 8;
await p.evaluate(([x, y]) => SF.scene.down(SF.scene._debug.toScreen ? SF.scene._debug.toScreen(x) : x, y), [hx, hy]);
await p.waitForFunction(() => /Mina meriter/.test(document.querySelector('#modal:not(.hidden) .dlg-head h2')?.textContent || ''), null, { timeout: 8000 }).catch(() => {});
const dlg = await p.evaluate(() => ({ h: document.querySelector('#modal:not(.hidden) .dlg-head h2')?.textContent || '', rader: document.querySelectorAll('#modal .mer-rad').length, txt: document.querySelector('#modal')?.innerText || '' }));
ok(/Mina meriter/.test(dlg.h) && dlg.rader === n5 && /🥇 \d+ · 🥈 \d+ · 🥉 \d+/.test(dlg.txt) && /Best in Show/.test(dlg.txt) && /Misse/.test(dlg.txt), `ett tryck på skåpet: "🏆 Mina meriter" med ${dlg.rader} rader`);
if (SHOTS) await p.screenshot({ path: 'tools/out/meriter-lista.png' });

await browser.close();
ok(!errs.length, `inga fel i sidan${errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''}`);
console.log(fails ? `\n✗ ${fails} FEL` : '\nALLT GRÖNT');
process.exit(fails ? 1 : 0);
