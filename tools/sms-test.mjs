// Regressionstest för 💬 SMS MELLAN VÄNNER (js/core/smsapp.js, js/net/vanpush.js vanSms…) mot en låtsasserver som
// fungerar som den riktiga (vänlistor + brevlådor i minnet). Carl 2026-10-13: "de vill också kunna skicka sms till sina
// kompisar via mobiltelefonen i spelet".
//   • Mira och Leo spelar samtidigt. 💬 SMS finns i mobilen; Mira skriver till Leo (fula ord blir *** innan det
//     skickas) och trycker en snabbknapp – bubblorna kommer till höger, servern får texterna
//   • Leo hämtar: "Du har fått 2 nya SMS", siffran på appen + röd prick, brevlådan töms; i samtalet syns båda, olästa = 0
//   • Leo svarar medan Miras samtal är öppet: svaret kommer in i hennes samtal utan att rutan ritas om (det hon håller
//     på att skriva står kvar) – och ingen toast
//   • Ella har inte Mira som vän → "måste ha dig som vän också"; för många i dag → "vila tummarna"
//   • Leo anmäler Mira i samtalet → hon blockeras: hennes nästa SMS kommer inte fram och hon syns inte i listan
// Kör: node tools/sms-test.mjs   (servern på 8788, eller SMOKE_PORT / PORT) · SHOTS=1 sparar bilder i tools/out/
import { createRequire } from 'module';
import http from 'node:http';
const require = createRequire('D:/Qisy/QISYFrontend/QISYFrontend-1/package.json');
const { chromium } = require('playwright');

const PORT = process.env.SMOKE_PORT || process.env.PORT || 8788, MOCK = 8798, SHOTS = !!process.env.SHOTS;
let fails = 0;
const ok = (c, m) => { console.log((c ? 'ok: ' : 'FEL: ') + m); if (!c) fails++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// ---- låtsasservern: vänlistor och SMS-brevlådor ----
const listor = {}, ladan = {}, anrop = [];
const server = http.createServer((req, res) => {
  const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'content-type', 'access-control-allow-methods': 'POST, OPTIONS' };
  if (req.method === 'OPTIONS') { res.writeHead(204, cors); res.end(); return; }
  let body = ''; req.on('data', (c) => (body += c)); req.on('end', () => {
    const d = JSON.parse(body || '{}'), svar = (o, st = 200) => { res.writeHead(st, { 'content-type': 'application/json', ...cors }); res.end(JSON.stringify(o)); };
    anrop.push({ path: req.url, data: d, t: Date.now() });
    if (req.url === '/van/vanner') { listor[d.vid] = d.vanner || []; return svar({ ok: true }); }
    if (req.url === '/van/sms') {
      if (!(listor[d.vid] || []).includes(d.till) || !(listor[d.till] || []).includes(d.vid)) return svar({ ok: false, fel: 'inte vänner' }, 403);
      if (d.text === 'spam') return svar({ ok: false, fel: 'för många meddelanden i dag' }, 429);
      const id = 's' + anrop.length;
      (ladan[d.till] ||= []).push({ id, fran: d.namn, fvid: d.vid, text: d.text, t: Date.now() });
      return svar({ ok: true, id, text: d.text });
    }
    if (req.url === '/van/sms/hamta') return svar({ ok: true, sms: ladan[d.vid] || [] });
    if (req.url === '/van/sms/kvittera') { ladan[d.vid] = (ladan[d.vid] || []).filter((x) => !(d.ids || []).includes(x.id)); return svar({ ok: true }); }
    if (req.url === '/van/hamta') return svar({ ok: true, presenter: [] });
    return svar({ ok: true });
  });
}).listen(MOCK);
const browser = await chromium.launch();
const errs = [];
const MIRA = { vid: '1a'.repeat(8), hemlig: 'a1'.repeat(16) }, LEO = { vid: '2b'.repeat(8), hemlig: 'b2'.repeat(16) }, ELLA = { vid: '3c'.repeat(8) };
const KEY = { Mira: 'nyckel-mira', Leo: 'nyckel-leo', Ella: 'nyckel-ella' };
async function spel(namn, jag, vanner) {
  const t0 = Date.now();
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 760 } });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errs.push(`[${namn}] ${e.message}`));
  await p.addInitScript(() => { window.__toasts = []; window.__sfMailto = () => {}; new MutationObserver((ms) => { for (const m of ms) for (const n of m.addedNodes) if (n.classList?.contains('toast')) window.__toasts.push(n.textContent); }).observe(document, { childList: true, subtree: true }); });
  await p.goto(`http://localhost:${PORT}/index.html?nomenu&kbkpush=http://127.0.0.1:${MOCK}&world=sms${Date.now().toString(36)}${namn}`);
  await p.evaluate(([namn, jag, vanner, KEY]) => {
    localStorage.clear(); localStorage.setItem('snabbfilen_tips_hus', '1'); localStorage.setItem('snabbfilen_startguide_erbjuden', '1');
    localStorage.setItem('snabbfilen_avatar', JSON.stringify({ id: 'id-' + namn.toLowerCase(), name: namn, look: { skin: '#e0a97f' }, color: '#ffd23f' }));
    localStorage.setItem('snabbfilen_vanner', JSON.stringify({ ['id-' + namn.toLowerCase()]: { ...jag, lista: vanner.map(([vid, n]) => ({ vid, key: KEY[n], namn: n, look: { skin: '#c68a5e' }, sedan: '2026-10-12', sett: Date.now() })) } }));
    localStorage.setItem('snabbfilen_save1', JSON.stringify({ v: 1, day: 3, min: 600, hunger: 90, energy: 100, home: 'husvagn', jobs: {}, earned: 0, mal: { id: 'rik', niva: 'latt' }, presenter: { dag: '2099-01-01-k', antal: 0, ko: [] } }));
  }, [namn, jag, vanner, KEY]);
  await p.reload().catch(() => {});
  await p.waitForFunction(() => !!window.SF?.game, null, { timeout: 30000 });
  for (let i = 0; i < 80 && !(anrop.some((a) => a.path === '/van/sms/hamta' && a.data.vid === jag.vid && a.t > t0)); i++) await sleep(250);
  await sleep(600);
  await p.evaluate(() => { const m = document.querySelector('#modal'); m.classList.add('hidden'); m.innerHTML = ''; });
  return { ctx, p };
}
const stang = (p) => p.evaluate(() => { const m = document.querySelector('#modal'); m.classList.add('hidden'); m.innerHTML = ''; });
const oppnaSms = async (p) => { await stang(p); await p.click('#hud-mobil'); await sleep(300); await p.evaluate(() => document.querySelector('#mobilen [data-app="sms"]').click()); await sleep(400); };
const samtalMed = async (p, namn) => { const i = await p.evaluate((n) => [...document.querySelectorAll('#modal .sms-rad')].findIndex((r) => r.innerText.includes(n)), namn); await p.evaluate((i) => document.querySelectorAll('#modal .sms-rad')[i].click(), i); await sleep(400); };
const hamta = (p) => p.evaluate(async () => { const m = await import('/js/net/vanpush.js'); return m.vanSmsHamta(SF); });
const bubblor = (p) => p.evaluate(() => [...document.querySelectorAll('#modal .sms-b')].map((b) => (b.classList.contains('ut') ? '>' : '<') + b.querySelector('span').textContent));

const L = await spel('Leo', LEO, [[MIRA.vid, 'Mira']]);
const M = await spel('Mira', MIRA, [[LEO.vid, 'Leo'], [ELLA.vid, 'Ella']]);
ok((listor[LEO.vid] || []).includes(MIRA.vid) && (listor[MIRA.vid] || []).includes(LEO.vid), 'båda vänlistorna finns hos servern');

// ---- Mira skriver ----
await M.p.click('#hud-mobil'); await sleep(300);
ok(await M.p.evaluate(() => !!document.querySelector('#mobilen [data-app="sms"] img.pix-ik') && /SMS/.test(document.querySelector('#mobilen [data-app="sms"]').textContent)), 'mobilen har appen 💬 SMS');
if (SHOTS) await M.p.screenshot({ path: 'tools/out/sms-mobilen.png' });
await M.p.evaluate(() => document.querySelector('#mobilen [data-app="sms"]').click()); await sleep(400);
ok(await M.p.evaluate(() => document.querySelectorAll('#modal .sms-rad').length === 2 && /Inga SMS än/.test(document.querySelector('#modal').innerText)), 'listan: Leo och Ella, "Inga SMS än – säg hej!"');
await samtalMed(M.p, 'Leo');
ok(await M.p.evaluate(() => /Leo/.test(document.querySelector('#modal .dlg-head h2')?.textContent || '') && !!document.querySelector('#modal .sms-skriv input') && document.querySelectorAll('#modal [data-sfras]').length >= 6), 'samtalet med Leo: skrivrutan och snabbknapparna');
await M.p.fill('#modal .sms-skriv input', 'Hej Leo! fan vad kul');
await M.p.press('#modal .sms-skriv input', 'Enter');
await sleep(900);
await M.p.evaluate(() => [...document.querySelectorAll('#modal [data-sfras]')].find((b) => /Vill du spela/.test(b.textContent)).click());
await sleep(900);
const sms1 = anrop.filter((a) => a.path === '/van/sms' && a.data.till === LEO.vid).map((a) => a.data.text);
ok(sms1[0] === 'Hej Leo! *** vad kul' && /^Vill du spela\? 🎮$/.test(sms1[1] || ''), `servern får "Hej Leo! *** vad kul" och "Vill du spela? 🎮" (${JSON.stringify(sms1)})`);
const mb = await bubblor(M.p);
ok(mb.length === 2 && mb.every((b) => b.startsWith('>')) && (await M.p.inputValue('#modal .sms-skriv input')) === '', `Miras bubblor till höger, skrivrutan tömd (${JSON.stringify(mb)})`);
if (SHOTS) await M.p.screenshot({ path: 'tools/out/sms-samtal-mira.png' });

// ---- Leo hämtar ----
await hamta(L.p); await sleep(500);
const lv = await L.p.evaluate(() => ({ toasts: window.__toasts.join(' | '), prick: !document.querySelector('#hud-mobil .mob-badge.ny').classList.contains('hidden') }));
ok(/Du har fått 2 nya SMS/.test(lv.toasts) && lv.prick, `Leo: "💬 Du har fått 2 nya SMS" och röd prick på mobilen (${lv.toasts})`);
ok(!(ladan[LEO.vid] || []).length, 'brevlådan hos servern är tömd');
await L.p.click('#hud-mobil'); await sleep(600);
ok(await L.p.evaluate(() => document.querySelector('#mobilen [data-badge="sms"]')?.textContent === '2'), 'siffran 2 på 💬 SMS');
await L.p.evaluate(() => document.querySelector('#mobilen [data-app="sms"]').click()); await sleep(400);
ok(await L.p.evaluate(() => document.querySelector('#modal .sms-rad .sms-olast')?.textContent === '2'), 'Mira står med 2 olästa');
await samtalMed(L.p, 'Mira');
const lb = await bubblor(L.p);
ok(lb.length === 2 && lb[0] === '<Hej Leo! *** vad kul' && lb.every((b) => b.startsWith('<')), `Leos samtal: Miras två SMS till vänster (${JSON.stringify(lb)})`);
ok(await L.p.evaluate(async () => (await import('/js/core/smsapp.js')).smsOlast(SF) === 0), 'inga olästa när samtalet är öppnat');

// ---- Leo svarar medan Miras samtal är öppet ----
await M.p.fill('#modal .sms-skriv input', 'jag skriver');
await M.p.evaluate(() => { document.querySelector('#modal .sms-skriv input').dataset.samma = '1'; window.__toasts = []; });
await L.p.fill('#modal .sms-skriv input', 'Ja! Kom till parken 😊');
await L.p.click('#modal [data-sskicka]'); await sleep(900);
await M.p.waitForFunction(() => document.querySelectorAll('#modal .sms-b.in').length >= 1, null, { timeout: 12000 }).catch(() => {});
const mb2 = await bubblor(M.p);
const kvar = await M.p.evaluate(() => ({ v: document.querySelector('#modal .sms-skriv input')?.value, samma: document.querySelector('#modal .sms-skriv input')?.dataset.samma, toasts: window.__toasts.join(' | ') }));
ok(mb2.at(-1) === '<Ja! Kom till parken 😊', `svaret kommer in i Miras öppna samtal (${JSON.stringify(mb2)})`);
ok(kvar.v === 'jag skriver' && kvar.samma === '1' && !/SMS|Leo:/.test(kvar.toasts), `rutan ritades inte om – det Mira skrev står kvar, ingen toast (${JSON.stringify(kvar)})`);
if (SHOTS) await M.p.screenshot({ path: 'tools/out/sms-svar.png' });

// ---- Ella (inte vän åt båda hållen) och för många i dag ----
await oppnaSms(M.p); await samtalMed(M.p, 'Ella');
await M.p.evaluate(() => { window.__toasts = []; });
await M.p.fill('#modal .sms-skriv input', 'Hej Ella'); await M.p.click('#modal [data-sskicka]'); await sleep(900);
ok(/Ella måste ha dig som vän också/.test(await M.p.evaluate(() => window.__toasts.join(' | '))) && !(await bubblor(M.p)).length, 'Ella har inte Mira som vän → "måste ha dig som vän också", ingen bubbla');
await oppnaSms(M.p); await samtalMed(M.p, 'Leo');
await M.p.fill('#modal .sms-skriv input', 'spam'); await M.p.click('#modal [data-sskicka]'); await sleep(900);
ok(/vila tummarna/.test(await M.p.evaluate(() => window.__toasts.join(' | '))), 'för många i dag → "vila tummarna till i morgon"');

// ---- Leo anmäler Mira → blockerad ----
await L.p.evaluate(() => [...document.querySelectorAll('#modal .dlg-foot .btn')].find((b) => /Anmäl/.test(b.textContent)).click()); await sleep(400);
ok(await L.p.evaluate(() => /Anmäl Mira/.test(document.querySelector('#modal .dlg-head h2')?.textContent || '')), '⚑ Anmäl i samtalet öppnar "Anmäl Mira"');
await L.p.evaluate(() => [...document.querySelectorAll('#modal .dlg-foot .btn')].find((b) => /Anmäl och blockera/.test(b.textContent)).click()); await sleep(600);
await M.p.fill('#modal .sms-skriv input', 'hallå?'); await M.p.click('#modal [data-sskicka]'); await sleep(900);
await L.p.evaluate(() => { window.__toasts = []; });
await hamta(L.p); await sleep(400);
const blk = await L.p.evaluate(async () => ({ toasts: window.__toasts.join(' | '), olast: (await import('/js/core/smsapp.js')).smsOlast(SF) }));
ok(!/hallå|SMS/.test(blk.toasts) && blk.olast === 0, `blockerad: Miras nästa SMS kommer inte fram (${JSON.stringify(blk)})`);
await oppnaSms(L.p);
ok(await L.p.evaluate(() => !document.querySelectorAll('#modal .sms-rad').length), 'och Mira syns inte i Leos SMS-lista');

await L.ctx.close(); await M.ctx.close();
await browser.close();
server.close();
ok(!errs.length, `inga fel i sidan${errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''}`);
console.log(fails ? `\n✗ ${fails} FEL` : '\nALLT GRÖNT');
process.exit(fails ? 1 : 0);
