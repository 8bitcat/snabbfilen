// KLÄDER – dialogerna: köpa ett plagg (prova på DIN figur, välj färg), bläddra bland en
// klädställnings alla plagg och köpa ett helt matchställ (Kungsladugård och de kända lagen).
//
// Köpet registreras med katalog-id: g.buyWardrobe(id) / g.ownsWardrobe(id) i game.js.
import { drawPerson, entryOf } from '../../core/people.js';
import { lookForItem, itemById } from '../../data/wardrobe.js';
import { openModal, closeModal, toast, esc } from '../../core/ui.js';
import { fmt } from '../../game.js';
import { play } from '../../core/sound.js';
import { saveAvatar } from '../../core/avatar.js';
import { DEPT } from './data.js';
import { isDressLike, garmentColors, jerseyBack } from './garment.js';

// ---------- spelets garderob (game.js) ----------
// g.ownsWardrobe/g.buyWardrobe (eller samma sak under namnen ownsItem/buyItem/itemPrice som
// sko- och accessoarbutikerna använder). Utan dem (före integrationen) räknas bara det som
// redan står i g.wardrobe som ägt, och kassan säger till i stället för att ta betalt.
const fn = (g, ...names) => names.map((n) => g[n]).find((f) => typeof f === 'function');
export const owns = (g, it) => {
  if (!it) return false;
  if (it.free) return true;
  const f = fn(g, 'ownsWardrobe', 'ownsItem');
  return f ? !!f.call(g, it.id) : g.wardrobe.includes(it.id) || (!!it.legacy && g.wardrobe.includes(it.legacy));
};
export const priceOf = (g, it) => { const f = fn(g, 'itemPrice'); const p = f ? f.call(g, it) : NaN; return Number.isFinite(p) ? p : g.clothesPrice(it); }; // REA-dagar: −25 %
export function buyItem(g, it) {
  const f = fn(g, 'buyWardrobe', 'buyItem');
  if (!f) return { ok: false, msg: 'Kassan är stängd en stund – försök igen snart!' };
  return f.call(g, it.id) || { ok: false, msg: 'Köpet gick inte.' };
}
const plain = (s) => String(s).replace(/­/g, '');
export const nameOf = (it) => plain(it.name);

// ---------- färgfälten ett plagg har ----------
const ACCENT_PART = { jacket: 'dragkedjan', shirt: 'kragen och knapparna', hawaii: 'mönstret', suit: 'slipsen', football: 'kragen och ärmsluten' };
// [huvudfärgens fält, [detaljfält med förklaring]]
function fieldsOf(it) {
  const L = it.look, c = it.colors || {};
  switch (it.slot) {
    case 'top': {
      const det = [];
      if (c.accent || ACCENT_PART[L.top]) det.push(['accent', ACCENT_PART[L.top] || 'detaljerna']);
      if (L.topPrint && L.topPrint !== 'none') det.push(['print2', 'trycket']);
      return ['shirt', det];
    }
    case 'bottom': {
      const det = [];
      if ((L.bottomPrint && L.bottomPrint !== 'none') || c.pants2) det.push(['pants2', L.bottomPrint && L.bottomPrint !== 'none' ? 'mönstret' : 'detaljerna']);
      return [isDressLike(it) ? 'shirt' : 'pants', det];
    }
    case 'shoes': return ['shoes', c.shoes2 || entryOf('shoeType', L.shoeType)?.uses?.includes('shoes2') ? [['shoes2', 'detaljerna']] : []];
    case 'hat': return ['cap', []];
    case 'bag': return ['bagColor', []];
    case 'phones': return ['phoneColor', []];
    case 'neck': return ['neckColor', []];
    default: return [null, []];
  }
}
// Looken med plagget på (modellfälten + färgerna)
export const wearPatch = (it, colors, look) => ({ ...lookForItem(it, look), ...colors });

// ---------- färger som syns: plagget ska inte smälta ihop med håret/tröjan ----------
const rgbOf = (h) => {
  const s = String(h || '').replace('#', '');
  const n = parseInt(s.length === 3 ? s.replace(/./g, '$&$&') : s.slice(0, 6), 16) || 0;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
function cdist(a, b) {
  const [r1, g1, b1] = rgbOf(a), [r2, g2, b2] = rgbOf(b), rm = (r1 + r2) / 2;
  const dr = r1 - r2, dg = g1 - g2, db = b1 - b2;
  return Math.sqrt((2 + rm / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rm) / 256) * db * db);
}
function avoidFor(it, L) {
  const hair = L.style === 'bald' ? null : L.hair;
  switch (it.slot) {
    case 'hat': case 'phones': return [[hair, 170], [L.skin, 90]];
    case 'bag': return [[L.shirt, 150], [hair, 110]];
    case 'top': return [[L.pants, 90], [L.skin, 60]];
    case 'bottom': return isDressLike(it) ? [[L.pants, 90], [L.skin, 70]] : [[L.shirt, 90], [L.skin, 70]];
    case 'shoes': return [[L.pants, 80]];
    default: return [];
  }
}
function pickColor(cands, avoid) {
  const list = avoid.filter(([c]) => c);
  let best = cands[0], bestScore = -Infinity;
  for (const c of cands) {
    const score = Math.min(Infinity, ...list.map(([x, m]) => cdist(c, x) - m));
    if (score >= 0) return c;
    if (score > bestScore) { bestScore = score; best = c; }
  }
  return best;
}
const AGAINST = { hat: 'ditt hår', phones: 'ditt hår', bag: 'din tröja', top: 'det du har på dig', bottom: 'det du har på dig', shoes: 'dina byxor' };

const DIRS = ['down', 'left', 'up', 'right'];
const DIR_NAMES = ['Framifrån', 'Från sidan', 'Bakifrån', 'Från sidan'];
function bestDir(now, withIt) {
  const px = (look, dir) => {
    const c = document.createElement('canvas'); c.width = 28; c.height = 44;
    const x = c.getContext('2d', { willReadFrequently: true });
    drawPerson(x, 14, 41, look, dir, 0);
    return x.getImageData(0, 0, 28, 44).data;
  };
  try {
    const score = DIRS.map((dir, i) => {
      const a = px(now, dir), b = px(withIt, dir);
      let n = 0;
      for (let k = 0; k < a.length; k += 4) if (a[k] !== b[k] || a[k + 1] !== b[k + 1] || a[k + 2] !== b[k + 2] || a[k + 3] !== b[k + 3]) n++;
      return n * (i === 0 ? 1.6 : 1);
    });
    return score.indexOf(Math.max(...score));
  } catch { return 0; }
}
// Figuren i heltalsskala (hela enhetspixlar) – aldrig suddig. crop = [y0, h] i spriten.
export function figure(look, dir, S, crop = null) {
  const src = document.createElement('canvas'); src.width = 28; src.height = 44;
  drawPerson(src.getContext('2d'), 14, 41, look, dir, 0);
  const [cy, ch] = crop || [0, 44];
  return pixelCanvas(src, S, [0, cy, 28, ch]);
}
// En pixelbild förstorad S gånger i hela enhetspixlar. r = [x, y, w, h] ur källan.
export function pixelCanvas(src, S, r = null) {
  const [sx, sy, sw, sh] = r || [0, 0, src.width, src.height];
  const dpr = globalThis.devicePixelRatio || 1;
  const D = Math.max(1, Math.round(S * dpr));
  const c = document.createElement('canvas');
  c.width = sw * D; c.height = sh * D;
  c.style.width = (sw * D / dpr) + 'px'; c.style.height = (sh * D / dpr) + 'px';
  const x = c.getContext('2d'); x.imageSmoothingEnabled = false;
  x.drawImage(src, sx, sy, sw, sh, 0, 0, c.width, c.height);
  return c;
}
// Figurens storlek i köpdialogen: stor på datorn, mindre på en liggande mobil (lågt fönster)
const figScale = () => (window.innerHeight >= 620 && window.innerWidth >= 560 ? 5 : window.innerHeight < 480 ? 3 : 4);
// Låga skärmar (liggande mobil): kompakt dialog – tipsen göms och knapparna ligger kvar nertill
const compact = (dlg) => { dlg.classList.add('kl-dlg'); return dlg; };

const SWATCHES = ['#f28bb3', '#ff7a6b', '#d9433b', '#7a1f2e', '#e07a2e', '#f0b429', '#9fd356', '#46a35a', '#2aa39a', '#7fb8e8', '#3a7bd5', '#2d3a5c', '#8e5bd1', '#b9a3e8', '#b83d7a', '#f4f1ea', '#8a8f98', '#1d1d22'];
const DETAILS = ['#f4f1ea', '#1d1d22', '#f0b429', '#d9433b', '#f28bb3', '#3a7bd5', '#46a35a', '#8e5bd1', '#2aa39a', '#e07a2e'];
const CSS = `
  .klb{display:flex;gap:14px;flex-wrap:wrap;align-items:flex-start}
  .klb-l{display:flex;flex-direction:column;gap:6px;align-items:center;flex:none}
  .klb-stage{display:flex;align-items:flex-end;gap:6px;padding:10px 12px 0;border:3px solid var(--ink);box-shadow:3px 3px 0 var(--ink)}
  .klb-fig{display:flex;flex-direction:column;align-items:center}
  .klb-fig canvas{display:block;image-rendering:pixelated;image-rendering:crisp-edges}
  .klb-fig small{font-size:var(--f1);line-height:1;background:var(--ink);color:#fff;padding:2px 6px 1px;margin-bottom:6px;white-space:nowrap}
  .klb-arrow{font-size:var(--f2);padding-bottom:40px;color:var(--ink)}
  .klb-turn{display:flex;gap:6px;align-items:center}
  .klb-view{font-size:var(--f2);min-width:92px;text-align:center}
  .klb-r{flex:1;min-width:230px;display:flex;flex-direction:column;gap:8px}
  .klb-dept{font-size:var(--f1);color:var(--muted);margin:0}
  .klb-price{font-size:var(--f3);margin:0;line-height:1}
  .klb-money{font-size:var(--f2);margin:0}
  .klb-sws{display:flex;flex-wrap:wrap;gap:6px}
  .klb-sw{width:30px;height:30px;padding:0;border:3px solid var(--ink);background:var(--c);cursor:pointer;box-shadow:2px 2px 0 var(--ink)}
  .klb-sws.small .klb-sw{width:24px;height:24px}
  .klb-sw.on{outline:3px solid #ffd23f;outline-offset:1px;transform:translate(-1px,-1px)}
  .klb-hint{font-size:var(--f2);line-height:1.1;color:var(--muted);margin:0}
  .klb-wear{font-size:var(--f2);display:flex;gap:8px;align-items:center;cursor:pointer}
  .klb-wear input{width:20px;height:20px}
  .klg{display:grid;grid-template-columns:repeat(auto-fill,minmax(112px,1fr));gap:8px}
  .klg-card{display:flex;flex-direction:column;align-items:center;gap:3px;padding:6px 4px 5px;border:3px solid var(--ink);background:var(--bg,#fbf6ea);box-shadow:2px 2px 0 var(--ink);cursor:pointer;font:inherit;color:inherit}
  .klg-card:hover,.klg-card:focus-visible{transform:translate(-1px,-1px);box-shadow:3px 3px 0 var(--ink);outline:none}
  .klg-card canvas{display:block;image-rendering:pixelated;image-rendering:crisp-edges}
  .klg-name{font-size:var(--f1);line-height:1;text-align:center;min-height:32px;display:flex;align-items:center;hyphens:manual}
  .klg-price{font-size:var(--f2);line-height:1;background:#f0d048;border:2px solid var(--ink);padding:1px 5px 0}
  .klg-card.own .klg-price{background:#45b964;color:#fff}
  .klg-card.rea .klg-price{background:#ff8a80}
  .klg-top{display:flex;justify-content:space-between;align-items:baseline;gap:8px;flex-wrap:wrap;margin:0 0 8px}
  .klk-parts{display:flex;flex-direction:column;gap:5px}
  .klk-part{display:flex;align-items:center;gap:8px;font-size:var(--f2);cursor:pointer}
  .klk-part input{width:20px;height:20px}
  .klk-part b{margin-left:auto}
  .klk-back{display:flex;gap:10px;align-items:center}
  .klk-back canvas{display:block;image-rendering:pixelated;image-rendering:crisp-edges;flex:none}
  .klk-back p{margin:0}
  .klb-note{font-size:var(--f2);line-height:1.1;margin:0;padding:4px 6px;border:2px solid var(--ink);background:#e4f6e4}
  .klp{display:flex;flex-direction:column;gap:8px;align-items:center}
  .klp canvas{display:block;image-rendering:pixelated;image-rendering:crisp-edges;border:3px solid var(--ink);box-shadow:3px 3px 0 var(--ink)}
  .klp-roster{display:flex;flex-wrap:wrap;gap:4px 6px;justify-content:center;max-width:560px}
  .klp-roster span{font-size:var(--f2);line-height:1;border:2px solid var(--ink);background:#f6efe6;padding:2px 5px 1px;white-space:nowrap}
  .klp-roster b{background:#7a1f2e;color:#fff;padding:0 3px;margin-right:2px}
  @media (max-height:480px){
    #modal:has(.kl-dlg){padding:6px}
    .kl-dlg .dlg-head{padding:4px 10px}
    .kl-dlg .dlg-head h2{font-size:var(--f2)}
    .kl-dlg .dlg-body{padding:8px 10px}
    .kl-dlg .dlg-foot{position:sticky;bottom:0;z-index:2;background:var(--paper);padding:6px 10px;border-top:3px solid var(--ink)}
    .kl-dlg .klb-hint{display:none}
    .kl-dlg .klb{gap:10px}
    .kl-dlg .klb-r{gap:5px;min-width:210px}
    .kl-dlg .klb-stage{padding:6px 8px 0}
    .kl-dlg .klb-turn .btn{padding:2px 6px}
    .kl-dlg .klb-price{font-size:var(--f3)}
    .kl-dlg .klb-sw{width:26px;height:26px}
    .kl-dlg .klb-sws.small .klb-sw{width:22px;height:22px}
    .kl-dlg .klk-part{font-size:var(--f2)}
    .kl-dlg .klp-roster span{font-size:var(--f1)}
  }
`;
const stageBg = (key) => { const [c1, c2, c3] = (DEPT[key] || DEPT.mid).stage; return `background:linear-gradient(${c1} 0 72%, ${c3} 72% 73%, ${c2} 73% 100%)`; };
const swBtn = (c, on, attr) => `<button class="klb-sw ${on ? 'on' : ''}" ${attr}="${c}" style="--c:${c}" aria-label="Färg ${c}"></button>`;

// ================= köpa ett plagg =================
// opts: { dept, colors (förslag – dockans/lagets), title, note, back (tillbaka till bläddringen) }
export function openBuy(A, it, opts = {}) {
  const g = A.game, me = A.avatar.look;
  const key = opts.dept || it.dept || 'mid', th = DEPT[key] || DEPT.mid;
  const [field, details] = fieldsOf(it);
  const preset = { ...garmentColors(it), ...(it.colors || {}), ...(opts.colors || {}) };
  const dollColor = field ? (preset[field] || '#3a7bd5') : null;
  const sw = field ? [...new Set([dollColor, ...SWATCHES])] : [];
  let color = field ? (opts.colors?.[field] ? dollColor : pickColor(sw, avoidFor(it, me))) : null;
  const det = details.map(([f, part]) => {
    const start = preset[f] || '#f4f1ea';
    return { f, part, list: [...new Set([start, ...DETAILS])], v: start, picked: false };
  });
  const colors = () => ({ ...(field ? { [field]: color } : {}), ...Object.fromEntries(det.map((d) => [d.f, d.v])) });
  const withIt = () => ({ ...A.avatar.look, ...wearPatch(it, colors(), A.avatar.look) });
  let dirI = bestDir(me, withIt());
  const turned = dirI !== 0;
  const isOwned = owns(g, it);
  const price = priceOf(g, it), rea = price !== it.price;
  const short = price - g.money;
  const name = opts.title || nameOf(it);
  const turnNote = turned ? `🔄 ${esc(name)} syns bäst ${DIR_NAMES[dirI].toLowerCase()} på dig – vrid figuren så ser du den från alla håll.` : '';
  const body = `<style>${CSS}</style>
  <div class="klb">
    <div class="klb-l">
      <div class="klb-stage" style="${stageBg(key)}">
        <div class="klb-fig" data-fig="now"><i></i><small>Du nu</small></div>
        <div class="klb-arrow">➜</div>
        <div class="klb-fig" data-fig="new"><i></i><small>Med ${esc(name.toLowerCase())}</small></div>
      </div>
      <div class="klb-turn">
        <button class="btn btn-small" data-turn="-1" aria-label="Vrid åt vänster">⟲ Vrid</button>
        <b class="klb-view" data-view>${DIR_NAMES[dirI]}</b>
        <button class="btn btn-small" data-turn="1" aria-label="Vrid åt höger">Vrid ⟳</button>
      </div>
    </div>
    <div class="klb-r">
      <p class="klb-dept">${esc(opts.where || th.title)}${opts.title ? ` · ${esc(nameOf(it))}` : ''}</p>
      <p class="klb-price">${isOwned ? '<b class="ok">✓ Den här är din!</b>' : `Pris: <b>${rea ? `<s>${fmt(it.price)}</s> ` : ''}${fmt(price)}</b>${rea ? ' <b class="bad">REA</b>' : ''}`}</p>
      <p class="klb-money">💰 Du har <b>${fmt(g.money)}</b>${isOwned ? '' : short > 0 ? ` · <b class="bad">du saknar ${fmt(short)}</b>` : ` · kvar efter köpet: <b>${fmt(g.money - price)}</b>`}</p>
      ${field ? `<div><b style="font-size:var(--f2)">Prova färg:</b></div>
      <div class="klb-sws" data-sws>${sw.map((c) => swBtn(c, c === color, 'data-c')).join('')}</div>
      ${color !== dollColor ? `<p class="klb-hint">👀 Första rutan är ${opts.fromDoll ? 'dockans' : 'plaggets'} färg – vi valde en som syns mot ${AGAINST[it.slot] || 'dig'}.</p>` : ''}` : ''}
      ${det.map((d, i) => `<div><b style="font-size:var(--f2)">${i === 0 && d.f !== 'print2' ? 'Detaljfärg' : d.f === 'print2' ? 'Tryckfärg' : 'Detaljfärg'}</b> <span class="klb-hint">(${esc(d.part)}):</span></div>
      <div class="klb-sws small" data-det="${i}">${d.list.map((c) => swBtn(c, c === d.v, 'data-a')).join('')}</div>`).join('')}
      ${field ? '<p class="klb-hint">🎨 Färgerna här är bara för att prova – när plagget är ditt väljer du fritt bland alla färger i garderoben där hemma.</p>' : ''}
      ${opts.note ? `<p class="klb-hint">${opts.note}</p>` : ''}
      ${turnNote ? `<p class="klb-hint">${turnNote}</p>` : ''}
      ${isOwned ? '' : '<label class="klb-wear"><input type="checkbox" data-wear checked> Ta på mig den direkt</label>'}
    </div>
  </div>`;
  const wear = () => { A.avatar = saveAvatar({ ...A.avatar, look: withIt() }); };
  const icon = opts.icon || it.icon || '👕';
  const buttons = [
    opts.back ? { label: '⬅️ Tillbaka', onClick: () => { play('click'); opts.back(); } } : { label: 'Stäng', onClick: closeModal },
    isOwned
      ? { label: '👕 Ta på mig den', cls: 'btn-go', onClick: () => { wear(); play('ok'); toast(`${icon} Snyggt! Du har ${name.toLowerCase()} på dig.`, 'good'); closeModal(); } }
      : { label: `🛍️ Köp (${fmt(price)})`, cls: 'btn-go', disabled: short > 0, onClick: () => {
        const wearIt = dlg.querySelector('[data-wear]')?.checked;
        const r = buyItem(g, it);
        if (!r.ok) { toast(r.msg, 'bad'); play('fel'); return; }
        play('buy');
        if (wearIt) wear();
        toast(`${icon} ${name} är din!${wearIt ? ' Du har den på dig.' : ' Den hänger i garderoben där hemma.'}`, 'good');
        closeModal();
        opts.onBought?.(it);
      } },
  ];
  const dlg = compact(openModal(`${icon} ${esc(name)}`, body, buttons));
  const big = figScale();
  const render = () => {
    const dir = DIRS[dirI];
    dlg.querySelector('[data-fig="now"] i').replaceChildren(figure(A.avatar.look, dir, 2));
    dlg.querySelector('[data-fig="new"] i').replaceChildren(figure(withIt(), dir, big));
    dlg.querySelector('[data-view]').textContent = DIR_NAMES[dirI];
    det.forEach((d, i) => dlg.querySelectorAll(`[data-det="${i}"] [data-a]`).forEach((x) => x.classList.toggle('on', x.dataset.a === d.v)));
  };
  dlg.querySelectorAll('[data-turn]').forEach((b) => (b.onclick = () => { dirI = (dirI + +b.dataset.turn + 4) % 4; play('click'); render(); }));
  dlg.querySelectorAll('[data-c]').forEach((b) => (b.onclick = () => {
    color = b.dataset.c;
    dlg.querySelectorAll('[data-c]').forEach((x) => x.classList.toggle('on', x === b));
    // detaljen följer med så att kragen/trycket inte försvinner i den nya färgen
    for (const d of det) if (!d.picked) d.v = pickColor(d.list, [[color, 150]]);
    play('click');
    render();
  }));
  dlg.querySelectorAll('[data-det]').forEach((row) => row.querySelectorAll('[data-a]').forEach((b) => (b.onclick = () => {
    const d = det[+row.dataset.det];
    d.v = b.dataset.a; d.picked = true;
    play('click');
    render();
  })));
  render();
  return dlg;
}

// ================= bläddra: alla plagg på en klädställning =================
// cat = { name, icon }, items = katalogplaggen, opts = { dept, where }
export function openBrowse(A, cat, items, opts = {}) {
  const g = A.game, me = A.avatar.look;
  const key = opts.dept || cat.dept || 'mid', th = DEPT[key] || DEPT.mid;
  const nOwn = items.filter((it) => owns(g, it)).length;
  const body = `<style>${CSS}</style>
    <div class="klg-top"><span class="klb-dept">${esc(opts.where || th.title)} · ${items.length} plagg${nOwn ? ` · ${nOwn} är dina` : ''}</span><span class="klb-money">💰 <b>${fmt(g.money)}</b></span></div>
    <p class="klb-hint" style="margin:0 0 8px">Så här ser du ut i dem – klicka på ett plagg så provar du det och väljer färg.</p>
    <div class="klg">${items.map((it, i) => {
    const o = owns(g, it), p = priceOf(g, it);
    return `<button class="klg-card ${o ? 'own' : ''} ${!o && p !== it.price ? 'rea' : ''}" data-i="${i}" title="${esc(nameOf(it))}"><i></i><span class="klg-name">${esc(it.name)}</span><span class="klg-price">${o ? '✓ DIN' : `${p} kr`}</span></button>`;
  }).join('')}</div>`;
  const dlg = compact(openModal(`${cat.icon || '👕'} ${esc(cat.name)}`, body, [{ label: 'Stäng', onClick: closeModal }]));
  // figurerna ritas lite i taget så att dialogen öppnas direkt
  const cards = [...dlg.querySelectorAll('.klg-card')];
  const figS = window.innerWidth >= 900 && window.innerHeight >= 600 ? 3 : 2;
  const crop = (it) => (it.slot === 'top' ? [6, 30] : it.slot === 'bottom' ? (isDressLike(it) ? [10, 34] : [16, 28]) : [4, 40]);
  let i = 0;
  const step = () => {
    const t0 = performance.now();
    while (i < cards.length && performance.now() - t0 < 12) {
      const it = items[i];
      const look = { ...me, ...wearPatch(it, garmentColors(it, opts.colorsFor?.(it)), me) };
      cards[i].querySelector('i').replaceChildren(figure(look, 'down', figS, crop(it)));
      i++;
    }
    if (i < cards.length && dlg.isConnected) requestAnimationFrame(step);
  };
  step();
  cards.forEach((b) => (b.onclick = () => {
    const it = items[+b.dataset.i];
    play('click');
    openBuy(A, it, { dept: key, where: opts.where, colors: opts.colorsFor?.(it), back: () => openBrowse(A, cat, items, opts) });
  }));
  return dlg;
}

// ================= ett helt matchställ =================
// kit = { title, where, dept, icon, parts: [{ id, colors, label, optional }], note,
//         player ('Nr 34 · Julia'), back ({ number, name, shirt, accent } = ryggen visas stor),
//         ownedNote (visas när tröjmodellen redan är din), wearLabel (knappen när inget ska köpas) }
// Delarnas färger: bara plaggets egna färgfält följer med (skorna rör aldrig shortsen).
const KIT_FIELDS = { top: ['shirt', 'accent', 'print2'], bottom: ['pants', 'pants2', 'shirt', 'accent'], shoes: ['shoes', 'shoes2'] };
export function kitColors(it, colors) {
  const all = { ...garmentColors(it), ...(colors || {}) };
  const keep = KIT_FIELDS[it.slot];
  return keep ? Object.fromEntries(keep.filter((f) => all[f]).map((f) => [f, all[f]])) : all;
}
export function openKit(A, kit) {
  const g = A.game;
  const key = kit.dept || 'kungs', th = DEPT[key] || DEPT.mid;
  const parts = kit.parts.map((p) => ({ ...p, it: itemById(p.id) })).filter((p) => p.it);
  const own = parts.map((p) => owns(g, p.it));
  const state = parts.map((p, i) => !own[i] && !p.optional);
  const look = (sel) => {
    let L = { ...A.avatar.look };
    parts.forEach((p, i) => { if (sel[i] || own[i]) L = { ...L, ...wearPatch(p.it, kitColors(p.it, p.colors), L) }; });
    // ryggnumret: lagets spelare har sitt nummer på tröjan (Nr 34 · Julia → 34), andra lag inget
    if (parts.some((p, i) => p.it.slot === 'top' && (sel[i] || own[i]))) {
      if (kit.back && kit.back.number !== undefined && kit.back.number !== null) L.shirtNum = +kit.back.number; else delete L.shirtNum;
    }
    return L;
  };
  const toBuy = () => parts.filter((p, i) => state[i] && !own[i]);
  const sum = () => toBuy().reduce((a, p) => a + priceOf(g, p.it), 0);
  const anyOwned = own.some(Boolean), allOwned = own.every(Boolean);
  const icon = kit.icon || '⚽';
  const wearLabel = kit.wearLabel || (allOwned ? '👕 Ta på mig matchstället' : '👕 Ta på mig det jag har');
  const back = kit.back ? `<div class="klk-back"><i data-back></i><div><p class="klb-price" style="font-size:var(--f3)">${esc(kit.player || '')}</p><p class="klb-hint">Så ser ryggen ut – nummer och förnamn har bara lagets spelare.</p></div></div>`
    : kit.player ? `<p class="klb-price" style="font-size:var(--f3)">${esc(kit.player)}</p>` : '';
  const body = `<style>${CSS}</style>
  <div class="klb">
    <div class="klb-l">
      <div class="klb-stage" style="${stageBg(key)}">
        <div class="klb-fig" data-fig="now"><i></i><small>Du nu</small></div>
        <div class="klb-arrow">➜</div>
        <div class="klb-fig" data-fig="new"><i></i><small>${esc(kit.newLabel || 'I matchstället')}</small></div>
      </div>
      <div class="klb-turn">
        <button class="btn btn-small" data-turn="-1" aria-label="Vrid åt vänster">⟲ Vrid</button>
        <b class="klb-view" data-view>Framifrån</b>
        <button class="btn btn-small" data-turn="1" aria-label="Vrid åt höger">Vrid ⟳</button>
      </div>
    </div>
    <div class="klb-r">
      <p class="klb-dept">${esc(kit.where || th.title)}</p>
      ${back}
      <div class="klk-parts">${parts.map((p, i) => {
    const pr = priceOf(g, p.it);
    return `<label class="klk-part"><input type="checkbox" data-part="${i}" ${own[i] ? 'checked disabled' : state[i] ? 'checked' : ''}> ${p.it.icon || ''} ${esc(p.label || nameOf(p.it))} <b>${own[i] ? '<span class="ok">✓ har du</span>' : fmt(pr)}</b></label>`;
  }).join('')}</div>
      ${own[0] && kit.ownedNote ? `<p class="klb-note">${kit.ownedNote}</p>` : ''}
      <p class="klb-money" data-sum></p>
      ${kit.note ? `<p class="klb-hint">${kit.note}</p>` : ''}
      <p class="klb-hint">🎨 Lagets färger följer med – hemma i garderoben kan du byta färg när du vill.</p>
      <label class="klb-wear" data-wearrow><input type="checkbox" data-wear checked> Ta på mig det direkt</label>
    </div>
  </div>`;
  const dirs = ['down', 'left', 'up', 'right'];
  let dirI = 0;
  const wear = (sel) => { A.avatar = saveAvatar({ ...A.avatar, look: look(sel) }); };
  // En enda huvudknapp: KÖP när något är ikryssat, annars TA PÅ (de delar man redan har,
  // i lagets färger) – så att man alltid kan klä sig i ett lag vars tröja man redan äger.
  const dlg = openModal(`${icon} ${esc(kit.title)}`, body, [
    { label: 'Stäng', onClick: closeModal },
    { label: toBuy().length || !anyOwned ? '🛍️ Köp' : wearLabel, cls: 'btn-go', onClick: () => {
      const list = toBuy();
      if (!list.length) {
        if (!anyOwned) { toast('Kryssa i något att köpa!', 'bad'); play('fel'); return; }
        wear(state);
        play('ok');
        const worn = parts.filter((p, i) => own[i]);
        toast(`${icon} Heja! Du har ${allOwned ? kit.title.toLowerCase() : worn.map((p) => (p.label || nameOf(p.it)).toLowerCase()).join(' och ')} på dig.`, 'good');
        closeModal();
        return;
      }
      if (sum() > g.money) { toast('Du har inte råd – dags att jobba ett pass!', 'bad'); play('fel'); return; }
      for (const p of list) {
        const r = buyItem(g, p.it);
        if (!r.ok) { toast(r.msg, 'bad'); play('fel'); return; }
      }
      play('buy');
      const wearIt = dlg.querySelector('[data-wear]')?.checked;
      if (wearIt) wear(state);
      toast(`${icon} ${list.map((p) => p.label || nameOf(p.it)).join(', ')} – ${list.length > 1 ? 'dina' : 'din'}!${wearIt ? ' Heja!' : ' Det hänger i garderoben där hemma.'}`, 'good');
      closeModal();
    } },
  ]);
  compact(dlg);
  const big = figScale();
  const go = dlg.querySelector('.dlg-foot .btn-go');
  if (kit.back) {
    const S = window.innerHeight < 480 ? 2 : 3;
    dlg.querySelector('[data-back]').replaceChildren(pixelCanvas(jerseyBack(kit.back.number, kit.back.name, kit.back), S));
  }
  const render = () => {
    const dir = dirs[dirI];
    dlg.querySelector('[data-fig="now"] i').replaceChildren(figure(A.avatar.look, dir, 2));
    dlg.querySelector('[data-fig="new"] i').replaceChildren(figure(look(state), dir, big));
    dlg.querySelector('[data-view]').textContent = DIR_NAMES[dirI];
    const s = sum(), short = s - g.money;
    dlg.querySelector('[data-sum]').innerHTML = s ? `Att betala: <b>${fmt(s)}</b> · 💰 du har <b>${fmt(g.money)}</b>${short > 0 ? ` · <b class="bad">du saknar ${fmt(short)}</b>` : ''}`
      : anyOwned ? (allOwned ? (kit.allOwnedText || '✓ Hela matchstället är ditt.') : (kit.someOwnedText || '✓ Det du har tar du på dig i lagets färger – eller kryssa i resten.')) : '💰 Kryssa i det du vill köpa.';
    dlg.querySelector('[data-wearrow]').style.display = s ? '' : 'none';
    if (go) {
      go.disabled = s ? short > 0 : !anyOwned;
      go.firstChild.textContent = s ? `🛍️ Köp (${fmt(s)})` : anyOwned ? wearLabel : '🛍️ Köp';
    }
  };
  dlg.querySelectorAll('[data-part]').forEach((b) => (b.onchange = () => { state[+b.dataset.part] = b.checked; play('click'); render(); }));
  dlg.querySelectorAll('[data-turn]').forEach((b) => (b.onclick = () => { dirI = (dirI + +b.dataset.turn + 4) % 4; play('click'); render(); }));
  render();
  return dlg;
}

// ================= lagfotot i stort =================
// src = butikens våningsbild, r = [x, y, w, h] (fotot + skylten), players = [[nr, förnamn]]
export function openPhoto(A, src, r, title, players) {
  const [x0, y0, w, h] = r;
  const body = `<style>${CSS}</style>
    <div class="klp"><i data-photo></i>
    <div class="klp-roster">${players.map(([n, name]) => `<span><b>${n}</b> ${esc(name)}</span>`).join('')}</div></div>`;
  const dlg = openModal(`📸 ${esc(title)}`, body, [{ label: 'Stäng', cls: 'btn-go', onClick: closeModal }]);
  compact(dlg);
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const cx = c.getContext('2d'); cx.imageSmoothingEnabled = false;
  cx.drawImage(src, x0, y0, w, h, 0, 0, w, h);
  const avail = Math.min(window.innerWidth - 60, 560);
  const S = Math.max(2, Math.min(4, Math.floor(avail / w), window.innerHeight < 480 ? 3 : 4));
  dlg.querySelector('[data-photo]').replaceChildren(pixelCanvas(c, S));
  return dlg;
}
