// PIREN och SJÖBODEN (v4, Linnéstaden) – Carl 2026-10-07: "båtarna bara ligger.. gör lite större båtar,
// de kan vara knutna till kajen, någon som står och fiskar och får fisk, en korg vid sidan om. En pir ut
// till en fiskrestaurang … båtar längs med piren … lite som hänger längst ner, lampor längs med, mysigt."
// v0.93 "Livet vid piren" (Carl samma dag): "finns inga stolar till borden … fiskaren fiskar rakt på båten
// … ett litet flöte som guppar upp och ner … gör piren lite större utåt … ett romantiskt par ska hålla hand,
// gå dit, pussas och njuta av att vara vid havet. Fiskar ska hoppa i havet och ibland en delfin – ser man
// delfinen ska lyckan gå upp, och andra människor som är där ska visa emojis, kramas och säga att det ger tur."
//
// Ritar (allt i världskoordinater, y-sorterat som stadens andra föremål):
//   piren (PIER.walk) och bryggan (PIER.deck) i trä med pålar, räcken och lyktstolpar, öppningen i
//   kajräcket; bryggans västra del är en utsiktsplats (bänkar vid norra räcket, däckstolar, myntkikare);
//   uteserveringen (parasollbord och Sjöbodens bord med rutig duk – alla med stolar man kan sätta sig på),
//   nät och bojar som hänger ner mot vattnet; större båtar förtöjda med rep vid kajen och längs piren;
//   två fiskare med spö, flöte som guppar och korg – det nappar då och då och fisken landar i korgen;
//   fiskar som hoppar, ibland en delfin; kärleksparet som går hand i hand ut på bryggan, pussas och
//   tittar ut över vattnet; fiskmåsar på lyktorna och på Sjöbodens tak.
// Kontrakt: createPier(env) → { items(), obstacles, seats, glow(ctx, view), update(dt), fisherAt(x, y),
//   kikareAt(x, y), talks(), takeLuck(), spot(), _debug }
//   seats = sittplatser i samma form som props.seats() (city.js lägger in dem där – livet och spelaren
//   sätter sig på dem). takeLuck() → { x, y } en gång när spelaren har sett delfinen (city.js: lycka,
//   toast och life.cheer). talks() = bubblorna ovanför pirens eget folk (city.js ritar dem överst).
//   openKrog(A) – Sjöbodens meny (city.js enter: 'fiskkrog'); talkFisher(A, f) – prata med fiskaren;
//   useKikare(A, pier) – en femma i kikaren (ibland lockar den fram delfinen).
import { Pix, SMALL, text, textW, ctxText, mix, mul, hash } from '../core/floor-pix.js';
import { drawPerson } from '../core/people.js';
import { CITY, PIER, CANAL_WATER, FREESTANDING } from './map.js';
import { ravaraOf, MAX_RAVA } from '../game.js';
import { openModal, closeModal, toast, esc } from '../core/ui.js';
import { play } from '../core/sound.js';

const WHITE = 0xffffff;
const rgba = (c, a) => `rgba(${(c >> 16) & 255},${(c >> 8) & 255},${c & 255},${Math.max(0, Math.min(1, a)).toFixed(3)})`;
const spr = (w, h, ax, ay, fn) => { const P = new Pix(w, h, -ax, -ay); fn(P); return { img: P.flush(), ax, ay }; };
const put = (ctx, s, x, y) => ctx.drawImage(s.img, Math.round(x) - s.ax, Math.round(y) - s.ay);
const WOOD = [0x3a2616, 0x5a3c24, 0x7a5432, 0x9a6e44, 0xb88a58, 0xd4a874];
const WATER = [0x103a58, 0x1a5478, 0x28709a, 0x4492bc, 0x7cc0e0, 0xc8eefa];
const Q0 = CITY.QUAY[0];
const SJO = FREESTANDING.find((b) => b.id === 'sjoboden');
const SJO_X = SJO ? [SJO.x, SJO.x + SJO.w] : [-548, -440];       // Sjöbodens fasad (står på bryggans norra kant)

// ---------- bryggans möblering (världskoordinater) ----------
const LANE = PIER ? PIER.deck[1] + 14 : 0;     // 912: gången längs bryggan (framför Sjöbodens dörr)
const TY = PIER ? PIER.deck[1] + 28 : 0;       // 926: borden (stolen bakom på 921, stolen framför på 937)
const PARASOLS = [[-630, 0x2a6ab0], [-582, 0xd8443a]];
const DUKAR = [SJO_X[0] + 20, SJO_X[1] - 20];  // Sjöbodens egna bord med rutig duk och lykta (dörren fri emellan)
const BANKAR = [-736, -678];                   // vid norra räcket: man sitter med ryggen mot oss och tittar ut
const DACK = [[-718, 0x2a6ab0], [-692, 0xe8a030]];   // däckstolarna (man halvligger och tittar mot oss/havet)
const KIK = { x: -655, y: (PIER ? PIER.deck[1] : 0) + 7 };   // myntkikaren vid norra räcket
const SPOT = -707;                             // där kärleksparet står vid räcket
const NLAMPS = [-760, -606];                   // lyktstolpar på norra räcket
const SLAMPS = [-704, -608, -512, -440];       // och på det södra

// ---------- småhjälpare för spritarna ----------
// mörk kant runt allt som är målat (läsbart mot plankorna)
function outline(P, c, a) {
  const { w, h, d } = P, on = (x, y) => x >= 0 && y >= 0 && x < w && y < h && d[(y * w + x) * 4 + 3] > 0, add = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (!on(x, y) && (on(x - 1, y) || on(x + 1, y) || on(x, y - 1) || on(x, y + 1))) add.push([x, y]);
  for (const [x, y] of add) P.px(x + P.ox, y + P.oy, c, a);
}

// ---------- piren och bryggan ----------
function deckArt() {
  const [wx0, wy0, wx1] = PIER.walk, [dx0, dy0, dx1, dy1] = PIER.deck;
  const x0 = dx0 - 4, x1 = wx1 + 4, y0 = Q0 + 2, y1 = dy1 + 16;
  return spr(x1 - x0, y1 - y0, -x0, -y0, (P) => {
    const plankX = (x, y, seed) => { const r = (y - y0) % 4, k = hash(Math.floor((y - y0) / 4), 1, seed); let c = mix(WOOD[3], WOOD[4], k * 0.8); if (r === 3) c = WOOD[1]; else if (r === 0) c = mix(c, WHITE, 0.12); if (hash(x, y, seed + 2) > 0.94) c = mul(c, 0.86); if ((x + Math.floor((y - y0) / 4) * 7) % 23 === 0) c = WOOD[2]; return c; };
    const plankY = (x, y, seed) => { const r = (x - dx0) % 5, k = hash(Math.floor((x - dx0) / 5), 2, seed); let c = mix(WOOD[3], WOOD[4], k * 0.8); if (r === 4) c = WOOD[1]; else if (r === 0) c = mix(c, WHITE, 0.12); if (hash(x, y, seed + 3) > 0.94) c = mul(c, 0.86); if ((y + Math.floor((x - dx0) / 5) * 11) % 29 === 0) c = WOOD[2]; return c; };
    // pålarna (syns under bryggans och pirens kant, ner i vattnet med en ring av krusningar)
    const pile = (x, top, len) => { for (let y = top; y < top + len; y++) { P.px(x, y, mix(WOOD[1], 0x2a4a3a, (y - top) / len)); P.px(x + 1, y, mix(WOOD[0], 0x1a3a2a, (y - top) / len)); P.px(x + 2, y, mul(WOOD[0], 0.8)); } for (let i = -2; i <= 4; i++) P.px(x + i, top + len, WATER[4], 0.7); };
    for (let y = wy0 + 10; y < dy0; y += 18) { pile(wx0 - 2, y, 7); pile(wx1 - 1, y, 7); }
    for (let x = dx0; x < dx1; x += 16) pile(x, dy1, 9);
    pile(dx1 - 3, dy1, 9);
    for (let y = dy0 + 6; y < dy1; y += 16) pile(dx0 - 3, y, 4);                                   // västra kanten
    // pirens däck: plankor tvärs över gången
    for (let y = wy0; y < dy0; y++) for (let x = wx0; x < wx1; x++) P.px(x, y, plankX(x, y, 11));
    // bryggan: plankor på längden, en ljus kant mot vattnet
    for (let y = dy0; y < dy1; y++) for (let x = dx0; x < dx1; x++) P.px(x, y, plankY(x, y, 13));
    for (let x = dx0; x < dx1; x++) { P.px(x, dy1, WOOD[5]); P.px(x, dy1 + 1, WOOD[2]); P.px(x, dy1 + 2, WOOD[1]); P.px(x, dy1 + 3, WOOD[0]); P.px(x, dy1 + 4, 0x1a2a2a, 0.5); }   // kanten (bjälken) mot vattnet
    for (let y = wy0; y < dy0; y++) { P.px(wx0 - 1, y, WOOD[1]); P.px(wx1, y, WOOD[1]); P.px(wx1 + 1, y, 0x1a2a2a, 0.5); }
    for (let y = dy0; y < dy1 + 4; y++) { P.px(dx0 - 1, y, y < dy1 ? WOOD[1] : WOOD[0]); P.px(dx0 - 2, y, 0x1a2a2a, 0.4); }
    // norra kanten mot vattnet (väster om Sjöboden och mellan boden och piren): en ljus list och skugga
    for (let x = dx0 - 1; x < wx0; x++) if (x < SJO_X[0] || x >= SJO_X[1]) { P.px(x, dy0, mix(plankY(x, dy0, 13), WHITE, 0.18)); P.px(x, dy0 - 1, WOOD[1]); P.px(x, dy0 - 2, 0x1a2a2a, 0.35); }
    // överfarten från kajen (en ljusare tröskel där räcket öppnar sig)
    for (let x = wx0; x < wx1; x++) { P.px(x, wy0, WOOD[5]); P.px(x, wy0 + 1, WOOD[4]); }
    // slitna, lite mörkare plankor där folk går (gången längs boden) och en ljus fläck där solen ligger
    for (let x = dx0 + 2; x < wx0; x++) for (let y = LANE - 3; y <= LANE + 2; y++) if (hash(x, y, 77) > 0.55) P.px(x, y, 0x3a2616, 0.06);
  });
}
// räckets stolpar och överliggare: en bit per 12 px (y-sorteras för sig), lyktor på pirens räcke
function railPieces() {
  const [wx0, wy0, wx1] = PIER.walk, [dx0, dy0, dx1, dy1] = PIER.deck, out = [];
  const vRail = (x, ya, yb, lamp) => out.push({ x, y: yb, s: spr(8, yb - ya + 22, 3, yb - ya + 20, (P) => {
    for (let y = ya - yb; y <= 0; y++) { P.px(0, y - 8, WOOD[4]); P.px(1, y - 8, WOOD[2]); }        // överliggaren
    P.vl(0, -10, 10, WOOD[3]); P.vl(1, -10, 10, WOOD[1]);                                           // stolpen
    if (lamp) { P.vl(0, -18, 8, 0x2a2a30); P.rect(-1, -24, 4, 6, 0x2a2a30); P.rect(0, -23, 2, 4, 0xf0e8c0); P.hl(-2, -25, 6, 0x3a3a44); }
  }), lamp: lamp ? [x + 1, yb - 21] : null, refl: true });
  let k = 0;
  for (let y = wy0 + 12; y <= dy0; y += 12, k++) { vRail(wx0 - 1, y - 12, y, k % 3 === 1); vRail(wx1, y - 12, y, k % 3 === 2); }
  for (let y = dy0 + 12; y <= dy1; y += 12, k++) vRail(wx1, y - 12, y, k % 3 === 0);
  for (let y = dy0 + 12; y <= dy1; y += 12) vRail(dx0 - 1, y - 12, y, false);
  vRail(dx0 - 1, dy1 - 12, dy1, false);
  // vågräta räcken: det södra längs bryggans kant (framför allt som står på bryggan) och det norra
  // väster om Sjöboden (bakom bänkarna) och mellan boden och piren
  const hRail = (x, y, len) => out.push({ x: x + 12, y, s: spr(26, 14, 1, 12, (P) => {
    P.hl(0, -9, len, WOOD[4]); P.hl(0, -8, len, WOOD[2]); P.hl(0, -4, len, WOOD[3]);
    for (const px of [0, 12]) if (px < len) { P.vl(px, -10, 10, WOOD[3]); P.vl(px + 1, -10, 10, WOOD[1]); }
  }), x0: x, lamp: null });
  for (let x = dx0; x < dx1; x += 24) hRail(x, dy1, Math.min(24, dx1 - x));
  for (let x = dx0; x < SJO_X[0]; x += 24) hRail(x, dy0 + 1, Math.min(24, SJO_X[0] - x));
  for (let x = SJO_X[1]; x < wx0; x += 24) hRail(x, dy0 + 1, Math.min(24, wx0 - x));
  // fristående lyktstolpar på räckena (de på det södra speglar sig i vattnet nedanför)
  const POST = spr(10, 40, 4, 37, (P) => {
    P.vl(0, -26, 26, 0x2a2a30); P.vl(1, -26, 26, 0x3a3a44);                                      // stolpen
    P.hl(-1, 0, 4, 0x1a1a20); P.hl(-1, -1, 4, 0x2a2a30);                                         // foten
    P.rect(-1, -33, 4, 7, 0x2a2a30); P.rect(0, -32, 2, 5, 0xf0e8c0); P.px(0, -32, 0xfffaf0);       // lyktan
    P.hl(-2, -34, 6, 0x3a3a44); P.hl(-1, -35, 4, 0x3a3a44); P.px(0, -36, 0x4a4a54);               // taket
  });
  for (const x of SLAMPS) out.push({ x, y: dy1 + 0.2, s: POST, lamp: [x + 1, dy1 - 30], refl: true, top: [x + 1, dy1 - 36] });
  for (const x of NLAMPS) out.push({ x, y: dy0 + 1.2, s: POST, lamp: [x + 1, dy0 - 29], refl: false, top: [x + 1, dy0 - 35] });
  return out;
}
// det som hänger: fisknät över det södra räcket, bojar på rep ner mot vattnet, livbojar
function hangingArt() {
  const [dx0, , dx1, dy1] = PIER.deck;
  return spr(dx1 - dx0 + 8, 30, 4, 12, (P) => {
    // näten (rutor) som hänger över kanten mellan två stolpar
    for (const nx of [10, 150, 254, 312]) for (let y = -8; y < 14; y++) for (let x = 0; x < 26; x++) {
      const sag = Math.round(Math.sin((x / 26) * Math.PI) * 4);
      if (y > 6 + sag) continue;
      if ((x + y) % 4 === 0 || (x - y + 40) % 4 === 0) P.px(nx + x, y, mix(0xb8a880, 0x8a7a5a, (y + 8) / 22), 0.85);
    }
    // bojar i rep
    [[44, 0xe8443a], [64, 0xf4d23c], [120, 0xf4f1ea], [190, 0xe8443a], [212, 0xf4d23c], [292, 0xf4f1ea], [350, 0xe8443a]].forEach(([bx, c], i) => {
      const len = 7 + (i % 2) * 4;
      for (let y = -6; y < len; y++) P.px(bx, y, 0xd8c8a0);
      P.ell(bx, len + 2, 2.6, 3, c, 1, 1); P.px(bx - 1, len, mix(c, WHITE, 0.5)); P.hl(bx - 2, len + 2, 5, mul(c, 0.7));
    });
    // livbojarna på räcket
    for (const lx of [dx1 - dx0 - 18, 92]) for (let a = 0; a < 28; a++) { const an = a / 28 * Math.PI * 2; for (const r of [4, 5]) P.px(Math.round(lx + Math.cos(an) * r), Math.round(-3 + Math.sin(an) * r), Math.floor((an / Math.PI) * 2) % 2 ? 0xf4f1ea : 0xe8443a); }
  });
}
// ---------- uteserveringen ----------
// stolarna: vitmålat trä med marinblå dyna. 'down' = stolen bakom bordet (man sitter mot oss),
// 'up' = stolen framför bordet (man sitter med ryggen mot oss – ryggstödet skymmer en)
const CHW = [0x7a7468, 0xa8a296, 0xd0cabe, 0xece8de, 0xfffcf4], CUSH = [0x16243e, 0x2a4a7a, 0x4a6aa0];
function chairArt(facing) {
  return spr(14, 26, 7, 23, (P) => {
    if (facing === 'down') {
      P.vl(-3, -6, 6, CHW[1]); P.vl(3, -6, 6, CHW[0]);                                             // bakre benen (längre bort)
      P.vl(-4, -19, 12, CHW[3]); P.vl(4, -19, 12, CHW[1]); P.px(-4, -20, CHW[4]); P.px(4, -20, CHW[2]);   // ryggstolparna med knoppar
      for (const y of [-18, -15, -12]) { P.hl(-3, y, 7, CHW[3]); P.px(3, y, CHW[2]); }              // spjälorna
      P.hl(-4, -9, 9, CUSH[2]); P.hl(-4, -8, 9, CUSH[1]); P.px(4, -8, CUSH[0]);                      // dynan
      P.hl(-4, -7, 9, CHW[2]); P.px(4, -7, CHW[0]);                                                  // sitsens kant
      P.vl(-4, -6, 7, CHW[3]); P.vl(4, -6, 7, CHW[1]);                                               // främre benen
      P.hl(-3, -3, 7, CHW[1], 0.8);                                                                  // benringen
    } else {
      P.hl(-4, -10, 9, CUSH[1]); P.px(-4, -10, CUSH[2]); P.px(4, -10, CUSH[0]);                      // dynan sticker ut på sidorna
      P.vl(-3, -7, 7, CHW[0]); P.vl(3, -7, 7, CHW[0]);                                               // främre benen (längre bort)
      P.vl(-4, -20, 21, CHW[3]); P.vl(4, -20, 21, CHW[1]); P.px(-4, -21, CHW[4]); P.px(4, -21, CHW[2]);   // ryggstolparna = bakbenen närmast oss
      for (const y of [-19, -16, -13]) { P.hl(-3, y, 7, CHW[2]); P.px(3, y, CHW[1]); }
      P.hl(-3, -9, 7, CHW[1]);                                                                       // sitsens bakkant
      P.hl(-3, -3, 7, CHW[0], 0.8);
    }
    outline(P, 0x2a241c, 0.55);
    for (let x = -4; x <= 5; x++) P.px(x, 1, 0x1a1208, 0.22);                                        // skuggan på plankorna
  });
}
// borden: parasollbord (randigt parasoll, vit skiva) eller Sjöbodens bord (rutig duk och en lykta).
// Dukat för två: tallriken bakåt hör till stolen bakom, den framåt till stolen framför.
function tableArt(canopy, seed) {
  return spr(36, 64, 18, 60, (P) => {
    if (canopy) {
      for (let y = -46; y <= -12; y++) { P.px(0, y, 0xe8e0d0); P.px(1, y, 0xa8a090); }               // stången
      for (let j = 0; j < 9; j++) { const hw = 3 + j * 1.5; for (let i = -Math.round(hw); i <= Math.round(hw); i++) { const s = (Math.floor((i + 40) / 3) & 1); P.px(i, -55 + j, s ? (i > 5 ? 0xd8d4c8 : 0xf4f0e6) : (i > 5 ? mul(canopy, 0.8) : canopy)); } }
      for (let i = -15; i <= 15; i++) if ((i + 40) % 3 !== 1) P.px(i, -46, (Math.floor((i + 40) / 3) & 1) ? 0xd8d4c8 : mul(canopy, 0.7));   // fransen
      P.px(0, -56, 0xf0e8d8); P.px(1, -56, 0xc8b890);
    }
    P.hl(-4, 0, 9, 0x2a2a30); P.hl(-3, -1, 7, 0x4a4a52); P.vl(0, -10, 9, 0x5a5a62); P.vl(1, -10, 9, 0x3a3a42);   // foten och pelaren
    if (canopy) {
      for (let y = -16; y <= -12; y++) for (let x = -10; x <= 10; x++) { const dx = x / 10.4, dy = (y + 14) / 2.6; if (dx * dx + dy * dy <= 1) P.px(x, y, mul(0xf6f3ec, 0.97 - (x + 10) * 0.004 - (y + 16) * 0.02)); }
      for (let x = -9; x <= 9; x++) { P.px(x, -11, x < -6 ? 0xa8a498 : 0x8a867a); P.px(x, -10, 0x3a3630, 0.45); }
    } else {
      const chk = (x, y) => ((((x + 20) >> 1) + ((y + 20) >> 1)) & 1 ? 0xf4f0e6 : 0xc8302a);
      for (let y = -16; y <= -12; y++) for (let x = -11; x <= 11; x++) { const dx = x / 11.4, dy = (y + 14) / 2.6; if (dx * dx + dy * dy <= 1) P.px(x, y, chk(x, y)); }
      for (let y = -11; y <= -7; y++) for (let x = -10 + (y > -9 ? 1 : 0); x <= 10 - (y > -9 ? 1 : 0); x++) P.px(x, y, mul(chk(x, y), 0.84 - (y + 11) * 0.025));   // duken hänger ner
      for (let x = -9; x <= 9; x++) P.px(x, -6, 0x3a1a14, 0.4);
    }
    // dukningen: tallrik bakåt (stolen bakom) och framåt (stolen framför), glas, en flaska
    const dish = (px, py, k) => {
      P.hl(px - 2, py, 5, 0xfafafa); P.hl(px - 1, py + 1, 3, 0xd8d8d8);
      if (k === 0) { P.hl(px - 1, py, 2, 0xd89840); P.px(px + 1, py, 0xf4d23c); }                    // fish & chips
      else if (k === 1) { P.hl(px - 1, py, 3, 0xf49a8a); P.px(px, py, 0xf8c8b8); }                    // räkor
      else { P.hl(px - 1, py, 3, 0xe8b860); }                                                        // soppa
    };
    dish(-5, -15, seed % 3); dish(5, -13, (seed + 1) % 3);
    P.px(-8, -14, 0x9ac8e8); P.px(-8, -15, 0xc8e8f8); P.px(8, -15, 0x9ac8e8); P.px(8, -16, 0xc8e8f8);   // glasen
    if (canopy) { P.vl(3, -18, 3, 0x2a6a3a); P.px(3, -19, 0x1a4a2a); }                                 // en flaska
    else { P.rect(-1, -21, 3, 5, 0x2a2a30); P.rect(0, -20, 1, 3, 0xffe0a0); P.hl(-1, -22, 3, 0x3a3a44); P.px(0, -23, 0x3a3a44); }   // lyktan
  });
}
// bänken vid norra räcket, sedd bakifrån (man sitter vänd mot vattnet bakom räcket)
function benchArt() {
  return spr(34, 28, 16, 24, (P) => {
    for (const x of [-13, 12]) { P.vl(x, -18, 19, 0x2a2a30); P.vl(x + 1, -18, 19, 0x3a3a44); P.px(x, -19, 0x4a4a54); }   // gjutjärnsgavlarna
    [[-17, 0], [-14, 1], [-11, 2]].forEach(([y, k]) => { P.hl(-12, y, 24, mix(WOOD[4], WOOD[3], k * 0.3)); P.hl(-12, y + 1, 24, WOOD[1]); });   // ryggribborna (baksidan)
    P.hl(-13, -7, 27, WOOD[4]); P.hl(-13, -6, 27, WOOD[2]);                                          // sitsens bakkant
    for (const x of [-11, 10]) P.vl(x, -5, 5, 0x2a2a30);                                             // benen
    outline(P, 0x1e1a14, 0.5);
    for (let x = -13; x <= 14; x++) P.px(x, 1, 0x1a1208, 0.22);
  });
}
// däckstolen: trästomme och randig duk, man halvligger mot oss och tittar ut över vattnet
function dackArt(c) {
  return spr(20, 22, 10, 19, (P) => {
    P.line(-4, -10, -8, 0, WOOD[1]); P.line(4, -10, 8, 0, WOOD[0]);                                  // bakre stödet (bakom duken)
    for (let y = -15; y <= -3; y++) {                                                                 // ryggen lutar bakåt: smalare upptill
      const hw = 4 + Math.floor((y + 15) / 5);
      P.px(-hw - 1, y, WOOD[3]); P.px(hw + 1, y, WOOD[1]);                                            // ramens sidor
      for (let x = -hw; x <= hw; x++) { const s = Math.floor(((x + hw) / (2 * hw + 1)) * 5) & 1; P.px(x, y, mul(s ? 0xf4f0e6 : c, y > -6 ? 0.88 : 1)); }   // randiga duken (ränderna följer lutningen)
    }
    P.hl(-5, -16, 11, WOOD[4]); P.hl(-5, -17, 11, WOOD[3]);                                          // överslån
    for (let x = -7; x <= 7; x++) P.px(x, -2, (Math.floor(((x + 7) / 15) * 5) & 1) ? 0xd8d4c8 : mul(c, 0.7));   // duken svackar i sitsen
    P.hl(-8, -1, 17, WOOD[4]); P.vl(-8, -1, 2, WOOD[2]); P.vl(8, -1, 2, WOOD[1]);                     // sitsens framslå och benen
    outline(P, 0x2a241c, 0.5);
    for (let x = -8; x <= 9; x++) P.px(x, 1, 0x1a1208, 0.2);
  });
}
// myntkikaren vid räcket (sedd bakifrån – okularen mot oss, objektiven ut mot vattnet)
function kikareArt() {
  return spr(14, 28, 7, 25, (P) => {
    P.vl(0, -13, 13, 0x3a4a44); P.vl(1, -13, 13, 0x2a3a34); P.hl(-2, 0, 6, 0x2a2a30); P.hl(-1, -1, 4, 0x4a5a54);   // stolpen och foten
    P.rect(-1, -16, 4, 3, 0x2a6a5a); P.rect(0, -15, 2, 1, 0xf4d23c);                                 // myntboxen med inkastet
    P.rect(-4, -22, 10, 6, 0x3a8a7a); P.hl(-4, -22, 10, 0x6ac0b0); P.vl(5, -21, 5, 0x2a6a5a); P.hl(-3, -17, 8, 0x2a6a5a);   // kikarhuvudet
    P.hl(-5, -23, 12, 0x2a6a5a); P.hl(-4, -24, 10, 0x3a8a7a);                                         // regnskärmen
    for (const ox of [-3, 2]) { P.rect(ox, -21, 3, 3, 0x1a2024); P.px(ox, -21, 0x6a7a80); P.px(ox + 1, -20, 0x3a5a70); }   // okularen
    outline(P, 0x1a2420, 0.5);
  });
}
// ett hoprullat rep och ett gammalt ankare på plankorna
function repArt() {
  return spr(30, 14, 15, 10, (P) => {
    P.ell(-7, -3, 5, 2.4, 0xd8c8a0, 1, 1); P.ell(-7, -3, 3.2, 1.5, 0xa89870, 1, 1); P.ell(-7, -3, 1.4, 0.7, 0x6a5a40, 1, 1);
    for (let x = -12; x <= -2; x += 2) P.px(x, -4, 0xe8dcc0);
    P.hl(1, -3, 11, 0x3a3e46); P.hl(1, -4, 11, 0x5a5e66); P.ell(0, -3, 1.6, 1.6, 0x3a3e46, 1, 1);    // ankarlägget
    P.vl(11, -7, 8, 0x3a3e46); P.px(12, -8, 0x3a3e46); P.px(12, 1, 0x3a3e46); P.px(13, -8, 0x5a5e66); P.px(13, 1, 0x5a5e66);   // armarna
    for (let x = -12; x <= 13; x++) P.px(x, 1, 0x1a1208, 0.15);
  });
}
// en fiskmås som sitter (från sidan; s = 1 tittar åt höger), open = skriker
function gullArt(s, open) {
  return spr(16, 12, 8, 10, (P) => {
    const X = (x) => x * s;
    for (let x = -3; x <= 2; x++) { P.px(X(x), -5, 0xf4f4f0); P.px(X(x), -4, 0xe8e8e4); P.px(X(x), -3, 0xd8d8d4); }
    for (let x = -2; x <= 1; x++) P.px(X(x), -6, WHITE);
    for (let x = -5; x <= 0; x++) { P.px(X(x), -5, x < -3 ? 0x2a2a30 : 0x9aa4ae); P.px(X(x), -4, x < -4 ? 0x2a2a30 : 0x8a949e); }   // vingen med svarta spetsar
    P.rect(Math.min(X(2), X(4)), -8, 3, 3, WHITE); P.px(X(3), -7, 0x1a1a1a);                        // huvudet
    P.px(X(5), -7, 0xf4c020); P.px(X(6), -7, 0xf4c020); P.px(X(6), -6, open ? 0xd84020 : 0xf4c020);
    if (open) P.px(X(5), -6, 0xf4c020);
    P.vl(X(-1), -2, 2, 0xe8a060); P.vl(X(1), -2, 2, 0xe8a060);
  });
}
const heartPix = ['.x.x.', 'xxxxx', '.xxx.', '..x..'];
function heart(ctx, x, y, a) {
  heartPix.forEach((row, j) => { for (let i = 0; i < 5; i++) if (row[i] === 'x') { ctx.fillStyle = (j === 1 && i === 1) ? `rgba(255,200,210,${a})` : `rgba(232,67,106,${a})`; ctx.fillRect(Math.round(x) - 2 + i, Math.round(y) + j, 1, 1); } });
}
// ---------- båtarna ----------
// liggande (öst–väst) vid kajen: 0 = roddeka, 1 = snipa, 2 = motorbåt med ruff, 3 = liten segelbåt med mast
function boatH(kind) {
  const L = kind === 2 ? 30 : kind === 3 ? 28 : 24, hull = kind === 0 ? [0x3a2214, 0x5e3a20, 0x86562e] : kind === 3 ? [0x2a3a5a, 0x3a5a8a, 0x5a7ab0] : [0x8a9098, 0xc8ccd4, 0xf4f4f6];
  const inside = kind === 0 ? [0x7a4a26, 0x9a6234] : [0xa8aeb8, 0xd8dce2];
  return spr(2 * L + 8, 40, L + 4, 30, (P) => {
    const top = (x) => -9 + Math.round(Math.pow(Math.abs(x) / L, 2) * 4), bot = (x) => 3 - Math.round(Math.pow(Math.abs(x) / L, 2.2) * 5);
    for (let x = -L; x <= L; x++) {
      const t = top(x), b = bot(x);
      for (let y = t + 1; y < b - 3; y++) P.px(x, y, (y + 40) % 2 && kind === 0 ? inside[0] : inside[1]);
      P.px(x, t, kind === 0 ? WOOD[5] : WHITE); P.px(x, t + 1, mul(hull[1], 0.8));
      for (let y = b - 3; y <= b; y++) { let c = hull[y === b ? 0 : y === b - 1 ? 1 : 2]; if (kind === 1 && y === b - 2) c = 0xc8302a; if (kind === 2 && y === b - 2) c = 0x2a5ad0; if (kind === 0 && (x + 40) % 9 === 0) c = hull[0]; P.px(x, y, c); }
      P.px(x, b - 4, kind === 0 ? WOOD[5] : WHITE);
      P.px(x, b + 1, WATER[0], 0.55);
    }
    if (kind === 0) { for (const x of [-11, 0, 11]) for (let y = top(x) + 1; y < bot(x) - 3; y++) { P.px(x, y, WOOD[5]); P.px(x + 1, y, WOOD[3]); } P.line(-18, -3, 17, -6, WOOD[5]); P.line(-17, -2, 18, -5, WOOD[3]); }
    if (kind === 1) { P.rect(-6, -9, 10, 3, 0x9ac4dc); P.hl(-6, -10, 10, 0xe8f4fa); P.vl(-7, -9, 4, 0x5a6068); P.rect(19, -7, 4, 6, 0x2a2a30); P.px(20, -6, 0xd8303a); P.rect(-16, -5, 7, 2, 0x2a5ad0); }
    if (kind === 2) {                                                                        // ruffen
      P.rect(-10, -18, 18, 10, 0xf4f4f6); P.hl(-10, -18, 18, WHITE); P.vl(7, -17, 9, 0xc8ccd4); P.hl(-12, -19, 22, 0x2a5ad0);
      for (const wx of [-8, -2, 3]) P.rect(wx, -15, 4, 3, 0x6a8ab0); P.px(-7, -15, 0xc8e0f0);
      P.rect(24, -8, 4, 7, 0x2a2a30); P.vl(-24, -12, 6, 0x8a8e96); P.rect(-26, -14, 4, 2, 0xe8443a);         // motorn och flaggstången
    }
    if (kind === 3) {                                                                        // masten med beslagen rulle segel
      P.vl(-2, -30, 22, 0xd8d0c0); P.vl(-1, -30, 22, 0xa8a090); P.line(-2, -30, -22, -4, 0xb8b0a0); P.line(-1, -30, 22, -5, 0xb8b0a0);
      P.rect(-1, -13, 16, 2, 0xf4f0e6); P.hl(-1, -13, 16, WHITE); P.rect(-12, -7, 7, 2, 0xe8443a);
    }
  });
}
// stående (nord–syd) längs piren: fören pekar norrut, aktern mot oss (0 = eka, 1 = snipa med motor)
function boatV(kind) {
  const rim = kind ? WHITE : WOOD[5], side = kind ? [0xc8ccd4, 0x8a9098] : [WOOD[3], WOOD[1]], inner = kind ? [0xb8c4d0, 0x9aa8b8] : [0x9a6234, 0x7a4a26];
  return spr(22, 46, 11, 42, (P) => {
    const hwAt = (y) => { const u = (y + 38) / 38; return u < 0.38 ? Math.max(1, Math.round(7 * Math.sqrt(u / 0.38))) : 7; };
    for (let y = -38; y <= -3; y++) {
      const hw = hwAt(y);
      for (let x = -hw; x <= hw; x++) {
        let c;
        if (Math.abs(x) === hw) c = rim;                                                  // relingen
        else if (Math.abs(x) === hw - 1) c = x > 0 ? side[1] : side[0];                   // bordläggningen
        else c = (y + 40) % 3 === 0 && !kind ? inner[1] : x > 0 ? inner[1] : inner[0];    // durken
        P.px(x, y, c);
      }
      P.px(hw + 1, y, 0x0a1a2a, 0.35);                                                    // skuggan på vattnet
    }
    for (const y of kind ? [-14] : [-28, -18, -9]) { P.hl(-5, y, 11, kind ? 0x2a5ad0 : WOOD[5]); P.hl(-5, y + 1, 11, kind ? 0x1a3a90 : WOOD[2]); }   // tofterna / dynan
    if (kind) { P.rect(-4, -32, 8, 4, 0x9ac4dc); P.hl(-4, -33, 8, 0xe8f4fa); }                                            // vindrutan
    for (let y = -2; y <= 1; y++) for (let x = -7; x <= 7; x++) P.px(x, y, y === -2 ? rim : y === 1 ? side[1] : kind && y === 0 ? 0xc8302a : side[0]);   // akterspegeln
    if (kind) { P.rect(-2, 0, 4, 6, 0x2a2a30); P.hl(-2, 0, 4, 0x5a5e66); P.px(0, 2, 0xd8303a); } else { P.line(-6, -24, 7, -20, WOOD[5]); }        // motorn / en åra
    for (let x = -9; x <= 9; x++) P.px(x, 2 + (kind ? 4 : 0), WATER[4], 0.4);
  });
}
// ---------- delfinen ----------
// Ritas ur en kroppsprofil längs en lutad axel (ang > 0 = nosen uppåt, dir = 1 simmar österut), så att
// varje vinkel blir skarpa pixlar: rygg i blågrått, ljus buk, ryggfena, stjärtfena, nos och öga.
const D_ANG = [0.8, 0.4, 0, -0.4, -0.8];
// kroppens överkant och underkant längs axeln (u = bakåt −, framåt +; v = nedåt +): knubbig torpedkropp,
// rundad panna och en kort nos som sitter lågt
const D_PROF = [[-11, 1.1, 1.1], [-9, 1.7, 1.6], [-6, 2.4, 2.2], [-3, 3.2, 3], [0, 3.6, 3.4], [3, 3.4, 3.3], [5, 2.9, 3], [6.5, 2, 2.6], [7.4, 0.6, 2], [7.6, -0.5, 1.6], [9.6, -0.6, 1.1], [10.2, -0.7, 0.8]];
const dProf = (u) => {
  if (u < D_PROF[0][0] || u > D_PROF[D_PROF.length - 1][0]) return null;
  for (let i = 1; i < D_PROF.length; i++) if (u <= D_PROF[i][0]) { const [u0, t0, b0] = D_PROF[i - 1], [u1, t1, b1] = D_PROF[i], k = (u - u0) / (u1 - u0); return [t0 + (t1 - t0) * k, b0 + (b1 - b0) * k]; }
  return null;
};
function dolphinArt(ang, dir) {
  const ca = Math.cos(ang), sa = Math.sin(ang), dX = dir * ca, dY = -sa, nX = dir * sa, nY = ca;
  const fin = (u) => (u >= -3.2 && u <= -2.2 ? (u + 3.2) * 3.8 : u > -2.2 && u <= 1.6 ? 3.8 * (1.6 - u) / 3.8 : 0);   // ryggfenan, bakåtsvept
  const cls = (u, v) => {
    if (u < -11) { const a = Math.abs(v); return a <= 4.6 && u <= -11 - a * 0.87 && u >= -13.8 - a * 0.27 ? 'fluke' : null; }   // stjärtfenan: två flikar bakåt med ett hack i mitten
    const pr = dProf(u);
    if (!pr) return null;
    const [top, bot] = pr;
    if (v >= -top && v <= bot) { if (u > 6.4 && u < 7.8 && Math.abs(v - 0.9) < 0.5) return 'mouth'; return v < -top * 0.25 ? 'top' : v > bot * 0.35 ? 'belly' : 'mid'; }
    if (v < -top && v >= -top - fin(u)) return 'fin';
    const d = v - bot;
    if (d > 0 && d <= 2.4 && u >= 1.2 + d * 0.9 && u <= 3.6 - d * 0.2) return 'flip';       // bröstfenan
    return null;
  };
  return spr(36, 32, 18, 16, (P) => {
    const W = 36, H = 32, m = new Array(W * H).fill(null);
    for (let y = -16; y < 16; y++) for (let x = -18; x < 18; x++) {
      const u = (x + 0.5) * dX + (y + 0.5) * dY, v = (x + 0.5) * nX + (y + 0.5) * nY;
      m[(y + 16) * W + x + 18] = cls(u, v);
    }
    const at = (x, y) => (x < -18 || y < -16 || x >= 18 || y >= 16 ? null : m[(y + 16) * W + x + 18]);
    const C = { top: 0x4c6078, mid: 0x7890a8, belly: 0xdde5ec, fin: 0x3e5068, fluke: 0x44566e, flip: 0x5e7690, mouth: 0x3a4a5c };
    for (let y = -16; y < 16; y++) for (let x = -18; x < 18; x++) {
      const k = at(x, y);
      if (!k) continue;
      const edge = !at(x - 1, y) || !at(x + 1, y) || !at(x, y - 1) || !at(x, y + 1);
      let c = C[k];
      if (edge) c = k === 'belly' ? 0x8e9eb0 : 0x24303e;
      else if (k === 'top' && !at(x, y - 2)) c = 0x86a0ba;                                    // våt glans längs ryggen
      P.px(x, y, c);
    }
    const ex = Math.round(5.2 * dX - 0.6 * nX - 0.5), ey = Math.round(5.2 * dY - 0.6 * nY - 0.5);   // ögat
    P.px(ex, ey, 0x0e1620); P.px(ex - dir, ey, 0xf4f8fc, 0.6);
  });
}

// ---------- fiskarna ----------
// rod = [handtag x, y, spets x, y] i förhållande till fotpunkten; float = flötets plats i vattnet (dx, y);
// basket = korgens dx; head = var NAPP!-bubblan hamnar
const FISHERS = [
  { id: 'fiskare1', x: -1006, y: Q0 + 9, sitY: 4, rod: [4, -14, 18, -24], float: [24, Q0 + 30], basket: -9, head: -48,
    look: { skin: '#e0a97f', hair: '#a8a8a8', style: 'short', hat: 'bucket', cap: '#4a6a3a', shirt: '#4a6a3a', pants: '#3a3a44', beard: true, build: 6 }, name: 'Fiskar-Folke',
    lines: ['Det nappar bäst på morgonen.', 'Abborren går till i dag!', 'Pst – byt till en röd mask.', 'I går fick jag en gädda så här stor!', 'Har du sett delfinen? Den ger tur, säger de.'] },
  // Saga sitter längst ut på bryggans västra hörn och metar ut mot det öppna vattnet (inte mot båtarna)
  { id: 'fiskare2', x: PIER ? PIER.deck[0] + 12 : 0, y: PIER ? PIER.deck[3] - 10 : 0, sitY: 3, rod: [-3, -12, -22, -25], float: [-34, PIER ? PIER.deck[3] - 16 : 0], basket: 11, head: -42,
    look: { skin: '#c68a5c', hair: '#2a1a12', style: 'ponytail', hat: 'cap', cap: '#e8443a', shirt: '#f4d23c', pants: '#3a6ab0', kid: true, build: 4 }, name: 'Saga',
    lines: ['Jag har fått tre i dag!', 'Krabborna nappar på bacon.', 'Titta, där simmar en!', 'Ser du flötet? Det guppar när det nappar!', 'Pappa säger att delfinen kommer hit ibland.'] },
];
function basketArt() { return spr(14, 12, 7, 10, (P) => { P.rect(-5, -6, 10, 6, 0xb08a50); for (let x = -5; x < 5; x += 2) P.vl(x, -6, 6, 0x8a6a3a); P.hl(-5, -6, 10, 0xd8b480); P.hl(-6, -7, 12, 0x8a6a3a); P.line(-4, -7, 0, -10, 0x8a6a3a); P.line(4, -7, 0, -10, 0x8a6a3a); }); }
function bucketArt() { return spr(10, 10, 5, 9, (P) => { P.rect(-3, -6, 7, 6, 0x6a8ab0); P.hl(-3, -6, 7, 0xa8c8e8); P.vl(3, -5, 5, 0x4a6a90); }); }
// krusningar på vattnet: en ring (ellips) med radien r
function ring(ctx, x, y, r, a, c = '200,238,250') {
  if (a <= 0.02 || r < 1) return;
  ctx.fillStyle = `rgba(${c},${a.toFixed(3)})`;
  const n = Math.max(8, Math.round(r * 4));
  for (let i = 0; i < n; i++) { const an = (i / n) * Math.PI * 2; ctx.fillRect(Math.round(x + Math.cos(an) * r), Math.round(y + Math.sin(an) * r * 0.38), 1, 1); }
}
// flötet: röd topp med antenn, vit kropp, vattenlinjen; guppar och sänder ut ringar (bite = det nappar)
function drawFloat(ctx, x, y, t, bite, seed) {
  const ph = (t * 0.62 + seed * 0.37) % 1;
  ring(ctx, x, y + 1, 1.5 + ph * 7, 0.55 * (1 - ph));
  if (bite) { ring(ctx, x, y + 1, 2 + ((t * 2.4) % 1) * 6, 0.8 * (1 - ((t * 2.4) % 1))); }
  const dy = bite ? (Math.floor(t * 9) % 2 ? 3 : 1) : Math.round(Math.sin(t * 3.4 + seed) * 1.2);
  const fy = y + dy;
  if (fy - 4 <= y) { ctx.fillStyle = '#1a1a1a'; ctx.fillRect(x, fy - 5, 1, 1); }                       // antennen
  ctx.fillStyle = '#e8443a'; if (fy - 4 <= y) ctx.fillRect(x - 1, fy - 4, 3, 2);
  ctx.fillStyle = '#f4f1ea'; if (fy - 2 <= y) ctx.fillRect(x - 1, fy - 2, 3, Math.max(0, Math.min(2, y - (fy - 2))));
  ctx.fillStyle = 'rgba(200,238,250,0.85)'; ctx.fillRect(x - 3, y, 7, 1);                               // vattenlinjen
  ctx.fillStyle = 'rgba(16,58,88,0.45)'; ctx.fillRect(x - 2, y + 1, 5, 1);
}

// ---------- modulen ----------
export function createPier(env) {
  if (!PIER) return { items: () => [], obstacles: [], seats: [], glow() {}, update() {}, fisherAt: () => null, kikareAt: () => null, talks: () => [], takeLuck: () => null, spot: () => false };
  const [wx0, wy0, wx1] = PIER.walk, [dx0, dy0, dx1, dy1] = PIER.deck;
  const PX = Math.round((wx0 + wx1) / 2), QY = Q0 + 1;
  const DECK = deckArt(), RAILS = railPieces(), HANG = hangingArt(), BASKET = basketArt(), BUCKET = bucketArt();
  const BH = [0, 1, 2, 3].map(boatH), BV = [0, 1].map(boatV);
  const CH_D = chairArt('down'), CH_U = chairArt('up'), BENCH = benchArt(), KIKARE = kikareArt(), REP = repArt();
  const DACKS = DACK.map(([, c]) => dackArt(c));
  const GULL = [[gullArt(1, false), gullArt(1, true)], [gullArt(-1, false), gullArt(-1, true)]];
  const BOARD = spr(14, 20, 7, 19, (P) => { P.line(-5, 0, -3, -17, WOOD[2]); P.line(5, 0, 3, -17, WOOD[2]); P.rect(-4, -17, 9, 12, WOOD[3]); P.rect(-3, -16, 7, 10, 0x2a3430); text(P, SMALL, 'FISK', -3, -15, 0xf4f1ea, 0.9); P.hl(-2, -9, 5, 0xf4d23c, 0.9); P.hl(-2, -7, 4, 0xe8e4dc, 0.7); });
  const TRAPS = spr(22, 18, 11, 16, (P) => {
    for (const [ox, oy] of [[-10, 0], [0, 0], [-5, -7]]) {
      P.rect(ox, oy - 7, 10, 7, WOOD[2]); for (let i = ox; i < ox + 10; i += 2) P.vl(i, oy - 6, 5, 0x4a5a3a, 0.8); P.hl(ox, oy - 7, 10, WOOD[4]); P.hl(ox, oy - 4, 10, WOOD[3]);
    }
    P.ell(8, -3, 4, 2, 0xd8c8a0, 1, 1); P.ell(8, -3, 2, 1, 0xa89870, 1, 1);
  });
  // båtarna vid kajen (förtöjda med rep till pollarna på kajen) och längs piren
  const quayBoats = [[-1150, 2], [-1068, 0], [-904, 1], [-770, 3], [-650, 0], [-250, 1], [-120, 2]].map(([x, k]) => ({ x, y: Q0 + 32, k }));
  const pierBoats = [[wx1 + 12, 828, 1], [wx1 + 12, 874, 0], [wx1 + 12, 922, 1]].map(([x, y, k]) => ({ x, y, k }));
  // borden: [x, y, parasollets färg | null], stolen bakom (mot oss) och stolen framför (ryggen mot oss)
  const tables = [...PARASOLS.map(([x, c], i) => ({ x, y: TY, c, img: tableArt(c, i) })), ...DUKAR.map((x, i) => ({ x, y: TY, c: null, img: tableArt(null, i + 2) }))];
  const seats = [], obstacles = [
    [wx0, wy0 + 4, wx0 + 3, dy0], [wx1 - 3, wy0 + 4, wx1, dy1], [dx0, dy1 - 3, dx1, dy1], [dx0, dy0, dx0 + 3, dy1],   // räckena
    [dx1 - 30, dy1 - 10, dx1 - 8, dy1 - 3],                                                     // hummertinorna
    [dx1 - 29, TY + 3, dx1 - 18, TY + 7],                                                       // griffeltavlan
    [KIK.x - 3, KIK.y - 3, KIK.x + 4, KIK.y + 1],                                               // kikaren
    [dx0 + 90, dy1 - 9, dx0 + 112, dy1 - 3],                                                    // repet och ankaret
  ];
  for (const T of tables) {
    const nx = T.x - 5, ny = T.y - 5, sx = T.x + 5, sy = T.y + 11, bench = `pir-bord@${T.x}`;
    obstacles.push([T.x - 9, T.y - 3, T.x + 10, T.y + 1], [nx - 5, ny - 3, nx + 6, ny + 1], [sx - 5, sy - 3, sx + 6, sy + 1]);
    seats.push({ id: `${bench}:0`, kind: 'pir', x: nx, y: ny, dir: 'down', walk: { x: nx, y: LANE + 1 }, hit: [T.x - 12, T.y - 36, T.x + 13, T.y - 2], bench },
      { id: `${bench}:1`, kind: 'pir', x: sx, y: sy - 5, dir: 'up', walk: { x: sx + 11, y: sy - 1 }, hit: [T.x - 12, T.y - 2, T.x + 13, T.y + 14], bench });
  }
  for (const bx of BANKAR) {
    const by = dy0 + 10, bench = `pir-bank@${bx}`;
    obstacles.push([bx - 13, by - 4, bx + 14, by]);
    [bx - 7, bx + 6].forEach((x, i) => seats.push({ id: `${bench}:${i}`, kind: 'bank', x, y: by - 3, dir: 'up', walk: { x, y: LANE + 1 }, hit: [bx - 15, by - 32, bx + 16, by + 3], bench }));
  }
  DACK.forEach(([x]) => {
    const y = dy1 - 7, bench = `pir-dack@${x}`;
    obstacles.push([x - 6, y - 4, x + 7, y + 1]);
    seats.push({ id: `${bench}:0`, kind: 'dack', x, y, dir: 'down', walk: { x, y: y - 10 }, hit: [x - 8, y - 30, x + 9, y + 3], bench });
  });
  FISHERS.forEach((f) => obstacles.push([Math.min(f.x - 6, f.x + f.basket - 6), f.y - 3, Math.max(f.x + 9, f.x + f.basket + 6), f.y + 1]));
  const catchState = FISHERS.map((f, i) => ({ n: 2 + i, next: 6 + i * 9, anim: -1 }));
  const gulls = [{ x: SLAMPS[2] + 1, y: dy1 - 36, s: 0 }, { x: Math.round((SJO_X[0] + SJO_X[1]) / 2), y: (SJO?.base ?? dy0) - 76, s: 1, roof: true }];   // på lyktan och på Sjöbodens takås
  let tAcc = 0;

  // ---------- livet på vattnet: fiskar som hoppar, ibland en delfin ----------
  const inView = (x, y, m = 0) => { const v = env.view; return !!v && x >= v.x + m && x <= v.x + v.w - m && y >= v.y + m && y <= v.y + v.h - m; };
  const wet = (x, y) => CANAL_WATER.some((r) => x >= r[0] + 4 && x < r[2] - 4 && y >= r[1] + 4 && y < r[3] - 2);
  const ZN = [dx0 + 10, Q0 + 50, SJO_X[0] - 10, dy0 - 30];     // framför utsikten (bakom räcket)
  const ZW = [CITY.X0 + 30, Q0 + 70, dx0 - 40, dy1];            // väster om bryggan
  const ZE = [wx1 + 40, Q0 + 60, -60, dy1];                     // öster om piren
  const ZONES = [ZN, ZW, ZE];
  const waterSeen = () => { const v = env.view; return !!v && v.x < -380 && v.y + v.h > Q0 + 40; };
  const jumps = [];
  let jumpNext = 3;
  function spawnJump() {
    for (let k = 0; k < 8; k++) {
      const Z = ZONES[Math.floor(Math.random() * ZONES.length)];
      const x = Z[0] + Math.random() * (Z[2] - Z[0]), y = Z[1] + Math.random() * (Z[3] - Z[1]);
      if (inView(x, y, 8) && wet(x, y) && wet(x + 16, y) && wet(x - 16, y)) { jumps.push({ x, y, dir: Math.random() < 0.5 ? 1 : -1, t: 0, big: Math.random() < 0.25 }); return true; }
    }
    return false;
  }
  let dol = null, dolNext = 45 + Math.random() * 45, dolCool = 0, luck = null, react = 0, saidMe = 0;
  const JUMP = 1.3, GAP = 0.55, STEP = 36, SWIM = 14;
  let DOL = null;                                              // spritarna ritas först när delfinen syns första gången
  const dolSprites = () => DOL || (DOL = [1, -1].map((d) => D_ANG.map((a) => dolphinArt(a, d))));
  function startDolphin(zone, delay = 0) {
    const span = 3 * STEP + 2 * SWIM;
    const cand = zone ? [zone] : ZONES.filter((Z) => inView((Z[0] + Z[2]) / 2, (Z[1] + Z[3]) / 2) || inView(Z[0] + 60, Z[1] + 30) || inView(Z[2] - 60, Z[1] + 30));
    for (let k = 0; k < 10 && cand.length; k++) {
      const Z = cand[Math.floor(Math.random() * cand.length)], dir = Math.random() < 0.5 ? 1 : -1;
      const room = Math.max(1, Z[2] - Z[0] - span), x0 = dir > 0 ? Z[0] + Math.random() * room : Z[2] - Math.random() * room;
      const y0 = Z[1] + 12 + Math.random() * Math.max(1, Z[3] - Z[1] - 12);
      if (!wet(x0, y0) || !wet(x0 + dir * span, y0)) continue;
      if (!zone && !inView(x0 + dir * span / 2, y0 - 8)) continue;
      dol = { x0, y0, dir, t: -delay, seen: false };
      return true;
    }
    return false;
  }
  // var delfinen är nu: { x, y (vattenlinjen), air (0–1 i hoppet) | null, k (hopp nr) }
  function dolPos(d) {
    const per = JUMP + GAP, k = Math.min(2, Math.floor(Math.max(0, d.t) / per)), u = Math.max(0, d.t) - k * per;
    const base = d.x0 + d.dir * k * (STEP + SWIM);
    if (u < JUMP) return { x: base + d.dir * STEP * (u / JUMP), y: d.y0, air: u / JUMP, k };
    return { x: base + d.dir * (STEP + SWIM * ((u - JUMP) / GAP)), y: d.y0, air: null, k };
  }
  const LUCK_SAY = { kid: '🐬 EN DELFIN!', vuxen: 'Det ger tur! 🍀' };
  function sawDolphin(p) {
    luck = { x: Math.round(p.x), y: Math.round(p.y) };
    react = 3.8; saidMe = 3.4;
    if (cp.st !== 'away') { cp.hug = 3.8; cp.hearts.push({ x: cp.x, y: cp.y - 36, t: 0 }); }
  }

  // ---------- kärleksparet ----------
  const PAR = [
    { skin: '#f0c8a0', hair: '#c8803a', style: 'long', shirt: '#e8607a', pants: '#3a4a6a', build: 5 },
    { skin: '#8a5a3c', hair: '#1a1210', style: 'short', shirt: '#3a7ab0', pants: '#4a4a52', build: 6 },
  ];
  const SPOT_Y = dy0 + 6;
  const pathIn = (sx) => [[sx, QY], [PX, QY], [PX, LANE], [SPOT, LANE], [SPOT, SPOT_Y]];
  const cp = { st: 'away', t: 0, wait: 12 + Math.random() * 20, path: [], x: 0, y: 0, dir: 'down', from: -700, hug: 0, hearts: [], heartT: 0 };
  function walkAlong(o, dt, sp) {
    let step = sp * dt;
    while (step > 0 && o.path.length) {
      const [gx, gy] = o.path[0], dx = gx - o.x, dy = gy - o.y, d = Math.hypot(dx, dy);
      if (d > 0.01) o.dir = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : dy < 0 ? 'up' : 'down';
      if (d <= step) { o.x = gx; o.y = gy; o.path.shift(); step -= d; } else { o.x += dx / d * step; o.y += dy / d * step; step = 0; }
    }
    return o.path.length === 0;
  }
  const looseSeen = (x, y) => { const v = env.view; return !!v && x > v.x - 30 && x < v.x + v.w + 30 && y > v.y - 10 && y < v.y + v.h + 40; };
  function updCouple(dt) {
    for (const h of cp.hearts) h.t += dt;
    while (cp.hearts.length && cp.hearts[0].t > 1.8) cp.hearts.shift();
    if (cp.hug > 0) { cp.hug -= dt; if ((cp.heartT += dt) > 0.6) { cp.heartT = 0; cp.hearts.push({ x: cp.x + (Math.random() - 0.5) * 6, y: cp.y - 36, t: 0 }); } return; }
    cp.t += dt;
    const h = env.hour ?? 12;
    if (cp.st === 'away') {
      if (cp.t < cp.wait || h < 8) return;
      const sx = [-700, -1180].find((x) => !looseSeen(x, QY));
      if (sx === undefined) return;
      Object.assign(cp, { st: 'in', t: 0, path: pathIn(sx), x: sx, y: QY, from: sx });
      return;
    }
    if (cp.st === 'in' || cp.st === 'out') {
      if (!walkAlong(cp, dt, 17)) return;
      if (cp.st === 'in') { cp.st = 'kiss'; cp.t = 0; return; }
      if (!looseSeen(cp.x, cp.y) || cp.x <= -1180) { Object.assign(cp, { st: 'away', t: 0, wait: 35 + Math.random() * 55 }); return; }
      cp.path = [[-1180, QY]];                                                                 // någon ser på – gå vidare längs kajen
      return;
    }
    if (cp.st === 'kiss') {
      if (cp.t > 1.3 && cp.t < 4.6 && (cp.heartT += dt) > 0.42) { cp.heartT = 0; cp.hearts.push({ x: cp.x + (Math.random() - 0.5) * 4, y: cp.y - 34, t: 0 }); }
      if (cp.t > 5.6) { cp.st = 'view'; cp.t = 0; }
    } else if (cp.st === 'view') {
      if ((cp.heartT += dt) > 2.4) { cp.heartT = 0; cp.hearts.push({ x: cp.x, y: cp.y - 36, t: 0 }); }
      if (cp.t > 14) { cp.st = 'out'; cp.t = 0; cp.path = pathIn(cp.from).reverse().slice(1); }
    }
  }
  // de två figurerna just nu: [{ x, y, dir, fr, look }, …] + om de håller hand / kramas
  function couplePose(t) {
    const walking = (cp.st === 'in' || cp.st === 'out') && cp.hug <= 0;
    const f0 = walking ? [1, 3, 2, 3][Math.floor(t * 6) % 4] : 0, f1 = walking ? [1, 3, 2, 3][(Math.floor(t * 6) + 2) % 4] : 0;
    if (cp.hug > 0 || cp.st === 'kiss') {
      const close = cp.hug > 0 ? 3 : cp.t < 1.1 ? 6 : 4, eyes = cp.hug <= 0 && cp.t >= 1.1 && cp.t < 4.6 ? 4 : 0;
      return { a: { x: cp.x - close, y: cp.y, dir: 'right', fr: eyes }, b: { x: cp.x + close, y: cp.y + 0.1, dir: 'left', fr: eyes }, hug: cp.hug > 0 || eyes > 0, hand: false };
    }
    if (walking && (cp.dir === 'left' || cp.dir === 'right')) {
      const s = cp.dir === 'right' ? 1 : -1;
      return { a: { x: cp.x - 3 * s, y: cp.y - 3, dir: cp.dir, fr: f0 }, b: { x: cp.x + 3 * s, y: cp.y + 2, dir: cp.dir, fr: f1 }, hug: false, hand: false };   // bredvid varandra (en lite närmare oss)
    }
    const dir = cp.st === 'view' ? 'up' : cp.dir;
    return { a: { x: cp.x - 5, y: cp.y, dir, fr: f0 }, b: { x: cp.x + 5, y: cp.y + 0.1, dir, fr: f1 }, hug: false, hand: true };
  }
  function coupleItems(out, t) {
    if (cp.st === 'away') return;
    const P = couplePose(t);
    out.push({ x: P.a.x, y: P.a.y, draw: (ctx) => drawPerson(ctx, P.a.x, P.a.y, PAR[0], P.a.dir, P.a.fr) });
    out.push({ x: P.b.x, y: P.b.y, draw: (ctx) => {
      drawPerson(ctx, P.b.x, P.b.y, PAR[1], P.b.dir, P.b.fr);
      const y = Math.round(cp.y), cx = Math.round(cp.x);
      if (P.hand) {                                                                          // händerna möts mellan dem
        ctx.fillStyle = PAR[0].skin; ctx.fillRect(cx - 2, y - 13, 2, 2);
        ctx.fillStyle = PAR[1].skin; ctx.fillRect(cx, y - 13, 2, 2);
      } else if (P.hug) {                                                                    // armarna om varandra
        const ax = Math.round(P.a.x), bx = Math.round(P.b.x);
        ctx.fillStyle = PAR[1].shirt; ctx.fillRect(ax - 3, y - 18, bx - ax + 1, 2);
        ctx.fillStyle = PAR[1].skin; ctx.fillRect(ax - 4, y - 18, 2, 2);
        ctx.fillStyle = PAR[0].shirt; ctx.fillRect(ax + 2, y - 14, bx - ax + 1, 2);
        ctx.fillStyle = PAR[0].skin; ctx.fillRect(bx + 3, y - 14, 2, 2);
      }
    } });
    if (cp.hearts.length) out.push({ x: cp.x, y: cp.y + 0.3, draw: (ctx) => { for (const h of cp.hearts) heart(ctx, h.x + Math.sin(h.t * 4 + h.x) * 1.5, h.y - h.t * 10, Math.max(0, 1 - h.t / 1.8)); } });
  }

  // ---------- ritningen ----------
  const items = () => {
    const t = env.t || 0, out = [];
    out.push({ y: wy0 - 1, draw: (ctx) => put(ctx, DECK, 0, 0) });
    for (const r of RAILS) out.push({ x: r.x, y: r.y, draw: (ctx) => put(ctx, r.s, r.x0 ?? r.x, Math.floor(r.y)) });
    out.push({ x: (dx0 + dx1) / 2, y: dy1 + 1, draw: (ctx) => put(ctx, HANG, dx0, dy1) });
    // båtarna: guppar, repen spänns ner till pollarna på kajen
    for (const b of quayBoats) out.push({ x: b.x, y: b.y + 6, draw: (ctx) => {
      const bob = Math.round(Math.sin(t * 1.1 + b.x * 0.07) * 1.2), s = BH[b.k];
      ctx.fillStyle = '#d8c8a0';
      for (const [ax, bx] of [[b.x - 18, b.x - 28], [b.x + 18, b.x + 26]]) { const y0 = Q0 + 6, y1 = b.y - 6 + bob, n = 12; for (let i = 0; i <= n; i++) { const u = i / n; ctx.fillRect(Math.round(bx + (ax - bx) * u), Math.round(y0 + (y1 - y0) * u + Math.sin(u * Math.PI) * 2), 1, 1); } }
      put(ctx, s, b.x, b.y + bob);
    } });
    for (const b of pierBoats) out.push({ x: b.x, y: b.y, draw: (ctx) => {
      const bob = Math.round(Math.sin(t * 1.3 + b.y * 0.1) * 1);
      ctx.fillStyle = '#d8c8a0'; const px = b.x < wx0 ? wx0 - 1 : wx1, py = b.y - 30 + bob; for (let i = 0; i <= 6; i++) ctx.fillRect(Math.round(px + (b.x - px) * i / 6), Math.round(py + Math.sin(i / 6 * Math.PI)), 1, 1);
      put(ctx, BV[b.k], b.x, b.y + bob);
    } });
    // uteserveringen: stolen bakom ritas före den som sitter där, bordet efter (skivan skymmer knäna),
    // stolen framför efter den som sitter med ryggen mot oss
    for (const T of tables) {
      out.push({ x: T.x - 5, y: T.y - 5.5, draw: (ctx) => put(ctx, CH_D, T.x - 5, T.y - 5) });
      out.push({ x: T.x, y: T.y, draw: (ctx) => put(ctx, T.img, T.x, T.y) });
      out.push({ x: T.x + 5, y: T.y + 11, draw: (ctx) => put(ctx, CH_U, T.x + 5, T.y + 11) });
    }
    for (const bx of BANKAR) out.push({ x: bx, y: dy0 + 10, draw: (ctx) => put(ctx, BENCH, bx, dy0 + 10) });
    DACK.forEach(([x], i) => out.push({ x, y: dy1 - 7.5, draw: (ctx) => put(ctx, DACKS[i], x, dy1 - 7) }));
    out.push({ x: KIK.x, y: KIK.y, draw: (ctx) => put(ctx, KIKARE, KIK.x, KIK.y) });
    out.push({ x: dx0 + 101, y: dy1 - 4, draw: (ctx) => put(ctx, REP, dx0 + 101, dy1 - 4) });
    out.push({ x: dx1 - 20, y: dy1 - 3, draw: (ctx) => put(ctx, TRAPS, dx1 - 20, dy1 - 3) });
    out.push({ x: dx1 - 24, y: TY + 7, draw: (ctx) => put(ctx, BOARD, dx1 - 24, TY + 7) });
    // fiskmåsarna: vänder på huvudet då och då och skriker ibland
    for (const g of gulls) out.push({ x: g.x, y: g.roof ? 898.6 : dy1 + 0.4, draw: (ctx) => {
      const k = Math.floor(t / 5 + g.x), side = (hash(k, 3, 41) > 0.5 ? 1 : 0) ^ g.s, open = (t + g.x * 0.13) % 9 < 0.8;
      put(ctx, GULL[side][open ? 1 : 0], g.x, g.y);
    } });
    // fiskarna: spö, lina, flöte som guppar, korgen – då och då nappar det och fisken landar i korgen
    FISHERS.forEach((f, i) => {
      const st = catchState[i];
      out.push({ x: f.x, y: f.y, draw: (ctx) => {
        const cheer = react > 0, kidUp = cheer && f.look.kid;
        put(ctx, BUCKET, f.x, f.y);
        drawPerson(ctx, f.x, f.y - f.sitY - (kidUp ? Math.round(Math.abs(Math.sin(t * 7)) * 3) : 0), f.look, 'down', kidUp ? 10 : cheer ? 11 : 5);   // Saga hoppar av glädje
        const kx = f.x + f.basket;
        put(ctx, BASKET, kx, f.y + 1);
        for (let k = 0; k < Math.min(5, st.n); k++) { ctx.fillStyle = k % 2 ? '#8a9ab0' : '#a8b8c8'; ctx.fillRect(kx - 4 + k * 2, f.y - 6 - (k & 1), 3, 1); }
        // spöet (böjer sig när det nappar), linan och flötet
        const a = st.anim, bite = a >= 0 && a < 1.2, fly = a >= 1.2 && a < 2.2, s = Math.sign(f.rod[2]) || 1;
        const hx = f.x + f.rod[0], hy = f.y + f.rod[1], tipX = f.x + f.rod[2], tipY = f.y + f.rod[3] + (bite ? 4 : 0);
        ctx.fillStyle = '#6a4a2a'; const n = 16; for (let k = 0; k <= n; k++) { const u = k / n; ctx.fillRect(Math.round(hx + (tipX - hx) * u), Math.round(hy + (tipY - hy) * u + (bite ? u * u * 3 : 0)), 1, 1); }
        ctx.fillStyle = '#c8b890'; ctx.fillRect(hx - (s > 0 ? 1 : 0), hy, 2, 1);                       // rullen
        const bx = f.x + f.float[0], by = f.float[1];
        ctx.fillStyle = 'rgba(240,240,240,0.7)'; for (let k = 0; k <= 12; k++) { const u = k / 12; ctx.fillRect(Math.round(tipX + (bx - tipX) * u), Math.round(tipY + (by - 4 - tipY) * u + Math.sin(u * Math.PI) * 2), 1, 1); }
        if (!fly) drawFloat(ctx, bx, by, t, bite, i * 1.7);
        if (fly) {                                                                           // fisken flyger upp och ner i korgen
          const u = a - 1.2, fx = bx + (kx - bx) * u, fy = by + (f.y - 8 - by) * u - Math.sin(u * Math.PI) * 18, flap = Math.floor(t * 12) % 2;
          ctx.fillStyle = '#a8b8c8'; ctx.fillRect(Math.round(fx) - 2, Math.round(fy), 5, 2); ctx.fillStyle = '#6a7a90'; ctx.fillRect(Math.round(fx) + (flap ? 3 : -3), Math.round(fy) - (flap ? 1 : 0), 1, 2);
          ctx.fillStyle = '#c8e8f8'; ctx.fillRect(Math.round(fx) - 1, Math.round(fy), 1, 1);
          if (u < 0.3) ring(ctx, bx, by + 1, 2 + u * 20, 0.8 - u * 2);
        }
        if (a >= 0 && a < 2.4 && !cheer) { const s2 = fly ? 'JAA!' : 'NAPP!', w = textW(SMALL, s2) + 6, x = f.x - (w >> 1), y = f.y + f.head; ctx.fillStyle = '#1e1a24'; ctx.fillRect(x - 1, y, w + 2, 12); ctx.fillStyle = '#fff6d8'; ctx.fillRect(x, y + 1, w, 10); ctxText(ctx, SMALL, s2, x + 3, y + 4, '#8a2a1a'); }
      } });
    });
    // fiskarna som hoppar (ritas vid vattenlinjen: det som står närmare oss skymmer dem)
    for (const j of jumps) out.push({ x: j.x, y: j.y, draw: (ctx) => {
      const u = j.t / (j.big ? 0.95 : 0.75), L = j.big ? 16 : 12, H = j.big ? 11 : 8;
      if (u < 0.22) ring(ctx, j.x, j.y, 1 + u * 14, 0.7 - u * 2);
      if (u > 0.8) ring(ctx, j.x + j.dir * L, j.y, 1 + (u - 0.8) * 30, 0.8 - (u - 0.8) * 2.5);
      if (u <= 0 || u >= 1) return;
      const x = j.x + j.dir * L * u, y = j.y - H * Math.sin(Math.PI * u), sl = Math.cos(Math.PI * u);   // lutningen: uppåt först, sen nedåt
      const n = j.big ? 3 : 2;
      for (let k = -n; k <= n; k++) {
        const px = Math.round(x + j.dir * k), py = Math.round(y - k * sl * 0.9);
        ctx.fillStyle = k === -n ? '#5a6a80' : k === n ? '#c8d8e8' : k % 2 ? '#9ab0c4' : '#b8c8d8'; ctx.fillRect(px, py, 1, 1);
        if (Math.abs(k) < n) { ctx.fillStyle = '#e8f0f8'; ctx.fillRect(px, py + 1, 1, 1); }
      }
      ctx.fillStyle = '#5a6a80'; ctx.fillRect(Math.round(x - j.dir * (n + 1)), Math.round(y + (n + 1) * sl * 0.9) - 1, 1, 3);   // stjärten
      if (u < 0.35) { ctx.fillStyle = 'rgba(220,244,252,0.8)'; for (let k = 0; k < 3; k++) ctx.fillRect(Math.round(j.x + (k - 1) * 2), Math.round(j.y - u * 14 - k), 1, 1); }
    } });
    // delfinen: tre hopp i rad, ryggfenan skär genom vattnet mellan hoppen
    if (dol && dol.t >= 0) {
      const p = dolPos(dol);
      out.push({ x: p.x, y: dol.y0 + 0.5, draw: (ctx) => {
        const y0 = dol.y0;
        if (p.air !== null) {
          const s = p.air, x = p.x, y = y0 + 4 - 17 * Math.sin(Math.PI * s);
          const ang = Math.atan2(17 * Math.PI * Math.cos(Math.PI * s), STEP) * 0.85;
          let bi = 0, bd = 9; D_ANG.forEach((a, i) => { if (Math.abs(a - ang) < bd) { bd = Math.abs(a - ang); bi = i; } });
          ctx.save(); ctx.beginPath(); ctx.rect(x - 24, y0 - 50, 48, 50 + 1); ctx.clip();
          put(ctx, dolSprites()[dol.dir > 0 ? 0 : 1][bi], x, y);
          ctx.restore();
          if (s < 0.25) { ring(ctx, p.x - dol.dir * STEP * s, y0 + 1, 2 + s * 30, 0.85 - s * 3); ctx.fillStyle = 'rgba(232,248,255,0.9)'; for (let k = 0; k < 6; k++) ctx.fillRect(Math.round(p.x - dol.dir * (STEP * s + 2) + (k - 3) * 2), Math.round(y0 - s * 30 - (k % 3) * 2), 1, 1); }
          if (s > 0.78) { const e = s - 0.78; ring(ctx, x + dol.dir * 4, y0 + 1, 2 + e * 40, 0.9 - e * 3.5); ctx.fillStyle = 'rgba(232,248,255,0.9)'; for (let k = 0; k < 7; k++) ctx.fillRect(Math.round(x + dol.dir * 4 + (k - 3) * 2), Math.round(y0 - 2 - e * 26 - (k % 2) * 3), 1, 1); }
        } else {                                                                             // fenan i ytan, svallvåg bakom
          const x = Math.round(p.x);
          ctx.fillStyle = '#3a4a5e'; for (let k = 0; k < 4; k++) ctx.fillRect(x - dol.dir * (k > 1 ? 1 : 0), y0 - 4 + k, 1 + (k > 1 ? 1 : 0) + (k > 2 ? 1 : 0), 1);
          ctx.fillStyle = 'rgba(220,244,252,0.8)'; for (let k = 1; k < 9; k++) ctx.fillRect(x - dol.dir * k * 2, y0 + (k % 2), 1, 1);
        }
      } });
    }
    coupleItems(out, t);
    return out;
  };
  function glow(ctx, view) {
    const k = Math.max(0, Math.min(1, ((env.dark || 0) - 0.1) / 0.28));
    if (k <= 0 || !view || view.x > dx1 + 60 || view.x + view.w < dx0 - 700 || view.y + view.h < Q0 - 40) return;
    const t = env.t || 0;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (const r of RAILS) if (r.lamp) {
      const [x, y] = r.lamp, f = 0.85 + 0.15 * Math.sin(t * 3 + x);
      ctx.fillStyle = rgba(0xffe0a0, 0.9 * k * f); ctx.fillRect(x - 1, y, 2, 4);
      ctx.fillStyle = rgba(0xffc070, 0.18 * k * f); ctx.fillRect(x - 6, y - 4, 12, 12);
      ctx.fillStyle = rgba(0xffc070, 0.12 * k); ctx.fillRect(x - 9, y + 26, 18, 5);       // ljuspöl på plankorna
    }
    // ljusslingor mellan parasollen och fram till Sjöbodens vägg
    const pts = [[PARASOLS[0][0] - 16, TY - 50], ...PARASOLS.map(([x]) => [x, TY - 56]), [SJO_X[0] - 1, TY - 62]];
    for (let s = 0; s + 1 < pts.length; s++) {
      const [ax, ay] = pts[s], [bx, by] = pts[s + 1];
      for (let x = ax; x <= bx; x += 4) { const u = (x - ax) / Math.max(1, bx - ax), y = Math.round(ay + (by - ay) * u + Math.sin(u * Math.PI) * 5), tw = 0.7 + 0.3 * Math.sin(t * 2 + x); ctx.fillStyle = rgba(0xffd070, 0.85 * k * tw); ctx.fillRect(x, y, 1, 1); ctx.fillStyle = rgba(0xffb050, 0.15 * k); ctx.fillRect(x - 1, y - 1, 3, 3); }
    }
    // lyktorna på Sjöbodens bord fladdrar
    for (const x of DUKAR) { const f = 0.75 + 0.25 * Math.sin(t * 9 + x) * Math.sin(t * 5.3); ctx.fillStyle = rgba(0xffe0a0, 0.9 * k * f); ctx.fillRect(x, TY - 20, 1, 3); ctx.fillStyle = rgba(0xffb060, 0.2 * k * f); ctx.fillRect(x - 6, TY - 25, 13, 12); }
    // lyktorna speglar sig i vattnet (de på pirens och bryggans södra räcke)
    for (const r of RAILS) if (r.lamp && r.refl) { const [x, y] = r.lamp, off = r.top ? 38 : 34; for (let j = 0; j < 6; j++) { ctx.fillStyle = rgba(0xffd090, 0.14 * k * (1 - j / 6)); ctx.fillRect(x - 1 + Math.round(Math.sin(t * 2 + j) * 1), y + off + j * 2, 3, 1); } }
    ctx.restore();
  }
  function fisherAt(x, y) {
    for (const f of FISHERS) if (x >= f.x - 16 && x < f.x + 16 && y >= f.y - 34 && y < f.y + 6) return { ...f, walk: f.look.kid ? { x: f.x + 4, y: f.y - 11 } : { x: f.x - 18, y: f.y + 2 } };
    return null;
  }
  function kikareAt(x, y) { return x >= KIK.x - 6 && x < KIK.x + 7 && y >= KIK.y - 27 && y < KIK.y + 3 ? { walk: { x: KIK.x, y: LANE + 1 } } : null; }
  return {
    items, obstacles, seats, glow, fisherAt, kikareAt,
    // bubblorna ovanför pirens eget folk (city.js ritar dem överst, som fotgängarnas)
    talks() {
      const out = [];
      if (react > 0) {
        for (const f of FISHERS) if (inView(f.x, f.y)) out.push({ x: f.x, y: f.y + f.head + 2, text: f.look.kid ? LUCK_SAY.kid : LUCK_SAY.vuxen });
        if (cp.hug > 0 && cp.st !== 'away') out.push({ x: Math.round(cp.x), y: Math.round(cp.y) - 38, text: '🤗 Det ger tur!' });
      }
      if (saidMe > 0 && env.player) out.push({ x: Math.round(env.player.x), y: Math.round(env.player.y) - 38, text: '😍🐬' });
      return out;
    },
    // spelaren har sett delfinen (en gång per delfin) → { x, y } – city.js ger lyckan
    takeLuck() { const l = luck; luck = null; return l; },
    // myntkikaren: ibland syns delfinen alldeles framför utsikten (högst en gång per 45 s)
    spot() {
      if (dol || dolCool > 0) return false;
      dolCool = 45;
      if (Math.random() > 0.5) return false;
      return startDolphin(ZN, 1.4);
    },
    update(dt) {
      dt = Math.min(0.1, Math.max(0, dt || 0));
      tAcc += dt;
      catchState.forEach((st, i) => {
        if (st.anim >= 0) { st.anim += dt; if (st.anim >= 2.4) { st.anim = -1; st.n = st.n >= 6 ? 2 : st.n + 1; st.next = tAcc + 18 + hash(i, Math.floor(tAcc), 5) * 20; } }
        else if (tAcc >= st.next) st.anim = 0;
      });
      if (react > 0) react -= dt;
      if (saidMe > 0) saidMe -= dt;
      if (dolCool > 0) dolCool -= dt;
      for (const j of jumps) j.t += dt;
      while (jumps.length && jumps[0].t > 1.3) jumps.shift();
      const seenW = waterSeen();
      if (seenW && (jumpNext -= dt) <= 0) { jumpNext = 2.2 + Math.random() * 3.8; spawnJump(); }
      if (dol) {
        dol.t += dt;
        const p = dolPos(dol);
        if (!dol.seen && p.air !== null && p.air > 0.15 && p.air < 0.85 && inView(p.x, dol.y0 - 10, 4)) { dol.seen = true; sawDolphin(p); }
        if (dol.t > 3 * (JUMP + GAP)) { dol = null; dolNext = 110 + Math.random() * 130; }
      } else if (seenW && (env.hour ?? 12) >= 6 && (env.hour ?? 12) < 21.5 && (dolNext -= dt) <= 0) {
        if (!startDolphin()) dolNext = 4;
      }
      updCouple(dt);
    },
    _debug: {
      dolphin: (zone) => startDolphin(zone === 'n' ? ZN : zone === 'w' ? ZW : zone === 'e' ? ZE : null),
      dolphinState: () => (dol ? { ...dolPos(dol), seen: dol.seen, t: dol.t } : null),
      jumps: () => jumps.length,
      couple: () => ({ st: cp.st, x: Math.round(cp.x), y: Math.round(cp.y), hug: cp.hug > 0 }),
      coupleNow: (st = 'in') => { if (st === 'kiss' || st === 'view') Object.assign(cp, { st, t: 0, x: SPOT, y: SPOT_Y, path: [], from: -700 }); else Object.assign(cp, { st: 'in', t: 0, path: pathIn(-700), x: -700, y: QY, from: -700 }); },
      reactions: () => react > 0,
    },
  };
}

// ---------- Sjöbodens meny ----------
const KROG = [
  { id: 'fishchips', icon: '🐟', namn: 'Fish and chips med remouladsås', pris: 69, matt: 30, glad: 2 },
  { id: 'raksmorgas', icon: '🦐', namn: 'Räksmörgås på rågbröd', pris: 85, matt: 25, glad: 4 },
  { id: 'fisksoppa', icon: '🍲', namn: 'Fisksoppa med aioli', pris: 79, matt: 32, glad: 3 },
  { id: 'sill', icon: '🥔', namn: 'Inlagd sill med färskpotatis', pris: 59, matt: 28, glad: 2 },
  { id: 'hjortron', icon: '🍨', namn: 'Vaniljglass med varma hjortron', pris: 39, matt: 6, glad: 3 },
];
export function openKrog(A) {
  const g = A.game;
  const rows = KROG.map((m) => `<div class="prow shoprow"><span style="font-size:28px;text-align:center">${m.icon}</span>
      <span class="nm">${esc(m.namn)}<br><small class="sp">+${m.matt} mätthet · 😊 lycka · en halvtimme på bryggan</small></span>
      <button class="btn btn-small ${g.money >= m.pris ? 'btn-go' : ''}" data-krog="${m.id}" ${g.money >= m.pris ? '' : 'disabled'}>${m.pris} kr</button></div>`).join('');
  const dlg = openModal('🐟 Sjöboden', `<p style="font-size:var(--f2);margin-top:0">Fisk och skaldjur på bryggan – sätt dig under ett parasoll och titta på båtarna.<br>💰 <b>${g.money} kr</b></p><div class="plist">${rows}</div>`,
    [{ label: 'Inte nu', onClick: closeModal }]);
  dlg.querySelectorAll('[data-krog]').forEach((b) => (b.onclick = () => {
    const m = KROG.find((x) => x.id === b.dataset.krog);
    if (!m || g.money < m.pris) { play('fel'); toast('💸 Du har inte råd med den.', 'bad'); return; }
    g.money -= m.pris;
    g.hunger = Math.min(100, g.hunger + m.matt);
    g.glad?.(m.glad, 'Sjöboden', 'sjoboden', 8);
    g.passTime(30); g.save();
    closeModal(); play('coin');
    toast(`${m.icon} Mums! ${m.namn} ute på bryggan – måsarna skriker och båtarna guppar. 😊`, 'good');
  }));
}
// ---------- fiskarna ----------
export function talkFisher(A, f) {
  const g = A.game, line = f.lines[Math.floor(Math.random() * f.lines.length)];
  if (f.look?.kid) { toast(`🎣 ${f.name}: "${line}"`); return; }
  const fisk = ravaraOf('fisk'), pris = 30, full = (g.skafferi?.fisk | 0) >= MAX_RAVA;
  openModal(`🎣 ${esc(f.name)}`, `<p style="font-size:var(--f2);margin-top:0">"${esc(line)}"<br>Vill du köpa en nyfångad abborre? Den blir fiskfilé i skafferiet.<br>💰 <b>${g.money} kr</b></p>`, [
    { label: 'Nej tack', onClick: closeModal },
    { label: full ? 'Skafferiet är fullt' : `🐟 Köp en (${pris} kr)`, cls: g.money >= pris && !full ? 'btn-go' : '', onClick: () => {
      closeModal();
      if (full) return;
      if (g.money < pris) { play('fel'); toast('💸 Du har inte råd.', 'bad'); return; }
      g.money -= pris; g.skafferi.fisk = (g.skafferi.fisk | 0) + 1; g.save();
      play('coin'); toast(`${fisk?.icon || '🐟'} ${f.name} lindar in abborren i tidningspapper – den ligger i skafferiet.`, 'good');
    } },
  ]);
}
// ---------- myntkikaren ----------
const KIKARE_MISS = [
  '🔭 Bara måsar … och en gammal gummistövel som flyter förbi.',
  '🔭 Du ser ända bort till fyren. Inga delfiner just nu.',
  '🔭 En segelbåt långt ute. Vattnet glittrar i solen.',
  '🔭 Fiskarna hoppar – men ingen delfin den här gången.',
];
export function useKikare(A, pier) {
  const g = A.game, pris = 5;
  if (g.money < pris) { play('fel'); toast('💸 Kikaren vill ha en femkrona.', 'bad'); return; }
  g.money -= pris; g.save(); play('coin');
  if (pier?.spot?.()) toast('🔭 Du spanar ut över vattnet … där! Något stort rör sig under ytan!', 'good');
  else toast(KIKARE_MISS[Math.floor(Math.random() * KIKARE_MISS.length)]);
}
// (för granskning av pixelkonsten: tools/ och skisser)
export const _art = { dolphinArt, chairArt, dackArt, benchArt, kikareArt, gullArt, D_ANG };
// pratbubblorna när någon ser delfinen (life.cheer i city.js)
export const LUCK_LINES = ['🐬 En delfin! Det ger tur!', '😍 Såg du delfinen?!', '🍀 Delfin = tur hela veckan!', '✨ Wow, en delfin!', '🐬 Det betyder lycka!'];
