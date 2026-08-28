# the following constants are required to nbe filled with useful values
BUBBLE_URI_TEST = "https://shyft-power.com/version-test/"
BUBBLE_URI_PRD = "https://shyft-power.com/"
BUBBLE_TOKEN ="sa"

# Ein shyft_access_key mit diesem Praefix routet an die shyft-power-Testumgebung statt an Prod -
# siehe ShyftAdapter.set_access_key. Analog zu z.B. Stripes "sk_test_..." vs. "sk_live_..."
# API-Keys: die Umgebung steckt im Schluessel selbst statt in einer eigenen, fuer jeden Nutzer
# sichtbaren Konfigurationsoption (die liesse sich versehentlich hin- und herschalten, ohne dass
# der Nutzer merkt, dass seine Daten dann gar nicht mehr in Prod ankommen). Wird ausschliesslich
# manuell vom Entwickler selbst gesetzt (eigene Test-HA-Instanz), nie ueber die Konfigurationsseite
# des Addons - ein normaler Nutzer bekommt seinen echten Key nie mit diesem Praefix.
DEV_ACCESS_KEY_PREFIX = "test_"

HOMEASSISTANT_URI="http://homeassistant.local:8123"
CONFIG_PATH = "/data/config.json"

# shyft_access_key des gemeinsamen Demo-Kontos, mit dem das Addon vor der Ersteinrichtung
# ausgeliefert wird - solange der aktuell hinterlegte Key exakt diesem entspricht, zeigt die
# Konfigurationsseite das Demo-Popup ("Du befindest dich noch im Demomodus...", siehe
# GET /account-status in app.py). TODO: echten Wert des Demo-Kontos eintragen.
DEMO_SHYFT_ACCESS_KEY = "TODO_DEMO_ACCESS_KEY_NOT_SET"
