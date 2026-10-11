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
} catch (e) {
  ok(false, String(e.message || e));
} finally {
  dev.kill(); apns.close();
  try { fs.rmSync('.dev.vars'); fs.rmSync('.wrangler-test', { recursive: true, force: true }); } catch { /* ok */ }
}
console.log(fails ? `\n${fails} FEL` : '\nALLT GRÖNT');
process.exit(fails ? 1 : 0);
