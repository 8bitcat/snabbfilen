// Kontaktark för figurernas register och klädkatalogen (Playwright, riktiga motorn).
// Varje val ritas på en vuxen och ett barn i riktningarna ner/höger/upp i 3× skala,
// med etikett (namn, id, grupp). Bilderna delas upp så att ingen blir större än
// 2000 px. Används av innehållsspecialisterna och granskarna.
//
//   node tools/people-sheet.mjs                          alla register + katalogen
//   node tools/people-sheet.mjs --cat style,hairFx       bara vissa fält (LOOK_FIELDS-namn)
//   node tools/people-sheet.mjs --cat katalog            klädkatalogen (alla platser)
//   node tools/people-sheet.mjs --cat katalog:top        bara överdelarna i katalogen
//   node tools/people-sheet.mjs --cat top --only hoodie,vest     bara vissa id
//   node tools/people-sheet.mjs --cat top --from bomber          från och med ett id (nya poster)
//   node tools/people-sheet.mjs --frames 0,1,5           fler bildrutor (0 stå, 1/2 gå, 5 sitt …)
//   node tools/people-sheet.mjs --look '{"hair":"#ecd489","style":"bun"}'   ändra grundfiguren
//   node tools/people-sheet.mjs --dirs down,right,up,left --scale 4 --out tools/out/sheets --port 8788
//
// Skriver tools/out/sheets/<kategori>-<n>.png och en rad per fil. Kategorinamn:
//   style hairFx hairAcc eyes brows nose mouth ears cheeks makeup marks beard
//   top topPrint bottom bottomPrint shoeType hat glasses bag neck jewel phones  katalog[:slot]
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
const require = createRequire('D:/Qisy/QISYFrontend/QISYFrontend-1/package.json');
const { chromium } = require('playwright');

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : (process.argv[i + 1] !== undefined && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : true); };
const port = arg('port', '8788');
const outDir = arg('out', 'tools/out/sheets');
const opts = {
  cats: arg('cat', null) ? String(arg('cat')).split(',') : null,
  only: arg('only', null) ? String(arg('only')).split(',') : null,
  from: arg('from', null),
  frames: String(arg('frames', '0')).split(',').map(Number),
  dirs: String(arg('dirs', 'down,right,up')).split(','),
  scale: Math.max(1, Math.min(6, parseInt(arg('scale', '3'), 10) || 3)),
  look: arg('look', null) ? JSON.parse(arg('look')) : {},
  maxW: 2000, maxH: 2000,
};
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
page.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
// tom sida på spelets ursprung (så att modulerna kan importeras utan att spelet startar)
await page.route(`http://localhost:${port}/__sheet.html`, (r) => r.fulfill({ contentType: 'text/html', body: '<!doctype html><meta charset="utf-8"><body style="margin:0">' }));
await page.goto(`http://localhost:${port}/__sheet.html`);

const res = await page.evaluate(async (o) => {
  const P = await import('/js/core/people.js');
  const W = await import('/js/data/wardrobe.js');
  const S = o.scale, SPW = 24 * S, SPH = 41 * S;
  // grundfigur med färger där detaljer syns bra
  const BASE = {
    skin: '#e0a97f', hair: '#6b4226', style: 'short', top: 'tee', shirt: '#3a7bd5', accent: '#f0b429', bottom: 'jeans', pants: '#2d3a5c',
    shoes: '#c23b3b', hat: null, cap: '#46a35a', glasses: false, beard: false, phones: false, phoneColor: '#d9433b', bag: null, bagColor: '#8e5bd1',
    build: 5, blush: false, kid: false, ...o.look,
  };
  // vilka andra fält som ska nollas för att valet syns (t.ex. ingen hatt när frisyrer visas)
  const CLEAR = {
    style: { hat: null, phones: false, hairAcc: 'none' }, hairFx: { hat: null, phones: false, hairAcc: 'none', style: o.look.style || 'long' },
    hairAcc: { hat: null, phones: false, style: o.look.style || 'long' }, ears: { hat: null, phones: false, style: o.look.style || 'short' },
    beard: {}, top: { bag: null }, topPrint: { bag: null, top: o.look.top || 'tee' }, bottomPrint: { bottom: o.look.bottom || 'pants' },
  };
  const cells = [];
  const cats = o.cats || [...Object.keys(P.LOOK_FIELDS), 'katalog'];
  for (const cat of cats) {
    if (cat.startsWith('katalog')) {
      const slot = cat.split(':')[1];
      for (const s of W.SLOTS) {
        if (slot && s !== slot) continue;
        let items = W.itemsForSlot(s);
        if (o.only) items = items.filter((it) => o.only.includes(it.id));
        if (o.from) { const i = items.findIndex((it) => it.id === o.from); if (i >= 0) items = items.slice(i); }
        for (const it of items) cells.push({ cat: slot ? cat : 'katalog-' + s, label: it.name, sub: `${it.id} · ${it.price} kr · ${it.dept}${it.free ? ' · gratis' : ''}`, look: W.lookForItem(it, BASE, { colors: true }) });
      }
      continue;
    }
    const F = P.LOOK_FIELDS[cat];
    if (!F) { cells.push({ cat: 'okänd', label: `okänd kategori: ${cat}`, sub: '', look: null }); continue; }
    let ids = Object.keys(F.reg);
    if (o.only) ids = ids.filter((id) => o.only.includes(id));
    if (o.from) { const i = ids.indexOf(o.from); if (i >= 0) ids = ids.slice(i); }
    for (const id of ids) {
      const e = F.reg[id], v = P.valueOf(cat, id);
      cells.push({ cat, label: String(e.label).replace(/\u00ad/g, ''), sub: `${id}${e.group ? ' · ' + e.group : ''}`, look: { ...BASE, ...(CLEAR[cat] || {}), [cat]: v } });
    }
  }
  // cellens mått: vuxen + barn × riktningar × bildrutor
  const nSpr = o.dirs.length * o.frames.length;
  const CW = Math.max(220, nSpr * 2 * (SPW + 2) + 16 + 8), CH = SPH + 34;
  const cols = Math.max(1, Math.floor((o.maxW - 8) / (CW + 8)));
  const rows = Math.max(1, Math.floor((o.maxH - 40) / (CH + 8)));
  const perPage = cols * rows;
  const pages = [];
  // dela per kategori, sedan per sida
  const byCat = new Map();
  for (const c of cells) { if (!byCat.has(c.cat)) byCat.set(c.cat, []); byCat.get(c.cat).push(c); }
  const src = document.createElement('canvas'); src.width = 24; src.height = 41;
  const sx = src.getContext('2d');
  let ms = 0, nDraw = 0;
  for (const [cat, list] of byCat) {
    const nPages = Math.ceil(list.length / perPage);
    for (let p = 0; p < nPages; p++) {
      const part = list.slice(p * perPage, (p + 1) * perPage);
      const r = Math.ceil(part.length / cols), cUsed = Math.min(cols, part.length);
      const cv = document.createElement('canvas');
      cv.width = 8 + cUsed * (CW + 8); cv.height = 40 + r * (CH + 8);
      const x = cv.getContext('2d'); x.imageSmoothingEnabled = false;
      x.fillStyle = '#f3ede2'; x.fillRect(0, 0, cv.width, cv.height);
      x.fillStyle = '#17151a'; x.font = 'bold 18px monospace';
      x.fillText(`${cat} – ${list.length} val${nPages > 1 ? ` (sida ${p + 1}/${nPages})` : ''} · vuxen | barn · ${o.dirs.join('/')} · bildruta ${o.frames.join(',')}`, 10, 26);
      part.forEach((c, i) => {
        const cx = 8 + (i % cols) * (CW + 8), cy = 40 + Math.floor(i / cols) * (CH + 8);
        x.fillStyle = '#e4dccd'; x.fillRect(cx, cy, CW, CH);
        x.fillStyle = '#d6ccb9'; x.fillRect(cx + 8 + nSpr * (SPW + 2), cy + 30, 2, SPH);
        x.fillStyle = '#17151a'; x.font = 'bold 14px monospace'; x.fillText(c.label, cx + 6, cy + 14);
        x.fillStyle = '#6d6660'; x.font = '11px monospace'; x.fillText(c.sub, cx + 6, cy + 27);
        if (!c.look) return;
        let k = 0;
        for (const kid of [false, true]) {
          const L = { ...c.look, kid, build: kid ? 4 : c.look.build };
          for (const f of o.frames) for (const d of o.dirs) {
            sx.clearRect(0, 0, 24, 41);
            const t0 = performance.now();
            P.drawPerson(sx, 12, 39, L, d, f);
            ms += performance.now() - t0; nDraw++;
            x.drawImage(src, 0, 0, 24, 41, cx + 6 + k * (SPW + 2) + (kid ? 6 : 0), cy + 30, SPW, SPH);
            k++;
          }
        }
      });
      pages.push({ name: `${cat}-${p + 1}`, w: cv.width, h: cv.height, url: cv.toDataURL('image/png') });
    }
  }
  const counts = {};
  for (const f of Object.keys(P.LOOK_FIELDS)) counts[f] = Object.keys(P.LOOK_FIELDS[f].reg).length;
  for (const s of W.SLOTS) counts['katalog:' + s] = W.itemsForSlot(s).length;
  // registerkontroll: poster utan etikett/ritning, okänt utsnitt, front utan side (info åt granskarna –
  // en post kan medvetet sakna en vy, t.ex. ansiktsdetaljer bakifrån)
  const HOOKS = ['prep', 'afterLegs', 'afterHips', 'beforeTorso', 'afterTorso', 'beforeArms', 'afterArms', 'afterHead', 'afterFace', 'afterHair', 'last', 'legRow', 'sleeveAt', 'skirt', 'bareFrom'];
  const regNotes = [];
  for (const [f, F] of Object.entries(P.LOOK_FIELDS)) {
    if (o.cats && !o.cats.includes(f)) continue;
    const bad = { 'ritar inget': [], 'saknar label': [], 'okänd tile': [], 'front men ingen side': [] };
    for (const [id, e] of Object.entries(F.reg)) {
      if (id === 'none' || id === P.idOf(f, F.def)) continue;
      if (!e.label) bad['saknar label'].push(id);
      if (e.tile != null && !W.TILE_VIEWS.includes(e.tile)) bad['okänd tile'].push(id);
      if (!(e.front || e.back || e.side || HOOKS.some((h) => e[h] != null))) bad['ritar inget'].push(id);
      else if (e.front && !e.side) bad['front men ingen side'].push(id);
    }
    for (const [k, ids] of Object.entries(bad)) if (ids.length) regNotes.push(`${f}: ${k}: ${ids.join(', ')}`);
  }
  return { pages, counts, problems: W.checkWardrobe(), regNotes, msPerSprite: nDraw ? ms / nDraw : 0 };
}, opts);

for (const p of res.pages) {
  const file = path.join(outDir, p.name + '.png');
  fs.writeFileSync(file, Buffer.from(p.url.split(',')[1], 'base64'));
  console.log(`skrev ${file} (${p.w}×${p.h})`);
}
console.log('Antal val per register:', Object.entries(res.counts).map(([k, v]) => `${k} ${v}`).join(', '));
console.log(`Ritning: ${res.msPerSprite.toFixed(3)} ms/sprite (inkl. cachemiss)`);
console.log(res.problems.length ? 'KATALOGPROBLEM:\n  ' + res.problems.join('\n  ') : 'Katalogen: inga problem.');
if (res.regNotes.length) console.log('Registerkontroll (info – kolla att det är avsiktligt):\n  ' + res.regNotes.join('\n  '));
console.log(errs.length ? 'KONSOLFEL:\n' + errs.join('\n') : 'Inga konsolfel.');
await browser.close();
