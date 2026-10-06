// Funktionstest av notiserna i appen (js/core/notiser.js): sidan körs med en låtsad Capacitor
// (isNativePlatform + LocalNotifications) och vi kontrollerar att
//   1. på webben finns inga notiser: ingen fråga, ingen rad under ⚙ Inställningar
//   2. i appen frågar spelet en gång när man har levt minst en dag; "Ja tack" → telefonens fråga →
//      på; "Nej tack" → av och inga notiser; säger telefonen nej blir det av med ett besked
//   3. händelserna läggs som årliga notiser (on: månad/dag/timme) med id 7000 + händelsens id, och
//      spelets gamla notiser tas bort först (andra id:n lämnas i fred); "fran" väntar till sitt datum
//   4. ⚙ Inställningar: 🔔 PÅ/AV och Prova (en notis om fem sekunder)
//   5. dag 1: ingen fråga än
//   node tools/notiser-test.mjs      (servern på 8788; annan port: SMOKE_PORT=8791 eller PORT=…)
import { createRequire } from 'module';
const require = createRequire('D:/Qisy/QISYFrontend/QISYFrontend-1/package.json');
const { chromium } = require('playwright');

const PORT = process.env.SMOKE_PORT || process.env.PORT || 8788;
let fails = 0;
const ok = (c, m) => { console.log(c ? `ok: ${m}` : `FEL: ${m}`); if (!c) fails++; };
const browser = await chromium.launch();

async function sida({ app, tillat = 'granted', dag = 2 }) {
  const ctx = await browser.newContext({ viewport: { width: 1100, height: 700 } });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  if (app) {
    await p.addInitScript((svar) => {
      window.__n = { status: 'prompt', fragor: 0, schemalagda: [], avbokade: [], pending: [{ id: 42 }, { id: 7003 }] };
      window.Capacitor = {
        isNativePlatform: () => true,
        Plugins: {
          CapacitorUpdater: { notifyAppReady: async () => ({}), download: async () => { throw new Error('nej'); }, set: async () => {} },
          LocalNotifications: {
            checkPermissions: async () => ({ display: window.__n.status }),
            requestPermissions: async () => { window.__n.fragor++; window.__n.status = svar; return { display: svar }; },
            getPending: async () => ({ notifications: window.__n.pending.map((x) => ({ ...x })) }),
            cancel: async (o) => { window.__n.avbokade.push(...o.notifications.map((x) => x.id)); window.__n.pending = window.__n.pending.filter((x) => !o.notifications.some((y) => y.id === x.id)); },
            schedule: async (o) => { window.__n.schemalagda.push(...o.notifications); window.__n.pending.push(...o.notifications.map((x) => ({ id: x.id }))); return { notifications: o.notifications.map((x) => ({ id: String(x.id) })) }; },
          },
        },
      };
    }, tillat);
  }
  await p.route('https://8bitcat.github.io/snabbfilen/version.json*', (r) => r.fulfill({ status: 404, body: '' }));
  await p.route('https://api.github.com/**', (r) => r.fulfill({ status: 404, body: '' }));
  await p.goto(`http://localhost:${PORT}/index.html?nomenu&world=notis${Date.now().toString(36)}`);
  await p.evaluate((d) => {
    localStorage.clear();
    localStorage.setItem('snabbfilen_tips_hus', '1');
    localStorage.setItem('snabbfilen_avatar', JSON.stringify({ name: 'Notis', look: { skin: '#eec3a0', hair: '#6b4226', style: 'short', shirt: '#46a35a', pants: '#2d3a5c' }, color: '#46a35a' }));
    localStorage.setItem('snabbfilen_save1', JSON.stringify({ v: 1, day: d, min: 600, money: 500, hunger: 80, energy: 90, home: 'husvagn', fridge: {}, jobs: {}, earned: 0, mal: { id: 'rik', niva: 'latt' } }));
  }, dag);
  await p.reload();
  await p.waitForFunction(() => !!window.SF?.game, null, { timeout: 20000 });
  await p.waitForTimeout(500);
  // stäng startens rutor – men inte notisfrågan själv (på en långsam server hinner den komma först)
  await p.evaluate(() => { const m = document.querySelector('#modal'); if (m && !m.classList.contains('hidden') && !/notiser/i.test(m.textContent)) { m.classList.add('hidden'); m.innerHTML = ''; } });
  return { p, ctx, errs };
}
const until = async (p, fn, ms = 15000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await p.evaluate(fn)) return true; await p.waitForTimeout(150); } return false; };
const fragan = (p) => until(p, () => /Vill du få notiser/.test(document.querySelector('#modal:not(.hidden)')?.textContent || ''), 12000);
const klicka = (p, text) => p.evaluate((t) => [...document.querySelectorAll('#modal button')].find((b) => b.textContent.includes(t))?.click(), text);
const installningar = async (p) => {
  await p.evaluate(async () => { (await import('/js/core/menu.js')).openMenu(window.SF, { pause: true, onStart: () => {} }); });
  await p.evaluate(() => document.querySelector('#menu [data-settings]').click());
  return p.evaluate(() => document.querySelector('#menu .menu-settings')?.textContent || '');
};

// ---------- 1: webben ----------
{
  const { p, ctx, errs } = await sida({ app: false });
  await p.waitForTimeout(6500);
  ok(!/Vill du få notiser/.test(await p.evaluate(() => document.body.textContent)), 'webben: ingen notisfråga');
  ok(!/Notiser/.test(await installningar(p)), 'webben: ingen 🔔-rad under Inställningar');
  ok(errs.length === 0, 'webben: inga fel' + (errs.length ? ' – ' + errs.join(' | ') : ''));
  await ctx.close();
}

// ---------- 2 + 3: appen, ja tack ----------
{
  const { p, ctx, errs } = await sida({ app: true });
  ok(await fragan(p), 'appen dag 2: frågan om notiser kommer');
  await klicka(p, 'Ja tack');
  ok(await until(p, () => localStorage.getItem('snabbfilen_notiser') === 'pa'), '"Ja tack" → notiserna är på');
  ok(await p.evaluate(() => window.__n.fragor === 1), 'telefonens egen fråga ställdes en gång');
  // två händelser: en som gäller nu, en som väntar till ett datum långt fram
  const r = await p.evaluate(async () => {
    const N = await import('/js/core/notiser.js');
    N.HANDELSER.length = 0;   // (bara provets händelser – inte julens)
    N.HANDELSER.push({ id: 3, datum: '10-31', kl: 16, titel: 'Halloween!', text: 'Klä ut dig' }, { id: 4, datum: '12-24', titel: 'God jul', text: 'Tomten', fran: '2999-01-01' });
    window.__n.schemalagda = []; window.__n.avbokade = []; window.__n.pending.push({ id: 7003 }, { id: 7010 });   // gamla från ett tidigare paket
    const antal = await N.planera(new Date('2026-10-06T12:00:00'));
    return { antal, s: window.__n.schemalagda, a: window.__n.avbokade, pending: window.__n.pending.map((x) => x.id) };
  });
  ok(r.antal === 1 && r.s.length === 1, `en händelse lades (den andra väntar på sitt datum): ${r.antal}`);
  const h = r.s[0] || {};
  ok(h.id === 7003 && h.title === 'Halloween!' && h.body === 'Klä ut dig', 'notisen: id 7003, rubrik och text');
  ok(h.schedule?.on?.month === 10 && h.schedule.on.day === 31 && h.schedule.on.hour === 16 && h.schedule.on.minute === 0 && !h.schedule.at, 'varje år 31/10 kl 16:00 (on: månad/dag/timme)');
  ok(r.a.includes(7003) && r.a.includes(7010) && !r.a.includes(42), 'spelets gamla notiser togs bort först (även en borttagen händelse), andra id:n lämnades');
  ok(!r.pending.includes(7010), 'en händelse som inte finns kvar i listan försvinner från telefonen');
  ok(r.pending.includes(42), 'en främmande notis (id 42) ligger kvar');
  // ⚙ Inställningar: PÅ + Prova, sedan AV
  const txt = await installningar(p);
  ok(/Notiser/.test(txt) && /PÅ/.test(txt) && /Prova/.test(txt), 'Inställningar: 🔔 Notiser PÅ med Prova');
  await p.evaluate(() => { window.__n.schemalagda = []; document.querySelector('#menu [data-notisprov]').click(); });
  ok(await until(p, () => window.__n.schemalagda.some((x) => x.id === 7999)), 'Prova → en provnotis (id 7999)');
  const prov = await p.evaluate(() => window.__n.schemalagda.find((x) => x.id === 7999));
  const om = (new Date(prov?.schedule?.at).getTime() - Date.now()) / 1000;
  ok(om > 1 && om < 6, `provnotisen kommer om cirka fem sekunder (${om.toFixed(1)} s)`);
  await p.evaluate(() => { window.__n.avbokade = []; document.querySelector('#menu [data-notiser]').click(); });
  ok(await until(p, () => localStorage.getItem('snabbfilen_notiser') === 'av' && window.__n.avbokade.includes(7003)), 'AV → notiserna tas bort');
  ok(await until(p, () => /AV/.test(document.querySelector('#menu [data-notiser]')?.textContent || '')), 'knappen visar AV');
  ok(errs.length === 0, 'appen: inga fel' + (errs.length ? ' – ' + errs.join(' | ') : ''));
  await ctx.close();
}

// ---------- 2: nej tack ----------
{
  const { p, ctx } = await sida({ app: true });
  ok(await fragan(p), 'frågan kommer igen i ett nytt spel');
  await klicka(p, 'Nej tack');
  ok(await until(p, () => localStorage.getItem('snabbfilen_notiser') === 'av'), '"Nej tack" → av');
  ok(await p.evaluate(() => window.__n.fragor === 0 && window.__n.schemalagda.length === 0), 'ingen fråga från telefonen och inga notiser');
  await p.reload();
  await p.waitForFunction(() => !!window.SF?.game, null, { timeout: 20000 });
  await p.waitForTimeout(7000);
  ok(!/Vill du få notiser/.test(await p.evaluate(() => document.querySelector('#modal:not(.hidden)')?.textContent || '')), 'efter omstart frågar spelet inte igen');
  await ctx.close();
}

// ---------- 2: telefonen säger nej ----------
{
  const { p, ctx } = await sida({ app: true, tillat: 'denied' });
  ok(await fragan(p), 'frågan kommer');
  await klicka(p, 'Ja tack');
  ok(await until(p, () => localStorage.getItem('snabbfilen_notiser') === 'av'), 'telefonen säger nej → av');
  ok(await until(p, () => /Inställningar → Notiser/.test(document.querySelector('.toast')?.textContent || ''), 4000), 'beskedet säger var man slår på dem');
  await ctx.close();
}

// ---------- 5: dag 1 ----------
{
  const { p, ctx } = await sida({ app: true, dag: 1 });
  await p.waitForTimeout(7000);
  ok(!/Vill du få notiser/.test(await p.evaluate(() => document.querySelector('#modal:not(.hidden)')?.textContent || '')), 'dag 1: ingen fråga än');
  await ctx.close();
}

await browser.close();
console.log(fails ? `\n${fails} FEL` : '\nALLT GRÖNT');
process.exit(fails ? 1 : 0);
