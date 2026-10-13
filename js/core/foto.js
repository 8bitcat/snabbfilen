// 📸 FOTOLÄGET + 🖼️ BILDERNA ("bygg allting" 2026-10-12: fotoläge + vykort) – ta bilder i Pixelstaden.
//   • 📷 Kamera i mobilen: knapparna och mätarna försvinner (html.foto-lage), spelet ritar bara världen
//     (js/core/fotolage.js foto.pa) och en sökare visas. Man går som vanligt och väljer
//       🎨 filter: Normal, Sommar, Svartvitt, Gammalt foto, Retro (fyra gröna toner), Drömland
//       🖼️ ram:    Ingen, Snabbfoto (vit kant, plats + datum), Vykort ("Hälsningar från …" + frimärke), Guldram, Filmremsa
//     (inga varumärken i namnen – App Store 5.2)
//       🙋 pose:   Ingen, 👋 Vinka, 🙌 Jubla, 💕 Hjärtan (drakt.js posera – kompisarna ser den också)
//       ⏱ självutlösare: av / 3 sekunder
//     📸 knäpper: bilden tas ur spelets canvas i spelpixlar (ett pixelkorn, A.pxs bort) – bara den del som syns på
//     skärmen – med filtret och ramen, och hamnar i albumet. Förhandsvisningen ritas varje bildruta på en egen
//     canvas ovanpå spelet (#foto-vy), så det man ser är precis det som blir bilden.
//   • 🖼️ Bilder i mobilen: figurens album (IndexedDB 'snabbfilen-foton', högst 60 bilder per figur – syskon på samma
//     iPad har var sitt), stor bild, ta bort, 💾 spara som fil (på webben, fyra gånger större och knivskarp).
//     I appen behövs en ny version med lov att spara i telefonens Bilder (NSPhotoLibraryAddUsageDescription).
// Esc stänger kameran, mellanslag eller Enter knäpper. Öppnas en dialog stängs kameran.
import { $t } from './i18n.js';
import { openModal, closeModal, toast, esc, modalOpen } from './ui.js';
import { play } from './sound.js';
import { foto } from './fotolage.js';
import { posera, POSER } from './drakt.js';
import { isMenuOpen } from './menu.js';
import { SMALL, BIG, ctxText, textW, bayer } from './floor-pix.js';

export const MAX_BILDER = 60;
const FILTER = [['normal', $t('Normal')], ['sommar', $t('Sommar')], ['svartvit', $t('Svartvitt')], ['gammal', $t('Gammalt foto')], ['retro', $t('Retro')], ['drom', $t('Drömland')]];
const RAMAR = [['ingen', $t('Ingen')], ['snabbfoto', $t('Snabbfoto')], ['vykort', $t('Vykort')], ['guld', $t('Guldram')], ['film', $t('Filmremsa')]];
const VAL = 'snabbfilen_foto_val';
const val = (() => { try { const v = JSON.parse(localStorage.getItem(VAL) || '{}'); return { filter: v.filter | 0, ram: v.ram | 0, timer: !!v.timer, pose: 0 }; } catch { return { filter: 0, ram: 0, timer: false, pose: 0 }; } })();
const sparaVal = () => { try { localStorage.setItem(VAL, JSON.stringify({ filter: val.filter, ram: val.ram, timer: val.timer })); } catch { /* ok */ } };
const appen = () => { try { return !!window.Capacitor?.isNativePlatform?.(); } catch { return false; } };

let A = null, rot = null, vy = null, vctx = null, sikte = null, rakna = null, blixt = null, tumme = null;
let raf = 0, nedrakning = 0, skickat = 0, senaste = null;

// ---------- platsen på bilden (snabbfotot och vykortet) ----------
const TASS = /^(tassbacken|trimmaren|utstallning|kattcafe|djurhem|djurklinik|agility|kaninhopp)$/;
function platsNamn() {
  const s = String(A?.sceneName || 'city');
  if (s === 'room' || s === 'koket' || s === 'tradgard') return $t('HEMMA');
  if (TASS.test(s)) return 'TASSBACKEN';
  if (s === 'landet' || s === 'hopp') return $t('LANDET');
  return $t('PIXELSTADEN');
}
// vykortets hälsning – hela fraser, så att varje språk kan böja dem rätt
function halsning() {
  const s = String(A?.sceneName || 'city');
  if (s === 'room' || s === 'koket' || s === 'tradgard') return $t('HÄLSNINGAR HEMIFRÅN');
  if (TASS.test(s)) return $t('HÄLSNINGAR FRÅN TASSBACKEN');
  if (s === 'landet' || s === 'hopp') return $t('HÄLSNINGAR FRÅN LANDET');
  return $t('HÄLSNINGAR FRÅN PIXELSTADEN');
}
const datum = (t) => { const d = new Date(t); return `${d.getDate()}/${d.getMonth() + 1} ${d.getFullYear()}`; };

// ---------- kameran ----------
export const kameraPa = () => foto.pa;
export function openKamera(A0) {
  A = A0;
  if (foto.pa || typeof document === 'undefined') return;
  if (A.shiftJob) { toast($t('📷 Kameran får vila medan du jobbar – ta bilder efter passet!'), 'bad'); return; }
  bygg();
  foto.pa = true;
  document.documentElement.classList.add('foto-lage');
  rot.classList.remove('hidden');
  val.pose = 0;
  play('click');
  knappar();
  uppdateraTumme();
  cancelAnimationFrame(raf);
  raf = requestAnimationFrame(loop);
}
export function stangKamera() {
  if (!foto.pa) return;
  foto.pa = false;
  cancelAnimationFrame(raf);
  clearInterval(nedrakning); nedrakning = 0;
  rakna?.classList.add('hidden');
  if (A) posera(A, null);
  document.documentElement.classList.remove('foto-lage');
  rot?.classList.add('hidden');
}

function bygg() {
  if (rot) return;
  rot = document.createElement('div');
  rot.id = 'foto'; rot.className = 'hidden';
  rot.innerHTML = `<canvas id="foto-vy"></canvas><div class="foto-sikte"><i></i><i></i><i></i><i></i></div>
    <div class="foto-rakna hidden"></div><div class="foto-blixt"></div>
    <div class="foto-bar">
      <button type="button" class="btn btn-small" data-f="filter"></button>
      <button type="button" class="btn btn-small" data-f="ram"></button>
      <button type="button" class="btn btn-small" data-f="pose"></button>
      <button type="button" class="btn btn-small" data-f="timer"></button>
      <button type="button" class="btn btn-small foto-stang" data-f="stang" title="${esc($t('Stäng kameran (Esc)'))}">✕</button>
    </div>
    <div class="foto-sida">
      <button type="button" class="foto-knapp" data-f="knapp" title="${esc($t('Knäpp! (mellanslag)'))}"><span>📸</span></button>
      <button type="button" class="foto-tumme" data-f="album" title="${esc($t('🖼️ Bilder'))}"></button>
    </div>`;
  document.body.append(rot);
  vy = rot.querySelector('#foto-vy'); vctx = vy.getContext('2d');
  sikte = rot.querySelector('.foto-sikte'); rakna = rot.querySelector('.foto-rakna'); blixt = rot.querySelector('.foto-blixt'); tumme = rot.querySelector('.foto-tumme');
  rot.addEventListener('click', (e) => {
    const b = e.target.closest('[data-f]');
    if (!b) return;
    const f = b.dataset.f;
    if (f === 'stang') { stangKamera(); return; }
    if (f === 'knapp') { knapp(); return; }
    if (f === 'album') { const id = senaste; stangKamera(); openBilder(A, { visa: id }); return; }
    play('click');
    if (f === 'filter') val.filter = (val.filter + 1) % FILTER.length;
    if (f === 'ram') val.ram = (val.ram + 1) % RAMAR.length;
    if (f === 'timer') val.timer = !val.timer;
    if (f === 'pose') { val.pose = (val.pose + 1) % (POSER.length + 1); posera(A, POSER[val.pose - 1] || null); skickat = performance.now(); }
    sparaVal(); knappar();
  });
  window.addEventListener('keydown', (e) => {
    if (!foto.pa || modalOpen() || /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || '')) return;
    if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); stangKamera(); }
    else if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); e.stopImmediatePropagation(); knapp(); }
  }, true);
}
function knappar() {
  const s = (f, txt) => { const b = rot.querySelector(`[data-f="${f}"]`); if (b && b.textContent !== txt) b.textContent = txt; };
  s('filter', `🎨 ${FILTER[val.filter][1]}`);
  s('ram', `🖼️ ${RAMAR[val.ram][1]}`);
  const p = POSER[val.pose - 1];
  s('pose', p ? `${p.e} ${p.namn}` : `🙋 ${$t('Ingen pose')}`);
  s('timer', val.timer ? `⏱ ${$t('3 sek')}` : `⏱ ${$t('Direkt')}`);
}

// varje bildruta: förhandsvisningen (= bilden) över den del av spelet som syns
function loop() {
  raf = requestAnimationFrame(loop);
  if (!foto.pa) return;
  if (modalOpen() || isMenuOpen() || A?.attract) { stangKamera(); return; }
  // fotoposen: kompisarna ser emoten i 2,6 s – skicka den igen så länge den hålls
  const p = POSER[val.pose - 1];
  if (p && performance.now() - skickat > 2000) { skickat = performance.now(); try { A.sendEmote?.(p.e); } catch { /* ok */ } }
  rita();
}
function rita() {
  const cv = document.getElementById('scene'), app = document.getElementById('app');
  if (!cv || !app || !cv.width) return false;
  const s = Math.max(1, A.pxs | 0), gw = Math.round(cv.width / s), gh = Math.round(cv.height / s);
  const r = cv.getBoundingClientRect(), b = app.getBoundingClientRect();
  // bilden = det som syns under inställningsraden och till vänster om avtryckaren (som en telefonkamera i liggande
  // läge – figuren står ofta lågt i bild, så nederkanten får vara kvar) – resten tonas ner runt sökaren
  const bar = rot.querySelector('.foto-bar').getBoundingClientRect(), sida = rot.querySelector('.foto-sida').getBoundingClientRect();
  const ix0 = Math.max(r.left, b.left, 0), iy0 = Math.max(r.top, b.top, 0, bar.height ? bar.bottom + 6 : 0);
  const ix1 = Math.min(r.right, b.right, window.innerWidth, sida.width ? sida.left - 8 : Infinity);
  const iy1 = Math.min(r.bottom, b.bottom, window.innerHeight);
  if (ix1 - ix0 < 16 || iy1 - iy0 < 16) return false;
  const kx = gw / r.width, ky = gh / r.height;
  const x0 = Math.max(0, Math.floor((ix0 - r.left) * kx)), y0 = Math.max(0, Math.floor((iy0 - r.top) * ky));
  const w = Math.min(gw - x0, Math.ceil((ix1 - r.left) * kx) - x0), h = Math.min(gh - y0, Math.ceil((iy1 - r.top) * ky) - y0);
  if (w < 16 || h < 16) return false;
  if (vy.width !== w) vy.width = w;
  if (vy.height !== h) vy.height = h;
  const L = r.left + x0 / kx, T = r.top + y0 / ky, Wc = w / kx, Hc = h / ky;
  for (const el of [vy, sikte]) { el.style.left = L + 'px'; el.style.top = T + 'px'; el.style.width = Wc + 'px'; el.style.height = Hc + 'px'; }
  vctx.imageSmoothingEnabled = false;
  vctx.clearRect(0, 0, w, h);
  vctx.drawImage(cv, x0 * s, y0 * s, w * s, h * s, 0, 0, w, h);
  filtrera(vctx, w, h, FILTER[val.filter][0]);
  ram(vctx, w, h, RAMAR[val.ram][0]);
  return true;
}

// ---------- filtren (i spelpixlar – Retro och det gamla fotot rastreras som pixelgrafik) ----------
const GB = [[15, 56, 15], [48, 98, 48], [139, 172, 15], [155, 188, 15]];
function filtrera(ctx, w, h, f) {
  if (f === 'normal') return;
  const im = ctx.getImageData(0, 0, w, h), d = im.data;
  const cx = w / 2, cy = h / 2, rr = cx * cx + cy * cy;
  for (let y = 0, i = 0; y < h; y++) for (let x = 0; x < w; x++, i += 4) {
    let r = d[i], g = d[i + 1], b = d[i + 2];
    const l = 0.3 * r + 0.59 * g + 0.11 * b;
    if (f === 'sommar') { r = l + (r - l) * 1.25 + 14; g = l + (g - l) * 1.2 + 6; b = l + (b - l) * 1.1 - 8; }
    else if (f === 'svartvit') { const v = (l - 128) * 1.18 + 128; r = g = b = v; }
    else if (f === 'gammal') {
      // sepia, blekt mot krämvitt och en rastrerad mörk kant (vinjett i fyra steg)
      let sr = 0.393 * r + 0.769 * g + 0.189 * b, sg = 0.349 * r + 0.686 * g + 0.168 * b, sb = 0.272 * r + 0.534 * g + 0.131 * b;
      sr = sr * 0.85 + 240 * 0.15; sg = sg * 0.85 + 224 * 0.15; sb = sb * 0.85 + 190 * 0.15;
      const dd = ((x - cx) ** 2 + (y - cy) ** 2) / rr, steg = Math.floor(Math.max(0, dd - 0.35) * 6 + bayer(x, y) * 0.9);
      const k = 1 - Math.min(3, steg) * 0.12;
      r = sr * k; g = sg * k; b = sb * k;
    } else if (f === 'retro') {
      const n = Math.max(0, Math.min(3, Math.floor(l / 256 * 4 + (bayer(x, y) - 0.5) * 0.9)));
      [r, g, b] = GB[n];
    } else if (f === 'drom') { r = r * 0.78 + 255 * 0.22 + 10; g = g * 0.74 + 190 * 0.26; b = b * 0.72 + 240 * 0.28 + 8; }
    d[i] = r < 0 ? 0 : r > 255 ? 255 : r; d[i + 1] = g < 0 ? 0 : g > 255 ? 255 : g; d[i + 2] = b < 0 ? 0 : b > 255 ? 255 : b;
  }
  ctx.putImageData(im, 0, 0);
}

// ---------- ramarna (ritade i spelpixlar ovanpå bilden) ----------
const F = (ctx, x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); };
function ram(ctx, w, h, r) {
  if (r === 'ingen') return;
  if (r === 'snabbfoto') {
    const s = Math.max(4, Math.round(Math.min(w, h) * 0.035)), nb = Math.max(18, s * 4);
    F(ctx, 0, 0, w, s, '#f6f3ec'); F(ctx, 0, 0, s, h, '#f6f3ec'); F(ctx, w - s, 0, s, h, '#f6f3ec'); F(ctx, 0, h - nb, w, nb, '#f6f3ec');
    F(ctx, s, s, w - 2 * s, 1, 'rgba(0,0,0,.25)'); F(ctx, s, s, 1, h - nb - s, 'rgba(0,0,0,.18)');
    F(ctx, 0, h - 1, w, 1, '#d8d2c4'); F(ctx, w - 1, 0, 1, h, '#d8d2c4');
    const txt = `${platsNamn()} · ${datum(Date.now())}`;
    ctxText(ctx, BIG, txt, Math.round((w - textW(BIG, txt)) / 2), h - nb + Math.round((nb - 7) / 2), '#3a3440');
    return;
  }
  if (r === 'vykort') {
    // vit kant, frimärke uppe till höger med poststämpel, "HÄLSNINGAR FRÅN …" på ett band nertill
    F(ctx, 0, 0, w, 3, '#fffdf6'); F(ctx, 0, h - 3, w, 3, '#fffdf6'); F(ctx, 0, 0, 3, h, '#fffdf6'); F(ctx, w - 3, 0, 3, h, '#fffdf6');
    const fx = w - 30, fy = 7;
    F(ctx, fx - 1, fy - 1, 24, 30, '#fffdf6');
    for (let i = 0; i < 24; i += 2) { F(ctx, fx - 1 + i, fy - 2, 1, 1, '#fffdf6'); F(ctx, fx - 1 + i, fy + 29, 1, 1, '#fffdf6'); }
    for (let j = 0; j < 30; j += 2) { F(ctx, fx - 2, fy - 1 + j, 1, 1, '#fffdf6'); F(ctx, fx + 23, fy - 1 + j, 1, 1, '#fffdf6'); }
    F(ctx, fx + 1, fy + 1, 20, 26, '#4a8de0'); F(ctx, fx + 1, fy + 18, 20, 9, '#52b464');
    F(ctx, fx + 13, fy + 4, 5, 5, '#ffd23f'); F(ctx, fx + 4, fy + 12, 3, 6, '#e04848'); F(ctx, fx + 3, fy + 11, 5, 2, '#9e2a2e');
    ctxText(ctx, SMALL, '5 KR', fx + 3, fy + 20, '#ffffff');
    for (let k = 0; k < 4; k++) F(ctx, fx - 14, fy + 6 + k * 4, 18, 1, 'rgba(40,30,60,.55)');
    const txt = halsning(), tw = textW(BIG, txt);
    const bx = 8, by = h - 22;
    F(ctx, bx - 1, by - 1, tw + 12, 15, '#1c1820'); F(ctx, bx, by, tw + 10, 13, '#e04848'); F(ctx, bx, by + 11, tw + 10, 2, '#9e2a2e');
    ctxText(ctx, BIG, txt, bx + 5, by + 3, '#fffdf6');
    return;
  }
  if (r === 'guld') {
    const band = ['#5a3c10', '#a8701c', '#e8b230', '#ffe68a', '#fff6c8', '#e8b230', '#a8701c', '#3a2408'];
    band.forEach((c, i) => { F(ctx, i, i, w - 2 * i, 1, c); F(ctx, i, h - 1 - i, w - 2 * i, 1, c); F(ctx, i, i, 1, h - 2 * i, c); F(ctx, w - 1 - i, i, 1, h - 2 * i, c); });
    for (const [x, y] of [[2, 2], [w - 9, 2], [2, h - 9], [w - 9, h - 9]]) { F(ctx, x, y, 7, 7, '#ffe68a'); F(ctx, x + 1, y + 1, 5, 5, '#a8701c'); F(ctx, x + 2, y + 2, 3, 3, '#fff6c8'); F(ctx, x + 3, y + 3, 1, 1, '#e04848'); }
    for (let x = 14; x < w - 14; x += 12) { F(ctx, x, 3, 2, 2, '#fff6c8'); F(ctx, x, h - 5, 2, 2, '#fff6c8'); }
    return;
  }
  if (r === 'film') {
    const b = 9;
    F(ctx, 0, 0, w, b, '#141016'); F(ctx, 0, h - b, w, b, '#141016');
    for (let x = 3; x < w - 3; x += 9) { F(ctx, x, 3, 4, 3, '#e9e2d0'); F(ctx, x, h - 6, 4, 3, '#e9e2d0'); }
    ctxText(ctx, SMALL, 'PIXELFILM 400', 6, h - b - 8, '#ff9d2a');
    ctxText(ctx, SMALL, datum(Date.now()), w - 6 - textW(SMALL, datum(Date.now())), h - b - 8, '#ff9d2a');
  }
}

// ---------- knäpp ----------
function knapp() {
  if (!foto.pa || nedrakning) return;
  if (!val.timer) { ta(); return; }
  let n = 3;
  rakna.textContent = String(n); rakna.classList.remove('hidden'); play('click');
  nedrakning = setInterval(() => {
    n -= 1;
    if (n > 0) { rakna.textContent = String(n); play('click'); return; }
    clearInterval(nedrakning); nedrakning = 0; rakna.classList.add('hidden');
    ta();
  }, 1000);
}
async function ta() {
  if (!foto.pa || !rita()) return;
  const png = vy.toDataURL('image/png');
  play('foto');
  blixt.classList.add('pa'); setTimeout(() => blixt.classList.remove('pa'), 60);
  const av = A.avatar;
  try {
    const mina = await fotonFor(av);
    if (mina.length >= MAX_BILDER) { toast($t`🖼️ Albumet är fullt (${MAX_BILDER} bilder) – ta bort några i 🖼️ Bilder först.`, 'bad'); return; }
    const post = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), av: String(av?.id || '?'), t: Date.now(), w: vy.width, h: vy.height, plats: platsNamn(), filter: FILTER[val.filter][0], ram: RAMAR[val.ram][0], png };
    await dbPut(post);
    senaste = post.id;
    uppdateraTumme(png);
    A.game?.glad?.(2, '', 'foto', 4);
    toast($t('📸 Klick! Bilden ligger i 🖼️ Bilder.'), 'good');
  } catch { toast($t('🖼️ Bilden gick inte att spara här.'), 'bad'); }
}
async function uppdateraTumme(png) {
  if (!tumme) return;
  if (!png) { try { const f = (await fotonFor(A?.avatar))[0]; png = f?.png; senaste = f?.id || null; } catch { png = null; } }
  tumme.innerHTML = png ? `<img src="${png}" alt="">` : '🖼️';
}

// ---------- albumet (IndexedDB) ----------
const DB = 'snabbfilen-foton', ST = 'foton';
let dbP = null;
function db() {
  if (!dbP) dbP = new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => { const s = r.result.createObjectStore(ST, { keyPath: 'id' }); s.createIndex('av', 'av'); };
    r.onsuccess = () => res(r.result);
    r.onerror = () => { dbP = null; rej(r.error); };
  });
  return dbP;
}
async function req(mode, fn) {
  const d = await db();
  return new Promise((res, rej) => { const t = d.transaction(ST, mode), q = fn(t.objectStore(ST)); t.oncomplete = () => res(q?.result); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error); });
}
const dbPut = (post) => req('readwrite', (s) => s.put(post));
const dbBort = (id) => req('readwrite', (s) => s.delete(id));
// figurens bilder, nyast först
export async function fotonFor(av) {
  const lista = (await req('readonly', (s) => s.index('av').getAll(String(av?.id || '?')))) || [];
  return lista.sort((a, b) => b.t - a.t);
}

export async function openBilder(A0, { visa = null } = {}) {
  A = A0;
  let lista = [];
  try { lista = await fotonFor(A.avatar); } catch { /* ingen lagring (privat fönster) – tomt album */ }
  if (visa) { const f = lista.find((x) => x.id === visa); if (f) { visaFoto(f, lista); return; } }
  const dlg = openModal($t('🖼️ Bilder'), lista.length
    ? `<p style="font-size:var(--f2);margin-top:0">${$t`${lista.length} av ${MAX_BILDER} bilder. Tryck på en bild för att se den stor.`}</p>
       <div class="fo-grid">${lista.map((f, i) => `<button type="button" class="fo-ruta" data-fo="${i}"><img src="${f.png}" alt=""></button>`).join('')}</div>`
    : `<p style="font-size:var(--f2);margin-top:0">${$t('Inga bilder än!')}</p><p style="font-size:var(--f2)">${$t('Öppna 📷 Kamera i mobilen, välj filter, ram och pose – och knäpp. Bilderna hamnar här.')}</p>`,
  [
    { label: $t('📷 Kamera'), cls: 'btn-go', onClick: () => { closeModal(); openKamera(A); } },
    { label: $t('Stäng'), onClick: closeModal },
  ]);
  dlg.querySelectorAll('[data-fo]').forEach((b) => (b.onclick = () => { play('click'); visaFoto(lista[+b.dataset.fo], lista); }));
}
function visaFoto(f, lista) {
  const i = lista.indexOf(f);
  const dlg = openModal($t('🖼️ Bilder'), `<div class="fo-stor"><img src="${f.png}" alt=""></div>
    <p class="sp" style="font-size:var(--f2);text-align:center;margin:6px 0 0">${esc(f.plats || '')} · ${esc(datum(f.t))} <small>(${i + 1}/${lista.length})</small></p>
    <div class="fo-bladdra">${i > 0 ? `<button type="button" class="btn btn-small" data-fobl="-1">◀</button>` : '<span></span>'}${i < lista.length - 1 ? `<button type="button" class="btn btn-small" data-fobl="1">▶</button>` : '<span></span>'}</div>`,
  [
    { label: $t('← Alla bilder'), onClick: () => openBilder(A) },
    { label: $t('💾 Spara'), hidden: appen(), onClick: () => sparaFil(f) },
    { label: $t('🗑️ Ta bort'), cls: 'btn-red', onClick: () => {
      openModal($t('🗑️ Ta bort bilden?'), `<div class="fo-stor liten"><img src="${f.png}" alt=""></div><p style="font-size:var(--f2)">${$t('Bilden försvinner för alltid.')}</p>`, [
        { label: $t('🗑️ Ja, ta bort'), cls: 'btn-red', onClick: async () => { try { await dbBort(f.id); } catch { /* ok */ } toast($t('🗑️ Bilden är borttagen.')); openBilder(A); } },
        { label: $t('Nej'), onClick: () => visaFoto(f, lista) },
      ]);
    } },
  ]);
  dlg.querySelectorAll('[data-fobl]').forEach((b) => (b.onclick = () => { play('click'); visaFoto(lista[i + +b.dataset.fobl], lista); }));
}
// 💾 som fil: förstorad med hela pixlar (ungefär 1920 bred), så att den blir skarp på datorn
function sparaFil(f) {
  const img = new Image();
  img.onload = () => {
    const k = Math.max(2, Math.min(8, Math.floor(1920 / img.width)));
    const c = document.createElement('canvas'); c.width = img.width * k; c.height = img.height * k;
    const x = c.getContext('2d'); x.imageSmoothingEnabled = false; x.drawImage(img, 0, 0, c.width, c.height);
    const a = document.createElement('a');
    a.href = c.toDataURL('image/png');
    const d = new Date(f.t);
    a.download = `pixelstaden-${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}-${f.id.slice(-4)}.png`;
    document.body.append(a); a.click(); a.remove();
    toast($t('💾 Bilden är sparad som fil.'), 'good');
  };
  img.src = f.png;
}
