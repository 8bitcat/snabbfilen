// App Store-skärmbilderna till Pixelcity: spelet körs i telefonens/plattans riktiga storlek (fyll-läget,
// ?mobfill=1) och varje bild får en rubrik i spelets röda dialogstil ovanför.
//   iphone  6,9" liggande 2868×1320 (956×440 @3x)
//   ipad    13"  liggande 2752×2064 (1376×1032 @2x)
//   node app/tools/skarmbilder.mjs [iphone|iphone65|ipad] [--bara id,id] [--rubriker] [--lang en]
//     → app/store/skarmbilder/<enhet>-<nr>-<id>.png (+ <enhet>-<id>-ra.png utan rubrik)
//     --bara      ta bara de här bilderna      --rubriker  gör bara om rubrikerna på redan tagna bilder
//     --lang xx   spelet och rubrikerna på det språket (docs/SPRAK.md) → app/store/skarmbilder/<xx>/
// Urvalet och ordningen är Carls (2026-10-03): staden, leksaksaffären, klädaffären, frisörens frisyrmeny,
// husdjuren, festen i ett riktigt möblerat hem (app/tools/fest-hem.json), pizzerian och mer av staden
// – ingen häst och ingen trädgård.
// Servern på 8788 (annan port: PORT=…).
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const require = createRequire('D:/Qisy/QISYFrontend/QISYFrontend-1/package.json');
const { chromium } = require('playwright');

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LANG = process.argv.includes('--lang') ? process.argv[process.argv.indexOf('--lang') + 1] : 'sv';
const OUT = path.join(APP, 'store', 'skarmbilder', ...(LANG === 'sv' ? [] : [LANG]));
const PORT = process.env.PORT || 8788;
const FEST_HEM = JSON.parse(fs.readFileSync(path.join(APP, 'tools', 'fest-hem.json'), 'utf8'));   // villans vardagsrum, möblerat
fs.mkdirSync(OUT, { recursive: true });

const ENHETER = {
  iphone: { vp: [956, 440], dsf: 3 },     // 6,9" 2868×1320
  iphone65: { vp: [926, 428], dsf: 3 },   // 6,5" 2778×1284 – det App Store Connect frågar efter för iPhone
  ipad: { vp: [1376, 1032], dsf: 2 },     // 13" 2752×2064
};
// rubrik + underrad per bild, i den ordning de visas i App Store (högst tio)
const BILDER = [
  { id: 'stan', rubrik: 'Ett helt liv i Pixelstaden', under: 'Jobba, handla, plugga och träffa folk' },
  { id: 'leksaker', rubrik: 'Shoppa i stan', under: 'Leksaker, möbler, mat och mycket mer' },
  { id: 'klader', rubrik: 'Klä dig som du vill', under: 'Kläder, skor och accessoarer' },
  { id: 'frisor', rubrik: 'Fixa dig hos frisören', under: 'Välj bland massor av frisyrer och hårfärger' },
  { id: 'husdjur', rubrik: 'Skaffa eget husdjur', under: 'Kattungar, valpar och kaninungar som växer upp hemma' },
  { id: 'fest', rubrik: 'Bjud hem kompisarna', under: 'Inred ditt hem och ha fest' },
  { id: 'jobb', rubrik: 'Jobba dig uppåt', under: '14 jobb – från pizzabagare till chef' },
  { id: 'soder', rubrik: 'Upptäck hela staden', under: 'Söder, parken, förorten och downtown' },
  { id: 'kvall', rubrik: 'Staden lever dygnet runt', under: 'Dag och natt, sol och regn' },
];
// samma rubriker på de andra språken, i samma ordning (staden och stadsdelarna med sina lokala namn)
const RUBRIKER = {
  en: [['A whole life in Pixel City', 'Work, shop, study and meet people'], ['Go shopping in town', 'Toys, furniture, food and much more'], ['Dress the way you like', 'Clothes, shoes and accessories'], ['Get a new look at the salon', 'Loads of hairstyles and hair colors'], ['Get your own pet', 'Kittens, puppies and bunnies that grow up at home'], ['Invite your friends over', 'Decorate your home and throw a party'], ['Work your way up', '14 jobs – from pizza baker to boss'], ['Explore the whole city', 'Southside, the park, Eastside and downtown'], ['The city never sleeps', 'Day and night, sun and rain']],
  es: [['Toda una vida en Ciudad Píxel', 'Trabaja, compra, estudia y conoce gente'], ['De compras por la ciudad', 'Juguetes, muebles, comida y mucho más'], ['Vístete como quieras', 'Ropa, zapatos y accesorios'], ['Cambia de look en la peluquería', 'Montones de peinados y colores de pelo'], ['Adopta tu propia mascota', 'Gatitos, cachorros y conejitos que crecen en casa'], ['Invita a tus amigos', 'Decora tu casa y monta una fiesta'], ['Asciende en el trabajo', '14 trabajos – de pizzero a jefe'], ['Explora toda la ciudad', 'Barrio Sur, el parque, las afueras y Las Torres'], ['La ciudad nunca duerme', 'Día y noche, con sol y con lluvia']],
  de: [['Ein ganzes Leben in Pixelstadt', 'Arbeiten, einkaufen, lernen und Leute treffen'], ['Shoppen in der Stadt', 'Spielzeug, Möbel, Essen und vieles mehr'], ['Zieh an, was du willst', 'Kleidung, Schuhe und Accessoires'], ['Neuer Look beim Friseur', 'Jede Menge Frisuren und Haarfarben'], ['Hol dir ein Haustier', 'Kätzchen, Welpen und Häschen, die zu Hause groß werden'], ['Lade deine Freunde ein', 'Richte dein Zuhause ein und feiere eine Party'], ['Arbeite dich hoch', '14 Jobs – vom Pizzabäcker bis zum Chef'], ['Entdecke die ganze Stadt', 'Südstadt, Stadtpark, Vorstadt und City'], ['Die Stadt lebt rund um die Uhr', 'Tag und Nacht, Sonne und Regen']],
  fr: [['Toute une vie à Pixelville', 'Travaille, achète, étudie et rencontre du monde'], ['Fais du shopping en ville', 'Jouets, meubles, nourriture et bien plus'], ['Habille-toi comme tu veux', 'Vêtements, chaussures et accessoires'], ['Change de look chez le coiffeur', 'Plein de coiffures et de couleurs'], ['Adopte ton propre animal', 'Chatons, chiots et lapereaux qui grandissent chez toi'], ['Invite tes amis', 'Décore ta maison et fais la fête'], ['Grimpe les échelons', '14 métiers – de pizzaiolo à patron'], ['Explore toute la ville', 'Rive Gauche, le parc, la banlieue et les gratte-ciel'], ['La ville vit jour et nuit', 'Au soleil comme sous la pluie']],
  pl: [['Całe życie w Pikselowie', 'Pracuj, rób zakupy, ucz się i poznawaj ludzi'], ['Zakupy w mieście', 'Zabawki, meble, jedzenie i dużo więcej'], ['Ubierz się, jak chcesz', 'Ubrania, buty i dodatki'], ['Nowa fryzura u fryzjera', 'Mnóstwo fryzur i kolorów włosów'], ['Zaadoptuj zwierzaka', 'Kotki, szczeniaki i króliczki, które rosną w domu'], ['Zaproś znajomych', 'Urządź dom i zrób imprezę'], ['Pnij się w górę', '14 prac – od pizzermana do szefa'], ['Odkryj całe miasto', 'Zarzecze, park, osiedle i City'], ['Miasto żyje całą dobę', 'Dzień i noc, słońce i deszcz']],
  it: [['Una vita intera a Pixelopoli', 'Lavora, fai shopping, studia e conosci gente'], ['Shopping in città', 'Giocattoli, mobili, cibo e molto altro'], ['Vestiti come vuoi', 'Abiti, scarpe e accessori'], ['Nuovo look dal parrucchiere', 'Tantissime acconciature e colori'], ['Adotta un animale', 'Gattini, cuccioli e coniglietti che crescono a casa'], ['Invita gli amici', 'Arreda la casa e organizza una festa'], ['Fai carriera', '14 lavori – da pizzaiolo a capo'], ['Esplora tutta la città', 'Oltrefiume, il parco, la periferia e Porta Nuova'], ['La città vive giorno e notte', 'Con il sole e con la pioggia']],
  pt: [['Uma vida inteira em Pixelópolis', 'Trabalha, faz compras, estuda e conhece pessoas'], ['Compras na cidade', 'Brinquedos, móveis, comida e muito mais'], ['Veste-te como quiseres', 'Roupa, sapatos e acessórios'], ['Novo visual no cabeleireiro', 'Montes de penteados e cores de cabelo'], ['Adota o teu animal', 'Gatinhos, cachorrinhos e coelhinhos que crescem em casa'], ['Convida os amigos', 'Decora a tua casa e faz uma festa'], ['Sobe na carreira', '14 empregos – de pizzaiolo a chefe'], ['Explora a cidade toda', 'Margem Sul, o parque, o subúrbio e a Baixa'], ['A cidade vive dia e noite', 'Com sol e com chuva']],
};
if (LANG !== 'sv') {
  if (!RUBRIKER[LANG]) throw new Error(`inga rubriker för --lang ${LANG}`);
  BILDER.forEach((B, i) => { [B.rubrik, B.under] = RUBRIKER[LANG][i]; });
}

const bara = process.argv.includes('--bara') ? process.argv[process.argv.indexOf('--bara') + 1].split(',') : null;
const val = Object.keys(ENHETER).includes(process.argv[2]) ? process.argv[2] : null;
const browser = await chromium.launch();
for (const [enhet, E] of Object.entries(ENHETER)) {
  if ((val && val !== enhet) || process.argv.includes('--rubriker')) continue;
  const ctx = await browser.newContext({ viewport: { width: E.vp[0], height: E.vp[1] }, deviceScaleFactor: E.dsf, isMobile: true, hasTouch: true });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => console.log('sidfel:', e.message));
  await p.goto(`http://localhost:${PORT}/index.html?nomenu&mobfill=1&tradgard&lang=${LANG}&world=store${Date.now().toString(36)}`);
  await p.evaluate((deco) => {
    localStorage.clear();
    localStorage.setItem('snabbfilen_tips_hus', '1');
    localStorage.setItem('snabbfilen_avatar', JSON.stringify({ name: 'Alva', look: { skin: '#eec3a0', hair: '#d9a95c', style: 'long', shirt: '#c65fa0', pants: '#2d3a5c' }, color: '#ff5dc8' }));
    localStorage.setItem('snabbfilen_save1', JSON.stringify({ v: 1, day: 12, min: 13 * 60, money: 48250, hunger: 82, energy: 91, home: 'villa', fridge: {}, jobs: { pizzeria: 6, kafe: 3 }, earned: 23400, wardrobe: [], storage: [], deco: { 'villa:0': deco }, won: false, lycka: 78 }));
  }, FEST_HEM);
  await p.reload();
  await p.waitForFunction(() => !!window.SF?.game, null, { timeout: 20000 });
  await p.waitForTimeout(1500);
  const D = (fn, arg) => p.evaluate(fn, arg);
  const vila = (ms) => p.waitForTimeout(ms);
  const stad = async () => { await D(() => { document.querySelectorAll('#toasts .toast').forEach((t) => t.remove()); const m = document.querySelector('#modal'); m.classList.add('hidden'); m.innerHTML = ''; document.querySelector('#sf-update')?.remove(); }); };
  const ta = async (id) => { if (id === 'frisor') await D(() => document.querySelectorAll('#toasts .toast').forEach((t) => t.remove())); else await stad(); await vila(150); await p.screenshot({ path: path.join(OUT, `${enhet}-${id}-ra.png`) }); console.log(enhet, id); };
  // klick i scenen på en klickbar sak (scenkoordinater → sidkoordinater, som tools/frisor-test.mjs)
  const klicka = async (id) => {
    const pt = await D((id) => {
      const A = window.SF, s = A.scene._debug.spot(id), cv = document.querySelector('#scene'), r = cv.getBoundingClientRect();
      if (!s) return null;
      const lw = cv.width / A.pxs, lh = cv.height / A.pxs;
      return { x: r.left + (s.x + A.view.boxX) * r.width / lw, y: r.top + (s.y + A.view.boxY) * r.height / lh };
    }, id);
    if (pt) await p.mouse.click(pt.x, pt.y);
    return !!pt;
  };
  const tillStad = async (distrikt, dx, min) => {
    await D((min) => { const A = window.SF; A.game.min = min; A.go('city'); }, min);
    await vila(800);
    await D(([d0, dx]) => { const A = window.SF, d = A.scene._debug.district(d0); A.scene._debug.teleport(d.spawn.x + dx, d.spawn.y); }, [distrikt, dx]);
    await vila(5000);
  };

  const SCENER = {
    stan: async () => { await tillStad('CENTRUM', 200, 13 * 60); },
    frisor: async () => {
      await D(() => { window.SF.game.min = 11 * 60; window.SF.go('frisor'); });
      await vila(2500);
      // figuren i stol 2 med frisyrväljaren öppen – menyn med alla frisyrer och hårfärger (Carl)
      await D(() => { const d = window.SF.scene._debug; d.sit(1); d.samiNow(); if (!document.querySelector('#modal:not(.hidden)')) d.openChooser(); });
      await vila(2500);
    },
    odla: async () => {
      await D(() => {
        const A = window.SF, g = A.game; g.min = 10 * 60;
        const gd = g.garden(), G = ['tomat', 'morot', 'potatis', 'paprika', 'lok', 'rodlok', 'tomat', 'morot'];
        gd.beds.forEach((_, i) => { gd.beds[i] = null; g.plant(i, G[i % G.length]); const b = gd.beds[i]; if (b) { b.v = [9, 2, 9, 3, 1, 9, 4, 2][i % 8]; b.vat = g.day; } });
        g.save(); A.go('tradgard');
      });
      await vila(3000);
    },
    husdjur: async () => {
      // djuraffären, hundavdelningen: rasporträtten, valparna i hagarna och poolen (Carl: "man ska se bild på djuren")
      await D(() => { window.SF.game.min = 14 * 60; window.SF.go('djur'); });
      await vila(1500);
      await D(() => { const d = window.SF.scene._debug; d.teleport(610, 150); d.lockCam(384); });
      await vila(3000);
    },
    husdjurHemma: async () => {
      await D(async () => {
        const { petStore } = await import('/js/pets/sim.js');
        const s = petStore(), g = window.SF.game;
        g.min = 14 * 60;
        s.reset();
        s.adopt('hund', '', 'hane', 'Bamse', g.home, { day: g.day - 9 });
        s.adopt('katt', '', 'hona', 'Misse', g.home, { day: g.day - 9 });
        s.adopt('kanin', '', 'hona', 'Stampe', g.home, { day: g.day - 9 });
        s.adopt('katt', '', 'hane', 'Sixten', g.home, { day: g.day - 2 });
        for (const k of ['matskal', 'sack-katt', 'sack-hund']) s.buyItem(k, 1);
        window.SF.go('city'); window.SF.roomSub = 0; window.SF.go('room');
      });
      await vila(6000);
    },
    fest: async () => {
      await D(() => { const A = window.SF; A.game.min = 19 * 60 + 55; A.game.festDag = 0; A.roomSub = 0; A.go('room'); });
      await vila(2000);
      await D(async () => { const F = await import('/js/core/fest.js'); F.startFest(window.SF, { n: 8, mat: 'tarta' }); window.SF.game.min = 20 * 60 + 20; });
      await vila(16000);
    },
    jobb: async () => { await D(() => { window.SF.go('jobbpizzeria', { onDone: () => {} }); }); await vila(10000); },
    leksaker: async () => { await D(() => { window.SF.game.min = 15 * 60; window.SF.go('leksaker'); }); await vila(3500); },
    klader: async () => { await D(() => { window.SF.game.min = 15 * 60; window.SF.go('klader'); }); await vila(3500); },
    soder: async () => { await tillStad('SÖDER', 300, 12 * 60); },
    kvall: async () => { await tillStad('PARKEN', 120, 21 * 60 + 30); },
  };
  for (const B of BILDER) {
    if (bara && !bara.includes(B.id)) continue;
    await SCENER[B.id]();
    await ta(B.id);
    await D(async () => { if (window.SF.fest) { try { const F = await import('/js/core/fest.js'); F.endFest(window.SF); } catch { /* ok */ } window.SF.fest = null; } });
  }
  await ctx.close();
}

// ---------- rubrikerna: spelets röda dialoghuvud ovanför bilden ----------
const c = await browser.newPage();
await c.goto(`http://localhost:${PORT}/version.json`);
for (const enhet of Object.keys(ENHETER)) {
  if (val && val !== enhet) continue;
  // bort med gamla numrerade bilder som inte längre finns i urvalet
  for (const f of fs.readdirSync(OUT)) if (f.startsWith(enhet + '-') && /^[a-z]+-\d+-/.test(f) && !BILDER.some((B, i) => f === `${enhet}-${i + 1}-${B.id}.png`)) fs.rmSync(path.join(OUT, f));
  for (const [i, B] of BILDER.entries()) {
    const ra = path.join(OUT, `${enhet}-${B.id}-ra.png`);
    if (!fs.existsSync(ra)) continue;
    const url = await c.evaluate(async ({ src, B }) => {
      const ff = new FontFace('Pixelstad', 'url(/assets/fonts/pixelstad.otf)', { weight: '400' }); await ff.load(); document.fonts.add(ff);
      const img = await new Promise((ok) => { const im = new Image(); im.onload = () => ok(im); im.src = src; });
      const W = img.width, H = img.height, u = Math.round(H / 220);            // u = ramens pixelkorn
      const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
      const g = cv.getContext('2d'); g.imageSmoothingEnabled = false;
      g.fillStyle = '#1c1a22'; g.fillRect(0, 0, W, H);
      const band = Math.round(H * 0.17);
      // rubrikbandet: rött med ljus överkant och mörk underkant, som spelets dialoghuvud
      g.fillStyle = '#a31d24'; g.fillRect(0, 0, W, band);
      g.fillStyle = '#c3333a'; g.fillRect(0, 0, W, u);
      g.fillStyle = '#6a1218'; g.fillRect(0, band - u, W, u);
      // texten: Pixelstad i vanlig vikt (den feta tänder pixeln till höger och gör 'm' till en kloss) i en
      // heltalsmultipel av em = 12 px (docs/PIXELGRAFIK.md), ritad direkt i slutstorleken och tröskad
      // till skarpa kanter; rubriken får en hård skugga på en typsnittspixel
      const txt = (t, col, skugga, k) => {
        const f = `400 ${12 * k}px Pixelstad`, m = document.createElement('canvas').getContext('2d'); m.font = f;
        const w = Math.ceil(m.measureText(t).width) + 3 * k, c2 = document.createElement('canvas'); c2.width = w; c2.height = 16 * k;
        const q = c2.getContext('2d'); q.font = f; q.textBaseline = 'alphabetic';
        if (skugga) { q.fillStyle = skugga; q.fillText(t, 2 * k, 11 * k); }
        q.fillStyle = col; q.fillText(t, k, 10 * k);
        const d = q.getImageData(0, 0, w, c2.height);
        for (let i = 3; i < d.data.length; i += 4) d.data[i] = d.data[i] < 128 ? 0 : 255;
        q.putImageData(d, 0, 0);
        return c2;
      };
      // längre rubriker på andra språk: ett pixelkorn mindre tills texten ryms med marginal
      const ryms = (t, k) => { const m = document.createElement('canvas').getContext('2d'); m.font = `400 ${12 * k}px Pixelstad`; return m.measureText(t).width + 3 * k <= W * 0.92; };
      let k1 = Math.max(2, Math.round(band * 0.42 / 12)), k2 = Math.max(1, Math.round(band * 0.2 / 12));
      while (k1 > 2 && !ryms(B.rubrik, k1)) k1--;
      while (k2 > 1 && !ryms(B.under, k2)) k2--;
      const t1 = txt(B.rubrik, '#ffffff', '#3a0a10', k1), t2 = txt(B.under, '#f6d2c8', null, k2);
      g.drawImage(t1, Math.round((W - t1.width) / 2), Math.round(band * 0.40 - 8 * k1));
      g.drawImage(t2, Math.round((W - t2.width) / 2), Math.round(band * 0.80 - 8 * k2));
      // spelbilden under, med ljus ram och hård skugga
      const top = band + Math.round(H * 0.035), avail = H - top - Math.round(H * 0.035);
      const sh = avail, sw = Math.round(W * sh / H), x = Math.round((W - sw) / 2);
      g.fillStyle = '#0c0b10'; g.fillRect(x + 2 * u, top + 2 * u, sw, sh);
      g.drawImage(img, x, top, sw, sh);
      g.strokeStyle = '#f4f1ea'; g.lineWidth = u; g.strokeRect(x - u / 2, top - u / 2, sw + u, sh + u);
      return cv.toDataURL('image/png');
    }, { src: 'data:image/png;base64,' + fs.readFileSync(ra).toString('base64'), B });
    fs.writeFileSync(path.join(OUT, `${enhet}-${i + 1}-${B.id}.png`), Buffer.from(url.split(',')[1], 'base64'));
  }
}
await browser.close();
console.log('klart →', path.relative(process.cwd(), OUT));
