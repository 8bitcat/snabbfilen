// Staden på längden (v3, Carl 2026-09-29): centrum → DOWNTOWN → FLODEN med STORA BRON och
// JÄRNBRON → FÖRORTEN. Playwright mot servern, med riktiga klick där det går:
//   node tools/bro-test.mjs        (servern på 8788; annan port: SMOKE_PORT=8791 eller PORT=…)
//  1. kartan: validateMap() utan problem, världen ≤ 4000 bred, förorten öster om floden
//  2. floden går inte att gå i: vattnet är hinder överallt (stickprov), en figur som hamnar
//     i vattnet flyttas upp på land/bro, och ett gångmål mitt i floden slutar aldrig i vattnet
//  3. bron går att gå över: downtown → förorten över STORA BRON och tillbaka över JÄRNBRON;
//     figuren står aldrig i vattnet under promenaden
//  4. bussen når förorten: kliv på vid FINANSTORGET (klick på bussdörren), bussen kör ut på
//     bron, kliv av vid BETONGTORGET i FÖRORTEN – och sedan tillbaka till FINANSTORGET
//  5. downtowns fem butiker (bank, elektronik, frisör, skor, accessoarer): huset finns i
//     DOWNTOWN med skylt och egen konst, dörren visar soon-texten (eller – när butiken fått
//     en egen scen – leder in i den)
//  6. förortens hem hittas via husens homes: gå hem till husvagnen och till höghuset, in i
//     rummet och ut igen vid rätt dörr (även utan sparad stadsposition)
//  7. kostymklädda fotgängare i downtown
//  8. övriga dörrar till egna scener: Pixelhögskolan (PIXEL TOWER), bion, kebaben, pantbanken – och
//     de utbildade jobben (FINANSHUSET, GLASTORNET/Pixel Data) som kräver examen
//  9. kameran på STORA BRON lyfts så att tornen och kablarna syns – även från södra trottoaren
// 10. ytorna bakom downtowns höga torn går inte att gå in i (där skulle figuren inte synas)
// Utskrift: "ok: …" / "FEL: …", exit 1 vid fel eller konsolfel. Bilder: tools/out/bro-test/.
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const require = createRequire('D:/Qisy/QISYFrontend/QISYFrontend-1/package.json');
const { chromium } = require('playwright');

const PORT = process.env.SMOKE_PORT || process.env.PORT || '8788';
const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), 'out', 'bro-test') + path.sep;
fs.mkdirSync(OUT, { recursive: true });
let fails = 0, passes = 0;
const ok = (c, m) => { console.log((c ? 'ok: ' : 'FEL: ') + m); if (c) passes++; else fails++; };
const errs = [];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 760 } });
page.on('pageerror', (e) => errs.push(e.message));
page.on('console', (m) => m.type() === 'error' && !/peer|webrtc|ice|Could not connect/i.test(m.text()) && errs.push(m.text()));
const SAVE = { v: 1, day: 3, min: 10 * 60, money: 1000, hunger: 90, energy: 90, home: 'husvagn', fridge: {}, jobs: {}, earned: 0, wardrobe: [], storage: [], deco: {}, won: false };
await page.goto(`http://localhost:${PORT}/index.html?nomenu&world=bro${Date.now().toString(36)}`);
await page.evaluate((s) => {
  localStorage.clear();
  localStorage.setItem('snabbfilen_avatar', JSON.stringify({ name: 'Brotest', look: { skin: '#e0a97f', hair: '#3b2619', style: 'long', shirt: '#3a7bd5', pants: '#2d3a5c' }, color: '#ffd23f' }));
  localStorage.setItem('snabbfilen_tips_hus', '1');
  localStorage.setItem('snabbfilen_save1', JSON.stringify(s));
}, SAVE);
await page.reload();
await page.waitForFunction(() => !!window.SF?.game, null, { timeout: 20000 });
await page.waitForTimeout(600);

const ev = (fn, arg) => page.evaluate(fn, arg);
const wait = (ms) => page.waitForTimeout(ms);
const until = async (fn, arg, ms = 15000, step = 150) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await ev(fn, arg)) return true; await wait(step); } return false; };
const closeModals = async () => { for (let i = 0; i < 4; i++) { const open = await ev(() => !document.getElementById('modal').classList.contains('hidden')); if (!open) return; await ev(() => (document.querySelector('#modal [data-close]') || [...document.querySelectorAll('#modal .dlg-foot .btn')].pop())?.click()); await wait(250); } };
const dlgTitle = () => page.locator('.dlg-head h2').textContent({ timeout: 300 }).catch(() => '');
const snap = async (name, scale = 2) => {
  const url = await ev((s) => {
    const c = document.querySelector('#scene');
    const o = document.createElement('canvas'); o.width = c.width * s / (window.SF.pxs || 1); o.height = c.height * s / (window.SF.pxs || 1);
    const x = o.getContext('2d'); x.imageSmoothingEnabled = false;
    x.drawImage(c, 0, 0, o.width, o.height);
    return o.toDataURL('image/png');
  }, scale);
  fs.writeFileSync(OUT + name + '.png', Buffer.from(url.split(',')[1], 'base64'));
};
// håll klockan still (dagtid) medan testet går – annars stänger butiker och kvällen kommer
await ev(() => { window.__broMin = 10 * 60; const keep = () => { if (window.__broMin != null && window.SF?.game) window.SF.game.min = window.__broMin; requestAnimationFrame(keep); }; keep(); });
await ev(() => { window.SF.cityPos = null; window.SF.go('city'); });
await until(() => window.SF.sceneName === 'city' && !!window.SF.scene?._debug, null, 20000);
await wait(900);
const pos = () => ev(() => window.SF.scene._debug.pos());

// ------------------------------------------------------------------ 1. kartan
console.log('\n1. kartan');
const map = await ev(async () => {
  const M = await import('/js/city/map.js');
  return { problems: M.validateMap(), W: M.CITY.W, river: M.CITY.RIVER, xSub: M.CITY.X_SUB, xDt: M.CITY.X_DT, water: M.RIVER.water, wx0: M.RIVER.wx0, wx1: M.RIVER.wx1,
    bridges: M.BRIDGES.map((b) => ({ id: b.id, walk: b.walk })),
    sub: M.BUILDINGS_X.concat(M.FREESTANDING.filter((f) => f.district === 'FÖRORTEN')).map((b) => ({ id: b.id, x: b.x })) };
});
ok(map.problems.length === 0, `validateMap: ${map.problems.length ? map.problems.slice(0, 4).join('; ') : 'inga problem'}`);
ok(map.W <= 4000 && map.W >= map.river[1] + 900, `världen är ${map.W} bred (floden ${map.river.join('–')}, förorten från ${map.xSub})`);
ok(map.sub.every((b) => b.x >= map.river[1]), `alla förortens hus står öster om floden (${map.sub.length} st)`);
const inWater = (p) => map.water.some((r) => p.x >= r[0] && p.x < r[2] && p.y >= r[1] && p.y < r[3]);

// ------------------------------------------------------------------ 2. floden går inte att gå i
console.log('\n2. floden');
const wet = await ev(() => {
  const D = window.SF.scene._debug, obs = D.env.obstacles;
  return import('/js/city/map.js').then((M) => {
    const inR = (x, y, r) => x >= r[0] && x < r[2] && y >= r[1] && y < r[3];
    let n = 0, dry = 0;
    for (const r of M.RIVER.water) for (let y = r[1] + 1; y < r[3]; y += 9) for (let x = r[0] + 1; x < r[2]; x += 9) { n++; if (!obs.some((o) => inR(x, y, o))) dry++; }
    return { n, dry };
  });
});
ok(wet.n > 1000 && wet.dry === 0, `vattnet är hinder överallt (${wet.n} stickprov, ${wet.dry} gåbara)`);
for (const [x, y] of [[2716, 90], [2716, 470], [2716, 800], [2430, 560]]) {
  await ev(([x, y]) => window.SF.scene._debug.teleport(x, y), [x, y]);
  const p = await pos();
  ok(!inWater(p), `figuren som ställs i vattnet (${x},${y}) hamnar på land/bro (${Math.round(p.x)},${Math.round(p.y)})`);
}
await ev(() => window.SF.scene._debug.teleport(2370, 476));   // bakgatan i downtown, vid kajen
await ev(() => window.SF.scene._debug.walkTo(2716, 470));      // mitt i floden mellan broarna
await until(() => window.SF.scene._debug.arrived(), null, 15000);
{ const p = await pos(); ok(!inWater(p), `gångmål mitt i floden slutar på land (${Math.round(p.x)},${Math.round(p.y)})`); }

// ------------------------------------------------------------------ 3. över broarna till fots
console.log('\n3. över broarna');
async function walkAcross(from, to, label, deck, file) {
  await ev(([x, y]) => window.SF.scene._debug.teleport(x, y), from);
  const start = await pos();
  await ev(([x, y]) => window.SF.scene._debug.walkTo(x, y), to);
  const samples = [];
  const t0 = Date.now();
  let shot = false;
  while (Date.now() - t0 < 30000) {
    await wait(120);
    const p = await pos();
    samples.push(p);
    if (!shot && p.x > map.wx0 + 150 && p.x < map.wx1 - 150) { shot = true; await snap(file); }
    if (await ev(() => window.SF.scene._debug.arrived())) break;
  }
  const end = await pos();
  const wetSteps = samples.filter(inWater).length;
  const onDeck = samples.filter((p) => p.x > map.wx0 + 20 && p.x < map.wx1 - 20 && p.y >= deck[1] && p.y < deck[3]).length;
  ok(Math.abs(end.x - to[0]) < 12 && Math.abs(end.y - to[1]) < 12, `${label}: gick från (${Math.round(start.x)},${Math.round(start.y)}) till (${Math.round(end.x)},${Math.round(end.y)})`);
  ok(onDeck >= 5, `${label}: vägen gick över däcket (${onDeck} steg på bron)`);
  ok(wetSteps === 0, `${label}: aldrig i vattnet (${samples.length} steg)`);
}
const deckN = map.bridges.find((b) => b.id === 'storabron').walk, deckS = map.bridges.find((b) => b.id === 'jarnbron').walk;
await walkAcross([2366, 204], [3090, 204], 'STORA BRON (norra trottoaren)', deckN, 'ga-stora-bron');
{ const d = await ev(() => window.SF.scene._debug.districtNow()); ok(d === 'FÖRORTEN', `framme i ${d}`); }
await walkAcross([3090, 746], [2366, 746], 'JÄRNBRON (bortre trottoaren) tillbaka', deckS, 'ga-jarnbron');
{ const d = await ev(() => window.SF.scene._debug.districtNow()); ok(d === 'DOWNTOWN', `tillbaka i ${d}`); }

// ------------------------------------------------------------------ 4. bussen
console.log('\n4. bussen');
async function busTrip(fromId, toId, wantDistrict) {
  const st = await ev(async (id) => { const M = await import('/js/city/map.js'); const s = M.busStopById(id); return { wait: s.wait, name: s.name }; }, fromId);
  await ev(([x, y]) => window.SF.scene._debug.teleport(x, y), [st.wait.x, st.wait.y]);
  const came = await until((id) => !!window.SF.scene._debug.sim().traffic.busAt?.(id), fromId, 40000, 250);
  ok(came, `en buss kom till ${st.name} när man väntade`);
  if (!came) return null;
  const money0 = await ev(() => window.SF.game.money);
  await ev((id) => {
    const d = window.SF.scene._debug, tr = d.sim().traffic, bi = tr.busAt(id);
    tr.hold(id, 30);
    const c = d.cam();
    window.SF.scene.down((bi.x0 + bi.x1) / 2 - c.x, bi.y - 20 - c.y);   // klick på bussen = gå till framdörren
  }, fromId);
  let dlg = false;
  for (let i = 0; i < 60 && !dlg; i++) { await wait(250); dlg = (await dlgTitle())?.includes('Linje 4'); }
  ok(dlg, `klick på bussen vid ${st.name} öppnar Linje 4-dialogen`);
  if (!dlg) { await closeModals(); return null; }
  await page.click(`[data-bus="${toId}"]`);
  const track = [];
  let riding = false, t0 = Date.now();
  while (Date.now() - t0 < 60000) {
    await wait(200);
    const r = await ev(() => {
      const d = window.SF.scene._debug, r = d.ride();
      if (!r) return null;
      const v = d.sim().traffic.vehicles?.().find((q) => q.rider);   // bussen man sitter i: fronten = x1 österut, x0 västerut
      return { ...r, front: v ? (v.dir > 0 ? v.x1 : v.x0) : null };
    });
    if (r) { riding = true; track.push({ x: r.pos.x, y: r.pos.y, front: r.front, phase: r.phase, fade: r.fade }); if (track.length === 12) await snap(`buss-${fromId}`); if (r.pos.x > 2690 && r.pos.x < 2760 && !track.shot) { track.shot = true; await snap(`buss-${fromId}-pa-bron`); } }
    else if (riding) break;
  }
  const end = await pos(), money1 = await ev(() => window.SF.game.money), d = await ev(() => window.SF.scene._debug.districtNow());
  ok(riding && money1 === money0 - 10, `ombord ${st.name} → ${toId} (10 kr, ${track.length} lägen under resan)`);
  ok(d === wantDistrict, `klev av i ${d} vid (${Math.round(end.x)},${Math.round(end.y)})`);
  return { track, end };
}
const ut = await busTrip('finanstorget', 'betongtorget', 'FÖRORTEN');
if (ut) {
  // resan är lång (> JUMP_MIN) – man ser bussen köra iväg ut på bron innan skärmen tonar
  const pre = ut.track.filter((p) => p.front != null && p.fade < 0.5 && (p.phase === 'åker' || p.phase === 'ombord') && !ut.track.slice(0, ut.track.indexOf(p)).some((q) => q.phase === 'tonar'));
  const maxFront = Math.max(0, ...pre.map((p) => p.front));
  ok(maxFront > map.wx0, `bussen körde ut på STORA BRON innan toningen (fronten nådde x ${Math.round(maxFront)}, vattnet börjar ${map.wx0})`);
  // …och ut mitt på bron: toningen börjar först när bussen står mellan tornen (båda tornen och kablarna i bild)
  const midSpan = await ev(async () => { const M = await import('/js/city/map.js'); const t = M.BRIDGES[0].towers; return (t[0].x0 + t[0].x1 + t[1].x0 + t[1].x1) / 4; });
  const maxPos = Math.max(0, ...pre.map((p) => p.x));
  ok(maxPos > midSpan - 10, `man ser bron från bussen – bussen kom ut mitt på bron mellan tornen innan toningen (x ${Math.round(maxPos)}, mitten ${midSpan})`);
  ok(ut.track.length * 0.2 < 22, `resan blir inte för lång – spelklockan går medan man åker (${(ut.track.length * 0.2).toFixed(1)} s, högst 22)`);
  await snap('buss-framme-fororten');
}
const hem = await busTrip('betongtorget', 'finanstorget', 'DOWNTOWN');
if (hem) await snap('buss-tillbaka-downtown');
await closeModals();

// ------------------------------------------------------------------ 5. downtowns fem butiker
console.log('\n5. downtowns butiker');
const SHOPS = ['bank', 'elektronik', 'frisor', 'skor', 'accessoarer'];
const art = await ev(async (ids) => {
  const M = await import('/js/city/map.js');
  const A = (await import('/js/city/buildings-downtown.js')).BUILDING_ART || {};
  return ids.map((id) => {
    const b = M.buildingById(id);
    if (!b) return { id, missing: true };
    let painted = false, lit = 0, err = null;
    try {
      const c = A[b.kind]?.paint?.(b, false, { worn: 0, snow: 0 });
      if (c) {
        const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
        for (let i = 3; i < d.length; i += 4) if (d[i] > 0) lit++;
        painted = c.width === b.w + 16 && lit > b.w * b.h * 0.5;
      }
    } catch (e) { err = String(e); }
    return { id, district: b.district, sign: b.sign, enter: b.enter, soon: b.soon, open: b.open, door: M.doorCenter(b), live: typeof A[b.kind]?.live === 'function', painted, err };
  });
}, SHOPS);
for (const s of art) {
  if (s.missing) { ok(false, `${s.id}: huset finns inte`); continue; }
  ok(s.district === 'DOWNTOWN' && s.door.x >= map.xDt && s.door.x < map.river[0], `${s.id}: ${s.sign} står i DOWNTOWN (dörren x ${s.door.x})`);
  ok(!!String(s.sign || '').trim() && s.painted && s.live && !s.err, `${s.id}: skylt "${s.sign}" och egen konst${s.err ? ' – ' + s.err : ''}`);
  if (!s.enter) {
    ok(/^Öppnar snart/.test(s.soon || ''), `${s.id}: soon-text "${s.soon}"`);
    await ev(([x, y]) => window.SF.scene._debug.teleport(x, y + 14), [s.door.x, s.door.y]);
    await ev(() => { document.querySelectorAll('#toasts .toast').forEach((e) => e.remove()); });
    await ev((id) => window.SF.scene._debug.enter(id), s.id);
    const shown = await until((txt) => [...document.querySelectorAll('#toasts .toast')].some((e) => e.textContent.includes(txt)), s.soon, 12000);
    ok(shown && (await ev(() => window.SF.sceneName)) === 'city', `${s.id}: dörren visar soon-texten`);
    if (s.id === 'elektronik' || s.id === 'frisor') await snap(`dorr-${s.id}`);
  } else if (!(await ev((n) => (typeof window.SF.hasScene === 'function' ? window.SF.hasScene(n) : true), s.enter))) {
    // dörren är kopplad men butikens scen är inte släppt än (main.js DOOR_SCENES) – då visar dörren soon-texten
    await ev(([x, y]) => window.SF.scene._debug.teleport(x, y + 14), [s.door.x, s.door.y]);
    await ev(() => { document.querySelectorAll('#toasts .toast').forEach((e) => e.remove()); });
    await ev((id) => window.SF.scene._debug.enter(id), s.id);
    const shown = await until(() => document.querySelectorAll('#toasts .toast').length > 0, null, 12000);
    ok(shown && (await ev(() => window.SF.sceneName)) === 'city', `${s.id}: scenen är inte släppt än – dörren visar soon-texten`);
  } else {
    // butiken har fått en egen scen (enter satt i map.js + gren i city.js enter()) – då ska dörren leda in
    await ev(([x, y]) => window.SF.scene._debug.teleport(x, y + 14), [s.door.x, s.door.y]);
    await ev((id) => window.SF.scene._debug.enter(id), s.id);
    const inside = await until(() => window.SF.sceneName !== 'city', null, 12000);
    const sc = await ev(() => window.SF.sceneName);
    await closeModals();
    ok(inside, `${s.id}: dörren leder in i butiken (${s.enter} → scen ${sc})`);
    await ev(() => { window.SF.go('city'); });
    await until(() => window.SF.sceneName === 'city', null, 8000);
    await wait(300);
  }
}
await closeModals();

// ------------------------------------------------------------------ 6. förortens hem
console.log('\n6. förortens hem');
const homes = await ev(async () => {
  const M = await import('/js/city/map.js'), P = await import('/js/city/places.js');
  return ['husvagn', 'hoghus', 'rum'].map((h) => {
    const b = M.ALL_BUILDINGS.find((x) => (x.homes || []).includes(h));
    return { h, id: b?.id, byPlaces: P.homeBuildingId(h), door: b ? M.doorCenter(b) : null, district: b?.district };
  });
});
for (const h of homes) ok(h.id && h.id === h.byPlaces && h.district === 'FÖRORTEN' && h.door.x > map.river[1], `hemmet ${h.h} ligger i ${h.id} öster om floden (dörren x ${h.door?.x}) – samma som places.js`);
async function goHome(homeId, fromXY) {
  const h = homes.find((x) => x.h === homeId);
  await ev((id) => { const g = window.SF.game; g.home = id; g.save(); }, homeId);
  await ev(([x, y]) => window.SF.scene._debug.teleport(x, y), fromXY);
  await ev((id) => window.SF.scene._debug.enter(id), h.id);
  const inRoom = await until(() => window.SF.sceneName === 'room', null, 30000, 200);
  ok(inRoom, `gick från (${fromXY.join(',')}) hem till ${homeId} (${h.id}) och in i rummet`);
  if (!inRoom) return;
  await wait(400);
  await snap(`hemma-${homeId}`);
  // ut genom ytterdörren (som rummets dörr gör): staden ställer en vid det egna husets dörr
  await ev(() => { window.SF.roomSub = 0; window.SF.leftHome = true; window.SF.go('city'); });
  await until(() => window.SF.sceneName === 'city', null, 8000);
  await wait(300);
  const p = await pos();
  ok(Math.abs(p.x - h.door.x) < 16 && Math.abs(p.y - h.door.y) < 20, `ut ur ${homeId} vid dörren till ${h.id} (${Math.round(p.x)},${Math.round(p.y)})`);
}
await goHome('husvagn', [3350, 300]);   // från BETONGTORGET till husvagnen på vagnsplatsen
await goHome('hoghus', [3900, 656]);    // från husvagnen till höghuset vid Pixelgatan
// utan sparad stadsposition (omladdning) kliver man ut ur sitt eget hus – Lilla rummet ligger i höghuset
await ev(() => { const g = window.SF.game; g.home = 'rum'; g.save(); window.SF.cityPos = null; window.SF.go('room'); });
await wait(400);
await ev(() => { window.SF.cityPos = null; window.SF.go('city'); });
await until(() => window.SF.sceneName === 'city', null, 8000);
await wait(300);
{
  const p = await pos(), h = homes.find((x) => x.h === 'rum');
  ok(Math.abs(p.x - h.door.x) < 16 && Math.abs(p.y - h.door.y) < 20, `utan sparad position: Lilla rummet → ut vid höghusets dörr (${Math.round(p.x)},${Math.round(p.y)})`);
}

// ------------------------------------------------------------------ 7. kostymfolket i downtown
console.log('\n7. kostymfolket');
await ev(() => { window.__broMin = 8.5 * 60; const d = window.SF.scene._debug; d.teleport(2104, 296); d.lockCam(1912, 190); });
let folk = null;
for (let k = 0; k < 6; k++) {
  await wait(2500);
  folk = await ev(() => {
    const peds = window.SF.scene._debug.sim().life._debug?.peds?.() || [];
    const dt = peds.filter((p) => p.kind === 'folk' && !p.jogger && !p.look?.kid && p.x > 1752 && p.x < 2400);
    return { n: dt.length, suit: dt.filter((p) => p.suit).length, tops: [...new Set(dt.filter((p) => p.suit).map((p) => p.look?.top))] };
  });
  if (folk.n >= 6 && folk.suit / folk.n >= 0.5) break;
}
ok(folk.n >= 4, `folk i downtown (${folk.n} vuxna)`);
ok(folk.suit >= 3 && folk.suit / Math.max(1, folk.n) >= 0.5, `mest kostymklädda (${folk.suit}/${folk.n}: ${folk.tops.join(', ')})`);
await snap('downtown-kostymfolk', 3);
// husnamnen i överkanten (många skyltar tätt i downtown) krockar inte med väderbrickan i högra hörnet
const chipHit = await ev(async () => {
  const W = await import('/js/city/weather.js'), d = window.SF.scene._debug, s = window.SF.view?.safe;
  const VW = d.env.view.w, x1 = s ? Math.min(VW, (s.x1 | 0) || VW) : VW, y0 = s ? s.y0 | 0 : 0;
  const bs = W.weatherBadgeSize?.(d.env.weather) || { w: 46, h: 17 }, badge = [x1 - 3 - bs.w, y0 + 3, x1 - 3, y0 + 3 + bs.h];
  const chips = d.chips();
  return { n: chips.length, hit: chips.filter((c) => c.x < badge[2] && c.x + c.w > badge[0] && c.y < badge[3] && c.y + c.h > badge[1]).map((c) => c.label) };
});
ok(chipHit.n >= 2 && chipHit.hit.length === 0, `husnamnen (${chipHit.n}) ligger inte under väderbrickan${chipHit.hit.length ? ': ' + chipHit.hit.join(', ') : ''}`);
await ev(() => { window.SF.scene._debug.lockCam(null); window.__broMin = null; });

// ------------------------------------------------------------------ 8. övriga dörrar
console.log('\n8. dörrar till egna scener och de utbildade jobben');
await ev(() => { window.__broMin = 13 * 60; });
async function doorInto(id, want) {
  const b = await ev(async (id) => { const M = await import('/js/city/map.js'); const b = M.buildingById(id); return b ? { door: M.doorCenter(b), enter: b.enter, sign: b.sign } : null; }, id);
  if (!b) { ok(false, `${id}: huset finns inte`); return; }
  await ev(() => { if (window.SF.sceneName !== 'city') window.SF.go('city'); });
  await until(() => window.SF.sceneName === 'city' && !!window.SF.scene?._debug, null, 8000);
  await ev(([x, y]) => window.SF.scene._debug.teleport(x + 30, y + 10), [b.door.x, b.door.y]);
  if (!(await ev((n) => (typeof window.SF.hasScene === 'function' ? window.SF.hasScene(n) : true), want))) {
    // scenen är inte släppt än (main.js DOOR_SCENES) – dörren visar soon-texten och man står kvar
    await ev(() => { document.querySelectorAll('#toasts .toast').forEach((e) => e.remove()); });
    await ev((id) => window.SF.scene._debug.enter(id), id);
    const shown = await until(() => document.querySelectorAll('#toasts .toast').length > 0, null, 12000);
    ok(shown && (await ev(() => window.SF.sceneName)) === 'city', `${b.sign}: scenen ${want} är inte släppt än – dörren visar soon-texten`);
    return;
  }
  await ev((id) => window.SF.scene._debug.enter(id), id);
  const inside = await until((w) => window.SF.sceneName === w, want, 15000);
  ok(inside, `${b.sign}: dörren (enter ${b.enter}) leder in i scenen ${want} (${await ev(() => window.SF.sceneName)})`);
  await closeModals();
  await ev(() => window.SF.go('city'));
  await until(() => window.SF.sceneName === 'city', null, 8000);
  await wait(300);
}
await doorInto('kontor3', 'universitet');
await doorInto('bio', 'bio');
await doorInto('kebab', 'kebab');
await doorInto('pantbank', 'pantbank');
// de utbildade jobben: utan examen säger dörren vad som krävs, med examen erbjuds passet
async function jobDoor(id, course, jobName) {
  const b = await ev(async (id) => { const M = await import('/js/city/map.js'); const b = M.buildingById(id); return { door: M.doorCenter(b), enter: b.enter, sign: b.sign }; }, id);
  await ev((c) => { const g = window.SF.game; g.edu = g.edu || {}; delete g.edu[c]; }, course);
  await ev(([x, y]) => window.SF.scene._debug.teleport(x + 30, y + 10), [b.door.x, b.door.y]);
  await ev(() => { document.querySelectorAll('#toasts .toast').forEach((e) => e.remove()); });
  await ev((id) => window.SF.scene._debug.enter(id), id);
  // finns jobbet inte i game.js än (inte släppt) säger dörren "anställer snart" utan krav
  const finns = await ev(async (jid) => !!(await import('/js/game.js')).JOBS[jid], b.enter.split(':')[1]);
  const said = await until((re) => [...document.querySelectorAll('#toasts .toast')].some((e) => new RegExp(re, 'i').test(e.textContent)), finns ? 'examen' : 'anställer snart', 12000);
  const txt = await ev(() => [...document.querySelectorAll('#toasts .toast')].map((e) => e.textContent).join(' | '));
  ok(said && (await ev(() => window.SF.sceneName)) === 'city', `${b.sign} (${b.enter}) utan examen: "${txt.slice(0, 110)}"`);
  const ready = await ev((id) => (typeof window.SF.jobReady === 'function' ? window.SF.jobReady(id) : null), b.enter.split(':')[1]);
  if (ready) {
    await ev((c) => { const g = window.SF.game; g.edu = g.edu || {}; g.edu[c] = { lect: 4, day: 0, tenta: 1, tentaDay: 0, klar: true }; g.energy = 90; }, course);
    await ev((id) => window.SF.scene._debug.enter(id), id);
    let t = '';
    for (let i = 0; i < 40 && !t.includes(jobName); i++) { await wait(250); t = (await dlgTitle()) || ''; }
    ok(t.includes(jobName), `${b.sign} med examen i ${course}: passet erbjuds ("${t}")`);
    await closeModals();
    await ev((c) => { delete window.SF.game.edu[c]; }, course);
  } else console.log(`(jobbet bakom ${b.sign} har ingen jobbscen i main.js än – dörren säger "anställer snart")`);
}
await jobDoor('kontor4', 'datorteknik', 'Pixel Data');
await jobDoor('kontor1', 'ekonomi', 'Finanshuset');

// ------------------------------------------------------------------ 9. kameran på bron
console.log('\n9. kameran på Stora bron');
async function camAt(x, y) {
  await ev(([x, y]) => window.SF.scene._debug.teleport(x, y), [x, y]);
  await wait(1200);                                   // kameran glider på plats
  return ev(() => { const d = window.SF.scene._debug; return { cam: d.cam(), pos: d.pos(), vh: d.env.view.h }; });
}
const landS = await camAt(2200, 292), camS = await camAt(2716, 292);
await snap('kamera-bron-sodra-trottoaren');
const camN = await camAt(2716, 204);
await snap('kamera-bron-norra-trottoaren');
ok(camS.cam.y < landS.cam.y - 30, `södra trottoaren på bron: kameran lyfts (y ${Math.round(camS.cam.y)} mot ${Math.round(landS.cam.y)} på land)`);
ok(camS.pos.y - camS.cam.y <= camS.vh - 20, `…och figuren syns ändå (${Math.round(camS.pos.y - camS.cam.y)} px ner i en ${camS.vh} px hög bild)`);
ok(camN.cam.y <= 30, `norra trottoaren på bron: tornens krön är med (kamerans y ${Math.round(camN.cam.y)})`);

// ------------------------------------------------------------------ 10. bakom de höga tornen
console.log('\n10. bakom downtowns höga torn');
const behind = await ev(async () => (await import('/js/city/map.js')).DOWNTOWN_LAYOUT.behind || []);
const inBehind = (p) => behind.some((r) => p.x >= r[0] && p.x < r[2] && p.y >= r[1] && p.y < r[3]);
ok(behind.length >= 2, `ytorna bakom PIXEL TOWER och GLASTORNET är hinder (${behind.length} rektanglar)`);
for (const [x, y] of [[1830, 480], [1828, 452], [2310, 460], [2300, 440]]) {
  await ev(([x, y]) => window.SF.scene._debug.teleport(x, y), [x, y]);
  const p = await pos();
  ok(!inBehind(p), `figuren som ställs bakom tornet (${x},${y}) hamnar där den syns (${Math.round(p.x)},${Math.round(p.y)})`);
}
await ev(() => window.SF.scene._debug.teleport(1830, 400));
await ev(() => window.SF.scene._debug.walkTo(1830, 478));
await until(() => window.SF.scene._debug.arrived(), null, 10000);
{ const p = await pos(); ok(!inBehind(p), `gångmål bakom PIXEL TOWER slutar framför tornet (${Math.round(p.x)},${Math.round(p.y)})`); }
await ev(() => window.SF.scene._debug.lockCam(1700, 300));
await wait(400);
await snap('torn-pixeltower-kant', 3);
await ev(() => window.SF.scene._debug.lockCam(null));
// från torget till Södergatan förbi GLASTORNET: man kommer fram och går aldrig bakom tornet
{
  await ev(() => window.SF.scene._debug.teleport(2320, 410));
  await ev(() => window.SF.scene._debug.walkTo(2310, 660));
  const seen = [];
  for (let i = 0; i < 100; i++) { await wait(150); seen.push(await pos()); if (await ev(() => window.SF.scene._debug.arrived())) break; }
  const end = await pos();
  ok(Math.abs(end.y - 660) < 12 && !seen.some(inBehind), `torget → Södergatan runt GLASTORNET: framme (${Math.round(end.x)},${Math.round(end.y)}), aldrig bakom tornet`);
}

ok(errs.length === 0, errs.length ? `konsolfel:\n  ${[...new Set(errs)].slice(0, 8).join('\n  ')}` : 'inga konsolfel');
console.log(`\n${passes} ok, ${fails} fel`);
await browser.close();
process.exit(fails ? 1 : 0);
