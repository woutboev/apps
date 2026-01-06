# Mijn Overleggen - Installatie Handleiding

## 📱 Wat is dit?

Een Progressive Web App om je overleggen en agendapunten bij te houden. Werkt volledig offline op je iPhone en stuurt je de dag voor een overleg een notificatie.

## ✨ Functies

- ✅ Overleggen toevoegen met of zonder datum
- ✅ Meerdere agendapunten per overleg
- ✅ Automatisch grijs na verstrijken datum
- ✅ Push notificaties de dag ervoor om 09:00 uur
- ✅ Onderscheid tussen "Geplande" en "Nog in te plannen" overleggen
- ✅ Agendapunten afvinken
- ✅ Werkt volledig offline
- ✅ Data wordt lokaal opgeslagen

## 🚀 Installatie - Stap voor Stap

### Stap 1: Upload naar GitHub Pages (gratis hosting)

1. **Maak een GitHub account** (als je die nog niet hebt)
   - Ga naar https://github.com
   - Klik op "Sign up"
   
2. **Maak een nieuwe repository**
   - Klik op het + icoon rechtsboven
   - Kies "New repository"
   - Naam: `overleg-app` (of een andere naam)
   - Maak hem **Public**
   - Klik "Create repository"

3. **Upload de bestanden**
   - Klik op "uploading an existing file"
   - Sleep alle 8 bestanden naar het upload vak:
     * index.html
     * styles.css
     * app.js
     * sw.js
     * manifest.json
     * icon-192.png
     * icon-512.png
     * README.md
   - Klik "Commit changes"

4. **Activeer GitHub Pages**
   - Ga naar "Settings" (tab bovenin)
   - Klik op "Pages" in het menu links
   - Bij "Source": kies "Deploy from a branch"
   - Bij "Branch": kies "main" en "/root"
   - Klik "Save"
   - Wacht 1-2 minuten

5. **Vind je app URL**
   - Refresh de Settings > Pages pagina
   - Bovenaan zie je nu: "Your site is live at https://jouwnaam.github.io/overleg-app/"
   - Dit is je app URL!

### Stap 2: Installeer op je iPhone

1. **Open Safari** op je iPhone
   - Plak de URL: `https://jouwnaam.github.io/overleg-app/`
   - De app laadt

2. **Voeg toe aan Home Screen**
   - Tik op het "Delen" icoon (vierkant met pijl omhoog)
   - Scroll naar beneden
   - Tik op "Zet op beginscherm" of "Add to Home Screen"
   - (Optioneel) Pas de naam aan
   - Tik "Voeg toe" rechtsboven

3. **Sta notificaties toe**
   - Open de app vanaf je home screen
   - Safari vraagt: "Wil je notificaties ontvangen?"
   - Tik "Sta toe" of "Allow"

4. **Klaar!** 🎉
   - De app staat nu op je home screen
   - Werkt offline
   - Stuurt notificaties

## 📖 Gebruik

### Overleg toevoegen
1. Tik op de **+** knop rechtsboven
2. Vul de naam in
3. (Optioneel) Vink "Datum gepland" aan en kies datum/tijd
4. Voeg agendapunten toe (tik + voor meer)
5. Tik "Opslaan"

### Overleg bekijken
- Tik op een overleg in de lijst
- Zie alle details en agendapunten
- Vink agendapunten af door op het bolletje te tikken

### Overleg bewerken
1. Open een overleg
2. Tik op het potlood icoon rechtsboven
3. Pas aan wat je wilt
4. Tik "Opslaan"

### Overleg verwijderen
1. Open een overleg
2. Tik op het prullenbak icoon rechtsboven
3. Bevestig

### Notificaties
- **Automatisch**: De dag voor een overleg krijg je om 09:00 een notificatie
- **Inhoud**: Naam + alle agendapunten
- **Vereist**: Je moet notificaties toegestaan hebben

## 🔒 Privacy & Veiligheid

- ✅ **Alle data blijft op je telefoon** - niets wordt naar een server gestuurd
- ✅ **Offline**: Werkt zonder internet
- ✅ **Geen tracking**: Geen analytics, geen cookies
- ✅ **Open source**: Je kunt de code inzien

## 🛠️ Problemen oplossen

### "De app doet het niet"
- Refresh de pagina (swipe omlaag)
- Check of je de laatste versie hebt
- Verwijder en installeer opnieuw vanaf home screen

### "Ik krijg geen notificaties"
- Ga naar iPhone Instellingen > Safari > Notificaties
- Check of notificaties aanstaan
- Open de app opnieuw en sta notificaties toe

### "Mijn data is weg"
- Check of je Safari niet in Privé-modus gebruikt
- Data wordt lokaal opgeslagen in Safari's storage
- Let op: Als je Safari's data wist, verdwijnt je data

### "De app laadt niet"
- Check je internetverbinding (eerste keer)
- Daarna werkt de app offline
- Clear Safari cache en probeer opnieuw

## 🔄 Updates

Als ik de app update:
1. Ik upload nieuwe bestanden naar GitHub
2. Je verwijdert de app van je home screen
3. Je voegt hem opnieuw toe (zie Stap 2)
4. Je data blijft bewaard!

## 💡 Tips

- **Overleggen zonder datum** zijn handig om ideeën voor toekomstige overleggen bij te houden
- **Agendapunten afvinken** tijdens het overleg helpt om bij te houden wat besproken is
- **Verstreken overleggen** worden automatisch grijs, maar blijven zichtbaar als archief
- **Swipe omlaag** in de lijst om te refreshen

## 📧 Hulp nodig?

Als je ergens niet uitkomt, laat het me weten!

## 🎨 Alternatieve Hosting Opties

Naast GitHub Pages kun je ook:

1. **Netlify** (ook gratis)
   - Sleep alle bestanden naar netlify.com/drop
   - Krijg direct een URL

2. **Vercel** (ook gratis)
   - Vergelijkbaar met Netlify
   - Sync met GitHub mogelijk

3. **Eigen webserver** (als je die hebt)
   - Upload alle bestanden naar een folder
   - Zorg voor HTTPS (vereist voor notificaties)

## 📝 Technische Details

Voor de geïnteresseerden:
- **Frontend**: Vanilla JavaScript (ES6+)
- **Styling**: CSS3 met iOS design guidelines
- **Storage**: LocalStorage API
- **Notificaties**: Notification API + setTimeout
- **PWA**: Service Worker voor offline functionaliteit
- **Geen dependencies**: Alles werkt zonder externe libraries

---

**Versie**: 1.0
**Laatste update**: Januari 2025
