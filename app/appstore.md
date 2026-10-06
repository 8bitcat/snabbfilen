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
