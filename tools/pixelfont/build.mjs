// Bygger assets/fonts/pixelstad.otf – menyernas pixeltypsnitt – ur glyferna:
// versaler/siffror/ÅÄÖÉ från spelets BIG (js/core/floor-pix.js) + gemener och tecken (glyphs.mjs).
// Rutnätet: 1 typsnittspixel = 100 enheter, em = 12 pixlar (2 accentrader + 7 versalhöjd + 3 under
// baslinjen). font-size 12 px ⇒ 1 CSS-pixel per typsnittspixel, 24 px ⇒ 2, 36 px ⇒ 3 – i de
// storlekarna hamnar varje pixel på hela skärmpixlar och texten blir knivskarp.
//   node tools/pixelfont/build.mjs      (kräver opentype.js: cd tools/pixelfont && npm install)
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import opentype from 'opentype.js';
import { BIG } from '../../js/core/floor-pix.js';
import { LOWER, UPPER_EXTRA, PUNCT } from './glyphs.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(HERE, '../../assets/fonts');
const U = 100, EM = 12 * U, ASC = 9 * U, DESC = 3 * U, OVER = 2; // OVER: överlapp mellan rader (inga sömmar)

// glyfkartan: tecken → { rows, up, down }
const map = new Map();
for (const [ch, gl] of Object.entries(BIG)) if (ch.length === 1) map.set(ch, { rows: gl.rows, up: gl.up || [], down: gl.down || [] });
for (const src of [LOWER, UPPER_EXTRA, PUNCT]) for (const [ch, gl] of Object.entries(src)) map.set(ch, { rows: gl.rows, up: gl.up || [], down: gl.down || [] });

// fet stil = varje tänd pixel tänder också pixeln till höger (så gör man fetstil i pixeltypsnitt)
const boldRow = (r) => [...r + '.'].map((c, i, a) => (c === '#' || a[i - 1] === '#' ? '#' : '.')).join('');
const bolden = (gl) => ({ rows: gl.rows.map(boldRow), up: gl.up.map(boldRow), down: gl.down.map(boldRow) });
// en glyf → sökväg: varje rad slås ihop till vågräta stycken (rektanglar); raderna överlappar en aning
function pathOf(gl) {
  const p = new opentype.Path();
  const rect = (x0, x1, yBottom) => {
    const L = x0 * U, R = x1 * U, B = yBottom - OVER, T = yBottom + U;
    p.moveTo(L, B); p.lineTo(R, B); p.lineTo(R, T); p.lineTo(L, T); p.close(); // medurs i y-upp = ytterkontur
  };
  const rowsWithY = [
    ...gl.up.map((r, i) => [r, (7 + gl.up.length - 1 - i) * U]),
    ...gl.rows.map((r, i) => [r, (6 - i) * U]),
    ...gl.down.map((r, j) => [r, -(j + 1) * U]),
  ];
  for (const [row, y] of rowsWithY) {
    let x = 0;
    while (x < row.length) {
      if (row[x] !== '#') { x++; continue; }
      let e = x;
      while (e < row.length && row[e] === '#') e++;
      rect(x, e, y);
      x = e;
    }
  }
  return p;
}
const width = (gl) => Math.max(...[...gl.rows, ...gl.up, ...gl.down].map((r) => r.length));

function build(bold) {
  const glyphs = [new opentype.Glyph({ name: '.notdef', unicode: 0, advanceWidth: 6 * U, path: new opentype.Path() })];
  for (const [ch, gl0] of [...map].sort((a, b) => a[0].codePointAt(0) - b[0].codePointAt(0))) {
    const gl = bold && ch !== ' ' ? bolden(gl0) : gl0, w = width(gl);
    const adv = ch === ' ' ? 4 * U : (w + 1) * U; // en pixel luft efter varje tecken
    glyphs.push(new opentype.Glyph({ name: 'u' + ch.codePointAt(0).toString(16).toUpperCase().padStart(4, '0'), unicode: ch.codePointAt(0), advanceWidth: adv, path: pathOf(gl) }));
  }
  glyphs.push(new opentype.Glyph({ name: 'nbsp', unicode: 0xa0, advanceWidth: 4 * U, path: new opentype.Path() })); // hårt mellanslag
  const font = new opentype.Font({
    familyName: 'Pixelstad', styleName: bold ? 'Bold' : 'Regular', unitsPerEm: EM, ascender: ASC, descender: -DESC, glyphs,
    copyright: 'Snabbfilen – Pixelstaden', designer: 'Snabbfilen', weightClass: bold ? 700 : 400,
  });
  // radavstånd = em (ingen extra luft) – CSS line-height sköter resten
  font.tables.os2 = { ...(font.tables.os2 || {}), sTypoAscender: ASC, sTypoDescender: -DESC, sTypoLineGap: 0, usWinAscent: ASC, usWinDescent: DESC, usWeightClass: bold ? 700 : 400, fsSelection: (bold ? 0x20 : 0x40) | 0x80 };
  const out = path.join(OUT_DIR, bold ? 'pixelstad-fet.otf' : 'pixelstad.otf');
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(out, Buffer.from(font.toArrayBuffer()));
  console.log(`${glyphs.length} glyfer → ${path.relative(process.cwd(), out)} (${fs.statSync(out).size} byte)`);
}
build(false);
build(true);
