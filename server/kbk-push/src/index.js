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
async function skicka(env, token, text) {
  const host = env.APNS_HOST || 'https://api.push.apple.com';
  const r = await fetch(`${host}/3/device/${token}`, {
    method: 'POST',
    headers: {
      authorization: `bearer ${await apnsJwt(env)}`, 'apns-topic': env.TOPIC || 'io.eightbitcat.pixelcity',
      'apns-push-type': 'alert', 'apns-priority': '10', 'apns-expiration': String(Math.floor(Date.now() / 1000) + 3600),
      'content-type': 'application/json',
    },
    body: JSON.stringify({ aps: { alert: { title: 'KBK', body: text }, sound: 'default' } }),
  });
  if (r.status !== 200) {
    const fel = await r.json().catch(() => ({}));
    // telefonen finns inte längre (appen borttagen, ny telefon) → glöm pushkoden
    if (r.status === 410 || /BadDeviceToken|DeviceTokenNotForTopic|Unregistered/.test(fel.reason || '')) await env.KBK.delete(`tok:${token}`);
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
    if (req.method === 'GET' && url.pathname === '/') return svar({ ok: true, telefoner: (await allaTelefoner(env)).length });
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
    return svar({ ok: false, fel: 'okänd adress' }, 404);
  },
};
