# SPEC.md: Familien-Einkaufsliste

Diese Datei beschreibt, **was** gebaut werden soll. Wie gearbeitet wird, steht in `CLAUDE.md`.

---

## 1. Zweck

Eine gemeinsame Einkaufsliste für die Familie. Alle tragen ein, was fehlt. Wer einkaufen geht, hakt ab, was im Wagen liegt. Einkaufs-Aufträge können an ein Familienmitglied geschickt werden, und die Person sagt zu oder ab.

Die App soll **in einer Runde baubar** sein. Deshalb ist der Umfang bewusst klein gehalten.

---

## 2. Nutzer

- Eine Familie mit **höchstens 4 Personen**.
- Alle können **gleichzeitig** eintragen und abhaken, jeder auf seinem eigenen Gerät (Handy, Tablet oder PC).
- **Keine Anmeldung mit Passwort.** Beim ersten Öffnen wählt man seinen Namen aus. Das Gerät merkt sich die Auswahl.
- Die 4 Namen werden einmal festgelegt (siehe Abschnitt 5, „Einstellungen“).

---

## 3. Funktionen

### Muss (ohne das ist die App nicht fertig)

| Nr. | Funktion |
|-----|----------|
| M1 | **Eintrag hinzufügen:** Artikel (Pflicht) und Menge (freiwillig) eingeben, dann auf „Hinzufügen“ klicken oder Enter drücken. |
| M2 | **Neuester Eintrag oben:** Die Liste ist nach Zeit sortiert, der neueste Eintrag steht ganz oben. |
| M3 | **Tabelle mit Checkboxen:** Jede Zeile hat eine Checkbox zum Abhaken. |
| M4 | **Abhaken und zurücknehmen:** Ein Klick auf die Checkbox markiert den Artikel als gekauft (durchgestrichen). Ein zweiter Klick nimmt das zurück. |
| M5 | **Gleichzeitig nutzen:** Was eine Person einträgt oder abhakt, sehen die anderen spätestens nach **3 Sekunden**, ohne die Seite neu zu laden. |
| M6 | **Wer hat's eingetragen:** In jeder Zeile steht, wer den Artikel eingetragen hat. |
| M7 | **Auftrag senden:** Man wählt offene Artikel aus und schickt sie als Einkaufs-Auftrag an ein Familienmitglied. |
| M8 | **Auftrag annehmen oder ablehnen:** Die Person bekommt den Auftrag **in der App** deutlich angezeigt (Hinweis oben auf der Seite) und klickt auf „Annehmen“ oder „Ablehnen“. |
| M9 | **Status sehen:** Der Absender sieht, ob der Auftrag offen, angenommen oder abgelehnt ist. |
| M10 | **Erledigte löschen:** Ein Knopf „Gekaufte entfernen“ löscht alle abgehakten Artikel aus der Liste. |
| M11 | **Daten bleiben erhalten:** Nach einem Neustart von Server oder Browser ist die Liste noch da. |
| M12 | **Übersicht:** Eine eigene Ansicht zeigt alle Familienmitglieder (wie viele Aufträge gesendet und erhalten) und eine Tabelle mit allen Aufträgen: wann, von wem, an wen, welche Artikel, Status. |

### Soll (wenn Zeit ist, in dieser Runde)

| Nr. | Funktion |
|-----|----------|
| S1 | **Browser-Benachrichtigung:** Wenn ein neuer Auftrag kommt, erscheint zusätzlich eine Benachrichtigung des Browsers, solange die App in einem Tab offen ist. Das klappt nur dort, wo der Browser es erlaubt (siehe Abschnitt 7). |
| S2 | **Einzelnen Eintrag löschen** (kleiner Papierkorb-Knopf in der Zeile). |
| S3 | **Wer hat's gekauft:** Beim Abhaken wird gespeichert, wer abgehakt hat, und in der Zeile angezeigt. |
| S4 | **Uhrzeit** des Eintrags in der Tabelle anzeigen. |

### Bewusst nicht (nicht in dieser Runde)

- **Echte Push-Nachrichten bei geschlossener App.** Dafür bräuchte man einen Server im Internet mit HTTPS und geheimen Schlüsseln. Das passt nicht in eine Runde und nicht zu unseren Regeln (siehe Abschnitt 7).
- Anmeldung mit Passwort oder Benutzerkonten
- Mehrere Listen (z. B. „Drogerie“, „Baumarkt“)
- Kategorien, Preise, Fotos
- Nutzung von unterwegs über das Internet (nur im Heim-WLAN, siehe Abschnitt 7)
- Mehr als 4 Personen

---

## 4. Daten

Alle Daten liegen in **einer Datei auf dem Server**: `daten.json`. Diese Datei kommt **nicht** in Git.

**Familienmitglied**
| Feld | Beispiel | Bedeutung |
|------|----------|-----------|
| `name` | „Jörg“ | Name, höchstens 4 Personen |

**Eintrag (Artikel)**
| Feld | Beispiel | Bedeutung |
|------|----------|-----------|
| `id` | „a1b2c3“ | eindeutige Kennung |
| `artikel` | „Milch“ | was gekauft werden soll (Pflicht, höchstens 100 Zeichen) |
| `menge` | „2 Liter“ | freiwillig, höchstens 30 Zeichen |
| `von` | „Jörg“ | wer eingetragen hat |
| `erstelltAm` | 2026-11-13 15:30 | Zeitpunkt, bestimmt die Reihenfolge |
| `gekauft` | ja / nein | abgehakt oder nicht |
| `gekauftVon` | „Anna“ | wer abgehakt hat (Soll S3) |

**Auftrag**
| Feld | Beispiel | Bedeutung |
|------|----------|-----------|
| `id` | „x9y8z7“ | eindeutige Kennung |
| `von` | „Jörg“ | Absender |
| `an` | „Anna“ | Empfänger |
| `eintraege` | [„a1b2c3“, …] | welche Artikel gekauft werden sollen |
| `status` | offen / angenommen / abgelehnt | Antwort des Empfängers |
| `erstelltAm` | 2026-11-13 15:32 | Zeitpunkt |

---

## 5. Oberfläche

Gebaut für das **Smartphone** (am PC dieselbe Ansicht, mittig). Drei Bereiche, zwischen denen man über eine **Leiste unten** wechselt:

```
┌────────────────────────────┐
│ Einkaufsliste     Jörg ▾   │
├────────────────────────────┤
│ Neuer Auftrag von Anna     │
│ Brot, Butter               │
│ [ Annehmen ] [ Ablehnen ]  │
│                            │
│ Artikel [_______] [___] [+]│
│ ┌────────────────────────┐ │
│ │[ ] Butter      250 g 🗑│ │
│ │    von Tim · 15:42     │ │
│ │[x] ~~Äpfel~~   1 kg  🗑│ │
│ └────────────────────────┘ │
│ 3 offen · 1 gekauft        │
│          [Gekaufte entf.]  │
├────────────────────────────┤
│  Liste   Auftrag  Übersicht│
└────────────────────────────┘
```

- **Kopfzeile:** Titel des Bereichs und der eigene Name. Ein Klick auf den Namen wechselt die Person.
- **Liste:** Auftrags-Hinweis (nur wenn ein offener Auftrag für mich da ist, farbig), Eingabezeile, Tabelle mit Checkbox, Artikel (darunter klein: von wem, Uhrzeit, Auftrag), Menge und Löschen-Knopf. Gekaufte Artikel sind durchgestrichen und grau.
- **Auftrag senden:** Person über große Knöpfe wählen, offene Artikel anhaken, „Senden“. Danach eine Bestätigung. Darunter „Zuletzt gesendet“ mit Status.
- **Übersicht:** Karten für alle Familienmitglieder (gesendet und erhalten) und eine Tabelle mit allen Aufträgen.
- **Leiste unten:** Liste, Auftrag, Übersicht. Eine rote Zahl an „Liste“ zeigt offene Aufträge für mich.
- **Einstellungen:** Beim allerersten Start werden die bis zu 4 Namen eingegeben.
- Die Seite funktioniert **auf dem Handy** (schmaler Bildschirm) genauso wie am PC.
- Große Checkboxen und Knöpfe, damit man sie auch im Supermarkt gut trifft.

---

## 6. Technik

- **Nur HTML, CSS und JavaScript.** Keine externen Bibliotheken, kein npm, kein CDN.
- **Browser-Teil:** `index.html`, `style.css`, `app.js`
- **Server-Teil:** `server.js`. Ein kleiner Server in JavaScript mit **Node.js**. Er nutzt nur das, was Node.js schon mitbringt.
  - Er liefert die Seite an alle Geräte aus.
  - Er speichert die Liste in `daten.json`.
  - Die Geräte fragen den Server alle 3 Sekunden nach Neuigkeiten.
- **Starten:** `node server.js` auf einem PC im Heim-WLAN. Die anderen öffnen im Browser die angezeigte Adresse (z. B. `http://192.168.178.20:3000`).
- **Voraussetzung:** Node.js muss auf dem PC installiert sein. Auf diesem Rechner ist es **noch nicht installiert**.
- **Keine Passwörter oder Schlüssel** in Dateien.

---

## 7. Grenzen

- **Ein Server ist nötig.** Damit 4 Geräte dieselbe Liste sehen, muss sie an einer gemeinsamen Stelle liegen. Nur `index.html` zu öffnen reicht dafür nicht.
- **Nur im Heim-WLAN.** Der Server läuft auf einem PC zu Hause. Unterwegs im Supermarkt (mobile Daten) erreicht man ihn nicht. Tipp: Die Liste vor dem Losgehen öffnen. Ohne Verbindung zeigt die App einen Hinweis „Keine Verbindung“.
- **Der PC mit dem Server muss laufen**, solange jemand die App nutzt.
- **Push-Nachrichten:** Aufträge erscheinen nur, wenn die App offen ist. Browser-Benachrichtigungen (Soll S1) erlauben die Browser nur bei sicheren Adressen. Am PC mit `localhost` klappt das, auf dem Handy über die WLAN-Adresse meist nicht. Dort sieht man den farbigen Hinweis in der App.
- **Kein Schutz durch Passwort.** Jeder im WLAN, der die Adresse kennt, kann die Liste sehen und ändern.
- Wenn zwei Personen im selben Moment denselben Artikel ändern, gilt die letzte Änderung.

---

## 8. Abnahmekriterien

Die App ist fertig, wenn alle Punkte erfüllt sind:

1. [ ] `node server.js` startet ohne Fehler und zeigt die Adresse an, unter der die App erreichbar ist.
2. [ ] Beim ersten Start kann man bis zu 4 Namen eingeben. Ein 5. Name ist nicht möglich.
3. [ ] Man kann seinen Namen auswählen. Nach dem Neuladen der Seite ist er noch ausgewählt.
4. [ ] Ein neuer Artikel erscheint **ganz oben** in der Tabelle, mit dem Namen der Person, die ihn eingetragen hat.
5. [ ] Ein leerer Artikel kann nicht hinzugefügt werden.
6. [ ] Ein Klick auf die Checkbox streicht den Artikel durch. Ein zweiter Klick macht das rückgängig.
7. [ ] Zwei Browser-Fenster (oder zwei Geräte) sind offen. Was in einem eingetragen oder abgehakt wird, erscheint im anderen **innerhalb von 3 Sekunden**.
8. [ ] Jörg wählt zwei Artikel aus und schickt sie als Auftrag an Anna. Bei Anna erscheint innerhalb von 3 Sekunden der Hinweis mit beiden Artikeln.
9. [ ] Anna klickt „Annehmen“. Bei Jörg steht der Auftrag danach auf „angenommen“. Genauso für „Ablehnen“ → „abgelehnt“.
10. [ ] „Gekaufte entfernen“ löscht nur die abgehakten Artikel.
11. [ ] Server stoppen und neu starten: Die Liste und die Aufträge sind noch da.
12. [ ] Die Seite ist auf einem Handy-Bildschirm gut bedienbar, ohne seitliches Scrollen.
13. [ ] Wenn der Server nicht erreichbar ist, zeigt die App „Keine Verbindung“.
14. [ ] Im Code gibt es keine externen Bibliotheken und keine Passwörter oder Schlüssel.
15. [ ] In der Übersicht stehen alle Familienmitglieder und alle Aufträge mit Absender, Empfänger, Artikeln und Status. Ein neuer Auftrag erscheint dort innerhalb von 3 Sekunden.
