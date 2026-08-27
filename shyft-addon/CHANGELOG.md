# Changelog

## 0.0.44.18

* **Verhaltensänderung:** Die `development_mode`-Konfigurationsoption (Umschalter Prod/Test-Umgebung, für jeden Nutzer in der Addon-Konfiguration sichtbar) ist entfernt. Stattdessen entscheidet jetzt der `shyft_access_key` selbst: ein Key mit `test_`-Präfix routet an die shyft-power-Testumgebung (Präfix wird vor dem eigentlichen Request abgeschnitten), alles andere an Prod - analog zu z.B. Stripes `sk_test_...`/`sk_live_...`-Schlüsseln. Kein normaler Nutzer bekommt einen Key mit diesem Präfix, kann also nicht mehr versehentlich (oder absichtlich) seine eigenen Daten in die Testumgebung umleiten. `ShyftAdapter.set_access_key(raw_key)` kapselt das Parsen; `bubble_token`/`development_mode` werden nie mehr einzeln gesetzt. **Wer bisher `development_mode: true` genutzt hat** (z.B. für eigene Tests), muss dem eigenen `shyft_access_key` in der Addon-Konfiguration manuell `test_` voranstellen, sonst läuft der Key ab diesem Update gegen Prod.

## 0.0.44.17

* Neue nutzer-sichtbare Fehler-/Statuskarte ganz oben auf der Konfigurationsseite (unter dem Erklärtext): zeigt entweder „Alle Systeme laufen" (dezent grün, mit Häkchen) oder bis zu 5 laufende Probleme in Klartext (Deutsch). Aktualisiert sich beim Laden der Seite, nach jedem Speichern und alle 30 s.
* Serverseitig neu: eine „Problem-Registry" (`problem_registry.py`, persistiert nach `/data/problems.json`, eigenes Modul ohne Import-Zyklus zu `app.py`/`sync_service.py`). Jedes Problem hat eine stabile ID (z.B. `action_failed:auto_laden`, `input_csv_missing_data`, `sensor_unavailable:<entity_id>`); tritt dasselbe Problem erneut auf, werden nur Zeitstempel/Zähler aktualisiert statt ein Duplikat anzulegen. Ein Problem verfällt **nicht** von selbst – der jeweilige Code-Pfad gibt seine ID aktiv wieder frei, sobald er wieder erfolgreich durchläuft. Neuer Endpunkt `GET /system-health`.
* Erste drei angebundene Quellen:
  * **Aktion vom Gerät abgelehnt:** `handle_shyft_action_start`/`handle_shyft_action_end` melden bei einer Ausnahme aus `execute_car_charge_start`/`execute_hot_water_activate`/`execute_auto_managed_action`/`trigger_ha_automation` ein `action_failed:<Aktionsname>` mit der Fehlermeldung des Geräts; ein erfolgreicher Lauf (oder ein deaktivierter Aktionstyp) gibt es wieder frei.
  * **Sensordaten unavailable:** `_read_mapped_entity_state` meldet für die für die `input.csv` benötigten Sensoren (`HEALTH_MONITORED_SENSOR_KEYS`) ein `sensor_unavailable:<entity_id>`, sobald der zugeordnete Sensor `unavailable`/nicht lesbar ist, und gibt es beim nächsten gültigen Wert wieder frei. Beim Neu-Zuordnen/Entfernen eines Sensors wird ein noch offener Eintrag der alten Entity in `writeConfig` aktiv gelöscht.
  * **Daten für die `input.csv` fehlen:** `sync_site_data` meldet `input_csv_missing_data`, wenn ein Wechselrichter zugeordnet ist, aber keiner der Kern-Stromfluss-Werte (PV/Haushalt/Netz) an shyft-power gesendet werden konnte.

## 0.0.44.16

* Gerätesteuerung: Hinweistext "Keine Aktionen in den nächsten 3 Stunden geplant." wird jetzt angezeigt, wenn gerade keine Aktion aktiv ist und auch keine innerhalb der nächsten 3 Stunden startet (anhand `Date Start` der von `/shyft/actions` gelieferten Aktionen, unabhängig vom genauen Status-Wortlaut).

## 0.0.44.15

* Energiefluss-Widget, mehrere Anpassungen:
  * Strommast steht jetzt so nah am Haus wie der Knotenpunkt (Abstand Mast↔Haus = Abstand Haus↔Knotenpunkt) - die Grafik ist dadurch insgesamt schmaler geworden. Der dadurch frei gewordene linke Rand wird per `viewBox`-Crop entfernt statt als leerer Platz zu bleiben.
  * Der Haushaltsstrom-Gesamtverbrauch (`household.kw`) fehlte bisher komplett in der Grafik - steht jetzt als eigene Beschriftung auf dem Stromfluss Haus→Knotenpunkt.
  * Die durchgehende Punkte-Animation vom Haus bis zum jeweiligen Verbraucher war seit der letzten Überarbeitung unterbrochen (der gemeinsame Bus-Abschnitt war rein statisch). Jetzt bekommt der Bus wieder eine eigene, durchgehende Animation - aufgeteilt in 3 Segmente (Haus→Knoten, Knoten→oben für Wärmepumpe/Auto, Knoten→unten für Sonstiges/Haushalt) mit jeweils plausibler eigener Geschwindigkeit, statt einer einzelnen Linie über den ganzen Bus mit uneindeutiger Fließrichtung.
  * Zeitstempel-Anzeige bei veralteten Sensorwerten: Wechselrichter-Flüsse (Grid/PV/Battery/Household) zeigen den Zeitstempel, sobald der Wert älter als 1 Minute ist; übrige HA-Sensorwerte (Wärmepumpe, Innentemperatur, Auto-Ladestand) ab 10 Minuten. Werte, die nicht direkt aus HA kommen (Strompreis), bleiben unverändert ohne Zeitstempel. Dafür führt `homeassistant_adapter.EntityState` jetzt `last_updated` mit, und `compute_energy_flow_data` liefert es je Feld mit aus.
  * kW-Wert bei horizontalen Flüssen (Grid, Haus→Knoten) steht jetzt mittig über der Leitung statt daneben; bei vertikalen Flüssen (Batterie) bleibt die Beschriftung wie zuvor neben dem Icon. Strompreis bleibt über dem Mast, Batterie-SOC/-Modus bleiben neben dem Batterie-Icon.
  * Mobile Lesbarkeit: `.energyFlowLabel`-Schriftgröße wird unter 600px per Media Query von 13px auf 16px angehoben (Zeilenabstand jetzt `em`-basiert statt fest 14px, damit mehrzeilige Labels dabei nicht überlappen); Verbraucher-Spalte etwas nach links gerückt, damit die längeren Statuszeilen (Wärmepumpe/Auto) bei größerer Schrift nicht über den rechten Rand hinauslaufen.

## 0.0.44.14

* **Kritischer Fix:** `compute_car_presence_forecast(hours=...)` hatte zwei interne Schleifen, die trotz des neuen `hours`-Parameters weiterhin fest auf `48` verdrahtet waren - bei `hours=49` (der übliche Fall, `optimizer_period=48 + 1` Puffer) führte das zu `IndexError: list index out of range` in `build_ev_optimizer_fields`. Dadurch schlug **jeder** `/trigger`-Aufruf (Button "Verbindung testen" wie auch der stündliche Cron-Job) mit HTTP 500 fehl - der stündliche Bubble-Sync lief seit Einführung in 0.0.44.8 nie erfolgreich durch. Live per `ha_get_logs(source=supervisor)` gefunden und verifiziert.

## 0.0.44.13

* "Auto laden"-Stufen (1./2./3.): Der Verbindungspunkt auf der Linie sitzt jetzt exakt vertikal mittig zur Zeile, statt einen festen `top`-Wert zu schätzen, der nicht immer genau passte.
* "PV: Einspeisung begrenzen" und "Verbrauch begrenzen §14a" sind jetzt reine Steuerungen ohne Sensor-Gegenstück: aus der Sensor-Zuordnungstabelle entfernt, "Direkt steuern" als Variante entfernt (nur noch HA-Automation). Serverseitig über `AUTOMATION_ONLY_CONTROL_KEYS`/`resolve_control_variant` abgesichert, damit ein evtl. gespeicherter "direct"-Wert nicht mehr greift. Dabei einen Bug gefunden und mitbehoben: Der Konfigurations-Speichern-Endpunkt hätte bei *jedem* Speichern die HA-Automation-Zuordnung dieser beiden Steuerungen unbeabsichtigt auf leer zurückgesetzt (Skript-Sync-Schleife lief unconditional für alle number-Steuerungen).

## 0.0.44.12

* Sensor-Zuordnungsfelder (Konfigurationsseite): eigener, immer sichtbarer Dropdown-Pfeil (ganz rechts) statt des browsereigenen, der bei `list=`-Inputs bisher nur bei Hover deutlich zu sehen war (und in Firefox gar nicht existiert). "×"-Löschen-Button sitzt jetzt links daneben, beide vertikal mittig am Feld ausgerichtet.

## 0.0.44.11

* Energiefluss-Widget, weitere Korrekturen: Haus jetzt wirklich horizontal UND vertikal zentriert (breiterer viewBox, 1100x560 statt 940x560), größerer Abstand Haus↔Sonne/Batterie, Sonne nochmal größer. Sammelbus/Trunk in einen eigenen, statischen (grauen, punktlosen) Pfad ausgelagert - vorher zeichnete jeder Verbraucher seine eigene Kopie des gemeinsamen Leitungsstücks mit, wodurch sich dort mehrere unabhängig schnelle Punktanimationen überlagerten und "ungleichmäßig" wirkten. Trunk auf Rückmeldung hin nochmal deutlich verlängert, Knotenpunkt nach rechts verschoben. Fließgeschwindigkeit insgesamt deutlich gedrosselt (wirkte zu unruhig). "Sonstiges Gerät"-Leitung/Label laufen nicht mehr ins vergrößerte Stecker-Icon hinein. Batterie-Beschriftung jetzt vertikal mittig am Icon (statt festem Offset, unabhängig von 2 oder 3 Textzeilen). Auto-Ladestand-Zeile beginnt jetzt mit "Ladestand: ".
* Konfigurationsseite: "Optimierungszeitraum" und "Gaspreis" (gehört zu einem noch nicht implementierten "Blockheizkraftwerk"-Gerät) haben vorerst kein Eingabefeld mehr - Optimierungszeitraum bleibt serverseitig beim Default 48h. "Allgemein"-Block heißt jetzt "Strom".
* Wechselrichter-Sensor-Dropdowns (PV-Powerflow) filtern jetzt nach Einheit (W/kW, plus "nicht erreichbar") statt nach `device_class: power` - Letzteres ließ auch binäre Sensoren mit HAs `binary_sensor`-Device-Class "power" (an/aus "zieht Strom", kein numerischer Wert) fälschlich durch.
* Neues, kompakteres Icon in der Navigationsleiste (ersetzt das breitere Wortmarken-Logo).

## 0.0.44.10

* Energiefluss-Widget überarbeitet: Sonne jetzt zentriert über dem Haus (statt fester Position), Batterie senkrecht darunter/darunter der Sonne. Sammelbus zu den Verbrauchern kürzer, individuelle Leitungen zum jeweiligen Gerät länger. Leitungen sind jetzt immer sichtbar (grau/inaktiv statt komplett unsichtbar), auch wenn gerade kein Strom fließt (z.B. Wärmepumpe aus, Auto abwesend) - Netzleitung nutzt dafür eine Bagatellgrenze von 0.1 kW. Neue Animation: statt einer grün gestrichelten Linie wandern kleine leuchtende Punkte auf der (grauen) Leitung entlang, Geschwindigkeit logarithmisch zur Leistung (Bezugspunkt 10 kW, keine harte Obergrenze). "Sonstiges Gerät"-Icon vergrößert, war im Vergleich zu den anderen Geräte-Icons zu klein.

## 0.0.44.9

* Neue Konfigurationsfelder für die `staticConfig`-Hälfte von `addon_sensor_data_JSON`: Wärmepumpe (Typ, Wohnfläche, Energieeffizienz, Warmwasser-Speichergröße, max. Leistung, max. Vorlauftemperatur, Heizkurve Niveau/Steigung, Heizungspuffer), Batterie (Kapazität, min. Ladestand), Auto (Ziel-Ladestand normal - Batteriegröße nutzt weiterhin das bestehende Zahlenfeld, wird beim Senden auf die nächstgelegene Bubble-Option gerundet) sowie ein neuer "Allgemein"-Block oberhalb der Geräte-Kacheln (Optimierungszeitraum, Gaspreis, Stromgrundlast, Strompreis Ein-/Verkauf). `Electricity Base Load` bettet den kWh-Wert direkt im gesendeten Text ein (`label__wert`, wie bei `Heating Buffer`), damit Java dafür keinen zusätzlichen Bubble-Aufruf braucht.
* Behebt nebenbei einen nicht geschlossenen `<div id="config"/>` in `index.html`, der `deviceSections`/`notificationSection`/den Aktions-Bereich unbeabsichtigt als Kinder verschachtelt hätte, sobald dieser Block erstmals befüllt wird.

## 0.0.44.8

* Ersetzt den alten stündlichen `addon_sensor_data`-Sensor-Sync (`sync_all_sensors`/`send_sensor_values`) durch `update_site_addon`: `sync_site_data()` baut jetzt `liveValues` (aus den bestehenden Sensor-Mappings, `SyncService.collect_live_values()`) plus die EV-Prognosefelder (`build_ev_optimizer_fields`, siehe 0.0.44.7) zu einem `addon_sensor_data_JSON` zusammen und schickt das als Ganzes. Betrifft sowohl den stündlichen Cron-Job als auch den "Verbindung testen"-Button (`/trigger`). `staticConfig` fehlt hier noch (keine Konfigurationsseite dafür), `update_location_addon` (Latitude/Longitude) ist ebenfalls noch nicht angebunden.

## 0.0.44.7

* Vorarbeit für den Bubble-JSON-Sync (`addon_sensor_data_JSON`): `compute_car_presence_forecast` nimmt jetzt einen `hours`-Parameter (Dashboard-Route bleibt bei 48h); neue `build_ev_optimizer_fields` leitet daraus `ev_usage_h`/`d_ev_kwh` für den Julia-Optimizer ab (leer, wenn kein EV/Wallbox konfiguriert ist, sonst pro Stunde ein Verbrauchswert plus kompakte Liste der Abwesenheitsstunden - mit Fallback, falls die Prognose innerhalb der optimizer_period nie über die Weg-Wahrscheinlichkeits-Schwelle kommt, damit shyft nicht fälschlich "kein EV" annimmt). Noch nicht an einen Endpunkt/Trigger angebunden.

## 0.0.44.6

* Energiefluss-Widget: Haus-Bildausschnitt per Pixelanalyse des Originalbilds neu vermessen (links 0,45→0,40, oben 0,22→0,28) - der vorherige Ausschnitt schnitt bereits in die Hauswand hinein ("Haus abgeschnitten"); Sonne/Mond-Symbol von ganz rechts in die freie Lücke zwischen Haus und Verbraucher-Spalte verschoben (520/42 statt 870/45)

## 0.0.44.5

* Die Wallbox-Obergrenze (aus "Max. Anzahl an Phasen"/"Max. Stromstärke pro Phase") sitzt jetzt direkt in `execute_car_charge_start` statt nur im lokalen PV-Überschussladen-Regelkreis - damit gilt sie auch für shyft-powers eigene Cloud-"Auto laden"-Aktionen, die dieselbe Funktion direkt aufrufen und bisher nicht gedeckelt waren (live beobachtet: 32A angefordert, weit über dem Stromkreislimit)

## 0.0.44.4

* PV-Überschussladen-Regelkreis: jede Session ist jetzt auf die volle Stunde befristet (endet spätestens zur nächsten vollen Stunde), statt unbegrenzt weiterzulaufen. Läuft die Frist ab, wird die Session sauber beendet; eine bereits abgelaufene Session wird nie wieder aktiv genommen - stattdessen wird bei weiterhin vorliegendem Überschuss eine genuin neue Session eröffnet. Solange eine Session noch läuft, wird weiterhin einfach ihr Zielwert aktualisiert (kein Stop/Start-Zyklus bei jedem Tick)

## 0.0.44.3

* PV-Überschussladen-Regelkreis: neue Konfigurationsfelder "Max. Anzahl an Phasen" (1/3, vorbelegt 3) und "Max. Stromstärke (pro Phase)" (vorbelegt 16A) unter Wallbox begrenzen jetzt den maximal angeforderten Ladewert - vorher konnte der Regelkreis bei anhaltender Einspeisung unbegrenzt weiter aufaddieren und Werte weit jenseits dessen anfordern, was die Wallbox überhaupt zulässt (beobachtet: 180A/41kW, durchgehend von Easee mit 400 Bad Request abgelehnt). Außerdem wird der Zielwert nicht mehr aktualisiert, wenn der Wallbox-Befehl fehlschlägt - vorher baute jeder fehlgeschlagene Versuch auf dem vorherigen (ungültigen) Wert weiter auf, statt zurückzufallen

## 0.0.44.2

* Energiefluss-Widget: Hausbild-Ausschnitt schneidet jetzt auch von oben zu (nicht nur von links), damit die schräg laufende Freileitung im Bild vollständig verschwindet, nicht nur der Mast-Pfosten; Batterie-Grafik deutlich verkleinert (war viel zu groß); Sonne/Mond-Symbol repariert (der Mond-Sichel-Pfad war durch einen ungültigen Bogenradius unsichtbar); Netz-Werte sitzen jetzt oberhalb statt unterhalb des Mastes, mit mehr Abstand zum Haus; die Wärmepumpen-Leitung animiert nur noch, wenn sie tatsächlich läuft (vorher auch im "Aus"-Zustand, was wie eine falsche Verbindung wirkte)

## 0.0.44.1

* Energiefluss-Widget: mehrere Layout-Korrekturen anhand eines echten Screenshots - der Strommast im Hausbild ist ausgeblendet (per Bildausschnitt), stattdessen steht wieder ein eigener, animierter Strommast davor; die Batterie-Fluss-Linie überschnitt sich mit der Leitung zu Wärmepumpe/Auto (Batterie steht jetzt unterhalb statt neben dem Haus, dadurch auch kein Layout-Konflikt mehr); ein fehlender Haushaltsstrom-Wert zeigte einen bedeutungslosen Strich statt einfach nichts anzuzeigen; Temperaturwerte werden jetzt einheitlich mit einer Nachkommastelle dargestellt. Batterie-Grafik zudem größer

## 0.0.44.0

* Energiefluss-Widget: eigene Illustrationen von shyft-power.com statt selbst gezeichneter Icons - Haus (3 Varianten je nach PV/Batterie), Batterie (5 Ladestufen), Wärmepumpe und Auto/Wallbox sind jetzt echte Bilder. Der farbige Himmel/Rasen-Hintergrund ist wieder weg, das Widget bleibt dafür bewusst immer hell (unabhängig vom Dark Mode der restlichen Seite), da die Bilder keinen transparenten Hintergrund haben. Die animierten Stromfluss-Linien sind unverändert erhalten geblieben

## 0.0.43.0

* Energiefluss-Widget: Haus, Batterie, Wärmepumpe, Auto und Wallbox sind jetzt echte isometrische 3D-Objekte (Standard-Isometrie-Projektion mit heller/mittlerer/dunkler Flächenschattierung je Objekt) statt flacher 2D-Formen - Strommast, Stecker-Symbol und Blitz-Symbol bleiben bewusst flache Icons (wie in den meisten isometrischen Dashboards üblich)

## 0.0.42.2

* Fix: Energiefluss-Widget - die Leitung zur Wärmepumpe lief teils quer durchs Wallbox-Icon. Alle vier Verbraucher (Wärmepumpe, Wallbox, Sonstiges Gerät, Haushaltsstrom) gehen jetzt vom selben Hausaustrittspunkt über einen gemeinsamen Bus ab, der sich erst kurz vor der jeweiligen Reihe aufteilt

## 0.0.42.1

* Energiefluss-Widget: alle Icons deutlich detaillierter gestaltet (Haus mit Fenster/Tür/Dachschattierung, Batterie als moderner Speicher-Pack mit Status-LED, Strommast als Gittermast, Wärmepumpe als Außengerät mit Lüftungsgitter, Auto mit rundem Karosserie-Umriss, eigenes Ladesäulen-Symbol neben dem Auto) statt einfacher geometrischer Grundformen, mit Schlagschatten und einer Himmel/Rasen-Hintergrundszene, in die alles eingebettet ist

## 0.0.42.0

* Neu: Energiefluss-Widget oben auf dem Dashboard - eine live-animierte Hausgrafik mit den aktuellen Werten von Netz, PV, Batterie, Wärmepumpe, Auto/Wallbox, Sonstigem Verbraucher und Haushaltsstrom. Stromfluss-Linien sind animiert (schneller bei mehr Leistung, nie ganz angehalten), der Wärmepumpen-Ventilator dreht sich, wenn sie läuft, und das Auto wird je nach Status anders dargestellt (abwesend/eingesteckt/lädt). Jedes Gerät erscheint nur, wenn es tatsächlich als Integration ausgewählt ist. Alle Icons sind selbst gezeichnet (kein externes Bildmaterial)
* Neu: Eingabefeld "Verbrauch (kWh/100km)" unter "Auto" - zusammen mit der Akkukapazität die Grundlage für die Reichweitenanzeige im neuen Widget (künftig auch für die Umkehrung: gewünschte Reichweite in kWh)
* Neu: Batterie-Vorzeichen (lädt/entlädt) wird automatisch aus dem Verlauf von Ladestand und Leistung erkannt, da das je nach Wechselrichter-Integration unterschiedlich gemeldet wird - mit manuellem Override unter "Batterie", falls die Erkennung mal danebenliegt oder noch keine Datenbasis hat

## 0.0.41.0

* Noch nicht zugeordnete Werte in "Status-Zuordnung" sind jetzt rot umrandet; das Gerät "Wallbox" klappt sich beim Öffnen der Konfiguration automatisch auf, solange eine Zuordnung fehlt (wie bei allen anderen Geräten mit fehlenden Angaben)
* Behoben: ein einmaliger, kaputter Sensorwert ("unknown 0", von einem Easee-Integration-Reload) wurde fälschlich als zuzuordnender Status-Wert angezeigt - Werte, die mit "unknown" beginnen, werden jetzt komplett ignoriert
* Kopf der Seite ist jetzt eine schlanke, beim Scrollen fixierte Leiste mit dem shyft-Logo (verlinkt auf shyft-power.com) statt der großen Überschrift; die kleine Scrollleiste unter den Tabs auf breiten Bildschirmen ist weg (das Swipen der Tab-Leiste auf schmalen Bildschirmen bleibt erhalten)
* Die Anwesenheitsprognose im "Ladestand Auto"-Chart hat jetzt eine kleine Farb-Legende statt eines Bildunterschrift-Texts

## 0.0.40.2

* Changelog liegt jetzt als CHANGELOG.md statt CHANGELOG.adoc vor - Home Assistant Supervisor zeigt diese Datei automatisch im "Changelog"-Dialog des Addons an, damit Updates direkt in Home Assistant nachvollziehbar sind, ohne extra ins GitHub-Repo schauen zu müssen

## 0.0.40.1

* Der Warnhinweis zur Wallbox-Status-Zuordnung ist jetzt allgemein oben auf der Konfigurationsseite zu finden (statt als Banner nur unter "Status-Zuordnung") und erste Instanz einer künftig wachsenden Sammlung an "muss behoben werden, bevor Shyft funktioniert"-Hinweisen (/config/warnings). Er greift jetzt auch bei jedem noch nicht zugeordneten, aus der Integration (deklarierte Statuswerte) oder der Historie bekannten Statuswert, nicht mehr nur beim gerade aktuellen - und erscheint nur, wenn überhaupt eine Wallbox als Gerät ausgewählt ist

## 0.0.40.0

* Neu: Anwesenheits-/Verbrauchsprognose fürs Auto muss nicht mehr wochenlang organisch anwachsen - sobald eine (neue oder geänderte) Status-Zuordnung für "Wallbox: Auto verbunden?" gespeichert wird, rekonstruiert das Addon die Historie rückwirkend direkt aus Home Assistants Sensor-Historie (so weit der Recorder zurückreicht, i.d.R. mindestens 10 Tage)
* Neu: Warnhinweis unter "Status-Zuordnung", wenn der gerade aktuelle Wallbox-Status noch nicht zugeordnet ist - das blockiert nämlich nicht nur die Prognose, sondern lässt z.B. auch die PV-Überschussladen-Rückfalllogik ohne jede Fehlermeldung gar nicht erst starten
* Neu: die Verbrauchsprognose markiert jetzt Stunden mit "~", für die (noch) zu wenig Datenbasis vorliegt (Cold-Start oder wenig Historie für diesen Wochentag/Stunde-Zeitpunkt), statt eine scheinbar präzise Zahl ohne Kontext zu zeigen

## 0.0.39.1

* Behoben: die Erkennung der beobachteten Status-Werte für "Wallbox: Auto verbunden?" (Status-Zuordnung) konnte nie mehr als den gerade aktuellen Wert anzeigen. Ursache war ein fehlendes URL-Encoding beim Abruf der Sensor-Historie - ein "+" in der Zeitzonenangabe wurde von Home Assistant als Leerzeichen interpretiert und die Anfrage deshalb abgelehnt. Betroffene Nutzer sollten unter "Status-Zuordnung" erneut nachsehen, jetzt sollten alle in den letzten 10 Tagen beobachteten Werte auftauchen

## 0.0.39.0

* Neu: Fahrverhalten-/Verbrauchsprognose fürs Auto (erste Version) - erweitert die Anwesenheitsprognose um eine dritte Unterscheidung während "nicht eingesteckt": steht (nur Vampire Drain) vs. unterwegs (echter Fahrverbrauch), abgeleitet aus dem Akkustand-Verlauf (Rückgang ≥1%/h = unterwegs). Ein SOC-Anstieg während der Abwesenheit (Laden an einem Schnelllader o.ä., nicht der eigenen Wallbox) wird komplett herausgerechnet, verzerrt also weder die Zustands- noch die Verbrauchsstatistik
* Neu: Eingabefeld "Akkukapazität (kWh)" unter "Auto" - wird benötigt, um Ladestandsänderungen der Autobatterie in kWh umzurechnen
* Die Anwesenheitsprognose im "Ladestand Auto"-Chart zeigt jetzt drei Farben statt einer (grün eingesteckt, grau steht, rot unterwegs); darunter ein aufklappbarer 48h-Zahlenvektor mit der prognostizierten stündlichen Verbrauchsprognose (kWh) - vorerst nur zur Ansicht, das Einspeisen in shyft-powers input_csv folgt erst mit der geplanten Verlagerung der Optimierungslogik ins Addon

## 0.0.38.0

* Neu: dauerhafte Websocket-Verbindung zu Home Assistant (live_entity_watcher.py) - reagiert sofort auf Sensoränderungen statt auf den nächsten Polling-Zyklus zu warten. Aktuell angeschlossen: Netzeinspeisung (löst ab 0,1 kW Änderung sofort eine PV-Überschussladen-Neubewertung aus, statt bis zu 5 Minuten zu warten) und Wallbox-Verbindungsstatus (sofortiger Log-Eintrag für die Anwesenheitsprognose + sofortige PV-Überschuss-Neubewertung, z.B. bei Abstecken). Die bisherigen Polling-Jobs laufen als Sicherheitsnetz weiter, falls die Websocket-Verbindung mal steht; die Sensor-Zuordnung wird bei jedem automatischen Reconnect (alle 30 Minuten oder bei Verbindungsabbruch) neu aus der Konfiguration gelesen, wirkt eine Änderung also ohne Addon-Neustart
* Eine Sperre verhindert, dass ein live ausgelöster und ein zeitgesteuerter Regelkreis-Tick gleichzeitig laufen und sich dabei gegenseitig überschreiben (z.B. zwei parallel gestartete Ladesessions)

## 0.0.37.0

* Neu: PV-Überschussladen-Rückfalllogik fürs Auto - läuft unabhängig von shyft-powers eigener PV-Prognose-basierter "Auto laden"-Aktion. Startet, wenn der Wechselrichter ins Netz einspeist (Schwelle -0,3 kW mit Heimspeicher, -1,5 kW ohne) und das Auto ladebereit + "Auto laden" aktiviert ist, und regelt die Ladeleistung danach alle 5 Minuten anhand der aktuellen Einspeisung nach (erhöhen bei fortgesetzter Einspeisung, senken sobald keine mehr da ist). Stoppt bei Heimspeicher-SOC ≤97 % (mit Speicher) bzw. sobald die Mindestladeleistung erreicht und weiterhin keine Einspeisung da ist (ohne Speicher)
* Die Fallback-Ladevorgänge erscheinen wie eigene shyft-Aktionen ("Auto laden" / "PV-Überschussladen") im Gerätesteuerung-Tab, inklusive aufklappbarem Log mit Ladeleistung und Uhrzeit je Regelschritt

## 0.0.36.0

* Unter "PV-Leistung" wird jetzt der verbleibende/volle PV-Ertrag pro Tag angezeigt ("Heute: 3 kWh | Morgen: 27 kWh"), auf ganze kWh gerundet. "Übermorgen" erscheint nur, wenn der PV-Ertrag an diesem Tag in den Daten erkennbar auf 0 gefallen ist (ab 17 Uhr geprüft, deckt auch einen frühen Wintersonnenuntergang ab)

## 0.0.35.1

* Anwesenheitsprognose: neue feste Sicherheits-Heuristik - je länger das Auto ununterbrochen abwesend ist (über eine normale Tagesabwesenheit hinaus), desto stärker wird die gelernte Rückkehrwahrscheinlichkeit gedeckelt, unabhängig davon, ob dafür schon eine vergleichbar lange Abwesenheit in der Historie beobachtet wurde (z.B. beim ersten Urlaub)
* Anwesenheitsprognose berücksichtigt jetzt zusätzlich den Akkustand (falls "EV - SOC" zugeordnet ist): ein leerer Akku erhöht die Einsteck-Wahrscheinlichkeit leicht, bewusst mit begrenztem Einfluss

## 0.0.35.0

* Neu: Anwesenheitsprognose fürs Auto (erste Version) - lernt aus der Historie des Sensors "Wallbox: Auto verbunden?", wann das Auto typischerweise eingesteckt ist (Wochentag/Stunde-Muster, reagiert auch kurzfristig auf eine unerwartete aktuelle Abwesenheit/Anwesenheit)
* Neu: unter "Wallbox: Auto verbunden?" können die bei dir tatsächlich vorkommenden Sensor-Statuswerte (z.B. "awaiting_authorization") einmalig als "Auto kann laden" oder "Auto kann nicht laden" zugeordnet werden - nötig, weil jede Wallbox-Integration ihr eigenes Vokabular für diesen Status verwendet
* Die Prognose für die nächsten 48 Stunden wird als Balken im "Ladestand Auto"-Diagramm auf dem Dashboard angezeigt (dunkler = wahrscheinlicher eingesteckt)

## 0.0.34.1

* Ladestand Heimspeicher/Auto: Y-Achse ist jetzt fix auf 0-100 % skaliert, statt sich am tatsächlichen Wertebereich zu orientieren

## 0.0.34.0

* Strompreis- und Raumtemperatur-Titel zeigen die Einheit jetzt in einer Klammer zusammen mit der Zusatzangabe ("Bezug, Cent/kWh" bzw. "Ziel, °C")
* Behoben: Springt der Strompreis über eine Farbschwelle (z.B. von 20 auf 31 Cent), wird die Verbindungslinie jetzt an der Schwelle farblich geteilt statt komplett in der falschen Farbe zu erscheinen
* Tageswechsel-Markierung in allen Diagrammen deutlicher sichtbar (dickere Linie, fettere Beschriftung)
* Raumtemperatur (Ziel) wird jetzt als Stufenfunktion und auf ganze Grad gerundet dargestellt
* Warmwasser sowie Ladestand Heimspeicher/Auto sind jetzt farbcodiert: grün bei Anstieg, grau bei kleinem Rückgang, rot bei stärkerem Rückgang (Schwelle 1 °C/h bzw. 0,1 %/h)

## 0.0.33.1

* Ladestand Auto: Wert war fraktional (0-1) statt Prozent - wird jetzt wie Ladestand Heimspeicher als 0-100 % dargestellt

## 0.0.33.0

* Neu: Die Variante "HA-Automation" (deine selbst erstellte Automation triggern statt eine Entität direkt zu steuern) ist jetzt auch bei "PV: Einspeisung begrenzen", "Verbrauch begrenzen §14a", "Warmwasserbereitung" und "Sonstiger Verbraucher" wählbar (Dropdown "Varianten")
* "Sonstiger Verbraucher": bei "HA-Automation" gibt es zwei Automationsfelder (Start/Ende); der Toggle beim Testen ist einem einzelnen Button gewichen, der bei jedem Klick zwischen Start und Ende wechselt

## 0.0.32.0

* Dashboard: ist jetzt der Standard-Tab beim Öffnen; die Tab-Leiste lässt sich horizontal swipen/scrollen, damit "Konfiguration" auf schmalen Bildschirmen erreichbar bleibt; Diagramm-Beschriftungen sind auf Mobilgeräten größer
* Strompreis wird jetzt in Cent/kWh angezeigt (statt €/kWh) und dreifarbig dargestellt (rötlich über 35 Cent, grün bis 25 Cent, dazwischen grau)
* Alle Diagramme: Tooltip mit dem genauen Wert bei Hover (Desktop) bzw. Tippen (Mobile); ein gestrichelter senkrechter Strich markiert jeden Tageswechsel
* PV-Leistung: Y-Achse beginnt jetzt bei 0 (keine negativen Werte mehr durch die Achsen-Rundung)
* Neu: Vier weitere Diagramme aus shyft-powers Optimierer-output_csv - Raumtemperatur (Ziel), Warmwasser, Ladestand Heimspeicher, Ladestand Auto
* "Auto laden": Zahlenfelder außer der Amperezahl (z.B. "minutes") werden jetzt nicht mehr angezeigt, sobald ein Amperezahl-Feld erkannt wurde - der zuletzt gespeicherte Wert bleibt aktiv, ohne dass ein Eingabefeld dafür nötig ist
* Neu: "Auto laden" kann jetzt auch über eine eigene Home-Assistant-Automation gesteuert werden (Variante "HA-Automation") - die Automation wird beim Start bzw. Ende der Aktion getriggert, mit dem Zielwert als {{ target }} und "start"/"stop" als {{ phase }}

## 0.0.31.2

* "Strompreis (Bezug)" wird jetzt als Stufenfunktion dargestellt (Wert bleibt bis zur nächsten Stunde konstant, statt zwischen zwei Stunden zu verlaufen) - passend dazu, dass sich der Preis stündlich ändert. Außentemperatur und PV-Leistung bleiben unverändert als geglättete Linie

## 0.0.31.1

* Die Dashboard-Diagrammdaten (input_csv) werden jetzt stündlich im Hintergrund von shyft-power abgerufen und lokal zwischengespeichert (zusammen mit dem stündlichen Aktions-Abruf), statt bei jedem Öffnen des Dashboard-Tabs live abgefragt zu werden

## 0.0.31.0

* Neu: Tab "Dashboard" (vor "Gerätesteuerung") mit drei Diagrammen für die nächsten Stunden - Strompreis (Bezug), Außentemperatur und PV-Leistung. Die Daten kommen aus shyft-powers Optimierer-Rohdaten (input_csv); die Zeitachse startet bei creation_date, abgerundet auf die volle Stunde, mit einem Wert pro Stunde

## 0.0.30.1

* Aufklapp-Pfeil bei den Gerätekacheln ist jetzt größer und oben rechts statt oben links
* Der Verbindungsstrich bei "Auto laden" läuft jetzt durchgehend neben allen drei Schritten (statt nur als kurzer Verbinder in den Lücken), mit einem Punkt an jedem Schritt

## 0.0.30.0

* Neu: "Warmwasserbereitung" bekommt einen eigenen Befehl-Auswahl analog zu "Auto laden" (Dropdown, gefiltert auf die Wärmepumpen-Integration deines gewählten Geräts, Geräte-ID automatisch befüllt) statt einer selbst zu bauenden Home-Assistant-Automation - einfache Einzelaktion, kein mehrstufiger Prozess. Dazu ein "Test: Warmwasserbereitung"-Button, der den Sensor "Warmwassermodus aktiviert?" nach dem Auslösen anzeigt
* Fix: "2. Amperezahl setzen" erkennt das Feld für die Amperezahl jetzt zuverlässig an dessen deklarierter Einheit (z.B. "A") statt über eine Checkbox - das betroffene Feld wird automatisch befüllt und gar nicht mehr angezeigt, andere Zahlenfelder (z.B. "minutes") bleiben normale Eingabefelder
* Mobile-Optimierung: Fehlendes Viewport-Meta-Tag ergänzt (Seite wurde auf Handys winzig dargestellt); Sensor-/Aktion-Tabellen brechen unter 600px Breite jetzt in eine gestapelte Ansicht um, statt die Seite horizontal scrollen zu lassen
* Fix: Bei Sensor-Werten ohne Einheit (z.B. "on"/"off") stand ein überflüssiges Leerzeichen vor der schließenden Klammer (z.B. "on )" statt "on)")
* Wortlaut: "Befülle die '...'" heißt jetzt "Befülle den Sensor '...'"

## 0.0.29.0

* "Auto laden": Springt die Ziel-Ladeleistung über die 1-/3-Phasen-Grenze (z.B. von 2,3 kW auf 6,9 kW oder umgekehrt), stoppt das Addon den Ladevorgang jetzt zuerst und wartet 10s, bevor es die neue Phasenzahl setzt - Wallboxen können die Phase nur wechseln, während gerade nicht geladen wird. Erkannt wird das am Sensor "Wallbox - Ladestrom" (aktuelle Ladeleistung) im Vergleich zum neuen Zielwert; ist der Sensor nicht zugeordnet oder sein Wert nicht lesbar, wird sicherheitshalber immer zuerst gestoppt

## 0.0.28.1

* Fix: Bei "2. Amperezahl setzen" wurde die berechnete Amperezahl in das zuletzt durchlaufene Zahlenfeld des gewählten Befehls geschrieben, unabhängig davon, ob dieses Feld überhaupt für die Stromstärke gedacht war (z.B. bei easee.set_charger_dynamic_limit landete sie im "minutes"-Feld statt in "amps", "amps" blieb leer). Zahlenfelder bekommen jetzt eine eigene Checkbox "automatisch aus berechneter Amperezahl" - nur die dort markierten Felder werden befüllt, alle anderen (z.B. "minutes") bleiben normale, manuell einzutragende Felder

## 0.0.28.0

* "Auto laden" setzte bislang keine Amperezahl an der Wallbox, obwohl sie aus dem Ziel-kW-Wert berechnet wurde - die berechnete Amperezahl wird jetzt tatsächlich gesendet. Dafür neuer Zwischenschritt "2. Amperezahl setzen" (Variante heißt jetzt "Dreistufig" statt "Zweistufig"): Entität auswählen (Dropdown, gefiltert auf Entitäten mit Einheit "A"), das zugehörige Befehlsfeld wird automatisch mit dem berechneten Wert befüllt
* Generische Home-Assistant-Befehle wie z.B. number.set_value (die ihre Entität nicht als eigenes Feld, sondern als "Ziel" deklarieren) bekommen jetzt ebenfalls ein Entity-Auswahlfeld angeboten - vorher gab es dafür gar keine Eingabemöglichkeit
* Zwischen allen drei Schritten (Phasenanzahl, Amperezahl, Ladevorgang starten) liegen jetzt 10s Pause statt 5s nur zwischen Phasenanzahl und Start - ein Test hat gezeigt, dass die Phasenumschaltung bei zu eng getakteten Befehlen von der Wallbox nicht übernommen wurde

## 0.0.27.0

* Schlägt ein Test-Button (Sensor/Aktion-Kacheln, "Auto laden") fehl, meldet das Addon den Fehler jetzt zusätzlich an shyft-power (Nutzer, Kontext, Fehlertyp, Fehlermeldung, aufgerufener Befehl und gesendete Daten) - hilft beim Support, ohne dass Nutzer das Home-Assistant-Log selbst weiterreichen müssen
* Der Text "(wird geprüft...)" nach einem gesendeten "Auto laden"-Befehl ist entfernt, da dafür kein Sensor für die tatsächliche Ladeleistung bekannt ist und sich der Text nie auflöste - das Addon zeigt nur noch, was gesendet wurde

## 0.0.26.1

* Fix: "Auto laden" konnte device_id leer an Home Assistant senden, wenn der Wert schon vor der automatischen Befüllung gespeichert war (z.B. vor dem Update, oder solange noch kein Speichern ausgelöst wurde). Der Aufruf ergänzt device_id jetzt zusätzlich zur Laufzeit direkt aus dem aktuell ausgewählten Wallbox-Gerät, statt sich allein auf den zuletzt gespeicherten Konfigurationsstand zu verlassen

## 0.0.26.0

* Geräte-Kacheln in der Konfiguration sind jetzt ein-/ausklappbar (Pfeil vor der Überschrift). Beim Laden sind unvollständige Kacheln (leere Sensor-/Aktion-Zuordnung, unvollständige "Auto laden"-Variante) automatisch ausgeklappt, vollständige eingeklappt - Kacheln ohne ausgewählte Integration bleiben eingeklappt (nichts zum Anzeigen). Taucht später ein Fehler auf (z.B. eine zugeordnete Entity liefert keinen lesbaren Wert), klappt sich die betroffene Kachel automatisch auf
* "Auto laden": Die device_id (bzw. jedes Feld mit Geräte-Bezug) wird nicht mehr angezeigt - sie ist immer eindeutig die des bereits ausgewählten Wallbox-Geräts und wird beim Speichern automatisch gesetzt
* Der verbindende vertikale Strich läuft jetzt nicht mehr neben "1. Phasenanzahl setzen"/"2. Ladevorgang steuern" selbst, sondern nur noch als kurzer Verbinder in der Lücke dazwischen
* Mehr Logging beim Ausführen eines "Auto laden"-Befehls (welcher Service mit welchen Daten aufgerufen wird, und der Fehler bei einem Fehlschlag) - hilfreich zum Abgleich mit Home Assistants eigenem Log, da dessen REST-Antwort bei einem 500er meist keine weiteren Details enthält

## 0.0.25.0

* "Auto laden": Felder, die eine Home-Assistant-Geräte-ID erwarten (z.B. device_id bei easee.set_charger_phase_mode), werden jetzt automatisch aus der bereits gewählten Wallbox-Integration befüllt (Dropdown statt Freitext) - dafür liefert /integrations jetzt auch die Geräte pro Integration mit
* "Mit 1 Phase laden" / "Mit 3 Phasen laden" statt "Wert für 1 Phase" + separatem Feldnamen, "Ladevorgang starten" / "Ladevorgang beenden" jeweils direkt als Zeilenbeschriftung
* Die beiden Fälle je Schritt sind jetzt sichtbar eingerückt, und ein durchgehender vertikaler Strich verbindet "1. Phasenanzahl setzen" und "2. Ladevorgang steuern" links, um den zusammenhängenden Ablauf zu verdeutlichen

## 0.0.24.0

* "Auto laden" braucht jetzt keine "Ziel-Entity" und keine "Datenfelder (JSON)" mehr. Stattdessen erzeugt das Addon automatisch ein Eingabefeld pro Parameter des gewählten Befehls: Parameter ohne feste Werte (z.B. device_id) bekommen ein einzelnes, gemeinsames Feld; Parameter mit festen Werten (z.B. mode bei easee.set_charger_phase_mode) bekommen ein Dropdown pro Fall - bei "Phasenanzahl setzen" je eins für "1 Phase" und "3 Phasen", bei "Ladevorgang steuern" je eins für "Ladevorgang starten" und "Ladevorgang beenden". Nutzer müssen die tatsächlichen Werte damit nirgends mehr selbst kennen oder eintippen
* "2. Ladevorgang starten" umbenannt in "2. Ladevorgang steuern" und um die "Beenden"-Variante erweitert - der bisher eigenständige Abschnitt "Laden beenden" ist jetzt darin enthalten (ein Befehl, zwei Fälle), inklusive gemeinsamem Test-Button

## 0.0.23.0

* Sensordaten an shyft-power werden jetzt bei Bedarf in die erwartete Einheit umgerechnet (z.B. W → kW, ÷1000), statt die von Home Assistant gelieferte Einheit unverändert durchzureichen. Sensoren ohne numerische Einheit (Modi, An/Aus) bleiben unangetastet
* "Auto laden": 5 Sekunden Pause zwischen "Phasenanzahl setzen" und "Ladevorgang starten" (real wie im Test), damit die Wallbox den Phasenwechsel sicher verarbeitet hat, bevor der Startbefehl kommt
* "Auto laden": Datenfelder-Auswahl zeigt jetzt bei Befehlen mit festen Wertebereichen (z.B. easee.set_charger_phase_mode) ein Dropdown mit den echten, von Home Assistant gemeldeten Optionen inkl. Klartext-Label, statt dass man die exakten Werte selbst kennen und eintippen muss. Neue Datenfeld-Konvention {"$map": {"1": "1_phase", "3": "3_phase"}} für Felder, die statt der berechneten Zahl einen bestimmten Text erwarten
* "Auto laden": Test jetzt mit zwei festen Buttons ("Test: mit 2,3 kW laden" / "Test: mit 6,9 kW laden") statt Phasenzahl-Eingabefeld - deckt beide Rechenpfade (1-phasig, 3-phasig) ab und durchläuft dieselbe kW-zu-Phasen/Ampere-Berechnung wie eine echte Aktion
* Aktionskarten in der Gerätesteuerung zeigen jetzt das Marken-Icon der zuständigen Integration (von Home Assistants öffentlichem Icon-Verzeichnis brands.home-assistant.io)
* Kleinere Korrekturen: "Auto laden"-Überschrift/Beschriftungen, Platzhaltertexte bei der Befehlsauswahl, veralteter "Nur zur Anzeige"-Hinweis auf dem Gerätesteuerung-Tab entfernt

## 0.0.22.0

* "Auto laden" ruft jetzt echte Home-Assistant-Befehle (Services) statt nur Entities auf - nötig, weil manche Wallbox-Integrationen (z.B. Easee) Phasenwahl/Start/Stopp über eigene Services wie easee.set_charger_phase_mode oder easee.action_command abbilden, nicht über number/button-Entities. Jede Stufe bekommt eine Service-Auswahl (vorgeschlagen werden generische Entity-Services plus alle Services der Domain deiner gewählten Wallbox-Integration), ein optionales Ziel-Entity und ein JSON-Feld für die übrigen Parameter, mit "{value}" als Platzhalter für die berechnete Phasen-/Amperezahl. Neuer Endpoint GET /services listet die Kandidaten inkl. ihrer deklarierten Feldnamen
* "Auto laden"-Überschrift vereinfacht: "Auto laden" statt "Lade-Rezept", Feldbezeichnung "Varianten" statt "Rezept"

## 0.0.21.0

* "Auto laden" bekommt ein Lade-Rezept in der Konfiguration, ohne dass der Nutzer merkt, dass technisch eine Befehlskette läuft: Dropdown "Rezept" (aktuell nur "Zweistufig"), das bei Auswahl zwei Entity-Zuordnungen einblendet - "Phasenzahl setzen" und "Ladevorgang starten" (number/select/button/switch, gefiltert auf diese Domains, Befehl wird passend zur Entity-Domain abgeleitet). Test-Button testet beide Stufen und zeigt danach den Wallbox-Status-Sensor als Erfolgskontrolle. "Laden beenden" ist eine eigene, vom Rezept unabhängige einzelne Entity-Zuordnung (mit eigenem Test-Button), da das herstellerübergreifend meist eine einzelne Aktion ist
* Gerätesteuerung für "Auto laden" ist jetzt ebenfalls scharf: das Addon berechnet aus dem kW-Zielwert einer shyft-power-Aktion die passende Phasenzahl und Amperezahl (230V/Phase, 16A Einphasen-Grenze, Aufrunden auf mind. 6A - noch nicht konfigurierbar, shyft-powers eigene Leistungsgrenzen werden noch nicht ans Addon übermittelt) und ruft dann Phasenzahl- und Start-Entity auf; "Beenden" ruft die Stop-Entity
* Fix: "Auto verbunden?" am Auto entfernt (redundant zum Sensor an der Wallbox, der dieselbe Information liefert) - inklusive des zugehörigen Datenpunkts im stündlichen Sync an shyft-power
* Fix: "Wallbox: Auto verbunden?" filterte Entities nicht mehr nach Einheit - jetzt werden Entities mit kWh/kW/W/A/V/°C/%/Wh ausgeblendet, Text-/Zahl-/Boolean-Zustände bleiben wählbar

## 0.0.20.0

* Drei weitere Aktionen sind jetzt auto-managed (Entity direkt steuerbar, keine eigene Automation nötig), mit Test-Button/-Toggle, Checkmark und Live-Status/-Wert in der Konfiguration - wie bisher schon bei "Heizung Soll-Temperatur": "PV: Einspeisung begrenzen" und "Verbrauch begrenzen (§14a)" (jeweils number/climate-Entity, Test ±1), sowie "Sonstiger Verbraucher" (switch-Entity, Test-Toggle An/Aus statt Buttons)
* Neue Sensor-Zuordnungsfelder dafür: "PV: Einspeisung begrenzen (aktuell)", "Verbrauch begrenzen §14a (aktuell)" unter Wechselrichter, "Sonstiger Verbraucher (aktuell)" unter Sonstiger Verbraucher
* Gerätesteuerung ist jetzt scharf: für diese vier Aktionstypen führt das Addon Start/Ende bei einer shyft-power-Aktion wirklich aus (Entity setzen bzw. ein-/ausschalten), sofern der jeweilige Aktionstyp-Toggle an ist (Default: an) - vorher war das überall nur simuliert/geloggt. Alle anderen Aktionstypen bleiben bis auf Weiteres Platzhalter
* Auto-managed Scripts werden jetzt auch beim Addon-Start neu synchronisiert (nicht nur beim Speichern der Konfiguration), damit ein Neustart oder ein versehentlich gelöschtes Script sich von selbst repariert

## 0.0.19.2

* Benachrichtigungstyp umbenannt: "Geräteverhalten abweichend von Shyft-Steuerung" statt "Gerätestatus..."

## 0.0.19.1

* Handy-Auswahl unter "Benachrichtigungen" ist jetzt ein Dropdown statt Freitext, auf Handys beschränkt (Home Assistant Mobile-App-Integration, per notify-Service - keine Entity nötig). Ein zuvor gespeichertes, aktuell nicht gemeldetes Handy bleibt als Option erhalten ("nicht gefunden"), statt beim nächsten Speichern stillschweigend verloren zu gehen
* Neuer Endpoint GET /notification-targets, neue Adapter-Methode get_mobile_app_notify_targets()

## 0.0.19.0

* Per-Aktionstyp-Toggle in der Konfiguration ("nur simulieren"), default An - ersetzt shyft-powers eigene "(deaktiviert)"-Logik vollständig; der Zustand des Toggles entscheidet jetzt, ob Start/Ende einer Aktion real oder nur simuliert (geloggt) wird. Die reinen "Stopp"-Aktoren (Batterie-Aktion beenden, Auto laden beenden) haben bewusst keinen eigenen Toggle, sie folgen dem Toggle ihres zugehörigen Start-Aktionstyps
* Wird ein Aktionstyp umgeschaltet, während eine passende Aktion gerade läuft, wird sie sofort gestoppt bzw. gestartet, statt auf den nächsten 15-Minuten-Poll zu warten
* Neuer Konfigurationsbereich "Benachrichtigungen": Handy-Zielfeld (Home-Assistant notify-Entity oder -Service) plus an/aus-Schalter pro Benachrichtigungstyp. Erster Typ: "Aktionen starten / beenden" (aktiv). Zweiter Typ "Gerätestatus abweichend von Shyft-Steuerung" ist im 15-Minuten-Poll verdrahtet, aber die eigentliche Abweichungserkennung fehlt noch - die braucht dieselbe pro-Aktion-Logik wie die Start/Ende-Ausführung selbst und folgt in einem späteren Schritt
* Entfernt: das interne "shyftActionsEnabled"-Flag aus 0.0.18.0 (nie in der UI sichtbar) - durch die Aktionstyp-Toggles ersetzt

## 0.0.18.0

* New cron job: polls the shyft-power action queue on the hour and every 15 minutes and fires start/end hooks per action (start: Status "aktiv" and Date Start passed; end: Date End passed, regardless of Status). Both are deduplicated per action id via a persisted set that survives addon restarts, so an extended action (same id, later Date End) doesn't re-fire start, while a superseded ("abgelöst") action - which gets a new id from shyft-power - correctly fires its own start. What start/end actually do per action type is not implemented yet (placeholder logging only), pending a follow-up step
* New "shyftActionsEnabled" config flag (defaults to off, no UI toggle yet) to later gate whether these hooks are allowed to act on real devices
* Fix: saving the configuration form overwrote the whole config file instead of merging, which would have silently wiped the new action-tracking state on every normal save

## 0.0.17.1

* Fix: BUBBLE_URI_TEST (development_mode) still pointed at the old anselmhuewe.bubbleapps.io domain; now https://shyft-power.com/version-test/, so development_mode correctly targets shyft-power's test environment for all workflows including the new action queue

## 0.0.17.0

* Switch the outbound Bubble endpoint from anselmhuewe.bubbleapps.io to shyft-power.com
* New "Gerätesteuerung" tab, alongside the existing config UI now under a "Konfiguration" tab, showing the read-only action queue pulled from shyft-power's new return_actions_to_addon endpoint - grouped by day with a daily savings figure, matching shyft-power's own web UI. Nothing here executes anything on the user's devices yet
* New backend: ShyftAdapter.get_actions() and GET /shyft/actions, using the user id embedded in the shyft_access_key

## 0.0.16.3

* Log heating_target_temp script-sync failures to the addon log instead of swallowing them silently

## 0.0.16.2

* Update "Zieltemperatur (aktuell)" tooltip text
* Fix: config.yaml's version was left at 0.0.16.0 in the previous release even though the code shipped as 0.0.16.1, so Supervisor never offered the update. The version now lives only in config.yaml (app.py reads it at startup) instead of also being duplicated in version.py, removing the class of bug entirely

## 0.0.16.1

* Remove the "Shyft-Sensor / Home Assistant Entity ID" and "Shyft-Aktion / Home Assistant Automation" table headers; replace with clear "Sensoren" / "Steuerung" section headings, with more visual separation before "Steuerung"
* Show a green checkmark next to "Heizung Soll-Temperatur" instead of "Eingerichtet (entity_id)" text
* Sensor entity fields now permanently show "entity_id (state unit)" instead of just the bare id, and refresh automatically every 30s (paused while the tab isn't visible, and skips fields currently being edited)
* Fix: the addon wrote the auto-managed script's config but never told Home Assistant to reload it, so the script entity never actually appeared - now calls script.reload after every write/delete
* Fix: the status check now verifies the script entity itself exists, instead of only checking that the mapped sensor entity is readable
* Fix: value-extraction on save only handled the old "entity_id: state unit" format; now handles "entity_id (state unit)" too

## 0.0.16.0

* First auto-managed action: "Heizung Soll-Temperatur" no longer needs a manually entered automation/script - the addon creates and maintains a script (number.set_value or climate.set_temperature) itself, targeting whatever entity is mapped at "Zieltemperatur (aktuell)"
* New "Test: +1 Grad" / "Test: -1 Grad" buttons with live current-value display to verify the setup actually works
* Addon can now write to Home Assistant (script config API, service calls) - previously read-only. New adapter methods: post/delete_from_homeassistant, put/delete_script_config, call_service, read_entity_numeric_value

## 0.0.15.1

* Add a clear ("×") button to sensor/action entity fields
* Filter sensor entity suggestions by device_class instead of unit_of_measurement (power/battery/temperature/on-off, per field), with a permissive fallback for entities that are unavailable/unknown
* Wärmepumpe integration picker now requires at least one temperature-class sensor, same as the existing power-sensor requirement for Wechselrichter/Batterie
* Fix: the "allow when uncertain" rule no longer lets any integration with one unrelated unavailable entity satisfy every device-class requirement

## 0.0.15.0

* Integration picker is now multi-select (checkboxes + search) instead of one integration per device type, so sensors from several integrations can feed the same device section
* Fix: integration names in the picker no longer show the raw internal ID
* Fix: disable browser autofill on sensor/action entity fields so the browser's own form-fill history no longer bleeds into the entity suggestions
* Add visual separation between the Sensor and Aktion tables within a section

## 0.0.14.3

* Add a cache-busting version query param to app.js so browsers can't keep serving a stale, pre-update copy (the no-cache header in 0.0.14.2 only prevented *future* staleness, it couldn't undo an already-cached copy)

## 0.0.14.2

* Send no-cache headers so the browser always loads the latest app.js/index.html after an addon update

## 0.0.14.1

* Mask SUPERVISOR_TOKEN and SHYFT_ACCESS_KEY in startup logs instead of printing them in plain text

## 0.0.14.0

* KAN-163 : Filter pv history values better (two values for one hour)