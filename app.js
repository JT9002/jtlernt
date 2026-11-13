'use strict';

// Der Teil der Einkaufsliste, der im Browser läuft.
// Er holt alle 3 Sekunden den aktuellen Stand vom Server und zeigt ihn an.

const INTERVALL_MS = 3000;
const SPEICHER_NAME = 'einkaufsliste-ich';
const STATUS_ZEICHEN = { offen: '…', angenommen: '✔', abgelehnt: '✘' };

let stand = null; // { mitglieder, eintraege, auftraege } vom Server
let ich = gespeicherterName();
let personWechseln = false;
let ansicht = 'liste'; // 'liste' oder 'uebersicht'
let ersterAbruf = true;
const auftragAuswahl = new Set(); // ausgewählte Artikel im Bereich „Auftrag senden“
const bekannteAuftraege = new Set(); // damit jede Benachrichtigung nur einmal kommt

const $ = (id) => document.getElementById(id);

// ---------- Name auf diesem Gerät merken ----------

function gespeicherterName() {
  try {
    return localStorage.getItem(SPEICHER_NAME);
  } catch {
    return null;
  }
}

function nameMerken(name) {
  try {
    localStorage.setItem(SPEICHER_NAME, name);
  } catch {
    // Speichern nicht möglich (z. B. privates Fenster). Dann gilt der Name nur bis zum Neuladen.
  }
}

// ---------- Mit dem Server sprechen ----------

// Ohne „daten“ wird nur gelesen (GET), mit „daten“ wird etwas geändert (POST).
// Bei Erfolg kommt immer der ganze neue Stand zurück.
async function anfrage(pfad, daten) {
  const optionen =
    daten === undefined
      ? { cache: 'no-store' }
      : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(daten) };

  let antwort;
  try {
    antwort = await fetch(pfad, optionen);
  } catch {
    $('verbindung').hidden = false;
    if (daten !== undefined) meldungAnzeigen('Keine Verbindung. Die Änderung wurde nicht gespeichert.');
    return null;
  }
  $('verbindung').hidden = true;

  const inhalt = await antwort.json().catch(() => ({}));
  if (!antwort.ok) {
    meldungAnzeigen(inhalt.fehler || 'Etwas ist schiefgegangen.');
    return null;
  }
  standUebernehmen(inhalt);
  return inhalt;
}

async function regelmaessigAbrufen() {
  await anfrage('/api/stand');
  setTimeout(regelmaessigAbrufen, INTERVALL_MS);
}

let meldungTimer;
function meldungAnzeigen(text) {
  const feld = $('meldung');
  feld.textContent = text;
  feld.hidden = false;
  clearTimeout(meldungTimer);
  meldungTimer = setTimeout(() => {
    feld.hidden = true;
  }, 5000);
}

function standUebernehmen(neu) {
  stand = neu;
  neueAuftraegeMelden();
  ersterAbruf = false;
  anzeigen();
}

// ---------- Aufträge für mich ----------

function offeneAuftraegeFuerMich() {
  if (!stand || !ich) return [];
  return stand.auftraege.filter((a) => a.an === ich && a.status === 'offen');
}

function alleOffenenAlsBekanntMerken() {
  for (const a of offeneAuftraegeFuerMich()) bekannteAuftraege.add(a.id);
}

function neueAuftraegeMelden() {
  for (const auftrag of offeneAuftraegeFuerMich()) {
    if (bekannteAuftraege.has(auftrag.id)) continue;
    bekannteAuftraege.add(auftrag.id);
    if (!ersterAbruf) browserBenachrichtigung(auftrag);
  }
}

function benachrichtigungMoeglich() {
  return 'Notification' in window && window.isSecureContext;
}

function browserBenachrichtigung(auftrag) {
  if (!benachrichtigungMoeglich() || Notification.permission !== 'granted') return;
  try {
    new Notification('Neuer Einkaufs-Auftrag', { body: `${auftrag.von}: ${auftrag.artikel.join(', ')}` });
  } catch {
    // Manche Handy-Browser erlauben das so nicht. Dann bleibt der Hinweis in der App.
  }
}

// ---------- Anzeigen ----------

function anzeigen() {
  if (!stand) return;
  $('laden').hidden = true;

  const mitglieder = stand.mitglieder;
  const einrichten = mitglieder.length === 0;
  const auswahl = !einrichten && (personWechseln || !ich || !mitglieder.includes(ich));

  const normal = !einrichten && !auswahl;

  $('einrichten').hidden = !einrichten;
  $('auswahl').hidden = !auswahl;
  $('liste').hidden = !normal || ansicht !== 'liste';
  $('uebersicht').hidden = !normal || ansicht !== 'uebersicht';
  $('ich-knopf').hidden = !normal;
  $('ansicht-knopf').hidden = !normal;
  $('ansicht-knopf').textContent = ansicht === 'liste' ? 'Übersicht' : 'Zur Liste';

  if (auswahl) {
    auswahlAnzeigen();
  } else if (normal) {
    $('ich-name').textContent = ich;
    if (ansicht === 'liste') listeAnzeigen();
    else uebersichtAnzeigen();
  }

  const anzahl = offeneAuftraegeFuerMich().length;
  document.title = anzahl > 0 ? `(${anzahl}) Einkaufsliste` : 'Einkaufsliste';
}

function auswahlAnzeigen() {
  const bereich = $('auswahl-knoepfe');
  const schluessel = stand.mitglieder.join('|');
  if (bereich.dataset.namen === schluessel) return; // nichts geändert
  bereich.dataset.namen = schluessel;
  bereich.replaceChildren(
    ...stand.mitglieder.map((name) => {
      const knopf = document.createElement('button');
      knopf.type = 'button';
      knopf.textContent = name;
      knopf.addEventListener('click', () => {
        ich = name;
        nameMerken(name);
        personWechseln = false;
        alleOffenenAlsBekanntMerken();
        anzeigen();
      });
      return knopf;
    }),
  );
}

function listeAnzeigen() {
  $('benachrichtigung-knopf').hidden = !(benachrichtigungMoeglich() && Notification.permission === 'default');
  auftraegeFuerMichAnzeigen();
  tabelleAnzeigen();
  gesendeteAnzeigen();
  if (!$('auftrag-panel').hidden) auftragArtikelAnzeigen();
}

function auftraegeFuerMichAnzeigen() {
  $('auftraege-fuer-mich').replaceChildren(
    ...offeneAuftraegeFuerMich().map((auftrag) => {
      const box = document.createElement('div');
      box.className = 'hinweis hinweis-auftrag';

      const text = document.createElement('span');
      text.textContent = `⚠ Neuer Auftrag von ${auftrag.von}: ${auftrag.artikel.join(', ')}`;

      const knoepfe = document.createElement('span');
      knoepfe.className = 'knoepfe';
      knoepfe.append(
        knopf('Annehmen', '', () => antworten(auftrag.id, 'angenommen')),
        knopf('Ablehnen', 'knopf-zweit', () => antworten(auftrag.id, 'abgelehnt')),
      );

      box.append(text, knoepfe);
      return box;
    }),
  );
}

function tabelleAnzeigen() {
  const eintraege = [...stand.eintraege].sort((a, b) => b.erstelltAm - a.erstelltAm);
  $('leer').hidden = eintraege.length > 0;

  $('tabelle-inhalt').replaceChildren(
    ...eintraege.map((e) => {
      const zeile = document.createElement('tr');
      if (e.gekauft) zeile.className = 'gekauft';

      // Checkbox zum Abhaken
      const box = document.createElement('input');
      box.type = 'checkbox';
      box.checked = e.gekauft;
      box.setAttribute('aria-label', `${e.artikel} gekauft`);
      box.addEventListener('change', () => {
        anfrage(`/api/eintraege/${encodeURIComponent(e.id)}/gekauft`, { gekauft: box.checked, von: ich });
      });

      // Artikel, darunter (nur auf dem Handy) die weiteren Infos
      const auftrag = auftragZuEintrag(e.id);
      const name = document.createElement('span');
      name.className = 'artikel-name';
      name.textContent = e.artikel;
      const infoHandy = kleinerText(
        [`von ${e.von}`, uhrzeit(e.erstelltAm), e.gekauftVon && `gekauft: ${e.gekauftVon}`, auftrag && auftragText(auftrag)]
          .filter(Boolean)
          .join(' · '),
      );
      infoHandy.classList.add('nur-schmal');

      // Spalte „von“: Name, Uhrzeit, wer gekauft hat
      const von = document.createElement('td');
      von.className = 'nur-breit';
      von.append(e.von, kleinerText(uhrzeit(e.erstelltAm)));
      if (e.gekauftVon) von.append(kleinerText(`gekauft: ${e.gekauftVon}`));

      // Spalte „Auftrag“
      const auftragZelle = document.createElement('td');
      auftragZelle.className = 'nur-breit';
      if (auftrag) {
        auftragZelle.textContent = auftragText(auftrag);
        auftragZelle.title = `Auftrag von ${auftrag.von}: ${auftrag.status}`;
      }

      const loeschen = knopf('🗑', 'loeschen-knopf', () => {
        if (confirm(`„${e.artikel}“ löschen?`)) anfrage(`/api/eintraege/${encodeURIComponent(e.id)}/loeschen`, {});
      });
      loeschen.setAttribute('aria-label', `${e.artikel} löschen`);
      loeschen.title = 'Löschen';

      zeile.append(
        zelle('spalte-check', box),
        zelle('', name, infoHandy),
        zelle('', e.menge),
        von,
        auftragZelle,
        zelle('', loeschen),
      );
      return zeile;
    }),
  );
}

function gesendeteAnzeigen() {
  const meine = stand.auftraege
    .filter((a) => a.von === ich)
    .sort((a, b) => b.erstelltAm - a.erstelltAm)
    .slice(0, 10);
  $('gesendet-leer').hidden = meine.length > 0;
  $('gesendet-liste').replaceChildren(
    ...meine.map((a) => {
      const punkt = document.createElement('li');
      const status = document.createElement('span');
      status.className = `status status-${a.status}`;
      status.textContent = a.status;
      punkt.append(`an ${a.an}: ${a.artikel.join(', ')} → `, status, kleinerText(uhrzeit(a.erstelltAm)));
      return punkt;
    }),
  );
}

function auftragArtikelAnzeigen() {
  const offene = stand.eintraege.filter((e) => !e.gekauft).sort((a, b) => b.erstelltAm - a.erstelltAm);
  // Artikel, die inzwischen gekauft oder gelöscht sind, aus der Auswahl nehmen
  for (const id of auftragAuswahl) {
    if (!offene.some((e) => e.id === id)) auftragAuswahl.delete(id);
  }
  if (offene.length === 0) {
    const leer = document.createElement('p');
    leer.className = 'leer';
    leer.textContent = 'Keine offenen Artikel.';
    $('auftrag-artikel').replaceChildren(leer);
    return;
  }
  $('auftrag-artikel').replaceChildren(
    ...offene.map((e) => {
      const label = document.createElement('label');
      const box = document.createElement('input');
      box.type = 'checkbox';
      box.checked = auftragAuswahl.has(e.id);
      box.addEventListener('change', () => {
        if (box.checked) auftragAuswahl.add(e.id);
        else auftragAuswahl.delete(e.id);
      });
      label.append(box, e.menge ? `${e.artikel} (${e.menge})` : e.artikel);
      return label;
    }),
  );
}

function uebersichtAnzeigen() {
  const auftraege = [...stand.auftraege].sort((a, b) => b.erstelltAm - a.erstelltAm);

  // Eine Karte pro Person: wie viele Aufträge gesendet und erhalten
  $('personen').replaceChildren(
    ...stand.mitglieder.map((name) => {
      const gesendet = auftraege.filter((a) => a.von === name);
      const erhalten = auftraege.filter((a) => a.an === name);

      const karte = document.createElement('div');
      karte.className = 'person';
      const titel = document.createElement('h3');
      titel.textContent = name === ich ? `${name} (du)` : name;
      karte.append(
        titel,
        absatz(`Gesendet: ${gesendet.length}${statusZaehlen(gesendet)}`),
        absatz(`Erhalten: ${erhalten.length}${statusZaehlen(erhalten)}`),
      );
      return karte;
    }),
  );

  // Tabelle mit allen Aufträgen, neueste zuerst
  $('alle-auftraege-leer').hidden = auftraege.length > 0;
  $('alle-auftraege').replaceChildren(
    ...auftraege.map((a) => {
      const zeile = document.createElement('tr');
      const status = document.createElement('span');
      status.className = `status status-${a.status}`;
      status.textContent = `${STATUS_ZEICHEN[a.status] || ''} ${a.status}`;
      const zeitHandy = kleinerText(uhrzeit(a.erstelltAm));
      zeitHandy.classList.add('nur-schmal');

      zeile.append(
        zelle('nur-breit', uhrzeit(a.erstelltAm)),
        zelle('', a.von),
        zelle('', a.an),
        zelle('', a.artikel.join(', '), zeitHandy),
        zelle('', status),
      );
      return zeile;
    }),
  );
}

// z. B. " (1 offen, 2 angenommen)", oder nichts, wenn es keine Aufträge gibt
function statusZaehlen(auftraege) {
  const teile = ['offen', 'angenommen', 'abgelehnt']
    .map((s) => [s, auftraege.filter((a) => a.status === s).length])
    .filter(([, anzahl]) => anzahl > 0)
    .map(([s, anzahl]) => `${anzahl} ${s}`);
  return teile.length ? ` (${teile.join(', ')})` : '';
}

// ---------- Kleine Helfer ----------

function absatz(text) {
  const p = document.createElement('p');
  p.textContent = text;
  return p;
}

function zelle(klasse, ...inhalt) {
  const td = document.createElement('td');
  if (klasse) td.className = klasse;
  td.append(...inhalt);
  return td;
}

function knopf(text, klasse, beiKlick) {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = text;
  if (klasse) b.className = klasse;
  b.addEventListener('click', beiKlick);
  return b;
}

function kleinerText(text) {
  const span = document.createElement('span');
  span.className = 'klein';
  span.textContent = text;
  return span;
}

function uhrzeit(zeitpunkt) {
  const datum = new Date(zeitpunkt);
  const heute = new Date().toDateString() === datum.toDateString();
  return heute
    ? datum.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
    : datum.toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

// Der neueste Auftrag, in dem dieser Artikel vorkommt
function auftragZuEintrag(id) {
  return stand.auftraege
    .filter((a) => a.eintraege.includes(id))
    .sort((a, b) => b.erstelltAm - a.erstelltAm)[0];
}

function auftragText(auftrag) {
  return `→ ${auftrag.an} ${STATUS_ZEICHEN[auftrag.status] || ''}`;
}

function antworten(id, status) {
  anfrage(`/api/auftraege/${encodeURIComponent(id)}/antwort`, { status, von: ich });
}

// ---------- Knöpfe und Formulare ----------

$('einrichten-form').addEventListener('submit', (ereignis) => {
  ereignis.preventDefault();
  const namen = [...ereignis.target.elements.name].map((feld) => feld.value.trim()).filter(Boolean);
  anfrage('/api/mitglieder', { namen });
});

$('ich-knopf').addEventListener('click', () => {
  personWechseln = true;
  $('auftrag-panel').hidden = true;
  anzeigen();
});

$('ansicht-knopf').addEventListener('click', () => {
  ansicht = ansicht === 'liste' ? 'uebersicht' : 'liste';
  $('auftrag-panel').hidden = true;
  anzeigen();
  window.scrollTo(0, 0);
});

$('eintrag-form').addEventListener('submit', async (ereignis) => {
  ereignis.preventDefault();
  const artikel = $('artikel').value.trim();
  if (!artikel) {
    meldungAnzeigen('Bitte einen Artikel eingeben.');
    return;
  }
  const ergebnis = await anfrage('/api/eintraege', { artikel, menge: $('menge').value.trim(), von: ich });
  if (ergebnis) {
    $('artikel').value = '';
    $('menge').value = '';
    $('artikel').focus();
  }
});

$('gekaufte-entfernen').addEventListener('click', () => {
  const anzahl = stand.eintraege.filter((e) => e.gekauft).length;
  if (anzahl === 0) {
    meldungAnzeigen('Es gibt noch keine gekauften Artikel.');
    return;
  }
  if (confirm(`${anzahl} gekaufte Artikel entfernen?`)) anfrage('/api/gekaufte-entfernen', {});
});

$('auftrag-oeffnen').addEventListener('click', () => {
  const andere = stand.mitglieder.filter((name) => name !== ich);
  if (andere.length === 0) {
    meldungAnzeigen('Es gibt keine anderen Familienmitglieder.');
    return;
  }
  $('auftrag-an').replaceChildren(
    ...andere.map((name) => {
      const option = document.createElement('option');
      option.value = name;
      option.textContent = name;
      return option;
    }),
  );
  auftragAuswahl.clear();
  auftragArtikelAnzeigen();
  $('auftrag-panel').hidden = false;
  $('auftrag-panel').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
});

$('auftrag-abbrechen').addEventListener('click', () => {
  $('auftrag-panel').hidden = true;
});

$('auftrag-senden').addEventListener('click', async () => {
  if (auftragAuswahl.size === 0) {
    meldungAnzeigen('Bitte mindestens einen Artikel auswählen.');
    return;
  }
  const ergebnis = await anfrage('/api/auftraege', {
    von: ich,
    an: $('auftrag-an').value,
    eintraege: [...auftragAuswahl],
  });
  if (ergebnis) {
    auftragAuswahl.clear();
    $('auftrag-panel').hidden = true;
  }
});

$('benachrichtigung-knopf').addEventListener('click', async () => {
  await Notification.requestPermission();
  anzeigen();
});

// Wenn man zur App zurückkehrt, sofort den neuesten Stand holen
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') anfrage('/api/stand');
});

regelmaessigAbrufen();
