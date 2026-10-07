// De fasta texterna i index.html (titeln, mätarnas förklaringar, möblera-panelen, vänd-mobilen-rutan)
// på det valda språket. Laddas från index.html före version-ui.js och main.js. Svenska = inget ändras.
import { $t, LANG } from './i18n.js';

if (LANG !== 'sv' && typeof document !== 'undefined') {
  const set = (sel, prop, text) => { const el = document.querySelector(sel); if (el) el[prop] = text; };
  document.title = $t('Snabbfilen');
  set('meta[name="description"]', 'content', $t('Livet i Pixelstaden: jobba, käka, klä dig snyggt och spara till drömhuset.'));
  const titles = [
    ['.meter:nth-of-type(1)', $t('Mätthet')], ['.meter:nth-of-type(2)', $t('Energi')], ['.meter:nth-of-type(3)', $t('Lycka')],
    ['#hud-friends', $t('Vilka är online? Åk och hälsa på!')], ['#hud-diary', $t('Din resa – vad du har gjort')], ['#hud-mute', $t('Ljud av/på')],
    ['#decor-btn', $t('Möblera ditt hem')], ['#decor-paint', $t('Välj en möbel först')], ['#decor-rotate', $t('Vrid möbeln du håller i (tangent R)')],
    ['#decor-store', $t('Lägg möbeln i förrådet – så kan den flytta till ett annat rum')],
  ];
  for (const [sel, t] of titles) set(sel, 'title', t);
  const texts = [
    ['#decor-btn', $t('🛋️ Möblera')], ['.dp-head', $t('📦 Förrådet')], ['#decor-paint', $t('🎨 Färg')], ['#decor-rotate', $t('🔄 Rotera')],
    ['#decor-store', $t('📦 Förråd')], ['#decor-sell', $t('Sälj')], ['.rot-box b', $t('Vänd på mobilen!')],
    ['.rot-box p', $t('Snabbfilen spelas liggande – då fylls hela skärmen med Pixelstaden.')], ['#rotate-anyway', $t('Spela stående ändå')],
  ];
  for (const [sel, t] of texts) set(sel, 'textContent', t);
}
