// JOBBA TILLSAMMANS i Burgarbaren: två riktiga webbläsare i samma värld.
// Kollar: kollegan syns i jobbscenen, exakt EN skiftledare (senioritet), ledarens
// tallrikar dyker upp hos medarbetaren, medarbetaren kan plocka en tallrik
// (önskemål → ledaren tar bort den hos sig) och servera en kund – och det är
// SERVITÖREN som får poängen, inte ledaren.
//   node tools/coop-burgare-test.mjs   (servern på 8788; annan port: SMOKE_PORT=8791)
import { createRequire } from 'module';
const require = createRequire('D:/Qisy/QISYFrontend/QISYFrontend-1/package.json');
const { chromium } = require('playwright');

const PORT = process.env.SMOKE_PORT || '8788';
const WORLD = 'coop' + Math.random().toString(36).slice(2, 8);
let fails = 0;
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fails++; };
const errors = [];
const until = async (fn, ms, step = 250) => { const t0 = Date.now(); let v; while (Date.now() - t0 < ms) { v = await fn(); if (v) return v; await new Promise((r) => setTimeout(r, step)); } return v; };

const browser = await chromium.launch();
async function boot(name) {
  const c = await browser.newContext({ viewport: { width: 1100, height: 700 } });
  const p = await c.newPage();
  p.on('pageerror', (e) => errors.push(name + ': ' + e.message));
  await p.goto(`http://localhost:${PORT}/index.html?nomenu&world=${WORLD}`);
  await p.evaluate((n) => {
    localStorage.clear();
    localStorage.setItem('snabbfilen_avatar', JSON.stringify({ id: n.toLowerCase(), name: n, look: { skin: '#eabf98', shirt: n === 'Kalle' ? '#3a78d8' : '#d84a8a' }, color: '#3a78d8' }));
    localStorage.setItem('snabbfilen_save1', JSON.stringify({ v: 1, day: 3, min: 600, money: 500, hunger: 70, energy: 90, home: 'rum', fridge: {}, jobs: { burgare: 2 }, earned: 0, wardrobe: [], storage: [], deco: {}, won: false }));
  }, name);
  await p.reload();
  await p.waitForFunction(() => !!window.SF?.game, null, { timeout: 20000 });
  return p;
}
const D = (p, expr) => p.evaluate(`(() => { const D = SF.scene?._debug; return D ? (${expr}) : null; })()`);

const A = await boot('Kalle');
const okOnline1 = await until(() => A.evaluate(() => SF.worldInfo().open), 25000, 500);
ok(!!okOnline1, 'Kalle är uppkopplad i världen (värd eller klient)');
await A.evaluate(() => SF.go('jobbburgare', { onDone: () => SF.go('city') }));
await A.waitForFunction(() => !!SF.scene?._debug?.coop, null, { timeout: 10000 });

const B = await boot('Julia');
const both = await until(() => B.evaluate(() => SF.worldInfo().online === 2), 30000, 500);
ok(!!both, 'två spelare i samma värld');
await B.evaluate(() => SF.go('jobbburgare', { onDone: () => SF.go('city') }));
await B.waitForFunction(() => !!SF.scene?._debug?.coop, null, { timeout: 10000 });

const synced = await until(async () => {
  const a = await D(A, 'D.coop()'), b = await D(B, 'D.coop()');
  return a && b && a.mates === 1 && b.mates === 1 && a.settled && b.settled ? { a, b } : null;
}, 25000, 400);
ok(!!synced, `kollegan syns i jobbscenen hos båda (${synced ? 'mates 1 och 1' : 'timeout'})`);
const seen = await A.evaluate(() => SF.worldFolksHere().length);
ok(seen === 1, `Kalle SER Julia som figur i dinern (${seen} kollega)`);
let L = A, G = B, ln = 'Kalle', gn = 'Julia';
if (synced && synced.b.leader && !synced.a.leader) { L = B; G = A; ln = 'Julia'; gn = 'Kalle'; }
ok(synced && (synced.a.leader !== synced.b.leader), `exakt EN skiftledare (${ln} leder – var först in)`);

await D(L, 'D.forcePlate(2)');
const sees = await until(async () => { const pl = await D(G, 'D.plates()'); return pl && pl.some((p) => p.d === 2) ? pl : null; }, 6000, 300);
ok(!!sees, `${gn} ser ledarens tallrik på disken inom någon sekund`);

const slot = sees ? sees.find((p) => p.d === 2).slot : 0;
await G.evaluate((s) => { const D2 = SF.scene._debug; const sp = D2.counterSpot(s); SF.scene.down(sp.x, sp.y - 8); }, slot);
const took = await until(() => D(G, 'D.carrying()'), 10000, 300);
ok(took === 2, `${gn} plockar tallriken via ledaren (bär rätt ${took})`);
const goneAtL = await until(async () => { const pl = await D(L, 'D.plates()'); return pl && !pl.some((p) => p.slot === slot && p.d === 2); }, 5000, 300);
ok(!!goneAtL, 'tallriken försvinner samtidigt hos ledaren – ingen dubblett');

// ta FÖRSTA sittande kunden (tvinga fram tills någon sitter) och matcha rätten
const cust = await until(async () => {
  await D(L, 'D.forceCustomer()');
  const cs = await D(L, 'D.customersDbg()');
  return (cs || []).find((k) => k.st === 'sit') || null;
}, 20000, 500);
ok(!!cust, `en kund sitter hos ledaren (id ${cust?.i}, vill ha rätt ${cust?.w})`);
if (cust && cust.w !== took) { // byt min tallrik mot rätten kunden vill ha (swap via ledaren)
  await D(L, `D.forcePlate(${cust.w})`);
  const pl2 = await until(async () => { const pl = await D(G, 'D.plates()'); return (pl || []).find((p) => p.d === cust.w) || null; }, 8000, 300);
  ok(!!pl2, `${gn} ser rätten kunden vill ha på disken`);
  if (pl2) {
    await G.evaluate((s) => { const sp = SF.scene._debug.counterSpot(s); SF.scene.down(sp.x, sp.y - 8); }, pl2.slot);
    const sw = await until(async () => (await D(G, 'D.carrying()')) === cust.w, 12000, 300);
    ok(!!sw, `${gn} byter till rätt ${cust.w} via ledaren (byteslogiken i delat läge)`);
  }
}
if (cust) {
  const custAtG = await until(async () => { const cs = await D(G, 'D.customersDbg()'); return (cs || []).find((k) => k.i === cust.i && k.st === 'sit') || null; }, 8000, 300);
  ok(!!custAtG, `${gn} ser samma kund vid samma bord`);
  if (custAtG) {
    await G.evaluate((k) => { SF.scene.down(k.x, k.ty); }, custAtG);
    const servedStats = await until(async () => { const s = await D(G, 'D.stats'); return s && s.ok >= 1 ? s : null; }, 15000, 400);
    ok(!!servedStats, `${gn} serverar och FÅR POÄNGEN (ok: ${servedStats?.ok})`);
    const lStats = await D(L, 'D.stats');
    ok(lStats && lStats.ok === 0, `ledaren fick INTE poängen (${ln}: ok ${lStats?.ok})`);
    const eating = await until(async () => { const cs = await D(L, 'D.customersDbg()'); return (cs || []).some((k) => k.i === cust.i && k.st === 'eat'); }, 6000, 300);
    ok(!!eating, 'kunden äter hos ledaren – serveringen gällde i den delade världen');
  }
}

// 💼 inbjudan: medarbetaren går hem till stan, ledaren bjuder in – dialog + Häng med!
await G.evaluate(() => SF.go('city'));
await new Promise((r) => setTimeout(r, 700));
const gId = await G.evaluate(() => SF.worldInfo().myId);
await L.evaluate(async (to) => { const m = await import('/js/net/coop.js'); m.sendInvite(to, 'burgare', SF.game ? (JSON.parse(localStorage.getItem('snabbfilen_avatar')) || {}).name : ''); }, gId);
const invited = await until(() => G.evaluate(() => { const el = document.getElementById('modal'); return el && !el.classList.contains('hidden') && /Jobba ihop/.test(el.textContent) ? 1 : 0; }), 8000, 300);
ok(!!invited, `${gn} får inbjudan i en dialog ("Jobba ihop?")`);
if (invited) {
  await G.evaluate(() => { for (const b of document.querySelectorAll('#modal button')) if (/Häng med/.test(b.textContent)) { b.click(); break; } });
  const joined = await until(() => G.evaluate(() => (SF.sceneName === 'jobbburgare' ? 1 : 0)), 8000, 300);
  ok(!!joined, `"Häng med!" tar ${gn} rakt in på passet`);
}

// LEDARBYTE (osynk-fixen): ledaren lämnar – medarbetaren tar över inom sekunder,
// världen fortsätter och nya kunder krockar inte med gamla id:n
{
  const maxId = Math.max(-1, ...((await D(G, 'D.customersDbg()')) || []).map((k) => k.i));
  await L.evaluate(() => SF.go('city'));
  const promoted = await until(async () => { const c = await D(G, 'D.coop()'); return c && c.leader ? c : null; }, 12000, 400);
  ok(!!promoted, `${gn} tar över som skiftledare när ${ln} går (inom sekunder)`);
  await D(G, 'D.forceCustomer()');
  const fresh = await until(async () => ((await D(G, 'D.customersDbg()')) || []).find((k) => k.i > maxId) || null, 8000, 300);
  ok(!!fresh, `världen fortsätter hos den nya ledaren – ny kund med NYTT id (${fresh?.i} > ${maxId})`);
}

const realErrors = errors.filter((e) => !/peer|webrtc|ice|Could not connect|Lost connection/i.test(e));
console.log(realErrors.length ? '\nKONSOLFEL:\n' + realErrors.join('\n') : '\nInga konsolfel.');
ok(realErrors.length === 0, 'inga pageerror');
await browser.close();
console.log(fails ? `\n${fails} FEL` : '\nALLT GRÖNT');
process.exit(fails ? 1 : 0);
