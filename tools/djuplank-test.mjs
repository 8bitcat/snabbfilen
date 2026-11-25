// 🔗 DJUPLÄNKAR (js/core/djuplank.js, v0.181) – App Store-händelsernas länkar öppnar rätt ställe:
//   • ?lank=dockskap/rymd från huvudmenyn → menyn stängs, Dockskåpet öppnas och kameran står i Rymdstationen
//   • djuplankOppna('pixelcity://dockskap/jul') när man redan står i Dockskåpet → vardagsrummet
//   • en okänd länk gör ingenting
//   • Info.plist har länkschemat pixelcity och appen har @capacitor/app
// Kör: node tools/djuplank-test.mjs   (servern på 8788, eller SMOKE_PORT / PORT)
import { createRequire } from 'module';
import fs from 'fs';
const require = createRequire('D:/Qisy/QISYFrontend/QISYFrontend-1/package.json');
const { chromium } = require('playwright');
const PORT = process.env.SMOKE_PORT || process.env.PORT || 8788;
let fails = 0;
const ok = (c, m) => { console.log((c ? 'ok: ' : 'FEL: ') + m); if (!c) fails++; };
const browser = await chromium.launch();
const p = await browser.newPage({ viewport: { width: 1152, height: 648 } });
const errs = [];
p.on('pageerror', (e) => errs.push(e.message));
await p.goto(`http://localhost:${PORT}/index.html?menu&world=lank${Date.now().toString(36)}`);
await p.evaluate(() => { localStorage.clear(); localStorage.setItem('snabbfilen_avatar', JSON.stringify({ id: 'a', name: 'Julia', look: {}, color: '#ff5dc8' })); });
await p.goto(`http://localhost:${PORT}/index.html?menu&lank=dockskap/rymd&world=lank${Date.now().toString(36)}`);
await p.waitForFunction(() => window.SF?.sceneName === 'dockskap' && !!window.SF.scene?._debug?.rooms, null, { timeout: 20000 }).catch(() => {});
await p.waitForTimeout(800);
const lage = await p.evaluate(() => ({ scen: window.SF.sceneName, meny: !!document.querySelector('.menu:not(.hidden)'), rum: window.SF.scene?._debug?.roomInView?.() }));
const rymdI = await p.evaluate(() => window.SF.scene._debug.rooms().map((r) => r.id).indexOf('rymd'));
ok(lage.scen === 'dockskap' && !lage.meny, `?lank=dockskap/rymd från huvudmenyn: menyn stängs och Dockskåpet öppnas (${JSON.stringify(lage)})`);
ok(lage.rum === rymdI, `kameran står i Rymdstationen (rum ${lage.rum}, rymd = ${rymdI})`);
const jul = await p.evaluate(async () => { const m = await import('/js/core/djuplank.js'); const r = m.djuplankOppna(window.SF, 'pixelcity://dockskap/jul'); await new Promise((x) => setTimeout(x, 300)); return { r, rum: window.SF.scene._debug.roomInView() }; });
ok(jul.r === true && jul.rum === 0, `pixelcity://dockskap/jul i Dockskåpet: vardagsrummet (${JSON.stringify(jul)})`);
ok(await p.evaluate(async () => (await import('/js/core/djuplank.js')).djuplankOppna(window.SF, 'pixelcity://okand') === false), 'en okänd länk gör ingenting');
const plist = fs.readFileSync('app/ios/App/App/Info.plist', 'utf8'), pkg = JSON.parse(fs.readFileSync('app/package.json', 'utf8'));
ok(/<key>CFBundleURLSchemes<\/key>\s*<array>\s*<string>pixelcity<\/string>/.test(plist) && !!pkg.dependencies['@capacitor/app'], 'appen: länkschemat pixelcity i Info.plist och @capacitor/app');
ok(!errs.length, `inga sidfel${errs.length ? ' – ' + errs.slice(0, 2).join(' | ') : ''}`);
await browser.close();
console.log(fails ? `\n${fails} FEL` : '\nALLT GRÖNT');
process.exit(fails ? 1 : 0);
