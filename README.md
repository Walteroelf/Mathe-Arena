# Mathe-Arena

Differenziertes Rechenspiel für die digitale Tafel mit **iPads als Schüler-Geräte**.
Jedes Kind bekommt Aufgaben auf seinem eigenen Niveau, die App lernt mit, und an der Tafel läuft ein gemeinsames Spiel.

Reine HTML/JavaScript-Seiten ohne Build-Schritt, geeignet für GitHub Pages. Kein Konto, kein Cloud-Speicher.

## Die drei Seiten

| Seite | Wo | Wofür |
|---|---|---|
| `tafel.html` | Browser der digitalen Tafel (Android-Panel) | Spielleitung und Anzeige: QR-Code, Klassenziel oder Wettbewerb, Ergebnisse |
| `lehrer.html` | Lehrer-Gerät: iPad, MacBook oder Windows-Rechner, nur Browser | Runde starten, Ampel, Einstellungen pro Kind, echte Namen, Sicherung |
| `schueler.html` | iPad jedes Kindes | Aufgaben lösen mit Tippen, Taster oder Blick |

`index.html` ist die Startseite mit drei Kacheln.

## Eine Stunde

1. **Tafel:** `tafel.html` öffnen. Es erscheinen ein QR-Code und ein 4-stelliger Raumcode.
2. **Lehrer-Gerät, einmalig:** `lehrer.html` öffnen, an der Tafel ⚙ tippen und den dortigen QR-Code scannen (oder den Kopplungscode eintippen). Das Gerät merkt sich die Tafel.
3. **Kinder:** `schueler.html` auf dem iPad öffnen, QR-Code scannen, Pseudonym wählen. Ab dem zweiten Mal verbindet sich das iPad von selbst.
4. **Lehrer-Gerät:** Modus und Dauer wählen, Start.

Tipp: Auf dem iPad „Teilen → Zum Home-Bildschirm“ wählen. Das gibt Vollbild, und Safari löscht die gespeicherten Daten dann nicht so schnell.

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

- **Kooperativ:** Gemeinsames Klassenziel auf einer Rennstrecke. Jede richtige Antwort bringt alle weiter, Zusatzrunden sind möglich.
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
