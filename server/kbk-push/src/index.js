// ⚽ PIXELCITY KBK-PUSH – Carl 2026-10-11: "XXX har precis hoppat in i Pixelcity, så alla KBK-spelare kan få en
// notis." En liten Cloudflare Worker: lagets telefoner (appen 1.2+) registrerar sig, och när en KBK-spelare startar
// spelet skickas en pushnotis via Apple (APNs) till lagets ANDRA telefoner – även när appen är stängd.
//
//   POST /registrera   {token, nr, namn, lang}  telefonens pushkod; förnamn + nummer stäms av mot laget
//   POST /avregistrera {token}                  "Inte jag – ta bort" i KBK-appen
//   POST /inne         {nr, namn, token?}       en KBK-spelare har hoppat in → notis till de andra
//                                               (samma nummer högst var 30:e minut – omladdningar spammar inte)
//   GET  /                                      "ok" och hur många telefoner som är med (inga namn)
//
// Lagras i KV (bindningen KBK): tok:<pushkod> med {nr, lang} som metadata, inne:<nr> = spärren (30 min).
// Inget annat: inga namn utöver lagets förnamn, som redan står i spelet. Laget kommer ur spelets egen fil.
//
// 💛 VÄNNER (Carl 2026-10-12: "så man kan bli vänner … och att man får notiser när en vän spelar"). Man blir vänner
// i spelet (båda är i Pixelstaden och den andra säger ja). Varje figur har ett slumpat vän-id (vid, 16 hex) och en
// hemlig nyckel (32 hex) som bara finns i telefonen/webbläsaren – servern sparar bara nyckelns SHA-256.
//   POST /van/registrera   {vid, hemlig, namn, token, lang}  telefonens pushkod för figuren
//   POST /van/avregistrera {vid, hemlig, token}
//   POST /van/vanner       {vid, hemlig, namn, vanner: [vid]} figurens hela vänlista (högst 100)
//   POST /van/inne         {vid, hemlig, namn}                 figuren har hoppat in → notis till vännernas telefoner
//   POST /van/present     {vid, hemlig, namn, till, fri, gavor} 🎁 vänskapspresent → vännens brevlåda + pushnotis
//   POST /van/hamta       {vid, hemlig}                       brevlådan: presenterna som väntar
//   POST /van/kvittera    {vid, hemlig, ids}                  presenterna är hämtade – töm dem ur brevlådan
// (presenterna: bara mellan vänner åt båda hållen; en gratis vänskapspresent per vän och dag, högst tre presenter per
//  vän och dag, högst 500 kr och tre saker i en present, högst 30 presenter i en brevlåda; brevlådan är EN nyckel
//  vb:<vid> så att hämtningen är en enda läsning – KV:s listningar är dyra)
// En notis går bara till vänner åt BÅDA hållen (stod jag på någons lista utan att hen står på min får hen inget),
// aldrig till telefoner där figuren själv är registrerad, och samma figur högst var 30:e minut.
// KV: vh:<vid> = {h: hemlighetens sha256, n: namnet}, vl:<vid> = vänlistan, vp:<vid>:<pushkod> (metadata {lang}),
// vi:<vid> = spärren, vb:<vid> = brevlådan, vf:<från>:<till>:<dag> = dagens presenter till vännen (räknare).
// Namnet är figurens namn i spelet (högst 16 tecken) – det står i notisen.
//
// 🗽 STATYN I PARKEN (Carl 2026-10-12: "statyn i parken – veckans vinnare"): veckans SNÄLLASTE får en staty mitt i
// stadsparken i en vecka. Varje vänskapspresent som går fram (POST /van/present) räknas för den som skickar den
// under veckan (vecka = ISO-vecka i UTC). Med presenten skickas figurens utseende (look) – det sparas bara för
// statyn och bara i två veckor.
//   GET  /staty   {forra: {namn, look, n, vecka} | null, nu: {namn, n} | null}  förra veckans vinnare + veckans ledare
// KV: vs:<vecka>:<vid> = utseendet, metadata {n, namn, t} (t = när räkningen senast ökade: lika många → den som kom
// först dit vinner); vstaty:<vecka> = förra veckans uträknade vinnare (sparas), vstatynu:<vecka> = ledaren (10 min).
//
// 💬 SMS MELLAN VÄNNER (Carl 2026-10-13: "skicka sms till sina kompisar via mobiltelefonen i spelet"): bara mellan vänner
// åt BÅDA hållen, högst 120 tecken, utan länkar, e-postadresser och telefonnummer (servern stryker dem – spelet
// filtrerar dessutom fula ord innan det skickas och när det visas). Högst 40 meddelanden om dagen till samma vän och
// 150 totalt. Meddelandet ligger i vännens brevlåda tills det hämtas (högst 50, raderas efter 14 dagar) + pushnotis.
//   POST /van/sms         {vid, hemlig, namn, till, text}   → { ok, id }
//   POST /van/sms/hamta   {vid, hemlig}                     → { ok, sms: [{ id, fran, fvid, text, t }] }
//   POST /van/sms/kvittera {vid, hemlig, ids}
// KV: vm:<vid> = brevlådan (en nyckel), vmt:<från>:<dag> = dagens räknare { n, p: { [till]: n } } – två skrivningar per
// meddelande (brevlådan + räknaren) och en när mottagaren kvitterar, så att gratiskvoten räcker länge.
// Notiserna från samma vän ersätter varandra på telefonen (apns-collapse-id), så att en pratig vän inte fyller den.
// 🐾 djurNET MELLAN VÄNNER (Carl 2026-10-13: "man ska kunna köpa och sälja djur, appen ska heta djurNET"): man lägger ut
// ett eget djur (högst tre annonser) och vänner åt BÅDA hållen ser annonsen i djurNET och kan köpa djuret. Djuret
// skickas som en liten beskrivning (art, ras, namn, ålder, stadium, rosetter … – inga platser, inget annat) och flyttar
// in hos köparen; säljaren får pengarna när spelet hämtar beskedet (och en pushnotis). Pengarna går från köparen till
// säljaren – inget skapas.
//   POST /djur/annons  {vid, hemlig, namn, id, pris, snap}   lägg ut (eller ersätt) en annons → da:<vid> (7 dagar)
//   POST /djur/tabort  {vid, hemlig, id}                     → { ok, fanns } (fanns = false: redan såld eller borta)
//   POST /djur/lista   {vid, hemlig}                         → { ok, vanner: [{ vid, namn, annonser: [{id, pris, snap}] }] }
//   POST /djur/kop     {vid, hemlig, namn, saljare, id, pris} → { ok, snap } – annonsen tas bort, beskedet läggs i
//                                                            säljarens låda ds:<säljare> + pushnotis (409 = såld/nytt pris)
//   POST /djur/salda   {vid, hemlig}                         → { ok, salda: [{ id, kopare, kvid, pris, namn, t }] }
//   POST /djur/kvittera {vid, hemlig, ids}
// Djurets namn tvättas här (inga styrtecken, högst 16 tecken) och spelet filtrerar fula ord när det visas.
// Hemligheten APNS_KEY (Apples .p8) ligger bara i Cloudflare. Vanliga variabler: APNS_KEY_ID, TEAM_ID, TOPIC,
// APNS_HOST (bara för test – annars Apples riktiga adress).
import { KUNGS_PLAYERS } from '../../../js/data/kbk.js';

const SPARR_S = 30 * 60;
const TEXT = {
  sv: (n) => `⚽ ${n} har precis hoppat in i Pixelcity!`,
  en: (n) => `⚽ ${n} just jumped into Pixelcity!`,
  es: (n) => `⚽ ¡${n} acaba de entrar en Pixelcity!`,
  de: (n) => `⚽ ${n} ist gerade in Pixelcity reingesprungen!`,
  fr: (n) => `⚽ ${n} vient d'arriver dans Pixelcity !`,
  pl: (n) => `⚽ ${n} właśnie wskoczyła do Pixelcity!`,
  it: (n) => `⚽ ${n} è appena entrata in Pixelcity!`,
  pt: (n) => `⚽ ${n} acabou de entrar no Pixelcity!`,
};
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET, POST, OPTIONS', 'access-control-allow-headers': 'content-type' };
const svar = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', ...CORS } });
const enkel = (s) => String(s ?? '').normalize('NFC').trim().toLocaleLowerCase('sv');
// förnamn + nummer måste stämma med laget → [nr, namn] eller null
export function spelare(nr, namn) {
  const n = parseInt(String(nr ?? '').replace(/\D+/g, ''), 10);
  const p = KUNGS_PLAYERS.find(([x]) => x === n);
  return p && enkel(p[1]) === enkel(namn) ? p : null;
}
const TOKEN_RE = /^[0-9a-f]{64,200}$/i;
const VID_RE = /^[0-9a-f]{16}$/, HEM_RE = /^[0-9a-f]{32}$/;
// (rubriken säger att det är en vän – meningen är könsneutral på alla språk)
const VTEXT = {
  sv: { t: 'Vänner', b: (n) => `💛 Din vän ${n} har precis hoppat in i Pixelcity!` },
  en: { t: 'Friends', b: (n) => `💛 Your friend ${n} just jumped into Pixelcity!` },
  es: { t: 'Amigos', b: (n) => `💛 ¡${n} acaba de entrar en Pixelcity!` },
  de: { t: 'Freunde', b: (n) => `💛 ${n} ist gerade in Pixelcity reingesprungen!` },
  fr: { t: 'Amis', b: (n) => `💛 ${n} vient d'arriver dans Pixelcity !` },
  pl: { t: 'Przyjaciele', b: (n) => `💛 ${n} jest teraz w Pixelcity!` },
  it: { t: 'Amici', b: (n) => `💛 ${n} è ora in Pixelcity!` },
  pt: { t: 'Amigos', b: (n) => `💛 ${n} acabou de entrar no Pixelcity!` },
};
const PTEXT = {
  sv: (n) => `🎁 ${n} har skickat en present till dig!`, en: (n) => `🎁 ${n} sent you a present!`, es: (n) => `🎁 ¡${n} te ha enviado un regalo!`,
  de: (n) => `🎁 ${n} hat dir ein Geschenk geschickt!`, fr: (n) => `🎁 ${n} t'a envoyé un cadeau !`, pl: (n) => `🎁 ${n} wysyła ci prezent!`,
  it: (n) => `🎁 ${n} ti ha mandato un regalo!`, pt: (n) => `🎁 ${n} enviou-te um presente!`,
};
// 🐾 djurNET: djuret som flyttar – bara rimliga fält och värden följer med
const ARTER = new Set(['katt', 'hund', 'kanin']), RAS_RE = /^[a-z]{2,16}$/, ANNONS_RE = /^[a-z0-9]{2,24}$/;
export function renSnap(s) {
  if (!s || typeof s !== 'object' || !ARTER.has(s.species) || !RAS_RE.test(String(s.breed || ''))) return null;
  const tal = (v, a, b) => Math.max(a, Math.min(b, Math.round(+v || 0)));
  const ut = { name: namnRen(s.name), species: s.species, breed: String(s.breed), sex: s.sex === 'hona' ? 'hona' : 'hane', alder: tal(s.alder, 0, 3650),
    stage: ['unge', 'ung', 'vuxen'].includes(s.stage) ? s.stage : 'ung', grow: tal(s.grow, 0, 600), happy: tal(s.happy, 0, 100), seed: tal(s.seed, 0, 1e7) };
  if (Array.isArray(s.mix) && s.mix.length === 2 && s.mix.every((r) => RAS_RE.test(String(r)))) ut.mix = s.mix.map(String);
  if (RAS_RE.test(String(s.breed2 || ''))) ut.breed2 = String(s.breed2);
  if (s.utst && typeof s.utst === 'object') {
    const u = {};
    for (const k of ['katt', 'hund', 'kanin', 'agility']) if (Array.isArray(s.utst[k])) u[k] = s.utst[k].slice(0, 3).map((n) => tal(n, 0, 9999));
    if (s.utst.bis) u.bis = tal(s.utst.bis, 0, 9999);
    if (Object.keys(u).length) ut.utst = u;
  }
  if (s.agil) ut.agil = tal(s.agil, 0, 20);
  if (s.frisyr && typeof s.frisyr === 'object') { const j = JSON.stringify(s.frisyr); if (j.length <= 200 && !/[<>]/.test(j)) ut.frisyr = JSON.parse(j); }
  return ut;
}
const DTEXT = {
  sv: (k, n, p) => `🐾 ${k} köpte ${n} för ${p} kr på djurNET!`, en: (k, n, p) => `🐾 ${k} bought ${n} for ${p} kr on djurNET!`,
  es: (k, n, p) => `🐾 ¡${k} ha comprado a ${n} por ${p} kr en djurNET!`, de: (k, n, p) => `🐾 ${k} hat ${n} für ${p} kr auf djurNET gekauft!`,
  fr: (k, n, p) => `🐾 ${k} a acheté ${n} pour ${p} kr sur djurNET !`, pl: (k, n, p) => `🐾 ${k} kupuje ${n} za ${p} kr na djurNET!`,
  it: (k, n, p) => `🐾 ${k} ha comprato ${n} per ${p} kr su djurNET!`, pt: (k, n, p) => `🐾 ${k} comprou ${n} por ${p} kr no djurNET!`,
};
const SLAG = new Set(['pengar', 'plagg', 'mobel', 'djur', 'mat', 'kort']), SAK_RE = /^[A-Za-z0-9_-]{1,32}$/;
// en gåva som servern godtar (spelet kontrollerar själv att saken finns när presenten öppnas)
function renGava(g) {
  if (!g || typeof g !== 'object' || !SLAG.has(g.slag)) return null;
  if (g.slag === 'pengar') { const n = Math.round(+g.n); return n > 0 && n <= 500 ? { slag: 'pengar', n } : null; }
  if (g.slag === 'mobel') return SAK_RE.test(String(g.k || '')) ? { slag: 'mobel', k: String(g.k), v: Math.max(0, Math.min(40, Math.round(+g.v || 0))) } : null;
  if (g.slag === 'mat') { const n = Math.round(+g.n || 1); return SAK_RE.test(String(g.id || '')) && n >= 1 && n <= 5 ? { slag: 'mat', id: String(g.id), n } : null; }
  if (g.slag === 'plagg') return SAK_RE.test(String(g.id || '')) ? { slag: 'plagg', id: String(g.id) } : null;
  if (g.slag === 'kort') return SAK_RE.test(String(g.id || '')) ? { slag: 'kort', id: String(g.id) } : null;   // 🃏 ett pixelkort (byteshandel)
  return SAK_RE.test(String(g.k || '')) ? { slag: 'djur', k: String(g.k) } : null;
}
const idag = () => new Date().toISOString().slice(0, 10);
// 💬 ett SMS: högst 120 tecken, inga styrtecken, inga länkar/e-post/telefonnummer (barn ska inte lämna ut kontaktuppgifter)
export function renSms(t) {
  let s = String(t ?? '').normalize('NFC').replace(/[\u0000-\u001f\u007f<>]/g, ' ').replace(/\s+/g, ' ').trim();
  s = s.replace(/\b(?:https?:\/\/|www\.)\S+/gi, '***').replace(/\b\S+\.(?:com|se|net|org|io|nu|app|gg|tv|me|co)\b\S*/gi, '***');
  s = s.replace(/\S+@\S+/g, '***').replace(/\+?\d(?:[\s-]?\d){5,}/g, '***');   // (minst sex siffror – mellanslaget efter numret står kvar)
  return [...s].slice(0, 120).join('');
}
const STEXT = { sv: (n, t) => `💬 ${n}: ${t}` };
// ISO-veckan (UTC) som "2026-W42"; forra = veckan innan
export function vecka(t = Date.now(), forra = false) {
  const d = new Date(t - (forra ? 7 * 864e5 : 0)), dag = (d.getUTCDay() + 6) % 7;
  const tor = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - dag + 3));
  const ar = tor.getUTCFullYear(), forsta = new Date(Date.UTC(ar, 0, 4));
  const v = 1 + Math.round(((tor - forsta) / 864e5 - 3 + ((forsta.getUTCDay() + 6) % 7)) / 7);
  return `${ar}-W${String(v).padStart(2, '0')}`;
}
// figurens utseende för statyn: bara korta strängar, tal och sant/falskt under enkla nycklar
export function renLook(l) {
  if (!l || typeof l !== 'object' || Array.isArray(l)) return null;
  const ut = {};
  for (const [k, v] of Object.entries(l).slice(0, 80)) {
    if (!/^[A-Za-z0-9]{1,16}$/.test(k)) continue;
    if (typeof v === 'string' && v.length <= 24 && !/[<>\u0000-\u001f]/.test(v)) ut[k] = v;
    else if (typeof v === 'number' && Number.isFinite(v)) ut[k] = v;
    else if (typeof v === 'boolean' || v === null) ut[k] = v;
  }
  return JSON.stringify(ut).length <= 2000 ? ut : null;
}
export async function raknaPresent(env, vid, namn, look, t = Date.now()) {
  const k = `vs:${vecka(t)}:${vid}`, gammal = await env.KBK.getWithMetadata(k, 'json');
  const n = (gammal.metadata?.n | 0) + 1;
  await env.KBK.put(k, JSON.stringify(renLook(look) || gammal.value || {}), { metadata: { n, namn, t }, expirationTtl: 60 * 60 * 24 * 15 });
}
// veckans topplista ur räkningen: flest presenter, och vid lika den som kom dit först
async function etta(env, v) {
  let bast = null;
  for (const k of await lista(env, `vs:${v}:`)) {
    const m = k.metadata || {};
    if (!bast || (m.n | 0) > bast.n || ((m.n | 0) === bast.n && (m.t || 0) < bast.t)) bast = { key: k.name, n: m.n | 0, namn: m.namn || '?', t: m.t || 0 };
  }
  return bast && bast.n > 0 ? bast : null;
}
export async function staty(env, t = Date.now()) {
  const fv = vecka(t, true), nv = vecka(t);
  let forra = await env.KBK.get(`vstaty:${fv}`, 'json');
  if (!forra) {
    const b = await etta(env, fv);
    forra = b ? { namn: b.namn, n: b.n, vecka: fv, look: (await env.KBK.get(b.key, 'json')) || {} } : { tom: true, vecka: fv };
    await env.KBK.put(`vstaty:${fv}`, JSON.stringify(forra), { expirationTtl: 60 * 60 * 24 * 40 });
  }
  let nu = await env.KBK.get(`vstatynu:${nv}`, 'json');
  if (!nu) { const b = await etta(env, nv); nu = b ? { namn: b.namn, n: b.n } : { tom: true }; await env.KBK.put(`vstatynu:${nv}`, JSON.stringify(nu), { expirationTtl: 600 }); }
  return { forra: forra.tom ? null : forra, nu: nu.tom ? null : nu };
}
const namnRen = (v) => String(v ?? '').normalize('NFC').replace(/[\u0000-\u001f\u007f<>]/g, '').trim().slice(0, 16) || '?';
const sha = async (t) => b64u(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(t))));
// vid + hemlig stämmer? Första gången tar figuren sitt vid (sparar hemlighetens sha256). Namnet uppdateras när det ändrats.
async function vanAuth(env, d) {
  const vid = String(d.vid || ''), hem = String(d.hemlig || '');
  if (!VID_RE.test(vid) || !HEM_RE.test(hem)) return null;
  const h = await sha(hem), namn = d.namn !== undefined ? namnRen(d.namn) : null;
  const rad = await env.KBK.get(`vh:${vid}`, 'json');
  if (rad && rad.h !== h) return null;
  if (!rad || (namn && rad.n !== namn)) await env.KBK.put(`vh:${vid}`, JSON.stringify({ h, n: namn || rad?.n || '?' }));
  return { vid, namn: namn || rad?.n || '?' };
}
async function lista(env, prefix) {
  const ut = []; let cursor;
  do { const sida = await env.KBK.list({ prefix, cursor }); ut.push(...sida.keys); cursor = sida.list_complete ? null : sida.cursor; } while (cursor);
  return ut;
}

// ---------- Apples token (ES256-JWT, giltig i en timme – vi gör en ny var 50:e minut) ----------
let jwt = null, jwtT = 0;
const b64u = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
async function apnsJwt(env) {
  const now = Math.floor(Date.now() / 1000);
  if (jwt && now - jwtT < 50 * 60) return jwt;
  const pem = String(env.APNS_KEY || '').replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
  const der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey('pkcs8', der, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const enc = (o) => b64u(new TextEncoder().encode(JSON.stringify(o)));
  const huvud = enc({ alg: 'ES256', kid: env.APNS_KEY_ID }), kropp = enc({ iss: env.TEAM_ID, iat: now });
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, new TextEncoder().encode(`${huvud}.${kropp}`));
  jwt = `${huvud}.${kropp}.${b64u(sig)}`; jwtT = now;
  return jwt;
}
async function skicka(env, token, text, { title = 'KBK', glom = `tok:${token}`, grupp = '' } = {}) {
  const host = env.APNS_HOST || 'https://api.push.apple.com';
  const r = await fetch(`${host}/3/device/${token}`, {
    method: 'POST',
    headers: {
      authorization: `bearer ${await apnsJwt(env)}`, 'apns-topic': env.TOPIC || 'io.eightbitcat.pixelcity',
      'apns-push-type': 'alert', 'apns-priority': '10', 'apns-expiration': String(Math.floor(Date.now() / 1000) + 3600),
      'content-type': 'application/json', ...(grupp ? { 'apns-collapse-id': grupp } : {}),
    },
    body: JSON.stringify({ aps: { alert: { title, body: text }, sound: 'default', ...(grupp ? { 'thread-id': grupp } : {}) } }),
  });
  if (r.status !== 200) {
    const fel = await r.json().catch(() => ({}));
    // telefonen finns inte längre (appen borttagen, ny telefon) → glöm pushkoden
    if (r.status === 410 || /BadDeviceToken|DeviceTokenNotForTopic|Unregistered/.test(fel.reason || '')) await env.KBK.delete(glom);
    return { status: r.status, reason: fel.reason || '' };
  }
  return { status: 200 };
}
async function allaTelefoner(env) {
  const ut = []; let cursor;
  do {
    const sida = await env.KBK.list({ prefix: 'tok:', cursor });
    for (const k of sida.keys) ut.push({ token: k.name.slice(4), ...(k.metadata || {}) });
    cursor = sida.list_complete ? null : sida.cursor;
  } while (cursor);
  return ut;
}

export default {
  async fetch(req, env, ctx) {
    if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
    const url = new URL(req.url);
    if (req.method === 'GET' && url.pathname === '/staty') return svar({ ok: true, ...(await staty(env)) });
    if (req.method === 'GET' && url.pathname === '/') return svar({ ok: true, telefoner: (await allaTelefoner(env)).length, vantelefoner: (await lista(env, 'vp:')).length });
    if (req.method !== 'POST') return svar({ ok: false, fel: 'bara POST' }, 405);
    let d = {};
    try { d = await req.json(); } catch { return svar({ ok: false, fel: 'trasig JSON' }, 400); }

    if (url.pathname === '/registrera') {
      const p = spelare(d.nr, d.namn);
      if (!p) return svar({ ok: false, fel: 'stämmer inte med laget' }, 403);
      if (!TOKEN_RE.test(String(d.token || ''))) return svar({ ok: false, fel: 'ogiltig pushkod' }, 400);
      const lang = TEXT[d.lang] ? d.lang : 'sv';
      await env.KBK.put(`tok:${String(d.token).toLowerCase()}`, '1', { metadata: { nr: p[0], lang } });
      return svar({ ok: true, nr: p[0] });
    }
    if (url.pathname === '/avregistrera') {
      if (TOKEN_RE.test(String(d.token || ''))) await env.KBK.delete(`tok:${String(d.token).toLowerCase()}`);
      return svar({ ok: true });
    }
    if (url.pathname === '/inne') {
      const p = spelare(d.nr, d.namn);
      if (!p) return svar({ ok: false, fel: 'stämmer inte med laget' }, 403);
      const [nr, namn] = p;
      if (await env.KBK.get(`inne:${nr}`)) return svar({ ok: true, skickade: 0, sparr: true });
      await env.KBK.put(`inne:${nr}`, '1', { expirationTtl: SPARR_S });
      const egen = String(d.token || '').toLowerCase();
      const till = (await allaTelefoner(env)).filter((t) => t.nr !== nr && t.token !== egen);
      const jobb = Promise.all(till.map((t) => skicka(env, t.token, (TEXT[t.lang] || TEXT.sv)(`${namn} ${nr}`)).catch((e) => ({ status: 0, reason: String(e) }))));
      if (d.vanta) { const res = await jobb; return svar({ ok: true, skickade: till.length, svar: res }); }   // (testerna väntar in svaren)
      ctx.waitUntil(jobb);
      return svar({ ok: true, skickade: till.length });
    }
    // ---------- 💛 vänner ----------
    if (url.pathname.startsWith('/van/')) {
      const jag = await vanAuth(env, d);
      if (!jag) return svar({ ok: false, fel: 'fel nyckel' }, 403);
      const { vid } = jag;
      if (url.pathname === '/van/registrera') {
        if (!TOKEN_RE.test(String(d.token || ''))) return svar({ ok: false, fel: 'ogiltig pushkod' }, 400);
        const k = `vp:${vid}:${String(d.token).toLowerCase()}`, lang = VTEXT[d.lang] ? d.lang : 'sv';
        const fanns = await env.KBK.getWithMetadata(k);
        if (fanns.value === null || fanns.metadata?.lang !== lang) await env.KBK.put(k, '1', { metadata: { lang } });   // (skriver bara när något ändrats)
        return svar({ ok: true });
      }
      if (url.pathname === '/van/avregistrera') {
        if (TOKEN_RE.test(String(d.token || ''))) await env.KBK.delete(`vp:${vid}:${String(d.token).toLowerCase()}`);
        return svar({ ok: true });
      }
      if (url.pathname === '/van/vanner') {
        const ny = [...new Set((Array.isArray(d.vanner) ? d.vanner : []).map(String).filter((v) => VID_RE.test(v) && v !== vid))].slice(0, 100).sort();
        const gammal = (await env.KBK.get(`vl:${vid}`, 'json')) || [];
        if (JSON.stringify(gammal) !== JSON.stringify(ny)) { if (ny.length) await env.KBK.put(`vl:${vid}`, JSON.stringify(ny)); else await env.KBK.delete(`vl:${vid}`); }
        return svar({ ok: true, vanner: ny.length });
      }
      if (url.pathname === '/van/present') {
        const till = String(d.till || '');
        if (!VID_RE.test(till) || till === vid) return svar({ ok: false, fel: 'okänd vän' }, 400);
        const mina = (await env.KBK.get(`vl:${vid}`, 'json')) || [], deras = (await env.KBK.get(`vl:${till}`, 'json')) || [];
        if (!mina.includes(till) || !deras.includes(vid)) return svar({ ok: false, fel: 'inte vänner' }, 403);
        const gavor = (Array.isArray(d.gavor) ? d.gavor : []).map(renGava).filter(Boolean).slice(0, 3);
        const fri = !!d.fri;
        if (!fri && !gavor.length) return svar({ ok: false, fel: 'tom present' }, 400);
        const rk = `vf:${vid}:${till}:${idag()}`, r = (await env.KBK.get(rk, 'json')) || { n: 0, fri: false };
        if (r.n >= 3) return svar({ ok: false, fel: 'max tre presenter om dagen till samma vän' }, 429);
        if (fri && r.fri) return svar({ ok: false, fel: 'dagens vänskapspresent är redan skickad' }, 429);
        const bk = `vb:${till}`, lada = (await env.KBK.get(bk, 'json')) || [];
        if (lada.length >= 30) return svar({ ok: false, fel: 'brevlådan är full' }, 429);
        const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
        lada.push({ id, fran: jag.namn, fvid: vid, fri, gavor, t: Date.now() });
        await env.KBK.put(bk, JSON.stringify(lada), { expirationTtl: 60 * 60 * 24 * 30 });
        await env.KBK.put(rk, JSON.stringify({ n: r.n + 1, fri: r.fri || fri }), { expirationTtl: 60 * 60 * 48 });
        await raknaPresent(env, vid, jag.namn, d.look);   // 🗽 veckans snällaste (statyn i parken)
        // pushnotis till vännens telefoner
        const tel = (await lista(env, `vp:${till}:`)).map((k) => ({ token: k.name.split(':')[2], lang: k.metadata?.lang, glom: k.name }));
        const jobb = Promise.all(tel.map((t) => skicka(env, t.token, (PTEXT[t.lang] || PTEXT.sv)(jag.namn), { title: (VTEXT[t.lang] || VTEXT.sv).t, glom: t.glom }).catch((e) => ({ status: 0, reason: String(e) }))));
        if (d.vanta) { const res = await jobb; return svar({ ok: true, id, skickade: tel.length, svar: res }); }
        ctx.waitUntil(jobb);
        return svar({ ok: true, id, skickade: tel.length });
      }
      if (url.pathname === '/van/sms') {
        const till = String(d.till || '');
        if (!VID_RE.test(till) || till === vid) return svar({ ok: false, fel: 'okänd vän' }, 400);
        const mina = (await env.KBK.get(`vl:${vid}`, 'json')) || [], deras = (await env.KBK.get(`vl:${till}`, 'json')) || [];
        if (!mina.includes(till) || !deras.includes(vid)) return svar({ ok: false, fel: 'inte vänner' }, 403);
        const text = renSms(d.text);
        if (!text) return svar({ ok: false, fel: 'tomt' }, 400);
        const tk = `vmt:${vid}:${idag()}`, rk = await env.KBK.get(tk, 'json');
        const rakn = rk && typeof rk === 'object' && rk.p && typeof rk.p === 'object' ? rk : { n: 0, p: {} };
        if ((rakn.p[till] | 0) >= 40 || (rakn.n | 0) >= 150) return svar({ ok: false, fel: 'för många meddelanden i dag' }, 429);
        const bk = `vm:${till}`, lada = (await env.KBK.get(bk, 'json')) || [];
        const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
        lada.push({ id, fran: jag.namn, fvid: vid, text, t: Date.now() });
        await env.KBK.put(bk, JSON.stringify(lada.slice(-50)), { expirationTtl: 60 * 60 * 24 * 14 });
        rakn.n = (rakn.n | 0) + 1; rakn.p[till] = (rakn.p[till] | 0) + 1;
        await env.KBK.put(tk, JSON.stringify(rakn), { expirationTtl: 60 * 60 * 48 });
        const tel = (await lista(env, `vp:${till}:`)).map((k) => ({ token: k.name.split(':')[2], lang: k.metadata?.lang, glom: k.name }));
        const kort = [...text].length > 80 ? [...text].slice(0, 79).join('') + '…' : text;
        const jobb = Promise.all(tel.map((t) => skicka(env, t.token, (STEXT[t.lang] || STEXT.sv)(jag.namn, kort), { title: (VTEXT[t.lang] || VTEXT.sv).t, glom: t.glom, grupp: `sms-${vid}` }).catch((e) => ({ status: 0, reason: String(e) }))));
        if (d.vanta) { const res = await jobb; return svar({ ok: true, id, text, skickade: tel.length, svar: res }); }
        ctx.waitUntil(jobb);
        return svar({ ok: true, id, text, skickade: tel.length });
      }
      if (url.pathname === '/van/sms/hamta') return svar({ ok: true, sms: (await env.KBK.get(`vm:${vid}`, 'json')) || [] });
      if (url.pathname === '/van/sms/kvittera') {
        const ids = new Set((Array.isArray(d.ids) ? d.ids : []).map(String));
        const bk = `vm:${vid}`, lada = (await env.KBK.get(bk, 'json')) || [], kvar = lada.filter((x) => !ids.has(x.id));
        if (kvar.length !== lada.length) { if (kvar.length) await env.KBK.put(bk, JSON.stringify(kvar), { expirationTtl: 60 * 60 * 24 * 14 }); else await env.KBK.delete(bk); }
        return svar({ ok: true, kvar: kvar.length });
      }
      if (url.pathname === '/van/hamta') return svar({ ok: true, presenter: (await env.KBK.get(`vb:${vid}`, 'json')) || [] });
      if (url.pathname === '/van/kvittera') {
        const ids = new Set((Array.isArray(d.ids) ? d.ids : []).map(String));
        const bk = `vb:${vid}`, lada = (await env.KBK.get(bk, 'json')) || [], kvar = lada.filter((x) => !ids.has(x.id));
        if (kvar.length !== lada.length) { if (kvar.length) await env.KBK.put(bk, JSON.stringify(kvar), { expirationTtl: 60 * 60 * 24 * 30 }); else await env.KBK.delete(bk); }
        return svar({ ok: true, kvar: kvar.length });
      }
      if (url.pathname === '/van/inne') {
        if (await env.KBK.get(`vi:${vid}`)) return svar({ ok: true, skickade: 0, sparr: true });
        await env.KBK.put(`vi:${vid}`, '1', { expirationTtl: SPARR_S });
        const mina = new Set((await lista(env, `vp:${vid}:`)).map((k) => k.name.split(':')[2]));   // (telefoner där jag själv finns)
        const till = [];
        for (const f of (await env.KBK.get(`vl:${vid}`, 'json')) || []) {
          const deras = (await env.KBK.get(`vl:${f}`, 'json')) || [];
          if (!deras.includes(vid)) continue;                                                            // bara vänner åt båda hållen
          for (const k of await lista(env, `vp:${f}:`)) { const token = k.name.split(':')[2]; if (!mina.has(token) && !till.some((t) => t.token === token)) till.push({ token, lang: k.metadata?.lang, glom: k.name }); }
        }
        const jobb = Promise.all(till.map((t) => skicka(env, t.token, (VTEXT[t.lang] || VTEXT.sv).b(jag.namn), { title: (VTEXT[t.lang] || VTEXT.sv).t, glom: t.glom }).catch((e) => ({ status: 0, reason: String(e) }))));
        if (d.vanta) { const res = await jobb; return svar({ ok: true, skickade: till.length, svar: res }); }
        ctx.waitUntil(jobb);
        return svar({ ok: true, skickade: till.length });
      }
    }
    // ---------- 🐾 djurNET: köpa och sälja djur mellan vänner ----------
    if (url.pathname.startsWith('/djur/')) {
      const jag = await vanAuth(env, d);
      if (!jag) return svar({ ok: false, fel: 'fel nyckel' }, 403);
      const { vid } = jag, ak = `da:${vid}`, TTL = 60 * 60 * 24 * 7;
      const vannerAtBada = async (f) => ((await env.KBK.get(`vl:${vid}`, 'json')) || []).includes(f) && ((await env.KBK.get(`vl:${f}`, 'json')) || []).includes(vid);
      if (url.pathname === '/djur/annons') {
        const id = String(d.id || ''), pris = Math.round(+d.pris), snap = renSnap(d.snap);
        if (!ANNONS_RE.test(id) || !(pris >= 1 && pris <= 100000) || !snap) return svar({ ok: false, fel: 'trasig annons' }, 400);
        const ann = ((await env.KBK.get(ak, 'json')) || []).filter((a) => a.id !== id);
        if (ann.length >= 3) return svar({ ok: false, fel: 'högst tre annonser' }, 429);
        ann.push({ id, pris, snap, t: Date.now() });
        await env.KBK.put(ak, JSON.stringify(ann), { expirationTtl: TTL });
        return svar({ ok: true });
      }
      if (url.pathname === '/djur/tabort') {
        const id = String(d.id || ''), ann = (await env.KBK.get(ak, 'json')) || [], kvar = ann.filter((a) => a.id !== id);
        if (kvar.length === ann.length) return svar({ ok: true, fanns: false });
        if (kvar.length) await env.KBK.put(ak, JSON.stringify(kvar), { expirationTtl: TTL }); else await env.KBK.delete(ak);
        return svar({ ok: true, fanns: true });
      }
      if (url.pathname === '/djur/lista') {
        const ut = [];
        for (const f of ((await env.KBK.get(`vl:${vid}`, 'json')) || []).slice(0, 50)) {
          if (!((await env.KBK.get(`vl:${f}`, 'json')) || []).includes(vid)) continue;   // bara vänner åt båda hållen
          const a = (await env.KBK.get(`da:${f}`, 'json')) || [];
          if (!a.length) continue;
          const vh = await env.KBK.get(`vh:${f}`, 'json');
          ut.push({ vid: f, namn: vh?.n || '?', annonser: a.map(({ id, pris, snap }) => ({ id, pris, snap })) });
        }
        return svar({ ok: true, vanner: ut });
      }
      if (url.pathname === '/djur/kop') {
        const saljare = String(d.saljare || ''), id = String(d.id || ''), pris = Math.round(+d.pris);
        if (!VID_RE.test(saljare) || saljare === vid) return svar({ ok: false, fel: 'okänd säljare' }, 400);
        if (!(await vannerAtBada(saljare))) return svar({ ok: false, fel: 'inte vänner' }, 403);
        const sk = `da:${saljare}`, ann = (await env.KBK.get(sk, 'json')) || [], a = ann.find((x) => x.id === id);
        if (!a) return svar({ ok: false, fel: 'redan såld', sald: true }, 409);
        if (a.pris !== pris) return svar({ ok: false, fel: 'nytt pris', pris: a.pris }, 409);
        const kvar = ann.filter((x) => x.id !== id);
        if (kvar.length) await env.KBK.put(sk, JSON.stringify(kvar), { expirationTtl: TTL }); else await env.KBK.delete(sk);
        const bk = `ds:${saljare}`, lada = (await env.KBK.get(bk, 'json')) || [];
        lada.push({ id, kopare: jag.namn, kvid: vid, pris, namn: a.snap.name, t: Date.now() });
        await env.KBK.put(bk, JSON.stringify(lada.slice(-30)), { expirationTtl: 60 * 60 * 24 * 30 });
        const tel = (await lista(env, `vp:${saljare}:`)).map((k) => ({ token: k.name.split(':')[2], lang: k.metadata?.lang, glom: k.name }));
        const jobb = Promise.all(tel.map((t) => skicka(env, t.token, (DTEXT[t.lang] || DTEXT.sv)(jag.namn, a.snap.name, pris), { title: 'djurNET', glom: t.glom }).catch((e) => ({ status: 0, reason: String(e) }))));
        if (d.vanta) { const res = await jobb; return svar({ ok: true, snap: a.snap, pris, skickade: tel.length, svar: res }); }
        ctx.waitUntil(jobb);
        return svar({ ok: true, snap: a.snap, pris, skickade: tel.length });
      }
      if (url.pathname === '/djur/salda') return svar({ ok: true, salda: (await env.KBK.get(`ds:${vid}`, 'json')) || [] });
      if (url.pathname === '/djur/kvittera') {
        const ids = new Set((Array.isArray(d.ids) ? d.ids : []).map(String));
        const bk = `ds:${vid}`, lada = (await env.KBK.get(bk, 'json')) || [], kvar = lada.filter((x) => !ids.has(x.id));
        if (kvar.length !== lada.length) { if (kvar.length) await env.KBK.put(bk, JSON.stringify(kvar), { expirationTtl: 60 * 60 * 24 * 30 }); else await env.KBK.delete(bk); }
        return svar({ ok: true, kvar: kvar.length });
      }
    }
    return svar({ ok: false, fel: 'okänd adress' }, 404);
  },
};
