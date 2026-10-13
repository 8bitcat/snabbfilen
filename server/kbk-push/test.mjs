// Prov för KBK-push-servern (src/index.js) i wrangler dev – med en låtsas-Apple (APNs) som tar emot notiserna:
//   • /registrera: rätt förnamn + nummer → ok, fel namn → 403, trasig pushkod → 400
//   • /inne (Julia 34): notis till lagkompisarnas telefoner (Lily på engelska, Saga på svenska) men inte till
//     Julias egen; rätt rubrik, ämne (bundle-id) och en ES256-signatur som går att kontrollera med nyckeln
//   • en telefon som Apple säger är borta (410) glöms bort
//   • samma nummer igen inom 30 min → spärr, ingen ny notis; fel lag → 403; /avregistrera tar bort telefonen
// Kör: cd server/kbk-push && npm install && node test.mjs   (en tillfällig nyckel skapas – ingen riktig Apple-nyckel)
import { spawn } from 'node:child_process';
import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';

let fails = 0;
const ok = (c, m) => { console.log((c ? 'ok: ' : 'FEL: ') + m); if (!c) fails++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const APNS_PORT = 8797, DEV_PORT = 8796, BORTA = 'b'.repeat(64);

// tillfällig nyckel (samma sort som Apples .p8: P-256 i PKCS#8)
const { privateKey, publicKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' });
fs.writeFileSync('.dev.vars', `APNS_KEY="${privateKey.export({ type: 'pkcs8', format: 'pem' }).replace(/\n/g, '\\n')}"\nAPNS_KEY_ID="TESTNYCKEL"\nAPNS_HOST="http://127.0.0.1:${APNS_PORT}"\n`);

// låtsas-Apple: sparar varje notis och svarar 410 för en "borttagen" telefon
const mottaget = [];
const apns = http.createServer((req, res) => {
  let body = ''; req.on('data', (c) => (body += c)); req.on('end', () => {
    const token = req.url.split('/').pop();
    mottaget.push({ token, headers: req.headers, body: JSON.parse(body || '{}') });
    if (token === BORTA) { res.writeHead(410, { 'content-type': 'application/json' }); res.end(JSON.stringify({ reason: 'Unregistered' })); return; }
    res.writeHead(200); res.end();
  });
}).listen(APNS_PORT);

try { fs.rmSync('.wrangler-test', { recursive: true, force: true }); } catch { /* ok */ }   // (en avbruten körning kan ha lämnat spärrar kvar)
const dev = spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['wrangler', 'dev', '--port', String(DEV_PORT), '--ip', '127.0.0.1', '--persist-to', '.wrangler-test'], { stdio: ['ignore', 'pipe', 'pipe'], shell: process.platform === 'win32' });
let logg = ''; dev.stdout.on('data', (b) => (logg += b)); dev.stderr.on('data', (b) => (logg += b));
const URL0 = `http://127.0.0.1:${DEV_PORT}`;
const post = async (path, data) => { const r = await fetch(URL0 + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(data) }); return { status: r.status, ...(await r.json().catch(() => ({}))) }; };
try {
  let upp = false;
  for (let i = 0; i < 120 && !upp; i++) { try { upp = (await fetch(URL0 + '/')).ok; } catch { await sleep(500); } }
  if (!upp) throw new Error('wrangler dev startade inte:\n' + logg.slice(-800));
  const JULIA = 'a1'.repeat(32), LILY = 'c3'.repeat(32), SAGA = 'd4'.repeat(32);
  ok((await post('/registrera', { token: JULIA, nr: 34, namn: 'Julia', lang: 'sv' })).ok, 'Julia 34 registrerar sin telefon');
  ok((await post('/registrera', { token: LILY, nr: '20', namn: ' lily ', lang: 'en' })).ok, 'Lily 20 (små bokstäver, mellanslag) registrerar sin telefon på engelska');
  ok((await post('/registrera', { token: SAGA, nr: 5, namn: 'Saga', lang: 'xx' })).ok, 'Saga 5 registrerar (okänt språk → svenska)');
  ok((await post('/registrera', { token: BORTA, nr: 3, namn: 'Klara' })).ok, 'Klara 3 registrerar (telefonen som snart är borta)');
  ok((await post('/registrera', { token: 'e5'.repeat(32), nr: 34, namn: 'Lily' })).status === 403, 'fel namn till numret → 403');
  ok((await post('/registrera', { token: 'inte-en-pushkod', nr: 34, namn: 'Julia' })).status === 400, 'trasig pushkod → 400');
  ok((await (await fetch(URL0 + '/')).json()).telefoner === 4, 'GET / säger 4 telefoner (inga namn)');

  const inne = await post('/inne', { nr: 34, namn: 'julia', token: JULIA, vanta: true });
  ok(inne.ok && inne.skickade === 3, `Julia hoppar in → notis till 3 telefoner (${inne.skickade})`);
  const till = new Set(mottaget.map((m) => m.token));
  ok(till.has(LILY) && till.has(SAGA) && till.has(BORTA) && !till.has(JULIA), 'Lily, Saga och Klara får notisen – inte Julia själv');
  const lily = mottaget.find((m) => m.token === LILY), saga = mottaget.find((m) => m.token === SAGA);
  ok(lily?.body?.aps?.alert?.body === '⚽ Julia 34 just jumped into Pixelcity!' && saga?.body?.aps?.alert?.body === '⚽ Julia 34 har precis hoppat in i Pixelcity!',
    `texten på var och ens språk ("${lily?.body?.aps?.alert?.body}" / "${saga?.body?.aps?.alert?.body}")`);
  ok(lily?.headers['apns-topic'] === 'io.eightbitcat.pixelcity' && lily?.headers['apns-push-type'] === 'alert' && lily?.body?.aps?.alert?.title === 'KBK', 'ämne (bundle-id), typ och rubrik KBK');
  // signaturen: JWT ES256 som går att kontrollera med den publika nyckeln, kid + iss stämmer
  const [h, k, s] = String(lily?.headers.authorization || '').replace(/^bearer /, '').split('.');
  const huvud = JSON.parse(Buffer.from(h || '', 'base64url').toString() || '{}'), kropp = JSON.parse(Buffer.from(k || '', 'base64url').toString() || '{}');
  const giltig = !!s && crypto.verify('sha256', Buffer.from(`${h}.${k}`), { key: publicKey, dsaEncoding: 'ieee-p1363' }, Buffer.from(s, 'base64url'));
  ok(giltig && huvud.alg === 'ES256' && huvud.kid === 'TESTNYCKEL' && kropp.iss === 'GYTVJ3CTBJ', 'Apples token: ES256-signaturen stämmer med nyckeln, kid och team-id rätt');
  ok(inne.svar?.some((r) => r.status === 410), 'Apple svarar 410 för Klaras borttagna telefon');
  ok((await (await fetch(URL0 + '/')).json()).telefoner === 3, 'den borttagna telefonen glöms (3 kvar)');
  const fore = mottaget.length;
  const igen = await post('/inne', { nr: 34, namn: 'Julia', token: JULIA, vanta: true });
  ok(igen.sparr && igen.skickade === 0 && mottaget.length === fore, 'samma nummer igen inom 30 min → spärr, ingen ny notis');
  ok((await post('/inne', { nr: 34, namn: 'Lily' })).status === 403, 'fel lag (Lily som nummer 34) → 403');
  await post('/avregistrera', { token: SAGA });
  ok((await (await fetch(URL0 + '/')).json()).telefoner === 2, '/avregistrera tar bort Sagas telefon');

  // ---------- 💛 vänner ----------
  // Mira och Leo är vänner åt båda hållen, Ella har Mira på sin lista men Mira inte Ella; Moa är Miras lillasyster på
  // samma iPad (samma pushkod) och vän med Mira. Mira hoppar in → notis bara till Leo.
  const V = (n) => n.repeat(16).slice(0, 16), H = (n) => n.repeat(32).slice(0, 32);
  const MIRA = { vid: V('1'), hemlig: H('a'), namn: 'Mira' }, LEO = { vid: V('2'), hemlig: H('b'), namn: 'Leo' }, ELLA = { vid: V('3'), hemlig: H('c'), namn: 'Ella' }, MOA = { vid: V('4'), hemlig: H('d'), namn: 'Moa' };
  const IPAD = 'f6'.repeat(32), LEOS = 'a7'.repeat(32), ELLAS = 'b8'.repeat(32);
  ok((await post('/van/registrera', { ...MIRA, token: IPAD, lang: 'sv' })).ok, 'vänner: Mira registrerar iPaden (tar sitt vän-id)');
  ok((await post('/van/registrera', { ...MOA, token: IPAD, lang: 'sv' })).ok, 'vänner: Moa på samma iPad');
  ok((await post('/van/registrera', { ...LEO, token: LEOS, lang: 'en' })).ok, 'vänner: Leo registrerar sin telefon på engelska');
  ok((await post('/van/registrera', { ...ELLA, token: ELLAS, lang: 'sv' })).ok, 'vänner: Ella registrerar sin telefon');
  ok((await post('/van/registrera', { ...MIRA, hemlig: H('9'), token: IPAD })).status === 403, 'vänner: fel hemlig nyckel till Miras vän-id → 403');
  ok((await post('/van/registrera', { ...LEO, token: 'nej' })).status === 400, 'vänner: trasig pushkod → 400');
  ok((await post('/van/vanner', { ...MIRA, vanner: [LEO.vid, MOA.vid, MIRA.vid, 'inte-ett-id'] })).vanner === 2, 'vänner: Miras lista (sig själv och trasiga id:n räknas inte)');
  await post('/van/vanner', { ...LEO, vanner: [MIRA.vid] });
  await post('/van/vanner', { ...MOA, vanner: [MIRA.vid] });
  await post('/van/vanner', { ...ELLA, vanner: [MIRA.vid] });
  ok((await (await fetch(URL0 + '/')).json()).vantelefoner === 4, 'GET / räknar vännernas telefoner (inga namn)');
  const f0 = mottaget.length;
  const vin = await post('/van/inne', { ...MIRA, vanta: true });
  const nya = mottaget.slice(f0), tillV = new Set(nya.map((m) => m.token));
  ok(vin.ok && vin.skickade === 1 && tillV.has(LEOS) && !tillV.has(ELLAS) && !tillV.has(IPAD), `vänner: Mira hoppar in → notis bara till Leo (inte Ella, som inte är Miras vän, och inte iPaden där Mira själv finns) (${vin.skickade})`);
  const leoN = nya.find((m) => m.token === LEOS);
  ok(leoN?.body?.aps?.alert?.title === 'Friends' && leoN?.body?.aps?.alert?.body === '💛 Your friend Mira just jumped into Pixelcity!', `vänner: rubrik och text på Leos språk ("${leoN?.body?.aps?.alert?.title}: ${leoN?.body?.aps?.alert?.body}")`);
  const f1 = mottaget.length;
  ok((await post('/van/inne', { ...MIRA, vanta: true })).sparr && mottaget.length === f1, 'vänner: samma figur igen inom 30 min → spärr');
  ok((await post('/van/inne', { ...LEO, hemlig: H('0') })).status === 403, 'vänner: "inne" med fel nyckel → 403 (ingen kan låtsas vara Leo)');
  const lin = await post('/van/inne', { ...LEO, vanta: true });
  ok(lin.skickade === 1 && mottaget.slice(f1).some((m) => m.token === IPAD && m.body?.aps?.alert?.body === '💛 Din vän Leo har precis hoppat in i Pixelcity!'), 'vänner: Leo hoppar in → iPaden (Mira) får "Din vän Leo …"');
  await post('/van/vanner', { ...MIRA, vanner: [MOA.vid] });
  await post('/van/avregistrera', { ...LEO, token: LEOS });
  ok((await (await fetch(URL0 + '/')).json()).vantelefoner === 3, 'vänner: /van/avregistrera tar bort Leos telefon');

  // ---------- 🎁 vänskapspresenter (Mira och Moa är vänner åt båda hållen, Leo och Mira inte längre) ----------
  const f2 = mottaget.length;
  const pr1 = await post('/van/present', { ...MIRA, till: MOA.vid, fri: true, gavor: [{ slag: 'pengar', n: 100 }], vanta: true });
  ok(pr1.ok && pr1.skickade === 1, `present: Mira skickar en vänskapspresent med 100 kr till Moa (${pr1.skickade} telefon)`);
  ok(mottaget.slice(f2).some((m) => m.token === IPAD && m.body?.aps?.alert?.body === '🎁 Mira har skickat en present till dig!' && m.body?.aps?.alert?.title === 'Vänner'), 'present: Moas telefon får notisen "🎁 Mira har skickat en present till dig!"');
  const h1 = await post('/van/hamta', { ...MOA });
  ok(h1.presenter?.length === 1 && h1.presenter[0].fran === 'Mira' && h1.presenter[0].fri && h1.presenter[0].gavor?.[0]?.n === 100, 'present: Moas brevlåda har presenten (från Mira, gratis + 100 kr)');
  ok((await post('/van/present', { ...MIRA, till: MOA.vid, fri: true, gavor: [] })).status === 429, 'present: en gratis vänskapspresent per vän och dag');
  ok((await post('/van/present', { ...MIRA, till: MOA.vid, gavor: [{ slag: 'pengar', n: 99999 }] })).status === 400, 'present: för mycket pengar räknas inte (tom present → 400)');
  ok((await post('/van/present', { ...MIRA, till: LEO.vid, fri: true })).status === 403, 'present: bara till vänner åt båda hållen (Leo → 403)');
  ok((await post('/van/present', { ...MIRA, hemlig: H('0'), till: MOA.vid, fri: true })).status === 403, 'present: fel nyckel → 403');
  ok((await post('/van/present', { ...MIRA, till: MOA.vid, gavor: [{ slag: 'mobel', k: 'soffa', v: 2 }] })).ok && (await post('/van/present', { ...MIRA, till: MOA.vid, gavor: [{ slag: 'mat', id: 'pizza', n: 2 }] })).ok, 'present: två presenter till med en möbel och mat');
  ok((await post('/van/present', { ...MIRA, till: MOA.vid, gavor: [{ slag: 'pengar', n: 10 }] })).status === 429, 'present: högst tre presenter om dagen till samma vän');
  const h2 = await post('/van/hamta', { ...MOA });
  ok(h2.presenter?.length === 3, `present: tre presenter i Moas brevlåda (${h2.presenter?.length})`);
  const kv = await post('/van/kvittera', { ...MOA, ids: (h2.presenter || []).map((x) => x.id) });
  ok(kv.ok && kv.kvar === 0 && (await post('/van/hamta', { ...MOA })).presenter.length === 0, 'present: /van/kvittera tömmer brevlådan');
  // ---------- 🗽 statyn: veckans snällaste (Mira har skickat tre presenter i veckan) ----------
  const st = await (await fetch(URL0 + '/staty')).json();
  ok(st.ok && st.nu?.namn === 'Mira' && st.nu.n === 3 && st.forra === null, `staty: veckans ledare är Mira med 3 presenter, ingen vinnare förra veckan (${JSON.stringify(st)})`);
  // ---------- 🃏 byteshandel: ett pixelkort som vänskapsgåva ----------
  const kp = await post('/van/present', { ...MOA, till: MIRA.vid, gavor: [{ slag: 'kort', id: 'svart' }, { slag: 'kort', id: '<script>' }] });
  const mh = await post('/van/hamta', { ...MIRA });
  ok(kp.ok && mh.presenter?.[0]?.gavor?.length === 1 && mh.presenter[0].gavor[0].slag === 'kort' && mh.presenter[0].gavor[0].id === 'svart', `kort: Moa skickar ett pixelkort till Mira (trasiga kort-id:n räknas inte) (${JSON.stringify(mh.presenter?.[0]?.gavor)})`);
  // ---------- 💬 SMS mellan vänner ----------
  const f3 = mottaget.length;
  const sms = await post('/van/sms', { ...MIRA, till: MOA.vid, text: 'Hej Moa! Kolla www.exempel.se eller ring 070-123 45 67 🎮', vanta: true });
  ok(sms.ok && sms.text === 'Hej Moa! Kolla *** eller ring *** 🎮', `sms: länkar och telefonnummer stryks ("${sms.text}")`);
  const smsN = mottaget.slice(f3).find((m) => m.token === IPAD);
  ok(smsN?.body?.aps?.alert?.body === '💬 Mira: Hej Moa! Kolla *** eller ring *** 🎮' && smsN.body.aps.alert.title === 'Vänner', `sms: Moas telefon får notisen ("${smsN?.body?.aps?.alert?.body}")`);
  ok(smsN?.headers?.['apns-collapse-id'] === `sms-${MIRA.vid}` && smsN.body.aps['thread-id'] === `sms-${MIRA.vid}`, 'sms: notiserna från samma vän ersätter varandra (apns-collapse-id)');
  ok((await post('/van/sms', { ...MIRA, till: LEO.vid, text: 'hej' })).status === 403, 'sms: bara till vänner åt båda hållen (Leo → 403)');
  ok((await post('/van/sms', { ...MIRA, till: MOA.vid, text: '   ' })).status === 400, 'sms: tomt meddelande → 400');
  ok((await post('/van/sms', { ...MIRA, hemlig: H('0'), till: MOA.vid, text: 'hej' })).status === 403, 'sms: fel nyckel → 403');
  const ms = await post('/van/sms/hamta', { ...MOA });
  ok(ms.sms?.length === 1 && ms.sms[0].fran === 'Mira' && ms.sms[0].fvid === MIRA.vid, `sms: Moas brevlåda har meddelandet från Mira (${ms.sms?.length})`);
  // gränsen: 40 om dagen till samma vän (räknaren i en nyckel per avsändare och dag)
  let sist = null;
  for (let i = 0; i < 40; i++) sist = await post('/van/sms', { ...MIRA, till: MOA.vid, text: `nr ${i}` });
  ok(sist?.status === 429, `sms: det 41:a meddelandet samma dag → 429 (${sist?.status})`);
  const ms2 = await post('/van/sms/hamta', { ...MOA });
  ok(ms2.sms?.length === 40 && ms2.sms.at(-1).text === 'nr 38', `sms: brevlådan sparar de 40 senaste (${ms2.sms?.length}, sist "${ms2.sms?.at(-1)?.text}")`);
  const mk = await post('/van/sms/kvittera', { ...MOA, ids: ms2.sms.map((x) => x.id) });
  ok(mk.ok && mk.kvar === 0 && (await post('/van/sms/hamta', { ...MOA })).sms.length === 0, 'sms: /van/sms/kvittera tömmer brevlådan');
} catch (e) {
  ok(false, String(e.message || e));
} finally {
  apns.close();
  // (Windows: dev.kill() dödar bara skalet – workerd under det blir kvar och svarar nästa gång med gammal kod)
  if (process.platform === 'win32') { try { (await import('node:child_process')).execSync(`taskkill /PID ${dev.pid} /T /F`, { stdio: 'ignore' }); } catch { /* ok */ } } else dev.kill();
  try { fs.rmSync('.dev.vars'); fs.rmSync('.wrangler-test', { recursive: true, force: true }); } catch { /* ok */ }
}
console.log(fails ? `\n${fails} FEL` : '\nALLT GRÖNT');
process.exit(fails ? 1 : 0);
