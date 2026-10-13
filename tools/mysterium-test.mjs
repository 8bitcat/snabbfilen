// Regressionstest för 🕵️ MYSTERIET "Kattstatyns krona" (js/core/mysterium.js, mysterium-art.js, foto.js efterFoto):
//   • 🔍 Mysteriet i mobilen (NY), anteckningsboken visar kapitel 1
//   • kapitel 1 i Tassbacken: Gunnel berättar av sig själv → 🔍 letaspelet (ett falskt spår → "Bara …", ledtråden →
//     fjädern) → frågan (fel svar → prova igen, rätt svar) → "Kapitel 1 klart!" + 100 kr; nästa kapitel i morgon
//   • en ny dag: kapitel 2 väntar igen
//   • kapitel 6: ett foto i Parken med 📷 Kamera visar boet → frågan → klart
//   • kapitel 7: Nova ger glitterknappen, bytet med skatan i Parken, Gunnel får kronan → mysteriet löst: 1 000 kr och
//     meriten 🕵️ Mästerdetektiv; allt finns kvar efter omladdning
// Kör: node tools/mysterium-test.mjs   (servern på 8788, eller SMOKE_PORT / PORT) · SHOTS=1 sparar bilder i tools/out/
import { createRequire } from 'module';
const require = createRequire('D:/Qisy/QISYFrontend/QISYFrontend-1/package.json');
const { chromium } = require('playwright');

const PORT = process.env.SMOKE_PORT || process.env.PORT || 8788, SHOTS = !!process.env.SHOTS;
let fails = 0;
const ok = (c, m) => { console.log((c ? 'ok: ' : 'FEL: ') + m); if (!c) fails++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await chromium.launch();
const errs = [];
const p = await (await browser.newContext({ viewport: { width: 1200, height: 760 } })).newPage();
p.on('pageerror', (e) => errs.push(e.message));
await p.addInitScript(() => { window.__toasts = []; new MutationObserver((ms) => { for (const m of ms) for (const n of m.addedNodes) if (n.classList?.contains('toast')) window.__toasts.push(n.textContent); }).observe(document, { childList: true, subtree: true }); });
await p.goto(`http://localhost:${PORT}/index.html?nomenu&world=myst${Date.now().toString(36)}`);
await p.evaluate(() => {
  localStorage.clear(); localStorage.setItem('snabbfilen_tips_hus', '1'); localStorage.setItem('snabbfilen_startguide_erbjuden', '1');
  localStorage.setItem('snabbfilen_avatar', JSON.stringify({ id: 'id-det', name: 'Detektiven', look: { skin: '#e0a97f', hair: '#3b2619', style: 'short' }, color: '#ffd23f' }));
  localStorage.setItem('snabbfilen_save1', JSON.stringify({ v: 1, day: 4, min: 11 * 60, money: 1000, hunger: 90, energy: 100, home: 'husvagn', fridge: {}, jobs: {}, earned: 0, mal: { id: 'rik', niva: 'latt' }, presenter: { dag: '2999-01-01-k', antal: 0, ko: [] } }));
  indexedDB.deleteDatabase('snabbfilen-foton');
});
await p.reload().catch(() => {});
await p.waitForFunction(() => !!window.SF?.game, null, { timeout: 30000 });
await sleep(1200);
const D = (fn, a) => p.evaluate(fn, a);
const stang = () => D(() => { const m = document.querySelector('#modal'); m.classList.add('hidden'); m.innerHTML = ''; });
const rubrik = () => D(() => document.querySelector('#modal:not(.hidden) .dlg-head h2')?.textContent || '');
const knapp = (re) => D((re) => { const b = [...document.querySelectorAll('#modal:not(.hidden) .dlg-foot .btn')].find((x) => new RegExp(re).test(x.textContent)); if (b) b.click(); return !!b; }, re);
const vanta = (re, ms = 8000) => p.waitForFunction((re) => new RegExp(re).test(document.querySelector('#modal:not(.hidden) .dlg-head h2')?.textContent || ''), re, { timeout: ms }).then(() => true).catch(() => false);
const M = () => D(() => JSON.parse(JSON.stringify(SF.game.mysterium)));
await stang();
await D(() => SF.go('city')); await sleep(800); await stang();

// ---- mobilen ----
await p.click('#hud-mobil'); await sleep(500);
ok(await D(() => !!document.querySelector('#mobilen [data-app="mysterium"] img.pix-ik') && document.querySelector('#mobilen [data-badge="mysterium"]')?.textContent === 'NY'), '🔍 Mysteriet i mobilen med NY');
await p.click('#mobilen [data-app="mysterium"]'); await sleep(400);
ok(/Kattstatyns krona/.test(await rubrik()) && await D(() => /prata med parkvakten Gunnel/.test(document.querySelector('#modal .my-nu')?.textContent || '')), 'anteckningsboken: kapitel 1 – prata med Gunnel i Tassbacken');
if (SHOTS) await p.screenshot({ path: 'tools/out/mysterium-bok.png' });
await stang();

// ---- kapitel 1 ----
const pengar0 = await D(() => SF.game.money);
await D(() => SF.go('tassbacken'));
ok(await vanta('Gunnel'), 'i Tassbacken: Gunnel berättar av sig själv');
if (SHOTS) await p.screenshot({ path: 'tools/out/mysterium-vittne.png' });
await knapp('Vidare'); await sleep(200); await knapp('Vidare'); await sleep(200);
ok(await knapp('Leta efter ledtrådar'), 'sista repliken: "🔍 Leta efter ledtrådar"');
ok(await vanta('Leta efter ledtrådar'), 'letaspelet öppnas');
await sleep(300);
const klick = async (i) => {
  const pos = await D((i) => {
    return import('/js/core/mysterium.js').then((m) => { const L = m.mysteriumHook.leta, q = L.saker[i], r = document.querySelector('#modal .my-leta').getBoundingClientRect(); return { x: r.left + (q.x + 6) / L.w * r.width, y: r.top + (q.y + 6) / L.h * r.height, id: q.id }; });
  }, i);
  await p.mouse.click(pos.x, pos.y); await sleep(400);
  return pos.id;
};
if (SHOTS) await p.screenshot({ path: 'tools/out/mysterium-leta.png' });
const falsk = await klick(1);
ok(/Bara/.test(await D(() => window.__toasts.join(' | '))) && /Leta/.test(await rubrik()), `ett falskt spår (${falsk}): "Bara …" – leta vidare`);
const ratt = await klick(0);
ok(ratt === 'fjader' && /En ledtråd/.test(await rubrik()) && (await M()).hittat.includes('fjader'), 'ledtråden: en svartvit fjäder');
await knapp('Vidare');
ok(await vanta('Vad tror du'), 'frågan om fjädern');
await D(() => document.querySelector('#modal [data-mysvar="1"]').click()); await sleep(300);
ok(/inte riktigt/.test(await D(() => window.__toasts.join(' | '))) && await D(() => document.querySelector('#modal [data-mysvar="1"]').disabled), 'fel svar: "inte riktigt" – prova igen');
await D(() => document.querySelector('#modal [data-mysvar="0"]').click()); await sleep(300);
ok(/Rätt/.test(await rubrik()), 'rätt svar');
await knapp('Vidare');
ok(await vanta('Kapitel 1 klart'), '"📗 Kapitel 1 klart!"');
const m1 = await M(), pengar1 = await D(() => SF.game.money);
ok(m1.kap === 1 && m1.steg === 0 && pengar1 === pengar0 + 100 && await D(() => /kommer i morgon/.test(document.querySelector('#modal').innerText)), `kapitel 1 klart: +100 kr, kapitel 2 kommer i morgon (${JSON.stringify(m1)})`);
await stang();
ok(!(await D(async () => (await import('/js/core/mysterium.js')).kapitelVantar(SF))), 'samma dag: inget nytt kapitel');
await D(() => { SF.game.mysterium.klar = '2000-01-01'; });
ok(await D(async () => (await import('/js/core/mysterium.js')).kapitelVantar(SF)), 'en ny dag: kapitel 2 väntar');

// ---- kapitel 6: fotot i Parken ----
await D(() => { SF.game.mysterium = { kap: 5, steg: 0, klar: '2000-01-01', hittat: ['fjader', 'glitter', 'parla', 'spar'] }; SF.go('city'); });
await sleep(800); await stang();
await D(() => { const d = SF.scene._debug.districtNow && SF.scene._debug; SF.scene._debug.teleport(934, 420); });
await sleep(600);
ok(await D(() => SF.scene.distrikt?.() === 'parken'), 'i Parken');
await sleep(1200); await stang();
await D(async () => (await import('/js/core/foto.js')).openKamera(SF)); await sleep(500);
await D(() => document.querySelector('#foto [data-f="knapp"]').click());
ok(await vanta('Vad är det där uppe'), 'ett foto i Parken: boet i trädtoppen');
if (SHOTS) await p.screenshot({ path: 'tools/out/mysterium-boet.png' });
await knapp('Vidare');
ok(await vanta('Vad tror du'), 'frågan om bytet');
await D(() => document.querySelector('#modal [data-mysvar="0"]').click()); await sleep(300);
await knapp('Vidare');
ok(await vanta('Kapitel 6 klart'), '"📗 Kapitel 6 klart!"');
await stang();

// ---- kapitel 7: bytet ----
await D(() => { SF.game.mysterium.klar = '2000-01-01'; SF.go('bling'); });
ok(await vanta('Nova'), 'BLING BLING: Nova');
for (let i = 0; i < 2; i++) { await knapp('Vidare'); await sleep(200); }
await knapp('OK'); await sleep(400);
ok((await M()).hittat.includes('knapp'), 'Nova ger glitterknappen');
await stang();
await D(() => SF.go('city')); await sleep(800); await stang();
await D(() => SF.scene._debug.teleport(934, 420));
ok(await vanta('Skatan', 9000), 'Parken: skatan');
await knapp('Lägg fram'); await sleep(300);
ok(await knapp('Ta upp kronan'), 'skatan tappar kronan');
await sleep(300);
const m7 = await M();
ok(m7.hittat.includes('krona') && !m7.hittat.includes('knapp'), 'kronan bland ledtrådarna, knappen borta');
await stang();
const pengar7 = await D(() => SF.game.money);
await D(() => SF.go('tassbacken'));
ok(await vanta('Gunnel'), 'tillbaka i Tassbacken: Gunnel');
for (let i = 0; i < 2; i++) { await knapp('Vidare'); await sleep(200); }
await knapp('Ge kronan');
ok(await vanta('Mysteriet är löst'), '"🕵️ Mysteriet är löst!"');
const slut = await D(() => ({ m: SF.game.mysterium, pengar: SF.game.money, merit: (SF.game.meriter || []).some((x) => x.typ === 'mysterium') }));
ok(slut.m.kap === 7 && slut.pengar === pengar7 + 1000 && slut.merit, `löst: kapitel 7 av 7, +1 000 kr, meriten Mästerdetektiv (${JSON.stringify(slut.m)})`);
await stang();
await D(() => SF.game.save());
await p.reload().catch(() => {});
await p.waitForFunction(() => !!window.SF?.game, null, { timeout: 30000 });
await sleep(1200);
ok(await D(async () => SF.game.mysterium.kap === 7 && !(await import('/js/core/mysterium.js')).kapitelVantar(SF)), 'efter omladdning: mysteriet är löst, inget mer väntar');

await browser.close();
ok(!errs.length, `inga fel i sidan${errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''}`);
console.log(fails ? `\n✗ ${fails} FEL` : '\nALLT GRÖNT');
process.exit(fails ? 1 : 0);
