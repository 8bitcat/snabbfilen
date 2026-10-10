// Regressionstest för ⚽ KBK-LAGKOMPISAR (js/net/kbk.js, raden under ⚙ Inställningar):
//   • raden "⚽ KBK – Jag spelar i KBK" finns i inställningarna
//   • fel förnamn/nummer → ett besked, rätt (Julia 34, stavat med små bokstäver) → "Julia 34" på raden
//   • två lagkompisar i samma värld: den som kommer in hälsas med "⚽ Lily 20 från KBK …" hos den andra,
//     och den som kommer in får se vilka lagkompisar som redan är där
//   • en spelare som inte spelar i KBK hälsas som vanligt (👋 … är i Pixelstaden!)
//   • samma lagkompis igen (omladdning) hälsas inte en gång till
//   • Ta bort → raden visar "Jag spelar i KBK" igen
// Kör: node tools/kbk-test.mjs   (servern på 8788, eller SMOKE_PORT / PORT)
import { createRequire } from 'module';
const require = createRequire('D:/Qisy/QISYFrontend/QISYFrontend-1/package.json');
const { chromium } = require('playwright');

const PORT = process.env.SMOKE_PORT || process.env.PORT || 8788;
const WORLD = 'kbk' + Date.now().toString(36);
let fails = 0;
const ok = (c, m) => { console.log((c ? 'ok: ' : 'FEL: ') + m); if (!c) fails++; };
const browser = await chromium.launch();
const errs = [];
async function spelare(namn, id, kb = null) {
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 760 } });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errs.push(namn + ': ' + e.message));
  await p.addInitScript(() => {   // fånga alla hälsningar (toasterna försvinner efter en stund)
    window.__toasts = [];
    new MutationObserver(() => document.querySelectorAll('.toast, #toast, .toasts > *').forEach((t) => { const s = t.textContent.trim(); if (s && !window.__toasts.includes(s)) window.__toasts.push(s); }))
      .observe(document, { subtree: true, childList: true, characterData: true });
  });
  await p.goto(`http://localhost:${PORT}/index.html?nomenu&world=${WORLD}`);
  await p.evaluate(({ namn, id, kb }) => {
    localStorage.clear(); localStorage.setItem('snabbfilen_tips_hus', '1');
    localStorage.setItem('snabbfilen_avatar', JSON.stringify({ id, name: namn, look: { skin: '#e0a97f', hair: '#3b2619', style: 'long' }, color: '#ffd23f' }));
    localStorage.setItem('snabbfilen_save1', JSON.stringify({ v: 1, day: 3, min: 13 * 60, money: 900, hunger: 70, energy: 80, home: 'husvagn', fridge: {}, jobs: {}, earned: 0, mal: { id: 'rik', niva: 'latt' } }));
    if (kb) localStorage.setItem('snabbfilen_kbk', JSON.stringify({ [id]: kb }));
  }, { namn, id, kb });
  await p.reload();
  await p.waitForFunction(() => !!window.SF?.game, null, { timeout: 30000 });
  await p.waitForTimeout(700);
  await p.evaluate(() => { const m = document.querySelector('#modal'); m.classList.add('hidden'); m.innerHTML = ''; window.SF.go('city'); });
  return { ctx, p };
}
const toasts = (p) => p.evaluate(() => window.__toasts.join(' | '));
const vanta = async (p, re, ms = 25000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (re.test(await toasts(p))) return true; await p.waitForTimeout(400); } return false; };

// ---- Julia stämmer av sig i inställningarna ----
const J = await spelare('Pixeljulia', 'id-julia');
await J.p.click('#hud-mobil'); await J.p.click('#mobilen [data-app="installningar"]'); await J.p.waitForTimeout(300);
ok(await J.p.evaluate(() => !!document.querySelector('[data-kbk]')), 'inställningarna har raden ⚽ KBK – Jag spelar i KBK');
await J.p.click('[data-kbk]'); await J.p.waitForTimeout(250);
await J.p.fill('#kbk-namn', 'Julia'); await J.p.fill('#kbk-nr', '33');
await J.p.click('#modal .dlg-foot .btn-go'); await J.p.waitForTimeout(200);
ok(await J.p.evaluate(() => !!document.querySelector('.kbk-fel')?.textContent && !!document.querySelector('#kbk-namn')), 'fel nummer (Julia 33) → ett besked, rutan står kvar');
await J.p.fill('#kbk-namn', ' julia '); await J.p.fill('#kbk-nr', '34');
await J.p.keyboard.press('Enter'); await J.p.waitForTimeout(300);
ok(await J.p.evaluate(() => document.querySelector('[data-kbk-nu]')?.textContent === 'Julia 34' && JSON.parse(localStorage.getItem('snabbfilen_kbk'))['id-julia'] === 34), 'rätt förnamn och nummer → raden visar Julia 34');
await J.p.keyboard.press('Escape'); await J.p.waitForTimeout(300);

// ---- Lily (också KBK) och Kalle (inte KBK) kommer in ----
await J.p.waitForTimeout(2500);   // (Julia är värd för den lilla testvärlden)
const L = await spelare('Lilypixel', 'id-lily', 20);
ok(await vanta(J.p, /⚽ Lily 20 från KBK/), `Julia får en egen hälsning när lagkompisen Lily kommer in (${(await toasts(J.p)).slice(-90)})`);
ok(await vanta(L.p, /⚽ Lagkompisar i Pixelstaden: Julia 34/), 'Lily ser att lagkompisen Julia redan är där');
const K = await spelare('Kalle', 'id-kalle');
ok(await vanta(J.p, /👋 Kalle är i Pixelstaden/), 'en spelare som inte spelar i KBK hälsas som vanligt');
ok(!/⚽ Lagkompisar/.test(await toasts(K.p)), 'Kalle (inte KBK) får ingen lagkompishälsning');
// Lily laddar om → ingen ny hälsning hos Julia
const fore = (await toasts(J.p)).split('⚽ Lily 20').length;
await L.p.reload(); await L.p.waitForFunction(() => !!window.SF?.game, null, { timeout: 30000 }); await L.p.waitForTimeout(6000);
ok((await toasts(J.p)).split('⚽ Lily 20').length === fore, 'samma lagkompis igen (omladdning) hälsas inte en gång till');

// ---- Ta bort ----
await J.p.click('#hud-mobil'); await J.p.click('#mobilen [data-app="installningar"]'); await J.p.waitForTimeout(300);
await J.p.click('[data-kbk-av]'); await J.p.waitForTimeout(200);
ok(await J.p.evaluate(() => !!document.querySelector('[data-kbk]') && !JSON.parse(localStorage.getItem('snabbfilen_kbk'))['id-julia']), 'Ta bort → raden visar Jag spelar i KBK igen');
for (const s of [J, L, K]) await s.ctx.close();

ok(!errs.length, `inga fel${errs.length ? ' – ' + [...new Set(errs)].slice(0, 3).join(' | ') : ''}`);
await browser.close();
console.log(fails ? `\n${fails} FEL` : '\nALLT GRÖNT');
process.exit(fails ? 1 : 0);
