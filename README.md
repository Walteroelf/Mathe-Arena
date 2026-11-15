# Mathe-Arena

Differenziertes Rechenspiel für die digitale Tafel mit **iPads als Schüler-Geräte**.
Jedes Kind bekommt Aufgaben auf seinem eigenen Niveau, die App lernt mit, und an der Tafel läuft ein gemeinsames Spiel.

Reine HTML/JavaScript-Seiten ohne Build-Schritt, geeignet für GitHub Pages. Kein Konto, kein Cloud-Speicher.

## Gestaltung

Wie Kirmes-Kiosk und die Übersichtsseite am Erscheinungsbild der Spiele München 1972 (Otl Aicher) orientiert: helle, heitere Farben (Blau, Hellblau, Grün, Hellgrün, Gelb, Orange, Silber, viel Weiß), flache Flächen, kleine Rundungen, kein Rot und kein Schwarz (Schrift in Dunkelblau). „Richtig“ ist immer Grün, „Schau noch mal“ Orange. Leseschrift Andika (lokal, SIL Open Font License), Überschriften in der Groteskschrift des Geräts. Dunkler Modus folgt der Geräteeinstellung. Die drei Stile (Jugend, Kinder, Erwachsene) ändern die Akzentfarbe (Blau, Orange, Grün) und die Pseudonym-Listen.

## Im Alltag: Tafel und iPads

Für eine Stunde braucht man nur **die Tafel und die iPads**:

1. **An der Tafel** die App öffnen (`tafel.html`, am besten als Lesezeichen oder Startseite des Tafel-Browsers). Es erscheinen ein QR-Code und ein großer grüner Knopf **„Start“**.
2. **Auf den iPads** die App öffnen (`schueler.html`, als App auf dem Home-Bildschirm) und beim ersten Mal den QR-Code scannen. Ab dann verbindet sich das iPad von selbst wieder mit der Tafel.
3. **An der Tafel auf „Start“ tippen.**

Wer die Startseite (`index.html`) öffnet, wählt einmal „Tafel“ oder „iPad“. Das Gerät merkt sich die Wahl und öffnet beim nächsten Mal sofort die richtige Seite (ändern: „Gerät ändern“ im Tafel-Menü oder im ⚙ des iPads).

Spielart, Klassenziel und Dauer stehen unter **⚙ Einstellungen** an der Tafel und werden gemerkt. Während der Runde zeigt der Knopf **„✋ Wer braucht Hilfe?“** (nur für die Lehrkraft) die Ampel mit den Pseudonymen: wer Hilfe angefordert hat, wer stockt und wer vielleicht unterfordert ist. Von dort lässt sich beim Kind die Hilfe einblenden.

**Pro Kind einstellen:** An der Tafel gibt es im Wartebild den Knopf „👥 Pro Kind einstellen“ (und in der Hilfe-Ansicht ein ⚙ je Kind). Dort lassen sich Eingabeart (Tippen, Taster, Blick), Antwortform (automatisch, 4 oder 2 Auswahlfelder, Eintippen), Bereiche, Fokus, Stufen, Taster- und Blick-Tempo, Vorlesen, Ton und Stil für das jeweilige Kind einstellen. Die Einstellung geht direkt an das iPad des Kindes und bleibt dort gespeichert. Nur eine Taste **anlernen** geht am iPad selbst (⚙ eine Sekunde gedrückt halten). Dieselben Einstellungen gibt es auch auf dem freiwilligen Lehrer-Gerät, dort zusätzlich für Kinder, die gerade nicht verbunden sind.

### Freiwillig: das Lehrer-Gerät

`lehrer.html` auf iPad, Mac oder Windows-Rechner. Es ist **nicht nötig, um zu spielen**. Es bringt zusätzlich: die echten Namen zu den Pseudonymen (nur dort gespeichert), eine Kopie aller Lernstände als Sicherung, Einstellungen pro Kind aus der Ferne und die Steuerung vom Platz aus. Verbinden: An der Tafel ⚙ Einstellungen → „Lehrer-Gerät verbinden“, dort den Code ins Lehrer-Gerät eintippen oder den QR-Code scannen.

| Seite | Wo | Wofür |
|---|---|---|
| `tafel.html` | Browser der digitalen Tafel | Spielleitung und Anzeige: QR-Code, Start, Klassenziel, Hilfe-Ansicht |
| `schueler.html` | iPad jedes Kindes | Aufgaben lösen mit Tippen, Taster oder Blick, Lernstand liegt hier |
| `lehrer.html` | freiwillig: iPad, Mac oder Windows | Namen, Sicherung, Fernsteuerung, Einstellungen pro Kind |
| `index.html` | jedes Gerät | Startseite: „Was ist dieses Gerät?“ (merkt sich die Wahl) |

## Infoblatt

`infoblatt/Mathe-Arena-Infoblatt.pdf` (A4, zwei Seiten): Seite 1 stellt die App vor (Ablauf, Bilder, Datenschutz), Seite 2 ist eine **Kurzanleitung zum Aufhängen** mit je einem QR-Code für Tafel, iPad und Lehrer-Gerät und den drei Schritten einer Stunde.

## Wie die App das Niveau findet

- **Kompetenzstränge** mit Stufen: Stufe 0 (Ursache-Wirkung mit Taster), Mengen erfassen, Plus, Minus (bis 100). Weitere Stränge lassen sich in `js/skills.js` ergänzen (Eintrag in `MR.STRANDS` plus Generator).
- **Aufgaben werden erzeugt**, nicht aufgelistet. Jede Stufe hat Parameter wie Zahlenbereich oder Zehnerübergang.
- **Lernen:** Pro Strang steht ein Wert (zum Beispiel 3,4 = Stufe 3, 40 % bis Stufe 4). Nach jeder Antwort wird er Elo-artig angepasst. Das Gleichgewicht liegt bei etwa 75 % richtig. Am Anfang sind die Schritte groß (das ist die Einstufung), später ruhiger.
- Richtig, aber nur mit Hilfe oder sehr langsam: kleinerer Zuwachs. Sehr schnelle falsche Antworten (Raten): kleinerer Abzug. Nach zwei Fehlern in Folge kommt eine leichtere Aufgabe mit Auswahlfeldern. Jede fünfte Aufgabe ist eine leichte Erfolgsaufgabe, jede siebte eine freiwillige Herausforderung ohne Abzug.
- **Stufe 0 steigt nie automatisch.** Das System schlägt nur vor (blaue Ampel), die Lehrkraft entscheidet.
- **Fehlermuster** (zum Beispiel Zehnerübergang) werden gezählt und in der Klassenliste angezeigt.

## Eingabearten (pro Kind einstellbar)

- **Tippen:** normales Antippen. Antwort per Zahlenfeld oder Auswahlfeldern.
- **Taster:** Taster-Adapter und iSwitch melden sich als Tastatur. Einstellbar: jede Taste, Leertaste, Enter oder eine **angelernte Taste**. Ein Taster scannt die Antworten automatisch durch (markiert nacheinander, Druck wählt). Zwei Taster: Taster 2 = Weiter, Taster 1 = Auswählen. Sperrzeit und Durchlauf-Tempo einstellbar, Testfeld vorhanden. Wichtig am iPad: Schaltersteuerung in den Bedienungshilfen ausschalten.
- **Blick:** Augensteuerung (zum Beispiel GridPad) bewegt den Zeiger, Verweilen wählt (Ring füllt sich). Verweildauer einstellbar. Ein Klick der Augensteuerung funktioniert auch.

Antwortform: automatisch, 4 Auswahlfelder, 2 Auswahlfelder oder Eintippen. Mit Taster und Blick gibt es immer Auswahlfelder. Zum Einstellen auf dem iPad das ⚙ oben rechts eine Sekunde gedrückt halten. Dort lässt sich auch der Taster anlernen. Die Lehrkraft kann alles auch aus der Ferne einstellen (außer das Anlernen einer Taste).

## Stufe 0: Ursache-Wirkung

0a Ein Druck löst Licht und Ton aus. 0b Auf ein Signal warten, dann drücken. 0c Zwischen zwei Dingen wählen. 0d Zählen: so oft drücken, wie die Zahl zeigt. Es gibt kein „falsch“, nur Erfolg. Die Uhr der Runde zählt für diese Kinder nicht als Leistungsdruck: Punkte gibt es für jede Aktion gleich.

## Spielmodi (an der Tafel, vom Lehrer-Gerät gesteuert)

- **Kooperativ:** Gemeinsames Klassenziel, in der Auswahl „Klassenziel“ wählbar:
  - **Rennstrecke:** Jede richtige Antwort bringt alle weiter, Zusatzrunden sind möglich.
  - **Blumenwiese:** Jede richtige Antwort lässt eine Blume sprießen (Stiel wächst, Blüte geht auf). Die Blütenfarbe hängt am Kind, ein Stufenaufstieg bringt eine Sonnenblume und einen Schmetterling. Ist das Ziel erreicht, fliegen mehr Schmetterlinge, und die Wiese blüht weiter. Am Ende bleibt die Wiese unter den Titeln stehen.
- **Wettbewerb:** Fortschrittspunkte statt Trefferzahl (10 pro richtige Antwort plus Serienbonus, 30 für einen Stufenaufstieg). Die Bahnen stehen in fester Reihenfolge, es gibt keine Rangliste von unten nach oben. Am Ende „Sieger“, „Serienkönig“, „Aufsteiger“.
- **Ohne Wertung:** nur ein gemeinsamer Zähler.

## Wo liegen die Daten?

| Was | Wo | Anmerkung |
|---|---|---|
| Lernstand eines Kindes | Auf dem **iPad des Kindes** (Hauptablage) | im Browser (`localStorage`) |
| Kopie aller Lernstände, **echte Namen**, Einstellungen | Auf dem **Lehrer-Gerät** | nur dort. Immer dasselbe Gerät benutzen oder Sicherung einspielen |
| Raumcode und Kopplungsschlüssel | Im Tafel-Browser | sonst speichert die Tafel nichts, sie darf gelöscht werden |

Fällt ein Gerät aus, stellen sich Kinder-iPad und Lehrer-Gerät gegenseitig wieder her: Ein zurückgesetztes iPad wird in der Lehrer-Ansicht („Neue iPads warten auf ein Profil“) wieder mit seinem Profil verbunden. Geht das Lehrer-Gerät verloren, holt es sich die Lernstände beim nächsten Verbinden von den iPads zurück. **Nur die Namenstabelle** lässt sich so nicht wiederherstellen. Dafür gibt es unter „Sicherung“ eine Datei, optional mit Passwort verschlüsselt (AES-256-GCM, im Browser). Die Datei bitte selbst aufbewahren (Dateien-App, USB-Stick, eigener Rechner).

## Datenschutz-Kurzinfo (für Schulleitung und Datenschutzbeauftragte)

*Dies ist eine technische Beschreibung, keine Rechtsberatung. Die Freigabe liegt bei Ihrer Schule.*

**Welche Daten entstehen?**
- Pseudonym (zum Beispiel „Blauer Falke 42“), vom Kind aus einer Liste gewählt.
- Lernstand: Stufen pro Rechenbereich, Trefferzahlen, Fehlermuster, Verlauf der letzten Runden, Einstellungen zur Bedienung (zum Beispiel Eingabeart, gelernte Taste).
- Echte Namen: **nur** auf dem Lehrer-Gerät, als Beschriftung zum Pseudonym. Sie werden nie an die Tafel, an iPads oder an einen Server gesendet.

**Wo werden Daten gespeichert?**
- Nur lokal im Browser der jeweiligen Geräte (iPad der Kinder, Lehrer-Gerät). Es gibt keinen eigenen Server, keine Datenbank, keine Konten, keine Cookies, kein Tracking, keine Statistik-Dienste.
- Die Seiten werden von GitHub Pages ausgeliefert. Dabei sieht GitHub wie bei jeder Webseite die IP-Adresse des abrufenden Geräts. Alle Bibliotheken liegen lokal im Repository (`lib/`), es werden keine Schriften oder Skripte von Dritten nachgeladen.

**Was wird zwischen den Geräten übertragen?**
- Live-Daten (Pseudonym, Aufgabe, richtig/falsch, Punkte, Lernstand-Kopien) laufen per WebRTC **direkt zwischen den Geräten**, verschlüsselt (DTLS).
- Zum Verbindungsaufbau wird der öffentliche **PeerJS-Vermittlungsserver** (`0.peerjs.com`) benutzt. Dieser sieht den Raumcode (Teil der Verbindungskennung `mathe-arena-XXXX`), zufällige Gerätekennungen und technische Verbindungsdaten (u. a. IP-Adressen). Er sieht keine Namen und keine Lerndaten.
- Die Standard-Einstellung von PeerJS nutzt außerdem einen STUN-Server von Google (`stun.l.google.com`) und PeerJS-TURN-Server (`*.turn.peerjs.com`), falls keine direkte Verbindung möglich ist. Dabei sind IP-Adressen sichtbar. Über einen TURN-Server laufen die (verschlüsselten) Daten, falls nötig, durch.
- Wer das nicht möchte, kann einen eigenen PeerJS-Server betreiben und in `js/net.js` eintragen, oder die Seiten im Testbetrieb (`?net=bc`) ohne Internet nutzen (dann allerdings nur im selben Browser).

**Schutz der Lehrer-Daten:** PIN-Sperre für die Lehrer-Seite (nur gegen neugierige Blicke gedacht, kein Ersatz für ein gesperrtes Gerät). Der Tafel-Kopplungsschlüssel verhindert, dass sich Kinder als Lehrkraft verbinden. Er erscheint nur im ⚙-Menü der Tafel, bitte dort nicht der Klasse zeigen.

**Löschen:** Browserdaten der Seite löschen, oder auf dem iPad „Profil“ nicht mehr benutzen. Auf dem Lehrer-Gerät lässt sich jedes Kind unter „Klasse → ⚙ → Aus Klasse entfernen“ löschen. Backup-Dateien löscht die Lehrkraft selbst.

## Technik in Kürze

```
index.html  tafel.html  lehrer.html  schueler.html
css/style.css
js/common.js    Hilfen (Zufall, Speicher, QR, Pseudonym-Listen)
js/net.js       Verbindung: PeerJS/WebRTC, oder ?net=bc (BroadcastChannel, Test)
js/skills.js    Kompetenzkarte und Aufgaben-Generatoren
js/engine.js    Lernprofil, mitlernende Aufgabenwahl
js/input.js     Taster (Scannen, Anlernen), Blick (Verweilen)
js/schueler.js  js/tafel.js  js/lehrer.js
lib/            PeerJS und qrcode-generator (lokal, MIT)
```

- Nach Änderungen an `js/*.js` die Nummer `?v=` in der jeweiligen HTML-Datei erhöhen, damit Browser die neue Version laden.
- **Lokal testen:** im Ordner `python3 -m http.server 8765` starten. Für einen Test ohne Internet alle drei Seiten im selben Browser mit `?net=bc` öffnen, zum Beispiel `http://localhost:8765/tafel.html?net=bc`, dann `lehrer.html?net=bc` und `schueler.html?net=bc`. Die Tafel zeigt den Code, `lehrer.html` verlangt Kopplungscode (`ABCD-XYZABC`) aus ihrem ⚙-Menü, `schueler.html?net=bc#r=ABCD` verbindet das Kind.
- **Veröffentlichen mit GitHub Pages:** Repository auf GitHub, Settings → Pages → Branch `main`, Ordner `/ (root)`.

## Noch nicht enthalten (Ausbau)

Mal und Geteilt, Größen (Geld, Uhr), Brüche und Prozent, Textaufgaben, Teamaufgabe mit gemeinsamer Tafelaufgabe, Teams im Wettbewerb, weitere Stile (Aufgabenwelt für Kinder und Erwachsene), Mehrere Klassen im Lehrer-Gerät.
