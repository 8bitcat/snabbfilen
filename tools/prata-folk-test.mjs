// PRATA MED FOLK I STADEN: klick på en fotgängare → hen stannar, vänder sig mot en och säger
// något (pratbubbla + personens egen röst). Nära = direkt, längre bort = hen väntar medan man går
// fram. Klick bredvid folk går som vanligt.
// Kör: node tools/prata-folk-test.mjs   (servern på 8788, eller SMOKE_PORT)
import { createRequire } from 'module';
const require = createRequire('D:/Qisy/QISYFrontend/QISYFrontend-1/package.json');
const { chromium } = require('playwright');
const PORT = process.env.SMOKE_PORT || process.env.PORT || 8788;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1100, height: 700 } });
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
page.on('console', (m) => m.type() === 'error' && !/peer|ERR_|Failed to load resource/i.test(m.text()) && errs.push(m.text()));
let fails = 0;
const ok = (c, m) => { console.log((c ? 'ok: ' : 'FEL: ') + m); if (!c) fails++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, ms = 10000, step = 150) { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await fn()) return true; await sleep(step); } return false; }

await page.goto(`http://localhost:${PORT}/index.html?world=pf${Date.now().toString(36)}`);
await page.evaluate(() => {
  localStorage.clear();
  localStorage.setItem('snabbfilen_avatar', JSON.stringify({ name: 'Pratglad', look: { skin: '#e0a97f', hair: '#3b2619', style: 'short', shirt: '#46a35a', pants: '#2d3a5c' }, color: '#46a35a' }));
  localStorage.setItem('snabbfilen_save1', JSON.stringify({ v: 1, day: 2, min: 12 * 60, money: 100, hunger: 90, energy: 90, home: 'rum', fridge: {}, jobs: {}, earned: 0 }));
});
await page.reload();
await page.waitForFunction(() => window.SF?.game, null, { timeout: 20000 });
await page.waitForTimeout(700);
await page.evaluate(() => document.querySelector('#modal:not(.hidden) .dlg-foot .btn')?.click());
await page.evaluate(() => window.SF.go('city'));
await page.waitForTimeout(1200);
// ett riktigt klick låser upp ljudet (rösterna hörs först efter första klicket)
const box = await page.locator('#scene').boundingBox();
await page.mouse.click(box.x + box.width / 2, box.y + box.height - 30);
await page.waitForTimeout(400);

const api = await page.evaluate(() => { const L = window.SF.scene._debug?.sim?.()?.life; return !!(L && L.personAt && L.talkTo && L.talks); });
ok(api, 'stadslivet har personAt, talkTo och talks');

// en vanlig fotgängare som går på trottoaren (inte i en dörr, inte joggare, inte på övergångsstället)
const pickPed = (maxD) => page.evaluate((maxD) => {
  const D = window.SF.scene._debug, L = D.sim().life, me = D.pos(), cam = D.cam();
  const list = L._debug.peds().filter((p) => !p.hidden && !p.gone && !p.door && !p.jogger && !p.leader && !p.sit && p.onCross < 0 && p.kind === 'folk'
    && p.x - cam.x > 40 && p.x - cam.x < 440 && p.y - cam.y > 60 && p.y - cam.y < 300);
  const withD = list.map((p) => ({ p, d: Math.hypot(p.x - me.x, p.y - me.y) })).filter((o) => o.d <= maxD).sort((a, b) => a.d - b.d);
  const o = withD[0];
  return o ? { id: o.p.id, x: o.p.x, y: o.p.y, d: o.d } : null;
}, maxD);

// 1) nära: flytta figuren bredvid en fotgängare och klicka på hen
let ped = null;
for (let i = 0; i < 40 && !ped; i++) { ped = await pickPed(2000); if (!ped) await sleep(250); }
ok(!!ped, `en fotgängare i bild (${ped ? Math.round(ped.d) + ' px bort' : 'ingen'})`);
if (ped) {
  const r = await page.evaluate((id) => {
    const D = window.SF.scene._debug, L = D.sim().life, p = L._debug.peds().find((q) => q.id === id);
    D.teleport(p.x - 22, p.y);
    const cam = D.cam(), me = D.pos();
    const sx = p.x + p.ox - cam.x, sy = p.y + p.oy - 16 - cam.y;
    const hit = L.personAt(p.x + p.ox, p.y + p.oy - 16);
    window.SF.scene.down(sx, sy);
    const t = L.talks().find((b) => b.id === id);
    return { hit: hit && hit.id, me, px: p.x, t, hold: p.hold, face: p.face, dist: Math.hypot(p.x - me.x, p.y - me.y) };
  }, ped.id);
  ok(r.hit === ped.id, 'personAt hittar personen under pekaren');
  ok(r.t && typeof r.t.text === 'string' && r.t.text.length > 2, `hen säger något: "${r.t?.text}" (${Math.round(r.dist)} px bort)`);
  ok(r.hold > 1, `hen stannar för att prata (väntar ${r.hold?.toFixed(1)} s)`);
  ok(r.face === (r.me.x < r.px ? 'left' : 'right'), `hen vänder sig mot mig (${r.face})`);
  await page.waitForTimeout(600);
  const still = await page.evaluate((id) => { const p = window.SF.scene._debug.sim().life._debug.peds().find((q) => q.id === id); return { moving: p.moving, talk: !!p.talk }; }, ped.id);
  ok(!still.moving && still.talk, 'hen står still med bubblan medan hen pratar');
  const voice = await page.evaluate(async () => { const V = await import('./js/core/voices.js'); const s = V.voicesStats(); return { babbel: s.byTag.babbel || 0, unlocked: s.unlocked }; });
  ok(!voice.unlocked || voice.babbel > 0, `repliken hörs med personens röst (babbel ${voice.babbel}, ljud ${voice.unlocked ? 'på' : 'låst'})`);
  await page.locator('#scene').screenshot({ path: 'tools/out/prata-folk.png' }).catch(() => {});
  ok(await until(() => page.evaluate((id) => !window.SF.scene._debug.sim().life._debug.peds().find((q) => q.id === id)?.talk, ped.id), 9000), 'bubblan försvinner efter en stund');
}

// 2) längre bort: hen väntar medan jag går fram, sedan pratar hen
let far = null;
for (let i = 0; i < 40 && !far; i++) {
  far = await page.evaluate(() => {
    const D = window.SF.scene._debug, L = D.sim().life, me = D.pos(), cam = D.cam();
    const p = L._debug.peds().find((q) => !q.hidden && !q.gone && !q.door && !q.jogger && !q.leader && !q.sit && q.onCross < 0 && q.kind === 'folk' && !q.talk
      && q.x - cam.x > 60 && q.x - cam.x < 420 && q.y - cam.y > 60 && q.y - cam.y < 300 && Math.hypot(q.x - me.x, q.y - me.y) > 90 && Math.hypot(q.x - me.x, q.y - me.y) < 200);
    if (!p) return null;
    const sx = p.x + p.ox - cam.x, sy = p.y + p.oy - 16 - cam.y;
    window.SF.scene.down(sx, sy);
    return { id: p.id, hold: p.hold, talk: !!p.talk, d: Math.hypot(p.x - me.x, p.y - me.y) };
  });
  if (!far) await sleep(250);
}
ok(!!far, `en fotgängare en bit bort (${far ? Math.round(far.d) + ' px' : 'ingen'})`);
if (far) {
  ok(far.hold > 1 && !far.talk, `hen väntar på mig (${far.hold.toFixed(1)} s) och pratar inte förrän jag är framme`);
  ok(await until(() => page.evaluate((id) => !!window.SF.scene._debug.sim().life._debug.peds().find((q) => q.id === id)?.talk, far.id), 9000), 'framme → hen säger något');
}

// 3) klick bredvid folk: vanlig gång, ingen replik
const plain = await page.evaluate(() => {
  const D = window.SF.scene._debug, L = D.sim().life, cam = D.cam();
  const n0 = L.talks().length;
  for (let y = 90; y < 300; y += 7) for (let x = 60; x < 420; x += 7) {
    if (!L.personAt(x + cam.x, y + cam.y) && !L.personAt(x + cam.x + 8, y + cam.y) && !L.personAt(x + cam.x - 8, y + cam.y)) {
      window.SF.scene.down(x, y);
      return { n0, n1: L.talks().length };
    }
  }
  return null;
});
ok(plain && plain.n1 <= plain.n0, 'klick bredvid folk ger ingen ny replik');

ok(!errs.length, errs.length ? 'konsolfel:\n' + errs.join('\n') : 'inga konsolfel');
await browser.close();
console.log(fails ? `${fails} FEL` : 'ALLA OK');
process.exit(fails ? 1 : 0);
