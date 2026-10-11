// 💎 BLING BLING – smycken och väskor i Linnéstaden (Carl 2026-10-11: "en butik med smycken där man kan designa sitt
// eget halsband och sin egen väska … massa smycken i glaslådor och på andra sidan massa väskor … de olika delarna
// kostar olika mycket"). Butiken byggdes först i Pixelskolan (8bitcat/pixelskolan bling.js) och lyftes hit enligt
// överlämningen (pixelskolan/docs/HANDOVER-PIXELCITY-BLING.md) – Carl valde en egen butik i staden (LINNÉGATAN 11,
// mellan bageriet och blomsterhandeln) och dubbla Pixelskolans priser.
// En egen butiksscen med samma gränssnitt som Snabbfilens butiker (enter/exit/update/draw/down/move/up),
// målad med spelets penna (floor-pix.js) och med spelets figurer (people.js):
//   vänster: tre glasmontrar (halsband, örhängen, armband och ringar) – spelets riktiga smycken, som syns på figuren
//   höger:   väggen med väskor och väskbordet – spelets väskor
//   fram:    ateljén – DESIGNA HALSBAND (kedja, hänge, sten, pärlor) och DESIGNA VÄSKA (modell, färg, mönster,
//            berlock); varje del har sitt pris och det färdiga sätts på figuren (närmaste modell i spelet + färgen)
//   spegeln: smyckeskrinet – allt man äger och sina egna designer, ta på och av
// Man ser alltid hur det blir på figuren, som i klädaffären (Carl 2026-10-11): montrarna öppnar klädaffärens egen
// provdialog (Du nu ➜ Med …, vrid figuren, välj färg) och ateljén och spegeln har samma vridbara figur.
// Pengarna är spelets (A.game.money). Egna designer sparas i sparfilen (g.designs, högst 40), figuren med saveAvatar.
import { Pix, SMALL, BIG, textW, text as pixText, ctxText, mix, mul, hash, bayer } from '../core/floor-pix.js';
import { drawPerson, makeLookRich } from '../core/people.js';
import { openModal, closeModal, esc, toast } from '../core/ui.js';
import { saveAvatar } from '../core/avatar.js';
import { $t } from '../core/i18n.js';
import { itemById, lookForItem, lookWithoutSlot, isWorn } from '../data/wardrobe.js';
import { fmt } from '../game.js';
import { play } from '../core/sound.js';
import { openBuy, figure } from './klader/buy.js';   // klädaffärens provdialog: samma sätt att prova som för kläderna
// pixeltypsnittet har bara versaler och några accenter (som i accessoarbutiken, docs/SPRAK.md)
const safeTxt = (s) => String(s).replace(/­/g, '').toUpperCase().replace(/[–—]/g, '-').replace(/&/g, '+').replace(/[^A-ZÅÄÖÉÁÀÂÃÇĆÈÊËÍÌÎÏÑŃÓÒÔÕŚŹŻÚÙÛÜŸÝĄĘŁŒÆ¡¿0-9 -+!.:,?/%'=]/g, '');

const W = 384, H = 216, WALL = 90;
const WALK = [1, 3, 2, 3];
const pickOf = (a) => a[Math.floor(Math.random() * a.length)];

// ---------- sortimentet i montrarna och på väskväggen (spelets katalog) ----------
const CATS = {
  halsband: { title: $t('📿 Halsband'), ids: ['neck-necklace', 'neck-pearls', 'neck-chain', 'neck-choker', 'neck-dogtag', 'neck-lei'] },
  orhangen: { title: $t('✨ Örhängen'), ids: ['jewel-heartear', 'jewel-starear', 'jewel-hoops', 'jewel-pearlear', 'jewel-drops', 'jewel-featherear', 'jewel-studgold', 'jewel-studdiamond'] },
  armband: { title: $t('💍 Armband, ringar och klockor'), ids: ['jewel-friendship', 'jewel-beadbracelet', 'jewel-bracelet', 'jewel-rings', 'jewel-watch', 'jewel-smartwatch', 'jewel-goldwatch', 'jewel-goldset'] },
  vaskor: { title: $t('👜 Väskor'), ids: ['bag-handbag', 'bag-shoulder', 'bag-teddypack', 'bag-backpack', 'bag-schoolbag', 'bag-fannypack', 'bag-sling', 'bag-messenger', 'bag-shoppingbag', 'bag-sportsbag', 'bag-fairywings', 'bag-hikingpack'] },
};

// ---------- ateljén: delarna och priserna (dubbla Pixelskolans – Pixelcitys löner är högre) ----------
const GEMS = { rosa: ['#f5a3c7', '#d76a9a', '#ffd8ea'], lila: ['#b07ae0', '#7d4bb8', '#e0c8ff'], bla: ['#4f8ff0', '#2a5cc0', '#bcd8ff'], gron: ['#3fbf7a', '#23885a', '#b8f0d0'], rod: ['#e8394f', '#a8203a', '#ffb0bc'], vit: ['#f4fbff', '#b8d4e8', '#ffffff'], guld: ['#f2c14e', '#b9862a', '#fff0b0'] };
const NECK = {
  kedja: { label: $t('Kedja'), opts: [['lader', $t('Läderband'), 40], ['silver', $t('Silverkedja'), 80], ['sammet', $t('Sammetsband'), 60], ['regnbage', $t('Regnbågspärlor'), 120], ['guld', $t('Guldkedja'), 240], ['parlor', $t('Pärlband'), 300]] },
  hange: { label: $t('Hänge'), opts: [['inget', $t('Inget'), 0], ['hjarta', $t('Hjärta'), 80], ['stjarna', $t('Stjärna'), 80], ['mane', $t('Måne'), 100], ['bokstav', $t('Bokstav'), 100], ['fjaril', $t('Fjäril'), 120], ['katt', $t('Katt'), 140], ['enhorning', $t('Enhörning'), 240], ['krona', $t('Krona'), 300], ['diamant', $t('Diamant'), 600]] },
  sten: { label: $t('Sten'), opts: [['ingen', $t('Ingen sten'), 0], ['rosa', $t('Rosenkvarts'), 60], ['lila', $t('Ametist'), 120], ['bla', $t('Safir'), 160], ['gron', $t('Smaragd'), 180], ['rod', $t('Rubin'), 200], ['vit', $t('Diamant'), 400]] },
  parlor: { label: $t('Pärlor på kedjan'), opts: [['0', $t('Inga'), 0], ['2', $t('2 pärlor'), 40], ['4', $t('4 pärlor'), 80], ['6', $t('6 pärlor'), 120], ['10', $t('10 pärlor'), 200]] },
};
const BAGC = { rosa: '#f07ab0', rod: '#d8394a', orange: '#f0902e', gul: '#f2c94e', gron: '#4fb06a', turkos: '#2ab0b0', bla: '#3a7bd5', lila: '#9a62d8', svart: '#2b2a33', vit: '#f2efe8', glitter: '#e8a0d8', silver: '#c8d0da', guld: '#e8b84a' };
const BAG = {
  modell: { label: $t('Modell'), opts: [['kasse', $t('Shoppingkasse'), 60], ['midje', $t('Midjeväska'), 120], ['rygg', $t('Ryggsäck'), 180], ['axel', $t('Axelväska'), 200], ['nalle', $t('Nalleryggsäck'), 220], ['hand', $t('Handväska'), 240]] },
  farg: { label: $t('Färg'), opts: [['rosa', $t('Rosa'), 0], ['rod', $t('Röd'), 0], ['orange', $t('Orange'), 0], ['gul', $t('Gul'), 0], ['gron', $t('Grön'), 0], ['turkos', $t('Turkos'), 0], ['bla', $t('Blå'), 0], ['lila', $t('Lila'), 0], ['svart', $t('Svart'), 0], ['vit', $t('Vit'), 0], ['glitter', $t('Glitter'), 100], ['silver', $t('Silver'), 120], ['guld', $t('Guld'), 160]] },
  monster: { label: $t('Mönster'), opts: [['inget', $t('Inget'), 0], ['prickar', $t('Prickar'), 40], ['rander', $t('Ränder'), 40], ['hjartan', $t('Hjärtan'), 80], ['stjarnor', $t('Stjärnor'), 80], ['leopard', $t('Leopard'), 120]] },
  berlock: { label: $t('Berlock'), opts: [['ingen', $t('Ingen'), 0], ['pompom', $t('Pompom'), 50], ['hjarta', $t('Hjärta'), 60], ['stjarna', $t('Stjärna'), 60], ['nalle', $t('Nalle'), 90]] },
};
const optOf = (grp, id) => grp.opts.find((o) => o[0] === id);
const priceOf = (GR, sel) => Object.keys(GR).reduce((s, k) => s + (optOf(GR[k], sel[k])?.[2] || 0), 0);
// den egna designen på figuren: närmaste modell i spelet + färgen
function neckLook(sel) {
  const gem = sel.sten !== 'ingen' ? GEMS[sel.sten][0] : sel.hange === 'diamant' ? GEMS.vit[0] : '#f2c14e';
  if (sel.kedja === 'parlor') return { id: 'neck-pearls', look: { neck: 'pearls' } };
  if (sel.kedja === 'sammet') return { id: 'neck-choker', look: { neck: 'choker', neckColor: sel.sten !== 'ingen' ? GEMS[sel.sten][1] : '#8e1f3c' } };
  if (sel.kedja === 'guld' && sel.hange === 'inget') return { id: 'neck-chain', look: { neck: 'chain' } };
  return { id: 'neck-necklace', look: { neck: 'necklace', neckColor: gem } };
}
const BAG_STYLE = { kasse: ['bag-shoppingbag', 'shoppingBag'], midje: ['bag-fannypack', 'fannyPack'], rygg: ['bag-backpack', 'backpack'], axel: ['bag-shoulder', 'shoulder'], nalle: ['bag-teddypack', 'teddyPack'], hand: ['bag-handbag', 'handbag'] };
const bagLook = (sel) => ({ id: BAG_STYLE[sel.modell][0], look: { bag: BAG_STYLE[sel.modell][1], bagColor: BAGC[sel.farg] } });

// ---------- ritning av halsbanden och väskorna i ateljén (96×72 pixlar) ----------
const SPRITES = {
  hjarta: ['.##.##.', '#######', '#######', '.#####.', '..###..', '...#...'],
  stjarna: ['...#...', '...#...', '#######', '.#####.', '..###..', '.##.##.', '.#...#.'],
  mane: ['..###.', '.##...', '##....', '##....', '##....', '.##...', '..###.'],
  fjaril: ['##...##', '###.###', '###.###', '.#####.', '###.###', '##...##'],
  katt: ['#.....#', '##...##', '#######', '#k###k#', '###n###', '.#####.'],
  enhorning: ['g........', '.g.......', '..g.w....', '..wwwpp..', '.wwwwwpb.', '.wkwwwwpb', 'wwwwwwwpb', 'nwwwwwwp.', '..wwwwp..'],
  krona: ['#..#..#', '##.#.##', '#######', '#######', '#.#.#.#'],
  diamant: ['.#####.', '#######', '.#####.', '..###..', '...#...'],
};
// var stenen sitter i varje hänge (rutor i hängets egna pixlar; katten får stenen som ögon)
const GEMPOS = { hjarta: [[3, 2]], stjarna: [[3, 3]], mane: [[1, 3]], fjaril: [[1, 1], [5, 1], [1, 4], [5, 4]], katt: [[1, 3], [5, 3]], krona: [[1, 3], [3, 3], [5, 3]], enhorning: [[4, 9]] };
function stampC(P, rows, x, y, pal, edge) {   // flerfärgad stämpel med kontur utanpå
  const on = (i, j) => (rows[j]?.[i] ?? '.') !== '.';
  rows.forEach((r, j) => [...r].forEach((ch, i) => { if (ch !== '.') P.px(x + i, y + j, pal[ch] ?? pal['#']); }));
  if (edge) for (let j = -1; j <= rows.length; j++) for (let i = -1; i <= rows[0].length; i++) if (!on(i, j) && (on(i - 1, j) || on(i + 1, j) || on(i, j - 1) || on(i, j + 1))) P.px(x + i, y + j, edge);
}
const x2 = (rows) => rows.flatMap((r) => { const d = [...r].map((c) => c + c).join(''); return [d, d]; });
const BAGSPR = { hjarta: ['##.##', '#####', '.###.', '..#..'], stjarna: ['..#..', '#####', '.###.', '##.##'] };
function stamp(P, rows, x, y, col, edge) {
  rows.forEach((r, j) => [...r].forEach((ch, i) => { if (ch === '#') P.px(x + i, y + j, col); }));
  if (edge) rows.forEach((r, j) => [...r].forEach((ch, i) => {
    if (ch !== '#') return;
    const n = (dx, dy) => rows[j + dy]?.[i + dx] === '#';
    if (!n(-1, 0) || !n(1, 0) || !n(0, -1) || !n(0, 1)) P.px(x + i, y + j, edge);
  }));
}
function drawNecklace(sel, initial) {
  const P = new Pix(96, 72);
  // smyckeskrinet: sammetsbust på ljus bakgrund med spotlight
  for (let y = 0; y < 72; y++) for (let x = 0; x < 96; x++) P.px(x, y, mix(0xfbe6ef, 0xf3cfe0, y / 72 + (bayer(x, y) - 0.5) * 0.06));
  P.ell(48, 20, 44, 34, 0xffffff, 0.35, 5);
  const bust = 0x23244f, bustL = 0x3a3c78;
  for (let y = 4; y < 72; y++) for (let x = 0; x < 96; x++) {
    const neck = Math.abs(x - 48) <= 11 && y < 34;
    const sh = y >= 30 && Math.abs(x - 48) <= 11 + (y - 30) * 1.6 + Math.sqrt(Math.max(0, y - 30)) * 3;
    if (neck || sh) P.px(x, y, (x - 48) < -4 + (y > 30 ? -(y - 30) * 0.6 : 0) ? bustL : bust);
  }
  P.hl(37, 4, 23, 0x1a1a3c); for (let y = 4; y < 30; y++) { P.px(37, y, 0x1a1a3c); P.px(59, y, 0x1a1a3c); }
  // kedjans båge
  const choker = sel.kedja === 'sammet';
  const pts = []; const y0 = choker ? 24 : 26, sag = choker ? 5 : 22, half = choker ? 13 : 20;
  for (let t = 0; t <= 200; t++) { const u = t / 200, x = 48 - half + u * 2 * half, y = y0 + sag * (1 - (2 * u - 1) ** 2); pts.push([Math.round(x), Math.round(y)]); }
  const uniq = pts.filter((p, i) => !i || p[0] !== pts[i - 1][0] || p[1] !== pts[i - 1][1]);
  const RB = [0xe8394f, 0xf0902e, 0xf2c94e, 0x4fb06a, 0x3a7bd5, 0x9a62d8];
  uniq.forEach(([x, y], i) => {
    if (sel.kedja === 'guld') P.px(x, y, i % 2 ? 0xfff0b0 : 0xe8b84a);
    else if (sel.kedja === 'silver') P.px(x, y, i % 2 ? 0xffffff : 0xaab4c0);
    else if (sel.kedja === 'lader') { P.px(x, y, 0x7a4a2a); P.px(x, y + 1, 0x5a3418); }
    else if (choker) { for (let k = 0; k < 4; k++) P.px(x, y + k, k === 0 ? 0xffffff : sel.sten !== 'ingen' ? parseInt(GEMS[sel.sten][k > 2 ? 1 : 0].slice(1), 16) : (k > 2 ? 0x5e1228 : 0x8e1f3c)); }
  });
  if (sel.kedja === 'parlor' || sel.kedja === 'regnbage') uniq.forEach(([x, y], i) => {
    if (i % 4) return;
    const c = sel.kedja === 'parlor' ? 0xf6f2ea : RB[(i / 4) % 6];
    P.rect(x - 1, y - 1, 3, 3, c); P.px(x - 1, y - 1, 0xffffff); P.px(x + 1, y + 1, mul(c, 0.7));
  });
  // pärlorna i stenens färg längs kedjan
  const n = +sel.parlor, gemC = sel.sten !== 'ingen' ? GEMS[sel.sten] : GEMS.guld;
  for (let k = 0; k < n; k++) {
    const u = (k + 1) / (n + 1), [x, y] = uniq[Math.round(u * (uniq.length - 1))];
    if (Math.abs(x - 48) < 4 && sel.hange !== 'inget') continue;
    const c = parseInt(gemC[0].slice(1), 16);
    P.rect(x - 1, y - 1, 3, 3, c); P.px(x - 1, y - 1, parseInt(gemC[2].slice(1), 16)); P.px(x + 1, y + 1, parseInt(gemC[1].slice(1), 16));
  }
  // hänget
  const by = choker ? y0 + 4 : y0 + sag + 1;
  if (sel.hange !== 'inget') {
    const metal = sel.kedja === 'silver' ? 0xd8dee6 : 0xf2c14e, metalD = sel.kedja === 'silver' ? 0x8a94a2 : 0xb9862a;
    const gem = sel.sten !== 'ingen' ? GEMS[sel.sten].map((h) => parseInt(h.slice(1), 16)) : null;
    const fill = sel.hange === 'bokstav' && gem ? gem[0] : metal;
    P.vl(48, by, 2, metal);
    if (sel.hange === 'bokstav') {
      P.rect(41, by + 2, 15, 15, metal); P.box(41, by + 2, 15, 15, metalD); P.hl(42, by + 3, 13, mix(metal, 0xffffff, 0.5));
      const ch = (initial || 'A').toUpperCase(), F = BIG[ch] ? BIG : SMALL; pixText(P, F, ch, 49 - (textW(F, ch) >> 1), by + 6, fill === metal ? 0x8a5a10 : fill);
    } else {
      const S = x2(SPRITES[sel.hange]), w = S[0].length, sx = 48 - (w >> 1), sy = by + 2;
      const body = sel.hange === 'diamant' ? (gem ? mix(gem[0], 0xffffff, 0.35) : 0xeaf6ff) : metal;   // diamanten får stenens färg (en färgad diamant)
      stampC(P, S, sx, sy, { '#': body, w: 0xffffff, g: 0xf2c14e, p: 0xff8ac4, b: 0x7ab8ff, k: gem ? gem[0] : 0x2a1a2e, n: 0xb8a8b0 }, metalD);
      if (sel.hange === 'diamant') for (let j = 2; j < S.length - 2; j += 2) P.hl(sx + j + 1, sy + j, w - 2 * j - 2, mix(body, 0xffffff, 0.6));
      for (let j = 1; j < 4; j++) { const i = S[j].search(/[^.]/); if (i >= 0 && S[j][i + 1] && S[j][i + 1] !== '.') P.px(sx + i + 1, sy + j, 0xffffff); }   // glansen
      if (gem && sel.hange !== 'katt') for (const [gx, gy] of GEMPOS[sel.hange] || []) { const X = sx + gx * 2, Y = sy + gy * 2; P.rect(X, Y, 2, 2, gem[0]); P.px(X, Y, gem[2]); P.px(X + 1, Y + 1, gem[1]); }
    }
  }
  return P.flush();
}
function drawBag(sel) {
  const P = new Pix(96, 72);
  for (let y = 0; y < 72; y++) for (let x = 0; x < 96; x++) P.px(x, y, mix(0xeaf2fb, 0xd6e2f2, y / 72 + (bayer(x, y) - 0.5) * 0.06));
  P.ell(48, 26, 40, 30, 0xffffff, 0.4, 5);
  for (let x = 0; x < 96; x++) { P.px(x, 62, 0xb8c6d8); for (let y = 63; y < 72; y++) P.px(x, y, mix(0xc8d4e4, 0xb0bed2, (y - 63) / 9)); }
  const base = parseInt(BAGC[sel.farg].slice(1), 16), dark = mul(base, 0.7), lite = mix(base, 0xffffff, 0.35), line = mul(base, 0.45);
  const M = sel.modell;
  // kroppen (x0, y0, w, h) per modell + handtag/remmar
  const body = { kasse: [32, 26, 32, 34], midje: [26, 34, 44, 22], rygg: [30, 18, 36, 42], axel: [28, 28, 40, 30], nalle: [30, 22, 36, 38], hand: [28, 30, 40, 28] }[M];
  const [bx, by, bw, bh] = body;
  const inBody = (x, y) => {
    const lx = x - bx, ly = y - by;
    if (lx < 0 || ly < 0 || lx >= bw || ly >= bh) return false;
    if (M === 'hand') { const ins = Math.round((1 - ly / bh) * 4); return lx >= ins && lx < bw - ins; }
    if (M === 'midje') { const e = ((lx - bw / 2) / (bw / 2)) ** 2 + ((ly - bh / 2) / (bh / 2)) ** 2; return e <= 1.15; }
    if (M === 'rygg' || M === 'nalle') { const r = 7; const cx = lx < r ? r : lx > bw - 1 - r ? bw - 1 - r : lx, cy = ly < r ? r : ly; return (lx - cx) ** 2 + (ly - cy) ** 2 <= r * r; }
    return true;
  };
  // remmar bakom kroppen
  if (M === 'axel') { P.line(bx + 3, by, bx + 14, 4, dark); P.line(bx + 4, by, bx + 15, 4, line); P.line(bx + bw - 4, by, bx + bw - 15, 4, dark); P.line(bx + bw - 5, by, bx + bw - 16, 4, line); }
  if (M === 'rygg' || M === 'nalle') { P.rect(bx + 6, by - 4, 3, 6, dark); P.rect(bx + bw - 9, by - 4, 3, 6, dark); P.hl(bx + 6, by - 5, bw - 12, dark); }
  if (M === 'midje') { P.rect(4, by + 8, 92, 4, 0x2b2a33); P.hl(4, by + 8, 92, 0x4a4856); }
  for (let y = by; y < by + bh; y++) for (let x = bx; x < bx + bw; x++) {
    if (!inBody(x, y)) continue;
    const lx = x - bx, ly = y - by;
    let c = lx < 3 ? lite : lx > bw - 4 ? dark : base;
    if (sel.farg === 'guld' || sel.farg === 'silver') c = mix(c, 0xffffff, ((lx + ly) % 9 < 2) ? 0.45 : 0);
    if (sel.farg === 'glitter' && hash(x, y, 7) > 0.8) c = hash(x, y, 8) > 0.5 ? 0xffffff : 0xffe6fa;
    // mönstret
    const p = sel.monster;
    if (p === 'prickar' && (lx % 6 === 2) && ((ly + (Math.floor(lx / 6) % 2) * 3) % 6 === 2)) c = mix(base, 0xffffff, 0.75);
    if (p === 'rander' && Math.floor(ly / 3) % 2) c = mix(c, 0xffffff, 0.55);
    if (p === 'leopard' && hash(Math.floor(x / 3), Math.floor(y / 3), 9) > 0.72) c = hash(x, y, 10) > 0.4 ? 0x3a2a1a : 0xc8902a;
    P.px(x, y, c);
  }
  if (sel.monster === 'hjartan' || sel.monster === 'stjarnor') {
    const S = BAGSPR[sel.monster === 'hjartan' ? 'hjarta' : 'stjarna'], c = mix(base, 0xffffff, 0.8);
    for (let yy = by + 3; yy < by + bh - 4; yy += 8) for (let xx = bx + 3 + ((yy - by) % 16 ? 4 : 0); xx < bx + bw - 6; xx += 9) if (inBody(xx + 2, yy + 2)) stamp(P, S, xx, yy, c);
  }
  // konturen
  for (let y = by - 1; y <= by + bh; y++) for (let x = bx - 1; x <= bx + bw; x++) if (!inBody(x, y) && (inBody(x + 1, y) || inBody(x - 1, y) || inBody(x, y + 1) || inBody(x, y - 1))) P.px(x, y, line);
  // detaljer per modell
  const gold = 0xf2c14e, goldD = 0xb9862a;
  if (M === 'hand') { for (let a = 0; a <= 40; a++) { const t = Math.PI * a / 40, x = 48 + Math.cos(t) * 12, y = by - Math.sin(t) * 11; P.rect(Math.round(x), Math.round(y), 2, 2, dark); } P.rect(bx + 4, by, bw - 8, 9, mul(base, 0.85)); P.hl(bx + 4, by + 9, bw - 8, line); P.rect(46, by + 7, 5, 4, gold); P.px(46, by + 7, 0xfff0b0); }
  if (M === 'axel') { P.rect(bx, by, bw, 10, mul(base, 0.85)); P.hl(bx, by + 10, bw, line); P.rect(45, by + 8, 6, 4, gold); P.box(45, by + 8, 6, 4, goldD); }
  if (M === 'kasse') {   // två repband, vikt kant och butikens guldhjärta
    for (const hx of [bx + 9, bx + bw - 9]) for (let a = 0; a <= 24; a++) { const t = Math.PI * a / 24, x = Math.round(hx + Math.cos(t) * 4), y = Math.round(by - Math.sin(t) * 8); P.px(x, y, 0x5a4a3a); P.px(x, y + 1, 0x3a2a1a); }
    P.rect(bx, by, bw, 4, lite); P.hl(bx, by + 4, bw, line);
    stamp(P, BAGSPR.hjarta, 46, by + 14, gold, goldD);
  }
  if (M === 'rygg' || M === 'nalle') { P.rect(bx + 8, by + bh - 16, bw - 16, 12, mul(base, 0.85)); P.box(bx + 8, by + bh - 16, bw - 16, 12, line); P.hl(bx + 9, by + bh - 13, bw - 18, gold); }
  if (M === 'nalle') {
    for (const [ex, ey] of [[bx + 4, by - 2], [bx + bw - 5, by - 2]]) { for (let y = -4; y <= 4; y++) for (let x = -4; x <= 4; x++) if (x * x + y * y <= 16) P.px(ex + x, ey + y, x * x + y * y <= 4 ? lite : base); }
    P.rect(bx + 13, by + 10, 2, 2, 0x1a1418); P.rect(bx + bw - 15, by + 10, 2, 2, 0x1a1418); P.rect(bx + 16, by + 14, 4, 3, lite); P.px(bx + 17, by + 14, 0x1a1418); P.px(bx + 18, by + 14, 0x1a1418);
  }
  if (M === 'midje') { P.rect(bx + 6, by + 6, bw - 12, 2, line); P.rect(46, by + 5, 4, 4, gold); }
  // berlocken
  const hx = M === 'midje' ? bx + bw - 6 : M === 'kasse' ? bx + bw - 6 : bx + bw - 7, hy = M === 'hand' ? by + 2 : M === 'midje' ? by + 4 : by + 3;
  if (sel.berlock !== 'ingen') {
    P.vl(hx, hy, 5, goldD); P.px(hx, hy + 5, gold);
    const cy = hy + 7;
    if (sel.berlock === 'pompom') for (let y = -3; y <= 3; y++) for (let x = -3; x <= 3; x++) { if (x * x + y * y <= 10 + hash(x, y, 3) * 4) P.px(hx + x, cy + y, hash(x, y, 4) > 0.5 ? 0xffb8dc : 0xff8ac4); }
    else if (sel.berlock === 'nalle') { P.rect(hx - 2, cy - 1, 5, 5, 0xa8743e); P.px(hx - 2, cy - 2, 0xa8743e); P.px(hx + 2, cy - 2, 0xa8743e); P.px(hx - 1, cy + 1, 0x1a1418); P.px(hx + 1, cy + 1, 0x1a1418); P.px(hx, cy + 2, 0x5a3418); }
    else stamp(P, BAGSPR[sel.berlock], hx - 2, cy - 1, sel.berlock === 'hjarta' ? 0xe8394f : gold, sel.berlock === 'hjarta' ? 0xa8203a : goldD);
  }
  return P.flush();
}
const big = (cv, k) => { const o = document.createElement('canvas'); o.width = cv.width * k; o.height = cv.height * k; const g = o.getContext('2d'); g.imageSmoothingEnabled = false; g.drawImage(cv, 0, 0, o.width, o.height); return o; };

// ---------- butiken: bakgrunden (väggar, golv, skyltar, väggvaror) ----------
const GOLD = 0xe8b84a, GOLDD = 0xb9862a, GOLDL = 0xfff0b0, PINK = 0xf7dce8, PINK2 = 0xf1cfe0;
const DOOR = { x0: 178, x1: 206 };
function paintBG() {
  const P = new Pix(W, H);
  for (let y = 0; y < WALL; y++) for (let x = 0; x < W; x++) {
    let c = Math.floor(x / 12) % 2 ? PINK : PINK2;
    if (y < 7) c = y === 6 ? GOLDD : y === 5 ? GOLD : 0xfff7f0;
    else if (y < 9) c = y === 7 ? GOLDL : GOLD;
    else if ((x % 12 === 6) && (y % 12 === 2)) c = GOLD;
    else if ((x % 12 === 6 && (y % 12 === 1 || y % 12 === 3)) || ((x % 12 === 5 || x % 12 === 7) && y % 12 === 2)) c = mix(c, GOLD, 0.45);
    if (y >= WALL - 18) { const lx = x % 32; c = y === WALL - 18 ? GOLD : y === WALL - 17 ? GOLDD : (lx === 2 || lx === 29 || y === WALL - 15 || y === WALL - 3) && y > WALL - 16 ? mix(0xfff7f0, GOLD, 0.6) : 0xfff7f0; }
    if (y === WALL - 1) c = GOLDD;
    P.px(x, y, c);
  }
  // golvet: marmorplattor i två toner med guldfogar och ådring
  for (let y = WALL; y < H; y++) for (let x = 0; x < W; x++) {
    const tx = Math.floor(x / 24), ty = Math.floor((y - WALL) / 14), lx = x % 24, ly = (y - WALL) % 14;
    let c = (tx + ty) % 2 ? 0xf6f0f4 : 0xfbe9f1;
    const v = Math.sin(x * 0.13 + y * 0.31 + Math.sin(x * 0.05 + tx) * 2.6);
    if (v > 0.96) c = mul(c, 0.94);
    if (lx === 0 || ly === 0) c = (tx % 2 === 0 && lx === 0) || (ty % 2 === 0 && ly === 0) ? mix(GOLD, 0xffffff, 0.35) : mul(c, 0.93);
    if (ly === 1) c = mix(c, 0xffffff, 0.4);
    P.px(x, y, c);
  }
  for (let x = 0; x < W; x++) { P.px(x, WALL, 0x000000, 0.18); P.px(x, WALL + 1, 0x000000, 0.08); }
  // den runda mattan
  for (let y = 132; y < 196; y++) for (let x = 104; x < 280; x++) {
    const e = ((x - 192) / 86) ** 2 + ((y - 164) / 30) ** 2;
    if (e > 1) continue;
    let c = e > 0.88 ? GOLD : e > 0.8 ? 0xd84a8a : e > 0.5 ? 0xf07ab0 : 0xf8a4c8;
    if (e < 0.5 && (Math.floor((x - 192) / 6) + Math.floor((y - 164) / 4)) % 2 === 0 && hash(x >> 1, y >> 1, 3) > 0.5) c = mix(c, 0xffffff, 0.2);
    if (e > 0.6 && e < 0.68) c = GOLDL;
    P.px(x, y, c);
  }
  // dörren UT
  P.rect(DOOR.x0 - 3, 44, DOOR.x1 - DOOR.x0 + 6, WALL - 44, GOLD); P.rect(DOOR.x0 - 2, 45, DOOR.x1 - DOOR.x0 + 4, 1, GOLDL);
  for (let y = 47; y < WALL - 1; y++) for (let x = DOOR.x0; x < DOOR.x1; x++) { let c = mix(0xbfe6f6, 0xe8f6fc, (y - 47) / 41); if (x === (DOOR.x0 + DOOR.x1) >> 1) c = GOLDD; if ((x - y + 400) % 11 < 2) c = mix(c, 0xffffff, 0.6); P.px(x, y, c); }
  P.rect(190, 60, 1, 10, GOLDD); P.rect(193, 60, 1, 10, GOLDD);
  P.rect(183, 35, 18, 8, 0x2a8a4a); P.box(183, 35, 18, 8, 0x1a5a2a); { const ut = safeTxt($t('UT')); pixText(P, SMALL, ut, 192 - (textW(SMALL, ut) >> 1), 36, 0xffffff); }
  // skylten BLING BLING (glitter: guld med rosa skugga)
  const nm = 'BLING BLING', tw = textW(BIG, nm, 2), nx = 192 - (tw >> 1);
  P.rect(nx - 8, 11, tw + 16, 22, 0x2a1a2e); P.box(nx - 8, 11, tw + 16, 22, GOLD); P.box(nx - 7, 12, tw + 14, 20, GOLDD);
  pixText(P, BIG, nm, nx, 17, 0xb83a78, 1, 2); pixText(P, BIG, nm, nx, 15, GOLD, 1, 2);
  for (let x = nx; x < nx + tw; x++) for (let y = 15; y < 19; y++) if (P.get(x, y) === GOLD) P.px(x, y, GOLDL);
  for (let x = nx; x < nx + tw; x++) for (let y = 25; y < 29; y++) if (P.get(x, y) === GOLD) P.px(x, y, GOLDD);
  // vänstra väggen: SMYCKEN och byster med halsband på en hylla
  const plate = (x, s) => { const w = textW(SMALL, s) + 10; P.rect(x, 14, w, 11, GOLD); P.box(x, 14, w, 11, GOLDD); P.hl(x + 1, 15, w - 2, GOLDL); pixText(P, SMALL, s, x + 5, 17, 0x5a3a10); return w; };
  plate(54, safeTxt($t('SMYCKEN'))); { const v = safeTxt($t('VÄSKOR')); plate(Math.min(288, 378 - textW(SMALL, v) - 10), v); }
  P.rect(14, 58, 120, 3, 0xfff7f0); P.hl(14, 61, 120, GOLDD); P.hl(14, 62, 120, 0x000000, 0.12);
  const NECKS = [['parlor', 0xf6f2ea], ['guld', 0xe8b84a], ['sammet', 0x8e1f3c], ['regnbage', 0], ['silver', 0xd8dee6]];
  NECKS.forEach(([k, c], i) => {
    const cx = 26 + i * 24;
    for (let y = 32; y < 58; y++) for (let x = cx - 9; x <= cx + 9; x++) { const neck = Math.abs(x - cx) <= 3 && y < 46; const sh = y >= 44 && Math.abs(x - cx) <= 3 + (y - 44) * 0.75 + 1; if (neck || sh) P.px(x, y, x < cx - 1 ? 0x3a3c78 : 0x23244f); }
    P.rect(cx - 4, 57, 9, 1, GOLDD);
    for (let t = 0; t <= 16; t++) { const u = t / 16, x = cx - 6 + u * 12, y = 44 + 6 * (1 - (2 * u - 1) ** 2); const col = k === 'regnbage' ? [0xe8394f, 0xf2c94e, 0x4fb06a, 0x3a7bd5, 0x9a62d8][t % 5] : c; P.px(Math.round(x), Math.round(y), col); }
    if (k === 'guld') stamp(P, ['#.#', '###', '.#.'], cx - 1, 51, 0xe8394f);
    if (k === 'sammet') P.rect(cx - 1, 46, 3, 2, 0xf2c14e);
  });
  // spegeln (smyckeskrinet) till vänster om dörren
  P.rect(144, 38, 24, 50, GOLD); P.box(144, 38, 24, 50, GOLDD); P.hl(145, 39, 22, GOLDL);
  for (let y = 41; y < 85; y++) for (let x = 147; x < 165; x++) { let c = mix(0xd8eef8, 0xf6fbff, (y - 41) / 44); if ((x - y + 300) % 13 < 3) c = mix(c, 0xffffff, 0.7); P.px(x, y, c); }
  stamp(P, ['.#.', '###', '.#.'], 155, 34, GOLDL);
  // högra väggen: väskhyllorna (3 × 6 fack) fulla med väskor
  const cols = [0xf07ab0, 0xd8394a, 0x3a7bd5, 0xf2c94e, 0x9a62d8, 0x2ab0b0, 0x2b2a33, 0xf0902e, 0x4fb06a, 0xf2efe8, 0xe8b84a, 0xc8d0da];
  for (let r = 0; r < 3; r++) for (let k = 0; k < 6; k++) {
    const x = 233 + k * 24, y = 37 + r * 16;
    P.rect(x - 1, y - 1, 24, 16, 0xfff7f0); P.box(x - 1, y - 1, 24, 16, GOLD); P.hl(x, y + 13, 22, GOLDD);
    const c = cols[(k * 5 + r * 7) % cols.length], d = mul(c, 0.7), kind = (k + r * 2) % 5, bx = x + 5;
    if (kind === 0) { P.rect(bx, y + 6, 12, 7, c); P.hl(bx, y + 6, 12, mix(c, 0xffffff, 0.3)); for (let a = 0; a <= 10; a++) { const t = Math.PI * a / 10; P.px(Math.round(bx + 6 + Math.cos(t) * 4), Math.round(y + 6 - Math.sin(t) * 4), d); } P.px(bx + 6, y + 8, 0xf2c14e); }
    else if (kind === 1) { P.rect(bx + 1, y + 4, 10, 9, c); P.rect(bx + 1, y + 4, 10, 3, d); P.px(bx + 6, y + 7, 0xf2c14e); P.line(bx + 1, y + 4, bx + 4, y + 1, d); P.line(bx + 10, y + 4, bx + 7, y + 1, d); }
    else if (kind === 2) { for (let yy = 0; yy < 9; yy++) for (let xx = 0; xx < 10; xx++) if (!((yy < 2) && (xx < 2 || xx > 7))) P.px(bx + 1 + xx, y + 4 + yy, xx < 2 ? mix(c, 0xffffff, 0.25) : c); P.rect(bx + 3, y + 8, 6, 4, d); }
    else if (kind === 3) { stamp(P, ['.##.##.', '#######', '#######', '.#####.', '..###..', '...#...'], bx + 2, y + 6, c, d); P.line(bx + 2, y + 6, bx + 5, y + 2, d); P.line(bx + 8, y + 6, bx + 5, y + 2, d); }
    else { P.rect(bx, y + 5, 12, 8, c); for (let xx = 0; xx < 12; xx += 3) P.vl(bx + xx, y + 5, 8, mix(c, 0xffffff, 0.4)); P.line(bx + 2, y + 5, bx + 3, y + 2, 0x5a4a3a); P.line(bx + 9, y + 5, bx + 8, y + 2, 0x5a4a3a); }
  }
  return P.flush();
}

// ---------- möblerna på golvet (ritas sorterade efter fotlinjen) ----------
function caseSprite(w, items, seed) {   // glasmonter: sammetsbricka bakom glas, vit och guld fot
  const h = 30, P = new Pix(w, h);
  P.rect(0, 12, w, 18, 0xfff7f0); P.box(0, 12, w, 18, GOLDD); P.hl(1, 13, w - 2, GOLD); P.hl(1, 27, w - 2, GOLD);
  for (let x = 4; x < w - 4; x += 12) P.rect(x, 17, 8, 7, mix(0xfff7f0, GOLD, 0.25));
  for (let y = 1; y < 12; y++) for (let x = 1; x < w - 1; x++) P.px(x, y, (x + y) % 7 === 0 ? 0x6e1830 : 0x8e1f3c);
  // smyckena på sammeten
  let x = 4;
  for (const it of items) {
    if (x > w - 8) break;
    const cy = 3 + (hash(x, 1, seed) > 0.5 ? 1 : 0);
    if (it === 'ring') { P.box(x, cy + 2, 4, 4, GOLD); P.px(x + 1, cy + 1, 0xe8394f); P.px(x + 2, cy + 1, 0xffffff); x += 6; }
    else if (it === 'halsband') { for (let t = 0; t <= 8; t++) P.px(x + t, cy + Math.round(3 * (1 - ((t - 4) / 4) ** 2)), GOLDL); P.px(x + 4, cy + 4, 0x4f8ff0); P.px(x + 4, cy + 5, 0x2a5cc0); x += 10; }
    else if (it === 'parlor') { for (let t = 0; t <= 8; t += 2) P.px(x + t, cy + Math.round(3 * (1 - ((t - 4) / 4) ** 2)), 0xffffff); x += 10; }
    else if (it === 'orhangen') { P.px(x, cy + 1, GOLD); P.px(x, cy + 2, 0xf5a3c7); P.px(x, cy + 3, 0xf5a3c7); P.px(x + 3, cy + 1, GOLD); P.px(x + 3, cy + 2, 0xf5a3c7); P.px(x + 3, cy + 3, 0xf5a3c7); x += 6; }
    else if (it === 'armband') { P.box(x, cy + 1, 6, 4, GOLD); P.px(x + 2, cy + 1, 0x3fbf7a); x += 8; }
    else if (it === 'klocka') { P.rect(x + 1, cy, 2, 6, 0x5a3418); P.rect(x, cy + 2, 4, 3, 0xe8e8ee); P.px(x + 1, cy + 3, 0x2a2a30); x += 6; }
    else if (it === 'diadem') { stamp(P, ['#.#.#', '#####'], x, cy + 2, GOLD); P.px(x + 2, cy + 2, 0xe8394f); x += 7; }
    P.rect(x - 3, cy + 7, 3, 2, 0xffffff);   // prislapp
  }
  // glaset: blå skiftning och reflexer
  for (let y = 0; y < 12; y++) for (let x2 = 0; x2 < w; x2++) if ((x2 + y * 2) % 19 < 2) P.px(x2, y, 0xffffff, 0.45);
  P.box(0, 0, w, 12, 0xc8e6f2); P.hl(0, 0, w, 0xffffff);
  return P.flush();
}
function tableSprite(kind) {   // ateljéns bord: pärlbrickor och spegel / tygrullar och symaskin, namnet på framsidan
  const w = 70, h = 32, P = new Pix(w, h);
  P.rect(0, 8, w, 6, 0xfff7f0); P.hl(0, 8, w, 0xffffff); P.hl(0, 13, w, GOLDD); P.rect(0, 14, w, 14, 0x2a1a2e); P.box(0, 14, w, 14, GOLD);
  P.rect(2, 28, 3, 4, GOLDD); P.rect(w - 5, 28, 3, 4, GOLDD);
  const name = safeTxt(kind === 'neck' ? $t('HALSBAND') : $t('VÄSKA')), des = safeTxt($t('DESIGNA'));
  pixText(P, SMALL, des, (w - textW(SMALL, des)) >> 1, 16, GOLDL); pixText(P, SMALL, name, (w - textW(SMALL, name)) >> 1, 22, 0xffb8dc);
  if (kind === 'neck') {
    const C = [0xe8394f, 0xf0902e, 0xf2c94e, 0x4fb06a, 0x3a7bd5, 0x9a62d8, 0xffffff, 0xf5a3c7];
    for (let k = 0; k < 8; k++) { const bx = 6 + k * 5; P.rect(bx, 9, 4, 3, mul(C[k], 0.7)); P.px(bx + 1, 9, C[k]); P.px(bx + 2, 10, C[k]); }
    P.rect(52, 0, 12, 10, GOLD); P.rect(53, 1, 10, 7, 0xd8eef8); P.px(54, 2, 0xffffff);
    for (let t = 0; t <= 10; t++) P.px(24 + t, 12 - Math.round(2 * (1 - ((t - 5) / 5) ** 2)), GOLDL);
  } else {
    const C = [0xf07ab0, 0x3a7bd5, 0xf2c94e, 0x9a62d8];
    C.forEach((c, k) => { P.rect(5 + k * 7, 4, 6, 6, c); P.hl(5 + k * 7, 4, 6, mix(c, 0xffffff, 0.4)); P.vl(5 + k * 7 + 5, 4, 6, mul(c, 0.7)); });
    P.rect(42, 2, 20, 8, 0xf2efe8); P.rect(44, 4, 16, 2, 0xd8394a); P.rect(56, 6, 2, 3, 0x8a929c); P.box(42, 2, 20, 8, 0x9aa2ac);
    P.rect(34, 10, 5, 2, GOLD);
  }
  return P.flush();
}
function counterSprite() {
  const w = 64, P = new Pix(w, 20);
  P.rect(0, 0, w, 4, 0xffffff); P.hl(0, 3, w, GOLD); P.rect(0, 4, w, 14, 0xf07ab0); P.box(0, 4, w, 14, 0xb83a78); P.hl(1, 5, w - 2, 0xf8a4c8);
  for (let x = 6; x < w - 4; x += 10) stamp(P, ['.#.', '###', '.#.'], x, 9, GOLDL);
  P.rect(44, -1, 12, 4, 0x2b2a33); P.rect(46, -1, 8, 1, 0x7ad07a); P.rect(6, 0, 7, 3, 0xffffff); P.rect(7, -2, 2, 2, GOLD);
  return P.flush();
}
function bagTableSprite() {
  const w = 56, P = new Pix(w, 34);
  P.rect(4, 16, w - 8, 4, 0xfff7f0); P.hl(4, 16, w - 8, 0xffffff); P.hl(4, 19, w - 8, GOLDD); P.rect(w / 2 - 3, 20, 6, 12, GOLD); P.rect(w / 2 - 10, 31, 20, 3, GOLDD);
  const bags = [[8, 0xd8394a, 'hand'], [22, 0x2ab0b0, 'rygg'], [36, 0xe8b84a, 'hand']];
  for (const [x, c, k] of bags) {
    if (k === 'hand') { P.rect(x, 9, 12, 7, c); P.hl(x, 9, 12, mix(c, 0xffffff, 0.3)); for (let a = 0; a <= 10; a++) { const t = Math.PI * a / 10; P.px(Math.round(x + 6 + Math.cos(t) * 4), Math.round(9 - Math.sin(t) * 5), mul(c, 0.7)); } P.px(x + 6, 11, GOLDL); }
    else { P.rect(x + 1, 4, 10, 12, c); P.rect(x + 3, 9, 6, 5, mul(c, 0.75)); P.hl(x + 1, 4, 10, mix(c, 0xffffff, 0.3)); }
  }
  return P.flush();
}
function plantSprite() { const P = new Pix(14, 26); P.rect(3, 18, 8, 8, GOLD); P.hl(2, 18, 10, GOLDL); P.vl(10, 19, 7, GOLDD); for (let y = 0; y < 19; y++) for (let x = 0; x < 14; x++) { const e = ((x - 7) / 6.5) ** 2 + ((y - 9) / 9.5) ** 2 + (hash(x, y, 5) - 0.5) * 0.4; if (e < 1) P.px(x, y, e < 0.3 && x < 7 ? 0x8cc462 : e < 0.6 ? 0x5a9e46 : 0x3a7e38); } return P.flush(); }
function poufSprite() { const P = new Pix(20, 12); for (let y = 0; y < 12; y++) for (let x = 0; x < 20; x++) { const e = ((x - 10) / 10) ** 2 + ((y - 5) / 6) ** 2; if (e <= 1) P.px(x, y, y < 4 ? 0xb07ae0 : y < 9 ? 0x8a52c0 : 0x6a3a98); } P.hl(3, 2, 14, 0xd0a8f8); for (let x = 2; x < 18; x += 4) P.px(x, 6, GOLD); return P.flush(); }

// ---------- scenen ----------
export function makeShopBling(A) {
  const G = A.game;
  if (!Array.isArray(G.designs)) G.designs = [];
  // egna designer i sparfilen (game.js tvättar dem vid laddningen), högst 40
  const store = { list: () => G.designs, add: (d) => { G.designs.push(d); if (G.designs.length > 40) G.designs.shift(); G.save(); } };
  const bg = paintBG();
  const keeper = { x: 254, y: 98, look: { ...makeLookRich(), hair: '#ecd489', style: 'bun', top: 'tee', shirt: '#f07ab0', kid: false, bottom: 'skirt', pants: '#2b2a33', neck: 'pearls', jewel: 'hoops' } };
  // möblerna: [sprite, x, fotlinje, hinder-rektangel]
  const F = [
    { img: caseSprite(62, ['halsband', 'parlor', 'halsband', 'diadem', 'halsband'], 1), x: 12, fy: 128, cat: 'halsband' },
    { img: caseSprite(62, ['orhangen', 'orhangen', 'ring', 'orhangen', 'ring', 'orhangen'], 2), x: 82, fy: 128, cat: 'orhangen' },
    { img: caseSprite(62, ['armband', 'klocka', 'ring', 'armband', 'klocka', 'ring'], 3), x: 24, fy: 184, cat: 'armband' },
    { img: counterSprite(), x: 222, fy: 112 },
    { img: bagTableSprite(), x: 306, fy: 160, cat: 'vaskor' },
    { img: tableSprite('neck'), x: 92, fy: 214, design: 'neck' },
    { img: tableSprite('bag'), x: 222, fy: 214, design: 'bag' },
    { img: plantSprite(), x: 4, fy: 112 }, { img: plantSprite(), x: 364, fy: 204 }, { img: plantSprite(), x: 212, fy: 104 },
    { img: poufSprite(), x: 182, fy: 170 },
  ];
  for (const f of F) { f.w = f.img.width; f.h = f.img.height; f.rect = [f.x, f.fy - Math.min(12, f.h), f.x + f.w, f.fy]; }
  const SP = {
    door: { r: [DOOR.x0 - 3, 34, DOOR.x1 + 3, WALL + 2], go: [192, 98], label: $t('GÅ UT'), act: () => { play('door'); A.go('city'); } },
    halsband: { r: [12, 98, 74, 130], go: [43, 136], label: $t('HALSBAND'), act: () => catalog('halsband') },
    orhangen: { r: [82, 98, 144, 130], go: [113, 136], label: $t('ÖRHÄNGEN'), act: () => catalog('orhangen') },
    armband: { r: [24, 154, 86, 186], go: [55, 194], label: $t('ARMBAND OCH RINGAR'), act: () => catalog('armband') },
    vaggen: { r: [230, 34, 378, 86], go: [330, 100], label: $t('VÄSKOR'), act: () => catalog('vaskor') },
    bord: { r: [306, 126, 362, 162], go: [334, 168], label: $t('VÄSKOR'), act: () => catalog('vaskor') },
    neck: { r: [92, 182, 162, 214], go: [127, 176], face: 'down', label: $t('DESIGNA HALSBAND'), act: () => designer('neck') },
    bag: { r: [222, 182, 292, 214], go: [257, 176], face: 'down', label: $t('DESIGNA VÄSKA'), act: () => designer('bag') },
    spegel: { r: [142, 32, 170, 90], go: [156, 98], label: $t('SPEGELN'), act: () => mirror() },
    kassa: { r: [222, 88, 286, 114], go: [254, 118], label: $t('KASSAN'), act: () => say(pickOf([$t('VÄLKOMMEN TILL BLING BLING!'), $t('DESIGNA ETT EGET HALSBAND VID BORDET!'), $t('VI HAR FÅTT NYA VÄSKOR PÅ VÄGGEN!'), $t('SPEGELN VISAR ALLT DU ÄGER.')]), keeper.x, keeper.y - 40) },
  };
  const blocked = (x, y) => y < WALL + 6 || y > H - 3 || x < 4 || x > W - 4 || F.some((f) => x >= f.rect[0] - 3 && x <= f.rect[2] + 3 && y >= f.rect[1] - 2 && y <= f.rect[3] + 2);
  // A* på 4 px-rutnät (som i gallerian)
  const C = 4, GW = W / C, GH = H / C;
  const free = new Uint8Array(GW * GH); for (let j = 0; j < GH; j++) for (let i = 0; i < GW; i++) free[j * GW + i] = blocked(i * C + 2, j * C + 2) ? 0 : 1;
  const near = (x, y) => { let b = -1, bd = 1e9; for (let n = 0; n < free.length; n++) if (free[n]) { const d = ((n % GW) * C + 2 - x) ** 2 + (((n / GW) | 0) * C + 2 - y) ** 2; if (d < bd) { bd = d; b = n; } } return b; };
  function path(x0, y0, x1, y1) {
    let s = ((y0 / C) | 0) * GW + ((x0 / C) | 0); if (!free[s]) s = near(x0, y0);
    const g = near(x1, y1); if (s < 0 || g < 0) return [];
    const N = free.length, gs = new Float32Array(N).fill(1e9), came = new Int32Array(N).fill(-1), done = new Uint8Array(N), open = [s]; gs[s] = 0;
    const hh = (n) => Math.hypot((n % GW) - (g % GW), ((n / GW) | 0) - ((g / GW) | 0));
    while (open.length) {
      let bi = 0; for (let k = 1; k < open.length; k++) if (gs[open[k]] + hh(open[k]) < gs[open[bi]] + hh(open[bi])) bi = k;
      const c = open.splice(bi, 1)[0]; if (c === g) break; if (done[c]) continue; done[c] = 1;
      const ci = c % GW, cj = (c / GW) | 0;
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        if (!di && !dj) continue; const ni = ci + di, nj = cj + dj; if (ni < 0 || nj < 0 || ni >= GW || nj >= GH) continue;
        const n = nj * GW + ni; if (!free[n] || done[n] || (di && dj && (!free[cj * GW + ni] || !free[nj * GW + ci]))) continue;
        const t = gs[c] + (di && dj ? 1.414 : 1); if (t < gs[n]) { gs[n] = t; came[n] = c; open.push(n); }
      }
    }
    const out = []; for (let n = g; n !== -1 && n !== s; n = came[n]) out.unshift([(n % GW) * C + 2, ((n / GW) | 0) * C + 2]);
    if (!blocked(x1, y1)) out.push([x1, y1]);
    return out;
  }
  const me = { x: 192, y: 100, dir: 'down', path: [], dist: 0, then: null };
  const folk = [0, 1].map((i) => ({ look: { ...makeLookRich(), kid: Math.random() < 0.5, ...(i ? { bag: 'shoppingBag', bagColor: '#f07ab0' } : { neck: 'necklace', neckColor: '#4f8ff0' }) }, x: i ? 300 : 60, y: i ? 150 : 150, dir: 'up', path: [], dist: 0, t: 1 + i * 2 }));
  const BROWSE = [[43, 136, 'up'], [113, 136, 'up'], [55, 194, 'up'], [330, 100, 'up'], [334, 168, 'up'], [127, 176, 'down'], [257, 176, 'down']];
  let bubble = null, hover = null, t = 0;
  const say = (s, x, y) => { s = safeTxt(s); bubble = { s, x, y, until: t + Math.max(2.6, s.length * 0.08) }; };
  const walkTo = (x, y, then) => { me.path = path(me.x, me.y, x, y); me.then = then || null; if (!me.path.length && then) { me.then = null; then(); } };
  const step = (o, dt, sp) => {
    if (!o.path.length) return false;
    const [tx, ty] = o.path[0], dx = tx - o.x, dy = ty - o.y, d = Math.hypot(dx, dy), s = sp * dt;
    if (Math.abs(dx) > Math.abs(dy) + 0.5) o.dir = dx > 0 ? 'right' : 'left'; else if (d > 0.5) o.dir = dy > 0 ? 'down' : 'up';
    if (d <= s) { o.x = tx; o.y = ty; o.path.shift(); o.dist += d; } else { o.x += dx / d * s; o.y += dy / d * s; o.dist += s; }
    return !o.path.length;
  };
  // gnistor: på montrarna, kronorna, skylten och mattan
  const SPARK = []; for (let i = 0; i < 34; i++) { const z = pickOf([[12, 100, 62, 10], [82, 100, 62, 10], [24, 156, 62, 10], [128, 13, 128, 16], [100, 14, 24, 10], [260, 14, 24, 10], [233, 37, 142, 46], [14, 36, 120, 20]]); SPARK.push({ x: z[0] + Math.random() * z[2], y: z[1] + Math.random() * z[3], ph: Math.random() * 6, sp: 1.5 + Math.random() * 2 }); }

  // ---------- provfiguren: "Du nu ➜ Med …" som går att vrida, som i klädaffärens köpdialog (klader/buy.js) ----------
  const wearing = (it) => isWorn(it, A.avatar.look);
  const setLook = (look) => { A.avatar = saveAvatar({ ...A.avatar, look }); };   // (sparas – som i klädaffären)
  const DIRS = ['down', 'left', 'up', 'right'], DIR_NAMES = [$t('Framifrån'), $t('Från sidan'), $t('Bakifrån'), $t('Från sidan')];
  const figScale = () => (window.innerHeight >= 620 && window.innerWidth >= 560 ? 5 : window.innerHeight < 480 ? 3 : 4);
  function bestDir(now, withIt) {   // åt vilket håll syns skillnaden mest (en ryggsäck syns bäst bakifrån)
    const px = (look, dir) => { const c = document.createElement('canvas'); c.width = 28; c.height = 44; const x = c.getContext('2d', { willReadFrequently: true }); drawPerson(x, 14, 41, look, dir, 0); return x.getImageData(0, 0, 28, 44).data; };
    const score = DIRS.map((dir, i) => { const a = px(now, dir), b = px(withIt, dir); let n = 0; for (let k = 0; k < a.length; k += 4) if (a[k] !== b[k] || a[k + 1] !== b[k + 1] || a[k + 2] !== b[k + 2] || a[k + 3] !== b[k + 3]) n++; return n * (i === 0 ? 1.6 : 1); });
    return score.indexOf(Math.max(...score));
  }
  const stageHtml = (what, single = false) => `<div class="bl-try"><div class="bl-stage">${single ? '' : `<div class="bl-fig" data-fig="now"><i></i><small>${esc($t('Du nu'))}</small></div><div class="bl-arrow">➜</div>`}<div class="bl-fig" data-fig="new"><i></i><small>${esc(what)}</small></div></div>
    <div class="bl-turn"><button type="button" class="btn btn-small" data-turn="-1" aria-label="${esc($t('Vrid åt vänster'))}">⟲</button><b class="bl-view" data-view></b><button type="button" class="btn btn-small" data-turn="1" aria-label="${esc($t('Vrid åt höger'))}">⟳</button></div></div>`;
  function stage(dlg, withLook, dr) {   // dr = { i, user } – riktningen följer med när dialogen ritas om
    const render = () => {
      const dir = DIRS[dr.i];
      dlg.querySelector('[data-fig="now"] i')?.replaceChildren(figure(A.avatar.look, dir, 2));
      dlg.querySelector('[data-fig="new"] i')?.replaceChildren(figure(withLook(), dir, figScale()));
      dlg.querySelector('[data-view]').textContent = DIR_NAMES[dr.i];
    };
    dlg.querySelectorAll('[data-turn]').forEach((b) => (b.onclick = () => { dr.i = (dr.i + +b.dataset.turn + 4) % 4; dr.user = true; play('click'); render(); }));
    render();
  }

  // ---------- montrarna och väskväggen: spelets egna smycken och väskor; ett klick provar på figuren ----------
  // korten: smycken med huvudet och överkroppen inzoomade, väskor med hela figuren från sidan
  const preview = (look, mode = 'neck') => {
    const c = document.createElement('canvas'); c.width = 30; c.height = 44; const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
    drawPerson(g, 15, 42, look, mode === 'bag' ? 'right' : 'down', 0);
    let out;
    if (mode === 'neck') {
      const d = g.getImageData(0, 0, 30, 44).data; let top = 0; while (top < 43 && ![...Array(30).keys()].some((x) => d[(top * 30 + x) * 4 + 3] > 0)) top++;
      const o = document.createElement('canvas'); o.width = 24; o.height = 24; const og = o.getContext('2d'); og.imageSmoothingEnabled = false;
      og.drawImage(c, 3, Math.max(0, top - 1), 24, 24, 0, 0, 24, 24); out = big(o, 4);
    } else {
      const o = document.createElement('canvas'); o.width = 24; o.height = 36; const og = o.getContext('2d'); og.imageSmoothingEnabled = false;
      og.drawImage(c, 3, 8, 24, 36, 0, 0, 24, 36); out = big(o, 3);
    }
    out.style.width = out.width + 'px'; out.style.height = out.height + 'px'; return out;
  };
  const nameOf = (it) => esc(it.name).replace(/­/g, '&shy;');
  function catalog(cat) {
    const D = CATS[cat], items = D.ids.map(itemById).filter(Boolean);
    const card = (it, i) => { const own = G.ownsWardrobe(it.id), on = own && wearing(it); return `<button type="button" class="bl-card${on ? ' on' : own ? ' own' : ''}" data-i="${i}"><span class="bl-pre"></span><b>${nameOf(it)}</b><span class="bl-tag">${on ? esc($t('✓ PÅ DIG')) : own ? esc($t('✓ DIN')) : fmt(G.clothesPrice(it))}</span></button>`; };
    const dlg = openModal(D.title, `<p class="bl-sp">${$t`Du har <b>${fmt(G.money)}</b>. Klicka på något så provar du det på dig – vrid figuren och välj färg innan du köper.`}</p><div class="bl-grid">${items.map(card).join('')}</div>`, [{ label: $t('Stäng'), onClick: closeModal }]);
    dlg.classList.add('dlg-furn');
    dlg.querySelectorAll('.bl-card').forEach((b) => {
      const it = items[+b.dataset.i];
      b.querySelector('.bl-pre').append(preview(lookForItem(it, A.avatar.look, { colors: !wearing(it) }), it.slot === 'bag' ? 'bag' : 'neck'));
      b.onclick = () => { play('click'); openBuy(A, it, { where: `BLING BLING · ${D.title.replace(/^\S+\s/, '')}`, back: () => catalog(cat), onBought: () => say(pickOf([$t('SNYGGT! DET PASSAR DIG.'), $t('VILKET FYND!'), $t('DU BLEV JÄTTEFIN!')]), keeper.x, keeper.y - 40) }); };
    });
  }
  // ---------- ateljén ----------
  const DEF = { neck: { kedja: 'guld', hange: 'hjarta', sten: 'rosa', parlor: '2' }, bag: { modell: 'hand', farg: 'rosa', monster: 'prickar', berlock: 'pompom' } };
  const SEL = { neck: { ...DEF.neck }, bag: { ...DEF.bag } };
  const DIRI = { neck: { i: 0, user: false }, bag: { i: 0, user: false } };
  let anim = 0;
  // en design får sitt namn på spelarens språk när den visas (sparfilen har bara delarnas id)
  const designNamn = (d) => {
    const sel = d.sel || {};
    if (d.kind === 'neck') { const k = optOf(NECK.kedja, sel.kedja)?.[1] || '', h = sel.hange && sel.hange !== 'inget' ? optOf(NECK.hange, sel.hange)?.[1] : ''; return h ? `${k} · ${h}` : k; }
    return `${optOf(BAG.modell, sel.modell)?.[1] || ''} · ${optOf(BAG.farg, sel.farg)?.[1] || ''}`;
  };
  function designer(kind) {
    const GR = kind === 'neck' ? NECK : BAG, sel = SEL[kind], initial = String(A.avatar.name || 'A').trim()[0] || 'A';
    const total = priceOf(GR, sel), m = kind === 'neck' ? neckLook(sel) : bagLook(sel), withLook = () => ({ ...A.avatar.look, ...m.look });
    const dr = DIRI[kind]; if (!dr.user) dr.i = bestDir(A.avatar.look, withLook());   // tills man vrider själv: där väskan syns bäst
    const groups = Object.entries(GR).map(([k, g]) => `<div class="bl-grp"><div class="bl-lbl">${esc(g.label)}</div><div class="bl-opts">${g.opts.map(([id, name, pr]) => {
      const dot = k === 'sten' && id !== 'ingen' ? `<i style="background:${GEMS[id][0]}"></i>` : k === 'farg' ? `<i style="background:${BAGC[id]}"></i>` : '';
      return `<button type="button" class="btn btn-small${sel[k] === id ? ' btn-gold' : ''}" data-k="${k}" data-v="${id}">${dot}${esc(name)}<small>${pr ? fmt(pr) : esc($t('gratis'))}</small></button>`;
    }).join('')}</div></div>`).join('');
    const mine = store.list().filter((d) => d.kind === kind), key = JSON.stringify(sel), same = mine.find((d) => JSON.stringify(d.sel) === key);
    const dlg = openModal(kind === 'neck' ? $t('📿 Designa ditt halsband') : $t('👜 Designa din väska'), `<div class="bl-design">${stageHtml(kind === 'neck' ? $t('Med halsbandet') : $t('Med väskan'))}
      <div class="bl-show"><div class="bl-canvas"></div>
      <div class="bl-sum"><span>${esc($t('Kostar'))}</span><b>${fmt(total)}</b><span class="bl-sp">${esc($t`Du har ${fmt(G.money)}`)}</span></div>
      <ul class="bl-list">${Object.entries(GR).map(([k, g]) => { const o = optOf(g, sel[k]); return `<li><span>${esc(g.label)}: ${esc(o[1])}</span><b>${o[2] ? fmt(o[2]) : '–'}</b></li>`; }).join('')}</ul></div>
      <div class="bl-pick">${groups}
      ${mine.length ? `<div class="bl-lbl">${esc(kind === 'neck' ? $t('Dina egna halsband') : $t('Dina egna väskor'))}</div><div class="bl-mine">${mine.map((d, i) => `<button type="button" class="btn btn-small" data-mine="${i}">${kind === 'neck' ? '📿' : '👜'} ${esc(designNamn(d))}</button>`).join('')}</div>` : ''}</div></div>`,
      [same ? { label: $t('Ta på – den är redan din'), cls: 'btn-go', onClick: () => { setLook({ ...A.avatar.look, ...same.look }); cancelAnimationFrame(anim); closeModal(); play('ok'); toast($t`✨ Du har på dig ${designNamn(same)}.`, 'good'); } }
        : { label: G.money >= total ? $t`Köp för ${fmt(total)}` : $t`Du behöver ${fmt(total - G.money)} till`, cls: 'btn-go', disabled: G.money < total, onClick: () => buyDesign(kind, total) },
       { label: $t('Stäng'), onClick: () => { cancelAnimationFrame(anim); closeModal(); } }]);
    dlg.classList.add('bl-wide');
    stage(dlg, withLook, dr);
    const host = dlg.querySelector('.bl-canvas'), cv = document.createElement('canvas'); cv.width = 96 * 3; cv.height = 72 * 3; host.append(cv);
    const art = kind === 'neck' ? drawNecklace(sel, initial) : drawBag(sel), g = cv.getContext('2d'); g.imageSmoothingEnabled = false;
    const tw = (now) => { g.drawImage(art, 0, 0, cv.width, cv.height); for (let i = 0; i < 6; i++) { const ph = (now / 600 + i * 1.7) % 4; if (ph > 1) continue; const x = (hash(i, Math.floor(now / 2400 + i), 11) * 80 + 8) * 3, y = (hash(i, Math.floor(now / 2400 + i), 12) * 50 + 8) * 3, s = Math.sin(ph * Math.PI) * 6; g.fillStyle = 'rgba(255,255,255,0.9)'; g.fillRect(x - s, y - 1, s * 2, 3); g.fillRect(x - 1, y - s, 3, s * 2); } if (dlg.isConnected) anim = requestAnimationFrame(tw); };
    cancelAnimationFrame(anim); anim = requestAnimationFrame(tw);
    dlg.querySelectorAll('[data-k]').forEach((b) => (b.onclick = () => { sel[b.dataset.k] = b.dataset.v; play('click'); designer(kind); }));
    dlg.querySelectorAll('[data-mine]').forEach((b) => (b.onclick = () => { const d = mine[+b.dataset.mine]; Object.assign(sel, d.sel); play('click'); designer(kind); }));   // tillbaka till en egen design (Ta på-knappen kommer fram)
  }
  function buyDesign(kind, total) {
    if (G.money < total) return;
    const sel = SEL[kind], m = kind === 'neck' ? neckLook(sel) : bagLook(sel);
    G.money -= total;
    if (!G.ownsWardrobe(m.id)) G.wardrobe.push(m.id);   // modellen räknas som din, så att figurskaparen låter den sitta kvar
    G.glad?.(4, '', 'nytt', 10);                         // något nytt gör en glad (som kläderna, högst +10 om dagen)
    const d = { kind, sel: { ...sel }, look: m.look, price: total };
    store.add(d);                                        // (sparar spelet)
    setLook({ ...A.avatar.look, ...m.look });
    cancelAnimationFrame(anim); closeModal(); play('buy');
    toast(kind === 'neck' ? $t`✨ Ditt eget halsband är klart: ${designNamn(d)}!` : $t`✨ Din egen väska är klar: ${designNamn(d)}!`, 'good');
    say(kind === 'neck' ? $t('VILKET FINT HALSBAND! DET HAR DU GJORT SJÄLV!') : $t('SNYGG VÄSKA! DEN ÄR HELT DIN EGEN!'), keeper.x, keeper.y - 40);
  }
  // ---------- spegeln: allt man äger här och sina egna designer, på den vridbara figuren ----------
  const MIR = { i: 0, user: true };
  function mirror() {
    const owned = Object.values(CATS).flatMap((c) => c.ids).map(itemById).filter((it) => it && G.ownsWardrobe(it.id));
    const designs = store.list();
    const dlg = openModal($t('🪞 Spegeln'), `<div class="bl-mirror">${stageHtml(String(A.avatar.name || $t('Du')), true)}<div class="bl-mir-r"><p class="bl-sp">${esc($t('Ta på och av det du har köpt här och dina egna designer – figuren visar hur du ser ut.'))}</p>
      ${owned.length ? `<div class="bl-lbl">${esc($t('Köpt i butiken'))}</div><div class="bl-mine">${owned.map((it) => `<button type="button" class="btn btn-small${wearing(it) ? ' btn-gold' : ''}" data-own="${it.id}">${wearing(it) ? '✓ ' : ''}${esc(it.name.replace(/­/g, ''))}</button>`).join('')}</div>` : `<p class="bl-sp">${esc($t('Du har inte köpt något här än. Titta i glasmontrarna och på väskväggen!'))}</p>`}
      ${designs.length ? `<div class="bl-lbl">${esc($t('Dina egna designer'))}</div><div class="bl-mine">${designs.map((d, i) => `<button type="button" class="btn btn-small" data-des="${i}">${d.kind === 'neck' ? '📿' : '👜'} ${esc(designNamn(d))}</button>`).join('')}</div>` : ''}</div></div>`,
      [{ label: $t('Klar'), cls: 'btn-go', onClick: closeModal }]);
    stage(dlg, () => A.avatar.look, MIR);
    dlg.querySelectorAll('[data-own]').forEach((b) => (b.onclick = () => { const it = itemById(b.dataset.own); play('click'); setLook(wearing(it) ? lookWithoutSlot(it.slot, A.avatar.look) : lookForItem(it, A.avatar.look, { colors: true })); mirror(); }));
    dlg.querySelectorAll('[data-des]').forEach((b) => (b.onclick = () => { play('click'); setLook({ ...A.avatar.look, ...designs[+b.dataset.des].look }); mirror(); }));
  }

  const spotAt = (x, y) => Object.entries(SP).find(([, s]) => x >= s.r[0] && x <= s.r[2] && y >= s.r[1] && y <= s.r[3]);
  return {
    get worldX() { return me.x; }, get worldY() { return me.y; },   // (telefonen: bilden följer figuren i höjdled – ateljébordet står längst ner)
    enter() { me.x = 192; me.y = 100; me.dir = 'down'; me.path = []; say($t('VÄLKOMMEN TILL BLING BLING!'), keeper.x, keeper.y - 40); },
    exit() { cancelAnimationFrame(anim); },
    update(dt) {
      t += dt;
      if (step(me, dt, 58) && me.then) { const f = me.then; me.then = null; f(); }
      for (const n of folk) {
        if (n.path.length) { step(n, dt, 30); continue; }
        n.t -= dt;
        if (n.t <= 0) { const [x, y, d] = pickOf(BROWSE); n.path = path(n.x, n.y, x, y + (Math.random() * 6 - 3)); n.face = d; n.t = 3 + Math.random() * 5; }
        else if (n.face) n.dir = n.face;
      }
    },
    draw(ctx) {
      ctx.setTransform(A.pxs, 0, 0, A.pxs, 0, 0); ctx.imageSmoothingEnabled = false;
      ctx.drawImage(bg, 0, 0);
      // kristallkronorna i taket
      for (const cx of [112, 272]) {
        ctx.fillStyle = '#b9862a'; ctx.fillRect(cx, 7, 1, 8); ctx.fillStyle = '#e8b84a'; ctx.fillRect(cx - 9, 15, 19, 2); ctx.fillRect(cx - 6, 17, 13, 2);
        for (let k = -8; k <= 8; k += 4) { const on = Math.sin(t * 3 + k + cx) > 0.3; ctx.fillStyle = on ? '#ffffff' : '#bfe6f6'; ctx.fillRect(cx + k, 18, 1, 3 + (Math.abs(k) % 8 ? 1 : 2)); ctx.fillStyle = '#fff6c0'; ctx.fillRect(cx + k, 13, 1, 2); }
        ctx.fillStyle = 'rgba(255,246,208,0.12)'; ctx.fillRect(cx - 14, 20, 29, 8);
      }
      const list = F.map((f) => ({ fy: f.fy, draw: () => ctx.drawImage(f.img, f.x, f.fy - f.h) }));
      list.push({ fy: keeper.y, draw: () => drawPerson(ctx, keeper.x, keeper.y, keeper.look, Math.sin(t * 0.5) > 0.8 ? 'left' : 'down', Math.sin(t * 2) > 0.93 ? 4 : 0) });
      for (const n of folk) list.push({ fy: n.y, draw: () => drawPerson(ctx, Math.round(n.x), Math.round(n.y), n.look, n.dir, n.path.length ? WALK[Math.floor(n.dist / 7.3) % 4] : 0) });
      list.push({ fy: me.y + 0.01, draw: () => drawPerson(ctx, Math.round(me.x), Math.round(me.y), A.avatar.look, me.dir, me.path.length ? WALK[Math.floor(me.dist / 7.3) % 4] : 0) });
      list.sort((a, b) => a.fy - b.fy); for (const d of list) d.draw();
      // gnistrorna
      for (const s of SPARK) { const v = Math.sin(t * s.sp + s.ph); if (v < 0.75) continue; const r = v > 0.93 ? 2 : 1; ctx.fillStyle = 'rgba(255,255,255,0.95)'; ctx.fillRect(Math.round(s.x) - r, Math.round(s.y), r * 2 + 1, 1); ctx.fillRect(Math.round(s.x), Math.round(s.y) - r, 1, r * 2 + 1); }
      // ateljébordens stjärnor blinkar så att man hittar dit
      for (const k of ['neck', 'bag']) { const sp = SP[k], x = Math.round((sp.r[0] + sp.r[2]) / 2), on = Math.sin(t * 3 + x) > 0.2; ctx.fillStyle = on ? '#fff0b0' : '#e8b84a'; ctx.fillRect(x, 175 - (on ? 2 : 1), 1, on ? 5 : 3); ctx.fillRect(x - (on ? 2 : 1), 175, on ? 5 : 3, 1); }
      // pratbubblan och hovringsetiketten
      if (bubble && t < bubble.until) { const w = textW(SMALL, bubble.s) + 8, x = Math.max(2, Math.min(W - w - 2, Math.round(bubble.x - w / 2))), y = Math.max(2, bubble.y); ctx.fillStyle = '#17151a'; ctx.fillRect(x - 1, y - 1, w + 2, 11); ctx.fillStyle = '#ffffff'; ctx.fillRect(x, y, w, 9); ctx.fillRect(Math.round(bubble.x) - 1, y + 9, 3, 2); ctxText(ctx, SMALL, bubble.s, x + 4, y + 2, '#17151a'); }
      if (hover) { const w = textW(SMALL, hover.label) + 6, x = Math.max(2, Math.min(W - w - 2, Math.round(hover.x - w / 2))), y = Math.max(2, Math.round(hover.y) - 14); ctx.fillStyle = '#17151a'; ctx.fillRect(x, y, w, 9); ctxText(ctx, SMALL, hover.label, x + 3, y + 2, '#ffd23f'); }
    },
    down(x, y) {
      const s = spotAt(x, y);
      if (s) { const [, sp] = s; walkTo(sp.go[0], sp.go[1], () => { me.dir = sp.face || 'up'; sp.act(); }); return; }
      if (y > WALL + 4) walkTo(x, y);
    },
    move(x, y) { const s = spotAt(x, y); hover = s ? { label: safeTxt(s[1].label), x, y } : null; },
    up() {},
    key(k) { if (k === 'Escape') me.path = []; },
    _debug: { spots: () => Object.fromEntries(Object.entries(SP).map(([k, s]) => [k, s.r])), me: () => ({ x: me.x, y: me.y }) },
  };
}

// närbilderna fristående (proven ritar ett ark med alla hängen och väskor); fasaden i staden: js/city/buildings-linne.js
export const BLING_PREVIEW = { drawNecklace, drawBag };
