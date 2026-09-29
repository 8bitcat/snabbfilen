// BLIXT ELEKTRONIK – elektronikbutiken i Downtown (js/scenes/shop-elektronik.js), med RIKTIGA klick:
//   • allt i butiken går att nå och klicka, inga konsolfel
//   • köp en DATOR (välj modell i produktbladet → bär lådan till kassan → expediten piper)
//     → den ligger i FÖRRÅDET (även i Möblera-panelen hemma)
//   • köp en TELEFON (pryl i g.gadgets) – och samma modell en gång till går inte; nyttan följer
//     modellen (produktbladet säger vad en annan modell ger jämfört med den man har)
//   • hörlurarna låses upp i garderoben, inte råd = knappen är släckt, fullt förråd = knappen
//     är släckt (och går köpet inte igenom ställer expediten tillbaka lådan)
//   • gamingriggen säger vad den heter i förrådet ("TV / dator")
//   • PROVA-ÖN: högtalaren spelar, kameran blixtrar · kunderna kliver inte in ovanpå mig
//   • obetald låda vid dörren: frågan, "ställ tillbaka och gå" → inga pengar dras
//   • MÖBELJÄTTEN säljer inga datorsaker längre (TV:n i vardagsrummet står bara utställd,
//     gamingriggen heter "Gamingriggen" i hänvisningen) – inte den gamla möbelbutiken heller
//   • TV-väggen: alla skärmar visar SAMMA bild och byter kanal samtidigt
//   • prylarnas nytta: mobilens väckarklocka / plattans kvällsserie (+energi i sleep(), per
//     modell, den bästa man har räknas)
//   • sparfilen överlever omladdning (och okända prylar från en nyare version följer med)
//   node tools/elbutik-test.mjs   (servern på 8788; annan port: SMOKE_PORT=8766 eller PORT=…)
import { createRequire } from 'module';
const require = createRequire('D:/Qisy/QISYFrontend/QISYFrontend-1/package.json');
const { chromium } = require('playwright');

const PORT = process.env.SMOKE_PORT || process.env.PORT || '8788';
const OUT = 'tools/out/elbutik/';
let fails = 0;
const ok = (c, m) => { console.log((c ? 'ok: ' : 'FEL: ') + m); if (!c) fails++; };
const browser = await chromium.launch();
const p = await (await browser.newContext({ viewport: { width: 1280, height: 820 } })).newPage();
const errs = [];
p.on('pageerror', (e) => errs.push(e.message));
p.on('console', (m) => m.type() === 'error' && !/peer|webrtc|ice|Could not connect/i.test(m.text()) && errs.push(m.text()));
await p.goto(`http://localhost:${PORT}/index.html?nomenu&world=elb${Math.random().toString(36).slice(2, 7)}`);
await p.evaluate(() => {
  localStorage.clear();
  localStorage.setItem('snabbfilen_avatar', JSON.stringify({ id: 'kalle', name: 'Kalle', look: { skin: '#eabf98', shirt: '#d8343c', hair: '#3b2619', style: 'short' }, color: '#d8343c' }));
  localStorage.setItem('snabbfilen_save1', JSON.stringify({ v: 1, day: 3, min: 13 * 60, money: 9000, hunger: 70, energy: 80, home: 'rum', fridge: {}, jobs: {}, earned: 0, wardrobe: [], storage: [], deco: {}, won: false }));
});
await p.reload();
await p.waitForFunction(() => !!window.SF?.game, null, { timeout: 20000 });

const wait = (ms) => p.waitForTimeout(ms);
const ev = (fn, arg) => p.evaluate(fn, arg);
const D = (fn, ...a) => p.evaluate(([fn, a]) => window.SF.scene._debug[fn](...a), [fn, a]);
async function until(fn, ms = 8000, arg) { for (let i = 0; i < ms / 100; i++) { if (await p.evaluate(fn, arg)) return true; await wait(100); } return false; }
const dlgTitle = () => ev(() => document.querySelector('#modal:not(.hidden) .dlg-head h2')?.textContent || '');
async function dialog(re, ms = 9000) { for (let i = 0; i < ms / 120; i++) { if (re.test(await dlgTitle())) return true; await wait(120); } return false; }
// klicka på en punkt i vyn (spelpixlar) som en riktig spelare
async function clickView(x, y) {
  const r = await ev(() => { const c = document.querySelector('#scene'), b = c.getBoundingClientRect(); return { l: b.left, t: b.top, w: b.width, h: b.height, lw: c.width / SF.pxs, lh: c.height / SF.pxs, bx: SF.view.boxX, by: SF.view.boxY }; });
  await p.mouse.click(r.l + (x + r.bx) / r.lw * r.w, r.t + (y + r.by) / r.lh * r.h);
}
// klicka på en plats; ligger den utanför bild riktas kameran dit först (som när man gått dit)
async function clickSpot(id, i = 0) {
  let q = await D('spot', id, i);
  if (!q) throw new Error('ingen plats ' + id);
  if (q.x < 4 || q.y < 4 || q.x > 380 || q.y > 212) {
    const c = await D('cam');
    await D('lockCam', Math.max(0, c.x + q.x - 192), Math.max(0, c.y + q.y - 108));
    q = await D('spot', id, i);
    await clickView(q.x, q.y);
    await D('lockCam', null);
    return;
  }
  await clickView(q.x, q.y);
}
// klockan står still under testet (bara det vi gör får flytta den)
await ev(() => { SF.game.tickReal = () => {}; });

// ================= butiken =================
await ev(() => SF.go('elektronik'));
await wait(500);
ok(await ev(() => SF.sceneName) === 'elektronik', "SF.go('elektronik') öppnar butiken");
const chk = await D('check');
ok(chk.length === 0, `allt i butiken går att nå och klicka (${chk.length ? chk.join(' · ') : 'inga fel'})`);
const prods = await D('products');
const katPrice = await ev(async () => { const G = await import('./js/game.js'); return Object.fromEntries(['tv', 'retrotv', 'spelkonsol', 'datortorn', 'dator', 'laptop', 'telefon'].map((k) => [k, G.katalogOf(k)?.price ?? null])); });
ok(['tv', 'rigg', 'dator', 'datortorn', 'laptop', 'spelkonsol', 'retrotv', 'telefon'].every((id) => { const x = prods.find((q) => q.id === id); return x && x.price === katPrice[x.k] && !x.blocked; }),
  `alla datorsaker säljs här till katalogpriset (${prods.filter((q) => q.type === 'furn').map((q) => `${q.id} ${q.price}`).join(', ')})`);
ok(['fonmini', 'fon12', 'paronfon', 'platta', 'paronplatta'].every((id) => { const x = prods.find((q) => q.id === id); return x && x.price > 0 && !x.blocked; }), `telefoner och surfplattor finns (${prods.filter((q) => q.type === 'gadget').map((q) => `${q.name} ${q.price}`).join(', ')})`);
await p.locator('#scene').screenshot({ path: OUT + 't-entre.png' });

// ================= köp en dator med riktiga klick =================
const m0 = await ev(() => SF.game.money);
await clickSpot('dator', 1);
ok(await dialog(/Dator/), 'klick på en dator: figuren går dit och produktbladet öppnas');
ok(await ev(() => document.querySelectorAll('#modal .fb-model').length) === 4, 'produktbladet visar datorns fyra modeller');
await p.click('#modal .fb-model[data-v="3"]');
await wait(80);
await p.screenshot({ path: OUT + 't-produktblad-dator.png' });
await p.click('#modal .dlg-foot .btn-go');
await wait(150);
let st = await D('state');
ok(st.cart?.id === 'dator' && st.cart.v === 3 && (await ev(() => SF.game.money)) === m0, `"Till kassan": lådan i händerna (modell ${st.cart?.v}), inget är betalt än`);
await wait(500);
await p.locator('#scene').screenshot({ path: OUT + 't-bar-ladan.png' });
ok(await until(() => SF.game.storage.some((s) => s.k === 'dator' && s.v === 3), 14000), 'figuren bär lådan till kassan, expediten piper in den – datorn ligger i förrådet');
st = await D('state');
ok(st.money === m0 - katPrice.dator && !st.cart && st.bag, `betalt ${m0 - st.money} kr (datorn kostar ${katPrice.dator}), BLIXT-påsen i handen`);
const saved1 = await ev(() => JSON.parse(localStorage.getItem('snabbfilen_save1')));
ok(saved1.storage?.some((s) => s.k === 'dator' && s.v === 3) && saved1.money === st.money, 'köpet är sparat i sparfilen');
await wait(300);
await p.locator('#scene').screenshot({ path: OUT + 't-betalt.png' });
// gamingriggen heter "TV / dator" i förrådet – det står i produktbladet
await clickSpot('rigg', 0);
ok(await dialog(/Gamingrigg/), 'klick på en gamingrigg: produktbladet');
ok(/I förrådet heter den TV \/ dator/.test(await ev(() => document.querySelector('#modal .dlg-body')?.innerText || '')), 'gamingriggens produktblad: "I förrådet heter den TV / dator"');
await ev(() => document.querySelector('#modal [data-close]')?.click());
await wait(100);

// ================= köp en telefon med riktiga klick =================
const m1 = await ev(() => SF.game.money);
await clickSpot('fon12');
ok(await dialog(/Blixtfon 12/), 'klick på Blixtfon 12 på telefonbordet: produktbladet öppnas');
const sheet = await ev(() => document.querySelector('#modal .dlg-body')?.innerText || '');
ok(/Väckarklockan/.test(sheet) && /\+5 energi/.test(sheet) && !/vädret också/.test(sheet), 'produktbladet berättar nyttan för just den modellen (väckarklockan, +5 energi) – och lovar inget annat');
await p.screenshot({ path: OUT + 't-produktblad-telefon.png' });
await p.click('#modal .dlg-foot .btn-go');
ok(await until(() => (SF.game.gadgets || []).includes('fon12'), 14000), 'telefonen bärs till kassan och betalas – den ligger i g.gadgets');
ok(await ev(() => SF.game.money) === m1 - 1900, `telefonen kostade ${m1 - await ev(() => SF.game.money)} kr`);
ok((await ev(() => JSON.parse(localStorage.getItem('snabbfilen_save1')).gadgets)).includes('fon12'), 'telefonen är sparad i sparfilen');
// samma modell igen: knappen är släckt
await clickSpot('fon12');
ok(await dialog(/Blixtfon 12/), 'Blixtfon 12 igen');
ok(await ev(() => document.querySelector('#modal .dlg-foot .btn-go')?.disabled === true) && /redan/.test(await ev(() => document.querySelector('#modal .dlg-body').innerText)), 'samma telefon en gång till: "Den har du redan!" och köpknappen är släckt');
await ev(() => document.querySelector('#modal [data-close]')?.click());
await wait(100);
// nyttan följer modellen: dyrare mobil ger mer, billigare ger inget extra
await clickSpot('paronfon');
ok(await dialog(/Päronfon/), 'Päronfon 16 Pro');
const proTxt = await ev(() => document.querySelector('#modal .dlg-body').innerText);
ok(/\+8 energi/.test(proTxt) && /Din Blixtfon 12 ger \+5 – med den här blir det \+8/.test(proTxt), 'Päronfon: +8 energi, och bladet jämför med min Blixtfon 12 (+5)');
await ev(() => document.querySelector('#modal [data-close]')?.click());
await wait(100);
await clickSpot('fonmini');
ok(await dialog(/Blixtfon Mini/), 'Blixtfon Mini');
ok(/ger redan \+5 – den här ger inget extra/.test(await ev(() => document.querySelector('#modal .dlg-body').innerText)), 'Blixtfon Mini (+3): "din Blixtfon 12 ger redan +5 – den här ger inget extra"');
await ev(() => document.querySelector('#modal [data-close]')?.click());
await wait(100);

// ================= inte råd =================
await ev(() => { SF.game.money = 100; });
await clickSpot('laptop');
ok(await dialog(/Bärbar dator/), 'produktbladet för den bärbara');
ok(await ev(() => document.querySelector('#modal .dlg-foot .btn-go')?.disabled === true) && /räcker inte/.test(await ev(() => document.querySelector('#modal .dlg-body').innerText)), 'inte råd: "Pengarna räcker inte" och köpknappen är släckt');
await ev(() => document.querySelector('#modal [data-close]')?.click());
await ev(() => { SF.game.money = 9000; });

// ================= fullt förråd =================
const MAXS = await ev(async () => (await import('./js/game.js')).MAX_STORAGE);
const fill = () => ev((max) => { const g = SF.game; g._keepStore ??= g.storage.slice(); g.storage = [...g._keepStore]; while (g.storage.length < max) g.storage.push({ k: 'stol', v: 0 }); }, MAXS);
const unfill = () => ev(() => { const g = SF.game; g.storage = [...g._keepStore]; delete g._keepStore; });
await fill();
await clickSpot('datortorn');
ok(await dialog(/Datortorn/), `förrådet fullt (${MAXS} saker): produktbladet för datortornet`);
ok(await ev(() => document.querySelector('#modal .dlg-foot .btn-go')?.disabled === true) && /Förrådet är fullt/.test(await ev(() => document.querySelector('#modal .dlg-body').innerText)), 'fullt förråd: "Förrådet är fullt – möblera hemma först!" och köpknappen är släckt');
await p.screenshot({ path: OUT + 't-forrad-fullt.png' });
await ev(() => document.querySelector('#modal [data-close]')?.click());
await wait(100);
// blir förrådet fullt medan man bär lådan: köpet går inte igenom och expediten ställer tillbaka den
await unfill();
const m3 = await ev(() => SF.game.money);
ok(await D('pick', 'datortorn', 1), 'datortornet i händerna');
await fill();
const fullPay = await D('pay');
st = await D('state');
ok(!fullPay.ok && /fullt/.test(fullPay.msg) && !st.cart && st.money === m3, `förrådet blev fullt före kassan: inget betalt, lådan ställs tillbaka (${fullPay.msg})`);
await unfill();
ok(!(await ev(() => SF.game.storage.some((s) => s.k === 'datortorn'))), 'inget datortorn i förrådet');
await D('teleport', 330, 140);

// ================= hörlurarna → garderoben =================
const hp = await D('buy', 'horlurar');
ok(hp.ok && (await ev(() => SF.game.wardrobe.includes('phones:true'))), 'hörlurarna köps och låses upp i garderoben');
ok((await D('products')).find((q) => q.id === 'horlurar')?.blocked, 'hörlurarna en gång till: "du har redan hörlurar"');

// ================= obetald låda vid dörren =================
const m2 = await ev(() => SF.game.money);
ok(await D('pick', 'paronfon'), 'Päronfon i händerna (obetald)');
await clickSpot('dorr');
ok(await dialog(/Obetald/, 12000), 'dörren med en obetald låda: frågan "Obetald vara"');
await ev(() => [...document.querySelectorAll('#modal .btn')].find((b) => /Ställ tillbaka/.test(b.textContent))?.click());
ok(await until(() => SF.sceneName === 'city', 4000), '"Ställ tillbaka och gå": ut i staden');
ok(await ev(() => SF.game.money) === m2 && !(await ev(() => SF.game.gadgets.includes('paronfon'))), 'inga pengar dras för lådan man ställde tillbaka');
// scenbyte utifrån med en låda i händerna: släpps, inga pengar
await ev(() => SF.go('elektronik'));
await wait(200);
await D('pick', 'laptop');
await ev(() => SF.go('city'));
ok(await ev(() => SF.game.money) === m2 && !(await ev(() => SF.game.storage.some((s) => s.k === 'laptop'))), 'scenbyte med en obetald låda: den släpps, inga pengar dras');
// dörren utan låda
await ev(() => SF.go('elektronik'));
await wait(200);
await clickSpot('dorr');
ok(await until(() => SF.sceneName === 'city', 10000), 'dörren utan låda: figuren går ut i staden');

// ================= förrådet hemma (Möblera) =================
await ev(() => { SF.roomSub = 0; SF.go('room'); });
await wait(400);
await ev(() => SF.scene.toggleDecor?.(true));
await wait(200);
const panel = await ev(() => document.querySelector('#decor-storage')?.innerText || '');
ok(/Dator/.test(panel), `datorn syns i förrådet i Möblera-läget hemma (${panel.replace(/\s+/g, ' ').slice(0, 60)})`);
await p.screenshot({ path: OUT + 't-forradet.png' });
await ev(() => SF.scene.toggleDecor?.(false));

// ================= MÖBELJÄTTEN säljer inga datorsaker =================
await ev(() => SF.go('mobler'));
await wait(400);
const ELEK = ['tv', 'retrotv', 'spelkonsol', 'datortorn', 'dator', 'laptop', 'telefon'];
const ex = await ev(() => SF.scene._debug.exhibits());
const sold = ex.filter((e) => e.buy && ELEK.includes(e.k));
ok(sold.length === 0, `Möbeljätten säljer inga datorsaker (${sold.length ? sold.map((e) => e.k).join(', ') : 'inga utställda till salu'})`);
const decoTv = ex.filter((e) => !e.buy && e.k === 'tv');
ok(decoTv.length >= 1, `TV:n står kvar som utställning i ${[...new Set(decoTv.map((e) => e.room))].join(', ')} (säljs inte)`);
const ikeaChk = await ev(() => SF.scene._debug.check());
ok(!ikeaChk.some((s) => /saknas/.test(s)), `Möbeljättens kontroll: alla möbler i sortimentet är utställda (${ikeaChk.filter((s) => /saknas/.test(s)).join(', ') || 'inga saknas'})`);
ok(ex.filter((e) => e.buy).length > 100 && ex.some((e) => e.buy && e.k === 'soffa'), `resten av sortimentet står kvar (${ex.filter((e) => e.buy).length} möbler till salu)`);
// klick på den utställda TV:n: hänvisning till elbutiken
const tvSpot = await ev(() => SF.scene._debug.spot('tv'));
await ev((q) => SF.scene.down(q.x, q.y), tvSpot);
ok(await until(() => [...document.querySelectorAll('.toast')].some((t) => /(TV:n|Gamingriggen) är bara utställd.*BLIXT/.test(t.textContent)), 12000), 'klick på den utställda TV:n i Möbeljätten: "…köper du på BLIXT ELEKTRONIK i Downtown!"');
const names = await ev(async () => { const K = await import('./js/scenes/ikea/kat.js'); return { rigg: K.elektronikName('tv', 0), tv: K.elektronikName('tv', 1), laptop: K.elektronikName('laptop', 0) }; });
const rigg = ex.find((e) => !e.buy && e.k === 'tv' && e.v !== 1);
ok(rigg && names.rigg === 'Gamingriggen' && names.tv === 'TV:n', `gamingriggen i ${rigg?.room} heter "${names.rigg}" i hänvisningen, TV:n "${names.tv}" (${names.laptop})`);
// den gamla möbelbutiken (moblerGammal) säljer inte heller datorsaker
await ev(() => SF.go('moblerGammal'));
await wait(300);
const gammal = await ev((L) => ({ elek: L.filter((k) => SF.scene._debug.spot(k)), soffa: !!SF.scene._debug.spot('soffa') }), ELEK);
ok(gammal.elek.length === 0 && gammal.soffa, `den gamla möbelbutiken: inga datorsaker (${gammal.elek.join(', ') || 'inga'}), soffan finns kvar`);

// ================= prova-ön och kunderna vid dörren =================
await ev(() => SF.go('elektronik'));
await wait(200);
await D('hideNpcs');
await clickSpot('hogtalare');
ok(await until(() => { const d = SF.scene._debug.demo(); return d.t - d.spk >= 0 && d.t - d.spk < 3; }, 12000), 'prova-ön: figuren går dit och högtalaren börjar spela');
await wait(500);
await p.locator('#scene').screenshot({ path: OUT + 't-provaon.png' });
await clickSpot('kamera');
ok(await until(() => { const d = SF.scene._debug.demo(); return d.t - d.flash >= 0 && d.t - d.flash < 1; }, 12000), 'prova-ön: kameran blixtrar (klick!)');
const door = await ev(() => {
  const S = SF.scene, act = () => S._debug.npcs().filter((n) => n.state !== 'away');
  S._debug.teleport(312, 84); S._debug.wakeNpcs();
  for (let i = 0; i < 60 * 3; i++) S.update(1 / 60);
  const inDoor = act().length;
  S._debug.teleport(330, 140);
  let first = null;
  for (let i = 0; i < 60 * 5 && !first; i++) { S.update(1 / 60); first = act()[0] || null; }
  return { inDoor, first, me: S._debug.pos() };
});
ok(door.inDoor === 0 && door.first && Math.hypot(door.first.x - 312, door.first.y - 84) > 6, `kunderna väntar medan jag står i dörren och kliver sedan in bredvid mattans mitt (${door.inDoor} inne medan jag stod där, första vid ${door.first?.x},${door.first?.y})`);

// ================= kunderna lever =================
const life = await ev(() => {
  const S = SF.scene, seen = new Set();
  for (let i = 0; i < 60 * 80; i++) { S.update(1 / 60); for (const n of S._debug.npcs()) seen.add(n.state); }
  return [...seen];
});
ok(['walk', 'try', 'away'].every((s) => life.includes(s)), `kunderna kommer in, provar sakerna och går (${life.join(', ')})`);
const stuck = await ev(() => {
  const S = SF.scene, a = S._debug.npcs();
  for (let i = 0; i < 60 * 12; i++) S.update(1 / 60);
  const b = S._debug.npcs();
  return a.filter((n, i) => n.state === 'walk' && b[i].state === 'walk' && n.x === b[i].x && n.y === b[i].y).length;
});
ok(stuck === 0, 'ingen kund fastnar');

// ================= TV-väggen: samma bild på alla skärmar =================
const dist = (a, b) => Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]), Math.abs(a[2] - b[2]));
const sameAll = (S, tol) => S.every((c) => dist(c, S[0]) < tol);
await D('tvTime', 3.2); // havet
await wait(250);
// (medelfärgen per skärm – små skärmar får tjockare streck, så fotbollsplanens vita linjer tar
// större plats där; därför en vidare marginal för planen, men den ska vara grön överallt)
const h1 = await D('tvMean'), p1 = await D('tvSample', [[0.5, 0.12]]);
ok(h1.length >= 5 && sameAll(h1, 28) && p1.every((tv) => dist(tv[0], p1[0][0]) < 50), `alla ${h1.length} TV-apparater visar samma bild – havet (medelfärg ${h1.map((c) => c.join('.')).join(' / ')})`);
await D('tvTime', 8 + 3.2); // fotboll
await wait(250);
const h2 = await D('tvMean');
ok(sameAll(h2, 60) && h2.every((c) => c[1] > c[0] + 25 && c[1] > c[2] + 20) && dist(h1[0], h2[0]) > 40, `kanalbyte: alla skärmar byter till samma nya bild samtidigt – fotboll, grön plan överallt (${h2.map((c) => c.join('.')).join(' / ')})`);
await D('tvTime', 8 * 3 + 3.2); // reklamen
await wait(250);
const h3 = await D('tvMean');
ok(sameAll(h3, 34) && dist(h2[0], h3[0]) > 40, `…och till BLIXT-reklamen (${h3.map((c) => c.join('.')).join(' / ')})`);
await D('tvTime', 3.2);
await wait(200);
await p.locator('#scene').screenshot({ path: OUT + 't-tvvaggen.png' });

// ================= prylarnas nytta i sleep() =================
const sleepy = await ev(() => {
  const G = SF.game.constructor;
  const run = (gadgets, min, quality = 1) => { const g = new G(); g.save = () => {}; g.home = 'rum'; g.hunger = 0; g.energy = 10; g.min = min; g.gadgets = gadgets; g.day = 2; g.sleep(quality); return g.energy; };
  return { inget: run([], 21 * 60), mini: run(['fonmini'], 21 * 60), mobil: run(['fon12'], 21 * 60), pro: run(['fonmini', 'paronfon'], 21 * 60), bada: run(['fon12', 'platta'], 21 * 60),
    plattaTidigt: run(['platta'], 18 * 60), plattaSent: run(['platta'], 21 * 60), proPlatta: run(['platta', 'paronplatta'], 21 * 60), gatan: run(['fon12', 'platta'], 23 * 60, 0.55), gatanInget: run([], 23 * 60, 0.55) };
});
ok(sleepy.mini === sleepy.inget + 3 && sleepy.mobil === sleepy.inget + 5 && sleepy.pro === sleepy.inget + 8, `mobilens väckarklocka följer modellen: Mini +3, 12 +5, Päronfon +8 (den bästa räknas) (${sleepy.inget} → ${sleepy.mini} / ${sleepy.mobil} / ${sleepy.pro})`);
ok(sleepy.plattaSent === sleepy.inget + 4 && sleepy.plattaTidigt === sleepy.inget && sleepy.proPlatta === sleepy.inget + 7 && sleepy.bada === sleepy.inget + 9, `surfplattan: +4 (Pro +7) bara om man lägger sig efter 20 (${sleepy.plattaTidigt} / ${sleepy.plattaSent} / ${sleepy.proPlatta}, mobil+platta ${sleepy.bada})`);
ok(sleepy.gatan === sleepy.gatanInget, 'somnar man på gatan hjälper ingen pryl');

// ================= sparfilen överlever omladdning =================
await ev(() => SF.game.save());
await p.reload();
await p.waitForFunction(() => !!window.SF?.game, null, { timeout: 20000 });
await wait(300);
const after = await ev(() => ({ gadgets: SF.game.gadgets, dator: SF.game.storage.some((s) => s.k === 'dator' && s.v === 3), hp: SF.game.wardrobe.includes('phones:true') }));
ok(after.gadgets?.includes('fon12') && after.dator && after.hp, `efter omladdning: telefonen, datorn i förrådet och hörlurarna finns kvar (${JSON.stringify(after)})`);
// en sparfil från en nyare version med en okänd pryl: den följer med orörd
await ev(() => { const s = JSON.parse(localStorage.getItem('snabbfilen_save1')); s.gadgets = [...s.gadgets, 'framtidsfon', 'fon12']; localStorage.setItem('snabbfilen_save1', JSON.stringify(s)); });
await p.reload();
await p.waitForFunction(() => !!window.SF?.game, null, { timeout: 20000 });
await ev(() => SF.game.save());
const kept = await ev(() => ({ inGame: SF.game.gadgets, inSave: JSON.parse(localStorage.getItem('snabbfilen_save1')).gadgets }));
ok(!kept.inGame.includes('framtidsfon') && kept.inGame.filter((x) => x === 'fon12').length === 1 && kept.inSave.includes('framtidsfon') && kept.inSave.includes('fon12'), `okänd pryl från en nyare version följer med orörd (${JSON.stringify(kept)})`);
// en gammal sparfil utan prylar
await ev(() => localStorage.setItem('snabbfilen_save1', JSON.stringify({ v: 1, day: 5, min: 600, money: 700, hunger: 50, energy: 50, home: 'rum', fridge: {}, jobs: {}, earned: 0, wardrobe: [], storage: [{ k: 'tv', v: 1 }], deco: {} })));
await p.reload();
await p.waitForFunction(() => !!window.SF?.game, null, { timeout: 20000 });
const old = await ev(() => ({ g: SF.game.gadgets, tv: SF.game.storage.some((s) => s.k === 'tv' && s.v === 1), sell: SF.game.sellable(SF.game.storage[0]) }));
ok(Array.isArray(old.g) && old.g.length === 0 && old.tv && old.sell, 'gammal sparfil utan prylar: tom prylista, TV:n i förrådet finns kvar och kan säljas som förut');

console.log(errs.length ? 'KONSOLFEL: ' + errs.join(' | ') : 'Inga konsolfel.');
ok(errs.length === 0, 'inga pageerror/console.error');
await browser.close();
console.log(fails ? `${fails} FEL` : 'ALLT GRÖNT');
process.exit(fails ? 1 : 0);
