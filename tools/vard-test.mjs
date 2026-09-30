// Vårdcentralen – jobbet i receptionen: passdialogen (JOBS.vard + bonusraden), patienterna
// med riktiga klick (bubblan ropar in, patienten går till luckan, dörren skickar), fel rum
// (personalen skickar vidare till rätt rum), för sent (avdrag), NÄSTA-knappen, tangenterna,
// fulla luckor, akutfall först = bonus (och inte bonus när någon annan ropats in före),
// lönebeskedet med akutraden + sparningen, och dörren i staden (öppet 08–17).
//   node tools/vard-test.mjs          (servern på 8788; annan port: SMOKE_PORT=8748 eller PORT=…)
import { createRequire } from 'module';
import fs from 'fs';
const require = createRequire('D:/Qisy/QISYFrontend/QISYFrontend-1/package.json');
const { chromium } = require('playwright');

const PORT = process.env.SMOKE_PORT || process.env.PORT || '8788';
const OUT = 'tools/out/smast-vard/';
fs.mkdirSync(OUT, { recursive: true });
let fails = 0;
const ok = (c, m) => { console.log((c ? 'ok: ' : 'FEL: ') + m); if (!c) fails++; };

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 740 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && !/peer|webrtc|ice|Could not connect|Failed to load resource/i.test(m.text()) && errors.push(m.text()));
await page.goto(`http://localhost:${PORT}/index.html?nomenu&world=vard${Date.now().toString(36)}`);
await page.evaluate(() => {
  localStorage.clear();
  localStorage.setItem('snabbfilen_avatar', JSON.stringify({ name: 'Vera', look: { skin: '#e0a97f', hair: '#3b2619', style: 'bob', shirt: '#3a7bd5', pants: '#2d3a5c' }, color: '#3a7bd5' }));
  localStorage.setItem('snabbfilen_save1', JSON.stringify({ v: 1, day: 2, min: 12 * 60, money: 300, hunger: 90, energy: 90, home: 'rum', fridge: {}, jobs: {}, earned: 0, wardrobe: [], storage: [], deco: {}, won: false }));
});
await page.reload();
await page.waitForFunction(() => !!window.SF?.game, null, { timeout: 20000 });
await page.waitForTimeout(400);

const sleep = (ms) => page.waitForTimeout(ms);
// kör en funktion med scenens _debug (d), ett argument (a) och scenen (s)
const D = (fn, arg) => page.evaluate(([f, a]) => { const s = window.SF.scene; return new Function('d', 'a', 's', 'return (' + f + ')(d, a, s)')(s?._debug, a, s); }, [fn.toString(), arg]);
async function until(fn, arg, ms = 10000) { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await D(fn, arg)) return true; await sleep(80); } return false; }
const modal = () => page.evaluate(() => { const m = document.querySelector('#modal:not(.hidden)'); return m ? { title: m.querySelector('.dlg-head h2')?.textContent || '', body: m.textContent || '' } : null; });
const clickBtn = (txt) => page.evaluate((t) => { const b = [...document.querySelectorAll('#modal:not(.hidden) .dlg-foot .btn')].find((x) => x.textContent.includes(t)); b?.click(); return !!b; }, txt);
const click = (id) => D((d, id, s) => { const p = d.spot(id); if (!p) return null; s.down(p.x, p.y); s.up?.(p.x, p.y); return p; }, id);
const stats = () => D((d) => ({ ...d.stats }));
const pat = (id) => D((d, id) => d.patients().find((p) => p.id === id) || null, id);
const snap = async (name) => { const url = await page.evaluate(() => document.querySelector('#scene').toDataURL('image/png')); fs.writeFileSync(OUT + name + '.png', Buffer.from(url.split(',')[1], 'base64')); };

// ---------- 1. passdialogen och scenen ----------
await page.evaluate(() => window.SF.startJob('vard'));
await sleep(200);
let m = await modal();
ok(!!m && /Vårdcentralen/.test(m.title), `passdialogen öppnas (${m?.title || 'ingen dialog'})`);
ok(!!m && /13 kr per rätt/.test(m.body) && /−5 kr per fel/.test(m.body), 'dialogen visar lönen: 13 kr per rätt, −5 kr per fel');
ok(!!m && /akutfall först/.test(m.body), 'dialogen visar bonusen: +10 kr per akutfall först');
ok(!!m && !/går hem/.test(m.body) && !/💨/.test(m.body), 'dialogen visar inget avdrag för den som går hem (en missad patient ger 0 kr)');
await clickBtn('Jobba ett pass');
await sleep(300);
ok(await page.evaluate(() => window.SF.sceneName) === 'jobbvard', 'Jobba ett pass → scenen jobbvard');
ok(await page.evaluate(() => window.SF.scene?.viewMax?.w === 448 && window.SF.scene?.viewMax?.h === 216), 'scenen anger viewMax 448×216 (bred vy med kapphylla och personaldörr)');
const pre = await D((d) => d.patients().filter((p) => p.state === 'wait').length);
ok(pre >= 2, `passet börjar med patienter i väntrummet (${pre} st)`);
await sleep(1200);
await snap('test-start');
await D((d) => { d.auto(false); d.clear(); });

// ---------- 2. rätt rum med riktiga klick ----------
const a = await D((d) => d.forcePatient('feber'));
const aNum = (await pat(a)).num;
await click('bubbla:' + a);
let pa = await pat(a);
ok(pa?.state === 'called', `klick på bubblan ropar in patienten (${pa?.state})`);
const nu = await D((d) => d.nu());
ok(nu.no === String(aNum % 1000).padStart(3, '0'), `NU-tavlan visar numret ${nu.no} (nummerlapp ${aNum})`);
ok(await until((d, id) => d.patients().find((p) => p.id === id)?.state === 'desk', a, 12000), 'patienten går själv fram till luckan');
ok(await until((d) => d.player().win >= 0 && d.player().path === 0, null, 6000), 'man går själv till luckan där patienten står');
await snap('test-lucka');
await click('dorr:lakare');
let st = await stats();
ok(st.ok === 1 && st.fel === 0 && st.patienter === 1, `FEBER → LÄKARE = rätt (ok ${st.ok}, fel ${st.fel})`);
ok(await until((d) => d.doors()[0].open > 0.5 && d.doors()[0].staff, null, 12000), 'läkarens dörr öppnas och läkaren tar emot');
await snap('test-ratt-dorr');
ok(await until((d, id) => !d.patients().some((p) => p.id === id), a, 8000), 'patienten går in i rummet och försvinner');

// ---------- 3. fel rum: personalen skickar vidare ----------
const b = await D((d) => d.forcePatient('blod'));
await click('nasta');
ok((await pat(b))?.state === 'called', 'NÄSTA-knappen ropar in den som står först i kön');
ok(await until((d, id) => d.patients().find((p) => p.id === id)?.state === 'desk', b, 12000), 'blodprovspatienten står vid luckan');
await click('dorr:akut');
st = await stats();
ok(st.fel === 1 && st.felrum === 1 && st.ok === 1, `BLODPROV → AKUTEN = fel rum (fel ${st.fel})`);
ok(await until((d) => d.doors()[3].staff, null, 12000), 'akutens personal kommer ut i dörren');
ok(await until((d, id) => d.patients().find((p) => p.id === id)?.room === 2, b, 8000), 'personalen skickar vidare patienten till LABB');
ok(await until((d, id) => !d.patients().some((p) => p.id === id), b, 14000), 'patienten hamnar till slut i labbet');

// ---------- 4. för sent ----------
const c = await D((d) => d.forcePatient('hosta'));
await D((d, id) => d.giveUp(id), c);
st = await stats();
ok(st.fel === 1 && st.miss === 1, `patienten som väntade för länge går hem = missad, inte fel (fel ${st.fel}, missade ${st.miss})`);
ok((await pat(c))?.state === 'leave', 'hen går mot utgången');

// ---------- 5. akutfall först = bonus ----------
await D((d) => d.clear());
await D((d) => d.forcePatient('vaccin'));
const ak = await D((d) => d.forcePatient('akut'));
ok((await pat(ak))?.akut === true, 'akutpatienten står i AKUT-rutan');
await snap('test-akut');
await click('bubbla:' + ak);
ok(await D((d) => d.nu().no) === 'AKUT', 'NU-tavlan visar AKUT');
await D((d) => d.arrive());
await click('dorr:akut');
st = await stats();
ok(st.boxes === 1 && st.ok === 2, `akutfall först → AKUTEN = rätt + bonus (bonus ${st.boxes}, ok ${st.ok})`);

// ---------- 6. akut EFTER någon annan: ingen bonus; tangenterna ----------
await D((d) => d.clear());
const ak2 = await D((d) => d.forcePatient('akut'));
const f2 = await D((d) => d.forcePatient('feber'));
await click('bubbla:' + f2);
await click('bubbla:' + ak2);
ok((await pat(ak2))?.passed === 1, 'akutpatienten blev passerad när en annan ropades in först');
await D((d) => d.arrive());
const fw = (await pat(f2)).win;
await D((d, s) => d.teleport(s.x, 156), await D((d, w) => d.spot('lucka:' + w), fw));
await page.keyboard.press('1');
st = await stats();
ok(st.ok === 3, `tangent 1 skickar patienten vid min lucka till LÄKARE (ok ${st.ok})`);
await D((d, id) => d.send('akut', id), ak2);
st = await stats();
ok(st.ok === 4 && st.boxes === 1, `akutfallet efter en annan: rätt men ingen bonus (bonus ${st.boxes})`);

// ---------- 7. fulla luckor och dörrklick utan patient ----------
await D((d) => d.clear());
const ids = await D((d) => ['hosta', 'vaccin', 'arm'].map((s) => d.forcePatient(s)));
const called = await D((d, ids) => ids.map((id) => d.call(id)), ids);
ok(called[0] && called[1] && !called[2], `två luckor: den tredje får vänta (${called.join(', ')})`);
await D((d) => d.clear());
const before = JSON.stringify(await stats());
await click('dorr:labb');
ok(JSON.stringify(await stats()) === before, 'dörrklick utan patient vid disken ändrar ingenting');

// ---------- 7b. den som STÅR framme går före den som är på väg (granskningens fynd) ----------
// A står vid lucka 2, man ropar in B till sin egen lucka 1 (B är på väg) och klickar på en dörr:
// dörren gäller A (man går dit), inte B – B får inget mål och inget "FEL RUM!".
{
  const A2 = await D((d) => d.forcePatient('vaccin'));
  const B2 = await D((d) => d.forcePatient('hosta'));
  await D((d) => d.teleport(370, 156));
  await D((d, id) => d.call(id), A2);
  await D((d) => d.arrive());
  ok((await pat(A2))?.state === 'desk' && (await pat(A2))?.win === 1, 'A står framme vid lucka 2');
  await D((d) => d.teleport(318, 156));
  await D((d, id) => d.call(id), B2);
  ok((await pat(B2))?.state === 'called' && (await pat(B2))?.win === 0, 'B är på väg till min lucka 1');
  const tg = await D((d) => d.target());
  ok(tg?.id === A2, `nästa dörrklick gäller A som står framme (target ${JSON.stringify(tg)})`);
  const s0 = await stats();
  await click('dorr:ssk');
  ok((await pat(B2))?.dest === null, `B som är på väg fick inget rum (dest ${(await pat(B2))?.dest})`);
  ok(await until((d, [id, ok0]) => d.stats.ok === ok0 + 1 && !d.patients().some((p) => p.id === id && (p.state === 'desk' || p.state === 'called')), [A2, s0.ok], 6000), 'A skickas till SJUKSKÖTERSKA = rätt');
  ok(await until((d) => d.player().win === 1 && d.player().path === 0, null, 6000), 'man går själv över till lucka 2');
  st = await stats();
  ok(st.felrum === s0.felrum && st.fel === s0.fel, `inget fel rum (felrum ${st.felrum}, fel ${st.fel})`);
  ok(await until((d, id) => d.patients().find((p) => p.id === id)?.state === 'desk', B2, 12000), 'B kommer fram till lucka 1');
  await page.keyboard.press('1');
  ok(await until((d, ok0) => d.stats.ok === ok0 + 2, s0.ok, 6000), 'tangent 1 skickar B (HOSTA) till LÄKARE = rätt');
  // står ingen framme gäller dörrklicket den som är på väg: hen får rummet som mål
  const C2 = await D((d) => d.forcePatient('blod'));
  await D((d, id) => d.call(id), C2);
  await click('dorr:labb');
  ok((await pat(C2))?.dest === 2, `ingen framme: den som är på väg får LABB som mål (dest ${(await pat(C2))?.dest})`);
  // en till på väg (utan rum): nästa dörrklick gäller hen, inte C som redan fått LABB
  const E2 = await D((d) => d.forcePatient('arm'));
  await D((d, id) => d.call(id), E2);
  await click('dorr:akut');
  ok((await pat(C2))?.dest === 2 && (await pat(E2))?.dest === 3, `nästa dörrklick gäller den som inte har fått något rum (C ${(await pat(C2))?.dest}, E ${(await pat(E2))?.dest})`);
  await D((d) => d.arrive());
  st = await stats();
  ok(st.ok === s0.ok + 4 && st.felrum === s0.felrum, `C → LABB och E → AKUTEN när de kommer fram, båda rätt (ok ${st.ok})`);
  await D((d) => d.clear());
}

// ---------- 8. passet slut: lönen, akutraden och sparningen ----------
await D((d) => { d.auto(true); for (let i = 0; i < 4; i++) d.forcePatient(['feber', 'arm', 'blod', 'vaccin'][i]); });
await sleep(600);
await snap('test-vantrum');
const final = await stats();
const money0 = await page.evaluate(() => window.SF.game.money);
await D((d) => d.skip(999));
let slip = null;
for (let i = 0; i < 60 && !slip; i++) { await sleep(150); const mm = await modal(); if (mm && /Passet är slut/.test(mm.title)) slip = mm; }
ok(!!slip, 'lönebeskedet kommer när passet är slut');
ok(!!slip && /Akutfall först/.test(slip.body), 'lönebeskedet har raden 🚑 Akutfall först');
await page.screenshot({ path: OUT + 'test-lonebesked.png' });
const st2 = (await stats().catch(() => null)) || final;
const felRad = +(/❌ Fel\s*(\d+)/.exec(slip?.body || '')?.[1] ?? -1);
ok(felRad === st2.fel, `lönebeskedets Fel-rad räknar bara fel rum (${felRad}, fel ${st2.fel}, missade ${st2.miss})`);
ok(!!slip && new RegExp(`Missade\\s*${st2.miss}(?!\\s*\\()`).test(slip.body), `lönebeskedet visar de missade som en egen rad utan avdrag (${st2.miss} st, 0 kr)`);
const pay = Math.max(0, st2.ok * 13 + st2.boxes * 10 - st2.fel * 5); // en missad patient kostar inget
await clickBtn('Ta lönen');
await sleep(300);
const g = await page.evaluate(() => ({ money: window.SF.game.money, jobs: window.SF.game.jobs.vard, best: window.SF.game.best.vard, scene: window.SF.sceneName, saved: JSON.parse(localStorage.getItem('snabbfilen_save1')).jobs.vard }));
ok(g.money - money0 === pay, `lönen betalades ut: +${g.money - money0} kr (väntat ${pay})`);
ok(g.jobs === 1 && g.saved === 1, `passet räknas och sparas (jobs.vard ${g.jobs}, sparat ${g.saved})`);
ok(g.best?.ok >= 4, `rekordet sparas (${g.best?.ok} rätt)`);
ok(g.scene === 'city', 'Ta lönen → ut i staden');

// ---------- 9. dörren i staden: öppet 08–17 ----------
async function toDoor(min) {
  await page.evaluate((mm) => { window.SF.game.min = mm; if (window.SF.sceneName !== 'city') window.SF.go('city'); }, min);
  await sleep(500);
  return D((d) => {
    if (!d?.spot || !d.teleport) return 'inget stads-API';
    const s = d.spot('vardcentral'); if (!s) return 'ingen vårdcentral';
    const cam = d.cam?.() || { x: 0, y: 0 };
    d.teleport(s.x + cam.x, s.y + cam.y + 6);
    const s2 = d.spot('vardcentral');
    window.SF.scene.down(s2.x, s2.y);
    return 'ok';
  });
}
const door = await toDoor(7 * 60 + 30);
if (door === 'inget stads-API') console.log('ok: (staden saknar _debug.spot/teleport – dörrtestet hoppas över)');
else {
  ok(door === 'ok', `vårdcentralen finns i staden (${door})`);
  let closed = null;
  for (let i = 0; i < 60 && !closed; i++) { await sleep(150); const mm = await modal(); if (mm) closed = mm; }
  ok(!!closed && /Stängt/.test(closed.body) && /08:00/.test(closed.body), `07:30: stängt – öppnar 08:00 (${closed?.title || 'ingen dialog'})`);
  await clickBtn('Gå därifrån');
  await toDoor(17 * 60 + 30);
  await sleep(2500);
  ok(await page.evaluate(() => window.SF.sceneName) === 'city' && !(await modal()), '17:30: stängt för i dag – man kommer inte in');
  await toDoor(12 * 60);
  let dlg = null;
  for (let i = 0; i < 60 && !dlg; i++) { await sleep(150); const mm = await modal(); if (mm) dlg = mm; }
  ok(!!dlg && /Vårdcentralen/.test(dlg.title), `12:00: dörren leder till passdialogen (${dlg?.title || 'ingen dialog'})`);
  await clickBtn('Jobba ett pass');
  await sleep(400);
  ok(await page.evaluate(() => window.SF.sceneName) === 'jobbvard', 'dörren i staden → jobbet i receptionen');
}

// ---------- 10. mobilen (fyll-läget NÄRA, liggande 844×390): inget under passets remsa ----------
{
  const mctx = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, screen: { width: 844, height: 390 } });
  const mp = await mctx.newPage();
  mp.on('pageerror', (e) => errors.push('mobil: ' + e.message));
  await mp.goto(`http://localhost:${PORT}/index.html?nomenu&mobfill=1&world=vardm${Date.now().toString(36)}`);
  await mp.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('snabbfilen_avatar', JSON.stringify({ name: 'Vera', look: { skin: '#e0a97f', hair: '#3b2619', style: 'bob', shirt: '#3a7bd5', pants: '#2d3a5c' }, color: '#3a7bd5' }));
    localStorage.setItem('snabbfilen_save1', JSON.stringify({ v: 1, day: 2, min: 10 * 60, money: 300, hunger: 90, energy: 90, home: 'rum', fridge: {}, jobs: {}, earned: 0, wardrobe: [], storage: [], deco: {}, won: false }));
    sessionStorage.setItem('sf_rot_ok', '1');
  });
  await mp.reload();
  await mp.waitForFunction(() => !!window.SF?.game, null, { timeout: 20000 });
  await mp.evaluate(() => { document.querySelector('#modal .btn-go')?.click(); window.SF.go('jobbvard', { onDone: () => {} }); });
  await mp.waitForTimeout(1600);   // mätarremsan överst sätter sig efter ~1 s (safe.y0 ändras några rader)
  const MD = (fn, arg) => mp.evaluate(([f, a]) => new Function('d', 'a', 'return (' + f + ')(d, a)')(window.SF.scene._debug, a), [fn.toString(), arg]);
  const v = await mp.evaluate(() => ({ safe: { ...window.SF.view.safe }, cy: window.SF.scene._debug.camY(), hb: window.SF.scene._debug.hudBottom() }));
  // (telefonen: samma skala som i staden – överkanten beskärs; lokalen flyttas ner bara om skyltarna annars
  // hamnar under remsan, det kollar nästa rad)
  ok(v.safe.y0 > 0 && v.cy >= 0, `mobilen beskär överkanten (safe.y0 ${v.safe.y0}, lokalen flyttad ${v.cy} rader)`);
  ok(50 + v.cy >= v.safe.y0 + 18, `dörrskyltarna ligger helt under passets remsa (skylt rad ${50 + v.cy}, remsan slutar ${v.safe.y0 + 18})`);
  ok(v.safe.y1 - v.cy >= 168, `man själv vid luckan och bakre stolsraden syns nertill (lokalens rad ${v.safe.y1 - v.cy} längst ner)`);
  // fel rum: personalens bubbla "FEL RUM! GÅ TILL LABBET!" hamnar under remsan
  await MD((d) => { d.auto(false); d.clear(); ['feber', 'hosta', 'vaccin', 'arm', 'feber', 'vaccin'].forEach((s) => d.forcePatient(s)); d.forcePatient('akut'); const b = d.forcePatient('blod'); d.call(b); d.arrive(); d.send('akut', b); });
  let talk = null;
  for (let i = 0; i < 60 && !talk; i++) { await mp.waitForTimeout(100); talk = (await MD((d) => d.talk()))[3]; }
  ok(!!talk && /FEL RUM/.test(talk.text), `akutens personal säger ${talk?.text || '(ingenting)'}`);
  const hb = await MD((d) => d.hudBottom());
  ok(!!talk && talk.top >= hb + 1, `personalens bubbla ligger under remsan (överkant rad ${talk?.top}, remsan slutar ${hb} i lokalen)`);
  await mp.waitForTimeout(250);
  await mp.screenshot({ path: OUT + 'test-mobil-felrum.png' });
  // remsan är ogenomskinlig i fyll-läget: där ingen text/mätare ritas är den helt mörk (#17151a)
  const band = await mp.evaluate(() => {
    const cv = document.querySelector('#scene'), s = window.SF.pxs, y0 = window.SF.view.safe.y0;
    const c = cv.getContext('2d'), bad = [];
    for (const x of [110, 130, 150, 170, 190, 210]) for (const y of [y0 + 1, y0 + 3, y0 + 15, y0 + 17]) {
      const d = c.getImageData(x * s + 1, y * s + 1, 1, 1).data;
      if (Math.abs(d[0] - 23) > 3 || Math.abs(d[1] - 21) > 3 || Math.abs(d[2] - 26) > 3) bad.push(`${x},${y}=${d[0]},${d[1]},${d[2]}`);
    }
    return bad;
  });
  ok(band.length === 0, `passets remsa är ogenomskinlig – inget skymtar igenom (${band.slice(0, 3).join(' ') || 'helt mörk'})`);
  await mctx.close();
}

console.log(errors.length ? 'KONSOLFEL:\n' + errors.join('\n') : 'inga konsolfel');
ok(errors.length === 0, 'inga pageerror/console.error');
await browser.close();
console.log(fails ? `${fails} FEL` : 'ALLT GRÖNT');
process.exit(fails ? 1 : 0);
