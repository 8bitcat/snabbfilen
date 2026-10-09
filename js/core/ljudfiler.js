// Var ljudfilerna ligger (assets/audio: musiken och de inspelade ljuden, ≈ 14 MB).
//
// Ljudet följer inte med spelpaketen till appen: tools/release.mjs håller assets/audio utanför
// version.json, så att varje uppdatering av appen bara blir några MB. På webben hämtas filerna ändå lat
// från sidan, men appen (Capacitor) kör spelet ur sitt inbyggda paket där de saknas – därför var appen
// tyst (Carl 2026-10-09: "de ljuden vi la in är inte med i appen?"). I appen hämtas de i stället från
// webben (GitHub Pages skickar Access-Control-Allow-Origin: *, så fetch + decodeAudioData fungerar),
// en fil i taget när den behövs, och webbvyn cachar dem. Utan nät är appen tyst som förut.
const APP = (() => { try { return !!window.Capacitor?.isNativePlatform?.(); } catch { return false; } })();
export const WEBB_LJUD = 'https://8bitcat.github.io/snabbfilen/assets/audio/';
export const AUDIO_BASE = APP ? WEBB_LJUD : (() => { try { return new URL('../../assets/audio/', import.meta.url).href; } catch { return 'assets/audio/'; } })();
