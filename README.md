# Mijn Overleggen - Installatie Handleiding

## 📱 Wat is dit?
Een web applicatie waarmee je overleggen en agendapunten kunt beheren. Werkt op je iPhone alsof het een echte app is!

## ✨ Functies
- ✅ Overleggen met datum toevoegen
- ✅ Overleggen zonder datum ("nog in te plannen")
- ✅ Agendapunten per overleg
- ✅ Automatisch grijs na verstrijken datum
- ✅ Push notificatie dag voor het overleg om 09:00
- ✅ Werkt offline
- ✅ Data blijft bewaard

## 🚀 Installatie Stap voor Stap

### STAP 1: GitHub Account
1. Ga naar [github.com](https://github.com)
2. Klik op "Sign up" (rechtsboven)
3. Maak een account aan (gratis)
4. Bevestig je email adres

### STAP 2: Repository Aanmaken
1. Log in op GitHub
2. Klik op de **+** rechtsboven
3. Kies **"New repository"**
4. Vul in:
   - Repository name: `overleggen-app` (of andere naam)
   - Zet op **Public** (belangrijk!)
   - Vink **NIET** aan: "Add a README file"
5. Klik **"Create repository"**

### STAP 3: Bestanden Uploaden
Je hebt deze bestanden nodig:
- `index.html` (de hoofdapplicatie)
- `manifest.json` (app configuratie)
- `sw.js` (offline functionaliteit)
- `icon.png` (app icoon)

**Uploaden via browser:**
1. Op je nieuwe repository pagina, klik **"uploading an existing file"**
2. Sleep alle 4 bestanden naar het scherm OF klik "choose your files"
3. Scroll naar beneden
4. Klik **"Commit changes"**

### STAP 4: GitHub Pages Activeren
1. Klik op **"Settings"** (tabblad bovenin repository)
2. Klik in het linkermenu op **"Pages"**
3. Bij "Source" selecteer: **"Deploy from a branch"**
4. Bij "Branch" selecteer: **"main"** en folder **"/ (root)"**
5. Klik **"Save"**
6. Wacht 1-2 minuten
7. Refresh de pagina
8. Bovenaan zie je nu: **"Your site is live at https://jouwnaam.github.io/overleggen-app/"**

### STAP 5: Op Je iPhone Installeren

#### A. Open de app in Safari
1. Open Safari op je iPhone
2. Ga naar: `https://jouwnaam.github.io/overleggen-app/`
   (vervang "jouwnaam" met je GitHub gebruikersnaam)

#### B. Voeg toe aan beginscherm
1. Tik op het **deel-icoon** 📤 (onderaan midden in Safari)
2. Scroll en tik op **"Zet op beginscherm"**
3. Pas de naam aan als je wilt (bijv. "Overleggen")
4. Tik **"Voeg toe"**

#### C. Geef toestemming voor notificaties
1. Open de app vanaf je beginscherm
2. Geef toestemming voor notificaties als dat gevraagd wordt
3. Klaar! 🎉

## 📖 Gebruik

### Overleg toevoegen
1. Tik op **+** rechtsboven
2. Vul naam in
3. Zet "Datum gepland" aan (of laat uit voor "nog in te plannen")
4. Vul datum en tijd in
5. Voeg agendapunten toe
6. Tik **Opslaan**

### Overleg bekijken/bewerken
1. Tik op een overleg in de lijst
2. Vink agendapunten af door erop te tikken
3. Tik **Bewerk** om aan te passen
4. Tik **Verwijder overleg** om te verwijderen

### Notificaties
- Je krijgt automatisch een notificatie de dag voor het overleg om 09:00
- In de notificatie staan alle agendapunten

## 🔧 Updates Maken

Als je iets wilt aanpassen aan de app:

1. Ga naar je repository op GitHub
2. Klik op het bestand dat je wilt aanpassen (bijv. `index.html`)
3. Klik op het potlood-icoon ✏️ (rechtsboven)
4. Maak je wijzigingen
5. Scroll naar beneden
6. Klik **"Commit changes"**
7. Wacht 1-2 minuten
8. Ververs de app op je iPhone (sluit af en open opnieuw)

## ❓ Problemen Oplossen

### App werkt niet
- Check of alle 4 bestanden geüpload zijn
- Check of GitHub Pages is geactiveerd (Settings → Pages)
- Wacht 2-3 minuten na activeren
- Probeer in een incognito Safari venster

### Notificaties komen niet
- Check of je toestemming hebt gegeven in iOS Settings → Safari → Websites
- Check of de app niet op "stil" staat
- Test met een overleg morgen om te zien of het werkt

### Data kwijt
- Data wordt lokaal opgeslagen in je browser
- Als je Safari cache wist, verlies je de data
- Tip: maak regelmatig een backup door overleggen op te schrijven

### App updatet niet
- Sluit de app volledig af (swipe omhoog)
- Open opnieuw
- Of: verwijder van beginscherm en voeg opnieuw toe

## 🔒 Privacy & Veiligheid

- ✅ Alle data blijft lokaal op je telefoon
- ✅ Niets wordt naar een server gestuurd
- ✅ Alleen jij hebt toegang tot je gegevens
- ✅ De code is volledig open source (te inspecteren op GitHub)

## 📝 Technische Details

- **Framework:** Vanilla JavaScript (geen externe dependencies)
- **Styling:** Custom CSS met iOS design guidelines
- **Storage:** LocalStorage API
- **Notificaties:** Notification API + setTimeout
- **Offline:** Service Worker caching
- **Hosting:** GitHub Pages (gratis, HTTPS)

## 🆘 Hulp Nodig?

Als je ergens niet uitkomt:
1. Check of alle stappen correct zijn uitgevoerd
2. Probeer de app in een incognito venster
3. Check de browser console voor errors (Safari → Develop → Show JavaScript Console)

## 📄 Licentie

Deze app is gemaakt voor persoonlijk gebruik. Gebruik en pas aan zoals je wilt!
