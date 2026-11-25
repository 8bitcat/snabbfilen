// ⭐ BETYGSFRÅGAN (v0.179, Carl 2026-11-25: "gör alla förslagen" – betygsfrågan vid glada ögonblick, så att
// Pixelcity får fler betyg i App Store). Apples egen ruta "Gillar du Pixelcity?" (SKStoreReviewController via
// @capacitor-community/in-app-review, appen 1.5+) visas bara i ett glatt ögonblick:
//   • 'lon'   – ett nytt rekord på jobbet (lönebeskedet i js/jobs/shift.js)
//   • 'fest'  – festpresenten på lördagsfesten (js/city/fest.js)
//   • 'dock'  – efter minst två minuters lek ihop med en vän i Dockskåpet (js/scenes/dockskap.js)
// Aldrig för en helt ny spelare (minst tre speldagar eller tre glada ögonblick), högst var 120:e dag, och Apple själv
// visar rutan högst tre gånger om året. På webben och i äldre appar (utan tillägget) händer ingenting.
const NYCKEL = 'snabbfilen_betyg';   // { senast: ms, n: antal frågor, glada: antal glada ögonblick }
const DAGAR = 120;
const las = () => { try { const v = JSON.parse(localStorage.getItem(NYCKEL) || '{}'); return v && typeof v === 'object' ? v : {}; } catch { return {}; } };
const spara = (v) => { try { localStorage.setItem(NYCKEL, JSON.stringify(v)); } catch { /* ok */ } };
const plugin = () => { try { const C = window.Capacitor; return C?.isNativePlatform?.() ? C.Plugins?.InAppReview || null : null; } catch { return null; } };
export const betygLage = () => las();   // (testerna)

// Ett glatt ögonblick: räknas alltid, och frågar Apple om rutan när villkoren är uppfyllda. Svarar true om frågan ställdes.
export function betygOgonblick(orsak, { fordrojning = 1800 } = {}) {
  const s = las();
  s.glada = (s.glada | 0) + 1;
  spara(s);
  const P = plugin() || (typeof window !== 'undefined' ? window.__betygTest : null);   // (__betygTest: testerna)
  if (!P?.requestReview) return false;
  const dag = window.SF?.game?.day | 0;
  if (dag < 3 && s.glada < 3) return false;                                 // inte för en helt ny spelare
  if (s.senast && Date.now() - s.senast < DAGAR * 864e5) return false;      // högst var 120:e dag
  s.senast = Date.now(); s.n = (s.n | 0) + 1; s.orsak = String(orsak || '').slice(0, 12);
  spara(s);
  setTimeout(() => { try { P.requestReview()?.catch?.(() => {}); } catch { /* ok */ } }, fordrojning);
  return true;
}
