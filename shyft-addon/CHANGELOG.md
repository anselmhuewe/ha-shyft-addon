# Changelog

## 0.0.44.68

* **Neues Konfigurationsfeld "Gewünschte Raumtemperatur (mindestens)"** (Wärmepumpen-Abschnitt, über "Heizungspuffer") - Dropdown mit ganzen Grad von 18-24 °C, Default 21 °C. Das ist `t_min` für die Optimierung: die Innentemperatur wird immer mindestens auf diesem Wert gehalten (und höchstens den Heizungspuffer darüber). Geht als `HP - Heating Target Temp (min)` in die staticConfig; der Server bevorzugt es vor dem bisherigen sensor-/Default-Wert (20 °C).
* **T_i_0 wird jetzt addon-seitig aufbereitet** und als neues liveValue `HP - Temp Indoor T_i_0` an die Site geschrieben (der Rohwert `HP - Temp Indoor measured` bleibt unverändert für Anzeige/Debug erhalten). Die Abweichung der gemessenen Innentemperatur von `t_min` wird durch 10 gedämpft und auf `[t_min, t_min + Heizungspuffer]` geklemmt. Hintergrund: ein Rohwert an oder über der Puffer-Obergrenze nagelt die in Julia auf `T_i[1]` fixierte Starttemperatur ohne Spielraum an eine harte Schranke - das Modell wird dann unlösbar und liefert eine reine `NaN`-Ausgabe, an der der ganze Lauf scheitert ("Character N is neither a decimal digit…").
  * **Fallback**, wenn der Innentemperatur-Sensor fehlt, nicht zugeordnet oder älter als 1 h ist: die vom letzten Lauf für die aktuelle Stunde prognostizierte `T_i` aus der letzten `output.csv` (auf den Rohwert zurückgerechnet und durch dieselbe Klemm-/Dämpfungs-Pipeline geschickt). Gibt es keine brauchbare vorherige `output.csv`, wird `t_min` gesendet.
* Erfordert das zugehörige Server-Deployment (shyft 0.46.11.0), das die beiden neuen Site-Felder liest.

## 0.0.44.67

* **Fix: Dashboard zeigte "Diagrammdaten konnten nicht geladen werden".** Ursache: der Optimierer kann für nicht (vollständig) konfigurierte Geräte/Größen `"NaN"`/`"Inf"`-Artefaktwerte in `output_csv` schreiben (z.B. bei `SOC_EV` ohne konfiguriertes Auto) - ein einziger solcher Wert, einmal in die `/dashboard/chart-data`-JSON-Antwort eingebettet, machte die **gesamte** Antwort clientseitig unparsbar (Browser-JSON lehnt `NaN`/`Infinity` strikt ab, anders als Pythons `json`-Modul, das sie anstandslos aber nicht-standardkonform ausgibt) - dann schlägt nicht nur eine Kennzahl fehl, sondern das komplette Dashboard.
  * Neue `_safe_float()`-Hilfsfunktion (Ersatz für alle `float(x or 0)`-Stellen, 27 Fundstellen) - NaN/Infinity werden wie ein fehlender Wert behandelt (Default 0.0) statt durchgereicht zu werden. Betrifft sowohl die Dashboard-Chart-Daten als auch alle vier Aktionsberechnungen (Auto laden, Warmwasser, Heizung, Verbraucher an), die potenziell dieselben Optimierer-Artefakte lesen.

## 0.0.44.66

* "Maximaler Ladestand (PV-Überschuss)" umbenannt in "Limit PV-Überschussladen", Platzhalter jetzt "z.B. 80 %". Zahlenfelder können jetzt optional eine Einheit als Suffix neben dem Feld anzeigen (`buildConfigNumberField`, neuer `unit`-Parameter) - der Wert selbst bleibt eine reine Zahl (`<input type="number">` kann kein "80 %" als Wert halten), die Einheit steht nur daneben.

## 0.0.44.65

* **Vierter addon-berechneter Aktionstyp: "Verbraucher an"** (Sonstiger Verbraucher, `compute_od_actions`) - läuft nur, wenn ein Sonstiger-Verbraucher-Gerät konfiguriert ist. Eine Aktion entsteht, wenn `OD_Power` strikt zwischen 0,1 und 99 kW liegt (Werte ≥99 gelten als Optimierer-Artefakt und triggern nicht). Deutlich schlanker als die anderen drei Aktionstypen: kein `Target Value`/`Start Value`/`costsopt`/`Savings`/`costsbase`, da "Verbraucher an" ein reiner Ein/Aus-Schalter ist. `Energy (electr) = OD_Power`, Subtitle `"XXX kW"` (1 Nachkommastelle). Start/Ende-Steuerung war bereits generisch vorhanden (`consumer_on_off`, ein `AUTO_MANAGED_CONTROLS`-Switch-Eintrag).
* **Fix: "wirklich beenden" hing bisher am *aktuellen* Aktionstyp-Toggle statt am tatsächlichen Ausführungsstatus.** Wurde eine Aktion real gestartet (Toggle war an) und der Toggle dann vor dem Beenden ausgeschaltet, hätte das Beenden nur noch simuliert (nicht wirklich gestoppt) - ein real laufendes Gerät wäre nie wirklich abgeschaltet worden. `handle_shyft_action_start` setzt jetzt `Execution Status` auf `"yes, started"`/`"no, deactivated"`, je nachdem ob der Start echt war; alle drei Beenden-Aufrufer (`_reconcile_computed_actions`, `run_hourly_action_transition`, `process_shyft_actions`) prüfen jetzt diesen gespeicherten Wert statt den Toggle zum Beenden-Zeitpunkt neu auszuwerten. Gilt für alle vier Aktionstypen, nicht nur "Verbraucher an".

## 0.0.44.64

* PV-Ertrag Heute|Morgen (siehe 0.0.44.61-Versuch, Werte neben "Jetzt"-Linie/Tagesgrenze in den PV-Prognose-Chart einzuzeichnen) zurückgebaut: stand trotz Kollisionsvermeidung nicht sauber genug im Chart. Wieder schlichter Text, jetzt aber direkt unter dem PV-Chart selbst verankert statt lose im Dashboard-Flow (dort vorher mit der "Stromverbrauch"-Kennzahl der Einsatzplan-Karte verwechselt worden).
* **Fix: "Neue Optimierung läuft…" aktualisierte sich nie von selbst.** Die Einsatzplan-Karte wurde nur einmal beim Laden der Dashboard-Seite gebaut - eine erst danach gestartete (oder zwischenzeitlich abgeschlossene) Optimierung blieb dadurch unsichtbar, ohne die Seite manuell neu zu laden. Die Karte aktualisiert sich jetzt wie das Energiefluss-Widget alle 30s selbst.

## 0.0.44.63

* Einsatzplan-Karte: Beschriftung umformuliert („Berechnet um … Uhr, Kennzahlen jeweils für die nächsten 48 Stunden (bzw. in Klammern für die restlichen heutigen Stunden | für morgen).") und ein dezent pulsierendes **„Neue Optimierung läuft…"** ergänzt, solange nach einem Sync noch auf ein frisches Optimierungsergebnis gewartet wird (`optimizer_running` in `/dashboard/chart-data`, aus dem letzten `update_site_addon`-Absendezeitpunkt vs. `creation_date` des gecachten Laufs bzw. dem Ablauf des Nachfrage-Fensters).

## 0.0.44.62

* PV-/Wetterprognose an die Site: statt `optimizationPeriodsSite` Stunden werden jetzt **`optimizationPeriodsSite + 24`** Stunden gesendet (`Temperature` / `PV Prediction` / `Datetime Weather`). Ein Optimierungslauf startet an der aktuellen Stunde, nicht um Mitternacht - mit nur `optimizationPeriodsSite` Stunden ab heute 0:00 fehlte dem Optimizer sonst das letzte Stück seines Horizonts (er hält dann den letzten Wert konstant, im `input_csv` z.B. als über Stunden gleichbleibende Temperatur sichtbar). open-meteo-Abruf entsprechend auf 4 Tage Vorhersage erhöht.

## 0.0.44.61

* Einleitungstext oben auf dem Konfiguration-Tab ("So richtest du das Add-on ein: ...") entfernt.

## 0.0.44.60

* Einsatzplan-Kacheln kompakter: Die Heute|Morgen-Kurzwerte stehen jetzt hinter der großen Zahl in derselben Zeile statt in einer eigenen Zeile darunter - die Kacheln wirkten dadurch unnötig groß. Die Einheit (z.B. "Cent/kWh") steht dabei nur noch einmal an der großen Zahl, nicht zusätzlich bei jedem der beiden Kurzwerte.
* Legendentext der Einsatzplan-Karte umformuliert: "(berechnet um HH:MM Uhr, Kennzahlen jeweils über die nächsten 48 Stunden. Dahinter: Restliche Stunden heute | morgen)".
* Fix: "Eigenverbrauch" zeigte "-" statt "0 %", wenn im betrachteten Zeitraum keine PV-Erzeugung stattfand - anders als bei Netzstrom-Preis/Autarkie ist das hier kein undefinierter Fall (von 0 kWh PV-Ertrag können auch 0% selbst verbraucht worden sein), sondern eindeutig 0.

## 0.0.44.59

* PV-Prognose: **Self-Heal beim Addon-Start** – ist ein PV-Leistungssensor zugeordnet, aber noch keine `pv_calibration.json` vorhanden (z.B. weil der Sensor schon vor Einführung der PV-Prognose konfiguriert war oder die Datei verloren ging), wird das m²-Äquivalent-Profil sofort einmalig aus 7 Tagen Historie kalibriert, statt bis zum nächsten 22:00-Lauf zu warten. `pv_forecast.is_calibrated()` neu.
* Energiefluss-Widget: Das Himmels-Icon über dem Haus zeigt jetzt das **aktuelle Wetter** (open-meteo `weather_code`, gleiche Icon-Zuordnung wie der Wetter-Streifen) statt nur Sonne/Mond nach Uhrzeit. Bei klarem Himmel bzw. ohne Wetterdaten weiterhin die gezeichnete Sonne/Mond. Das Dashboard holt `/dashboard/weather` jetzt einmalig vor dem Widget-Aufbau und verwendet die Daten für Icon **und** Streifen.

## 0.0.44.58

* **Navigationsleisten-Logo (In-App-Kopfzeile) mit dem richtigen Quellbild neu erzeugt.** Bisher wurde es aus einer quadratischen Icon-Quelle abgeleitet (mit Rand nachgebessert, siehe 0.0.44.52) - der eigentliche Rand-Effekt war aber nicht das Problem, sondern die falsche Quelle: das Logo ist eigentlich als breites Format gedacht (1280×914, breiter als hoch), nicht quadratisch. `www/assets/shyft-icon.png` nutzt jetzt direkt dieses breite Original - die Kopfzeile selbst (`height: 28px; width: auto`) zeigt es dadurch in seinem echten Seitenverhältnis statt gequetscht/beschnitten. `icon.png` (HA-Supervisor-Icon, muss quadratisch bleiben) ist davon unberührt und bleibt bei der quadratischen Version aus 0.0.44.52 - beide Dateien sind ab jetzt bewusst NICHT mehr byte-identisch, da sie unterschiedliche Seitenverhältnisse brauchen.

## 0.0.44.57

* Einsatzplan-Kennzahlen nach Nutzer-Feedback verfeinert (siehe 0.0.44.56):
  * **ø Netzstrom**: zählt jetzt nur tatsächlich eingekauften Netzstrom - eingespeister Strom wird nicht gegengerechnet (vorher netto, konnte negativ werden). "-" wenn gar nichts eingekauft wurde.
  * **Autarkie**: bewusst wieder ungekappt (nutzt den rohen, vorzeichenbehafteten `GR_sum`) - bei Netto-Einspeisung (mehr Ertrag als Bezug) kann Autarkie korrekterweise über 100% liegen; nur nach unten auf 0% begrenzt.
  * **Neue fünfte Kachel "Stromertrag"** (€): Summe von `profits_opt` aus `output_csv` - der vom Optimierer direkt berechnete Einspeise-Erlös, unabhängig von `GR_sum` ermittelt.
  * Eigenverbrauch unverändert (weiterhin auf Basis des eingekauften Anteils, auf 100% gedeckelt).

## 0.0.44.56

* **Fix: Einsatzplan-Kacheln zeigten teils absurde Werte** (z.B. -3,2 Cent/kWh ø Netzstrom, 234% Autarkie). Ursache: `GR_sum` in `output_csv` ist laut Optimierer ein **Netto**-Wert ("net load / feed in from / to the grid", run_SHEMS.jl) und wird in einspeisungsreichen Stunden negativ - die bisherige Berechnung hat das ungefiltert als "eingekaufte Netzenergie" behandelt. Jetzt wird `GR_sum` pro Stunde bei 0 gekappt, bevor es in ø Netzstrom/Autarkie/Eigenverbrauch einfließt (eine Einspeise-Stunde zählt als 0 eingekaufte Energie, nicht negativ); Autarkie/Eigenverbrauch zusätzlich hart auf [0, 100] % gedeckelt.
* Einsatzplan-Kacheln zeigen jetzt zusätzlich eine kleine "Rest heute (inkl. laufender Stunde) | Morgen"-Aufschlüsselung unter der großen Kennzahl (ohne Beschriftung, passt sonst nicht in die Kachel) - die Erklärung dazu steht jetzt als Legende unter den Kacheln statt in der Überschrift: "(berechnet um HH:MM Uhr, Kennzahlen jeweils über die nächsten N Stunden bzw. restliche Stunden Heute | Morgen)".
* PV-Erzeugungs-Zusammenfassung unter dem PV-Prognose-Chart zeigt nur noch Heute/Morgen, kein "Übermorgen" mehr - das 48h-Fenster deckt diesen Tag nie vollständig ab, die Summe wirkte irreführend unvollständig.

## 0.0.44.55

* **Fix: Mast aus dem Hausbild war auf Mobil wieder sichtbar.** `buildCroppedHouseImage` (blendet den im Hausfoto eingezeichneten Strommasten per `clipPath` aus) hat eine fest verdrahtete `id` benutzt - seit es Desktop- UND Mobil-`<svg>` gleichzeitig im selben Dokument gibt (0.0.44.48), gab es diese ID doppelt. Der Browser löst `url(#...)` dokumentweit auf, nicht pro `<svg>` - das Mobil-Hausbild bekam dadurch fälschlich den Desktop-Zuschnitt (andere Koordinaten) und der eigentlich ausgeblendete Mast blitzte wieder durch. IDs sind jetzt pro Aufruf eindeutig.
* Energiefluss-Widget (Mobil): Grafik nochmal breiter (1150 statt 980), damit die Beschriftungen an den horizontalen Leitungen (Grid/Batterie) mehr Luft haben.
* Energiefluss-Widget (Mobil): Die Detail-Blöcke (Wärmepumpe/Auto/Sonstiges Gerät/Haushaltsstrom) starteten nacheinander gestapelt, dadurch rutschten die hinteren (z.B. Auto) immer weiter nach unten, nur weil die Wärmepumpe davor mehr Zeilen brauchte. Alle vier starten jetzt auf gleicher Höhe.

## 0.0.44.54

* **PV-Erzeugungsprognose ins Addon verlagert** (`pv_forecast.py`, ersetzt die frühere bubble-seitige „PV Prediction").
  * Holt alle 3 h `global_tilted_irradiance` (fest 35°/Süd), `temperature_2m` und `weather_code` von open-meteo (7 Tage Rückschau + 3 Tage Vorhersage, `timezone=Europe/Berlin`). Cache in `/data/weather_forecast.json`. Koordinaten aus HA `/api/config`. Erster Abruf beim Addon-Start.
  * Lernt pro Anlage ein „m²-Äquivalent" je Tagesstunde (0–23) in `/data/pv_calibration.json`: `Prognose_kW = (irr[i]+irr[i+1])/2 / 1000 · m²[h] · 0,2`, 0 unter 4 W/m², minus 5 % + 100 W Sicherheitsabschlag. Kalibrierung per EWMA (α = 0,25, robust gegen Ausreißertage): täglich 22:00 lokal mit den Messwerten des Tages, sowie einmalig aus 7 Tagen Historie, sobald erstmals ein PV-Leistungssensor zugeordnet wird. Startprofil ~50 m² tagsüber.
  * `update_site_addon` sendet jetzt zusätzlich die neuen Endpunkt-Parameter `Temperature`, `PV Prediction` (je `optimizationPeriodsSite` kommaseparierte Werte) und `Datetime Weather` (Bubble-Timestamps in ms, ab heute 0:00 Berlin). Ohne PV-Sensor werden Nullen gesendet.
  * Neuer Endpunkt `GET /dashboard/weather` + Wetter-Icon-Streifen über dem PV-Chart im Dashboard.
  * Der bisherige, bubble-seitige Temperatur-Weg wird damit abgelöst (Server-Änderung separat).

## 0.0.44.53

* Energiefluss-Widget (Mobil), drei Layout-Korrekturen:
  * Die Detail-Werte je Verbraucher (Wärmepumpe/Auto/Sonstiges Gerät/Haushaltsstrom) standen alle am selben linken Rand untereinander, dadurch wirkte es z.B. so, als gehörten die Wallbox-Werte zur Wärmepumpe. Jeder Block steht jetzt unter seinem eigenen Icon zentriert.
  * Strommast und Batterie standen zu eng am Haus - beide haben jetzt deutlich mehr Abstand.
  * Grafik insgesamt breiter (980 statt 820), damit die Leistungswerte (kW) an Mast und Batterie nicht mehr in die jeweilige Grafik hineinreichen.

## 0.0.44.52

* **Fix: Navigationsleisten-Icon wirklich nicht mehr abgeschnitten.** Die bisherigen Deploys (u.a. 0.0.44.43) hatten das Icon zwar korrekt aus dem Original-Logo erzeugt, aber randlos gefüllt - die Sonnenstrahlen/der Bogen berührten dadurch exakt die Bildkante, was in jeder Navigationsleiste "abgeschnitten" wirkte, obwohl die Datei technisch vollständig war. Icon jetzt mit echtem Sicherheitsabstand (aus der unbeschnittenen Quelle `assets/IconOnly_Transparent_NoBuffer_32px.png` neu erzeugt, auf 84% verkleinert und zentriert) - berührt jetzt keine Kante mehr. Betrifft sowohl `icon.png` (HA-Supervisor-Seite) als auch `www/assets/shyft-icon.png` (In-App-Navigationsleiste), weiterhin byte-identisch. Quelldatei erstmals ins Repo aufgenommen, damit sich das Icon künftig aus derselben Quelle neu erzeugen lässt.

* **Fix: Dashboard-Charts standen seit Samstag.** `provide_input_output_csv` liefert den Erstellzeitpunkt des Optimierungslaufs als Bubbles natives Feld **`Created Date`** (ms), nicht als `creation_date`. Das Add-on las nur `optimizer_run.get("creation_date")` → `None` → verwarf jeden Lauf mit „input_csv oder creation_date fehlt", obwohl `input_csv`/`output_csv` voll befüllt waren. Neuer Helfer `_optimizer_run_creation_ms` akzeptiert `Created Date` **und** `creation_date`; angewandt im stündlichen Dashboard-Sync und im Warte-Poll nach „Verbindung testen" (der aus demselben Grund nie aktualisiert hat). Per MCP am Live-System verifiziert: der Optimizer lief die ganze Zeit (heute 21:06 CEST, Laufzeit 203 s, kein Timeout) - nur die Antwort wurde add-on-seitig weggeworfen.

## 0.0.44.50

* `provide_input_output_csv`-Abruf, Diagnose des seit Samstag stehengebliebenen Dashboards:
  * **`creation_date` jetzt als Unix-Millisekunden-Integer** statt als `datetime.isoformat()`-String. Bubble speichert Datumsfelder intern als ms und parst ISO-8601-Strings mit Sekundenbruchteilen/Offset (`…123456+00:00`) im API-Workflow unzuverlässig - ein nicht geparster Wert lässt die "`creation_date >= X`"-Suche potenziell ins Leere laufen.
  * **Request-Payload und Response-Body werden jetzt geloggt** (`get_input_output_csv`, nur bei `detailed_logging`) - bisher stand nur die URL im Log, das genau gesendete `creation_date` und die Antwort waren nicht sichtbar.
  * **Stündlicher Dashboard-Refresh nutzt als `since` den `creation_date` des zuletzt gecachten Laufs** statt pauschal "jetzt − 5 h". Vor dem zuletzt bekannten Lauf gibt es ohnehin nichts Neueres zu holen (ein Output entsteht immer nach seinem Input). Nur beim allerersten Lauf ohne Cache greift eine kurze Rückschau (3 h). Der Warte-Poll nach `sync_site_data` nutzt wie bisher den exakten Absendezeitpunkt.

## 0.0.44.49

* Energiefluss-Widget (Mobil): Die Icons von Wärmepumpe/Auto/Sonstiges Gerät/Haushaltsstrom stehen weiterhin nebeneinander unter dem Haus, aber die vollständigen Detailwerte (wie auf Desktop, z.B. Ist-Temperatur, WW-Speicher, Heizungsstatus bei der Wärmepumpe bzw. Reichweite/Zeitstempel beim Auto) stehen jetzt untereinander darunter, statt gekürzt zu werden - dafür ist ja nach unten genug Platz. Behebt außerdem einen Layout-Fehler, durch den sich diese Textblöcke bei der größeren Mobil-Schrift teilweise überlappt hätten.

## 0.0.44.48

* Energiefluss-Widget bekommt jetzt ein eigenes, gedrehtes Layout für schmale Bildschirme (Mobil), statt das breite Desktop-Layout nur herunterzuskalieren (dort bisher kaum lesbar). Auf Mobil steht die Batterie rechts neben dem Haus (dort, wo auf Desktop die Verbraucher-Spalte beginnt), Wärmepumpe/Auto/Sonstiges Gerät/Haushaltsstrom stehen dafür nebeneinander unter dem Haus - weiterhin über animierte Stromleitungen verbunden. Die Schrift ist auf Mobil dadurch spürbar größer/lesbarer als vorher. Wärmepumpe und Auto zeigen dort aus Platzgründen nur die wichtigsten Werte (Status + Soll-Temperatur bzw. Ladestand + Status) statt aller Detailzeilen - das volle Detail bleibt unverändert auf Desktop sichtbar. Desktop-Ansicht selbst ist unverändert.

## 0.0.44.47

* Energiefluss-Widget: Bei der Batterie stehen SOC und Modus ("Maximize Self Consumption" o.ä.) wieder wie ursprünglich neben dem Batterie-Icon - nur der kW-Wert ist an der Leitung selbst zentriert (0.0.44.45 hatte versehentlich den ganzen Block inkl. SOC/Modus an die Leitung gehängt).
* Bei allen vier Leistungswerten an den Stromleitungen (Grid, PV, Eigenverbrauch, Batterie) steht ein Zeitstempel jetzt in derselben Zeile neben dem Wert (z.B. "-1,2 kW (19:41)") statt in einer eigenen Zeile darunter - dort ist genug Platz dafür.

## 0.0.44.46

* Jedes ausgewählte Gerät im Integrations-Dropdown (z.B. "Wechselrichter", "Batterie", ...) zeigt jetzt ein eigenes "×" zum direkten Entfernen, statt dafür das Dropdown öffnen und die Checkbox abwählen zu müssen. Wird ein Gerät so (oder über die Checkbox) entfernt, bleiben die zugehörigen Sensor-/Steuerungs-Zuordnungen erhalten - wählt man später dasselbe (oder ein anderes) Gerät wieder aus, sind die zuvor eingetragenen Werte weiterhin vorausgefüllt. Ein versehentliches Löschen führt also nicht zu Datenverlust.

## 0.0.44.45

* Der Button "Shyft-Zugangstoken ändern" in der In-App-Konfiguration hatte keine erkennbare Funktion mehr und wurde entfernt (samt dem zugehörigen `/set-access-key`-Endpoint). Stattdessen zeigt jetzt die native Add-on-Konfigurationsseite von Home Assistant (Supervisor-Tab, zwischen "Info" und "Protokoll") den Zugangstoken maskiert an - `shyft_access_key` nutzt dort HA's eingebauten `password`-Feldtyp inkl. Anzeigen-Button, statt ihn im Klartext zu zeigen.
* Energiefluss-Widget: Alle Leistungsfluss-Beschriftungen (Grid, Eigenverbrauch, Batterie, Wärmepumpe, Auto, Sonstiges Gerät, Haushaltsstrom) werden jetzt vertikal mittig an ihrer jeweiligen Stromleitung ausgerichtet, statt an einem festen Offset - dadurch bleiben sie auf gleicher Höhe, egal ob z.B. durch einen zusätzlichen Zeitstempel eine oder zwei Zeilen angezeigt werden. Grid- und Eigenverbrauchs-Beschriftung liegen jetzt zusätzlich auf exakt derselben Höhe (beide Leitungen liegen auf gleicher Höhe).
* Energiefluss-Widget: Die Leitung zwischen Sonne/Mond und Haus (PV) bleibt jetzt auch bei 0 kW sichtbar (grau, ohne Strompunkte) statt bei fehlendem PV-Ertrag ganz zu verschwinden - wie bei allen anderen Verbraucher-Leitungen.

## 0.0.44.44

* **Dritter addon-berechneter Aktionstyp: "Heizung Soll-Temperatur"**, nach demselben Muster wie "Warmwasser" (`compute_heizung_actions`) - läuft nur, wenn eine Wärmepumpe konfiguriert ist. Eine Aktion entsteht, wenn `T_i_Target` aus `output_csv` (auf 0 Nachkommastellen gerundet) vom aktuell aktiven Sollwert abweicht (Live-Wert des Controls "Heizung Soll-Temperatur (aktuell)", derselbe Referenzwert für alle 10 Stunden dieses Laufs). `Energy (electr) = HP_FH`, `Start Value = T_i` (aktuelle Raumtemperatur), `Target Value = T_i_Target` (gerundet), `costsopt = HP_FH × Durchschnittspreis`, Subtitle "Soll: XXX °C (YYY kWh elektr.)" (beide auf 0 Nachkommastellen). Start/Ende-Steuerung war bereits generisch vorhanden ("Heizung Soll-Temperatur" ist ein normaler `AUTO_MANAGED_CONTROLS`-Eintrag), keine Sonderbehandlung nötig.

## 0.0.44.43

* Fix: das Navigationsleisten-Icon (`www/assets/shyft-icon.png`, innerhalb der Addon-Seite - nicht zu verwechseln mit `icon.png`/`logo.png` für die HA-Supervisor-UI, siehe 0.0.44.30) war seit längerem als sauber freigestellte 128×128-Version vorbereitet, aber nie tatsächlich deployed. Jetzt live

## 0.0.44.41

* Warmwasserbereitung-Konfiguration: "Varianten"-Dropdown hat jetzt drei echte Zustände ("Befehl auswählen", "HA-Aktion", "HA-Automation") statt automatisch auf "Befehl" zu fallen - das "Befehl"-Feld blendet sich erst ein, wenn "HA-Aktion" explizit gewählt wird. "Varianten" steht jetzt auch vor statt nach dem "Befehl"-Feld
* Fix: Tooltip-Text lief bei einem Info-Icon nahe am linken Rand (z.B. in der ersten Tabellenspalte) über den Viewport-Rand hinaus und war dadurch abgeschnitten - Tooltip startet jetzt am Icon statt zentriert darüber

## 0.0.44.40

* Warmwasser-Aktion (siehe 0.0.44.39) bekommt jetzt eine Subtitle: "Von XXX °C auf YYY °C erwärmen (ZZZ kWh elektr.)" - XXX/YYY sind `T_HW` der aktuellen bzw. nächsten Stunde (auf 0 Nachkommastellen gerundet), ZZZ ist `HP_HW` (auf 1 Nachkommastelle).

## 0.0.44.39

* **Zweiter addon-berechneter Aktionstyp: "Warmwasser" (DHW)**, nach demselben Muster wie "Auto laden" (siehe 0.0.44.36/38) - läuft nur, wenn eine Wärmepumpe konfiguriert ist (`compute_dhw_actions`). Eine Aktion entsteht, wenn `HP_HW >= 0,2` in `output_csv`: `Energy (electr) = HP_HW`, `Start Value = T_HW` (aktuelle Zeile), `Target Value = T_HW der nächsten Zeile`, `costsopt = HP_HW × Durchschnittspreis` (dieselbe Berechnung wie bei "Auto laden"). Stunde 0 (die laufende Stunde) bekommt sofort `Status = "aktiv"` (Date Start = jetzt), damit sie nicht erst bis zu 59 Minuten auf den Stundenwechsel-Mechanismus warten muss; Stunden 1–9 bleiben "geplant". Nutzt dieselbe generische Reconciliation (`_reconcile_computed_actions`) und denselben Stundenwechsel-Mechanismus (`run_hourly_action_transition`) wie "Auto laden" - Start/Ende-Steuerung (`execute_hot_water_activate`) war bereits vorhanden.

## 0.0.44.38

* PV-Überschussladen: die Zielwert-Korrektur anhand der aktuell gemessenen PV-Leistung (siehe 0.0.44.36) passiert jetzt erst im tatsächlichen Startmoment der Aktion (`_apply_ev_pv_surplus_start_correction`, aufgerufen aus `handle_shyft_action_start`), nicht mehr schon bei der Berechnung - zwischen Berechnung und tatsächlichem Start können mehrere Minuten liegen, in denen sich die PV-Leistung schon geändert haben kann. `compute_ev_charge_actions` speichert dafür bei PV-Überschuss-Aktionen zusätzlich `PV Surplus`/`PV Sum Forecast` auf der Aktion.
* Korrektur: `SOC_EV` in `output.csv` ist bereits 0–100-skaliert (nicht 0–1, wie zunächst angenommen) - die Subtitle-Prozentanzeige und der Vergleich gegen "Maximaler Ladestand (PV-Überschuss)" rechnen jetzt nicht mehr fälschlich ×100.
* **Neuer, aktionstyp-übergreifender Stundenwechsel-Mechanismus** (`run_hourly_action_transition`, stündlich zur vollen Stunde): beendet abgelaufene aktive Aktionen (Status → "beendet" + tatsächliche Steuerung) und startet fällige geplante Aktionen (Status → "aktiv" + tatsächliche Steuerung) - gilt für jeden Aktionstyp im lokalen Store, nicht nur "Auto laden". Verlängerung statt Beenden+Neustart: hat die Aktion der unmittelbar folgenden Stunde denselben Target Value, wird sie gelöscht, ihre `costsopt` zur laufenden Aktion addiert und deren `Date End` um eine Stunde verlängert, statt das Gerät unnötig erneut zu triggern. Teilt sich `startedShyftActionIds`/`endedShyftActionIds` mit `process_shyft_actions`, damit nichts doppelt feuert.

## 0.0.44.37

* Energiefluss-Widget: Zeitstempel bei veralteten Werten (z.B. "Ist: 21,4 °C (17:01)") zeigen jetzt zusätzlich das Datum, wenn der Zeitstempel nicht vom heutigen Tag ist (z.B. "28.8. 17:01") - vorher wirkte ein mehrere Tage alter Wert wie einer von heute früh

## 0.0.44.36

* **Aktionsberechnung für "Auto laden" komplett aus Bubble herausgelöst - läuft jetzt rein im Addon**, kein Bubble-Call mehr für Aktionen (weder lesend noch schreibend). Erster Schritt einer schrittweisen Ablösung von `return_actions_to_addon`/`Create_Change_Action`; weitere Aktionstypen (Heizung, Zweitheizung, Warmwasser, Batterie) folgen später demselben Muster.
  * `recompute_actions_from_optimizer_run` (app.py) wird bei jedem frischen Optimierungslauf ausgelöst (stündlicher Sync UND die neue Warte-/Retry-Logik, siehe `_write_dashboard_cache`) und berechnet `compute_ev_charge_actions` für die ersten 10 Stunden von `output_csv` (Stunde 0 = die gerade laufende Stunde): eine Aktion entsteht, wenn `EV_sum > 0,3` (und in Stunde 0 zusätzlich nur, wenn das Auto laut `is_car_ready_to_charge` mit der Wallbox verbunden ist).
  * PV-Überschuss-Erkennung (`PV_GR < 1` und `B_EV < 0,3`): eigener Subtitle "PV-Überschussladen" plus Log-Eintrag; in der laufenden Stunde wird der Zielwert zusätzlich um die halbe Differenz zwischen aktuell gemessener PV-Leistung und der PV-Prognose des Laufs angehoben (gedeckelt auf 6A/1-phasig bis zur maximalen Wallbox-Leistung) - außer der in der Konfiguration hinterlegte "Maximaler Ladestand (PV-Überschuss)" ist schon erreicht, dann entsteht keine Aktion.
  * Durchschnittspreis je Stunde (für Subtitle-Anzeige und `costsopt`) aus Netzstromanteil (`GR_sum` zu `p_buy`) und PV-Eigenverbrauchsanteil (`X_sum - GR_sum` zu `p_sell`, als Opportunitätskosten).
  * Reconciliation (`_reconcile_computed_actions`, im neuen lokalen Store `COMPUTED_ACTIONS_PATH`): die laufende Stunde wird bei jedem neuen Lauf nur im Zielwert aktualisiert (nicht beendet und neu angelegt) und sofort beendet, falls die Bedingung nicht mehr gegeben ist; die Stunden 1–9 werden bei jedem Lauf verworfen und aus dem aktuellen Ergebnis neu aufgebaut. Der allgemeine, aktionstyp-unabhängige "zur vollen Stunde beenden/starten/verlängern"-Mechanismus folgt als separater, späterer Schritt.
  * `/shyft/actions` und `process_shyft_actions` lesen jetzt aus diesem lokalen Store statt von Bubble; `ShyftAdapter.get_actions`/`return_actions_to_addon` entfernt.

## 0.0.44.35

* Neue Felder `hw_usage_h`/`hotwaterkwh` in der an shyft-power gesendeten JSON (analog zu `ev_usage_h`/`d_ev_kwh`) - fester Default von 10 kWh/Tag Warmwasserbedarf, gleichmäßig auf die Stunden zwischen 6 und 22 Uhr verteilt (0,625 kWh/h), außerhalb 0. Noch kein eigenes Konfigurationsfeld dafür (bewusst erstmal einfach gehalten) - nur wenn eine Wärmepumpe konfiguriert ist

## 0.0.44.34

* Fix: 16 weitere Konfigurationsfelder (Wärmepumpe: Typ/Wohnfläche/Energieeffizienz/WW-Speicher/Max. Leistung/Max. Vorlauftemp./Heizungspuffer/Heizkurve Niveau+Steigung; Batterie: Kapazität/Min. Ladestand; Strom/Optimierung: Gaspreis/Optimierungszeitraum/Grundlast/Strompreis Einkauf/Einspeisevergütung) fehlten bislang im PUT-Body beim Speichern (nur lokal in configData gesetzt) - jede Auswahl ging beim nächsten Speichern wieder verloren. Alle jetzt korrekt in saveConfigurationNow enthalten, mit denselben Default-Werten wie ihr jeweiliges Eingabefeld

## 0.0.44.33

* "Ziel-Ladestand (normal)" beim Auto umbenannt in "Mindestladestand" (samt klarerer Erläuterung). Neues Feld "Maximaler Ladestand (PV-Überschuss)" (60–95 %) - deckelt nur das PV-Überschussladen, um die Autobatterie zu schonen; geplante Strecken und günstiger Netzstrom laden weiterhin voll. Neues Bubble-Feld `EV - SOC Max PV Surplus`
* Fix: beide Felder (und "Ziel-Ladestand normal" selbst) wurden bisher beim Speichern nicht tatsächlich mitgeschickt (nur lokal in configData gesetzt) - eine Auswahl ging beim nächsten Speichern wieder verloren. Jetzt korrekt in saveConfigurationNow enthalten

## 0.0.44.32

* Energiefluss-Widget: die durch die Zeitstempel-Anzeige verlängerten Geräte-Labels ließen die Icons (v.a. das 130px breite Auto-Bild) in den senkrechten Verbraucher-Bus hineinragen - Grafik verbreitert (1100→1300) und der Abstand zwischen Bus und Geräte-Spalte deutlich vergrößert (30→110px), sodass alle Icons klar abgesetzt rechts der Leitung stehen. Ein "(HH:MM)"-Zeitstempel-Suffix bricht jetzt automatisch auf eine eigene Zeile um, statt die Zeile beliebig lang werden zu lassen. Die wandernden Stromfluss-Punkte bewegen sich jetzt unabhängig von der jeweiligen Leitungslänge gleich schnell (px/s) - vorher liefen sie auf kurzen Leitungen (z.B. Haushaltsstrom) sichtbar langsamer, weil dieselbe Umlaufdauer bei kürzerer Strecke automatisch eine geringere Geschwindigkeit ergab

## 0.0.44.31

* Neue "Einsatzplan"-Karte im Dashboard-Tab, direkt unter der PV-Prognose: fasst den aktuellen Optimierungslauf in vier Kennzahlen zusammen - Stromverbrauch (kWh), ø Netzstrom (Cent/kWh), Autarkie (%) und Eigenverbrauch (%), jeweils über die Laufzeit des Optimizer-Runs (Zeilenzahl von `output_csv`). Titel zeigt zusätzlich die Uhrzeit des Laufs ("berechnet um HH:MM Uhr").
  * Backend (`_compute_einsatzplan_summary` in `app.py`, Teil von `/dashboard/chart-data`): `Stromverbrauch = Σ X_sum`; `ø Netzstrom = Σ costs_opt / Σ GR_sum * 100` ("-" wenn `GR_sum` ~0); `Autarkie = (Σ X_sum - Σ GR_sum) / Σ X_sum * 100` ("-" wenn `X_sum` ~0); `Eigenverbrauch = min(Σ X_sum - Σ GR_sum, PV-Erzeugung) / PV-Erzeugung * 100`, gedeckelt auf 100% ("-" wenn PV-Erzeugung ~0). `X_sum`/`GR_sum`/`costs_opt` sind Pro-Stunde-Spalten in `output_csv`, die PV-Erzeugung kommt aus `input_csv` (`PV_generation`), begrenzt auf dieselbe Stundenzahl.
  * Frontend (`buildEinsatzplanCard` in `app.js`): vier grüne Kennzahl-Kacheln analog zum Vorbild-Design.

## 0.0.44.30

* `icon.png`/`logo.png` (Home Assistant Supervisor: Add-on-Liste/Navigation bzw. Info-Header) waren bislang ein auf 67×46px seitlich beschnittener Ausschnitt des Logos, wodurch links und rechts Teile fehlten. Neu erzeugt aus den unbeschnittenen Quellbildern (`www/assets/shyft-icon.png`/`shyft-logo.png`): `icon.png` als quadratisches 128×128-Sonnensymbol (dieser Slot wird von HA fest quadratisch dargestellt), `logo.png` als 250×61 breites "SHYFT"-Wortmarken-Logo (dieser Slot erlaubt nicht-quadratisch, HA schneidet dort nichts ab).

## 0.0.44.29

* Präzise Optimizer-Timeout-Erkennung (statt der bisherigen "output_csv leer"-Heuristik aus 0.0.44.28): `_check_optimizer_result` prüft jetzt gezielt das `Infos`-Feld des `optimizer_run`-Objekts auf `"Timeout during optimizer call happened. Optimizing took more than 600 seconds."` (`_optimizer_run_indicates_timeout`, `OPTIMIZER_TIMEOUT_DETAIL_MARKER`) - funktioniert unabhängig davon, ob Bubble `Infos` als verschachteltes Objekt oder als roher JSON-String liefert. Die leere-`output_csv`-Prüfung bleibt als Fallback zusätzlich bestehen.

## 0.0.44.28

* Nach dem Absenden der Site-Daten (`sync_site_data`, sowohl der stündliche Sync als auch der manuelle `/trigger`) wartet das Addon jetzt aktiv auf ein frisches Optimierungsergebnis, statt nur auf den nächsten stündlichen `sync_dashboard_chart_data`-Lauf zu hoffen:
  * Nachfrage bei `provide_input_output_csv` (mit `since` = Absendezeitpunkt) nach 1, 2, 4:30, 7 und 10 Minuten (`OPTIMIZER_WAIT_POLL_DELAYS_MINUTES`, `schedule_optimizer_result_wait`) - der erste Treffer mit gefülltem `optimizer_run` gewinnt und bricht die noch ausstehenden Nachfragen für diesen Versuch ab (`_check_optimizer_result`/`_cancel_remaining_optimizer_wait_jobs`).
  * Kommt `optimizer_run` mit leerem `output_csv` zurück (Optimizer im eigenen 600s-Timeout), wird bis zu `MAX_OPTIMIZER_TIMEOUT_RETRIES` (2) mal automatisch mit um `OPTIMIZER_PERIOD_REDUCTION_ON_TIMEOUT` (2) reduzierter Optimizer-Periode neu getriggert (`_handle_optimizer_timeout` → erneuter `sync_site_data`-Aufruf mit `optimizer_period_override`).
  * Kommt nach der letzten Nachfrage (10 Minuten) weiterhin kein Ergebnis, oder sind die Timeout-Neuversuche aufgebraucht, wird ein Fehler über den bestehenden `log_error_to_shyft`/`ha_addon_error_logging`-Weg an shyft-power gemeldet (`_handle_optimizer_wait_exhausted`).
  * `sync_service.collect_static_config` unterstützt jetzt `optimizer_periods_override`, um für so einen Retry nur den gesendeten Wert zu verringern, ohne die gespeicherte Konfiguration zu verändern.
  * Der Cache-Schreibvorgang für die Dashboard-Charts (`DASHBOARD_CACHE_PATH` + PV-Prognose-Snapshot) ist jetzt in `_write_dashboard_cache` zusammengefasst und wird sowohl vom stündlichen `sync_dashboard_chart_data` als auch vom erfolgreichen Warte-Ergebnis genutzt.

## 0.0.44.27

* Zwei Anpassungen an `provide_input_output_csv`, nachdem sich das Bubble-seitige Antwortformat geändert hat:
  * `input_csv`/`output_csv`/`creation_date` stecken jetzt eine Ebene tiefer, im verschachtelten `optimizer_run`-Objekt statt direkt in `response` (`sync_dashboard_chart_data` liest jetzt `response.optimizer_run.*`).
  * `creation_date` ist jetzt Pflichtparameter (Bubble "Date"-Feld, UTC) - `ShyftAdapter.get_input_output_csv` sendet ihn jetzt immer mit; ohne explizite Angabe standardmäßig "vor 5 Stunden" (`DEFAULT_SINCE_LOOKBACK_HOURS`, vorläufiger Wert, solange die "nur neuer als X"-Logik bubble-seitig noch nicht fertig ist).

## 0.0.44.26

* Demo-Modus braucht keinen (Fake-)Bubble-Account mehr - `is_demo_mode()` (app.py) prüft stattdessen einfach, ob überhaupt ein echter `shyft_access_key` hinterlegt ist (config.yaml's eigener Default `"notset"`, kein separater Demo-Key/-Vergleich mehr nötig). Solange das so ist, ruft das Addon **niemals** Bubble auf:
  * `sync_site_data`/`sync_pv_history` überspringen den Bubble-Call ganz (statt es zu versuchen und am ungültigen Token zu scheitern).
  * `sync_dashboard_chart_data` lädt für die Dashboard-Charts stattdessen zwei statische, mit dem Addon ausgelieferte Dateien (`demo_data/demo_input.csv`/`demo_output.csv`, noch nachzuliefern - siehe `demo_data/README.md`) - `creation_date` wird dabei automatisch auf die aktuelle volle Stunde gesetzt, damit die Beispieldaten immer aktuell wirken.
  * Aktions-Abruf (`/shyft/actions`, `process_shyft_actions`, Fehlerreports) war über die bestehende `user_id`-Extraktion aus dem Token bereits automatisch demo-sicher (kein echter Token → keine gültige `user_id` → kein Call).

## 0.0.44.25

* **Kompletter Umbau der Onboarding-Logik** (ersetzt das Demo-Popup aus 0.0.44.24 - wieder entfernt, kein E-Mail/Passwort mehr vom Nutzer):
  * Neuinstallationen starten jetzt mit einem synthetischen "Demo-Gerät" für Wechselrichter, Batterie, Wärmepumpe, Auto und Wallbox (auswählbar/änderbar im selben Dropdown wie echte HA-Integrationen, schließt sich gegenseitig mit einer echten Auswahl aus). Demo und echtes Gerät zeigen sich gegenseitig exklusiv im Dropdown (Auswahl des einen deselektiert das andere).
  * Solange ein Demo-Gerät aktiv ist, liefern Dashboard, Energiefluss-Widget und die an shyft-power gesendeten Live-Werte plausible Beispieldaten (`get_demo_value`/`DEMO_SECTION_SENSORS` in `sync_service.py`, zentral eingehängt in `_read_mapped_entity_state` in `app.py` - PV folgt grob einer Tageslichtkurve, der Rest sind plausible statische Werte) statt leer zu bleiben. Kein Sensor-Mapping nötig, `isSectionComplete` behandelt ein Demo-Gerät immer als vollständig konfiguriert.
  * Sobald erstmals ein echtes Gerät für eine dieser fünf Kategorien hinterlegt wird (und der Zugangstoken noch der gemeinsame Demo-Key ist), legt `maybe_create_real_account` (app.py, aufgerufen aus `writeConfig`) automatisch im Hintergrund einen echten shyft-power-Account an (`create_user_addon`, jetzt ohne Parameter - Bubble erzeugt E-Mail/Username/Passwort selbst) und übernimmt den zurückgegebenen Zugangstoken sofort. Kein Popup, keine Nutzerinteraktion nötig.
  * "Shyft-Zugangstoken ändern" (aus 0.0.44.24) bleibt für den manuellen Fall (bestehenden Account hinterlegen, Konto wechseln).

## 0.0.44.24

* Demo-Modus-Popup + eigenes Zugangstoken-Management auf der Konfigurationsseite, für neue Nutzer, die nur mit dem Addon (nicht mit Bubble direkt) arbeiten sollen:
  * Solange der hinterlegte `shyft_access_key` exakt dem gemeinsamen Demo-Konto entspricht (`DEMO_SHYFT_ACCESS_KEY` in `constants.py` - **Platzhalterwert, noch mit dem echten Demo-Key zu befüllen**), zeigt die Konfigurationsseite automatisch (aber wegklickbar) ein Popup: "Du befindest dich noch im Demomodus...". Neuer Endpunkt `GET /account-status`.
  * Formular für E-Mail + Passwort ruft `POST /create-account` auf, das den neuen Bubble-Workflow `create_user_addon` aufruft (aktuell fest gegen die shyft-power-Testumgebung verdrahtet, siehe `ShyftAdapter.create_user` - der Workflow existiert bislang nur dort). `"has an account": "yes"` in der Antwort wird als Fehler gedeutet (E-Mail bereits vergeben) und nichts gespeichert; sonst wird der zurückgegebene `access_key` direkt übernommen.
  * Der Zugangstoken wird jetzt erstmals im Addon-eigenen Frontend änderbar gemacht (bisher nur über HAs generisches Add-on-Konfigurationsformular möglich) - standardmäßig ausgeblendet, Button "Shyft-Zugangstoken ändern" blendet ein leeres Eingabefeld ein (der echte aktuelle Wert wird nie ans Frontend zurückgegeben). Neuer Endpunkt `POST /set-access-key`, für bestehende Accounts oder einen Kontowechsel.
  * Serverseitig neu: `_persist_shyft_access_key` (app.py) schreibt einen neuen Token über die Supervisor-API (`POST /addons/self/options`, neue `HomeAssistantAdapter.post_to_supervisor`) - direktes Schreiben von `/data/options.json` funktioniert nicht, das verwaltet Supervisor selbst. Aktualisiert zusätzlich sofort den laufenden Prozess (`shyft_adapter.set_access_key`), kein Neustart nötig.

## 0.0.44.23

* PV-Leistung: Prognose vs. Ist - Farben konsistent zu den übrigen Charts: Prognose grün (--color-accent), Ist-Werte in Textfarbe (--color-text, theme-aware statt hartem Schwarz)

## 0.0.44.22

* PV-Leistung-Chart zeigt jetzt Prognose gegen Ist-Werte: neue tägliche, eingefrorene Prognose-Momentaufnahme (einmal pro Kalendertag, damit spätere Vergleiche nicht die im Tagesverlauf laufend korrigierte Prognose zeigen) plus stundenweise gemittelte tatsächliche PV-Leistung, beide auf einer gemeinsamen Zeitachse ab 0 Uhr (lokal) bis in die Zukunft. Neuer Endpunkt `GET /dashboard/pv-forecast-vs-actual`, neue Persistenz `/data/pv_forecast_snapshot.json`

## 0.0.44.21

* Energiefluss-Widget aktualisiert sich jetzt alle 30s selbstständig (nur solange der Dashboard-Tab sichtbar/aktiv ist) - vorher blieb es auf dem Stand des Seitenaufrufs stehen, bis man manuell neu geladen hat. Ersetzt gezielt nur das Widget, nicht den ganzen Dashboard-Tab (Liniencharts bleiben unberührt, kein Aufblitzen/Scroll-Reset)

## 0.0.44.20

* Zwei neue berechnete Werte im addon_sensor_data_JSON, für die `shyft`-Server (Java) jetzt `ev_charge_rate`/`p_min` bezieht statt sie selbst per Sensor abzufragen:
  * `WB - Max Charging Power` (staticConfig, nur wenn eine Wallbox konfiguriert ist): aus den bereits vorhandenen Feldern "Max. Anzahl an Phasen" × "Max. Stromstärke (pro Phase)" × 230V - `compute_wallbox_max_kw` ist dafür von `app.py` nach `sync_service.py` gewandert (wird dort jetzt auch für `collect_static_config` gebraucht), `app.py` importiert sie von dort für die PV-Überschussladen-Rückfalllogik weiter wie bisher.
  * `WB - p_min` (liveValues, neu `compute_wb_p_min`): der niedrigste ab der aktuellen Stunde (inklusive, Vergangenheit ausgeschlossen) noch bevorstehende Strompreis aus dem gecachten `input.csv` (dieselbe Quelle wie der Strompreis-Chart), plus 0,02 € Sicherheitsmarge - kein neues Konfigurationsfeld, komplett serverseitig berechnet.

## 0.0.44.19

* Fix: Die "Aktualisierungszeiten" im Energiefluss-Widget (Staleness-Anzeige) lasen bisher `last_updated`, das nur bei einer Werte- oder Attributänderung fortschreibt - meldet ein Sensor wiederholt denselben Wert (z.B. Autobatterie-SOC über längere Standzeit), wirkte er dadurch älter als er war, obwohl Home Assistant ihn längst neu abgerufen hatte. Jetzt wird `last_reported` gelesen (fällt auf `last_updated` zurück, falls eine ältere Home-Assistant-Version das Feld noch nicht liefert) - das ist der tatsächliche Zeitpunkt der letzten Aktualisierung, unabhängig davon, ob sich der Wert geändert hat.

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