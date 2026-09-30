# Pixelgrafiken i Snabbfilen – så är den gjord

Det här dokumentet beskriver **hur all grafik i Snabbfilen är ritad**, så att samma stil och
känsla går att bygga upp igen i ett annat spel. Nästan allt är målat med kod, pixel för
pixel. Det enda som kommer från en bildfil är möbelatlasen (`assets/interior.png`). Resten –
figurer, husdjur, hus, gator, bilar, väder, mat, menyer, typsnitt – är procedurellt.

Läs avsnitt 1–4 först: där sitter själva stilen. Resten är recept per område.

> Filhänvisningar gäller Snabbfilen (`D:\GamesProjects\snabbfilen`). Koden är vanilla JS +
> canvas 2D, inga bibliotek. Radnummer ändras – sök hellre på funktionsnamnet.

---

## 1. Stilens lagar

Det här är reglerna som ger känslan. Bryts en av dem märks det direkt.

1. **Ett pixelkorn.** 1 världsenhet = 1 spelpixel, överallt. Ingen sak ritas i halv eller
   dubbel upplösning bredvid en annan. Heltal på alla positioner, ingen kantutjämning.
2. **Liten logisk bild: 384 × 216.** Allt ritas i den upplösningen och förstoras sedan med
   ett *heltal* (2×, 3×, 4× …). Blir skärmen större visas **mer värld** – bilden skalas aldrig
   upp med bråktal och blir aldrig suddig.
3. **Större = omritat, aldrig uppskalat.** Behövs något större (en skylt, ett porträtt, en
   squishy som trycks ihop) ritas det om i den nya storleken eller förstoras med exakt
   heltal. Stora skyltar använder Scale2x (EPX) som rundar diagonalerna.
4. **3/4-vy snett uppifrån**, aldrig ren sidovy. Golv syns, väggar står upp.
5. **Ljuset kommer från vänster uppe (sydväst i staden).** Vänster/övre kanter är ljusa,
   höger/undre kanter och undersidor mörka. Skuggor faller åt höger/nedåt.
6. **3–4 toners skuggning på allt.** Varje färg används som en *ramp*: ljus, bas, skugga,
   djup (avsnitt 3). Aldrig en platt yta med bara en färg.
7. **Textur på alla ytor.** Inget fält är helt jämnt – lite brus (hash) och Bayer-dither
   gör golv, väggar och himmel levande (avsnitt 4).
8. **Dither i stället för mjuka övergångar.** Gradienter kvantiseras till 3–5 steg med ett
   4×4 Bayer-mönster. Toningar in/ut görs gärna med dithrat svart i stället för halv
   genomskinlighet.
9. **Mörk, färgad kontur.** Figurer, mat och djur får en 1 px kontur som är en mörk,
   lila-dragen ton av grannpixeln ("sel-out") – aldrig ren svart.
10. **Läsbart i 1×.** En människa är ~16 × 32 synliga pixlar. En detalj är 1–2 pixlar.
    Hellre en tydlig pixel i kontrastfärg än tre som flyter ihop.
11. **Varma högdagrar, blålila skuggor.** Ljusa toner dras mot varmt vitt (`#fff4e0`),
    skuggor mot blålila (`#2a1f3a`), slagskuggor är genomskinligt lila-svarta
    (`rgba(20,12,30,.28)`).
12. **Måla en gång, animera lite.** Bakgrunder målas en gång och cachas (per dag/kväll/natt).
    Bara små saker rör sig varje bildruta.

---

## 2. Renderingskedjan – så blir pixlarna skarpa

**Logisk bild.** `DESIGN_W = 384`, `DESIGN_H = 216` (`js/main.js`). Scenerna ritar alltid i
spelpixlar.

**Heltalsskala.** `A.pxs` = antal *device-pixlar* per spelpixel, alltid ett heltal ≥ 2:

```js
// dator: största heltal som får plats (remsan överst räknas in)
const s = Math.max(2, Math.floor(Math.min(w * dpr / 384, h * dpr / (216 + strip))));
canvas.width = viewW * s; canvas.height = viewH * s;   // canvasens pixlar = skärmens pixlar
```

Varje scen börjar med `ctx.setTransform(A.pxs, 0, 0, A.pxs, 0, 0)` och ritar sedan i
spelpixlar med `fillRect`/`drawImage` på heltalskoordinater. I Snabbfilen är
`ctx.setTransform` inlindad så att en förskjutning (rutan en fast scen ligger i) läggs på
automatiskt – scenerna vet inget om den.

**Ingen utjämning:**

```js
ctx.imageSmoothingEnabled = false;          // varje bildruta
```
```css
canvas { image-rendering: pixelated; }
html, body { -webkit-font-smoothing: none; font-synthesis: none; }
```

**Växande vy i stället för skala.** Är fönstret bredare än 16:9 blir vyn bredare (staden
visar mer åt sidorna); fasta scener (rum, butiker) ritas centrerade med en mörk pixelram
runt: schackrutor `#100e15`/`#151221` i 4×4-block och en svart kant.

**Telefonen.** Ett trick i `index.html` lägger ut sidan så att en CSS-pixel blir *hela*
skärmpixlar (sidbredd = fysisk bredd / round(fysisk bredd / 1280)) och justerar
`devicePixelRatio` därefter. Skalan räknas på den fysiska skärmhöjden
(`round(fysisk kortsida / (200 + remsa))`) så att den inte hoppar när adressfältet visas.
Är scenen högre än skärmen följer bilden figuren i höjdled (`followCrop` i `main.js`) och
flyttas i hela device-pixlar, så att den förblir skarp.

**Djupsortering.** Allt som står på golvet läggs i en lista `{ fy, draw }` där `fy` är
fotlinjen, sorteras och ritas i ordning. Namnskyltar får `fy + 0.01` så att de hamnar
precis framför sin möbel.

---

## 3. Färglära

Färger hanteras som **heltal `0xRRGGBB`** och blandas med två funktioner
(`js/core/floor-pix.js`, samma i `js/core/people/util.js`):

```js
export function mul(c, f) {            // mörkare/ljusare: multiplicera kanalerna
  const r = Math.min(255, ((c >> 16) & 255) * f) | 0, g = Math.min(255, ((c >> 8) & 255) * f) | 0, b = Math.min(255, (c & 255) * f) | 0;
  return (r << 16) | (g << 8) | b;
}
export function mix(a, b, t) {         // linjär blandning a → b
  t = Math.max(0, Math.min(1, t));
  const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
  return (((ar + (((b >> 16) & 255) - ar) * t) | 0) << 16) | (((ag + (((b >> 8) & 255) - ag) * t) | 0) << 8) | ((ab + ((b & 255) - ab) * t) | 0);
}
export const css = (c) => '#' + (c & 0xffffff).toString(16).padStart(6, '0');
```

### Rampen – hjärtat i skuggningen

Varje färg blir fyra toner. Ljusare toner drar lite mot varmt vitt, mörkare mot blålila:

```js
// js/core/people/util.js
export const ramp = (c) => ({
  hi:   mix(mul(c, 1.12), 0xfff4e0, 0.12),   // ljus – mot varmt vitt
  base: c,
  lo:   mix(mul(c, 0.74), 0x2a1f3a, 0.12),   // skugga – mot blålila
  dk:   mix(mul(c, 0.5),  0x1a1426, 0.2),    // djup – kontur/veck
});
// det som är längre bort (bortre ben/arm) ritas ett steg mörkare
export const far = (r) => ({ hi: r.lo, base: r.lo, lo: r.dk, dk: r.dk });
```

Husdjuren har en variant som hanterar mycket ljusa och mycket mörka pälsar
(`rampOf` i `js/pets/pet-canvas.js`): nästan vitt får blågrå skuggor, nästan svart får
skuggor som går mot `#14101e` i stället för att bli gröt.

### Paletter som går igen

| Roll | Färg |
|---|---|
| Bläck (kanter, mörk text, UI-ram) | `#17151a` |
| Papper (dialoger, knappar) | `#f1ebe0`, ljusare `#e3dac9`, mätartext `#cfc7ba` |
| Guld (skyltar, markeringar) | `#e8b230`, skylttext `#ffd23f` |
| Röd (rubriker, fel) | `#9e1b22` / `#c9323a` |
| Grön (ok, "gå") | `#2f8f46` / `#45b964` |
| Slagskugga | `rgba(20,12,30,.28)` (figurer), `rgba(20,12,28,.22)` (möbler) |
| Kvällsdunkel över en scen | `rgba(10,12,40,.22)` eller `rgba(14,16,44,k)` |
| Dagsljus genom fönster | `#fff6dc` med alfa 0,1 |
| Natthimmel | `#0a0f2a → #2c2a50`, stjärnor `#fff6d8` / `#b8c8f0` |
| Dagshimmel | `#6aaee6 → #d8ecf2` |

Hudtoner: `#f6d7bf #eec3a0 #e0a97f #c68a5c #a06a43 #744a2d #553522`.
Hår, tröjor, byxor och skor: se `SKIN/HAIR/SHIRT/PANTS/SHOES` överst i `js/core/people.js`.

---

## 4. Verktygslådan: `floor-pix.js`

Hela stilen vilar på en liten fil. Kopiera den först till ett nytt spel.

### Brus: `hash` (stabilt slumptal per pixel)

```js
export function hash(x, y, s = 0) {           // 0..1, samma svar för samma (x, y, s)
  let n = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 2147483647);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
}
```

Använd ett eget frö (`s`) per sak, så att mönstren inte upprepar varandra. `hash(x >> 1, y >> 1, s)`
ger 2×2-fläckar, `hash(tx, ty, s)` ett värde per platta.

### Dither: `bayer` (4×4-matrisen)

```js
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
export const bayer = (x, y) => (BAYER[((y & 3) << 2) | (x & 3)] + 0.5) / 16;   // 0..1
```

### Pix – pennan som målar i en ImageData

`new Pix(w, h)` ger en offscreen-duk med:

| Metod | Gör |
|---|---|
| `px(x, y, c, a)` | en pixel, med riktig alfablandning mot det som redan finns |
| `rect / hl / vl / box` | rektangel, vågrät/lodrät linje, ram |
| `bevel(x,y,w,h,hi,lo)` | ljus kant uppe/vänster, mörk nere/höger |
| `darken(x,y,w,h,f)` | multiplicera det som redan finns (skuggor) |
| `dith(x,y,w,h,c,nivå)` | dithrad yta – pixel där `bayer < nivå` |
| `ell(cx,cy,rx,ry,c,amax,steg)` | mjuk ljus-/skuggfläck, **kvantiserad i steg med dither** |
| `line(...)` | Bresenham-linje |
| `clip(x0,y0,x1,y1)` | måla bara inuti (t.ex. fönsterglaset) |
| `flush()` | lägg ut på canvasen och returnera den (cacha den!) |

`ell` är den viktigaste för "ljuset": en ljuskägla från en lampa är en `ell` med låg alfa och
4–5 steg – den blir en mjuk men *pixlig* fläck i stället för en suddig gradient:

```js
ell(cx, cy, rx, ry, c, amax, steps = 5) {
  for (let y = Math.floor(cy - ry); y <= cy + ry; y++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
    const t = Math.hypot((x + 0.5 - cx) / rx, (y + 0.5 - cy) / ry);
    if (t >= 1) continue;
    const v = (1 - t) * steps + bayer(x, y) - 0.5;          // dither mellan stegen
    const q = Math.max(0, Math.min(steps, Math.round(v))) / steps;
    if (q > 0) this.px(x, y, c, amax * q);
  }
}
```

### De tre grundrecepten för ytor

Från `js/city/buildings-work.js` (samma idé finns i alla scener):

```js
// 1. "jitter": lite brus så att ingen yta är platt (±8 %)
function jit(c, x, y, s = 0, amt = 0.08) {
  const n = (hash(x, y, s) - 0.5) * amt + (bayer(x, y) - 0.5) * amt * 0.4;
  return n >= 0 ? mix(c, 0xffffff, n) : mix(c, 0, -n);
}
// 2. kvantiserad gradient: 3–4 toner med Bayer-dither i stället för en mjuk övergång
function qmix(a, b, t, x, y, steps = 4) {
  const q = Math.floor(Math.max(0, Math.min(1, t)) * steps + bayer(x, y)) / steps;
  return mix(a, b, Math.max(0, Math.min(1, q)));
}
// 3. en gradient med lite dither direkt i blandningen (väggar, himmel)
const c = mix(top, bottom, t + (bayer(x, y) - 0.5) * 0.1);
```

---

## 5. Recept: ytor och material

Alla exempel målas med `Pix` i en loop över pixlarna och cachas.

**Golvplattor** (`buildBg` i `js/scenes/room.js`): plattor 23 × 15.

```js
const tx = (x / 23) | 0, ty = ((y - WALL_Y) / 15) | 0;
const lx = x - tx * 23, ly = (y - WALL_Y) - ty * 15;
let c = mix(floorA, floorB, ((tx + ty) & 1) ? 0.2 : 0.62);   // schackrutigt men nära varandra
c = mul(c, 0.97 + hash(tx, ty, 1) * 0.05);                   // varje platta lite olika
const h = hash(x, y, 2);
if (h > 0.94) c = mul(c, 0.95); else if (h < 0.02) c = mix(c, 0xffffff, 0.25);   // prickar
if (lx === 0 || ly === 0) c = mul(c, 0.84);                  // fog
else if (lx === 1 || ly === 1) c = mix(c, 0xffffff, 0.2);    // ljus kant efter fogen
```

Varianter: marmor = en sinusåder `sin(x*0.31 + y*0.55 + sin(x*0.09)*4) > 0.96`; slitet golv =
blekta brädor per platta + mörka fläckar på 2×2; nött gångstråk = ett Bayer-dithrat band.

**Vägg** (samma funktion): lodrät gradient `mul(wall, 0.8) → wall` med ±6 % dither, en
tapetskarv var 27:e pixel (mörk kolumn + ljus kolumn bredvid), en bröstpanel på 19 rader i
paneler om 24 px med fasade kanter, en mörk golvlist `mul(wallDk, 0.55)` och **4 rader
dithrad "ambient occlusion"** på golvet närmast väggen (`0x1a1426`, alfa 0,18).

**Tegel** (`brickPx`): stenar 7 × 3, varannan rad förskjuten en halv sten. Varje sten får en av
tre toner via `hash(kolumn, rad)`, enstaka nästan svarta, översta raden ljusare, näst sista
kolumnen mörkare, fogen = `mix(bas, 0xcfc4b0, 0.5)` med jitter.

**Taktegel** (`tilePx`): 5 × 4, varje "pann" har fem kolumntoner `[1.16, 1.06, 0.97, 0.84, 0.64]`
(ljus till vänster, rundad form) och en mörk underkant; lite mossa slumpas in.

**Glas** (`reflect`): diagonala strimmor `((x*2 - y*3) % 50)` – två ljusa band, ett svagt – plus
en ljusare överkant. På natten blåare och svagare.

**Trä/dörrar**: `mix(0x5a4632, 0x6a5238, hash(x >> 1, y >> 2) * 0.6)` ger ådrigt trä (brus i
2×4-block), mörkare fält för speglar, en mässingsvred i `#d8b24a`.

**Lövverk** (`leaves`): en ellips där varje pixel får ljus/mellan/mörk efter
`(cx - x)/rx + (cy - y)/ry` (ljus uppe till vänster) plus brus, och en *taggig kant* där
kantpixlar slumpas bort.

**Himmel**: gradient med dither, små moln på fasta platser (samma i alla fönster),
stjärnor = `hash(x, y) > 0.988`, två färger.

**Utsikt genom fönster**: landskapet målas i *rummets* koordinater och klipps mot glaset
(`P.clip`), så att två fönster i samma vägg visar samma sammanhängande landskap. Små saker
rör sig ovanpå varje bildruta (grannar i fönster, bilar på bron, en katt på staketet med
lysande ögon).

**Dagsljus på golvet**: under varje fönster en dithrad parallellogram (förskjuts 0,5 px per rad)
i `#fff6dc` med alfa 0,1 som tonar ut på 30 rader.

---

## 6. Figurerna (människor)

`js/core/people.js` + register i `js/core/people/*.js`. Utförlig beskrivning i
[`PEOPLE-ARKITEKTUR.md`](PEOPLE-ARKITEKTUR.md).

**Sprite 24 × 40, fötterna i (12, 39).** Synlig figur ≈ 16 × 32:

| Mått (vuxen / barn) | |
|---|---|
| Huvud | 12 / 11 rader, 8–9 px brett |
| Bål | 9 / 6 rader, bredd 7 (kroppsbredd 4/5/6) |
| Ben | 8 / 5 rader, 4 / 3 px breda |
| Skor | rad 37–38 |
| Ögon | rad huvudtopp + 7 / + 6 |

**Ritas pixel för pixel i en ImageData** med `put(x, y, färg)`. Vänstervyn är den högra
speglad (x → 23 − x). Fyra vyer: fram, bak, höger (och speglad vänster).

**Lagerordning:** bortre ben → bortre arm → närmaste ben → höft/bälte → kjol/byxor → bål →
tryck → överdel → halsduk → väska → närmaste arm → huvud → öron → ögon/bryn/näsa/mun →
kinder/smink/skägg/glasögon → frisyr → hårsmycke → hatt/hörlurar/smycken → **kontur sist**.

**Skuggning inom en del:** framifrån är vänster kolumn `hi`, de två högra `lo`, resten `base`,
och ett mörkt veck i nederkanten. Bålen framifrån (`tw` = halva kroppsbredden):

```js
for (let y = ty0; y < ty1; y++) {
  const inset = y === ty0 ? 1 : 0;                        // axlarna rundas av
  rect(12 - tw + inset, y, tw * 2 - inset * 2, 1, shirt.base);
  put(12 - tw + inset, y, shirt.hi);                      // ljus vänsterkant
  put(11 + tw - inset, y, shirt.lo);                      // skugga högerkant (två kolumner)
  put(10 + tw - inset, y, y > ty0 + 1 ? shirt.lo : shirt.base);
}
rect(12 - tw + 1, ty1 - 1, tw * 2 - 2, 1, shirt.lo);      // nedre vecket
```

I sidovy (ansiktet åt höger) är framsidan ljus och ryggen mörk. Den bortre armen och det
bortre benet i sidovy tar `far(ramp)`.

**Etikettbuffert.** Varje pixel märks med vilken del den tillhör (`TAG.torso`, `TAG.hair` …).
Tryck och mönster (ränder, kamouflage, ryggnummer) målas sedan *på etiketten* och behåller
tonen: en `lo`-pixel i tröjan blir `lo` i mönsterfärgen. Så följer mönstret skuggningen.

**Konturen ("sel-out")** – det som gör figurerna läsbara:

```js
// varje genomskinlig pixel intill figuren får en mörk ton av grannen
// (granne i ordningen ovanför > vänster > höger > under)
d[i]     = src[best]     * 0.28 + 14;
d[i + 1] = src[best + 1] * 0.24 + 10;
d[i + 2] = src[best + 2] * 0.30 + 20;   // lite mer blått → lila-svart, aldrig ren svart
```

**Slagskugga** under fötterna: två rektanglar `rgba(20,12,30,.28)` – 10 × 2 och 8 × 1 under
(barn 8 × 2 + 6 × 1). Ingen oval, bara två pixelrader.

**Bildrutor:** 0 stå · 1/2 gångsteg · 3 mellansteg (kroppen 1 px upp) · 4 andas in/blinka ·
5 sitta · 6 sitta och äta · 7/8/9 bära. Gång = `[1, 3, 2, 3]` i 8,5 bilder/s (eller
styrt av sträckan: en bildruta per 7,3 px). Stilla: bildruta 4 när `sin(t·2) > 0.9`.

**Cache:** en canvas per utseende + riktning + bildruta (WeakMap på look-objektet). En sprite
tar under 2 ms att rita.

**Porträtt** (dialoger, HUD): bysten ur spriten (20 × 24) ritad i 4× på en 80 × 96-duk, över ett
schackmönster i 4 px och en dithrad ljusfläck bakom huvudet.

**Knep – rita två gånger och jämför:** för att hitta ögonen (sovande figur) ritas figuren igen
med magenta ögon och pixlarna som skiljer är ögonen. Kläder på galge: plagget ritas i två
färgsättningar och pixlarna som skiljer är plagget.

**Regression:** `tools/people-regress.mjs` hashar varje sprite i Node – gamla utseenden ska
vara pixelidentiska när nya plagg läggs till.

---

## 7. Husdjuren

`js/pets/pet-art.js`, `pet-canvas.js`, `sprites.js`.

Djuren är **små 3D-skelett som projiceras snett ovanifrån** och målas som 2D-former:

- Modellaxlar: u framåt, v vänster, w upp. Projektion (`projector`):
  fram `[AX + v, GY + u·0.52 − w·0.86]`, sida `[AX + u, GY − v·0.42 − w·0.86]`.
  Duken är 64 × 60 med fötterna i (32, 49).
- Mått per art/ras/ålder (`dogRig`, `catRig`: bål, huvud, nos, benhöjd, svanslängd), poser per
  animation och bildruta.
- Delarna blir `{ z, fn }` och ritas bakifrån och fram (målarens algoritm).
- **Primitiver:** `ell` = skuggad ellips där sfärens normal `nz = √(1 − d²)` belyses från
  vänster-uppe-fram (`L = [−0.46, −0.6, 0.65]`) och **kvantiseras till 4 toner** i rampen;
  `thick` = kapsel (ben, svans); `poly` = öron.
- `inkEdge` drar en mörk linje där en del överlappar en annan del
  (`mix(mul(c, 0.76), 0x2a1f3a, 0.16)`), `outline` samma sel-out-kontur som figurerna, en
  slagskugga en rad ner.
- **Päls** målas i delens egna koordinater (tigerränder med `frac`, sköldpaddsfläckar i hashade
  celler …), långhåriga raser får tovor i kanten.
- Ögon, nosar och öron är handplacerade per vy. Bakvyn fuskar medvetet (huvudet ovanför bogen,
  svansen läggs om i bildplanet) – annars blir en svans mot kameran bara en prick.
- Bildrutorna är fasta (gång 4 bilder i 8/s, blink, andning, viftning) och cachas.

Receptet går att använda för allt som har "kropp" och ska se ut från fyra håll utan att
ritas för hand i varje vy.

---

## 8. Staden och husen

`js/city/*`, `js/scenes/city.js`, kontraktet i [`STADEN.md`](STADEN.md).

- **Marken** för hela världen (4000 × 820) målas en gång till en stor canvas per dag/natt,
  i bitar när webbläsaren är ledig. **Natt = dagens pixlar färgade per kanal**
  (R·0,86, G·0,9, B·0,97 + 8), inte en ny målning.
- **Varje hus** är en modul med `paint / live / glow / front`: `paint` målar fasaden en gång
  (cache per hus, natt, snö), `live` små saker som rör sig, `glow` ljuset, `front` det som står
  framför. Husets canvas är lite bredare än huset; nedersta raden − 4 är marklinjen.
- **Fasadverktygen** (`jit`, `qmix`, `brickPx`, `tilePx`, `reflect`, `leaves`, `sign`, `snowCap`)
  står i avsnitt 4–5. Snö läggs automatiskt på varje fri överkant.
- **Kväll/natt:** en mörkblå hinna `rgba(14,16,44,k)` över allt (k 0 → 0,5 efter en kurva över
  dygnet), sedan varje hus `glow()` ritat med `globalCompositeOperation = 'lighter'`
  (additivt ljus) – tända fönster, gatlyktor, skyltar med en dithrad gloria i 4 steg.
- **Ljus som inte ska lysa på det som står framför:** det som ritas framför glöden registreras i
  en mask som stansas ur ljuset med `destination-out`, så att folk blir siluetter mot en
  upplyst skylt.
- **Fordon** (`js/city/traffic.js`): sidoprofilen byggs som en regionmask (kaross, glas, ram,
  stötfångare …) ur interpolerade kurvor och färgas sedan; snö på platta överkanter,
  våt spegling (nedersta 12 raderna speglade och blåtonade, varannan pixel), strålkastare med
  `lighter`.
- **Träd** målas en gång (`paintCrown`: överlappande lövklumpar ljusa uppe till vänster) och
  "vajar" med heltalsförskjutning per rad.
- **Väder:** tilebart värdebrus (`pnoise`) i cachade rutor på 128–512 px för snö, slask, is och
  moln; regn och snöfall ritas ovanpå.
- **Stora skyltar:** bitmappstypsnittet förstorat med **Scale2x** (EPX) – dubbel storlek med
  rundade diagonaler, samma pixelkorn.

---

## 9. Butiker och jobb

Varje scen följer samma mönster: **bakgrunden målas en gång med `Pix`** (per dag/kväll), och
bara kunder, mat, bubblor och figurer ritas varje bildruta.

- Exempel: `paintDiner` (`js/jobs/jobb-burgare.js`) – mintgrön vägg med Bayer-gradient,
  kromlister, schackband, röda paneler var 24:e px, pendellampor med `ell`-glöd, kakelkök,
  krittavla. Pizzerians ugn: mosaikkupol med fyra hashade röda, belysning
  `−dx·0,6 − dy·0,55`, valvstenar per vinkelsegment, glödande mynning.

**Mat och småsaker som ASCII-kartor + palett:**

```js
{ id: 'burgare',
  pal: { a: 0xffe2aa, b: 0xf2aa4c, c: 0xd4822c, d: 0x9c5622, s: 0xfff6dc,   // bröd (4 toner + sesam)
         G: 0x3f9e34, g: 0x8edc4c, y: 0xffd23f, Y: 0xe09a1a, m: 0x8a4a2c, M: 0x5a2c1a },
  map: [
    '...abbbbb...',
    '..absbbbsb..',
    '.abbbbbbsbc.',
    '.bsbbbsbbbc.',
    '.dccccccccd.',
    'GgGgGGgGgGgG',     // sallad
    '.yyyyyyyyyY.',     // ost
    '.mymmmmmmYm.',     // kött
    '.MMMMMMMMMM.',
    '.cbbbbbbbbc.',
    '..dddddddd..',
  ] }
```

`mapSprite` lägger på en sel-out-kontur automatiskt (`mix(mul(granne, 0.42), 0x1c1418, 0.4)`).
Tallriken är en egen karta på 20 × 7 med en skuggrad `rgba(30,18,34,.32)`. Samma format
fungerar för ikoner, frukt, bakverk, väskor.

**Pratbubblor** (`sayBubble` i `js/scenes/walkable.js`): ram `#17151a`, fyllning `#f4f1ea`,
en pip på tre rader, text i SMALL-typsnittet, högst fyra rader. **Emoji i bubblor görs om
till 9 × 9 pixlar:** emojin ritas i 36 px på en dold canvas, skalas ner och alfan trösklas
vid 96 – då får även emoji samma pixelkorn.

**Kvällsljus inomhus:** först `multiply` med `#8a7a9a` (blålila skuggor), sedan en förmålad
ljuskarta med dithrade ljuspooler i 3–5 steg ritad med `lighter`; figurer stansas ur ljuset
med `destination-out` så att bordslampan inte lyser *på* någon som står framför den.

---

## 10. Ljus, natt och sömn

- **Kväll:** en platt hinna `rgba(10,12,40,0.22)` över scenen och bakgrunden målad med
  väggen × 0,8.
- **Sömn:** mörkret sänker sig (`rgba(8,10,34,dim)` upp till 0,6), fönstren lyser svagt,
  månljus faller in, zzz stiger, och i gryningen ett rosa sken (`rgba(255,164,96,≤0.2)`).
  Ljuset genom fönstren ritas i ett **eget lager**: glaset kopierat från bakgrunden, en
  gryningsgradient `#b8b4ec → #f4b0a0 → #ffc080` och ett månljuslager (en `Pix` med
  ellipsglöd och en dithrad fläck på golvet). Sedan stansas varje möbel och sängen ur lagret
  med `destination-out`, så att månstrimman ligger på golvet *bakom* möblerna.
- **Övertoning dag ↔ natt:** två cachade bakgrunder blandas med `globalAlpha`.
- **Film/scenbyten:** tonas med dithrat svart (Bayer), inte halvgenomskinligt.

---

## 11. Text och gränssnitt

**Bitmappstypsnitt i canvas** (`floor-pix.js`): `SMALL` 3 × 5 och `BIG` 5 × 7, glyfer som
strängrader där `#` = tänd pixel. Accenter (Å Ä Ö É) ligger i extra rader ovanför. Ritas med
`fillRect` per pixel, heltalsskala som argument:

```js
A: g(['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#']),
'Å': g(['..#..', '.#.#.', '#...#', '#####', '#...#', '#...#', '#...#'], ['..#..', '.#.#.']),
```

Fetstil = varje tänd pixel tänder också pixeln till höger.

**Menytypsnittet "Pixelstad"** (`tools/pixelfont/build.mjs`, opentype.js): versaler och siffror
ur `BIG`, gemener och skiljetecken ur `glyphs.mjs`. 1 typsnittspixel = 100 enheter,
em = 12 px (2 accentrader + 7 versalhöjd + 3 nedstaplar). Byggs till `pixelstad.otf` och
`pixelstad-fet.otf`. I CSS används det **bara i storlekar där varje typsnittspixel blir hela
skärmpixlar**: `--f1..--f4 = 12·max(1, round(k·dpr)) / dpr px` räknas ut i `index.html`.
Aldrig fasta px-storlekar i nytt gränssnitt.

**Pixelramar i CSS** – ingen border-image, bara solida kanter och hårda skuggor:

```css
.btn { background: var(--paper); border: 3px solid var(--ink); box-shadow: 3px 3px 0 var(--ink); }
.btn:active { transform: translate(2px, 2px); box-shadow: 1px 1px 0 var(--ink); }   /* "trycks ner" */
.btn-go { background: var(--green2); color: #fff; text-shadow: 2px 2px 0 #1d5a2c; }
.dlg { background: var(--paper); border: 4px solid var(--ink); box-shadow: 8px 8px 0 var(--ink); }
.dlg-head { background: var(--red); color: #fff; border-bottom: 4px solid var(--ink); }
```

**HUD-remsan** (`js/core/hud-pix.js`): en egen canvas ovanför scenen i samma skala – porträtt,
namn, pengar, klocka, mätare med kvartsstreck som blinkar rött under 20, ikoner på 6 × 6 px
(burgare, zz, mynt, folk).

---

## 12. Effekter och rörelse

- **Rök, gnistor, damm:** små klumpar på 2 × 2 som **stegar genom en palett på fyra färger**
  i stället för att tona ut med alfa (`js/core/fx.js`).
- **Hjärtan, zzz, bajs, pölar:** ASCII-bitmappar med 1 px skugga.
- **Hoptryckning** (squishies): förberäknade steg −3…7 som ritas om i varje form – aldrig
  skalade.
- **Dörrar som svänger:** förritade bildrutor.
- **Andning/gupp:** kroppen 1 px upp eller ner. Aldrig delpixelrörelse.
- Siffror som stiger ("+7", "FEL"): SMALL-text på en halvmörk platta, stiger 14 px/s, 0,9 s.

---

## 13. Det enda som kommer från bildfiler

- **`assets/interior.png`** (1024 × 414): möbler från **EmanuelleDev**-arken (köpta, från
  Palssons Gård). `tools/build-atlas.mjs` packar *bara* de sprites spelet använder (licensens
  krav) med 2 px luft och skriver `js/data/frames.js`: `FRAMES[typ + variant] = [sx, sy, sw, sh]`.
  Några ramar (lampa, växt, dass) är ritade med kod och packade in i samma atlas.
- Möblerna **färgas om** med `tintSprite` (`js/core/recolor.js`): paletten analyseras,
  materialen delas upp (trägruppen känns igen) och den största ytan byts till en ny ton med
  samma ramp – så passar en möbel i vilken färg som helst.
- Skuggor under möbler ritas av koden (samma lila-svarta rektanglar som figurerna), och
  väggsaker får 0,18 skugga i höger- och underkant.

> **I ett annat spel:** kontrollera EmanuelleDev-licensen innan arken återanvänds. Allt
> annat i det här dokumentet är egen kod och kan tas med fritt.

---

## 14. Verktyg för att arbeta med grafiken

| Verktyg | Gör |
|---|---|
| `tools/people-sheet.mjs` | kontaktark över alla frisyrer/plagg |
| `tools/people-regress.mjs` | hash per sprite – gamla figurer får inte ändras |
| `tools/pets-sprite-snap.mjs` + `pets-sprite-preview.html?dbg=1` | djurens bildrutor, delar färgade per grupp |
| `tools/city-snap.mjs` | panorama/kamera i staden (`--pano`, `--weather`) |
| `tools/room-snap.mjs`, `room-check.mjs` | hemmen, alla bostäder |
| `tools/meny-bilder.mjs` | menyer och dialoger på dator och iPhone 13 mini |
| `tools/build-atlas.mjs`, `atlas-sheet.mjs`, `sprite-scan.mjs` | möbelatlasen |
| `tools/pixelfont/` | bygger Pixelstad-typsnittet |

Arbetssätt som gav bäst resultat: rita i kod, ta en skärmbild med Playwright i 1× och 4×,
titta, justera en pixel i taget. Ren kod utan bildfiler gör att allt går att färga om,
spegla och variera i oändlighet.

---

## 15. Komma igång i ett nytt spel – checklista

1. **Kopiera** `js/core/floor-pix.js` (färger, hash, bayer, Pix, typsnitt) – det är grunden.
2. **Sätt upp förstoringen:** logisk bild 384 × 216 (eller annan liten storlek), heltalsskala
   `A.pxs`, `imageSmoothingEnabled = false`, `image-rendering: pixelated`, växande vy i
   stället för bråkskala. Ta gärna med dpr-tricket ur `index.html` för telefoner.
3. **Bestäm ljusriktning** (vänster uppe) och håll den överallt.
4. **Gör allt med ramper** (`ramp(c)` → hi/base/lo/dk) – varma högdagrar, blålila skuggor.
5. **Ytor:** `jit` på allt, `qmix` för gradienter, `ell` för ljus och skugga, en rad dithrad
   AO där golv möter vägg.
6. **Figurer:** kopiera `js/core/people.js` + `js/core/people/` om människorna ska se likadana
   ut; annars behåll principerna – 24 × 40, del för del med vänster ljus/höger mörk,
   etikettbuffert, sel-out-kontur sist, två-raders skugga.
7. **Måla bakgrunder en gång och cacha** per dag/kväll/natt. Animera bara det som rör sig.
8. **Natt:** mörk hinna + `lighter`-glöd, `destination-out` där ljuset inte ska träffa.
9. **Text:** SMALL/BIG i canvas, Pixelstad i menyerna, bara i heltalsstorlekar.
10. **UI:** solida kanter + hårda offsetskuggor, papper `#f1ebe0` och bläck `#17151a`.
11. **Regel att aldrig bryta:** ett pixelkorn. Allt i samma upplösning, heltal överallt,
    större = omritat.
