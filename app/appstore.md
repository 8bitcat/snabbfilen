# Pixelcity i App Store – allt att fylla i

Allt nedan klistras in i **App Store Connect → Pixelcity**. Längderna är kontrollerade mot Apples gränser.

## Distribution → iOS 1.0 (App Store-sidan, svenska)

**Promotional Text** (högst 170 tecken)
```
Ett helt liv i pixelgrafik: jobba, bo, inred, skaffa husdjur, ha fest och upptäck staden – ensam eller tillsammans med familjen i samma stad.
```

**Description** (högst 4 000 tecken)
```
Välkommen till Pixelstaden! Du flyttar in med 250 kronor på fickan och en rostig husvagn – resten bestämmer du själv.

JOBBA DIG UPPÅT
14 olika jobb, från pizzabagare och burgarbaren till flygplatsen, vårdcentralen och verkstaden. Bli befordrad till skiftledare och chef – eller starta en egen foodtruck.

BO OCH INRED
Spara ihop till en lägenhet, ett radhus, en villa eller en gård på landet. Möblera rum för rum med över hundra sorters möbler, laga mat i köket och odla i trädgården.

SHOPPA OCH FIXA DIG
Klädaffären, leksaksaffären, möbelvaruhuset och frisören med massor av frisyrer och hårfärger – och djuraffären där kattungar, valpar och kaninungar väntar på ett hem.

HITTA PÅ SAKER
Bjud hem kompisarna på fest, gå på bio, cykla eller kör moppe genom staden, bli bonde och upptäck Söder, parken, förorten och downtown – dag som natt, i sol och regn.

SPELA TILLSAMMANS
Alla som spelar samtidigt hamnar i samma stad. Hälsa på hemma hos varandra, jobba ihop på samma pass och prata i röstchatten om ni vill. Fula ord filtreras bort, och den som är dum kan blockeras och anmälas.

Inga konton, ingen reklam och inga köp i appen. Spelet sparas på din telefon och får nya saker hela tiden.
```

**Keywords** (högst 100 tecken, kommatecken utan mellanslag)
```
livsspel,simulering,pixel,stad,familj,husdjur,inredning,jobb,frisör,kläder,odla,fest,bonde,mysigt
```

**Support URL**
```
https://8bitcat.github.io/snabbfilen/support.html
```

**Marketing URL** (frivillig)
```
https://8bitcat.github.io/snabbfilen/
```

**Skärmbilder** (dra in i nummerordning 1–9):
- iPhone 6,5" (2778 × 1284): `D:\GamesProjects\snabbfilen\app\store\ladda-upp\iPhone 6,5 tum`
- iPad 13" (2752 × 2064): `D:\GamesProjects\snabbfilen\app\store\ladda-upp\iPad 13 tum`

**Game Center:** kryssa **inte** i (spelet använder inte Game Center).

**Copyright**
```
2026 Carl Palsson
```

**Build:** välj bygget **1.0 (…)** när Codemagic har byggt det (inte 0.83.x).

## App Review Information (engelska – för Apples granskare)

**Sign-In required:** nej (låt rutan vara tom).

**Contact:** Carl Palsson · ditt mobilnummer · hello@8bitcat.io

**Notes** – samma text klistras in som svar i *Reply to App Review* (Apples begäran 2026-10-06, Guideline 2.1 Information Needed). Byt ut `<LÄNK>` mot länken till skärminspelningen.
```
Hello, and thank you for reviewing Pixelcity. Here is the requested information.

1. SCREEN RECORDING
Recorded on an iPhone with the latest iOS: <LÄNK>
It starts with launching the app and shows the typical flow: creating a character, walking to the first job and working a shift, shopping, and online play with a second player – chat, blocking and reporting. The app has no accounts, no login and no in-app purchases.

2. PURPOSE AND TARGET AUDIENCE
Pixelcity is a free pixel-art life simulation game in Swedish. You start with a caravan and 250 kronor, take jobs (burger bar, pizzeria, airport and more), earn money, rent and furnish a home, buy clothes, adopt pets, cook and grow vegetables. Everyone playing at the same time shares one city, so families and friends can visit each other's homes and work together. It is made for families and Swedish-speaking players who enjoy calm life-sim games – no ads, no purchases, no accounts.

3. HOW TO USE IT
No setup or login. Tap "Nytt spel" (New game), create a character and start. Tap where you want to walk; enter buildings through their doors. Inside a workplace, tap "Jobba ett pass" (Work a shift) to earn money.
Online: other players appear only when someone else plays at the same time. To see this, open https://8bitcat.github.io/snabbfilen/ in any web browser on a second device – it joins the same city.
- 💬 (top right) opens chat; messages appear as speech bubbles.
- 👥 (top right) lists players online. Each player has "Blockera" (block) and "Anmäl" (report).
- Voice chat is optional and off by default. The microphone permission is only requested when the player turns it on.

User-generated content safeguards (Guideline 1.2): player names and chat messages are filtered for offensive words. Block immediately hides that player's character, chat and voice, and can be undone in the 👥 list. Report opens a pre-filled e-mail to hello@8bitcat.io with the player's id and recent messages, and blocks the player at once. We act on reports within 24 hours. Support: https://8bitcat.github.io/snabbfilen/support.html

4. EXTERNAL SERVICES
- PeerJS public signaling server (0.peerjs.com): connects players to the shared city. Game data and voice then go directly between players (WebRTC).
- Google public STUN servers (stun.l.google.com): help WebRTC find a route between players.
- GitHub (8bitcat.github.io, api.github.com, GitHub Releases): the app checks for a newer version of the game content and downloads it as a bundle verified with a SHA-256 checksum. These updates add places, items and fixes; they do not change the app's purpose.
No analytics, advertising, payment, login or AI services. No personal data is collected (privacy policy: https://8bitcat.github.io/snabbfilen/integritet.html).

5. REGIONAL DIFFERENCES
None. The app works the same in every region where it is available. All in-game text is in Swedish.

6. REGULATED INDUSTRY / THIRD-PARTY MATERIAL
Not a regulated industry. The graphics are our own, except furniture sprites from a purchased commercial asset pack (EmanuelleDev). Music and sound effects are CC0 (public domain), fonts are open source (SIL Open Font License) and PeerJS is MIT-licensed.
```

**Skärminspelningen** (iPhone, cirka 3 minuter, Apple kräver att den börjar med att appen startas):
1. Lägg till skärminspelning: *Inställningar → Kontrollcenter → Skärminspelning*. Starta inspelningen från Kontrollcenter.
2. Starta Pixelcity från hemskärmen och tryck på **Nytt spel**. Skapa figuren, ge den ett namn och börja spela.
3. Gå ut ur husvagnen till Burgarbaren och tryck på **Jobba ett pass**. Jobba en kort stund.
4. Gå in i en butik, till exempel klädaffären, och köp något.
5. Öppna 8bitcat.github.io/snabbfilen på datorn med en annan figur (den hamnar i samma stad). Gå till samma ställe som telefonen.
6. Skriv något i 💬 på datorn så att bubblan syns på telefonen. Skriv sedan något från telefonen.
7. Öppna 👥 på telefonen och tryck på **Blockera**. Visa att figuren försvinner, och tryck sedan på **Ta bort blockering**.
8. Tryck på **Anmäl**, välj ett skäl och visa att mejlet till hello@8bitcat.io öppnas (det behöver inte skickas).
9. Stoppa inspelningen. Lägg upp filmen som "olistad" på YouTube eller som delad länk i Google Drive (alla med länken), och klistra in länken i texten ovan.

## Version 1.1 (notiser)

Bygg i Codemagic (ios-testflight; app/package.json appVersion "1.1"). Skapa sedan **iOS 1.1** i App Store Connect (Distribution → + Version), välj bygget och klistra in:

**What's New in This Version**
```
Notiser! Pixelcity kan nu säga till när det händer något i Pixelstaden, som när det blir Halloween eller jul. Spelet frågar en gång, och du kan slå på eller av notiserna under Inställningar.
```

**Tillägg i Notes (App Review):**
```
Version 1.1 adds optional local notifications for in-game events (e.g. Halloween, Christmas). The game asks once after the first in-game day; it can be turned on/off under Inställningar (Settings) in the main menu, where "Prova" (Try) sends a test notification after 5 seconds. Notifications are scheduled on the device only – no server, no push tokens, no data leaves the device.
```

## Version 1.3 (köp i appen – 🛍️ Butiken, 2026-11-18)

Spelet: v0.139.0 (js/core/kop.js, Butik i mobilen – syns bara i appen). Appen: `@capgo/native-purchases` (StoreKit 2)
i app/package.json + app/ios/App/CapApp-SPM/Package.swift, appVersion "1.3". Köp kräver ingen ny
provisioneringsprofil (In-App Purchase är påslaget på alla App ID:n). **Bygg i Codemagic** (Start new build →
ios-testflight) och testa i TestFlight med ett **Sandbox-konto** (App Store Connect → Users and Access → Sandbox →
Test Accounts; på telefonen Inställningar → App Store → Sandbox-konto). Sandlådan tar inga riktiga pengar.

### Monetization → In-App Purchases (fem produkter)

| Reference Name | Product ID | Type | Pris (välj närmaste Apple-pris) |
|---|---|---|---|
| Pengapåse 1 000 kr | `io.eightbitcat.pixelcity.pengar.1000` | Consumable | 12 kr |
| Pengapåse 10 000 kr | `io.eightbitcat.pixelcity.pengar.10000` | Consumable | 49 kr |
| Lägenheten utan hyra | `io.eightbitcat.pixelcity.bostad.lagenhet` | Non-Consumable | 29 kr |
| Villan utan hyra | `io.eightbitcat.pixelcity.bostad.villa` | Non-Consumable | 59 kr |
| Takvåningen utan hyra | `io.eightbitcat.pixelcity.bostad.takvaning` | Non-Consumable | 99 kr |

Produkt-ID:n måste stämma exakt – spelet frågar Apple efter just dessa. **Availability:** alla länder.
**Review Screenshot** (samma bild till alla fem): `app/store/iap/butik-sv-2208x1242.jpg` – Apple kräver ett riktigt
skärmformat (5,5 tum liggande 2208×1242 fungerar; 2400×1520 gav IMAGE_INCORRECT_DIMENSIONS) och JPEG utan alfakanal.
**Allt ovan är UPPLAGT via App Store Connect API 2026-11-18** (skriptet asc-iap.mjs med nyckeln Codemagic, App Manager):
produkter, åtta språk, pris med Sverige som basland, 175 länder, granskningsbild och Review Notes. Pengapåse 1 000 kr
har Carls eget pris 9 kr (inte 12). Kvar för hand: koppla produkterna till versionen 1.3 och Add for Review.
**Review Notes** (samma till alla fem):
```
Open the phone button (bottom right) → "Butik" (Shop). The shop lists the five products with StoreKit prices. Money bags are consumables (added to the in-game wallet); rent-free homes are non-consumables (no deposit, no weekly rent in the game) with a "Restore Purchases" button in the same dialog. Purchased money does not count towards the in-game "Wealth" life goal. The shop only exists in the iOS app, never on the web version.
```

### App Store Localization per produkt (Display Name högst 30 tecken · Description högst 45)

**Pengapåse 1 000 kr**
| Språk | Display Name | Description |
|---|---|---|
| Svenska | Pengapåse 1 000 kr | 1 000 kr rakt i handkassan i Pixelstaden. |
| English (U.S.) | Money Bag $1,000 | $1,000 straight into your pocket. |
| Español | Bolsa de dinero 1.000 € | 1.000 € directos a tu bolsillo. |
| Deutsch | Geldbeutel 1.000 € | 1.000 € direkt in die Tasche. |
| Français | Sac d'argent 1 000 € | 1 000 € directement dans ta poche. |
| Polski | Sakiewka 1 000 zł | 1 000 zł prosto do kieszeni. |
| Italiano | Sacco di soldi 1.000 € | 1.000 € dritti in tasca. |
| Português | Saco de dinheiro 1.000 € | 1.000 € diretamente para o teu bolso. |

**Pengapåse 10 000 kr** – samma texter med 10 000 / $10,000 / 10.000 € / 10 000 € / 10 000 zł.

**Lägenheten utan hyra**
| Språk | Display Name | Description |
|---|---|---|
| Svenska | Lägenheten utan hyra | Flytta in utan insats, bo utan hyra. |
| English (U.S.) | The Apartment, rent-free | Move in with no deposit, live rent-free. |
| Español | El piso sin alquiler | Múdate sin entrada y vive sin alquiler. |
| Deutsch | Stadtwohnung ohne Miete | Ohne Kaution einziehen, ohne Miete wohnen. |
| Français | L'appartement sans loyer | Emménage sans caution, vis sans loyer. |
| Polski | Mieszkanie bez czynszu | Bez kaucji i bez czynszu, na zawsze. |
| Italiano | L'appartamento senza affitto | Senza caparra e senza affitto, per sempre. |
| Português | O Apartamento sem renda | Sem entrada e sem renda, para sempre. |

**Villan utan hyra**
| Språk | Display Name | Description |
|---|---|---|
| Svenska | Villan utan hyra | Eget hus med trädgård, ingen hyra. |
| English (U.S.) | The Villa, rent-free | Your own house with a garden, no rent. |
| Español | El chalet sin alquiler | Casa con jardín, sin entrada ni alquiler. |
| Deutsch | Villa ohne Miete | Eigenes Haus mit Garten, keine Miete. |
| Français | La villa sans loyer | Ta maison avec jardin, sans loyer. |
| Polski | Willa bez czynszu | Własny dom z ogrodem, bez czynszu. |
| Italiano | La villa senza affitto | Casa con giardino, senza affitto. |
| Português | A Vivenda sem renda | Casa com jardim, sem renda. |

**Takvåningen utan hyra**
| Språk | Display Name | Description |
|---|---|---|
| Svenska | Takvåningen utan hyra | Högst upp i Tornhuset, ingen hyra. |
| English (U.S.) | The Penthouse, rent-free | Top of Tower House, no deposit, no rent. |
| Español | El ático sin alquiler | Lo más alto de la torre, sin alquiler. |
| Deutsch | Penthouse ohne Miete | Ganz oben im Turmhaus, keine Miete. |
| Français | Le penthouse sans loyer | Tout en haut de la tour, sans loyer. |
| Polski | Penthouse bez czynszu | Na szczycie wieżowca, bez czynszu. |
| Italiano | L'attico senza affitto | In cima alla Torre, senza affitto. |
| Português | A Penthouse sem renda | No topo da Torre, sem renda. |

### Presentlådor (tre nya produkter, 2026-11-23 – spelet v0.171.0, ingen ny appversion behövs)

Carl 2026-11-22: "att man kan köpa presenter … du kan sätta priserna". Förbrukningsvaror som lägger en present i
mobilens 🎁 Presenter (samma uppackning som dagspresenterna). Innehållstypen är fast och står i butiken före köpet
(Apple 3.1.1 om slumpat innehåll): bara VILKET plagg/vilken möbel slumpas, lika troligt bland det man inte har.

| Reference Name | Product ID | Type | Pris |
|---|---|---|---|
| Liten present | `io.eightbitcat.pixelcity.present.liten` | Consumable | 9 kr |
| Mellanlådan | `io.eightbitcat.pixelcity.present.mellan` | Consumable | 29 kr |
| Stora lådan | `io.eightbitcat.pixelcity.present.stor` | Consumable | 59 kr |

Innehåll: Liten = en sak värd minst 150 kr (plagg, möbel eller kortpaket). Mellan = 500 kr + ett plagg + ett kortpaket.
Stor = 1 500 kr + plagg + möbel + kortpaket + guldpokal. Texterna på åtta språk ligger i `app/tools/asc-iap.mjs`
(PRODUKTER) och läggs upp med `node app/tools/asc-iap.mjs allt` (samma granskningsbild och uppdaterade Review Notes).
Efter 1.3 kan produkter av samma typ skickas till granskning utan ny appversion: **Add for Review** på var och en i
App Store Connect när `lista` visar READY_TO_SUBMIT.

### Distribution → iOS 1.3

Skapa versionen, välj Codemagic-bygget, och lägg till de fem produkterna under **In-App Purchases and Subscriptions**
på versionssidan (första gången granskas produkterna tillsammans med appen – tryck inte Add for Review på
produkterna innan bygget finns).

**What's New in This Version** (svenska)
```
Butiken! I mobilen finns nu en butik där du kan köpa pengapåsar och bostäder utan hyra. Köpen går via Apple, och Återställ köp hämtar dina bostäder på en ny telefon.
```
**What's New** (English)
```
The Shop! The phone now has a shop where you can buy money bags and rent-free homes. Purchases go through Apple, and Restore Purchases brings your homes to a new phone.
```
**Tillägg i Notes (App Review):**
```
Version 1.3 adds in-app purchases (StoreKit 2): two consumable money bags and three non-consumable rent-free homes. The shop is reached from the in-game phone (bottom right) → "Butik". Prices are shown from StoreKit before buying, "Restore Purchases" is in the same dialog, and purchases made with Ask to Buy are granted when approved. Nothing is sent to our servers; entitlements are read from StoreKit on device. The web version has no shop.
```

### Övrigt som ändras med köp
- **Business → Digital Services Act:** näringsidkarstatus måste vara *I'm a trader* när appen säljer något (namn,
  adress, e-post och telefon visas i EU-butiken).
- **Age Rating:** inget att ändra (köp är inte en fråga där). **App Privacy:** fortfarande *No* – köpen går via Apple,
  inget sparas hos oss.
- Texterna "Inga … köp i appen" ovan (1.0-beskrivningen och granskningsfilmen) gäller inte längre: byt till
  "Köp i appen: pengapåsar och bostäder utan hyra, inget krävs för att spela."

## App Information

- **Name:** Pixelcity  ·  **Subtitle** (högst 30 tecken):
```
Livet i Pixelstaden
```
- **Category:** Games → **Simulation** · andra kategori: **Family**
- **Privacy Policy URL:**
```
https://8bitcat.github.io/snabbfilen/integritet.html
```
- **Content Rights:** *Yes, it contains third-party content* → *I have the necessary rights* (köpt möbelgrafik och fria typsnitt).
- **Age Rating** (frågorna): svara **None/No** på allt om våld, sex, svordomar, alkohol/droger, spel om pengar, skräck, medicin och mogna teman. Under förmågor/capabilities: **Messaging and Chat / User-Generated Content: Yes** (chatt och röstchatt med andra spelare). **Advertising: No. Unrestricted Web Access: No. Parental Controls: No. Age Assurance: No.** Apple räknar själv fram åldersgränsen.

## App Privacy

- *Do you or your third-party partners collect data from this app?* → **No, we do not collect data from this app.**
  (Allt sparas på enheten; namn, chatt och röst går direkt till de andra spelarna i realtid och sparas inte någonstans.)

## Pricing and Availability

- **Price:** Free (0 kr)
- **Availability:** Sverige till att börja med – fler länder går att lägga till senare (spelet är på svenska).

## Business → Digital Services Act (EU)

- **Trader status:** *I'm not a trader* (gratis hobbyapp utan försäljning).

## Sist: skicka in

**Distribution → iOS 1.0 → Add for Review → Submit for Review.** Granskningen tar oftast 1–3 dagar. Svaret kommer till hello@8bitcat.io.
