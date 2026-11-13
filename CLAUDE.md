# CLAUDE.md

Hinweise für Claude Code in diesem Projekt.

## Über das Projekt

`jtlernt` ist ein Lernprojekt. Gebaut wird eine **Familien-Einkaufsliste** für bis zu 4 Personen. Was die App können soll, steht in `SPEC.md`. Bei Fragen zum Umfang gilt immer `SPEC.md`.

Geplante Dateien:

- `index.html`, `style.css`, `app.js`: der Teil im Browser
- `server.js`: kleiner Server in JavaScript (Node.js), liefert die Seite aus und speichert die Liste
- `daten.json`: die gespeicherte Liste. Wird vom Server angelegt und kommt **nicht** in Git.
- `SPEC.md`: was gebaut wird
- `README.md`: Projektbeschreibung

## Starten

- Voraussetzung: **Node.js** ist installiert. Es gibt keinen Build-Schritt und kein `npm install`.
- Server starten: `node server.js`
- Ansehen: im Browser die Adresse öffnen, die der Server anzeigt (am PC `http://localhost:3000`, auf dem Handy die WLAN-Adresse des PCs).
- `index.html` einfach per Doppelklick zu öffnen reicht **nicht**, weil die Liste vom Server kommt.

## Regeln

- Immer auf **Deutsch** und in **einfacher Sprache** antworten.
- Nur **HTML, CSS und JavaScript** verwenden.
- **Keine externen Bibliotheken** (kein CDN, kein npm, keine Frameworks). Alles wird selbst geschrieben. Im Server ist nur erlaubt, was Node.js schon mitbringt (z. B. `http`, `fs`, `path`).
- **Keine Passwörter, Schlüssel oder Zugangsdaten** in Dateien schreiben.

## Wie Claude arbeiten soll

- Ohne Fachchinesisch erklären. Wenn ein Fachbegriff nötig ist (z. B. Commit, Push), ihn kurz erklären.
- Nach jeder Änderung sagen, was geändert wurde und wie man es ansieht (z. B. F5 im Browser, oder Server neu starten, wenn `server.js` geändert wurde).
- Offensichtliche Tippfehler in Texten, die auf die Webseite sollen, korrigieren und das kurz erwähnen.

## Git

- Name und E-Mail für Commits sind nur für dieses Repository eingestellt (`git config --local`), nicht global.
- Remote: `origin` → https://github.com/JT9002/jtlernt (Branch `main`).
- Nur committen oder pushen, wenn der Nutzer darum bittet.
- Commit-Nachrichten auf Deutsch, kurz und beschreibend.
