// 🎣 FISKET PÅ SOLÖN (js/scenes/solon.js: färjebryggans yttersta del och klipporna vid fyren). Ett metspö köps i
// Solö-kiosken (120 kr). Fiskespelet i en ruta:
//   KASTA  – tryck: flötet flyger ut och landar med ett plask
//   VÄNTA  – flötet guppar (ibland ett litet nafs som lurar) – trycker man nu simmar fisken iväg
//   NAPP!  – flötet dyker: tryck direkt (svårare fiskar ger kortare tid)
//   KAMP   – en nål pendlar över en mätare: tryck när den är i det gröna fältet. Tre träffar = fångad, två missar = borta
// Fångsten: art + vikt. Matfisk ger fiskfilé i skafferiet (receptet Ugnsfisk med potatis), hummern köper fiskaren,
// stöveln och tången är bara roliga, och flaskposten har ett brev. 📒 Fångstboken: arterna man fått, antal och
// rekordvikt. Alla sex arterna → meriten 🎣 Fiskemästare i troféskåpet (game.js merit 'fiske').
// Sparas i g.fiske = { spo, arter: { [id]: { n, rekord } } }.
import { $t } from '../core/i18n.js';
import { openModal, closeModal, toast, esc } from '../core/ui.js';
import { play } from '../core/sound.js';
import { fmt, MAX_RAVA } from '../game.js';

export const SPO_PRIS = 120;
const PAL = { k: '#1e1a24', w: '#f4f1ea', W: '#ffffff', g: '#c8c4cf', G: '#7d7689', d: '#4a4452', b: '#4a8de0', B: '#2a5aa8', c: '#a8d4ff', n: '#52b464', N: '#2f7a3e', l: '#9be08a',
  y: '#ffd23f', Y: '#d19a1c', o: '#f08a2a', r: '#e04848', R: '#9e2a2e', s: '#d8dce4', S: '#9aa4b4', t: '#a89058', T: '#6e5a30', h: '#7a4a2a', H: '#4a2c18', p: '#ffb0c8', u: '#3a6a8a', U: '#24445c', e: '#8a6a3a', E: '#5a4424' };
// fiskformen (16 × 9, tittar åt vänster): kroppen en oval från nosen (kolumn 0) till stjärtroten (12), kluven stjärt
// (12–15), ryggfena. Färgerna: r = rygg, s = sida, b = buk; mönstret läggs ovanpå (ränder, prickar, fläckar, band).
const FORM = [
  '.....rrrr.......',
  '...krrrrrrrk..kk',
  '..krrrrrrrrrk.kr',
  '.kWrsssssssssk r',
  'kksssssssssssskk',
  '.kbbbbbbbbbbbk b',
  '..kbbbbbbbbbk.kb',
  '...kbbbbbbbk..kk',
  '....kkkkkkk.....',
];
function fisk(farg, monster = () => null) {
  return FORM.map((rad, j) => [...rad].map((ch, i) => {
    if (ch === '.' || ch === ' ') return ch === ' ' ? (j < 4 ? farg.r : farg.b) : '.';
    if (ch === 'k' || ch === 'W') return ch;
    return monster(i, j, ch) || farg[ch];
  }).join(''));
}
// fiskarna, skräpet och flaskposten
export const ARTER = [
  { id: 'stromming', namn: $t('Strömming'), mat: true, vikt: [0.05, 0.15], svar: 0.8, chans: 26, karta: fisk({ r: 'S', s: 's', b: 'w' }, (i, j) => (j === 3 && i % 3 === 0 ? 'c' : null)) },
  { id: 'makrill', namn: $t('Makrill'), mat: true, vikt: [0.3, 0.9], svar: 1, chans: 28, karta: fisk({ r: 'u', s: 'n', b: 's' }, (i, j) => (j <= 3 && (i + j) % 3 === 0 ? 'U' : null)) },
  { id: 'torsk', namn: $t('Torsk'), mat: true, vikt: [0.8, 3.5], svar: 1.4, chans: 12, karta: fisk({ r: 'T', s: 't', b: 'w' }, (i, j) => (j <= 4 && (i * 7 + j * 3) % 5 === 0 ? 'e' : null)) },
  { id: 'rodspatta', namn: $t('Rödspätta'), mat: true, vikt: [0.3, 1.2], svar: 1.2, chans: 12, karta: [   // (plattfisk: rund, ögonen på ovansidan, solfjäderstjärt)
    '................',
    '...kkkkkkkk.....',
    '..keeoeeeoek..kk',
    '.keWkeeeeoeeekek',
    'keeeeoeeeeeeekek',
    '.keeeeeeoeeeekek',
    '..keoeeeeeoek.kk',
    '...kkkkkkkk.....',
    '................'] },
  { id: 'havsoring', namn: $t('Havsöring'), mat: true, vikt: [1, 4], svar: 1.8, chans: 5, karta: fisk({ r: 'S', s: 's', b: 'w' }, (i, j) => (j === 4 && i > 1 && i < 12 ? 'p' : j <= 3 && (i * 3 + j) % 4 === 0 ? 'k' : null)) },
  { id: 'hummer', namn: $t('Hummer'), mat: false, salj: 150, vikt: [0.5, 1.5], svar: 1.6, chans: 3, karta: [
    'kk..........kk..',
    'kUk..kkkkkk.kUk.',
    '.kUkkUuUUuUkkUk.',
    '..kUUUuUUUuUUkkk',
    '..kUuUUuUUuUUUUk',
    '.kUkkUuUUuUkkkk.',
    'kUk..kkkkkk.....',
    'kk...k.k.k.k....',
    '................'] },
  { id: 'stovel', namn: $t('En gammal stövel'), skrap: true, vikt: [0.6, 1.1], svar: 0.7, chans: 10, karta: [
    '....kkkkk.......',
    '....kNnNk.......',
    '....kNNNk.......',
    '....kNNNk.......',
    '....kNNNkk......',
    '....kNNNNNkkkk..',
    '....kNNNNNNNNNk.',
    '....kkkkkkkkkkk.',
    '................'] },
  { id: 'tang', namn: $t('En klump tång'), skrap: true, vikt: [0.2, 0.5], svar: 0.6, chans: 2, karta: [
    '................',
    '..n...N...n.....',
    '..Nn..N..nN.....',
    '...NnNn.nN..n...',
    '..nNNNnnNNNnN...',
    '.NnNnNNnNnNNn...',
    '..kNNkNNkNNk....',
    '................',
    '................'] },
  { id: 'flaskpost', namn: $t('En flaskpost!'), skrap: true, brev: true, vikt: [0.4, 0.4], svar: 0.9, chans: 2, karta: [
    '................',
    '..........kk....',
    '.kkkkkkkkkkhk...',
    'kcWcccccccckhk..',
    'kcwwwwwwcccckk..',
    'kcccccccccckk...',
    '.kkkkkkkkkk.....',
    '................',
    '................'] },
];
const RIKTIGA = ARTER.filter((a) => !a.skrap).map((a) => a.id);
const artOf = (id) => ARTER.find((a) => a.id === id) || null;
export function fiskeOf(g) {
  if (!g.fiske || typeof g.fiske !== 'object') g.fiske = { spo: false, arter: {} };
  if (!g.fiske.arter || typeof g.fiske.arter !== 'object') g.fiske.arter = {};
  return g.fiske;
}
// en fisk som liten bild (dataURL, skala k)
const BILD = new Map();
export function fiskURL(id, k = 3) {
  const key = id + k;
  if (BILD.has(key)) return BILD.get(key);
  const A = artOf(id);
  if (!A || typeof document === 'undefined') return '';
  const w = Math.max(...A.karta.map((r) => r.length)), c = document.createElement('canvas'); c.width = w * k; c.height = A.karta.length * k;
  const x = c.getContext('2d');
  A.karta.forEach((r, j) => { for (let i = 0; i < r.length; i++) { const f = PAL[r[i]]; if (f) { x.fillStyle = f; x.fillRect(i * k, j * k, k, k); } } });
  const u = c.toDataURL(); BILD.set(key, u); return u;
}
function draArt() {
  if (globalThis.__fiskeArt && artOf(globalThis.__fiskeArt)) return artOf(globalThis.__fiskeArt);   // (testerna väljer arten)
  const sum = ARTER.reduce((s, a) => s + a.chans, 0);
  let r = Math.random() * sum;
  for (const a of ARTER) { r -= a.chans; if (r <= 0) return a; }
  return ARTER[0];
}

// ---------- fiskespelet ----------
export function openFiske(A, { plats = 'brygga' } = {}) {
  const g = A.game, F = fiskeOf(g);
  if (!F.spo) { toast($t`🎣 Du behöver ett metspö – Solö-kiosken säljer dem för ${fmt(SPO_PRIS)}.`, 'wrap'); return; }
  const W = 160, H = 96;
  const dlg = openModal($t('🎣 Fiska'), `<canvas class="fi-cv" width="${W}" height="${H}"></canvas>
    <p class="fi-text">${$t('Tryck för att kasta!')}</p>`, [
    { label: $t('📒 Fångstboken'), onClick: () => { stopp(); openFangstbok(A); } },
    { label: $t('Sluta fiska'), onClick: () => { stopp(); closeModal(); } },
  ]);
  const cv = dlg.querySelector('.fi-cv'), ctx = cv.getContext('2d'), txt = dlg.querySelector('.fi-text');
  let fas = 'kast', tid = 0, vantaTill = 0, art = null, kast = 0, nafs = 0, traff = 0, miss = 0, nal = 0, nalV = 1, zon = 0, zonW = 26, plask = [], last = performance.now(), raf = 0;
  const flottX = 64, flottY = 50;
  const sag = (s) => { if (txt.textContent !== s) txt.textContent = s; };
  function stopp() { cancelAnimationFrame(raf); }
  function ny() { fas = 'kast'; tid = 0; traff = 0; miss = 0; sag($t('Tryck för att kasta!')); }
  function slapp(s) { play('miss'); sag(s); fas = 'slut'; tid = 0; setTimeout(() => { if (document.body.contains(cv)) ny(); }, 1400); }
  function klick() {
    if (fas === 'kast') { fas = 'flyger'; tid = 0; play('slide'); sag('…'); return; }
    if (fas === 'vanta') { slapp($t('För tidigt! Fisken simmade iväg.')); return; }
    if (fas === 'napp') { fas = 'kamp'; tid = 0; nal = 0; nalV = 1; zonW = Math.max(12, Math.round(30 / art.svar)); zon = 14 + Math.floor(Math.random() * (120 - zonW - 28)); play('click'); sag($t('Dra in! Tryck när nålen är i det gröna!')); return; }
    if (fas === 'kamp') {
      const i = nal * 120;
      if (i >= zon && i <= zon + zonW) { traff += 1; play('ok'); zon = 14 + Math.floor(Math.random() * (120 - zonW - 28)); if (traff >= 3) fangad(); }
      else { miss += 1; play('fel'); if (miss >= 2) slapp($t('Plopp! Linan slackade och fisken kom loss.')); }
    }
  }
  cv.addEventListener('pointerdown', (e) => { e.preventDefault(); klick(); });
  const tangent = (e) => { if (!document.body.contains(cv)) { window.removeEventListener('keydown', tangent, true); return; } if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); e.stopImmediatePropagation(); klick(); } };
  window.addEventListener('keydown', tangent, true);
  function fangad() {
    fas = 'fangad'; stopp(); play('fanfare');
    const vikt = Math.round((art.vikt[0] + Math.random() * (art.vikt[1] - art.vikt[0])) * 100) / 100;
    const post = F.arter[art.id] || { n: 0, rekord: 0 }, nyArt = !post.n, rekord = !art.skrap && vikt > post.rekord && post.n > 0;
    post.n += 1; post.rekord = Math.max(post.rekord, vikt); F.arter[art.id] = post;
    const extra = [];
    if (art.mat) { const n = vikt >= 1.5 ? 2 : 1, fick = Math.max(0, Math.min(n, MAX_RAVA - (g.skafferi.fisk | 0))); if (fick) { g.skafferi.fisk = (g.skafferi.fisk | 0) + fick; extra.push($t`🐟 ${fick} fiskfilé till skafferiet`); } }
    if (art.salj) { g.money += art.salj; g.earned = (g.earned || 0) + art.salj; extra.push($t`Fiskaren köper den för ${fmt(art.salj)}!`); }
    if (art.brev) { g.money += 50; extra.push($t('I flaskan ligger ett brev: "Hälsningar från en seglare på andra sidan havet! Den som hittar detta får min lyckoslant." Det ligger 50 kr i flaskan!')); }
    const glad = g.glad?.(art.skrap ? 1 : 2, '', 'fiske', 6) || 0;
    const allaNu = RIKTIGA.every((id) => F.arter[id]?.n > 0), merit = allaNu && !(g.meriter || []).some((m) => m.typ === 'fiske');
    if (merit) g.merit?.('fiske', 1);
    g.passTime?.(10);
    g.save();
    openModal(art.skrap ? $t('🎣 Hoppsan!') : $t('🎣 Fångad!'), `<div class="fi-fangst"><img src="${fiskURL(art.id, 6)}" alt=""></div>
      <p style="font-size:var(--f2);text-align:center;margin:6px 0"><b>${esc(art.namn)}</b>${art.skrap && !art.brev ? '' : ` · ${String(vikt).replace('.', ',')} kg`}</p>
      ${nyArt && !art.skrap ? `<p class="fi-ny">${$t('✨ Ny art i fångstboken!')}</p>` : ''}${rekord ? `<p class="fi-ny">${$t('🏆 Nytt rekord!')}</p>` : ''}
      ${extra.map((s) => `<p style="font-size:var(--f2);margin:4px 0">${esc(s)}</p>`).join('')}${glad ? `<p class="sp" style="font-size:var(--f2)">😊 +${glad}</p>` : ''}
      ${merit ? `<p class="fi-ny">${$t('👑 Alla sex arterna! Meriten 🎣 Fiskemästare ligger i ditt troféskåp.')}</p>` : ''}`, [
      { label: $t('🎣 Kasta igen'), cls: 'btn-go', onClick: () => openFiske(A, { plats }) },
      { label: $t('Klar'), onClick: closeModal },
    ], { closable: false });
  }
  // ritningen (spelpixlar, skalas upp med pixelated)
  function rita(dt) {
    tid += dt;
    // himmel, hav och horisont
    for (let y = 0; y < H; y++) { ctx.fillStyle = y < 22 ? (y < 12 ? '#9ccce8' : '#c4e2f2') : y < 24 ? '#8ab8d4' : `rgb(${58 + y * 0.2 | 0},${134 + y * 0.3 | 0},${180 + y * 0.2 | 0})`; ctx.fillRect(0, y, W, 1); }
    for (let k = 0; k < 26; k++) { const x = (k * 37 + Math.floor(tid * 6 * (1 + (k % 3)))) % W, y = 26 + ((k * 13) % (H - 30)); ctx.fillStyle = 'rgba(220,244,252,.55)'; ctx.fillRect(x, y, 3 + (k % 3), 1); }
    ctx.fillStyle = '#7890b0'; for (let x = 40; x < 120; x += 6) ctx.fillRect(x, 22 - ((x * 7) % 5), 4, (x * 7) % 5);   // fastlandet långt borta
    if (plats === 'klippa') { ctx.fillStyle = '#8a8a92'; ctx.fillRect(126, 70, 40, 30); ctx.fillStyle = '#a8a8b0'; ctx.fillRect(128, 70, 30, 3); } else { ctx.fillStyle = '#9a6e44'; ctx.fillRect(122, 74, 40, 24); ctx.fillStyle = '#b88a58'; for (let x = 122; x < 160; x += 6) ctx.fillRect(x, 74, 5, 24); }
    // spöet och linan
    const topp = { x: 118, y: 40 };
    ctx.fillStyle = '#5a3a24'; for (let k = 0; k < 30; k++) ctx.fillRect(Math.round(150 - k), Math.round(80 - k * 1.33), 2, 1);
    let fx = flottX, fy = flottY;
    if (fas === 'kast') { fx = topp.x; fy = topp.y + 4; }
    if (fas === 'flyger') { const u = Math.min(1, tid / 0.6); fx = topp.x + (flottX - topp.x) * u; fy = topp.y + (flottY - topp.y) * u - Math.sin(u * Math.PI) * 24; if (u >= 1) { fas = 'vanta'; tid = 0; vantaTill = 2 + Math.random() * 5; art = draArt(); nafs = 1 + Math.random() * 1.5; play('slide'); for (let k = 0; k < 8; k++) plask.push({ x: flottX, y: flottY, vx: (Math.random() - 0.5) * 30, vy: -Math.random() * 30, t: 0 }); sag($t('Vänta … vänta …')); } }
    if (fas === 'vanta') { fy += Math.round(Math.sin(tid * 3)); if (tid > nafs && tid < nafs + 0.25) fy += 2; if (tid >= vantaTill) { fas = 'napp'; tid = 0; play('knock'); sag($t('NAPP! Tryck nu!')); for (let k = 0; k < 10; k++) plask.push({ x: flottX, y: flottY, vx: (Math.random() - 0.5) * 40, vy: -Math.random() * 40, t: 0 }); } }
    if (fas === 'napp') { fy += 4 + Math.round(Math.sin(tid * 30)); if (tid > 0.9 / art.svar) slapp($t('Fisken slank iväg. Var snabbare nästa gång!')); }
    if (fas === 'kamp') { fy += 3 + Math.round(Math.sin(tid * 18) * 2); nal += nalV * dt * 0.9 * art.svar; if (nal > 1) { nal = 1; nalV = -1; } if (nal < 0) { nal = 0; nalV = 1; } }
    ctx.fillStyle = 'rgba(240,240,240,.85)';
    for (let k = 0; k <= 16; k++) { const u = k / 16; ctx.fillRect(Math.round(topp.x + (fx - topp.x) * u), Math.round(topp.y + (fy - topp.y) * u + Math.sin(u * Math.PI) * (fas === 'kamp' ? 1 : 5)), 1, 1); }
    if (fas !== 'slut') { ctx.fillStyle = '#e04848'; ctx.fillRect(Math.round(fx) - 1, Math.round(fy) - 2, 3, 2); ctx.fillStyle = '#f4f1ea'; ctx.fillRect(Math.round(fx) - 1, Math.round(fy), 3, 2); }
    if (fas === 'vanta' || fas === 'napp' || fas === 'kamp') { ctx.fillStyle = 'rgba(255,255,255,.6)'; const r = 3 + Math.floor(tid * 4) % 4; ctx.fillRect(Math.round(fx) - r, Math.round(flottY) + 2, r * 2 + 1, 1); }
    if (fas === 'napp') { ctx.fillStyle = '#ffd23f'; ctx.fillRect(Math.round(fx), Math.round(fy) - 12, 2, 6); ctx.fillRect(Math.round(fx), Math.round(fy) - 4, 2, 2); }
    plask = plask.filter((p) => (p.t += dt) < 0.6);
    for (const p of plask) { ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.fillRect(Math.round(p.x + p.vx * p.t), Math.round(p.y + p.vy * p.t + 60 * p.t * p.t), 1, 1); }
    // mätaren i kampen
    if (fas === 'kamp') {
      ctx.fillStyle = '#1e1a24'; ctx.fillRect(18, 82, 124, 10); ctx.fillStyle = '#f4f1ea'; ctx.fillRect(20, 84, 120, 6);
      ctx.fillStyle = '#52b464'; ctx.fillRect(20 + zon, 84, zonW, 6);
      ctx.fillStyle = '#e04848'; ctx.fillRect(20 + Math.round(nal * 120) - 1, 80, 2, 14);
      for (let k = 0; k < 3; k++) { ctx.fillStyle = k < traff ? '#ffd23f' : '#4a4452'; ctx.fillRect(60 + k * 14, 72, 8, 6); }
    }
  }
  function loop(nu) {
    if (!document.body.contains(cv)) return;
    const dt = Math.min(0.1, (nu - last) / 1000); last = nu;
    rita(dt);
    raf = requestAnimationFrame(loop);
  }
  raf = requestAnimationFrame(loop);
  return { _test: () => ({ fas, art: art?.id || null, zon, zonW, nal, traff }) };
}

// ---------- 📒 fångstboken ----------
export function openFangstbok(A) {
  const F = fiskeOf(A.game);
  const rad = (a) => {
    const p = F.arter[a.id];
    return `<div class="fi-bok-rad${p?.n ? '' : ' fi-saknas'}"><img src="${fiskURL(a.id, 3)}" alt=""><span class="nm">${p?.n ? esc(a.namn) : '???'}<br><small class="sp">${p?.n ? (a.skrap ? $t`${p.n} st` : $t`${p.n} st · rekord ${String(p.rekord).replace('.', ',')} kg`) : $t('inte fångad än')}</small></span></div>`;
  };
  const n = RIKTIGA.filter((id) => F.arter[id]?.n > 0).length;
  openModal($t('📒 Fångstboken'), `<p style="font-size:var(--f2);margin-top:0">${$t`${n} av ${RIKTIGA.length} arter. Fånga alla och bli 🎣 Fiskemästare!`}</p>
    <div class="fi-bok">${ARTER.filter((a) => !a.skrap).map(rad).join('')}</div>
    <div class="bl-lbl">${$t('Annat ur havet')}</div><div class="fi-bok">${ARTER.filter((a) => a.skrap).map(rad).join('')}</div>`,
  [{ label: $t('Stäng'), cls: 'btn-go', onClick: closeModal }]);
}
// metspöet i kiosken
export function kopSpo(A) {
  const g = A.game, F = fiskeOf(g);
  if (F.spo) return false;
  if (g.money < SPO_PRIS) { toast($t('Du har inte råd med ett metspö.'), 'bad'); return false; }
  g.money -= SPO_PRIS; F.spo = true; g.save(); play('buy');
  toast($t('🎣 Ett metspö! Fiska längst ut på färjebryggan eller vid klipporna nära fyren.'), 'good wrap');
  return true;
}
