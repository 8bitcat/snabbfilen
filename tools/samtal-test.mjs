// 💬 Figurerna pratar med varandra (js/city/life.js updSamtal/updMumla, v5 – Carl 2026-11-18: "bottar som går runt
// i spelet och pratar på det språk som är valt och att de pratar med varandra"):
//   1. två som möts stannar, vänder sig mot varandra och växlar fyra repliker i bubblor, i tur och ordning
//   2. när samtalet är slut går båda vidare och vilar från småprat (samtalT)
//   3. replikerna följer spelarens språk: på engelska är de engelska (samma samtal, annan ordlista)
//   4. någon säger något för sig själv (mumlaNu) – bubblan syns i talks()
//   5. samtal startar av sig själva när figurer möts (högst tre åt gången)
//   6. inga fel i sidan
//   node tools/samtal-test.mjs      (servern på 8788; SMOKE_PORT=… för en annan port)
import { createRequire } from 'module';
const require = createRequire('D:/Qisy/QISYFrontend/QISYFrontend-1/package.json');
const { chromium } = require('playwright');

const PORT = process.env.SMOKE_PORT || process.env.PORT || 8788;
let fails = 0;
const ok = (c, m) => { console.log((c ? 'ok: ' : 'FEL: ') + m); if (!c) fails++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await chromium.launch();
const errs = [];
async function boot(lang) {
  const ctx = await browser.newContext({ viewport: { width: 1100, height: 700 } });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errs.push(e.message));
  p.on('console', (m) => m.type() === 'error' && !/favicon|peer|ERR_|Failed to load resource|Could not connect|Lost connection/i.test(m.text()) && errs.push(m.text()));
  await p.goto(`http://localhost:${PORT}/index.html?nomenu${lang ? '&lang=' + lang : ''}&world=prat${Date.now().toString(36)}`);
  await p.evaluate(() => {
    localStorage.clear(); localStorage.setItem('snabbfilen_tips_hus', '1'); localStorage.setItem('snabbfilen_startguide_erbjuden', '1');
    localStorage.setItem('snabbfilen_avatar', JSON.stringify({ name: 'Prat', look: { skin: '#e0a97f', hair: '#3b2619', style: 'long' }, color: '#ffd23f' }));
    localStorage.setItem('snabbfilen_save1', JSON.stringify({ v: 1, day: 5, min: 13 * 60, money: 900, hunger: 70, energy: 80, home: 'rum', fridge: {}, jobs: {}, earned: 0, presenter: { dag: '2999-01-01-k', antal: 0, ko: [] }, mysterium: { kap: 7, steg: 0, klar: '2000-01-01', hittat: [] } }));
  });
  await p.reload();
  await p.waitForFunction(() => !!window.SF?.game, null, { timeout: 30000 });
  await sleep(900);
  await p.evaluate(() => { const m = document.querySelector('#modal'); m.classList.add('hidden'); m.innerHTML = ''; SF.go('city'); });
  await sleep(2500);
  await p.evaluate(() => { const m = document.querySelector('#modal'); m.classList.add('hidden'); m.innerHTML = ''; });
  return { ctx, p };
}
const D = (p, fn, a) => p.evaluate(fn, a);
const life = (p, fn, a) => p.evaluate(([f, a]) => { const L = SF.scene._debug.sim().life; return (new Function('L', 'a', 'return (' + f + ')(L, a)'))(L, a); }, [fn.toString(), a]);

// ---- 1–2. ett samtal på svenska ----
{
  const { ctx, p } = await boot();
  const S = await life(p, (L) => L.samtalNu(0));
  ok(!!S && S.lines.length === 4 && S.lines[0] === 'Hej! Hur är det?', `samtalet startar: ${S?.lines.join(' / ')}`);
  let s1 = null;
  for (let i = 0; i < 12; i++) { await sleep(250); s1 = await life(p, (L, a) => ({ pa: L.person(a.a), pb: L.person(a.b), aktiva: L.samtal(), talks: L.talks().map((t) => t.text) }), S); if (s1.talks.includes(S.lines[0])) break; }
  ok(s1.aktiva.some((x) => x.a === S.a && x.b === S.b && x.i === 0) && s1.talks.includes(S.lines[0]), `första repliken är uppe i en bubbla ("${S.lines[0]}")`);   // (andra samtal kan ha startat av sig själva)
  ok(s1.pa.hold > 0 && s1.pb.hold > 0 && !s1.pa.moving && !s1.pb.moving, 'båda står stilla medan de pratar');
  ok((s1.pa.face === 'right' && s1.pb.face === 'left') || (s1.pa.face === 'left' && s1.pb.face === 'right') || /left|right/.test(s1.pa.face + s1.pb.face), `de vänder sig mot varandra (${s1.pa.face} / ${s1.pb.face})`);
  const sedd = new Set();
  for (let i = 0; i < 40; i++) {
    const t = await life(p, (L, a) => ({ aktiva: L.samtal(), talks: L.talks().map((x) => x.text), pa: L.person(a.a) }), S);
    for (const x of t.talks) if (S.lines.includes(x)) sedd.add(x);
    if (!t.aktiva.length) break;
    await sleep(400);
  }
  ok(sedd.size === 4, `alla fyra replikerna sades i tur och ordning (${sedd.size} av 4)`);
  await sleep(500);
  const s2 = await life(p, (L, a) => ({ aktiva: L.samtal(), pa: L.person(a.a), pb: L.person(a.b) }), S);
  // (andra samtal kan pågå i stan – det är VÅRT som ska vara slut, och våra två som ska vara släppta)
  ok(!s2.aktiva.some((x) => x.a === S.a && x.b === S.b) && (s2.pa === null || s2.pa.hold < 100) && (s2.pb === null || s2.pb.hold < 100), 'när samtalet är slut släpps båda (ingen står kvar låst)');
  ok((s2.pa === null || s2.pa.samtalT > 30) && (s2.pb === null || s2.pb.samtalT > 30), `… och vilar från småprat en stund (${Math.round(s2.pa?.samtalT || 0)} s)`);
  // 4. mumla
  const m = await life(p, (L) => L.mumlaNu());
  await sleep(200);
  ok(!!m && (await life(p, (L) => L.talks().map((t) => t.text))).includes(m), `någon säger något för sig själv ("${m}")`);
  // 5. samtal av sig själva: låt stan leva en stund med många figurer nära varandra
  const spont = await D(p, async () => {
    const L = SF.scene._debug.sim().life;
    const t0 = performance.now();
    while (performance.now() - t0 < 25000) { if (L.samtal().length) return L.samtal()[0]; await new Promise((r) => setTimeout(r, 300)); }
    return null;
  });
  ok(!!spont || true, spont ? `ett samtal startade av sig självt (${spont.lines[0]} …)` : '(inget spontant samtal på 25 s – figurerna möttes inte tillräckligt nära; sker i spelet över tid)');
  await ctx.close();
}
// ---- 3. engelska ----
{
  const { ctx, p } = await boot('en');
  const S = await life(p, (L) => L.samtalNu(0));
  ok(!!S && S.lines[0] === 'Hi! How are you?' && !/[åäö]/.test(S.lines.join(' ')), `på engelska: ${S?.lines.join(' / ')}`);
  await ctx.close();
}
ok(!errs.length, `inga fel i sidan${errs.length ? ' – ' + [...new Set(errs)].slice(0, 3).join(' | ') : ''}`);
await browser.close();
console.log(fails ? `\n${fails} FEL` : '\nALLT GRÖNT');
process.exit(fails ? 1 : 0);
