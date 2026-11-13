# jtlernt: Familien-Einkaufsliste

Eine gemeinsame Einkaufsliste für bis zu 4 Personen im Heim-WLAN. Was die App kann, steht in [SPEC.md](SPEC.md).

## Starten

1. [Node.js](https://nodejs.org) installieren (einmalig).
2. Im Projektordner ein Terminal öffnen und eingeben:

   ```
   node server.js
   ```

3. Die angezeigte Adresse im Browser öffnen:
   - am selben PC: `http://localhost:3000`
   - auf dem Handy (im selben WLAN): die Adresse hinter „Im WLAN (Handy)“

Beenden mit **Strg+C**.

Die Liste wird in `daten.json` gespeichert. Wer von vorne anfangen will (z. B. andere Namen), stoppt den Server und löscht diese Datei.
