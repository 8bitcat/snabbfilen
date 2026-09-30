// Sova i sängen + eget badrum i varje bostad (Carl 2026-09-29), Playwright mot servern:
//   node tools/sova-badrum-test.mjs          (porten: SMOKE_PORT || PORT || 8788)
//  1. badrummet: finns i varje bostad (sista delrummet), man går in genom dörren i
//     bakväggen, startmöbleringen har toalett + handfat/tvättställ (+ dusch/badkar) i
//     badrummet och ingen toalett i de andra rummen, toaletten och handfatet fungerar,
//     och man går tillbaka ut genom dörren. Skärmbild av varje badrum. Bostadsbyråns
//     förhandsbild har en flik för badrummet, och vid besök går man in i kompisens badrum.
//  2. sömnen i varje bostad: klick på sängen → Sov → figuren i sängen (under täcket),
//     zzz, rummet dämpat med släckta lampor, morgon, figuren uppe, veckan visas, dag +1
//     kl 07:00 – och klockan står still medan man somnar. Skärmbild mitt i natten per
//     bostad och en bildremsa av hela sekvensen.
//  3. sängtyperna: vriden dubbelsäng och enkelsäng (båda hållen) och golvmadrassen när
//     sängen ligger i förrådet – huvudet på kudden har avatarens hudfärg och hår. Alla
//     ögonstilar sover med slutna vanliga ögon, afrofrisyren klipps inte av, madrassens
//     filt byter färg för rött hår.
//  4. gamla sparfiler: dasset mitt i Lilla rummet får stå kvar (badrummet seedas utan en
//     toa till, ett tips visas), orörda startmöbler flyttas till de nya platserna (även i
//     besökarens kopia – kompisens data rörs inte), spelarens egna möbler står kvar (det som
//     knuffas för en ny dörr får en egen toast), inget försvinner, sparformatet har inga
//     nya fält (nya delrum = hem:N).
//  Dessutom: skyltarna över möblerna täcker inte dörrar, fönster eller varandra, och
//  badrummet är lika brett som lokalen (mobilfyllningen) utom i husvagnen/Förortsettan.
//  5. sömn utan att ha gått till sängen (sleepFlow direkt, som smoke.mjs): direkt veckan.
// Skriver 'ok: …' / 'FEL: …'; exit 1 vid fel eller konsolfel.
// Bilder: tools/out/sova-badrum/*.png
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const require = createRequire('D:/Qisy/QISYFrontend/QISYFrontend-1/package.json');
const { chromium } = require('playwright');

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'tools/out/sova-badrum/');
const PORT = process.env.SMOKE_PORT || process.env.PORT || 8788;
fs.mkdirSync(OUT, { recursive: true });
let fails = 0;
const ok = (c, m) => { console.log((c ? 'ok: ' : 'FEL: ') + m); if (!c) fails++; };

const SKIN = '#c68a5c', HAIR = '#b7392b';
const AVATAR = { name: 'Sömnis', look: { skin: SKIN, hair: HAIR, style: 'long', shirt: '#46a35a', pants: '#2d3a5c' }, color: '#ffd23f' };
const SAVE = (o = {}) => ({ v: 1, day: 3, min: 22 * 60, money: 100000, hunger: 90, energy: 60, home: 'husvagn', fridge: {}, jobs: {}, earned: 0, wardrobe: [], storage: [], deco: {}, won: false, ...o });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1180, height: 720 } });
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
page.on('console', (m) => m.type() === 'error' && !/peer|webrtc|ice|Could not connect|Failed to load resource|ERR_/i.test(m.text()) && errs.push(m.text()));

// alla toaster sedan sidan laddades (de försvinner efter 3 s – loggen missar ingen)
await page.addInitScript(() => {
  window.__toasts = [];
  const seen = new WeakSet();
  setInterval(() => { for (const n of document.querySelectorAll('#toasts > *')) if (!seen.has(n)) { seen.add(n); window.__toasts.push(n.textContent); } }, 25);
});
const toastLog = () => page.evaluate(() => (window.__toasts || []).join(' | '));
const ev = (fn, arg) => page.evaluate(fn, arg);
const wait = (ms) => page.waitForTimeout(ms);
const until = async (fn, arg, ms = 12000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await ev(fn, arg)) return true; await wait(100); } return false; };
const modalOpen = () => ev(() => !document.getElementById('modal').classList.contains('hidden'));
const closeModals = async () => { for (let i = 0; i < 4; i++) { if (!(await modalOpen())) return; await ev(() => (document.querySelector('#modal [data-close]') || [...document.querySelectorAll('#modal .dlg-foot .btn')].pop())?.click()); await wait(200); } };
const sceneDown = (x, y) => ev(([x, y]) => window.SF.scene.down(x, y), [x, y]);
const dbg = (name, arg) => ev(([n, a]) => window.SF.scene._debug[n](a), [name, arg]);
const canvasUrl = (s = 3) => ev((s) => {
  const c = document.querySelector('#scene');
  const o = document.createElement('canvas'); o.width = 384 * s; o.height = 216 * s;
  const x = o.getContext('2d'); x.imageSmoothingEnabled = false;
  x.drawImage(c, 0, 0, o.width, o.height);
  return o.toDataURL('image/png');
}, s);
const savePng = (name, url) => { fs.writeFileSync(OUT + name + '.png', Buffer.from(url.split(',')[1], 'base64')); console.log('   → tools/out/sova-badrum/' + name + '.png'); };
const canvasPng = async (name, s = 3) => savePng(name, await canvasUrl(s));
// canvasens medelljusstyrka (0–255)
const lum = () => ev(() => { const c = document.querySelector('#scene'); const x = c.getContext('2d'); const d = x.getImageData(0, 0, c.width, c.height).data; let s = 0, n = 0; for (let i = 0; i < d.length; i += 4 * 13) { s += (d[i] + d[i + 1] + d[i + 2]) / 3; n++; } return s / n; });

// Sparfilen skrivs från en sida på samma ursprung som inte kör spelet (atlasbilden) – annars
// hinner spelet på den förra sidan ibland läsa in den nya sparfilen, möblera om och spara
// innan omladdningen (och då syns inte flytt-toasterna efter den).
async function freshPage(ls) {
  await page.goto(`http://localhost:${PORT}/assets/interior.png`);
  await ev((ls) => { localStorage.clear(); for (const [k, v] of Object.entries(ls)) localStorage.setItem(k, v); }, ls);
  await page.goto(`http://localhost:${PORT}/index.html?world=sb${Date.now().toString(36)}`);
}
async function boot(save) {
  await freshPage({ snabbfilen_avatar: JSON.stringify(AVATAR), snabbfilen_save1: JSON.stringify(save) });
  await page.waitForFunction(() => !!window.SF?.game && window.SF.sceneName === 'room', null, { timeout: 20000 });
  await wait(500);
  await closeModals();
}
// gå till delrummet sub i hemmet (utan promenad – för uppställning)
const enterSub = async (sub) => { await ev((s) => { document.querySelector('#toasts').innerHTML = ''; window.SF.roomSub = s; window.SF.go('room'); }, sub); await wait(250); };
const moveHome = async (id) => { await ev((id) => { const g = window.SF.game; g.money = 100000; g.moveTo(id); g.min = 22 * 60; window.SF.roomSub = 0; window.SF.go('city'); window.SF.go('room'); }, id); await wait(500); };
// gå till rummet to i den löpande lägenheten (figuren går genom öppningarna i mellanväggarna)
async function walkThrough(to) {
  await ev((t) => window.SF.scene._debug.goRoom(t), to);
  const ok = await until((t) => window.SF.roomSub === t && !!window.SF.scene?._debug, to, 30000);
  await wait(900); // kameran hinner ikapp
  return ok;
}
// hudfärgens och hårets pixlar i figuren-i-sängen-bilden
const sleeperPixels = () => ev(([skin, hair]) => {
  const c = window.SF.scene._debug.sleeperArt(true);
  if (!c) return null;
  const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
  const hex = (i) => '#' + [d[i], d[i + 1], d[i + 2]].map((v) => v.toString(16).padStart(2, '0')).join('');
  let s = 0, h = 0;
  for (let i = 0; i < d.length; i += 4) { if (d[i + 3] < 200) continue; const x = hex(i); if (x === skin) s++; if (x === hair) h++; }
  return { skin: s, hair: h, w: c.width, h: c.height };
}, [SKIN, HAIR]);

// Sov i den säng (spot-id) man står vid: klick → dialogen → Sov (eller "Sov ändå") → följ sekvensen.
// shots = { t: namn } → frys sekvensen vid t och ta en skärmbild. Returnerar det som sågs.
async function sleepHere(spotId, shots = {}, label = 'Sov') {
  const day0 = await ev(() => window.SF.game.day);
  const s = await dbg('spot', spotId);
  if (!s) return { err: 'ingen säng: ' + spotId };
  await sceneDown(s.x, s.y);
  if (!(await until(() => !document.getElementById('modal').classList.contains('hidden') && /Sova/.test(document.querySelector('#modal').textContent)))) return { err: 'sovdialogen öppnades inte' };
  await ev((label) => [...document.querySelectorAll('#modal .dlg-foot .btn')].find((b) => b.textContent.includes(label))?.click(), label);
  const started = await until(() => !!window.SF.scene._debug.sleep(), null, 3000);
  if (!started) return { err: 'sömnsekvensen startade inte (main.js anropar inte scene.bedtime?)', day0 };
  const seen = { lying1: false, lying2: false, zs: 0, dimMax: 0, dark: false, day: false, warm: 0, moon: 0, mins: new Set(), shots: {} };
  const note = (st) => {
    if (st.lying === 1) seen.lying1 = true;
    if (st.lying === 2) seen.lying2 = true;
    seen.zs = Math.max(seen.zs, st.zs); seen.dimMax = Math.max(seen.dimMax, st.dim); seen.warm = Math.max(seen.warm, st.warm); seen.moon = Math.max(seen.moon, st.moon);
    if (st.bg === 'dark') seen.dark = true;
    if (st.bg === 'day') seen.day = true;
    seen.mins.add(Math.round(st.min * 100) / 100);
    if (st.day !== day0) seen.dayDuring = true;
  };
  const lum0 = await lum();
  for (const [t, name] of Object.entries(shots).sort((a, b) => a[0] - b[0])) {
    await dbg('hold', +t);
    await wait(180);
    const st = await dbg('sleep');
    seen.shots[name] = { ...st, lum: await lum(), url: await canvasUrl(3) };
    note(st);
  }
  if (Object.keys(shots).length) await dbg('hold', null);
  const t0 = Date.now();
  while (Date.now() - t0 < 9000) {
    const st = await dbg('sleep').catch(() => null);
    if (!st) break;
    note(st);
    await wait(60);
  }
  seen.weekUp = await until(() => document.querySelectorAll('#modal:not(.hidden) .wk-day').length === 7, null, 3000);
  seen.after = await ev(() => ({ day: window.SF.game.day, min: window.SF.game.min, asleep: window.SF.scene.asleep, me: window.SF.scene._debug.me() }));
  seen.day0 = day0; seen.lum0 = lum0;
  for (const sh of Object.values(seen.shots)) sh.lumRatio = sh.lum / lum0;
  await closeModals();
  return seen;
}
const checkSleep = (id, r) => {
  if (r.err) { ok(false, `${id}: ${r.err}`); return; }
  ok(r.lying1 && r.lying2, `${id}: figuren lade sig i sängen och drog upp täcket (lying 1→2)`);
  ok(r.zs >= 2, `${id}: zzz steg (${r.zs} bokstäver samtidigt)`);
  ok(r.dark && r.dimMax >= 0.55 && r.moon > 0.9, `${id}: rummet dämpades mot natt med släckta lampor och månljus (mörker ${r.dimMax.toFixed(2)})`);
  ok(r.day && r.warm > 0.1, `${id}: morgonen kom (dagsljus, gryningsrosa ${r.warm.toFixed(2)})`);
  ok(r.mins.size === 1 && !r.dayDuring, `${id}: klockan stod still medan man somnade (${[...r.mins].join(', ')})`);
  ok(r.weekUp && r.after.day === r.day0 + 1 && r.after.min >= 420 && r.after.min < 426 && !r.after.asleep, `${id}: vaknade dag ${r.after.day} kl ${Math.floor(r.after.min / 60)}:${String(Math.floor(r.after.min % 60)).padStart(2, '0')} och veckan visas`);
};

// ================= 1 + 2: varje bostad =================
await boot(SAVE());
const HOMES = ['husvagn', 'hoghus', 'rum', 'lagenhet', 'radhus', 'villa', 'takvaning'];
const nightShots = [];
let strip = null;
for (const id of HOMES) {
  console.log(`\n${id}`);
  await moveHome(id);
  const rooms = await dbg('rooms');
  const bath = rooms.findIndex((r) => r.bath);
  ok(bath === rooms.length - 1 && bath > 0, `${id}: ${rooms.length} delrum, badrummet (${rooms[bath]?.name}) är det sista (${rooms.map((r) => r.name).join(', ')})`);
  // alla delrum seedas (startmöbleringen). Den löpande lägenheten: badrummet ligger sist, och man
  // går in dit genom öppningen från rummet bredvid.
  // Skyltarna över möblerna får inte täcka varandra, dörrarna, dörrskyltarna eller fönstren.
  let via = -1;
  const parts = [], plateBad = [];
  for (let i = 0; i < rooms.length; i++) {
    await enterSub(i);
    parts.push(await ev(() => window.SF.scene._debug.partition));
    const plates = await dbg('plates'), avoid = await dbg('plateAvoid');
    const hit = (a, b) => a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1];
    plates.forEach((p, j) => {
      if (avoid.some((r) => hit(p.r, r))) plateBad.push(`${rooms[i].name}: ${p.label} över dörr/fönster`);
      if (plates.some((q, k) => k > j && hit(p.r, q.r))) plateBad.push(`${rooms[i].name}: ${p.label} krockar med en annan skylt`);
    });
  }
  const apt = await dbg('apt');
  if (bath > 0 && apt.rooms[bath]?.bath && apt.rooms[bath].ox > apt.rooms[bath - 1].ox + apt.rooms[bath - 1].w) via = bath - 1;
  ok(!plateBad.length, `${id}: skyltarna över möblerna täcker inte dörrar, fönster eller varandra${plateBad.length ? ' – ' + plateBad.join('; ') : ''}`);
  // mobilfyllningen: badrummet är lika brett som lokalen (utom där gården/trapphuset fyller ut)
  ok(parts[bath] === parts[0] || id === 'husvagn' || id === 'hoghus', `${id}: badrummet är ${parts[bath]} px brett (lokalen ${parts[0]} px)`);
  const deco = await ev((h) => JSON.parse(JSON.stringify(Object.fromEntries(Object.entries(window.SF.game.deco).filter(([k]) => k.startsWith(h + ':'))))), id);
  const fnOf = await ev(async () => { const m = await import('/js/game.js'); return Object.fromEntries(['dass', 'toalett', 'handfat', 'tvattstall', 'dusch', 'badkar', 'tvattmaskin', 'tvattpelare'].map((k) => [k, m.functionOf(k)])); });
  const toiletsIn = (i) => (deco[`${id}:${i}`] || []).filter((d) => fnOf[d.k] === 'toalett');
  ok(toiletsIn(bath).length === 1 && toiletsIn(bath)[0].fx, `${id}: toaletten (${toiletsIn(bath)[0]?.k}) står i badrummet i startmöbleringen`);
  ok(rooms.every((r, i) => i === bath || toiletsIn(i).length === 0), `${id}: ingen toalett i de andra rummen`);
  const bathKinds = (deco[`${id}:${bath}`] || []).map((d) => d.k);
  ok(bathKinds.some((k) => k === 'handfat' || k === 'tvattstall') && (id === 'husvagn' || bathKinds.some((k) => k === 'dusch' || k === 'badkar')), `${id}: handfat${id === 'husvagn' ? '' : ' och dusch/badkar'} i badrummet (${bathKinds.join(', ')})`);
  ok(via >= 0, `${id}: öppningen till badrummet går från ${rooms[via]?.name}`);
  // gå in genom dörren
  await enterSub(via);
  ok(await walkThrough(bath), `${id}: gick genom dörren in i ${rooms[bath].name}`);
  ok(await dbg('allFit'), `${id}: badrummets möbler står rätt (allFit)`);
  await wait(300);
  await canvasPng(`badrum-${id}`);
  // toaletten och handfatet fungerar
  const props = await dbg('props');
  const toilet = props.find((p) => p.fn === 'toalett'), sink = props.find((p) => p.k === 'handfat') || null;
  const t0 = await ev(() => window.SF.game.min);
  await ev(() => { document.querySelector('#toasts').innerHTML = ''; });
  const ts = await dbg('spot', toilet.k);
  await sceneDown(ts.x, ts.y);
  ok(await until((m) => window.SF.game.min >= m + 5 && /🚽/.test(document.querySelector('#toasts').textContent), t0), `${id}: toaletten (${toilet.k}) spolar`);
  const sinkId = sink ? 'handfat' : 'tvattstall';
  const ss = await dbg('spot', sinkId);
  await ev(() => { document.querySelector('#toasts').innerHTML = ''; });
  if (ss) await sceneDown(ss.x, ss.y);
  ok(!!ss && await until(() => /🧼|🚿|🛁/.test(document.querySelector('#toasts').textContent)), `${id}: ${sinkId === 'handfat' ? 'handfatet' : 'tvättstället'} fungerar (tvätta händerna)`);
  ok(await walkThrough(via), `${id}: gick ut ur badrummet tillbaka till ${rooms[via].name}`);

  // ----- sömnen -----
  const bedSub = Object.keys(deco).map((k) => +k.split(':')[1]).find((i) => (deco[`${id}:${i}`] || []).some((d) => d.k === 'sang' || d.k === 'enkelsang'));
  await enterSub(bedSub);
  await ev(() => { window.SF.game.min = 22 * 60; });
  await wait(200);
  const bedId = (await dbg('props')).find((p) => p.fn === 'sova')?.k;
  const shots = { 0.5: 'lagt', 2.7: 'natt' };
  if (id === 'villa') Object.assign(shots, { 0.15: 's1', 0.5: 's2', 1.3: 's3', 2.7: 'natt', 3.75: 's5', 4.95: 's6' });
  const r = await sleepHere(bedId, shots);
  checkSleep(id, r);
  if (r.shots?.natt) {
    savePng(`sova-${id}-natt`, r.shots.natt.url);
    nightShots.push(r.shots.natt.url);
    ok(r.shots.natt.lumRatio < 0.8 && r.shots.natt.lying === 2 && r.shots.natt.zs >= 2, `${id}: mitt i natten är rummet mörkare (${Math.round(r.shots.natt.lumRatio * 100)} % av kvällsljuset) med figuren under täcket och zzz`);
  }
  if (id === 'villa') strip = ['s1', 's2', 's3', 'natt', 's5', 's6'].map((k) => r.shots[k]?.url);
  await canvasPng(`sova-${id}-morgon`);
}
// bildremsan (villan) + nattbilderna i ett ark
async function sheet(urls, cols, name) {
  const url = await ev(async ([urls, cols]) => {
    const ims = await Promise.all(urls.map((u) => new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.src = u; })));
    const w = ims[0].width / 2, h = ims[0].height / 2, rows = Math.ceil(ims.length / cols);
    const o = document.createElement('canvas'); o.width = w * cols; o.height = h * rows;
    const x = o.getContext('2d'); x.imageSmoothingEnabled = false;
    ims.forEach((im, i) => x.drawImage(im, (i % cols) * w, Math.floor(i / cols) * h, w, h));
    return o.toDataURL('image/png');
  }, [urls, cols]);
  savePng(name, url);
}
if (strip && strip.every(Boolean)) await sheet(strip, 3, 'sova-sekvens-villan');
if (nightShots.length) await sheet(nightShots, 3, 'sova-natt-alla');

// ================= 1b: bostadsbyråns förhandsbild och besök visar badrummet =================
console.log('\nförhandsbild och besök');
{
  const prev = await ev(async (ids) => {
    const m = await import('/js/scenes/room.js');
    const out = {};
    for (const id of ids) {
      const first = m.renderHomePreview(window.SF, id, 0);
      const last = first.rooms.length - 1;
      const r = m.renderHomePreview(window.SF, id, last);
      const d = r.canvas.getContext('2d').getImageData(0, 0, r.canvas.width, r.canvas.height).data;
      const cols = new Set(); for (let i = 0; i < d.length; i += 4 * 5) cols.add((d[i] << 16) | (d[i + 1] << 8) | d[i + 2]);
      out[id] = { name: r.rooms[last], w: r.canvas.width, h: r.canvas.height, colors: cols.size, url: id === 'villa' || id === 'rum' ? r.canvas.toDataURL('image/png') : null };
    }
    return out;
  }, HOMES);
  ok(HOMES.every((id) => /BADRUM|TOA/.test(prev[id].name) && prev[id].h === 216 && prev[id].w >= 120 && prev[id].colors > 40), `förhandsbilden har en flik för badrummet i alla bostäder (${HOMES.map((id) => `${id}: ${prev[id].name} ${prev[id].w}px`).join(', ')})`);
  if (prev.villa.url) savePng('forhand-villa-badrum', prev.villa.url);
  if (prev.rum.url) savePng('forhand-rum-badrum', prev.rum.url);
  // besök hos en kompis i villan: in i sovrummet och vidare genom BADRUM-dörren
  await ev(() => { window.SF.visitTarget = { id: 'kompis', name: 'Kompis', home: 'villa', deco: {} }; window.SF.roomSub = 1; window.SF.go('visit'); });
  await wait(400);
  ok(await walkThrough(3), 'besök: gick från kompisens SOVRUM in i BADRUM');
  const vis = await ev(() => ({ scene: window.SF.sceneName, props: window.SF.scene._debug.props().map((p) => p.k) }));
  ok(vis.scene === 'visit' && vis.props.includes('toalett') && vis.props.includes('badkar'), `besök: kompisens badrum visas med toa och badkar (${vis.props.join(', ')})`);
  await canvasPng('besok-villa-badrum');
  await ev(() => { window.SF.visitTarget = null; window.SF.roomSub = 0; window.SF.go('room'); });
  await wait(300);
}

// ================= 3: sängtyperna =================
console.log('\nsängtyperna');
{
  await moveHome('lagenhet');
  await enterSub(1);
  for (const r of [1, 3, 2]) {
    await ev((r) => { const g = window.SF.game; const d = g.deco['lagenhet:1'].find((d) => d.k === 'sang'); d.r = r; d.x = 40; d.y = 150; g.save(); }, r);
    await enterSub(1);
    await ev(() => { window.SF.game.min = 22 * 60; });
    const s = await dbg('spot', 'sang');
    await sceneDown(s.x, s.y);
    await until(() => !document.getElementById('modal').classList.contains('hidden'));
    await ev(() => [...document.querySelectorAll('#modal .dlg-foot .btn')].find((b) => b.textContent.includes('Sov'))?.click());
    await until(() => !!window.SF.scene._debug.sleep(), null, 3000);
    await dbg('hold', 2.7);
    await wait(200);
    const px = await sleeperPixels();
    ok(px && px.skin >= 12 && px.hair >= 8, `dubbelsängen vriden r=${r}: huvudet på kudden med avatarens hud (${px?.skin} px) och hår (${px?.hair} px)`);
    await canvasPng(`sangtyp-dubbel-r${r}`);
    await dbg('hold', null);
    ok(await until(() => document.querySelectorAll('#modal:not(.hidden) .wk-day').length === 7, null, 8000), `dubbelsängen r=${r}: veckan visas efter sömnen`);
    await closeModals();
  }
  await moveHome('husvagn');
  for (const r of [0, 1, 3]) {
    await ev((r) => { const g = window.SF.game; const d = g.deco['husvagn:0'].find((d) => d.k === 'enkelsang'); d.r = r; if (r) { d.x = 20; d.y = 170; } g.save(); }, r);
    await enterSub(0);
    await ev(() => { window.SF.game.min = 22 * 60; });
    const s = await dbg('spot', 'enkelsang');
    await sceneDown(s.x, s.y);
    await until(() => !document.getElementById('modal').classList.contains('hidden'));
    await ev(() => [...document.querySelectorAll('#modal .dlg-foot .btn')].find((b) => b.textContent.includes('Sov'))?.click());
    await until(() => !!window.SF.scene._debug.sleep(), null, 3000);
    await dbg('hold', 0.5);
    await wait(150);
    const px0 = await ev(() => { const c = window.SF.scene._debug.sleeperArt(false); return !!c; });
    await dbg('hold', 2.7);
    await wait(200);
    const px = await sleeperPixels();
    ok(px0 && px && px.skin >= 12 && px.hair >= 8, `enkelsängen (husvagnens bädd) r=${r}: huvudet på kudden (hud ${px?.skin} px, hår ${px?.hair} px)`);
    await canvasPng(`sangtyp-enkel-r${r}`);
    await dbg('hold', null);
    ok(await until(() => document.querySelectorAll('#modal:not(.hidden) .wk-day').length === 7, null, 8000), `enkelsängen r=${r}: veckan visas efter sömnen`);
    await closeModals();
  }
  // golvmadrassen: sängen i förrådet
  const stored = await ev(() => { const g = window.SF.game; const i = g.deco['husvagn:0'].findIndex((d) => d.k === 'enkelsang'); return g.decoToStorage(0, i); });
  await enterSub(0);
  const mad = (await dbg('props')).some((p) => p.k === 'madrass');
  ok(stored && mad, 'sängen i förrådet → madrassen på golvet');
  await ev(() => { window.SF.game.min = 22 * 60; });
  const r = await sleepHere('madrass', { 0.5: 'lagt', 2.7: 'natt' }, 'Sov ändå');
  checkSleep('golvmadrassen', r);
  if (r.shots?.natt) savePng('sova-madrassen-natt', r.shots.natt.url);
  // och tillbaka med sängen
  await ev(() => { const g = window.SF.game; const i = g.storage.findIndex((it) => it.k === 'enkelsang'); if (i >= 0) g.placeFromStorage(i, 0, 14, 150); });
}

// ================= 3b: ögonstilarna, frisyren och filten =================
console.log('\nögonen, håret och filten');
{
  const r = await ev(async () => {
    const { EYE_TYPES } = await import('/js/core/people.js');
    const dbg = window.SF.scene._debug;
    const data = (d, look) => { const a = dbg.sleeperArtFor(d, look, true); const c = a.img; return { w: c.width, h: c.height, px: c.getContext('2d').getImageData(0, 0, c.width, c.height).data }; };
    const bad = [];
    for (const kid of [false, true]) {
      const base = { skin: '#eabf98', hair: '#3b2619', style: 'short', shirt: '#46a35a', kid, eyeColor: '#3f6fb0' };
      const ref = data({ k: 'sang', v: 0 }, { ...base, eyes: 'normal' }).px;
      for (const e of EYE_TYPES) {
        const p = data({ k: 'sang', v: 0 }, { ...base, eyes: e, eyeColor2: '#46a35a' }).px;
        let diff = 0; for (let i = 0; i < p.length; i++) if (p[i] !== ref[i]) diff++;
        if (diff) bad.push(`${e}${kid ? '/barn' : ''}`);
      }
    }
    // afro i enkelsängen: håret får plats i bilden (sticker ut över kanten, klipps inte rakt av)
    const afro = { skin: '#8d5a3b', hair: '#1c1410', style: 'afro', shirt: '#f0c020' };
    const a = data({ k: 'enkelsang', v: 0 }, afro);
    let edge = 0; for (let y = 0; y < a.h; y++) for (const x of [0, a.w - 1]) if (a.px[(y * a.w + x) * 4 + 3] > 0) edge++;
    // golvmadrassen: rött hår får en filt i en annan färg än det röda håret (mörkt hår får
    // den rödbruna) – räknat som röda pixlar i bilden, hårets egna oräknade
    const reds = (look) => { const m = data({ k: 'madrass' }, look); let n = 0; for (let i = 0; i < m.px.length; i += 4) if (m.px[i + 3] > 200 && m.px[i] > m.px[i + 2] + 60 && m.px[i] > m.px[i + 1] + 60) n++; return n; };
    const redHair = reds({ skin: '#eabf98', hair: '#b7392b', style: 'buzz', shirt: '#46a35a' });
    const darkHair = reds({ skin: '#eabf98', hair: '#1c1410', style: 'buzz', shirt: '#46a35a' });
    return { n: EYE_TYPES.length, bad, edge, w: a.w, redHair, darkHair };
  });
  ok(!r.bad.length, `alla ${r.n} ögonstilar (vuxen och barn) sover med slutna vanliga ögon${r.bad.length ? ' – lyser/öppna: ' + r.bad.join(', ') : ''}`);
  ok(r.edge === 0, `afrofrisyren i enkelsängen klipps inte av vid bildens kanter (${r.w} px bred bild, ${r.edge} px vid kanten)`);
  ok(r.darkHair > 100 && r.redHair < r.darkHair / 2, `golvmadrassens filt byter färg för rött hår (röda pixlar: rött hår ${r.redHair}, mörkt hår ${r.darkHair})`);
}

// ================= 5: sömn utan sängklick (smoke-vägen) =================
console.log('\nsleepFlow utan att gå till sängen');
{
  await enterSub(0);
  const day0 = await ev(() => window.SF.game.day);
  await ev(() => window.SF.sleepFlow());
  await wait(250);
  await ev(() => document.querySelector('#modal .dlg-foot .btn-go')?.click());
  await wait(350);
  ok(await ev((d) => document.querySelectorAll('#modal:not(.hidden) .wk-day').length === 7 && window.SF.game.day === d + 1 && !window.SF.scene.asleep, day0), 'utan sängklick sover man direkt och veckan visas (som förut)');
  await closeModals();
}

// ================= 4: gamla sparfiler =================
console.log('\ngamla sparfiler');
{
  // Lilla rummet sparat före badrummet: dasset mitt i rummet, orörda startmöbler, en egen bokhylla
  const old = SAVE({ home: 'rum', min: 12 * 60, deco: { 'rum:0': [
    { k: 'sang', v: 0, x: 14, y: 133, fx: 1 }, { k: 'garderob', v: 0, x: 106, y: 96, fx: 1 }, { k: 'kylskap', v: 0, x: 150, y: 94, fx: 1 },
    { k: 'dass', v: 0, x: 138, y: 174, fx: 1 }, { k: 'bokhylla', v: 1, x: 60, y: 200 },
  ] } });
  await boot(old);
  const bootToasts = await toastLog();
  ok(/Tips: dasset kan stå i badrummet/.test(bootToasts), `tipset om att dasset kan flyttas in i badrummet visas (${bootToasts.slice(0, 90)})`);
  const keys0 = Object.keys(JSON.parse(await ev(() => localStorage.getItem('snabbfilen_save1')))).sort();
  await enterSub(0);
  const s0 = await ev(() => JSON.parse(JSON.stringify(window.SF.game.deco['rum:0'])));
  const at = (k) => s0.find((d) => d.k === k);
  // (den löpande lägenheten: öppningen till badrummet sitter i högerväggen – det orörda startdasset
  // flyttas tyst ur öppningen men står kvar i rummet)
  ok(at('dass')?.x <= 138 && at('dass')?.x >= 100 && at('dass')?.y === 174, `dasset står kvar i rummet (${at('dass')?.x},${at('dass')?.y}) tills spelaren flyttar det`);
  ok(at('bokhylla')?.x === 60 && at('bokhylla')?.y === 200 && at('bokhylla')?.v === 1, 'spelarens egen bokhylla står kvar orörd');
  ok(at('garderob')?.x === 71 && at('kylskap')?.x === 118, `orörda startmöbler flyttade till de nya platserna (garderob ${at('garderob')?.x}, kylskåp ${at('kylskap')?.x}) – BADRUM-dörren är fri`);
  ok(s0.length === 5 && await dbg('allFit') && !/knuffades|ligger i förrådet|flyttades lite/.test(bootToasts + await ev(() => document.querySelector('#toasts').textContent)), 'inget försvann, allt står rätt, ingen knuff-toast');
  ok(await walkThrough(1), 'gick in i Lilla rummets BADRUM');
  const bath = await ev(() => JSON.parse(JSON.stringify(window.SF.game.deco['rum:1'])));
  ok(!bath.some((d) => d.k === 'dass' || d.k === 'toalett') && bath.some((d) => d.k === 'handfat') && bath.some((d) => d.k === 'dusch'), `badrummet seedades utan en toa till (${bath.map((d) => d.k).join(', ')})`);
  await canvasPng('gammal-rum-badrum');
  const keys1 = Object.keys(JSON.parse(await ev(() => localStorage.getItem('snabbfilen_save1')))).sort();
  const decoKeys = Object.keys(await ev(() => window.SF.game.deco));
  ok(JSON.stringify(keys0) === JSON.stringify(keys1) && decoKeys.every((k) => /^[a-z]+:\d+$/.test(k)), `sparformatet oförändrat (inga nya fält; deco-nycklar ${decoKeys.join(', ')})`);

  // besök hos en kompis vars Lilla rummet är sparat före badrummen: besökaren ser kylskåpet
  // och garderoben på de nya platserna (BADRUM-dörren fri), kompisens data rörs inte
  const hostRum = old.deco['rum:0'].map((d) => ({ ...d }));
  await ev((deco) => { window.SF.visitTarget = { id: 'kompis2', name: 'Kompis', home: 'rum', deco: { 'rum:0': deco } }; window.SF.roomSub = 0; window.SF.go('visit'); }, hostRum);
  await wait(400);
  const v = await ev(() => ({ scene: window.SF.sceneName, props: window.SF.scene._debug.props(), fit: window.SF.scene._debug.allFit(), host: JSON.parse(JSON.stringify(window.SF.visitTarget.deco['rum:0'])) }));
  const vx = (k) => v.props.find((p) => p.k === k)?.solid[0] + 1;
  ok(v.scene === 'visit' && vx('kylskap') === 118 && vx('garderob') === 71 && v.fit, `besök i en gammal sparfil: kylskåpet (${vx('kylskap')}) och garderoben (${vx('garderob')}) står på de nya platserna, allt står rätt`);
  ok(JSON.stringify(v.host) === JSON.stringify(hostRum), 'besök: kompisens sparade möbler är orörda');
  await canvasPng('besok-gammal-rum');
  await ev(() => { window.SF.visitTarget = null; window.SF.roomSub = 0; window.SF.go('room'); });
  await wait(300);

  // Lägenheten med egen möblering: allt finns kvar, möbler långt från nya dörren står kvar exakt
  const lag = [{ k: 'kylskap', v: 0, x: 214, y: 94, fx: 1 }, { k: 'soffa', v: 2, x: 60, y: 180 }, { k: 'tv', v: 1, x: 100, y: 120 }, { k: 'bokhylla', v: 0, x: 186, y: 96 }];
  await boot(SAVE({ home: 'lagenhet', min: 12 * 60, deco: { 'lagenhet:0': lag, 'lagenhet:1': [{ k: 'sang', v: 5, x: 40, y: 133, fx: 1 }, { k: 'garderob', v: 3, x: 196, y: 96, fx: 1 }] } }));
  const lagToasts = await toastLog();
  ok(/knuffades till en ledig plats|flyttades lite åt sidan/.test(lagToasts), `toasten säger att bokhyllan (som stod i kylskåpet) flyttades (${lagToasts.slice(0, 90)})`);
  await enterSub(0);
  const l0 = await ev(() => JSON.parse(JSON.stringify(window.SF.game.deco['lagenhet:0'])));
  ok(l0.length === 4 && l0.filter((d) => d.k !== 'bokhylla').every((d) => lag.some((o) => o.k === d.k && o.x === d.x && o.y === d.y && o.v === d.v)), 'lägenhetens egna möbler står kvar (bokhyllan framför nya BADRUM-dörren knuffas bara undan)');
  const bh = l0.find((d) => d.k === 'bokhylla');
  ok(!!bh && await dbg('allFit'), `bokhyllan finns kvar (${bh?.x},${bh?.y}) och allt står rätt`);
  const l1 = await ev(() => JSON.parse(JSON.stringify(window.SF.game.deco['lagenhet:1'])));
  ok(JSON.stringify(l1) === JSON.stringify([{ k: 'sang', v: 5, x: 40, y: 133, fx: 1 }, { k: 'garderob', v: 3, x: 196, y: 96, fx: 1 }]), 'sovrummet (inga nya dörrar där) är helt orört');

  // riktig gammal sparfil (tools/saves/): laddas utan förlust
  const fx = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools/saves/v0.14.0.json'), 'utf8'));
  const oldSave = JSON.parse(fx.localStorage.snabbfilen_save1);
  await freshPage(fx.localStorage);
  await page.waitForFunction(() => !!window.SF?.game, null, { timeout: 20000 });
  await wait(600);
  await closeModals();
  await ev(() => { window.SF.roomSub = 0; window.SF.go('room'); });
  await wait(400);
  const now = await ev(() => ({ home: window.SF.game.home, day: window.SF.game.day, money: window.SF.game.money, deco: JSON.parse(JSON.stringify(window.SF.game.deco)), storage: window.SF.game.storage.length }));
  const count = (deco) => Object.values(deco || {}).reduce((n, l) => n + (Array.isArray(l) ? l.length : 0), 0);
  const oldItems = count(oldSave.deco) + (oldSave.storage || []).length + (oldSave.furniture || []).length;
  const oldKeys = Object.keys(oldSave.deco || {});
  const newItems = oldKeys.reduce((n, k) => n + (now.deco[k] || []).length, 0) + now.storage;
  ok(now.home === (oldSave.home || now.home) && now.day === oldSave.day && now.money === oldSave.money, `v0.14.0-sparfilen: hem ${now.home}, dag ${now.day}, ${now.money} kr – som sparat`);
  ok(newItems >= oldItems, `v0.14.0-sparfilen: alla möbler finns kvar (${newItems} ≥ ${oldItems}) i de gamla delrummen + förrådet`);
  await canvasPng('gammal-v0.14.0');
}

console.log(errs.length ? '\nKONSOLFEL:\n' + errs.join('\n') : '\nInga konsolfel.');
ok(errs.length === 0, 'inga pageerror/console.error');
await browser.close();
console.log(fails ? `\n${fails} FEL` : '\nALLA OK');
process.exit(fails ? 1 : 0);
