'use strict';

// Kleiner Server für die Familien-Einkaufsliste.
// Er nutzt nur Module, die Node.js schon mitbringt (keine externen Bibliotheken).
// Starten mit:  node server.js

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const PORT = Number(process.env.PORT) || 3000;
const DATEN_DATEI = process.env.DATEN_DATEI || path.join(__dirname, 'daten.json');

const GRENZEN = {
  personen: 4,
  name: 30,
  artikel: 100,
  menge: 30,
  eintraege: 500,
  auftraege: 100,
  anfrage: 10 * 1024, // Bytes
};

// Nur diese Dateien liefert der Server an den Browser aus.
// Alles andere (z. B. daten.json oder server.js) bleibt unsichtbar.
const SEITEN = {
  '/': ['index.html', 'text/html; charset=utf-8'],
  '/index.html': ['index.html', 'text/html; charset=utf-8'],
  '/style.css': ['style.css', 'text/css; charset=utf-8'],
  '/app.js': ['app.js', 'text/javascript; charset=utf-8'],
};

class Anfragefehler extends Error {
  constructor(status, nachricht) {
    super(nachricht);
    this.status = status;
  }
}

// ---------- Daten laden und speichern ----------

function leererStand() {
  return { mitglieder: [], eintraege: [], auftraege: [] };
}

function laden() {
  try {
    const d = JSON.parse(fs.readFileSync(DATEN_DATEI, 'utf8'));
    return {
      mitglieder: Array.isArray(d.mitglieder) ? d.mitglieder : [],
      eintraege: Array.isArray(d.eintraege) ? d.eintraege : [],
      auftraege: Array.isArray(d.auftraege) ? d.auftraege : [],
    };
  } catch (fehler) {
    if (fehler.code !== 'ENOENT') {
      // Datei ist kaputt: Sicherheitskopie anlegen, damit nichts verloren geht.
      const kopie = `${DATEN_DATEI}.kaputt-${Date.now()}`;
      try {
        fs.copyFileSync(DATEN_DATEI, kopie);
      } catch {
        // Kopie hat nicht geklappt, trotzdem weitermachen.
      }
      console.error(`daten.json konnte nicht gelesen werden (${fehler.message}). Kopie: ${kopie}`);
    }
    return leererStand();
  }
}

function speichern() {
  const text = JSON.stringify(daten, null, 2);
  const zwischendatei = `${DATEN_DATEI}.tmp`;
  try {
    // Erst in eine Zwischendatei schreiben, dann umbenennen.
    // So ist daten.json nie halb geschrieben, falls der PC mittendrin ausgeht.
    fs.writeFileSync(zwischendatei, text, 'utf8');
    fs.renameSync(zwischendatei, DATEN_DATEI);
  } catch {
    // Unter Windows (z. B. mit OneDrive) klappt das Umbenennen manchmal nicht. Dann direkt schreiben.
    fs.writeFileSync(DATEN_DATEI, text, 'utf8');
  }
}

let daten = laden();

// ---------- Eingaben prüfen ----------

function textPruefen(wert, max, feld, pflicht) {
  if (wert === undefined || wert === null) wert = '';
  if (typeof wert !== 'string') throw new Anfragefehler(400, `${feld} muss ein Text sein.`);
  const text = wert.trim();
  if (pflicht && !text) throw new Anfragefehler(400, `${feld} darf nicht leer sein.`);
  if (text.length > max) throw new Anfragefehler(400, `${feld} darf höchstens ${max} Zeichen haben.`);
  return text;
}

function mitgliedPruefen(wert) {
  const name = textPruefen(wert, GRENZEN.name, 'Name', true);
  if (!daten.mitglieder.includes(name)) throw new Anfragefehler(400, 'Unbekanntes Familienmitglied.');
  return name;
}

function eintragFinden(id) {
  const eintrag = daten.eintraege.find((e) => e.id === id);
  if (!eintrag) throw new Anfragefehler(404, 'Diesen Artikel gibt es nicht mehr.');
  return eintrag;
}

// ---------- Aktionen ----------

function namenFestlegen(body) {
  if (daten.mitglieder.length > 0) throw new Anfragefehler(409, 'Die Namen sind schon festgelegt.');
  if (!Array.isArray(body.namen)) throw new Anfragefehler(400, 'Bitte Namen angeben.');
  const namen = body.namen.map((n) => textPruefen(n, GRENZEN.name, 'Name', false)).filter(Boolean);
  if (namen.length === 0) throw new Anfragefehler(400, 'Bitte mindestens einen Namen eingeben.');
  if (namen.length > GRENZEN.personen) {
    throw new Anfragefehler(400, `Höchstens ${GRENZEN.personen} Personen sind möglich.`);
  }
  const klein = namen.map((n) => n.toLowerCase());
  if (new Set(klein).size !== namen.length) throw new Anfragefehler(400, 'Jeder Name darf nur einmal vorkommen.');
  daten.mitglieder = namen;
}

function eintragHinzufuegen(body) {
  if (daten.eintraege.length >= GRENZEN.eintraege) {
    throw new Anfragefehler(409, 'Die Liste ist voll. Bitte gekaufte Artikel entfernen.');
  }
  daten.eintraege.unshift({
    id: crypto.randomUUID(),
    artikel: textPruefen(body.artikel, GRENZEN.artikel, 'Artikel', true),
    menge: textPruefen(body.menge, GRENZEN.menge, 'Menge', false),
    von: mitgliedPruefen(body.von),
    erstelltAm: Date.now(),
    gekauft: false,
    gekauftVon: null,
  });
}

function gekauftSetzen(id, body) {
  const eintrag = eintragFinden(id);
  const von = mitgliedPruefen(body.von);
  eintrag.gekauft = body.gekauft === true;
  eintrag.gekauftVon = eintrag.gekauft ? von : null;
}

function eintragLoeschen(id) {
  eintragFinden(id);
  daten.eintraege = daten.eintraege.filter((e) => e.id !== id);
}

function gekaufteEntfernen() {
  daten.eintraege = daten.eintraege.filter((e) => !e.gekauft);
}

function auftragSenden(body) {
  const von = mitgliedPruefen(body.von);
  const an = mitgliedPruefen(body.an);
  if (von === an) throw new Anfragefehler(400, 'Du kannst dir keinen Auftrag selbst schicken.');
  if (!Array.isArray(body.eintraege) || body.eintraege.length === 0) {
    throw new Anfragefehler(400, 'Bitte mindestens einen Artikel auswählen.');
  }
  const ids = [...new Set(body.eintraege)];
  const eintraege = ids.map((id) => eintragFinden(String(id)));
  const schonGekauft = eintraege.find((e) => e.gekauft);
  if (schonGekauft) throw new Anfragefehler(400, `„${schonGekauft.artikel}“ ist schon gekauft.`);

  daten.auftraege.unshift({
    id: crypto.randomUUID(),
    von,
    an,
    eintraege: eintraege.map((e) => e.id),
    // Die Namen werden mitgespeichert, damit der Auftrag lesbar bleibt,
    // auch wenn die Artikel später aus der Liste entfernt werden.
    artikel: eintraege.map((e) => e.artikel),
    status: 'offen',
    erstelltAm: Date.now(),
  });
  daten.auftraege = daten.auftraege.slice(0, GRENZEN.auftraege);
}

function auftragBeantworten(id, body) {
  const auftrag = daten.auftraege.find((a) => a.id === id);
  if (!auftrag) throw new Anfragefehler(404, 'Diesen Auftrag gibt es nicht mehr.');
  const von = mitgliedPruefen(body.von);
  if (von !== auftrag.an) throw new Anfragefehler(403, 'Nur der Empfänger kann den Auftrag beantworten.');
  if (body.status !== 'angenommen' && body.status !== 'abgelehnt') {
    throw new Anfragefehler(400, 'Antwort muss „angenommen“ oder „abgelehnt“ sein.');
  }
  if (auftrag.status !== 'offen') throw new Anfragefehler(409, 'Der Auftrag wurde schon beantwortet.');
  auftrag.status = body.status;
  auftrag.beantwortetAm = Date.now();
}

// ---------- Anfragen bearbeiten ----------

function bodyLesen(req) {
  return new Promise((resolve, reject) => {
    const teile = [];
    let groesse = 0;
    let zuGross = false;
    req.on('data', (teil) => {
      groesse += teil.length;
      if (groesse > GRENZEN.anfrage) zuGross = true;
      else teile.push(teil);
    });
    req.on('end', () => {
      if (zuGross) return reject(new Anfragefehler(413, 'Die Anfrage ist zu groß.'));
      const text = Buffer.concat(teile).toString('utf8');
      if (!text) return resolve({});
      try {
        const wert = JSON.parse(text);
        if (wert && typeof wert === 'object' && !Array.isArray(wert)) return resolve(wert);
      } catch {
        // unten als ungültig melden
      }
      reject(new Anfragefehler(400, 'Ungültige Daten.'));
    });
    req.on('error', reject);
  });
}

function jsonSenden(res, status, inhalt) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  res.end(JSON.stringify(inhalt));
}

function dateiSenden(res, datei, typ) {
  fs.readFile(path.join(__dirname, datei), (fehler, inhalt) => {
    if (fehler) {
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end(`${datei} konnte nicht gelesen werden.`);
      return;
    }
    res.writeHead(200, { 'Content-Type': typ, 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' });
    res.end(inhalt);
  });
}

async function bearbeiten(req, res) {
  const pfad = new URL(req.url, 'http://localhost').pathname;

  if (req.method === 'GET' && SEITEN[pfad]) return dateiSenden(res, ...SEITEN[pfad]);
  if (req.method === 'GET' && pfad === '/api/stand') return jsonSenden(res, 200, daten);
  if (req.method !== 'POST') throw new Anfragefehler(404, 'Nicht gefunden.');

  const body = await bodyLesen(req);
  let treffer;

  if (pfad === '/api/mitglieder') namenFestlegen(body);
  else if (pfad === '/api/eintraege') eintragHinzufuegen(body);
  else if (pfad === '/api/gekaufte-entfernen') gekaufteEntfernen();
  else if ((treffer = pfad.match(/^\/api\/eintraege\/([\w-]+)\/gekauft$/))) gekauftSetzen(treffer[1], body);
  else if ((treffer = pfad.match(/^\/api\/eintraege\/([\w-]+)\/loeschen$/))) eintragLoeschen(treffer[1]);
  else if (pfad === '/api/auftraege') auftragSenden(body);
  else if ((treffer = pfad.match(/^\/api\/auftraege\/([\w-]+)\/antwort$/))) auftragBeantworten(treffer[1], body);
  else throw new Anfragefehler(404, 'Nicht gefunden.');

  speichern();
  jsonSenden(res, 200, daten);
}

const server = http.createServer(async (req, res) => {
  try {
    await bearbeiten(req, res);
  } catch (fehler) {
    if (fehler instanceof Anfragefehler) {
      jsonSenden(res, fehler.status, { fehler: fehler.message });
    } else {
      console.error(fehler);
      jsonSenden(res, 500, { fehler: 'Auf dem Server ist ein Fehler passiert.' });
    }
  }
});

function wlanAdressen() {
  const adressen = [];
  for (const liste of Object.values(os.networkInterfaces())) {
    for (const a of liste || []) {
      if (a.family === 'IPv4' && !a.internal) adressen.push(a.address);
    }
  }
  return adressen;
}

server.on('error', (fehler) => {
  if (fehler.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} ist schon belegt. Läuft der Server vielleicht schon in einem anderen Fenster?`);
  } else {
    console.error(fehler);
  }
  process.exit(1);
});

server.listen(PORT, () => {
  console.log('Die Einkaufsliste läuft!');
  console.log(`  Auf diesem PC:     http://localhost:${PORT}`);
  for (const adresse of wlanAdressen()) {
    console.log(`  Im WLAN (Handy):   http://${adresse}:${PORT}`);
  }
  console.log('Beenden mit Strg+C');
});
