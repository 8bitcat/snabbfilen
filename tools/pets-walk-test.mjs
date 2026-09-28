// Promenaden: hunden i koppel ute i staden (js/pets/outdoors.js i js/scenes/city.js).
// Playwright mot servern på 8788:   node tools/pets-walk-test.mjs      (annan port: SMOKE_PORT=8791)
//  1. vuxen hund (adopterad med födelsedag bakåt i tiden) hemma i lägenheten
//  2. riktiga klick: djurmenyn → 🦮 Koppel på → ytterdörren → staden
//  3. hunden syns bredvid figuren i staden (följaren) och går med mjukt (10 rutor × 80 ms)
//  4. promenaden räknas med spelklockan (outMin) och hunden gör sitt UTE (didBusiness,
//     toalettbehovet nollas, toast) – ingen olycka hemma
//  5. hem genom porten: kopplet av, hunden hemma, INTE mer kissnödig än när den gick
//  6. bussen (teleport): hunden ställs om bredvid figuren, inget jättekliv
//  7. glömd ute: 7 speltimmar i en butik → hunden har gått hem själv (🏠), ingen följare kvar
//  8. huvudmenyns bakgrundsstad (A.attract) rör inte djurbutiken (klockan står still)
// Bilder: tools/out/pets-walk-*.png. Inga konsolfel får förekomma.
import { createRequire } from 'module';
const require = createRequire('D:/Qisy/QISYFrontend/QISYFrontend-1/package.json');
const { chromium } = require('playwright');
import fs from 'fs';

const OUT = 'D:/GamesProjects/snabbfilen/tools/out/';
const PORT = process.env.SMOKE_PORT || '8788';
let fails = 0, passes = 0;
const ok = (c, m) => { if (c) passes++; else fails++; console.log((c ? '  ✓ ' : '  ✗ ') + m); };
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1180, height: 720 } });
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
page.on('console', (m) => m.type() === 'error' && !/peer|webrtc|ice|Could not connect|Failed to load resource/i.test(m.text()) && errs.push(m.text()));
await page.goto(`http://localhost:${PORT}/index.html?world=pw${Date.now().toString(36)}`);
await page.evaluate(() => {
  localStorage.clear();
  localStorage.setItem('snabbfilen_avatar', JSON.stringify({ name: 'Hundägare', look: { skin: '#e0a97f', hair: '#3b2619', style: 'long', shirt: '#3a7bd5', pants: '#2d3a5c' }, color: '#ffd23f' }));
  localStorage.setItem('snabbfilen_save1', JSON.stringify({ v: 1, day: 9, min: 10 * 60, money: 20000, hunger: 95, energy: 95, home: 'lagenhet', fridge: {}, jobs: {}, earned: 0, wardrobe: [], storage: [], deco: {}, won: false }));
});
await page.reload();
await page.waitForFunction(() => !!window.SF?.game && window.SF.sceneName === 'room', null, { timeout: 20000 });
await page.waitForTimeout(600);

const ev = (fn, arg) => page.evaluate(fn, arg);
const wait = (ms) => page.waitForTimeout(ms);
const until = async (fn, arg, ms = 8000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await ev(fn, arg)) return true; await wait(120); } return false; };
async function clickAt(x, y) {
  const b = await page.locator('#scene').boundingBox();
  await page.mouse.click(b.x + (x + 0.5) * b.width / 384, b.y + (y + 0.5) * b.height / 216);
}
const closeModal = () => ev(() => { if (!document.getElementById('modal').classList.contains('hidden')) (document.querySelector('#modal [data-close]') || [...document.querySelectorAll('#modal .dlg-foot .btn')].pop())?.click(); });
const canvasPng = async (name, scale = 3) => {
  const url = await ev((s) => {
    const c = document.querySelector('#scene');
    const o = document.createElement('canvas'); o.width = 384 * s; o.height = 216 * s;
    const x = o.getContext('2d'); x.imageSmoothingEnabled = false;
    x.drawImage(c, 0, 0, o.width, o.height);
    return o.toDataURL('image/png');
  }, scale);
  fs.writeFileSync(OUT + name + '.png', Buffer.from(url.split(',')[1], 'base64'));
  console.log('   → tools/out/' + name + '.png');
};
const dog = () => ev(() => { const p = window.__pets.petById(window.__dog); return { out: p.out, outMin: p.outMin || 0, outTot: p.outTot || 0, toilet: p.toilet, did: !!p.didBusiness, stage: p.stage, home: p.home, room: p.room }; });
const cityPets = () => ev(() => (window.SF.sceneName === 'city' ? window.SF.scene._debug.pets() : null));
const me = () => ev(() => window.SF.scene._debug.pos());

// ---------- 1. hunden hemma ----------
console.log('\n1. en vuxen hund hemma');
await ev(async () => {
  const { petStore } = await import('/js/pets/sim.js');
  const s = petStore(), g = window.SF.game;
  s.reset();
  const hund = s.adopt('hund', '', 'hane', 'Bamse', g.home, { day: g.day - 9 }); // som en hund man haft i nio dagar
  s.buyItem('sack-hund', 1);
  window.__pets = s; window.__dog = hund.id;
  window.SF.go('city'); window.SF.go('room');
});
await wait(1200);
let d = await dog();
ok(d.stage === 'vuxen', `hunden adopterad nio dagar bakåt är vuxen direkt (${d.stage}) – inte "för liten" till nästa morgon`);
ok(await ev(() => window.SF.scene._debug.layer()._debug.pets().some((p) => p.id === window.__dog)), 'Bamse syns hemma');

// ---------- 2. koppel på med riktiga klick → ut genom dörren ----------
console.log('\n2. koppel på och ut');
await ev(() => { window.__pets.petById(window.__dog).toilet = 70; }); // kissnödig – ska göra sitt ute
let menu = false;
for (let k = 0; k < 5 && !menu; k++) {
  await closeModal();
  const s = await ev(() => window.SF.scene._debug.layer()._debug.spot(window.__dog));
  await clickAt(s.x, s.y);
  menu = await until(() => !document.getElementById('modal').classList.contains('hidden') && document.querySelector('#modal').textContent.includes('Bamse'), null, 6000);
}
ok(menu, 'klick på hunden → Bamses meny');
const leashBtn = await ev(() => [...document.querySelectorAll('#modal .dlg-foot .btn')].map((b) => b.textContent.trim()).find((t) => /Koppel på/.test(t)) || null);
ok(!!leashBtn, `menyn har ${leashBtn || '(ingen Koppel på-knapp)'}`);
await ev(() => [...document.querySelectorAll('#modal .dlg-foot .btn')].find((b) => /Koppel på/.test(b.textContent))?.click());
await wait(200);
await closeModal();
d = await dog();
ok(d.out, 'kopplet är på (out)');
const doorSpot = await ev(() => window.SF.scene._debug.spot('dorr'));
await clickAt(doorSpot.x, doorSpot.y);
ok(await until(() => window.SF.sceneName === 'city', null, 10000), 'figuren gick ut genom ytterdörren till staden');
await wait(500);

// ---------- 3. hunden i staden ----------
console.log('\n3. hunden följer med i staden');
let fp = await cityPets(), pos = await me();
ok(fp && fp.length === 1 && fp[0].id === (await ev(() => window.__dog)), `en följare i staden (${JSON.stringify(fp)})`);
ok(fp && fp[0] && Math.hypot(fp[0].x - pos.x, fp[0].y - pos.y) < 30, `hunden går bredvid figuren (${fp?.[0] ? Math.round(Math.hypot(fp[0].x - pos.x, fp[0].y - pos.y)) : '?'} px bort)`);
const target = await ev(() => { const p = window.SF.scene._debug.pos(); return { x: p.x + 170, y: p.y + 4 }; });
await ev((t) => window.SF.scene._debug.walkTo(t.x, t.y), target);
await wait(300);
const frames = [];
for (let i = 0; i < 10; i++) {
  frames.push(await ev(() => {
    const c = document.querySelector('#scene');
    const o = document.createElement('canvas'); o.width = 384; o.height = 216;
    const x = o.getContext('2d'); x.imageSmoothingEnabled = false; x.drawImage(c, 0, 0, 384, 216);
    return { png: o.toDataURL('image/png'), pets: window.SF.scene._debug.pets(), me: window.SF.scene._debug.pos() };
  }));
  await wait(80);
}
let maxJump = 0, flips = 0, maxDist = 0;
for (let i = 1; i < frames.length; i++) {
  const p = frames[i].pets[0], q = frames[i - 1].pets[0];
  if (!p || !q) continue;
  maxJump = Math.max(maxJump, Math.hypot(p.x - q.x, p.y - q.y));
  if (p.dir !== q.dir) flips++;
  maxDist = Math.max(maxDist, Math.hypot(p.x - frames[i].me.x, p.y - frames[i].me.y));
}
const ownerStep = Math.max(...frames.slice(1).map((f, i) => Math.hypot(f.me.x - frames[i].me.x, f.me.y - frames[i].me.y)));
ok(frames.every((f) => f.pets.length === 1), 'hunden syns i varje ruta');
ok(maxJump <= ownerStep + 4, `största kliv mellan två rutor ${maxJump.toFixed(1)} px (figuren ${ownerStep.toFixed(1)} px – hunden hänger med utan skutt)`);
ok(flips < 5, `riktningsbyten på 10 rutor: ${flips} (inget fladder)`);
ok(maxDist < 30, `kopplet håller: hunden högst ${maxDist.toFixed(1)} px från figuren`);
console.log('   ' + frames.map((f) => `${f.pets[0]?.anim}/${f.pets[0]?.dir}`).join(' '));
await ev((pngs) => new Promise((res) => {
  const o = document.createElement('canvas'); o.width = 384 * 5; o.height = 216 * 2;
  const x = o.getContext('2d'); let n = 0;
  pngs.forEach((u, i) => { const im = new Image(); im.onload = () => { x.drawImage(im, (i % 5) * 384, Math.floor(i / 5) * 216); if (++n === pngs.length) { window.__strip = o.toDataURL('image/png'); res(); } }; im.src = u; });
}), frames.map((f) => f.png));
fs.writeFileSync(OUT + 'pets-walk-2-sekvens.png', Buffer.from((await ev(() => window.__strip)).split(',')[1], 'base64'));
console.log('   → tools/out/pets-walk-2-sekvens.png');
await until(() => window.SF.scene._debug.arrived(), null, 6000);
await canvasPng('pets-walk-1-koppel');

// ---------- 4. promenaden räknas, hunden gör sitt ute ----------
console.log('\n4. promenaden');
const toilet0 = (await dog()).toilet;
for (let i = 0; i < 3; i++) { await ev(() => window.SF.game.passTime(10)); await wait(400); }
d = await dog();
ok(d.outMin >= 25, `promenaden räknas med spelklockan: ${Math.round(d.outMin)} min ute (outMin)`);
const did = await until(() => !!window.__pets.petById(window.__dog).didBusiness, null, 15000);
d = await dog();
ok(did && d.did, 'Bamse stannade och gjorde sitt ute (outdoorBusiness)');
ok(d.toilet < 10, `toalettbehovet nollades ute (${toilet0.toFixed(0)} → ${d.toilet.toFixed(0)})`);
ok(await ev(() => [...document.querySelectorAll('#toasts .toast')].some((t) => /fick göra sitt ute/.test(t.textContent))), 'toast: "Bamse fick göra sitt ute. Duktig!"');
ok(await ev(() => window.__pets.messes.length === 0), 'ingen olycka hemma');
await wait(500);
await canvasPng('pets-walk-3-ute');

// ---------- 5. hem igen ----------
console.log('\n5. hem genom porten');
const before = await dog();
const homeB = await ev(() => { const g = window.SF.game; const b = window.SF.scene._debug.buildings.find((x) => (x.homes || []).includes(g.home)); return b ? b.id : null; });
ok(!!homeB, `hemmets port hittad (${homeB})`);
await ev((id) => window.SF.scene._debug.enter(id), homeB);
ok(await until(() => window.SF.sceneName === 'room', null, 20000), 'figuren gick in genom porten och är hemma');
await wait(900);
d = await dog();
ok(!d.out && d.outMin === 0, 'kopplet av vid hemkomsten (walkEnd)');
ok(d.toilet <= before.toilet + 3, `inte mer kissnödig än när den gick in (${before.toilet.toFixed(1)} → ${d.toilet.toFixed(1)})`);
ok(await ev(() => window.SF.scene._debug.layer()._debug.pets().some((p) => p.id === window.__dog)), 'Bamse är hemma i rummet');
ok(await ev(() => window.__pets.messes.length === 0), 'fortfarande ingen olycka inne');
await canvasPng('pets-walk-4-hemma');

// ---------- 6. bussen ----------
console.log('\n6. bussen');
await ev(() => { window.__pets.walkStart(window.__dog); window.SF.go('city'); });
await wait(600);
const before6 = await me();
await ev(() => window.SF.scene._debug.busTo('soderkyrkan'));
ok(await until(() => { const p = window.SF.scene._debug.pos(); return window.SF.scene._debug.arrived() && Math.abs(p.x - 1106) < 60; }, null, 12000), `bussen tog figuren till Söderkyrkan (från x ${Math.round(before6.x)})`);
await wait(400);
fp = await cityPets(); pos = await me();
ok(fp && fp.length === 1 && Math.hypot(fp[0].x - pos.x, fp[0].y - pos.y) < 30, `hunden kom med och står bredvid figuren (${fp?.[0] ? Math.round(Math.hypot(fp[0].x - pos.x, fp[0].y - pos.y)) : '?'} px)`);
await canvasPng('pets-walk-5-soder');

// ---------- 7. glömd ute ----------
console.log('\n7. glömd ute i sju timmar');
await ev(() => { window.SF.go('djur'); window.SF.game.passTime(7 * 60); });
await wait(300);
await ev(() => window.SF.go('city'));
await wait(500);
d = await dog();
fp = await cityPets();
ok(!d.out, 'Bamse har gått hem själv efter mer än sex timmar');
ok(fp && fp.length === 0, 'ingen följare kvar i staden');
ok(await ev(() => window.__pets.log.some((e) => e.type === 'hem')), 'händelsen "hem" finns i dagboken');
ok(await ev(() => [...document.querySelectorAll('#toasts .toast')].some((t) => /gick hem själv/.test(t.textContent))), 'toast: "… gick hem själv."');

// ---------- 8. huvudmenyns stad rör inte butiken ----------
console.log('\n8. huvudmenyns bakgrundsstad');
const clock0 = await ev(() => window.__pets.clockAbs);
await ev(() => { window.SF.attract = true; window.SF.game.day = 1; window.SF.game.min = 7 * 60; window.SF.go('city'); });
await wait(800);
const probe = await ev(() => ({ clock: window.__pets.clockAbs, pets: window.__pets.pets.length, restarted: window.__pets.restarted, followers: window.SF.scene._debug.pets().length }));
// (klockan kan ha tickat några spelsekunder före scenbytet – en nollställning hade däremot dragit den till dag 1)
ok(probe.clock >= clock0 - 0.001 && probe.clock - clock0 < 5 && probe.pets === 1 && !probe.restarted, `klockan i menystaden (dag 1) nollställde inte djuren (${probe.pets} djur, clockAbs ${probe.clock} ≈ ${clock0})`);
await ev(() => { window.SF.attract = false; });

console.log(`\n${passes} ok, ${fails} fel`);
console.log(errs.length ? 'KONSOLFEL:\n' + errs.join('\n') : 'Inga konsolfel.');
await browser.close();
process.exit(fails || errs.length ? 1 : 0);
