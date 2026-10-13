// 🍦🍭🍿🍔 MATSTÅNDEN på Pixelberg (ramen och verktygen: js/pixelberg/kiosk.js). Carl 2026-10-13: "många stånd glass,
// spunnet socker, popcorn, hamburgare, ännu mer detaljer på allting". Varje stånd målar sin vägg, sin inredning, det
// som står på disken och sin takprydnad – i samma stil som glasståndet i parken.
import { Pix, SMALL, BIG, text, textW, mix, mul, hash, bayer } from '../core/floor-pix.js';
import { $t } from '../core/i18n.js';
import { tone, klot, balja, miniGlass, CREAM, WOOD, STEEL, IRON, GOLD, VAF, STRO, KULOR, ROSA, MINT, ROD, BLA, GUL, TURK, LILA, GRON } from './kiosk.js';

const PASTELL_R = [0xb0507a, 0xd8789e, 0xf2a6c4, 0xfcd0e2, 0xfff0f6];
const PASTELL_B = [0x40709e, 0x6494c8, 0x96bcea, 0xc6dcfa, 0xeef4ff];
const TERRA = [0x5a2a14, 0x8a4220, 0xb85e2e, 0xd8804a, 0xeeaa78];
const css = (c) => '#' + (c & 0xffffff).toString(16).padStart(6, '0');

// gemensamt vid ståndets fot: en krittavla (A-ställning) och en blomkruka
function krittavla(P, x0, y1, rader, rubrik) {
  for (let i = 0; i < 16; i++) { P.px(x0 + Math.round(i * 0.18), y1 - i, WOOD[2]); P.px(x0 + 10 - Math.round(i * 0.18), y1 - i, WOOD[1]); }   // benen
  for (let y = y1 - 17; y <= y1 - 4; y++) for (let x = x0; x <= x0 + 10; x++) {
    const ram = x === x0 || x === x0 + 10 || y === y1 - 17 || y === y1 - 4;
    P.px(x, y, ram ? tone(WOOD, x === x0 || y === y1 - 17 ? 0.85 : 0.45, x, y) : mix(0x1e3a2c, 0x2a4a38, hash(x, y, 91) * 0.6));
  }
  if (rubrik) for (let i = 0; i < 7; i++) P.px(x0 + 2 + i, y1 - 15, 0xf4f1ea, 0.85);
  rader.forEach((c, j) => { const y = y1 - 13 + j * 2; P.px(x0 + 2, y, c); for (let i = 0; i < 4; i++) P.px(x0 + 4 + i, y, 0xd8d8d0, 0.7); P.px(x0 + 9, y, 0xffe060, 0.9); });
}
function blomkruka(P, cx, y1, blom) {
  for (let y = y1 - 7; y <= y1; y++) { const hw = 4 - Math.floor((y - (y1 - 7)) / 3); for (let x = cx - hw; x <= cx + hw; x++) P.px(x, y, tone(TERRA, 0.8 - (x - cx + hw) / (hw * 2 + 1) * 0.5 + (y === y1 - 7 ? 0.15 : 0), x, y)); }
  P.hl(cx - 5, y1 - 8, 11, TERRA[4]); P.hl(cx - 5, y1 - 7, 11, TERRA[2]);
  for (let k = 0; k < 9; k++) { const lx = cx - 5 + Math.floor(hash(k, cx, 92) * 11), ly = y1 - 10 - Math.floor(hash(k, 3, 92) * 5); P.px(lx, ly, GRON[2 + (k & 1)]); P.px(lx, ly + 1, GRON[1]); }
  for (let k = 0; k < 6; k++) { const bx = cx - 4 + Math.floor(hash(k, cx, 93) * 9), by = y1 - 12 - Math.floor(hash(k, 7, 93) * 5); P.px(bx, by, blom[2]); P.px(bx + 1, by, blom[1]); P.px(bx, by + 1, blom[1]); P.px(bx + 1, by + 1, blom[0]); P.px(bx, by - 1, blom[3]); }
}

// ======================= 🍦 GLASSTÅNDET =======================
export const GLASS = {
  id: 'glass', W: 96, namn: $t('GLASS'), meny: 'glass',
  tema: { pel: [MINT, CREAM], mark: [ROSA, CREAM], skyltBg: ROSA, skyltFg: 0xfff6e8, skyltKant: 0x5a1030, disk: CREAM, skenFarg: 'rgba(255,150,200,.32)' },
  expedit: { dx: -18 },
  vagg(x, y, ao, natt) {
    const row = Math.floor((y + 60) / 3), off = (row & 1) ? 2 : 0;
    const fog = (x + 64 + off) % 4 === 3 || (y + 60) % 3 === 2, band = y >= -31 && y <= -29, nedre = y > -29;
    let c = band ? (fog ? 0x4a8e7a : 0x7ac4ae) : nedre ? (fog ? 0x5ea08c : 0x96d6c0) : (fog ? 0xc8c4b8 : 0xf4f0e6);
    if (!fog && hash((x + off) >> 2, row, 81) > 0.82) c = mul(c, 0.95);
    return mul(c, ao * (natt ? 0.9 : 1));
  },
  inne(P, xl, xr) {
    // affischen NY SMAK med en strut
    P.box(-41, -59, 14, 12, ROSA[2]); P.rect(-40, -58, 12, 10, 0xfffaf0); text(P, SMALL, $t('NY'), -39, -57, ROSA[1]); miniGlass(P, -31, -49, KULOR[6], false);
    // hyllan: strutar i pappershylsor och strösselburkar
    for (let x = -41; x <= -12; x++) { P.px(x, -44, tone(WOOD, 0.85, x, -44)); P.px(x, -43, tone(WOOD, 0.45, x, -43)); } P.hl(-41, -42, 30, 0x5a5448, 0.4);
    for (const x of [-40, -36]) { P.rect(x, -49, 3, 5, ROSA[2]); P.px(x, -49, ROSA[4]); P.vl(x + 2, -48, 4, ROSA[1]); P.px(x + 1, -47, 0xffffff); P.hl(x, -50, 3, VAF[3]); P.px(x + 1, -51, VAF[2]); }
    for (let i = 0; i < 4; i++) { const x = -31 + i * 5, f = STRO[i]; P.rect(x, -49, 4, 5, 0xc8d4d8); P.rect(x, -48, 4, 3, f); P.hl(x, -50, 4, 0x6a7078); P.px(x, -49, 0xf0f8fa); P.px(x + 3, -46, mul(f, 0.7)); P.px(x + 1, -47, STRO[(i + 2) % 5]); }
    P.hl(-40, -38, 16, 0x8a9098); for (const x of [-38, -33, -28]) { P.vl(x, -37, 2, 0x9aa4ac); P.rect(x - 1, -35, 3, 2, 0xc8d0d8); P.px(x - 1, -35, 0xffffff); }   // skoporna
    // krittavlan med menyn
    for (let y = -58; y <= -36; y++) for (let x = -6; x <= 22; x++) {
      const ram = x === -6 || x === 22 || y === -58 || y === -36;
      P.px(x, y, ram ? tone(WOOD, x === -6 || y === -58 ? 0.85 : 0.4, x, y) : mix(0x1c362a, 0x284a38, hash(x, y, 82) * 0.7));
    }
    text(P, SMALL, $t('MENY'), 8 - (textW(SMALL, $t('MENY')) >> 1), -56, 0xf4f1ea);
    ['25', '25', '30', '40'].forEach((pr, j) => { const y = -49 + j * 3, k = [KULOR[0], KULOR[3], KULOR[1], KULOR[2]][j]; P.rect(-4, y, 2, 2, k[2]); P.px(-4, y, k[4]); for (let i = 0; i < 9; i += 2) P.px(0 + i, y + 1, 0xd8d8d0, 0.7); });
    for (let j = 0; j < 4; j++) { const y = -49 + j * 3; P.rect(15, y, 5, 2, 0xffe060, 0.25); P.px(16, y, 0xffe060); P.px(18, y, 0xffe060); P.px(16, y + 1, 0xffe060); P.px(18, y + 1, 0xffe060); }
    // mjukglassmaskinen
    for (let y = -57; y <= -19; y++) for (let x = 27; x <= 39; x++) P.px(x, y, tone(STEEL, 0.86 - (x - 27) / 12 * 0.55 + (y > -23 ? -0.2 : 0) + (y === -57 ? 0.12 : 0), x, y));
    P.hl(27, -52, 13, 0x6a7078); P.px(29, -55, 0xffffff); P.px(35, -55, 0xf4f8fa);
    P.rect(28, -50, 11, 4, 0x2a2e34); P.px(30, -48, 0x6fdc4c); P.px(32, -48, 0xffd23f); P.px(34, -48, 0x5ab4ff); P.px(36, -49, 0xff6a6a);
    for (const [tx, tc] of [[29, ROSA[2]], [35, 0xf2ecd8]]) { P.rect(tx, -44, 3, 2, tc); P.vl(tx + 1, -42, 3, 0x4a4e54); P.rect(tx, -39, 3, 2, 0x3a3e44); P.px(tx + 1, -37, 0x1a1c20); }
    P.hl(27, -31, 13, 0x33373c); P.hl(28, -30, 11, 0x8a949c);
    for (let x = 28; x <= 38; x += 2) P.px(x, -27, 0x2a2e34);
  },
  diskDeko(x, y) {
    if (y === -11 || y === -7) return ROSA[2];
    if (y >= -10 && y <= -8) { const d = (Math.abs(((x + 200) % 6) - 3) + (y + 10)) % 3 === 0; return d ? MINT[2] : MINT[3]; }
    return null;
  },
  framfor(P, xl, xr) {
    // glasdisken med tolv baljor (två rader)
    P.hl(-38, -27, 31, 0xe4ecf0); P.px(-38, -27, 0xffffff);
    for (let y = -26; y <= -16; y++) for (let x = -38; x <= -8; x++) P.px(x, y, y === -21 ? 0x9aa4ac : 0x5a646c);
    for (let i = 0; i < 6; i++) { balja(P, -37 + i * 5, -26, 4, 4, KULOR[(i + 2) % 8], 3 + i); balja(P, -37 + i * 5, -20, 4, 4, KULOR[i % 8], 9 + i); }
    for (let y = -26; y <= -16; y++) for (let x = -37; x <= -9; x++) { if ((x - y * 2) % 13 === 0) P.px(x, y, 0xffffff, 0.45); else if ((x - y * 2 + 1) % 13 === 0) P.px(x, y, 0xe8f4f8, 0.2); }
    P.vl(-38, -26, 11, 0xc8d0d8); P.vl(-8, -26, 11, 0x7a848c);
    // struthållaren, dricksburken och servetterna
    for (let x = 0; x <= 12; x++) for (let y = -19; y <= -16; y++) P.px(x, y, tone(STEEL, 0.78 - x * 0.03 - (y + 19) * 0.08, x, y));
    for (const x of [2, 6, 10]) for (let k = 0; k < 3; k++) { const yy = -21 - k * 2; P.px(x - 1, yy, VAF[3]); P.px(x, yy, VAF[2]); P.px(x + 1, yy, VAF[0]); P.px(x - 1, yy + 1, VAF[2]); P.px(x, yy + 1, VAF[1]); P.px(x + 1, yy + 1, VAF[0]); }
    P.rect(16, -20, 4, 5, 0xd8eef4, 0.7); P.box(16, -21, 4, 6, 0xb0c8d0); for (let k = 0; k < 4; k++) P.px(17 + (k & 1), -18 + (k >> 1), GOLD[3 - (k & 1)]); P.px(17, -22, ROSA[2]);
    P.rect(23, -20, 6, 5, 0xc8d0d8); P.px(23, -20, 0xf0f4f8); P.vl(28, -19, 4, 0x7a848c); P.hl(24, -21, 4, 0xffffff); P.px(25, -22, 0xffffff);
    miniGlass(P, 34, -16, KULOR[4], false, KULOR[1]); miniGlass(P, 38, -16, KULOR[0], true);
    // dekalerna på diskens front
    miniGlass(P, -26, -2, KULOR[0], false, KULOR[1]); miniGlass(P, 0, -2, KULOR[2], true); miniGlass(P, 26, -2, KULOR[4], false);
    krittavla(P, xr + 5, 0, [ROSA[2], KULOR[3][2], KULOR[1][2], GRON[3]], true);
    blomkruka(P, xl - 9, 0, ROSA);
  },
  prydnad(P) {
    // jättestruten: våffelmönster, ljus till vänster
    for (let yy = 0; yy <= 18; yy++) {
      const y = -114 + yy, hw = Math.round(9 - yy * 9 / 18);
      for (let x = -hw; x <= hw; x++) { const g = ((x - y) % 4 === 0) || ((x + y) % 4 === 0); P.px(x, y, mul(g ? VAF[1] : VAF[2], 1.1 - (x + hw) / (2 * hw + 1) * 0.4)); }
    }
    P.hl(-10, -115, 21, VAF[3]); P.hl(-10, -116, 21, mix(VAF[3], 0xffffff, 0.3));
    klot(P, 0, -121, 11, 7, KULOR[0]);
    for (const [dx, l] of [[-7, 3], [-3, 2], [4, 4], [8, 2]]) for (let k = 0; k < l; k++) P.px(dx, -115 + k, tone(KULOR[0], 0.55 - k * 0.1, dx, k));   // det rinner
    klot(P, 1, -130, 9, 6, KULOR[1]);
    for (let k = 0; k < 22; k++) { const a = hash(k, 1, 83) * Math.PI * 2, r = hash(k, 2, 83), x = Math.round(Math.cos(a) * r * 9), y = Math.round(-125 + Math.sin(a) * r * 9); P.px(x, y, STRO[k % 5]); }
    klot(P, 3, -138, 2.2, 2.2, ROD); P.px(2, -139, 0xffffff); P.vl(4, -142, 3, GRON[2]);
  },
};

// ======================= 🍭 SOCKERVADDEN =======================
// randig pastelltapet, påsar med sockervadd på en spikmatta, sockervaddsmaskinen mitt på disken (vadden snurrar i
// live), en burk pinnar och sockerburkar; på taket ett jättemoln av sockervadd på en pappersstrut
const PASAR = [PASTELL_R, PASTELL_B, LILA, PASTELL_R, PASTELL_B];
function pase(P, x, y, pal) {   // en påse 7 × 10: kortet överst, vadden i plasten
  P.rect(x, y, 7, 2, 0xfffaf0); P.hl(x, y + 1, 7, pal[2]); P.px(x + 3, y - 1, IRON[3]);
  for (let j = 0; j < 8; j++) for (let i = 0; i < 7; i++) {
    const dx = (i - 3) / 3.6, dy = (j - 4) / 4.4, d = dx * dx + dy * dy;
    if (d > 1.1) continue;
    const ul = hash(x + i, y + j, 94) > 0.5 ? 0.08 : 0;
    P.px(x + i, y + 2 + j, tone(pal, 0.75 - dx * 0.2 - dy * 0.25 + ul, x + i, y + j));
  }
  P.px(x + 1, y + 3, 0xffffff, 0.8); P.vl(x + 6, y + 3, 5, 0xffffff, 0.25);
}
export const SOCKERVADD = {
  id: 'sockervadd', W: 96, namn: $t('SOCKERVADD'), meny: 'sockervadd',
  tema: { pel: [PASTELL_R, CREAM], mark: [PASTELL_B, CREAM], skyltBg: LILA, skyltFg: 0xfff2fc, skyltKant: 0x24103c, disk: PASTELL_R, skenFarg: 'rgba(220,150,255,.3)' },
  expedit: { dx: 12 },
  vagg(x, y, ao, natt) {
    const rand = Math.floor((x + 64) / 5) % 2 === 0;
    let c = rand ? 0xfce4ee : 0xfff8fb;
    if ((x + y * 3) % 11 === 0 && !rand) c = 0xd8c4f0;   // små prickar
    if (y > -27) c = mix(PASTELL_B[3], PASTELL_B[2], (y + 27) / 12);   // nedre panelen
    if (y === -27) c = PASTELL_B[1];
    return mul(c, ao * (natt ? 0.9 : 1));
  },
  inne(P) {
    for (let y = -58; y <= -33; y++) for (let x = -41; x <= -6; x++) P.px(x, y, ((x + y) & 1) && (x % 3 === 0) && (y % 3 === 0) ? 0x8a6a4a : tone(WOOD, 0.62 + (hash(x >> 2, y >> 2, 95) - 0.5) * 0.1, x, y));   // spikmattan
    for (let r = 0; r < 2; r++) for (let k = 0; k < 4; k++) pase(P, -40 + k * 9, -57 + r * 12, PASAR[(k + r * 2) % PASAR.length]);
    // SÖTT! på en rosa banderoll med en svans i varje ände
    const nt = $t('SÖTT!'), nw = Math.min(40, textW(SMALL, nt) + 10), nx = 21 - (nw >> 1);
    P.rect(nx, -57, nw, 8, PASTELL_R[2]); P.hl(nx, -57, nw, PASTELL_R[4]); P.hl(nx, -50, nw, PASTELL_R[0]);
    for (const [sx, d] of [[nx - 3, 1], [nx + nw, -1]]) for (let j = 0; j < 8; j++) { const w = 3 - (j === 3 || j === 4 ? 2 : j === 2 || j === 5 ? 1 : 0); for (let i = 0; i < w; i++) P.px(d > 0 ? sx + 3 - w + i : sx + i, -57 + j, PASTELL_R[1]); }
    text(P, SMALL, nt, 21 - (textW(SMALL, nt) >> 1), -55, 0xffffff);
    // hyllan med sockerburkar i fyra färger
    for (let x = 2; x <= 40; x++) { P.px(x, -42, tone(WOOD, 0.85, x, 0)); P.px(x, -41, tone(WOOD, 0.45, x, 1)); }
    [PASTELL_R, PASTELL_B, LILA, GUL, PASTELL_R].forEach((pal, i) => { const x = 4 + i * 7; P.rect(x, -48, 5, 6, 0xd8e8f0); for (let j = 0; j < 4; j++) for (let k = 0; k < 5; k++) if (hash(x + k, j, 96) > 0.25) P.px(x + k, -46 + j, tone(pal, 0.4 + hash(x + k, j, 97) * 0.6, x + k, j)); P.hl(x, -49, 5, IRON[3]); P.px(x, -48, 0xffffff); });
    // ett hjärtformat spegelglas
    for (const [dx, dy] of [[0, 0], [1, 0], [3, 0], [4, 0], [-1, 1], [0, 1], [1, 1], [2, 1], [3, 1], [4, 1], [5, 1], [0, 2], [1, 2], [2, 2], [3, 2], [4, 2], [1, 3], [2, 3], [3, 3], [2, 4]]) P.px(26 + dx, -36 + dy, dx + dy < 3 ? 0xffffff : PASTELL_R[2]);
  },
  diskDeko(x, y) {
    if (y === -11) return 0xfff0f6;
    if (y >= -10 && y <= -4) { const d = Math.floor((x - y * 1.5 + 300) / 4) % 3; return d === 0 ? PASTELL_B[2] : d === 1 ? 0xfff0f6 : null; }
    return null;
  },
  framfor(P, xl, xr) {
    // maskinens fot (rosa emalj) och den stora blanka skålen
    for (let y = -24; y <= -16; y++) for (let x = -14; x <= 13; x++) P.px(x, y, tone(PASTELL_R, 0.85 - (x + 14) / 28 * 0.5 - (y === -24 ? -0.1 : 0), x, y));
    P.hl(-14, -24, 28, PASTELL_R[4]); P.rect(-4, -21, 8, 3, 0xfff6fa); P.px(-3, -20, PASTELL_R[1]); P.px(2, -20, 0x6fdc4c);
    for (let y = -31; y <= -25; y++) { const t2 = (y + 31) / 6, hw = Math.round(16 - t2 * 4); for (let x = -hw; x <= hw; x++) P.px(x, y, tone(STEEL, 0.95 - (x + hw) / (hw * 2) * 0.55 - t2 * 0.2, x, y)); }
    P.hl(-16, -31, 33, 0xffffff); P.hl(-15, -30, 31, 0x8e98a2);   // skålens kant
    // pinnburken och sockerburkarna
    P.rect(-32, -21, 6, 6, 0xd8eef4, 0.8); P.box(-32, -22, 6, 7, 0xa8c4d0); for (let k = 0; k < 5; k++) P.vl(-31 + k, -29 + (k & 1), 7, 0xfffaf0);
    P.rect(20, -20, 5, 5, 0xd8e8f0); P.rect(20, -18, 5, 3, PASTELL_R[2]); P.hl(20, -21, 5, IRON[3]);
    P.rect(27, -20, 5, 5, 0xd8e8f0); P.rect(27, -18, 5, 3, PASTELL_B[2]); P.hl(27, -21, 5, IRON[3]);
    // två färdiga sockervaddar i ett ställ
    for (const [x, pal] of [[36, PASTELL_R], [40, PASTELL_B]]) { P.vl(x, -20, 5, 0xfffaf0); klot(P, x, -24, 3, 3.5, pal); }
    // påsar som hänger från markisen i båda ändarna
    pase(P, xl + 7, -57, PASTELL_B); pase(P, xr - 13, -57, PASTELL_R);
    krittavla(P, xr + 5, 0, [PASTELL_R[2], PASTELL_B[2], LILA[3], GUL[3]], true);
    blomkruka(P, xl - 9, 0, LILA);
  },
  prydnad(P) {
    // pappersstruten (rosa och vit) och jättemolnet av sockervadd
    for (let yy = 0; yy <= 10; yy++) { const y = -97 - yy, hw = Math.round(1 + yy * 0.35); for (let x = -hw; x <= hw; x++) P.px(x, y, ((x + yy) & 2) ? 0xffffff : PASTELL_R[2]); }
    // ett fluffigt moln: många små tussar inom en ellips, rosa med en blå virvel, fransig kant och ljus uppe till vänster
    const CX = 0, CY = -119, RX = 17, RY = 13, tussar = [];
    for (let k = 0; k < 26; k++) { const a = hash(k, 1, 107) * Math.PI * 2, r = Math.sqrt(hash(k, 2, 107)) * 0.78; tussar.push([CX + Math.cos(a) * r * RX, CY + Math.sin(a) * r * RY, 3.5 + hash(k, 3, 107) * 3.5]); }
    for (let y = CY - RY - 4; y <= CY + RY + 4; y++) for (let x = CX - RX - 4; x <= CX + RX + 4; x++) {
      let inne = 0;
      for (const [tx, ty, tr] of tussar) { const d = Math.hypot(x + 0.5 - tx, y + 0.5 - ty) / tr; if (d < 1) inne = Math.max(inne, 1 - d); }
      if (inne <= 0) continue;
      if (inne < 0.22 && hash(x, y, 108) > inne * 4) continue;   // fransig kant
      const vir = Math.sin((x - CX) * 0.32 + (y - CY) * 0.22 + Math.hypot(x - CX, y - CY) * 0.25), pal = vir > 0.35 ? PASTELL_B : vir < -0.75 ? LILA : PASTELL_R;
      const v = 0.5 + inne * 0.45 - (x - CX) / RX * 0.16 - (y - CY) / RY * 0.2 + (hash(x >> 1, y >> 1, 109) - 0.5) * 0.12;
      P.px(x, y, tone(pal, v, x, y));
    }
    for (let k = 0; k < 16; k++) { const x = Math.round(CX - 9 + hash(k, 5, 110) * 12), y = Math.round(CY - 10 + hash(k, 6, 110) * 10); P.px(x, y, 0xffffff, 0.7); }
  },
  live(ctx, x, y, t) {   // vadden snurrar i skålen och tunna trådar lyfter
    for (let k = 0; k < 26; k++) {
      const a = t * 6 + k * 0.7, r = 3 + (k % 7) * 1.6, px = Math.round(x + Math.cos(a) * r), py = Math.round(y - 29 + Math.sin(a) * r * 0.25 - (k % 3));
      ctx.fillStyle = k % 4 === 0 ? '#ffffff' : k % 2 ? '#f8b0cc' : '#fcd0e2'; ctx.fillRect(px, py, 1, 1);
    }
    for (let k = 0; k < 3; k++) { const u = (t * 0.6 + k / 3) % 1; ctx.fillStyle = `rgba(255,220,236,${(0.7 * (1 - u)).toFixed(2)})`; ctx.fillRect(Math.round(x - 4 + k * 4 + Math.sin(t * 2 + k) * 2), Math.round(y - 32 - u * 8), 1, 1); }
  },
};

// ======================= 🍿 POPCORNSTÅNDET =======================
// cirkusränder, hyllor med randiga popcornstrutar, popcornmaskinen i glasskåp (grytan överst, kornen poppar i live),
// smörkannan och saltet; på taket en jättestrut som svämmar över
function strut(P, x, y, w, h) {   // en randig popcornstrut (smalare nertill) med popcorn överst
  for (let j = 0; j < h; j++) { const hw = (w / 2) - j * 0.18; for (let i = Math.round(-hw); i <= Math.round(hw); i++) P.px(x + i, y + j, ((i + 20) >> 1) % 2 ? 0xfff8ee : ROD[2]); P.px(x + Math.round(hw), y + j, mul(((Math.round(hw) + 20) >> 1) % 2 ? 0xfff8ee : ROD[2], 0.75)); }
  for (let i = Math.round(-w / 2); i <= Math.round(w / 2); i++) { P.px(x + i, y - 1, hash(x + i, y, 99) > 0.4 ? 0xfff4c8 : 0xf8e090); if (hash(x + i, y, 100) > 0.5) P.px(x + i, y - 2, 0xfffae0); }
}
export const POPCORN = {
  id: 'popcorn', W: 92, namn: $t('POPCORN'), meny: 'popcorn',
  tema: { pel: [ROD, CREAM], mark: [ROD, CREAM], skyltBg: GUL, skyltFg: 0xd4323a, skyltKant: 0x5e0e16, disk: ROD, skenFarg: 'rgba(255,200,90,.32)' },
  expedit: { dx: 14 },
  vagg(x, y, ao, natt) {
    let c = Math.floor((x + 64) / 6) % 2 === 0 ? 0xd84a46 : 0xfff2e4;
    if (y < -55) c = mix(c, 0x000000, 0.08);
    if (y === -36 || y === -35) c = GOLD[3];
    if (y > -35) c = Math.floor((x + 64) / 6) % 2 === 0 ? 0xb83a38 : 0xe8dccc;
    return mul(c, ao * (natt ? 0.9 : 1));
  },
  inne(P, xl, xr) {
    for (const yy of [-46, -33]) for (let x = xl + 1; x <= xr - 1; x++) { P.px(x, yy, tone(WOOD, 0.85, x, yy)); P.px(x, yy + 1, tone(WOOD, 0.45, x, yy)); }
    for (let k = 0; k < 7; k++) strut(P, xl + 5 + k * 6, -53, 5, 7);
    for (let k = 0; k < 4; k++) strut(P, 6 + k * 8, -41, 7, 8);
  },
  diskDeko(x, y) {
    if (y === -11 || y === -4) return GUL[3];
    const sx = ((x + 300) % 12) - 6, sy = y + 7;
    if (Math.abs(sy) <= 2 && Math.abs(sx) <= 2 && (sx === 0 || sy === 0 || Math.abs(sx) === Math.abs(sy))) return 0xfff8ee;   // stjärnor
    return null;
  },
  framfor(P, xl, xr) {
    // popcornmaskinen: röd ram med guld, glas, grytan, högen med popcorn, skylten POPCORN på taket
    const X0 = -36, X1 = -10, Y0 = -48, Y1 = -16;
    for (let y = Y0; y <= Y1; y++) for (let x = X0; x <= X1; x++) {
      const ram = x <= X0 + 1 || x >= X1 - 1 || y <= Y0 + 1 || y >= Y1 - 2;
      if (ram) { P.px(x, y, tone(ROD, x <= X0 + 1 || y <= Y0 + 1 ? 0.75 : 0.35, x, y)); continue; }
      let c = mix(0x5a3a2a, 0x6a4632, hash(x >> 1, y >> 1, 101));
      if (y > Y1 - 12) { const h = hash(x, y, 102); c = h > 0.6 ? 0xfff4c8 : h > 0.3 ? 0xf8e090 : 0xe8c060; if (y === Y1 - 12 && hash(x, 9, 103) > 0.5) c = mix(0x5a3a2a, 0xfff4c8, 0.5); }
      P.px(x, y, c);
    }
    for (let x = X0; x <= X1; x++) P.px(x, Y0, GOLD[3]); P.hl(X0, Y1 - 2, X1 - X0 + 1, GOLD[2]);
    // grytan som hänger överst
    for (let y = Y0 + 4; y <= Y0 + 9; y++) { const hw = y === Y0 + 9 ? 4 : 5; for (let x = -23 - hw; x <= -23 + hw; x++) P.px(x, y, tone(STEEL, 0.9 - (x + 23 + hw) / (hw * 2) * 0.55, x, y)); }
    P.vl(-23, Y0 + 2, 2, IRON[3]); P.hl(-29, Y0 + 5, 13, 0xffffff, 0.5);
    for (let y = Y0 + 2; y <= Y1 - 3; y++) for (let x = X0 + 2; x <= X1 - 2; x++) { if ((x - y * 2) % 15 === 0) P.px(x, y, 0xffffff, 0.35); }
    const pt = $t('POPCORN'), pw = textW(SMALL, pt) + 4;
    P.rect(-23 - (pw >> 1), Y0 - 7, pw, 7, ROD[2]); P.hl(-23 - (pw >> 1), Y0 - 7, pw, ROD[4]); text(P, SMALL, pt, -21 - (pw >> 1), Y0 - 6, GUL[3]);
    P.rect(-24, Y0 - 9, 2, 2, GUL[3]);   // lampan på taket
    // strutar, smörkanna och salt på disken
    for (let k = 0; k < 3; k++) strut(P, 4 + k * 7, -22, 5, 6);
    P.rect(26, -21, 5, 5, GUL[3]); P.box(26, -22, 5, 6, GUL[1]); P.px(31, -20, GUL[1]); P.px(32, -21, GUL[1]);   // smörkannan
    P.rect(35, -20, 3, 4, 0xfffaf0); P.hl(35, -21, 3, STEEL[2]); P.px(36, -18, IRON[3]);
    krittavla(P, xr + 5, 0, [ROD[2], GUL[3], 0xfff4c8, ROD[3]], true);
    blomkruka(P, xl - 9, 0, ROD);
  },
  prydnad(P) {
    // jättestruten: röda och vita ränder, smalare nertill, POP-stjärnan på framsidan
    for (let yy = 0; yy <= 22; yy++) {
      const y = -97 - yy, hw = Math.round(9 + yy * 0.32);
      for (let x = -hw; x <= hw; x++) { const rand = Math.floor((x + 40) / 3) % 2 === 0; P.px(x, y, tone(rand ? ROD : CREAM, 0.95 - (x + hw) / (hw * 2) * 0.55, x, y)); }
    }
    for (const [dx, dy] of [[0, -3], [-1, -1], [0, -1], [1, -1], [-3, 0], [-2, 0], [-1, 0], [0, 0], [1, 0], [2, 0], [3, 0], [-1, 1], [0, 1], [1, 1], [-2, 2], [2, 2]]) P.px(dx, -108 + dy, GUL[3]);
    // popcornen som svämmar över
    for (let k = 0; k < 34; k++) { const x = Math.round((hash(k, 1, 104) - 0.5) * 30), y = -121 - Math.round(hash(k, 2, 104) * (10 - Math.abs(x) * 0.3)); klot(P, x, y, 2.4, 2, [0xb08a30, 0xe8c060, 0xf8e090, 0xfff4c8, 0xfffcec]); }
    klot(P, -15, -100, 2.2, 1.8, [0xb08a30, 0xe8c060, 0xf8e090, 0xfff4c8, 0xfffcec]); klot(P, 16, -105, 2.2, 1.8, [0xb08a30, 0xe8c060, 0xf8e090, 0xfff4c8, 0xfffcec]);
  },
  live(ctx, x, y, t) {   // kornen poppar ur grytan och studsar ner i högen
    for (let k = 0; k < 7; k++) {
      const u = (t * 1.3 + k * 0.37) % 1, a = (k * 2.39) % (Math.PI * 2), px = Math.round(x - 23 + Math.cos(a) * u * 9), py = Math.round(y - 37 + u * 14 - Math.sin(u * Math.PI) * 6);
      ctx.fillStyle = k % 2 ? '#fff4c8' : '#ffffff'; ctx.fillRect(px, py, 2, 1); ctx.fillRect(px, py - 1, 1, 1);
    }
  },
};

// ======================= 🍔 HAMBURGERSTÅNDET =======================
// dinerkakel i turkos, schackband, menytavla med burgarbilder, stekbord där burgarna fräser (os i live), frityren med
// pommes; på disken ketchup, senap, servettställ och en bricka; på taket en jätteburgare
const BRO = [0x6a3a14, 0xa86224, 0xd89040, 0xf0b868, 0xffdc9c];
const KOTT = [0x2a140c, 0x4a2414, 0x6a3a1e, 0x8a5430, 0xa87048];
function burgare(P, cx, by, w) {   // en liten burgare (w bred) – bröd, ost, sallad, kött, bröd
  const hw = w >> 1;
  for (let x = -hw; x <= hw; x++) { P.px(cx + x, by, tone(BRO, 0.45, x, by)); P.px(cx + x, by - 1, KOTT[2]); P.px(cx + x, by - 2, (x & 1) ? GUL[3] : GRON[3]); }
  for (let j = 0; j < 3; j++) { const ww = hw - (j === 2 ? 1 : 0); for (let x = -ww; x <= ww; x++) P.px(cx + x, by - 3 - j, tone(BRO, 0.85 - j * 0.1 - (x + ww) / (ww * 2) * 0.3, x, j)); }
  P.px(cx - 1, by - 5, 0xfff8e0); P.px(cx + 1, by - 4, 0xfff8e0);
}
export const HAMBURGARE = {
  id: 'hamburgare', W: 100, namn: $t('HAMBURGARE'), meny: 'hamburgare',
  tema: { pel: [TURK, CREAM], mark: [ROD, CREAM], skyltBg: ROD, skyltFg: 0xfff2c0, skyltKant: 0x3a0a0e, disk: TURK, skenFarg: 'rgba(255,140,120,.3)' },
  expedit: { dx: 16 },
  vagg(x, y, ao, natt) {
    let c;
    if (y < -42) c = 0xfff4e4;
    else if (y <= -40) c = (Math.floor((x + 80) / 2) + Math.floor((y + 60) / 1)) % 2 ? 0x1e1a24 : 0xf4f1ea;   // schackbandet
    else { const fog = (x + 80) % 5 === 4 || (y + 60) % 4 === 3; c = fog ? TURK[2] : TURK[3]; }
    if (y === -43) c = STEEL[3];
    return mul(c, ao * (natt ? 0.9 : 1));
  },
  inne(P, xl, xr) {
    // menytavlan med tre burgare och priser
    for (let y = -60; y <= -41; y++) for (let x = 2; x <= 40; x++) P.px(x, y, x === 2 || x === 40 || y === -60 || y === -41 ? STEEL[3] : mix(0x1e1a24, 0x2a2630, hash(x >> 1, y, 105) * 0.5));
    text(P, SMALL, $t('MENY'), 21 - (textW(SMALL, $t('MENY')) >> 1), -58, 0xf4f1ea); P.hl(5, -52, 33, 0x5a5662);
    for (let k = 0; k < 3; k++) { burgare(P, 9 + k * 12, -46, 7); P.px(6 + k * 12, -43, 0xffe060); P.px(8 + k * 12, -43, 0xffe060); P.px(10 + k * 12, -43, 0xffe060); }
    // väggklockan och affischen med pommes
    for (let y = -6; y <= 6; y++) for (let x = -6; x <= 6; x++) { const d = Math.hypot(x, y); if (d <= 6.2) P.px(-31 + x, -52 + y, d > 5 ? ROD[1] : d > 4.4 ? STEEL[3] : 0xfffaf0); }
    P.vl(-31, -56, 4, 0x1e1a24); P.hl(-31, -52, 3, 0x1e1a24); P.px(-31, -52, ROD[2]);
    for (const [dx, dy] of [[0, -4], [4, 0], [0, 4], [-4, 0]]) P.px(-31 + dx, -52 + dy, 0x5a5662);
    P.box(-20, -59, 13, 15, ROD[2]); P.rect(-19, -58, 11, 13, 0xfff4e4);
    P.rect(-17, -50, 7, 4, ROD[2]); P.hl(-17, -50, 7, ROD[4]); for (let k = 0; k < 6; k++) P.vl(-17 + k, -55 + (k % 3), 5 - (k % 3), k % 2 ? GUL[3] : GUL[2]);
    // fläkthuven och stekbordet längs väggen
    for (let y = -40; y <= -34; y++) for (let x = -42; x <= -6; x++) P.px(x, y, tone(STEEL, 0.85 - (y + 40) * 0.08 - (x + 42) / 36 * 0.2, x, y));
    for (let x = -40; x <= -8; x += 3) P.px(x, -36, IRON[2]);
    for (let y = -24; y <= -19; y++) for (let x = -42; x <= -6; x++) P.px(x, y, y === -24 ? 0x6a7078 : tone(IRON, 0.5 - (y + 24) * 0.05, x, y));
    for (const bx of [-38, -30, -22]) { for (let x = 0; x < 6; x++) { P.px(bx + x, -26, KOTT[3 - (x === 5 ? 2 : 0)]); P.px(bx + x, -25, KOTT[1]); } P.px(bx + 1, -26, KOTT[4]); }   // köttbitarna
    for (let x = 0; x < 6; x++) { P.px(-14 + x, -26, GUL[3]); P.px(-14 + x, -25, GUL[2]); } P.px(-14, -24, GUL[2]);   // osten smälter
    // frityren med en korg pommes
    for (let y = -30; y <= -19; y++) for (let x = -4; x <= 8; x++) P.px(x, y, tone(STEEL, 0.8 - (x + 4) / 12 * 0.5, x, y));
    P.rect(-2, -33, 8, 4, 0x8a949c); for (let k = 0; k < 7; k++) P.vl(-2 + k, -37 + (k % 3), 4 - (k % 3), k % 2 ? GUL[3] : GUL[2]);
    P.hl(4, -34, 7, IRON[2]);   // korgens handtag
    // ringklockan
    P.rect(30, -24, 6, 2, GOLD[2]); P.px(31, -26, GOLD[3]); P.rect(32, -27, 2, 1, GOLD[4]);
  },
  diskDeko(x, y) {
    if (y === -12) return STEEL[4];
    if (y >= -10 && y <= -9) return (Math.floor((x + 200) / 2) + y) % 2 ? 0x1e1a24 : 0xf4f1ea;
    if (y === -8) return STEEL[3];
    return null;
  },
  framfor(P, xl, xr) {
    // en bricka med burgare och pommes som väntar
    P.rect(-36, -17, 16, 2, ROD[2]); P.hl(-36, -17, 16, ROD[4]); burgare(P, -31, -18, 7);
    P.rect(-25, -22, 4, 4, ROD[2]); for (let k = 0; k < 4; k++) P.vl(-25 + k, -25 + (k & 1), 3, GUL[3]);
    // ketchup, senap, servetter och kartonger
    for (const [x, c] of [[4, ROD], [8, GUL]]) { P.rect(x, -21, 3, 6, c[2]); P.px(x, -21, c[4]); P.vl(x + 2, -20, 5, c[0]); P.px(x + 1, -23, c[1]); P.px(x + 1, -22, 0xfffaf0); }
    P.rect(14, -21, 6, 6, STEEL[3]); P.px(14, -21, 0xffffff); P.vl(19, -20, 5, STEEL[1]); P.hl(15, -22, 4, 0xffffff);
    for (let k = 0; k < 3; k++) { P.rect(24, -18 - k * 3, 9, 3, k % 2 ? 0xfff2c0 : ROD[2]); P.hl(24, -18 - k * 3, 9, 0xffffff, 0.4); }
    burgare(P, 0, -2, 9);   // dekalen på diskens front
    krittavla(P, xr + 5, 0, [BRO[3], GUL[3], ROD[2], GRON[3]], true);
    blomkruka(P, xl - 9, 0, GUL);
  },
  prydnad(P) {
    // jätteburgaren: bröd med sesam, sallad, tomat, ost som rinner, kött, bröd
    const B = (y, hw, pal, v) => { for (let x = -hw; x <= hw; x++) P.px(x, y, tone(pal, v - (x + hw) / (hw * 2) * 0.45, x, y)); };
    for (let j = 0; j < 4; j++) B(-97 - j, 15 - (j === 0 ? 1 : 0), BRO, 0.62 - j * 0.04);
    for (let j = 0; j < 4; j++) B(-101 - j, 16, KOTT, 0.6 - j * 0.06);
    for (let x = -16; x <= 16; x++) { P.px(x, -105, GUL[3]); P.px(x, -106, GUL[2]); if (x % 6 === 2) { P.px(x, -104, GUL[2]); P.px(x, -103, GUL[2]); } }
    for (let x = -15; x <= 15; x += 5) { klot(P, x, -107, 2.5, 1.2, ROD); }
    for (let x = -17; x <= 17; x++) { const v = (x + 17) % 3; P.px(x, -109 + (v === 1 ? 1 : 0), GRON[3]); P.px(x, -108, GRON[2]); }
    for (let j = 0; j < 12; j++) { const hw = Math.round(15 * Math.sqrt(1 - ((j) / 12) ** 2)); B(-110 - j, hw, BRO, 0.95 - j * 0.02); }
    for (let k = 0; k < 18; k++) { const x = Math.round((hash(k, 1, 106) - 0.5) * 24), y = -112 - Math.floor(hash(k, 2, 106) * 8); P.px(x, y, 0xfff8e0); P.px(x + 1, y, 0xd8c8a0); }
    P.px(-9, -118, 0xffffff); P.px(-8, -119, 0xffffff); P.px(-10, -117, 0xffffff, 0.6);
  },
  live(ctx, x, y, t) {   // oset från stekbordet och fräset
    for (let k = 0; k < 5; k++) {
      const u = (t * 0.45 + k / 5) % 1, px = Math.round(x - 34 + k * 7 + Math.sin(t * 2 + k) * 2), py = Math.round(y - 28 - u * 18);
      const c = u < 0.3 ? '#f4f1ea' : u < 0.6 ? '#d8d4dc' : '#b8b4c4';
      ctx.globalAlpha = 0.75 * (1 - u); ctx.fillStyle = c; ctx.fillRect(px, py, 2, 2); ctx.globalAlpha = 1;
    }
    if (Math.floor(t * 9) % 4 === 0) { ctx.fillStyle = '#fff6c0'; ctx.fillRect(Math.round(x - 36 + (Math.floor(t * 13) % 30)), y - 27, 1, 1); }
  },
};

export const MATSTAND = [GLASS, SOCKERVADD, POPCORN, HAMBURGARE];
