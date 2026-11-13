'use strict';

// Der Teil der Einkaufsliste, der im Browser läuft.
// Er holt alle 3 Sekunden den aktuellen Stand vom Server und zeigt ihn an.

const INTERVALL_MS = 3000;
const SPEICHER_NAME = 'einkaufsliste-ich';
const STATUS_ZEICHEN = { offen: '…', angenommen: '✔', abgelehnt: '✘' };
const TITEL = { liste: 'Einkaufsliste', auftrag: 'Auftrag senden', uebersicht: 'Übersicht' };

let stand = null; // { mitglieder, eintraege, auftraege } vom Server
let ich = gespeicherterName();
let personWechseln = false;
let ersterAbruf = true;
let ansicht = 'liste'; // 'liste', 'auftrag' oder 'uebersicht'

// Für die Ansicht „Auftrag senden“
let auftragAn = null;
const auftragAuswahl = new Set();
let auftragGesendet = null; // { an, artikel } nach dem Senden, für die Bestätigung

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

let antwortTimer;
function antwortInfoAnzeigen(text) {
  const feld = $('antwort-info');
  feld.textContent = text;
  feld.hidden = false;
  clearTimeout(antwortTimer);
  antwortTimer = setTimeout(() => {
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
  for (const name of Object.keys(TITEL)) {
    $(`ansicht-${name}`).hidden = !normal || ansicht !== name;
  }
  $('navigation').hidden = !normal;
  $('ich-knopf').hidden = !normal;
  $('titel').textContent = normal ? TITEL[ansicht] : 'Einkaufsliste';
  document.body.classList.toggle('mit-navigation', normal);

  if (auswahl) {
    auswahlAnzeigen();
  } else if (normal) {
    $('ich-name').textContent = ich;
    navigationAnzeigen();
    if (ansicht === 'liste') listeAnzeigen();
    else if (ansicht === 'auftrag') auftragAnzeigen();
    else uebersichtAnzeigen();
  }

  const anzahl = offeneAuftraegeFuerMich().length;
  document.title = anzahl > 0 ? `(${anzahl}) Einkaufsliste` : 'Einkaufsliste';
}

function auswahlAnzeigen() {
  const bereich = $('auswahl-knoepfe');
  const namenListe = stand.mitglieder.join('|');
  if (bereich.dataset.namen === namenListe) return; // nichts geändert
  bereich.dataset.namen = namenListe;
  bereich.replaceChildren(
    ...stand.mitglieder.map((name) =>
      knopf(name, '', () => {
        ich = name;
        nameMerken(name);
        personWechseln = false;
        alleOffenenAlsBekanntMerken();
        anzeigen();
      }),
    ),
  );
}

function navigationAnzeigen() {
  for (const b of document.querySelectorAll('#navigation [data-ansicht]')) {
    if (b.dataset.ansicht === ansicht) b.setAttribute('aria-current', 'page');
    else b.removeAttribute('aria-current');
  }
  const anzahl = offeneAuftraegeFuerMich().length;
  $('badge').hidden = anzahl === 0;
  $('badge').textContent = anzahl;
}

// ---------- Ansicht 1: Liste ----------

function listeAnzeigen() {
  $('benachrichtigung-knopf').hidden = !(benachrichtigungMoeglich() && Notification.permission === 'default');
  auftraegeFuerMichAnzeigen();
  tabelleAnzeigen();

  const gekauft = stand.eintraege.filter((e) => e.gekauft).length;
  $('zaehler').textContent = `${stand.eintraege.length - gekauft} offen · ${gekauft} gekauft`;
}

function auftraegeFuerMichAnzeigen() {
  $('auftraege-fuer-mich').replaceChildren(
    ...offeneAuftraegeFuerMich().map((auftrag) => {
      const box = document.createElement('section');
      box.className = 'hinweis hinweis-auftrag';
      box.setAttribute('aria-label', 'Neuer Auftrag');

      const text = document.createElement('p');
      const titel = document.createElement('strong');
      titel.textContent = `Neuer Auftrag von ${auftrag.von}`;
      text.append(titel, document.createElement('br'), auftrag.artikel.join(', '));

      const knoepfe = document.createElement('div');
      knoepfe.className = 'knoepfe';
      knoepfe.append(
        knopf('Annehmen', '', () => antworten(auftrag, 'angenommen')),
        knopf('Ablehnen', 'knopf-zweit', () => antworten(auftrag, 'abgelehnt')),
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

      // Artikel, darunter klein: wer, wann, Auftrag
      const name = document.createElement('span');
      name.className = 'artikel-name';
      name.textContent = e.artikel;
      const auftrag = auftragZuEintrag(e.id);
      const info = e.gekauft
        ? [`gekauft von ${e.gekauftVon || '?'}`]
        : [`von ${e.von}`, uhrzeit(e.erstelltAm), auftrag && auftragText(auftrag)];

      // Löschen-Knopf mit Mülleimer-Symbol
      const loeschen = knopf('', 'loeschen-knopf', () => {
        if (confirm(`„${e.artikel}“ löschen?`)) anfrage(`/api/eintraege/${encodeURIComponent(e.id)}/loeschen`, {});
      });
      loeschen.append($('icon-loeschen').content.cloneNode(true));
      loeschen.setAttribute('aria-label', `${e.artikel} löschen`);
      loeschen.title = 'Löschen';

      zeile.append(
        zelle('spalte-check', box),
        zelle('', name, kleinerText(info.filter(Boolean).join(' · '))),
        zelle('', e.menge),
        zelle('', loeschen),
      );
      return zeile;
    }),
  );
}

// ---------- Ansicht 2: Auftrag senden ----------

function auftragAnzeigen() {
  $('auftrag-formular').hidden = Boolean(auftragGesendet);
  $('auftrag-gesendet').hidden = !auftragGesendet;

  if (auftragGesendet) {
    $('auftrag-gesendet-text').textContent =
      `${auftragGesendet.an} soll kaufen: ${auftragGesendet.artikel.join(', ')}.`;
  } else {
    personenWahlAnzeigen();
    auftragArtikelAnzeigen();
    sendenKnopfAnzeigen();
  }
  gesendeteAnzeigen();
}

function personenWahlAnzeigen() {
  const andere = stand.mitglieder.filter((name) => name !== ich);
  if (!andere.includes(auftragAn)) auftragAn = andere[0] || null;

  if (andere.length === 0) {
    const leer = document.createElement('p');
    leer.className = 'leer';
    leer.textContent = 'Es gibt keine anderen Familienmitglieder.';
    $('auftrag-personen').replaceChildren(leer);
    return;
  }
  $('auftrag-personen').replaceChildren(
    ...andere.map((name) => {
      const b = knopf(name, '', () => {
        auftragAn = name;
        auftragAnzeigen();
      });
      b.setAttribute('aria-pressed', String(name === auftragAn));
      return b;
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
        sendenKnopfAnzeigen();
      });
      const name = document.createElement('span');
      name.className = 'name';
      name.textContent = e.artikel;
      const menge = document.createElement('span');
      menge.className = 'menge';
      menge.textContent = e.menge;
      label.append(box, name, menge);
      return label;
    }),
  );
}

function sendenKnopfAnzeigen() {
  const anzahl = auftragAuswahl.size;
  const bereit = anzahl > 0 && Boolean(auftragAn);
  $('auftrag-senden').disabled = !bereit;
  $('auftrag-senden').textContent = bereit ? `${anzahl} Artikel an ${auftragAn} senden` : 'Bitte Artikel auswählen';
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
      punkt.append(`an ${a.an}: ${a.artikel.join(', ')} `, statusPill(a.status), kleinerText(uhrzeit(a.erstelltAm)));
      return punkt;
    }),
  );
}

// ---------- Ansicht 3: Übersicht ----------

function uebersichtAnzeigen() {
  const auftraege = [...stand.auftraege].sort((a, b) => b.erstelltAm - a.erstelltAm);

  // Eine Karte pro Person: wie viele Aufträge gesendet und erhalten
  $('personen').replaceChildren(
    ...stand.mitglieder.map((name) => {
      const karte = document.createElement('div');
      karte.className = 'person';

      const kopf = document.createElement('div');
      kopf.className = 'person-kopf';
      const initiale = document.createElement('span');
      initiale.className = 'initiale';
      initiale.setAttribute('aria-hidden', 'true');
      initiale.textContent = name.charAt(0).toUpperCase();
      kopf.append(initiale, name === ich ? `${name} (du)` : name);

      const gesendet = auftraege.filter((a) => a.von === name);
      const erhalten = auftraege.filter((a) => a.an === name);
      karte.append(
        kopf,
        kleinerText(`Gesendet: ${gesendet.length}${statusZaehlen(gesendet)}`),
        kleinerText(`Erhalten: ${erhalten.length}${statusZaehlen(erhalten)}`),
      );
      return karte;
    }),
  );

  // Tabelle mit allen Aufträgen, neueste zuerst
  $('alle-auftraege-leer').hidden = auftraege.length > 0;
  $('alle-auftraege').replaceChildren(
    ...auftraege.map((a) => {
      const zeile = document.createElement('tr');
      const route = document.createElement('span');
      route.className = 'route';
      route.textContent = `${a.von} → ${a.an}`;
      zeile.append(
        zelle('', route, kleinerText(uhrzeit(a.erstelltAm))),
        zelle('', a.artikel.join(', ')),
        zelle('', statusPill(a.status)),
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

function statusPill(status) {
  const span = document.createElement('span');
  span.className = `pill pill-${status}`;
  span.textContent = `${STATUS_ZEICHEN[status] || ''} ${status}`;
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

async function antworten(auftrag, status) {
  const ergebnis = await anfrage(`/api/auftraege/${encodeURIComponent(auftrag.id)}/antwort`, { status, von: ich });
  if (ergebnis) {
    antwortInfoAnzeigen(
      `Du hast den Auftrag ${status === 'angenommen' ? 'angenommen' : 'abgelehnt'}. ${auftrag.von} sieht das gleich.`,
    );
  }
}

function wechseln(neueAnsicht) {
  if (neueAnsicht !== 'auftrag') auftragGesendet = null;
  ansicht = neueAnsicht;
  anzeigen();
  window.scrollTo(0, 0);
}

// ---------- Knöpfe und Formulare ----------

$('einrichten-form').addEventListener('submit', (ereignis) => {
  ereignis.preventDefault();
  const namen = [...ereignis.target.elements.name].map((feld) => feld.value.trim()).filter(Boolean);
  anfrage('/api/mitglieder', { namen });
});

$('ich-knopf').addEventListener('click', () => {
  personWechseln = true;
  auftragGesendet = null;
  anzeigen();
});

for (const b of document.querySelectorAll('#navigation [data-ansicht]')) {
  b.addEventListener('click', () => wechseln(b.dataset.ansicht));
}

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

$('auftrag-senden').addEventListener('click', async () => {
  if (auftragAuswahl.size === 0 || !auftragAn) return;
  const ids = [...auftragAuswahl];
  const artikel = ids.map((id) => stand.eintraege.find((e) => e.id === id)?.artikel).filter(Boolean);
  const an = auftragAn;
  const ergebnis = await anfrage('/api/auftraege', { von: ich, an, eintraege: ids });
  if (ergebnis) {
    auftragAuswahl.clear();
    auftragGesendet = { an, artikel };
    anzeigen();
    window.scrollTo(0, 0);
  }
});

$('auftrag-neu').addEventListener('click', () => {
  auftragGesendet = null;
  anzeigen();
});

$('zur-uebersicht').addEventListener('click', () => wechseln('uebersicht'));

$('benachrichtigung-knopf').addEventListener('click', async () => {
  await Notification.requestPermission();
  anzeigen();
});

// Wenn man zur App zurückkehrt, sofort den neuesten Stand holen
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') anfrage('/api/stand');
});

regelmaessigAbrufen();
