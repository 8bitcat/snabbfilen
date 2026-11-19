// 🏛️ GAMLA STAN (js/scenes/gamlastan.js + js/gamlastan/*, v5): stadens äldsta kvarter, nås med gamla bussen.
//   1. raden GAMLA STAN i hållplatsdialogen i stan → bussen kostar 10 kr → man står vid hållplatsen i Gamla stan
//   2. platserna finns: husens dörrar, brunnen, musikanten, guiden, stånden, bussen
//   3. en dörr berättar (pratbubbla), brunnen tar en krona och ger tur, musikanten spelar för en slant (toner)
//   4. kvällsmarknaden: stängd kl. 13, öppen kl. 17 – köp en kanelbulle (8 kr, hungern stiger)
//   5. om natten lyser fönstren (hus.js _lit) och sagostunden finns på torget
//   6. duvorna lyfter när man går fram till dem
//   7. gamla bussen tillbaka → staden vid hållplatsen man kom ifrån
//   8. inga fel i sidan
//   node tools/gamlastan-test.mjs      (servern på 8788; SMOKE_PORT=… för en annan port)
import { createRequire } from 'module';
const require = createRequire('D:/Qisy/QISYFrontend/QISYFrontend-1/package.json');
const { chromium } = require('playwright');

const PORT = process.env.SMOKE_PORT || process.env.PORT || 8788;
let fails = 0;
const ok = (c, m) => { console.log((c ? 'ok: ' : 'FEL: ') + m); if (!c) fails++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1100, height: 700 } });
const p = await ctx.newPage();
const errs = [];
p.on('pageerror', (e) => errs.push(e.message));
p.on('console', (m) => m.type() === 'error' && !/favicon|peer|ERR_|Failed to load resource|Could not connect|Lost connection/i.test(m.text()) && errs.push(m.text()));
await p.goto(`http://localhost:${PORT}/index.html?nomenu&world=gs${Date.now().toString(36)}`);
await p.evaluate(() => {
  localStorage.clear(); localStorage.setItem('snabbfilen_tips_hus', '1'); localStorage.setItem('snabbfilen_startguide_erbjuden', '1');
  localStorage.setItem('snabbfilen_avatar', JSON.stringify({ name: 'Gamla', look: { skin: '#e0a97f', hair: '#3b2619', style: 'long' }, color: '#ffd23f' }));
  localStorage.setItem('snabbfilen_save1', JSON.stringify({ v: 1, day: 5, min: 13 * 60, money: 500, hunger: 40, energy: 80, home: 'rum', fridge: {}, jobs: {}, earned: 0, presenter: { dag: '2999-01-01-k', antal: 0, ko: [] }, mysterium: { kap: 7, steg: 0, klar: '2000-01-01', hittat: [] } }));
});
await p.reload();
await p.waitForFunction(() => !!window.SF?.game, null, { timeout: 30000 });
await p.evaluate(() => { window.__toasts = []; const T = document.querySelector('#toasts'); new MutationObserver((ms) => ms.forEach((m) => m.addedNodes.forEach((n) => window.__toasts.push(n.textContent)))).observe(T, { childList: true }); });
await sleep(900);
const D = (fn, a) => p.evaluate(fn, a);
const stang = () => D(() => { const m = document.querySelector('#modal'); m.classList.add('hidden'); m.innerHTML = ''; });
const modal = () => D(() => (document.querySelector('#modal:not(.hidden)')?.innerText || '').replace(/\s+/g, ' '));
const toasts = () => D(() => window.__toasts.splice(0));
await stang(); await D(() => SF.go('city')); await sleep(1500); await stang();

// 1. bussen dit
await D(async () => { const { busStopById } = await import('/js/city/map.js'); const s = busStopById('pixeltorget'); SF.scene._debug.teleport(s.x + 20, s.y + 6); }); await sleep(400);
const bs = await D(() => SF.scene._debug.busStop('pixeltorget'));
let dlg = false;
for (let k = 0; k < 2 && !dlg; k++) {   // (andra försöket om figuren inte hann fram till kuren – hände i verify under last)
  await stang(); await D((b) => SF.scene.down(b.x, b.y), bs);
  dlg = await p.waitForFunction(() => !!document.querySelector('#modal:not(.hidden) [data-gamla]'), null, { timeout: 12000 }).then(() => true).catch(() => false);
}
ok(dlg, 'hållplatsdialogen i stan har raden GAMLA STAN');
const m0 = await D(() => SF.game.money);
if (dlg) await D(() => document.querySelector('#modal [data-gamla]')?.click());
else { await stang(); await D(() => { SF.gamlaFran = { buss: 'pixeltorget' }; SF.go('gamlastan'); }); }
const kom = await p.waitForFunction(() => window.SF.sceneName === 'gamlastan' || !!window.SF.scene?._debug?.duvor, null, { timeout: 15000 }).then(() => true).catch(() => false);
await sleep(1500);
ok(kom && (await D(() => SF.game.money)) === m0 - (dlg ? 10 : 0), 'gamla bussen tar en till Gamla stan för 10 kr');
const pos = await D(() => SF.scene._debug.pos());
ok(pos.x > 1600 && pos.y > 250 && pos.y < 300, `man kliver av vid hållplatsen i östra änden (${pos.x}, ${pos.y})`);

// 2. platserna
const spots = await D(() => SF.scene._debug.spots());
ok(['bibliotek', 'museum', 'teater', 'antik', 'kafe', 'guldsmed', 'lyktmakare', 'brunn', 'musikant', 'guide', 'brod', 'blommor', 'buss', 'port', 'valv'].every((s) => spots.includes(s)), `platserna finns (${spots.length} st)`);

// 3. dörren, brunnen, musikanten
await D(() => SF.scene._debug.act('antik')); await sleep(400);
ok(/Antikaffären öppnar snart/.test(await D(() => SF.scene._debug.prat()) || ''), 'antikaffärens dörr berättar vad som kommer (biblioteket har eget prov)');
const m1 = await D(() => SF.game.money);
await D(() => SF.scene._debug.act('brunn')); await sleep(400);
ok((await D(() => SF.game.money)) === m1 - 1 && (await toasts()).some((t) => /Plums/.test(t)), 'brunnen tar en krona och man önskar sig något');
await D(() => SF.scene._debug.act('musikant')); await sleep(1500);
ok((await D(() => SF.game.money)) === m1 - 3 && (await D(() => SF.scene._debug.noter())) > 0, 'musikanten spelar för två kronor – tonerna stiger');

// 4. kvällsmarknaden
ok(!(await D(() => SF.scene._debug.marknad())), 'kl. 13 är kvällsmarknaden stängd');
await D(() => SF.scene._debug.act('brod')); await sleep(400);
ok(/öppnar klockan 16/.test(await D(() => SF.scene._debug.prat()) || ''), 'ståndet säger när marknaden öppnar');
await D(() => { SF.game.min = 17 * 60; }); await sleep(300);
ok(await D(() => SF.scene._debug.marknad()), 'kl. 17 är marknaden öppen');
const h0 = await D(() => SF.game.hunger), m2 = await D(() => SF.game.money);
await D(() => SF.scene._debug.act('brod')); await sleep(500);
ok(/Kanelbulle/.test(await modal()), 'brödståndet säljer kanelbullar');
await D(() => [...document.querySelectorAll('#modal .dlg-foot .btn')].find((b) => /Köp/.test(b.textContent))?.click()); await sleep(400);
ok((await D(() => SF.game.money)) === m2 - 8 && (await D(() => SF.game.hunger)) > h0, `kanelbullen kostar 8 kr och mättar (hunger ${h0} → ${await D(() => SF.game.hunger)})`);

// 5. natten och sagostunden
await D(() => { SF.game.min = 21 * 60 + 30; }); await sleep(1200);
await D(() => SF.scene._debug.teleport(1200, 260)); await sleep(1000);   // (framför teatern – husen målas när de syns)
const lit = await D(async () => { const m = await import('/js/gamlastan/hus.js'); return ['teater', 'hus2', 'hus3'].map((id) => (m._lit(id, true) || []).length); });
ok(lit.every((n) => n > 0), `om natten lyser fönstren (${lit.join('/')} rutor)`);
ok((await D(() => SF.scene._debug.spots())).includes('saga'), 'på kvällen sitter sagoberätterskan på torget');
await D(() => SF.scene._debug.act('saga')); await sleep(400);
ok(/Slut för i dag|Det var en gång|Långt borta/.test(await D(() => SF.scene._debug.prat()) || ''), 'sagostunden berättar en saga');

// 6. duvorna
await D(() => { SF.game.min = 13 * 60; SF.scene._debug.teleport(700, 300); }); await sleep(800);
const d0 = await D(() => SF.scene._debug.duvor());
ok(d0.some((d) => !d.flyg && !d.borta), 'duvorna pickar på torget');
await D(() => SF.scene._debug.teleport(880, 376));
const lyft = await p.waitForFunction(() => window.SF.scene._debug.duvor().some((d) => d.flyg || d.borta), null, { timeout: 6000 }).then(() => true).catch(() => false);   // (väntar på en bildruta – under last kan det dröja)
ok(lyft, 'duvorna lyfter när man kommer nära');

// 7. bussen hem
await stang();
await D(() => SF.scene._debug.act('buss')); await sleep(400);
ok(/Gamla bussen/.test(await modal()) && /Pixeltorget|PIXELTORGET/i.test(await modal()), 'bussdialogen går tillbaka till hållplatsen man kom från');
await D(() => [...document.querySelectorAll('#modal .dlg-foot .btn')].find((b) => /Åk till stan/.test(b.textContent))?.click());
const hemma = await p.waitForFunction(() => !!window.SF.scene?._debug?.districtNow, null, { timeout: 15000 }).then(() => true).catch(() => false);
await sleep(800);
const hemPos = await D(() => ({ d: SF.scene._debug.districtNow(), ...SF.scene._debug.pos() }));
ok(hemma && hemPos.d === 'CENTRUM' && Math.abs(hemPos.x - 616) < 20, `tillbaka i stan vid Pixeltorget (${hemPos.d} ${Math.round(hemPos.x)},${Math.round(hemPos.y)})`);

ok(!errs.length, `inga fel i sidan${errs.length ? ' – ' + [...new Set(errs)].slice(0, 3).join(' | ') : ''}`);
await browser.close();
console.log(fails ? `\n${fails} FEL` : '\nALLT GRÖNT');
process.exit(fails ? 1 : 0);
