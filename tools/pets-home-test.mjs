// Husdjuren i det riktiga hemmet (js/scenes/room.js + js/pets/layer.js), Playwright mot
// servern på 8788:   node tools/pets-home-test.mjs        (annan port: SMOKE_PORT=8791)
//  1. adoptera en katt och en hund via petStore(), köp skål/säckar/kattlåda (som djuraffären
//     gör) → gå ut och hem igen: djuren och prylarna syns (lagrets drawables, i rummets
//     gångbara del), prylarna ställdes ut automatiskt
//  2. klick på katten → figuren går dit och djurmenyn öppnas (Klappa ger glädje)
//  3. säcken bärs till skålen (A.carrying + bär-bildrutor) och skålen fylls
//  4. kattlådan töms
//  5. en extra matskål ur förrådet ställs ut via 🐾 Djurprylar (köpt → hem → ställ ut → häll i)
//  6. hunden bajsar inne efter simulerad tid utan promenad – och det går att städa
//  7. Möblera: kattlådan flyttas som en möbel (och möbler kan inte ställas ovanpå den)
//  8. bildsekvens 10 × 80 ms: inget djur hoppar > 8 px eller byter riktning varje ruta
//  9. "Följ mig" + dörren till SOVRUM: katten följer med in i nästa rum
// 10. flytt till villan: djur och prylar följer med och hamnar i rummet
// Bilder: tools/out/pets-home-*.png. Inga konsolfel får förekomma.
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
await page.goto(`http://localhost:${PORT}/index.html?world=ph${Date.now().toString(36)}`);
await page.evaluate(() => {
  localStorage.clear();
  localStorage.setItem('snabbfilen_avatar', JSON.stringify({ name: 'Djurvän', look: { skin: '#e0a97f', hair: '#3b2619', style: 'long', shirt: '#3a7bd5', pants: '#2d3a5c' }, color: '#ffd23f' }));
  localStorage.setItem('snabbfilen_save1', JSON.stringify({ v: 1, day: 9, min: 11 * 60, money: 20000, hunger: 90, energy: 90, home: 'lagenhet', fridge: {}, jobs: {}, earned: 0, wardrobe: [], storage: [], deco: {}, won: false }));
});
await page.reload();
await page.waitForFunction(() => !!window.SF?.game && window.SF.sceneName === 'room', null, { timeout: 20000 });
await page.waitForTimeout(600);

const ev = (fn, arg) => page.evaluate(fn, arg);
const wait = (ms) => page.waitForTimeout(ms);
const L = () => ev(() => !!window.SF.scene?._debug?.layer?.());
const modalOpen = () => ev(() => !document.getElementById('modal').classList.contains('hidden'));
const closeModal = () => ev(() => { if (!document.getElementById('modal').classList.contains('hidden')) (document.querySelector('#modal [data-close]') || [...document.querySelectorAll('#modal .dlg-foot .btn')].pop())?.click(); });
// klicka som en spelare: på canvasens logiska pixlar (384×216)
async function clickAt(x, y) {
  const b = await page.locator('#scene').boundingBox();
  await page.mouse.click(b.x + (x + 0.5) * b.width / 384, b.y + (y + 0.5) * b.height / 216);
}
const spot = (id) => ev((id) => window.SF.scene._debug.layer()._debug.spot(id), id);
const until = async (fn, arg, ms = 8000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await ev(fn, arg)) return true; await wait(120); } return false; };
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
// klicka på en pryl/ett djur; står ett annat djur i vägen öppnas dess meny – stäng och försök igen
async function clickThing(id, check, tries = 5) {
  for (let k = 0; k < tries; k++) {
    await closeModal();
    const s = await spot(id);
    if (!s) return false;
    await clickAt(s.x, s.y);
    if (await until(check, id, 6000)) return true;
  }
  await closeModal();
  return false;
}

// ---------- 1. adoptera + köp → hem ----------
console.log('\n1. djur och prylar hemma');
const ids = await ev(async () => {
  const { petStore } = await import('/js/pets/sim.js');
  const s = petStore(), g = window.SF.game;
  s.reset();
  // som djuraffären: adopt(art, ras, kön, namn, hem, { day }) och buyItem(k, n) – vuxna djur (födda för 9 dagar sedan)
  const katt = s.adopt('katt', '', 'hona', 'Misse', g.home, { day: g.day - 9 });
  const hund = s.adopt('hund', '', 'hane', 'Bamse', g.home, { day: g.day - 9 });
  for (const k of ['matskal', 'sack-katt', 'sack-hund', 'kattlada']) s.buyItem(k, 1);
  window.__pets = s;
  window.SF.go('city'); window.SF.go('room'); // hem från staden
  return { katt: katt.id, hund: hund.id };
});
await wait(1500);
ok(await L(), 'husdjurslagret finns i det egna hemmet');
const seen = await ev((ids) => {
  const L = window.SF.scene._debug.layer(), d = L.drawables();
  const pets = L._debug.pets(), items = L._debug.items();
  const inRoom = (x, y) => x > 6 && x < window.SF.scene._debug.partition - 4 && y > 86 && y < 214;
  return {
    pets: pets.map((p) => ({ ...p, drawn: d.some((q) => Math.abs(q.x - p.x) < 1 && Math.abs(q.fy - p.y) < 3), inRoom: inRoom(p.x, p.y) })),
    items: items.map((i) => ({ k: i.k, x: i.x, y: i.y, drawn: d.some((q) => q.x === i.x), inRoom: inRoom(i.x, i.y) })),
    inv: { ...window.__pets.inventory },
  };
}, ids);
ok(seen.pets.length === 2 && seen.pets.every((p) => p.drawn && p.inRoom), `båda djuren ritas i rummet (${seen.pets.map((p) => `${p.name} ${Math.round(p.x)},${Math.round(p.y)}`).join(' · ')})`);
const want = ['matskal', 'sack-katt', 'sack-hund', 'kattlada'];
ok(want.every((k) => seen.items.some((i) => i.k === k && i.drawn && i.inRoom)), `prylarna ställdes ut automatiskt: ${seen.items.map((i) => i.k).join(', ')}`);
ok((seen.inv.matskal | 0) === 1, `den andra matskålen (första djuret gav en gratis) ligger kvar i förrådet (${JSON.stringify(seen.inv)})`);
await canvasPng('pets-home-1-hemma');

// ---------- 2. djurmenyn ----------
console.log('\n2. klick på katten');
const menuOk = await clickThing(ids.katt, (id) => !document.getElementById('modal').classList.contains('hidden') && document.querySelector('#modal')?.textContent.includes('Misse'));
ok(menuOk, 'klick på katten → figuren går dit och Misses meny öppnas');
const btns = await ev(() => [...document.querySelectorAll('#modal .dlg-foot .btn')].map((b) => b.textContent.trim()));
ok(['Klappa', 'Leka', 'Följ mig', 'Byt namn'].every((w) => btns.some((b) => b.includes(w))), 'knappar: ' + btns.join(' · '));
await page.screenshot({ path: OUT + 'pets-home-2-meny.png' });
console.log('   → tools/out/pets-home-2-meny.png');
const happy0 = await ev((id) => window.__pets.petById(id).happy, ids.katt);
await ev(() => [...document.querySelectorAll('#modal .dlg-foot .btn')].find((b) => b.textContent.includes('Klappa'))?.click());
ok((await ev((id) => window.__pets.petById(id).happy, ids.katt)) > happy0, 'Klappa ger glädje');
await closeModal();

// ---------- 3. säcken till skålen ----------
console.log('\n3. mata: säcken till skålen');
const bowlId = await ev(() => window.SF.scene._debug.layer()._debug.items().find((i) => i.k === 'matskal').id);
const sackId = await ev(() => window.SF.scene._debug.layer()._debug.items().find((i) => i.k === 'sack-katt').id);
const left0 = await ev((id) => window.__pets.itemById(id).left, sackId);
ok(await clickThing(sackId, (id) => window.SF.carrying?.itemId === id), 'klick på kattmatssäcken → figuren bär den (A.carrying)');
await ev((b) => { const s = window.SF.scene._debug; const it = s.layer()._debug.items().find((i) => i.id === b); s.layer().hover(it.x, it.y); }, bowlId);
await wait(200);
await canvasPng('pets-home-3-bar-sacken');
ok(await clickThing(bowlId, (id) => window.__pets.itemById(id).food > 0.9 && !window.SF.carrying), 'klick på skålen → figuren går dit och häller upp, säcken ställs tillbaka');
const bowl = await ev((id) => { const b = window.__pets.itemById(id); return { food: b.food, kind: b.foodKind }; }, bowlId);
ok(bowl.food > 0.9 && bowl.kind === 'katt', `skålen har kattmat (${bowl.food.toFixed(2)})`);
ok((await ev((id) => window.__pets.itemById(id)?.left, sackId)) === left0 - 1, 'säcken tappade en portion');

// ---------- 4. kattlådan ----------
console.log('\n4. töm kattlådan');
const boxId = await ev(() => { const it = window.SF.scene._debug.layer()._debug.items().find((i) => i.k === 'kattlada'); window.__pets.itemById(it.id).dirt = 1; return it.id; });
ok(await clickThing(boxId, (id) => window.__pets.itemById(id).dirt === 0), 'klick på den fulla kattlådan → tömd');

// ---------- 5. köpt skål ur förrådet → ställ ut → häll i ----------
console.log('\n5. ställ ut den köpta skålen (🐾 Djurprylar)');
await ev(() => window.SF.scene.toggleDecor(true));
await wait(200);
ok(await ev(() => { const b = document.querySelector('#decor-pets'); return !!b && !b.classList.contains('hidden'); }), 'knappen 🐾 Djurprylar syns i förrådspanelen');
await ev(() => document.querySelector('#decor-pets').click());
await wait(200);
ok(await ev(() => !!document.querySelector('#modal [data-place="matskal"]')), 'Djurprylar-dialogen visar matskålen i förrådet');
await page.screenshot({ path: OUT + 'pets-home-5-djurprylar.png' });
console.log('   → tools/out/pets-home-5-djurprylar.png');
await ev(() => document.querySelector('#modal [data-place="matskal"]').click());
const nBowls0 = await ev(() => window.__pets.items.filter((i) => i.k === 'matskal').length);
await ev(() => window.SF.scene.move(250, 200));
await clickAt(250, 200);
await wait(200);
const nBowls1 = await ev(() => window.__pets.items.filter((i) => i.k === 'matskal').length);
ok(nBowls1 === nBowls0 + 1 && !(await ev(() => window.__pets.inventory.matskal > 0)), `skålen ställdes ut där man klickade (${nBowls0} → ${nBowls1})`);
await ev(() => window.SF.scene.toggleDecor(false));
const bowl2 = await ev(() => window.__pets.items.filter((i) => i.k === 'matskal').at(-1).id);
const sackH = await ev(() => window.__pets.items.find((i) => i.k === 'sack-hund').id);
ok(await clickThing(sackH, (id) => window.SF.carrying?.itemId === id), 'hundmatssäcken bärs');
ok(await clickThing(bowl2, (id) => window.__pets.itemById(id).food > 0.9), 'den nya skålen fylls med hundmat');

// ---------- 6. hunden bajsar inne ----------
console.log('\n6. hunden utan promenad');
await ev((id) => { const s = window.__pets; s.messes.length = 0; const b = s.petById(id); b.out = false; b.toilet = 99.4; window.SF.game.min += 20; }, ids.hund);
ok(await until(() => window.__pets.messes.some((m) => m.by === 'hund'), null, 15000), 'hunden gjorde på golvet inne efter 20 speldminuter utan promenad');
const mess = await ev(() => { const m = window.__pets.messes.find((q) => q.by === 'hund'); return { id: m.id, x: m.x, y: m.y, room: m.room, kind: m.kind }; });
ok(mess.room === 0, `olyckan ligger i vardagsrummet (${mess.kind} vid ${mess.x},${mess.y})`);
await canvasPng('pets-home-6-olycka');
ok(await clickThing(mess.id, (id) => !window.__pets.messes.some((m) => m.id === id)), 'klick på olyckan → städad');

// ---------- 7. Möblera: flytta kattlådan som en möbel ----------
console.log('\n7. Möblera');
await ev(() => window.SF.scene.toggleDecor(true));
await wait(150);
const box0 = await ev((id) => { const b = window.__pets.itemById(id); return { x: b.x, y: b.y }; }, boxId);
const bs = await spot(boxId);
await clickAt(bs.x, bs.y);
ok(await ev(() => window.SF.scene._debug.layer().placing), 'klick på kattlådan i Möblera-läget lyfter den (spöke)');
await ev(() => window.SF.scene.move(230, 150));
await wait(100);
await canvasPng('pets-home-7-moblera-lada');
await clickAt(230, 150);
await wait(150);
const box1 = await ev((id) => { const b = window.__pets.itemById(id); return { x: b.x, y: b.y }; }, boxId);
ok((box1.x !== box0.x || box1.y !== box0.y) && Math.abs(box1.x - 230) <= 1 && Math.abs(box1.y - 150) <= 1, `kattlådan flyttad ${box0.x},${box0.y} → ${box1.x},${box1.y}`);
// en möbel får inte ställas ovanpå den
const blocked = await ev((b) => { const d = window.SF.scene._debug; const i = window.SF.game.deco['lagenhet:0'].findIndex((q) => q.k === 'vaxt'); if (i < 0) return null; d.pick(i); const r = d.canPlace(b.x, b.y); d.drop(-99, -99); return r; }, box1);
ok(blocked === false, 'monsteran kan inte ställas ovanpå kattlådan');
await ev(() => window.SF.scene.toggleDecor(false));

// ---------- 8. bildsekvens: mjuka rörelser ----------
console.log('\n8. bildsekvens 10 × 80 ms');
await ev((ids) => { const d = window.SF.scene._debug.layer()._debug; d.goTo(ids.hund, 280, 195, true); d.goTo(ids.katt, 60, 190, false); }, ids);
await wait(250);
const frames = [];
for (let i = 0; i < 10; i++) {
  frames.push(await ev(() => {
    const c = document.querySelector('#scene');
    const o = document.createElement('canvas'); o.width = 384; o.height = 216;
    const x = o.getContext('2d'); x.imageSmoothingEnabled = false; x.drawImage(c, 0, 0, 384, 216);
    return { png: o.toDataURL('image/png'), pets: window.SF.scene._debug.layer()._debug.pets().map((p) => ({ id: p.id, x: p.x, y: p.y, dir: p.dir, anim: p.anim })) };
  }));
  await wait(80);
}
let maxJump = 0, flips = {};
for (let i = 1; i < frames.length; i++) for (const p of frames[i].pets) {
  const q = frames[i - 1].pets.find((z) => z.id === p.id);
  if (!q) continue;
  maxJump = Math.max(maxJump, Math.hypot(p.x - q.x, p.y - q.y));
  if (p.dir !== q.dir) flips[p.id] = (flips[p.id] || 0) + 1;
}
ok(maxJump <= 8, `största förflyttning mellan två rutor ${maxJump.toFixed(1)} px (≤ 8)`);
ok(Object.values(flips).every((n) => n < 5), `riktningsbyten per djur på 10 rutor: ${JSON.stringify(flips)} (inga fladder)`);
console.log('   ' + frames.map((f) => f.pets.map((p) => `${p.anim}/${p.dir}`).join('+')).join(' '));
// 5×2-rutnät i skala 1 (1920×432)
await ev((pngs) => new Promise((res) => {
  const o = document.createElement('canvas'); o.width = 384 * 5; o.height = 216 * 2;
  const x = o.getContext('2d'); let n = 0;
  pngs.forEach((u, i) => { const im = new Image(); im.onload = () => { x.drawImage(im, (i % 5) * 384, Math.floor(i / 5) * 216); if (++n === pngs.length) { window.__strip = o.toDataURL('image/png'); res(); } }; im.src = u; });
}), frames.map((f) => f.png));
fs.writeFileSync(OUT + 'pets-home-8-sekvens.png', Buffer.from((await ev(() => window.__strip)).split(',')[1], 'base64'));
console.log('   → tools/out/pets-home-8-sekvens.png');

// ---------- 9. Följ mig genom dörren ----------
console.log('\n9. katten följer med till sovrummet');
await ev((id) => { window.__pets.setFollowing(id, true); }, ids.katt);
const door = await ev(() => window.SF.scene._debug.spot('sub1'));
await clickAt(door.x, door.y);
ok(await until(() => window.SF.roomSub === 1 && !!window.SF.scene._debug.layer?.(), null, 10000), 'figuren gick genom dörren till SOVRUM');
await wait(800);
const inBed = await ev((id) => window.SF.scene._debug.layer()._debug.pets().map((p) => p.id), ids.katt);
ok(inBed.includes(ids.katt) && !inBed.includes(ids.hund), `katten (Följ mig) följde med, hunden stannade (${inBed.join(', ')})`);
ok(await ev((id) => !window.__pets.petById(id).out, ids.hund), 'hunden har inget koppel på (dörren i bakväggen räknas inte som hemkomst/utgång)');
await canvasPng('pets-home-9-sovrum');
await ev((id) => window.__pets.setFollowing(id, false), ids.katt);

// ---------- 10. flytt ----------
console.log('\n10. flytt till villan');
await ev(() => { const g = window.SF.game; g.moveTo('villa'); g.save(); window.SF.roomSub = 0; window.SF.go('city'); window.SF.go('room'); });
await wait(1500);
const moved = await ev(() => {
  const s = window.__pets, d = window.SF.scene._debug, L = d.layer();
  return { home: window.SF.game.home, petsHome: s.pets.map((p) => p.home), items: s.items.map((i) => ({ k: i.k, home: i.home, room: i.room, x: i.x, y: i.y })), shown: L._debug.items().length, actors: L._debug.pets().length, partition: d.partition };
});
ok(moved.petsHome.every((h) => h === 'villa') && moved.items.every((i) => i.home === 'villa'), 'djur och prylar flyttade med till villan');
ok(moved.items.every((i) => i.room === 0) && moved.shown === moved.items.length, `alla ${moved.items.length} prylar hamnade i vardagsrummet och syns`);
ok(moved.actors === 2, 'båda djuren är i vardagsrummet');
await canvasPng('pets-home-10-villan');

console.log(`\n${passes} ok, ${fails} fel`);
console.log(errs.length ? 'KONSOLFEL:\n' + errs.join('\n') : 'Inga konsolfel.');
await browser.close();
process.exit(fails || errs.length ? 1 : 0);
