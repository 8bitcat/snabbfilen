// 🕵️ Mysteriets pixelgrafik (js/core/mysterium.js): ledtrådarna (12×12), de falska spåren i letaspelet och bilden av
// skatan i boet i Parken. Kartorna: en bokstav per pixel ur pixikonens palett (js/core/pixikon.js PAL), punkt =
// genomskinligt – samma stil som mobilens ikoner (mörk kontur, 3–4 toner).
import { PAL } from './pixikon.js';

export const SAKER = {
  // en svartvit skatfjäder med blågrön glans
  fjader: ['.........kk.', '........kcBk', '.......kcbBk', '......kcbBk.', '.....kcbBk..', '....kWbBk...', '...kWWBk....', '..kWWkk.....', '..kWk.......', '.kk.........', 'kk..........', '............'],
  // glitter: en liten slipad sten som blänker
  glitter: ['.....W......', '....WWW.....', '.....W......', '...kkkkk....', '..kcWWcbk...', '.kcWcccbBk..', '.kkkkkkkkk..', '..kcccbBk...', '...kcbBk..W.', '....kBk..WWW', '.....k....W.', '............'],
  // en tappad pärla
  parla: ['............', '....kkkk....', '...kWWwwk...', '..kWWwwwgk..', '..kWwwwwgk..', '..kwwwwggk..', '..kwwwgggk..', '...kgggGk...', '....kkkk....', '............', '............', '............'],
  // fågelspår (tre tår framåt, en bakåt) i sanden
  spar: ['.H.H........', '..H.........', '..H.....H.H.', '.........H..', '....H.H..H..', '.....H......', '.....H......', '........H.H.', '.H.H.....H..', '..H......H..', '..H.........', '............'],
  // glitterknappen från BLING BLING
  knapp: ['....kkkk....', '..kkYyyYkk..', '.kYyyyyyyYk.', '.kyyWyyyyYk.', 'kYyykyykyyYk', 'kYyyyyyyyyYk', 'kYyykyykyyYk', '.kYyyyyyyYk.', '.kYYyyyyYYk.', '..kkYYYYkk..', '....kkkk....', '............'],
  // kattstatyns krona med röda stenar
  krona: ['............', '............', '.k...k...k..', 'kYk.kYk.kYk.', 'kyYkyYykYyk.', 'kyyYyyyYyyk.', 'kyyyyyyyyyk.', 'kyrryWyrryk.', 'kyyyyyyyyyk.', 'kYYYYYYYYYk.', '.kkkkkkkkk..', '............'],
  // fiskedraget (blankt skeddrag med röd prick)
  drag: ['............', '.........kk.', '........kgk.', '.......kWk..', '.....kkWgk..', '...kkWWggk..', '..kWWgrgk...', '.kWggrrgk...', '.kgggggk....', '..kkGkk.....', '....k.......', '...k.k......'],
};
// de falska spåren i letaspelet
export const SKRAP = {
  lov: ['............', '........kk..', '......kkok..', '.....koook..', '....kooDok..', '...kooDok...', '..koDook....', '..kDook.....', '.kkkk.......', 'k...........', '............', '............'],
  sten: ['............', '............', '............', '....kkkk....', '..kkgggGkk..', '.kggwggGGGk.', '.kgggggGGGk.', '..kkGGGGkk..', '....kkkk....', '............', '............', '............'],
  papper: ['............', '............', '...kkkkk....', '..kwwwgwk...', '..kwgwwwwk..', '.kwwwwgwwk..', '.kgwwwwwgk..', '..kwwgwwk...', '...kkkkkk...', '............', '............', '............'],
};
// skatan från sidan (tittar åt vänster): svart huvud och bröst, vit buk och axelfläck, lång blågrön stjärt
const SKATA = [
  '...kkk..............',
  '..kkkkk.............',
  'ddkWkkkk............',
  '..kkkkkkk.........kk',
  '...kkkWWWkk.....kbBk',
  '...kWWWkkkkk..kbBBk.',
  '...kWWWWkkkkkkbBBk..',
  '....kWWWkkkkbBBk....',
  '.....kWWkkkkBk......',
  '......kk.k..........',
  '......d..d..........',
  '.....dd.dd..........',
];
const FARG = { ...PAL, H: '#6e4426' };

// en karta på en canvas (x, y = övre vänstra hörnet), valfri skala
export function ritaKarta(ctx, karta, x, y, k = 1) {
  karta.forEach((rad, j) => { for (let i = 0; i < rad.length; i++) { const c = FARG[rad[i]]; if (c) { ctx.fillStyle = c; ctx.fillRect(x + i * k, y + j * k, k, k); } } });
}
// en ledtråd som bild (dataURL) – i anteckningsboken
const CACHE = new Map();
export function sakURL(id, k = 3) {
  const key = id + k;
  if (CACHE.has(key)) return CACHE.get(key);
  const m = SAKER[id] || SKRAP[id];
  if (!m || typeof document === 'undefined') return '';
  const c = document.createElement('canvas'); c.width = 12 * k; c.height = 12 * k;
  ritaKarta(c.getContext('2d'), m, 0, 0, k);
  const u = c.toDataURL(); CACHE.set(key, u);
  return u;
}

// Boet i trädtoppen i Parken (72×44 spelpixlar): himmel, lövverk, en gren, boet av kvistar med det glittriga –
// kronan, pärlorna, fiskedraget, glittret – och skatan på grenen. med = vad som ligger i boet ('allt' | 'bara-knappen')
export function ritaBoet(ctx, { med = 'allt', skata = true } = {}) {
  const R = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); };
  for (let y = 0; y < 44; y++) R(0, y, 72, 1, y < 22 ? '#8cc8f0' : '#a8d4ff');                       // himlen
  // lövverket runt kanterna: rundade klungor (mörk underkant, ljus glans) – samma frö varje gång
  let fro = 11;
  const slump = () => (fro = (fro * 16807) % 2147483647) / 2147483647;
  const klunga = (x, y) => {
    x = Math.round(x); y = Math.round(y);
    R(x + 1, y, 5, 1, '#52b464'); R(x, y + 1, 7, 2, '#3f9a50'); R(x + 1, y + 3, 5, 1, '#2f7a3e');
    R(x + 1, y + 1, 2, 1, '#9be08a'); R(x + 2, y, 1, 1, '#9be08a');
  };
  for (let i = 0; i < 54; i++) {
    const sida = i % 3;
    klunga(sida === 0 ? slump() * 14 - 2 : sida === 1 ? 58 + slump() * 14 : slump() * 72, sida === 2 ? slump() * 9 - 2 : slump() * 42);
  }
  for (let i = 0; i < 44; i++) R(6 + i, 30 + Math.round(i * 0.18), 2, 3, i % 5 ? '#7a4a2a' : '#4a2c18');   // grenen
  R(6, 33, 44, 1, '#4a2c18');
  // boet: en oval av kvistar
  for (let y = 0; y < 9; y++) for (let x = 0; x < 26; x++) {
    const dx = (x - 12.5) / 13, dy = (y - 4.5) / 4.5;
    if (dx * dx + dy * dy > 1) continue;
    R(10 + x, 22 + y, 1, 1, (x * 3 + y * 5) % 7 < 2 ? '#4a2c18' : (x + y) % 3 ? '#a0643c' : '#7a4a2a');
  }
  for (let x = 0; x < 22; x += 2) R(12 + x, 21 + (x % 4 ? 0 : 1), 3, 1, '#7a4a2a');                       // kvistarna i kanten
  if (med === 'allt') {
    ritaKarta(ctx, SAKER.krona, 15, 11);
    for (const [x, y] of [[29, 20], [32, 21], [35, 20]]) { R(x, y, 2, 2, '#f4f1ea'); R(x, y, 1, 1, '#ffffff'); }   // pärlorna
    R(26, 19, 2, 3, '#c8c4cf'); R(26, 19, 1, 1, '#ffffff'); R(27, 21, 1, 1, '#e04848');                    // fiskedraget
    for (const [x, y] of [[13, 19], [38, 18], [24, 15]]) { R(x, y, 1, 3, '#fffde0'); R(x - 1, y + 1, 3, 1, '#fffde0'); }   // glittret
  } else if (med === 'knapp') {
    ritaKarta(ctx, SAKER.knapp, 18, 12);
  }
  if (skata) ritaKarta(ctx, SKATA, 46, 17);
}
