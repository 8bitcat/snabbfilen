// Klicktester för husdjurslagret i attrapprummet (tools/pets-room-preview.html):
//   node tools/pets-room-test.mjs            (servern: python -m http.server 8788 i spelmappen)
// Hämta säck → häll i skålen, töm kattlådan, städa bajs, klappa/leka/koppel/byt namn via menyn,
// utplacering ur förrådet, att djuren äter ur skålen och att hunden bajsar inne utan promenad.
// Skärmbilder: tools/out/pets-test-meny.png (djurmenyn), pets-test-bar.png (bär säcken),
// pets-test-forrad.png (förrådsdialogen).
import { createRequire } from 'module';
const require = createRequire('D:/Qisy/QISYFrontend/QISYFrontend-1/package.json');
const { chromium } = require('playwright');
import fs from 'fs';

const port = process.env.PORT || '8788';
const K = 4;
let fails = 0, passes = 0;
const ok = (c, m) => { if (c) { passes++; console.log('  ok  ' + m); } else { fails++; console.log('  FEL ' + m); } };

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 384 * K + 40, height: 216 * K + 200 } });
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
page.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
await page.goto(`http://localhost:${port}/tools/pets-room-preview.html?manual=1&k=${K}&scene=hem&v=${Date.now()}`);
await page.waitForFunction(() => window.PV && window.PV.ready);
fs.mkdirSync('tools/out', { recursive: true });

const ev = (fn, arg) => page.evaluate(fn, arg);
const run = (sec) => ev((s) => { PV.advance(s); PV.render(); }, sec);
// klicka som en spelare: på skärmen (canvasens pixlar), inte via API:t
async function clickAt(x, y) {
  const box = await page.locator('#c').boundingBox();
  await page.mouse.click(box.x + (x + 0.5) * K, box.y + (y + 0.5) * K);
}
const spot = (id) => ev((id) => PV.layer._debug.spot(id), id);

// ---- 1. Hämta säck → häll i skålen
console.log('\n# Mata: hämta säcken, häll i skålen');
await ev(() => { PV.setup('hem', { hour: 12 }); });
const emptyBowl = await ev(() => PV.store.items.find((i) => i.k === 'matskal' && !(i.food > 0)).id);
let s = await spot('sack-katt');
await clickAt(s.x, s.y);
await run(4);
let carry = await ev(() => PV.A.carrying);
ok(carry && carry.k === 'sack-katt', 'figuren bär kattmatssäcken efter klicket (A.carrying)');
await page.screenshot({ path: 'tools/out/pets-test-bar.png', clip: { x: 0, y: 0, width: 384 * K, height: 216 * K } });
const leftBefore = await ev(() => PV.store.items.find((i) => i.k === 'sack-katt').left);
s = await spot(emptyBowl);
await clickAt(s.x, s.y);
await run(4);
const bowl = await ev((id) => { const b = PV.store.itemById(id); return { food: b.food, kind: b.foodKind }; }, emptyBowl);
ok(bowl.food > 0.9 && bowl.kind === 'katt', `skålen fylld med kattmat (${bowl.food.toFixed(2)})`);
ok(await ev(() => PV.store.items.find((i) => i.k === 'sack-katt').left) === leftBefore - 1, 'säcken tappade en portion');
ok(!(await ev(() => PV.A.carrying)), 'säcken ställdes tillbaka (bär inget längre)');
// skål utan säck i handen → tips, ingen fyllning
await ev((id) => { PV.store.itemById(id).food = 0; }, emptyBowl);
await clickAt(s.x, s.y);
await run(3);
ok((await ev((id) => PV.store.itemById(id).food, emptyBowl)) === 0, 'klick på skålen utan säck fyller inte (måste hämta säcken först)');
const toastTxt = await ev(() => [...document.querySelectorAll('#toasts .toast')].map((e) => e.textContent).join(' | '));
ok(/säck/i.test(toastTxt), 'toast förklarar: ' + toastTxt.slice(0, 90));

// ---- 2. Djuren äter ur skålen
console.log('\n# Djuren äter själva');
await ev((id) => { const b = PV.store.itemById(id); b.food = 1; b.foodKind = 'katt'; const m = PV.store.pets.find((p) => p.name === 'Misse'); m.hunger = 20; PV.layer._debug.think(m.id); }, emptyBowl);
const h0 = await ev(() => PV.store.pets.find((p) => p.name === 'Misse').hunger);
await run(20);
const h1 = await ev(() => PV.store.pets.find((p) => p.name === 'Misse').hunger);
ok(h1 > h0 + 20, `hungriga Misse gick till skålen och åt (mätt ${Math.round(h0)} → ${Math.round(h1)})`);

// ---- 3. Töm kattlådan, städa bajs
console.log('\n# Städa');
for (let k = 0; k < 4 && (await ev(() => PV.store.items.find((i) => i.k === 'kattlada').dirt)) > 0; k++) {
  // en katt kan stå i vägen (då öppnas dess meny i stället) – stäng och försök igen
  await ev(() => { if (!document.getElementById('modal').classList.contains('hidden')) document.querySelector('#modal [data-close]')?.click(); });
  s = await spot('kattlada');
  await clickAt(s.x, s.y + 3);
  await run(6);
}
ok((await ev(() => PV.store.items.find((i) => i.k === 'kattlada').dirt)) === 0, 'kattlådan tömd');
const nm = await ev(() => PV.store.messes.length);
s = await spot('bajs');
await clickAt(s.x, s.y);
await run(5);
ok((await ev(() => PV.store.messes.length)) === nm - 1, 'bajset städat');

// ---- 4. Djurmenyn
console.log('\n# Djurmenyn');
await ev(() => PV.setup('hem', { hour: 12 }));
const bamse = await ev(() => PV.store.pets.find((p) => p.name === 'Bamse').id);
await run(0.2);
s = await spot(bamse);
await clickAt(s.x, s.y);
await run(4);
ok(await ev(() => !document.getElementById('modal').classList.contains('hidden')), 'klick på hunden öppnar menyn');
const btns = await ev(() => [...document.querySelectorAll('#modal .dlg-foot .btn')].map((b) => b.textContent.trim()));
ok(['Klappa', 'Leka', 'Koppel på', 'Byt namn'].every((w) => btns.some((b) => b.includes(w))), 'knappar: ' + btns.join(' · '));
await page.screenshot({ path: 'tools/out/pets-test-meny.png' });
const happy0 = await ev((id) => PV.store.petById(id).happy, bamse);
await ev(() => [...document.querySelectorAll('#modal .dlg-foot .btn')].find((b) => b.textContent.includes('Klappa')).click());
ok((await ev((id) => PV.store.petById(id).happy, bamse)) > happy0, 'Klappa ger glädje');
// koppel på → hunden följer
await clickAt((await spot(bamse)).x, (await spot(bamse)).y);
await run(3);
await ev(() => [...document.querySelectorAll('#modal .dlg-foot .btn')].find((b) => b.textContent.includes('Koppel')).click());
ok(await ev((id) => PV.store.petById(id).out, bamse), 'Koppel på → hunden är ute (walkStart)');
await ev(() => PV.walker.walkTo(320, 190));
await run(6);
const d = await ev((id) => { const a = PV.layer._debug.actors.get(id); return Math.hypot(a.x - PV.walker.px, a.y - PV.walker.py); }, bamse);
ok(d < 30, `hunden i koppel följde med över rummet (avstånd ${d.toFixed(1)} px)`);
await ev((id) => PV.store.walkEnd(id), bamse);
// byt namn
await clickAt((await spot(bamse)).x, (await spot(bamse)).y);
await run(3);
await ev(() => [...document.querySelectorAll('#modal .dlg-foot .btn')].find((b) => b.textContent.includes('Byt namn')).click());
await page.fill('#pet-namn', 'Kalle Anka');
await ev(() => [...document.querySelectorAll('#modal .dlg-foot .btn')].find((b) => b.textContent.includes('Spara')).click());
ok((await ev((id) => PV.store.petById(id).name, bamse)) === 'Kalle Anka', 'Byt namn');

// kattungen: "Ta med ut" är gråad (walkStart skulle neka med 'for-liten')
const nala = await ev(() => PV.store.pets.find((p) => p.name === 'Nala').id);
await ev(() => { if (!document.getElementById('modal').classList.contains('hidden')) document.querySelector('#modal [data-close]')?.click(); });
await clickAt((await spot(nala)).x, (await spot(nala)).y);
await run(3);
const small = await ev(() => { const b = [...document.querySelectorAll('#modal .dlg-foot .btn')].find((b) => /liten/i.test(b.textContent)); return b ? { disabled: b.disabled, txt: b.textContent.trim() } : null; });
ok(small && small.disabled, `kattungens meny: knappen "${small?.txt}" är gråad`);
await page.screenshot({ path: 'tools/out/pets-test-meny-unge.png' });
await ev(() => document.querySelector('#modal [data-close]')?.click());

// ---- 5. Förrådet: ställ ut en kattlåda
console.log('\n# Förrådet');
await ev(() => { PV.store.buyItem('kattlada'); PV.store.buyItem('sack-kanin'); PV.layer.openInventory(); });
await page.screenshot({ path: 'tools/out/pets-test-forrad.png' });
const fit = await ev(() => { const d = document.querySelector('#modal .dlg'); const r = d.getBoundingClientRect(); const foot = d.querySelector('.dlg-foot').getBoundingClientRect(); return { h: Math.round(r.height), win: window.innerHeight, footIn: foot.bottom <= window.innerHeight + 1, rows: d.querySelectorAll('.prow').length, scrolls: d.scrollHeight > d.clientHeight + 1 }; });
ok(fit.footIn && !fit.scrolls, `Djurprylar-dialogen ryms på skärmen (${fit.h}/${fit.win} px, ${fit.rows} rader, Klar-knappen synlig)`);
await ev(() => document.querySelector('#modal [data-place="kattlada"]').click());
const n0 = await ev(() => PV.store.items.filter((i) => i.k === 'kattlada').length);
await ev(() => { PV.hover(300, 205); PV.render(); });
await clickAt(300, 205);
ok((await ev(() => PV.store.items.filter((i) => i.k === 'kattlada').length)) === n0 + 1, 'kattlådan ställdes ut där man klickade');

// ---- 6. Hunden bajsar inne om ingen går ut
console.log('\n# Olyckor inne');
await ev(() => { PV.setup('hem', { hour: 12 }); PV.store.messes.length = 0; const b = PV.store.pets.find((p) => p.name === 'Bamse'); b.toilet = 99.5; });
await ev(() => { PV.A.game.min += 20; });
await run(12);
const accident = await ev(() => PV.store.messes.filter((m) => m.by === 'hund').length);
ok(accident >= 1, `hunden gjorde på golvet när ingen gick ut (${accident} st)`);
const pose = await ev(() => PV.layer._debug.pets().find((p) => p.name === 'Bamse'));
ok(pose && pose.x > 0, 'hunden står kvar i rummet');

// ---- 7. Mätarna: fyra djur tätt ihop → inga torn, inga överlapp, alla nära sitt djur
console.log('\n# Mätarna i ett kluster');
await ev(() => PV.setup('kluster', { hour: 12 }));
await run(3);
const meters = await ev(() => PV.layer._debug.meters());
const overlap = (a, b) => a.x0 < b.x0 + b.w && a.x0 + a.w > b.x0 && a.y0 < b.y0 + b.h && a.y0 + a.h > b.y0;
let overlaps = 0;
for (let i = 0; i < meters.length; i++) for (let j = i + 1; j < meters.length; j++) if (!meters[i].dim && !meters[j].dim && overlap(meters[i], meters[j])) overlaps++;
ok(overlaps === 0, `inga två tydliga skyltar överlappar (${meters.length} djur)`);
const lift = meters.map((m) => m.baseY0 - m.y0);
ok(Math.max(...lift) <= 10, `ingen skylt lyfts mer än en skylthöjd (max ${Math.max(...lift)} px)`);
const side = meters.map((m) => Math.abs(m.x0 - m.baseX0));
ok(Math.max(...side) <= 14, `sidoförskjutning högst 14 px (max ${Math.max(...side)} px)`);
const near = meters.every((m) => m.petY - (m.y0 + m.h) <= 30);
ok(near, 'varje skylt sitter inom 30 px ovanför sitt djur');
console.log('   ' + meters.map((m) => `${m.name}: dx ${m.x0 - m.baseX0} dy ${m.y0 - m.baseY0}${m.dim ? ' (nedtonad)' : ''}`).join(' · '));
// hovra en av dem → dess skylt får förtur och full styrka
const bamse2 = await ev(() => PV.store.pets.find((p) => p.name === 'Bamse').id);
const sb = await spot(bamse2);
await ev(({ x, y }) => { PV.hover(x, y); }, sb);
await run(1.5);
const mB = await ev((id) => PV.layer._debug.meters().find((m) => m.id === id), bamse2);
ok(mB && !mB.dim && Math.abs(mB.x0 - mB.baseX0) <= 2 && mB.y0 === mB.baseY0, 'hovrad hund: skylten står på sin hemplats och är tydlig');
await page.screenshot({ path: 'tools/out/pets-test-kluster.png', clip: { x: 0, y: 0, width: 384 * K, height: 216 * K } });

console.log(`\n${passes} ok, ${fails} fel`);
console.log(errs.length ? 'KONSOLFEL:\n' + errs.join('\n') : 'Inga konsolfel.');
await browser.close();
process.exit(fails || errs.length ? 1 : 0);
