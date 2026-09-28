// Nya skägg och mustascher (spreds in i BEARD_REG i face.js). Färgen följer håret:
// A = hair.hi, a = hair.base, o = hair.lo, O = hair.dk (Tomteskägget är alltid vitt).
// Barn får aldrig skägg – posterna ritar ingenting när R.K.
//
// Kartorna ritas framifrån från x 6 (12 kolumner = x 6–17) och från sidan från x 10
// (7 kolumner = x 10–16), med första raden på eyeRow + dy. Vuxet huvud framifrån:
// rad 14–15 x 7–16, rad 16 x 8–15, hakraden 17 x 9–14 (munnen x 11–12), rad 18+ = under hakan
// (ligger över tröjan). Från sidan: rad 15 x 8–16, rad 16 x 10–16, rad 17 x 10–15, munnen vid x 16.
// Munnen ritas om efter skägget (R.draw('mouth')) så att den syns – utom där
// mustaschen ska täcka den (valross).
import { ramp } from './util.js';
import { pix, pal, tint, GOLD, GOLD_HI } from './face-kit.js';

const Beard = (label, group, spec) => ({
  label, group,
  front(R) {
    if (R.K) return;
    const P = pal(R, spec.p ? spec.p(R) : null);
    pix(R, 6, R.eyeRow + spec.dy, spec.f, P);
    if (spec.mouth !== false) R.draw('mouth');
  },
  side(R) {
    if (R.K) return;
    const P = pal(R, spec.p ? spec.p(R) : null);
    pix(R, 10, R.eyeRow + (spec.dys ?? spec.dy), spec.s, P);
    if (spec.mouth !== false) R.draw('mouth');
  },
});
// kortare, glesare skägg: blandat med hudfärgen
const sparse = (R) => { const m = R.mix(R.hair.base, R.skin.base, 0.3); return { a: m, o: R.mix(R.hair.lo, R.skin.lo, 0.3), A: R.mix(R.hair.hi, R.skin.base, 0.3) }; };
const white = () => { const w = ramp(0xf2efe8); return { A: 0xffffff, a: w.base, o: w.lo, O: w.dk }; };

export const BEARDS_NEW = {
  // --- helskägg ---
  short: Beard('Kort skägg', 'Helskägg', {
    p: sparse, dy: 1,
    f: ['.a........o.', '.Aa......ao.', '..Aaaaaaao..', '...aaaaaa...'],
    s: ['...a...', '..aaaa.', '.aaaaaa', '.oaaaaa'],
  }),
  long: Beard('Långt skägg', 'Helskägg', {
    dy: 1,
    f: ['.a........o.', '.Aa......ao.', '..Aaaaaaao..', '...Aaaaaa...', '..Aaaaaaao..', '...Aaoaao...', '...aoaaoa...', '....aaao....', '.....oo.....'],
    s: ['...a...', '..aaaa.', '.oaaaaa', '.oaaaaa', '.oaaaaa', '..oaaaa', '..oaao.', '...oao.', '....o..'],
  }),
  bushy: Beard('Buskigt skägg', 'Helskägg', {
    dy: 1,
    f: ['.a........o.', 'Aaa......aao', 'Aaaaaaaaaaao', '.Aaaaaaaaao.', '..aaaaaaao..', '....oaao....'],
    s: ['...a...', '.aaaaa.', 'aaaaaaa', 'oaaaaaa', '.oaaaaa', '...oao.'],
  }),
  santa: Beard('Tomteskägg', 'Helskägg', {
    p: white, dy: 1,
    f: ['.a........o.', 'Aaa......aao', 'AaaaaaaaaaaO', '.Aaaaaaaaao.', '..aaaaaaao..', '...Aaaaaao..', '....aaao....', '.....oo.....'],
    s: ['...a...', '.aaaaa.', 'aaaaaaa', 'oaaaaaa', '.oaaaaa', '..oaaaa', '...aao.', '....o..'],
  }),
  viking: Beard('Vikingaskägg', 'Helskägg', {
    p: () => ({ y: GOLD, Y: GOLD_HI }), dy: 1,
    f: ['.a........o.', '.Aa......ao.', '..Aaaaaaao..', '...Aaaaaa...', '...aaaaaao..', '...Ao..oa...', '...oa..ao...', '...Ao..oa...', '...Yy..Yy...'],
    s: ['...a...', '..aaaa.', '.oaaaaa', '.oaaaaa', '..oaaaa', '....oa.', '....ao.', '....oa.', '....Yy.'],
  }),
  forked: Beard('Tvåuddigt', 'Helskägg', {
    dy: 1,
    f: ['.a........o.', '.Aa......ao.', '..Aaaaaaao..', '...Aaaaaa...', '..Aaaaaaao..', '...aa..ao...', '...a....o...'],
    s: ['...a...', '..aaaa.', '.oaaaaa', '.oaaaaa', '.oaaaaa', '..oa.aa', '..o...a'],
  }),
  duck: Beard('Ankstjärt', 'Helskägg', {
    dy: 1,
    f: ['.a........o.', '.Aa......ao.', '..Aaaaaaao..', '...Aaaaaa...', '...Aaaaao...', '....Aaao....', '.....ao.....'],
    s: ['...a...', '..aaaa.', '.oaaaaa', '.oaaaaa', '..oaaaa', '....oaa', '.....a.'],
  }),
  chinCurtain: Beard('Skepparkrans', 'Helskägg', {
    dy: 1,
    f: ['.a........o.', '.Aa......ao.', '..Aa....ao..', '...Aa..ao...', '...Aaaaaa...', '....oaao....'],
    s: ['...a...', '..aa...', '.aa....', '.oa....', '..oaaa.', '...oa..'],
  }),
  // --- hakskägg & polisonger ---
  chinStrap: Beard('Hakband', 'Haka & kinder', {
    dy: 0,
    f: ['.o........o.', '.o........o.', '.o........o.', '..o......o..', '...o....o...', '....oooo....'],
    s: ['...o...', '...o...', '...o...', '..o....', '..o....', '...ooo.'],
  }),
  goatBeard: Beard('Bockskägg', 'Haka & kinder', {
    dy: 5,
    f: ['....Aaao....', '.....aa.....', '.....ao.....', '......o.....'],
    s: ['....aa.', '....ao.', '....a..', '....o..'],
  }),
  vanDyke: Beard('Van Dyke', 'Haka & kinder', {
    dy: 2,
    f: ['...o....o...', '....aaaa....', '............', '.....aa.....', '.....ao.....', '......o.....'],
    s: ['....o..', '....aaa', '.......', '....aa.', '....ao.', '....o..'],
  }),
  soulPatch: Beard('Hakprick', 'Haka & kinder', { dy: 5, f: ['.....ao.....'], s: ['.....a.'] }),
  sideburns: Beard('Polisonger', 'Haka & kinder', {
    dy: -2,
    f: ['.a........o.', '.a........o.', '.a........o.', '.a........o.', '.o........o.'],
    s: ['...a...', '...a...', '...a...', '...o...'],
  }),
  muttonChops: Beard('Fårskinn', 'Haka & kinder', {
    dy: -2,
    f: ['.a........o.', '.a........o.', '.a........o.', '.Aa......ao.', '.Aaa....aao.', '..aa....ao..'],
    s: ['...a...', '...a...', '...a...', '..Aa...', '.Aaao..', '.oao...'],
  }),
  kaiser: Beard('Kejsarskägg', 'Haka & kinder', {
    dy: -2,
    f: ['.a........o.', '.a........o.', '.a........o.', '.Aa......ao.', '.Aaa....aao.', '..aaaaaaao..'],
    s: ['...a...', '...a...', '...a...', '..Aa...', '.Aaao..', '.oaoaaa'],
  }),
  shadow: {
    label: 'Skuggskägg', group: 'Haka & kinder',
    // skäggväxt som en jämn skugga (inte rutig som stubben)
    front(R) {
      if (R.K) return;
      const { eyeRow: E, h0, headH, hair } = R;
      for (let y = E + 2; y < h0 + headH; y++) for (let x = 7; x <= 16; x++) {
        if (y === E + 2 && x > 8 && x < 15) continue; // kinderna ovanför mustaschen fria
        if (R.tagAt(x, y) === R.TAG.head) tint(R, x, y, hair.base, 0.3);
      }
    },
    side(R) {
      if (R.K) return;
      const { eyeRow: E, h0, headH, hair } = R;
      for (let y = E + 2; y < h0 + headH; y++) for (let x = 11; x <= 16; x++) if (R.tagAt(x, y) === R.TAG.head) tint(R, x, y, hair.base, 0.3);
    },
  },
  // --- mustascher ---
  walrus: Beard('Valross', 'Mustascher', { dy: 3, mouth: false, f: ['...Aaaaao...', '....oaao....'], s: ['....aaa', '.....ao'] }),
  handlebar: Beard('Styrmustasch', 'Mustascher', { dy: 2, f: ['..o......o..', '...Aaaaao...'], s: ['...o...', '....aaa'] }),
  pencil: Beard('Blyerts­mustasch', 'Mustascher', { dy: 3, f: ['...oo..oo...'], s: ['.....oo'] }),
  horseshoe: Beard('Hästsko­mustasch', 'Mustascher', { dy: 3, f: ['....aaaa....', '....a..o....', '....a..o....'], s: ['.....aa', '.....a.', '.....o.'] }),
  hanging: Beard('Häng­mustasch', 'Mustascher', { dy: 3, f: ['...oaaao....', '...o....o...', '...o....o...', '...o....o...'], s: ['....oaa', '....o..', '....o..', '....o..'] }),
};
