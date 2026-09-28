// Service worker för Snabbfilen: EN version i taget, aldrig blandade filer.
//
// Varje släpp stämplar VERSION här (tools/release.mjs). En ny service worker hämtar då
// ALLA spelets filer (listan ligger i version.json) med cache: 'reload' – förbi webb-
// läsarens HTTP-cache – in i ett eget cachelager 'snabbfilen-<version>', tar över och
// slänger äldre lager. Filerna serveras sedan därifrån, så en omladdning ger alltid en
// komplett, konsekvent version. Frågor med ?-parametrar (version.json?ts, CHANGELOG.md?ts)
// går alltid rakt till nätet.
//
// NÖDBROMS: skulle den här filen ställa till det, ersätt innehållet med
//   self.addEventListener('install', () => self.skipWaiting());
//   self.addEventListener('activate', (e) => e.waitUntil(self.registration.unregister()));
// och publicera – alla spelare blir av med den vid nästa besök.
const VERSION = '0.19.0'; // skrivs av tools/release.mjs
const CACHE = 'snabbfilen-' + VERSION;
const abs = (p) => new URL(p, self.location.href).href;

self.addEventListener('install', (e) => e.waitUntil((async () => {
  const c = await caches.open(CACHE);
  let files = ['index.html'];
  try {
    const r = await fetch('version.json?sw=' + Date.now(), { cache: 'no-store' });
    const j = await r.json();
    if (Array.isArray(j.files) && j.files.length) files = j.files;
  } catch { /* offline vid installation – fyll på allteftersom */ }
  await Promise.all(files.map(async (f) => {
    try {
      const res = await fetch(new Request(abs(f), { cache: 'reload', credentials: 'same-origin' }));
      if (res.ok) await c.put(abs(f), res);
    } catch { /* hoppa över, hämtas vid behov */ }
  }));
  await self.skipWaiting();
})()));

self.addEventListener('activate', (e) => e.waitUntil((async () => {
  for (const key of await caches.keys()) if (key !== CACHE) await caches.delete(key);
  await self.clients.claim();
})()));

self.addEventListener('message', (e) => {
  if (e.data?.t === 'version') e.ports?.[0]?.postMessage({ version: VERSION });
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // PeerJS, typsnitt m.m. går webbläsarens vanliga väg
  const key = url.origin + url.pathname;
  e.respondWith((async () => {
    const c = await caches.open(CACHE);
    // uttryckligt färskt (cache: 'reload') eller en fråga med parametrar → nätet
    if (req.cache === 'reload' || (url.search && req.mode !== 'navigate')) {
      try {
        const res = await fetch(new Request(url.href, { cache: req.cache === 'reload' ? 'reload' : 'no-store', credentials: 'same-origin' }));
        if (res.ok && req.cache === 'reload') e.waitUntil(c.put(key, res.clone()).catch(() => {}));
        return res;
      } catch (err) {
        const hit = await c.match(key);
        if (hit) return hit;
        throw err;
      }
    }
    const hit = await c.match(key);
    if (hit) return hit;
    try {
      const res = await fetch(new Request(url.href, { cache: 'no-cache', credentials: 'same-origin' }));
      // en navigering får inte besvaras med ett omdirigerat svar (t.ex. /snabbfilen → /snabbfilen/)
      if (res.redirected && req.mode === 'navigate') return Response.redirect(res.url, 302);
      if (res.ok) e.waitUntil(c.put(key, res.clone()).catch(() => {}));
      return res;
    } catch (err) {
      if (req.mode === 'navigate') { const idx = await c.match(abs('index.html')); if (idx) return idx; }
      throw err;
    }
  })());
});
