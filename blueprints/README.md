# Shyft Blueprints

Fertige Home-Assistant-Blueprints, mit denen Nutzer:innen des shyft-power-Addons
die "Aktionen" (Shyft-Aktion -> Home Assistant Automation/Skript) ohne eigenes
YAML einrichten können. Jedes Blueprint erzeugt ein **Skript**; dessen
Entity-ID (`script.xxx`) trägt man anschließend im Addon bei der jeweiligen
Aktion ein.

## Verfügbare Blueprints

| Blueprint | Deckt Aktion ab | Ansatz |
|---|---|---|
| [`heizung_soll_temperatur.yaml`](heizung_soll_temperatur.yaml) | Heizung Soll-Temperatur | Entity-Picker (number/climate) + generischer HA-Service |
| [`wallbox_ladevorgang_starten.yaml`](wallbox_ladevorgang_starten.yaml) | Auto laden | Aktions-Selector (herstellerspezifischer Service) |

## Import

Import-Link öffnen -> in Home Assistant öffnet sich automatisch der
Blueprint-Import-Dialog:

- Heizung Soll-Temperatur:
  https://my.home-assistant.io/redirect/blueprint_import/?blueprint_url=https%3A%2F%2Fraw.githubusercontent.com%2Fanselmhuewe%2Fha-shyft-addon%2Fmain%2Fblueprints%2Fheizung_soll_temperatur.yaml
- Wallbox Ladevorgang starten:
  https://my.home-assistant.io/redirect/blueprint_import/?blueprint_url=https%3A%2F%2Fraw.githubusercontent.com%2Fanselmhuewe%2Fha-shyft-addon%2Fmain%2Fblueprints%2Fwallbox_ladevorgang_starten.yaml

Alternativ manuell: Einstellungen -> Automatisierungen & Szenen -> Blueprints
-> Blueprint importieren -> Raw-URL der Datei einfügen.

Nach dem Import unter "Skripte" das neue Skript öffnen, die Entity(en)/Aktion
auswählen und speichern. Die entstandene `script.xxx`-Entity-ID dann im Addon
eintragen.
