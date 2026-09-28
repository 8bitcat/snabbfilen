// Huvudmenyn, figurbyte med egna sparningar, pausmenyn, inställningar och pixelmätarna.
//   node tools/menu-test.mjs          (servern på 8788; annan port: SMOKE_PORT=8791)
import { createRequire } from 'module';
const require = createRequire('D:/Qisy/QISYFrontend/QISYFrontend-1/package.json');
const { chromium } = require('playwright');

const PORT = process.env.SMOKE_PORT || '8788';
const U = `http://localhost:${PORT}/index.html?menu=1&world=menu${Date.now().toString(36)}`;
let fails = 0;
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fails++; };
const errors = [];
const browser = await chromium.launch();
const mk = async (w, h) => {
  const c = await browser.newContext({ viewport: { width: w, height: h } });
  const p = await c.newPage();
  p.on('pageerror', (e) => errors.push(e.message));
  p.on('console', (m) => m.type() === 'error' && !/peer|webrtc|ice|Could not connect/i.test(m.text()) && errors.push(m.text()));
  p.on('response', (r) => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
  return p;
};
const menuOpen = (p) => p.evaluate(() => !!document.querySelector('#menu:not(.hidden)'));

// 1. helt ny spelare
const p = await mk(1100, 700);
await p.goto(U); await p.evaluate(() => localStorage.clear()); await p.reload();
await p.waitForFunction(() => !!window.SF?.game, null, { timeout: 20000 });
await p.waitForTimeout(1200);
ok(await menuOpen(p), 'huvudmenyn visas vid start');
ok(await p.evaluate(() => document.querySelector('[data-continue]')?.disabled === true), 'Fortsätt är nedtonad utan figur');
ok(await p.evaluate(() => window.SF.sceneName === 'city' && window.SF.attract === true), 'staden lever i bakgrunden (bakgrundsläge)');
ok(await p.evaluate(() => document.querySelector('#hud-face')?.offsetParent === null), 'HUD-raden är dold i startmenyn');

// 2. två figurer med egna sparningar
await p.evaluate(() => {
  localStorage.setItem('snabbfilen_avatars', JSON.stringify([{ name: 'Kalle', look: { skin: '#eabf98', shirt: '#3a78d8' }, color: '#3a78d8' }, { name: 'Julia', look: { skin: '#f0cfb0', shirt: '#e04888', hair: '#c04020' }, color: '#ff5dc8' }]));
  localStorage.setItem('snabbfilen_avatar', JSON.stringify({ name: 'Kalle', look: { skin: '#eabf98', shirt: '#3a78d8' }, color: '#3a78d8' }));
  localStorage.setItem('snabbfilen_save1', JSON.stringify({ v: 1, day: 5, min: 600, money: 2450, hunger: 60, energy: 40, home: 'lagenhet', fridge: {}, jobs: { flygplats: 3, frukt: 0, burgare: 4 }, earned: 900, wardrobe: [], storage: [], deco: {}, won: false }));
  localStorage.setItem('snabbfilen_save:julia', JSON.stringify({ v: 1, day: 12, min: 600, money: 11200, hunger: 60, energy: 40, home: 'villa', fridge: {}, jobs: { flygplats: 0, frukt: 2, burgare: 9 }, earned: 9000, wardrobe: [], storage: [], deco: {}, won: true }));
});
await p.reload();
await p.waitForFunction(() => !!window.SF?.game, null, { timeout: 20000 });
await p.waitForTimeout(1200);
ok(await p.evaluate(() => document.querySelectorAll('.menu-card').length) === 2, 'båda figurerna visas med kort');
const cardText = (await p.evaluate(() => document.querySelector('.menu-card[data-pick="Julia"]')?.innerText || '')).replace(/ /g, ' ');
ok(/11 200 kr/.test(cardText) && /Villan/.test(cardText) && /dag 12/.test(cardText), `sammanfattning på kortet (${cardText.replace(/\s+/g, ' ').slice(0, 60)})`);
ok(/Fortsätt som Kalle/.test(await p.evaluate(() => document.querySelector('[data-continue]').textContent)), 'Fortsätt-knappen visar vald figur');
await p.screenshot({ path: 'tools/out/menu-test-1.png' });

// 2b. dialoger från menyn ligger ovanpå menyn (✏️ Ändra → redigeraren)
await p.click('[data-edit="Kalle"]'); await p.waitForTimeout(500);
const layered = await p.evaluate(() => {
  const dlg = document.querySelector('.dlg-avatar'); if (!dlg) return { dlg: false };
  const r = dlg.getBoundingClientRect(); const top = document.elementFromPoint(r.left + r.width / 2, r.top + 20);
  return { dlg: true, onTop: !!top?.closest('#modal'), menuZ: +getComputedStyle(document.querySelector('#menu')).zIndex, modalZ: +getComputedStyle(document.querySelector('#modal')).zIndex };
});
ok(layered.dlg && layered.onTop && layered.modalZ > layered.menuZ, `redigeraren ligger ovanpå menyn (meny ${layered.menuZ} < dialog ${layered.modalZ})`);
// Spara utan namn → namnrutan ovanpå redigeraren; Escape stänger bara rutan
await p.fill('#av-name', '');
await p.click('.dlg-avatar .dlg-foot .av-save'); await p.waitForTimeout(300);
ok(await p.evaluate(() => !!document.querySelector('.av-nameask') && !!document.activeElement?.closest?.('.av-nameask')), 'Spara utan namn öppnar namnrutan med fokus i fältet');
await p.keyboard.press('Escape'); await p.waitForTimeout(200);
ok(await p.evaluate(() => !document.querySelector('.av-nameask') && !!document.querySelector('.dlg-avatar')), 'Escape stänger bara namnrutan, redigeraren är kvar');
await p.click('.dlg-avatar .dlg-foot .av-save'); await p.waitForTimeout(200);
await p.keyboard.type('Kalle'); await p.keyboard.press('Enter'); await p.waitForTimeout(500);
ok(await p.evaluate(() => !document.querySelector('.dlg-avatar') && window.SF.avatar.name === 'Kalle'), 'namnet ur rutan sparas och redigeraren stängs');
ok(await menuOpen(p), 'menyn är kvar efter redigeringen');

// 3. inställningar
await p.click('[data-settings]'); await p.waitForTimeout(200);
ok(await p.evaluate(() => !!document.querySelector('.menu-settings:not(.hidden)')), 'inställningarna fälls ut');
const before = await p.evaluate(() => document.querySelector('[data-hud]').textContent);
await p.click('[data-hud]'); await p.waitForTimeout(200);
ok(await p.evaluate(() => document.querySelector('[data-hud]').textContent) !== before, 'mätarvalet växlar');
await p.click('[data-music]'); await p.waitForTimeout(100);
ok(await p.evaluate(() => localStorage.getItem('snabbfilen_music') !== null), 'musikvalet sparas');

// 4. fortsätt → spelet med pixelmätare (valet ovan) och kortare HUD-rad
await p.click('[data-continue]'); await p.waitForTimeout(1500);
const st = await p.evaluate(() => ({ menu: !!document.querySelector('#menu:not(.hidden)'), scene: window.SF.sceneName, attract: window.SF.attract, pix: document.body.classList.contains('hud-pix'), hudH: document.querySelector('#hud').offsetHeight }));
ok(!st.menu && st.scene === 'room' && st.attract === false, 'Fortsätt startar spelet hemma');
ok(st.pix === (before.includes('RAD')) , `mätarvalet slår igenom (pixel: ${st.pix}, HUD-höjd ${st.hudH})`);
await p.evaluate(() => window.SF.go('city')); await p.waitForTimeout(1200);
await p.screenshot({ path: 'tools/out/menu-test-2.png' });

// 5. pausmenyn
await p.click('#hud-menu'); await p.waitForTimeout(300);
ok(await menuOpen(p), '☰ öppnar pausmenyn');
ok(/Fortsätt spela/.test(await p.evaluate(() => document.querySelector('[data-continue]').textContent)), 'pausmenyn erbjuder Fortsätt spela');
await p.keyboard.press('Escape'); await p.waitForTimeout(200);
ok(!(await menuOpen(p)), 'Esc stänger pausmenyn');

// 6. byt figur → egen sparning, den förra parkeras
await p.click('#hud-menu'); await p.waitForTimeout(300);
await p.click('.menu-card[data-pick="Julia"]'); await p.waitForTimeout(150);
await p.click('[data-continue]');
await p.waitForFunction(() => window.SF?.avatar?.name === 'Julia', null, { timeout: 20000 });
await p.waitForTimeout(800);
const j = await p.evaluate(() => ({ money: window.SF.game.money, home: window.SF.game.home, menu: !!document.querySelector('#menu:not(.hidden)'), kalle: JSON.parse(localStorage.getItem('snabbfilen_save:kalle') || '{}').money }));
ok(j.money === 11200 && j.home === 'villa', `Julia spelar med sin egen sparning (${j.money} kr, ${j.home})`);
ok(j.kalle === 2450, 'Kalles sparning parkerades orörd');
ok(!j.menu, 'ingen meny efter figurbytet – rakt in i spelet');

// 7. mobil
const m = await mk(420, 860);
const dump = await p.evaluate(() => Object.fromEntries(Object.keys(localStorage).filter((k) => k.startsWith('snabbfilen')).map((k) => [k, localStorage.getItem(k)])));
await m.goto(U); await m.evaluate((s) => { for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v); }, dump);
await m.reload();
await m.waitForFunction(() => !!window.SF?.game, null, { timeout: 20000 });
await m.waitForTimeout(1200);
ok(await menuOpen(m) && (await m.evaluate(() => document.querySelectorAll('.menu-card').length)) === 2, 'menyn fungerar på mobilbredd');
await m.screenshot({ path: 'tools/out/menu-test-3-mobil.png' });

console.log(errors.length ? '\nKONSOLFEL:\n' + errors.join('\n') : '\nInga konsolfel.');
ok(errors.length === 0, 'inga pageerror/console.error');
await browser.close();
console.log(fails ? `\n${fails} FEL` : '\nALLT GRÖNT');
process.exit(fails ? 1 : 0);
