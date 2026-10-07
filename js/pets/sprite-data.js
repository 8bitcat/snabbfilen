// Arter och raser för husdjuren (data). Importeras via sprites.js (SPECIES).
// Färger som heltal 0xRRGGBB. Mönster (pat): se pet-art.js (coatOf).
import { $t } from '../core/i18n.js';
export const SPECIES = {
  katt: {
    id: 'katt', namn: $t('Katt'), plural: $t('Katter'), unge: $t('Kattunge'), ung: $t('Ung katt'), vuxen: $t('Katt'), ljud: $t('Mjau!'),
    breeds: [
      { id: 'tigrerad', namn: $t('Tigrerad'), pris: 900, beskr: $t('Klassisk brunrandig huskatt med M i pannan.'), pat: 'tabby', c: 0x9a7650, c2: 0x3e2c20, belly: 0xd8c3a0, eye: 0x8fb040 },
      { id: 'svart', namn: $t('Svart'), pris: 900, beskr: $t('Kolsvart och blank, med gula ögon.'), pat: 'solid', c: 0x2a2630, eye: 0xe8c030 },
      { id: 'vit', namn: $t('Vit'), pris: 1100, beskr: $t('Snövit med rosa nos och blå ögon.'), pat: 'solid', c: 0xf2efe8, eye: 0x5aa0e0, nose: 0xf0a0b0 },
      { id: 'rodkatt', namn: $t('Rödkatt'), pris: 1000, beskr: $t('Orange och randig – full av bus.'), pat: 'tabby', c: 0xe0913c, c2: 0xb05a1e, belly: 0xf4d0a0, eye: 0xd8a030 },
      { id: 'skoldpadd', namn: $t('Sköldpadd'), pris: 1200, beskr: $t('Fläckig i svart och rödbrunt – alltid en hona i verkligheten.'), pat: 'tortie', c: 0x2e2830, c2: 0xc8783a, c3: 0xe8b070, eye: 0xd8a030 },
      { id: 'smoking', namn: $t('Smoking'), pris: 1000, beskr: $t('Svartvit med vit bringa och vita tassar.'), pat: 'tux', c: 0x26242c, c2: 0xf2efe8, eye: 0x9ac040 },
      { id: 'blagra', namn: $t('Blågrå'), pris: 1500, beskr: $t('Rund och mjuk, blågrå päls och koppargula ögon.'), pat: 'solid', c: 0x7c8494, eye: 0xe09a30, round: true },
      { id: 'siames', namn: $t('Siames'), pris: 2200, beskr: $t('Ljus kropp, mörka tassar, öron och ansikte. Pratglad.'), pat: 'points', c: 0xeee0c8, c2: 0x4a3428, eye: 0x4a90e0, slim: true },
      { id: 'skogkatt', namn: $t('Norsk skogkatt'), pris: 2800, beskr: $t('Stor och luddig med tofsar på öronen och yvig svans.'), pat: 'tabby', c: 0x8a7a68, c2: 0x3a3028, c3: 0xf2ece0, belly: 0xf2ece0, eye: 0x9ab040, fluff: 2, big: true },
    ],
  },
  hund: {
    id: 'hund', namn: $t('Hund'), plural: $t('Hundar'), unge: $t('Valp'), ung: $t('Unghund'), vuxen: $t('Hund'), ljud: $t('Voff!'),
    breeds: [
      { id: 'blandras', namn: $t('Blandras'), pris: 1500, beskr: $t('Lite av varje – och helt unik.'), size: 'm', ears: 'fold', tail: 'whip', snout: 'mid', pat: 'bib', c: 0xa8703c, c2: 0xf2e8d8 },
      { id: 'tax', namn: $t('Tax'), pris: 2800, beskr: $t('Lång, låg och modig. Älskar att gräva.'), size: 's', legs: 0.45, len: 1.45, ears: 'flop', tail: 'whip', snout: 'long', pat: 'solid', c: 0x8a4a22 },
      { id: 'labrador', namn: $t('Labrador'), pris: 3800, beskr: $t('Glad, snäll och alltid hungrig.'), size: 'l', ears: 'flop', tail: 'otter', snout: 'mid', pat: 'solid', c: 0xe2bc78 },
      { id: 'golden', namn: $t('Golden retriever'), pris: 4200, beskr: $t('Guldig, lurvig och världens bästa vän.'), size: 'l', ears: 'flop', tail: 'plume', snout: 'mid', pat: 'solid', c: 0xd89a48, fluff: 1 },
      { id: 'schafer', namn: $t('Schäfer'), pris: 4500, beskr: $t('Klok och vaksam, med svart sadel.'), size: 'xl', ears: 'up', tail: 'brush', snout: 'long', pat: 'saddle', c: 0xc0823e, c2: 0x2a2428, fluff: 1 },
      { id: 'husky', namn: $t('Husky'), pris: 4800, beskr: $t('Isblå ögon och en svans som ringlar sig.'), size: 'l', ears: 'up', tail: 'curl', snout: 'mid', pat: 'husky', c: 0x6e7078, c2: 0xf4f2ee, eye: 0x60b0f0, fluff: 1 },
      { id: 'collie', namn: $t('Border collie'), pris: 3900, beskr: $t('Snabb och smart, svart och vit.'), size: 'm', ears: 'fold', tail: 'plume', snout: 'mid', pat: 'collie', c: 0x26242a, c2: 0xf4f2ee, fluff: 1 },
      { id: 'pudel', namn: $t('Pudel'), pris: 3600, beskr: $t('Lockig, elegant och fäller inte.'), size: 'm', ears: 'pom', tail: 'pom', snout: 'long', pat: 'solid', c: 0xf0e6d6, coat: 'curly', fluff: 1 },
      { id: 'jack', namn: $t('Jack russell'), pris: 2600, beskr: $t('Liten energiknippe med bruna fläckar.'), size: 's', ears: 'fold', tail: 'bob', snout: 'mid', pat: 'jack', c: 0xf4f2ee, c2: 0x9a5a2a },
      { id: 'corgi', namn: $t('Corgi'), pris: 4000, beskr: $t('Korta ben, stora öron och en rumpa som vickar.'), size: 's', legs: 0.5, len: 1.25, ears: 'up', tail: 'bob', snout: 'mid', pat: 'corgi', c: 0xd8883a, c2: 0xf6f0e6 },
      { id: 'mops', namn: $t('Mops'), pris: 3200, beskr: $t('Platt nos, rynkor och en knorr till svans.'), size: 's', legs: 0.8, len: 0.9, ears: 'fold', tail: 'curl', snout: 'flat', pat: 'mask', c: 0xe0c490, c2: 0x2a2428 },
      { id: 'chihuahua', namn: $t('Chihuahua'), pris: 2400, beskr: $t('Pytteliten med stora öron och stort hjärta.'), size: 'xs', len: 0.85, ears: 'bat', tail: 'whip', snout: 'short', pat: 'solid', c: 0xd8b078, eye: 0x2a1a14 },
    ],
  },
  kanin: {
    id: 'kanin', namn: $t('Kanin'), plural: $t('Kaniner'), unge: $t('Kaninunge'), ung: $t('Ung kanin'), vuxen: $t('Kanin'), ljud: $t('*nos-nos*'),
    breeds: [
      { id: 'vit', namn: $t('Vit'), pris: 350, beskr: $t('Snövit med rosa öron och röda ögon.'), ears: 'up', pat: 'solid', c: 0xf4f2ec, eye: 0xb02838 },
      { id: 'brun', namn: $t('Brun'), pris: 300, beskr: $t('Som en vildkanin – brunspräcklig med vit svans.'), ears: 'up', pat: 'agouti', c: 0x9a7a58, c2: 0x5a4430, belly: 0xece2d0 },
      { id: 'vadur', namn: $t('Dvärgvädur'), pris: 550, beskr: $t('Hängande öron och rund som en boll.'), ears: 'lop', pat: 'solid', c: 0xb8aca0, round: true },
      { id: 'lejonhuvud', namn: $t('Lejonhuvud'), pris: 600, beskr: $t('Liten med en yvig man runt huvudet.'), ears: 'short', pat: 'solid', c: 0xe0a860, fluff: 2 },
      { id: 'prickig', namn: $t('Prickig'), pris: 450, beskr: $t('Vit med svarta prickar och mörka öron.'), ears: 'up', pat: 'spots', c: 0xf4f2ec, c2: 0x2a2630 },
      { id: 'hollandare', namn: $t('Holländare'), pris: 500, beskr: $t('Svart bak, vit fram – som i kostym.'), ears: 'up', pat: 'dutch', c: 0x2e2a32, c2: 0xf4f2ec },
    ],
  },
};
