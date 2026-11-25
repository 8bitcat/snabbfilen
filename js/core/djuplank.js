// 🔗 DJUPLÄNKAR (v0.181, appen 1.5+): pixelcity://… öppnar appen på rätt ställe – App Store-händelserna
// (app/tools/asc-event.mjs) kräver en länk. Länkarna:
//   pixelcity://dockskap            Dockskåpet
//   pixelcity://dockskap/rymd       Dockskåpet, Rymdstationen (låst rum visar vad som ingår)
//   pixelcity://dockskap/jul        Dockskåpet, vardagsrummet
// Capacitors App-tillägg (@capacitor/app): 'appUrlOpen' när appen redan kör, getLaunchUrl() när länken startade den.
// På webben fungerar samma sak med ?lank=dockskap/rymd i adressen (och testerna använder djuplankOppna direkt).
const plugin = () => { try { const C = window.Capacitor; return C?.isNativePlatform?.() ? C.Plugins?.App || null : null; } catch { return null; } };
const RUMMEN = { rymd: 'rymd', jul: 'vardagsrum' };

export function djuplankOppna(A, url) {
  const m = /^(?:pixelcity:\/\/|\/?)([a-z]+)(?:\/([a-z]+))?/i.exec(String(url || '').trim());
  if (!m || m[1].toLowerCase() !== 'dockskap' || !A?.openDockskap) return false;
  const rum = RUMMEN[(m[2] || '').toLowerCase()] || null;
  A.dockRum = rum;   // (dockskap.js enter: går till rummet)
  try { import('./menu.js').then((x) => x.close?.()).catch(() => {}); } catch { /* ok */ }
  if (A.sceneName === 'dockskap') A.scene?.gaTillRum?.(rum);
  else A.openDockskap();
  return true;
}
export function djuplankInit(A) {
  const P = plugin();
  if (P) {
    try { P.addListener('appUrlOpen', (e) => setTimeout(() => djuplankOppna(A, e?.url), 400))?.catch?.(() => {}); } catch { /* ok */ }
    try { P.getLaunchUrl?.().then((r) => { if (r?.url) setTimeout(() => djuplankOppna(A, r.url), 1200); }).catch(() => {}); } catch { /* ok */ }
  }
  try { const l = new URLSearchParams(location.search).get('lank'); if (l) setTimeout(() => djuplankOppna(A, l), 1200); } catch { /* ok */ }
}
